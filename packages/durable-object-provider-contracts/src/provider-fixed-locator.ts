import { z } from "./zod-runtime.js";

import {
  ContentDigestV1Schema,
  ProviderRegistryManifestGenerationIdV1Schema,
  ProviderRegistryRootKeyIdV1Schema,
} from "./primitives.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedArrayPrototypeSomeV1 = Array.prototype.some;
const CapturedArrayPrototypeSortV1 = Array.prototype.sort;
const CapturedObjectGetOwnPropertyDescriptorsV1 =
  Object.getOwnPropertyDescriptors;
const CapturedObjectGetOwnPropertySymbolsV1 = Object.getOwnPropertySymbols;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectKeysV1 = Object.keys;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedReflectApplyV1 = Reflect.apply;

function arrayIsArrayV1(value: unknown): value is unknown[] {
  return CapturedReflectApplyV1(CapturedArrayIsArrayV1, undefined, [
    value,
  ]) as boolean;
}

function arraySomeV1<T>(
  array: readonly T[],
  callback: (value: T, index: number, source: readonly T[]) => unknown,
): boolean {
  return CapturedReflectApplyV1(CapturedArrayPrototypeSomeV1, array, [
    callback,
  ]) as boolean;
}

function arraySortV1<T>(array: T[]): T[] {
  return CapturedReflectApplyV1(CapturedArrayPrototypeSortV1, array, [
    undefined,
  ]) as T[];
}

function objectGetOwnPropertyDescriptorsV1(
  value: object,
): PropertyDescriptorMap {
  return CapturedReflectApplyV1(
    CapturedObjectGetOwnPropertyDescriptorsV1,
    undefined,
    [value],
  ) as PropertyDescriptorMap;
}

function objectGetOwnPropertySymbolsV1(value: object): symbol[] {
  return CapturedReflectApplyV1(
    CapturedObjectGetOwnPropertySymbolsV1,
    undefined,
    [value],
  ) as symbol[];
}

function objectGetPrototypeOfV1(value: object): object | null {
  return CapturedReflectApplyV1(CapturedObjectGetPrototypeOfV1, undefined, [
    value,
  ]) as object | null;
}

function objectKeysV1(value: object): string[] {
  return CapturedReflectApplyV1(CapturedObjectKeysV1, undefined, [
    value,
  ]) as string[];
}

export const STORE_FILENAME_SHORT_BODY_MAX_LENGTH_V1 = 220 as const;
export const PROVIDER_REGISTRY_ROOT_METADATA_LOCATOR_PROFILE_V1 =
  "installation_provider_registry_root_metadata_v1" as const;
export const PROVIDER_REGISTRY_MANIFEST_LOCATOR_PROFILE_V1 =
  "installation_provider_registry_manifest_v1" as const;
export const PROVIDER_REAL_FILESYSTEM_FIXTURE_CORPUS_MANIFEST_LOCATOR_PROFILE_V1 =
  "distribution_provider_real_fs_fixture_corpus_manifest_v1" as const;
export const PROVIDER_REAL_FILESYSTEM_SUITE_MANIFEST_LOCATOR_PROFILE_V1 =
  "distribution_provider_real_fs_suite_manifest_v1" as const;

const BASE32HEX_LOWER_ALPHABET = "0123456789abcdefghijklmnopqrstuv";
const SHORT_KEY_SYNTAX_PATTERN =
  /^id-(?=[0-9a-v]{2,220}$)(?:[0-9a-v]{8})*(?:[0-9a-v][048cgkos]|[0-9a-v]{3}[0g]|[0-9a-v]{4}[02468acegikmoqsu]|[0-9a-v]{6}[08go])?$/u;
const HASHED_KEY_PATTERN = /^idh-[0-9a-f]{64}$/u;
const textEncoderV1 = new TextEncoder();
const textDecoderV1 = new TextDecoder("utf-8", {
  fatal: true,
  ignoreBOM: true,
});

function assertUnicodeScalarSequenceV1(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new TypeError("semantic ID contains an unpaired high surrogate");
      }
      index += 1;
      continue;
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new TypeError("semantic ID contains an unpaired low surrogate");
    }
  }
}

function semanticIdUtf8V1(semanticId: unknown): Uint8Array {
  if (typeof semanticId !== "string" || semanticId.length === 0) {
    throw new TypeError("semantic ID must be a non-empty validated string");
  }
  assertUnicodeScalarSequenceV1(semanticId);
  return textEncoderV1.encode(semanticId);
}

function encodeBase32HexLowerV1(bytes: Uint8Array): string {
  let output = "";
  let accumulator = 0;
  let availableBits = 0;
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    availableBits += 8;
    while (availableBits >= 5) {
      availableBits -= 5;
      output += BASE32HEX_LOWER_ALPHABET[
        (accumulator >>> availableBits) & 0x1f
      ];
      accumulator &= (1 << availableBits) - 1;
    }
  }
  if (availableBits !== 0) {
    output += BASE32HEX_LOWER_ALPHABET[
      (accumulator << (5 - availableBits)) & 0x1f
    ];
  }
  return output;
}

function decodeBase32HexLowerV1(body: string): Uint8Array {
  const decoded = new Uint8Array(Math.floor((body.length * 5) / 8));
  let accumulator = 0;
  let availableBits = 0;
  let outputOffset = 0;
  for (const character of body) {
    const digit = BASE32HEX_LOWER_ALPHABET.indexOf(character);
    if (digit < 0) {
      throw new TypeError(
        "filename key is not lowercase unpadded base32hex",
      );
    }
    accumulator = (accumulator << 5) | digit;
    availableBits += 5;
    if (availableBits >= 8) {
      availableBits -= 8;
      decoded[outputOffset] = (accumulator >>> availableBits) & 0xff;
      outputOffset += 1;
      accumulator &= (1 << availableBits) - 1;
    }
  }
  if (outputOffset !== decoded.byteLength || accumulator !== 0) {
    throw new TypeError(
      "filename key is not canonical lowercase unpadded base32hex",
    );
  }
  return decoded;
}

function bytesToLowerHexV1(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function canonicalShortKeyBodyV1(body: string): boolean {
  try {
    const bytes = decodeBase32HexLowerV1(body);
    if (
      bytes.byteLength === 0 ||
      encodeBase32HexLowerV1(bytes) !== body
    ) {
      return false;
    }
    const semanticId = textDecoderV1.decode(bytes);
    return (
      semanticId.length !== 0 &&
      encodeBase32HexLowerV1(semanticIdUtf8V1(semanticId)) === body
    );
  } catch {
    return false;
  }
}

/**
 * JSON-Schema-representable wire syntax only. Full ShortStoreFilenameKeyV1
 * validation additionally requires fatal UTF-8 decode and exact re-encoding.
 */
export const ShortStoreFilenameKeySyntaxV1Schema = z
  .string()
  .regex(SHORT_KEY_SYNTAX_PATTERN);

export const ShortStoreFilenameKeyV1Schema =
  ShortStoreFilenameKeySyntaxV1Schema
    .refine(
      (key) => canonicalShortKeyBodyV1(key.slice("id-".length)),
      "must contain canonical UTF-8 lowercase base32hex semantic ID bytes",
    )
    .brand<"ShortStoreFilenameKeyV1">();
export type ShortStoreFilenameKeyV1 = z.infer<
  typeof ShortStoreFilenameKeyV1Schema
>;

export const HashedStoreFilenameKeyV1Schema = z
  .string()
  .regex(HASHED_KEY_PATTERN)
  .brand<"HashedStoreFilenameKeyV1">();
export type HashedStoreFilenameKeyV1 = z.infer<
  typeof HashedStoreFilenameKeyV1Schema
>;

/** Wire syntax only; semantic-ID/branch binding requires recomputation. */
export const StoreFilenameKeySyntaxV1Schema = z.union([
  ShortStoreFilenameKeySyntaxV1Schema,
  HashedStoreFilenameKeyV1Schema,
]);

export const StoreFilenameKeyV1Schema = z.union([
  ShortStoreFilenameKeyV1Schema,
  HashedStoreFilenameKeyV1Schema,
]);
export type StoreFilenameKeyV1 = z.infer<typeof StoreFilenameKeyV1Schema>;

/**
 * Encodes an already domain-schema-validated semantic ID as one canonical
 * portable filename component. This generic codec validates only the string,
 * Unicode and branch invariants; callers remain responsible for the ID brand.
 */
export function encodeStoreFilenameKeyV1(
  semanticId: string,
): StoreFilenameKeyV1 {
  const utf8 = semanticIdUtf8V1(semanticId);
  const canonicalBodyLength = Math.ceil((utf8.byteLength * 8) / 5);
  const key = canonicalBodyLength <= STORE_FILENAME_SHORT_BODY_MAX_LENGTH_V1
    ? `id-${encodeBase32HexLowerV1(utf8)}`
    : `idh-${bytesToLowerHexV1(sha256InternalV1(utf8))}`;
  return StoreFilenameKeyV1Schema.parse(key);
}

/** Short keys are reversible; hashed keys deliberately are not. */
export function decodeShortStoreFilenameKeyV1(
  key: unknown,
): string {
  const shortKey = ShortStoreFilenameKeyV1Schema.parse(key);
  const body = shortKey.slice("id-".length);
  const semanticId = textDecoderV1.decode(decodeBase32HexLowerV1(body));
  if (encodeStoreFilenameKeyV1(semanticId) !== shortKey) {
    throw new TypeError("filename key does not exactly re-encode");
  }
  return semanticId;
}

/**
 * Verifies either branch against the trusted descriptor/Envelope semantic ID.
 * Recomputing the canonical branch prevents caller-selected hashing and
 * substitution of a different semantic ID behind a hashed filename.
 */
export function verifyStoreFilenameKeyForSemanticIdV1(
  key: unknown,
  semanticId: string,
): StoreFilenameKeyV1 {
  const parsedKey = StoreFilenameKeyV1Schema.parse(key);
  const expectedKey = encodeStoreFilenameKeyV1(semanticId);
  if (parsedKey !== expectedKey) {
    throw new TypeError("filename key does not match the exact semantic ID");
  }
  return parsedKey;
}

const PositiveSafeIntegerV1Schema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);

export const ProviderRegistryRootMetadataLocatorV1Schema = z.strictObject({
  locatorProfile: z.literal(
    PROVIDER_REGISTRY_ROOT_METADATA_LOCATOR_PROFILE_V1,
  ),
  rootGeneration: PositiveSafeIntegerV1Schema,
  rootKeyId: ProviderRegistryRootKeyIdV1Schema,
});
export type ProviderRegistryRootMetadataLocatorV1 = z.infer<
  typeof ProviderRegistryRootMetadataLocatorV1Schema
>;

export type ProviderRegistryRootMetadataRelativePathV1 =
  `provider/root-metadata/${StoreFilenameKeyV1}.json`;

function snapshotExactLocatorDataObjectV1(
  input: unknown,
  requiredKeys: readonly string[],
  locatorName: string,
): Record<string, unknown> {
  if (input === null || typeof input !== "object" || arrayIsArrayV1(input)) {
    throw new TypeError(`${locatorName} must be a plain data object`);
  }

  let prototype: object | null;
  let symbols: symbol[];
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = objectGetPrototypeOfV1(input);
    symbols = objectGetOwnPropertySymbolsV1(input);
    descriptors = objectGetOwnPropertyDescriptorsV1(input);
  } catch {
    throw new TypeError(`${locatorName} must be a plain data object`);
  }
  if (prototype !== CapturedObjectPrototypeV1 && prototype !== null) {
    throw new TypeError(`${locatorName} must be a plain data object`);
  }
  if (symbols.length !== 0) {
    throw new TypeError(`${locatorName} must not contain symbols`);
  }

  const sortedRequiredKeys = arraySortV1([...requiredKeys]);
  const actualKeys = arraySortV1(objectKeysV1(descriptors));
  if (
    actualKeys.length !== sortedRequiredKeys.length ||
    arraySomeV1(
      actualKeys,
      (key, index) => key !== sortedRequiredKeys[index],
    )
  ) {
    throw new TypeError(`${locatorName} must contain only exact fields`);
  }

  const snapshot: Record<string, unknown> = {};
  for (const key of requiredKeys) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError(
        `${locatorName} field ${key} must be an enumerable data property`,
      );
    }
    snapshot[key] = descriptor.value;
  }

  return snapshot;
}

function assertNonProxyLocatorDataObjectV1(
  input: object,
  locatorName: string,
): void {
  // The structured-clone algorithm rejects Proxy exotic objects. It is a web
  // platform primitive, so this guard preserves browser/worker portability.
  try {
    structuredClone(input);
  } catch {
    throw new TypeError(
      `${locatorName} must be an ordinary non-proxy data object`,
    );
  }
}

/** Builds the only allowed state-root-relative Root Metadata path. */
export function buildProviderRegistryRootMetadataRelativePathV1(
  input: unknown,
): ProviderRegistryRootMetadataRelativePathV1 {
  const snapshot = snapshotExactLocatorDataObjectV1(
    input,
    ["locatorProfile", "rootGeneration", "rootKeyId"],
    "root metadata locator",
  );
  const locator = ProviderRegistryRootMetadataLocatorV1Schema.parse(
    snapshot,
  );
  assertNonProxyLocatorDataObjectV1(
    input as object,
    "root metadata locator",
  );
  const semanticComponent = `${locator.rootGeneration}:${locator.rootKeyId}`;
  const filenameKey = encodeStoreFilenameKeyV1(semanticComponent);
  return `provider/root-metadata/${filenameKey}.json`;
}

export const ProviderRegistryManifestLocatorV1Schema = z
  .strictObject({
    locatorProfile: z.literal(
      PROVIDER_REGISTRY_MANIFEST_LOCATOR_PROFILE_V1,
    ),
    generationId: ProviderRegistryManifestGenerationIdV1Schema,
  })
  .brand<"ProviderRegistryManifestLocatorV1">();
export type ProviderRegistryManifestLocatorV1 = z.infer<
  typeof ProviderRegistryManifestLocatorV1Schema
>;

declare const ProviderRegistryManifestRelativePathV1Brand: unique symbol;
export type ProviderRegistryManifestRelativePathV1 =
  `provider/registry-manifests/${StoreFilenameKeyV1}.json` & {
    readonly [ProviderRegistryManifestRelativePathV1Brand]: true;
  };

/** Builds the only allowed state-root-relative Registry Manifest path. */
export function buildProviderRegistryManifestRelativePathV1(
  input: unknown,
): ProviderRegistryManifestRelativePathV1 {
  const snapshot = snapshotExactLocatorDataObjectV1(
    input,
    ["locatorProfile", "generationId"],
    "registry manifest locator",
  );
  const locator = ProviderRegistryManifestLocatorV1Schema.parse(
    snapshot,
  );
  assertNonProxyLocatorDataObjectV1(
    input as object,
    "registry manifest locator",
  );
  const filenameKey = encodeStoreFilenameKeyV1(locator.generationId);
  return `provider/registry-manifests/${filenameKey}.json` as ProviderRegistryManifestRelativePathV1;
}

/** Validates exact semantic locator fields and returns their canonical path. */
export function validateProviderRegistryManifestRelativePathV1(
  input: unknown,
): ProviderRegistryManifestRelativePathV1 {
  return buildProviderRegistryManifestRelativePathV1(input);
}

export const ProviderRealFilesystemFixtureCorpusManifestLocatorV1Schema =
  z.strictObject({
    locatorProfile: z.literal(
      PROVIDER_REAL_FILESYSTEM_FIXTURE_CORPUS_MANIFEST_LOCATOR_PROFILE_V1,
    ),
    contentDigest: ContentDigestV1Schema,
  });
export type ProviderRealFilesystemFixtureCorpusManifestLocatorV1 = z.infer<
  typeof ProviderRealFilesystemFixtureCorpusManifestLocatorV1Schema
>;

export const ProviderRealFilesystemSuiteManifestLocatorV1Schema =
  z.strictObject({
    locatorProfile: z.literal(
      PROVIDER_REAL_FILESYSTEM_SUITE_MANIFEST_LOCATOR_PROFILE_V1,
    ),
    contentDigest: ContentDigestV1Schema,
  });
export type ProviderRealFilesystemSuiteManifestLocatorV1 = z.infer<
  typeof ProviderRealFilesystemSuiteManifestLocatorV1Schema
>;

declare const ProviderRealFilesystemFixtureCorpusManifestRelativePathV1Brand:
  unique symbol;
export type ProviderRealFilesystemFixtureCorpusManifestRelativePathV1 =
  `provider/real-fs-fixture-corpus-manifests/${StoreFilenameKeyV1}.json` & {
    readonly [ProviderRealFilesystemFixtureCorpusManifestRelativePathV1Brand]: true;
  };

declare const ProviderRealFilesystemSuiteManifestRelativePathV1Brand:
  unique symbol;
export type ProviderRealFilesystemSuiteManifestRelativePathV1 =
  `provider/real-fs-suite-manifests/${StoreFilenameKeyV1}.json` & {
    readonly [ProviderRealFilesystemSuiteManifestRelativePathV1Brand]: true;
  };
