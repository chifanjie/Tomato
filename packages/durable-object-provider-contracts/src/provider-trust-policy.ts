import { z } from "./zod-runtime.js";

export const ProviderMigrationHistoryQuotaPolicyV1Schema = z.strictObject({
  profile: z.literal("provider_migration_history_quota_policy_v1"),
  scope: z.literal("installation_identity_generation"),
  storageBoundary: z.literal(
    "installation_state_provider_isolated_namespace",
  ),
  maxChargedMigrationCountPerInstallationIdentity: z.literal(64),
  maxChargedMigrationHistoryLogicalBytesPerInstallationIdentity:
    z.literal(8_589_934_592),
  maxChargedMigrationHistoryProviderAllocatedBytesPerInstallationIdentity:
    z.literal(17_179_869_184),
  maxSingleMigrationHistoryReservationLogicalBytes:
    z.literal(4_294_967_296),
  maxSingleMigrationHistoryReservationProviderAllocatedBytes:
    z.literal(8_589_934_592),
  maxActiveMigrationReservationCountPerInstallationIdentity: z.literal(4),
  maxActiveReservedMigrationHistoryLogicalBytesPerInstallationIdentity:
    z.literal(8_589_934_592),
  maxActiveReservedMigrationHistoryProviderAllocatedBytesPerInstallationIdentity:
    z.literal(17_179_869_184),
  maxReservationRecordCountPerInstallationIdentity: z.literal(4_096),
  maxReservationRecordLogicalBytesPerInstallationIdentity:
    z.literal(67_108_864),
  maxSingleReservationRecordLogicalBytes: z.literal(1_048_576),
  maxChargedObjectReceiptCountPerInstallationIdentity: z.literal(2_000_000),
  maxChargedObjectReceiptLogicalBytesPerInstallationIdentity:
    z.literal(2_147_483_648),
  maxChargedSemanticRootZeroProofCountPerInstallationIdentity:
    z.literal(4_000_512),
  maxChargedSemanticRootZeroProofLogicalBytesPerInstallationIdentity:
    z.literal(2_147_483_648),
  maxChargedProgressRecordCountPerInstallationIdentity: z.literal(4_000_032),
  maxChargedProgressRecordLogicalBytesPerInstallationIdentity:
    z.literal(2_147_483_648),
  maxChargedProgressOperationReceiptCountPerInstallationIdentity:
    z.literal(8_000_000),
  maxChargedProgressOperationReceiptLogicalBytesPerInstallationIdentity:
    z.literal(2_147_483_648),
  normalUpdateEmergencyMigrationCountReserve: z.literal(1),
  normalUpdateEmergencyMigrationHistoryLogicalBytesReserve:
    z.literal(4_294_967_296),
  normalUpdateEmergencyMigrationHistoryProviderAllocatedBytesReserve:
    z.literal(8_589_934_592),
  maxLedgerEventCountPerInstallationIdentity: z.literal(4_096),
  maxLedgerEventLogicalBytesPerInstallationIdentity: z.literal(67_108_864),
  maxSingleLedgerEventLogicalBytes: z.literal(262_144),
  maxOperationReceiptCountPerInstallationIdentity: z.literal(4_096),
  maxOperationReceiptLogicalBytesPerInstallationIdentity:
    z.literal(268_435_456),
  maxSingleOperationReceiptLogicalBytes: z.literal(1_048_576),
  maxCurrentHighWaterLogicalBytes: z.literal(1_048_576),
  reservedAccountFutureTerminalTransitionEscrowCount: z.literal(3),
  retainedAccountFutureTerminalTransitionEscrowCount: z.literal(1),
  admission: z.literal(
    "reserve_migration_slot_bytes_record_caps_and_terminal_control_escrow_before_first_migration_side_effect",
  ),
  exhaustion: z.literal(
    "zero_write_migration_required_new_installation_identity",
  ),
});
export type ProviderMigrationHistoryQuotaPolicyV1 = z.infer<
  typeof ProviderMigrationHistoryQuotaPolicyV1Schema
>;

export const ProviderTrustHistoryPolicyV1Schema = z.strictObject({
  profile: z.literal("provider_trust_history_policy_v1"),
  maxRootMetadataGenerationCountPerInstallationIdentity: z.literal(256),
  maxRegistryManifestGenerationCountPerInstallationIdentity: z.literal(4_096),
  maxSupportCatalogGenerationCountPerInstallationIdentity: z.literal(4_096),
  maxAcceptanceGenerationCountPerInstallationIdentity: z.literal(4_096),
  maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity:
    z.literal(4_096),
  maxAcceptanceCompareAppendReceiptLogicalBytesPerInstallationIdentity:
    z.literal(67_108_864),
  maxSingleAcceptanceCompareAppendReceiptLogicalBytes:
    z.literal(1_048_576),
  maxProviderVerificationPublicKeyRecordCountPerProvider: z.literal(256),
  maxProviderVerificationPublicKeyRecordCountPerUsage: z.literal(64),
  maxBindingDerivationGenerationRecordCountPerProvider: z.literal(64),
  maxApproverPublicKeyRecordCountPerRole: z.literal(64),
  maxCompromisedRevocationRecordCountPerIdentity: z.literal(256),
  maxSingleTrustEnvelopeLogicalBytes: z.literal(4_194_304),
  maxTotalTrustHistoryLogicalBytesPerInstallationIdentity:
    z.literal(268_435_456),
  normalUpdateEmergencyGenerationReserve: z.literal(8),
  normalUpdateEmergencyAcceptanceReceiptReserve: z.literal(8),
  normalUpdateEmergencyLogicalBytesReserve: z.literal(4_194_304),
  migrationHistoryQuotaPolicy:
    ProviderMigrationHistoryQuotaPolicyV1Schema,
  admission: z.literal(
    "canonicalize_complete_successor_and_retained_verification_closure_before_first_side_effect",
  ),
  exhaustion: z.strictObject({
    providerScopedHistory: z.literal(
      "zero_write_same_identity_dual_provider_migration_or_new_identity_rebootstrap",
    ),
    installationWideHistory: z.literal(
      "zero_write_new_installation_identity_rebootstrap_migration_required",
    ),
  }),
});
export type ProviderTrustHistoryPolicyV1 = z.infer<
  typeof ProviderTrustHistoryPolicyV1Schema
>;

export const ProviderDistributionHistoryPolicyV1Schema = z.strictObject({
  profile: z.literal("provider_distribution_history_policy_v1"),
  maxSupportCatalogGenerationCount: z.literal(4_096),
  maxPublicTaxonomyGenerationCount: z.literal(4_096),
  maxReleaseMatrixGenerationCount: z.literal(4_096),
  maxTargetDiscoveryResultGenerationCount: z.literal(4_096),
  maxReleaseTargetUniverseGenerationCount: z.literal(4_096),
  maxSingleDistributionObjectCanonicalBytes: z.literal(16_777_216),
  maxTotalRetainedDistributionObjectCount: z.literal(65_536),
  maxTotalRetainedDistributionHistoryLogicalBytes: z.literal(536_870_912),
  normalUpdateEmergencyGenerationReservePerChain: z.literal(8),
  normalUpdateEmergencyLogicalBytesReserve: z.literal(16_777_216),
  admission: z.literal(
    "stream_verify_five_chains_embedded_bundles_and_transitive_source_envelopes_before_accepting_distribution",
  ),
  exhaustion: z.literal(
    "reject_candidate_distribution_and_preserve_last_verified_distribution",
  ),
});
export type ProviderDistributionHistoryPolicyV1 = z.infer<
  typeof ProviderDistributionHistoryPolicyV1Schema
>;

function deepFreezePolicy<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreezePolicy(child);
    Object.freeze(value);
  }
  return value;
}

export const PROVIDER_MIGRATION_HISTORY_QUOTA_POLICY_V1 = deepFreezePolicy(
  ProviderMigrationHistoryQuotaPolicyV1Schema.parse({
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
    maxChargedProgressOperationReceiptCountPerInstallationIdentity: 8_000_000,
    maxChargedProgressOperationReceiptLogicalBytesPerInstallationIdentity:
      2_147_483_648,
    normalUpdateEmergencyMigrationCountReserve: 1,
    normalUpdateEmergencyMigrationHistoryLogicalBytesReserve: 4_294_967_296,
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
  }),
);

export const PROVIDER_TRUST_HISTORY_POLICY_V1 = deepFreezePolicy(
  ProviderTrustHistoryPolicyV1Schema.parse({
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
  }),
);

export const PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1 = deepFreezePolicy(
  ProviderDistributionHistoryPolicyV1Schema.parse({
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
  }),
);
