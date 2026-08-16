/**
 * Package-private D-46 rebinding Registry publication reference orchestrator.
 *
 * It consumes the exact D-45 execution continuation, validates one externally
 * Root-signed prepared -> rebinding direct successor, then performs the
 * process-local compound-machine Registry CAS. Only that committed result can
 * mint the next exact-once execution continuation.
 */

import { LowerHex32V1Schema } from "./primitives.js";
import {
  comparePublishRegistrySuccessorProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationReceiptInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-compound-publication-reference-machine-internal.js";
import {
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceExecutionContinuationInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-reference-capability-internal.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-compare-append-reference-machine-internal.js";
import {
  diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorCandidateInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistryManifestSourceCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorCandidateValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-rebinding-registry-successor-validator-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import type {
  ProviderRegistryManifestEnvelopeV1,
  ProviderRegistryManifestPinV1,
} from "./provider-registry-records.js";
import type {
  ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";

const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const CapturedWeakMapV1 = WeakMap;

export interface BuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceCandidateInternalV1Input {
  readonly migrationOnlyAcceptance:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceValidationInternalV1;
  readonly externallySignedRebindingRegistryManifestSourceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistryManifestSourceCapabilityInternalV1;
  readonly operationNonce: ReturnType<typeof LowerHex32V1Schema.parse>;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceValidationInternalV1 {
  readonly authority: "in_memory_reference_machine_only_no_production_provider_authority_v1";
  readonly durability: "in_memory_reference_only_not_a_durable_provider_v1";
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_rebinding_registry_successor_reference_validation_v1";
  readonly relationship: "externally_root_signed_rebinding_registry_direct_successor_compound_cas_published_current_v1";
  readonly migrationOnlyAcceptanceClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceValidationInternalV1;
  readonly candidateValidation:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorCandidateValidationInternalV1;
  readonly rebindingRegistryManifestEnvelope:
    ProviderRegistryManifestEnvelopeV1;
  readonly rebindingRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly registryPublicationReceipt:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationReceiptInternalV1;
  readonly publicationReplay: boolean;
  readonly currentRegistryManifestEnvelope:
    ProviderRegistryManifestEnvelopeV1;
  readonly currentRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly compoundStateRevision: number;
  readonly registryManifestPublicationCount: 1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceDiagnosticResultInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceValidationInternalV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage:
        | "input"
        | "rebinding_candidate"
        | "registry_publication";
      readonly reason:
        | "schema_invalid"
        | "capability_invalid"
        | "candidate_invalid"
        | "signature_invalid"
        | "stale_expected_current_registry"
        | "operation_nonce_conflict"
        | "publication_rejected";
      readonly candidateStage?: string;
      readonly candidateReason?: string;
      readonly observedCurrentRegistryManifestPin?:
        ProviderRegistryManifestPinV1;
    }>;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistryExecutionContinuationInternalV1 {
  readonly migrationOnlyAcceptance:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceValidationInternalV1;
  readonly compoundPublicationReferenceMachineCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1;
  readonly migrationOnlyAcceptanceReferenceMachineCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
  readonly acceptanceIdentityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  readonly rebindingRegistrySuccessor:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceValidationInternalV1;
}

const executionContinuationsInternalV1 = new CapturedWeakMapV1<
  object,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistryExecutionContinuationInternalV1
>();

function inputHasExactShapeV1(
  input: unknown,
): input is BuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceCandidateInternalV1Input {
  if (
    input === null ||
    typeof input !== "object" ||
    CapturedArrayIsArrayV1(input) ||
    (CapturedObjectGetPrototypeOfV1(input) !== CapturedObjectPrototypeV1 &&
      CapturedObjectGetPrototypeOfV1(input) !== null)
  ) return false;
  const expected = [
    "migrationOnlyAcceptance",
    "externallySignedRebindingRegistryManifestSourceCapability",
    "operationNonce",
  ] as const;
  const keys = CapturedReflectOwnKeysV1(input);
  if (keys.length !== expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    const expectedKey = expected[index];
    if (expectedKey === undefined) return false;
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
      input,
      expectedKey,
    );
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) return false;
  }
  return true;
}

function failureV1(
  stage: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceDiagnosticResultInternalV1,
    { readonly ok: false }
  >["stage"],
  reason: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceDiagnosticResultInternalV1,
    { readonly ok: false }
  >["reason"],
  extra: Readonly<Record<string, unknown>> = {},
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceDiagnosticResultInternalV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
    ...extra,
  }) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceDiagnosticResultInternalV1;
}

async function diagnoseInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceDiagnosticResultInternalV1> {
  if (!inputHasExactShapeV1(input)) {
    return failureV1("input", "schema_invalid");
  }
  const operationNonce = LowerHex32V1Schema.safeParse(input.operationNonce);
  if (!operationNonce.success) return failureV1("input", "schema_invalid");
  const d45Continuation =
    takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceExecutionContinuationInternalV1(
      input.migrationOnlyAcceptance,
    );
  if (
    d45Continuation === undefined ||
    d45Continuation.migrationOnlyAcceptance !==
      input.migrationOnlyAcceptance
  ) return failureV1("input", "capability_invalid");

  const candidate =
    await diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorCandidateInternalV1(
      d45Continuation,
      input.externallySignedRebindingRegistryManifestSourceCapability,
    );
  if (!candidate.ok) {
    return failureV1(
      "rebinding_candidate",
      candidate.reason === "signature_invalid"
        ? "signature_invalid"
        : "candidate_invalid",
      {
        candidateStage: candidate.stage,
        candidateReason: candidate.reason,
      },
    );
  }
  const publication =
    comparePublishRegistrySuccessorProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
      d45Continuation.compoundPublicationReferenceMachineCapability,
      CapturedObjectFreezeV1({
        operationNonce: operationNonce.data,
        expectedCurrentRegistryManifestPin:
          candidate.value.currentPreparedRegistryManifestPin,
        validatedSignedSuccessorEnvelope:
          candidate.value.rebindingRegistryManifestEnvelope,
        validatedSignedSuccessorPin:
          candidate.value.rebindingRegistryManifestPin,
      }),
    );
  if (publication.status === "not_committed") {
    return failureV1(
      "registry_publication",
      "stale_expected_current_registry",
      {
        observedCurrentRegistryManifestPin:
          publication.observedCurrentRegistryManifestPin,
      },
    );
  }
  if (publication.status === "rejected") {
    return failureV1(
      "registry_publication",
      publication.reason === "operation_nonce_conflict"
        ? "operation_nonce_conflict"
        : publication.reason === "capability_invalid"
          ? "capability_invalid"
          : "publication_rejected",
    );
  }
  const state =
    inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
      d45Continuation.compoundPublicationReferenceMachineCapability,
    );
  const routing = state.currentRegistryManifestEnvelope.payload.routing;
  if (
    state.migrationPublicationState.state !== "committed" ||
    state.currentRegistryManifestEnvelope !==
      publication.receipt.publishedRegistryManifestEnvelope ||
    state.currentRegistryManifestPin !==
      publication.receipt.publishedRegistryManifestPin ||
    routing.state !== "migration" ||
    routing.phase !== "rebinding" ||
    routing.activeForMigrationWrites !== routing.destinationProviderId ||
    state.currentRegistryManifestPin.contentDigest !==
      candidate.value.rebindingRegistryManifestPin.contentDigest
  ) return failureV1("registry_publication", "publication_rejected");

  const value = CapturedObjectFreezeV1({
    authority:
      "in_memory_reference_machine_only_no_production_provider_authority_v1" as const,
    durability:
      "in_memory_reference_only_not_a_durable_provider_v1" as const,
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_rebinding_registry_successor_reference_validation_v1" as const,
    relationship:
      "externally_root_signed_rebinding_registry_direct_successor_compound_cas_published_current_v1" as const,
    migrationOnlyAcceptanceClosure: input.migrationOnlyAcceptance,
    candidateValidation: candidate.value,
    rebindingRegistryManifestEnvelope:
      candidate.value.rebindingRegistryManifestEnvelope,
    rebindingRegistryManifestPin:
      candidate.value.rebindingRegistryManifestPin,
    registryPublicationReceipt: publication.receipt,
    publicationReplay: publication.replay,
    currentRegistryManifestEnvelope: state.currentRegistryManifestEnvelope,
    currentRegistryManifestPin: state.currentRegistryManifestPin,
    compoundStateRevision: state.revision,
    registryManifestPublicationCount: 1 as const,
  }) satisfies ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceValidationInternalV1;
  executionContinuationsInternalV1.set(value, CapturedObjectFreezeV1({
    migrationOnlyAcceptance: input.migrationOnlyAcceptance,
    compoundPublicationReferenceMachineCapability:
      d45Continuation.compoundPublicationReferenceMachineCapability,
    migrationOnlyAcceptanceReferenceMachineCapability:
      d45Continuation.migrationOnlyAcceptanceReferenceMachineCapability,
    acceptanceIdentityVerificationCapability:
      d45Continuation.acceptanceIdentityVerificationCapability,
    rebindingRegistrySuccessor: value,
  }));
  return createProviderNonThenableFrozenRecordV1({ ok: true as const, value });
}

export function diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceCandidateInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceDiagnosticResultInternalV1> {
  return hardenProviderPointPromiseV1(diagnoseInternalV1(input));
}

/** Foreign/cloned successes do not consume the exact owner. */
export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistryExecutionContinuationInternalV1(
  exactRebindingSuccess:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceValidationInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistryExecutionContinuationInternalV1 | undefined {
  if (
    exactRebindingSuccess === null ||
    typeof exactRebindingSuccess !== "object"
  ) return undefined;
  const continuation = executionContinuationsInternalV1.get(
    exactRebindingSuccess,
  );
  if (
    continuation === undefined ||
    !executionContinuationsInternalV1.delete(exactRebindingSuccess)
  ) return undefined;
  return continuation;
}

for (const exportedFunctionV1 of [
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceCandidateInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistryExecutionContinuationInternalV1,
]) CapturedObjectFreezeV1(exportedFunctionV1);
