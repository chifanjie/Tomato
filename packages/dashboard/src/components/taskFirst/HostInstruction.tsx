import { useId, useState } from "react";

/** Prepare a reviewable handoff; the workbench never sends or executes it. */
export default function HostInstruction({ title, context, request }: {
  readonly title: string;
  readonly context: Readonly<Record<string, string | number | undefined>>;
  readonly request: string;
}) {
  const id = useId();
  const [feedback, setFeedback] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const instruction = [
    "请使用 Understand Code 处理以下请求，并先核对任务及来源版本：",
    ...Object.entries(context).filter(([, value]) => value !== undefined).map(([key, value]) => `${key}: ${value}`),
    request,
    ...(feedback.trim() ? [`我的反馈：${feedback.trim()}`] : []),
    "请保留上述定位，报告处理结果；需要修改或发布时遵循宿主的授权流程。",
  ].join("\n");
  return <details className="mt-3 text-sm" data-testid="host-instruction">
    <summary className="cursor-pointer py-2 font-medium text-accent">{title}</summary>
    <label htmlFor={`${id}-feedback`} className="mt-2 block text-xs text-text-secondary">补充说明（可选）</label>
    <textarea id={`${id}-feedback`} value={feedback} onChange={(event) => { setFeedback(event.target.value); setCopyStatus(""); }} rows={2} className="mt-1 w-full rounded border border-border-medium bg-root p-2" />
    <label htmlFor={`${id}-instruction`} className="mt-2 block text-xs text-text-secondary">发送给宿主的完整指令</label>
    <textarea id={`${id}-instruction`} readOnly value={instruction} rows={6} className="mt-1 w-full rounded border border-border-medium bg-root p-2 text-xs leading-5" />
    <button type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(instruction); setCopyStatus("已复制，请粘贴到宿主会话发送。"); }
      catch { setCopyStatus("复制失败，请选中上方完整指令复制。"); }
    }} className="mt-2 min-h-11 rounded border border-accent/35 px-3 text-accent">复制完整指令</button>
    <p role="status" className="mt-2 text-xs text-text-muted">{copyStatus || "本页面仅准备指令，不会发送、执行或自动发布。"}</p>
  </details>;
}
