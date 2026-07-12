import type { GraphEdge, GraphNode, KnowledgeGraph } from "@understand-code/core/types";
import type { WikiEvidenceV2, WikiPageV2 } from "@understand-code/core/knowledge-base";
import type { WikiRuntimeIndex } from "../wiki/wikiIndex";

export type GraphExplorerMode = "global" | "semantic" | "architecture" | "call" | "coverage" | "evidence" | "focus";
export type SemanticNodeGroup = "capability" | "flow" | "module" | "file" | "symbol" | "document" | "data" | "infra" | "other";

export interface DocumentationCounts {
  direct: number;
  context: number;
  none: number;
  problem: number;
  total: number;
}

export interface SemanticGraphDocMetadataV2 {
  relation: "direct" | "context" | "none";
  quality: "verified" | "generated" | "needs-review" | "failed";
  evidenceHealth: "source-linked" | "weak" | "unreadable" | "missing";
  generationStatus: "complete" | "partial" | "failed";
  referenceCoverage: "anchored" | "unanchored" | "not-applicable";
  primaryPageId?: string;
  anchor?: string;
  directPageIds: string[];
  contextPageIds: string[];
  directPages: WikiPageV2[];
  contextPages: WikiPageV2[];
  evidenceIds: string[];
  evidence: WikiEvidenceV2[];
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
  docs: SemanticGraphDocMetadataV2;
  documentationCounts?: DocumentationCounts;
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

function allowedNodeForMode(node: GraphNode, mode: GraphExplorerMode): boolean {
  if (mode === "semantic") return semanticGroupForNode(node) !== "symbol";
  if (mode === "architecture") return ARCHITECTURE_NODE_TYPES.has(node.type);
  if (mode === "call") return CALL_NODE_TYPES.has(node.type);
  if (mode === "coverage" || mode === "evidence") return true;
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

function clusterForNode(node: GraphNode, group: SemanticNodeGroup): string {
  return node.filePath?.split("/")[0] ?? group;
}

function docsForNode(
  index: WikiRuntimeIndex | undefined,
  nodeId: string,
): SemanticGraphDocMetadataV2 {
  const record = index?.nodeDocumentationById.get(nodeId);
  const directPages = record
    ? record.directPageIds
      .map((pageId) => index?.pagesById.get(pageId))
      .filter((page): page is WikiPageV2 => Boolean(page))
    : [];
  const contextPages = record
    ? record.contextPageIds
      .map((pageId) => index?.pagesById.get(pageId))
      .filter((page): page is WikiPageV2 => Boolean(page))
    : [];
  const allowedEvidenceIds = new Set(record?.evidenceIds ?? []);
  const evidence = [...(index?.evidenceByNodeId.get(nodeId) ?? [])]
    .filter((item): item is WikiEvidenceV2 =>
      item.nodeIds.includes(nodeId) && allowedEvidenceIds.has(item.id));
  return {
    relation: record?.relation ?? "none",
    quality: record?.quality ?? "needs-review",
    evidenceHealth: record?.evidenceHealth ?? "missing",
    generationStatus: record?.generationStatus ?? "partial",
    referenceCoverage: record?.referenceCoverage ?? "unanchored",
    ...(record?.primaryPageId ? { primaryPageId: record.primaryPageId } : {}),
    ...(record?.anchor ? { anchor: record.anchor } : {}),
    directPageIds: directPages.map((page) => page.id),
    contextPageIds: contextPages.map((page) => page.id),
    directPages,
    contextPages,
    evidenceIds: evidence.map((item) => item.id),
    evidence,
  };
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
    (node) => includedByFocus.has(node.id) && (focusedNodeIds.has(node.id) || allowedNodeForMode(node, mode)),
  );
  const nodeIds = new Set(sourceNodes.map((node) => node.id));
  const nodes: SemanticGraphNode[] = sourceNodes.map((node) => {
    const group = semanticGroupForNode(node);
    const docs = docsForNode(wikiIndex, node.id);

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
