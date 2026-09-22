import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useDashboardStore } from "../../store";
import { useEvidenceExcerpts } from "../../wiki/ExcerptContext";
import { resolveWikiResourceLink, type WikiResourceTarget } from "../../wiki/wikiResourceLinks";
import { wikiTargetHash, type WikiTarget } from "../../wiki/wikiContent";

export interface WikiResourceLinkProps {
  href?: string;
  children?: ReactNode;
  currentMarkdownPath: string;
  pageIdByMarkdownPath: ReadonlyMap<string, string>;
  onSelectTarget: (target: WikiTarget) => void;
  repositoryRoot?: string;
}

function readableResourcePath(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

function SourceExcerpt({ target }: { target: Extract<WikiResourceTarget, { kind: "source" }> }) {
  const { excerpts, loading, error, retry } = useEvidenceExcerpts([target.evidence.id]);
  const content = excerpts.get(target.evidence.id) ?? target.evidence.excerpt;
  if (!content) return <span className="uc-resource-message" role="status">
    {loading ? "正在读取源码片段…" : error ?? "该引用已收录，暂时无法读取源码片段。"}
    {error && <button type="button" onClick={retry} disabled={loading}>重试读取证据</button>}
  </span>;
  const lines = content.replace(/\n$/u, "").split("\n");
  const requestedIndex = (target.line ?? target.evidence.lineRange[0]) - target.evidence.lineRange[0];
  const hasRequestedLine = requestedIndex >= 0 && requestedIndex < lines.length;
  const start = hasRequestedLine ? Math.max(0, requestedIndex - 6) : 0;
  const shown = lines.slice(start, start + 20);
  const firstLine = target.evidence.lineRange[0] + start;
  return <>
    <span className="uc-resource-message">已收录源码 · 第 {firstLine}–{firstLine + shown.length - 1} 行</span>
    {target.line !== undefined && !hasRequestedLine && <span className="uc-resource-message">当前片段未包含第 {target.line} 行。</span>}
    <code className="uc-resource-code" tabIndex={0} aria-label={`${target.filePath} 源码片段`}>
      {shown.map((text, index) => {
        const line = firstLine + index;
        return <span key={line} className="uc-resource-code-line" data-highlighted={line === target.line}>
          <span className="uc-resource-line-number" aria-hidden="true">{line}</span>
          <span>{text || " "}</span>
        </span>;
      })}
    </code>
  </>;
}

/** All children are phrasing content so this also works inside Markdown p/td. */
export function WikiResourceLink({ href, children, currentMarkdownPath, pageIdByMarkdownPath, onSelectTarget, repositoryRoot }: WikiResourceLinkProps) {
  const index = useDashboardStore((state) => state.wikiIndex);
  const target = resolveWikiResourceLink(href, {
    currentMarkdownPath,
    pageIdByMarkdownPath,
    repositoryRoot: repositoryRoot ?? index.payload?.source.sourceRootIdentity,
    evidence: index.payload?.evidence,
  });
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const regionId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setOpen(false);
    setCopyStatus("");
  }, [href, currentMarkdownPath]);
  if (target.kind === "wiki") return <a href={wikiTargetHash(target.target)} className="uc-prose-link" onClick={(event) => {
    event.preventDefault();
    onSelectTarget(target.target);
  }}>{children}</a>;
  if (target.kind === "external") return <a href={target.href} className="uc-prose-link" target={target.newTab ? "_blank" : undefined} rel={target.newTab ? "noreferrer noopener" : undefined}>{children}</a>;

  const path = readableResourcePath(href || (target.kind === "source" ? target.filePath : "未提供路径"));
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopyStatus("已复制");
    } catch {
      setCopyStatus("复制失败，请选择路径后复制");
    }
  };
  return <span className="uc-resource-reference">
    <button ref={trigger} type="button" className="uc-resource-link" title={path} aria-expanded={open} aria-controls={open ? regionId : undefined} onClick={() => { setOpen((value) => !value); setCopyStatus(""); }}>
      <span aria-hidden="true" className="uc-resource-link-icon">{target.kind === "source" ? "↗" : "ⓘ"}</span>{children}
    </button>
    {open && <span id={regionId} className="uc-resource-panel" role="region" aria-label={target.kind === "source" ? "源码预览" : "资源说明"} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <span className="uc-resource-panel-heading">{target.kind === "source" ? "源码预览" : "当前知识库未收录此资源"}</span>
      <code className="uc-resource-path">{target.kind === "source" ? target.filePath : path}</code>
      {target.kind === "source" ? <SourceExcerpt target={target} /> : <span className="uc-resource-message">此资源没有可显示的已发布内容。可复制路径在本地查看，或继续阅读当前文档。</span>}
      <span className="uc-resource-actions">
        <button type="button" onClick={() => void copy()}>复制路径</button>
        <button type="button" onClick={close}>收起</button>
        <span role="status">{copyStatus}</span>
      </span>
    </span>}
  </span>;
}
