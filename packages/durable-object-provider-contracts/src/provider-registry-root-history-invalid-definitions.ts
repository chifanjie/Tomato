import type {
  ProviderRegistryRootHistoryDiagnosticReasonV1,
  ProviderRegistryRootHistoryDiagnosticStageV1,
} from "./provider-registry-root-history.js";

export const PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RECIPE_DIALECT_V1 =
  "provider_registry_root_history_invalid_recipe_v1" as const;
export const PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_LITERAL_V1 =
  "fixtures/v1/golden/provider-registry-root-history-v1.json" as const;

export type ProviderRegistryRootHistoryInvalidSeedV1 =
  | { readonly source: "none" }
  | {
      readonly source: "literal_non_production";
      readonly seedHex: string;
    }
  | {
      readonly source: "golden_json_pointer";
      readonly resourcePath: typeof PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_LITERAL_V1;
      readonly jsonPointer: string;
    };

export interface ProviderRegistryRootHistoryInvalidCaseDefinitionV1 {
  readonly caseId: string;
  readonly mutation: {
    readonly dialect: typeof PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RECIPE_DIALECT_V1;
    readonly operation: string;
    readonly targetJsonPointer: string;
    readonly operands: readonly string[];
    readonly deterministicSeed: ProviderRegistryRootHistoryInvalidSeedV1;
  };
  readonly expected: {
    readonly boundary: "internal_diagnostic";
    readonly stage: ProviderRegistryRootHistoryDiagnosticStageV1;
    readonly reason: ProviderRegistryRootHistoryDiagnosticReasonV1;
    readonly publicFailureReason: "attestation_invalid";
    readonly postAttestationPointCalls: number;
    readonly postAttestationSignatureCalls: number;
  };
}

function defineInvalidCase(
  caseId: string,
  operation: string,
  targetJsonPointer: string,
  operands: readonly string[],
  deterministicSeed: ProviderRegistryRootHistoryInvalidSeedV1,
  stage: ProviderRegistryRootHistoryDiagnosticStageV1,
  reason: ProviderRegistryRootHistoryDiagnosticReasonV1,
  postAttestationPointCalls: number,
  postAttestationSignatureCalls: number,
): ProviderRegistryRootHistoryInvalidCaseDefinitionV1 {
  return Object.freeze({
    caseId,
    mutation: Object.freeze({
      dialect:
        PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RECIPE_DIALECT_V1,
      operation,
      targetJsonPointer,
      operands: Object.freeze([...operands]),
      deterministicSeed: Object.freeze({ ...deterministicSeed }),
    }),
    expected: Object.freeze({
      boundary: "internal_diagnostic" as const,
      stage,
      reason,
      publicFailureReason: "attestation_invalid" as const,
      postAttestationPointCalls,
      postAttestationSignatureCalls,
    }),
  });
}

export const PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_CASE_DEFINITIONS_V1 =
  Object.freeze([
    defineInvalidCase("history-empty", "replace_history_with_empty", "/rootMetadataHistory", [], {"source":"none"}, "history_input", "history_empty", 0, 0),
    defineInvalidCase("bootstrap-anchor-substitution", "replace_bootstrap_active_root_and_resign_self", "/rootMetadataHistory/0", ["/rootMetadataHistory/1/payload/activeRoot"], {"source":"golden_json_pointer","resourcePath":"fixtures/v1/golden/provider-registry-root-history-v1.json","jsonPointer":"/deterministicSeeds/plannedRootSeedHex"}, "bootstrap_anchor", "bootstrap_metadata_mismatch", 5, 1),
    defineInvalidCase("bootstrap-generation-substitution", "replace_number", "/rootMetadataHistory/0/rootGeneration", ["2"], {"source":"none"}, "root_metadata_envelope", "envelope_mismatch", 5, 1),
    defineInvalidCase("history-generation-gap", "replace_number_and_reseal_envelope", "/rootMetadataHistory/1/payload/rootGeneration", ["3"], {"source":"none"}, "history_predecessor", "generation_not_contiguous", 7, 2),
    defineInvalidCase("history-generation-rollback", "duplicate_history_envelope", "/rootMetadataHistory/2", ["/rootMetadataHistory/1"], {"source":"none"}, "history_predecessor", "generation_not_contiguous", 9, 6),
    defineInvalidCase("predecessor-generation-substitution", "replace_number_and_resign_all", "/rootMetadataHistory/1/payload/predecessor/rootGeneration", ["2"], {"source":"golden_json_pointer","resourcePath":"fixtures/v1/golden/provider-registry-root-history-v1.json","jsonPointer":"/deterministicSeeds/plannedRootSeedHex"}, "history_predecessor", "predecessor_pin_mismatch", 7, 2),
    defineInvalidCase("predecessor-root-key-substitution", "replace_string_and_resign_all", "/rootMetadataHistory/1/payload/predecessor/rootKeyId", ["b428dd9c9d0cb51b9b44a8"], {"source":"golden_json_pointer","resourcePath":"fixtures/v1/golden/provider-registry-root-history-v1.json","jsonPointer":"/deterministicSeeds/plannedRootSeedHex"}, "history_predecessor", "predecessor_pin_mismatch", 7, 2),
    defineInvalidCase("predecessor-content-digest-substitution", "replace_string_and_resign_all", "/rootMetadataHistory/1/payload/predecessor/contentDigest", ["sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"], {"source":"golden_json_pointer","resourcePath":"fixtures/v1/golden/provider-registry-root-history-v1.json","jsonPointer":"/deterministicSeeds/plannedRootSeedHex"}, "history_predecessor", "predecessor_pin_mismatch", 7, 2),
    defineInvalidCase("self-signature-bitflip", "flip_signature_last_bit", "/rootMetadataHistory/1/payload/selfSignature", [], {"source":"none"}, "root_self_signature", "self_signature_invalid", 9, 3),
    defineInvalidCase("self-signature-wrong-domain", "resign_with_domain", "/rootMetadataHistory/1/payload/selfSignature", ["provider-registry-root-cross-signature-v1"], {"source":"golden_json_pointer","resourcePath":"fixtures/v1/golden/provider-registry-root-history-v1.json","jsonPointer":"/deterministicSeeds/plannedRootSeedHex"}, "root_self_signature", "self_signature_invalid", 9, 3),
    defineInvalidCase("self-signature-prefix-substitution", "replace_signature_prefix_key_id", "/rootMetadataHistory/1/payload/selfSignature", ["bfe44356f03760a13c8e1b"], {"source":"none"}, "root_metadata_envelope", "envelope_mismatch", 7, 2),
    defineInvalidCase("cross-signature-bitflip", "flip_signature_last_bit", "/rootMetadataHistory/1/payload/predecessorCrossSignature", [], {"source":"none"}, "root_cross_signature", "cross_signature_invalid", 9, 4),
    defineInvalidCase("cross-signature-wrong-domain", "resign_with_domain", "/rootMetadataHistory/1/payload/predecessorCrossSignature", ["provider-registry-root-self-signature-v1"], {"source":"golden_json_pointer","resourcePath":"fixtures/v1/golden/provider-registry-root-history-v1.json","jsonPointer":"/deterministicSeeds/bootstrapRootSeedHex"}, "root_cross_signature", "cross_signature_invalid", 9, 4),
    defineInvalidCase("cross-signature-prefix-substitution", "replace_signature_prefix_key_id", "/rootMetadataHistory/1/payload/predecessorCrossSignature", ["ec3cca8fc833754cd58394"], {"source":"none"}, "root_metadata_envelope", "envelope_mismatch", 7, 2),
    defineInvalidCase("planned-cross-signature-missing", "delete_property", "/rootMetadataHistory/1/payload/predecessorCrossSignature", [], {"source":"none"}, "root_metadata_envelope", "schema_invalid", 7, 2),
    defineInvalidCase("compromise-cross-signature-injected", "copy_property", "/rootMetadataHistory/2/payload/predecessorCrossSignature", ["/rootMetadataHistory/1/payload/predecessorCrossSignature"], {"source":"none"}, "root_metadata_envelope", "schema_invalid", 9, 6),
    defineInvalidCase("recovery-signature-missing", "remove_array_item", "/rootMetadataHistory/1/payload/recoverySignatures", ["1"], {"source":"none"}, "root_metadata_envelope", "schema_invalid", 7, 2),
    defineInvalidCase("recovery-signature-extra", "append_array_item", "/rootMetadataHistory/1/payload/recoverySignatures", ["/rootMetadataHistory/1/payload/recoverySignatures/0"], {"source":"none"}, "root_metadata_envelope", "schema_invalid", 7, 2),
    defineInvalidCase("recovery-signature-duplicate-signer", "resign_recovery_with_key", "/rootMetadataHistory/1/payload/recoverySignatures/1", ["1b5e57fd47720f4d9c9c86"], {"source":"golden_json_pointer","resourcePath":"fixtures/v1/golden/provider-registry-root-history-v1.json","jsonPointer":"/deterministicSeeds/recoverySeedHexes/0"}, "root_metadata_envelope", "envelope_mismatch", 7, 2),
    defineInvalidCase("recovery-signature-reversed", "reverse_array", "/rootMetadataHistory/1/payload/recoverySignatures", [], {"source":"none"}, "root_metadata_envelope", "envelope_mismatch", 7, 2),
    defineInvalidCase("recovery-signature-unknown-signer", "resign_recovery_with_literal_seed", "/rootMetadataHistory/1/payload/recoverySignatures/0", [], {"source":"literal_non_production","seedHex":"7070707070707070707070707070707070707070707070707070707070707070"}, "root_recovery_signature", "recovery_quorum_invalid", 9, 4),
    defineInvalidCase("recovery-signature-bitflip", "flip_signature_last_bit", "/rootMetadataHistory/1/payload/recoverySignatures/0", [], {"source":"none"}, "root_recovery_signature", "recovery_quorum_invalid", 9, 5),
    defineInvalidCase("recovery-signature-wrong-domain", "resign_with_domain", "/rootMetadataHistory/1/payload/recoverySignatures/0", ["provider-registry-root-self-signature-v1"], {"source":"golden_json_pointer","resourcePath":"fixtures/v1/golden/provider-registry-root-history-v1.json","jsonPointer":"/deterministicSeeds/recoverySeedHexes/0"}, "root_recovery_signature", "recovery_quorum_invalid", 9, 5),
    defineInvalidCase("root-reuses-historical-root-material", "replace_active_root_and_resign_self", "/rootMetadataHistory/2/payload/activeRoot", ["/rootMetadataHistory/0/payload/activeRoot"], {"source":"golden_json_pointer","resourcePath":"fixtures/v1/golden/provider-registry-root-history-v1.json","jsonPointer":"/deterministicSeeds/bootstrapRootSeedHex"}, "root_material_closure", "root_key_material_alias", 9, 6),
    defineInvalidCase("root-reuses-recovery-material", "replace_active_root_from_recovery_and_resign_self", "/rootMetadataHistory/2/payload/activeRoot", ["/bootstrapTrustBundle/providerRegistryRecoveryKeys/0"], {"source":"golden_json_pointer","resourcePath":"fixtures/v1/golden/provider-registry-root-history-v1.json","jsonPointer":"/deterministicSeeds/recoverySeedHexes/0"}, "root_material_closure", "root_key_material_alias", 9, 6),
    defineInvalidCase("root-point-invalid", "replace_active_root_with_small_order_point", "/rootMetadataHistory/2/payload/activeRoot", ["base64url:AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"], {"source":"none"}, "root_key_admission", "point_admission_failed", 10, 6),
    defineInvalidCase("envelope-outer-generation-mismatch", "replace_number", "/rootMetadataHistory/1/rootGeneration", ["3"], {"source":"none"}, "root_metadata_envelope", "envelope_mismatch", 7, 2),
    defineInvalidCase("envelope-outer-key-mismatch", "replace_string", "/rootMetadataHistory/1/rootKeyId", ["bfe44356f03760a13c8e1b"], {"source":"none"}, "root_metadata_envelope", "envelope_mismatch", 7, 2),
    defineInvalidCase("envelope-content-digest-mismatch", "replace_string", "/rootMetadataHistory/1/contentDigest", ["sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"], {"source":"none"}, "root_metadata_envelope", "envelope_mismatch", 7, 2),
    defineInvalidCase("envelope-byte-cap-exceeded", "replace_timestamp_with_repeated_ascii", "/rootMetadataHistory/1/payload/issuedAt", ["4194305","61"], {"source":"none"}, "history_limit", "envelope_byte_limit_exceeded", 7, 2),
    defineInvalidCase("root-generation-count-cap-exceeded", "repeat_history_envelope", "/rootMetadataHistory", ["257","/rootMetadataHistory/2"], {"source":"none"}, "history_limit", "history_generation_limit_exceeded", 0, 0),
  ]);
