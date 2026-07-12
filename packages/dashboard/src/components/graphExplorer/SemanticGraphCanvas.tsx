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
  SemanticGraphEdge,
  SemanticGraphNode,
  SemanticNodeGroup,
} from "../../graphExplorer/semanticGraph";
import type {
  GraphExplorerDisplayMode,
  HierarchicalSemanticGraph,
} from "../../graphExplorer/hierarchicalGraph";
import { buildSelectionPresentation } from "../../graphExplorer/selectionPresentation";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useDashboardStore } from "../../store";
import FlowingSemanticEdge, { type FlowingSemanticEdgeData } from "./FlowingSemanticEdge";
import { coverageBadgeForNode } from "./graphExplorerModel";

interface SemanticGraphCanvasProps {
  semanticGraph: HierarchicalSemanticGraph;
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
  isNeighbor: boolean;
  isDimmed: boolean;
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
  calls: "var(--color-node-function)",
  contains: "var(--color-node-file)",
  imports: "var(--color-node-module)",
  depends_on: "var(--color-node-module)",
  documents: "var(--color-node-document)",
  reads_from: "var(--color-node-table)",
  writes_to: "var(--color-node-schema)",
  routes: "var(--color-node-endpoint)",
  contains_flow: "var(--color-node-concept)",
  flow_step: "var(--color-node-pipeline)",
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

const edgeTypes = {
  "flowing-semantic": FlowingSemanticEdge,
};

export default function SemanticGraphCanvas({ semanticGraph, displayMode, viewKey }: SemanticGraphCanvasProps) {
  const selectedNodeId = useDashboardStore((state) => state.selectedNodeId);
  const selectNode = useDashboardStore((state) => state.selectNode);
  const reducedMotion = useReducedMotion();
  const onNodeClick = useCallback<NodeMouseHandler<SemanticFlowNode>>(
    (_, node) => selectNode(node.id),
    [selectNode],
  );

  const structureKey = [
    semanticGraph.nodes
      .map((node) => `${node.id}:${node.kind ?? "node"}`)
      .sort()
      .join("|"),
    semanticGraph.edges
      .map((edge) => `${edge.source}->${edge.target}`)
      .sort()
      .join("|"),
  ].join("::");
  const positionsById = useMemo(() => {
    const groupOffsets = new Map<SemanticNodeGroup, number>();
    return new Map(
      [...semanticGraph.nodes]
        .sort(compareSemanticNodes)
        .map((node) => [node.id, semanticNodePosition(node, groupOffsets)]),
    );
  }, [structureKey]);

  const { nodes, edges } = useMemo(() => {
    const sortedNodes = [...semanticGraph.nodes].sort(compareSemanticNodes);
    const visibleNodeIds = new Set(sortedNodes.map((node) => node.id));
    const activeId = selectedNodeId && visibleNodeIds.has(selectedNodeId) ? selectedNodeId : null;
    const presentation = buildSelectionPresentation(semanticGraph, activeId, reducedMotion);

    const flowNodes: SemanticFlowNode[] = sortedNodes.map((node) => {
      const badge = coverageBadgeForNode(node);
      const nodePresentation = presentation.nodesById.get(node.id)!;
      return {
        id: node.id,
        type: "semantic",
        position: positionsById.get(node.id) ?? { x: 0, y: 0 },
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
          isSelected: nodePresentation.selected,
          isNeighbor: nodePresentation.neighbor,
          isDimmed: nodePresentation.dimmed,
        },
        style: { opacity: nodePresentation.opacity },
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      };
    });

    const flowEdges: Edge<FlowingSemanticEdgeData, "flowing-semantic">[] = semanticGraph.edges.map((edge) => {
      const edgePresentation = presentation.edgesById.get(edge.id)!;
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "flowing-semantic",
        label: edge.bundledCount > 1 ? `${formatLabel(edge.type)} x${edge.bundledCount}` : formatLabel(edge.type),
        data: {
          stroke: edgeColor(edge),
          opacity: edgePresentation.opacity,
          strokeWidth: edgePresentation.strokeWidth,
          animated: edgePresentation.animated,
          inlineDirection: edgePresentation.inlineDirection,
          flowDirection: edgePresentation.flowDirection,
          dashedFallback: edge.edgeTypes.includes("imports"),
        },
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [displayMode, positionsById, reducedMotion, semanticGraph, selectedNodeId]);

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
        edgeTypes={edgeTypes}
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
