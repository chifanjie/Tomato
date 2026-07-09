import type { WikiEvidenceRecord, WikiPageRecord } from "../../wiki/wikiIndex";

interface WikiEvidenceRailProps {
  page: WikiPageRecord | null;
  evidence: WikiEvidenceRecord[];
  graphNodeIds: string[];
  onOpenGraph: (pageId: string) => void;
}

export default function WikiEvidenceRail({ page, evidence, graphNodeIds, onOpenGraph }: WikiEvidenceRailProps) {
  const hasGraphNodes = graphNodeIds.length > 0;

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-border-subtle bg-surface max-lg:h-auto max-lg:w-full max-lg:border-l-0 max-lg:border-t">
      <header className="border-b border-border-subtle px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Evidence</p>
        <h2 className="mt-1 text-base font-semibold text-text-primary">Wiki and Graph Links</h2>
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
              {hasGraphNodes ? "Open full graph for this page" : "No graph nodes available"}
            </button>
            <section className="uc-panel-muted p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Graph Nodes</h3>
              <div className="mt-3 space-y-2">
                {hasGraphNodes ? (
                  graphNodeIds.map((nodeId) => (
                    <div key={nodeId} className="uc-code-ref rounded border border-border-subtle bg-surface px-2 py-2">
                      {nodeId}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-muted">This page does not have graph node metadata yet.</p>
                )}
              </div>
            </section>
            <section className="uc-panel-muted p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Source Evidence</h3>
              <div className="mt-3 space-y-2">
                {evidence.length === 0 ? (
                  <p className="text-sm text-text-muted">This page does not have source evidence metadata yet.</p>
                ) : (
                  evidence.map((item) => (
                    <div key={item.id} className="uc-panel px-2 py-2">
                      <div className="text-sm font-medium text-text-primary">{item.label}</div>
                      <div className="uc-code-ref mt-1">
                        {[item.filePath, item.lineRange ? `L${item.lineRange[0]}-${item.lineRange[1]}` : null].filter(Boolean).join(" ")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        ) : (
          <p className="uc-panel-muted p-3 text-sm text-text-muted">
            Select a wiki page to inspect its graph links and source evidence.
          </p>
        )}
      </div>
    </aside>
  );
}
