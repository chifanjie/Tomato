import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from "react";
import { validateGraph } from "@understand-code/core/schema";
import type { GraphIssue } from "@understand-code/core/schema";
import { useDashboardStore } from "./store";
import DomainGraphView from "./components/DomainGraphView";
import KnowledgeGraphView from "./components/KnowledgeGraphView";
import FunctionDetailPage from "./components/FunctionDetailPage";
import ReadableViewGraphPage from "./components/ReadableViewGraphPage";
import ReadingAssistantPanel from "./components/ReadingAssistantPanel";
import VisualGuidedWorkbench from "./components/workbench/VisualGuidedWorkbench";
import KnowledgeConsole from "./components/wiki/KnowledgeConsole";
import GraphExplorer from "./components/graphExplorer/GraphExplorer";
import SearchBar from "./components/SearchBar";
import NodeInfo from "./components/NodeInfo";
import LayerLegend from "./components/LayerLegend";
import DiffToggle from "./components/DiffToggle";
import FilterPanel from "./components/FilterPanel";
import ExportMenu from "./components/ExportMenu";
import PersonaSelector from "./components/PersonaSelector";
import ProjectOverview from "./components/ProjectOverview";
import FileExplorer from "./components/FileExplorer";
import WarningBanner from "./components/WarningBanner";
import TokenGate from "./components/TokenGate";
import MobileLayout from "./components/MobileLayout";
import { useIsMobile } from "./hooks/useIsMobile";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import type { KeyboardShortcut } from "./hooks/useKeyboardShortcuts";
import { ThemeProvider } from "./themes/index.ts";
import { ThemePicker } from "./components/ThemePicker.tsx";
import type { ThemeConfig } from "./themes/index.ts";
import { I18nProvider, useI18n } from "./contexts/I18nContext.tsx";
import { shouldShowGraphControls } from "./utils/viewModeControls";
import {
  buildKnowledgeContextIndex,
  type KnowledgeContextIndex,
} from "./workbench/knowledgeContext";
import {
  loadDashboardKnowledge,
  loadKnowledgeContextIndex,
  shouldRetryWikiLoad,
} from "./workbench/knowledgeContextLoader";

// Lazy-load heavy / optional components so they ship in separate chunks.
const CodeViewer = lazy(() => import("./components/CodeViewer"));
const LearnPanel = lazy(() => import("./components/LearnPanel"));
const PathFinderModal = lazy(() => import("./components/PathFinderModal"));
const KeyboardShortcutsHelp = lazy(
  () => import("./components/KeyboardShortcutsHelp"),
);
const OnboardingOverlay = lazy(() => import("./components/OnboardingOverlay"));

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
const TOKEN_STORAGE_KEY = "understand-code-token";
const ONBOARDING_DISMISSED_KEY = "uc-onboarding-dismissed-v1";
const KNOWLEDGE_CONTEXT_RELOAD_INTERVAL_MS = 1000;
const KNOWLEDGE_CONTEXT_RELOAD_MAX_ATTEMPTS = 3;
type SidebarTab = "info" | "files";

export function shouldShowOnboarding(search?: string): boolean {
  const resolvedSearch = search ?? (typeof window === "undefined" ? "" : window.location.search);
  const params = new URLSearchParams(resolvedSearch);
  if (params.get("onboard") === "force") return true;
  return false;
}

/** Resolve data file URL — in demo mode, use env var URLs; otherwise use local paths with token. */
function dataUrl(fileName: string, token: string | null): string {
  if (DEMO_MODE) {
    const envMap: Record<string, string | undefined> = {
      "knowledge-graph.json": import.meta.env.VITE_GRAPH_URL,
      "domain-graph.json": import.meta.env.VITE_DOMAIN_GRAPH_URL,
      "meta.json": import.meta.env.VITE_META_URL,
      "diff-overlay.json": import.meta.env.VITE_DIFF_OVERLAY_URL,
      "config.json": import.meta.env.VITE_CONFIG_URL,
    };
    const url = envMap[fileName];
    if (url) return url;
  }
  const path = `/${fileName}`;
  return token ? `${path}?token=${encodeURIComponent(token)}` : path;
}

/**
 * Resolve the access token from the URL query string or browser storage.
 * If found in the URL, persist it and strip the param from the address bar.
 */
function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) ?? sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // Storage may be unavailable in hardened browser contexts.
    }
  }
}

function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    try {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Storage may be unavailable in hardened browser contexts.
    }
  }
}

function resolveInitialToken(): string | null {
  if (DEMO_MODE) return "__demo__";
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("token");
  if (urlToken) {
    writeStoredToken(urlToken);
    // Clean the URL
    params.delete("token");
    const cleanSearch = params.toString();
    const newUrl =
      window.location.pathname + (cleanSearch ? `?${cleanSearch}` : "") + window.location.hash;
    window.history.replaceState(null, "", newUrl);
    return urlToken;
  }
  return readStoredToken();
}

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(resolveInitialToken);

  const handleTokenValid = useCallback((token: string) => {
    writeStoredToken(token);
    setAccessToken(token);
  }, []);

  const handleTokenInvalid = useCallback(() => {
    clearStoredToken();
    setAccessToken(null);
  }, []);

  // In demo mode, skip token gate entirely
  if (DEMO_MODE) {
    return <Dashboard accessToken="__demo__" onTokenInvalid={handleTokenInvalid} />;
  }

  // Show the token gate when no token is available
  if (accessToken === null) {
    return <TokenGate onTokenValid={handleTokenValid} />;
  }

  return <Dashboard accessToken={accessToken} onTokenInvalid={handleTokenInvalid} />;
}

function Dashboard({
  accessToken,
  onTokenInvalid,
}: {
  accessToken: string;
  onTokenInvalid: () => void;
}) {
  const setGraph = useDashboardStore((s) => s.setGraph);
  const setDomainGraph = useDashboardStore((s) => s.setDomainGraph);
  const setDiffOverlay = useDashboardStore((s) => s.setDiffOverlay);
  const setWikiIndex = useDashboardStore((s) => s.setWikiIndex);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [graphIssues, setGraphIssues] = useState<GraphIssue[]>([]);
  const [metaTheme, setMetaTheme] = useState<ThemeConfig | null>(null);
  const [outputLanguage, setOutputLanguage] = useState<string | undefined>();
  const [knowledgeContextIndex, setKnowledgeContextIndex] = useState<KnowledgeContextIndex>(() =>
    buildKnowledgeContextIndex({ traces: [], documents: [] }),
  );

  useEffect(() => {
    fetch(dataUrl("meta.json", accessToken))
      .then((r) => (r.ok ? r.json() : null))
      .then((meta) => {
        if (meta?.theme) setMetaTheme(meta.theme);
      })
      .catch(() => {});
    fetch(dataUrl("config.json", accessToken))
      .then((r) => (r.ok ? r.json() : null))
      .then((config) => {
        if (config?.outputLanguage) setOutputLanguage(config.outputLanguage);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    let wikiLoadAttempts = 0;
    let retryTimer: number | undefined;

    async function loadKnowledgeContext(): Promise<void> {
      const dashboardKnowledge = await loadDashboardKnowledge(accessToken);

      if (cancelled) return;

      setWikiIndex(dashboardKnowledge.wikiIndex);
      if (dashboardKnowledge.wikiStatus === "forbidden") {
        onTokenInvalid();
        return;
      }
      if (!shouldRetryWikiLoad(
        dashboardKnowledge.wikiStatus,
        wikiLoadAttempts,
        KNOWLEDGE_CONTEXT_RELOAD_MAX_ATTEMPTS,
      )) {
        return;
      }

      wikiLoadAttempts += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        void loadKnowledgeContext();
      }, KNOWLEDGE_CONTEXT_RELOAD_INTERVAL_MS);
    }

    void loadKnowledgeContext();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [accessToken, onTokenInvalid, setWikiIndex]);

  useEffect(() => {
    let cancelled = false;
    void loadKnowledgeContextIndex(accessToken).then((index) => {
      if (!cancelled) setKnowledgeContextIndex(index);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    fetch(dataUrl("knowledge-graph.json", accessToken))
      .then((res) => {
        if (res.status === 403) {
          onTokenInvalid();
          throw new Error("TOKEN_INVALID");
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: unknown) => {
        const result = validateGraph(data);
        if (result.success && result.data) {
          setGraph(result.data);
          setGraphIssues(result.issues);
          if ((data as Record<string, unknown>).kind === "knowledge") {
            useDashboardStore.getState().setViewMode("knowledge");
            useDashboardStore.getState().setIsKnowledgeGraph(true);
          }
          for (const issue of result.issues) {
            if (issue.level === "auto-corrected") {
              console.warn(`[graph] auto-corrected: ${issue.message}`);
            } else if (issue.level === "dropped") {
              console.error(`[graph] dropped: ${issue.message}`);
            }
          }
        } else if (result.fatal) {
          console.error("Knowledge graph validation failed:", result.fatal);
          setLoadError(`Invalid knowledge graph: ${result.fatal}`);
        } else {
          console.error("Knowledge graph validation failed: unknown error");
          setLoadError("Invalid knowledge graph: unknown validation error");
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.message === "TOKEN_INVALID") return;
        console.error("Failed to load knowledge graph:", err);
        setLoadError(`Failed to load knowledge graph: ${err instanceof Error ? err.message : String(err)}`);
      });
  }, [accessToken, onTokenInvalid, setGraph]);

  useEffect(() => {
    fetch(dataUrl("diff-overlay.json", accessToken))
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: unknown) => {
        if (
          data &&
          typeof data === "object" &&
          "changedNodeIds" in data &&
          "affectedNodeIds" in data &&
          Array.isArray((data as Record<string, unknown>).changedNodeIds) &&
          Array.isArray((data as Record<string, unknown>).affectedNodeIds)
        ) {
          const d = data as { changedNodeIds: string[]; affectedNodeIds: string[] };
          if (d.changedNodeIds.length > 0) {
            setDiffOverlay(d.changedNodeIds, d.affectedNodeIds);
          }
        }
      })
      .catch(() => {});
  }, [setDiffOverlay]);

  useEffect(() => {
    fetch(dataUrl("domain-graph.json", accessToken))
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: unknown) => {
        if (!data) return;
        const result = validateGraph(data);
        if (result.success && result.data) {
          setDomainGraph(result.data);
        } else if (result.fatal) {
          console.warn(`[domain-graph] validation failed: ${result.fatal}`);
        }
      })
      .catch(() => {});
  }, [setDomainGraph]);

  return (
    <I18nProvider language={outputLanguage ?? "zh"}>
      <ThemeProvider metaTheme={metaTheme}>
        <DashboardContent
          accessToken={accessToken}
          loadError={loadError}
          graphIssues={graphIssues}
          knowledgeContextIndex={knowledgeContextIndex}
        />
      </ThemeProvider>
    </I18nProvider>
  );
}

function DashboardContent(props: {
  accessToken: string;
  loadError: string | null;
  graphIssues: GraphIssue[];
  knowledgeContextIndex: KnowledgeContextIndex;
}) {
  const { accessToken, loadError, graphIssues, knowledgeContextIndex } = props;
  const graph = useDashboardStore((s) => s.graph);
  const viewGraph = useDashboardStore((s) => s.viewGraph);
  const dashboardSurface = useDashboardStore((s) => s.dashboardSurface);
  const setDashboardSurface = useDashboardStore((s) => s.setDashboardSurface);
  const selectedNodeId = useDashboardStore((s) => s.selectedNodeId);
  const tourActive = useDashboardStore((s) => s.tourActive);
  const persona = useDashboardStore((s) => s.persona);
  const codeViewerOpen = useDashboardStore((s) => s.codeViewerOpen);
  const codeViewerExpanded = useDashboardStore((s) => s.codeViewerExpanded);
  const expandCodeViewer = useDashboardStore((s) => s.expandCodeViewer);
  const collapseCodeViewer = useDashboardStore((s) => s.collapseCodeViewer);
  const pathFinderOpen = useDashboardStore((s) => s.pathFinderOpen);
  const togglePathFinder = useDashboardStore((s) => s.togglePathFinder);
  const nodeTypeFilters = useDashboardStore((s) => s.nodeTypeFilters);
  const toggleNodeTypeFilter = useDashboardStore((s) => s.toggleNodeTypeFilter);
  const detailLevel = useDashboardStore((s) => s.detailLevel);
  const setDetailLevel = useDashboardStore((s) => s.setDetailLevel);
  const showFunctionsInClassView = useDashboardStore((s) => s.showFunctionsInClassView);
  const toggleShowFunctionsInClassView = useDashboardStore((s) => s.toggleShowFunctionsInClassView);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("info");
  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding);
  const dismissOnboarding = useCallback((remember: boolean) => {
    if (remember && typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
    }
    setShowOnboarding(false);
  }, []);
  const viewMode = useDashboardStore((s) => s.viewMode);
  const setViewMode = useDashboardStore((s) => s.setViewMode);
  const isKnowledgeGraph = useDashboardStore((s) => s.isKnowledgeGraph);
  const domainGraph = useDashboardStore((s) => s.domainGraph);
  const navigationLevel = useDashboardStore((s) => s.navigationLevel);
  const activeFileId = useDashboardStore((s) => s.activeFileId);
  const layoutIssues = useDashboardStore((s) => s.layoutIssues);
  const isMobile = useIsMobile();
  const { t } = useI18n();
  const isPeerDashboardSurface = dashboardSurface === "wiki" || dashboardSurface === "graph";
  const showLegacyGraphControls =
    !isPeerDashboardSurface && shouldShowGraphControls({ viewMode, isKnowledgeGraph });
  const showStructuralWorkbench = Boolean(
    graph && viewGraph && viewMode === "structural" && !isKnowledgeGraph,
  );
  const allIssues = useMemo(
    () => [...graphIssues, ...layoutIssues],
    [graphIssues, layoutIssues],
  );

  useEffect(() => {
    if (selectedNodeId) setSidebarTab("info");
  }, [selectedNodeId]);

  useEffect(() => {
    if (persona === "experienced" && !selectedNodeId) {
      setSidebarTab("files");
    } else if (persona !== "experienced") {
      setSidebarTab("info");
    }
  }, [persona, selectedNodeId]);

  // Define keyboard shortcuts
  const shortcuts = useMemo<KeyboardShortcut[]>(
    () => [
      // Help
      {
        key: "?",
        shiftKey: true,
        description: t.keyboardShortcuts.showHelp,
        action: () => setShowKeyboardHelp((prev) => !prev),
        category: "General",
      },
      // Navigation
      {
        key: "Escape",
        description: t.keyboardShortcuts.escapeDesc,
        action: () => {
          if (showKeyboardHelp) {
            setShowKeyboardHelp(false);
            return;
          }
          // Read from store at invocation time to avoid stale closures
          const state = useDashboardStore.getState();
          if (state.pathFinderOpen) {
            state.togglePathFinder();
          } else if (state.filterPanelOpen) {
            state.toggleFilterPanel();
          } else if (state.exportMenuOpen) {
            state.toggleExportMenu();
          } else if (state.codeViewerExpanded) {
            state.collapseCodeViewer();
          } else if (state.codeViewerOpen) {
            state.closeCodeViewer();
          } else if (state.navigationLevel === "file-detail") {
            state.closeFileDetail();
          } else if (state.selectedNodeId) {
            state.selectNode(null);
          } else if (state.navigationLevel === "layer-detail") {
            state.navigateToOverview();
          } else if (state.tourActive) {
            state.stopTour();
          }
        },
        category: "Navigation",
      },
      {
        key: "/",
        description: t.keyboardShortcuts.focusSearch,
        action: () => {
          const searchInput = document.querySelector<HTMLInputElement>(
            '[data-testid="search-input"]'
          );
          searchInput?.focus();
        },
        category: "Navigation",
      },
      // Tour controls
      {
        key: "ArrowRight",
        description: t.keyboardShortcuts.nextStep,
        action: () => {
          const state = useDashboardStore.getState();
          if (state.tourActive) {
            state.nextTourStep();
          }
        },
        category: "Tour",
      },
      {
        key: "ArrowLeft",
        description: t.keyboardShortcuts.prevStep,
        action: () => {
          const state = useDashboardStore.getState();
          if (state.tourActive) {
            state.prevTourStep();
          }
        },
        category: "Tour",
      },
      // View toggles
      {
        key: "d",
        description: t.keyboardShortcuts.toggleDiff,
        action: () => {
          const state = useDashboardStore.getState();
          if (!shouldShowGraphControls({
            viewMode: state.viewMode,
            isKnowledgeGraph: state.isKnowledgeGraph,
          })) {
            return;
          }
          state.toggleDiffMode();
        },
        category: "View",
      },
      {
        key: "f",
        description: t.keyboardShortcuts.toggleFilter,
        action: () => {
          const state = useDashboardStore.getState();
          if (!shouldShowGraphControls({
            viewMode: state.viewMode,
            isKnowledgeGraph: state.isKnowledgeGraph,
          })) {
            return;
          }
          state.toggleFilterPanel();
        },
        category: "View",
      },
      {
        key: "e",
        description: t.keyboardShortcuts.toggleExport,
        action: () => {
          const state = useDashboardStore.getState();
          state.toggleExportMenu();
        },
        category: "View",
      },
      {
        key: "p",
        description: t.keyboardShortcuts.openPathFinder,
        action: () => {
          const state = useDashboardStore.getState();
          if (state.dashboardSurface === "wiki" || state.dashboardSurface === "graph") {
            return;
          }
          if (!shouldShowGraphControls({
            viewMode: state.viewMode,
            isKnowledgeGraph: state.isKnowledgeGraph,
          })) {
            return;
          }
          state.togglePathFinder();
        },
        category: "View",
      },
    ],
    [t, showKeyboardHelp]
  );

  // Register keyboard shortcuts
  useKeyboardShortcuts(shortcuts);

  // Determine sidebar content
  // NodeInfo always takes priority when a node is selected.
  // Learn mode adds LearnPanel below it; otherwise ProjectOverview shows when idle.
  const isLearnMode = tourActive || persona === "junior";
  const infoSidebarContent = (
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

  const tabbedSidebarContent = (
    <>
      <div className="flex items-center gap-1 p-2 border-b border-border-subtle bg-surface shrink-0">
        {(["info", "files"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSidebarTab(tab)}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
              sidebarTab === tab
                ? "bg-accent/15 text-accent"
                : "text-text-muted hover:text-text-primary hover:bg-elevated"
            }`}
          >
            {tab === "info" ? t.sidebar.info : t.sidebar.files}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {sidebarTab === "files" ? <FileExplorer /> : infoSidebarContent}
      </div>
    </>
  );

  const structuralSidebarContent =
    persona === "junior" ? (
      <Suspense fallback={null}>
        <LearnPanel />
      </Suspense>
    ) : persona === "experienced" ? (
      tabbedSidebarContent
    ) : (
      <ReadingAssistantPanel />
    );

  const sidebarContent = (
    <div className="h-full flex flex-col min-h-0">
      {viewMode === "structural" && !isKnowledgeGraph ? (
        structuralSidebarContent
      ) : (
        tabbedSidebarContent
      )}
    </div>
  );

  if (isMobile) {
    return (
      <MobileLayout
        accessToken={accessToken}
        showKeyboardHelp={showKeyboardHelp}
        setShowKeyboardHelp={setShowKeyboardHelp}
        loadError={loadError}
        allIssues={allIssues}
        shortcuts={shortcuts}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-root text-text-primary noise-overlay">
      {/* Header */}
      <header className="flex items-center px-3 sm:px-5 py-3 bg-surface border-b border-border-subtle shrink-0 gap-2 sm:gap-4">
        {/* Left — fixed */}
        <div className="flex items-center gap-3 sm:gap-5 shrink-0 min-w-0">
          <h1 className="font-heading text-base sm:text-lg text-text-primary tracking-wide truncate max-w-[160px] sm:max-w-[220px] lg:max-w-none">
            {graph?.project.name ?? t.common.appName}
          </h1>
          <div className="flex items-center rounded-md border border-border-subtle bg-elevated p-0.5">
            <button
              type="button"
              onClick={() => setDashboardSurface("wiki")}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                dashboardSurface === "wiki" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              Wiki
            </button>
            <button
              type="button"
              onClick={() => setDashboardSurface("graph")}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                dashboardSurface === "graph" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              Graph
            </button>
          </div>
          <div className="w-px h-5 bg-border-subtle hidden sm:block" />
          <PersonaSelector />
          {!isPeerDashboardSurface && graph && !isKnowledgeGraph && domainGraph && (
            <>
              <div className="w-px h-5 bg-border-subtle" />
              <div className="flex items-center bg-elevated rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("domain")}
                  title={t.drawer.domain}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    viewMode === "domain"
                      ? "bg-accent/20 text-accent"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {t.drawer.domain}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("structural")}
                  title={t.drawer.structural}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    viewMode === "structural"
                      ? "bg-accent/20 text-accent"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {t.drawer.structural}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Middle — scrollable legends */}
        <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-4 w-max">
            {showLegacyGraphControls && <DiffToggle />}
            {/* Detail level: file view (architecture) / class view (code structure) */}
            {!isKnowledgeGraph && viewMode !== "domain" && showLegacyGraphControls && (
              <>
                <div className="w-px h-5 bg-border-subtle" />
                <div className="flex items-center bg-elevated rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setDetailLevel("file")}
                    title={t.detailLevel.filesTitle}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      detailLevel === "file"
                        ? "bg-accent/20 text-accent"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {t.detailLevel.files}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailLevel("class")}
                    title={t.detailLevel.classesTitle}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      detailLevel === "class"
                        ? "bg-accent/20 text-accent"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {t.detailLevel.classes}
                  </button>
                </div>
                {detailLevel === "class" && (
                  <button
                    type="button"
                    onClick={toggleShowFunctionsInClassView}
                    title={t.detailLevel.fnTitle}
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
                      showFunctionsInClassView
                        ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                        : "border-border-medium bg-elevated text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {t.detailLevel.fn}
                  </button>
                )}
              </>
            )}
            {showLegacyGraphControls && (
              <>
                <div className="flex items-center gap-1">
                  {(isKnowledgeGraph ? [
                    { key: "knowledge" as const, label: t.nodeTypeLabels.all, color: "var(--color-node-article)" },
                  ] : [
                    { key: "code" as const, label: t.nodeTypeLabels.code, color: "var(--color-node-file)" },
                    { key: "config" as const, label: t.nodeTypeLabels.config, color: "var(--color-node-config)" },
                    { key: "docs" as const, label: t.nodeTypeLabels.docs, color: "var(--color-node-document)" },
                    { key: "infra" as const, label: t.nodeTypeLabels.infra, color: "var(--color-node-service)" },
                    { key: "data" as const, label: t.nodeTypeLabels.data, color: "var(--color-node-table)" },
                    { key: "domain" as const, label: t.nodeTypeLabels.domain, color: "var(--color-node-concept)" },
                    { key: "knowledge" as const, label: t.nodeTypeLabels.knowledge, color: "var(--color-node-article)" },
                  ]).map((cat) => (
                    <button
                      key={cat.key}
                      onClick={() => toggleNodeTypeFilter(cat.key)}
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                        nodeTypeFilters[cat.key] !== false
                          ? "border-border-medium bg-elevated text-text-secondary hover:text-text-primary"
                          : "border-transparent bg-transparent text-text-muted/40 line-through hover:text-text-muted"
                      }`}
                      title={`${
                        nodeTypeFilters[cat.key] !== false
                          ? t.nodeTypeFilter.hide
                          : t.nodeTypeFilter.show
                      } ${cat.label} ${t.nodeTypeFilter.nodesLabel}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor: cat.color,
                          opacity: nodeTypeFilters[cat.key] !== false ? 1 : 0.3,
                        }}
                      />
                      {cat.label}
                    </button>
                  ))}
                </div>
                <LayerLegend />
              </>
            )}
          </div>
        </div>

        {/* Right — fixed actions */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {showLegacyGraphControls && <FilterPanel />}
          <ExportMenu />
          {showLegacyGraphControls && (
            <button
              onClick={togglePathFinder}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm bg-elevated text-text-secondary hover:text-text-primary transition-colors"
              title={t.pathFinder.title}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              <span className="hidden md:inline">{t.common.path}</span>
            </button>
          )}
          <ThemePicker />
          <button
            onClick={() => setShowKeyboardHelp(true)}
            className="text-text-muted hover:text-accent transition-colors"
            title={t.keyboardShortcuts.showHelp}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Search */}
      <SearchBar />

      {/* Validation warning banner */}
      {allIssues.length > 0 && !loadError && (
        <WarningBanner issues={allIssues} />
      )}

      {/* Error banner */}
      {loadError && (
        <div className="px-5 py-3 bg-red-900/30 border-b border-red-700 text-red-200 text-sm">
          {loadError}
        </div>
      )}

      {/* Main content: Graph + Sidebar */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Graph area */}
        <div className="relative flex min-h-0 min-w-0 flex-1">
          {dashboardSurface === "wiki" ? (
            <KnowledgeConsole />
          ) : dashboardSurface === "graph" ? (
            <GraphExplorer />
          ) : viewMode === "knowledge" ? (
            <KnowledgeGraphView />
          ) : viewMode === "domain" && domainGraph ? (
            <DomainGraphView />
          ) : showStructuralWorkbench && graph && viewGraph ? (
            <VisualGuidedWorkbench
              graph={graph}
              viewGraph={viewGraph}
              knowledgeContextIndex={knowledgeContextIndex}
            />
          ) : navigationLevel === "file-detail" && activeFileId ? (
            <FunctionDetailPage />
          ) : (
            <ReadableViewGraphPage />
          )}
          {!isPeerDashboardSurface && (
            <div className="absolute top-3 right-3 text-sm text-text-muted/60 pointer-events-none select-none">
              {t.common.pressKeyboard}
            </div>
          )}
        </div>

        {/* Right sidebar — telescopes at narrower widths */}
        {!isPeerDashboardSurface && navigationLevel !== "file-detail" && !showStructuralWorkbench && (
          <aside className="w-[260px] md:w-[300px] lg:w-[360px] shrink-0 bg-surface border-l border-border-subtle overflow-auto">
            {sidebarContent}
          </aside>
        )}

        {/* Code viewer slide-up overlay (collapsed state) */}
        {codeViewerOpen && !codeViewerExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-[40vh] bg-surface border-t border-border-subtle animate-slide-up z-20 overflow-hidden">
            <Suspense fallback={null}>
              <CodeViewer accessToken={accessToken} onExpand={expandCodeViewer} />
            </Suspense>
          </div>
        )}
      </div>

      {/* Expanded code viewer modal */}
      {codeViewerOpen && codeViewerExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 sm:p-6"
          onMouseDown={collapseCodeViewer}
        >
          <div
            className="w-[calc(100vw-32px)] max-w-[1120px] h-[calc(100vh-32px)] sm:h-[calc(100vh-48px)] max-h-[820px] rounded-lg border border-border-medium bg-surface shadow-2xl overflow-hidden"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Suspense fallback={null}>
              <CodeViewer
                accessToken={accessToken}
                presentation="modal"
                onClose={collapseCodeViewer}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts help modal */}
      {showKeyboardHelp && (
        <Suspense fallback={null}>
          <KeyboardShortcutsHelp
            shortcuts={shortcuts}
            onClose={() => setShowKeyboardHelp(false)}
          />
        </Suspense>
      )}

      {/* Path Finder Modal — only mounted when open so its chunk is lazy-loaded on demand. */}
      {showLegacyGraphControls && pathFinderOpen && (
        <Suspense fallback={null}>
          <PathFinderModal isOpen={pathFinderOpen} onClose={togglePathFinder} />
        </Suspense>
      )}

      {/* First-visit onboarding overlay — only mounted when needed so its chunk is lazy-loaded on demand. */}
      {showOnboarding && (
        <Suspense fallback={null}>
          <OnboardingOverlay onDismiss={dismissOnboarding} />
        </Suspense>
      )}
    </div>
  );
}

export default App;
