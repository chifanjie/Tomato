import { z } from "./zod-runtime.js";

import { ProviderBootstrapTrustBundleV1Schema } from "./bootstrap-trust-bundle.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
} from "./primitives.js";
import {
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_AUTHORITY_V1,
  ProviderDistributionHistoryCurrentCandidatePointInvalidReasonV1Schema,
  ProviderDistributionHistoryCurrentCandidatePointInvalidStageV1Schema,
  ProviderDistributionHistoryCurrentCandidatePointValidationError,
  diagnoseProviderDistributionHistoryCurrentCandidatePointV1,
  validateProviderDistributionHistoryCurrentCandidatePointV1,
  type ProviderDistributionHistoryCurrentCandidatePointInvalidReasonV1,
  type ProviderDistributionHistoryCurrentCandidatePointInvalidStageV1,
  type ProviderDistributionHistoryCurrentCandidatePointValidationV1,
  type ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
} from "./provider-distribution-history-current-candidate-point.js";
import { ProviderSignedDistributionRootBindingV1Schema } from "./provider-distribution-trust.js";
import {
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_AUTHORITY_V1,
  ProviderFeasibilityPublicSupportV1Schema,
  ProviderFeasibilityReleaseDispositionV1Schema,
  ProviderFeasibilitySupportCandidateArtifactV1Schema,
  ProviderFeasibilitySupportCatalogEnvelopeV1Schema,
  ProviderFeasibilitySupportCatalogPinV1Schema,
} from "./provider-feasibility-support-catalog-point.js";
import {
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  projectProviderFeasibilitySupportCatalogPointFixtureClosureV1,
} from "./provider-feasibility-support-catalog-point-fixtures.js";
import {
  ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
  ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
} from "./provider-real-filesystem-source.js";
import { ProviderRegistryManifestEnvelopeV1Schema } from "./provider-registry-records.js";
import { ProviderRegistryRootMetadataEnvelopeV1Schema } from "./provider-registry-trust.js";
import { ProviderReleaseTargetUniverseEnvelopeV1Schema } from "./provider-release-target-universe-point.js";
import { sha256InternalV1 } from "./sha256.js";
import {
  ProviderFeasibilityTargetV1Schema,
  ProviderPublicSupportTaxonomyEnvelopeV1Schema,
  ProviderReleaseMatrixEnvelopeV1Schema,
  ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema,
  ProviderTargetDiscoveryResultEnvelopeV1Schema,
  ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema,
} from "./provider-target-discovery-point.js";
import type { ProviderStrictEd25519OpaqueCapabilityV1 } from "./strict-ed25519-conformance.js";

export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_PROFILE_V1 =
  "provider_distribution_history_current_candidate_point_golden_v1" as const;
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_PROFILE_V1 =
  "provider_distribution_history_current_candidate_point_invalid_v1" as const;
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_SEMANTIC_DOMAIN_V1 =
  "provider-distribution-history-current-candidate-point-golden-manifest-v1" as const;
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_SEMANTIC_DOMAIN_V1 =
  "provider-distribution-history-current-candidate-point-invalid-manifest-v1" as const;
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1 =
  "provider-distribution-history-current-candidate-point-invalid-materialized-request-v1" as const;
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_RECIPE_DIALECT_V1 =
  "provider_distribution_history_current_candidate_point_invalid_recipe_v1" as const;
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_PATH_V1 =
  "fixtures/v1/golden/provider-distribution-history-current-candidate-point-v1.json" as const;
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_RESOURCE_PATH_V1 =
  "fixtures/v1/invalid/provider-distribution-history-current-candidate-point-v1.json" as const;

export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1 =
  964_171 as const;
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1 =
  "51841c3be2f7e785d067708d85442d7a99b3e1a3e260f7d0006674f21f6eb502" as const;
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:784c6ef5669c743dffed6ca7b0be2b386e4e768e36c9a12b31627aa474a2a4c1" as const;
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1 =
  1_368_911 as const;
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_RESOURCE_SHA256_HEX_V1 =
  "8abf64110854734efcfd71b26c30d196350363bd9fedb4ee14927171c8008224" as const;
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:94117ec01456a28160c987b9df1b8403369e1ddd209a799df22aec2df340d3a4" as const;
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_FIXTURE_MAX_BYTES_V1 =
  16_777_216 as const;

const POSITIVE_VECTOR_DEFINITIONS_V1 = [
  ["genesis", 31, 64],
  ["two-generation-shared", 31, 70],
  ["two-generation-distinct", 31, 72],
] as const;

const INVALID_CASE_DEFINITIONS_V1 = [
  ["historical-bundle-signature-bitflip", "historical_signature", "two-generation-distinct", "current_source_closure", "signature_invalid"],
  ["historical-suite-signature-bitflip", "historical_signature", "two-generation-distinct", "current_source_closure", "signature_invalid"],
  ["historical-corpus-signature-bitflip", "historical_signature", "two-generation-distinct", "current_source_closure", "signature_invalid"],
  ["historical-semantic-suite-cases-order", "historical_semantic", "two-generation-distinct", "current_source_closure", "source_invalid"],
  ["historical-semantic-fixture-record-ordinal", "historical_semantic", "two-generation-distinct", "current_source_closure", "source_invalid"],
  ["historical-semantic-result-target-count", "historical_semantic", "two-generation-distinct", "target_discovery_result_history", "source_invalid"],
  ["historical-semantic-universe-discovered-count", "historical_semantic", "two-generation-distinct", "release_target_universe_history", "source_invalid"],
  ["historical-semantic-catalog-target-order", "historical_semantic", "two-generation-distinct", "provider_feasibility_support_catalog_history", "source_invalid"],
  ["input-forbidden-active-root", "forbidden_extra_key", "genesis", "input", "schema_invalid"],
  ["input-forbidden-current", "forbidden_extra_key", "genesis", "input", "schema_invalid"],
  ["input-forbidden-path", "forbidden_extra_key", "genesis", "input", "schema_invalid"],
  ["taxonomy-history-empty", "five_chain_structure", "genesis", "public_support_taxonomy_history", "history_empty"],
  ["matrix-history-empty", "five_chain_structure", "genesis", "release_matrix_history", "history_empty"],
  ["discovery-history-empty", "five_chain_structure", "genesis", "target_discovery_result_history", "history_empty"],
  ["universe-history-empty", "five_chain_structure", "genesis", "release_target_universe_history", "history_empty"],
  ["catalog-history-empty", "five_chain_structure", "genesis", "provider_feasibility_support_catalog_history", "history_empty"],
  ["taxonomy-history-non-genesis-first", "five_chain_structure", "genesis", "public_support_taxonomy_history", "generation_not_contiguous"],
  ["matrix-history-non-genesis-first", "five_chain_structure", "genesis", "release_matrix_history", "generation_not_contiguous"],
  ["discovery-history-non-genesis-first", "five_chain_structure", "genesis", "target_discovery_result_history", "generation_not_contiguous"],
  ["universe-history-non-genesis-first", "five_chain_structure", "genesis", "release_target_universe_history", "generation_not_contiguous"],
  ["catalog-history-non-genesis-first", "five_chain_structure", "genesis", "provider_feasibility_support_catalog_history", "generation_not_contiguous"],
  ["taxonomy-history-genesis-predecessor", "five_chain_structure", "genesis", "public_support_taxonomy_history", "predecessor_digest_mismatch"],
  ["matrix-history-genesis-predecessor", "five_chain_structure", "genesis", "release_matrix_history", "predecessor_digest_mismatch"],
  ["discovery-history-genesis-predecessor", "five_chain_structure", "genesis", "target_discovery_result_history", "predecessor_digest_mismatch"],
  ["universe-history-genesis-predecessor", "five_chain_structure", "genesis", "release_target_universe_history", "predecessor_digest_mismatch"],
  ["catalog-history-genesis-predecessor", "five_chain_structure", "genesis", "provider_feasibility_support_catalog_history", "predecessor_digest_mismatch"],
  ["retained-fixture-missing", "retained_exact_cover", "genesis", "retained_history_accounting", "source_exact_cover_mismatch"],
  ["retained-runner-missing", "retained_exact_cover", "genesis", "retained_history_accounting", "source_exact_cover_mismatch"],
  ["retained-suite-missing", "retained_exact_cover", "genesis", "retained_history_accounting", "source_exact_cover_mismatch"],
  ["retained-corpus-missing", "retained_exact_cover", "genesis", "retained_history_accounting", "source_exact_cover_mismatch"],
  ["retained-fixture-duplicate", "retained_exact_cover", "genesis", "retained_history_accounting", "source_exact_cover_mismatch"],
  ["retained-runner-duplicate", "retained_exact_cover", "genesis", "retained_history_accounting", "source_exact_cover_mismatch"],
  ["retained-suite-duplicate", "retained_exact_cover", "genesis", "retained_history_accounting", "source_exact_cover_mismatch"],
  ["retained-corpus-duplicate", "retained_exact_cover", "genesis", "retained_history_accounting", "source_exact_cover_mismatch"],
  ["retained-fixture-extra", "retained_exact_cover", "genesis", "retained_history_accounting", "source_exact_cover_mismatch"],
  ["retained-runner-extra", "retained_exact_cover", "genesis", "retained_history_accounting", "source_exact_cover_mismatch"],
  ["retained-suite-extra", "retained_exact_cover", "genesis", "retained_history_accounting", "source_exact_cover_mismatch"],
  ["retained-corpus-extra", "retained_exact_cover", "genesis", "retained_history_accounting", "source_exact_cover_mismatch"],
  ["catalog-cross-pin-universe", "catalog_cross_pin", "genesis", "history_pin_closure", "pin_mismatch"],
] as const satisfies readonly (readonly [
  string,
  "historical_signature" | "historical_semantic" | "forbidden_extra_key" | "five_chain_structure" | "retained_exact_cover" | "catalog_cross_pin",
  "genesis" | "two-generation-shared" | "two-generation-distinct",
  ProviderDistributionHistoryCurrentCandidatePointInvalidStageV1,
  ProviderDistributionHistoryCurrentCandidatePointInvalidReasonV1,
])[];

export type ProviderDistributionHistoryCurrentCandidatePointPositiveVectorIdV1 =
  (typeof POSITIVE_VECTOR_DEFINITIONS_V1)[number][0];
export type ProviderDistributionHistoryCurrentCandidatePointInvalidCaseIdV1 =
  (typeof INVALID_CASE_DEFINITIONS_V1)[number][0];

export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_POSITIVE_VECTOR_IDS_V1:
  readonly ProviderDistributionHistoryCurrentCandidatePointPositiveVectorIdV1[] =
  Object.freeze(POSITIVE_VECTOR_DEFINITIONS_V1.map(([vectorId]) => vectorId));
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_CASE_IDS_V1:
  readonly ProviderDistributionHistoryCurrentCandidatePointInvalidCaseIdV1[] =
  Object.freeze(INVALID_CASE_DEFINITIONS_V1.map(([caseId]) => caseId));
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_HISTORICAL_SIGNATURE_CASE_IDS_V1 =
  Object.freeze(
    INVALID_CASE_DEFINITIONS_V1.filter(([, group]) => group === "historical_signature")
      .map(([caseId]) => caseId),
  );
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_HISTORICAL_SEMANTIC_CASE_IDS_V1 =
  Object.freeze(
    INVALID_CASE_DEFINITIONS_V1.filter(([, group]) => group === "historical_semantic")
      .map(([caseId]) => caseId),
  );
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_FORBIDDEN_EXTRA_KEY_CASE_IDS_V1 =
  Object.freeze(
    INVALID_CASE_DEFINITIONS_V1.filter(([, group]) => group === "forbidden_extra_key")
      .map(([caseId]) => caseId),
  );
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_FIVE_CHAIN_STRUCTURE_CASE_IDS_V1 =
  Object.freeze(
    INVALID_CASE_DEFINITIONS_V1.filter(([, group]) => group === "five_chain_structure")
      .map(([caseId]) => caseId),
  );
export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_RETAINED_EXACT_COVER_CASE_IDS_V1 =
  Object.freeze(
    INVALID_CASE_DEFINITIONS_V1.filter(([, group]) => group === "retained_exact_cover")
      .map(([caseId]) => caseId),
  );

const NonnegativeSafeIntegerV1Schema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
const ResourceSha256HexV1Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const RelativePathV1Schema = z
  .string()
  .regex(/^provider\/support-catalog\/(?:id-[0-9a-v]+|idh-[0-9a-f]{64})\.json$/u);

export const ProviderDistributionHistoryCurrentCandidatePointJsonRequestV1Schema =
  z.strictObject({
    bootstrapTrustBundle: ProviderBootstrapTrustBundleV1Schema,
    distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    providerFeasibilitySupportCandidateArtifacts: z.array(
      ProviderFeasibilitySupportCandidateArtifactV1Schema,
    ),
    providerFeasibilitySupportCatalogHistory: z
      .array(ProviderFeasibilitySupportCatalogEnvelopeV1Schema)
      .min(1),
    publicSupportTaxonomyHistory: z
      .array(ProviderPublicSupportTaxonomyEnvelopeV1Schema)
      .min(1),
    realFilesystemFixtureCorpusManifests: z
      .array(ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema)
      .min(1),
    realFilesystemSuiteManifests: z
      .array(ProviderRealFilesystemSuiteManifestEnvelopeV1Schema)
      .min(1),
    registryManifestHistory: z
      .array(ProviderRegistryManifestEnvelopeV1Schema)
      .min(1),
    releaseMatrixHistory: z.array(ProviderReleaseMatrixEnvelopeV1Schema).min(1),
    releaseTargetUniverseHistory: z
      .array(ProviderReleaseTargetUniverseEnvelopeV1Schema)
      .min(1),
    rootMetadataHistory: z
      .array(ProviderRegistryRootMetadataEnvelopeV1Schema)
      .min(1),
    targetDiscoveryFixtureManifests: z
      .array(ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema)
      .min(1),
    targetDiscoveryResultHistory: z
      .array(ProviderTargetDiscoveryResultEnvelopeV1Schema)
      .min(1),
    targetDiscoveryRunnerRuns: z
      .array(ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema)
      .min(1),
  });
export type ProviderDistributionHistoryCurrentCandidatePointJsonRequestV1 =
  z.infer<
    typeof ProviderDistributionHistoryCurrentCandidatePointJsonRequestV1Schema
  >;

const CryptoCountsV1Schema = z.strictObject({
  pointAdmissionCount: NonnegativeSafeIntegerV1Schema,
  signatureVerificationCount: NonnegativeSafeIntegerV1Schema,
});
export type ProviderDistributionHistoryCurrentCandidatePointCryptoCountsV1 =
  z.infer<typeof CryptoCountsV1Schema>;

const CurrentCatalogProjectionV1Schema = z.strictObject({
  authority: z.literal(PROVIDER_FEASIBILITY_SUPPORT_CATALOG_AUTHORITY_V1),
  ownerTargetCapabilities: z.array(
    z.strictObject({
      target: ProviderFeasibilityTargetV1Schema,
      capability: ProviderFeasibilityReleaseDispositionV1Schema,
    }),
  ),
  publicSupport: z.array(ProviderFeasibilityPublicSupportV1Schema),
  providerFeasibilitySupportCatalogContentDigest: ContentDigestV1Schema,
  providerFeasibilitySupportCatalogPin:
    ProviderFeasibilitySupportCatalogPinV1Schema,
  relativePath: RelativePathV1Schema,
  targetCount: NonnegativeSafeIntegerV1Schema,
  candidateCount: NonnegativeSafeIntegerV1Schema,
  publicSupportRowCount: NonnegativeSafeIntegerV1Schema,
});

const SUCCESS_KEYS_V1 = [
  "authority",
  "catalogPointClosure",
  "currentCatalogProjection",
  "providerFeasibilitySupportCatalogTip",
  "publicSupportTaxonomyTip",
  "releaseMatrixTip",
  "releaseTargetUniverseTip",
  "targetDiscoveryResultTip",
] as const;

function positiveVectorSchemaV1(
  definition: (typeof POSITIVE_VECTOR_DEFINITIONS_V1)[number],
) {
  const [vectorId, pointAdmissionCount, signatureVerificationCount] =
    definition;
  return z.strictObject({
    vectorId: z.literal(vectorId),
    request: ProviderDistributionHistoryCurrentCandidatePointJsonRequestV1Schema,
    expected: z.strictObject({
      authority: z.literal(
        PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_AUTHORITY_V1,
      ),
      successKeys: z.tuple(SUCCESS_KEYS_V1.map((key) => z.literal(key)) as [
        z.ZodLiteral<(typeof SUCCESS_KEYS_V1)[0]>,
        z.ZodLiteral<(typeof SUCCESS_KEYS_V1)[1]>,
        z.ZodLiteral<(typeof SUCCESS_KEYS_V1)[2]>,
        z.ZodLiteral<(typeof SUCCESS_KEYS_V1)[3]>,
        z.ZodLiteral<(typeof SUCCESS_KEYS_V1)[4]>,
        z.ZodLiteral<(typeof SUCCESS_KEYS_V1)[5]>,
        z.ZodLiteral<(typeof SUCCESS_KEYS_V1)[6]>,
        z.ZodLiteral<(typeof SUCCESS_KEYS_V1)[7]>,
      ]),
      currentCatalogProjection: CurrentCatalogProjectionV1Schema,
      cryptoCounts: z.strictObject({
        pointAdmissionCount: z.literal(pointAdmissionCount),
        signatureVerificationCount: z.literal(signatureVerificationCount),
      }),
    }),
  });
}

const DependencyAnchorV1Schema = z.strictObject({
  resourcePath: z.string().min(1),
  resourceByteLength: NonnegativeSafeIntegerV1Schema,
  resourceSha256Hex: ResourceSha256HexV1Schema,
  semanticContentDigest: ContentDigestV1Schema,
});

export const ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_PROFILE_V1,
    ),
    fixtureAuthority: z.literal(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_AUTHORITY_V1,
    ),
    canonicalizationProfile: z.literal("rfc8785-jcs-safe-integer-v1"),
    verificationProfile: z.literal(
      "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
    ),
    dependencies: z.strictObject({
      catalogPointGolden: DependencyAnchorV1Schema.extend({
        resourcePath: z.literal(
          PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_PATH_V1,
        ),
        resourceByteLength: z.literal(
          PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
        ),
        resourceSha256Hex: z.literal(
          PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
        ),
        semanticContentDigest: z.literal(
          PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
        ),
      }),
    }),
    positiveVectorCount: z.literal(3),
    positiveVectorIds: z.tuple([
      z.literal("genesis"),
      z.literal("two-generation-shared"),
      z.literal("two-generation-distinct"),
    ]),
    positiveVectors: z.tuple([
      positiveVectorSchemaV1(POSITIVE_VECTOR_DEFINITIONS_V1[0]),
      positiveVectorSchemaV1(POSITIVE_VECTOR_DEFINITIONS_V1[1]),
      positiveVectorSchemaV1(POSITIVE_VECTOR_DEFINITIONS_V1[2]),
    ]),
    aggregateCryptoCounts: z.strictObject({
      pointAdmissionCount: z.literal(93),
      signatureVerificationCount: z.literal(206),
    }),
    semanticDomain: z.literal(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
    ),
    semanticContentDigest: z.literal(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    ),
  });
export type ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1 =
  z.infer<
    typeof ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1Schema
  >;

const RawRequestFieldV1Schema = z.enum([
  "bootstrapTrustBundle",
  "distributionRootBinding",
  "installationIdentityGenerationId",
  "providerFeasibilitySupportCandidateArtifacts",
  "providerFeasibilitySupportCatalogHistory",
  "publicSupportTaxonomyHistory",
  "realFilesystemFixtureCorpusManifests",
  "realFilesystemSuiteManifests",
  "registryManifestHistory",
  "releaseMatrixHistory",
  "releaseTargetUniverseHistory",
  "rootMetadataHistory",
  "targetDiscoveryFixtureManifests",
  "targetDiscoveryResultHistory",
  "targetDiscoveryRunnerRuns",
]);
const ForbiddenExtraFieldV1Schema = z.enum(["activeRoot", "current", "path"]);
const MutationOperationV1Schema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("replace"),
    field: RawRequestFieldV1Schema,
    value: z.json(),
  }),
  z.strictObject({
    kind: z.literal("add"),
    field: ForbiddenExtraFieldV1Schema,
    value: z.json(),
  }),
]);
const PublicFailureV1Schema = z.strictObject({
  errorName: z.literal(
    "ProviderDistributionHistoryCurrentCandidatePointValidationError",
  ),
  code: z.literal("provider_unavailable"),
  reason: z.literal("attestation_invalid"),
});

function invalidCaseSchemaV1(
  definition: (typeof INVALID_CASE_DEFINITIONS_V1)[number],
) {
  const [caseId, group, baseVectorId, stage, reason] = definition;
  return z.strictObject({
    caseId: z.literal(caseId),
    group: z.literal(group),
    mutation: z.strictObject({
      dialect: z.literal(
        PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_RECIPE_DIALECT_V1,
      ),
      goldenResourcePath: z.literal(
        PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_PATH_V1,
      ),
      baseVectorId: z.literal(baseVectorId),
      operations: z.array(MutationOperationV1Schema).min(1).max(16),
    }),
    expected: z.strictObject({
      stage: z.literal(stage),
      reason: z.literal(reason),
      publicFailure: PublicFailureV1Schema,
      cryptoCounts: CryptoCountsV1Schema,
      materializedRequestSemanticDigest: ContentDigestV1Schema,
    }),
  });
}

const ORDERED_INVALID_CASE_SCHEMAS_V1 = INVALID_CASE_DEFINITIONS_V1.map(
  invalidCaseSchemaV1,
) as unknown as [z.ZodTypeAny, ...z.ZodTypeAny[]];
const ORDERED_INVALID_CASE_ID_SCHEMAS_V1 = INVALID_CASE_DEFINITIONS_V1.map(
  ([caseId]) => z.literal(caseId),
) as unknown as [z.ZodTypeAny, ...z.ZodTypeAny[]];

export const ProviderDistributionHistoryCurrentCandidatePointInvalidManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_PROFILE_V1,
    ),
    fixtureAuthority: z.literal("none_rejection_only"),
    canonicalizationProfile: z.literal("rfc8785-jcs-safe-integer-v1"),
    verificationProfile: z.literal(
      "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
    ),
    goldenDependency: DependencyAnchorV1Schema.extend({
      resourcePath: z.literal(
        PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_PATH_V1,
      ),
      resourceByteLength: z.literal(
        PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
      ),
      resourceSha256Hex: z.literal(
        PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
      ),
      semanticContentDigest: z.literal(
        PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
      ),
    }),
    mutationRecipeDialect: z.literal(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_RECIPE_DIALECT_V1,
    ),
    materializedRequestDomain: z.literal(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
    ),
    historicalSignatureCaseCount: z.literal(3),
    historicalSemanticCaseCount: z.literal(5),
    forbiddenExtraKeyCaseCount: z.literal(3),
    fiveChainStructuralCaseCount: z.literal(15),
    retainedExactCoverCaseCount: z.literal(12),
    catalogCrossPinCaseCount: z.literal(1),
    caseCount: z.literal(39),
    caseIds: z.tuple(ORDERED_INVALID_CASE_ID_SCHEMAS_V1),
    cases: z.tuple(ORDERED_INVALID_CASE_SCHEMAS_V1),
    semanticDomain: z.literal(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_SEMANTIC_DOMAIN_V1,
    ),
    semanticContentDigest: z.literal(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
    ),
  });

type ParsedInvalidManifestV1 = z.infer<
  typeof ProviderDistributionHistoryCurrentCandidatePointInvalidManifestV1Schema
>;
export type ProviderDistributionHistoryCurrentCandidatePointInvalidManifestV1 =
  Omit<ParsedInvalidManifestV1, "caseIds" | "cases"> & {
    readonly caseIds: readonly ProviderDistributionHistoryCurrentCandidatePointInvalidCaseIdV1[];
    readonly cases: readonly ProviderDistributionHistoryCurrentCandidatePointInvalidCaseV1[];
  };
export interface ProviderDistributionHistoryCurrentCandidatePointInvalidCaseV1 {
  readonly caseId: ProviderDistributionHistoryCurrentCandidatePointInvalidCaseIdV1;
  readonly group:
    | "historical_signature"
    | "historical_semantic"
    | "forbidden_extra_key"
    | "five_chain_structure"
    | "retained_exact_cover"
    | "catalog_cross_pin";
  readonly mutation: {
    readonly dialect: typeof PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_RECIPE_DIALECT_V1;
    readonly goldenResourcePath: typeof PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_PATH_V1;
    readonly baseVectorId: ProviderDistributionHistoryCurrentCandidatePointPositiveVectorIdV1;
    readonly operations: readonly z.infer<typeof MutationOperationV1Schema>[];
  };
  readonly expected: {
    readonly stage: ProviderDistributionHistoryCurrentCandidatePointInvalidStageV1;
    readonly reason: ProviderDistributionHistoryCurrentCandidatePointInvalidReasonV1;
    readonly publicFailure: z.infer<typeof PublicFailureV1Schema>;
    readonly cryptoCounts: ProviderDistributionHistoryCurrentCandidatePointCryptoCountsV1;
    readonly materializedRequestSemanticDigest: `sha256:${string}`;
  };
}

const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedJsonParseV1 = JSON.parse;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedNumberPrototypeToStringV1 = Number.prototype.toString;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectHasOwnV1 = Object.hasOwn;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const CapturedStringPrototypePadStartV1 = String.prototype.padStart;
const CapturedTextDecoderV1 = TextDecoder;
const CapturedTextDecoderPrototypeDecodeV1 = TextDecoder.prototype.decode;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetPrototypeAddV1 = WeakSet.prototype.add;
const CapturedWeakSetPrototypeHasV1 = WeakSet.prototype.has;
const fixtureUtf8DecoderV1 = new CapturedTextDecoderV1("utf-8", {
  fatal: true,
  ignoreBOM: true,
});
const verifiedGoldenManifestsV1 = new CapturedWeakSetV1<object>();
const verifiedInvalidManifestsV1 = new CapturedWeakSetV1<object>();

function uncurryFixtureMethodV1(method: Function): Function {
  return Function.prototype.call.bind(method);
}

const numberToStringV1 = uncurryFixtureMethodV1(
  CapturedNumberPrototypeToStringV1,
) as (value: number, radix?: number) => string;
const stringPadStartV1 = uncurryFixtureMethodV1(
  CapturedStringPrototypePadStartV1,
) as (value: string, length: number, fill: string) => string;
const textDecodeV1 = uncurryFixtureMethodV1(
  CapturedTextDecoderPrototypeDecodeV1,
) as (decoder: TextDecoder, bytes: Uint8Array) => string;
const weakSetAddV1 = uncurryFixtureMethodV1(
  CapturedWeakSetPrototypeAddV1,
) as (set: WeakSet<object>, value: object) => WeakSet<object>;
const weakSetHasV1 = uncurryFixtureMethodV1(
  CapturedWeakSetPrototypeHasV1,
) as (set: WeakSet<object>, value: object) => boolean;

function bytesToLowerHexV1(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.byteLength; index += 1) {
    output += stringPadStartV1(
      numberToStringV1(bytes[index]!, 16),
      2,
      "0",
    );
  }
  return output;
}

function rawSha256HexV1(bytes: Uint8Array): string {
  return bytesToLowerHexV1(sha256InternalV1(bytes));
}

export function deriveProviderDistributionHistoryCurrentCandidatePointFixtureSemanticContentDigestV1(
  domain: string,
  value: object,
): `sha256:${string}` {
  return `sha256:${rawSha256HexV1(
    canonicalizeJcsSafeIntegerUtf8V1([domain, value]),
  )}`;
}

function canonicalEqualFixtureV1(left: unknown, right: unknown): boolean {
  let leftBytes: Uint8Array;
  let rightBytes: Uint8Array;
  try {
    leftBytes = canonicalizeJcsSafeIntegerUtf8V1(left);
    rightBytes = canonicalizeJcsSafeIntegerUtf8V1(right);
  } catch {
    return false;
  }
  if (leftBytes.byteLength !== rightBytes.byteLength) return false;
  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return false;
  }
  return true;
}

function jsonCloneV1<T>(value: T): T {
  return CapturedJsonParseV1(
    textDecodeV1(fixtureUtf8DecoderV1, canonicalizeJcsSafeIntegerUtf8V1(value)),
  ) as T;
}

function deepFreezeFixtureValueV1<T>(value: T): T {
  const seen = new CapturedWeakSetV1<object>();
  const visit = (candidate: unknown): void => {
    if (
      candidate === null ||
      (typeof candidate !== "object" && typeof candidate !== "function") ||
      weakSetHasV1(seen, candidate as object)
    ) {
      return;
    }
    weakSetAddV1(seen, candidate as object);
    const keys = CapturedReflectOwnKeysV1(candidate as object);
    for (let index = 0; index < keys.length; index += 1) {
      const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
        candidate as object,
        keys[index]!,
      );
      if (descriptor !== undefined && "value" in descriptor) {
        visit(descriptor.value);
      }
    }
    CapturedObjectFreezeV1(candidate as object);
  };
  visit(value);
  return value;
}

function assertRecursivelyFrozenFixtureV1(value: unknown): void {
  const seen = new CapturedWeakSetV1<object>();
  const visit = (candidate: unknown): void => {
    if (candidate === null || typeof candidate !== "object") return;
    if (weakSetHasV1(seen, candidate)) return;
    weakSetAddV1(seen, candidate);
    if (!CapturedObjectIsFrozenV1(candidate)) {
      throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
        "current-candidate fixture result contains a mutable object",
      );
    }
    const keys = CapturedReflectOwnKeysV1(candidate);
    for (let index = 0; index < keys.length; index += 1) {
      const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
        candidate,
        keys[index]!,
      );
      if (descriptor !== undefined && "value" in descriptor) {
        visit(descriptor.value);
      }
    }
  };
  visit(value);
}

function parseJsonResourceV1(bytes: Uint8Array, label: string): unknown {
  try {
    return CapturedJsonParseV1(textDecodeV1(fixtureUtf8DecoderV1, bytes));
  } catch {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      `${label} is not strict UTF-8 JSON`,
    );
  }
}

function verifyResourceAnchorV1(
  bytes: Uint8Array,
  expectedByteLength: number,
  expectedSha256Hex: string,
  label: string,
): void {
  try {
    if (
      !(bytes instanceof CapturedUint8ArrayV1) ||
      bytes.byteLength >
        PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_FIXTURE_MAX_BYTES_V1 ||
      bytes.byteLength !== expectedByteLength ||
      rawSha256HexV1(bytes) !== expectedSha256Hex
    ) {
      throw new CapturedTypeErrorV1("anchor mismatch");
    }
  } catch {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      `${label} bytes do not match the immutable anchor`,
    );
  }
}

function verifySemanticDigestV1(
  domain: string,
  manifest: { readonly semanticContentDigest: string },
  expectedDigest: string,
  label: string,
): void {
  const { semanticContentDigest: _semanticContentDigest, ...semanticFields } =
    manifest;
  if (
    manifest.semanticContentDigest !== expectedDigest ||
    deriveProviderDistributionHistoryCurrentCandidatePointFixtureSemanticContentDigestV1(
      domain,
      semanticFields,
    ) !== manifest.semanticContentDigest
  ) {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      `${label} semantic digest mismatch`,
    );
  }
}

export class ProviderDistributionHistoryCurrentCandidatePointFixtureError extends CapturedTypeErrorV1 {}

function assertVerifiedGoldenManifestV1(
  manifest: ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1,
): void {
  if (!weakSetHasV1(verifiedGoldenManifestsV1, manifest)) {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      "current-candidate golden manifest was not admitted from its anchored resource",
    );
  }
}

function assertVerifiedInvalidManifestV1(
  manifest: ProviderDistributionHistoryCurrentCandidatePointInvalidManifestV1,
): void {
  if (!weakSetHasV1(verifiedInvalidManifestsV1, manifest)) {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      "current-candidate invalid manifest was not admitted from its anchored resource",
    );
  }
}

export function verifyProviderDistributionHistoryCurrentCandidatePointGoldenResourceV1(
  bytes: Uint8Array,
): ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1 {
  verifyResourceAnchorV1(
    bytes,
    PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
    "current-candidate golden",
  );
  let manifest: ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1;
  try {
    manifest =
      ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1Schema.parse(
        parseJsonResourceV1(bytes, "current-candidate golden"),
      );
  } catch (error) {
    if (
      error instanceof
      ProviderDistributionHistoryCurrentCandidatePointFixtureError
    ) {
      throw error;
    }
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      "current-candidate golden schema is invalid",
    );
  }
  verifySemanticDigestV1(
    PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
    manifest,
    PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    "current-candidate golden",
  );
  deepFreezeFixtureValueV1(manifest);
  weakSetAddV1(verifiedGoldenManifestsV1, manifest);
  return manifest;
}

export function verifyProviderDistributionHistoryCurrentCandidatePointInvalidResourceV1(
  bytes: Uint8Array,
): ProviderDistributionHistoryCurrentCandidatePointInvalidManifestV1 {
  verifyResourceAnchorV1(
    bytes,
    PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
    PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
    "current-candidate invalid corpus",
  );
  let manifest: ProviderDistributionHistoryCurrentCandidatePointInvalidManifestV1;
  try {
    manifest =
      ProviderDistributionHistoryCurrentCandidatePointInvalidManifestV1Schema.parse(
        parseJsonResourceV1(bytes, "current-candidate invalid corpus"),
      ) as ProviderDistributionHistoryCurrentCandidatePointInvalidManifestV1;
  } catch (error) {
    if (
      error instanceof
      ProviderDistributionHistoryCurrentCandidatePointFixtureError
    ) {
      throw error;
    }
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      "current-candidate invalid corpus schema is invalid",
    );
  }
  verifySemanticDigestV1(
    PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_SEMANTIC_DOMAIN_V1,
    manifest,
    PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
    "current-candidate invalid corpus",
  );
  deepFreezeFixtureValueV1(manifest);
  weakSetAddV1(verifiedInvalidManifestsV1, manifest);
  return manifest;
}

function exactRawRequestCloneV1(
  request: ProviderDistributionHistoryCurrentCandidatePointJsonRequestV1,
): Record<string, unknown> {
  const detached = jsonCloneV1(request) as Record<string, unknown>;
  const keys = CapturedReflectOwnKeysV1(detached);
  if (keys.length !== 15) {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      "current-candidate fixture JSON request is not the exact 15-key shape",
    );
  }
  for (let index = 0; index < keys.length; index += 1) {
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
      detached,
      keys[index]!,
    );
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
        "current-candidate fixture request contains a non-data property",
      );
    }
  }
  return detached;
}

function requestWithCapabilityV1(
  rawRequest: Record<string, unknown>,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): ValidateProviderDistributionHistoryCurrentCandidatePointV1Input {
  const keys = CapturedReflectOwnKeysV1(rawRequest);
  for (let index = 0; index < keys.length; index += 1) {
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
      rawRequest,
      keys[index]!,
    );
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
        "current-candidate fixture request contains a non-data property",
      );
    }
    deepFreezeFixtureValueV1(descriptor.value);
  }
  CapturedObjectDefinePropertyV1(rawRequest, "strictCryptoCapability", {
    value: strictCryptoCapability,
    enumerable: true,
    configurable: false,
    writable: false,
  });
  CapturedObjectFreezeV1(rawRequest);
  return rawRequest as unknown as ValidateProviderDistributionHistoryCurrentCandidatePointV1Input;
}

function findPositiveVectorV1(
  manifest: ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1,
  vectorId: ProviderDistributionHistoryCurrentCandidatePointPositiveVectorIdV1,
) {
  if (typeof vectorId !== "string") {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      "current-candidate positive vector identifier is not a string",
    );
  }
  for (let index = 0; index < manifest.positiveVectors.length; index += 1) {
    const vector = manifest.positiveVectors[index]!;
    if (vector.vectorId === vectorId) return vector;
  }
  throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
    "unknown current-candidate positive vector",
  );
}

export function materializeProviderDistributionHistoryCurrentCandidatePointPositiveVectorRequestV1(
  manifest: ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1,
  vectorId: ProviderDistributionHistoryCurrentCandidatePointPositiveVectorIdV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): ValidateProviderDistributionHistoryCurrentCandidatePointV1Input {
  assertVerifiedGoldenManifestV1(manifest);
  const vector = findPositiveVectorV1(manifest, vectorId);
  return requestWithCapabilityV1(
    exactRawRequestCloneV1(vector.request),
    strictCryptoCapability,
  );
}

function findInvalidCaseV1(
  manifest: ProviderDistributionHistoryCurrentCandidatePointInvalidManifestV1,
  caseId: ProviderDistributionHistoryCurrentCandidatePointInvalidCaseIdV1,
): ProviderDistributionHistoryCurrentCandidatePointInvalidCaseV1 {
  if (typeof caseId !== "string") {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      "current-candidate invalid case identifier is not a string",
    );
  }
  for (let index = 0; index < manifest.cases.length; index += 1) {
    const invalidCase = manifest.cases[index]!;
    if (invalidCase.caseId === caseId) return invalidCase;
  }
  throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
    "unknown current-candidate invalid case",
  );
}

function materializeInvalidRawRequestV1(
  goldenManifest: ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1,
  invalidManifest: ProviderDistributionHistoryCurrentCandidatePointInvalidManifestV1,
  invalidCase: ProviderDistributionHistoryCurrentCandidatePointInvalidCaseV1,
): Record<string, unknown> {
  const vector = findPositiveVectorV1(
    goldenManifest,
    invalidCase.mutation.baseVectorId,
  );
  const request = exactRawRequestCloneV1(vector.request);
  const mutatedFields = new Set<string>();
  for (
    let index = 0;
    index < invalidCase.mutation.operations.length;
    index += 1
  ) {
    const operation = invalidCase.mutation.operations[index]!;
    if (mutatedFields.has(operation.field)) {
      throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
        `${invalidCase.caseId} mutates a top-level field twice`,
      );
    }
    mutatedFields.add(operation.field);
    if (operation.kind === "replace") {
      if (!CapturedObjectHasOwnV1(request, operation.field)) {
        throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
          `${invalidCase.caseId} replaces a missing raw field`,
        );
      }
    } else if (CapturedObjectHasOwnV1(request, operation.field)) {
      throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
        `${invalidCase.caseId} adds an existing raw field`,
      );
    }
    request[operation.field] = jsonCloneV1(operation.value);
  }
  const actualDigest =
    deriveProviderDistributionHistoryCurrentCandidatePointFixtureSemanticContentDigestV1(
      invalidManifest.materializedRequestDomain,
      request,
    );
  if (actualDigest !== invalidCase.expected.materializedRequestSemanticDigest) {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      `${invalidCase.caseId} materialized request semantic digest mismatch`,
    );
  }
  return request;
}

export function materializeProviderDistributionHistoryCurrentCandidatePointInvalidCaseRequestV1(
  goldenManifest: ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1,
  invalidManifest: ProviderDistributionHistoryCurrentCandidatePointInvalidManifestV1,
  caseId: ProviderDistributionHistoryCurrentCandidatePointInvalidCaseIdV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): ValidateProviderDistributionHistoryCurrentCandidatePointV1Input {
  assertVerifiedGoldenManifestV1(goldenManifest);
  assertVerifiedInvalidManifestV1(invalidManifest);
  const invalidCase = findInvalidCaseV1(invalidManifest, caseId);
  return requestWithCapabilityV1(
    materializeInvalidRawRequestV1(
      goldenManifest,
      invalidManifest,
      invalidCase,
    ),
    strictCryptoCapability,
  );
}

export interface ProviderDistributionHistoryCurrentCandidatePointExecutionCounterV1 {
  readonly pointAdmissionCount: () => number;
  readonly signatureVerificationCount: () => number;
}

interface CapturedExecutionCounterV1 {
  readonly pointAdmissionCount: () => number;
  readonly signatureVerificationCount: () => number;
}

function captureExecutionCounterV1(
  counter: ProviderDistributionHistoryCurrentCandidatePointExecutionCounterV1,
): CapturedExecutionCounterV1 {
  const pointDescriptor = CapturedObjectGetOwnPropertyDescriptorV1(
    counter,
    "pointAdmissionCount",
  );
  const signatureDescriptor = CapturedObjectGetOwnPropertyDescriptorV1(
    counter,
    "signatureVerificationCount",
  );
  if (
    pointDescriptor === undefined ||
    !("value" in pointDescriptor) ||
    typeof pointDescriptor.value !== "function" ||
    signatureDescriptor === undefined ||
    !("value" in signatureDescriptor) ||
    typeof signatureDescriptor.value !== "function"
  ) {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      "current-candidate execution counter is invalid",
    );
  }
  return {
    pointAdmissionCount: pointDescriptor.value.bind(counter) as () => number,
    signatureVerificationCount: signatureDescriptor.value.bind(
      counter,
    ) as () => number,
  };
}

function readCountsV1(counter: CapturedExecutionCounterV1) {
  const pointAdmissionCount = counter.pointAdmissionCount();
  const signatureVerificationCount = counter.signatureVerificationCount();
  if (
    !CapturedNumberIsSafeIntegerV1(pointAdmissionCount) ||
    pointAdmissionCount < 0 ||
    !CapturedNumberIsSafeIntegerV1(signatureVerificationCount) ||
    signatureVerificationCount < 0
  ) {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      "current-candidate execution counter returned an invalid value",
    );
  }
  return { pointAdmissionCount, signatureVerificationCount };
}

function countDeltaV1(
  counter: CapturedExecutionCounterV1,
  start: { readonly pointAdmissionCount: number; readonly signatureVerificationCount: number },
) {
  const end = readCountsV1(counter);
  const pointAdmissionCount = end.pointAdmissionCount - start.pointAdmissionCount;
  const signatureVerificationCount =
    end.signatureVerificationCount - start.signatureVerificationCount;
  if (pointAdmissionCount < 0 || signatureVerificationCount < 0) {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      "current-candidate execution counter moved backwards",
    );
  }
  return { pointAdmissionCount, signatureVerificationCount };
}

function sortedOwnStringKeysV1(value: object): string[] {
  const keys = CapturedReflectOwnKeysV1(value);
  const strings: string[] = [];
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]!;
    if (typeof key !== "string") {
      throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
        "current-candidate result contains a symbol key",
      );
    }
    strings.push(key);
  }
  strings.sort();
  return strings;
}

function lastHistoryEntryV1<T>(values: readonly T[]): T {
  const value = values[values.length - 1];
  if (value === undefined) {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      "current-candidate positive vector has an empty history",
    );
  }
  return value;
}

function assertPositiveResultV1(
  vector: ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1["positiveVectors"][number],
  value: ProviderDistributionHistoryCurrentCandidatePointValidationV1,
): void {
  assertRecursivelyFrozenFixtureV1(value);
  if (
    !canonicalEqualFixtureV1(
      sortedOwnStringKeysV1(value),
      vector.expected.successKeys,
    ) ||
    value.authority !== vector.expected.authority ||
    !canonicalEqualFixtureV1(
      value.publicSupportTaxonomyTip,
      lastHistoryEntryV1(vector.request.publicSupportTaxonomyHistory),
    ) ||
    !canonicalEqualFixtureV1(
      value.releaseMatrixTip,
      lastHistoryEntryV1(vector.request.releaseMatrixHistory),
    ) ||
    !canonicalEqualFixtureV1(
      value.targetDiscoveryResultTip,
      lastHistoryEntryV1(vector.request.targetDiscoveryResultHistory),
    ) ||
    !canonicalEqualFixtureV1(
      value.releaseTargetUniverseTip,
      lastHistoryEntryV1(vector.request.releaseTargetUniverseHistory),
    ) ||
    !canonicalEqualFixtureV1(
      value.providerFeasibilitySupportCatalogTip,
      lastHistoryEntryV1(
        vector.request.providerFeasibilitySupportCatalogHistory,
      ),
    ) ||
    !canonicalEqualFixtureV1(
      value.currentCatalogProjection,
      vector.expected.currentCatalogProjection,
    ) ||
    !canonicalEqualFixtureV1(
      projectProviderFeasibilitySupportCatalogPointFixtureClosureV1(
        value.catalogPointClosure,
      ),
      vector.expected.currentCatalogProjection,
    )
  ) {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      `${vector.vectorId} success projection drift`,
    );
  }
}

export async function verifyProviderDistributionHistoryCurrentCandidatePointPositiveVectorsV1(
  manifest: ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
  executionCounter: ProviderDistributionHistoryCurrentCandidatePointExecutionCounterV1,
): Promise<{
  readonly vectors: readonly {
    readonly vectorId: ProviderDistributionHistoryCurrentCandidatePointPositiveVectorIdV1;
    readonly value: ProviderDistributionHistoryCurrentCandidatePointValidationV1;
    readonly cryptoCounts: ProviderDistributionHistoryCurrentCandidatePointCryptoCountsV1;
  }[];
  readonly cryptoCounts: ProviderDistributionHistoryCurrentCandidatePointCryptoCountsV1;
}> {
  assertVerifiedGoldenManifestV1(manifest);
  const counter = captureExecutionCounterV1(executionCounter);
  const executions: Array<{
    readonly vectorId: ProviderDistributionHistoryCurrentCandidatePointPositiveVectorIdV1;
    readonly value: ProviderDistributionHistoryCurrentCandidatePointValidationV1;
    readonly cryptoCounts: ProviderDistributionHistoryCurrentCandidatePointCryptoCountsV1;
  }> = [];
  let aggregatePointAdmissionCount = 0;
  let aggregateSignatureVerificationCount = 0;
  for (let index = 0; index < manifest.positiveVectors.length; index += 1) {
    const vector = manifest.positiveVectors[index]!;
    const start = readCountsV1(counter);
    const value =
      await validateProviderDistributionHistoryCurrentCandidatePointV1(
        materializeProviderDistributionHistoryCurrentCandidatePointPositiveVectorRequestV1(
          manifest,
          vector.vectorId,
          strictCryptoCapability,
        ),
      );
    const counts = countDeltaV1(counter, start);
    assertPositiveResultV1(vector, value);
    if (!canonicalEqualFixtureV1(counts, vector.expected.cryptoCounts)) {
      throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
        `${vector.vectorId} crypto count drift`,
      );
    }
    aggregatePointAdmissionCount += counts.pointAdmissionCount;
    aggregateSignatureVerificationCount += counts.signatureVerificationCount;
    executions.push(
      deepFreezeFixtureValueV1({
        vectorId: vector.vectorId,
        value,
        cryptoCounts: counts,
      }),
    );
  }
  const cryptoCounts = {
    pointAdmissionCount: aggregatePointAdmissionCount,
    signatureVerificationCount: aggregateSignatureVerificationCount,
  };
  if (!canonicalEqualFixtureV1(cryptoCounts, manifest.aggregateCryptoCounts)) {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      "current-candidate aggregate positive crypto count drift",
    );
  }
  return deepFreezeFixtureValueV1({
    vectors: executions,
    cryptoCounts,
  });
}

function publicFailureProjectionV1(error: unknown) {
  if (
    !(error instanceof
      ProviderDistributionHistoryCurrentCandidatePointValidationError) ||
    !CapturedObjectIsFrozenV1(error) ||
    error.name !==
      "ProviderDistributionHistoryCurrentCandidatePointValidationError" ||
    error.code !== "provider_unavailable" ||
    error.reason !== "attestation_invalid"
  ) {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      "current-candidate public validator did not return its frozen opaque error",
    );
  }
  return {
    errorName: error.name,
    code: error.code,
    reason: error.reason,
  } as const;
}

export async function executeProviderDistributionHistoryCurrentCandidatePointInvalidCaseV1(
  goldenManifest: ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1,
  invalidManifest: ProviderDistributionHistoryCurrentCandidatePointInvalidManifestV1,
  caseId: ProviderDistributionHistoryCurrentCandidatePointInvalidCaseIdV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
  executionCounter: ProviderDistributionHistoryCurrentCandidatePointExecutionCounterV1,
): Promise<{
  readonly caseId: ProviderDistributionHistoryCurrentCandidatePointInvalidCaseIdV1;
  readonly stage: ProviderDistributionHistoryCurrentCandidatePointInvalidStageV1;
  readonly reason: ProviderDistributionHistoryCurrentCandidatePointInvalidReasonV1;
  readonly publicFailure: {
    readonly errorName: "ProviderDistributionHistoryCurrentCandidatePointValidationError";
    readonly code: "provider_unavailable";
    readonly reason: "attestation_invalid";
  };
  readonly cryptoCounts: ProviderDistributionHistoryCurrentCandidatePointCryptoCountsV1;
}> {
  assertVerifiedGoldenManifestV1(goldenManifest);
  assertVerifiedInvalidManifestV1(invalidManifest);
  const invalidCase = findInvalidCaseV1(invalidManifest, caseId);
  const counter = captureExecutionCounterV1(executionCounter);
  const start = readCountsV1(counter);
  const diagnostic =
    await diagnoseProviderDistributionHistoryCurrentCandidatePointV1(
      materializeProviderDistributionHistoryCurrentCandidatePointInvalidCaseRequestV1(
        goldenManifest,
        invalidManifest,
        caseId,
        strictCryptoCapability,
      ),
    );
  if (
    diagnostic.ok ||
    diagnostic.stage !== invalidCase.expected.stage ||
    diagnostic.reason !== invalidCase.expected.reason
  ) {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      `${caseId} diagnostic drift`,
    );
  }

  let publicFailure:
    | ReturnType<typeof publicFailureProjectionV1>
    | undefined;
  try {
    await validateProviderDistributionHistoryCurrentCandidatePointV1(
      materializeProviderDistributionHistoryCurrentCandidatePointInvalidCaseRequestV1(
        goldenManifest,
        invalidManifest,
        caseId,
        strictCryptoCapability,
      ),
    );
  } catch (error) {
    publicFailure = publicFailureProjectionV1(error);
  }
  if (publicFailure === undefined) {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      `${caseId} was unexpectedly accepted by the public validator`,
    );
  }
  const counts = countDeltaV1(counter, start);
  if (
    !canonicalEqualFixtureV1(publicFailure, invalidCase.expected.publicFailure) ||
    !canonicalEqualFixtureV1(counts, invalidCase.expected.cryptoCounts)
  ) {
    throw new ProviderDistributionHistoryCurrentCandidatePointFixtureError(
      `${caseId} public rejection or crypto count drift`,
    );
  }
  return deepFreezeFixtureValueV1({
    caseId,
    stage: diagnostic.stage,
    reason: diagnostic.reason,
    publicFailure,
    cryptoCounts: counts,
  });
}

CapturedObjectFreezeV1(
  deriveProviderDistributionHistoryCurrentCandidatePointFixtureSemanticContentDigestV1,
);
CapturedObjectFreezeV1(
  verifyProviderDistributionHistoryCurrentCandidatePointGoldenResourceV1,
);
CapturedObjectFreezeV1(
  verifyProviderDistributionHistoryCurrentCandidatePointInvalidResourceV1,
);
CapturedObjectFreezeV1(
  materializeProviderDistributionHistoryCurrentCandidatePointPositiveVectorRequestV1,
);
CapturedObjectFreezeV1(
  verifyProviderDistributionHistoryCurrentCandidatePointPositiveVectorsV1,
);
CapturedObjectFreezeV1(
  materializeProviderDistributionHistoryCurrentCandidatePointInvalidCaseRequestV1,
);
CapturedObjectFreezeV1(
  executeProviderDistributionHistoryCurrentCandidatePointInvalidCaseV1,
);
