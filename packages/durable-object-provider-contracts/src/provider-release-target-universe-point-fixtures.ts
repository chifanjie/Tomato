import { z } from "zod";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import { ContentDigestV1Schema, LowerHex64V1Schema } from "./primitives.js";
import {
  ProviderReleaseTargetUniverseEnvelopeV1Schema,
  ProviderReleaseTargetUniversePointClosureValidationError,
  ProviderReleaseTargetUniversePointInvalidReasonV1Schema,
  buildProviderReleaseTargetUniverseRelativePathV1,
  createProviderReleaseTargetUniverseSignatureMessageV1,
  diagnoseProviderReleaseTargetUniversePointClosureV1,
  projectProviderReleaseTargetUniverseUnsignedClaimsV1,
  validateProviderReleaseTargetUniversePointClosureV1,
  type ProviderReleaseTargetCoverageResolutionV1,
  type ProviderReleaseTargetUniversePointClosureDiagnosticResultV1,
  type ProviderReleaseTargetUniversePointClosureValidationV1,
  type ValidateProviderReleaseTargetUniversePointClosureV1Input,
} from "./provider-release-target-universe-point.js";
import {
  PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RESOURCE_PATH_V1,
  PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_TARGET_DISCOVERY_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
  ProviderTargetDiscoveryPointGoldenManifestV1Schema,
  ProviderTargetDiscoveryPointInvalidManifestV1Schema,
  type ProviderTargetDiscoveryPointGoldenManifestV1,
  type ProviderTargetDiscoveryPointInvalidManifestV1,
} from "./provider-target-discovery-point-fixtures.js";
import {
  ProviderTargetDiscoveryPointInvalidReasonV1Schema,
  ProviderTargetDiscoveryPointInvalidStageV1Schema,
  buildProviderPublicSupportTaxonomyRelativePathV1,
  buildProviderReleaseMatrixRelativePathV1,
  buildProviderTargetDiscoveryFixtureManifestRelativePathV1,
  buildProviderTargetDiscoveryResultRelativePathV1,
  buildProviderTargetDiscoveryRunnerRunRelativePathV1,
} from "./provider-target-discovery-point.js";
import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointFulfilledPromiseV1,
  createProviderPointRejectedPromiseV1,
} from "./provider-point-runtime-internal.js";
import { sha256InternalV1 } from "./sha256.js";
import type { ProviderStrictEd25519OpaqueCapabilityV1 } from "./strict-ed25519-conformance.js";

export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_PROFILE_V1 =
  "provider_release_target_universe_point_golden_v1" as const;
export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_PROFILE_V1 =
  "provider_release_target_universe_point_invalid_v1" as const;
export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_SEMANTIC_DOMAIN_V1 =
  "provider-release-target-universe-point-golden-manifest-v1" as const;
export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_SEMANTIC_DOMAIN_V1 =
  "provider-release-target-universe-point-invalid-manifest-v1" as const;
export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1 =
  "provider-release-target-universe-point-invalid-materialized-request-v1" as const;
export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RECIPE_DIALECT_V1 =
  "provider_release_target_universe_point_invalid_recipe_v1" as const;
export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_PATH_V1 =
  "fixtures/v1/golden/provider-release-target-universe-point-v1.json" as const;
export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RESOURCE_PATH_V1 =
  "fixtures/v1/invalid/provider-release-target-universe-point-v1.json" as const;

export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1 =
  585_993 as const;
export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1 =
  "4bea094e065951abfcc1f42decca105f5bedc94ee947ddb344365374f4d1a914" as const;
export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:1fa267ecee01d48350708c475365ddc8a3873fef14dbff812cc3c685e27555bc" as const;
export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1 =
  694_224 as const;
export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RESOURCE_SHA256_HEX_V1 =
  "ba8d12f558ba8db8534b606340d5b08de6898d2aa11e9d646c5a339a7f3042aa" as const;
export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:b19908bef43443040cf6da82e5c6fa9dd21d406357b0b2048da8baa6af8a701f" as const;
export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_FIXTURE_MAX_BYTES_V1 =
  16_777_216 as const;

const INHERITED_CASE_IDS_V1 = [
  "discovery-input-extra-field",
  "discovery-input-missing-result",
  "discovery-taxonomy-envelope-extra-field",
  "discovery-taxonomy-code-mismatch",
  "discovery-taxonomy-order-reversed",
  "discovery-taxonomy-signature-bitflip",
  "discovery-taxonomy-envelope-digest-mismatch",
  "discovery-taxonomy-outer-generation-mismatch",
  "discovery-matrix-taxonomy-pin-mismatch",
  "discovery-matrix-target-count-mismatch",
  "discovery-matrix-target-id-mismatch",
  "discovery-matrix-public-id-mismatch",
  "discovery-matrix-target-order-reversed",
  "discovery-matrix-target-set-digest-mismatch",
  "discovery-matrix-signature-bitflip",
  "discovery-matrix-envelope-digest-mismatch",
  "discovery-fixture-suite-pin-mismatch",
  "discovery-fixture-suite-semantic-digest-mismatch",
  "discovery-fixture-corpus-semantic-digest-mismatch",
  "discovery-fixture-record-ordinal-gap",
  "discovery-fixture-record-count-mismatch",
  "discovery-fixture-record-set-digest-mismatch",
  "discovery-fixture-envelope-content-digest-mismatch",
  "discovery-runner-record-ordinal-gap",
  "discovery-runner-record-count-mismatch",
  "discovery-runner-record-set-digest-mismatch",
  "discovery-runner-envelope-content-digest-mismatch",
  "discovery-bundle-taxonomy-pin-mismatch",
  "discovery-bundle-fixture-pin-mismatch",
  "discovery-bundle-runner-pin-mismatch",
  "discovery-bundle-observation-cut-mismatch",
  "discovery-bundle-observation-cut-digest-mismatch",
  "discovery-bundle-source-summary-order-reversed",
  "discovery-bundle-observation-count-mismatch",
  "discovery-bundle-observation-outcome-rewritten",
  "discovery-bundle-observation-key-mismatch",
  "discovery-bundle-observation-set-digest-mismatch",
  "discovery-bundle-signature-bitflip",
  "discovery-result-bundle-content-digest-mismatch",
  "discovery-result-target-count-mismatch",
  "discovery-result-target-order-reversed",
  "discovery-result-target-set-digest-mismatch",
  "discovery-result-unresolved-count-mismatch",
  "discovery-result-unresolved-order-reversed",
  "discovery-result-signature-bitflip",
  "discovery-result-envelope-content-digest-mismatch",
  "discovery-resolved-target-conflict",
  "discovery-source-suite-signature-bitflip",
  "discovery-caller-distribution-binding-mismatch",
  "discovery-caller-active-root-metadata-mismatch",
  "discovery-caller-active-root-key-mismatch",
  "discovery-taxonomy-distribution-binding-mismatch",
  "discovery-taxonomy-active-root-mismatch",
  "discovery-taxonomy-root-key-id-mismatch",
  "discovery-matrix-distribution-binding-mismatch",
  "discovery-matrix-active-root-mismatch",
  "discovery-matrix-root-key-id-mismatch",
  "discovery-fixture-distribution-binding-mismatch",
  "discovery-fixture-release-revision-mismatch",
  "discovery-runner-distribution-binding-mismatch",
  "discovery-runner-release-revision-mismatch",
  "discovery-bundle-distribution-binding-mismatch",
  "discovery-bundle-active-root-mismatch",
  "discovery-bundle-root-key-id-mismatch",
  "discovery-result-distribution-binding-mismatch",
  "discovery-result-active-root-mismatch",
  "discovery-result-root-key-id-mismatch",
  "discovery-taxonomy-signature-wrong-signer",
  "discovery-taxonomy-signature-wrong-domain",
  "discovery-taxonomy-signature-wrong-prefix",
  "discovery-taxonomy-signature-wrong-claims",
  "discovery-matrix-signature-wrong-signer",
  "discovery-matrix-signature-wrong-domain",
  "discovery-matrix-signature-wrong-prefix",
  "discovery-matrix-signature-wrong-claims",
  "discovery-bundle-signature-wrong-signer",
  "discovery-bundle-signature-wrong-domain",
  "discovery-bundle-signature-wrong-prefix",
  "discovery-bundle-signature-wrong-claims",
  "discovery-result-signature-wrong-signer",
  "discovery-result-signature-wrong-domain",
  "discovery-result-signature-wrong-prefix",
  "discovery-result-signature-wrong-claims",
  "discovery-matrix-source-artifact-semantic-digest-substitution",
  "discovery-fixture-source-artifact-semantic-digest-substitution",
  "discovery-runner-source-artifact-semantic-digest-substitution",
  "discovery-bundle-observation-missing",
  "discovery-bundle-observation-extra",
  "discovery-bundle-observation-duplicate",
  "discovery-bundle-observation-reordered",
  "discovery-matrix-target-4097",
  "discovery-result-target-4097",
  "discovery-result-unresolved-4097",
  "discovery-embedded-bundle-16mib-plus-one",
  "discovery-runner-envelope-16mib-plus-one",
  "discovery-taxonomy-locator-bare-dto",
  "discovery-matrix-locator-bare-dto",
  "discovery-fixture-locator-bare-digest",
  "discovery-runner-locator-bare-digest",
  "discovery-result-locator-bare-dto",
  "discovery-fixture-locator-semantic-digest-substitution",
  "discovery-fixture-locator-outer-semantic-digest-mismatch",
  "discovery-runner-locator-semantic-digest-substitution",
  "discovery-taxonomy-locator-path-alias",
  "discovery-matrix-locator-latest-alias",
  "discovery-result-locator-path-alias",
  "discovery-security-top-level-proxy",
  "discovery-security-nested-proxy",
  "discovery-security-top-level-getter",
  "discovery-security-nested-getter",
  "discovery-security-nested-hidden",
  "discovery-security-nested-symbol",
  "discovery-security-sparse-array",
  "discovery-security-cycle",
  "discovery-security-alias",
  "discovery-security-async-mutation",
] as const;

const POINT_CASE_IDS_V1 = [
  "point-input-extra-field",
  "point-input-missing-universe",
  "point-input-plain-validation-dto",
  "point-input-caller-universe-pin",
  "point-input-caller-universe-locator",
  "point-input-caller-current-flag",
  "point-input-fake-capability",
  "point-input-fake-capability-getter",
  "point-input-fake-capability-proxy",
  "point-security-top-level-proxy",
  "point-security-universe-proxy",
  "point-security-universe-nested-proxy",
  "point-security-universe-self-removing-proxy",
  "point-security-top-level-getter",
  "point-security-universe-getter",
  "point-security-universe-nested-getter",
  "point-security-top-level-hidden",
  "point-security-universe-nested-hidden",
  "point-security-top-level-symbol",
  "point-security-universe-nested-symbol",
  "point-security-universe-sparse-targets",
  "point-security-universe-sparse-buckets",
  "point-security-universe-sparse-bucket-target-ids",
  "point-security-universe-cycle",
  "point-security-universe-alias",
  "point-security-universe-to-inherited-alias",
  "point-security-inherited-to-universe-alias",
  "point-input-universe-target-4097",
  "point-input-universe-bucket-4097",
  "point-input-bucket-target-id-4097",
  "point-input-total-bucket-target-id-4097",
  "point-input-string-4097",
  "point-input-string-4096-reaches-structure",
  "point-input-aggregate-string-cap-reaches-structure",
  "point-input-aggregate-string-cap-plus-one",
  "point-input-targets-wrong-container",
  "point-input-buckets-wrong-container",
  "point-input-coverage-wrong-container",
  "point-input-target-ids-wrong-container",
  "point-input-bucket-private-build-digest",
  "point-input-bucket-private-raw-path",
  "point-input-bucket-private-environment-fields",
  "point-security-object-prototype-then",
  "point-security-promise-primordials",
  "universe-envelope-schema-version-invalid",
  "universe-envelope-record-type-invalid",
  "universe-envelope-generation-zero",
  "universe-profile-invalid",
  "universe-registry-root-key-id-invalid",
  "universe-generation-zero",
  "universe-generation-fractional",
  "universe-generation-unsafe",
  "universe-predecessor-digest-invalid",
  "universe-taxonomy-pin-profile-invalid",
  "universe-coverage-profile-invalid",
  "universe-release-matrix-pin-profile-invalid",
  "universe-target-discovery-pin-profile-invalid",
  "universe-resolution-state-invalid",
  "universe-target-entry-invalid",
  "universe-bucket-public-profile-id-invalid",
  "universe-generation-one-with-predecessor",
  "universe-generation-two-without-predecessor",
  "universe-distribution-binding-mismatch",
  "universe-distribution-active-root-compound",
  "universe-active-root-metadata-mismatch",
  "universe-registry-root-key-id-mismatch",
  "universe-active-root-taxonomy-compound",
  "universe-taxonomy-pin-generation-mismatch",
  "universe-taxonomy-pin-digest-mismatch",
  "universe-matrix-pin-generation-mismatch",
  "universe-matrix-discovery-pin-compound",
  "universe-discovery-pin-digest-mismatch",
  "coverage-limits-profile-mismatch",
  "coverage-limit-target-entries-mismatch",
  "coverage-limit-union-targets-mismatch",
  "coverage-limit-unresolved-mismatch",
  "coverage-limit-envelope-bytes-mismatch",
  "coverage-ruleset-mismatch",
  "coverage-required-dimension-os-platform-mismatch",
  "coverage-required-dimension-os-release-family-mismatch",
  "coverage-required-dimension-os-build-mismatch",
  "coverage-required-dimension-architecture-mismatch",
  "coverage-required-dimension-filesystem-profile-mismatch",
  "coverage-required-dimension-filesystem-feature-mismatch",
  "coverage-required-dimension-mount-option-mismatch",
  "coverage-observation-source-matrix-mismatch",
  "coverage-observation-source-fixture-mismatch",
  "coverage-observation-source-runner-mismatch",
  "coverage-bundle-digest-mismatch",
  "coverage-observation-cut-digest-mismatch",
  "coverage-observation-set-digest-mismatch",
  "coverage-limits-before-digest-compound",
  "coverage-dimension-before-source-compound",
  "coverage-sources-before-bundle-digest-compound",
  "coverage-matrix-count-mismatch",
  "coverage-matrix-set-digest-mismatch",
  "coverage-discovered-count-mismatch",
  "coverage-discovered-set-digest-mismatch",
  "coverage-unresolved-count-mismatch",
  "coverage-matrix-count-before-digest-compound",
  "coverage-matrix-digest-before-discovered-count-compound",
  "coverage-discovered-count-before-digest-compound",
  "coverage-discovered-digest-before-unresolved-count-compound",
  "universe-target-order-reversed",
  "universe-target-duplicate",
  "universe-target-missing",
  "universe-target-extra",
  "universe-target-public-id-substitution",
  "universe-target-private-fields-substitution",
  "universe-target-order-before-count-compound",
  "universe-target-count-before-coverage-compound",
  "resolution-taxonomy-to-target-discovery",
  "resolution-taxonomy-to-release-matrix",
  "resolution-target-discovery-to-taxonomy",
  "resolution-release-matrix-to-target-discovery",
  "resolution-closed-world-to-incomplete",
  "universe-bucket-order-reversed",
  "universe-bucket-duplicate",
  "universe-bucket-target-id-order-reversed",
  "universe-bucket-target-id-duplicate",
  "universe-bucket-public-id-mismatch",
  "universe-bucket-os-platform-mismatch",
  "universe-bucket-os-family-mismatch",
  "universe-bucket-architecture-mismatch",
  "universe-bucket-filesystem-profile-mismatch",
  "universe-bucket-partition-missing",
  "universe-bucket-partition-extra",
  "universe-bucket-partition-duplicate-across-buckets",
  "universe-bucket-wrong-membership",
  "universe-bucket-incomplete-state-mismatch",
  "universe-bucket-incomplete-reason-mismatch",
  "universe-bucket-complete-state-mismatch",
  "universe-bucket-order-before-mapping-compound",
  "universe-bucket-mapping-before-partition-compound",
  "universe-signature-format-invalid",
  "universe-signature-prefix-invalid",
  "universe-signature-root-binding-mismatch",
  "universe-signature-bitflip",
  "universe-signature-wrong-signer",
  "universe-signature-wrong-domain",
  "universe-signature-wrong-claims",
  "universe-signature-small-order-r",
  "universe-signature-before-digest-compound",
  "universe-content-digest-mismatch",
  "universe-envelope-generation-mismatch",
  "universe-locator-bare-pin",
  "universe-locator-path-alias",
  "universe-locator-latest-alias",
  "universe-locator-generation-mismatch",
  "universe-locator-digest-mismatch",
  "universe-locator-ordinary-accessor",
  "universe-locator-top-level-proxy",
  "universe-locator-nested-proxy",
  "universe-locator-self-removing-proxy",
  "universe-locator-get-only-proxy",
  "universe-locator-structured-clone-replacement",
  "universe-locator-array-push-pollution",
  "universe-locator-inherited-index-setter",
  "universe-locator-sequential-pollution",
  "point-security-universe-after-start-mutation",
  "point-security-universe-crypto-host-mutation",
  "point-input-universe-distribution-binding-extra-field",
  "point-input-universe-distribution-binding-wrong-container",
  "point-input-universe-bootstrap-trust-bundle-extra-field",
  "point-input-universe-bootstrap-trust-bundle-wrong-container",
  "point-input-universe-history-policy-extra-field",
  "point-input-universe-history-policy-wrong-container",
  "point-input-universe-active-root-metadata-extra-field",
  "point-input-universe-active-root-metadata-wrong-container",
] as const;

export type ProviderReleaseTargetUniversePointInheritedCaseIdV1 =
  (typeof INHERITED_CASE_IDS_V1)[number];
export type ProviderReleaseTargetUniversePointSpecificCaseIdV1 =
  (typeof POINT_CASE_IDS_V1)[number];
export type ProviderReleaseTargetUniversePointInvalidCaseIdV1 =
  | ProviderReleaseTargetUniversePointInheritedCaseIdV1
  | ProviderReleaseTargetUniversePointSpecificCaseIdV1;

const INVALID_CASE_IDS_V1 = [
  ...INHERITED_CASE_IDS_V1,
  ...POINT_CASE_IDS_V1,
] as const;

export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INHERITED_CASE_IDS_V1:
  readonly ProviderReleaseTargetUniversePointInheritedCaseIdV1[] =
  Object.freeze([...INHERITED_CASE_IDS_V1]);
export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_SPECIFIC_CASE_IDS_V1:
  readonly ProviderReleaseTargetUniversePointSpecificCaseIdV1[] =
  Object.freeze([...POINT_CASE_IDS_V1]);
export const PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_CASE_IDS_V1:
  readonly ProviderReleaseTargetUniversePointInvalidCaseIdV1[] =
  Object.freeze([...INVALID_CASE_IDS_V1]);

const SOURCE_CASE_IDS_V1 = INHERITED_CASE_IDS_V1.map((caseId) =>
  caseId.slice("discovery-".length),
);
type SourceCaseIdV1 = (typeof SOURCE_CASE_IDS_V1)[number];

const NonnegativeSafeIntegerV1Schema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
const PositiveSafeIntegerV1Schema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);
const ResourceSha256HexV1Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const EvenLowerHexV1Schema = z.string().regex(/^(?:[0-9a-f]{2})+$/u);

type JsonValueV1 =
  | null
  | boolean
  | number
  | string
  | readonly JsonValueV1[]
  | { readonly [key: string]: JsonValueV1 };
const JsonValueV1Schema: z.ZodType<JsonValueV1> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z
      .number()
      .finite()
      .int()
      .min(-Number.MAX_SAFE_INTEGER)
      .max(Number.MAX_SAFE_INTEGER),
    z.string(),
    z.array(JsonValueV1Schema),
    z.record(z.string(), JsonValueV1Schema),
  ]),
);
const OverlayPathSegmentV1Schema = z.union([
  z.string(),
  NonnegativeSafeIntegerV1Schema,
]);
const OverlayPathV1Schema = z.array(OverlayPathSegmentV1Schema).max(64);
const NonemptyOverlayPathV1Schema = z
  .array(OverlayPathSegmentV1Schema)
  .min(1)
  .max(64);
const PatchOperationV1Schema = z.discriminatedUnion("op", [
  z.strictObject({
    op: z.literal("set"),
    path: OverlayPathV1Schema,
    value: JsonValueV1Schema,
  }),
  z.strictObject({
    op: z.literal("delete"),
    path: NonemptyOverlayPathV1Schema,
  }),
  z.strictObject({
    op: z.literal("reverse"),
    path: OverlayPathV1Schema,
  }),
  z.strictObject({
    op: z.literal("splice"),
    path: OverlayPathV1Schema,
    start: NonnegativeSafeIntegerV1Schema,
    deleteCount: NonnegativeSafeIntegerV1Schema,
    items: z.array(JsonValueV1Schema),
  }),
]);
const PatchRecipeV1Schema = z.strictObject({
  kind: z.literal("patch"),
  operations: z.array(PatchOperationV1Schema),
});
const RepeatRecipeV1Schema = z.strictObject({
  kind: z.literal("repeat"),
  operations: z.array(PatchOperationV1Schema),
  path: OverlayPathV1Schema,
  sourceIndex: NonnegativeSafeIntegerV1Schema,
  count: PositiveSafeIntegerV1Schema,
  postOperations: z.array(PatchOperationV1Schema),
});
const PaddingRecipeV1Schema = z.strictObject({
  kind: z.literal("padding"),
  operations: z.array(PatchOperationV1Schema),
  path: OverlayPathV1Schema,
  character: z.string().regex(/^[\u0000-\ud7ff\ue000-\uffff]$/u),
  prefix: z.string().max(4096),
  codeUnitLength: PositiveSafeIntegerV1Schema,
  repeat: z
    .strictObject({
      path: OverlayPathV1Schema,
      sourceIndex: NonnegativeSafeIntegerV1Schema,
      count: PositiveSafeIntegerV1Schema,
    })
    .optional(),
  postOperations: z.array(PatchOperationV1Schema),
});

const INHERITED_LOCATOR_CASE_IDS_V1 = INHERITED_CASE_IDS_V1.slice(
  95,
  106,
) as readonly ProviderReleaseTargetUniversePointInheritedCaseIdV1[];
const UNIVERSE_LOCATOR_CASE_IDS_V1 = POINT_CASE_IDS_V1.slice(
  POINT_CASE_IDS_V1.indexOf("universe-locator-bare-pin"),
  POINT_CASE_IDS_V1.indexOf("universe-locator-sequential-pollution") + 1,
) as readonly ProviderReleaseTargetUniversePointSpecificCaseIdV1[];
const LOCATOR_CASE_IDS_V1 = [
  ...INHERITED_LOCATOR_CASE_IDS_V1,
  ...UNIVERSE_LOCATOR_CASE_IDS_V1,
] as readonly ProviderReleaseTargetUniversePointInvalidCaseIdV1[];
const LocatorProfileV1Schema = z.enum(
  LOCATOR_CASE_IDS_V1 as [
    ProviderReleaseTargetUniversePointInvalidCaseIdV1,
    ...ProviderReleaseTargetUniversePointInvalidCaseIdV1[],
  ],
);
const InvalidCaseIdV1Schema = z.enum(
  INVALID_CASE_IDS_V1 as unknown as [
    ProviderReleaseTargetUniversePointInvalidCaseIdV1,
    ...ProviderReleaseTargetUniversePointInvalidCaseIdV1[],
  ],
);
const LocatorBuilderRecipeV1Schema = z.strictObject({
  kind: z.literal("locator_builder"),
  profile: LocatorProfileV1Schema,
  operations: z.array(PatchOperationV1Schema),
});
const HostileInputRecipeV1Schema = z.strictObject({
  kind: z.literal("hostile_input"),
  profile: InvalidCaseIdV1Schema,
});
const AsyncMutationRecipeV1Schema = z.strictObject({
  kind: z.literal("async_mutation"),
  profile: z.enum(["after_start", "crypto_host"]),
});
const ReplayRecipeV1Schema = z.discriminatedUnion("kind", [
  PatchRecipeV1Schema,
  RepeatRecipeV1Schema,
  PaddingRecipeV1Schema,
  LocatorBuilderRecipeV1Schema,
  HostileInputRecipeV1Schema,
  AsyncMutationRecipeV1Schema,
]);
export type ProviderReleaseTargetUniversePointReplayRecipeV1 = z.infer<
  typeof ReplayRecipeV1Schema
>;

export const ProviderReleaseTargetUniversePointFixtureInvalidStageV1Schema =
  z.enum([
    "input",
    "target_discovery_closure",
    "universe_structure",
    "universe_distribution_binding",
    "universe_active_root",
    "universe_taxonomy_pin",
    "universe_coverage_pins",
    "universe_coverage_binding",
    "universe_coverage_counts",
    "universe_target_union",
    "universe_resolution",
    "universe_buckets",
    "universe_signature_binding",
    "universe_signature",
    "universe_digest",
    "universe_envelope",
    "target_discovery_locator",
    "universe_locator",
  ]);
export type ProviderReleaseTargetUniversePointFixtureInvalidStageV1 = z.infer<
  typeof ProviderReleaseTargetUniversePointFixtureInvalidStageV1Schema
>;

const SnapshotProjectionV1Schema = z.strictObject({
  publicSupportTaxonomyContentDigest: ContentDigestV1Schema,
  releaseMatrixContentDigest: ContentDigestV1Schema,
  targetDiscoveryResultContentDigest: ContentDigestV1Schema,
  targetDiscoveryInputBundleContentDigest: ContentDigestV1Schema,
  releaseMatrixTargetCount: NonnegativeSafeIntegerV1Schema,
  discoveredTargetCount: NonnegativeSafeIntegerV1Schema,
  unresolvedObservationCount: NonnegativeSafeIntegerV1Schema,
  universeGeneration: PositiveSafeIntegerV1Schema,
  universeContentDigest: ContentDigestV1Schema,
  universeTargetCount: NonnegativeSafeIntegerV1Schema,
  universeBucketCount: NonnegativeSafeIntegerV1Schema,
  coverageResolution: z.union([
    z.strictObject({ state: z.literal("closed_world_complete") }),
    z.strictObject({
      state: z.literal("incomplete"),
      reason: z.enum([
        "release_matrix_incomplete",
        "target_discovery_unresolved",
        "taxonomy_mapping_unresolved",
      ]),
    }),
  ]),
  universeRelativePath: z
    .string()
    .regex(/^provider\/release-target-universe\/(?:id-[0-9a-v]+|idh-[0-9a-f]{64})\.json$/u),
});
export type ProviderReleaseTargetUniversePointSnapshotProjectionV1 = z.infer<
  typeof SnapshotProjectionV1Schema
>;

const PointJsonRequestV1Schema = z.strictObject({
  activeRoot: ProviderTargetDiscoveryPointGoldenManifestV1Schema.shape.activeRoot,
  activeRootMetadata:
    ProviderTargetDiscoveryPointGoldenManifestV1Schema.shape.activeRootMetadata,
  distributionRootBinding:
    ProviderTargetDiscoveryPointGoldenManifestV1Schema.shape.distributionRootBinding,
  fixtureCorpusManifest:
    ProviderTargetDiscoveryPointGoldenManifestV1Schema.shape.fixtureCorpusManifest,
  publicSupportTaxonomy:
    ProviderTargetDiscoveryPointGoldenManifestV1Schema.shape.publicSupportTaxonomy,
  releaseMatrix:
    ProviderTargetDiscoveryPointGoldenManifestV1Schema.shape.releaseMatrix,
  releaseTargetUniverse: ProviderReleaseTargetUniverseEnvelopeV1Schema,
  suiteManifest:
    ProviderTargetDiscoveryPointGoldenManifestV1Schema.shape.suiteManifest,
  targetDiscoveryFixtureManifest:
    ProviderTargetDiscoveryPointGoldenManifestV1Schema.shape
      .targetDiscoveryFixtureManifest,
  targetDiscoveryResult:
    ProviderTargetDiscoveryPointGoldenManifestV1Schema.shape.targetDiscoveryResult,
  targetDiscoveryRunnerRun:
    ProviderTargetDiscoveryPointGoldenManifestV1Schema.shape.targetDiscoveryRunnerRun,
});
type PointJsonRequestV1 = z.infer<typeof PointJsonRequestV1Schema>;

const PositiveVectorIdV1Schema = z.enum([
  "taxonomy-mapping-unresolved",
  "target-discovery-unresolved",
  "release-matrix-incomplete",
  "closed-world-complete",
]);
type PositiveVectorIdV1 = z.infer<typeof PositiveVectorIdV1Schema>;

function positiveVectorSchemaV1(
  vectorId:
    | "taxonomy-mapping-unresolved"
    | "target-discovery-unresolved"
    | "release-matrix-incomplete"
    | "closed-world-complete",
) {
  return z.strictObject({
    vectorId: z.literal(vectorId),
    request: PointJsonRequestV1Schema,
    expected: z.strictObject({
      snapshotProjection: SnapshotProjectionV1Schema,
      pointAdmissionCount: z.literal(1),
      signatureVerificationCount: z.literal(7),
    }),
  });
}

export const ProviderReleaseTargetUniversePointGoldenManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(
      PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_PROFILE_V1,
    ),
    fixtureAuthority: z.literal(
      "none_release_target_universe_structure_only",
    ),
    canonicalizationProfile: z.literal("rfc8785-jcs-safe-integer-v1"),
    verificationProfile: z.literal(
      "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
    ),
    deterministicRootSeedHex: LowerHex64V1Schema,
    targetDiscoveryPointGolden:
      ProviderTargetDiscoveryPointGoldenManifestV1Schema,
    releaseTargetUniverse: ProviderReleaseTargetUniverseEnvelopeV1Schema,
    positiveVectors: z.tuple([
      positiveVectorSchemaV1("taxonomy-mapping-unresolved"),
      positiveVectorSchemaV1("target-discovery-unresolved"),
      positiveVectorSchemaV1("release-matrix-incomplete"),
      positiveVectorSchemaV1("closed-world-complete"),
    ]),
    expected: z.strictObject({
      universeUnsignedClaimsCanonicalUtf8Hex: EvenLowerHexV1Schema,
      universeSignatureMessageUtf8Hex: EvenLowerHexV1Schema,
      snapshotProjection: SnapshotProjectionV1Schema,
      pointAdmissionCount: z.literal(1),
      signatureVerificationCount: z.literal(7),
    }),
    semanticDomain: z.literal(
      PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
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
      PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    ),
  });
export type ProviderReleaseTargetUniversePointGoldenManifestV1 = z.infer<
  typeof ProviderReleaseTargetUniversePointGoldenManifestV1Schema
>;

const SourceExpectedV1Schema = z.discriminatedUnion("boundary", [
  z.strictObject({
    boundary: z.literal("internal_diagnostic"),
    stage: ProviderTargetDiscoveryPointInvalidStageV1Schema,
    reason: ProviderTargetDiscoveryPointInvalidReasonV1Schema,
  }),
  z.strictObject({
    boundary: z.literal("locator_builder"),
    stage: z.literal("locator"),
    reason: z.literal("envelope_mismatch"),
  }),
  z.strictObject({
    boundary: z.literal("snapshot_stability"),
    outcome: z.literal("accepted_frozen_snapshot"),
  }),
]);

type ParsedInheritedReplayV1 = {
  readonly caseId: ProviderReleaseTargetUniversePointInheritedCaseIdV1;
  readonly sourceOperation: string;
  readonly sourceExpected: z.infer<typeof SourceExpectedV1Schema>;
  readonly replay: ProviderReleaseTargetUniversePointReplayRecipeV1;
};

function orderedInheritedReplaySchemaV1(
  caseId: ProviderReleaseTargetUniversePointInheritedCaseIdV1,
): z.ZodType<ParsedInheritedReplayV1> {
  return z.strictObject({
    caseId: z.literal(caseId),
    sourceOperation: z.literal(caseId.slice("discovery-".length)),
    sourceExpected: SourceExpectedV1Schema,
    replay: ReplayRecipeV1Schema,
  }) as z.ZodType<ParsedInheritedReplayV1>;
}

const PublicFailureV1Schema = z.strictObject({
  errorName: z.literal(
    "ProviderReleaseTargetUniversePointClosureValidationError",
  ),
  code: z.literal("provider_unavailable"),
  reason: z.literal("attestation_invalid"),
});
const DiagnosticExpectedV1Schema = z.strictObject({
  boundary: z.literal("internal_diagnostic"),
  stage: ProviderReleaseTargetUniversePointFixtureInvalidStageV1Schema.exclude([
    "target_discovery_locator",
    "universe_locator",
  ]),
  reason: ProviderReleaseTargetUniversePointInvalidReasonV1Schema,
  publicFailureReason: z.literal("attestation_invalid"),
  publicFailure: PublicFailureV1Schema,
  pointAdmissionCount: NonnegativeSafeIntegerV1Schema,
  signatureVerificationCount: NonnegativeSafeIntegerV1Schema,
  materializedRequestSemanticDigest: ContentDigestV1Schema,
});
const LocatorExpectedV1Schema = z.strictObject({
  boundary: z.literal("locator_builder"),
  stage: z.enum(["target_discovery_locator", "universe_locator"]),
  reason: z.literal("envelope_mismatch"),
  pointAdmissionCount: z.literal(0),
  signatureVerificationCount: z.literal(0),
  materializedRequestSemanticDigest: ContentDigestV1Schema,
});
const SnapshotExpectedV1Schema = z.strictObject({
  boundary: z.literal("snapshot_stability"),
  outcome: z.literal("accepted_frozen_snapshot"),
  authority: z.literal("none_release_target_universe_structure_only"),
  snapshotProjection: SnapshotProjectionV1Schema,
  pointAdmissionCount: z.literal(1),
  signatureVerificationCount: z.literal(7),
  materializedRequestSemanticDigest: ContentDigestV1Schema,
});
const InvalidExpectedV1Schema = z.discriminatedUnion("boundary", [
  DiagnosticExpectedV1Schema,
  LocatorExpectedV1Schema,
  SnapshotExpectedV1Schema,
]);

type ParsedInvalidCaseV1 = {
  readonly caseId: ProviderReleaseTargetUniversePointInvalidCaseIdV1;
  readonly group:
    | "target_discovery_point"
    | "release_target_universe_point";
  readonly mutation: {
    readonly dialect: typeof PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RECIPE_DIALECT_V1;
    readonly goldenResourcePath: typeof PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_PATH_V1;
    readonly baseVectorId: PositiveVectorIdV1;
    readonly operation: ProviderReleaseTargetUniversePointInvalidCaseIdV1;
    readonly recipe:
      | ProviderReleaseTargetUniversePointReplayRecipeV1
      | {
          readonly kind:
            | "target_discovery_point"
            | "target_discovery_locator_builder";
          readonly sourceOperation: string;
        };
  };
  readonly expected: z.infer<typeof InvalidExpectedV1Schema>;
};

function orderedInvalidCaseSchemaV1(
  caseId: ProviderReleaseTargetUniversePointInvalidCaseIdV1,
  index: number,
): z.ZodType<ParsedInvalidCaseV1> {
  const inherited = index < INHERITED_CASE_IDS_V1.length;
  const sourceOperation = inherited
    ? caseId.slice("discovery-".length)
    : undefined;
  const inheritedLocator = inherited && index >= 95 && index <= 105;
  const recipeSchema = inherited
    ? z.strictObject({
        kind: z.literal(
          inheritedLocator
            ? "target_discovery_locator_builder"
            : "target_discovery_point",
        ),
        sourceOperation: z.literal(sourceOperation!),
      })
    : ReplayRecipeV1Schema;
  return z.strictObject({
    caseId: z.literal(caseId),
    group: z.literal(
      inherited
        ? "target_discovery_point"
        : "release_target_universe_point",
    ),
    mutation: z.strictObject({
      dialect: z.literal(
        PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RECIPE_DIALECT_V1,
      ),
      goldenResourcePath: z.literal(
        PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_PATH_V1,
      ),
      baseVectorId: inherited
        ? z.literal("taxonomy-mapping-unresolved")
        : PositiveVectorIdV1Schema,
      operation: z.literal(caseId),
      recipe: recipeSchema,
    }),
    expected: InvalidExpectedV1Schema,
  }) as z.ZodType<ParsedInvalidCaseV1>;
}

const ORDERED_INVALID_CASE_ID_SCHEMAS_V1 = INVALID_CASE_IDS_V1.map((caseId) =>
  z.literal(caseId),
) as unknown as [z.ZodTypeAny, ...z.ZodTypeAny[]];
const ORDERED_INVALID_CASE_SCHEMAS_V1 = INVALID_CASE_IDS_V1.map(
  (caseId, index) => orderedInvalidCaseSchemaV1(caseId, index),
) as unknown as [z.ZodTypeAny, ...z.ZodTypeAny[]];
const ORDERED_INHERITED_REPLAY_SCHEMAS_V1 = INHERITED_CASE_IDS_V1.map(
  orderedInheritedReplaySchemaV1,
) as unknown as [z.ZodTypeAny, ...z.ZodTypeAny[]];

export const ProviderReleaseTargetUniversePointInvalidManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(
      PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_PROFILE_V1,
    ),
    fixtureAuthority: z.literal("none_rejection_only"),
    canonicalizationProfile: z.literal("rfc8785-jcs-safe-integer-v1"),
    verificationProfile: z.literal(
      "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
    ),
    semanticDomain: z.literal(
      PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_SEMANTIC_DOMAIN_V1,
    ),
    materializedRequestSemanticDomain: z.literal(
      PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
    ),
    goldenDependency: z.strictObject({
      resourcePath: z.literal(
        PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_PATH_V1,
      ),
      resourceByteLength: z.literal(
        PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
      ),
      resourceSha256Hex: z.literal(
        PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
      ),
      semanticContentDigest: z.literal(
        PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
      ),
    }),
    targetDiscoveryInvalidDependency: z.strictObject({
      resourcePath: z.literal(
        PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RESOURCE_PATH_V1,
      ),
      resourceByteLength: z.literal(
        PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
      ),
      resourceSha256Hex: z.literal(
        PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
      ),
      semanticContentDigest: z.literal(
        PROVIDER_TARGET_DISCOVERY_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
      ),
      manifest: ProviderTargetDiscoveryPointInvalidManifestV1Schema,
    }),
    mutationRecipeDialect: z.literal(
      PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RECIPE_DIALECT_V1,
    ),
    inheritedCaseCount: z.literal(INHERITED_CASE_IDS_V1.length),
    pointCaseCount: z.literal(POINT_CASE_IDS_V1.length),
    caseCount: z.literal(INVALID_CASE_IDS_V1.length),
    caseIds: z.tuple(ORDERED_INVALID_CASE_ID_SCHEMAS_V1),
    inheritedReplayRecipes: z.tuple(
      ORDERED_INHERITED_REPLAY_SCHEMAS_V1,
    ),
    cases: z.tuple(ORDERED_INVALID_CASE_SCHEMAS_V1),
    semanticContentDigest: z.literal(
      PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
    ),
  });

export type ProviderReleaseTargetUniversePointInvalidCaseV1 =
  ParsedInvalidCaseV1;
type ParsedInvalidManifestV1 = z.infer<
  typeof ProviderReleaseTargetUniversePointInvalidManifestV1Schema
>;
export type ProviderReleaseTargetUniversePointInvalidManifestV1 = Omit<
  ParsedInvalidManifestV1,
  "caseIds" | "cases" | "inheritedReplayRecipes"
> & {
  readonly caseIds: readonly ProviderReleaseTargetUniversePointInvalidCaseIdV1[];
  readonly cases: readonly ProviderReleaseTargetUniversePointInvalidCaseV1[];
  readonly inheritedReplayRecipes: readonly ParsedInheritedReplayV1[];
};

const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedArrayV1 = Array;
const CapturedArrayPrototypeV1 = CapturedArrayV1.prototype;
const CapturedArrayPrototypePushV1 = Array.prototype.push;
const CapturedArrayPrototypeReverseV1 = Array.prototype.reverse;
const CapturedArrayPrototypeSliceV1 = Array.prototype.slice;
const CapturedArrayPrototypeSpliceV1 = Array.prototype.splice;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedNumberMaxSafeIntegerV1 = Number.MAX_SAFE_INTEGER;
const CapturedNumberPrototypeToStringV1 = Number.prototype.toString;
const CapturedJsonParseV1 = JSON.parse;
const CapturedPromiseV1 = Promise;
const CapturedProxyV1 = Proxy;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedReflectDeletePropertyV1 = Reflect.deleteProperty;
const CapturedReflectGetV1 = Reflect.get;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const CapturedReflectSetV1 = Reflect.set;
const CapturedSetV1 = Set;
const CapturedSetPrototypeAddV1 = CapturedSetV1.prototype.add;
const CapturedSetPrototypeHasV1 = CapturedSetV1.prototype.has;
const CapturedStringPrototypePadStartV1 = String.prototype.padStart;
const CapturedStringPrototypeRepeatV1 = String.prototype.repeat;
const CapturedStringPrototypeSliceV1 = String.prototype.slice;
const CapturedStringPrototypeStartsWithV1 = String.prototype.startsWith;
const CapturedTextDecoderV1 = TextDecoder;
const CapturedTextDecoderPrototypeDecodeV1 =
  CapturedTextDecoderV1.prototype.decode;
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetPrototypeAddV1 = CapturedWeakSetV1.prototype.add;
const CapturedWeakSetPrototypeHasV1 = CapturedWeakSetV1.prototype.has;
const CapturedSymbolSpeciesV1 = Symbol.species;
const fixtureUtf8DecoderV1 = new CapturedTextDecoderV1("utf-8", {
  fatal: true,
  ignoreBOM: true,
});

function uncurryFixtureMethodV1(method: Function): Function {
  return CapturedReflectApplyV1(
    CapturedFunctionPrototypeBindV1,
    CapturedFunctionPrototypeCallV1,
    CapturedObjectFreezeV1([method]),
  ) as Function;
}

const arrayPushV1 = uncurryFixtureMethodV1(
  CapturedArrayPrototypePushV1,
) as <T>(array: T[], value: T) => number;
const arrayReverseV1 = uncurryFixtureMethodV1(
  CapturedArrayPrototypeReverseV1,
) as <T>(array: T[]) => T[];
const arraySliceV1 = uncurryFixtureMethodV1(
  CapturedArrayPrototypeSliceV1,
) as <T>(array: readonly T[], start: number, end?: number) => T[];
const arraySpliceV1 = uncurryFixtureMethodV1(
  CapturedArrayPrototypeSpliceV1,
) as <T>(
  array: T[],
  start: number,
  deleteCount: number,
  ...items: T[]
) => T[];
const setAddV1 = uncurryFixtureMethodV1(
  CapturedSetPrototypeAddV1,
) as <T>(set: Set<T>, value: T) => Set<T>;
const setHasV1 = uncurryFixtureMethodV1(
  CapturedSetPrototypeHasV1,
) as <T>(set: Set<T>, value: T) => boolean;
const weakSetAddV1 = uncurryFixtureMethodV1(
  CapturedWeakSetPrototypeAddV1,
) as (set: WeakSet<object>, value: object) => WeakSet<object>;
const weakSetHasV1 = uncurryFixtureMethodV1(
  CapturedWeakSetPrototypeHasV1,
) as (set: WeakSet<object>, value: object) => boolean;
const stringPadStartV1 = uncurryFixtureMethodV1(
  CapturedStringPrototypePadStartV1,
) as (value: string, length: number, fill: string) => string;
const stringRepeatV1 = uncurryFixtureMethodV1(
  CapturedStringPrototypeRepeatV1,
) as (value: string, count: number) => string;
const stringSliceV1 = uncurryFixtureMethodV1(
  CapturedStringPrototypeSliceV1,
) as (value: string, start: number, end?: number) => string;
const stringStartsWithV1 = uncurryFixtureMethodV1(
  CapturedStringPrototypeStartsWithV1,
) as (value: string, search: string, position?: number) => boolean;
const numberToStringV1 = uncurryFixtureMethodV1(
  CapturedNumberPrototypeToStringV1,
) as (value: number, radix?: number) => string;
const textDecodeV1 = uncurryFixtureMethodV1(
  CapturedTextDecoderPrototypeDecodeV1,
) as (decoder: TextDecoder, bytes: Uint8Array) => string;

function bytesToLowerHexV1(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.byteLength; index += 1) {
    output += stringPadStartV1(numberToStringV1(bytes[index]!, 16), 2, "0");
  }
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
      throw new CapturedTypeErrorV1("fixture closure contains a mutable object");
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
    throw new ProviderReleaseTargetUniversePointFixtureError(
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
      !(bytes instanceof Uint8Array) ||
      bytes.byteLength >
        PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_FIXTURE_MAX_BYTES_V1 ||
      bytes.byteLength !== expectedByteLength ||
      rawSha256HexV1(bytes) !== expectedSha256Hex
    ) {
      throw new CapturedTypeErrorV1("anchor mismatch");
    }
  } catch {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      `${label} bytes do not match the immutable anchor`,
    );
  }
}

export class ProviderReleaseTargetUniversePointFixtureError extends CapturedTypeErrorV1 {}

function requestWithCapabilityV1(
  request: PointJsonRequestV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): ValidateProviderReleaseTargetUniversePointClosureV1Input {
  const detached = jsonCloneV1(request) as PointJsonRequestV1 &
    Record<string, unknown>;
  CapturedObjectDefinePropertyV1(detached, "strictCryptoCapability", {
    value: strictCryptoCapability,
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return detached as unknown as ValidateProviderReleaseTargetUniversePointClosureV1Input;
}

function findPositiveVectorV1(
  manifest: ProviderReleaseTargetUniversePointGoldenManifestV1,
  vectorId: PositiveVectorIdV1,
) {
  for (let index = 0; index < manifest.positiveVectors.length; index += 1) {
    const vector = manifest.positiveVectors[index]!;
    if (vector.vectorId === vectorId) return vector;
  }
  throw new ProviderReleaseTargetUniversePointFixtureError(
    `missing positive vector ${vectorId}`,
  );
}

function snapshotProjectionV1(
  closure: ProviderReleaseTargetUniversePointClosureValidationV1,
): ProviderReleaseTargetUniversePointSnapshotProjectionV1 {
  const inherited = closure.targetDiscoveryPointClosure;
  const universe = closure.releaseTargetUniverse.payload;
  const basis = universe.coverageBasis;
  return createProviderNonThenableFrozenRecordV1({
    publicSupportTaxonomyContentDigest:
      inherited.publicSupportTaxonomy.contentDigest,
    releaseMatrixContentDigest: inherited.releaseMatrix.contentDigest,
    targetDiscoveryResultContentDigest:
      inherited.targetDiscoveryResult.contentDigest,
    targetDiscoveryInputBundleContentDigest:
      inherited.targetDiscoveryInputBundleContentDigest,
    releaseMatrixTargetCount: basis.releaseMatrixTargetCount,
    discoveredTargetCount: basis.discoveredTargetCount,
    unresolvedObservationCount: basis.unresolvedObservationCount,
    universeGeneration: universe.universeGeneration,
    universeContentDigest: closure.releaseTargetUniverse.contentDigest,
    universeTargetCount: closure.targetCount,
    universeBucketCount: closure.bucketCount,
    coverageResolution: closure.coverageResolution,
    universeRelativePath: closure.relativePath,
  });
}

function validatePositiveClosureProjectionV1(
  vector: ProviderReleaseTargetUniversePointGoldenManifestV1["positiveVectors"][number],
  closure: ProviderReleaseTargetUniversePointClosureValidationV1,
): void {
  assertRecursivelyFrozenFixtureV1(closure);
  const projection = snapshotProjectionV1(closure);
  if (
    closure.authority !== "none_release_target_universe_structure_only" ||
    vector.expected.pointAdmissionCount !== 1 ||
    vector.expected.signatureVerificationCount !== 7 ||
    !canonicalEqualFixtureV1(
      projection,
      vector.expected.snapshotProjection,
    ) ||
    CapturedReflectOwnKeysV1(projection).length !== 13
  ) {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      `positive vector ${vector.vectorId} projection mismatch`,
    );
  }
}

export function verifyProviderReleaseTargetUniversePointPositiveVectorV1(
  manifest: ProviderReleaseTargetUniversePointGoldenManifestV1,
  index: number,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<ProviderReleaseTargetUniversePointClosureValidationV1> {
  if (
    !CapturedNumberIsSafeIntegerV1(index) ||
    index < 0 ||
    index >= manifest.positiveVectors.length
  ) {
    return createProviderPointRejectedPromiseV1(
      new ProviderReleaseTargetUniversePointFixtureError(
        "positive vector index is outside the exact tuple",
      ),
    );
  }
  const vector = manifest.positiveVectors[index]!;
  let pending: Promise<ProviderReleaseTargetUniversePointClosureValidationV1>;
  try {
    pending = validateProviderReleaseTargetUniversePointClosureV1(
      requestWithCapabilityV1(vector.request, strictCryptoCapability),
    );
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }
  return pending.then((closure) => {
    validatePositiveClosureProjectionV1(vector, closure);
    return closure;
  });
}

export function verifyProviderReleaseTargetUniversePointPositiveVectorsV1(
  manifest: ProviderReleaseTargetUniversePointGoldenManifestV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<readonly ProviderReleaseTargetUniversePointClosureValidationV1[]> {
  let chain = createProviderPointFulfilledPromiseV1(
    [] as ProviderReleaseTargetUniversePointClosureValidationV1[],
  );
  for (let index = 0; index < manifest.positiveVectors.length; index += 1) {
    chain = chain.then((closures) =>
      verifyProviderReleaseTargetUniversePointPositiveVectorV1(
        manifest,
        index,
        strictCryptoCapability,
      ).then((closure) => {
        arrayPushV1(closures, closure);
        return closures;
      }),
    );
  }
  return chain.then((closures) => CapturedObjectFreezeV1(closures));
}

export function verifyProviderReleaseTargetUniversePointGoldenResourceV1(
  bytes: Uint8Array,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<{
  readonly authority: "none_release_target_universe_structure_only";
  readonly manifest: ProviderReleaseTargetUniversePointGoldenManifestV1;
  readonly pointClosure: ProviderReleaseTargetUniversePointClosureValidationV1;
}> {
  let manifest: ProviderReleaseTargetUniversePointGoldenManifestV1;
  try {
    verifyResourceAnchorV1(
      bytes,
      PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
      PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
      "release target Universe point golden",
    );
    manifest = ProviderReleaseTargetUniversePointGoldenManifestV1Schema.parse(
      parseJsonResourceV1(bytes, "release target Universe point golden"),
    );
    const {
      semanticContentDigest: _semanticContentDigest,
      ...semanticFields
    } = manifest;
    if (
      semanticDigestV1(
        PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
        semanticFields,
      ) !== manifest.semanticContentDigest
    ) {
      throw new ProviderReleaseTargetUniversePointFixtureError(
        "release target Universe point golden semantic digest mismatch",
      );
    }
    deepFreezeFixtureValueV1(manifest);
  } catch (error) {
    if (error instanceof ProviderReleaseTargetUniversePointFixtureError) {
      return createProviderPointRejectedPromiseV1(error);
    }
    return createProviderPointRejectedPromiseV1(
      new ProviderReleaseTargetUniversePointFixtureError(
        "release target Universe point golden schema is invalid",
      ),
    );
  }

  const primaryVector = manifest.positiveVectors[0]!;
  return verifyProviderReleaseTargetUniversePointPositiveVectorV1(
    manifest,
    0,
    strictCryptoCapability,
  ).then((pointClosure) => {
    const universe = manifest.releaseTargetUniverse.payload;
    const unsignedHex = bytesToLowerHexV1(
      canonicalizeJcsSafeIntegerUtf8V1(
        projectProviderReleaseTargetUniverseUnsignedClaimsV1(universe),
      ),
    );
    const signatureMessageHex = bytesToLowerHexV1(
      createProviderReleaseTargetUniverseSignatureMessageV1(
        universe,
        manifest.targetDiscoveryPointGolden.activeRoot.rootKeyId,
      ),
    );
    const projection = snapshotProjectionV1(pointClosure);
    if (
      manifest.expected.pointAdmissionCount !== 1 ||
      manifest.expected.signatureVerificationCount !== 7 ||
      manifest.releaseTargetUniverse.contentDigest !==
        primaryVector.request.releaseTargetUniverse.contentDigest ||
      unsignedHex !==
        manifest.expected.universeUnsignedClaimsCanonicalUtf8Hex ||
      signatureMessageHex !==
        manifest.expected.universeSignatureMessageUtf8Hex ||
      !canonicalEqualFixtureV1(
        projection,
        manifest.expected.snapshotProjection,
      ) ||
      buildProviderReleaseTargetUniverseRelativePathV1(
        manifest.releaseTargetUniverse,
      ) !== projection.universeRelativePath
    ) {
      throw new ProviderReleaseTargetUniversePointFixtureError(
        "release target Universe point golden projection mismatch",
      );
    }
    return createProviderNonThenableFrozenRecordV1({
      authority: manifest.fixtureAuthority,
      manifest,
      pointClosure,
    });
  });
}

export function verifyProviderReleaseTargetUniversePointInvalidResourceV1(
  bytes: Uint8Array,
): ProviderReleaseTargetUniversePointInvalidManifestV1 {
  verifyResourceAnchorV1(
    bytes,
    PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
    PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
    "release target Universe point invalid corpus",
  );
  let manifest: ProviderReleaseTargetUniversePointInvalidManifestV1;
  try {
    manifest = ProviderReleaseTargetUniversePointInvalidManifestV1Schema.parse(
      parseJsonResourceV1(bytes, "release target Universe point invalid corpus"),
    ) as ProviderReleaseTargetUniversePointInvalidManifestV1;
  } catch (error) {
    if (error instanceof ProviderReleaseTargetUniversePointFixtureError) {
      throw error;
    }
    throw new ProviderReleaseTargetUniversePointFixtureError(
      "release target Universe point invalid corpus schema is invalid",
    );
  }
  for (let index = 0; index < INVALID_CASE_IDS_V1.length; index += 1) {
    const caseId = INVALID_CASE_IDS_V1[index]!;
    if (
      manifest.caseIds[index] !== caseId ||
      manifest.cases[index]?.caseId !== caseId ||
      (index < INHERITED_CASE_IDS_V1.length &&
        manifest.inheritedReplayRecipes[index]?.caseId !== caseId)
    ) {
      throw new ProviderReleaseTargetUniversePointFixtureError(
        "release target Universe point invalid case inventory drift",
      );
    }
  }
  const {
    semanticContentDigest: _semanticContentDigest,
    ...semanticFields
  } = manifest;
  if (
    semanticDigestV1(
      PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_SEMANTIC_DOMAIN_V1,
      semanticFields,
    ) !== manifest.semanticContentDigest
  ) {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      "release target Universe point invalid semantic digest mismatch",
    );
  }
  return deepFreezeFixtureValueV1(manifest);
}

type PatchOperationV1 = z.infer<typeof PatchOperationV1Schema>;
type LocatorBuilderRecipeV1 = z.infer<typeof LocatorBuilderRecipeV1Schema>;

function readReplayPathV1(
  root: unknown,
  path: readonly (string | number)[],
): unknown {
  let value = root;
  for (let index = 0; index < path.length; index += 1) {
    if (
      value === null ||
      (typeof value !== "object" && typeof value !== "function")
    ) {
      throw new ProviderReleaseTargetUniversePointFixtureError(
        "replay path crosses a primitive",
      );
    }
    value = CapturedReflectGetV1(value, path[index]!);
  }
  return value;
}

function replaceReplayPathV1(
  root: unknown,
  path: readonly (string | number)[],
  value: unknown,
): unknown {
  if (path.length === 0) return value;
  const parent = readReplayPathV1(root, arraySliceV1(path, 0, -1));
  if (
    parent === null ||
    (typeof parent !== "object" && typeof parent !== "function") ||
    !CapturedReflectSetV1(parent, path[path.length - 1]!, value, parent)
  ) {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      "replay path is not writable",
    );
  }
  return root;
}

function applyPatchOperationsV1(
  rootInput: unknown,
  operations: readonly PatchOperationV1[],
): unknown {
  let root = rootInput;
  for (let index = 0; index < operations.length; index += 1) {
    const operation = operations[index]!;
    if (operation.op === "set") {
      root = replaceReplayPathV1(
        root,
        operation.path,
        jsonCloneV1(operation.value),
      );
      continue;
    }
    if (operation.op === "delete") {
      if (operation.path.length === 0) {
        throw new ProviderReleaseTargetUniversePointFixtureError(
          "replay cannot delete its root",
        );
      }
      const parent = readReplayPathV1(
        root,
        arraySliceV1(operation.path, 0, -1),
      );
      if (
        parent === null ||
        (typeof parent !== "object" && typeof parent !== "function") ||
        !CapturedReflectDeletePropertyV1(
          parent,
          operation.path[operation.path.length - 1]!,
        )
      ) {
        throw new ProviderReleaseTargetUniversePointFixtureError(
          "replay delete failed",
        );
      }
      continue;
    }
    const target = readReplayPathV1(root, operation.path);
    if (!CapturedArrayIsArrayV1(target)) {
      throw new ProviderReleaseTargetUniversePointFixtureError(
        `replay ${operation.op} target is not an array`,
      );
    }
    if (operation.op === "reverse") {
      arrayReverseV1(target);
      continue;
    }
    const items = jsonCloneV1(operation.items) as JsonValueV1[];
    CapturedReflectApplyV1(arraySpliceV1, undefined, [
      target,
      operation.start,
      operation.deleteCount,
      ...items,
    ]);
  }
  return root;
}

function repeatedReplayArrayV1(source: unknown, count: number): unknown[] {
  const output = new CapturedArrayV1<unknown>(count);
  for (let index = 0; index < count; index += 1) {
    CapturedObjectDefinePropertyV1(output, index, {
      value: jsonCloneV1(source),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return output;
}

function applyReplayRecipeV1(
  baseInput: unknown,
  recipe: ProviderReleaseTargetUniversePointReplayRecipeV1,
): unknown {
  let root = jsonCloneV1(baseInput);
  if (recipe.kind === "patch") {
    return applyPatchOperationsV1(root, recipe.operations);
  }
  if (recipe.kind === "repeat") {
    root = applyPatchOperationsV1(root, recipe.operations);
    const target = readReplayPathV1(root, recipe.path);
    if (
      !CapturedArrayIsArrayV1(target) ||
      target[recipe.sourceIndex] === undefined
    ) {
      throw new ProviderReleaseTargetUniversePointFixtureError(
        "repeat replay source is unavailable",
      );
    }
    root = replaceReplayPathV1(
      root,
      recipe.path,
      repeatedReplayArrayV1(target[recipe.sourceIndex], recipe.count),
    );
    return applyPatchOperationsV1(root, recipe.postOperations);
  }
  if (recipe.kind === "padding") {
    root = applyPatchOperationsV1(root, recipe.operations);
    if (recipe.codeUnitLength < recipe.prefix.length) {
      throw new ProviderReleaseTargetUniversePointFixtureError(
        "padding replay length is shorter than its prefix",
      );
    }
    root = replaceReplayPathV1(
      root,
      recipe.path,
      `${recipe.prefix}${stringRepeatV1(
        recipe.character,
        recipe.codeUnitLength - recipe.prefix.length,
      )}`,
    );
    if (recipe.repeat !== undefined) {
      const target = readReplayPathV1(root, recipe.repeat.path);
      if (
        !CapturedArrayIsArrayV1(target) ||
        target[recipe.repeat.sourceIndex] === undefined
      ) {
        throw new ProviderReleaseTargetUniversePointFixtureError(
          "padding replay repeat source is unavailable",
        );
      }
      root = replaceReplayPathV1(
        root,
        recipe.repeat.path,
        repeatedReplayArrayV1(
          target[recipe.repeat.sourceIndex],
          recipe.repeat.count,
        ),
      );
    }
    return applyPatchOperationsV1(root, recipe.postOperations);
  }
  throw new ProviderReleaseTargetUniversePointFixtureError(
    `replay ${recipe.kind} requires a live execution profile`,
  );
}

function invalidCaseIndexV1(
  invalidManifest: ProviderReleaseTargetUniversePointInvalidManifestV1,
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
): number {
  for (let index = 0; index < invalidManifest.cases.length; index += 1) {
    if (
      invalidManifest.cases[index] === invalidCase &&
      invalidManifest.caseIds[index] === invalidCase.caseId
    ) {
      return index;
    }
  }
  for (let index = 0; index < invalidManifest.cases.length; index += 1) {
    if (
      invalidManifest.cases[index]?.caseId === invalidCase.caseId &&
      invalidManifest.caseIds[index] === invalidCase.caseId
    ) {
      return index;
    }
  }
  throw new ProviderReleaseTargetUniversePointFixtureError(
    `invalid case ${invalidCase.caseId} is outside the exact manifest tuple`,
  );
}

function effectiveReplayRecipeV1(
  invalidManifest: ProviderReleaseTargetUniversePointInvalidManifestV1,
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
): ProviderReleaseTargetUniversePointReplayRecipeV1 {
  const index = invalidCaseIndexV1(invalidManifest, invalidCase);
  if (index < INHERITED_CASE_IDS_V1.length) {
    const inherited = invalidManifest.inheritedReplayRecipes[index];
    if (
      inherited === undefined ||
      inherited.caseId !== invalidCase.caseId ||
      inherited.sourceOperation !==
        stringSliceV1(invalidCase.caseId, "discovery-".length)
    ) {
      throw new ProviderReleaseTargetUniversePointFixtureError(
        `inherited replay ${invalidCase.caseId} is misaligned`,
      );
    }
    return inherited.replay;
  }
  const recipe = invalidCase.mutation.recipe;
  if (
    recipe.kind === "target_discovery_point" ||
    recipe.kind === "target_discovery_locator_builder"
  ) {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      `point case ${invalidCase.caseId} has an inherited recipe`,
    );
  }
  return recipe as ProviderReleaseTargetUniversePointReplayRecipeV1;
}

function baseRequestForInvalidCaseV1(
  goldenManifest: ProviderReleaseTargetUniversePointGoldenManifestV1,
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
): PointJsonRequestV1 {
  return findPositiveVectorV1(
    goldenManifest,
    invalidCase.mutation.baseVectorId,
  ).request;
}

function inheritedLocatorBaseV1(
  goldenManifest: ProviderReleaseTargetUniversePointGoldenManifestV1,
  caseId: ProviderReleaseTargetUniversePointInheritedCaseIdV1,
): unknown {
  const sourceOperation = stringSliceV1(caseId, "discovery-".length);
  const source = goldenManifest.targetDiscoveryPointGolden;
  if (stringStartsWithV1(sourceOperation, "taxonomy-")) {
    return source.publicSupportTaxonomy;
  }
  if (stringStartsWithV1(sourceOperation, "matrix-")) return source.releaseMatrix;
  if (stringStartsWithV1(sourceOperation, "fixture-")) {
    return source.targetDiscoveryFixtureManifest;
  }
  if (stringStartsWithV1(sourceOperation, "runner-")) {
    return source.targetDiscoveryRunnerRun;
  }
  if (stringStartsWithV1(sourceOperation, "result-")) {
    return source.targetDiscoveryResult;
  }
  throw new ProviderReleaseTargetUniversePointFixtureError(
    `unknown inherited locator ${caseId}`,
  );
}

function materializeLocatorInputV1(
  goldenManifest: ProviderReleaseTargetUniversePointGoldenManifestV1,
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
  recipe: LocatorBuilderRecipeV1,
): unknown {
  const base = stringStartsWithV1(invalidCase.caseId, "discovery-")
    ? inheritedLocatorBaseV1(
        goldenManifest,
        invalidCase.caseId as ProviderReleaseTargetUniversePointInheritedCaseIdV1,
      )
    : baseRequestForInvalidCaseV1(goldenManifest, invalidCase)
        .releaseTargetUniverse;
  return applyPatchOperationsV1(
    jsonCloneV1(base),
    recipe.operations,
  );
}

function materializeJsonExecutionRequestV1(
  goldenManifest: ProviderReleaseTargetUniversePointGoldenManifestV1,
  invalidManifest: ProviderReleaseTargetUniversePointInvalidManifestV1,
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
): PointJsonRequestV1 {
  const recipe = effectiveReplayRecipeV1(invalidManifest, invalidCase);
  if (
    recipe.kind === "locator_builder" ||
    recipe.kind === "hostile_input" ||
    recipe.kind === "async_mutation"
  ) {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      `${invalidCase.caseId} is not a JSON request replay`,
    );
  }
  return applyReplayRecipeV1(
    baseRequestForInvalidCaseV1(goldenManifest, invalidCase),
    recipe,
  ) as PointJsonRequestV1;
}

export function materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1(
  goldenManifest: ProviderReleaseTargetUniversePointGoldenManifestV1,
  invalidManifest: ProviderReleaseTargetUniversePointInvalidManifestV1,
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
): unknown {
  const recipe = effectiveReplayRecipeV1(invalidManifest, invalidCase);
  if (
    invalidCase.caseId === "universe-generation-unsafe" ||
    invalidCase.caseId === "universe-generation-fractional"
  ) {
    return {
      caseId: invalidCase.caseId,
      executionProfile:
        invalidCase.caseId === "universe-generation-unsafe"
          ? "provider_release_target_universe_non_jcs_safe_integer_execution_v1"
          : "provider_release_target_universe_non_jcs_fractional_execution_v1",
      goldenSemanticContentDigest: goldenManifest.semanticContentDigest,
    };
  }
  if (recipe.kind === "locator_builder") {
    return {
      caseId: invalidCase.caseId,
      locatorInput: materializeLocatorInputV1(
        goldenManifest,
        invalidCase,
        recipe,
      ),
    };
  }
  if (recipe.kind === "hostile_input" || recipe.kind === "async_mutation") {
    return {
      caseId: invalidCase.caseId,
      executionProfile: recipe.profile,
      goldenSemanticContentDigest: goldenManifest.semanticContentDigest,
    };
  }
  return {
    caseId: invalidCase.caseId,
    request: materializeJsonExecutionRequestV1(
      goldenManifest,
      invalidManifest,
      invalidCase,
    ),
  };
}

export interface ProviderReleaseTargetUniversePointExecutionCounterV1 {
  readonly pointAdmissionCount: () => number;
  readonly signatureVerificationCount: () => number;
  readonly mutateDuringNextSignature: (mutation: () => void) => void;
}

interface CapturedExecutionCounterV1 {
  readonly readPointAdmissionCount: () => number;
  readonly readSignatureVerificationCount: () => number;
  readonly mutateDuringNextSignature: (mutation: () => void) => void;
}

interface ExecutionCountStartV1 {
  readonly pointAdmissionCount: number;
  readonly signatureVerificationCount: number;
}

function captureExecutionCounterV1(
  counter: ProviderReleaseTargetUniversePointExecutionCounterV1,
): CapturedExecutionCounterV1 {
  const pointDescriptor = CapturedObjectGetOwnPropertyDescriptorV1(
    counter,
    "pointAdmissionCount",
  );
  const signatureDescriptor = CapturedObjectGetOwnPropertyDescriptorV1(
    counter,
    "signatureVerificationCount",
  );
  const mutationDescriptor = CapturedObjectGetOwnPropertyDescriptorV1(
    counter,
    "mutateDuringNextSignature",
  );
  if (
    pointDescriptor === undefined ||
    !("value" in pointDescriptor) ||
    typeof pointDescriptor.value !== "function" ||
    signatureDescriptor === undefined ||
    !("value" in signatureDescriptor) ||
    typeof signatureDescriptor.value !== "function" ||
    mutationDescriptor === undefined ||
    !("value" in mutationDescriptor) ||
    typeof mutationDescriptor.value !== "function"
  ) {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      "execution counter must expose three own data methods",
    );
  }
  const readPointAdmissionCount = (): number =>
    CapturedReflectApplyV1(pointDescriptor.value as Function, counter, []) as number;
  const readSignatureVerificationCount = (): number =>
    CapturedReflectApplyV1(
      signatureDescriptor.value as Function,
      counter,
      [],
    ) as number;
  const mutateDuringNextSignature = (mutation: () => void): void => {
    CapturedReflectApplyV1(mutationDescriptor.value as Function, counter, [
      mutation,
    ]);
  };
  return CapturedObjectFreezeV1({
    readPointAdmissionCount,
    readSignatureVerificationCount,
    mutateDuringNextSignature,
  });
}

function readExecutionCountStartV1(
  counter: CapturedExecutionCounterV1,
): ExecutionCountStartV1 {
  const pointAdmissionCount = counter.readPointAdmissionCount();
  const signatureVerificationCount =
    counter.readSignatureVerificationCount();
  if (
    !CapturedNumberIsSafeIntegerV1(pointAdmissionCount) ||
    pointAdmissionCount < 0 ||
    !CapturedNumberIsSafeIntegerV1(signatureVerificationCount) ||
    signatureVerificationCount < 0
  ) {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      "execution counter returned an invalid cumulative count",
    );
  }
  return CapturedObjectFreezeV1({
    pointAdmissionCount,
    signatureVerificationCount,
  });
}

function executionCountDeltaV1(
  counter: CapturedExecutionCounterV1,
  start: ExecutionCountStartV1,
): ExecutionCountStartV1 {
  const end = readExecutionCountStartV1(counter);
  const pointAdmissionCount =
    end.pointAdmissionCount - start.pointAdmissionCount;
  const signatureVerificationCount =
    end.signatureVerificationCount - start.signatureVerificationCount;
  if (pointAdmissionCount < 0 || signatureVerificationCount < 0) {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      "execution counter moved backwards",
    );
  }
  return CapturedObjectFreezeV1({
    pointAdmissionCount,
    signatureVerificationCount,
  });
}

type PublicFailureProjectionV1 = Readonly<{
  errorName: unknown;
  code: unknown;
  reason: unknown;
}>;

export type ProviderReleaseTargetUniversePointInvalidCaseExecutionV1 =
  | Readonly<{
      kind: "unexpected_acceptance";
      pointAdmissionCount: number;
      signatureVerificationCount: number;
    }>
  | Readonly<{
      kind: "rejection";
      boundary: "internal_diagnostic";
      stage: z.infer<
        typeof ProviderReleaseTargetUniversePointFixtureInvalidStageV1Schema
      >;
      reason: z.infer<
        typeof ProviderReleaseTargetUniversePointInvalidReasonV1Schema
      >;
      publicFailure: PublicFailureProjectionV1 | undefined;
      pointAdmissionCount: number;
      signatureVerificationCount: number;
    }>
  | Readonly<{
      kind: "rejection";
      boundary: "locator_builder";
      stage: "target_discovery_locator" | "universe_locator";
      reason: "envelope_mismatch";
      pointAdmissionCount: 0;
      signatureVerificationCount: 0;
    }>
  | Readonly<{
      kind: "snapshot_acceptance";
      boundary: "snapshot_stability";
      authority: "none_release_target_universe_structure_only";
      snapshotProjection: ProviderReleaseTargetUniversePointSnapshotProjectionV1;
      pointAdmissionCount: number;
      signatureVerificationCount: number;
    }>;

interface PreparedInvalidInputV1 {
  readonly input: unknown;
  readonly getterCalls: () => number;
  readonly trapCalls: () => number;
  readonly cleanup: () => void;
}

type SavedPropertyV1 = Readonly<{
  target: object;
  key: PropertyKey;
  descriptor: PropertyDescriptor | undefined;
}>;

function savePropertyV1(target: object, key: PropertyKey): SavedPropertyV1 {
  return CapturedObjectFreezeV1({
    target,
    key,
    descriptor: CapturedObjectGetOwnPropertyDescriptorV1(target, key),
  });
}

function descriptorRecordV1(
  fields: Readonly<Record<string, unknown>>,
): PropertyDescriptor {
  const descriptor = CapturedObjectCreateV1(null) as Record<string, unknown>;
  const keys = CapturedReflectOwnKeysV1(fields);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]!;
    CapturedReflectSetV1(descriptor, key, CapturedReflectGetV1(fields, key));
  }
  return descriptor;
}

function defineDataPropertyV1(
  target: object,
  key: PropertyKey,
  value: unknown,
  enumerable: boolean,
  configurable = true,
  writable = true,
): void {
  CapturedObjectDefinePropertyV1(
    target,
    key,
    descriptorRecordV1({
      value,
      enumerable,
      configurable,
      writable,
    }),
  );
}

function defineAccessorPropertyV1(
  target: object,
  key: PropertyKey,
  get: (() => unknown) | undefined,
  set: ((value: unknown) => void) | undefined,
  enumerable: boolean,
  configurable = true,
): void {
  CapturedObjectDefinePropertyV1(
    target,
    key,
    descriptorRecordV1({ get, set, enumerable, configurable }),
  );
}

function descriptorsEqualV1(
  left: PropertyDescriptor | undefined,
  right: PropertyDescriptor | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  const keys = [
    "value",
    "get",
    "set",
    "enumerable",
    "configurable",
    "writable",
  ] as const;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]!;
    const leftHas = key in left;
    const rightHas = key in right;
    if (leftHas !== rightHas || (leftHas && left[key] !== right[key])) {
      return false;
    }
  }
  return true;
}

function restorePropertyV1(saved: SavedPropertyV1): void {
  if (saved.descriptor === undefined) {
    if (!CapturedReflectDeletePropertyV1(saved.target, saved.key)) {
      throw new ProviderReleaseTargetUniversePointFixtureError(
        "failed to delete a fixture-installed primordial property",
      );
    }
  } else {
    CapturedObjectDefinePropertyV1(saved.target, saved.key, saved.descriptor);
  }
  if (
    !descriptorsEqualV1(
      CapturedObjectGetOwnPropertyDescriptorV1(saved.target, saved.key),
      saved.descriptor,
    )
  ) {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      "fixture failed to restore a primordial descriptor exactly",
    );
  }
}

function noCleanupV1(): void {}

function requestRecordV1(
  goldenManifest: ProviderReleaseTargetUniversePointGoldenManifestV1,
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Record<PropertyKey, unknown> {
  return requestWithCapabilityV1(
    baseRequestForInvalidCaseV1(goldenManifest, invalidCase),
    strictCryptoCapability,
  ) as unknown as Record<PropertyKey, unknown>;
}

function releaseTargetUniversePartsV1(
  request: Record<PropertyKey, unknown>,
): {
  readonly envelope: Record<PropertyKey, unknown>;
  readonly payload: Record<PropertyKey, unknown>;
} {
  const envelope = request.releaseTargetUniverse as Record<
    PropertyKey,
    unknown
  >;
  const payload = envelope.payload as Record<PropertyKey, unknown>;
  return { envelope, payload };
}

function restorePropertiesV1(saved: readonly SavedPropertyV1[]): void {
  let firstError: unknown;
  for (let index = saved.length - 1; index >= 0; index -= 1) {
    try {
      restorePropertyV1(saved[index]!);
    } catch (error) {
      if (firstError === undefined) firstError = error;
    }
  }
  if (firstError !== undefined) throw firstError;
}

function preparedInputV1(
  input: unknown,
  getterCalls: () => number,
  trapCalls: () => number,
  cleanup: () => void = noCleanupV1,
): PreparedInvalidInputV1 {
  return CapturedObjectFreezeV1({ input, getterCalls, trapCalls, cleanup });
}

function prepareInheritedHostileInputV1(
  goldenManifest: ProviderReleaseTargetUniversePointGoldenManifestV1,
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
  sourceProfile: string,
): PreparedInvalidInputV1 {
  const request = requestRecordV1(
    goldenManifest,
    invalidCase,
    strictCryptoCapability,
  );
  const resultEnvelope = request.targetDiscoveryResult as Record<
    PropertyKey,
    unknown
  >;
  const resultPayload = resultEnvelope.payload as Record<PropertyKey, unknown>;
  let getterCalls = 0;
  let trapCalls = 0;
  switch (sourceProfile) {
    case "security-top-level-proxy":
      return preparedInputV1(
        new CapturedProxyV1(request, {
          ownKeys(target) {
            trapCalls += 1;
            return CapturedReflectOwnKeysV1(target);
          },
        }),
        () => getterCalls,
        () => trapCalls,
      );
    case "security-nested-proxy":
      resultEnvelope.payload = new CapturedProxyV1(resultPayload, {
        ownKeys(target) {
          trapCalls += 1;
          return CapturedReflectOwnKeysV1(target);
        },
      });
      break;
    case "security-top-level-getter":
      defineAccessorPropertyV1(
        request,
        "unexpected",
        () => {
          getterCalls += 1;
          return true;
        },
        undefined,
        true,
      );
      break;
    case "security-nested-getter":
      defineAccessorPropertyV1(
        resultPayload,
        "unexpected",
        () => {
          getterCalls += 1;
          return true;
        },
        undefined,
        true,
      );
      break;
    case "security-nested-hidden":
      defineDataPropertyV1(resultPayload, "hidden", true, false);
      break;
    case "security-nested-symbol":
      defineDataPropertyV1(resultPayload, Symbol("hostile"), true, true);
      break;
    case "security-sparse-array": {
      const targets = resultPayload.targets as unknown[];
      CapturedReflectDeletePropertyV1(targets, 0);
      break;
    }
    case "security-cycle":
      resultEnvelope.cycle = resultEnvelope;
      break;
    case "security-alias": {
      const targets = resultPayload.targets as unknown[];
      targets[1] = targets[0];
      break;
    }
    default:
      throw new ProviderReleaseTargetUniversePointFixtureError(
        `unknown inherited hostile profile ${sourceProfile}`,
      );
  }
  return preparedInputV1(
    request,
    () => getterCalls,
    () => trapCalls,
  );
}

function prepareObjectPrototypeThenHostileV1(
  request: Record<PropertyKey, unknown>,
): PreparedInvalidInputV1 {
  const { envelope, payload } = releaseTargetUniversePartsV1(request);
  const saved = CapturedObjectFreezeV1([
    savePropertyV1(CapturedObjectPrototypeV1, "then"),
  ]);
  let thenCalls = 0;
  let trapCalls = 0;
  let cleaned = false;
  const forgedAcceptedValue = CapturedObjectFreezeV1({
    ok: true,
    value: "forged",
  });
  const proxy = new CapturedProxyV1(payload, {
    ownKeys(target) {
      trapCalls += 1;
      defineDataPropertyV1(
        CapturedObjectPrototypeV1,
        "then",
        (resolve: (value: unknown) => unknown): unknown => {
          thenCalls += 1;
          return resolve(forgedAcceptedValue);
        },
        false,
      );
      CapturedReflectSetV1(envelope, "payload", payload, envelope);
      return CapturedReflectOwnKeysV1(target);
    },
  });
  CapturedReflectSetV1(envelope, "payload", proxy, envelope);
  return preparedInputV1(
    request,
    () => thenCalls,
    () => trapCalls,
    () => {
      if (cleaned) return;
      cleaned = true;
      restorePropertiesV1(saved);
    },
  );
}

function preparePromisePrimordialHostileV1(
  request: Record<PropertyKey, unknown>,
): PreparedInvalidInputV1 {
  const { envelope, payload } = releaseTargetUniversePartsV1(request);
  const saved = CapturedObjectFreezeV1([
    savePropertyV1(CapturedPromiseV1.prototype, "constructor"),
    savePropertyV1(CapturedPromiseV1.prototype, "then"),
    savePropertyV1(CapturedPromiseV1, CapturedSymbolSpeciesV1),
  ]);
  let poisonCalls = 0;
  let trapCalls = 0;
  let cleaned = false;
  const forged = CapturedObjectFreezeV1({ forgedPromiseValue: true });
  function ForgedPromiseConstructorV1(): object {
    poisonCalls += 1;
    return forged;
  }
  const poisonedThen = function (
    this: unknown,
    onFulfilled?: ((value: unknown) => unknown) | null,
  ): unknown {
    poisonCalls += 1;
    return typeof onFulfilled === "function"
      ? CapturedReflectApplyV1(onFulfilled, undefined, [forged])
      : forged;
  };
  const proxy = new CapturedProxyV1(payload, {
    ownKeys(target) {
      trapCalls += 1;
      defineDataPropertyV1(
        CapturedPromiseV1.prototype,
        "constructor",
        ForgedPromiseConstructorV1,
        false,
      );
      defineDataPropertyV1(
        CapturedPromiseV1.prototype,
        "then",
        poisonedThen,
        false,
      );
      defineAccessorPropertyV1(
        CapturedPromiseV1,
        CapturedSymbolSpeciesV1,
        () => {
          poisonCalls += 1;
          return ForgedPromiseConstructorV1;
        },
        undefined,
        false,
      );
      CapturedReflectSetV1(envelope, "payload", payload, envelope);
      return CapturedReflectOwnKeysV1(target);
    },
  });
  CapturedReflectSetV1(envelope, "payload", proxy, envelope);
  return preparedInputV1(
    request,
    () => poisonCalls,
    () => trapCalls,
    () => {
      if (cleaned) return;
      cleaned = true;
      restorePropertiesV1(saved);
    },
  );
}

function preparePointHostileInputV1(
  goldenManifest: ProviderReleaseTargetUniversePointGoldenManifestV1,
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
  profile: ProviderReleaseTargetUniversePointInvalidCaseIdV1,
): PreparedInvalidInputV1 {
  if (stringStartsWithV1(profile, "discovery-")) {
    return prepareInheritedHostileInputV1(
      goldenManifest,
      invalidCase,
      strictCryptoCapability,
      stringSliceV1(profile, "discovery-".length),
    );
  }
  const request = requestRecordV1(
    goldenManifest,
    invalidCase,
    strictCryptoCapability,
  );
  const { envelope, payload } = releaseTargetUniversePartsV1(request);
  let getterCalls = 0;
  let trapCalls = 0;
  switch (profile) {
    case "point-input-plain-validation-dto":
      return preparedInputV1(
        { authority: "none_release_target_universe_structure_only" },
        () => getterCalls,
        () => trapCalls,
      );
    case "point-input-fake-capability":
      request.strictCryptoCapability = CapturedObjectFreezeV1({});
      break;
    case "point-input-fake-capability-getter": {
      const fake = CapturedObjectCreateV1(null) as Record<PropertyKey, unknown>;
      defineAccessorPropertyV1(
        fake,
        "capability",
        () => {
          getterCalls += 1;
          return strictCryptoCapability;
        },
        undefined,
        true,
      );
      request.strictCryptoCapability = fake;
      break;
    }
    case "point-input-fake-capability-proxy":
      request.strictCryptoCapability = new CapturedProxyV1(
        CapturedObjectFreezeV1({}),
        {
          get() {
            trapCalls += 1;
            return undefined;
          },
          ownKeys() {
            trapCalls += 1;
            return [];
          },
          getOwnPropertyDescriptor() {
            trapCalls += 1;
            return undefined;
          },
        },
      );
      break;
    case "point-security-top-level-proxy":
      return preparedInputV1(
        new CapturedProxyV1(request, {
          ownKeys(target) {
            trapCalls += 1;
            return CapturedReflectOwnKeysV1(target);
          },
        }),
        () => getterCalls,
        () => trapCalls,
      );
    case "point-security-universe-proxy":
      request.releaseTargetUniverse = new CapturedProxyV1(envelope, {
        ownKeys(target) {
          trapCalls += 1;
          return CapturedReflectOwnKeysV1(target);
        },
      });
      break;
    case "point-security-universe-nested-proxy":
      envelope.payload = new CapturedProxyV1(payload, {
        ownKeys(target) {
          trapCalls += 1;
          return CapturedReflectOwnKeysV1(target);
        },
      });
      break;
    case "point-security-universe-self-removing-proxy": {
      const proxy = new CapturedProxyV1(payload, {
        ownKeys(target) {
          trapCalls += 1;
          CapturedReflectSetV1(envelope, "payload", payload, envelope);
          return CapturedReflectOwnKeysV1(target);
        },
      });
      envelope.payload = proxy;
      break;
    }
    case "point-security-top-level-getter":
      defineAccessorPropertyV1(
        request,
        "unexpected",
        () => {
          getterCalls += 1;
          return true;
        },
        undefined,
        true,
      );
      break;
    case "point-security-universe-getter":
      defineAccessorPropertyV1(
        envelope,
        "unexpected",
        () => {
          getterCalls += 1;
          return true;
        },
        undefined,
        true,
      );
      break;
    case "point-security-universe-nested-getter":
      defineAccessorPropertyV1(
        payload,
        "unexpected",
        () => {
          getterCalls += 1;
          return true;
        },
        undefined,
        true,
      );
      break;
    case "point-security-top-level-hidden":
      defineDataPropertyV1(request, "hidden", true, false);
      break;
    case "point-security-universe-nested-hidden":
      defineDataPropertyV1(payload, "hidden", true, false);
      break;
    case "point-security-top-level-symbol":
      defineDataPropertyV1(request, Symbol("hostile"), true, true);
      break;
    case "point-security-universe-nested-symbol":
      defineDataPropertyV1(payload, Symbol("hostile"), true, true);
      break;
    case "point-security-universe-sparse-targets":
      CapturedReflectDeletePropertyV1(payload.targets as unknown[], 0);
      break;
    case "point-security-universe-sparse-buckets":
      CapturedReflectDeletePropertyV1(payload.buckets as unknown[], 0);
      break;
    case "point-security-universe-sparse-bucket-target-ids": {
      const buckets = payload.buckets as Array<Record<string, unknown>>;
      const coverage = buckets[0]!.coverage as Record<string, unknown>;
      CapturedReflectDeletePropertyV1(
        coverage.targetProfileIds as unknown[],
        0,
      );
      break;
    }
    case "point-security-universe-cycle":
      payload.coverageBasis = payload;
      break;
    case "point-security-universe-alias": {
      const buckets = payload.buckets as Array<Record<string, unknown>>;
      const coverage = buckets[0]!.coverage as Record<string, unknown>;
      coverage.targetProfileIds = payload.targets;
      break;
    }
    case "point-security-universe-to-inherited-alias":
      payload.distributionRootBinding = request.distributionRootBinding;
      break;
    case "point-security-inherited-to-universe-alias":
      request.distributionRootBinding = payload.distributionRootBinding;
      break;
    case "point-security-object-prototype-then":
      return prepareObjectPrototypeThenHostileV1(request);
    case "point-security-promise-primordials":
      return preparePromisePrimordialHostileV1(request);
    case "universe-generation-unsafe":
      payload.universeGeneration = CapturedNumberMaxSafeIntegerV1 + 1;
      break;
    case "universe-generation-fractional":
      payload.universeGeneration = 1.5;
      break;
    default:
      throw new ProviderReleaseTargetUniversePointFixtureError(
        `unknown point hostile profile ${profile}`,
      );
  }
  return preparedInputV1(
    request,
    () => getterCalls,
    () => trapCalls,
  );
}

function prepareInvalidInputV1(
  goldenManifest: ProviderReleaseTargetUniversePointGoldenManifestV1,
  invalidManifest: ProviderReleaseTargetUniversePointInvalidManifestV1,
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): PreparedInvalidInputV1 {
  const recipe = effectiveReplayRecipeV1(invalidManifest, invalidCase);
  if (recipe.kind === "hostile_input") {
    return preparePointHostileInputV1(
      goldenManifest,
      invalidCase,
      strictCryptoCapability,
      recipe.profile,
    );
  }
  if (
    recipe.kind === "locator_builder" ||
    recipe.kind === "async_mutation"
  ) {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      `${invalidCase.caseId} is not a diagnostic request`,
    );
  }
  return preparedInputV1(
    requestWithCapabilityV1(
      materializeJsonExecutionRequestV1(
        goldenManifest,
        invalidManifest,
        invalidCase,
      ),
      strictCryptoCapability,
    ),
    () => 0,
    () => 0,
  );
}

function invokeLocatorBuilderV1(
  caseId: ProviderReleaseTargetUniversePointInvalidCaseIdV1,
  input: unknown,
): unknown {
  if (!stringStartsWithV1(caseId, "discovery-")) {
    return buildProviderReleaseTargetUniverseRelativePathV1(input);
  }
  const sourceOperation = stringSliceV1(caseId, "discovery-".length);
  if (stringStartsWithV1(sourceOperation, "taxonomy-")) {
    return buildProviderPublicSupportTaxonomyRelativePathV1(input);
  }
  if (stringStartsWithV1(sourceOperation, "matrix-")) {
    return buildProviderReleaseMatrixRelativePathV1(input);
  }
  if (stringStartsWithV1(sourceOperation, "fixture-")) {
    return buildProviderTargetDiscoveryFixtureManifestRelativePathV1(input);
  }
  if (stringStartsWithV1(sourceOperation, "runner-")) {
    return buildProviderTargetDiscoveryRunnerRunRelativePathV1(input);
  }
  if (stringStartsWithV1(sourceOperation, "result-")) {
    return buildProviderTargetDiscoveryResultRelativePathV1(input);
  }
  throw new ProviderReleaseTargetUniversePointFixtureError(
    `unknown locator builder ${caseId}`,
  );
}

function locatorRejectedV1(
  caseId: ProviderReleaseTargetUniversePointInvalidCaseIdV1,
  input: unknown,
): boolean {
  try {
    invokeLocatorBuilderV1(caseId, input);
    return false;
  } catch {
    return true;
  }
}

function executeSequentialLocatorPollutionV1(
  baseInput: unknown,
): void {
  const firstEnvelope = jsonCloneV1(baseInput) as Record<PropertyKey, unknown>;
  const accessorEnvelope = jsonCloneV1(baseInput) as Record<
    PropertyKey,
    unknown
  >;
  const finalEnvelope = jsonCloneV1(baseInput) as Record<PropertyKey, unknown>;
  const firstPayload = firstEnvelope.payload as Record<PropertyKey, unknown>;
  const finalPayload = finalEnvelope.payload as Record<PropertyKey, unknown>;
  const saved = CapturedObjectFreezeV1([
    savePropertyV1(CapturedObjectPrototypeV1, "value"),
    savePropertyV1(CapturedArrayPrototypeV1, "0"),
  ]);
  let firstTrapCalls = 0;
  let accessorGetterCalls = 0;
  let finalTrapCalls = 0;
  let cleaned = false;
  try {
    firstEnvelope.payload = new CapturedProxyV1(firstPayload, {
      ownKeys(target) {
        firstTrapCalls += 1;
        defineDataPropertyV1(
          CapturedObjectPrototypeV1,
          "value",
          "polluted",
          false,
        );
        defineAccessorPropertyV1(
          CapturedArrayPrototypeV1,
          "0",
          undefined,
          () => undefined,
          false,
        );
        CapturedReflectSetV1(
          firstEnvelope,
          "payload",
          firstPayload,
          firstEnvelope,
        );
        return CapturedReflectOwnKeysV1(target);
      },
    });
    if (
      !locatorRejectedV1(
        "universe-locator-sequential-pollution",
        firstEnvelope,
      ) ||
      firstTrapCalls === 0
    ) {
      throw new ProviderReleaseTargetUniversePointFixtureError(
        "sequential locator pollution A did not reject after reflection",
      );
    }

    const accessorPayload = accessorEnvelope.payload;
    defineAccessorPropertyV1(
      accessorEnvelope,
      "payload",
      () => {
        accessorGetterCalls += 1;
        return accessorPayload;
      },
      undefined,
      true,
    );
    if (
      !locatorRejectedV1(
        "universe-locator-sequential-pollution",
        accessorEnvelope,
      ) ||
      accessorGetterCalls !== 0
    ) {
      throw new ProviderReleaseTargetUniversePointFixtureError(
        "sequential locator pollution B1 leaked an accessor",
      );
    }

    finalEnvelope.payload = new CapturedProxyV1(finalPayload, {
      ownKeys(target) {
        finalTrapCalls += 1;
        CapturedReflectSetV1(
          finalEnvelope,
          "payload",
          finalPayload,
          finalEnvelope,
        );
        return CapturedReflectOwnKeysV1(target);
      },
    });
    if (
      !locatorRejectedV1(
        "universe-locator-sequential-pollution",
        finalEnvelope,
      ) ||
      finalTrapCalls === 0 ||
      finalEnvelope.payload !== finalPayload
    ) {
      throw new ProviderReleaseTargetUniversePointFixtureError(
        "sequential locator pollution B2 lost the sealed Proxy witness",
      );
    }
  } finally {
    if (!cleaned) {
      cleaned = true;
      restorePropertiesV1(saved);
    }
  }
}

function executeLocatorBoundaryV1(
  goldenManifest: ProviderReleaseTargetUniversePointGoldenManifestV1,
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
  recipe: LocatorBuilderRecipeV1,
): boolean {
  const materialized = materializeLocatorInputV1(
    goldenManifest,
    invalidCase,
    recipe,
  );
  if (invalidCase.caseId === "universe-locator-sequential-pollution") {
    executeSequentialLocatorPollutionV1(materialized);
    return true;
  }

  let input = materialized;
  let getterCalls = 0;
  let trapCalls = 0;
  const saved: SavedPropertyV1[] = [];
  let cleaned = false;
  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    restorePropertiesV1(saved);
  };
  try {
    if (invalidCase.caseId === "universe-locator-ordinary-accessor") {
      const envelope = input as Record<PropertyKey, unknown>;
      const payload = envelope.payload;
      defineAccessorPropertyV1(
        envelope,
        "payload",
        () => {
          getterCalls += 1;
          return payload;
        },
        undefined,
        true,
      );
    } else if (invalidCase.caseId === "universe-locator-top-level-proxy") {
      input = new CapturedProxyV1(input as object, {
        ownKeys(target) {
          trapCalls += 1;
          return CapturedReflectOwnKeysV1(target);
        },
      });
    } else if (invalidCase.caseId === "universe-locator-nested-proxy") {
      const envelope = input as Record<PropertyKey, unknown>;
      const payload = envelope.payload as object;
      envelope.payload = new CapturedProxyV1(payload, {
        ownKeys(target) {
          trapCalls += 1;
          return CapturedReflectOwnKeysV1(target);
        },
      });
    } else if (
      invalidCase.caseId === "universe-locator-self-removing-proxy"
    ) {
      const envelope = input as Record<PropertyKey, unknown>;
      const payload = envelope.payload as object;
      envelope.payload = new CapturedProxyV1(payload, {
        ownKeys(target) {
          trapCalls += 1;
          CapturedReflectSetV1(envelope, "payload", payload, envelope);
          return CapturedReflectOwnKeysV1(target);
        },
      });
    } else if (invalidCase.caseId === "universe-locator-get-only-proxy") {
      input = new CapturedProxyV1(input as object, {
        get(target, key, receiver) {
          getterCalls += 1;
          return CapturedReflectGetV1(target, key, receiver);
        },
      });
    } else if (
      invalidCase.caseId ===
      "universe-locator-structured-clone-replacement"
    ) {
      const envelope = input as Record<PropertyKey, unknown>;
      const payload = envelope.payload as object;
      arrayPushV1(saved, savePropertyV1(globalThis, "structuredClone"));
      envelope.payload = new CapturedProxyV1(payload, {
        ownKeys(target) {
          trapCalls += 1;
          defineDataPropertyV1(
            globalThis,
            "structuredClone",
            () => {
              getterCalls += 1;
              return CapturedObjectFreezeV1({ forgedClone: true });
            },
            false,
          );
          CapturedReflectSetV1(envelope, "payload", payload, envelope);
          return CapturedReflectOwnKeysV1(target);
        },
      });
    } else if (
      invalidCase.caseId === "universe-locator-array-push-pollution"
    ) {
      const envelope = input as Record<PropertyKey, unknown>;
      const payload = envelope.payload as object;
      arrayPushV1(
        saved,
        savePropertyV1(CapturedArrayPrototypeV1, "push"),
      );
      envelope.payload = new CapturedProxyV1(payload, {
        ownKeys(target) {
          trapCalls += 1;
          defineDataPropertyV1(
            CapturedArrayPrototypeV1,
            "push",
            () => {
              getterCalls += 1;
              return 0;
            },
            false,
          );
          CapturedReflectSetV1(envelope, "payload", payload, envelope);
          return CapturedReflectOwnKeysV1(target);
        },
      });
    } else if (
      invalidCase.caseId === "universe-locator-inherited-index-setter"
    ) {
      const envelope = input as Record<PropertyKey, unknown>;
      const payload = envelope.payload as object;
      arrayPushV1(
        saved,
        savePropertyV1(CapturedArrayPrototypeV1, "0"),
      );
      envelope.payload = new CapturedProxyV1(payload, {
        ownKeys(target) {
          trapCalls += 1;
          defineAccessorPropertyV1(
            CapturedArrayPrototypeV1,
            "0",
            undefined,
            () => {
              getterCalls += 1;
            },
            false,
          );
          CapturedReflectSetV1(envelope, "payload", payload, envelope);
          return CapturedReflectOwnKeysV1(target);
        },
      });
    }
    const rejected = locatorRejectedV1(invalidCase.caseId, input);
    const compoundCase =
      invalidCase.caseId ===
        "universe-locator-structured-clone-replacement" ||
      invalidCase.caseId === "universe-locator-array-push-pollution" ||
      invalidCase.caseId === "universe-locator-inherited-index-setter";
    if (
      !rejected ||
      (invalidCase.caseId === "universe-locator-ordinary-accessor" &&
        getterCalls !== 0) ||
      (invalidCase.caseId === "universe-locator-get-only-proxy" &&
        getterCalls !== 0) ||
      (compoundCase && trapCalls === 0)
    ) {
      throw new ProviderReleaseTargetUniversePointFixtureError(
        `${invalidCase.caseId} locator execution invariant failed`,
      );
    }
    return true;
  } finally {
    cleanup();
  }
}

function assertPreparedInputDidNotLeakV1(
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
  prepared: PreparedInvalidInputV1,
): void {
  if (prepared.getterCalls() !== 0) {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      `${invalidCase.caseId} executed an attacker-owned getter or poison`,
    );
  }
  if (
    invalidCase.caseId === "point-input-fake-capability-proxy" &&
    prepared.trapCalls() !== 0
  ) {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      "fake capability identity check reflected into its Proxy",
    );
  }
  if (
    (invalidCase.caseId ===
      "point-security-universe-self-removing-proxy" ||
      invalidCase.caseId === "point-security-object-prototype-then" ||
      invalidCase.caseId === "point-security-promise-primordials") &&
    prepared.trapCalls() === 0
  ) {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      `${invalidCase.caseId} did not exercise its self-removing Proxy`,
    );
  }
}

function settlePreparedInputV1<T>(
  pending: Promise<T>,
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
  prepared: PreparedInvalidInputV1,
): Promise<T> {
  return pending.then(
    (value) => {
      prepared.cleanup();
      assertPreparedInputDidNotLeakV1(invalidCase, prepared);
      return value;
    },
    (error) => {
      prepared.cleanup();
      assertPreparedInputDidNotLeakV1(invalidCase, prepared);
      throw error;
    },
  );
}

function assertExactDiagnosticResultV1(
  diagnostic: unknown,
): asserts diagnostic is ProviderReleaseTargetUniversePointClosureDiagnosticResultV1 {
  if (
    diagnostic === null ||
    typeof diagnostic !== "object" ||
    CapturedObjectGetPrototypeOfV1(diagnostic) !== null ||
    !CapturedObjectIsFrozenV1(diagnostic)
  ) {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      "point diagnostic did not return a frozen null-prototype record",
    );
  }
  const candidate = diagnostic as Record<PropertyKey, unknown>;
  const keys = CapturedReflectOwnKeysV1(candidate);
  const ok = candidate.ok;
  const expectedKeys = ok === true
    ? ["ok", "value"]
    : ["ok", "stage", "reason"];
  if (keys.length !== expectedKeys.length) {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      "point diagnostic returned an unexpected field count",
    );
  }
  for (let index = 0; index < expectedKeys.length; index += 1) {
    if (keys[index] !== expectedKeys[index]) {
      throw new ProviderReleaseTargetUniversePointFixtureError(
        "point diagnostic field order or shape drifted",
      );
    }
  }
}

function publicFailureProjectionV1(error: unknown): PublicFailureProjectionV1 {
  if (
    !(error instanceof ProviderReleaseTargetUniversePointClosureValidationError) ||
    !CapturedObjectIsFrozenV1(error)
  ) {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      "public validator did not return the frozen opaque error",
    );
  }
  const ownKeys = CapturedReflectOwnKeysV1(error);
  let enumerableCount = 0;
  let hasName = false;
  let hasCode = false;
  let hasReason = false;
  for (let index = 0; index < ownKeys.length; index += 1) {
    const key = ownKeys[index]!;
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(error, key)!;
    if (descriptor.enumerable === true) {
      enumerableCount += 1;
      if (key === "name") hasName = true;
      else if (key === "code") hasCode = true;
      else if (key === "reason") hasReason = true;
      else {
        throw new ProviderReleaseTargetUniversePointFixtureError(
          "public validation error leaked an enumerable field",
        );
      }
    } else if (
      typeof key !== "string" ||
      (key !== "stack" && key !== "message")
    ) {
      throw new ProviderReleaseTargetUniversePointFixtureError(
        "public validation error leaked a hidden field",
      );
    }
  }
  if (
    enumerableCount !== 3 ||
    !hasName ||
    !hasCode ||
    !hasReason ||
    error.message !==
      "Provider release target Universe point closure validation failed"
  ) {
    throw new ProviderReleaseTargetUniversePointFixtureError(
      "public validation error shape drifted",
    );
  }
  return createProviderNonThenableFrozenRecordV1({
    errorName: error.name,
    code: error.code,
    reason: error.reason,
  });
}

function executeFreshDiagnosticV1(
  goldenManifest: ProviderReleaseTargetUniversePointGoldenManifestV1,
  invalidManifest: ProviderReleaseTargetUniversePointInvalidManifestV1,
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<ProviderReleaseTargetUniversePointClosureDiagnosticResultV1> {
  let prepared: PreparedInvalidInputV1;
  try {
    prepared = prepareInvalidInputV1(
      goldenManifest,
      invalidManifest,
      invalidCase,
      strictCryptoCapability,
    );
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }
  let pending: Promise<ProviderReleaseTargetUniversePointClosureDiagnosticResultV1>;
  try {
    pending = diagnoseProviderReleaseTargetUniversePointClosureV1(
      prepared.input,
    );
  } catch (error) {
    prepared.cleanup();
    return createProviderPointRejectedPromiseV1(error);
  }
  return settlePreparedInputV1(pending, invalidCase, prepared).then(
    (diagnostic) => {
      assertExactDiagnosticResultV1(diagnostic);
      return diagnostic;
    },
  );
}

type PublicExecutionV1 =
  | Readonly<{
      accepted: true;
      value: ProviderReleaseTargetUniversePointClosureValidationV1;
    }>
  | Readonly<{
      accepted: false;
      publicFailure: PublicFailureProjectionV1;
    }>;

function executeFreshPublicValidationV1(
  goldenManifest: ProviderReleaseTargetUniversePointGoldenManifestV1,
  invalidManifest: ProviderReleaseTargetUniversePointInvalidManifestV1,
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<PublicExecutionV1> {
  let prepared: PreparedInvalidInputV1;
  try {
    prepared = prepareInvalidInputV1(
      goldenManifest,
      invalidManifest,
      invalidCase,
      strictCryptoCapability,
    );
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }
  let pending: Promise<ProviderReleaseTargetUniversePointClosureValidationV1>;
  try {
    pending = validateProviderReleaseTargetUniversePointClosureV1(
      prepared.input as ValidateProviderReleaseTargetUniversePointClosureV1Input,
    );
  } catch (error) {
    prepared.cleanup();
    return createProviderPointRejectedPromiseV1(error);
  }
  if (invalidCase.caseId === "point-security-promise-primordials") {
    return pending
      .then((value) =>
        createProviderNonThenableFrozenRecordV1({
          accepted: true as const,
          value,
        }),
      )
      .catch((error) =>
        createProviderNonThenableFrozenRecordV1({
          accepted: false as const,
          publicFailure: publicFailureProjectionV1(error),
        }),
      )
      .finally(() => {
        prepared.cleanup();
        assertPreparedInputDidNotLeakV1(invalidCase, prepared);
      });
  }
  return settlePreparedInputV1(pending, invalidCase, prepared).then(
    (value) =>
      createProviderNonThenableFrozenRecordV1({
        accepted: true as const,
        value,
      }),
    (error) =>
      createProviderNonThenableFrozenRecordV1({
        accepted: false as const,
        publicFailure: publicFailureProjectionV1(error),
      }),
  );
}

function mutateAsyncRequestV1(
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
  request: ValidateProviderReleaseTargetUniversePointClosureV1Input,
): void {
  if (stringStartsWithV1(invalidCase.caseId, "discovery-")) {
    const result = request.targetDiscoveryResult as unknown as Record<
      string,
      unknown
    >;
    const payload = result.payload as Record<string, unknown>;
    const targets = payload.targets as Array<Record<string, unknown>>;
    const target = targets[0]!.target as Record<string, unknown>;
    target.osBuildDigest = `sha256:${stringRepeatV1("f", 64)}`;
    return;
  }
  const envelope = request.releaseTargetUniverse as unknown as Record<
    string,
    unknown
  >;
  const payload = envelope.payload as Record<string, unknown>;
  const targets = payload.targets as Array<Record<string, unknown>>;
  const target = targets[0]!.target as Record<string, unknown>;
  target.osBuildDigest = `sha256:${stringRepeatV1("f", 64)}`;
}

function executeAsyncMutationV1(
  goldenManifest: ProviderReleaseTargetUniversePointGoldenManifestV1,
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
  recipe: z.infer<typeof AsyncMutationRecipeV1Schema>,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
  counter: CapturedExecutionCounterV1,
  countStart: ExecutionCountStartV1,
): Promise<ProviderReleaseTargetUniversePointInvalidCaseExecutionV1> {
  const request = requestWithCapabilityV1(
    baseRequestForInvalidCaseV1(goldenManifest, invalidCase),
    strictCryptoCapability,
  );
  const mutation = (): void => mutateAsyncRequestV1(invalidCase, request);
  if (recipe.profile === "crypto_host") {
    counter.mutateDuringNextSignature(mutation);
  }
  let pending: Promise<ProviderReleaseTargetUniversePointClosureValidationV1>;
  try {
    pending = validateProviderReleaseTargetUniversePointClosureV1(request);
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }
  if (recipe.profile === "after_start") mutation();
  return pending.then((closure) => {
    assertRecursivelyFrozenFixtureV1(closure);
    const counts = executionCountDeltaV1(counter, countStart);
    if (
      counts.pointAdmissionCount !== 1 ||
      counts.signatureVerificationCount !== 7
    ) {
      throw new ProviderReleaseTargetUniversePointFixtureError(
        `${invalidCase.caseId} snapshot crypto count drifted`,
      );
    }
    const projection = snapshotProjectionV1(closure);
    if (CapturedReflectOwnKeysV1(projection).length !== 13) {
      throw new ProviderReleaseTargetUniversePointFixtureError(
        `${invalidCase.caseId} snapshot projection is not exact`,
      );
    }
    return createProviderNonThenableFrozenRecordV1({
      kind: "snapshot_acceptance" as const,
      boundary: "snapshot_stability" as const,
      authority: closure.authority,
      snapshotProjection: projection,
      pointAdmissionCount: counts.pointAdmissionCount,
      signatureVerificationCount: counts.signatureVerificationCount,
    });
  });
}

export function executeProviderReleaseTargetUniversePointInvalidCaseV1(
  goldenManifest: ProviderReleaseTargetUniversePointGoldenManifestV1,
  invalidManifest: ProviderReleaseTargetUniversePointInvalidManifestV1,
  invalidCase: ProviderReleaseTargetUniversePointInvalidCaseV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
  executionCounter: ProviderReleaseTargetUniversePointExecutionCounterV1,
): Promise<ProviderReleaseTargetUniversePointInvalidCaseExecutionV1> {
  let counter: CapturedExecutionCounterV1;
  let countStart: ExecutionCountStartV1;
  let recipe: ProviderReleaseTargetUniversePointReplayRecipeV1;
  try {
    counter = captureExecutionCounterV1(executionCounter);
    countStart = readExecutionCountStartV1(counter);
    recipe = effectiveReplayRecipeV1(invalidManifest, invalidCase);
    if (recipe.kind === "locator_builder") {
      const rejected = executeLocatorBoundaryV1(
        goldenManifest,
        invalidCase,
        recipe,
      );
      const counts = executionCountDeltaV1(counter, countStart);
      if (
        counts.pointAdmissionCount !== 0 ||
        counts.signatureVerificationCount !== 0
      ) {
        throw new ProviderReleaseTargetUniversePointFixtureError(
          `${invalidCase.caseId} locator unexpectedly used crypto`,
        );
      }
      if (!rejected) {
        return createProviderPointFulfilledPromiseV1(
          createProviderNonThenableFrozenRecordV1({
            kind: "unexpected_acceptance" as const,
            pointAdmissionCount: counts.pointAdmissionCount,
            signatureVerificationCount: counts.signatureVerificationCount,
          }),
        );
      }
      return createProviderPointFulfilledPromiseV1(
        createProviderNonThenableFrozenRecordV1({
          kind: "rejection" as const,
          boundary: "locator_builder" as const,
          stage: stringStartsWithV1(invalidCase.caseId, "discovery-")
            ? ("target_discovery_locator" as const)
            : ("universe_locator" as const),
          reason: "envelope_mismatch" as const,
          pointAdmissionCount: 0 as const,
          signatureVerificationCount: 0 as const,
        }),
      );
    }
    if (recipe.kind === "async_mutation") {
      return executeAsyncMutationV1(
        goldenManifest,
        invalidCase,
        recipe,
        strictCryptoCapability,
        counter,
        countStart,
      );
    }
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }

  return executeFreshDiagnosticV1(
    goldenManifest,
    invalidManifest,
    invalidCase,
    strictCryptoCapability,
  ).then((diagnostic) =>
    executeFreshPublicValidationV1(
      goldenManifest,
      invalidManifest,
      invalidCase,
      strictCryptoCapability,
    ).then((publicExecution) => {
      const counts = executionCountDeltaV1(counter, countStart);
      if (diagnostic.ok || publicExecution.accepted) {
        return createProviderNonThenableFrozenRecordV1({
          kind: "unexpected_acceptance" as const,
          pointAdmissionCount: counts.pointAdmissionCount,
          signatureVerificationCount: counts.signatureVerificationCount,
        });
      }
      return createProviderNonThenableFrozenRecordV1({
        kind: "rejection" as const,
        boundary: "internal_diagnostic" as const,
        stage: diagnostic.stage,
        reason: diagnostic.reason,
        publicFailure: publicExecution.publicFailure,
        pointAdmissionCount: counts.pointAdmissionCount,
        signatureVerificationCount: counts.signatureVerificationCount,
      });
    }),
  );
}

CapturedObjectFreezeV1(
  materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1,
);
CapturedObjectFreezeV1(
  executeProviderReleaseTargetUniversePointInvalidCaseV1,
);
CapturedObjectFreezeV1(
  verifyProviderReleaseTargetUniversePointGoldenResourceV1,
);
CapturedObjectFreezeV1(
  verifyProviderReleaseTargetUniversePointPositiveVectorV1,
);
CapturedObjectFreezeV1(
  verifyProviderReleaseTargetUniversePointPositiveVectorsV1,
);
CapturedObjectFreezeV1(
  verifyProviderReleaseTargetUniversePointInvalidResourceV1,
);
