import { z } from "zod";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import { ContentDigestV1Schema } from "./primitives.js";
import {
  ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  ProviderRealFilesystemConformanceResultLocatorV1Schema,
  ProviderRealFilesystemConformanceResultPinV1Schema,
} from "./provider-real-filesystem-conformance-result.js";
import {
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_CASE_IDS_V1,
  ProviderRealFilesystemConformanceResultGoldenManifestV1Schema,
  materializeProviderRealFilesystemConformanceResultInvalidRequestWitnessV1,
  type ProviderRealFilesystemConformanceResultGoldenManifestV1,
  type ProviderRealFilesystemConformanceResultInvalidCaseIdV1,
} from "./provider-real-filesystem-conformance-result-fixtures.js";
import {
  StoreDurableObjectProviderRuntimeAttestationPinV1Schema,
  StoreDurableObjectProviderRuntimeAttestationV1Schema,
  createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1,
  deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1,
} from "./provider-registry-records.js";
import {
  ProviderRuntimeAttestationPointClosureValidationError,
  ProviderRuntimeAttestationPointInvalidReasonV1Schema,
  ProviderRuntimeAttestationPointInvalidStageV1Schema,
  StoreDurableObjectProviderPolicyV1Schema,
  deriveStoreDurableObjectProviderPolicyDigestV1,
  deriveStoreProviderFilesystemProfileDigestV1,
  diagnoseProviderRuntimeAttestationPointClosureV1,
  validateProviderRuntimeAttestationPointClosureV1,
  type ProviderRuntimeAttestationPointClosureValidationV1,
  type StoreDurableObjectProviderPolicyV1,
  type ValidateProviderRuntimeAttestationPointClosureV1Input,
} from "./provider-runtime-attestation-point.js";
import { sha256InternalV1 } from "./sha256.js";
import type { ProviderStrictEd25519OpaqueCapabilityV1 } from "./strict-ed25519-conformance.js";

export const PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_PROFILE_V1 =
  "provider_runtime_attestation_point_golden_v1" as const;
export const PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_PROFILE_V1 =
  "provider_runtime_attestation_point_invalid_v1" as const;
export const PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_SEMANTIC_DOMAIN_V1 =
  "provider-runtime-attestation-point-golden-manifest-v1" as const;
export const PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_SEMANTIC_DOMAIN_V1 =
  "provider-runtime-attestation-point-invalid-manifest-v1" as const;
export const PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1 =
  "provider-runtime-attestation-point-invalid-materialized-request-v1" as const;
export const PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RECIPE_DIALECT_V1 =
  "provider_runtime_attestation_point_invalid_recipe_v1" as const;
export const PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_PATH_V1 =
  "fixtures/v1/golden/provider-runtime-attestation-point-v1.json" as const;
export const PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_PATH_V1 =
  "fixtures/v1/invalid/provider-runtime-attestation-point-v1.json" as const;

// Regenerated anchors are intentionally literal and verified before parsing.
export const PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1 =
  117_782 as const;
export const PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1 =
  "cc1aa6bd32d88c5d45056c3ef3b2ba862ce263935fb6870e052acc34353c48ce" as const;
export const PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:bb06778970ae77a562f078c09560de7ecf6613dfaa9c14657d44056da3a0ecb2" as const;
export const PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1 =
  256_796 as const;
export const PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_SHA256_HEX_V1 =
  "33be13b249c208a3f6bf1de0a65cebfa0e122f870dc7df5d4eed200762fb58bb" as const;
export const PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:ecc2cff8ec3a6481143087e24313ce111fe0f5434788fbcf09ba79bdb5a341a3" as const;
export const PROVIDER_RUNTIME_ATTESTATION_POINT_FIXTURE_MAX_BYTES_V1 =
  16_777_216 as const;

const POINT_CASE_IDS_V1 = [
  "policy-profile-invalid",
  "policy-protocol-version-invalid",
  "policy-isolation-kind-invalid",
  "policy-source-namespace-visibility-invalid",
  "policy-staging-kinds-order-invalid",
  "policy-staging-kinds-extra-invalid",
  "policy-staging-recovery-invalid",
  "policy-durable-identity-invalid",
  "policy-publish-semantics-invalid",
  "policy-external-intent-semantics-invalid",
  "policy-handoff-journal-semantics-invalid",
  "ledger-profile-invalid",
  "ledger-locator-profile-invalid",
  "ledger-storage-boundary-invalid",
  "ledger-append-semantics-invalid",
  "ledger-max-receipt-count-invalid",
  "ledger-max-logical-bytes-invalid",
  "ledger-max-single-bytes-invalid",
  "ledger-admission-invalid",
  "ledger-quota-accounting-invalid",
  "policy-delete-semantics-invalid",
  "policy-stock-fallback-invalid",
  "policy-extra-field",
  "policy-digest-mismatch",
  "policy-provider-binding-mismatch",
  "policy-suite-binding-mismatch",
  "precedence-policy-digest-before-runtime-structure",
  "precedence-result-policy-binding-before-runtime-pin",
  "runtime-pin-profile-invalid",
  "runtime-pin-content-digest-missing",
  "runtime-pin-extra-field",
  "runtime-payload-profile-invalid",
  "runtime-payload-required-field-missing",
  "runtime-payload-extra-field",
  "runtime-generation-zero",
  "runtime-generation-fractional",
  "runtime-generation-unsafe",
  "runtime-issued-at-noncanonical",
  "runtime-issued-at-invalid-date",
  "runtime-os-platform-invalid",
  "runtime-architecture-invalid",
  "runtime-ipc-endpoint-digest-invalid",
  "runtime-signature-format-invalid",
  "runtime-pin-content-digest-mismatch",
  "runtime-provider-binding-mismatch",
  "runtime-policy-binding-mismatch",
  "runtime-implementation-binding-mismatch",
  "runtime-binary-binding-mismatch",
  "runtime-os-platform-binding-mismatch",
  "runtime-os-family-binding-mismatch",
  "runtime-os-build-binding-mismatch",
  "runtime-architecture-binding-mismatch",
  "runtime-filesystem-profile-binding-mismatch",
  "runtime-result-digest-binding-mismatch",
  "runtime-signature-bitflip",
  "runtime-signature-wrong-signer",
  "runtime-signature-wrong-domain",
  "runtime-root-mismatch",
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
  "point-security-async-mutation",
] as const;

type InnerRuntimeAttestationPointInvalidCaseIdV1 =
  `inner-${ProviderRealFilesystemConformanceResultInvalidCaseIdV1}`;
type PointRuntimeAttestationPointInvalidCaseIdV1 =
  (typeof POINT_CASE_IDS_V1)[number];
export type ProviderRuntimeAttestationPointInvalidCaseIdV1 =
  | InnerRuntimeAttestationPointInvalidCaseIdV1
  | PointRuntimeAttestationPointInvalidCaseIdV1;

const INNER_CASE_IDS_V1: readonly InnerRuntimeAttestationPointInvalidCaseIdV1[] =
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_CASE_IDS_V1.map(
    (caseId): InnerRuntimeAttestationPointInvalidCaseIdV1 => `inner-${caseId}`,
  );
const INVALID_CASE_IDS_V1: readonly ProviderRuntimeAttestationPointInvalidCaseIdV1[] = [
  ...INNER_CASE_IDS_V1,
  ...POINT_CASE_IDS_V1,
] as const;
export const PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_CASE_IDS_V1: readonly ProviderRuntimeAttestationPointInvalidCaseIdV1[] =
  Object.freeze([...INVALID_CASE_IDS_V1]);

const InnerSourceOperationV1Schema = z.enum(
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_CASE_IDS_V1,
);
const InvalidCaseIdV1Schema = z.enum(
  INVALID_CASE_IDS_V1 as unknown as [
    ProviderRuntimeAttestationPointInvalidCaseIdV1,
    ...ProviderRuntimeAttestationPointInvalidCaseIdV1[],
  ],
);
const NonnegativeSafeIntegerV1Schema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const EvenLowerHexV1Schema = z.string().regex(/^(?:[0-9a-f]{2})+$/u);
const ResourceSha256HexV1Schema = z.string().regex(/^[0-9a-f]{64}$/u);

const InnerRecipeV1Schema = z.strictObject({
  kind: z.literal("inner_conformance_result"),
  sourceOperation: InnerSourceOperationV1Schema,
});
const ReplacementRecipeV1Schema = z.strictObject({
  kind: z.literal("replace_artifacts"),
  semanticProviderPolicy: z.string().min(1).optional(),
  runtimeAttestation: z.string().min(1).optional(),
  realFilesystemConformanceResult: z.string().min(1).optional(),
  realFilesystemConformanceResultLocator: z.string().min(1).optional(),
  realFilesystemConformanceResultPin: z.string().min(1).optional(),
});
const HostileRecipeProfileV1Schema = z.enum([
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
  "async_mutation",
  "runtime_generation_fractional",
  "runtime_generation_unsafe",
]);
const HostileRecipeV1Schema = z.strictObject({
  kind: z.literal("hostile_input"),
  profile: HostileRecipeProfileV1Schema,
});
const InvalidRecipeV1Schema = z.discriminatedUnion("kind", [
  InnerRecipeV1Schema,
  ReplacementRecipeV1Schema,
  HostileRecipeV1Schema,
]);

const InvalidMutationV1Schema = z.strictObject({
  dialect: z.literal(PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RECIPE_DIALECT_V1),
  goldenResourcePath: z.literal(PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_PATH_V1),
  operation: InvalidCaseIdV1Schema,
  recipe: InvalidRecipeV1Schema,
});

const MaterializedDigestShapeV1 = {
  materializedRequestSemanticDigest: ContentDigestV1Schema,
} as const;
const SnapshotProjectionV1Schema = z.strictObject({
  runtimeAttestationContentDigest: ContentDigestV1Schema,
  runtimeAttestationGeneration:
    StoreDurableObjectProviderRuntimeAttestationV1Schema.shape.attestationGeneration,
  runtimeIssuedAt:
    StoreDurableObjectProviderRuntimeAttestationV1Schema.shape.issuedAt,
  runtimeIpcEndpointAttestationDigest: ContentDigestV1Schema,
  semanticProviderPolicyDigest: ContentDigestV1Schema,
  filesystemProfileDigest: ContentDigestV1Schema,
  realFilesystemConformanceResultContentDigest: ContentDigestV1Schema,
  conformanceCaseResultCount: NonnegativeSafeIntegerV1Schema,
  conformancePassedCaseResultCount: NonnegativeSafeIntegerV1Schema,
  conformanceFailedCaseResultCount: NonnegativeSafeIntegerV1Schema,
  conformanceUnsupportedCaseResultCount: NonnegativeSafeIntegerV1Schema,
});
const InternalDiagnosticExpectedV1Schema = z.strictObject({
  boundary: z.literal("internal_diagnostic"),
  stage: ProviderRuntimeAttestationPointInvalidStageV1Schema,
  reason: ProviderRuntimeAttestationPointInvalidReasonV1Schema,
  publicFailureReason: z.literal("attestation_invalid"),
  publicFailure: z.strictObject({
    errorName: z.literal("ProviderRuntimeAttestationPointClosureValidationError"),
    code: z.literal("provider_unavailable"),
    reason: z.literal("attestation_invalid"),
  }),
  pointAdmissionCount: NonnegativeSafeIntegerV1Schema,
  signatureVerificationCount: NonnegativeSafeIntegerV1Schema,
  ...MaterializedDigestShapeV1,
});
const SnapshotStabilityExpectedV1Schema = z.strictObject({
  boundary: z.literal("snapshot_stability"),
  outcome: z.literal("accepted_frozen_snapshot"),
  authority: z.literal("none_provider_runtime_attestation_structure_only"),
  snapshotProjection: SnapshotProjectionV1Schema,
  pointAdmissionCount: z.literal(1),
  signatureVerificationCount: z.literal(7),
  ...MaterializedDigestShapeV1,
});
const InvalidExpectedV1Schema = z.discriminatedUnion("boundary", [
  InternalDiagnosticExpectedV1Schema,
  SnapshotStabilityExpectedV1Schema,
]);

const InvalidCaseV1Schema = z
  .strictObject({
    caseId: InvalidCaseIdV1Schema,
    group: z.enum(["inner_conformance_result", "runtime_attestation_point"]),
    mutation: InvalidMutationV1Schema,
    expected: InvalidExpectedV1Schema,
  })
  .superRefine((value, context) => {
    if (value.mutation.operation !== value.caseId) {
      context.addIssue({
        code: "custom",
        path: ["mutation", "operation"],
        message: "mutation operation must equal its invalid case ID",
      });
    }
    const isInner = value.caseId.startsWith("inner-");
    if (
      (isInner && value.group !== "inner_conformance_result") ||
      (!isInner && value.group !== "runtime_attestation_point") ||
      (isInner && value.mutation.recipe.kind !== "inner_conformance_result") ||
      (!isInner && value.mutation.recipe.kind === "inner_conformance_result")
    ) {
      context.addIssue({
        code: "custom",
        path: ["group"],
        message: "case group and recipe must match the case ID namespace",
      });
    }
  });
type ParsedInvalidCaseV1 = z.infer<typeof InvalidCaseV1Schema>;

function orderedInvalidCaseSchemaV1(
  caseId: ProviderRuntimeAttestationPointInvalidCaseIdV1,
): z.ZodType<ParsedInvalidCaseV1> {
  const isInner = caseId.startsWith("inner-");
  const recipeSchema = isInner
    ? z.strictObject({
        kind: z.literal("inner_conformance_result"),
        sourceOperation: z.literal(
          caseId.slice(
            "inner-".length,
          ) as ProviderRealFilesystemConformanceResultInvalidCaseIdV1,
        ),
      })
    : z.discriminatedUnion("kind", [
        ReplacementRecipeV1Schema,
        HostileRecipeV1Schema,
      ]);
  return z.strictObject({
    caseId: z.literal(caseId),
    group: z.literal(
      isInner ? "inner_conformance_result" : "runtime_attestation_point",
    ),
    mutation: z.strictObject({
      dialect: z.literal(
        PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RECIPE_DIALECT_V1,
      ),
      goldenResourcePath: z.literal(
        PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_PATH_V1,
      ),
      operation: z.literal(caseId),
      recipe: recipeSchema,
    }),
    expected: InvalidExpectedV1Schema,
  }) as z.ZodType<ParsedInvalidCaseV1>;
}

const ORDERED_INVALID_CASE_ID_SCHEMAS_V1 = INVALID_CASE_IDS_V1.map((caseId) =>
  z.literal(caseId),
) as unknown as [
  z.ZodType<ProviderRuntimeAttestationPointInvalidCaseIdV1>,
  ...z.ZodType<ProviderRuntimeAttestationPointInvalidCaseIdV1>[],
];
const ORDERED_INVALID_CASE_SCHEMAS_V1 = INVALID_CASE_IDS_V1.map((caseId) =>
  orderedInvalidCaseSchemaV1(caseId),
) as unknown as [
  z.ZodType<ParsedInvalidCaseV1>,
  ...z.ZodType<ParsedInvalidCaseV1>[],
];

export const ProviderRuntimeAttestationPointGoldenManifestV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  profile: z.literal(PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_PROFILE_V1),
  fixtureAuthority: z.literal("none_provider_runtime_attestation_structure_only"),
  canonicalizationProfile: z.literal("rfc8785-jcs-safe-integer-v1"),
  verificationProfile: z.literal("ed25519-rfc8032-cofactorless-prime-subgroup-v1"),
  conformanceResultGolden: ProviderRealFilesystemConformanceResultGoldenManifestV1Schema,
  realFilesystemConformanceResult: ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  realFilesystemConformanceResultLocator: ProviderRealFilesystemConformanceResultLocatorV1Schema,
  realFilesystemConformanceResultPin: ProviderRealFilesystemConformanceResultPinV1Schema,
  semanticProviderPolicy: StoreDurableObjectProviderPolicyV1Schema,
  runtimeAttestation: StoreDurableObjectProviderRuntimeAttestationPinV1Schema,
  expected: z.strictObject({
    semanticProviderPolicyPreimageCanonicalUtf8Hex: EvenLowerHexV1Schema,
    filesystemProfilePreimageCanonicalUtf8Hex: EvenLowerHexV1Schema,
    runtimeSignatureMessageUtf8Hex: EvenLowerHexV1Schema,
    semanticProviderPolicyDigest: ContentDigestV1Schema,
    filesystemProfileDigest: ContentDigestV1Schema,
    runtimeAttestationContentDigest: ContentDigestV1Schema,
    realFilesystemConformanceResultContentDigest: ContentDigestV1Schema,
    activeRootPointAdmissionCount: z.literal(1),
    signatureVerificationCount: z.literal(7),
    runtimeSignatureCount: z.literal(1),
    conformanceResultSignatureCount: z.literal(0),
  }),
  semanticDomain: z.literal(PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_SEMANTIC_DOMAIN_V1),
  dependencies: z.strictObject({
    conformanceResultGoldenResourcePath: z.literal(
      PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_PATH_V1,
    ),
    conformanceResultGoldenResourceByteLength: z.literal(
      PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    ),
    conformanceResultGoldenResourceSha256Hex: z.literal(
      PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_SHA256_HEX_V1,
    ),
    conformanceResultGoldenSemanticContentDigest: z.literal(
      PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    ),
  }),
  semanticContentDigest: z.literal(
    PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  ),
});
export type ProviderRuntimeAttestationPointGoldenManifestV1 = z.infer<
  typeof ProviderRuntimeAttestationPointGoldenManifestV1Schema
>;

export const ProviderRuntimeAttestationPointInvalidManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_PROFILE_V1),
    fixtureAuthority: z.literal("none_rejection_only"),
    canonicalizationProfile: z.literal("rfc8785-jcs-safe-integer-v1"),
    verificationProfile: z.literal("ed25519-rfc8032-cofactorless-prime-subgroup-v1"),
    semanticDomain: z.literal(PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_SEMANTIC_DOMAIN_V1),
    materializedRequestSemanticDomain: z.literal(
      PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
    ),
    goldenDependency: z.strictObject({
      resourcePath: z.literal(PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_PATH_V1),
      resourceByteLength: z.literal(
        PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
      ),
      resourceSha256Hex: z.literal(
        PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
      ),
      semanticContentDigest: z.literal(
        PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
      ),
    }),
    mutationRecipeDialect: z.literal(
      PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RECIPE_DIALECT_V1,
    ),
    innerCaseCount: z.literal(INNER_CASE_IDS_V1.length),
    pointCaseCount: z.literal(POINT_CASE_IDS_V1.length),
    caseCount: z.literal(INVALID_CASE_IDS_V1.length),
    caseIds: z.tuple(ORDERED_INVALID_CASE_ID_SCHEMAS_V1),
    cases: z.tuple(ORDERED_INVALID_CASE_SCHEMAS_V1),
    semanticContentDigest: z.literal(
      PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
    ),
  });
export type ProviderRuntimeAttestationPointInvalidCaseV1 = ParsedInvalidCaseV1;
type ParsedInvalidManifestV1 = z.infer<
  typeof ProviderRuntimeAttestationPointInvalidManifestV1Schema
>;
export type ProviderRuntimeAttestationPointInvalidManifestV1 = Omit<
  ParsedInvalidManifestV1,
  "caseIds" | "cases"
> & {
  readonly caseIds: readonly ProviderRuntimeAttestationPointInvalidCaseIdV1[];
  readonly cases: readonly ProviderRuntimeAttestationPointInvalidCaseV1[];
};

function jsonCloneV1<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseCanonicalRecipeJsonV1(value: string): unknown {
  const parsed = JSON.parse(value) as unknown;
  const canonical = new TextDecoder().decode(
    canonicalizeJcsSafeIntegerUtf8V1(parsed),
  );
  if (canonical !== value) {
    throw new ProviderRuntimeAttestationPointFixtureError(
      "runtime point replacement recipe is not canonical JSON",
    );
  }
  return parsed;
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
  return `sha256:${rawSha256HexV1(canonicalizeJcsSafeIntegerUtf8V1([domain, value]))}`;
}

function parseJsonResourceV1(bytes: Uint8Array, label: string): unknown {
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes),
    );
  } catch {
    throw new ProviderRuntimeAttestationPointFixtureError(
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
    bytes.byteLength > PROVIDER_RUNTIME_ATTESTATION_POINT_FIXTURE_MAX_BYTES_V1 ||
    bytes.byteLength !== expectedBytes ||
    rawSha256HexV1(bytes) !== expectedSha256
  ) {
    throw new ProviderRuntimeAttestationPointFixtureError(
      `${label} bytes do not match the immutable anchor`,
    );
  }
}

export class ProviderRuntimeAttestationPointFixtureError extends TypeError {}

function requestFromGoldenV1(
  golden: ProviderRuntimeAttestationPointGoldenManifestV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): ValidateProviderRuntimeAttestationPointClosureV1Input {
  const source = golden.conformanceResultGolden;
  return {
    activeRoot: jsonCloneV1(source.activeRoot),
    activeRootMetadata: jsonCloneV1(source.activeRootMetadata),
    distributionRootBinding: jsonCloneV1(source.distributionRootBinding),
    fixtureCorpusManifest: jsonCloneV1(source.fixtureCorpusManifest),
    publicSupportTaxonomy: jsonCloneV1(source.publicSupportTaxonomy),
    realFilesystemConformanceResult: jsonCloneV1(
      golden.realFilesystemConformanceResult,
    ),
    realFilesystemConformanceResultLocator: jsonCloneV1(
      golden.realFilesystemConformanceResultLocator,
    ),
    realFilesystemConformanceResultPin: jsonCloneV1(
      golden.realFilesystemConformanceResultPin,
    ),
    releaseMatrix: jsonCloneV1(source.releaseMatrix),
    runtimeAttestation: jsonCloneV1(golden.runtimeAttestation),
    semanticProviderPolicy: jsonCloneV1(golden.semanticProviderPolicy),
    strictCryptoCapability,
    suiteManifest: jsonCloneV1(source.suiteManifest),
    targetDiscoveryFixtureManifest: jsonCloneV1(
      source.targetDiscoveryFixtureManifest,
    ),
    targetDiscoveryResult: jsonCloneV1(source.targetDiscoveryResult),
    targetDiscoveryRunnerRun: jsonCloneV1(source.targetDiscoveryRunnerRun),
  };
}

function conformanceGoldenForReplayV1(
  golden: ProviderRuntimeAttestationPointGoldenManifestV1,
): ProviderRealFilesystemConformanceResultGoldenManifestV1 {
  return {
    ...golden.conformanceResultGolden,
    realFilesystemConformanceResult: golden.realFilesystemConformanceResult,
    realFilesystemConformanceResultLocator:
      golden.realFilesystemConformanceResultLocator,
    realFilesystemConformanceResultPin: golden.realFilesystemConformanceResultPin,
  };
}

function withoutCapabilityV1(
  request: ValidateProviderRuntimeAttestationPointClosureV1Input,
): Record<string, unknown> {
  const { strictCryptoCapability: _strictCryptoCapability, ...jsonArtifacts } = request;
  return jsonArtifacts;
}

const INNER_EXECUTABLE_CASE_IDS_V1 = new Set<ProviderRealFilesystemConformanceResultInvalidCaseIdV1>([
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

type RuntimePointPreparedInputV1 = {
  readonly input: unknown;
  readonly getterCalls: () => number;
  readonly mutateAfterStart?: () => void;
};

function prepareHostileInputV1(
  request: ValidateProviderRuntimeAttestationPointClosureV1Input,
  profile: z.infer<typeof HostileRecipeProfileV1Schema>,
): RuntimePointPreparedInputV1 {
  const mutable = request as ValidateProviderRuntimeAttestationPointClosureV1Input &
    Record<PropertyKey, unknown>;
  let getterCalls = 0;
  switch (profile) {
    case "extra_field":
      mutable.unexpected = true;
      break;
    case "plain_validation_dto":
      return {
        input: {
          conformanceResultClosure: {
            authority: "none_real_fs_conformance_result_structure_only",
          },
          runtimeAttestation: request.runtimeAttestation,
        },
        getterCalls: () => getterCalls,
      };
    case "top_level_proxy":
      return {
        input: new Proxy(mutable, {}),
        getterCalls: () => getterCalls,
      };
    case "nested_proxy":
      mutable.runtimeAttestation.payload = new Proxy(
        mutable.runtimeAttestation.payload,
        {},
      );
      break;
    case "top_level_getter":
      Object.defineProperty(mutable, "unexpected", {
        enumerable: true,
        get() {
          getterCalls += 1;
          return true;
        },
      });
      break;
    case "nested_getter":
      Object.defineProperty(mutable.runtimeAttestation.payload, "unexpected", {
        enumerable: true,
        get() {
          getterCalls += 1;
          return true;
        },
      });
      break;
    case "top_level_hidden":
      Object.defineProperty(mutable, "hidden", { enumerable: false, value: true });
      break;
    case "nested_hidden":
      Object.defineProperty(mutable.runtimeAttestation.payload, "hidden", {
        enumerable: false,
        value: true,
      });
      break;
    case "top_level_symbol":
      Object.defineProperty(mutable, Symbol("hostile"), {
        enumerable: true,
        value: true,
      });
      break;
    case "nested_symbol":
      Object.defineProperty(mutable.runtimeAttestation.payload, Symbol("hostile"), {
        enumerable: true,
        value: true,
      });
      break;
    case "sparse_array":
      delete (mutable.semanticProviderPolicy.supportedStagingObjectKinds as unknown[])[0];
      break;
    case "cycle":
      (mutable.semanticProviderPolicy as unknown as Record<string, unknown>).cycle =
        mutable.semanticProviderPolicy;
      break;
    case "alias":
      mutable.semanticProviderPolicy.isolation =
        mutable.realFilesystemConformanceResult.payload.target as unknown as
          StoreDurableObjectProviderPolicyV1["isolation"];
      break;
    case "async_mutation":
      return {
        input: mutable,
        getterCalls: () => getterCalls,
        mutateAfterStart() {
          mutable.runtimeAttestation.payload.ipcEndpointAttestationDigest =
            `sha256:${"7".repeat(64)}` as typeof mutable.runtimeAttestation.payload.ipcEndpointAttestationDigest;
          mutable.runtimeAttestation.payload.attestationGeneration = 2;
          mutable.runtimeAttestation.payload.issuedAt =
            "2026-08-04T23:59:59Z" as typeof mutable.runtimeAttestation.payload.issuedAt;
        },
      };
    case "runtime_generation_unsafe":
      mutable.runtimeAttestation.payload.attestationGeneration =
        Number.MAX_SAFE_INTEGER + 1;
      break;
    case "runtime_generation_fractional":
      mutable.runtimeAttestation.payload.attestationGeneration = 1.5;
      break;
  }
  return { input: mutable, getterCalls: () => getterCalls };
}

function prepareInnerExecutableInputV1(
  request: ValidateProviderRuntimeAttestationPointClosureV1Input,
  operation: ProviderRealFilesystemConformanceResultInvalidCaseIdV1,
): RuntimePointPreparedInputV1 {
  const mutable = request as ValidateProviderRuntimeAttestationPointClosureV1Input &
    Record<PropertyKey, unknown>;
  let getterCalls = 0;
  switch (operation) {
    case "locator-envelope-substitution":
      (mutable as unknown as Record<string, unknown>).realFilesystemConformanceResultLocator =
        jsonCloneV1(mutable.realFilesystemConformanceResult);
      break;
    case "security-top-level-proxy":
      return { input: new Proxy(mutable, {}), getterCalls: () => getterCalls };
    case "security-nested-proxy":
      mutable.realFilesystemConformanceResult.payload = new Proxy(
        mutable.realFilesystemConformanceResult.payload,
        {},
      );
      break;
    case "security-top-level-getter":
      Object.defineProperty(mutable, "unexpected", {
        enumerable: true,
        get() {
          getterCalls += 1;
          return true;
        },
      });
      break;
    case "security-nested-getter":
      Object.defineProperty(
        mutable.realFilesystemConformanceResult.payload,
        "unexpected",
        {
          enumerable: true,
          get() {
            getterCalls += 1;
            return true;
          },
        },
      );
      break;
    case "security-nested-hidden":
      Object.defineProperty(
        mutable.realFilesystemConformanceResult.payload,
        "hidden",
        { enumerable: false, value: true },
      );
      break;
    case "security-nested-symbol":
      Object.defineProperty(
        mutable.realFilesystemConformanceResult.payload,
        Symbol("hostile"),
        { enumerable: true, value: true },
      );
      break;
    case "security-sparse-array":
      delete (
        mutable.realFilesystemConformanceResult.payload.caseResults as unknown[]
      )[0];
      break;
    case "security-cycle":
      mutable.cycle = mutable;
      break;
    case "security-alias":
      mutable.realFilesystemConformanceResult.payload.target =
        mutable.targetDiscoveryResult.payload.targets[0]!.target;
      break;
    case "security-async-mutation":
      return {
        input: mutable,
        getterCalls: () => getterCalls,
        mutateAfterStart() {
          mutable.realFilesystemConformanceResult.payload.result = "failed";
          const first =
            mutable.realFilesystemConformanceResult.payload.caseResults[0];
          if (first !== undefined) {
            first.outcome = "failed";
            first.resultCode = "assertion_failed";
          }
        },
      };
    default:
      throw new TypeError(`unknown executable inner case ${operation}`);
  }
  return { input: mutable, getterCalls: () => getterCalls };
}

function prepareInnerInputV1(
  golden: ProviderRuntimeAttestationPointGoldenManifestV1,
  operation: ProviderRealFilesystemConformanceResultInvalidCaseIdV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): RuntimePointPreparedInputV1 {
  const base = requestFromGoldenV1(golden, strictCryptoCapability);
  if (INNER_EXECUTABLE_CASE_IDS_V1.has(operation)) {
    return prepareInnerExecutableInputV1(base, operation);
  }
  const witness = materializeProviderRealFilesystemConformanceResultInvalidRequestWitnessV1(
    conformanceGoldenForReplayV1(golden),
    operation,
  ) as { readonly request?: Record<string, unknown> };
  if (witness.request === undefined) {
    throw new TypeError(`inner case ${operation} did not materialize a request`);
  }
  return {
    input: {
      ...jsonCloneV1(witness.request),
      runtimeAttestation: jsonCloneV1(golden.runtimeAttestation),
      semanticProviderPolicy: jsonCloneV1(golden.semanticProviderPolicy),
      strictCryptoCapability,
    },
    getterCalls: () => 0,
  };
}

function prepareReplacementInputV1(
  golden: ProviderRuntimeAttestationPointGoldenManifestV1,
  recipe: z.infer<typeof ReplacementRecipeV1Schema>,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): RuntimePointPreparedInputV1 {
  const request = requestFromGoldenV1(golden, strictCryptoCapability) as unknown as
    Record<string, unknown>;
  for (const key of [
    "semanticProviderPolicy",
    "runtimeAttestation",
    "realFilesystemConformanceResult",
    "realFilesystemConformanceResultLocator",
    "realFilesystemConformanceResultPin",
  ] as const) {
    const replacement = recipe[key];
    if (replacement !== undefined) {
      request[key] = parseCanonicalRecipeJsonV1(replacement);
    }
  }
  return { input: request, getterCalls: () => 0 };
}

function prepareInvalidInputV1(
  golden: ProviderRuntimeAttestationPointGoldenManifestV1,
  invalidCase: ProviderRuntimeAttestationPointInvalidCaseV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): RuntimePointPreparedInputV1 {
  const recipe = invalidCase.mutation.recipe;
  switch (recipe.kind) {
    case "inner_conformance_result":
      return prepareInnerInputV1(golden, recipe.sourceOperation, strictCryptoCapability);
    case "replace_artifacts":
      return prepareReplacementInputV1(golden, recipe, strictCryptoCapability);
    case "hostile_input":
      return prepareHostileInputV1(
        requestFromGoldenV1(golden, strictCryptoCapability),
        recipe.profile,
      );
  }
}

export function materializeProviderRuntimeAttestationPointInvalidRequestWitnessV1(
  golden: ProviderRuntimeAttestationPointGoldenManifestV1,
  invalidCase: ProviderRuntimeAttestationPointInvalidCaseV1,
): unknown {
  const recipe = invalidCase.mutation.recipe;
  if (
    recipe.kind === "hostile_input" ||
    (recipe.kind === "inner_conformance_result" &&
      INNER_EXECUTABLE_CASE_IDS_V1.has(recipe.sourceOperation))
  ) {
    return {
      caseId: invalidCase.caseId,
      executionProfile:
        recipe.kind === "hostile_input" ? recipe.profile : recipe.sourceOperation,
      goldenSemanticContentDigest: golden.semanticContentDigest,
    };
  }
  const placeholder = Object.freeze({ fixturePlaceholder: true }) as unknown as
    ProviderStrictEd25519OpaqueCapabilityV1;
  const prepared = prepareInvalidInputV1(golden, invalidCase, placeholder);
  return {
    caseId: invalidCase.caseId,
    request: withoutCapabilityV1(
      prepared.input as ValidateProviderRuntimeAttestationPointClosureV1Input,
    ),
  };
}

export type ProviderRuntimeAttestationPointInvalidCaseExecutionV1 =
  | Readonly<{ kind: "unexpected_acceptance" }>
  | Readonly<{
      kind: "rejection";
      boundary: "internal_diagnostic";
      stage: z.infer<typeof ProviderRuntimeAttestationPointInvalidStageV1Schema>;
      reason: z.infer<typeof ProviderRuntimeAttestationPointInvalidReasonV1Schema>;
      publicFailure: Readonly<{
        errorName: unknown;
        code: unknown;
        reason: unknown;
      }> | undefined;
    }>
  | Readonly<{
      kind: "snapshot_acceptance";
      boundary: "snapshot_stability";
      authority: "none_provider_runtime_attestation_structure_only";
      snapshotProjection: z.infer<typeof SnapshotProjectionV1Schema>;
    }>;

function snapshotProjectionV1(
  value: ProviderRuntimeAttestationPointClosureValidationV1,
): z.infer<typeof SnapshotProjectionV1Schema> {
  return Object.freeze({
    runtimeAttestationContentDigest: value.runtimeAttestation.contentDigest,
    runtimeAttestationGeneration:
      value.runtimeAttestation.payload.attestationGeneration,
    runtimeIssuedAt: value.runtimeAttestation.payload.issuedAt,
    runtimeIpcEndpointAttestationDigest:
      value.runtimeAttestation.payload.ipcEndpointAttestationDigest,
    semanticProviderPolicyDigest: value.semanticProviderPolicyDigest,
    filesystemProfileDigest: value.filesystemProfileDigest,
    realFilesystemConformanceResultContentDigest:
      value.conformanceResultClosure.result.contentDigest,
    conformanceCaseResultCount: value.conformanceResultClosure.caseResultCount,
    conformancePassedCaseResultCount:
      value.conformanceResultClosure.passedCaseResultCount,
    conformanceFailedCaseResultCount:
      value.conformanceResultClosure.failedCaseResultCount,
    conformanceUnsupportedCaseResultCount:
      value.conformanceResultClosure.unsupportedCaseResultCount,
  });
}

function publicFailureProjectionV1(error: unknown): {
  readonly errorName: unknown;
  readonly code: unknown;
  readonly reason: unknown;
} | undefined {
  if (error === null || typeof error !== "object") return undefined;
  const candidate = error as Record<string, unknown>;
  const enumerableKeys = Object.keys(candidate).sort();
  const unexpectedOwnNames = Object.getOwnPropertyNames(candidate).filter(
    (key) => !["stack", "message", "code", "name", "reason"].includes(key),
  );
  if (
    JSON.stringify(enumerableKeys) !== JSON.stringify(["code", "name", "reason"]) ||
    unexpectedOwnNames.length !== 0 ||
    Object.getOwnPropertySymbols(candidate).length !== 0 ||
    candidate.message !==
      "Provider runtime attestation point closure validation failed"
  ) {
    throw new Error("provider runtime attestation point public failure leaked fields");
  }
  return {
    errorName: candidate.name,
    code: candidate.code,
    reason: candidate.reason,
  };
}

export async function executeProviderRuntimeAttestationPointInvalidCaseV1(
  golden: ProviderRuntimeAttestationPointGoldenManifestV1,
  invalidCase: ProviderRuntimeAttestationPointInvalidCaseV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<ProviderRuntimeAttestationPointInvalidCaseExecutionV1> {
  const prepared = prepareInvalidInputV1(golden, invalidCase, strictCryptoCapability);
  if (prepared.mutateAfterStart !== undefined) {
    const pending = validateProviderRuntimeAttestationPointClosureV1(
      prepared.input as ValidateProviderRuntimeAttestationPointClosureV1Input,
    );
    prepared.mutateAfterStart();
    const value = await pending;
    return {
      kind: "snapshot_acceptance",
      boundary: "snapshot_stability",
      authority: value.authority,
      snapshotProjection: snapshotProjectionV1(value),
    };
  }
  const diagnostic = await diagnoseProviderRuntimeAttestationPointClosureV1(prepared.input);
  if (prepared.getterCalls() !== 0) {
    throw new Error(`${invalidCase.caseId} executed an attacker-owned getter`);
  }
  let publicFailure:
    | { readonly errorName: unknown; readonly code: unknown; readonly reason: unknown }
    | undefined;
  try {
    await validateProviderRuntimeAttestationPointClosureV1(
      prepared.input as ValidateProviderRuntimeAttestationPointClosureV1Input,
    );
  } catch (error) {
    publicFailure = publicFailureProjectionV1(error);
  }
  if (prepared.getterCalls() !== 0) {
    throw new Error(
      `${invalidCase.caseId} executed an attacker-owned getter during public validation`,
    );
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

export async function verifyProviderRuntimeAttestationPointGoldenResourceV1(
  bytes: Uint8Array,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<{
  readonly authority: "none_provider_runtime_attestation_structure_only";
  readonly manifest: ProviderRuntimeAttestationPointGoldenManifestV1;
  readonly pointClosure: ProviderRuntimeAttestationPointClosureValidationV1;
}> {
  verifyResourceAnchorV1(
    bytes,
    PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
    "provider runtime attestation point golden",
  );
  let manifest: ProviderRuntimeAttestationPointGoldenManifestV1;
  try {
    manifest = ProviderRuntimeAttestationPointGoldenManifestV1Schema.parse(
      parseJsonResourceV1(bytes, "provider runtime attestation point golden"),
    );
  } catch (error) {
    if (error instanceof ProviderRuntimeAttestationPointFixtureError) throw error;
    throw new ProviderRuntimeAttestationPointFixtureError(
      "provider runtime attestation point golden schema is invalid",
    );
  }
  const { semanticContentDigest: _semanticContentDigest, ...semanticFields } = manifest;
  if (
    semanticDigestV1(
      PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
      semanticFields,
    ) !== manifest.semanticContentDigest
  ) {
    throw new ProviderRuntimeAttestationPointFixtureError(
      "provider runtime attestation point golden semantic digest mismatch",
    );
  }
  const pointClosure = await validateProviderRuntimeAttestationPointClosureV1(
    requestFromGoldenV1(manifest, strictCryptoCapability),
  );
  const resultTarget = manifest.realFilesystemConformanceResult.payload.target;
  const filesystemFields = {
    filesystemProfileCode: resultTarget.filesystemProfileCode,
    filesystemFeatureProfileDigest: resultTarget.filesystemFeatureProfileDigest,
    mountOptionProfileDigest: resultTarget.mountOptionProfileDigest,
  };
  const policyDigest = deriveStoreDurableObjectProviderPolicyDigestV1(
    manifest.semanticProviderPolicy,
  );
  const filesystemDigest = deriveStoreProviderFilesystemProfileDigestV1(filesystemFields);
  const runtimeDigest = deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1(
    manifest.runtimeAttestation.payload,
  );
  const rootKeyId = manifest.conformanceResultGolden.activeRoot.rootKeyId;
  if (
    pointClosure.authority !== manifest.fixtureAuthority ||
    policyDigest !== manifest.expected.semanticProviderPolicyDigest ||
    filesystemDigest !== manifest.expected.filesystemProfileDigest ||
    runtimeDigest !== manifest.expected.runtimeAttestationContentDigest ||
    manifest.runtimeAttestation.contentDigest !== runtimeDigest ||
    manifest.realFilesystemConformanceResult.contentDigest !==
      manifest.expected.realFilesystemConformanceResultContentDigest ||
    bytesToLowerHexV1(
      canonicalizeJcsSafeIntegerUtf8V1([
        "store-durable-object-provider-policy-v1",
        manifest.semanticProviderPolicy,
      ]),
    ) !== manifest.expected.semanticProviderPolicyPreimageCanonicalUtf8Hex ||
    bytesToLowerHexV1(
      canonicalizeJcsSafeIntegerUtf8V1([
        "store-provider-filesystem-profile-v1",
        filesystemFields,
      ]),
    ) !== manifest.expected.filesystemProfilePreimageCanonicalUtf8Hex ||
    bytesToLowerHexV1(
      createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
        manifest.runtimeAttestation.payload,
        rootKeyId,
      ),
    ) !== manifest.expected.runtimeSignatureMessageUtf8Hex
  ) {
    throw new ProviderRuntimeAttestationPointFixtureError(
      "provider runtime attestation point golden expected projection mismatch",
    );
  }
  return Object.freeze({ authority: manifest.fixtureAuthority, manifest, pointClosure });
}

export function verifyProviderRuntimeAttestationPointInvalidResourceV1(
  bytes: Uint8Array,
): ProviderRuntimeAttestationPointInvalidManifestV1 {
  verifyResourceAnchorV1(
    bytes,
    PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
    PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
    "provider runtime attestation point invalid corpus",
  );
  let manifest: ProviderRuntimeAttestationPointInvalidManifestV1;
  try {
    manifest = ProviderRuntimeAttestationPointInvalidManifestV1Schema.parse(
      parseJsonResourceV1(bytes, "provider runtime attestation point invalid corpus"),
    );
  } catch (error) {
    if (error instanceof ProviderRuntimeAttestationPointFixtureError) throw error;
    throw new ProviderRuntimeAttestationPointFixtureError(
      "provider runtime attestation point invalid corpus schema is invalid",
    );
  }
  const { semanticContentDigest: _semanticContentDigest, ...semanticFields } = manifest;
  if (
    semanticDigestV1(
      PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_SEMANTIC_DOMAIN_V1,
      semanticFields,
    ) !== manifest.semanticContentDigest
  ) {
    throw new ProviderRuntimeAttestationPointFixtureError(
      "provider runtime attestation point invalid semantic digest mismatch",
    );
  }
  return manifest;
}

void ProviderRuntimeAttestationPointClosureValidationError;
