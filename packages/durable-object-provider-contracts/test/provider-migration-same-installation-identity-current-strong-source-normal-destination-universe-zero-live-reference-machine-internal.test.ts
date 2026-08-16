import { describe, expect, it, vi } from "vitest";

const mockedCompletedExecutionsV1 = vi.hoisted(
  () => new WeakMap<object, unknown>(),
);

vi.mock(
  "../src/provider-migration-same-installation-identity-current-strong-source-normal-end-to-end-execution-reference-orchestrator-internal.js",
  () => ({
    takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndCompletedExecutionContinuationInternalV1:
      (success: object) => {
        const continuation = mockedCompletedExecutionsV1.get(success);
        if (continuation !== undefined) mockedCompletedExecutionsV1.delete(success);
        return continuation;
      },
  }),
);

import {
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceFromExactEndToEndSuccessInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveRegistryContinuationInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-destination-universe-zero-live-reference-machine-internal.js";

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

function fixtureV1(options: { readonly missingPublication?: boolean } = {}) {
  const installationIdentityGenerationId =
    "installation-identity-generation:00112233445566778899aa";
  const formalMigrationId = "provider-migration:00112233445566778899aa";
  const formalPlanPin = deepFreezeV1({
    locatorProfile:
      "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_reference_candidate_v1",
    formalMigrationId,
    contentDigest: digestV1("1"),
  });
  const formalPlanEnvelope = deepFreezeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_reference_candidate_v1",
    contentDigest: formalPlanPin.contentDigest,
    payload: { migrationId: formalMigrationId },
  });
  const currentRegistryManifestPin = deepFreezeV1({
    locatorProfile: "installation_provider_registry_manifest_v1",
    manifestGeneration: 3,
    generationId: "provider-registry-manifest:112233445566778899aabb",
    contentDigest: digestV1("2"),
  });
  const currentRegistryManifestEnvelope = deepFreezeV1({
    profile: "installation_provider_registry_manifest_v1",
    contentDigest: currentRegistryManifestPin.contentDigest,
    payload: {
      manifestGeneration: 3,
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
  const currentSupportCatalogPin = deepFreezeV1({
    locatorProfile: "distribution_provider_feasibility_support_catalog_v1",
    catalogGeneration: 2,
    contentDigest: digestV1("3"),
  });
  const sourceReadClosure = deepFreezeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_complete_source_read_closure_v1",
    objectCount: 2,
    logicalObjectBytesTotal: 12,
    objects: [
      {
        objectOrdinal: 0,
        logicalBytes: 5,
        contentDigest: digestV1("4"),
        semanticLocatorDigest: digestV1("5"),
        logicalLocatorReferenceDigest: digestV1("6"),
        providerBindingReferenceDigest: digestV1("7"),
      },
      {
        objectOrdinal: 1,
        logicalBytes: 7,
        contentDigest: digestV1("8"),
        semanticLocatorDigest: digestV1("9"),
        logicalLocatorReferenceDigest: digestV1("a"),
        providerBindingReferenceDigest: digestV1("7"),
      },
    ],
    completeReadClosureContentDigest: digestV1("b"),
  });
  const destinationProviderBinding = deepFreezeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_store_provider_binding_reference_candidate_v1",
    providerId: "destination-provider-1",
    bindingReferenceDigest: digestV1("c"),
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
  const destinationObjectPublications = sourceReadClosure.objects.map(
    (sourceObject, publicationOrdinal) => deepFreezeV1({
      profile:
        "provider_migration_same_installation_identity_current_strong_source_normal_destination_object_publication_metadata_receipt_v1",
      durability: "in_memory_reference_only_not_a_durable_provider_v1",
      publicationMode:
        "metadata_only_in_memory_reference_no_external_destination_write_v1",
      resolution: "committed" as const,
      operationNonce: `${publicationOrdinal + 1}`.repeat(32),
      requestContentDigest: digestV1(publicationOrdinal === 0 ? "d" : "e"),
      publicationOrdinal,
      sourceObjectOrdinal: sourceObject.objectOrdinal,
      sourceContentDigest: sourceObject.contentDigest,
      sourceSemanticLocatorDigest: sourceObject.semanticLocatorDigest,
      sourceLogicalLocatorReferenceDigest:
        sourceObject.logicalLocatorReferenceDigest,
      sourceProviderBindingReferenceDigest:
        sourceObject.providerBindingReferenceDigest,
      sourceLogicalBytes: sourceObject.logicalBytes,
      destinationProviderId: destinationProviderBinding.providerId,
      destinationProviderBinding,
      formalMigrationId,
      formalPlanPin,
      relationship:
        "metadata_only_destination_publication_committed_from_exact_formal_plan_source_object_v1" as const,
      receiptContentDigest: digestV1(publicationOrdinal === 0 ? "f" : "0"),
    }),
  );
  const selectedPublications = deepFreezeV1(
    options.missingPublication
      ? destinationObjectPublications.slice(0, 1)
      : destinationObjectPublications,
  );
  const terminalProgressReceipt = deepFreezeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_execution_progress_receipt_v1",
    progressRecord: {
      phase: "completed" as const,
      transition: "complete_execution" as const,
    },
    receiptContentDigest: digestV1("1"),
  });
  const executionCompletedState = deepFreezeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_execution_progress_state_v1",
    formalPlanEnvelope,
    formalPlanPin,
    currentRegistryManifestEnvelope,
    currentRegistryManifestPin,
    highWater: {
      phase: "completed" as const,
      copiedObjectCount: 2,
      remainingSourceObjectCount: 0,
    },
    destinationObjectPublications: selectedPublications,
  });
  const completed = deepFreezeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_completed_execution_continuation_v1",
    relationship:
      "exact_completed_execution_terminal_handoff_consumed_once_v1",
    executionCompletedState,
    terminalProgressReceipt,
    formalPlanEnvelope,
    formalPlanPin,
    migrationOnlyAcceptance: { profile: "fixture_migration_only_acceptance" },
    installationIdentityGenerationId,
    formalMigrationId,
    compoundPublicationReferenceMachineCapability,
    migrationOnlyAcceptanceReferenceMachineCapability,
    acceptanceIdentityVerificationCapability,
    currentRegistryManifestEnvelope,
    currentRegistryManifestPin,
    currentSupportCatalogPin,
    sourceReadClosure,
    destinationProviderBinding,
    destinationObjectPublications: selectedPublications,
  });
  const exactEndToEndSuccess = deepFreezeV1({
    authority:
      "in_memory_reference_machine_only_no_production_provider_authority_v1",
    durability: "in_memory_reference_only_not_a_durable_provider_v1",
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_end_to_end_execution_reference_validation_v1",
    relationship:
      "fresh_d43_committed_d44_strict_migration_only_d45_root_signed_rebinding_registry_plan_only_execution_completed_v1",
    migrationOnlyAcceptanceClosure: { profile: "fixture_d45" },
    rebindingRegistrySuccessorClosure: {
      currentRegistryManifestEnvelope,
      currentRegistryManifestPin,
    },
    executionProgressState: executionCompletedState,
    terminalReceipt: terminalProgressReceipt,
  });
  mockedCompletedExecutionsV1.set(exactEndToEndSuccess, completed);
  return {
    exactEndToEndSuccess,
    compoundPublicationReferenceMachineCapability,
    migrationOnlyAcceptanceReferenceMachineCapability,
    acceptanceIdentityVerificationCapability,
  };
}

describe("same-Identity destination universe zero-live reference closure", () => {
  it("forms an exact destination universe and exposes one Registry continuation", () => {
    const fixture = fixtureV1();
    const result =
      buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceFromExactEndToEndSuccessInternalV1(
        fixture.exactEndToEndSuccess as never,
      );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      authority:
        "in_memory_metadata_reference_only_no_real_provider_bytes_or_io_proof_v1",
      durability: "in_memory_reference_only_not_a_durable_provider_v1",
      sourceProviderId: "source-provider-1",
      destinationProviderId: "destination-provider-1",
      remainingSourceLiveOrdinals: [],
      completeDestinationPublicationReceiptSet: {
        receiptCount: 2,
        relationship:
          "exact_complete_ordered_receipt_set_for_formal_plan_objects_v1",
      },
      destinationUniverseMetadata: {
        objectCount: 2,
        logicalObjectBytesTotal: 12,
        relationship:
          "metadata_universe_exactly_covers_formal_plan_objects_v1",
      },
      zeroLiveReferenceProof: {
        sourceObjectCount: 2,
        migratedObjectCount: 2,
        remainingSourceLiveObjectCount: 0,
        remainingSourceLiveOrdinals: [],
        remainingSourceLiveReferenceCount: 0,
      },
    });
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.destinationUniverseMetadata.objects)).toBe(
      true,
    );
    const continuation =
      takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveRegistryContinuationInternalV1(
        result.value,
      );
    expect(continuation).toMatchObject({
      zeroLiveClosure: result.value,
      currentRegistryManifestEnvelope:
        result.value.currentRegistryManifestEnvelope,
      currentRegistryManifestPin: result.value.currentRegistryManifestPin,
      exactCompletedExecution: {
        executionCompletedState: result.value.executionCompletedState,
        terminalProgressReceipt: result.value.terminalProgressReceipt,
      },
      compoundPublicationReferenceMachineCapability:
        fixture.compoundPublicationReferenceMachineCapability,
      migrationOnlyAcceptanceReferenceMachineCapability:
        fixture.migrationOnlyAcceptanceReferenceMachineCapability,
      acceptanceIdentityVerificationCapability:
        fixture.acceptanceIdentityVerificationCapability,
      destinationUniverseMetadata: result.value.destinationUniverseMetadata,
      zeroLiveReferenceProof: result.value.zeroLiveReferenceProof,
    });
    expect(
      takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveRegistryContinuationInternalV1(
        result.value,
      ),
    ).toBeUndefined();
  });

  it("fails closed when the completed metadata omits a Plan publication", () => {
    const fixture = fixtureV1({ missingPublication: true });
    expect(
      buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceFromExactEndToEndSuccessInternalV1(
        fixture.exactEndToEndSuccess as never,
      ),
    ).toEqual({
      ok: false,
      stage: "publication_coverage",
      reason: "incomplete_or_invalid_destination_publications",
    });
  });
});
