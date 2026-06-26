import type { KnowledgeGraph } from "@understand-anything/core/types";
import type { ViewGraph } from "./types";

export type CallRelationshipSource = "calls" | "imports";

export interface FileCallEdge {
  sourceFileId: string;
  targetFileId: string;
  source: CallRelationshipSource;
  count: number;
  functionEdgeIds: string[];
}

export interface FunctionCallEdge {
  sourceFunctionId: string;
  targetFunctionId: string;
  sourceFileId: string | null;
  targetFileId: string | null;
  source: "calls";
}

export interface FunctionCallNeighborhood {
  selectedFunctionId: string;
  incoming: FunctionCallEdge[];
  outgoing: FunctionCallEdge[];
  intraFile: FunctionCallEdge[];
  externalFileIds: string[];
}

interface FileCallEdgeOptions {
  fileIds?: Iterable<string>;
}

function inScope(fileId: string, allowedFileIds: Set<string> | null): boolean {
  return allowedFileIds === null || allowedFileIds.has(fileId);
}

function sortFileEdges(a: FileCallEdge, b: FileCallEdge): number {
  const source = a.sourceFileId.localeCompare(b.sourceFileId);
  if (source !== 0) return source;
  const target = a.targetFileId.localeCompare(b.targetFileId);
  if (target !== 0) return target;
  return a.source.localeCompare(b.source);
}

function sortFunctionEdges(a: FunctionCallEdge, b: FunctionCallEdge): number {
  const source = a.sourceFunctionId.localeCompare(b.sourceFunctionId);
  if (source !== 0) return source;
  return a.targetFunctionId.localeCompare(b.targetFunctionId);
}

function addAggregatedFileEdge(
  edgesByKey: Map<string, FileCallEdge>,
  sourceFileId: string,
  targetFileId: string,
  source: CallRelationshipSource,
  functionEdgeId: string | null,
): void {
  const key = `${sourceFileId}|${targetFileId}|${source}`;
  const current = edgesByKey.get(key);
  if (current) {
    current.count += 1;
    if (functionEdgeId) current.functionEdgeIds.push(functionEdgeId);
    return;
  }

  edgesByKey.set(key, {
    sourceFileId,
    targetFileId,
    source,
    count: 1,
    functionEdgeIds: functionEdgeId ? [functionEdgeId] : [],
  });
}

export function buildFileCallEdges(
  graph: KnowledgeGraph,
  viewGraph: ViewGraph,
  options: FileCallEdgeOptions = {},
): FileCallEdge[] {
  const allowedFileIds = options.fileIds ? new Set(options.fileIds) : null;
  const callEdges = new Map<string, FileCallEdge>();

  graph.edges.forEach((edge, index) => {
    if (edge.type !== "calls") return;
    const sourceFileId = viewGraph.functionToFileId.get(edge.source);
    const targetFileId = viewGraph.functionToFileId.get(edge.target);
    if (!sourceFileId || !targetFileId || sourceFileId === targetFileId) return;
    if (!inScope(sourceFileId, allowedFileIds) || !inScope(targetFileId, allowedFileIds)) return;

    addAggregatedFileEdge(
      callEdges,
      sourceFileId,
      targetFileId,
      "calls",
      `${edge.source}->${edge.target}:${index}`,
    );
  });

  if (callEdges.size > 0) return [...callEdges.values()].sort(sortFileEdges);

  const importEdges = new Map<string, FileCallEdge>();
  for (const edge of graph.edges) {
    if (edge.type !== "imports") continue;
    if (!viewGraph.filesById.has(edge.source) || !viewGraph.filesById.has(edge.target)) continue;
    if (edge.source === edge.target) continue;
    if (!inScope(edge.source, allowedFileIds) || !inScope(edge.target, allowedFileIds)) continue;

    addAggregatedFileEdge(importEdges, edge.source, edge.target, "imports", null);
  }

  return [...importEdges.values()].sort(sortFileEdges);
}

export function getFocusedFileCallEdges(
  edges: FileCallEdge[],
  focusedFileId: string | null,
): FileCallEdge[] {
  if (!focusedFileId) return [];
  return edges
    .filter((edge) => edge.sourceFileId === focusedFileId || edge.targetFileId === focusedFileId)
    .sort(sortFileEdges);
}

function toFunctionCallEdge(
  viewGraph: ViewGraph,
  sourceFunctionId: string,
  targetFunctionId: string,
): FunctionCallEdge {
  return {
    sourceFunctionId,
    targetFunctionId,
    sourceFileId: viewGraph.functionToFileId.get(sourceFunctionId) ?? null,
    targetFileId: viewGraph.functionToFileId.get(targetFunctionId) ?? null,
    source: "calls",
  };
}

export function buildFunctionCallEdges(
  graph: KnowledgeGraph,
  viewGraph: ViewGraph,
  fileId: string,
): FunctionCallEdge[] {
  return graph.edges
    .filter((edge) => edge.type === "calls")
    .map((edge) => toFunctionCallEdge(viewGraph, edge.source, edge.target))
    .filter((edge) => edge.sourceFileId === fileId || edge.targetFileId === fileId)
    .sort(sortFunctionEdges);
}

export function buildFunctionCallNeighborhood(
  graph: KnowledgeGraph,
  viewGraph: ViewGraph,
  functionId: string,
): FunctionCallNeighborhood {
  const selectedFileId = viewGraph.functionToFileId.get(functionId) ?? null;
  const directEdges = graph.edges
    .filter((edge) => edge.type === "calls" && (edge.source === functionId || edge.target === functionId))
    .map((edge) => toFunctionCallEdge(viewGraph, edge.source, edge.target));
  const incoming = directEdges
    .filter((edge) => edge.targetFunctionId === functionId)
    .sort(sortFunctionEdges);
  const outgoing = directEdges
    .filter((edge) => edge.sourceFunctionId === functionId)
    .sort(sortFunctionEdges);
  const intraFile = directEdges
    .filter((edge) => (
      selectedFileId !== null
      && edge.sourceFileId === selectedFileId
      && edge.targetFileId === selectedFileId
    ))
    .sort(sortFunctionEdges);
  const externalFileIds = [...new Set(
    directEdges
      .flatMap((edge) => [edge.sourceFileId, edge.targetFileId])
      .filter((fileId): fileId is string => Boolean(fileId) && fileId !== selectedFileId),
  )].sort((a, b) => a.localeCompare(b));

  return {
    selectedFunctionId: functionId,
    incoming,
    outgoing,
    intraFile,
    externalFileIds,
  };
}
