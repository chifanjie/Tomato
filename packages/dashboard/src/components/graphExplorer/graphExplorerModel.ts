import type { WikiEvidenceV2, WikiPageV2 } from "@understand-code/core/knowledge-base";
import type { GraphNode, KnowledgeGraph } from "@understand-code/core/types";
import {
  buildHierarchySelectionExpansion,
  buildHierarchicalSemanticGraph,
  createHierarchicalGraphProjectionContext,
  hasDocumentationProblem,
  mergeHierarchySelectionExpansion,
  normalizeGraphExplorerMode,
  type GraphExplorerDisplayMode,
  type GraphExplorerNavigation,
  type GraphHierarchyIndex,
  type HierarchicalGraphSelectionExpansion,
  type HierarchicalGraphProjectionContext,
  type HierarchicalSemanticGraph,
  type HierarchicalSemanticGraphNode,
} from "../../graphExplorer/hierarchicalGraph";
import type {
  DocumentationCounts,
  GraphExplorerMode,
  SemanticGraph,
  SemanticGraphDocMetadataV2,
  SemanticGraphEdge,
  SemanticGraphNode,
} from "../../graphExplorer/semanticGraph";
import type { WikiRuntimeIndex } from "../../wiki/wikiIndex";

export interface GraphExplorerView {
  baseGraph: HierarchicalSemanticGraph;
  selectionExpansion: HierarchicalGraphSelectionExpansion;
  semanticGraph: HierarchicalSemanticGraph;
  selection: GraphSelectionDetails | null;
  hiddenSelectedNode: GraphNode | null;
}

export interface BuildGraphExplorerViewInput {
  graph: KnowledgeGraph;
  hierarchyIndex: GraphHierarchyIndex;
  wikiIndex?: WikiRuntimeIndex;
  projectionContext?: HierarchicalGraphProjectionContext;
  mode: GraphExplorerMode;
  selectedNodeId: string | null;
  /** True only when the active surface selected this id from the currently visible graph. */
  selectedNodeWasVisible?: boolean;
  navigation: GraphExplorerNavigation;
  materializedNodeId: string | null;
}

export interface SelectionDetailsInput {
  graph: KnowledgeGraph;
  semanticGraph: SemanticGraph;
  selectedObjectId: string | null;
}

export type GraphDrillTarget =
  | { kind: "scope"; scopeId: string }
  | { kind: "cluster"; scopeId: string; clusterId: string }
  | { kind: "file"; scopeId: string; clusterId: string; fileId: string };

interface SelectionDocumentation {
  upstream: SemanticGraphNode[];
  downstream: SemanticGraphNode[];
  directPages: WikiPageV2[];
  contextPages: WikiPageV2[];
  evidence: WikiEvidenceV2[];
  primaryDirectPageId: string | null;
}

export type GraphSelectionDetails =
  | (SelectionDocumentation & {
      kind: "raw";
      id: string;
      node: GraphNode;
      semantic: HierarchicalSemanticGraphNode;
      drillTarget: GraphDrillTarget | null;
    })
  | (SelectionDocumentation & {
      kind: "aggregate" | "boundary";
      id: string;
      node: HierarchicalSemanticGraphNode;
      responsibility: string;
      documentationCounts: DocumentationCounts;
      drillTarget: GraphDrillTarget | null;
    });

export interface GraphModeOption {
  id: GraphExplorerDisplayMode;
  label: string;
  relationshipSource: "calls" | "imports" | null;
}

const EMPTY_DOCUMENTATION_COUNTS: DocumentationCounts = {
  direct: 0,
  context: 0,
  none: 0,
  problem: 0,
  total: 0,
};

const RELATION_LABELS: Record<SemanticGraphDocMetadataV2["relation"], string> = {
  direct: "有专门正文",
  context: "仅相关资料",
  none: "待补正文",
};

export function graphLayoutRevision(graph: KnowledgeGraph): string {
  const compareText = (left: string, right: string) =>
    left < right ? -1 : left > right ? 1 : 0;
  return JSON.stringify({
    format: 2,
    graphVersion: graph.version,
    graphKind: graph.kind ?? "codebase",
    nodes: graph.nodes
      .map((node) => [node.id, node.type, node.filePath ?? ""])
      .sort((left, right) => compareText(left[0]!, right[0]!)),
    edges: graph.edges
      .map((edge) => [edge.source, edge.target, edge.type, edge.direction, edge.weight])
      .sort((left, right) => compareText(left.join("\u0000"), right.join("\u0000"))),
    layers: graph.layers
      .map((layer) => [layer.id, [...layer.nodeIds].sort().join("\u0000")]),
  });
}

export function directionalEndpointPairs(
  edge: Pick<SemanticGraphEdge, "source" | "target" | "directions">,
): Array<{ source: string; target: string }> {
  const directions = new Set(edge.directions);
  if (directions.has("bidirectional") || (directions.has("forward") && directions.has("backward"))) {
    return [
      { source: edge.source, target: edge.target },
      { source: edge.target, target: edge.source },
    ];
  }
  return directions.has("backward")
    ? [{ source: edge.target, target: edge.source }]
    : [{ source: edge.source, target: edge.target }];
}

function adjacentNodes(
  graph: SemanticGraph,
  id: string,
  direction: "incoming" | "outgoing",
): SemanticGraphNode[] {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const result: SemanticGraphNode[] = [];
  for (const edge of graph.edges) {
    for (const endpoints of directionalEndpointPairs(edge)) {
      const relatedId = direction === "incoming" && endpoints.target === id
        ? endpoints.source
        : direction === "outgoing" && endpoints.source === id
          ? endpoints.target
          : null;
      const node = relatedId ? nodesById.get(relatedId) : undefined;
      if (!node || seen.has(node.id)) continue;
      seen.add(node.id);
      result.push(node);
    }
  }
  return result;
}

export function buildGraphSelectionDetails({
  graph,
  semanticGraph,
  selectedObjectId,
}: SelectionDetailsInput): GraphSelectionDetails | null {
  if (!selectedObjectId) return null;
  const semantic = semanticGraph.nodes.find((node) => node.id === selectedObjectId) as
    | HierarchicalSemanticGraphNode
    | undefined;
  if (!semantic) return null;

  const raw = graph.nodes.find((node) => node.id === semantic.id);
  const upstream = adjacentNodes(semanticGraph, semantic.id, "incoming");
  const downstream = adjacentNodes(semanticGraph, semantic.id, "outgoing");
  const primaryDirectPageId = semantic.docs.primaryPageId
    && semantic.docs.directPageIds.includes(semantic.docs.primaryPageId)
    ? semantic.docs.primaryPageId
    : semantic.docs.directPageIds[0] ?? null;
  const documentation = {
    upstream,
    downstream,
    directPages: semantic.docs.directPages,
    contextPages: semantic.docs.contextPages,
    evidence: semantic.docs.evidence,
    primaryDirectPageId,
  };

  if (raw) {
    return {
      kind: "raw",
      id: raw.id,
      node: raw,
      semantic,
      ...documentation,
      drillTarget: semantic.canDrillDown && semantic.scopeId && semantic.clusterId
        ? { kind: "file", scopeId: semantic.scopeId, clusterId: semantic.clusterId, fileId: semantic.id }
        : null,
    };
  }

  return {
    kind: semantic.kind === "boundary" ? "boundary" : "aggregate",
    id: semantic.id,
    node: semantic,
    responsibility: semantic.summary,
    documentationCounts: semantic.documentationCounts ?? EMPTY_DOCUMENTATION_COUNTS,
    ...documentation,
    drillTarget: semantic.canDrillDown && semantic.scopeId
      ? semantic.kind === "cluster" && semantic.clusterId
        ? { kind: "cluster", scopeId: semantic.scopeId, clusterId: semantic.clusterId }
        : { kind: "scope", scopeId: semantic.scopeId }
      : null,
  };
}

export function availableGraphModes(
  graph: KnowledgeGraph,
  wikiIndex: WikiRuntimeIndex,
): GraphModeOption[] {
  const options: GraphModeOption[] = [
    { id: "architecture", label: "架构总览", relationshipSource: null },
  ];
  if (graph.edges.some((edge) => edge.type === "calls")) {
    options.push({ id: "call", label: "调用关系", relationshipSource: "calls" });
  } else if (graph.edges.some((edge) => edge.type === "imports")) {
    options.push({ id: "call", label: "文件依赖", relationshipSource: "imports" });
  }
  if (graph.nodes.some((node) => wikiIndex.nodeDocumentationById.has(node.id))) {
    options.push({ id: "coverage", label: "文档覆盖", relationshipSource: null });
  }
  return options;
}

export function normalizeGraphModeForOptions(
  storedMode: GraphExplorerMode,
  options: readonly GraphModeOption[],
): GraphExplorerDisplayMode {
  const normalized = normalizeGraphExplorerMode(storedMode);
  return options.some((option) => option.id === normalized) ? normalized : "architecture";
}

export function coverageBadgeForNode(node: SemanticGraphNode): {
  label: string;
  relation: SemanticGraphDocMetadataV2["relation"];
  problem: boolean;
} {
  return {
    label: node.documentationCounts
      ? `${node.documentationCounts.direct}/${node.documentationCounts.total} 有正文`
      : RELATION_LABELS[node.docs.relation],
    relation: node.docs.relation,
    problem: node.documentationCounts
      ? node.documentationCounts.problem > 0
      : hasDocumentationProblem(node.docs),
  };
}

export function buildGraphExplorerView({
  graph,
  hierarchyIndex,
  wikiIndex,
  projectionContext: suppliedProjectionContext,
  mode,
  selectedNodeId,
  selectedNodeWasVisible = false,
  navigation,
  materializedNodeId,
}: BuildGraphExplorerViewInput): GraphExplorerView {
  const projectionContext = suppliedProjectionContext
    ?? createHierarchicalGraphProjectionContext({ graph, wikiIndex });
  const baseGraph = buildHierarchicalSemanticGraph({
    graph,
    hierarchyIndex,
    wikiIndex,
    projectionContext,
    mode,
    navigation,
    materializedNodeId,
  });
  const selectionExpansion = buildHierarchySelectionExpansion({
    graph,
    hierarchyIndex,
    baseGraph,
    wikiIndex,
    projectionContext,
    mode,
    selectedNodeId,
    selectedNodeWasVisible,
  });
  const semanticGraph = mergeHierarchySelectionExpansion(baseGraph, selectionExpansion);
  const selection = buildGraphSelectionDetails({
    graph,
    semanticGraph,
    selectedObjectId: selectedNodeId,
  });
  const selectedRawNode = selectedNodeId
    ? graph.nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;

  return {
    baseGraph,
    selectionExpansion,
    semanticGraph,
    selection,
    hiddenSelectedNode: selectedRawNode && !selection ? selectedRawNode : null,
  };
}
