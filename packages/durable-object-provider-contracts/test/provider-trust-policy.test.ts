import { describe, expect, it } from "vitest";

import {
  PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1,
  PROVIDER_MIGRATION_HISTORY_QUOTA_POLICY_V1,
  PROVIDER_TRUST_HISTORY_POLICY_V1,
  ProviderDistributionHistoryPolicyV1Schema,
  ProviderMigrationHistoryQuotaPolicyV1Schema,
  ProviderTrustHistoryPolicyV1Schema,
} from "../src/provider-trust-policy.js";

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
}

function withField(
  value: object,
  field: string,
  replacement: unknown,
): Record<string, unknown> {
  return { ...cloneJson(value), [field]: replacement };
}

describe("provider trust and distribution policy contracts", () => {
  it("parses the exact migration-history quota policy", () => {
    expect(
      ProviderMigrationHistoryQuotaPolicyV1Schema.parse(
        PROVIDER_MIGRATION_HISTORY_QUOTA_POLICY_V1,
      ),
    ).toEqual(PROVIDER_MIGRATION_HISTORY_QUOTA_POLICY_V1);
    expect(PROVIDER_MIGRATION_HISTORY_QUOTA_POLICY_V1).toEqual({
      profile: "provider_migration_history_quota_policy_v1",
      scope: "installation_identity_generation",
      storageBoundary: "installation_state_provider_isolated_namespace",
      maxChargedMigrationCountPerInstallationIdentity: 64,
      maxChargedMigrationHistoryLogicalBytesPerInstallationIdentity:
        8_589_934_592,
      maxChargedMigrationHistoryProviderAllocatedBytesPerInstallationIdentity:
        17_179_869_184,
      maxSingleMigrationHistoryReservationLogicalBytes: 4_294_967_296,
      maxSingleMigrationHistoryReservationProviderAllocatedBytes:
        8_589_934_592,
      maxActiveMigrationReservationCountPerInstallationIdentity: 4,
      maxActiveReservedMigrationHistoryLogicalBytesPerInstallationIdentity:
        8_589_934_592,
      maxActiveReservedMigrationHistoryProviderAllocatedBytesPerInstallationIdentity:
        17_179_869_184,
      maxReservationRecordCountPerInstallationIdentity: 4_096,
      maxReservationRecordLogicalBytesPerInstallationIdentity: 67_108_864,
      maxSingleReservationRecordLogicalBytes: 1_048_576,
      maxChargedObjectReceiptCountPerInstallationIdentity: 2_000_000,
      maxChargedObjectReceiptLogicalBytesPerInstallationIdentity:
        2_147_483_648,
      maxChargedSemanticRootZeroProofCountPerInstallationIdentity: 4_000_512,
      maxChargedSemanticRootZeroProofLogicalBytesPerInstallationIdentity:
        2_147_483_648,
      maxChargedProgressRecordCountPerInstallationIdentity: 4_000_032,
      maxChargedProgressRecordLogicalBytesPerInstallationIdentity:
        2_147_483_648,
      maxChargedProgressOperationReceiptCountPerInstallationIdentity:
        8_000_000,
      maxChargedProgressOperationReceiptLogicalBytesPerInstallationIdentity:
        2_147_483_648,
      normalUpdateEmergencyMigrationCountReserve: 1,
      normalUpdateEmergencyMigrationHistoryLogicalBytesReserve:
        4_294_967_296,
      normalUpdateEmergencyMigrationHistoryProviderAllocatedBytesReserve:
        8_589_934_592,
      maxLedgerEventCountPerInstallationIdentity: 4_096,
      maxLedgerEventLogicalBytesPerInstallationIdentity: 67_108_864,
      maxSingleLedgerEventLogicalBytes: 262_144,
      maxOperationReceiptCountPerInstallationIdentity: 4_096,
      maxOperationReceiptLogicalBytesPerInstallationIdentity: 268_435_456,
      maxSingleOperationReceiptLogicalBytes: 1_048_576,
      maxCurrentHighWaterLogicalBytes: 1_048_576,
      reservedAccountFutureTerminalTransitionEscrowCount: 3,
      retainedAccountFutureTerminalTransitionEscrowCount: 1,
      admission:
        "reserve_migration_slot_bytes_record_caps_and_terminal_control_escrow_before_first_migration_side_effect",
      exhaustion: "zero_write_migration_required_new_installation_identity",
    });
  });

  it("parses the exact trust policy and its nested migration policy", () => {
    expect(
      ProviderTrustHistoryPolicyV1Schema.parse(
        PROVIDER_TRUST_HISTORY_POLICY_V1,
      ),
    ).toEqual(PROVIDER_TRUST_HISTORY_POLICY_V1);
    expect(PROVIDER_TRUST_HISTORY_POLICY_V1).toEqual({
      profile: "provider_trust_history_policy_v1",
      maxRootMetadataGenerationCountPerInstallationIdentity: 256,
      maxRegistryManifestGenerationCountPerInstallationIdentity: 4_096,
      maxSupportCatalogGenerationCountPerInstallationIdentity: 4_096,
      maxAcceptanceGenerationCountPerInstallationIdentity: 4_096,
      maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity: 4_096,
      maxAcceptanceCompareAppendReceiptLogicalBytesPerInstallationIdentity:
        67_108_864,
      maxSingleAcceptanceCompareAppendReceiptLogicalBytes: 1_048_576,
      maxProviderVerificationPublicKeyRecordCountPerProvider: 256,
      maxProviderVerificationPublicKeyRecordCountPerUsage: 64,
      maxBindingDerivationGenerationRecordCountPerProvider: 64,
      maxApproverPublicKeyRecordCountPerRole: 64,
      maxCompromisedRevocationRecordCountPerIdentity: 256,
      maxSingleTrustEnvelopeLogicalBytes: 4_194_304,
      maxTotalTrustHistoryLogicalBytesPerInstallationIdentity: 268_435_456,
      normalUpdateEmergencyGenerationReserve: 8,
      normalUpdateEmergencyAcceptanceReceiptReserve: 8,
      normalUpdateEmergencyLogicalBytesReserve: 4_194_304,
      migrationHistoryQuotaPolicy:
        PROVIDER_MIGRATION_HISTORY_QUOTA_POLICY_V1,
      admission:
        "canonicalize_complete_successor_and_retained_verification_closure_before_first_side_effect",
      exhaustion: {
        providerScopedHistory:
          "zero_write_same_identity_dual_provider_migration_or_new_identity_rebootstrap",
        installationWideHistory:
          "zero_write_new_installation_identity_rebootstrap_migration_required",
      },
    });
  });

  it("parses the exact distribution-history policy", () => {
    expect(
      ProviderDistributionHistoryPolicyV1Schema.parse(
        PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1,
      ),
    ).toEqual(PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1);
    expect(PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1).toEqual({
      profile: "provider_distribution_history_policy_v1",
      maxSupportCatalogGenerationCount: 4_096,
      maxPublicTaxonomyGenerationCount: 4_096,
      maxReleaseMatrixGenerationCount: 4_096,
      maxTargetDiscoveryResultGenerationCount: 4_096,
      maxReleaseTargetUniverseGenerationCount: 4_096,
      maxSingleDistributionObjectCanonicalBytes: 16_777_216,
      maxTotalRetainedDistributionObjectCount: 65_536,
      maxTotalRetainedDistributionHistoryLogicalBytes: 536_870_912,
      normalUpdateEmergencyGenerationReservePerChain: 8,
      normalUpdateEmergencyLogicalBytesReserve: 16_777_216,
      admission:
        "stream_verify_five_chains_embedded_bundles_and_transitive_source_envelopes_before_accepting_distribution",
      exhaustion:
        "reject_candidate_distribution_and_preserve_last_verified_distribution",
    });
  });

  it("deep-freezes every exported policy constant", () => {
    expectDeepFrozen(PROVIDER_MIGRATION_HISTORY_QUOTA_POLICY_V1);
    expectDeepFrozen(PROVIDER_TRUST_HISTORY_POLICY_V1);
    expectDeepFrozen(PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1);
  });

  it("rejects representative frozen numeric boundaries at minus and plus one", () => {
    for (const value of [63, 65]) {
      expect(
        ProviderMigrationHistoryQuotaPolicyV1Schema.safeParse(
          withField(
            PROVIDER_MIGRATION_HISTORY_QUOTA_POLICY_V1,
            "maxChargedMigrationCountPerInstallationIdentity",
            value,
          ),
        ).success,
      ).toBe(false);
    }

    for (const value of [255, 257]) {
      expect(
        ProviderTrustHistoryPolicyV1Schema.safeParse(
          withField(
            PROVIDER_TRUST_HISTORY_POLICY_V1,
            "maxRootMetadataGenerationCountPerInstallationIdentity",
            value,
          ),
        ).success,
      ).toBe(false);
    }

    for (const value of [65_535, 65_537]) {
      expect(
        ProviderDistributionHistoryPolicyV1Schema.safeParse(
          withField(
            PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1,
            "maxTotalRetainedDistributionObjectCount",
            value,
          ),
        ).success,
      ).toBe(false);
    }
  });

  it("rejects top-level and nested extra keys", () => {
    expect(
      ProviderMigrationHistoryQuotaPolicyV1Schema.safeParse({
        ...PROVIDER_MIGRATION_HISTORY_QUOTA_POLICY_V1,
        extra: true,
      }).success,
    ).toBe(false);
    expect(
      ProviderDistributionHistoryPolicyV1Schema.safeParse({
        ...PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1,
        extra: true,
      }).success,
    ).toBe(false);
    expect(
      ProviderTrustHistoryPolicyV1Schema.safeParse({
        ...PROVIDER_TRUST_HISTORY_POLICY_V1,
        exhaustion: {
          ...PROVIDER_TRUST_HISTORY_POLICY_V1.exhaustion,
          extra: true,
        },
      }).success,
    ).toBe(false);
    expect(
      ProviderTrustHistoryPolicyV1Schema.safeParse({
        ...PROVIDER_TRUST_HISTORY_POLICY_V1,
        migrationHistoryQuotaPolicy: {
          ...PROVIDER_MIGRATION_HISTORY_QUOTA_POLICY_V1,
          extra: true,
        },
      }).success,
    ).toBe(false);
  });

  it("rejects policy substitution and mixed nested policy families", () => {
    expect(
      ProviderMigrationHistoryQuotaPolicyV1Schema.safeParse(
        PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1,
      ).success,
    ).toBe(false);
    expect(
      ProviderDistributionHistoryPolicyV1Schema.safeParse(
        PROVIDER_TRUST_HISTORY_POLICY_V1,
      ).success,
    ).toBe(false);
    expect(
      ProviderTrustHistoryPolicyV1Schema.safeParse({
        ...PROVIDER_TRUST_HISTORY_POLICY_V1,
        migrationHistoryQuotaPolicy:
          PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1,
      }).success,
    ).toBe(false);
  });
});
