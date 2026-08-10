import { z } from "./zod-runtime.js";

import {
  ContentDigestV1Schema,
  ProviderRegistryManifestGenerationIdV1Schema,
  ProviderRegistryRootKeyIdV1Schema,
} from "./primitives.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedMathCeilV1 = Math.ceil;
const CapturedMathFloorV1 = Math.floor;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedNumberPrototypeToStringV1 = Number.prototype.toString;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorsV1 =
  Object.getOwnPropertyDescriptors;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetOwnPropertySymbolsV1 = Object.getOwnPropertySymbols;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectKeysV1 = Object.keys;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedObjectPrototypeHasOwnPropertyV1 =
  Object.prototype.hasOwnProperty;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedStringPrototypeCharCodeAtV1 = String.prototype.charCodeAt;
const CapturedStringPrototypeIndexOfV1 = String.prototype.indexOf;
const CapturedStringPrototypePadStartV1 = String.prototype.padStart;
const CapturedStringPrototypeSliceV1 = String.prototype.slice;
const CapturedStructuredCloneV1: unknown = globalThis.structuredClone;
const CapturedTextDecoderV1 = TextDecoder;
const CapturedTextDecoderPrototypeDecodeV1 = TextDecoder.prototype.decode;
const CapturedTextEncoderV1 = TextEncoder;
const CapturedTextEncoderPrototypeEncodeV1 = TextEncoder.prototype.encode;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedTypedArrayPrototypeV1 = CapturedObjectGetPrototypeOfV1(
  CapturedUint8ArrayV1.prototype,
);
const CapturedTypedArrayByteLengthGetterV1 =
  CapturedObjectGetOwnPropertyDescriptorV1(
    CapturedTypedArrayPrototypeV1,
    "byteLength",
  )?.get;

if (CapturedTypedArrayByteLengthGetterV1 === undefined) {
  throw new CapturedTypeErrorV1(
    "Uint8Array byteLength primordial unavailable",
  );
}

function bindUncurriedFixedLocatorIntrinsicV1(method: Function): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      CapturedObjectFreezeV1([method]),
    ) as Function,
  );
}

const hasOwnV1 = bindUncurriedFixedLocatorIntrinsicV1(
  CapturedObjectPrototypeHasOwnPropertyV1,
) as (receiver: object, key: PropertyKey) => boolean;
const numberToStringV1 = bindUncurriedFixedLocatorIntrinsicV1(
  CapturedNumberPrototypeToStringV1,
) as (receiver: number, radix?: number) => string;
const stringCharCodeAtV1 = bindUncurriedFixedLocatorIntrinsicV1(
  CapturedStringPrototypeCharCodeAtV1,
) as (receiver: string, index: number) => number;
const stringIndexOfV1 = bindUncurriedFixedLocatorIntrinsicV1(
  CapturedStringPrototypeIndexOfV1,
) as (receiver: string, search: string, position?: number) => number;
const stringPadStartV1 = bindUncurriedFixedLocatorIntrinsicV1(
  CapturedStringPrototypePadStartV1,
) as (receiver: string, length: number, fill?: string) => string;
const stringSliceV1 = bindUncurriedFixedLocatorIntrinsicV1(
  CapturedStringPrototypeSliceV1,
) as (receiver: string, start?: number, end?: number) => string;
const textDecoderDecodeV1 = bindUncurriedFixedLocatorIntrinsicV1(
  CapturedTextDecoderPrototypeDecodeV1,
) as (
  receiver: TextDecoder,
  input?: AllowSharedBufferSource,
  options?: TextDecodeOptions,
) => string;
const textEncoderEncodeV1 = bindUncurriedFixedLocatorIntrinsicV1(
  CapturedTextEncoderPrototypeEncodeV1,
) as (receiver: TextEncoder, input?: string) => Uint8Array;
const typedArrayByteLengthV1 = bindUncurriedFixedLocatorIntrinsicV1(
  CapturedTypedArrayByteLengthGetterV1,
) as (receiver: Uint8Array) => number;

const BoundCapturedStructuredCloneV1 =
  typeof CapturedStructuredCloneV1 === "function"
    ? CapturedObjectFreezeV1((value: unknown): unknown =>
        CapturedReflectApplyV1(
          CapturedStructuredCloneV1,
          undefined,
          CapturedObjectFreezeV1([value]),
        ))
    : undefined;

function arrayIsArrayV1(value: unknown): value is unknown[] {
  return CapturedReflectApplyV1(CapturedArrayIsArrayV1, undefined, [
    value,
  ]) as boolean;
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
const textEncoderV1 = new CapturedTextEncoderV1();
// TextDecoder.decode updates implementation-private streaming/BOM state even
// for non-streaming calls in Node, so the captured instance cannot be frozen.
// Its only callable surface is still the frozen uncurried method above.
const textDecoderV1 = new CapturedTextDecoderV1("utf-8", {
  fatal: true,
  ignoreBOM: true,
});

function assertUnicodeScalarSequenceV1(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = stringCharCodeAtV1(value, index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = stringCharCodeAtV1(value, index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new CapturedTypeErrorV1(
          "semantic ID contains an unpaired high surrogate",
        );
      }
      index += 1;
      continue;
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new CapturedTypeErrorV1(
        "semantic ID contains an unpaired low surrogate",
      );
    }
  }
}

function semanticIdUtf8V1(semanticId: unknown): Uint8Array {
  if (typeof semanticId !== "string" || semanticId.length === 0) {
    throw new CapturedTypeErrorV1(
      "semantic ID must be a non-empty validated string",
    );
  }
  assertUnicodeScalarSequenceV1(semanticId);
  return textEncoderEncodeV1(textEncoderV1, semanticId);
}

function encodeBase32HexLowerV1(bytes: Uint8Array): string {
  let output = "";
  let accumulator = 0;
  let availableBits = 0;
  const byteLength = typedArrayByteLengthV1(bytes);
  for (let index = 0; index < byteLength; index += 1) {
    const byte = bytes[index]!;
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
  const decoded = new CapturedUint8ArrayV1(
    CapturedMathFloorV1((body.length * 5) / 8),
  );
  let accumulator = 0;
  let availableBits = 0;
  let outputOffset = 0;
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index]!;
    const digit = stringIndexOfV1(BASE32HEX_LOWER_ALPHABET, character);
    if (digit < 0) {
      throw new CapturedTypeErrorV1(
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
  if (outputOffset !== typedArrayByteLengthV1(decoded) || accumulator !== 0) {
    throw new CapturedTypeErrorV1(
      "filename key is not canonical lowercase unpadded base32hex",
    );
  }
  return decoded;
}

function bytesToLowerHexV1(bytes: Uint8Array): string {
  let output = "";
  const byteLength = typedArrayByteLengthV1(bytes);
  for (let index = 0; index < byteLength; index += 1) {
    output += stringPadStartV1(
      numberToStringV1(bytes[index]!, 16),
      2,
      "0",
    );
  }
  return output;
}

function canonicalShortKeyBodyV1(body: string): boolean {
  try {
    const bytes = decodeBase32HexLowerV1(body);
    if (
      typedArrayByteLengthV1(bytes) === 0 ||
      encodeBase32HexLowerV1(bytes) !== body
    ) {
      return false;
    }
    const semanticId = textDecoderDecodeV1(textDecoderV1, bytes);
    return (
      semanticId.length !== 0 &&
      encodeBase32HexLowerV1(semanticIdUtf8V1(semanticId)) === body
    );
  } catch {
    return false;
  }
}

function isExactLowerHexRangeV1(
  value: string,
  offset: number,
  length: number,
): boolean {
  if (value.length !== offset + length) return false;
  for (let index = offset; index < value.length; index += 1) {
    const codeUnit = stringCharCodeAtV1(value, index);
    if (
      !(
        (codeUnit >= 0x30 && codeUnit <= 0x39) ||
        (codeUnit >= 0x61 && codeUnit <= 0x66)
      )
    ) {
      return false;
    }
  }
  return true;
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
      (key) =>
        canonicalShortKeyBodyV1(stringSliceV1(key, "id-".length)),
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

function parseShortStoreFilenameKeyInternalV1(
  value: unknown,
): ShortStoreFilenameKeyV1 {
  if (typeof value !== "string") {
    throw new CapturedTypeErrorV1("filename key must be a string");
  }
  const prefix = "id-";
  const body = stringSliceV1(value, prefix.length);
  if (
    stringSliceV1(value, 0, prefix.length) !== prefix ||
    body.length < 2 ||
    body.length > STORE_FILENAME_SHORT_BODY_MAX_LENGTH_V1 ||
    !canonicalShortKeyBodyV1(body)
  ) {
    throw new CapturedTypeErrorV1(
      "filename key must contain canonical UTF-8 lowercase base32hex bytes",
    );
  }
  return value as ShortStoreFilenameKeyV1;
}

function parseHashedStoreFilenameKeyInternalV1(
  value: unknown,
): HashedStoreFilenameKeyV1 {
  const prefix = "idh-";
  if (
    typeof value !== "string" ||
    stringSliceV1(value, 0, prefix.length) !== prefix ||
    !isExactLowerHexRangeV1(value, prefix.length, 64)
  ) {
    throw new CapturedTypeErrorV1(
      "hashed filename key must contain exactly 64 lowercase hex digits",
    );
  }
  return value as HashedStoreFilenameKeyV1;
}

function parseStoreFilenameKeyInternalV1(value: unknown): StoreFilenameKeyV1 {
  if (typeof value !== "string") {
    throw new CapturedTypeErrorV1("filename key must be a string");
  }
  if (stringSliceV1(value, 0, "id-".length) === "id-") {
    return parseShortStoreFilenameKeyInternalV1(value);
  }
  return parseHashedStoreFilenameKeyInternalV1(value);
}

/**
 * Encodes an already domain-schema-validated semantic ID as one canonical
 * portable filename component. This generic codec validates only the string,
 * Unicode and branch invariants; callers remain responsible for the ID brand.
 */
export function encodeStoreFilenameKeyV1(
  semanticId: string,
): StoreFilenameKeyV1 {
  const utf8 = semanticIdUtf8V1(semanticId);
  const canonicalBodyLength = CapturedMathCeilV1(
    (typedArrayByteLengthV1(utf8) * 8) / 5,
  );
  const key = canonicalBodyLength <= STORE_FILENAME_SHORT_BODY_MAX_LENGTH_V1
    ? `id-${encodeBase32HexLowerV1(utf8)}`
    : `idh-${bytesToLowerHexV1(sha256InternalV1(utf8))}`;
  return parseStoreFilenameKeyInternalV1(key);
}

/** Short keys are reversible; hashed keys deliberately are not. */
export function decodeShortStoreFilenameKeyV1(
  key: unknown,
): string {
  const shortKey = parseShortStoreFilenameKeyInternalV1(key);
  const body = stringSliceV1(shortKey, "id-".length);
  const semanticId = textDecoderDecodeV1(
    textDecoderV1,
    decodeBase32HexLowerV1(body),
  );
  if (encodeStoreFilenameKeyV1(semanticId) !== shortKey) {
    throw new CapturedTypeErrorV1(
      "filename key does not exactly re-encode",
    );
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
  const parsedKey = parseStoreFilenameKeyInternalV1(key);
  const expectedKey = encodeStoreFilenameKeyV1(semanticId);
  if (parsedKey !== expectedKey) {
    throw new CapturedTypeErrorV1(
      "filename key does not match the exact semantic ID",
    );
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

function parseProviderRegistryRootMetadataLocatorInternalV1(
  snapshot: Record<string, unknown>,
): ProviderRegistryRootMetadataLocatorV1 {
  const locatorProfile = snapshot.locatorProfile;
  const rootGeneration = snapshot.rootGeneration;
  const rootKeyId = snapshot.rootKeyId;
  if (
    locatorProfile !== PROVIDER_REGISTRY_ROOT_METADATA_LOCATOR_PROFILE_V1 ||
    typeof rootGeneration !== "number" ||
    !CapturedNumberIsSafeIntegerV1(rootGeneration) ||
    rootGeneration < 1 ||
    typeof rootKeyId !== "string" ||
    !isExactLowerHexRangeV1(rootKeyId, 0, 22)
  ) {
    throw new CapturedTypeErrorV1("root metadata locator fields are invalid");
  }
  return snapshot as ProviderRegistryRootMetadataLocatorV1;
}

export type ProviderRegistryRootMetadataRelativePathV1 =
  `provider/root-metadata/${StoreFilenameKeyV1}.json`;

function snapshotExactLocatorDataObjectV1(
  input: unknown,
  requiredKeys: readonly string[],
  locatorName: string,
): Record<string, unknown> {
  if (input === null || typeof input !== "object" || arrayIsArrayV1(input)) {
    throw new CapturedTypeErrorV1(
      `${locatorName} must be a plain data object`,
    );
  }

  let prototype: object | null;
  let symbols: symbol[];
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = objectGetPrototypeOfV1(input);
    symbols = objectGetOwnPropertySymbolsV1(input);
    descriptors = objectGetOwnPropertyDescriptorsV1(input);
  } catch {
    throw new CapturedTypeErrorV1(
      `${locatorName} must be a plain data object`,
    );
  }
  if (prototype !== CapturedObjectPrototypeV1 && prototype !== null) {
    throw new CapturedTypeErrorV1(
      `${locatorName} must be a plain data object`,
    );
  }
  if (symbols.length !== 0) {
    throw new CapturedTypeErrorV1(`${locatorName} must not contain symbols`);
  }

  const actualKeys = objectKeysV1(descriptors);
  if (actualKeys.length !== requiredKeys.length) {
    throw new CapturedTypeErrorV1(
      `${locatorName} must contain only exact fields`,
    );
  }
  for (let index = 0; index < requiredKeys.length; index += 1) {
    if (!hasOwnV1(descriptors, requiredKeys[index]!)) {
      throw new CapturedTypeErrorV1(
        `${locatorName} must contain only exact fields`,
      );
    }
  }

  const snapshot = CapturedObjectCreateV1(null) as Record<string, unknown>;
  for (let index = 0; index < requiredKeys.length; index += 1) {
    const key = requiredKeys[index]!;
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !hasOwnV1(descriptor, "value") ||
      descriptor.enumerable !== true
    ) {
      throw new CapturedTypeErrorV1(
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
    if (BoundCapturedStructuredCloneV1 === undefined) {
      throw new CapturedTypeErrorV1(
        "structuredClone primordial unavailable",
      );
    }
    BoundCapturedStructuredCloneV1(input);
  } catch {
    throw new CapturedTypeErrorV1(
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
  const locator = parseProviderRegistryRootMetadataLocatorInternalV1(snapshot);
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

function parseProviderRegistryManifestLocatorInternalV1(
  snapshot: Record<string, unknown>,
): ProviderRegistryManifestLocatorV1 {
  const locatorProfile = snapshot.locatorProfile;
  const generationId = snapshot.generationId;
  const generationPrefix = "provider-registry-manifest:";
  if (
    locatorProfile !== PROVIDER_REGISTRY_MANIFEST_LOCATOR_PROFILE_V1 ||
    typeof generationId !== "string" ||
    stringSliceV1(generationId, 0, generationPrefix.length) !==
      generationPrefix ||
    !isExactLowerHexRangeV1(generationId, generationPrefix.length, 22)
  ) {
    throw new CapturedTypeErrorV1("registry manifest locator fields are invalid");
  }
  return snapshot as ProviderRegistryManifestLocatorV1;
}

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
  const locator = parseProviderRegistryManifestLocatorInternalV1(snapshot);
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

CapturedObjectFreezeV1(encodeStoreFilenameKeyV1);
CapturedObjectFreezeV1(decodeShortStoreFilenameKeyV1);
CapturedObjectFreezeV1(verifyStoreFilenameKeyForSemanticIdV1);
CapturedObjectFreezeV1(buildProviderRegistryRootMetadataRelativePathV1);
CapturedObjectFreezeV1(buildProviderRegistryManifestRelativePathV1);
CapturedObjectFreezeV1(validateProviderRegistryManifestRelativePathV1);
