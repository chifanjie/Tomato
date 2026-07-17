import type { SemanticGraph, SemanticGraphEdge } from "./semanticGraph";

export type FlowDirection = "forward" | "reverse" | "both";

export interface NodeSelectionPresentation {
  selected: boolean;
  neighbor: boolean;
  dimmed: boolean;
  opacity: number;
}

export interface EdgeSelectionPresentation {
  connected: boolean;
  animated: boolean;
  inlineDirection: boolean;
  opacity: number;
  strokeWidth: number;
  flowDirection: FlowDirection;
}

export interface SelectionPresentation {
  nodesById: ReadonlyMap<string, NodeSelectionPresentation>;
  edgesById: ReadonlyMap<string, EdgeSelectionPresentation>;
}

export type GraphCardKeyAction = "select" | "drill";

export function graphCardKeyAction(
  key: string,
  canDrillDown: boolean,
): GraphCardKeyAction | null {
  if (key === "Enter") return canDrillDown ? "drill" : "select";
  if (key === " " || key === "Spacebar") return "select";
  return null;
}

export function resolveFlowDirection(edge: SemanticGraphEdge): FlowDirection {
  const directions = new Set(edge.directions);
  if (
    directions.has("bidirectional")
    || (directions.has("forward") && directions.has("backward"))
  ) {
    return "both";
  }
  return directions.has("backward") ? "reverse" : "forward";
}

export function buildSelectionPresentation(
  graph: SemanticGraph,
  selectedId: string | null,
  reducedMotion: boolean,
): SelectionPresentation {
  const neighbors = new Set<string>();
  if (selectedId) {
    neighbors.add(selectedId);
    for (const edge of graph.edges) {
      if (edge.source === selectedId) neighbors.add(edge.target);
      if (edge.target === selectedId) neighbors.add(edge.source);
    }
  }

  return {
    nodesById: new Map(graph.nodes.map((node) => {
      const selected = node.id === selectedId;
      const neighbor = Boolean(selectedId) && !selected && neighbors.has(node.id);
      const dimmed = Boolean(selectedId) && !neighbors.has(node.id);
      return [node.id, {
        selected,
        neighbor,
        dimmed,
        opacity: dimmed ? 0.64 : 1,
      }];
    })),
    edgesById: new Map(graph.edges.map((edge) => {
      const connected = Boolean(selectedId)
        && (edge.source === selectedId || edge.target === selectedId);
      const baseWidth = Math.min(1.25 + Math.log2(edge.bundledCount + 1) * 0.55, 4);
      return [edge.id, {
        connected,
        animated: connected && !reducedMotion,
        inlineDirection: connected && reducedMotion,
        opacity: selectedId ? (connected ? 0.96 : 0.1) : 0.62,
        strokeWidth: selectedId ? (connected ? 2.6 : 1) : baseWidth,
        flowDirection: resolveFlowDirection(edge),
      }];
    })),
  };
}
