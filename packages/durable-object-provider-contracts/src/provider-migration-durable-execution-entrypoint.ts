/**
 * Candidate package-level entrypoint for the durable migration execution
 * slice. It accepts the original lifecycle build input and a host capability;
 * it deliberately does not accept a serialized/reference lifecycle result.
 * The internal orchestrator remains the only place that can mint the exact
 * lifecycle closure and hand it to the durable host.
 */

import type {
  ProviderRuntimeIpcCompareCommitResultV1,
  ProviderRuntimeIpcFixedObjectLocatorV1,
  ProviderRuntimeIpcJournalStateV1,
  ProviderRuntimeIpcJsonValueV1,
  ProviderRuntimeIpcReadObjectResultV1,
  ProviderRuntimeIpcWriteObjectResultV1,
} from "./provider-runtime-ipc-v1.js";
import type {
  ProviderStrongReadyAcceptanceGenerationPinCandidateV1,
} from "./provider-strong-ready-acceptance-candidate.js";
import {
  diagnoseProviderMigrationDurableExecutionOrchestratorInternalV1,
  type ProviderMigrationDurableExecutionDiagnosticResultInternalV1,
  type ProviderMigrationDurableExecutionHostCapabilityInternalV1,
  type ProviderMigrationDurableExecutionOrchestratorInputInternalV1,
  type ProviderMigrationDurableExecutionValidationInternalV1,
} from "./provider-migration-durable-execution-orchestrator-internal.js";
import type { ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceOrchestratorInputInternalV1 } from "./provider-migration-same-installation-identity-current-strong-source-normal-zero-live-lifecycle-reference-orchestrator-internal.js";

export type ProviderMigrationDurableExecutionLifecycleInputV1 =
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceOrchestratorInputInternalV1;

export interface ProviderMigrationDurableExecutionHostV1 {
  readonly profile: "provider_migration_durable_execution_host_capability_v1";
  readonly sourceProviderId: string;
  readonly destinationProviderId: string;
  readSourceObject(
    locator: ProviderRuntimeIpcFixedObjectLocatorV1,
  ): Promise<ProviderRuntimeIpcReadObjectResultV1>;
  writeDestinationObject(input: {
    readonly locator: ProviderRuntimeIpcFixedObjectLocatorV1;
    readonly logicalBytes: number;
    readonly bytes: string;
  }): Promise<ProviderRuntimeIpcWriteObjectResultV1>;
  compareCommitDestinationJournal(input: {
    readonly expectedRevision: number;
    readonly operationNonce: string;
    readonly phase: string;
    readonly artifacts: Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>>;
  }): Promise<ProviderRuntimeIpcCompareCommitResultV1>;
}

export interface RunProviderMigrationDurableExecutionInputV1 {
  readonly lifecycleInput: ProviderMigrationDurableExecutionLifecycleInputV1;
  readonly durableHost: ProviderMigrationDurableExecutionHostV1;
  readonly expectedDurableJournalRevision: number;
  readonly durableOperationNonceSeed: string;
}

export interface ProviderMigrationDurableExecutionSummaryV1 {
  readonly profile: "provider_migration_durable_execution_summary_v1";
  readonly durability: "separate_process_private_filesystem_durable_candidate_v1";
  readonly osIsolationAuthority: "not_yet_proven_service_principal_v1";
  readonly strongWriteCapability: "locked_to_verified_runtime_selection_v1";
  readonly sourceProviderId: string;
  readonly destinationProviderId: string;
  readonly copiedObjectCount: number;
  readonly copiedLogicalBytes: number;
  readonly finalJournalRevision: number;
  readonly finalJournalPhase: string;
  readonly finalJournalMutationDigest:
    ProviderRuntimeIpcJournalStateV1["mutationDigest"];
  readonly finalStrongReadyAcceptancePin:
    ProviderStrongReadyAcceptanceGenerationPinCandidateV1;
}

export type ProviderMigrationDurableExecutionEntrypointResultV1 =
  | Readonly<{
      readonly ok: true;
      readonly value: ProviderMigrationDurableExecutionSummaryV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage:
        | "reference_lifecycle"
        | "durable_host_binding"
        | "source_read"
        | "destination_write"
        | "journal_compare_commit";
      readonly reason:
        | "reference_lifecycle_rejected"
        | "schema_invalid"
        | "provider_binding_mismatch"
        | "host_operation_failed"
        | "source_object_mismatch"
        | "destination_object_mismatch"
        | "stale_expected_journal";
      readonly sourceObjectOrdinal?: number;
      readonly observedJournalRevision?: number;
      readonly upstreamStage?: string;
    }>;

function mapFailureV1(
  failure: Extract<
    ProviderMigrationDurableExecutionDiagnosticResultInternalV1,
    { readonly ok: false }
  >,
): ProviderMigrationDurableExecutionEntrypointResultV1 {
  return Object.freeze({
    ok: false as const,
    stage: failure.stage,
    reason: failure.reason,
    ...(failure.sourceObjectOrdinal === undefined
      ? {}
      : { sourceObjectOrdinal: failure.sourceObjectOrdinal }),
    ...(failure.observedJournalRevision === undefined
      ? {}
      : { observedJournalRevision: failure.observedJournalRevision }),
    ...(failure.upstream === undefined || failure.upstream.ok
      ? {}
      : { upstreamStage: failure.upstream.stage }),
  });
}

export async function runProviderMigrationDurableExecutionV1(
  input: RunProviderMigrationDurableExecutionInputV1,
): Promise<ProviderMigrationDurableExecutionEntrypointResultV1> {
  const internalInput: ProviderMigrationDurableExecutionOrchestratorInputInternalV1 =
    {
      ...input.lifecycleInput,
      durableHostCapability: input.durableHost as ProviderMigrationDurableExecutionHostCapabilityInternalV1,
      expectedDurableJournalRevision: input.expectedDurableJournalRevision,
      durableOperationNonceSeed: input.durableOperationNonceSeed,
    };
  const result =
    await diagnoseProviderMigrationDurableExecutionOrchestratorInternalV1(
      internalInput,
    );
  if (!result.ok) return mapFailureV1(result);
  const value: ProviderMigrationDurableExecutionValidationInternalV1 =
    result.value;
  return Object.freeze({
    ok: true as const,
    value: Object.freeze({
      profile: "provider_migration_durable_execution_summary_v1" as const,
      durability:
        "separate_process_private_filesystem_durable_candidate_v1" as const,
      osIsolationAuthority: "not_yet_proven_service_principal_v1" as const,
      strongWriteCapability:
        "locked_to_verified_runtime_selection_v1" as const,
      sourceProviderId: value.sourceProviderId,
      destinationProviderId: value.destinationProviderId,
      copiedObjectCount: value.copiedObjectCount,
      copiedLogicalBytes: value.copiedLogicalBytes,
      finalJournalRevision: value.finalJournalState.revision,
      finalJournalPhase: value.finalJournalState.phase,
      finalJournalMutationDigest: value.finalJournalState.mutationDigest,
      finalStrongReadyAcceptancePin: Object.freeze({
        ...value.referenceLifecycle.finalStrongReadyAcceptanceClosure
          .finalStrongReadyAcceptancePin,
      }),
    }),
  });
}
