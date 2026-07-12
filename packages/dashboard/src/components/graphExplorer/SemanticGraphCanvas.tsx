import { memo, useCallback, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
} from "@xyflow/react";
import type { Edge, Node, NodeMouseHandler, NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  DocumentationCounts,
  SemanticGraph,
  SemanticGraphEdge,
  SemanticGraphNode,
  SemanticNodeGroup,
} from "../../graphExplorer/semanticGraph";
import type { GraphExplorerDisplayMode } from "../../graphExplorer/hierarchicalGraph";
import { useDashboardStore } from "../../store";
import { coverageBadgeForNode } from "./graphExplorerModel";

interface SemanticGraphCanvasProps {
  semanticGraph: SemanticGraph;
  displayMode: GraphExplorerDisplayMode;
  viewKey: string;
}

interface SemanticNodeData extends Record<string, unknown> {
  label: string;
  summary: string;
  group: SemanticNodeGroup;
  category: SemanticNodeGroup;
  rawType: string;
  cluster: string;
  coverageLabel: string;
  coverageRelation: "direct" | "context" | "none";
  coverageProblem: boolean;
  documentationCounts?: DocumentationCounts;
  displayMode: GraphExplorerDisplayMode;
  isSelected: boolean;
}

type SemanticFlowNode = Node<SemanticNodeData, "semantic">;

const NODE_WIDTH = 248;
const NODE_HEIGHT = 124;
const GROUP_COLUMN_WIDTH = 310;
const GROUP_ROW_HEIGHT = 166;
const INITIAL_READABLE_ZOOM = 0.62;

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

const GROUP_COLORS: Record<SemanticNodeGroup, string> = {
  capability: "var(--color-node-concept)",
  flow: "var(--color-node-pipeline)",
  module: "var(--color-node-module)",
  file: "var(--color-node-file)",
  symbol: "var(--color-node-function)",
  document: "var(--color-node-document)",
  data: "var(--color-node-table)",
  infra: "var(--color-node-service)",
  other: "var(--color-text-muted)",
};

const RELATION_COLORS: Record<SemanticNodeData["coverageRelation"], string> = {
  direct: "var(--color-accent)",
  context: "var(--color-node-module)",
  none: "var(--color-text-muted)",
};

const EDGE_COLORS: Record<string, string> = {
  calls: "rgba(103, 185, 143, 0.7)",
  contains: "rgba(95, 159, 184, 0.65)",
  depends_on: "rgba(210, 168, 95, 0.65)",
  documents: "rgba(120, 190, 230, 0.65)",
  reads_from: "rgba(115, 215, 170, 0.65)",
  writes_to: "rgba(220, 200, 93, 0.65)",
  routes: "rgba(229, 166, 101, 0.65)",
  contains_flow: "rgba(208, 137, 158, 0.65)",
  flow_step: "rgba(220, 131, 144, 0.65)",
};

function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}

function groupIndex(group: SemanticNodeGroup): number {
  const index = GROUP_ORDER.indexOf(group);
  return index === -1 ? GROUP_ORDER.length - 1 : index;
}

function compareSemanticNodes(a: SemanticGraphNode, b: SemanticGraphNode): number {
  return groupIndex(a.group) - groupIndex(b.group)
    || a.cluster.localeCompare(b.cluster)
    || a.label.localeCompare(b.label)
    || a.id.localeCompare(b.id);
}

function semanticNodePosition(node: SemanticGraphNode, groupOffsets: Map<SemanticNodeGroup, number>) {
  const offset = groupOffsets.get(node.group) ?? 0;
  groupOffsets.set(node.group, offset + 1);

  return {
    x: groupIndex(node.group) * GROUP_COLUMN_WIDTH,
    y: offset * GROUP_ROW_HEIGHT,
  };
}

function edgeColor(edge: SemanticGraphEdge): string {
  for (const type of edge.edgeTypes) {
    const color = EDGE_COLORS[type];
    if (color) return color;
  }
  return "var(--color-edge)";
}

function SemanticNodeCard({ data }: NodeProps<SemanticFlowNode>) {
  const groupColor = GROUP_COLORS[data.group];
  const relationColor = RELATION_COLORS[data.coverageRelation];
  const counts = data.documentationCounts;

  return (
    <div
      className={`relative h-[124px] w-[248px] overflow-hidden rounded-md border bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.24)] transition-[box-shadow,border-color,opacity] ${
        data.isSelected ? "node-glow" : ""
      }`}
      style={{
        borderColor: data.isSelected ? groupColor : "var(--color-border-subtle)",
        boxShadow: data.isSelected ? `0 0 0 2px ${groupColor}, 0 12px 30px rgba(0,0,0,0.32)` : undefined,
      }}
    >
      <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: groupColor }} />
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-text-muted" />
      <div className="flex h-full flex-col pl-4 pr-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase text-text-muted">
              {formatLabel(data.group)} / {formatLabel(data.rawType)}
            </p>
            <h3 className="mt-1 truncate text-sm font-semibold text-text-primary" title={data.label}>
              {data.label}
            </h3>
          </div>
          <span
            className="shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium text-text-secondary"
            style={{ borderColor: relationColor, color: relationColor }}
          >
            {data.coverageLabel}
          </span>
          {data.coverageProblem && (
            <span
              role="img"
              aria-label="生成或证据异常"
              title="生成或证据异常"
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: "var(--color-complexity-complex)" }}
            />
          )}
        </div>

        <p className="mt-2 line-clamp-2 text-xs leading-5 text-text-secondary">{data.summary}</p>

        <div className="mt-auto flex items-center justify-between gap-3 text-[10px] text-text-muted">
          <span className="min-w-0 truncate">{data.cluster}</span>
          {data.displayMode === "coverage" && counts && (
            <span className="shrink-0">
              相关 {counts.context} · 待补 {counts.none} · 异常 {counts.problem}
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-text-muted" />
    </div>
  );
}

const nodeTypes = {
  semantic: memo(SemanticNodeCard),
};

export default function SemanticGraphCanvas({ semanticGraph, displayMode, viewKey }: SemanticGraphCanvasProps) {
  const selectedNodeId = useDashboardStore((state) => state.selectedNodeId);
  const selectNode = useDashboardStore((state) => state.selectNode);
  const onNodeClick = useCallback<NodeMouseHandler<SemanticFlowNode>>(
    (_, node) => selectNode(node.id),
    [selectNode],
  );

  const { nodes, edges } = useMemo(() => {
    const groupOffsets = new Map<SemanticNodeGroup, number>();
    const sortedNodes = [...semanticGraph.nodes].sort(compareSemanticNodes);
    const visibleNodeIds = new Set(sortedNodes.map((node) => node.id));

    const flowNodes: SemanticFlowNode[] = sortedNodes.map((node) => {
      const badge = coverageBadgeForNode(node);
      return {
        id: node.id,
        type: "semantic",
        position: semanticNodePosition(node, groupOffsets),
        data: {
          label: node.label,
          summary: node.summary,
          group: node.group,
          category: node.category,
          rawType: node.rawType,
          cluster: node.cluster,
          coverageLabel: badge.label,
          coverageRelation: badge.relation,
          coverageProblem: badge.problem,
          documentationCounts: node.documentationCounts,
          displayMode,
          isSelected: node.id === selectedNodeId,
        },
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      };
    });

    const activeId = selectedNodeId && visibleNodeIds.has(selectedNodeId) ? selectedNodeId : null;
    const flowEdges: Edge[] = semanticGraph.edges.map((edge) => {
      const isConnected = activeId ? edge.source === activeId || edge.target === activeId : false;
      const opacity = activeId ? (isConnected ? 0.9 : 0.12) : 0.56;

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        label: edge.bundledCount > 1 ? `${formatLabel(edge.type)} x${edge.bundledCount}` : formatLabel(edge.type),
        style: {
          stroke: edgeColor(edge),
          strokeWidth: isConnected ? 2.4 : 1.4,
          opacity,
        },
        labelStyle: {
          fill: "var(--color-text-muted)",
          fontSize: 10,
          opacity: isConnected || !activeId ? 0.85 : 0.3,
        },
        labelBgStyle: {
          fill: "var(--color-root)",
          fillOpacity: 0.9,
        },
        labelBgPadding: [5, 3] as [number, number],
        labelBgBorderRadius: 3,
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [displayMode, semanticGraph.edges, semanticGraph.nodes, selectedNodeId]);

  if (semanticGraph.nodes.length === 0) {
    return (
      <div className="uc-graph-frame flex min-h-[420px] flex-1 items-center justify-center overflow-hidden">
        <p className="uc-panel px-4 py-3 text-sm text-text-muted">
          当前层级没有可显示的图谱元素。
        </p>
      </div>
    );
  }

  return (
    <div className="uc-graph-frame min-h-[420px] flex-1 overflow-hidden">
      <ReactFlow
        key={viewKey}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.16, minZoom: INITIAL_READABLE_ZOOM, maxZoom: 1.05 }}
        minZoom={0.08}
        maxZoom={1.7}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="var(--color-edge-dot)" />
        <Controls className="!border-border-subtle !bg-surface !text-text-primary" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            const data = node.data as SemanticNodeData | undefined;
            return data ? GROUP_COLORS[data.group] : "var(--color-text-muted)";
          }}
          maskColor="rgba(13, 17, 20, 0.72)"
          className="!border !border-border-subtle !bg-surface"
        />
      </ReactFlow>
    </div>
  );
}
