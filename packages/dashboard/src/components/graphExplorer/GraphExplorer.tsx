import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KnowledgeGraph } from "@understand-code/core/types";
import {
  buildHierarchicalSemanticGraph,
  buildGraphHierarchyIndex,
  type GraphExplorerDisplayMode,
  type GraphExplorerNavigation,
  type GraphHierarchyIndex,
} from "../../graphExplorer/hierarchicalGraph";
import {
  buildGraphQuickJumpItems,
  resolveGraphNavigationIntent,
  type GraphNavigationIntent,
} from "../../graphExplorer/graphQuickJump";
import { useDashboardStore } from "../../store";
import type { WikiTarget } from "../../wiki/wikiContent";
import type { WikiRuntimeIndex } from "../../wiki/wikiIndex";
import GraphCoverageLegend from "./GraphCoverageLegend";
import GraphDetailsRail from "./GraphDetailsRail";
import GraphModeToolbar from "./GraphModeToolbar";
import { GraphQuickJump } from "./GraphQuickJump";
import SemanticGraphCanvas from "./SemanticGraphCanvas";
import {
  availableGraphModes,
  buildGraphExplorerView,
  graphLayoutRevision,
  normalizeGraphModeForOptions,
} from "./graphExplorerModel";

interface GraphExplorerProps {
  onSelectWikiTarget: (target: WikiTarget) => unknown;
  onRequestGlobalSearch: () => void;
}

const OVERVIEW_NAVIGATION: GraphExplorerNavigation = { level: "overview" };
const MISSING_WIKI_FOCUS_NOTICE = "未找到可定位的图谱对象，已保留最近层级。";
let graphInstanceSequence = 0;

export interface PendingGraphNavigationRequest {
  requestId: number;
  intent: GraphNavigationIntent;
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
  const navigationRequestSequence = useRef(0);
  const lastAppliedGraphFocusRevisionRef = useRef(0);
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
  const safeNavigation = hierarchyIndex
    ? nearestValidNavigation(hierarchyIndex, navigation)
    : OVERVIEW_NAVIGATION;
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

  useEffect(() => {
    if (storedMode !== effectiveMode) setGraphExplorerMode(effectiveMode);
  }, [effectiveMode, setGraphExplorerMode, storedMode]);

  useEffect(() => {
    if (!hierarchyIndex) return;
    if (!sameNavigation(navigation, safeNavigation)) setNavigation(safeNavigation);
    if (materializedNodeId !== safeMaterializedNodeId) setMaterializedNodeId(safeMaterializedNodeId);
    if (pendingNavigationRequest !== safePendingNavigationRequest) {
      setPendingNavigationRequest(safePendingNavigationRequest);
    }
    if (!selectedNodeStillExists) selectNode(null);
  }, [
    hierarchyIndex,
    materializedNodeId,
    navigation,
    pendingNavigationRequest,
    safeMaterializedNodeId,
    safeNavigation,
    safePendingNavigationRequest,
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
      safeMaterializedNodeId,
      safeNavigation,
      safeSelectedNodeId,
      selectedNodeWasVisible,
      wikiIndex,
    ],
  );

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

  const selectVisibleNode = useCallback((nodeId: string | null) => {
    const isVisible = Boolean(
      nodeId && view?.semanticGraph.nodes.some((node) => node.id === nodeId),
    );
    setPendingNavigationRequest(null);
    setWikiFocusNotice(null);
    setVisibleSelectedNodeId(isVisible ? nodeId : null);
    setVisibleSelectionContextKey(isVisible ? selectionContextKeyFor(null) : null);
    selectNode(nodeId);
  }, [selectNode, selectionContextKeyFor, view]);

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
    transitionNavigation(OVERVIEW_NAVIGATION);
  }, [transitionNavigation]);

  const openScope = useCallback((scopeId: string) => {
    transitionNavigation({ level: "scope", scopeId });
  }, [transitionNavigation]);

  const openCluster = useCallback((scopeId: string, clusterId: string) => {
    transitionNavigation({ level: "cluster", scopeId, clusterId });
  }, [transitionNavigation]);

  const openFile = useCallback((scopeId: string, clusterId: string, fileId: string) => {
    transitionNavigation({ level: "file", scopeId, clusterId, fileId });
  }, [transitionNavigation]);

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
  const canvasViewKey = buildCanvasViewKey({
    graphInstanceToken,
    layoutRevision,
    mode: effectiveMode,
    navigation: safeNavigation,
    materializedNodeId: safeMaterializedNodeId,
  });
  const notice = wikiFocusNotice ?? presentation.notice;

  return (
    <section
      aria-label="项目图谱"
      className="flex min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-root text-text-primary xl:overflow-hidden max-xl:flex-col"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-4 max-xl:min-h-[540px] max-xl:flex-none max-sm:min-h-[480px] max-sm:p-3">
        <div className="flex items-start justify-between gap-3 max-lg:flex-col">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <GraphModeToolbar mode={effectiveMode} options={modeOptions} onChangeMode={changeMode} />
            <GraphQuickJump items={quickJumpItems} onSelect={applyNavigationIntent} />
          </div>
          {effectiveMode === "coverage" && modeOptions.some((option) => option.id === "coverage") && (
            <GraphCoverageLegend />
          )}
        </div>

        <div className="uc-panel flex min-w-0 flex-wrap items-center justify-between gap-3 px-3 py-2">
          <nav aria-label="图谱层级" className="flex min-w-0 flex-wrap items-center gap-1 text-xs">
            {presentation.breadcrumbs.map((item, index) => {
              const isCurrent = index === presentation.breadcrumbs.length - 1;
              return (
                <span key={`${item.level}:${item.scopeId ?? ""}:${item.clusterId ?? ""}:${item.fileId ?? ""}`} className="flex items-center gap-1">
                  {index > 0 && <span aria-hidden="true" className="text-text-muted">/</span>}
                  {isCurrent ? (
                    <span aria-current="page" className="font-semibold text-text-primary">{item.label}</span>
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
                      className="min-h-11 rounded px-2.5 py-1.5 text-text-muted transition-colors hover:bg-elevated hover:text-text-primary"
                    >
                      {item.label}
                    </button>
                  )}
                </span>
              );
            })}
          </nav>
          <p className="text-[11px] text-text-muted">
            当前显示 {view.semanticGraph.nodes.length} 个元素
            {presentation.hiddenNodeCount > 0 ? `，另有 ${presentation.hiddenNodeCount} 个未展开` : ""}
          </p>
        </div>

        {notice && view.semanticGraph.nodes.length > 0 && (
          <p role="status" aria-live="polite" className="uc-panel-muted px-3 py-2 text-sm text-text-muted">
            {notice}
          </p>
        )}

        <SemanticGraphCanvas
          semanticGraph={view.semanticGraph}
          displayMode={effectiveMode}
          viewKey={canvasViewKey}
          emptyNotice={notice}
          onOpenScope={openScope}
          onOpenCluster={openCluster}
          onOpenFile={openFile}
          onSelectNode={selectVisibleNode}
        />
      </div>
      <GraphDetailsRail
        view={view}
        onSelectObject={selectVisibleNode}
        onOpenScope={openScope}
        onOpenCluster={openCluster}
        onOpenFile={openFile}
        onSelectWikiTarget={openSelectionWikiTarget}
        onRequestGlobalSearch={onRequestGlobalSearch}
      />
    </section>
  );
}
