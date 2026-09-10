import { useCallback, useEffect, useState } from "react";
import { launchTaskWorkbench, loadTaskDiscovery } from "../../workbench/taskDiscovery";
import { taskStatusLabel } from "./TaskFirstWorkbench";

const REPOSITORY_LABELS: Record<string, string> = { ready: "已就绪", fresh: "当前", partial: "部分就绪", stale: "已过期", unavailable: "不可用", missing: "尚未生成", invalid: "需要修复" };

export default function TaskHome({ accessToken, onTokenInvalid, onOpenGraph, onOpenKnowledge }: {
  readonly accessToken: string;
  readonly onTokenInvalid: () => void;
  readonly onOpenGraph: () => void;
  readonly onOpenKnowledge: () => void;
}) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof loadTaskDiscovery>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingTaskId, setOpeningTaskId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("复制启动指令");
  const [revision, setRevision] = useState(0);
  const data = result?.value;
  const runtimeName = data?.runtime.kind === "local_durable_v1" ? "本地持久任务" : "任务服务";
  const prompt = `请使用 Understand Code 为当前仓库${data?.repository.name ? `（${data.repository.name}）` : ""}处理这个需求：<填写需求>。先读取仓库状态和快照，创建持久 Task；把目标、验收条件、源码证据与未知项写入任务，并返回 taskId 和 Workbench 链接。若工具不可用，请说明当前连接或能力限制。`;
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    async function refresh() {
      if (inFlight) return;
      inFlight = true;
      setLoading(true);
      const next = await loadTaskDiscovery(accessToken);
      inFlight = false;
      if (cancelled) return;
      if (next.status === "forbidden") onTokenInvalid();
      setResult(next);
      setLoading(false);
    }
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState !== "hidden") void refresh(); }, 10_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [accessToken, onTokenInvalid, revision]);
  const select = useCallback(async (taskId: string) => {
    if (openingTaskId) return;
    setOpeningTaskId(taskId);
    setOpenError(null);
    const result = await launchTaskWorkbench(taskId, accessToken, window.location.origin);
    if (result.status === "forbidden") onTokenInvalid();
    else if (result.status === "ready" && result.url) window.location.assign(result.url);
    else setOpenError("无法打开此任务，请刷新列表或让宿主重新生成工作台链接。");
    setOpeningTaskId(null);
  }, [accessToken, onTokenInvalid, openingTaskId]);

  return <main className="min-h-0 flex-1 overflow-auto bg-root p-4 sm:p-6" data-testid="task-home">
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">任务首页</h1><p className="mt-2 text-sm text-text-secondary">在 Codex 或 Claude 中提出需求，在这里审阅任务与证据。</p></div><button type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)} className="min-h-11 rounded border border-border-medium px-3 text-sm disabled:opacity-50">{loading ? "读取中…" : "刷新任务列表"}</button></header>
      <section className="uc-panel p-4" aria-label="仓库与连接状态"><h2 className="font-semibold">仓库与连接</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-text-muted">当前仓库</dt><dd className="mt-1 break-all">{data ? `${data.repository.name ? `${data.repository.name} · ` : ""}${data.repository.repoId}` : "尚未确认"}</dd></div><div><dt className="text-text-muted">工作台连接</dt><dd className="mt-1">{result?.status === "ready" ? "已连接当前本地服务" : loading ? "正在检测" : "未确认"}</dd></div><div><dt className="text-text-muted">仓库产物</dt><dd className="mt-1">{data ? REPOSITORY_LABELS[data.repository.status] ?? "未知" : "未知"}{data?.repository.reason ? ` · ${data.repository.reason}` : ""}</dd></div><div><dt className="text-text-muted">任务后端</dt><dd className="mt-1">{data ? data.runtime.ready ? `已就绪 · ${runtimeName}` : `受限 · ${data.runtime.reason ?? runtimeName}` : "尚未确认"}</dd></div></dl>
        {data && <details className="mt-3 text-xs text-text-muted"><summary>连接元数据</summary><p className="mt-1 font-mono">{data.runtime.kind} · {data.repository.status}</p></details>}
        {data?.repository.snapshotId && <p className="mt-3 break-all font-mono text-xs text-text-muted">快照 {data.repository.snapshotId}</p>}
        <p className="mt-3 text-xs leading-5 text-text-muted">此处确认浏览器到服务的连接。宿主已注册、当前 Codex 会话已获得工具，需要在宿主中分别确认。</p>
        {(result?.message || data?.runtime.nextAction) && <p className="mt-3 text-sm leading-6 text-warning" role="status">{result?.message ?? data?.runtime.nextAction}</p>}
      </section>
      <section className="uc-panel p-4"><h2 className="font-semibold">最近任务</h2>{openError && <p role="alert" className="mt-2 text-sm text-warning">{openError}</p>}<p className="mt-1 text-xs text-text-muted">当前仓库中持久化的任务，按最近更新时间排列。页面可见时每 10 秒刷新。</p>
        {data && data.tasks.length > 0 ? <ul className="mt-3 space-y-2">{[...data.tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((task) => <li key={task.taskId}><button type="button" onClick={() => void select(task.taskId)} disabled={openingTaskId !== null} className="w-full rounded border border-border-subtle p-3 text-left hover:border-accent/40"><span className="block text-sm font-semibold text-accent">{openingTaskId === task.taskId ? "正在打开…" : task.title}</span><span className="mt-1 block text-sm text-text-secondary">{task.originalIntent}</span><span className="mt-2 block text-xs text-text-muted">{taskStatusLabel(task.status)} · 修订版 {task.revision} · {new Date(task.updatedAt).toLocaleString()}</span></button></li>)}</ul> : <p className="mt-4 text-sm text-text-muted">{loading ? "正在读取任务…" : data ? "当前仓库还没有持久任务。" : "任务历史暂不可用；无法据此判断仓库中没有任务。"}</p>}
      </section>
      <section className="uc-panel p-4"><h2 className="font-semibold">从宿主开始</h2><p className="mt-2 text-sm leading-6 text-text-secondary">将下面内容复制到已连接 Understand Code 的 Codex 或 Claude 会话，替换需求后发送。此页面不运行修改或验证命令。</p><textarea aria-label="复制到宿主的启动指令" readOnly value={prompt} rows={4} className="mt-3 w-full rounded border border-border-medium bg-root p-3 text-sm leading-6" /><div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={() => { if (!navigator.clipboard) { setCopyStatus("请选中上方文本复制"); return; } void navigator.clipboard.writeText(prompt).then(() => setCopyStatus("已复制")).catch(() => setCopyStatus("请选中上方文本复制")); }} className="min-h-11 rounded border border-accent/35 px-3 text-sm text-accent">{copyStatus}</button><button type="button" onClick={onOpenKnowledge} className="min-h-11 rounded border border-border-medium px-3 text-sm">浏览知识库</button><button type="button" onClick={onOpenGraph} className="min-h-11 rounded border border-border-medium px-3 text-sm">浏览关系图谱</button></div></section>
    </div>
  </main>;
}
