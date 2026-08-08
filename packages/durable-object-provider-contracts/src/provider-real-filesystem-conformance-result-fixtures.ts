import { z } from "./zod-runtime.js";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import { ContentDigestV1Schema } from "./primitives.js";
import { ProviderSignedDistributionRootBindingV1Schema } from "./provider-distribution-trust.js";
import {
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_MAX_CANONICAL_BYTES_V1,
  ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  ProviderRealFilesystemConformanceResultInvalidReasonV1Schema,
  ProviderRealFilesystemConformanceResultInvalidStageV1Schema,
  ProviderRealFilesystemConformanceResultLocatorV1Schema,
  ProviderRealFilesystemConformanceResultPinV1Schema,
  ProviderRealFilesystemConformanceResultV1Schema,
  buildProviderRealFilesystemConformanceResultRelativePathV1,
  deriveProviderRealFilesystemConformanceResultContentDigestV1,
  deriveProviderRealFilesystemConformanceResultIdV1,
  diagnoseProviderRealFilesystemConformanceResultClosureV1,
  projectProviderRealFilesystemConformanceResultIdFieldsV1,
  validateProviderRealFilesystemConformanceResultClosureV1,
  type ProviderRealFilesystemConformanceCaseOutcomeV1,
  type ProviderRealFilesystemConformanceResultCodeV1,
  type ProviderRealFilesystemConformanceResultClosureValidationV1,
  type ValidateProviderRealFilesystemConformanceResultClosureV1Input,
} from "./provider-real-filesystem-conformance-result.js";
import {
  ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
  ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
} from "./provider-real-filesystem-source.js";
import {
  ProviderRegistryRootMetadataPinV1Schema,
  ProviderRegistryRootPublicKeyV1Schema,
} from "./provider-registry-trust.js";
import { sha256InternalV1 } from "./sha256.js";
import {
  ProviderPublicSupportTaxonomyEnvelopeV1Schema,
  ProviderReleaseMatrixEnvelopeV1Schema,
  ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema,
  ProviderTargetDiscoveryResultEnvelopeV1Schema,
  ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema,
  deriveProviderTargetProfileIdV1,
} from "./provider-target-discovery-point.js";
import {
  PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
} from "./provider-target-discovery-point-fixtures.js";
import type { ProviderStrictEd25519OpaqueCapabilityV1 } from "./strict-ed25519-conformance.js";

export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_PROFILE_V1 =
  "provider_real_filesystem_conformance_result_golden_v1" as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_PROFILE_V1 =
  "provider_real_filesystem_conformance_result_invalid_v1" as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_SEMANTIC_DOMAIN_V1 =
  "provider-real-filesystem-conformance-result-golden-manifest-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_SEMANTIC_DOMAIN_V1 =
  "provider-real-filesystem-conformance-result-invalid-manifest-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1 =
  "provider-real-filesystem-conformance-result-invalid-materialized-request-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_RECIPE_DIALECT_V1 =
  "provider_real_filesystem_conformance_result_invalid_recipe_v1" as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_PATH_V1 =
  "fixtures/v1/golden/provider-real-filesystem-conformance-result-v1.json" as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_RESOURCE_PATH_V1 =
  "fixtures/v1/invalid/provider-real-filesystem-conformance-result-v1.json" as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_BYTE_LENGTH_V1 =
  96_224 as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_SHA256_HEX_V1 =
  "1afe75d00ea7469a0f0bb43fdf3f14721fbc780115a39dd4bd3f9de92f4b9e12" as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:3a647f61d4e4f71a2126873f7969b8326e8be438fc436782fb81fdce5cb00af2" as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_RESOURCE_BYTE_LENGTH_V1 =
  45_004 as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_RESOURCE_SHA256_HEX_V1 =
  "58cf800a517c54f73f42c84928f23badfe24f85a3c3de5d98cb8d36442b29ce4" as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:d6531dc366161432570799d672c5f22c39cd3154d4735b060a001630c4a2f887" as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_FIXTURE_MAX_BYTES_V1 =
  1_048_576 as const;

const INVALID_CASE_IDS_V1 = [
  "input-extra-field",
  "input-plain-validation-dto",
  "result-extra-signature",
  "source-suite-signature-bitflip",
  "target-id-not-recomputed",
  "target-not-discovered",
  "discovery-pin-mismatch",
  "bundle-digest-mismatch",
  "suite-pin-mismatch",
  "suite-digest-mismatch",
  "fixture-digest-mismatch",
  "runner-digest-mismatch",
  "crash-cut-digest-mismatch",
  "case-results-reordered",
  "case-result-missing",
  "case-result-extra",
  "case-result-duplicate",
  "passed-code-mismatch",
  "unsupported-code-mismatch",
  "failed-code-mismatch",
  "passed-assertion-failed-code-mismatch",
  "passed-crash-recovery-failed-code-mismatch",
  "passed-identity-discontinuity-code-mismatch",
  "passed-containment-violation-code-mismatch",
  "passed-unsupported-by-target-profile-code-mismatch",
  "unsupported-assertion-failed-code-mismatch",
  "unsupported-provider-rejected-code-mismatch",
  "unsupported-crash-recovery-failed-code-mismatch",
  "unsupported-identity-discontinuity-code-mismatch",
  "unsupported-containment-violation-code-mismatch",
  "failed-passed-code-mismatch",
  "aggregate-mismatch",
  "result-id-mismatch",
  "result-content-digest-mismatch",
  "result-outer-id-mismatch",
  "locator-profile-mismatch",
  "locator-id-mismatch",
  "pin-content-digest-mismatch",
  "result-envelope-16mib-plus-one",
  "locator-envelope-substitution",
  "security-top-level-proxy",
  "security-nested-proxy",
  "security-top-level-getter",
  "security-nested-getter",
  "security-nested-hidden",
  "security-nested-symbol",
  "security-sparse-array",
  "security-cycle",
  "security-alias",
  "security-async-mutation",
] as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_CASE_IDS_V1 =
  Object.freeze([...INVALID_CASE_IDS_V1]);
export type ProviderRealFilesystemConformanceResultInvalidCaseIdV1 =
  (typeof INVALID_CASE_IDS_V1)[number];

const EvenLowerHexV1Schema = z.string().regex(/^(?:[0-9a-f]{2})+$/u);
const ResourceSha256HexV1Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const PositiveSafeIntegerV1Schema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const NonnegativeSafeIntegerV1Schema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const InvalidCaseIdV1Schema = z.enum(INVALID_CASE_IDS_V1);

export const ProviderRealFilesystemConformanceResultGoldenManifestV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  profile: z.literal(PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_PROFILE_V1),
  fixtureAuthority: z.literal("none_real_fs_conformance_result_structure_only"),
  canonicalizationProfile: z.literal("rfc8785-jcs-safe-integer-v1"),
  verificationProfile: z.literal("ed25519-rfc8032-cofactorless-prime-subgroup-v1"),
  distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
  activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
  activeRoot: ProviderRegistryRootPublicKeyV1Schema,
  fixtureCorpusManifest: ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
  suiteManifest: ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
  publicSupportTaxonomy: ProviderPublicSupportTaxonomyEnvelopeV1Schema,
  releaseMatrix: ProviderReleaseMatrixEnvelopeV1Schema,
  targetDiscoveryFixtureManifest: ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema,
  targetDiscoveryRunnerRun: ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema,
  targetDiscoveryResult: ProviderTargetDiscoveryResultEnvelopeV1Schema,
  realFilesystemConformanceResult: ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  realFilesystemConformanceResultLocator: ProviderRealFilesystemConformanceResultLocatorV1Schema,
  realFilesystemConformanceResultPin: ProviderRealFilesystemConformanceResultPinV1Schema,
  expected: z.strictObject({
    resultIdPreimageCanonicalUtf8Hex: EvenLowerHexV1Schema,
    resultCanonicalUtf8Hex: EvenLowerHexV1Schema,
    relativePath: z.string().regex(
      /^provider\/real-fs-conformance-results\/(?:id-[0-9a-v]+|idh-[0-9a-f]{64})\.json$/u,
    ),
    caseResultCount: PositiveSafeIntegerV1Schema,
    passedCaseResultCount: PositiveSafeIntegerV1Schema,
    failedCaseResultCount: z.literal(0),
    unsupportedCaseResultCount: z.literal(0),
    targetMatchCount: z.literal(1),
    activeRootPointAdmissionCount: z.literal(1),
    signatureVerificationCount: z.literal(6),
    resultSignatureCount: z.literal(0),
    resultRunnerProfileSource: z.literal("signed_real_filesystem_suite_manifest"),
  }),
  semanticDomain: z.literal(
    PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_SEMANTIC_DOMAIN_V1,
  ),
  dependencies: z.strictObject({
    targetDiscoveryGoldenResourcePath: z.literal(
      PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_PATH_V1,
    ),
    targetDiscoveryGoldenResourceByteLength: z.literal(
      PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    ),
    targetDiscoveryGoldenResourceSha256Hex: z.literal(
      PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
    ),
    targetDiscoveryGoldenSemanticContentDigest: z.literal(
      PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    ),
  }),
  semanticContentDigest: z.literal(
    PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  ),
});
export type ProviderRealFilesystemConformanceResultGoldenManifestV1 = z.infer<
  typeof ProviderRealFilesystemConformanceResultGoldenManifestV1Schema
>;

const MaterializedDigestShapeV1 = {
  materializedRequestSemanticDigest: ContentDigestV1Schema,
} as const;
const InternalDiagnosticExpectedV1Schema = z.strictObject({
  boundary: z.literal("internal_diagnostic"),
  stage: ProviderRealFilesystemConformanceResultInvalidStageV1Schema,
  reason: ProviderRealFilesystemConformanceResultInvalidReasonV1Schema,
  publicFailureReason: z.literal("attestation_invalid"),
  publicFailure: z.strictObject({
    errorName: z.literal("ProviderRealFilesystemConformanceResultClosureValidationError"),
    code: z.literal("provider_unavailable"),
    reason: z.literal("attestation_invalid"),
  }),
  ...MaterializedDigestShapeV1,
});
const LocatorBuilderExpectedV1Schema = z.strictObject({
  boundary: z.literal("locator_builder"),
  stage: z.literal("locator"),
  reason: z.literal("locator_mismatch"),
  ...MaterializedDigestShapeV1,
});
const SnapshotStabilityExpectedV1Schema = z.strictObject({
  boundary: z.literal("snapshot_stability"),
  outcome: z.literal("accepted_frozen_snapshot"),
  authority: z.literal("none_real_fs_conformance_result_structure_only"),
  caseResultCount: PositiveSafeIntegerV1Schema,
  passedCaseResultCount: PositiveSafeIntegerV1Schema,
  ...MaterializedDigestShapeV1,
});
const InvalidMutationV1Schema = z.strictObject({
  dialect: z.literal(
    PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_RECIPE_DIALECT_V1,
  ),
  goldenResourcePath: z.literal(
    PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_PATH_V1,
  ),
  operation: InvalidCaseIdV1Schema,
});
const InvalidCaseV1Schema = z
  .strictObject({
    caseId: InvalidCaseIdV1Schema,
    mutation: InvalidMutationV1Schema,
    expected: z.discriminatedUnion("boundary", [
      InternalDiagnosticExpectedV1Schema,
      LocatorBuilderExpectedV1Schema,
      SnapshotStabilityExpectedV1Schema,
    ]),
  })
  .superRefine((value, context) => {
    if (value.mutation.operation !== value.caseId) {
      context.addIssue({
        code: "custom",
        path: ["mutation", "operation"],
        message: "mutation operation must equal its invalid case ID",
      });
    }
  });

export const ProviderRealFilesystemConformanceResultInvalidManifestV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  profile: z.literal(PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_PROFILE_V1),
  fixtureAuthority: z.literal("none_rejection_only"),
  canonicalizationProfile: z.literal("rfc8785-jcs-safe-integer-v1"),
  verificationProfile: z.literal("ed25519-rfc8032-cofactorless-prime-subgroup-v1"),
  semanticDomain: z.literal(
    PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_SEMANTIC_DOMAIN_V1,
  ),
  materializedRequestSemanticDomain: z.literal(
    PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
  ),
  goldenDependency: z.strictObject({
    resourcePath: z.literal(
      PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_PATH_V1,
    ),
    resourceByteLength: z.literal(
      PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    ),
    resourceSha256Hex: z.literal(
      PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_SHA256_HEX_V1,
    ),
    semanticContentDigest: z.literal(
      PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    ),
  }),
  mutationRecipeDialect: z.literal(
    PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_RECIPE_DIALECT_V1,
  ),
  caseCount: z.literal(INVALID_CASE_IDS_V1.length),
  caseIds: z.tuple(
    INVALID_CASE_IDS_V1.map((caseId) => z.literal(caseId)) as unknown as [
      z.ZodTypeAny,
      ...z.ZodTypeAny[],
    ],
  ),
  cases: z.array(InvalidCaseV1Schema).length(INVALID_CASE_IDS_V1.length),
  semanticContentDigest: z.literal(
    PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
  ),
});
export type ProviderRealFilesystemConformanceResultInvalidManifestV1 = z.infer<
  typeof ProviderRealFilesystemConformanceResultInvalidManifestV1Schema
>;

function bytesToLowerHexV1(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function rawSha256HexV1(bytes: Uint8Array): string {
  return bytesToLowerHexV1(sha256InternalV1(bytes));
}

function semanticDigestV1(domain: string, value: object): string {
  return `sha256:${rawSha256HexV1(canonicalizeJcsSafeIntegerUtf8V1([domain, value]))}`;
}

function parseJsonResourceV1(bytes: Uint8Array, label: string): unknown {
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes),
    );
  } catch {
    throw new ProviderRealFilesystemConformanceResultFixtureError(
      `${label} is not strict UTF-8 JSON`,
    );
  }
}

function verifyResourceAnchorV1(
  bytes: Uint8Array,
  expectedBytes: number,
  expectedSha256: string,
  label: string,
): void {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength > PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_FIXTURE_MAX_BYTES_V1 ||
    bytes.byteLength !== expectedBytes ||
    rawSha256HexV1(bytes) !== expectedSha256
  ) {
    throw new ProviderRealFilesystemConformanceResultFixtureError(
      `${label} bytes do not match the immutable anchor`,
    );
  }
}

export class ProviderRealFilesystemConformanceResultFixtureError extends TypeError {}

export async function verifyProviderRealFilesystemConformanceResultGoldenResourceV1(
  bytes: Uint8Array,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<{
  readonly authority: "none_real_fs_conformance_result_structure_only";
  readonly manifest: ProviderRealFilesystemConformanceResultGoldenManifestV1;
  readonly resultClosure: ProviderRealFilesystemConformanceResultClosureValidationV1;
}> {
  verifyResourceAnchorV1(
    bytes,
    PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_SHA256_HEX_V1,
    "real filesystem conformance result golden",
  );
  let manifest: ProviderRealFilesystemConformanceResultGoldenManifestV1;
  try {
    manifest = ProviderRealFilesystemConformanceResultGoldenManifestV1Schema.parse(
      parseJsonResourceV1(bytes, "real filesystem conformance result golden"),
    );
  } catch (error) {
    if (error instanceof ProviderRealFilesystemConformanceResultFixtureError) throw error;
    throw new ProviderRealFilesystemConformanceResultFixtureError(
      "real filesystem conformance result golden schema is invalid",
    );
  }
  const { semanticContentDigest: _semanticContentDigest, ...semanticFields } = manifest;
  if (
    semanticDigestV1(
      PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_SEMANTIC_DOMAIN_V1,
      semanticFields,
    ) !== manifest.semanticContentDigest
  ) {
    throw new ProviderRealFilesystemConformanceResultFixtureError(
      "real filesystem conformance result golden semantic digest mismatch",
    );
  }
  const resultClosure = await validateProviderRealFilesystemConformanceResultClosureV1({
    distributionRootBinding: manifest.distributionRootBinding,
    activeRootMetadata: manifest.activeRootMetadata,
    activeRoot: manifest.activeRoot,
    fixtureCorpusManifest: manifest.fixtureCorpusManifest,
    suiteManifest: manifest.suiteManifest,
    publicSupportTaxonomy: manifest.publicSupportTaxonomy,
    releaseMatrix: manifest.releaseMatrix,
    targetDiscoveryFixtureManifest: manifest.targetDiscoveryFixtureManifest,
    targetDiscoveryRunnerRun: manifest.targetDiscoveryRunnerRun,
    targetDiscoveryResult: manifest.targetDiscoveryResult,
    realFilesystemConformanceResult: manifest.realFilesystemConformanceResult,
    realFilesystemConformanceResultLocator: manifest.realFilesystemConformanceResultLocator,
    realFilesystemConformanceResultPin: manifest.realFilesystemConformanceResultPin,
    strictCryptoCapability,
  });
  const idPreimage = [
    "provider-real-fs-conformance-result-id-v1",
    projectProviderRealFilesystemConformanceResultIdFieldsV1(
      manifest.realFilesystemConformanceResult.payload,
    ),
  ];
  const targetMatchCount = manifest.targetDiscoveryResult.payload.targets.filter(
    (entry) =>
      canonicalizeJcsSafeIntegerUtf8V1(entry.target).toString() ===
      canonicalizeJcsSafeIntegerUtf8V1(
        manifest.realFilesystemConformanceResult.payload.target,
      ).toString(),
  ).length;
  if (
    resultClosure.authority !== manifest.fixtureAuthority ||
    resultClosure.caseResultCount !== manifest.expected.caseResultCount ||
    resultClosure.passedCaseResultCount !== manifest.expected.passedCaseResultCount ||
    resultClosure.failedCaseResultCount !== manifest.expected.failedCaseResultCount ||
    resultClosure.unsupportedCaseResultCount !== manifest.expected.unsupportedCaseResultCount ||
    resultClosure.relativePath !== manifest.expected.relativePath ||
    targetMatchCount !== manifest.expected.targetMatchCount ||
    bytesToLowerHexV1(canonicalizeJcsSafeIntegerUtf8V1(idPreimage)) !==
      manifest.expected.resultIdPreimageCanonicalUtf8Hex ||
    bytesToLowerHexV1(
      canonicalizeJcsSafeIntegerUtf8V1(manifest.realFilesystemConformanceResult.payload),
    ) !== manifest.expected.resultCanonicalUtf8Hex ||
    Object.keys(manifest.realFilesystemConformanceResult.payload).some((key) =>
      key.toLowerCase().includes("signature"),
    ) ||
    manifest.suiteManifest.payload.runnerProfileDigest !==
      manifest.realFilesystemConformanceResult.payload.runnerProfileDigest ||
    manifest.targetDiscoveryRunnerRun.payload.runnerProfileDigest ===
      manifest.realFilesystemConformanceResult.payload.runnerProfileDigest
  ) {
    throw new ProviderRealFilesystemConformanceResultFixtureError(
      "real filesystem conformance result golden expected projection mismatch",
    );
  }
  return Object.freeze({ authority: manifest.fixtureAuthority, manifest, resultClosure });
}

export function verifyProviderRealFilesystemConformanceResultInvalidResourceV1(
  bytes: Uint8Array,
): ProviderRealFilesystemConformanceResultInvalidManifestV1 {
  verifyResourceAnchorV1(
    bytes,
    PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_RESOURCE_BYTE_LENGTH_V1,
    PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_RESOURCE_SHA256_HEX_V1,
    "real filesystem conformance result invalid corpus",
  );
  let manifest: ProviderRealFilesystemConformanceResultInvalidManifestV1;
  try {
    manifest = ProviderRealFilesystemConformanceResultInvalidManifestV1Schema.parse(
      parseJsonResourceV1(bytes, "real filesystem conformance result invalid corpus"),
    );
  } catch (error) {
    if (error instanceof ProviderRealFilesystemConformanceResultFixtureError) throw error;
    throw new ProviderRealFilesystemConformanceResultFixtureError(
      "real filesystem conformance result invalid corpus schema is invalid",
    );
  }
  if (
    manifest.caseIds.some((caseId, index) => caseId !== INVALID_CASE_IDS_V1[index]) ||
    manifest.cases.some(
      (invalidCase, index) =>
        invalidCase.caseId !== INVALID_CASE_IDS_V1[index] ||
        invalidCase.mutation.operation !== invalidCase.caseId,
    )
  ) {
    throw new ProviderRealFilesystemConformanceResultFixtureError(
      "real filesystem conformance result invalid case inventory drift",
    );
  }
  const { semanticContentDigest: _semanticContentDigest, ...semanticFields } = manifest;
  if (
    semanticDigestV1(
      PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_SEMANTIC_DOMAIN_V1,
      semanticFields,
    ) !== manifest.semanticContentDigest
  ) {
    throw new ProviderRealFilesystemConformanceResultFixtureError(
      "real filesystem conformance result invalid semantic digest mismatch",
    );
  }
  return manifest;
}

const OUTCOME_CODE_INVALID_MUTATIONS_V1: Readonly<
  Partial<
    Record<
      ProviderRealFilesystemConformanceResultInvalidCaseIdV1,
      readonly [
        ProviderRealFilesystemConformanceCaseOutcomeV1,
        ProviderRealFilesystemConformanceResultCodeV1,
      ]
    >
  >
> = Object.freeze({
  "passed-code-mismatch": ["passed", "provider_rejected"],
  "unsupported-code-mismatch": ["unsupported", "passed"],
  "failed-code-mismatch": ["failed", "unsupported_by_target_profile"],
  "passed-assertion-failed-code-mismatch": ["passed", "assertion_failed"],
  "passed-crash-recovery-failed-code-mismatch": ["passed", "crash_recovery_failed"],
  "passed-identity-discontinuity-code-mismatch": ["passed", "identity_discontinuity"],
  "passed-containment-violation-code-mismatch": ["passed", "containment_violation"],
  "passed-unsupported-by-target-profile-code-mismatch": [
    "passed",
    "unsupported_by_target_profile",
  ],
  "unsupported-assertion-failed-code-mismatch": ["unsupported", "assertion_failed"],
  "unsupported-provider-rejected-code-mismatch": ["unsupported", "provider_rejected"],
  "unsupported-crash-recovery-failed-code-mismatch": [
    "unsupported",
    "crash_recovery_failed",
  ],
  "unsupported-identity-discontinuity-code-mismatch": [
    "unsupported",
    "identity_discontinuity",
  ],
  "unsupported-containment-violation-code-mismatch": [
    "unsupported",
    "containment_violation",
  ],
  "failed-passed-code-mismatch": ["failed", "passed"],
});

const EXECUTABLE_ONLY_CASE_IDS_V1: ReadonlySet<
  ProviderRealFilesystemConformanceResultInvalidCaseIdV1
> = new Set([
  "locator-envelope-substitution",
  "security-top-level-proxy",
  "security-nested-proxy",
  "security-top-level-getter",
  "security-nested-getter",
  "security-nested-hidden",
  "security-nested-symbol",
  "security-sparse-array",
  "security-cycle",
  "security-alias",
  "security-async-mutation",
]);

function jsonCloneV1<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function aggregateCaseResultsV1(
  caseResults: readonly { readonly outcome: ProviderRealFilesystemConformanceCaseOutcomeV1 }[],
): ProviderRealFilesystemConformanceCaseOutcomeV1 {
  if (caseResults.some((entry) => entry.outcome === "failed")) return "failed";
  if (caseResults.some((entry) => entry.outcome === "unsupported")) return "unsupported";
  return "passed";
}

function finalizeResultV1(base: z.infer<typeof ProviderRealFilesystemConformanceResultV1Schema>) {
  const result = aggregateCaseResultsV1(base.caseResults);
  const {
    profile: _profile,
    resultId: _oldResultId,
    result: _oldResult,
    ...fields
  } = base;
  const resultId = deriveProviderRealFilesystemConformanceResultIdV1({
    ...fields,
    result,
  });
  const payload = ProviderRealFilesystemConformanceResultV1Schema.parse({
    ...fields,
    profile: "provider_real_fs_conformance_result_v1",
    resultId,
    result,
  });
  const envelope = ProviderRealFilesystemConformanceResultEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_real_fs_conformance_result",
    resultId,
    contentDigest: deriveProviderRealFilesystemConformanceResultContentDigestV1(payload),
    payload,
  });
  const locator = ProviderRealFilesystemConformanceResultLocatorV1Schema.parse({
    locatorProfile: "installation_provider_real_fs_conformance_result_v1",
    resultId,
  });
  const pin = ProviderRealFilesystemConformanceResultPinV1Schema.parse({
    ...locator,
    contentDigest: envelope.contentDigest,
  });
  return { envelope, locator, pin };
}

function requestFromGoldenV1(
  golden: ProviderRealFilesystemConformanceResultGoldenManifestV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): ValidateProviderRealFilesystemConformanceResultClosureV1Input {
  return {
    distributionRootBinding: jsonCloneV1(golden.distributionRootBinding),
    activeRootMetadata: jsonCloneV1(golden.activeRootMetadata),
    activeRoot: jsonCloneV1(golden.activeRoot),
    fixtureCorpusManifest: jsonCloneV1(golden.fixtureCorpusManifest),
    suiteManifest: jsonCloneV1(golden.suiteManifest),
    publicSupportTaxonomy: jsonCloneV1(golden.publicSupportTaxonomy),
    releaseMatrix: jsonCloneV1(golden.releaseMatrix),
    targetDiscoveryFixtureManifest: jsonCloneV1(golden.targetDiscoveryFixtureManifest),
    targetDiscoveryRunnerRun: jsonCloneV1(golden.targetDiscoveryRunnerRun),
    targetDiscoveryResult: jsonCloneV1(golden.targetDiscoveryResult),
    realFilesystemConformanceResult: jsonCloneV1(golden.realFilesystemConformanceResult),
    realFilesystemConformanceResultLocator: jsonCloneV1(
      golden.realFilesystemConformanceResultLocator,
    ),
    realFilesystemConformanceResultPin: jsonCloneV1(
      golden.realFilesystemConformanceResultPin,
    ),
    strictCryptoCapability,
  };
}

function refinalizeRequestResultV1(
  request: ValidateProviderRealFilesystemConformanceResultClosureV1Input,
): void {
  const finalized = finalizeResultV1(request.realFilesystemConformanceResult.payload);
  Object.assign(request, {
    realFilesystemConformanceResult: finalized.envelope,
    realFilesystemConformanceResultLocator: finalized.locator,
    realFilesystemConformanceResultPin: finalized.pin,
  });
}

function bitflipSignatureV1(signature: string): string {
  const last = signature.at(-1);
  return `${signature.slice(0, -1)}${last === "0" ? "1" : "0"}`;
}

function appendFreshCopiesV1(
  target: unknown[],
  template: unknown,
  count: number,
): void {
  for (let remaining = count; remaining > 0; remaining -= 10_000) {
    const chunkLength = Math.min(remaining, 10_000);
    target.push(...Array.from({ length: chunkLength }, () => jsonCloneV1(template)));
  }
}

function materializeExactEnvelopeLimitOverflowV1(envelope: {
  payload: {
    caseResults: Array<Record<string, unknown>>;
    result: ProviderRealFilesystemConformanceCaseOutcomeV1;
  };
}): void {
  const targetByteLength =
    PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_MAX_CANONICAL_BYTES_V1 + 1;
  const primary = jsonCloneV1(envelope.payload.caseResults[0]);
  if (primary === undefined) throw new TypeError("golden result has no case result");
  const secondary = {
    ...jsonCloneV1(primary),
    outcome: "failed",
    resultCode: "assertion_failed",
  };
  envelope.payload.result = "failed";
  const currentByteLength = canonicalizeJcsSafeIntegerUtf8V1(envelope).byteLength;
  const remainingBytes = targetByteLength - currentByteLength;
  const primaryContribution = canonicalizeJcsSafeIntegerUtf8V1(primary).byteLength + 1;
  const secondaryContribution = canonicalizeJcsSafeIntegerUtf8V1(secondary).byteLength + 1;
  let primaryCount = -1;
  let secondaryCount = -1;
  for (
    let candidateSecondaryCount = 0;
    candidateSecondaryCount < primaryContribution &&
    candidateSecondaryCount * secondaryContribution <= remainingBytes;
    candidateSecondaryCount += 1
  ) {
    const primaryBytes = remainingBytes - candidateSecondaryCount * secondaryContribution;
    if (primaryBytes % primaryContribution === 0) {
      primaryCount = primaryBytes / primaryContribution;
      secondaryCount = candidateSecondaryCount;
      break;
    }
  }
  if (primaryCount < 0 || secondaryCount < 0) {
    throw new TypeError("cannot construct exact MAX+1 conformance result envelope");
  }
  appendFreshCopiesV1(envelope.payload.caseResults, primary, primaryCount);
  appendFreshCopiesV1(envelope.payload.caseResults, secondary, secondaryCount);
  if (canonicalizeJcsSafeIntegerUtf8V1(envelope).byteLength !== targetByteLength) {
    throw new TypeError("exact MAX+1 conformance result envelope drifted");
  }
}

function materializeJsonInvalidRequestV1(
  golden: ProviderRealFilesystemConformanceResultGoldenManifestV1,
  caseId: ProviderRealFilesystemConformanceResultInvalidCaseIdV1,
): Record<string, unknown> {
  const request = requestFromGoldenV1(
    golden,
    Object.freeze({ fixturePlaceholder: true }) as unknown as
      ProviderStrictEd25519OpaqueCapabilityV1,
  );
  const mutableRequest = request as unknown as Record<string, unknown> & {
    realFilesystemConformanceResult: z.infer<
      typeof ProviderRealFilesystemConformanceResultEnvelopeV1Schema
    >;
    suiteManifest: ProviderRealFilesystemConformanceResultGoldenManifestV1["suiteManifest"];
    targetDiscoveryRunnerRun:
      ProviderRealFilesystemConformanceResultGoldenManifestV1["targetDiscoveryRunnerRun"];
    realFilesystemConformanceResultLocator: Record<string, unknown>;
    realFilesystemConformanceResultPin: Record<string, unknown>;
  };
  const envelope = mutableRequest.realFilesystemConformanceResult;
  const result = envelope.payload;
  const outcomeCodeMutation = OUTCOME_CODE_INVALID_MUTATIONS_V1[caseId];
  if (outcomeCodeMutation !== undefined) {
    const first = result.caseResults[0];
    if (first === undefined) throw new TypeError("golden result has no case result");
    first.outcome = outcomeCodeMutation[0];
    first.resultCode = outcomeCodeMutation[1];
    refinalizeRequestResultV1(request);
  } else {
    switch (caseId) {
      case "input-extra-field": mutableRequest.unexpected = true; break;
      case "input-plain-validation-dto": return {
        targetDiscoveryPoint: {
          authority: "none_target_discovery_point_structure_only",
        },
        realFilesystemConformanceResult: envelope,
      };
      case "result-extra-signature": Object.assign(result, {
        resultSignature: `ed25519:${"0".repeat(128)}`,
      }); break;
      case "source-suite-signature-bitflip":
        mutableRequest.suiteManifest.payload.suiteSignature = bitflipSignatureV1(
          mutableRequest.suiteManifest.payload.suiteSignature,
        ) as typeof mutableRequest.suiteManifest.payload.suiteSignature;
        break;
      case "target-id-not-recomputed": result.target.osBuildDigest =
        `sha256:${"f".repeat(64)}` as typeof result.target.osBuildDigest; break;
      case "target-not-discovered": {
        result.target.osBuildDigest =
          `sha256:${"e".repeat(64)}` as typeof result.target.osBuildDigest;
        const { targetProfileId: _targetProfileId, ...targetFields } = result.target;
        result.target.targetProfileId = deriveProviderTargetProfileIdV1(targetFields);
        refinalizeRequestResultV1(request);
        break;
      }
      case "discovery-pin-mismatch": result.targetDiscoveryResult.contentDigest =
        `sha256:${"d".repeat(64)}` as typeof result.targetDiscoveryResult.contentDigest; break;
      case "bundle-digest-mismatch": result.targetDiscoveryInputBundleContentDigest =
        `sha256:${"d".repeat(64)}` as typeof result.targetDiscoveryInputBundleContentDigest; break;
      case "suite-pin-mismatch": result.realFilesystemSuiteManifest.contentDigest =
        mutableRequest.suiteManifest.payload.suiteDigest as
          typeof result.realFilesystemSuiteManifest.contentDigest; break;
      case "suite-digest-mismatch": result.suiteDigest =
        `sha256:${"d".repeat(64)}` as typeof result.suiteDigest; break;
      case "fixture-digest-mismatch": result.fixtureManifestDigest =
        `sha256:${"d".repeat(64)}` as typeof result.fixtureManifestDigest; break;
      case "runner-digest-mismatch": result.runnerProfileDigest =
        mutableRequest.targetDiscoveryRunnerRun.payload.runnerProfileDigest; break;
      case "crash-cut-digest-mismatch": result.crashCutCoverageDigest =
        `sha256:${"d".repeat(64)}` as typeof result.crashCutCoverageDigest; break;
      case "case-results-reordered": result.caseResults.reverse(); break;
      case "case-result-missing": result.caseResults.pop(); break;
      case "case-result-extra": {
        const first = result.caseResults[0];
        if (first === undefined) throw new TypeError("golden result has no case result");
        result.caseResults.push(jsonCloneV1(first));
        break;
      }
      case "case-result-duplicate": {
        const first = result.caseResults[0];
        if (first === undefined || result.caseResults.length < 2) {
          throw new TypeError("golden result has insufficient case results");
        }
        result.caseResults[1] = jsonCloneV1(first);
        break;
      }
      case "aggregate-mismatch": result.result = "failed"; break;
      case "result-id-mismatch":
        result.resultId = `provider-real-fs-result:${"0".repeat(22)}` as typeof result.resultId;
        envelope.resultId = result.resultId;
        break;
      case "result-content-digest-mismatch": envelope.contentDigest =
        `sha256:${"0".repeat(64)}` as typeof envelope.contentDigest; break;
      case "result-outer-id-mismatch": envelope.resultId =
        `provider-real-fs-result:${"0".repeat(22)}` as typeof envelope.resultId; break;
      case "locator-profile-mismatch":
        mutableRequest.realFilesystemConformanceResultLocator.locatorProfile =
          "distribution_provider_real_fs_suite_manifest_v1";
        break;
      case "locator-id-mismatch":
        mutableRequest.realFilesystemConformanceResultLocator.resultId =
          `provider-real-fs-result:${"0".repeat(22)}`;
        break;
      case "pin-content-digest-mismatch":
        mutableRequest.realFilesystemConformanceResultPin.contentDigest =
          `sha256:${"0".repeat(64)}`;
        break;
      case "result-envelope-16mib-plus-one":
        materializeExactEnvelopeLimitOverflowV1(
          envelope as unknown as Parameters<
            typeof materializeExactEnvelopeLimitOverflowV1
          >[0],
        );
        break;
      default:
        if (!EXECUTABLE_ONLY_CASE_IDS_V1.has(caseId)) {
          throw new TypeError(`unknown conformance result invalid case ${caseId}`);
        }
    }
  }
  const { strictCryptoCapability: _strictCryptoCapability, ...materialized } = request;
  return materialized;
}

export function materializeProviderRealFilesystemConformanceResultInvalidRequestWitnessV1(
  golden: ProviderRealFilesystemConformanceResultGoldenManifestV1,
  caseId: ProviderRealFilesystemConformanceResultInvalidCaseIdV1,
): unknown {
  if (EXECUTABLE_ONLY_CASE_IDS_V1.has(caseId)) {
    return {
      caseId,
      executionProfile: caseId.startsWith("security-")
        ? "provider_real_filesystem_conformance_result_hostile_input_execution_v1"
        : "provider_real_filesystem_conformance_result_complete_envelope_locator_execution_v1",
      goldenSemanticContentDigest: golden.semanticContentDigest,
    };
  }
  return { caseId, request: materializeJsonInvalidRequestV1(golden, caseId) };
}

function hostileInputExecutionV1(
  golden: ProviderRealFilesystemConformanceResultGoldenManifestV1,
  caseId: ProviderRealFilesystemConformanceResultInvalidCaseIdV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): { readonly input: unknown; readonly getterCalls: () => number } {
  const request = requestFromGoldenV1(golden, strictCryptoCapability) as
    ValidateProviderRealFilesystemConformanceResultClosureV1Input & Record<PropertyKey, unknown>;
  let getterCalls = 0;
  switch (caseId) {
    case "security-top-level-proxy":
      return { input: new Proxy(request, {}), getterCalls: () => getterCalls };
    case "security-nested-proxy":
      request.realFilesystemConformanceResult.payload = new Proxy(
        request.realFilesystemConformanceResult.payload,
        {},
      );
      break;
    case "security-top-level-getter":
      Object.defineProperty(request, "unexpected", {
        enumerable: true,
        get() {
          getterCalls += 1;
          return true;
        },
      });
      break;
    case "security-nested-getter":
      Object.defineProperty(request.realFilesystemConformanceResult.payload, "unexpected", {
        enumerable: true,
        get() {
          getterCalls += 1;
          return true;
        },
      });
      break;
    case "security-nested-hidden":
      Object.defineProperty(request.realFilesystemConformanceResult.payload, "hidden", {
        enumerable: false,
        value: true,
      });
      break;
    case "security-nested-symbol":
      Object.defineProperty(
        request.realFilesystemConformanceResult.payload,
        Symbol("hostile"),
        { enumerable: true, value: true },
      );
      break;
    case "security-sparse-array":
      delete request.realFilesystemConformanceResult.payload.caseResults[0];
      break;
    case "security-cycle": request.cycle = request; break;
    case "security-alias":
      request.realFilesystemConformanceResult.payload.target =
        request.targetDiscoveryResult.payload.targets[0]!.target;
      break;
    case "security-async-mutation": break;
    default: throw new TypeError(`unknown hostile input case ${caseId}`);
  }
  return { input: request, getterCalls: () => getterCalls };
}

export type ProviderRealFilesystemConformanceResultInvalidCaseExecutionV1 =
  | Readonly<{ kind: "unexpected_acceptance" }>
  | Readonly<{
      kind: "rejection";
      boundary: "locator_builder";
      stage: "locator";
      reason: "locator_mismatch";
    }>
  | Readonly<{
      kind: "rejection";
      boundary: "internal_diagnostic";
      stage: z.infer<typeof ProviderRealFilesystemConformanceResultInvalidStageV1Schema>;
      reason: z.infer<typeof ProviderRealFilesystemConformanceResultInvalidReasonV1Schema>;
      publicFailure: Readonly<{
        errorName: unknown;
        code: unknown;
        reason: unknown;
      }> | undefined;
    }>
  | Readonly<{
      kind: "snapshot_acceptance";
      boundary: "snapshot_stability";
      authority: "none_real_fs_conformance_result_structure_only";
      caseResultCount: number;
      passedCaseResultCount: number;
    }>;

function publicFailureProjectionV1(error: unknown): {
  readonly errorName: unknown;
  readonly code: unknown;
  readonly reason: unknown;
} | undefined {
  if (error === null || typeof error !== "object") return undefined;
  const candidate = error as Record<string, unknown>;
  return {
    errorName: candidate.name,
    code: candidate.code,
    reason: candidate.reason,
  };
}

export async function executeProviderRealFilesystemConformanceResultInvalidCaseV1(
  golden: ProviderRealFilesystemConformanceResultGoldenManifestV1,
  caseId: ProviderRealFilesystemConformanceResultInvalidCaseIdV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<ProviderRealFilesystemConformanceResultInvalidCaseExecutionV1> {
  if (caseId === "locator-envelope-substitution") {
    try {
      buildProviderRealFilesystemConformanceResultRelativePathV1(
        jsonCloneV1(golden.realFilesystemConformanceResult),
      );
      return { kind: "unexpected_acceptance" };
    } catch (error) {
      if (
        !(error instanceof TypeError) ||
        error.message !==
          "real filesystem conformance result path requires the exact locator DTO"
      ) {
        throw error;
      }
      return {
        kind: "rejection",
        boundary: "locator_builder",
        stage: "locator",
        reason: "locator_mismatch",
      };
    }
  }

  if (caseId === "security-async-mutation") {
    const { input } = hostileInputExecutionV1(golden, caseId, strictCryptoCapability);
    const typedInput = input as ValidateProviderRealFilesystemConformanceResultClosureV1Input;
    const pending = validateProviderRealFilesystemConformanceResultClosureV1(typedInput);
    typedInput.realFilesystemConformanceResult.payload.result = "failed";
    typedInput.realFilesystemConformanceResult.payload.caseResults[0]!.outcome = "failed";
    typedInput.realFilesystemConformanceResult.payload.caseResults[0]!.resultCode =
      "assertion_failed";
    const value = await pending;
    return {
      kind: "snapshot_acceptance",
      boundary: "snapshot_stability",
      authority: value.authority,
      caseResultCount: value.caseResultCount,
      passedCaseResultCount: value.passedCaseResultCount,
    };
  }

  const executable = caseId.startsWith("security-")
    ? hostileInputExecutionV1(golden, caseId, strictCryptoCapability)
    : {
        input: {
          ...materializeJsonInvalidRequestV1(golden, caseId),
          strictCryptoCapability,
        },
        getterCalls: () => 0,
      };
  const diagnostic = await diagnoseProviderRealFilesystemConformanceResultClosureV1(
    executable.input,
  );
  if (executable.getterCalls() !== 0) {
    throw new Error(`${caseId} executed an attacker-owned getter`);
  }
  let publicFailure:
    | { readonly errorName: unknown; readonly code: unknown; readonly reason: unknown }
    | undefined;
  try {
    await validateProviderRealFilesystemConformanceResultClosureV1(
      executable.input as ValidateProviderRealFilesystemConformanceResultClosureV1Input,
    );
  } catch (error) {
    publicFailure = publicFailureProjectionV1(error);
  }
  if (executable.getterCalls() !== 0) {
    throw new Error(`${caseId} executed an attacker-owned getter during public validation`);
  }
  if (diagnostic.ok) return { kind: "unexpected_acceptance" };
  return {
    kind: "rejection",
    boundary: "internal_diagnostic",
    stage: diagnostic.stage,
    reason: diagnostic.reason,
    publicFailure,
  };
}
