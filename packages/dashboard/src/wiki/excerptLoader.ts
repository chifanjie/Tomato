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
  failure(evidenceIds: readonly string[]): string | null;
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
  const loadedShards = new Set<number>();
  const failures = new Map<number, string>();

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
    failures.delete(shardIndex);
    try {
      const response = await fetcher(
        shardUrl(descriptor, shardIndex, accessToken),
        dashboardFetchInit(accessToken),
      );
      if (!response.ok) {
        failures.set(shardIndex, response.status === 401 || response.status === 403
          ? "证据访问已失效，请从宿主重新打开工作台。"
          : response.status === 404 ? "当前知识版本缺少证据分片，可重试或请宿主重新生成。" : "证据读取失败，请重试。");
        return;
      }
      const shard: unknown = await response.json();
      if (typeof shard !== "object" || shard === null || Array.isArray(shard)) throw new Error("Invalid excerpt shard");
      for (const [id, excerpt] of Object.entries(shard as Record<string, unknown>)) {
        if (typeof excerpt === "string") excerpts.set(id, excerpt);
      }
      loadedShards.add(shardIndex);
    } catch {
      failures.set(shardIndex, "证据读取失败，请检查连接后重试。");
    }
  }

  return {
    cached: collect,
    failure(evidenceIds) {
      if (!descriptor) return null;
      for (const shard of shardsForEvidence(evidenceIds, descriptor)) {
        const message = failures.get(shard);
        if (message) return message;
      }
      return null;
    },
    async load(evidenceIds) {
      if (descriptor === undefined || evidenceIds.length === 0) return collect(evidenceIds);

      const pending = shardsForEvidence(evidenceIds, descriptor)
        .filter((shardIndex) => !loadedShards.has(shardIndex))
        .map((shardIndex) => {
          const existing = inFlight.get(shardIndex);
          if (existing !== undefined) return existing;
          const request = fetchShard(shardIndex).finally(() => inFlight.delete(shardIndex));
          inFlight.set(shardIndex, request);
          return request;
        });

      await Promise.all(pending);
      return collect(evidenceIds);
    },
  };
}
