import { describe, expect, it, vi } from "vitest";

const mockedPublicationV1 = vi.hoisted(() => ({
  states: new WeakMap<object, unknown>(),
  rebindingContinuations: new WeakMap<object, unknown>(),
}));

vi.mock(
  "../src/provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate-wire.js",
  () => ({
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema:
      { safeParse: () => ({ success: true }) },
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinV1:
      (envelope: {
        readonly contentDigest: string;
        readonly payload: { readonly migrationId: string };
      }) => ({
        locatorProfile:
          "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_reference_candidate_v1",
        formalMigrationId: envelope.payload.migrationId,
        contentDigest: envelope.contentDigest,
      }),
  }),
);

vi.mock(
  "../src/provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js",
  () => ({
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceDigestReferenceCandidateV1:
      () => `sha256:${"d".repeat(64)}`,
  }),
);

vi.mock(
  "../src/provider-migration-same-installation-identity-current-strong-source-normal-compound-publication-reference-machine-internal.js",
  () => ({
    inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1:
      (capability: object) => {
        const state = mockedPublicationV1.states.get(capability);
        if (state === undefined) throw new TypeError("invalid fixture capability");
        return state;
      },
  }),
);

vi.mock(
  "../src/provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-reference-candidate-internal.js",
  () => ({
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1Schema:
      { safeParse: () => ({ success: true }) },
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1:
      (envelope: {
        readonly generationId: string;
        readonly contentDigest: string;
        readonly payload: { readonly acceptanceOrdinal: number };
      }) => ({
        locatorProfile:
          "installation_provider_migration_only_acceptance_reference_candidate_v1",
        acceptanceOrdinal: envelope.payload.acceptanceOrdinal,
        generationId: envelope.generationId,
        contentDigest: envelope.contentDigest,
      }),
  }),
);

vi.mock(
  "../src/provider-migration-same-installation-identity-current-strong-source-normal-rebinding-registry-successor-reference-capability-internal.js",
  () => ({
    takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistryExecutionContinuationInternalV1:
      (success: object) => {
        const continuation =
          mockedPublicationV1.rebindingContinuations.get(success);
        if (continuation !== undefined) {
          mockedPublicationV1.rebindingContinuations.delete(success);
        }
        return continuation;
      },
  }),
);

import { canonicalizeJcsSafeIntegerV1 } from "../src/jcs.js";
import {
  compareAdvanceProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1,
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompletedExecutionContinuationInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressAdvanceRequestInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-execution-progress-reference-machine-internal.js";

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
  const registryPin = deepFreezeV1({
    locatorProfile: "installation_provider_registry_manifest_v1",
    manifestGeneration: 2,
    generationId: "provider-registry-manifest:00112233445566778899aa",
    contentDigest: digestV1("1"),
  });
  const catalogPin = deepFreezeV1({
    locatorProfile: "distribution_provider_feasibility_support_catalog_v1",
    catalogGeneration: 2,
    contentDigest: digestV1("2"),
  });
  const formalPlanEnvelope = deepFreezeV1({
    contentDigest: digestV1("3"),
    payload: {
      migrationId: formalMigrationId,
      journalAuthorityInstallationIdentityGenerationId:
        installationIdentityGenerationId,
      completeSourceReadClosure: {
        objectCount: 2,
        logicalObjectBytesTotal: 12,
        objects: [
          {
            objectOrdinal: 0,
            logicalBytes: 5,
            contentDigest: digestV1("5"),
            semanticLocatorDigest: digestV1("6"),
            logicalLocatorReferenceDigest: digestV1("7"),
            providerBindingReferenceDigest: digestV1("8"),
          },
          {
            objectOrdinal: 1,
            logicalBytes: 7,
            contentDigest: digestV1("9"),
            semanticLocatorDigest: digestV1("a"),
            logicalLocatorReferenceDigest: digestV1("b"),
            providerBindingReferenceDigest: digestV1("8"),
          },
        ],
      },
      formalDestinationTrust: {
        destinationEndpointTrust: {
          role: "destination_prospective_not_selected" as const,
          prospectiveWriterProjection: {
            targetProfileId: "target-profile-1",
            providerId: "destination-provider-1",
            registryEntryContentDigest: digestV1("c"),
            semanticProviderPolicyDigest: digestV1("d"),
            providerFeasibilityEvidence: { fixture: true },
            runtimeAttestationContentDigest: digestV1("e"),
            bindingDerivationKeyGeneration: 1,
          },
        },
      },
    },
  });
  const formalPlanPin = deepFreezeV1({
    locatorProfile:
      "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_reference_candidate_v1",
    formalMigrationId,
    contentDigest: formalPlanEnvelope.contentDigest,
  });
  const publicationReceipt = deepFreezeV1({
    publishedRegistryManifestPin: registryPin,
    publishedSupportCatalogPin: catalogPin,
  });
  const compoundCapability = Object.freeze(Object.create(null)) as object;
  const migrationOnlyAcceptanceReferenceMachineCapability = Object.freeze(
    Object.create(null),
  );
  const acceptanceIdentityVerificationCapability = Object.freeze(
    Object.create(null),
  );
  const configuration = deepFreezeV1({
    state: "migration_only" as const,
    publishedTrustPins: {
      registryManifest: registryPin,
      supportCatalog: catalogPin,
    },
    publicStrongWriter: { state: "disabled" as const },
    formalPlanPin,
    executor: {
      state: "enabled_for_plan_only" as const,
      formalMigrationId,
    },
  });
  const migrationOnlyAcceptanceEnvelope = deepFreezeV1({
    generationId: "provider-acceptance-state:00112233445566778899aa",
    installationIdentityGenerationId,
    contentDigest: digestV1("4"),
    payload: {
      acceptanceOrdinal: 2,
      configuration,
    },
  });
  const migrationOnlyAcceptancePin = deepFreezeV1({
    locatorProfile:
      "installation_provider_migration_only_acceptance_reference_candidate_v1",
    acceptanceOrdinal: 2,
    generationId: migrationOnlyAcceptanceEnvelope.generationId,
    contentDigest: migrationOnlyAcceptanceEnvelope.contentDigest,
  });
  const d44 = deepFreezeV1({
    formalPlanEnvelope,
    formalPlanPin,
    currentRegistryManifestPin: registryPin,
    currentSupportCatalogPin: catalogPin,
    committedReceipt: publicationReceipt,
  });
  const d45Success = deepFreezeV1({
    authority:
      "in_memory_reference_machine_only_no_production_provider_authority_v1" as const,
    durability:
      "in_memory_reference_only_not_a_durable_provider_v1" as const,
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_reference_validation_v1" as const,
    relationship:
      "committed_d44_publication_strict_migration_only_acceptance_compare_appended_v1" as const,
    formalPlanPublicationClosure: d44,
    migrationOnlyAcceptanceEnvelope,
    migrationOnlyAcceptancePin,
    acceptanceCompareAppendReceipt: {
      outcome: {
        state: "committed" as const,
        appendedAcceptance: migrationOnlyAcceptancePin,
      },
    },
    acceptanceReferenceState: {
      currentAcceptance: migrationOnlyAcceptancePin,
      migrationOnlyGenerations: [migrationOnlyAcceptanceEnvelope],
    },
    acceptanceOrdinal: 2,
    configuration,
    acceptedRegistryManifestPin: registryPin,
    acceptedSupportCatalogPin: catalogPin,
    sourceObjectCount: 2,
    sourceLogicalBytes: 12,
  });
  const rebindingRegistryManifestEnvelope = deepFreezeV1({
    payload: {
      routing: {
        state: "migration" as const,
        migrationId: formalMigrationId,
        sourceProviderId: "source-provider-1",
        destinationProviderId: "destination-provider-1",
        activeForMigrationWrites: "destination-provider-1",
        phase: "rebinding" as const,
      },
    },
  });
  const rebindingRegistryManifestPin = deepFreezeV1({
    locatorProfile: "installation_provider_registry_manifest_v1",
    manifestGeneration: 3,
    generationId: "provider-registry-manifest:112233445566778899aabb",
    contentDigest: digestV1("f"),
  });
  const rebindingSuccess = deepFreezeV1({
    migrationOnlyAcceptanceClosure: d45Success,
    rebindingRegistryManifestEnvelope,
    rebindingRegistryManifestPin,
    currentRegistryManifestEnvelope: rebindingRegistryManifestEnvelope,
    currentRegistryManifestPin: rebindingRegistryManifestPin,
  });
  mockedPublicationV1.states.set(
    compoundCapability,
    deepFreezeV1({
      revision: 2,
      currentRegistryManifestEnvelope: rebindingRegistryManifestEnvelope,
      currentRegistryManifestPin: rebindingRegistryManifestPin,
      migrationPublicationState: {
        state: "committed",
        immutableReceipt: publicationReceipt,
        formalPlanEnvelope,
        formalPlanPin,
      },
    }),
  );
  mockedPublicationV1.rebindingContinuations.set(
    rebindingSuccess,
    deepFreezeV1({
      migrationOnlyAcceptance: d45Success,
      compoundPublicationReferenceMachineCapability: compoundCapability,
      migrationOnlyAcceptanceReferenceMachineCapability,
      acceptanceIdentityVerificationCapability,
      rebindingRegistrySuccessor: rebindingSuccess,
    }),
  );
  return {
    rebindingSuccess,
    migrationOnlyAcceptanceReferenceMachineCapability,
    acceptanceIdentityVerificationCapability,
  };
}

function machineV1(fixture: ReturnType<typeof fixtureV1>) {
  return mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1({
    rebindingRegistrySuccessor: fixture.rebindingSuccess as never,
  });
}

function requestV1(
  nonceByte: string,
  expectedProgressRevision: number,
  expectedPhase: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressAdvanceRequestInternalV1["expectedPhase"],
  transition: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressAdvanceRequestInternalV1["transition"],
  sourceObjectOrdinal: number | "none",
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressAdvanceRequestInternalV1 {
  return {
    operationNonce: nonceByte.repeat(16),
    expectedProgressRevision,
    expectedPhase,
    transition,
    sourceObjectOrdinal,
  };
}

describe("same-Identity execution progress reference machine", () => {
  it("commits every exact Plan object before drain/completion and replays the first receipt", () => {
    const fixture = fixtureV1();
    const machine = machineV1(fixture);
    expect(Reflect.ownKeys(machine)).toEqual([]);
    expect(() => machineV1(fixture)).toThrow(
      "rebinding Registry execution continuation invalid",
    );

    const start = requestV1("11", 0, "accepted", "start_execution", "none");
    const started =
      compareAdvanceProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        machine,
        start,
      );
    expect(started).toMatchObject({ status: "committed", replay: false });

    const firstObject = requestV1(
      "22",
      1,
      "running",
      "commit_source_object",
      0,
    );
    const firstCommitted =
      compareAdvanceProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        machine,
        firstObject,
      );
    expect(firstCommitted).toMatchObject({ status: "committed", replay: false });
    if (firstCommitted.status !== "committed") return;
    expect(firstCommitted.receipt.destinationObjectPublication).toMatchObject({
      publicationMode:
        "metadata_only_in_memory_reference_no_external_destination_write_v1",
      publicationOrdinal: 0,
      sourceObjectOrdinal: 0,
      sourceContentDigest: digestV1("5"),
      sourceSemanticLocatorDigest: digestV1("6"),
      sourceLogicalLocatorReferenceDigest: digestV1("7"),
      sourceProviderBindingReferenceDigest: digestV1("8"),
      sourceLogicalBytes: 5,
      destinationProviderId: "destination-provider-1",
      relationship:
        "metadata_only_destination_publication_committed_from_exact_formal_plan_source_object_v1",
    });

    const replay =
      compareAdvanceProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        machine,
        { ...firstObject },
      );
    expect(replay).toMatchObject({ status: "committed", replay: true });
    if (replay.status !== "committed") return;
    expect(replay.receipt).toBe(firstCommitted.receipt);
    expect(replay.receipt.destinationObjectPublication).toBe(
      firstCommitted.receipt.destinationObjectPublication,
    );
    expect(canonicalizeJcsSafeIntegerV1(replay.receipt)).toEqual(
      canonicalizeJcsSafeIntegerV1(firstCommitted.receipt),
    );

    expect(
      compareAdvanceProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        machine,
        requestV1("33", 2, "running", "commit_source_object", 1),
      ),
    ).toMatchObject({ status: "committed", replay: false });
    expect(
      compareAdvanceProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        machine,
        requestV1("44", 3, "running", "mark_source_drained", "none"),
      ),
    ).toMatchObject({ status: "committed", replay: false });
    expect(
      compareAdvanceProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        machine,
        requestV1("55", 4, "source_drained", "complete_execution", "none"),
      ),
    ).toMatchObject({ status: "committed", replay: false });

    const state =
      inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        machine,
      );
    expect(state.highWater).toMatchObject({
      progressRevision: 5,
      phase: "completed",
      sourceObjectCount: 2,
      copiedObjectCount: 2,
      remainingSourceObjectCount: 0,
      sourceLogicalBytes: 12,
      copiedLogicalBytes: 12,
      progressRecordCount: 5,
      receiptCount: 5,
      destinationObjectPublicationCount: 2,
    });
    expect(state.destinationPublicationMode).toBe(
      "metadata_only_in_memory_reference_no_external_destination_write_v1",
    );
    expect(state.destinationObjectPublications).toHaveLength(2);
    expect(state.destinationObjectPublications.map((receipt) => ({
      publicationOrdinal: receipt.publicationOrdinal,
      sourceObjectOrdinal: receipt.sourceObjectOrdinal,
      sourceLogicalBytes: receipt.sourceLogicalBytes,
    }))).toEqual([
      { publicationOrdinal: 0, sourceObjectOrdinal: 0, sourceLogicalBytes: 5 },
      { publicationOrdinal: 1, sourceObjectOrdinal: 1, sourceLogicalBytes: 7 },
    ]);
    expect(state.destinationObjectPublications[0]).toBe(
      firstCommitted.receipt.destinationObjectPublication,
    );
    expect(
      state.migrationOnlyAcceptance.migrationOnlyAcceptanceEnvelope.payload
        .configuration.state,
    ).toBe("migration_only");
    expect(
      state.migrationOnlyAcceptance.migrationOnlyAcceptanceEnvelope.payload
        .configuration.publicStrongWriter.state,
    ).toBe("disabled");
    expect(state.progressRecords.map((record) => record.sourceObjectOrdinal)).toEqual([
      "none",
      0,
      1,
      "none",
      "none",
    ]);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.highWater)).toBe(true);
    expect(Object.isFrozen(state.receipts[0])).toBe(true);
    expect(Object.isFrozen(state.destinationObjectPublications)).toBe(true);
    expect(Object.isFrozen(state.destinationObjectPublications[0])).toBe(true);

    const completedContinuation =
      takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompletedExecutionContinuationInternalV1(
        machine,
        state,
      );
    expect(completedContinuation).toMatchObject({
      relationship:
        "exact_completed_execution_terminal_handoff_consumed_once_v1",
      executionCompletedState: state,
      formalPlanPin: state.formalPlanPin,
      currentRegistryManifestEnvelope: state.currentRegistryManifestEnvelope,
      currentRegistryManifestPin: state.currentRegistryManifestPin,
      currentSupportCatalogPin:
        state.committedPublicationReceipt.publishedSupportCatalogPin,
      migrationOnlyAcceptanceReferenceMachineCapability:
        fixture.migrationOnlyAcceptanceReferenceMachineCapability,
      acceptanceIdentityVerificationCapability:
        fixture.acceptanceIdentityVerificationCapability,
      destinationObjectPublications: state.destinationObjectPublications,
    });
    expect(
      takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompletedExecutionContinuationInternalV1(
        machine,
        state,
      ),
    ).toBeUndefined();

    const conflict =
      compareAdvanceProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        machine,
        requestV1("11", 0, "accepted", "commit_source_object", 0),
      );
    expect(conflict).toEqual({
      status: "rejected",
      reason: "operation_nonce_conflict",
    });
  });

  it("does not mutate on stale progress or a skipped Plan object ordinal", () => {
    const machine = machineV1(fixtureV1());
    const before =
      inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        machine,
      );
    const stale =
      compareAdvanceProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        machine,
        requestV1("66", 1, "running", "commit_source_object", 0),
      );
    expect(stale).toMatchObject({
      status: "not_committed",
      reason: "stale_expected_progress",
      observedHighWater: { progressRevision: 0, phase: "accepted" },
    });
    expect(
      inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        machine,
      ),
    ).toBe(before);
    expect(before.destinationObjectPublications).toHaveLength(0);

    expect(
      compareAdvanceProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        machine,
        requestV1("77", 0, "accepted", "start_execution", "none"),
      ),
    ).toMatchObject({ status: "committed" });
    const afterStart =
      inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        machine,
      );
    expect(
      compareAdvanceProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        machine,
        requestV1("88", 1, "running", "commit_source_object", 1),
      ),
    ).toEqual({ status: "rejected", reason: "transition_invalid" });
    expect(
      inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
        machine,
      ),
    ).toBe(afterStart);
    expect(afterStart.destinationObjectPublications).toHaveLength(0);
  });
});
