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

const STAGE_SUMMARY = {
  purpose: "先确认项目边界与核心价值",
  flow: "沿主路径理解请求怎样推进",
  rule: "识别决定行为的条件与约束",
  implementation: "进入承担职责的模块与文件",
  evidence: "回到源码位置核验结论",
} as const;

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
    <main className="uc-guided-home">
      <header className="uc-guided-home-intro">
        <p className="uc-eyebrow">推荐起点</p>
        <h1>先理解项目，再进入代码</h1>
        <p>{projectName} 的知识按同一条路线从业务目标展开到可核验源码。</p>
      </header>

      <ol className="uc-guided-route" aria-label="理解项目的五个阶段">
        {STAGE_ORDER.map((stage, index) => (
          <li key={stage} className="uc-guided-route-item">
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <span>
              <strong>{STAGE_LABEL[stage]}</strong>
              <small>{STAGE_SUMMARY[stage]}</small>
            </span>
          </li>
        ))}
      </ol>

      <section className="uc-reading-list" aria-labelledby="guided-reading-heading">
        <h2 id="guided-reading-heading">推荐阅读路线</h2>
        {routePages.length === 0 ? (
          <p>
            当前没有可发布的主干阅读文档，请到知识库状态查看原因。
          </p>
        ) : (
          <ol>
            {routePages.map((page, index) => (
              <li key={page.id}>
                <button type="button" onClick={() => onOpenPage(page.id)}>
                  <span className="uc-reading-list-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="uc-reading-list-copy">
                    <small>{page.route ? STAGE_LABEL[page.route.stage] : "推荐阅读"}</small>
                    <strong>{page.title}</strong>
                    <span>{page.summary}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="uc-guided-actions">
        <button
          type="button"
          disabled={!routePages[0]}
          onClick={() => routePages[0] && onOpenPage(routePages[0].id)}
        >
          开始阅读
        </button>
        <button
          type="button"
          onClick={onOpenGraph}
        >
          查看关系图谱
        </button>
        <button
          type="button"
          onClick={(event) => onOpenReference(event.currentTarget)}
        >
          查找文件或符号
        </button>
      </div>
    </main>
  );
}
