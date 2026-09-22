import { parseSearchArtifact } from "./searchArtifactPayload";
import { buildWikiSearchRuntimeForPages, searchWiki, type WikiSearchRuntime } from "./searchIndex";
import type { SearchWorkerRequest, SearchWorkerResponse } from "./searchWorkerProtocol";

/** Runs entirely off the UI thread, including decoding, validation and ranking. */
export function createSearchWorkerEngine() {
  let runtime: WikiSearchRuntime | undefined;
  let generation: number | undefined;
  return (message: SearchWorkerRequest): SearchWorkerResponse => {
    const identity = { generation: message.generation, requestId: message.requestId };
    try {
      if (message.kind === "initialize") {
        runtime = undefined;
        generation = message.generation;
        const loaded = parseSearchArtifact(JSON.parse(new TextDecoder().decode(message.bytes)));
        if (loaded.status !== "ready") return { ...identity, kind: "initialized", status: "invalid" };
        runtime = buildWikiSearchRuntimeForPages(loaded.records, new Set(message.pageIds), loaded.contentLines);
        return { ...identity, kind: "initialized", status: "ready" };
      }
      if (!runtime || message.generation !== generation) return { ...identity, kind: "error" };
      const results = searchWiki(runtime, message.query, message.page, message.pageSize);
      // Bodies and search terms can both be very large. The dialog only needs
      // display/navigation metadata; keep scoring inputs in the worker heap.
      results.groups = results.groups.map((group) => ({ ...group, items: group.items.map((record) => {
        const metadata = { ...record, terms: [], businessTerms: [] };
        delete metadata.content;
        delete metadata.contentLineIds;
        return metadata;
      }) }));
      return { ...identity, kind: "results", results };
    } catch {
      return message.kind === "initialize" ? { ...identity, kind: "initialized", status: "invalid" } : { ...identity, kind: "error" };
    }
  };
}
