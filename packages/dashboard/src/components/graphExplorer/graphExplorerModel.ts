import type { WikiEvidenceV2, WikiPageV2 } from "@understand-code/core/knowledge-base";
import type { GraphNode, KnowledgeGraph } from "@understand-code/core/types";
import {
  buildHierarchicalSemanticGraph,
  hasDocumentationProblem,
  normalizeGraphExplorerMode,
  type GraphExplorerDisplayMode,
  type GraphExplorerNavigation,
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
  semanticGraph: HierarchicalSemanticGraph;
  selection: GraphSelectionDetails | null;
  hiddenSelectedNode: GraphNode | null;
}

export interface BuildGraphExplorerViewInput {
  graph: KnowledgeGraph;
  wikiIndex?: WikiRuntimeIndex;
  mode: GraphExplorerMode;
  focusNodeIds: string[];
  selectedNodeId: string | null;
  navigation: GraphExplorerNavigation;
}

export interface SelectionDetailsInput {
  graph: KnowledgeGraph;
  semanticGraph: SemanticGraph;
  selectedObjectId: string | null;
}

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
      drillTarget: { kind: "file"; scopeId: string; fileId: string } | null;
    })
  | (SelectionDocumentation & {
      kind: "aggregate" | "boundary";
      id: string;
      node: HierarchicalSemanticGraphNode;
      responsibility: string;
      documentationCounts: DocumentationCounts;
      drillTarget: { kind: "scope"; scopeId: string } | null;
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
      drillTarget: semantic.canDrillDown && semantic.scopeId
        ? { kind: "file", scopeId: semantic.scopeId, fileId: semantic.id }
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
      ? { kind: "scope", scopeId: semantic.scopeId }
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
  wikiIndex,
  mode,
  focusNodeIds,
  selectedNodeId,
  navigation,
}: BuildGraphExplorerViewInput): GraphExplorerView {
  const builtGraph = buildHierarchicalSemanticGraph({
    graph,
    wikiIndex,
    mode,
    focusNodeIds,
    selectedNodeId,
    navigation,
  });
  const semanticGraph: HierarchicalSemanticGraph = {
    ...builtGraph,
    presentation: { ...builtGraph.presentation, notice: null },
  };
  const selection = buildGraphSelectionDetails({
    graph,
    semanticGraph,
    selectedObjectId: selectedNodeId,
  });
  const selectedRawNode = selectedNodeId
    ? graph.nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;

  return {
    semanticGraph,
    selection,
    hiddenSelectedNode: selectedRawNode && !selection ? selectedRawNode : null,
  };
}
