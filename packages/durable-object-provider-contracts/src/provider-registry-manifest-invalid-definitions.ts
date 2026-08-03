export const PROVIDER_REGISTRY_MANIFEST_INVALID_RECIPE_DIALECT_V1 =
  "provider_registry_manifest_history_invalid_recipe_v1" as const;
export const PROVIDER_REGISTRY_MANIFEST_GOLDEN_RESOURCE_PATH_LITERAL_V1 =
  "fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json" as const;

export type ProviderRegistryManifestInvalidStageV1 =
  | "history_input"
  | "history_limit"
  | "root_history"
  | "manifest_envelope"
  | "root_binding"
  | "manifest_predecessor"
  | "manifest_signature"
  | "member_set"
  | "registry_entry"
  | "record_signature"
  | "key_admission"
  | "key_history"
  | "material_closure"
  | "routing";

export type ProviderRegistryManifestInvalidReasonV1 =
  | "schema_invalid"
  | "history_empty"
  | "history_generation_limit_exceeded"
  | "envelope_byte_limit_exceeded"
  | "history_total_byte_limit_exceeded"
  | "root_history_invalid"
  | "envelope_mismatch"
  | "root_pin_mismatch"
  | "root_generation_rollback"
  | "generation_not_contiguous"
  | "predecessor_pin_mismatch"
  | "signature_invalid"
  | "member_order_invalid"
  | "member_transition_invalid"
  | "entry_mismatch"
  | "entry_successor_invalid"
  | "record_history_invalid"
  | "active_record_invalid"
  | "revocation_invalid"
  | "point_admission_failed"
  | "public_key_material_alias"
  | "routing_invalid";

export interface ProviderRegistryManifestInvalidCaseDefinitionV1 {
  readonly caseId: string;
  readonly mutation: {
    readonly dialect: typeof PROVIDER_REGISTRY_MANIFEST_INVALID_RECIPE_DIALECT_V1;
    readonly goldenResourcePath: typeof PROVIDER_REGISTRY_MANIFEST_GOLDEN_RESOURCE_PATH_LITERAL_V1;
    readonly steps: readonly [
      {
        readonly operation: string;
        readonly targetJsonPointer: string;
        readonly operands: readonly string[];
      },
    ];
  };
  readonly expected: {
    readonly boundary: "internal_diagnostic";
    readonly stage: ProviderRegistryManifestInvalidStageV1;
    readonly reason: ProviderRegistryManifestInvalidReasonV1;
    readonly publicFailureReason: "attestation_invalid";
  };
}

function defineInvalidCase(
  caseId: string,
  targetJsonPointer: string,
  operands: readonly string[],
  stage: ProviderRegistryManifestInvalidStageV1,
  reason: ProviderRegistryManifestInvalidReasonV1,
): ProviderRegistryManifestInvalidCaseDefinitionV1 {
  return Object.freeze({
    caseId,
    mutation: Object.freeze({
      dialect: PROVIDER_REGISTRY_MANIFEST_INVALID_RECIPE_DIALECT_V1,
      goldenResourcePath:
        PROVIDER_REGISTRY_MANIFEST_GOLDEN_RESOURCE_PATH_LITERAL_V1,
      steps: Object.freeze([
        Object.freeze({
          operation: caseId,
          targetJsonPointer,
          operands: Object.freeze([...operands]),
        }),
      ]) as unknown as ProviderRegistryManifestInvalidCaseDefinitionV1["mutation"]["steps"],
    }),
    expected: Object.freeze({
      boundary: "internal_diagnostic" as const,
      stage,
      reason,
      publicFailureReason: "attestation_invalid" as const,
    }),
  });
}

const c = defineInvalidCase;

export const PROVIDER_REGISTRY_MANIFEST_INVALID_CASE_DEFINITIONS_V1 =
  Object.freeze([
    c("history-empty", "/registryManifestHistory", [], "history_input", "history_empty"),
    c("input-extra-field", "", ["callerPath"], "history_input", "schema_invalid"),
    c("input-missing-installation-id", "/installationIdentityGenerationId", [], "history_input", "schema_invalid"),
    c("input-bad-installation-id", "/installationIdentityGenerationId", ["installation-identity-generation:BAD"], "history_input", "schema_invalid"),
    c("history-not-array", "/registryManifestHistory", ["object"], "history_input", "schema_invalid"),
    c("history-sparse-array", "/registryManifestHistory/0", ["delete"], "history_input", "schema_invalid"),
    c("envelope-null", "/registryManifestHistory/0", ["null"], "manifest_envelope", "schema_invalid"),
    c("envelope-extra-field", "/registryManifestHistory/0/callerPath", ["latest.json"], "manifest_envelope", "schema_invalid"),
    c("envelope-record-type-malformed", "/registryManifestHistory/0/recordType", ["provider_registry_entry"], "manifest_envelope", "schema_invalid"),
    c("envelope-generation-id-malformed", "/registryManifestHistory/0/generationId", ["provider-registry-manifest:BAD"], "manifest_envelope", "schema_invalid"),
    c("manifest-extra-field", "/registryManifestHistory/0/payload/callerPath", ["latest.json"], "manifest_envelope", "schema_invalid"),
    c("manifest-profile-malformed", "/registryManifestHistory/0/payload/profile", ["provider_registry_manifest_v2"], "manifest_envelope", "schema_invalid"),
    c("genesis-predecessor-branch-malformed", "/registryManifestHistory/0/payload/predecessor", ["manifest"], "manifest_envelope", "schema_invalid"),
    c("successor-predecessor-branch-malformed", "/registryManifestHistory/1/payload/predecessor", ["genesis"], "manifest_envelope", "schema_invalid"),
    c("entry-extra-field", "/registryManifestHistory/0/payload/members/0/registryEntry/callerPath", ["entry.json"], "manifest_envelope", "schema_invalid"),
    c("entry-genesis-predecessor-branch-malformed", "/registryManifestHistory/0/payload/members/0/registryEntry/predecessorRegistryEntryContentDigest", ["sha256:00"], "manifest_envelope", "schema_invalid"),
    c("entry-successor-predecessor-branch-malformed", "/registryManifestHistory/1/payload/members/0/registryEntry/predecessorRegistryEntryContentDigest", ["delete"], "manifest_envelope", "schema_invalid"),
    c("verification-key-extra-field", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords/0/path", ["key.json"], "manifest_envelope", "schema_invalid"),
    c("manifest-signature-malformed", "/registryManifestHistory/0/payload/manifestSignature", ["malformed"], "manifest_envelope", "schema_invalid"),
    c("envelope-generation-id-mismatch", "/registryManifestHistory/0/generationId", ["generation-2"], "manifest_envelope", "envelope_mismatch"),
    c("payload-generation-id-mismatch", "/registryManifestHistory/0/payload/generationId", ["generation-2"], "manifest_envelope", "envelope_mismatch"),
    c("envelope-content-digest-mismatch", "/registryManifestHistory/0/contentDigest", ["sha256:ee"], "manifest_envelope", "envelope_mismatch"),
    c("manifest-installation-id-mismatch", "/registryManifestHistory/0/payload/installationIdentityGenerationId", ["installation-identity-generation:00"], "manifest_envelope", "envelope_mismatch"),
    c("manifest-generation-starts-at-two", "/registryManifestHistory/0/payload/manifestGeneration", ["2"], "manifest_predecessor", "generation_not_contiguous"),
    c("manifest-generation-gap", "/registryManifestHistory/1/payload/manifestGeneration", ["3"], "manifest_predecessor", "generation_not_contiguous"),
    c("predecessor-generation-id-mismatch", "/registryManifestHistory/1/payload/predecessor/generationId", ["generation-2"], "manifest_predecessor", "predecessor_pin_mismatch"),
    c("predecessor-content-digest-mismatch", "/registryManifestHistory/1/payload/predecessor/contentDigest", ["sha256:ff"], "manifest_predecessor", "predecessor_pin_mismatch"),
    c("manifest-sibling-generation", "/registryManifestHistory/2", ["copy-generation-2"], "manifest_predecessor", "generation_not_contiguous"),
    c("root-generation-rollback", "/registryManifestHistory/2/payload/activeRootMetadata", ["root-1"], "root_binding", "root_generation_rollback"),
    c("unknown-root-pin", "/registryManifestHistory/0/payload/activeRootMetadata/contentDigest", ["sha256:ff"], "root_binding", "root_pin_mismatch"),
    c("member-order-reversed", "/registryManifestHistory/2/payload/members", ["reverse"], "manifest_envelope", "schema_invalid"),
    c("member-duplicate", "/registryManifestHistory/2/payload/members", ["duplicate-0"], "manifest_envelope", "schema_invalid"),
    c("tombstone-disappears", "/registryManifestHistory/6/payload/members/0", ["delete"], "member_set", "member_transition_invalid"),
    c("enabled-entry-digest-mismatch", "/registryManifestHistory/0/payload/members/0/registryEntryContentDigest", ["sha256:ff"], "registry_entry", "entry_mismatch"),
    c("member-entry-provider-mismatch", "/registryManifestHistory/0/payload/members/0/providerId", ["native-b"], "registry_entry", "entry_mismatch"),
    c("entry-generation-jump", "/registryManifestHistory/1/payload/members/0/registryEntry/registryGeneration", ["3"], "registry_entry", "entry_successor_invalid"),
    c("entry-predecessor-digest-mismatch", "/registryManifestHistory/1/payload/members/0/registryEntry/predecessorRegistryEntryContentDigest", ["sha256:ff"], "registry_entry", "entry_successor_invalid"),
    c("same-entry-digest-different-bytes", "/registryManifestHistory/1/payload/members/0", ["reuse-digest-change-signature"], "registry_entry", "entry_successor_invalid"),
    c("runtime-pin-digest-mismatch", "/registryManifestHistory/0/payload/members/0/registryEntry/runtimeAttestation/contentDigest", ["sha256:ff"], "registry_entry", "entry_mismatch"),
    c("runtime-provider-mismatch", "/registryManifestHistory/0/payload/members/0/registryEntry/runtimeAttestation/payload/providerId", ["native-b"], "registry_entry", "entry_mismatch"),
    c("provider-key-id-mismatch", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords/0/keyId", ["00"], "key_history", "record_history_invalid"),
    c("provider-key-raw-digest-mismatch", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords/0/publicKeyDigest", ["sha256:ff"], "key_history", "record_history_invalid"),
    c("provider-key-order-reversed", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords", ["reverse"], "manifest_envelope", "schema_invalid"),
    c("active-key-missing", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/activeKeyIds/operationReceipt", ["00"], "key_history", "active_record_invalid"),
    c("active-key-wrong-usage", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/activeKeyIds/operationReceipt", ["containment-key"], "key_history", "active_record_invalid"),
    c("active-key-revoked", "/registryManifestHistory/1/payload/members/0/registryEntry/verificationKeys/compromisedRevokedKeyIds", ["active-operation"], "key_history", "active_record_invalid"),
    c("revoked-key-unknown", "/registryManifestHistory/1/payload/members/0/registryEntry/verificationKeys/compromisedRevokedKeyIds", ["00"], "key_history", "revocation_invalid"),
    c("rotated-key-backdated", "/registryManifestHistory/1/payload/members/0/registryEntry/verificationKeys/publicKeyRecords", ["generation-1"], "key_history", "record_history_invalid"),
    c("key-history-removal", "/registryManifestHistory/1/payload/members/0/registryEntry/verificationKeys/publicKeyRecords", ["remove-migration-key"], "key_history", "record_history_invalid"),
    c("retained-key-bytes-changed", "/registryManifestHistory/1/payload/members/0/registryEntry/verificationKeys/publicKeyRecords/0", ["change-signature"], "key_history", "record_history_invalid"),
    c("public-key-material-alias-root", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords", ["usage=migration_semantic_proof", "root-1"], "material_closure", "public_key_material_alias"),
    c("provider-key-cap-exceeded", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords", ["257"], "key_history", "record_history_invalid"),
    c("per-usage-key-cap-exceeded", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords", ["operation_receipt", "65"], "key_history", "record_history_invalid"),
    c("manifest-signature-bitflip", "/registryManifestHistory/0/payload/manifestSignature", ["last-bit"], "manifest_signature", "signature_invalid"),
    c("manifest-signature-wrong-signer", "/registryManifestHistory/2/payload/manifestSignature", ["root-2"], "manifest_signature", "signature_invalid"),
    c("manifest-signature-wrong-domain", "/registryManifestHistory/0/payload/manifestSignature", ["provider-registry-manifest-wrong-signature-v1"], "manifest_signature", "signature_invalid"),
    c("manifest-signature-wrong-prefix", "/registryManifestHistory/0/payload/manifestSignature", ["provider-registry-ed25519"], "manifest_envelope", "schema_invalid"),
    c("runtime-signature-bitflip", "/registryManifestHistory/0/payload/members/0/registryEntry/runtimeAttestation/payload/registrySignature", ["last-bit"], "record_signature", "signature_invalid"),
    c("runtime-signature-wrong-signer", "/registryManifestHistory/1/payload/members/0/registryEntry/runtimeAttestation/payload/registrySignature", ["root-1"], "record_signature", "signature_invalid"),
    c("runtime-signature-wrong-domain", "/registryManifestHistory/0/payload/members/0/registryEntry/runtimeAttestation/payload/registrySignature", ["store-provider-runtime-attestation-wrong-signature-v1"], "record_signature", "signature_invalid"),
    c("key-signature-bitflip", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords/0/registrySignature", ["last-bit"], "record_signature", "signature_invalid"),
    c("key-signature-wrong-domain", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords/0/registrySignature", ["store-provider-key-wrong-signature-v1"], "record_signature", "signature_invalid"),
    c("entry-signature-bitflip", "/registryManifestHistory/0/payload/members/0/registryEntry/registrySignature", ["last-bit"], "record_signature", "signature_invalid"),
    c("entry-signature-wrong-domain", "/registryManifestHistory/0/payload/members/0/registryEntry/registrySignature", ["store-provider-entry-wrong-signature-v1"], "record_signature", "signature_invalid"),
    c("public-key-small-order", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords", ["usage=migration_semantic_proof", "identity-point"], "key_admission", "point_admission_failed"),
    c("steady-two-enabled-bypass", "/registryManifestHistory/2/payload/routing", ["steady"], "routing", "routing_invalid"),
    c("migration-missing-member", "/registryManifestHistory/2/payload/members/1", ["delete"], "routing", "routing_invalid"),
    c("migration-source-equals-destination", "/registryManifestHistory/2/payload/routing/sourceProviderId", ["destination"], "routing", "routing_invalid"),
    c("migration-active-outsider", "/registryManifestHistory/2/payload/routing/activeForMigrationWrites", ["native-c"], "routing", "routing_invalid"),
    c("migration-phase-skip", "/registryManifestHistory/3/payload/routing/phase", ["source_drained"], "routing", "routing_invalid"),
    c("migration-id-switch", "/registryManifestHistory/3/payload/routing/migrationId", ["provider-migration:00"], "routing", "routing_invalid"),
    c("tombstone-generation-wrong", "/registryManifestHistory/5/payload/members/0/revokedAtManifestGeneration", ["5"], "member_set", "member_transition_invalid"),
    c("tombstone-digest-wrong", "/registryManifestHistory/5/payload/members/0/lastEnabledRegistryEntryContentDigest", ["sha256:ff"], "member_set", "member_transition_invalid"),
    c("tombstone-mutated-after-retention", "/registryManifestHistory/6/payload/members/0/reason", ["provider_compromised"], "member_set", "member_transition_invalid"),
    c("provider-resurrection", "/registryManifestHistory/6/payload/members/0", ["enabled-a3"], "member_set", "member_transition_invalid"),
    c("early-steady-before-drained", "/registryManifestHistory/4", ["tombstone-and-steady"], "routing", "routing_invalid"),
    c("locator-alias-extra-field", "/registryManifestHistory/0/locator", ["latest"], "manifest_envelope", "schema_invalid"),
    c("locator-path-extra-field", "/registryManifestHistory/0/path", ["provider/registry-manifests/latest.json"], "manifest_envelope", "schema_invalid"),
    c("locator-filename-key-extra-field", "/registryManifestHistory/0/filenameKey", ["idh-00"], "manifest_envelope", "schema_invalid"),
    c("history-count-cap-4097", "/registryManifestHistory", ["4097"], "history_limit", "history_generation_limit_exceeded"),
    c("single-envelope-byte-cap", "/registryManifestHistory/0/payload/issuedAt", ["4194305", "61"], "history_limit", "envelope_byte_limit_exceeded"),
    c("total-history-byte-cap", "/registryManifestHistory", ["68", "4000000"], "history_limit", "history_total_byte_limit_exceeded"),
    c("approval-snapshot-diverges", "/registryManifestHistory/2/payload/members/1/registryEntry/feasibilityApprovalKeys/activeKeyIds", ["swap"], "key_history", "record_history_invalid"),
    c("binding-active-missing", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/activeBindingDerivationKeyGeneration", ["2"], "key_history", "active_record_invalid"),
    c("binding-revocation-unknown", "/registryManifestHistory/1/payload/members/0/registryEntry/verificationKeys/compromisedRevokedBindingDerivationGenerations", ["2"], "key_history", "revocation_invalid"),
    c("approver-active-role-mismatch", "/registryManifestHistory/0/payload/members/0/registryEntry/feasibilityApprovalKeys/activeKeyIds", ["swap"], "key_history", "active_record_invalid"),
    c("approver-revocation-unknown", "/registryManifestHistory/0/payload/members/0/registryEntry/feasibilityApprovalKeys/compromisedRevokedKeyIds", ["00"], "key_history", "revocation_invalid"),
    c("binding-record-duplicate", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/bindingDerivationGenerationRecords", ["duplicate-0"], "manifest_envelope", "schema_invalid"),
    c("approver-record-order-reversed", "/registryManifestHistory/0/payload/members/0/registryEntry/feasibilityApprovalKeys/publicKeyRecords", ["reverse"], "manifest_envelope", "schema_invalid"),
  ]);
