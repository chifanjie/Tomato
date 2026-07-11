import { useDashboardStore } from "../../store";
import type { GraphExplorerView } from "./graphExplorerModel";

interface GraphDetailsRailProps {
  view: GraphExplorerView;
}

function formatLineRange(lineRange: [number, number] | undefined): string | null {
  if (!lineRange) return null;
  return `${lineRange[0]}-${lineRange[1]}`;
}

function formatCoverage(status: string | undefined): string {
  const labels: Record<string, string> = {
    complete: "生成完成",
    partial: "部分生成",
    failed: "生成失败",
    unknown: "未评估",
  };
  return status ? labels[status] ?? status : labels.unknown;
}

export default function GraphDetailsRail({ view }: GraphDetailsRailProps) {
  const openWikiForGraphNode = useDashboardStore((state) => state.openWikiForGraphNode);
  const node = view.selectedNode;
  const hiddenNode = view.hiddenSelectedNode;
  const semanticNode = view.selectedSemanticNode;
  const lineRange = formatLineRange(node?.lineRange);
  const hiddenLineRange = formatLineRange(hiddenNode?.lineRange);
  const evidence = semanticNode?.docs.evidence ?? [];
  const failureReasons = semanticNode?.docs.failureReasons ?? [];

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-border-subtle bg-surface xl:h-full max-xl:h-auto max-xl:w-full max-xl:border-l-0 max-xl:border-t">
      <header className="border-b border-border-subtle px-4 py-4">
        <p className="text-[11px] font-semibold uppercase text-text-muted">图谱详情</p>
        <h2 className="mt-1 truncate text-base font-semibold text-text-primary">
          {hiddenNode ? "所选节点在当前视图中隐藏" : node?.name ?? "选择一个节点"}
        </h2>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-4 max-xl:flex-none max-xl:overflow-visible">
        {hiddenNode ? (
          <>
            <section className="uc-panel-muted p-3">
              <h3 className="text-[10px] font-semibold uppercase text-text-muted">隐藏的节点</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{hiddenNode.name} 仍被选中，但当前图谱模式没有显示它。</p>
              <dl className="mt-3 grid gap-2 text-xs">
                <div><dt className="text-text-muted">类型</dt><dd className="mt-0.5 text-text-primary">{hiddenNode.type}</dd></div>
                {hiddenNode.filePath && <div><dt className="text-text-muted">路径</dt><dd className="uc-code-ref mt-0.5 text-text-primary">{hiddenNode.filePath}</dd></div>}
                {hiddenLineRange && <div><dt className="text-text-muted">行号</dt><dd className="mt-0.5 font-mono text-[11px] text-text-primary">{hiddenLineRange}</dd></div>}
              </dl>
            </section>
            {view.canOpenWiki && (
              <button type="button" onClick={() => openWikiForGraphNode(hiddenNode.id)} className="w-full rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent">
                阅读关联文档
              </button>
            )}
          </>
        ) : !node ? (
          <p className="uc-panel-muted p-3 text-sm leading-6 text-text-muted">选择一个图谱节点以查看知识库覆盖与代码证据。</p>
        ) : (
          <>
            <section className="uc-panel-muted p-3">
              <h3 className="text-[10px] font-semibold uppercase text-text-muted">节点</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{node.summary || "暂无说明。"}</p>
              {node.filePath && <p className="uc-code-ref mt-3">{node.filePath}{lineRange ? `:${lineRange}` : ""}</p>}
            </section>

            <section className="uc-panel-muted p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[10px] font-semibold uppercase text-text-muted">知识库覆盖</h3>
                <span className="rounded border border-border-subtle px-2 py-1 text-[11px] font-medium text-text-secondary">{formatCoverage(view.selectedCoverage?.status)}</span>
              </div>
              {view.canOpenWiki && (
                <button type="button" onClick={() => openWikiForGraphNode(node.id)} className="mt-3 w-full rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent">
                  阅读关联文档
                </button>
              )}
              <div className="mt-3 space-y-2">
                {view.selectedPages.length === 0 ? <p className="text-sm text-text-muted">暂无关联文档。</p> : view.selectedPages.map((page) => (
                  <div key={page.id} className="border-t border-border-subtle pt-2 first:border-t-0 first:pt-0">
                    <p className="text-sm font-medium text-text-primary">{page.title}</p>
                    <p className="mt-1 text-xs leading-5 text-text-muted">{page.summary}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="uc-panel-muted p-3">
              <h3 className="text-[10px] font-semibold uppercase text-text-muted">代码证据</h3>
              {evidence.length === 0 ? <p className="mt-2 text-sm text-text-muted">暂无关联证据。</p> : (
                <ul className="mt-2 space-y-3">
                  {evidence.map((item) => (
                    <li key={item.id}>
                      <p className="text-sm font-medium text-text-primary">{item.filePath}</p>
                      <p className="uc-code-ref mt-1">{item.filePath}:{item.lineRange[0]}-{item.lineRange[1]}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {failureReasons.length > 0 && (
              <section className="uc-panel-muted p-3">
                <h3 className="text-[10px] font-semibold uppercase text-text-muted">生成状态说明</h3>
                <ul className="mt-2 list-disc space-y-2 pl-4 text-sm text-text-muted">
                  {failureReasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
