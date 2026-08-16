import { describe, expect, it, vi } from "vitest";

const fixtureAuthoritiesV1 = vi.hoisted(() => ({
  steadyContinuations: new WeakMap<object, unknown>(),
  compoundStates: new WeakMap<object, unknown>(),
}));

vi.mock(
  "../src/provider-migration-same-installation-identity-current-strong-source-normal-steady-registry-completion-reference-capability-internal.js",
  () => ({
    takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionTerminalJournalContinuationInternalV1:
      (success: object) => {
        const continuation = fixtureAuthoritiesV1.steadyContinuations.get(success);
        if (continuation !== undefined) {
          fixtureAuthoritiesV1.steadyContinuations.delete(success);
        }
        return continuation;
      },
  }),
);

vi.mock(
  "../src/provider-migration-same-installation-identity-current-strong-source-normal-compound-publication-reference-machine-internal.js",
  () => ({
    inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1:
      (capability: object) => fixtureAuthoritiesV1.compoundStates.get(capability),
  }),
);

import {
  compareSealProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalReferenceMachineInternalV1,
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalReferenceMachineInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealReferenceMachineInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSealedTerminalJournalFinalAcceptanceContinuationInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-terminal-journal-seal-reference-machine-internal.js";

function digestV1(fill: string): `sha256:${string}` {
  return `sha256:${fill.repeat(64)}`;
}

function deepFreezeV1<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreezeV1(child);
    Object.freeze(value);
  }
  return value;
}

function fixtureV1() {
  const installationIdentityGenerationId =
    "installation-identity-generation:00112233445566778899aa";
  const formalMigrationId = "provider-migration:00112233445566778899aa";
  const sourceProviderId = "durable-object-provider:source";
  const destinationProviderId = "durable-object-provider:destination";
  const currentRegistryManifestPin = deepFreezeV1({
    locatorProfile: "installation_provider_registry_manifest_v1",
    manifestGeneration: 5,
    generationId: "provider-registry-manifest:112233445566778899aabb",
    contentDigest: digestV1("1"),
  });
  const currentRegistryManifestEnvelope = deepFreezeV1({
    profile: "provider_registry_manifest_v1",
    generationId: currentRegistryManifestPin.generationId,
    contentDigest: currentRegistryManifestPin.contentDigest,
    payload: {
      manifestGeneration: 5,
      routing: { state: "steady" as const },
      members: [
        {
          providerId: destinationProviderId,
          disposition: "enabled" as const,
          registryEntryContentDigest: digestV1("2"),
          registryEntry: { profile: "fixture_destination" },
        },
        {
          providerId: sourceProviderId,
          disposition: "revoked" as const,
          lastEnabledRegistryEntryContentDigest: digestV1("3"),
          revokedAtManifestGeneration: 5,
          reason: "migration_completed" as const,
        },
      ],
    },
  });
  const currentSupportCatalogPin = deepFreezeV1({
    locatorProfile: "distribution_provider_feasibility_support_catalog_v1",
    catalogGeneration: 2,
    contentDigest: digestV1("4"),
  });
  const formalPlanPin = deepFreezeV1({
    locatorProfile:
      "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_reference_candidate_v1",
    formalMigrationId,
    contentDigest: digestV1("5"),
  });
  const terminalProgressReceipt = deepFreezeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_execution_progress_receipt_v1",
    progressRecord: {
      phase: "completed" as const,
      transition: "complete_execution" as const,
    },
    receiptContentDigest: digestV1("6"),
  });
  const zeroLiveClosure = deepFreezeV1({
    remainingSourceLiveOrdinals: [],
    zeroLiveReferenceProof: {
      remainingSourceLiveObjectCount: 0,
      remainingSourceLiveReferenceCount: 0,
      proofContentDigest: digestV1("7"),
    },
    destinationUniverseMetadata: {
      universeContentDigest: digestV1("8"),
    },
    completeDestinationPublicationReceiptSet: {
      receiptSetDigest: digestV1("9"),
    },
  });
  const sourceDrainedRegistrySuccessorClosure = deepFreezeV1({
    zeroLiveClosure,
  });
  const steadyRegistryCompletion = deepFreezeV1({
    authority:
      "in_memory_reference_machine_only_no_production_provider_authority_v1",
    durability: "in_memory_reference_only_not_a_durable_provider_v1",
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_steady_registry_completion_reference_validation_v1",
    relationship:
      "exact_source_drained_externally_root_signed_steady_registry_direct_successor_compound_cas_published_current_v1",
    sourceDrainedRegistrySuccessorClosure,
    currentRegistryManifestEnvelope,
    currentRegistryManifestPin,
    currentSupportCatalogPin,
    formalPlanPin,
    terminalProgressReceipt,
    installationIdentityGenerationId,
    formalMigrationId,
    sourceProviderId,
    destinationProviderId,
  });
  const compoundPublicationReferenceMachineCapability = Object.freeze(
    Object.create(null),
  );
  const migrationOnlyAcceptanceReferenceMachineCapability = Object.freeze(
    Object.create(null),
  );
  const acceptanceIdentityVerificationCapability = Object.freeze(
    Object.create(null),
  );
  fixtureAuthoritiesV1.steadyContinuations.set(
    steadyRegistryCompletion,
    deepFreezeV1({
      steadyRegistryCompletion,
      compoundPublicationReferenceMachineCapability,
      migrationOnlyAcceptanceReferenceMachineCapability,
      acceptanceIdentityVerificationCapability,
      sourceDrainedRegistrySuccessor: sourceDrainedRegistrySuccessorClosure,
    }),
  );
  fixtureAuthoritiesV1.compoundStates.set(
    compoundPublicationReferenceMachineCapability,
    deepFreezeV1({
      migrationPublicationState: { state: "committed" as const },
      currentRegistryManifestEnvelope,
      currentRegistryManifestPin,
    }),
  );
  return {
    steadyRegistryCompletion,
    currentRegistryManifestPin,
    compoundPublicationReferenceMachineCapability,
    migrationOnlyAcceptanceReferenceMachineCapability,
    acceptanceIdentityVerificationCapability,
  };
}

function requestV1(expectedJournalRevision: number) {
  return deepFreezeV1({
    operationNonce: "11".repeat(16),
    expectedJournalRevision,
    expectedSteadyRegistryManifestPin:
      fixturePinHolderV1.currentRegistryManifestPin,
  });
}

let fixturePinHolderV1: ReturnType<typeof fixtureV1>;

describe("same-Identity terminal journal seal reference machine", () => {
  it("atomically records tombstone, ready and sealed head with exact replay", () => {
    const fixture = fixtureV1();
    fixturePinHolderV1 = fixture;
    const machine =
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealReferenceMachineInternalV1({
        steadyRegistryCompletion: fixture.steadyRegistryCompletion as never,
      });
    const request = requestV1(0);
    const committed =
      compareSealProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalReferenceMachineInternalV1(
        machine,
        request as never,
      );
    expect(committed).toMatchObject({
      status: "committed",
      replay: false,
      value: {
        relationship:
          "exact_steady_registry_source_tombstone_ready_to_activate_and_progress_head_atomically_sealed_v1",
        sourceTombstoneRecord: {
          sourceProviderId: "durable-object-provider:source",
          reason: "migration_completed",
          revokedAtManifestGeneration: 5,
          terminalProgressReceiptContentDigest: digestV1("6"),
        },
        readyToActivateRecord: {
          state: "ready_to_activate",
          destinationProviderId: "durable-object-provider:destination",
        },
        sealedProgressHead: {
          state: "sealed",
          journalRevision: 1,
          terminalProgressReceiptContentDigest: digestV1("6"),
          destinationUniverseContentDigest: digestV1("8"),
          completeDestinationPublicationReceiptSetDigest: digestV1("9"),
          zeroLiveProofContentDigest: digestV1("7"),
        },
        journalRevision: 1,
        strongWriterPublicationCount: 0,
        acceptancePublicationCount: 0,
      },
      currentState: { state: "sealed", journalRevision: 1 },
    });
    if (committed.status !== "committed") return;
    expect(committed.value.terminalJournalReceipt.contentDigest).toBe(
      committed.value.terminalJournalReceiptContentDigest,
    );
    expect(Object.isFrozen(committed.value)).toBe(true);
    const replay =
      compareSealProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalReferenceMachineInternalV1(
        machine,
        { ...request } as never,
      );
    expect(replay).toMatchObject({ status: "committed", replay: true });
    if (replay.status !== "committed") return;
    expect(replay.value).toBe(committed.value);
    expect(replay.currentState).toBe(committed.currentState);
    const finalContinuation =
      takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSealedTerminalJournalFinalAcceptanceContinuationInternalV1(
        committed.value,
      );
    expect(finalContinuation).toMatchObject({
      sealedTerminalJournal: committed.value,
      steadyRegistryCompletion: fixture.steadyRegistryCompletion,
      compoundPublicationReferenceMachineCapability:
        fixture.compoundPublicationReferenceMachineCapability,
      migrationOnlyAcceptanceReferenceMachineCapability:
        fixture.migrationOnlyAcceptanceReferenceMachineCapability,
      acceptanceIdentityVerificationCapability:
        fixture.acceptanceIdentityVerificationCapability,
    });
    expect(
      takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSealedTerminalJournalFinalAcceptanceContinuationInternalV1(
        committed.value,
      ),
    ).toBeUndefined();
  });

  it("does not write when the expected journal revision is stale", () => {
    const fixture = fixtureV1();
    fixturePinHolderV1 = fixture;
    const machine =
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealReferenceMachineInternalV1({
        steadyRegistryCompletion: fixture.steadyRegistryCompletion as never,
      });
    const before =
      inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalReferenceMachineInternalV1(
        machine,
      );
    expect(
      compareSealProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalReferenceMachineInternalV1(
        machine,
        requestV1(1) as never,
      ),
    ).toEqual({
      status: "not_committed",
      reason: "stale_expected_journal",
      observedJournalRevision: 0,
      observedSteadyRegistryManifestPin: fixture.currentRegistryManifestPin,
    });
    expect(
      inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalReferenceMachineInternalV1(
        machine,
      ),
    ).toBe(before);
    expect(before).toMatchObject({ state: "open", journalRevision: 0 });
  });
});
