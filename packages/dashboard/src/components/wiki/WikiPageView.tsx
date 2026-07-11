import type { WikiDocumentCategory, WikiPageV2 } from "@understand-code/core/knowledge-base";

interface WikiPageViewProps {
  page: WikiPageV2 | null;
  emptyReason: string | null;
}

const CATEGORY_LABELS: Record<WikiDocumentCategory, string> = {
  overview: "项目概览",
  capability: "业务能力",
  flow: "业务流程",
  module: "核心模块",
  topic: "函数与类型",
  file: "文件说明",
  quality: "质量报告",
  coverage: "覆盖情况",
  other: "其他文档",
};

const GENERATION_STATUS_LABELS: Record<WikiPageV2["generationStatus"], string> = {
  complete: "生成完成",
  partial: "部分生成",
  failed: "生成失败",
};

const QUALITY_LABELS: Record<WikiPageV2["quality"], string> = {
  verified: "已经核验",
  generated: "自动生成",
  "needs-review": "等待核验",
  failed: "质量失败",
};

export default function WikiPageView({ page, emptyReason }: WikiPageViewProps) {
  if (!page) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center bg-root max-lg:min-h-[240px] max-lg:flex-none">
        <div className="uc-panel max-w-md p-6 text-center">
          <h2 className="text-lg font-semibold text-text-primary">尚未选择知识库页面</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            {emptyReason ?? "请从左侧目录选择一篇文档。"}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="uc-doc-surface min-h-0 flex-1 overflow-auto max-lg:flex-none max-lg:overflow-visible">
      <article aria-label={page.title} className="mx-auto max-w-4xl px-10 py-10 max-lg:px-5 max-lg:py-6">
        <header className="border-b border-border-subtle pb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">{CATEGORY_LABELS[page.category]}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-text-primary">{page.title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-text-secondary">{page.summary}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-medium text-text-muted">
            <span className="rounded border border-border-subtle px-2 py-1">{GENERATION_STATUS_LABELS[page.generationStatus]}</span>
            <span className="rounded border border-border-subtle px-2 py-1">{QUALITY_LABELS[page.quality]}</span>
            <span className="uc-code-ref rounded border border-border-subtle px-2 py-1">{page.markdownPath}</span>
          </div>
        </header>

        <section className="uc-readable-prose py-8">
          <h2 className="text-lg font-semibold text-text-primary">关联代码知识</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="uc-panel p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">直接说明</h3>
              {page.directNodeIds.length === 0 ? (
                <p className="mt-3 text-sm text-text-muted">本文没有直接说明的图谱节点。</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {page.directNodeIds.map((nodeId) => <li key={nodeId} className="uc-code-ref">{nodeId}</li>)}
                </ul>
              )}
            </div>
            <div className="uc-panel p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">上下文节点</h3>
              {page.contextNodeIds.length === 0 ? (
                <p className="mt-3 text-sm text-text-muted">本文没有上下文图谱节点。</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {page.contextNodeIds.map((nodeId) => <li key={nodeId} className="uc-code-ref">{nodeId}</li>)}
                </ul>
              )}
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}
