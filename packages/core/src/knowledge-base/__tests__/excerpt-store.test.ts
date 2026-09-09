import { describe, expect, it } from "vitest";

import {
  buildExcerptShards,
  shardCountFor,
  shardIndexFor,
  shardFileName,
  shardsForEvidence,
  capExcerpt,
} from "../excerpt-store.js";

function evidence(count: number, excerptBytes: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `evidence:node-${index}:file-${index}:1-9`,
    excerpt: "x".repeat(excerptBytes),
  }));
}

describe("shardCountFor", () => {
  it("keeps a small knowledge base in one shard", () => {
    expect(shardCountFor(1024)).toBe(1);
  });

  it("grows the shard count with total excerpt volume", () => {
    // 8.4 MB of excerpts — this repository's own knowledge base.
    expect(shardCountFor(8.4 * 1024 * 1024)).toBeGreaterThan(16);
  });

  it("caps the shard count so a huge repository cannot explode the file count", () => {
    expect(shardCountFor(100 * 1024 * 1024 * 1024)).toBeLessThanOrEqual(4096);
  });
});

describe("shardIndexFor", () => {
  it("is stable across calls so reader and generator agree", () => {
    const first = shardIndexFor("evidence:a:b:1-2", 64);
    expect(shardIndexFor("evidence:a:b:1-2", 64)).toBe(first);
  });

  it("always returns shard 0 for a single-shard store", () => {
    expect(shardIndexFor("anything", 1)).toBe(0);
  });

  it("stays inside the shard range", () => {
    for (let index = 0; index < 200; index += 1) {
      const shard = shardIndexFor(`evidence:${index}`, 32);
      expect(shard).toBeGreaterThanOrEqual(0);
      expect(shard).toBeLessThan(32);
    }
  });
});

describe("buildExcerptShards", () => {
  it("places every excerpt in exactly one shard", () => {
    const items = evidence(500, 2048);
    const { descriptor, shards } = buildExcerptShards(items);

    const placed = shards.flatMap((shard) => Object.keys(shard));
    expect(placed).toHaveLength(items.length);
    expect(new Set(placed).size).toBe(items.length);
    expect(shards).toHaveLength(descriptor.shardCount);
  });

  it("spreads a large store across many shards", () => {
    const { descriptor } = buildExcerptShards(evidence(2000, 4096));

    expect(descriptor.shardCount).toBeGreaterThan(8);
  });

  it("omits evidence that carries no excerpt", () => {
    const { shards } = buildExcerptShards([
      { id: "evidence:with", excerpt: "code" },
      { id: "evidence:without" },
    ]);

    const placed = shards.flatMap((shard) => Object.keys(shard));
    expect(placed).toEqual(["evidence:with"]);
  });

  it("round-trips an excerpt through the shard the reader would fetch", () => {
    const items = evidence(300, 1024);
    const { descriptor, shards } = buildExcerptShards(items);
    const target = items[42];

    const [shardIndex] = shardsForEvidence([target.id], descriptor);

    expect(shards[shardIndex][target.id]).toBe(target.excerpt);
  });
});

describe("shardsForEvidence", () => {
  it("returns one bounded, deduplicated, sorted set for a page", () => {
    const { descriptor } = buildExcerptShards(evidence(1000, 4096));
    const ids = evidence(6, 1).map((item) => item.id);

    const shards = shardsForEvidence([...ids, ...ids], descriptor);

    expect(shards.length).toBeLessThanOrEqual(6);
    expect([...shards].sort((a, b) => a - b)).toEqual(shards);
  });

  it("asks for nothing when a page has no evidence", () => {
    const { descriptor } = buildExcerptShards(evidence(10, 10));

    expect(shardsForEvidence([], descriptor)).toEqual([]);
  });
});

describe("shardFileName", () => {
  it("zero-pads so shards sort naturally", () => {
    expect(shardFileName(7)).toBe("0007.json");
    expect([shardFileName(10), shardFileName(2)].sort()).toEqual(["0002.json", "0010.json"]);
  });
});

describe("capExcerpt", () => {
  it("leaves a normal excerpt untouched", () => {
    const excerpt = "const a = 1;\nconst b = 2;\n";
    expect(capExcerpt(excerpt)).toBe(excerpt);
  });

  it("caps an oversized excerpt and says so", () => {
    const capped = capExcerpt("x".repeat(200_000));

    expect(capped.length).toBeLessThan(20_000);
    expect(capped).toContain("已截断");
  });

  it("cuts on a line boundary when one is near the limit", () => {
    const excerpt = `${"a".repeat(90)}\n`.repeat(20);
    const capped = capExcerpt(excerpt, 1000);

    // The body before the notice must not end mid-line.
    const body = capped.split("\n\n… ")[0];
    expect(body.endsWith("a")).toBe(true);
    expect(body.split("\n").at(-1)).toBe("a".repeat(90));
  });

  it("bounds the largest excerpt a shard can hold", () => {
    const { shards } = buildExcerptShards([
      { id: "evidence:huge", excerpt: "y".repeat(300_000) },
    ]);

    expect(Object.values(shards[0])[0].length).toBeLessThan(20_000);
  });
});
