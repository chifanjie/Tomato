import {
  canonicalizeJcsSafeIntegerUtf8V1,
  canonicalizeJcsSafeIntegerV1,
} from "./jcs.js";
import { ContentDigestV1Schema } from "./primitives.js";
import { PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1 } from "./provider-trust-policy.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedMapV1 = Map;
const CapturedMapPrototypeGetV1 = Map.prototype.get;
const CapturedMapPrototypeSetV1 = Map.prototype.set;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedTypedArrayPrototypeV1 = CapturedObjectGetPrototypeOfV1(
  CapturedUint8ArrayV1.prototype,
);
const CapturedTypedArrayByteLengthGetterCandidateV1 =
  CapturedObjectGetOwnPropertyDescriptorV1(
    CapturedTypedArrayPrototypeV1,
    "byteLength",
  )?.get;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetPrototypeAddV1 = CapturedWeakSetV1.prototype.add;
const CapturedWeakSetPrototypeHasV1 = CapturedWeakSetV1.prototype.has;
const LOWER_HEX_ALPHABET_V1 = "0123456789abcdef";
const EMPTY_ARGUMENTS_V1 = CapturedObjectFreezeV1([] as const);

if (CapturedTypedArrayByteLengthGetterCandidateV1 === undefined) {
  throw new CapturedTypeErrorV1(
    "Uint8Array byteLength primordial unavailable",
  );
}
const CapturedTypedArrayByteLengthGetterV1 =
  CapturedTypedArrayByteLengthGetterCandidateV1;

const retainedAccountingErrorsV1 = new CapturedWeakSetV1<object>();

function mapGetV1<K, V>(map: Map<K, V>, key: K): V | undefined {
  return CapturedReflectApplyV1(CapturedMapPrototypeGetV1, map, [key]) as
    | V
    | undefined;
}

function mapSetV1<K, V>(map: Map<K, V>, key: K, value: V): void {
  CapturedReflectApplyV1(CapturedMapPrototypeSetV1, map, [key, value]);
}

function typedArrayByteLengthV1(bytes: Uint8Array): number {
  return CapturedReflectApplyV1(
    CapturedTypedArrayByteLengthGetterV1,
    bytes,
    EMPTY_ARGUMENTS_V1,
  ) as number;
}

export const PROVIDER_DISTRIBUTION_MAX_SINGLE_RETAINED_OBJECT_CANONICAL_BYTES_V1 =
  16_777_216 as const;
export const PROVIDER_DISTRIBUTION_MAX_TOTAL_RETAINED_OBJECT_COUNT_V1 =
  65_536 as const;
export const PROVIDER_DISTRIBUTION_MAX_TOTAL_RETAINED_HISTORY_LOGICAL_BYTES_V1 =
  536_870_912 as const;

export type ProviderDistributionRetainedObjectKindInternalV1 =
  | "envelope"
  | "embedded_target_discovery_input_bundle";

export type ProviderDistributionRetainedAccountingFailureReasonInternalV1 =
  | "object_invalid"
  | "invalid_safe_integer"
  | "single_object_byte_limit_exceeded"
  | "retained_object_count_limit_exceeded"
  | "retained_history_byte_limit_exceeded"
  | "normal_update_emergency_generation_reserve_exhausted"
  | "normal_update_emergency_logical_bytes_reserve_exhausted"
  | "locator_ownership_conflict"
  | "retained_object_key_conflict";

export class ProviderDistributionRetainedAccountingErrorInternalV1 extends CapturedTypeErrorV1 {
  readonly reason: ProviderDistributionRetainedAccountingFailureReasonInternalV1;

  constructor(
    reason: ProviderDistributionRetainedAccountingFailureReasonInternalV1,
  ) {
    super("provider distribution retained accounting failed");
    this.name = "ProviderDistributionRetainedAccountingErrorInternalV1";
    this.reason = reason;
    CapturedReflectApplyV1(
      CapturedWeakSetPrototypeAddV1,
      retainedAccountingErrorsV1,
      [this],
    );
    CapturedObjectFreezeV1(this);
  }
}

export function isProviderDistributionRetainedAccountingErrorInternalV1(
  value: unknown,
): value is ProviderDistributionRetainedAccountingErrorInternalV1 {
  return (
    typeof value === "object" &&
    value !== null &&
    CapturedReflectApplyV1(
      CapturedWeakSetPrototypeHasV1,
      retainedAccountingErrorsV1,
      [value],
    ) === true
  );
}

export interface ProviderDistributionRetainedLimitTransitionInternalV1 {
  readonly currentRetainedObjectCount: number;
  readonly currentRetainedHistoryLogicalBytes: number;
  readonly nextObjectKind: ProviderDistributionRetainedObjectKindInternalV1;
  readonly nextCanonicalObjectBytes: number;
}

export interface ProviderDistributionRetainedNormalCandidateInternalV1 {
  readonly supportCatalogGenerationCount: number;
  readonly publicTaxonomyGenerationCount: number;
  readonly releaseMatrixGenerationCount: number;
  readonly targetDiscoveryResultGenerationCount: number;
  readonly releaseTargetUniverseGenerationCount: number;
  readonly retainedHistoryLogicalBytes: number;
}

export function diagnoseProviderDistributionRetainedNormalCandidateInternalV1(
  candidate: ProviderDistributionRetainedNormalCandidateInternalV1,
): ProviderDistributionRetainedAccountingFailureReasonInternalV1 | undefined {
  const generationCounts = [
    candidate.supportCatalogGenerationCount,
    candidate.publicTaxonomyGenerationCount,
    candidate.releaseMatrixGenerationCount,
    candidate.targetDiscoveryResultGenerationCount,
    candidate.releaseTargetUniverseGenerationCount,
  ] as const;
  for (let index = 0; index < generationCounts.length; index += 1) {
    const count = generationCounts[index]!;
    if (!CapturedNumberIsSafeIntegerV1(count) || count < 0) {
      return "invalid_safe_integer";
    }
  }
  if (
    !CapturedNumberIsSafeIntegerV1(candidate.retainedHistoryLogicalBytes) ||
    candidate.retainedHistoryLogicalBytes < 0
  ) {
    return "invalid_safe_integer";
  }
  const generationReserve =
    PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1
      .normalUpdateEmergencyGenerationReservePerChain;
  const generationLimits = [
    PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1
      .maxSupportCatalogGenerationCount,
    PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1
      .maxPublicTaxonomyGenerationCount,
    PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1.maxReleaseMatrixGenerationCount,
    PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1
      .maxTargetDiscoveryResultGenerationCount,
    PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1
      .maxReleaseTargetUniverseGenerationCount,
  ] as const;
  for (let index = 0; index < generationCounts.length; index += 1) {
    if (generationCounts[index]! > generationLimits[index]! - generationReserve) {
      return "normal_update_emergency_generation_reserve_exhausted";
    }
  }
  if (
    candidate.retainedHistoryLogicalBytes >
    PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1
      .maxTotalRetainedDistributionHistoryLogicalBytes -
      PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1
        .normalUpdateEmergencyLogicalBytesReserve
  ) {
    return "normal_update_emergency_logical_bytes_reserve_exhausted";
  }
  return undefined;
}

export function diagnoseProviderDistributionRetainedLimitTransitionInternalV1(
  transition: ProviderDistributionRetainedLimitTransitionInternalV1,
): ProviderDistributionRetainedAccountingFailureReasonInternalV1 | undefined {
  const {
    currentRetainedObjectCount,
    currentRetainedHistoryLogicalBytes,
    nextCanonicalObjectBytes,
    nextObjectKind,
  } = transition;
  if (
    nextObjectKind !== "envelope" &&
    nextObjectKind !== "embedded_target_discovery_input_bundle"
  ) {
    return "object_invalid";
  }
  if (
    !CapturedNumberIsSafeIntegerV1(currentRetainedObjectCount) ||
    !CapturedNumberIsSafeIntegerV1(currentRetainedHistoryLogicalBytes) ||
    !CapturedNumberIsSafeIntegerV1(nextCanonicalObjectBytes) ||
    currentRetainedObjectCount < 0 ||
    currentRetainedHistoryLogicalBytes < 0 ||
    nextCanonicalObjectBytes < 0
  ) {
    return "invalid_safe_integer";
  }
  if (
    nextCanonicalObjectBytes >
    PROVIDER_DISTRIBUTION_MAX_SINGLE_RETAINED_OBJECT_CANONICAL_BYTES_V1
  ) {
    return "single_object_byte_limit_exceeded";
  }
  if (
    currentRetainedObjectCount >=
    PROVIDER_DISTRIBUTION_MAX_TOTAL_RETAINED_OBJECT_COUNT_V1
  ) {
    return "retained_object_count_limit_exceeded";
  }
  if (
    currentRetainedHistoryLogicalBytes >
    PROVIDER_DISTRIBUTION_MAX_TOTAL_RETAINED_HISTORY_LOGICAL_BYTES_V1
  ) {
    return "retained_history_byte_limit_exceeded";
  }
  if (
    nextObjectKind === "envelope" &&
    nextCanonicalObjectBytes >
      PROVIDER_DISTRIBUTION_MAX_TOTAL_RETAINED_HISTORY_LOGICAL_BYTES_V1 -
        currentRetainedHistoryLogicalBytes
  ) {
    return "retained_history_byte_limit_exceeded";
  }
  return undefined;
}

export interface ProviderDistributionRetainedEnvelopeInputInternalV1 {
  readonly distributionRootBinding: object;
  readonly locator: object;
  readonly contentDigest: string;
  readonly envelope: object;
}

export interface ProviderDistributionRetainedEmbeddedBundleInputInternalV1 {
  readonly distributionRootBinding: object;
  readonly parentDiscoveryContentDigest: string;
  readonly bundleContentDigest: string;
  readonly bundle: object;
}

export interface ProviderDistributionRetainedAccountingSnapshotInternalV1 {
  readonly retainedObjectCount: number;
  readonly retainedEnvelopeCount: number;
  readonly retainedEmbeddedBundleCount: number;
  readonly retainedHistoryLogicalBytes: number;
}

export interface ProviderDistributionRetainedAdmissionInternalV1 {
  readonly outcome: "admitted" | "duplicate";
  readonly objectKind: ProviderDistributionRetainedObjectKindInternalV1;
  readonly canonicalObjectBytes: number;
  readonly incrementalRetainedHistoryLogicalBytes: number;
  readonly fullObjectFingerprint: `sha256:${string}`;
  readonly snapshot: ProviderDistributionRetainedAccountingSnapshotInternalV1;
}

export interface ProviderDistributionRetainedAccountingAccumulatorInternalV1 {
  readonly admitEnvelope: (
    input: ProviderDistributionRetainedEnvelopeInputInternalV1,
  ) => ProviderDistributionRetainedAdmissionInternalV1;
  readonly admitEmbeddedTargetDiscoveryInputBundle: (
    input: ProviderDistributionRetainedEmbeddedBundleInputInternalV1,
  ) => ProviderDistributionRetainedAdmissionInternalV1;
  readonly snapshot: () => ProviderDistributionRetainedAccountingSnapshotInternalV1;
}

interface EnvelopeOwnerInternalV1 {
  readonly contentDigest: string;
  readonly fullObjectFingerprint: `sha256:${string}`;
}

interface BundleOwnerInternalV1 {
  readonly fullObjectFingerprint: `sha256:${string}`;
}

function failV1(
  reason: ProviderDistributionRetainedAccountingFailureReasonInternalV1,
): never {
  throw new ProviderDistributionRetainedAccountingErrorInternalV1(reason);
}

function canonicalJsonStringV1(value: unknown): string {
  try {
    return canonicalizeJcsSafeIntegerV1(value);
  } catch {
    return failV1("object_invalid");
  }
}

function canonicalJsonBytesV1(value: unknown): Uint8Array {
  try {
    return canonicalizeJcsSafeIntegerUtf8V1(value);
  } catch {
    return failV1("object_invalid");
  }
}

function contentDigestV1(value: string): string {
  try {
    return ContentDigestV1Schema.parse(value);
  } catch {
    return failV1("object_invalid");
  }
}

function tupleKeyV1(parts: readonly string[]): string {
  let key = "";
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    key += `${part.length}:${part}`;
  }
  return key;
}

function bytesToLowerHexV1(bytes: Uint8Array): string {
  let output = "";
  const byteLength = typedArrayByteLengthV1(bytes);
  for (let index = 0; index < byteLength; index += 1) {
    const byte = bytes[index]!;
    output +=
      LOWER_HEX_ALPHABET_V1[(byte >>> 4) & 0x0f]! +
      LOWER_HEX_ALPHABET_V1[byte & 0x0f]!;
  }
  return output;
}

function fingerprintV1(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${bytesToLowerHexV1(sha256InternalV1(bytes))}`;
}

function snapshotV1(
  retainedObjectCount: number,
  retainedEnvelopeCount: number,
  retainedEmbeddedBundleCount: number,
  retainedHistoryLogicalBytes: number,
): ProviderDistributionRetainedAccountingSnapshotInternalV1 {
  return CapturedObjectFreezeV1({
    retainedObjectCount,
    retainedEnvelopeCount,
    retainedEmbeddedBundleCount,
    retainedHistoryLogicalBytes,
  });
}

function admissionV1(
  outcome: "admitted" | "duplicate",
  objectKind: ProviderDistributionRetainedObjectKindInternalV1,
  canonicalObjectBytes: number,
  incrementalRetainedHistoryLogicalBytes: number,
  fullObjectFingerprint: `sha256:${string}`,
  snapshot: ProviderDistributionRetainedAccountingSnapshotInternalV1,
): ProviderDistributionRetainedAdmissionInternalV1 {
  return CapturedObjectFreezeV1({
    outcome,
    objectKind,
    canonicalObjectBytes,
    incrementalRetainedHistoryLogicalBytes,
    fullObjectFingerprint,
    snapshot,
  });
}

export function createProviderDistributionRetainedAccountingAccumulatorInternalV1(): ProviderDistributionRetainedAccountingAccumulatorInternalV1 {
  /*
   * The Envelope owner map is keyed by canonical {binding, typed locator}; its
   * value retains the content digest and full canonical-envelope fingerprint.
   * Together they implement the exact normative
   * {binding, typed locator, contentDigest} key while also rejecting both forms
   * of locator collision before any accounting state changes.
   */
  const envelopeOwners = new CapturedMapV1<string, EnvelopeOwnerInternalV1>();
  const bundleOwners = new CapturedMapV1<string, BundleOwnerInternalV1>();
  let retainedObjectCount = 0;
  let retainedEnvelopeCount = 0;
  let retainedEmbeddedBundleCount = 0;
  let retainedHistoryLogicalBytes = 0;

  const currentSnapshotV1 =
    (): ProviderDistributionRetainedAccountingSnapshotInternalV1 =>
      snapshotV1(
        retainedObjectCount,
        retainedEnvelopeCount,
        retainedEmbeddedBundleCount,
        retainedHistoryLogicalBytes,
      );

  const assertNewObjectWithinLimitsV1 = (
    objectKind: ProviderDistributionRetainedObjectKindInternalV1,
    canonicalObjectBytes: number,
  ): void => {
    const reason =
      diagnoseProviderDistributionRetainedLimitTransitionInternalV1({
        currentRetainedObjectCount: retainedObjectCount,
        currentRetainedHistoryLogicalBytes: retainedHistoryLogicalBytes,
        nextObjectKind: objectKind,
        nextCanonicalObjectBytes: canonicalObjectBytes,
      });
    if (reason !== undefined) failV1(reason);
  };

  const admitEnvelope = (
    input: ProviderDistributionRetainedEnvelopeInputInternalV1,
  ): ProviderDistributionRetainedAdmissionInternalV1 => {
    const bindingKey = canonicalJsonStringV1(input.distributionRootBinding);
    const locatorKey = canonicalJsonStringV1(input.locator);
    const contentDigest = contentDigestV1(input.contentDigest);
    const canonicalBytes = canonicalJsonBytesV1(input.envelope);
    const canonicalObjectBytes = typedArrayByteLengthV1(canonicalBytes);
    const fullObjectFingerprint = fingerprintV1(canonicalBytes);
    const singleObjectFailure =
      canonicalObjectBytes >
      PROVIDER_DISTRIBUTION_MAX_SINGLE_RETAINED_OBJECT_CANONICAL_BYTES_V1;
    if (singleObjectFailure) failV1("single_object_byte_limit_exceeded");

    const locatorOwnerKey = tupleKeyV1([bindingKey, locatorKey]);
    const existingOwner = mapGetV1(envelopeOwners, locatorOwnerKey);
    if (existingOwner !== undefined) {
      if (
        existingOwner.contentDigest !== contentDigest ||
        existingOwner.fullObjectFingerprint !== fullObjectFingerprint
      ) {
        return failV1("locator_ownership_conflict");
      }
      return admissionV1(
        "duplicate",
        "envelope",
        canonicalObjectBytes,
        0,
        fullObjectFingerprint,
        currentSnapshotV1(),
      );
    }

    assertNewObjectWithinLimitsV1("envelope", canonicalObjectBytes);
    mapSetV1(
      envelopeOwners,
      locatorOwnerKey,
      CapturedObjectFreezeV1({ contentDigest, fullObjectFingerprint }),
    );
    retainedObjectCount += 1;
    retainedEnvelopeCount += 1;
    retainedHistoryLogicalBytes += canonicalObjectBytes;
    return admissionV1(
      "admitted",
      "envelope",
      canonicalObjectBytes,
      canonicalObjectBytes,
      fullObjectFingerprint,
      currentSnapshotV1(),
    );
  };

  const admitEmbeddedTargetDiscoveryInputBundle = (
    input: ProviderDistributionRetainedEmbeddedBundleInputInternalV1,
  ): ProviderDistributionRetainedAdmissionInternalV1 => {
    const bindingKey = canonicalJsonStringV1(input.distributionRootBinding);
    const parentDiscoveryContentDigest = contentDigestV1(
      input.parentDiscoveryContentDigest,
    );
    const bundleContentDigest = contentDigestV1(input.bundleContentDigest);
    const canonicalBytes = canonicalJsonBytesV1(input.bundle);
    const canonicalObjectBytes = typedArrayByteLengthV1(canonicalBytes);
    const fullObjectFingerprint = fingerprintV1(canonicalBytes);
    if (
      canonicalObjectBytes >
      PROVIDER_DISTRIBUTION_MAX_SINGLE_RETAINED_OBJECT_CANONICAL_BYTES_V1
    ) {
      failV1("single_object_byte_limit_exceeded");
    }

    const bundleKey = tupleKeyV1([
      bindingKey,
      parentDiscoveryContentDigest,
      bundleContentDigest,
    ]);
    const existingOwner = mapGetV1(bundleOwners, bundleKey);
    if (existingOwner !== undefined) {
      if (existingOwner.fullObjectFingerprint !== fullObjectFingerprint) {
        return failV1("retained_object_key_conflict");
      }
      return admissionV1(
        "duplicate",
        "embedded_target_discovery_input_bundle",
        canonicalObjectBytes,
        0,
        fullObjectFingerprint,
        currentSnapshotV1(),
      );
    }

    assertNewObjectWithinLimitsV1(
      "embedded_target_discovery_input_bundle",
      canonicalObjectBytes,
    );
    mapSetV1(
      bundleOwners,
      bundleKey,
      CapturedObjectFreezeV1({ fullObjectFingerprint }),
    );
    retainedObjectCount += 1;
    retainedEmbeddedBundleCount += 1;
    return admissionV1(
      "admitted",
      "embedded_target_discovery_input_bundle",
      canonicalObjectBytes,
      0,
      fullObjectFingerprint,
      currentSnapshotV1(),
    );
  };

  return CapturedObjectFreezeV1({
    admitEnvelope: CapturedObjectFreezeV1(admitEnvelope),
    admitEmbeddedTargetDiscoveryInputBundle: CapturedObjectFreezeV1(
      admitEmbeddedTargetDiscoveryInputBundle,
    ),
    snapshot: CapturedObjectFreezeV1(currentSnapshotV1),
  });
}

CapturedObjectFreezeV1(
  diagnoseProviderDistributionRetainedLimitTransitionInternalV1,
);
CapturedObjectFreezeV1(
  diagnoseProviderDistributionRetainedNormalCandidateInternalV1,
);
CapturedObjectFreezeV1(
  createProviderDistributionRetainedAccountingAccumulatorInternalV1,
);
CapturedObjectFreezeV1(
  isProviderDistributionRetainedAccountingErrorInternalV1,
);
