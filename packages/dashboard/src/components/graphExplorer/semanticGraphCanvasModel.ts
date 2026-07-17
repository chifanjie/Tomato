import type { GraphEdge, GraphNode } from "@understand-code/core/types";
import { getViewportForBounds, type AriaLabelConfig } from "@xyflow/react";
import type {
  GraphExplorerDisplayMode,
  GraphExplorerNavigation,
  GraphNavigationLevel,
  HierarchicalGraphSelectionExpansion,
  HierarchicalSemanticGraph,
  HierarchicalSemanticGraphNode,
} from "../../graphExplorer/hierarchicalGraph";
import type { SemanticGraphNode, SemanticNodeGroup } from "../../graphExplorer/semanticGraph";
import type { GraphViewportBucket, LayoutBounds } from "../../utils/layoutAlgorithm.js";

export interface SemanticNodePosition {
  x: number;
  y: number;
}

export const READABLE_ZOOM_BY_LEVEL: Readonly<Record<GraphNavigationLevel, number>> = {
  overview: 0.54,
  scope: 0.62,
  cluster: 0.70,
  file: 0.78,
};

export type GraphSemanticZoomBand = "full" | "compact" | "minimal";

export interface GraphPointerClick {
  id: string;
  at: number;
}

export interface GraphPointerTarget extends GraphPointerClick {
  canDrillDown: boolean;
}

export type GraphPointerAction =
  | { action: "select"; nextClick: GraphPointerClick }
  | { action: "drill"; nextClick: null };

export const GRAPH_POINTER_DOUBLE_CLICK_MS = 500;

const GROUP_COLUMN_WIDTH = 310;
const GROUP_ROW_HEIGHT = 166;

const GROUP_ORDER: SemanticNodeGroup[] = [
  "capability",
  "flow",
  "module",
  "infra",
  "data",
  "file",
  "document",
  "symbol",
  "other",
];

const GROUP_LABELS: Record<SemanticNodeGroup, string> = {
  capability: "业务能力",
  flow: "业务流程",
  module: "模块",
  infra: "基础设施",
  data: "数据",
  file: "文件",
  document: "文档",
  symbol: "符号",
  other: "其他",
};

const NODE_TYPE_LABELS: Record<GraphNode["type"], string> = {
  file: "文件",
  function: "函数",
  class: "类",
  module: "模块",
  concept: "概念",
  config: "配置",
  document: "文档",
  service: "服务",
  table: "数据表",
  endpoint: "接口",
  pipeline: "流水线",
  schema: "模式",
  resource: "资源",
  domain: "业务域",
  flow: "流程",
  step: "步骤",
  article: "文章",
  entity: "实体",
  topic: "主题",
  claim: "结论",
  source: "来源",
};

const EDGE_TYPE_LABELS: Record<GraphEdge["type"], string> = {
  imports: "导入",
  exports: "导出",
  contains: "包含",
  inherits: "继承",
  implements: "实现",
  calls: "调用",
  subscribes: "订阅",
  publishes: "发布",
  middleware: "中间件",
  reads_from: "读取",
  writes_to: "写入",
  transforms: "转换",
  validates: "校验",
  depends_on: "依赖",
  tested_by: "被测试",
  configures: "配置",
  related: "相关",
  similar_to: "相似",
  deploys: "部署",
  serves: "提供服务",
  provisions: "供应",
  triggers: "触发",
  migrates: "迁移",
  documents: "说明",
  routes: "路由",
  defines_schema: "定义模式",
  contains_flow: "包含流程",
  flow_step: "流程步骤",
  cross_domain: "跨业务域",
  cites: "引用",
  contradicts: "矛盾",
  builds_on: "基于",
  exemplifies: "示例",
  categorized_under: "归类于",
  authored_by: "作者",
};

function groupIndex(group: SemanticNodeGroup): number {
  const index = GROUP_ORDER.indexOf(group);
  return index === -1 ? GROUP_ORDER.length - 1 : index;
}

export function compareSemanticNodes(a: SemanticGraphNode, b: SemanticGraphNode): number {
  return groupIndex(a.group) - groupIndex(b.group)
    || a.cluster.localeCompare(b.cluster)
    || a.label.localeCompare(b.label)
    || a.id.localeCompare(b.id);
}

export function semanticNodeGroupLabel(group: SemanticNodeGroup): string {
  return GROUP_LABELS[group];
}

export function semanticNodeClusterLabel(cluster: string, group: SemanticNodeGroup): string {
  return cluster === group ? GROUP_LABELS[group] : cluster;
}

export function graphNodeTypeLabel(type: GraphNode["type"]): string {
  return NODE_TYPE_LABELS[type];
}

export function graphEdgeTypeLabel(type: GraphEdge["type"]): string {
  return EDGE_TYPE_LABELS[type];
}

export const REACT_FLOW_ARIA_LABEL_CONFIG = {
  "node.a11yDescription.default": "图谱节点；可在节点卡片上选择或进入。",
  "node.a11yDescription.keyboardDisabled": "节点卡片提供选择和进入操作。",
  "node.a11yDescription.ariaLiveMessage": ({ x, y }) =>
    `节点位置已更新到横坐标 ${x}、纵坐标 ${y}。`,
  "edge.a11yDescription.default": "图谱连接线，用于表示元素之间的关系。",
  "controls.ariaLabel": "图谱控制面板",
  "controls.zoomIn.ariaLabel": "放大图谱",
  "controls.zoomOut.ariaLabel": "缩小图谱",
  "controls.fitView.ariaLabel": "适应视图",
  "controls.interactive.ariaLabel": "切换图谱交互",
  "minimap.ariaLabel": "图谱缩略图",
  "handle.ariaLabel": "节点连接点",
} satisfies Partial<AriaLabelConfig>;

export function graphPointerAction(
  previous: GraphPointerClick | null,
  target: GraphPointerTarget,
  thresholdMs = GRAPH_POINTER_DOUBLE_CLICK_MS,
): GraphPointerAction {
  const elapsed = previous ? target.at - previous.at : Number.POSITIVE_INFINITY;
  if (
    target.canDrillDown
    && previous?.id === target.id
    && elapsed >= 0
    && elapsed <= thresholdMs
  ) {
    return { action: "drill", nextClick: null };
  }
  return { action: "select", nextClick: { id: target.id, at: target.at } };
}

export function extendSemanticNodePositions(
  previous: ReadonlyMap<string, SemanticNodePosition>,
  nodes: SemanticGraphNode[],
): Map<string, SemanticNodePosition> {
  const positions = new Map<string, SemanticNodePosition>();
  const usedCoordinates = new Set<string>();
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const missingNodes: SemanticGraphNode[] = [];

  for (const node of [...nodes].sort(compareSemanticNodes)) {
    const previousPosition = previous.get(node.id);
    const coordinate = previousPosition
      ? `${previousPosition.x}:${previousPosition.y}`
      : "";
    if (previousPosition && !usedCoordinates.has(coordinate)) {
      positions.set(node.id, previousPosition);
      usedCoordinates.add(coordinate);
    } else {
      missingNodes.push(node);
    }
  }

  for (const node of missingNodes) {
    const groupPositions = [...positions]
      .filter(([id]) => nodesById.get(id)?.group === node.group)
      .map(([, position]) => position);
    const x = groupPositions[0]?.x ?? groupIndex(node.group) * GROUP_COLUMN_WIDTH;
    let y = groupPositions.length > 0
      ? Math.max(...groupPositions.map((position) => position.y)) + GROUP_ROW_HEIGHT
      : 0;
    while (usedCoordinates.has(`${x}:${y}`)) y += GROUP_ROW_HEIGHT;
    const position = { x, y };
    positions.set(node.id, position);
    usedCoordinates.add(`${position.x}:${position.y}`);
  }

  return positions;
}

export function graphNodeSize(
  level: GraphNavigationLevel,
  node: HierarchicalSemanticGraphNode,
): { width: number; height: number } {
  const contentHeight = graphNodeContentHeight(node, "full");
  if (node.kind === "scope" || node.kind === "boundary") {
    return { width: 264, height: Math.max(132, contentHeight) };
  }
  if (node.kind === "cluster") return { width: 236, height: Math.max(108, contentHeight) };
  if (node.rawType === "file") return { width: 228, height: Math.max(92, contentHeight) };
  if (node.rawType === "function" || node.rawType === "class" || level === "file") {
    return { width: 208, height: Math.max(76, contentHeight) };
  }
  return { width: 224, height: Math.max(88, contentHeight) };
}

/**
 * Mirrors the fixed CSS line-height budget used by SemanticNodeCard. Reserving
 * the summary rows in full mode keeps layout size independent from prose.
 */
export function graphNodeContentHeight(
  node: HierarchicalSemanticGraphNode,
  zoomBand: GraphSemanticZoomBand,
): number {
  const verticalChrome = 17;
  const heading = 36;
  if (zoomBand === "minimal") return verticalChrome + heading;

  const summary = zoomBand === "full" ? 42 : 0;
  const path = node.filePath ? 25 : 0;
  const footer = node.canDrillDown ? 52 : 24;
  return verticalChrome + heading + summary + path + footer;
}

function compareStable(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function buildGraphStructureKey(input: {
  graphRevision: string;
  displayMode: GraphExplorerDisplayMode;
  navigation: GraphExplorerNavigation;
  viewport: GraphViewportBucket;
  baseGraph: HierarchicalSemanticGraph;
  nodeSizeById: ReadonlyMap<string, { width: number; height: number }>;
  algorithmVersion: number;
  densityVersion: number;
}): string {
  return JSON.stringify({
    format: 1,
    graphRevision: input.graphRevision,
    displayMode: input.displayMode,
    navigation: [
      input.navigation.level,
      input.navigation.scopeId ?? "",
      input.navigation.clusterId ?? "",
      input.navigation.fileId ?? "",
    ],
    viewport: [
      input.viewport.width,
      input.viewport.height,
      input.viewport.widthBucket,
      input.viewport.heightBucket,
      input.viewport.aspectBucket,
    ],
    algorithmVersion: input.algorithmVersion,
    densityVersion: input.densityVersion,
    nodes: input.baseGraph.nodes
      .map((node) => {
        const size = input.nodeSizeById.get(node.id) ?? graphNodeSize(input.navigation.level, node);
        return [node.id, node.kind ?? "node", size.width, size.height] as const;
      })
      .sort((left, right) => compareStable(left[0], right[0])),
    edges: input.baseGraph.edges
      .map((edge) => [
        edge.source,
        edge.target,
        edge.type,
        [...edge.edgeTypes].sort(compareStable),
        edge.direction,
        [...edge.directions].sort(compareStable),
        edge.bundledCount,
        edge.weight,
      ] as const)
      .sort((left, right) => compareStable(JSON.stringify(left), JSON.stringify(right))),
  });
}

function allPlacementEdges(
  baseGraph: HierarchicalSemanticGraph,
  expansion: HierarchicalGraphSelectionExpansion,
): Array<{ source: string; target: string }> {
  const byIdentity = new Map<string, { source: string; target: string }>();
  for (const edge of [...baseGraph.edges, ...expansion.edges]) {
    const identity = `${edge.source}\u0000${edge.target}`;
    if (!byIdentity.has(identity)) byIdentity.set(identity, { source: edge.source, target: edge.target });
  }
  return [...byIdentity.values()];
}

export function placeSelectionExpansion(input: {
  baseGraph: HierarchicalSemanticGraph;
  expansion: HierarchicalGraphSelectionExpansion;
  basePositions: ReadonlyMap<string, SemanticNodePosition>;
  selectedNodeId: string | null;
  nodeSizeById: ReadonlyMap<string, { width: number; height: number }>;
  viewport: GraphViewportBucket;
}): Map<string, SemanticNodePosition> {
  const result = new Map(input.basePositions);
  const allNodes = new Map(
    [...input.baseGraph.nodes, ...input.expansion.nodes].map((node) => [node.id, node]),
  );
  const adjacency = new Map<string, Set<string>>();
  for (const id of allNodes.keys()) adjacency.set(id, new Set());
  for (const edge of allPlacementEdges(input.baseGraph, input.expansion)) {
    if (!allNodes.has(edge.source) || !allNodes.has(edge.target)) continue;
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const anchorById = new Map<string, string>();
  let frontier = [...input.basePositions.keys()]
    .filter((id) => allNodes.has(id))
    .sort(compareStable);
  for (const id of frontier) anchorById.set(id, id);
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      const anchor = anchorById.get(id)!;
      for (const neighbor of adjacency.get(id) ?? []) {
        if (anchorById.has(neighbor)) continue;
        anchorById.set(neighbor, anchor);
        next.push(neighbor);
      }
    }
    frontier = next.sort((left, right) => (
      compareStable(anchorById.get(left) ?? "", anchorById.get(right) ?? "")
      || compareStable(left, right)
    ));
  }

  const defaultAnchor = [...input.basePositions.keys()].sort(compareStable)[0] ?? null;
  const missing = input.expansion.nodes
    .filter((node) => !result.has(node.id))
    .sort((left, right) => (
      Number(right.id === input.selectedNodeId) - Number(left.id === input.selectedNodeId)
      || compareStable(left.id, right.id)
    ));
  const groups = new Map<string, HierarchicalSemanticGraphNode[]>();
  for (const node of missing) {
    const anchor = anchorById.get(node.id) ?? defaultAnchor ?? "__viewport__";
    const group = groups.get(anchor) ?? [];
    group.push(node);
    groups.set(anchor, group);
  }

  for (const [anchorId, nodes] of [...groups.entries()].sort(([left], [right]) => compareStable(left, right))) {
    const anchorPosition = anchorId === "__viewport__" ? undefined : input.basePositions.get(anchorId);
    const anchorSize = anchorId === "__viewport__" ? undefined : input.nodeSizeById.get(anchorId);
    const anchorCenter = anchorPosition && anchorSize
      ? {
          x: anchorPosition.x + anchorSize.width / 2,
          y: anchorPosition.y + anchorSize.height / 2,
        }
      : { x: input.viewport.width / 2, y: input.viewport.height / 2 };
    const anchorRadius = anchorSize
      ? Math.hypot(anchorSize.width, anchorSize.height) / 2
      : 0;
    const maxNodeRadius = Math.max(44, ...nodes.map((node) => {
      const size = input.nodeSizeById.get(node.id) ?? graphNodeSize(input.baseGraph.presentation.level, node);
      return Math.hypot(size.width, size.height) / 2;
    }));

    nodes.forEach((node, index) => {
      const ring = Math.floor(index / 8);
      const slot = index % 8;
      const size = input.nodeSizeById.get(node.id) ?? graphNodeSize(input.baseGraph.presentation.level, node);
      const radius = anchorRadius + maxNodeRadius * 1.1 + 56
        + ring * (maxNodeRadius * 2.2 + 40);
      const angle = -Math.PI / 2 + slot * (Math.PI * 2 / 8);
      result.set(node.id, {
        x: anchorCenter.x + Math.cos(angle) * radius - size.width / 2,
        y: anchorCenter.y + Math.sin(angle) * radius - size.height / 2,
      });
    });
  }
  return result;
}

export function computeReadableViewport(input: {
  level: GraphNavigationLevel;
  bounds: LayoutBounds;
  focusBounds?: LayoutBounds;
  viewport: GraphViewportBucket;
  padding: number;
  maxZoom: number;
}): { viewport: { x: number; y: number; zoom: number }; fullyFits: boolean } {
  const fullViewport = getViewportForBounds(
    input.bounds,
    input.viewport.width,
    input.viewport.height,
    0.01,
    input.maxZoom,
    input.padding,
  );
  const floor = Math.min(READABLE_ZOOM_BY_LEVEL[input.level], input.maxZoom);
  if (fullViewport.zoom >= floor) {
    return { viewport: fullViewport, fullyFits: true };
  }
  const focusViewport = getViewportForBounds(
    input.focusBounds ?? input.bounds,
    input.viewport.width,
    input.viewport.height,
    floor,
    floor,
    input.padding,
  );
  return { viewport: focusViewport, fullyFits: false };
}

export function graphSemanticZoomBand(zoom: number): GraphSemanticZoomBand {
  if (zoom >= 0.85) return "full";
  if (zoom >= 0.62) return "compact";
  return "minimal";
}
