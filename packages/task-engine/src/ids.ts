import { createHash } from "node:crypto";

import {
  canonicalizeJson,
  type ContentDigest,
} from "@understand-code/contracts";

const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function sha256CanonicalJson(value: unknown): ContentDigest {
  return `sha256:${createHash("sha256")
    .update(canonicalizeJson(value), "utf8")
    .digest("hex")}`;
}

export function stableId(prefix: string, value: unknown): string {
  return `${prefix}:${sha256CanonicalJson(value).slice("sha256:".length, 29)}`;
}

/**
 * Deterministically maps a create-scope idempotency key to one canonical ULID.
 *
 * The 128 data bits come from SHA-256. A chronological creation timestamp is
 * stored separately in the Task Manifest; Task identity must remain stable
 * after a lost reply or a competing Agent retry.
 */
export function deterministicTaskId(value: unknown): string {
  const digest = createHash("sha256")
    .update(canonicalizeJson(value), "utf8")
    .digest("hex")
    .slice(0, 32);
  let remaining = BigInt(`0x${digest}`);
  let encoded = "";
  for (let index = 0; index < 26; index += 1) {
    const digit = Number(remaining & 31n);
    encoded = CROCKFORD_BASE32[digit]! + encoded;
    remaining >>= 5n;
  }
  return encoded;
}

export function nextDeterministicTimestamp(previous: string): string {
  return new Date(Date.parse(previous) + 1).toISOString();
}
