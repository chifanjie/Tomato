import { z } from "./zod-runtime.js";

import { ProviderBootstrapTrustBundleV1Schema } from "./bootstrap-trust-bundle.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  ProviderFeasibilityApproverKeyIdV1Schema,
  ProviderFeasibilityEvidenceIdV1Schema,
  ProviderRegistryManifestGenerationIdV1Schema,
} from "./primitives.js";
import {
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_CASE_IDS_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_PATH_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_DOMAIN_V1,
  ProviderFeasibilityEvidencePointSnapshotProjectionV1Schema,
} from "./provider-feasibility-evidence-point-fixtures.js";
import {
  ProviderFeasibilityEvidenceEnvelopeV1Schema,
} from "./provider-feasibility-evidence-point.js";
import {
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
} from "./provider-real-filesystem-source-fixtures.js";
import {
  ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
  ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
} from "./provider-real-filesystem-source.js";
import {
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_MAX_CANONICAL_BYTES_V1,
  ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  ProviderRealFilesystemConformanceResultLocatorV1Schema,
  ProviderRealFilesystemConformanceResultPinV1Schema,
} from "./provider-real-filesystem-conformance-result.js";
import { ProviderSignedDistributionRootBindingV1Schema } from "./provider-distribution-trust.js";
import {
  PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1,
  ProviderRegistryEvidenceBindingPointClosureValidationError,
  ProviderRegistryEvidenceBindingPointInvalidReasonV1Schema,
  ProviderRegistryEvidenceBindingPointInvalidStageV1Schema,
  diagnoseProviderRegistryEvidenceBindingPointClosureV1,
  type ProviderRegistryEvidenceBindingPointClosureValidationV1,
  type ValidateProviderRegistryEvidenceBindingPointClosureV1Input,
} from "./provider-registry-evidence-binding-point.js";
import {
  discardProviderRegistryEvidenceBindingBudgetWitnessInternalV1,
  materializeProviderRegistryEvidenceBindingBudgetWitnessInternalV1,
  takeAndVerifyProviderRegistryEvidenceBindingBudgetReplayInternalV1,
} from "./provider-registry-evidence-binding-point-budget-witness-internal.js";
import {
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_DOMAIN_V1,
  type ProviderRegistryManifestHistoryInvalidCaseIdV1,
} from "./provider-registry-manifest-fixtures.js";
import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointFulfilledPromiseV1,
  createProviderPointRejectedPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  ProviderFeasibilityEvidencePinV1Schema,
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestGenesisPredecessorV1Schema,
  ProviderRegistryManifestSuccessorPredecessorV1Schema,
  StoreDurableObjectProviderRuntimeAttestationPinV1Schema,
} from "./provider-registry-records.js";
import {
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
} from "./provider-registry-root-history-fixtures.js";
import {
  ProviderRegistryRootMetadataEnvelopeV1Schema,
  ProviderRegistryRootMetadataPinV1Schema,
  ProviderRegistryRootPublicKeyV1Schema,
} from "./provider-registry-trust.js";
import { StoreDurableObjectProviderPolicyV1Schema } from "./provider-runtime-attestation-point.js";
import { sha256InternalV1 } from "./sha256.js";
import {
  ProviderPublicSupportTaxonomyEnvelopeV1Schema,
  ProviderReleaseMatrixEnvelopeV1Schema,
  ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema,
  ProviderTargetDiscoveryResultEnvelopeV1Schema,
  ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema,
} from "./provider-target-discovery-point.js";
import type { ProviderStrictEd25519OpaqueCapabilityV1 } from "./strict-ed25519-conformance.js";

export * from "./provider-registry-evidence-binding-topology-proof.js";

export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_PROFILE_V1 =
  "provider_registry_evidence_binding_point_golden_v1" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_SEMANTIC_DOMAIN_V1 =
  "provider-registry-evidence-binding-point-golden-manifest-v1" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_PATH_V1 =
  "fixtures/v1/golden/provider-registry-evidence-binding-point-v1.json" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1 =
  260_361 as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1 =
  "aae31cd1e79f928a1c3035cc8d9f0c2556a91466629605bf733607b69ff01fc3" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:17224d7b455f6102c6783401a2c56c30e8796a646ffa00525786e172194413df" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_FIXTURE_MAX_BYTES_V1 =
  1_048_576 as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_PROFILE_V1 =
  "provider_registry_evidence_binding_point_invalid_v1" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SEMANTIC_DOMAIN_V1 =
  "provider-registry-evidence-binding-point-invalid-manifest-v1" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1 =
  "provider-registry-evidence-binding-point-invalid-materialized-request-v1" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_AGGREGATE_DOMAIN_V1 =
  "provider-registry-evidence-binding-point-invalid-aggregate-v1" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_CASE_IDS_DOMAIN_V1 =
  "provider-registry-evidence-binding-point-invalid-shard-case-ids-v1" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_OUTCOMES_DOMAIN_V1 =
  "provider-registry-evidence-binding-point-invalid-shard-outcomes-v1" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_CRYPTO_DOMAIN_V1 =
  "provider-registry-evidence-binding-point-invalid-shard-crypto-v1" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RECIPE_DIALECT_V1 =
  "provider_registry_evidence_binding_point_invalid_recipe_v1" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_PATH_V1 =
  "fixtures/v1/invalid/provider-registry-evidence-binding-point-v1.json" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1 =
  15_937_614 as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_SHA256_HEX_V1 =
  "4805714748e530dbe9a0681bb2a8fd5f5990975c6ac03783367a0b188f08376c" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:a52e200a445a8b4633b05aa8556367767d041d67bc81b84775c98ec5df01ea20" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_AGGREGATE_CONTENT_DIGEST_V1 =
  "sha256:5fb94bd6465589d87cc86f46c8d3927f2dc14bb603edac82fa7e11eaef618c83" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_FIXTURE_MAX_BYTES_V1 =
  16_777_216 as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_SIZE_V1 =
  32 as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_MAX_WORKERS_V1 =
  4 as const;

const NATIVE_B_PROVIDER_ID_V1 =
  "durable-object-provider:native-b" as const;
const ROOT_3_SEED_HEX_V1 = "30".repeat(32);
const QA_APPROVER_SEED_HEX_V1 = "7b".repeat(32);
const RELEASE_APPROVER_SEED_HEX_V1 = "7c".repeat(32);
const EvenLowerHexV1Schema = z.string().regex(/^(?:[0-9a-f]{2})+$/u);
const PositiveSafeIntegerV1Schema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);

export const ProviderRegistryEvidenceBindingPointCompatibleBaseV1Schema =
  z.strictObject({
    activeRoot: ProviderRegistryRootPublicKeyV1Schema,
    activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
    bootstrapTrustBundle: ProviderBootstrapTrustBundleV1Schema,
    distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
    fixtureCorpusManifest:
      ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    providerFeasibilityEvidence:
      ProviderFeasibilityEvidenceEnvelopeV1Schema,
    providerFeasibilityEvidencePin: ProviderFeasibilityEvidencePinV1Schema,
    publicSupportTaxonomy: ProviderPublicSupportTaxonomyEnvelopeV1Schema,
    realFilesystemConformanceResult:
      ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
    realFilesystemConformanceResultLocator:
      ProviderRealFilesystemConformanceResultLocatorV1Schema,
    realFilesystemConformanceResultPin:
      ProviderRealFilesystemConformanceResultPinV1Schema,
    registryManifestHistory: z
      .array(ProviderRegistryManifestEnvelopeV1Schema)
      .length(7),
    releaseMatrix: ProviderReleaseMatrixEnvelopeV1Schema,
    rootMetadataHistory: z
      .array(ProviderRegistryRootMetadataEnvelopeV1Schema)
      .length(3),
    runtimeAttestation:
      StoreDurableObjectProviderRuntimeAttestationPinV1Schema,
    semanticProviderPolicy: StoreDurableObjectProviderPolicyV1Schema,
    suiteManifest: ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
    targetDiscoveryFixtureManifest:
      ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema,
    targetDiscoveryResult: ProviderTargetDiscoveryResultEnvelopeV1Schema,
    targetDiscoveryRunnerRun:
      ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema,
  });
export type ProviderRegistryEvidenceBindingPointCompatibleBaseV1 = z.infer<
  typeof ProviderRegistryEvidenceBindingPointCompatibleBaseV1Schema
>;

export const ProviderRegistryEvidenceBindingPointSuccessProjectionV1Schema =
  z.strictObject({
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    registryManifestContentDigest: ContentDigestV1Schema,
    candidateRegistryEntryContentDigest: ContentDigestV1Schema,
    providerId: z.literal(NATIVE_B_PROVIDER_ID_V1),
    runtimeAttestationContentDigest: ContentDigestV1Schema,
    evidenceId: ProviderFeasibilityEvidenceIdV1Schema,
    evidenceContentDigest: ContentDigestV1Schema,
    evidenceRelativePath: z
      .string()
      .regex(
        /^provider\/feasibility-evidence\/(?:id-[0-9a-v]+|idh-[0-9a-f]{64})\.json$/u,
      ),
    qaApproverKeyId: ProviderFeasibilityApproverKeyIdV1Schema,
    releaseApproverKeyId: ProviderFeasibilityApproverKeyIdV1Schema,
  });
export type ProviderRegistryEvidenceBindingPointSuccessProjectionV1 = z.infer<
  typeof ProviderRegistryEvidenceBindingPointSuccessProjectionV1Schema
>;

const ManifestGenerationDigest1V1Schema = z.strictObject({
  manifestGeneration: z.literal(1),
  generationId: ProviderRegistryManifestGenerationIdV1Schema,
  contentDigest: ContentDigestV1Schema,
  predecessor: ProviderRegistryManifestGenesisPredecessorV1Schema,
});
const ManifestGenerationDigest2V1Schema = z.strictObject({
  manifestGeneration: z.literal(2),
  generationId: ProviderRegistryManifestGenerationIdV1Schema,
  contentDigest: ContentDigestV1Schema,
  predecessor: ProviderRegistryManifestSuccessorPredecessorV1Schema,
});
const ManifestGenerationDigest3V1Schema = z.strictObject({
  manifestGeneration: z.literal(3),
  generationId: ProviderRegistryManifestGenerationIdV1Schema,
  contentDigest: ContentDigestV1Schema,
  predecessor: ProviderRegistryManifestSuccessorPredecessorV1Schema,
});
const ManifestGenerationDigest4V1Schema = z.strictObject({
  manifestGeneration: z.literal(4),
  generationId: ProviderRegistryManifestGenerationIdV1Schema,
  contentDigest: ContentDigestV1Schema,
  predecessor: ProviderRegistryManifestSuccessorPredecessorV1Schema,
});
const ManifestGenerationDigest5V1Schema = z.strictObject({
  manifestGeneration: z.literal(5),
  generationId: ProviderRegistryManifestGenerationIdV1Schema,
  contentDigest: ContentDigestV1Schema,
  predecessor: ProviderRegistryManifestSuccessorPredecessorV1Schema,
});
const ManifestGenerationDigest6V1Schema = z.strictObject({
  manifestGeneration: z.literal(6),
  generationId: ProviderRegistryManifestGenerationIdV1Schema,
  contentDigest: ContentDigestV1Schema,
  predecessor: ProviderRegistryManifestSuccessorPredecessorV1Schema,
});
const ManifestGenerationDigest7V1Schema = z.strictObject({
  manifestGeneration: z.literal(7),
  generationId: ProviderRegistryManifestGenerationIdV1Schema,
  contentDigest: ContentDigestV1Schema,
  predecessor: ProviderRegistryManifestSuccessorPredecessorV1Schema,
});

const DependencyAnchorV1Schema = z.strictObject({
  resourcePath: z.string().min(1),
  resourceByteLength: PositiveSafeIntegerV1Schema,
  resourceSha256Hex: z.string().regex(/^[0-9a-f]{64}$/u),
  semanticContentDigest: ContentDigestV1Schema,
});

const ProviderRegistryEvidenceBindingPointExpectedV1Schema = z.strictObject({
  providerId: z.literal(NATIVE_B_PROVIDER_ID_V1),
  registryManifestCount: z.literal(7),
  rootMetadataCount: z.literal(3),
  registryCryptoClosure: z.strictObject({
    pointAdmissionCount: z.literal(24),
    signatureVerificationCount: z.literal(38),
  }),
  completeCryptoClosure: z.strictObject({
    pointAdmissionCount: z.literal(24),
    signatureVerificationCount: z.literal(46),
  }),
  candidateRegistryEntryContentDigest: ContentDigestV1Schema,
  providerFeasibilityEvidenceId: ProviderFeasibilityEvidenceIdV1Schema,
  providerFeasibilityEvidenceContentDigest: ContentDigestV1Schema,
  qaApproverKeyId: ProviderFeasibilityApproverKeyIdV1Schema,
  releaseApproverKeyId: ProviderFeasibilityApproverKeyIdV1Schema,
  evidenceQaSignatureMessageUtf8Hex: EvenLowerHexV1Schema,
  evidenceReleaseSignatureMessageUtf8Hex: EvenLowerHexV1Schema,
  nativeBEntrySignatureMessageUtf8Hex: EvenLowerHexV1Schema,
  manifestGenerationDigests: z.tuple([
    ManifestGenerationDigest1V1Schema,
    ManifestGenerationDigest2V1Schema,
    ManifestGenerationDigest3V1Schema,
    ManifestGenerationDigest4V1Schema,
    ManifestGenerationDigest5V1Schema,
    ManifestGenerationDigest6V1Schema,
    ManifestGenerationDigest7V1Schema,
  ]),
  successProjection:
    ProviderRegistryEvidenceBindingPointSuccessProjectionV1Schema,
});

export const ProviderRegistryEvidenceBindingPointGoldenManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_PROFILE_V1,
    ),
    fixtureAuthority: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1,
    ),
    canonicalizationProfile: z.literal(
      "rfc8785-jcs-safe-integer-v1",
    ),
    verificationProfile: z.literal(
      "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
    ),
    deterministicSeeds: z.strictObject({
      purpose: z.literal("non_production_fixture_only"),
      root3SeedHex: z.literal(ROOT_3_SEED_HEX_V1),
      qaApproverSeedHex: z.literal(QA_APPROVER_SEED_HEX_V1),
      releaseApproverSeedHex: z.literal(RELEASE_APPROVER_SEED_HEX_V1),
    }),
    compatibleBase:
      ProviderRegistryEvidenceBindingPointCompatibleBaseV1Schema,
    expected: ProviderRegistryEvidenceBindingPointExpectedV1Schema,
    semanticDomain: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
    ),
    dependencies: z.strictObject({
      registryGolden: DependencyAnchorV1Schema.extend({
        resourcePath: z.literal(
          PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
        ),
        resourceByteLength: z.literal(
          PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
        ),
        resourceSha256Hex: z.literal(
          PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
        ),
        semanticContentDigest: z.literal(
          PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
        ),
      }),
      rootGolden: DependencyAnchorV1Schema.extend({
        resourcePath: z.literal(
          PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
        ),
        resourceByteLength: z.literal(
          PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
        ),
        resourceSha256Hex: z.literal(
          PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
        ),
        semanticContentDigest: z.literal(
          PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
        ),
      }),
      sourceGolden: DependencyAnchorV1Schema.extend({
        resourcePath: z.literal(
          PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
        ),
        resourceByteLength: z.literal(
          PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
        ),
        resourceSha256Hex: z.literal(
          PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_SHA256_HEX_V1,
        ),
        semanticContentDigest: z.literal(
          PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
        ),
      }),
    }),
    semanticContentDigest: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    ),
  });
export type ProviderRegistryEvidenceBindingPointGoldenManifestV1 = z.infer<
  typeof ProviderRegistryEvidenceBindingPointGoldenManifestV1Schema
>;

/**
 * D-37 point-local cases.  The inherited Evidence and Registry case IDs are
 * composed below; keeping this list literal makes additions reviewable while
 * every count remains derived from the actual inventory.
 */
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_POINT_SPECIFIC_INVALID_CASE_IDS_V1 =
  Object.freeze([
    "point-positive-genesis-entry-passed",
    "point-positive-historical-unrevoked-approver",
    "point-positive-runtime-evidence-entry-successor",
    "point-bootstrap-bundle-pin-mismatch",
    "point-bootstrap-bundle-schema-invalid",
    "point-candidate-root-record-mismatch",
    "point-candidate-identity-mismatch",
    "point-routing-migration-tip",
    "point-provider-absent",
    "point-provider-tombstone",
    "point-entry-evidence-pin-substitution",
    "point-entry-runtime-pin-substitution",
    "point-entry-policy-digest-substitution",
    "point-entry-successor-stale-evidence-pin",
    "point-valid-resign-result-cross-mismatch",
    "point-failed-production-result",
    "point-unsupported-production-result",
    "point-qa-unknown-signer",
    "point-release-unknown-signer",
    "point-qa-revoked-historical-signer",
    "point-release-revoked-historical-signer",
    "point-qa-wrong-role-signer",
    "point-release-wrong-role-signer",
    "point-hostile-top-level-proxy",
    "point-cross-history-alias",
    "point-after-start-evidence-mutation",
    "point-after-start-history-mutation",
    "point-promise-poison",
    "point-budget-value-b",
    "point-budget-value-b-plus-one",
    "point-budget-key-b",
    "point-budget-key-b-plus-one",
    "point-budget-history-bh",
    "point-budget-history-bh-plus-one",
    "point-budget-identities-c",
    "point-budget-identities-c-plus-one",
    "point-budget-work-w",
    "point-budget-work-w-plus-one",
  ] as const);
export type ProviderRegistryEvidenceBindingPointPointSpecificInvalidCaseIdV1 =
  (typeof PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_POINT_SPECIFIC_INVALID_CASE_IDS_V1)[number];

const EVIDENCE_INHERITED_INVALID_CASE_IDS_V1 = Object.freeze(
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_CASE_IDS_V1.map(
    (caseId) => `evidence-${caseId}` as const,
  ),
);
const REGISTRY_INHERITED_INVALID_CASE_IDS_V1 = Object.freeze(
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1.map(
    (caseId) => `registry-${caseId}` as const,
  ),
) as readonly `registry-${ProviderRegistryManifestHistoryInvalidCaseIdV1}`[];
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_CASE_IDS_V1 =
  Object.freeze([
    ...EVIDENCE_INHERITED_INVALID_CASE_IDS_V1,
    ...REGISTRY_INHERITED_INVALID_CASE_IDS_V1,
    ...PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_POINT_SPECIFIC_INVALID_CASE_IDS_V1,
  ]);
export type ProviderRegistryEvidenceBindingPointInvalidCaseIdV1 =
  (typeof PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_CASE_IDS_V1)[number];

const NonnegativeSafeIntegerV1Schema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
const SourceResourceAnchorV1Schema = z.strictObject({
  resourcePath: z.string().min(1),
  resourceByteLength: PositiveSafeIntegerV1Schema,
  resourceSha256Hex: z.string().regex(/^[0-9a-f]{64}$/u),
  semanticDomain: z.string().min(1),
  semanticContentDigest: ContentDigestV1Schema,
});
const SourceDiagnosticExpectedV1Schema = z.strictObject({
  kind: z.literal("diagnostic"),
  stage: z.string().min(1),
  reason: z.string().min(1),
  pointAdmissionCount: NonnegativeSafeIntegerV1Schema,
  signatureVerificationCount: NonnegativeSafeIntegerV1Schema,
  materializedRequestSemanticDigest: ContentDigestV1Schema,
});
const SourceAcceptedExpectedCommonV1Shape = {
  kind: z.literal("accepted_snapshot"),
  boundary: z.literal("snapshot_stability"),
  outcome: z.literal("accepted_frozen_snapshot"),
  pointAdmissionCount: NonnegativeSafeIntegerV1Schema,
  signatureVerificationCount: NonnegativeSafeIntegerV1Schema,
  materializedRequestSemanticDigest: ContentDigestV1Schema,
} as const;
const EvidenceSourceAcceptedExpectedV1Schema = z.strictObject({
  ...SourceAcceptedExpectedCommonV1Shape,
  authority: z.literal("none_provider_feasibility_evidence_structure_only"),
  snapshotProjection:
    ProviderFeasibilityEvidencePointSnapshotProjectionV1Schema,
});
const RegistryEvidenceBindingSourceAcceptedExpectedV1Schema = z.strictObject({
  ...SourceAcceptedExpectedCommonV1Shape,
  authority: z.literal(PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1),
  snapshotProjection:
    ProviderRegistryEvidenceBindingPointSuccessProjectionV1Schema,
});
const SourceExpectedV1Schema = z.union([
  SourceDiagnosticExpectedV1Schema,
  EvidenceSourceAcceptedExpectedV1Schema,
  RegistryEvidenceBindingSourceAcceptedExpectedV1Schema,
]);
const OuterDiagnosticExpectedV1Schema = z.strictObject({
  kind: z.literal("diagnostic"),
  stage: ProviderRegistryEvidenceBindingPointInvalidStageV1Schema,
  reason: ProviderRegistryEvidenceBindingPointInvalidReasonV1Schema,
  pointAdmissionCount: NonnegativeSafeIntegerV1Schema,
  signatureVerificationCount: NonnegativeSafeIntegerV1Schema,
  materializedRequestSemanticDigest: ContentDigestV1Schema,
});
const OuterAcceptedExpectedV1Schema = z.strictObject({
  kind: z.literal("accepted_snapshot"),
  boundary: z.literal("snapshot_stability"),
  outcome: z.literal("accepted_frozen_snapshot"),
  authority: z.literal(PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1),
  snapshotProjection:
    ProviderRegistryEvidenceBindingPointSuccessProjectionV1Schema,
  pointAdmissionCount: NonnegativeSafeIntegerV1Schema,
  signatureVerificationCount: NonnegativeSafeIntegerV1Schema,
  materializedRequestSemanticDigest: ContentDigestV1Schema,
  topologyRationale: z.string().min(1),
});
const OuterExpectedV1Schema = z.discriminatedUnion("kind", [
  OuterDiagnosticExpectedV1Schema,
  OuterAcceptedExpectedV1Schema,
]);

const EvidenceSourceCaseIdV1Schema = z.enum(
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_CASE_IDS_V1 as unknown as [
    string,
    ...string[],
  ],
);
const RegistrySourceCaseIdV1Schema = z.enum(
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1 as unknown as [
    string,
    ...string[],
  ],
);
const EVIDENCE_ADAPTER_SOURCE_RECIPE_KINDS_V1 = [
  "runtime_inherited",
  "evidence_direct",
  "registry_approver_history",
  "evidence_unsigned_reanchor",
  "evidence_signature_reanchor",
  "evidence_direct_registry_reanchor",
] as const;
const POINT_HOSTILE_ADAPTER_PROFILE_IDS_V1 = [
  "extra_field",
  "plain_validation_dto",
  "top_level_proxy",
  "nested_proxy",
  "top_level_getter",
  "nested_getter",
  "top_level_hidden",
  "nested_hidden",
  "top_level_symbol",
  "nested_symbol",
  "sparse_array",
  "cycle",
  "alias",
  "evidence_async_mutation",
  "pin_async_mutation",
  "qa_key_async_mutation",
  "release_key_async_mutation",
] as const;
const EvidenceAdapterSourceRecipeCommonV1Shape = {
  sourceResourcePath: z.literal(
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_PATH_V1,
  ),
  sourceIndex: NonnegativeSafeIntegerV1Schema,
  sourceCaseId: EvidenceSourceCaseIdV1Schema,
  sourceOperation: EvidenceSourceCaseIdV1Schema,
  adapterOperation: z.string().min(1),
} as const;
const EvidenceAdapterSourceRecipeV1Schema = z.strictObject({
  kind: z.enum(EVIDENCE_ADAPTER_SOURCE_RECIPE_KINDS_V1),
  ...EvidenceAdapterSourceRecipeCommonV1Shape,
});
const PointHostileEvidenceAdapterSourceRecipeV1Schema = z.strictObject({
  kind: z.literal("point_hostile"),
  ...EvidenceAdapterSourceRecipeCommonV1Shape,
  adapterProfile: z.enum(POINT_HOSTILE_ADAPTER_PROFILE_IDS_V1),
});

const RegistryAdapterSourceRecipeV1Schema = z.strictObject({
  kind: z.enum([
    "registry_manifest_history",
    "outer_extra_field",
    "outer_missing_installation_identity",
    "outer_installation_identity",
  ]),
  sourceResourcePath: z.literal(
    PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_PATH_V1,
  ),
  sourceIndex: NonnegativeSafeIntegerV1Schema,
  sourceCaseId: RegistrySourceCaseIdV1Schema,
  sourceOperation: RegistrySourceCaseIdV1Schema,
  targetJsonPointer: z.string(),
  operands: z.array(z.string().min(1)).max(2),
});

function pointSourceProfileV1(caseId: string): string {
  return caseId.slice("point-".length).replace(/-/gu, "_");
}
const POINT_SPECIFIC_SOURCE_PROFILE_IDS_V1 = Object.freeze(
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_POINT_SPECIFIC_INVALID_CASE_IDS_V1
    .filter((caseId) => !caseId.startsWith("point-budget-"))
    .map(pointSourceProfileV1),
);
const POINT_SYMBOLIC_BUDGET_SOURCE_PROFILE_IDS_V1 = Object.freeze(
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_POINT_SPECIFIC_INVALID_CASE_IDS_V1
    .filter((caseId) => caseId.startsWith("point-budget-"))
    .map(pointSourceProfileV1),
);
const PointSpecificSourceRecipeV1Schema = z.strictObject({
  kind: z.literal("point_specific"),
  profile: z.enum(
    POINT_SPECIFIC_SOURCE_PROFILE_IDS_V1 as unknown as [string, ...string[]],
  ),
});
const PointSymbolicBudgetSourceRecipeV1Schema = z.strictObject({
  kind: z.literal("point_symbolic_budget"),
  profile: z.enum(
    POINT_SYMBOLIC_BUDGET_SOURCE_PROFILE_IDS_V1 as unknown as [
      string,
      ...string[],
    ],
  ),
});
const InvalidSourceRecipeV1Schema = z.union([
  EvidenceAdapterSourceRecipeV1Schema,
  PointHostileEvidenceAdapterSourceRecipeV1Schema,
  RegistryAdapterSourceRecipeV1Schema,
  PointSpecificSourceRecipeV1Schema,
  PointSymbolicBudgetSourceRecipeV1Schema,
]);

const REQUEST_PATCH_SET_FIELD_KEYS_V1 = Object.freeze([
  "activeRoot",
  "bootstrapTrustBundle",
  "callerPath",
  "distributionRootBinding",
  "installationIdentityGenerationId",
  "providerFeasibilityEvidence",
  "providerFeasibilityEvidencePin",
  "realFilesystemConformanceResult",
  "realFilesystemConformanceResultLocator",
  "realFilesystemConformanceResultPin",
  "registryManifestHistory",
  "runtimeAttestation",
  "semanticProviderPolicy",
  "suiteManifest",
  "targetDiscoveryPoint",
  "unexpected",
] as const);
const RequestPatchSetFieldsV1Schema = z.strictObject(
  Object.fromEntries(
    REQUEST_PATCH_SET_FIELD_KEYS_V1.map((fieldName) => [
      fieldName,
      z.unknown().optional(),
    ]),
  ) as {
    [K in (typeof REQUEST_PATCH_SET_FIELD_KEYS_V1)[number]]: z.ZodOptional<z.ZodUnknown>;
  },
);
const EmptySetFieldsV1Schema = z.strictObject({});
const EmptyDeleteFieldsV1Schema = z.array(z.never()).length(0);
const RequestPatchDeleteFieldsV1Schema = z.union([
  EmptyDeleteFieldsV1Schema,
  z.tuple([z.literal("installationIdentityGenerationId")]),
]);
const EXECUTION_PROFILE_IDS_V1 = [
  "runtime-inner-result-envelope-16mib-plus-one",
  "runtime-inner-locator-envelope-substitution",
  "runtime-inner-security-top-level-proxy",
  "runtime-inner-security-nested-proxy",
  "runtime-inner-security-top-level-getter",
  "runtime-inner-security-nested-getter",
  "runtime-inner-security-nested-hidden",
  "runtime-inner-security-nested-symbol",
  "runtime-inner-security-sparse-array",
  "runtime-inner-security-cycle",
  "runtime-inner-security-alias",
  "runtime-inner-security-async-mutation",
  "runtime-runtime-generation-fractional",
  "runtime-runtime-generation-unsafe",
  "runtime-point-input-extra-field",
  "runtime-point-input-plain-validation-dto",
  "runtime-point-security-top-level-proxy",
  "runtime-point-security-nested-proxy",
  "runtime-point-security-top-level-getter",
  "runtime-point-security-nested-getter",
  "runtime-point-security-top-level-hidden",
  "runtime-point-security-nested-hidden",
  "runtime-point-security-top-level-symbol",
  "runtime-point-security-nested-symbol",
  "runtime-point-security-sparse-array",
  "runtime-point-security-cycle",
  "runtime-point-security-alias",
  "runtime-point-security-async-mutation",
  "point-input-extra-field",
  "point-input-plain-validation-dto",
  "point-security-top-level-proxy",
  "point-security-nested-proxy",
  "point-security-top-level-getter",
  "point-security-nested-getter",
  "point-security-top-level-hidden",
  "point-security-nested-hidden",
  "point-security-top-level-symbol",
  "point-security-nested-symbol",
  "point-security-sparse-array",
  "point-security-cycle",
  "point-security-alias",
  "point-security-evidence-async-mutation",
  "point-security-pin-async-mutation",
  "point-security-qa-key-async-mutation",
  "point-security-release-key-async-mutation",
  "registry-history-sparse-array",
  "hostile_top_level_proxy",
  "cross_history_alias",
  "after_start_evidence_mutation",
  "after_start_history_mutation",
  "promise_poison",
] as const;

const RequestPatchRecipeV1Schema = z.strictObject({
  kind: z.literal("request_patch"),
  setFields: RequestPatchSetFieldsV1Schema,
  deleteFields: RequestPatchDeleteFieldsV1Schema,
});
const ExecutionProfileRecipeV1Schema = z.strictObject({
  kind: z.literal("execution_profile"),
  profile: z.enum(EXECUTION_PROFILE_IDS_V1),
  setFields: EmptySetFieldsV1Schema,
  deleteFields: EmptyDeleteFieldsV1Schema,
});
const SymbolicBudgetRecipeV1Schema = z.strictObject({
  kind: z.literal("symbolic_budget"),
  budget: z.enum([
    "history_count",
    "value_b",
    "key_b",
    "history_bh",
    "identities_c",
    "work_w",
  ]),
  relation: z.enum(["equal", "plus_one"]),
  witness: z.literal("runtime_compact_production_counter_v1"),
});
const InvalidWitnessRecipeV1Schema = z.discriminatedUnion("kind", [
  RequestPatchRecipeV1Schema,
  ExecutionProfileRecipeV1Schema,
  SymbolicBudgetRecipeV1Schema,
]);

const InvalidMutationV1Schema = z.strictObject({
  dialect: z.literal(
    PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RECIPE_DIALECT_V1,
  ),
  operation: z.string().min(1),
  sourceRecipe: InvalidSourceRecipeV1Schema,
  witnessRecipe: InvalidWitnessRecipeV1Schema,
});

const ProviderRegistryEvidenceBindingPointInvalidCaseV1Schema =
  z.strictObject({
    sourceResource: SourceResourceAnchorV1Schema,
    sourceIndex: NonnegativeSafeIntegerV1Schema,
    sourceCaseId: z.string().min(1),
    sourceOperation: z.string().min(1),
    sourceExpected: SourceExpectedV1Schema,
    caseId: z.string().min(1),
    group: z.enum([
      "provider_feasibility_evidence_point",
      "provider_registry_manifest_history",
      "provider_registry_evidence_binding_point",
    ]),
    mutation: InvalidMutationV1Schema,
    outerExpected: OuterExpectedV1Schema,
  });
export type ProviderRegistryEvidenceBindingPointInvalidCaseV1 = z.infer<
  typeof ProviderRegistryEvidenceBindingPointInvalidCaseV1Schema
>;

const InvalidCaseIdsTupleV1Schema = z.tuple(
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_CASE_IDS_V1.map(
    (caseId) => z.literal(caseId),
  ) as unknown as [z.ZodLiteral<string>, ...z.ZodLiteral<string>[]],
) as unknown as z.ZodType<
  ProviderRegistryEvidenceBindingPointInvalidCaseIdV1[]
>;
const InvalidCasesTupleV1Schema = z.tuple(
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_CASE_IDS_V1.map(
    (caseId) =>
      ProviderRegistryEvidenceBindingPointInvalidCaseV1Schema.extend({
        caseId: z.literal(caseId),
        mutation: InvalidMutationV1Schema.extend({
          operation: z.literal(caseId),
        }),
      }),
  ) as unknown as [z.ZodTypeAny, ...z.ZodTypeAny[]],
) as unknown as z.ZodType<
  ProviderRegistryEvidenceBindingPointInvalidCaseV1[]
>;

const InvalidShardV1Schema = z.strictObject({
  shardIndex: NonnegativeSafeIntegerV1Schema,
  startCaseIndex: NonnegativeSafeIntegerV1Schema,
  endCaseIndexExclusive: PositiveSafeIntegerV1Schema,
  caseCount: PositiveSafeIntegerV1Schema,
  caseIdsContentDigest: ContentDigestV1Schema,
  expectedOutcomesContentDigest: ContentDigestV1Schema,
  cryptoCountsContentDigest: ContentDigestV1Schema,
});
const InvalidStageCoverageV1Schema = z.strictObject({
  stage: ProviderRegistryEvidenceBindingPointInvalidStageV1Schema,
  traversedBySuccess: z.literal(true),
  successWitnessCaseId: z.string().min(1),
  reachableRejection: z.boolean(),
  rejectionCaseIds: z.array(z.string().min(1)),
  unreachableRejections: z.array(
    z.strictObject({
      reason: ProviderRegistryEvidenceBindingPointInvalidReasonV1Schema,
      rationale: z.string().min(1),
    }),
  ),
  reachabilityRationale: z.string().min(1),
});

export const ProviderRegistryEvidenceBindingPointInvalidManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_PROFILE_V1,
    ),
    fixtureAuthority: z.literal("none_fixture_replay_only"),
    canonicalizationProfile: z.literal("rfc8785-jcs-safe-integer-v1"),
    verificationProfile: z.literal(
      "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
    ),
    semanticDomain: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SEMANTIC_DOMAIN_V1,
    ),
    materializedRequestSemanticDomain: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
    ),
    aggregateSemanticDomain: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_AGGREGATE_DOMAIN_V1,
    ),
    goldenDependency: SourceResourceAnchorV1Schema,
    evidenceInvalidDependency: SourceResourceAnchorV1Schema,
    registryInvalidDependency: SourceResourceAnchorV1Schema,
    adapterTables: z.strictObject({
      evidenceCaseCount: z.literal(
        PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_CASE_IDS_V1.length,
      ),
      evidenceSemanticContentDigest: ContentDigestV1Schema,
      registryCaseCount: z.literal(
        PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1.length,
      ),
      registrySemanticContentDigest: ContentDigestV1Schema,
    }),
    mutationRecipeDialect: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RECIPE_DIALECT_V1,
    ),
    inheritedEvidenceCaseCount: z.literal(
      EVIDENCE_INHERITED_INVALID_CASE_IDS_V1.length,
    ),
    inheritedRegistryCaseCount: z.literal(
      REGISTRY_INHERITED_INVALID_CASE_IDS_V1.length,
    ),
    pointSpecificCaseCount: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_POINT_SPECIFIC_INVALID_CASE_IDS_V1.length,
    ),
    caseCount: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_CASE_IDS_V1.length,
    ),
    shardSize: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_SIZE_V1,
    ),
    maxWorkers: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_MAX_WORKERS_V1,
    ),
    caseIds: InvalidCaseIdsTupleV1Schema,
    cases: InvalidCasesTupleV1Schema,
    stageCoverage: z.array(InvalidStageCoverageV1Schema).length(
      ProviderRegistryEvidenceBindingPointInvalidStageV1Schema.options.length,
    ),
    shards: z.array(InvalidShardV1Schema).min(1),
    aggregateContentDigest: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_AGGREGATE_CONTENT_DIGEST_V1,
    ),
    semanticContentDigest: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
    ),
  });
export type ProviderRegistryEvidenceBindingPointInvalidManifestV1 = z.infer<
  typeof ProviderRegistryEvidenceBindingPointInvalidManifestV1Schema
>;

function jsonCloneV1<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function bytesToLowerHexV1(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function rawSha256HexV1(bytes: Uint8Array): string {
  return bytesToLowerHexV1(sha256InternalV1(bytes));
}

function semanticDigestV1(domain: string, value: object): string {
  return `sha256:${rawSha256HexV1(
    canonicalizeJcsSafeIntegerUtf8V1([domain, value]),
  )}`;
}

function parseJsonResourceV1(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes),
    );
  } catch {
    throw new ProviderRegistryEvidenceBindingPointFixtureError(
      "provider Registry Entry/Evidence binding golden is not strict UTF-8 JSON",
    );
  }
}

function deepFreezeJsonV1<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreezeJsonV1(child);
    Object.freeze(value);
  }
  return value;
}

export class ProviderRegistryEvidenceBindingPointFixtureError extends TypeError {}

export function verifyProviderRegistryEvidenceBindingPointGoldenResourceV1(
  bytes: Uint8Array,
): ProviderRegistryEvidenceBindingPointGoldenManifestV1 {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength >
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_FIXTURE_MAX_BYTES_V1 ||
    bytes.byteLength !==
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1 ||
    rawSha256HexV1(bytes) !==
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1
  ) {
    throw new ProviderRegistryEvidenceBindingPointFixtureError(
      "provider Registry Entry/Evidence binding golden bytes do not match the immutable anchor",
    );
  }
  let manifest: ProviderRegistryEvidenceBindingPointGoldenManifestV1;
  try {
    manifest = ProviderRegistryEvidenceBindingPointGoldenManifestV1Schema.parse(
      parseJsonResourceV1(bytes),
    );
  } catch (error) {
    if (error instanceof ProviderRegistryEvidenceBindingPointFixtureError) {
      throw error;
    }
    throw new ProviderRegistryEvidenceBindingPointFixtureError(
      "provider Registry Entry/Evidence binding golden schema is invalid",
    );
  }
  const {
    semanticContentDigest: _semanticContentDigest,
    ...semanticFields
  } = manifest;
  if (
    semanticDigestV1(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
      semanticFields,
    ) !== manifest.semanticContentDigest
  ) {
    throw new ProviderRegistryEvidenceBindingPointFixtureError(
      "provider Registry Entry/Evidence binding golden semantic digest mismatch",
    );
  }
  return deepFreezeJsonV1(manifest);
}

export function materializeProviderRegistryEvidenceBindingPointGoldenRequestV1(
  manifest: ProviderRegistryEvidenceBindingPointGoldenManifestV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): ValidateProviderRegistryEvidenceBindingPointClosureV1Input {
  const fields = jsonCloneV1(manifest.compatibleBase);
  return {
    activeRoot: fields.activeRoot,
    activeRootMetadata: fields.activeRootMetadata,
    bootstrapTrustBundle: fields.bootstrapTrustBundle,
    distributionRootBinding: fields.distributionRootBinding,
    fixtureCorpusManifest: fields.fixtureCorpusManifest,
    installationIdentityGenerationId:
      fields.installationIdentityGenerationId,
    providerFeasibilityEvidence: fields.providerFeasibilityEvidence,
    providerFeasibilityEvidencePin: fields.providerFeasibilityEvidencePin,
    publicSupportTaxonomy: fields.publicSupportTaxonomy,
    realFilesystemConformanceResult:
      fields.realFilesystemConformanceResult,
    realFilesystemConformanceResultLocator:
      fields.realFilesystemConformanceResultLocator,
    realFilesystemConformanceResultPin:
      fields.realFilesystemConformanceResultPin,
    registryManifestHistory: fields.registryManifestHistory,
    releaseMatrix: fields.releaseMatrix,
    rootMetadataHistory: fields.rootMetadataHistory,
    runtimeAttestation: fields.runtimeAttestation,
    semanticProviderPolicy: fields.semanticProviderPolicy,
    strictCryptoCapability,
    suiteManifest: fields.suiteManifest,
    targetDiscoveryFixtureManifest:
      fields.targetDiscoveryFixtureManifest,
    targetDiscoveryResult: fields.targetDiscoveryResult,
    targetDiscoveryRunnerRun: fields.targetDiscoveryRunnerRun,
  };
}

export function projectProviderRegistryEvidenceBindingPointClosureSnapshotV1(
  closure: ProviderRegistryEvidenceBindingPointClosureValidationV1,
): ProviderRegistryEvidenceBindingPointSuccessProjectionV1 {
  return deepFreezeJsonV1(
    ProviderRegistryEvidenceBindingPointSuccessProjectionV1Schema.parse({
      installationIdentityGenerationId:
        closure.registryManifestHistoryClosure
          .installationIdentityGenerationId,
      registryManifestContentDigest:
        closure.registryManifestHistoryClosure.currentRegistryManifest
          .contentDigest,
      candidateRegistryEntryContentDigest:
        closure.candidateRegistryEntryContentDigest,
      providerId: closure.candidateRegistryEntry.providerId,
      runtimeAttestationContentDigest:
        closure.runtimeAttestationPointClosure.runtimeAttestation
          .contentDigest,
      evidenceId: closure.providerFeasibilityEvidence.evidenceId,
      evidenceContentDigest:
        closure.providerFeasibilityEvidence.contentDigest,
      evidenceRelativePath: closure.relativePath,
      qaApproverKeyId: closure.qaApproverPublicKey.keyId,
      releaseApproverKeyId: closure.releaseApproverPublicKey.keyId,
    }),
  );
}

function invalidSourceAnchorV1(
  resourcePath: string,
  resourceByteLength: number,
  resourceSha256Hex: string,
  semanticDomain: string,
  semanticContentDigest: string,
): Readonly<{
  resourcePath: string;
  resourceByteLength: number;
  resourceSha256Hex: string;
  semanticDomain: string;
  semanticContentDigest: string;
}> {
  return Object.freeze({
    resourcePath,
    resourceByteLength,
    resourceSha256Hex,
    semanticDomain,
    semanticContentDigest,
  });
}

const INVALID_GOLDEN_SOURCE_ANCHOR_V1 = invalidSourceAnchorV1(
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
);
const INVALID_EVIDENCE_SOURCE_ANCHOR_V1 = invalidSourceAnchorV1(
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_PATH_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_DOMAIN_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
);
const INVALID_REGISTRY_SOURCE_ANCHOR_V1 = invalidSourceAnchorV1(
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_DOMAIN_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
);

function canonicalJsonEqualV1(left: unknown, right: unknown): boolean {
  try {
    return (
      bytesToLowerHexV1(canonicalizeJcsSafeIntegerUtf8V1(left)) ===
      bytesToLowerHexV1(canonicalizeJcsSafeIntegerUtf8V1(right))
    );
  } catch {
    return false;
  }
}

interface BudgetCaseExpectationV1 {
  readonly budget:
    | "history_count"
    | "value_b"
    | "key_b"
    | "history_bh"
    | "identities_c"
    | "work_w";
  readonly relation: "equal" | "plus_one";
}

function budgetCaseExpectationV1(
  caseId: string,
): BudgetCaseExpectationV1 | undefined {
  switch (caseId) {
    case "registry-history-count-cap-4097":
      return { budget: "history_count", relation: "plus_one" };
    case "registry-single-envelope-byte-cap":
      return { budget: "value_b", relation: "plus_one" };
    case "registry-total-history-byte-cap":
      return { budget: "history_bh", relation: "plus_one" };
    case "point-budget-value-b":
      return { budget: "value_b", relation: "equal" };
    case "point-budget-value-b-plus-one":
      return { budget: "value_b", relation: "plus_one" };
    case "point-budget-key-b":
      return { budget: "key_b", relation: "equal" };
    case "point-budget-key-b-plus-one":
      return { budget: "key_b", relation: "plus_one" };
    case "point-budget-history-bh":
      return { budget: "history_bh", relation: "equal" };
    case "point-budget-history-bh-plus-one":
      return { budget: "history_bh", relation: "plus_one" };
    case "point-budget-identities-c":
      return { budget: "identities_c", relation: "equal" };
    case "point-budget-identities-c-plus-one":
      return { budget: "identities_c", relation: "plus_one" };
    case "point-budget-work-w":
      return { budget: "work_w", relation: "equal" };
    case "point-budget-work-w-plus-one":
      return { budget: "work_w", relation: "plus_one" };
    default:
      return undefined;
  }
}

function verifyBudgetCaseInventoryV1(
  invalidCase: ProviderRegistryEvidenceBindingPointInvalidCaseV1,
): boolean {
  const expected = budgetCaseExpectationV1(invalidCase.caseId);
  const recipe = invalidCase.mutation.witnessRecipe;
  if (expected === undefined) {
    if (recipe.kind === "symbolic_budget") {
      throw new ProviderRegistryEvidenceBindingPointFixtureError(
        `${invalidCase.caseId} is an unexpected symbolic budget witness`,
      );
    }
    return false;
  }
  if (
    recipe.kind !== "symbolic_budget" ||
    recipe.budget !== expected.budget ||
    recipe.relation !== expected.relation
  ) {
    throw new ProviderRegistryEvidenceBindingPointFixtureError(
      `${invalidCase.caseId} lost its exact production budget recipe`,
    );
  }
  const shouldAccept =
    expected.relation === "equal" &&
    (expected.budget === "identities_c" || expected.budget === "work_w");
  if (shouldAccept) {
    if (
      invalidCase.outerExpected.kind !== "accepted_snapshot" ||
      invalidCase.outerExpected.pointAdmissionCount !== 24 ||
      invalidCase.outerExpected.signatureVerificationCount !== 46 ||
      invalidCase.sourceExpected.kind !== "accepted_snapshot" ||
      invalidCase.outerExpected.authority !== invalidCase.sourceExpected.authority ||
      !canonicalJsonEqualV1(
        invalidCase.outerExpected.snapshotProjection,
        invalidCase.sourceExpected.snapshotProjection,
      )
    ) {
      throw new ProviderRegistryEvidenceBindingPointFixtureError(
        `${invalidCase.caseId} equal-cap witness did not retain the golden 24/46 closure`,
      );
    }
  } else if (
    invalidCase.outerExpected.kind !== "diagnostic" ||
    invalidCase.outerExpected.stage !== "input" ||
    invalidCase.outerExpected.reason !== "schema_invalid" ||
    invalidCase.outerExpected.pointAdmissionCount !== 0 ||
    invalidCase.outerExpected.signatureVerificationCount !== 0
  ) {
    throw new ProviderRegistryEvidenceBindingPointFixtureError(
      `${invalidCase.caseId} budget overflow/sentinel witness is not input/schema_invalid 0/0`,
    );
  }
  return true;
}

function verifyInvalidCaseInventoryV1(
  manifest: ProviderRegistryEvidenceBindingPointInvalidManifestV1,
): void {
  const evidenceCount = EVIDENCE_INHERITED_INVALID_CASE_IDS_V1.length;
  const registryCount = REGISTRY_INHERITED_INVALID_CASE_IDS_V1.length;
  let inheritedAcceptedCount = 0;
  let budgetCaseCount = 0;
  for (
    let index = 0;
    index < PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_CASE_IDS_V1.length;
    index += 1
  ) {
    const expectedCaseId =
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_CASE_IDS_V1[index];
    const invalidCase = manifest.cases[index];
    if (
      expectedCaseId === undefined ||
      invalidCase === undefined ||
      manifest.caseIds[index] !== expectedCaseId ||
      invalidCase.caseId !== expectedCaseId ||
      invalidCase.mutation.operation !== expectedCaseId
    ) {
      throw new ProviderRegistryEvidenceBindingPointFixtureError(
        `provider Registry Entry/Evidence binding invalid row ${index} is not the exact ordered inventory`,
      );
    }
    if (verifyBudgetCaseInventoryV1(invalidCase)) budgetCaseCount += 1;
    if (index < evidenceCount) {
      const sourceCaseId =
        PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_CASE_IDS_V1[index];
      if (
        sourceCaseId === undefined ||
        invalidCase.group !== "provider_feasibility_evidence_point" ||
        invalidCase.sourceIndex !== index ||
        invalidCase.sourceCaseId !== sourceCaseId ||
        invalidCase.sourceOperation !== sourceCaseId ||
        !canonicalJsonEqualV1(
          invalidCase.sourceResource,
          INVALID_EVIDENCE_SOURCE_ANCHOR_V1,
        )
      ) {
        throw new ProviderRegistryEvidenceBindingPointFixtureError(
          `provider Registry Entry/Evidence binding Evidence row ${index} lost its source anchor`,
        );
      }
      if (invalidCase.outerExpected.kind === "accepted_snapshot") {
        inheritedAcceptedCount += 1;
      }
      continue;
    }
    if (index < evidenceCount + registryCount) {
      const sourceIndex = index - evidenceCount;
      const sourceCaseId =
        PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1[sourceIndex];
      if (
        sourceCaseId === undefined ||
        invalidCase.group !== "provider_registry_manifest_history" ||
        invalidCase.sourceIndex !== sourceIndex ||
        invalidCase.sourceCaseId !== sourceCaseId ||
        invalidCase.sourceOperation !== sourceCaseId ||
        !canonicalJsonEqualV1(
          invalidCase.sourceResource,
          INVALID_REGISTRY_SOURCE_ANCHOR_V1,
        )
      ) {
        throw new ProviderRegistryEvidenceBindingPointFixtureError(
          `provider Registry Entry/Evidence binding Registry row ${sourceIndex} lost its source anchor`,
        );
      }
      continue;
    }
    const sourceIndex = index - evidenceCount - registryCount;
    const pointCaseId =
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_POINT_SPECIFIC_INVALID_CASE_IDS_V1[
        sourceIndex
      ];
    if (
      pointCaseId === undefined ||
      invalidCase.group !== "provider_registry_evidence_binding_point" ||
      invalidCase.sourceIndex !== sourceIndex ||
      invalidCase.sourceCaseId !== pointCaseId ||
      !canonicalJsonEqualV1(
        invalidCase.sourceResource,
        INVALID_GOLDEN_SOURCE_ANCHOR_V1,
      )
    ) {
      throw new ProviderRegistryEvidenceBindingPointFixtureError(
        `provider Registry Entry/Evidence binding point row ${sourceIndex} lost its literal inventory`,
      );
    }
  }
  if (inheritedAcceptedCount !== 6) {
    throw new ProviderRegistryEvidenceBindingPointFixtureError(
      "provider Registry Entry/Evidence binding must retain all six inherited accepted snapshots",
    );
  }
  if (budgetCaseCount !== 13) {
    throw new ProviderRegistryEvidenceBindingPointFixtureError(
      "provider Registry Entry/Evidence binding must retain exactly 13 production-counter budget witnesses",
    );
  }
}

function verifyInvalidStageCoverageV1(
  manifest: ProviderRegistryEvidenceBindingPointInvalidManifestV1,
): void {
  const stages = ProviderRegistryEvidenceBindingPointInvalidStageV1Schema.options;
  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index];
    const coverage = manifest.stageCoverage[index];
    if (stage === undefined || coverage?.stage !== stage) {
      throw new ProviderRegistryEvidenceBindingPointFixtureError(
        "provider Registry Entry/Evidence binding stage coverage order drifted",
      );
    }
    const acceptedWitness = manifest.cases.find(
      ({ caseId }) => caseId === coverage.successWitnessCaseId,
    );
    const exactRejections = manifest.cases
      .filter(
        ({ outerExpected }) =>
          outerExpected.kind === "diagnostic" &&
          outerExpected.stage === stage,
      )
      .map(({ caseId }) => caseId);
    if (
      acceptedWitness?.outerExpected.kind !== "accepted_snapshot" ||
      coverage.reachableRejection !== (exactRejections.length > 0) ||
      !canonicalJsonEqualV1(coverage.rejectionCaseIds, exactRejections)
    ) {
      throw new ProviderRegistryEvidenceBindingPointFixtureError(
        `provider Registry Entry/Evidence binding stage ${stage} coverage is not exact`,
      );
    }
    if (
      stage === "registry_policy_binding" &&
      (coverage.reachableRejection ||
        coverage.unreachableRejections.length !== 1 ||
        coverage.unreachableRejections[0]?.reason !== "binding_mismatch" ||
        !coverage.reachabilityRationale.includes(
          "registry_history_closure",
        ) ||
        !coverage.reachabilityRationale.includes(
          "runtime_attestation_closure",
        ))
    ) {
      throw new ProviderRegistryEvidenceBindingPointFixtureError(
        "registry_policy_binding reachability rationale lost its closure implication",
      );
    }
    if (
      stage === "candidate_root_binding" &&
      (coverage.unreachableRejections.length !== 1 ||
        coverage.unreachableRejections[0]?.reason !== "identity_mismatch" ||
        !coverage.unreachableRejections[0].rationale.includes(
          "manifest_envelope",
        ) ||
        !coverage.unreachableRejections[0].rationale.includes(
          "registry_entry",
        ))
    ) {
      throw new ProviderRegistryEvidenceBindingPointFixtureError(
        "candidate_root_binding identity reachability rationale lost its Registry implication",
      );
    }
    if (
      stage !== "candidate_root_binding" &&
      stage !== "registry_policy_binding" &&
      coverage.unreachableRejections.length !== 0
    ) {
      throw new ProviderRegistryEvidenceBindingPointFixtureError(
        `provider Registry Entry/Evidence binding stage ${stage} invented an unreachable rejection`,
      );
    }
  }
}

function verifyInvalidShardsV1(
  manifest: ProviderRegistryEvidenceBindingPointInvalidManifestV1,
): void {
  const expectedShardCount = Math.ceil(
    manifest.caseCount /
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_SIZE_V1,
  );
  if (manifest.shards.length !== expectedShardCount) {
    throw new ProviderRegistryEvidenceBindingPointFixtureError(
      "provider Registry Entry/Evidence binding shard count is not derived from 32-row partitions",
    );
  }
  for (let shardIndex = 0; shardIndex < expectedShardCount; shardIndex += 1) {
    const shard = manifest.shards[shardIndex];
    const startCaseIndex =
      shardIndex *
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_SIZE_V1;
    const endCaseIndexExclusive = Math.min(
      startCaseIndex +
        PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_SIZE_V1,
      manifest.caseCount,
    );
    const cases = manifest.cases.slice(startCaseIndex, endCaseIndexExclusive);
    if (
      shard === undefined ||
      shard.shardIndex !== shardIndex ||
      shard.startCaseIndex !== startCaseIndex ||
      shard.endCaseIndexExclusive !== endCaseIndexExclusive ||
      shard.caseCount !== endCaseIndexExclusive - startCaseIndex ||
      shard.caseIdsContentDigest !==
        semanticDigestV1(
          PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_CASE_IDS_DOMAIN_V1,
          cases.map(({ caseId }) => caseId),
        ) ||
      shard.expectedOutcomesContentDigest !==
        semanticDigestV1(
          PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_OUTCOMES_DOMAIN_V1,
          cases.map(({ outerExpected }) => outerExpected),
        ) ||
      shard.cryptoCountsContentDigest !==
        semanticDigestV1(
          PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_CRYPTO_DOMAIN_V1,
          cases.map(({ caseId, outerExpected }) => ({
            caseId,
            pointAdmissionCount: outerExpected.pointAdmissionCount,
            signatureVerificationCount:
              outerExpected.signatureVerificationCount,
          })),
        )
    ) {
      throw new ProviderRegistryEvidenceBindingPointFixtureError(
        `provider Registry Entry/Evidence binding shard ${shardIndex} is not an exact contiguous cover`,
      );
    }
  }
  if (
    semanticDigestV1(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_AGGREGATE_DOMAIN_V1,
      manifest.shards,
    ) !== manifest.aggregateContentDigest
  ) {
    throw new ProviderRegistryEvidenceBindingPointFixtureError(
      "provider Registry Entry/Evidence binding aggregate shard digest mismatch",
    );
  }
}

export function verifyProviderRegistryEvidenceBindingPointInvalidResourceV1(
  bytes: Uint8Array,
): ProviderRegistryEvidenceBindingPointInvalidManifestV1 {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength >
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_FIXTURE_MAX_BYTES_V1 ||
    bytes.byteLength !==
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1 ||
    rawSha256HexV1(bytes) !==
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_SHA256_HEX_V1
  ) {
    throw new ProviderRegistryEvidenceBindingPointFixtureError(
      "provider Registry Entry/Evidence binding invalid bytes do not match the immutable anchor",
    );
  }
  let manifest: ProviderRegistryEvidenceBindingPointInvalidManifestV1;
  try {
    manifest = ProviderRegistryEvidenceBindingPointInvalidManifestV1Schema.parse(
      parseJsonResourceV1(bytes),
    );
  } catch (error) {
    if (error instanceof ProviderRegistryEvidenceBindingPointFixtureError) {
      throw error;
    }
    throw new ProviderRegistryEvidenceBindingPointFixtureError(
      "provider Registry Entry/Evidence binding invalid schema is invalid",
    );
  }
  verifyInvalidCaseInventoryV1(manifest);
  verifyInvalidStageCoverageV1(manifest);
  verifyInvalidShardsV1(manifest);
  const { semanticContentDigest: _semanticContentDigest, ...semanticFields } =
    manifest;
  if (
    semanticDigestV1(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SEMANTIC_DOMAIN_V1,
      semanticFields,
    ) !== manifest.semanticContentDigest
  ) {
    throw new ProviderRegistryEvidenceBindingPointFixtureError(
      "provider Registry Entry/Evidence binding invalid semantic digest mismatch",
    );
  }
  return deepFreezeJsonV1(manifest);
}

type MutableBindingPointRequestV1 = Record<string, unknown> &
  ValidateProviderRegistryEvidenceBindingPointClosureV1Input;

export interface ProviderRegistryEvidenceBindingPointInvalidPreparedWitnessV1 {
  readonly caseId: string;
  readonly request: unknown;
  readonly getterCalls: () => number;
  readonly mutateAfterStart?: () => void;
  readonly poisonPromiseAfterStart?: () => () => void;
}

function applyRequestPatchV1(
  request: Record<string, unknown>,
  setFields: Record<string, unknown>,
  deleteFields: readonly string[],
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): void {
  for (const [key, value] of Object.entries(setFields)) {
    request[key] = jsonCloneV1(value);
  }
  for (const key of deleteFields) delete request[key];
  request.strictCryptoCapability = strictCryptoCapability;
}

function mutableTipEntryV1(request: Record<string, unknown>): Record<string, unknown> {
  const history = request.registryManifestHistory as Array<Record<string, unknown>>;
  const tip = history.at(-1);
  const payload = tip?.payload as Record<string, unknown> | undefined;
  const members = payload?.members as Array<Record<string, unknown>> | undefined;
  const member = members?.find(
    (candidate) =>
      candidate.providerId === NATIVE_B_PROVIDER_ID_V1 &&
      candidate.disposition === "enabled",
  );
  if (member === undefined) throw new TypeError("fixture lost native-b tip member");
  return member.registryEntry as Record<string, unknown>;
}

function mutableApproverV1(
  request: Record<string, unknown>,
  role: "qa" | "release",
): Record<string, unknown> {
  const entry = mutableTipEntryV1(request);
  const keys = entry.feasibilityApprovalKeys as Record<string, unknown>;
  const records = keys.publicKeyRecords as Array<Record<string, unknown>>;
  const record = records.find((candidate) => candidate.role === role);
  if (record === undefined) throw new TypeError(`fixture lost ${role} approver`);
  return record;
}

function appendFreshJsonCopiesV1(
  target: unknown[],
  template: unknown,
  count: number,
): void {
  for (let remaining = count; remaining > 0; remaining -= 10_000) {
    const chunkLength = Math.min(remaining, 10_000);
    target.push(
      ...Array.from({ length: chunkLength }, () => jsonCloneV1(template)),
    );
  }
}

function materializeExactConformanceEnvelopeLimitOverflowV1(
  envelope: Record<string, unknown>,
): void {
  const payload = envelope.payload as Record<string, unknown>;
  const caseResults = payload.caseResults as Array<Record<string, unknown>>;
  const primary = jsonCloneV1(caseResults[0]);
  if (primary === undefined) throw new TypeError("fixture result has no case result");
  const secondary = {
    ...jsonCloneV1(primary),
    outcome: "failed",
    resultCode: "assertion_failed",
  };
  payload.result = "failed";
  const targetByteLength =
    PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_MAX_CANONICAL_BYTES_V1 + 1;
  const remainingBytes =
    targetByteLength - canonicalizeJcsSafeIntegerUtf8V1(envelope).byteLength;
  const primaryContribution =
    canonicalizeJcsSafeIntegerUtf8V1(primary).byteLength + 1;
  const secondaryContribution =
    canonicalizeJcsSafeIntegerUtf8V1(secondary).byteLength + 1;
  let primaryCount = -1;
  let secondaryCount = -1;
  for (
    let candidateSecondaryCount = 0;
    candidateSecondaryCount < primaryContribution &&
    candidateSecondaryCount * secondaryContribution <= remainingBytes;
    candidateSecondaryCount += 1
  ) {
    const primaryBytes =
      remainingBytes - candidateSecondaryCount * secondaryContribution;
    if (primaryBytes % primaryContribution === 0) {
      primaryCount = primaryBytes / primaryContribution;
      secondaryCount = candidateSecondaryCount;
      break;
    }
  }
  if (primaryCount < 0 || secondaryCount < 0) {
    throw new TypeError("cannot construct exact MAX+1 result envelope");
  }
  appendFreshJsonCopiesV1(caseResults, primary, primaryCount);
  appendFreshJsonCopiesV1(caseResults, secondary, secondaryCount);
  if (
    canonicalizeJcsSafeIntegerUtf8V1(envelope).byteLength !== targetByteLength
  ) {
    throw new TypeError("exact MAX+1 result envelope drifted");
  }
}

function poisonPromisePrimordialsForFixtureV1(
  onPoison: () => void,
): () => void {
  const nativePromise = Promise;
  const constructorDescriptor = Object.getOwnPropertyDescriptor(
    nativePromise.prototype,
    "constructor",
  );
  const thenDescriptor = Object.getOwnPropertyDescriptor(
    nativePromise.prototype,
    "then",
  );
  const speciesDescriptor = Object.getOwnPropertyDescriptor(
    nativePromise,
    Symbol.species,
  );
  const restore = (): void => {
    if (constructorDescriptor !== undefined) {
      Object.defineProperty(
        nativePromise.prototype,
        "constructor",
        constructorDescriptor,
      );
    }
    if (thenDescriptor !== undefined) {
      Object.defineProperty(nativePromise.prototype, "then", thenDescriptor);
    }
    if (speciesDescriptor !== undefined) {
      Object.defineProperty(nativePromise, Symbol.species, speciesDescriptor);
    }
  };
  const forged = Object.freeze({ forgedPromiseValue: true as const });
  function PoisonedPromiseConstructor(this: unknown): Readonly<{ forged: true }> {
    onPoison();
    return Object.freeze({ forged: true as const });
  }
  Object.defineProperty(nativePromise.prototype, "constructor", {
    configurable: true,
    enumerable: false,
    writable: true,
    value: PoisonedPromiseConstructor,
  });
  Object.defineProperty(nativePromise.prototype, "then", {
    configurable: true,
    enumerable: false,
    writable: true,
    value(
      this: unknown,
      onFulfilled?: ((value: unknown) => unknown) | null,
    ): unknown {
      onPoison();
      return typeof onFulfilled === "function"
        ? onFulfilled(forged)
        : forged;
    },
  });
  Object.defineProperty(nativePromise, Symbol.species, {
    configurable: true,
    enumerable: false,
    get() {
      onPoison();
      return PoisonedPromiseConstructor;
    },
  });
  return restore;
}

function prepareExecutionProfileV1(
  profile: string,
  requestInput: Record<string, unknown>,
): {
  request: unknown;
  getterCalls: () => number;
  mutateAfterStart?: () => void;
  poisonPromiseAfterStart?: () => () => void;
} {
  let request = requestInput;
  let getterCalls = 0;
  const runtimeInner = profile.startsWith("runtime-inner-");
  const runtimePoint = profile.startsWith("runtime-point-");
  const evidencePoint = profile.startsWith("point-security-");
  const prefixedOperation = runtimeInner
    ? profile.slice("runtime-inner-".length)
    : runtimePoint
      ? profile.slice("runtime-point-".length)
        : evidencePoint
          ? profile.slice("point-security-".length)
          : profile;
  const operation = prefixedOperation.startsWith("security-")
    ? prefixedOperation.slice("security-".length)
    : prefixedOperation;
  const conformanceEnvelope = request.realFilesystemConformanceResult as
    | Record<string, unknown>
    | undefined;
  const conformancePayload = conformanceEnvelope?.payload as
    | Record<string, unknown>
    | undefined;
  const runtimeEnvelope = request.runtimeAttestation as
    | Record<string, unknown>
    | undefined;
  const runtimePayload = runtimeEnvelope?.payload as
    | Record<string, unknown>
    | undefined;
  const evidenceEnvelope = request.providerFeasibilityEvidence as
    | Record<string, unknown>
    | undefined;
  const evidencePayload = evidenceEnvelope?.payload as
    | Record<string, unknown>
    | undefined;
  const nestedTarget = runtimeInner
    ? conformancePayload
    : runtimePoint
      ? runtimePayload
      : evidencePayload;

  if (operation.endsWith("result-envelope-16mib-plus-one")) {
    if (conformanceEnvelope === undefined) {
      throw new TypeError("missing conformance envelope for MAX+1 witness");
    }
    materializeExactConformanceEnvelopeLimitOverflowV1(conformanceEnvelope);
  } else if (operation.endsWith("plain-validation-dto")) {
    request = runtimePoint
      ? ({
          conformanceResultClosure: {
            authority: "none_real_fs_conformance_result_structure_only",
          },
          runtimeAttestation: request.runtimeAttestation,
        } as Record<string, unknown>)
      : ({ authority: "none_provider_feasibility_evidence_structure_only" } as Record<
          string,
          unknown
        >);
  } else if (operation.endsWith("locator-envelope-substitution")) {
    request.realFilesystemConformanceResultLocator = jsonCloneV1(
      request.realFilesystemConformanceResult,
    );
  } else if (operation.endsWith("input-extra-field")) {
    request.unexpected = true;
  } else if (
    operation === "top-level-proxy" ||
    profile === "hostile_top_level_proxy"
  ) {
    return { request: new Proxy(request, {}), getterCalls: () => getterCalls };
  } else if (operation === "nested-proxy") {
    if (nestedTarget === undefined) throw new TypeError("missing nested Proxy target");
    if (runtimeInner && conformanceEnvelope !== undefined) {
      conformanceEnvelope.payload = new Proxy(nestedTarget, {});
    } else if (runtimePoint && runtimeEnvelope !== undefined) {
      runtimeEnvelope.payload = new Proxy(nestedTarget, {});
    } else if (evidenceEnvelope !== undefined) {
      evidenceEnvelope.payload = new Proxy(nestedTarget, {});
    }
  } else if (operation === "top-level-getter") {
    Object.defineProperty(request, "unexpected", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return true;
      },
    });
  } else if (operation === "nested-getter") {
    if (nestedTarget === undefined) throw new TypeError("missing nested getter target");
    Object.defineProperty(nestedTarget, "unexpected", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return true;
      },
    });
  } else if (operation === "top-level-hidden") {
    Object.defineProperty(request, "hidden", { enumerable: false, value: true });
  } else if (operation === "nested-hidden") {
    if (nestedTarget === undefined) throw new TypeError("missing hidden target");
    Object.defineProperty(nestedTarget, "hidden", {
      enumerable: false,
      value: true,
    });
  } else if (operation === "top-level-symbol") {
    Object.defineProperty(request, Symbol("fixture-hostile"), {
      enumerable: true,
      value: true,
    });
  } else if (operation === "nested-symbol") {
    if (nestedTarget === undefined) throw new TypeError("missing symbol target");
    Object.defineProperty(nestedTarget, Symbol("fixture-hostile"), {
      enumerable: true,
      value: true,
    });
  } else if (operation === "sparse-array") {
    if (runtimeInner) {
      delete (conformancePayload?.caseResults as unknown[])[0];
    } else if (runtimePoint) {
      const policy = request.semanticProviderPolicy as Record<string, unknown>;
      delete (policy.supportedStagingObjectKinds as unknown[])[0];
    } else {
      const discovery = request.targetDiscoveryResult as Record<string, unknown>;
      const payload = discovery.payload as Record<string, unknown>;
      delete (payload.targets as unknown[])[0];
    }
  } else if (operation === "cycle") {
    if (runtimeInner) request.cycle = request;
    else if (runtimePoint) {
      const policy = request.semanticProviderPolicy as Record<string, unknown>;
      policy.cycle = policy;
    } else if (evidencePayload !== undefined) evidencePayload.cycle = evidencePayload;
  } else if (
    operation === "alias" ||
    profile === "cross_history_alias"
  ) {
    const discovery = request.targetDiscoveryResult as Record<string, unknown>;
    const discoveryPayload = discovery.payload as Record<string, unknown>;
    const firstTarget = (discoveryPayload.targets as Array<Record<string, unknown>>)[0];
    if (runtimeInner && conformancePayload !== undefined) {
      conformancePayload.target = firstTarget?.target;
    } else if (runtimePoint) {
      const policy = request.semanticProviderPolicy as Record<string, unknown>;
      policy.isolation = conformancePayload?.target;
    } else if (profile === "cross_history_alias") {
      const history = request.registryManifestHistory as Array<Record<string, unknown>>;
      const first = history[0];
      const last = history.at(-1);
      if (first !== undefined && last !== undefined) last.payload = first.payload;
    } else if (evidencePayload !== undefined) {
      evidencePayload.target = conformancePayload?.target;
    }
  } else if (operation === "async-mutation") {
    if (runtimeInner && conformancePayload !== undefined) {
      return {
        request,
        getterCalls: () => getterCalls,
        mutateAfterStart() {
          conformancePayload.result = "failed";
          const first = (conformancePayload.caseResults as Array<Record<string, unknown>>)[0];
          if (first !== undefined) {
            first.outcome = "failed";
            first.resultCode = "assertion_failed";
          }
        },
      };
    }
    if (runtimePayload !== undefined) {
      return {
        request,
        getterCalls: () => getterCalls,
        mutateAfterStart() {
          runtimePayload.ipcEndpointAttestationDigest = `sha256:${"7".repeat(64)}`;
          runtimePayload.attestationGeneration = 2;
          runtimePayload.issuedAt = "2026-08-04T23:59:59Z";
        },
      };
    }
  } else if (
    operation === "evidence-async-mutation" ||
    profile === "after_start_evidence_mutation"
  ) {
    if (evidencePayload === undefined) throw new TypeError("missing Evidence payload");
    return {
      request,
      getterCalls: () => getterCalls,
      mutateAfterStart() {
        evidencePayload.result = "failed";
      },
    };
  } else if (operation === "pin-async-mutation") {
    const pin = request.providerFeasibilityEvidencePin as Record<string, unknown>;
    return {
      request,
      getterCalls: () => getterCalls,
      mutateAfterStart() {
        pin.contentDigest = `sha256:${"0".repeat(64)}`;
      },
    };
  } else if (operation === "qa-key-async-mutation") {
    const record = mutableApproverV1(request, "qa");
    return {
      request,
      getterCalls: () => getterCalls,
      mutateAfterStart() {
        record.publicKeyDigest = `sha256:${"0".repeat(64)}`;
      },
    };
  } else if (operation === "release-key-async-mutation") {
    const record = mutableApproverV1(request, "release");
    return {
      request,
      getterCalls: () => getterCalls,
      mutateAfterStart() {
        record.publicKeyDigest = `sha256:${"0".repeat(64)}`;
      },
    };
  } else if (profile === "after_start_history_mutation") {
    const history = request.registryManifestHistory as Array<Record<string, unknown>>;
    return {
      request,
      getterCalls: () => getterCalls,
      mutateAfterStart() {
        const first = history[0];
        if (first !== undefined) first.contentDigest = `sha256:${"0".repeat(64)}`;
      },
    };
  } else if (profile === "promise_poison") {
    return {
      request,
      getterCalls: () => getterCalls,
      poisonPromiseAfterStart: () =>
        poisonPromisePrimordialsForFixtureV1(() => {
          getterCalls += 1;
        }),
    };
  } else if (profile.endsWith("runtime-generation-fractional")) {
    if (runtimePayload !== undefined) runtimePayload.attestationGeneration = 1.5;
  } else if (profile.endsWith("runtime-generation-unsafe")) {
    if (runtimePayload !== undefined) {
      runtimePayload.attestationGeneration = Number.MAX_SAFE_INTEGER + 1;
    }
  } else if (profile === "registry-history-sparse-array") {
    (request as Record<string, unknown>).registryManifestHistory =
      new Array<unknown>(1);
  } else {
    throw new TypeError(`unknown binding-point execution profile ${profile}`);
  }
  return { request, getterCalls: () => getterCalls };
}

export function materializeProviderRegistryEvidenceBindingPointInvalidCaseV1(
  goldenManifest: ProviderRegistryEvidenceBindingPointGoldenManifestV1,
  invalidCase: ProviderRegistryEvidenceBindingPointInvalidCaseV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): ProviderRegistryEvidenceBindingPointInvalidPreparedWitnessV1 {
  const recipe = invalidCase.mutation.witnessRecipe;
  const request = materializeProviderRegistryEvidenceBindingPointGoldenRequestV1(
    goldenManifest,
    strictCryptoCapability,
  ) as MutableBindingPointRequestV1;
  let prepared: {
    request: unknown;
    getterCalls: () => number;
    mutateAfterStart?: () => void;
    poisonPromiseAfterStart?: () => () => void;
  };
  if (recipe.kind === "symbolic_budget") {
    prepared = materializeProviderRegistryEvidenceBindingBudgetWitnessInternalV1(
      request,
      recipe,
    );
  } else {
    applyRequestPatchV1(
      request as Record<string, unknown>,
      recipe.setFields,
      recipe.deleteFields,
      strictCryptoCapability,
    );
    prepared =
      recipe.kind === "execution_profile"
        ? prepareExecutionProfileV1(
            recipe.profile,
            request as Record<string, unknown>,
          )
        : { request, getterCalls: () => 0 };
  }
  return createProviderNonThenableFrozenRecordV1({
    caseId: invalidCase.caseId,
    request: prepared.request,
    getterCalls: prepared.getterCalls,
    ...(prepared.mutateAfterStart === undefined
      ? {}
      : { mutateAfterStart: prepared.mutateAfterStart }),
    ...(prepared.poisonPromiseAfterStart === undefined
      ? {}
      : { poisonPromiseAfterStart: prepared.poisonPromiseAfterStart }),
  });
}

export interface ProviderRegistryEvidenceBindingPointExecutionCounterV1 {
  readonly readPointAdmissionCount: () => number;
  readonly readSignatureVerificationCount: () => number;
}

export type ProviderRegistryEvidenceBindingPointInvalidCaseExecutionV1 =
  | Readonly<{
      kind: "unexpected_acceptance";
      pointAdmissionCount: number;
      signatureVerificationCount: number;
    }>
  | Readonly<{
      kind: "rejection";
      boundary: "internal_diagnostic";
      stage: z.infer<
        typeof ProviderRegistryEvidenceBindingPointInvalidStageV1Schema
      >;
      reason: z.infer<
        typeof ProviderRegistryEvidenceBindingPointInvalidReasonV1Schema
      >;
      publicFailure: Readonly<{
        errorName: "ProviderRegistryEvidenceBindingPointClosureValidationError";
        code: "provider_unavailable";
        reason: "attestation_invalid";
      }>;
      pointAdmissionCount: number;
      signatureVerificationCount: number;
    }>
  | Readonly<{
      kind: "snapshot_acceptance";
      boundary: "snapshot_stability";
      authority: typeof PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1;
      closure: ProviderRegistryEvidenceBindingPointClosureValidationV1;
      snapshotProjection: ProviderRegistryEvidenceBindingPointSuccessProjectionV1;
      pointAdmissionCount: number;
      signatureVerificationCount: number;
    }>;

function assertRecursivelyFrozenFixtureValueV1(
  value: unknown,
  seen = new Set<object>(),
): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (!Object.isFrozen(value)) {
    throw new ProviderRegistryEvidenceBindingPointFixtureError(
      "accepted binding-point closure retained a mutable value",
    );
  }
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    if ("value" in descriptor) {
      assertRecursivelyFrozenFixtureValueV1(descriptor.value, seen);
    }
  }
}

const BINDING_POINT_PUBLIC_FAILURE_V1 = deepFreezeJsonV1({
  errorName: "ProviderRegistryEvidenceBindingPointClosureValidationError" as const,
  code: "provider_unavailable" as const,
  reason: "attestation_invalid" as const,
});

export function executeProviderRegistryEvidenceBindingPointInvalidCaseV1(
  goldenManifest: ProviderRegistryEvidenceBindingPointGoldenManifestV1,
  invalidCase: ProviderRegistryEvidenceBindingPointInvalidCaseV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
  executionCounter: ProviderRegistryEvidenceBindingPointExecutionCounterV1,
): Promise<ProviderRegistryEvidenceBindingPointInvalidCaseExecutionV1> {
  let prepared: ProviderRegistryEvidenceBindingPointInvalidPreparedWitnessV1;
  let pointStart: number;
  let signatureStart: number;
  try {
    pointStart = executionCounter.readPointAdmissionCount();
    signatureStart = executionCounter.readSignatureVerificationCount();
    if (
      !Number.isSafeInteger(pointStart) ||
      pointStart < 0 ||
      !Number.isSafeInteger(signatureStart) ||
      signatureStart < 0
    ) {
      throw new TypeError("binding-point execution counter is invalid");
    }
    prepared = materializeProviderRegistryEvidenceBindingPointInvalidCaseV1(
      goldenManifest,
      invalidCase,
      strictCryptoCapability,
    );
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }

  let pending: ReturnType<
    typeof diagnoseProviderRegistryEvidenceBindingPointClosureV1
  >;
  let restorePromisePrimordials: (() => void) | undefined;
  const budgetRecipe =
    invalidCase.mutation.witnessRecipe.kind === "symbolic_budget"
      ? invalidCase.mutation.witnessRecipe
      : undefined;
  const verifyBudgetReplay = (): void => {
    if (budgetRecipe === undefined) return;
    if (prepared.request === null || typeof prepared.request !== "object") {
      throw new ProviderRegistryEvidenceBindingPointFixtureError(
        `${invalidCase.caseId} lost its request-bound budget replay identity`,
      );
    }
    takeAndVerifyProviderRegistryEvidenceBindingBudgetReplayInternalV1(
      prepared.request,
      budgetRecipe,
    );
  };
  try {
    pending = diagnoseProviderRegistryEvidenceBindingPointClosureV1(
      prepared.request,
    );
    prepared.mutateAfterStart?.();
    restorePromisePrimordials = prepared.poisonPromiseAfterStart?.();
  } catch (error) {
    if (
      budgetRecipe !== undefined &&
      prepared.request !== null &&
      typeof prepared.request === "object"
    ) {
      discardProviderRegistryEvidenceBindingBudgetWitnessInternalV1(
        prepared.request,
      );
    }
    restorePromisePrimordials?.();
    return createProviderPointRejectedPromiseV1(error);
  }

  const finishCounts = (): {
    pointAdmissionCount: number;
    signatureVerificationCount: number;
  } => ({
    pointAdmissionCount:
      executionCounter.readPointAdmissionCount() - pointStart,
    signatureVerificationCount:
      executionCounter.readSignatureVerificationCount() - signatureStart,
  });
  return hardenProviderPointPromiseV1(pending).then(
    (diagnostic): ProviderRegistryEvidenceBindingPointInvalidCaseExecutionV1 => {
      restorePromisePrimordials?.();
      verifyBudgetReplay();
      if (prepared.getterCalls() !== 0) {
        throw new ProviderRegistryEvidenceBindingPointFixtureError(
          `${invalidCase.caseId} executed an attacker-owned getter`,
        );
      }
      const counts = finishCounts();
      if (!diagnostic.ok) {
        return createProviderNonThenableFrozenRecordV1({
          kind: "rejection" as const,
          boundary: "internal_diagnostic" as const,
          stage: diagnostic.stage,
          reason: diagnostic.reason,
          publicFailure: BINDING_POINT_PUBLIC_FAILURE_V1,
          ...counts,
        });
      }
      assertRecursivelyFrozenFixtureValueV1(diagnostic.value);
      const projection =
        projectProviderRegistryEvidenceBindingPointClosureSnapshotV1(
          diagnostic.value,
        );
      return createProviderNonThenableFrozenRecordV1({
        kind: "snapshot_acceptance" as const,
        boundary: "snapshot_stability" as const,
        authority: diagnostic.value.authority,
        closure: diagnostic.value,
        snapshotProjection: projection,
        ...counts,
      });
    },
    (error): never => {
      restorePromisePrimordials?.();
      verifyBudgetReplay();
      throw error;
    },
  );
}

Object.freeze(materializeProviderRegistryEvidenceBindingPointInvalidCaseV1);
Object.freeze(executeProviderRegistryEvidenceBindingPointInvalidCaseV1);
Object.freeze(verifyProviderRegistryEvidenceBindingPointInvalidResourceV1);

void ProviderRegistryEvidenceBindingPointClosureValidationError;
