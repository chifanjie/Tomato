import {
  shardsForEvidence,
  type ExcerptStoreDescriptor,
} from "@understand-code/core/knowledge-base";

import { dashboardFetchInit } from "../workbench/transport";
import { optionalDataUrl } from "../workbench/knowledgeContextLoader";

/**
 * Fetches source excerpts, which are published in shards next to the wiki index
 * rather than inside it. Only the shards holding the evidence of the page being
 * read are fetched, so opening a page costs the same on a large repository as
 * on a small one.
 *
 * Shards are immutable for a given knowledge-base generation, so a shard is
 * fetched at most once per session and shared by every page that needs it.
 */
export interface ExcerptLoader {
  /** Resolves excerpts for these evidence ids, fetching missing shards. */
  load(evidenceIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
  /** Excerpts already in memory; lets a render show what it has immediately. */
  cached(evidenceIds: readonly string[]): ReadonlyMap<string, string>;
}

function shardUrl(descriptor: ExcerptStoreDescriptor, shardIndex: number, token: string | null): string {
  const name = `${String(shardIndex).padStart(4, "0")}.json`;
  return optionalDataUrl(`knowledge-base/${descriptor.pathPrefix}/${name}`, token);
}

export function createExcerptLoader(
  descriptor: ExcerptStoreDescriptor | undefined,
  accessToken: string | null,
  fetcher: typeof fetch = fetch,
): ExcerptLoader {
  const excerpts = new Map<string, string>();
  const inFlight = new Map<number, Promise<void>>();

  function collect(evidenceIds: readonly string[]): ReadonlyMap<string, string> {
    const found = new Map<string, string>();
    for (const id of evidenceIds) {
      const excerpt = excerpts.get(id);
      if (excerpt !== undefined) found.set(id, excerpt);
    }
    return found;
  }

  async function fetchShard(shardIndex: number): Promise<void> {
    if (descriptor === undefined) return;
    try {
      const response = await fetcher(
        shardUrl(descriptor, shardIndex, accessToken),
        dashboardFetchInit(accessToken),
      );
      if (!response.ok) return;
      const shard: unknown = await response.json();
      if (typeof shard !== "object" || shard === null) return;
      for (const [id, excerpt] of Object.entries(shard as Record<string, unknown>)) {
        if (typeof excerpt === "string") excerpts.set(id, excerpt);
      }
    } catch {
      // Excerpts are supporting detail; a failed shard must not break the rail.
    }
  }

  return {
    cached: collect,
    async load(evidenceIds) {
      if (descriptor === undefined || evidenceIds.length === 0) return collect(evidenceIds);

      const pending = shardsForEvidence(evidenceIds, descriptor)
        .filter((shardIndex) => {
          // Skip shards already resolved for every id we still need.
          return !inFlight.has(shardIndex) || inFlight.get(shardIndex) !== undefined;
        })
        .map((shardIndex) => {
          const existing = inFlight.get(shardIndex);
          if (existing !== undefined) return existing;
          const request = fetchShard(shardIndex);
          inFlight.set(shardIndex, request);
          return request;
        });

      await Promise.all(pending);
      return collect(evidenceIds);
    },
  };
}
