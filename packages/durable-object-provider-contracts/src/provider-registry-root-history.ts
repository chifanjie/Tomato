import { z } from "./zod-runtime.js";

import {
  ProviderBootstrapTrustBundleV1Schema,
  diagnoseProviderBootstrapTrustBundleRootClosureInternalV1,
  type ProviderBootstrapTrustBundleV1,
} from "./bootstrap-trust-bundle.js";
import {
  assertJsonDataTreeBeforeSchemaV1,
} from "./domain-crypto.js";
import {
  PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1,
  PROVIDER_REGISTRY_ROOT_RECOVERY_SIGNATURE_DOMAIN_V1,
  ProviderRegistryCompromiseRecoveryRootMetadataUnsignedClaimsV1Schema,
  ProviderRegistryPlannedRolloverRootMetadataUnsignedClaimsV1Schema,
  ProviderRegistryRecoveryKeyIdV1Schema,
  ProviderRegistryRootMetadataEnvelopeV1Schema,
  ProviderRegistryRootMetadataPinV1Schema,
  diagnoseProviderRegistryRootMetadataEnvelopeStructureInternalV1,
  projectProviderRegistryRootMetadataUnsignedClaimsV1,
  verifyProviderRegistryBootstrapRootSelfSignatureV1,
  verifyProviderRegistryRootSelfSignatureV1,
  type ProviderRegistryRecoveryPublicKeyV1,
  type ProviderRegistryRootMetadataEnvelopeV1,
  type ProviderRegistryRootMetadataPinV1,
  type ProviderRegistryRootMetadataV1,
  type ProviderRegistryRootPublicKeyV1,
} from "./provider-registry-trust.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ProviderRegistryRootKeyIdV1Schema,
} from "./primitives.js";
import {
  assertProviderRegistryPreparedCopyLedgerZeroInternalV1,
  registerProviderRegistryRootHistoryPreparedValidatorInternalV1,
  type ValidateProviderRegistryRootMetadataHistoryPreparedInternalV1Input,
} from "./provider-registry-history-prepared-handle-internal.js";
import {
  createProviderPointFulfilledPromiseV1,
  createProviderPointPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  getProviderStrictEd25519CryptoCapabilityBytesV1,
  validateProviderStrictEd25519PointWithCapabilityV1,
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedArrayPrototypeMapV1 = Array.prototype.map;
const CapturedArrayPrototypePushV1 = Array.prototype.push;
const CapturedArrayPrototypeSomeV1 = Array.prototype.some;
const CapturedArrayPrototypeSortV1 = Array.prototype.sort;
const CapturedMapV1 = Map;
const CapturedMapPrototypeGetV1 = Map.prototype.get;
const CapturedMapPrototypeHasV1 = Map.prototype.has;
const CapturedMapPrototypeSetV1 = Map.prototype.set;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetOwnPropertyDescriptorsV1 =
  Object.getOwnPropertyDescriptors;
const CapturedObjectGetOwnPropertySymbolsV1 = Object.getOwnPropertySymbols;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedObjectKeysV1 = Object.keys;
const CapturedObjectValuesV1 = Object.values;
const CapturedPromiseV1 = Promise;
const CapturedPromiseResolveV1 = Promise.resolve;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedRegExpPrototypeExecV1 = RegExp.prototype.exec;
const CapturedSetV1 = Set;
const CapturedSetPrototypeAddV1 = Set.prototype.add;
const CapturedSetPrototypeHasV1 = Set.prototype.has;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetPrototypeAddV1 = WeakSet.prototype.add;
const CapturedWeakSetPrototypeHasV1 = WeakSet.prototype.has;

function fulfilledPromiseV1<T>(value: T): Promise<T> {
  return createProviderPointFulfilledPromiseV1(value);
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

function mapGetV1<K, V>(map: Map<K, V>, key: K): V | undefined {
  return CapturedReflectApplyV1(CapturedMapPrototypeGetV1, map, [key]) as
    | V
    | undefined;
}

function mapHasV1<K, V>(map: Map<K, V>, key: K): boolean {
  return CapturedReflectApplyV1(CapturedMapPrototypeHasV1, map, [
    key,
  ]) as boolean;
}

function mapSetV1<K, V>(map: Map<K, V>, key: K, value: V): void {
  CapturedReflectApplyV1(CapturedMapPrototypeSetV1, map, [key, value]);
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

function promiseResolveV1<T>(value: T | PromiseLike<T>): Promise<Awaited<T>> {
  return CapturedReflectApplyV1(CapturedPromiseResolveV1, CapturedPromiseV1, [
    value,
  ]) as Promise<Awaited<T>>;
}

const BASE64URL_PREFIX = "base64url:";
const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const ROOT_CROSS_SIGNATURE_PATTERN =
  /^provider-root-cross-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const ROOT_RECOVERY_SIGNATURE_PATTERN =
  /^provider-root-recovery-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;

export const ProviderRegistryRootCrossSignatureWrapperV1Schema =
  z.strictObject({
    rootKeyId: ProviderRegistryRootKeyIdV1Schema,
    domain: z.literal(PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1),
    claims:
      ProviderRegistryPlannedRolloverRootMetadataUnsignedClaimsV1Schema,
  });
export type ProviderRegistryRootCrossSignatureWrapperV1 = z.infer<
  typeof ProviderRegistryRootCrossSignatureWrapperV1Schema
>;

export const ProviderRegistryRootRecoverySignatureWrapperV1Schema =
  z.strictObject({
    recoveryKeyId: ProviderRegistryRecoveryKeyIdV1Schema,
    domain: z.literal(PROVIDER_REGISTRY_ROOT_RECOVERY_SIGNATURE_DOMAIN_V1),
    claims: z.discriminatedUnion("activation", [
      ProviderRegistryPlannedRolloverRootMetadataUnsignedClaimsV1Schema,
      ProviderRegistryCompromiseRecoveryRootMetadataUnsignedClaimsV1Schema,
    ]),
  });
export type ProviderRegistryRootRecoverySignatureWrapperV1 = z.infer<
  typeof ProviderRegistryRootRecoverySignatureWrapperV1Schema
>;

export interface ValidateProviderRegistryRootMetadataHistoryV1Input {
  readonly bootstrapTrustBundle: ProviderBootstrapTrustBundleV1;
  readonly rootMetadataHistory: readonly ProviderRegistryRootMetadataEnvelopeV1[];
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
}

export interface ProviderRegistryRootMetadataHistoryValidationV1 {
  /** Structural/history validation is not production authorization. */
  readonly authority: "none_structure_and_history_only";
  readonly currentRootMetadata: ProviderRegistryRootMetadataPinV1;
  readonly retainedRootMetadataGenerationCount: number;
  readonly retainedRootMetadataCanonicalBytes: number;
  readonly rootMetadataHistory: readonly ProviderRegistryRootMetadataEnvelopeV1[];
}

export type ProviderRegistryRootHistoryDiagnosticStageV1 =
  | "history_input"
  | "history_limit"
  | "bootstrap_anchor"
  | "root_metadata_envelope"
  | "root_key_admission"
  | "history_predecessor"
  | "root_self_signature"
  | "root_cross_signature"
  | "root_recovery_signature"
  | "root_material_closure";

export type ProviderRegistryRootHistoryDiagnosticReasonV1 =
  | "schema_invalid"
  | "history_empty"
  | "history_generation_limit_exceeded"
  | "envelope_byte_limit_exceeded"
  | "history_total_byte_limit_exceeded"
  | "bootstrap_metadata_mismatch"
  | "envelope_mismatch"
  | "generation_not_contiguous"
  | "predecessor_pin_mismatch"
  | "root_key_material_alias"
  | "point_admission_failed"
  | "self_signature_invalid"
  | "cross_signature_invalid"
  | "recovery_quorum_invalid";

export interface ProviderRegistryRootHistoryDiagnosticFailureV1 {
  readonly ok: false;
  readonly stage: ProviderRegistryRootHistoryDiagnosticStageV1;
  readonly reason: ProviderRegistryRootHistoryDiagnosticReasonV1;
}

export interface ProviderRegistryRootHistoryDiagnosticSuccessV1 {
  readonly ok: true;
  readonly value: ProviderRegistryRootMetadataHistoryValidationV1;
}

export type ProviderRegistryRootHistoryDiagnosticResultV1 =
  | ProviderRegistryRootHistoryDiagnosticSuccessV1
  | ProviderRegistryRootHistoryDiagnosticFailureV1;

export class ProviderRegistryRootHistoryValidationError extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider registry root metadata history validation failed");
    this.name = "ProviderRegistryRootHistoryValidationError";
  }
}

class RootHistoryDiagnosticSignal extends Error {
  constructor(
    readonly stage: ProviderRegistryRootHistoryDiagnosticStageV1,
    readonly reason: ProviderRegistryRootHistoryDiagnosticReasonV1,
  ) {
    super("root history diagnostic");
  }
}

function fail(
  stage: ProviderRegistryRootHistoryDiagnosticStageV1,
  reason: ProviderRegistryRootHistoryDiagnosticReasonV1,
): never {
  throw new RootHistoryDiagnosticSignal(stage, reason);
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function decodeCanonicalPublicKeyBytes32V1(value: string): Uint8Array {
  if (!value.startsWith(BASE64URL_PREFIX)) {
    throw new TypeError("invalid canonical public key bytes");
  }
  const body = value.slice(BASE64URL_PREFIX.length);
  const decoded = new Uint8Array(32);
  let accumulator = 0;
  let availableBits = 0;
  let outputOffset = 0;

  for (const character of body) {
    const digit = BASE64URL_ALPHABET.indexOf(character);
    if (digit < 0) throw new TypeError("invalid canonical public key bytes");
    accumulator = (accumulator << 6) | digit;
    availableBits += 6;
    if (availableBits >= 8) {
      availableBits -= 8;
      if (outputOffset >= decoded.byteLength) {
        throw new TypeError("invalid canonical public key bytes");
      }
      decoded[outputOffset] = (accumulator >>> availableBits) & 0xff;
      outputOffset += 1;
      accumulator &= (1 << availableBits) - 1;
    }
  }

  if (outputOffset !== 32 || availableBits !== 2 || accumulator !== 0) {
    throw new TypeError("public key must decode to exactly 32 canonical bytes");
  }
  return decoded;
}

function lowerHexToBytes(hex: string): Uint8Array {
  if (!regExpTestV1(/^[0-9a-f]{128}$/u, hex)) {
    throw new TypeError("invalid Ed25519 signature bytes");
  }
  const bytes = new Uint8Array(64);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function deepFreezeJson<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    const children = CapturedObjectValuesV1(value);
    for (let index = 0; index < children.length; index += 1) {
      deepFreezeJson(children[index]);
    }
    CapturedObjectFreezeV1(value);
  }
  return value;
}

function canonicalJsonEqual(left: unknown, right: unknown): boolean {
  return bytesEqual(
    canonicalizeJcsSafeIntegerUtf8V1(left),
    canonicalizeJcsSafeIntegerUtf8V1(right),
  );
}

function requireExactInput(
  input: unknown,
): ValidateProviderRegistryRootMetadataHistoryV1Input {
  if (input === null || typeof input !== "object" || CapturedArrayIsArrayV1(input)) {
    throw new TypeError("invalid root history input");
  }
  let prototype: object | null;
  let symbols: symbol[];
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = CapturedObjectGetPrototypeOfV1(input) as object | null;
    symbols = CapturedObjectGetOwnPropertySymbolsV1(input);
    descriptors = CapturedObjectGetOwnPropertyDescriptorsV1(input);
  } catch {
    throw new TypeError("invalid root history input");
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("invalid root history input");
  }
  if (symbols.length !== 0) {
    throw new TypeError("invalid root history input");
  }
  const keys = arraySortV1(CapturedObjectKeysV1(descriptors));
  const expected = [
    "bootstrapTrustBundle",
    "rootMetadataHistory",
    "strictCryptoCapability",
  ];
  if (
    keys.length !== expected.length ||
    arraySomeV1(keys, (key, index) => key !== expected[index])
  ) {
    throw new TypeError("invalid root history input");
  }
  for (const key of expected) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError("invalid root history input");
    }
  }
  return {
    bootstrapTrustBundle: descriptors.bootstrapTrustBundle!
      .value as ProviderBootstrapTrustBundleV1,
    rootMetadataHistory: descriptors.rootMetadataHistory!
      .value as readonly ProviderRegistryRootMetadataEnvelopeV1[],
    strictCryptoCapability: descriptors.strictCryptoCapability!
      .value as ProviderStrictEd25519OpaqueCapabilityV1,
  };
}

function snapshotRootMetadataHistoryCandidatesV1(
  input: unknown,
  maxGenerationCount: number,
): readonly unknown[] {
  let isArray: boolean;
  let prototype: object | null;
  let symbols: symbol[];
  let preliminaryLength: number;
  let descriptors: PropertyDescriptorMap;
  try {
    isArray = CapturedArrayIsArrayV1(input);
    if (!isArray || input === null || typeof input !== "object") {
      throw new TypeError("root metadata history must be an array");
    }
    prototype = CapturedObjectGetPrototypeOfV1(input) as object | null;
    if (prototype !== Array.prototype) {
      throw new TypeError("root metadata history must be a plain array");
    }
    const lengthDescriptor = CapturedObjectGetOwnPropertyDescriptorV1(
      input,
      "length",
    );
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      lengthDescriptor.enumerable !== false ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) {
      throw new TypeError("root metadata history has an invalid length");
    }
    preliminaryLength = lengthDescriptor.value as number;
    if (preliminaryLength > maxGenerationCount) {
      return fail(
        "history_limit",
        "history_generation_limit_exceeded",
      );
    }
    symbols = CapturedObjectGetOwnPropertySymbolsV1(input);
    descriptors = CapturedObjectGetOwnPropertyDescriptorsV1(input);
  } catch (error) {
    if (error instanceof RootHistoryDiagnosticSignal) throw error;
    throw new TypeError("root metadata history must be an array");
  }
  if (symbols.length !== 0) {
    throw new TypeError("root metadata history must be a plain array");
  }

  const lengthDescriptor = descriptors.length;
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.enumerable !== false ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    lengthDescriptor.value !== preliminaryLength
  ) {
    throw new TypeError("root metadata history has an invalid length");
  }
  const length = lengthDescriptor.value as number;
  if (length > maxGenerationCount) {
    return fail(
      "history_limit",
      "history_generation_limit_exceeded",
    );
  }

  const keys = CapturedObjectKeysV1(descriptors);
  if (keys.length !== length + 1) {
    throw new TypeError(
      "root metadata history must contain only dense array elements",
    );
  }
  const snapshot = new Array<unknown>(length);
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError("root metadata history must be dense");
    }
    snapshot[index] = descriptor.value;
  }
  return CapturedObjectFreezeV1(snapshot);
}

function snapshotBoundedEnvelopeJsonV1(
  input: unknown,
  maxCanonicalBytes: number,
): unknown {
  const seen = new CapturedWeakSetV1<object>();
  let canonicalByteLowerBound = 0;

  function chargeCanonicalLowerBound(units: number): void {
    canonicalByteLowerBound += units;
    if (canonicalByteLowerBound > maxCanonicalBytes) {
      return fail(
        "history_limit",
        "envelope_byte_limit_exceeded",
      );
    }
  }

  function snapshot(value: unknown): unknown {
    if (value === null) {
      chargeCanonicalLowerBound(4);
      return null;
    }
    if (typeof value === "string") {
      chargeCanonicalLowerBound(value.length + 2);
      return value;
    }
    if (typeof value === "boolean") {
      chargeCanonicalLowerBound(value ? 4 : 5);
      return value;
    }
    if (typeof value === "number") {
      chargeCanonicalLowerBound(1);
      return value;
    }
    if (typeof value !== "object") {
      throw new TypeError("root metadata envelope must be JSON data");
    }
    if (weakSetHasV1(seen, value)) {
      throw new TypeError("root metadata envelope must be a JSON tree");
    }
    weakSetAddV1(seen, value);

    let isArray: boolean;
    let prototype: object | null;
    let symbols: symbol[];
    let descriptors: PropertyDescriptorMap;
    try {
      isArray = CapturedArrayIsArrayV1(value);
      prototype = CapturedObjectGetPrototypeOfV1(value) as object | null;
      symbols = CapturedObjectGetOwnPropertySymbolsV1(value);
      if (isArray) {
        const lengthDescriptor = CapturedObjectGetOwnPropertyDescriptorV1(
          value,
          "length",
        );
        if (
          lengthDescriptor === undefined ||
          !("value" in lengthDescriptor) ||
          !Number.isSafeInteger(lengthDescriptor.value) ||
          lengthDescriptor.value < 0 ||
          lengthDescriptor.value > maxCanonicalBytes
        ) {
          return fail(
            "history_limit",
            "envelope_byte_limit_exceeded",
          );
        }
      }
      descriptors = CapturedObjectGetOwnPropertyDescriptorsV1(value);
    } catch (error) {
      if (error instanceof RootHistoryDiagnosticSignal) throw error;
      throw new TypeError("root metadata envelope must be JSON data");
    }
    if (
      (isArray && prototype !== Array.prototype) ||
      (!isArray &&
        prototype !== Object.prototype &&
        prototype !== null) ||
      symbols.length !== 0
    ) {
      throw new TypeError(
        "root metadata envelope must use plain JSON containers",
      );
    }

    if (isArray) {
      const lengthDescriptor = descriptors.length;
      if (
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        lengthDescriptor.enumerable !== false ||
        !Number.isSafeInteger(lengthDescriptor.value) ||
        lengthDescriptor.value < 0 ||
        lengthDescriptor.value > maxCanonicalBytes
      ) {
        return fail(
          "history_limit",
          "envelope_byte_limit_exceeded",
        );
      }
      const length = lengthDescriptor.value as number;
      if (CapturedObjectKeysV1(descriptors).length !== length + 1) {
        throw new TypeError(
          "root metadata envelope arrays must be dense",
        );
      }
      chargeCanonicalLowerBound(2 + Math.max(0, length - 1));
      const output = new Array<unknown>(length);
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true
        ) {
          throw new TypeError(
            "root metadata envelope arrays must be dense",
          );
        }
        output[index] = snapshot(descriptor.value);
      }
      return output;
    }

    const output: Record<string, unknown> = {};
    const keys = CapturedObjectKeysV1(descriptors);
    chargeCanonicalLowerBound(2 + Math.max(0, keys.length - 1));
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        throw new TypeError(
          "root metadata envelope properties must be enumerable data properties",
        );
      }
      chargeCanonicalLowerBound(key.length + 3);
      Object.defineProperty(output, key, {
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

export function createProviderRegistryRootCrossSignatureMessageV1(
  input: unknown,
): Uint8Array {
  const claims = projectProviderRegistryRootMetadataUnsignedClaimsV1(input);
  if (claims.activation !== "planned_rollover") {
    throw new TypeError(
      "only planned rollover metadata has a predecessor cross signer",
    );
  }
  const wrapper = ProviderRegistryRootCrossSignatureWrapperV1Schema.parse({
    rootKeyId: claims.predecessor.rootKeyId,
    domain: PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1,
    claims,
  });
  return canonicalizeJcsSafeIntegerUtf8V1([
    PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1,
    wrapper,
  ]);
}

export function createProviderRegistryRootRecoverySignatureMessageV1(
  input: unknown,
  recoveryKeyId: unknown,
): Uint8Array {
  const claims = projectProviderRegistryRootMetadataUnsignedClaimsV1(input);
  if (claims.activation === "bootstrap") {
    throw new TypeError("bootstrap metadata has no recovery quorum");
  }
  const wrapper = ProviderRegistryRootRecoverySignatureWrapperV1Schema.parse({
    recoveryKeyId: ProviderRegistryRecoveryKeyIdV1Schema.parse(recoveryKeyId),
    domain: PROVIDER_REGISTRY_ROOT_RECOVERY_SIGNATURE_DOMAIN_V1,
    claims,
  });
  return canonicalizeJcsSafeIntegerUtf8V1([
    PROVIDER_REGISTRY_ROOT_RECOVERY_SIGNATURE_DOMAIN_V1,
    wrapper,
  ]);
}

function parseSignature(
  signature: string,
  pattern: RegExp,
): { readonly keyId: string; readonly signatureBytes: Uint8Array } {
  const match = regExpExecV1(pattern, signature);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    throw new TypeError("invalid root metadata signature");
  }
  return { keyId: match[1], signatureBytes: lowerHexToBytes(match[2]) };
}

function metadataPin(
  envelope: ProviderRegistryRootMetadataEnvelopeV1,
): ProviderRegistryRootMetadataPinV1 {
  return ProviderRegistryRootMetadataPinV1Schema.parse({
    locatorProfile: "installation_provider_registry_root_metadata_v1",
    rootGeneration: envelope.rootGeneration,
    rootKeyId: envelope.rootKeyId,
    contentDigest: envelope.contentDigest,
  });
}

function admitPoint(
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
  publicKeyBytes: string,
): Promise<boolean> {
  return validateProviderStrictEd25519PointWithCapabilityV1(
    capability,
    decodeCanonicalPublicKeyBytes32V1(publicKeyBytes),
  );
}

function verifyCrossSignature(
  metadata: ProviderRegistryRootMetadataV1 & {
    readonly activation: "planned_rollover";
  },
  predecessorRoot: ProviderRegistryRootPublicKeyV1,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<boolean> {
  const parsed = parseSignature(
    metadata.predecessorCrossSignature,
    ROOT_CROSS_SIGNATURE_PATTERN,
  );
  if (
    parsed.keyId !== metadata.predecessor.rootKeyId ||
    parsed.keyId !== predecessorRoot.rootKeyId
  ) {
    return fulfilledPromiseV1(false);
  }
  return verifyRawEd25519WithCapabilityV1(
    capability,
    decodeCanonicalPublicKeyBytes32V1(predecessorRoot.publicKeyBytes),
    createProviderRegistryRootCrossSignatureMessageV1(metadata),
    parsed.signatureBytes,
  );
}

function verifyRecoveryQuorum(
  metadata: Exclude<
    ProviderRegistryRootMetadataV1,
    { readonly activation: "bootstrap" }
  >,
  recoveryKeys: readonly ProviderRegistryRecoveryPublicKeyV1[],
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<boolean> {
  const operation = (async () => {
    if (metadata.recoverySignatures.length !== 2) return false;
    const recoveryById = mapFromEntriesV1(
      arrayMapV1(recoveryKeys, (key) => [key.recoveryKeyId, key] as const),
    );
    let previousKeyId: string | undefined;
    for (const signature of metadata.recoverySignatures) {
      const parsed = parseSignature(signature, ROOT_RECOVERY_SIGNATURE_PATTERN);
      if (
        (previousKeyId !== undefined && previousKeyId >= parsed.keyId) ||
        !mapHasV1(
          recoveryById,
          ProviderRegistryRecoveryKeyIdV1Schema.parse(parsed.keyId),
        )
      ) {
        return false;
      }
      const recoveryKey = mapGetV1(
        recoveryById,
        ProviderRegistryRecoveryKeyIdV1Schema.parse(parsed.keyId),
      )!;
      if (
        !(await verifyRawEd25519WithCapabilityV1(
          capability,
          decodeCanonicalPublicKeyBytes32V1(recoveryKey.publicKeyBytes),
          createProviderRegistryRootRecoverySignatureMessageV1(
            metadata,
            recoveryKey.recoveryKeyId,
          ),
          parsed.signatureBytes,
        ))
      ) {
        return false;
      }
      previousKeyId = parsed.keyId;
    }
    return true;
  })();
  return hardenProviderPointPromiseV1(operation);
}

function requireCryptoValidationV1(
  stage: ProviderRegistryRootHistoryDiagnosticStageV1,
  reason: ProviderRegistryRootHistoryDiagnosticReasonV1,
  validate: () => Promise<boolean>,
): Promise<void> {
  return createProviderPointPromiseV1<void>((resolve, reject) => {
    const rejectValidation = (error: unknown): void => {
      if (error instanceof RootHistoryDiagnosticSignal) {
        reject(error);
        return;
      }
      try {
        fail(stage, reason);
      } catch (diagnostic) {
        reject(diagnostic);
      }
    };

    let validation: Promise<boolean>;
    try {
      validation = hardenProviderPointPromiseV1(validate());
    } catch (error) {
      rejectValidation(error);
      return;
    }

    void (async (): Promise<void> => {
      try {
        const accepted = await validation;
        if (accepted) {
          resolve();
          return;
        }
        rejectValidation(undefined);
      } catch (error) {
        rejectValidation(error);
      }
    })();
  });
}

async function validateInternal(
  input: unknown,
): Promise<ProviderRegistryRootMetadataHistoryValidationV1> {
  let exactInput: ValidateProviderRegistryRootMetadataHistoryV1Input;
  try {
    exactInput = requireExactInput(input);
  } catch {
    return fail("history_input", "schema_invalid");
  }

  let bundle: ProviderBootstrapTrustBundleV1;
  try {
    assertJsonDataTreeBeforeSchemaV1(
      exactInput.bootstrapTrustBundle,
    );
    bundle = ProviderBootstrapTrustBundleV1Schema.parse(
      exactInput.bootstrapTrustBundle,
    );
  } catch {
    return fail("bootstrap_anchor", "schema_invalid");
  }
  const rootClosure =
    diagnoseProviderBootstrapTrustBundleRootClosureInternalV1(bundle);
  if (!rootClosure.ok) {
    return fail("bootstrap_anchor", "schema_invalid");
  }

  try {
    if (
      !bytesEqual(
        canonicalizeJcsSafeIntegerUtf8V1(bundle.strictCryptoCapability),
        getProviderStrictEd25519CryptoCapabilityBytesV1(
          exactInput.strictCryptoCapability,
        ),
      )
    ) {
      return fail("bootstrap_anchor", "schema_invalid");
    }
  } catch (error) {
    if (error instanceof RootHistoryDiagnosticSignal) throw error;
    return fail("bootstrap_anchor", "schema_invalid");
  }

  let historyUnknown: readonly unknown[];
  try {
    historyUnknown = snapshotRootMetadataHistoryCandidatesV1(
      exactInput.rootMetadataHistory,
      bundle.providerTrustHistoryPolicy
        .maxRootMetadataGenerationCountPerInstallationIdentity,
    );
  } catch (error) {
    if (error instanceof RootHistoryDiagnosticSignal) throw error;
    return fail("history_input", "schema_invalid");
  }
  if (historyUnknown.length === 0) {
    return fail("history_input", "history_empty");
  }

  const { root, metadata: bootstrapMetadata, recoveryKeys } =
    rootClosure.value;
  await requireCryptoValidationV1(
    "root_key_admission",
    "point_admission_failed",
    () =>
      admitPoint(
        exactInput.strictCryptoCapability,
        root.publicKeyBytes,
      ),
  );
  for (const recoveryKey of recoveryKeys) {
    await requireCryptoValidationV1(
      "root_key_admission",
      "point_admission_failed",
      () =>
        admitPoint(
          exactInput.strictCryptoCapability,
          recoveryKey.publicKeyBytes,
        ),
    );
  }
  await requireCryptoValidationV1(
    "root_self_signature",
    "self_signature_invalid",
    () =>
      verifyProviderRegistryBootstrapRootSelfSignatureV1(
        bootstrapMetadata,
        exactInput.strictCryptoCapability,
      ),
  );

  const history: ProviderRegistryRootMetadataEnvelopeV1[] = [];
  const seenRootMaterials = new CapturedSetV1<string>();
  const recoveryMaterials = setFromValuesV1(
    arrayMapV1(recoveryKeys, (key) => key.publicKeyBytes),
  );
  let retainedCanonicalBytes = 0;

  for (let index = 0; index < historyUnknown.length; index += 1) {
    let envelope: ProviderRegistryRootMetadataEnvelopeV1;
    let canonicalBytes: Uint8Array;
    try {
      const envelopeSnapshot = snapshotBoundedEnvelopeJsonV1(
        historyUnknown[index],
        bundle.providerTrustHistoryPolicy
          .maxSingleTrustEnvelopeLogicalBytes,
      );
      canonicalBytes = canonicalizeJcsSafeIntegerUtf8V1(
        envelopeSnapshot,
      );
      if (
        canonicalBytes.byteLength >
        bundle.providerTrustHistoryPolicy.maxSingleTrustEnvelopeLogicalBytes
      ) {
        return fail(
          "history_limit",
          "envelope_byte_limit_exceeded",
        );
      }
      const envelopeDiagnostic =
        diagnoseProviderRegistryRootMetadataEnvelopeStructureInternalV1(
          envelopeSnapshot,
        );
      if (!envelopeDiagnostic.ok) {
        return fail(
          "root_metadata_envelope",
          envelopeDiagnostic.reason === "schema_invalid"
            ? "schema_invalid"
            : "envelope_mismatch",
        );
      }
      envelope = envelopeDiagnostic.value;
    } catch (error) {
      if (error instanceof RootHistoryDiagnosticSignal) throw error;
      return fail("root_metadata_envelope", "schema_invalid");
    }
    const nextRetainedCanonicalBytes =
      retainedCanonicalBytes + canonicalBytes.byteLength;
    if (
      nextRetainedCanonicalBytes >
      bundle.providerTrustHistoryPolicy
        .maxTotalTrustHistoryLogicalBytesPerInstallationIdentity
    ) {
      return fail(
        "history_limit",
        "history_total_byte_limit_exceeded",
      );
    }
    retainedCanonicalBytes = nextRetainedCanonicalBytes;

    const expectedGeneration = index + 1;
    if (envelope.rootGeneration !== expectedGeneration) {
      return fail("history_predecessor", "generation_not_contiguous");
    }

    if (index === 0) {
      if (!canonicalJsonEqual(envelope, bootstrapMetadata)) {
        return fail("bootstrap_anchor", "bootstrap_metadata_mismatch");
      }
    } else {
      const predecessor = history[index - 1]!;
      if (
        envelope.payload.activation === "bootstrap" ||
        envelope.payload.predecessor.rootGeneration !==
          predecessor.rootGeneration ||
        envelope.payload.predecessor.rootKeyId !== predecessor.rootKeyId ||
        envelope.payload.predecessor.contentDigest !== predecessor.contentDigest
      ) {
        return fail("history_predecessor", "predecessor_pin_mismatch");
      }
    }

    const payload = envelope.payload;
    const activeRoot = payload.activeRoot;
    if (
      setHasV1(seenRootMaterials, activeRoot.publicKeyBytes) ||
      setHasV1(recoveryMaterials, activeRoot.publicKeyBytes)
    ) {
      return fail("root_material_closure", "root_key_material_alias");
    }
    setAddV1(seenRootMaterials, activeRoot.publicKeyBytes);
    await requireCryptoValidationV1(
      "root_key_admission",
      "point_admission_failed",
      () =>
        admitPoint(
          exactInput.strictCryptoCapability,
          activeRoot.publicKeyBytes,
        ),
    );
    await requireCryptoValidationV1(
      "root_self_signature",
      "self_signature_invalid",
      () =>
        verifyProviderRegistryRootSelfSignatureV1(
          payload,
          exactInput.strictCryptoCapability,
        ),
    );
    if (payload.activation === "planned_rollover") {
      const predecessor = history[index - 1];
      await requireCryptoValidationV1(
        "root_cross_signature",
        "cross_signature_invalid",
        () =>
          predecessor === undefined
            ? promiseResolveV1(false)
            : verifyCrossSignature(
                payload,
                predecessor.payload.activeRoot,
                exactInput.strictCryptoCapability,
              ),
      );
    }
    if (payload.activation !== "bootstrap") {
      await requireCryptoValidationV1(
        "root_recovery_signature",
        "recovery_quorum_invalid",
        () =>
          verifyRecoveryQuorum(
            payload,
            recoveryKeys,
            exactInput.strictCryptoCapability,
          ),
      );
    }
    arrayPushV1(history, envelope);
  }

  const current = history[history.length - 1]!;
  return deepFreezeJson({
    authority: "none_structure_and_history_only" as const,
    currentRootMetadata: metadataPin(current),
    retainedRootMetadataGenerationCount: history.length,
    retainedRootMetadataCanonicalBytes: retainedCanonicalBytes,
    rootMetadataHistory: history,
  });
}

/**
 * Package-private C09-1L Root-history core.  Its input is already the single
 * detached/frozen capsule graph, so this path never calls the public wrapper or
 * either Root snapshot helper and never retains a parallel history graph.
 *
 * @internal
 */
async function validateProviderRegistryRootMetadataHistoryPreparedInternalV1(
  input: ValidateProviderRegistryRootMetadataHistoryPreparedInternalV1Input,
): Promise<ProviderRegistryRootMetadataHistoryValidationV1> {
  assertProviderRegistryPreparedCopyLedgerZeroInternalV1(input.copyLedger);

  let bundle: ProviderBootstrapTrustBundleV1;
  try {
    assertJsonDataTreeBeforeSchemaV1(input.bootstrapTrustBundle);
    if (!ProviderBootstrapTrustBundleV1Schema.safeParse(input.bootstrapTrustBundle).success) {
      return fail("bootstrap_anchor", "schema_invalid");
    }
    // Keep the detached identity in the prepared data flow.  The Zod result
    // above is a short-lived assertion only.
    bundle = input.bootstrapTrustBundle;
  } catch {
    return fail("bootstrap_anchor", "schema_invalid");
  }
  const rootClosure =
    diagnoseProviderBootstrapTrustBundleRootClosureInternalV1(bundle);
  if (!rootClosure.ok) {
    return fail("bootstrap_anchor", "schema_invalid");
  }

  try {
    if (
      !bytesEqual(
        canonicalizeJcsSafeIntegerUtf8V1(bundle.strictCryptoCapability),
        getProviderStrictEd25519CryptoCapabilityBytesV1(
          input.strictCryptoCapability,
        ),
      )
    ) {
      return fail("bootstrap_anchor", "schema_invalid");
    }
  } catch (error) {
    if (error instanceof RootHistoryDiagnosticSignal) throw error;
    return fail("bootstrap_anchor", "schema_invalid");
  }

  const history = input.rootMetadataHistory;
  if (!CapturedArrayIsArrayV1(history) || !CapturedObjectIsFrozenV1(history)) {
    return fail("history_input", "schema_invalid");
  }
  if (
    history.length >
    bundle.providerTrustHistoryPolicy
      .maxRootMetadataGenerationCountPerInstallationIdentity
  ) {
    return fail("history_limit", "history_generation_limit_exceeded");
  }
  if (history.length === 0) {
    return fail("history_input", "history_empty");
  }

  const { root, metadata: bootstrapMetadata, recoveryKeys } =
    rootClosure.value;
  await requireCryptoValidationV1(
    "root_key_admission",
    "point_admission_failed",
    () => admitPoint(input.strictCryptoCapability, root.publicKeyBytes),
  );
  for (const recoveryKey of recoveryKeys) {
    await requireCryptoValidationV1(
      "root_key_admission",
      "point_admission_failed",
      () =>
        admitPoint(
          input.strictCryptoCapability,
          recoveryKey.publicKeyBytes,
        ),
    );
  }
  await requireCryptoValidationV1(
    "root_self_signature",
    "self_signature_invalid",
    () =>
      verifyProviderRegistryBootstrapRootSelfSignatureV1(
        bootstrapMetadata,
        input.strictCryptoCapability,
      ),
  );

  const seenRootMaterials = new CapturedSetV1<string>();
  const recoveryMaterials = setFromValuesV1(
    arrayMapV1(recoveryKeys, (key) => key.publicKeyBytes),
  );
  let retainedCanonicalBytes = 0;

  for (let index = 0; index < history.length; index += 1) {
    const candidate = history[index]!;
    let canonicalBytes: Uint8Array;
    try {
      if (!CapturedObjectIsFrozenV1(candidate)) {
        return fail("root_metadata_envelope", "schema_invalid");
      }
      canonicalBytes = canonicalizeJcsSafeIntegerUtf8V1(candidate);
      if (
        canonicalBytes.byteLength >
        bundle.providerTrustHistoryPolicy.maxSingleTrustEnvelopeLogicalBytes
      ) {
        return fail(
          "history_limit",
          "envelope_byte_limit_exceeded",
        );
      }
      const envelopeDiagnostic =
        diagnoseProviderRegistryRootMetadataEnvelopeStructureInternalV1(
          candidate,
        );
      if (!envelopeDiagnostic.ok) {
        return fail(
          "root_metadata_envelope",
          envelopeDiagnostic.reason === "schema_invalid"
            ? "schema_invalid"
            : "envelope_mismatch",
        );
      }
      // Do not substitute the Zod/diagnostic projection for the detached
      // Envelope identity retained by the prepared closure.
    } catch (error) {
      if (error instanceof RootHistoryDiagnosticSignal) throw error;
      return fail("root_metadata_envelope", "schema_invalid");
    }
    const nextRetainedCanonicalBytes =
      retainedCanonicalBytes + canonicalBytes.byteLength;
    if (
      nextRetainedCanonicalBytes >
      bundle.providerTrustHistoryPolicy
        .maxTotalTrustHistoryLogicalBytesPerInstallationIdentity
    ) {
      return fail(
        "history_limit",
        "history_total_byte_limit_exceeded",
      );
    }
    retainedCanonicalBytes = nextRetainedCanonicalBytes;

    const envelope = candidate;
    const expectedGeneration = index + 1;
    if (envelope.rootGeneration !== expectedGeneration) {
      return fail("history_predecessor", "generation_not_contiguous");
    }

    if (index === 0) {
      if (!canonicalJsonEqual(envelope, bootstrapMetadata)) {
        return fail("bootstrap_anchor", "bootstrap_metadata_mismatch");
      }
    } else {
      const predecessor = history[index - 1]!;
      if (
        envelope.payload.activation === "bootstrap" ||
        envelope.payload.predecessor.rootGeneration !==
          predecessor.rootGeneration ||
        envelope.payload.predecessor.rootKeyId !== predecessor.rootKeyId ||
        envelope.payload.predecessor.contentDigest !== predecessor.contentDigest
      ) {
        return fail("history_predecessor", "predecessor_pin_mismatch");
      }
    }

    const payload = envelope.payload;
    const activeRoot = payload.activeRoot;
    if (
      setHasV1(seenRootMaterials, activeRoot.publicKeyBytes) ||
      setHasV1(recoveryMaterials, activeRoot.publicKeyBytes)
    ) {
      return fail("root_material_closure", "root_key_material_alias");
    }
    setAddV1(seenRootMaterials, activeRoot.publicKeyBytes);
    await requireCryptoValidationV1(
      "root_key_admission",
      "point_admission_failed",
      () =>
        admitPoint(
          input.strictCryptoCapability,
          activeRoot.publicKeyBytes,
        ),
    );
    await requireCryptoValidationV1(
      "root_self_signature",
      "self_signature_invalid",
      () =>
        verifyProviderRegistryRootSelfSignatureV1(
          payload,
          input.strictCryptoCapability,
        ),
    );
    if (payload.activation === "planned_rollover") {
      const predecessor = history[index - 1];
      await requireCryptoValidationV1(
        "root_cross_signature",
        "cross_signature_invalid",
        () =>
          predecessor === undefined
            ? promiseResolveV1(false)
            : verifyCrossSignature(
                payload,
                predecessor.payload.activeRoot,
                input.strictCryptoCapability,
              ),
      );
    }
    if (payload.activation !== "bootstrap") {
      await requireCryptoValidationV1(
        "root_recovery_signature",
        "recovery_quorum_invalid",
        () =>
          verifyRecoveryQuorum(
            payload,
            recoveryKeys,
            input.strictCryptoCapability,
          ),
      );
    }
  }

  const current = history[history.length - 1]!;
  const currentRootMetadata = deepFreezeJson(metadataPin(current));
  assertProviderRegistryPreparedCopyLedgerZeroInternalV1(input.copyLedger);
  return CapturedObjectFreezeV1({
    authority: "none_structure_and_history_only" as const,
    currentRootMetadata,
    retainedRootMetadataGenerationCount: history.length,
    retainedRootMetadataCanonicalBytes: retainedCanonicalBytes,
    rootMetadataHistory: history,
  });
}

registerProviderRegistryRootHistoryPreparedValidatorInternalV1(
  validateProviderRegistryRootMetadataHistoryPreparedInternalV1,
);

export async function diagnoseProviderRegistryRootMetadataHistoryInternalV1(
  input: unknown,
): Promise<ProviderRegistryRootHistoryDiagnosticResultV1> {
  try {
    return { ok: true, value: await validateInternal(input) };
  } catch (error) {
    if (error instanceof RootHistoryDiagnosticSignal) {
      return { ok: false, stage: error.stage, reason: error.reason };
    }
    return {
      ok: false,
      stage: "history_input",
      reason: "schema_invalid",
    };
  }
}

export async function validateProviderRegistryRootMetadataHistoryV1(
  input: unknown,
): Promise<ProviderRegistryRootMetadataHistoryValidationV1> {
  const diagnostic =
    await diagnoseProviderRegistryRootMetadataHistoryInternalV1(input);
  if (!diagnostic.ok) {
    throw new ProviderRegistryRootHistoryValidationError();
  }
  return diagnostic.value;
}
