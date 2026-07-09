import { useMemo } from "react";
import { useDashboardStore } from "../../store";
import GraphCoverageLegend from "./GraphCoverageLegend";
import GraphDetailsRail from "./GraphDetailsRail";
import GraphModeToolbar from "./GraphModeToolbar";
import SemanticGraphCanvas from "./SemanticGraphCanvas";
import { buildGraphExplorerView } from "./graphExplorerModel";

export default function GraphExplorer() {
  const graph = useDashboardStore((state) => state.graph);
  const wikiIndex = useDashboardStore((state) => state.wikiIndex);
  const mode = useDashboardStore((state) => state.graphExplorerMode);
  const setGraphExplorerMode = useDashboardStore((state) => state.setGraphExplorerMode);
  const focusNodeIds = useDashboardStore((state) => state.graphFocusNodeIds);
  const selectedNodeId = useDashboardStore((state) => state.selectedNodeId);

  const view = useMemo(
    () =>
      graph
        ? buildGraphExplorerView({
            graph,
            wikiIndex,
            mode,
            focusNodeIds,
            selectedNodeId,
          })
        : null,
    [focusNodeIds, graph, mode, selectedNodeId, wikiIndex],
  );

  if (!graph || !view) {
    return (
      <section aria-label="Full graph explorer" className="flex min-h-0 flex-1 items-center justify-center bg-root">
        <p className="rounded-md border border-border-subtle bg-surface p-4 text-sm text-text-muted">
          No graph has been loaded.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Full graph explorer"
      className="flex min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-root text-text-primary xl:overflow-hidden max-xl:flex-col"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-4 max-xl:min-h-[540px] max-xl:flex-none max-sm:min-h-[480px] max-sm:p-3">
        <div className="flex items-start justify-between gap-3 max-lg:flex-col">
          <GraphModeToolbar mode={mode} focusNodeCount={focusNodeIds.length} onChangeMode={setGraphExplorerMode} />
          <GraphCoverageLegend />
        </div>
        <SemanticGraphCanvas semanticGraph={view.semanticGraph} />
      </div>
      <GraphDetailsRail view={view} />
    </section>
  );
}
