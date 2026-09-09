import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KnowledgeGraph } from "@understand-code/core/types";
import {
  buildHierarchicalSemanticGraph,
  buildGraphHierarchyIndex,
  createHierarchicalGraphProjectionContext,
  type GraphExplorerDisplayMode,
  type GraphExplorerNavigation,
  type GraphHierarchyIndex,
  type HierarchicalSemanticGraphNode,
} from "../../graphExplorer/hierarchicalGraph";
import {
  buildGraphQuickJumpItems,
  resolveGraphNavigationIntent,
  type GraphNavigationIntent,
} from "../../graphExplorer/graphQuickJump";
import { useDashboardStore } from "../../store";
import { useIsMobile } from "../../hooks/useIsMobile";
import type { WikiTarget } from "../../wiki/wikiContent";
import type { WikiRuntimeIndex } from "../../wiki/wikiIndex";
import GraphCoverageLegend from "./GraphCoverageLegend";
import GraphDetailsRail, { resolveGraphInspectorSide } from "./GraphDetailsRail";
import GraphModeToolbar from "./GraphModeToolbar";
import { GraphQuickJump } from "./GraphQuickJump";
import SemanticGraphCanvas, {
  type GraphBaseLayoutReady,
  type GraphSelectedScreenBounds,
} from "./SemanticGraphCanvas";
import {
  availableGraphModes,
  buildGraphExplorerView,
  graphLayoutRevision,
  normalizeGraphModeForOptions,
} from "./graphExplorerModel";

interface GraphExplorerProps {
  onSelectWikiTarget: (target: WikiTarget) => unknown;
  onRequestGlobalSearch: () => void;
  focusNodeId?: string | null;
  onSelectedNodeChange?: (nodeId: string | null) => void;
}

const OVERVIEW_NAVIGATION: GraphExplorerNavigation = { level: "overview" };
const MISSING_WIKI_FOCUS_NOTICE = "未找到可定位的图谱对象，已保留最近层级。";
const GRAPH_INSPECTOR_WIDTH = 360;
const GRAPH_INSPECTOR_SAFE_INSET = 384;
const MOBILE_GRAPH_PATH_NODE_LIMIT = 24;
let graphInstanceSequence = 0;

export function boundMobileGraphPathNodes<T>(nodes: readonly T[]): readonly T[] {
  return nodes.slice(0, MOBILE_GRAPH_PATH_NODE_LIMIT);
}

export interface PendingGraphNavigationRequest {
  requestId: number;
  intent: GraphNavigationIntent;
}

interface LatestGraphLayoutReadyState {
  pending: PendingGraphNavigationRequest | null;
  semanticNodeIds: ReadonlySet<string>;
  clearedSelectionContextKey: string;
}

function sameNavigation(
  left: GraphExplorerNavigation,
  right: GraphExplorerNavigation,
): boolean {
  return left.level === right.level
    && left.scopeId === right.scopeId
    && left.clusterId === right.clusterId
    && left.fileId === right.fileId;
}

export function nearestValidNavigation(
  hierarchyIndex: GraphHierarchyIndex,
  navigation: GraphExplorerNavigation,
): GraphExplorerNavigation {
  if (navigation.level === "overview") return OVERVIEW_NAVIGATION;
  const scopeId = navigation.scopeId;
  const scope = scopeId ? hierarchyIndex.scopeById.get(scopeId) : undefined;
  if (!scope || !hierarchyIndex.scopes.some((candidate) => candidate.id === scope.id)) {
    return OVERVIEW_NAVIGATION;
  }
  const scopeNavigation: GraphExplorerNavigation = { level: "scope", scopeId };
  if (navigation.level === "scope") return scopeNavigation;
  const clusterId = navigation.clusterId;
  const cluster = clusterId ? hierarchyIndex.clusterById.get(clusterId) : undefined;
  if (!cluster || cluster.scopeId !== scopeId || !scope.clusterIds.includes(cluster.id)) {
    return scopeNavigation;
  }
  const clusterNavigation: GraphExplorerNavigation = { level: "cluster", scopeId, clusterId };
  if (navigation.level === "cluster") return clusterNavigation;
  const fileId = navigation.fileId;
  const fileLocation = fileId ? hierarchyIndex.fileLocationById.get(fileId) : undefined;
  const fileNode = fileId ? hierarchyIndex.nodeById.get(fileId) : undefined;
  if (!fileLocation
    || fileNode?.type !== "file"
    || fileLocation.scopeId !== scopeId
    || fileLocation.clusterId !== clusterId
    || fileLocation.fileId !== fileId
    || !scope.nodeIds.includes(fileId)
    || !cluster.fileIds.includes(fileId)
    || !cluster.nodeIds.includes(fileId)) {
    return clusterNavigation;
  }
  return { level: "file", scopeId, clusterId, fileId };
}

export function selectionIsNaturalInBase(input: {
  graph: KnowledgeGraph;
  hierarchyIndex: GraphHierarchyIndex;
  wikiIndex?: WikiRuntimeIndex;
  mode: GraphExplorerDisplayMode;
  navigation: GraphExplorerNavigation;
  selectedNodeId: string | null;
}): boolean {
  if (!input.selectedNodeId) return false;
  return buildHierarchicalSemanticGraph({
    graph: input.graph,
    hierarchyIndex: input.hierarchyIndex,
    wikiIndex: input.wikiIndex,
    mode: input.mode,
    navigation: input.navigation,
    materializedNodeId: null,
  }).nodes.some((node) => node.id === input.selectedNodeId);
}

export function isGraphNavigationIntentValid(input: {
  graph: KnowledgeGraph;
  hierarchyIndex: GraphHierarchyIndex;
  intent: GraphNavigationIntent;
}): boolean {
  const resolved = resolveGraphNavigationIntent({
    graph: input.graph,
    hierarchyIndex: input.hierarchyIndex,
    objectId: input.intent.selectionId,
    source: input.intent.source,
  });
  return Boolean(
    resolved
    && resolved.materializedNodeId === input.intent.materializedNodeId
    && resolved.selectionId === input.intent.selectionId
    && sameNavigation(resolved.navigation, input.intent.navigation),
  );
}

export function nextPendingNavigationRequest(
  currentRequestId: number,
  intent: GraphNavigationIntent,
): PendingGraphNavigationRequest {
  return { requestId: currentRequestId + 1, intent };
}

export function consumeGraphFocusRevision(
  lastConsumedRevision: number,
  currentRevision: number,
  graphFocusPageId: string | null,
): { nextConsumedRevision: number; shouldApply: boolean } {
  return {
    nextConsumedRevision: Math.max(lastConsumedRevision, currentRevision),
    shouldApply: Boolean(graphFocusPageId && currentRevision > lastConsumedRevision),
  };
}

export function resolveWikiFocusIntent(input: {
  graph: KnowledgeGraph;
  hierarchyIndex: GraphHierarchyIndex;
  nodeIds: readonly string[];
}): { intent: GraphNavigationIntent | null; notice: string | null } {
  for (const objectId of input.nodeIds) {
    const intent = resolveGraphNavigationIntent({
      graph: input.graph,
      hierarchyIndex: input.hierarchyIndex,
      objectId,
      source: "wiki-focus",
    });
    if (intent) return { intent, notice: null };
  }
  return { intent: null, notice: MISSING_WIKI_FOCUS_NOTICE };
}

export function resolveWikiFocusIntentFromIndex(
  nodeIds: readonly string[],
  navigationIntentById: ReadonlyMap<string, GraphNavigationIntent>,
): { intent: GraphNavigationIntent | null; notice: string | null } {
  for (const objectId of nodeIds) {
    const indexed = navigationIntentById.get(objectId);
    if (indexed) return { intent: { ...indexed, source: "wiki-focus" }, notice: null };
  }
  return { intent: null, notice: MISSING_WIKI_FOCUS_NOTICE };
}

export function buildCanvasViewKey(input: {
  graphInstanceToken: string;
  layoutRevision: string;
  mode: GraphExplorerDisplayMode;
  navigation: GraphExplorerNavigation;
  materializedNodeId: string | null;
}): string {
  return JSON.stringify([
    input.graphInstanceToken,
    input.layoutRevision,
    input.mode,
    input.navigation.level,
    input.navigation.scopeId ?? "",
    input.navigation.clusterId ?? "",
    input.navigation.fileId ?? "",
    input.materializedNodeId ?? "",
  ]);
}

export function shouldClearVisibleSelectionProvenance(
  recordedContextKey: string | null,
  currentContextKey: string,
): boolean {
  return recordedContextKey !== null && recordedContextKey !== currentContextKey;
}

export default function GraphExplorer({
  onSelectWikiTarget,
  onRequestGlobalSearch,
  focusNodeId = null,
  onSelectedNodeChange,
}: GraphExplorerProps) {
  const graph = useDashboardStore((state) => state.graph);
  const wikiIndex = useDashboardStore((state) => state.wikiIndex);
  const storedMode = useDashboardStore((state) => state.graphExplorerMode);
  const setGraphExplorerMode = useDashboardStore((state) => state.setGraphExplorerMode);
  const focusNodeIds = useDashboardStore((state) => state.graphFocusNodeIds);
  const graphFocusPageId = useDashboardStore((state) => state.graphFocusPageId);
  const graphFocusRevision = useDashboardStore((state) => state.graphFocusRevision);
  const selectedNodeId = useDashboardStore((state) => state.selectedNodeId);
  const selectNode = useDashboardStore((state) => state.selectNode);
  const openWikiForGraphNode = useDashboardStore((state) => state.openWikiForGraphNode);
  const [navigation, setNavigation] = useState<GraphExplorerNavigation>(OVERVIEW_NAVIGATION);
  const [materializedNodeId, setMaterializedNodeId] = useState<string | null>(null);
  const [pendingNavigationRequest, setPendingNavigationRequest] =
    useState<PendingGraphNavigationRequest | null>(null);
  const [wikiFocusNotice, setWikiFocusNotice] = useState<string | null>(null);
  const [visibleSelectedNodeId, setVisibleSelectedNodeId] = useState<string | null>(null);
  const [visibleSelectionContextKey, setVisibleSelectionContextKey] = useState<string | null>(null);
  const compact = useIsMobile(1024);
  const belowDesktop = useIsMobile(1280);
  const phone = useIsMobile(768);
  const [mobileCanvasRequested, setMobileCanvasRequested] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [quickJumpOpenRequestId, setQuickJumpOpenRequestId] = useState(0);
  const [showMinimap, setShowMinimap] = useState(() => !belowDesktop);
  const [inspectorOpen, setInspectorOpen] = useState(() => selectedNodeId !== null);
  const [selectedScreenBounds, setReportedSelectedScreenBounds] =
    useState<GraphSelectedScreenBounds | null>(null);
  const [rawFrameWidth, setRawFrameWidth] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const minimapUserPreferenceRef = useRef(false);
  const previousSelectedNodeIdRef = useRef(selectedNodeId);
  const latestSelectedNodeIdRef = useRef<string | null>(selectedNodeId);
  const focusRestoreFrameRef = useRef<number | null>(null);
  const navigationFocusFrameRef = useRef<number | null>(null);
  const pendingNavigationFocusRef = useRef(false);
  const currentBreadcrumbRef = useRef<HTMLSpanElement>(null);
  const navigationRequestSequence = useRef(0);
  const handledLayoutReadyRequestIdRef = useRef<number | null>(null);
  const failedMaterializationRequestIdRef = useRef<number | null>(null);
  const lastAppliedGraphFocusRevisionRef = useRef(0);
  const lastAppliedTaskFocusRef = useRef<string | null>(null);
  const previousGraphFocusPageIdRef = useRef<string | null>(null);
  const previousEffectiveModeRef = useRef<GraphExplorerDisplayMode | null>(null);
  const selectedNavigationSnapshotRef = useRef<{
    graphInstanceToken: string;
    selectedNodeId: string;
    intent: GraphNavigationIntent;
  } | null>(null);
  const layoutRevision = useMemo(
    () => graph ? graphLayoutRevision(graph) : "",
    [graph],
  );
  const graphInstanceToken = useMemo(
    () => graph ? `graph-${++graphInstanceSequence}` : "graph-none",
    [graph],
  );
  const hierarchyIndex = useMemo(
    () => graph ? buildGraphHierarchyIndex(graph) : null,
    [graph, layoutRevision],
  );
  const projectionContext = useMemo(
    () => graph ? createHierarchicalGraphProjectionContext({ graph, wikiIndex }) : null,
    [graph, layoutRevision, wikiIndex],
  );

  const modeOptions = useMemo(
    () => graph ? availableGraphModes(graph, wikiIndex) : [],
    [graph, wikiIndex],
  );
  const effectiveMode = useMemo(
    () => normalizeGraphModeForOptions(storedMode, modeOptions),
    [modeOptions, storedMode],
  );
  const quickJumpItems = useMemo(
    () => graph && hierarchyIndex
      ? buildGraphQuickJumpItems({ graph, hierarchyIndex })
      : [],
    [graph, hierarchyIndex],
  );
  const navigationIntentById = useMemo(
    () => new Map(quickJumpItems.map((item) => [item.id, item.intent])),
    [quickJumpItems],
  );
  const safeNavigation = useMemo(
    () => hierarchyIndex
      ? nearestValidNavigation(hierarchyIndex, navigation)
      : OVERVIEW_NAVIGATION,
    [hierarchyIndex, navigation],
  );
  const materializedIntent = materializedNodeId
    ? navigationIntentById.get(materializedNodeId)
    : null;
  const materializedNodeMatchesNavigation = !materializedNodeId || Boolean(
    materializedIntent
    && materializedIntent.materializedNodeId === materializedNodeId
    && sameNavigation(materializedIntent.navigation, safeNavigation),
  );
  const safeMaterializedNodeId = materializedNodeMatchesNavigation ? materializedNodeId : null;
  const pendingIndexedIntent = pendingNavigationRequest
    ? navigationIntentById.get(pendingNavigationRequest.intent.selectionId)
    : null;
  const safePendingNavigationRequest = pendingNavigationRequest && pendingIndexedIntent
    && pendingIndexedIntent.materializedNodeId === pendingNavigationRequest.intent.materializedNodeId
    && pendingIndexedIntent.selectionId === pendingNavigationRequest.intent.selectionId
    && sameNavigation(pendingIndexedIntent.navigation, pendingNavigationRequest.intent.navigation)
    && sameNavigation(pendingNavigationRequest.intent.navigation, safeNavigation)
    && pendingNavigationRequest.intent.materializedNodeId === safeMaterializedNodeId
    ? pendingNavigationRequest
    : null;
  const currentSelectedIntent = selectedNodeId
    ? navigationIntentById.get(selectedNodeId)
    : null;
  const previousSelectedSnapshot = selectedNavigationSnapshotRef.current;
  const selectedAncestorChanged = Boolean(
    selectedNodeId
    && currentSelectedIntent
    && previousSelectedSnapshot?.selectedNodeId === selectedNodeId
    && previousSelectedSnapshot.graphInstanceToken !== graphInstanceToken
    && (
      previousSelectedSnapshot.intent.materializedNodeId !== currentSelectedIntent.materializedNodeId
      || !sameNavigation(previousSelectedSnapshot.intent.navigation, currentSelectedIntent.navigation)
    ),
  );
  const selectedNodeStillExists = !selectedNodeId || Boolean(
    currentSelectedIntent && !selectedAncestorChanged,
  );
  const safeSelectedNodeId = selectedNodeStillExists ? selectedNodeId : null;
  const selectionContextKeyFor = useCallback((pending: PendingGraphNavigationRequest | null) => JSON.stringify([
    graphInstanceToken,
    layoutRevision,
    effectiveMode,
    safeNavigation,
    safeMaterializedNodeId,
    pending ? [pending.requestId, pending.intent] : null,
    graphFocusRevision,
    graphFocusPageId,
  ]), [
    effectiveMode,
    graphFocusPageId,
    graphFocusRevision,
    graphInstanceToken,
    layoutRevision,
    safeMaterializedNodeId,
    safeNavigation,
  ]);
  const selectionContextKey = selectionContextKeyFor(safePendingNavigationRequest);
  latestSelectedNodeIdRef.current = safeSelectedNodeId;

  useEffect(() => {
    if (!minimapUserPreferenceRef.current) setShowMinimap(!belowDesktop);
  }, [belowDesktop]);

  useEffect(() => {
    const previous = previousSelectedNodeIdRef.current;
    previousSelectedNodeIdRef.current = safeSelectedNodeId;
    if (safeSelectedNodeId === null) {
      setInspectorOpen(false);
      setReportedSelectedScreenBounds(null);
    } else if (safeSelectedNodeId !== previous) {
      setInspectorOpen(true);
    }
  }, [safeSelectedNodeId]);

  const restoreSelectedNodeFocus = useCallback(() => {
    if (focusRestoreFrameRef.current !== null) {
      cancelAnimationFrame(focusRestoreFrameRef.current);
    }
    const expectedNodeId = latestSelectedNodeIdRef.current;
    if (!expectedNodeId) return;
    focusRestoreFrameRef.current = requestAnimationFrame(() => {
      focusRestoreFrameRef.current = null;
      if (latestSelectedNodeIdRef.current !== expectedNodeId) return;
      const graphNode = [...document.querySelectorAll<HTMLElement>("[data-graph-node-id]")]
        .find((candidate) => candidate.dataset.graphNodeId === expectedNodeId);
      graphNode?.focus({ preventScroll: true });
    });
  }, []);

  const closeInspector = useCallback(() => {
    setInspectorOpen(false);
    restoreSelectedNodeFocus();
  }, [restoreSelectedNodeFocus]);

  useEffect(() => () => {
    if (focusRestoreFrameRef.current !== null) {
      cancelAnimationFrame(focusRestoreFrameRef.current);
    }
    if (navigationFocusFrameRef.current !== null) {
      cancelAnimationFrame(navigationFocusFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (!inspectorOpen) return;
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest(".uc-graph-quick-jump")) return;
      event.preventDefault();
      closeInspector();
    };
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => document.removeEventListener("keydown", onDocumentKeyDown);
  }, [closeInspector, inspectorOpen]);

  useEffect(() => {
    if (storedMode !== effectiveMode) setGraphExplorerMode(effectiveMode);
  }, [effectiveMode, setGraphExplorerMode, storedMode]);

  useEffect(() => {
    if (!hierarchyIndex) return;
    if (!sameNavigation(navigation, safeNavigation)) setNavigation(safeNavigation);
    if (materializedNodeId !== safeMaterializedNodeId) setMaterializedNodeId(safeMaterializedNodeId);
    if (!selectedNodeStillExists) selectNode(null);
  }, [
    hierarchyIndex,
    materializedNodeId,
    navigation,
    safeMaterializedNodeId,
    safeNavigation,
    selectNode,
    selectedNodeStillExists,
  ]);

  useEffect(() => {
    selectedNavigationSnapshotRef.current = selectedNodeId && currentSelectedIntent
      ? { graphInstanceToken, selectedNodeId, intent: currentSelectedIntent }
      : null;
  }, [currentSelectedIntent, graphInstanceToken, selectedNodeId]);

  useEffect(() => {
    if (!shouldClearVisibleSelectionProvenance(
      visibleSelectionContextKey,
      selectionContextKey,
    )) return;
    setVisibleSelectedNodeId(null);
    setVisibleSelectionContextKey(null);
  }, [selectionContextKey, visibleSelectionContextKey]);

  useEffect(() => {
    if (visibleSelectedNodeId === null || visibleSelectedNodeId === safeSelectedNodeId) return;
    setVisibleSelectedNodeId(null);
    setVisibleSelectionContextKey(null);
  }, [safeSelectedNodeId, visibleSelectedNodeId]);

  const selectedNodeWasVisible = Boolean(
    safeSelectedNodeId
    && visibleSelectedNodeId === safeSelectedNodeId
    && visibleSelectionContextKey === selectionContextKey,
  );

  const view = useMemo(
    () => graph && hierarchyIndex
      ? buildGraphExplorerView({
          graph,
          hierarchyIndex,
          wikiIndex,
          projectionContext: projectionContext ?? undefined,
          mode: effectiveMode,
          selectedNodeId: safeSelectedNodeId,
          selectedNodeWasVisible,
          navigation: safeNavigation,
          materializedNodeId: safeMaterializedNodeId,
        })
      : null,
    [
      effectiveMode,
      graph,
      hierarchyIndex,
      projectionContext,
      safeMaterializedNodeId,
      safeNavigation,
      safeSelectedNodeId,
      selectedNodeWasVisible,
      wikiIndex,
    ],
  );
  const latestLayoutReadyStateRef = useRef<LatestGraphLayoutReadyState>({
    pending: null,
    semanticNodeIds: new Set(),
    clearedSelectionContextKey: selectionContextKeyFor(null),
  });
  latestLayoutReadyStateRef.current = {
    pending: safePendingNavigationRequest,
    semanticNodeIds: new Set(view?.semanticGraph.nodes.map((node) => node.id) ?? []),
    clearedSelectionContextKey: selectionContextKeyFor(null),
  };

  useEffect(() => {
    if (!view || !pendingNavigationRequest) return;
    const { requestId, intent } = pendingNavigationRequest;
    if (view.semanticGraph.nodes.some((node) => node.id === intent.materializedNodeId)) {
      if (!safePendingNavigationRequest) {
        setPendingNavigationRequest((current) => current?.requestId === requestId ? null : current);
      }
      return;
    }
    if (failedMaterializationRequestIdRef.current === requestId) return;

    failedMaterializationRequestIdRef.current = requestId;
    setPendingNavigationRequest((current) => current?.requestId === requestId ? null : current);
    setMaterializedNodeId((current) => current === intent.materializedNodeId ? null : current);
    setWikiFocusNotice(MISSING_WIKI_FOCUS_NOTICE);
    setVisibleSelectedNodeId(null);
    setVisibleSelectionContextKey(null);
    selectNode(null);
  }, [pendingNavigationRequest, safePendingNavigationRequest, selectNode, view]);

  const explicitFocusRequest = useMemo(() => safePendingNavigationRequest
    ? {
        requestId: safePendingNavigationRequest.requestId,
        materializedNodeId: safePendingNavigationRequest.intent.materializedNodeId,
      }
    : null, [safePendingNavigationRequest]);

  const handleBaseLayoutReady = useCallback((ready: GraphBaseLayoutReady) => {
    const current = latestLayoutReadyStateRef.current;
    const pending = current.pending;
    if (!pending) return;
    if (handledLayoutReadyRequestIdRef.current === ready.requestId) return;
    if (
      ready.requestId !== pending.requestId
      || ready.materializedNodeId !== pending.intent.materializedNodeId
    ) return;
    if (!current.semanticNodeIds.has(ready.materializedNodeId)) return;
    if (!current.semanticNodeIds.has(pending.intent.selectionId)) return;

    handledLayoutReadyRequestIdRef.current = ready.requestId;
    setPendingNavigationRequest((current) => current?.requestId === ready.requestId ? null : current);
    setWikiFocusNotice(null);
    setVisibleSelectedNodeId(pending.intent.selectionId);
    setVisibleSelectionContextKey(current.clearedSelectionContextKey);
    setInspectorOpen(true);
    selectNode(pending.intent.selectionId);
  }, [selectNode]);

  const clearVisibleSelectionProvenance = useCallback(() => {
    setVisibleSelectedNodeId(null);
    setVisibleSelectionContextKey(null);
  }, []);

  const applyNavigationIntent = useCallback((intent: GraphNavigationIntent) => {
    const pending = nextPendingNavigationRequest(navigationRequestSequence.current, intent);
    navigationRequestSequence.current = pending.requestId;
    setNavigation(intent.navigation);
    setMaterializedNodeId(intent.materializedNodeId);
    setPendingNavigationRequest(pending);
    setWikiFocusNotice(null);
    clearVisibleSelectionProvenance();
    selectNode(null);
  }, [clearVisibleSelectionProvenance, selectNode]);

  useEffect(() => {
    if (!focusNodeId || lastAppliedTaskFocusRef.current === focusNodeId) return;
    const intent = navigationIntentById.get(focusNodeId);
    if (intent) {
      lastAppliedTaskFocusRef.current = focusNodeId;
      if (phone) setMobileCanvasRequested(true);
      applyNavigationIntent(intent);
      return;
    }
    if (!graph) return;
    lastAppliedTaskFocusRef.current = focusNodeId;
    setWikiFocusNotice("任务证据引用的图谱节点当前不可用。");
    selectNode(null);
  }, [applyNavigationIntent, focusNodeId, graph, navigationIntentById, phone, selectNode]);

  useEffect(() => {
    if (focusNodeId) return;
    lastAppliedTaskFocusRef.current = null;
  }, [focusNodeId]);

  const selectVisibleNode = useCallback((nodeId: string | null) => {
    const isVisible = Boolean(
      nodeId && view?.semanticGraph.nodes.some((node) => node.id === nodeId),
    );
    setPendingNavigationRequest(null);
    setWikiFocusNotice(null);
    setVisibleSelectedNodeId(isVisible ? nodeId : null);
    setVisibleSelectionContextKey(isVisible ? selectionContextKeyFor(null) : null);
    setInspectorOpen(nodeId !== null);
    selectNode(nodeId);
    onSelectedNodeChange?.(nodeId);
  }, [onSelectedNodeChange, selectNode, selectionContextKeyFor, view]);

  const clearSelection = useCallback(() => {
    setPendingNavigationRequest(null);
    setWikiFocusNotice(null);
    setVisibleSelectedNodeId(null);
    setVisibleSelectionContextKey(null);
    setReportedSelectedScreenBounds(null);
    setInspectorOpen(false);
    selectNode(null);
    onSelectedNodeChange?.(null);
  }, [onSelectedNodeChange, selectNode]);
  const handleGraphQuickJumpOpenRequest = useCallback((handledRequestId: number) => {
    setQuickJumpOpenRequestId((currentRequestId) =>
      currentRequestId === handledRequestId ? 0 : currentRequestId);
  }, []);

  const setSelectedScreenBounds = useCallback((bounds: GraphSelectedScreenBounds | null) => {
    setReportedSelectedScreenBounds(bounds);
  }, []);

  const transitionNavigation = useCallback((
    nextNavigation: GraphExplorerNavigation,
    nextMode: GraphExplorerDisplayMode = effectiveMode,
  ) => {
    if (!graph || !hierarchyIndex) return;
    const destination = nearestValidNavigation(hierarchyIndex, nextNavigation);
    const retainSelection = selectionIsNaturalInBase({
      graph,
      hierarchyIndex,
      wikiIndex,
      mode: nextMode,
      navigation: destination,
      selectedNodeId: safeSelectedNodeId,
    });
    setNavigation(destination);
    setMaterializedNodeId(null);
    setPendingNavigationRequest(null);
    setWikiFocusNotice(null);
    clearVisibleSelectionProvenance();
    if (!retainSelection) selectNode(null);
  }, [
    clearVisibleSelectionProvenance,
    effectiveMode,
    graph,
    hierarchyIndex,
    safeSelectedNodeId,
    selectNode,
    wikiIndex,
  ]);

  const transitionNavigationAndFocus = useCallback((nextNavigation: GraphExplorerNavigation) => {
    pendingNavigationFocusRef.current = true;
    transitionNavigation(nextNavigation);
  }, [transitionNavigation]);

  useEffect(() => {
    if (!pendingNavigationFocusRef.current) return;
    pendingNavigationFocusRef.current = false;
    if (navigationFocusFrameRef.current !== null) {
      cancelAnimationFrame(navigationFocusFrameRef.current);
    }
    navigationFocusFrameRef.current = requestAnimationFrame(() => {
      navigationFocusFrameRef.current = null;
      currentBreadcrumbRef.current?.focus({ preventScroll: true });
    });
  }, [safeNavigation]);

  const changeMode = useCallback((mode: GraphExplorerDisplayMode) => {
    previousEffectiveModeRef.current = mode;
    setGraphExplorerMode(mode);
    transitionNavigation(safeNavigation, mode);
  }, [safeNavigation, setGraphExplorerMode, transitionNavigation]);

  useEffect(() => {
    const previousMode = previousEffectiveModeRef.current;
    previousEffectiveModeRef.current = effectiveMode;
    if (previousMode === null || previousMode === effectiveMode) return;
    transitionNavigation(safeNavigation, effectiveMode);
  }, [effectiveMode, safeNavigation, transitionNavigation]);

  useEffect(() => {
    if (!graph || !hierarchyIndex) return;
    const previousGraphFocusPageId = previousGraphFocusPageIdRef.current;
    previousGraphFocusPageIdRef.current = graphFocusPageId;
    if (!graphFocusPageId && previousGraphFocusPageId) setWikiFocusNotice(null);
    const focusRevisionTransition = consumeGraphFocusRevision(
      lastAppliedGraphFocusRevisionRef.current,
      graphFocusRevision,
      graphFocusPageId,
    );
    lastAppliedGraphFocusRevisionRef.current = focusRevisionTransition.nextConsumedRevision;
    if (!focusRevisionTransition.shouldApply) return;
    const resolution = resolveWikiFocusIntentFromIndex(focusNodeIds, navigationIntentById);
    if (resolution.intent) {
      applyNavigationIntent(resolution.intent);
      return;
    }
    setNavigation((current) => nearestValidNavigation(hierarchyIndex, current));
    setMaterializedNodeId(null);
    setPendingNavigationRequest(null);
    setWikiFocusNotice(resolution.notice);
    clearVisibleSelectionProvenance();
    selectNode(null);
  }, [
    applyNavigationIntent,
    clearVisibleSelectionProvenance,
    focusNodeIds,
    graph,
    graphFocusPageId,
    graphFocusRevision,
    hierarchyIndex,
    navigationIntentById,
    selectNode,
  ]);

  const openOverview = useCallback(() => {
    transitionNavigationAndFocus(OVERVIEW_NAVIGATION);
  }, [transitionNavigationAndFocus]);

  const openScope = useCallback((scopeId: string) => {
    transitionNavigationAndFocus({ level: "scope", scopeId });
  }, [transitionNavigationAndFocus]);

  const openCluster = useCallback((scopeId: string, clusterId: string) => {
    transitionNavigationAndFocus({ level: "cluster", scopeId, clusterId });
  }, [transitionNavigationAndFocus]);

  const openFile = useCallback((scopeId: string, clusterId: string, fileId: string) => {
    transitionNavigationAndFocus({ level: "file", scopeId, clusterId, fileId });
  }, [transitionNavigationAndFocus]);

  const selection = view?.selection;
  const openSelectionWikiTarget = useCallback((target: WikiTarget) => {
    if (selection?.kind === "raw") {
      const destination = openWikiForGraphNode(selection.id);
      return destination ? onSelectWikiTarget(destination) : null;
    }
    return onSelectWikiTarget(target);
  }, [onSelectWikiTarget, openWikiForGraphNode, selection]);

  if (!graph || !hierarchyIndex || !view) {
    return (
      <section aria-label="项目图谱" className="flex min-h-0 flex-1 items-center justify-center bg-root">
        <p className="uc-panel p-4 text-sm text-text-muted">尚未加载项目图谱。</p>
      </section>
    );
  }

  const presentation = view.semanticGraph.presentation;
  const notice = wikiFocusNotice ?? presentation.notice;
  const coverageAvailable = effectiveMode === "coverage"
    && modeOptions.some((option) => option.id === "coverage");
  const inspectorVisible = inspectorOpen && safeSelectedNodeId !== null;
  const inspectorSide = resolveGraphInspectorSide({
    selectedScreenBounds,
    frameWidth: rawFrameWidth,
    inspectorWidth: GRAPH_INSPECTOR_WIDTH,
    gap: 12,
    compact,
  });
  const fitViewportInsets = (
    inspectorVisible && !compact
      ? inspectorSide === "left"
        ? { left: GRAPH_INSPECTOR_SAFE_INSET }
        : { right: GRAPH_INSPECTOR_SAFE_INSET }
      : undefined
  );
  const requestGraphQuickJump = () => {
    if (compact) setToolsOpen(true);
    setQuickJumpOpenRequestId((requestId) => requestId + 1);
  };
  const mobilePathNodes = boundMobileGraphPathNodes(view.semanticGraph.nodes);
  const openMobilePathNode = (node: HierarchicalSemanticGraphNode) => {
    setMobileCanvasRequested(true);
    if (node.kind === "scope" && node.scopeId) {
      openScope(node.scopeId);
      return;
    }
    if (node.kind === "cluster" && node.scopeId && node.clusterId) {
      openCluster(node.scopeId, node.clusterId);
      return;
    }
    if (node.rawType === "file" && node.scopeId && node.clusterId) {
      openFile(node.scopeId, node.clusterId, node.id);
      return;
    }
    selectVisibleNode(node.id);
  };
  const showCanvas = !phone || mobileCanvasRequested;

  return (
    <section
      aria-label="项目图谱"
      className="uc-graph-explorer min-h-0 min-w-0 flex-1 overflow-x-hidden bg-root p-4 text-text-primary max-sm:p-3"
    >
      <div className="uc-graph-toolbar flex items-start justify-between gap-3 max-lg:flex-col">
        {!compact && (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <GraphModeToolbar mode={effectiveMode} options={modeOptions} onChangeMode={changeMode} />
            <GraphQuickJump
              items={quickJumpItems}
              onSelect={applyNavigationIntent}
              openRequestId={quickJumpOpenRequestId}
              onOpenRequestHandled={handleGraphQuickJumpOpenRequest}
            />
          </div>
        )}
        {belowDesktop && (
          <details
            className="uc-graph-tools"
            open={toolsOpen}
            onToggle={(event) => setToolsOpen(event.currentTarget.open)}
          >
            <summary>更多图谱工具</summary>
            <div className="uc-graph-tools__panel">
              {compact && (
                <div className="grid min-w-0 gap-2">
                  <GraphModeToolbar mode={effectiveMode} options={modeOptions} onChangeMode={changeMode} />
                  <GraphQuickJump
                    items={quickJumpItems}
                    onSelect={applyNavigationIntent}
                    openRequestId={quickJumpOpenRequestId}
                    onOpenRequestHandled={handleGraphQuickJumpOpenRequest}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  minimapUserPreferenceRef.current = true;
                  setShowMinimap((current) => !current);
                }}
              >
                {showMinimap ? "隐藏缩略图" : "显示缩略图"}
              </button>
              {phone && coverageAvailable && <GraphCoverageLegend />}
            </div>
          </details>
        )}
        {!phone && coverageAvailable && <GraphCoverageLegend />}
      </div>

      <div className="uc-panel flex min-w-0 flex-wrap items-center justify-between gap-3 px-3 py-2">
        <nav aria-label="图谱层级" className="uc-graph-breadcrumbs flex min-w-0 items-center gap-1 text-xs">
          {presentation.breadcrumbs.map((item, index) => {
            const isCurrent = index === presentation.breadcrumbs.length - 1;
            return (
              <span key={`${item.level}:${item.scopeId ?? ""}:${item.clusterId ?? ""}:${item.fileId ?? ""}`} className="flex shrink-0 items-center gap-1">
                {index > 0 && <span aria-hidden="true" className="text-text-muted">/</span>}
                {isCurrent ? (
                  <span
                    ref={currentBreadcrumbRef}
                    tabIndex={-1}
                    aria-current="page"
                    data-current-graph-level="true"
                    className="rounded font-semibold text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
                  >
                    {item.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => item.level === "overview"
                      ? openOverview()
                      : item.level === "scope" && item.scopeId
                        ? openScope(item.scopeId)
                        : item.level === "cluster" && item.scopeId && item.clusterId
                          ? openCluster(item.scopeId, item.clusterId)
                          : item.scopeId && item.clusterId && item.fileId
                            ? openFile(item.scopeId, item.clusterId, item.fileId)
                            : undefined}
                    className="min-h-11 min-w-11 rounded px-2.5 py-1.5 text-text-muted transition-colors hover:bg-elevated hover:text-text-primary"
                  >
                    {item.label}
                  </button>
                )}
              </span>
            );
          })}
        </nav>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
          <p>
            全图 {presentation.graphNodeCount ?? graph.nodes.length} 个节点；当前层级显示 {view.semanticGraph.nodes.length} 个对象
          </p>
          {presentation.aggregatedNodeCount !== undefined && presentation.aggregatedNodeCount > 0 && (
            <span>{presentation.aggregatedNodeCount} 个已聚合，可下钻</span>
          )}
          {presentation.filteredNodeCount !== undefined && presentation.filteredNodeCount > 0 && (
            <span>{presentation.filteredNodeCount} 个因当前模式隐藏</span>
          )}
          {presentation.truncatedNodeCount !== undefined && presentation.truncatedNodeCount > 0 && (
            <span>{presentation.truncatedNodeCount} 个受画布上限限制</span>
          )}
          <button
            type="button"
            onClick={requestGraphQuickJump}
            className="rounded border border-border-subtle px-2 py-1 font-semibold text-text-secondary transition-colors hover:border-accent/35 hover:text-accent"
          >
            浏览全部对象
          </button>
        </div>
      </div>

      {notice && view.semanticGraph.nodes.length > 0 && (
        <p role="status" aria-live="polite" className="uc-panel-muted px-3 py-2 text-sm text-text-muted">
          {notice}
        </p>
      )}

      <div
        className="uc-graph-frame"
        ref={frameRef}
        data-mobile-presentation={phone ? (showCanvas ? "canvas" : "path") : undefined}
      >
        {!showCanvas ? (
          <section
            className="uc-mobile-graph-path"
            aria-labelledby="mobile-graph-path-title"
            data-testid="mobile-graph-path"
          >
            <header>
              <p>移动端图谱</p>
              <h2 id="mobile-graph-path-title">先按路径理解，再进入画布</h2>
              <p>先查看当前层级的对象与说明；需要自由探索时再打开交互图谱。</p>
            </header>
            <ol aria-label="当前图谱路径对象">
              {mobilePathNodes.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => openMobilePathNode(node)}
                    data-testid="mobile-graph-path-node"
                    data-graph-node-id={node.id}
                  >
                    <strong>{node.label}</strong>
                    <span>{node.summary}</span>
                  </button>
                </li>
              ))}
            </ol>
            {view.semanticGraph.nodes.length > mobilePathNodes.length && (
              <p className="uc-mobile-graph-path__limit" role="status">
                当前层级对象较多，仅显示前 {MOBILE_GRAPH_PATH_NODE_LIMIT} 个；可进入交互图谱继续探索。
              </p>
            )}
            <button
              type="button"
              className="uc-mobile-graph-open-canvas"
              onClick={() => setMobileCanvasRequested(true)}
            >
              打开交互图谱
            </button>
          </section>
        ) : (
          <>
            {phone && (
              <button
                type="button"
                className="uc-mobile-graph-return-path"
                onClick={() => {
                  clearSelection();
                  setMobileCanvasRequested(false);
                }}
              >
                返回路径
              </button>
            )}
            <SemanticGraphCanvas
              frameRef={frameRef}
              baseGraph={view.baseGraph}
              semanticGraph={view.semanticGraph}
              graphRevision={layoutRevision}
              navigation={safeNavigation}
              displayMode={effectiveMode}
              explicitFocusRequest={explicitFocusRequest}
              onBaseLayoutReady={handleBaseLayoutReady}
              emptyNotice={notice}
              onOpenScope={openScope}
              onOpenCluster={openCluster}
              onOpenFile={openFile}
              onSelectNode={selectVisibleNode}
              onClearSelection={clearSelection}
              onFrameWidthChange={setRawFrameWidth}
              onSelectedScreenBoundsChange={setSelectedScreenBounds}
              showMinimap={showMinimap}
              showControls={(!phone || toolsOpen) && !(compact && inspectorVisible)}
              narrowViewport={phone}
              fitViewportInsets={fitViewportInsets}
            />
            <GraphDetailsRail
              view={view}
              open={inspectorVisible}
              side={inspectorSide}
              onClose={closeInspector}
              onSelectObject={selectVisibleNode}
              onOpenScope={openScope}
              onOpenCluster={openCluster}
              onOpenFile={openFile}
              onSelectWikiTarget={openSelectionWikiTarget}
              onRequestGlobalSearch={onRequestGlobalSearch}
              onRequestGraphQuickJump={requestGraphQuickJump}
            />
          </>
        )}
      </div>
    </section>
  );
}
