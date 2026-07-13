import type { WikiPageV2 } from "@understand-code/core/knowledge-base";

const STAGE_LABEL = {
  purpose: "项目做什么",
  flow: "怎样流转",
  rule: "有哪些规则",
  implementation: "代码怎样实现",
  evidence: "怎样核验源码",
} as const;

const STAGE_ORDER = [
  "purpose",
  "flow",
  "rule",
  "implementation",
  "evidence",
] as const;

export interface GuidedWikiHomeProps {
  projectName: string;
  routePages: readonly WikiPageV2[];
  onOpenPage: (pageId: string) => void;
  onOpenGraph: () => void;
  onOpenReference: (opener: HTMLButtonElement) => void;
}

export default function GuidedWikiHome({
  projectName,
  routePages,
  onOpenPage,
  onOpenGraph,
  onOpenReference,
}: GuidedWikiHomeProps) {
  return (
    <main className="min-w-0 flex-1 overflow-auto px-8 py-10 max-md:px-5 max-md:py-7">
      <p className="text-xs font-semibold tracking-[0.12em] text-text-muted">推荐起点</p>
      <h1 className="mt-2 text-3xl font-semibold text-text-primary max-sm:text-2xl">先理解项目，再进入代码</h1>
      <p className="mt-3 max-w-2xl leading-7 text-text-secondary">
        {projectName} 的知识按同一条路线从业务目标展开到可核验源码。
      </p>

      <ol className="mt-6 flex gap-2 overflow-x-auto pb-2 md:mt-8 md:grid md:grid-cols-5 md:gap-3 md:overflow-visible md:pb-0">
        {STAGE_ORDER.map((stage, index) => (
          <li key={stage} className="uc-panel min-w-[8.75rem] flex-1 px-3 py-3 md:min-w-0 md:p-4">
            <span className="text-xs text-text-muted">{String(index + 1).padStart(2, "0")}</span>
            <strong className="mt-2 block text-text-primary">{STAGE_LABEL[stage]}</strong>
          </li>
        ))}
      </ol>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-text-primary">推荐阅读路线</h2>
        {routePages.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-text-muted">
            当前没有可发布的主干阅读文档，请到知识库状态查看原因。
          </p>
        ) : (
          <ol className="mt-4 grid gap-3 lg:grid-cols-2">
            {routePages.map((page) => (
              <li key={page.id}>
                <button
                  type="button"
                  onClick={() => onOpenPage(page.id)}
                  className="uc-panel w-full p-4 text-left transition-colors hover:border-accent/40"
                >
                  <span className="text-xs text-text-muted">
                    {page.route ? STAGE_LABEL[page.route.stage] : "推荐阅读"}
                  </span>
                  <strong className="mt-1 block text-text-primary">{page.title}</strong>
                  <span className="mt-2 line-clamp-2 block text-sm text-text-secondary">
                    {page.summary}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onOpenGraph}
          className="rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/15"
        >
          查看项目图谱
        </button>
        <button
          type="button"
          onClick={(event) => onOpenReference(event.currentTarget)}
          className="rounded-md border border-border-medium px-3 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
        >
          查找文件或函数
        </button>
      </div>
    </main>
  );
}
