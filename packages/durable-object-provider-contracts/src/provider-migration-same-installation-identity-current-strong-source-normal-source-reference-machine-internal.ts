/**
 * Package-private D-41 current-strong-source reference streamer.
 *
 * The caller never supplies public ordinals, locator commitments, or edges.
 * One opaque capability owns one exact source stream/freeze cut; this machine
 * consumes it once, derives the complete public hash DAG, and returns no raw
 * locator, freeze token, Provider handle, or write authority.
 */

import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  CanonicalByteStringV1Schema,
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  type ContentDigestV1,
  type InstallationIdentityGenerationIdV1,
} from "./primitives.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectEntryReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectKindReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceEdgeReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema,
  checkedSumProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLogicalObjectBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalObjectSetBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalReferenceSetBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalRootSetBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalUniverseBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectSetDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSetDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootSetDigestReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectEntryReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectKindReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceEdgeReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSlotDescriptorReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootEntryReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  createProviderPointFulfilledPromiseV1,
  createProviderPointRejectedPromiseV1,
} from "./provider-point-runtime-internal.js";

const CapturedArrayPrototypePushV1 = Array.prototype.push;
const CapturedArrayPrototypeSortV1 = Array.prototype.sort;
const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedMapV1 = Map;
const CapturedMapPrototypeGetV1 = Map.prototype.get;
const CapturedMapPrototypeHasV1 = Map.prototype.has;
const CapturedMapPrototypeSetV1 = Map.prototype.set;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectPrototypeHasOwnPropertyV1 =
  Object.prototype.hasOwnProperty;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedSetV1 = Set;
const CapturedSetPrototypeAddV1 = Set.prototype.add;
const CapturedSetPrototypeHasV1 = Set.prototype.has;
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
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapPrototypeDeleteV1 = WeakMap.prototype.delete;
const CapturedWeakMapPrototypeGetV1 = WeakMap.prototype.get;
const CapturedWeakMapPrototypeHasV1 = WeakMap.prototype.has;
const CapturedWeakMapPrototypeSetV1 = WeakMap.prototype.set;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetPrototypeAddV1 = WeakSet.prototype.add;
const CapturedWeakSetPrototypeHasV1 = WeakSet.prototype.has;

if (CapturedTypedArrayByteLengthGetterCandidateV1 === undefined) {
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
const arraySortV1 = bindUncurriedAtBootstrapV1(
  CapturedArrayPrototypeSortV1,
) as <T>(array: T[], compare: (left: T, right: T) => number) => T[];
const hasOwnV1 = bindUncurriedAtBootstrapV1(
  CapturedObjectPrototypeHasOwnPropertyV1,
) as (value: object, key: PropertyKey) => boolean;
const mapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedMapPrototypeGetV1,
) as <K, V>(map: Map<K, V>, key: K) => V | undefined;
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
) as <T>(set: Set<T>, value: T) => boolean;
const typedArrayByteLengthV1 = bindUncurriedAtBootstrapV1(
  CapturedTypedArrayByteLengthGetterCandidateV1,
) as (value: Uint8Array) => number;
const weakMapDeleteV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeDeleteV1,
) as <K extends object>(map: WeakMap<K, unknown>, key: K) => boolean;
const weakMapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeGetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K) => V | undefined;
const weakMapHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeHasV1,
) as <K extends object>(map: WeakMap<K, unknown>, key: K) => boolean;
const weakMapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeSetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K, value: V) => void;
const weakSetAddV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetPrototypeAddV1,
) as <T extends object>(set: WeakSet<T>, value: T) => WeakSet<T>;
const weakSetHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetPrototypeHasV1,
) as <T extends object>(set: WeakSet<T>, value: T) => boolean;

const MAX_SOURCE_OBJECTS_INTERNAL_V1 = 1_000_000;
const MAX_SOURCE_REFERENCES_INTERNAL_V1 = 4_000_000;
const EXACT_SOURCE_ROOT_COUNT_INTERNAL_V1 = 6;
const STREAM_RECORD_KIND_KEYS_INTERNAL_V1 = CapturedObjectFreezeV1([
  "recordKind",
] as const);
const STREAM_ROOT_RECORD_KEYS_INTERNAL_V1 = CapturedObjectFreezeV1([
  "recordKind",
  "root",
] as const);
const STREAM_OBJECT_RECORD_KEYS_INTERNAL_V1 = CapturedObjectFreezeV1([
  "contentDigest",
  "locatorNamespace",
  "logicalBytes",
  "objectKind",
  "privateLocator",
  "providerBindingReferenceDigest",
  "recordKind",
] as const);
const REFERENCE_SLOT_KEYS_INTERNAL_V1 = CapturedObjectFreezeV1([
  "occurrenceOrdinal",
  "referenceSlotReferenceDigest",
  "schemaFieldPath",
  "targetPrivateLocator",
] as const);
const SOURCE_ROOT_KIND_KEYS_INTERNAL_V1 = CapturedObjectFreezeV1([
  "rootKind",
] as const);
const STORE_MANIFEST_COMPLETE_ROOT_KEYS_INTERNAL_V1 = CapturedObjectFreezeV1([
  "current",
  "rootKind",
] as const);
const QUOTA_INDEX_ROOT_KEYS_INTERNAL_V1 = CapturedObjectFreezeV1([
  "currentQuotaIndexRootContentDigest",
  "rootKind",
  "transitionHead",
] as const);
const ARTIFACT_HISTORY_ROOT_KEYS_INTERNAL_V1 = CapturedObjectFreezeV1([
  "rootCount",
  "rootKind",
  "rootSetDigest",
] as const);
const INITIALIZATION_TERMINAL_ROOT_KEYS_INTERNAL_V1 = CapturedObjectFreezeV1([
  "rootKind",
  "terminalHeadReferenceDigest",
] as const);
const RECEIPT_LEDGER_ROOT_KEYS_INTERNAL_V1 = CapturedObjectFreezeV1([
  "providerId",
  "providerPolicyDigest",
  "receiptCount",
  "receiptLogicalBytes",
  "receiptSetDigest",
  "rootKind",
] as const);
const ACTIVE_RECOVERY_ROOT_KEYS_INTERNAL_V1 = CapturedObjectFreezeV1([
  "activeTransactionCount",
  "controlUniverseDigest",
  "rootKind",
] as const);
const TRANSITION_HEAD_STATE_KEYS_INTERNAL_V1 = CapturedObjectFreezeV1([
  "state",
] as const);
const TRANSITION_HEAD_RECORD_KEYS_INTERNAL_V1 = CapturedObjectFreezeV1([
  "contentDigest",
  "recordReferenceDigest",
  "state",
] as const);
const STORE_MANIFEST_CUT_KEYS_INTERNAL_V1 = CapturedObjectFreezeV1([
  "currentGeneration",
  "currentVersionReferenceDigest",
  "cutContentDigest",
  "generationCount",
  "generationSetDigest",
  "headContentDigest",
  "namespace",
  "namespaceRevision",
  "profile",
  "providerBinding",
] as const);
const NAMESPACE_KEYS_INTERNAL_V1 = CapturedObjectFreezeV1([
  "installationIdentityGenerationId",
  "repositoryId",
  "worktreeId",
] as const);
const PROVIDER_BINDING_KEYS_INTERNAL_V1 = CapturedObjectFreezeV1([
  "bindingDerivationKeyGeneration",
  "bindingReferenceDigest",
  "providerFeasibilityEvidence",
  "providerId",
  "registryEntryContentDigest",
  "runtimeAttestationContentDigest",
  "semanticProviderPolicyDigest",
  "targetProfileId",
] as const);
const PROVIDER_FEASIBILITY_EVIDENCE_KEYS_INTERNAL_V1 =
  CapturedObjectFreezeV1([
    "contentDigest",
    "evidenceId",
    "locatorProfile",
  ] as const);
const CURRENT_GENERATION_KEYS_INTERNAL_V1 = CapturedObjectFreezeV1([
  "contentDigest",
  "generationOrdinal",
  "generationReferenceId",
] as const);

type SlotPathV1 =
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSlotDescriptorReferenceCandidateV1["schemaFieldPath"];

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1 {
  readonly privateLocatorIdentity: unique symbol;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceRootStreamRecordInternalV1 {
  readonly recordKind: "root";
  readonly root: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceObjectStreamRecordInternalV1 {
  readonly recordKind: "object";
  readonly objectKind: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectKindReferenceCandidateV1;
  readonly locatorNamespace:
    | "store"
    | "provider_isolated_store_manifest_receipt_ledger";
  readonly privateLocator: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1;
  readonly contentDigest: ContentDigestV1;
  readonly logicalBytes: number;
  readonly providerBindingReferenceDigest: ContentDigestV1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamRecordInternalV1 =
  | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceRootStreamRecordInternalV1
  | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceObjectStreamRecordInternalV1;

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventInternalV1 =
  | Readonly<{
      readonly state: "record";
      readonly record: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamRecordInternalV1;
    }>
  | Readonly<{ readonly state: "eof" }>;

declare const providerMigrationSourceStreamEventMintCapabilityBrandV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventMintCapabilityInternalV1 {
  readonly [providerMigrationSourceStreamEventMintCapabilityBrandV1]: true;
}

declare const providerMigrationSourceStreamEventCapabilityBrandV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventCapabilityInternalV1 {
  readonly [providerMigrationSourceStreamEventCapabilityBrandV1]: true;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLocatorCommitmentPairInternalV1 {
  readonly logicalLocatorReferenceDigest: ContentDigestV1;
  readonly semanticLocatorDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalReferenceSlotInternalV1 {
  readonly schemaFieldPath: SlotPathV1;
  readonly occurrenceOrdinal: number;
  readonly referenceSlotReferenceDigest: ContentDigestV1;
  readonly targetPrivateLocator: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1 {
  readonly openSourceFreeze: () => Readonly<{
    readonly freezeToken: object;
    readonly sourceFreezeStateReferenceDigest: ContentDigestV1;
  }>;
  readonly readNext: (
    freezeToken: object,
    eventMintCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventMintCapabilityInternalV1,
  ) => ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventCapabilityInternalV1;
  readonly deriveLocatorCommitment: (
    freezeToken: object,
    liveReferenceSchemaDigest: ContentDigestV1,
    locator: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1,
  ) => ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLocatorCommitmentPairInternalV1;
  readonly enumerateReferenceSlots: (
    freezeToken: object,
    liveReferenceSchemaDigest: ContentDigestV1,
    source: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamRecordInternalV1,
  ) => readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalReferenceSlotInternalV1[];
  readonly observeSourceContinuity: (
    freezeToken: object,
  ) => Readonly<{
    readonly sourceFreezeStateReferenceDigest: ContentDigestV1;
  }>;
}

declare const providerMigrationSourceReferenceMachineCapabilityBrandV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineCapabilityInternalV1 {
  readonly [providerMigrationSourceReferenceMachineCapabilityBrandV1]: true;
}

declare const providerMigrationPostSourceContinuityHandleBrandV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityHandleInternalV1 {
  readonly [providerMigrationPostSourceContinuityHandleBrandV1]: true;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadResultInternalV1 {
  readonly completeSourceReadClosure: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1;
  readonly continuityHandle: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityHandleInternalV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityObservationInternalV1 {
  readonly sourceFreezeStateReferenceDigest: ContentDigestV1;
}

export interface MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineInternalV1Input {
  readonly cohortIdentity: object;
  readonly sourceInstallationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly sourceTrustClosureContentDigest: ContentDigestV1;
  readonly sourceStoreManifest: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1;
  readonly verifiedLiveReferenceSchemaDigest: ContentDigestV1;
  readonly streamHost: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineStageInternalV1 =
  | "capability"
  | "stream_open"
  | "source_stream"
  | "locator_derivation"
  | "reference_slot_enumeration"
  | "continuity"
  | "source_closure";

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineReasonInternalV1 =
  | "capability_invalid"
  | "source_invalid"
  | "continuity_changed";

const sourceMachineErrorsInternalV1 = new CapturedWeakSetV1<object>();

export class ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1
  extends CapturedTypeErrorV1 {
  readonly stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineStageInternalV1;
  readonly reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineReasonInternalV1;

  constructor(
    stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineStageInternalV1,
    reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineReasonInternalV1,
  ) {
    super("provider migration source reference operation failed");
    this.name =
      "ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1";
    this.stage = stage;
    this.reason = reason;
    weakSetAddV1(sourceMachineErrorsInternalV1, this);
    CapturedObjectFreezeV1(this);
  }
}

export function isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1(
  value: unknown,
): value is ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1 {
  return isObjectIdentityV1(value) &&
    weakSetHasV1(sourceMachineErrorsInternalV1, value);
}

interface SourceReferenceMachineContextInternalV1 {
  readonly cohortIdentity: object;
  readonly sourceInstallationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly sourceTrustClosureContentDigest: ContentDigestV1;
  readonly sourceStoreManifest: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1;
  readonly verifiedLiveReferenceSchemaDigest: ContentDigestV1;
  readonly openSourceFreeze:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1["openSourceFreeze"];
  readonly readNext:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1["readNext"];
  readonly deriveLocatorCommitment:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1["deriveLocatorCommitment"];
  readonly enumerateReferenceSlots:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1["enumerateReferenceSlots"];
  readonly observeSourceContinuity:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1["observeSourceContinuity"];
}

interface RootRowInternalV1 {
  readonly source: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceRootStreamRecordInternalV1;
  readonly root: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1;
  readonly sortKey: Uint8Array;
}

interface ObjectRowInternalV1 {
  readonly source: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceObjectStreamRecordInternalV1;
  readonly locator: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1;
  readonly entryWithoutOrdinal: Omit<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectEntryReferenceCandidateV1,
    "objectOrdinal"
  >;
  readonly sortKey: Uint8Array;
}

interface EdgeRowInternalV1 {
  readonly edgeWithoutOrdinal: Omit<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceEdgeReferenceCandidateV1,
    "edgeOrdinal"
  >;
  readonly sortKey: Uint8Array;
}

interface CapturedReferenceSlotInternalV1 {
  readonly schemaFieldPath: SlotPathV1;
  readonly occurrenceOrdinal: number;
  readonly referenceSlotReferenceDigest: ContentDigestV1;
  readonly targetPrivateLocator: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1;
}

interface PostSourceContinuityContextInternalV1 {
  readonly freezeToken: object;
  readonly expectedSourceFreezeStateReferenceDigest: ContentDigestV1;
  readonly observeSourceContinuity:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1["observeSourceContinuity"];
}

interface SourceStreamEventMintBindingInternalV1 {
  readonly machine: SourceReferenceMachineContextInternalV1;
  readonly cohortIdentity: object;
  readonly freezeToken: object;
  readonly sequence: number;
}

interface SourceStreamEventBindingInternalV1
  extends SourceStreamEventMintBindingInternalV1 {
  readonly event: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventInternalV1;
  readonly privateLocator:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1
    | undefined;
}

const sourceMachineContextsInternalV1 = new CapturedWeakMapV1<
  object,
  SourceReferenceMachineContextInternalV1
>();
const postSourceContinuityContextsInternalV1 = new CapturedWeakMapV1<
  object,
  PostSourceContinuityContextInternalV1
>();
const sourceStreamEventMintBindingsInternalV1 = new CapturedWeakMapV1<
  object,
  SourceStreamEventMintBindingInternalV1
>();
const sourceStreamEventBindingsInternalV1 = new CapturedWeakMapV1<
  object,
  SourceStreamEventBindingInternalV1
>();

function isObjectIdentityV1(value: unknown): value is object {
  return value !== null &&
    (typeof value === "object" || typeof value === "function");
}

function rejectSourceV1(
  stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineStageInternalV1,
  reason:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineReasonInternalV1 =
      "source_invalid",
): never {
  throw new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1(
    stage,
    reason,
  );
}

function captureKnownDataFieldsV1(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (!isObjectIdentityV1(value)) return undefined;
  const fields = CapturedObjectCreateV1(null) as Record<string, unknown>;
  for (let index = 0; index < expectedKeys.length; index += 1) {
    const key = expectedKeys[index]!;
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(value, key);
    if (
      descriptor === undefined ||
      !hasOwnV1(descriptor, "value") ||
      descriptor.enumerable !== true
    ) {
      return undefined;
    }
    fields[key] = descriptor.value;
  }
  return CapturedObjectFreezeV1(fields);
}

function captureStableKnownDataFieldsV1(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  const preliminary = captureKnownDataFieldsV1(value, expectedKeys);
  const captured = captureKnownDataFieldsV1(value, expectedKeys);
  if (preliminary === undefined || captured === undefined) return undefined;
  for (let index = 0; index < expectedKeys.length; index += 1) {
    const key = expectedKeys[index]!;
    if (preliminary[key] !== captured[key]) return undefined;
  }
  return captured;
}

function createFrozenKnownDataRecordV1<T extends object>(
  entries: readonly (readonly [string, unknown])[],
): T {
  const record = CapturedObjectCreateV1(null) as Record<string, unknown>;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    record[entry[0]] = entry[1];
  }
  return CapturedObjectFreezeV1(record) as T;
}

function readOwnDataPropertyValueV1(
  value: object,
  key: string,
  expectedEnumerable: boolean,
): unknown {
  const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(value, key);
  if (
    descriptor === undefined ||
    !hasOwnV1(descriptor, "value") ||
    descriptor.enumerable !== expectedEnumerable
  ) {
    return rejectSourceV1("reference_slot_enumeration");
  }
  return descriptor.value;
}

function captureStableReferenceSlotV1(
  value: unknown,
): CapturedReferenceSlotInternalV1 {
  const preliminary = captureKnownDataFieldsV1(
    value,
    REFERENCE_SLOT_KEYS_INTERNAL_V1,
  );
  if (preliminary === undefined) {
    return rejectSourceV1("reference_slot_enumeration");
  }
  const captured = captureKnownDataFieldsV1(
    value,
    REFERENCE_SLOT_KEYS_INTERNAL_V1,
  );
  if (captured === undefined) {
    return rejectSourceV1("reference_slot_enumeration");
  }
  const occurrenceOrdinal = captured.occurrenceOrdinal;
  const referenceSlotReferenceDigest = captured.referenceSlotReferenceDigest;
  const schemaFieldPath = captured.schemaFieldPath;
  const targetPrivateLocator = captured.targetPrivateLocator;
  if (
    occurrenceOrdinal !== preliminary.occurrenceOrdinal ||
    referenceSlotReferenceDigest !==
      preliminary.referenceSlotReferenceDigest ||
    schemaFieldPath !== preliminary.schemaFieldPath ||
    targetPrivateLocator !== preliminary.targetPrivateLocator
  ) {
    return rejectSourceV1("reference_slot_enumeration");
  }
  const parsedPath = CanonicalByteStringV1Schema.safeParse(schemaFieldPath);
  const parsedDigest = ContentDigestV1Schema.safeParse(
    referenceSlotReferenceDigest,
  );
  if (
    !CapturedNumberIsSafeIntegerV1(occurrenceOrdinal) ||
    (occurrenceOrdinal as number) < 0 ||
    !parsedPath.success ||
    !parsedDigest.success ||
    !isObjectIdentityV1(targetPrivateLocator)
  ) {
    return rejectSourceV1("reference_slot_enumeration");
  }
  return CapturedObjectFreezeV1({
    occurrenceOrdinal: occurrenceOrdinal as number,
    referenceSlotReferenceDigest: parsedDigest.data,
    schemaFieldPath: parsedPath.data as SlotPathV1,
    targetPrivateLocator:
      targetPrivateLocator as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1,
  });
}

function captureStableReferenceSlotsV1(
  value: unknown,
  maximumLength: number,
): readonly CapturedReferenceSlotInternalV1[] {
  if (
    !CapturedArrayIsArrayV1(value)
  ) {
    return rejectSourceV1("reference_slot_enumeration");
  }
  const preliminaryLength = readOwnDataPropertyValueV1(
    value,
    "length",
    false,
  );
  if (
    !CapturedNumberIsSafeIntegerV1(preliminaryLength) ||
    (preliminaryLength as number) < 0 ||
    (preliminaryLength as number) > maximumLength
  ) {
    return rejectSourceV1("reference_slot_enumeration");
  }
  const length = preliminaryLength as number;

  const capturedLength = readOwnDataPropertyValueV1(
    value,
    "length",
    false,
  );
  if (capturedLength !== length) {
    return rejectSourceV1("reference_slot_enumeration");
  }

  const rawSlots: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    arrayPushV1(
      rawSlots,
      readOwnDataPropertyValueV1(value, `${index}`, true),
    );
  }
  CapturedObjectFreezeV1(rawSlots);

  const snapshot: CapturedReferenceSlotInternalV1[] = [];
  for (let index = 0; index < length; index += 1) {
    arrayPushV1(snapshot, captureStableReferenceSlotV1(rawSlots[index]));
  }

  // Verify that the host did not replace an indexed slot while its nested
  // descriptor snapshot was being captured. Mutations during or after this
  // check cannot affect the detached scalars or retained opaque target identity.
  for (let index = 0; index < length; index += 1) {
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
      value,
      `${index}`,
    );
    if (
      descriptor === undefined ||
      !hasOwnV1(descriptor, "value") ||
      descriptor.enumerable !== true ||
      descriptor.value !== rawSlots[index]
    ) {
      return rejectSourceV1("reference_slot_enumeration");
    }
  }
  return CapturedObjectFreezeV1(snapshot);
}

function compareBytesV1(left: Uint8Array, right: Uint8Array): number {
  const leftLength = typedArrayByteLengthV1(left);
  const rightLength = typedArrayByteLengthV1(right);
  const length = leftLength < rightLength ? leftLength : rightLength;
  for (let index = 0; index < length; index += 1) {
    const difference = left[index]! - right[index]!;
    if (difference !== 0) return difference;
  }
  return leftLength - rightLength;
}

function canonicalBytesV1(value: unknown): Uint8Array {
  return canonicalizeJcsSafeIntegerUtf8V1(value);
}

function canonicalBytesKeyV1(value: unknown): string {
  const bytes = canonicalBytesV1(value);
  const byteLength = typedArrayByteLengthV1(bytes);
  let key = "";
  for (let index = 0; index < byteLength; index += 1) {
    key += `${bytes[index]!},`;
  }
  return key;
}

function parseContentDigestV1(value: unknown): ContentDigestV1 {
  const parsed = ContentDigestV1Schema.safeParse(value);
  if (!parsed.success) rejectSourceV1("source_stream");
  return parsed.data;
}

function requireStableKnownDataFieldsV1(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> {
  const fields = captureStableKnownDataFieldsV1(value, expectedKeys);
  if (fields === undefined) return rejectSourceV1("source_stream");
  return fields;
}

function snapshotStoreManifestCutV1(
  value: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1 {
  const fields = requireStableKnownDataFieldsV1(
    value,
    STORE_MANIFEST_CUT_KEYS_INTERNAL_V1,
  );
  const namespaceFields = requireStableKnownDataFieldsV1(
    fields.namespace,
    NAMESPACE_KEYS_INTERNAL_V1,
  );
  const namespace = createFrozenKnownDataRecordV1<Record<string, unknown>>([
    ["installationIdentityGenerationId", namespaceFields.installationIdentityGenerationId],
    ["repositoryId", namespaceFields.repositoryId],
    ["worktreeId", namespaceFields.worktreeId],
  ]);
  const bindingFields = requireStableKnownDataFieldsV1(
    fields.providerBinding,
    PROVIDER_BINDING_KEYS_INTERNAL_V1,
  );
  const evidenceFields = requireStableKnownDataFieldsV1(
    bindingFields.providerFeasibilityEvidence,
    PROVIDER_FEASIBILITY_EVIDENCE_KEYS_INTERNAL_V1,
  );
  const providerFeasibilityEvidence =
    createFrozenKnownDataRecordV1<Record<string, unknown>>([
      ["locatorProfile", evidenceFields.locatorProfile],
      ["evidenceId", evidenceFields.evidenceId],
      ["contentDigest", evidenceFields.contentDigest],
    ]);
  const providerBinding = createFrozenKnownDataRecordV1<Record<string, unknown>>([
    ["targetProfileId", bindingFields.targetProfileId],
    ["providerId", bindingFields.providerId],
    ["registryEntryContentDigest", bindingFields.registryEntryContentDigest],
    ["semanticProviderPolicyDigest", bindingFields.semanticProviderPolicyDigest],
    ["providerFeasibilityEvidence", providerFeasibilityEvidence],
    ["runtimeAttestationContentDigest", bindingFields.runtimeAttestationContentDigest],
    ["bindingDerivationKeyGeneration", bindingFields.bindingDerivationKeyGeneration],
    ["bindingReferenceDigest", bindingFields.bindingReferenceDigest],
  ]);
  const generationFields = requireStableKnownDataFieldsV1(
    fields.currentGeneration,
    CURRENT_GENERATION_KEYS_INTERNAL_V1,
  );
  const currentGeneration =
    createFrozenKnownDataRecordV1<Record<string, unknown>>([
      ["generationOrdinal", generationFields.generationOrdinal],
      ["generationReferenceId", generationFields.generationReferenceId],
      ["contentDigest", generationFields.contentDigest],
    ]);
  const candidate = createFrozenKnownDataRecordV1<Record<string, unknown>>([
    ["profile", fields.profile],
    ["namespace", namespace],
    ["providerBinding", providerBinding],
    ["namespaceRevision", fields.namespaceRevision],
    ["headContentDigest", fields.headContentDigest],
    ["currentVersionReferenceDigest", fields.currentVersionReferenceDigest],
    ["generationCount", fields.generationCount],
    ["generationSetDigest", fields.generationSetDigest],
    ["currentGeneration", currentGeneration],
    ["cutContentDigest", fields.cutContentDigest],
  ]);
  const parsed =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema.safeParse(
      candidate,
    );
  if (!parsed.success) return rejectSourceV1("source_stream");
  return deepFreezeProviderPointDetachedDataTreeV1(parsed.data);
}

function snapshotTransitionHeadV1(value: unknown): object {
  const stateFields = requireStableKnownDataFieldsV1(
    value,
    TRANSITION_HEAD_STATE_KEYS_INTERNAL_V1,
  );
  if (stateFields.state === "genesis") {
    return createFrozenKnownDataRecordV1([["state", "genesis"]]);
  }
  if (stateFields.state !== "transition") {
    return rejectSourceV1("source_stream");
  }
  const fields = requireStableKnownDataFieldsV1(
    value,
    TRANSITION_HEAD_RECORD_KEYS_INTERNAL_V1,
  );
  if (fields.state !== stateFields.state) {
    return rejectSourceV1("source_stream");
  }
  return createFrozenKnownDataRecordV1([
    ["state", "transition"],
    ["recordReferenceDigest", fields.recordReferenceDigest],
    ["contentDigest", fields.contentDigest],
  ]);
}

function snapshotLiveRootV1(
  value: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1 {
  const kindFields = requireStableKnownDataFieldsV1(
    value,
    SOURCE_ROOT_KIND_KEYS_INTERNAL_V1,
  );
  let candidate: object;
  switch (kindFields.rootKind) {
    case "store_manifest_complete_set": {
      const fields = requireStableKnownDataFieldsV1(
        value,
        STORE_MANIFEST_COMPLETE_ROOT_KEYS_INTERNAL_V1,
      );
      if (fields.rootKind !== kindFields.rootKind) {
        return rejectSourceV1("source_stream");
      }
      candidate = createFrozenKnownDataRecordV1([
        ["rootKind", kindFields.rootKind],
        ["current", snapshotStoreManifestCutV1(fields.current)],
      ]);
      break;
    }
    case "quota_index_and_transition_chain": {
      const fields = requireStableKnownDataFieldsV1(
        value,
        QUOTA_INDEX_ROOT_KEYS_INTERNAL_V1,
      );
      if (fields.rootKind !== kindFields.rootKind) {
        return rejectSourceV1("source_stream");
      }
      candidate = createFrozenKnownDataRecordV1([
        ["rootKind", kindFields.rootKind],
        ["currentQuotaIndexRootContentDigest", fields.currentQuotaIndexRootContentDigest],
        ["transitionHead", snapshotTransitionHeadV1(fields.transitionHead)],
      ]);
      break;
    }
    case "artifact_descriptor_history_closure": {
      const fields = requireStableKnownDataFieldsV1(
        value,
        ARTIFACT_HISTORY_ROOT_KEYS_INTERNAL_V1,
      );
      if (fields.rootKind !== kindFields.rootKind) {
        return rejectSourceV1("source_stream");
      }
      candidate = createFrozenKnownDataRecordV1([
        ["rootKind", kindFields.rootKind],
        ["rootCount", fields.rootCount],
        ["rootSetDigest", fields.rootSetDigest],
      ]);
      break;
    }
    case "initialization_terminal": {
      const fields = requireStableKnownDataFieldsV1(
        value,
        INITIALIZATION_TERMINAL_ROOT_KEYS_INTERNAL_V1,
      );
      if (fields.rootKind !== kindFields.rootKind) {
        return rejectSourceV1("source_stream");
      }
      candidate = createFrozenKnownDataRecordV1([
        ["rootKind", kindFields.rootKind],
        ["terminalHeadReferenceDigest", fields.terminalHeadReferenceDigest],
      ]);
      break;
    }
    case "store_manifest_compare_append_receipt_ledger": {
      const fields = requireStableKnownDataFieldsV1(
        value,
        RECEIPT_LEDGER_ROOT_KEYS_INTERNAL_V1,
      );
      if (fields.rootKind !== kindFields.rootKind) {
        return rejectSourceV1("source_stream");
      }
      candidate = createFrozenKnownDataRecordV1([
        ["rootKind", kindFields.rootKind],
        ["providerId", fields.providerId],
        ["providerPolicyDigest", fields.providerPolicyDigest],
        ["receiptCount", fields.receiptCount],
        ["receiptSetDigest", fields.receiptSetDigest],
        ["receiptLogicalBytes", fields.receiptLogicalBytes],
      ]);
      break;
    }
    case "active_recovery_control": {
      const fields = requireStableKnownDataFieldsV1(
        value,
        ACTIVE_RECOVERY_ROOT_KEYS_INTERNAL_V1,
      );
      if (fields.rootKind !== kindFields.rootKind) {
        return rejectSourceV1("source_stream");
      }
      candidate = createFrozenKnownDataRecordV1([
        ["rootKind", kindFields.rootKind],
        ["activeTransactionCount", fields.activeTransactionCount],
        ["controlUniverseDigest", fields.controlUniverseDigest],
      ]);
      break;
    }
    default:
      return rejectSourceV1("source_stream");
  }
  const parsed =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1Schema.safeParse(
      candidate,
    );
  if (!parsed.success) return rejectSourceV1("source_stream");
  return deepFreezeProviderPointDetachedDataTreeV1(parsed.data);
}

function snapshotSourceStreamRecordV1(
  value: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamRecordInternalV1 {
  const kindFields = requireStableKnownDataFieldsV1(
    value,
    STREAM_RECORD_KIND_KEYS_INTERNAL_V1,
  );
  if (kindFields.recordKind === "root") {
    const fields = requireStableKnownDataFieldsV1(
      value,
      STREAM_ROOT_RECORD_KEYS_INTERNAL_V1,
    );
    if (fields.recordKind !== kindFields.recordKind) {
      return rejectSourceV1("source_stream");
    }
    return CapturedObjectFreezeV1({
      recordKind: "root" as const,
      root: snapshotLiveRootV1(fields.root),
    });
  }
  if (kindFields.recordKind !== "object") {
    return rejectSourceV1("source_stream");
  }
  const fields = requireStableKnownDataFieldsV1(
    value,
    STREAM_OBJECT_RECORD_KEYS_INTERNAL_V1,
  );
  const objectKind =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectKindReferenceCandidateV1Schema.safeParse(
      fields.objectKind,
    );
  const contentDigest = ContentDigestV1Schema.safeParse(fields.contentDigest);
  const providerBindingReferenceDigest = ContentDigestV1Schema.safeParse(
    fields.providerBindingReferenceDigest,
  );
  if (
    fields.recordKind !== kindFields.recordKind ||
    !objectKind.success ||
    (fields.locatorNamespace !== "store" &&
      fields.locatorNamespace !==
        "provider_isolated_store_manifest_receipt_ledger") ||
    !isObjectIdentityV1(fields.privateLocator) ||
    !contentDigest.success ||
    !CapturedNumberIsSafeIntegerV1(fields.logicalBytes) ||
    (fields.logicalBytes as number) < 0 ||
    !providerBindingReferenceDigest.success
  ) {
    return rejectSourceV1("source_stream");
  }
  return CapturedObjectFreezeV1({
    recordKind: "object" as const,
    objectKind: objectKind.data,
    locatorNamespace: fields.locatorNamespace,
    privateLocator:
      fields.privateLocator as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1,
    contentDigest: contentDigest.data,
    logicalBytes: fields.logicalBytes as number,
    providerBindingReferenceDigest: providerBindingReferenceDigest.data,
  });
}

function takeSourceStreamEventMintBindingV1(
  capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventMintCapabilityInternalV1,
): SourceStreamEventMintBindingInternalV1 {
  if (!isObjectIdentityV1(capability)) {
    return rejectSourceV1("source_stream");
  }
  const binding = weakMapGetV1(
    sourceStreamEventMintBindingsInternalV1,
    capability,
  );
  if (
    binding === undefined ||
    !weakMapDeleteV1(sourceStreamEventMintBindingsInternalV1, capability)
  ) {
    return rejectSourceV1("source_stream");
  }
  return binding;
}

function bindSourceStreamEventV1(
  binding: SourceStreamEventMintBindingInternalV1,
  event: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventInternalV1,
  privateLocator:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1
    | undefined,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventCapabilityInternalV1 {
  const capability = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventCapabilityInternalV1;
  weakMapSetV1(
    sourceStreamEventBindingsInternalV1,
    capability,
    CapturedObjectFreezeV1({
      ...binding,
      event,
      privateLocator,
    }),
  );
  return capability;
}

/** Trusted host adapter: snapshot one record without enumerating host keys. */
export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamRecordEventCapabilityInternalV1(
  eventMintCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventMintCapabilityInternalV1,
  record: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventCapabilityInternalV1 {
  const binding = takeSourceStreamEventMintBindingV1(eventMintCapability);
  const stableRecord = snapshotSourceStreamRecordV1(record);
  const privateLocator = stableRecord.recordKind === "object"
    ? stableRecord.privateLocator
    : undefined;
  return bindSourceStreamEventV1(
    binding,
    CapturedObjectFreezeV1({
      state: "record" as const,
      record: stableRecord,
    }),
    privateLocator,
  );
}

/** Trusted host adapter: mint the sequence-bound EOF marker. */
export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceEofStreamEventCapabilityInternalV1(
  eventMintCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventMintCapabilityInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventCapabilityInternalV1 {
  const binding = takeSourceStreamEventMintBindingV1(eventMintCapability);
  return bindSourceStreamEventV1(
    binding,
    CapturedObjectFreezeV1({ state: "eof" as const }),
    undefined,
  );
}

function createSourceStreamEventMintCapabilityV1(
  machine: SourceReferenceMachineContextInternalV1,
  freezeToken: object,
  sequence: number,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventMintCapabilityInternalV1 {
  const capability = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventMintCapabilityInternalV1;
  weakMapSetV1(
    sourceStreamEventMintBindingsInternalV1,
    capability,
    CapturedObjectFreezeV1({
      machine,
      cohortIdentity: machine.cohortIdentity,
      freezeToken,
      sequence,
    }),
  );
  return capability;
}

function takeSourceStreamEventCapabilityV1(
  capability: unknown,
  machine: SourceReferenceMachineContextInternalV1,
  freezeToken: object,
  sequence: number,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventInternalV1 {
  if (!isObjectIdentityV1(capability)) {
    return rejectSourceV1("source_stream");
  }
  const binding = weakMapGetV1(sourceStreamEventBindingsInternalV1, capability);
  if (
    binding === undefined ||
    binding.machine !== machine ||
    binding.cohortIdentity !== machine.cohortIdentity ||
    binding.freezeToken !== freezeToken ||
    binding.sequence !== sequence
  ) {
    return rejectSourceV1("source_stream");
  }
  if (
    !weakMapDeleteV1(sourceStreamEventBindingsInternalV1, capability)
  ) {
    return rejectSourceV1("source_stream");
  }
  if (
    binding.event.state === "record" &&
    binding.event.record.recordKind === "object"
  ) {
    if (binding.privateLocator !== binding.event.record.privateLocator) {
      return rejectSourceV1("source_stream");
    }
  } else if (binding.privateLocator !== undefined) {
    return rejectSourceV1("source_stream");
  }
  return binding.event;
}

/** Mint one zero-own-key source-stream capability and capture host methods. */
export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineInternalV1(
  input: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineCapabilityInternalV1 {
  const fields = captureKnownDataFieldsV1(input, [
    "cohortIdentity",
    "sourceInstallationIdentityGenerationId",
    "sourceStoreManifest",
    "sourceTrustClosureContentDigest",
    "streamHost",
    "verifiedLiveReferenceSchemaDigest",
  ]);
  const hostFields = captureKnownDataFieldsV1(fields?.streamHost, [
    "deriveLocatorCommitment",
    "enumerateReferenceSlots",
    "observeSourceContinuity",
    "openSourceFreeze",
    "readNext",
  ]);
  if (fields === undefined || hostFields === undefined) {
    return rejectSourceV1("capability", "capability_invalid");
  }
  const installationIdentity = InstallationIdentityGenerationIdV1Schema.safeParse(
    fields.sourceInstallationIdentityGenerationId,
  );
  const trustDigest = ContentDigestV1Schema.safeParse(
    fields.sourceTrustClosureContentDigest,
  );
  const schemaDigest = ContentDigestV1Schema.safeParse(
    fields.verifiedLiveReferenceSchemaDigest,
  );
  const manifest =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema.safeParse(
      fields.sourceStoreManifest,
    );
  if (
    !installationIdentity.success ||
    !trustDigest.success ||
    !schemaDigest.success ||
    !manifest.success ||
    !isObjectIdentityV1(fields.cohortIdentity) ||
    manifest.data.namespace.installationIdentityGenerationId !==
      installationIdentity.data ||
    typeof hostFields.openSourceFreeze !== "function" ||
    typeof hostFields.readNext !== "function" ||
    typeof hostFields.deriveLocatorCommitment !== "function" ||
    typeof hostFields.enumerateReferenceSlots !== "function" ||
    typeof hostFields.observeSourceContinuity !== "function"
  ) {
    return rejectSourceV1("capability", "capability_invalid");
  }
  const capability = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineCapabilityInternalV1;
  const context: SourceReferenceMachineContextInternalV1 =
    CapturedObjectFreezeV1({
      cohortIdentity: fields.cohortIdentity,
      sourceInstallationIdentityGenerationId: installationIdentity.data,
      sourceTrustClosureContentDigest: trustDigest.data,
      sourceStoreManifest: deepFreezeProviderPointDetachedDataTreeV1(
        manifest.data,
      ),
      verifiedLiveReferenceSchemaDigest: schemaDigest.data,
      openSourceFreeze: hostFields.openSourceFreeze,
      readNext: hostFields.readNext,
      deriveLocatorCommitment: hostFields.deriveLocatorCommitment,
      enumerateReferenceSlots: hostFields.enumerateReferenceSlots,
      observeSourceContinuity: hostFields.observeSourceContinuity,
    } as SourceReferenceMachineContextInternalV1);
  weakMapSetV1(sourceMachineContextsInternalV1, capability, context);
  return capability;
}

/**
 * Synchronously prove the opaque machine belongs to the expected private
 * cohort and source Installation Identity before any source read. A mismatch
 * preserves the owner capability and never reveals the retained cohort value.
 */
export function assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineBindingInternalV1(
  capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineCapabilityInternalV1,
  expectedCohortIdentity: object,
  expectedInstallationIdentityGenerationId: InstallationIdentityGenerationIdV1,
): void {
  if (!isObjectIdentityV1(capability)) {
    return rejectSourceV1("capability", "capability_invalid");
  }
  const context = weakMapGetV1(sourceMachineContextsInternalV1, capability);
  if (
    context === undefined ||
    !isObjectIdentityV1(expectedCohortIdentity) ||
    context.cohortIdentity !== expectedCohortIdentity ||
    context.sourceInstallationIdentityGenerationId !==
      expectedInstallationIdentityGenerationId
  ) {
    return rejectSourceV1("capability", "capability_invalid");
  }
}

function takeSourceContextV1(
  capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineCapabilityInternalV1,
): SourceReferenceMachineContextInternalV1 {
  if (
    !isObjectIdentityV1(capability) ||
    !weakMapHasV1(sourceMachineContextsInternalV1, capability)
  ) {
    return rejectSourceV1("capability", "capability_invalid");
  }
  const context = weakMapGetV1(sourceMachineContextsInternalV1, capability);
  if (
    context === undefined ||
    !weakMapDeleteV1(sourceMachineContextsInternalV1, capability)
  ) {
    return rejectSourceV1("capability", "capability_invalid");
  }
  return context;
}

function parseLocatorPairV1(
  value: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLocatorCommitmentPairInternalV1 {
  const fields = captureKnownDataFieldsV1(value, [
    "logicalLocatorReferenceDigest",
    "semanticLocatorDigest",
  ]);
  if (fields === undefined) rejectSourceV1("locator_derivation");
  const logical = ContentDigestV1Schema.safeParse(
    fields.logicalLocatorReferenceDigest,
  );
  const semantic = ContentDigestV1Schema.safeParse(fields.semanticLocatorDigest);
  if (!logical.success || !semantic.success) {
    rejectSourceV1("locator_derivation");
  }
  return CapturedObjectFreezeV1({
    logicalLocatorReferenceDigest: logical.data,
    semanticLocatorDigest: semantic.data,
  });
}

function readSourceInternalV1(
  capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineCapabilityInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadResultInternalV1 {
  const context = takeSourceContextV1(capability);
  let freezeToken: object;
  let freezeDigest: ContentDigestV1;
  try {
    const opened = captureKnownDataFieldsV1(context.openSourceFreeze(), [
      "freezeToken",
      "sourceFreezeStateReferenceDigest",
    ]);
    if (opened === undefined || !isObjectIdentityV1(opened.freezeToken)) {
      return rejectSourceV1("stream_open");
    }
    freezeToken = opened.freezeToken;
    freezeDigest = parseContentDigestV1(
      opened.sourceFreezeStateReferenceDigest,
    );
  } catch (error) {
    if (
      isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1(
        error,
      )
    ) {
      throw error;
    }
    return rejectSourceV1("stream_open");
  }

  const roots: RootRowInternalV1[] = [];
  const objects: ObjectRowInternalV1[] = [];
  const locatorRows = new CapturedMapV1<object, ObjectRowInternalV1>();
  const semanticBindingTuples = new CapturedSetV1<string>();
  let eofCount = 0;
  let streamSequence = 0;
  try {
    for (;;) {
      const eventMintCapability = createSourceStreamEventMintCapabilityV1(
        context,
        freezeToken,
        streamSequence,
      );
      let eventCapability:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventCapabilityInternalV1;
      try {
        eventCapability = context.readNext(
          freezeToken,
          eventMintCapability,
        );
      } finally {
        weakMapDeleteV1(
          sourceStreamEventMintBindingsInternalV1,
          eventMintCapability,
        );
      }
      // Burn and authenticate the nominal event synchronously before any
      // locator, slot, continuity, or other host call can observe it.
      const event = takeSourceStreamEventCapabilityV1(
        eventCapability,
        context,
        freezeToken,
        streamSequence,
      );
      streamSequence += 1;
      if (event.state === "eof") {
        eofCount += 1;
        break;
      }
      const record = event.record;
      if (record.recordKind === "root") {
        if (roots.length >= EXACT_SOURCE_ROOT_COUNT_INTERNAL_V1) {
          return rejectSourceV1("source_stream");
        }
        const parsed =
          ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1Schema.safeParse(
            record.root,
          );
        if (!parsed.success) return rejectSourceV1("source_stream");
        const root = deepFreezeProviderPointDetachedDataTreeV1(parsed.data);
        arrayPushV1(roots, CapturedObjectFreezeV1({
          source: record,
          root,
          sortKey: canonicalBytesV1({ root }),
        }));
        continue;
      }
      if (
        record.recordKind !== "object" ||
        !isObjectIdentityV1(record.privateLocator) ||
        objects.length >= MAX_SOURCE_OBJECTS_INTERNAL_V1 ||
        mapHasV1(locatorRows, record.privateLocator)
      ) {
        return rejectSourceV1("source_stream");
      }
      const pair = parseLocatorPairV1(
        context.deriveLocatorCommitment(
          freezeToken,
          context.verifiedLiveReferenceSchemaDigest,
          record.privateLocator,
        ),
      );
      const parsedEntry =
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectEntryReferenceCandidateV1Schema.safeParse(
          {
            objectOrdinal: 0,
            objectKind: record.objectKind,
            locatorNamespace: record.locatorNamespace,
            logicalLocatorReferenceDigest:
              pair.logicalLocatorReferenceDigest,
            semanticLocatorDigest: pair.semanticLocatorDigest,
            contentDigest: record.contentDigest,
            logicalBytes: record.logicalBytes,
            providerBindingReferenceDigest:
              record.providerBindingReferenceDigest,
          },
        );
      if (!parsedEntry.success) return rejectSourceV1("source_stream");
      const { objectOrdinal: _ordinal, ...entryWithoutOrdinal } =
        parsedEntry.data;
      if (
        entryWithoutOrdinal.providerBindingReferenceDigest !==
          context.sourceStoreManifest.providerBinding.bindingReferenceDigest
      ) {
        return rejectSourceV1("source_stream");
      }
      const tuple = `${entryWithoutOrdinal.semanticLocatorDigest}\u0000${entryWithoutOrdinal.providerBindingReferenceDigest}`;
      if (setHasV1(semanticBindingTuples, tuple)) {
        return rejectSourceV1("locator_derivation");
      }
      setAddV1(semanticBindingTuples, tuple);
      const row: ObjectRowInternalV1 = CapturedObjectFreezeV1({
        source: record,
        locator: record.privateLocator,
        entryWithoutOrdinal: deepFreezeProviderPointDetachedDataTreeV1(
          entryWithoutOrdinal,
        ),
        sortKey: canonicalBytesV1(entryWithoutOrdinal),
      });
      mapSetV1(locatorRows, record.privateLocator, row);
      arrayPushV1(objects, row);
    }
  } catch (error) {
    if (
      isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1(
        error,
      )
    ) {
      throw error;
    }
    return rejectSourceV1("source_stream");
  }
  if (
    eofCount !== 1 ||
    roots.length !== EXACT_SOURCE_ROOT_COUNT_INTERNAL_V1 ||
    objects.length < 1
  ) {
    return rejectSourceV1("source_stream");
  }

  arraySortV1(roots, (left, right) => compareBytesV1(left.sortKey, right.sortKey));
  arraySortV1(objects, (left, right) => compareBytesV1(left.sortKey, right.sortKey));
  for (let index = 1; index < roots.length; index += 1) {
    if (compareBytesV1(roots[index - 1]!.sortKey, roots[index]!.sortKey) >= 0) {
      return rejectSourceV1("source_closure");
    }
  }
  for (let index = 1; index < objects.length; index += 1) {
    if (compareBytesV1(objects[index - 1]!.sortKey, objects[index]!.sortKey) >= 0) {
      return rejectSourceV1("source_closure");
    }
  }
  const publicRoots: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootEntryReferenceCandidateV1[] = [];
  const publicObjects: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectEntryReferenceCandidateV1[] = [];
  const rootOrdinalBySource = new CapturedMapV1<object, number>();
  const objectOrdinalBySource = new CapturedMapV1<object, number>();
  const objectOrdinalByLocator = new CapturedMapV1<object, number>();
  for (let index = 0; index < roots.length; index += 1) {
    const row = roots[index]!;
    mapSetV1(rootOrdinalBySource, row.source, index);
    arrayPushV1(publicRoots, CapturedObjectFreezeV1({
      rootOrdinal: index,
      root: row.root,
    }));
  }
  for (let index = 0; index < objects.length; index += 1) {
    const row = objects[index]!;
    mapSetV1(objectOrdinalBySource, row.source, index);
    mapSetV1(objectOrdinalByLocator, row.locator, index);
    arrayPushV1(publicObjects, CapturedObjectFreezeV1({
      objectOrdinal: index,
      ...row.entryWithoutOrdinal,
    }));
  }
  CapturedObjectFreezeV1(publicRoots);
  CapturedObjectFreezeV1(publicObjects);

  const edgeRows: EdgeRowInternalV1[] = [];
  const slotKeys = new CapturedSetV1<string>();
  function enumerateSourceV1(
    source: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamRecordInternalV1,
    capturedRoot:
      | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1
      | undefined,
    capturedObject:
      | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectEntryReferenceCandidateV1
      | undefined,
  ): void {
    let slots: readonly CapturedReferenceSlotInternalV1[];
    try {
      slots = captureStableReferenceSlotsV1(
        context.enumerateReferenceSlots(
          freezeToken,
          context.verifiedLiveReferenceSchemaDigest,
          source,
        ),
        MAX_SOURCE_REFERENCES_INTERNAL_V1 - edgeRows.length,
      );
    } catch (error) {
      if (
        isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1(
          error,
        )
      ) {
        throw error;
      }
      return rejectSourceV1("reference_slot_enumeration");
    }
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
      const slot = slots[slotIndex]!;
      const targetOrdinal = mapGetV1(
        objectOrdinalByLocator,
        slot.targetPrivateLocator,
      );
      if (targetOrdinal === undefined) {
        return rejectSourceV1("reference_slot_enumeration");
      }
      let from: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceEdgeReferenceCandidateV1["from"];
      let descriptor: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSlotDescriptorReferenceCandidateV1;
      if (source.recordKind === "root") {
        const ordinal = mapGetV1(rootOrdinalBySource, source);
        if (ordinal === undefined || capturedRoot === undefined) {
          return rejectSourceV1("reference_slot_enumeration");
        }
        from = { sourceKind: "root", rootOrdinal: ordinal };
        descriptor = {
          sourceKind: "root",
          rootKind: capturedRoot.rootKind,
          schemaFieldPath: slot.schemaFieldPath,
          occurrenceOrdinal: slot.occurrenceOrdinal,
        };
      } else {
        const ordinal = mapGetV1(objectOrdinalBySource, source);
        if (ordinal === undefined || capturedObject === undefined) {
          return rejectSourceV1("reference_slot_enumeration");
        }
        from = {
          sourceKind: "object",
          objectOrdinal: ordinal,
          objectContentDigest: capturedObject.contentDigest,
        };
        descriptor = {
          sourceKind: "object",
          objectKind: capturedObject.objectKind,
          schemaFieldPath: slot.schemaFieldPath,
          occurrenceOrdinal: slot.occurrenceOrdinal,
        };
      }
      const provisional = {
        edgeOrdinal: 0,
        from,
        referenceSlotReferenceDigest: slot.referenceSlotReferenceDigest,
        referenceSlotDescriptor: descriptor,
        toObjectOrdinal: targetOrdinal,
      };
      const parsed =
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceEdgeReferenceCandidateV1Schema.safeParse(
          provisional,
        );
      if (!parsed.success) {
        return rejectSourceV1("reference_slot_enumeration");
      }
      const { edgeOrdinal: _edgeOrdinal, ...edgeWithoutOrdinal } = parsed.data;
      const slotKeyString = canonicalBytesKeyV1([from, descriptor]);
      if (setHasV1(slotKeys, slotKeyString)) {
        return rejectSourceV1("reference_slot_enumeration");
      }
      setAddV1(slotKeys, slotKeyString);
      arrayPushV1(edgeRows, CapturedObjectFreezeV1({
        edgeWithoutOrdinal,
        sortKey: canonicalBytesV1(edgeWithoutOrdinal),
      }));
    }
  }
  for (let index = 0; index < roots.length; index += 1) {
    enumerateSourceV1(roots[index]!.source, roots[index]!.root, undefined);
  }
  for (let index = 0; index < objects.length; index += 1) {
    enumerateSourceV1(
      objects[index]!.source,
      undefined,
      publicObjects[index],
    );
  }
  arraySortV1(edgeRows, (left, right) =>
    compareBytesV1(left.sortKey, right.sortKey));
  for (let index = 1; index < edgeRows.length; index += 1) {
    if (
      compareBytesV1(edgeRows[index - 1]!.sortKey, edgeRows[index]!.sortKey) >= 0
    ) {
      return rejectSourceV1("reference_slot_enumeration");
    }
  }
  const publicReferences: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceEdgeReferenceCandidateV1[] = [];
  for (let index = 0; index < edgeRows.length; index += 1) {
    arrayPushV1(publicReferences, CapturedObjectFreezeV1({
      edgeOrdinal: index,
      ...edgeRows[index]!.edgeWithoutOrdinal,
    }));
  }
  CapturedObjectFreezeV1(publicReferences);

  try {
    const post = captureKnownDataFieldsV1(
      context.observeSourceContinuity(freezeToken),
      ["sourceFreezeStateReferenceDigest"],
    );
    if (
      post === undefined ||
      ContentDigestV1Schema.safeParse(post.sourceFreezeStateReferenceDigest)
        .data !== freezeDigest
    ) {
      return rejectSourceV1("continuity", "continuity_changed");
    }
  } catch (error) {
    if (
      isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1(
        error,
      )
    ) {
      throw error;
    }
    return rejectSourceV1("continuity", "continuity_changed");
  }

  try {
    const unsigned = {
      profile:
        "provider_migration_same_installation_identity_current_strong_source_normal_complete_source_read_closure_reference_candidate_v1" as const,
      sourceInstallationIdentityGenerationId:
        context.sourceInstallationIdentityGenerationId,
      sourceTrustClosureContentDigest: context.sourceTrustClosureContentDigest,
      sourceStoreManifest: context.sourceStoreManifest,
      sourceFreezeStateReferenceDigest: freezeDigest,
      liveReferenceSchemaDigest: context.verifiedLiveReferenceSchemaDigest,
      roots: publicRoots,
      objects: publicObjects,
      references: publicReferences,
      rootCount: publicRoots.length,
      rootSetDigest:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootSetDigestReferenceCandidateV1(
          { entries: publicRoots },
        ),
      canonicalRootSetBytes:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalRootSetBytesReferenceCandidateV1(
          { entries: publicRoots },
        ),
      objectCount: publicObjects.length,
      objectSetDigest:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectSetDigestReferenceCandidateV1(
          { entries: publicObjects },
        ),
      canonicalObjectSetBytes:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalObjectSetBytesReferenceCandidateV1(
          { entries: publicObjects },
        ),
      logicalObjectBytesTotal:
        checkedSumProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLogicalObjectBytesReferenceCandidateV1(
          publicObjects,
        ),
      referenceCount: publicReferences.length,
      referenceSetDigest:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSetDigestReferenceCandidateV1(
          { entries: publicReferences },
        ),
      canonicalReferenceSetBytes:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalReferenceSetBytesReferenceCandidateV1(
          { entries: publicReferences },
        ),
      canonicalUniverseBytes:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalUniverseBytesReferenceCandidateV1(
          {
            roots: publicRoots,
            objects: publicObjects,
            references: publicReferences,
          },
        ),
      activeTransactions: [] as [],
    };
    const candidate = {
      ...unsigned,
      completeReadClosureContentDigest:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureContentDigestReferenceCandidateV1(
          unsigned,
        ),
    };
    const completeSourceReadClosure =
      deepFreezeProviderPointDetachedDataTreeV1(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1Schema.parse(
        candidate,
      ),
    );
    const continuityHandle = CapturedObjectFreezeV1(
      CapturedObjectCreateV1(null),
    ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityHandleInternalV1;
    weakMapSetV1(
      postSourceContinuityContextsInternalV1,
      continuityHandle,
      CapturedObjectFreezeV1({
        freezeToken,
        expectedSourceFreezeStateReferenceDigest: freezeDigest,
        observeSourceContinuity: context.observeSourceContinuity,
      }),
    );
    return createFrozenKnownDataRecordV1<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadResultInternalV1>([
      ["completeSourceReadClosure", completeSourceReadClosure],
      ["continuityHandle", continuityHandle],
    ]);
  } catch (error) {
    if (
      isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1(
        error,
      )
    ) {
      throw error;
    }
    return rejectSourceV1("source_closure");
  }
}

/** Consume the capability synchronously before the first host call. */
export function readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
  capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineCapabilityInternalV1,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadResultInternalV1> {
  try {
    return createProviderPointFulfilledPromiseV1(
      readSourceInternalV1(capability),
    );
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }
}

function capturePostSourceContinuityInternalV1(
  input: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityObservationInternalV1 {
  const fields = captureKnownDataFieldsV1(input, ["continuityHandle"]);
  const continuityHandle = fields?.continuityHandle;
  if (!isObjectIdentityV1(continuityHandle)) {
    return rejectSourceV1("continuity", "capability_invalid");
  }
  const context = weakMapGetV1(
    postSourceContinuityContextsInternalV1,
    continuityHandle,
  );
  if (
    context === undefined ||
    !weakMapDeleteV1(
      postSourceContinuityContextsInternalV1,
      continuityHandle,
    )
  ) {
    return rejectSourceV1("continuity", "capability_invalid");
  }
  try {
    const post = captureKnownDataFieldsV1(
      context.observeSourceContinuity(context.freezeToken),
      ["sourceFreezeStateReferenceDigest"],
    );
    const digest = ContentDigestV1Schema.safeParse(
      post?.sourceFreezeStateReferenceDigest,
    );
    if (
      post === undefined ||
      !digest.success ||
      digest.data !== context.expectedSourceFreezeStateReferenceDigest
    ) {
      return rejectSourceV1("continuity", "continuity_changed");
    }
    return createFrozenKnownDataRecordV1<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityObservationInternalV1>([
      ["sourceFreezeStateReferenceDigest", digest.data],
    ]);
  } catch (error) {
    if (
      isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1(
        error,
      )
    ) {
      throw error;
    }
    return rejectSourceV1("continuity", "continuity_changed");
  }
}

/**
 * Burn the exact post-source handle before the first observation call. This
 * second observation is intended to run only after Plan/quota computation.
 */
export function captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityInternalV1(
  input: Readonly<{
    readonly continuityHandle: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityHandleInternalV1;
  }>,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityObservationInternalV1> {
  try {
    return createProviderPointFulfilledPromiseV1(
      capturePostSourceContinuityInternalV1(input),
    );
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }
}

CapturedObjectFreezeV1(
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineInternalV1,
);
CapturedObjectFreezeV1(
  assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineBindingInternalV1,
);
CapturedObjectFreezeV1(
  readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1,
);
CapturedObjectFreezeV1(
  captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityInternalV1,
);
CapturedObjectFreezeV1(
  isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1,
);
