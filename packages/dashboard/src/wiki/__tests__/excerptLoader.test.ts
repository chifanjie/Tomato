import { describe, expect, it, vi } from "vitest";

import { buildExcerptShards } from "@understand-code/core/knowledge-base";

import { createExcerptLoader } from "../excerptLoader";

function store(count: number) {
  const evidence = Array.from({ length: count }, (_, index) => ({
    id: `evidence:node-${index}:file-${index}:1-9`,
    excerpt: `source of ${index}\n`.repeat(400),
  }));
  return { evidence, ...buildExcerptShards(evidence) };
}

/** A fetcher serving the shard files, counting requests per shard. */
function shardFetcher(shards: Record<string, string>[]) {
  const requested: string[] = [];
  const fetcher = vi.fn(async (url: string) => {
    requested.push(url);
    const match = /(\d{4})\.json/.exec(url);
    if (match === null) return new Response(null, { status: 404 });
    const shard = shards[Number(match[1])];
    return shard === undefined
      ? new Response(null, { status: 404 })
      : new Response(JSON.stringify(shard), { status: 200 });
  });
  return { fetcher: fetcher as unknown as typeof fetch, requested };
}

describe("createExcerptLoader", () => {
  it("fetches only the shards holding the requested evidence", async () => {
    const { evidence, descriptor, shards } = store(400);
    const { fetcher, requested } = shardFetcher(shards);
    const loader = createExcerptLoader(descriptor, "token", fetcher);

    const wanted = [evidence[3].id, evidence[7].id];
    const resolved = await loader.load(wanted);

    expect(resolved.get(evidence[3].id)).toBe(evidence[3].excerpt);
    expect(resolved.get(evidence[7].id)).toBe(evidence[7].excerpt);
    // A page must never pull the whole store.
    expect(requested.length).toBeLessThanOrEqual(2);
    expect(requested.length).toBeLessThan(descriptor.shardCount);
  });

  it("fetches each shard at most once across pages", async () => {
    const { evidence, descriptor, shards } = store(400);
    const { fetcher, requested } = shardFetcher(shards);
    const loader = createExcerptLoader(descriptor, "token", fetcher);

    await loader.load([evidence[5].id]);
    const afterFirst = requested.length;
    await loader.load([evidence[5].id]);

    expect(requested.length).toBe(afterFirst);
  });

  it("serves an already-fetched excerpt synchronously", async () => {
    const { evidence, descriptor, shards } = store(200);
    const { fetcher } = shardFetcher(shards);
    const loader = createExcerptLoader(descriptor, "token", fetcher);

    expect(loader.cached([evidence[2].id]).size).toBe(0);
    await loader.load([evidence[2].id]);

    expect(loader.cached([evidence[2].id]).get(evidence[2].id)).toBe(evidence[2].excerpt);
  });

  it("resolves to nothing when the knowledge base has no excerpt store", async () => {
    const loader = createExcerptLoader(undefined, "token", vi.fn() as unknown as typeof fetch);

    await expect(loader.load(["evidence:anything"])).resolves.toEqual(new Map());
  });

  it("survives a missing or failing shard without throwing", async () => {
    const { evidence, descriptor } = store(50);
    const failing = vi.fn(async () => new Response(null, { status: 500 }));
    const loader = createExcerptLoader(descriptor, "token", failing as unknown as typeof fetch);

    await expect(loader.load([evidence[0].id])).resolves.toEqual(new Map());
  });

  it("survives malformed shard JSON", async () => {
    const { evidence, descriptor } = store(50);
    const broken = vi.fn(async () => new Response("not json", { status: 200 }));
    const loader = createExcerptLoader(descriptor, "token", broken as unknown as typeof fetch);

    await expect(loader.load([evidence[0].id])).resolves.toEqual(new Map());
  });

  it("asks for nothing when the page has no evidence", async () => {
    const { descriptor, shards } = store(20);
    const { fetcher, requested } = shardFetcher(shards);
    const loader = createExcerptLoader(descriptor, "token", fetcher);

    await loader.load([]);

    expect(requested).toEqual([]);
  });
});
