import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  DocumentationCounts,
  SemanticGraphEdge,
  SemanticGraphNode,
  SemanticNodeGroup,
} from "../../graphExplorer/semanticGraph";
import type {
  GraphExplorerDisplayMode,
  GraphExplorerNavigation,
  HierarchicalGraphSelectionExpansion,
  HierarchicalSemanticGraph,
  HierarchicalSemanticGraphNode,
} from "../../graphExplorer/hierarchicalGraph";
import { requestSemanticLayout } from "../../graphExplorer/layoutClient.js";
import {
  buildSelectionPresentation,
  graphCardKeyAction,
} from "../../graphExplorer/selectionPresentation";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useDashboardStore } from "../../store";
import {
  GRAPH_LAYOUT_ALGORITHM_VERSION,
  GRAPH_LAYOUT_DENSITY_VERSION,
  quantizeGraphViewport,
  type GraphViewportBucket,
  type LayoutBounds,
  type LayoutMessage,
} from "../../utils/layoutAlgorithm.js";
import FlowingSemanticEdge, { type FlowingSemanticEdgeData } from "./FlowingSemanticEdge";
import { coverageBadgeForNode } from "./graphExplorerModel";
import {
  buildGraphLayoutMessage,
  buildGraphStructureKey,
  compareSemanticNodes,
  computeReadableViewport,
  GRAPH_POINTER_DOUBLE_CLICK_MS,
  graphEdgeHandleIds,
  graphEdgeTypeLabel,
  graphLayoutOrientation,
  graphNodeDisplayBand,
  graphNodeSize,
  graphNodeTypeLabel,
  graphPointerAction,
  graphSemanticZoomBand,
  placeSelectionExpansion,
  REACT_FLOW_ARIA_LABEL_CONFIG,
  semanticNodeClusterLabel,
  semanticNodeGroupLabel,
  visibleGraphBounds,
  type GraphLayoutOrientation,
  type GraphPointerClick,
  type GraphSemanticZoomBand,
  type GraphViewportInsets,
  type SemanticNodePosition,
} from "./semanticGraphCanvasModel";

export interface GraphExplicitFocusRequest {
  requestId: number;
  materializedNodeId: string;
}

export interface GraphBaseLayoutReady {
  requestId: number;
  structureKey: string;
  materializedNodeId: string;
}

export interface GraphSelectedScreenBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface SemanticGraphCanvasIntentProps {
  frameRef: RefObject<HTMLDivElement | null>;
  baseGraph: HierarchicalSemanticGraph;
  semanticGraph: HierarchicalSemanticGraph;
  explicitFocusRequest: GraphExplicitFocusRequest | null;
  onBaseLayoutReady: (ready: GraphBaseLayoutReady) => void;
}

interface SemanticGraphCanvasProps extends SemanticGraphCanvasIntentProps {
  graphRevision: string;
  navigation: GraphExplorerNavigation;
  displayMode: GraphExplorerDisplayMode;
  emptyNotice: string | null;
  onOpenScope: (scopeId: string) => void;
  onOpenCluster: (scopeId: string, clusterId: string) => void;
  onOpenFile: (scopeId: string, clusterId: string, fileId: string) => void;
  onSelectNode?: (nodeId: string | null) => void;
  onClearSelection?: () => void;
  onFrameWidthChange?: (width: number) => void;
  onSelectedScreenBoundsChange?: (bounds: GraphSelectedScreenBounds | null) => void;
  showMinimap?: boolean;
  showControls?: boolean;
  narrowViewport?: boolean;
  fitViewportInsets?: Partial<GraphViewportInsets>;
}

interface SemanticNodeData extends Record<string, unknown> {
  nodeId: string;
  label: string;
  summary: string;
  path: string | null;
  group: SemanticNodeGroup;
  category: SemanticNodeGroup;
  rawType: SemanticGraphNode["rawType"];
  kind: NonNullable<HierarchicalSemanticGraphNode["kind"]>;
  cluster: string;
  coverageLabel: string;
  coverageRelation: "direct" | "context" | "none";
  coverageProblem: boolean;
  documentationCounts?: DocumentationCounts;
  fileCount?: number;
  relationCount?: number;
  displayMode: GraphExplorerDisplayMode;
  zoomBand: GraphSemanticZoomBand;
  layoutOrientation: GraphLayoutOrientation;
  isSelected: boolean;
  isNeighbor: boolean;
  isDimmed: boolean;
  canDrillDown: boolean;
  onSelect: () => void;
  onDrillDown?: () => void;
}

type SemanticFlowNode = Node<SemanticNodeData, "semantic">;
type SemanticFlowEdge = Edge<FlowingSemanticEdgeData, "flowing-semantic">;

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

const NARROW_DEFAULT_TOP_INSET = 40;
const MINIMAP_RIGHT_SAFE_INSET = 224;
const NARROW_MINIMAP_BOTTOM_SAFE_INSET = 176;

function edgeColor(edge: SemanticGraphEdge): string {
  for (const type of edge.edgeTypes) {
    const color = EDGE_COLORS[type];
    if (color) return color;
  }
  return "var(--color-graph-edge)";
}

function sameViewportBucket(
  left: GraphViewportBucket | null,
  right: GraphViewportBucket,
): boolean {
  return Boolean(left
    && left.width === right.width
    && left.height === right.height
    && left.widthBucket === right.widthBucket
    && left.heightBucket === right.heightBucket
    && left.aspectBucket === right.aspectBucket);
}

function boundsForNode(
  nodeId: string,
  positions: ReadonlyMap<string, SemanticNodePosition>,
  nodeSizeById: ReadonlyMap<string, { width: number; height: number }>,
): LayoutBounds | undefined {
  const position = positions.get(nodeId);
  const size = nodeSizeById.get(nodeId);
  if (!position || !size) return undefined;
  return { x: position.x, y: position.y, width: size.width, height: size.height };
}

function unionLayoutBounds(left: LayoutBounds, right: LayoutBounds): LayoutBounds {
  if (left.width <= 0 || left.height <= 0) return right;
  if (right.width <= 0 || right.height <= 0) return left;
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const rightEdge = Math.max(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.max(left.y + left.height, right.y + right.height);
  return { x, y, width: rightEdge - x, height: bottomEdge - y };
}

function sameViewportTransform(
  left: { x: number; y: number; zoom: number },
  right: { x: number; y: number; zoom: number },
): boolean {
  return left.x === right.x && left.y === right.y && left.zoom === right.zoom;
}

function SemanticNodeCard({ data }: NodeProps<SemanticFlowNode>) {
  const counts = data.documentationCounts;
  const aggregateMetadata = data.fileCount !== undefined || data.relationCount !== undefined
    ? [
        data.fileCount === undefined ? null : `${data.fileCount} 个文件`,
        data.relationCount === undefined ? null : `${data.relationCount} 条关系`,
      ].filter((item): item is string => item !== null).join(" · ")
    : "";
  const showSummary = Boolean(
    data.summary && (data.zoomBand === "full" || aggregateMetadata),
  );
  return (
    <div
      tabIndex={0}
      role="group"
      data-graph-node-id={data.nodeId}
      data-kind={data.kind === "node" ? data.rawType : data.kind}
      data-selected={String(data.isSelected)}
      data-neighbor={String(data.isNeighbor)}
      data-dimmed={String(data.isDimmed)}
      data-zoom-band={data.zoomBand}
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
      className={`nodrag uc-semantic-node relative h-full w-full overflow-hidden outline-none ${
        data.isSelected ? "is-selected" : ""
      }`}
    >
      {data.layoutOrientation === "vertical" ? (
        <>
          <Handle id="target-top" type="target" position={Position.Top} className="uc-semantic-node__handle" />
          <Handle id="target-bottom" type="target" position={Position.Bottom} className="uc-semantic-node__handle" />
          <Handle id="source-top" type="source" position={Position.Top} className="uc-semantic-node__handle" />
          <Handle id="source-bottom" type="source" position={Position.Bottom} className="uc-semantic-node__handle" />
        </>
      ) : (
        <>
          <Handle id="target-left" type="target" position={Position.Left} className="uc-semantic-node__handle" />
          <Handle id="target-right" type="target" position={Position.Right} className="uc-semantic-node__handle" />
          <Handle id="source-left" type="source" position={Position.Left} className="uc-semantic-node__handle" />
          <Handle id="source-right" type="source" position={Position.Right} className="uc-semantic-node__handle" />
        </>
      )}
      <div className="uc-semantic-node__body">
        <div className="uc-semantic-node__heading">
          <div className="min-w-0">
            <p className="uc-semantic-node__type">
              {semanticNodeGroupLabel(data.group)} / {graphNodeTypeLabel(data.rawType)}
            </p>
            <h3 className="uc-semantic-node__title" title={data.label}>{data.label}</h3>
          </div>
          {data.zoomBand === "minimal" && data.displayMode === "coverage" && (
            <span
              className="uc-semantic-node__badge uc-semantic-node__badge--minimal-coverage"
              data-relation={data.coverageProblem ? "problem" : data.coverageRelation}
              title={data.coverageProblem
                ? `${data.coverageLabel}，证据异常`
                : data.coverageLabel}
            >
              {data.coverageProblem ? `${data.coverageLabel} · 异常` : data.coverageLabel}
            </span>
          )}
          {data.zoomBand === "minimal" && data.canDrillDown && (
            <button
              type="button"
              aria-label={`进入 ${data.label}`}
              onClick={(event) => {
                event.stopPropagation();
                data.onDrillDown?.();
              }}
              onDoubleClick={(event) => event.stopPropagation()}
              className="nodrag nopan uc-semantic-node__drill min-h-11 min-w-11"
            >
              进入
            </button>
          )}
          {data.zoomBand !== "minimal" && (
            <span className="uc-semantic-node__badge" data-relation={data.coverageRelation}>
              {data.coverageLabel}
            </span>
          )}
        </div>
        {showSummary && (
          <p
            className={`uc-semantic-node__summary ${
              aggregateMetadata ? "uc-semantic-node__summary--aggregate" : ""
            }`}
            title={data.summary}
          >
            {data.summary}
          </p>
        )}
        {data.zoomBand === "minimal" && aggregateMetadata && (
          <p className="uc-semantic-node__aggregate-meta">{aggregateMetadata}</p>
        )}
        {data.zoomBand !== "minimal" && data.path && (
          <p className="uc-semantic-node__path" title={data.path}>{data.path}</p>
        )}
        {data.zoomBand !== "minimal" && <div className="uc-semantic-node__footer">
          <span>{aggregateMetadata || semanticNodeClusterLabel(data.cluster, data.group)}</span>
          {data.displayMode === "coverage" && counts && data.zoomBand === "full" && (
            <span>相关 {counts.context} · 待补 {counts.none} · 异常 {counts.problem}</span>
          )}
          {data.coverageProblem && (
            <span className="uc-semantic-node__problem">证据异常</span>
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
              className="nodrag nopan uc-semantic-node__drill min-h-11 min-w-11"
            >
              进入
            </button>
          )}
        </div>}
      </div>
    </div>
  );
}

const nodeTypes = { semantic: memo(SemanticNodeCard) };
const edgeTypes = { "flowing-semantic": FlowingSemanticEdge };

interface CompletedLayout {
  structureKey: string;
  positions: Map<string, SemanticNodePosition>;
  bounds: LayoutBounds;
  degraded: boolean;
}

interface AutomaticViewportAction {
  kind: "normal" | "explicit";
  structureKey: string;
  actionKey: string;
  flowGeneration: number;
}

interface AuthoritativeViewportIntent {
  generation: number;
  target: { x: number; y: number; zoom: number };
}

interface FlowMountDescriptor {
  generation: number;
  structureKey: string;
}

interface FlowInstanceBinding extends FlowMountDescriptor {
  instance: ReactFlowInstance<SemanticFlowNode, SemanticFlowEdge>;
}

interface FlowMountBoundaryProps {
  structureKey: string;
  createGeneration: () => number;
  onActivate: (generation: number, structureKey: string) => void;
  onStructureChange: (generation: number, structureKey: string) => void;
  onDeactivate: (generation: number) => void;
  onInit: (
    generation: number,
    instance: ReactFlowInstance<SemanticFlowNode, SemanticFlowEdge>,
  ) => void;
  children: (
    onInit: (instance: ReactFlowInstance<SemanticFlowNode, SemanticFlowEdge>) => void,
  ) => ReactNode;
}

function FlowMountBoundary(props: FlowMountBoundaryProps) {
  const {
    structureKey,
    createGeneration,
    onActivate,
    onStructureChange,
    onDeactivate,
    onInit,
    children,
  } = props;
  const [generation] = useState(createGeneration);

  // React Flow schedules onInit after mounting without cancelling that callback on unmount.
  // Commit the mount token first so late callbacks can never replace the active binding.
  useLayoutEffect(() => {
    onActivate(generation, structureKey);
    return () => onDeactivate(generation);
  }, [generation, onActivate, onDeactivate]);

  useLayoutEffect(() => {
    onStructureChange(generation, structureKey);
  }, [generation, onStructureChange, structureKey]);

  const handleInit = useCallback((
    instance: ReactFlowInstance<SemanticFlowNode, SemanticFlowEdge>,
  ) => onInit(generation, instance), [generation, onInit]);

  return <>{children(handleInit)}</>;
}

export default function SemanticGraphCanvas(props: SemanticGraphCanvasProps) {
  const {
    semanticGraph,
    displayMode,
    emptyNotice,
    onOpenScope,
    onOpenCluster,
    onOpenFile,
    onSelectNode,
    onClearSelection,
    onFrameWidthChange,
    onSelectedScreenBoundsChange,
    showMinimap = true,
    showControls = true,
    narrowViewport = false,
    fitViewportInsets,
    baseGraph,
    navigation,
    graphRevision,
    explicitFocusRequest,
    onBaseLayoutReady,
    frameRef,
  } = props;
  const selectedNodeId = useDashboardStore((state) => state.selectedNodeId);
  const selectNode = useDashboardStore((state) => state.selectNode);
  const selectGraphNode = onSelectNode ?? selectNode;
  const reducedMotion = useReducedMotion();
  const lastNodeClickRef = useRef<GraphPointerClick | null>(null);
  const lastDrillRef = useRef<GraphPointerClick | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [zoomBand, setZoomBand] = useState<GraphSemanticZoomBand>(
    graphSemanticZoomBand(0.78),
  );

  const [viewportBucket, setViewportBucket] = useState<GraphViewportBucket | null>(null);
  const currentViewportBucketRef = useRef(viewportBucket);
  currentViewportBucketRef.current = viewportBucket;
  const rawViewportSizeRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === "undefined") return;
    let disposed = false;
    let firstRaf: number | null = null;
    let secondRaf: number | null = null;
    let candidate: GraphViewportBucket | null = null;
    let latestRawSize: { width: number; height: number } | null = null;

    const cancelCandidate = () => {
      if (firstRaf !== null) cancelAnimationFrame(firstRaf);
      if (secondRaf !== null) cancelAnimationFrame(secondRaf);
      firstRaf = null;
      secondRaf = null;
      candidate = null;
    };
    const adopt = (next: GraphViewportBucket) => {
      currentViewportBucketRef.current = next;
      setViewportBucket(next);
    };
    const observer = new ResizeObserver((entries) => {
      const entry = entries.at(-1);
      const width = entry?.contentRect.width ?? 0;
      const height = entry?.contentRect.height ?? 0;
      onFrameWidthChange?.(width);
      if (width <= 0 || height <= 0) {
        rawViewportSizeRef.current = null;
        latestRawSize = null;
        cancelCandidate();
        return;
      }
      rawViewportSizeRef.current = { width, height };
      latestRawSize = { width, height };
      const next = quantizeGraphViewport(width, height);
      if (sameViewportBucket(currentViewportBucketRef.current, next)) {
        cancelCandidate();
        return;
      }
      if (currentViewportBucketRef.current === null) {
        cancelCandidate();
        adopt(next);
        return;
      }
      cancelCandidate();
      candidate = next;
      firstRaf = requestAnimationFrame(() => {
        firstRaf = null;
        const firstRawSize = latestRawSize;
        const checkedOnce = firstRawSize
          ? quantizeGraphViewport(firstRawSize.width, firstRawSize.height)
          : null;
        if (!candidate
          || !checkedOnce
          || !sameViewportBucket(candidate, checkedOnce)
          || disposed) return;
        secondRaf = requestAnimationFrame(() => {
          secondRaf = null;
          const secondRawSize = latestRawSize;
          const checkedTwice = secondRawSize
            ? quantizeGraphViewport(secondRawSize.width, secondRawSize.height)
            : null;
          if (!candidate
            || !checkedTwice
            || disposed
            || !sameViewportBucket(checkedOnce, checkedTwice)
            || !sameViewportBucket(candidate, checkedTwice)) return;
          candidate = null;
          adopt(checkedTwice);
        });
      });
    });
    observer.observe(frame);
    return () => {
      disposed = true;
      cancelCandidate();
      observer.disconnect();
    };
  }, [frameRef, onFrameWidthChange]);

  const nodeSizeById = useMemo(() => new Map(
    semanticGraph.nodes.map((node) => [node.id, graphNodeSize(navigation.level, node)]),
  ), [navigation.level, semanticGraph.nodes]);
  const baseNodeSizeById = useMemo(() => new Map(
    baseGraph.nodes.map((node) => [node.id, graphNodeSize(navigation.level, node)]),
  ), [baseGraph.nodes, navigation.level]);
  const layoutOrientation = graphLayoutOrientation(viewportBucket);
  const nodeDisplayBand = graphNodeDisplayBand(navigation.level, zoomBand);
  const structureKey = useMemo(() => viewportBucket
    ? buildGraphStructureKey({
        graphRevision,
        displayMode,
        navigation,
        viewport: viewportBucket,
        baseGraph,
        nodeSizeById: baseNodeSizeById,
        algorithmVersion: GRAPH_LAYOUT_ALGORITHM_VERSION,
        densityVersion: GRAPH_LAYOUT_DENSITY_VERSION,
      })
    : null, [baseGraph, baseNodeSizeById, displayMode, graphRevision, navigation, viewportBucket]);
  const latestStructureKeyRef = useRef<string | null>(structureKey);
  latestStructureKeyRef.current = structureKey;
  const latestBaseLayoutInputRef = useRef({ baseGraph, baseNodeSizeById, navigation, viewportBucket });
  latestBaseLayoutInputRef.current = { baseGraph, baseNodeSizeById, navigation, viewportBucket };

  const [layoutState, setLayoutState] = useState<CompletedLayout | null>(null);
  const [layoutFailureKey, setLayoutFailureKey] = useState<string | null>(null);
  const completedLayoutCacheRef = useRef(new Map<string, CompletedLayout>());
  const layoutRequestId = useRef(0);

  useEffect(() => {
    if (!structureKey || !viewportBucket) return;
    const inputSnapshot = latestBaseLayoutInputRef.current;
    const inputBaseGraph = inputSnapshot.baseGraph;
    const inputNodeSizeById = inputSnapshot.baseNodeSizeById;
    const inputNavigation = inputSnapshot.navigation;
    const inputViewport = inputSnapshot.viewportBucket;
    if (!inputViewport) return;
    const cached = completedLayoutCacheRef.current.get(structureKey);
    if (cached) {
      setLayoutState(cached);
      setLayoutFailureKey(null);
      return;
    }
    if (inputBaseGraph.nodes.length === 0) {
      const empty: CompletedLayout = {
        structureKey,
        positions: new Map(),
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        degraded: false,
      };
      completedLayoutCacheRef.current.set(structureKey, empty);
      setLayoutState(empty);
      setLayoutFailureKey(null);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLayoutFailureKey((current) => current === structureKey ? null : current);
    queueMicrotask(() => {
      if (!active || controller.signal.aborted) return;
      const requestId = ++layoutRequestId.current;
      const input: LayoutMessage = buildGraphLayoutMessage({
        requestId,
        structureKey,
        navigation: inputNavigation,
        viewport: inputViewport,
        baseGraph: inputBaseGraph,
        nodeSizeById: inputNodeSizeById,
      });

      void requestSemanticLayout(input, { signal: controller.signal })
        .then((result) => {
          if (!active
            || controller.signal.aborted
            || result.requestId !== requestId
            || latestStructureKeyRef.current !== structureKey) return;
          const completed: CompletedLayout = {
            structureKey,
            positions: new Map(Object.entries(result.positions)),
            bounds: result.bounds,
            degraded: result.degraded,
          };
          completedLayoutCacheRef.current.set(structureKey, completed);
          while (completedLayoutCacheRef.current.size > 24) {
            const oldest = completedLayoutCacheRef.current.keys().next().value as string | undefined;
            if (!oldest) break;
            completedLayoutCacheRef.current.delete(oldest);
          }
          setLayoutState(completed);
          setLayoutFailureKey(null);
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          if (!active || latestStructureKeyRef.current !== structureKey) return;
          setLayoutFailureKey(structureKey);
        });
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [structureKey]);

  const completedPositions = layoutState?.structureKey === structureKey
    ? layoutState.positions
    : null;
  const baseNodeIds = useMemo(() => new Set(baseGraph.nodes.map((node) => node.id)), [baseGraph.nodes]);
  const baseEdgeIds = useMemo(() => new Set(baseGraph.edges.map((edge) => edge.id)), [baseGraph.edges]);
  const selectionExpansion = useMemo<HierarchicalGraphSelectionExpansion>(() => ({
    nodes: semanticGraph.nodes.filter((node) => !baseNodeIds.has(node.id)),
    edges: semanticGraph.edges.filter((edge) => !baseEdgeIds.has(edge.id)),
    hiddenNeighborCount: 0,
  }), [baseEdgeIds, baseNodeIds, semanticGraph.edges, semanticGraph.nodes]);
  const positionsById = useMemo(() => completedPositions && viewportBucket
    ? placeSelectionExpansion({
        baseGraph,
        expansion: selectionExpansion,
        basePositions: completedPositions,
        selectedNodeId,
        nodeSizeById,
        viewport: viewportBucket,
      })
    : new Map<string, SemanticNodePosition>(), [
      baseGraph,
      completedPositions,
      nodeSizeById,
      selectedNodeId,
      selectionExpansion,
      viewportBucket,
    ]);
  const visibleBounds = useMemo(() => visibleGraphBounds({
    nodes: semanticGraph.nodes,
    positions: positionsById,
    nodeSizeById,
  }), [nodeSizeById, positionsById, semanticGraph.nodes]);

  const drillOnce = useCallback((node: SemanticFlowNode, at: number) => {
    if (!node.data.onDrillDown) return;
    const previous = lastDrillRef.current;
    const elapsed = previous ? at - previous.at : Number.POSITIVE_INFINITY;
    if (previous?.id === node.id && elapsed >= 0 && elapsed <= GRAPH_POINTER_DOUBLE_CLICK_MS) return;
    lastDrillRef.current = { id: node.id, at };
    lastNodeClickRef.current = null;
    node.data.onDrillDown?.();
  }, []);
  const onNodeClick = useCallback<NodeMouseHandler<SemanticFlowNode>>((event, node) => {
    const result = graphPointerAction(lastNodeClickRef.current, {
      id: node.id,
      at: event.timeStamp,
      canDrillDown: Boolean(node.data.onDrillDown),
    });
    lastNodeClickRef.current = result.nextClick;
    if (result.action === "drill") drillOnce(node, event.timeStamp);
    else selectGraphNode(node.id);
  }, [drillOnce, selectGraphNode]);
  const onNodeDoubleClick = useCallback<NodeMouseHandler<SemanticFlowNode>>(
    (event, node) => drillOnce(node, event.timeStamp),
    [drillOnce],
  );
  const onPaneClick = useCallback(() => {
    lastNodeClickRef.current = null;
    if (onClearSelection) onClearSelection?.();
    else selectGraphNode(null);
  }, [onClearSelection, selectGraphNode]);
  useEffect(() => {
    lastNodeClickRef.current = null;
    lastDrillRef.current = null;
  }, [structureKey]);

  const visibleNodeIds = useMemo(
    () => new Set(semanticGraph.nodes.map((node) => node.id)),
    [semanticGraph.nodes],
  );
  const activeId = selectedNodeId && visibleNodeIds.has(selectedNodeId)
    ? selectedNodeId
    : explicitFocusRequest?.materializedNodeId && visibleNodeIds.has(explicitFocusRequest.materializedNodeId)
      ? explicitFocusRequest.materializedNodeId
      : null;
  const { nodes, edges } = useMemo(() => {
    const presentation = buildSelectionPresentation(semanticGraph, activeId, reducedMotion);
    const labelsById = new Map(semanticGraph.nodes.map((node) => [node.id, node.label]));
    const flowNodes: SemanticFlowNode[] = [...semanticGraph.nodes]
      .sort(compareSemanticNodes)
      .map((node) => {
        const badge = coverageBadgeForNode(node);
        const nodePresentation = presentation.nodesById.get(node.id)!;
        const size = nodeSizeById.get(node.id) ?? graphNodeSize(navigation.level, node);
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
          style: { width: size.width, height: size.height },
          data: {
            nodeId: node.id,
            label: node.label,
            summary: node.summary,
            path: node.filePath ?? null,
            group: node.group,
            category: node.category,
            rawType: node.rawType,
            kind: node.kind ?? "node",
            cluster: node.cluster,
            coverageLabel: badge.label,
            coverageRelation: badge.relation,
            coverageProblem: badge.problem,
            documentationCounts: node.documentationCounts,
            fileCount: node.fileCount,
            relationCount: node.relationCount,
            displayMode,
            zoomBand: nodeDisplayBand,
            layoutOrientation,
            isSelected: nodePresentation.selected,
            isNeighbor: nodePresentation.neighbor,
            isDimmed: nodePresentation.dimmed,
            canDrillDown: Boolean(onDrillDown),
            onSelect: () => selectGraphNode(node.id),
            ...(onDrillDown ? { onDrillDown } : {}),
          },
        };
      });
    const flowEdges: SemanticFlowEdge[] = semanticGraph.edges.map((edge) => {
      const edgePresentation = presentation.edgesById.get(edge.id)!;
      const showLabel = edgePresentation.connected || hoveredEdgeId === edge.id;
      const handles = graphEdgeHandleIds(
        layoutOrientation,
        positionsById.get(edge.source),
        positionsById.get(edge.target),
      );
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        ...handles,
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
          showLabel,
          labelOpacity: showLabel ? Math.max(0.94, edgePresentation.opacity) : edgePresentation.opacity,
          sourceLabel: labelsById.get(edge.source) ?? edge.source,
          targetLabel: labelsById.get(edge.target) ?? edge.target,
        },
      };
    });
    return { nodes: flowNodes, edges: flowEdges };
  }, [
    activeId,
    displayMode,
    hoveredEdgeId,
    navigation.level,
    nodeSizeById,
    onOpenCluster,
    onOpenFile,
    onOpenScope,
    positionsById,
    reducedMotion,
    selectGraphNode,
    semanticGraph,
    layoutOrientation,
    nodeDisplayBand,
  ]);

  const flowMountGenerationRef = useRef(0);
  const activeFlowMountRef = useRef<FlowMountDescriptor | null>(null);
  const flowInstanceBindingRef = useRef<FlowInstanceBinding | null>(null);
  const [flowInstanceRevision, setFlowInstanceRevision] = useState(0);
  const createFlowMountGeneration = useCallback(() => ++flowMountGenerationRef.current, []);
  const activateFlowMount = useCallback((generation: number, mountedStructureKey: string) => {
    activeFlowMountRef.current = { generation, structureKey: mountedStructureKey };
    if (flowInstanceBindingRef.current?.generation !== generation) {
      flowInstanceBindingRef.current = null;
    }
  }, []);
  const updateFlowMountStructure = useCallback((
    generation: number,
    mountedStructureKey: string,
  ) => {
    const activeMount = activeFlowMountRef.current;
    if (!activeMount || activeMount.generation !== generation) return;
    activeFlowMountRef.current = { generation, structureKey: mountedStructureKey };
    const binding = flowInstanceBindingRef.current;
    if (binding?.generation === generation && binding.structureKey !== mountedStructureKey) {
      flowInstanceBindingRef.current = {
        instance: binding.instance,
        generation,
        structureKey: mountedStructureKey,
      };
    }
  }, []);
  const deactivateFlowMount = useCallback((generation: number) => {
    if (activeFlowMountRef.current?.generation === generation) {
      activeFlowMountRef.current = null;
    }
    if (flowInstanceBindingRef.current?.generation === generation) {
      flowInstanceBindingRef.current = null;
    }
  }, []);
  const bindFlowInstance = useCallback((
    generation: number,
    instance: ReactFlowInstance<SemanticFlowNode, SemanticFlowEdge>,
  ) => {
    const activeMount = activeFlowMountRef.current;
    if (!activeMount || activeMount.generation !== generation) return;
    const current = flowInstanceBindingRef.current;
    if (current?.instance === instance
      && current.generation === generation
      && current.structureKey === activeMount.structureKey) return;
    flowInstanceBindingRef.current = {
      instance,
      generation,
      structureKey: activeMount.structureKey,
    };
    setFlowInstanceRevision((current) => current + 1);
  }, []);
  const isCurrentFlowBinding = useCallback((binding: FlowInstanceBinding) => {
    const current = flowInstanceBindingRef.current;
    return current?.instance === binding.instance
      && current.generation === binding.generation
      && current.structureKey === binding.structureKey;
  }, []);
  const lastReportedSelectedScreenBoundsRef = useRef<GraphSelectedScreenBounds | null | undefined>(
    undefined,
  );
  const reportSelectedScreenBounds = useCallback(() => {
    if (!onSelectedScreenBoundsChange) return;
    const binding = flowInstanceBindingRef.current;
    const instance = binding?.structureKey === structureKey ? binding.instance : null;
    const frame = frameRef.current;
    const position = selectedNodeId ? positionsById.get(selectedNodeId) : undefined;
    const size = selectedNodeId ? nodeSizeById.get(selectedNodeId) : undefined;
    let next: GraphSelectedScreenBounds | null = null;
    if (instance && frame && position && size) {
      const topLeft = instance.flowToScreenPosition(position);
      const bottomRight = instance.flowToScreenPosition({
        x: position.x + size.width,
        y: position.y + size.height,
      });
      const frameRect = frame.getBoundingClientRect();
      next = {
        left: topLeft.x - frameRect.left,
        right: bottomRight.x - frameRect.left,
        top: topLeft.y - frameRect.top,
        bottom: bottomRight.y - frameRect.top,
      };
    }
    const previous = lastReportedSelectedScreenBoundsRef.current;
    if (previous === null && next === null) return;
    if (previous && next
      && previous.left === next.left
      && previous.right === next.right
      && previous.top === next.top
      && previous.bottom === next.bottom) return;
    lastReportedSelectedScreenBoundsRef.current = next;
    onSelectedScreenBoundsChange(next);
  }, [
    frameRef,
    nodeSizeById,
    onSelectedScreenBoundsChange,
    positionsById,
    selectedNodeId,
    structureKey,
  ]);

  useEffect(() => {
    reportSelectedScreenBounds();
  }, [flowInstanceRevision, reportSelectedScreenBounds, viewportBucket]);
  const latestExplicitRequestRef = useRef(explicitFocusRequest);
  latestExplicitRequestRef.current = explicitFocusRequest;
  const latestReadyCallbackRef = useRef(onBaseLayoutReady);
  latestReadyCallbackRef.current = onBaseLayoutReady;
  const lastCompletedViewportActionRef = useRef<AutomaticViewportAction | null>(null);
  const inFlightViewportActionRef = useRef<AutomaticViewportAction | null>(null);
  const lastEmittedReadyKeyRef = useRef<string | null>(null);
  const viewportTransformGenerationRef = useRef(0);
  const latestViewportIntentRef = useRef<AuthoritativeViewportIntent | null>(null);
  const completedViewportGenerationRef = useRef<number | null>(null);
  const automaticActionGenerationRef = useRef(0);
  const latestAutomaticActionGenerationRef = useRef<number | null>(null);

  const beginViewportTransform = useCallback((target: { x: number; y: number; zoom: number }) => {
    const generation = ++viewportTransformGenerationRef.current;
    latestViewportIntentRef.current = { generation, target };
    return generation;
  }, []);

  const settleViewportTransform = useCallback(async (
    binding: FlowInstanceBinding,
    generation: number,
    target: { x: number; y: number; zoom: number },
  ) => {
    if (!isCurrentFlowBinding(binding)) return;
    const latestIntent = latestViewportIntentRef.current;
    if (latestIntent?.generation === generation) {
      if (!isCurrentFlowBinding(binding)) return;
      completedViewportGenerationRef.current = generation;
      return;
    }
    if (!latestIntent || sameViewportTransform(latestIntent.target, target)) return;
    if (completedViewportGenerationRef.current !== latestIntent.generation) return;

    let replayedGeneration: number | null = null;
    while (true) {
      if (!isCurrentFlowBinding(binding)) return;
      const authoritative = latestViewportIntentRef.current;
      if (!authoritative || authoritative.generation === replayedGeneration) return;
      if (completedViewportGenerationRef.current !== authoritative.generation) return;
      replayedGeneration = authoritative.generation;
      await binding.instance.setViewport(authoritative.target);
      if (!isCurrentFlowBinding(binding)) return;
      if (latestViewportIntentRef.current?.generation === replayedGeneration) return;
    }
  }, [isCurrentFlowBinding]);

  const defaultViewportAnchorId = baseGraph.nodes[0]?.id;
  const readableViewport = useCallback((
    focusNodeId?: string,
    boundsMode: "base" | "visible" | "union" = "base",
    minReadableZoom?: number,
    viewportInsets?: Partial<GraphViewportInsets>,
    viewportSize?: { width: number; height: number },
  ) => {
    if (!viewportBucket || !layoutState || layoutState.structureKey !== structureKey) return null;
    const anchorNodeId = focusNodeId ?? (narrowViewport ? defaultViewportAnchorId : undefined);
    const focusBounds = anchorNodeId
      ? boundsForNode(anchorNodeId, positionsById, nodeSizeById)
      : undefined;
    const readable = computeReadableViewport({
      level: navigation.level,
      bounds: boundsMode === "visible"
        ? visibleBounds
        : boundsMode === "union"
          ? unionLayoutBounds(layoutState.bounds, visibleBounds)
          : layoutState.bounds,
      ...(focusBounds ? { focusBounds } : {}),
      viewport: viewportSize ?? viewportBucket,
      ...(viewportInsets ? { viewportInsets } : {}),
      padding: 0.16,
      maxZoom: 1.12,
      ...(minReadableZoom === undefined ? {} : { minReadableZoom }),
    });
    if (narrowViewport
      && focusNodeId === undefined
      && boundsMode === "base"
      && !readable.fullyFits
      && focusBounds) {
      return {
        ...readable.viewport,
        y: NARROW_DEFAULT_TOP_INSET - focusBounds.y * readable.viewport.zoom,
      };
    }
    return readable.viewport;
  }, [
    defaultViewportAnchorId,
    layoutState,
    narrowViewport,
    navigation.level,
    nodeSizeById,
    positionsById,
    structureKey,
    visibleBounds,
    viewportBucket,
  ]);

  useEffect(() => {
    const binding = flowInstanceBindingRef.current;
    if (!binding
      || binding.structureKey !== structureKey
      || !structureKey
      || !completedPositions
      || !viewportBucket) return;
    if (!isCurrentFlowBinding(binding)) return;
    const request = explicitFocusRequest;
    const action: AutomaticViewportAction = request
      ? {
          kind: "explicit",
          structureKey,
          actionKey: `${structureKey}:intent:${request.requestId}:${request.materializedNodeId}`,
          flowGeneration: binding.generation,
        }
      : {
          kind: "normal",
          structureKey,
          actionKey: `${structureKey}:viewport:${narrowViewport ? "narrow" : "full"}`,
          flowGeneration: binding.generation,
        };
    const isActionForBinding = (candidate: AutomaticViewportAction | null) => candidate
      ? candidate.flowGeneration === binding.generation
        && candidate.structureKey === binding.structureKey
      : false;

    if (!request) {
      const previous = lastCompletedViewportActionRef.current;
      const inFlight = inFlightViewportActionRef.current;
      if ((isActionForBinding(previous) && previous?.kind === "explicit")
        || (isActionForBinding(inFlight) && inFlight?.kind === "explicit")) return;
    }
    const completedAction = lastCompletedViewportActionRef.current;
    const inFlightAction = inFlightViewportActionRef.current;
    if ((isActionForBinding(completedAction) && completedAction?.actionKey === action.actionKey)
      || (isActionForBinding(inFlightAction) && inFlightAction?.actionKey === action.actionKey)) return;
    const target = readableViewport(request?.materializedNodeId, request ? "union" : "base");
    if (!target) return;
    if (!isCurrentFlowBinding(binding)) return;
    const transformGeneration = beginViewportTransform(target);
    const automaticGeneration = ++automaticActionGenerationRef.current;
    latestAutomaticActionGenerationRef.current = automaticGeneration;
    inFlightViewportActionRef.current = action;

    void binding.instance.setViewport(target).then(async () => {
      if (!isCurrentFlowBinding(binding)) return;
      await settleViewportTransform(binding, transformGeneration, target);
      if (!isCurrentFlowBinding(binding)) return;
      if (latestAutomaticActionGenerationRef.current !== automaticGeneration) return;
      if (isActionForBinding(inFlightViewportActionRef.current)
        && inFlightViewportActionRef.current?.actionKey === action.actionKey) {
        inFlightViewportActionRef.current = null;
      }
      lastCompletedViewportActionRef.current = action;
      if (!request || latestStructureKeyRef.current !== structureKey) return;
      const latest = latestExplicitRequestRef.current;
      if (!latest
        || latest.requestId !== request.requestId
        || latest.materializedNodeId !== request.materializedNodeId) return;
      const readyKey = `${request.requestId}:${request.materializedNodeId}`;
      if (lastEmittedReadyKeyRef.current === readyKey) return;
      lastEmittedReadyKeyRef.current = readyKey;
      latestReadyCallbackRef.current({
        requestId: request.requestId,
        structureKey,
        materializedNodeId: request.materializedNodeId,
      });
    });
  }, [
    completedPositions,
    beginViewportTransform,
    explicitFocusRequest,
    flowInstanceRevision,
    isCurrentFlowBinding,
    narrowViewport,
    readableViewport,
    settleViewportTransform,
    structureKey,
    viewportBucket,
  ]);

  const fitGraph = useCallback(() => {
    const target = readableViewport(undefined, "visible", 0.08, {
      top: fitViewportInsets?.top ?? 0,
      right: Math.max(
        fitViewportInsets?.right ?? 0,
        showMinimap && !narrowViewport ? MINIMAP_RIGHT_SAFE_INSET : 0,
      ),
      bottom: Math.max(
        fitViewportInsets?.bottom ?? 0,
        showMinimap && narrowViewport ? NARROW_MINIMAP_BOTTOM_SAFE_INSET : 0,
      ),
      left: fitViewportInsets?.left ?? 0,
    }, rawViewportSizeRef.current ?? undefined);
    const binding = flowInstanceBindingRef.current;
    if (!target
      || !binding
      || binding.structureKey !== structureKey
      || !isCurrentFlowBinding(binding)) return;
    const transformGeneration = beginViewportTransform(target);
    void binding.instance.setViewport(target).then(() => (
      settleViewportTransform(binding, transformGeneration, target)
    ));
  }, [
    beginViewportTransform,
    fitViewportInsets,
    isCurrentFlowBinding,
    narrowViewport,
    readableViewport,
    settleViewportTransform,
    showMinimap,
    structureKey,
  ]);

  if (semanticGraph.nodes.length === 0) {
    return (
      <div className="uc-semantic-canvas uc-semantic-canvas--state">
        <p role="status" aria-live="polite" className="uc-panel px-4 py-3 text-sm text-text-muted">
          {emptyNotice ?? "当前层级没有可显示的图谱元素。"}
        </p>
      </div>
    );
  }
  if (!structureKey || !completedPositions) {
    return (
      <div className="uc-semantic-canvas uc-semantic-canvas--state">
        {layoutFailureKey === structureKey && structureKey ? (
          <p role="alert" className="uc-panel px-4 py-3 text-sm text-text-muted">
            图谱布局计算失败，请切换层级后重试。
          </p>
        ) : (
          <p role="status" aria-live="polite" className="uc-panel px-4 py-3 text-sm text-text-muted">
            正在计算图谱布局…
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className="uc-semantic-canvas"
      data-graph-structure-key={structureKey}
      data-zoom-band={nodeDisplayBand}
      data-layout-orientation={layoutOrientation}
    >
      <FlowMountBoundary
        structureKey={structureKey}
        createGeneration={createFlowMountGeneration}
        onActivate={activateFlowMount}
        onStructureChange={updateFlowMountStructure}
        onDeactivate={deactivateFlowMount}
        onInit={bindFlowInstance}
      >
        {(onInit) => (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={onInit}
            onMoveEnd={(_, viewport) => {
              setZoomBand(graphSemanticZoomBand(viewport.zoom));
              reportSelectedScreenBounds();
            }}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onPaneClick={onPaneClick}
            onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
            onEdgeMouseLeave={(_, edge) => setHoveredEdgeId((current) => current === edge.id ? null : current)}
            nodesFocusable={false}
            nodesDraggable={false}
            nodesConnectable={false}
            ariaLabelConfig={REACT_FLOW_ARIA_LABEL_CONFIG}
            minZoom={0.08}
            maxZoom={1.7}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="var(--color-graph-grid)" />
            {showControls && (
              <Controls
                position={(fitViewportInsets?.left ?? 0) > 0 ? "top-right" : "bottom-left"}
                showFitView={false}
                showInteractive={false}
              >
                <ControlButton onClick={fitGraph} title="适应视图" aria-label="适应视图">
                  适
                </ControlButton>
              </Controls>
            )}
            {showMinimap && (
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) => {
                  const data = node.data as SemanticNodeData | undefined;
                  return data ? GROUP_COLORS[data.group] : "var(--color-text-muted)";
                }}
                maskColor="var(--color-graph-minimap-mask)"
              />
            )}
          </ReactFlow>
        )}
      </FlowMountBoundary>
      {layoutState?.degraded && (
        <p role="status" aria-live="polite" className="uc-graph-layout-status">
          图谱布局已降级为稳定网格
        </p>
      )}
    </div>
  );
}
