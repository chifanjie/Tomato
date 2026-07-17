import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import type { GraphIssue } from "@understand-code/core/schema";
import { validateGraph } from "@understand-code/core/schema";
import GlobalWikiSearch from "./components/wiki/GlobalWikiSearch";
import KnowledgeConsole from "./components/wiki/KnowledgeConsole";
import { GLOBAL_WIKI_SEARCH_REQUEST_EVENT } from "./components/wiki/WikiResponsiveShell";
import DashboardHeader from "./components/DashboardHeader";
import TokenGate from "./components/TokenGate";
import WarningBanner from "./components/WarningBanner";
import { normalizeLegacyGraphBranding } from "./legacyBranding";
import { useDashboardStore } from "./store";
import { ThemeProvider } from "./themes/index.ts";
import { InitialThemeGate } from "./themes/InitialThemeGate";
import {
  loadDashboardKnowledge,
  shouldRetryWikiLoad,
  type DashboardKnowledge,
} from "./workbench/knowledgeContextLoader";
import {
  createSearchArtifactRequestController,
  type SearchLoadStatus,
} from "./wiki/wikiArtifacts";
import { buildWikiSearchRuntime, type WikiSearchRuntime } from "./wiki/searchIndex";
import {
  wikiTargetFromHash,
  wikiTargetHash,
  type WikiTarget,
} from "./wiki/wikiContent";

const GraphExplorer = lazy(() => import("./components/graphExplorer/GraphExplorer"));

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
const TOKEN_STORAGE_KEY = "understand-code-token";
const WIKI_RELOAD_INTERVAL_MS = 1000;
const WIKI_RELOAD_MAX_ATTEMPTS = 3;

export type WikiAvailabilityStatus =
  | "loading"
  | "ready"
  | "empty"
  | "missing"
  | "invalid"
  | "error";

export type WikiFailureStatus = Exclude<WikiAvailabilityStatus, "loading" | "ready">;

export const WIKI_AVAILABILITY_COPY: Record<
  WikiFailureStatus,
  { title: string; description: string }
> = {
  empty: {
    title: "知识库还没有正文",
    description: "索引已读取，但没有可发布页面；关系图谱仍可使用。请重新运行知识库生成。",
  },
  missing: {
    title: "尚未生成知识库",
    description: "没有找到 wiki-index.json；关系图谱仍可使用。请运行知识库生成命令后刷新。",
  },
  invalid: {
    title: "知识库索引无效",
    description: "索引无法通过 V2 校验，因此未展示可能错误的映射；关系图谱仍可使用。请重新生成知识库。",
  },
  error: {
    title: "知识库读取失败",
    description: "读取索引时发生网络或本地服务错误；关系图谱仍可使用。请检查服务后重试。",
  },
};

export function resolveWikiAvailability(
  status: Exclude<DashboardKnowledge["wikiStatus"], "forbidden">,
  pageCount: number,
): WikiAvailabilityStatus {
  if (status === "ready") return pageCount > 0 ? "ready" : "empty";
  return status;
}

export function WikiAvailabilityView({ status }: { status: WikiFailureStatus }) {
  const copy = WIKI_AVAILABILITY_COPY[status];
  return (
    <main className="flex min-h-0 flex-1 items-center justify-center bg-root px-5 py-10">
      <section aria-labelledby="wiki-availability-title" className="uc-panel max-w-xl p-6 text-center">
        <h2 id="wiki-availability-title" className="text-xl font-semibold text-text-primary">
          {copy.title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-text-secondary">{copy.description}</p>
      </section>
    </main>
  );
}

interface GraphChunkErrorBoundaryProps {
  children: ReactNode;
  onBackToWiki: () => void;
  onReload?: () => void;
}

interface GraphChunkErrorBoundaryState {
  failed: boolean;
}

export class GraphChunkErrorBoundary extends Component<
  GraphChunkErrorBoundaryProps,
  GraphChunkErrorBoundaryState
> {
  state: GraphChunkErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): GraphChunkErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Recovery remains local so the Wiki shell does not disappear with the graph chunk.
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center bg-root px-5 py-10">
        <section className="uc-panel max-w-lg p-6 text-center" role="alert">
          <h2 className="text-xl font-semibold text-text-primary">关系图谱加载失败</h2>
          <p className="mt-3 text-sm leading-7 text-text-secondary">
            图谱资源可能已更新或网络暂时不可用，知识库仍可继续阅读。
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={this.props.onBackToWiki}
              className="rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent"
            >
              返回知识库
            </button>
            <button
              type="button"
              onClick={this.props.onReload ?? (() => window.location.reload())}
              className="rounded-md border border-border-medium px-3 py-2 text-sm font-semibold text-text-secondary"
            >
              重新加载页面
            </button>
          </div>
        </section>
      </main>
    );
  }
}

export function applyDashboardKnowledgeResult(
  result: DashboardKnowledge,
  handlers: {
    setWikiIndex: (index: DashboardKnowledge["wikiIndex"]) => void;
    setWikiAvailability: (status: WikiAvailabilityStatus) => void;
    onTokenInvalid: () => void;
  },
): WikiAvailabilityStatus | "forbidden" {
  if (result.wikiStatus === "forbidden") {
    handlers.onTokenInvalid();
    return "forbidden";
  }
  handlers.setWikiIndex(result.wikiIndex);
  const availability = resolveWikiAvailability(result.wikiStatus, result.wikiIndex.pageCount);
  handlers.setWikiAvailability(availability);
  return availability;
}

interface AppRoutingBrowser {
  location: Pick<Location, "pathname" | "search" | "hash">;
  history: Pick<History, "pushState" | "replaceState">;
  addEventListener: Window["addEventListener"];
  removeEventListener: Window["removeEventListener"];
}

interface AppRoutingControllerOptions {
  browser: AppRoutingBrowser;
  pageExists: (pageId: string) => boolean;
  getActiveWikiPageId: () => string | null;
  setDashboardSurface: (surface: "wiki" | "graph") => void;
  selectWikiPage: (pageId: string | null) => void;
  openWikiTarget: (target: WikiTarget) => void;
  openGraphForWikiPage: (pageId: string) => void;
  recentWikiTargetRef: { current: WikiTarget | null };
  onWikiLocationApplied: (target: WikiTarget | null) => void;
}

export interface AppRoutingController {
  applyLocation: () => void;
  selectSurface: (surface: "wiki" | "graph") => void;
  selectWikiTarget: (target: WikiTarget) => boolean;
  selectWikiHome: () => void;
  selectGraphForWikiPage: (pageId: string) => boolean;
  start: () => () => void;
}

function validFragmentTarget(hash: string, pageId: string | null): WikiTarget | null {
  const match = hash.match(/^#([^&=]+)$/u);
  if (!match || hash === "#wiki" || hash === "#graph" || !pageId) return null;
  try {
    const anchor = decodeURIComponent(match[1] ?? "");
    return anchor && !anchor.includes("\0") && !anchor.includes("\uFFFD")
      ? { pageId, anchor }
      : null;
  } catch {
    return null;
  }
}

function appLocation(browser: AppRoutingBrowser, hash: string): string {
  return `${browser.location.pathname}${browser.location.search}${hash}`;
}

export function createAppRoutingController(
  options: AppRoutingControllerOptions,
): AppRoutingController {
  const {
    browser,
    pageExists,
    getActiveWikiPageId,
    setDashboardSurface,
    selectWikiPage,
    openWikiTarget,
    openGraphForWikiPage,
    recentWikiTargetRef,
    onWikiLocationApplied,
  } = options;

  const rememberCurrentWikiTarget = () => {
    const hashTarget = wikiTargetFromHash(browser.location.hash);
    if (hashTarget && pageExists(hashTarget.pageId)) {
      recentWikiTargetRef.current = hashTarget;
      return;
    }
    const activePageId = getActiveWikiPageId();
    const fragmentTarget = validFragmentTarget(browser.location.hash, activePageId);
    if (fragmentTarget && pageExists(fragmentTarget.pageId)) {
      recentWikiTargetRef.current = fragmentTarget;
      return;
    }
    if (activePageId && pageExists(activePageId)) {
      recentWikiTargetRef.current = { pageId: activePageId };
    }
  };

  const selectWikiTarget = (target: WikiTarget): boolean => {
    if (!pageExists(target.pageId)) return false;
    recentWikiTargetRef.current = target;
    setDashboardSurface("wiki");
    openWikiTarget(target);
    onWikiLocationApplied(target);
    browser.history.pushState(null, "", appLocation(browser, wikiTargetHash(target)));
    return true;
  };

  const selectWikiHome = () => {
    recentWikiTargetRef.current = null;
    setDashboardSurface("wiki");
    selectWikiPage(null);
    onWikiLocationApplied(null);
    browser.history.pushState(null, "", appLocation(browser, ""));
  };

  const selectSurface = (surface: "wiki" | "graph") => {
    if (surface === "graph") {
      if (browser.location.hash === "#graph") return;
      rememberCurrentWikiTarget();
      setDashboardSurface("graph");
      browser.history.pushState(null, "", appLocation(browser, "#graph"));
      return;
    }
    if (browser.location.hash !== "#graph") rememberCurrentWikiTarget();
    const remembered = recentWikiTargetRef.current;
    if (remembered && pageExists(remembered.pageId)) {
      setDashboardSurface("wiki");
      openWikiTarget(remembered);
      onWikiLocationApplied(remembered);
      browser.history.pushState(null, "", appLocation(browser, wikiTargetHash(remembered)));
      return;
    }
    const activePageId = getActiveWikiPageId();
    if (activePageId && pageExists(activePageId)) {
      const target = { pageId: activePageId };
      recentWikiTargetRef.current = target;
      setDashboardSurface("wiki");
      openWikiTarget(target);
      onWikiLocationApplied(target);
      browser.history.pushState(null, "", appLocation(browser, wikiTargetHash(target)));
      return;
    }
    selectWikiHome();
  };

  const selectGraphForWikiPage = (pageId: string): boolean => {
    if (!pageExists(pageId)) return false;
    rememberCurrentWikiTarget();
    openGraphForWikiPage(pageId);
    browser.history.pushState(null, "", appLocation(browser, "#graph"));
    return true;
  };

  const applyLocation = () => {
    const hash = browser.location.hash;
    if (hash === "#graph") {
      setDashboardSurface("graph");
      return;
    }
    setDashboardSurface("wiki");
    const target = wikiTargetFromHash(hash);
    if (target) {
      if (pageExists(target.pageId)) {
        recentWikiTargetRef.current = target;
        openWikiTarget(target);
        onWikiLocationApplied(target);
      }
      return;
    }
    if (!hash || hash === "#wiki") {
      recentWikiTargetRef.current = null;
      selectWikiPage(null);
      onWikiLocationApplied(null);
      return;
    }
    const fragmentTarget = validFragmentTarget(hash, getActiveWikiPageId());
    if (!fragmentTarget || !pageExists(fragmentTarget.pageId)) return;
    recentWikiTargetRef.current = fragmentTarget;
    openWikiTarget(fragmentTarget);
    onWikiLocationApplied(fragmentTarget);
    browser.history.replaceState(null, "", appLocation(browser, wikiTargetHash(fragmentTarget)));
  };

  const start = () => {
    const onLocation = () => applyLocation();
    applyLocation();
    browser.addEventListener("popstate", onLocation);
    browser.addEventListener("hashchange", onLocation);
    return () => {
      browser.removeEventListener("popstate", onLocation);
      browser.removeEventListener("hashchange", onLocation);
    };
  };

  return {
    applyLocation,
    selectSurface,
    selectWikiTarget,
    selectWikiHome,
    selectGraphForWikiPage,
    start,
  };
}

function dataUrl(fileName: string, token: string | null): string {
  if (DEMO_MODE) {
    const envMap: Record<string, string | undefined> = {
      "knowledge-graph.json": import.meta.env.VITE_GRAPH_URL,
      "meta.json": import.meta.env.VITE_META_URL,
    };
    const url = envMap[fileName];
    if (url) return url;
  }
  const path = `/${fileName}`;
  return token ? `${path}?token=${encodeURIComponent(token)}` : path;
}

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
  if (!urlToken) return readStoredToken();
  writeStoredToken(urlToken);
  params.delete("token");
  const cleanSearch = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ""}${window.location.hash}`,
  );
  return urlToken;
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

  if (DEMO_MODE) {
    return <Dashboard accessToken="__demo__" onTokenInvalid={handleTokenInvalid} />;
  }
  if (accessToken === null) return <TokenGate onTokenValid={handleTokenValid} />;
  return <Dashboard accessToken={accessToken} onTokenInvalid={handleTokenInvalid} />;
}

export const GRAPH_LOAD_ERROR_COPY = {
  invalid: "关系图谱无效，请重新生成知识图谱后刷新。",
  read: "关系图谱读取失败，请检查网络或确认知识库服务正在运行。",
} as const;

function Dashboard({
  accessToken,
  onTokenInvalid,
}: {
  accessToken: string;
  onTokenInvalid: () => void;
}) {
  const setConsoleGraph = useDashboardStore((state) => state.setConsoleGraph);
  const setWikiIndex = useDashboardStore((state) => state.setWikiIndex);
  const [wikiAvailability, setWikiAvailability] = useState<WikiAvailabilityStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [graphIssues, setGraphIssues] = useState<GraphIssue[]>([]);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let retryTimer: number | undefined;

    async function loadWiki(): Promise<void> {
      const result = await loadDashboardKnowledge(accessToken);
      if (cancelled) return;
      const availability = applyDashboardKnowledgeResult(result, {
        setWikiIndex,
        setWikiAvailability,
        onTokenInvalid,
      });
      if (availability === "forbidden") return;
      if (!shouldRetryWikiLoad(result.wikiStatus, attempts, WIKI_RELOAD_MAX_ATTEMPTS)) return;
      attempts += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        void loadWiki();
      }, WIKI_RELOAD_INTERVAL_MS);
    }

    void loadWiki();
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [accessToken, onTokenInvalid, setWikiIndex]);

  useEffect(() => {
    let cancelled = false;
    void fetch(dataUrl("knowledge-graph.json", accessToken))
      .then((response) => {
        if (response.status === 403) {
          onTokenInvalid();
          throw new Error("TOKEN_INVALID");
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((data) => {
        if (cancelled) return;
        const result = validateGraph(data);
        if (result.success && result.data) {
          setConsoleGraph(normalizeLegacyGraphBranding(result.data));
          setGraphIssues(result.issues);
          return;
        }
        console.warn("关系图谱校验失败", result.fatal, result.issues);
        setLoadError(GRAPH_LOAD_ERROR_COPY.invalid);
      })
      .catch((error: unknown) => {
        if (cancelled || (error instanceof Error && error.message === "TOKEN_INVALID")) return;
        console.warn("关系图谱读取失败", error);
        setLoadError(GRAPH_LOAD_ERROR_COPY.read);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, onTokenInvalid, setConsoleGraph]);

  return (
    <InitialThemeGate metaUrl={dataUrl("meta.json", accessToken)}>
      {(initialTheme) => (
        <ThemeProvider initialConfig={initialTheme}>
          <DashboardContent
            accessToken={accessToken}
            onTokenInvalid={onTokenInvalid}
            loadError={loadError}
            graphIssues={graphIssues}
            wikiAvailability={wikiAvailability}
          />
        </ThemeProvider>
      )}
    </InitialThemeGate>
  );
}

function DashboardContent({
  accessToken,
  onTokenInvalid,
  loadError,
  graphIssues,
  wikiAvailability,
}: {
  accessToken: string;
  onTokenInvalid: () => void;
  loadError: string | null;
  graphIssues: GraphIssue[];
  wikiAvailability: WikiAvailabilityStatus;
}) {
  const graph = useDashboardStore((state) => state.graph);
  const dashboardSurface = useDashboardStore((state) => state.dashboardSurface);
  const setDashboardSurface = useDashboardStore((state) => state.setDashboardSurface);
  const wikiIndex = useDashboardStore((state) => state.wikiIndex);
  const selectWikiPage = useDashboardStore((state) => state.selectWikiPage);
  const openWikiTarget = useDashboardStore((state) => state.openWikiTarget);
  const openGraphForWikiPage = useDashboardStore((state) => state.openGraphForWikiPage);
  const [searchOpen, setSearchOpen] = useState(false);
  const [wikiDrawerOpen, setWikiDrawerOpen] = useState(false);
  const [wikiNavigationRevision, setWikiNavigationRevision] = useState(0);
  const [searchLoadStatus, setSearchLoadStatus] = useState<SearchLoadStatus>("idle");
  const [searchRuntime, setSearchRuntime] = useState<WikiSearchRuntime>(() =>
    buildWikiSearchRuntime([], wikiIndex, "fallback"));
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchControllerRef = useRef(createSearchArtifactRequestController());
  const fullSearchRecordsRef = useRef<Parameters<typeof buildWikiSearchRuntime>[0]>([]);
  const recentWikiTargetRef = useRef<WikiTarget | null>(null);
  const noteWikiLocationApplied = useCallback(() => {
    setWikiNavigationRevision((revision) => revision + 1);
  }, []);
  const routingController = useMemo(
    () => createAppRoutingController({
      browser: window,
      pageExists: (pageId) => wikiIndex.pagesById.has(pageId),
      getActiveWikiPageId: () => useDashboardStore.getState().activeWikiPageId,
      setDashboardSurface,
      selectWikiPage,
      openWikiTarget,
      openGraphForWikiPage,
      recentWikiTargetRef,
      onWikiLocationApplied: noteWikiLocationApplied,
    }),
    [
      noteWikiLocationApplied,
      openGraphForWikiPage,
      openWikiTarget,
      selectWikiPage,
      setDashboardSurface,
      wikiIndex,
    ],
  );

  useEffect(() => routingController.start(), [routingController]);

  useEffect(() => {
    searchControllerRef.current.reset(accessToken);
    fullSearchRecordsRef.current = [];
    setSearchLoadStatus("idle");
    setSearchRuntime(buildWikiSearchRuntime([], wikiIndex, "fallback"));
  }, [accessToken]);

  useEffect(() => {
    if (searchLoadStatus === "ready") {
      setSearchRuntime(buildWikiSearchRuntime(fullSearchRecordsRef.current, wikiIndex, "full"));
    } else if (searchLoadStatus === "fallback" || searchLoadStatus === "idle") {
      setSearchRuntime(buildWikiSearchRuntime([], wikiIndex, "fallback"));
    }
  }, [searchLoadStatus, wikiIndex]);

  useEffect(() => {
    const controller = searchControllerRef.current;
    if (!searchOpen) {
      controller.close();
      return;
    }
    const applyResult = (result: Awaited<ReturnType<typeof controller.open>>) => {
      if (!controller.isCurrent(accessToken)) return;
      if (result.status === "forbidden") {
        onTokenInvalid();
        return;
      }
      if (result.status === "ready") {
        fullSearchRecordsRef.current = result.records;
        setSearchRuntime(buildWikiSearchRuntime(result.records, wikiIndex, "full"));
        setSearchLoadStatus("ready");
      } else {
        fullSearchRecordsRef.current = [];
        setSearchRuntime(buildWikiSearchRuntime([], wikiIndex, "fallback"));
        setSearchLoadStatus("fallback");
      }
    };
    const cached = controller.snapshot();
    if (cached.token === accessToken && cached.result) {
      applyResult(cached.result);
      return;
    }
    setSearchLoadStatus("loading");
    void controller.open(accessToken).then(applyResult);
  }, [accessToken, onTokenInvalid, searchOpen, wikiIndex]);

  const requestGlobalSearch = useCallback(() => {
    if (searchOpen) return;
    window.dispatchEvent(new Event(GLOBAL_WIKI_SEARCH_REQUEST_EVENT));
    queueMicrotask(() => setSearchOpen(true));
  }, [searchOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        requestGlobalSearch();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [requestGlobalSearch]);

  const selectSearchTarget = useCallback((target: WikiTarget) => {
    if (routingController.selectWikiTarget(target)) setSearchOpen(false);
  }, [routingController]);

  return (
    <div className="h-screen w-screen flex flex-col bg-root text-text-primary">
      <DashboardHeader
        projectName={graph?.project.name ?? "代码知识库"}
        activeSurface={dashboardSurface}
        searchButtonRef={searchButtonRef}
        themeInert={wikiDrawerOpen || searchOpen}
        onSelectSurface={routingController.selectSurface}
        onRequestSearch={requestGlobalSearch}
      />

      {graphIssues.length > 0 && !loadError && <WarningBanner issues={graphIssues} />}
      {loadError && (
        <div className="uc-status-banner" data-severity="problem" role="alert">
          {loadError}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        {dashboardSurface === "wiki" ? (
          wikiAvailability === "loading" ? (
            <main
              className="flex min-h-0 flex-1 items-center justify-center bg-root px-5 py-10 text-sm text-text-muted"
              role="status"
            >
              正在读取知识库
            </main>
          ) : wikiAvailability === "ready" ? (
            <KnowledgeConsole
              onSelectWikiPage={(pageId) => {
                if (pageId) routingController.selectWikiTarget({ pageId });
                else routingController.selectWikiHome();
              }}
              onSelectWikiTarget={(target) => routingController.selectWikiTarget(target)}
              onOpenGraphHome={() => routingController.selectSurface("graph")}
              onOpenGraphForPage={(pageId) => routingController.selectGraphForWikiPage(pageId)}
              externalModalOpen={searchOpen}
              onDrawerOpenChange={setWikiDrawerOpen}
              wikiNavigationRevision={wikiNavigationRevision}
            />
          ) : (
            <WikiAvailabilityView status={wikiAvailability} />
          )
        ) : (
          <GraphChunkErrorBoundary onBackToWiki={() => routingController.selectSurface("wiki")}>
            <Suspense
              fallback={(
                <main
                  className="flex min-h-0 flex-1 items-center justify-center bg-root px-5 py-10 text-sm text-text-muted"
                  role="status"
                >
                  正在加载关系图谱
                </main>
              )}
            >
              <GraphExplorer
                onSelectWikiTarget={(target) => routingController.selectWikiTarget(target)}
                onRequestGlobalSearch={requestGlobalSearch}
              />
            </Suspense>
          </GraphChunkErrorBoundary>
        )}
      </div>

      <GlobalWikiSearch
        open={searchOpen}
        loadStatus={searchLoadStatus}
        runtime={searchRuntime}
        returnFocusRef={searchButtonRef}
        onClose={() => setSearchOpen(false)}
        onSelectTarget={selectSearchTarget}
      />
    </div>
  );
}

export default App;
