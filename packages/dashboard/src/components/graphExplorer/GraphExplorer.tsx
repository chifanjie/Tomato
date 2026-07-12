import { useCallback, useEffect, useMemo, useState } from "react";
import type { GraphExplorerDisplayMode, GraphExplorerNavigation } from "../../graphExplorer/hierarchicalGraph";
import { useDashboardStore } from "../../store";
import type { WikiTarget } from "../../wiki/wikiContent";
import GraphCoverageLegend from "./GraphCoverageLegend";
import GraphDetailsRail from "./GraphDetailsRail";
import GraphModeToolbar from "./GraphModeToolbar";
import SemanticGraphCanvas from "./SemanticGraphCanvas";
import {
  availableGraphModes,
  buildGraphExplorerView,
  normalizeGraphModeForOptions,
} from "./graphExplorerModel";

interface GraphExplorerProps {
  onSelectWikiTarget: (target: WikiTarget) => unknown;
  onRequestGlobalSearch: () => void;
}

const OVERVIEW_NAVIGATION: GraphExplorerNavigation = { level: "overview" };

export default function GraphExplorer({
  onSelectWikiTarget,
  onRequestGlobalSearch,
}: GraphExplorerProps) {
  const graph = useDashboardStore((state) => state.graph);
  const wikiIndex = useDashboardStore((state) => state.wikiIndex);
  const storedMode = useDashboardStore((state) => state.graphExplorerMode);
  const setGraphExplorerMode = useDashboardStore((state) => state.setGraphExplorerMode);
  const focusNodeIds = useDashboardStore((state) => state.graphFocusNodeIds);
  const selectedNodeId = useDashboardStore((state) => state.selectedNodeId);
  const selectNode = useDashboardStore((state) => state.selectNode);
  const openWikiForGraphNode = useDashboardStore((state) => state.openWikiForGraphNode);
  const [navigation, setNavigation] = useState<GraphExplorerNavigation>(OVERVIEW_NAVIGATION);

  const modeOptions = useMemo(
    () => graph ? availableGraphModes(graph, wikiIndex) : [],
    [graph, wikiIndex],
  );
  const effectiveMode = useMemo(
    () => normalizeGraphModeForOptions(storedMode, modeOptions),
    [modeOptions, storedMode],
  );

  useEffect(() => {
    if (storedMode !== effectiveMode) setGraphExplorerMode(effectiveMode);
  }, [effectiveMode, setGraphExplorerMode, storedMode]);

  const view = useMemo(
    () => graph
      ? buildGraphExplorerView({
          graph,
          wikiIndex,
          mode: effectiveMode,
          focusNodeIds,
          selectedNodeId,
          navigation,
        })
      : null,
    [effectiveMode, focusNodeIds, graph, navigation, selectedNodeId, wikiIndex],
  );

  const changeMode = useCallback((mode: GraphExplorerDisplayMode) => {
    setGraphExplorerMode(mode);
    setNavigation(OVERVIEW_NAVIGATION);
    selectNode(null);
  }, [selectNode, setGraphExplorerMode]);

  const openOverview = useCallback(() => {
    setNavigation(OVERVIEW_NAVIGATION);
    selectNode(null);
  }, [selectNode]);

  const openScope = useCallback((scopeId: string) => {
    setNavigation({ level: "scope", scopeId });
    selectNode(null);
  }, [selectNode]);

  const openFile = useCallback((scopeId: string, fileId: string) => {
    setNavigation({ level: "file", scopeId, fileId });
    selectNode(null);
  }, [selectNode]);

  const selection = view?.selection;
  const openSelectionWikiTarget = useCallback((target: WikiTarget) => {
    if (selection?.kind === "raw") {
      const destination = openWikiForGraphNode(selection.id);
      return destination ? onSelectWikiTarget(destination) : null;
    }
    return onSelectWikiTarget(target);
  }, [onSelectWikiTarget, openWikiForGraphNode, selection]);

  if (!graph || !view) {
    return (
      <section aria-label="项目图谱" className="flex min-h-0 flex-1 items-center justify-center bg-root">
        <p className="uc-panel p-4 text-sm text-text-muted">尚未加载项目图谱。</p>
      </section>
    );
  }

  const presentation = view.semanticGraph.presentation;
  const canvasViewKey = JSON.stringify([
    graph.version,
    graph.project.name,
    graph.project.gitCommitHash,
    graph.project.analyzedAt,
    effectiveMode,
    presentation.level,
    presentation.scopeId ?? "",
    presentation.fileId ?? "",
    focusNodeIds.join("|"),
  ]);

  return (
    <section
      aria-label="项目图谱"
      className="flex min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-root text-text-primary xl:overflow-hidden max-xl:flex-col"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-4 max-xl:min-h-[540px] max-xl:flex-none max-sm:min-h-[480px] max-sm:p-3">
        <div className="flex items-start justify-between gap-3 max-lg:flex-col">
          <GraphModeToolbar mode={effectiveMode} options={modeOptions} onChangeMode={changeMode} />
          <GraphCoverageLegend />
        </div>

        <div className="uc-panel flex min-w-0 flex-wrap items-center justify-between gap-3 px-3 py-2">
          <nav aria-label="图谱层级" className="flex min-w-0 flex-wrap items-center gap-1 text-xs">
            {presentation.breadcrumbs.map((item, index) => {
              const isCurrent = index === presentation.breadcrumbs.length - 1;
              return (
                <span key={`${item.level}:${item.scopeId ?? ""}:${item.fileId ?? ""}`} className="flex items-center gap-1">
                  {index > 0 && <span aria-hidden="true" className="text-text-muted">/</span>}
                  {isCurrent ? (
                    <span aria-current="page" className="font-semibold text-text-primary">{item.label}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => item.level === "overview"
                        ? openOverview()
                        : item.scopeId ? openScope(item.scopeId) : undefined}
                      className="rounded px-1.5 py-1 text-text-muted transition-colors hover:bg-elevated hover:text-text-primary"
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

        <SemanticGraphCanvas
          semanticGraph={view.semanticGraph}
          displayMode={effectiveMode}
          viewKey={canvasViewKey}
          onOpenScope={openScope}
          onOpenFile={openFile}
        />
      </div>
      <GraphDetailsRail
        view={view}
        onSelectObject={selectNode}
        onOpenScope={openScope}
        onOpenFile={openFile}
        onSelectWikiTarget={openSelectionWikiTarget}
        onRequestGlobalSearch={onRequestGlobalSearch}
      />
    </section>
  );
}
