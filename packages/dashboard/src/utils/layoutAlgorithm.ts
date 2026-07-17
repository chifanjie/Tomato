import dagre from "@dagrejs/dagre";
import type { GraphEdge } from "@understand-code/core";
import type { GraphNavigationLevel } from "../graphExplorer/hierarchicalGraph.js";

export const GRAPH_LAYOUT_ALGORITHM_VERSION = 2;
export const GRAPH_LAYOUT_DENSITY_VERSION = 1;

export type GraphAspectBucket = "portrait" | "balanced" | "landscape" | "wide";
export type GraphLayoutNodeKind = "scope" | "boundary" | "cluster" | "file" | "symbol" | "raw";

export interface GraphViewportBucket {
  width: number;
  height: number;
  widthBucket: number;
  heightBucket: number;
  aspectBucket: GraphAspectBucket;
}

export interface LayoutMessage {
  requestId: number;
  structureKey: string;
  level: GraphNavigationLevel;
  viewport: GraphViewportBucket;
  nodes: Array<{
    id: string;
    width: number;
    height: number;
    kind: GraphLayoutNodeKind;
    clusterId?: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    relationType: GraphEdge["type"];
    directions: readonly GraphEdge["direction"][];
    weight: number;
    count: number;
  }>;
}

export interface LayoutBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  requestId: number;
  positions: Record<string, { x: number; y: number }>;
  bounds: LayoutBounds;
}

const VIEWPORT_STEP = 160;
const MIN_VIEWPORT = 320;
const OUTER_PADDING = 48;
const KIND_ORDER: Readonly<Record<GraphLayoutNodeKind, number>> = {
  scope: 0,
  boundary: 1,
  cluster: 2,
  file: 3,
  symbol: 4,
  raw: 5,
};

type LayoutNode = LayoutMessage["nodes"][number];
type LayoutEdge = LayoutMessage["edges"][number];
type DirectionalEdge = {
  source: string;
  target: string;
  relationType: LayoutEdge["relationType"];
  direction: GraphEdge["direction"];
  weight: number;
  count: number;
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareNumber(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareNodes(left: LayoutNode, right: LayoutNode): number {
  return compareNumber(KIND_ORDER[left.kind], KIND_ORDER[right.kind])
    || compareText(left.id, right.id);
}

function normalizedDirections(edge: LayoutEdge): GraphEdge["direction"][] {
  return [...new Set(edge.directions)].sort(compareText);
}

function compareEdges(left: LayoutEdge, right: LayoutEdge): number {
  return compareText(left.source, right.source)
    || compareText(left.target, right.target)
    || compareText(left.relationType, right.relationType)
    || compareText(normalizedDirections(left).join("\u0000"), normalizedDirections(right).join("\u0000"))
    || compareNumber(left.weight, right.weight)
    || compareNumber(left.count, right.count);
}

function directionalEdges(input: LayoutMessage, nodeIds: ReadonlySet<string>): DirectionalEdge[] {
  const result: DirectionalEdge[] = [];
  for (const edge of [...input.edges].sort(compareEdges)) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    for (const direction of normalizedDirections(edge)) {
      if (direction === "backward") {
        result.push({ ...edge, source: edge.target, target: edge.source, direction });
      } else if (direction === "bidirectional") {
        result.push({ ...edge, direction, source: edge.source, target: edge.target });
        result.push({ ...edge, direction, source: edge.target, target: edge.source });
      } else {
        result.push({ ...edge, direction, source: edge.source, target: edge.target });
      }
    }
  }
  return result;
}

function aspectBucket(width: number, height: number): GraphAspectBucket {
  const ratio = height > 0 ? width / height : 1;
  if (ratio < 0.8) return "portrait";
  if (ratio <= 1.25) return "balanced";
  if (ratio <= 1.8) return "landscape";
  return "wide";
}

function quantizedDimension(value: number): number {
  const finite = Number.isFinite(value) ? Math.max(0, value) : 0;
  return Math.max(MIN_VIEWPORT, Math.round(finite / VIEWPORT_STEP) * VIEWPORT_STEP);
}

export function quantizeGraphViewport(width: number, height: number): GraphViewportBucket {
  const quantizedWidth = quantizedDimension(width);
  const quantizedHeight = quantizedDimension(height);
  return {
    width: quantizedWidth,
    height: quantizedHeight,
    widthBucket: quantizedWidth / VIEWPORT_STEP,
    heightBucket: quantizedHeight / VIEWPORT_STEP,
    aspectBucket: aspectBucket(quantizedWidth, quantizedHeight),
  };
}

function dagreGraph(
  nodes: readonly LayoutNode[],
  edges: readonly DirectionalEdge[],
  direction: "TB" | "LR",
  nodesep: number,
  ranksep: number,
): dagre.graphlib.Graph {
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: direction, nodesep, ranksep, marginx: 0, marginy: 0 });
  for (const node of nodes) graph.setNode(node.id, { width: node.width, height: node.height });

  const occurrences = new Map<string, number>();
  for (const edge of edges) {
    const baseName = [
      edge.source,
      edge.target,
      edge.relationType,
      edge.direction,
      edge.weight,
      edge.count,
    ].join("\u0000");
    const occurrence = occurrences.get(baseName) ?? 0;
    occurrences.set(baseName, occurrence + 1);
    graph.setEdge(
      edge.source,
      edge.target,
      { weight: Math.max(1, edge.count) },
      `${baseName}\u0000${occurrence}`,
    );
  }
  dagre.layout(graph);
  return graph;
}

function paddedResult(
  requestId: number,
  nodes: readonly LayoutNode[],
  rawPositions: ReadonlyMap<string, { x: number; y: number }>,
): LayoutResult {
  if (nodes.length === 0) {
    return { requestId, positions: {}, bounds: { x: 0, y: 0, width: 0, height: 0 } };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    const position = rawPositions.get(node.id) ?? { x: 0, y: 0 };
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + node.width);
    maxY = Math.max(maxY, position.y + node.height);
  }

  const offsetX = OUTER_PADDING - minX;
  const offsetY = OUTER_PADDING - minY;
  const positions = Object.fromEntries(nodes.map((node) => {
    const position = rawPositions.get(node.id) ?? { x: 0, y: 0 };
    return [node.id, { x: position.x + offsetX, y: position.y + offsetY }];
  }));
  return {
    requestId,
    positions,
    bounds: {
      x: 0,
      y: 0,
      width: maxX - minX + OUTER_PADDING * 2,
      height: maxY - minY + OUTER_PADDING * 2,
    },
  };
}

function lowerLevelLayout(input: LayoutMessage): LayoutResult {
  const nodes = [...input.nodes].sort(compareNodes);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = directionalEdges(input, nodeIds);
  const horizontal = input.viewport.aspectBucket === "landscape"
    || input.viewport.aspectBucket === "wide";
  const spacingByLevel = {
    scope: { nodesep: horizontal ? 64 : 52, ranksep: horizontal ? 132 : 112 },
    cluster: { nodesep: horizontal ? 52 : 44, ranksep: horizontal ? 116 : 102 },
    file: { nodesep: horizontal ? 42 : 36, ranksep: horizontal ? 98 : 88 },
  } as const;
  const spacing = spacingByLevel[input.level === "overview" ? "scope" : input.level];
  const graph = dagreGraph(nodes, edges, horizontal ? "LR" : "TB", spacing.nodesep, spacing.ranksep);
  const positions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const point = graph.node(node.id) as { x: number; y: number } | undefined;
    positions.set(node.id, point
      ? { x: point.x - node.width / 2, y: point.y - node.height / 2 }
      : { x: 0, y: 0 });
  }
  return paddedResult(input.requestId, nodes, positions);
}

function packRank(
  nodes: readonly LayoutNode[],
  horizontal: boolean,
  crossLimit: number,
): { positions: Map<string, { x: number; y: number }>; mainExtent: number; crossExtent: number } {
  const gap = 36;
  const positions = new Map<string, { x: number; y: number }>();
  let mainOffset = 0;
  let crossOffset = 0;
  let laneMainExtent = 0;
  let crossExtent = 0;

  for (const node of nodes) {
    const mainSize = horizontal ? node.width : node.height;
    const crossSize = horizontal ? node.height : node.width;
    if (crossOffset > 0 && crossOffset + crossSize > crossLimit) {
      mainOffset += laneMainExtent + gap;
      crossOffset = 0;
      laneMainExtent = 0;
    }
    positions.set(node.id, horizontal
      ? { x: mainOffset, y: crossOffset }
      : { x: crossOffset, y: mainOffset });
    crossOffset += crossSize + gap;
    laneMainExtent = Math.max(laneMainExtent, mainSize);
    crossExtent = Math.max(crossExtent, crossOffset - gap);
  }
  return {
    positions,
    mainExtent: mainOffset + laneMainExtent,
    crossExtent,
  };
}

function overviewLayout(input: LayoutMessage): LayoutResult {
  const nodes = [...input.nodes].sort(compareNodes);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = directionalEdges(input, nodeIds);
  const degree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  const connected = nodes.filter((node) => (degree.get(node.id) ?? 0) > 0);
  const isolates = nodes.filter((node) => (degree.get(node.id) ?? 0) === 0);
  const horizontal = input.viewport.aspectBucket === "landscape"
    || input.viewport.aspectBucket === "wide";
  const positions = new Map<string, { x: number; y: number }>();
  let connectedMainExtent = 0;
  let connectedCrossExtent = 0;

  if (connected.length > 0) {
    const connectedIds = new Set(connected.map((node) => node.id));
    const connectedEdges = edges.filter((edge) => connectedIds.has(edge.source) && connectedIds.has(edge.target));
    const graph = dagreGraph(connected, connectedEdges, horizontal ? "LR" : "TB", 64, 156);
    const ranks = new Map<number, LayoutNode[]>();
    for (const node of connected) {
      const point = graph.node(node.id) as { x: number; y: number } | undefined;
      const rankCoordinate = Math.round((horizontal ? point?.x : point?.y) ?? 0);
      const group = ranks.get(rankCoordinate) ?? [];
      group.push(node);
      ranks.set(rankCoordinate, group);
    }

    let rankMainOffset = 0;
    const rankGap = 112;
    const crossLimit = Math.max(
      240,
      (horizontal ? input.viewport.height : input.viewport.width) - OUTER_PADDING * 2,
    );
    for (const [, rankNodes] of [...ranks.entries()].sort(([left], [right]) => left - right)) {
      rankNodes.sort((left, right) => (
        compareNumber(KIND_ORDER[left.kind], KIND_ORDER[right.kind])
        || compareNumber(degree.get(right.id) ?? 0, degree.get(left.id) ?? 0)
        || compareText(left.id, right.id)
      ));
      const packed = packRank(rankNodes, horizontal, crossLimit);
      for (const node of rankNodes) {
        const local = packed.positions.get(node.id)!;
        positions.set(node.id, horizontal
          ? { x: rankMainOffset + local.x, y: local.y }
          : { x: local.x, y: rankMainOffset + local.y });
      }
      rankMainOffset += packed.mainExtent + rankGap;
      connectedMainExtent = Math.max(connectedMainExtent, rankMainOffset - rankGap);
      connectedCrossExtent = Math.max(connectedCrossExtent, packed.crossExtent);
    }
  }

  if (isolates.length > 0) {
    const sortedIsolates = [...isolates].sort((left, right) => (
      compareNumber(KIND_ORDER[left.kind], KIND_ORDER[right.kind])
      || compareText(left.id, right.id)
    ));
    const isolateStart = connectedCrossExtent + (connected.length > 0 ? 96 : 0);
    const crossLimit = Math.max(
      240,
      (horizontal ? input.viewport.width : input.viewport.height) - OUTER_PADDING * 2,
    );
    const packed = packRank(sortedIsolates, !horizontal, crossLimit);
    for (const node of sortedIsolates) {
      const local = packed.positions.get(node.id)!;
      positions.set(node.id, horizontal
        ? { x: local.x, y: isolateStart + local.y }
        : { x: isolateStart + local.x, y: local.y });
    }
  }

  return paddedResult(input.requestId, nodes, positions);
}

export function computeLayout(input: LayoutMessage): LayoutResult {
  return input.level === "overview" ? overviewLayout(input) : lowerLevelLayout(input);
}

export function computeStableGridLayout(input: LayoutMessage): LayoutResult {
  const nodes = [...input.nodes].sort(compareNodes);
  if (nodes.length === 0) {
    return { requestId: input.requestId, positions: {}, bounds: { x: 0, y: 0, width: 0, height: 0 } };
  }
  const gap = 48;
  const maxWidth = Math.max(...nodes.map((node) => node.width));
  const maxHeight = Math.max(...nodes.map((node) => node.height));
  const cellWidth = maxWidth + gap;
  const cellHeight = maxHeight + gap;
  const columns = Math.max(1, Math.floor((input.viewport.width - OUTER_PADDING * 2 + gap) / cellWidth));
  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((node, index) => {
    positions.set(node.id, {
      x: (index % columns) * cellWidth,
      y: Math.floor(index / columns) * cellHeight,
    });
  });
  return paddedResult(input.requestId, nodes, positions);
}

export function isValidLayoutResult(input: LayoutMessage, result: LayoutResult): boolean {
  if (result.requestId !== input.requestId) return false;
  const bounds = result.bounds;
  if (![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) return false;
  if (bounds.width < 0 || bounds.height < 0) return false;

  const expectedIds = [...input.nodes].map((node) => node.id).sort(compareText);
  const actualIds = Object.keys(result.positions).sort(compareText);
  if (expectedIds.length !== actualIds.length) return false;
  if (expectedIds.some((id, index) => id !== actualIds[index])) return false;

  const occupied = new Set<string>();
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  for (const id of expectedIds) {
    const position = result.positions[id];
    const node = nodeById.get(id);
    if (!position || !node || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return false;
    const positionKey = `${position.x}\u0000${position.y}`;
    if (occupied.has(positionKey)) return false;
    occupied.add(positionKey);
    if (position.x < bounds.x || position.y < bounds.y) return false;
    if (position.x + node.width > bounds.x + bounds.width) return false;
    if (position.y + node.height > bounds.y + bounds.height) return false;
  }
  return true;
}
