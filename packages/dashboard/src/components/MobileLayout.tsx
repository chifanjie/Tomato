import { lazy, Suspense, useEffect, useState, type RefObject } from "react";
import type { GraphIssue } from "@understand-code/core/schema";
import { useDashboardStore } from "../store";
import { useI18n } from "../contexts/I18nContext";
import DomainGraphView from "./DomainGraphView";
import KnowledgeGraphView from "./KnowledgeGraphView";
import FunctionDetailPage from "./FunctionDetailPage";
import ReadableViewGraphPage from "./ReadableViewGraphPage";
import KnowledgeConsole from "./wiki/KnowledgeConsole";
import GraphExplorer from "./graphExplorer/GraphExplorer";
import SearchBar from "./SearchBar";
import NodeInfo from "./NodeInfo";
import ProjectOverview from "./ProjectOverview";
import FileExplorer from "./FileExplorer";
import WarningBanner from "./WarningBanner";
import MobileBottomNav from "./MobileBottomNav";
import type { MobileTab } from "./MobileBottomNav";
import MobileDrawer from "./MobileDrawer";

const CodeViewer = lazy(() => import("./CodeViewer"));
const LearnPanel = lazy(() => import("./LearnPanel"));
const PathFinderModal = lazy(() => import("./PathFinderModal"));
const KeyboardShortcutsHelp = lazy(() => import("./KeyboardShortcutsHelp"));

interface Props {
  accessToken: string;
  showKeyboardHelp: boolean;
  setShowKeyboardHelp: (value: boolean) => void;
  loadError: string | null;
  allIssues: GraphIssue[];
  shortcuts: import("../hooks/useKeyboardShortcuts").KeyboardShortcut[];
  searchButtonRef: RefObject<HTMLButtonElement | null>;
  onOpenGlobalSearch: () => void;
}

export function mobilePrimarySurfaceLabel(surface: "wiki" | "graph"): string {
  return surface === "wiki" ? "Wiki" : "Graph";
}

export function mobileSearchButtonLabel(isPeerSurface: boolean, searchOpen: boolean): string {
  if (isPeerSurface) return "搜索知识库";
  return searchOpen ? "隐藏搜索" : "显示搜索";
}

export function shouldAutoPivotMobileInfo({
  dashboardSurface,
  selectedNodeId,
  navigationLevel,
}: {
  dashboardSurface: "wiki" | "graph";
  selectedNodeId: string | null;
  navigationLevel: string;
}): boolean {
  return dashboardSurface !== "wiki" && dashboardSurface !== "graph" && Boolean(selectedNodeId) && navigationLevel !== "file-detail";
}

export default function MobileLayout({
  accessToken,
  showKeyboardHelp,
  setShowKeyboardHelp,
  loadError,
  allIssues,
  shortcuts,
  searchButtonRef,
  onOpenGlobalSearch,
}: Props) {
  const graph = useDashboardStore((s) => s.graph);
  const dashboardSurface = useDashboardStore((s) => s.dashboardSurface);
  const setDashboardSurface = useDashboardStore((s) => s.setDashboardSurface);
  const selectedNodeId = useDashboardStore((s) => s.selectedNodeId);
  const tourActive = useDashboardStore((s) => s.tourActive);
  const persona = useDashboardStore((s) => s.persona);
  const viewMode = useDashboardStore((s) => s.viewMode);
  const domainGraph = useDashboardStore((s) => s.domainGraph);
  const navigationLevel = useDashboardStore((s) => s.navigationLevel);
  const activeFileId = useDashboardStore((s) => s.activeFileId);
  const codeViewerOpen = useDashboardStore((s) => s.codeViewerOpen);
  const closeCodeViewer = useDashboardStore((s) => s.closeCodeViewer);
  const pathFinderOpen = useDashboardStore((s) => s.pathFinderOpen);
  const togglePathFinder = useDashboardStore((s) => s.togglePathFinder);
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<MobileTab>("graph");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const isPeerDashboardSurface = dashboardSurface === "wiki" || dashboardSurface === "graph";
  const primaryTabLabel = mobilePrimarySurfaceLabel(dashboardSurface);

  const switchDashboardSurface = (surface: "wiki" | "graph") => {
    setDashboardSurface(surface);
    setActiveTab("graph");
  };

  // Auto-pivot to Info when a node is selected — keeps feedback visible
  // on a small screen where the graph and sidebar can't coexist.
  useEffect(() => {
    if (shouldAutoPivotMobileInfo({ dashboardSurface, selectedNodeId, navigationLevel })) {
      setActiveTab("info");
    }
  }, [dashboardSurface, navigationLevel, selectedNodeId]);

  useEffect(() => {
    if (persona === "junior") {
      setActiveTab("info");
    } else if (persona === "experienced") {
      setActiveTab("files");
    } else {
      setActiveTab("graph");
    }
    setDrawerOpen(false);
  }, [persona]);

  // When a code viewer opens (e.g. from the Files tab) keep focus there
  useEffect(() => {
    if (codeViewerOpen) setSearchOpen(false);
  }, [codeViewerOpen]);

  useEffect(() => {
    if (isPeerDashboardSurface) setSearchOpen(false);
  }, [isPeerDashboardSurface]);

  const isLearnMode = tourActive || persona === "junior";
  const infoContent = (
    <>
      {selectedNodeId && <NodeInfo />}
      {isLearnMode && (
        <Suspense fallback={null}>
          <LearnPanel />
        </Suspense>
      )}
      {!selectedNodeId && !isLearnMode && <ProjectOverview />}
    </>
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-root text-text-primary noise-overlay">
      {/* Top bar */}
      <header className="flex items-center gap-2 px-3 h-12 shrink-0 bg-surface border-b border-border-subtle">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-elevated transition-colors -ml-1"
          aria-label="Open menu"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <h1 className="font-heading text-base flex-1 min-w-0 truncate text-center text-text-primary tracking-wide">
          {graph?.project.name ?? t.common.appName}
        </h1>

        <button
          ref={isPeerDashboardSurface ? searchButtonRef : undefined}
          type="button"
          onClick={isPeerDashboardSurface
            ? onOpenGlobalSearch
            : () => setSearchOpen((prev) => !prev)}
          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors -mr-1 ${
            !isPeerDashboardSurface && searchOpen
              ? "text-accent bg-accent/15"
              : "text-text-secondary hover:text-text-primary hover:bg-elevated"
          }`}
          aria-label={mobileSearchButtonLabel(isPeerDashboardSurface, searchOpen)}
          aria-pressed={isPeerDashboardSurface ? undefined : searchOpen}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle bg-surface px-3 py-2">
        <div className="grid flex-1 grid-cols-2 rounded-md border border-border-subtle bg-elevated p-0.5">
          <button
            type="button"
            onClick={() => switchDashboardSurface("wiki")}
            className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
              dashboardSurface === "wiki"
                ? "bg-accent/15 text-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Wiki
          </button>
          <button
            type="button"
            onClick={() => switchDashboardSurface("graph")}
            className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
              dashboardSurface === "graph"
                ? "bg-accent/15 text-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Graph
          </button>
        </div>
      </div>

      {/* Search (collapsible) */}
      {!isPeerDashboardSurface && searchOpen && <SearchBar />}

      {/* Validation warnings */}
      {allIssues.length > 0 && !loadError && <WarningBanner issues={allIssues} />}

      {/* Load error */}
      {loadError && (
        <div className="px-4 py-3 bg-red-900/30 border-b border-red-700 text-red-200 text-sm">
          {loadError}
        </div>
      )}

      {/* Tabbed content — panes stay mounted to preserve local state on tab switch. */}
      <div className="flex-1 min-h-0 relative">
        <div
          className={`absolute inset-0 ${
            activeTab === "graph" ? "" : "invisible pointer-events-none"
          }`}
          aria-hidden={activeTab !== "graph"}
        >
          {dashboardSurface === "wiki" ? (
            <KnowledgeConsole />
          ) : dashboardSurface === "graph" ? (
            <GraphExplorer />
          ) : viewMode === "knowledge" ? (
            <KnowledgeGraphView />
          ) : viewMode === "domain" && domainGraph ? (
            <DomainGraphView />
          ) : navigationLevel === "file-detail" && activeFileId ? (
            <FunctionDetailPage />
          ) : (
            <ReadableViewGraphPage />
          )}
        </div>

        <div
          className={`absolute inset-0 overflow-auto bg-surface ${
            activeTab === "info" ? "" : "invisible pointer-events-none"
          }`}
          aria-hidden={activeTab !== "info"}
        >
          {infoContent}
        </div>

        <div
          className={`absolute inset-0 overflow-auto bg-surface ${
            activeTab === "files" ? "" : "invisible pointer-events-none"
          }`}
          aria-hidden={activeTab !== "files"}
        >
          <FileExplorer />
        </div>
      </div>

      {/* Bottom tab nav */}
      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} primaryLabel={primaryTabLabel} />

      {/* Drawer */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onTogglePathFinder={togglePathFinder}
        onShowKeyboardHelp={() => setShowKeyboardHelp(true)}
      />

      {/* Code viewer — always fullscreen on mobile */}
      {codeViewerOpen && (
        <div
          className="fixed inset-0 z-50 flex bg-black/70 backdrop-blur-sm p-2 sm:p-4"
          onMouseDown={closeCodeViewer}
        >
          <div
            className="flex-1 rounded-lg border border-border-medium bg-surface shadow-2xl overflow-hidden"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Suspense fallback={null}>
              <CodeViewer
                accessToken={accessToken}
                presentation="modal"
                onClose={closeCodeViewer}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* Keyboard help (mobile reads it as a quick reference too) */}
      {showKeyboardHelp && (
        <Suspense fallback={null}>
          <KeyboardShortcutsHelp
            shortcuts={shortcuts}
            onClose={() => setShowKeyboardHelp(false)}
          />
        </Suspense>
      )}

      {/* Path finder */}
      {!isPeerDashboardSurface && pathFinderOpen && (
        <Suspense fallback={null}>
          <PathFinderModal isOpen={pathFinderOpen} onClose={togglePathFinder} />
        </Suspense>
      )}
    </div>
  );
}
