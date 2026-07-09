import type { GraphEdge, GraphNode, KnowledgeGraph } from "@understand-code/core/types";
import {
  coverageForNode,
  evidenceForPage,
  pagesForNode,
  type WikiEvidenceRecord,
  type WikiGapRecord,
  type WikiCoverageResult,
  type WikiIndex,
  type WikiPageRecord,
} from "../wiki/wikiIndex";

export type GraphExplorerMode = "global" | "semantic" | "architecture" | "call" | "coverage" | "evidence" | "focus";
export type SemanticNodeGroup = "capability" | "flow" | "module" | "file" | "symbol" | "document" | "data" | "infra" | "other";

export interface SemanticGraphDocMetadata {
  coverageStatus: WikiCoverageResult["status"];
  primaryPageId?: string;
  pageIds: string[];
  pages: WikiPageRecord[];
  evidenceIds: string[];
  evidence: WikiEvidenceRecord[];
  gapIds: string[];
  gaps: WikiGapRecord[];
}

export interface SemanticGraphNode {
  id: string;
  label: string;
  group: SemanticNodeGroup;
  category: SemanticNodeGroup;
  cluster: string;
  importance: number;
  rawType: GraphNode["type"];
  summary: string;
  filePath?: string;
  lineRange?: [number, number];
  coverage: WikiCoverageResult;
  wikiPageIds: string[];
  evidenceIds: string[];
  docs: SemanticGraphDocMetadata;
}

export interface SemanticGraphEdgeMember {
  id: string;
  source: string;
  target: string;
  type: GraphEdge["type"];
  direction: GraphEdge["direction"];
  weight: number;
  description?: string;
}

export interface SemanticGraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdge["type"];
  direction: GraphEdge["direction"];
  edgeTypes: GraphEdge["type"][];
  directions: GraphEdge["direction"][];
  weight: number;
  bundledCount: number;
  members: SemanticGraphEdgeMember[];
}

export interface SemanticGraph {
  nodes: SemanticGraphNode[];
  edges: SemanticGraphEdge[];
}

export interface BuildSemanticGraphInput {
  graph: KnowledgeGraph;
  wikiIndex?: WikiIndex;
  mode: GraphExplorerMode;
  focusNodeIds: string[];
}

const ARCHITECTURE_NODE_TYPES = new Set<GraphNode["type"]>([
  "config",
  "domain",
  "endpoint",
  "file",
  "flow",
  "module",
  "pipeline",
  "resource",
  "schema",
  "service",
  "table",
]);

const CALL_NODE_TYPES = new Set<GraphNode["type"]>(["file", "function", "class"]);

const GROUP_IMPORTANCE: Record<SemanticNodeGroup, number> = {
  capability: 1,
  flow: 0.9,
  module: 0.8,
  infra: 0.75,
  data: 0.7,
  file: 0.65,
  document: 0.6,
  symbol: 0.45,
  other: 0.4,
};

export function semanticGroupForNode(node: GraphNode): SemanticNodeGroup {
  if (node.type === "domain") return "capability";
  if (node.type === "flow" || node.type === "step") return "flow";
  if (node.type === "module" || node.type === "concept") return "module";
  if (node.type === "file" || node.type === "config") return "file";
  if (node.type === "function" || node.type === "class") return "symbol";
  if (node.type === "document" || node.type === "article" || node.type === "claim" || node.type === "source") return "document";
  if (node.type === "table" || node.type === "schema") return "data";
  if (node.type === "endpoint" || node.type === "pipeline" || node.type === "resource" || node.type === "service") {
    return "infra";
  }
  return "other";
}

function allowedNodeForMode(node: GraphNode, mode: GraphExplorerMode, wikiIndex: WikiIndex | undefined): boolean {
  if (mode === "semantic") return semanticGroupForNode(node) !== "symbol";
  if (mode === "architecture") return ARCHITECTURE_NODE_TYPES.has(node.type);
  if (mode === "call") return CALL_NODE_TYPES.has(node.type);
  if (mode === "coverage") return coverageForOptionalWiki(wikiIndex, node.id).status !== "unknown";
  if (mode === "evidence") {
    return evidenceIdsForNode(wikiIndex, node.id).length > 0
      || pagesForOptionalWiki(wikiIndex, node.id).length > 0
      || coverageForOptionalWiki(wikiIndex, node.id).status === "gap";
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
  return `${edge.source}->${edge.target}`;
}

function pushUnique<T>(values: T[], value: T): void {
  if (!values.includes(value)) values.push(value);
}

function pagesForOptionalWiki(wikiIndex: WikiIndex | undefined, nodeId: string): WikiPageRecord[] {
  return wikiIndex ? pagesForNode(wikiIndex, nodeId) : [];
}

function coverageForOptionalWiki(wikiIndex: WikiIndex | undefined, nodeId: string): WikiCoverageResult {
  return wikiIndex ? coverageForNode(wikiIndex, nodeId) : { status: "unknown", pages: [], gaps: [] };
}

function evidenceForNode(wikiIndex: WikiIndex | undefined, nodeId: string): WikiEvidenceRecord[] {
  if (!wikiIndex) return [];
  const evidence: WikiEvidenceRecord[] = [];
  const seen = new Set<string>();
  for (const page of pagesForOptionalWiki(wikiIndex, nodeId)) {
    for (const item of evidenceForPage(wikiIndex, page.id)) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      evidence.push(item);
    }
  }
  for (const item of wikiIndex.evidence) {
    if (!item.nodeIds.includes(nodeId) || seen.has(item.id)) continue;
    seen.add(item.id);
    evidence.push(item);
  }
  return evidence;
}

function evidenceIdsForNode(wikiIndex: WikiIndex | undefined, nodeId: string): string[] {
  return evidenceForNode(wikiIndex, nodeId).map((evidence) => evidence.id);
}

function clusterForNode(node: GraphNode, group: SemanticNodeGroup): string {
  return node.filePath?.split("/")[0] ?? group;
}

function docsForNode(
  coverage: WikiCoverageResult,
  pages: WikiPageRecord[],
  evidence: WikiEvidenceRecord[],
): SemanticGraphDocMetadata {
  const docs: SemanticGraphDocMetadata = {
    coverageStatus: coverage.status,
    pageIds: pages.map((page) => page.id),
    pages,
    evidenceIds: evidence.map((item) => item.id),
    evidence,
    gapIds: coverage.gaps.map((gap) => gap.id),
    gaps: coverage.gaps,
  };
  if (pages[0]) docs.primaryPageId = pages[0].id;
  return docs;
}

function edgeMember(edge: GraphEdge, index: number): SemanticGraphEdgeMember {
  const member: SemanticGraphEdgeMember = {
    id: `${edgeKey(edge)}:${edge.type}:${index}`,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    direction: edge.direction,
    weight: edge.weight,
  };
  if (edge.description) member.description = edge.description;
  return member;
}

export function buildSemanticGraphModel({
  graph,
  wikiIndex,
  mode,
  focusNodeIds,
}: BuildSemanticGraphInput): SemanticGraph {
  const includedByFocus = focusNeighborhood(graph, focusNodeIds);
  const focusedNodeIds = new Set(focusNodeIds);
  const sourceNodes = graph.nodes.filter(
    (node) => includedByFocus.has(node.id) && (focusedNodeIds.has(node.id) || allowedNodeForMode(node, mode, wikiIndex)),
  );
  const nodeIds = new Set(sourceNodes.map((node) => node.id));
  const nodes: SemanticGraphNode[] = sourceNodes.map((node) => {
    const group = semanticGroupForNode(node);
    const coverage = coverageForOptionalWiki(wikiIndex, node.id);
    const pages = pagesForOptionalWiki(wikiIndex, node.id);
    const evidence = evidenceForNode(wikiIndex, node.id);
    const docs = docsForNode(coverage, pages, evidence);

    return {
      id: node.id,
      label: node.name,
      group,
      category: group,
      cluster: clusterForNode(node, group),
      importance: GROUP_IMPORTANCE[group],
      rawType: node.type,
      summary: node.summary,
      filePath: node.filePath,
      lineRange: node.lineRange,
      coverage,
      wikiPageIds: docs.pageIds,
      evidenceIds: docs.evidenceIds,
      docs,
    };
  });

  const bundled = new Map<string, SemanticGraphEdge>();
  for (const [index, edge] of graph.edges.entries()) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    if (mode === "call" && edge.type !== "calls" && edge.type !== "contains") continue;
    if (mode === "architecture" && edge.type === "calls") continue;
    const key = edgeKey(edge);
    const member = edgeMember(edge, index);
    const current = bundled.get(key);
    if (current) {
      current.bundledCount += 1;
      current.weight = Math.max(current.weight, edge.weight);
      pushUnique(current.edgeTypes, edge.type);
      pushUnique(current.directions, edge.direction);
      current.members.push(member);
      continue;
    }
    bundled.set(key, {
      id: key,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      direction: edge.direction,
      edgeTypes: [edge.type],
      directions: [edge.direction],
      weight: edge.weight,
      bundledCount: 1,
      members: [member],
    });
  }

  return {
    nodes,
    edges: [...bundled.values()],
  };
}

export { buildSemanticGraphModel as buildSemanticGraph };
