import type { GraphNode, KnowledgeGraph } from "@understand-code/core/types";
import {
  buildSemanticGraph,
  type GraphExplorerMode,
  type SemanticGraph,
  type SemanticGraphNode,
} from "../../graphExplorer/semanticGraph";
import {
  coverageForNode,
  pagesForNode,
  type WikiCoverageResult,
  type WikiIndex,
  type WikiPageRecord,
} from "../../wiki/wikiIndex";

export interface GraphExplorerView {
  semanticGraph: SemanticGraph;
  selectedNode: GraphNode | null;
  selectedNodeVisible: boolean;
  hiddenSelectedNode: GraphNode | null;
  selectedSemanticNode: SemanticGraphNode | null;
  selectedCoverage: WikiCoverageResult | null;
  selectedPages: WikiPageRecord[];
  canOpenWiki: boolean;
}

export interface BuildGraphExplorerViewInput {
  graph: KnowledgeGraph;
  wikiIndex?: WikiIndex;
  mode: GraphExplorerMode;
  focusNodeIds: string[];
  selectedNodeId: string | null;
}

const UNKNOWN_COVERAGE: WikiCoverageResult = {
  status: "unknown",
  pages: [],
  gaps: [],
};

export function buildGraphExplorerView({
  graph,
  wikiIndex,
  mode,
  focusNodeIds,
  selectedNodeId,
}: BuildGraphExplorerViewInput): GraphExplorerView {
  const semanticGraph = buildSemanticGraph({ graph, wikiIndex, mode, focusNodeIds });
  const selectedGraphNode = selectedNodeId
    ? graph.nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;
  const selectedSemanticNode = selectedNodeId
    ? semanticGraph.nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;
  const selectedNode = selectedGraphNode && selectedSemanticNode ? selectedGraphNode : null;
  const hiddenSelectedNode = selectedGraphNode && !selectedSemanticNode ? selectedGraphNode : null;
  const selectedPages = selectedGraphNode && wikiIndex ? pagesForNode(wikiIndex, selectedGraphNode.id) : [];
  const selectedCoverage = selectedNode
    ? wikiIndex
      ? coverageForNode(wikiIndex, selectedNode.id)
      : UNKNOWN_COVERAGE
    : null;

  return {
    semanticGraph,
    selectedNode,
    selectedNodeVisible: Boolean(selectedNode),
    hiddenSelectedNode,
    selectedSemanticNode,
    selectedCoverage,
    selectedPages,
    canOpenWiki: selectedPages.length > 0,
  };
}
