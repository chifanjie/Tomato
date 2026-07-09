import type { WikiPageRecord } from "../../wiki/wikiIndex";

interface WikiPageViewProps {
  page: WikiPageRecord | null;
  emptyReason: string | null;
}

export default function WikiPageView({ page, emptyReason }: WikiPageViewProps) {
  if (!page) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center bg-root max-lg:min-h-[240px] max-lg:flex-none">
        <div className="max-w-md rounded-md border border-border-subtle bg-surface p-6 text-center">
          <h2 className="text-lg font-semibold text-text-primary">No wiki page selected</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            {emptyReason ?? "Generate a knowledge base or select a page from the wiki navigation."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-0 flex-1 overflow-auto bg-root max-lg:flex-none max-lg:overflow-visible">
      <article aria-label={page.title} className="mx-auto max-w-4xl px-10 py-10 max-lg:px-5 max-lg:py-6">
        <header className="border-b border-border-subtle pb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">{page.category}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-text-primary">{page.title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-text-secondary">{page.summary}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-medium text-text-muted">
            <span className="rounded border border-border-subtle px-2 py-1">{page.coverage} coverage</span>
            <span className="rounded border border-border-subtle px-2 py-1">{page.quality}</span>
            <span className="rounded border border-border-subtle px-2 py-1">{page.markdownPath}</span>
          </div>
        </header>

        <section className="py-8">
          <h2 className="text-lg font-semibold text-text-primary">Linked Repository Knowledge</h2>
          <p className="mt-3 text-sm leading-7 text-text-secondary">
            This page is generated from the repository graph and links back to the code entities listed below.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-border-subtle bg-surface p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Explains</h3>
              {page.explainedNodeIds.length === 0 ? (
                <p className="mt-3 text-sm text-text-muted">This page does not explain specific graph nodes yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {page.explainedNodeIds.map((nodeId) => (
                    <li key={nodeId} className="break-all font-mono text-xs text-text-secondary">{nodeId}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-md border border-border-subtle bg-surface p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Related Nodes</h3>
              {page.relatedNodeIds.length === 0 ? (
                <p className="mt-3 text-sm text-text-muted">This page does not list related graph nodes yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {page.relatedNodeIds.map((nodeId) => (
                    <li key={nodeId} className="break-all font-mono text-xs text-text-secondary">{nodeId}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}
