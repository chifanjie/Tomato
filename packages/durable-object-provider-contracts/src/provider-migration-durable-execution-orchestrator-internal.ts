/**
 * Package-private bridge from the fully validated same-Identity lifecycle to
 * an isolated durable Provider host. The reference lifecycle is executed in
 * this call; callers cannot submit a previously serialized none-authority DTO
 * as durable authority.
 */

import { createDomainPreimageBytesV1 } from "./domain-crypto.js";
import type {
  ProviderRuntimeIpcCompareCommitResultV1,
  ProviderRuntimeIpcFixedObjectLocatorV1,
  ProviderRuntimeIpcJsonValueV1,
  ProviderRuntimeIpcReadObjectResultV1,
  ProviderRuntimeIpcWriteObjectResultV1,
} from "./provider-runtime-ipc-v1.js";
import {
  diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceOrchestratorInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceDiagnosticResultInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceOrchestratorInputInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-zero-live-lifecycle-reference-orchestrator-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import { sha256InternalV1 } from "./sha256.js";

const PHASE_NONCE_DOMAIN_V1 =
  "provider-migration-durable-execution-phase-operation-nonce-v1";

export interface ProviderMigrationDurableExecutionHostCapabilityInternalV1 {
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
    readonly artifacts: Readonly<
      Record<string, ProviderRuntimeIpcJsonValueV1>
    >;
  }): Promise<ProviderRuntimeIpcCompareCommitResultV1>;
}

export interface ProviderMigrationDurableExecutionOrchestratorInputInternalV1
  extends ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceOrchestratorInputInternalV1 {
  readonly durableHostCapability:
    ProviderMigrationDurableExecutionHostCapabilityInternalV1;
  readonly expectedDurableJournalRevision: number;
  readonly durableOperationNonceSeed: string;
}

export interface ProviderMigrationDurableExecutionValidationInternalV1 {
  readonly profile: "provider_migration_durable_execution_validation_v1";
  readonly durability: "separate_process_private_filesystem_durable_candidate_v1";
  readonly osIsolationAuthority: "not_yet_proven_service_principal_v1";
  readonly strongWriteCapability: "locked_to_verified_runtime_selection_v1";
  readonly relationship: "internally_validated_lifecycle_plan_objects_copied_and_phased_journal_committed_v1";
  readonly sourceProviderId: string;
  readonly destinationProviderId: string;
  readonly copiedObjectCount: number;
  readonly copiedLogicalBytes: number;
  readonly destinationObjectPublications:
    readonly ProviderRuntimeIpcWriteObjectResultV1[];
  readonly finalJournalState:
    ProviderRuntimeIpcCompareCommitResultV1["state"];
  readonly referenceLifecycle:
    Extract<
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceDiagnosticResultInternalV1,
      { readonly ok: true }
    >["value"];
}

export type ProviderMigrationDurableExecutionDiagnosticResultInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value: ProviderMigrationDurableExecutionValidationInternalV1;
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
      readonly upstream?:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceDiagnosticResultInternalV1;
    }>;

function bytesToLowerHex32V1(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < 16; index += 1) {
    output += bytes[index]!.toString(16).padStart(2, "0");
  }
  return output;
}

function phaseNonceV1(seed: string, phase: string): string {
  return bytesToLowerHex32V1(
    sha256InternalV1(
      createDomainPreimageBytesV1(PHASE_NONCE_DOMAIN_V1, { seed, phase }),
    ),
  );
}

function jsonValueV1(value: unknown): ProviderRuntimeIpcJsonValueV1 {
  return JSON.parse(JSON.stringify(value)) as ProviderRuntimeIpcJsonValueV1;
}

async function diagnoseInternalV1(
  input: ProviderMigrationDurableExecutionOrchestratorInputInternalV1,
): Promise<ProviderMigrationDurableExecutionDiagnosticResultInternalV1> {
  if (
    !Number.isSafeInteger(input?.expectedDurableJournalRevision) ||
    input.expectedDurableJournalRevision < 0 ||
    !/^[0-9a-f]{32}$/u.test(input?.durableOperationNonceSeed) ||
    input?.durableHostCapability?.profile !==
      "provider_migration_durable_execution_host_capability_v1"
  ) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "durable_host_binding" as const,
      reason: "schema_invalid" as const,
    });
  }

  const lifecycle =
    await diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceOrchestratorInternalV1(
      input,
    );
  if (!lifecycle.ok) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "reference_lifecycle" as const,
      reason: "reference_lifecycle_rejected" as const,
      upstream: lifecycle,
    });
  }
  const exactLifecycle = lifecycle.value;
  const zeroLive = exactLifecycle.zeroLiveClosure;
  const host = input.durableHostCapability;
  if (
    host.sourceProviderId !== zeroLive.sourceProviderId ||
    host.destinationProviderId !== zeroLive.destinationProviderId
  ) {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "durable_host_binding" as const,
      reason: "provider_binding_mismatch" as const,
    });
  }

  const endToEnd = exactLifecycle.endToEndExecutionClosure;
  const acceptance = endToEnd.migrationOnlyAcceptanceClosure;
  const formal = acceptance.formalPlanPublicationClosure;
  const objects = formal.formalPlanEnvelope.payload.completeSourceReadClosure.objects;
  let revision = input.expectedDurableJournalRevision;
  let copiedLogicalBytes = 0;
  const publications: ProviderRuntimeIpcWriteObjectResultV1[] = [];
  const preparedArtifacts = {
    preparedCatalogSuccessor: jsonValueV1(formal.preparedCatalogSuccessorClosure),
    registryManifest: jsonValueV1(formal.currentRegistryManifestEnvelope),
    supportCatalog: jsonValueV1(formal.currentSupportCatalogEnvelope),
    formalPlan: jsonValueV1(formal.formalPlanEnvelope),
    formalPlanPin: jsonValueV1(formal.formalPlanPin),
    formalReservation: jsonValueV1(formal.formalReservationDescriptor),
    reservationRecord: jsonValueV1(formal.reservationRecord),
    compoundPublicationReceipt: jsonValueV1(formal.committedReceipt),
    migrationOnlyAcceptance: jsonValueV1(acceptance),
    rebindingRegistry: jsonValueV1(endToEnd.rebindingRegistrySuccessorClosure),
  };

  const commitPhaseV1 = async (
    phase: string,
    artifacts: Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>>,
  ) => {
    const result = await host.compareCommitDestinationJournal({
      expectedRevision: revision,
      operationNonce: phaseNonceV1(input.durableOperationNonceSeed, phase),
      phase,
      artifacts,
    });
    if (result.resolution !== "stale") revision = result.state.revision;
    return result;
  };

  try {
    const prepared = await commitPhaseV1(
      "migration_only_rebinding_prepared",
      preparedArtifacts,
    );
    if (prepared.resolution === "stale") {
      return createProviderNonThenableFrozenRecordV1({
        ok: false as const,
        stage: "journal_compare_commit" as const,
        reason: "stale_expected_journal" as const,
        observedJournalRevision: prepared.state.revision,
      });
    }

    for (let ordinal = 0; ordinal < objects.length; ordinal += 1) {
      const object = objects[ordinal]!;
      if (object.objectOrdinal !== ordinal) {
        return createProviderNonThenableFrozenRecordV1({
          ok: false as const,
          stage: "source_read" as const,
          reason: "source_object_mismatch" as const,
          sourceObjectOrdinal: ordinal,
        });
      }
      const source = await host.readSourceObject({
        providerId: zeroLive.sourceProviderId as never,
        contentDigest: object.contentDigest,
      });
      if (
        source.locator.providerId !== zeroLive.sourceProviderId ||
        source.verifiedContentDigest !== object.contentDigest ||
        source.logicalBytes !== object.logicalBytes
      ) {
        return createProviderNonThenableFrozenRecordV1({
          ok: false as const,
          stage: "source_read" as const,
          reason: "source_object_mismatch" as const,
          sourceObjectOrdinal: ordinal,
        });
      }
      const publication = await host.writeDestinationObject({
        locator: {
          providerId: zeroLive.destinationProviderId as never,
          contentDigest: object.contentDigest,
        },
        logicalBytes: object.logicalBytes,
        bytes: source.bytes,
      });
      if (
        publication.locator.providerId !== zeroLive.destinationProviderId ||
        publication.verifiedContentDigest !== object.contentDigest ||
        publication.logicalBytes !== object.logicalBytes
      ) {
        return createProviderNonThenableFrozenRecordV1({
          ok: false as const,
          stage: "destination_write" as const,
          reason: "destination_object_mismatch" as const,
          sourceObjectOrdinal: ordinal,
        });
      }
      publications.push(publication);
      copiedLogicalBytes += object.logicalBytes;
    }

    const executionArtifacts = {
      ...preparedArtifacts,
      executionProgress: jsonValueV1(endToEnd.executionProgressState),
      destinationObjectPublications: jsonValueV1(publications),
    };
    const execution = await commitPhaseV1(
      "execution_completed",
      executionArtifacts,
    );
    if (execution.resolution === "stale") {
      return createProviderNonThenableFrozenRecordV1({
        ok: false as const,
        stage: "journal_compare_commit" as const,
        reason: "stale_expected_journal" as const,
        observedJournalRevision: execution.state.revision,
      });
    }
    const terminalArtifacts = {
      ...executionArtifacts,
      zeroLive: jsonValueV1(exactLifecycle.zeroLiveClosure),
      sourceDrainedRegistry: jsonValueV1(
        exactLifecycle.sourceDrainedRegistrySuccessorClosure,
      ),
      steadyRegistry: jsonValueV1(
        exactLifecycle.steadyRegistryCompletionClosure,
      ),
      terminalJournal: jsonValueV1(
        exactLifecycle.terminalJournalSealedClosure,
      ),
    };
    const terminal = await commitPhaseV1(
      "terminal_journal_sealed",
      terminalArtifacts,
    );
    if (terminal.resolution === "stale") {
      return createProviderNonThenableFrozenRecordV1({
        ok: false as const,
        stage: "journal_compare_commit" as const,
        reason: "stale_expected_journal" as const,
        observedJournalRevision: terminal.state.revision,
      });
    }
    const finalArtifacts = {
      ...terminalArtifacts,
      finalStrongReadyAcceptance: jsonValueV1(
        exactLifecycle.finalStrongReadyAcceptanceClosure,
      ),
    };
    const final = await commitPhaseV1("final_strong_ready", finalArtifacts);
    if (final.resolution === "stale") {
      return createProviderNonThenableFrozenRecordV1({
        ok: false as const,
        stage: "journal_compare_commit" as const,
        reason: "stale_expected_journal" as const,
        observedJournalRevision: final.state.revision,
      });
    }
    const value = Object.freeze({
      profile: "provider_migration_durable_execution_validation_v1" as const,
      durability:
        "separate_process_private_filesystem_durable_candidate_v1" as const,
      osIsolationAuthority:
        "not_yet_proven_service_principal_v1" as const,
      strongWriteCapability:
        "locked_to_verified_runtime_selection_v1" as const,
      relationship:
        "internally_validated_lifecycle_plan_objects_copied_and_phased_journal_committed_v1" as const,
      sourceProviderId: zeroLive.sourceProviderId,
      destinationProviderId: zeroLive.destinationProviderId,
      copiedObjectCount: publications.length,
      copiedLogicalBytes,
      destinationObjectPublications: Object.freeze(publications),
      finalJournalState: final.state,
      referenceLifecycle: exactLifecycle,
    }) satisfies ProviderMigrationDurableExecutionValidationInternalV1;
    return createProviderNonThenableFrozenRecordV1({
      ok: true as const,
      value,
    });
  } catch {
    return createProviderNonThenableFrozenRecordV1({
      ok: false as const,
      stage: "journal_compare_commit" as const,
      reason: "host_operation_failed" as const,
    });
  }
}

export function diagnoseProviderMigrationDurableExecutionOrchestratorInternalV1(
  input: ProviderMigrationDurableExecutionOrchestratorInputInternalV1,
): Promise<ProviderMigrationDurableExecutionDiagnosticResultInternalV1> {
  return hardenProviderPointPromiseV1(diagnoseInternalV1(input));
}

Object.freeze(diagnoseProviderMigrationDurableExecutionOrchestratorInternalV1);
