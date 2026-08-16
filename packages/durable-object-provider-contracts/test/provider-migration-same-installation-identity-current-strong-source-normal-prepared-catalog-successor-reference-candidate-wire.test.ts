import { describe, expect, it } from "vitest";

import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1Schema,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-prepared-catalog-successor-reference-candidate-wire.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";

function digestV1(character: string) {
  return `sha256:${character.repeat(64)}` as const;
}

function requestV1() {
  return {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_prepared_catalog_successor_request_reference_candidate_v1" as const,
    preparedRegistrySuccessorRequest: {
      profile:
        "provider_migration_same_installation_identity_current_strong_source_normal_prepared_registry_successor_request_reference_candidate_v1" as const,
      preSideEffectRequest: {
        profile:
          "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_request_reference_candidate_v1" as const,
        mode: "same_installation_identity" as const,
        reason: "provider_decommission" as const,
        admissionClass: "normal" as const,
        createdAt: "2026-08-16T00:00:00.000Z",
        migrationBudgets:
          ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema.parse(
            {
              profile:
                "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_budgets_reference_candidate_v1",
              maxRootEntries: 6,
              maxLiveObjects: 1,
              maxReferenceEdges: 1,
              maxRewriteObjects: 1,
              maxRewriteReferenceMappings: 1,
              maxRewriteSccs: 1,
              maxLogicalObjectBytesTotal: 100,
              maxProgressRecords: 9,
              maxProgressOperationReceipts: 1,
              maxCanonicalUniverseBytes: 1_000_000,
              maxCanonicalReferenceSetBytes: 1_000_000,
              maxCanonicalRewritePlanBytes: 1,
              maxCanonicalRewrittenReferenceSetBytesTotal: 1,
              maxCanonicalSemanticEquivalenceProofBytesTotal: 1,
              maxCanonicalRootRewriteProofSetBytes: 1,
              maxCanonicalZeroLiveProofBytes: 1,
              maxCanonicalReceiptBytesTotal: 1,
              maxCanonicalProgressRecordSetBytes: 1,
              maxCanonicalProgressOperationReceiptBytesTotal: 1,
              maxCanonicalMigrationBytesTotal: 4_194_304,
              maxRetainedMigrationHistoryLogicalBytesTotal: 4_194_304,
              maxRetainedMigrationHistoryProviderAllocatedBytesTotal: 8_388_608,
              maxSingleRecordBytes: 4_194_304,
            },
          ),
        liveReferenceSchemaDigest: digestV1("a"),
        migrationProtocolDigest: digestV1("b"),
      },
      expectedCandidateMigrationId:
        `provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate:${"c".repeat(22)}`,
      expectedPreparedRegistryManifestPin: {
        locatorProfile: "installation_provider_registry_manifest_v1" as const,
        manifestGeneration: 2,
        generationId: `provider-registry-manifest:${"d".repeat(22)}`,
        contentDigest: digestV1("e"),
      },
    },
    expectedPreparedCatalogPin: {
      locatorProfile:
        "distribution_provider_feasibility_support_catalog_v1" as const,
      catalogGeneration: 2,
      contentDigest: digestV1("f"),
    },
  };
}

describe("D-43 prepared Catalog successor wire", () => {
  it("accepts the frozen nested exact3 request", () => {
    const request = requestV1();
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1Schema.parse(
        request,
      ),
    ).toEqual(request);
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1Schema.safeParse(
        { ...request, unexpected: true },
      ).success,
    ).toBe(false);
  });
});
