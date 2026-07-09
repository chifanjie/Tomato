import type { GraphEdge, GraphNode, KnowledgeGraph } from "@understand-code/core/types";
import { coverageForNode, pagesForNode, type WikiCoverageResult, type WikiIndex } from "../wiki/wikiIndex";

export type GraphExplorerMode = "global" | "semantic" | "architecture" | "call" | "coverage" | "evidence";
export type SemanticNodeGroup = "capability" | "flow" | "module" | "file" | "symbol" | "document" | "data" | "other";

export interface SemanticGraphNode {
  id: string;
  label: string;
  group: SemanticNodeGroup;
  rawType: GraphNode["type"];
  summary: string;
  filePath?: string;
  lineRange?: [number, number];
  coverage: WikiCoverageResult;
  wikiPageIds: string[];
}

export interface SemanticGraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdge["type"];
  weight: number;
  bundledCount: number;
}

export interface SemanticGraph {
  nodes: SemanticGraphNode[];
  edges: SemanticGraphEdge[];
}

export interface BuildSemanticGraphInput {
  graph: KnowledgeGraph;
  wikiIndex: WikiIndex;
  mode: GraphExplorerMode;
  focusNodeIds: string[];
}

export function semanticGroupForNode(node: GraphNode): SemanticNodeGroup {
  if (node.type === "domain") return "capability";
  if (node.type === "flow" || node.type === "step") return "flow";
  if (node.type === "module" || node.type === "concept") return "module";
  if (node.type === "file" || node.type === "config") return "file";
  if (node.type === "function" || node.type === "class") return "symbol";
  if (node.type === "document" || node.type === "article" || node.type === "claim" || node.type === "source") return "document";
  if (node.type === "table" || node.type === "schema") return "data";
  return "other";
}

function allowedNodeForMode(node: GraphNode, mode: GraphExplorerMode, wikiIndex: WikiIndex): boolean {
  if (mode === "architecture") return ["domain", "flow", "module", "file", "config", "service", "table"].includes(node.type);
  if (mode === "call") return ["file", "function", "class"].includes(node.type);
  if (mode === "coverage") return coverageForNode(wikiIndex, node.id).status !== "unknown";
  if (mode === "evidence") {
    return pagesForNode(wikiIndex, node.id).length > 0 || coverageForNode(wikiIndex, node.id).status === "gap";
  }
  return true;
}

function focusNeighborhood(graph: KnowledgeGraph, focusNodeIds: string[]): Set<string> {
  const focus = new Set(focusNodeIds);
  if (focus.size === 0) return new Set(graph.nodes.map((node) => node.id));
  const included = new Set(focus);
  for (const edge of graph.edges) {
    if (focus.has(edge.source)) included.add(edge.target);
    if (focus.has(edge.target)) included.add(edge.source);
  }
  return included;
}

function edgeKey(edge: GraphEdge): string {
  return `${edge.source}->${edge.target}:${edge.type}`;
}

export function buildSemanticGraph({
  graph,
  wikiIndex,
  mode,
  focusNodeIds,
}: BuildSemanticGraphInput): SemanticGraph {
  const includedByFocus = focusNeighborhood(graph, focusNodeIds);
  const sourceNodes = graph.nodes.filter(
    (node) => includedByFocus.has(node.id) && allowedNodeForMode(node, mode, wikiIndex),
  );
  const nodeIds = new Set(sourceNodes.map((node) => node.id));
  const nodes: SemanticGraphNode[] = sourceNodes.map((node) => ({
    id: node.id,
    label: node.name,
    group: semanticGroupForNode(node),
    rawType: node.type,
    summary: node.summary,
    filePath: node.filePath,
    lineRange: node.lineRange,
    coverage: coverageForNode(wikiIndex, node.id),
    wikiPageIds: pagesForNode(wikiIndex, node.id).map((page) => page.id),
  }));

  const bundled = new Map<string, SemanticGraphEdge>();
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    if (mode === "call" && edge.type !== "calls" && edge.type !== "contains") continue;
    if (mode === "architecture" && edge.type === "calls") continue;
    const key = edgeKey(edge);
    const current = bundled.get(key);
    if (current) {
      current.bundledCount += 1;
      current.weight = Math.max(current.weight, edge.weight);
      continue;
    }
    bundled.set(key, {
      id: key,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      weight: edge.weight,
      bundledCount: 1,
    });
  }

  return {
    nodes,
    edges: [...bundled.values()],
  };
}
