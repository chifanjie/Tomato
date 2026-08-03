import { z } from "zod";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  LowerHex64V1Schema,
} from "./primitives.js";
import { ProviderSignedDistributionRootBindingV1Schema } from "./provider-distribution-trust.js";
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
  ProviderTargetDiscoveryPointInvalidReasonV1Schema,
  ProviderTargetDiscoveryPointInvalidStageV1Schema,
  ProviderTargetDiscoveryResultEnvelopeV1Schema,
  ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema,
  createProviderPublicSupportTaxonomySignatureMessageV1,
  createProviderReleaseMatrixSignatureMessageV1,
  createProviderTargetDiscoveryInputBundleSignatureMessageV1,
  createProviderTargetDiscoveryResultSignatureMessageV1,
  validateProviderTargetDiscoveryPointClosureV1,
  type ProviderTargetDiscoveryPointClosureValidationV1,
} from "./provider-target-discovery-point.js";
import type { ProviderStrictEd25519OpaqueCapabilityV1 } from "./strict-ed25519-conformance.js";

export const PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_PROFILE_V1 =
  "provider_target_discovery_point_golden_v1" as const;
export const PROVIDER_TARGET_DISCOVERY_POINT_INVALID_PROFILE_V1 =
  "provider_target_discovery_point_invalid_v1" as const;
export const PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_SEMANTIC_DOMAIN_V1 =
  "provider-target-discovery-point-golden-manifest-v1" as const;
export const PROVIDER_TARGET_DISCOVERY_POINT_INVALID_SEMANTIC_DOMAIN_V1 =
  "provider-target-discovery-point-invalid-manifest-v1" as const;
export const PROVIDER_TARGET_DISCOVERY_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1 =
  "provider-target-discovery-point-invalid-materialized-request-v1" as const;
export const PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RECIPE_DIALECT_V1 =
  "provider_target_discovery_point_invalid_recipe_v1" as const;
export const PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_PATH_V1 =
  "fixtures/v1/golden/provider-target-discovery-point-v1.json" as const;
export const PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RESOURCE_PATH_V1 =
  "fixtures/v1/invalid/provider-target-discovery-point-v1.json" as const;
export const PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1 =
  205_053 as const;
export const PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1 =
  "cfcc03e388e46bf23b1fe62e513476991c535bc22887ff01b77eca4f01b979ed" as const;
export const PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:4ad3ff9e4459207059ded87d51cebb29c5ec36b03c994ee5d3cb61604eda98ae" as const;
export const PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1 =
  98_186 as const;
export const PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RESOURCE_SHA256_HEX_V1 =
  "bb0ed1ad0f14698c9378ff42b242b2a09355a3ccb2472213a001f3f0a6162f05" as const;
export const PROVIDER_TARGET_DISCOVERY_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:77f3f36e9a7855007fc75706d22c5e43571aa83e8c710619a53f879ea1fc6de1" as const;
export const PROVIDER_TARGET_DISCOVERY_POINT_FIXTURE_MAX_BYTES_V1 =
  1_048_576 as const;

const EvenLowerHexV1Schema = z.string().regex(/^(?:[0-9a-f]{2})+$/u);
const ResourceSha256HexV1Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const PositiveSafeIntegerV1Schema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const NonnegativeSafeIntegerV1Schema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const LocatorPathsV1Schema = z.strictObject({
  publicSupportTaxonomy: z.string().regex(/^provider\/public-support-taxonomy\/(?:id-[0-9a-v]+|idh-[0-9a-f]{64})\.json$/u),
  releaseMatrix: z.string().regex(/^provider\/release-matrix\/(?:id-[0-9a-v]+|idh-[0-9a-f]{64})\.json$/u),
  targetDiscoveryFixtureManifest: z.string().regex(/^provider\/real-fs-fixture-manifests\/(?:id-[0-9a-v]+|idh-[0-9a-f]{64})\.json$/u),
  targetDiscoveryRunnerRun: z.string().regex(/^provider\/target-discovery-runner-runs\/(?:id-[0-9a-v]+|idh-[0-9a-f]{64})\.json$/u),
  targetDiscoveryResult: z.string().regex(/^provider\/target-discovery-results\/(?:id-[0-9a-v]+|idh-[0-9a-f]{64})\.json$/u),
});

export const ProviderTargetDiscoveryPointGoldenManifestV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  profile: z.literal(PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_PROFILE_V1),
  fixtureAuthority: z.literal("none_target_discovery_point_structure_only"),
  canonicalizationProfile: z.literal("rfc8785-jcs-safe-integer-v1"),
  verificationProfile: z.literal("ed25519-rfc8032-cofactorless-prime-subgroup-v1"),
  deterministicRootSeedHex: LowerHex64V1Schema,
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
  expected: z.strictObject({
    taxonomySignatureMessageUtf8Hex: EvenLowerHexV1Schema,
    matrixSignatureMessageUtf8Hex: EvenLowerHexV1Schema,
    bundleSignatureMessageUtf8Hex: EvenLowerHexV1Schema,
    resultSignatureMessageUtf8Hex: EvenLowerHexV1Schema,
    bundleCanonicalUtf8Hex: EvenLowerHexV1Schema,
    locators: LocatorPathsV1Schema,
    sourceRecordCount: PositiveSafeIntegerV1Schema,
    observationCount: NonnegativeSafeIntegerV1Schema,
    targetCount: NonnegativeSafeIntegerV1Schema,
    unresolvedObservationCount: NonnegativeSafeIntegerV1Schema,
    signatureVerificationCount: z.literal(6),
  }),
  semanticDomain: z.literal(PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_SEMANTIC_DOMAIN_V1),
  dependencies: z.strictObject({
    sourceGoldenResourcePath: z.literal("fixtures/v1/golden/provider-real-filesystem-source-v1.json"),
    sourceGoldenResourceByteLength: PositiveSafeIntegerV1Schema,
    sourceGoldenResourceSha256Hex: ResourceSha256HexV1Schema,
    sourceGoldenSemanticContentDigest: ContentDigestV1Schema,
  }),
  semanticContentDigest: z.literal(PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1),
});
export type ProviderTargetDiscoveryPointGoldenManifestV1 = z.infer<
  typeof ProviderTargetDiscoveryPointGoldenManifestV1Schema
>;

const INVALID_CASE_IDS_V1 = [
  "input-extra-field",
  "input-missing-result",
  "taxonomy-envelope-extra-field",
  "taxonomy-code-mismatch",
  "taxonomy-order-reversed",
  "taxonomy-signature-bitflip",
  "taxonomy-envelope-digest-mismatch",
  "taxonomy-outer-generation-mismatch",
  "matrix-taxonomy-pin-mismatch",
  "matrix-target-count-mismatch",
  "matrix-target-id-mismatch",
  "matrix-public-id-mismatch",
  "matrix-target-order-reversed",
  "matrix-target-set-digest-mismatch",
  "matrix-signature-bitflip",
  "matrix-envelope-digest-mismatch",
  "fixture-suite-pin-mismatch",
  "fixture-suite-semantic-digest-mismatch",
  "fixture-corpus-semantic-digest-mismatch",
  "fixture-record-ordinal-gap",
  "fixture-record-count-mismatch",
  "fixture-record-set-digest-mismatch",
  "fixture-envelope-content-digest-mismatch",
  "runner-record-ordinal-gap",
  "runner-record-count-mismatch",
  "runner-record-set-digest-mismatch",
  "runner-envelope-content-digest-mismatch",
  "bundle-taxonomy-pin-mismatch",
  "bundle-fixture-pin-mismatch",
  "bundle-runner-pin-mismatch",
  "bundle-observation-cut-mismatch",
  "bundle-observation-cut-digest-mismatch",
  "bundle-source-summary-order-reversed",
  "bundle-observation-count-mismatch",
  "bundle-observation-outcome-rewritten",
  "bundle-observation-key-mismatch",
  "bundle-observation-set-digest-mismatch",
  "bundle-signature-bitflip",
  "result-bundle-content-digest-mismatch",
  "result-target-count-mismatch",
  "result-target-order-reversed",
  "result-target-set-digest-mismatch",
  "result-unresolved-count-mismatch",
  "result-unresolved-order-reversed",
  "result-signature-bitflip",
  "result-envelope-content-digest-mismatch",
  "resolved-target-conflict",
  "source-suite-signature-bitflip",
  "caller-distribution-binding-mismatch",
  "caller-active-root-metadata-mismatch",
  "caller-active-root-key-mismatch",
  "taxonomy-distribution-binding-mismatch",
  "taxonomy-active-root-mismatch",
  "taxonomy-root-key-id-mismatch",
  "matrix-distribution-binding-mismatch",
  "matrix-active-root-mismatch",
  "matrix-root-key-id-mismatch",
  "fixture-distribution-binding-mismatch",
  "fixture-release-revision-mismatch",
  "runner-distribution-binding-mismatch",
  "runner-release-revision-mismatch",
  "bundle-distribution-binding-mismatch",
  "bundle-active-root-mismatch",
  "bundle-root-key-id-mismatch",
  "result-distribution-binding-mismatch",
  "result-active-root-mismatch",
  "result-root-key-id-mismatch",
  "taxonomy-signature-wrong-signer",
  "taxonomy-signature-wrong-domain",
  "taxonomy-signature-wrong-prefix",
  "taxonomy-signature-wrong-claims",
  "matrix-signature-wrong-signer",
  "matrix-signature-wrong-domain",
  "matrix-signature-wrong-prefix",
  "matrix-signature-wrong-claims",
  "bundle-signature-wrong-signer",
  "bundle-signature-wrong-domain",
  "bundle-signature-wrong-prefix",
  "bundle-signature-wrong-claims",
  "result-signature-wrong-signer",
  "result-signature-wrong-domain",
  "result-signature-wrong-prefix",
  "result-signature-wrong-claims",
  "matrix-source-artifact-semantic-digest-substitution",
  "fixture-source-artifact-semantic-digest-substitution",
  "runner-source-artifact-semantic-digest-substitution",
  "bundle-observation-missing",
  "bundle-observation-extra",
  "bundle-observation-duplicate",
  "bundle-observation-reordered",
  "matrix-target-4097",
  "result-target-4097",
  "result-unresolved-4097",
  "embedded-bundle-16mib-plus-one",
  "runner-envelope-16mib-plus-one",
  "taxonomy-locator-bare-dto",
  "matrix-locator-bare-dto",
  "fixture-locator-bare-digest",
  "runner-locator-bare-digest",
  "result-locator-bare-dto",
  "fixture-locator-semantic-digest-substitution",
  "fixture-locator-outer-semantic-digest-mismatch",
  "runner-locator-semantic-digest-substitution",
  "taxonomy-locator-path-alias",
  "matrix-locator-latest-alias",
  "result-locator-path-alias",
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
export const PROVIDER_TARGET_DISCOVERY_POINT_INVALID_CASE_IDS_V1 = Object.freeze([...INVALID_CASE_IDS_V1]);
const InvalidCaseIdV1Schema = z.enum(INVALID_CASE_IDS_V1);
const InvalidMutationV1Schema = z.strictObject({
  dialect: z.literal(PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RECIPE_DIALECT_V1),
  goldenResourcePath: z.literal(PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_PATH_V1),
  operation: InvalidCaseIdV1Schema,
});
const InternalDiagnosticExpectedV1Schema = z.strictObject({
    boundary: z.literal("internal_diagnostic"),
    stage: ProviderTargetDiscoveryPointInvalidStageV1Schema,
    reason: ProviderTargetDiscoveryPointInvalidReasonV1Schema,
    publicFailureReason: z.literal("attestation_invalid"),
    publicFailure: z.strictObject({
      errorName: z.literal("ProviderTargetDiscoveryPointClosureValidationError"),
      code: z.literal("provider_unavailable"),
      reason: z.literal("attestation_invalid"),
    }),
    materializedRequestSemanticDigest: ContentDigestV1Schema,
});
const LocatorBuilderExpectedV1Schema = z.strictObject({
  boundary: z.literal("locator_builder"),
  stage: z.literal("locator"),
  reason: z.literal("envelope_mismatch"),
  materializedRequestSemanticDigest: ContentDigestV1Schema,
});
const SnapshotStabilityExpectedV1Schema = z.strictObject({
  boundary: z.literal("snapshot_stability"),
  outcome: z.literal("accepted_frozen_snapshot"),
  authority: z.literal("none_target_discovery_point_structure_only"),
  observationCount: NonnegativeSafeIntegerV1Schema,
  targetCount: NonnegativeSafeIntegerV1Schema,
  unresolvedObservationCount: NonnegativeSafeIntegerV1Schema,
  materializedRequestSemanticDigest: ContentDigestV1Schema,
});
const InvalidCaseV1Schema = z.strictObject({
  caseId: InvalidCaseIdV1Schema,
  mutation: InvalidMutationV1Schema,
  expected: z.discriminatedUnion("boundary", [
    InternalDiagnosticExpectedV1Schema,
    LocatorBuilderExpectedV1Schema,
    SnapshotStabilityExpectedV1Schema,
  ]),
});
export const ProviderTargetDiscoveryPointInvalidManifestV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  profile: z.literal(PROVIDER_TARGET_DISCOVERY_POINT_INVALID_PROFILE_V1),
  fixtureAuthority: z.literal("none_rejection_only"),
  canonicalizationProfile: z.literal("rfc8785-jcs-safe-integer-v1"),
  verificationProfile: z.literal("ed25519-rfc8032-cofactorless-prime-subgroup-v1"),
  semanticDomain: z.literal(PROVIDER_TARGET_DISCOVERY_POINT_INVALID_SEMANTIC_DOMAIN_V1),
  materializedRequestSemanticDomain: z.literal(PROVIDER_TARGET_DISCOVERY_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1),
  goldenDependency: z.strictObject({
    resourcePath: z.literal(PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_PATH_V1),
    resourceByteLength: z.literal(PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1),
    resourceSha256Hex: z.literal(PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1),
    semanticContentDigest: z.literal(PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1),
  }),
  mutationRecipeDialect: z.literal(PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RECIPE_DIALECT_V1),
  caseCount: z.literal(INVALID_CASE_IDS_V1.length),
  caseIds: z.tuple(INVALID_CASE_IDS_V1.map((caseId) => z.literal(caseId)) as unknown as [z.ZodTypeAny, ...z.ZodTypeAny[]]),
  cases: z.array(InvalidCaseV1Schema).length(INVALID_CASE_IDS_V1.length),
  semanticContentDigest: z.literal(PROVIDER_TARGET_DISCOVERY_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1),
});
export type ProviderTargetDiscoveryPointInvalidManifestV1 = z.infer<
  typeof ProviderTargetDiscoveryPointInvalidManifestV1Schema
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
    return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes));
  } catch {
    throw new ProviderTargetDiscoveryPointFixtureError(`${label} is not strict UTF-8 JSON`);
  }
}
function verifyResourceAnchorV1(bytes: Uint8Array, expectedBytes: number, expectedSha256: string, label: string): void {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength > PROVIDER_TARGET_DISCOVERY_POINT_FIXTURE_MAX_BYTES_V1 ||
    bytes.byteLength !== expectedBytes ||
    rawSha256HexV1(bytes) !== expectedSha256
  ) throw new ProviderTargetDiscoveryPointFixtureError(`${label} bytes do not match the immutable anchor`);
}

export class ProviderTargetDiscoveryPointFixtureError extends TypeError {}

export async function verifyProviderTargetDiscoveryPointGoldenResourceV1(
  bytes: Uint8Array,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<{
  readonly authority: "none_target_discovery_point_structure_only";
  readonly manifest: ProviderTargetDiscoveryPointGoldenManifestV1;
  readonly pointClosure: ProviderTargetDiscoveryPointClosureValidationV1;
}> {
  verifyResourceAnchorV1(
    bytes,
    PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
    "target discovery golden",
  );
  let manifest: ProviderTargetDiscoveryPointGoldenManifestV1;
  try {
    manifest = ProviderTargetDiscoveryPointGoldenManifestV1Schema.parse(
      parseJsonResourceV1(bytes, "target discovery golden"),
    );
  } catch (error) {
    if (error instanceof ProviderTargetDiscoveryPointFixtureError) throw error;
    throw new ProviderTargetDiscoveryPointFixtureError("target discovery golden schema is invalid");
  }
  const { semanticContentDigest: _semanticContentDigest, ...semanticFields } = manifest;
  if (
    semanticDigestV1(PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_SEMANTIC_DOMAIN_V1, semanticFields) !==
    manifest.semanticContentDigest
  ) throw new ProviderTargetDiscoveryPointFixtureError("target discovery golden semantic digest mismatch");
  const pointClosure = await validateProviderTargetDiscoveryPointClosureV1({
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
    strictCryptoCapability,
  });
  const bundle = manifest.targetDiscoveryResult.payload.targetDiscoveryInputBundle;
  if (
    pointClosure.authority !== manifest.fixtureAuthority ||
    pointClosure.sourceRecordCount !== manifest.expected.sourceRecordCount ||
    pointClosure.observationCount !== manifest.expected.observationCount ||
    pointClosure.targetCount !== manifest.expected.targetCount ||
    pointClosure.unresolvedObservationCount !== manifest.expected.unresolvedObservationCount ||
    !Object.entries(pointClosure.locators).every(([key, value]) =>
      manifest.expected.locators[key as keyof typeof manifest.expected.locators] === value) ||
    bytesToLowerHexV1(createProviderPublicSupportTaxonomySignatureMessageV1(manifest.publicSupportTaxonomy.payload)) !==
      manifest.expected.taxonomySignatureMessageUtf8Hex ||
    bytesToLowerHexV1(createProviderReleaseMatrixSignatureMessageV1(manifest.releaseMatrix.payload)) !==
      manifest.expected.matrixSignatureMessageUtf8Hex ||
    bytesToLowerHexV1(createProviderTargetDiscoveryInputBundleSignatureMessageV1(bundle)) !==
      manifest.expected.bundleSignatureMessageUtf8Hex ||
    bytesToLowerHexV1(createProviderTargetDiscoveryResultSignatureMessageV1(manifest.targetDiscoveryResult.payload)) !==
      manifest.expected.resultSignatureMessageUtf8Hex ||
    bytesToLowerHexV1(canonicalizeJcsSafeIntegerUtf8V1(bundle)) !==
      manifest.expected.bundleCanonicalUtf8Hex
  ) throw new ProviderTargetDiscoveryPointFixtureError("target discovery golden expected projection mismatch");
  return Object.freeze({ authority: manifest.fixtureAuthority, manifest, pointClosure });
}

export function verifyProviderTargetDiscoveryPointInvalidResourceV1(
  bytes: Uint8Array,
): ProviderTargetDiscoveryPointInvalidManifestV1 {
  verifyResourceAnchorV1(
    bytes,
    PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
    PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
    "target discovery invalid corpus",
  );
  let manifest: ProviderTargetDiscoveryPointInvalidManifestV1;
  try {
    manifest = ProviderTargetDiscoveryPointInvalidManifestV1Schema.parse(
      parseJsonResourceV1(bytes, "target discovery invalid corpus"),
    );
  } catch (error) {
    if (error instanceof ProviderTargetDiscoveryPointFixtureError) throw error;
    throw new ProviderTargetDiscoveryPointFixtureError("target discovery invalid corpus schema is invalid");
  }
  if (
    manifest.caseIds.some((caseId, index) => caseId !== INVALID_CASE_IDS_V1[index]) ||
    manifest.cases.some((invalidCase, index) => invalidCase.caseId !== INVALID_CASE_IDS_V1[index])
  ) throw new ProviderTargetDiscoveryPointFixtureError("target discovery invalid case inventory drift");
  const { semanticContentDigest: _semanticContentDigest, ...semanticFields } = manifest;
  if (
    semanticDigestV1(PROVIDER_TARGET_DISCOVERY_POINT_INVALID_SEMANTIC_DOMAIN_V1, semanticFields) !==
    manifest.semanticContentDigest
  ) throw new ProviderTargetDiscoveryPointFixtureError("target discovery invalid semantic digest mismatch");
  return manifest;
}
