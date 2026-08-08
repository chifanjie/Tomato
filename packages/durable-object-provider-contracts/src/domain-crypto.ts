import {
  canonicalizeJcsSafeIntegerUtf8V1,
} from "./jcs.js";
import {
  ContentDigestV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex22V1Schema,
} from "./primitives.js";

const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedArrayPrototypePopV1 = Array.prototype.pop;
const CapturedArrayPrototypePushV1 = Array.prototype.push;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedObjectEntriesV1 = Object.entries;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorsV1 =
  Object.getOwnPropertyDescriptors;
const CapturedObjectGetOwnPropertySymbolsV1 = Object.getOwnPropertySymbols;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedRegExpPrototypeExecV1 = RegExp.prototype.exec;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetPrototypeAddV1 = WeakSet.prototype.add;
const CapturedWeakSetPrototypeHasV1 = WeakSet.prototype.has;

function arrayPopV1<T>(array: T[]): T | undefined {
  return CapturedReflectApplyV1(CapturedArrayPrototypePopV1, array, []) as
    | T
    | undefined;
}

function arrayPushV1<T>(array: T[], value: T): number {
  return CapturedReflectApplyV1(CapturedArrayPrototypePushV1, array, [
    value,
  ]) as number;
}

function regExpTestV1(pattern: RegExp, value: string): boolean {
  return CapturedReflectApplyV1(CapturedRegExpPrototypeExecV1, pattern, [
    value,
  ]) !== null;
}

function weakSetAddV1<T extends object>(set: WeakSet<T>, value: T): void {
  CapturedReflectApplyV1(CapturedWeakSetPrototypeAddV1, set, [value]);
}

function weakSetHasV1<T extends object>(set: WeakSet<T>, value: T): boolean {
  return CapturedReflectApplyV1(CapturedWeakSetPrototypeHasV1, set, [
    value,
  ]) as boolean;
}

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
  if (
    !regExpTestV1(
      /^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$/u,
      domain,
    )
  ) {
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
  return CapturedObjectFreezeV1({
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
  if (
    value === null ||
    typeof value !== "object" ||
    CapturedArrayIsArrayV1(value)
  ) {
    throw new TypeError("domain fields must be a plain data object");
  }
  const prototype = CapturedObjectGetPrototypeOfV1(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("domain fields must be a plain data object");
  }
  if (CapturedObjectGetOwnPropertySymbolsV1(value).length !== 0) {
    throw new TypeError("domain fields must not contain symbol properties");
  }
  const descriptorEntries = CapturedObjectEntriesV1(
    CapturedObjectGetOwnPropertyDescriptorsV1(value),
  );
  for (let index = 0; index < descriptorEntries.length; index += 1) {
    const [key, descriptor] = descriptorEntries[index]!;
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

/**
 * Recursively rejects accessors, custom prototypes, sparse arrays, cycles,
 * aliases, symbols, and hidden properties without evaluating attacker-owned
 * getters. Use this for the small, bounded JSON DTOs that are canonicalized or
 * passed to a nested Zod schema.
 */
export function assertJsonDataTreeBeforeSchemaV1(value: unknown): void {
  if (value === null || typeof value !== "object") {
    throw new TypeError("value must be a JSON data object or array");
  }
  const pending: object[] = [value];
  const seen = new CapturedWeakSetV1<object>();
  while (pending.length > 0) {
    const current = arrayPopV1(pending)!;
    if (weakSetHasV1(seen, current)) {
      throw new TypeError("JSON data must be a tree");
    }
    weakSetAddV1(seen, current);

    const isArray = CapturedArrayIsArrayV1(current);
    const prototype = CapturedObjectGetPrototypeOfV1(current);
    if (
      (isArray && prototype !== Array.prototype) ||
      (!isArray && prototype !== Object.prototype && prototype !== null)
    ) {
      throw new TypeError("JSON data must use plain prototypes");
    }
    if (CapturedObjectGetOwnPropertySymbolsV1(current).length !== 0) {
      throw new TypeError("JSON data must not contain symbol properties");
    }

    const descriptors = CapturedObjectGetOwnPropertyDescriptorsV1(current);
    let arrayElementCount = 0;
    const entries = CapturedObjectEntriesV1(descriptors);
    for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
      const [key, descriptor] = entries[entryIndex]!;
      if (isArray && key === "length") continue;
      if (
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        throw new TypeError(
          "JSON data properties must be enumerable data properties",
        );
      }
      if (isArray) {
        const index = Number(key);
        if (
          !regExpTestV1(/^(?:0|[1-9][0-9]*)$/u, key) ||
          !CapturedNumberIsSafeIntegerV1(index) ||
          index < 0 ||
          index >= (current as unknown[]).length ||
          String(index) !== key
        ) {
          throw new TypeError("JSON arrays must contain only indexed elements");
        }
        arrayElementCount += 1;
      }
      if (descriptor.value !== null && typeof descriptor.value === "object") {
        arrayPushV1(pending, descriptor.value);
      }
    }
    if (
      isArray &&
      arrayElementCount !== (current as unknown[]).length
    ) {
      throw new TypeError("JSON arrays must not contain sparse slots");
    }
  }
}
