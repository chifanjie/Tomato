import type { KnowledgeGraph } from "@understand-anything/core/types";
import type { ViewGraph } from "./types";

export type FileRelationshipSource = "calls" | "imports";

export interface FileRelationship {
  id: string;
  sourceFileId: string;
  targetFileId: string;
  source: FileRelationshipSource;
  count: number;
  functionEdgeIds: string[];
}

function relationshipKey(source: FileRelationshipSource, sourceFileId: string, targetFileId: string): string {
  return `${source}:${sourceFileId}->${targetFileId}`;
}

function pushRelationship(
  relationshipsByKey: Map<string, FileRelationship>,
  source: FileRelationshipSource,
  sourceFileId: string,
  targetFileId: string,
  functionEdgeId: string | null,
): void {
  if (sourceFileId === targetFileId) return;
  const key = relationshipKey(source, sourceFileId, targetFileId);
  const existing = relationshipsByKey.get(key);
  if (existing) {
    existing.count += 1;
    if (functionEdgeId) existing.functionEdgeIds.push(functionEdgeId);
    return;
  }
  relationshipsByKey.set(key, {
    id: key,
    sourceFileId,
    targetFileId,
    source,
    count: 1,
    functionEdgeIds: functionEdgeId ? [functionEdgeId] : [],
  });
}

function sortedRelationships(relationshipsByKey: Map<string, FileRelationship>): FileRelationship[] {
  return [...relationshipsByKey.values()].sort((a, b) => {
    if (a.sourceFileId !== b.sourceFileId) return a.sourceFileId.localeCompare(b.sourceFileId);
    if (a.targetFileId !== b.targetFileId) return a.targetFileId.localeCompare(b.targetFileId);
    return a.source.localeCompare(b.source);
  });
}

export function buildFileRelationships(
  graph: KnowledgeGraph,
  viewGraph: ViewGraph,
  layerFileIds: Set<string>,
): FileRelationship[] {
  const callRelationships = new Map<string, FileRelationship>();

  for (const edge of graph.edges) {
    if (edge.type !== "calls") continue;
    const sourceFileId = viewGraph.functionToFileId.get(edge.source);
    const targetFileId = viewGraph.functionToFileId.get(edge.target);
    if (!sourceFileId || !targetFileId) continue;
    if (!layerFileIds.has(sourceFileId) || !layerFileIds.has(targetFileId)) continue;
    pushRelationship(callRelationships, "calls", sourceFileId, targetFileId, `${edge.source}->${edge.target}`);
  }

  if (callRelationships.size > 0) {
    return sortedRelationships(callRelationships);
  }

  const importRelationships = new Map<string, FileRelationship>();
  for (const edge of graph.edges) {
    if (edge.type !== "imports") continue;
    if (!layerFileIds.has(edge.source) || !layerFileIds.has(edge.target)) continue;
    pushRelationship(importRelationships, "imports", edge.source, edge.target, null);
  }

  return sortedRelationships(importRelationships);
}
