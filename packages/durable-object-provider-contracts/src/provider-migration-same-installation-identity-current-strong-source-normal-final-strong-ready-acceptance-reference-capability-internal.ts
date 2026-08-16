/**
 * Package-private final strong-ready Acceptance orchestrator.
 *
 * Authority is admitted only by the exact terminal-journal sealed success.
 * The migration-only Acceptance writer is queue-retired before a fresh,
 * destination-only writer capability compare-appends the final generation.
 */

import { LowerHex32V1Schema } from "./primitives.js";
import {
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-compound-publication-reference-machine-internal.js";
import {
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCandidateInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCandidateValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-final-strong-ready-acceptance-reference-candidate-internal.js";
import {
  compareAppendProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceMachineInternalV1,
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceMachineInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReferenceMachineInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReceiptInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceStateInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-final-strong-ready-acceptance-compare-append-reference-machine-internal.js";
import {
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineInternalV1,
  retireProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceMachineForSteadyInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-compare-append-reference-machine-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  ProviderActiveWriterSelectionV1Schema,
  type ProviderStrongReadyAcceptanceGenerationPinCandidateV1,
  type ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
} from "./provider-strong-ready-acceptance-candidate.js";
import { ProviderRegistryIsoTimestampV1Schema } from "./provider-registry-trust.js";
import {
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSealedTerminalJournalFinalAcceptanceContinuationInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealedValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-terminal-journal-seal-reference-machine-internal.js";

const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const CapturedWeakMapV1 = WeakMap;

export interface BuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceInternalV1Input {
  readonly sealedTerminalJournal:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealedValidationInternalV1;
  readonly operationNonce: ReturnType<typeof LowerHex32V1Schema.parse>;
  readonly acceptedAt: ReturnType<typeof ProviderRegistryIsoTimestampV1Schema.parse>;
  readonly resolvedAt: ReturnType<typeof ProviderRegistryIsoTimestampV1Schema.parse>;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceValidationInternalV1 {
  readonly authority: "in_memory_reference_machine_only_no_production_provider_authority_v1";
  readonly durability: "in_memory_reference_only_not_a_durable_provider_v1";
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_reference_validation_v1";
  readonly relationship: "exact_terminal_sealed_new_destination_writer_final_strong_ready_acceptance_compare_appended_v1";
  readonly sealedTerminalJournal:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealedValidationInternalV1;
  readonly candidateValidation:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCandidateValidationInternalV1;
  readonly finalStrongReadyAcceptanceEnvelope:
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1;
  readonly finalStrongReadyAcceptancePin:
    ProviderStrongReadyAcceptanceGenerationPinCandidateV1;
  readonly acceptanceCompareAppendReceipt:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReceiptInternalV1;
  readonly acceptanceReferenceState:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceStateInternalV1;
  readonly destinationProviderId: string;
  readonly sourceWriterRetired: true;
  readonly migrationOnlyWriterRetired: true;
  readonly destinationOnlyPublicStrongWriter: true;
  readonly finalSteadyRegistryAndCatalogBound: true;
  readonly formalPlanAndTerminalSealBound: true;
  readonly acceptancePublicationCount: 1;
  readonly publicStrongWriterPublicationCount: 1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceDiagnosticResultInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceValidationInternalV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage:
        | "input"
        | "sealed_terminal"
        | "migration_acceptance_handoff"
        | "final_candidate"
        | "acceptance_compare_append";
      readonly reason:
        | "schema_invalid"
        | "capability_invalid"
        | "terminal_binding_invalid"
        | "stale_expected_acceptance"
        | "candidate_invalid"
        | "operation_nonce_conflict"
        | "append_rejected";
      readonly acceptanceCompareAppendReceipt?:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReceiptInternalV1;
    }>;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalDestinationStrongWriterContinuationInternalV1 {
  readonly finalStrongReadyAcceptance:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceValidationInternalV1;
  readonly acceptanceStateEnvelope:
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1;
  readonly acceptanceGenerationPin:
    ProviderStrongReadyAcceptanceGenerationPinCandidateV1;
  readonly destinationProviderId: string;
}

const finalWriterContinuationsInternalV1 = new CapturedWeakMapV1<
  object,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalDestinationStrongWriterContinuationInternalV1
>();

function inputHasExactShapeV1(
  input: unknown,
): input is BuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceInternalV1Input {
  if (
    input === null ||
    typeof input !== "object" ||
    CapturedArrayIsArrayV1(input) ||
    (CapturedObjectGetPrototypeOfV1(input) !== CapturedObjectPrototypeV1 &&
      CapturedObjectGetPrototypeOfV1(input) !== null)
  ) return false;
  const expected = [
    "sealedTerminalJournal",
    "operationNonce",
    "acceptedAt",
    "resolvedAt",
  ] as const;
  if (CapturedReflectOwnKeysV1(input).length !== expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index];
    if (key === undefined) return false;
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
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceDiagnosticResultInternalV1,
    { readonly ok: false }
  >["stage"],
  reason: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceDiagnosticResultInternalV1,
    { readonly ok: false }
  >["reason"],
  receipt?:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReceiptInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceDiagnosticResultInternalV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
    ...(receipt === undefined
      ? {}
      : { acceptanceCompareAppendReceipt: receipt }),
  });
}

async function diagnoseInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceDiagnosticResultInternalV1> {
  if (!inputHasExactShapeV1(input)) return failureV1("input", "schema_invalid");
  const nonce = LowerHex32V1Schema.safeParse(input.operationNonce);
  const acceptedAt = ProviderRegistryIsoTimestampV1Schema.safeParse(
    input.acceptedAt,
  );
  const resolvedAt = ProviderRegistryIsoTimestampV1Schema.safeParse(
    input.resolvedAt,
  );
  if (!nonce.success || !acceptedAt.success || !resolvedAt.success) {
    return failureV1("input", "schema_invalid");
  }
  const continuation =
    takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSealedTerminalJournalFinalAcceptanceContinuationInternalV1(
      input.sealedTerminalJournal,
    );
  if (
    continuation === undefined ||
    continuation.sealedTerminalJournal !== input.sealedTerminalJournal
  ) return failureV1("sealed_terminal", "capability_invalid");
  const sealed = continuation.sealedTerminalJournal;
  const steady = continuation.steadyRegistryCompletion;
  const compoundState =
    inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
      continuation.compoundPublicationReferenceMachineCapability,
    );
  const routing = compoundState.currentRegistryManifestEnvelope.payload.routing;
  if (
    sealed.journalRevision !== 1 ||
    sealed.strongWriterPublicationCount !== 0 ||
    sealed.acceptancePublicationCount !== 0 ||
    sealed.steadyRegistryCompletion !== steady ||
    sealed.currentRegistryManifestEnvelope !==
      steady.currentRegistryManifestEnvelope ||
    sealed.currentRegistryManifestPin !== steady.currentRegistryManifestPin ||
    compoundState.currentRegistryManifestEnvelope !==
      sealed.currentRegistryManifestEnvelope ||
    compoundState.currentRegistryManifestPin !==
      sealed.currentRegistryManifestPin ||
    routing.state !== "steady" ||
    sealed.formalPlanPin.formalMigrationId !== sealed.formalMigrationId ||
    sealed.sealedProgressHead.state !== "sealed" ||
    sealed.readyToActivateRecord.state !== "ready_to_activate" ||
    sealed.sealedProgressHead.contentDigest !==
      sealed.terminalJournalReceipt.sealedProgressHeadContentDigest ||
    sealed.terminalJournalReceiptContentDigest !==
      sealed.terminalJournalReceipt.contentDigest ||
    sealed.terminalProgressReceipt.receiptContentDigest !==
      sealed.sealedProgressHead.terminalProgressReceiptContentDigest
  ) return failureV1("sealed_terminal", "terminal_binding_invalid");

  const members = sealed.currentRegistryManifestEnvelope.payload.members;
  const enabled = members.filter((member) => member.disposition === "enabled");
  const source = members.find(
    (member) => member.providerId === sealed.sourceProviderId,
  );
  if (
    enabled.length !== 1 ||
    enabled[0]?.providerId !== sealed.destinationProviderId ||
    source?.disposition !== "revoked" ||
    source.reason !== "migration_completed"
  ) return failureV1("sealed_terminal", "terminal_binding_invalid");

  const endpoint = sealed.steadyRegistryCompletion
    .sourceDrainedRegistrySuccessorClosure.zeroLiveClosure.formalPlanEnvelope
    .payload.formalDestinationTrust.destinationEndpointTrust;
  if (
    endpoint.role !== "destination_prospective_not_selected" ||
    endpoint.prospectiveWriterProjection.providerId !==
      sealed.destinationProviderId
  ) return failureV1("sealed_terminal", "terminal_binding_invalid");
  const projection = endpoint.prospectiveWriterProjection;
  const destinationSelection = ProviderActiveWriterSelectionV1Schema.parse({
    targetProfileId: projection.targetProfileId,
    providerId: projection.providerId,
    registryEntryContentDigest: projection.registryEntryContentDigest,
    semanticProviderPolicyDigest: projection.semanticProviderPolicyDigest,
    providerFeasibilityEvidence: projection.providerFeasibilityEvidence,
    runtimeAttestationContentDigest:
      projection.runtimeAttestationContentDigest,
    bindingDerivationKeyGeneration:
      projection.bindingDerivationKeyGeneration,
  });

  const migrationState =
    inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineInternalV1(
      continuation.migrationOnlyAcceptanceReferenceMachineCapability,
    );
  const migrationHandoff =
    await retireProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceMachineForSteadyInternalV1(
      {
        identityVerificationCapability:
          continuation.acceptanceIdentityVerificationCapability,
        referenceMachineCapability:
          continuation.migrationOnlyAcceptanceReferenceMachineCapability,
        expectedState: migrationState,
      },
    );
  if (migrationHandoff === undefined) {
    return failureV1(
      "migration_acceptance_handoff",
      "stale_expected_acceptance",
    );
  }
  const predecessor = migrationState.currentAcceptance;
  let candidate;
  try {
    candidate =
      await buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCandidateInternalV1(
        {
          identityVerificationCapability:
            continuation.acceptanceIdentityVerificationCapability,
          installationIdentityGenerationId:
            sealed.installationIdentityGenerationId,
          acceptanceOrdinal: predecessor.acceptanceOrdinal + 1,
          predecessor: {
            state: "acceptance",
            generationId: predecessor.generationId,
            contentDigest: predecessor.contentDigest,
          },
          acceptedAt: acceptedAt.data,
          activeRootMetadata:
            sealed.currentRegistryManifestEnvelope.payload.activeRootMetadata,
          steadyRegistryManifestPin: sealed.currentRegistryManifestPin,
          currentSupportCatalogPin: sealed.currentSupportCatalogPin,
          destinationActiveWriterSelection: destinationSelection,
          formalMigrationId: sealed.formalMigrationId,
          formalPlanPin: sealed.formalPlanPin,
          terminalProgressReceiptContentDigest:
            sealed.terminalProgressReceipt.receiptContentDigest,
          terminalJournalReceiptContentDigest:
            sealed.terminalJournalReceiptContentDigest,
          sourceTombstoneRecordContentDigest:
            sealed.sourceTombstoneRecord.contentDigest,
          readyToActivateRecordContentDigest:
            sealed.readyToActivateRecord.contentDigest,
          sealedProgressHeadContentDigest:
            sealed.sealedProgressHead.contentDigest,
        },
      );
  } catch {
    return failureV1("final_candidate", "candidate_invalid");
  }

  let finalMachine;
  try {
    finalMachine =
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReferenceMachineInternalV1(
        {
          identityVerificationCapability:
            continuation.acceptanceIdentityVerificationCapability,
          migrationOnlyAcceptanceSteadyHandoffCapability: migrationHandoff,
        },
      );
  } catch {
    return failureV1("migration_acceptance_handoff", "capability_invalid");
  }
  const before =
    inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceMachineInternalV1(
      finalMachine,
    );
  const append =
    await compareAppendProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceMachineInternalV1(
      finalMachine,
      {
        request: CapturedObjectFreezeV1({
          profile:
            "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_compare_append_request_v1" as const,
          operationNonce: nonce.data,
          installationIdentityGenerationId:
            sealed.installationIdentityGenerationId,
          expected: CapturedObjectFreezeV1({
            highWaterRevision: before.highWaterRevision,
            currentAcceptance: before.currentAcceptance,
            currentVersionToken: before.currentVersionToken,
            generationCount: before.generationCount,
            generationSetDigest: before.generationSetDigest,
          }),
          candidate: candidate.acceptanceStateEnvelope,
        }),
        resolvedAt: resolvedAt.data,
      },
    );
  if (append.status !== "committed") {
    return failureV1(
      "acceptance_compare_append",
      append.status === "not_committed"
        ? "stale_expected_acceptance"
        : append.reason === "operation_nonce_conflict"
          ? "operation_nonce_conflict"
          : append.reason === "candidate_invalid"
            ? "candidate_invalid"
            : "append_rejected",
      append.status === "not_committed" ? append.receipt : undefined,
    );
  }
  const finalState =
    inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceMachineInternalV1(
      finalMachine,
    );
  const finalEnvelope = candidate.acceptanceStateEnvelope;
  const finalPin = candidate.acceptanceGenerationPin;
  const finalConfiguration = finalEnvelope.payload.configuration;
  if (append.receipt.outcome.state !== "committed") {
    return failureV1("acceptance_compare_append", "append_rejected");
  }
  if (
    finalState !== append.state ||
    finalState.finalStrongReadyAcceptance === "none" ||
    finalState.finalStrongReadyAcceptance.generationId !==
      finalEnvelope.generationId ||
    finalState.finalStrongReadyAcceptance.contentDigest !==
      finalEnvelope.contentDigest ||
    finalState.currentAcceptance.acceptanceOrdinal !==
      append.receipt.outcome.appendedAcceptance.acceptanceOrdinal ||
    finalState.currentAcceptance.generationId !==
      append.receipt.outcome.appendedAcceptance.generationId ||
    finalState.currentAcceptance.contentDigest !==
      append.receipt.outcome.appendedAcceptance.contentDigest ||
    finalState.acceptancePublicationCount !== 1 ||
    finalConfiguration.activation.origin !==
      "provider_migration_terminal_sealed_success_v1" ||
    finalConfiguration.core.activeWriterSelector.selections.length !== 1 ||
    finalConfiguration.core.activeWriterSelector.selections[0]?.providerId !==
      sealed.destinationProviderId ||
    finalConfiguration.core.providerRegistryManifest.contentDigest !==
      sealed.currentRegistryManifestPin.contentDigest ||
    finalConfiguration.core.providerSupportCatalog.contentDigest !==
      sealed.currentSupportCatalogPin.contentDigest ||
    finalConfiguration.activation.sealedProgressHeadContentDigest !==
      sealed.sealedProgressHead.contentDigest ||
    finalConfiguration.activation.formalPlanPin.contentDigest !==
      sealed.formalPlanPin.contentDigest
  ) return failureV1("acceptance_compare_append", "append_rejected");

  const value = CapturedObjectFreezeV1({
    authority:
      "in_memory_reference_machine_only_no_production_provider_authority_v1" as const,
    durability:
      "in_memory_reference_only_not_a_durable_provider_v1" as const,
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_reference_validation_v1" as const,
    relationship:
      "exact_terminal_sealed_new_destination_writer_final_strong_ready_acceptance_compare_appended_v1" as const,
    sealedTerminalJournal: sealed,
    candidateValidation: candidate,
    finalStrongReadyAcceptanceEnvelope: finalEnvelope,
    finalStrongReadyAcceptancePin: finalPin,
    acceptanceCompareAppendReceipt: append.receipt,
    acceptanceReferenceState: finalState,
    destinationProviderId: sealed.destinationProviderId,
    sourceWriterRetired: true as const,
    migrationOnlyWriterRetired: true as const,
    destinationOnlyPublicStrongWriter: true as const,
    finalSteadyRegistryAndCatalogBound: true as const,
    formalPlanAndTerminalSealBound: true as const,
    acceptancePublicationCount: 1 as const,
    publicStrongWriterPublicationCount: 1 as const,
  }) satisfies ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceValidationInternalV1;
  finalWriterContinuationsInternalV1.set(
    value,
    CapturedObjectFreezeV1({
      finalStrongReadyAcceptance: value,
      acceptanceStateEnvelope: finalEnvelope,
      acceptanceGenerationPin: finalPin,
      destinationProviderId: sealed.destinationProviderId,
    }),
  );
  return createProviderNonThenableFrozenRecordV1({ ok: true as const, value });
}

export function diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceDiagnosticResultInternalV1> {
  return hardenProviderPointPromiseV1(diagnoseInternalV1(input));
}

export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalDestinationStrongWriterContinuationInternalV1(
  exactFinalStrongReadySuccess:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceValidationInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalDestinationStrongWriterContinuationInternalV1 | undefined {
  if (
    exactFinalStrongReadySuccess === null ||
    typeof exactFinalStrongReadySuccess !== "object"
  ) return undefined;
  const continuation = finalWriterContinuationsInternalV1.get(
    exactFinalStrongReadySuccess,
  );
  if (
    continuation === undefined ||
    !finalWriterContinuationsInternalV1.delete(exactFinalStrongReadySuccess)
  ) return undefined;
  return continuation;
}

for (const exportedFunctionV1 of [
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalDestinationStrongWriterContinuationInternalV1,
]) CapturedObjectFreezeV1(exportedFunctionV1);
