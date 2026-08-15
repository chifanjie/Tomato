/**
 * Package-private D-41 migration-history quota reference machine.
 *
 * The machine authenticates complete read-only quota cuts and derives the
 * none-authority sizing/admission projection used before the first migration
 * side effect. Raw Envelope bytes, record tokens, high-water tokens and the
 * host itself never become properties of a returned value.
 */

import { z } from "./zod-runtime.js";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
} from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import {
  CanonicalByteStringV1Schema,
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex32V1Schema,
  type CanonicalByteStringV1,
  type ContentDigestV1,
  type InstallationIdentityGenerationIdV1,
  type KeyedStateTokenV1,
} from "./primitives.js";
import {
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_HISTORY_QUOTA_ADMISSION_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_ACCOUNT_STATE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_EVENT_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_EVENT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_LEDGER_RECORD_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RESERVATION_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RESERVATION_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundsReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaChargeAmountsReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutReferenceCandidateV1Schema,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionVectorDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveChargedUsageReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountSetDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaObservationContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutContentDigestReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundsReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaChargeAmountsReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutReferenceCandidateV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";
import {
  captureProviderPointDetachedExactDataObjectV1,
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  createProviderPointRejectedPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedArrayPrototypePushV1 = Array.prototype.push;
const CapturedArrayPrototypeSliceV1 = Array.prototype.slice;
const CapturedArrayPrototypeSortV1 = Array.prototype.sort;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedJsonParseV1 = JSON.parse;
const CapturedMapV1 = Map;
const CapturedMapPrototypeClearV1 = Map.prototype.clear;
const CapturedMapPrototypeDeleteV1 = Map.prototype.delete;
const CapturedMapPrototypeForEachV1 = Map.prototype.forEach;
const CapturedMapPrototypeGetV1 = Map.prototype.get;
const CapturedMapPrototypeHasV1 = Map.prototype.has;
const CapturedMapPrototypeSetV1 = Map.prototype.set;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 = Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedPromiseV1 = Promise;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedSetV1 = Set;
const CapturedSetPrototypeAddV1 = Set.prototype.add;
const CapturedSetPrototypeHasV1 = Set.prototype.has;
const CapturedStringFromCharCodeV1 = String.fromCharCode;
const CapturedStringPrototypeCharCodeAtV1 = String.prototype.charCodeAt;
const CapturedStringPrototypeIndexOfV1 = String.prototype.indexOf;
const CapturedStringPrototypeSliceV1 = String.prototype.slice;
const CapturedTextDecoderV1 = TextDecoder;
const CapturedTextDecoderPrototypeDecodeV1 = TextDecoder.prototype.decode;
const CapturedTextEncoderV1 = TextEncoder;
const CapturedTextEncoderPrototypeEncodeV1 = TextEncoder.prototype.encode;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapPrototypeDeleteV1 = WeakMap.prototype.delete;
const CapturedWeakMapPrototypeGetV1 = WeakMap.prototype.get;
const CapturedWeakMapPrototypeHasV1 = WeakMap.prototype.has;
const CapturedWeakMapPrototypeSetV1 = WeakMap.prototype.set;
const CapturedMathFloorV1 = Math.floor;
const CapturedMapSizeGetterCandidateV1 =
  CapturedObjectGetOwnPropertyDescriptorV1(Map.prototype, "size")?.get;
const CapturedSetSizeGetterCandidateV1 =
  CapturedObjectGetOwnPropertyDescriptorV1(Set.prototype, "size")?.get;
const CapturedTypedArrayPrototypeV1 = CapturedObjectGetPrototypeOfV1(
  CapturedUint8ArrayV1.prototype,
);
const CapturedTypedArrayByteLengthGetterCandidateV1 =
  CapturedObjectGetOwnPropertyDescriptorV1(
    CapturedTypedArrayPrototypeV1,
    "byteLength",
  )?.get;

if (
  CapturedTypedArrayByteLengthGetterCandidateV1 === undefined ||
  CapturedMapSizeGetterCandidateV1 === undefined ||
  CapturedSetSizeGetterCandidateV1 === undefined
) {
  throw new CapturedTypeErrorV1("Uint8Array byteLength primordial unavailable");
}

function bindUncurriedAtBootstrapV1(method: Function): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      CapturedObjectFreezeV1([method]),
    ) as Function,
  );
}

const arrayPushV1 = bindUncurriedAtBootstrapV1(
  CapturedArrayPrototypePushV1,
) as <T>(array: T[], value: T) => number;
const arraySliceV1 = bindUncurriedAtBootstrapV1(
  CapturedArrayPrototypeSliceV1,
) as <T>(array: readonly T[], start?: number, end?: number) => T[];
const arraySortV1 = bindUncurriedAtBootstrapV1(
  CapturedArrayPrototypeSortV1,
) as <T>(array: T[], compare: (left: T, right: T) => number) => T[];
const mapClearV1 = bindUncurriedAtBootstrapV1(
  CapturedMapPrototypeClearV1,
) as <K, V>(map: Map<K, V>) => void;
const mapDeleteV1 = bindUncurriedAtBootstrapV1(
  CapturedMapPrototypeDeleteV1,
) as <K>(map: Map<K, unknown>, key: K) => boolean;
const mapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedMapPrototypeGetV1,
) as <K, V>(map: Map<K, V>, key: K) => V | undefined;
const mapForEachV1 = bindUncurriedAtBootstrapV1(
  CapturedMapPrototypeForEachV1,
) as <K, V>(
  map: Map<K, V>,
  callback: (value: V, key: K, map: Map<K, V>) => void,
) => void;
const mapHasV1 = bindUncurriedAtBootstrapV1(
  CapturedMapPrototypeHasV1,
) as <K>(map: Map<K, unknown>, key: K) => boolean;
const mapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedMapPrototypeSetV1,
) as <K, V>(map: Map<K, V>, key: K, value: V) => Map<K, V>;
const setAddV1 = bindUncurriedAtBootstrapV1(
  CapturedSetPrototypeAddV1,
) as <T>(set: Set<T>, value: T) => Set<T>;
const setHasV1 = bindUncurriedAtBootstrapV1(
  CapturedSetPrototypeHasV1,
) as <T>(set: ReadonlySet<T>, value: T) => boolean;
const mapSizeV1 = bindUncurriedAtBootstrapV1(
  CapturedMapSizeGetterCandidateV1,
) as <K, V>(map: Map<K, V>) => number;
const setSizeV1 = bindUncurriedAtBootstrapV1(
  CapturedSetSizeGetterCandidateV1,
) as <T>(set: ReadonlySet<T>) => number;
const stringCharCodeAtV1 = bindUncurriedAtBootstrapV1(
  CapturedStringPrototypeCharCodeAtV1,
) as (value: string, index: number) => number;
const stringIndexOfV1 = bindUncurriedAtBootstrapV1(
  CapturedStringPrototypeIndexOfV1,
) as (value: string, search: string, position?: number) => number;
const stringSliceV1 = bindUncurriedAtBootstrapV1(
  CapturedStringPrototypeSliceV1,
) as (value: string, start?: number, end?: number) => string;
const typedArrayByteLengthV1 = bindUncurriedAtBootstrapV1(
  CapturedTypedArrayByteLengthGetterCandidateV1,
) as (value: Uint8Array) => number;
const weakMapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeGetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K) => V | undefined;
const weakMapDeleteV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeDeleteV1,
) as <K extends object>(map: WeakMap<K, unknown>, key: K) => boolean;
const weakMapHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeHasV1,
) as <K extends object>(map: WeakMap<K, unknown>, key: K) => boolean;
const weakMapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeSetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K, value: V) => void;

const CapturedUtf8EncoderV1 = CapturedObjectFreezeV1(
  new CapturedTextEncoderV1(),
);
// TextDecoder mutates its BOM state in Node; keep the captured instance private.
const CapturedUtf8DecoderV1 = new CapturedTextDecoderV1("utf-8", {
  fatal: true,
});
let quotaCanonicalDecodeCountForTestInternalV1 = 0;

const MAX_RESERVATION_RECORD_COUNT_V1 = 4_096;
const MAX_RESERVATION_RECORD_LOGICAL_BYTES_V1 = 67_108_864;
const MAX_SINGLE_RESERVATION_RECORD_LOGICAL_BYTES_V1 = 1_048_576;
const MAX_EVENT_COUNT_V1 = 4_096;
const MAX_EVENT_LOGICAL_BYTES_V1 = 67_108_864;
const MAX_SINGLE_EVENT_LOGICAL_BYTES_V1 = 262_144;
const MAX_RECEIPT_COUNT_V1 = 4_096;
const MAX_RECEIPT_LOGICAL_BYTES_V1 = 268_435_456;
const MAX_SINGLE_RECEIPT_LOGICAL_BYTES_V1 = 1_048_576;
const MAX_HIGH_WATER_LOGICAL_BYTES_V1 = 1_048_576;
const BASE64URL_PREFIX_V1 = "base64url:";
// Prefix plus canonical unpadded base64url for the shared 1 MiB shell cap.
const MAX_CANONICAL_BYTE_STRING_WIRE_LENGTH_V1 = 1_398_112;
const MAX_ACCOUNTS_V1 = 64;
const RETAINED_ARTIFACT_UPPER_BOUND_COUNT_V1 = 11;
const RETAINED_ARTIFACT_PROJECTION_KEYS_V1 = CapturedObjectFreezeV1([
  "policyDigest",
  "retainedArtifactUpperBounds",
] as const);
const RETAINED_ARTIFACT_UPPER_BOUND_KEYS_V1 = CapturedObjectFreezeV1([
  "artifactKind",
  "artifactCount",
  "canonicalEnvelopeBytesUpperBoundTotal",
  "providerAllocatedBytesUpperBoundTotal",
] as const);

const MAX_CHARGED_MIGRATION_COUNT_V1 = 64;
const MAX_CHARGED_HISTORY_LOGICAL_BYTES_V1 = 8_589_934_592;
const MAX_CHARGED_HISTORY_PROVIDER_ALLOCATED_BYTES_V1 = 17_179_869_184;
const MAX_SINGLE_HISTORY_LOGICAL_BYTES_V1 = 4_294_967_296;
const MAX_SINGLE_HISTORY_PROVIDER_ALLOCATED_BYTES_V1 = 8_589_934_592;
const MAX_ACTIVE_RESERVATION_COUNT_V1 = 4;
const MAX_ACTIVE_RESERVED_HISTORY_LOGICAL_BYTES_V1 = 8_589_934_592;
const MAX_ACTIVE_RESERVED_HISTORY_PROVIDER_ALLOCATED_BYTES_V1 = 17_179_869_184;
const MAX_CHARGED_OBJECT_RECEIPT_COUNT_V1 = 2_000_000;
const MAX_CHARGED_OBJECT_RECEIPT_LOGICAL_BYTES_V1 = 2_147_483_648;
const MAX_CHARGED_SEMANTIC_ROOT_ZERO_PROOF_COUNT_V1 = 4_000_512;
const MAX_CHARGED_SEMANTIC_ROOT_ZERO_PROOF_LOGICAL_BYTES_V1 = 2_147_483_648;
const MAX_CHARGED_PROGRESS_RECORD_COUNT_V1 = 4_000_032;
const MAX_CHARGED_PROGRESS_RECORD_LOGICAL_BYTES_V1 = 2_147_483_648;
const MAX_CHARGED_PROGRESS_OPERATION_RECEIPT_COUNT_V1 = 8_000_000;
const MAX_CHARGED_PROGRESS_OPERATION_RECEIPT_LOGICAL_BYTES_V1 = 2_147_483_648;

const MINT_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "cohortIdentity",
  "installationIdentityGenerationId",
  "quotaObservationHost",
] as const);
const HOST_KEYS_V1 = CapturedObjectFreezeV1([
  "captureCompleteQuotaCut",
  "captureRetainedArtifactUpperBounds",
  "verifyQuotaHighWaterToken",
  "verifyQuotaLedgerRecordToken",
] as const);
const CAPTURE_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "phase",
  "quotaMachineCapability",
] as const);
const SIZING_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "completeSourceReadClosure",
  "migrationBudgets",
  "migrationBudgetsDigest",
  "quotaMachineCapability",
] as const);
const ADMISSION_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "admissionClass",
  "completeQuotaCut",
  "historyQuotaSizing",
  "historyQuotaSizingDigest",
  "quotaMachineCapability",
] as const);
const POST_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "preContinuity",
  "quotaMachineCapability",
] as const);
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineStageInternalV1 =
  | "pre_plan_reference_capability"
  | "source_dry_run_cut"
  | "history_quota_sizing"
  | "quota_reference_snapshot"
  | "history_quota_admission"
  | "post_observation";

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineReasonInternalV1 =
  | "schema_invalid"
  | "capability_invalid"
  | "budget_exceeded"
  | "quota_ledger_integrity_failed"
  | "quota_capacity_exhausted"
  | "snapshot_changed";

export class ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1 extends Error {
  readonly stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineStageInternalV1;
  readonly reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineReasonInternalV1;

  constructor(
    stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineStageInternalV1,
    reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineReasonInternalV1,
  ) {
    super(`${stage}:${reason}`);
    this.name =
      "ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1";
    this.stage = stage;
    this.reason = reason;
  }
}

export function isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
  value: unknown,
): value is ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1 {
  return value instanceof
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1;
}

function failV1(
  stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineStageInternalV1,
  reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineReasonInternalV1,
): never {
  throw new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
    stage,
    reason,
  );
}

function encodeUtf8V1(value: string): Uint8Array {
  return CapturedReflectApplyV1(
    CapturedTextEncoderPrototypeEncodeV1,
    CapturedUtf8EncoderV1,
    [value],
  ) as Uint8Array;
}

function decodeUtf8V1(value: Uint8Array): string {
  quotaCanonicalDecodeCountForTestInternalV1 += 1;
  return CapturedReflectApplyV1(
    CapturedTextDecoderPrototypeDecodeV1,
    CapturedUtf8DecoderV1,
    [value],
  ) as string;
}

/** Package-private observation seam for focused preflight ordering tests. */
export function getProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaCanonicalDecodeCountForTestInternalV1(): number {
  return quotaCanonicalDecodeCountForTestInternalV1;
}

function bytesToLowerHexV1(bytes: Uint8Array): string {
  const alphabet = "0123456789abcdef";
  let output = "";
  const length = typedArrayByteLengthV1(bytes);
  for (let index = 0; index < length; index += 1) {
    const byte = bytes[index]!;
    output += alphabet[(byte >>> 4) & 0x0f]! + alphabet[byte & 0x0f]!;
  }
  return output;
}

function digestForDomainV1(domain: string, fields: object): ContentDigestV1 {
  const bytes = encodeUtf8V1(
    canonicalizeJcsSafeIntegerV1([domain, fields]),
  );
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(sha256InternalV1(bytes))}`,
  );
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) === canonicalizeJcsSafeIntegerV1(right);
}

function checkedAddV1(left: number, right: number): number {
  if (
    !CapturedNumberIsSafeIntegerV1(left) ||
    !CapturedNumberIsSafeIntegerV1(right) ||
    left < 0 ||
    right < 0 ||
    left > Number.MAX_SAFE_INTEGER - right
  ) {
    throw new CapturedTypeErrorV1("non-negative safe integer addition overflow");
  }
  return left + right;
}

function checkedMultiplyV1(left: number, right: number): number {
  if (
    !CapturedNumberIsSafeIntegerV1(left) ||
    !CapturedNumberIsSafeIntegerV1(right) ||
    left < 0 ||
    right < 0 ||
    (left !== 0 && right > Number.MAX_SAFE_INTEGER / left)
  ) {
    throw new CapturedTypeErrorV1(
      "non-negative safe integer multiplication overflow",
    );
  }
  const result = left * right;
  if (!CapturedNumberIsSafeIntegerV1(result)) {
    throw new CapturedTypeErrorV1(
      "non-negative safe integer multiplication overflow",
    );
  }
  return result;
}

function parseJsonFieldsV1<T>(schema: z.ZodType<T>, input: unknown): T {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  return schema.parse(input);
}

function freezeParsedJsonV1<T extends object>(value: T): T {
  return deepFreezeProviderPointDetachedDataTreeV1(value);
}

function createFrozenRecordV1<T extends object>(
  entries: readonly (readonly [string, unknown])[],
): T {
  const record = CapturedObjectCreateV1(null) as Record<string, unknown>;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    CapturedObjectDefinePropertyV1(record, entry[0], {
      value: entry[1],
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return CapturedObjectFreezeV1(record) as T;
}

function isObjectIdentityV1(value: unknown): value is object {
  return (typeof value === "object" && value !== null) ||
    typeof value === "function";
}

const BASE64URL_ALPHABET_V1 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function decodeCanonicalByteStringV1(
  value: CanonicalByteStringV1,
): Uint8Array {
  const body = stringSliceV1(value, "base64url:".length);
  const decodedLength = CapturedMathFloorV1((body.length * 6) / 8);
  const decoded = new CapturedUint8ArrayV1(decodedLength);
  let accumulator = 0;
  let availableBits = 0;
  let outputOffset = 0;
  for (let index = 0; index < body.length; index += 1) {
    const character = CapturedReflectApplyV1(
      CapturedStringFromCharCodeV1,
      undefined,
      [stringCharCodeAtV1(body, index)],
    ) as string;
    const digit = stringIndexOfV1(BASE64URL_ALPHABET_V1, character);
    if (digit < 0) throw new CapturedTypeErrorV1("invalid base64url digit");
    accumulator = (accumulator << 6) | digit;
    availableBits += 6;
    if (availableBits >= 8) {
      availableBits -= 8;
      decoded[outputOffset] = (accumulator >>> availableBits) & 0xff;
      outputOffset += 1;
      accumulator &= (1 << availableBits) - 1;
    }
  }
  if (
    outputOffset !== typedArrayByteLengthV1(decoded) ||
    accumulator !== 0
  ) {
    throw new CapturedTypeErrorV1("invalid canonical byte string");
  }
  return decoded;
}

const NonnegativeSafeIntegerInternalV1Schema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
const PositiveSafeIntegerInternalV1Schema = NonnegativeSafeIntegerInternalV1Schema.min(1);

const QuotaAccountStateProjectionInternalV1Schema = z.strictObject({
  profile: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_quota_account_state_reference_candidate_v1",
  ),
  installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  accounts: z
    .array(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1Schema,
    )
    .max(MAX_ACCOUNTS_V1),
  accountCount: NonnegativeSafeIntegerInternalV1Schema,
  accountSetDigest: ContentDigestV1Schema,
  usage:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1Schema,
  futureTerminalTransitionEscrowCount: NonnegativeSafeIntegerInternalV1Schema,
  eventEscrowLogicalBytes: NonnegativeSafeIntegerInternalV1Schema,
  receiptEscrowLogicalBytes: NonnegativeSafeIntegerInternalV1Schema,
  contentDigest: ContentDigestV1Schema,
});

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateProjectionInternalV1 =
  z.infer<typeof QuotaAccountStateProjectionInternalV1Schema>;

const ReservationDecodedEnvelopeInternalV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  recordType: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_quota_reservation_reference_candidate",
  ),
  installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  reservationOrdinal: PositiveSafeIntegerInternalV1Schema.max(
    MAX_RESERVATION_RECORD_COUNT_V1,
  ),
  contentDigest: ContentDigestV1Schema,
  payload: z.strictObject({
    profile: z.literal(
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_reservation_payload_reference_candidate_v1",
    ),
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    reservationOrdinal: PositiveSafeIntegerInternalV1Schema.max(
      MAX_RESERVATION_RECORD_COUNT_V1,
    ),
    createdByOperationNonce: LowerHex32V1Schema,
    account:
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1Schema,
  }),
  recordToken: KeyedStateTokenV1Schema,
});

const QuotaEventTransitionInternalV1Schema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("reserve_reference_candidate"),
    before: z.strictObject({ state: z.literal("absent") }),
    after: z.strictObject({
      state: z.literal("account"),
      account:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1Schema.extend(
          { state: z.literal("reserved") },
        ),
    }),
  }),
  z.strictObject({
    kind: z.literal("retain_reference_candidate"),
    before: z.strictObject({
      state: z.literal("account"),
      account:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1Schema.extend(
          { state: z.literal("reserved") },
        ),
    }),
    after: z.strictObject({
      state: z.literal("account"),
      account:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1Schema.extend(
          { state: z.literal("retained") },
        ),
    }),
  }),
  z.strictObject({
    kind: z.literal("release_reference_candidate"),
    before: z.strictObject({
      state: z.literal("account"),
      account:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1Schema,
    }),
    after: z.strictObject({ state: z.literal("absent") }),
  }),
]);

const EventDecodedEnvelopeInternalV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  recordType: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_quota_event_reference_candidate",
  ),
  installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  eventOrdinal: PositiveSafeIntegerInternalV1Schema.max(MAX_EVENT_COUNT_V1),
  contentDigest: ContentDigestV1Schema,
  payload: z.strictObject({
    profile: z.literal(
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_event_payload_reference_candidate_v1",
    ),
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    eventOrdinal: PositiveSafeIntegerInternalV1Schema.max(MAX_EVENT_COUNT_V1),
    predecessor: z.union([
      z.strictObject({ state: z.literal("genesis") }),
      z.strictObject({
        state: z.literal("event"),
        eventOrdinal: PositiveSafeIntegerInternalV1Schema.max(
          MAX_EVENT_COUNT_V1,
        ),
        contentDigest: ContentDigestV1Schema,
      }),
    ]),
    operationNonce: LowerHex32V1Schema,
    requestContentDigest: ContentDigestV1Schema,
    transition: QuotaEventTransitionInternalV1Schema,
    beforeAccountStateContentDigest: ContentDigestV1Schema,
    afterAccountStateContentDigest: ContentDigestV1Schema,
  }),
  recordToken: KeyedStateTokenV1Schema,
});

const ReceiptDecodedEnvelopeInternalV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  recordType: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_quota_receipt_reference_candidate",
  ),
  installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  receiptOrdinal: PositiveSafeIntegerInternalV1Schema.max(
    MAX_RECEIPT_COUNT_V1,
  ),
  contentDigest: ContentDigestV1Schema,
  payload: z.strictObject({
    profile: z.literal(
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_receipt_payload_reference_candidate_v1",
    ),
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    receiptOrdinal: PositiveSafeIntegerInternalV1Schema.max(
      MAX_RECEIPT_COUNT_V1,
    ),
    operationNonce: LowerHex32V1Schema,
    requestContentDigest: ContentDigestV1Schema,
    accountReferenceDigest: ContentDigestV1Schema,
    observedPreHighWaterContentDigest: ContentDigestV1Schema,
    outcome: z.discriminatedUnion("state", [
      z.strictObject({
        state: z.literal("committed_reference_candidate"),
        eventOrdinal: PositiveSafeIntegerInternalV1Schema.max(
          MAX_EVENT_COUNT_V1,
        ),
        eventContentDigest: ContentDigestV1Schema,
        postAccountStateContentDigest: ContentDigestV1Schema,
      }),
      z.strictObject({
        state: z.literal("not_committed_reference_candidate"),
        reason: z.enum([
          "expected_changed",
          "capacity_exhausted",
          "candidate_invalid",
          "integrity_failed",
        ]),
        observedAccountStateContentDigest: ContentDigestV1Schema,
      }),
    ]),
  }),
  recordToken: KeyedStateTokenV1Schema,
});

const HighWaterPayloadInternalV1Schema = z.strictObject({
  profile: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_quota_high_water_payload_reference_candidate_v1",
  ),
  installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  stateRevision: NonnegativeSafeIntegerInternalV1Schema.max(MAX_EVENT_COUNT_V1),
  ledgerRevision: NonnegativeSafeIntegerInternalV1Schema.max(
    MAX_RECEIPT_COUNT_V1,
  ),
  currentEvent: z.union([
    z.strictObject({ state: z.literal("genesis") }),
    z.strictObject({
      state: z.literal("event"),
      eventOrdinal: PositiveSafeIntegerInternalV1Schema.max(MAX_EVENT_COUNT_V1),
      contentDigest: ContentDigestV1Schema,
    }),
  ]),
  reservationRecordCount: NonnegativeSafeIntegerInternalV1Schema.max(
    MAX_RESERVATION_RECORD_COUNT_V1,
  ),
  reservationRecordSetDigest: ContentDigestV1Schema,
  reservationRecordLogicalBytes: NonnegativeSafeIntegerInternalV1Schema.max(
    MAX_RESERVATION_RECORD_LOGICAL_BYTES_V1,
  ),
  eventCount: NonnegativeSafeIntegerInternalV1Schema.max(MAX_EVENT_COUNT_V1),
  eventSetDigest: ContentDigestV1Schema,
  ledgerEventLogicalBytes: NonnegativeSafeIntegerInternalV1Schema.max(
    MAX_EVENT_LOGICAL_BYTES_V1,
  ),
  receiptCount: NonnegativeSafeIntegerInternalV1Schema.max(MAX_RECEIPT_COUNT_V1),
  receiptSetDigest: ContentDigestV1Schema,
  operationReceiptLogicalBytes: NonnegativeSafeIntegerInternalV1Schema.max(
    MAX_RECEIPT_LOGICAL_BYTES_V1,
  ),
  accountCount: NonnegativeSafeIntegerInternalV1Schema.max(MAX_ACCOUNTS_V1),
  accountSetDigest: ContentDigestV1Schema,
  accountStateContentDigest: ContentDigestV1Schema,
  usage:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1Schema,
  futureTerminalTransitionEscrowCount: NonnegativeSafeIntegerInternalV1Schema,
  eventEscrowLogicalBytes: NonnegativeSafeIntegerInternalV1Schema,
  receiptEscrowLogicalBytes: NonnegativeSafeIntegerInternalV1Schema,
});

const HighWaterDecodedEnvelopeInternalV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  recordType: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_quota_high_water_reference_candidate",
  ),
  installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  contentDigest: ContentDigestV1Schema,
  payload: HighWaterPayloadInternalV1Schema,
  quotaStateVersionToken: KeyedStateTokenV1Schema,
});

const LoadedEnvelopeShellInternalV1Schema = z.strictObject({
  locatorReferenceDigest: ContentDigestV1Schema,
  canonicalEnvelopeBytes: CanonicalByteStringV1Schema,
  canonicalLogicalBytes: NonnegativeSafeIntegerInternalV1Schema,
});

const CompleteQuotaCutRawInternalV1Schema = z.strictObject({
  reservations: z
    .array(LoadedEnvelopeShellInternalV1Schema)
    .max(MAX_RESERVATION_RECORD_COUNT_V1),
  events: z.array(LoadedEnvelopeShellInternalV1Schema).max(MAX_EVENT_COUNT_V1),
  receipts: z
    .array(LoadedEnvelopeShellInternalV1Schema)
    .max(MAX_RECEIPT_COUNT_V1),
  highWater: LoadedEnvelopeShellInternalV1Schema,
});

const RetainedArtifactProjectionInternalV1Schema = z.strictObject({
  policyDigest: ContentDigestV1Schema,
  retainedArtifactUpperBounds:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundsReferenceCandidateV1Schema,
});

type RetainedArtifactProjectionInternalV1 = z.infer<
  typeof RetainedArtifactProjectionInternalV1Schema
>;

type ReservationDecodedEnvelopeInternalV1 = z.infer<
  typeof ReservationDecodedEnvelopeInternalV1Schema
>;
type EventDecodedEnvelopeInternalV1 = z.infer<
  typeof EventDecodedEnvelopeInternalV1Schema
>;
type ReceiptDecodedEnvelopeInternalV1 = z.infer<
  typeof ReceiptDecodedEnvelopeInternalV1Schema
>;
type HighWaterDecodedEnvelopeInternalV1 = z.infer<
  typeof HighWaterDecodedEnvelopeInternalV1Schema
>;
type LoadedEnvelopeShellInternalV1 = z.infer<
  typeof LoadedEnvelopeShellInternalV1Schema
>;

interface PreflightLoadedEnvelopeShellRawInternalV1 {
  readonly locatorReferenceDigest: unknown;
  readonly canonicalEnvelopeBytes: string;
  readonly canonicalLogicalBytes: number;
}

interface PreflightCompleteQuotaCutRawInternalV1 {
  readonly reservations: readonly PreflightLoadedEnvelopeShellRawInternalV1[];
  readonly events: readonly PreflightLoadedEnvelopeShellRawInternalV1[];
  readonly receipts: readonly PreflightLoadedEnvelopeShellRawInternalV1[];
  readonly highWater: PreflightLoadedEnvelopeShellRawInternalV1;
}

interface QuotaCutRawSnapshotStateInternalV1 {
  readonly seen: Set<object>;
}

function claimQuotaCutRawIdentityV1(
  value: unknown,
  snapshotState: QuotaCutRawSnapshotStateInternalV1,
): asserts value is object {
  if (
    !isObjectIdentityV1(value) ||
    setHasV1(snapshotState.seen, value)
  ) {
    throw new CapturedTypeErrorV1(
      "quota cut raw JSON identities must form one tree",
    );
  }
  setAddV1(snapshotState.seen, value);
}

function readOwnEnumerableDataPropertyValueV1(
  value: object,
  key: string,
): unknown {
  const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(value, key);
  if (
    descriptor === undefined ||
    descriptor.enumerable !== true ||
    CapturedObjectGetOwnPropertyDescriptorV1(descriptor, "value") ===
      undefined
  ) {
    throw new CapturedTypeErrorV1(
      "quota cut raw transport fields must be own enumerable data properties",
    );
  }
  return descriptor.value;
}

function snapshotBoundedDenseRawArrayV1(
  value: unknown,
  maximumLength: number,
  snapshotState: QuotaCutRawSnapshotStateInternalV1,
): readonly unknown[] {
  if (
    !CapturedArrayIsArrayV1(value)
  ) {
    throw new CapturedTypeErrorV1("quota cut collection must be an array");
  }
  claimQuotaCutRawIdentityV1(value, snapshotState);
  const lengthDescriptor = CapturedObjectGetOwnPropertyDescriptorV1(
    value,
    "length",
  );
  if (
    lengthDescriptor === undefined ||
    lengthDescriptor.enumerable !== false ||
    CapturedObjectGetOwnPropertyDescriptorV1(lengthDescriptor, "value") ===
      undefined ||
    !CapturedNumberIsSafeIntegerV1(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    lengthDescriptor.value > maximumLength
  ) {
    throw new CapturedTypeErrorV1("quota cut collection exceeds its count cap");
  }
  const length = lengthDescriptor.value as number;
  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    arrayPushV1(
      snapshot,
      readOwnEnumerableDataPropertyValueV1(value, `${index}`),
    );
  }
  return CapturedObjectFreezeV1(snapshot);
}

function canonicalByteStringWireLengthForLogicalBytesV1(
  canonicalLogicalBytes: number,
): number {
  const completeTriples = CapturedMathFloorV1(canonicalLogicalBytes / 3);
  const remainder = canonicalLogicalBytes - completeTriples * 3;
  const bodyLength = checkedAddV1(
    checkedMultiplyV1(completeTriples, 4),
    remainder === 0 ? 0 : remainder + 1,
  );
  return checkedAddV1(BASE64URL_PREFIX_V1.length, bodyLength);
}

function preflightLoadedEnvelopeShellRawV1(
  rawShell: unknown,
  singleLogicalByteCap: number,
  snapshotState: QuotaCutRawSnapshotStateInternalV1,
): PreflightLoadedEnvelopeShellRawInternalV1 {
  claimQuotaCutRawIdentityV1(rawShell, snapshotState);
  const canonicalLogicalBytes = readOwnEnumerableDataPropertyValueV1(
    rawShell,
    "canonicalLogicalBytes",
  );
  if (
    typeof canonicalLogicalBytes !== "number" ||
    !CapturedNumberIsSafeIntegerV1(canonicalLogicalBytes) ||
    canonicalLogicalBytes < 0 ||
    canonicalLogicalBytes > singleLogicalByteCap
  ) {
    throw new CapturedTypeErrorV1(
      "quota Envelope exceeds its single-record byte cap",
    );
  }
  const canonicalEnvelopeBytes = readOwnEnumerableDataPropertyValueV1(
    rawShell,
    "canonicalEnvelopeBytes",
  );
  if (typeof canonicalEnvelopeBytes !== "string") {
    throw new CapturedTypeErrorV1(
      "quota Envelope canonical bytes must be a string",
    );
  }
  const maximumCategoryWireLength =
    canonicalByteStringWireLengthForLogicalBytesV1(singleLogicalByteCap);
  if (
    canonicalEnvelopeBytes.length > MAX_CANONICAL_BYTE_STRING_WIRE_LENGTH_V1 ||
    canonicalEnvelopeBytes.length > maximumCategoryWireLength ||
    stringSliceV1(canonicalEnvelopeBytes, 0, BASE64URL_PREFIX_V1.length) !==
      BASE64URL_PREFIX_V1 ||
    canonicalEnvelopeBytes.length !==
      canonicalByteStringWireLengthForLogicalBytesV1(canonicalLogicalBytes)
  ) {
    throw new CapturedTypeErrorV1(
      "quota Envelope canonical byte declaration is inconsistent",
    );
  }
  const locatorReferenceDigest = readOwnEnumerableDataPropertyValueV1(
    rawShell,
    "locatorReferenceDigest",
  );
  return createFrozenRecordV1<PreflightLoadedEnvelopeShellRawInternalV1>([
    ["locatorReferenceDigest", locatorReferenceDigest],
    ["canonicalEnvelopeBytes", canonicalEnvelopeBytes],
    ["canonicalLogicalBytes", canonicalLogicalBytes],
  ]);
}

function preflightLoadedEnvelopeArrayRawV1(
  rawEntries: readonly unknown[],
  singleLogicalByteCap: number,
  aggregateLogicalByteCap: number,
  snapshotState: QuotaCutRawSnapshotStateInternalV1,
): readonly PreflightLoadedEnvelopeShellRawInternalV1[] {
  const rawShells: PreflightLoadedEnvelopeShellRawInternalV1[] = [];
  let aggregateLogicalBytes = 0;
  for (let index = 0; index < rawEntries.length; index += 1) {
    const entry = preflightLoadedEnvelopeShellRawV1(
      rawEntries[index],
      singleLogicalByteCap,
      snapshotState,
    );
    aggregateLogicalBytes = checkedAddV1(
      aggregateLogicalBytes,
      entry.canonicalLogicalBytes,
    );
    if (aggregateLogicalBytes > aggregateLogicalByteCap) {
      throw new CapturedTypeErrorV1(
        "quota Envelope collection exceeds its aggregate byte cap",
      );
    }
    arrayPushV1(rawShells, entry);
  }
  return CapturedObjectFreezeV1(rawShells);
}

function preflightCompleteQuotaCutRawV1(
  rawCut: unknown,
): PreflightCompleteQuotaCutRawInternalV1 {
  const snapshotState: QuotaCutRawSnapshotStateInternalV1 = {
    seen: new CapturedSetV1<object>(),
  };
  claimQuotaCutRawIdentityV1(rawCut, snapshotState);
  const rawReservationsValue = readOwnEnumerableDataPropertyValueV1(
    rawCut,
    "reservations",
  );
  const rawEventsValue = readOwnEnumerableDataPropertyValueV1(rawCut, "events");
  const rawReceiptsValue = readOwnEnumerableDataPropertyValueV1(
    rawCut,
    "receipts",
  );
  const rawHighWaterValue = readOwnEnumerableDataPropertyValueV1(
    rawCut,
    "highWater",
  );

  // Validate all three counts before inspecting any Envelope string.
  const rawReservations = snapshotBoundedDenseRawArrayV1(
    rawReservationsValue,
    MAX_RESERVATION_RECORD_COUNT_V1,
    snapshotState,
  );
  const rawEvents = snapshotBoundedDenseRawArrayV1(
    rawEventsValue,
    MAX_EVENT_COUNT_V1,
    snapshotState,
  );
  const rawReceipts = snapshotBoundedDenseRawArrayV1(
    rawReceiptsValue,
    MAX_RECEIPT_COUNT_V1,
    snapshotState,
  );

  const reservations = preflightLoadedEnvelopeArrayRawV1(
    rawReservations,
    MAX_SINGLE_RESERVATION_RECORD_LOGICAL_BYTES_V1,
    MAX_RESERVATION_RECORD_LOGICAL_BYTES_V1,
    snapshotState,
  );
  const events = preflightLoadedEnvelopeArrayRawV1(
    rawEvents,
    MAX_SINGLE_EVENT_LOGICAL_BYTES_V1,
    MAX_EVENT_LOGICAL_BYTES_V1,
    snapshotState,
  );
  const receipts = preflightLoadedEnvelopeArrayRawV1(
    rawReceipts,
    MAX_SINGLE_RECEIPT_LOGICAL_BYTES_V1,
    MAX_RECEIPT_LOGICAL_BYTES_V1,
    snapshotState,
  );
  const highWater = preflightLoadedEnvelopeShellRawV1(
    rawHighWaterValue,
    MAX_HIGH_WATER_LOGICAL_BYTES_V1,
    snapshotState,
  );

  return createFrozenRecordV1<PreflightCompleteQuotaCutRawInternalV1>([
    ["reservations", reservations],
    ["events", events],
    ["receipts", receipts],
    ["highWater", highWater],
  ]);
}

function snapshotRetainedArtifactProjectionRawV1(
  rawProjection: unknown,
): RetainedArtifactProjectionInternalV1 {
  if (!isObjectIdentityV1(rawProjection)) {
    throw new CapturedTypeErrorV1(
      "retained artifact projection transport must be an object",
    );
  }
  const policyDigest = readOwnEnumerableDataPropertyValueV1(
    rawProjection,
    RETAINED_ARTIFACT_PROJECTION_KEYS_V1[0],
  );
  const rawUpperBounds = readOwnEnumerableDataPropertyValueV1(
    rawProjection,
    RETAINED_ARTIFACT_PROJECTION_KEYS_V1[1],
  );
  if (!CapturedArrayIsArrayV1(rawUpperBounds)) {
    throw new CapturedTypeErrorV1(
      "retained artifact upper bounds transport must be an array",
    );
  }
  const lengthDescriptor = CapturedObjectGetOwnPropertyDescriptorV1(
    rawUpperBounds,
    "length",
  );
  if (
    lengthDescriptor === undefined ||
    lengthDescriptor.enumerable !== false ||
    CapturedObjectGetOwnPropertyDescriptorV1(lengthDescriptor, "value") ===
      undefined ||
    lengthDescriptor.value !== RETAINED_ARTIFACT_UPPER_BOUND_COUNT_V1
  ) {
    throw new CapturedTypeErrorV1(
      "retained artifact upper bounds transport must contain exact11 entries",
    );
  }

  const retainedArtifactUpperBounds: unknown[] = [];
  for (
    let index = 0;
    index < RETAINED_ARTIFACT_UPPER_BOUND_COUNT_V1;
    index += 1
  ) {
    const rawEntry = readOwnEnumerableDataPropertyValueV1(
      rawUpperBounds,
      `${index}`,
    );
    if (!isObjectIdentityV1(rawEntry)) {
      throw new CapturedTypeErrorV1(
        "retained artifact upper bound transport entry must be an object",
      );
    }
    arrayPushV1(
      retainedArtifactUpperBounds,
      createFrozenRecordV1([
        [
          RETAINED_ARTIFACT_UPPER_BOUND_KEYS_V1[0],
          readOwnEnumerableDataPropertyValueV1(
            rawEntry,
            RETAINED_ARTIFACT_UPPER_BOUND_KEYS_V1[0],
          ),
        ],
        [
          RETAINED_ARTIFACT_UPPER_BOUND_KEYS_V1[1],
          readOwnEnumerableDataPropertyValueV1(
            rawEntry,
            RETAINED_ARTIFACT_UPPER_BOUND_KEYS_V1[1],
          ),
        ],
        [
          RETAINED_ARTIFACT_UPPER_BOUND_KEYS_V1[2],
          readOwnEnumerableDataPropertyValueV1(
            rawEntry,
            RETAINED_ARTIFACT_UPPER_BOUND_KEYS_V1[2],
          ),
        ],
        [
          RETAINED_ARTIFACT_UPPER_BOUND_KEYS_V1[3],
          readOwnEnumerableDataPropertyValueV1(
            rawEntry,
            RETAINED_ARTIFACT_UPPER_BOUND_KEYS_V1[3],
          ),
        ],
      ]),
    );
  }
  const candidate = createFrozenRecordV1<RetainedArtifactProjectionInternalV1>([
    ["policyDigest", policyDigest],
    [
      "retainedArtifactUpperBounds",
      CapturedObjectFreezeV1(retainedArtifactUpperBounds),
    ],
  ]);
  assertJsonDataTreeBeforeSchemaV1(candidate);
  const parsed = RetainedArtifactProjectionInternalV1Schema.parse(candidate);
  return createFrozenRecordV1<RetainedArtifactProjectionInternalV1>([
    ["policyDigest", parsed.policyDigest],
    [
      "retainedArtifactUpperBounds",
      freezeParsedJsonV1(parsed.retainedArtifactUpperBounds),
    ],
  ]);
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaLedgerRecordTokenVerificationInputInternalV1 {
  readonly tokenDomain: typeof PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_LEDGER_RECORD_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1;
  readonly recordType:
    | ReservationDecodedEnvelopeInternalV1["recordType"]
    | EventDecodedEnvelopeInternalV1["recordType"]
    | ReceiptDecodedEnvelopeInternalV1["recordType"];
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly ordinal: number;
  readonly locatorReferenceDigest: ContentDigestV1;
  readonly contentDigest: ContentDigestV1;
  readonly token: KeyedStateTokenV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaHighWaterTokenVerificationInputInternalV1 {
  readonly tokenDomain: typeof PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1;
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly payload: HighWaterDecodedEnvelopeInternalV1["payload"];
  readonly outerContentDigest: ContentDigestV1;
  readonly token: KeyedStateTokenV1;
}

declare const historyQuotaCompleteQuotaCutMintChallengeBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutMintChallengeInternalV1 {
  readonly [historyQuotaCompleteQuotaCutMintChallengeBrandInternalV1]: true;
}

declare const historyQuotaCompleteQuotaCutCapabilityBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCapabilityInternalV1 {
  readonly [historyQuotaCompleteQuotaCutCapabilityBrandInternalV1]: true;
}

declare const historyQuotaRetainedArtifactUpperBoundsMintChallengeBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRetainedArtifactUpperBoundsMintChallengeInternalV1 {
  readonly [historyQuotaRetainedArtifactUpperBoundsMintChallengeBrandInternalV1]: true;
}

declare const historyQuotaRetainedArtifactUpperBoundsCapabilityBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRetainedArtifactUpperBoundsCapabilityInternalV1 {
  readonly [historyQuotaRetainedArtifactUpperBoundsCapabilityBrandInternalV1]: true;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1 {
  captureCompleteQuotaCut(input: Readonly<{
    phase: "pre" | "post";
    installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
    completeQuotaCutMintChallenge: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutMintChallengeInternalV1;
    deliverCompleteQuotaCutCapability: (
      capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCapabilityInternalV1,
    ) => void;
    rejectCompleteQuotaCutObservation: () => void;
  }>): unknown;
  captureRetainedArtifactUpperBounds(input: Readonly<{
    phase: "source_dry_run_cut";
    installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
    retainedArtifactUpperBoundsMintChallenge: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRetainedArtifactUpperBoundsMintChallengeInternalV1;
    deliverRetainedArtifactUpperBoundsCapability: (
      capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRetainedArtifactUpperBoundsCapabilityInternalV1,
    ) => void;
    rejectRetainedArtifactUpperBoundsObservation: () => void;
  }>): unknown;
  verifyQuotaLedgerRecordToken(
    input: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaLedgerRecordTokenVerificationInputInternalV1,
  ): boolean;
  verifyQuotaHighWaterToken(
    input: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaHighWaterTokenVerificationInputInternalV1,
  ): boolean;
}

declare const historyQuotaReferenceMachineCapabilityBrandInternalV1: unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1 {
  readonly [historyQuotaReferenceMachineCapabilityBrandInternalV1]: true;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCaptureInternalV1 {
  readonly phase: "pre" | "post";
  readonly quotaSnapshot: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunAndHistoryQuotaSizingInternalV1 {
  readonly sourceDryRunCut: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutReferenceCandidateV1;
  readonly historyQuotaSizing: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1;
  readonly historyQuotaSizingDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionInternalV1 {
  readonly historyQuotaAdmission: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1;
  readonly admissionVectorDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostQuotaContinuityInternalV1 {
  readonly preSnapshotContentDigest: ContentDigestV1;
  readonly postSnapshotContentDigest: ContentDigestV1;
  readonly equality: "exact";
  readonly observationContentDigest: ContentDigestV1;
}

interface HistoryQuotaReferenceMachineBindingInternalV1 {
  readonly cohortIdentity: object;
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly host: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1;
  readonly captureCompleteQuotaCut: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1["captureCompleteQuotaCut"];
  readonly captureRetainedArtifactUpperBounds: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1["captureRetainedArtifactUpperBounds"];
  readonly verifyQuotaLedgerRecordToken: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1["verifyQuotaLedgerRecordToken"];
  readonly verifyQuotaHighWaterToken: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1["verifyQuotaHighWaterToken"];
  captureState:
    | "ready"
    | "pre_pending"
    | "pre_captured"
    | "post_pending"
    | "post_captured"
    | "failed";
  artifactProjectionState: "ready" | "pending" | "captured" | "failed";
  preCapture?: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCaptureInternalV1;
}

interface VerifiedQuotaCutBindingInternalV1 {
  readonly machine: HistoryQuotaReferenceMachineBindingInternalV1;
  readonly phase: "pre" | "post";
  readonly snapshot: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1;
}

interface VerifiedSizingBindingInternalV1 {
  readonly machine: HistoryQuotaReferenceMachineBindingInternalV1;
  readonly policyDigest: ContentDigestV1;
  readonly sizingDigest: ContentDigestV1;
}

type HistoryQuotaObservationDeliveryKindInternalV1 =
  | "complete_quota_cut"
  | "retained_artifact_upper_bounds";

type HistoryQuotaObservationDeliveryPhaseInternalV1 =
  | "pre"
  | "post"
  | "source_dry_run_cut";

interface HistoryQuotaObservationMintChallengeBindingInternalV1 {
  readonly machine: HistoryQuotaReferenceMachineBindingInternalV1;
  readonly cohortIdentity: object;
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly kind: HistoryQuotaObservationDeliveryKindInternalV1;
  readonly phase: HistoryQuotaObservationDeliveryPhaseInternalV1;
}

interface HistoryQuotaObservationCapabilityBindingInternalV1 {
  readonly challenge: object;
  readonly binding: HistoryQuotaObservationMintChallengeBindingInternalV1;
  readonly kind: HistoryQuotaObservationDeliveryKindInternalV1;
  readonly payload:
    | PreflightCompleteQuotaCutRawInternalV1
    | RetainedArtifactProjectionInternalV1;
}

const machineBindingsV1 = new CapturedWeakMapV1<
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1,
  HistoryQuotaReferenceMachineBindingInternalV1
>();
const quotaCutBindingsV1 = new CapturedWeakMapV1<
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCaptureInternalV1,
  VerifiedQuotaCutBindingInternalV1
>();
const sizingBindingsV1 = new CapturedWeakMapV1<
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1,
  VerifiedSizingBindingInternalV1
>();
const historyQuotaObservationMintChallengeBindingsV1 =
  new CapturedWeakMapV1<
    object,
    HistoryQuotaObservationMintChallengeBindingInternalV1
  >();
const historyQuotaObservationCapabilityBindingsV1 = new CapturedWeakMapV1<
  object,
  HistoryQuotaObservationCapabilityBindingInternalV1
>();
const historyQuotaObservationMintedCapabilitiesByChallengeV1 =
  new CapturedWeakMapV1<object, object>();

function createHistoryQuotaObservationMintChallengeV1(
  machine: HistoryQuotaReferenceMachineBindingInternalV1,
  kind: HistoryQuotaObservationDeliveryKindInternalV1,
  phase: HistoryQuotaObservationDeliveryPhaseInternalV1,
): object {
  const challenge = CapturedObjectFreezeV1(CapturedObjectCreateV1(null));
  weakMapSetV1(
    historyQuotaObservationMintChallengeBindingsV1,
    challenge,
    CapturedObjectFreezeV1({
      machine,
      cohortIdentity: machine.cohortIdentity,
      installationIdentityGenerationId:
        machine.installationIdentityGenerationId,
      kind,
      phase,
    }),
  );
  return challenge;
}

function takeHistoryQuotaObservationMintChallengeBindingV1(
  challenge: unknown,
  expectedKind: HistoryQuotaObservationDeliveryKindInternalV1,
): HistoryQuotaObservationMintChallengeBindingInternalV1 {
  if (!isObjectIdentityV1(challenge)) {
    throw new CapturedTypeErrorV1("history quota observation challenge invalid");
  }
  const binding = weakMapGetV1(
    historyQuotaObservationMintChallengeBindingsV1,
    challenge,
  );
  if (
    binding === undefined ||
    binding.kind !== expectedKind ||
    !weakMapDeleteV1(
      historyQuotaObservationMintChallengeBindingsV1,
      challenge,
    )
  ) {
    throw new CapturedTypeErrorV1(
      "history quota observation challenge unavailable",
    );
  }
  return binding;
}

function bindHistoryQuotaObservationCapabilityV1(
  challenge: object,
  binding: HistoryQuotaObservationMintChallengeBindingInternalV1,
  payload:
    | PreflightCompleteQuotaCutRawInternalV1
    | RetainedArtifactProjectionInternalV1,
): object {
  const capability = CapturedObjectFreezeV1(CapturedObjectCreateV1(null));
  weakMapSetV1(
    historyQuotaObservationCapabilityBindingsV1,
    capability,
    CapturedObjectFreezeV1({
      challenge,
      binding,
      kind: binding.kind,
      payload,
    }),
  );
  weakMapSetV1(
    historyQuotaObservationMintedCapabilitiesByChallengeV1,
    challenge,
    capability,
  );
  return capability;
}

/** Trusted host adapter for a bounded canonical-Envelope quota cut. */
export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCapabilityInternalV1(
  challenge: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutMintChallengeInternalV1,
  rawCut: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCapabilityInternalV1 {
  const binding = takeHistoryQuotaObservationMintChallengeBindingV1(
    challenge,
    "complete_quota_cut",
  );
  const preflightedCut = preflightCompleteQuotaCutRawV1(rawCut);
  assertJsonDataTreeBeforeSchemaV1(preflightedCut);
  const cut = CompleteQuotaCutRawInternalV1Schema.parse(preflightedCut);
  return bindHistoryQuotaObservationCapabilityV1(
    challenge,
    binding,
    createFrozenRecordV1<PreflightCompleteQuotaCutRawInternalV1>([
      ["reservations", CapturedObjectFreezeV1(cut.reservations)],
      ["events", CapturedObjectFreezeV1(cut.events)],
      ["receipts", CapturedObjectFreezeV1(cut.receipts)],
      ["highWater", CapturedObjectFreezeV1(cut.highWater)],
    ]),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCapabilityInternalV1;
}

/** Trusted host adapter for the fixed exact11 retained-artifact projection. */
export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRetainedArtifactUpperBoundsCapabilityInternalV1(
  challenge: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRetainedArtifactUpperBoundsMintChallengeInternalV1,
  rawProjection: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRetainedArtifactUpperBoundsCapabilityInternalV1 {
  const binding = takeHistoryQuotaObservationMintChallengeBindingV1(
    challenge,
    "retained_artifact_upper_bounds",
  );
  return bindHistoryQuotaObservationCapabilityV1(
    challenge,
    binding,
    snapshotRetainedArtifactProjectionRawV1(rawProjection),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRetainedArtifactUpperBoundsCapabilityInternalV1;
}

function invalidateHistoryQuotaObservationMintChallengeV1(
  challenge: object,
): void {
  weakMapDeleteV1(historyQuotaObservationMintChallengeBindingsV1, challenge);
  const minted = weakMapGetV1(
    historyQuotaObservationMintedCapabilitiesByChallengeV1,
    challenge,
  );
  weakMapDeleteV1(
    historyQuotaObservationMintedCapabilitiesByChallengeV1,
    challenge,
  );
  if (minted !== undefined) {
    weakMapDeleteV1(historyQuotaObservationCapabilityBindingsV1, minted);
  }
}

function takeHistoryQuotaObservationCapabilityV1(
  value: unknown,
  challenge: object,
  expectedBinding: HistoryQuotaObservationMintChallengeBindingInternalV1,
  expectedKind: HistoryQuotaObservationDeliveryKindInternalV1,
): PreflightCompleteQuotaCutRawInternalV1 | RetainedArtifactProjectionInternalV1 {
  if (!isObjectIdentityV1(value)) {
    throw new CapturedTypeErrorV1("history quota observation capability invalid");
  }
  const context = weakMapGetV1(
    historyQuotaObservationCapabilityBindingsV1,
    value,
  );
  if (
    context === undefined ||
    context.challenge !== challenge ||
    context.binding !== expectedBinding ||
    context.kind !== expectedKind ||
    expectedBinding.machine !== context.binding.machine ||
    expectedBinding.cohortIdentity !== context.binding.cohortIdentity ||
    expectedBinding.installationIdentityGenerationId !==
      context.binding.installationIdentityGenerationId ||
    expectedBinding.phase !== context.binding.phase
  ) {
    throw new CapturedTypeErrorV1("history quota observation capability mismatch");
  }
  if (
    !weakMapDeleteV1(historyQuotaObservationCapabilityBindingsV1, value)
  ) {
    throw new CapturedTypeErrorV1("history quota observation capability invalid");
  }
  weakMapDeleteV1(
    historyQuotaObservationMintedCapabilitiesByChallengeV1,
    challenge,
  );
  return context.payload;
}

function createOpaqueMachineCapabilityV1(): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1 {
  return CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1;
}

function requireMachineBindingV1(
  capability: unknown,
): HistoryQuotaReferenceMachineBindingInternalV1 {
  if (
    !isObjectIdentityV1(capability) ||
    !weakMapHasV1(machineBindingsV1, capability)
  ) {
    return failV1("pre_plan_reference_capability", "capability_invalid");
  }
  const binding = weakMapGetV1(machineBindingsV1, capability);
  if (binding === undefined) {
    return failV1("pre_plan_reference_capability", "capability_invalid");
  }
  return binding;
}

export function assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1(
  capability: unknown,
  expectedCohortIdentity: unknown,
  expectedInstallationIdentityGenerationId: unknown,
): asserts capability is ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1 {
  const binding = requireMachineBindingV1(capability);
  if (
    !isObjectIdentityV1(expectedCohortIdentity) ||
    binding.cohortIdentity !== expectedCohortIdentity ||
    typeof expectedInstallationIdentityGenerationId !== "string" ||
    binding.installationIdentityGenerationId !==
      expectedInstallationIdentityGenerationId
  ) {
    return failV1("pre_plan_reference_capability", "capability_invalid");
  }
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineInternalV1(
  input: Readonly<{
    cohortIdentity: object;
    installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
    quotaObservationHost: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1;
  }>,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1 {
  try {
    const fields = captureProviderPointDetachedExactDataObjectV1(
      input,
      MINT_INPUT_KEYS_V1,
    );
    if (!isObjectIdentityV1(fields.cohortIdentity)) {
      return failV1("pre_plan_reference_capability", "schema_invalid");
    }
    const installationIdentityGenerationId =
      InstallationIdentityGenerationIdV1Schema.parse(
        fields.installationIdentityGenerationId,
      );
    const hostFields = captureProviderPointDetachedExactDataObjectV1(
      fields.quotaObservationHost,
      HOST_KEYS_V1,
    );
    if (
      typeof hostFields.captureCompleteQuotaCut !== "function" ||
      typeof hostFields.captureRetainedArtifactUpperBounds !== "function" ||
      typeof hostFields.verifyQuotaLedgerRecordToken !== "function" ||
      typeof hostFields.verifyQuotaHighWaterToken !== "function"
    ) {
      return failV1("pre_plan_reference_capability", "schema_invalid");
    }
    const capability = createOpaqueMachineCapabilityV1();
    const binding: HistoryQuotaReferenceMachineBindingInternalV1 = {
      cohortIdentity: fields.cohortIdentity,
      installationIdentityGenerationId,
      host:
        fields.quotaObservationHost as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1,
      captureCompleteQuotaCut:
        hostFields.captureCompleteQuotaCut as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1["captureCompleteQuotaCut"],
      captureRetainedArtifactUpperBounds:
        hostFields.captureRetainedArtifactUpperBounds as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1["captureRetainedArtifactUpperBounds"],
      verifyQuotaLedgerRecordToken:
        hostFields.verifyQuotaLedgerRecordToken as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1["verifyQuotaLedgerRecordToken"],
      verifyQuotaHighWaterToken:
        hostFields.verifyQuotaHighWaterToken as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1["verifyQuotaHighWaterToken"],
      captureState: "ready",
      artifactProjectionState: "ready",
    };
    weakMapSetV1(machineBindingsV1, capability, binding);
    return capability;
  } catch (error) {
    if (
      isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
        error,
      )
    ) {
      throw error;
    }
    return failV1("pre_plan_reference_capability", "schema_invalid");
  }
}

function zeroQuotaUsageV1(): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1 {
  return {
    reservedAccountCount: 0,
    reservedHistoryLogicalBytes: 0,
    reservedHistoryProviderAllocatedBytes: 0,
    reservedObjectReceiptCount: 0,
    reservedObjectReceiptLogicalBytes: 0,
    reservedSemanticRootZeroProofCount: 0,
    reservedSemanticRootZeroProofLogicalBytes: 0,
    reservedProgressRecordCount: 0,
    reservedProgressRecordLogicalBytes: 0,
    reservedProgressOperationReceiptCount: 0,
    reservedProgressOperationReceiptLogicalBytes: 0,
    retainedAccountCount: 0,
    retainedHistoryLogicalBytes: 0,
    retainedHistoryProviderAllocatedBytes: 0,
    chargedMigrationCount: 0,
    chargedHistoryLogicalBytes: 0,
    chargedHistoryProviderAllocatedBytes: 0,
    chargedObjectReceiptCount: 0,
    chargedObjectReceiptLogicalBytes: 0,
    chargedSemanticRootZeroProofCount: 0,
    chargedSemanticRootZeroProofLogicalBytes: 0,
    chargedProgressRecordCount: 0,
    chargedProgressRecordLogicalBytes: 0,
    chargedProgressOperationReceiptCount: 0,
    chargedProgressOperationReceiptLogicalBytes: 0,
  };
}

function addAccountingContributionToUsageV1(
  usage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1,
  state: "reserved" | "retained",
  migrationSlotCount: 1,
  contribution: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1["contribution"],
): void {
  usage.chargedMigrationCount = checkedAddV1(
    usage.chargedMigrationCount,
    migrationSlotCount,
  );
  usage.chargedHistoryLogicalBytes = checkedAddV1(
    usage.chargedHistoryLogicalBytes,
    contribution.historyLogicalBytes,
  );
  usage.chargedHistoryProviderAllocatedBytes = checkedAddV1(
    usage.chargedHistoryProviderAllocatedBytes,
    contribution.historyProviderAllocatedBytes,
  );
  usage.chargedObjectReceiptCount = checkedAddV1(
    usage.chargedObjectReceiptCount,
    contribution.objectReceiptCount,
  );
  usage.chargedObjectReceiptLogicalBytes = checkedAddV1(
    usage.chargedObjectReceiptLogicalBytes,
    contribution.objectReceiptLogicalBytes,
  );
  usage.chargedSemanticRootZeroProofCount = checkedAddV1(
    usage.chargedSemanticRootZeroProofCount,
    contribution.semanticRootZeroProofCount,
  );
  usage.chargedSemanticRootZeroProofLogicalBytes = checkedAddV1(
    usage.chargedSemanticRootZeroProofLogicalBytes,
    contribution.semanticRootZeroProofLogicalBytes,
  );
  usage.chargedProgressRecordCount = checkedAddV1(
    usage.chargedProgressRecordCount,
    contribution.progressRecordCount,
  );
  usage.chargedProgressRecordLogicalBytes = checkedAddV1(
    usage.chargedProgressRecordLogicalBytes,
    contribution.progressRecordLogicalBytes,
  );
  usage.chargedProgressOperationReceiptCount = checkedAddV1(
    usage.chargedProgressOperationReceiptCount,
    contribution.progressOperationReceiptCount,
  );
  usage.chargedProgressOperationReceiptLogicalBytes = checkedAddV1(
    usage.chargedProgressOperationReceiptLogicalBytes,
    contribution.progressOperationReceiptLogicalBytes,
  );
  if (state === "retained") {
    usage.retainedAccountCount = checkedAddV1(
      usage.retainedAccountCount,
      1,
    );
    usage.retainedHistoryLogicalBytes = checkedAddV1(
      usage.retainedHistoryLogicalBytes,
      contribution.historyLogicalBytes,
    );
    usage.retainedHistoryProviderAllocatedBytes = checkedAddV1(
      usage.retainedHistoryProviderAllocatedBytes,
      contribution.historyProviderAllocatedBytes,
    );
    return;
  }
  usage.reservedAccountCount = checkedAddV1(
    usage.reservedAccountCount,
    1,
  );
  usage.reservedHistoryLogicalBytes = checkedAddV1(
    usage.reservedHistoryLogicalBytes,
    contribution.historyLogicalBytes,
  );
  usage.reservedHistoryProviderAllocatedBytes = checkedAddV1(
    usage.reservedHistoryProviderAllocatedBytes,
    contribution.historyProviderAllocatedBytes,
  );
  usage.reservedObjectReceiptCount = checkedAddV1(
    usage.reservedObjectReceiptCount,
    contribution.objectReceiptCount,
  );
  usage.reservedObjectReceiptLogicalBytes = checkedAddV1(
    usage.reservedObjectReceiptLogicalBytes,
    contribution.objectReceiptLogicalBytes,
  );
  usage.reservedSemanticRootZeroProofCount = checkedAddV1(
    usage.reservedSemanticRootZeroProofCount,
    contribution.semanticRootZeroProofCount,
  );
  usage.reservedSemanticRootZeroProofLogicalBytes = checkedAddV1(
    usage.reservedSemanticRootZeroProofLogicalBytes,
    contribution.semanticRootZeroProofLogicalBytes,
  );
  usage.reservedProgressRecordCount = checkedAddV1(
    usage.reservedProgressRecordCount,
    contribution.progressRecordCount,
  );
  usage.reservedProgressRecordLogicalBytes = checkedAddV1(
    usage.reservedProgressRecordLogicalBytes,
    contribution.progressRecordLogicalBytes,
  );
  usage.reservedProgressOperationReceiptCount = checkedAddV1(
    usage.reservedProgressOperationReceiptCount,
    contribution.progressOperationReceiptCount,
  );
  usage.reservedProgressOperationReceiptLogicalBytes = checkedAddV1(
    usage.reservedProgressOperationReceiptLogicalBytes,
    contribution.progressOperationReceiptLogicalBytes,
  );
}

function addContributionToUsageV1(
  usage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1,
  account: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1,
): void {
  addAccountingContributionToUsageV1(
    usage,
    account.state,
    account.migrationSlotCount,
    account.contribution,
  );
}

function foldQuotaUsageV1(
  accounts: readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1[],
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1 {
  const usage = zeroQuotaUsageV1();
  for (let index = 0; index < accounts.length; index += 1) {
    addContributionToUsageV1(usage, accounts[index]!);
  }
  return freezeParsedJsonV1(
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1Schema.parse(
      usage,
    ),
  );
}

function normalizeAccountMapV1(
  accountsByReferenceDigest: Map<
    string,
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1
  >,
): readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1[] {
  const unordered: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1[] = [];
  mapForEachV1(accountsByReferenceDigest, (account) => {
    arrayPushV1(unordered, account);
  });
  arraySortV1(
    unordered,
    (left, right) => left.reservationOrdinal - right.reservationOrdinal,
  );
  const normalized: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1[] = [];
  for (let index = 0; index < unordered.length; index += 1) {
    const account = unordered[index]!;
    arrayPushV1(
      normalized,
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1Schema.parse(
        {
          ...account,
          accountOrdinal: index,
        },
      ),
    );
  }
  return CapturedObjectFreezeV1(normalized);
}

function deriveQuotaAccountStateContentDigestV1(
  state: Omit<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateProjectionInternalV1,
    "contentDigest"
  >,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_ACCOUNT_STATE_REFERENCE_CANDIDATE_DOMAIN_V1,
    state,
  );
}

function createQuotaAccountStateV1(
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1,
  accounts: readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1[],
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateProjectionInternalV1 {
  const usage = foldQuotaUsageV1(accounts);
  const futureTerminalTransitionEscrowCount = checkedAddV1(
    checkedMultiplyV1(usage.reservedAccountCount, 3),
    usage.retainedAccountCount,
  );
  const mutableAccounts: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1[] = [];
  for (let index = 0; index < accounts.length; index += 1) {
    arrayPushV1(mutableAccounts, accounts[index]!);
  }
  const unsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_account_state_reference_candidate_v1" as const,
    installationIdentityGenerationId,
    accounts: mutableAccounts,
    accountCount: mutableAccounts.length,
    accountSetDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountSetDigestReferenceCandidateV1(
        { entries: mutableAccounts },
      ),
    usage,
    futureTerminalTransitionEscrowCount,
    eventEscrowLogicalBytes: checkedMultiplyV1(
      futureTerminalTransitionEscrowCount,
      MAX_SINGLE_EVENT_LOGICAL_BYTES_V1,
    ),
    receiptEscrowLogicalBytes: checkedMultiplyV1(
      futureTerminalTransitionEscrowCount,
      MAX_SINGLE_RECEIPT_LOGICAL_BYTES_V1,
    ),
  };
  return freezeParsedJsonV1(
    QuotaAccountStateProjectionInternalV1Schema.parse({
      ...unsigned,
      contentDigest: deriveQuotaAccountStateContentDigestV1(unsigned),
    }),
  );
}

function deriveReservationEnvelopeContentDigestV1(
  envelope: ReservationDecodedEnvelopeInternalV1,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RESERVATION_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
    {
      installationIdentityGenerationId:
        envelope.installationIdentityGenerationId,
      reservationOrdinal: envelope.reservationOrdinal,
      payload: envelope.payload,
    },
  );
}

function deriveEventEnvelopeContentDigestV1(
  envelope: EventDecodedEnvelopeInternalV1,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_EVENT_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
    {
      installationIdentityGenerationId:
        envelope.installationIdentityGenerationId,
      eventOrdinal: envelope.eventOrdinal,
      payload: envelope.payload,
    },
  );
}

function deriveReceiptEnvelopeContentDigestV1(
  envelope: ReceiptDecodedEnvelopeInternalV1,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
    {
      installationIdentityGenerationId:
        envelope.installationIdentityGenerationId,
      receiptOrdinal: envelope.receiptOrdinal,
      payload: envelope.payload,
    },
  );
}

function deriveHighWaterContentDigestV1(
  payload: HighWaterDecodedEnvelopeInternalV1["payload"],
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_REFERENCE_CANDIDATE_DOMAIN_V1,
    payload,
  );
}

interface ParsedLoadedEnvelopeInternalV1<TEnvelope> {
  readonly locatorReferenceDigest: ContentDigestV1;
  readonly canonicalEnvelopeBytes: CanonicalByteStringV1;
  readonly canonicalLogicalBytes: number;
  readonly decodedEnvelope: TEnvelope;
}

function parseLoadedEnvelopeV1<TEnvelope>(
  shell: LoadedEnvelopeShellInternalV1,
  schema: z.ZodType<TEnvelope>,
  singleByteCap: number,
): ParsedLoadedEnvelopeInternalV1<TEnvelope> {
  const canonicalBytes = decodeCanonicalByteStringV1(
    shell.canonicalEnvelopeBytes,
  );
  const actualByteLength = typedArrayByteLengthV1(canonicalBytes);
  if (
    actualByteLength > singleByteCap ||
    shell.canonicalLogicalBytes !== actualByteLength
  ) {
    return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
  }
  let parsedRaw: unknown;
  try {
    const rawText = decodeUtf8V1(canonicalBytes);
    parsedRaw = CapturedJsonParseV1(rawText);
    const parsedEnvelope = parseJsonFieldsV1(schema, parsedRaw);
    if (canonicalizeJcsSafeIntegerV1(parsedEnvelope) !== rawText) {
      return failV1(
        "quota_reference_snapshot",
        "quota_ledger_integrity_failed",
      );
    }
    return CapturedObjectFreezeV1({
      locatorReferenceDigest: shell.locatorReferenceDigest,
      canonicalEnvelopeBytes: shell.canonicalEnvelopeBytes,
      canonicalLogicalBytes: actualByteLength,
      decodedEnvelope: freezeParsedJsonV1(parsedEnvelope as object) as TEnvelope,
    });
  } catch (error) {
    if (
      isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
        error,
      )
    ) {
      throw error;
    }
    return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
  }
}

function deriveOrderedLedgerSetDigestV1(
  domain: string,
  entries: readonly ParsedLoadedEnvelopeInternalV1<
    | ReservationDecodedEnvelopeInternalV1
    | EventDecodedEnvelopeInternalV1
    | ReceiptDecodedEnvelopeInternalV1
  >[],
  ordinal: (
    envelope:
      | ReservationDecodedEnvelopeInternalV1
      | EventDecodedEnvelopeInternalV1
      | ReceiptDecodedEnvelopeInternalV1,
  ) => number,
): ContentDigestV1 {
  const projection: Array<Readonly<{
    ordinal: number;
    locatorReferenceDigest: ContentDigestV1;
    contentDigest: ContentDigestV1;
  }>> = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    arrayPushV1(projection, {
      ordinal: ordinal(entry.decodedEnvelope),
      locatorReferenceDigest: entry.locatorReferenceDigest,
      contentDigest: entry.decodedEnvelope.contentDigest,
    });
  }
  return digestForDomainV1(domain, { entries: projection });
}

function sumLoadedLogicalBytesV1(
  entries: readonly ParsedLoadedEnvelopeInternalV1<unknown>[],
  cap: number,
): number {
  let total = 0;
  for (let index = 0; index < entries.length; index += 1) {
    total = checkedAddV1(total, entries[index]!.canonicalLogicalBytes);
  }
  if (total > cap) {
    return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
  }
  return total;
}

function verifyLedgerRecordTokenV1(
  binding: HistoryQuotaReferenceMachineBindingInternalV1,
  input: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaLedgerRecordTokenVerificationInputInternalV1,
): void {
  let verified: unknown;
  try {
    verified = CapturedReflectApplyV1(
      binding.verifyQuotaLedgerRecordToken,
      binding.host,
      [CapturedObjectFreezeV1(input)],
    );
  } catch {
    return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
  }
  if (verified !== true) {
    return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
  }
}

function verifyHighWaterTokenV1(
  binding: HistoryQuotaReferenceMachineBindingInternalV1,
  highWater: HighWaterDecodedEnvelopeInternalV1,
): void {
  let verified: unknown;
  try {
    verified = CapturedReflectApplyV1(
      binding.verifyQuotaHighWaterToken,
      binding.host,
      [CapturedObjectFreezeV1({
        tokenDomain:
          PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
        installationIdentityGenerationId:
          highWater.installationIdentityGenerationId,
        payload: highWater.payload,
        outerContentDigest: highWater.contentDigest,
        token: highWater.quotaStateVersionToken,
      })],
    );
  } catch {
    return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
  }
  if (verified !== true) {
    return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
  }
}

interface ParsedCompleteQuotaCutInternalV1 {
  readonly reservations: readonly ParsedLoadedEnvelopeInternalV1<ReservationDecodedEnvelopeInternalV1>[];
  readonly events: readonly ParsedLoadedEnvelopeInternalV1<EventDecodedEnvelopeInternalV1>[];
  readonly receipts: readonly ParsedLoadedEnvelopeInternalV1<ReceiptDecodedEnvelopeInternalV1>[];
  readonly accountState: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateProjectionInternalV1;
  readonly highWater: ParsedLoadedEnvelopeInternalV1<HighWaterDecodedEnvelopeInternalV1>;
}

function accountForTransitionV1(
  transition: EventDecodedEnvelopeInternalV1["payload"]["transition"],
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1 {
  if (transition.kind === "reserve_reference_candidate") {
    return transition.after.account;
  }
  return transition.before.account;
}

function replaceAccountMapWithNormalizedV1(
  accountsByReferenceDigest: Map<
    string,
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1
  >,
  accounts: readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1[],
): void {
  mapClearV1(accountsByReferenceDigest);
  for (let index = 0; index < accounts.length; index += 1) {
    const account = accounts[index]!;
    mapSetV1(
      accountsByReferenceDigest,
      account.accountReferenceDigest,
      account,
    );
  }
}

interface ReplayedQuotaEventsInternalV1 {
  readonly beforeStates: readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateProjectionInternalV1[];
  readonly afterStates: readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateProjectionInternalV1[];
  readonly finalState: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateProjectionInternalV1;
}

function replayQuotaEventsV1(
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1,
  reservations: readonly ParsedLoadedEnvelopeInternalV1<ReservationDecodedEnvelopeInternalV1>[],
  events: readonly ParsedLoadedEnvelopeInternalV1<EventDecodedEnvelopeInternalV1>[],
): ReplayedQuotaEventsInternalV1 {
  const accountsByReferenceDigest = new CapturedMapV1<
    string,
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1
  >();
  const reservationConsumed = new CapturedSetV1<number>();
  const beforeStates: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateProjectionInternalV1[] = [];
  const afterStates: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateProjectionInternalV1[] = [];

  for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
    const event = events[eventIndex]!.decodedEnvelope;
    const transition = event.payload.transition;
    const beforeAccounts = normalizeAccountMapV1(accountsByReferenceDigest);
    const beforeState = createQuotaAccountStateV1(
      installationIdentityGenerationId,
      beforeAccounts,
    );
    if (
      event.payload.beforeAccountStateContentDigest !==
      beforeState.contentDigest
    ) {
      return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
    }
    arrayPushV1(beforeStates, beforeState);

    if (transition.kind === "reserve_reference_candidate") {
      const account = transition.after.account;
      const reservation = reservations[account.reservationOrdinal - 1]
        ?.decodedEnvelope;
      if (
        mapHasV1(accountsByReferenceDigest, account.accountReferenceDigest) ||
        reservation === undefined ||
        setHasV1(reservationConsumed, account.reservationOrdinal) ||
        reservation.payload.createdByOperationNonce !==
          event.payload.operationNonce ||
        !canonicalEqualV1(reservation.payload.account, account) ||
        account.createdByOperationNonce !== event.payload.operationNonce
      ) {
        return failV1(
          "quota_reference_snapshot",
          "quota_ledger_integrity_failed",
        );
      }
      setAddV1(reservationConsumed, account.reservationOrdinal);
      mapSetV1(
        accountsByReferenceDigest,
        account.accountReferenceDigest,
        account,
      );
    } else if (transition.kind === "retain_reference_candidate") {
      const before = transition.before.account;
      const after = transition.after.account;
      const current = mapGetV1(
        accountsByReferenceDigest,
        before.accountReferenceDigest,
      );
      if (
        current === undefined ||
        !canonicalEqualV1(current, before) ||
        before.accountReferenceDigest !== after.accountReferenceDigest ||
        before.reservationOrdinal !== after.reservationOrdinal ||
        before.createdByOperationNonce !== after.createdByOperationNonce ||
        before.migrationSlotCount !== after.migrationSlotCount ||
        !canonicalEqualV1(before.contribution, after.contribution)
      ) {
        return failV1(
          "quota_reference_snapshot",
          "quota_ledger_integrity_failed",
        );
      }
      mapSetV1(
        accountsByReferenceDigest,
        after.accountReferenceDigest,
        after,
      );
    } else {
      const before = transition.before.account;
      const current = mapGetV1(
        accountsByReferenceDigest,
        before.accountReferenceDigest,
      );
      if (
        current === undefined ||
        !canonicalEqualV1(current, before) ||
        !mapDeleteV1(accountsByReferenceDigest, before.accountReferenceDigest)
      ) {
        return failV1(
          "quota_reference_snapshot",
          "quota_ledger_integrity_failed",
        );
      }
    }

    const afterAccounts = normalizeAccountMapV1(accountsByReferenceDigest);
    replaceAccountMapWithNormalizedV1(
      accountsByReferenceDigest,
      afterAccounts,
    );
    const afterState = createQuotaAccountStateV1(
      installationIdentityGenerationId,
      afterAccounts,
    );
    if (
      event.payload.afterAccountStateContentDigest !== afterState.contentDigest
    ) {
      return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
    }
    arrayPushV1(afterStates, afterState);
  }

  if (setSizeV1(reservationConsumed) !== reservations.length) {
    return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
  }
  const finalAccounts = normalizeAccountMapV1(accountsByReferenceDigest);
  return CapturedObjectFreezeV1({
    beforeStates: CapturedObjectFreezeV1(beforeStates),
    afterStates: CapturedObjectFreezeV1(afterStates),
    finalState: createQuotaAccountStateV1(
      installationIdentityGenerationId,
      finalAccounts,
    ),
  });
}

function prefixLoadedLogicalBytesV1(
  entries: readonly ParsedLoadedEnvelopeInternalV1<unknown>[],
  count: number,
): number {
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    total = checkedAddV1(total, entries[index]!.canonicalLogicalBytes);
  }
  return total;
}

function deriveReservationSetDigestV1(
  entries: readonly ParsedLoadedEnvelopeInternalV1<ReservationDecodedEnvelopeInternalV1>[],
  count = entries.length,
): ContentDigestV1 {
  return deriveOrderedLedgerSetDigestV1(
    PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RESERVATION_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
    arraySliceV1(entries, 0, count),
    (envelope) =>
      (envelope as ReservationDecodedEnvelopeInternalV1).reservationOrdinal,
  );
}

function deriveEventSetDigestV1(
  entries: readonly ParsedLoadedEnvelopeInternalV1<EventDecodedEnvelopeInternalV1>[],
  count = entries.length,
): ContentDigestV1 {
  return deriveOrderedLedgerSetDigestV1(
    PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_EVENT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
    arraySliceV1(entries, 0, count),
    (envelope) => (envelope as EventDecodedEnvelopeInternalV1).eventOrdinal,
  );
}

function deriveReceiptSetDigestV1(
  entries: readonly ParsedLoadedEnvelopeInternalV1<ReceiptDecodedEnvelopeInternalV1>[],
  count = entries.length,
): ContentDigestV1 {
  return deriveOrderedLedgerSetDigestV1(
    PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
    arraySliceV1(entries, 0, count),
    (envelope) =>
      (envelope as ReceiptDecodedEnvelopeInternalV1).receiptOrdinal,
  );
}

function createHighWaterPayloadV1(
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1,
  reservations: readonly ParsedLoadedEnvelopeInternalV1<ReservationDecodedEnvelopeInternalV1>[],
  reservationCount: number,
  events: readonly ParsedLoadedEnvelopeInternalV1<EventDecodedEnvelopeInternalV1>[],
  eventCount: number,
  receipts: readonly ParsedLoadedEnvelopeInternalV1<ReceiptDecodedEnvelopeInternalV1>[],
  receiptCount: number,
  accountState: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateProjectionInternalV1,
): HighWaterDecodedEnvelopeInternalV1["payload"] {
  const currentEvent = eventCount === 0
    ? { state: "genesis" as const }
    : {
        state: "event" as const,
        eventOrdinal: eventCount,
        contentDigest: events[eventCount - 1]!.decodedEnvelope.contentDigest,
      };
  return freezeParsedJsonV1(
    HighWaterPayloadInternalV1Schema.parse({
      profile:
        "provider_migration_same_installation_identity_current_strong_source_normal_quota_high_water_payload_reference_candidate_v1",
      installationIdentityGenerationId,
      stateRevision: eventCount,
      ledgerRevision: receiptCount,
      currentEvent,
      reservationRecordCount: reservationCount,
      reservationRecordSetDigest: deriveReservationSetDigestV1(
        reservations,
        reservationCount,
      ),
      reservationRecordLogicalBytes: prefixLoadedLogicalBytesV1(
        reservations,
        reservationCount,
      ),
      eventCount,
      eventSetDigest: deriveEventSetDigestV1(events, eventCount),
      ledgerEventLogicalBytes: prefixLoadedLogicalBytesV1(events, eventCount),
      receiptCount,
      receiptSetDigest: deriveReceiptSetDigestV1(receipts, receiptCount),
      operationReceiptLogicalBytes: prefixLoadedLogicalBytesV1(
        receipts,
        receiptCount,
      ),
      accountCount: accountState.accountCount,
      accountSetDigest: accountState.accountSetDigest,
      accountStateContentDigest: accountState.contentDigest,
      usage: accountState.usage,
      futureTerminalTransitionEscrowCount:
        accountState.futureTerminalTransitionEscrowCount,
      eventEscrowLogicalBytes: accountState.eventEscrowLogicalBytes,
      receiptEscrowLogicalBytes: accountState.receiptEscrowLogicalBytes,
    }),
  );
}

function verifyReceiptReplayAndFinalHighWaterV1(
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1,
  parsed: ParsedCompleteQuotaCutInternalV1,
  replayed: ReplayedQuotaEventsInternalV1,
): void {
  const currentAccountsByReferenceDigest = new CapturedMapV1<
    string,
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1
  >();
  let currentState = createQuotaAccountStateV1(
    installationIdentityGenerationId,
    CapturedObjectFreezeV1([]),
  );
  let reservationCount = 0;
  let eventCount = 0;
  const receiptNonces = new CapturedSetV1<string>();

  for (let receiptIndex = 0; receiptIndex < parsed.receipts.length; receiptIndex += 1) {
    const receipt = parsed.receipts[receiptIndex]!.decodedEnvelope;
    const payload = receipt.payload;
    if (setHasV1(receiptNonces, payload.operationNonce)) {
      return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
    }
    setAddV1(receiptNonces, payload.operationNonce);
    const observedPrePayload = createHighWaterPayloadV1(
      installationIdentityGenerationId,
      parsed.reservations,
      reservationCount,
      parsed.events,
      eventCount,
      parsed.receipts,
      receiptIndex,
      currentState,
    );
    if (
      payload.observedPreHighWaterContentDigest !==
      deriveHighWaterContentDigestV1(observedPrePayload)
    ) {
      return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
    }

    if (payload.outcome.state === "not_committed_reference_candidate") {
      const prospectiveAccountReferenceDigest =
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1(
          {
            installationIdentityGenerationId,
            reservationOrdinal: reservationCount + 1,
            createdByOperationNonce: payload.operationNonce,
          },
        );
      if (
        payload.accountReferenceDigest !== prospectiveAccountReferenceDigest ||
        payload.outcome.observedAccountStateContentDigest !==
          currentState.contentDigest ||
        mapHasV1(
          currentAccountsByReferenceDigest,
          prospectiveAccountReferenceDigest,
        )
      ) {
        return failV1(
          "quota_reference_snapshot",
          "quota_ledger_integrity_failed",
        );
      }
      continue;
    }

    if (payload.outcome.eventOrdinal !== eventCount + 1) {
      return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
    }
    const eventEntry = parsed.events[eventCount];
    const event = eventEntry?.decodedEnvelope;
    const beforeState = replayed.beforeStates[eventCount];
    const afterState = replayed.afterStates[eventCount];
    if (
      event === undefined ||
      beforeState === undefined ||
      afterState === undefined ||
      !canonicalEqualV1(beforeState, currentState) ||
      event.payload.operationNonce !== payload.operationNonce ||
      event.payload.requestContentDigest !== payload.requestContentDigest ||
      event.contentDigest !== payload.outcome.eventContentDigest ||
      afterState.contentDigest !==
        payload.outcome.postAccountStateContentDigest
    ) {
      return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
    }
    const transitionAccount = accountForTransitionV1(event.payload.transition);
    if (payload.accountReferenceDigest !== transitionAccount.accountReferenceDigest) {
      return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
    }
    if (event.payload.transition.kind === "reserve_reference_candidate") {
      const reservation = parsed.reservations[reservationCount]
        ?.decodedEnvelope;
      if (
        reservation === undefined ||
        reservation.reservationOrdinal !== reservationCount + 1 ||
        reservation.payload.createdByOperationNonce !== payload.operationNonce ||
        reservation.payload.account.accountReferenceDigest !==
          payload.accountReferenceDigest
      ) {
        return failV1(
          "quota_reference_snapshot",
          "quota_ledger_integrity_failed",
        );
      }
      reservationCount += 1;
    }
    eventCount += 1;
    currentState = afterState;
    replaceAccountMapWithNormalizedV1(
      currentAccountsByReferenceDigest,
      currentState.accounts,
    );
  }

  if (
    reservationCount !== parsed.reservations.length ||
    eventCount !== parsed.events.length ||
    !canonicalEqualV1(currentState, replayed.finalState)
  ) {
    return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
  }
  const expectedHighWaterPayload = createHighWaterPayloadV1(
    installationIdentityGenerationId,
    parsed.reservations,
    parsed.reservations.length,
    parsed.events,
    parsed.events.length,
    parsed.receipts,
    parsed.receipts.length,
    replayed.finalState,
  );
  if (
    !canonicalEqualV1(
      expectedHighWaterPayload,
      parsed.highWater.decodedEnvelope.payload,
    )
  ) {
    return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
  }
}

function parseAndVerifyCompleteQuotaCutV1(
  binding: HistoryQuotaReferenceMachineBindingInternalV1,
  preflightedCut: PreflightCompleteQuotaCutRawInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1 {
  let cut: z.infer<typeof CompleteQuotaCutRawInternalV1Schema>;
  try {
    // Only bounded shell metadata reaches this strict tree check. Decoded DTOs
    // are derived later from the capped canonical bytes, and account state is
    // derived only from replay, so neither is caller-owned host data.
    assertJsonDataTreeBeforeSchemaV1(preflightedCut);
    cut = CompleteQuotaCutRawInternalV1Schema.parse(preflightedCut);
  } catch {
    return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
  }

  const reservations: ParsedLoadedEnvelopeInternalV1<ReservationDecodedEnvelopeInternalV1>[] = [];
  const events: ParsedLoadedEnvelopeInternalV1<EventDecodedEnvelopeInternalV1>[] = [];
  const receipts: ParsedLoadedEnvelopeInternalV1<ReceiptDecodedEnvelopeInternalV1>[] = [];
  for (let index = 0; index < cut.reservations.length; index += 1) {
    arrayPushV1(
      reservations,
      parseLoadedEnvelopeV1(
        cut.reservations[index]!,
        ReservationDecodedEnvelopeInternalV1Schema,
        MAX_SINGLE_RESERVATION_RECORD_LOGICAL_BYTES_V1,
      ),
    );
  }
  for (let index = 0; index < cut.events.length; index += 1) {
    arrayPushV1(
      events,
      parseLoadedEnvelopeV1(
        cut.events[index]!,
        EventDecodedEnvelopeInternalV1Schema,
        MAX_SINGLE_EVENT_LOGICAL_BYTES_V1,
      ),
    );
  }
  for (let index = 0; index < cut.receipts.length; index += 1) {
    arrayPushV1(
      receipts,
      parseLoadedEnvelopeV1(
        cut.receipts[index]!,
        ReceiptDecodedEnvelopeInternalV1Schema,
        MAX_SINGLE_RECEIPT_LOGICAL_BYTES_V1,
      ),
    );
  }
  const highWater = parseLoadedEnvelopeV1(
    cut.highWater,
    HighWaterDecodedEnvelopeInternalV1Schema,
    MAX_HIGH_WATER_LOGICAL_BYTES_V1,
  );

  const reservationRecordLogicalBytes = sumLoadedLogicalBytesV1(
    reservations,
    MAX_RESERVATION_RECORD_LOGICAL_BYTES_V1,
  );
  const ledgerEventLogicalBytes = sumLoadedLogicalBytesV1(
    events,
    MAX_EVENT_LOGICAL_BYTES_V1,
  );
  const operationReceiptLogicalBytes = sumLoadedLogicalBytesV1(
    receipts,
    MAX_RECEIPT_LOGICAL_BYTES_V1,
  );

  const locatorDigests = new CapturedSetV1<string>();
  const reservationNonces = new CapturedSetV1<string>();
  for (let index = 0; index < reservations.length; index += 1) {
    const entry = reservations[index]!;
    const envelope = entry.decodedEnvelope;
    const expectedOrdinal = index + 1;
    if (
      envelope.installationIdentityGenerationId !==
        binding.installationIdentityGenerationId ||
      envelope.payload.installationIdentityGenerationId !==
        binding.installationIdentityGenerationId ||
      envelope.reservationOrdinal !== expectedOrdinal ||
      envelope.payload.reservationOrdinal !== expectedOrdinal ||
      envelope.payload.account.reservationOrdinal !== expectedOrdinal ||
      envelope.payload.account.createdByOperationNonce !==
        envelope.payload.createdByOperationNonce ||
      envelope.contentDigest !==
        deriveReservationEnvelopeContentDigestV1(envelope) ||
      setHasV1(locatorDigests, entry.locatorReferenceDigest) ||
      setHasV1(
        reservationNonces,
        envelope.payload.createdByOperationNonce,
      )
    ) {
      return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
    }
    const expectedAccountReferenceDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1(
        {
          installationIdentityGenerationId:
            binding.installationIdentityGenerationId,
          reservationOrdinal: envelope.payload.account.reservationOrdinal,
          createdByOperationNonce:
            envelope.payload.account.createdByOperationNonce,
        },
      );
    if (
      envelope.payload.account.accountReferenceDigest !==
      expectedAccountReferenceDigest
    ) {
      return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
    }
    setAddV1(locatorDigests, entry.locatorReferenceDigest);
    setAddV1(
      reservationNonces,
      envelope.payload.createdByOperationNonce,
    );
    verifyLedgerRecordTokenV1(binding, {
      tokenDomain:
        PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_LEDGER_RECORD_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
      recordType: envelope.recordType,
      installationIdentityGenerationId:
        envelope.installationIdentityGenerationId,
      ordinal: envelope.reservationOrdinal,
      locatorReferenceDigest: entry.locatorReferenceDigest,
      contentDigest: envelope.contentDigest,
      token: envelope.recordToken,
    });
  }

  const eventNonces = new CapturedSetV1<string>();
  for (let index = 0; index < events.length; index += 1) {
    const entry = events[index]!;
    const envelope = entry.decodedEnvelope;
    const expectedOrdinal = index + 1;
    const expectedPredecessor = index === 0
      ? { state: "genesis" as const }
      : {
          state: "event" as const,
          eventOrdinal: index,
          contentDigest: events[index - 1]!.decodedEnvelope.contentDigest,
        };
    if (
      envelope.installationIdentityGenerationId !==
        binding.installationIdentityGenerationId ||
      envelope.payload.installationIdentityGenerationId !==
        binding.installationIdentityGenerationId ||
      envelope.eventOrdinal !== expectedOrdinal ||
      envelope.payload.eventOrdinal !== expectedOrdinal ||
      !canonicalEqualV1(envelope.payload.predecessor, expectedPredecessor) ||
      envelope.contentDigest !== deriveEventEnvelopeContentDigestV1(envelope) ||
      setHasV1(locatorDigests, entry.locatorReferenceDigest) ||
      setHasV1(eventNonces, envelope.payload.operationNonce)
    ) {
      return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
    }
    const transitionAccount = accountForTransitionV1(
      envelope.payload.transition,
    );
    const expectedAccountDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1(
        {
          installationIdentityGenerationId:
            binding.installationIdentityGenerationId,
          reservationOrdinal: transitionAccount.reservationOrdinal,
          createdByOperationNonce: transitionAccount.createdByOperationNonce,
        },
      );
    if (transitionAccount.accountReferenceDigest !== expectedAccountDigest) {
      return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
    }
    setAddV1(locatorDigests, entry.locatorReferenceDigest);
    setAddV1(eventNonces, envelope.payload.operationNonce);
    verifyLedgerRecordTokenV1(binding, {
      tokenDomain:
        PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_LEDGER_RECORD_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
      recordType: envelope.recordType,
      installationIdentityGenerationId:
        envelope.installationIdentityGenerationId,
      ordinal: envelope.eventOrdinal,
      locatorReferenceDigest: entry.locatorReferenceDigest,
      contentDigest: envelope.contentDigest,
      token: envelope.recordToken,
    });
  }

  for (let index = 0; index < receipts.length; index += 1) {
    const entry = receipts[index]!;
    const envelope = entry.decodedEnvelope;
    const expectedOrdinal = index + 1;
    if (
      envelope.installationIdentityGenerationId !==
        binding.installationIdentityGenerationId ||
      envelope.payload.installationIdentityGenerationId !==
        binding.installationIdentityGenerationId ||
      envelope.receiptOrdinal !== expectedOrdinal ||
      envelope.payload.receiptOrdinal !== expectedOrdinal ||
      envelope.contentDigest !==
        deriveReceiptEnvelopeContentDigestV1(envelope) ||
      setHasV1(locatorDigests, entry.locatorReferenceDigest)
    ) {
      return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
    }
    setAddV1(locatorDigests, entry.locatorReferenceDigest);
    verifyLedgerRecordTokenV1(binding, {
      tokenDomain:
        PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_LEDGER_RECORD_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
      recordType: envelope.recordType,
      installationIdentityGenerationId:
        envelope.installationIdentityGenerationId,
      ordinal: envelope.receiptOrdinal,
      locatorReferenceDigest: entry.locatorReferenceDigest,
      contentDigest: envelope.contentDigest,
      token: envelope.recordToken,
    });
  }

  const highWaterEnvelope = highWater.decodedEnvelope;
  if (
    highWaterEnvelope.installationIdentityGenerationId !==
      binding.installationIdentityGenerationId ||
    highWaterEnvelope.payload.installationIdentityGenerationId !==
      binding.installationIdentityGenerationId ||
    highWaterEnvelope.contentDigest !==
      deriveHighWaterContentDigestV1(highWaterEnvelope.payload) ||
    setHasV1(locatorDigests, highWater.locatorReferenceDigest)
  ) {
    return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
  }
  verifyHighWaterTokenV1(binding, highWaterEnvelope);

  const frozenReservations = CapturedObjectFreezeV1(reservations);
  const frozenEvents = CapturedObjectFreezeV1(events);
  const frozenReceipts = CapturedObjectFreezeV1(receipts);
  const replayed = replayQuotaEventsV1(
    binding.installationIdentityGenerationId,
    frozenReservations,
    frozenEvents,
  );
  const accountState = replayed.finalState;
  const parsed = CapturedObjectFreezeV1({
    reservations: frozenReservations,
    events: frozenEvents,
    receipts: frozenReceipts,
    accountState,
    highWater,
  }) satisfies ParsedCompleteQuotaCutInternalV1;
  verifyReceiptReplayAndFinalHighWaterV1(
    binding.installationIdentityGenerationId,
    parsed,
    replayed,
  );

  const payload = highWaterEnvelope.payload;
  if (
    payload.reservationRecordCount !== reservations.length ||
    payload.reservationRecordSetDigest !==
      deriveReservationSetDigestV1(reservations) ||
    payload.reservationRecordLogicalBytes !== reservationRecordLogicalBytes ||
    payload.eventCount !== events.length ||
    payload.eventSetDigest !== deriveEventSetDigestV1(events) ||
    payload.ledgerEventLogicalBytes !== ledgerEventLogicalBytes ||
    payload.receiptCount !== receipts.length ||
    payload.receiptSetDigest !== deriveReceiptSetDigestV1(receipts) ||
    payload.operationReceiptLogicalBytes !== operationReceiptLogicalBytes ||
    payload.accountCount !== accountState.accountCount ||
    payload.accountSetDigest !== accountState.accountSetDigest ||
    payload.accountStateContentDigest !== accountState.contentDigest ||
    !canonicalEqualV1(payload.usage, accountState.usage) ||
    payload.futureTerminalTransitionEscrowCount !==
      accountState.futureTerminalTransitionEscrowCount ||
    payload.eventEscrowLogicalBytes !==
      accountState.eventEscrowLogicalBytes ||
    payload.receiptEscrowLogicalBytes !==
      accountState.receiptEscrowLogicalBytes
  ) {
    return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
  }

  const unsignedSnapshot = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_snapshot_reference_candidate_v1" as const,
    installationIdentityGenerationId:
      binding.installationIdentityGenerationId,
    accounts: accountState.accounts,
    accountCount: accountState.accountCount,
    accountSetDigest: accountState.accountSetDigest,
    usage: accountState.usage,
    reservationRecordCount: payload.reservationRecordCount,
    reservationRecordSetDigest: payload.reservationRecordSetDigest,
    reservationRecordLogicalBytes: payload.reservationRecordLogicalBytes,
    eventCount: payload.eventCount,
    eventSetDigest: payload.eventSetDigest,
    ledgerEventLogicalBytes: payload.ledgerEventLogicalBytes,
    receiptCount: payload.receiptCount,
    receiptSetDigest: payload.receiptSetDigest,
    operationReceiptLogicalBytes: payload.operationReceiptLogicalBytes,
    futureTerminalTransitionEscrowCount:
      payload.futureTerminalTransitionEscrowCount,
    eventEscrowLogicalBytes: payload.eventEscrowLogicalBytes,
    receiptEscrowLogicalBytes: payload.receiptEscrowLogicalBytes,
    quotaHighWaterReferenceDigest: highWaterEnvelope.contentDigest,
  };
  return freezeParsedJsonV1(
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1Schema.parse(
      {
        ...unsignedSnapshot,
        quotaSnapshotContentDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotContentDigestReferenceCandidateV1(
            unsignedSnapshot,
          ),
      },
    ),
  );
}

interface DeliveredCompleteQuotaCutEnvelopeInternalV1 {
  readonly cut: PreflightCompleteQuotaCutRawInternalV1;
}

async function captureTrustedCompleteQuotaCutDeliveryV1(
  binding: HistoryQuotaReferenceMachineBindingInternalV1,
  phase: "pre" | "post",
): Promise<DeliveredCompleteQuotaCutEnvelopeInternalV1> {
  const challenge = createHistoryQuotaObservationMintChallengeV1(
    binding,
    "complete_quota_cut",
    phase,
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutMintChallengeInternalV1;
  const challengeBinding = weakMapGetV1(
    historyQuotaObservationMintChallengeBindingsV1,
    challenge,
  );
  if (challengeBinding === undefined) {
    throw new CapturedTypeErrorV1("history quota cut challenge unavailable");
  }
  let resolveDelivery!: (
    value: DeliveredCompleteQuotaCutEnvelopeInternalV1,
  ) => void;
  let rejectDelivery!: (reason: unknown) => void;
  const delivery = new CapturedPromiseV1<DeliveredCompleteQuotaCutEnvelopeInternalV1>(
    (resolve, reject) => {
      resolveDelivery = resolve;
      rejectDelivery = reject;
    },
  );
  let hostReturned = false;
  let terminal = false;
  let delivered: DeliveredCompleteQuotaCutEnvelopeInternalV1 | undefined;
  const deliverCompleteQuotaCutCapability = CapturedObjectFreezeV1(
    (value: unknown): void => {
      if (terminal || delivered !== undefined) {
        throw new CapturedTypeErrorV1("history quota cut delivery replayed");
      }
      try {
        const payload = takeHistoryQuotaObservationCapabilityV1(
          value,
          challenge,
          challengeBinding,
          "complete_quota_cut",
        );
        delivered = createFrozenRecordV1<DeliveredCompleteQuotaCutEnvelopeInternalV1>([
          ["cut", payload as PreflightCompleteQuotaCutRawInternalV1],
        ]);
      } catch (error) {
        terminal = true;
        rejectDelivery(error);
        throw error;
      }
      if (hostReturned) {
        terminal = true;
        resolveDelivery(delivered);
      }
    },
  );
  const rejectCompleteQuotaCutObservation = CapturedObjectFreezeV1((): void => {
    if (terminal) return;
    terminal = true;
    rejectDelivery(new CapturedTypeErrorV1("history quota cut rejected"));
  });
  try {
    try {
      // Host return authority is deliberately void: no Get("then") occurs.
      void CapturedReflectApplyV1(
        binding.captureCompleteQuotaCut,
        binding.host,
        [createFrozenRecordV1([
          ["phase", phase],
          [
            "installationIdentityGenerationId",
            binding.installationIdentityGenerationId,
          ],
          ["completeQuotaCutMintChallenge", challenge],
          [
            "deliverCompleteQuotaCutCapability",
            deliverCompleteQuotaCutCapability,
          ],
          [
            "rejectCompleteQuotaCutObservation",
            rejectCompleteQuotaCutObservation,
          ],
        ])],
      );
      hostReturned = true;
      if (delivered !== undefined && !terminal) {
        terminal = true;
        resolveDelivery(delivered);
      }
    } catch (error) {
      if (!terminal) {
        terminal = true;
        rejectDelivery(error);
      }
    }
    // The null-prototype envelope is the only Promise fulfillment value.
    return await delivery;
  } finally {
    invalidateHistoryQuotaObservationMintChallengeV1(challenge);
  }
}

async function captureCompleteQuotaCutPreparedV1(
  binding: HistoryQuotaReferenceMachineBindingInternalV1,
  phase: "pre" | "post",
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCaptureInternalV1> {
  try {
    const delivered = await captureTrustedCompleteQuotaCutDeliveryV1(
      binding,
      phase,
    );
    const snapshot = parseAndVerifyCompleteQuotaCutV1(binding, delivered.cut);
    const capture = createFrozenRecordV1<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCaptureInternalV1>([
      ["phase", phase],
      ["quotaSnapshot", snapshot],
    ]);
    weakMapSetV1(quotaCutBindingsV1, capture, {
      machine: binding,
      phase,
      snapshot,
    });
    if (phase === "pre") {
      binding.preCapture = capture;
      binding.captureState = "pre_captured";
    } else {
      binding.captureState = "post_captured";
    }
    return capture;
  } catch (error) {
    binding.captureState = "failed";
    if (
      isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
        error,
      )
    ) {
      throw error;
    }
    return failV1("quota_reference_snapshot", "quota_ledger_integrity_failed");
  }
}

export function captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
  input: Readonly<{
    quotaMachineCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1;
    phase: "pre" | "post";
  }>,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCaptureInternalV1> {
  try {
    const fields = captureProviderPointDetachedExactDataObjectV1(
      input,
      CAPTURE_INPUT_KEYS_V1,
    );
    const binding = requireMachineBindingV1(fields.quotaMachineCapability);
    const phase = z.enum(["pre", "post"]).parse(fields.phase);
    if (
      (phase === "pre" && binding.captureState !== "ready") ||
      (phase === "post" && binding.captureState !== "pre_captured")
    ) {
      return createProviderPointRejectedPromiseV1(
        new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
          "pre_plan_reference_capability",
          "capability_invalid",
        ),
      );
    }
    binding.captureState = phase === "pre" ? "pre_pending" : "post_pending";
    return hardenProviderPointPromiseV1(
      captureCompleteQuotaCutPreparedV1(binding, phase),
    );
  } catch (error) {
    return createProviderPointRejectedPromiseV1(
      isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
        error,
      )
        ? error
        : new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
            "quota_reference_snapshot",
            "schema_invalid",
          ),
    );
  }
}

function assertMigrationBudgetsCoverSourceV1(
  closure: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1,
  budgets: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1,
): void {
  let minimumProgressRecords: number;
  try {
    minimumProgressRecords = checkedAddV1(
      checkedMultiplyV1(budgets.maxLiveObjects, 2),
      7,
    );
  } catch {
    return failV1("source_dry_run_cut", "budget_exceeded");
  }
  if (
    closure.rootCount > budgets.maxRootEntries ||
    closure.objectCount > budgets.maxLiveObjects ||
    closure.referenceCount > budgets.maxReferenceEdges ||
    closure.objectCount > budgets.maxRewriteObjects ||
    closure.referenceCount > budgets.maxRewriteReferenceMappings ||
    closure.logicalObjectBytesTotal > budgets.maxLogicalObjectBytesTotal ||
    closure.canonicalUniverseBytes > budgets.maxCanonicalUniverseBytes ||
    closure.canonicalReferenceSetBytes >
      budgets.maxCanonicalReferenceSetBytes ||
    budgets.maxProgressRecords < minimumProgressRecords ||
    budgets.maxRetainedMigrationHistoryLogicalBytesTotal >
      budgets.maxCanonicalMigrationBytesTotal ||
    budgets.maxCanonicalMigrationBytesTotal > MAX_SINGLE_HISTORY_LOGICAL_BYTES_V1 ||
    budgets.maxRetainedMigrationHistoryProviderAllocatedBytesTotal >
      MAX_SINGLE_HISTORY_PROVIDER_ALLOCATED_BYTES_V1
  ) {
    return failV1("source_dry_run_cut", "budget_exceeded");
  }
  const componentCaps = [
    budgets.maxCanonicalUniverseBytes,
    budgets.maxCanonicalReferenceSetBytes,
    budgets.maxCanonicalRewritePlanBytes,
    budgets.maxCanonicalRewrittenReferenceSetBytesTotal,
    budgets.maxCanonicalSemanticEquivalenceProofBytesTotal,
    budgets.maxCanonicalRootRewriteProofSetBytes,
    budgets.maxCanonicalZeroLiveProofBytes,
    budgets.maxCanonicalReceiptBytesTotal,
    budgets.maxCanonicalProgressRecordSetBytes,
    budgets.maxCanonicalProgressOperationReceiptBytesTotal,
  ];
  for (let index = 0; index < componentCaps.length; index += 1) {
    if (componentCaps[index]! > budgets.maxCanonicalMigrationBytesTotal) {
      return failV1("source_dry_run_cut", "budget_exceeded");
    }
  }
}

function deriveJournalChargeAmountsV1(
  budgets: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1,
  retainedArtifactUpperBounds: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundsReferenceCandidateV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaChargeAmountsReferenceCandidateV1 {
  let reservedHistoryLogicalBytes = 0;
  let reservedHistoryProviderAllocatedBytes = 0;
  for (let index = 0; index < retainedArtifactUpperBounds.length; index += 1) {
    const upperBound = retainedArtifactUpperBounds[index]!;
    reservedHistoryLogicalBytes = checkedAddV1(
      reservedHistoryLogicalBytes,
      upperBound.canonicalEnvelopeBytesUpperBoundTotal,
    );
    reservedHistoryProviderAllocatedBytes = checkedAddV1(
      reservedHistoryProviderAllocatedBytes,
      upperBound.providerAllocatedBytesUpperBoundTotal,
    );
  }
  const charge = {
    reservedHistoryLogicalBytes,
    reservedHistoryProviderAllocatedBytes,
    reservedObjectReceiptCount: budgets.maxLiveObjects,
    reservedObjectReceiptLogicalBytes: budgets.maxCanonicalReceiptBytesTotal,
    reservedSemanticRootZeroProofCount: checkedAddV1(
      checkedAddV1(budgets.maxRewriteObjects, budgets.maxRootEntries),
      2,
    ),
    reservedSemanticRootZeroProofLogicalBytes: checkedAddV1(
      checkedAddV1(
        budgets.maxCanonicalRewritePlanBytes,
        budgets.maxCanonicalSemanticEquivalenceProofBytesTotal,
      ),
      checkedAddV1(
        budgets.maxCanonicalRootRewriteProofSetBytes,
        budgets.maxCanonicalZeroLiveProofBytes,
      ),
    ),
    reservedProgressRecordCount: budgets.maxProgressRecords,
    reservedProgressRecordLogicalBytes:
      budgets.maxCanonicalProgressRecordSetBytes,
    reservedProgressOperationReceiptCount:
      budgets.maxProgressOperationReceipts,
    reservedProgressOperationReceiptLogicalBytes:
      budgets.maxCanonicalProgressOperationReceiptBytesTotal,
  };
  if (
    reservedHistoryLogicalBytes !==
      budgets.maxRetainedMigrationHistoryLogicalBytesTotal ||
    reservedHistoryProviderAllocatedBytes !==
      budgets.maxRetainedMigrationHistoryProviderAllocatedBytesTotal
  ) {
    return failV1("source_dry_run_cut", "budget_exceeded");
  }
  return freezeParsedJsonV1(
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaChargeAmountsReferenceCandidateV1Schema.parse(
      charge,
    ),
  );
}

interface DeliveredRetainedArtifactProjectionEnvelopeInternalV1 {
  readonly projection: RetainedArtifactProjectionInternalV1;
}

async function captureTrustedRetainedArtifactProjectionDeliveryV1(
  binding: HistoryQuotaReferenceMachineBindingInternalV1,
): Promise<DeliveredRetainedArtifactProjectionEnvelopeInternalV1> {
  const challenge = createHistoryQuotaObservationMintChallengeV1(
    binding,
    "retained_artifact_upper_bounds",
    "source_dry_run_cut",
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRetainedArtifactUpperBoundsMintChallengeInternalV1;
  const challengeBinding = weakMapGetV1(
    historyQuotaObservationMintChallengeBindingsV1,
    challenge,
  );
  if (challengeBinding === undefined) {
    throw new CapturedTypeErrorV1(
      "retained artifact upper bounds challenge unavailable",
    );
  }
  let resolveDelivery!: (
    value: DeliveredRetainedArtifactProjectionEnvelopeInternalV1,
  ) => void;
  let rejectDelivery!: (reason: unknown) => void;
  const delivery =
    new CapturedPromiseV1<DeliveredRetainedArtifactProjectionEnvelopeInternalV1>(
      (resolve, reject) => {
        resolveDelivery = resolve;
        rejectDelivery = reject;
      },
    );
  let hostReturned = false;
  let terminal = false;
  let delivered:
    | DeliveredRetainedArtifactProjectionEnvelopeInternalV1
    | undefined;
  const deliverRetainedArtifactUpperBoundsCapability = CapturedObjectFreezeV1(
    (value: unknown): void => {
      if (terminal || delivered !== undefined) {
        throw new CapturedTypeErrorV1(
          "retained artifact upper bounds delivery replayed",
        );
      }
      try {
        const payload = takeHistoryQuotaObservationCapabilityV1(
          value,
          challenge,
          challengeBinding,
          "retained_artifact_upper_bounds",
        );
        delivered =
          createFrozenRecordV1<DeliveredRetainedArtifactProjectionEnvelopeInternalV1>([
            ["projection", payload as RetainedArtifactProjectionInternalV1],
          ]);
      } catch (error) {
        terminal = true;
        rejectDelivery(error);
        throw error;
      }
      if (hostReturned) {
        terminal = true;
        resolveDelivery(delivered);
      }
    },
  );
  const rejectRetainedArtifactUpperBoundsObservation = CapturedObjectFreezeV1(
    (): void => {
      if (terminal) return;
      terminal = true;
      rejectDelivery(
        new CapturedTypeErrorV1(
          "retained artifact upper bounds observation rejected",
        ),
      );
    },
  );
  try {
    try {
      // Host return authority is deliberately void: no Get("then") occurs.
      void CapturedReflectApplyV1(
        binding.captureRetainedArtifactUpperBounds,
        binding.host,
        [createFrozenRecordV1([
          ["phase", "source_dry_run_cut"],
          [
            "installationIdentityGenerationId",
            binding.installationIdentityGenerationId,
          ],
          ["retainedArtifactUpperBoundsMintChallenge", challenge],
          [
            "deliverRetainedArtifactUpperBoundsCapability",
            deliverRetainedArtifactUpperBoundsCapability,
          ],
          [
            "rejectRetainedArtifactUpperBoundsObservation",
            rejectRetainedArtifactUpperBoundsObservation,
          ],
        ])],
      );
      hostReturned = true;
      if (delivered !== undefined && !terminal) {
        terminal = true;
        resolveDelivery(delivered);
      }
    } catch (error) {
      if (!terminal) {
        terminal = true;
        rejectDelivery(error);
      }
    }
    // The null-prototype envelope is the only Promise fulfillment value.
    return await delivery;
  } finally {
    invalidateHistoryQuotaObservationMintChallengeV1(challenge);
  }
}

async function deriveSourceDryRunAndSizingPreparedV1(
  binding: HistoryQuotaReferenceMachineBindingInternalV1,
  completeSourceReadClosure: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1,
  migrationBudgets: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1,
  migrationBudgetsDigest: ContentDigestV1,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunAndHistoryQuotaSizingInternalV1> {
  try {
    const delivered =
      await captureTrustedRetainedArtifactProjectionDeliveryV1(binding);
    const projection = delivered.projection;
    assertMigrationBudgetsCoverSourceV1(
      completeSourceReadClosure,
      migrationBudgets,
    );
    const charge = deriveJournalChargeAmountsV1(
      migrationBudgets,
      projection.retainedArtifactUpperBounds,
    );
    const unsignedCut = {
      profile:
        "provider_migration_same_installation_identity_current_strong_source_normal_source_dry_run_cut_reference_candidate_v1" as const,
      mode: "same_installation_identity" as const,
      completeSourceReadClosure,
      completeSourceReadClosureContentDigest:
        completeSourceReadClosure.completeReadClosureContentDigest,
      migrationBudgetsDigest,
      retainedArtifactUpperBounds: projection.retainedArtifactUpperBounds,
      derivedJournalChargeAmounts: charge,
    };
    const sourceDryRunCut = freezeParsedJsonV1(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutReferenceCandidateV1Schema.parse(
        {
          ...unsignedCut,
          sourceDryRunCutContentDigest:
            deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutContentDigestReferenceCandidateV1(
              unsignedCut,
            ),
        },
      ),
    );
    const historyQuotaSizing = freezeParsedJsonV1(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1Schema.parse(
        {
          profile:
            "provider_migration_same_installation_identity_current_strong_source_normal_history_quota_sizing_reference_candidate_v1",
          sizingProfile:
            "provider_migration_same_installation_identity_current_strong_source_normal_zero_side_effect_complete_source_streaming_dry_run_reference_candidate_v1",
          mode: "same_installation_identity",
          migrationBudgetsDigest,
          sourceDryRunCut,
          sourceDryRunCutContentDigest:
            sourceDryRunCut.sourceDryRunCutContentDigest,
          journalChargeAmounts: charge,
        },
      ),
    );
    const historyQuotaSizingDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingDigestReferenceCandidateV1(
        historyQuotaSizing,
      );
    weakMapSetV1(sizingBindingsV1, historyQuotaSizing, {
      machine: binding,
      policyDigest: projection.policyDigest,
      sizingDigest: historyQuotaSizingDigest,
    });
    binding.artifactProjectionState = "captured";
    return createFrozenRecordV1<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunAndHistoryQuotaSizingInternalV1>([
      ["sourceDryRunCut", sourceDryRunCut],
      ["historyQuotaSizing", historyQuotaSizing],
      ["historyQuotaSizingDigest", historyQuotaSizingDigest],
    ]);
  } catch (error) {
    binding.artifactProjectionState = "failed";
    if (
      isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
        error,
      )
    ) {
      throw error;
    }
    return failV1("source_dry_run_cut", "budget_exceeded");
  }
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunAndHistoryQuotaSizingInternalV1(
  input: Readonly<{
    quotaMachineCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1;
    completeSourceReadClosure: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1;
    migrationBudgets: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1;
    migrationBudgetsDigest: ContentDigestV1;
  }>,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunAndHistoryQuotaSizingInternalV1> {
  try {
    const fields = captureProviderPointDetachedExactDataObjectV1(
      input,
      SIZING_INPUT_KEYS_V1,
    );
    const binding = requireMachineBindingV1(fields.quotaMachineCapability);
    if (binding.artifactProjectionState !== "ready") {
      return createProviderPointRejectedPromiseV1(
        new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
          "pre_plan_reference_capability",
          "capability_invalid",
        ),
      );
    }
    const completeSourceReadClosure = freezeParsedJsonV1(
      parseJsonFieldsV1(
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1Schema,
        fields.completeSourceReadClosure,
      ),
    );
    const migrationBudgets = freezeParsedJsonV1(
      parseJsonFieldsV1(
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema,
        fields.migrationBudgets,
      ),
    );
    const migrationBudgetsDigest = ContentDigestV1Schema.parse(
      fields.migrationBudgetsDigest,
    );
    if (
      migrationBudgetsDigest !==
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1(
        migrationBudgets,
      )
    ) {
      return createProviderPointRejectedPromiseV1(
        new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
          "source_dry_run_cut",
          "budget_exceeded",
        ),
      );
    }
    binding.artifactProjectionState = "pending";
    return hardenProviderPointPromiseV1(
      deriveSourceDryRunAndSizingPreparedV1(
        binding,
        completeSourceReadClosure,
        migrationBudgets,
        migrationBudgetsDigest,
      ),
    );
  } catch (error) {
    return createProviderPointRejectedPromiseV1(
      isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
        error,
      )
        ? error
        : new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
            "history_quota_sizing",
            "schema_invalid",
          ),
    );
  }
}

function foldProspectiveAccountingWitnessV1(
  snapshot: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1,
  charge: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaChargeAmountsReferenceCandidateV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1 {
  const usage = zeroQuotaUsageV1();
  for (let index = 0; index < snapshot.accounts.length; index += 1) {
    addContributionToUsageV1(usage, snapshot.accounts[index]!);
  }
  addAccountingContributionToUsageV1(
    usage,
    "reserved",
    1,
    {
      historyLogicalBytes: charge.reservedHistoryLogicalBytes,
      historyProviderAllocatedBytes:
        charge.reservedHistoryProviderAllocatedBytes,
      objectReceiptCount: charge.reservedObjectReceiptCount,
      objectReceiptLogicalBytes: charge.reservedObjectReceiptLogicalBytes,
      semanticRootZeroProofCount:
        charge.reservedSemanticRootZeroProofCount,
      semanticRootZeroProofLogicalBytes:
        charge.reservedSemanticRootZeroProofLogicalBytes,
      progressRecordCount: charge.reservedProgressRecordCount,
      progressRecordLogicalBytes: charge.reservedProgressRecordLogicalBytes,
      progressOperationReceiptCount:
        charge.reservedProgressOperationReceiptCount,
      progressOperationReceiptLogicalBytes:
        charge.reservedProgressOperationReceiptLogicalBytes,
    },
  );
  return freezeParsedJsonV1(
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1Schema.parse(
      usage,
    ),
  );
}

function assertNormalQuotaCapsV1(
  prospective: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1,
  charge: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaChargeAmountsReferenceCandidateV1,
): void {
  if (
    charge.reservedHistoryLogicalBytes > MAX_SINGLE_HISTORY_LOGICAL_BYTES_V1 ||
    charge.reservedHistoryProviderAllocatedBytes >
      MAX_SINGLE_HISTORY_PROVIDER_ALLOCATED_BYTES_V1 ||
    prospective.chargedMigrationCount > MAX_CHARGED_MIGRATION_COUNT_V1 - 1 ||
    prospective.chargedHistoryLogicalBytes >
      MAX_CHARGED_HISTORY_LOGICAL_BYTES_V1 -
        MAX_SINGLE_HISTORY_LOGICAL_BYTES_V1 ||
    prospective.chargedHistoryProviderAllocatedBytes >
      MAX_CHARGED_HISTORY_PROVIDER_ALLOCATED_BYTES_V1 -
        MAX_SINGLE_HISTORY_PROVIDER_ALLOCATED_BYTES_V1 ||
    prospective.reservedAccountCount > MAX_ACTIVE_RESERVATION_COUNT_V1 ||
    prospective.reservedHistoryLogicalBytes >
      MAX_ACTIVE_RESERVED_HISTORY_LOGICAL_BYTES_V1 ||
    prospective.reservedHistoryProviderAllocatedBytes >
      MAX_ACTIVE_RESERVED_HISTORY_PROVIDER_ALLOCATED_BYTES_V1 ||
    prospective.chargedObjectReceiptCount >
      MAX_CHARGED_OBJECT_RECEIPT_COUNT_V1 ||
    prospective.chargedObjectReceiptLogicalBytes >
      MAX_CHARGED_OBJECT_RECEIPT_LOGICAL_BYTES_V1 ||
    prospective.chargedSemanticRootZeroProofCount >
      MAX_CHARGED_SEMANTIC_ROOT_ZERO_PROOF_COUNT_V1 ||
    prospective.chargedSemanticRootZeroProofLogicalBytes >
      MAX_CHARGED_SEMANTIC_ROOT_ZERO_PROOF_LOGICAL_BYTES_V1 ||
    prospective.chargedProgressRecordCount >
      MAX_CHARGED_PROGRESS_RECORD_COUNT_V1 ||
    prospective.chargedProgressRecordLogicalBytes >
      MAX_CHARGED_PROGRESS_RECORD_LOGICAL_BYTES_V1 ||
    prospective.chargedProgressOperationReceiptCount >
      MAX_CHARGED_PROGRESS_OPERATION_RECEIPT_COUNT_V1 ||
    prospective.chargedProgressOperationReceiptLogicalBytes >
      MAX_CHARGED_PROGRESS_OPERATION_RECEIPT_LOGICAL_BYTES_V1 ||
    prospective.reservedObjectReceiptCount >
      MAX_CHARGED_OBJECT_RECEIPT_COUNT_V1 ||
    prospective.reservedObjectReceiptLogicalBytes >
      MAX_CHARGED_OBJECT_RECEIPT_LOGICAL_BYTES_V1 ||
    prospective.reservedSemanticRootZeroProofCount >
      MAX_CHARGED_SEMANTIC_ROOT_ZERO_PROOF_COUNT_V1 ||
    prospective.reservedSemanticRootZeroProofLogicalBytes >
      MAX_CHARGED_SEMANTIC_ROOT_ZERO_PROOF_LOGICAL_BYTES_V1 ||
    prospective.reservedProgressRecordCount >
      MAX_CHARGED_PROGRESS_RECORD_COUNT_V1 ||
    prospective.reservedProgressRecordLogicalBytes >
      MAX_CHARGED_PROGRESS_RECORD_LOGICAL_BYTES_V1 ||
    prospective.reservedProgressOperationReceiptCount >
      MAX_CHARGED_PROGRESS_OPERATION_RECEIPT_COUNT_V1 ||
    prospective.reservedProgressOperationReceiptLogicalBytes >
      MAX_CHARGED_PROGRESS_OPERATION_RECEIPT_LOGICAL_BYTES_V1
  ) {
    return failV1("history_quota_admission", "quota_capacity_exhausted");
  }
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionInternalV1(
  input: Readonly<{
    quotaMachineCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1;
    completeQuotaCut: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCaptureInternalV1;
    historyQuotaSizing: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1;
    historyQuotaSizingDigest: ContentDigestV1;
    admissionClass: "normal";
  }>,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionInternalV1 {
  try {
    const fields = captureProviderPointDetachedExactDataObjectV1(
      input,
      ADMISSION_INPUT_KEYS_V1,
    );
    const binding = requireMachineBindingV1(fields.quotaMachineCapability);
    if (!isObjectIdentityV1(fields.completeQuotaCut)) {
      return failV1("history_quota_admission", "capability_invalid");
    }
    const cutBinding = weakMapGetV1(
      quotaCutBindingsV1,
      fields.completeQuotaCut as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCaptureInternalV1,
    );
    if (
      cutBinding === undefined ||
      cutBinding.machine !== binding ||
      cutBinding.phase !== "pre" ||
      binding.preCapture !== fields.completeQuotaCut ||
      fields.admissionClass !== "normal" ||
      !isObjectIdentityV1(fields.historyQuotaSizing)
    ) {
      return failV1("history_quota_admission", "capability_invalid");
    }
    const sizingBinding = weakMapGetV1(
      sizingBindingsV1,
      fields.historyQuotaSizing as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1,
    );
    const historyQuotaSizing =
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1Schema.parse(
        fields.historyQuotaSizing,
      );
    const historyQuotaSizingDigest = ContentDigestV1Schema.parse(
      fields.historyQuotaSizingDigest,
    );
    if (
      sizingBinding === undefined ||
      sizingBinding.machine !== binding ||
      sizingBinding.sizingDigest !== historyQuotaSizingDigest ||
      historyQuotaSizingDigest !==
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingDigestReferenceCandidateV1(
          historyQuotaSizing,
        )
    ) {
      return failV1("history_quota_admission", "capability_invalid");
    }
    const snapshot = cutBinding.snapshot;
    const journalCharge = historyQuotaSizing.journalChargeAmounts;
    const charge = {
      ...journalCharge,
      role: "same_identity_journal" as const,
      installationIdentityGenerationId:
        binding.installationIdentityGenerationId,
      policyDigest: sizingBinding.policyDigest,
      migrationSlotCount: 1 as const,
    };
    const prospectiveChargedUsage =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveChargedUsageReferenceCandidateV1(
        { usage: snapshot.usage, charge },
      );
    const independentlyFoldedProspective = foldProspectiveAccountingWitnessV1(
      snapshot,
      journalCharge,
    );
    if (!canonicalEqualV1(prospectiveChargedUsage, independentlyFoldedProspective)) {
      return failV1("history_quota_admission", "quota_capacity_exhausted");
    }
    assertNormalQuotaCapsV1(prospectiveChargedUsage, journalCharge);
    const postReserveFutureTerminalTransitionEscrowCount = checkedAddV1(
      snapshot.futureTerminalTransitionEscrowCount,
      3,
    );
    const controlUpperBounds = {
      reservationRecordCountIncrement: 1 as const,
      reservationRecordLogicalBytesUpperBound:
        MAX_SINGLE_RESERVATION_RECORD_LOGICAL_BYTES_V1 as 1_048_576,
      reserveEventCountIncrement: 1 as const,
      reserveEventLogicalBytesUpperBound:
        MAX_SINGLE_EVENT_LOGICAL_BYTES_V1 as 262_144,
      reserveReceiptCountIncrement: 1 as const,
      reserveReceiptLogicalBytesUpperBound:
        MAX_SINGLE_RECEIPT_LOGICAL_BYTES_V1 as 1_048_576,
      postReserveFutureTerminalTransitionEscrowCount,
      prospectiveEventCountIncludingEscrow: checkedAddV1(
        checkedAddV1(snapshot.eventCount, 1),
        postReserveFutureTerminalTransitionEscrowCount,
      ),
      prospectiveEventLogicalBytesIncludingEscrow: checkedAddV1(
        checkedAddV1(
          snapshot.ledgerEventLogicalBytes,
          MAX_SINGLE_EVENT_LOGICAL_BYTES_V1,
        ),
        checkedMultiplyV1(
          postReserveFutureTerminalTransitionEscrowCount,
          MAX_SINGLE_EVENT_LOGICAL_BYTES_V1,
        ),
      ),
      prospectiveReceiptCountIncludingEscrow: checkedAddV1(
        checkedAddV1(snapshot.receiptCount, 1),
        postReserveFutureTerminalTransitionEscrowCount,
      ),
      prospectiveReceiptLogicalBytesIncludingEscrow: checkedAddV1(
        checkedAddV1(
          snapshot.operationReceiptLogicalBytes,
          MAX_SINGLE_RECEIPT_LOGICAL_BYTES_V1,
        ),
        checkedMultiplyV1(
          postReserveFutureTerminalTransitionEscrowCount,
          MAX_SINGLE_RECEIPT_LOGICAL_BYTES_V1,
        ),
      ),
      prospectiveReservationRecordCount: checkedAddV1(
        snapshot.reservationRecordCount,
        1,
      ),
      prospectiveReservationRecordLogicalBytes: checkedAddV1(
        snapshot.reservationRecordLogicalBytes,
        MAX_SINGLE_RESERVATION_RECORD_LOGICAL_BYTES_V1,
      ),
      currentHighWaterLogicalBytesUpperBound:
        MAX_HIGH_WATER_LOGICAL_BYTES_V1 as 1_048_576,
    };
    if (
      controlUpperBounds.prospectiveEventCountIncludingEscrow >
        MAX_EVENT_COUNT_V1 ||
      controlUpperBounds.prospectiveEventLogicalBytesIncludingEscrow >
        MAX_EVENT_LOGICAL_BYTES_V1 ||
      controlUpperBounds.prospectiveReceiptCountIncludingEscrow >
        MAX_RECEIPT_COUNT_V1 ||
      controlUpperBounds.prospectiveReceiptLogicalBytesIncludingEscrow >
        MAX_RECEIPT_LOGICAL_BYTES_V1 ||
      controlUpperBounds.prospectiveReservationRecordCount >
        MAX_RESERVATION_RECORD_COUNT_V1 ||
      controlUpperBounds.prospectiveReservationRecordLogicalBytes >
        MAX_RESERVATION_RECORD_LOGICAL_BYTES_V1
    ) {
      return failV1("history_quota_admission", "quota_capacity_exhausted");
    }
    const historyQuotaAdmission = freezeParsedJsonV1(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema.parse(
        {
          profile:
            "provider_migration_same_installation_identity_current_strong_source_normal_history_quota_admission_reference_candidate_v1",
          mode: "same_installation_identity",
          admissionClass: "normal",
          sizingDigest: historyQuotaSizingDigest,
          quotaSnapshot: snapshot,
          charges: [charge],
          prospectiveChargedUsage,
          controlUpperBounds,
          decision: "reference_admissible_at_captured_snapshot",
        },
      ),
    );
    const admissionVectorDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionVectorDigestReferenceCandidateV1(
        historyQuotaAdmission,
      );
    return createFrozenRecordV1<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionInternalV1>([
      ["historyQuotaAdmission", historyQuotaAdmission],
      ["admissionVectorDigest", admissionVectorDigest],
    ]);
  } catch (error) {
    if (
      isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
        error,
      )
    ) {
      throw error;
    }
    return failV1("history_quota_admission", "quota_capacity_exhausted");
  }
}

async function capturePostQuotaContinuityPreparedV1(
  binding: HistoryQuotaReferenceMachineBindingInternalV1,
  preCapture: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCaptureInternalV1,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostQuotaContinuityInternalV1> {
  const postCapture = await captureCompleteQuotaCutPreparedV1(binding, "post");
  if (!canonicalEqualV1(preCapture.quotaSnapshot, postCapture.quotaSnapshot)) {
    return failV1("post_observation", "snapshot_changed");
  }
  const unsigned = {
    preSnapshotContentDigest:
      preCapture.quotaSnapshot.quotaSnapshotContentDigest,
    postSnapshotContentDigest:
      postCapture.quotaSnapshot.quotaSnapshotContentDigest,
    equality: "exact" as const,
  };
  return createFrozenRecordV1<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostQuotaContinuityInternalV1>([
    ["preSnapshotContentDigest", unsigned.preSnapshotContentDigest],
    ["postSnapshotContentDigest", unsigned.postSnapshotContentDigest],
    ["equality", unsigned.equality],
    [
      "observationContentDigest",
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaObservationContentDigestReferenceCandidateV1(
        unsigned,
      ),
    ],
  ]);
}

export function captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostQuotaContinuityInternalV1(
  input: Readonly<{
    quotaMachineCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1;
    preContinuity: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCaptureInternalV1;
  }>,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostQuotaContinuityInternalV1> {
  try {
    const fields = captureProviderPointDetachedExactDataObjectV1(
      input,
      POST_INPUT_KEYS_V1,
    );
    const binding = requireMachineBindingV1(fields.quotaMachineCapability);
    if (
      !isObjectIdentityV1(fields.preContinuity) ||
      binding.captureState !== "pre_captured" ||
      binding.preCapture !== fields.preContinuity
    ) {
      return createProviderPointRejectedPromiseV1(
        new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
          "pre_plan_reference_capability",
          "capability_invalid",
        ),
      );
    }
    const cutBinding = weakMapGetV1(
      quotaCutBindingsV1,
      fields.preContinuity as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCaptureInternalV1,
    );
    if (
      cutBinding === undefined ||
      cutBinding.machine !== binding ||
      cutBinding.phase !== "pre"
    ) {
      return createProviderPointRejectedPromiseV1(
        new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
          "pre_plan_reference_capability",
          "capability_invalid",
        ),
      );
    }
    binding.captureState = "post_pending";
    return hardenProviderPointPromiseV1(
      capturePostQuotaContinuityPreparedV1(
        binding,
        fields.preContinuity as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCaptureInternalV1,
      ),
    );
  } catch (error) {
    return createProviderPointRejectedPromiseV1(
      isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
        error,
      )
        ? error
        : new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
            "post_observation",
            "schema_invalid",
          ),
    );
  }
}

CapturedObjectFreezeV1(
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1,
);
CapturedObjectFreezeV1(
  isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1,
);
CapturedObjectFreezeV1(
  assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRetainedArtifactUpperBoundsCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineInternalV1,
);
CapturedObjectFreezeV1(
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunAndHistoryQuotaSizingInternalV1,
);
CapturedObjectFreezeV1(
  captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1,
);
CapturedObjectFreezeV1(
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionInternalV1,
);
CapturedObjectFreezeV1(
  captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostQuotaContinuityInternalV1,
);
