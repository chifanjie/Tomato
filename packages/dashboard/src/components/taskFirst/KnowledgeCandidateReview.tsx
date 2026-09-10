import type { TaskFirstRoute } from "./route";
import type {
  TaskArtifactLoadResult,
  TaskKnowledgeCandidatesPayloadV1,
  TaskKnowledgeCandidateV1,
} from "../../workbench/taskContextLoader";

export interface KnowledgeCandidateReviewProps {
  readonly route: TaskFirstRoute;
  readonly result?: TaskArtifactLoadResult<TaskKnowledgeCandidatesPayloadV1> | null;
  readonly loading?: boolean;
  readonly onRetry?: () => void;
  readonly onOpenKnowledge?: (route: TaskFirstRoute) => void;
  readonly onOpenGraph?: (route: TaskFirstRoute) => void;
}

const STATUS_LABELS: Record<TaskArtifactLoadResult<unknown>["status"], string> = {
  ready: "可审阅",
  missing: "暂无候选",
  forbidden: "不可用",
  stale: "已过期",
  invalid: "无效",
  error: "读取失败",
};

function severity(status: TaskArtifactLoadResult<unknown>["status"]): "ok" | "warning" | "problem" {
  if (status === "ready") return "ok";
  if (status === "invalid" || status === "error" || status === "forbidden") return "problem";
  return "warning";
}

function candidateRoute(route: TaskFirstRoute, candidate: TaskKnowledgeCandidateV1): TaskFirstRoute {
  return {
    ...route,
    view: "tasks",
    section: "planned_changes",
    knowledgeVersion: "pending",
    knowledgeGenerationId: candidate.candidateGenerationId,
  };
}

function CandidateCard({
  route,
  candidate,
  currentTaskRevision,
  currentSnapshotId,
  onOpenKnowledge,
  onOpenGraph,
}: {
  readonly route: TaskFirstRoute;
  readonly candidate: TaskKnowledgeCandidateV1;
  readonly currentTaskRevision: number;
  readonly currentSnapshotId: string;
  readonly onOpenKnowledge?: (route: TaskFirstRoute) => void;
  readonly onOpenGraph?: (route: TaskFirstRoute) => void;
}) {
  const snapshotCurrent = candidate.sourceSnapshotMatchesCurrent
    && candidate.sourceSnapshotId === currentSnapshotId
    && candidate.taskRevision <= currentTaskRevision;
  const selected = route.knowledgeVersion === "pending"
    && route.knowledgeGenerationId === candidate.candidateGenerationId;
  const nextRoute = candidateRoute(route, candidate);
  return (
    <li
      className={`rounded-md border px-3 py-3 ${selected ? "border-accent/45 bg-accent/10" : "border-border-subtle bg-surface/60"}`}
      data-testid="task-knowledge-candidate"
      data-generation-id={candidate.candidateGenerationId}
      data-snapshot-current={String(snapshotCurrent)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">待审知识候选</p>
          <p className="mt-1 break-all font-mono text-xs text-text-secondary" title={candidate.candidateGenerationId}>
            {candidate.candidateGenerationId}
          </p>
        </div>
        <span className="uc-status-badge" data-severity={snapshotCurrent ? "ok" : "warning"}>
          {snapshotCurrent ? "当前快照" : "来源已变化"}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-2">
        <div><dt>任务修订版</dt><dd className="mt-1 text-text-primary">{candidate.taskRevision} / 当前 {currentTaskRevision}</dd></div>
        <div><dt>来源快照</dt><dd className="mt-1 break-all font-mono text-text-primary" title={candidate.sourceSnapshotId}>{candidate.sourceSnapshotId}</dd></div>
        {candidate.predecessorGenerationId && (
          <div><dt>前一代候选</dt><dd className="mt-1 break-all font-mono text-text-primary" title={candidate.predecessorGenerationId}>{candidate.predecessorGenerationId}</dd></div>
        )}
        {candidate.publishedGenerationId && (
          <div><dt>关联发布代际</dt><dd className="mt-1 break-all font-mono text-text-primary" title={candidate.publishedGenerationId}>{candidate.publishedGenerationId}</dd></div>
        )}
      </dl>
      <p className="mt-3 text-xs leading-5 text-text-muted">
        只读预览，不是当前任务证据；需要先确认来源快照与任务修订版。审核源码与内容后，请在宿主中显式确认发布。候选须通过真实正文和来源证据的质量门禁；任务通过验证不会自动发布知识。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!snapshotCurrent || !onOpenKnowledge}
          onClick={() => onOpenKnowledge?.(nextRoute)}
          className="min-h-11 rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="task-knowledge-candidate-open-wiki"
        >
          查看候选知识库
        </button>
        <button
          type="button"
          disabled={!snapshotCurrent || !onOpenGraph}
          onClick={() => onOpenGraph?.(nextRoute)}
          className="min-h-11 rounded-md border border-border-medium px-3 py-2 text-sm font-semibold text-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="task-knowledge-candidate-open-graph"
        >
          查看候选图谱
        </button>
      </div>
    </li>
  );
}

/**
 * Read-only review entry point for Task-staged knowledge.  It never presents
 * a candidate as current evidence and never owns a publish/mutation action.
 */
export default function KnowledgeCandidateReview({
  route,
  result,
  loading = false,
  onRetry,
  onOpenKnowledge,
  onOpenGraph,
}: KnowledgeCandidateReviewProps) {
  const status = loading ? "error" : result?.status ?? "missing";
  const candidates = result?.value?.candidates ?? [];
  return (
    <section className="mb-5 rounded-md border border-border-subtle bg-elevated/20 p-4" data-testid="task-knowledge-candidates">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">待审知识候选</p>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            这里仅预览任务生成的候选知识；它不会替换已发布知识，也不能作为当前任务证据。
          </p>
        </div>
        <span className="uc-status-badge" data-severity={loading ? "warning" : severity(status)}>
          {loading ? "正在读取" : STATUS_LABELS[status]}
        </span>
      </div>
      {loading ? (
        <p className="mt-4 text-sm text-text-muted" role="status">正在读取候选列表…</p>
      ) : result?.status === "ready" ? (
        candidates.length > 0 ? (
          <ul className="mt-4 space-y-3" aria-label="待审知识候选列表">
            {candidates.map((candidate) => (
              <CandidateCard
                key={candidate.candidateGenerationId}
                route={route}
                candidate={candidate}
                currentTaskRevision={result.value?.currentTaskRevision ?? candidate.taskRevision}
                currentSnapshotId={result.value?.currentSnapshotId ?? candidate.sourceSnapshotId}
                onOpenKnowledge={onOpenKnowledge}
                onOpenGraph={onOpenGraph}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm leading-6 text-text-muted">当前任务没有待审知识候选。</p>
        )
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm leading-6 text-text-muted">
            {result?.message ?? "当前任务没有可用的待审知识候选。"}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-11 rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent"
            >
              重新读取候选
            </button>
          )}
        </div>
      )}
    </section>
  );
}
