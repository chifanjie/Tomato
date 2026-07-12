import type { WikiEvidenceV2, WikiIndexV2, WikiPageV2 } from "@understand-code/core";
import type { KnowledgeGraph } from "@understand-code/core/types";

const FILE_COUNT = 277;
const SYMBOL_COUNT = 479;
const FEATURED_PAGE_COUNT = 20;
const GENERATED_AT = "2026-07-11T00:00:00.000Z";

export interface LargeRepositoryFixture {
  graph: KnowledgeGraph;
  wiki: WikiIndexV2;
  selectedId: string;
  neighborId: string;
}

export function largeRepositoryFixture(): LargeRepositoryFixture {
  const files = Array.from({ length: FILE_COUNT }, (_, index) => ({
    id: `file:src/module-${index}.ts`,
    type: "file" as const,
    name: `module-${index}.ts`,
    filePath: `src/module-${index}.ts`,
    summary: `模块 ${index} 的源码入口。`,
    tags: ["fixture"],
    complexity: "moderate" as const,
  })) satisfies KnowledgeGraph["nodes"];

  const symbols = Array.from({ length: SYMBOL_COUNT }, (_, index) => ({
    id: `function:src/module-${index % FILE_COUNT}.ts:run${index}`,
    type: "function" as const,
    name: `run${index}`,
    filePath: `src/module-${index % FILE_COUNT}.ts`,
    lineRange: [index + 1, index + 3] as [number, number],
    summary: `执行第 ${index} 个可验证步骤。`,
    tags: ["fixture"],
    complexity: "moderate" as const,
  })) satisfies KnowledgeGraph["nodes"];

  const selectedId = symbols[470]!.id;
  const neighborId = symbols[471]!.id;
  const nodes: KnowledgeGraph["nodes"] = [...files, ...symbols];
  const evidenceId = (nodeId: string): string => `evidence:${nodeId}`;
  const symbolsByFilePath = new Map<string, typeof symbols>();
  for (const symbol of symbols) {
    const grouped = symbolsByFilePath.get(symbol.filePath) ?? [];
    grouped.push(symbol);
    symbolsByFilePath.set(symbol.filePath, grouped);
  }

  const edges: KnowledgeGraph["edges"] = [
    ...symbols.map((symbol, index) => ({
      source: files[index % files.length]!.id,
      target: symbol.id,
      type: "contains" as const,
      direction: "forward" as const,
      weight: 1,
    })),
    {
      source: selectedId,
      target: neighborId,
      type: "calls" as const,
      direction: "forward" as const,
      weight: 1,
    },
  ];

  const featuredPages: WikiPageV2[] = Array.from(
    { length: FEATURED_PAGE_COUNT },
    (_, index) => ({
      id: `page:featured-${index}`,
      title: index === 0 ? "项目总览" : `推荐阅读 ${index}`,
      summary: `解释第 ${index} 个业务到代码阶段。`,
      markdownPath: `knowledge-base/featured-${index}.md`,
      role: "featured",
      category: index === 0 ? "overview" : "flow",
      quality: "generated",
      generationStatus: "complete",
      directNodeIds: [symbols[index]!.id],
      contextNodeIds: [],
      evidenceIds: [evidenceId(symbols[index]!.id)],
      searchTerms: [`阶段 ${index}`],
      route: { order: index, stage: index === 0 ? "purpose" : "flow" },
    }),
  );
  const featuredDirectPageByNodeId = new Map(
    featuredPages.flatMap((page) => page.directNodeIds.map((nodeId) => [nodeId, page.id] as const)),
  );

  const referencePages: WikiPageV2[] = files.map((file, index) => {
    const fileSymbols = symbolsByFilePath.get(file.filePath) ?? [];
    const directNodeIds = [file.id, ...fileSymbols.map((symbol) => symbol.id)];
    return {
      id: `page:file-${index}`,
      title: file.filePath,
      summary: `说明 ${file.filePath} 的职责、分支与符号。`,
      markdownPath: `knowledge-base/reference/module-${index}.md`,
      role: "reference",
      category: "file",
      quality: "generated",
      generationStatus: "complete",
      directNodeIds,
      contextNodeIds: [],
      evidenceIds: directNodeIds.map(evidenceId),
      searchTerms: [file.filePath],
    };
  });
  const pages = [...featuredPages, ...referencePages];

  const nodeDocumentation: WikiIndexV2["nodeDocumentation"] = nodes.map((node) => {
    const match = node.filePath?.match(/module-(\d+)/);
    if (!match) throw new Error(`夹具节点缺少可解析的文件路径：${node.id}`);
    const pageId = `page:file-${Number(match[1])}`;
    const featuredDirectPageId = featuredDirectPageByNodeId.get(node.id);
    return {
      nodeId: node.id,
      relation: "direct",
      quality: "generated",
      evidenceHealth: "source-linked",
      generationStatus: "complete",
      referenceCoverage: "anchored",
      directPageIds: featuredDirectPageId ? [featuredDirectPageId, pageId] : [pageId],
      contextPageIds: [],
      evidenceIds: [evidenceId(node.id)],
      primaryPageId: pageId,
      ...(node.type === "function" ? { anchor: node.name } : {}),
    };
  });

  const evidence: WikiEvidenceV2[] = nodes.map((node) => ({
    id: evidenceId(node.id),
    nodeIds: [node.id],
    filePath: node.filePath ?? `src/${node.name}`,
    lineRange: node.lineRange ?? [1, 3],
    excerpt: `export const ${node.name.replace(/[^A-Za-z0-9_$]/g, "_")} = true;`,
    evidenceType: "production",
  }));

  const wiki: WikiIndexV2 = {
    version: 2,
    generatedAt: GENERATED_AT,
    projectName: "large-demo",
    source: { outputLanguage: "zh-CN", generationMode: "fixture" },
    mainReadiness: {
      status: "ready",
      reasons: [],
      routePageIds: featuredPages.map((page) => page.id),
    },
    referenceCoverage: {
      status: "complete",
      files: { covered: FILE_COUNT, total: FILE_COUNT, missingIds: [] },
      functions: { covered: SYMBOL_COUNT, total: SYMBOL_COUNT, missingIds: [] },
      types: { covered: 0, total: 0, missingIds: [] },
    },
    pages,
    nodeDocumentation,
    evidence,
  };

  const graph: KnowledgeGraph = {
    version: "1.0",
    project: {
      name: "large-demo",
      languages: ["TypeScript"],
      frameworks: [],
      description: "用于大仓验收的确定性项目。",
      analyzedAt: GENERATED_AT,
      gitCommitHash: "fixture",
    },
    layers: [{
      id: "scope:src",
      name: "src",
      description: "源码范围",
      nodeIds: files.map((file) => file.id),
    }],
    nodes,
    edges,
    tour: [],
  };

  return { graph, wiki, selectedId, neighborId };
}
