/**
 * Package-private D-42 prepared Registry direct-successor orchestrator.
 *
 * The mint opens the twelve-sink audit before it starts a fresh D-41
 * operation.  D-41 receives a fixed nine-sink projection of that same
 * observer.  The public build input is an exact registered frozen identity;
 * copied, cloned, literal, accessor, or extended objects cannot claim the
 * underlying capability.
 */

import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  type ContentDigestV1,
} from "./primitives.js";
import {
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationHostInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationPreparedSourceCapabilityInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-endpoint-trust-capability-internal.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-history-quota-reference-machine-internal.js";
import {
  discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1,
  registerProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorFinalCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-continuation-internal.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1Schema,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalMigrationIdMappingV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorClosureContentDigestV1,
  validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate-wire.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticResultInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditObserverInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditSnapshotInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-pre-plan-reference-capability-internal.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1Schema,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-source-reference-machine-internal.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  diagnoseProviderRegistryPreparedDirectSuccessorInternalV1,
  discardProviderRegistryPreparedSuccessorFinalInternalV1,
  type ProviderRegistryPreparedSuccessorFinalCapabilityInternalV1,
} from "./provider-registry-history-prepared-internal.js";
import {
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestPinV1Schema,
  type ProviderRegistryManifestEnvelopeV1,
} from "./provider-registry-records.js";

const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapPrototypeDeleteV1 = WeakMap.prototype.delete;
const CapturedWeakMapPrototypeGetV1 = WeakMap.prototype.get;
const CapturedWeakMapPrototypeSetV1 = WeakMap.prototype.set;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetPrototypeAddV1 = WeakSet.prototype.add;
const CapturedWeakSetPrototypeHasV1 = WeakSet.prototype.has;

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
) as <K extends object, V>(map: WeakMap<K, V>, key: K, value: V) => void;
const weakSetAddV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetPrototypeAddV1,
) as <T extends object>(set: WeakSet<T>, value: T) => void;
const weakSetHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetPrototypeHasV1,
) as <T extends object>(set: WeakSet<T>, value: T) => boolean;

const MINT_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "acceptanceClosureIdentity",
  "endpointObservationHost",
  "externallySignedPreparedRegistryManifestSourceCapability",
  "prospectiveDestinationPreparedSourceCapability",
  "quotaObservationHost",
  "request",
  "sideEffectAuditObserver",
  "sourceStreamHost",
  "verifiedLiveReferenceSchemaDigest",
  "verifiedMigrationProtocolDigest",
] as const);
const SIGNED_MANIFEST_SOURCE_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "externallySignedManifestEnvelope",
] as const);
const REQUEST_KEYS_V1 = CapturedObjectFreezeV1([
  "profile",
  "preSideEffectRequest",
  "expectedCandidateMigrationId",
  "expectedPreparedRegistryManifestPin",
] as const);
const AUDIT_OBSERVER_KEYS_V1 = CapturedObjectFreezeV1([
  "observeSideEffectSinks",
] as const);
const AUDIT_SINK_KEYS_V1 = CapturedObjectFreezeV1([
  "reservationWrites",
  "planPublications",
  "acceptanceAppends",
  "progressAppends",
  "operationReceiptWrites",
  "destinationObjectAllocations",
  "quotaConsumptions",
  "emergencyReserveConsumptions",
  "pendingIntents",
  "rootSigningRequests",
  "registryManifestPublications",
  "catalogPublications",
] as const);
const D41_AUDIT_SINK_KEYS_V1 = CapturedObjectFreezeV1([
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

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectSinkStateInternalV1 {
  readonly revision: number;
  readonly count: number;
  readonly contentDigest: ContentDigestV1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditSnapshotInternalV1 =
  Readonly<
    Record<
      (typeof AUDIT_SINK_KEYS_V1)[number],
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectSinkStateInternalV1
    >
  >;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditObserverInternalV1 {
  readonly observeSideEffectSinks: () => unknown;
}

declare const externallySignedPreparedRegistryManifestSourceCapabilityBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistryManifestSourceCapabilityInternalV1 {
  readonly [externallySignedPreparedRegistryManifestSourceCapabilityBrandInternalV1]: true;
}

export interface MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistryManifestSourceCapabilityInternalV1Input {
  /** Already transport-decoded and byte/preallocation-limited by its owner. */
  readonly externallySignedManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
}

declare const preparedRegistrySuccessorReferenceCapabilityBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityV1 {
  readonly [preparedRegistrySuccessorReferenceCapabilityBrandInternalV1]: true;
}

export interface MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1Input {
  readonly acceptanceClosureIdentity: object;
  readonly endpointObservationHost:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationHostInternalV1;
  readonly externallySignedPreparedRegistryManifestSourceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistryManifestSourceCapabilityInternalV1;
  readonly prospectiveDestinationPreparedSourceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationPreparedSourceCapabilityInternalV1;
  readonly quotaObservationHost:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1;
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1;
  readonly sideEffectAuditObserver:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditObserverInternalV1;
  readonly sourceStreamHost:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1;
  readonly verifiedLiveReferenceSchemaDigest: ContentDigestV1;
  readonly verifiedMigrationProtocolDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorBoundBuildInputInternalV1 {
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1;
  readonly preparedRegistrySuccessorReferenceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReadyBuildInputInternalV1 {
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1;
  readonly preparedRegistrySuccessorReferenceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityV1;
  readonly buildInput:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorBoundBuildInputInternalV1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticStageInternalV1 =
  | "input"
  | "pre_side_effect_closure"
  | "candidate_identity"
  | "formal_migration_id_mapping"
  | "prepared_registry_manifest"
  | "publication_prerequisite"
  | "side_effect_boundary";

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticReasonInternalV1 =
  | "schema_invalid"
  | "capability_invalid"
  | "candidate_invalid"
  | "snapshot_changed"
  | "signature_invalid"
  | "successor_invalid"
  | "side_effect_detected";

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticResultInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticStageInternalV1;
      readonly reason:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticReasonInternalV1;
    }>;

interface SignedManifestSourceContextInternalV1 {
  readonly envelope: ProviderRegistryManifestEnvelopeV1;
}

interface PreparedRegistrySuccessorContextInternalV1 {
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1;
  readonly preSideEffectPlanAdmissionClosure:
    Extract<
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticResultInternalV1,
      { readonly ok: true }
    >["value"];
  readonly preparedRegistrySuccessorFinalCapability:
    ProviderRegistryPreparedSuccessorFinalCapabilityInternalV1;
  readonly externallySignedManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly observeSideEffectSinks: () => unknown;
  readonly preAuditSnapshot:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditSnapshotInternalV1;
}

interface ClaimedBuildInputInternalV1 {
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1;
  readonly capability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityV1;
}

const signedManifestSourceContextsInternalV1 = new CapturedWeakMapV1<
  object,
  SignedManifestSourceContextInternalV1
>();
const preparedRegistrySuccessorContextsInternalV1 = new CapturedWeakMapV1<
  object,
  PreparedRegistrySuccessorContextInternalV1
>();
const readyBuildInputsInternalV1 = new CapturedWeakMapV1<
  object,
  ClaimedBuildInputInternalV1
>();
const diagnosticSignalsInternalV1 = new CapturedWeakSetV1<object>();

class PreparedRegistrySuccessorDiagnosticSignalInternalV1 extends CapturedTypeErrorV1 {
  readonly stage:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticStageInternalV1;
  readonly reason:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticReasonInternalV1;

  constructor(
    stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticStageInternalV1,
    reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticReasonInternalV1,
  ) {
    super("provider migration prepared Registry successor operation failed");
    this.name = "ProviderMigrationPreparedRegistrySuccessorDiagnosticSignalInternalV1";
    this.stage = stage;
    this.reason = reason;
    weakSetAddV1(diagnosticSignalsInternalV1, this);
    CapturedObjectFreezeV1(this);
  }
}

function failV1(
  stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticStageInternalV1,
  reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticReasonInternalV1,
): never {
  throw new PreparedRegistrySuccessorDiagnosticSignalInternalV1(stage, reason);
}

function isDiagnosticSignalV1(
  value: unknown,
): value is PreparedRegistrySuccessorDiagnosticSignalInternalV1 {
  return isObjectIdentityV1(value) &&
    weakSetHasV1(diagnosticSignalsInternalV1, value);
}

function isObjectIdentityV1(value: unknown): value is object {
  return value !== null &&
    (typeof value === "object" || typeof value === "function");
}

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

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) ===
    canonicalizeJcsSafeIntegerV1(right);
}

interface PreparedRegistrySuccessorRequestClaimsInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_prepared_registry_successor_request_reference_candidate_v1";
  readonly preSideEffectRequest: unknown;
  readonly expectedCandidateMigrationId:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1["expectedCandidateMigrationId"];
  readonly expectedPreparedRegistryManifestPin:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1["expectedPreparedRegistryManifestPin"];
}

/**
 * The package-private mint accepts a trusted transport object, but still
 * admits its outer request as exact-four own data before the nested D-41
 * request is handed to D-41's fixed-descriptor materializer.
 */
function materializeRequestClaimsV1(
  value: unknown,
): PreparedRegistrySuccessorRequestClaimsInternalV1 {
  if (!isObjectIdentityV1(value)) return failV1("input", "schema_invalid");
  const prototype = CapturedObjectGetPrototypeOfV1(value);
  if (prototype !== CapturedObjectPrototypeV1 && prototype !== null) {
    return failV1("input", "schema_invalid");
  }
  const keys = CapturedReflectOwnKeysV1(value);
  if (keys.length !== REQUEST_KEYS_V1.length) {
    return failV1("input", "schema_invalid");
  }
  for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
    const key = keys[keyIndex];
    let allowed = false;
    if (typeof key === "string") {
      for (
        let allowedIndex = 0;
        allowedIndex < REQUEST_KEYS_V1.length;
        allowedIndex += 1
      ) {
        if (key === REQUEST_KEYS_V1[allowedIndex]) {
          allowed = true;
          break;
        }
      }
    }
    if (!allowed) return failV1("input", "schema_invalid");
  }
  const fields = readKnownOwnDataFieldsV1(value, REQUEST_KEYS_V1);
  if (
    fields === undefined ||
    fields.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_prepared_registry_successor_request_reference_candidate_v1"
  ) {
    return failV1("input", "schema_invalid");
  }
  const expectedCandidateMigrationId =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1Schema.safeParse(
      fields.expectedCandidateMigrationId,
    );
  const expectedPreparedRegistryManifestPin =
    ProviderRegistryManifestPinV1Schema.safeParse(
      fields.expectedPreparedRegistryManifestPin,
    );
  if (
    !expectedCandidateMigrationId.success ||
    !expectedPreparedRegistryManifestPin.success
  ) {
    return failV1("input", "schema_invalid");
  }
  return CapturedObjectFreezeV1({
    profile: fields.profile,
    preSideEffectRequest: fields.preSideEffectRequest,
    expectedCandidateMigrationId: expectedCandidateMigrationId.data,
    expectedPreparedRegistryManifestPin:
      deepFreezeProviderPointDetachedDataTreeV1(
        expectedPreparedRegistryManifestPin.data,
      ),
  }) as PreparedRegistrySuccessorRequestClaimsInternalV1;
}

function parseAuditSnapshotV1(
  value: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditSnapshotInternalV1 {
  const fields = readKnownOwnDataFieldsV1(value, AUDIT_SINK_KEYS_V1);
  if (fields === undefined) {
    return failV1("side_effect_boundary", "side_effect_detected");
  }
  const output = CapturedObjectCreateV1(null) as Record<
    string,
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectSinkStateInternalV1
  >;
  for (let index = 0; index < AUDIT_SINK_KEYS_V1.length; index += 1) {
    const key = AUDIT_SINK_KEYS_V1[index]!;
    const sink = readKnownOwnDataFieldsV1(
      fields[key],
      AUDIT_SINK_STATE_KEYS_V1,
    );
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
  return CapturedObjectFreezeV1(output) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditSnapshotInternalV1;
}

function auditSnapshotsEqualV1(
  left: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditSnapshotInternalV1,
  right: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditSnapshotInternalV1,
): boolean {
  for (let index = 0; index < AUDIT_SINK_KEYS_V1.length; index += 1) {
    const key = AUDIT_SINK_KEYS_V1[index]!;
    if (
      left[key].revision !== right[key].revision ||
      left[key].count !== right[key].count ||
      left[key].contentDigest !== right[key].contentDigest
    ) {
      return false;
    }
  }
  return true;
}

function deriveSideEffectBoundaryV1(
  pre: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditSnapshotInternalV1,
  post: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditSnapshotInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1["sideEffectBoundary"] {
  if (!auditSnapshotsEqualV1(pre, post)) {
    return failV1("side_effect_boundary", "side_effect_detected");
  }
  for (let index = 0; index < AUDIT_SINK_KEYS_V1.length; index += 1) {
    const key = AUDIT_SINK_KEYS_V1[index]!;
    if (post[key].count - pre[key].count !== 0) {
      return failV1("side_effect_boundary", "side_effect_detected");
    }
  }
  return CapturedObjectFreezeV1({
    policy:
      "zero_side_effect_prepared_registry_successor_validation_reference_candidate_v1",
    reservationWrites: 0,
    planPublications: 0,
    acceptanceAppends: 0,
    progressAppends: 0,
    operationReceiptWrites: 0,
    destinationObjectAllocations: 0,
    quotaConsumptions: 0,
    emergencyReserveConsumptions: 0,
    pendingIntents: 0,
    rootSigningRequests: 0,
    registryManifestPublications: 0,
    catalogPublications: 0,
  });
}

function projectD41AuditSnapshotV1(
  snapshot: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditSnapshotInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditSnapshotInternalV1 {
  const projected = CapturedObjectCreateV1(null) as Record<string, unknown>;
  for (let index = 0; index < D41_AUDIT_SINK_KEYS_V1.length; index += 1) {
    const key = D41_AUDIT_SINK_KEYS_V1[index]!;
    projected[key] = snapshot[key];
  }
  return CapturedObjectFreezeV1(
    projected,
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditSnapshotInternalV1;
}

function preparedManifestPinV1(
  envelope: ProviderRegistryManifestEnvelopeV1,
) {
  return ProviderRegistryManifestPinV1Schema.parse({
    locatorProfile: "installation_provider_registry_manifest_v1",
    manifestGeneration: envelope.payload.manifestGeneration,
    generationId: envelope.generationId,
    contentDigest: envelope.contentDigest,
  });
}

/**
 * Adapter for an envelope already decoded, bounded, and obtained from an
 * offline trusted signer.  This function verifies no signing key and stores
 * no signing capability.
 */
export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistryManifestSourceCapabilityInternalV1(
  input: MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistryManifestSourceCapabilityInternalV1Input,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistryManifestSourceCapabilityInternalV1 {
  const fields = readKnownOwnDataFieldsV1(
    input,
    SIGNED_MANIFEST_SOURCE_INPUT_KEYS_V1,
  );
  if (fields === undefined) {
    throw new CapturedTypeErrorV1(
      "trusted prepared Registry Manifest source input invalid",
    );
  }
  const envelope = deepFreezeProviderPointDetachedDataTreeV1(
    ProviderRegistryManifestEnvelopeV1Schema.parse(
      fields.externallySignedManifestEnvelope,
    ),
  ) as ProviderRegistryManifestEnvelopeV1;
  const capability = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistryManifestSourceCapabilityInternalV1;
  weakMapSetV1(signedManifestSourceContextsInternalV1, capability, {
    envelope,
  });
  return capability;
}

function takeSignedManifestSourceV1(
  capability: unknown,
): ProviderRegistryManifestEnvelopeV1 {
  if (!isObjectIdentityV1(capability)) {
    return failV1("prepared_registry_manifest", "capability_invalid");
  }
  const context = weakMapGetV1(
    signedManifestSourceContextsInternalV1,
    capability,
  );
  if (
    context === undefined ||
    !weakMapDeleteV1(signedManifestSourceContextsInternalV1, capability)
  ) {
    return failV1("prepared_registry_manifest", "capability_invalid");
  }
  return context.envelope;
}

function closeFailedMintAuditV1(
  observeSideEffectSinks: (() => unknown) | undefined,
  preAuditSnapshot:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditSnapshotInternalV1
    | undefined,
): void {
  if (observeSideEffectSinks === undefined || preAuditSnapshot === undefined) {
    return;
  }
  const post = parseAuditSnapshotV1(observeSideEffectSinks());
  if (!auditSnapshotsEqualV1(preAuditSnapshot, post)) {
    return failV1("side_effect_boundary", "side_effect_detected");
  }
}

async function mintPreparedRegistrySuccessorCapabilityPreparedInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReadyBuildInputInternalV1> {
  let observeSideEffectSinks: (() => unknown) | undefined;
  let preAuditSnapshot:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditSnapshotInternalV1
    | undefined;
  let continuationIntent:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1 | undefined;
  let preSideEffectPlanAdmissionClosure:
    PreparedRegistrySuccessorContextInternalV1["preSideEffectPlanAdmissionClosure"] | undefined;
  let finalCapability:
    ProviderRegistryPreparedSuccessorFinalCapabilityInternalV1 | undefined;
  let finalCapabilityTransferred = false;
  let nestedD41AuditObserverFailed = false;
  try {
    const fields = readKnownOwnDataFieldsV1(input, MINT_INPUT_KEYS_V1);
    if (fields === undefined) return failV1("input", "schema_invalid");
    const observerFields = readKnownOwnDataFieldsV1(
      fields.sideEffectAuditObserver,
      AUDIT_OBSERVER_KEYS_V1,
    );
    if (
      observerFields === undefined ||
      typeof observerFields.observeSideEffectSinks !== "function"
    ) {
      return failV1("input", "schema_invalid");
    }
    observeSideEffectSinks = observerFields.observeSideEffectSinks as () => unknown;
    try {
      preAuditSnapshot = parseAuditSnapshotV1(observeSideEffectSinks());
    } catch {
      return failV1("side_effect_boundary", "side_effect_detected");
    }

    const requestClaims = materializeRequestClaimsV1(fields.request);
    const externallySignedManifestEnvelope = takeSignedManifestSourceV1(
      fields.externallySignedPreparedRegistryManifestSourceCapability,
    );
    if (
      !canonicalEqualV1(
        preparedManifestPinV1(externallySignedManifestEnvelope),
        requestClaims.expectedPreparedRegistryManifestPin,
      )
    ) {
      return failV1("prepared_registry_manifest", "successor_invalid");
    }

    continuationIntent =
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1();
    const d41AuditObserver = CapturedObjectFreezeV1({
      observeSideEffectSinks: CapturedObjectFreezeV1(() => {
        try {
          return projectD41AuditSnapshotV1(
            parseAuditSnapshotV1(observeSideEffectSinks!()),
          );
        } catch (error) {
          nestedD41AuditObserverFailed = true;
          throw error;
        }
      }),
    }) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditObserverInternalV1;
    const d41Ready =
      await mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityInternalV1({
        acceptanceClosureIdentity: fields.acceptanceClosureIdentity,
        endpointObservationHost: fields.endpointObservationHost,
        prospectiveDestinationPreparedSourceCapability:
          fields.prospectiveDestinationPreparedSourceCapability,
        quotaObservationHost: fields.quotaObservationHost,
        request: requestClaims.preSideEffectRequest,
        sideEffectAuditObserver: d41AuditObserver,
        sourceStreamHost: fields.sourceStreamHost,
        verifiedLiveReferenceSchemaDigest:
          fields.verifiedLiveReferenceSchemaDigest,
        verifiedMigrationProtocolDigest:
          fields.verifiedMigrationProtocolDigest,
      });
    registerProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1(
      d41Ready.prePlanReferenceCapability,
      continuationIntent,
    );
    const d41Result =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
        d41Ready.buildInput,
      );
    if (!d41Result.ok) {
      if (nestedD41AuditObserverFailed) {
        return failV1("side_effect_boundary", "side_effect_detected");
      }
      return failV1("pre_side_effect_closure", "candidate_invalid");
    }
    preSideEffectPlanAdmissionClosure = d41Result.value;
    if (
      preSideEffectPlanAdmissionClosure.migrationId !==
      requestClaims.expectedCandidateMigrationId
    ) {
      return failV1("candidate_identity", "candidate_invalid");
    }
    const request = deepFreezeProviderPointDetachedDataTreeV1(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1Schema.parse({
        profile: requestClaims.profile,
        preSideEffectRequest: d41Ready.request,
        expectedCandidateMigrationId:
          requestClaims.expectedCandidateMigrationId,
        expectedPreparedRegistryManifestPin:
          requestClaims.expectedPreparedRegistryManifestPin,
      }),
    ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1;
    finalCapability =
      takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorFinalCapabilityInternalV1(
        continuationIntent,
        preSideEffectPlanAdmissionClosure,
      );
    if (finalCapability === undefined) {
      return failV1("pre_side_effect_closure", "capability_invalid");
    }

    const capability = CapturedObjectFreezeV1(
      CapturedObjectCreateV1(null),
    ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityV1;
    const claimedBuildInput = CapturedObjectFreezeV1({
      request,
      capability,
    });
    const buildInput = createProviderNonThenableFrozenRecordV1({
      request,
      preparedRegistrySuccessorReferenceCapability: capability,
    }) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorBoundBuildInputInternalV1;
    const ready = createProviderNonThenableFrozenRecordV1({
      request,
      preparedRegistrySuccessorReferenceCapability: capability,
      buildInput,
    });
    weakMapSetV1(preparedRegistrySuccessorContextsInternalV1, capability, {
      request,
      preSideEffectPlanAdmissionClosure,
      preparedRegistrySuccessorFinalCapability: finalCapability,
      externallySignedManifestEnvelope,
      observeSideEffectSinks,
      preAuditSnapshot,
    });
    weakMapSetV1(readyBuildInputsInternalV1, buildInput, claimedBuildInput);
    finalCapabilityTransferred = true;
    return ready;
  } catch (error) {
    if (
      !finalCapabilityTransferred &&
      finalCapability !== undefined &&
      preSideEffectPlanAdmissionClosure !== undefined
    ) {
      try {
        discardProviderRegistryPreparedSuccessorFinalInternalV1(
          preSideEffectPlanAdmissionClosure,
          finalCapability,
        );
      } catch {
        // The opaque diagnostic below remains intentionally non-specific.
      }
    }
    if (continuationIntent !== undefined) {
      try {
        discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1(
          continuationIntent,
        );
      } catch {
        // The opaque diagnostic below remains intentionally non-specific.
      }
    }
    try {
      closeFailedMintAuditV1(observeSideEffectSinks, preAuditSnapshot);
    } catch {
      return failV1("side_effect_boundary", "side_effect_detected");
    }
    if (nestedD41AuditObserverFailed) {
      return failV1("side_effect_boundary", "side_effect_detected");
    }
    if (isDiagnosticSignalV1(error)) throw error;
    return failV1("input", "schema_invalid");
  }
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReadyBuildInputInternalV1> {
  return hardenProviderPointPromiseV1(
    mintPreparedRegistrySuccessorCapabilityPreparedInternalV1(input),
  );
}

function takeBuildContextV1(
  input: unknown,
): PreparedRegistrySuccessorContextInternalV1 {
  if (!isObjectIdentityV1(input)) return failV1("input", "schema_invalid");
  const claimed = weakMapGetV1(readyBuildInputsInternalV1, input);
  if (
    claimed === undefined ||
    !weakMapDeleteV1(readyBuildInputsInternalV1, input)
  ) {
    return failV1("input", "schema_invalid");
  }
  const context = weakMapGetV1(
    preparedRegistrySuccessorContextsInternalV1,
    claimed.capability,
  );
  if (
    context === undefined ||
    !weakMapDeleteV1(
      preparedRegistrySuccessorContextsInternalV1,
      claimed.capability,
    )
  ) {
    return failV1("input", "capability_invalid");
  }
  return context;
}

function failureResultV1(
  stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticStageInternalV1,
  reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticReasonInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticResultInternalV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
  });
}

function successResultV1(
  value: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticResultInternalV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: true as const,
    value,
  });
}

function publicationPrerequisiteV1(
  context: PreparedRegistrySuccessorContextInternalV1,
  formalMigrationId: ReturnType<
    typeof deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalMigrationIdMappingV1
  >["formalMigrationId"],
) {
  const d41 = context.preSideEffectPlanAdmissionClosure;
  return CapturedObjectFreezeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_plan_publication_prerequisite_reference_candidate_v1" as const,
    state: "locked_awaiting_formal_catalog_direct_successor" as const,
    formalMigrationId,
    candidatePlanContentDigest: d41.planCandidate.contentDigest,
    admissionVectorDigest: d41.admissionVectorDigest,
    journalAuthorityInstallationIdentityGenerationId:
      d41.planCandidate.payload
        .journalAuthorityInstallationIdentityGenerationId,
    intendedOperation: {
      operation: "compare_reserve" as const,
      role: "same_identity_journal" as const,
      publicationKind: "publish_same_identity_plan_atomically" as const,
    },
    futureFormalPlanRule: {
      candidateToFormalMapping: "complete_mapping_record_required_v1" as const,
      formalPlanDigestCoverage:
        "must_cover_complete_mapping_and_deterministic_reservation_descriptor_v1" as const,
      reservationRecordAndTokenBinding:
        "only_after_formal_plan_content_digest_v1" as const,
      candidatePlanDisposition:
        "d41_candidate_plan_is_not_a_formal_plan_v1" as const,
      futureNoReplacePublication:
        "must_revalidate_live_current_tip_and_publish_atomically_in_later_gate_v1" as const,
    },
    atomicity: {
      reservationAndPublication: "all_or_none_v1" as const,
      sameNonceSameRequest:
        "return_byte_identical_first_operation_receipt_v1" as const,
      sameNonceDifferentRequest: "zero_write_reject_v1" as const,
    },
  });
}

async function diagnosePreparedRegistrySuccessorV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticResultInternalV1> {
  let context: PreparedRegistrySuccessorContextInternalV1;
  try {
    context = takeBuildContextV1(input);
  } catch (error) {
    const diagnostic = isDiagnosticSignalV1(error)
      ? error
      : new PreparedRegistrySuccessorDiagnosticSignalInternalV1(
          "input",
          "schema_invalid",
        );
    return failureResultV1(diagnostic.stage, diagnostic.reason);
  }

  let result:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticResultInternalV1
    | undefined;
  let intermediateAudit:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditSnapshotInternalV1
    | undefined;
  try {
    try {
      const mapping =
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalMigrationIdMappingV1(
          context.preSideEffectPlanAdmissionClosure.migrationId,
        );
      const registry =
        await diagnoseProviderRegistryPreparedDirectSuccessorInternalV1(
          context.preSideEffectPlanAdmissionClosure,
          context.preparedRegistrySuccessorFinalCapability,
          {
            formalMigrationId: mapping.formalMigrationId,
            externallySignedManifestEnvelope:
              context.externallySignedManifestEnvelope,
          },
        );
      if (!registry.ok) {
        return failV1(
          "prepared_registry_manifest",
          registry.stage === "manifest_signature"
            ? "signature_invalid"
            : "successor_invalid",
        );
      }
      if (
        registry.value.authority !== "none" ||
        registry.value.validationScope !==
          "direct_successor_of_retained_steady_tip_not_current_or_published" ||
        registry.value.formalMigrationId !== mapping.formalMigrationId ||
        registry.value.installationIdentityGenerationId !==
          context.preSideEffectPlanAdmissionClosure.sourceTrust
            .installationIdentityGenerationId ||
        registry.value.sourceProviderId !==
          context.preSideEffectPlanAdmissionClosure.sourceTrust
            .currentWriterSelection.providerId ||
        registry.value.destinationProviderId !==
          context.preSideEffectPlanAdmissionClosure.destinationTrust
            .prospectiveWriterProjection.providerId ||
        !canonicalEqualV1(
          registry.value.retainedSteadyTipRegistryManifest,
          context.preSideEffectPlanAdmissionClosure.destinationTrust
            .authorization.prospectiveDestinationCut
            .currentSteadyRegistryManifestPin,
        ) ||
        !canonicalEqualV1(
          registry.value.preparedDirectSuccessorRegistryManifest,
          context.request.expectedPreparedRegistryManifestPin,
        ) ||
        registry.value.retainedPrefixIdentityPreserved !== true ||
        registry.value.externallySignedEnvelopeIdentityPreserved !== true ||
        registry.value.copiedRetainedStateCollectionCount !== 7 ||
        registry.value.retainedStateCopyOperationCount !== 1 ||
        registry.value.registryManifestPublicationCount !== 0 ||
        registry.value.retainedStateMutationCount !== 0
      ) {
        return failV1("prepared_registry_manifest", "successor_invalid");
      }
      try {
        intermediateAudit = parseAuditSnapshotV1(
          context.observeSideEffectSinks(),
        );
      } catch {
        return failV1("side_effect_boundary", "side_effect_detected");
      }
      const sideEffectBoundary = deriveSideEffectBoundaryV1(
        context.preAuditSnapshot,
        intermediateAudit,
      );
      const unsigned = {
        authority:
          "none_provider_migration_same_installation_identity_current_strong_source_normal_prepared_registry_successor_reference_candidate_only" as const,
        profile:
          "provider_migration_same_installation_identity_current_strong_source_normal_prepared_registry_successor_reference_candidate_v1" as const,
        stopPoint:
          "after_external_root_signed_prepared_registry_direct_successor_validation_before_registry_manifest_publication" as const,
        preSideEffectPlanAdmissionClosure:
          context.preSideEffectPlanAdmissionClosure,
        formalMigrationIdMapping: mapping,
        currentSteadyRegistryManifestPin:
          registry.value.retainedSteadyTipRegistryManifest,
        preparedRegistryManifestEnvelope:
          context.externallySignedManifestEnvelope,
        preparedRegistryManifestPin:
          registry.value.preparedDirectSuccessorRegistryManifest,
        publicationPrerequisite: publicationPrerequisiteV1(
          context,
          mapping.formalMigrationId,
        ),
        publicationGate: {
          profile:
            "provider_migration_same_installation_identity_current_strong_source_normal_publication_gate_reference_candidate_v1" as const,
          state: "locked_awaiting_formal_catalog_direct_successor" as const,
          formalIdMapping: "verified" as const,
          preparedRegistryDirectSuccessor: "verified_not_published" as const,
          formalCatalogDirectSuccessor: "none" as const,
          formalDestinationTrust: "none" as const,
          requiredNext: "formal_catalog_direct_successor" as const,
          formalPlan: "none" as const,
          formalPlanPin: "none" as const,
          reservationRecords: "none" as const,
          reservationTokens: "none" as const,
          planPublication: "none" as const,
        },
        sideEffectBoundary,
        verificationBoundary: {
          d41PreSideEffectClosure:
            "complete_embedded_public_hash_dag_and_same_cohort_opaque_evidence_v1" as const,
          formalMigrationIdMapping:
            "cycle_free_public_projection_recomputable_v1" as const,
          currentRegistryContinuity:
            "same_cohort_opaque_retained_registry_history_direct_successor_v1" as const,
          preparedRegistrySignature:
            "externally_root_signed_and_verified_against_retained_active_root_v1" as const,
          preparedRegistryRelationship:
            "root_signed_direct_successor_of_same_cohort_retained_steady_tip_candidate_not_current_or_published_v1" as const,
          rootSigningAuthority:
            "external_signature_verification_only_no_signer_capability_v1" as const,
          formalCatalogDirectSuccessor: "none" as const,
          formalDestinationTrust: "none" as const,
          formalPlan: "none" as const,
          formalPlanPin: "none" as const,
          reservationRecords: "none" as const,
          reservationTokens: "none" as const,
          planPublication: "none" as const,
          providerAuthority: "none" as const,
          durability: "none" as const,
          migrationExecution: "none" as const,
        },
      };
      const candidate = {
        ...unsigned,
        closureContentDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorClosureContentDigestV1(
            unsigned,
          ),
      };
      result = successResultV1(
        validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateV1(
          candidate,
        ),
      );
    } catch (error) {
      const diagnostic = isDiagnosticSignalV1(error)
        ? error
        : new PreparedRegistrySuccessorDiagnosticSignalInternalV1(
            "prepared_registry_manifest",
            "successor_invalid",
          );
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
  }
  return result ??
    failureResultV1("prepared_registry_manifest", "successor_invalid");
}

export function diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorDiagnosticResultInternalV1> {
  return hardenProviderPointPromiseV1(
    diagnosePreparedRegistrySuccessorV1(input),
  );
}

CapturedObjectFreezeV1(
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistryManifestSourceCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1,
);
