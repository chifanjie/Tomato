import type { KnowledgeGraph } from "@understand-code/core/types";
import type { SearchResult } from "@understand-code/core/search";
import type { ViewFileSummary, ViewGraph } from "./types";

export interface ReadableSearchMatches {
  matchedFileIds: Set<string>;
  fileMatchCounts: Map<string, number>;
  layerMatchCounts: Map<string, number>;
}

function byFunctionCountThenPath(a: ViewFileSummary, b: ViewFileSummary): number {
  if (b.functionCount !== a.functionCount) return b.functionCount - a.functionCount;
  return a.filePath.localeCompare(b.filePath);
}

export function getFilesForLayer(viewGraph: ViewGraph, layerId: string | null): ViewFileSummary[] {
  return [...viewGraph.filesById.values()]
    .filter((file) => file.layerId === layerId)
    .sort(byFunctionCountThenPath);
}

export function getAllFiles(viewGraph: ViewGraph): ViewFileSummary[] {
  return [...viewGraph.filesById.values()].sort(byFunctionCountThenPath);
}

export function findParentFileId(
  graph: KnowledgeGraph,
  viewGraph: ViewGraph | null,
  nodeId: string,
): string | null {
  if (viewGraph?.filesById.has(nodeId)) return nodeId;

  const functionParent = viewGraph?.functionToFileId.get(nodeId);
  if (functionParent) return functionParent;

  const contains = graph.edges.find((edge) => edge.type === "contains" && edge.target === nodeId);
  return contains?.source ?? null;
}

export function buildReadableSearchMatches(
  graph: KnowledgeGraph | null,
  viewGraph: ViewGraph | null,
  searchResults: SearchResult[],
): ReadableSearchMatches {
  const matchedFileIds = new Set<string>();
  const fileMatchCounts = new Map<string, number>();
  const layerMatchCounts = new Map<string, number>();

  if (!graph || !viewGraph) {
    return { matchedFileIds, fileMatchCounts, layerMatchCounts };
  }

  for (const result of searchResults) {
    const fileId = findParentFileId(graph, viewGraph, result.nodeId);
    if (!fileId) continue;
    const file = viewGraph.filesById.get(fileId);
    if (!file) continue;

    matchedFileIds.add(fileId);
    fileMatchCounts.set(fileId, (fileMatchCounts.get(fileId) ?? 0) + 1);
    if (file.layerId) {
      layerMatchCounts.set(file.layerId, (layerMatchCounts.get(file.layerId) ?? 0) + 1);
    }
  }

  return { matchedFileIds, fileMatchCounts, layerMatchCounts };
}
