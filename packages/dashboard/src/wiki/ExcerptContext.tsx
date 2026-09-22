import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useDashboardStore } from "../store";
import { KnowledgeFetchContext } from "../workbench/publishedKnowledge";
import { createExcerptLoader, type ExcerptLoader } from "./excerptLoader";

const ExcerptLoaderContext = createContext<ExcerptLoader | null>(null);

export function ExcerptLoaderProvider({
  accessToken,
  children,
}: {
  readonly accessToken: string | null;
  readonly children: ReactNode;
}) {
  const fetcher = useContext(KnowledgeFetchContext) ?? fetch;
  const descriptor = useDashboardStore((state) => state.wikiIndex.payload?.excerptStore);
  // One loader per knowledge-base generation: shards are immutable within it,
  // so the cache stays valid until the index itself is replaced.
  const loader = useMemo(
    () => createExcerptLoader(descriptor, accessToken, fetcher),
    [descriptor, accessToken, fetcher],
  );
  return <ExcerptLoaderContext.Provider value={loader}>{children}</ExcerptLoaderContext.Provider>;
}

/**
 * Resolves source excerpts for the evidence currently on screen.
 *
 * Excerpts live in shards outside the wiki index, so a rail renders its
 * structure first and fills in code as the shards it needs arrive.
 */
export function useEvidenceExcerpts(
  evidenceIds: readonly string[],
): { excerpts: ReadonlyMap<string, string>; loading: boolean; error: string | null; retry: () => void } {
  const loader = useContext(ExcerptLoaderContext);
  // A stable key so the effect does not re-run on every parent render.
  const key = evidenceIds.join(" ");
  const [excerpts, setExcerpts] = useState<ReadonlyMap<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setError(null);
    setLoading(false);
    if (loader === null || evidenceIds.length === 0) {
      setExcerpts(new Map());
      return;
    }
    const ready = loader.cached(evidenceIds);
    setExcerpts(ready);
    if (ready.size === evidenceIds.length) return;

    let cancelled = false;
    setLoading(true);
    void loader.load(evidenceIds).then((resolved) => {
      if (cancelled) return;
      setExcerpts(resolved);
      setError(loader.failure(evidenceIds));
      setLoading(false);
    });
    return () => {
      cancelled = true;
      setLoading(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loader, key, revision]);

  return { excerpts, loading, error, retry: () => setRevision((value) => value + 1) };
}
