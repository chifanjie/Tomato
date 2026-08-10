import { z } from "./zod-runtime.js";

import { ProviderBootstrapTrustBundleV1Schema } from "./bootstrap-trust-bundle.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
} from "./primitives.js";
import { ProviderSignedDistributionRootBindingV1Schema } from "./provider-distribution-trust.js";
import {
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_AUTHORITY_V1,
  ProviderFeasibilityPublicSupportV1Schema,
  ProviderFeasibilityReleaseDispositionV1Schema,
  ProviderFeasibilitySupportCandidateArtifactV1Schema,
  ProviderFeasibilitySupportCatalogEnvelopeV1Schema,
  ProviderFeasibilitySupportCatalogPinV1Schema,
  ProviderFeasibilitySupportCatalogPointClosureValidationError,
  diagnoseProviderFeasibilitySupportCatalogPointClosureV1,
  validateProviderFeasibilitySupportCatalogPointClosureV1,
  type ProviderFeasibilitySupportCatalogPointClosureValidationV1,
  type ProviderFeasibilitySupportCatalogPointInvalidReasonV1,
  type ProviderFeasibilitySupportCatalogPointInvalidStageV1,
  type ValidateProviderFeasibilitySupportCatalogPointClosureV1Input,
} from "./provider-feasibility-support-catalog-point.js";
import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointFulfilledPromiseV1,
  createProviderPointRejectedPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
  ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
} from "./provider-real-filesystem-source.js";
import {
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
} from "./provider-real-filesystem-source-fixtures.js";
import { ProviderRegistryManifestEnvelopeV1Schema } from "./provider-registry-records.js";
import {
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
} from "./provider-registry-manifest-fixtures.js";
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

export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_PROFILE_V1 =
  "provider_feasibility_support_catalog_point_golden_v1" as const;
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_PROFILE_V1 =
  "provider_feasibility_support_catalog_point_invalid_v1" as const;
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_DOMAIN_V1 =
  "provider-feasibility-support-catalog-point-golden-manifest-v1" as const;
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_SEMANTIC_DOMAIN_V1 =
  "provider-feasibility-support-catalog-point-invalid-manifest-v1" as const;
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1 =
  "provider-feasibility-support-catalog-point-invalid-materialized-request-v1" as const;
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_PATH_V1 =
  "fixtures/v1/golden/provider-feasibility-support-catalog-point-v1.json" as const;
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_RESOURCE_PATH_V1 =
  "fixtures/v1/invalid/provider-feasibility-support-catalog-point-v1.json" as const;

export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1 =
  1_069_680 as const;
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1 =
  "2e7b8a9fb9c98e98a8f317c1b8800c52d9abae6936d04dd3a7d1dd6701f4de06" as const;
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:ae9301bfd01e6dfe9c1e9f0f96257c05b4d66c17be737664674376fe363cd2c1" as const;
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1 =
  1_862_735 as const;
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_RESOURCE_SHA256_HEX_V1 =
  "a8171a5bdaf1ae950b10aec00954e4ad504505025e04efd50b6d875bdbf50ca9" as const;
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:9220ed6c985e59fa3498e63f24864712760c138b6482dd7febf3a4237208ac8e" as const;
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_FIXTURE_MAX_BYTES_V1 =
  16_777_216 as const;

const POSITIVE_VECTOR_IDS_V1 = [
  "both-passed-strong",
  "second-passed-read-only",
  "second-failed-read-only",
  "second-unsupported-read-only",
] as const;
const INVALID_CASE_DEFINITIONS_V1 = [
  ["catalog-target-missing", "catalog_target_exact_cover", "coverage_mismatch", 50, 90],
  ["catalog-target-extra", "catalog_target_exact_cover", "coverage_mismatch", 50, 90],
  ["catalog-target-duplicate", "catalog_target_order", "ordering_invalid", 50, 90],
  ["catalog-provider-duplicate", "catalog_candidate_order", "ordering_invalid", 50, 90],
  ["catalog-evidence-cross-group", "catalog_candidate_binding", "binding_mismatch", 50, 90],
  ["catalog-failed-strong", "catalog_release_disposition", "result_not_passed", 62, 126],
  ["catalog-unsupported-strong", "catalog_release_disposition", "result_not_passed", 62, 126],
] as const;

export type ProviderFeasibilitySupportCatalogPointPositiveVectorIdV1 =
  (typeof POSITIVE_VECTOR_IDS_V1)[number];
export type ProviderFeasibilitySupportCatalogPointInvalidCaseIdV1 =
  (typeof INVALID_CASE_DEFINITIONS_V1)[number][0];

export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_POSITIVE_VECTOR_IDS_V1:
  readonly ProviderFeasibilitySupportCatalogPointPositiveVectorIdV1[] =
  Object.freeze([...POSITIVE_VECTOR_IDS_V1]);
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_CASE_IDS_V1:
  readonly ProviderFeasibilitySupportCatalogPointInvalidCaseIdV1[] =
  Object.freeze(INVALID_CASE_DEFINITIONS_V1.map((entry) => entry[0]));

const NonnegativeSafeIntegerV1Schema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
const ResourceSha256HexV1Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const RelativePathV1Schema = z
  .string()
  .regex(/^provider\/support-catalog\/(?:id-[0-9a-v]+|idh-[0-9a-f]{64})\.json$/u);

export const ProviderFeasibilitySupportCatalogPointJsonRequestV1Schema =
  z.strictObject({
    activeRoot: ProviderRegistryRootPublicKeyV1Schema,
    activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
    bootstrapTrustBundle: ProviderBootstrapTrustBundleV1Schema,
    distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
    fixtureCorpusManifest:
      ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    providerFeasibilitySupportCandidateArtifacts: z
      .array(ProviderFeasibilitySupportCandidateArtifactV1Schema)
      .length(2),
    providerFeasibilitySupportCatalog:
      ProviderFeasibilitySupportCatalogEnvelopeV1Schema,
    publicSupportTaxonomy:
      ProviderPublicSupportTaxonomyEnvelopeV1Schema,
    registryManifestHistory: z.array(ProviderRegistryManifestEnvelopeV1Schema),
    releaseMatrix: ProviderReleaseMatrixEnvelopeV1Schema,
    releaseTargetUniverse: ProviderReleaseTargetUniverseEnvelopeV1Schema,
    rootMetadataHistory: z.array(
      ProviderRegistryRootMetadataEnvelopeV1Schema,
    ),
    suiteManifest: ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
    targetDiscoveryFixtureManifest:
      ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema,
    targetDiscoveryResult: ProviderTargetDiscoveryResultEnvelopeV1Schema,
    targetDiscoveryRunnerRun:
      ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema,
  });
export type ProviderFeasibilitySupportCatalogPointJsonRequestV1 = z.infer<
  typeof ProviderFeasibilitySupportCatalogPointJsonRequestV1Schema
>;

const OwnerTargetCapabilityV1Schema = z.strictObject({
  target: ProviderFeasibilityTargetV1Schema,
  capability: ProviderFeasibilityReleaseDispositionV1Schema,
});
const CryptoCountsV1Schema = z.strictObject({
  pointAdmissionCount: NonnegativeSafeIntegerV1Schema,
  signatureVerificationCount: NonnegativeSafeIntegerV1Schema,
});
export type ProviderFeasibilitySupportCatalogPointCryptoCountsV1 = z.infer<
  typeof CryptoCountsV1Schema
>;
const ProjectionV1Schema = z.strictObject({
  authority: z.literal(PROVIDER_FEASIBILITY_SUPPORT_CATALOG_AUTHORITY_V1),
  ownerTargetCapabilities: z.tuple([
    OwnerTargetCapabilityV1Schema,
    OwnerTargetCapabilityV1Schema,
  ]),
  publicSupport: z.tuple([ProviderFeasibilityPublicSupportV1Schema]),
  providerFeasibilitySupportCatalogContentDigest: ContentDigestV1Schema,
  providerFeasibilitySupportCatalogPin:
    ProviderFeasibilitySupportCatalogPinV1Schema,
  relativePath: RelativePathV1Schema,
  targetCount: z.literal(2),
  candidateCount: z.literal(2),
  publicSupportRowCount: z.literal(1),
});
export type ProviderFeasibilitySupportCatalogPointProjectionV1 = z.infer<
  typeof ProjectionV1Schema
>;

function positiveVectorSchemaV1(
  vectorId: ProviderFeasibilitySupportCatalogPointPositiveVectorIdV1,
) {
  return z.strictObject({
    vectorId: z.literal(vectorId),
    request: ProviderFeasibilitySupportCatalogPointJsonRequestV1Schema,
    expected: z.strictObject({
      projection: ProjectionV1Schema,
      cryptoCounts: z.strictObject({
        pointAdmissionCount: z.literal(31),
        signatureVerificationCount: z.literal(64),
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

export const ProviderFeasibilitySupportCatalogPointGoldenManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_PROFILE_V1,
    ),
    fixtureAuthority: z.literal(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_AUTHORITY_V1,
    ),
    canonicalizationProfile: z.literal("rfc8785-jcs-safe-integer-v1"),
    verificationProfile: z.literal(
      "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
    ),
    positiveVectors: z.tuple([
      positiveVectorSchemaV1("both-passed-strong"),
      positiveVectorSchemaV1("second-passed-read-only"),
      positiveVectorSchemaV1("second-failed-read-only"),
      positiveVectorSchemaV1("second-unsupported-read-only"),
    ]),
    semanticDomain: z.literal(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
    ),
    dependencies: z.strictObject({
      rootHistoryGolden: DependencyAnchorV1Schema.extend({
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
      registryManifestGolden: DependencyAnchorV1Schema.extend({
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
      realFilesystemSourceGolden: DependencyAnchorV1Schema.extend({
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
    semanticContentDigest: ContentDigestV1Schema,
  });
export type ProviderFeasibilitySupportCatalogPointGoldenManifestV1 = z.infer<
  typeof ProviderFeasibilitySupportCatalogPointGoldenManifestV1Schema
>;

const PublicFailureV1Schema = z.strictObject({
  errorName: z.literal(
    "ProviderFeasibilitySupportCatalogPointClosureValidationError",
  ),
  code: z.literal("provider_unavailable"),
  reason: z.literal("attestation_invalid"),
});

function invalidCaseSchemaV1(
  caseId: ProviderFeasibilitySupportCatalogPointInvalidCaseIdV1,
  stage: ProviderFeasibilitySupportCatalogPointInvalidStageV1,
  reason: ProviderFeasibilitySupportCatalogPointInvalidReasonV1,
  pointAdmissionCount: 50 | 62,
  signatureVerificationCount: 90 | 126,
) {
  return z.strictObject({
    caseId: z.literal(caseId),
    request: ProviderFeasibilitySupportCatalogPointJsonRequestV1Schema,
    expected: z.strictObject({
      stage: z.literal(stage),
      reason: z.literal(reason),
      publicFailure: PublicFailureV1Schema,
      cryptoCounts: z.strictObject({
        pointAdmissionCount: z.literal(pointAdmissionCount),
        signatureVerificationCount: z.literal(signatureVerificationCount),
      }),
      materializedRequestSemanticDigest: ContentDigestV1Schema,
    }),
  });
}

export const ProviderFeasibilitySupportCatalogPointInvalidManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_PROFILE_V1,
    ),
    fixtureAuthority: z.literal(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_AUTHORITY_V1,
    ),
    canonicalizationProfile: z.literal("rfc8785-jcs-safe-integer-v1"),
    verificationProfile: z.literal(
      "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
    ),
    cases: z.tuple(
      INVALID_CASE_DEFINITIONS_V1.map(
        ([caseId, stage, reason, pointAdmissionCount, signatureVerificationCount]) =>
          invalidCaseSchemaV1(
            caseId,
            stage,
            reason,
            pointAdmissionCount,
            signatureVerificationCount,
          ),
      ) as unknown as [
        ReturnType<typeof invalidCaseSchemaV1>,
        ReturnType<typeof invalidCaseSchemaV1>,
        ReturnType<typeof invalidCaseSchemaV1>,
        ReturnType<typeof invalidCaseSchemaV1>,
        ReturnType<typeof invalidCaseSchemaV1>,
        ReturnType<typeof invalidCaseSchemaV1>,
        ReturnType<typeof invalidCaseSchemaV1>,
      ],
    ),
    semanticDomain: z.literal(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_SEMANTIC_DOMAIN_V1,
    ),
    dependencies: z.strictObject({
      goldenResourcePath: z.literal(
        PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_PATH_V1,
      ),
      goldenResourceByteLength: z.literal(
        PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
      ),
      goldenResourceSha256Hex: z.literal(
        PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
      ),
      goldenSemanticContentDigest: z.literal(
        PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
      ),
    }),
    materializedRequestDomain: z.literal(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
    ),
    semanticContentDigest: ContentDigestV1Schema,
  });
export type ProviderFeasibilitySupportCatalogPointInvalidManifestV1 = z.infer<
  typeof ProviderFeasibilitySupportCatalogPointInvalidManifestV1Schema
>;

const CapturedArrayPrototypePushV1 = Array.prototype.push;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedJsonParseV1 = JSON.parse;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedNumberPrototypeToStringV1 = Number.prototype.toString;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedReflectApplyV1 = Reflect.apply;
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
  return CapturedReflectApplyV1(
    CapturedFunctionPrototypeBindV1,
    CapturedFunctionPrototypeCallV1,
    CapturedObjectFreezeV1([method]),
  ) as Function;
}

const arrayPushV1 = uncurryFixtureMethodV1(
  CapturedArrayPrototypePushV1,
) as <T>(array: T[], value: T) => number;
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

export function deriveProviderFeasibilitySupportCatalogPointFixtureSemanticContentDigestV1(
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
      throw new ProviderFeasibilitySupportCatalogPointFixtureError(
        "Catalog fixture closure contains a mutable object",
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
    throw new ProviderFeasibilitySupportCatalogPointFixtureError(
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
        PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_FIXTURE_MAX_BYTES_V1 ||
      bytes.byteLength !== expectedByteLength ||
      rawSha256HexV1(bytes) !== expectedSha256Hex
    ) {
      throw new CapturedTypeErrorV1("anchor mismatch");
    }
  } catch {
    throw new ProviderFeasibilitySupportCatalogPointFixtureError(
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
    deriveProviderFeasibilitySupportCatalogPointFixtureSemanticContentDigestV1(
      domain,
      semanticFields,
    ) !== manifest.semanticContentDigest
  ) {
    throw new ProviderFeasibilitySupportCatalogPointFixtureError(
      `${label} semantic digest mismatch`,
    );
  }
}

export class ProviderFeasibilitySupportCatalogPointFixtureError extends CapturedTypeErrorV1 {}

export function projectProviderFeasibilitySupportCatalogPointFixtureClosureV1(
  closure: ProviderFeasibilitySupportCatalogPointClosureValidationV1,
): ProviderFeasibilitySupportCatalogPointProjectionV1 {
  if (
    closure.ownerTargetCapabilities.length !== 2 ||
    closure.publicSupport.length !== 1 ||
    closure.targetCount !== 2 ||
    closure.candidateCount !== 2 ||
    closure.publicSupportRowCount !== 1
  ) {
    throw new ProviderFeasibilitySupportCatalogPointFixtureError(
      "Catalog fixture closure is not the exact 2/2/1 projection",
    );
  }
  return createProviderNonThenableFrozenRecordV1({
    authority: closure.authority,
    ownerTargetCapabilities:
      closure.ownerTargetCapabilities as unknown as
        ProviderFeasibilitySupportCatalogPointProjectionV1["ownerTargetCapabilities"],
    publicSupport: closure.publicSupport as ProviderFeasibilitySupportCatalogPointProjectionV1["publicSupport"],
    providerFeasibilitySupportCatalogContentDigest:
      closure.providerFeasibilitySupportCatalog.contentDigest,
    providerFeasibilitySupportCatalogPin:
      closure.providerFeasibilitySupportCatalogPin,
    relativePath: closure.relativePath,
    targetCount: closure.targetCount as 2,
    candidateCount: closure.candidateCount as 2,
    publicSupportRowCount: closure.publicSupportRowCount as 1,
  });
}

function requestWithCapabilityV1(
  request: ProviderFeasibilitySupportCatalogPointJsonRequestV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): ValidateProviderFeasibilitySupportCatalogPointClosureV1Input {
  const detached = jsonCloneV1(request) as Record<PropertyKey, unknown>;
  const keys = CapturedReflectOwnKeysV1(detached);
  if (keys.length !== 17) {
    throw new ProviderFeasibilitySupportCatalogPointFixtureError(
      "Catalog fixture JSON request is not the exact 17-key shape",
    );
  }
  for (let index = 0; index < keys.length; index += 1) {
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
      detached,
      keys[index]!,
    );
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new ProviderFeasibilitySupportCatalogPointFixtureError(
        "Catalog fixture request contains a non-data property",
      );
    }
    deepFreezeFixtureValueV1(descriptor.value);
  }
  CapturedObjectDefinePropertyV1(detached, "strictCryptoCapability", {
    value: strictCryptoCapability,
    enumerable: true,
    configurable: false,
    writable: false,
  });
  CapturedObjectFreezeV1(detached);
  if (CapturedReflectOwnKeysV1(detached).length !== 18) {
    throw new ProviderFeasibilitySupportCatalogPointFixtureError(
      "Catalog fixture runtime request is not the exact 18-key shape",
    );
  }
  return detached as unknown as ValidateProviderFeasibilitySupportCatalogPointClosureV1Input;
}

function assertVerifiedGoldenManifestV1(
  manifest: ProviderFeasibilitySupportCatalogPointGoldenManifestV1,
): void {
  if (!weakSetHasV1(verifiedGoldenManifestsV1, manifest)) {
    throw new ProviderFeasibilitySupportCatalogPointFixtureError(
      "Catalog golden manifest was not admitted from its anchored resource",
    );
  }
}

function assertVerifiedInvalidManifestV1(
  manifest: ProviderFeasibilitySupportCatalogPointInvalidManifestV1,
): void {
  if (!weakSetHasV1(verifiedInvalidManifestsV1, manifest)) {
    throw new ProviderFeasibilitySupportCatalogPointFixtureError(
      "Catalog invalid manifest was not admitted from its anchored resource",
    );
  }
}

export function verifyProviderFeasibilitySupportCatalogPointGoldenResourceV1(
  bytes: Uint8Array,
): ProviderFeasibilitySupportCatalogPointGoldenManifestV1 {
  verifyResourceAnchorV1(
    bytes,
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
    "Catalog point golden",
  );
  let manifest: ProviderFeasibilitySupportCatalogPointGoldenManifestV1;
  try {
    manifest = ProviderFeasibilitySupportCatalogPointGoldenManifestV1Schema.parse(
      parseJsonResourceV1(bytes, "Catalog point golden"),
    );
  } catch (error) {
    if (error instanceof ProviderFeasibilitySupportCatalogPointFixtureError) {
      throw error;
    }
    throw new ProviderFeasibilitySupportCatalogPointFixtureError(
      "Catalog point golden schema is invalid",
    );
  }
  verifySemanticDigestV1(
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
    manifest,
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    "Catalog point golden",
  );
  deepFreezeFixtureValueV1(manifest);
  weakSetAddV1(verifiedGoldenManifestsV1, manifest);
  return manifest;
}

export function verifyProviderFeasibilitySupportCatalogPointInvalidResourceV1(
  bytes: Uint8Array,
): ProviderFeasibilitySupportCatalogPointInvalidManifestV1 {
  verifyResourceAnchorV1(
    bytes,
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
    "Catalog point invalid corpus",
  );
  let manifest: ProviderFeasibilitySupportCatalogPointInvalidManifestV1;
  try {
    manifest = ProviderFeasibilitySupportCatalogPointInvalidManifestV1Schema.parse(
      parseJsonResourceV1(bytes, "Catalog point invalid corpus"),
    );
  } catch (error) {
    if (error instanceof ProviderFeasibilitySupportCatalogPointFixtureError) {
      throw error;
    }
    throw new ProviderFeasibilitySupportCatalogPointFixtureError(
      "Catalog point invalid corpus schema is invalid",
    );
  }
  verifySemanticDigestV1(
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_SEMANTIC_DOMAIN_V1,
    manifest,
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
    "Catalog point invalid corpus",
  );
  for (let index = 0; index < manifest.cases.length; index += 1) {
    const invalidCase = manifest.cases[index]!;
    if (
      deriveProviderFeasibilitySupportCatalogPointFixtureSemanticContentDigestV1(
        PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
        invalidCase.request,
      ) !== invalidCase.expected.materializedRequestSemanticDigest
    ) {
      throw new ProviderFeasibilitySupportCatalogPointFixtureError(
        "Catalog invalid materialized request semantic digest mismatch",
      );
    }
  }
  deepFreezeFixtureValueV1(manifest);
  weakSetAddV1(verifiedInvalidManifestsV1, manifest);
  return manifest;
}

function positiveVectorExecutionV1(
  manifest: ProviderFeasibilitySupportCatalogPointGoldenManifestV1,
  index: number,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
) {
  const vector = manifest.positiveVectors[index];
  if (vector === undefined) {
    return createProviderPointRejectedPromiseV1(
      new ProviderFeasibilitySupportCatalogPointFixtureError(
        "Catalog positive vector index is outside the exact tuple",
      ),
    );
  }
  let pending: Promise<ProviderFeasibilitySupportCatalogPointClosureValidationV1>;
  try {
    pending = validateProviderFeasibilitySupportCatalogPointClosureV1(
      requestWithCapabilityV1(vector.request, strictCryptoCapability),
    );
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }
  return pending.then((closure) => {
    assertRecursivelyFrozenFixtureV1(closure);
    const projection =
      projectProviderFeasibilitySupportCatalogPointFixtureClosureV1(closure);
    if (!canonicalEqualFixtureV1(projection, vector.expected.projection)) {
      throw new ProviderFeasibilitySupportCatalogPointFixtureError(
        `Catalog positive vector ${vector.vectorId} projection mismatch`,
      );
    }
    return createProviderNonThenableFrozenRecordV1({
      vectorId: vector.vectorId,
      closure,
      cryptoCounts: vector.expected.cryptoCounts,
    });
  });
}

export function verifyProviderFeasibilitySupportCatalogPointPositiveVectorsV1(
  manifest: ProviderFeasibilitySupportCatalogPointGoldenManifestV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<{
  readonly vectors: readonly {
    readonly vectorId: ProviderFeasibilitySupportCatalogPointPositiveVectorIdV1;
    readonly closure: ProviderFeasibilitySupportCatalogPointClosureValidationV1;
    readonly cryptoCounts: ProviderFeasibilitySupportCatalogPointCryptoCountsV1;
  }[];
  readonly cryptoCounts: ProviderFeasibilitySupportCatalogPointCryptoCountsV1;
}> {
  try {
    assertVerifiedGoldenManifestV1(manifest);
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }
  let chain = createProviderPointFulfilledPromiseV1(
    [] as Array<{
      readonly vectorId: ProviderFeasibilitySupportCatalogPointPositiveVectorIdV1;
      readonly closure: ProviderFeasibilitySupportCatalogPointClosureValidationV1;
      readonly cryptoCounts: ProviderFeasibilitySupportCatalogPointCryptoCountsV1;
    }>,
  );
  for (let index = 0; index < manifest.positiveVectors.length; index += 1) {
    chain = chain.then((vectors) =>
      positiveVectorExecutionV1(
        manifest,
        index,
        strictCryptoCapability,
      ).then((execution) => {
        arrayPushV1(vectors, execution);
        return vectors;
      }),
    );
  }
  return chain.then((vectors) => {
    let pointAdmissionCount = 0;
    let signatureVerificationCount = 0;
    for (let index = 0; index < vectors.length; index += 1) {
      pointAdmissionCount += vectors[index]!.cryptoCounts.pointAdmissionCount;
      signatureVerificationCount +=
        vectors[index]!.cryptoCounts.signatureVerificationCount;
    }
    if (
      !CapturedNumberIsSafeIntegerV1(pointAdmissionCount) ||
      !CapturedNumberIsSafeIntegerV1(signatureVerificationCount)
    ) {
      throw new ProviderFeasibilitySupportCatalogPointFixtureError(
        "Catalog positive crypto count aggregate is unsafe",
      );
    }
    return createProviderNonThenableFrozenRecordV1({
      vectors: CapturedObjectFreezeV1(vectors),
      cryptoCounts: createProviderNonThenableFrozenRecordV1({
        pointAdmissionCount,
        signatureVerificationCount,
      }),
    });
  });
}

function findInvalidCaseV1(
  manifest: ProviderFeasibilitySupportCatalogPointInvalidManifestV1,
  caseId: ProviderFeasibilitySupportCatalogPointInvalidCaseIdV1,
) {
  if (typeof caseId !== "string") {
    throw new ProviderFeasibilitySupportCatalogPointFixtureError(
      "Catalog invalid case identifier is not a string",
    );
  }
  for (let index = 0; index < manifest.cases.length; index += 1) {
    const candidate = manifest.cases[index]!;
    if (candidate.caseId === caseId) return candidate;
  }
  throw new ProviderFeasibilitySupportCatalogPointFixtureError(
    "unknown Catalog invalid case",
  );
}

export function materializeProviderFeasibilitySupportCatalogPointInvalidCaseRequestV1(
  manifest: ProviderFeasibilitySupportCatalogPointInvalidManifestV1,
  caseId: ProviderFeasibilitySupportCatalogPointInvalidCaseIdV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): ValidateProviderFeasibilitySupportCatalogPointClosureV1Input {
  assertVerifiedInvalidManifestV1(manifest);
  return requestWithCapabilityV1(
    findInvalidCaseV1(manifest, caseId).request,
    strictCryptoCapability,
  );
}

export function executeProviderFeasibilitySupportCatalogPointInvalidCaseV1(
  manifest: ProviderFeasibilitySupportCatalogPointInvalidManifestV1,
  caseId: ProviderFeasibilitySupportCatalogPointInvalidCaseIdV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<{
  readonly caseId: ProviderFeasibilitySupportCatalogPointInvalidCaseIdV1;
  readonly stage: ProviderFeasibilitySupportCatalogPointInvalidStageV1;
  readonly reason: ProviderFeasibilitySupportCatalogPointInvalidReasonV1;
  readonly publicFailure: {
    readonly errorName: "ProviderFeasibilitySupportCatalogPointClosureValidationError";
    readonly code: "provider_unavailable";
    readonly reason: "attestation_invalid";
  };
  readonly cryptoCounts: ProviderFeasibilitySupportCatalogPointCryptoCountsV1;
}> {
  let invalidCase: ProviderFeasibilitySupportCatalogPointInvalidManifestV1["cases"][number];
  let diagnosticPending;
  try {
    assertVerifiedInvalidManifestV1(manifest);
    invalidCase = findInvalidCaseV1(manifest, caseId);
    diagnosticPending = diagnoseProviderFeasibilitySupportCatalogPointClosureV1(
      requestWithCapabilityV1(
        invalidCase.request,
        strictCryptoCapability,
      ),
    );
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }
  return diagnosticPending.then((diagnostic) => {
    if (
      diagnostic.ok ||
      diagnostic.stage !== invalidCase.expected.stage ||
      diagnostic.reason !== invalidCase.expected.reason
    ) {
      throw new ProviderFeasibilitySupportCatalogPointFixtureError(
        `${caseId} diagnostic drift`,
      );
    }
    let publicPending: Promise<ProviderFeasibilitySupportCatalogPointClosureValidationV1>;
    try {
      publicPending = validateProviderFeasibilitySupportCatalogPointClosureV1(
        requestWithCapabilityV1(
          invalidCase.request,
          strictCryptoCapability,
        ),
      );
    } catch (error) {
      return createProviderPointRejectedPromiseV1(error);
    }
    return publicPending.then(
      () => {
        throw new ProviderFeasibilitySupportCatalogPointFixtureError(
          `${caseId} was unexpectedly accepted`,
        );
      },
      (error) => {
        if (
          !(error instanceof
            ProviderFeasibilitySupportCatalogPointClosureValidationError) ||
          error.name !== invalidCase.expected.publicFailure.errorName ||
          error.code !== invalidCase.expected.publicFailure.code ||
          error.reason !== invalidCase.expected.publicFailure.reason
        ) {
          throw new ProviderFeasibilitySupportCatalogPointFixtureError(
            `${caseId} public rejection drift`,
          );
        }
        return createProviderNonThenableFrozenRecordV1({
          caseId,
          stage: invalidCase.expected.stage,
          reason: invalidCase.expected.reason,
          publicFailure: invalidCase.expected.publicFailure,
          cryptoCounts: invalidCase.expected.cryptoCounts,
        });
      },
    );
  });
}

CapturedObjectFreezeV1(
  deriveProviderFeasibilitySupportCatalogPointFixtureSemanticContentDigestV1,
);
CapturedObjectFreezeV1(
  projectProviderFeasibilitySupportCatalogPointFixtureClosureV1,
);
CapturedObjectFreezeV1(
  verifyProviderFeasibilitySupportCatalogPointGoldenResourceV1,
);
CapturedObjectFreezeV1(
  verifyProviderFeasibilitySupportCatalogPointPositiveVectorsV1,
);
CapturedObjectFreezeV1(
  verifyProviderFeasibilitySupportCatalogPointInvalidResourceV1,
);
CapturedObjectFreezeV1(
  materializeProviderFeasibilitySupportCatalogPointInvalidCaseRequestV1,
);
CapturedObjectFreezeV1(
  executeProviderFeasibilitySupportCatalogPointInvalidCaseV1,
);
