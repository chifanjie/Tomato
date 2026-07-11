import type { WikiPageV2 } from "@understand-code/core/knowledge-base";
import type { GraphNode, KnowledgeGraph } from "@understand-code/core/types";
import {
  buildSemanticGraph,
  coverageForOptionalWiki,
  pagesForOptionalWiki,
  type GraphDocumentationCoverage,
  type GraphExplorerMode,
  type SemanticGraph,
  type SemanticGraphNode,
} from "../../graphExplorer/semanticGraph";
import type { WikiRuntimeIndex } from "../../wiki/wikiIndex";

export interface GraphExplorerView {
  semanticGraph: SemanticGraph;
  selectedNode: GraphNode | null;
  selectedNodeVisible: boolean;
  hiddenSelectedNode: GraphNode | null;
  selectedSemanticNode: SemanticGraphNode | null;
  selectedCoverage: GraphDocumentationCoverage | null;
  selectedPages: WikiPageV2[];
  canOpenWiki: boolean;
}

export interface BuildGraphExplorerViewInput {
  graph: KnowledgeGraph;
  wikiIndex?: WikiRuntimeIndex;
  mode: GraphExplorerMode;
  focusNodeIds: string[];
  selectedNodeId: string | null;
}

const UNKNOWN_COVERAGE: GraphDocumentationCoverage = {
  status: "unknown",
  pages: [],
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
  const selectedPages = selectedGraphNode
    ? pagesForOptionalWiki(wikiIndex, selectedGraphNode.id)
    : [];
  const selectedCoverage = selectedNode
    ? wikiIndex
      ? coverageForOptionalWiki(wikiIndex, selectedNode.id)
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
