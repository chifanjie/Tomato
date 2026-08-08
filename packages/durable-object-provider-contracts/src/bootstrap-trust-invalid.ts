import { z } from "./zod-runtime.js";

import {
  PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1,
  PROVIDER_BOOTSTRAP_TRUST_BUNDLE_RESOURCE_PATH_V1,
} from "./bootstrap-trust-bundle.js";
import {
  PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_PATH_V1,
  PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_SHA256_HEX_V1,
  PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_SEMANTIC_CONTENT_DIGEST_V1,
} from "./bootstrap-trust-golden.js";
import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
} from "./domain-crypto.js";
import {
  assertFixedResourceByteAnchorInternalV1,
  bytesToLowerHexInternalV1,
  parseFixedUtf8JsonResourceInternalV1,
  snapshotBoundedFixedResourceBytesInternalV1,
} from "./fixed-resource.js";
import {
  RFC8785_JCS_SAFE_INTEGER_PROFILE_V1,
  canonicalizeJcsSafeIntegerUtf8V1,
} from "./jcs.js";
import { ContentDigestV1Schema } from "./primitives.js";
import { sha256InternalV1 } from "./sha256.js";
import {
  PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_CONTENT_DIGEST_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
} from "./strict-ed25519-conformance.js";
import { STRICT_ED25519_VERIFICATION_PROFILE_V1 } from "./strict-ed25519.js";

export const PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_PATH_V1 =
  "fixtures/v1/invalid/provider-bootstrap-structure-crypto-v1.json" as const;
export const PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_MAX_BYTES_V1 =
  1_048_576;
export const PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_PROFILE_V1 =
  "provider_bootstrap_structure_crypto_invalid_manifest_v1" as const;

/*
 * These three literals are regenerated only when the exact checked-in
 * rejection manifest changes. They intentionally bind raw bytes separately
 * from the semantic JCS identity below.
 */
export const PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_BYTE_LENGTH_V1 =
  59_904;
export const PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_SHA256_HEX_V1 =
  "43345fc32cdf1f85b0184fa45609b5df1f143efbcf729c3c78cea71973fcd36d" as const;
export const PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_SEMANTIC_CONTENT_DIGEST_V1 =
  ContentDigestV1Schema.parse(
    "sha256:64333c7b096d82d88d4232264ef11ad8946d5d646dee5f38e17ea72e95cd4a0e",
  );

const INVALID_STAGE_VALUES_V1 = [
  "fixed_resource_inventory",
  "compiled_golden_anchor",
  "golden_schema",
  "golden_semantic",
  "domain_separation",
  "bundle_envelope",
  "compiled_bundle_anchor",
  "bundle_payload_schema",
  "strict_manifest",
  "root_metadata_envelope",
  "root_key_record",
  "recovery_key_record",
  "bundle_root_closure",
  "recovery_key_closure",
  "root_self_signature",
  "opaque_capability_lookup",
  "deterministic_fixture",
] as const;

const INVALID_REASON_VALUES_V1 = [
  "resource_missing",
  "resource_duplicate",
  "resource_unexpected",
  "resource_type_invalid",
  "fixed_resource_identity_mismatch",
  "compiled_digest_mismatch",
  "expected_bytes_mismatch",
  "case_order_mismatch",
  "key_material_alias",
  "authority_mismatch",
  "domain_separation_mismatch",
  "canonical_encoding_mismatch",
  "schema_invalid",
  "content_digest_mismatch",
  "manifest_version_mismatch",
  "manifest_case_coverage_mismatch",
  "envelope_generation_mismatch",
  "envelope_key_id_mismatch",
  "self_signature_key_id_mismatch",
  "key_id_mismatch",
  "raw_public_key_digest_mismatch",
  "bundle_root_metadata_mismatch",
  "signature_message_mismatch",
  "signature_invalid",
  "recovery_count_invalid",
  "recovery_duplicate",
  "recovery_order_invalid",
  "point_validation_failed",
  "opaque_capability_invalid",
  "deterministic_key_mismatch",
  "deterministic_signature_mismatch",
] as const;

const INVALID_BOUNDARY_VALUES_V1 = [
  "fixed_resource_loader",
  "fixture_verifier",
  "internal_diagnostic",
  "public_provider_error",
  "reference_oracle",
] as const;
const INVALID_ALTERNATE_ROOT_KEY_ID_V1 =
  "661166fa4208cb1d325f30" as const;

export const ProviderBootstrapTrustInvalidStageV1Schema = z.enum(
  INVALID_STAGE_VALUES_V1,
);
export const ProviderBootstrapTrustInvalidReasonV1Schema = z.enum(
  INVALID_REASON_VALUES_V1,
);
export const ProviderBootstrapTrustInvalidBoundaryV1Schema = z.enum(
  INVALID_BOUNDARY_VALUES_V1,
);

export type ProviderBootstrapTrustInvalidStageV1 = z.infer<
  typeof ProviderBootstrapTrustInvalidStageV1Schema
>;
export type ProviderBootstrapTrustInvalidReasonV1 = z.infer<
  typeof ProviderBootstrapTrustInvalidReasonV1Schema
>;
export type ProviderBootstrapTrustInvalidBoundaryV1 = z.infer<
  typeof ProviderBootstrapTrustInvalidBoundaryV1Schema
>;

interface InvalidWitnessDefinitionV1 {
  readonly profile: string;
  readonly recipe: InvalidWitnessRecipeV1;
  readonly stage: ProviderBootstrapTrustInvalidStageV1;
  readonly reason: ProviderBootstrapTrustInvalidReasonV1;
  readonly boundary: ProviderBootstrapTrustInvalidBoundaryV1;
  readonly postAttestationPointCalls: number;
  readonly postAttestationVerifyCalls: number;
}

type InvalidWitnessRecipeSeedV1 =
  | {
      readonly source: "none";
    }
  | {
      readonly source: "literal_non_production";
      readonly seedHex: string;
    }
  | {
      readonly source: "bootstrap_golden_json_pointer";
      readonly resourcePath: typeof PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_PATH_V1;
      readonly jsonPointer: "/vectors/deterministicRootSelfSignatureSigning/rfc8032TestSeedHex";
    };

interface InvalidWitnessRecipeV1 {
  readonly dialect: "provider_bootstrap_invalid_recipe_v1";
  readonly operation: string;
  readonly operands: readonly string[];
  readonly deterministicSeed: InvalidWitnessRecipeSeedV1;
}

interface InvalidCaseDefinitionV1 {
  readonly caseId: string;
  readonly category:
    | "resource_inventory"
    | "golden_anchor"
    | "domain_separation"
    | "bundle_envelope"
    | "strict_manifest"
    | "registry_record"
    | "root_signature"
    | "recovery_closure"
    | "opaque_capability"
    | "deterministic_fixture";
  readonly target: string;
  readonly witnesses: readonly InvalidWitnessDefinitionV1[];
}

function witness(
  profile: string,
  stage: ProviderBootstrapTrustInvalidStageV1,
  reason: ProviderBootstrapTrustInvalidReasonV1,
  options: {
    readonly boundary?: ProviderBootstrapTrustInvalidBoundaryV1;
    readonly pointCalls?: number;
    readonly verifyCalls?: number;
  } = {},
): InvalidWitnessDefinitionV1 {
  const [operation, ...operands] = profile.split(":");
  if (operation === undefined || operation.length === 0) {
    throw new TypeError("invalid bootstrap rejection recipe");
  }
  let deterministicSeed: InvalidWitnessRecipeSeedV1 = {
    source: "none",
  };
  if (
    operation === "sign_valid_under" ||
    operation === "verify_signature_over" ||
    operation === "reproduce_with_published_seed_and_compare"
  ) {
    deterministicSeed = {
      source: "bootstrap_golden_json_pointer",
      resourcePath:
        PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_PATH_V1,
      jsonPointer:
        "/vectors/deterministicRootSelfSignatureSigning/rfc8032TestSeedHex",
    };
  } else if (profile.includes("repeat_33")) {
    deterministicSeed = {
      source: "literal_non_production",
      seedHex: "33".repeat(32),
    };
  } else if (profile.includes("repeat_44")) {
    deterministicSeed = {
      source: "literal_non_production",
      seedHex: "44".repeat(32),
    };
  } else if (
    profile.includes("seed_22") ||
    profile.includes("independent_root") ||
    profile.includes("coherent_alternate")
  ) {
    deterministicSeed = {
      source: "literal_non_production",
      seedHex: "16".repeat(32),
    };
  }
  return {
    profile,
    recipe: {
      dialect: "provider_bootstrap_invalid_recipe_v1",
      operation,
      operands,
      deterministicSeed,
    },
    stage,
    reason,
    boundary: options.boundary ?? "internal_diagnostic",
    postAttestationPointCalls: options.pointCalls ?? 0,
    postAttestationVerifyCalls: options.verifyCalls ?? 0,
  };
}

function invalidCase(
  caseId: string,
  category: InvalidCaseDefinitionV1["category"],
  target: string,
  ...witnesses: readonly InvalidWitnessDefinitionV1[]
): InvalidCaseDefinitionV1 {
  return { caseId, category, target, witnesses };
}

const INVALID_CASE_DEFINITIONS_V1 = [
  invalidCase(
    "bundle-resource-missing",
    "resource_inventory",
    PROVIDER_BOOTSTRAP_TRUST_BUNDLE_RESOURCE_PATH_V1,
    witness(
      "remove:provider/bootstrap-trust-bundle-v1.json",
      "fixed_resource_inventory",
      "resource_missing",
      { boundary: "fixed_resource_loader" },
    ),
  ),
  invalidCase(
    "bundle-resource-duplicate-identical",
    "resource_inventory",
    PROVIDER_BOOTSTRAP_TRUST_BUNDLE_RESOURCE_PATH_V1,
    witness(
      "duplicate:provider/bootstrap-trust-bundle-v1.json:byte_identical",
      "fixed_resource_inventory",
      "resource_duplicate",
      { boundary: "fixed_resource_loader" },
    ),
  ),
  invalidCase(
    "bundle-resource-duplicate-semantic-alias",
    "resource_inventory",
    PROVIDER_BOOTSTRAP_TRUST_BUNDLE_RESOURCE_PATH_V1,
    witness(
      "duplicate:provider/bootstrap-trust-bundle-v1.json:semantic_equal_raw_distinct",
      "fixed_resource_inventory",
      "resource_duplicate",
      { boundary: "fixed_resource_loader" },
    ),
    witness(
      "add:provider/bootstrap-trust-bundle-alternate-v1.json:coherent_alternate",
      "fixed_resource_inventory",
      "resource_unexpected",
      { boundary: "fixed_resource_loader" },
    ),
  ),
  invalidCase(
    "bundle-resource-non-regular",
    "resource_inventory",
    PROVIDER_BOOTSTRAP_TRUST_BUNDLE_RESOURCE_PATH_V1,
    witness(
      "replace_type:provider/bootstrap-trust-bundle-v1.json:symlink",
      "fixed_resource_inventory",
      "resource_type_invalid",
      { boundary: "fixed_resource_loader" },
    ),
    witness(
      "replace_type:provider/bootstrap-trust-bundle-v1.json:hardlink",
      "fixed_resource_inventory",
      "resource_type_invalid",
      { boundary: "fixed_resource_loader" },
    ),
  ),
  invalidCase(
    "strict-manifest-resource-missing",
    "resource_inventory",
    PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
    witness(
      "remove:provider/ed25519-strict-host-conformance-v1.json",
      "fixed_resource_inventory",
      "resource_missing",
      { boundary: "fixed_resource_loader" },
    ),
  ),
  invalidCase(
    "strict-manifest-resource-duplicate",
    "resource_inventory",
    PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
    witness(
      "duplicate:provider/ed25519-strict-host-conformance-v1.json:byte_identical",
      "fixed_resource_inventory",
      "resource_duplicate",
      { boundary: "fixed_resource_loader" },
    ),
    witness(
      "duplicate:provider/ed25519-strict-host-conformance-v1.json:semantic_equal_raw_distinct",
      "fixed_resource_inventory",
      "resource_duplicate",
      { boundary: "fixed_resource_loader" },
    ),
  ),
  invalidCase(
    "strict-manifest-resource-non-regular",
    "resource_inventory",
    PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
    witness(
      "replace_type:provider/ed25519-strict-host-conformance-v1.json:symlink",
      "fixed_resource_inventory",
      "resource_type_invalid",
      { boundary: "fixed_resource_loader" },
    ),
    witness(
      "replace_type:provider/ed25519-strict-host-conformance-v1.json:hardlink",
      "fixed_resource_inventory",
      "resource_type_invalid",
      { boundary: "fixed_resource_loader" },
    ),
  ),
  invalidCase(
    "golden-raw-semantic-alias",
    "golden_anchor",
    PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_PATH_V1,
    witness(
      "serialize:minified_json_semantic_equal",
      "compiled_golden_anchor",
      "fixed_resource_identity_mismatch",
      { boundary: "fixture_verifier" },
    ),
  ),
  invalidCase(
    "golden-semantic-coherent-alternate",
    "golden_anchor",
    "fixedBundleResource.resourceBytesSha256Hex",
    witness(
      "replace:fixedBundleResource.resourceBytesSha256Hex:sha256_ff",
      "compiled_golden_anchor",
      "compiled_digest_mismatch",
      { boundary: "fixture_verifier" },
    ),
  ),
  invalidCase(
    "golden-expected-bytes-substitution",
    "golden_anchor",
    "vectors.signedPackageIdentityDigest.expected",
    witness(
      "replace:vectors.signedPackageIdentityDigest.expected.sha256Hex:zero64",
      "golden_semantic",
      "expected_bytes_mismatch",
      { boundary: "fixture_verifier" },
    ),
  ),
  invalidCase(
    "golden-recovery-vector-reorder",
    "golden_anchor",
    "vectors.recoveryKeyIds",
    witness(
      "reverse:vectors.recoveryKeyIds",
      "golden_schema",
      "schema_invalid",
      { boundary: "fixture_verifier" },
    ),
  ),
  invalidCase(
    "golden-deterministic-fixed-key-alias",
    "golden_anchor",
    "vectors.deterministicRootSelfSignatureSigning.expected.publicKeyBytes",
    witness(
      "alias:deterministic_root_key:fixed_bundle_root_key",
      "golden_semantic",
      "key_material_alias",
      { boundary: "fixture_verifier" },
    ),
  ),
  invalidCase(
    "golden-authority-substitution",
    "golden_anchor",
    "fixtureAuthority",
    witness(
      "replace:fixtureAuthority:strong_ready",
      "golden_schema",
      "schema_invalid",
      { boundary: "fixture_verifier" },
    ),
  ),
  invalidCase(
    "signed-package-wrong-domain-digest",
    "domain_separation",
    "vectors.signedPackageIdentityDigest",
    witness(
      "derive_valid_under:provider-bootstrap-trust-bundle-v1",
      "domain_separation",
      "domain_separation_mismatch",
      { boundary: "reference_oracle" },
    ),
  ),
  invalidCase(
    "bundle-wrong-domain-digest",
    "domain_separation",
    "vectors.bootstrapTrustBundleDigest",
    witness(
      "derive_valid_under:provider-signed-package-identity-v1",
      "domain_separation",
      "domain_separation_mismatch",
      { boundary: "reference_oracle" },
    ),
  ),
  invalidCase(
    "root-metadata-wrong-domain-digest",
    "domain_separation",
    "vectors.bootstrapRootMetadataDigest",
    witness(
      "derive_valid_under:provider-bootstrap-trust-bundle-v1",
      "domain_separation",
      "domain_separation_mismatch",
      { boundary: "reference_oracle" },
    ),
  ),
  invalidCase(
    "root-self-signature-wrong-domain-valid",
    "domain_separation",
    "vectors.bootstrapRootSelfSignatureVerification",
    witness(
      "sign_valid_under:provider-registry-root-cross-signature-v1",
      "root_self_signature",
      "signature_invalid",
      { pointCalls: 1, verifyCalls: 1 },
    ),
  ),
  invalidCase(
    "root-key-id-recovery-domain-confusion",
    "domain_separation",
    "bootstrapProviderRegistryRoot.rootKeyId",
    witness(
      "derive_valid_under:provider-registry-recovery-key-id-v1",
      "root_key_record",
      "key_id_mismatch",
    ),
  ),
  invalidCase(
    "recovery-key-id-root-domain-confusion",
    "domain_separation",
    "providerRegistryRecoveryKeys[0].recoveryKeyId",
    witness(
      "derive_valid_under:provider-registry-root-key-id-v1",
      "recovery_key_record",
      "key_id_mismatch",
    ),
  ),
  invalidCase(
    "bundle-noncanonical-resource",
    "bundle_envelope",
    PROVIDER_BOOTSTRAP_TRUST_BUNDLE_RESOURCE_PATH_V1,
    witness(
      "append:trailing_newline",
      "bundle_envelope",
      "canonical_encoding_mismatch",
      { boundary: "public_provider_error" },
    ),
  ),
  invalidCase(
    "bundle-schema-version-substitution",
    "bundle_envelope",
    "schemaVersion",
    witness(
      "replace:schemaVersion:2",
      "bundle_envelope",
      "schema_invalid",
    ),
  ),
  invalidCase(
    "bundle-record-type-substitution",
    "bundle_envelope",
    "recordType",
    witness(
      "replace:recordType:provider_bootstrap_trust_bundle_alias",
      "bundle_envelope",
      "schema_invalid",
    ),
  ),
  invalidCase(
    "bundle-outer-digest-stale",
    "bundle_envelope",
    "contentDigest",
    witness(
      "replace:contentDigest:sha256_zero64",
      "bundle_envelope",
      "content_digest_mismatch",
    ),
  ),
  invalidCase(
    "bundle-coherent-alternate-compiled-pin",
    "bundle_envelope",
    "payload.bootstrapProviderRegistryRoot",
    witness(
      "replace_and_reseal:root_metadata_and_root:seed_22",
      "compiled_bundle_anchor",
      "compiled_digest_mismatch",
      { boundary: "public_provider_error" },
    ),
  ),
  invalidCase(
    "bundle-payload-profile-substitution",
    "bundle_envelope",
    "payload.profile",
    witness(
      "replace:payload.profile:provider_bootstrap_trust_bundle_alias_v1",
      "bundle_payload_schema",
      "schema_invalid",
    ),
  ),
  invalidCase(
    "bundle-capability-profile-substitution",
    "bundle_envelope",
    "payload.strictCryptoCapability.profile",
    witness(
      "replace:strictCryptoCapability.profile:alias_v1",
      "bundle_payload_schema",
      "schema_invalid",
    ),
  ),
  invalidCase(
    "bundle-strict-manifest-pin-substitution",
    "bundle_envelope",
    "payload.strictCryptoCapability.adversarialManifest.contentDigest",
    witness(
      "replace_and_reseal:strict_manifest_pin:sha256_aa64",
      "compiled_bundle_anchor",
      "compiled_digest_mismatch",
    ),
  ),
  invalidCase(
    "bundle-history-policy-substitution",
    "bundle_envelope",
    "payload.providerTrustHistoryPolicy",
    witness(
      "replace_no_reseal:maxRootMetadataGenerationCountPerInstallationIdentity:255",
      "bundle_envelope",
      "schema_invalid",
    ),
  ),
  invalidCase(
    "bundle-root-metadata-closure-substitution",
    "bundle_envelope",
    "payload.bootstrapProviderRegistryRootMetadata",
    witness(
      "replace:root_metadata:valid_independent_seed_22",
      "bundle_root_closure",
      "bundle_root_metadata_mismatch",
    ),
  ),
  invalidCase(
    "strict-manifest-noncanonical-resource",
    "strict_manifest",
    PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
    witness(
      "append:trailing_newline",
      "strict_manifest",
      "canonical_encoding_mismatch",
      { boundary: "public_provider_error" },
    ),
  ),
  invalidCase(
    "strict-manifest-version-substitution",
    "strict_manifest",
    "manifestVersion",
    witness(
      "replace:manifestVersion:2",
      "strict_manifest",
      "manifest_version_mismatch",
    ),
  ),
  invalidCase(
    "strict-manifest-case-coverage-matrix",
    "strict_manifest",
    "payload.cases",
    witness(
      "remove:payload.cases[0]",
      "strict_manifest",
      "manifest_case_coverage_mismatch",
    ),
    witness(
      "append:payload.cases:duplicate_last",
      "strict_manifest",
      "manifest_case_coverage_mismatch",
    ),
    witness(
      "reverse:payload.cases",
      "strict_manifest",
      "manifest_case_coverage_mismatch",
    ),
  ),
  invalidCase(
    "strict-manifest-compiled-digest-substitution",
    "strict_manifest",
    "contentDigest",
    witness(
      "mutate_payload_and_reseal:payload.cases[0].messageBytes",
      "strict_manifest",
      "compiled_digest_mismatch",
    ),
  ),
  invalidCase(
    "metadata-outer-generation-substitution",
    "registry_record",
    "bootstrapProviderRegistryRootMetadata.rootGeneration",
    witness(
      "replace:rootGeneration:2",
      "root_metadata_envelope",
      "envelope_generation_mismatch",
    ),
  ),
  invalidCase(
    "metadata-outer-key-id-substitution",
    "registry_record",
    "bootstrapProviderRegistryRootMetadata.rootKeyId",
    witness(
      "replace:rootKeyId:independent_root_id",
      "root_metadata_envelope",
      "envelope_key_id_mismatch",
    ),
  ),
  invalidCase(
    "metadata-outer-digest-substitution",
    "registry_record",
    "bootstrapProviderRegistryRootMetadata.contentDigest",
    witness(
      "replace:contentDigest:sha256_cc64",
      "root_metadata_envelope",
      "content_digest_mismatch",
    ),
  ),
  invalidCase(
    "metadata-self-signature-key-id-substitution",
    "registry_record",
    "bootstrapProviderRegistryRootMetadata.payload.selfSignature",
    witness(
      "replace_prefix_and_reseal_metadata_content_digest:selfSignature:independent_root_id",
      "root_metadata_envelope",
      "self_signature_key_id_mismatch",
    ),
  ),
  invalidCase(
    "root-key-id-mismatch",
    "registry_record",
    "bootstrapProviderRegistryRoot.rootKeyId",
    witness(
      "replace:rootKeyId:independent_root_id",
      "root_key_record",
      "key_id_mismatch",
    ),
  ),
  invalidCase(
    "root-public-key-digest-mismatch",
    "registry_record",
    "bootstrapProviderRegistryRoot.publicKeyDigest",
    witness(
      "replace:publicKeyDigest:sha256_dd64",
      "root_key_record",
      "raw_public_key_digest_mismatch",
    ),
  ),
  invalidCase(
    "recovery-key-id-mismatch",
    "registry_record",
    "providerRegistryRecoveryKeys[0].recoveryKeyId",
    witness(
      "replace:recoveryKeyId:independent_root_id",
      "recovery_key_record",
      "key_id_mismatch",
    ),
  ),
  invalidCase(
    "recovery-public-key-digest-mismatch",
    "registry_record",
    "providerRegistryRecoveryKeys[0].publicKeyDigest",
    witness(
      "replace:publicKeyDigest:sha256_ee64",
      "recovery_key_record",
      "raw_public_key_digest_mismatch",
    ),
  ),
  invalidCase(
    "root-self-signature-message-matrix",
    "root_signature",
    "bootstrapProviderRegistryRootMetadata.payload.selfSignature",
    witness(
      "verify_signature_over:wrapper_only",
      "root_self_signature",
      "signature_message_mismatch",
      { pointCalls: 1, verifyCalls: 1 },
    ),
    witness(
      "verify_signature_over:claims_only",
      "root_self_signature",
      "signature_message_mismatch",
      { pointCalls: 1, verifyCalls: 1 },
    ),
    witness(
      "verify_signature_over:domain_and_claims",
      "root_self_signature",
      "signature_message_mismatch",
      { pointCalls: 1, verifyCalls: 1 },
    ),
    witness(
      "verify_signature_over:domain_and_strict_fields",
      "root_self_signature",
      "signature_message_mismatch",
      { pointCalls: 1, verifyCalls: 1 },
    ),
    witness(
      "verify_signature_over:inner_outer_domain_mismatch",
      "root_self_signature",
      "signature_message_mismatch",
      { pointCalls: 1, verifyCalls: 1 },
    ),
    witness(
      `verify_signature_over:prefix_wrapper_key_mismatch:alternate_root_key_id=${INVALID_ALTERNATE_ROOT_KEY_ID_V1}`,
      "root_self_signature",
      "signature_message_mismatch",
      { pointCalls: 1, verifyCalls: 1 },
    ),
    witness(
      "verify_signature_over:claims_include_self_signature",
      "root_self_signature",
      "signature_message_mismatch",
      { pointCalls: 1, verifyCalls: 1 },
    ),
    witness(
      "verify_signature_over:claims_omit_issued_at",
      "root_self_signature",
      "signature_message_mismatch",
      { pointCalls: 1, verifyCalls: 1 },
    ),
    witness(
      "verify_signature_over:raw_payload_only",
      "root_self_signature",
      "signature_message_mismatch",
      { pointCalls: 1, verifyCalls: 1 },
    ),
  ),
  invalidCase(
    "root-self-signature-raw-substitution",
    "root_signature",
    "bootstrapProviderRegistryRootMetadata.payload.selfSignature",
    witness(
      "mutate:last_signature_hex_nibble",
      "root_self_signature",
      "signature_invalid",
      { pointCalls: 1, verifyCalls: 1 },
    ),
  ),
  invalidCase(
    "recovery-count-matrix",
    "recovery_closure",
    "providerRegistryRecoveryKeys",
    witness(
      "remove:providerRegistryRecoveryKeys[2]",
      "bundle_payload_schema",
      "schema_invalid",
    ),
    witness(
      "append:providerRegistryRecoveryKeys:duplicate_last",
      "bundle_payload_schema",
      "schema_invalid",
    ),
  ),
  invalidCase(
    "recovery-id-digest-substitution-matrix",
    "recovery_closure",
    "providerRegistryRecoveryKeys[0]",
    witness(
      "replace:recoveryKeyId:independent_root_id",
      "recovery_key_record",
      "key_id_mismatch",
    ),
    witness(
      "replace:publicKeyDigest:sha256_ee64",
      "recovery_key_record",
      "raw_public_key_digest_mismatch",
    ),
  ),
  invalidCase(
    "recovery-order-duplicate-alias-matrix",
    "recovery_closure",
    "providerRegistryRecoveryKeys",
    witness(
      "reverse:providerRegistryRecoveryKeys",
      "recovery_key_closure",
      "recovery_order_invalid",
    ),
    witness(
      "alias:providerRegistryRecoveryKeys[1]:providerRegistryRecoveryKeys[0]",
      "recovery_key_closure",
      "recovery_duplicate",
    ),
    witness(
      "alias_material:providerRegistryRecoveryKeys[0]:bootstrap_root",
      "recovery_key_closure",
      "key_material_alias",
    ),
  ),
  invalidCase(
    "recovery-mixed-order-point",
    "recovery_closure",
    "providerRegistryRecoveryKeys[0].publicKeyBytes",
    witness(
      "replace:raw_public_key_hex:000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
      "recovery_key_closure",
      "point_validation_failed",
      { pointCalls: 1 },
    ),
  ),
  invalidCase(
    "opaque-capability-forgery-matrix",
    "opaque_capability",
    "strictCryptoCapability",
    witness(
      "replace:strictCryptoCapability:plain_object",
      "opaque_capability_lookup",
      "opaque_capability_invalid",
      { boundary: "public_provider_error" },
    ),
    witness(
      "replace:strictCryptoCapability:proxy_of_real_capability",
      "opaque_capability_lookup",
      "opaque_capability_invalid",
      { boundary: "public_provider_error" },
    ),
    witness(
      "replace:strictCryptoCapability:foreign_module_instance",
      "opaque_capability_lookup",
      "opaque_capability_invalid",
      { boundary: "public_provider_error" },
    ),
  ),
  invalidCase(
    "deterministic-seed-public-mismatch",
    "deterministic_fixture",
    "vectors.deterministicRootSelfSignatureSigning",
    witness(
      "replace:rfc8032TestSeedHex:repeat_33",
      "deterministic_fixture",
      "deterministic_key_mismatch",
      { boundary: "reference_oracle" },
    ),
  ),
  invalidCase(
    "deterministic-seed-signature-mismatch",
    "deterministic_fixture",
    "vectors.deterministicRootSelfSignatureSigning.expected.rawSignatureHex",
    witness(
      "reproduce_with_published_seed_and_compare:mutated_last_signature_hex_nibble",
      "deterministic_fixture",
      "deterministic_signature_mismatch",
      { boundary: "reference_oracle" },
    ),
  ),
  invalidCase(
    "deterministic-coherent-alternate",
    "deterministic_fixture",
    "vectors.deterministicRootSelfSignatureSigning",
    witness(
      "replace_and_recompute:seed_public_metadata_signature_expected:repeat_44",
      "compiled_golden_anchor",
      "compiled_digest_mismatch",
      { boundary: "fixture_verifier" },
    ),
  ),
] as const satisfies readonly InvalidCaseDefinitionV1[];

export const PROVIDER_BOOTSTRAP_TRUST_INVALID_CASE_IDS_V1 = Object.freeze(
  INVALID_CASE_DEFINITIONS_V1.map(({ caseId }) => caseId),
);

function witnessSchema(
  definition: InvalidWitnessDefinitionV1,
): z.ZodType<InvalidWitnessDefinitionV1> {
  return z.strictObject({
    profile: z.literal(definition.profile),
    recipe: z.strictObject({
      dialect: z.literal(definition.recipe.dialect),
      operation: z.literal(definition.recipe.operation),
      operands: z.tuple(
        definition.recipe.operands.map((operand) =>
          z.literal(operand),
        ) as unknown as [
          z.ZodLiteral<string>,
          ...z.ZodLiteral<string>[],
        ],
      ),
      deterministicSeed:
        definition.recipe.deterministicSeed.source === "none"
          ? z.strictObject({
              source: z.literal("none"),
            })
          : definition.recipe.deterministicSeed.source ===
              "literal_non_production"
            ? z.strictObject({
                source: z.literal("literal_non_production"),
                seedHex: z.literal(
                  definition.recipe.deterministicSeed.seedHex,
                ),
              })
            : z.strictObject({
                source: z.literal(
                  "bootstrap_golden_json_pointer",
                ),
                resourcePath: z.literal(
                  definition.recipe.deterministicSeed.resourcePath,
                ),
                jsonPointer: z.literal(
                  definition.recipe.deterministicSeed.jsonPointer,
                ),
              }),
    }),
    stage: z.literal(definition.stage),
    reason: z.literal(definition.reason),
    boundary: z.literal(definition.boundary),
    postAttestationPointCalls: z.literal(
      definition.postAttestationPointCalls,
    ),
    postAttestationVerifyCalls: z.literal(
      definition.postAttestationVerifyCalls,
    ),
  });
}

function caseSchema(
  definition: InvalidCaseDefinitionV1,
): z.ZodType<InvalidCaseDefinitionV1> {
  const witnessSchemas = definition.witnesses.map(
    witnessSchema,
  ) as unknown as [
    z.ZodType<InvalidWitnessDefinitionV1>,
    ...z.ZodType<InvalidWitnessDefinitionV1>[],
  ];
  return z.strictObject({
    caseId: z.literal(definition.caseId),
    category: z.literal(definition.category),
    target: z.literal(definition.target),
    witnesses: z.tuple(witnessSchemas),
  }) as z.ZodType<InvalidCaseDefinitionV1>;
}

const invalidCaseSchemas = INVALID_CASE_DEFINITIONS_V1.map(
  caseSchema,
) as unknown as [
  z.ZodType<InvalidCaseDefinitionV1>,
  ...z.ZodType<InvalidCaseDefinitionV1>[],
];

const Sha256HexV1Schema = z.string().regex(/^[0-9a-f]{64}$/u);

export interface ProviderBootstrapTrustInvalidManifestV1Shape {
  readonly schemaVersion: 1;
  readonly profile: typeof PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_PROFILE_V1;
  readonly canonicalizationProfile: typeof RFC8785_JCS_SAFE_INTEGER_PROFILE_V1;
  readonly verificationProfile: typeof STRICT_ED25519_VERIFICATION_PROFILE_V1;
  readonly fixtureAuthority: "none_rejection_only";
  readonly baseResources: {
    readonly bootstrapGolden: {
      readonly resourcePath: typeof PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_PATH_V1;
      readonly resourceByteLength: number;
      readonly resourceBytesSha256Hex: string;
      readonly semanticContentDigest: string;
    };
    readonly bootstrapBundle: {
      readonly resourcePath: typeof PROVIDER_BOOTSTRAP_TRUST_BUNDLE_RESOURCE_PATH_V1;
      readonly resourceByteLength: 6_518;
      readonly resourceBytesSha256Hex: string;
      readonly contentDigest: string;
    };
    readonly strictManifest: {
      readonly resourcePath: typeof PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1;
      readonly resourceByteLength: 13_167;
      readonly resourceBytesSha256Hex: string;
      readonly contentDigest: string;
    };
  };
  readonly cases: readonly InvalidCaseDefinitionV1[];
}

export const ProviderBootstrapTrustInvalidManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(
      PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_PROFILE_V1,
    ),
    canonicalizationProfile: z.literal(
      RFC8785_JCS_SAFE_INTEGER_PROFILE_V1,
    ),
    verificationProfile: z.literal(
      STRICT_ED25519_VERIFICATION_PROFILE_V1,
    ),
    fixtureAuthority: z.literal("none_rejection_only"),
    baseResources: z.strictObject({
      bootstrapGolden: z.strictObject({
        resourcePath: z.literal(
          PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_PATH_V1,
        ),
        resourceByteLength: z.literal(
          PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_BYTE_LENGTH_V1,
        ),
        resourceBytesSha256Hex: z.literal(
          PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_SHA256_HEX_V1,
        ),
        semanticContentDigest: z.literal(
          PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_SEMANTIC_CONTENT_DIGEST_V1,
        ),
      }),
      bootstrapBundle: z.strictObject({
        resourcePath: z.literal(
          PROVIDER_BOOTSTRAP_TRUST_BUNDLE_RESOURCE_PATH_V1,
        ),
        resourceByteLength: z.literal(6_518),
        resourceBytesSha256Hex: z.literal(
          "794c4d1032c249563ee43b325de6625031202a43ea1a32e783a60b79ab1bcd6d",
        ),
        contentDigest: z.literal(
          PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1,
        ),
      }),
      strictManifest: z.strictObject({
        resourcePath: z.literal(
          PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
        ),
        resourceByteLength: z.literal(13_167),
        resourceBytesSha256Hex: z.literal(
          "89859dd0125f3779624ef5882417351d583f87fcf41aae6e95dc5ae4b4eb1226",
        ),
        contentDigest: z.literal(
          PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_CONTENT_DIGEST_V1,
        ),
      }),
    }),
    cases: z.tuple(invalidCaseSchemas),
  }) as z.ZodType<ProviderBootstrapTrustInvalidManifestV1Shape>;

export type ProviderBootstrapTrustInvalidManifestV1 = z.infer<
  typeof ProviderBootstrapTrustInvalidManifestV1Schema
>;

export interface ProviderBootstrapTrustInvalidManifestValidationV1 {
  readonly authority: "none_rejection_only";
  readonly manifest: ProviderBootstrapTrustInvalidManifestV1;
}

function deepFreezeJson<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreezeJson(child);
    Object.freeze(value);
  }
  return value;
}

const EXPECTED_INVALID_MANIFEST_V1 = deepFreezeJson(
  ProviderBootstrapTrustInvalidManifestV1Schema.parse({
    schemaVersion: 1,
    profile: PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_PROFILE_V1,
    canonicalizationProfile: RFC8785_JCS_SAFE_INTEGER_PROFILE_V1,
    verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
    fixtureAuthority: "none_rejection_only",
    baseResources: {
      bootstrapGolden: {
        resourcePath:
          PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_PATH_V1,
        resourceByteLength:
          PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_BYTE_LENGTH_V1,
        resourceBytesSha256Hex:
          PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_SHA256_HEX_V1,
        semanticContentDigest:
          PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_SEMANTIC_CONTENT_DIGEST_V1,
      },
      bootstrapBundle: {
        resourcePath: PROVIDER_BOOTSTRAP_TRUST_BUNDLE_RESOURCE_PATH_V1,
        resourceByteLength: 6_518,
        resourceBytesSha256Hex:
          "794c4d1032c249563ee43b325de6625031202a43ea1a32e783a60b79ab1bcd6d",
        contentDigest:
          PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1,
      },
      strictManifest: {
        resourcePath:
          PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
        resourceByteLength: 13_167,
        resourceBytesSha256Hex:
          "89859dd0125f3779624ef5882417351d583f87fcf41aae6e95dc5ae4b4eb1226",
        contentDigest:
          PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_CONTENT_DIGEST_V1,
      },
    },
    cases: INVALID_CASE_DEFINITIONS_V1,
  }),
);

export function serializeProviderBootstrapTrustInvalidManifestFixtureInternalV1(): string {
  return `${JSON.stringify(EXPECTED_INVALID_MANIFEST_V1, null, 2)}\n`;
}

function canonicalBytesEqual(left: unknown, right: unknown): boolean {
  const leftBytes = canonicalizeJcsSafeIntegerUtf8V1(left);
  const rightBytes = canonicalizeJcsSafeIntegerUtf8V1(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    difference |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return difference === 0;
}

export function verifyProviderBootstrapTrustInvalidManifestV1(
  input: unknown,
): ProviderBootstrapTrustInvalidManifestValidationV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const manifest =
    ProviderBootstrapTrustInvalidManifestV1Schema.parse(input);
  if (!canonicalBytesEqual(manifest, EXPECTED_INVALID_MANIFEST_V1)) {
    throw new TypeError(
      "bootstrap trust invalid manifest case contract mismatch",
    );
  }
  const semanticDigest = ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexInternalV1(
      sha256InternalV1(
        canonicalizeJcsSafeIntegerUtf8V1(manifest),
      ),
    )}`,
  );
  if (
    semanticDigest !==
    PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_SEMANTIC_CONTENT_DIGEST_V1
  ) {
    throw new TypeError(
      "bootstrap trust invalid manifest compiled digest mismatch",
    );
  }
  return deepFreezeJson({
    authority: "none_rejection_only",
    manifest,
  });
}

export function verifyProviderBootstrapTrustInvalidManifestResourceV1(
  resourceBytes: unknown,
): ProviderBootstrapTrustInvalidManifestValidationV1 {
  const snapshot = snapshotBoundedFixedResourceBytesInternalV1(
    resourceBytes,
    PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_MAX_BYTES_V1,
  );
  assertFixedResourceByteAnchorInternalV1(
    snapshot,
    PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_BYTE_LENGTH_V1,
    PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_SHA256_HEX_V1,
  );
  return verifyProviderBootstrapTrustInvalidManifestV1(
    parseFixedUtf8JsonResourceInternalV1(snapshot),
  );
}
