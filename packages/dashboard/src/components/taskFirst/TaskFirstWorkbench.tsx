import type { ReactNode } from "react";
import type {
  RepoPulseStatusV1,
  RepoPulseV1,
  TaskBriefPageItemV1,
  TaskBriefSectionV1,
  TaskBriefV1,
  TaskManifestV1,
  TaskStatusV1,
  WorkbenchRouteV1,
} from "@understand-code/contracts";

/** The five sections that are useful in the first Task Brief surface. */
export type TaskFirstSection =
  | "summary"
  | "goals"
  | "reading"
  | "changes"
  | "verification";

/** A route accepted by the Workbench entry points. */
export type TaskFirstRoute = WorkbenchRouteV1;

/**
 * The API returns a paged `result` object. Keeping this structural type local
 * lets the dashboard consume either that result or the full Task Brief
 * artifact without coupling the page shell to a transport envelope.
 */
export interface TaskBriefPageResult {
  readonly task: TaskManifestV1;
  readonly section?: TaskBriefSectionV1;
  readonly items?: readonly TaskBriefPageItemV1[];
  readonly brief?: TaskBriefV1;
  readonly total?: number;
  readonly hasMore?: boolean;
}

export type TaskBriefPage =
  | TaskBriefPageResult
  | {
      readonly result: TaskBriefPageResult;
      readonly page?: {
        readonly total?: number;
        readonly hasMore?: boolean;
      };
    };

export type TaskFirstStaleState =
  | boolean
  | string
  | {
      readonly reason?: string;
      readonly message?: string;
    };

export interface TaskFirstWorkbenchProps {
  readonly route: TaskFirstRoute;
  /** The current Task Brief page/result. Omit while loading or on the Task Home. */
  readonly page?: TaskBriefPage | null;
  readonly pulse?: RepoPulseV1 | null;
  /** Explicit pulse status is useful while the pulse payload is still loading. */
  readonly pulseStatus?: RepoPulseStatusV1;
  readonly loading?: boolean;
  readonly error?: string | Error | null;
  readonly stale?: TaskFirstStaleState;
  readonly onRetry?: () => void;
  readonly onSelectSection?: (section: TaskFirstSection) => void;
  readonly onOpenKnowledge?: (route: TaskFirstRoute) => void;
  readonly onOpenGraph?: (route: TaskFirstRoute) => void;
  /** Optional host-provided content for a future evidence rail. */
  readonly children?: ReactNode;
}

const SECTION_ITEMS: readonly {
  readonly id: TaskFirstSection;
  readonly contractSection: TaskBriefSectionV1;
  readonly label: string;
  readonly secondary: string;
}[] = [
  { id: "summary", contractSection: "summary", label: "Summary", secondary: "摘要" },
  { id: "goals", contractSection: "goals", label: "Goals", secondary: "目标与边界" },
  { id: "reading", contractSection: "reading_path", label: "Reading", secondary: "阅读路径" },
  { id: "changes", contractSection: "planned_changes", label: "Changes", secondary: "计划变更" },
  { id: "verification", contractSection: "verification_plan", label: "Verification", secondary: "验证" },
];

const PULSE_LABELS: Record<RepoPulseStatusV1, string> = {
  not_ready: "Not ready / 未就绪",
  fresh: "Fresh / 最新",
  partial: "Partial / 部分可用",
  stale: "Stale / 已过期",
  unknown: "Unknown / 未知",
  rebuilding: "Refreshing / 刷新中",
  error: "Error / 错误",
};

const TASK_LABELS: Record<TaskStatusV1, string> = {
  created: "Created / 已创建",
  context_ready: "Context ready / 上下文就绪",
  planned: "Planned / 已规划",
  in_progress: "In progress / 进行中",
  check_required: "Check required / 待检查",
  verification_required: "Verification required / 待验证",
  verified: "Verified / 已验证",
  blocked: "Blocked / 已阻塞",
  stale: "Stale / 已过期",
  superseded: "Superseded / 已替代",
};

function pageResult(page: TaskBriefPage | null | undefined): TaskBriefPageResult | null {
  if (!page) return null;
  if ("result" in page) return page.result;
  return page;
}

function selectedSection(route: TaskFirstRoute, page: TaskBriefPageResult | null): TaskFirstSection {
  const contractSection = route.section ?? page?.section ?? "summary";
  return SECTION_ITEMS.find((item) => item.contractSection === contractSection)?.id ?? "summary";
}

function pulseStatus(
  pulse: RepoPulseV1 | null | undefined,
  explicitStatus: RepoPulseStatusV1 | undefined,
): RepoPulseStatusV1 {
  return explicitStatus ?? pulse?.status ?? "unknown";
}

function staleMessage(stale: TaskFirstStaleState | undefined): string | null {
  if (!stale) return null;
  if (typeof stale === "string") return stale;
  if (typeof stale === "object") return stale.message ?? stale.reason ?? "当前内容来自较旧的 Snapshot。";
  return "当前内容可能已过期，请重新加载以确认最新状态。";
}

function errorMessage(error: string | Error | null | undefined): string | null {
  if (!error) return null;
  return typeof error === "string" ? error : error.message;
}

function routeFor(view: "knowledge" | "graph", route: TaskFirstRoute): TaskFirstRoute {
  return { ...route, view };
}

function itemText(item: TaskBriefPageItemV1): { title: string; detail?: string; meta?: string } {
  switch (item.kind) {
    case "summary":
      return {
        title: item.originalIntent,
        meta: `${item.acceptanceClaimCount} acceptance claims · ${item.plannedChangeCount} planned changes`,
      };
    case "claim_reference":
      return { title: item.claimId, meta: item.role.replace(/_/g, " ") };
    case "reading_path":
      return {
        title: item.entry.filePath ?? item.entry.symbolId ?? item.entry.impactPathId ?? item.entry.id,
        detail: item.entry.kind.replace(/_/g, " "),
        meta: `Order ${item.entry.order}`,
      };
    case "planned_change":
      return {
        title: item.change.filePath,
        detail: item.change.intent,
        meta: item.change.candidateLevel.replace(/_/g, " "),
      };
    case "verification_plan":
      return {
        title: item.entry.description,
        meta: `${item.entry.method}${item.entry.required ? " · required" : " · optional"}`,
      };
  }
}

function BriefItems({
  page,
  section,
}: {
  readonly page: TaskBriefPageResult;
  readonly section: TaskFirstSection;
}) {
  const items = page.items ?? [];
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border-subtle px-4 py-6 text-sm text-text-muted">
        This section has no published items yet. / 此章节暂时没有已发布内容。
      </p>
    );
  }
  return (
    <ol className="space-y-2" aria-label={`${section} items`}>
      {items.map((item, index) => {
        const text = itemText(item);
        return (
          <li
            key={`${item.kind}-${index}-${text.title}`}
            className="rounded-md border border-border-subtle bg-elevated/30 px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words text-sm font-medium text-text-primary">{text.title}</p>
              {text.meta && <span className="shrink-0 text-xs text-text-muted">{text.meta}</span>}
            </div>
            {text.detail && <p className="mt-1 text-xs leading-5 text-text-secondary">{text.detail}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function BriefSummary({ page }: { readonly page: TaskBriefPageResult }) {
  const brief = page.brief;
  if (!brief) return <BriefItems page={page} section="summary" />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-md border border-border-subtle bg-elevated/30 px-3 py-3 sm:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Intent / 意图</p>
        <p className="mt-1 text-sm leading-6 text-text-primary">{brief.originalIntent}</p>
      </div>
      <div className="rounded-md border border-border-subtle bg-elevated/30 px-3 py-3">
        <p className="text-xs text-text-muted">Acceptance claims / 验收主张</p>
        <p className="mt-1 text-xl font-semibold text-text-primary">{brief.acceptanceClaimIds.length}</p>
      </div>
      <div className="rounded-md border border-border-subtle bg-elevated/30 px-3 py-3">
        <p className="text-xs text-text-muted">Planned changes / 计划变更</p>
        <p className="mt-1 text-xl font-semibold text-text-primary">{brief.plannedChanges.length}</p>
      </div>
      <div className="rounded-md border border-border-subtle bg-elevated/30 px-3 py-3">
        <p className="text-xs text-text-muted">Reading path / 阅读路径</p>
        <p className="mt-1 text-xl font-semibold text-text-primary">{brief.readingPath.length}</p>
      </div>
      <div className="rounded-md border border-border-subtle bg-elevated/30 px-3 py-3">
        <p className="text-xs text-text-muted">Verification / 验证项</p>
        <p className="mt-1 text-xl font-semibold text-text-primary">{brief.verificationPlan.length}</p>
      </div>
    </div>
  );
}

function PulseCard({ pulse, status }: { readonly pulse?: RepoPulseV1 | null; readonly status: RepoPulseStatusV1 }) {
  const reasons = pulse?.reasons ?? [];
  return (
    <section className="uc-panel p-4" aria-labelledby="task-first-pulse-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Repository</p>
          <h2 id="task-first-pulse-title" className="mt-1 text-base font-semibold text-text-primary">
            Pulse / 仓库状态
          </h2>
        </div>
        <span className="uc-status-badge" data-severity={status === "error" ? "problem" : status === "fresh" ? "ok" : "warning"}>
          {PULSE_LABELS[status]}
        </span>
      </div>
      {pulse ? (
        <dl className="mt-4 grid gap-2 text-xs text-text-secondary">
          <div className="flex justify-between gap-3"><dt>Snapshot</dt><dd className="max-w-[12rem] truncate font-mono text-text-primary" title={pulse.evaluatedSnapshotId}>{pulse.evaluatedSnapshotId}</dd></div>
          <div className="flex justify-between gap-3"><dt>Evaluated</dt><dd className="text-text-primary">{new Date(pulse.evaluatedAt).toLocaleString()}</dd></div>
          {pulse.repositoryState?.branch && <div className="flex justify-between gap-3"><dt>Branch</dt><dd className="max-w-[12rem] truncate text-text-primary">{pulse.repositoryState.branch}</dd></div>}
        </dl>
      ) : (
        <p className="mt-3 text-sm leading-6 text-text-muted">Pulse details are not available yet. / 暂无仓库状态详情。</p>
      )}
      {reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs leading-5 text-text-muted">
          {reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      )}
    </section>
  );
}

function StatePanel({
  state,
  message,
  onRetry,
}: {
  readonly state: "loading" | "error" | "empty";
  readonly message?: string | null;
  readonly onRetry?: () => void;
}) {
  if (state === "loading") {
    return (
      <section className="uc-panel space-y-3 p-5" aria-busy="true" aria-label="Loading Task Brief">
        <div className="h-5 w-2/5 animate-pulse rounded bg-elevated" />
        <div className="h-4 w-full animate-pulse rounded bg-elevated" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-elevated" />
        <p className="pt-2 text-xs text-text-muted">Loading Task Brief… / 正在加载任务简报…</p>
      </section>
    );
  }
  if (state === "error") {
    return (
      <section className="uc-panel p-5" role="alert">
        <p className="uc-inline-status" data-severity="problem">Unable to load Task Brief / 任务简报加载失败</p>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{message ?? "The local Workbench returned an unknown error."}</p>
        {onRetry && <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/15">Retry / 重试</button>}
      </section>
    );
  }
  return (
    <section className="uc-panel p-5" aria-label="Empty Task Brief">
      <p className="text-base font-semibold text-text-primary">No Task Brief selected / 尚未选择任务</p>
      <p className="mt-2 text-sm leading-6 text-text-secondary">Ask your Host Agent to create or open a Task, then return here for read-only evidence.</p>
      <p className="mt-2 text-xs leading-5 text-text-muted">Workbench is read-only: it does not run commands or write files.</p>
    </section>
  );
}

/**
 * Read-only Task-first surface. The component deliberately owns no fetch,
 * mutation, command, or file APIs; hosts provide page/pulse state and receive
 * typed route callbacks for Knowledge and Graph navigation.
 */
export function TaskFirstWorkbench({
  route,
  page: pageInput,
  pulse,
  pulseStatus: explicitPulseStatus,
  loading = false,
  error = null,
  stale = false,
  onRetry,
  onSelectSection,
  onOpenKnowledge,
  onOpenGraph,
  children,
}: TaskFirstWorkbenchProps) {
  const page = pageResult(pageInput);
  const task = page?.task;
  const status = pulseStatus(pulse, explicitPulseStatus);
  const section = selectedSection(route, page);
  const staleCopy = staleMessage(stale)
    ?? (status === "stale" ? "The repository pulse is stale; reload before treating evidence as current. / 仓库状态已过期，请重新加载后再视为当前事实。" : null);
  const failure = errorMessage(error);
  const activeSection = SECTION_ITEMS.find((item) => item.id === section) ?? SECTION_ITEMS[0];

  const renderPage = () => {
    if (loading) return <StatePanel state="loading" />;
    if (failure) return <StatePanel state="error" message={failure} onRetry={onRetry} />;
    if (!page || !task) return <StatePanel state="empty" />;
    if (activeSection.id === "summary") return <BriefSummary page={page} />;
    return <BriefItems page={page} section={activeSection.id} />;
  };

  return (
    <main
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto bg-root text-text-primary"
      data-testid="task-first-workbench"
      data-state={loading ? "loading" : failure ? "error" : !page ? "empty" : staleCopy ? "stale" : "ready"}
    >
      <header className="border-b border-border-subtle bg-surface px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <span className="rounded border border-accent/35 bg-accent/10 px-2 py-1 text-accent">Task / 任务</span>
              <span aria-hidden="true">·</span>
              <span>Pulse / 仓库状态</span>
            </div>
            <h1 className="mt-2 truncate text-xl font-semibold text-text-primary sm:text-2xl">
              {task?.title ?? (route.taskId ? `Task ${route.taskId}` : "Task Home / 任务首页")}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
              {task?.originalIntent ?? "Read-only evidence workspace for Tasks, Knowledge, and Graph."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="uc-status-badge" data-severity={status === "fresh" ? "ok" : status === "error" ? "problem" : "warning"}>
              {PULSE_LABELS[status]}
            </span>
            <button type="button" disabled={!onOpenKnowledge} className="min-h-11 rounded-md border border-border-medium px-3 py-2 text-sm font-semibold text-text-secondary hover:border-accent/35 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50" onClick={() => onOpenKnowledge?.(routeFor("knowledge", route))}>Knowledge / 知识库</button>
            <button type="button" disabled={!onOpenGraph} className="min-h-11 rounded-md border border-border-medium px-3 py-2 text-sm font-semibold text-text-secondary hover:border-accent/35 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50" onClick={() => onOpenGraph?.(routeFor("graph", route))}>Graph / 关系图谱</button>
          </div>
        </div>
      </header>

      {staleCopy && (
        <div className="mx-auto mt-4 flex w-full max-w-[1600px] items-start gap-2 px-4 sm:px-6" role="status" data-testid="task-first-stale">
          <div className="uc-status-banner w-full px-3 py-2" data-severity="warning">
            <span className="text-sm font-medium">Stale / 内容可能已过期：</span>
            <span className="ml-1 text-sm text-text-secondary">{staleCopy}</span>
          </div>
        </div>
      )}

      <div className="mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)] xl:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)_minmax(16rem,22rem)]">
        <nav className="uc-panel h-fit p-2" aria-label="Task sections">
          <p className="px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Task navigation / 任务导航</p>
          <div className="flex gap-1 overflow-x-auto lg:block">
            {SECTION_ITEMS.map((item) => {
              const selected = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={selected ? "page" : undefined}
                  aria-pressed={selected}
                  onClick={() => onSelectSection?.(item.id)}
                  className={`min-h-11 shrink-0 rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors lg:block lg:w-full ${selected ? "bg-accent/15 text-accent" : "text-text-secondary hover:bg-elevated hover:text-text-primary"}`}
                >
                  <span className="block">{item.label}</span>
                  <span className="mt-0.5 block text-xs font-normal opacity-75">{item.secondary}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <section className="min-w-0" aria-labelledby="task-first-section-title">
          <div className="uc-panel min-h-full p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Task Brief / 任务简报</p>
                <h2 id="task-first-section-title" className="mt-1 text-lg font-semibold text-text-primary">{activeSection.label} / {activeSection.secondary}</h2>
              </div>
              {task && <span className="uc-status-badge" data-severity={task.status === "blocked" || task.status === "stale" ? "problem" : task.status === "verified" ? "ok" : "warning"}>{TASK_LABELS[task.status]}</span>}
            </div>
            <div className="mt-5">{renderPage()}</div>
            {children && <div className="mt-6 border-t border-border-subtle pt-5">{children}</div>}
          </div>
        </section>

        <aside className="min-w-0 xl:block">
          <PulseCard pulse={pulse} status={status} />
          <section className="uc-panel mt-4 p-4" aria-label="Read-only boundary">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Evidence Workbench</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">Claims, paths, and verification are shown for inspection. Changes happen in the Host Agent.</p>
            <p className="mt-2 text-xs leading-5 text-text-muted">Read-only · no command execution · no file writes</p>
          </section>
        </aside>
      </div>
    </main>
  );
}

export default TaskFirstWorkbench;
