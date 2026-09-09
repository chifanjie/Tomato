/**
 * Source excerpts dominate `wiki-index.json`: on a 325-file repository they are
 * 8.4 MB of an 11.7 MB index, and they grow with total source size rather than
 * with the navigation model. Loading them at first paint makes the wiki
 * unusable on a large repository.
 *
 * They are therefore published outside the index, in content-addressed shards.
 * The reader fetches only the shards holding the evidence of the page it is
 * showing, so a page view costs a bounded amount regardless of repository size.
 *
 * Generator and reader must agree on shard assignment without consulting a
 * manifest, so it is a pure function of the evidence id.
 */

/** Descriptor embedded in `wiki-index.json` when excerpts live outside it. */
export interface ExcerptStoreDescriptor {
  readonly mode: "external";
  /** Number of shards; assignment is `hash(evidenceId) % shardCount`. */
  readonly shardCount: number;
  /** Directory holding the shards, relative to the knowledge-base root. */
  readonly pathPrefix: string;
}

/** One shard file: evidence id to source excerpt. */
export type ExcerptShard = Record<string, string>;

export const EXCERPT_STORE_PREFIX = "evidence-excerpts";

/** Bytes per shard we aim for — small enough to fetch on a page view. */
const TARGET_SHARD_BYTES = 256 * 1024;
const MAX_SHARDS = 4096;

/**
 * Largest excerpt we publish. File-level evidence embeds a whole file, so a
 * handful of large files dominate the store: in this repository 13 excerpts
 * over 64 KB accounted for 1.5 MB, the largest being a 266 KB binary cache.
 * An evidence rail renders a `<pre>` — nobody reads 266 KB there, and the full
 * file is always one click away, so a bounded, marked excerpt is strictly more
 * useful than an unbounded one.
 */
const MAX_EXCERPT_BYTES = 16 * 1024;

const TRUNCATION_NOTICE = "\n\n… 摘录过长已截断，请打开源文件查看完整内容。";

/** Caps one excerpt, marking it so the reader knows content was withheld. */
export function capExcerpt(excerpt: string, limit: number = MAX_EXCERPT_BYTES): string {
  if (excerpt.length <= limit) return excerpt;
  // Cut on a line boundary when one is close, so the excerpt stays readable.
  const head = excerpt.slice(0, limit);
  const lastNewline = head.lastIndexOf("\n");
  const body = lastNewline > limit - 200 ? head.slice(0, lastNewline) : head;
  return `${body}${TRUNCATION_NOTICE}`;
}

/**
 * FNV-1a. Chosen because it is short enough to reimplement identically in the
 * reader and is stable across runs, unlike any hash seeded per process.
 */
export function shardHash(evidenceId: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < evidenceId.length; index += 1) {
    hash ^= evidenceId.charCodeAt(index);
    // Multiply by the FNV prime (16777619) using shifts to stay in 32 bits.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

export function shardIndexFor(evidenceId: string, shardCount: number): number {
  if (shardCount <= 1) return 0;
  return shardHash(evidenceId) % shardCount;
}

/** Zero-padded so shard files sort naturally on disk. */
export function shardFileName(shardIndex: number): string {
  return `${String(shardIndex).padStart(4, "0")}.json`;
}

export function shardPath(descriptor: ExcerptStoreDescriptor, shardIndex: number): string {
  return `${descriptor.pathPrefix}/${shardFileName(shardIndex)}`;
}

/** Picks a shard count that keeps shards near the target size. */
export function shardCountFor(totalExcerptBytes: number): number {
  if (totalExcerptBytes <= TARGET_SHARD_BYTES) return 1;
  const count = Math.ceil(totalExcerptBytes / TARGET_SHARD_BYTES);
  return Math.min(MAX_SHARDS, count);
}

/**
 * Splits evidence excerpts into shards.
 *
 * Returns the descriptor to embed in the index and the shard contents to write.
 * Evidence with no excerpt is simply absent from every shard.
 */
export function buildExcerptShards(
  evidence: readonly { readonly id: string; readonly excerpt?: string }[],
): { descriptor: ExcerptStoreDescriptor; shards: ExcerptShard[] } {
  const capped = new Map<string, string>();
  let totalBytes = 0;
  for (const item of evidence) {
    if (item.excerpt === undefined) continue;
    const text = capExcerpt(item.excerpt);
    capped.set(item.id, text);
    totalBytes += text.length + item.id.length;
  }

  const shardCount = shardCountFor(totalBytes);
  const shards: ExcerptShard[] = Array.from({ length: shardCount }, () => ({}));
  for (const [id, text] of capped) {
    shards[shardIndexFor(id, shardCount)][id] = text;
  }

  return {
    descriptor: { mode: "external", shardCount, pathPrefix: EXCERPT_STORE_PREFIX },
    shards,
  };
}

/** Which shards must be fetched to render the given evidence ids. */
export function shardsForEvidence(
  evidenceIds: readonly string[],
  descriptor: ExcerptStoreDescriptor,
): number[] {
  const needed = new Set<number>();
  for (const id of evidenceIds) needed.add(shardIndexFor(id, descriptor.shardCount));
  return [...needed].sort((left, right) => left - right);
}
