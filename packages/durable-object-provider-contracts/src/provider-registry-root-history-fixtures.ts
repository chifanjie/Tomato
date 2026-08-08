import { z } from "./zod-runtime.js";

import {
  ProviderBootstrapTrustBundleV1Schema,
} from "./bootstrap-trust-bundle.js";
import {
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
import {
  ContentDigestV1Schema,
} from "./primitives.js";
import {
  ProviderRegistryRootMetadataEnvelopeV1Schema,
  ProviderRegistryRootMetadataPinV1Schema,
} from "./provider-registry-trust.js";
import { sha256InternalV1 } from "./sha256.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
} from "./strict-ed25519.js";
import {
  PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_CASE_DEFINITIONS_V1,
  type ProviderRegistryRootHistoryInvalidCaseDefinitionV1,
  type ProviderRegistryRootHistoryInvalidSeedV1,
} from "./provider-registry-root-history-invalid-definitions.js";

export const PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1 =
  "fixtures/v1/golden/provider-registry-root-history-v1.json" as const;
export const PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RESOURCE_PATH_V1 =
  "fixtures/v1/invalid/provider-registry-root-history-v1.json" as const;
export const PROVIDER_REGISTRY_ROOT_HISTORY_FIXTURE_MAX_BYTES_V1 =
  4_194_304;
export const PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_PROFILE_V1 =
  "provider_registry_root_history_golden_manifest_v1" as const;
export const PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_PROFILE_V1 =
  "provider_registry_root_history_invalid_manifest_v1" as const;
export const PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_DOMAIN_V1 =
  "provider-registry-root-history-golden-manifest-v1" as const;
export const PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_SEMANTIC_DOMAIN_V1 =
  "provider-registry-root-history-invalid-manifest-v1" as const;

/*
 * Keep these six anchors synchronized with the two checked-in resources when
 * regenerating the fixture corpus. Raw-byte identity and semantic JCS identity
 * are intentionally independent anchors.
 */
export const PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1 =
  38_568;
export const PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1 =
  "3f4a86c2dedf36e0d8b19859f34937d439423d7223d44cfe49196d015f7dfca6";
export const PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1 =
  ContentDigestV1Schema.parse(
    "sha256:a57984671d7761e19a3fa04c704d7147bb8e3809994c554b46ca8c0dc7b3f922",
  );
export const PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1 =
  24_574;
export const PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1 =
  "5449605ba46f872f2bf19131b5114f449e879b0ab23e19bd41126e21e17d75cc";
export const PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1 =
  ContentDigestV1Schema.parse(
    "sha256:d20735dc3d5f06a9cc12e990b72f11cf3a6e6a1f7561552b763b21fb4816cdab",
  );

const LowerHexBytesV1Schema = z.string().regex(/^(?:[0-9a-f]{2})+$/u);
const LowerHex32BytesV1Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const RootHistoryRelativeLocatorV1Schema = z
  .string()
  .regex(
    /^provider\/root-metadata\/(?:id-(?=[0-9a-v]{2,220}\.json$)(?:[0-9a-v]{8})*(?:[0-9a-v][048cgkos]|[0-9a-v]{3}[0g]|[0-9a-v]{4}[02468acegikmoqsu]|[0-9a-v]{6}[08go])?|idh-[0-9a-f]{64})\.json$/u,
  );

const ProviderRegistryRootHistoryDeterministicSeedsV1Schema =
  z.strictObject({
    purpose: z.literal("non_production_fixture_only"),
    bootstrapRootSeedHex: LowerHex32BytesV1Schema,
    plannedRootSeedHex: LowerHex32BytesV1Schema,
    compromiseRootSeedHex: LowerHex32BytesV1Schema,
    recoverySeedHexes: z.tuple([
      LowerHex32BytesV1Schema,
      LowerHex32BytesV1Schema,
      LowerHex32BytesV1Schema,
    ]),
  });

const ProviderRegistryRootHistoryRecoveryMessageV1Schema =
  z.strictObject({
    recoveryKeyId: z.string().regex(/^[0-9a-f]{22}$/u),
    canonicalMessageUtf8Hex: LowerHexBytesV1Schema,
  });

const ProviderRegistryRootHistoryGoldenVectorCommonV1Schema =
  z.strictObject({
    rootGeneration: z.number().int().min(1).max(3),
    activation: z.enum([
      "bootstrap",
      "planned_rollover",
      "compromise_recovery",
    ]),
    unsignedClaimsCanonicalUtf8Hex: LowerHexBytesV1Schema,
    selfSignatureMessageUtf8Hex: LowerHexBytesV1Schema,
    envelopeCanonicalUtf8Hex: LowerHexBytesV1Schema,
    contentDigest: ContentDigestV1Schema,
    locator: RootHistoryRelativeLocatorV1Schema,
  });

const ProviderRegistryRootHistoryBootstrapGoldenVectorV1Schema =
  ProviderRegistryRootHistoryGoldenVectorCommonV1Schema.extend({
    rootGeneration: z.literal(1),
    activation: z.literal("bootstrap"),
  });
const ProviderRegistryRootHistoryPlannedGoldenVectorV1Schema =
  ProviderRegistryRootHistoryGoldenVectorCommonV1Schema.extend({
    rootGeneration: z.literal(2),
    activation: z.literal("planned_rollover"),
    predecessorCrossSignatureMessageUtf8Hex:
      LowerHexBytesV1Schema,
    recoverySignatureMessages: z.tuple([
      ProviderRegistryRootHistoryRecoveryMessageV1Schema,
      ProviderRegistryRootHistoryRecoveryMessageV1Schema,
    ]),
  });
const ProviderRegistryRootHistoryCompromiseGoldenVectorV1Schema =
  ProviderRegistryRootHistoryGoldenVectorCommonV1Schema.extend({
    rootGeneration: z.literal(3),
    activation: z.literal("compromise_recovery"),
    recoverySignatureMessages: z.tuple([
      ProviderRegistryRootHistoryRecoveryMessageV1Schema,
      ProviderRegistryRootHistoryRecoveryMessageV1Schema,
    ]),
  });

export const ProviderRegistryRootHistoryGoldenManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_PROFILE_V1,
    ),
    canonicalizationProfile: z.literal(
      RFC8785_JCS_SAFE_INTEGER_PROFILE_V1,
    ),
    verificationProfile: z.literal(
      STRICT_ED25519_VERIFICATION_PROFILE_V1,
    ),
    fixtureAuthority: z.literal(
      "none_structure_and_history_only",
    ),
    deterministicSeeds:
      ProviderRegistryRootHistoryDeterministicSeedsV1Schema,
    bootstrapTrustBundle: ProviderBootstrapTrustBundleV1Schema,
    rootMetadataHistory: z.tuple([
      ProviderRegistryRootMetadataEnvelopeV1Schema,
      ProviderRegistryRootMetadataEnvelopeV1Schema,
      ProviderRegistryRootMetadataEnvelopeV1Schema,
    ]),
    expected: z.strictObject({
      rootMetadataCount: z.literal(3),
      canonicalEnvelopeLogicalBytes: z.number().int().min(1),
      currentRootMetadata:
        ProviderRegistryRootMetadataPinV1Schema,
      vectors: z.tuple([
        ProviderRegistryRootHistoryBootstrapGoldenVectorV1Schema,
        ProviderRegistryRootHistoryPlannedGoldenVectorV1Schema,
        ProviderRegistryRootHistoryCompromiseGoldenVectorV1Schema,
      ]),
    }),
  });
export type ProviderRegistryRootHistoryGoldenManifestV1 = z.infer<
  typeof ProviderRegistryRootHistoryGoldenManifestV1Schema
>;

export const PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_CASE_IDS_V1 =
  Object.freeze(
    PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_CASE_DEFINITIONS_V1.map(
      ({ caseId }) => caseId,
    ),
  );

export const ProviderRegistryRootHistoryInvalidStageV1Schema =
  z.enum([
    "history_input",
    "history_limit",
    "bootstrap_anchor",
    "root_metadata_envelope",
    "root_key_admission",
    "history_predecessor",
    "root_self_signature",
    "root_cross_signature",
    "root_recovery_signature",
    "root_material_closure",
  ]);
export const ProviderRegistryRootHistoryInvalidReasonV1Schema =
  z.enum([
    "schema_invalid",
    "history_empty",
    "history_generation_limit_exceeded",
    "envelope_byte_limit_exceeded",
    "history_total_byte_limit_exceeded",
    "bootstrap_metadata_mismatch",
    "envelope_mismatch",
    "generation_not_contiguous",
    "predecessor_pin_mismatch",
    "point_admission_failed",
    "self_signature_invalid",
    "cross_signature_invalid",
    "recovery_quorum_invalid",
    "root_key_material_alias",
  ]);

function invalidSeedSchemaV1(
  definition: ProviderRegistryRootHistoryInvalidSeedV1,
): z.ZodType<ProviderRegistryRootHistoryInvalidSeedV1> {
  if (definition.source === "none") {
    return z.strictObject({
      source: z.literal("none"),
    });
  }
  if (definition.source === "literal_non_production") {
    return z.strictObject({
      source: z.literal("literal_non_production"),
      seedHex: z.literal(definition.seedHex),
    });
  }
  return z.strictObject({
    source: z.literal("golden_json_pointer"),
    resourcePath: z.literal(definition.resourcePath),
    jsonPointer: z.literal(definition.jsonPointer),
  });
}

function invalidCaseSchemaV1(
  definition: ProviderRegistryRootHistoryInvalidCaseDefinitionV1,
): z.ZodType<ProviderRegistryRootHistoryInvalidCaseDefinitionV1> {
  const operandSchemas = definition.mutation.operands.map((operand) =>
    z.literal(operand),
  ) as unknown as [
    z.ZodLiteral<string>,
    ...z.ZodLiteral<string>[],
  ];
  const operandsSchema =
    definition.mutation.operands.length === 0
      ? z.array(z.string()).length(0)
      : z.tuple(operandSchemas);
  return z.strictObject({
    caseId: z.literal(definition.caseId),
    mutation: z.strictObject({
      dialect: z.literal(definition.mutation.dialect),
      operation: z.literal(definition.mutation.operation),
      targetJsonPointer: z.literal(
        definition.mutation.targetJsonPointer,
      ),
      operands: operandsSchema,
      deterministicSeed: invalidSeedSchemaV1(
        definition.mutation.deterministicSeed,
      ),
    }),
    expected: z.strictObject({
      boundary: z.literal(definition.expected.boundary),
      stage: z.literal(definition.expected.stage),
      reason: z.literal(definition.expected.reason),
      publicFailureReason: z.literal(
        definition.expected.publicFailureReason,
      ),
      postAttestationPointCalls: z.literal(
        definition.expected.postAttestationPointCalls,
      ),
      postAttestationSignatureCalls: z.literal(
        definition.expected.postAttestationSignatureCalls,
      ),
    }),
  }) as z.ZodType<ProviderRegistryRootHistoryInvalidCaseDefinitionV1>;
}

const ProviderRegistryRootHistoryInvalidCasesTupleV1Schema =
  z.tuple(
    PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_CASE_DEFINITIONS_V1.map(
      invalidCaseSchemaV1,
    ) as unknown as [
      z.ZodType<ProviderRegistryRootHistoryInvalidCaseDefinitionV1>,
      ...z.ZodType<ProviderRegistryRootHistoryInvalidCaseDefinitionV1>[],
    ],
  ) as z.ZodType<
    readonly ProviderRegistryRootHistoryInvalidCaseDefinitionV1[]
  >;

export const ProviderRegistryRootHistoryInvalidManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(
      PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_PROFILE_V1,
    ),
    canonicalizationProfile: z.literal(
      RFC8785_JCS_SAFE_INTEGER_PROFILE_V1,
    ),
    verificationProfile: z.literal(
      STRICT_ED25519_VERIFICATION_PROFILE_V1,
    ),
    fixtureAuthority: z.literal("none_rejection_only"),
    goldenResource: z.strictObject({
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
    cases:
      ProviderRegistryRootHistoryInvalidCasesTupleV1Schema,
  });
export type ProviderRegistryRootHistoryInvalidManifestV1 = z.infer<
  typeof ProviderRegistryRootHistoryInvalidManifestV1Schema
>;

export class ProviderRegistryRootHistoryFixtureError extends TypeError {
  constructor() {
    super("provider registry root history fixture verification failed");
    this.name = "ProviderRegistryRootHistoryFixtureError";
  }
}

function semanticContentDigestV1(
  domain: string,
  value: unknown,
): ReturnType<typeof ContentDigestV1Schema.parse> {
  const preimage = canonicalizeJcsSafeIntegerUtf8V1([
    domain,
    value,
  ]);
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexInternalV1(sha256InternalV1(preimage))}`,
  );
}

function deepFreezeJson<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreezeJson(child);
    Object.freeze(value);
  }
  return value;
}

function verifyCaseOrderV1(
  manifest: ProviderRegistryRootHistoryInvalidManifestV1,
): void {
  const actual = manifest.cases.map(({ caseId }) => caseId);
  if (
    actual.length !==
      PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_CASE_IDS_V1.length ||
    actual.some(
      (caseId, index) =>
        caseId !==
        PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_CASE_IDS_V1[index],
    )
  ) {
    throw new TypeError("invalid root history rejection case order");
  }
}

function verifyGoldenSemanticV1(
  input: unknown,
): ProviderRegistryRootHistoryGoldenManifestV1 {
  assertJsonDataTreeBeforeSchemaV1(input);
  const manifest =
    ProviderRegistryRootHistoryGoldenManifestV1Schema.parse(input);
  if (
    semanticContentDigestV1(
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_DOMAIN_V1,
      manifest,
    ) !==
    PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1
  ) {
    throw new TypeError("root history golden semantic mismatch");
  }
  return deepFreezeJson(manifest);
}

function verifyInvalidSemanticV1(
  input: unknown,
): ProviderRegistryRootHistoryInvalidManifestV1 {
  assertJsonDataTreeBeforeSchemaV1(input);
  const manifest =
    ProviderRegistryRootHistoryInvalidManifestV1Schema.parse(input);
  verifyCaseOrderV1(manifest);
  if (
    manifest.goldenResource.resourceByteLength !==
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1 ||
    manifest.goldenResource.resourceSha256Hex !==
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1 ||
    manifest.goldenResource.semanticContentDigest !==
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1 ||
    semanticContentDigestV1(
      PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_SEMANTIC_DOMAIN_V1,
      manifest,
    ) !==
      PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1
  ) {
    throw new TypeError("root history invalid semantic mismatch");
  }
  return deepFreezeJson(manifest);
}

export function verifyProviderRegistryRootHistoryGoldenManifestResourceV1(
  resourceBytes: unknown,
): ProviderRegistryRootHistoryGoldenManifestV1 {
  try {
    const snapshot = snapshotBoundedFixedResourceBytesInternalV1(
      resourceBytes,
      PROVIDER_REGISTRY_ROOT_HISTORY_FIXTURE_MAX_BYTES_V1,
    );
    assertFixedResourceByteAnchorInternalV1(
      snapshot,
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
    );
    return verifyGoldenSemanticV1(
      parseFixedUtf8JsonResourceInternalV1(snapshot),
    );
  } catch {
    throw new ProviderRegistryRootHistoryFixtureError();
  }
}

export function verifyProviderRegistryRootHistoryInvalidManifestResourceV1(
  resourceBytes: unknown,
): ProviderRegistryRootHistoryInvalidManifestV1 {
  try {
    const snapshot = snapshotBoundedFixedResourceBytesInternalV1(
      resourceBytes,
      PROVIDER_REGISTRY_ROOT_HISTORY_FIXTURE_MAX_BYTES_V1,
    );
    assertFixedResourceByteAnchorInternalV1(
      snapshot,
      PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1,
      PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1,
    );
    return verifyInvalidSemanticV1(
      parseFixedUtf8JsonResourceInternalV1(snapshot),
    );
  } catch {
    throw new ProviderRegistryRootHistoryFixtureError();
  }
}
