import type { GraphEdge, GraphNode, KnowledgeGraph } from "@understand-code/core/types";
import type { GenerationStatus, WikiEvidenceV2, WikiPageV2 } from "@understand-code/core/knowledge-base";
import type { WikiRuntimeIndex } from "../wiki/wikiIndex";

export type GraphExplorerMode = "global" | "semantic" | "architecture" | "call" | "coverage" | "evidence" | "focus";
export type SemanticNodeGroup = "capability" | "flow" | "module" | "file" | "symbol" | "document" | "data" | "infra" | "other";
export type GraphDocumentationStatus = GenerationStatus | "unknown";

export interface GraphDocumentationCoverage {
  status: GraphDocumentationStatus;
  pages: WikiPageV2[];
}

export interface SemanticGraphDocMetadata {
  coverageStatus: GraphDocumentationStatus;
  primaryPageId?: string;
  pageIds: string[];
  pages: WikiPageV2[];
  directPageIds: string[];
  directPages: WikiPageV2[];
  contextPageIds: string[];
  contextPages: WikiPageV2[];
  evidenceIds: string[];
  evidence: WikiEvidenceV2[];
  failureReasons: string[];
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
  coverage: GraphDocumentationCoverage;
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
  wikiIndex?: WikiRuntimeIndex;
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
  if (
    node.type === "document"
    || node.type === "article"
    || node.type === "entity"
    || node.type === "topic"
    || node.type === "claim"
    || node.type === "source"
  ) {
    return "document";
  }
  if (node.type === "table" || node.type === "schema") return "data";
  if (node.type === "endpoint" || node.type === "pipeline" || node.type === "resource" || node.type === "service") {
    return "infra";
  }
  return "other";
}

function allowedNodeForMode(node: GraphNode, mode: GraphExplorerMode, wikiIndex: WikiRuntimeIndex | undefined): boolean {
  if (mode === "semantic") return semanticGroupForNode(node) !== "symbol";
  if (mode === "architecture") return ARCHITECTURE_NODE_TYPES.has(node.type);
  if (mode === "call") return CALL_NODE_TYPES.has(node.type);
  if (mode === "coverage") return coverageForOptionalWiki(wikiIndex, node.id).status !== "unknown";
  if (mode === "evidence") {
    return evidenceIdsForNode(wikiIndex, node.id).length > 0
      || pagesForOptionalWiki(wikiIndex, node.id).length > 0
      || coverageForOptionalWiki(wikiIndex, node.id).status === "failed";
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

export function pagesForOptionalWiki(wikiIndex: WikiRuntimeIndex | undefined, nodeId: string): WikiPageV2[] {
  if (!wikiIndex) return [];
  const directPages = wikiIndex.directPagesByNodeId.get(nodeId);
  return directPages && directPages.length > 0
    ? [...directPages]
    : [...(wikiIndex.contextPagesByNodeId.get(nodeId) ?? [])];
}

export function coverageForOptionalWiki(
  wikiIndex: WikiRuntimeIndex | undefined,
  nodeId: string,
): GraphDocumentationCoverage {
  return {
    status: wikiIndex?.nodeDocumentationById.get(nodeId)?.generationStatus ?? "unknown",
    pages: pagesForOptionalWiki(wikiIndex, nodeId),
  };
}

function evidenceForNode(wikiIndex: WikiRuntimeIndex | undefined, nodeId: string): WikiEvidenceV2[] {
  return [...(wikiIndex?.evidenceByNodeId.get(nodeId) ?? [])];
}

function evidenceIdsForNode(wikiIndex: WikiRuntimeIndex | undefined, nodeId: string): string[] {
  return evidenceForNode(wikiIndex, nodeId).map((evidence) => evidence.id);
}

function clusterForNode(node: GraphNode, group: SemanticNodeGroup): string {
  return node.filePath?.split("/")[0] ?? group;
}

function failureReasonsForNode(wikiIndex: WikiRuntimeIndex | undefined, nodeId: string): string[] {
  const documentation = wikiIndex?.nodeDocumentationById.get(nodeId);
  if (!documentation) return [];

  const reasons: string[] = [];
  if (documentation.generationStatus === "partial") reasons.push("节点文档仅部分生成");
  if (documentation.generationStatus === "failed") reasons.push("节点文档生成失败");
  if (documentation.evidenceHealth === "weak") reasons.push("节点源码证据关联较弱");
  if (documentation.evidenceHealth === "unreadable") reasons.push("节点源码证据无法读取");
  if (documentation.evidenceHealth === "missing") reasons.push("节点缺少源码证据");
  if (documentation.referenceCoverage === "unanchored") reasons.push("节点参考文档尚未锚定");
  return reasons;
}

function docsForNode(
  wikiIndex: WikiRuntimeIndex | undefined,
  nodeId: string,
  coverage: GraphDocumentationCoverage,
  pages: WikiPageV2[],
  evidence: WikiEvidenceV2[],
): SemanticGraphDocMetadata {
  const directPages = [...(wikiIndex?.directPagesByNodeId.get(nodeId) ?? [])];
  const contextPages = [...(wikiIndex?.contextPagesByNodeId.get(nodeId) ?? [])];
  const docs: SemanticGraphDocMetadata = {
    coverageStatus: coverage.status,
    pageIds: pages.map((page) => page.id),
    pages,
    directPageIds: directPages.map((page) => page.id),
    directPages,
    contextPageIds: contextPages.map((page) => page.id),
    contextPages,
    evidenceIds: evidence.map((item) => item.id),
    evidence,
    failureReasons: failureReasonsForNode(wikiIndex, nodeId),
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
  const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
  const validFocusNodeIds = focusNodeIds.filter((nodeId) => graphNodeIds.has(nodeId));
  const includedByFocus = focusNeighborhood(graph, validFocusNodeIds);
  const focusedNodeIds = new Set(validFocusNodeIds);
  const sourceNodes = graph.nodes.filter(
    (node) => includedByFocus.has(node.id) && (focusedNodeIds.has(node.id) || allowedNodeForMode(node, mode, wikiIndex)),
  );
  const nodeIds = new Set(sourceNodes.map((node) => node.id));
  const nodes: SemanticGraphNode[] = sourceNodes.map((node) => {
    const group = semanticGroupForNode(node);
    const coverage = coverageForOptionalWiki(wikiIndex, node.id);
    const pages = pagesForOptionalWiki(wikiIndex, node.id);
    const evidence = evidenceForNode(wikiIndex, node.id);
    const docs = docsForNode(wikiIndex, node.id, coverage, pages, evidence);

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
