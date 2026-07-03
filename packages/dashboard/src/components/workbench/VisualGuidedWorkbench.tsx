import { useCallback, useEffect, useMemo, useState } from "react";
import type { GraphNode, KnowledgeGraph } from "@understand-anything/core/types";
import { useDashboardStore } from "../../store";
import { buildReadableSearchMatches, findParentFileId } from "../../viewgraph/readableSelectors";
import type { ViewGraph } from "../../viewgraph/types";
import { buildJourneyRoute, type JourneyStep } from "../../workbench/journeyRoute";
import {
  resolveKnowledgeContext,
  type KnowledgeContextIndex,
  type WorkbenchSelection,
} from "../../workbench/knowledgeContext";
import FunctionDetailPage from "../FunctionDetailPage";
import ReadableViewGraphPage from "../ReadableViewGraphPage";
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

export default function VisualGuidedWorkbench({
  graph,
  viewGraph,
  knowledgeContextIndex,
}: VisualGuidedWorkbenchProps) {
  const searchResults = useDashboardStore((s) => s.searchResults);
  const navigationLevel = useDashboardStore((s) => s.navigationLevel);
  const activeFileId = useDashboardStore((s) => s.activeFileId);
  const openFileDetail = useDashboardStore((s) => s.openFileDetail);
  const navigateToNodeInLayer = useDashboardStore((s) => s.navigateToNodeInLayer);
  const navigateToOverview = useDashboardStore((s) => s.navigateToOverview);
  const nodesById = useDashboardStore((s) => s.nodesById);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);

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
    if (route.steps.length === 0) {
      setActiveStepId(null);
      return;
    }
    if (!activeStepId || !route.steps.some((step) => step.id === activeStepId)) {
      setActiveStepId(route.steps[0].id);
    }
  }, [activeStepId, route]);

  const activeStep = route.steps.find((step) => step.id === activeStepId) ?? route.steps[0] ?? null;
  const selection = useMemo(
    () => selectionForStep(activeStep, graph, viewGraph, nodesById),
    [activeStep, graph, viewGraph, nodesById],
  );
  const knowledgeContext = useMemo(
    () => resolveKnowledgeContext(knowledgeContextIndex, selection),
    [knowledgeContextIndex, selection],
  );

  const handleSelectStep = useCallback(
    (step: JourneyStep) => {
      setActiveStepId(step.id);

      const kind = step.kind ?? "project";
      if (kind === "file" && viewGraph.filesById.has(step.targetId)) {
        openFileDetail(step.targetId);
        return;
      }

      if (kind === "project") {
        navigateToOverview();
        return;
      }

      if (nodesById.has(step.targetId)) {
        navigateToNodeInLayer(step.targetId);
      }
    },
    [navigateToNodeInLayer, navigateToOverview, nodesById, openFileDetail, viewGraph.filesById],
  );

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-root">
      <ModeRail />
      <JourneyRail route={route} activeStepId={activeStep?.id ?? null} onSelectStep={handleSelectStep} />
      <VisualStage activeStep={activeStep}>
        {navigationLevel === "file-detail" && activeFileId ? (
          <FunctionDetailPage presentation="workbench" />
        ) : (
          <ReadableViewGraphPage presentation="workbench" />
        )}
      </VisualStage>
      <KnowledgeContextPanel context={knowledgeContext} />
    </div>
  );
}
