import type { WikiEvidenceV2, WikiPageV2 } from "@understand-code/core/knowledge-base";
import type { WikiTarget } from "../../wiki/wikiContent";
import type { GraphExplorerView, GraphSelectionDetails } from "./graphExplorerModel";
import { graphNodeTypeLabel } from "./semanticGraphCanvasModel";

interface GraphDetailsRailProps {
  view: GraphExplorerView;
  onSelectObject: (nodeId: string) => void;
  onOpenScope: (scopeId: string) => void;
  onOpenFile: (scopeId: string, fileId: string) => void;
  onSelectWikiTarget: (target: WikiTarget) => unknown;
}

const EVIDENCE_LABELS: Record<WikiEvidenceV2["evidenceType"], string> = {
  production: "生产代码",
  configuration: "配置",
  test: "测试",
  documentation: "文档",
};

function selectionTitle(selection: GraphSelectionDetails): string {
  return selection.kind === "raw" ? selection.node.name : selection.node.label;
}

function RelatedNodes({
  title,
  nodes,
  onSelectObject,
}: {
  title: string;
  nodes: GraphSelectionDetails["upstream"];
  onSelectObject: (nodeId: string) => void;
}) {
  return (
    <section className="uc-panel-muted p-3">
      <h3 className="text-[11px] font-semibold text-text-primary">{title}</h3>
      {nodes.length === 0 ? (
        <p className="mt-2 text-xs leading-5 text-text-muted">暂无可见关系</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {nodes.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => onSelectObject(node.id)}
                className="w-full rounded-md border border-border-subtle px-2.5 py-2 text-left transition-colors hover:border-accent/35 hover:bg-accent/5"
              >
                <span className="block truncate text-xs font-medium text-text-primary">{node.label}</span>
                <span className="mt-0.5 block truncate text-[10px] text-text-muted">{node.summary}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PageList({ title, pages, emptyText }: {
  title: string;
  pages: WikiPageV2[];
  emptyText: string;
}) {
  return (
    <section className="uc-panel-muted p-3">
      <h3 className="text-[11px] font-semibold text-text-primary">{title}</h3>
      {pages.length === 0 ? (
        <p className="mt-2 text-xs leading-5 text-text-muted">{emptyText}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {pages.map((page) => (
            <li key={page.id} className="border-t border-border-subtle pt-2 first:border-t-0 first:pt-0">
              <p className="text-sm font-medium text-text-primary">{page.title}</p>
              <p className="mt-1 text-xs leading-5 text-text-muted">{page.summary}</p>
              <p className="uc-code-ref mt-1">{page.markdownPath}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EvidenceList({ evidence }: { evidence: WikiEvidenceV2[] }) {
  return (
    <section className="uc-panel-muted p-3">
      <h3 className="text-[11px] font-semibold text-text-primary">源码证据</h3>
      {evidence.length === 0 ? (
        <p className="mt-2 text-xs leading-5 text-text-muted">暂无精确证据记录</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {evidence.map((item) => (
            <li key={item.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium text-text-primary">{item.filePath}</p>
                <span className="shrink-0 rounded border border-border-subtle px-1.5 py-0.5 text-[10px] text-text-muted">
                  {EVIDENCE_LABELS[item.evidenceType]}
                </span>
              </div>
              <p className="uc-code-ref mt-1">{item.filePath}:{item.lineRange[0]}-{item.lineRange[1]}</p>
              {item.excerpt && (
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-root/70 px-2 py-1.5 text-[10px] leading-4 text-text-secondary">
                  {item.excerpt}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Overview({ selection }: { selection: GraphSelectionDetails }) {
  if (selection.kind === "raw") {
    const lineRange = selection.node.lineRange
      ? `${selection.node.lineRange[0]}-${selection.node.lineRange[1]}`
      : null;
    return (
      <section className="uc-panel-muted p-3">
        <h3 className="text-[11px] font-semibold text-text-primary">节点职责</h3>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          {selection.node.summary || "暂无职责说明"}
        </p>
        <dl className="mt-3 grid gap-2 text-xs">
          <div><dt className="text-text-muted">类型</dt><dd className="mt-0.5 text-text-primary">{graphNodeTypeLabel(selection.node.type)}</dd></div>
          {selection.node.filePath && (
            <div><dt className="text-text-muted">路径</dt><dd className="uc-code-ref mt-0.5">{selection.node.filePath}</dd></div>
          )}
          {lineRange && (
            <div><dt className="text-text-muted">行号</dt><dd className="mt-0.5 font-mono text-[11px] text-text-primary">{lineRange}</dd></div>
          )}
          <div><dt className="text-text-muted">节点 ID</dt><dd className="uc-code-ref mt-0.5">{selection.id}</dd></div>
        </dl>
      </section>
    );
  }

  const counts = selection.documentationCounts;
  return (
    <section className="uc-panel-muted p-3">
      <h3 className="text-[11px] font-semibold text-text-primary">
        {selection.kind === "boundary" ? "外部范围" : "范围概览"}
      </h3>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{selection.responsibility}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div><dt className="text-text-muted">有专门正文</dt><dd className="mt-0.5 text-text-primary">{counts.direct}/{counts.total}</dd></div>
        <div><dt className="text-text-muted">仅相关资料</dt><dd className="mt-0.5 text-text-primary">{counts.context}</dd></div>
        <div><dt className="text-text-muted">待补正文</dt><dd className="mt-0.5 text-text-primary">{counts.none}</dd></div>
        <div><dt className="text-text-muted">生成或证据异常</dt><dd className="mt-0.5 text-text-primary">{counts.problem}</dd></div>
      </dl>
    </section>
  );
}

export default function GraphDetailsRail({
  view,
  onSelectObject,
  onOpenScope,
  onOpenFile,
  onSelectWikiTarget,
}: GraphDetailsRailProps) {
  const { selection, hiddenSelectedNode } = view;
  const heading = hiddenSelectedNode
    ? "当前层级未显示所选节点"
    : selection
      ? selectionTitle(selection)
      : "选择一个图谱元素";
  const drillTarget = selection?.drillTarget ?? null;
  const primaryDirectPageId = selection?.primaryDirectPageId ?? null;

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-border-subtle bg-surface xl:h-full max-xl:h-auto max-xl:w-full max-xl:border-l-0 max-xl:border-t">
      <header className="border-b border-border-subtle px-4 py-4">
        <p className="text-[11px] font-semibold text-text-muted">图谱详情</p>
        <h2 className="mt-1 truncate text-base font-semibold text-text-primary">{heading}</h2>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-4 max-xl:flex-none max-xl:overflow-visible">
        {hiddenSelectedNode ? (
          <section className="uc-panel-muted p-3">
            <p className="text-sm font-medium text-text-primary">{hiddenSelectedNode.name}</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              当前层级或模式没有显示这个节点。请返回包含它的范围，或切换到可用的关系视图后继续查看。
            </p>
            <p className="uc-code-ref mt-3">{hiddenSelectedNode.id}</p>
          </section>
        ) : !selection ? (
          <p className="uc-panel-muted p-3 text-sm leading-6 text-text-muted">
            选择节点、范围或外部入口后，可查看职责、上下游、正文与源码证据。
          </p>
        ) : (
          <>
            <Overview selection={selection} />

            {(drillTarget || primaryDirectPageId) && (
              <section className="uc-panel-muted space-y-2 p-3">
                {drillTarget?.kind === "scope" && (
                  <button
                    type="button"
                    onClick={() => onOpenScope(drillTarget.scopeId)}
                    className="w-full rounded-md border border-border-subtle px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-accent/35 hover:bg-accent/5"
                  >
                    {selection.kind === "boundary" ? "进入范围" : "查看范围"}
                  </button>
                )}
                {drillTarget?.kind === "file" && (
                  <button
                    type="button"
                    onClick={() => onOpenFile(drillTarget.scopeId, drillTarget.fileId)}
                    className="w-full rounded-md border border-border-subtle px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-accent/35 hover:bg-accent/5"
                  >
                    查看文件关系
                  </button>
                )}
                {primaryDirectPageId && (
                  <button
                    type="button"
                    onClick={() => onSelectWikiTarget({ pageId: primaryDirectPageId })}
                    className="w-full rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/15"
                  >
                    阅读正文
                  </button>
                )}
              </section>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <RelatedNodes title="上游" nodes={selection.upstream} onSelectObject={onSelectObject} />
              <RelatedNodes title="下游" nodes={selection.downstream} onSelectObject={onSelectObject} />
            </div>
            <PageList title="专门正文" pages={selection.directPages} emptyText="暂无专门正文" />
            <PageList title="相关资料" pages={selection.contextPages} emptyText="暂无相关资料" />
            <EvidenceList evidence={selection.evidence} />
          </>
        )}
      </div>
    </aside>
  );
}
