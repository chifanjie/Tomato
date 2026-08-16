/**
 * Package-private D-43 prepared Catalog direct-successor orchestrator.
 *
 * The outer twelve-sink audit starts before the signed Catalog source is
 * claimed and spans one complete fresh D-42 operation, the private D-42 ->
 * D-43 continuation, Catalog validation, candidate finalization, and cleanup.
 */

import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  type ContentDigestV1,
} from "./primitives.js";
import {
  ProviderFeasibilitySupportCatalogEnvelopeV1Schema,
  ProviderFeasibilitySupportCatalogPinV1Schema,
  deriveProviderFeasibilitySupportCatalogPinV1,
  type ProviderFeasibilitySupportCatalogEnvelopeV1,
} from "./provider-feasibility-support-catalog-point.js";
import {
  diagnoseProviderFeasibilitySupportCatalogPreparedDirectSuccessorInternalV1,
} from "./provider-feasibility-support-catalog-prepared-successor-internal.js";
import {
  discardProviderFeasibilitySupportCatalogPreparedSuccessorFinalInternalV1,
  type ProviderFeasibilitySupportCatalogPreparedSuccessorFinalCapabilityInternalV1,
} from "./provider-feasibility-support-catalog-prepared-successor-handle-internal.js";
import {
  discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1,
  registerProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorFinalCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-catalog-successor-continuation-internal.js";
import {
  bindProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationToFinalCandidateInternalV1,
  discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-continuation-internal.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1Schema,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorClosureContentDigestV1,
  validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-catalog-successor-reference-candidate-wire.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1,
  type MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1Input,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditObserverInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-capability-internal.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate-wire.js";
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
  "externallySignedPreparedCatalogSourceCapability",
  "externallySignedPreparedRegistryManifestSourceCapability",
  "prospectiveDestinationPreparedSourceCapability",
  "quotaObservationHost",
  "request",
  "sideEffectAuditObserver",
  "sourceStreamHost",
  "verifiedLiveReferenceSchemaDigest",
  "verifiedMigrationProtocolDigest",
] as const);
const REQUEST_KEYS_V1 = CapturedObjectFreezeV1([
  "profile",
  "preparedRegistrySuccessorRequest",
  "expectedPreparedCatalogPin",
] as const);
const SIGNED_CATALOG_SOURCE_KEYS_V1 = CapturedObjectFreezeV1([
  "externallySignedCatalogEnvelope",
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
const AUDIT_SINK_STATE_KEYS_V1 = CapturedObjectFreezeV1([
  "contentDigest",
  "count",
  "revision",
] as const);

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorSideEffectSinkStateInternalV1 {
  readonly revision: number;
  readonly count: number;
  readonly contentDigest: ContentDigestV1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorSideEffectAuditSnapshotInternalV1 =
  Readonly<
    Record<
      (typeof AUDIT_SINK_KEYS_V1)[number],
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorSideEffectSinkStateInternalV1
    >
  >;

declare const externallySignedPreparedCatalogSourceCapabilityBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedCatalogSourceCapabilityInternalV1 {
  readonly [externallySignedPreparedCatalogSourceCapabilityBrandInternalV1]: true;
}

export interface MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedCatalogSourceCapabilityInternalV1Input {
  readonly externallySignedCatalogEnvelope: ProviderFeasibilitySupportCatalogEnvelopeV1;
}

declare const preparedCatalogSuccessorReferenceCapabilityBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityV1 {
  readonly [preparedCatalogSuccessorReferenceCapabilityBrandInternalV1]: true;
}

export interface MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityInternalV1Input
  extends Omit<
    MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1Input,
    "request"
  > {
  readonly externallySignedPreparedCatalogSourceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedCatalogSourceCapabilityInternalV1;
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorBoundBuildInputInternalV1 {
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1;
  readonly preparedCatalogSuccessorReferenceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReadyBuildInputInternalV1 {
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1;
  readonly preparedCatalogSuccessorReferenceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityV1;
  readonly buildInput:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorBoundBuildInputInternalV1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticStageInternalV1 =
  | "input"
  | "prepared_registry_successor"
  | "prepared_catalog_successor"
  | "publication_prerequisite"
  | "side_effect_boundary";

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticReasonInternalV1 =
  | "schema_invalid"
  | "capability_invalid"
  | "candidate_invalid"
  | "signature_invalid"
  | "successor_invalid"
  | "side_effect_detected";

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticResultInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticStageInternalV1;
      readonly reason:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticReasonInternalV1;
    }>;

interface SignedCatalogSourceContextInternalV1 {
  readonly envelope: ProviderFeasibilitySupportCatalogEnvelopeV1;
}

interface PreparedCatalogSuccessorContextInternalV1 {
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1;
  readonly preparedRegistrySuccessorClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1;
  readonly preparedCatalogSuccessorFinalCapability:
    ProviderFeasibilitySupportCatalogPreparedSuccessorFinalCapabilityInternalV1;
  readonly externallySignedCatalogEnvelope:
    ProviderFeasibilitySupportCatalogEnvelopeV1;
  readonly observeSideEffectSinks: () => unknown;
  readonly preAuditSnapshot:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorSideEffectAuditSnapshotInternalV1;
}

interface ClaimedBuildInputInternalV1 {
  readonly capability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityV1;
}

const signedCatalogSourceContextsInternalV1 = new CapturedWeakMapV1<
  object,
  SignedCatalogSourceContextInternalV1
>();
const preparedCatalogSuccessorContextsInternalV1 = new CapturedWeakMapV1<
  object,
  PreparedCatalogSuccessorContextInternalV1
>();
const readyBuildInputsInternalV1 = new CapturedWeakMapV1<
  object,
  ClaimedBuildInputInternalV1
>();
const diagnosticSignalsInternalV1 = new CapturedWeakSetV1<object>();

class PreparedCatalogSuccessorDiagnosticSignalInternalV1 extends CapturedTypeErrorV1 {
  readonly stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticStageInternalV1;
  readonly reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticReasonInternalV1;

  constructor(
    stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticStageInternalV1,
    reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticReasonInternalV1,
  ) {
    super("provider migration prepared Catalog successor operation failed");
    this.name = "ProviderMigrationPreparedCatalogSuccessorDiagnosticSignalInternalV1";
    this.stage = stage;
    this.reason = reason;
    weakSetAddV1(diagnosticSignalsInternalV1, this);
    CapturedObjectFreezeV1(this);
  }
}

function failV1(
  stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticStageInternalV1,
  reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticReasonInternalV1,
): never {
  throw new PreparedCatalogSuccessorDiagnosticSignalInternalV1(stage, reason);
}

function isDiagnosticSignalV1(
  value: unknown,
): value is PreparedCatalogSuccessorDiagnosticSignalInternalV1 {
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

function readExactOwnDataFieldsV1(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (!isObjectIdentityV1(value)) return undefined;
  const prototype = CapturedObjectGetPrototypeOfV1(value);
  if (prototype !== CapturedObjectPrototypeV1 && prototype !== null) {
    return undefined;
  }
  const keys = CapturedReflectOwnKeysV1(value);
  if (keys.length !== expectedKeys.length) return undefined;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    let allowed = false;
    if (typeof key === "string") {
      for (
        let expectedIndex = 0;
        expectedIndex < expectedKeys.length;
        expectedIndex += 1
      ) {
        if (key === expectedKeys[expectedIndex]) {
          allowed = true;
          break;
        }
      }
    }
    if (!allowed) return undefined;
  }
  return readKnownOwnDataFieldsV1(value, expectedKeys);
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) ===
    canonicalizeJcsSafeIntegerV1(right);
}

function parseAuditSnapshotV1(
  value: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorSideEffectAuditSnapshotInternalV1 {
  const fields = readKnownOwnDataFieldsV1(value, AUDIT_SINK_KEYS_V1);
  if (fields === undefined) {
    return failV1("side_effect_boundary", "side_effect_detected");
  }
  const output = CapturedObjectCreateV1(null) as Record<
    string,
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorSideEffectSinkStateInternalV1
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
  return CapturedObjectFreezeV1(output) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorSideEffectAuditSnapshotInternalV1;
}

function auditSnapshotsEqualV1(
  left: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorSideEffectAuditSnapshotInternalV1,
  right: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorSideEffectAuditSnapshotInternalV1,
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
  pre: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorSideEffectAuditSnapshotInternalV1,
  post: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorSideEffectAuditSnapshotInternalV1,
) {
  if (!auditSnapshotsEqualV1(pre, post)) {
    return failV1("side_effect_boundary", "side_effect_detected");
  }
  return CapturedObjectFreezeV1({
    policy:
      "zero_side_effect_prepared_catalog_successor_validation_reference_candidate_v1" as const,
    reservationWrites: 0 as const,
    planPublications: 0 as const,
    acceptanceAppends: 0 as const,
    progressAppends: 0 as const,
    operationReceiptWrites: 0 as const,
    destinationObjectAllocations: 0 as const,
    quotaConsumptions: 0 as const,
    emergencyReserveConsumptions: 0 as const,
    pendingIntents: 0 as const,
    rootSigningRequests: 0 as const,
    registryManifestPublications: 0 as const,
    catalogPublications: 0 as const,
  });
}

function materializeRequestClaimsV1(value: unknown): Readonly<{
  profile: "provider_migration_same_installation_identity_current_strong_source_normal_prepared_catalog_successor_request_reference_candidate_v1";
  preparedRegistrySuccessorRequest: unknown;
  expectedPreparedCatalogPin: ReturnType<typeof ProviderFeasibilitySupportCatalogPinV1Schema.parse>;
}> {
  const fields = readExactOwnDataFieldsV1(value, REQUEST_KEYS_V1);
  if (
    fields === undefined ||
    fields.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_prepared_catalog_successor_request_reference_candidate_v1"
  ) {
    return failV1("input", "schema_invalid");
  }
  const pin = ProviderFeasibilitySupportCatalogPinV1Schema.safeParse(
    fields.expectedPreparedCatalogPin,
  );
  if (!pin.success) return failV1("input", "schema_invalid");
  return CapturedObjectFreezeV1({
    profile: fields.profile,
    preparedRegistrySuccessorRequest:
      fields.preparedRegistrySuccessorRequest,
    expectedPreparedCatalogPin: deepFreezeProviderPointDetachedDataTreeV1(
      pin.data,
    ),
  });
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedCatalogSourceCapabilityInternalV1(
  input: MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedCatalogSourceCapabilityInternalV1Input,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedCatalogSourceCapabilityInternalV1 {
  const fields = readExactOwnDataFieldsV1(
    input,
    SIGNED_CATALOG_SOURCE_KEYS_V1,
  );
  if (fields === undefined) {
    throw new CapturedTypeErrorV1("trusted prepared Catalog source input invalid");
  }
  const envelope = deepFreezeProviderPointDetachedDataTreeV1(
    ProviderFeasibilitySupportCatalogEnvelopeV1Schema.parse(
      fields.externallySignedCatalogEnvelope,
    ),
  );
  const capability = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedCatalogSourceCapabilityInternalV1;
  weakMapSetV1(signedCatalogSourceContextsInternalV1, capability, { envelope });
  return capability;
}

function takeSignedCatalogSourceV1(
  capability: unknown,
): ProviderFeasibilitySupportCatalogEnvelopeV1 {
  if (!isObjectIdentityV1(capability)) {
    return failV1("prepared_catalog_successor", "capability_invalid");
  }
  const context = weakMapGetV1(signedCatalogSourceContextsInternalV1, capability);
  if (
    context === undefined ||
    !weakMapDeleteV1(signedCatalogSourceContextsInternalV1, capability)
  ) {
    return failV1("prepared_catalog_successor", "capability_invalid");
  }
  return context.envelope;
}

function closeFailedMintAuditV1(
  observeSideEffectSinks: (() => unknown) | undefined,
  preAuditSnapshot:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorSideEffectAuditSnapshotInternalV1
    | undefined,
): void {
  if (observeSideEffectSinks === undefined || preAuditSnapshot === undefined) return;
  const post = parseAuditSnapshotV1(observeSideEffectSinks());
  if (!auditSnapshotsEqualV1(preAuditSnapshot, post)) {
    return failV1("side_effect_boundary", "side_effect_detected");
  }
}

async function mintPreparedCatalogSuccessorCapabilityPreparedInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReadyBuildInputInternalV1> {
  let observeSideEffectSinks: (() => unknown) | undefined;
  let preAuditSnapshot:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorSideEffectAuditSnapshotInternalV1
    | undefined;
  let continuationIntent:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1
    | undefined;
  let d42Candidate:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1
    | undefined;
  let finalCapability:
    | ProviderFeasibilitySupportCatalogPreparedSuccessorFinalCapabilityInternalV1
    | undefined;
  let finalCapabilityTransferred = false;
  try {
    const fields = readExactOwnDataFieldsV1(input, MINT_INPUT_KEYS_V1);
    if (fields === undefined) return failV1("input", "schema_invalid");
    const observerFields = readExactOwnDataFieldsV1(
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
    preAuditSnapshot = parseAuditSnapshotV1(observeSideEffectSinks());
    const requestClaims = materializeRequestClaimsV1(fields.request);
    const externallySignedCatalogEnvelope = takeSignedCatalogSourceV1(
      fields.externallySignedPreparedCatalogSourceCapability,
    );
    if (
      !canonicalEqualV1(
        deriveProviderFeasibilitySupportCatalogPinV1(
          externallySignedCatalogEnvelope,
        ),
        requestClaims.expectedPreparedCatalogPin,
      )
    ) {
      return failV1("prepared_catalog_successor", "successor_invalid");
    }

    continuationIntent =
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1();
    const d42Ready =
      await mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1({
        acceptanceClosureIdentity: fields.acceptanceClosureIdentity,
        endpointObservationHost: fields.endpointObservationHost,
        externallySignedPreparedRegistryManifestSourceCapability:
          fields.externallySignedPreparedRegistryManifestSourceCapability,
        prospectiveDestinationPreparedSourceCapability:
          fields.prospectiveDestinationPreparedSourceCapability,
        quotaObservationHost: fields.quotaObservationHost,
        request: requestClaims.preparedRegistrySuccessorRequest,
        sideEffectAuditObserver:
          fields.sideEffectAuditObserver as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditObserverInternalV1,
        sourceStreamHost: fields.sourceStreamHost,
        verifiedLiveReferenceSchemaDigest:
          fields.verifiedLiveReferenceSchemaDigest,
        verifiedMigrationProtocolDigest:
          fields.verifiedMigrationProtocolDigest,
      });
    registerProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1(
      d42Ready.preparedRegistrySuccessorReferenceCapability,
      continuationIntent,
    );
    const d42Result =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1(
        d42Ready.buildInput,
      );
    if (!d42Result.ok) {
      return failV1(
        d42Result.stage === "side_effect_boundary"
          ? "side_effect_boundary"
          : "prepared_registry_successor",
        d42Result.stage === "side_effect_boundary"
          ? "side_effect_detected"
          : "candidate_invalid",
      );
    }
    d42Candidate = d42Result.value;
    finalCapability =
      takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorFinalCapabilityInternalV1(
        continuationIntent,
        d42Candidate,
      );
    if (finalCapability === undefined) {
      return failV1("prepared_registry_successor", "capability_invalid");
    }
    const request = deepFreezeProviderPointDetachedDataTreeV1(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1Schema.parse({
        profile: requestClaims.profile,
        preparedRegistrySuccessorRequest: d42Ready.request,
        expectedPreparedCatalogPin: requestClaims.expectedPreparedCatalogPin,
      }),
    );
    const capability = CapturedObjectFreezeV1(
      CapturedObjectCreateV1(null),
    ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityV1;
    const buildInput = createProviderNonThenableFrozenRecordV1({
      request,
      preparedCatalogSuccessorReferenceCapability: capability,
    }) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorBoundBuildInputInternalV1;
    const ready = createProviderNonThenableFrozenRecordV1({
      request,
      preparedCatalogSuccessorReferenceCapability: capability,
      buildInput,
    });
    weakMapSetV1(preparedCatalogSuccessorContextsInternalV1, capability, {
      request,
      preparedRegistrySuccessorClosure: d42Candidate,
      preparedCatalogSuccessorFinalCapability: finalCapability,
      externallySignedCatalogEnvelope,
      observeSideEffectSinks,
      preAuditSnapshot,
    });
    weakMapSetV1(readyBuildInputsInternalV1, buildInput, { capability });
    finalCapabilityTransferred = true;
    return ready;
  } catch (error) {
    if (
      !finalCapabilityTransferred &&
      finalCapability !== undefined &&
      d42Candidate !== undefined
    ) {
      try {
        discardProviderFeasibilitySupportCatalogPreparedSuccessorFinalInternalV1(
          d42Candidate,
          finalCapability,
        );
      } catch {
        // The opaque diagnostic below remains intentionally non-specific.
      }
    }
    if (continuationIntent !== undefined) {
      try {
        discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1(
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
    if (isDiagnosticSignalV1(error)) throw error;
    return failV1("input", "schema_invalid");
  }
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReadyBuildInputInternalV1> {
  return hardenProviderPointPromiseV1(
    mintPreparedCatalogSuccessorCapabilityPreparedInternalV1(input),
  );
}

function takeBuildContextV1(
  input: unknown,
): Readonly<{
  context: PreparedCatalogSuccessorContextInternalV1;
  continuationIntent:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1 | undefined;
}> {
  if (!isObjectIdentityV1(input)) return failV1("input", "schema_invalid");
  const claimed = weakMapGetV1(readyBuildInputsInternalV1, input);
  if (
    claimed === undefined ||
    !weakMapDeleteV1(readyBuildInputsInternalV1, input)
  ) {
    return failV1("input", "schema_invalid");
  }
  const context = weakMapGetV1(
    preparedCatalogSuccessorContextsInternalV1,
    claimed.capability,
  );
  if (
    context === undefined ||
    !weakMapDeleteV1(
      preparedCatalogSuccessorContextsInternalV1,
      claimed.capability,
    )
  ) {
    return failV1("input", "capability_invalid");
  }
  const continuationIntent =
    takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1(
      claimed.capability,
    );
  return CapturedObjectFreezeV1({ context, continuationIntent });
}

function failureResultV1(
  stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticStageInternalV1,
  reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticReasonInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticResultInternalV1 {
  return createProviderNonThenableFrozenRecordV1({ ok: false as const, stage, reason });
}

function successResultV1(
  value: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticResultInternalV1 {
  return createProviderNonThenableFrozenRecordV1({ ok: true as const, value });
}

function publicationPrerequisiteV1(
  context: PreparedCatalogSuccessorContextInternalV1,
  currentSupportCatalogPin: unknown,
  preparedSupportCatalogPin: unknown,
) {
  const d42 = context.preparedRegistrySuccessorClosure;
  const prerequisite = d42.publicationPrerequisite;
  return CapturedObjectFreezeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_prepared_catalog_successor_publication_prerequisite_reference_candidate_v1" as const,
    state: "locked_awaiting_formal_destination_trust_and_plan" as const,
    formalMigrationId: prerequisite.formalMigrationId,
    candidatePlanContentDigest: prerequisite.candidatePlanContentDigest,
    admissionVectorDigest: prerequisite.admissionVectorDigest,
    journalAuthorityInstallationIdentityGenerationId:
      prerequisite.journalAuthorityInstallationIdentityGenerationId,
    intendedOperation: prerequisite.intendedOperation,
    futureFormalPlanRule: prerequisite.futureFormalPlanRule,
    atomicity: prerequisite.atomicity,
    preparedRegistryManifestPin: d42.preparedRegistryManifestPin,
    currentSupportCatalogPin,
    preparedSupportCatalogPin,
    futureFormalPlanBinding:
      "must_bind_complete_d43_closure_digest_and_exact_registry_catalog_pins_v1" as const,
  });
}

async function diagnosePreparedCatalogSuccessorV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticResultInternalV1> {
  let context: PreparedCatalogSuccessorContextInternalV1;
  let continuationIntent:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1 | undefined;
  try {
    ({ context, continuationIntent } = takeBuildContextV1(input));
  } catch (error) {
    const diagnostic = isDiagnosticSignalV1(error)
      ? error
      : new PreparedCatalogSuccessorDiagnosticSignalInternalV1(
          "input",
          "schema_invalid",
        );
    return failureResultV1(diagnostic.stage, diagnostic.reason);
  }
  let result:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticResultInternalV1
    | undefined;
  let intermediateAudit:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorSideEffectAuditSnapshotInternalV1
    | undefined;
  try {
    try {
      const catalog =
        await diagnoseProviderFeasibilitySupportCatalogPreparedDirectSuccessorInternalV1(
          context.preparedRegistrySuccessorClosure,
          context.preparedCatalogSuccessorFinalCapability,
          {
            externallySignedCatalogEnvelope:
              context.externallySignedCatalogEnvelope,
          },
        );
      if (!catalog.ok) {
        return failV1(
          "prepared_catalog_successor",
          catalog.stage === "catalog_signature"
            ? "signature_invalid"
            : catalog.stage === "input"
              ? "capability_invalid"
              : "successor_invalid",
        );
      }
      const d42 = context.preparedRegistrySuccessorClosure;
      if (
        catalog.value.authority !== "none" ||
        catalog.value.relationship !==
          "root_signed_direct_successor_of_same_cohort_retained_current_catalog_candidate_not_current_or_published_v1" ||
        catalog.value.formalMigrationId !==
          d42.formalMigrationIdMapping.formalMigrationId ||
        catalog.value.sourceProviderId !==
          d42.preSideEffectPlanAdmissionClosure.sourceTrust.currentWriterSelection.providerId ||
        catalog.value.destinationProviderId !==
          d42.preSideEffectPlanAdmissionClosure.destinationTrust.prospectiveWriterProjection.providerId ||
        !canonicalEqualV1(
          catalog.value.preparedRegistryManifestPin,
          d42.preparedRegistryManifestPin,
        ) ||
        catalog.value.preparedSupportCatalogEnvelope !==
          context.externallySignedCatalogEnvelope ||
        !canonicalEqualV1(
          catalog.value.preparedSupportCatalogPin,
          context.request.expectedPreparedCatalogPin,
        ) ||
        catalog.value.exactD41CandidateIdentityPreserved !== true ||
        catalog.value.externallySignedEnvelopeIdentityPreserved !== true ||
        catalog.value.retainedTargetGroupsPreserved !== true ||
        catalog.value.insertedProspectiveCandidateCount !== 1 ||
        catalog.value.catalogSignatureVerificationCount !== 1 ||
        catalog.value.registryManifestPublicationCount !== 0 ||
        catalog.value.catalogPublicationCount !== 0
      ) {
        return failV1("prepared_catalog_successor", "successor_invalid");
      }
      intermediateAudit = parseAuditSnapshotV1(
        context.observeSideEffectSinks(),
      );
      const sideEffectBoundary = deriveSideEffectBoundaryV1(
        context.preAuditSnapshot,
        intermediateAudit,
      );
      const unsigned = {
        authority:
          "none_provider_migration_same_installation_identity_current_strong_source_normal_prepared_catalog_successor_reference_candidate_only" as const,
        profile:
          "provider_migration_same_installation_identity_current_strong_source_normal_prepared_catalog_successor_reference_candidate_v1" as const,
        stopPoint:
          "after_external_root_signed_formal_catalog_direct_successor_validation_before_registry_or_catalog_publication" as const,
        preparedRegistrySuccessorClosure: d42,
        currentSupportCatalogEnvelope:
          catalog.value.currentSupportCatalogEnvelope,
        currentSupportCatalogPin: catalog.value.currentSupportCatalogPin,
        preparedSupportCatalogEnvelope:
          catalog.value.preparedSupportCatalogEnvelope,
        preparedSupportCatalogPin: catalog.value.preparedSupportCatalogPin,
        publicationPrerequisite: publicationPrerequisiteV1(
          context,
          catalog.value.currentSupportCatalogPin,
          catalog.value.preparedSupportCatalogPin,
        ),
        publicationGate: {
          profile:
            "provider_migration_same_installation_identity_current_strong_source_normal_prepared_catalog_successor_publication_gate_reference_candidate_v1" as const,
          state: "locked_awaiting_formal_destination_trust_and_plan" as const,
          formalIdMapping: "verified" as const,
          preparedRegistryDirectSuccessor: "verified_not_published" as const,
          formalCatalogDirectSuccessor: "verified_not_published" as const,
          formalDestinationTrust: "none" as const,
          requiredNext: "formal_destination_trust_and_plan" as const,
          formalPlan: "none" as const,
          formalPlanPin: "none" as const,
          reservationRecords: "none" as const,
          reservationTokens: "none" as const,
          registryManifestPublication: "none" as const,
          catalogPublication: "none" as const,
          planPublication: "none" as const,
          migrationOnlyAcceptance: "none" as const,
        },
        sideEffectBoundary,
        verificationBoundary: {
          preparedRegistrySuccessorClosure:
            "complete_fresh_d42_same_cohort_candidate_v1" as const,
          currentCatalogContinuity:
            "same_cohort_retained_current_accepted_steady_catalog_v1" as const,
          preparedCatalogSignature:
            "externally_root_signed_and_verified_against_same_cohort_retained_active_root_v1" as const,
          preparedCatalogRelationship:
            "root_signed_direct_successor_of_same_cohort_retained_current_catalog_candidate_not_current_or_published_v1" as const,
          registryCatalogDestinationBinding:
            "exact_d41_d42_d43_destination_evidence_policy_runtime_and_routing_closure_v1" as const,
          rootSigningAuthority:
            "external_signature_verification_only_no_signer_capability_v1" as const,
          formalDestinationTrust: "none" as const,
          formalPlan: "none" as const,
          formalPlanPin: "none" as const,
          reservationRecords: "none" as const,
          reservationTokens: "none" as const,
          registryManifestPublication: "none" as const,
          catalogPublication: "none" as const,
          planPublication: "none" as const,
          migrationOnlyAcceptance: "none" as const,
          providerAuthority: "none" as const,
          durability: "none" as const,
          migrationExecution: "none" as const,
        },
      };
      const candidate = {
        ...unsigned,
        closureContentDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorClosureContentDigestV1(
            unsigned,
          ),
      };
      result = successResultV1(
        validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateV1(
          candidate,
        ),
      );
    } catch (error) {
      const diagnostic = isDiagnosticSignalV1(error)
        ? error
        : new PreparedCatalogSuccessorDiagnosticSignalInternalV1(
            "prepared_catalog_successor",
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
    try {
      if (result?.ok === true && continuationIntent !== undefined) {
        bindProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationToFinalCandidateInternalV1(
          continuationIntent,
          {
            exactD43Candidate: result.value,
            exactD42Candidate: context.preparedRegistrySuccessorClosure,
            exactD41Candidate:
              context.preparedRegistrySuccessorClosure
                .preSideEffectPlanAdmissionClosure,
            preparedRegistryManifestEnvelope:
              context.preparedRegistrySuccessorClosure
                .preparedRegistryManifestEnvelope,
            preparedRegistryManifestPin:
              context.preparedRegistrySuccessorClosure
                .preparedRegistryManifestPin,
            preparedSupportCatalogEnvelope:
              result.value.preparedSupportCatalogEnvelope,
            preparedSupportCatalogPin:
              result.value.preparedSupportCatalogPin,
          },
        );
      } else if (continuationIntent !== undefined) {
        discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1(
          continuationIntent,
        );
      }
    } catch {
      if (continuationIntent !== undefined) {
        try {
          discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1(
            continuationIntent,
          );
        } catch {
          // The opaque diagnostic below remains intentionally non-specific.
        }
      }
      result = failureResultV1(
        "prepared_catalog_successor",
        "successor_invalid",
      );
    }
  }
  return result ??
    failureResultV1("prepared_catalog_successor", "successor_invalid");
}

export function diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorDiagnosticResultInternalV1> {
  return hardenProviderPointPromiseV1(
    diagnosePreparedCatalogSuccessorV1(input),
  );
}

CapturedObjectFreezeV1(
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedCatalogSourceCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateInternalV1,
);
