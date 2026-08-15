import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { canonicalizeJcsSafeIntegerV1 } from "../src/jcs.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1Schema,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalMigrationIdMappingV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorClosureContentDigestV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate-wire.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";

const FORMAL_ID_DOMAIN_V1 =
  "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate-to-formal-id-v1";

function digestV1(character: string) {
  return `sha256:${character.repeat(64)}` as const;
}

function preSideEffectRequestV1() {
  return {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_request_reference_candidate_v1" as const,
    mode: "same_installation_identity" as const,
    reason: "provider_decommission" as const,
    admissionClass: "normal" as const,
    createdAt: "2026-08-15T00:00:00.000Z",
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
  };
}

function requestV1() {
  return {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_prepared_registry_successor_request_reference_candidate_v1" as const,
    preSideEffectRequest: preSideEffectRequestV1(),
    expectedCandidateMigrationId:
      `provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate:${"c".repeat(22)}`,
    expectedPreparedRegistryManifestPin: {
      locatorProfile: "installation_provider_registry_manifest_v1" as const,
      manifestGeneration: 2,
      generationId: `provider-registry-manifest:${"d".repeat(22)}`,
      contentDigest: digestV1("e"),
    },
  };
}

describe("D-42 prepared Registry successor wire", () => {
  it("accepts only the frozen exact4 request", () => {
    const request = requestV1();
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1Schema.parse(
        request,
      ),
    ).toEqual(request);
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1Schema.safeParse(
        { ...request, unexpected: true },
      ).success,
    ).toBe(false);
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1Schema.safeParse(
        {
          ...request,
          preSideEffectRequest: {
            ...request.preSideEffectRequest,
            createdAt: "2026-08-15T00:00:00Z",
          },
        },
      ).success,
    ).toBe(false);
  });

  it("maps the stable candidate ID through the exact cycle-free domain preimage", () => {
    const candidateMigrationId = requestV1().expectedCandidateMigrationId;
    const mapping =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalMigrationIdMappingV1(
        candidateMigrationId,
      );
    const independentHex = createHash("sha256")
      .update(
        canonicalizeJcsSafeIntegerV1([
          FORMAL_ID_DOMAIN_V1,
          { candidateMigrationId },
        ]),
        "utf8",
      )
      .digest("hex");
    expect(mapping).toEqual({
      profile:
        "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_plan_admission_closure_reference_candidate_to_formal_id_v1",
      candidateMigrationId,
      formalMigrationId: `provider-migration:${independentHex.slice(0, 22)}`,
      derivation:
        "sha256_jcs_domain_preimage_candidate_migration_id_only_first_22_lowercase_hex_v1",
    });
    expect(Object.isFrozen(mapping)).toBe(true);

    const originalEncodeDescriptor = Object.getOwnPropertyDescriptor(
      TextEncoder.prototype,
      "encode",
    );
    Object.defineProperty(TextEncoder.prototype, "encode", {
      configurable: true,
      value() {
        throw new TypeError("poisoned TextEncoder.prototype.encode");
      },
      writable: true,
    });
    try {
      expect(
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalMigrationIdMappingV1(
          candidateMigrationId,
        ),
      ).toEqual(mapping);
    } finally {
      if (originalEncodeDescriptor !== undefined) {
        Object.defineProperty(
          TextEncoder.prototype,
          "encode",
          originalEncodeDescriptor,
        );
      }
    }

    const other =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalMigrationIdMappingV1(
        `${candidateMigrationId.slice(0, -1)}d`,
      );
    expect(other.formalMigrationId).not.toBe(mapping.formalMigrationId);
    expect(() =>
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalMigrationIdMappingV1(
        `provider-migration:${"c".repeat(22)}`,
      ),
    ).toThrow();
    expect(() =>
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalMigrationIdMappingV1(
        `provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate:${"C".repeat(22)}`,
      ),
    ).toThrow();
    expect(() =>
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalMigrationIdMappingV1(
        { candidateMigrationId, unexpected: true },
      ),
    ).toThrow();
  });

  it("keeps closure derivation strict and rejects partial or extra-key projections", () => {
    expect(() =>
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorClosureContentDigestV1(
        {},
      ),
    ).toThrow();
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1Schema.safeParse(
        { unexpected: true },
      ).success,
    ).toBe(false);
  });
});
