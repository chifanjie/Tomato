import { z } from "./zod-runtime.js";

import { ProviderBootstrapTrustBundleV1Schema } from "./bootstrap-trust-bundle.js";
import { assertJsonDataTreeBeforeSchemaV1 } from "./domain-crypto.js";
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
  DurableObjectIdentityProviderIdV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  ProviderFeasibilityApproverKeyIdV1Schema,
  ProviderRegistryManifestGenerationIdV1Schema,
  ProviderRegistryManifestSignatureV1Schema,
  ProviderRegistryRootKeyIdV1Schema,
  StoreProviderRegistrySignatureV1Schema,
  StoreProviderVerificationKeyIdV1Schema,
} from "./primitives.js";
import {
  buildProviderRegistryManifestRelativePathV1,
} from "./provider-fixed-locator.js";
import {
  PROVIDER_FEASIBILITY_APPROVER_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
  PROVIDER_REGISTRY_MANIFEST_ID_DOMAIN_V1,
  PROVIDER_REGISTRY_MANIFEST_SIGNATURE_DOMAIN_V1,
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestPinV1Schema,
  ProviderRegistryManifestRevokedMemberV1Schema,
  ProviderRegistryManifestRoutingV1Schema,
  STORE_DURABLE_OBJECT_PROVIDER_BINDING_DERIVATION_GENERATION_SIGNATURE_DOMAIN_V1,
  STORE_DURABLE_OBJECT_PROVIDER_REGISTRY_ENTRY_SIGNATURE_DOMAIN_V1,
  STORE_DURABLE_OBJECT_PROVIDER_VERIFICATION_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
  STORE_PROVIDER_RUNTIME_ATTESTATION_SIGNATURE_DOMAIN_V1,
  createProviderFeasibilityApproverPublicKeySignatureMessageV1,
  createProviderRegistryManifestSignatureMessageV1,
  createStoreDurableObjectProviderBindingDerivationGenerationSignatureMessageV1,
  createStoreDurableObjectProviderRegistryEntrySignatureMessageV1,
  createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1,
  createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1,
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
  deriveStoreDurableObjectProviderRegistryEntryContentDigestV1,
  deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1,
  projectProviderRegistryManifestIdFieldsV1,
  projectProviderRegistryManifestUnsignedClaimsV1,
  projectStoreDurableObjectProviderRegistryEntryUnsignedClaimsV1,
  type ProviderFeasibilityApproverPublicKeyV1,
  type ProviderRegistryManifestEnvelopeV1,
  type StoreDurableObjectProviderBindingDerivationGenerationV1,
  type StoreDurableObjectProviderRegistryEntryV1,
  type StoreDurableObjectProviderRuntimeAttestationV1,
  type StoreDurableObjectProviderVerificationPublicKeyV1,
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
} from "./provider-registry-trust.js";
import {
  PROVIDER_REGISTRY_MANIFEST_INVALID_CASE_DEFINITIONS_V1,
  PROVIDER_REGISTRY_MANIFEST_INVALID_RECIPE_DIALECT_V1,
  type ProviderRegistryManifestInvalidCaseDefinitionV1,
  type ProviderRegistryManifestInvalidCaseIdV1,
} from "./provider-registry-manifest-invalid-definitions.js";
import { sha256InternalV1 } from "./sha256.js";
import { STRICT_ED25519_VERIFICATION_PROFILE_V1 } from "./strict-ed25519.js";

export const PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1 =
  "fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json" as const;
export const PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_PATH_V1 =
  "fixtures/v1/invalid/provider-registry-entry-manifest-history-v1.json" as const;
export const PROVIDER_REGISTRY_MANIFEST_HISTORY_FIXTURE_MAX_BYTES_V1 =
  2_097_152;
export const PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_FIXTURE_MAX_BYTES_V1 =
  262_144;
export const PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_PROFILE_V1 =
  "provider_registry_entry_manifest_history_golden_manifest_v1" as const;
export const PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_PROFILE_V1 =
  "provider_registry_manifest_history_invalid_manifest_v1" as const;
export const PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_DOMAIN_V1 =
  "provider-registry-entry-manifest-history-golden-manifest-v1" as const;
export const PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_DOMAIN_V1 =
  "provider-registry-manifest-history-invalid-manifest-v1" as const;
export const PROVIDER_REGISTRY_MANIFEST_INVALID_MATERIALIZED_REQUEST_SEMANTIC_DOMAIN_V1 =
  "provider-registry-manifest-invalid-materialized-request-v1" as const;

/* Raw bytes and semantic JCS identity are deliberately independent anchors. */
export const PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1 =
  1_341_933;
export const PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1 =
  "bff8bdf27f6034d6bbaeea08be79f054300244405900008fcfb9c46e590962d8";
export const PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1 =
  ContentDigestV1Schema.parse(
    "sha256:6c2c8e75f7a4c8e6b43cb151db0dc292146a20182d0fce9b623b346437a0a12a",
  );
export const PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1 =
  104_226;
export const PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1 =
  "ef53018092032c1fc355b5f8f06bd40fa6f65fb868038ab484e1ad8836a1b401";
export const PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1 =
  ContentDigestV1Schema.parse(
    "sha256:3d53130fdc8c9aa7703bb3946a3f14ef7f8f395235eaf199b1ab968d78a8ec13",
  );

const PROVIDER_A = "durable-object-provider:native-a" as const;
const PROVIDER_B = "durable-object-provider:native-b" as const;
const FIXTURE_IDENTIFIER_DOMAIN =
  "provider-registry-entry-manifest-history-fixture-id-v1" as const;
const FIXTURE_CONTENT_DOMAIN =
  "provider-registry-entry-manifest-history-fixture-content-v1" as const;

const EvenLowerHexV1Schema = z.string().regex(/^(?:[0-9a-f]{2})+$/u);
const LowerHex64V1Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const RegistryManifestRelativeLocatorV1Schema = z
  .string()
  .regex(/^provider\/registry-manifests\/id-[0-9a-v]+\.json$/u);

const RootHistoryDependencySeedsV1Schema = z.strictObject({
  purpose: z.literal("non_production_fixture_only"),
  bootstrapRootSeedHex: z.literal("10".repeat(32)),
  plannedRootSeedHex: z.literal("20".repeat(32)),
  compromiseRootSeedHex: z.literal("30".repeat(32)),
  recoverySeedHexes: z.tuple([
    z.literal("40".repeat(32)),
    z.literal("50".repeat(32)),
    z.literal("60".repeat(32)),
  ]),
});

const providerKeySeedDefinitions = [
  ["a1-containment-proof", PROVIDER_A, "containment_proof", 1, 1, "71"],
  ["a1-journal-version", PROVIDER_A, "journal_version", 1, 1, "73"],
  [
    "a1-migration-semantic-proof",
    PROVIDER_A,
    "migration_semantic_proof",
    1,
    1,
    "74",
  ],
  ["a1-operation-receipt", PROVIDER_A, "operation_receipt", 1, 1, "70"],
  [
    "a2-operation-receipt-rotated",
    PROVIDER_A,
    "operation_receipt",
    2,
    2,
    "75",
  ],
  ["a1-state-version", PROVIDER_A, "state_version", 1, 1, "72"],
  ["b1-containment-proof", PROVIDER_B, "containment_proof", 1, 3, "77"],
  ["b1-journal-version", PROVIDER_B, "journal_version", 1, 3, "79"],
  [
    "b1-migration-semantic-proof",
    PROVIDER_B,
    "migration_semantic_proof",
    1,
    3,
    "7a",
  ],
  ["b1-operation-receipt", PROVIDER_B, "operation_receipt", 1, 3, "76"],
  ["b1-state-version", PROVIDER_B, "state_version", 1, 3, "78"],
] as const;

function providerKeySeedSchemaV1(
  definition: (typeof providerKeySeedDefinitions)[number],
) {
  const [
    vectorId,
    providerId,
    usage,
    registryGenerationIntroduced,
    signerRootGeneration,
    seedByte,
  ] = definition;
  return z.strictObject({
    vectorId: z.literal(vectorId),
    providerId: z.literal(providerId),
    usage: z.literal(usage),
    registryGenerationIntroduced: z.literal(registryGenerationIntroduced),
    signerRootGeneration: z.literal(signerRootGeneration),
    seedHex: z.literal(seedByte.repeat(32)),
  });
}

const ProviderVerificationKeySeedsV1Schema = z.tuple(
  providerKeySeedDefinitions.map(providerKeySeedSchemaV1) as unknown as [
    ReturnType<typeof providerKeySeedSchemaV1>,
    ...ReturnType<typeof providerKeySeedSchemaV1>[],
  ],
);

const FeasibilityApproverKeySeedsV1Schema = z.tuple([
  z.strictObject({
    role: z.literal("qa"),
    seedHex: z.literal("7b".repeat(32)),
  }),
  z.strictObject({
    role: z.literal("release"),
    seedHex: z.literal("7c".repeat(32)),
  }),
]);

const BindingDerivationSecretSeedsV1Schema = z.tuple([
  z.strictObject({
    providerId: z.literal(PROVIDER_A),
    generation: z.literal(1),
    seedHex: z.literal("80".repeat(32)),
  }),
  z.strictObject({
    providerId: z.literal(PROVIDER_B),
    generation: z.literal(1),
    seedHex: z.literal("81".repeat(32)),
  }),
]);

const DeterministicSeedsV1Schema = z.strictObject({
  purpose: z.literal("non_production_fixture_only"),
  rootHistoryDependencySeeds: RootHistoryDependencySeedsV1Schema,
  installationInitializationNonceHex: z.literal("a1".repeat(16)),
  providerVerificationKeySeeds: ProviderVerificationKeySeedsV1Schema,
  feasibilityApproverKeySeeds: FeasibilityApproverKeySeedsV1Schema,
  bindingDerivationSecretSeeds: BindingDerivationSecretSeedsV1Schema,
  fixtureIdentifierDerivation: z.strictObject({
    domain: z.literal(FIXTURE_IDENTIFIER_DOMAIN),
    warning: z.literal("non_production_fixture_only"),
  }),
  fixtureContentDigestDerivation: z.strictObject({
    domain: z.literal(FIXTURE_CONTENT_DOMAIN),
    warning: z.literal("non_production_fixture_only"),
  }),
});

const NestedSignatureVectorCommonShapeV1 = {
  vectorId: z.string().min(1),
  rootKeyId: ProviderRegistryRootKeyIdV1Schema,
  signatureMessageCanonicalUtf8Hex: EvenLowerHexV1Schema,
  registrySignature: StoreProviderRegistrySignatureV1Schema,
  canonicalRecordUtf8Hex: EvenLowerHexV1Schema,
} as const;

function providerKeyVectorSchemaV1(vectorId: string) {
  return z.strictObject({
    ...NestedSignatureVectorCommonShapeV1,
    vectorId: z.literal(vectorId),
    recordKind: z.literal("provider_verification_public_key"),
    providerId: DurableObjectIdentityProviderIdV1Schema,
    usage: z.enum([
      "operation_receipt",
      "containment_proof",
      "state_version",
      "journal_version",
      "migration_semantic_proof",
    ]),
    keyId: StoreProviderVerificationKeyIdV1Schema,
    registryGenerationIntroduced: z.number().int().min(1),
    signatureDomain: z.literal(
      STORE_DURABLE_OBJECT_PROVIDER_VERIFICATION_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
    ),
  });
}

function approverVectorSchemaV1(vectorId: string) {
  return z.strictObject({
    ...NestedSignatureVectorCommonShapeV1,
    vectorId: z.literal(vectorId),
    recordKind: z.literal("feasibility_approver_public_key"),
    role: z.enum(["qa", "release"]),
    keyId: ProviderFeasibilityApproverKeyIdV1Schema,
    signatureDomain: z.literal(
      PROVIDER_FEASIBILITY_APPROVER_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
    ),
  });
}

function bindingVectorSchemaV1(vectorId: string) {
  return z.strictObject({
    ...NestedSignatureVectorCommonShapeV1,
    vectorId: z.literal(vectorId),
    recordKind: z.literal("binding_derivation_generation"),
    providerId: DurableObjectIdentityProviderIdV1Schema,
    generation: z.number().int().min(1),
    signatureDomain: z.literal(
      STORE_DURABLE_OBJECT_PROVIDER_BINDING_DERIVATION_GENERATION_SIGNATURE_DOMAIN_V1,
    ),
  });
}

function runtimeVectorSchemaV1(vectorId: string) {
  return z.strictObject({
    ...NestedSignatureVectorCommonShapeV1,
    vectorId: z.literal(vectorId),
    recordKind: z.literal("runtime_attestation"),
    providerId: DurableObjectIdentityProviderIdV1Schema,
    attestationGeneration: z.number().int().min(1),
    signatureDomain: z.literal(
      STORE_PROVIDER_RUNTIME_ATTESTATION_SIGNATURE_DOMAIN_V1,
    ),
    contentDigest: ContentDigestV1Schema,
  });
}

const NestedRecordSignatureVectorsV1Schema = z.tuple([
  ...providerKeySeedDefinitions.map(([vectorId]) =>
    providerKeyVectorSchemaV1(vectorId),
  ),
  approverVectorSchemaV1("global-qa-approver"),
  approverVectorSchemaV1("global-release-approver"),
  bindingVectorSchemaV1("a1-binding-1"),
  bindingVectorSchemaV1("b1-binding-1"),
  runtimeVectorSchemaV1("a-runtime-1"),
  runtimeVectorSchemaV1("a-runtime-2"),
  runtimeVectorSchemaV1("b-runtime-1"),
] as unknown as [
  ReturnType<typeof providerKeyVectorSchemaV1>,
  ...z.ZodType[],
]);

type ProviderKeySignatureVectorV1 = z.infer<
  ReturnType<typeof providerKeyVectorSchemaV1>
>;
type ApproverSignatureVectorV1 = z.infer<
  ReturnType<typeof approverVectorSchemaV1>
>;
type BindingSignatureVectorV1 = z.infer<
  ReturnType<typeof bindingVectorSchemaV1>
>;
type RuntimeSignatureVectorV1 = z.infer<
  ReturnType<typeof runtimeVectorSchemaV1>
>;
type NestedRecordSignatureVectorV1 =
  | ProviderKeySignatureVectorV1
  | ApproverSignatureVectorV1
  | BindingSignatureVectorV1
  | RuntimeSignatureVectorV1;

const EntryPredecessorVectorV1Schema = z.union([
  z.strictObject({ state: z.literal("genesis") }),
  z.strictObject({
    state: z.literal("registry_entry"),
    contentDigest: ContentDigestV1Schema,
  }),
]);

function entryVectorSchemaV1(vectorId: string) {
  return z.strictObject({
    vectorId: z.literal(vectorId),
    providerId: DurableObjectIdentityProviderIdV1Schema,
    registryGeneration: z.number().int().min(1),
    rootKeyId: ProviderRegistryRootKeyIdV1Schema,
    contentDigest: ContentDigestV1Schema,
    runtimeAttestationContentDigest: ContentDigestV1Schema,
    predecessor: EntryPredecessorVectorV1Schema,
    signatureDomain: z.literal(
      STORE_DURABLE_OBJECT_PROVIDER_REGISTRY_ENTRY_SIGNATURE_DOMAIN_V1,
    ),
    unsignedClaimsCanonicalUtf8Hex: EvenLowerHexV1Schema,
    signatureMessageCanonicalUtf8Hex: EvenLowerHexV1Schema,
    registrySignature: StoreProviderRegistrySignatureV1Schema,
    canonicalEntryUtf8Hex: EvenLowerHexV1Schema,
  });
}

const EntryVectorsV1Schema = z.tuple([
  entryVectorSchemaV1("a-entry-1"),
  entryVectorSchemaV1("a-entry-2"),
  entryVectorSchemaV1("a-entry-3-root-rollover"),
  entryVectorSchemaV1("b-entry-1"),
]);

const EnabledEntryDigestVectorV1Schema = z.strictObject({
  providerId: DurableObjectIdentityProviderIdV1Schema,
  registryGeneration: z.number().int().min(1),
  registryEntryContentDigest: ContentDigestV1Schema,
});

function manifestVectorSchemaV1(
  manifestGeneration: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  enabledCount: 1 | 2,
  revokedCount: 0 | 1,
) {
  return z.strictObject({
    manifestGeneration: z.literal(manifestGeneration),
    activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
    routing: ProviderRegistryManifestRoutingV1Schema,
    enabledRegistryEntries:
      enabledCount === 1
        ? z.tuple([EnabledEntryDigestVectorV1Schema])
        : z.tuple([
            EnabledEntryDigestVectorV1Schema,
            EnabledEntryDigestVectorV1Schema,
          ]),
    revokedMembers:
      revokedCount === 0
        ? z.array(ProviderRegistryManifestRevokedMemberV1Schema).length(0)
        : z.tuple([ProviderRegistryManifestRevokedMemberV1Schema]),
    manifestIdFieldsCanonicalUtf8Hex: EvenLowerHexV1Schema,
    manifestIdFullPreimageCanonicalUtf8Hex: EvenLowerHexV1Schema,
    manifestIdFullPreimageSha256Hex: LowerHex64V1Schema,
    generationId: ProviderRegistryManifestGenerationIdV1Schema,
    contentDigest: ContentDigestV1Schema,
    signatureDomain: z.literal(
      PROVIDER_REGISTRY_MANIFEST_SIGNATURE_DOMAIN_V1,
    ),
    unsignedClaimsCanonicalUtf8Hex: EvenLowerHexV1Schema,
    signatureMessageCanonicalUtf8Hex: EvenLowerHexV1Schema,
    manifestSignature: ProviderRegistryManifestSignatureV1Schema,
    envelopeCanonicalLogicalBytes: z.number().int().min(1),
    envelopeCanonicalUtf8Hex: EvenLowerHexV1Schema,
    locator: RegistryManifestRelativeLocatorV1Schema,
  });
}

const ManifestVectorsV1Schema = z.tuple([
  manifestVectorSchemaV1(1, 1, 0),
  manifestVectorSchemaV1(2, 1, 0),
  manifestVectorSchemaV1(3, 2, 0),
  manifestVectorSchemaV1(4, 2, 0),
  manifestVectorSchemaV1(5, 2, 0),
  manifestVectorSchemaV1(6, 1, 1),
  manifestVectorSchemaV1(7, 1, 1),
]);

const ExpectedClosureV1Schema = z.strictObject({
  registryManifestCount: z.literal(7),
  canonicalEnvelopeLogicalBytes: z.tuple([
    z.literal(8_930),
    z.literal(9_802),
    z.literal(17_978),
    z.literal(17_979),
    z.literal(17_984),
    z.literal(9_339),
    z.literal(9_339),
  ]),
  retainedRootMetadataCanonicalBytes: z.literal(3_945),
  retainedRegistryManifestCanonicalBytes: z.literal(91_351),
  retainedTrustHistoryCanonicalBytes: z.literal(95_296),
  currentRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
  currentRegistryManifest: ProviderRegistryManifestPinV1Schema,
  uniqueClosure: z.strictObject({
    rootMetadataCount: z.literal(3),
    providerVerificationPublicKeyRecordCount: z.literal(11),
    bindingDerivationGenerationRecordCount: z.literal(2),
    feasibilityApproverPublicKeyRecordCount: z.literal(2),
    runtimeAttestationCount: z.literal(3),
    registryEntryCount: z.literal(4),
    registryManifestCount: z.literal(7),
    sourceProviderTombstoneCount: z.literal(1),
  }),
  cryptoClosure: z.strictObject({
    postAttestationPointCalls: z.literal(24),
    postAttestationSignatureCalls: z.literal(38),
    rootHistory: z.strictObject({
      pointCalls: z.literal(11),
      signatureCalls: z.literal(9),
    }),
    registryManifestAndUniqueRecordClosure: z.strictObject({
      pointCalls: z.literal(13),
      signatureCalls: z.literal(29),
    }),
  }),
  retainedByteIdentities: z.strictObject({
    globalFeasibilityApprovalKeysCanonicalUtf8Hex: EvenLowerHexV1Schema,
    aInitialProviderVerificationRecordsCanonicalUtf8Hex:
      EvenLowerHexV1Schema,
    a2AndA3VerificationKeysCanonicalUtf8Hex: EvenLowerHexV1Schema,
    a2AndA3RuntimeAttestationCanonicalUtf8Hex: EvenLowerHexV1Schema,
    b1RegistryEntryCanonicalUtf8Hex: EvenLowerHexV1Schema,
    g6AndG7SourceTombstoneCanonicalUtf8Hex: EvenLowerHexV1Schema,
  }),
  nestedRecordSignatureVectors: NestedRecordSignatureVectorsV1Schema,
  entryVectors: EntryVectorsV1Schema,
  manifestVectors: ManifestVectorsV1Schema,
});

export const ProviderRegistryManifestHistoryGoldenManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(
      PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_PROFILE_V1,
    ),
    canonicalizationProfile: z.literal(
      RFC8785_JCS_SAFE_INTEGER_PROFILE_V1,
    ),
    verificationProfile: z.literal(
      STRICT_ED25519_VERIFICATION_PROFILE_V1,
    ),
    fixtureAuthority: z.literal(
      "none_registry_structure_and_history_only",
    ),
    deterministicSeeds: DeterministicSeedsV1Schema,
    rootHistoryDependency: z.strictObject({
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
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    bootstrapTrustBundle: ProviderBootstrapTrustBundleV1Schema,
    rootMetadataHistory: z.tuple([
      ProviderRegistryRootMetadataEnvelopeV1Schema,
      ProviderRegistryRootMetadataEnvelopeV1Schema,
      ProviderRegistryRootMetadataEnvelopeV1Schema,
    ]),
    registryManifestHistory: z.tuple([
      ProviderRegistryManifestEnvelopeV1Schema,
      ProviderRegistryManifestEnvelopeV1Schema,
      ProviderRegistryManifestEnvelopeV1Schema,
      ProviderRegistryManifestEnvelopeV1Schema,
      ProviderRegistryManifestEnvelopeV1Schema,
      ProviderRegistryManifestEnvelopeV1Schema,
      ProviderRegistryManifestEnvelopeV1Schema,
    ]),
    expected: ExpectedClosureV1Schema,
  });
export type ProviderRegistryManifestHistoryGoldenManifestV1 = z.infer<
  typeof ProviderRegistryManifestHistoryGoldenManifestV1Schema
>;

export const PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1 =
  Object.freeze(
    PROVIDER_REGISTRY_MANIFEST_INVALID_CASE_DEFINITIONS_V1.map(
      ({ caseId }) => caseId,
    ),
  ) as readonly ProviderRegistryManifestInvalidCaseIdV1[];
export type ProviderRegistryManifestHistoryInvalidCaseIdV1 =
  (typeof PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1)[number];

const ProviderRegistryManifestMaterializedRequestDigestTupleV1 = Object.freeze([
  ["history-empty", "sha256:78d190af677055f6d05c7d5696c63c985fe875272bc12b935e1fc66153106fd2"],
  ["input-extra-field", "sha256:32825f829110f621ff835b13bf53e88778320f28317ed981c9aa75ab92a535de"],
  ["input-missing-installation-id", "sha256:e8778060381c30b4a890c6d3204145a97dc5097482d7747b5920a4fee18b6af6"],
  ["input-bad-installation-id", "sha256:6899257c01c1a7493f3abc98ad15b0aa0752ae46fdf41ad7f4a8f08192adee49"],
  ["history-not-array", "sha256:7a029018875139b616ce599dae7dbfb17a4f4f93ce792153269ff3026a612fbc"],
  ["history-sparse-array", "sha256:cf3c0e96d0b8bd1113d3cef6035fecb541c2039e13927bfac7040b87c2cd6326"],
  ["envelope-null", "sha256:f1bd079666e032a9b0245301d5b8b075499e0005d8b24c1756aae478439e68f6"],
  ["envelope-extra-field", "sha256:a40e6840c07e293fba58e76404ece632d5dab423f2b2e40d2e4d9b4ca203e815"],
  ["envelope-record-type-malformed", "sha256:aed0c1545958404c9e8998e194e3c1be829da98fc1c859996a310ef9e62800e5"],
  ["envelope-generation-id-malformed", "sha256:52186615819f83b6c7b47c233c293454f1b26ed1b4ab661ece49fa3b544a8f1e"],
  ["manifest-extra-field", "sha256:cf3f570f9aaccd454b2ffed7a6134a9f5566bb99e49f70f14df69246cdd16121"],
  ["manifest-profile-malformed", "sha256:6f4c4420620e2c73eb6f429f972c440267c0e13c180b1f4671478868dc5d4814"],
  ["genesis-predecessor-branch-malformed", "sha256:8ceee763dfd0586f7e38593166323560b71530d154a369dbb08f4b1110582a80"],
  ["successor-predecessor-branch-malformed", "sha256:b5efabbd196d7bde40185bc64cd70e26872b70746912a550dad058bd516ad869"],
  ["entry-extra-field", "sha256:ed95e4cbca05c0c72f0bf5037f17df868560027560faba9240628521d57c457d"],
  ["entry-genesis-predecessor-branch-malformed", "sha256:9cba572bd479e8bdd0bb80ffe1a952779af25b2c43dcd13668fc21b08c0b62af"],
  ["entry-successor-predecessor-branch-malformed", "sha256:14916d458daff79b8fe46c1377e5762dba84345dc4fba5802ef863cf3c09712e"],
  ["verification-key-extra-field", "sha256:a0446af59b4eff1a0e42ca6a22e85a3c7227ae6bf45fa8655f2e227e73d6ae85"],
  ["manifest-signature-malformed", "sha256:489e72e0fb9e980bd95842095ff855c8b9f23701aba599fcff4039861203394b"],
  ["envelope-generation-id-mismatch", "sha256:52a71a4ff6a03c634ce782bd21ce03b493efe29a9ed4bb7d234fdfd9f0dbb931"],
  ["payload-generation-id-mismatch", "sha256:4c5b71c2899d11c32c3c09ee75605b01035605d563e20cb7513eba634b956f2c"],
  ["envelope-content-digest-mismatch", "sha256:d64d5e99a743c75c68a442510c503a735cb09ddc2e5fdae02a4224e5bc8fbf35"],
  ["manifest-installation-id-mismatch", "sha256:1a7a7344dfd3eaf990fa6a9d5b0368d079c043938d70f4b09809d7e597f55115"],
  ["manifest-generation-starts-at-two", "sha256:e4c610c9ff4ca2f265095fa1de22176cf422a662b40c873d6d46467e2994a45a"],
  ["manifest-generation-gap", "sha256:7789fa4f7af76ac4adadfe720e63cb2b405aaeafcb803369af23f714f534fe6c"],
  ["predecessor-generation-id-mismatch", "sha256:e55a42757aab0f0327bd7bfb16a4ebba1e856542680fe4620cbbed76d963289f"],
  ["predecessor-content-digest-mismatch", "sha256:00a52c975c1f4354f7df53076e3ab842a2ca6af978bd037b768a66b2e4c9692f"],
  ["manifest-sibling-generation", "sha256:88b5958e3b1f1212648bc2ba9552e68b8bd0701ccf82ad9151ab61b12b310ab4"],
  ["root-generation-rollback", "sha256:e37a1bb1e08e5e545162601c1dd46d1f5a59c445bce2093283d52b60b9286731"],
  ["unknown-root-pin", "sha256:a0d11bb555c290ba113b035a669c4686840815a71383039b76141529ab2bfb1d"],
  ["member-order-reversed", "sha256:00dbb2e9f2af9de5d65013398ffc492d5c23011cdfff7916c9ded0f7b8b2e7df"],
  ["member-duplicate", "sha256:e9bc1880f785b968a9dba632658d911794a3b453ca82a65c675d46b04514a5a4"],
  ["tombstone-disappears", "sha256:d22769e32e4475e9aab99ddc9b35d3da7d29ea9224face619c1db30365cf7575"],
  ["enabled-entry-digest-mismatch", "sha256:37d0ae0849643910f1a91bfe3ea0eae5316a7f984f09c99507d4f11fe3711350"],
  ["member-entry-provider-mismatch", "sha256:581d6c1ddf5dd9c1ef804950a4926ff4039b93b1366e8d2924a7feae27aa142b"],
  ["entry-generation-jump", "sha256:a1faac35e11407a603a69be0c2f4ae233f03c74e0fbf7f35c763f1aedc9aa0a3"],
  ["entry-predecessor-digest-mismatch", "sha256:cf5f58e8c0f4ba3bbc2bf58a01ab913651b976f31c3711a99de8dbe8917e303b"],
  ["same-entry-digest-different-bytes", "sha256:edaea46a39f0d1eada4390bf4828d8e86428e9e240438c3b2fac3fb662619dd3"],
  ["runtime-pin-digest-mismatch", "sha256:8f8928eba9b46841d712edeb3e129ad7f906270968b328f3c8bc259f226b0532"],
  ["runtime-provider-mismatch", "sha256:c6e7ee09c6e72794b719a8f8eb60f004efa7afe1b43f23cca4a82e8f2870b3af"],
  ["provider-key-id-mismatch", "sha256:de10d634015721aef06a0f259103705286373dcff94d0d73519e6c9ceadd7103"],
  ["provider-key-raw-digest-mismatch", "sha256:03728ed54b6dd9b3d7613e381fc616a7b30c1afdd1ced9e501d4495556b3a103"],
  ["provider-key-order-reversed", "sha256:9dfc8d7b45285f70da058740349a9c1f125745da33aaa26a954eb32e033d1289"],
  ["active-key-missing", "sha256:7e7133c9dd2c8085c71f2c82233e00a5eedbc0de823ef26455e2092a208cb44f"],
  ["active-key-wrong-usage", "sha256:edac0e115c29523cc203af7d2ccff2c8a30ee1a302f3f1b1ca8de67247cb0170"],
  ["active-key-revoked", "sha256:fa5462a77d9ed62e0c6a808ed23e9816734173fc309d4da0299984f04814661d"],
  ["revoked-key-unknown", "sha256:eb8cee28bbd4530da317d4a9ba314c68e5965a664f3f940e19b1a20d3c5ab520"],
  ["rotated-key-backdated", "sha256:4e25af590e83c8c208ce0e4d1bacc9c8c2c08dc8be60a411e9e2e0cb60fbb0bb"],
  ["key-history-removal", "sha256:27873110d5ff0da57a91f3d72eb03bb7b847fea882e7088fe1d17765466a70c5"],
  ["retained-key-bytes-changed", "sha256:a61fdb4443e2cc568feb574b79420e2a7d71ffa216890607997f290694e45585"],
  ["public-key-material-alias-root", "sha256:5cb2a4e5a61cdc262b38da26e969a9f392eb9eb1d4e29251d58df3a1e2240473"],
  ["provider-key-cap-exceeded", "sha256:d7a5533223a8ccdc9cfcb9736a782368ab5e3438cc4f2ef80e4c0d88b0a749d5"],
  ["per-usage-key-cap-exceeded", "sha256:2af17da21127b2c6d1bc440e78fb73b03f2d83b066754ed2aa87b85a465d78a2"],
  ["manifest-signature-bitflip", "sha256:20147146afa8146ef6dc2bfb601fe5728c6301707b0d14a40a954e41b6696ab1"],
  ["manifest-signature-wrong-signer", "sha256:571dff8e78ade4bad16bb03d983797966f46b1b7103f8e0cf9bb11e8954ac02f"],
  ["manifest-signature-wrong-domain", "sha256:14b7eb2d760e1d93ef7e3fe909c78a647b5fe326edd3c5cc6c54edbbfcf7bde1"],
  ["manifest-signature-wrong-prefix", "sha256:e7aa5c026241d800aef9d05bb56118c82bc028812bf65e493471ea892d757480"],
  ["runtime-signature-bitflip", "sha256:d1f098486315c14a2dbb8212ed9ee1bf72eddf63e5e74334585bdca9186a0140"],
  ["runtime-signature-wrong-signer", "sha256:a1cddb264dc37e37faf885217aa154c3ac975a2e66f0298e65b2dd103c702cac"],
  ["runtime-signature-wrong-domain", "sha256:12755667ca6a8bd112b8a2e94924bbf18e157ab6c90c899cf28531198252cea6"],
  ["key-signature-bitflip", "sha256:37431083d14dee981273158b432a5fb601904b92f560f68f3ebc8046c6c73ca7"],
  ["key-signature-wrong-domain", "sha256:51b0f7e520618d2a8d8a011c8d20ffb34834ce36cec8ec2da41e90c3f7eed1b7"],
  ["entry-signature-bitflip", "sha256:7e92c7f3c3a6a3f6fcb7ea361a0e5949eb77141b4bdd96b0c25ae2b8c3e208c1"],
  ["entry-signature-wrong-domain", "sha256:eb3fee31fa9f566d8f8dcbb974c1600ef03e666654854ab6b9a0ee2f9ad49b87"],
  ["public-key-small-order", "sha256:204e2e761c6a966bb271890aa89e1d9584a6ab499c7560d6d8c285f5d4f438f7"],
  ["steady-two-enabled-bypass", "sha256:844125b49fd51bd8c71c71c9f30f85fb87a2a1574e4df1e1c722e6a75e0dd1ca"],
  ["migration-missing-member", "sha256:45eb973664349bb6e4f352f6e91e02b53a887edd129ef92aa4142f5910fd0c6a"],
  ["migration-source-equals-destination", "sha256:366c1e8afb60e0a694c4c960f15d1238e851af156ae3b92654041839c23b5d8e"],
  ["migration-active-outsider", "sha256:1b7adb81038474a51ccd492df451fcf0c389d6bec5f2040b39a558708afdd4ff"],
  ["migration-phase-skip", "sha256:044260fe64b95862e235c65094cd0607e02820c69dbd52ecfef3a0313b1e8fda"],
  ["migration-id-switch", "sha256:05519366ea366c85fbcd7be6f18d87b726694c5c36fbd0ff395125ffca054d0c"],
  ["tombstone-generation-wrong", "sha256:b4a964f302bddc373048507e8fd7b7e372498ce53f8bfb4ea28ad7122ae52a33"],
  ["tombstone-digest-wrong", "sha256:206fed275eefa8a05ee742dbd1e7b7f2810276f42d400918402a06e965e41cd7"],
  ["tombstone-mutated-after-retention", "sha256:6648ffe6867deecde15b87a8ba925811655e106201f064bd42a88905425d62ee"],
  ["provider-resurrection", "sha256:d448620af6310ab4f688b9d59079d4586e6c82ac300ee91b6f85c288b992588f"],
  ["early-steady-before-drained", "sha256:2a7874905ce9192aeb8116b292bb477f2b04de694ae5195f0dd2bdb376bc412a"],
  ["locator-alias-extra-field", "sha256:09785578112d294c988e29135073bfd3102ba0c7f97ef0ada1dd585add5a57ae"],
  ["locator-path-extra-field", "sha256:c318b30400c336723aabd190d7248b15d3e0f677437bea4be2886293eee28b4b"],
  ["locator-filename-key-extra-field", "sha256:b0510895a1e85a4c53ce6a6581022d2dcdf5efc26957043bdc4030046ec214e0"],
  ["history-count-cap-4097", "sha256:142bfbd77a32022ff18b62b3d5741b735eb22295ef931d2183239b251aade744"],
  ["single-envelope-byte-cap", "sha256:9a6615a7e9b37ab01beb0025b159ffe9cdd1cd56b0f9f3d3d30ca61fa6bda48a"],
  ["total-history-byte-cap", "sha256:39998eec99eda594372ec18f0025505eb5478d089145908d439295812dbb469a"],
  ["approval-snapshot-diverges", "sha256:f5de95a0990c2db37376886dce287b60cb420187c9962c5ca6ad1bdeefdf7f49"],
  ["binding-active-missing", "sha256:c4e61d728df543ca96c18bd9240b65d25d3a86fa8e309661af44b60065b1bedd"],
  ["binding-revocation-unknown", "sha256:2817ea79ab3573f6b04905e2c642dbcd2525a8c0815e47181747e50534d13554"],
  ["approver-active-role-mismatch", "sha256:73831ad89854695560477f440b2dda49f1e4b9ab2a612c91675843bf59b637c2"],
  ["approver-revocation-unknown", "sha256:f29397a056ff87f221fdfb282eace20e1d34b12b13120b7e5dd14077fba5f2b4"],
  ["binding-record-duplicate", "sha256:6e8ac33410baeca5e9a3b29409f635f46a09dec54b9f375163335442ac5ac340"],
  ["approver-record-order-reversed", "sha256:8276e6f3910dd869f3f1850397660b12ff8ff2338ddef05b04ba382f33d5acde"],
].map((row) => Object.freeze(row)));

if (
  ProviderRegistryManifestMaterializedRequestDigestTupleV1.length !==
    PROVIDER_REGISTRY_MANIFEST_INVALID_CASE_DEFINITIONS_V1.length ||
  new Set(
    ProviderRegistryManifestMaterializedRequestDigestTupleV1.map(
      ([, digest]) => digest,
    ),
  ).size !==
    ProviderRegistryManifestMaterializedRequestDigestTupleV1.length ||
  ProviderRegistryManifestMaterializedRequestDigestTupleV1.some(
    ([caseId], index) =>
      caseId !==
      PROVIDER_REGISTRY_MANIFEST_INVALID_CASE_DEFINITIONS_V1[index]?.caseId,
  )
) {
  throw new TypeError("materialized request digest tuple is stale or reordered");
}

export const ProviderRegistryManifestHistoryInvalidStageV1Schema = z.enum([
  "history_input",
  "history_limit",
  "root_history",
  "manifest_envelope",
  "root_binding",
  "manifest_predecessor",
  "manifest_signature",
  "member_set",
  "registry_entry",
  "record_signature",
  "key_admission",
  "key_history",
  "material_closure",
  "routing",
]);
export const ProviderRegistryManifestHistoryInvalidReasonV1Schema = z.enum([
  "schema_invalid",
  "history_empty",
  "history_generation_limit_exceeded",
  "envelope_byte_limit_exceeded",
  "history_total_byte_limit_exceeded",
  "root_history_invalid",
  "envelope_mismatch",
  "root_pin_mismatch",
  "root_generation_rollback",
  "generation_not_contiguous",
  "predecessor_pin_mismatch",
  "signature_invalid",
  "member_order_invalid",
  "member_transition_invalid",
  "entry_mismatch",
  "entry_successor_invalid",
  "record_history_invalid",
  "active_record_invalid",
  "revocation_invalid",
  "point_admission_failed",
  "public_key_material_alias",
  "routing_invalid",
]);

function invalidLiteralStringArraySchemaV1(values: readonly string[]) {
  if (values.length === 0) return z.array(z.string()).length(0);
  return z.tuple(
    values.map((value) => z.literal(value)) as unknown as [
      z.ZodLiteral<string>,
      ...z.ZodLiteral<string>[],
    ],
  );
}

function invalidCaseResourceSchemaV1(
  definition: ProviderRegistryManifestInvalidCaseDefinitionV1,
  definitionIndex: number,
) {
  const step = definition.mutation.steps[0];
  const isWrongDomain = definition.caseId.endsWith("-wrong-domain");
  const reviewedDigest =
    ProviderRegistryManifestMaterializedRequestDigestTupleV1[definitionIndex]?.[1];
  if (reviewedDigest === undefined) {
    throw new TypeError("materialized request digest tuple is incomplete");
  }
  return z.strictObject({
    caseId: z.literal(definition.caseId),
    mutation: z.strictObject({
      dialect: z.literal(definition.mutation.dialect),
      goldenResourcePath: z.literal(
        definition.mutation.goldenResourcePath,
      ),
      steps: z.tuple([
        z.strictObject({
          operation: z.literal(step.operation),
          targetJsonPointer: z.literal(step.targetJsonPointer),
          operands: invalidLiteralStringArraySchemaV1(step.operands),
        }),
      ]),
    }),
    expected: z.strictObject({
      boundary: z.literal(definition.expected.boundary),
      stage: z.literal(definition.expected.stage),
      reason: z.literal(definition.expected.reason),
      publicFailure: z.strictObject({
        errorName: z.literal(
          "ProviderRegistryManifestHistoryValidationError",
        ),
        code: z.literal("provider_unavailable"),
        reason: z.literal(definition.expected.publicFailureReason),
      }),
      postAttestationPointCalls: z.number().int().min(0),
      postAttestationSignatureCalls: z.number().int().min(0),
      wrongDomainProofCount: z.literal(isWrongDomain ? 1 : 0),
      materializedRequestSemanticDigest: z.literal(reviewedDigest),
    }),
  });
}

const ProviderRegistryManifestHistoryInvalidCaseIdsTupleV1Schema = z.tuple(
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1.map((caseId) =>
    z.literal(caseId),
  ) as unknown as [z.ZodLiteral<string>, ...z.ZodLiteral<string>[]],
);

const ProviderRegistryManifestHistoryInvalidCasesTupleV1Schema = z.tuple(
  PROVIDER_REGISTRY_MANIFEST_INVALID_CASE_DEFINITIONS_V1.map(
    invalidCaseResourceSchemaV1,
  ) as unknown as [z.ZodTypeAny, ...z.ZodTypeAny[]],
);

export interface ProviderRegistryManifestHistoryInvalidCaseV1 {
  readonly caseId: string;
  readonly mutation: ProviderRegistryManifestInvalidCaseDefinitionV1["mutation"];
  readonly expected: {
    readonly boundary: "internal_diagnostic";
    readonly stage: z.infer<
      typeof ProviderRegistryManifestHistoryInvalidStageV1Schema
    >;
    readonly reason: z.infer<
      typeof ProviderRegistryManifestHistoryInvalidReasonV1Schema
    >;
    readonly publicFailure: {
      readonly errorName: "ProviderRegistryManifestHistoryValidationError";
      readonly code: "provider_unavailable";
      readonly reason: "attestation_invalid";
    };
    readonly postAttestationPointCalls: number;
    readonly postAttestationSignatureCalls: number;
    readonly wrongDomainProofCount: 0 | 1;
    readonly materializedRequestSemanticDigest: z.infer<
      typeof ContentDigestV1Schema
    >;
  };
}

export interface ProviderRegistryManifestHistoryInvalidManifestV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_PROFILE_V1;
  readonly fixtureAuthority: "none_rejection_only";
  readonly verificationProfile: typeof STRICT_ED25519_VERIFICATION_PROFILE_V1;
  readonly canonicalizationProfile: typeof RFC8785_JCS_SAFE_INTEGER_PROFILE_V1;
  readonly semanticDomain: typeof PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_DOMAIN_V1;
  readonly materializedRequestSemanticDomain: typeof PROVIDER_REGISTRY_MANIFEST_INVALID_MATERIALIZED_REQUEST_SEMANTIC_DOMAIN_V1;
  readonly goldenDependency: {
    readonly resourcePath: typeof PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1;
    readonly resourceByteLength: typeof PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1;
    readonly resourceSha256Hex: typeof PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1;
    readonly semanticContentDigest: typeof PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1;
  };
  readonly mutationRecipeDialect: typeof PROVIDER_REGISTRY_MANIFEST_INVALID_RECIPE_DIALECT_V1;
  readonly caseCount: number;
  readonly caseIds: readonly string[];
  readonly cases: readonly ProviderRegistryManifestHistoryInvalidCaseV1[];
}

export const ProviderRegistryManifestHistoryInvalidManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(
      PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_PROFILE_V1,
    ),
    fixtureAuthority: z.literal("none_rejection_only"),
    verificationProfile: z.literal(
      STRICT_ED25519_VERIFICATION_PROFILE_V1,
    ),
    canonicalizationProfile: z.literal(
      RFC8785_JCS_SAFE_INTEGER_PROFILE_V1,
    ),
    semanticDomain: z.literal(
      PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_DOMAIN_V1,
    ),
    materializedRequestSemanticDomain: z.literal(
      PROVIDER_REGISTRY_MANIFEST_INVALID_MATERIALIZED_REQUEST_SEMANTIC_DOMAIN_V1,
    ),
    goldenDependency: z.strictObject({
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
    mutationRecipeDialect: z.literal(
      PROVIDER_REGISTRY_MANIFEST_INVALID_RECIPE_DIALECT_V1,
    ),
    caseCount: z.literal(
      PROVIDER_REGISTRY_MANIFEST_INVALID_CASE_DEFINITIONS_V1.length,
    ),
    caseIds:
      ProviderRegistryManifestHistoryInvalidCaseIdsTupleV1Schema,
    cases: ProviderRegistryManifestHistoryInvalidCasesTupleV1Schema,
  }) as unknown as z.ZodType<ProviderRegistryManifestHistoryInvalidManifestV1>;

export class ProviderRegistryManifestHistoryFixtureError extends TypeError {
  constructor() {
    super("provider registry manifest history fixture verification failed");
    this.name = "ProviderRegistryManifestHistoryFixtureError";
  }
}

function semanticContentDigestV1(
  domain: string,
  value: unknown,
): ReturnType<typeof ContentDigestV1Schema.parse> {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexInternalV1(
      sha256InternalV1(
        canonicalizeJcsSafeIntegerUtf8V1([domain, value]),
      ),
    )}`,
  );
}

function canonicalHexV1(value: unknown): string {
  return bytesToLowerHexInternalV1(
    canonicalizeJcsSafeIntegerUtf8V1(value),
  );
}

function bytesHexV1(value: Uint8Array): string {
  return bytesToLowerHexInternalV1(value);
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalHexV1(left) === canonicalHexV1(right);
}

function deepFreezeJson<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreezeJson(child);
    Object.freeze(value);
  }
  return value;
}

function recordIdentityV1(parts: readonly (string | number)[]): string {
  return JSON.stringify(parts);
}

function registerExactV1<T>(map: Map<string, T>, key: string, value: T): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, value);
  } else if (!canonicalEqualV1(existing, value)) {
    throw new TypeError("fixture record identity changed bytes");
  }
}

interface UniqueRegistryClosureV1 {
  readonly providerKeys: Map<
    string,
    StoreDurableObjectProviderVerificationPublicKeyV1
  >;
  readonly bindings: Map<
    string,
    StoreDurableObjectProviderBindingDerivationGenerationV1
  >;
  readonly approvers: Map<string, ProviderFeasibilityApproverPublicKeyV1>;
  readonly runtimes: Map<
    string,
    StoreDurableObjectProviderRuntimeAttestationV1
  >;
  readonly entries: Map<string, StoreDurableObjectProviderRegistryEntryV1>;
}

function collectUniqueClosureV1(
  history: readonly ProviderRegistryManifestEnvelopeV1[],
): UniqueRegistryClosureV1 {
  const closure: UniqueRegistryClosureV1 = {
    providerKeys: new Map(),
    bindings: new Map(),
    approvers: new Map(),
    runtimes: new Map(),
    entries: new Map(),
  };
  for (const envelope of history) {
    for (const member of envelope.payload.members) {
      if (member.disposition !== "enabled") continue;
      const entry = member.registryEntry;
      registerExactV1(
        closure.entries,
        recordIdentityV1([entry.providerId, entry.registryGeneration]),
        entry,
      );
      const runtime = entry.runtimeAttestation.payload;
      registerExactV1(
        closure.runtimes,
        recordIdentityV1([
          runtime.providerId,
          runtime.attestationGeneration,
        ]),
        runtime,
      );
      for (const record of entry.verificationKeys.publicKeyRecords) {
        registerExactV1(
          closure.providerKeys,
          recordIdentityV1([record.providerId, record.usage, record.keyId]),
          record,
        );
      }
      for (const record of entry.verificationKeys
        .bindingDerivationGenerationRecords) {
        registerExactV1(
          closure.bindings,
          recordIdentityV1([record.providerId, record.generation]),
          record,
        );
      }
      for (const record of entry.feasibilityApprovalKeys.publicKeyRecords) {
        registerExactV1(
          closure.approvers,
          recordIdentityV1([record.role, record.keyId]),
          record,
        );
      }
    }
  }
  return closure;
}

function signatureRootKeyIdV1(signature: string): string {
  const match =
    /^provider-registry-ed25519:([0-9a-f]{22}):[0-9a-f]{128}$/u.exec(
      signature,
    );
  if (match?.[1] === undefined) {
    throw new TypeError("fixture registry signature wire mismatch");
  }
  return match[1];
}

function verifyNestedRecordVectorsV1(
  manifest: ProviderRegistryManifestHistoryGoldenManifestV1,
  closure: UniqueRegistryClosureV1,
): void {
  if (
    closure.providerKeys.size !== 11 ||
    closure.bindings.size !== 2 ||
    closure.approvers.size !== 2 ||
    closure.runtimes.size !== 3
  ) {
    throw new TypeError("fixture unique nested-record closure mismatch");
  }
  const vectors = manifest.expected
    .nestedRecordSignatureVectors as unknown as readonly NestedRecordSignatureVectorV1[];
  for (const vector of vectors) {
    let record:
      | StoreDurableObjectProviderVerificationPublicKeyV1
      | StoreDurableObjectProviderBindingDerivationGenerationV1
      | ProviderFeasibilityApproverPublicKeyV1
      | StoreDurableObjectProviderRuntimeAttestationV1
      | undefined;
    let message: Uint8Array;
    if (vector.recordKind === "provider_verification_public_key") {
      record = closure.providerKeys.get(
        recordIdentityV1([vector.providerId, vector.usage, vector.keyId]),
      );
      if (
        record === undefined ||
        record.registryGenerationIntroduced !==
          vector.registryGenerationIntroduced
      ) {
        throw new TypeError("fixture provider-key vector mismatch");
      }
      message =
        createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1(
          record,
        );
    } else if (vector.recordKind === "binding_derivation_generation") {
      record = closure.bindings.get(
        recordIdentityV1([vector.providerId, vector.generation]),
      );
      if (record === undefined) {
        throw new TypeError("fixture binding vector mismatch");
      }
      message =
        createStoreDurableObjectProviderBindingDerivationGenerationSignatureMessageV1(
          record,
        );
    } else if (vector.recordKind === "feasibility_approver_public_key") {
      record = closure.approvers.get(
        recordIdentityV1([vector.role, vector.keyId]),
      );
      if (record === undefined) {
        throw new TypeError("fixture approver vector mismatch");
      }
      message = createProviderFeasibilityApproverPublicKeySignatureMessageV1(
        record,
      );
    } else {
      record = closure.runtimes.get(
        recordIdentityV1([
          vector.providerId,
          vector.attestationGeneration,
        ]),
      );
      if (
        record === undefined ||
        deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1(
          record,
        ) !== vector.contentDigest
      ) {
        throw new TypeError("fixture runtime vector mismatch");
      }
      message =
        createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
          record,
        );
    }
    if (
      record === undefined ||
      signatureRootKeyIdV1(record.registrySignature) !== vector.rootKeyId ||
      record.registrySignature !== vector.registrySignature ||
      bytesHexV1(message) !== vector.signatureMessageCanonicalUtf8Hex ||
      canonicalHexV1(record) !== vector.canonicalRecordUtf8Hex
    ) {
      throw new TypeError("fixture nested signature vector mismatch");
    }
  }
}

function verifyEntryVectorsV1(
  manifest: ProviderRegistryManifestHistoryGoldenManifestV1,
  closure: UniqueRegistryClosureV1,
): void {
  if (closure.entries.size !== 4) {
    throw new TypeError("fixture unique registry-entry closure mismatch");
  }
  for (const vector of manifest.expected.entryVectors) {
    const entry = closure.entries.get(
      recordIdentityV1([vector.providerId, vector.registryGeneration]),
    );
    if (entry === undefined) {
      throw new TypeError("fixture registry-entry vector missing");
    }
    const predecessor =
      "predecessorRegistryEntryContentDigest" in entry
        ? {
            state: "registry_entry" as const,
            contentDigest: entry.predecessorRegistryEntryContentDigest,
          }
        : { state: "genesis" as const };
    if (
      signatureRootKeyIdV1(entry.registrySignature) !== vector.rootKeyId ||
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(entry) !==
        vector.contentDigest ||
      entry.runtimeAttestation.contentDigest !==
        vector.runtimeAttestationContentDigest ||
      !canonicalEqualV1(predecessor, vector.predecessor) ||
      canonicalHexV1(
        projectStoreDurableObjectProviderRegistryEntryUnsignedClaimsV1(entry),
      ) !== vector.unsignedClaimsCanonicalUtf8Hex ||
      bytesHexV1(
        createStoreDurableObjectProviderRegistryEntrySignatureMessageV1(entry),
      ) !== vector.signatureMessageCanonicalUtf8Hex ||
      entry.registrySignature !== vector.registrySignature ||
      canonicalHexV1(entry) !== vector.canonicalEntryUtf8Hex
    ) {
      throw new TypeError("fixture registry-entry vector mismatch");
    }
  }
}

function enabledEntryForV1(
  envelope: ProviderRegistryManifestEnvelopeV1,
  providerId: string,
): StoreDurableObjectProviderRegistryEntryV1 {
  const member = envelope.payload.members.find(
    (candidate) => candidate.providerId === providerId,
  );
  if (member?.disposition !== "enabled") {
    throw new TypeError("fixture enabled registry entry missing");
  }
  return member.registryEntry;
}

function verifyRetainedByteIdentitiesV1(
  manifest: ProviderRegistryManifestHistoryGoldenManifestV1,
): void {
  const history = manifest.registryManifestHistory;
  const a1 = enabledEntryForV1(history[0], PROVIDER_A);
  const a2 = enabledEntryForV1(history[1], PROVIDER_A);
  const a3 = enabledEntryForV1(history[2], PROVIDER_A);
  const b1 = enabledEntryForV1(history[2], PROVIDER_B);
  const retained = manifest.expected.retainedByteIdentities;
  const tombstone6 = history[5].payload.members.find(
    ({ providerId }) => providerId === PROVIDER_A,
  );
  const tombstone7 = history[6].payload.members.find(
    ({ providerId }) => providerId === PROVIDER_A,
  );
  if (
    canonicalHexV1(a1.feasibilityApprovalKeys) !==
      retained.globalFeasibilityApprovalKeysCanonicalUtf8Hex ||
    canonicalHexV1(a1.verificationKeys.publicKeyRecords) !==
      retained.aInitialProviderVerificationRecordsCanonicalUtf8Hex ||
    canonicalHexV1(a2.verificationKeys) !==
      retained.a2AndA3VerificationKeysCanonicalUtf8Hex ||
    canonicalHexV1(a3.verificationKeys) !==
      retained.a2AndA3VerificationKeysCanonicalUtf8Hex ||
    canonicalHexV1(a2.runtimeAttestation) !==
      retained.a2AndA3RuntimeAttestationCanonicalUtf8Hex ||
    canonicalHexV1(a3.runtimeAttestation) !==
      retained.a2AndA3RuntimeAttestationCanonicalUtf8Hex ||
    canonicalHexV1(b1) !== retained.b1RegistryEntryCanonicalUtf8Hex ||
    tombstone6?.disposition !== "revoked" ||
    tombstone7?.disposition !== "revoked" ||
    canonicalHexV1(tombstone6) !==
      retained.g6AndG7SourceTombstoneCanonicalUtf8Hex ||
    canonicalHexV1(tombstone7) !==
      retained.g6AndG7SourceTombstoneCanonicalUtf8Hex
  ) {
    throw new TypeError("fixture retained byte identity mismatch");
  }
  for (const generation of [2, 3, 4] as const) {
    if (
      !canonicalEqualV1(
        enabledEntryForV1(history[generation], PROVIDER_A),
        a3,
      ) ||
      !canonicalEqualV1(
        enabledEntryForV1(history[generation], PROVIDER_B),
        b1,
      )
    ) {
      throw new TypeError("fixture migration entry bytes changed");
    }
  }
  for (const generation of [5, 6] as const) {
    if (
      !canonicalEqualV1(
        enabledEntryForV1(history[generation], PROVIDER_B),
        b1,
      )
    ) {
      throw new TypeError("fixture destination entry bytes changed");
    }
  }
}

function manifestPinV1(envelope: ProviderRegistryManifestEnvelopeV1) {
  return ProviderRegistryManifestPinV1Schema.parse({
    locatorProfile: "installation_provider_registry_manifest_v1",
    manifestGeneration: envelope.payload.manifestGeneration,
    generationId: envelope.generationId,
    contentDigest: envelope.contentDigest,
  });
}

function verifyManifestVectorsV1(
  manifest: ProviderRegistryManifestHistoryGoldenManifestV1,
): void {
  let retainedBytes = 0;
  for (let index = 0; index < 7; index += 1) {
    const envelope = manifest.registryManifestHistory[index];
    const vector = manifest.expected.manifestVectors[index];
    if (envelope === undefined || vector === undefined) {
      throw new TypeError("fixture manifest vector tuple mismatch");
    }
    const idFields = projectProviderRegistryManifestIdFieldsV1(
      envelope.payload,
    );
    const idPreimage = canonicalizeJcsSafeIntegerUtf8V1([
      PROVIDER_REGISTRY_MANIFEST_ID_DOMAIN_V1,
      idFields,
    ]);
    const fullIdSha = bytesToLowerHexInternalV1(sha256InternalV1(idPreimage));
    const enabled = envelope.payload.members
      .filter((member) => member.disposition === "enabled")
      .map((member) => ({
        providerId: member.providerId,
        registryGeneration: member.registryEntry.registryGeneration,
        registryEntryContentDigest: member.registryEntryContentDigest,
      }));
    const revoked = envelope.payload.members.filter(
      (member) => member.disposition === "revoked",
    );
    const canonicalEnvelope = canonicalizeJcsSafeIntegerUtf8V1(envelope);
    retainedBytes += canonicalEnvelope.byteLength;
    if (
      envelope.payload.manifestGeneration !== index + 1 ||
      vector.manifestGeneration !== index + 1 ||
      !canonicalEqualV1(
        envelope.payload.activeRootMetadata,
        vector.activeRootMetadata,
      ) ||
      !canonicalEqualV1(envelope.payload.routing, vector.routing) ||
      !canonicalEqualV1(enabled, vector.enabledRegistryEntries) ||
      !canonicalEqualV1(revoked, vector.revokedMembers) ||
      canonicalHexV1(idFields) !==
        vector.manifestIdFieldsCanonicalUtf8Hex ||
      bytesHexV1(idPreimage) !==
        vector.manifestIdFullPreimageCanonicalUtf8Hex ||
      fullIdSha !== vector.manifestIdFullPreimageSha256Hex ||
      deriveProviderRegistryManifestGenerationIdV1(idFields) !==
        vector.generationId ||
      envelope.generationId !== vector.generationId ||
      deriveProviderRegistryManifestContentDigestV1(envelope.payload) !==
        vector.contentDigest ||
      envelope.contentDigest !== vector.contentDigest ||
      canonicalHexV1(
        projectProviderRegistryManifestUnsignedClaimsV1(envelope.payload),
      ) !== vector.unsignedClaimsCanonicalUtf8Hex ||
      bytesHexV1(
        createProviderRegistryManifestSignatureMessageV1(envelope.payload),
      ) !== vector.signatureMessageCanonicalUtf8Hex ||
      envelope.payload.manifestSignature !== vector.manifestSignature ||
      canonicalEnvelope.byteLength !== vector.envelopeCanonicalLogicalBytes ||
      bytesHexV1(canonicalEnvelope) !== vector.envelopeCanonicalUtf8Hex ||
      buildProviderRegistryManifestRelativePathV1({
        locatorProfile: "installation_provider_registry_manifest_v1",
        generationId: envelope.generationId,
      }) !== vector.locator ||
      manifest.expected.canonicalEnvelopeLogicalBytes[index] !==
        canonicalEnvelope.byteLength
    ) {
      throw new TypeError(`fixture manifest vector ${index + 1} mismatch`);
    }
  }
  const current = manifest.registryManifestHistory[6];
  if (current === undefined) {
    throw new TypeError("fixture current Registry manifest missing");
  }
  if (
    retainedBytes !==
      manifest.expected.retainedRegistryManifestCanonicalBytes ||
    manifest.expected.retainedRootMetadataCanonicalBytes + retainedBytes !==
      manifest.expected.retainedTrustHistoryCanonicalBytes ||
    !canonicalEqualV1(
      manifest.expected.currentRegistryManifest,
      manifestPinV1(current),
    ) ||
    !canonicalEqualV1(
      manifest.expected.currentRootMetadata,
      current.payload.activeRootMetadata,
    )
  ) {
    throw new TypeError("fixture current Registry pin or byte total mismatch");
  }
}

function verifyGoldenSemanticV1(
  input: unknown,
): ProviderRegistryManifestHistoryGoldenManifestV1 {
  assertJsonDataTreeBeforeSchemaV1(input);
  const manifest =
    ProviderRegistryManifestHistoryGoldenManifestV1Schema.parse(input);
  if (
    manifest.rootHistoryDependency.resourcePath !==
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1 ||
    manifest.rootHistoryDependency.resourceByteLength !==
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1 ||
    manifest.rootHistoryDependency.resourceSha256Hex !==
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1 ||
    manifest.rootHistoryDependency.semanticContentDigest !==
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1
  ) {
    throw new TypeError("fixture root-history dependency anchor mismatch");
  }
  const closure = collectUniqueClosureV1(manifest.registryManifestHistory);
  verifyNestedRecordVectorsV1(manifest, closure);
  verifyEntryVectorsV1(manifest, closure);
  verifyRetainedByteIdentitiesV1(manifest);
  verifyManifestVectorsV1(manifest);
  if (
    semanticContentDigestV1(
      PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_DOMAIN_V1,
      manifest,
    ) !==
    PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1
  ) {
    throw new TypeError("fixture semantic content digest mismatch");
  }
  return deepFreezeJson(manifest);
}

function verifyInvalidSemanticV1(
  input: unknown,
): ProviderRegistryManifestHistoryInvalidManifestV1 {
  assertJsonDataTreeBeforeSchemaV1(input);
  const manifest =
    ProviderRegistryManifestHistoryInvalidManifestV1Schema.parse(input);
  const actualCaseIds = manifest.cases.map(({ caseId }) => caseId);
  if (
    manifest.caseCount !==
      PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1.length ||
    new Set(manifest.caseIds).size !== manifest.caseIds.length ||
    actualCaseIds.length !== manifest.caseIds.length ||
    actualCaseIds.some(
      (caseId, index) =>
        caseId !== manifest.caseIds[index] ||
        caseId !==
          PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1[index],
    ) ||
    semanticContentDigestV1(
      PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_DOMAIN_V1,
      manifest,
    ) !==
      PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1
  ) {
    throw new TypeError("fixture invalid corpus semantic mismatch");
  }
  return deepFreezeJson(manifest);
}

export function verifyProviderRegistryManifestHistoryGoldenResourceV1(
  resourceBytes: unknown,
): ProviderRegistryManifestHistoryGoldenManifestV1 {
  try {
    const snapshot = snapshotBoundedFixedResourceBytesInternalV1(
      resourceBytes,
      PROVIDER_REGISTRY_MANIFEST_HISTORY_FIXTURE_MAX_BYTES_V1,
    );
    assertFixedResourceByteAnchorInternalV1(
      snapshot,
      PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
      PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
    );
    return verifyGoldenSemanticV1(
      parseFixedUtf8JsonResourceInternalV1(snapshot),
    );
  } catch {
    throw new ProviderRegistryManifestHistoryFixtureError();
  }
}

export function verifyProviderRegistryManifestHistoryInvalidResourceV1(
  resourceBytes: unknown,
): ProviderRegistryManifestHistoryInvalidManifestV1 {
  try {
    const snapshot = snapshotBoundedFixedResourceBytesInternalV1(
      resourceBytes,
      PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_FIXTURE_MAX_BYTES_V1,
    );
    assertFixedResourceByteAnchorInternalV1(
      snapshot,
      PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1,
      PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1,
    );
    return verifyInvalidSemanticV1(
      parseFixedUtf8JsonResourceInternalV1(snapshot),
    );
  } catch {
    throw new ProviderRegistryManifestHistoryFixtureError();
  }
}
