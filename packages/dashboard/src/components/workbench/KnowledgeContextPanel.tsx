import type { KnowledgeContext, KnowledgeMatchKind, KnowledgeSourceAnchor } from "../../workbench/knowledgeContext";

interface KnowledgeContextPanelProps {
  context: KnowledgeContext;
}

function matchLabel(matchKind: KnowledgeMatchKind): string {
  if (matchKind === "direct-trace") return "Direct trace";
  if (matchKind === "filename-path") return "Path match";
  if (matchKind === "related-document") return "Related doc";
  return "Graph only";
}

function lineRangeLabel(anchor: KnowledgeSourceAnchor): string | null {
  return anchor.lineRange ? `L${anchor.lineRange[0]}-${anchor.lineRange[1]}` : null;
}

function anchorKey(anchor: KnowledgeSourceAnchor): string {
  return [anchor.label, anchor.filePath, anchor.lineRange?.join("-"), anchor.url].filter(Boolean).join(":");
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border-subtle bg-elevated/35 p-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-text-secondary">{children}</div>
    </section>
  );
}

export default function KnowledgeContextPanel({ context }: KnowledgeContextPanelProps) {
  const hasEvidence = context.documents.length > 0 || context.evidence.length > 0;

  return (
    <aside
      aria-label="Knowledge context"
      className="flex h-full w-[320px] shrink-0 flex-col border-l border-border-subtle bg-surface xl:w-[340px]"
    >
      <header className="shrink-0 border-b border-border-subtle px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-base text-text-primary">Context</h2>
          <span className="shrink-0 rounded border border-accent/35 bg-accent/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
            {matchLabel(context.matchKind)}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-text-muted" title={context.title}>
          {context.title}
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-auto px-4 py-4">
        <PanelSection title="Engineer handoff">
          <p className="break-words">{context.summary}</p>
        </PanelSection>

        <PanelSection title="Business meaning">
          <p className="break-words">{context.businessMeaning}</p>
        </PanelSection>

        <PanelSection title="Change risk">
          <p className="break-words">{context.changeRisk}</p>
        </PanelSection>

        <PanelSection title="Evidence links">
          {!hasEvidence ? (
            <p className="text-text-muted">
              No generated knowledge document is linked yet. Showing graph-derived context.
            </p>
          ) : (
            <div className="space-y-3">
              {context.documents.map((document) => (
                <div key={document.id} className="rounded-md border border-border-subtle bg-elevated/55 p-3">
                  <div className="truncate text-xs font-semibold text-text-primary" title={document.title}>
                    {document.title}
                  </div>
                  {document.filePath && (
                    <div className="mt-1 truncate font-mono text-[10px] text-text-muted" title={document.filePath}>
                      {document.filePath}
                    </div>
                  )}
                  {!document.filePath && document.relatedPaths && document.relatedPaths.length > 0 && (
                    <div className="mt-1 truncate font-mono text-[10px] text-text-muted" title={document.relatedPaths.join(", ")}>
                      {document.relatedPaths.join(", ")}
                    </div>
                  )}
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-text-secondary">
                    {document.summary}
                  </p>
                </div>
              ))}

              {context.evidence.map((anchor, index) => {
                const lineRange = lineRangeLabel(anchor);
                const body = (
                  <>
                    <span className="block truncate text-xs font-medium text-text-primary" title={anchor.label}>
                      {anchor.label}
                    </span>
                    {(anchor.filePath || lineRange) && (
                      <span className="mt-1 block truncate font-mono text-[10px] text-text-muted" title={[anchor.filePath, lineRange].filter(Boolean).join(" ")}>
                        {[anchor.filePath, lineRange].filter(Boolean).join(" ")}
                      </span>
                    )}
                  </>
                );

                return anchor.url ? (
                  <a
                    key={anchorKey(anchor) || `anchor:${index}`}
                    href={anchor.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-md border border-border-subtle bg-surface/70 p-3 transition-colors hover:border-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55"
                  >
                    {body}
                  </a>
                ) : (
                  <div key={anchorKey(anchor) || `anchor:${index}`} className="rounded-md border border-border-subtle bg-surface/70 p-3">
                    {body}
                  </div>
                );
              })}
            </div>
          )}
        </PanelSection>
      </div>
    </aside>
  );
}
