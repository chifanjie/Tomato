import { z } from "zod";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  Ed25519PublicKeyDigestV1Schema,
  ProviderFeasibilityApproverKeyIdV1Schema,
  ProviderFeasibilityEvidenceIdV1Schema,
} from "./primitives.js";
import {
  ProviderFeasibilityApproverPublicKeyV1Schema,
  ProviderFeasibilityEvidencePinV1Schema,
  StoreDurableObjectProviderRuntimeAttestationPinV1Schema,
  deriveProviderFeasibilityApproverKeyIdV1,
} from "./provider-registry-records.js";
import {
  PROVIDER_FEASIBILITY_EVIDENCE_ID_DOMAIN_V1,
  ProviderFeasibilityEvidenceEnvelopeV1Schema,
  ProviderFeasibilityEvidencePointClosureValidationError,
  ProviderFeasibilityEvidencePointInvalidReasonV1Schema,
  ProviderFeasibilityEvidencePointInvalidStageV1Schema,
  createProviderFeasibilityEvidenceQaSignatureMessageV1,
  createProviderFeasibilityEvidenceReleaseSignatureMessageV1,
  deriveProviderFeasibilityEvidenceContentDigestV1,
  deriveProviderFeasibilityEvidenceIdV1,
  deriveProviderFeasibilityEvidencePinV1,
  diagnoseProviderFeasibilityEvidencePointClosureV1,
  projectProviderFeasibilityEvidenceIdFieldsV1,
  validateProviderFeasibilityEvidencePointClosureV1,
  type ProviderFeasibilityEvidencePointClosureValidationV1,
  type ValidateProviderFeasibilityEvidencePointClosureV1Input,
} from "./provider-feasibility-evidence-point.js";
import {
  ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  ProviderRealFilesystemConformanceResultLocatorV1Schema,
  ProviderRealFilesystemConformanceResultPinV1Schema,
} from "./provider-real-filesystem-conformance-result.js";
import {
  ProviderRegistryIsoTimestampV1Schema,
  deriveProviderEd25519PublicKeyDigestInternalV1,
} from "./provider-registry-trust.js";
import {
  PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_CASE_IDS_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_PATH_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
  ProviderRuntimeAttestationPointGoldenManifestV1Schema,
  ProviderRuntimeAttestationPointInvalidManifestV1Schema,
  materializeProviderRuntimeAttestationPointInvalidRequestWitnessV1,
  type ProviderRuntimeAttestationPointGoldenManifestV1,
  type ProviderRuntimeAttestationPointInvalidCaseV1,
  type ProviderRuntimeAttestationPointInvalidCaseIdV1,
  type ProviderRuntimeAttestationPointInvalidManifestV1,
} from "./provider-runtime-attestation-point-fixtures.js";
import { sha256InternalV1 } from "./sha256.js";
import type { ProviderStrictEd25519OpaqueCapabilityV1 } from "./strict-ed25519-conformance.js";

export const PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_PROFILE_V1 =
  "provider_feasibility_evidence_point_golden_v1" as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_PROFILE_V1 =
  "provider_feasibility_evidence_point_invalid_v1" as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_SEMANTIC_DOMAIN_V1 =
  "provider-feasibility-evidence-point-golden-manifest-v1" as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_DOMAIN_V1 =
  "provider-feasibility-evidence-point-invalid-manifest-v1" as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1 =
  "provider-feasibility-evidence-point-invalid-materialized-request-v1" as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RECIPE_DIALECT_V1 =
  "provider_feasibility_evidence_point_invalid_recipe_v1" as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_PATH_V1 =
  "fixtures/v1/golden/provider-feasibility-evidence-point-v1.json" as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_PATH_V1 =
  "fixtures/v1/invalid/provider-feasibility-evidence-point-v1.json" as const;

// These six immutable byte and semantic anchors freeze the generated resources.
export const PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1 =
  179_229 as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1 =
  "2537f38c41acdd5606db8cd5e5a720f1c28bc543a66ea24bcca6e96dba9cc3b5" as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:eecf734efab5d720b00770d110489c378261ab259a1561004510556103c6b3ea" as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1 =
  716_365 as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_SHA256_HEX_V1 =
  "df833678cfcffc466014cf627a9d1469cfa7840ab2a0b62d2c63f2cb7ccca48f" as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:3fd076475ee3445fa07a8d580873655cd4d87b98d3f80de645ae643ccafc2ab2" as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_POINT_FIXTURE_MAX_BYTES_V1 =
  16_777_216 as const;

const POINT_CASE_IDS_V1 = [
  "evidence-envelope-schema-version-invalid",
  "evidence-envelope-record-type-invalid",
  "evidence-envelope-extra-field",
  "evidence-payload-profile-invalid",
  "evidence-payload-required-field-missing",
  "evidence-payload-extra-field",
  "evidence-qa-signature-format-invalid",
  "evidence-release-signature-format-invalid",
  "evidence-payload-not-object",
  "evidence-pin-profile-invalid",
  "evidence-pin-evidence-id-missing",
  "evidence-pin-content-digest-missing",
  "evidence-pin-extra-field",
  "qa-key-profile-invalid",
  "qa-key-generation-zero",
  "qa-key-algorithm-invalid",
  "qa-key-public-bytes-invalid",
  "qa-key-registry-signature-format-invalid",
  "qa-key-extra-field",
  "release-key-profile-invalid",
  "release-key-generation-zero",
  "release-key-algorithm-invalid",
  "release-key-public-bytes-invalid",
  "release-key-registry-signature-format-invalid",
  "release-key-extra-field",
  "qa-key-role-key-id-compound",
  "qa-key-id-mismatch",
  "qa-key-id-digest-compound",
  "qa-key-digest-mismatch",
  "release-key-role-key-id-compound",
  "release-key-id-mismatch",
  "release-key-id-digest-compound",
  "release-key-digest-mismatch",
  "approver-qa-release-material-alias",
  "approver-qa-root-material-alias",
  "approver-release-root-material-alias",
  "qa-key-root-mismatch",
  "release-key-root-mismatch",
  "qa-key-point-invalid",
  "release-key-point-invalid",
  "qa-key-signature-bitflip",
  "qa-key-signature-wrong-signer",
  "qa-key-signature-wrong-domain",
  "release-key-signature-bitflip",
  "release-key-signature-wrong-signer",
  "release-key-signature-wrong-domain",
  "evidence-provider-binding-mismatch",
  "evidence-policy-digest-binding-mismatch",
  "evidence-implementation-binding-mismatch",
  "evidence-binary-binding-mismatch",
  "evidence-target-profile-id-binding-mismatch",
  "evidence-target-os-platform-binding-mismatch",
  "evidence-target-os-family-binding-mismatch",
  "evidence-target-os-build-binding-mismatch",
  "evidence-target-architecture-binding-mismatch",
  "evidence-target-filesystem-profile-binding-mismatch",
  "evidence-target-filesystem-feature-binding-mismatch",
  "evidence-target-mount-option-binding-mismatch",
  "evidence-suite-binding-mismatch",
  "evidence-fixture-binding-mismatch",
  "evidence-runner-binding-mismatch",
  "evidence-crash-cut-binding-mismatch",
  "evidence-result-binding-mismatch",
  "evidence-ordinary-result-pin-compound",
  "evidence-result-pin-mismatch",
  "evidence-result-pin-digest-compound",
  "evidence-result-digest-mismatch",
  "evidence-policy-isolation-binding-mismatch",
  "evidence-policy-ipc-binding-mismatch",
  "evidence-policy-suite-binding-mismatch",
  "evidence-runtime-attestation-digest-mismatch",
  "evidence-time-before-one-nanosecond",
  "evidence-id-mismatch",
  "evidence-qa-signature-key-id-mismatch",
  "evidence-release-signature-key-id-mismatch",
  "evidence-qa-signature-bitflip",
  "evidence-qa-signature-wrong-signer",
  "evidence-qa-signature-wrong-domain",
  "evidence-qa-signature-wrong-role-wrapper",
  "evidence-release-signature-bitflip",
  "evidence-release-signature-wrong-signer",
  "evidence-release-signature-wrong-domain",
  "evidence-release-signature-wrong-role-wrapper",
  "evidence-signatures-swapped",
  "evidence-content-digest-mismatch",
  "evidence-envelope-id-mismatch",
  "evidence-pin-id-mismatch",
  "evidence-pin-digest-mismatch",
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
] as const;

type RuntimeEvidencePointInvalidCaseIdV1 =
  `runtime-${ProviderRuntimeAttestationPointInvalidCaseIdV1}`;
type PointEvidencePointInvalidCaseIdV1 = (typeof POINT_CASE_IDS_V1)[number];
export type ProviderFeasibilityEvidencePointInvalidCaseIdV1 =
  | RuntimeEvidencePointInvalidCaseIdV1
  | PointEvidencePointInvalidCaseIdV1;

const RUNTIME_CASE_IDS_V1: readonly RuntimeEvidencePointInvalidCaseIdV1[] =
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_CASE_IDS_V1.map(
    (caseId): RuntimeEvidencePointInvalidCaseIdV1 => `runtime-${caseId}`,
  );
const INVALID_CASE_IDS_V1: readonly ProviderFeasibilityEvidencePointInvalidCaseIdV1[] = [
  ...RUNTIME_CASE_IDS_V1,
  ...POINT_CASE_IDS_V1,
] as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_CASE_IDS_V1:
  readonly ProviderFeasibilityEvidencePointInvalidCaseIdV1[] = Object.freeze([
    ...INVALID_CASE_IDS_V1,
  ]);

const InvalidCaseIdV1Schema = z.enum(
  INVALID_CASE_IDS_V1 as unknown as [
    ProviderFeasibilityEvidencePointInvalidCaseIdV1,
    ...ProviderFeasibilityEvidencePointInvalidCaseIdV1[],
  ],
);
const RuntimeSourceOperationV1Schema = z.enum(
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_CASE_IDS_V1 as unknown as [
    ProviderRuntimeAttestationPointInvalidCaseIdV1,
    ...ProviderRuntimeAttestationPointInvalidCaseIdV1[],
  ],
);
const NonnegativeSafeIntegerV1Schema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const EvenLowerHexV1Schema = z.string().regex(/^(?:[0-9a-f]{2})+$/u);

const RuntimeRecipeV1Schema = z.strictObject({
  kind: z.literal("runtime_attestation_point"),
  sourceOperation: RuntimeSourceOperationV1Schema,
});
const ReplacementRecipeV1Schema = z.strictObject({
  kind: z.literal("replace_artifacts"),
  providerFeasibilityEvidence: z.string().min(1).optional(),
  providerFeasibilityEvidencePin: z.string().min(1).optional(),
  qaApproverPublicKey: z.string().min(1).optional(),
  realFilesystemConformanceResult: z.string().min(1).optional(),
  realFilesystemConformanceResultLocator: z.string().min(1).optional(),
  realFilesystemConformanceResultPin: z.string().min(1).optional(),
  releaseApproverPublicKey: z.string().min(1).optional(),
  runtimeAttestation: z.string().min(1).optional(),
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
  "evidence_async_mutation",
  "pin_async_mutation",
  "qa_key_async_mutation",
  "release_key_async_mutation",
]);
const HostileRecipeV1Schema = z.strictObject({
  kind: z.literal("hostile_input"),
  profile: HostileRecipeProfileV1Schema,
});
const PointRecipeV1Schema = z.discriminatedUnion("kind", [
  ReplacementRecipeV1Schema,
  HostileRecipeV1Schema,
]);
const InvalidRecipeV1Schema = z.discriminatedUnion("kind", [
  RuntimeRecipeV1Schema,
  ReplacementRecipeV1Schema,
  HostileRecipeV1Schema,
]);

const SnapshotProjectionV1Schema = z.strictObject({
  runtimeAttestationContentDigest: ContentDigestV1Schema,
  runtimeAttestationGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  runtimeIssuedAt: ProviderRegistryIsoTimestampV1Schema,
  runtimeIpcEndpointAttestationDigest: ContentDigestV1Schema,
  semanticProviderPolicyDigest: ContentDigestV1Schema,
  filesystemProfileDigest: ContentDigestV1Schema,
  realFilesystemConformanceResultContentDigest: ContentDigestV1Schema,
  conformanceCaseResultCount: NonnegativeSafeIntegerV1Schema,
  conformancePassedCaseResultCount: NonnegativeSafeIntegerV1Schema,
  conformanceFailedCaseResultCount: NonnegativeSafeIntegerV1Schema,
  conformanceUnsupportedCaseResultCount: NonnegativeSafeIntegerV1Schema,
  evidenceId: ProviderFeasibilityEvidenceIdV1Schema,
  evidenceContentDigest: ContentDigestV1Schema,
  evidenceIssuedAt: ProviderRegistryIsoTimestampV1Schema,
  evidenceResult: z.enum(["passed", "failed", "unsupported"]),
  qaApproverKeyId: ProviderFeasibilityApproverKeyIdV1Schema,
  releaseApproverKeyId: ProviderFeasibilityApproverKeyIdV1Schema,
  qaApproverPublicKeyDigest: Ed25519PublicKeyDigestV1Schema,
  releaseApproverPublicKeyDigest: Ed25519PublicKeyDigestV1Schema,
  evidenceRelativePath: z
    .string()
    .regex(/^provider\/feasibility-evidence\/[A-Za-z0-9_-]+\.json$/u),
});
export type ProviderFeasibilityEvidencePointSnapshotProjectionV1 = z.infer<
  typeof SnapshotProjectionV1Schema
>;

const PublicFailureV1Schema = z.strictObject({
  errorName: z.literal("ProviderFeasibilityEvidencePointClosureValidationError"),
  code: z.literal("provider_unavailable"),
  reason: z.literal("attestation_invalid"),
});
const InternalExpectedV1Schema = z.strictObject({
  boundary: z.literal("internal_diagnostic"),
  stage: ProviderFeasibilityEvidencePointInvalidStageV1Schema,
  reason: ProviderFeasibilityEvidencePointInvalidReasonV1Schema,
  publicFailureReason: z.literal("attestation_invalid"),
  publicFailure: PublicFailureV1Schema,
  pointAdmissionCount: NonnegativeSafeIntegerV1Schema,
  signatureVerificationCount: NonnegativeSafeIntegerV1Schema,
  materializedRequestSemanticDigest: ContentDigestV1Schema,
});
const SnapshotExpectedV1Schema = z.strictObject({
  boundary: z.literal("snapshot_stability"),
  outcome: z.literal("accepted_frozen_snapshot"),
  authority: z.literal("none_provider_feasibility_evidence_structure_only"),
  snapshotProjection: SnapshotProjectionV1Schema,
  pointAdmissionCount: z.literal(3),
  signatureVerificationCount: z.literal(11),
  materializedRequestSemanticDigest: ContentDigestV1Schema,
});
const InvalidExpectedV1Schema = z.discriminatedUnion("boundary", [
  InternalExpectedV1Schema,
  SnapshotExpectedV1Schema,
]);

function positiveVectorSchemaV1(
  vectorId:
    | "passed-exact-equal"
    | "failed-after-one-nanosecond"
    | "unsupported-equal-different-fraction-length",
  result: "passed" | "failed" | "unsupported",
) {
  return z.strictObject({
    vectorId: z.literal(vectorId),
    result: z.literal(result),
    issuedAt: ProviderRegistryIsoTimestampV1Schema,
    realFilesystemConformanceResult:
      ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
    realFilesystemConformanceResultLocator:
      ProviderRealFilesystemConformanceResultLocatorV1Schema,
    realFilesystemConformanceResultPin:
      ProviderRealFilesystemConformanceResultPinV1Schema,
    runtimeAttestation: StoreDurableObjectProviderRuntimeAttestationPinV1Schema,
    providerFeasibilityEvidence: ProviderFeasibilityEvidenceEnvelopeV1Schema,
    providerFeasibilityEvidencePin: ProviderFeasibilityEvidencePinV1Schema,
  });
}

export const ProviderFeasibilityEvidencePointGoldenManifestV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  profile: z.literal(PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_PROFILE_V1),
  fixtureAuthority: z.literal("none_provider_feasibility_evidence_structure_only"),
  canonicalizationProfile: z.literal("rfc8785-jcs-safe-integer-v1"),
  verificationProfile: z.literal("ed25519-rfc8032-cofactorless-prime-subgroup-v1"),
  runtimeAttestationPointGolden: ProviderRuntimeAttestationPointGoldenManifestV1Schema,
  providerFeasibilityEvidence: ProviderFeasibilityEvidenceEnvelopeV1Schema,
  providerFeasibilityEvidencePin: ProviderFeasibilityEvidencePinV1Schema,
  qaApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1Schema,
  releaseApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1Schema,
  positiveVectors: z.tuple([
    positiveVectorSchemaV1("passed-exact-equal", "passed"),
    positiveVectorSchemaV1("failed-after-one-nanosecond", "failed"),
    positiveVectorSchemaV1(
      "unsupported-equal-different-fraction-length",
      "unsupported",
    ),
  ]),
  expected: z.strictObject({
    evidenceIdPreimageCanonicalUtf8Hex: EvenLowerHexV1Schema,
    qaSignatureMessageUtf8Hex: EvenLowerHexV1Schema,
    releaseSignatureMessageUtf8Hex: EvenLowerHexV1Schema,
    evidenceId: ProviderFeasibilityEvidenceIdV1Schema,
    evidenceContentDigest: ContentDigestV1Schema,
    evidenceRelativePath: z
      .string()
      .regex(/^provider\/feasibility-evidence\/[A-Za-z0-9_-]+\.json$/u),
    qaApproverKeyId: ProviderFeasibilityApproverKeyIdV1Schema,
    releaseApproverKeyId: ProviderFeasibilityApproverKeyIdV1Schema,
    qaApproverPublicKeyDigest: Ed25519PublicKeyDigestV1Schema,
    releaseApproverPublicKeyDigest: Ed25519PublicKeyDigestV1Schema,
    activeRootPointAdmissionCount: z.literal(3),
    signatureVerificationCount: z.literal(11),
    approverRecordSignatureCount: z.literal(2),
    evidenceSignatureCount: z.literal(2),
  }),
  semanticDomain: z.literal(PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_SEMANTIC_DOMAIN_V1),
  dependencies: z.strictObject({
    runtimeGoldenResourcePath: z.literal(
      PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_PATH_V1,
    ),
    runtimeGoldenResourceByteLength: z.literal(
      PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    ),
    runtimeGoldenResourceSha256Hex: z.literal(
      PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
    ),
    runtimeGoldenSemanticContentDigest: z.literal(
      PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    ),
    runtimeInvalidResourcePath: z.literal(
      PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_PATH_V1,
    ),
    runtimeInvalidResourceByteLength: z.literal(
      PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
    ),
    runtimeInvalidResourceSha256Hex: z.literal(
      PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
    ),
    runtimeInvalidSemanticContentDigest: z.literal(
      PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
    ),
  }),
  semanticContentDigest: z.literal(
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  ),
});
export type ProviderFeasibilityEvidencePointGoldenManifestV1 = z.infer<
  typeof ProviderFeasibilityEvidencePointGoldenManifestV1Schema
>;

type ParsedInvalidCaseV1 = {
  readonly caseId: ProviderFeasibilityEvidencePointInvalidCaseIdV1;
  readonly group:
    | "runtime_attestation_point"
    | "provider_feasibility_evidence_point";
  readonly mutation: {
    readonly dialect: typeof PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RECIPE_DIALECT_V1;
    readonly goldenResourcePath: typeof PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_PATH_V1;
    readonly operation: ProviderFeasibilityEvidencePointInvalidCaseIdV1;
    readonly recipe: z.infer<typeof InvalidRecipeV1Schema>;
  };
  readonly expected: z.infer<typeof InvalidExpectedV1Schema>;
};

function orderedInvalidCaseSchemaV1(
  caseId: ProviderFeasibilityEvidencePointInvalidCaseIdV1,
): z.ZodType<ParsedInvalidCaseV1> {
  const isRuntime = caseId.startsWith("runtime-");
  const recipeSchema = isRuntime
    ? z.strictObject({
        kind: z.literal("runtime_attestation_point"),
        sourceOperation: z.literal(
          caseId.slice("runtime-".length) as ProviderRuntimeAttestationPointInvalidCaseIdV1,
        ),
      })
    : PointRecipeV1Schema;
  return z.strictObject({
    caseId: z.literal(caseId),
    group: z.literal(
      isRuntime
        ? "runtime_attestation_point"
        : "provider_feasibility_evidence_point",
    ),
    mutation: z.strictObject({
      dialect: z.literal(
        PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RECIPE_DIALECT_V1,
      ),
      goldenResourcePath: z.literal(
        PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_PATH_V1,
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
  z.ZodType<ProviderFeasibilityEvidencePointInvalidCaseIdV1>,
  ...z.ZodType<ProviderFeasibilityEvidencePointInvalidCaseIdV1>[],
];
const ORDERED_INVALID_CASE_SCHEMAS_V1 = INVALID_CASE_IDS_V1.map((caseId) =>
  orderedInvalidCaseSchemaV1(caseId),
) as unknown as [
  z.ZodType<ParsedInvalidCaseV1>,
  ...z.ZodType<ParsedInvalidCaseV1>[],
];

export const ProviderFeasibilityEvidencePointInvalidManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_PROFILE_V1),
    fixtureAuthority: z.literal("none_rejection_only"),
    canonicalizationProfile: z.literal("rfc8785-jcs-safe-integer-v1"),
    verificationProfile: z.literal("ed25519-rfc8032-cofactorless-prime-subgroup-v1"),
    semanticDomain: z.literal(
      PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_DOMAIN_V1,
    ),
    materializedRequestSemanticDomain: z.literal(
      PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
    ),
    goldenDependency: z.strictObject({
      resourcePath: z.literal(
        PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_PATH_V1,
      ),
      resourceByteLength: z.literal(
        PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
      ),
      resourceSha256Hex: z.literal(
        PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
      ),
      semanticContentDigest: z.literal(
        PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
      ),
    }),
    runtimeInvalidDependency: ProviderRuntimeAttestationPointInvalidManifestV1Schema,
    mutationRecipeDialect: z.literal(
      PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RECIPE_DIALECT_V1,
    ),
    runtimeCaseCount: z.literal(RUNTIME_CASE_IDS_V1.length),
    pointCaseCount: z.literal(POINT_CASE_IDS_V1.length),
    caseCount: z.literal(INVALID_CASE_IDS_V1.length),
    caseIds: z.tuple(ORDERED_INVALID_CASE_ID_SCHEMAS_V1),
    cases: z.tuple(ORDERED_INVALID_CASE_SCHEMAS_V1),
    semanticContentDigest: z.literal(
      PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
    ),
  });

export type ProviderFeasibilityEvidencePointInvalidCaseV1 = ParsedInvalidCaseV1;
type ParsedInvalidManifestV1 = z.infer<
  typeof ProviderFeasibilityEvidencePointInvalidManifestV1Schema
>;
export type ProviderFeasibilityEvidencePointInvalidManifestV1 = Omit<
  ParsedInvalidManifestV1,
  "caseIds" | "cases"
> & {
  readonly caseIds: readonly ProviderFeasibilityEvidencePointInvalidCaseIdV1[];
  readonly cases: readonly ProviderFeasibilityEvidencePointInvalidCaseV1[];
};

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

function parseCanonicalRecipeJsonV1(value: string): unknown {
  const parsed = JSON.parse(value) as unknown;
  if (
    new TextDecoder().decode(canonicalizeJcsSafeIntegerUtf8V1(parsed)) !== value
  ) {
    throw new ProviderFeasibilityEvidencePointFixtureError(
      "provider feasibility evidence replacement is not canonical JSON",
    );
  }
  return parsed;
}

function parseJsonResourceV1(bytes: Uint8Array, label: string): unknown {
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes),
    );
  } catch {
    throw new ProviderFeasibilityEvidencePointFixtureError(
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
    bytes.byteLength > PROVIDER_FEASIBILITY_EVIDENCE_POINT_FIXTURE_MAX_BYTES_V1 ||
    bytes.byteLength !== expectedBytes ||
    rawSha256HexV1(bytes) !== expectedSha256
  ) {
    throw new ProviderFeasibilityEvidencePointFixtureError(
      `${label} bytes do not match the immutable anchor`,
    );
  }
}

export class ProviderFeasibilityEvidencePointFixtureError extends TypeError {}

function requestFromGoldenV1(
  golden: ProviderFeasibilityEvidencePointGoldenManifestV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): ValidateProviderFeasibilityEvidencePointClosureV1Input {
  const runtime = golden.runtimeAttestationPointGolden;
  const source = runtime.conformanceResultGolden;
  return {
    activeRoot: jsonCloneV1(source.activeRoot),
    activeRootMetadata: jsonCloneV1(source.activeRootMetadata),
    distributionRootBinding: jsonCloneV1(source.distributionRootBinding),
    fixtureCorpusManifest: jsonCloneV1(source.fixtureCorpusManifest),
    providerFeasibilityEvidence: jsonCloneV1(
      golden.providerFeasibilityEvidence,
    ),
    providerFeasibilityEvidencePin: jsonCloneV1(
      golden.providerFeasibilityEvidencePin,
    ),
    publicSupportTaxonomy: jsonCloneV1(source.publicSupportTaxonomy),
    qaApproverPublicKey: jsonCloneV1(golden.qaApproverPublicKey),
    realFilesystemConformanceResult: jsonCloneV1(
      runtime.realFilesystemConformanceResult,
    ),
    realFilesystemConformanceResultLocator: jsonCloneV1(
      runtime.realFilesystemConformanceResultLocator,
    ),
    realFilesystemConformanceResultPin: jsonCloneV1(
      runtime.realFilesystemConformanceResultPin,
    ),
    releaseApproverPublicKey: jsonCloneV1(golden.releaseApproverPublicKey),
    releaseMatrix: jsonCloneV1(source.releaseMatrix),
    runtimeAttestation: jsonCloneV1(runtime.runtimeAttestation),
    semanticProviderPolicy: jsonCloneV1(runtime.semanticProviderPolicy),
    strictCryptoCapability,
    suiteManifest: jsonCloneV1(source.suiteManifest),
    targetDiscoveryFixtureManifest: jsonCloneV1(
      source.targetDiscoveryFixtureManifest,
    ),
    targetDiscoveryResult: jsonCloneV1(source.targetDiscoveryResult),
    targetDiscoveryRunnerRun: jsonCloneV1(source.targetDiscoveryRunnerRun),
  };
}

function withoutCapabilityV1(
  request: ValidateProviderFeasibilityEvidencePointClosureV1Input,
): Record<string, unknown> {
  const { strictCryptoCapability: _strictCryptoCapability, ...artifacts } = request;
  return artifacts;
}

type PreparedInputV1 = {
  readonly input: unknown;
  readonly getterCalls: () => number;
  readonly mutateAfterStart?: () => void;
};

function assertRecursivelyFrozenV1(
  value: unknown,
  seen = new Set<object>(),
): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  if (!Object.isFrozen(value)) {
    throw new Error("provider feasibility success is not recursively frozen");
  }
  seen.add(value);
  for (const child of Object.values(value)) {
    assertRecursivelyFrozenV1(child, seen);
  }
}

function augmentRuntimeRequestV1(
  golden: ProviderFeasibilityEvidencePointGoldenManifestV1,
  runtimeRequest: Record<string, unknown>,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Record<string, unknown> {
  return {
    ...jsonCloneV1(runtimeRequest),
    providerFeasibilityEvidence: jsonCloneV1(golden.providerFeasibilityEvidence),
    providerFeasibilityEvidencePin: jsonCloneV1(
      golden.providerFeasibilityEvidencePin,
    ),
    qaApproverPublicKey: jsonCloneV1(golden.qaApproverPublicKey),
    releaseApproverPublicKey: jsonCloneV1(golden.releaseApproverPublicKey),
    strictCryptoCapability,
  };
}

function prepareSourceHostileInputV1(
  golden: ProviderFeasibilityEvidencePointGoldenManifestV1,
  sourceCase: ProviderRuntimeAttestationPointInvalidCaseV1,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): PreparedInputV1 {
  const request = requestFromGoldenV1(golden, capability) as unknown as Record<
    PropertyKey,
    unknown
  >;
  let getterCalls = 0;
  const recipe = sourceCase.mutation.recipe;
  if (recipe.kind === "hostile_input") {
    const runtime = request.runtimeAttestation as Record<string, unknown>;
    const runtimePayload = runtime.payload as Record<PropertyKey, unknown>;
    const policy = request.semanticProviderPolicy as Record<PropertyKey, unknown>;
    switch (recipe.profile) {
      case "extra_field": request.unexpected = true; break;
      case "plain_validation_dto": return {
        input: { runtimeAttestation: request.runtimeAttestation },
        getterCalls: () => getterCalls,
      };
      case "top_level_proxy": return {
        input: new Proxy(request, {}), getterCalls: () => getterCalls,
      };
      case "nested_proxy": runtime.payload = new Proxy(runtimePayload, {}); break;
      case "top_level_getter":
        Object.defineProperty(request, "unexpected", {
          enumerable: true,
          get() { getterCalls += 1; return true; },
        });
        break;
      case "nested_getter":
        Object.defineProperty(runtimePayload, "unexpected", {
          enumerable: true,
          get() { getterCalls += 1; return true; },
        });
        break;
      case "top_level_hidden":
        Object.defineProperty(request, "hidden", { enumerable: false, value: true });
        break;
      case "nested_hidden":
        Object.defineProperty(runtimePayload, "hidden", { enumerable: false, value: true });
        break;
      case "top_level_symbol":
        Object.defineProperty(request, Symbol("hostile"), { enumerable: true, value: true });
        break;
      case "nested_symbol":
        Object.defineProperty(runtimePayload, Symbol("hostile"), { enumerable: true, value: true });
        break;
      case "sparse_array":
        delete (policy.supportedStagingObjectKinds as unknown[])[0];
        break;
      case "cycle": policy.cycle = policy; break;
      case "alias":
        policy.isolation = (
          (request.realFilesystemConformanceResult as Record<string, unknown>)
            .payload as Record<string, unknown>
        ).target;
        break;
      case "async_mutation":
        return {
          input: request,
          getterCalls: () => getterCalls,
          mutateAfterStart() {
            runtimePayload.ipcEndpointAttestationDigest = `sha256:${"7".repeat(64)}`;
            runtimePayload.attestationGeneration = 2;
            runtimePayload.issuedAt = "2026-08-04T23:59:59Z";
          },
        };
      case "runtime_generation_fractional": runtimePayload.attestationGeneration = 1.5; break;
      case "runtime_generation_unsafe": runtimePayload.attestationGeneration = Number.MAX_SAFE_INTEGER + 1; break;
    }
    return { input: request, getterCalls: () => getterCalls };
  }

  if (recipe.kind !== "inner_conformance_result") {
    throw new TypeError(`source case ${sourceCase.caseId} is not hostile`);
  }
  const result = request.realFilesystemConformanceResult as Record<string, unknown>;
  const payload = result.payload as Record<PropertyKey, unknown>;
  switch (recipe.sourceOperation) {
    case "locator-envelope-substitution":
      request.realFilesystemConformanceResultLocator = jsonCloneV1(result);
      break;
    case "security-top-level-proxy":
      return { input: new Proxy(request, {}), getterCalls: () => getterCalls };
    case "security-nested-proxy": result.payload = new Proxy(payload, {}); break;
    case "security-top-level-getter":
      Object.defineProperty(request, "unexpected", {
        enumerable: true,
        get() { getterCalls += 1; return true; },
      });
      break;
    case "security-nested-getter":
      Object.defineProperty(payload, "unexpected", {
        enumerable: true,
        get() { getterCalls += 1; return true; },
      });
      break;
    case "security-nested-hidden":
      Object.defineProperty(payload, "hidden", { enumerable: false, value: true });
      break;
    case "security-nested-symbol":
      Object.defineProperty(payload, Symbol("hostile"), { enumerable: true, value: true });
      break;
    case "security-sparse-array":
      delete (payload.caseResults as unknown[])[0];
      break;
    case "security-cycle": request.cycle = request; break;
    case "security-alias":
      payload.target = (
        ((request.targetDiscoveryResult as Record<string, unknown>).payload as Record<
          string,
          unknown
        >).targets as Array<Record<string, unknown>>
      )[0]!.target;
      break;
    case "security-async-mutation":
      return {
        input: request,
        getterCalls: () => getterCalls,
        mutateAfterStart() {
          payload.result = "failed";
          const first = (payload.caseResults as Array<Record<string, unknown>>)[0];
          if (first !== undefined) {
            first.outcome = "failed";
            first.resultCode = "assertion_failed";
          }
        },
      };
    default:
      throw new TypeError(`unknown executable source operation ${recipe.sourceOperation}`);
  }
  return { input: request, getterCalls: () => getterCalls };
}

const INNER_EXECUTABLE_CASE_IDS_V1 = new Set<string>([
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

function prepareInheritedInputV1(
  golden: ProviderFeasibilityEvidencePointGoldenManifestV1,
  invalid: ProviderFeasibilityEvidencePointInvalidManifestV1,
  sourceOperation: ProviderRuntimeAttestationPointInvalidCaseIdV1,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): PreparedInputV1 {
  const runtimeCases = invalid.runtimeInvalidDependency.cases as readonly ProviderRuntimeAttestationPointInvalidCaseV1[];
  const sourceCase = runtimeCases.find(
    (entry) => entry.caseId === sourceOperation,
  );
  if (sourceCase === undefined) {
    throw new TypeError(`missing runtime source operation ${sourceOperation}`);
  }
  if (
    sourceCase.mutation.recipe.kind === "hostile_input" ||
    (sourceCase.mutation.recipe.kind === "inner_conformance_result" &&
      INNER_EXECUTABLE_CASE_IDS_V1.has(
        sourceCase.mutation.recipe.sourceOperation,
      ))
  ) {
    return prepareSourceHostileInputV1(golden, sourceCase, capability);
  }
  const witness =
    materializeProviderRuntimeAttestationPointInvalidRequestWitnessV1(
      golden.runtimeAttestationPointGolden,
      sourceCase,
    ) as { readonly request?: Record<string, unknown> };
  if (witness.request === undefined) {
    throw new TypeError(`runtime source ${sourceOperation} has no request witness`);
  }
  return {
    input: augmentRuntimeRequestV1(golden, witness.request, capability),
    getterCalls: () => 0,
  };
}

function prepareReplacementInputV1(
  golden: ProviderFeasibilityEvidencePointGoldenManifestV1,
  recipe: z.infer<typeof ReplacementRecipeV1Schema>,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): PreparedInputV1 {
  const request = requestFromGoldenV1(golden, capability) as unknown as Record<
    string,
    unknown
  >;
  for (const key of [
    "providerFeasibilityEvidence",
    "providerFeasibilityEvidencePin",
    "qaApproverPublicKey",
    "realFilesystemConformanceResult",
    "realFilesystemConformanceResultLocator",
    "realFilesystemConformanceResultPin",
    "releaseApproverPublicKey",
    "runtimeAttestation",
  ] as const) {
    const replacement = recipe[key];
    if (replacement !== undefined) request[key] = parseCanonicalRecipeJsonV1(replacement);
  }
  return { input: request, getterCalls: () => 0 };
}

function preparePointHostileInputV1(
  golden: ProviderFeasibilityEvidencePointGoldenManifestV1,
  profile: z.infer<typeof HostileRecipeProfileV1Schema>,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): PreparedInputV1 {
  const request = requestFromGoldenV1(golden, capability) as unknown as Record<
    PropertyKey,
    unknown
  >;
  const evidenceEnvelope = request.providerFeasibilityEvidence as Record<string, unknown>;
  const evidence = evidenceEnvelope.payload as Record<PropertyKey, unknown>;
  let getterCalls = 0;
  switch (profile) {
    case "extra_field": request.unexpected = true; break;
    case "plain_validation_dto":
      return {
        input: { authority: "none_provider_feasibility_evidence_structure_only" },
        getterCalls: () => getterCalls,
      };
    case "top_level_proxy":
      return { input: new Proxy(request, {}), getterCalls: () => getterCalls };
    case "nested_proxy": evidenceEnvelope.payload = new Proxy(evidence, {}); break;
    case "top_level_getter":
      Object.defineProperty(request, "unexpected", {
        enumerable: true,
        get() { getterCalls += 1; return true; },
      });
      break;
    case "nested_getter":
      Object.defineProperty(evidence, "unexpected", {
        enumerable: true,
        get() { getterCalls += 1; return true; },
      });
      break;
    case "top_level_hidden":
      Object.defineProperty(request, "hidden", { enumerable: false, value: true });
      break;
    case "nested_hidden":
      Object.defineProperty(evidence, "hidden", { enumerable: false, value: true });
      break;
    case "top_level_symbol":
      Object.defineProperty(request, Symbol("hostile"), { enumerable: true, value: true });
      break;
    case "nested_symbol":
      Object.defineProperty(evidence, Symbol("hostile"), { enumerable: true, value: true });
      break;
    case "sparse_array":
      delete (
        (((request.targetDiscoveryResult as Record<string, unknown>).payload as Record<
          string,
          unknown
        >).targets as unknown[])
      )[0];
      break;
    case "cycle": evidence.cycle = evidence; break;
    case "alias":
      evidence.target = (
        ((request.realFilesystemConformanceResult as Record<string, unknown>).payload as Record<
          string,
          unknown
        >).target
      );
      break;
    case "evidence_async_mutation":
      return {
        input: request,
        getterCalls: () => getterCalls,
        mutateAfterStart() { evidence.result = "failed"; },
      };
    case "pin_async_mutation":
      return {
        input: request,
        getterCalls: () => getterCalls,
        mutateAfterStart() {
          (request.providerFeasibilityEvidencePin as Record<string, unknown>).contentDigest =
            `sha256:${"0".repeat(64)}`;
        },
      };
    case "qa_key_async_mutation":
      return {
        input: request,
        getterCalls: () => getterCalls,
        mutateAfterStart() {
          (request.qaApproverPublicKey as Record<string, unknown>).publicKeyDigest =
            `sha256:${"0".repeat(64)}`;
        },
      };
    case "release_key_async_mutation":
      return {
        input: request,
        getterCalls: () => getterCalls,
        mutateAfterStart() {
          (request.releaseApproverPublicKey as Record<string, unknown>).publicKeyDigest =
            `sha256:${"0".repeat(64)}`;
        },
      };
  }
  return { input: request, getterCalls: () => getterCalls };
}

function prepareInvalidInputV1(
  golden: ProviderFeasibilityEvidencePointGoldenManifestV1,
  invalid: ProviderFeasibilityEvidencePointInvalidManifestV1,
  invalidCase: ProviderFeasibilityEvidencePointInvalidCaseV1,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): PreparedInputV1 {
  const recipe = invalidCase.mutation.recipe;
  switch (recipe.kind) {
    case "runtime_attestation_point":
      return prepareInheritedInputV1(
        golden,
        invalid,
        recipe.sourceOperation,
        capability,
      );
    case "replace_artifacts":
      return prepareReplacementInputV1(golden, recipe, capability);
    case "hostile_input":
      return preparePointHostileInputV1(golden, recipe.profile, capability);
  }
}

export function materializeProviderFeasibilityEvidencePointInvalidRequestWitnessV1(
  golden: ProviderFeasibilityEvidencePointGoldenManifestV1,
  invalid: ProviderFeasibilityEvidencePointInvalidManifestV1,
  invalidCase: ProviderFeasibilityEvidencePointInvalidCaseV1,
): unknown {
  const recipe = invalidCase.mutation.recipe;
  const runtimeCases = invalid.runtimeInvalidDependency.cases as readonly ProviderRuntimeAttestationPointInvalidCaseV1[];
  if (
    recipe.kind === "hostile_input" ||
    (recipe.kind === "runtime_attestation_point" &&
      runtimeCases.find(
        (entry) => entry.caseId === recipe.sourceOperation,
      )?.mutation.recipe.kind === "hostile_input") ||
    (recipe.kind === "runtime_attestation_point" &&
      runtimeCases.find(
        (entry) => entry.caseId === recipe.sourceOperation,
      )?.mutation.recipe.kind === "inner_conformance_result" &&
      INNER_EXECUTABLE_CASE_IDS_V1.has(
        recipe.sourceOperation.startsWith("inner-")
          ? recipe.sourceOperation.slice("inner-".length)
          : "",
      ))
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
  const prepared = prepareInvalidInputV1(golden, invalid, invalidCase, placeholder);
  return {
    caseId: invalidCase.caseId,
    request: withoutCapabilityV1(
      prepared.input as ValidateProviderFeasibilityEvidencePointClosureV1Input,
    ),
  };
}

export type ProviderFeasibilityEvidencePointInvalidCaseExecutionV1 =
  | Readonly<{ kind: "unexpected_acceptance" }>
  | Readonly<{
      kind: "rejection";
      boundary: "internal_diagnostic";
      stage: z.infer<typeof ProviderFeasibilityEvidencePointInvalidStageV1Schema>;
      reason: z.infer<typeof ProviderFeasibilityEvidencePointInvalidReasonV1Schema>;
      publicFailure: Readonly<{
        errorName: unknown;
        code: unknown;
        reason: unknown;
      }> | undefined;
    }>
  | Readonly<{
      kind: "snapshot_acceptance";
      boundary: "snapshot_stability";
      authority: "none_provider_feasibility_evidence_structure_only";
      snapshotProjection: ProviderFeasibilityEvidencePointSnapshotProjectionV1;
    }>;

function snapshotProjectionV1(
  value: ProviderFeasibilityEvidencePointClosureValidationV1,
): ProviderFeasibilityEvidencePointSnapshotProjectionV1 {
  const runtime = value.runtimeAttestationPointClosure;
  const evidence = value.providerFeasibilityEvidence;
  return Object.freeze({
    runtimeAttestationContentDigest: runtime.runtimeAttestation.contentDigest,
    runtimeAttestationGeneration: runtime.runtimeAttestation.payload.attestationGeneration,
    runtimeIssuedAt: runtime.runtimeAttestation.payload.issuedAt,
    runtimeIpcEndpointAttestationDigest:
      runtime.runtimeAttestation.payload.ipcEndpointAttestationDigest,
    semanticProviderPolicyDigest: runtime.semanticProviderPolicyDigest,
    filesystemProfileDigest: runtime.filesystemProfileDigest,
    realFilesystemConformanceResultContentDigest:
      runtime.conformanceResultClosure.result.contentDigest,
    conformanceCaseResultCount: runtime.conformanceResultClosure.caseResultCount,
    conformancePassedCaseResultCount:
      runtime.conformanceResultClosure.passedCaseResultCount,
    conformanceFailedCaseResultCount:
      runtime.conformanceResultClosure.failedCaseResultCount,
    conformanceUnsupportedCaseResultCount:
      runtime.conformanceResultClosure.unsupportedCaseResultCount,
    evidenceId: evidence.evidenceId,
    evidenceContentDigest: evidence.contentDigest,
    evidenceIssuedAt: evidence.payload.issuedAt,
    evidenceResult: evidence.payload.result,
    qaApproverKeyId: value.qaApproverPublicKey.keyId,
    releaseApproverKeyId: value.releaseApproverPublicKey.keyId,
    qaApproverPublicKeyDigest: value.qaApproverPublicKey.publicKeyDigest,
    releaseApproverPublicKeyDigest: value.releaseApproverPublicKey.publicKeyDigest,
    evidenceRelativePath: value.relativePath,
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
      "Provider feasibility evidence point closure validation failed"
  ) {
    throw new Error("provider feasibility public failure leaked fields");
  }
  return {
    errorName: candidate.name,
    code: candidate.code,
    reason: candidate.reason,
  };
}

export async function executeProviderFeasibilityEvidencePointInvalidCaseV1(
  golden: ProviderFeasibilityEvidencePointGoldenManifestV1,
  invalid: ProviderFeasibilityEvidencePointInvalidManifestV1,
  invalidCase: ProviderFeasibilityEvidencePointInvalidCaseV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<ProviderFeasibilityEvidencePointInvalidCaseExecutionV1> {
  const prepared = prepareInvalidInputV1(
    golden,
    invalid,
    invalidCase,
    strictCryptoCapability,
  );
  if (prepared.mutateAfterStart !== undefined) {
    const pending = validateProviderFeasibilityEvidencePointClosureV1(
      prepared.input as ValidateProviderFeasibilityEvidencePointClosureV1Input,
    );
    prepared.mutateAfterStart();
    const value = await pending;
    assertRecursivelyFrozenV1(value);
    return {
      kind: "snapshot_acceptance",
      boundary: "snapshot_stability",
      authority: value.authority,
      snapshotProjection: snapshotProjectionV1(value),
    };
  }
  const diagnostic =
    await diagnoseProviderFeasibilityEvidencePointClosureV1(prepared.input);
  if (prepared.getterCalls() !== 0) {
    throw new Error(`${invalidCase.caseId} executed an attacker-owned getter`);
  }
  let publicFailure:
    | { readonly errorName: unknown; readonly code: unknown; readonly reason: unknown }
    | undefined;
  try {
    await validateProviderFeasibilityEvidencePointClosureV1(
      prepared.input as ValidateProviderFeasibilityEvidencePointClosureV1Input,
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

export async function verifyProviderFeasibilityEvidencePointGoldenResourceV1(
  bytes: Uint8Array,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<{
  readonly authority: "none_provider_feasibility_evidence_structure_only";
  readonly manifest: ProviderFeasibilityEvidencePointGoldenManifestV1;
  readonly pointClosure: ProviderFeasibilityEvidencePointClosureValidationV1;
}> {
  verifyResourceAnchorV1(
    bytes,
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
    "provider feasibility evidence point golden",
  );
  let manifest: ProviderFeasibilityEvidencePointGoldenManifestV1;
  try {
    manifest = ProviderFeasibilityEvidencePointGoldenManifestV1Schema.parse(
      parseJsonResourceV1(bytes, "provider feasibility evidence point golden"),
    );
  } catch (error) {
    if (error instanceof ProviderFeasibilityEvidencePointFixtureError) throw error;
    throw new ProviderFeasibilityEvidencePointFixtureError(
      "provider feasibility evidence point golden schema is invalid",
    );
  }
  const { semanticContentDigest: _semanticContentDigest, ...semanticFields } = manifest;
  if (
    semanticDigestV1(
      PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
      semanticFields,
    ) !== manifest.semanticContentDigest
  ) {
    throw new ProviderFeasibilityEvidencePointFixtureError(
      "provider feasibility evidence point golden semantic digest mismatch",
    );
  }
  const pointClosure = await validateProviderFeasibilityEvidencePointClosureV1(
    requestFromGoldenV1(manifest, strictCryptoCapability),
  );
  assertRecursivelyFrozenV1(pointClosure);
  const evidence = manifest.providerFeasibilityEvidence.payload;
  const evidenceIdFields = projectProviderFeasibilityEvidenceIdFieldsV1(evidence);
  const derivedEvidenceId = deriveProviderFeasibilityEvidenceIdV1(evidence);
  const derivedEvidenceContentDigest =
    deriveProviderFeasibilityEvidenceContentDigestV1(evidence);
  const derivedEvidencePin = deriveProviderFeasibilityEvidencePinV1(
    manifest.providerFeasibilityEvidence,
  );
  const derivedQaKeyId = deriveProviderFeasibilityApproverKeyIdV1({
    role: manifest.qaApproverPublicKey.role,
    publicKeyBytes: manifest.qaApproverPublicKey.publicKeyBytes,
  });
  const derivedReleaseKeyId = deriveProviderFeasibilityApproverKeyIdV1({
    role: manifest.releaseApproverPublicKey.role,
    publicKeyBytes: manifest.releaseApproverPublicKey.publicKeyBytes,
  });
  if (
    pointClosure.authority !== manifest.fixtureAuthority ||
    pointClosure.providerFeasibilityEvidence.evidenceId !==
      manifest.expected.evidenceId ||
    pointClosure.providerFeasibilityEvidence.contentDigest !==
      manifest.expected.evidenceContentDigest ||
    pointClosure.relativePath !== manifest.expected.evidenceRelativePath ||
    pointClosure.qaApproverPublicKey.keyId !== manifest.expected.qaApproverKeyId ||
    pointClosure.releaseApproverPublicKey.keyId !==
      manifest.expected.releaseApproverKeyId ||
    derivedEvidenceId !== manifest.expected.evidenceId ||
    derivedEvidenceContentDigest !== manifest.expected.evidenceContentDigest ||
    JSON.stringify(derivedEvidencePin) !==
      JSON.stringify(manifest.providerFeasibilityEvidencePin) ||
    bytesToLowerHexV1(
      canonicalizeJcsSafeIntegerUtf8V1([
        PROVIDER_FEASIBILITY_EVIDENCE_ID_DOMAIN_V1,
        evidenceIdFields,
      ]),
    ) !== manifest.expected.evidenceIdPreimageCanonicalUtf8Hex ||
    bytesToLowerHexV1(
      createProviderFeasibilityEvidenceQaSignatureMessageV1(
        evidence,
        manifest.qaApproverPublicKey.keyId,
      ),
    ) !== manifest.expected.qaSignatureMessageUtf8Hex ||
    bytesToLowerHexV1(
      createProviderFeasibilityEvidenceReleaseSignatureMessageV1(
        evidence,
        manifest.releaseApproverPublicKey.keyId,
      ),
    ) !== manifest.expected.releaseSignatureMessageUtf8Hex ||
    derivedQaKeyId !== manifest.expected.qaApproverKeyId ||
    derivedReleaseKeyId !== manifest.expected.releaseApproverKeyId ||
    deriveProviderEd25519PublicKeyDigestInternalV1(
      manifest.qaApproverPublicKey.publicKeyBytes,
    ) !== manifest.expected.qaApproverPublicKeyDigest ||
    deriveProviderEd25519PublicKeyDigestInternalV1(
      manifest.releaseApproverPublicKey.publicKeyBytes,
    ) !== manifest.expected.releaseApproverPublicKeyDigest
  ) {
    throw new ProviderFeasibilityEvidencePointFixtureError(
      "provider feasibility evidence point golden projection mismatch",
    );
  }
  return Object.freeze({
    authority: manifest.fixtureAuthority,
    manifest,
    pointClosure,
  });
}

export async function verifyProviderFeasibilityEvidencePointPositiveVectorsV1(
  manifest: ProviderFeasibilityEvidencePointGoldenManifestV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<readonly ProviderFeasibilityEvidencePointClosureValidationV1[]> {
  const positiveVectorClosures = [];
  for (let index = 0; index < manifest.positiveVectors.length; index += 1) {
    positiveVectorClosures.push(
      await verifyProviderFeasibilityEvidencePointPositiveVectorV1(
        manifest,
        index,
        strictCryptoCapability,
      ),
    );
  }
  return Object.freeze(positiveVectorClosures);
}

export async function verifyProviderFeasibilityEvidencePointPositiveVectorV1(
  manifest: ProviderFeasibilityEvidencePointGoldenManifestV1,
  index: number,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<ProviderFeasibilityEvidencePointClosureValidationV1> {
  if (!Number.isInteger(index) || index < 0 || index >= manifest.positiveVectors.length) {
    throw new ProviderFeasibilityEvidencePointFixtureError(
      "positive vector index is outside the frozen tuple",
    );
  }
  const vector = manifest.positiveVectors[index]!;
  const request = requestFromGoldenV1(manifest, strictCryptoCapability);
  const closure = await validateProviderFeasibilityEvidencePointClosureV1({
    ...request,
    realFilesystemConformanceResult: jsonCloneV1(
      vector.realFilesystemConformanceResult,
    ) as typeof request.realFilesystemConformanceResult,
    realFilesystemConformanceResultLocator: jsonCloneV1(
      vector.realFilesystemConformanceResultLocator,
    ) as typeof request.realFilesystemConformanceResultLocator,
    realFilesystemConformanceResultPin: jsonCloneV1(
      vector.realFilesystemConformanceResultPin,
    ) as typeof request.realFilesystemConformanceResultPin,
    runtimeAttestation: jsonCloneV1(
      vector.runtimeAttestation,
    ) as typeof request.runtimeAttestation,
    providerFeasibilityEvidence: jsonCloneV1(vector.providerFeasibilityEvidence),
    providerFeasibilityEvidencePin: jsonCloneV1(
      vector.providerFeasibilityEvidencePin,
    ),
  });
  if (
    closure.authority !== manifest.fixtureAuthority ||
    closure.providerFeasibilityEvidence.payload.result !== vector.result ||
    closure.providerFeasibilityEvidence.payload.issuedAt !== vector.issuedAt
  ) {
    throw new ProviderFeasibilityEvidencePointFixtureError(
      `positive vector ${vector.vectorId} projection mismatch`,
    );
  }
  return closure;
}

export function verifyProviderFeasibilityEvidencePointInvalidResourceV1(
  bytes: Uint8Array,
): ProviderFeasibilityEvidencePointInvalidManifestV1 {
  verifyResourceAnchorV1(
    bytes,
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
    "provider feasibility evidence point invalid corpus",
  );
  let manifest: ProviderFeasibilityEvidencePointInvalidManifestV1;
  try {
    manifest = ProviderFeasibilityEvidencePointInvalidManifestV1Schema.parse(
      parseJsonResourceV1(bytes, "provider feasibility evidence point invalid corpus"),
    ) as ProviderFeasibilityEvidencePointInvalidManifestV1;
  } catch (error) {
    if (error instanceof ProviderFeasibilityEvidencePointFixtureError) throw error;
    throw new ProviderFeasibilityEvidencePointFixtureError(
      "provider feasibility evidence point invalid corpus schema is invalid",
    );
  }
  const { semanticContentDigest: _semanticContentDigest, ...semanticFields } = manifest;
  if (
    semanticDigestV1(
      PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_DOMAIN_V1,
      semanticFields,
    ) !== manifest.semanticContentDigest
  ) {
    throw new ProviderFeasibilityEvidencePointFixtureError(
      "provider feasibility evidence point invalid semantic digest mismatch",
    );
  }
  return manifest;
}

void ProviderFeasibilityEvidencePointClosureValidationError;
