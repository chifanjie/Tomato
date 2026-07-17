import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { requestSemanticLayout } from "../../graphExplorer/layoutClient.js";
import {
  buildSelectionPresentation,
  graphCardKeyAction,
} from "../../graphExplorer/selectionPresentation";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useDashboardStore } from "../../store";
import type { LayoutMessage } from "../../utils/layoutAlgorithm.js";
import FlowingSemanticEdge, { type FlowingSemanticEdgeData } from "./FlowingSemanticEdge";
import { coverageBadgeForNode } from "./graphExplorerModel";
import {
  compareSemanticNodes,
  extendSemanticNodePositions,
  GRAPH_POINTER_DOUBLE_CLICK_MS,
  graphEdgeTypeLabel,
  graphNodeTypeLabel,
  graphPointerAction,
  REACT_FLOW_ARIA_LABEL_CONFIG,
  semanticNodeClusterLabel,
  semanticNodeGroupLabel,
  type GraphPointerClick,
  type SemanticNodePosition,
} from "./semanticGraphCanvasModel";

interface SemanticGraphCanvasProps {
  semanticGraph: HierarchicalSemanticGraph;
  displayMode: GraphExplorerDisplayMode;
  viewKey: string;
  emptyNotice: string | null;
  onOpenScope: (scopeId: string) => void;
  onOpenCluster: (scopeId: string, clusterId: string) => void;
  onOpenFile: (scopeId: string, clusterId: string, fileId: string) => void;
  onSelectNode?: (nodeId: string | null) => void;
}

interface SemanticNodeData extends Record<string, unknown> {
  label: string;
  summary: string;
  group: SemanticNodeGroup;
  category: SemanticNodeGroup;
  rawType: SemanticGraphNode["rawType"];
  cluster: string;
  coverageLabel: string;
  coverageRelation: "direct" | "context" | "none";
  coverageProblem: boolean;
  documentationCounts?: DocumentationCounts;
  displayMode: GraphExplorerDisplayMode;
  isSelected: boolean;
  isNeighbor: boolean;
  isDimmed: boolean;
  canDrillDown: boolean;
  onSelect: () => void;
  onDrillDown?: () => void;
}

type SemanticFlowNode = Node<SemanticNodeData, "semantic">;

const NODE_WIDTH = 248;
const NODE_HEIGHT = 124;
const INITIAL_READABLE_ZOOM = 0.62;

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
      tabIndex={0}
      role="group"
      aria-keyshortcuts="Enter Space"
      aria-label={data.canDrillDown
        ? `${data.label}，按回车键进入，按空格键选择`
        : `${data.label}，按空格选择`}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const action = graphCardKeyAction(event.key, data.canDrillDown);
        if (!action) return;
        event.preventDefault();
        if (action === "drill") data.onDrillDown?.();
        else data.onSelect();
      }}
      className={`nodrag relative h-[124px] w-[248px] overflow-hidden rounded-md border bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.24)] outline-none transition-[box-shadow,border-color,opacity] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
        data.isSelected ? "node-glow" : ""
      }`}
      style={{
        borderColor: data.isSelected ? groupColor : "var(--color-border-subtle)",
        boxShadow: data.isSelected ? `0 0 0 2px ${groupColor}, 0 12px 30px rgba(0,0,0,0.32)` : undefined,
      }}
    >
      <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: groupColor }} />
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-text-muted" />
      <div className="flex h-full flex-col pl-4 pr-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase text-text-muted">
              {semanticNodeGroupLabel(data.group)} / {graphNodeTypeLabel(data.rawType)}
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

        <div className="mt-auto flex items-center justify-between gap-2 text-[10px] text-text-muted">
          <span className="min-w-0 truncate">{semanticNodeClusterLabel(data.cluster, data.group)}</span>
          <span className="flex shrink-0 items-center gap-2">
            {data.displayMode === "coverage" && counts && (
              <span>
                相关 {counts.context} · 待补 {counts.none} · 异常 {counts.problem}
              </span>
            )}
            {data.canDrillDown && (
              <button
                type="button"
                aria-label={`进入 ${data.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  data.onDrillDown?.();
                }}
                onDoubleClick={(event) => event.stopPropagation()}
                className="nodrag nopan min-h-11 min-w-11 rounded border border-border-subtle px-2 py-1 font-semibold text-text-secondary transition-colors hover:border-accent/35 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]"
              >
                进入
              </button>
            )}
          </span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-text-muted" />
    </div>
  );
}

const nodeTypes = {
  semantic: memo(SemanticNodeCard),
};

const edgeTypes = {
  "flowing-semantic": FlowingSemanticEdge,
};

export default function SemanticGraphCanvas({
  semanticGraph,
  displayMode,
  viewKey,
  emptyNotice,
  onOpenScope,
  onOpenCluster,
  onOpenFile,
  onSelectNode,
}: SemanticGraphCanvasProps) {
  const selectedNodeId = useDashboardStore((state) => state.selectedNodeId);
  const selectNode = useDashboardStore((state) => state.selectNode);
  const selectGraphNode = onSelectNode ?? selectNode;
  const reducedMotion = useReducedMotion();
  const lastNodeClickRef = useRef<GraphPointerClick | null>(null);
  const lastDrillRef = useRef<GraphPointerClick | null>(null);
  const drillOnce = useCallback((node: SemanticFlowNode, at: number) => {
    if (!node.data.onDrillDown) return;
    const previous = lastDrillRef.current;
    const elapsed = previous ? at - previous.at : Number.POSITIVE_INFINITY;
    if (
      previous?.id === node.id
      && elapsed >= 0
      && elapsed <= GRAPH_POINTER_DOUBLE_CLICK_MS
    ) {
      return;
    }
    lastDrillRef.current = { id: node.id, at };
    lastNodeClickRef.current = null;
    node.data.onDrillDown?.();
  }, []);
  const onNodeClick = useCallback<NodeMouseHandler<SemanticFlowNode>>(
    (event, node) => {
      const result = graphPointerAction(lastNodeClickRef.current, {
        id: node.id,
        at: event.timeStamp,
        canDrillDown: Boolean(node.data.onDrillDown),
      });
      lastNodeClickRef.current = result.nextClick;
      if (result.action === "drill") drillOnce(node, event.timeStamp);
      else selectGraphNode(node.id);
    },
    [drillOnce, selectGraphNode],
  );
  const onNodeDoubleClick = useCallback<NodeMouseHandler<SemanticFlowNode>>(
    (event, node) => drillOnce(node, event.timeStamp),
    [drillOnce],
  );
  const onPaneClick = useCallback(() => {
    lastNodeClickRef.current = null;
    selectGraphNode(null);
  }, [selectGraphNode]);
  useEffect(() => {
    lastNodeClickRef.current = null;
    lastDrillRef.current = null;
  }, [viewKey]);

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

  const isCompactOverview = semanticGraph.presentation.level === "overview";
  const [layoutState, setLayoutState] = useState<{
    viewKey: string;
    positions: Map<string, SemanticNodePosition>;
  } | null>(null);
  const [layoutFailureViewKey, setLayoutFailureViewKey] = useState<string | null>(null);
  const layoutRequestId = useRef(0);

  useEffect(() => {
    if (isCompactOverview || semanticGraph.nodes.length === 0) return;

    const controller = new AbortController();
    let active = true;
    setLayoutFailureViewKey((current) => current === viewKey ? null : current);

    queueMicrotask(() => {
      if (!active || controller.signal.aborted) return;

      const requestId = ++layoutRequestId.current;
      const input: LayoutMessage = {
        requestId,
        direction: "LR",
        nodes: [...semanticGraph.nodes]
          .sort(compareSemanticNodes)
          .map((node) => ({ id: node.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
        edges: semanticGraph.edges
          .map((edge) => ({ source: String(edge.source), target: String(edge.target) }))
          .sort((left, right) => left.source.localeCompare(right.source)
            || left.target.localeCompare(right.target)),
      };

      void requestSemanticLayout(input, { signal: controller.signal })
        .then((result) => {
          if (
            !active
            || controller.signal.aborted
            || result.requestId !== requestId
            || requestId !== layoutRequestId.current
          ) {
            return;
          }
          setLayoutState({
            viewKey,
            positions: new Map(Object.entries(result.positions)),
          });
          setLayoutFailureViewKey(null);
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          if (!active || requestId !== layoutRequestId.current) return;
          setLayoutFailureViewKey(viewKey);
        });
    });

    return () => {
      active = false;
      controller.abort();
    };
    // viewKey is the stable layout revision. Selection may change the visible
    // capped set without changing this key and must not start another worker.
  }, [isCompactOverview, viewKey]);

  const completedPositions = layoutState?.viewKey === viewKey
    ? layoutState.positions
    : null;
  const basePositions = useMemo(
    () => isCompactOverview
      ? extendSemanticNodePositions(new Map(), semanticGraph.nodes)
      : completedPositions ?? new Map<string, SemanticNodePosition>(),
    [completedPositions, isCompactOverview, structureKey],
  );
  const positionsById = useMemo(
    () => extendSemanticNodePositions(basePositions, semanticGraph.nodes),
    [basePositions, structureKey],
  );

  const { nodes, edges } = useMemo(() => {
    const sortedNodes = [...semanticGraph.nodes].sort(compareSemanticNodes);
    const visibleNodeIds = new Set(sortedNodes.map((node) => node.id));
    const activeId = selectedNodeId && visibleNodeIds.has(selectedNodeId) ? selectedNodeId : null;
    const presentation = buildSelectionPresentation(semanticGraph, activeId, reducedMotion);

    const flowNodes: SemanticFlowNode[] = sortedNodes.map((node) => {
      const badge = coverageBadgeForNode(node);
      const nodePresentation = presentation.nodesById.get(node.id)!;
      const onDrillDown = node.canDrillDown && node.scopeId
        ? node.kind === "cluster" && node.clusterId
          ? () => onOpenCluster(node.scopeId!, node.clusterId!)
          : node.kind === "node" && node.rawType === "file" && node.clusterId
            ? () => onOpenFile(node.scopeId!, node.clusterId!, node.id)
            : node.kind === "scope" || node.kind === "boundary"
              ? () => onOpenScope(node.scopeId!)
              : undefined
        : undefined;
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
          canDrillDown: Boolean(onDrillDown),
          onSelect: () => selectGraphNode(node.id),
          ...(onDrillDown ? { onDrillDown } : {}),
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
        label: edge.bundledCount > 1
          ? `${graphEdgeTypeLabel(edge.type)} × ${edge.bundledCount}`
          : graphEdgeTypeLabel(edge.type),
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
  }, [displayMode, onOpenCluster, onOpenFile, onOpenScope, positionsById, reducedMotion, selectGraphNode, semanticGraph, selectedNodeId]);

  if (semanticGraph.nodes.length === 0) {
    return (
      <div className="uc-graph-frame flex min-h-[420px] flex-1 items-center justify-center overflow-hidden">
        <p role="status" aria-live="polite" className="uc-panel px-4 py-3 text-sm text-text-muted">
          {emptyNotice ?? "当前层级没有可显示的图谱元素。"}
        </p>
      </div>
    );
  }

  if (!isCompactOverview && completedPositions === null) {
    if (layoutFailureViewKey === viewKey) {
      return (
        <div className="uc-graph-frame flex min-h-[420px] flex-1 items-center justify-center overflow-hidden">
          <p role="alert" className="uc-panel px-4 py-3 text-sm text-text-muted">
            图谱布局计算失败，请切换层级后重试。
          </p>
        </div>
      );
    }
    return (
      <div className="uc-graph-frame flex min-h-[420px] flex-1 items-center justify-center overflow-hidden">
        <p
          role="status"
          aria-live="polite"
          className="uc-panel px-4 py-3 text-sm text-text-muted"
        >
          正在计算图谱布局…
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
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        nodesFocusable={false}
        nodesDraggable={false}
        nodesConnectable={false}
        ariaLabelConfig={REACT_FLOW_ARIA_LABEL_CONFIG}
        fitView
        fitViewOptions={{ padding: 0.16, minZoom: INITIAL_READABLE_ZOOM, maxZoom: 1.05 }}
        minZoom={0.08}
        maxZoom={1.7}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="var(--color-edge-dot)" />
        <Controls
          showInteractive={false}
          className="!border-border-subtle !bg-surface !text-text-primary"
        />
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
