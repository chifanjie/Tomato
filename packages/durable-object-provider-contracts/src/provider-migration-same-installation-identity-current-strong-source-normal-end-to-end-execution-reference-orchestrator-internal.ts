/**
 * Package-private executable reference choreography for the exact
 * same-Identity migration path:
 *
 * fresh D43 -> committed D44 -> strict migration-only D45 -> plan-only
 * execution of every formal-Plan object -> source drained -> completed.
 *
 * This remains process-local reference state. It is neither durable Provider
 * authority nor a production publication/execution implementation.
 */

import { createDomainPreimageBytesV1 } from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import { LowerHex32V1Schema } from "./primitives.js";
import {
  compareAdvanceProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1,
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompletedExecutionContinuationInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompletedExecutionContinuationInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionPhaseInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReceiptInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressStateInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionTransitionInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-execution-progress-reference-machine-internal.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCandidateInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceBoundBuildInputInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceDiagnosticResultInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-reference-capability-internal.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistryManifestSourceCapabilityInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-rebinding-registry-successor-validator-internal.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceCandidateInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceDiagnosticResultInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-rebinding-registry-successor-reference-capability-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedWeakMapV1 = WeakMap;

const EXECUTION_NONCE_DOMAIN_V1 =
  "provider-migration-same-installation-identity-current-strong-source-normal-end-to-end-execution-operation-nonce-v1";

const completedExecutionContinuationsInternalV1 =
  new CapturedWeakMapV1<
    object,
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompletedExecutionContinuationInternalV1
  >();

type MigrationOnlyAcceptanceFailureInternalV1 = Extract<
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceDiagnosticResultInternalV1,
  { readonly ok: false }
>;
type RebindingRegistryFailureInternalV1 = Extract<
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceDiagnosticResultInternalV1,
  { readonly ok: false }
>;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceOrchestratorInputInternalV1 {
  readonly migrationOnlyAcceptanceBuildInput:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceBoundBuildInputInternalV1;
  readonly externallySignedRebindingRegistryManifestSourceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistryManifestSourceCapabilityInternalV1;
  readonly rebindingRegistryOperationNonce: string;
  readonly executionOperationNonceSeed: string;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceValidationInternalV1 {
  readonly authority: "in_memory_reference_machine_only_no_production_provider_authority_v1";
  readonly durability: "in_memory_reference_only_not_a_durable_provider_v1";
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_end_to_end_execution_reference_validation_v1";
  readonly relationship: "fresh_d43_committed_d44_strict_migration_only_d45_root_signed_rebinding_registry_plan_only_execution_completed_v1";
  readonly migrationOnlyAcceptanceClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceValidationInternalV1;
  readonly rebindingRegistrySuccessorClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceValidationInternalV1;
  readonly executionProgressState:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressStateInternalV1;
  readonly terminalReceipt:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReceiptInternalV1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceDiagnosticResultInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceValidationInternalV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage: "input";
      readonly reason: "schema_invalid";
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage: "migration_only_acceptance";
      readonly reason: MigrationOnlyAcceptanceFailureInternalV1["reason"];
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage: "registry_rebinding";
      readonly reason: RebindingRegistryFailureInternalV1["reason"];
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage: "execution_authority";
      readonly reason:
        | "strict_migration_only_boundary_invalid"
        | "capability_invalid";
      readonly migrationOnlyAcceptanceClosure:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceValidationInternalV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage: "execution_progress";
      readonly reason:
        | "capability_invalid"
        | "schema_invalid"
        | "operation_nonce_conflict"
        | "transition_invalid"
        | "stale_expected_progress";
      readonly transition:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionTransitionInternalV1;
      readonly sourceObjectOrdinal: number | "none";
      readonly migrationOnlyAcceptanceClosure:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceValidationInternalV1;
      readonly observedExecutionState:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressStateInternalV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage: "execution_terminal";
      readonly reason: "terminal_state_invalid";
      readonly migrationOnlyAcceptanceClosure:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceValidationInternalV1;
      readonly observedExecutionState:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressStateInternalV1;
    }>;

function bytesToLowerHex16V1(bytes: Uint8Array): string {
  const alphabet = "0123456789abcdef";
  let output = "";
  for (let index = 0; index < 16; index += 1) {
    const byte = bytes[index]!;
    output +=
      alphabet[(byte >>> 4) & 0x0f]! + alphabet[byte & 0x0f]!;
  }
  return output;
}

function deriveExecutionOperationNonceV1(
  seed: string,
  formalMigrationId: string,
  transition:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionTransitionInternalV1,
  sourceObjectOrdinal: number | "none",
): string {
  return LowerHex32V1Schema.parse(
    bytesToLowerHex16V1(
      sha256InternalV1(
        createDomainPreimageBytesV1(EXECUTION_NONCE_DOMAIN_V1, {
          seed,
          formalMigrationId,
          transition,
          sourceObjectOrdinal,
        }),
      ),
    ),
  );
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) ===
    canonicalizeJcsSafeIntegerV1(right);
}

function strictMigrationOnlyBoundaryIsValidV1(
  acceptance:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceValidationInternalV1,
): boolean {
  const configuration = acceptance.configuration;
  const formalPlan = acceptance.formalPlanPublicationClosure;
  const sourceReadClosure =
    formalPlan.formalPlanEnvelope.payload.completeSourceReadClosure;
  return (
    acceptance.migrationOnlyAcceptanceEnvelope.payload.configuration.state ===
      "migration_only" &&
    configuration.state === "migration_only" &&
    configuration.publicStrongWriter.state === "disabled" &&
    configuration.executor.state === "enabled_for_plan_only" &&
    configuration.executor.formalMigrationId ===
      formalPlan.formalPlanPin.formalMigrationId &&
    canonicalEqualV1(
      configuration,
      acceptance.migrationOnlyAcceptanceEnvelope.payload.configuration,
    ) &&
    canonicalEqualV1(configuration.formalPlanPin, formalPlan.formalPlanPin) &&
    acceptance.sourceObjectCount === sourceReadClosure.objectCount &&
    acceptance.sourceLogicalBytes ===
      sourceReadClosure.logicalObjectBytesTotal &&
    acceptance.sourceObjectCount >= 1
  );
}

function destinationPublicationsExactlyCoverPlanV1(
  state:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressStateInternalV1,
): boolean {
  const plan = state.formalPlanEnvelope.payload;
  const objects = plan.completeSourceReadClosure.objects;
  const publications = state.destinationObjectPublications;
  const destinationEndpoint =
    plan.formalDestinationTrust.destinationEndpointTrust;
  if (
    destinationEndpoint.role !== "destination_prospective_not_selected" ||
    state.destinationPublicationMode !==
      "metadata_only_in_memory_reference_no_external_destination_write_v1" ||
    publications.length !== objects.length ||
    state.highWater.destinationObjectPublicationCount !== objects.length
  ) return false;
  const destination = destinationEndpoint.prospectiveWriterProjection;
  for (let ordinal = 0; ordinal < objects.length; ordinal += 1) {
    const source = objects[ordinal]!;
    const publication = publications[ordinal]!;
    const binding = publication.destinationProviderBinding;
    if (
      source.objectOrdinal !== ordinal ||
      publication.publicationOrdinal !== ordinal ||
      publication.sourceObjectOrdinal !== ordinal ||
      publication.sourceContentDigest !== source.contentDigest ||
      publication.sourceSemanticLocatorDigest !==
        source.semanticLocatorDigest ||
      publication.sourceLogicalLocatorReferenceDigest !==
        source.logicalLocatorReferenceDigest ||
      publication.sourceProviderBindingReferenceDigest !==
        source.providerBindingReferenceDigest ||
      publication.sourceLogicalBytes !== source.logicalBytes ||
      publication.destinationProviderId !== destination.providerId ||
      binding.providerId !== destination.providerId ||
      binding.targetProfileId !== destination.targetProfileId ||
      binding.registryEntryContentDigest !==
        destination.registryEntryContentDigest ||
      binding.semanticProviderPolicyDigest !==
        destination.semanticProviderPolicyDigest ||
      binding.runtimeAttestationContentDigest !==
        destination.runtimeAttestationContentDigest ||
      binding.bindingDerivationKeyGeneration !==
        destination.bindingDerivationKeyGeneration ||
      !canonicalEqualV1(publication.formalPlanPin, state.formalPlanPin)
    ) return false;
  }
  return true;
}

function acceptanceFailureV1(
  failure: MigrationOnlyAcceptanceFailureInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceDiagnosticResultInternalV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage: "migration_only_acceptance" as const,
    reason: failure.reason,
  });
}

async function diagnoseEndToEndExecutionInternalV1(
  input: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceOrchestratorInputInternalV1,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceDiagnosticResultInternalV1> {
  const seed = LowerHex32V1Schema.safeParse(
    input?.executionOperationNonceSeed,
  );
  const rebindingRegistryOperationNonce = LowerHex32V1Schema.safeParse(
    input?.rebindingRegistryOperationNonce,
  );
  if (!seed.success || !rebindingRegistryOperationNonce.success) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "input" as const,
      reason: "schema_invalid" as const,
    });
  }
  const acceptanceResult =
    await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCandidateInternalV1(
      input.migrationOnlyAcceptanceBuildInput,
    );
  if (!acceptanceResult.ok) return acceptanceFailureV1(acceptanceResult);
  const acceptance = acceptanceResult.value;
  if (!strictMigrationOnlyBoundaryIsValidV1(acceptance)) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "execution_authority" as const,
      reason: "strict_migration_only_boundary_invalid" as const,
      migrationOnlyAcceptanceClosure: acceptance,
    });
  }

  const rebindingResult =
    await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceCandidateInternalV1(
      {
        migrationOnlyAcceptance: acceptance,
        externallySignedRebindingRegistryManifestSourceCapability:
          input.externallySignedRebindingRegistryManifestSourceCapability,
        operationNonce: rebindingRegistryOperationNonce.data,
      },
    );
  if (!rebindingResult.ok) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "registry_rebinding" as const,
      reason: rebindingResult.reason,
    });
  }
  const rebinding = rebindingResult.value;
  const rebindingRouting =
    rebinding.currentRegistryManifestEnvelope.payload.routing;
  if (
    rebinding.migrationOnlyAcceptanceClosure !== acceptance ||
    rebindingRouting.state !== "migration" ||
    rebindingRouting.phase !== "rebinding" ||
    rebindingRouting.activeForMigrationWrites !==
      rebindingRouting.destinationProviderId ||
    !canonicalEqualV1(
      rebinding.currentRegistryManifestPin,
      rebinding.rebindingRegistryManifestPin,
    )
  ) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "registry_rebinding" as const,
      reason: "publication_rejected" as const,
    });
  }

  let executionCapability;
  try {
    executionCapability =
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        { rebindingRegistrySuccessor: rebinding },
      );
  } catch {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "execution_authority" as const,
      reason: "capability_invalid" as const,
      migrationOnlyAcceptanceClosure: acceptance,
    });
  }

  const formalMigrationId =
    acceptance.formalPlanPublicationClosure.formalPlanPin.formalMigrationId;
  let revision = 0;
  let phase:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionPhaseInternalV1 =
      "accepted";
  let terminalReceipt:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReceiptInternalV1 | undefined;

  const advanceV1 = (
    transition:
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionTransitionInternalV1,
    sourceObjectOrdinal: number | "none",
  ) => {
    const result =
      compareAdvanceProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        executionCapability,
        CapturedObjectFreezeV1({
          operationNonce: deriveExecutionOperationNonceV1(
            seed.data,
            formalMigrationId,
            transition,
            sourceObjectOrdinal,
          ),
          expectedProgressRevision: revision,
          expectedPhase: phase,
          transition,
          sourceObjectOrdinal,
        }),
      );
    if (result.status === "committed") {
      terminalReceipt = result.receipt;
      revision = result.receipt.committedHighWater.progressRevision;
      phase = result.receipt.committedHighWater.phase;
      return undefined;
    }
    const observedExecutionState =
      inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        executionCapability,
      );
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "execution_progress" as const,
      reason: result.reason,
      transition,
      sourceObjectOrdinal,
      migrationOnlyAcceptanceClosure: acceptance,
      observedExecutionState,
    });
  };

  let failure = advanceV1("start_execution", "none");
  if (failure !== undefined) return failure;
  for (
    let ordinal = 0;
    ordinal < acceptance.sourceObjectCount;
    ordinal += 1
  ) {
    failure = advanceV1("commit_source_object", ordinal);
    if (failure !== undefined) return failure;
  }
  failure = advanceV1("mark_source_drained", "none");
  if (failure !== undefined) return failure;
  failure = advanceV1("complete_execution", "none");
  if (failure !== undefined) return failure;

  const executionProgressState =
    inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
      executionCapability,
    );
  if (
    terminalReceipt === undefined ||
    executionProgressState.highWater.phase !== "completed" ||
    executionProgressState.highWater.copiedObjectCount !==
      acceptance.sourceObjectCount ||
    executionProgressState.highWater.remainingSourceObjectCount !== 0 ||
    executionProgressState.highWater.copiedLogicalBytes !==
      acceptance.sourceLogicalBytes ||
    !destinationPublicationsExactlyCoverPlanV1(executionProgressState)
  ) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "execution_terminal" as const,
      reason: "terminal_state_invalid" as const,
      migrationOnlyAcceptanceClosure: acceptance,
      observedExecutionState: executionProgressState,
    });
  }
  const value = CapturedObjectFreezeV1({
    authority:
      "in_memory_reference_machine_only_no_production_provider_authority_v1" as const,
    durability:
      "in_memory_reference_only_not_a_durable_provider_v1" as const,
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_end_to_end_execution_reference_validation_v1" as const,
    relationship:
      "fresh_d43_committed_d44_strict_migration_only_d45_root_signed_rebinding_registry_plan_only_execution_completed_v1" as const,
    migrationOnlyAcceptanceClosure: acceptance,
    rebindingRegistrySuccessorClosure: rebinding,
    executionProgressState,
    terminalReceipt,
  }) satisfies ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceValidationInternalV1;
  const completedExecutionContinuation =
    takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompletedExecutionContinuationInternalV1(
      executionCapability,
      executionProgressState,
    );
  if (completedExecutionContinuation === undefined) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "execution_terminal" as const,
      reason: "terminal_state_invalid" as const,
      migrationOnlyAcceptanceClosure: acceptance,
      observedExecutionState: executionProgressState,
    });
  }
  completedExecutionContinuationsInternalV1.set(
    value,
    completedExecutionContinuation,
  );
  return createProviderNonThenableFrozenRecordV1({ ok: true as const, value });
}

export function diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceOrchestratorInternalV1(
  input: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceOrchestratorInputInternalV1,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceDiagnosticResultInternalV1> {
  return hardenProviderPointPromiseV1(
    diagnoseEndToEndExecutionInternalV1(input),
  );
}

/**
 * Exact-success keyed, one-shot handoff for the next source-drained Registry
 * slice. The execution capability and continuation never enter public result
 * fields.
 */
export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndCompletedExecutionContinuationInternalV1(
  exactEndToEndSuccess:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceValidationInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompletedExecutionContinuationInternalV1 | undefined {
  if (
    exactEndToEndSuccess === null ||
    typeof exactEndToEndSuccess !== "object"
  ) return undefined;
  const continuation = completedExecutionContinuationsInternalV1.get(
    exactEndToEndSuccess,
  );
  if (
    continuation === undefined ||
    !completedExecutionContinuationsInternalV1.delete(exactEndToEndSuccess)
  ) return undefined;
  return continuation;
}

CapturedObjectFreezeV1(
  diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceOrchestratorInternalV1,
);
CapturedObjectFreezeV1(
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndCompletedExecutionContinuationInternalV1,
);
