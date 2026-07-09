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
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function GraphDetailsRail({ view }: GraphDetailsRailProps) {
  const openWikiForGraphNode = useDashboardStore((state) => state.openWikiForGraphNode);
  const node = view.selectedNode;
  const semanticNode = view.selectedSemanticNode;
  const lineRange = formatLineRange(node?.lineRange);
  const evidence = semanticNode?.docs.evidence ?? [];
  const gaps = view.selectedCoverage?.gaps ?? semanticNode?.docs.gaps ?? [];

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-border-subtle bg-surface max-xl:h-[340px] max-xl:w-full max-xl:border-l-0 max-xl:border-t">
      <header className="border-b border-border-subtle px-4 py-4">
        <p className="text-[11px] font-semibold uppercase text-text-muted">Graph Details</p>
        <h2 className="mt-1 truncate text-base font-semibold text-text-primary">{node?.name ?? "Select a node"}</h2>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-4">
        {!node ? (
          <p className="rounded-md border border-border-subtle bg-elevated/35 p-3 text-sm leading-6 text-text-muted">
            Select a graph node to inspect wiki coverage, related pages, evidence, and gaps.
          </p>
        ) : (
          <>
            <section className="rounded-md border border-border-subtle bg-elevated/30 p-3">
              <h3 className="text-[10px] font-semibold uppercase text-text-muted">Node</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{node.summary || "No summary available."}</p>
              <dl className="mt-3 grid gap-2 text-xs">
                <div>
                  <dt className="text-text-muted">Type</dt>
                  <dd className="mt-0.5 text-text-primary">{node.type}</dd>
                </div>
                {semanticNode && (
                  <div>
                    <dt className="text-text-muted">Group</dt>
                    <dd className="mt-0.5 text-text-primary">{semanticNode.group}</dd>
                  </div>
                )}
                {node.filePath && (
                  <div>
                    <dt className="text-text-muted">Path</dt>
                    <dd className="mt-0.5 break-all font-mono text-[11px] text-text-primary">{node.filePath}</dd>
                  </div>
                )}
                {lineRange && (
                  <div>
                    <dt className="text-text-muted">Lines</dt>
                    <dd className="mt-0.5 font-mono text-[11px] text-text-primary">{lineRange}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-text-muted">ID</dt>
                  <dd className="mt-0.5 break-all font-mono text-[11px] text-text-primary">{node.id}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-md border border-border-subtle bg-elevated/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[10px] font-semibold uppercase text-text-muted">Wiki Coverage</h3>
                <span className="rounded border border-border-subtle px-2 py-1 text-[11px] font-medium text-text-secondary">
                  {formatCoverage(view.selectedCoverage?.status)}
                </span>
              </div>
              {view.canOpenWiki && (
                <button
                  type="button"
                  onClick={() => openWikiForGraphNode(node.id)}
                  className="mt-3 w-full rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/15"
                >
                  Open linked wiki
                </button>
              )}
              <div className="mt-3 space-y-2">
                {view.selectedPages.length === 0 ? (
                  <p className="text-sm text-text-muted">No linked wiki pages.</p>
                ) : (
                  view.selectedPages.map((page) => (
                    <div key={page.id} className="border-t border-border-subtle pt-2 first:border-t-0 first:pt-0">
                      <p className="text-sm font-medium text-text-primary">{page.title}</p>
                      <p className="mt-1 text-xs leading-5 text-text-muted">{page.summary}</p>
                      <p className="mt-1 break-all font-mono text-[11px] text-text-muted">{page.markdownPath}</p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-md border border-border-subtle bg-elevated/30 p-3">
              <h3 className="text-[10px] font-semibold uppercase text-text-muted">Evidence</h3>
              {evidence.length === 0 ? (
                <p className="mt-2 text-sm text-text-muted">No evidence records linked.</p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {evidence.map((item) => (
                    <li key={item.id}>
                      <p className="text-sm font-medium text-text-primary">{item.label}</p>
                      {item.filePath && (
                        <p className="mt-1 break-all font-mono text-[11px] text-text-muted">
                          {item.filePath}
                          {item.lineRange ? `:${item.lineRange[0]}-${item.lineRange[1]}` : ""}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-md border border-border-subtle bg-elevated/30 p-3">
              <h3 className="text-[10px] font-semibold uppercase text-text-muted">Gaps</h3>
              {gaps.length === 0 ? (
                <p className="mt-2 text-sm text-text-muted">No known documentation gaps.</p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {gaps.map((gap) => (
                    <li key={gap.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-text-primary">{gap.severity}</p>
                        <span className="rounded border border-border-subtle px-2 py-0.5 text-[11px] text-text-muted">
                          {gap.id}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-text-muted">{gap.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
