import { useEffect, useRef, useState, type ReactNode } from "react";
import { ClaimV1Schema, classifyChangeCheckV1 } from "@understand-code/contracts";
import type {
  CandidateLevelV1,
  ClaimV1,
  ChangeCheckV1,
  PlannedChangeExpectationV1,
  ImpactPayloadV1,
  RepoPulseSurfaceResponseV1,
  RepoPulseStatusV1,
  TaskBriefPageItemV1,
  TaskBriefSectionV1,
  TaskBriefV1,
  TaskManifestV1,
  TaskStatusV1,
  VerificationRecordV1,
} from "@understand-code/contracts";
import type {
  TaskArtifactLoadResult,
  TaskKnowledgeCandidatesPayloadV1,
  TaskEvidenceProjection,
} from "../../workbench/taskContextLoader";
import TaskEvidencePanel from "./TaskEvidencePanel";
import KnowledgeCandidateReview from "./KnowledgeCandidateReview";
import type { TaskFirstRoute as RoutedTaskFirstRoute } from "./route";

export type TaskArtifactSurfaceStatus =
  | "ready"
  | "missing"
  | "forbidden"
  | "stale"
  | "invalid"
  | "error";

/** The five sections that are useful in the first Task Brief surface. */
export type TaskFirstSection =
  | "summary"
  | "goals"
  | "reading"
  | "changes"
  | "verification";

type TaskWorkbenchDrawer = "navigation" | "evidence";

/** A route accepted by the Workbench entry points. */
export type TaskFirstRoute = RoutedTaskFirstRoute;

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
  readonly claims?: readonly ClaimV1[];
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
  readonly pulse?: RepoPulseSurfaceResponseV1 | null;
  /** Explicit pulse status is useful while the pulse payload is still loading. */
  readonly pulseStatus?: RepoPulseStatusV1;
  readonly loading?: boolean;
  readonly error?: string | Error | null;
  readonly stale?: TaskFirstStaleState;
  readonly sourceSnapshotId?: string;
  readonly observedSnapshotId?: string;
  /** Persisted read-only Change Intelligence projections. */
  readonly changeCheck?: ChangeCheckV1 | null;
  readonly impact?: ImpactPayloadV1 | null;
  readonly impactStatus?: TaskArtifactSurfaceStatus;
  readonly impactMessage?: string | null;
  readonly changeCheckStatus?: TaskArtifactSurfaceStatus;
  readonly changeCheckMessage?: string | null;
  readonly verificationRecords?: readonly VerificationRecordV1[] | null;
  readonly verificationStatus?: TaskArtifactSurfaceStatus;
  readonly verificationMessage?: string | null;
  readonly evidence?: TaskArtifactLoadResult<TaskEvidenceProjection>;
  /** Lazily loaded Task-scoped pending knowledge candidates. */
  readonly knowledgeCandidates?: TaskArtifactLoadResult<TaskKnowledgeCandidatesPayloadV1> | null;
  readonly knowledgeCandidatesLoading?: boolean;
  readonly onRetryKnowledgeCandidates?: () => void;
  readonly onRetry?: () => void;
  readonly refreshing?: boolean;
  readonly lastRefreshedAt?: string;
  readonly refreshError?: string | null;
  readonly onTaskHome?: () => void;
  readonly onSelectSection?: (section: TaskFirstSection) => void;
  readonly onSelectFinding?: (findingId: string) => void;
  readonly onSelectImpactPath?: (impactPathId: string) => void;
  readonly onOpenEvidence?: (findingId: string | undefined, evidenceId: string) => void;
  readonly onOpenEvidenceGraph?: (nodeId: string) => void;
  readonly onOpenKnowledge?: (route: TaskFirstRoute) => void;
  readonly onOpenGraph?: (route: TaskFirstRoute) => void;
  /** The app shell owns these destinations; standalone hosts may keep the local buttons. */
  readonly showSurfaceActions?: boolean;
  /** Optional host-provided content for a future evidence rail. */
  readonly children?: ReactNode;
}

const SECTION_ITEMS: readonly {
  readonly id: TaskFirstSection;
  readonly contractSection: TaskBriefSectionV1;
  readonly label: string;
  readonly secondary: string;
}[] = [
  { id: "summary", contractSection: "summary", label: "摘要", secondary: "任务概览" },
  { id: "goals", contractSection: "goals", label: "目标", secondary: "目标与边界" },
  { id: "reading", contractSection: "reading_path", label: "阅读", secondary: "阅读路径" },
  { id: "changes", contractSection: "planned_changes", label: "变更", secondary: "计划变更" },
  { id: "verification", contractSection: "verification_plan", label: "验证", secondary: "验证计划" },
];

const PULSE_LABELS: Record<RepoPulseStatusV1, string> = {
  not_ready: "未就绪",
  fresh: "最新",
  partial: "部分可用",
  stale: "已过期",
  unknown: "未知",
  rebuilding: "刷新中",
  error: "错误",
};

const TASK_LABELS: Record<TaskStatusV1, string> = {
  created: "已创建",
  context_ready: "上下文就绪",
  planned: "已规划",
  in_progress: "进行中",
  check_required: "待检查",
  verification_required: "待验证",
  verified: "已验证",
  blocked: "已阻塞",
  stale: "已过期",
  superseded: "已替代",
};

export function taskStatusLabel(status: TaskStatusV1): string { return TASK_LABELS[status]; }

const PASSED_VERIFICATION_STATUS: VerificationRecordV1["status"] = "passed";

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
  pulse: RepoPulseSurfaceResponseV1 | null | undefined,
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

function routeFor(_view: "knowledge" | "graph", route: TaskFirstRoute): TaskFirstRoute {
  const { focus: _focus, ...taskRoute } = route;
  return {
    ...taskRoute,
    // Graph/Wiki are local Task surfaces. The shared authority route must stay
    // `tasks` so finding/evidence identifiers remain Task-bound.
    view: "tasks",
  };
}

const CANDIDATE_LEVEL_LABELS: Record<CandidateLevelV1, string> = {
  must_inspect: "必须检查",
  likely_change: "很可能需要变更",
  possible_change: "可能需要变更",
  test_or_verify: "测试或验证",
  context_only: "仅供上下文",
};

const EXPECTATION_LABELS: Record<PlannedChangeExpectationV1, string> = {
  required_change: "必须变更",
  optional_change: "可选变更",
  inspect_only: "仅检查",
  verification_only: "仅验证",
};

function itemText(item: TaskBriefPageItemV1): { title: string; detail?: string; meta?: string } {
  switch (item.kind) {
    case "summary":
      return {
        title: item.originalIntent,
        meta: `${item.acceptanceClaimCount} 条验收主张 · ${item.plannedChangeCount} 项计划变更`,
      };
    case "claim_reference":
      return { title: "此主张正文尚未提供", detail: `请让宿主重新读取任务上下文。标识：${item.claimId}`, meta: item.role.replace(/_/g, " ") };
    case "reading_path":
      return {
        title: item.entry.filePath ?? item.entry.symbolId ?? item.entry.impactPathId ?? item.entry.id,
        detail: item.entry.kind.replace(/_/g, " "),
        meta: `顺序 ${item.entry.order}`,
      };
    case "planned_change":
      return {
        title: item.change.filePath,
        detail: item.change.intent,
        meta: `${CANDIDATE_LEVEL_LABELS[item.change.candidateLevel]} · ${item.change.expectation === undefined ? "预期未指定（旧版）" : EXPECTATION_LABELS[item.change.expectation]}`,
      };
    case "verification_plan":
      return {
        title: item.entry.description,
        meta: `${item.entry.method}${
          item.entry.required === false
            ? " · 可选"
            : item.entry.required === true
              ? " · 必需"
              : " · 要求未指定（旧版；按必需项门禁）"
        }`,
      };
  }
}

const CLAIM_KIND_LABELS: Record<ClaimV1["kind"], string> = {
  goal: "目标", non_goal: "范围之外", acceptance: "验收条件", assumption: "假设",
  recommendation: "建议", risk: "风险", unknown: "未知项", finding: "发现", conclusion: "结论",
};
const CLAIM_STATUS_LABELS = { observed: "已观察事实", inferred: "推断", unknown: "未知", human_confirmed: "人工确认" };
const CLAIM_LIFECYCLE_LABELS = { draft: "待证实", supported: "有支撑", contested: "有争议", invalidated: "已失效" };

function ClaimCard({ claim, currentSnapshotId, onOpenEvidence }: {
  readonly claim: ClaimV1;
  readonly currentSnapshotId: string;
  readonly onOpenEvidence?: (findingId: string | undefined, evidenceId: string) => void;
}) {
  return <article className="rounded-md border border-border-subtle bg-elevated/30 p-3" data-testid="task-claim" id={`claim-${claim.id}`}>
    <p className="text-xs text-text-muted">{CLAIM_KIND_LABELS[claim.kind]} · {CLAIM_STATUS_LABELS[claim.epistemicStatus]} · {CLAIM_LIFECYCLE_LABELS[claim.lifecycleStatus]} · {claim.sourceSnapshotId !== currentSnapshotId ? "源自先前快照／待复核" : claim.freshness === "current" ? "当前快照" : "来源已变化"}</p>
    <p className="mt-2 text-sm leading-6 text-text-primary">{claim.statement}</p>
    {claim.boundaryReason && <p className="mt-2 text-xs leading-5 text-warning">未知边界：{claim.boundaryReason}</p>}
    {claim.derivationPath && <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-5 text-text-secondary" aria-label="推断理由">{claim.derivationPath.map((step, index) => <li key={index}>{step.description}</li>)}</ol>}
    <div className="mt-2 flex flex-wrap gap-2" aria-label="主张证据">
      {claim.evidenceIds.map((id, index) => <button key={id} type="button" disabled={!onOpenEvidence} title={id} onClick={() => onOpenEvidence?.(undefined, id)} className="min-h-11 rounded border border-border-medium px-3 py-2 text-xs text-accent disabled:opacity-50" data-evidence-id={id}>查看证据 {index + 1}</button>)}
      {claim.evidenceIds.length === 0 && <p className="text-xs text-text-muted">尚无支撑证据</p>}
    </div>
    <details className="mt-2 text-xs text-text-muted"><summary>来源与标识</summary><p className="mt-1 break-all font-mono">{claim.id} · {claim.sourceSnapshotId}</p></details>
  </article>;
}

function BriefItems({
  page,
  section,
  onOpenEvidence,
}: {
  readonly page: TaskBriefPageResult;
  readonly section: TaskFirstSection;
  readonly onOpenEvidence?: (findingId: string | undefined, evidenceId: string) => void;
}) {
  const items = page.items ?? [];
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border-subtle px-4 py-6 text-sm text-text-muted">
        此章节暂时没有已发布内容。
      </p>
    );
  }
  return (
    <ol className="space-y-2" aria-label={`${SECTION_ITEMS.find((item) => item.id === section)?.label ?? "任务简报"}条目`}>
      {items.map((item, index) => {
        const resolved = item.kind === "claim_reference" && "claim" in item && item.claim ? ClaimV1Schema.safeParse(item.claim) : undefined;
        const claim = resolved?.success ? resolved.data : item.kind === "claim_reference" ? page.claims?.find((claim) => claim.id === item.claimId) : undefined;
        if (claim) return <li key={claim.id}><ClaimCard claim={claim} currentSnapshotId={page.task.latestSnapshotId} onOpenEvidence={onOpenEvidence} /></li>;
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

function BriefSummary({ page, onOpenEvidence }: { readonly page: TaskBriefPageResult; readonly onOpenEvidence?: (findingId: string | undefined, evidenceId: string) => void }) {
  const brief = page.brief;
  if (!brief) return <BriefItems page={page} section="summary" />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(page.claims ?? []).filter((claim) => ["conclusion", "recommendation", "assumption", "risk", "unknown"].includes(claim.kind)).map((claim) => <div key={claim.id} className="sm:col-span-2"><ClaimCard claim={claim} currentSnapshotId={page.task.latestSnapshotId} onOpenEvidence={onOpenEvidence} /></div>)}
      <div className="rounded-md border border-border-subtle bg-elevated/30 px-3 py-3 sm:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">任务意图</p>
        <p className="mt-1 text-sm leading-6 text-text-primary">{brief.originalIntent}</p>
      </div>
      <div className="rounded-md border border-border-subtle bg-elevated/30 px-3 py-3">
        <p className="text-xs text-text-muted">验收主张</p>
        <p className="mt-1 text-xl font-semibold text-text-primary">{brief.acceptanceClaimIds.length}</p>
      </div>
      <div className="rounded-md border border-border-subtle bg-elevated/30 px-3 py-3">
        <p className="text-xs text-text-muted">计划变更</p>
        <p className="mt-1 text-xl font-semibold text-text-primary">{brief.plannedChanges.length}</p>
      </div>
      <div className="rounded-md border border-border-subtle bg-elevated/30 px-3 py-3">
        <p className="text-xs text-text-muted">阅读路径</p>
        <p className="mt-1 text-xl font-semibold text-text-primary">{brief.readingPath.length}</p>
      </div>
      <div className="rounded-md border border-border-subtle bg-elevated/30 px-3 py-3">
        <p className="text-xs text-text-muted">验证项</p>
        <p className="mt-1 text-xl font-semibold text-text-primary">{brief.verificationPlan.length}</p>
      </div>
    </div>
  );
}

const ARTIFACT_STATUS_LABELS: Record<TaskArtifactSurfaceStatus, string> = {
  ready: "已发布",
  missing: "尚未发布",
  forbidden: "不可用",
  stale: "已过期",
  invalid: "无效",
  error: "读取失败",
};

function artifactSeverity(status: TaskArtifactSurfaceStatus): "ok" | "warning" | "problem" {
  if (status === "ready") return "ok";
  if (status === "invalid" || status === "error" || status === "forbidden") return "problem";
  return "warning";
}

function ChangeCheckCard({
  check,
  status = "missing",
  message,
  selectedFindingId,
  selectedEvidenceId,
  onSelectFinding,
  onOpenEvidence,
}: {
  readonly check?: ChangeCheckV1 | null;
  readonly status?: TaskArtifactSurfaceStatus;
  readonly message?: string | null;
  readonly selectedFindingId?: string;
  readonly selectedEvidenceId?: string;
  readonly onSelectFinding?: (findingId: string) => void;
  readonly onOpenEvidence?: (findingId: string, evidenceId: string) => void;
}) {
  const resolvedStatus = check ? "ready" : status;
  const findings = check?.findings ?? [];
  const blocking = findings.filter((finding) => finding.blocking).length;
  const classification = check ? classifyChangeCheckV1(check) : undefined;
  return (
    <section className="mb-5 rounded-md border border-border-subtle bg-elevated/20 p-4" data-testid="task-change-check">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">实际变更检查</p>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            此处只读取任务中已持久化的发现项，不会在界面中执行检查。
          </p>
        </div>
        <span className="uc-status-badge" data-severity={artifactSeverity(resolvedStatus)}>
          {ARTIFACT_STATUS_LABELS[resolvedStatus]}
        </span>
      </div>
      {check ? (
        <>
          <dl className="mt-4 grid gap-2 text-xs text-text-secondary sm:grid-cols-3">
            <div><dt>检查记录</dt><dd className="mt-1 truncate font-mono text-text-primary" title={check.id}>{check.id}</dd></div>
            <div><dt>发现项</dt><dd className="mt-1 text-text-primary">{findings.length}</dd></div>
            <div><dt>阻断项</dt><dd className="mt-1 text-text-primary">{blocking}</dd></div>
          </dl>
          <div
            className="mt-4 rounded border border-border-medium bg-surface/60 px-3 py-2 text-sm text-text-secondary"
            data-testid="task-change-check-classification"
            data-profile={classification?.profile}
            data-empty-findings-are-clean={String(classification?.emptyFindingsAreClean)}
          >
            <span className="font-semibold text-text-primary">旧版摘要。</span>{" "}
            没有发现项不等于已经获得变更完全安全的证据。
          </div>
          {findings.length > 0 ? (
            <ul className="mt-4 space-y-2" aria-label="变更检查发现项" data-testid="task-change-findings">
              {findings.map((finding) => {
                const selected = selectedFindingId === finding.id;
                return (
                <li key={finding.id} className={`rounded border px-3 py-2 ${selected ? "border-accent/45 bg-accent/10" : "border-border-subtle bg-surface/60"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectFinding?.(finding.id)}
                      disabled={!onSelectFinding}
                      aria-current={selected ? "true" : undefined}
                      className="min-h-11 min-w-0 flex-1 rounded px-1 py-1 text-left text-sm font-medium text-text-primary disabled:cursor-default"
                      data-testid="task-finding-open"
                      data-finding-id={finding.id}
                    >
                      {finding.summary}
                    </button>
                    <span className="text-xs text-text-muted">{finding.type.replace(/_/g, " ")} · {finding.severity}</span>
                  </div>
                  {finding.blocking && <p className="mt-1 text-xs font-semibold text-danger">阻断</p>}
                  {selected && finding.evidenceIds.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2" aria-label="发现项证据">
                      {finding.evidenceIds.map((evidenceId) => (
                        <button
                          key={evidenceId}
                          type="button"
                          onClick={() => onOpenEvidence?.(finding.id, evidenceId)}
                          disabled={!onOpenEvidence}
                          aria-pressed={selectedEvidenceId === evidenceId}
                          className="min-h-11 rounded border border-border-medium px-2.5 py-2 text-left font-mono text-xs text-accent hover:bg-accent/10 disabled:cursor-default"
                          data-testid="task-evidence-open"
                          data-evidence-id={evidenceId}
                        >
                          {evidenceId}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-text-muted">未记录变更发现。</p>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm leading-6 text-text-muted">{message ?? "当前任务没有可用的变更检查。"}</p>
      )}
    </section>
  );
}

const VERIFICATION_STATUS_LABELS: Record<string, string> = {
  passed: "通过",
  failed: "失败",
  skipped: "跳过",
  blocked: "阻塞",
  flaky: "不稳定",
};

function VerificationCard({
  records,
  status = "missing",
  message,
  claims = [],
  brief,
  currentSnapshotId,
  onOpenEvidence,
}: {
  readonly claims?: readonly ClaimV1[];
  readonly brief?: TaskBriefV1;
  readonly currentSnapshotId: string;
  readonly onOpenEvidence?: (findingId: string | undefined, evidenceId: string) => void;
  readonly records?: readonly VerificationRecordV1[] | null;
  readonly status?: TaskArtifactSurfaceStatus;
  readonly message?: string | null;
}) {
  const resolvedStatus = records ? "ready" : status;
  const entries = records ?? [];
  const passed = entries.filter((record) => record.status === PASSED_VERIFICATION_STATUS).length;
  return (
    <section className="mb-5 rounded-md border border-border-subtle bg-elevated/20 p-4" data-testid="task-verification-records">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">实际验证记录</p>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            已记录的结果仅作为证据展示；仪表盘不会执行命令。
          </p>
        </div>
        <span className="uc-status-badge" data-severity={artifactSeverity(resolvedStatus)}>
          {ARTIFACT_STATUS_LABELS[resolvedStatus]}
        </span>
      </div>
      {records ? (
        entries.length > 0 ? (
          <>
            <dl className="mt-4 grid gap-2 text-xs text-text-secondary sm:grid-cols-3">
              <div><dt>记录数</dt><dd className="mt-1 text-text-primary">{entries.length}</dd></div>
              <div><dt>通过数</dt><dd className="mt-1 text-text-primary">{passed}</dd></div>
              <div><dt>最新记录</dt><dd className="mt-1 truncate font-mono text-text-primary" title={entries.at(-1)?.id}>{entries.at(-1)?.id}</dd></div>
            </dl>
            <ul className="mt-4 space-y-2" aria-label="验证记录">
              {entries.map((record) => (
                <li key={record.id} className="rounded border border-border-subtle bg-surface/60 px-3 py-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-text-primary">{record.summary}</p>
                    <span className="text-xs text-text-muted">{VERIFICATION_STATUS_LABELS[record.status] ?? record.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">{record.kind} · 第 {record.attempt} 次 · {brief?.verificationPlan.find((entry) => entry.id === record.verificationPlanEntryId)?.description ?? record.verificationPlanEntryId}</p>
                  {record.command && <pre className="mt-2 overflow-auto rounded bg-root p-2 text-xs"><code>{record.command}</code></pre>}
                  <p className="mt-2 break-all text-xs text-text-muted">快照 {record.snapshotId}{record.exitCode === undefined ? "" : ` · 退出码 ${record.exitCode}`}{record.durationMs === undefined ? "" : ` · ${record.durationMs} 毫秒`}</p>
                  {record.outputDigest && <p className="mt-1 break-all font-mono text-xs text-text-muted">输出摘要 {record.outputDigest}</p>}
                  <div className="mt-3 space-y-2" aria-label="验证对应验收条件">{record.claimIds.map((id) => {
                    const claim = claims.find((item) => item.id === id);
                    return claim ? <ClaimCard key={id} claim={claim} currentSnapshotId={currentSnapshotId} onOpenEvidence={onOpenEvidence} /> : <p key={id} className="text-xs text-warning">验收正文尚未提供：{id}</p>;
                  })}</div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-4 text-sm leading-6 text-text-muted">尚未记录验证结果。</p>
        )
      ) : (
        <p className="mt-4 text-sm leading-6 text-text-muted">{message ?? "当前任务没有可用的验证记录。"}</p>
      )}
    </section>
  );
}

const IMPACT_CLASSIFICATION_LABELS: Record<ImpactPayloadV1["paths"][number]["classification"], string> = {
  observed: "已观察",
  inferred: "推断",
  unknown_boundary: "未知边界",
};

function impactConclusionLabel(conclusion: ImpactPayloadV1["conclusion"]): string {
  if (conclusion === undefined) return "整体影响结论未记录";
  if (conclusion.status === "paths_observed") return `已观察到 ${conclusion.impactPathIds.length} 条影响路径`;
  if (conclusion.status === "none_observed") return "未观察到影响路径";
  if (conclusion.status === "partial") return "影响分析部分完成，存在边界";
  return "影响分析未知，存在边界";
}

function ImpactCard({
  impact,
  status = "missing",
  message,
  selectedImpactPathId,
  onSelectImpactPath,
  onOpenEvidence,
  onOpenGraph,
}: {
  readonly impact?: ImpactPayloadV1 | null;
  readonly status?: TaskArtifactSurfaceStatus;
  readonly message?: string | null;
  readonly selectedImpactPathId?: string;
  readonly onSelectImpactPath?: (impactPathId: string) => void;
  readonly onOpenEvidence?: (evidenceId: string) => void;
  readonly onOpenGraph?: (nodeId: string) => void;
}) {
  const resolvedStatus = impact ? "ready" : status;
  const paths = impact?.paths ?? [];
  const conclusion = impact?.conclusion;
  const conclusionLabel = impactConclusionLabel(conclusion);
  return (
    <section className="mb-5 rounded-md border border-border-subtle bg-elevated/20 p-4" data-testid="task-impact-paths">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">影响路径</p>
          <p className="mt-1 text-sm leading-6 text-text-secondary">只读取任务中已持久化的影响路径；路径不足或未知边界会保留其原始结论。</p>
        </div>
        <span className="uc-status-badge" data-severity={artifactSeverity(resolvedStatus)}>{ARTIFACT_STATUS_LABELS[resolvedStatus]}</span>
      </div>
      {impact ? (
        <>
          <p className="mt-4 rounded border border-border-medium bg-surface/60 px-3 py-2 text-sm text-text-secondary" data-testid="task-impact-conclusion">{conclusionLabel}</p>
          {paths.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-text-muted">{conclusion?.status === "none_observed" ? "没有观察到影响路径。" : "当前没有可展示的影响路径。"}</p>
          ) : (
            <ol className="mt-4 space-y-3" aria-label="影响路径列表">
              {paths.map((path) => {
                const selected = selectedImpactPathId === path.id;
                return (
                  <li key={path.id} className={`rounded border px-3 py-3 ${selected ? "border-accent/45 bg-accent/10" : "border-border-subtle bg-surface/60"}`} data-testid="task-impact-path" data-impact-path-id={path.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <button type="button" onClick={() => onSelectImpactPath?.(path.id)} disabled={!onSelectImpactPath} aria-current={selected ? "true" : undefined} className="min-h-11 min-w-0 flex-1 rounded px-1 py-1 text-left text-sm font-medium text-text-primary disabled:cursor-default">{path.sourceNodeId} → {path.targetNodeId}</button>
                      <span className="text-xs text-text-muted">{IMPACT_CLASSIFICATION_LABELS[path.classification]} · {path.steps.length} 步</span>
                    </div>
                    {path.boundaryReason && <p className="mt-2 text-xs text-warning">边界：{path.boundaryReason}</p>}
                    {path.truncatedAt && <p className="mt-1 text-xs text-warning">已截断：{path.truncatedAt.reason}{path.truncatedAt.hiddenCount === undefined ? "" : ` · 隐藏 ${path.truncatedAt.hiddenCount}`}</p>}
                    <ol className="mt-3 space-y-2 border-l border-border-medium pl-3" aria-label={`影响路径 ${path.id} 的步骤`}>
                      {path.steps.map((step, index) => (
                        <li key={`${path.id}-${index}`} className="text-xs text-text-secondary">
                          <div className="flex flex-wrap items-center gap-1"><span className="font-mono text-text-primary">{step.source}</span><span aria-hidden="true">—{step.edgeType}→</span><span className="font-mono text-text-primary">{step.target}</span><span className="text-text-muted">· {step.direction}</span></div>
                          {step.provenance?.map((provenance, provenanceIndex) => <div key={`${provenance.filePath}:${provenance.lineNumber}:${provenanceIndex}`} className="mt-1 font-mono text-text-muted">{provenance.filePath}:{provenance.lineNumber} · {provenance.confidence}</div>)}
                          {step.evidenceId && <button type="button" onClick={() => onOpenEvidence?.(step.evidenceId!)} disabled={!onOpenEvidence} className="mt-1 min-h-9 rounded border border-border-medium px-2 py-1 font-mono text-accent disabled:cursor-default">证据 {step.evidenceId}</button>}
                        </li>
                      ))}
                    </ol>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => onOpenGraph?.(path.sourceNodeId)} disabled={!onOpenGraph} className="min-h-9 rounded border border-border-medium px-2 py-1 text-xs text-accent disabled:cursor-default">在图谱中打开起点</button>
                      <button type="button" onClick={() => onOpenGraph?.(path.targetNodeId)} disabled={!onOpenGraph} className="min-h-9 rounded border border-border-medium px-2 py-1 text-xs text-accent disabled:cursor-default">在图谱中打开终点</button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      ) : <p className="mt-4 text-sm leading-6 text-text-muted">{message ?? "当前任务没有可用的影响路径。"}</p>}
    </section>
  );
}

function strongBranchLabel(pulse?: RepoPulseSurfaceResponseV1 | null): string | null {
  if (pulse?.viewKind !== "strong_repo_pulse") return null;
  if (pulse.branchState.status === "safe") return pulse.branchState.name;
  if (pulse.branchState.status === "detached") return "游离";
  if (pulse.branchState.status === "redacted") return "已隐藏";
  return null;
}

function PulseCard({ pulse, status }: { readonly pulse?: RepoPulseSurfaceResponseV1 | null; readonly status: RepoPulseStatusV1 }) {
  const strongPulse = pulse?.viewKind === "strong_repo_pulse" ? pulse : null;
  const branch = strongBranchLabel(pulse);
  return (
    <section className="uc-panel p-4" aria-labelledby="task-first-pulse-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">仓库</p>
          <h2 id="task-first-pulse-title" className="mt-1 text-base font-semibold text-text-primary">
            仓库状态
          </h2>
        </div>
        <span className="uc-status-badge" data-severity={status === "error" ? "problem" : status === "fresh" ? "ok" : "warning"}>
          {PULSE_LABELS[status]}
        </span>
      </div>
      {pulse ? (
        <dl className="mt-4 grid gap-2 text-xs text-text-secondary">
          {strongPulse && <div className="flex justify-between gap-3"><dt>快照</dt><dd className="max-w-[12rem] truncate font-mono text-text-primary" title={strongPulse.evaluatedSnapshotId}>{strongPulse.evaluatedSnapshotId}</dd></div>}
          <div className="flex justify-between gap-3"><dt>评估时间</dt><dd className="text-text-primary">{new Date(pulse.evaluatedAt).toLocaleString()}</dd></div>
          {branch && <div className="flex justify-between gap-3"><dt>分支</dt><dd className="max-w-[12rem] truncate text-text-primary">{branch}</dd></div>}
          {strongPulse ? (
            <div className="flex justify-between gap-3"><dt>变更</dt><dd className="text-text-primary">{strongPulse.safeChangeCount} 项安全 · {strongPulse.redactedChangeCount} 项已隐藏 · {strongPulse.unknownStateCount} 项未知</dd></div>
          ) : (
            <div className="flex justify-between gap-3"><dt>详情</dt><dd className="text-text-primary">旧版详情已隐藏</dd></div>
          )}
        </dl>
      ) : (
        <p className="mt-3 text-sm leading-6 text-text-muted">暂无仓库状态详情。</p>
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
      <section className="uc-panel space-y-3 p-5" aria-busy="true" aria-label="正在加载任务简报">
        <div className="h-5 w-2/5 animate-pulse rounded bg-elevated" />
        <div className="h-4 w-full animate-pulse rounded bg-elevated" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-elevated" />
        <p className="pt-2 text-xs text-text-muted">正在加载任务简报…</p>
      </section>
    );
  }
  if (state === "error") {
    return (
      <section className="uc-panel p-5" role="alert">
        <p className="uc-inline-status" data-severity="problem">任务简报加载失败</p>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{message ?? "本地工作台返回了未知错误。"}</p>
        {onRetry && <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/15">重试</button>}
      </section>
    );
  }
  return (
    <section className="uc-panel p-5" aria-label="未选择任务简报">
      <p className="text-base font-semibold text-text-primary">尚未选择任务</p>
      <p className="mt-2 text-sm leading-6 text-text-secondary">请让宿主智能体创建或打开任务，然后返回此处查看只读证据。</p>
      <p className="mt-2 text-xs leading-5 text-text-muted">工作台为只读模式：不会执行命令或写入文件。</p>
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
  sourceSnapshotId,
  observedSnapshotId,
  changeCheck,
  impact,
  impactStatus = "missing",
  impactMessage,
  changeCheckStatus = "missing",
  changeCheckMessage,
  verificationRecords,
  verificationStatus = "missing",
  verificationMessage,
  evidence = { status: "missing" },
  knowledgeCandidates,
  knowledgeCandidatesLoading = false,
  onRetryKnowledgeCandidates,
  onRetry,
  refreshing = false,
  lastRefreshedAt,
  refreshError,
  onTaskHome,
  onSelectSection,
  onSelectFinding,
  onSelectImpactPath,
  onOpenEvidence,
  onOpenEvidenceGraph,
  onOpenKnowledge,
  onOpenGraph,
  showSurfaceActions = true,
  children,
}: TaskFirstWorkbenchProps) {
  const page = pageResult(pageInput);
  const task = page?.task;
  const status = pulseStatus(pulse, explicitPulseStatus);
  const section = selectedSection(route, page);
  const [localSection, setLocalSection] = useState<TaskFirstSection>(section);
  const [openDrawer, setOpenDrawer] = useState<TaskWorkbenchDrawer | null>(null);
  const [pinnedDrawer, setPinnedDrawer] = useState<TaskWorkbenchDrawer | null>(null);
  const navigationTriggerRef = useRef<HTMLButtonElement>(null);
  const evidenceTriggerRef = useRef<HTMLButtonElement>(null);
  const navigationCloseRef = useRef<HTMLButtonElement>(null);
  const evidenceCloseRef = useRef<HTMLButtonElement>(null);
  const navigationDrawerRef = useRef<HTMLElement>(null);
  const evidenceDrawerRef = useRef<HTMLElement>(null);
  const sectionTitleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => setLocalSection(section), [section]);
  useEffect(() => {
    if (!openDrawer) return;

    const closeButton = openDrawer === "navigation" ? navigationCloseRef : evidenceCloseRef;
    closeButton.current?.focus();
  }, [openDrawer]);

  useEffect(() => {
    if (!openDrawer) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        const trigger = openDrawer === "navigation" ? navigationTriggerRef : evidenceTriggerRef;
        setOpenDrawer(null);
        setPinnedDrawer(null);
        queueMicrotask(() => trigger.current?.focus());
        return;
      }

      if (event.key !== "Tab" || pinnedDrawer === openDrawer) return;
      const drawer = openDrawer === "navigation" ? navigationDrawerRef.current : evidenceDrawerRef.current;
      if (!drawer) return;
      const focusable = [...drawer.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => {
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      });
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!drawer.contains(active) || (!event.shiftKey && active === last)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openDrawer, pinnedDrawer]);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const desktop = window.matchMedia("(min-width: 1280px)");
    const handleDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      setOpenDrawer((current) => {
        if (current) queueMicrotask(() => sectionTitleRef.current?.focus());
        return null;
      });
      setPinnedDrawer(null);
    };
    desktop.addEventListener("change", handleDesktop);
    return () => desktop.removeEventListener("change", handleDesktop);
  }, []);
  const activeSectionId = onSelectSection ? section : localSection;
  const staleCopy = staleMessage(stale);
  const failure = errorMessage(error);
  const activeSection = SECTION_ITEMS.find((item) => item.id === activeSectionId) ?? SECTION_ITEMS[0];
  const selectedFinding = changeCheck?.findings.find((finding) => finding.id === route.findingId);
  const selectedEvidenceIsRelated = route.evidenceId !== undefined && (
    selectedFinding ? selectedFinding.evidenceIds.includes(route.evidenceId) : route.findingId === undefined
  );

  const closeDrawer = () => {
    if (!openDrawer) return;
    const trigger = openDrawer === "navigation" ? navigationTriggerRef : evidenceTriggerRef;
    setOpenDrawer(null);
    setPinnedDrawer(null);
    queueMicrotask(() => trigger.current?.focus());
  };

  const toggleDrawer = (drawer: TaskWorkbenchDrawer) => {
    if (openDrawer === drawer) {
      setOpenDrawer(null);
      setPinnedDrawer(null);
      return;
    }
    setPinnedDrawer(null);
    setOpenDrawer(drawer);
  };

  const renderPage = () => {
    if (loading) return <StatePanel state="loading" />;
    if (failure) return <StatePanel state="error" message={failure} onRetry={onRetry} />;
    if (!page || !task) return <StatePanel state="empty" />;
    if (activeSection.id === "summary") return <BriefSummary page={page} onOpenEvidence={onOpenEvidence} />;
    if (activeSection.id === "changes") {
      return (
        <>
          <ChangeCheckCard
            check={changeCheck}
            status={changeCheckStatus}
            message={changeCheckMessage}
            selectedFindingId={route.findingId}
            selectedEvidenceId={route.evidenceId}
            onSelectFinding={onSelectFinding}
            onOpenEvidence={(findingId, evidenceId) => onOpenEvidence?.(findingId, evidenceId)}
          />
          <ImpactCard
            impact={impact}
            status={impactStatus}
            message={impactMessage}
            selectedImpactPathId={route.impactPathId}
            onSelectImpactPath={onSelectImpactPath}
            onOpenEvidence={(evidenceId) => onOpenEvidence?.(undefined, evidenceId)}
            onOpenGraph={onOpenEvidenceGraph}
          />
          <KnowledgeCandidateReview
            route={route}
            result={knowledgeCandidates}
            loading={knowledgeCandidatesLoading}
            onRetry={onRetryKnowledgeCandidates}
            onOpenKnowledge={onOpenKnowledge}
            onOpenGraph={onOpenGraph}
          />

          <BriefItems page={page} section={activeSection.id} onOpenEvidence={onOpenEvidence} />
        </>
      );
    }
    if (activeSection.id === "verification") {
      return (
        <>
          <VerificationCard records={verificationRecords} status={verificationStatus} message={verificationMessage} claims={page.claims} brief={page.brief} currentSnapshotId={task.latestSnapshotId} onOpenEvidence={onOpenEvidence} />
          <BriefItems page={page} section={activeSection.id} onOpenEvidence={onOpenEvidence} />
        </>
      );
    }
    return <BriefItems page={page} section={activeSection.id} onOpenEvidence={onOpenEvidence} />;
  };

  return (
    <main
      className="uc-task-workbench flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-root text-text-primary"
      data-testid="task-first-workbench"
      data-state={loading ? "loading" : failure ? "error" : !page ? "empty" : staleCopy ? "stale" : "ready"}
      data-drawer-open={openDrawer !== null}
      data-pinned-drawer={pinnedDrawer ?? undefined}
    >
      <header className="border-b border-border-subtle bg-surface px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <span className="rounded border border-accent/35 bg-accent/10 px-2 py-1 text-accent">任务</span>
              <span aria-hidden="true">·</span>
              <span>仓库状态</span>
            </div>
            <h1 className="mt-2 truncate text-xl font-semibold text-text-primary sm:text-2xl">
              {task?.title ?? (route.taskId ? `任务 ${route.taskId}` : "任务首页")}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
              {task?.originalIntent ?? "面向任务、知识库与关系图谱的只读证据工作区。"}
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <span className="uc-status-badge" data-severity={status === "fresh" ? "ok" : status === "error" ? "problem" : "warning"}>
              {PULSE_LABELS[status]}
            </span>
            {onTaskHome && <button type="button" onClick={onTaskHome} className="min-h-11 rounded-md border border-border-medium px-3 py-2 text-sm text-text-secondary">任务历史</button>}
            {onRetry && <button type="button" onClick={onRetry} disabled={refreshing || loading} className="min-h-11 rounded-md border border-border-medium px-3 py-2 text-sm text-text-secondary disabled:opacity-50">{refreshing ? "正在刷新…" : "刷新任务"}</button>}
            {showSurfaceActions && (
              <>
                <button type="button" disabled={!onOpenKnowledge} className="min-h-11 rounded-md border border-border-medium px-3 py-2 text-sm font-semibold text-text-secondary hover:border-accent/35 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50" onClick={() => onOpenKnowledge?.(routeFor("knowledge", route))}>知识库</button>
                <button type="button" disabled={!onOpenGraph} className="min-h-11 rounded-md border border-border-medium px-3 py-2 text-sm font-semibold text-text-secondary hover:border-accent/35 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50" onClick={() => onOpenGraph?.(routeFor("graph", route))}>关系图谱</button>
              </>
            )}
          </div>
        </div>
      </header>

      {task && <p className="mx-auto mt-3 w-full max-w-[1600px] px-4 text-xs text-text-muted sm:px-6" role="status">修订版 {task.revision} · 任务更新 {new Date(task.updatedAt).toLocaleString()} · {lastRefreshedAt ? `最近读取 ${new Date(lastRefreshedAt).toLocaleTimeString()} · 页面可见时每 10 秒刷新` : "已读取持久化任务"}{refreshError && <span className="ml-2 text-warning">刷新失败，保留上次内容：{refreshError}</span>}</p>}

      {staleCopy && (
        <div
          className="mx-auto mt-4 flex w-full max-w-[1600px] items-start gap-2 px-4 sm:px-6"
          role="status"
          data-testid="task-first-stale"
          data-source-snapshot-id={sourceSnapshotId}
          data-observed-snapshot-id={observedSnapshotId}
        >
          <div className="uc-status-banner flex w-full min-w-0 flex-wrap items-center justify-between gap-3 px-3 py-2" data-severity="warning">
            <span className="min-w-0 text-sm text-text-secondary">
              <span className="font-medium text-text-primary">内容可能已过期：</span>{" "}
              {staleCopy}
            </span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="min-h-11 shrink-0 rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/15"
              >
                重新加载
              </button>
            )}
          </div>
        </div>
      )}

      <div className="uc-task-drawer-toolbar mx-auto w-full max-w-[1600px] gap-2 px-4 pt-4 sm:px-6" role="toolbar" aria-label="任务工作台面板">
        <button
          ref={navigationTriggerRef}
          type="button"
          className="uc-task-drawer-trigger"
          aria-controls="task-workbench-navigation"
          aria-expanded={openDrawer === "navigation"}
          data-testid="task-navigation-trigger"
          onClick={() => toggleDrawer("navigation")}
        >
          任务导航
        </button>
        <button
          ref={evidenceTriggerRef}
          type="button"
          className="uc-task-drawer-trigger"
          aria-controls="task-workbench-evidence"
          aria-expanded={openDrawer === "evidence"}
          data-testid="task-evidence-trigger"
          onClick={() => toggleDrawer("evidence")}
        >
          证据与状态
        </button>
      </div>

      <button
        type="button"
        className="uc-task-backdrop"
        data-open={openDrawer !== null}
        data-pinned={pinnedDrawer !== null && pinnedDrawer === openDrawer}
        aria-label="关闭任务工作台面板"
        tabIndex={openDrawer === null ? -1 : 0}
        onClick={closeDrawer}
      />

      <div className="uc-task-layout mx-auto grid min-h-0 w-full max-w-[1600px] flex-none gap-4 p-4 sm:p-6">
        <nav
          ref={navigationDrawerRef}
          id="task-workbench-navigation"
          className="uc-task-navigation uc-panel min-w-0 max-w-full self-start overflow-hidden p-2"
          aria-label="任务章节"
          data-open={openDrawer === "navigation"}
          data-testid="task-navigation-drawer"
        >
          <div className="uc-task-drawer-header">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">任务导航</p>
            <div className="uc-task-drawer-actions">
              <button
                type="button"
                className="uc-task-drawer-pin"
                aria-pressed={pinnedDrawer === "navigation"}
                onClick={() => setPinnedDrawer((current) => current === "navigation" ? null : "navigation")}
              >
                {pinnedDrawer === "navigation" ? "取消固定" : "固定"}
              </button>
              <button
                ref={navigationCloseRef}
                type="button"
                className="uc-task-drawer-close"
                onClick={closeDrawer}
              >
                关闭
              </button>
            </div>
          </div>
          <div className="grid max-w-full gap-1">
            {SECTION_ITEMS.map((item) => {
              const selected = activeSectionId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={selected ? "page" : undefined}
                  aria-pressed={selected}
                  disabled={!task}
                  title={!task ? "请先从任务首页选择或创建任务" : undefined}
                  onClick={() => {
                    setLocalSection(item.id);
                    onSelectSection?.(item.id);
                    if (openDrawer === "navigation" && pinnedDrawer !== "navigation") {
                      setOpenDrawer(null);
                      queueMicrotask(() => navigationTriggerRef.current?.focus());
                    }
                  }}
                  className={`min-h-11 w-full rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors ${selected ? "bg-accent/15 text-accent" : "text-text-secondary hover:bg-elevated hover:text-text-primary"}`}
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
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">任务简报</p>
                <h2 ref={sectionTitleRef} id="task-first-section-title" tabIndex={-1} className="mt-1 text-lg font-semibold text-text-primary">{activeSection.label} · {activeSection.secondary}</h2>
              </div>
              {task && <span className="uc-status-badge" data-severity={task.status === "blocked" || task.status === "stale" ? "problem" : task.status === "verified" ? "ok" : "warning"}>{TASK_LABELS[task.status]}</span>}
            </div>
            <div className="mt-5">{route.evidenceId && <TaskEvidencePanel evidenceId={route.evidenceId} result={evidence} relationValid={selectedEvidenceIsRelated} stale={staleCopy !== null} onOpenGraph={onOpenEvidenceGraph} />}{renderPage()}</div>
            {children && <div className="mt-6 border-t border-border-subtle pt-5">{children}</div>}
          </div>
        </section>

        <aside
          ref={evidenceDrawerRef}
          id="task-workbench-evidence"
          className="uc-task-evidence-rail min-w-0"
          data-open={openDrawer === "evidence"}
          data-testid="task-evidence-drawer"
        >
          <div className="uc-task-drawer-header uc-task-drawer-only">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">证据与状态</p>
            <div className="uc-task-drawer-actions">
              <button
                type="button"
                className="uc-task-drawer-pin"
                aria-pressed={pinnedDrawer === "evidence"}
                onClick={() => setPinnedDrawer((current) => current === "evidence" ? null : "evidence")}
              >
                {pinnedDrawer === "evidence" ? "取消固定" : "固定"}
              </button>
              <button
                ref={evidenceCloseRef}
                type="button"
                className="uc-task-drawer-close"
                onClick={closeDrawer}
              >
                关闭
              </button>
            </div>
          </div>
          <PulseCard pulse={pulse} status={status} />
          <section className="uc-panel mt-4 p-4" aria-label="只读边界">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">证据工作台</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">此处展示主张、路径和验证记录以供检查；实际变更由宿主智能体完成。</p>
            <p className="mt-2 text-xs leading-5 text-text-muted">只读 · 不执行命令 · 不写入文件</p>
          </section>
        </aside>
      </div>
    </main>
  );
}

export default TaskFirstWorkbench;
