import type { WikiSearchRecordV2 } from "@understand-code/core/knowledge-base";
import { dashboardFetchInit, withDashboardAccess } from "../workbench/transport";
import { parseSearchArtifact } from "./searchArtifactPayload";
import { buildWikiSearchRuntime, type WikiSearchRuntime } from "./searchIndex";
import type { WikiRuntimeIndex } from "./wikiIndex";
import { createSearchWorkerClient, type SearchWorkerClient, type SearchWorkerFactory } from "./searchWorkerClient";

export type SearchLoadStatus = "idle" | "loading" | "ready" | "fallback";

export type SearchArtifactLoadResult =
  | { status: "ready"; records: WikiSearchRecordV2[]; contentLines?: readonly string[]; runtime?: WikiSearchRuntime }
  | { status: "missing" | "invalid" | "forbidden" | "error"; records: [] };

export interface SearchArtifactRequestSnapshot {
  token: string | null;
  result: SearchArtifactLoadResult | null;
}

export interface SearchArtifactRequestController {
  open(token: string, wikiIndex?: WikiRuntimeIndex): Promise<SearchArtifactLoadResult>;
  close(): void;
  reset(token?: string): void;
  isCurrent(token: string): boolean;
  snapshot(): SearchArtifactRequestSnapshot;
}

function searchUrl(token: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const path = `${normalizedBase}knowledge-base/search-index.json`;
  if (import.meta.env.VITE_DEMO_MODE === "true") return path;
  return withDashboardAccess(path, token);
}

export async function loadSearchArtifact(
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<SearchArtifactLoadResult> {
  try {
    const response = await fetcher(searchUrl(accessToken), dashboardFetchInit(accessToken));
    if (response.status === 404) return { status: "missing", records: [] };
    if (response.status === 401 || response.status === 403) return { status: "forbidden", records: [] };
    if (!response.ok) return { status: "error", records: [] };

    let value: unknown;
    try {
      value = await response.json();
    } catch {
      return { status: "invalid", records: [] };
    }
    return parseSearchArtifact(value);
  } catch {
    return { status: "error", records: [] };
  }
}

// Unsupported Workers may handle a small index inline; never move an unbounded
// legacy index back onto the main thread just because a Worker failed to start.
const MAX_INLINE_FALLBACK_BYTES = 256 * 1024;

export function createSearchArtifactRequestController(
  fetcher: typeof fetch = fetch,
  options: { workerFactory?: SearchWorkerFactory } = {},
): SearchArtifactRequestController {
  let activeToken: string | null = null;
  let activeIndex: WikiRuntimeIndex | undefined;
  let currentResult: SearchArtifactLoadResult | null = null;
  let request: Promise<SearchArtifactLoadResult> | null = null;
  let worker: SearchWorkerClient | null = null;
  let abort: AbortController | null = null;
  let revision = 0;

  function clear(token: string | null, index?: WikiRuntimeIndex) {
    revision += 1;
    abort?.abort(); abort = null;
    worker?.dispose(); worker = null;
    activeToken = token;
    activeIndex = index;
    currentResult = null;
    request = null;
  }

  async function loadRuntime(token: string, index: WikiRuntimeIndex): Promise<SearchArtifactLoadResult> {
    const ownWorker = createSearchWorkerClient(options.workerFactory);
    const ownAbort = new AbortController();
    worker = ownWorker;
    abort = ownAbort;
    try {
      const response = await fetcher(searchUrl(token), { ...dashboardFetchInit(token), signal: ownAbort.signal });
      if (response.status === 404) return { status: "missing", records: [] };
      if (response.status === 401 || response.status === 403) return { status: "forbidden", records: [] };
      if (!response.ok) return { status: "error", records: [] };
      if (!ownWorker && Number(response.headers.get("content-length")) > MAX_INLINE_FALLBACK_BYTES) {
        await response.body?.cancel();
        return { status: "error", records: [] };
      }
      const bytes = await response.arrayBuffer();
      if (ownAbort.signal.aborted) return { status: "error", records: [] };
      if (ownWorker) {
        const status = await ownWorker.initialize(bytes, [...index.pagesById.keys()]);
        if (status !== "ready") return { status: "invalid", records: [] };
        return { status: "ready", records: [], runtime: ownWorker.runtime };
      }
      if (bytes.byteLength > MAX_INLINE_FALLBACK_BYTES) return { status: "error", records: [] };
      const loaded = parseSearchArtifact(JSON.parse(new TextDecoder().decode(bytes)));
      return loaded.status !== "ready" ? loaded : { ...loaded,
        runtime: buildWikiSearchRuntime(loaded.records, index, "full", loaded.contentLines) };
    } catch {
      return { status: "error", records: [] };
    }
  }

  return {
    open(token, index) {
      if (activeToken !== token || activeIndex !== index) clear(token, index);
      if (!request) {
        const requestedRevision = revision;
        request = (index ? loadRuntime(token, index) : loadSearchArtifact(token, fetcher)).then((result) => {
          if (revision === requestedRevision) {
            currentResult = result.status === "ready" ? result : null;
            if (result.status !== "ready") {
              worker?.dispose(); worker = null;
              request = null;
            }
          }
          return result;
        });
      }
      return request;
    },
    close() {
      // Reopening one snapshot reuses its full index; reset/unmount ends its worker.
    },
    reset(token) { clear(token ?? null); },
    isCurrent(token) { return activeToken === token; },
    snapshot() { return { token: activeToken, result: currentResult }; },
  };
}
