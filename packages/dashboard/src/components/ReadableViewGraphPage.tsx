import { useMemo } from "react";
import { useDashboardStore } from "../store";
import { useI18n } from "../contexts/I18nContext";
import {
  buildReadableSearchMatches,
  getAllFiles,
  getFilesForLayer,
} from "../viewgraph/readableSelectors";
import LayerOverviewPanel from "./LayerOverviewPanel";
import LayerFileGraph from "./LayerFileGraph";
import ViewGraphBreadcrumb from "./ViewGraphBreadcrumb";

export default function ReadableViewGraphPage() {
  const graph = useDashboardStore((s) => s.graph);
  const viewGraph = useDashboardStore((s) => s.viewGraph);
  const navigationLevel = useDashboardStore((s) => s.navigationLevel);
  const activeLayerId = useDashboardStore((s) => s.activeLayerId);
  const selectedNodeId = useDashboardStore((s) => s.selectedNodeId);
  const searchResults = useDashboardStore((s) => s.searchResults);
  const drillIntoLayer = useDashboardStore((s) => s.drillIntoLayer);
  const openFileDetail = useDashboardStore((s) => s.openFileDetail);
  const { t } = useI18n();

  const matches = useMemo(
    () => buildReadableSearchMatches(graph, viewGraph, searchResults),
    [graph, viewGraph, searchResults],
  );
  const layer = useMemo(
    () => (activeLayerId && viewGraph ? viewGraph.layersById.get(activeLayerId) ?? null : null),
    [activeLayerId, viewGraph],
  );
  const files = useMemo(() => {
    if (!viewGraph) return [];
    return activeLayerId ? getFilesForLayer(viewGraph, activeLayerId) : getAllFiles(viewGraph);
  }, [activeLayerId, viewGraph]);

  if (!graph || !viewGraph) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-root text-sm text-text-muted">
        {t.readableViewGraph.noGraph}
      </div>
    );
  }

  if (navigationLevel === "layer-detail") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className="shrink-0 border-b border-border-subtle bg-surface px-5 py-3">
          <ViewGraphBreadcrumb />
        </div>
        <div className="min-h-0 flex-1">
          <LayerFileGraph
            graph={graph}
            viewGraph={viewGraph}
            layer={layer}
            files={files}
            fileMatchCounts={matches.fileMatchCounts}
            selectedFileId={selectedNodeId}
            onOpenFile={openFileDetail}
          />
        </div>
      </div>
    );
  }

  return (
    <LayerOverviewPanel
      layers={viewGraph.layers}
      layerMatchCounts={matches.layerMatchCounts}
      onOpenLayer={drillIntoLayer}
    />
  );
}
