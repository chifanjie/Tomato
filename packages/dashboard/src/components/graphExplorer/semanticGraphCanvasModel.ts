import type { GraphEdge, GraphNode } from "@understand-code/core/types";
import type { AriaLabelConfig } from "@xyflow/react";
import type { SemanticGraphNode, SemanticNodeGroup } from "../../graphExplorer/semanticGraph";

export interface SemanticNodePosition {
  x: number;
  y: number;
}

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
  const usedOffsetsByColumn = new Map<number, Set<number>>();
  const missingNodes: SemanticGraphNode[] = [];

  for (const node of [...nodes].sort(compareSemanticNodes)) {
    const x = groupIndex(node.group) * GROUP_COLUMN_WIDTH;
    const previousPosition = previous.get(node.id);
    const offset = previousPosition ? Math.round(previousPosition.y / GROUP_ROW_HEIGHT) : -1;
    const usedOffsets = usedOffsetsByColumn.get(x) ?? new Set<number>();
    usedOffsetsByColumn.set(x, usedOffsets);

    if (previousPosition && previousPosition.x === x && !usedOffsets.has(offset)) {
      positions.set(node.id, previousPosition);
      usedOffsets.add(offset);
    } else {
      missingNodes.push(node);
    }
  }

  for (const node of missingNodes) {
    const x = groupIndex(node.group) * GROUP_COLUMN_WIDTH;
    const usedOffsets = usedOffsetsByColumn.get(x) ?? new Set<number>();
    usedOffsetsByColumn.set(x, usedOffsets);
    let offset = 0;
    while (usedOffsets.has(offset)) offset += 1;
    positions.set(node.id, { x, y: offset * GROUP_ROW_HEIGHT });
    usedOffsets.add(offset);
  }

  return positions;
}
