import { useCallback, useEffect, useMemo, useState } from "react";
import type { GraphNode, KnowledgeGraph } from "@understand-code/core/types";
import { useDashboardStore } from "../../store";
import { buildReadableSearchMatches, findParentFileId } from "../../viewgraph/readableSelectors";
import type { ViewGraph } from "../../viewgraph/types";
import { buildJourneyRoute, type JourneyStep } from "../../workbench/journeyRoute";
import {
  resolveKnowledgeContext,
  type KnowledgeContextIndex,
  type WorkbenchSelection,
} from "../../workbench/knowledgeContext";
import GraphView from "../GraphView";
import JourneyRail from "./JourneyRail";
import KnowledgeContextPanel from "./KnowledgeContextPanel";
import ModeRail from "./ModeRail";
import VisualStage from "./VisualStage";

interface VisualGuidedWorkbenchProps {
  graph: KnowledgeGraph;
  viewGraph: ViewGraph;
  knowledgeContextIndex: KnowledgeContextIndex;
}

function buildNodeMatchCounts(searchResults: { nodeId: string }[], nodesById: Map<string, GraphNode>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const result of searchResults) {
    const node = nodesById.get(result.nodeId);
    if (!node || node.type === "file") continue;
    counts.set(result.nodeId, (counts.get(result.nodeId) ?? 0) + 1);
  }
  return counts;
}

function selectionForStep(
  step: JourneyStep | null,
  graph: KnowledgeGraph,
  viewGraph: ViewGraph,
  nodesById: Map<string, GraphNode>,
): WorkbenchSelection | null {
  if (!step) return null;

  const kind = step.kind ?? "project";
  if (kind === "file") {
    const file = viewGraph.filesById.get(step.targetId);
    return {
      nodeId: step.targetId,
      filePath: file?.filePath ?? step.path,
      title: file?.name ?? step.title,
      summary: file?.node.summary ?? step.reason,
      kind,
    };
  }

  const node = nodesById.get(step.targetId);
  const parentFileId = node ? findParentFileId(graph, viewGraph, node.id) : null;
  const parentFile = parentFileId ? viewGraph.filesById.get(parentFileId) : null;

  return {
    nodeId: step.targetId,
    filePath: node?.filePath ?? parentFile?.filePath ?? step.path,
    title: node?.name ?? step.title,
    summary: node?.summary ?? step.reason,
    kind,
  };
}

function selectionForNode(
  nodeId: string | null,
  graph: KnowledgeGraph,
  viewGraph: ViewGraph,
  nodesById: Map<string, GraphNode>,
): WorkbenchSelection | null {
  if (!nodeId) return null;

  const file = viewGraph.filesById.get(nodeId);
  if (file) {
    return {
      nodeId,
      filePath: file.filePath,
      title: file.name,
      summary: file.node.summary,
      kind: "file",
    };
  }

  const node = nodesById.get(nodeId);
  if (!node) return null;

  const parentFileId = findParentFileId(graph, viewGraph, node.id);
  const parentFile = parentFileId ? viewGraph.filesById.get(parentFileId) : null;
  return {
    nodeId,
    filePath: node.filePath ?? parentFile?.filePath,
    title: node.name,
    summary: node.summary,
    kind: node.type,
  };
}

function firstStepId(routeSteps: JourneyStep[]): string | null {
  return routeSteps[0]?.id ?? null;
}

function stepForActiveFile(routeSteps: JourneyStep[], activeFileId: string | null): JourneyStep | null {
  if (!activeFileId) return null;
  return routeSteps.find((step) => step.kind === "file" && step.targetId === activeFileId) ?? null;
}

function stepForSelectedNode(
  routeSteps: JourneyStep[],
  selectedNodeId: string | null,
  viewGraph: ViewGraph,
): JourneyStep | null {
  if (!selectedNodeId || viewGraph.filesById.has(selectedNodeId)) return null;
  return routeSteps.find((step) => step.targetId === selectedNodeId) ?? null;
}

function stepForActiveLayer(
  routeSteps: JourneyStep[],
  activeLayerId: string | null,
  viewGraph: ViewGraph,
): JourneyStep | null {
  if (!activeLayerId) return null;
  const layerParentId = `layer:${activeLayerId}`;
  return routeSteps.find((step) => {
    if (step.kind === "file") return false;
    if (step.parentId === layerParentId) return true;
    const file = viewGraph.filesById.get(step.targetId);
    return file?.layerId === activeLayerId;
  }) ?? null;
}

function syncedStepIdForNavigation({
  routeSteps,
  currentStepId,
  navigationLevel,
  activeFileId,
  activeLayerId,
  selectedNodeId,
  viewGraph,
}: {
  routeSteps: JourneyStep[];
  currentStepId: string | null;
  navigationLevel: "overview" | "layer-detail" | "file-detail";
  activeFileId: string | null;
  activeLayerId: string | null;
  selectedNodeId: string | null;
  viewGraph: ViewGraph;
}): string | null {
  if (routeSteps.length === 0) return null;

  const currentStep = currentStepId
    ? routeSteps.find((step) => step.id === currentStepId) ?? null
    : null;

  if (navigationLevel === "file-detail") {
    return (
      stepForActiveFile(routeSteps, activeFileId)?.id ??
      stepForSelectedNode(routeSteps, selectedNodeId, viewGraph)?.id ??
      stepForActiveLayer(routeSteps, activeLayerId, viewGraph)?.id ??
      (currentStep && currentStep.kind !== "file" ? currentStep.id : null) ??
      routeSteps.find((step) => step.kind !== "file")?.id ??
      firstStepId(routeSteps)
    );
  }

  return (
    stepForSelectedNode(routeSteps, selectedNodeId, viewGraph)?.id ??
    stepForActiveLayer(routeSteps, activeLayerId, viewGraph)?.id ??
    (currentStep && currentStep.kind !== "file" ? currentStep.id : null) ??
    routeSteps.find((step) => step.kind !== "file")?.id ??
    firstStepId(routeSteps)
  );
}

export default function VisualGuidedWorkbench({
  graph,
  viewGraph,
  knowledgeContextIndex,
}: VisualGuidedWorkbenchProps) {
  const searchResults = useDashboardStore((s) => s.searchResults);
  const navigationLevel = useDashboardStore((s) => s.navigationLevel);
  const activeFileId = useDashboardStore((s) => s.activeFileId);
  const activeLayerId = useDashboardStore((s) => s.activeLayerId);
  const selectedNodeId = useDashboardStore((s) => s.selectedNodeId);
  const navigateToNodeInLayer = useDashboardStore((s) => s.navigateToNodeInLayer);
  const navigateToOverview = useDashboardStore((s) => s.navigateToOverview);
  const setFocusNode = useDashboardStore((s) => s.setFocusNode);
  const nodesById = useDashboardStore((s) => s.nodesById);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [routeVisible, setRouteVisible] = useState(true);
  const [knowledgeVisible, setKnowledgeVisible] = useState(true);

  const searchMatches = useMemo(
    () => buildReadableSearchMatches(graph, viewGraph, searchResults),
    [graph, viewGraph, searchResults],
  );

  const nodeMatchCounts = useMemo(
    () => buildNodeMatchCounts(searchResults, nodesById),
    [searchResults, nodesById],
  );

  const route = useMemo(
    () =>
      buildJourneyRoute({
        graph,
        viewGraph,
        layerMatchCounts: searchMatches.layerMatchCounts,
        fileMatchCounts: searchMatches.fileMatchCounts,
        nodeMatchCounts,
      }),
    [graph, viewGraph, searchMatches.layerMatchCounts, searchMatches.fileMatchCounts, nodeMatchCounts],
  );

  useEffect(() => {
    const nextStepId = syncedStepIdForNavigation({
      routeSteps: route.steps,
      currentStepId: activeStepId,
      navigationLevel,
      activeFileId,
      activeLayerId,
      selectedNodeId,
      viewGraph,
    });
    if (nextStepId !== activeStepId) {
      setActiveStepId(nextStepId);
    }
  }, [
    activeFileId,
    activeLayerId,
    activeStepId,
    navigationLevel,
    route.steps,
    selectedNodeId,
    viewGraph,
  ]);

  const activeStep = activeStepId
    ? route.steps.find((step) => step.id === activeStepId) ?? null
    : null;
  const selection = useMemo(
    () =>
      selectionForNode(selectedNodeId, graph, viewGraph, nodesById) ??
      selectionForStep(activeStep, graph, viewGraph, nodesById),
    [activeStep, graph, viewGraph, nodesById, selectedNodeId],
  );
  const knowledgeContext = useMemo(
    () => resolveKnowledgeContext(knowledgeContextIndex, selection),
    [knowledgeContextIndex, selection],
  );

  const handleSelectStep = useCallback(
    (step: JourneyStep) => {
      setActiveStepId(step.id);

      const kind = step.kind ?? "project";
      if (kind === "project") {
        navigateToOverview();
        return;
      }

      if (nodesById.has(step.targetId) || viewGraph.filesById.has(step.targetId)) {
        navigateToNodeInLayer(step.targetId);
        setFocusNode(step.targetId);
      }
    },
    [navigateToNodeInLayer, navigateToOverview, nodesById, setFocusNode, viewGraph.filesById],
  );

  const handleShowGraph = useCallback(() => {
    navigateToOverview();
  }, [navigateToOverview]);

  const handleFocusActive = useCallback(() => {
    if (activeStep) {
      handleSelectStep(activeStep);
      return;
    }
    navigateToOverview();
  }, [activeStep, handleSelectStep, navigateToOverview]);

  const handleFocusSearch = useCallback(() => {
    document.querySelector<HTMLInputElement>('[data-testid="search-input"]')?.focus();
  }, []);

  const handleToggleRoute = useCallback(() => {
    setRouteVisible((visible) => !visible);
  }, []);

  const handleToggleKnowledge = useCallback(() => {
    setKnowledgeVisible((visible) => !visible);
  }, []);

  const handleSelectAndRevealRoute = useCallback(
    (step: JourneyStep) => {
      if (!routeVisible) setRouteVisible(true);
      handleSelectStep(step);
    },
    [handleSelectStep, routeVisible],
  );

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-root">
      <ModeRail
        routeVisible={routeVisible}
        knowledgeVisible={knowledgeVisible}
        onShowGraph={handleShowGraph}
        onToggleRoute={handleToggleRoute}
        onToggleKnowledge={handleToggleKnowledge}
        onFocusActive={handleFocusActive}
        onFocusSearch={handleFocusSearch}
      />
      {routeVisible && (
        <JourneyRail route={route} activeStepId={activeStep?.id ?? null} onSelectStep={handleSelectAndRevealRoute} />
      )}
      <VisualStage activeStep={activeStep}>
        <GraphView />
      </VisualStage>
      {knowledgeVisible && <KnowledgeContextPanel context={knowledgeContext} />}
    </div>
  );
}
