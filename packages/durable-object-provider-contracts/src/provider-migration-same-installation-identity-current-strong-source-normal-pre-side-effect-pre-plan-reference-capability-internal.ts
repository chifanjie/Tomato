/**
 * Package-private D-41 pre-plan capability and diagnostic orchestrator.
 *
 * This module is deliberately absent from the package export map.  One mint
 * binds every read-only machine and observer to one private cohort; the public
 * operation can later expose only the single zero-key capability.  No writer,
 * formal migration identifier, prepared Manifest, or durable quota authority
 * is retained here.
 */

import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  type ContentDigestV1,
} from "./primitives.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanEnvelopeReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanPayloadReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalClosureContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationIdReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationIdReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrePostObservationEqualityContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestContentDigestReferenceCandidateV1,
  validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalObservationReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanEnvelopeReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectBoundaryReferenceCandidateV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";
import {
  isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticErrorInternalV1,
  prepareProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationHostInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationPreparedSourceCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalVerifiedEndpointProjectionInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-endpoint-trust-capability-internal.js";
import {
  assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineBindingInternalV1,
  captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityInternalV1,
  isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineInternalV1,
  readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-source-reference-machine-internal.js";
import {
  assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1,
  captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1,
  captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostQuotaContinuityInternalV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionInternalV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunAndHistoryQuotaSizingInternalV1,
  isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCaptureInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostQuotaContinuityInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-history-quota-reference-machine-internal.js";
import {
  bindProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationToFinalCandidateInternalV1,
  discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-continuation-internal.js";
import {
  bindProviderRegistryPreparedSuccessorSeedToCohortInternalV1,
  discardProviderRegistryPreparedSuccessorCohortInternalV1,
  discardProviderRegistryPreparedSuccessorSeedInternalV1,
  type ProviderRegistryPreparedSuccessorCohortCapabilityInternalV1,
  type ProviderRegistryPreparedSuccessorSeedInternalV1,
} from "./provider-registry-history-prepared-internal.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";

const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 = Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapPrototypeDeleteV1 = WeakMap.prototype.delete;
const CapturedWeakMapPrototypeGetV1 = WeakMap.prototype.get;
const CapturedWeakMapPrototypeSetV1 = WeakMap.prototype.set;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetPrototypeAddV1 = WeakSet.prototype.add;
const CapturedWeakSetPrototypeHasV1 = WeakSet.prototype.has;
const CapturedTypedArrayPrototypeV1 = CapturedObjectGetPrototypeOfV1(
  CapturedUint8ArrayV1.prototype,
);
const CapturedTypedArrayByteLengthGetterCandidateV1 =
  CapturedObjectGetOwnPropertyDescriptorV1(
    CapturedTypedArrayPrototypeV1,
    "byteLength",
  )?.get;

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

const weakMapDeleteV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeDeleteV1,
) as <K extends object>(map: WeakMap<K, unknown>, key: K) => boolean;
const weakMapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeGetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K) => V | undefined;
const weakMapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeSetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K, value: V) => WeakMap<K, V>;
const weakSetAddV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetPrototypeAddV1,
) as <T extends object>(set: WeakSet<T>, value: T) => WeakSet<T>;
const weakSetHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetPrototypeHasV1,
) as <T extends object>(set: WeakSet<T>, value: T) => boolean;
const typedArrayByteLengthV1 = bindUncurriedAtBootstrapV1(
  CapturedTypedArrayByteLengthGetterCandidateV1,
) as (value: Uint8Array) => number;

const REQUEST_KEYS_V1 = CapturedObjectFreezeV1([
  "admissionClass",
  "createdAt",
  "liveReferenceSchemaDigest",
  "migrationBudgets",
  "migrationProtocolDigest",
  "mode",
  "profile",
  "reason",
] as const);
const MIGRATION_BUDGET_KEYS_V1 = CapturedObjectFreezeV1([
  "profile",
  "maxRootEntries",
  "maxLiveObjects",
  "maxReferenceEdges",
  "maxRewriteObjects",
  "maxRewriteReferenceMappings",
  "maxRewriteSccs",
  "maxLogicalObjectBytesTotal",
  "maxProgressRecords",
  "maxProgressOperationReceipts",
  "maxCanonicalUniverseBytes",
  "maxCanonicalReferenceSetBytes",
  "maxCanonicalRewritePlanBytes",
  "maxCanonicalRewrittenReferenceSetBytesTotal",
  "maxCanonicalSemanticEquivalenceProofBytesTotal",
  "maxCanonicalRootRewriteProofSetBytes",
  "maxCanonicalZeroLiveProofBytes",
  "maxCanonicalReceiptBytesTotal",
  "maxCanonicalProgressRecordSetBytes",
  "maxCanonicalProgressOperationReceiptBytesTotal",
  "maxCanonicalMigrationBytesTotal",
  "maxRetainedMigrationHistoryLogicalBytesTotal",
  "maxRetainedMigrationHistoryProviderAllocatedBytesTotal",
  "maxSingleRecordBytes",
] as const);
const MINT_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "acceptanceClosureIdentity",
  "endpointObservationHost",
  "prospectiveDestinationPreparedSourceCapability",
  "quotaObservationHost",
  "request",
  "sideEffectAuditObserver",
  "sourceStreamHost",
  "verifiedLiveReferenceSchemaDigest",
  "verifiedMigrationProtocolDigest",
] as const);
const ENDPOINT_OBSERVATION_KEYS_V1 = CapturedObjectFreezeV1([
  "destinationNamespaceObservationDigest",
  "destinationTrustClosureContentDigest",
  "sourceStoreCutContentDigest",
  "sourceTrustClosureContentDigest",
] as const);
const AUDIT_OBSERVER_KEYS_V1 = CapturedObjectFreezeV1([
  "observeSideEffectSinks",
] as const);
const AUDIT_SINK_KEYS_V1 = CapturedObjectFreezeV1([
  "acceptanceAppends",
  "destinationObjectAllocations",
  "emergencyReserveConsumptions",
  "operationReceiptWrites",
  "pendingIntents",
  "planPublications",
  "progressAppends",
  "quotaConsumptions",
  "reservationWrites",
] as const);
const AUDIT_SINK_STATE_KEYS_V1 = CapturedObjectFreezeV1([
  "contentDigest",
  "count",
  "revision",
] as const);
const MAX_PLAN_ENVELOPE_BYTES_V1 = 4_194_304;

export type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationInternalV1,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalVerifiedEndpointProjectionInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-endpoint-trust-capability-internal.js";

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectSinkStateInternalV1 {
  readonly revision: number;
  readonly count: number;
  readonly contentDigest: ContentDigestV1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditSnapshotInternalV1 = Readonly<
  Record<
    (typeof AUDIT_SINK_KEYS_V1)[number],
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectSinkStateInternalV1
  >
>;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditObserverInternalV1 {
  readonly observeSideEffectSinks: () => unknown;
}

export interface MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityInternalV1Input {
  readonly acceptanceClosureIdentity: object;
  readonly endpointObservationHost:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationHostInternalV1;
  readonly prospectiveDestinationPreparedSourceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationPreparedSourceCapabilityInternalV1;
  readonly verifiedLiveReferenceSchemaDigest: ContentDigestV1;
  readonly verifiedMigrationProtocolDigest: ContentDigestV1;
  readonly sourceStreamHost: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1;
  readonly quotaObservationHost: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1;
  readonly request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1;
  readonly sideEffectAuditObserver: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditObserverInternalV1;
}

declare const providerMigrationPrePlanReferenceCapabilityBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityV1 {
  readonly [providerMigrationPrePlanReferenceCapabilityBrandInternalV1]: true;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBoundBuildInputInternalV1 {
  readonly request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1;
  readonly prePlanReferenceCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectReadyBuildInputInternalV1 {
  readonly prePlanReferenceCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityV1;
  readonly request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1;
  readonly buildInput: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBoundBuildInputInternalV1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticStageInternalV1 =
  | "input"
  | "pre_plan_reference_capability"
  | "pre_observation"
  | "current_strong_source"
  | "prospective_destination_evidence"
  | "endpoint_trust"
  | "migration_budgets"
  | "source_complete_stream"
  | "source_dry_run_cut"
  | "history_quota_sizing"
  | "quota_reference_snapshot"
  | "history_quota_admission"
  | "migration_identity"
  | "reservation_descriptor"
  | "plan_candidate"
  | "plan_envelope_actual_size"
  | "post_observation"
  | "side_effect_boundary";

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticReasonInternalV1 =
  | "schema_invalid"
  | "capability_invalid"
  | "source_invalid"
  | "snapshot_changed"
  | "trust_closure_invalid"
  | "source_not_current_strong_writer"
  | "destination_evidence_invalid"
  | "destination_already_selected"
  | "mode_relationship_invalid"
  | "source_cut_incomplete"
  | "budget_exceeded"
  | "quota_ledger_integrity_failed"
  | "quota_capacity_exhausted"
  | "candidate_invalid"
  | "side_effect_detected";

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticResultInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticStageInternalV1;
      readonly reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticReasonInternalV1;
    }>;

interface PrePlanCapabilityContextInternalV1 {
  readonly cohortIdentity: object;
  readonly verifiedLiveReferenceSchemaDigest: ContentDigestV1;
  readonly verifiedMigrationProtocolDigest: ContentDigestV1;
  readonly verifiedEndpointProjection: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalVerifiedEndpointProjectionInternalV1;
  readonly captureEndpointObservation: (
    phase: "pre" | "post",
  ) => Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationInternalV1>;
  readonly observeSideEffectSinks: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditObserverInternalV1["observeSideEffectSinks"];
  readonly preAuditSnapshot: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditSnapshotInternalV1;
  readonly sourceMachineCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineCapabilityInternalV1;
  readonly quotaMachineCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1;
  readonly preparedRegistrySuccessorCohortCapability:
    ProviderRegistryPreparedSuccessorCohortCapabilityInternalV1;
}

interface ClaimedBuildInputInternalV1 {
  readonly request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1;
  readonly capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityV1;
}

const prePlanCapabilityContextsInternalV1 = new CapturedWeakMapV1<
  object,
  PrePlanCapabilityContextInternalV1
>();
const readyBuildInputsInternalV1 = new CapturedWeakMapV1<
  object,
  ClaimedBuildInputInternalV1
>();
const diagnosticSignalsInternalV1 = new CapturedWeakSetV1<object>();

class DiagnosticSignalInternalV1 extends CapturedTypeErrorV1 {
  readonly stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticStageInternalV1;
  readonly reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticReasonInternalV1;

  constructor(
    stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticStageInternalV1,
    reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticReasonInternalV1,
  ) {
    super("provider migration pre-plan reference operation failed");
    this.name = "ProviderMigrationPrePlanReferenceDiagnosticSignalInternalV1";
    this.stage = stage;
    this.reason = reason;
    weakSetAddV1(diagnosticSignalsInternalV1, this);
    CapturedObjectFreezeV1(this);
  }
}

function failV1(
  stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticStageInternalV1,
  reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticReasonInternalV1,
): never {
  throw new DiagnosticSignalInternalV1(stage, reason);
}

function isDiagnosticSignalV1(value: unknown): value is DiagnosticSignalInternalV1 {
  return isObjectIdentityV1(value) && weakSetHasV1(diagnosticSignalsInternalV1, value);
}

function isObjectIdentityV1(value: unknown): value is object {
  return value !== null &&
    (typeof value === "object" || typeof value === "function");
}

/** Internal transport admission: read only named own-data slots. */
function readKnownOwnDataFieldsV1(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (!isObjectIdentityV1(value)) return undefined;
  const output = CapturedObjectCreateV1(null) as Record<string, unknown>;
  for (let index = 0; index < expectedKeys.length; index += 1) {
    const key = expectedKeys[index]!;
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(value, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      return undefined;
    }
    output[key] = descriptor.value;
  }
  return CapturedObjectFreezeV1(output);
}

function materializeRequestAfterAuditV1(
  value: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1 {
  const fields = readKnownOwnDataFieldsV1(value, REQUEST_KEYS_V1);
  if (fields === undefined) return failV1("input", "schema_invalid");
  const budgetFields = readKnownOwnDataFieldsV1(
    fields.migrationBudgets,
    MIGRATION_BUDGET_KEYS_V1,
  );
  if (budgetFields === undefined) return failV1("input", "schema_invalid");

  const rawBudgets = CapturedObjectCreateV1(null) as Record<string, unknown>;
  for (let index = 0; index < MIGRATION_BUDGET_KEYS_V1.length; index += 1) {
    const key = MIGRATION_BUDGET_KEYS_V1[index]!;
    rawBudgets[key] = budgetFields[key];
  }
  const parsedBudgets =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema.safeParse(
      CapturedObjectFreezeV1(rawBudgets),
    );
  if (!parsedBudgets.success) return failV1("input", "schema_invalid");
  const detachedBudgets = deepFreezeProviderPointDetachedDataTreeV1(
    parsedBudgets.data,
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1;

  const rawRequest = CapturedObjectCreateV1(null) as Record<string, unknown>;
  for (let index = 0; index < REQUEST_KEYS_V1.length; index += 1) {
    const key = REQUEST_KEYS_V1[index]!;
    rawRequest[key] = key === "migrationBudgets"
      ? detachedBudgets
      : fields[key];
  }
  const parsedRequest =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1Schema.safeParse(
      CapturedObjectFreezeV1(rawRequest),
    );
  if (!parsedRequest.success) return failV1("input", "schema_invalid");
  return deepFreezeProviderPointDetachedDataTreeV1(
    parsedRequest.data,
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1;
}

function takeReadyBuildInputV1(input: unknown): ClaimedBuildInputInternalV1 {
  if (!isObjectIdentityV1(input)) return failV1("input", "schema_invalid");
  const claimed = weakMapGetV1(readyBuildInputsInternalV1, input);
  if (
    claimed === undefined ||
    !weakMapDeleteV1(readyBuildInputsInternalV1, input)
  ) {
    return failV1("input", "schema_invalid");
  }
  return claimed;
}

function takeReadyBuildInputAndPrePlanContextV1(input: unknown): Readonly<{
  claimed: ClaimedBuildInputInternalV1;
  context: PrePlanCapabilityContextInternalV1;
  continuationIntent:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1 | undefined;
}> {
  const claimed = takeReadyBuildInputV1(input);
  // The registered public input and its capability context are consumed as
  // one synchronous claim.  No await, reflection, schema traversal, or host
  // callback occurs between these two WeakMap deletes.
  const context = takePrePlanContextV1(claimed.capability);
  const continuationIntent =
    takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1(
      claimed.capability,
    );
  return CapturedObjectFreezeV1({ claimed, context, continuationIntent });
}

function parseEndpointObservationV1(
  value: unknown,
  stage: "pre_observation" | "post_observation",
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationInternalV1 {
  const fields = readKnownOwnDataFieldsV1(value, ENDPOINT_OBSERVATION_KEYS_V1);
  if (fields === undefined) return failV1(stage, "snapshot_changed");
  const sourceStore = ContentDigestV1Schema.safeParse(fields.sourceStoreCutContentDigest);
  const sourceTrust = ContentDigestV1Schema.safeParse(fields.sourceTrustClosureContentDigest);
  const destinationTrust = ContentDigestV1Schema.safeParse(fields.destinationTrustClosureContentDigest);
  const destinationNamespace = ContentDigestV1Schema.safeParse(fields.destinationNamespaceObservationDigest);
  if (!sourceStore.success || !sourceTrust.success || !destinationTrust.success || !destinationNamespace.success) {
    return failV1(stage, "snapshot_changed");
  }
  return CapturedObjectFreezeV1({
    sourceStoreCutContentDigest: sourceStore.data,
    sourceTrustClosureContentDigest: sourceTrust.data,
    destinationTrustClosureContentDigest: destinationTrust.data,
    destinationNamespaceObservationDigest: destinationNamespace.data,
  });
}

function parseAuditSnapshotV1(
  value: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditSnapshotInternalV1 {
  const fields = readKnownOwnDataFieldsV1(value, AUDIT_SINK_KEYS_V1);
  if (fields === undefined) return failV1("side_effect_boundary", "side_effect_detected");
  const output = CapturedObjectCreateV1(null) as Record<
    string,
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectSinkStateInternalV1
  >;
  for (let index = 0; index < AUDIT_SINK_KEYS_V1.length; index += 1) {
    const key = AUDIT_SINK_KEYS_V1[index]!;
    const sink = readKnownOwnDataFieldsV1(fields[key], AUDIT_SINK_STATE_KEYS_V1);
    const digest = ContentDigestV1Schema.safeParse(sink?.contentDigest);
    if (
      sink === undefined ||
      !CapturedNumberIsSafeIntegerV1(sink.revision) ||
      (sink.revision as number) < 0 ||
      !CapturedNumberIsSafeIntegerV1(sink.count) ||
      (sink.count as number) < 0 ||
      !digest.success
    ) {
      return failV1("side_effect_boundary", "side_effect_detected");
    }
    output[key] = CapturedObjectFreezeV1({
      revision: sink.revision as number,
      count: sink.count as number,
      contentDigest: digest.data,
    });
  }
  return CapturedObjectFreezeV1(output) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditSnapshotInternalV1;
}

function auditSnapshotsEqualV1(
  left: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditSnapshotInternalV1,
  right: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditSnapshotInternalV1,
): boolean {
  for (let index = 0; index < AUDIT_SINK_KEYS_V1.length; index += 1) {
    const key = AUDIT_SINK_KEYS_V1[index]!;
    const leftSink = left[key];
    const rightSink = right[key];
    if (
      leftSink.revision !== rightSink.revision ||
      leftSink.count !== rightSink.count ||
      leftSink.contentDigest !== rightSink.contentDigest
    ) {
      return false;
    }
  }
  return true;
}

function deriveSideEffectBoundaryV1(
  pre: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditSnapshotInternalV1,
  post: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditSnapshotInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectBoundaryReferenceCandidateV1 {
  if (!auditSnapshotsEqualV1(pre, post)) {
    return failV1("side_effect_boundary", "side_effect_detected");
  }
  const deltas = CapturedObjectCreateV1(null) as Record<string, number>;
  for (let index = 0; index < AUDIT_SINK_KEYS_V1.length; index += 1) {
    const key = AUDIT_SINK_KEYS_V1[index]!;
    const delta = post[key].count - pre[key].count;
    if (delta !== 0) return failV1("side_effect_boundary", "side_effect_detected");
    deltas[key] = delta;
  }
  return CapturedObjectFreezeV1({
    policy:
      "zero_side_effect_before_first_same_installation_identity_migration_history_quota_reservation_write_reference_candidate_v1",
    reservationWrites: deltas.reservationWrites as 0,
    planPublications: deltas.planPublications as 0,
    acceptanceAppends: deltas.acceptanceAppends as 0,
    progressAppends: deltas.progressAppends as 0,
    operationReceiptWrites: deltas.operationReceiptWrites as 0,
    destinationObjectAllocations: deltas.destinationObjectAllocations as 0,
    quotaConsumptions: deltas.quotaConsumptions as 0,
    emergencyReserveConsumptions: deltas.emergencyReserveConsumptions as 0,
    pendingIntents: deltas.pendingIntents as 0,
  });
}

function expectedDestinationObservationDigestV1(
  destination: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1,
): ContentDigestV1 {
  return destination.state === "absent"
    ? destination.absenceReferenceDigest
    : destination.current.cutContentDigest;
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  const leftBytes = canonicalizeJcsSafeIntegerUtf8V1(left);
  const rightBytes = canonicalizeJcsSafeIntegerUtf8V1(right);
  const leftLength = typedArrayByteLengthV1(leftBytes);
  if (leftLength !== typedArrayByteLengthV1(rightBytes)) return false;
  for (let index = 0; index < leftLength; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return false;
  }
  return true;
}

function assertEndpointObservationV1(
  observation: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationInternalV1,
  projection: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalVerifiedEndpointProjectionInternalV1,
  stage: "pre_observation" | "post_observation",
): void {
  if (
    observation.sourceStoreCutContentDigest !== projection.initialSourceStoreManifest.cutContentDigest ||
    observation.sourceTrustClosureContentDigest !== projection.sourceTrust.trustClosureContentDigest ||
    observation.destinationTrustClosureContentDigest !== projection.destinationTrust.trustClosureContentDigest ||
    observation.destinationNamespaceObservationDigest !==
      expectedDestinationObservationDigestV1(projection.initialDestinationNamespace)
  ) {
    return failV1(stage, "snapshot_changed");
  }
}

function assertEndpointProjectionCrossBindingsV1(
  projection: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalVerifiedEndpointProjectionInternalV1,
): void {
  const source = projection.sourceTrust;
  const destination = projection.destinationTrust;
  // The migration-ID preimage is an alias-free JSON tree.  Parse the
  // repeated namespace projections independently instead of reusing the
  // nested Store-cut object identities below.
  const sourceNamespace =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema.parse(
      projection.initialSourceStoreManifest,
    ).namespace;
  const detachedInitialDestinationNamespace =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1Schema.parse(
      projection.initialDestinationNamespace,
    );
  const destinationNamespace =
    detachedInitialDestinationNamespace.state === "absent"
      ? detachedInitialDestinationNamespace.namespace
      : detachedInitialDestinationNamespace.current.namespace;
  if (
    source.installationIdentityGenerationId !== destination.installationIdentityGenerationId ||
    source.installationIdentityGenerationId !== sourceNamespace.installationIdentityGenerationId ||
    source.targetProfileId !== destination.targetProfileId ||
    !canonicalEqualV1(source.currentAcceptanceRead, destination.currentAcceptanceRead) ||
    !canonicalEqualV1(source.retainedAcceptanceGenerations, destination.retainedAcceptanceGenerations)
  ) {
    return failV1("endpoint_trust", "trust_closure_invalid");
  }
  if (
    !canonicalEqualV1(sourceNamespace, destinationNamespace) ||
    !canonicalEqualV1(sourceNamespace, projection.namespaceTranslation.sourceNamespace) ||
    !canonicalEqualV1(destinationNamespace, projection.namespaceTranslation.destinationNamespace) ||
    projection.namespaceTranslation.journalAuthorityInstallationIdentityGenerationId !==
      source.installationIdentityGenerationId
  ) {
    return failV1("endpoint_trust", "mode_relationship_invalid");
  }
  const sourceBinding = projection.initialSourceStoreManifest.providerBinding;
  const destinationBinding =
    projection.initialDestinationNamespace.state === "absent"
      ? projection.initialDestinationNamespace.providerBinding
      : projection.initialDestinationNamespace.current.providerBinding;
  if (sourceBinding.providerId === destinationBinding.providerId) {
    return failV1("prospective_destination_evidence", "destination_already_selected");
  }
  const sourceBindingProjection = {
    targetProfileId: sourceBinding.targetProfileId,
    providerId: sourceBinding.providerId,
    registryEntryContentDigest: sourceBinding.registryEntryContentDigest,
    semanticProviderPolicyDigest: sourceBinding.semanticProviderPolicyDigest,
    providerFeasibilityEvidence: sourceBinding.providerFeasibilityEvidence,
    runtimeAttestationContentDigest:
      sourceBinding.runtimeAttestationContentDigest,
    bindingDerivationKeyGeneration:
      sourceBinding.bindingDerivationKeyGeneration,
  };
  const destinationBindingProjection = {
    targetProfileId: destinationBinding.targetProfileId,
    providerId: destinationBinding.providerId,
    registryEntryContentDigest: destinationBinding.registryEntryContentDigest,
    semanticProviderPolicyDigest: destinationBinding.semanticProviderPolicyDigest,
    providerFeasibilityEvidence: destinationBinding.providerFeasibilityEvidence,
    runtimeAttestationContentDigest:
      destinationBinding.runtimeAttestationContentDigest,
    bindingDerivationKeyGeneration:
      destinationBinding.bindingDerivationKeyGeneration,
  };
  if (
    !canonicalEqualV1(sourceBindingProjection, source.currentWriterSelection) ||
    !canonicalEqualV1(
      destinationBindingProjection,
      destination.prospectiveWriterProjection,
    )
  ) {
    return failV1("endpoint_trust", "trust_closure_invalid");
  }
}

function takePrePlanContextV1(
  capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityV1,
): PrePlanCapabilityContextInternalV1 {
  if (!isObjectIdentityV1(capability)) {
    return failV1("pre_plan_reference_capability", "capability_invalid");
  }
  const context = weakMapGetV1(prePlanCapabilityContextsInternalV1, capability);
  if (
    context === undefined ||
    !weakMapDeleteV1(prePlanCapabilityContextsInternalV1, capability)
  ) {
    return failV1("pre_plan_reference_capability", "capability_invalid");
  }
  return context;
}

function mapOperationErrorV1(error: unknown): DiagnosticSignalInternalV1 {
  if (isDiagnosticSignalV1(error)) return error;
  if (
    isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticErrorInternalV1(
      error,
    )
  ) {
    return new DiagnosticSignalInternalV1(error.stage, error.reason);
  }
  if (
    isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1(
      error,
    )
  ) {
    if (error.stage === "capability") {
      return new DiagnosticSignalInternalV1(
        "pre_plan_reference_capability",
        "capability_invalid",
      );
    }
    if (error.stage === "continuity") {
      return new DiagnosticSignalInternalV1("post_observation", "snapshot_changed");
    }
    return new DiagnosticSignalInternalV1(
      "source_complete_stream",
      error.stage === "source_closure" ? "source_cut_incomplete" : "source_invalid",
    );
  }
  if (
    isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineErrorInternalV1(
      error,
    )
  ) {
    const reason = error.reason === "schema_invalid"
      ? "quota_ledger_integrity_failed"
      : error.reason;
    return new DiagnosticSignalInternalV1(error.stage, reason);
  }
  return new DiagnosticSignalInternalV1("plan_candidate", "candidate_invalid");
}

function failureResultV1(
  stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticStageInternalV1,
  reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticReasonInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticResultInternalV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
  });
}

function successResultV1(
  value: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticResultInternalV1 {
  return createProviderNonThenableFrozenRecordV1({ ok: true as const, value });
}

/**
 * Mint one zero-own-key capability. Endpoint preparation and all of its
 * asynchronous trust checks execute inside the same side-effect audit
 * interval; no intermediate endpoint capability escapes this operation.
 */
async function mintPrePlanReferenceCapabilityPreparedInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectReadyBuildInputInternalV1> {
  let observeSideEffectSinks: (() => unknown) | undefined;
  let preAuditSnapshot:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditSnapshotInternalV1
    | undefined;
  let preparedRegistrySuccessorSeed:
    ProviderRegistryPreparedSuccessorSeedInternalV1 | undefined;
  let preparedRegistrySuccessorCohortIdentity: object | undefined;
  let preparedRegistrySuccessorCohortCapability:
    ProviderRegistryPreparedSuccessorCohortCapabilityInternalV1 | undefined;
  let preparedRegistrySuccessorCohortTransferred = false;
  try {
    const fields = readKnownOwnDataFieldsV1(input, MINT_INPUT_KEYS_V1);
    if (fields === undefined) {
      return failV1("pre_plan_reference_capability", "capability_invalid");
    }
    const observerFields = readKnownOwnDataFieldsV1(
      fields.sideEffectAuditObserver,
      AUDIT_OBSERVER_KEYS_V1,
    );
    if (
      observerFields === undefined ||
      typeof observerFields.observeSideEffectSinks !== "function"
    ) {
      return failV1("pre_plan_reference_capability", "capability_invalid");
    }
    const capturedObserveSideEffectSinks =
      observerFields.observeSideEffectSinks as () => unknown;
    observeSideEffectSinks = capturedObserveSideEffectSinks;
    try {
      preAuditSnapshot = parseAuditSnapshotV1(
        capturedObserveSideEffectSinks(),
      );
    } catch {
      return failV1("side_effect_boundary", "side_effect_detected");
    }

    // Request and nested budgets are projected only after the audit interval
    // has opened.  Projection reads fixed own-data descriptors and validates a
    // newly materialized exact tree; it never enumerates caller topology.
    const request = materializeRequestAfterAuditV1(fields.request);

    const preparedEndpoint =
      await prepareProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustInternalV1(
        {
          acceptanceClosureIdentity: fields.acceptanceClosureIdentity,
          endpointObservationHost: fields.endpointObservationHost,
          prospectiveDestinationPreparedSourceCapability:
            fields.prospectiveDestinationPreparedSourceCapability,
          sourceStreamHost: fields.sourceStreamHost,
        },
      );
    preparedRegistrySuccessorSeed =
      preparedEndpoint.preparedRegistrySuccessorSeed;
    const liveDigest = ContentDigestV1Schema.safeParse(
      fields.verifiedLiveReferenceSchemaDigest,
    );
    const protocolDigest = ContentDigestV1Schema.safeParse(
      fields.verifiedMigrationProtocolDigest,
    );
    if (!liveDigest.success || !protocolDigest.success) {
      return failV1("pre_plan_reference_capability", "capability_invalid");
    }
    const projection = preparedEndpoint.verifiedEndpointProjection;
    const cohortIdentity = CapturedObjectFreezeV1(CapturedObjectCreateV1(null));
    preparedRegistrySuccessorCohortIdentity = cohortIdentity;
    preparedRegistrySuccessorCohortCapability =
      bindProviderRegistryPreparedSuccessorSeedToCohortInternalV1(
        preparedRegistrySuccessorSeed,
        cohortIdentity,
      );
    preparedRegistrySuccessorSeed = undefined;
    const sourceMachineCapability =
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineInternalV1(
        {
          cohortIdentity,
          sourceInstallationIdentityGenerationId:
            projection.sourceTrust.installationIdentityGenerationId,
          sourceTrustClosureContentDigest:
            projection.sourceTrust.trustClosureContentDigest,
          sourceStoreManifest: projection.initialSourceStoreManifest,
          verifiedLiveReferenceSchemaDigest: liveDigest.data,
          streamHost: preparedEndpoint.sourceStreamHost,
        },
      );
    const quotaMachineCapability =
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineInternalV1(
        {
          cohortIdentity,
          installationIdentityGenerationId:
            projection.sourceTrust.installationIdentityGenerationId,
          quotaObservationHost:
            fields.quotaObservationHost as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1,
        },
      );
    const capability = CapturedObjectFreezeV1(
      CapturedObjectCreateV1(null),
    ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityV1;
    const claimedBuildInput = CapturedObjectFreezeV1({
      request,
      capability,
    });
    const buildInput = createProviderNonThenableFrozenRecordV1({
      request,
      prePlanReferenceCapability: capability,
    }) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBoundBuildInputInternalV1;
    const ready = createProviderNonThenableFrozenRecordV1({
      prePlanReferenceCapability: capability,
      request,
      buildInput,
    });
    weakMapSetV1(
      prePlanCapabilityContextsInternalV1,
      capability,
      CapturedObjectFreezeV1({
        cohortIdentity,
        verifiedLiveReferenceSchemaDigest: liveDigest.data,
        verifiedMigrationProtocolDigest: protocolDigest.data,
        verifiedEndpointProjection: projection,
        captureEndpointObservation:
          preparedEndpoint.captureEndpointObservation,
        observeSideEffectSinks,
        preAuditSnapshot,
        sourceMachineCapability,
        quotaMachineCapability,
        preparedRegistrySuccessorCohortCapability,
      }),
    );
    weakMapSetV1(readyBuildInputsInternalV1, buildInput, claimedBuildInput);
    preparedRegistrySuccessorCohortTransferred = true;
    return ready;
  } catch (error) {
    if (preparedRegistrySuccessorSeed !== undefined) {
      try {
        discardProviderRegistryPreparedSuccessorSeedInternalV1(
          preparedRegistrySuccessorSeed,
        );
      } catch {
        // The opaque diagnostic below remains intentionally non-specific.
      }
    }
    if (
      !preparedRegistrySuccessorCohortTransferred &&
      preparedRegistrySuccessorCohortIdentity !== undefined &&
      preparedRegistrySuccessorCohortCapability !== undefined
    ) {
      try {
        discardProviderRegistryPreparedSuccessorCohortInternalV1(
          preparedRegistrySuccessorCohortIdentity,
          preparedRegistrySuccessorCohortCapability,
        );
      } catch {
        // The opaque diagnostic below remains intentionally non-specific.
      }
    }
    if (observeSideEffectSinks !== undefined && preAuditSnapshot !== undefined) {
      try {
        const post = parseAuditSnapshotV1(observeSideEffectSinks());
        if (!auditSnapshotsEqualV1(preAuditSnapshot, post)) {
          return failV1("side_effect_boundary", "side_effect_detected");
        }
      } catch {
        return failV1("side_effect_boundary", "side_effect_detected");
      }
    }
    if (isDiagnosticSignalV1(error)) throw error;
    if (
      isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticErrorInternalV1(
        error,
      )
    ) {
      return failV1(error.stage, error.reason);
    }
    return failV1("pre_plan_reference_capability", "capability_invalid");
  }
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectReadyBuildInputInternalV1> {
  return hardenProviderPointPromiseV1(
    mintPrePlanReferenceCapabilityPreparedInternalV1(input),
  );
}

interface PreparedCandidateInternalV1 {
  readonly request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1;
  readonly context: PrePlanCapabilityContextInternalV1;
  readonly preQuotaCut: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCaptureInternalV1;
  readonly quotaContinuity: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostQuotaContinuityInternalV1;
  readonly preObservation: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalObservationReferenceCandidateV1;
  readonly postObservation: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalObservationReferenceCandidateV1;
  readonly planEnvelope: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanEnvelopeReferenceCandidateV1;
  readonly completeSourceReadClosure: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1["completeSourceReadClosure"];
  readonly sourceDryRunCut: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1["sourceDryRunCut"];
  readonly historyQuotaSizing: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1["historyQuotaSizing"];
  readonly historyQuotaSizingDigest: ContentDigestV1;
  readonly historyQuotaAdmission: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1["historyQuotaAdmission"];
  readonly admissionVectorDigest: ContentDigestV1;
  readonly migrationBudgetsDigest: ContentDigestV1;
}

async function executePreparedCandidateV1(
  claimed: ClaimedBuildInputInternalV1,
  context: PrePlanCapabilityContextInternalV1,
): Promise<PreparedCandidateInternalV1> {
  const request = claimed.request;
  const projection = context.verifiedEndpointProjection;
  assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineBindingInternalV1(
    context.sourceMachineCapability,
    context.cohortIdentity,
    projection.sourceTrust.installationIdentityGenerationId,
  );
  assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1(
    context.quotaMachineCapability,
    context.cohortIdentity,
    projection.sourceTrust.installationIdentityGenerationId,
  );
  let preEndpointObservation: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationInternalV1;
  try {
    preEndpointObservation = parseEndpointObservationV1(
      await context.captureEndpointObservation("pre"),
      "pre_observation",
    );
  } catch (error) {
    if (isDiagnosticSignalV1(error)) throw error;
    return failV1("pre_observation", "snapshot_changed");
  }
  assertEndpointObservationV1(preEndpointObservation, projection, "pre_observation");
  if (
    request.liveReferenceSchemaDigest !==
      context.verifiedLiveReferenceSchemaDigest ||
    request.migrationProtocolDigest !==
      context.verifiedMigrationProtocolDigest
  ) {
    return failV1("current_strong_source", "source_invalid");
  }
  if (projection.sourceTrust.role !== "source_current_strong_writer") {
    return failV1("current_strong_source", "source_not_current_strong_writer");
  }

  assertEndpointProjectionCrossBindingsV1(projection);

  let migrationBudgetsDigest: ContentDigestV1;
  try {
    migrationBudgetsDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1(
        request.migrationBudgets,
      );
  } catch {
    return failV1("migration_budgets", "budget_exceeded");
  }
  if (request.migrationBudgets.maxRootEntries < 6) {
    return failV1("migration_budgets", "budget_exceeded");
  }

  const sourceRead =
    await readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
      context.sourceMachineCapability,
    );
  const completeSourceReadClosure = sourceRead.completeSourceReadClosure;
  const sizing =
    await deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunAndHistoryQuotaSizingInternalV1(
      {
        quotaMachineCapability: context.quotaMachineCapability,
        completeSourceReadClosure,
        migrationBudgets: request.migrationBudgets,
        migrationBudgetsDigest,
      },
    );
  const preQuotaCut =
    await captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
      {
        quotaMachineCapability: context.quotaMachineCapability,
        phase: "pre",
      },
    );
  const admission =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionInternalV1(
      {
        quotaMachineCapability: context.quotaMachineCapability,
        completeQuotaCut: preQuotaCut,
        historyQuotaSizing: sizing.historyQuotaSizing,
        historyQuotaSizingDigest: sizing.historyQuotaSizingDigest,
        admissionClass: "normal",
      },
    );

  // The migration-ID preimage must be an alias-free JSON tree. Parse the
  // repeated namespace projections independently from their nested Store
  // cuts instead of reusing those object identities.
  const sourceNamespace =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema.parse(
      projection.initialSourceStoreManifest,
    ).namespace;
  const detachedInitialDestinationNamespace =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1Schema.parse(
      projection.initialDestinationNamespace,
    );
  const destinationNamespace =
    detachedInitialDestinationNamespace.state === "absent"
      ? detachedInitialDestinationNamespace.namespace
      : detachedInitialDestinationNamespace.current.namespace;
  const migrationIdentityProjection = {
    mode: "same_installation_identity" as const,
    reason: "provider_decommission" as const,
    identityRelationship: "source_destination_exact_same" as const,
    sourceNamespace,
    destinationNamespace,
    namespaceTranslation: projection.namespaceTranslation,
    targetProfileId: projection.sourceTrust.targetProfileId,
    sourceTrust: projection.sourceTrust,
    destinationTrust: projection.destinationTrust,
    initialSourceStoreManifest: projection.initialSourceStoreManifest,
    initialDestinationNamespace: projection.initialDestinationNamespace,
    journalAuthorityInstallationIdentityGenerationId:
      projection.sourceTrust.installationIdentityGenerationId,
    migrationBudgets: request.migrationBudgets,
    migrationBudgetsDigest,
    migrationHistoryQuotaSizing: sizing.historyQuotaSizing,
    migrationHistoryQuotaSizingDigest: sizing.historyQuotaSizingDigest,
    migrationHistoryQuotaAdmission: admission.historyQuotaAdmission,
    admissionVectorDigest: admission.admissionVectorDigest,
    liveReferenceSchemaDigest: context.verifiedLiveReferenceSchemaDigest,
    migrationProtocolDigest: context.verifiedMigrationProtocolDigest,
  };
  let migrationId;
  try {
    migrationId =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationIdReferenceCandidateV1(
        migrationIdentityProjection,
      );
  } catch {
    return failV1("migration_identity", "candidate_invalid");
  }
  const descriptorUnsigned = {
    migrationId,
    role: "same_identity_journal" as const,
    installationIdentityGenerationId:
      projection.sourceTrust.installationIdentityGenerationId,
    admissionVectorDigest: admission.admissionVectorDigest,
  };
  let reservationId;
  try {
    reservationId =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationIdReferenceCandidateV1(
        descriptorUnsigned,
      );
  } catch {
    return failV1("reservation_descriptor", "candidate_invalid");
  }
  const reservationDescriptor = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_history_quota_reservation_descriptor_reference_candidate_v1" as const,
    locatorProfile:
      "provider_migration_same_installation_identity_current_strong_source_normal_history_quota_reservation_reference_candidate_v1" as const,
    reservationId,
    ...descriptorUnsigned,
  };
  const planPayload = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_plan_payload_reference_candidate_v1" as const,
    ...migrationIdentityProjection,
    migrationId,
    progressJournalLocatorProfile:
      "provider_migration_same_installation_identity_current_strong_source_normal_progress_head_reference_candidate_v1" as const,
    migrationHistoryQuotaReservations: {
      mode: "same_installation_identity" as const,
      journal: reservationDescriptor,
    },
    createdAt: request.createdAt,
  };
  let detachedPlanPayload;
  try {
    // Parsing produces the alias-free detached tree required by every public
    // digest entry guard.  The semantic projection above deliberately reuses
    // already-validated subtrees while it is assembled, so it must not be
    // passed directly to the Plan digest helper.
    detachedPlanPayload = deepFreezeProviderPointDetachedDataTreeV1(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanPayloadReferenceCandidateV1Schema.parse(
        planPayload,
      ),
    );
  } catch {
    return failV1("plan_candidate", "candidate_invalid");
  }
  let planContentDigest: ContentDigestV1;
  try {
    planContentDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanContentDigestReferenceCandidateV1(
        detachedPlanPayload,
      );
  } catch {
    return failV1("plan_candidate", "candidate_invalid");
  }
  const rawPlanEnvelope = {
    schemaVersion: 1 as const,
    recordType:
      "provider_migration_same_installation_identity_current_strong_source_normal_plan_reference_candidate" as const,
    mode: "same_installation_identity" as const,
    migrationId,
    sourceRepositoryId: sourceNamespace.repositoryId,
    sourceWorktreeId: sourceNamespace.worktreeId,
    destinationRepositoryId: destinationNamespace.repositoryId,
    destinationWorktreeId: destinationNamespace.worktreeId,
    createdAt: request.createdAt,
    contentDigest: planContentDigest,
    payload: detachedPlanPayload,
  };
  let actualPlanBytes: number;
  try {
    actualPlanBytes = typedArrayByteLengthV1(
      canonicalizeJcsSafeIntegerUtf8V1(rawPlanEnvelope),
    );
  } catch {
    return failV1("plan_candidate", "candidate_invalid");
  }
  if (
    actualPlanBytes > MAX_PLAN_ENVELOPE_BYTES_V1 ||
    actualPlanBytes > request.migrationBudgets.maxSingleRecordBytes
  ) {
    return failV1("plan_envelope_actual_size", "budget_exceeded");
  }
  const parsedPlan =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanEnvelopeReferenceCandidateV1Schema.safeParse(
      rawPlanEnvelope,
    );
  if (!parsedPlan.success) return failV1("plan_candidate", "candidate_invalid");
  const planEnvelope = deepFreezeProviderPointDetachedDataTreeV1(
    parsedPlan.data,
  );

  const sourceContinuity =
    await captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityInternalV1(
      { continuityHandle: sourceRead.continuityHandle },
    );
  if (
    sourceContinuity.sourceFreezeStateReferenceDigest !==
      completeSourceReadClosure.sourceFreezeStateReferenceDigest
  ) {
    return failV1("post_observation", "snapshot_changed");
  }
  const quotaContinuity =
    await captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostQuotaContinuityInternalV1(
      {
        quotaMachineCapability: context.quotaMachineCapability,
        preContinuity: preQuotaCut,
      },
    );
  let postEndpointObservation: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationInternalV1;
  try {
    postEndpointObservation = parseEndpointObservationV1(
      await context.captureEndpointObservation("post"),
      "post_observation",
    );
  } catch (error) {
    if (isDiagnosticSignalV1(error)) throw error;
    return failV1("post_observation", "snapshot_changed");
  }
  assertEndpointObservationV1(postEndpointObservation, projection, "post_observation");

  const preObservation = CapturedObjectFreezeV1({
    ...preEndpointObservation,
    sourceFreezeStateReferenceDigest:
      completeSourceReadClosure.sourceFreezeStateReferenceDigest,
    quotaSnapshotContentDigest: preQuotaCut.quotaSnapshot.quotaSnapshotContentDigest,
  });
  const postObservation = CapturedObjectFreezeV1({
    ...postEndpointObservation,
    sourceFreezeStateReferenceDigest:
      sourceContinuity.sourceFreezeStateReferenceDigest,
    quotaSnapshotContentDigest: quotaContinuity.postSnapshotContentDigest,
  });
  if (!canonicalEqualV1(preObservation, postObservation)) {
    return failV1("post_observation", "snapshot_changed");
  }
  return createProviderNonThenableFrozenRecordV1({
    request,
    context,
    preQuotaCut,
    quotaContinuity,
    preObservation,
    postObservation,
    planEnvelope,
    completeSourceReadClosure,
    sourceDryRunCut: sizing.sourceDryRunCut,
    historyQuotaSizing: sizing.historyQuotaSizing,
    historyQuotaSizingDigest: sizing.historyQuotaSizingDigest,
    historyQuotaAdmission: admission.historyQuotaAdmission,
    admissionVectorDigest: admission.admissionVectorDigest,
    migrationBudgetsDigest,
  });
}

function finalizeCandidateV1(
  prepared: PreparedCandidateInternalV1,
  sideEffectBoundary: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectBoundaryReferenceCandidateV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1 {
  const projection = prepared.context.verifiedEndpointProjection;
  const quotaReferenceObservation = {
    preSnapshotContentDigest:
      prepared.quotaContinuity.preSnapshotContentDigest,
    postSnapshotContentDigest:
      prepared.quotaContinuity.postSnapshotContentDigest,
    equality: "exact" as const,
    observationContentDigest: prepared.quotaContinuity.observationContentDigest,
  };
  const prePostUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_pre_post_observation_equality_reference_candidate_v1" as const,
    pre: prepared.preObservation,
    post: prepared.postObservation,
    equality: "exact" as const,
  };
  const prePostObservationEquality = {
    ...prePostUnsigned,
    equalityContentDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrePostObservationEqualityContentDigestReferenceCandidateV1(
        prePostUnsigned,
      ),
  };
  const requestContentDigest =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestContentDigestReferenceCandidateV1(
      prepared.request,
    );
  const planPayload = prepared.planEnvelope.payload;
  const detachedReservationDescriptor =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema.parse(
      planPayload.migrationHistoryQuotaReservations.journal,
    );
  const unsigned = {
    authority:
      "none_provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_plan_admission_closure_reference_candidate_only" as const,
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_plan_admission_closure_reference_candidate_v1" as const,
    stopPoint:
      "before_same_installation_identity_migration_history_quota_reservation_write" as const,
    requestContentDigest,
    mode: "same_installation_identity" as const,
    reason: "provider_decommission" as const,
    admissionClass: "normal" as const,
    createdAt: prepared.request.createdAt,
    sourceTrust: projection.sourceTrust,
    destinationTrust: projection.destinationTrust,
    namespaceTranslation: projection.namespaceTranslation,
    completeSourceReadClosure: prepared.completeSourceReadClosure,
    sourceDryRunCut: prepared.sourceDryRunCut,
    migrationBudgetsDigest: prepared.migrationBudgetsDigest,
    historyQuotaSizing: prepared.historyQuotaSizing,
    historyQuotaSizingDigest: prepared.historyQuotaSizingDigest,
    historyQuotaAdmission: prepared.historyQuotaAdmission,
    admissionVectorDigest: prepared.admissionVectorDigest,
    quotaReferenceSnapshot: prepared.preQuotaCut.quotaSnapshot,
    quotaReferenceObservation,
    migrationId: prepared.planEnvelope.migrationId,
    reservationDescriptors: [
      detachedReservationDescriptor,
    ] as [typeof detachedReservationDescriptor],
    planCandidate: prepared.planEnvelope,
    prePostObservationEquality,
    sideEffectBoundary,
    verificationBoundary: {
      hashDag: "self_contained_public_projection_recomputable_v1" as const,
      sourceCompleteness:
        "same_operation_opaque_streaming_capability_exact_once_eof_and_pre_post_continuity_v1" as const,
      locatorAuthenticity:
        "same_cohort_live_reference_schema_bound_strict_locator_commitment_deriver_v1" as const,
      referenceSlotAuthenticity:
        "same_cohort_live_reference_schema_bound_exact_slot_enumerator_and_commitment_deriver_v1" as const,
      quotaCompleteness:
        "same_cohort_opaque_quota_machine_complete_snapshot_and_pre_post_continuity_v1" as const,
      quotaLedgerSemantics:
        "same_cohort_machine_opaque_request_commitment_linkage_without_public_request_replay_v1" as const,
      endpointTrustAuthenticity:
        "same_cohort_opaque_retained_root_registry_catalog_universe_evidence_runtime_closure_v1" as const,
      prospectiveRegistryMaterialOwnership:
        "same_cohort_copied_retained_registry_state_read_only_temporary_admit_no_public_key_material_alias_except_identical_current_feasibility_approver_records_v1" as const,
      prospectiveDestination:
        "signed_genesis_registry_entry_evidence_runtime_and_universe_target_not_catalog_or_manifest_admitted_v1" as const,
      catalogAdmission: "none" as const,
      registryMembership: "none" as const,
      migrationPreparedManifest: "none" as const,
      formalMigrationIdMapping: "none" as const,
      providerAuthority: "none" as const,
      durability: "none" as const,
      migrationExecution: "none" as const,
    },
  };
  let closureContentDigest: ContentDigestV1;
  try {
    closureContentDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalClosureContentDigestReferenceCandidateV1(
        unsigned,
      );
  } catch {
    return failV1("plan_candidate", "candidate_invalid");
  }
  const candidate = { ...unsigned, closureContentDigest };
  try {
    return validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1(
      candidate,
    );
  } catch {
    return failV1("plan_candidate", "candidate_invalid");
  }
}

async function diagnoseBuildPreparedV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticResultInternalV1> {
  let claimed: ClaimedBuildInputInternalV1;
  let context: PrePlanCapabilityContextInternalV1;
  let continuationIntent:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1 | undefined;
  try {
    ({ claimed, context, continuationIntent } =
      takeReadyBuildInputAndPrePlanContextV1(input));
  } catch (error) {
    const diagnostic = mapOperationErrorV1(error);
    return failureResultV1(diagnostic.stage, diagnostic.reason);
  }

  let prepared: PreparedCandidateInternalV1 | undefined;
  let result:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticResultInternalV1
    | undefined;
  let intermediateAudit:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditSnapshotInternalV1
    | undefined;
  try {
    try {
      prepared = await executePreparedCandidateV1(claimed, context);
      intermediateAudit = parseAuditSnapshotV1(
        context.observeSideEffectSinks(),
      );
      const sideEffectBoundary = deriveSideEffectBoundaryV1(
        context.preAuditSnapshot,
        intermediateAudit,
      );
      result = successResultV1(
        finalizeCandidateV1(prepared, sideEffectBoundary),
      );
    } catch (error) {
      const diagnostic = mapOperationErrorV1(error);
      result = failureResultV1(diagnostic.stage, diagnostic.reason);
    }
  } finally {
    try {
      const finalAudit = parseAuditSnapshotV1(
        context.observeSideEffectSinks(),
      );
      if (
        !auditSnapshotsEqualV1(context.preAuditSnapshot, finalAudit) ||
        (intermediateAudit !== undefined &&
          !auditSnapshotsEqualV1(intermediateAudit, finalAudit))
      ) {
        result = failureResultV1(
          "side_effect_boundary",
          "side_effect_detected",
        );
      }
    } catch {
      result = failureResultV1(
        "side_effect_boundary",
        "side_effect_detected",
      );
    }
    try {
      if (result?.ok === true && continuationIntent !== undefined) {
        bindProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationToFinalCandidateInternalV1(
          continuationIntent,
          context.cohortIdentity,
          context.preparedRegistrySuccessorCohortCapability,
          result.value,
        );
      } else {
        discardProviderRegistryPreparedSuccessorCohortInternalV1(
          context.cohortIdentity,
          context.preparedRegistrySuccessorCohortCapability,
        );
        if (continuationIntent !== undefined) {
          discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1(
            continuationIntent,
          );
        }
      }
    } catch {
      try {
        discardProviderRegistryPreparedSuccessorCohortInternalV1(
          context.cohortIdentity,
          context.preparedRegistrySuccessorCohortCapability,
        );
      } catch {
        // The diagnostic below remains intentionally opaque.
      }
      if (continuationIntent !== undefined) {
        try {
          discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1(
            continuationIntent,
          );
        } catch {
          // The diagnostic below remains intentionally opaque.
        }
      }
      result = failureResultV1("plan_candidate", "candidate_invalid");
    }
  }
  return result ?? failureResultV1("plan_candidate", "candidate_invalid");
}

/**
 * Package-private exact-stage diagnostic operation.  Public facade code maps
 * every failure to the single opaque provider_unavailable/attestation_invalid
 * error and never exports this union.
 */
export function diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticResultInternalV1> {
  return hardenProviderPointPromiseV1(diagnoseBuildPreparedV1(input));
}

CapturedObjectFreezeV1(
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1,
);
