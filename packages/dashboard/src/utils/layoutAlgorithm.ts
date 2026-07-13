import dagre from "@dagrejs/dagre";

export interface LayoutMessage {
  requestId: number;
  nodes: Array<{ id: string; width: number; height: number }>;
  edges: Array<{ source: string; target: string }>;
  direction: "TB" | "LR";
}

export interface LayoutResult {
  requestId: number;
  positions: Record<string, { x: number; y: number }>;
}

function compareNodes(
  left: LayoutMessage["nodes"][number],
  right: LayoutMessage["nodes"][number],
): number {
  return compareText(left.id, right.id);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareEdges(
  left: LayoutMessage["edges"][number],
  right: LayoutMessage["edges"][number],
): number {
  return compareText(left.source, right.source)
    || compareText(left.target, right.target);
}

export function computeLayout({
  requestId,
  nodes,
  edges,
  direction,
}: LayoutMessage): LayoutResult {
  const sortedNodes = [...nodes].sort(compareNodes);
  const nodeIds = new Set(sortedNodes.map((node) => node.id));
  const sortedEdges = edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .sort(compareEdges);

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction,
    nodesep: 72,
    ranksep: 145,
    marginx: 56,
    marginy: 56,
  });

  for (const node of sortedNodes) {
    graph.setNode(node.id, { width: node.width, height: node.height });
  }
  for (const edge of sortedEdges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  return {
    requestId,
    positions: Object.fromEntries(sortedNodes.map((node) => {
      const point = graph.node(node.id) as { x: number; y: number } | undefined;
      return [
        node.id,
        point
          ? { x: point.x - node.width / 2, y: point.y - node.height / 2 }
          : { x: 0, y: 0 },
      ];
    })),
  };
}
