import { createHash } from "node:crypto";

import {
  canonicalizeJson,
  type ContentDigest,
} from "@understand-code/contracts";

export function sha256Bytes(value: string | Uint8Array): ContentDigest {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function sha256CanonicalJson(value: unknown): ContentDigest {
  return sha256Bytes(canonicalizeJson(value));
}

export function digestCanonicalJson(canonicalJson: string): ContentDigest {
  return sha256Bytes(canonicalJson);
}
