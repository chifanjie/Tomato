import type { WikiEvidenceV2, WikiPageV2 } from "@understand-code/core/knowledge-base";
import type { WikiOutlineHeading } from "./WikiPageView";

interface WikiEvidenceRailProps {
  page: WikiPageV2;
  directPages: readonly WikiPageV2[];
  contextPages: readonly WikiPageV2[];
  evidence: readonly WikiEvidenceV2[];
  directGraphNodeIds: readonly string[];
  headings: readonly WikiOutlineHeading[];
  onOpenPage: (pageId: string) => void;
  onOpenGraph: (pageId: string) => void;
}

const EVIDENCE_TYPE_LABELS: Record<WikiEvidenceV2["evidenceType"], string> = {
  production: "生产代码",
  configuration: "配置",
  test: "测试",
  documentation: "文档",
};

function evidenceLocation(item: WikiEvidenceV2): string {
  const [startLine, endLine] = item.lineRange;
  const lineRange = startLine === endLine
    ? `第 ${startLine} 行`
    : `第 ${startLine}–${endLine} 行`;
  return `${item.filePath} · ${lineRange}`;
}

function PageRows({
  pages,
  emptyText,
  onOpenPage,
}: {
  pages: readonly WikiPageV2[];
  emptyText: string;
  onOpenPage: (pageId: string) => void;
}) {
  if (pages.length === 0) {
    return <p className="mt-3 text-sm text-text-muted">{emptyText}</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      {pages.map((relatedPage) => (
        <button
          key={relatedPage.id}
          type="button"
          onClick={() => onOpenPage(relatedPage.id)}
          className="block w-full rounded border border-border-subtle bg-surface px-3 py-2 text-left transition-colors hover:border-accent/35 hover:bg-accent/5"
        >
          <span className="block text-sm font-medium text-text-primary">{relatedPage.title}</span>
          <span className="mt-1 block text-xs leading-5 text-text-muted">{relatedPage.summary}</span>
        </button>
      ))}
    </div>
  );
}

export default function WikiEvidenceRail({
  page,
  directPages,
  contextPages,
  evidence,
  directGraphNodeIds,
  headings,
  onOpenPage,
  onOpenGraph,
}: WikiEvidenceRailProps) {
  const hasGraphNodes = directGraphNodeIds.length > 0;

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-border-subtle bg-surface max-lg:h-auto max-lg:w-full max-lg:border-l-0 max-lg:border-t">
      <header className="border-b border-border-subtle px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">代码证据</p>
        <h2 className="mt-1 text-base font-semibold text-text-primary">知识库与图谱关联</h2>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-auto px-4 py-4">
        {headings.length > 0 && (
          <nav aria-label="本文目录" className="border-l border-border-medium pl-3 max-lg:hidden">
            <h3 className="text-xs font-semibold text-text-primary">本文目录</h3>
            <div className="mt-2 max-h-56 space-y-0.5 overflow-auto pr-1">
              {headings.map((heading) => (
                <button
                  key={heading.id}
                  type="button"
                  onClick={() => document.getElementById(heading.id)?.scrollIntoView({ block: "start" })}
                  className={`block w-full rounded px-2 py-1.5 text-left text-xs leading-5 text-text-muted transition-colors hover:bg-elevated hover:text-text-primary ${heading.level === 3 ? "pl-5" : heading.level === 4 ? "pl-7" : "font-medium"}`}
                >
                  {heading.text}
                </button>
              ))}
            </div>
          </nav>
        )}

        <button
          type="button"
          onClick={() => onOpenGraph(page.id)}
          disabled={!hasGraphNodes}
          className="w-full rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-elevated/30 disabled:text-text-muted"
        >
          {hasGraphNodes ? "在图谱中查看本文节点" : "本文暂无图谱节点"}
        </button>

        <section aria-labelledby="wiki-direct-pages-heading" className="uc-panel-muted p-3">
          <h3 id="wiki-direct-pages-heading" className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            直接讲解
          </h3>
          <PageRows pages={directPages} emptyText="暂无其他直接讲解本文节点的文档。" onOpenPage={onOpenPage} />
        </section>

        <section aria-labelledby="wiki-context-pages-heading" className="uc-panel-muted p-3">
          <h3 id="wiki-context-pages-heading" className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            相关资料
          </h3>
          <PageRows pages={contextPages} emptyText="暂无补充背景资料。" onOpenPage={onOpenPage} />
        </section>

        <section aria-labelledby="wiki-source-evidence-heading" className="uc-panel-muted p-3">
          <h3 id="wiki-source-evidence-heading" className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            源码证据
          </h3>
          <div className="mt-3 space-y-2">
            {evidence.length === 0 ? (
              <p className="text-sm text-text-muted">本文尚未绑定源码证据。</p>
            ) : evidence.map((item) => (
              <details key={item.id} className="uc-panel">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-text-primary">
                  {evidenceLocation(item)}
                </summary>
                <div className="border-t border-border-subtle px-3 py-3">
                  <p className="text-xs font-semibold text-text-muted">
                    {EVIDENCE_TYPE_LABELS[item.evidenceType]}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-text-secondary">
                    {item.excerpt ?? "未提供代码片段"}
                  </pre>
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
