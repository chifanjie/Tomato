/**
 * Package-private lifecycle composition through the zero-live metadata proof.
 *
 * The execution orchestrator first completes the exact formal-Plan object set
 * after the Root-signed rebinding Registry successor. This layer then consumes
 * that exact E2E success through its hidden one-shot continuation and forms the
 * destination-universe/zero-live closure. No capability is serialized into the
 * returned validation records.
 */

import {
  diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceOrchestratorInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceDiagnosticResultInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceOrchestratorInputInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-end-to-end-execution-reference-orchestrator-internal.js";
import {
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceFromExactEndToEndSuccessInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceDiagnosticResultInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-destination-universe-zero-live-reference-machine-internal.js";
import { LowerHex32V1Schema } from "./primitives.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceCandidateInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceDiagnosticResultInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-source-drained-registry-successor-reference-capability-internal.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistryManifestSourceCapabilityInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-source-drained-registry-successor-validator-internal.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceCandidateInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceDiagnosticResultInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-steady-registry-completion-reference-capability-internal.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistryManifestSourceCapabilityInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-steady-registry-successor-validator-internal.js";
import {
  compareSealProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalReferenceMachineInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealReferenceMachineInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealedValidationInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealResultInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-terminal-journal-seal-reference-machine-internal.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceDiagnosticResultInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-final-strong-ready-acceptance-reference-capability-internal.js";
import { ProviderRegistryIsoTimestampV1Schema } from "./provider-registry-trust.js";
import {
  createProviderNonThenableFrozenRecordV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";

const CapturedObjectFreezeV1 = Object.freeze;

type EndToEndFailureInternalV1 = Extract<
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceDiagnosticResultInternalV1,
  { readonly ok: false }
>;
type ZeroLiveFailureInternalV1 = Extract<
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceDiagnosticResultInternalV1,
  { readonly ok: false }
>;
type SourceDrainedRegistryFailureInternalV1 = Extract<
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceDiagnosticResultInternalV1,
  { readonly ok: false }
>;
type SteadyRegistryFailureInternalV1 = Extract<
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceDiagnosticResultInternalV1,
  { readonly ok: false }
>;
type TerminalJournalFailureInternalV1 = Extract<
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealResultInternalV1,
  { readonly status: "not_committed" | "rejected" }
>;
type FinalStrongReadyAcceptanceFailureInternalV1 = Extract<
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceDiagnosticResultInternalV1,
  { readonly ok: false }
>;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceOrchestratorInputInternalV1
  extends ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceOrchestratorInputInternalV1 {
  readonly externallySignedSourceDrainedRegistryManifestSourceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistryManifestSourceCapabilityInternalV1;
  readonly sourceDrainedRegistryOperationNonce: string;
  readonly externallySignedSteadyRegistryManifestSourceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistryManifestSourceCapabilityInternalV1;
  readonly steadyRegistryOperationNonce: string;
  readonly terminalJournalOperationNonce: string;
  readonly finalStrongReadyAcceptanceOperationNonce: string;
  readonly finalStrongReadyAcceptedAt: string;
  readonly finalStrongReadyResolvedAt: string;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceValidationInternalV1 {
  readonly authority: "in_memory_reference_machine_only_no_production_provider_authority_v1";
  readonly durability: "in_memory_reference_only_not_a_durable_provider_v1";
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_zero_live_lifecycle_reference_validation_v1";
  readonly relationship: "fresh_d43_d44_strict_d45_root_signed_rebinding_execution_completed_destination_universe_zero_live_root_signed_source_drained_root_signed_steady_registry_terminal_journal_sealed_final_destination_strong_ready_v1";
  readonly endToEndExecutionClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceValidationInternalV1;
  readonly zeroLiveClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceValidationInternalV1;
  readonly sourceDrainedRegistrySuccessorClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceValidationInternalV1;
  readonly steadyRegistryCompletionClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceValidationInternalV1;
  readonly terminalJournalSealedClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealedValidationInternalV1;
  readonly finalStrongReadyAcceptanceClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceValidationInternalV1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceDiagnosticResultInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceValidationInternalV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage: "end_to_end_execution";
      readonly reason: EndToEndFailureInternalV1["reason"];
      readonly upstreamStage: EndToEndFailureInternalV1["stage"];
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage: "zero_live";
      readonly reason: ZeroLiveFailureInternalV1["reason"];
      readonly upstreamStage: ZeroLiveFailureInternalV1["stage"];
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage: "source_drained_registry";
      readonly reason: SourceDrainedRegistryFailureInternalV1["reason"];
      readonly upstreamStage:
        | SourceDrainedRegistryFailureInternalV1["stage"]
        | "input";
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage: "steady_registry";
      readonly reason: SteadyRegistryFailureInternalV1["reason"];
      readonly upstreamStage:
        | SteadyRegistryFailureInternalV1["stage"]
        | "input";
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage: "terminal_journal";
      readonly reason: TerminalJournalFailureInternalV1["reason"];
      readonly upstreamStage: "input" | "mint" | "compare";
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage: "final_strong_ready_acceptance";
      readonly reason: FinalStrongReadyAcceptanceFailureInternalV1["reason"];
      readonly upstreamStage:
        | FinalStrongReadyAcceptanceFailureInternalV1["stage"]
        | "input";
    }>;

async function diagnoseZeroLiveLifecycleInternalV1(
  input:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceOrchestratorInputInternalV1,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceDiagnosticResultInternalV1> {
  const sourceDrainedRegistryOperationNonce = LowerHex32V1Schema.safeParse(
    input?.sourceDrainedRegistryOperationNonce,
  );
  if (!sourceDrainedRegistryOperationNonce.success) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "source_drained_registry" as const,
      reason: "schema_invalid" as const,
      upstreamStage: "input" as const,
    });
  }
  const steadyRegistryOperationNonce = LowerHex32V1Schema.safeParse(
    input?.steadyRegistryOperationNonce,
  );
  if (!steadyRegistryOperationNonce.success) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "steady_registry" as const,
      reason: "schema_invalid" as const,
      upstreamStage: "input" as const,
    });
  }
  const terminalJournalOperationNonce = LowerHex32V1Schema.safeParse(
    input?.terminalJournalOperationNonce,
  );
  if (!terminalJournalOperationNonce.success) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "terminal_journal" as const,
      reason: "schema_invalid" as const,
      upstreamStage: "input" as const,
    });
  }
  const finalStrongReadyAcceptanceOperationNonce = LowerHex32V1Schema.safeParse(
    input?.finalStrongReadyAcceptanceOperationNonce,
  );
  const finalStrongReadyAcceptedAt = ProviderRegistryIsoTimestampV1Schema.safeParse(
    input?.finalStrongReadyAcceptedAt,
  );
  const finalStrongReadyResolvedAt = ProviderRegistryIsoTimestampV1Schema.safeParse(
    input?.finalStrongReadyResolvedAt,
  );
  if (
    !finalStrongReadyAcceptanceOperationNonce.success ||
    !finalStrongReadyAcceptedAt.success ||
    !finalStrongReadyResolvedAt.success
  ) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "final_strong_ready_acceptance" as const,
      reason: "schema_invalid" as const,
      upstreamStage: "input" as const,
    });
  }
  const endToEnd =
    await diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceOrchestratorInternalV1(
      input,
    );
  if (!endToEnd.ok) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "end_to_end_execution" as const,
      reason: endToEnd.reason,
      upstreamStage: endToEnd.stage,
    });
  }
  const zeroLive =
    buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceFromExactEndToEndSuccessInternalV1(
      endToEnd.value,
    );
  if (!zeroLive.ok) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "zero_live" as const,
      reason: zeroLive.reason,
      upstreamStage: zeroLive.stage,
    });
  }
  const sourceDrainedRegistry =
    await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceCandidateInternalV1(
      {
        zeroLiveClosure: zeroLive.value,
        externallySignedSourceDrainedRegistryManifestSourceCapability:
          input.externallySignedSourceDrainedRegistryManifestSourceCapability,
        operationNonce: sourceDrainedRegistryOperationNonce.data,
      },
    );
  if (!sourceDrainedRegistry.ok) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "source_drained_registry" as const,
      reason: sourceDrainedRegistry.reason,
      upstreamStage: sourceDrainedRegistry.stage,
    });
  }
  const steadyRegistry =
    await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceCandidateInternalV1(
      {
        sourceDrainedRegistrySuccessor: sourceDrainedRegistry.value,
        externallySignedSteadyRegistryManifestSourceCapability:
          input.externallySignedSteadyRegistryManifestSourceCapability,
        operationNonce: steadyRegistryOperationNonce.data,
      },
    );
  if (!steadyRegistry.ok) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "steady_registry" as const,
      reason: steadyRegistry.reason,
      upstreamStage: steadyRegistry.stage,
    });
  }
  let terminalJournalMachine;
  try {
    terminalJournalMachine =
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealReferenceMachineInternalV1(
        { steadyRegistryCompletion: steadyRegistry.value },
      );
  } catch {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "terminal_journal" as const,
      reason: "capability_invalid" as const,
      upstreamStage: "mint" as const,
    });
  }
  const terminalJournal =
    compareSealProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalReferenceMachineInternalV1(
      terminalJournalMachine,
      CapturedObjectFreezeV1({
        operationNonce: terminalJournalOperationNonce.data,
        expectedJournalRevision: 0,
        expectedSteadyRegistryManifestPin:
          steadyRegistry.value.currentRegistryManifestPin,
      }),
    );
  if (terminalJournal.status !== "committed") {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "terminal_journal" as const,
      reason: terminalJournal.reason,
      upstreamStage: "compare" as const,
    });
  }
  const finalStrongReadyAcceptance =
    await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceInternalV1(
      {
        sealedTerminalJournal: terminalJournal.value,
        operationNonce: finalStrongReadyAcceptanceOperationNonce.data,
        acceptedAt: finalStrongReadyAcceptedAt.data,
        resolvedAt: finalStrongReadyResolvedAt.data,
      },
    );
  if (!finalStrongReadyAcceptance.ok) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "final_strong_ready_acceptance" as const,
      reason: finalStrongReadyAcceptance.reason,
      upstreamStage: finalStrongReadyAcceptance.stage,
    });
  }
  const value = CapturedObjectFreezeV1({
    authority:
      "in_memory_reference_machine_only_no_production_provider_authority_v1" as const,
    durability:
      "in_memory_reference_only_not_a_durable_provider_v1" as const,
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_zero_live_lifecycle_reference_validation_v1" as const,
    relationship:
      "fresh_d43_d44_strict_d45_root_signed_rebinding_execution_completed_destination_universe_zero_live_root_signed_source_drained_root_signed_steady_registry_terminal_journal_sealed_final_destination_strong_ready_v1" as const,
    endToEndExecutionClosure: endToEnd.value,
    zeroLiveClosure: zeroLive.value,
    sourceDrainedRegistrySuccessorClosure: sourceDrainedRegistry.value,
    steadyRegistryCompletionClosure: steadyRegistry.value,
    terminalJournalSealedClosure: terminalJournal.value,
    finalStrongReadyAcceptanceClosure: finalStrongReadyAcceptance.value,
  }) satisfies ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceValidationInternalV1;
  return createProviderNonThenableFrozenRecordV1({ ok: true as const, value });
}

export function diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceOrchestratorInternalV1(
  input:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceOrchestratorInputInternalV1,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceDiagnosticResultInternalV1> {
  return hardenProviderPointPromiseV1(
    diagnoseZeroLiveLifecycleInternalV1(input),
  );
}

CapturedObjectFreezeV1(
  diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceOrchestratorInternalV1,
);
