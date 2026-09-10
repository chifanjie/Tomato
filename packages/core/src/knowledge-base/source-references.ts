import type { GraphNode, KnowledgeGraph } from "../types.js";
import type { GeneratedDocument, SourceEvidence } from "./types.js";

const FILE_TYPES = ["file", "config", "schema", "document"];

/** One physical file is one coverage denominator, even when it owns several schema nodes. */
export function referenceFileNodeIdsForGraph(graph: KnowledgeGraph): string[] {
  const owners = new Map<string, GraphNode>();
  for (const node of graph.nodes) {
    if (!node.filePath || !FILE_TYPES.includes(node.type)) continue;
    const previous = owners.get(node.filePath);
    if (!previous || FILE_TYPES.indexOf(node.type) < FILE_TYPES.indexOf(previous.type)) owners.set(node.filePath, node);
  }
  return [...owners.values()].map((node) => node.id).sort();
}

/** Full-corpus source navigation is independent of the budget used for semantic writing. */
export function withSourceReferenceDocuments(
  graph: KnowledgeGraph,
  sourceFiles: Readonly<Record<string, string>>,
  documents: readonly GeneratedDocument[],
): GeneratedDocument[] {
  const nodesByPath = new Map<string, GraphNode[]>();
  for (const node of graph.nodes) {
    if (!node.filePath) continue;
    const nodes = nodesByPath.get(node.filePath) ?? [];
    nodes.push(node);
    nodesByPath.set(node.filePath, nodes);
  }
  const result = [...documents];
  for (const [filePath, nodes] of [...nodesByPath].sort(([a], [b]) => a.localeCompare(b))) {
    const source = sourceFiles[filePath];
    if (source === undefined) continue;
    const lines = source.split(/\r?\n/u);
    const evidence: SourceEvidence[] = [];
    const sections: string[] = [];
    const anchors: GeneratedDocument["symbolAnchors"] = [];
    const directIds: string[] = [];
    const contextIds: string[] = [];
    for (const node of nodes.sort((a, b) => a.id.localeCompare(b.id))) {
      const anchor = `source-${encodeURIComponent(node.id)}`;
      anchors.push({ nodeId: node.id, anchor });
      const range = node.type === "file" || (FILE_TYPES.includes(node.type) && !node.lineRange)
        ? [1, Math.min(lines.length, 80)] as [number, number] : node.lineRange;
      const valid = range !== undefined && Number.isSafeInteger(range[0]) && Number.isSafeInteger(range[1])
        && range[0] > 0 && range[1] >= range[0] && range[1] <= lines.length;
      sections.push(`<a id="${anchor}"></a>\n\n## ${node.name}\n\n类型：${node.type}；节点：\`${node.id}\``);
      if (!valid) {
        contextIds.push(node.id);
        sections.push("图谱没有提供有效的源码行号；定义位置与业务含义尚未核验。");
        continue;
      }
      const lineRange: [number, number] = [range[0], Math.min(range[1], range[0] + 79)];
      const excerpt = lines.slice(lineRange[0] - 1, lineRange[1]).join("\n");
      const claim = `静态源码引用：${filePath}:${lineRange.join("-")}；业务含义尚待宿主分析。`;
      directIds.push(node.id);
      evidence.push({ nodeId: node.id, filePath, lineRange, excerpt, claim });
      const fence = "`".repeat(Math.max(3, ...[...excerpt.matchAll(/`+/gu)].map((match) => match[0].length + 1)));
      sections.push(`${claim}\n\n${fence}\n${excerpt}\n${fence}`);
      if (lineRange[1] < range[1]) sections.push(`摘录截至第 ${lineRange[1]} 行；完整定义截至第 ${range[1]} 行，可继续读取源码。`);
    }
    // Chunk escaped paths so deep repository paths never exceed a filesystem name limit.
    const pathChunks = encodeURIComponent(filePath).match(/.{1,100}/gu) ?? ["unknown"];
    const documentPath = `源码引用/${pathChunks.map((chunk) => `p-${chunk}`).join("/")}.md`;
    result.push({
      id: `page:source-reference:${encodeURIComponent(filePath)}`, path: documentPath,
      title: `${filePath} · 源码引用`, summary: "全图源码位置与真实摘录；不代表业务规则已经解释或核验。",
      category: "file", role: "reference", directNodeIds: directIds, contextNodeIds: contextIds,
      symbolAnchors: anchors, representedEdgeIds: [], reason: "full-graph-source-reference",
      content: `# ${filePath} · 源码引用\n\n本页仅提供静态源码与符号导航。业务流程、条件含义和运行时行为需要宿主结合证据分析。\n\n${sections.join("\n\n")}\n`,
      sourceEvidence: evidence, searchTerms: [filePath, ...nodes.map((node) => node.name)],
      quality: directIds.length > 0 ? "generated" : "needs-review",
      generationStatus: directIds.length > 0 ? "complete" : "partial",
      qualityIssues: contextIds.length ? ["部分节点缺少有效源码位置，不能计入引用覆盖"] : [],
    });
  }
  return result;
}
