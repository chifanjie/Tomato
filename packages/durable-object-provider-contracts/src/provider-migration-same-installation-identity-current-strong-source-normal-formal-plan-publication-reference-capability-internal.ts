/**
 * Package-private D-44 end-to-end reference orchestrator.
 *
 * The operation always obtains a fresh D-43 candidate and its private
 * post-audit continuation, derives and revalidates the formal Plan, then asks
 * the process-local compound reference machine to compare, reserve, and
 * publish Registry + Catalog + Plan with one pointer commit.  The resulting
 * authority is intentionally reference-machine-only and provides no claim of
 * production crash durability.
 */

import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import {
  LowerHex32V1Schema,
} from "./primitives.js";
import {
  compareReservePublishProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCommittedReceiptInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReservationRecordInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-compound-publication-reference-machine-internal.js";
import {
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1,
  validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate-wire.js";
import {
  bindProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationToCommittedPublicationInternalV1,
  discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-continuation-internal.js";
import {
  discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationFinalInternalV1,
  discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1,
  registerProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationFinalCapabilityInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationPayloadInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationFinalCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationPayloadInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-continuation-internal.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityInternalV1,
  type MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityInternalV1Input,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-catalog-successor-reference-capability-internal.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1Schema,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-catalog-successor-reference-candidate-wire.js";
import {
  ProviderFeasibilitySupportCatalogPinV1Schema,
  type ProviderFeasibilitySupportCatalogEnvelopeV1,
  type ProviderFeasibilitySupportCatalogPinV1,
} from "./provider-feasibility-support-catalog-point.js";
import {
  ProviderRegistryManifestPinV1Schema,
  type ProviderRegistryManifestEnvelopeV1,
  type ProviderRegistryManifestPinV1,
} from "./provider-registry-records.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";

const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
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
  "compoundPublicationReferenceMachineCapability",
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
  "preparedCatalogSuccessorRequest",
  "operationNonce",
  "expectedCurrentRegistryManifestPin",
  "expectedCurrentSupportCatalogPin",
] as const);

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceRequestInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_publication_reference_request_v1";
  readonly preparedCatalogSuccessorRequest:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1;
  readonly operationNonce: string;
  readonly expectedCurrentRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly expectedCurrentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
}

export interface MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCapabilityInternalV1Input
  extends Omit<
    MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityInternalV1Input,
    "request"
  > {
  readonly compoundPublicationReferenceMachineCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1;
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceRequestInternalV1;
}

declare const formalPlanPublicationReferenceCapabilityBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCapabilityInternalV1 {
  readonly [formalPlanPublicationReferenceCapabilityBrandInternalV1]: true;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceBoundBuildInputInternalV1 {
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceRequestInternalV1;
  readonly formalPlanPublicationReferenceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCapabilityInternalV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceReadyBuildInputInternalV1 {
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceRequestInternalV1;
  readonly formalPlanPublicationReferenceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCapabilityInternalV1;
  readonly buildInput:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceBoundBuildInputInternalV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceValidationInternalV1 {
  readonly authority: "in_memory_reference_machine_only_no_production_provider_authority_v1";
  readonly durability: "in_memory_reference_only_not_a_durable_provider_v1";
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_publication_reference_validation_v1";
  readonly relationship: "fresh_d43_formal_plan_compare_reserved_and_compound_published_v1";
  readonly replay: boolean;
  readonly preparedCatalogSuccessorClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1;
  readonly formalPlanClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1;
  readonly formalPlanEnvelope:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1;
  readonly formalPlanPin:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
  readonly formalReservationDescriptor:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorReferenceCandidateV1;
  readonly reservationRecord:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReservationRecordInternalV1;
  readonly currentRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly currentRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly currentSupportCatalogEnvelope: ProviderFeasibilitySupportCatalogEnvelopeV1;
  readonly currentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly committedReceipt:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCommittedReceiptInternalV1;
  readonly stateRevision: 1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticStageInternalV1 =
  | "input"
  | "prepared_catalog_successor"
  | "formal_plan"
  | "compound_publication";

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticReasonInternalV1 =
  | "schema_invalid"
  | "capability_invalid"
  | "candidate_invalid"
  | "formal_plan_invalid"
  | "stale_expected_current_cut"
  | "operation_nonce_conflict"
  | "publication_rejected";

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticResultInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceValidationInternalV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticStageInternalV1;
      readonly reason:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticReasonInternalV1;
      readonly observedCurrentRegistryManifestPin?: ProviderRegistryManifestPinV1;
      readonly observedCurrentSupportCatalogPin?: ProviderFeasibilitySupportCatalogPinV1;
    }>;

interface FormalPlanPublicationContextInternalV1 {
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceRequestInternalV1;
  readonly continuation:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationPayloadInternalV1;
  readonly compoundPublicationReferenceMachineCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1;
}

interface ClaimedBuildInputInternalV1 {
  readonly capability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCapabilityInternalV1;
}

const formalPlanPublicationContextsInternalV1 = new CapturedWeakMapV1<
  object,
  FormalPlanPublicationContextInternalV1
>();
const readyBuildInputsInternalV1 = new CapturedWeakMapV1<
  object,
  ClaimedBuildInputInternalV1
>();
const diagnosticSignalsInternalV1 = new CapturedWeakSetV1<object>();

class FormalPlanPublicationDiagnosticSignalInternalV1 extends CapturedTypeErrorV1 {
  readonly stage:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticStageInternalV1;
  readonly reason:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticReasonInternalV1;

  constructor(
    stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticStageInternalV1,
    reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticReasonInternalV1,
  ) {
    super("provider migration formal Plan publication reference operation failed");
    this.name = "FormalPlanPublicationDiagnosticSignalInternalV1";
    this.stage = stage;
    this.reason = reason;
    weakSetAddV1(diagnosticSignalsInternalV1, this);
    CapturedObjectFreezeV1(this);
  }
}

function isObjectIdentityV1(value: unknown): value is object {
  return value !== null &&
    (typeof value === "object" || typeof value === "function");
}

function isDiagnosticSignalV1(
  value: unknown,
): value is FormalPlanPublicationDiagnosticSignalInternalV1 {
  return isObjectIdentityV1(value) &&
    weakSetHasV1(diagnosticSignalsInternalV1, value);
}

function failV1(
  stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticStageInternalV1,
  reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticReasonInternalV1,
): never {
  throw new FormalPlanPublicationDiagnosticSignalInternalV1(stage, reason);
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
  const output = CapturedObjectCreateV1(null) as Record<string, unknown>;
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

function materializeRequestV1(
  input: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceRequestInternalV1 {
  const fields = readExactOwnDataFieldsV1(input, REQUEST_KEYS_V1);
  const nonce = LowerHex32V1Schema.safeParse(fields?.operationNonce);
  const d43Request =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1Schema.safeParse(
      fields?.preparedCatalogSuccessorRequest,
    );
  const registryPin = ProviderRegistryManifestPinV1Schema.safeParse(
    fields?.expectedCurrentRegistryManifestPin,
  );
  const catalogPin = ProviderFeasibilitySupportCatalogPinV1Schema.safeParse(
    fields?.expectedCurrentSupportCatalogPin,
  );
  if (
    fields === undefined ||
    fields.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_publication_reference_request_v1" ||
    !nonce.success ||
    !d43Request.success ||
    !registryPin.success ||
    !catalogPin.success
  ) {
    return failV1("input", "schema_invalid");
  }
  return deepFreezeProviderPointDetachedDataTreeV1({
    profile: fields.profile,
    preparedCatalogSuccessorRequest: d43Request.data,
    operationNonce: nonce.data,
    expectedCurrentRegistryManifestPin: registryPin.data,
    expectedCurrentSupportCatalogPin: catalogPin.data,
  });
}

async function mintFormalPlanPublicationPreparedInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceReadyBuildInputInternalV1> {
  let continuationIntent:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1 | undefined;
  let finalCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationFinalCapabilityInternalV1 | undefined;
  let exactD43Candidate:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1 | undefined;
  let continuationTransferred = false;
  try {
    const fields = readExactOwnDataFieldsV1(input, MINT_INPUT_KEYS_V1);
    if (fields === undefined) return failV1("input", "schema_invalid");
    const request = materializeRequestV1(fields.request);
    continuationIntent =
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1();
    const d43Ready =
      await mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityInternalV1({
        acceptanceClosureIdentity: fields.acceptanceClosureIdentity,
        endpointObservationHost: fields.endpointObservationHost,
        externallySignedPreparedCatalogSourceCapability:
          fields.externallySignedPreparedCatalogSourceCapability,
        externallySignedPreparedRegistryManifestSourceCapability:
          fields.externallySignedPreparedRegistryManifestSourceCapability,
        prospectiveDestinationPreparedSourceCapability:
          fields.prospectiveDestinationPreparedSourceCapability,
        quotaObservationHost: fields.quotaObservationHost,
        request: request.preparedCatalogSuccessorRequest,
        sideEffectAuditObserver: fields.sideEffectAuditObserver,
        sourceStreamHost: fields.sourceStreamHost,
        verifiedLiveReferenceSchemaDigest:
          fields.verifiedLiveReferenceSchemaDigest,
        verifiedMigrationProtocolDigest:
          fields.verifiedMigrationProtocolDigest,
      });
    registerProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1(
      d43Ready.preparedCatalogSuccessorReferenceCapability,
      continuationIntent,
    );
    const d43Result =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateInternalV1(
        d43Ready.buildInput,
      );
    if (!d43Result.ok) {
      return failV1("prepared_catalog_successor", "candidate_invalid");
    }
    exactD43Candidate = d43Result.value;
    finalCapability =
      takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationFinalCapabilityInternalV1(
        continuationIntent,
        exactD43Candidate,
      );
    if (finalCapability === undefined) {
      return failV1("prepared_catalog_successor", "capability_invalid");
    }
    const continuation =
      takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationPayloadInternalV1(
        exactD43Candidate,
        finalCapability,
      );
    if (
      continuation === undefined ||
      continuation.exactD43Candidate !== exactD43Candidate
    ) {
      return failV1("prepared_catalog_successor", "capability_invalid");
    }
    continuationTransferred = true;
    const capability = CapturedObjectFreezeV1(
      CapturedObjectCreateV1(null),
    ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCapabilityInternalV1;
    const buildInput = createProviderNonThenableFrozenRecordV1({
      request,
      formalPlanPublicationReferenceCapability: capability,
    }) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceBoundBuildInputInternalV1;
    const ready = createProviderNonThenableFrozenRecordV1({
      request,
      formalPlanPublicationReferenceCapability: capability,
      buildInput,
    });
    weakMapSetV1(formalPlanPublicationContextsInternalV1, capability, {
      request,
      continuation,
      compoundPublicationReferenceMachineCapability:
        fields.compoundPublicationReferenceMachineCapability as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1,
    });
    weakMapSetV1(readyBuildInputsInternalV1, buildInput, { capability });
    return ready;
  } catch (error) {
    if (
      !continuationTransferred &&
      finalCapability !== undefined &&
      exactD43Candidate !== undefined
    ) {
      try {
        discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationFinalInternalV1(
          exactD43Candidate,
          finalCapability,
        );
      } catch {
        // The opaque diagnostic below remains intentionally non-specific.
      }
    }
    if (continuationIntent !== undefined) {
      try {
        discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1(
          continuationIntent,
        );
      } catch {
        // The opaque diagnostic below remains intentionally non-specific.
      }
    }
    if (isDiagnosticSignalV1(error)) throw error;
    return failV1("input", "schema_invalid");
  }
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCapabilityInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceReadyBuildInputInternalV1> {
  return hardenProviderPointPromiseV1(
    mintFormalPlanPublicationPreparedInternalV1(input),
  );
}

function takeBuildContextV1(
  input: unknown,
): Readonly<{
  context: FormalPlanPublicationContextInternalV1;
  continuationIntent:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1 | undefined;
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
    formalPlanPublicationContextsInternalV1,
    claimed.capability,
  );
  if (
    context === undefined ||
    !weakMapDeleteV1(
      formalPlanPublicationContextsInternalV1,
      claimed.capability,
    )
  ) {
    return failV1("input", "capability_invalid");
  }
  const continuationIntent =
    takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1(
      claimed.capability,
    );
  return CapturedObjectFreezeV1({ context, continuationIntent });
}

function failureResultV1(
  stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticStageInternalV1,
  reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticReasonInternalV1,
  observed?: Readonly<{
    observedCurrentRegistryManifestPin: ProviderRegistryManifestPinV1;
    observedCurrentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  }>,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticResultInternalV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
    ...(observed ?? {}),
  });
}

function successResultV1(
  value: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceValidationInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticResultInternalV1 {
  return createProviderNonThenableFrozenRecordV1({ ok: true as const, value });
}

async function diagnoseFormalPlanPublicationCoreInternalV1(
  context: FormalPlanPublicationContextInternalV1,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticResultInternalV1> {
  try {
    const formalPlan =
      validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1(
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1(
          context.continuation.exactD43Candidate,
        ),
      );
    if (
      !canonicalEqualV1(
        formalPlan.preparedCatalogSuccessorClosure,
        context.continuation.exactD43Candidate,
      ) ||
      !canonicalEqualV1(
        formalPlan.formalPlanEnvelope.payload.preparedRegistryManifestPin,
        context.continuation.preparedRegistryManifestPin,
      ) ||
      !canonicalEqualV1(
        formalPlan.formalPlanEnvelope.payload.preparedSupportCatalogPin,
        context.continuation.preparedSupportCatalogPin,
      )
    ) {
      return failureResultV1("formal_plan", "formal_plan_invalid");
    }
    const publication =
      compareReservePublishProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        context.compoundPublicationReferenceMachineCapability,
        CapturedObjectFreezeV1({
          operationNonce: context.request.operationNonce,
          expectedCurrentRegistryManifestPin:
            context.request.expectedCurrentRegistryManifestPin,
          expectedCurrentSupportCatalogPin:
            context.request.expectedCurrentSupportCatalogPin,
          preparedRegistryManifestEnvelope:
            context.continuation.preparedRegistryManifestEnvelope,
          preparedRegistryManifestPin:
            context.continuation.preparedRegistryManifestPin,
          preparedSupportCatalogEnvelope:
            context.continuation.preparedSupportCatalogEnvelope,
          preparedSupportCatalogPin:
            context.continuation.preparedSupportCatalogPin,
          formalPlanEnvelope: formalPlan.formalPlanEnvelope,
          formalPlanPin: formalPlan.formalPlanPin,
          formalReservationDescriptor:
            formalPlan.formalReservationDescriptor,
        }),
      );
    if (publication.status === "not_committed") {
      return failureResultV1(
        "compound_publication",
        "stale_expected_current_cut",
        {
          observedCurrentRegistryManifestPin:
            publication.observedCurrentRegistryManifestPin,
          observedCurrentSupportCatalogPin:
            publication.observedCurrentSupportCatalogPin,
        },
      );
    }
    if (publication.status === "rejected") {
      return failureResultV1(
        "compound_publication",
        publication.reason === "operation_nonce_conflict"
          ? "operation_nonce_conflict"
          : publication.reason === "capability_invalid"
            ? "capability_invalid"
            : "publication_rejected",
      );
    }
    const state =
      inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        context.compoundPublicationReferenceMachineCapability,
      );
    if (
      state.revision !== 1 ||
      state.migrationPublicationState.state !== "committed" ||
      state.migrationPublicationState.immutableReceipt !== publication.receipt ||
      !canonicalEqualV1(
        state.currentRegistryManifestPin,
        context.continuation.preparedRegistryManifestPin,
      ) ||
      !canonicalEqualV1(
        state.currentSupportCatalogPin,
        context.continuation.preparedSupportCatalogPin,
      )
    ) {
      return failureResultV1(
        "compound_publication",
        "publication_rejected",
      );
    }
    return successResultV1(
      CapturedObjectFreezeV1({
        authority:
          "in_memory_reference_machine_only_no_production_provider_authority_v1",
        durability: "in_memory_reference_only_not_a_durable_provider_v1",
        profile:
          "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_publication_reference_validation_v1",
        relationship:
          "fresh_d43_formal_plan_compare_reserved_and_compound_published_v1",
        replay: publication.replay,
        preparedCatalogSuccessorClosure:
          context.continuation.exactD43Candidate,
        formalPlanClosure: formalPlan,
        formalPlanEnvelope: formalPlan.formalPlanEnvelope,
        formalPlanPin: formalPlan.formalPlanPin,
        formalReservationDescriptor:
          formalPlan.formalReservationDescriptor,
        reservationRecord: publication.receipt.reservationRecord,
        currentRegistryManifestEnvelope:
          state.currentRegistryManifestEnvelope,
        currentRegistryManifestPin: state.currentRegistryManifestPin,
        currentSupportCatalogEnvelope:
          state.currentSupportCatalogEnvelope,
        currentSupportCatalogPin: state.currentSupportCatalogPin,
        committedReceipt: publication.receipt,
        stateRevision: 1,
      }),
    );
  } catch {
    return failureResultV1("formal_plan", "formal_plan_invalid");
  }
}

function completeFormalPlanPublicationContinuationV1(
  context: FormalPlanPublicationContextInternalV1,
  continuationIntent:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1 | undefined,
  result: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticResultInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticResultInternalV1 {
  if (continuationIntent === undefined) return result;
  try {
    if (result.ok) {
      bindProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationToCommittedPublicationInternalV1(
        continuationIntent,
        result.value,
        context.compoundPublicationReferenceMachineCapability,
      );
    } else {
      discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1(
        continuationIntent,
      );
    }
    return result;
  } catch {
    try {
      discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1(
        continuationIntent,
      );
    } catch {
      // The opaque diagnostic below remains intentionally non-specific.
    }
    return failureResultV1(
      "compound_publication",
      "publication_rejected",
    );
  }
}

async function diagnoseFormalPlanPublicationInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticResultInternalV1> {
  let context: FormalPlanPublicationContextInternalV1;
  let continuationIntent:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1 | undefined;
  try {
    ({ context, continuationIntent } = takeBuildContextV1(input));
  } catch (error) {
    const diagnostic = isDiagnosticSignalV1(error)
      ? error
      : new FormalPlanPublicationDiagnosticSignalInternalV1(
          "input",
          "schema_invalid",
        );
    return failureResultV1(diagnostic.stage, diagnostic.reason);
  }
  const result = await diagnoseFormalPlanPublicationCoreInternalV1(context);
  return completeFormalPlanPublicationContinuationV1(
    context,
    continuationIntent,
    result,
  );
}

export function diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCandidateInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceDiagnosticResultInternalV1> {
  return hardenProviderPointPromiseV1(
    diagnoseFormalPlanPublicationInternalV1(input),
  );
}

CapturedObjectFreezeV1(
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCandidateInternalV1,
);
