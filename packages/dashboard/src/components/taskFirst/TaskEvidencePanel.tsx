import type {
  TaskArtifactLoadResult,
  TaskEvidenceProjection,
} from "../../workbench/taskContextLoader";

export interface TaskEvidencePanelProps {
  readonly evidenceId: string;
  readonly result: TaskArtifactLoadResult<TaskEvidenceProjection>;
  readonly relationValid: boolean;
  readonly stale: boolean;
  readonly onOpenGraph?: (nodeId: string) => void;
}

function sourceLines(content: string, firstLine: number): readonly { number: number; text: string }[] {
  return content.split("\n").map((text, index) => ({ number: firstLine + index, text }));
}

export default function TaskEvidencePanel({
  evidenceId,
  result,
  relationValid,
  stale,
  onOpenGraph,
}: TaskEvidencePanelProps) {
  const projection = result.value;
  const ready = !stale && relationValid && result.status === "ready"
    && projection?.status === "ready"
    ? projection
    : null;

  return (
    <section
      className="mb-5 rounded-md border border-border-subtle bg-surface p-4"
      aria-labelledby="task-evidence-title"
      data-testid="task-evidence-view"
      data-workbench-view="evidence"
      data-evidence-id={evidenceId}
      data-state={stale ? "stale" : !relationValid ? "unrelated" : result.status}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">证据 → 源码</p>
          <h3 id="task-evidence-title" className="mt-1 truncate font-mono text-sm font-semibold text-text-primary" title={evidenceId}>{evidenceId}</h3>
        </div>
        <span className="uc-status-badge" data-severity={ready ? "ok" : stale || result.status === "stale" ? "warning" : "problem"}>
          {ready ? "当前" : stale || result.status === "stale" ? "已过期" : "不可用"}
        </span>
      </div>

      {!relationValid ? (
        <p className="mt-4 text-sm leading-6 text-text-secondary" role="alert">
          此证据不属于当前选中的发现项。
        </p>
      ) : stale ? (
        <p className="mt-4 text-sm leading-6 text-text-secondary" role="status">
          任务快照已过期，源码与图谱叠加已隐藏。
        </p>
      ) : ready ? (
        <>
          <dl className="mt-4 grid gap-2 text-xs text-text-secondary sm:grid-cols-2">
            <div><dt>文件</dt><dd className="mt-1 break-all font-mono text-text-primary">{ready.source.filePath}</dd></div>
            <div><dt>行号</dt><dd className="mt-1 font-mono text-text-primary">{ready.source.lineRange[0]}–{ready.source.lineRange[1]}</dd></div>
          </dl>
          <div className="mt-4 max-h-80 overflow-auto rounded-md border border-border-subtle bg-root" role="region" aria-label="证据源码行">
            <pre className="min-w-max p-3 text-xs leading-5 text-text-secondary">
              {sourceLines(ready.source.content, ready.source.lineRange[0]).map((line) => (
                <span key={line.number} className="block" data-source-line={line.number}>
                  <span aria-hidden="true" className="mr-4 inline-block w-8 select-none text-right text-text-muted">{line.number}</span>
                  <code>{line.text || " "}</code>
                </span>
              ))}
            </pre>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {ready.evidence.nodeIds.map((nodeId) => (
              <button
                key={nodeId}
                type="button"
                onClick={() => onOpenGraph?.(nodeId)}
                disabled={!onOpenGraph}
                className="min-h-11 rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-left text-xs font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="task-evidence-open-graph"
                data-node-id={nodeId}
              >
                打开图谱节点
                <span className="ml-2 font-mono font-normal">{nodeId}</span>
              </button>
            ))}
            {ready.evidence.nodeIds.length === 0 && (
              <p className="text-xs text-text-muted">此证据未绑定图谱节点。</p>
            )}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm leading-6 text-text-secondary" role="status">
          {result.message ?? "Evidence source is unavailable. / 证据源码不可用。"}
        </p>
      )}
    </section>
  );
}
