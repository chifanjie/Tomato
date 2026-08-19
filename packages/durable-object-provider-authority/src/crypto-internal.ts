import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { canonicalAuthorityBytesInternalV1 } from "./filesystem-internal.js";

export type HmacSha256TokenInternalV1 = `hmac-sha256:${string}`;
export type Sha256ContentDigestInternalV1 = `sha256:${string}`;

export function sha256DigestInternalV1(
  bytes: Uint8Array,
): Sha256ContentDigestInternalV1 {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function digestDomainInternalV1(
  domain: string,
  value: unknown,
): Sha256ContentDigestInternalV1 {
  return sha256DigestInternalV1(
    canonicalAuthorityBytesInternalV1([domain, value]),
  );
}

export function hmacTokenForMessageInternalV1(
  key: Uint8Array,
  message: Uint8Array,
): HmacSha256TokenInternalV1 {
  return `hmac-sha256:${createHmac("sha256", key).update(message).digest("hex")}`;
}

export function hmacTokenForDomainInternalV1(
  key: Uint8Array,
  domain: string,
  value: unknown,
): HmacSha256TokenInternalV1 {
  return hmacTokenForMessageInternalV1(
    key,
    canonicalAuthorityBytesInternalV1([domain, value]),
  );
}

export function verifyHmacTokenForMessageInternalV1(
  key: Uint8Array,
  message: Uint8Array,
  token: unknown,
): boolean {
  if (
    typeof token !== "string" ||
    !/^hmac-sha256:[0-9a-f]{64}$/u.test(token)
  ) return false;
  const expected = Buffer.from(
    hmacTokenForMessageInternalV1(key, message).slice("hmac-sha256:".length),
    "hex",
  );
  const actual = Buffer.from(token.slice("hmac-sha256:".length), "hex");
  return actual.byteLength === expected.byteLength &&
    timingSafeEqual(actual, expected);
}

export function verifyHmacTokenForDomainInternalV1(
  key: Uint8Array,
  domain: string,
  value: unknown,
  token: unknown,
): boolean {
  return verifyHmacTokenForMessageInternalV1(
    key,
    canonicalAuthorityBytesInternalV1([domain, value]),
    token,
  );
}
