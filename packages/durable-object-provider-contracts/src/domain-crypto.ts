import {
  canonicalizeJcsSafeIntegerUtf8V1,
} from "./jcs.js";
import {
  ContentDigestV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex22V1Schema,
} from "./primitives.js";

export type ProviderCryptoResultV1 = Uint8Array | Promise<Uint8Array>;

/** Host-injected so the production package remains browser/worker portable. */
export interface ProviderCryptoHostV1 {
  sha256(message: Uint8Array): ProviderCryptoResultV1;
  hmacSha256(
    key: Uint8Array,
    message: Uint8Array,
  ): ProviderCryptoResultV1;
}

export interface DerivedSemanticHashV1 {
  readonly canonicalPreimageUtf8: Uint8Array;
  readonly sha256Hex: string;
  readonly contentDigest: ReturnType<typeof ContentDigestV1Schema.parse>;
  readonly shortHex22: ReturnType<typeof LowerHex22V1Schema.parse>;
}

function bytesToLowerHex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function assertDigestBytes(bytes: Uint8Array, operation: string): Uint8Array {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 32) {
    throw new TypeError(`${operation} host result must be exactly 32 bytes`);
  }
  return bytes.slice();
}

function assertDomainLiteral(domain: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$/u.test(domain)) {
    throw new TypeError("domain literal must be an explicit lowercase versioned token");
  }
}

/** Internal foundation primitive. It is intentionally not re-exported by index.ts. */
export function createDomainPreimageBytesV1(
  domain: string,
  strictFields: object,
): Uint8Array {
  assertDomainLiteral(domain);
  return canonicalizeJcsSafeIntegerUtf8V1([domain, strictFields]);
}

/** Internal foundation primitive. It is intentionally not re-exported by index.ts. */
export async function deriveSemanticHashV1(
  cryptoHost: ProviderCryptoHostV1,
  domain: string,
  strictFields: object,
): Promise<DerivedSemanticHashV1> {
  const canonicalPreimageUtf8 = createDomainPreimageBytesV1(
    domain,
    strictFields,
  );
  const digestBytes = assertDigestBytes(
    await cryptoHost.sha256(canonicalPreimageUtf8.slice()),
    "SHA-256",
  );
  const sha256Hex = bytesToLowerHex(digestBytes);
  return Object.freeze({
    canonicalPreimageUtf8,
    sha256Hex,
    contentDigest: ContentDigestV1Schema.parse(`sha256:${sha256Hex}`),
    shortHex22: LowerHex22V1Schema.parse(sha256Hex.slice(0, 22)),
  });
}

/** Internal foundation primitive. It is intentionally not re-exported by index.ts. */
export async function deriveKeyedStateTokenForDomainV1(
  cryptoHost: ProviderCryptoHostV1,
  key: Uint8Array,
  domain: string,
  strictFields: object,
): Promise<ReturnType<typeof KeyedStateTokenV1Schema.parse>> {
  if (!(key instanceof Uint8Array) || key.byteLength !== 32) {
    throw new TypeError("HMAC-SHA-256 key must be exactly 32 bytes");
  }
  const message = createDomainPreimageBytesV1(domain, strictFields);
  const mac = assertDigestBytes(
    await cryptoHost.hmacSha256(key.slice(), message.slice()),
    "HMAC-SHA-256",
  );
  return KeyedStateTokenV1Schema.parse(`hmac-sha256:${bytesToLowerHex(mac)}`);
}

/**
 * Rejects accessor/prototype tricks before Zod reads a domain object without
 * recursively walking unknown values. The strict domain Schema then rejects
 * unknown keys before canonicalization sees only its parsed output.
 */
export function assertDataObjectDescriptorsBeforeSchemaV1(
  value: unknown,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("domain fields must be a plain data object");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("domain fields must be a plain data object");
  }
  if (Object.getOwnPropertySymbols(value).length !== 0) {
    throw new TypeError("domain fields must not contain symbol properties");
  }
  for (const [key, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(value),
  )) {
    if (
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError(
        `domain field ${key} must be an enumerable data property`,
      );
    }
  }
}
