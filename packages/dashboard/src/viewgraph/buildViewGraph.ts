import type { GraphNode, KnowledgeGraph } from "@understand-code/core/types";
import { classifyFunctionName, groupFunctionDots } from "./functionGrouping";
import type { FunctionDot, ViewFileSummary, ViewGraph, ViewLayerSummary } from "./types";

function byId(graph: KnowledgeGraph): Map<string, GraphNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

function buildLayerLookup(graph: KnowledgeGraph): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const layer of graph.layers) {
    for (const nodeId of layer.nodeIds) {
      if (!lookup.has(nodeId)) lookup.set(nodeId, layer.id);
    }
  }
  return lookup;
}

function sortByLineThenName(a: GraphNode, b: GraphNode): number {
  const aLine = a.lineRange?.[0] ?? Number.MAX_SAFE_INTEGER;
  const bLine = b.lineRange?.[0] ?? Number.MAX_SAFE_INTEGER;
  if (aLine !== bLine) return aLine - bLine;
  return a.name.localeCompare(b.name);
}

export function buildViewGraph(graph: KnowledgeGraph): ViewGraph {
  const nodesById = byId(graph);
  const nodeToLayerId = buildLayerLookup(graph);
  const functionToFileId = new Map<string, string>();
  const fileToFunctionIds = new Map<string, string[]>();
  const fileToClassIds = new Map<string, string[]>();
  const importOut = new Map<string, Set<string>>();
  const importIn = new Map<string, Set<string>>();

  for (const edge of graph.edges) {
    if (edge.type === "contains") {
      const child = nodesById.get(edge.target);
      if (child?.type === "function") {
        functionToFileId.set(edge.target, edge.source);
        const list = fileToFunctionIds.get(edge.source) ?? [];
        list.push(edge.target);
        fileToFunctionIds.set(edge.source, list);
      }
      if (child?.type === "class") {
        const list = fileToClassIds.get(edge.source) ?? [];
        list.push(edge.target);
        fileToClassIds.set(edge.source, list);
      }
    }

    if (edge.type === "imports") {
      const outSet = importOut.get(edge.source) ?? new Set<string>();
      outSet.add(edge.target);
      importOut.set(edge.source, outSet);
      const inSet = importIn.get(edge.target) ?? new Set<string>();
      inSet.add(edge.source);
      importIn.set(edge.target, inSet);
    }
  }

  const filesById = new Map<string, ViewFileSummary>();
  for (const fileNode of graph.nodes.filter((node) => node.type === "file")) {
    const functionNodes = (fileToFunctionIds.get(fileNode.id) ?? [])
      .map((id) => nodesById.get(id))
      .filter((node): node is GraphNode => Boolean(node))
      .sort(sortByLineThenName);

    const functionDots: FunctionDot[] = functionNodes.map((fn) => ({
      nodeId: fn.id,
      name: fn.name,
      group: classifyFunctionName(fn.name),
      size: 1,
      lineRange: fn.lineRange,
      complexity: fn.complexity,
      isExported: /^[A-Z]/.test(fn.name),
      impactScore: 0,
    }));

    const summary: ViewFileSummary = {
      id: fileNode.id,
      name: fileNode.name,
      filePath: fileNode.filePath ?? fileNode.name,
      layerId: nodeToLayerId.get(fileNode.id) ?? null,
      node: fileNode,
      functionCount: functionDots.length,
      classCount: fileToClassIds.get(fileNode.id)?.length ?? 0,
      importOutCount: importOut.get(fileNode.id)?.size ?? 0,
      importInCount: importIn.get(fileNode.id)?.size ?? 0,
      functionDots,
      functionGroups: groupFunctionDots(functionDots),
    };
    filesById.set(fileNode.id, summary);
  }

  const layers: ViewLayerSummary[] = graph.layers.map((layer) => {
    const layerFiles = layer.nodeIds
      .map((id) => filesById.get(id))
      .filter((file): file is ViewFileSummary => Boolean(file));

    return {
      id: layer.id,
      name: layer.name,
      description: layer.description,
      fileCount: layerFiles.length,
      functionCount: layerFiles.reduce((sum, file) => sum + file.functionCount, 0),
      classCount: layerFiles.reduce((sum, file) => sum + file.classCount, 0),
      moduleCount: layer.nodeIds.filter((id) => nodesById.get(id)?.type === "module").length,
      topFiles: [...layerFiles].sort((a, b) => b.functionCount - a.functionCount).slice(0, 12),
    };
  });

  return {
    raw: graph,
    layers,
    layersById: new Map(layers.map((layer) => [layer.id, layer])),
    filesById,
    functionToFileId,
    fileToFunctionIds,
  };
}
