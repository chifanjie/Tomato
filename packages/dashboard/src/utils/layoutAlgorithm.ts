import dagre from "@dagrejs/dagre";
import type { GraphEdge } from "@understand-code/core";
import type { GraphNavigationLevel } from "../graphExplorer/hierarchicalGraph.js";

export const GRAPH_LAYOUT_ALGORITHM_VERSION = 3;
export const GRAPH_LAYOUT_DENSITY_VERSION = 2;

export type GraphAspectBucket = "portrait" | "balanced" | "landscape" | "wide";
export type GraphLayoutNodeKind = "scope" | "boundary" | "cluster" | "file" | "symbol" | "raw";
export type GraphLayoutEdgeRole = "backbone" | "primary" | "secondary" | "context";

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
    importance?: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
    relationType: GraphEdge["type"];
    directions: readonly GraphEdge["direction"][];
    weight: number;
    count: number;
    role?: GraphLayoutEdgeRole;
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
const IMPORTANCE_HALO = 14;
const CLUSTER_GAP = 24;
const EDGE_ROLE_WEIGHT: Readonly<Record<GraphLayoutEdgeRole, number>> = {
  backbone: 8,
  primary: 2,
  secondary: 1,
  context: 0.5,
};
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
  role?: GraphLayoutEdgeRole;
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareNumber(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function finiteNonNegative(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

function nodeImportance(node: LayoutNode): number {
  return Math.min(1, finiteNonNegative(node.importance));
}

function nodeHalo(node: LayoutNode): number {
  return nodeImportance(node) * IMPORTANCE_HALO;
}

function layoutNodeSize(node: LayoutNode): { width: number; height: number; halo: number } {
  const halo = nodeHalo(node);
  return {
    width: node.width + halo * 2,
    height: node.height + halo * 2,
    halo,
  };
}

function clusterKey(node: LayoutNode): string {
  return node.clusterId ?? "\uffff";
}

function compareNodes(left: LayoutNode, right: LayoutNode): number {
  return compareNumber(KIND_ORDER[left.kind], KIND_ORDER[right.kind])
    || compareText(clusterKey(left), clusterKey(right))
    || compareNumber(nodeImportance(right), nodeImportance(left))
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
    || compareText(left.role ?? "primary", right.role ?? "primary")
    || compareNumber(left.weight, right.weight)
    || compareNumber(left.count, right.count);
}

function edgeLayoutWeight(
  edge: DirectionalEdge,
  nodeById: ReadonlyMap<string, LayoutNode>,
): number {
  const source = nodeById.get(edge.source);
  const target = nodeById.get(edge.target);
  const roleWeight = EDGE_ROLE_WEIGHT[edge.role ?? "primary"] ?? EDGE_ROLE_WEIGHT.primary;
  const countWeight = 1 + Math.log2(Math.max(1, finiteNonNegative(edge.count)));
  const semanticWeight = 1 + Math.min(4, finiteNonNegative(edge.weight)) * 2;
  const importanceWeight = 1 + ((source ? nodeImportance(source) : 0)
    + (target ? nodeImportance(target) : 0)) * 0.25;
  const clusterWeight = source?.clusterId && source.clusterId === target?.clusterId ? 1.35 : 1;
  return Math.max(
    1,
    Math.round(roleWeight * countWeight * semanticWeight * importanceWeight * clusterWeight * 100) / 100,
  );
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
  graph.setGraph({
    rankdir: direction,
    ranker: "longest-path",
    nodesep,
    ranksep,
    marginx: 0,
    marginy: 0,
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    const size = layoutNodeSize(node);
    graph.setNode(node.id, { width: size.width, height: size.height });
  }

  const occurrences = new Map<string, number>();
  for (const edge of edges) {
    const baseName = [
      edge.source,
      edge.target,
      edge.relationType,
      edge.direction,
      edge.weight,
      edge.count,
      edge.role ?? "primary",
    ].join("\u0000");
    const occurrence = occurrences.get(baseName) ?? 0;
    occurrences.set(baseName, occurrence + 1);
    graph.setEdge(
      edge.source,
      edge.target,
      { weight: edgeLayoutWeight(edge, nodeById) },
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
    scope: { nodesep: 40, ranksep: horizontal ? 132 : 112 },
    cluster: { nodesep: horizontal ? 52 : 44, ranksep: horizontal ? 116 : 102 },
    file: { nodesep: horizontal ? 42 : 36, ranksep: horizontal ? 98 : 88 },
  } as const;
  const spacing = spacingByLevel[input.level === "overview" ? "scope" : input.level];
  const graph = dagreGraph(nodes, edges, horizontal ? "LR" : "TB", spacing.nodesep, spacing.ranksep);
  const positions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const point = graph.node(node.id) as { x: number; y: number } | undefined;
    const size = layoutNodeSize(node);
    positions.set(node.id, point
      ? {
          x: point.x - size.width / 2 + size.halo,
          y: point.y - size.height / 2 + size.halo,
        }
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
  let previousNode: LayoutNode | undefined;

  for (const node of nodes) {
    const size = layoutNodeSize(node);
    const mainSize = horizontal ? size.width : size.height;
    const crossSize = horizontal ? size.height : size.width;
    const clusterGap = previousNode && clusterKey(previousNode) !== clusterKey(node)
      ? CLUSTER_GAP
      : 0;
    let crossStart = crossOffset + (crossOffset > 0 ? gap + clusterGap : 0);
    if (crossOffset > 0 && crossStart + crossSize > crossLimit) {
      mainOffset += laneMainExtent + gap;
      crossOffset = 0;
      laneMainExtent = 0;
      previousNode = undefined;
      crossStart = 0;
    }
    positions.set(node.id, horizontal
      ? { x: mainOffset + size.halo, y: crossStart + size.halo }
      : { x: crossStart + size.halo, y: mainOffset + size.halo });
    crossOffset = crossStart + crossSize;
    laneMainExtent = Math.max(laneMainExtent, mainSize);
    crossExtent = Math.max(crossExtent, crossOffset);
    previousNode = node;
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
    const dagrePoints = new Map<string, { x: number; y: number }>();
    const ranks = new Map<number, LayoutNode[]>();
    for (const node of connected) {
      const point = graph.node(node.id) as { x: number; y: number } | undefined;
      if (point) dagrePoints.set(node.id, point);
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
        compareNumber(
          horizontal ? (dagrePoints.get(left.id)?.y ?? 0) : (dagrePoints.get(left.id)?.x ?? 0),
          horizontal ? (dagrePoints.get(right.id)?.y ?? 0) : (dagrePoints.get(right.id)?.x ?? 0),
        )
        || compareNodes(left, right)
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
    const sortedIsolates = [...isolates].sort(compareNodes);
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
  const maxWidth = Math.max(...nodes.map((node) => layoutNodeSize(node).width));
  const maxHeight = Math.max(...nodes.map((node) => layoutNodeSize(node).height));
  const cellWidth = maxWidth + gap;
  const cellHeight = maxHeight + gap;
  const columns = Math.max(1, Math.floor((input.viewport.width - OUTER_PADDING * 2 + gap) / cellWidth));
  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((node, index) => {
    const { halo } = layoutNodeSize(node);
    positions.set(node.id, {
      x: (index % columns) * cellWidth + halo,
      y: Math.floor(index / columns) * cellHeight + halo,
    });
  });
  return paddedResult(input.requestId, nodes, positions);
}

function isRuntimeRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidLayoutResult(input: LayoutMessage, result: unknown): boolean {
  if (!isRuntimeRecord(result)) return false;
  if (result.requestId !== input.requestId) return false;
  const bounds = result.bounds;
  if (!isRuntimeRecord(bounds)) return false;
  if (!isFiniteNumber(bounds.x) || !isFiniteNumber(bounds.y)
    || !isFiniteNumber(bounds.width) || !isFiniteNumber(bounds.height)) return false;
  const { x: boundsX, y: boundsY, width: boundsWidth, height: boundsHeight } = bounds;
  if (boundsWidth < 0 || boundsHeight < 0) return false;

  const positions = result.positions;
  if (!isRuntimeRecord(positions)) return false;

  const expectedIds = [...input.nodes].map((node) => node.id).sort(compareText);
  const actualIds = Object.keys(positions).sort(compareText);
  if (expectedIds.length !== actualIds.length) return false;
  if (expectedIds.some((id, index) => id !== actualIds[index])) return false;

  const occupied = new Set<string>();
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  const rectangles: Array<{
    id: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
  }> = [];
  for (const id of expectedIds) {
    const position = positions[id];
    const node = nodeById.get(id);
    if (!isRuntimeRecord(position) || !node
      || !isFiniteNumber(position.x) || !isFiniteNumber(position.y)) return false;
    if (!isFiniteNumber(node.width) || !isFiniteNumber(node.height)
      || node.width < 0 || node.height < 0) return false;
    const positionKey = `${position.x}\u0000${position.y}`;
    if (occupied.has(positionKey)) return false;
    occupied.add(positionKey);
    if (position.x < boundsX || position.y < boundsY) return false;
    if (position.x + node.width > boundsX + boundsWidth) return false;
    if (position.y + node.height > boundsY + boundsHeight) return false;
    rectangles.push({
      id,
      left: position.x,
      top: position.y,
      right: position.x + node.width,
      bottom: position.y + node.height,
    });
  }

  rectangles.sort((left, right) => compareNumber(left.left, right.left) || compareText(left.id, right.id));
  let active: typeof rectangles = [];
  for (const rectangle of rectangles) {
    active = active.filter((candidate) => candidate.right > rectangle.left);
    for (const candidate of active) {
      const hasArea = candidate.left < candidate.right && candidate.top < candidate.bottom
        && rectangle.left < rectangle.right && rectangle.top < rectangle.bottom;
      const verticalOverlap = candidate.top < rectangle.bottom && rectangle.top < candidate.bottom;
      if (hasArea && verticalOverlap) return false;
    }
    active.push(rectangle);
  }
  return true;
}
