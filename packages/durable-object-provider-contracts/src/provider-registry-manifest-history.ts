import {
  ProviderBootstrapTrustBundleV1Schema,
  PROVIDER_BOOTSTRAP_TRUST_BUNDLE_MAX_BYTES_V1,
  type ProviderBootstrapTrustBundleV1,
} from "./bootstrap-trust-bundle.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  InstallationIdentityGenerationIdV1Schema,
  type InstallationIdentityGenerationIdV1,
} from "./primitives.js";
import {
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestPinV1Schema,
  createProviderFeasibilityApproverPublicKeySignatureMessageV1,
  createProviderRegistryManifestSignatureMessageV1,
  createStoreDurableObjectProviderBindingDerivationGenerationSignatureMessageV1,
  createStoreDurableObjectProviderRegistryEntrySignatureMessageV1,
  createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1,
  createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1,
  deriveProviderFeasibilityApproverKeyIdV1,
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
  deriveStoreProviderVerificationKeyIdV1,
  deriveStoreDurableObjectProviderRegistryEntryContentDigestV1,
  deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1,
  projectProviderRegistryManifestIdFieldsV1,
  projectProviderRegistryManifestUnsignedClaimsV1,
  StoreDurableObjectProviderRegistryEntryV1Schema,
  type ProviderFeasibilityApproverPublicKeyV1,
  type ProviderRegistryManifestEnvelopeV1,
  type ProviderRegistryManifestMemberV1,
  type ProviderRegistryManifestPinV1,
  type ProviderRegistryManifestV1,
  type StoreDurableObjectProviderBindingDerivationGenerationV1,
  type StoreDurableObjectProviderRegistryEntryV1,
  type StoreDurableObjectProviderRuntimeAttestationV1,
  type StoreDurableObjectProviderVerificationPublicKeyV1,
} from "./provider-registry-records.js";
import {
  buildProviderRegistryManifestRelativePathV1,
  encodeStoreFilenameKeyV1,
} from "./provider-fixed-locator.js";
import {
  validateProviderRegistryRootMetadataHistoryV1,
  type ProviderRegistryRootMetadataHistoryValidationV1,
} from "./provider-registry-root-history.js";
import {
  assertProviderRegistryPreparedCopyLedgerZeroInternalV1,
  createRegistryHistoryVerifiedCryptoWitnessInternalV1,
  discardPreparedRegistryHistoryInputInternalV1,
  discardRegistryHistoryVerifiedWitnessInternalV1,
  registerProviderRegistryManifestHistoryPreparedValidatorInternalV1,
  registerRegistryHistoryVerifiedWitnessInternalV1,
  takePreparedRegistryHistoryInputInternalV1,
  validateProviderRegistryRootMetadataHistoryPreparedInternalV1,
  type PreparedRegistryHistoryInputHandleV1,
  type PreparedRegistryHistorySnapshotV1,
  type ProviderRegistryManifestHistoryPreparedDiagnosticResultInternalV1,
  type RegistryHistoryVerifiedCryptoWitnessV1,
  type RegistryHistoryVerifiedTipEntryV1,
  type RegistryTrustWitnessHandleV1,
} from "./provider-registry-history-prepared-handle-internal.js";
import {
  deriveProviderEd25519PublicKeyDigestInternalV1,
  type ProviderRegistryRootMetadataEnvelopeV1,
  type ProviderRegistryRootMetadataPinV1,
  type ProviderRegistryRootPublicKeyV1,
} from "./provider-registry-trust.js";
import {
  validateProviderStrictEd25519PointWithCapabilityV1,
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";
import {
  createProviderNonThenableFrozenRecordV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";

const CapturedArrayV1 = Array;
const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedArrayPrototypeFilterV1 = Array.prototype.filter;
const CapturedArrayPrototypeMapV1 = Array.prototype.map;
const CapturedArrayPrototypePushV1 = Array.prototype.push;
const CapturedArrayPrototypeSomeV1 = Array.prototype.some;
const CapturedArrayPrototypeSortV1 = Array.prototype.sort;
const CapturedMapV1 = Map;
const CapturedMapPrototypeGetV1 = Map.prototype.get;
const CapturedMapPrototypeHasV1 = Map.prototype.has;
const CapturedMapPrototypeForEachV1 = Map.prototype.forEach;
const CapturedMapPrototypeSetV1 = Map.prototype.set;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectIsV1 = Object.is;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedObjectValuesV1 = Object.values;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const CapturedRegExpPrototypeExecV1 = RegExp.prototype.exec;
const CapturedSetV1 = Set;
const CapturedSetPrototypeAddV1 = Set.prototype.add;
const CapturedSetPrototypeForEachV1 = Set.prototype.forEach;
const CapturedSetPrototypeHasV1 = Set.prototype.has;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetPrototypeAddV1 = WeakSet.prototype.add;
const CapturedWeakSetPrototypeHasV1 = WeakSet.prototype.has;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapPrototypeDeleteV1 = WeakMap.prototype.delete;
const CapturedWeakMapPrototypeGetV1 = WeakMap.prototype.get;
const CapturedWeakMapPrototypeHasV1 = WeakMap.prototype.has;
const CapturedWeakMapPrototypeSetV1 = WeakMap.prototype.set;

function arrayFilterV1<T, S extends T>(
  array: readonly T[],
  callback: (value: T, index: number, source: readonly T[]) => value is S,
): S[];
function arrayFilterV1<T>(
  array: readonly T[],
  callback: (value: T, index: number, source: readonly T[]) => unknown,
): T[];
function arrayFilterV1<T>(
  array: readonly T[],
  callback: (value: T, index: number, source: readonly T[]) => unknown,
): T[] {
  return CapturedReflectApplyV1(CapturedArrayPrototypeFilterV1, array, [
    callback,
  ]) as T[];
}

function arrayMapV1<T, U>(
  array: readonly T[],
  callback: (value: T, index: number, source: readonly T[]) => U,
): U[] {
  return CapturedReflectApplyV1(CapturedArrayPrototypeMapV1, array, [
    callback,
  ]) as U[];
}

function arrayPushV1<T>(array: T[], value: T): number {
  return CapturedReflectApplyV1(CapturedArrayPrototypePushV1, array, [
    value,
  ]) as number;
}

function arraySomeV1<T>(
  array: readonly T[],
  callback: (value: T, index: number, source: readonly T[]) => unknown,
): boolean {
  return CapturedReflectApplyV1(CapturedArrayPrototypeSomeV1, array, [
    callback,
  ]) as boolean;
}

function arraySortV1<T>(
  array: T[],
  compare?: (left: T, right: T) => number,
): T[] {
  return CapturedReflectApplyV1(CapturedArrayPrototypeSortV1, array, [
    compare,
  ]) as T[];
}

function mapGetV1<K, V>(map: ReadonlyMap<K, V>, key: K): V | undefined {
  return CapturedReflectApplyV1(CapturedMapPrototypeGetV1, map, [key]) as
    | V
    | undefined;
}

function mapHasV1<K, V>(map: ReadonlyMap<K, V>, key: K): boolean {
  return CapturedReflectApplyV1(CapturedMapPrototypeHasV1, map, [
    key,
  ]) as boolean;
}

function mapSetV1<K, V>(map: Map<K, V>, key: K, value: V): void {
  CapturedReflectApplyV1(CapturedMapPrototypeSetV1, map, [key, value]);
}

function mapForEachV1<K, V>(
  map: ReadonlyMap<K, V>,
  callback: (value: V, key: K) => void,
): void {
  CapturedReflectApplyV1(CapturedMapPrototypeForEachV1, map, [callback]);
}

function mapFromEntriesV1<K, V>(
  entries: readonly (readonly [K, V])[],
): Map<K, V> {
  const map = new CapturedMapV1<K, V>();
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    mapSetV1(map, entry[0], entry[1]);
  }
  return map;
}

function setAddV1<T>(set: Set<T>, value: T): void {
  CapturedReflectApplyV1(CapturedSetPrototypeAddV1, set, [value]);
}

function setHasV1<T>(set: Set<T>, value: T): boolean {
  return CapturedReflectApplyV1(CapturedSetPrototypeHasV1, set, [
    value,
  ]) as boolean;
}

function setForEachV1<T>(
  set: ReadonlySet<T>,
  callback: (value: T) => void,
): void {
  CapturedReflectApplyV1(CapturedSetPrototypeForEachV1, set, [callback]);
}

function weakMapDeleteV1<K extends object, V>(
  map: WeakMap<K, V>,
  key: K,
): boolean {
  return CapturedReflectApplyV1(CapturedWeakMapPrototypeDeleteV1, map, [
    key,
  ]) as boolean;
}

function weakMapGetV1<K extends object, V>(
  map: WeakMap<K, V>,
  key: K,
): V | undefined {
  return CapturedReflectApplyV1(CapturedWeakMapPrototypeGetV1, map, [key]) as
    | V
    | undefined;
}

function weakMapHasV1<K extends object, V>(
  map: WeakMap<K, V>,
  key: K,
): boolean {
  return CapturedReflectApplyV1(CapturedWeakMapPrototypeHasV1, map, [
    key,
  ]) as boolean;
}

function weakMapSetV1<K extends object, V>(
  map: WeakMap<K, V>,
  key: K,
  value: V,
): void {
  CapturedReflectApplyV1(CapturedWeakMapPrototypeSetV1, map, [key, value]);
}

function setFromValuesV1<T>(values: readonly T[]): Set<T> {
  const set = new CapturedSetV1<T>();
  for (let index = 0; index < values.length; index += 1) {
    setAddV1(set, values[index]!);
  }
  return set;
}

function weakSetAddV1<T extends object>(set: WeakSet<T>, value: T): void {
  CapturedReflectApplyV1(CapturedWeakSetPrototypeAddV1, set, [value]);
}

function weakSetHasV1<T extends object>(set: WeakSet<T>, value: T): boolean {
  return CapturedReflectApplyV1(CapturedWeakSetPrototypeHasV1, set, [
    value,
  ]) as boolean;
}

function regExpExecV1(pattern: RegExp, value: string): RegExpExecArray | null {
  return CapturedReflectApplyV1(CapturedRegExpPrototypeExecV1, pattern, [
    value,
  ]) as RegExpExecArray | null;
}

function regExpTestV1(pattern: RegExp, value: string): boolean {
  return regExpExecV1(pattern, value) !== null;
}

const REGISTRY_SIGNATURE_PATTERN =
  /^provider-registry-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const MANIFEST_SIGNATURE_PATTERN =
  /^provider-registry-manifest-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const BASE64URL_PREFIX = "base64url:";
const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * A hostile JSON container must not amplify a small logical-byte budget into a
 * descriptor map with millions of entries. 65,536 is sixteen times the largest
 * retained Manifest history (4,096) and comfortably exceeds every legitimate
 * per-Entry record collection (the largest is 256), while keeping reflection
 * work independently bounded before schema validation.
 */
const REGISTRY_MANIFEST_JSON_CONTAINER_ENTRY_HARD_CAP_V1 = 65_536;

/**
 * Direct-module test seam for the combined retained-history budget. It is not
 * re-exported from the package barrel. Subtraction avoids an overflowing sum
 * becoming an accidental pass if policy bounds ever grow beyond today's v1
 * limits.
 *
 * @internal
 */
export function isProviderRegistryRetainedTrustHistoryWithinBudgetInternalV1(
  retainedRootBytes: number,
  retainedRegistryBytes: number,
  maxRetainedTrustBytes: number,
): boolean {
  if (
    !Number.isSafeInteger(retainedRootBytes) ||
    !Number.isSafeInteger(retainedRegistryBytes) ||
    !Number.isSafeInteger(maxRetainedTrustBytes) ||
    retainedRootBytes < 0 ||
    retainedRegistryBytes < 0 ||
    maxRetainedTrustBytes < 0 ||
    retainedRootBytes > maxRetainedTrustBytes
  ) {
    return false;
  }
  return retainedRegistryBytes <= maxRetainedTrustBytes - retainedRootBytes;
}

type RegistryManifestHistoryStageV1 =
  | "history_input"
  | "history_limit"
  | "root_history"
  | "manifest_envelope"
  | "root_binding"
  | "manifest_predecessor"
  | "manifest_signature"
  | "member_set"
  | "registry_entry"
  | "record_signature"
  | "key_admission"
  | "key_history"
  | "material_closure"
  | "routing";

type RegistryManifestHistoryReasonV1 =
  | "schema_invalid"
  | "history_empty"
  | "history_generation_limit_exceeded"
  | "envelope_byte_limit_exceeded"
  | "history_total_byte_limit_exceeded"
  | "root_history_invalid"
  | "envelope_mismatch"
  | "root_pin_mismatch"
  | "root_generation_rollback"
  | "generation_not_contiguous"
  | "predecessor_pin_mismatch"
  | "signature_invalid"
  | "member_order_invalid"
  | "member_transition_invalid"
  | "entry_mismatch"
  | "entry_successor_invalid"
  | "record_history_invalid"
  | "active_record_invalid"
  | "revocation_invalid"
  | "point_admission_failed"
  | "public_key_material_alias"
  | "routing_invalid";

interface RegistryManifestHistoryDiagnosticFailureV1 {
  readonly ok: false;
  readonly stage: RegistryManifestHistoryStageV1;
  readonly reason: RegistryManifestHistoryReasonV1;
}

interface RegistryManifestHistoryDiagnosticSuccessV1 {
  readonly ok: true;
  readonly value: ProviderRegistryManifestHistoryValidationV1;
}

export type ProviderRegistryManifestHistoryDiagnosticResultV1 =
  | RegistryManifestHistoryDiagnosticSuccessV1
  | RegistryManifestHistoryDiagnosticFailureV1;

export interface ValidateProviderRegistryManifestHistoryV1Input {
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly bootstrapTrustBundle: ProviderBootstrapTrustBundleV1;
  readonly rootMetadataHistory: readonly ProviderRegistryRootMetadataEnvelopeV1[];
  readonly registryManifestHistory: readonly ProviderRegistryManifestEnvelopeV1[];
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
}

type ProviderTrustHistoryPolicyV1 =
  ProviderBootstrapTrustBundleV1["providerTrustHistoryPolicy"];

export interface ProviderRegistryManifestHistoryValidationV1 {
  /** Registry history is still missing Acceptance/Catalog authorization. */
  readonly authority: "none_registry_structure_and_history_only";
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly currentRootMetadata: ProviderRegistryRootMetadataPinV1;
  readonly currentRegistryManifest: ProviderRegistryManifestPinV1;
  readonly retainedRootMetadataGenerationCount: number;
  readonly retainedRegistryManifestGenerationCount: number;
  readonly retainedRootMetadataCanonicalBytes: number;
  readonly retainedRegistryManifestCanonicalBytes: number;
  readonly retainedTrustHistoryCanonicalBytes: number;
  readonly rootMetadataHistory: readonly ProviderRegistryRootMetadataEnvelopeV1[];
  readonly registryManifestHistory: readonly ProviderRegistryManifestEnvelopeV1[];
}

export class ProviderRegistryManifestHistoryValidationError extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider registry manifest history validation failed");
    this.name = "ProviderRegistryManifestHistoryValidationError";
  }
}

class RegistryManifestHistoryDiagnosticSignal extends Error {
  constructor(
    readonly stage: RegistryManifestHistoryStageV1,
    readonly reason: RegistryManifestHistoryReasonV1,
  ) {
    super("registry manifest history diagnostic");
  }
}

function fail(
  stage: RegistryManifestHistoryStageV1,
  reason: RegistryManifestHistoryReasonV1,
): never {
  throw new RegistryManifestHistoryDiagnosticSignal(stage, reason);
}

function utf8BytewiseCompare(left: string, right: string): number {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.min(leftBytes.byteLength, rightBytes.byteLength);
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.byteLength - rightBytes.byteLength;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function canonicalJsonEqual(left: unknown, right: unknown): boolean {
  return bytesEqual(
    canonicalizeJcsSafeIntegerUtf8V1(left),
    canonicalizeJcsSafeIntegerUtf8V1(right),
  );
}

function deepFreezeJson<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of CapturedObjectValuesV1(value)) deepFreezeJson(child);
    CapturedObjectFreezeV1(value);
  }
  return value;
}

function canonicalJsonStringByteLength(value: string): number {
  let bytes = 2;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit === 0x22 || codeUnit === 0x5c) {
      bytes += 2;
    } else if (codeUnit <= 0x1f) {
      bytes +=
        codeUnit === 0x08 ||
        codeUnit === 0x09 ||
        codeUnit === 0x0a ||
        codeUnit === 0x0c ||
        codeUnit === 0x0d
          ? 2
          : 6;
    } else if (codeUnit <= 0x7f) {
      bytes += 1;
    } else if (codeUnit <= 0x7ff) {
      bytes += 2;
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff)) {
        throw new TypeError("manifest contains an unpaired high surrogate");
      }
      bytes += 4;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new TypeError("manifest contains an unpaired low surrogate");
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function readOwnKeysBoundedV1(
  value: object,
  maxOwnKeyCount: number,
): readonly PropertyKey[] {
  let keys: readonly PropertyKey[];
  try {
    // JavaScript has no streaming own-key reflection primitive. A Proxy may do
    // arbitrary work inside this single trap, but the validator never asks for
    // a full PropertyDescriptorMap and rejects an oversized returned key set
    // before requesting any individual descriptor.
    keys = CapturedReflectOwnKeysV1(value);
  } catch {
    throw new TypeError("manifest envelope own keys could not be inspected");
  }
  if (keys.length > maxOwnKeyCount) {
    return fail("history_limit", "envelope_byte_limit_exceeded");
  }
  return keys;
}

function readDataPropertyDescriptorV1(
  value: object,
  key: PropertyKey,
  message: string,
  expectedEnumerable = true,
): PropertyDescriptor & { readonly value: unknown } {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = CapturedObjectGetOwnPropertyDescriptorV1(value, key);
  } catch {
    throw new TypeError(message);
  }
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    descriptor.enumerable !== expectedEnumerable
  ) {
    throw new TypeError(message);
  }
  return descriptor as PropertyDescriptor & { readonly value: unknown };
}

function assertExactDenseArrayOwnKeysV1(
  keys: readonly PropertyKey[],
  length: number,
  message: string,
): void {
  if (keys.length !== length + 1) throw new TypeError(message);
  const indices = new CapturedSetV1<number>();
  let sawLength = false;
  for (const key of keys) {
    if (typeof key !== "string") throw new TypeError(message);
    if (key === "length") {
      if (sawLength) throw new TypeError(message);
      sawLength = true;
      continue;
    }
    if (!regExpTestV1(/^(?:0|[1-9][0-9]*)$/u, key)) {
      throw new TypeError(message);
    }
    const index = Number(key);
    if (
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= length ||
      String(index) !== key ||
      setHasV1(indices, index)
    ) {
      throw new TypeError(message);
    }
    setAddV1(indices, index);
  }
  if (!sawLength || indices.size !== length) throw new TypeError(message);
}

function snapshotBoundedJsonV1(input: unknown, maxCanonicalBytes: number): unknown {
  const seen = new CapturedWeakSetV1<object>();
  let chargedBytes = 0;

  function charge(bytes: number): void {
    chargedBytes += bytes;
    if (chargedBytes > maxCanonicalBytes) {
      return fail("history_limit", "envelope_byte_limit_exceeded");
    }
  }

  function snapshot(value: unknown): unknown {
    if (value === null) {
      charge(4);
      return null;
    }
    if (typeof value === "string") {
      charge(canonicalJsonStringByteLength(value));
      return value;
    }
    if (typeof value === "boolean") {
      charge(value ? 4 : 5);
      return value;
    }
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value) || CapturedObjectIsV1(value, -0)) {
        throw new TypeError("manifest numbers must be safe non-negative-zero integers");
      }
      charge(String(value).length);
      return value;
    }
    if (typeof value !== "object") {
      throw new TypeError("manifest envelope must be JSON data");
    }
    if (weakSetHasV1(seen, value)) {
      throw new TypeError("manifest envelope must be a JSON tree");
    }
    weakSetAddV1(seen, value);

    const isArray = CapturedArrayIsArrayV1(value);
    let prototype: object | null;
    try {
      prototype = CapturedObjectGetPrototypeOfV1(value) as object | null;
    } catch (error) {
      if (error instanceof RegistryManifestHistoryDiagnosticSignal) throw error;
      throw new TypeError("manifest envelope must be plain JSON data");
    }
    if (
      (isArray && prototype !== Array.prototype) ||
      (!isArray && prototype !== Object.prototype && prototype !== null)
    ) {
      throw new TypeError("manifest envelope must use plain JSON containers");
    }

    if (isArray) {
      const earlyLengthDescriptor = readDataPropertyDescriptorV1(
        value,
        "length",
        "manifest envelope array has an invalid length",
        false,
      );
      if (
        earlyLengthDescriptor.enumerable !== false ||
        !Number.isSafeInteger(earlyLengthDescriptor.value) ||
        earlyLengthDescriptor.value < 0 ||
        earlyLengthDescriptor.value >
          REGISTRY_MANIFEST_JSON_CONTAINER_ENTRY_HARD_CAP_V1
      ) {
        return fail("history_limit", "envelope_byte_limit_exceeded");
      }
      const length = earlyLengthDescriptor.value as number;
      const keys = readOwnKeysBoundedV1(
        value,
        REGISTRY_MANIFEST_JSON_CONTAINER_ENTRY_HARD_CAP_V1 + 1,
      );
      assertExactDenseArrayOwnKeysV1(
        keys,
        length,
        "manifest envelope arrays must be dense data arrays",
      );
      const stableLengthDescriptor = readDataPropertyDescriptorV1(
        value,
        "length",
        "manifest envelope array has an invalid length",
        false,
      );
      if (
        stableLengthDescriptor.enumerable !== false ||
        stableLengthDescriptor.value !== length
      ) {
        throw new TypeError("manifest envelope array length changed during snapshot");
      }
      charge(2 + Math.max(0, length - 1));
      const output = new CapturedArrayV1<unknown>(length);
      for (let index = 0; index < length; index += 1) {
        const descriptor = readDataPropertyDescriptorV1(
          value,
          String(index),
          "manifest envelope arrays must be dense data arrays",
        );
        output[index] = snapshot(descriptor.value);
      }
      return output;
    }

    const output: Record<string, unknown> = {};
    const ownKeys = readOwnKeysBoundedV1(
      value,
      REGISTRY_MANIFEST_JSON_CONTAINER_ENTRY_HARD_CAP_V1,
    );
    if (arraySomeV1(ownKeys, (key) => typeof key !== "string")) {
      throw new TypeError("manifest envelope must not contain symbols");
    }
    const keys = ownKeys as readonly string[];
    charge(2 + Math.max(0, keys.length - 1));
    for (const key of keys) {
      const descriptor = readDataPropertyDescriptorV1(
        value,
        key,
        "manifest properties must be enumerable data properties",
      );
      charge(canonicalJsonStringByteLength(key) + 1);
      CapturedObjectDefinePropertyV1(output, key, {
        value: snapshot(descriptor.value),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return output;
  }

  return snapshot(input);
}

function snapshotExactInputV1(
  input: unknown,
): ValidateProviderRegistryManifestHistoryV1Input {
  if (
    input === null ||
    typeof input !== "object" ||
    CapturedArrayIsArrayV1(input)
  ) {
    throw new TypeError("registry manifest history input must be an object");
  }
  let prototype: object | null;
  let ownKeys: readonly PropertyKey[];
  try {
    prototype = CapturedObjectGetPrototypeOfV1(input) as object | null;
    ownKeys = CapturedReflectOwnKeysV1(input);
  } catch {
    throw new TypeError("registry manifest history input must be a data object");
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    arraySomeV1(ownKeys, (key) => typeof key !== "string")
  ) {
    throw new TypeError("registry manifest history input must be a plain data object");
  }
  const expectedKeys = [
    "bootstrapTrustBundle",
    "installationIdentityGenerationId",
    "registryManifestHistory",
    "rootMetadataHistory",
    "strictCryptoCapability",
  ];
  const keys = arraySortV1([...(ownKeys as readonly string[])]);
  if (
    keys.length !== expectedKeys.length ||
    arraySomeV1(keys, (key, index) => key !== expectedKeys[index])
  ) {
    throw new TypeError("registry manifest history input has unexpected fields");
  }
  const descriptors: Record<string, PropertyDescriptor & { readonly value: unknown }> = {};
  for (const key of expectedKeys) {
    descriptors[key] = readDataPropertyDescriptorV1(
      input,
      key,
      "registry manifest history input must use data properties",
    );
  }
  return {
    installationIdentityGenerationId: descriptors
      .installationIdentityGenerationId!.value as InstallationIdentityGenerationIdV1,
    bootstrapTrustBundle: descriptors.bootstrapTrustBundle!
      .value as ProviderBootstrapTrustBundleV1,
    rootMetadataHistory: descriptors.rootMetadataHistory!
      .value as readonly ProviderRegistryRootMetadataEnvelopeV1[],
    registryManifestHistory: descriptors.registryManifestHistory!
      .value as readonly ProviderRegistryManifestEnvelopeV1[],
    strictCryptoCapability: descriptors.strictCryptoCapability!
      .value as ProviderStrictEd25519OpaqueCapabilityV1,
  };
}

function snapshotManifestHistoryCandidatesV1(
  input: unknown,
  maxGenerationCount: number,
): readonly unknown[] {
  let length: number;
  try {
    if (
      !CapturedArrayIsArrayV1(input) ||
      CapturedObjectGetPrototypeOfV1(input) !== Array.prototype
    ) {
      throw new TypeError("registry manifest history must be a plain array");
    }
    const earlyLength = readDataPropertyDescriptorV1(
      input,
      "length",
      "registry manifest history has an invalid length",
      false,
    );
    if (
      !Number.isSafeInteger(earlyLength.value) ||
      earlyLength.value < 0
    ) {
      throw new TypeError("registry manifest history has an invalid length");
    }
    if (earlyLength.value > maxGenerationCount) {
      return fail("history_limit", "history_generation_limit_exceeded");
    }
    length = earlyLength.value as number;
    const ownKeys = readOwnKeysBoundedV1(input, maxGenerationCount + 1);
    assertExactDenseArrayOwnKeysV1(
      ownKeys,
      length,
      "registry manifest history must be a dense data array",
    );
    const stableLength = readDataPropertyDescriptorV1(
      input,
      "length",
      "registry manifest history has an invalid length",
      false,
    );
    if (stableLength.value !== length) {
      throw new TypeError(
        "registry manifest history length changed during snapshot",
      );
    }
  } catch (error) {
    if (error instanceof RegistryManifestHistoryDiagnosticSignal) throw error;
    throw new TypeError("registry manifest history must be a plain array");
  }
  const snapshot = new Array<unknown>(length);
  for (let index = 0; index < length; index += 1) {
    const descriptor = readDataPropertyDescriptorV1(
      input,
      String(index),
      "registry manifest history must be a dense data array",
    );
    snapshot[index] = descriptor.value;
  }
  return CapturedObjectFreezeV1(snapshot);
}

function decodeCanonicalPublicKeyBytes32V1(value: string): Uint8Array {
  if (!value.startsWith(BASE64URL_PREFIX)) {
    throw new TypeError("public key bytes have the wrong prefix");
  }
  const body = value.slice(BASE64URL_PREFIX.length);
  const decoded = new Uint8Array(32);
  let accumulator = 0;
  let availableBits = 0;
  let offset = 0;
  for (const character of body) {
    const digit = BASE64URL_ALPHABET.indexOf(character);
    if (digit < 0) throw new TypeError("public key bytes are not base64url");
    accumulator = (accumulator << 6) | digit;
    availableBits += 6;
    if (availableBits >= 8) {
      availableBits -= 8;
      if (offset >= decoded.byteLength) {
        throw new TypeError("public key bytes exceed raw32");
      }
      decoded[offset] = (accumulator >>> availableBits) & 0xff;
      offset += 1;
      accumulator &= (1 << availableBits) - 1;
    }
  }
  if (offset !== 32 || availableBits !== 2 || accumulator !== 0) {
    throw new TypeError("public key bytes are not canonical raw32");
  }
  return decoded;
}

function lowerHexToBytesV1(hex: string): Uint8Array {
  if (!regExpTestV1(/^(?:[0-9a-f]{2})+$/u, hex)) {
    throw new TypeError("signature is not lowercase octets");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function parseRootSignatureV1(
  signature: string,
  pattern: RegExp,
): { readonly rootKeyId: string; readonly signatureBytes: Uint8Array } {
  const match = regExpExecV1(pattern, signature);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    throw new TypeError("invalid registry root signature wire");
  }
  return {
    rootKeyId: match[1],
    signatureBytes: lowerHexToBytesV1(match[2]),
  };
}

function requireRootSignatureV1(
  signature: string,
  pattern: RegExp,
  expectedRoot: ProviderRegistryRootPublicKeyV1,
  message: Uint8Array,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
  stage: RegistryManifestHistoryStageV1,
): Promise<void> {
  const operation = (async (): Promise<void> => {
    let parsed: ReturnType<typeof parseRootSignatureV1>;
    try {
      parsed = parseRootSignatureV1(signature, pattern);
    } catch {
      return fail(stage, "signature_invalid");
    }
    if (parsed.rootKeyId !== expectedRoot.rootKeyId) {
      return fail(stage, "signature_invalid");
    }
    try {
      if (
        !(await verifyRawEd25519WithCapabilityV1(
          capability,
          decodeCanonicalPublicKeyBytes32V1(expectedRoot.publicKeyBytes),
          message,
          parsed.signatureBytes,
        ))
      ) {
        return fail(stage, "signature_invalid");
      }
    } catch {
      return fail(stage, "signature_invalid");
    }
  })();
  return hardenProviderPointPromiseV1(operation);
}

function resolveRetainedRegistrySignerV1(
  signature: string,
  rootByKeyId: ReadonlyMap<string, ProviderRegistryRootMetadataEnvelopeV1>,
  requiredCurrentRootKeyId?: string,
): ProviderRegistryRootPublicKeyV1 {
  let parsed: ReturnType<typeof parseRootSignatureV1>;
  try {
    parsed = parseRootSignatureV1(signature, REGISTRY_SIGNATURE_PATTERN);
  } catch {
    return fail("record_signature", "signature_invalid");
  }
  if (
    requiredCurrentRootKeyId !== undefined &&
    parsed.rootKeyId !== requiredCurrentRootKeyId
  ) {
    return fail("record_signature", "signature_invalid");
  }
  const envelope = mapGetV1(rootByKeyId, parsed.rootKeyId);
  if (envelope === undefined) {
    return fail("record_signature", "signature_invalid");
  }
  return envelope.payload.activeRoot;
}

function rootPinKeyV1(pin: ProviderRegistryRootMetadataPinV1): string {
  return `${pin.rootGeneration}:${pin.rootKeyId}:${pin.contentDigest}`;
}

function rootPinForEnvelopeV1(
  envelope: ProviderRegistryRootMetadataEnvelopeV1,
): ProviderRegistryRootMetadataPinV1 {
  return {
    locatorProfile: "installation_provider_registry_root_metadata_v1",
    rootGeneration: envelope.rootGeneration,
    rootKeyId: envelope.rootKeyId,
    contentDigest: envelope.contentDigest,
  } as ProviderRegistryRootMetadataPinV1;
}

function registryManifestPinV1(
  envelope: ProviderRegistryManifestEnvelopeV1,
): ProviderRegistryManifestPinV1 {
  return ProviderRegistryManifestPinV1Schema.parse({
    locatorProfile: "installation_provider_registry_manifest_v1",
    manifestGeneration: envelope.payload.manifestGeneration,
    generationId: envelope.generationId,
    contentDigest: envelope.contentDigest,
  });
}

type EnabledMemberV1 = Extract<
  ProviderRegistryManifestMemberV1,
  { readonly disposition: "enabled" }
>;
type RevokedMemberV1 = Extract<
  ProviderRegistryManifestMemberV1,
  { readonly disposition: "revoked" }
>;

function enabledMembersV1(
  manifest: ProviderRegistryManifestV1,
): readonly EnabledMemberV1[] {
  return arrayFilterV1(
    manifest.members,
    (member): member is EnabledMemberV1 => member.disposition === "enabled",
  );
}

function memberMapV1(
  manifest: ProviderRegistryManifestV1,
): ReadonlyMap<string, ProviderRegistryManifestMemberV1> {
  return mapFromEntriesV1(
    arrayMapV1(manifest.members, (member) => [member.providerId, member] as const),
  );
}

function assertSortedUniqueStringsV1(
  values: readonly string[],
  stage: RegistryManifestHistoryStageV1 = "member_set",
  reason: RegistryManifestHistoryReasonV1 = "member_order_invalid",
): void {
  for (let index = 1; index < values.length; index += 1) {
    if (utf8BytewiseCompare(values[index - 1]!, values[index]!) >= 0) {
      return fail(stage, reason);
    }
  }
}

function assertSortedUniqueNumbersV1(values: readonly number[]): void {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1]! >= values[index]!) {
      return fail("key_history", "record_history_invalid");
    }
  }
}

function compareStringTupleV1(
  left: readonly string[],
  right: readonly string[],
): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const order = utf8BytewiseCompare(left[index]!, right[index]!);
    if (order !== 0) return order;
  }
  return left.length - right.length;
}

function assertStrictlyIncreasingRecordsV1<T>(
  records: readonly T[],
  compare: (left: T, right: T) => number,
): void {
  for (let index = 1; index < records.length; index += 1) {
    if (compare(records[index - 1]!, records[index]!) >= 0) {
      return fail("key_history", "record_history_invalid");
    }
  }
}

interface MaterialOwnerV1 {
  readonly identity: string;
  readonly canonicalRecord?: Uint8Array;
}

interface RegistryHistoryStateV1 {
  readonly materialOwners: Map<string, MaterialOwnerV1>;
  readonly providerKeyRecords: Map<string, Uint8Array>;
  readonly bindingRecords: Map<string, Uint8Array>;
  readonly approverKeyRecords: Map<string, Uint8Array>;
  readonly runtimeAttestations: Map<string, Uint8Array>;
  readonly registryEntries: Map<string, Uint8Array>;
  readonly revocationIdentities: Set<string>;
}

declare const providerRegistryProspectiveEntryTemporaryAdmissionCapabilityBrandV1:
  unique symbol;

/**
 * Opaque, process-local, one-shot authority to perform one read-only
 * prospective Entry admission against one already verified retained Registry
 * cut. It is intentionally absent from the package barrel/export map.
 */
export interface ProviderRegistryProspectiveEntryTemporaryAdmissionCapabilityInternalV1 {
  readonly [providerRegistryProspectiveEntryTemporaryAdmissionCapabilityBrandV1]: true;
}

export interface ProviderRegistryProspectiveEntryTemporaryAdmissionInputInternalV1 {
  readonly prospectiveRegistryEntryContentDigest: string;
  readonly prospectiveRegistryEntry: StoreDurableObjectProviderRegistryEntryV1;
}

export interface ProviderRegistryProspectiveEntryTemporaryAdmissionValidationInternalV1 {
  readonly authority: "none_registry_prospective_entry_temporary_admission_only";
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly providerId: StoreDurableObjectProviderRegistryEntryV1["providerId"];
  readonly registryEntryContentDigest: ReturnType<
    typeof deriveStoreDurableObjectProviderRegistryEntryContentDigestV1
  >;
  readonly registryGeneration: 1;
  readonly copiedRetainedStateCollectionCount: 7;
  readonly retainedStateMutationCount: 0;
}

export type ProviderRegistryProspectiveEntryTemporaryAdmissionDiagnosticResultInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value: ProviderRegistryProspectiveEntryTemporaryAdmissionValidationInternalV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage: RegistryManifestHistoryStageV1;
      readonly reason: RegistryManifestHistoryReasonV1;
    }>;

interface ProviderRegistryProspectiveEntryTemporaryAdmissionContextInternalV1 {
  readonly closureIdentity: ProviderRegistryManifestHistoryValidationV1;
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
  readonly manifestHistory: readonly ProviderRegistryManifestEnvelopeV1[];
  readonly currentManifest: ProviderRegistryManifestV1;
  readonly currentRoot: ProviderRegistryRootPublicKeyV1;
  readonly rootByKeyId: ReadonlyMap<
    string,
    ProviderRegistryRootMetadataEnvelopeV1
  >;
  readonly policy: ProviderTrustHistoryPolicyV1;
  readonly retainedState: RegistryHistoryStateV1;
}

const prospectiveEntryTemporaryAdmissionContextsByClosureInternalV1 =
  new CapturedWeakMapV1<
    object,
    ProviderRegistryProspectiveEntryTemporaryAdmissionContextInternalV1
  >();
const prospectiveEntryTemporaryAdmissionContextsByCapabilityInternalV1 =
  new CapturedWeakMapV1<
    object,
    ProviderRegistryProspectiveEntryTemporaryAdmissionContextInternalV1
  >();

function cloneMapV1<K, V>(source: ReadonlyMap<K, V>): Map<K, V> {
  const clone = new CapturedMapV1<K, V>();
  mapForEachV1(source, (value, key) => {
    mapSetV1(clone, key, value);
  });
  return clone;
}

function cloneSetV1<T>(source: ReadonlySet<T>): Set<T> {
  const clone = new CapturedSetV1<T>();
  setForEachV1(source, (value) => {
    setAddV1(clone, value);
  });
  return clone;
}

/** Clone exactly the seven retained material/history collections. */
function cloneRegistryHistoryStateForTemporaryAdmissionInternalV1(
  source: RegistryHistoryStateV1,
): RegistryHistoryStateV1 {
  return {
    materialOwners: cloneMapV1(source.materialOwners),
    providerKeyRecords: cloneMapV1(source.providerKeyRecords),
    bindingRecords: cloneMapV1(source.bindingRecords),
    approverKeyRecords: cloneMapV1(source.approverKeyRecords),
    runtimeAttestations: cloneMapV1(source.runtimeAttestations),
    registryEntries: cloneMapV1(source.registryEntries),
    revocationIdentities: cloneSetV1(source.revocationIdentities),
  };
}

function registerProviderRegistryProspectiveEntryTemporaryAdmissionContextInternalV1(
  context: ProviderRegistryProspectiveEntryTemporaryAdmissionContextInternalV1,
): void {
  if (
    weakMapHasV1(
      prospectiveEntryTemporaryAdmissionContextsByClosureInternalV1,
      context.closureIdentity,
    )
  ) {
    throw new TypeError("prospective Registry admission context already exists");
  }
  weakMapSetV1(
    prospectiveEntryTemporaryAdmissionContextsByClosureInternalV1,
    context.closureIdentity,
    context,
  );
}

/**
 * Claim the private retained-state seam associated with one prepared Registry
 * closure and mint one zero-own-key capability. A wrong binding cannot consume
 * the closure-side registration.
 *
 * @internal
 */
export function mintProviderRegistryProspectiveEntryTemporaryAdmissionCapabilityInternalV1(
  closureIdentity: ProviderRegistryManifestHistoryValidationV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): ProviderRegistryProspectiveEntryTemporaryAdmissionCapabilityInternalV1 {
  if (
    closureIdentity === null ||
    (typeof closureIdentity !== "object" &&
      typeof closureIdentity !== "function")
  ) {
    throw new TypeError("prospective Registry admission closure is invalid");
  }
  const context = weakMapGetV1(
    prospectiveEntryTemporaryAdmissionContextsByClosureInternalV1,
    closureIdentity,
  );
  if (context === undefined) {
    throw new TypeError("prospective Registry admission closure is unavailable");
  }
  if (
    context.closureIdentity !== closureIdentity ||
    context.strictCryptoCapability !== strictCryptoCapability
  ) {
    throw new TypeError("prospective Registry admission binding is invalid");
  }
  if (
    !weakMapDeleteV1(
      prospectiveEntryTemporaryAdmissionContextsByClosureInternalV1,
      closureIdentity,
    )
  ) {
    throw new TypeError("prospective Registry admission closure is unavailable");
  }
  const capability = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderRegistryProspectiveEntryTemporaryAdmissionCapabilityInternalV1;
  weakMapSetV1(
    prospectiveEntryTemporaryAdmissionContextsByCapabilityInternalV1,
    capability,
    context,
  );
  return capability;
}

function registerMaterialV1(
  state: RegistryHistoryStateV1,
  publicKeyBytes: string,
  identity: string,
  record?: unknown,
): boolean {
  const canonicalRecord =
    record === undefined
      ? undefined
      : canonicalizeJcsSafeIntegerUtf8V1(record);
  const existing = mapGetV1(state.materialOwners, publicKeyBytes);
  if (existing === undefined) {
    mapSetV1(state.materialOwners, publicKeyBytes, {
      identity,
      canonicalRecord,
    });
    return true;
  }
  if (
    existing.identity !== identity ||
    existing.canonicalRecord === undefined ||
    canonicalRecord === undefined ||
    !bytesEqual(existing.canonicalRecord, canonicalRecord)
  ) {
    return fail("material_closure", "public_key_material_alias");
  }
  return false;
}

function recordIdentityV1(parts: readonly (string | number)[]): string {
  return JSON.stringify(parts);
}

function assertRecordIdentityV1(
  records: Map<string, Uint8Array>,
  identity: string,
  record: unknown,
): boolean {
  const canonical = canonicalizeJcsSafeIntegerUtf8V1(record);
  const existing = mapGetV1(records, identity);
  if (existing === undefined) {
    mapSetV1(records, identity, canonical);
    return true;
  }
  if (!bytesEqual(existing, canonical)) {
    return fail("key_history", "record_history_invalid");
  }
  return false;
}

async function admitPublicKeyV1(
  publicKeyBytes: string,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<void> {
  try {
    if (
      !(await validateProviderStrictEd25519PointWithCapabilityV1(
        capability,
        decodeCanonicalPublicKeyBytes32V1(publicKeyBytes),
      ))
    ) {
      return fail("key_admission", "point_admission_failed");
    }
  } catch {
    return fail("key_admission", "point_admission_failed");
  }
}

function assertRecordAppendOnlyV1<T>(
  previous: readonly T[],
  current: readonly T[],
  identity: (record: T) => string,
): void {
  const currentByIdentity = mapFromEntriesV1(
    arrayMapV1(current, (record) => [identity(record), record] as const),
  );
  for (const record of previous) {
    const successor = mapGetV1(currentByIdentity, identity(record));
    if (successor === undefined || !canonicalJsonEqual(record, successor)) {
      return fail("key_history", "record_history_invalid");
    }
  }
}

function assertRoutingShapeV1(manifest: ProviderRegistryManifestV1): void {
  const enabled = enabledMembersV1(manifest);
  if (manifest.routing.state === "steady") {
    if (enabled.length !== 1) return fail("routing", "routing_invalid");
    return;
  }
  if (
    enabled.length !== 2 ||
    manifest.routing.sourceProviderId ===
      manifest.routing.destinationProviderId ||
    (manifest.routing.activeForMigrationWrites !==
      manifest.routing.sourceProviderId &&
      manifest.routing.activeForMigrationWrites !==
        manifest.routing.destinationProviderId) ||
    (manifest.routing.phase === "prepared" &&
      manifest.routing.activeForMigrationWrites !==
        manifest.routing.sourceProviderId) ||
    (manifest.routing.phase === "source_drained" &&
      manifest.routing.activeForMigrationWrites !==
        manifest.routing.destinationProviderId)
  ) {
    return fail("routing", "routing_invalid");
  }
  const enabledIds = setFromValuesV1(
    arrayMapV1(enabled, ({ providerId }) => providerId),
  );
  if (
    !setHasV1(enabledIds, manifest.routing.sourceProviderId) ||
    !setHasV1(enabledIds, manifest.routing.destinationProviderId)
  ) {
    return fail("routing", "routing_invalid");
  }
}

function assertRoutingSuccessorV1(
  previous: ProviderRegistryManifestV1,
  current: ProviderRegistryManifestV1,
): void {
  if (previous.routing.state === "steady") {
    const previousProviderId = enabledMembersV1(previous)[0]!.providerId;
    if (current.routing.state === "steady") {
      if (enabledMembersV1(current)[0]!.providerId !== previousProviderId) {
        return fail("routing", "routing_invalid");
      }
      return;
    }
    if (
      current.routing.phase !== "prepared" ||
      current.routing.sourceProviderId !== previousProviderId ||
      current.routing.destinationProviderId === previousProviderId ||
      current.routing.activeForMigrationWrites !== previousProviderId
    ) {
      return fail("routing", "routing_invalid");
    }
    return;
  }
  if (current.routing.state === "steady") {
    if (
      previous.routing.phase !== "source_drained" ||
      previous.routing.activeForMigrationWrites !==
        previous.routing.destinationProviderId
    ) {
      return fail("routing", "routing_invalid");
    }
    const currentMembers = memberMapV1(current);
    const source = mapGetV1(currentMembers, previous.routing.sourceProviderId);
    const destination = mapGetV1(
      currentMembers,
      previous.routing.destinationProviderId,
    );
    if (
      source?.disposition !== "revoked" ||
      source.reason !== "migration_completed" ||
      destination?.disposition !== "enabled"
    ) {
      return fail("routing", "routing_invalid");
    }
    return;
  }
  if (
    current.routing.migrationId !== previous.routing.migrationId ||
    current.routing.sourceProviderId !== previous.routing.sourceProviderId ||
    current.routing.destinationProviderId !==
      previous.routing.destinationProviderId
  ) {
    return fail("routing", "routing_invalid");
  }
  const phaseOrdinal = {
    prepared: 0,
    rebinding: 1,
    source_drained: 2,
  } as const;
  if (
    phaseOrdinal[current.routing.phase] <
      phaseOrdinal[previous.routing.phase] ||
    phaseOrdinal[current.routing.phase] >
      phaseOrdinal[previous.routing.phase] + 1
  ) {
    return fail("routing", "routing_invalid");
  }
  if (
    (previous.routing.activeForMigrationWrites ===
      previous.routing.destinationProviderId &&
      current.routing.activeForMigrationWrites ===
        current.routing.sourceProviderId) ||
    (current.routing.phase === "prepared" &&
      current.routing.activeForMigrationWrites !==
        current.routing.sourceProviderId) ||
    (current.routing.phase === "source_drained" &&
      current.routing.activeForMigrationWrites !==
        current.routing.destinationProviderId)
  ) {
    return fail("routing", "routing_invalid");
  }
}

function assertTombstoneV1(
  previous: EnabledMemberV1,
  current: RevokedMemberV1,
  manifestGeneration: number,
): void {
  if (
    current.revokedAtManifestGeneration !== manifestGeneration ||
    current.lastEnabledRegistryEntryContentDigest !==
      previous.registryEntryContentDigest
  ) {
    return fail("member_set", "member_transition_invalid");
  }
}

function assertEntrySuccessorV1(
  previous: EnabledMemberV1,
  current: EnabledMemberV1,
): void {
  if (previous.registryEntryContentDigest === current.registryEntryContentDigest) {
    if (!canonicalJsonEqual(previous.registryEntry, current.registryEntry)) {
      return fail("registry_entry", "entry_successor_invalid");
    }
    return;
  }
  const previousEntry = previous.registryEntry;
  const currentEntry = current.registryEntry;
  if (
    currentEntry.registryGeneration !== previousEntry.registryGeneration + 1 ||
    !("predecessorRegistryEntryContentDigest" in currentEntry) ||
    currentEntry.predecessorRegistryEntryContentDigest !==
      previous.registryEntryContentDigest ||
    currentEntry.providerId !== previousEntry.providerId ||
    currentEntry.semanticProviderPolicyDigest !==
      previousEntry.semanticProviderPolicyDigest
  ) {
    return fail("registry_entry", "entry_successor_invalid");
  }
  if (
    previousEntry.runtimeAttestation.contentDigest ===
    currentEntry.runtimeAttestation.contentDigest
  ) {
    if (
      !canonicalJsonEqual(
        previousEntry.runtimeAttestation,
        currentEntry.runtimeAttestation,
      )
    ) {
      return fail("registry_entry", "entry_successor_invalid");
    }
  } else if (
    currentEntry.runtimeAttestation.payload.attestationGeneration !==
    previousEntry.runtimeAttestation.payload.attestationGeneration + 1
  ) {
    return fail("registry_entry", "entry_successor_invalid");
  }
  assertRecordAppendOnlyV1(
    previousEntry.verificationKeys.publicKeyRecords,
    currentEntry.verificationKeys.publicKeyRecords,
    (record) =>
      recordIdentityV1([record.providerId, record.usage, record.keyId]),
  );
  assertRecordAppendOnlyV1(
    previousEntry.verificationKeys.bindingDerivationGenerationRecords,
    currentEntry.verificationKeys.bindingDerivationGenerationRecords,
    (record) => recordIdentityV1([record.providerId, record.generation]),
  );
  assertRecordAppendOnlyV1(
    previousEntry.verificationKeys.compromisedRevokedKeyIds,
    currentEntry.verificationKeys.compromisedRevokedKeyIds,
    (keyId) => keyId,
  );
  assertRecordAppendOnlyV1(
    previousEntry.verificationKeys
      .compromisedRevokedBindingDerivationGenerations,
    currentEntry.verificationKeys
      .compromisedRevokedBindingDerivationGenerations,
    (generation) => String(generation),
  );
  assertRecordAppendOnlyV1(
    previousEntry.feasibilityApprovalKeys.publicKeyRecords,
    currentEntry.feasibilityApprovalKeys.publicKeyRecords,
    (record) => recordIdentityV1([record.role, record.keyId]),
  );
  assertRecordAppendOnlyV1(
    previousEntry.feasibilityApprovalKeys.compromisedRevokedKeyIds,
    currentEntry.feasibilityApprovalKeys.compromisedRevokedKeyIds,
    (keyId) => keyId,
  );
}

function verifyRegistrySignedRecordV1(
  signature: string,
  root: ProviderRegistryRootPublicKeyV1,
  message: Uint8Array,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<void> {
  return requireRootSignatureV1(
    signature,
    REGISTRY_SIGNATURE_PATTERN,
    root,
    message,
    capability,
    "record_signature",
  );
}

async function validateVerificationKeyRecordV1(
  record: StoreDurableObjectProviderVerificationPublicKeyV1,
  entry: StoreDurableObjectProviderRegistryEntryV1,
  currentRoot: ProviderRegistryRootPublicKeyV1,
  rootByKeyId: ReadonlyMap<string, ProviderRegistryRootMetadataEnvelopeV1>,
  state: RegistryHistoryStateV1,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<void> {
  const identity = recordIdentityV1([
    record.providerId,
    record.usage,
    record.keyId,
  ]);
  const firstAppearance = assertRecordIdentityV1(
    state.providerKeyRecords,
    identity,
    record,
  );
  if (
    record.providerId !== entry.providerId ||
    record.registryGenerationIntroduced > entry.registryGeneration ||
    deriveStoreProviderVerificationKeyIdV1({
      providerId: record.providerId,
      usage: record.usage,
      publicKeyBytes: record.publicKeyBytes,
    }) !== record.keyId ||
    deriveProviderEd25519PublicKeyDigestInternalV1(record.publicKeyBytes) !==
      record.publicKeyDigest
  ) {
    return fail("key_history", "record_history_invalid");
  }
  registerMaterialV1(state, record.publicKeyBytes, `provider:${identity}`, record);
  if (!firstAppearance) {
    return;
  }
  if (record.registryGenerationIntroduced !== entry.registryGeneration) {
    return fail("key_history", "record_history_invalid");
  }
  const signer = resolveRetainedRegistrySignerV1(
    record.registrySignature,
    rootByKeyId,
    currentRoot.rootKeyId,
  );
  await hardenProviderPointPromiseV1(
    admitPublicKeyV1(record.publicKeyBytes, capability),
  );
  await verifyRegistrySignedRecordV1(
    record.registrySignature,
    signer,
    createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1(
      record,
      signer.rootKeyId,
    ),
    capability,
  );
}

async function validateBindingRecordV1(
  record: StoreDurableObjectProviderBindingDerivationGenerationV1,
  entry: StoreDurableObjectProviderRegistryEntryV1,
  currentRoot: ProviderRegistryRootPublicKeyV1,
  rootByKeyId: ReadonlyMap<string, ProviderRegistryRootMetadataEnvelopeV1>,
  state: RegistryHistoryStateV1,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<void> {
  const identity = recordIdentityV1([record.providerId, record.generation]);
  const firstAppearance = assertRecordIdentityV1(
    state.bindingRecords,
    identity,
    record,
  );
  if (
    record.providerId !== entry.providerId ||
    record.registryGenerationIntroduced > entry.registryGeneration
  ) {
    return fail("key_history", "record_history_invalid");
  }
  if (!firstAppearance) return;
  if (record.registryGenerationIntroduced !== entry.registryGeneration) {
    return fail("key_history", "record_history_invalid");
  }
  const signer = resolveRetainedRegistrySignerV1(
    record.registrySignature,
    rootByKeyId,
    currentRoot.rootKeyId,
  );
  await verifyRegistrySignedRecordV1(
    record.registrySignature,
    signer,
    createStoreDurableObjectProviderBindingDerivationGenerationSignatureMessageV1(
      record,
      signer.rootKeyId,
    ),
    capability,
  );
}

async function validateApproverRecordV1(
  record: ProviderFeasibilityApproverPublicKeyV1,
  currentRoot: ProviderRegistryRootPublicKeyV1,
  rootByKeyId: ReadonlyMap<string, ProviderRegistryRootMetadataEnvelopeV1>,
  manifestGeneration: number,
  state: RegistryHistoryStateV1,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<void> {
  const identity = recordIdentityV1([record.role, record.keyId]);
  const firstAppearance = assertRecordIdentityV1(
    state.approverKeyRecords,
    identity,
    record,
  );
  if (
    record.distributionRegistryGenerationIntroduced > manifestGeneration ||
    deriveProviderFeasibilityApproverKeyIdV1({
      role: record.role,
      publicKeyBytes: record.publicKeyBytes,
    }) !== record.keyId ||
    deriveProviderEd25519PublicKeyDigestInternalV1(record.publicKeyBytes) !==
      record.publicKeyDigest
  ) {
    return fail("key_history", "record_history_invalid");
  }
  registerMaterialV1(state, record.publicKeyBytes, `approver:${identity}`, record);
  if (!firstAppearance) return;
  if (
    record.distributionRegistryGenerationIntroduced !== manifestGeneration
  ) {
    return fail("key_history", "record_history_invalid");
  }
  const signer = resolveRetainedRegistrySignerV1(
    record.registrySignature,
    rootByKeyId,
    currentRoot.rootKeyId,
  );
  await hardenProviderPointPromiseV1(
    admitPublicKeyV1(record.publicKeyBytes, capability),
  );
  await verifyRegistrySignedRecordV1(
    record.registrySignature,
    signer,
    createProviderFeasibilityApproverPublicKeySignatureMessageV1(
      record,
      signer.rootKeyId,
    ),
    capability,
  );
}

function validateActiveRecordClosureV1(
  entry: StoreDurableObjectProviderRegistryEntryV1,
): void {
  const records = entry.verificationKeys.publicKeyRecords;
  const revokedKeys = setFromValuesV1(
    entry.verificationKeys.compromisedRevokedKeyIds,
  );
  const activeByUsage = [
    ["operation_receipt", entry.verificationKeys.activeKeyIds.operationReceipt],
    ["containment_proof", entry.verificationKeys.activeKeyIds.containmentProof],
    ["state_version", entry.verificationKeys.activeKeyIds.stateVersion],
    ["journal_version", entry.verificationKeys.activeKeyIds.journalVersion],
  ] as const;
  for (const [usage, keyId] of activeByUsage) {
    if (
      setHasV1(revokedKeys, keyId) ||
      arrayFilterV1(
        records,
        (record) => record.usage === usage && record.keyId === keyId,
      ).length !== 1
    ) {
      return fail("key_history", "active_record_invalid");
    }
  }
  const bindingGeneration =
    entry.verificationKeys.activeBindingDerivationKeyGeneration;
  if (
    entry.verificationKeys.compromisedRevokedBindingDerivationGenerations.includes(
      bindingGeneration,
    ) ||
    arrayFilterV1(
      entry.verificationKeys.bindingDerivationGenerationRecords,
      ({ generation }) => generation === bindingGeneration,
    ).length !== 1
  ) {
    return fail("key_history", "active_record_invalid");
  }

  const approvers = entry.feasibilityApprovalKeys;
  const revokedApprovers = setFromValuesV1(
    approvers.compromisedRevokedKeyIds,
  );
  const activeApprovers = [
    ["qa", approvers.activeKeyIds.qa],
    ["release", approvers.activeKeyIds.release],
  ] as const;
  for (const [role, keyId] of activeApprovers) {
    if (
      setHasV1(revokedApprovers, keyId) ||
      arrayFilterV1(
        approvers.publicKeyRecords,
        (record) => record.role === role && record.keyId === keyId,
      ).length !== 1
    ) {
      return fail("key_history", "active_record_invalid");
    }
  }
  if (approvers.activeKeyIds.qa === approvers.activeKeyIds.release) {
    return fail("key_history", "active_record_invalid");
  }
}

async function validateRegistryEntryV1(
  member: EnabledMemberV1,
  manifest: ProviderRegistryManifestV1,
  currentRoot: ProviderRegistryRootPublicKeyV1,
  rootByKeyId: ReadonlyMap<string, ProviderRegistryRootMetadataEnvelopeV1>,
  policy: ProviderTrustHistoryPolicyV1,
  state: RegistryHistoryStateV1,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<void> {
  const entry = member.registryEntry;
  if (
    member.providerId !== entry.providerId ||
    entry.installationIdentityGenerationId !==
      manifest.installationIdentityGenerationId ||
    !canonicalJsonEqual(entry.activeRootMetadata, manifest.activeRootMetadata) ||
    entry.registryRootKeyId !== currentRoot.rootKeyId ||
    member.registryEntryContentDigest !==
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(entry)
  ) {
    return fail("registry_entry", "entry_mismatch");
  }
  if (
    (entry.registryGeneration === 1 &&
      "predecessorRegistryEntryContentDigest" in entry) ||
    (entry.registryGeneration > 1 &&
      !("predecessorRegistryEntryContentDigest" in entry))
  ) {
    return fail("registry_entry", "entry_mismatch");
  }
  const entryFirstAppearance = assertRecordIdentityV1(
    state.registryEntries,
    recordIdentityV1([entry.providerId, member.registryEntryContentDigest]),
    entry,
  );
  const runtime = entry.runtimeAttestation;
  if (
    runtime.payload.providerId !== entry.providerId ||
    runtime.payload.semanticProviderPolicyDigest !==
      entry.semanticProviderPolicyDigest ||
    runtime.contentDigest !==
      deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1(
        runtime.payload,
      )
  ) {
    return fail("registry_entry", "entry_mismatch");
  }
  validateEntryCollectionsV1(entry, policy, state);
  validateActiveRecordClosureV1(entry);
  const runtimeFirstAppearance = assertRecordIdentityV1(
    state.runtimeAttestations,
    recordIdentityV1([entry.providerId, runtime.contentDigest]),
    runtime,
  );
  if (runtimeFirstAppearance) {
    const runtimeSigner = resolveRetainedRegistrySignerV1(
      runtime.payload.registrySignature,
      rootByKeyId,
      currentRoot.rootKeyId,
    );
    await verifyRegistrySignedRecordV1(
      runtime.payload.registrySignature,
      runtimeSigner,
      createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
        runtime.payload,
        runtimeSigner.rootKeyId,
      ),
      capability,
    );
  }
  for (const record of entry.verificationKeys.publicKeyRecords) {
    await hardenProviderPointPromiseV1(
      validateVerificationKeyRecordV1(
        record,
        entry,
        currentRoot,
        rootByKeyId,
        state,
        capability,
      ),
    );
  }
  for (const record of entry.verificationKeys.bindingDerivationGenerationRecords) {
    await hardenProviderPointPromiseV1(
      validateBindingRecordV1(
        record,
        entry,
        currentRoot,
        rootByKeyId,
        state,
        capability,
      ),
    );
  }
  for (const record of entry.feasibilityApprovalKeys.publicKeyRecords) {
    await hardenProviderPointPromiseV1(
      validateApproverRecordV1(
        record,
        currentRoot,
        rootByKeyId,
        manifest.manifestGeneration,
        state,
        capability,
      ),
    );
  }
  if (entryFirstAppearance) {
    const entrySigner = resolveRetainedRegistrySignerV1(
      entry.registrySignature,
      rootByKeyId,
      currentRoot.rootKeyId,
    );
    await verifyRegistrySignedRecordV1(
      entry.registrySignature,
      entrySigner,
      createStoreDurableObjectProviderRegistryEntrySignatureMessageV1(
        entry,
        entrySigner.rootKeyId,
      ),
      capability,
    );
  }
}

function readProspectiveEntryTemporaryAdmissionInputInternalV1(
  input: unknown,
): ProviderRegistryProspectiveEntryTemporaryAdmissionInputInternalV1 | undefined {
  if (
    input === null ||
    typeof input !== "object" ||
    (CapturedObjectGetPrototypeOfV1(input) !== CapturedObjectPrototypeV1 &&
      CapturedObjectGetPrototypeOfV1(input) !== null)
  ) {
    return undefined;
  }
  const keys = CapturedReflectOwnKeysV1(input);
  let hasDigest = false;
  let hasEntry = false;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === "prospectiveRegistryEntryContentDigest") {
      hasDigest = true;
    } else if (key === "prospectiveRegistryEntry") {
      hasEntry = true;
    } else {
      return undefined;
    }
  }
  if (keys.length !== 2 || !hasDigest || !hasEntry) {
    return undefined;
  }
  const digestDescriptor = CapturedObjectGetOwnPropertyDescriptorV1(
    input,
    "prospectiveRegistryEntryContentDigest",
  );
  const entryDescriptor = CapturedObjectGetOwnPropertyDescriptorV1(
    input,
    "prospectiveRegistryEntry",
  );
  if (
    digestDescriptor === undefined ||
    !("value" in digestDescriptor) ||
    digestDescriptor.enumerable !== true ||
    entryDescriptor === undefined ||
    !("value" in entryDescriptor) ||
    entryDescriptor.enumerable !== true
  ) {
    return undefined;
  }
  const parsedEntry = StoreDurableObjectProviderRegistryEntryV1Schema.safeParse(
    entryDescriptor.value,
  );
  if (!parsedEntry.success || typeof digestDescriptor.value !== "string") {
    return undefined;
  }
  return {
    prospectiveRegistryEntryContentDigest: digestDescriptor.value,
    prospectiveRegistryEntry: parsedEntry.data,
  };
}

/**
 * Consume one temporary-admission capability before inspecting the candidate,
 * clone exactly seven retained collections, and run the ordinary Entry
 * validator only against that copy. No prepared Manifest or retained-state
 * mutation is produced.
 *
 * @internal
 */
export async function diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1(
  capability: ProviderRegistryProspectiveEntryTemporaryAdmissionCapabilityInternalV1,
  input: unknown,
): Promise<ProviderRegistryProspectiveEntryTemporaryAdmissionDiagnosticResultInternalV1> {
  if (
    capability === null ||
    (typeof capability !== "object" && typeof capability !== "function")
  ) {
    return createProviderNonThenableFrozenRecordV1<ProviderRegistryProspectiveEntryTemporaryAdmissionDiagnosticResultInternalV1>({
      ok: false,
      stage: "history_input",
      reason: "schema_invalid",
    });
  }
  const context = weakMapGetV1(
    prospectiveEntryTemporaryAdmissionContextsByCapabilityInternalV1,
    capability,
  );
  if (
    context === undefined ||
    !weakMapDeleteV1(
      prospectiveEntryTemporaryAdmissionContextsByCapabilityInternalV1,
      capability,
    )
  ) {
    return createProviderNonThenableFrozenRecordV1<ProviderRegistryProspectiveEntryTemporaryAdmissionDiagnosticResultInternalV1>({
      ok: false,
      stage: "history_input",
      reason: "schema_invalid",
    });
  }

  try {
    const exactInput =
      readProspectiveEntryTemporaryAdmissionInputInternalV1(input);
    if (exactInput === undefined) {
      return createProviderNonThenableFrozenRecordV1<ProviderRegistryProspectiveEntryTemporaryAdmissionDiagnosticResultInternalV1>({
        ok: false,
        stage: "history_input",
        reason: "schema_invalid",
      });
    }
    const entry = exactInput.prospectiveRegistryEntry;
    if (
      context.currentManifest.routing.state !== "steady" ||
      entry.registryGeneration !== 1 ||
      "predecessorRegistryEntryContentDigest" in entry ||
      exactInput.prospectiveRegistryEntryContentDigest !==
        deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(entry)
    ) {
      return createProviderNonThenableFrozenRecordV1<ProviderRegistryProspectiveEntryTemporaryAdmissionDiagnosticResultInternalV1>({
        ok: false,
        stage: "registry_entry",
        reason: "entry_mismatch",
      });
    }
    for (let index = 0; index < context.manifestHistory.length; index += 1) {
      const manifest = context.manifestHistory[index]!.payload;
      if (
        arraySomeV1(
          manifest.members,
          (member) => member.providerId === entry.providerId,
        )
      ) {
        return createProviderNonThenableFrozenRecordV1<ProviderRegistryProspectiveEntryTemporaryAdmissionDiagnosticResultInternalV1>({
          ok: false,
          stage: "member_set",
          reason: "member_transition_invalid",
        });
      }
    }

    const copiedState =
      cloneRegistryHistoryStateForTemporaryAdmissionInternalV1(
        context.retainedState,
      );
    const member: EnabledMemberV1 = {
      providerId: entry.providerId,
      disposition: "enabled",
      registryEntryContentDigest:
        exactInput.prospectiveRegistryEntryContentDigest as ReturnType<
          typeof deriveStoreDurableObjectProviderRegistryEntryContentDigestV1
        >,
      registryEntry: entry,
    };
    await hardenProviderPointPromiseV1(
      validateRegistryEntryV1(
        member,
        context.currentManifest,
        context.currentRoot,
        context.rootByKeyId,
        context.policy,
        copiedState,
        context.strictCryptoCapability,
      ),
    );
    return createProviderNonThenableFrozenRecordV1<ProviderRegistryProspectiveEntryTemporaryAdmissionDiagnosticResultInternalV1>({
      ok: true,
      value: createProviderNonThenableFrozenRecordV1<ProviderRegistryProspectiveEntryTemporaryAdmissionValidationInternalV1>({
        authority:
          "none_registry_prospective_entry_temporary_admission_only",
        installationIdentityGenerationId:
          context.currentManifest.installationIdentityGenerationId,
        providerId: entry.providerId,
        registryEntryContentDigest:
          exactInput.prospectiveRegistryEntryContentDigest as ReturnType<
            typeof deriveStoreDurableObjectProviderRegistryEntryContentDigestV1
          >,
        registryGeneration: 1,
        copiedRetainedStateCollectionCount: 7,
        retainedStateMutationCount: 0,
      }),
    });
  } catch (error) {
    if (error instanceof RegistryManifestHistoryDiagnosticSignal) {
      return createProviderNonThenableFrozenRecordV1<ProviderRegistryProspectiveEntryTemporaryAdmissionDiagnosticResultInternalV1>({
        ok: false,
        stage: error.stage,
        reason: error.reason,
      });
    }
    return createProviderNonThenableFrozenRecordV1<ProviderRegistryProspectiveEntryTemporaryAdmissionDiagnosticResultInternalV1>({
      ok: false,
      stage: "history_input",
      reason: "schema_invalid",
    });
  }
}

function validateEntryCollectionsV1(
  entry: StoreDurableObjectProviderRegistryEntryV1,
  policy: ProviderTrustHistoryPolicyV1,
  state: RegistryHistoryStateV1,
): void {
  const verificationRecords = entry.verificationKeys.publicKeyRecords;
  if (
    arraySomeV1(
      verificationRecords,
      (record) => record.providerId !== entry.providerId,
    )
  ) {
    return fail("key_history", "record_history_invalid");
  }
  assertStrictlyIncreasingRecordsV1(
    verificationRecords,
    (left, right) =>
      compareStringTupleV1(
        [left.providerId, left.usage, left.keyId],
        [right.providerId, right.usage, right.keyId],
      ),
  );
  if (
    verificationRecords.length >
    policy.maxProviderVerificationPublicKeyRecordCountPerProvider
  ) {
    return fail("key_history", "record_history_invalid");
  }
  for (const usage of [
    "operation_receipt",
    "containment_proof",
    "state_version",
    "journal_version",
    "migration_semantic_proof",
  ] as const) {
    if (
      arrayFilterV1(verificationRecords, (record) => record.usage === usage)
        .length >
      policy.maxProviderVerificationPublicKeyRecordCountPerUsage
    ) {
      return fail("key_history", "record_history_invalid");
    }
  }

  const bindingRecords =
    entry.verificationKeys.bindingDerivationGenerationRecords;
  if (
    arraySomeV1(
      bindingRecords,
      (record, index) =>
        record.providerId !== entry.providerId ||
        record.generation !== index + 1,
    )
  ) {
    return fail("key_history", "record_history_invalid");
  }
  assertStrictlyIncreasingRecordsV1(bindingRecords, (left, right) => {
    const providerOrder = utf8BytewiseCompare(
      left.providerId,
      right.providerId,
    );
    return providerOrder === 0
      ? left.generation - right.generation
      : providerOrder;
  });
  if (
    bindingRecords.length >
    policy.maxBindingDerivationGenerationRecordCountPerProvider
  ) {
    return fail("key_history", "record_history_invalid");
  }

  const approverRecords = entry.feasibilityApprovalKeys.publicKeyRecords;
  assertStrictlyIncreasingRecordsV1(
    approverRecords,
    (left, right) =>
      compareStringTupleV1(
        [left.role, left.keyId],
        [right.role, right.keyId],
      ),
  );
  for (const role of ["qa", "release"] as const) {
    if (
      arrayFilterV1(approverRecords, (record) => record.role === role).length >
      policy.maxApproverPublicKeyRecordCountPerRole
    ) {
      return fail("key_history", "record_history_invalid");
    }
  }

  assertSortedUniqueStringsV1(
    entry.verificationKeys.compromisedRevokedKeyIds,
    "key_history",
    "record_history_invalid",
  );
  assertSortedUniqueNumbersV1(
    entry.verificationKeys
      .compromisedRevokedBindingDerivationGenerations,
  );
  assertSortedUniqueStringsV1(
    entry.feasibilityApprovalKeys.compromisedRevokedKeyIds,
    "key_history",
    "record_history_invalid",
  );

  for (const keyId of entry.verificationKeys.compromisedRevokedKeyIds) {
    if (
      arrayFilterV1(verificationRecords, (record) => record.keyId === keyId)
        .length !==
      1
    ) {
      return fail("key_history", "revocation_invalid");
    }
    setAddV1(
      state.revocationIdentities,
      `provider-key:${entry.providerId}:${keyId}`,
    );
  }
  for (const generation of entry.verificationKeys
    .compromisedRevokedBindingDerivationGenerations) {
    if (
      arrayFilterV1(
        bindingRecords,
        (record) => record.generation === generation,
      )
        .length !== 1
    ) {
      return fail("key_history", "revocation_invalid");
    }
    setAddV1(
      state.revocationIdentities,
      `provider-binding:${entry.providerId}:${generation}`,
    );
  }
  for (const keyId of entry.feasibilityApprovalKeys
    .compromisedRevokedKeyIds) {
    if (
      arrayFilterV1(approverRecords, (record) => record.keyId === keyId)
        .length !== 1
    ) {
      return fail("key_history", "revocation_invalid");
    }
    setAddV1(state.revocationIdentities, `approver:${keyId}`);
  }
  if (
    state.revocationIdentities.size >
    policy.maxCompromisedRevocationRecordCountPerIdentity
  ) {
    return fail("key_history", "record_history_invalid");
  }
}

function assertManifestApprovalSnapshotV1(
  manifest: ProviderRegistryManifestV1,
): void {
  const enabled = enabledMembersV1(manifest);
  const expected = enabled[0]?.registryEntry.feasibilityApprovalKeys;
  if (expected === undefined) return fail("member_set", "entry_mismatch");
  for (let index = 1; index < enabled.length; index += 1) {
    if (
      !canonicalJsonEqual(
        expected,
        enabled[index]!.registryEntry.feasibilityApprovalKeys,
      )
    ) {
      return fail("key_history", "record_history_invalid");
    }
  }
}

function validateMemberSuccessorsV1(
  previous: ProviderRegistryManifestV1,
  current: ProviderRegistryManifestV1,
): void {
  const previousMembers = memberMapV1(previous);
  const currentMembers = memberMapV1(current);
  for (const [providerId, previousMember] of previousMembers) {
    const currentMember = mapGetV1(currentMembers, providerId);
    if (currentMember === undefined) {
      return fail("member_set", "member_transition_invalid");
    }
    if (previousMember.disposition === "revoked") {
      if (
        currentMember.disposition !== "revoked" ||
        !canonicalJsonEqual(previousMember, currentMember)
      ) {
        return fail("member_set", "member_transition_invalid");
      }
      continue;
    }
    if (currentMember.disposition === "revoked") {
      assertTombstoneV1(
        previousMember,
        currentMember,
        current.manifestGeneration,
      );
    } else {
      assertEntrySuccessorV1(previousMember, currentMember);
    }
  }
  for (const currentMember of current.members) {
    if (
      !mapHasV1(previousMembers, currentMember.providerId) &&
      (currentMember.disposition !== "enabled" ||
        currentMember.registryEntry.registryGeneration !== 1)
    ) {
      return fail("member_set", "member_transition_invalid");
    }
  }
}

async function validateInternalV1(
  input: unknown,
): Promise<ProviderRegistryManifestHistoryValidationV1> {
  let exactInput: ValidateProviderRegistryManifestHistoryV1Input;
  let installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  let bundle: ProviderBootstrapTrustBundleV1;
  try {
    exactInput = snapshotExactInputV1(input);
    installationIdentityGenerationId =
      InstallationIdentityGenerationIdV1Schema.parse(
        exactInput.installationIdentityGenerationId,
      );
    bundle = ProviderBootstrapTrustBundleV1Schema.parse(
      snapshotBoundedJsonV1(
        exactInput.bootstrapTrustBundle,
        PROVIDER_BOOTSTRAP_TRUST_BUNDLE_MAX_BYTES_V1,
      ),
    );
  } catch (error) {
    if (error instanceof RegistryManifestHistoryDiagnosticSignal) throw error;
    return fail("history_input", "schema_invalid");
  }

  let rootUnknown: readonly unknown[];
  let manifestUnknown: readonly unknown[];
  try {
    rootUnknown = snapshotManifestHistoryCandidatesV1(
      exactInput.rootMetadataHistory,
      bundle.providerTrustHistoryPolicy
        .maxRootMetadataGenerationCountPerInstallationIdentity,
    );
    manifestUnknown = snapshotManifestHistoryCandidatesV1(
      exactInput.registryManifestHistory,
      bundle.providerTrustHistoryPolicy
        .maxRegistryManifestGenerationCountPerInstallationIdentity,
    );
  } catch (error) {
    if (error instanceof RegistryManifestHistoryDiagnosticSignal) throw error;
    return fail("history_input", "schema_invalid");
  }
  if (rootUnknown.length === 0) {
    return fail("root_history", "root_history_invalid");
  }
  if (manifestUnknown.length === 0) {
    return fail("history_input", "history_empty");
  }

  const rootEnvelopeSnapshots: unknown[] = [];
  let prospectiveRootBytes = 0;
  for (const candidate of rootUnknown) {
    try {
      const snapshot = snapshotBoundedJsonV1(
        candidate,
        bundle.providerTrustHistoryPolicy.maxSingleTrustEnvelopeLogicalBytes,
      );
      const canonical = canonicalizeJcsSafeIntegerUtf8V1(snapshot);
      if (
        canonical.byteLength >
        bundle.providerTrustHistoryPolicy.maxSingleTrustEnvelopeLogicalBytes
      ) {
        return fail("history_limit", "envelope_byte_limit_exceeded");
      }
      prospectiveRootBytes += canonical.byteLength;
      if (
        prospectiveRootBytes >
        bundle.providerTrustHistoryPolicy
          .maxTotalTrustHistoryLogicalBytesPerInstallationIdentity
      ) {
        return fail("history_limit", "history_total_byte_limit_exceeded");
      }
      arrayPushV1(rootEnvelopeSnapshots, snapshot);
    } catch (error) {
      if (error instanceof RegistryManifestHistoryDiagnosticSignal) throw error;
      return fail("root_history", "root_history_invalid");
    }
  }

  const envelopeSnapshots: unknown[] = [];
  let retainedRegistryBytes = 0;
  for (const candidate of manifestUnknown) {
    try {
      const snapshot = snapshotBoundedJsonV1(
        candidate,
        bundle.providerTrustHistoryPolicy.maxSingleTrustEnvelopeLogicalBytes,
      );
      const canonical = canonicalizeJcsSafeIntegerUtf8V1(snapshot);
      if (
        canonical.byteLength >
        bundle.providerTrustHistoryPolicy.maxSingleTrustEnvelopeLogicalBytes
      ) {
        return fail("history_limit", "envelope_byte_limit_exceeded");
      }
      retainedRegistryBytes += canonical.byteLength;
      if (
        retainedRegistryBytes >
        bundle.providerTrustHistoryPolicy
          .maxTotalTrustHistoryLogicalBytesPerInstallationIdentity
      ) {
        return fail("history_limit", "history_total_byte_limit_exceeded");
      }
      arrayPushV1(envelopeSnapshots, snapshot);
    } catch (error) {
      if (error instanceof RegistryManifestHistoryDiagnosticSignal) throw error;
      return fail("manifest_envelope", "schema_invalid");
    }
  }

  const maxRetainedTrustBytes =
    bundle.providerTrustHistoryPolicy
      .maxTotalTrustHistoryLogicalBytesPerInstallationIdentity;
  if (
    !isProviderRegistryRetainedTrustHistoryWithinBudgetInternalV1(
      prospectiveRootBytes,
      retainedRegistryBytes,
      maxRetainedTrustBytes,
    )
  ) {
    return fail("history_limit", "history_total_byte_limit_exceeded");
  }
  const retainedTrustBytes = prospectiveRootBytes + retainedRegistryBytes;

  let rootValidation: ProviderRegistryRootMetadataHistoryValidationV1;
  try {
    rootValidation = await validateProviderRegistryRootMetadataHistoryV1({
      bootstrapTrustBundle: bundle,
      rootMetadataHistory:
        rootEnvelopeSnapshots as readonly ProviderRegistryRootMetadataEnvelopeV1[],
      strictCryptoCapability: exactInput.strictCryptoCapability,
    });
  } catch {
    return fail("root_history", "root_history_invalid");
  }
  if (
    rootValidation.retainedRootMetadataCanonicalBytes !==
    prospectiveRootBytes
  ) {
    return fail("root_history", "root_history_invalid");
  }

  const rootByPin = new CapturedMapV1<
    string,
    ProviderRegistryRootMetadataEnvelopeV1
  >();
  const rootByKeyId = new CapturedMapV1<
    string,
    ProviderRegistryRootMetadataEnvelopeV1
  >();
  const state: RegistryHistoryStateV1 = {
    materialOwners: new CapturedMapV1(),
    providerKeyRecords: new CapturedMapV1(),
    bindingRecords: new CapturedMapV1(),
    approverKeyRecords: new CapturedMapV1(),
    runtimeAttestations: new CapturedMapV1(),
    registryEntries: new CapturedMapV1(),
    revocationIdentities: new CapturedSetV1(),
  };
  for (const envelope of rootValidation.rootMetadataHistory) {
    mapSetV1(rootByPin, rootPinKeyV1(rootPinForEnvelopeV1(envelope)), envelope);
    mapSetV1(rootByKeyId, envelope.rootKeyId, envelope);
    registerMaterialV1(
      state,
      envelope.payload.activeRoot.publicKeyBytes,
      `root:${envelope.rootKeyId}`,
    );
  }
  for (const recoveryKey of bundle.providerRegistryRecoveryKeys) {
    registerMaterialV1(
      state,
      recoveryKey.publicKeyBytes,
      `recovery:${recoveryKey.recoveryKeyId}`,
    );
  }

  const history: ProviderRegistryManifestEnvelopeV1[] = [];
  const seenManifestGenerationIds = new CapturedSetV1<string>();
  const seenManifestContentDigests = new CapturedSetV1<string>();
  let previousRootGeneration = 0;
  for (let index = 0; index < envelopeSnapshots.length; index += 1) {
    let envelope: ProviderRegistryManifestEnvelopeV1;
    try {
      envelope = ProviderRegistryManifestEnvelopeV1Schema.parse(
        envelopeSnapshots[index],
      );
    } catch {
      return fail("manifest_envelope", "schema_invalid");
    }
    const manifest = envelope.payload;
    const expectedGeneration = index + 1;
    if (manifest.manifestGeneration !== expectedGeneration) {
      return fail("manifest_predecessor", "generation_not_contiguous");
    }
    if (
      envelope.generationId !==
        deriveProviderRegistryManifestGenerationIdV1(
          projectProviderRegistryManifestIdFieldsV1(manifest),
        ) ||
      manifest.generationId !== envelope.generationId ||
      envelope.contentDigest !==
        deriveProviderRegistryManifestContentDigestV1(manifest)
    ) {
      return fail("manifest_envelope", "envelope_mismatch");
    }
    if (
      setHasV1(seenManifestGenerationIds, envelope.generationId) ||
      setHasV1(seenManifestContentDigests, envelope.contentDigest)
    ) {
      return fail("manifest_envelope", "envelope_mismatch");
    }
    setAddV1(seenManifestGenerationIds, envelope.generationId);
    setAddV1(seenManifestContentDigests, envelope.contentDigest);
    if (manifest.installationIdentityGenerationId !== installationIdentityGenerationId) {
      return fail("manifest_envelope", "envelope_mismatch");
    }
    // Force the canonical fixed-locator derivation even though the physical path
    // is deliberately not accepted as an input to this validator.
    try {
      buildProviderRegistryManifestRelativePathV1({
        locatorProfile: "installation_provider_registry_manifest_v1",
        generationId: envelope.generationId,
      });
    } catch {
      return fail("manifest_envelope", "envelope_mismatch");
    }

    const rootEnvelope = mapGetV1(
      rootByPin,
      rootPinKeyV1(manifest.activeRootMetadata),
    );
    if (rootEnvelope === undefined) {
      return fail("root_binding", "root_pin_mismatch");
    }
    if (rootEnvelope.rootGeneration < previousRootGeneration) {
      return fail("root_binding", "root_generation_rollback");
    }
    previousRootGeneration = rootEnvelope.rootGeneration;
    const root = rootEnvelope.payload.activeRoot;

    if (index === 0) {
      if (manifest.predecessor.state !== "genesis") {
        return fail("manifest_predecessor", "predecessor_pin_mismatch");
      }
    } else {
      const predecessor = history[index - 1]!;
      if (
        manifest.predecessor.state !== "manifest" ||
        manifest.predecessor.generationId !== predecessor.generationId ||
        manifest.predecessor.contentDigest !== predecessor.contentDigest
      ) {
        return fail("manifest_predecessor", "predecessor_pin_mismatch");
      }
    }
    await requireRootSignatureV1(
      manifest.manifestSignature,
      MANIFEST_SIGNATURE_PATTERN,
      root,
      createProviderRegistryManifestSignatureMessageV1(
        projectProviderRegistryManifestUnsignedClaimsV1(manifest),
        root.rootKeyId,
      ),
      exactInput.strictCryptoCapability,
      "manifest_signature",
    );

    assertSortedUniqueStringsV1(
      arrayMapV1(manifest.members, ({ providerId }) => providerId),
    );
    assertRoutingShapeV1(manifest);
    assertManifestApprovalSnapshotV1(manifest);
    const previous = history[index - 1]?.payload;
    if (previous !== undefined) {
      validateMemberSuccessorsV1(previous, manifest);
      assertRoutingSuccessorV1(previous, manifest);
    } else {
      if (manifest.routing.state !== "steady") {
        return fail("routing", "routing_invalid");
      }
      if (
        arraySomeV1(
          manifest.members,
          (member) =>
            member.disposition === "revoked" ||
            member.registryEntry.registryGeneration !== 1,
        )
      ) {
        return fail("member_set", "member_transition_invalid");
      }
    }

    for (const member of enabledMembersV1(manifest)) {
      await hardenProviderPointPromiseV1(
        validateRegistryEntryV1(
          member,
          manifest,
          root,
          rootByKeyId,
          bundle.providerTrustHistoryPolicy,
          state,
          exactInput.strictCryptoCapability,
        ),
      );
    }
    arrayPushV1(history, envelope);
  }

  const current = history[history.length - 1]!;
  if (!canonicalJsonEqual(current.payload.activeRootMetadata, rootValidation.currentRootMetadata)) {
    return fail("root_binding", "root_pin_mismatch");
  }
  return deepFreezeJson({
    authority: "none_registry_structure_and_history_only" as const,
    installationIdentityGenerationId,
    currentRootMetadata: rootValidation.currentRootMetadata,
    currentRegistryManifest: registryManifestPinV1(current),
    retainedRootMetadataGenerationCount:
      rootValidation.retainedRootMetadataGenerationCount,
    retainedRegistryManifestGenerationCount: history.length,
    retainedRootMetadataCanonicalBytes:
      rootValidation.retainedRootMetadataCanonicalBytes,
    retainedRegistryManifestCanonicalBytes: retainedRegistryBytes,
    retainedTrustHistoryCanonicalBytes: retainedTrustBytes,
    rootMetadataHistory: rootValidation.rootMetadataHistory,
    registryManifestHistory: history,
  });
}

interface PreparedRegistryManifestHistoryCoreSuccessV1 {
  readonly closure: ProviderRegistryManifestHistoryValidationV1;
  readonly witness: RegistryHistoryVerifiedCryptoWitnessV1;
}

/**
 * Validates one already detached/frozen Registry source.  Unlike the ordinary
 * public path above, this function neither calls any snapshot helper nor
 * retains a second Root/Manifest history array.  Per-Envelope Schema and
 * canonical byte values are temporary assertions and are discarded before the
 * next candidate.
 */
async function validatePreparedInternalV1(
  prepared: PreparedRegistryHistorySnapshotV1,
): Promise<PreparedRegistryManifestHistoryCoreSuccessV1> {
  assertProviderRegistryPreparedCopyLedgerZeroInternalV1(prepared.copyLedger);

  let installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  let bundle: ProviderBootstrapTrustBundleV1;
  try {
    installationIdentityGenerationId =
      InstallationIdentityGenerationIdV1Schema.parse(
        prepared.installationIdentityGenerationId,
      );
    if (!ProviderBootstrapTrustBundleV1Schema.safeParse(prepared.bootstrapTrustBundle).success) {
      return fail("history_input", "schema_invalid");
    }
    bundle = prepared.bootstrapTrustBundle;
  } catch (error) {
    if (error instanceof RegistryManifestHistoryDiagnosticSignal) throw error;
    return fail("history_input", "schema_invalid");
  }

  const rootHistory = prepared.rootMetadataHistory;
  const manifestHistory = prepared.registryManifestHistory;
  if (
    !CapturedArrayIsArrayV1(rootHistory) ||
    !CapturedArrayIsArrayV1(manifestHistory) ||
    !CapturedObjectIsFrozenV1(rootHistory) ||
    !CapturedObjectIsFrozenV1(manifestHistory)
  ) {
    return fail("history_input", "schema_invalid");
  }
  if (
    rootHistory.length >
      bundle.providerTrustHistoryPolicy
        .maxRootMetadataGenerationCountPerInstallationIdentity ||
    manifestHistory.length >
      bundle.providerTrustHistoryPolicy
        .maxRegistryManifestGenerationCountPerInstallationIdentity
  ) {
    return fail("history_limit", "history_generation_limit_exceeded");
  }
  if (rootHistory.length === 0) {
    return fail("root_history", "root_history_invalid");
  }
  if (manifestHistory.length === 0) {
    return fail("history_input", "history_empty");
  }

  let retainedRootBytes = 0;
  for (let index = 0; index < rootHistory.length; index += 1) {
    const candidate = rootHistory[index]!;
    try {
      if (!CapturedObjectIsFrozenV1(candidate)) {
        return fail("root_history", "root_history_invalid");
      }
      const canonical = canonicalizeJcsSafeIntegerUtf8V1(candidate);
      if (
        canonical.byteLength >
        bundle.providerTrustHistoryPolicy.maxSingleTrustEnvelopeLogicalBytes
      ) {
        return fail("history_limit", "envelope_byte_limit_exceeded");
      }
      retainedRootBytes += canonical.byteLength;
      if (
        retainedRootBytes >
        bundle.providerTrustHistoryPolicy
          .maxTotalTrustHistoryLogicalBytesPerInstallationIdentity
      ) {
        return fail("history_limit", "history_total_byte_limit_exceeded");
      }
    } catch (error) {
      if (error instanceof RegistryManifestHistoryDiagnosticSignal) throw error;
      return fail("root_history", "root_history_invalid");
    }
  }

  let retainedRegistryBytes = 0;
  for (let index = 0; index < manifestHistory.length; index += 1) {
    const candidate = manifestHistory[index]!;
    try {
      if (!CapturedObjectIsFrozenV1(candidate)) {
        return fail("manifest_envelope", "schema_invalid");
      }
      const canonical = canonicalizeJcsSafeIntegerUtf8V1(candidate);
      if (
        canonical.byteLength >
        bundle.providerTrustHistoryPolicy.maxSingleTrustEnvelopeLogicalBytes
      ) {
        return fail("history_limit", "envelope_byte_limit_exceeded");
      }
      retainedRegistryBytes += canonical.byteLength;
      if (
        retainedRegistryBytes >
        bundle.providerTrustHistoryPolicy
          .maxTotalTrustHistoryLogicalBytesPerInstallationIdentity
      ) {
        return fail("history_limit", "history_total_byte_limit_exceeded");
      }
    } catch (error) {
      if (error instanceof RegistryManifestHistoryDiagnosticSignal) throw error;
      return fail("manifest_envelope", "schema_invalid");
    }
  }

  const maxRetainedTrustBytes =
    bundle.providerTrustHistoryPolicy
      .maxTotalTrustHistoryLogicalBytesPerInstallationIdentity;
  if (
    !isProviderRegistryRetainedTrustHistoryWithinBudgetInternalV1(
      retainedRootBytes,
      retainedRegistryBytes,
      maxRetainedTrustBytes,
    )
  ) {
    return fail("history_limit", "history_total_byte_limit_exceeded");
  }
  const retainedTrustBytes = retainedRootBytes + retainedRegistryBytes;

  let rootValidation: ProviderRegistryRootMetadataHistoryValidationV1;
  try {
    rootValidation =
      await hardenProviderPointPromiseV1(
        validateProviderRegistryRootMetadataHistoryPreparedInternalV1({
          bootstrapTrustBundle: bundle,
          rootMetadataHistory: rootHistory,
          strictCryptoCapability: prepared.strictCryptoCapability,
          copyLedger: prepared.copyLedger,
        }),
      );
  } catch {
    return fail("root_history", "root_history_invalid");
  }
  if (
    rootValidation.retainedRootMetadataCanonicalBytes !== retainedRootBytes ||
    rootValidation.rootMetadataHistory !== rootHistory
  ) {
    return fail("root_history", "root_history_invalid");
  }

  const rootByPin = new CapturedMapV1<
    string,
    ProviderRegistryRootMetadataEnvelopeV1
  >();
  const rootByKeyId = new CapturedMapV1<
    string,
    ProviderRegistryRootMetadataEnvelopeV1
  >();
  const state: RegistryHistoryStateV1 = {
    materialOwners: new CapturedMapV1(),
    providerKeyRecords: new CapturedMapV1(),
    bindingRecords: new CapturedMapV1(),
    approverKeyRecords: new CapturedMapV1(),
    runtimeAttestations: new CapturedMapV1(),
    registryEntries: new CapturedMapV1(),
    revocationIdentities: new CapturedSetV1(),
  };
  for (const envelope of rootValidation.rootMetadataHistory) {
    mapSetV1(rootByPin, rootPinKeyV1(rootPinForEnvelopeV1(envelope)), envelope);
    mapSetV1(rootByKeyId, envelope.rootKeyId, envelope);
    registerMaterialV1(
      state,
      envelope.payload.activeRoot.publicKeyBytes,
      `root:${envelope.rootKeyId}`,
    );
  }
  for (const recoveryKey of bundle.providerRegistryRecoveryKeys) {
    registerMaterialV1(
      state,
      recoveryKey.publicKeyBytes,
      `recovery:${recoveryKey.recoveryKeyId}`,
    );
  }

  const seenManifestGenerationIds = new CapturedSetV1<string>();
  const seenManifestContentDigests = new CapturedSetV1<string>();
  let previousRootGeneration = 0;
  for (let index = 0; index < manifestHistory.length; index += 1) {
    const envelope = manifestHistory[index]!;
    try {
      // Strict parse is an assertion only.  Continue with `envelope` so every
      // nested Entry/Runtime/approver identity remains the detached original.
      if (!ProviderRegistryManifestEnvelopeV1Schema.safeParse(envelope).success) {
        return fail("manifest_envelope", "schema_invalid");
      }
    } catch {
      return fail("manifest_envelope", "schema_invalid");
    }
    const manifest = envelope.payload;
    const expectedGeneration = index + 1;
    if (manifest.manifestGeneration !== expectedGeneration) {
      return fail("manifest_predecessor", "generation_not_contiguous");
    }
    if (
      envelope.generationId !==
        deriveProviderRegistryManifestGenerationIdV1(
          projectProviderRegistryManifestIdFieldsV1(manifest),
        ) ||
      manifest.generationId !== envelope.generationId ||
      envelope.contentDigest !==
        deriveProviderRegistryManifestContentDigestV1(manifest)
    ) {
      return fail("manifest_envelope", "envelope_mismatch");
    }
    if (
      setHasV1(seenManifestGenerationIds, envelope.generationId) ||
      setHasV1(seenManifestContentDigests, envelope.contentDigest)
    ) {
      return fail("manifest_envelope", "envelope_mismatch");
    }
    setAddV1(seenManifestGenerationIds, envelope.generationId);
    setAddV1(seenManifestContentDigests, envelope.contentDigest);
    if (
      manifest.installationIdentityGenerationId !==
      installationIdentityGenerationId
    ) {
      return fail("manifest_envelope", "envelope_mismatch");
    }
    try {
      // The prepared path already owns a strictly parsed, detached Envelope.
      // Re-run the canonical filename branch without the public locator
      // builder's structured-clone Proxy probe; otherwise a nested clone would
      // escape the prepared history copy ledger.
      encodeStoreFilenameKeyV1(envelope.generationId);
    } catch {
      return fail("manifest_envelope", "envelope_mismatch");
    }

    const rootEnvelope = mapGetV1(
      rootByPin,
      rootPinKeyV1(manifest.activeRootMetadata),
    );
    if (rootEnvelope === undefined) {
      return fail("root_binding", "root_pin_mismatch");
    }
    if (rootEnvelope.rootGeneration < previousRootGeneration) {
      return fail("root_binding", "root_generation_rollback");
    }
    previousRootGeneration = rootEnvelope.rootGeneration;
    const root = rootEnvelope.payload.activeRoot;

    if (index === 0) {
      if (manifest.predecessor.state !== "genesis") {
        return fail("manifest_predecessor", "predecessor_pin_mismatch");
      }
    } else {
      const predecessor = manifestHistory[index - 1]!;
      if (
        manifest.predecessor.state !== "manifest" ||
        manifest.predecessor.generationId !== predecessor.generationId ||
        manifest.predecessor.contentDigest !== predecessor.contentDigest
      ) {
        return fail("manifest_predecessor", "predecessor_pin_mismatch");
      }
    }
    await requireRootSignatureV1(
      manifest.manifestSignature,
      MANIFEST_SIGNATURE_PATTERN,
      root,
      createProviderRegistryManifestSignatureMessageV1(
        projectProviderRegistryManifestUnsignedClaimsV1(manifest),
        root.rootKeyId,
      ),
      prepared.strictCryptoCapability,
      "manifest_signature",
    );

    assertSortedUniqueStringsV1(
      arrayMapV1(
        manifest.members,
        (member: ProviderRegistryManifestMemberV1) => member.providerId,
      ),
    );
    assertRoutingShapeV1(manifest);
    assertManifestApprovalSnapshotV1(manifest);
    const previous = manifestHistory[index - 1]?.payload;
    if (previous !== undefined) {
      validateMemberSuccessorsV1(previous, manifest);
      assertRoutingSuccessorV1(previous, manifest);
    } else {
      if (manifest.routing.state !== "steady") {
        return fail("routing", "routing_invalid");
      }
      if (
        arraySomeV1(
          manifest.members,
          (member: ProviderRegistryManifestMemberV1) =>
            member.disposition === "revoked" ||
            member.registryEntry.registryGeneration !== 1,
        )
      ) {
        return fail("member_set", "member_transition_invalid");
      }
    }

    for (const member of enabledMembersV1(manifest)) {
      await hardenProviderPointPromiseV1(
        validateRegistryEntryV1(
          member,
          manifest,
          root,
          rootByKeyId,
          bundle.providerTrustHistoryPolicy,
          state,
          prepared.strictCryptoCapability,
        ),
      );
    }
  }

  const current = manifestHistory[manifestHistory.length - 1]!;
  if (
    !canonicalJsonEqual(
      current.payload.activeRootMetadata,
      rootValidation.currentRootMetadata,
    )
  ) {
    return fail("root_binding", "root_pin_mismatch");
  }
  const suppliedHistoryTipRootEnvelope = mapGetV1(
    rootByPin,
    rootPinKeyV1(current.payload.activeRootMetadata),
  );
  if (suppliedHistoryTipRootEnvelope === undefined) {
    return fail("root_binding", "root_pin_mismatch");
  }

  const currentRegistryManifest = deepFreezeJson(
    registryManifestPinV1(current),
  );
  const closure = CapturedObjectFreezeV1({
    authority: "none_registry_structure_and_history_only" as const,
    installationIdentityGenerationId,
    currentRootMetadata: rootValidation.currentRootMetadata,
    currentRegistryManifest,
    retainedRootMetadataGenerationCount:
      rootValidation.retainedRootMetadataGenerationCount,
    retainedRegistryManifestGenerationCount: manifestHistory.length,
    retainedRootMetadataCanonicalBytes:
      rootValidation.retainedRootMetadataCanonicalBytes,
    retainedRegistryManifestCanonicalBytes: retainedRegistryBytes,
    retainedTrustHistoryCanonicalBytes: retainedTrustBytes,
    rootMetadataHistory: rootHistory,
    registryManifestHistory: manifestHistory,
  });

  const tipMembers = enabledMembersV1(current.payload);
  const verifiedTipEntries = arrayMapV1(
    tipMembers,
    (member): RegistryHistoryVerifiedTipEntryV1 =>
      CapturedObjectFreezeV1({
        providerId: member.providerId,
        registryEntryContentDigest: member.registryEntryContentDigest,
        runtimeAttestation: member.registryEntry.runtimeAttestation,
        historicallyVerifiedApproverPublicKeys:
          member.registryEntry.feasibilityApprovalKeys.publicKeyRecords,
      }),
  );
  CapturedObjectFreezeV1(verifiedTipEntries);
  const witness = createRegistryHistoryVerifiedCryptoWitnessInternalV1({
    strictCryptoCapability: prepared.strictCryptoCapability,
    suppliedHistoryTipRoot:
      suppliedHistoryTipRootEnvelope.payload.activeRoot,
    tipManifestGenerationId: current.generationId,
    tipManifestContentDigest: current.contentDigest,
    verifiedTipEntries,
  });

  assertProviderRegistryPreparedCopyLedgerZeroInternalV1(prepared.copyLedger);
  registerProviderRegistryProspectiveEntryTemporaryAdmissionContextInternalV1(
    CapturedObjectFreezeV1({
      closureIdentity: closure,
      strictCryptoCapability: prepared.strictCryptoCapability,
      manifestHistory,
      currentManifest: current.payload,
      currentRoot: suppliedHistoryTipRootEnvelope.payload.activeRoot,
      rootByKeyId,
      policy: bundle.providerTrustHistoryPolicy,
      retainedState: state,
    }),
  );
  return CapturedObjectFreezeV1({ closure, witness });
}

/**
 * Package-private one-shot prepared entry used by C09-1L.  The request handle
 * is consumed before validation.  A distinct witness handle is registered only
 * after complete Registry success; all incomplete registrations are removed in
 * `finally`.
 *
 * @internal
 */
async function diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
  requestIdentity: unknown,
  inputHandle: PreparedRegistryHistoryInputHandleV1,
  capabilityIdentity: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<ProviderRegistryManifestHistoryPreparedDiagnosticResultInternalV1> {
  let prepared: PreparedRegistryHistorySnapshotV1 | undefined;
  let successfulClosure:
    | ProviderRegistryManifestHistoryValidationV1
    | undefined;
  let witnessHandle: RegistryTrustWitnessHandleV1 | undefined;
  let committed = false;
  try {
    prepared = takePreparedRegistryHistoryInputInternalV1(
      requestIdentity,
      inputHandle,
      capabilityIdentity,
    );
    if (prepared === undefined) {
      return { ok: false, stage: "history_input", reason: "schema_invalid" };
    }
    const validated = await hardenProviderPointPromiseV1(
      validatePreparedInternalV1(prepared),
    );
    successfulClosure = validated.closure;
    witnessHandle = registerRegistryHistoryVerifiedWitnessInternalV1(
      successfulClosure,
      validated.witness,
      capabilityIdentity,
    );
    const value = CapturedObjectFreezeV1({
      closure: successfulClosure,
      registryTrustWitnessHandle: witnessHandle,
      copyLedger: prepared.copyLedger,
    });
    committed = true;
    return { ok: true, value };
  } catch (error) {
    if (error instanceof RegistryManifestHistoryDiagnosticSignal) {
      return { ok: false, stage: error.stage, reason: error.reason };
    }
    return { ok: false, stage: "history_input", reason: "schema_invalid" };
  } finally {
    discardPreparedRegistryHistoryInputInternalV1(
      requestIdentity,
      inputHandle,
      capabilityIdentity,
    );
    if (
      !committed &&
      successfulClosure !== undefined &&
      witnessHandle !== undefined
    ) {
      discardRegistryHistoryVerifiedWitnessInternalV1(
        successfulClosure,
        witnessHandle,
        capabilityIdentity,
      );
    }
  }
}

registerProviderRegistryManifestHistoryPreparedValidatorInternalV1(
  diagnoseProviderRegistryManifestHistoryPreparedInternalV1,
);

export async function diagnoseProviderRegistryManifestHistoryInternalV1(
  input: unknown,
): Promise<ProviderRegistryManifestHistoryDiagnosticResultV1> {
  try {
    return { ok: true, value: await validateInternalV1(input) };
  } catch (error) {
    if (error instanceof RegistryManifestHistoryDiagnosticSignal) {
      return { ok: false, stage: error.stage, reason: error.reason };
    }
    return { ok: false, stage: "history_input", reason: "schema_invalid" };
  }
}

export async function validateProviderRegistryManifestHistoryV1(
  input: unknown,
): Promise<ProviderRegistryManifestHistoryValidationV1> {
  const diagnostic =
    await diagnoseProviderRegistryManifestHistoryInternalV1(input);
  if (!diagnostic.ok) {
    throw new ProviderRegistryManifestHistoryValidationError();
  }
  return diagnostic.value;
}
