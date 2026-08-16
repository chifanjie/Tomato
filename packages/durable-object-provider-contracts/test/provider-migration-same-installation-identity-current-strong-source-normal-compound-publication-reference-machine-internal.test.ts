import { describe, expect, it, vi } from "vitest";

vi.mock("../src/provider-registry-records.js", () => ({
  ProviderRegistryManifestEnvelopeV1Schema: {
    safeParse: () => ({ success: true }),
  },
  ProviderRegistryManifestPinV1Schema: {
    parse: (value: unknown) => value,
  },
  deriveProviderRegistryManifestContentDigestV1: (payload: {
    readonly fixtureContentDigest: string;
  }) => payload.fixtureContentDigest,
  deriveProviderRegistryManifestGenerationIdV1: (fields: {
    readonly generationId: string;
  }) => fields.generationId,
  projectProviderRegistryManifestIdFieldsV1: (payload: {
    readonly generationId: string;
  }) => ({ generationId: payload.generationId }),
}));

vi.mock("../src/provider-feasibility-support-catalog-point.js", () => ({
  ProviderFeasibilitySupportCatalogEnvelopeV1Schema: {
    safeParse: () => ({ success: true }),
  },
  deriveProviderFeasibilitySupportCatalogPinV1: (envelope: {
    readonly catalogGeneration: number;
    readonly contentDigest: string;
  }) => ({
    locatorProfile: "distribution_provider_feasibility_support_catalog_v1",
    catalogGeneration: envelope.catalogGeneration,
    contentDigest: envelope.contentDigest,
  }),
}));

vi.mock(
  "../src/provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate-wire.js",
  () => ({
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema:
      { safeParse: () => ({ success: true }) },
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema:
      { safeParse: () => ({ success: true }) },
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1Schema:
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

import { canonicalizeJcsSafeIntegerV1 } from "../src/jcs.js";
import {
  comparePublishRegistrySuccessorProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  compareReservePublishProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  createProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationEmptyStateInternalV1,
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCompareReservePublishRequestInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-compound-publication-reference-machine-internal.js";

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

const identityV1 =
  "installation-identity-generation:00112233445566778899aa";
const formalMigrationIdV1 =
  "provider-migration:00112233445566778899aa";
const sourceProviderIdV1 = "durable-object-provider:source";
const destinationProviderIdV1 = "durable-object-provider:destination";
const rootPinV1 = deepFreezeV1({
  rootGeneration: 3,
  rootKeyId: "00112233445566778899aa",
  contentDigest: digestV1("a"),
});
const sourceMemberV1 = deepFreezeV1({
  providerId: sourceProviderIdV1,
  disposition: "enabled" as const,
  registryEntryContentDigest: digestV1("b"),
  registryEntry: { profile: "fixture_source_registry_entry" },
});
const destinationMemberV1 = deepFreezeV1({
  providerId: destinationProviderIdV1,
  disposition: "enabled" as const,
  registryEntryContentDigest: digestV1("c"),
  registryEntry: { profile: "fixture_destination_registry_entry" },
});

function fixtureV1() {
  const currentRegistryManifestEnvelope = deepFreezeV1({
    schemaVersion: 1,
    recordType: "provider_registry_manifest",
    generationId: "registry-generation-1",
    contentDigest: digestV1("1"),
    payload: {
      manifestGeneration: 1,
      generationId: "registry-generation-1",
      fixtureContentDigest: digestV1("1"),
      installationIdentityGenerationId: identityV1,
      activeRootMetadata: rootPinV1,
      members: [sourceMemberV1],
      predecessor: { state: "genesis" },
      routing: { state: "steady" },
    },
  });
  const currentRegistryManifestPin = deepFreezeV1({
    locatorProfile: "installation_provider_registry_manifest_v1",
    manifestGeneration: 1,
    generationId: "registry-generation-1",
    contentDigest: digestV1("1"),
  });
  const currentSupportCatalogEnvelope = deepFreezeV1({
    schemaVersion: 1,
    recordType: "provider_feasibility_support_catalog",
    catalogGeneration: 1,
    contentDigest: digestV1("2"),
    payload: {
      catalogGeneration: 1,
      activeRootMetadata: rootPinV1,
    },
  });
  const currentSupportCatalogPin = deepFreezeV1({
    locatorProfile: "distribution_provider_feasibility_support_catalog_v1",
    catalogGeneration: 1,
    contentDigest: digestV1("2"),
  });
  const preparedRegistryManifestEnvelope = deepFreezeV1({
    schemaVersion: 1,
    recordType: "provider_registry_manifest",
    generationId: "registry-generation-2",
    contentDigest: digestV1("3"),
    payload: {
      manifestGeneration: 2,
      generationId: "registry-generation-2",
      fixtureContentDigest: digestV1("3"),
      installationIdentityGenerationId: identityV1,
      activeRootMetadata: rootPinV1,
      members: [destinationMemberV1, sourceMemberV1],
      predecessor: {
        state: "manifest",
        generationId: "registry-generation-1",
        contentDigest: digestV1("1"),
      },
      routing: {
        state: "migration",
        migrationId: formalMigrationIdV1,
        sourceProviderId: sourceProviderIdV1,
        destinationProviderId: destinationProviderIdV1,
        activeForMigrationWrites: sourceProviderIdV1,
        phase: "prepared",
      },
    },
  });
  const preparedRegistryManifestPin = deepFreezeV1({
    locatorProfile: "installation_provider_registry_manifest_v1",
    manifestGeneration: 2,
    generationId: "registry-generation-2",
    contentDigest: digestV1("3"),
  });
  const preparedSupportCatalogEnvelope = deepFreezeV1({
    schemaVersion: 1,
    recordType: "provider_feasibility_support_catalog",
    catalogGeneration: 2,
    contentDigest: digestV1("4"),
    payload: {
      catalogGeneration: 2,
      predecessorCatalogContentDigest: digestV1("2"),
      activeRootMetadata: rootPinV1,
    },
  });
  const preparedSupportCatalogPin = deepFreezeV1({
    locatorProfile: "distribution_provider_feasibility_support_catalog_v1",
    catalogGeneration: 2,
    contentDigest: digestV1("4"),
  });
  const formalReservationDescriptor = deepFreezeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_formal_history_quota_reservation_descriptor_reference_candidate_v1",
    locatorProfile:
      "provider_migration_same_installation_identity_current_strong_source_normal_formal_history_quota_reservation_reference_candidate_v1",
    reservationId: "formal-reservation-1",
    formalMigrationId: formalMigrationIdV1,
    installationIdentityGenerationId: identityV1,
    role: "same_identity_journal" as const,
    admissionVectorDigest: digestV1("5"),
  });
  const formalPlanEnvelope = deepFreezeV1({
    contentDigest: digestV1("6"),
    payload: {
      migrationId: formalMigrationIdV1,
      journalAuthorityInstallationIdentityGenerationId: identityV1,
      preparedRegistryManifestPin,
      preparedSupportCatalogPin,
      migrationHistoryQuotaReservations: {
        journal: formalReservationDescriptor,
      },
    },
  });
  const formalPlanPin = deepFreezeV1({
    locatorProfile:
      "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_reference_candidate_v1",
    formalMigrationId: formalMigrationIdV1,
    contentDigest: digestV1("6"),
  });
  const request = {
    operationNonce: "11".repeat(16),
    expectedCurrentRegistryManifestPin: currentRegistryManifestPin,
    expectedCurrentSupportCatalogPin: currentSupportCatalogPin,
    preparedRegistryManifestEnvelope,
    preparedRegistryManifestPin,
    preparedSupportCatalogEnvelope,
    preparedSupportCatalogPin,
    formalPlanEnvelope,
    formalPlanPin,
    formalReservationDescriptor,
  } as unknown as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCompareReservePublishRequestInternalV1;
  return {
    currentRegistryManifestEnvelope,
    currentRegistryManifestPin,
    currentSupportCatalogEnvelope,
    currentSupportCatalogPin,
    preparedRegistryManifestEnvelope,
    preparedRegistryManifestPin,
    preparedSupportCatalogEnvelope,
    preparedSupportCatalogPin,
    formalPlanEnvelope,
    formalPlanPin,
    request,
  };
}

function machineV1(fixture: ReturnType<typeof fixtureV1>) {
  return mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1({
    currentRegistryManifestEnvelope:
      fixture.currentRegistryManifestEnvelope as never,
    currentRegistryManifestPin: fixture.currentRegistryManifestPin as never,
    currentSupportCatalogEnvelope:
      fixture.currentSupportCatalogEnvelope as never,
    currentSupportCatalogPin: fixture.currentSupportCatalogPin as never,
    migrationPublicationState:
      createProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationEmptyStateInternalV1(),
  });
}

describe("same-Identity compound publication reference machine", () => {
  it("commits the complete state with one immutable receipt and replays that first receipt", () => {
    const fixture = fixtureV1();
    const machine = machineV1(fixture);
    expect(Reflect.ownKeys(machine)).toEqual([]);

    const first =
      compareReservePublishProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        machine,
        fixture.request,
      );
    expect(first.status).toBe("committed");
    if (first.status !== "committed") return;
    expect(first.replay).toBe(false);
    expect(Object.isFrozen(first.receipt)).toBe(true);

    const state =
      inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        machine,
      );
    expect(state.revision).toBe(1);
    expect(state.currentRegistryManifestEnvelope).toBe(
      fixture.preparedRegistryManifestEnvelope,
    );
    expect(state.currentSupportCatalogEnvelope).toBe(
      fixture.preparedSupportCatalogEnvelope,
    );
    expect(state.migrationPublicationState).toMatchObject({
      state: "committed",
      registryManifestPublication: "published_current",
      catalogPublication: "published_current",
      formalPlanPublication: "published",
    });
    if (state.migrationPublicationState.state !== "committed") return;
    expect(state.migrationPublicationState.formalPlanEnvelope).toBe(
      fixture.formalPlanEnvelope,
    );
    expect(state.migrationPublicationState.reservationRecord.state).toBe(
      "reserved",
    );
    expect(state.migrationPublicationState.reservedEvent.transition).toBe(
      "reserved",
    );
    expect(state.migrationPublicationState.reservedAccount).toMatchObject({
      state: "reserved",
      activeReservationCount: 1,
    });
    expect(state.migrationPublicationState.highWater.revision).toBe(1);
    expect(state.migrationPublicationState.immutableReceipt).toBe(
      first.receipt,
    );

    const replay =
      compareReservePublishProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        machine,
        { ...fixture.request },
      );
    expect(replay.status).toBe("committed");
    if (replay.status !== "committed") return;
    expect(replay.replay).toBe(true);
    expect(replay.receipt).toBe(first.receipt);
    expect(canonicalizeJcsSafeIntegerV1(replay.receipt)).toBe(
      canonicalizeJcsSafeIntegerV1(first.receipt),
    );

    const nonceConflict =
      compareReservePublishProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        machine,
        {
          ...fixture.request,
          formalPlanPin: deepFreezeV1({
            ...fixture.formalPlanPin,
            contentDigest: digestV1("7"),
          }) as never,
        },
      );
    expect(nonceConflict).toEqual({
      status: "rejected",
      reason: "operation_nonce_conflict",
    });
    expect(
      inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        machine,
      ),
    ).toBe(state);
  });

  it("CAS-publishes signed rebinding through steady successors with replay and stale fail-close", () => {
    const fixture = fixtureV1();
    const machine = machineV1(fixture);
    const initial =
      compareReservePublishProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        machine,
        fixture.request,
      );
    expect(initial.status).toBe("committed");
    if (initial.status !== "committed") return;

    const rebindingEnvelope = deepFreezeV1({
      schemaVersion: 1,
      recordType: "provider_registry_manifest",
      generationId: "registry-generation-3",
      contentDigest: digestV1("5"),
      payload: {
        manifestGeneration: 3,
        generationId: "registry-generation-3",
        fixtureContentDigest: digestV1("5"),
        installationIdentityGenerationId: identityV1,
        activeRootMetadata: rootPinV1,
        members: fixture.preparedRegistryManifestEnvelope.payload.members,
        predecessor: {
          state: "manifest",
          generationId: "registry-generation-2",
          contentDigest: digestV1("3"),
        },
        routing: {
          state: "migration",
          migrationId: formalMigrationIdV1,
          sourceProviderId: sourceProviderIdV1,
          destinationProviderId: destinationProviderIdV1,
          activeForMigrationWrites: destinationProviderIdV1,
          phase: "rebinding",
        },
      },
    });
    const rebindingPin = deepFreezeV1({
      locatorProfile: "installation_provider_registry_manifest_v1",
      manifestGeneration: 3,
      generationId: "registry-generation-3",
      contentDigest: digestV1("5"),
    });
    const request = {
      operationNonce: "66".repeat(16),
      expectedCurrentRegistryManifestPin:
        fixture.preparedRegistryManifestPin,
      validatedSignedSuccessorEnvelope: rebindingEnvelope,
      validatedSignedSuccessorPin: rebindingPin,
    };
    const committed =
      comparePublishRegistrySuccessorProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        machine,
        request as never,
      );
    expect(committed).toMatchObject({
      status: "committed",
      replay: false,
      receipt: {
        publicationOrdinal: 1,
        compoundRevision: 2,
        previousRegistryManifestPin: fixture.preparedRegistryManifestPin,
        publishedRegistryManifestPin: rebindingPin,
        routingPhase: "rebinding",
        activeForMigrationWrites: destinationProviderIdV1,
      },
      currentState: {
        revision: 2,
        currentRegistryManifestPin: rebindingPin,
      },
    });
    if (committed.status !== "committed") return;
    expect(committed.currentState.currentRegistryManifestEnvelope).toBe(
      rebindingEnvelope,
    );
    expect(committed.currentState.registrySuccessorPublicationReceipts).toEqual([
      committed.receipt,
    ]);

    const replay =
      comparePublishRegistrySuccessorProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        machine,
        { ...request } as never,
      );
    expect(replay).toMatchObject({ status: "committed", replay: true });
    if (replay.status !== "committed") return;
    expect(replay.receipt).toBe(committed.receipt);
    expect(replay.currentState).toBe(committed.currentState);

    const stale =
      comparePublishRegistrySuccessorProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        machine,
        {
          ...request,
          operationNonce: "77".repeat(16),
        } as never,
      );
    expect(stale).toEqual({
      status: "not_committed",
      reason: "stale_expected_current_registry",
      observedCurrentRegistryManifestPin: rebindingPin,
    });
    expect(
      inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        machine,
      ),
    ).toBe(committed.currentState);

    const sourceDrainedEnvelope = deepFreezeV1({
      schemaVersion: 1,
      recordType: "provider_registry_manifest",
      generationId: "registry-generation-4",
      contentDigest: digestV1("6"),
      payload: {
        manifestGeneration: 4,
        generationId: "registry-generation-4",
        fixtureContentDigest: digestV1("6"),
        installationIdentityGenerationId: identityV1,
        activeRootMetadata: rootPinV1,
        members: rebindingEnvelope.payload.members,
        predecessor: {
          state: "manifest",
          generationId: rebindingEnvelope.generationId,
          contentDigest: rebindingEnvelope.contentDigest,
        },
        routing: {
          ...rebindingEnvelope.payload.routing,
          phase: "source_drained" as const,
        },
      },
    });
    const sourceDrainedPin = deepFreezeV1({
      locatorProfile: "installation_provider_registry_manifest_v1",
      manifestGeneration: 4,
      generationId: "registry-generation-4",
      contentDigest: digestV1("6"),
    });
    const sourceDrained =
      comparePublishRegistrySuccessorProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        machine,
        {
          operationNonce: "88".repeat(16),
          expectedCurrentRegistryManifestPin: rebindingPin,
          validatedSignedSuccessorEnvelope: sourceDrainedEnvelope,
          validatedSignedSuccessorPin: sourceDrainedPin,
        } as never,
      );
    expect(sourceDrained).toMatchObject({
      status: "committed",
      replay: false,
      receipt: {
        publicationOrdinal: 2,
        compoundRevision: 3,
        routingPhase: "source_drained",
        activeForMigrationWrites: destinationProviderIdV1,
      },
    });
    if (sourceDrained.status !== "committed") return;

    const invalidSteadyEnvelope = deepFreezeV1({
      schemaVersion: 1,
      recordType: "provider_registry_manifest",
      generationId: "registry-generation-5-invalid",
      contentDigest: digestV1("7"),
      payload: {
        manifestGeneration: 5,
        generationId: "registry-generation-5-invalid",
        fixtureContentDigest: digestV1("7"),
        installationIdentityGenerationId: identityV1,
        activeRootMetadata: rootPinV1,
        members: sourceDrainedEnvelope.payload.members,
        predecessor: {
          state: "manifest",
          generationId: sourceDrainedEnvelope.generationId,
          contentDigest: sourceDrainedEnvelope.contentDigest,
        },
        routing: { state: "steady" as const },
      },
    });
    expect(
      comparePublishRegistrySuccessorProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        machine,
        {
          operationNonce: "99".repeat(16),
          expectedCurrentRegistryManifestPin: sourceDrainedPin,
          validatedSignedSuccessorEnvelope: invalidSteadyEnvelope,
          validatedSignedSuccessorPin: deepFreezeV1({
            locatorProfile: "installation_provider_registry_manifest_v1",
            manifestGeneration: 5,
            generationId: "registry-generation-5-invalid",
            contentDigest: digestV1("7"),
          }),
        } as never,
      ),
    ).toEqual({ status: "rejected", reason: "successor_invalid" });

    const steadyMembers = deepFreezeV1(
      sourceDrainedEnvelope.payload.members.map((member) =>
        member.providerId === sourceProviderIdV1
          ? {
              providerId: sourceProviderIdV1,
              disposition: "revoked" as const,
              lastEnabledRegistryEntryContentDigest:
                sourceMemberV1.registryEntryContentDigest,
              revokedAtManifestGeneration: 5,
              reason: "migration_completed" as const,
            }
          : member,
      ),
    );
    const steadyEnvelope = deepFreezeV1({
      schemaVersion: 1,
      recordType: "provider_registry_manifest",
      generationId: "registry-generation-5",
      contentDigest: digestV1("8"),
      payload: {
        manifestGeneration: 5,
        generationId: "registry-generation-5",
        fixtureContentDigest: digestV1("8"),
        installationIdentityGenerationId: identityV1,
        activeRootMetadata: rootPinV1,
        members: steadyMembers,
        predecessor: {
          state: "manifest",
          generationId: sourceDrainedEnvelope.generationId,
          contentDigest: sourceDrainedEnvelope.contentDigest,
        },
        routing: { state: "steady" as const },
      },
    });
    const steadyPin = deepFreezeV1({
      locatorProfile: "installation_provider_registry_manifest_v1",
      manifestGeneration: 5,
      generationId: "registry-generation-5",
      contentDigest: digestV1("8"),
    });
    const steadyRequest = {
      operationNonce: "aa".repeat(16),
      expectedCurrentRegistryManifestPin: sourceDrainedPin,
      validatedSignedSuccessorEnvelope: steadyEnvelope,
      validatedSignedSuccessorPin: steadyPin,
    };
    const steady =
      comparePublishRegistrySuccessorProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        machine,
        steadyRequest as never,
      );
    expect(steady).toMatchObject({
      status: "committed",
      replay: false,
      receipt: {
        publicationOrdinal: 3,
        compoundRevision: 4,
        previousRegistryManifestPin: sourceDrainedPin,
        publishedRegistryManifestPin: steadyPin,
        routingPhase: "steady",
        activeForMigrationWrites: destinationProviderIdV1,
      },
      currentState: {
        revision: 4,
        currentRegistryManifestPin: steadyPin,
        currentRegistryManifestEnvelope: {
          payload: {
            routing: { state: "steady" },
            members: steadyMembers,
          },
        },
      },
    });
    if (steady.status !== "committed") return;
    expect(steady.currentState.registrySuccessorPublicationReceipts).toHaveLength(
      3,
    );
    const steadyReplay =
      comparePublishRegistrySuccessorProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        machine,
        { ...steadyRequest } as never,
      );
    expect(steadyReplay).toMatchObject({ status: "committed", replay: true });
    if (steadyReplay.status !== "committed") return;
    expect(steadyReplay.receipt).toBe(steady.receipt);
    expect(steadyReplay.currentState).toBe(steady.currentState);
  });

  it("returns stale without changing any publication state", () => {
    const fixture = fixtureV1();
    const machine = machineV1(fixture);
    const before =
      inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        machine,
      );
    const stale =
      compareReservePublishProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        machine,
        {
          ...fixture.request,
          expectedCurrentRegistryManifestPin: deepFreezeV1({
            ...fixture.currentRegistryManifestPin,
            contentDigest: digestV1("9"),
          }) as never,
        },
      );
    expect(stale).toEqual({
      status: "not_committed",
      reason: "stale_expected_current_cut",
      observedCurrentRegistryManifestPin: fixture.currentRegistryManifestPin,
      observedCurrentSupportCatalogPin: fixture.currentSupportCatalogPin,
    });
    const after =
      inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        machine,
      );
    expect(after).toBe(before);
    expect(after).toMatchObject({
      revision: 0,
      migrationPublicationState: { state: "empty" },
    });
  });
});
