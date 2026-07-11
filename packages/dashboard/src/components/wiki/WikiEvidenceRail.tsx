import type { WikiEvidenceV2, WikiPageV2 } from "@understand-code/core/knowledge-base";

interface WikiEvidenceRailProps {
  page: WikiPageV2 | null;
  evidence: WikiEvidenceV2[];
  graphNodeIds: string[];
  onOpenGraph: (pageId: string) => void;
}

export default function WikiEvidenceRail({ page, evidence, graphNodeIds, onOpenGraph }: WikiEvidenceRailProps) {
  const hasGraphNodes = graphNodeIds.length > 0;

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-border-subtle bg-surface max-lg:h-auto max-lg:w-full max-lg:border-l-0 max-lg:border-t">
      <header className="border-b border-border-subtle px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">代码证据</p>
        <h2 className="mt-1 text-base font-semibold text-text-primary">知识库与图谱关联</h2>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-auto px-4 py-4">
        {page ? (
          <>
            <button
              type="button"
              onClick={() => onOpenGraph(page.id)}
              disabled={!hasGraphNodes}
              className="w-full rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-elevated/30 disabled:text-text-muted"
            >
              {hasGraphNodes ? "在图谱中查看本文节点" : "本文暂无图谱节点"}
            </button>
            <section className="uc-panel-muted p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">关联图谱节点</h3>
              <div className="mt-3 space-y-2">
                {hasGraphNodes ? graphNodeIds.map((nodeId) => (
                  <div key={nodeId} className="uc-code-ref rounded border border-border-subtle bg-surface px-2 py-2">{nodeId}</div>
                )) : <p className="text-sm text-text-muted">本文尚未关联图谱节点。</p>}
              </div>
            </section>
            <section className="uc-panel-muted p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">源码位置</h3>
              <div className="mt-3 space-y-2">
                {evidence.length === 0 ? (
                  <p className="text-sm text-text-muted">本文尚未绑定源码证据。</p>
                ) : evidence.map((item) => (
                  <div key={item.id} className="uc-panel px-2 py-2">
                    <div className="text-sm font-medium text-text-primary">{item.filePath}</div>
                    <div className="uc-code-ref mt-1">{item.filePath} L{item.lineRange[0]}-{item.lineRange[1]}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <p className="uc-panel-muted p-3 text-sm text-text-muted">选择一篇文档后，这里会显示代码证据和图谱入口。</p>
        )}
      </div>
    </aside>
  );
}
