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
  /** Excerpts resolved from the shard store; absent while they load. */
  excerpts?: ReadonlyMap<string, string>;
  excerptsLoading?: boolean;
}

const EMPTY_EXCERPTS: ReadonlyMap<string, string> = new Map();

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

/**
 * Excerpts are published in shards outside the index, so a rail may render
 * before the shard arrives. Any inline excerpt still wins, for older knowledge
 * bases that kept excerpts in the index.
 */
function excerptText(
  item: WikiEvidenceV2,
  excerpts: ReadonlyMap<string, string>,
  loading: boolean,
): string {
  return excerpts.get(item.id)
    ?? item.excerpt
    ?? (loading ? "正在读取代码片段…" : "未提供代码片段");
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
    <div className="uc-evidence-page-list">
      {pages.map((relatedPage) => (
        <button
          key={relatedPage.id}
          type="button"
          onClick={() => onOpenPage(relatedPage.id)}
          className="uc-evidence-page"
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
  excerpts = EMPTY_EXCERPTS,
  excerptsLoading = false,
}: WikiEvidenceRailProps) {
  const hasGraphNodes = directGraphNodeIds.length > 0;

  return (
    <aside className="flex h-full min-h-0 flex-col bg-surface">
      <header className="border-b border-border-subtle px-4 py-4">
        <p className="text-xs font-semibold tracking-wider text-text-muted">代码证据</p>
        <h2 className="mt-1 text-base font-semibold text-text-primary">知识库与图谱关联</h2>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-auto px-4 py-4">
        {headings.length > 0 && (
          <nav aria-label="本文目录" className="uc-wiki-outline border-l border-border-medium pl-3">
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

        <details className="uc-evidence-section">
          <summary>
            <span id="wiki-direct-pages-heading">直接讲解</span>
            <span aria-label={"共 " + directPages.length + " 篇"}>{directPages.length}</span>
          </summary>
          <PageRows
            pages={directPages}
            emptyText="暂无其他直接讲解本文节点的文档。"
            onOpenPage={onOpenPage}
          />
        </details>

        <details className="uc-evidence-section">
          <summary>
            <span id="wiki-context-pages-heading">相关资料</span>
            <span aria-label={"共 " + contextPages.length + " 篇"}>{contextPages.length}</span>
          </summary>
          <PageRows
            pages={contextPages}
            emptyText="暂无补充背景资料。"
            onOpenPage={onOpenPage}
          />
        </details>

        <details className="uc-evidence-section">
          <summary>
            <span id="wiki-source-evidence-heading">源码证据</span>
            <span aria-label={"共 " + evidence.length + " 条"}>{evidence.length}</span>
          </summary>
          <div className="uc-source-evidence-list">
            {evidence.length === 0 ? (
              <p className="text-sm text-text-muted">本文尚未绑定源码证据。</p>
            ) : evidence.map((item) => (
              <details key={item.id} className="uc-source-evidence-item">
                <summary>{evidenceLocation(item)}</summary>
                <div>
                  <p>{EVIDENCE_TYPE_LABELS[item.evidenceType]}</p>
                  <pre>{excerptText(item, excerpts, excerptsLoading)}</pre>
                </div>
              </details>
            ))}
          </div>
        </details>
      </div>
    </aside>
  );
}
