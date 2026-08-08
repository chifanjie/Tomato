import { z } from "./zod-runtime.js";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  LowerHex64V1Schema,
} from "./primitives.js";
import {
  ProviderSignedDistributionRootBindingV1Schema,
} from "./provider-distribution-trust.js";
import {
  ProviderRegistryRootMetadataPinV1Schema,
  ProviderRegistryRootPublicKeyV1Schema,
} from "./provider-registry-trust.js";
import {
  ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
  ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
  createProviderRealFilesystemFixtureCorpusManifestSignatureMessageV1,
  createProviderRealFilesystemSuiteManifestSignatureMessageV1,
  validateProviderRealFilesystemSourceClosureV1,
  type ProviderRealFilesystemSourceClosureValidationV1,
  type ProviderRealFilesystemSourceClosureDiagnosticResultV1,
} from "./provider-real-filesystem-source.js";
import { sha256InternalV1 } from "./sha256.js";
import {
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

export const PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_PROFILE_V1 =
  "provider_real_fs_source_golden_v1" as const;
export const PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_PROFILE_V1 =
  "provider_real_fs_source_invalid_v1" as const;
export const PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_SEMANTIC_DOMAIN_V1 =
  "provider-real-fs-source-golden-manifest-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_SEMANTIC_DOMAIN_V1 =
  "provider-real-fs-source-invalid-manifest-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1 =
  "provider-real-fs-source-invalid-materialized-request-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_RECIPE_DIALECT_V1 =
  "provider_real_fs_source_invalid_recipe_v1" as const;
export const PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1 =
  "fixtures/v1/golden/provider-real-filesystem-source-v1.json" as const;
export const PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_RESOURCE_PATH_V1 =
  "fixtures/v1/invalid/provider-real-filesystem-source-v1.json" as const;
export const PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_BYTE_LENGTH_V1 =
  73_611 as const;
export const PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_SHA256_HEX_V1 =
  "15a59a180d088bf60fbedd7dc7c5500c515e2debf761503ba15c89f7556e2d36" as const;
export const PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:551e9ad5ad5b0b8e55d944176878bd5dc6c3643315adbebfa2a130c4c09f9a0e" as const;
export const PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_RESOURCE_BYTE_LENGTH_V1 =
  46_531 as const;
export const PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_RESOURCE_SHA256_HEX_V1 =
  "9ab2305ac61f1ff7ceb7814c011bb1fce26baff288a7d3bc9257e7952146926f" as const;
export const PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:b5e7e10560360afbc60f86c51bd69158a8e42ecbee055f1ea742de73c4d04404" as const;
export const PROVIDER_REAL_FILESYSTEM_SOURCE_FIXTURE_MAX_BYTES_V1 =
  1_048_576 as const;

const EvenLowerHexV1Schema = z
  .string()
  .regex(/^(?:[0-9a-f]{2})+$/u);
const ResourceSha256HexV1Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const PositiveSafeIntegerV1Schema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);

const GoldenExpectedV1Schema = z.strictObject({
  fixtureCorpusSignatureMessageUtf8Hex: EvenLowerHexV1Schema,
  suiteSignatureMessageUtf8Hex: EvenLowerHexV1Schema,
  fixtureCorpusPayloadCanonicalUtf8Hex: EvenLowerHexV1Schema,
  suitePayloadCanonicalUtf8Hex: EvenLowerHexV1Schema,
  fixtureCorpusManifestRelativePath: z
    .string()
    .regex(
      /^provider\/real-fs-fixture-corpus-manifests\/(?:id-[0-9a-v]+|idh-[0-9a-f]{64})\.json$/u,
    ),
  suiteManifestRelativePath: z
    .string()
    .regex(
      /^provider\/real-fs-suite-manifests\/(?:id-[0-9a-v]+|idh-[0-9a-f]{64})\.json$/u,
    ),
  recordCount: PositiveSafeIntegerV1Schema,
  caseCount: PositiveSafeIntegerV1Schema,
  requiredCaseCutCount: PositiveSafeIntegerV1Schema,
});

export const ProviderRealFilesystemSourceGoldenManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_PROFILE_V1),
    fixtureAuthority: z.literal("none_real_fs_source_structure_only"),
    canonicalizationProfile: z.literal(
      "rfc8785-jcs-safe-integer-v1",
    ),
    verificationProfile: z.literal(
      "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
    ),
    deterministicRootSeedHex: LowerHex64V1Schema,
    distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
    activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
    activeRoot: ProviderRegistryRootPublicKeyV1Schema,
    fixtureCorpusManifest:
      ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
    suiteManifest: ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
    expected: GoldenExpectedV1Schema,
    semanticDomain: z.literal(
      PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_SEMANTIC_DOMAIN_V1,
    ),
    dependencies: z.strictObject({
      registryGoldenResourcePath: z.literal(
        "fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json",
      ),
      registryGoldenResourceByteLength: PositiveSafeIntegerV1Schema,
      registryGoldenResourceSha256Hex: ResourceSha256HexV1Schema,
      bootstrapGoldenResourcePath: z.literal(
        "fixtures/v1/golden/provider-bootstrap-structure-crypto-v1.json",
      ),
      bootstrapGoldenResourceByteLength: PositiveSafeIntegerV1Schema,
      bootstrapGoldenResourceSha256Hex: ResourceSha256HexV1Schema,
    }),
    semanticContentDigest: z.literal(
      PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    ),
  });
export type ProviderRealFilesystemSourceGoldenManifestV1 = z.infer<
  typeof ProviderRealFilesystemSourceGoldenManifestV1Schema
>;

export const ProviderRealFilesystemSourceInvalidStageV1Schema = z.enum([
  "input",
  "distribution_binding",
  "active_root",
  "envelope_limit",
  "corpus_structure",
  "corpus_digest",
  "corpus_signature",
  "corpus_envelope",
  "suite_structure",
  "suite_corpus_pin",
  "suite_digest",
  "suite_signature",
  "suite_envelope",
]);
export const ProviderRealFilesystemSourceInvalidReasonV1Schema = z.enum([
  "schema_invalid",
  "binding_mismatch",
  "root_mismatch",
  "byte_limit_exceeded",
  "ordering_invalid",
  "count_mismatch",
  "digest_mismatch",
  "coverage_mismatch",
  "signature_invalid",
  "envelope_mismatch",
]);

const INVALID_CASE_IDS_V1 = [
  "input-extra-field",
  "input-missing-suite",
  "corpus-envelope-extra-field",
  "corpus-profile-malformed",
  "corpus-record-order-reversed",
  "corpus-record-duplicate",
  "corpus-ordinal-gap",
  "fixture-program-digest-mismatch",
  "fixture-program-length-mismatch",
  "corpus-record-count-mismatch",
  "corpus-record-set-digest-mismatch",
  "fixture-manifest-digest-mismatch",
  "corpus-distribution-binding-mismatch",
  "corpus-active-root-mismatch",
  "corpus-signature-bitflip",
  "corpus-signature-wrong-domain",
  "corpus-signature-wrong-signer",
  "corpus-signature-prefix-substitution",
  "corpus-envelope-content-digest-mismatch",
  "suite-envelope-extra-field",
  "suite-profile-malformed",
  "suite-distribution-binding-mismatch",
  "suite-active-root-mismatch",
  "suite-corpus-content-pin-mismatch",
  "suite-corpus-semantic-pin-mismatch",
  "suite-runner-profile-digest-mismatch",
  "suite-case-count-mismatch",
  "suite-case-order-reversed",
  "suite-case-coverage-omitted",
  "suite-case-id-mismatch",
  "suite-case-fixture-count-mismatch",
  "suite-crash-cut-ordinal-gap",
  "suite-crash-cut-injection-not-operation",
  "suite-recovery-assertion-digest-mismatch",
  "suite-crash-cut-id-mismatch",
  "suite-required-cut-count-mismatch",
  "suite-required-cut-set-digest-mismatch",
  "suite-semantic-digest-mismatch",
  "suite-signature-bitflip",
  "suite-signature-wrong-domain",
  "suite-signature-wrong-signer",
  "suite-signature-prefix-substitution",
  "suite-envelope-content-digest-mismatch",
] as const;
export const PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_CASE_IDS_V1 =
  Object.freeze([...INVALID_CASE_IDS_V1]);

const InvalidCaseIdV1Schema = z.enum(INVALID_CASE_IDS_V1);
const InvalidCaseV1Schema = z.strictObject({
  caseId: InvalidCaseIdV1Schema,
  mutation: z.strictObject({
    dialect: z.literal(
      PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_RECIPE_DIALECT_V1,
    ),
    goldenResourcePath: z.literal(
      PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
    ),
    steps: z.tuple([
      z.strictObject({
        operation: InvalidCaseIdV1Schema,
        targetJsonPointer: z.string(),
        operands: z.array(z.string()),
      }),
    ]),
  }),
  expected: z.strictObject({
    boundary: z.literal("internal_diagnostic"),
    stage: ProviderRealFilesystemSourceInvalidStageV1Schema,
    reason: ProviderRealFilesystemSourceInvalidReasonV1Schema,
    publicFailureReason: z.literal("attestation_invalid"),
    publicFailure: z.strictObject({
      errorName: z.literal(
        "ProviderRealFilesystemSourceClosureValidationError",
      ),
      code: z.literal("provider_unavailable"),
      reason: z.literal("attestation_invalid"),
    }),
    materializedRequestSemanticDigest: ContentDigestV1Schema,
  }),
});

export const ProviderRealFilesystemSourceInvalidManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_PROFILE_V1),
    fixtureAuthority: z.literal("none_rejection_only"),
    canonicalizationProfile: z.literal(
      "rfc8785-jcs-safe-integer-v1",
    ),
    verificationProfile: z.literal(
      "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
    ),
    semanticDomain: z.literal(
      PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_SEMANTIC_DOMAIN_V1,
    ),
    materializedRequestSemanticDomain: z.literal(
      PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
    ),
    goldenDependency: z.strictObject({
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
    mutationRecipeDialect: z.literal(
      PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_RECIPE_DIALECT_V1,
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
      PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
    ),
  });
export type ProviderRealFilesystemSourceInvalidManifestV1 = z.infer<
  typeof ProviderRealFilesystemSourceInvalidManifestV1Schema
>;

function bytesToHexV1(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function semanticDigestV1(domain: string, value: unknown): string {
  return `sha256:${bytesToHexV1(
    sha256InternalV1(canonicalizeJcsSafeIntegerUtf8V1([domain, value])),
  )}`;
}

function withoutSemanticDigestV1<T extends { semanticContentDigest: string }>(
  value: T,
): Omit<T, "semanticContentDigest"> {
  const { semanticContentDigest: _digest, ...fields } = value;
  return fields;
}

function exactBytesV1(
  bytes: Uint8Array,
  expectedByteLength: number,
  expectedSha256Hex: string,
): void {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength !== expectedByteLength ||
    bytes.byteLength > PROVIDER_REAL_FILESYSTEM_SOURCE_FIXTURE_MAX_BYTES_V1 ||
    bytesToHexV1(sha256InternalV1(bytes)) !== expectedSha256Hex
  ) {
    throw new ProviderRealFilesystemSourceFixtureError();
  }
}

function parseResourceJsonV1(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ProviderRealFilesystemSourceFixtureError();
  }
}

export class ProviderRealFilesystemSourceFixtureError extends TypeError {
  constructor() {
    super("provider real filesystem source fixture verification failed");
    this.name = "ProviderRealFilesystemSourceFixtureError";
  }
}

export interface ProviderRealFilesystemSourceGoldenValidationV1 {
  readonly authority: "none_real_fs_source_structure_only";
  readonly manifest: ProviderRealFilesystemSourceGoldenManifestV1;
  readonly sourceClosure: ProviderRealFilesystemSourceClosureValidationV1;
}

export async function verifyProviderRealFilesystemSourceGoldenManifestV1(
  input: unknown,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<ProviderRealFilesystemSourceGoldenValidationV1> {
  try {
    const manifest =
      ProviderRealFilesystemSourceGoldenManifestV1Schema.parse(input);
    if (
      semanticDigestV1(
        manifest.semanticDomain,
        withoutSemanticDigestV1(manifest),
      ) !== manifest.semanticContentDigest ||
      bytesToHexV1(
        createProviderRealFilesystemFixtureCorpusManifestSignatureMessageV1(
          manifest.fixtureCorpusManifest.payload,
          manifest.activeRoot.rootKeyId,
        ),
      ) !== manifest.expected.fixtureCorpusSignatureMessageUtf8Hex ||
      bytesToHexV1(
        createProviderRealFilesystemSuiteManifestSignatureMessageV1(
          manifest.suiteManifest.payload,
          manifest.activeRoot.rootKeyId,
        ),
      ) !== manifest.expected.suiteSignatureMessageUtf8Hex ||
      bytesToHexV1(
        canonicalizeJcsSafeIntegerUtf8V1(
          manifest.fixtureCorpusManifest.payload,
        ),
      ) !== manifest.expected.fixtureCorpusPayloadCanonicalUtf8Hex ||
      bytesToHexV1(
        canonicalizeJcsSafeIntegerUtf8V1(manifest.suiteManifest.payload),
      ) !== manifest.expected.suitePayloadCanonicalUtf8Hex
    ) {
      throw new ProviderRealFilesystemSourceFixtureError();
    }
    const sourceClosure =
      await validateProviderRealFilesystemSourceClosureV1({
        distributionRootBinding: manifest.distributionRootBinding,
        activeRootMetadata: manifest.activeRootMetadata,
        activeRoot: manifest.activeRoot,
        fixtureCorpusManifest: manifest.fixtureCorpusManifest,
        suiteManifest: manifest.suiteManifest,
        strictCryptoCapability,
      });
    if (
      sourceClosure.fixtureCorpusManifestRelativePath !==
        manifest.expected.fixtureCorpusManifestRelativePath ||
      sourceClosure.suiteManifestRelativePath !==
        manifest.expected.suiteManifestRelativePath ||
      sourceClosure.recordCount !== manifest.expected.recordCount ||
      sourceClosure.caseCount !== manifest.expected.caseCount ||
      sourceClosure.requiredCaseCutCount !==
        manifest.expected.requiredCaseCutCount
    ) {
      throw new ProviderRealFilesystemSourceFixtureError();
    }
    return Object.freeze({
      authority: "none_real_fs_source_structure_only" as const,
      manifest,
      sourceClosure,
    });
  } catch (error) {
    if (error instanceof ProviderRealFilesystemSourceFixtureError) throw error;
    throw new ProviderRealFilesystemSourceFixtureError();
  }
}

export async function verifyProviderRealFilesystemSourceGoldenResourceV1(
  bytes: Uint8Array,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<ProviderRealFilesystemSourceGoldenValidationV1> {
  exactBytesV1(
    bytes,
    PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_SHA256_HEX_V1,
  );
  return verifyProviderRealFilesystemSourceGoldenManifestV1(
    parseResourceJsonV1(bytes),
    strictCryptoCapability,
  );
}

export function verifyProviderRealFilesystemSourceInvalidManifestV1(
  input: unknown,
): ProviderRealFilesystemSourceInvalidManifestV1 {
  try {
    const manifest =
      ProviderRealFilesystemSourceInvalidManifestV1Schema.parse(input);
    if (
      semanticDigestV1(
        manifest.semanticDomain,
        withoutSemanticDigestV1(manifest),
      ) !== manifest.semanticContentDigest ||
      manifest.caseIds.some(
        (caseId, index) =>
          caseId !== INVALID_CASE_IDS_V1[index] ||
          manifest.cases[index]?.caseId !== caseId ||
          manifest.cases[index]?.mutation.steps[0].operation !== caseId,
      ) ||
      new Set(manifest.caseIds).size !== manifest.caseIds.length
    ) {
      throw new ProviderRealFilesystemSourceFixtureError();
    }
    return Object.freeze(manifest);
  } catch (error) {
    if (error instanceof ProviderRealFilesystemSourceFixtureError) throw error;
    throw new ProviderRealFilesystemSourceFixtureError();
  }
}

export function verifyProviderRealFilesystemSourceInvalidResourceV1(
  bytes: Uint8Array,
): ProviderRealFilesystemSourceInvalidManifestV1 {
  exactBytesV1(
    bytes,
    PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_RESOURCE_BYTE_LENGTH_V1,
    PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_RESOURCE_SHA256_HEX_V1,
  );
  return verifyProviderRealFilesystemSourceInvalidManifestV1(
    parseResourceJsonV1(bytes),
  );
}

export type ProviderRealFilesystemSourceInvalidDiagnosticV1 = Extract<
  ProviderRealFilesystemSourceClosureDiagnosticResultV1,
  { readonly ok: false }
>;
