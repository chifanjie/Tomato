/**
 * Package-private source_drained -> steady Registry completion orchestrator.
 * It consumes the exact source_drained terminal handoff, validates one
 * externally Root-signed direct successor, and CAS-publishes the steady tip.
 */

import { LowerHex32V1Schema, type InstallationIdentityGenerationIdV1, type ProviderMigrationIdV1 } from "./primitives.js";
import type { ProviderFeasibilitySupportCatalogPinV1 } from "./provider-feasibility-support-catalog-point.js";
import {
  comparePublishRegistrySuccessorProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationReceiptInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-compound-publication-reference-machine-internal.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReceiptInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-execution-progress-reference-machine-internal.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate-wire.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-compare-append-reference-machine-internal.js";
import {
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistryTerminalContinuationInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-source-drained-registry-successor-reference-capability-internal.js";
import {
  diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistrySuccessorCandidateInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistryManifestSourceCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistrySuccessorCandidateValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-steady-registry-successor-validator-internal.js";
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

export interface BuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceCandidateInternalV1Input {
  readonly sourceDrainedRegistrySuccessor:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceValidationInternalV1;
  readonly externallySignedSteadyRegistryManifestSourceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistryManifestSourceCapabilityInternalV1;
  readonly operationNonce: ReturnType<typeof LowerHex32V1Schema.parse>;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceValidationInternalV1 {
  readonly authority: "in_memory_reference_machine_only_no_production_provider_authority_v1";
  readonly durability: "in_memory_reference_only_not_a_durable_provider_v1";
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_steady_registry_completion_reference_validation_v1";
  readonly relationship: "exact_source_drained_externally_root_signed_steady_registry_direct_successor_compound_cas_published_current_v1";
  readonly sourceDrainedRegistrySuccessorClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceValidationInternalV1;
  readonly candidateValidation:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistrySuccessorCandidateValidationInternalV1;
  readonly steadyRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly steadyRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly registryPublicationReceipt:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationReceiptInternalV1;
  readonly publicationReplay: boolean;
  readonly currentRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly currentRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly currentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
  readonly terminalProgressReceipt:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReceiptInternalV1;
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly formalMigrationId: ProviderMigrationIdV1;
  readonly sourceProviderId: string;
  readonly destinationProviderId: string;
  readonly sourceMemberTombstoneDisposition: "revoked_migration_completed";
  readonly destinationOnlyEnabledMember: true;
  readonly compoundStateRevision: number;
  readonly registryManifestPublicationCount: 1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceDiagnosticResultInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceValidationInternalV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage: "input" | "steady_candidate" | "registry_publication";
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

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionTerminalJournalContinuationInternalV1 {
  readonly steadyRegistryCompletion:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceValidationInternalV1;
  readonly compoundPublicationReferenceMachineCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1;
  readonly migrationOnlyAcceptanceReferenceMachineCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
  readonly acceptanceIdentityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  readonly sourceDrainedRegistrySuccessor:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceValidationInternalV1;
}

const terminalJournalContinuationsInternalV1 = new CapturedWeakMapV1<
  object,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionTerminalJournalContinuationInternalV1
>();

function inputHasExactShapeV1(
  input: unknown,
): input is BuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceCandidateInternalV1Input {
  if (
    input === null ||
    typeof input !== "object" ||
    CapturedArrayIsArrayV1(input) ||
    (CapturedObjectGetPrototypeOfV1(input) !== CapturedObjectPrototypeV1 &&
      CapturedObjectGetPrototypeOfV1(input) !== null)
  ) return false;
  const expected = [
    "sourceDrainedRegistrySuccessor",
    "externallySignedSteadyRegistryManifestSourceCapability",
    "operationNonce",
  ] as const;
  if (CapturedReflectOwnKeysV1(input).length !== expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index]!;
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(input, key);
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
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceDiagnosticResultInternalV1,
    { readonly ok: false }
  >["stage"],
  reason: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceDiagnosticResultInternalV1,
    { readonly ok: false }
  >["reason"],
  extra: Readonly<Record<string, unknown>> = {},
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceDiagnosticResultInternalV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
    ...extra,
  }) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceDiagnosticResultInternalV1;
}

async function diagnoseInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceDiagnosticResultInternalV1> {
  if (!inputHasExactShapeV1(input)) return failureV1("input", "schema_invalid");
  const operationNonce = LowerHex32V1Schema.safeParse(input.operationNonce);
  if (!operationNonce.success) return failureV1("input", "schema_invalid");
  const continuation =
    takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistryTerminalContinuationInternalV1(
      input.sourceDrainedRegistrySuccessor,
    );
  if (
    continuation === undefined ||
    continuation.sourceDrainedRegistrySuccessor !==
      input.sourceDrainedRegistrySuccessor
  ) return failureV1("input", "capability_invalid");

  const candidate =
    await diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistrySuccessorCandidateInternalV1(
      continuation,
      input.externallySignedSteadyRegistryManifestSourceCapability,
    );
  if (!candidate.ok) {
    return failureV1(
      "steady_candidate",
      candidate.reason === "signature_invalid"
        ? "signature_invalid"
        : "candidate_invalid",
      { candidateStage: candidate.stage, candidateReason: candidate.reason },
    );
  }
  const publication =
    comparePublishRegistrySuccessorProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
      continuation.compoundPublicationReferenceMachineCapability,
      CapturedObjectFreezeV1({
        operationNonce: operationNonce.data,
        expectedCurrentRegistryManifestPin:
          candidate.value.currentSourceDrainedRegistryManifestPin,
        validatedSignedSuccessorEnvelope:
          candidate.value.steadyRegistryManifestEnvelope,
        validatedSignedSuccessorPin:
          candidate.value.steadyRegistryManifestPin,
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
      continuation.compoundPublicationReferenceMachineCapability,
    );
  if (
    state.migrationPublicationState.state !== "committed" ||
    state.currentRegistryManifestEnvelope !==
      publication.receipt.publishedRegistryManifestEnvelope ||
    state.currentRegistryManifestPin !==
      publication.receipt.publishedRegistryManifestPin ||
    state.currentRegistryManifestEnvelope.payload.routing.state !== "steady" ||
    publication.receipt.routingPhase !== "steady" ||
    publication.receipt.activeForMigrationWrites !==
      candidate.value.destinationProviderId
  ) return failureV1("registry_publication", "publication_rejected");

  const zeroLive = continuation.zeroLiveClosure;
  const value = CapturedObjectFreezeV1({
    authority:
      "in_memory_reference_machine_only_no_production_provider_authority_v1" as const,
    durability:
      "in_memory_reference_only_not_a_durable_provider_v1" as const,
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_steady_registry_completion_reference_validation_v1" as const,
    relationship:
      "exact_source_drained_externally_root_signed_steady_registry_direct_successor_compound_cas_published_current_v1" as const,
    sourceDrainedRegistrySuccessorClosure:
      input.sourceDrainedRegistrySuccessor,
    candidateValidation: candidate.value,
    steadyRegistryManifestEnvelope:
      candidate.value.steadyRegistryManifestEnvelope,
    steadyRegistryManifestPin: candidate.value.steadyRegistryManifestPin,
    registryPublicationReceipt: publication.receipt,
    publicationReplay: publication.replay,
    currentRegistryManifestEnvelope: state.currentRegistryManifestEnvelope,
    currentRegistryManifestPin: state.currentRegistryManifestPin,
    currentSupportCatalogPin: zeroLive.currentSupportCatalogPin,
    formalPlanPin: zeroLive.formalPlanPin,
    terminalProgressReceipt: zeroLive.terminalProgressReceipt,
    installationIdentityGenerationId:
      zeroLive.installationIdentityGenerationId,
    formalMigrationId: zeroLive.formalMigrationId,
    sourceProviderId: zeroLive.sourceProviderId,
    destinationProviderId: zeroLive.destinationProviderId,
    sourceMemberTombstoneDisposition:
      "revoked_migration_completed" as const,
    destinationOnlyEnabledMember: true as const,
    compoundStateRevision: state.revision,
    registryManifestPublicationCount: 1 as const,
  }) satisfies ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceValidationInternalV1;
  terminalJournalContinuationsInternalV1.set(
    value,
    CapturedObjectFreezeV1({
      steadyRegistryCompletion: value,
      compoundPublicationReferenceMachineCapability:
        continuation.compoundPublicationReferenceMachineCapability,
      migrationOnlyAcceptanceReferenceMachineCapability:
        continuation.migrationOnlyAcceptanceReferenceMachineCapability,
      acceptanceIdentityVerificationCapability:
        continuation.acceptanceIdentityVerificationCapability,
      sourceDrainedRegistrySuccessor:
        input.sourceDrainedRegistrySuccessor,
    }),
  );
  return createProviderNonThenableFrozenRecordV1({ ok: true as const, value });
}

export function diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceCandidateInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceDiagnosticResultInternalV1> {
  return hardenProviderPointPromiseV1(diagnoseInternalV1(input));
}

/** Foreign/cloned successes do not consume the exact owner. */
export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionTerminalJournalContinuationInternalV1(
  exactSteadyCompletion:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceValidationInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionTerminalJournalContinuationInternalV1 | undefined {
  if (exactSteadyCompletion === null || typeof exactSteadyCompletion !== "object") {
    return undefined;
  }
  const continuation = terminalJournalContinuationsInternalV1.get(
    exactSteadyCompletion,
  );
  if (
    continuation === undefined ||
    !terminalJournalContinuationsInternalV1.delete(exactSteadyCompletion)
  ) return undefined;
  return continuation;
}

for (const exportedFunctionV1 of [
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceCandidateInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionTerminalJournalContinuationInternalV1,
]) CapturedObjectFreezeV1(exportedFunctionV1);
