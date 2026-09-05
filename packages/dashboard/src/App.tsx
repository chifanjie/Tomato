import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useContext,
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
import DashboardHeader, { type ProductSurface } from "./components/DashboardHeader";
import TokenGate from "./components/TokenGate";
import WarningBanner from "./components/WarningBanner";
import TaskFirstWorkbench, {
  type TaskFirstRoute,
  type TaskFirstSection,
} from "./components/taskFirst/TaskFirstWorkbench";
import {
  taskFirstLocationStateFromLocation,
  taskFirstLocationUrl,
  taskFirstSectionPath,
  type TaskFirstLocationState,
  type TaskLocalSurface,
} from "./components/taskFirst/route";
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
import {
  loadTaskKnowledgeCandidates,
  loadTaskWorkbench,
  type TaskKnowledgeCandidatesPayloadV1,
  type TaskWorkbenchLoadResult,
  type TaskArtifactLoadResult,
} from "./workbench/taskContextLoader";
import {
  KnowledgeFetchContext,
  createPendingKnowledgeFetcher,
  createPublishedKnowledgeFetcher,
  parsePublishedKnowledgeVersion,
  type PublishedKnowledgeVersion,
} from "./workbench/publishedKnowledge";
import {
  COOKIE_WORKBENCH_ACCESS,
  dashboardFetchInit,
  isCookieWorkbenchAccess,
  isCookieWorkbenchLocation,
  withDashboardAccess,
} from "./workbench/transport";

const GraphExplorer = lazy(() => import("./components/graphExplorer/GraphExplorer"));

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
const TOKEN_STORAGE_KEY = "understand-code-token";
const WIKI_RELOAD_INTERVAL_MS = 1000;
const WIKI_RELOAD_MAX_ATTEMPTS = 3;
const KNOWLEDGE_GENERATION_ID = /^generation-[0-9a-f]{64}$/u;

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

export function WikiAvailabilityView({ status, onRetry, graphAvailable = true }: {
  status: WikiFailureStatus;
  onRetry?: () => void;
  graphAvailable?: boolean;
}) {
  const copy = WIKI_AVAILABILITY_COPY[status];
  const description = graphAvailable ? copy.description : copy.description.replace("；关系图谱仍可使用", "");
  return (
    <main className="flex min-h-0 flex-1 items-center justify-center bg-root px-5 py-10">
      <section aria-labelledby="wiki-availability-title" className="uc-panel max-w-xl p-6 text-center">
        <h2 id="wiki-availability-title" className="text-xl font-semibold text-text-primary">
          {copy.title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-text-secondary">{description}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 min-h-11 rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent"
          >
            重新读取知识库
          </button>
        )}
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
    let recentLocationEvent: { type: string; signature: string } | null = null;
    let recentLocationReset: ReturnType<typeof setTimeout> | null = null;
    const onLocation = (event: Event) => {
      const signature = appLocation(browser, browser.location.hash);
      const isPairedTraversalEvent = recentLocationEvent?.signature === signature
        && recentLocationEvent.type !== event.type;
      if (recentLocationReset !== null) {
        clearTimeout(recentLocationReset);
        recentLocationReset = null;
      }
      if (isPairedTraversalEvent) {
        recentLocationEvent = null;
        return;
      }
      recentLocationEvent = { type: event.type, signature };
      recentLocationReset = setTimeout(() => {
        recentLocationEvent = null;
        recentLocationReset = null;
      }, 0);
      applyLocation();
    };
    applyLocation();
    browser.addEventListener("popstate", onLocation);
    browser.addEventListener("hashchange", onLocation);
    return () => {
      if (recentLocationReset !== null) clearTimeout(recentLocationReset);
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
  return withDashboardAccess(path, token);
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
  if (isCookieWorkbenchLocation(window.location)) return COOKIE_WORKBENCH_ACCESS;
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

function taskLocationState(): TaskFirstLocationState | null {
  return taskFirstLocationStateFromLocation({
    pathname: window.location.pathname,
    search: window.location.search,
  });
}

interface TaskDashboardContext {
  readonly route: TaskFirstRoute;
  readonly surface: Exclude<TaskLocalSurface, "task">;
  readonly stale: boolean;
  readonly focusNodeId: string | null;
  readonly focusUnavailable: boolean;
  readonly onSelectSurface: (surface: "wiki" | "graph", focus?: string) => void;
  readonly onSelectWikiTarget: (target: WikiTarget) => void;
  readonly onSelectedGraphNode: (nodeId: string | null) => void;
  readonly onBackToFinding: () => void;
}

function selectedPendingKnowledgeGenerationId(
  context: TaskDashboardContext | undefined,
): string | undefined {
  if (context?.route.knowledgeVersion !== "pending") return undefined;
  const generationId = context.route.knowledgeGenerationId;
  return generationId && KNOWLEDGE_GENERATION_ID.test(generationId) ? generationId : undefined;
}

function TaskContextBanner({ context }: { readonly context: TaskDashboardContext }) {
  return (
    <section
      className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface px-4 py-2 sm:px-6"
      aria-label="任务上下文"
      data-testid="task-context-overlay"
      data-state={context.stale ? "stale" : context.focusUnavailable ? "unavailable" : "ready"}
    >
      <div className="min-w-0 text-xs text-text-secondary">
        <span className="font-semibold text-accent">任务</span>
        <span className="mx-1" aria-hidden="true">/</span>
        <span className="font-mono" title={context.route.taskId}>{context.route.taskId}</span>
        {context.route.findingId && <><span className="mx-1" aria-hidden="true">/</span><span className="font-mono" title={context.route.findingId}>{context.route.findingId}</span></>}
        {context.route.evidenceId && <><span className="mx-1" aria-hidden="true">/</span><span className="font-mono" title={context.route.evidenceId}>{context.route.evidenceId}</span></>}
        {context.stale && <span className="ml-2 font-semibold text-warning">已过期</span>}
        {!context.stale && context.focusUnavailable && <span className="ml-2 font-semibold text-warning">目标不可用</span>}
      </div>
      <button
        type="button"
        onClick={context.onBackToFinding}
        className="min-h-11 rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent"
        data-testid="workbench-back-to-task"
      >
        返回任务发现
      </button>
    </section>
  );
}

function TaskFirstDashboard({
  accessToken,
  onTokenInvalid,
  route,
  surface,
}: {
  readonly accessToken: string;
  readonly onTokenInvalid: () => void;
  readonly route: TaskFirstRoute;
  readonly surface: TaskLocalSurface;
}) {
  const taskSearchButtonRef = useRef<HTMLButtonElement>(null);
  const [loadState, setLoadState] = useState<{
    readonly loading: boolean;
    readonly result: TaskWorkbenchLoadResult | null;
  }>(() => ({ loading: Boolean(route.taskId), result: null }));
  const [knowledgeCandidateState, setKnowledgeCandidateState] = useState<{
    readonly loading: boolean;
    readonly result: TaskArtifactLoadResult<TaskKnowledgeCandidatesPayloadV1> | null;
  }>(() => ({ loading: false, result: null }));

  const load = useCallback(() => {
    if (!route.taskId) {
      setLoadState({ loading: false, result: { status: "missing" } });
      return () => undefined;
    }
    let cancelled = false;
    setLoadState({ loading: true, result: null });
    void loadTaskWorkbench(route, accessToken).then((result) => {
      if (cancelled) return;
      if (result.status === "forbidden") {
        onTokenInvalid();
        return;
      }
      setLoadState({ loading: false, result });
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, onTokenInvalid, route.evidenceId, route.section, route.taskId]);

  useEffect(() => load(), [load]);

  const loadKnowledgeCandidates = useCallback(() => {
    if (!route.taskId || route.section !== "planned_changes") {
      setKnowledgeCandidateState({ loading: false, result: null });
      return () => undefined;
    }
    let cancelled = false;
    setKnowledgeCandidateState({ loading: true, result: null });
    void loadTaskKnowledgeCandidates(route, accessToken).then((result) => {
      if (cancelled) return;
      if (result.status === "forbidden") {
        onTokenInvalid();
        return;
      }
      setKnowledgeCandidateState({ loading: false, result });
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, onTokenInvalid, route.section, route.taskId]);

  useEffect(() => loadKnowledgeCandidates(), [loadKnowledgeCandidates]);

  const cookieMode = isCookieWorkbenchAccess(accessToken);
  const navigate = useCallback((nextRoute: TaskFirstRoute, nextSurface: TaskLocalSurface) => {
    const target = taskFirstLocationUrl(
      { route: nextRoute, surface: nextSurface },
      { workbenchCookieMode: cookieMode },
    );
    window.history.pushState(null, "", target);
    window.dispatchEvent(new Event("popstate"));
  }, [cookieMode]);

  const navigateToSurface = useCallback((nextSurface: "wiki" | "graph", nextRoute: TaskFirstRoute, focus?: string) => {
    if (!nextRoute.taskId) {
      const pathname = cookieMode ? "/workbench" : "/";
      window.history.pushState(null, "", `${pathname}#${nextSurface}`);
      window.dispatchEvent(new Event("popstate"));
      return;
    }
    const { focus: _oldFocus, ...routeWithoutFocus } = nextRoute;
    navigate({
      ...routeWithoutFocus,
      ...(focus ? { focus } : {}),
    }, nextSurface);
  }, [cookieMode, navigate]);

  const selectSection = useCallback((section: TaskFirstSection) => {
    if (!route.taskId) return;
    const contractSection = taskFirstSectionPath(section);
    navigate({
      view: "tasks",
      taskId: route.taskId,
      section: contractSection,
      ...(contractSection === "planned_changes" && route.findingId ? { findingId: route.findingId } : {}),
    }, "task");
  }, [navigate, route.findingId, route.taskId]);

  const selectFinding = useCallback((findingId: string) => {
    if (!route.taskId) return;
    navigate({ view: "tasks", taskId: route.taskId, section: "planned_changes", findingId }, "task");
  }, [navigate, route.taskId]);

  const selectImpactPath = useCallback((impactPathId: string) => {
    if (!route.taskId) return;
    navigate({
      view: "tasks",
      taskId: route.taskId,
      section: "planned_changes",
      impactPathId,
    }, "task");
  }, [navigate, route.taskId]);

  const openEvidence = useCallback((findingId: string | undefined, evidenceId: string) => {
    if (!route.taskId) return;
    navigate({
      view: "tasks",
      taskId: route.taskId,
      section: "planned_changes",
      ...(findingId ? { findingId } : {}),
      evidenceId,
    }, "task");
  }, [navigate, route.taskId]);

  const result = loadState.result;
  const payload = result?.status === "ready" ? result.payload : undefined;
  const error = result && result.status !== "ready" && route.taskId
    ? result.message ?? "Task Brief is unavailable."
    : null;
  const stale = result?.status === "stale"
    ? result.message
    : payload && !payload.freshness.current
      ? "The Task Brief source Snapshot is not current."
      : false;
  const pulseStatus = payload?.pulse?.status
    ?? (result?.status === "error" ? "error" : result?.status === "stale" ? "stale" : "not_ready");

  const focusNodeId = surface === "graph" && route.focus && payload && !stale
    ? route.focus
    : null;
  const focusUnavailable = Boolean(
    route.focus && (!payload || stale),
  );
  const backToFinding = useCallback(() => {
    if (!route.taskId) {
      navigate({ view: "tasks", section: "summary" }, "task");
      return;
    }
    navigate({
      view: "tasks",
      taskId: route.taskId,
      section: "planned_changes",
      ...(route.findingId ? { findingId: route.findingId } : {}),
    }, "task");
  }, [navigate, route.findingId, route.taskId]);

  const selectProductSurface = useCallback((nextSurface: ProductSurface) => {
    if (nextSurface === "tasks") return;
    navigateToSurface(nextSurface, route);
  }, [navigateToSurface, route]);

  const requestTaskSearch = useCallback(() => {
    navigateToSurface("wiki", route);
    window.setTimeout(() => {
      window.dispatchEvent(new Event(GLOBAL_WIKI_SEARCH_REQUEST_EVENT));
    }, 0);
  }, [navigateToSurface, route]);

  const taskContext = useMemo<TaskDashboardContext | null>(() => (
    surface === "task" ? null : {
      route,
      surface,
      stale: Boolean(stale),
      focusNodeId,
      focusUnavailable,
      onSelectSurface: (nextSurface, focus) => navigateToSurface(nextSurface, route, focus),
      onSelectWikiTarget: (target) => navigateToSurface("wiki", route, target.pageId),
      onSelectedGraphNode: (nodeId) => navigateToSurface("graph", route, nodeId ?? undefined),
      onBackToFinding: backToFinding,
    }
  ), [backToFinding, focusNodeId, focusUnavailable, navigateToSurface, route, stale, surface]);

  if (taskContext) {
    return (
      <Dashboard
        accessToken={accessToken}
        onTokenInvalid={onTokenInvalid}
        taskContext={taskContext}
      />
    );
  }

  return (
    <div className="flex h-screen min-w-0 flex-col overflow-hidden bg-root text-text-primary">
      <DashboardHeader
        projectName="代码理解工作台"
        activeSurface="tasks"
        searchButtonRef={taskSearchButtonRef}
        themeInert={false}
        onSelectSurface={selectProductSurface}
        onRequestSearch={requestTaskSearch}
      />
      <TaskFirstWorkbench
        route={route}
        page={payload}
        pulse={payload?.pulse}
        pulseStatus={pulseStatus}
        loading={loadState.loading}
        error={error}
        stale={stale}
        sourceSnapshotId={payload?.freshness.sourceSnapshotId}
        changeCheck={payload?.changeCheck.value}
        changeCheckStatus={payload?.changeCheck.status}
        changeCheckMessage={payload?.changeCheck.message}
        impact={payload?.impact.value}
        impactStatus={payload?.impact.status}
        impactMessage={payload?.impact.message}
        verificationRecords={payload?.verification.value}
        verificationStatus={payload?.verification.status}
        verificationMessage={payload?.verification.message}
        evidence={payload?.evidence}
        knowledgeCandidates={knowledgeCandidateState.result}
        knowledgeCandidatesLoading={knowledgeCandidateState.loading}
        onRetryKnowledgeCandidates={loadKnowledgeCandidates}
        onRetry={load}
        onSelectSection={selectSection}
        onSelectFinding={selectFinding}
        onSelectImpactPath={selectImpactPath}
        onOpenEvidence={openEvidence}
        onOpenEvidenceGraph={(nodeId) => navigateToSurface("graph", route, nodeId)}
        onOpenKnowledge={(nextRoute) => navigateToSurface("wiki", nextRoute)}
        onOpenGraph={(nextRoute) => navigateToSurface("graph", nextRoute)}
        showSurfaceActions={false}
      />
    </div>
  );
}

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(resolveInitialToken);
  const [cookieSessionExpired, setCookieSessionExpired] = useState(false);
  const [locationRevision, setLocationRevision] = useState(0);
  const handleTokenValid = useCallback((token: string) => {
    writeStoredToken(token);
    setAccessToken(token);
  }, []);
  const handleTokenInvalid = useCallback(() => {
    if (isCookieWorkbenchLocation(window.location)) {
      setCookieSessionExpired(true);
      return;
    }
    clearStoredToken();
    setAccessToken(null);
  }, []);

  useEffect(() => {
    const onLocation = () => setLocationRevision((revision) => revision + 1);
    window.addEventListener("popstate", onLocation);
    window.addEventListener("hashchange", onLocation);
    return () => {
      window.removeEventListener("popstate", onLocation);
      window.removeEventListener("hashchange", onLocation);
    };
  }, []);

  const taskLocation = useMemo(taskLocationState, [locationRevision]);
  const defaultTaskLocation = useMemo<TaskFirstLocationState | null>(() => {
    if (window.location.pathname !== "/") return null;
    if (window.location.hash && window.location.hash !== "#tasks") return null;
    return { route: { view: "tasks", section: "summary" }, surface: "task" };
  }, [locationRevision]);
  const activeTaskLocation = taskLocation ?? defaultTaskLocation;

  if (DEMO_MODE) {
    return <Dashboard accessToken="__demo__" onTokenInvalid={handleTokenInvalid} />;
  }
  if (cookieSessionExpired) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-root px-5 text-text-primary">
        <section className="uc-panel max-w-lg p-6 text-center" role="alert" data-testid="workbench-session-expired">
          <h1 className="text-xl font-semibold">工作台会话已过期</h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">请从宿主智能体重新打开工作台链接。本页面不会保存启动令牌。</p>
        </section>
      </main>
    );
  }
  if (accessToken === null) return <TokenGate onTokenValid={handleTokenValid} />;
  if (activeTaskLocation) {
    return (
      <ThemeProvider>
        <TaskFirstDashboard
          accessToken={accessToken}
          onTokenInvalid={handleTokenInvalid}
          route={activeTaskLocation.route}
          surface={activeTaskLocation.surface}
        />
      </ThemeProvider>
    );
  }
  return <Dashboard accessToken={accessToken} onTokenInvalid={handleTokenInvalid} />;
}

export const GRAPH_LOAD_ERROR_COPY = {
  invalid: "关系图谱无效，请重新生成知识图谱后刷新。",
  read: "关系图谱读取失败，请检查网络或确认知识库服务正在运行。",
} as const;

function Dashboard({
  accessToken,
  onTokenInvalid,
  taskContext,
}: {
  accessToken: string;
  onTokenInvalid: () => void;
  taskContext?: TaskDashboardContext;
}) {
  const setConsoleGraph = useDashboardStore((state) => state.setConsoleGraph);
  const setWikiIndex = useDashboardStore((state) => state.setWikiIndex);
  const [wikiAvailability, setWikiAvailability] = useState<WikiAvailabilityStatus>("loading");
  const retryWikiRef = useRef<(() => void) | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [graphIssues, setGraphIssues] = useState<GraphIssue[]>([]);
  const [graphLoading, setGraphLoading] = useState(true);
  const [publishedVersion, setPublishedVersion] = useState<PublishedKnowledgeVersion | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  const versionRequestRef = useRef<AbortController | null>(null);
  const knowledgeEpochRef = useRef(0);
  const pendingKnowledgeGenerationId = selectedPendingKnowledgeGenerationId(taskContext);
  const knowledgeFetcher = useMemo(() => pendingKnowledgeGenerationId
    ? createPendingKnowledgeFetcher(pendingKnowledgeGenerationId)
    : publishedVersion
      ? createPublishedKnowledgeFetcher(publishedVersion.generationId)
      : fetch, [pendingKnowledgeGenerationId, publishedVersion]);
  const themeMetaUrl = useMemo(() => {
    const url = new URL(dataUrl("meta.json", accessToken), window.location.origin);
    if (pendingKnowledgeGenerationId) {
      url.searchParams.set("indexVersion", "pending");
      url.searchParams.set("indexGenerationId", pendingKnowledgeGenerationId);
    }
    return url.origin === window.location.origin
      ? `${url.pathname}${url.search}`
      : url.toString();
  }, [accessToken, pendingKnowledgeGenerationId]);

  useEffect(() => () => versionRequestRef.current?.abort(), []);
  const resetKnowledge = useCallback(() => {
    knowledgeEpochRef.current += 1;
    setGraphLoading(true);
    setWikiAvailability("loading");
    setLoadError(null);
    setGraphIssues([]);
    useDashboardStore.setState({ graph: null, selectedNodeId: null });
    setWikiIndex(useDashboardStore.getInitialState().wikiIndex);
  }, [setWikiIndex]);
  const openPublishedVersion = useCallback(async () => {
    if (versionRequestRef.current) return;
    const request = new AbortController();
    versionRequestRef.current = request;
    setVersionLoading(true);
    setVersionError(null);
    try {
      const response = await fetch("/meta.json?indexVersion=published", {
        ...dashboardFetchInit(accessToken), signal: request.signal,
      });
      if (request.signal.aborted) return;
      if (response.status === 401 || response.status === 403) {
        onTokenInvalid();
        return;
      }
      if (!response.ok) throw new Error("published version unavailable");
      const meta = await response.json() as { knowledgeVersion?: unknown };
      if (!request.signal.aborted) {
        const version = parsePublishedKnowledgeVersion(meta.knowledgeVersion);
        resetKnowledge();
        setPublishedVersion(version);
      }
    } catch {
      if (!request.signal.aborted) setVersionError("已发布版本暂不可用，请重试。当前任务未改变。");
    } finally {
      if (!request.signal.aborted) setVersionLoading(false);
      if (versionRequestRef.current === request) versionRequestRef.current = null;
    }
  }, [accessToken, onTokenInvalid, resetKnowledge]);

  useEffect(() => {
    let cancelled = false;
    const epoch = knowledgeEpochRef.current;
    let attempts = 0;
    let retryTimer: number | undefined;
    let inFlight = false;

    async function loadWiki(): Promise<void> {
      if (cancelled || epoch !== knowledgeEpochRef.current || inFlight) return;
      inFlight = true;
      const result = await loadDashboardKnowledge(accessToken, knowledgeFetcher);
      inFlight = false;
      if (cancelled || epoch !== knowledgeEpochRef.current) return;
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

    retryWikiRef.current = () => {
      if (cancelled || inFlight) return;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      retryTimer = undefined;
      attempts = 0;
      setWikiAvailability("loading");
      void loadWiki();
    };
    setWikiAvailability("loading");
    void loadWiki();
    return () => {
      cancelled = true;
      retryWikiRef.current = null;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [accessToken, knowledgeFetcher, onTokenInvalid, setWikiIndex]);

  useEffect(() => {
    let cancelled = false;
    const epoch = knowledgeEpochRef.current;
    setGraphLoading(true);
    setLoadError(null);
    setGraphIssues([]);
    void knowledgeFetcher(dataUrl("knowledge-graph.json", accessToken), dashboardFetchInit(accessToken))
      .then((response) => {
        if (response.status === 401 || response.status === 403) {
          onTokenInvalid();
          throw new Error("TOKEN_INVALID");
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((data) => {
        if (cancelled || epoch !== knowledgeEpochRef.current) return;
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
        if (cancelled || epoch !== knowledgeEpochRef.current || (error instanceof Error && error.message === "TOKEN_INVALID")) return;
        console.warn("关系图谱读取失败", error);
        setLoadError(GRAPH_LOAD_ERROR_COPY.read);
      }).finally(() => { if (!cancelled && epoch === knowledgeEpochRef.current) setGraphLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [accessToken, knowledgeFetcher, onTokenInvalid, setConsoleGraph]);

  return (
    <KnowledgeFetchContext.Provider value={knowledgeFetcher}>
    <InitialThemeGate metaUrl={themeMetaUrl}>
      {(initialTheme) => (
        <ThemeProvider initialConfig={initialTheme}>
          <DashboardContent
            key={pendingKnowledgeGenerationId ?? publishedVersion?.generationId ?? "current"}
            accessToken={accessToken}
            onTokenInvalid={onTokenInvalid}
            loadError={loadError}
            graphIssues={graphIssues}
            graphLoading={graphLoading}
            publishedVersion={publishedVersion}
            versionLoading={versionLoading}
            versionError={versionError}
            onOpenPublishedVersion={() => void openPublishedVersion()}
            onCurrentVersion={() => {
              versionRequestRef.current?.abort();
              versionRequestRef.current = null;
              setVersionLoading(false);
              resetKnowledge();
              setPublishedVersion(null);
              setVersionError(null);
            }}
            wikiAvailability={wikiAvailability}
            onRetryWiki={() => retryWikiRef.current?.()}
            taskContext={taskContext}
            pendingKnowledgeGenerationId={pendingKnowledgeGenerationId}
          />
        </ThemeProvider>
      )}
    </InitialThemeGate>
    </KnowledgeFetchContext.Provider>
  );
}

function DashboardContent({
  accessToken,
  onTokenInvalid,
  loadError,
  graphIssues,
  graphLoading,
  publishedVersion,
  versionLoading,
  versionError,
  onOpenPublishedVersion,
  onCurrentVersion,
  wikiAvailability,
  onRetryWiki,
  taskContext,
  pendingKnowledgeGenerationId,
}: {
  accessToken: string;
  onTokenInvalid: () => void;
  loadError: string | null;
  graphIssues: GraphIssue[];
  graphLoading: boolean;
  publishedVersion: PublishedKnowledgeVersion | null;
  versionLoading: boolean;
  versionError: string | null;
  onOpenPublishedVersion: () => void;
  onCurrentVersion: () => void;
  wikiAvailability: WikiAvailabilityStatus;
  onRetryWiki: () => void;
  taskContext?: TaskDashboardContext;
  pendingKnowledgeGenerationId?: string;
}) {
  const pendingKnowledgeStale = Boolean(
    pendingKnowledgeGenerationId && taskContext?.stale,
  );
  const knowledgeFetcher = useContext(KnowledgeFetchContext) ?? fetch;
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
  const searchControllerRef = useRef(createSearchArtifactRequestController(knowledgeFetcher));
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

  useEffect(() => {
    if (taskContext) return undefined;
    return routingController.start();
  }, [routingController, taskContext]);

  useEffect(() => {
    if (!taskContext) return;
    // A Wiki action already switched the surface and installed its own focus.
    // Mirroring the same Task surface must not clear that navigation intent.
    if (useDashboardStore.getState().dashboardSurface !== taskContext.surface) {
      setDashboardSurface(taskContext.surface);
    }
    if (taskContext.surface !== "wiki" || taskContext.stale || !taskContext.route.focus) return;
    if (wikiIndex.pagesById.has(taskContext.route.focus)) {
      openWikiTarget({ pageId: taskContext.route.focus });
    }
  }, [openWikiTarget, setDashboardSurface, taskContext, wikiIndex]);

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
    if (taskContext) {
      if (!wikiIndex.pagesById.has(target.pageId)) return;
      openWikiTarget(target);
      taskContext.onSelectWikiTarget(target);
      setSearchOpen(false);
      return;
    }
    if (routingController.selectWikiTarget(target)) setSearchOpen(false);
  }, [openWikiTarget, routingController, taskContext, wikiIndex]);

  const selectSurface = useCallback((surface: ProductSurface) => {
    if (surface === "tasks") {
      if (taskContext) {
        taskContext.onBackToFinding();
        return;
      }
      window.history.pushState(null, "", "/tasks");
      window.dispatchEvent(new Event("popstate"));
      return;
    }
    if (!taskContext) {
      routingController.selectSurface(surface);
      return;
    }
    setDashboardSurface(surface);
    taskContext.onSelectSurface(surface);
  }, [routingController, setDashboardSurface, taskContext]);

  const selectWikiTarget = useCallback((target: WikiTarget): boolean => {
    if (!taskContext) return routingController.selectWikiTarget(target);
    if (!wikiIndex.pagesById.has(target.pageId)) return false;
    openWikiTarget(target);
    taskContext.onSelectWikiTarget(target);
    return true;
  }, [openWikiTarget, routingController, taskContext, wikiIndex]);

  const selectWikiHome = useCallback(() => {
    if (!taskContext) {
      routingController.selectWikiHome();
      return;
    }
    selectWikiPage(null);
    taskContext.onSelectSurface("wiki");
  }, [routingController, selectWikiPage, taskContext]);

  const selectGraphForWikiPage = useCallback((pageId: string) => {
    if (!taskContext) return routingController.selectGraphForWikiPage(pageId);
    const page = wikiIndex.pagesById.get(pageId);
    if (!page) return false;
    openGraphForWikiPage(pageId);
    taskContext.onSelectSurface("graph", page.directNodeIds[0]);
    return true;
  }, [openGraphForWikiPage, routingController, taskContext, wikiIndex]);

  const taskWikiTargetUnavailable = Boolean(
    taskContext?.surface === "wiki"
    && taskContext.route.focus
    && !taskContext.stale
    && wikiAvailability === "ready"
    && !wikiIndex.pagesById.has(taskContext.route.focus),
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-root text-text-primary">
      <DashboardHeader
        projectName={graph?.project.name ?? "代码知识库"}
        activeSurface={dashboardSurface}
        searchButtonRef={searchButtonRef}
        themeInert={wikiDrawerOpen || searchOpen}
        onSelectSurface={selectSurface}
        onRequestSearch={requestGlobalSearch}
      />

      {taskContext && !taskContext.stale && <TaskContextBanner context={taskContext} />}
      {(pendingKnowledgeGenerationId || (isCookieWorkbenchAccess(accessToken) && (publishedVersion || loadError || ["error", "invalid", "missing"].includes(wikiAvailability)))) && (
        <section className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface px-4 py-3 sm:px-6" aria-label="知识版本" role="status" data-state={pendingKnowledgeStale ? "stale" : pendingKnowledgeGenerationId ? "pending" : "published"}>
          <div className="min-w-0 w-full text-sm text-text-secondary sm:w-auto sm:flex-1">
            <p className="font-semibold text-warning">{pendingKnowledgeGenerationId
              ? pendingKnowledgeStale ? "待审知识已过期 · 只读" : "待审知识 · 只读"
              : publishedVersion
              ? publishedVersion.status === "historical" ? "历史知识 · 只读" : "已发布知识 · 只读"
              : "当前知识快照不可用"}</p>
            <p className="mt-1 text-xs leading-5">{pendingKnowledgeGenerationId
              ? pendingKnowledgeStale
                ? "任务来源快照已变化，此候选不能继续预览；请返回任务重新生成候选。"
                : "候选知识仅用于审阅，不能作为当前任务证据，也不会触发发布。"
              : publishedVersion
              ? publishedVersion.status === "historical" ? "与当前源码快照不同，不能作为当前任务证据。" : "此版本与当前源码快照一致。"
              : "可以查看上一次发布的知识，当前任务与证据不会改变。"}</p>
            {pendingKnowledgeGenerationId && <p className="mt-1 break-all font-mono text-xs" title={pendingKnowledgeGenerationId}>候选代际：{pendingKnowledgeGenerationId}</p>}
            {!pendingKnowledgeGenerationId && publishedVersion && <p className="mt-1 break-all font-mono text-xs" title={publishedVersion.sourceSnapshotId}>来源快照：{publishedVersion.sourceSnapshotId}</p>}
            {versionError && <p className="mt-1 text-xs text-danger" role="alert">{versionError}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingKnowledgeGenerationId ? (
              taskContext && <button type="button" onClick={taskContext.onBackToFinding} className="min-h-11 rounded-md border border-border-medium px-3 py-2 text-sm font-semibold text-text-secondary">返回候选审阅</button>
            ) : (
              <>
                <button type="button" disabled={versionLoading} onClick={onOpenPublishedVersion} className="min-h-11 rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent disabled:opacity-50">
                  {versionLoading ? "正在读取版本" : publishedVersion ? "重新读取已发布版本" : "查看已发布版本"}
                </button>
                {publishedVersion && <button type="button" onClick={onCurrentVersion} className="min-h-11 rounded-md border border-border-medium px-3 py-2 text-sm font-semibold text-text-secondary">返回当前版本</button>}
              </>
            )}
          </div>
        </section>
      )}
      {taskWikiTargetUnavailable && (
        <div className="uc-status-banner" data-severity="warning" role="status">
          当前快照中不存在任务关联的 Wiki 页面。
        </div>
      )}

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
                if (pageId) selectWikiTarget({ pageId });
                else selectWikiHome();
              }}
              onSelectWikiTarget={(target) => selectWikiTarget(target)}
              onOpenGraphHome={() => selectSurface("graph")}
              onOpenGraphForPage={selectGraphForWikiPage}
              externalModalOpen={searchOpen}
              onDrawerOpenChange={setWikiDrawerOpen}
              wikiNavigationRevision={wikiNavigationRevision}
            />
          ) : (
            <WikiAvailabilityView status={wikiAvailability} onRetry={onRetryWiki} graphAvailable={!graphLoading && !loadError && graph !== null} />
          )
        ) : graphLoading || loadError ? (
          <main className="flex min-h-0 flex-1 items-center justify-center px-5 py-10 text-sm text-text-muted" role="status">{graphLoading ? "正在加载关系图谱" : "关系图谱暂不可用"}</main>
        ) : (
          <GraphChunkErrorBoundary onBackToWiki={() => selectSurface("wiki")}>
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
                onSelectWikiTarget={(target) => selectWikiTarget(target)}
                onRequestGlobalSearch={requestGlobalSearch}
                focusNodeId={taskContext?.stale || publishedVersion?.status === "historical" ? null : taskContext?.focusNodeId}
                onSelectedNodeChange={taskContext?.onSelectedGraphNode}
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
