import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import {
  chmod,
  lstat,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import ts from "typescript";

export const TOPOLOGY_PROOF_PROFILE_V1 =
  "provider_registry_evidence_binding_topology_proof_v1";
export const TOPOLOGY_PROOF_RESOURCE_PATH_V1 =
  "fixtures/v1/golden/provider-registry-evidence-binding-topology-proof-v1.json";
export const TOPOLOGY_PROOF_SEMANTIC_DOMAIN_V1 =
  "provider-registry-evidence-binding-topology-proof-v1";
export const PARSER_RUNTIME_WORKER_PROFILE_V1 =
  "provider_registry_evidence_binding_parser_runtime_worker_v1";
export const PARSER_RUNTIME_WORKER_TIMEOUT_MS_V1 = 120_000;

const PARSER_RUNTIME_WORKER_MAX_OUTPUT_BYTES_V1 = 2 * 1_048_576;
const PARSER_RUNTIME_WORKER_MAX_STDIO_BYTES_V1 = 64 * 1_024;
const PARSER_RUNTIME_WORKER_HEAP_MIB_V1 = 1_280;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectHasOwnV1 = Object.hasOwn;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const PRECOMPUTED_PARSER_RUNTIME_TRACE_TOKENS_V1 = new WeakMap();
const PARSER_RUNTIME_WORKER_PATH_V1 = fileURLToPath(
  new URL(
    "./provider-registry-evidence-binding-topology-proof-worker.mjs",
    import.meta.url,
  ),
);
const PARSER_RUNTIME_WORKER_TIMEOUT_FIXTURE_PATH_V1 = fileURLToPath(
  new URL(
    "./provider-registry-evidence-binding-topology-proof-worker-timeout-fixture.mjs",
    import.meta.url,
  ),
);

export const POINT_INPUT_KEYS_V1 = Object.freeze([
  "activeRoot",
  "activeRootMetadata",
  "bootstrapTrustBundle",
  "distributionRootBinding",
  "fixtureCorpusManifest",
  "installationIdentityGenerationId",
  "providerFeasibilityEvidence",
  "providerFeasibilityEvidencePin",
  "publicSupportTaxonomy",
  "realFilesystemConformanceResult",
  "realFilesystemConformanceResultLocator",
  "realFilesystemConformanceResultPin",
  "registryManifestHistory",
  "releaseMatrix",
  "rootMetadataHistory",
  "runtimeAttestation",
  "semanticProviderPolicy",
  "strictCryptoCapability",
  "suiteManifest",
  "targetDiscoveryFixtureManifest",
  "targetDiscoveryResult",
  "targetDiscoveryRunnerRun",
]);

export const JSON_BRANCH_KEYS_V1 = Object.freeze(
  POINT_INPUT_KEYS_V1.filter((key) => key !== "strictCryptoCapability"),
);

const SUCCESS_PROJECTION_KEYS_V1 = Object.freeze([
  "installationIdentityGenerationId",
  "registryManifestContentDigest",
  "candidateRegistryEntryContentDigest",
  "providerId",
  "runtimeAttestationContentDigest",
  "evidenceId",
  "evidenceContentDigest",
  "evidenceRelativePath",
  "qaApproverKeyId",
  "releaseApproverKeyId",
]);

export const BRANCH_SCHEMA_NAMES_V1 = Object.freeze({
  activeRoot: "provider-registry-root-public-key",
  activeRootMetadata: "provider-registry-root-metadata-pin",
  bootstrapTrustBundle: "provider-bootstrap-trust-bundle",
  distributionRootBinding: "provider-signed-distribution-root-binding",
  fixtureCorpusManifest:
    "provider-real-filesystem-fixture-corpus-manifest-envelope",
  installationIdentityGenerationId: "installation-identity-generation-id",
  providerFeasibilityEvidence: "provider-feasibility-evidence-envelope",
  providerFeasibilityEvidencePin: "provider-feasibility-evidence-pin",
  publicSupportTaxonomy: "provider-public-support-taxonomy-envelope",
  realFilesystemConformanceResult:
    "provider-real-filesystem-conformance-result-envelope",
  realFilesystemConformanceResultLocator:
    "provider-real-filesystem-conformance-result-locator",
  realFilesystemConformanceResultPin:
    "provider-real-filesystem-conformance-result-pin",
  registryManifestHistory: "provider-registry-manifest-envelope",
  releaseMatrix: "provider-release-matrix-envelope",
  rootMetadataHistory: "provider-registry-root-metadata-envelope",
  runtimeAttestation: "store-durable-object-provider-runtime-attestation-pin",
  semanticProviderPolicy: "store-durable-object-provider-policy",
  suiteManifest: "provider-real-filesystem-suite-manifest-envelope",
  targetDiscoveryFixtureManifest:
    "provider-target-discovery-fixture-manifest-envelope",
  targetDiscoveryResult: "provider-target-discovery-result-envelope",
  targetDiscoveryRunnerRun:
    "provider-target-discovery-runner-run-envelope",
});

const PRODUCTION_PARSER_BINDINGS_V1 = Object.freeze({
  activeRoot: {
    schemaSymbol: "ProviderRegistryRootPublicKeyV1Schema",
    parserSourcePath: "src/provider-registry-evidence-binding-point.ts",
    parserMode: "direct_safe_parse",
    evidence: [
      "ProviderRegistryRootPublicKeyV1Schema.safeParse(fields.activeRoot)",
    ],
  },
  activeRootMetadata: {
    schemaSymbol: "ProviderRegistryRootMetadataPinV1Schema",
    parserSourcePath: "src/provider-registry-evidence-binding-point.ts",
    parserMode: "direct_safe_parse",
    evidence: [
      "ProviderRegistryRootMetadataPinV1Schema.safeParse(\n      fields.activeRootMetadata,\n    )",
    ],
  },
  bootstrapTrustBundle: {
    schemaSymbol: "ProviderBootstrapTrustBundleV1Schema",
    parserSourcePath: "src/provider-registry-evidence-binding-point.ts",
    parserMode: "direct_parse",
    evidence: [
      "ProviderBootstrapTrustBundleV1Schema.parse(\n      fields.bootstrapTrustBundle,\n    )",
    ],
  },
  distributionRootBinding: {
    schemaSymbol: "ProviderSignedDistributionRootBindingV1Schema",
    parserSourcePath: "src/provider-registry-evidence-binding-point.ts",
    parserMode: "direct_parse",
    evidence: [
      "ProviderSignedDistributionRootBindingV1Schema.parse(\n        fields.distributionRootBinding,\n      )",
    ],
  },
  fixtureCorpusManifest: {
    schemaSymbol: "ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema",
    parserSourcePath: "src/provider-target-discovery-point.ts",
    parserMode: "prepared_delegated_parse",
    evidence: [
      "ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema.parse(snapshot.fixtureCorpusManifest)",
    ],
  },
  installationIdentityGenerationId: {
    schemaSymbol: "InstallationIdentityGenerationIdV1Schema",
    parserSourcePath: "src/provider-registry-evidence-binding-point.ts",
    parserMode: "direct_safe_parse",
    evidence: [
      "InstallationIdentityGenerationIdV1Schema.safeParse(\n      installationIdentityGenerationId,\n    )",
    ],
  },
  providerFeasibilityEvidence: {
    schemaSymbol: "ProviderFeasibilityEvidenceEnvelopeV1Schema",
    parserSourcePath: "src/provider-registry-evidence-binding-point.ts",
    parserMode: "prepared_then_complete_safe_parse",
    evidence: [
      "PreparedProviderFeasibilityEvidenceEnvelopeV1Schema.safeParse(input)",
      "ProviderFeasibilityEvidenceEnvelopeV1Schema.safeParse(envelope)",
    ],
  },
  providerFeasibilityEvidencePin: {
    schemaSymbol: "ProviderFeasibilityEvidencePinV1Schema",
    parserSourcePath: "src/provider-registry-evidence-binding-point.ts",
    parserMode: "direct_safe_parse",
    evidence: ["ProviderFeasibilityEvidencePinV1Schema.safeParse(input)"],
  },
  publicSupportTaxonomy: {
    schemaSymbol: "ProviderPublicSupportTaxonomyEnvelopeV1Schema",
    parserSourcePath: "src/provider-target-discovery-point.ts",
    parserMode: "prepared_delegated_schema_table_parse",
    evidence: [
      "[snapshot.publicSupportTaxonomy, ProviderPublicSupportTaxonomyEnvelopeV1Schema, \"taxonomy_structure\"]",
      "const parsed = schema.parse(value);",
    ],
  },
  realFilesystemConformanceResult: {
    schemaSymbol: "ProviderRealFilesystemConformanceResultEnvelopeV1Schema",
    parserSourcePath: "src/provider-real-filesystem-conformance-result.ts",
    parserMode: "prepared_delegated_parse",
    evidence: [
      "ProviderRealFilesystemConformanceResultEnvelopeV1Schema.parse(\n      snapshot.realFilesystemConformanceResult,\n    )",
    ],
  },
  realFilesystemConformanceResultLocator: {
    schemaSymbol: "ProviderRealFilesystemConformanceResultLocatorV1Schema",
    parserSourcePath: "src/provider-real-filesystem-conformance-result.ts",
    parserMode: "prepared_delegated_parse",
    evidence: [
      "ProviderRealFilesystemConformanceResultLocatorV1Schema.parse(\n      snapshot.realFilesystemConformanceResultLocator,\n    )",
    ],
  },
  realFilesystemConformanceResultPin: {
    schemaSymbol: "ProviderRealFilesystemConformanceResultPinV1Schema",
    parserSourcePath: "src/provider-real-filesystem-conformance-result.ts",
    parserMode: "prepared_delegated_parse",
    evidence: [
      "ProviderRealFilesystemConformanceResultPinV1Schema.parse(\n      snapshot.realFilesystemConformanceResultPin,\n    )",
    ],
  },
  registryManifestHistory: {
    schemaSymbol: "ProviderRegistryManifestEnvelopeV1Schema",
    parserSourcePath: "src/provider-registry-manifest-history.ts",
    parserMode: "prepared_history_safe_parse_each_envelope",
    evidence: [
      "ProviderRegistryManifestEnvelopeV1Schema.safeParse(envelope).success",
    ],
  },
  releaseMatrix: {
    schemaSymbol: "ProviderReleaseMatrixEnvelopeV1Schema",
    parserSourcePath: "src/provider-target-discovery-point.ts",
    parserMode: "prepared_delegated_schema_table_parse",
    evidence: [
      "[snapshot.releaseMatrix, ProviderReleaseMatrixEnvelopeV1Schema, \"matrix_structure\"]",
      "const parsed = schema.parse(value);",
    ],
  },
  rootMetadataHistory: {
    schemaSymbol: "ProviderRegistryRootMetadataEnvelopeV1Schema",
    parserSourcePath: "src/provider-registry-trust.ts",
    parserMode: "prepared_history_structure_diagnostic_parse",
    evidence: [
      "ProviderRegistryRootMetadataEnvelopeV1Schema.parse(input)",
    ],
  },
  runtimeAttestation: {
    schemaSymbol: "StoreDurableObjectProviderRuntimeAttestationPinV1Schema",
    parserSourcePath: "src/provider-runtime-attestation-point.ts",
    parserMode: "split_outer_pin_and_payload_parse",
    evidence: [
      "parseRuntimeAttestationPinOuterV1(\n    snapshot.runtimeAttestation,\n  )",
      "StoreDurableObjectProviderRuntimeAttestationV1Schema.parse(\n      runtimePinOuter.payload,\n    )",
    ],
  },
  semanticProviderPolicy: {
    schemaSymbol: "StoreDurableObjectProviderPolicyV1Schema",
    parserSourcePath: "src/provider-runtime-attestation-point.ts",
    parserMode: "prepared_delegated_strict_parse",
    evidence: [
      "parseStrictFieldsV1(\n      StoreDurableObjectProviderPolicyV1Schema,\n      snapshot.semanticProviderPolicy,\n    )",
    ],
  },
  suiteManifest: {
    schemaSymbol: "ProviderRealFilesystemSuiteManifestEnvelopeV1Schema",
    parserSourcePath: "src/provider-target-discovery-point.ts",
    parserMode: "prepared_delegated_parse",
    evidence: [
      "ProviderRealFilesystemSuiteManifestEnvelopeV1Schema.parse(snapshot.suiteManifest)",
    ],
  },
  targetDiscoveryFixtureManifest: {
    schemaSymbol: "ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema",
    parserSourcePath: "src/provider-target-discovery-point.ts",
    parserMode: "prepared_delegated_schema_table_parse",
    evidence: [
      "[snapshot.targetDiscoveryFixtureManifest, ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema, \"fixture_structure\"]",
      "const parsed = schema.parse(value);",
    ],
  },
  targetDiscoveryResult: {
    schemaSymbol: "ProviderTargetDiscoveryResultEnvelopeV1Schema",
    parserSourcePath: "src/provider-target-discovery-point.ts",
    parserMode: "prepared_delegated_schema_table_parse",
    evidence: [
      "[snapshot.targetDiscoveryResult, ProviderTargetDiscoveryResultEnvelopeV1Schema, \"result_structure\"]",
      "const parsed = schema.parse(value);",
    ],
  },
  targetDiscoveryRunnerRun: {
    schemaSymbol: "ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema",
    parserSourcePath: "src/provider-target-discovery-point.ts",
    parserMode: "prepared_delegated_schema_table_parse",
    evidence: [
      "[snapshot.targetDiscoveryRunnerRun, ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema, \"runner_structure\"]",
      "const parsed = schema.parse(value);",
    ],
  },
});

const PARSER_AST_AND_RUNTIME_BINDINGS_V1 = Object.freeze({
  activeRoot: {
    callsiteFunction: "bindCandidateRootV1",
    callsiteKind: "direct_schema_method",
    argumentAnchor: "activeRoot",
    runtimeSchemaSymbol: "ProviderRegistryRootPublicKeyV1Schema",
    runtimeSchemaSourcePath: "src/provider-registry-trust.ts",
    runtimeMethod: "safeParse",
  },
  activeRootMetadata: {
    callsiteFunction: "bindCandidateRootV1",
    callsiteKind: "direct_schema_method",
    argumentAnchor: "activeRootMetadata",
    runtimeSchemaSymbol: "ProviderRegistryRootMetadataPinV1Schema",
    runtimeSchemaSourcePath: "src/provider-registry-trust.ts",
    runtimeMethod: "safeParse",
  },
  bootstrapTrustBundle: {
    callsiteFunction: "validateBootstrapDistributionBindingV1",
    callsiteKind: "direct_schema_method",
    argumentAnchor: "bootstrapTrustBundle",
    runtimeSchemaSymbol: "ProviderBootstrapTrustBundleV1Schema",
    runtimeSchemaSourcePath: "src/bootstrap-trust-bundle.ts",
    runtimeMethod: "parse",
  },
  distributionRootBinding: {
    callsiteFunction: "validateBootstrapDistributionBindingV1",
    callsiteKind: "direct_schema_method",
    argumentAnchor: "distributionRootBinding",
    runtimeSchemaSymbol: "ProviderSignedDistributionRootBindingV1Schema",
    runtimeSchemaSourcePath: "src/provider-distribution-trust.ts",
    runtimeMethod: "parse",
  },
  fixtureCorpusManifest: {
    callsiteFunction: "validatePointClosureInternalV1",
    callsiteKind: "direct_schema_method",
    argumentAnchor: "fixtureCorpusManifest",
    runtimeSchemaSymbol:
      "ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema",
    runtimeSchemaSourcePath: "src/provider-real-filesystem-source.ts",
    runtimeMethod: "parse",
  },
  installationIdentityGenerationId: {
    callsiteFunction: "bindCandidateRootV1",
    callsiteKind: "direct_schema_method",
    argumentAnchor: "installationIdentityGenerationId",
    runtimeSchemaSymbol: "InstallationIdentityGenerationIdV1Schema",
    runtimeSchemaSourcePath: "src/primitives.ts",
    runtimeMethod: "safeParse",
  },
  providerFeasibilityEvidence: {
    callsiteFunction: "validateCompleteEvidenceEnvelopeV1",
    callsiteKind: "direct_schema_method",
    argumentAnchor: "envelope",
    runtimeSchemaSymbol: "ProviderFeasibilityEvidenceEnvelopeV1Schema",
    runtimeSchemaSourcePath: "src/provider-feasibility-evidence-point.ts",
    runtimeMethod: "safeParse",
  },
  providerFeasibilityEvidencePin: {
    callsiteFunction: "validatePreparedEvidencePinStructureV1",
    callsiteKind: "direct_schema_method",
    argumentAnchor: "input",
    runtimeSchemaSymbol: "ProviderFeasibilityEvidencePinV1Schema",
    runtimeSchemaSourcePath: "src/provider-registry-records.ts",
    runtimeMethod: "safeParse",
  },
  publicSupportTaxonomy: {
    callsiteFunction: "validatePointClosureInternalV1",
    callsiteKind: "schema_table",
    argumentAnchor: "publicSupportTaxonomy",
    runtimeSchemaSymbol: "ProviderPublicSupportTaxonomyEnvelopeV1Schema",
    runtimeSchemaSourcePath: "src/provider-target-discovery-point.ts",
    runtimeMethod: "parse",
  },
  realFilesystemConformanceResult: {
    callsiteFunction: "validateResultClosureFromSnapshotInternalV1",
    callsiteKind: "direct_schema_method",
    argumentAnchor: "realFilesystemConformanceResult",
    runtimeSchemaSymbol:
      "ProviderRealFilesystemConformanceResultEnvelopeV1Schema",
    runtimeSchemaSourcePath: "src/provider-real-filesystem-conformance-result.ts",
    runtimeMethod: "parse",
  },
  realFilesystemConformanceResultLocator: {
    callsiteFunction: "validateResultClosureFromSnapshotInternalV1",
    callsiteKind: "direct_schema_method",
    argumentAnchor: "realFilesystemConformanceResultLocator",
    runtimeSchemaSymbol:
      "ProviderRealFilesystemConformanceResultLocatorV1Schema",
    runtimeSchemaSourcePath: "src/provider-real-filesystem-conformance-result.ts",
    runtimeMethod: "parse",
  },
  realFilesystemConformanceResultPin: {
    callsiteFunction: "validateResultClosureFromSnapshotInternalV1",
    callsiteKind: "direct_schema_method",
    argumentAnchor: "realFilesystemConformanceResultPin",
    runtimeSchemaSymbol:
      "ProviderRealFilesystemConformanceResultPinV1Schema",
    runtimeSchemaSourcePath: "src/provider-real-filesystem-conformance-result.ts",
    runtimeMethod: "parse",
  },
  registryManifestHistory: {
    callsiteFunction: "validatePreparedInternalV1",
    callsiteKind: "direct_schema_method",
    argumentAnchor: "envelope",
    runtimeSchemaSymbol: "ProviderRegistryManifestEnvelopeV1Schema",
    runtimeSchemaSourcePath: "src/provider-registry-records.ts",
    runtimeMethod: "safeParse",
  },
  releaseMatrix: {
    callsiteFunction: "validatePointClosureInternalV1",
    callsiteKind: "schema_table",
    argumentAnchor: "releaseMatrix",
    runtimeSchemaSymbol: "ProviderReleaseMatrixEnvelopeV1Schema",
    runtimeSchemaSourcePath: "src/provider-target-discovery-point.ts",
    runtimeMethod: "parse",
  },
  rootMetadataHistory: {
    callsiteFunction:
      "diagnoseProviderRegistryRootMetadataEnvelopeStructureInternalV1",
    callsiteKind: "direct_schema_method",
    argumentAnchor: "input",
    runtimeSchemaSymbol: "ProviderRegistryRootMetadataEnvelopeV1Schema",
    runtimeSchemaSourcePath: "src/provider-registry-trust.ts",
    runtimeMethod: "parse",
  },
  runtimeAttestation: {
    callsiteFunction: "validateRuntimePointClosureFromSnapshotInternalV1",
    callsiteKind: "direct_schema_method",
    argumentAnchor: "payload",
    runtimeSchemaSymbol: "StoreDurableObjectProviderRuntimeAttestationV1Schema",
    runtimeSchemaSourcePath: "src/provider-registry-records.ts",
    runtimeMethod: "parse",
  },
  semanticProviderPolicy: {
    callsiteFunction: "validateRuntimePointClosureFromSnapshotInternalV1",
    callsiteKind: "schema_argument",
    argumentAnchor: "semanticProviderPolicy",
    runtimeSchemaSymbol: "StoreDurableObjectProviderPolicyV1Schema",
    runtimeSchemaSourcePath: "src/provider-runtime-attestation-point.ts",
    runtimeMethod: "parse",
  },
  suiteManifest: {
    callsiteFunction: "validatePointClosureInternalV1",
    callsiteKind: "direct_schema_method",
    argumentAnchor: "suiteManifest",
    runtimeSchemaSymbol:
      "ProviderRealFilesystemSuiteManifestEnvelopeV1Schema",
    runtimeSchemaSourcePath: "src/provider-real-filesystem-source.ts",
    runtimeMethod: "parse",
  },
  targetDiscoveryFixtureManifest: {
    callsiteFunction: "validatePointClosureInternalV1",
    callsiteKind: "schema_table",
    argumentAnchor: "targetDiscoveryFixtureManifest",
    runtimeSchemaSymbol:
      "ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema",
    runtimeSchemaSourcePath: "src/provider-target-discovery-point.ts",
    runtimeMethod: "parse",
  },
  targetDiscoveryResult: {
    callsiteFunction: "validatePointClosureInternalV1",
    callsiteKind: "schema_table",
    argumentAnchor: "targetDiscoveryResult",
    runtimeSchemaSymbol: "ProviderTargetDiscoveryResultEnvelopeV1Schema",
    runtimeSchemaSourcePath: "src/provider-target-discovery-point.ts",
    runtimeMethod: "parse",
  },
  targetDiscoveryRunnerRun: {
    callsiteFunction: "validatePointClosureInternalV1",
    callsiteKind: "schema_table",
    argumentAnchor: "targetDiscoveryRunnerRun",
    runtimeSchemaSymbol: "ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema",
    runtimeSchemaSourcePath: "src/provider-target-discovery-point.ts",
    runtimeMethod: "parse",
  },
});

const LIMITS_V1 = Object.freeze({
  maxObservedIdentities: 4_194_304,
  maxPrecloneAllocationWorkUnits: 268_435_456,
  maxRootMetadataHistoryGenerations: 256,
  maxRegistryManifestHistoryGenerations: 4_096,
  maxTrustEnvelopeRawUnits: 4_194_304,
  maxDistributionRawUnits: 16_777_216,
  maxRetainedTrustHistoryRawUnits: 268_435_456,
  maxRawDepth: 64,
});

const PRIOR_FROZEN_CAPS_V1 = Object.freeze({
  maxObservedIdentities: 2_097_152,
  maxPrecloneAllocationWorkUnits: 16_777_216,
});

const POLICY_CARDINALITY_V1 = Object.freeze({
  maxProviderVerificationPublicKeyRecordsPerProvider: 256,
  maxProviderVerificationPublicKeyRecordsPerUsage: 64,
  maxBindingDerivationGenerationRecordsPerProvider: 64,
  maxApproverPublicKeyRecordsPerRole: 64,
  maxCompromisedRevocationRecordsPerIdentity: 256,
  maxTotalRetainedDistributionObjectCount: 65_536,
  registryManifestJsonContainerEntryHardCap: 65_536,
});

const ZERO_VECTOR = Object.freeze({ identities: 0n, ownKeys: 0n, dense: 0n });
const ZERO_DENSITY = Object.freeze({
  identities: Object.freeze({ numerator: 0n, denominator: 1n }),
  ownKeys: Object.freeze({ numerator: 0n, denominator: 1n }),
  dense: Object.freeze({ numerator: 0n, denominator: 1n }),
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJsonV1(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJsonV1(item)).join(",")}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJsonV1(value[key])}`)
    .join(",")}}`;
}

export function semanticDigestV1(value) {
  return `sha256:${sha256(Buffer.from(canonicalJsonV1(value), "utf8"))}`;
}

export function domainSemanticDigestV1(domain, value) {
  return semanticDigestV1([domain, value]);
}

export function rawSha256V1(value) {
  return `sha256:${sha256(value)}`;
}

export function assertGeneratedSchemaInventoryFreshV1(
  sourceGeneratedSchemas,
  distGeneratedSchemas,
) {
  if (
    canonicalJsonV1(sourceGeneratedSchemas) !==
    canonicalJsonV1(distGeneratedSchemas)
  ) {
    fail(
      "stale dist/json-schema.js: emitted source schema inventory differs from dist",
    );
  }
}

function packageRelativePathV1(packageRoot, fileName) {
  return relative(packageRoot, fileName).replaceAll("\\", "/");
}

function createFreshTypeScriptProgramV1(
  packageRoot,
  sourceOverrides = {},
  compilerOptions = {},
) {
  const configPath = join(packageRoot, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error !== undefined) {
    fail(`cannot read TypeScript config for parser AST proof: ${config.error.messageText}`);
  }
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    packageRoot,
    { noEmit: true, ...compilerOptions },
    configPath,
  );
  if (parsed.errors.length !== 0) {
    fail(
      `cannot parse TypeScript config for parser AST proof: ${parsed.errors[0].messageText}`,
    );
  }
  const overrides = new Map(
    Object.entries(sourceOverrides).map(([sourcePath, source]) => [
      resolve(packageRoot, sourcePath),
      source,
    ]),
  );
  const host = ts.createCompilerHost(parsed.options, true);
  const originalReadFile = host.readFile.bind(host);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.readFile = (fileName) =>
    overrides.get(resolve(fileName)) ?? originalReadFile(fileName);
  host.getSourceFile = (
    fileName,
    languageVersionOrOptions,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    const source = overrides.get(resolve(fileName));
    if (source === undefined) {
      return originalGetSourceFile(
        fileName,
        languageVersionOrOptions,
        onError,
        shouldCreateNewSourceFile,
      );
    }
    const languageVersion =
      typeof languageVersionOrOptions === "number"
        ? languageVersionOrOptions
        : languageVersionOrOptions.languageVersion;
    return ts.createSourceFile(
      fileName,
      source,
      languageVersion,
      true,
      ts.ScriptKind.TS,
    );
  };
  return ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    host,
  });
}

function functionNameV1(node) {
  if (node.name !== undefined && ts.isIdentifier(node.name)) {
    return node.name.text;
  }
  if (
    ts.isVariableDeclaration(node.parent) &&
    ts.isIdentifier(node.parent.name)
  ) {
    return node.parent.name.text;
  }
  return "<anonymous_callback>";
}

function collectFunctionNodesV1(program, packageRoot) {
  const functions = [];
  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.fileName.startsWith(join(packageRoot, "src/"))) continue;
    const visit = (node) => {
      if (ts.isFunctionLike(node) && node.body !== undefined) {
        functions.push(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return functions;
}

function canonicalSymbolV1(checker, node) {
  let symbol = checker.getSymbolAtLocation(node);
  if (symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    symbol = checker.getAliasedSymbol(symbol);
  }
  return symbol;
}

function unwrapExpressionV1(expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

const UNKNOWN_CONSTANT_EXPRESSION_V1 = Symbol("unknown_constant_expression_v1");

function constantExpressionValueV1(expression) {
  const node = unwrapExpressionV1(expression);
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return { truthy: true, nullish: false };
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return { truthy: false, nullish: false };
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return { truthy: false, nullish: true };
  }
  if (ts.isNumericLiteral(node)) {
    return { truthy: Number(node.text) !== 0, nullish: false };
  }
  if (ts.isBigIntLiteral(node)) {
    const value = BigInt(node.text.replaceAll("_", "").replace(/n$/u, ""));
    return { truthy: value !== 0n, nullish: false };
  }
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return { truthy: node.text.length !== 0, nullish: false };
  }
  if (ts.isVoidExpression(node)) {
    return { truthy: false, nullish: true };
  }
  if (ts.isPrefixUnaryExpression(node)) {
    if (node.operator === ts.SyntaxKind.ExclamationToken) {
      const operand = constantExpressionValueV1(node.operand);
      return operand === UNKNOWN_CONSTANT_EXPRESSION_V1
        ? UNKNOWN_CONSTANT_EXPRESSION_V1
        : { truthy: !operand.truthy, nullish: false };
    }
    if (
      (node.operator === ts.SyntaxKind.PlusToken ||
        node.operator === ts.SyntaxKind.MinusToken) &&
      ts.isNumericLiteral(unwrapExpressionV1(node.operand))
    ) {
      const operand = Number(unwrapExpressionV1(node.operand).text);
      const value =
        node.operator === ts.SyntaxKind.MinusToken ? -operand : operand;
      return { truthy: value !== 0, nullish: false };
    }
  }
  return UNKNOWN_CONSTANT_EXPRESSION_V1;
}

function constantTruthinessV1(expression) {
  const value = constantExpressionValueV1(expression);
  return value === UNKNOWN_CONSTANT_EXPRESSION_V1 ? undefined : value.truthy;
}

function constantNullishnessV1(expression) {
  const value = constantExpressionValueV1(expression);
  return value === UNKNOWN_CONSTANT_EXPRESSION_V1 ? undefined : value.nullish;
}

function resolveFunctionTargetsV1(checker, expression, seenSymbols = new Set()) {
  expression = unwrapExpressionV1(expression);
  if (
    (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) &&
    expression.body !== undefined
  ) {
    return [expression];
  }
  if (ts.isConditionalExpression(expression)) {
    const condition = constantTruthinessV1(expression.condition);
    if (condition === true) {
      return resolveFunctionTargetsV1(
        checker,
        expression.whenTrue,
        seenSymbols,
      );
    }
    if (condition === false) {
      return resolveFunctionTargetsV1(
        checker,
        expression.whenFalse,
        seenSymbols,
      );
    }
    return [
      ...new Set([
        ...resolveFunctionTargetsV1(
          checker,
          expression.whenTrue,
          seenSymbols,
        ),
        ...resolveFunctionTargetsV1(
          checker,
          expression.whenFalse,
          seenSymbols,
        ),
      ]),
    ];
  }
  const symbolNode = ts.isPropertyAccessExpression(expression)
    ? expression.name
    : expression;
  const symbol = canonicalSymbolV1(checker, symbolNode);
  if (symbol === undefined || seenSymbols.has(symbol)) return [];
  const nextSeenSymbols = new Set(seenSymbols);
  nextSeenSymbols.add(symbol);
  const targets = [];
  for (const declaration of symbol.declarations ?? []) {
    if (
      (ts.isFunctionDeclaration(declaration) ||
        ts.isMethodDeclaration(declaration) ||
        ts.isFunctionExpression(declaration) ||
        ts.isArrowFunction(declaration)) &&
      declaration.body !== undefined
    ) {
      targets.push(declaration);
    } else if (
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer !== undefined
    ) {
      targets.push(
        ...resolveFunctionTargetsV1(
          checker,
          declaration.initializer,
          nextSeenSymbols,
        ),
      );
    }
  }
  return [...new Set(targets)];
}

function visitOwnFunctionBodyV1(functionNode, visitor) {
  const visit = (node) => {
    if (node !== functionNode && ts.isFunctionLike(node)) return;
    visitor(node);
    ts.forEachChild(node, visit);
  };
  visit(functionNode.body);
}

function enclosingFunctionV1(node) {
  for (let current = node.parent; current !== undefined; current = current.parent) {
    if (ts.isFunctionLike(current) && current.body !== undefined) return current;
  }
  return undefined;
}

function nodeContainsIdentifierV1(node, identifier) {
  let found = false;
  const visit = (current) => {
    if (found) return;
    if (ts.isIdentifier(current) && current.text === identifier) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function nodeContainsSymbolV1(checker, node, symbol) {
  let found = false;
  const visit = (current) => {
    if (found) return;
    if (
      ts.isIdentifier(current) &&
      canonicalSymbolV1(checker, current) === symbol
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function parameterIsInvokedV1(checker, functionNode, parameterIndex) {
  const parameter = functionNode.parameters[parameterIndex];
  if (parameter === undefined || !ts.isIdentifier(parameter.name)) return false;
  const parameterSymbol = canonicalSymbolV1(checker, parameter.name);
  if (parameterSymbol === undefined) return false;
  let invoked = false;
  visitOwnFunctionBodyV1(functionNode, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      canonicalSymbolV1(checker, node.expression) === parameterSymbol &&
      isLexicallyReachableV1(node, functionNode)
    ) {
      invoked = true;
    }
  });
  return invoked;
}

function expressionResolvesRegisteredCallableV1(
  checker,
  expression,
  callableSymbols,
) {
  const node = unwrapExpressionV1(expression);
  if (ts.isConditionalExpression(node)) {
    const condition = constantTruthinessV1(node.condition);
    if (condition === true) {
      return expressionResolvesRegisteredCallableV1(
        checker,
        node.whenTrue,
        callableSymbols,
      );
    }
    if (condition === false) {
      return expressionResolvesRegisteredCallableV1(
        checker,
        node.whenFalse,
        callableSymbols,
      );
    }
    return (
      expressionResolvesRegisteredCallableV1(
        checker,
        node.whenTrue,
        callableSymbols,
      ) ||
      expressionResolvesRegisteredCallableV1(
        checker,
        node.whenFalse,
        callableSymbols,
      )
    );
  }
  const symbolNode = ts.isPropertyAccessExpression(node) ? node.name : node;
  return callableSymbols.has(canonicalSymbolV1(checker, symbolNode));
}

function functionInvokesRegisteredVariableV1(
  checker,
  functionNode,
  registeredVariables,
) {
  const callableSymbols = new Set(registeredVariables);
  let changed = true;
  while (changed) {
    changed = false;
    visitOwnFunctionBodyV1(functionNode, (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer !== undefined &&
        isLexicallyReachableV1(node, functionNode) &&
        expressionResolvesRegisteredCallableV1(
          checker,
          node.initializer,
          callableSymbols,
        )
      ) {
        const alias = canonicalSymbolV1(checker, node.name);
        if (alias !== undefined && !callableSymbols.has(alias)) {
          callableSymbols.add(alias);
          changed = true;
        }
      }
    });
  }
  let invoked = false;
  visitOwnFunctionBodyV1(functionNode, (node) => {
    if (!ts.isCallExpression(node)) return;
    if (!isLexicallyReachableV1(node, functionNode)) return;
    const calleeNode = ts.isPropertyAccessExpression(node.expression)
      ? node.expression.name
      : node.expression;
    if (callableSymbols.has(canonicalSymbolV1(checker, calleeNode))) {
      invoked = true;
    }
  });
  return invoked;
}

function buildTypeScriptFunctionGraphV1(program, packageRoot) {
  const checker = program.getTypeChecker();
  const functions = collectFunctionNodesV1(program, packageRoot);
  const functionSet = new Set(functions);
  const edges = new Map(functions.map((node) => [node, new Set()]));
  const calls = [];
  for (const functionNode of functions) {
    visitOwnFunctionBodyV1(functionNode, (node) => {
      if (!ts.isCallExpression(node)) return;
      if (!isLexicallyReachableV1(node, functionNode)) return;
      const targets = resolveFunctionTargetsV1(checker, node.expression);
      for (const target of targets) {
        if (functionSet.has(target)) edges.get(functionNode).add(target);
      }
      calls.push({ caller: functionNode, call: node, targets });
    });
  }

  // Model callbacks passed through a directly invoked function parameter.
  for (const { call, targets } of calls) {
    for (const target of targets) {
      for (let index = 0; index < call.arguments.length; index += 1) {
        if (!parameterIsInvokedV1(checker, target, index)) continue;
        for (const callback of resolveFunctionTargetsV1(
          checker,
          call.arguments[index],
        )) {
          if (functionSet.has(callback)) edges.get(target).add(callback);
        }
      }
    }
  }

  // Model package-private module-initialization registration seams. The
  // register function must assign its callback parameter to a concrete module
  // variable, and the bridge must actually invoke that same variable.
  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.fileName.startsWith(join(packageRoot, "src/"))) continue;
    for (const statement of sourceFile.statements) {
      if (
        !ts.isExpressionStatement(statement) ||
        !ts.isCallExpression(statement.expression) ||
        statement.expression.arguments.length === 0
      ) {
        continue;
      }
      const registrationCall = statement.expression;
      const registrationFunction = enclosingFunctionV1(registrationCall);
      if (
        registrationFunction !== undefined &&
        !isLexicallyReachableV1(registrationCall, registrationFunction)
      ) {
        continue;
      }
      const callbacks = resolveFunctionTargetsV1(
        checker,
        registrationCall.arguments[0],
      ).filter((node) => functionSet.has(node));
      if (callbacks.length === 0) continue;
      for (const registerFunction of resolveFunctionTargetsV1(
        checker,
        registrationCall.expression,
      )) {
        const parameter = registerFunction.parameters[0];
        if (parameter === undefined || !ts.isIdentifier(parameter.name)) continue;
        const parameterSymbol = canonicalSymbolV1(checker, parameter.name);
        if (parameterSymbol === undefined) continue;
        const registeredVariables = new Set();
        visitOwnFunctionBodyV1(registerFunction, (node) => {
          if (
            ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isIdentifier(node.left) &&
            nodeContainsSymbolV1(checker, node.right, parameterSymbol) &&
            isLexicallyReachableV1(node, registerFunction)
          ) {
            const registered = canonicalSymbolV1(checker, node.left);
            if (registered !== undefined) registeredVariables.add(registered);
          }
        });
        for (const caller of functions) {
          if (
            !functionInvokesRegisteredVariableV1(
              checker,
              caller,
              registeredVariables,
            )
          ) {
            continue;
          }
          for (const callback of callbacks) edges.get(caller).add(callback);
        }
      }
    }
  }
  return { checker, functions, edges };
}

function statementDefinitelyAbruptV1(statement) {
  if (
    ts.isReturnStatement(statement) ||
    ts.isThrowStatement(statement) ||
    ts.isBreakStatement(statement) ||
    ts.isContinueStatement(statement)
  ) {
    return true;
  }
  if (ts.isBlock(statement)) {
    return statement.statements.some((child) =>
      statementDefinitelyAbruptV1(child),
    );
  }
  if (ts.isIfStatement(statement)) {
    const condition = constantTruthinessV1(statement.expression);
    if (condition === true) {
      return statementDefinitelyAbruptV1(statement.thenStatement);
    }
    if (condition === false) {
      return (
        statement.elseStatement !== undefined &&
        statementDefinitelyAbruptV1(statement.elseStatement)
      );
    }
    return (
      statement.elseStatement !== undefined &&
      statementDefinitelyAbruptV1(statement.thenStatement) &&
      statementDefinitelyAbruptV1(statement.elseStatement)
    );
  }
  if (ts.isTryStatement(statement)) {
    if (
      statement.finallyBlock !== undefined &&
      statementDefinitelyAbruptV1(statement.finallyBlock)
    ) {
      return true;
    }
    if (!statementDefinitelyAbruptV1(statement.tryBlock)) return false;
    return (
      statement.catchClause === undefined ||
      statementDefinitelyAbruptV1(statement.catchClause.block)
    );
  }
  // A break targeting the label completes the labeled statement normally, so
  // do not infer abrupt completion across the label boundary. Dead statements
  // after that break are still rejected by the inner block's sequential scan.
  if (ts.isLabeledStatement(statement)) return false;
  return false;
}

function optionalChainSkipsChildV1(parent, current) {
  if (
    ts.isCallExpression(parent) &&
    (parent.questionDotToken !== undefined ||
      ((ts.isPropertyAccessExpression(parent.expression) ||
        ts.isElementAccessExpression(parent.expression)) &&
        parent.expression.questionDotToken !== undefined)) &&
    parent.arguments.some(
      (argument) => argument.pos <= current.pos && current.end <= argument.end,
    )
  ) {
    const callee = unwrapExpressionV1(parent.expression);
    const base = ts.isPropertyAccessExpression(callee)
      ? callee.expression
      : ts.isElementAccessExpression(callee)
        ? callee.expression
        : callee;
    return constantNullishnessV1(base) === true;
  }
  if (
    (ts.isPropertyAccessExpression(parent) ||
      ts.isElementAccessExpression(parent)) &&
    parent.questionDotToken !== undefined &&
    current !== parent.expression
  ) {
    return constantNullishnessV1(parent.expression) === true;
  }
  return false;
}

function isLexicallyReachableV1(node, functionNode) {
  for (let current = node; current !== functionNode; current = current.parent) {
    const parent = current.parent;
    if (parent === undefined) return false;
    if (optionalChainSkipsChildV1(parent, current)) return false;
    if (ts.isIfStatement(parent)) {
      const condition = constantTruthinessV1(parent.expression);
      if (condition === false && current === parent.thenStatement) {
        return false;
      }
      if (condition === true && current === parent.elseStatement) {
        return false;
      }
    }
    if (
      ts.isWhileStatement(parent) &&
      current === parent.statement &&
      constantTruthinessV1(parent.expression) === false
    ) {
      return false;
    }
    if (
      ts.isForStatement(parent) &&
      current === parent.statement &&
      parent.condition !== undefined &&
      constantTruthinessV1(parent.condition) === false
    ) {
      return false;
    }
    if (
      ts.isBinaryExpression(parent) &&
      parent.right === current &&
      ((parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
        constantTruthinessV1(parent.left) === false) ||
        (parent.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
          constantTruthinessV1(parent.left) === true) ||
        (parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
          constantNullishnessV1(parent.left) === false))
    ) {
      return false;
    }
    if (ts.isConditionalExpression(parent)) {
      const condition = constantTruthinessV1(parent.condition);
      if (
        (parent.whenTrue === current &&
          condition === false) ||
        (parent.whenFalse === current &&
          condition === true)
      ) {
        return false;
      }
    }
    if (ts.isBlock(parent)) {
      const containingStatement = parent.statements.find((statement) =>
        statement.pos <= current.pos && current.end <= statement.end,
      );
      if (containingStatement !== undefined) {
        const statementIndex = parent.statements.indexOf(containingStatement);
        for (let index = 0; index < statementIndex; index += 1) {
          if (statementDefinitelyAbruptV1(parent.statements[index])) return false;
        }
      }
    }
  }
  return true;
}

function findParserCallsiteV1(
  checker,
  functionNode,
  binding,
  expectedSchemaSymbol,
  sourceFile,
  { requireLexicallyReachable = true, rejectOptionalChain = true } = {},
) {
  const candidates = [];
  visitOwnFunctionBodyV1(functionNode, (node) => {
    if (binding.callsiteKind === "direct_schema_method") {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        canonicalSymbolV1(checker, node.expression.expression) ===
          expectedSchemaSymbol &&
        node.expression.name.text === binding.runtimeMethod &&
        node.arguments.some((argument) =>
          nodeContainsIdentifierV1(argument, binding.argumentAnchor),
        )
      ) {
        candidates.push(node);
      }
      return;
    }
    if (binding.callsiteKind === "schema_argument") {
      if (
        ts.isCallExpression(node) &&
        node.arguments.some(
          (argument) =>
            ts.isIdentifier(argument) &&
            canonicalSymbolV1(checker, argument) === expectedSchemaSymbol,
        ) &&
        node.arguments.some((argument) =>
          nodeContainsIdentifierV1(argument, binding.argumentAnchor),
        )
      ) {
        candidates.push(node);
      }
      return;
    }
    if (
      binding.callsiteKind === "schema_table" &&
      ts.isArrayLiteralExpression(node) &&
      node.elements.some(
        (element) =>
          ts.isIdentifier(element) &&
          canonicalSymbolV1(checker, element) === expectedSchemaSymbol,
      ) &&
      node.elements.some((element) =>
        nodeContainsIdentifierV1(element, binding.argumentAnchor),
      )
    ) {
      candidates.push(node);
    }
  });
  const eligible = candidates.filter((candidate) => {
    if (
      rejectOptionalChain &&
      parserCallsiteUsesOptionalChainV1(candidate, functionNode)
    ) {
      return false;
    }
    return (
      !requireLexicallyReachable ||
      isLexicallyReachableV1(candidate, functionNode)
    );
  });
  if (eligible.length !== 1) {
    fail(
      `${binding.runtimeSchemaSymbol} parser AST callsite in ${functionNameV1(functionNode)} expected exactly one ${requireLexicallyReachable ? "reachable " : ""}match, observed ${eligible.length}`,
    );
  }
  const callsite = eligible[0];
  const line = sourceFile.getLineAndCharacterOfPosition(callsite.getStart()).line + 1;
  const printer = ts.createPrinter({ removeComments: true });
  return {
    callsite,
    line,
    semanticDigest: semanticDigestV1({
      kind: binding.callsiteKind,
      ast: printer.printNode(ts.EmitHint.Unspecified, callsite, sourceFile),
    }),
  };
}

function parserCallsiteUsesOptionalChainV1(node, functionNode) {
  for (let current = node; current !== functionNode; current = current.parent) {
    if (
      (ts.isCallExpression(current) ||
        ts.isPropertyAccessExpression(current) ||
        ts.isElementAccessExpression(current)) &&
      (current.questionDotToken !== undefined ||
        (ts.isCallExpression(current) &&
          (ts.isPropertyAccessExpression(current.expression) ||
            ts.isElementAccessExpression(current.expression)) &&
          current.expression.questionDotToken !== undefined))
    ) {
      return true;
    }
    if (current.parent === undefined) return true;
  }
  return false;
}

function collectProductionParserAstBindingsInternalV1({
  packageRoot,
  program,
  requireLexicallyReachable,
  rejectOptionalChain,
}) {
  const syntacticDiagnostics = program.getSyntacticDiagnostics();
  if (syntacticDiagnostics.length !== 0) {
    fail(`mutated parser source is not syntactically valid TypeScript`);
  }
  const { checker, functions, edges } = buildTypeScriptFunctionGraphV1(
    program,
    packageRoot,
  );
  const entrySourcePath = "src/provider-registry-evidence-binding-point.ts";
  const entry = functions.find(
    (node) =>
      functionNameV1(node) ===
        "validateProviderRegistryEvidenceBindingPointClosureV1" &&
      packageRelativePathV1(packageRoot, node.getSourceFile().fileName) ===
        entrySourcePath,
  );
  if (
    entry === undefined ||
    entry.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    ) !== true
  ) {
    fail("production parser AST entry export is unavailable");
  }
  const previous = new Map([[entry, undefined]]);
  const queue = [entry];
  while (queue.length !== 0) {
    const current = queue.shift();
    for (const target of edges.get(current) ?? []) {
      if (previous.has(target)) continue;
      previous.set(target, current);
      queue.push(target);
    }
  }
  return JSON_BRANCH_KEYS_V1.map((branch) => {
    const parserBinding = PRODUCTION_PARSER_BINDINGS_V1[branch];
    const binding = PARSER_AST_AND_RUNTIME_BINDINGS_V1[branch];
    const callsiteFunction = functions.find(
      (node) =>
        functionNameV1(node) === binding.callsiteFunction &&
        packageRelativePathV1(packageRoot, node.getSourceFile().fileName) ===
          parserBinding.parserSourcePath,
    );
    if (callsiteFunction === undefined) {
      fail(`${branch} parser AST callsite function is unavailable`);
    }
    if (!previous.has(callsiteFunction)) {
      const reachablePreparedFunctions = functions
        .filter((node) => previous.has(node))
        .map((node) => functionNameV1(node))
        .filter((name) =>
          /(?:Prepared|prepared|Runtime|runtime|Result|result|Target|target)/u.test(name),
        )
        .sort();
      fail(
        `${branch} parser AST callsite is unreachable from the exported entry; reachable bridge functions=${canonicalJsonV1(reachablePreparedFunctions)}`,
      );
    }
    const runtimeSchemaSourceFile = program.getSourceFile(
      join(packageRoot, binding.runtimeSchemaSourcePath),
    );
    const runtimeSchemaModuleSymbol =
      runtimeSchemaSourceFile === undefined
        ? undefined
        : checker.getSymbolAtLocation(runtimeSchemaSourceFile);
    const runtimeSchemaExport =
      runtimeSchemaModuleSymbol === undefined
        ? undefined
        : checker
            .getExportsOfModule(runtimeSchemaModuleSymbol)
            .find((symbol) => symbol.name === binding.runtimeSchemaSymbol);
    const expectedSchemaSymbol =
      runtimeSchemaExport !== undefined &&
      (runtimeSchemaExport.flags & ts.SymbolFlags.Alias) !== 0
        ? checker.getAliasedSymbol(runtimeSchemaExport)
        : runtimeSchemaExport;
    if (expectedSchemaSymbol === undefined) {
      fail(
        `${branch} runtime schema is not an actual export of ${binding.runtimeSchemaSourcePath}: ${binding.runtimeSchemaSymbol}`,
      );
    }
    const sourceFile = callsiteFunction.getSourceFile();
    const callsite = findParserCallsiteV1(
      checker,
      callsiteFunction,
      binding,
      expectedSchemaSymbol,
      sourceFile,
      { requireLexicallyReachable, rejectOptionalChain },
    );
    const chain = [];
    for (
      let current = callsiteFunction;
      current !== undefined;
      current = previous.get(current)
    ) {
      chain.push(
        `${packageRelativePathV1(packageRoot, current.getSourceFile().fileName)}#${functionNameV1(current)}`,
      );
    }
    chain.reverse();
    const publicRow = {
      branch,
      exportedEntry: `${entrySourcePath}#validateProviderRegistryEvidenceBindingPointClosureV1`,
      callsiteFunction: binding.callsiteFunction,
      callsiteKind: binding.callsiteKind,
      argumentAnchor: binding.argumentAnchor,
      runtimeSchemaSymbol: binding.runtimeSchemaSymbol,
      runtimeSchemaSourcePath: binding.runtimeSchemaSourcePath,
      runtimeMethod: binding.runtimeMethod,
      runtimeSchemaExportResolved: true,
      astReachable: true,
      astCallsiteLine: callsite.line,
      astCallsiteSemanticDigest: callsite.semanticDigest,
      astCallChain: chain,
    };
    return {
      ...publicRow,
      callsite: callsite.callsite,
      callsiteFunctionNode: callsiteFunction,
      expectedSchemaSymbol,
      exactCallsiteId: `exact_ast_callsite_v1:${branch}:${callsite.semanticDigest}`,
      publicRow,
    };
  });
}

export function assertProductionParserAstBindingsV1({
  packageRoot,
  sourceOverrides = {},
} = {}) {
  if (typeof packageRoot !== "string") fail("packageRoot is required for parser AST proof");
  const program = createFreshTypeScriptProgramV1(packageRoot, sourceOverrides);
  return collectProductionParserAstBindingsInternalV1({
    packageRoot,
    program,
    requireLexicallyReachable: true,
    rejectOptionalChain: true,
  }).map(({ publicRow }) => publicRow);
}

function runtimeModulePathForSourceV1(runtimeModuleRoot, sourcePath) {
  if (!sourcePath.startsWith("src/") || !sourcePath.endsWith(".ts")) {
    fail(`runtime trace source path is not a TypeScript module: ${sourcePath}`);
  }
  return join(
    runtimeModuleRoot,
    `${sourcePath.slice("src/".length, -".ts".length)}.js`,
  );
}

async function importRuntimeModuleForSourceV1(runtimeModuleRoot, sourcePath) {
  return import(
    pathToFileURL(runtimeModulePathForSourceV1(runtimeModuleRoot, sourcePath)).href
  );
}

function findSchemaTableConsumerV1(checker, astBindings) {
  const tableBindings = astBindings.filter(
    ({ callsiteKind }) => callsiteKind === "schema_table",
  );
  if (tableBindings.length !== 5) {
    fail(
      `exact parser runtime trace expected five schema-table bindings, observed ${tableBindings.length}`,
    );
  }
  const tableFunctions = [...new Set(
    tableBindings.map(({ callsiteFunctionNode }) => callsiteFunctionNode),
  )];
  if (tableFunctions.length !== 1) {
    fail("schema-table parser rows do not share one production consumer function");
  }
  const functionNode = tableFunctions[0];
  const candidates = [];
  visitOwnFunctionBodyV1(functionNode, (node) => {
    if (
      !ts.isCallExpression(node) ||
      !ts.isPropertyAccessExpression(node.expression) ||
      node.expression.name.text !== "parse" ||
      !ts.isIdentifier(node.expression.expression) ||
      node.arguments.length !== 1 ||
      !ts.isIdentifier(node.arguments[0])
    ) {
      return;
    }
    const schemaSymbol = canonicalSymbolV1(
      checker,
      node.expression.expression,
    );
    const valueSymbol = canonicalSymbolV1(checker, node.arguments[0]);
    if (schemaSymbol === undefined || valueSymbol === undefined) return;
    for (let current = node.parent; current !== functionNode; current = current.parent) {
      if (current === undefined) return;
      if (!ts.isForOfStatement(current)) continue;
      const declarations = current.initializer.declarations;
      if (declarations.length !== 1) return;
      const bindingName = declarations[0].name;
      if (!ts.isArrayBindingPattern(bindingName)) return;
      const boundSymbols = bindingName.elements
        .filter(ts.isBindingElement)
        .map((element) =>
          ts.isIdentifier(element.name)
            ? canonicalSymbolV1(checker, element.name)
            : undefined,
        );
      if (
        boundSymbols.includes(valueSymbol) &&
        boundSymbols.includes(schemaSymbol)
      ) {
        candidates.push(node);
      }
      return;
    }
  });
  if (candidates.length !== 1) {
    fail(
      `schema-table generic schema.parse(value) consumer expected exactly one match, observed ${candidates.length}`,
    );
  }
  return candidates[0];
}

function createExactParserCallsiteTransformerV1({
  astBindings,
  checker,
  hookKey,
  schemaTableConsumer,
}) {
  const bindingByNode = new Map(
    astBindings.map((binding) => [binding.callsite, binding]),
  );
  const tableElementIndexes = new Map();
  for (const binding of astBindings) {
    if (binding.callsiteKind !== "schema_table") continue;
    if (!ts.isArrayLiteralExpression(binding.callsite)) {
      fail(`${binding.branch} schema-table exact callsite is not an array row`);
    }
    const schemaIndexes = [];
    const valueIndexes = [];
    for (let index = 0; index < binding.callsite.elements.length; index += 1) {
      const element = binding.callsite.elements[index];
      if (
        ts.isIdentifier(element) &&
        canonicalSymbolV1(checker, element) === binding.expectedSchemaSymbol
      ) {
        schemaIndexes.push(index);
      }
      if (nodeContainsIdentifierV1(element, binding.argumentAnchor)) {
        valueIndexes.push(index);
      }
    }
    if (schemaIndexes.length !== 1 || valueIndexes.length !== 1) {
      fail(
        `${binding.branch} schema-table row does not have one exact value/schema element`,
      );
    }
    tableElementIndexes.set(binding.callsite, {
      schemaIndex: schemaIndexes[0],
      valueIndex: valueIndexes[0],
    });
  }

  return (context) => {
    const factory = context.factory;
    const hookExpression = () =>
      factory.createElementAccessExpression(
        factory.createIdentifier("globalThis"),
        factory.createStringLiteral(hookKey),
      );
    const hookCall = (method, argumentsList) =>
      factory.createCallExpression(
        factory.createPropertyAccessExpression(hookExpression(), method),
        undefined,
        argumentsList,
      );
    const comma = (left, right) =>
      factory.createParenthesizedExpression(
        factory.createBinaryExpression(
          left,
          factory.createToken(ts.SyntaxKind.CommaToken),
          right,
        ),
      );
    const visitor = (node) => {
      const binding = bindingByNode.get(node);
      if (binding !== undefined) {
        const visited = ts.visitEachChild(node, visitor, context);
        if (binding.callsiteKind === "schema_table") {
          if (!ts.isArrayLiteralExpression(visited)) {
            fail(`${binding.branch} transformed schema-table row changed kind`);
          }
          const indexes = tableElementIndexes.get(node);
          if (indexes === undefined) {
            fail(`${binding.branch} schema-table element indexes are unavailable`);
          }
          const elements = [...visited.elements];
          const value = elements[indexes.valueIndex];
          const schema = elements[indexes.schemaIndex];
          if (value === undefined || schema === undefined) {
            fail(`${binding.branch} schema-table transformed elements drifted`);
          }
          elements[indexes.valueIndex] = hookCall("mark", [
            factory.createStringLiteral(binding.exactCallsiteId),
            value,
            schema,
          ]);
          return factory.updateArrayLiteralExpression(visited, elements);
        }
        if (!ts.isCallExpression(visited)) {
          fail(`${binding.branch} transformed exact parser call changed kind`);
        }
        return comma(
          hookCall("hit", [
            factory.createStringLiteral(binding.exactCallsiteId),
          ]),
          visited,
        );
      }
      if (node === schemaTableConsumer) {
        const visited = ts.visitEachChild(node, visitor, context);
        if (
          !ts.isCallExpression(visited) ||
          !ts.isPropertyAccessExpression(visited.expression) ||
          !ts.isIdentifier(visited.expression.expression) ||
          visited.arguments.length !== 1
        ) {
          fail("transformed schema-table consumer changed kind");
        }
        return comma(
          hookCall("hitMarked", [
            visited.arguments[0],
            visited.expression.expression,
          ]),
          visited,
        );
      }
      return ts.visitEachChild(node, visitor, context);
    };
    return (sourceFile) => ts.visitNode(sourceFile, visitor);
  };
}

function formatTypeScriptDiagnosticV1(diagnostic) {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
}

async function emitFreshParserRuntimeGraphV1({
  packageRoot,
  sourceOverrides,
  instrumented,
  hookKey,
}) {
  const runtimeModuleRoot = await mkdtemp(
    join(packageRoot, ".topology-proof-parser-runtime-"),
  );
  try {
    const program = createFreshTypeScriptProgramV1(
      packageRoot,
      sourceOverrides,
      {
        noEmit: false,
        outDir: runtimeModuleRoot,
        declaration: false,
        declarationMap: false,
        sourceMap: false,
        incremental: false,
      },
    );
    const astBindings = instrumented
      ? collectProductionParserAstBindingsInternalV1({
          packageRoot,
          program,
          requireLexicallyReachable: false,
          rejectOptionalChain: false,
        })
      : [];
    if (
      instrumented &&
      astBindings.length !== JSON_BRANCH_KEYS_V1.length
    ) {
      fail(
        `fresh parser runtime emit expected 21 exact AST bindings, observed ${astBindings.length}`,
      );
    }
    const checker = instrumented ? program.getTypeChecker() : undefined;
    const schemaTableConsumer = instrumented
      ? findSchemaTableConsumerV1(checker, astBindings)
      : undefined;
    const diagnostics = ts.getPreEmitDiagnostics(program);
    if (diagnostics.length !== 0) {
      fail(
        `fresh parser runtime emit TypeScript diagnostic: ${formatTypeScriptDiagnosticV1(diagnostics[0])}`,
      );
    }
    const emitResult = program.emit(
      undefined,
      undefined,
      undefined,
      false,
      instrumented
        ? {
            before: [
              createExactParserCallsiteTransformerV1({
                astBindings,
                checker,
                hookKey,
                schemaTableConsumer,
              }),
            ],
          }
        : undefined,
    );
    if (emitResult.emitSkipped || emitResult.diagnostics.length !== 0) {
      const diagnostic = emitResult.diagnostics[0];
      fail(
        diagnostic === undefined
          ? "fresh parser runtime emit was skipped"
          : `fresh parser runtime emit failed: ${formatTypeScriptDiagnosticV1(diagnostic)}`,
      );
    }
    return {
      runtimeModuleRoot,
      astBindings,
      schemaTableConsumerCount: instrumented ? 1 : 0,
    };
  } catch (error) {
    await rm(runtimeModuleRoot, { recursive: true, force: true });
    throw error;
  }
}

function installExactParserRuntimeHookV1({ hookKey, astBindings }) {
  if (Object.prototype.hasOwnProperty.call(globalThis, hookKey)) {
    fail("exact parser runtime hook key unexpectedly already exists");
  }
  const exactIds = new Set(
    astBindings.map(({ exactCallsiteId }) => exactCallsiteId),
  );
  const exactHits = new Map(
    [...exactIds].map((exactCallsiteId) => [exactCallsiteId, 0]),
  );
  const expectedSchemas = new Map();
  const markedValues = new WeakMap();
  const hook = Object.freeze({
    hit(exactCallsiteId) {
      if (!exactIds.has(exactCallsiteId)) {
        fail(`unknown exact parser runtime callsite ID: ${exactCallsiteId}`);
      }
      exactHits.set(exactCallsiteId, exactHits.get(exactCallsiteId) + 1);
    },
    mark(exactCallsiteId, value, schema) {
      if (!exactIds.has(exactCallsiteId)) {
        fail(`unknown schema-table runtime callsite ID: ${exactCallsiteId}`);
      }
      if (expectedSchemas.get(exactCallsiteId) !== schema) {
        fail(`schema-table runtime schema identity mismatch: ${exactCallsiteId}`);
      }
      if (
        value === null ||
        (typeof value !== "object" && typeof value !== "function")
      ) {
        fail(`schema-table runtime value is not WeakMap-addressable: ${exactCallsiteId}`);
      }
      if (markedValues.has(value)) {
        fail(`schema-table runtime value was marked more than once: ${exactCallsiteId}`);
      }
      markedValues.set(value, { exactCallsiteId, schema });
      return value;
    },
    hitMarked(value, schema) {
      if (
        value === null ||
        (typeof value !== "object" && typeof value !== "function")
      ) {
        return;
      }
      const marked = markedValues.get(value);
      if (marked === undefined) return;
      if (marked.schema !== schema) {
        fail("schema-table runtime consumer schema identity mismatched its exact marked row");
      }
      if (expectedSchemas.get(marked.exactCallsiteId) !== schema) {
        fail(`schema-table runtime consumer schema identity mismatch: ${marked.exactCallsiteId}`);
      }
      markedValues.delete(value);
      exactHits.set(
        marked.exactCallsiteId,
        exactHits.get(marked.exactCallsiteId) + 1,
      );
    },
  });
  Object.defineProperty(globalThis, hookKey, {
    value: hook,
    enumerable: false,
    configurable: true,
    writable: false,
  });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, hookKey);
  if (
    descriptor?.value !== hook ||
    descriptor.enumerable !== false ||
    descriptor.configurable !== true ||
    descriptor.writable !== false ||
    !Object.isFrozen(hook)
  ) {
    fail("exact parser runtime hook property hardening failed");
  }
  return { exactHits, expectedSchemas };
}

function removeExactParserRuntimeHookV1(hookKey) {
  if (!Reflect.deleteProperty(globalThis, hookKey)) {
    fail("exact parser runtime hook could not be deleted");
  }
  if (Object.prototype.hasOwnProperty.call(globalThis, hookKey)) {
    fail("exact parser runtime hook left a residual global property");
  }
}

async function runFreshParserRuntimeGraphV1({
  packageRoot,
  compatibleBase,
  emittedGraph,
  hookKey,
  instrumented,
}) {
  const methodHits = Object.fromEntries(
    JSON_BRANCH_KEYS_V1.map((branch) => [branch, { parse: 0, safeParse: 0 }]),
  );
  const restorations = [];
  let hookState;
  let hookInstalled = false;
  try {
    if (instrumented) {
      hookState = installExactParserRuntimeHookV1({
        hookKey,
        astBindings: emittedGraph.astBindings,
      });
      hookInstalled = true;
      for (const binding of emittedGraph.astBindings) {
        const schemaModule = await importRuntimeModuleForSourceV1(
          emittedGraph.runtimeModuleRoot,
          binding.runtimeSchemaSourcePath,
        );
        const schema = schemaModule[binding.runtimeSchemaSymbol];
        if (schema === null || typeof schema !== "object") {
          fail(`${binding.branch} runtime trace schema export is unavailable`);
        }
        hookState.expectedSchemas.set(binding.exactCallsiteId, schema);
        for (const method of ["parse", "safeParse"]) {
          const original = schema[method];
          if (typeof original !== "function") {
            fail(`${binding.branch} runtime trace schema method ${method} is unavailable`);
          }
          const descriptor = Object.getOwnPropertyDescriptor(schema, method);
          if (
            descriptor === undefined ||
            descriptor.writable !== true ||
            descriptor.configurable !== true
          ) {
            fail(`${binding.branch} runtime trace schema method ${method} is not injectable`);
          }
          schema[method] = function auxiliaryTracedSchemaMethodV1(...argumentsList) {
            methodHits[binding.branch][method] += 1;
            return Reflect.apply(original, this, argumentsList);
          };
          restorations.push(() => {
            schema[method] = original;
          });
        }
      }
    }

    const conformanceModule = await importRuntimeModuleForSourceV1(
      emittedGraph.runtimeModuleRoot,
      "src/strict-ed25519-conformance.ts",
    );
    const strictModule = await importRuntimeModuleForSourceV1(
      emittedGraph.runtimeModuleRoot,
      "src/strict-ed25519.ts",
    );
    const strictManifestBytes = new Uint8Array(
      readFileSync(
        join(
          packageRoot,
          conformanceModule.PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
        ),
      ),
    );
    let pointAdmissionCount = 0;
    let signatureVerificationCount = 0;
    const capability =
      await conformanceModule.attestProviderStrictEd25519CryptoHostV1({
        host: Object.freeze({
          verificationProfile:
            strictModule.STRICT_ED25519_VERIFICATION_PROFILE_V1,
          validatePrimeSubgroupPoint(encodedPoint) {
            pointAdmissionCount += 1;
            return strictModule.validatePrimeSubgroupPoint(encodedPoint);
          },
          verifyRawEd25519(publicKey, message, signature) {
            signatureVerificationCount += 1;
            return strictModule.verifyRawEd25519(
              publicKey,
              message,
              signature,
            );
          },
        }),
        resourceHost: Object.freeze({
          readFixedSignedPackageResource(resourcePath, maxBytes) {
            if (
              resourcePath !==
                conformanceModule.PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
              maxBytes !==
                conformanceModule.PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
            ) {
              fail("strict Ed25519 runtime trace resource request drifted");
            }
            return strictManifestBytes.slice();
          },
        }),
      });
    pointAdmissionCount = 0;
    signatureVerificationCount = 0;
    const pointModule = await importRuntimeModuleForSourceV1(
      emittedGraph.runtimeModuleRoot,
      "src/provider-registry-evidence-binding-point.ts",
    );
    const result =
      await pointModule.validateProviderRegistryEvidenceBindingPointClosureV1({
        ...structuredClone(compatibleBase),
        strictCryptoCapability: capability,
      });
    if (
      result?.authority !==
      "none_registry_entry_evidence_binding_structure_only"
    ) {
      fail("fresh compatible-base parser runtime trace did not reach success");
    }
    if (pointAdmissionCount !== 24 || signatureVerificationCount !== 46) {
      fail(
        `fresh compatible-base parser runtime crypto closure drifted: ${pointAdmissionCount}/${signatureVerificationCount}`,
      );
    }
    const capturedMethodHits = structuredClone(methodHits);
    const fixtureModule = await importRuntimeModuleForSourceV1(
      emittedGraph.runtimeModuleRoot,
      "src/provider-registry-evidence-binding-point-fixtures.ts",
    );
    const successProjection =
      fixtureModule.projectProviderRegistryEvidenceBindingPointClosureSnapshotV1(
        result,
      );
    if (Object.keys(successProjection).length !== 10) {
      fail("fresh compatible-base parser runtime projection is not ten fields");
    }
    return {
      compatibleBaseAccepted: true,
      pointAdmissionCount,
      signatureVerificationCount,
      successProjection,
      methodHits: capturedMethodHits,
      exactHits: hookState?.exactHits,
      hookInstalledWithHardenedOwnProperty: instrumented,
    };
  } finally {
    for (let index = restorations.length - 1; index >= 0; index -= 1) {
      restorations[index]();
    }
    if (hookInstalled) removeExactParserRuntimeHookV1(hookKey);
  }
}

function isPlainJsonObjectV1(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    CapturedObjectGetPrototypeOfV1(value) === CapturedObjectPrototypeV1
  );
}

function assertExactObjectKeysV1(value, expectedKeys, label) {
  if (!isPlainJsonObjectV1(value)) {
    fail(`${label} is not a plain JSON object`);
  }
  const observedKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  if (canonicalJsonV1(observedKeys) !== canonicalJsonV1(sortedExpectedKeys)) {
    fail(
      `${label} keys drifted: expected ${canonicalJsonV1(sortedExpectedKeys)}, observed ${canonicalJsonV1(observedKeys)}`,
    );
  }
}

function assertNonnegativeSafeIntegerV1(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail(`${label} is not a nonnegative safe integer`);
  }
}

function snapshotParserRuntimeSourceOverridesV1(packageRoot, sourceOverrides) {
  if (!isPlainJsonObjectV1(sourceOverrides)) {
    fail("parser runtime worker sourceOverrides is not a plain object");
  }
  const ownKeys = CapturedReflectOwnKeysV1(sourceOverrides);
  const snapshot = CapturedObjectCreateV1(
    CapturedObjectPrototypeV1,
  );
  for (const sourcePath of ownKeys) {
    if (typeof sourcePath !== "string") {
      fail("parser runtime worker source override keys must be strings");
    }
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
      sourceOverrides,
      sourcePath,
    );
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      !CapturedObjectHasOwnV1(descriptor, "value")
    ) {
      fail(
        `parser runtime worker source override must be an enumerable data property: ${sourcePath}`,
      );
    }
    const source = descriptor.value;
    const resolvedSourcePath = resolve(packageRoot, sourcePath);
    const relativeSourcePath = packageRelativePathV1(
      packageRoot,
      resolvedSourcePath,
    );
    if (
      !/^src\/[a-zA-Z0-9_./-]+\.ts$/u.test(sourcePath) ||
      relativeSourcePath !== sourcePath ||
      relativeSourcePath.startsWith("../") ||
      typeof source !== "string"
    ) {
      fail(`parser runtime worker source override is invalid: ${sourcePath}`);
    }
    CapturedObjectDefinePropertyV1(snapshot, sourcePath, {
      value: source,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return CapturedObjectFreezeV1(snapshot);
}

export async function runProductionParserRuntimePhaseDirectV1({
  packageRoot,
  compatibleBase,
  sourceOverrides = {},
  phase,
  requestNonce,
} = {}) {
  if (typeof packageRoot !== "string") {
    fail("packageRoot is required for direct parser runtime worker phase");
  }
  packageRoot = resolve(packageRoot);
  if (compatibleBase === null || typeof compatibleBase !== "object") {
    fail("compatibleBase is required for direct parser runtime worker phase");
  }
  sourceOverrides = snapshotParserRuntimeSourceOverridesV1(
    packageRoot,
    sourceOverrides,
  );
  if (phase !== "uninstrumented" && phase !== "instrumented") {
    fail(`parser runtime worker phase is invalid: ${String(phase)}`);
  }
  if (
    typeof requestNonce !== "string" ||
    !/^[0-9a-f]{48}$/u.test(requestNonce)
  ) {
    fail("parser runtime worker request nonce is invalid");
  }
  const instrumented = phase === "instrumented";
  const hookKey = `__understand_code_exact_parser_trace_${randomBytes(18).toString("hex")}`;
  let emittedGraph;
  try {
    emittedGraph = await emitFreshParserRuntimeGraphV1({
      packageRoot,
      sourceOverrides,
      instrumented,
      hookKey,
    });
    const observed = await runFreshParserRuntimeGraphV1({
      packageRoot,
      compatibleBase,
      emittedGraph,
      hookKey,
      instrumented,
    });
    if (Object.prototype.hasOwnProperty.call(globalThis, hookKey)) {
      fail("parser runtime worker retained its randomized hook property");
    }
    const exactCallsiteBindings = emittedGraph.astBindings.map(
      ({ branch, exactCallsiteId }) => ({ branch, exactCallsiteId }),
    );
    const exactHits = Object.fromEntries(
      exactCallsiteBindings.map(({ exactCallsiteId }) => [
        exactCallsiteId,
        observed.exactHits?.get(exactCallsiteId) ?? 0,
      ]),
    );
    return {
      profile: PARSER_RUNTIME_WORKER_PROFILE_V1,
      requestNonce,
      phase,
      compatibleBaseAccepted: observed.compatibleBaseAccepted,
      pointAdmissionCount: observed.pointAdmissionCount,
      signatureVerificationCount: observed.signatureVerificationCount,
      successProjection: observed.successProjection,
      methodHits: observed.methodHits,
      exactCallsiteBindings,
      exactHits,
      schemaTableConsumerCount: emittedGraph.schemaTableConsumerCount,
      hookLifecycle: {
        instrumented,
        randomizedNonceGlobalOwnProperty: instrumented,
        nonEnumerable: instrumented,
        configurableForCleanup: instrumented,
        frozenHookValue: instrumented,
        residualPropertyAfterCleanup: false,
      },
    };
  } finally {
    if (Object.prototype.hasOwnProperty.call(globalThis, hookKey)) {
      removeExactParserRuntimeHookV1(hookKey);
    }
    if (emittedGraph !== undefined) {
      await rm(emittedGraph.runtimeModuleRoot, {
        recursive: true,
        force: true,
      });
    }
  }
}

export function parseProductionParserRuntimeWorkerResultV1(
  serializedResult,
  { phase, requestNonce } = {},
) {
  let result;
  try {
    result = JSON.parse(
      Buffer.isBuffer(serializedResult)
        ? serializedResult.toString("utf8")
        : String(serializedResult),
    );
  } catch {
    fail("parser runtime worker result is not valid JSON");
  }
  if (!isPlainJsonObjectV1(result)) {
    fail("parser runtime worker result is not a plain JSON object");
  }
  if (result.profile !== PARSER_RUNTIME_WORKER_PROFILE_V1) {
    fail("parser runtime worker result profile drifted");
  }
  if (result.phase !== phase) {
    fail("parser runtime worker result phase is stale or mismatched");
  }
  if (result.requestNonce !== requestNonce) {
    fail("parser runtime worker result nonce is stale or mismatched");
  }
  assertExactObjectKeysV1(
    result,
    [
      "profile",
      "requestNonce",
      "phase",
      "compatibleBaseAccepted",
      "pointAdmissionCount",
      "signatureVerificationCount",
      "successProjection",
      "methodHits",
      "exactCallsiteBindings",
      "exactHits",
      "schemaTableConsumerCount",
      "hookLifecycle",
    ],
    "parser runtime worker result",
  );
  if (result.compatibleBaseAccepted !== true) {
    fail("parser runtime worker did not accept the compatible base");
  }
  assertNonnegativeSafeIntegerV1(
    result.pointAdmissionCount,
    "parser runtime worker point-admission count",
  );
  assertNonnegativeSafeIntegerV1(
    result.signatureVerificationCount,
    "parser runtime worker signature-verification count",
  );
  assertNonnegativeSafeIntegerV1(
    result.schemaTableConsumerCount,
    "parser runtime worker schema-table consumer count",
  );
  assertExactObjectKeysV1(
    result.successProjection,
    SUCCESS_PROJECTION_KEYS_V1,
    "parser runtime worker success projection",
  );
  for (const projectionKey of SUCCESS_PROJECTION_KEYS_V1) {
    if (
      typeof result.successProjection[projectionKey] !== "string" ||
      result.successProjection[projectionKey].length === 0
    ) {
      fail(
        `parser runtime worker success projection field is invalid: ${projectionKey}`,
      );
    }
  }
  assertExactObjectKeysV1(
    result.methodHits,
    JSON_BRANCH_KEYS_V1,
    "parser runtime worker method-hit table",
  );
  for (const branch of JSON_BRANCH_KEYS_V1) {
    const row = result.methodHits[branch];
    assertExactObjectKeysV1(
      row,
      ["parse", "safeParse"],
      `parser runtime worker ${branch} method-hit row`,
    );
    assertNonnegativeSafeIntegerV1(
      row.parse,
      `parser runtime worker ${branch} parse hits`,
    );
    assertNonnegativeSafeIntegerV1(
      row.safeParse,
      `parser runtime worker ${branch} safeParse hits`,
    );
  }
  if (!Array.isArray(result.exactCallsiteBindings)) {
    fail("parser runtime worker exact-callsite bindings are not an array");
  }
  const expectedBindingCount = phase === "instrumented" ? 21 : 0;
  if (result.exactCallsiteBindings.length !== expectedBindingCount) {
    fail(
      `parser runtime worker exact-callsite binding count drifted: expected ${expectedBindingCount}, observed ${result.exactCallsiteBindings.length}`,
    );
  }
  const observedBranches = [];
  const exactCallsiteIds = [];
  for (const binding of result.exactCallsiteBindings) {
    assertExactObjectKeysV1(
      binding,
      ["branch", "exactCallsiteId"],
      "parser runtime worker exact-callsite binding",
    );
    if (
      typeof binding.branch !== "string" ||
      typeof binding.exactCallsiteId !== "string" ||
      !binding.exactCallsiteId.startsWith(
        `exact_ast_callsite_v1:${binding.branch}:sha256:`,
      ) ||
      !/^exact_ast_callsite_v1:[a-zA-Z][a-zA-Z0-9]*:sha256:[0-9a-f]{64}$/u.test(
        binding.exactCallsiteId,
      )
    ) {
      fail("parser runtime worker exact-callsite binding is malformed");
    }
    observedBranches.push(binding.branch);
    exactCallsiteIds.push(binding.exactCallsiteId);
  }
  if (
    canonicalJsonV1(observedBranches) !==
    canonicalJsonV1(phase === "instrumented" ? JSON_BRANCH_KEYS_V1 : [])
  ) {
    fail("parser runtime worker exact-callsite branch order drifted");
  }
  assertExactObjectKeysV1(
    result.exactHits,
    exactCallsiteIds,
    "parser runtime worker exact-hit table",
  );
  for (const exactCallsiteId of exactCallsiteIds) {
    assertNonnegativeSafeIntegerV1(
      result.exactHits[exactCallsiteId],
      `parser runtime worker exact hits for ${exactCallsiteId}`,
    );
  }
  assertExactObjectKeysV1(
    result.hookLifecycle,
    [
      "instrumented",
      "randomizedNonceGlobalOwnProperty",
      "nonEnumerable",
      "configurableForCleanup",
      "frozenHookValue",
      "residualPropertyAfterCleanup",
    ],
    "parser runtime worker hook lifecycle",
  );
  const expectedInstrumented = phase === "instrumented";
  if (
    result.hookLifecycle.instrumented !== expectedInstrumented ||
    result.hookLifecycle.randomizedNonceGlobalOwnProperty !==
      expectedInstrumented ||
    result.hookLifecycle.nonEnumerable !== expectedInstrumented ||
    result.hookLifecycle.configurableForCleanup !== expectedInstrumented ||
    result.hookLifecycle.frozenHookValue !== expectedInstrumented ||
    result.hookLifecycle.residualPropertyAfterCleanup !== false
  ) {
    fail("parser runtime worker hook lifecycle drifted");
  }
  if (
    result.schemaTableConsumerCount !==
    (phase === "instrumented" ? 1 : 0)
  ) {
    fail("parser runtime worker schema-table consumer count drifted");
  }
  return result;
}

function executeParserRuntimeWorkerProcessV1({
  packageRoot,
  phase,
  inputPath,
  outputPath,
  workerPath = PARSER_RUNTIME_WORKER_PATH_V1,
  timeoutMilliseconds = PARSER_RUNTIME_WORKER_TIMEOUT_MS_V1,
}) {
  const workerEnvironment = { ...process.env };
  delete workerEnvironment.NODE_OPTIONS;
  const argumentsList = [
    `--max-old-space-size=${PARSER_RUNTIME_WORKER_HEAP_MIB_V1}`,
    workerPath,
    "--profile",
    PARSER_RUNTIME_WORKER_PROFILE_V1,
    "--phase",
    phase,
    "--input",
    inputPath,
    "--output",
    outputPath,
  ];
  return new Promise((resolveProcess) => {
    execFile(
      process.execPath,
      argumentsList,
      {
        cwd: packageRoot,
        encoding: "utf8",
        timeout: timeoutMilliseconds,
        killSignal: "SIGKILL",
        maxBuffer: PARSER_RUNTIME_WORKER_MAX_STDIO_BYTES_V1,
        windowsHide: true,
        env: workerEnvironment,
      },
      (error, stdout, stderr) => {
        resolveProcess({ error, stdout, stderr });
      },
    );
  });
}

export function exerciseParserRuntimeWorkerTimeoutForTestV1({
  packageRoot,
  timeoutMilliseconds = 50,
} = {}) {
  if (
    typeof packageRoot !== "string" ||
    !Number.isSafeInteger(timeoutMilliseconds) ||
    timeoutMilliseconds < 1 ||
    timeoutMilliseconds > 1_000
  ) {
    fail("parser runtime worker timeout test seam input is invalid");
  }
  return executeParserRuntimeWorkerProcessV1({
    packageRoot: resolve(packageRoot),
    phase: "uninstrumented",
    inputPath: resolve(packageRoot, ".timeout-fixture-request"),
    outputPath: resolve(packageRoot, ".timeout-fixture-result"),
    workerPath: PARSER_RUNTIME_WORKER_TIMEOUT_FIXTURE_PATH_V1,
    timeoutMilliseconds,
  });
}

async function runProductionParserRuntimePhaseInWorkerV1({
  packageRoot,
  compatibleBase,
  sourceOverrides,
  ipcDirectory,
  phase,
}) {
  const requestNonce = randomBytes(24).toString("hex");
  const inputPath = join(ipcDirectory, `${phase}-request.json`);
  const outputPath = join(ipcDirectory, `${phase}-result.json`);
  const serializedRequest = JSON.stringify({
    profile: PARSER_RUNTIME_WORKER_PROFILE_V1,
    requestNonce,
    phase,
    packageRoot,
    compatibleBase,
    sourceOverrides,
  });
  if (
    Buffer.byteLength(serializedRequest, "utf8") >
    PARSER_RUNTIME_WORKER_MAX_OUTPUT_BYTES_V1
  ) {
    fail(`parser runtime worker ${phase} request exceeds the IPC byte cap`);
  }
  await writeFile(inputPath, serializedRequest, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  const inputStatus = await lstat(inputPath);
  if (!inputStatus.isFile() || (inputStatus.mode & 0o077) !== 0) {
    fail(`parser runtime worker ${phase} request file is not private`);
  }
  const processResult = await executeParserRuntimeWorkerProcessV1({
    packageRoot,
    phase,
    inputPath,
    outputPath,
  });
  if (processResult.error !== null) {
    const error = processResult.error;
    const summary = [
      `code=${String(error.code ?? "unknown")}`,
      `signal=${String(error.signal ?? "none")}`,
      `killed=${String(error.killed ?? false)}`,
      `stderr=${String(processResult.stderr).trim().slice(0, 512)}`,
    ].join(" ");
    fail(`parser runtime worker ${phase} failed closed: ${summary}`);
  }
  if (processResult.stdout !== "" || processResult.stderr !== "") {
    fail(`parser runtime worker ${phase} emitted unexpected stdio`);
  }
  let outputStatus;
  try {
    outputStatus = await lstat(outputPath);
  } catch {
    fail(`parser runtime worker ${phase} did not create a result file`);
  }
  if (
    !outputStatus.isFile() ||
    (outputStatus.mode & 0o077) !== 0 ||
    outputStatus.size <= 0 ||
    outputStatus.size > PARSER_RUNTIME_WORKER_MAX_OUTPUT_BYTES_V1
  ) {
    fail(`parser runtime worker ${phase} result file failed IPC checks`);
  }
  const serializedResult = await readFile(outputPath);
  return parseProductionParserRuntimeWorkerResultV1(serializedResult, {
    phase,
    requestNonce,
  });
}

export async function traceProductionParserBindingsV1({
  packageRoot,
  compatibleBase,
  runtimeModuleRoot: ignoredRuntimeModuleRoot,
  sourceOverrides = {},
} = {}) {
  if (typeof packageRoot !== "string") fail("packageRoot is required for parser runtime trace");
  packageRoot = resolve(packageRoot);
  if (compatibleBase === null || typeof compatibleBase !== "object") {
    fail("compatibleBase is required for parser runtime trace");
  }
  sourceOverrides = snapshotParserRuntimeSourceOverridesV1(
    packageRoot,
    sourceOverrides,
  );
  void ignoredRuntimeModuleRoot;
  const ipcDirectory = await mkdtemp(
    join(packageRoot, ".topology-proof-parser-worker-"),
  );
  try {
    await chmod(ipcDirectory, 0o700);
    const ipcDirectoryStatus = await lstat(ipcDirectory);
    if (
      !ipcDirectoryStatus.isDirectory() ||
      (ipcDirectoryStatus.mode & 0o077) !== 0
    ) {
      fail("parser runtime worker IPC directory is not private");
    }
    const uninstrumented =
      await runProductionParserRuntimePhaseInWorkerV1({
        packageRoot,
        compatibleBase,
        sourceOverrides,
        ipcDirectory,
        phase: "uninstrumented",
      });
    const instrumented = await runProductionParserRuntimePhaseInWorkerV1({
      packageRoot,
      compatibleBase,
      sourceOverrides,
      ipcDirectory,
      phase: "instrumented",
    });
    if (
      canonicalJsonV1(uninstrumented.successProjection) !==
      canonicalJsonV1(instrumented.successProjection)
    ) {
      fail("instrumented fresh parser runtime projection diverged from uninstrumented fresh emit");
    }
    const rows = JSON_BRANCH_KEYS_V1.map((branch) => {
      const binding = PARSER_AST_AND_RUNTIME_BINDINGS_V1[branch];
      const astBinding = instrumented.exactCallsiteBindings.find(
        (row) => row.branch === branch,
      );
      if (astBinding === undefined) {
        fail(`${branch} instrumented exact AST binding is unavailable`);
      }
      const branchHits = instrumented.methodHits[branch];
      const exactCallsiteHits =
        instrumented.exactHits[astBinding.exactCallsiteId] ?? 0;
      return {
        branch,
        runtimeSchemaSymbol: binding.runtimeSchemaSymbol,
        runtimeSchemaSourcePath: binding.runtimeSchemaSourcePath,
        requiredMethod: binding.runtimeMethod,
        parseHits: branchHits.parse,
        safeParseHits: branchHits.safeParse,
        hitRequiredParser: branchHits[binding.runtimeMethod] > 0,
        schemaMethodHitAuthority: "auxiliary_non_authority",
        exactCallsiteId: astBinding.exactCallsiteId,
        exactCallsiteHits,
        hitExactCallsite: exactCallsiteHits > 0,
      };
    });
    const missingExactCallsites = rows
      .filter(({ hitExactCallsite }) => !hitExactCallsite)
      .map(({ branch, exactCallsiteId }) => ({ branch, exactCallsiteId }));
    if (missingExactCallsites.length !== 0) {
      fail(
        `fresh exact AST callsite runtime trace missed required IDs: ${canonicalJsonV1(missingExactCallsites)}`,
      );
    }
    const trace = {
      profile: "fresh_emit_exact_ast_callsite_trace_v1",
      instrumentation:
        "typescript_before_transform_exact_ast_callsite_nonce_global_hook_v1",
      entryExport:
        "src/provider-registry-evidence-binding-point.ts#validateProviderRegistryEvidenceBindingPointClosureV1",
      compatibleBaseAccepted: true,
      uninstrumentedFreshEmitCompatibleBaseAccepted:
        uninstrumented.compatibleBaseAccepted,
      instrumentedFreshEmitCompatibleBaseAccepted:
        instrumented.compatibleBaseAccepted,
      successProjectionFieldCount: 10,
      successProjectionsEquivalent: true,
      successProjectionSemanticDigest: semanticDigestV1(
        instrumented.successProjection,
      ),
      uninstrumentedCryptoClosure: {
        pointAdmissionCount: uninstrumented.pointAdmissionCount,
        signatureVerificationCount:
          uninstrumented.signatureVerificationCount,
      },
      instrumentedCryptoClosure: {
        pointAdmissionCount: instrumented.pointAdmissionCount,
        signatureVerificationCount: instrumented.signatureVerificationCount,
      },
      exactAstBindingCount: instrumented.exactCallsiteBindings.length,
      schemaTableConsumerCount: instrumented.schemaTableConsumerCount,
      hookLifecycle: {
        randomizedNonceGlobalOwnProperty:
          instrumented.hookLifecycle.randomizedNonceGlobalOwnProperty,
        nonEnumerable: instrumented.hookLifecycle.nonEnumerable,
        configurableForCleanup:
          instrumented.hookLifecycle.configurableForCleanup,
        frozenHookValue: instrumented.hookLifecycle.frozenHookValue,
        residualPropertyAfterCleanup:
          instrumented.hookLifecycle.residualPropertyAfterCleanup,
      },
      rows,
    };
    return {
      ...trace,
      semanticDigest: semanticDigestV1(trace),
    };
  } finally {
    await rm(ipcDirectory, { recursive: true, force: true });
  }
}

const ACCOUNTING_AST_RELEVANT_FUNCTIONS_V1 = Object.freeze([
  ["src/provider-point-raw-admission-internal.ts", "chargeProviderPointRawPrecloneWorkV1"],
  ["src/provider-point-raw-admission-internal.ts", "chargeProviderPointRawSessionWorkV1"],
  ["src/provider-point-raw-admission-internal.ts", "reserveProviderPointRawOwnKeyWorkV1"],
  ["src/provider-point-raw-admission-internal.ts", "reserveProviderPointRawDenseIndexWorkV1"],
  ["src/provider-point-raw-admission-internal.ts", "reserveProviderPointRawScratchWorkV1"],
  ["src/provider-point-raw-admission-internal.ts", "observeObjectIdentityInternalV1"],
  ["src/provider-point-raw-admission-internal.ts", "createProviderPointRawAdmissionSessionV1"],
  ["src/provider-point-raw-admission-internal.ts", "createProviderPointRawAdmissionBudgetForSessionV1"],
  ["src/provider-point-raw-admission-internal.ts", "createProviderPointRawAdmissionBudgetInternalV1"],
  ["src/provider-point-raw-admission-internal.ts", "reserveProviderPointRawBudgetWeakSetInsertionWorkV1"],
  ["src/provider-point-raw-admission-internal.ts", "countProviderPointRawAdmissionValueV1"],
  ["src/provider-point-raw-admission-internal.ts", "countProviderPointRawAdmissionBudgetRootInternalV1"],
  ["src/provider-point-raw-admission-internal.ts", "countProviderPointRawAdmissionBudgetRootV1"],
  ["src/provider-point-raw-admission-internal.ts", "countProviderPointRawAdmissionBudgetAdditionalRootV1"],
  ["src/provider-point-raw-admission-internal.ts", "snapshotExactDataObjectInternalV1"],
  ["src/provider-point-raw-admission-internal.ts", "captureProviderPointRawExactTopLevelV1"],
  ["src/provider-point-raw-admission-internal.ts", "captureProviderPointRawObservedDenseArrayV1"],
  ["src/provider-point-raw-admission-internal.ts", "createWalkFrameV1"],
  ["src/provider-point-raw-admission-internal.ts", "inspectObservedJsonNodeV1"],
  ["src/provider-point-raw-admission-internal.ts", "walkProviderPointRawObservedJsonIdentityTreeInternalV1"],
  ["src/provider-point-raw-admission-internal.ts", "walkProviderPointRawJsonIdentityTreeV1"],
  ["src/provider-point-raw-admission-internal.ts", "walkProviderPointRawObservedJsonIdentityTreeWithDualBudgetsV1"],
  ["src/provider-registry-evidence-binding-point.ts", "createRawBudgetV1"],
  ["src/provider-registry-evidence-binding-point.ts", "preflightRawHistoryV1"],
  ["src/provider-registry-evidence-binding-point.ts", "preflightRawJsonBranchesV1"],
  ["src/provider-registry-evidence-binding-point.ts", "prepareProviderRegistryEvidenceBindingPointFromRawInputV1"],
]);

const EXPECTED_ACCOUNTING_CONTROL_FLOW_AST_SEMANTIC_DIGEST_V1 =
  "sha256:b44c643fb7b9d34c7c1a4ce55d6afe649621ad0fce61efaaee18e0deb689bddf";

function expressionAstShapeV1(expression) {
  const node = unwrapExpressionV1(expression);
  if (ts.isIdentifier(node)) return { identifier: node.text };
  if (ts.isNumericLiteral(node)) return { number: Number(node.text) };
  if (ts.isStringLiteral(node)) return { string: node.text };
  if (node.kind === ts.SyntaxKind.TrueKeyword) return { boolean: true };
  if (node.kind === ts.SyntaxKind.FalseKeyword) return { boolean: false };
  if (node.kind === ts.SyntaxKind.NullKeyword) return { null: true };
  if (ts.isPropertyAccessExpression(node)) {
    return {
      property: [expressionAstShapeV1(node.expression), node.name.text],
    };
  }
  if (ts.isElementAccessExpression(node)) {
    return {
      element: [
        expressionAstShapeV1(node.expression),
        node.argumentExpression === undefined
          ? { missing: true }
          : expressionAstShapeV1(node.argumentExpression),
      ],
    };
  }
  if (ts.isConditionalExpression(node)) {
    return {
      conditional: [
        expressionAstShapeV1(node.condition),
        expressionAstShapeV1(node.whenTrue),
        expressionAstShapeV1(node.whenFalse),
      ],
    };
  }
  if (ts.isBinaryExpression(node)) {
    return {
      binary: [
        ts.tokenToString(node.operatorToken.kind) ?? String(node.operatorToken.kind),
        expressionAstShapeV1(node.left),
        expressionAstShapeV1(node.right),
      ],
    };
  }
  if (ts.isCallExpression(node)) {
    return {
      call: {
        callee: expressionAstShapeV1(node.expression),
        arguments: node.arguments.map((argument) =>
          expressionAstShapeV1(argument),
        ),
      },
    };
  }
  return { syntaxKind: ts.SyntaxKind[node.kind] };
}

function directCallNameV1(call) {
  const expression = unwrapExpressionV1(call.expression);
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

export function assertRawAdmissionAccountingAstV1({
  packageRoot,
  sourceOverrides = {},
} = {}) {
  if (typeof packageRoot !== "string") fail("packageRoot is required for accounting AST proof");
  const program = createFreshTypeScriptProgramV1(packageRoot, sourceOverrides);
  if (program.getSyntacticDiagnostics().length !== 0) {
    fail("mutated accounting source is not syntactically valid TypeScript");
  }
  const { functions, edges } = buildTypeScriptFunctionGraphV1(
    program,
    packageRoot,
  );
  const entrySourcePath = "src/provider-registry-evidence-binding-point.ts";
  const entryFunctionName =
    "validateProviderRegistryEvidenceBindingPointClosureV1";
  const entry = functions.find(
    (node) =>
      functionNameV1(node) === entryFunctionName &&
      packageRelativePathV1(packageRoot, node.getSourceFile().fileName) ===
        entrySourcePath,
  );
  if (
    entry === undefined ||
    entry.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    ) !== true
  ) {
    fail("accounting AST production entry export is unavailable");
  }
  const reachableFromEntry = new Set([entry]);
  const reachabilityQueue = [entry];
  while (reachabilityQueue.length !== 0) {
    const current = reachabilityQueue.shift();
    for (const target of edges.get(current) ?? []) {
      if (reachableFromEntry.has(target)) continue;
      reachableFromEntry.add(target);
      reachabilityQueue.push(target);
    }
  }
  const printer = ts.createPrinter({ removeComments: true });
  const functionRecords = ACCOUNTING_AST_RELEVANT_FUNCTIONS_V1.map(
    ([sourcePath, functionName]) => {
      const functionNode = functions.find(
        (node) =>
          functionNameV1(node) === functionName &&
          packageRelativePathV1(packageRoot, node.getSourceFile().fileName) ===
            sourcePath,
      );
      if (functionNode === undefined) {
        fail(`accounting AST function is unavailable: ${sourcePath}#${functionName}`);
      }
      if (!reachableFromEntry.has(functionNode)) {
        fail(
          `accounting AST function is unreachable from the exported entry: ${sourcePath}#${functionName}`,
        );
      }
      const callEvents = [];
      visitOwnFunctionBodyV1(functionNode, (node) => {
        if (!ts.isCallExpression(node)) return;
        const target = directCallNameV1(node);
        if (
          target === undefined ||
          !/^(?:chargeProviderPointRaw|reserveProviderPointRaw|observeObjectIdentityInternalV1|createProviderPointRawAdmission|captureProviderPointRaw|countProviderPointRaw|walkProviderPointRaw|inspectObservedJsonNodeV1|createWalkFrameV1|getProviderPointRawAdmissionAllocationLedgerForTestV1|preflightRaw)/u.test(
            target,
          )
        ) {
          return;
        }
        if (!isLexicallyReachableV1(node, functionNode)) {
          fail(`${sourcePath}#${functionName} contains unreachable accounting call ${target}`);
        }
        callEvents.push({
          target,
          arguments: node.arguments.map((argument) =>
            expressionAstShapeV1(argument),
          ),
        });
      });
      return {
        sourcePath,
        functionName,
        reachableFromExportedEntry: true,
        ast: printer.printNode(
          ts.EmitHint.Unspecified,
          functionNode,
          functionNode.getSourceFile(),
        ),
        callEvents,
      };
    },
  );
  const semanticDigest = semanticDigestV1(functionRecords);
  if (
    semanticDigest !== EXPECTED_ACCOUNTING_CONTROL_FLOW_AST_SEMANTIC_DIGEST_V1
  ) {
    fail(
      `accounting control-flow AST drifted: expected ${EXPECTED_ACCOUNTING_CONTROL_FLOW_AST_SEMANTIC_DIGEST_V1}, observed ${semanticDigest}`,
    );
  }

  const rawSourceFile = program.getSourceFile(
    join(packageRoot, "src/provider-point-raw-admission-internal.ts"),
  );
  if (rawSourceFile === undefined) fail("raw admission accounting source is unavailable");
  const numericConstants = new Map();
  const visitConstant = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined &&
      ts.isNumericLiteral(unwrapExpressionV1(node.initializer))
    ) {
      numericConstants.set(
        node.name.text,
        Number(unwrapExpressionV1(node.initializer).text),
      );
    }
    ts.forEachChild(node, visitConstant);
  };
  visitConstant(rawSourceFile);
  const fixedSessionWorkUnits = numericConstants.get(
    "PROVIDER_POINT_RAW_ADMISSION_FIXED_WORK_UNITS_V1",
  );
  const identityObservationWorkUnits = numericConstants.get(
    "PROVIDER_POINT_RAW_ADMISSION_IDENTITY_WORK_UNITS_V1",
  );
  if (fixedSessionWorkUnits !== 64 || identityObservationWorkUnits !== 4) {
    fail("raw admission accounting constants drifted from the proved formula");
  }
  return {
    profile: "fresh_typescript_ast_accounting_control_flow_v1",
    entryExport: `${entrySourcePath}#${entryFunctionName}`,
    fixedSessionWorkUnits,
    identityObservationWorkUnits,
    topLevelWorkUnits: 95,
    mutableTestSeamsExcludedFromAccountingAuthority: true,
    primitiveCharges: {
      sessionOwnedBudgetConstructionWorkUnits: 4,
      budgetRootWeakSetInsertionWorkUnits: 2,
      descendantWeakSetInsertionWorkUnitsPerBudget: 1,
    },
    ordinaryFormula: {
      branchConstant: 5,
      identityCoefficient: 6,
      ownKeyCoefficient: 1,
      denseIndexCoefficient: 1,
    },
    historyFormula: {
      arrayConstant: 10,
      perEnvelopeConstant: 7,
      identityCoefficient: 7,
      ownKeyCoefficient: 1,
      denseIndexCoefficient: 1,
      sharedAggregateBudgetConstructionWorkUnits: 4,
    },
    relevantFunctionCount: functionRecords.length,
    controlFlowAstSemanticDigest: semanticDigest,
  };
}

function runtimeTopologyRecordV1(value) {
  const topology = measureJsonTopologyV1(value);
  return {
    identities: Number(topology.identities),
    ownKeys: Number(topology.ownKeys),
    denseIndices: Number(topology.dense),
  };
}

export async function traceRawAdmissionAccountingV1({
  packageRoot,
  runtimeModuleRoot,
} = {}) {
  if (typeof packageRoot !== "string") fail("packageRoot is required for accounting runtime trace");
  const resolvedRuntimeModuleRoot =
    runtimeModuleRoot ?? join(packageRoot, "dist");
  const raw = await importRuntimeModuleForSourceV1(
    resolvedRuntimeModuleRoot,
    "src/provider-point-raw-admission-internal.ts",
  );
  const limits = {
    maxObservedIdentities: 10_000,
    maxPrecloneAllocationWorkUnits: 1_000_000,
  };
  const capExerciseEvidenceFields = Object.freeze([
    "testCapExerciseKind",
    "testCapExerciseRelation",
    "testCapExerciseLimit",
    "testCapExerciseBefore",
    "testCapExerciseCharge",
    "testCapExerciseOverflow",
  ]);
  let allocationLedgerReadCount = 0;
  let productionBudgetObserverRejectionCount = 0;
  const ledger = (session) => {
    const observed =
      raw.getProviderPointRawAdmissionAllocationLedgerForTestV1(session);
    allocationLedgerReadCount += 1;
    for (const field of capExerciseEvidenceFields) {
      if (observed[field] !== undefined) {
        fail(
          `production accounting trace unexpectedly activated allocation-cap test seam field ${field}`,
        );
      }
    }
    return observed;
  };
  const assertProductionBudgetObserverDormant = (budget) => {
    let rejected;
    try {
      raw.getProviderPointRawAdmissionBudgetLedgerForTestV1(budget);
    } catch (error) {
      rejected = error;
    }
    if (
      !(rejected instanceof Error) ||
      rejected.message !==
        "provider point raw budget was not created with a test observer"
    ) {
      fail(
        "production accounting trace unexpectedly activated the string-budget test observer",
      );
    }
    productionBudgetObserverRejectionCount += 1;
  };

  const topLevelKeys = Object.freeze([...POINT_INPUT_KEYS_V1]);
  const topLevelInput = Object.fromEntries(
    topLevelKeys.map((key) => [key, "primitive"]),
  );
  const topSession = raw.createProviderPointRawAdmissionSessionV1(
    topLevelInput,
    limits,
  );
  raw.captureProviderPointRawExactTopLevelV1(topSession, topLevelKeys);
  const topBudget = raw.createProviderPointRawAdmissionBudgetForSessionV1(
    topSession,
    65,
    10_000,
    10_000,
    10_000,
  );
  assertProductionBudgetObserverDormant(topBudget);
  const topLedger = ledger(topSession);
  if (
    topLedger.observedIdentityCount !== 1 ||
    topLedger.precloneAllocationWorkUnitCount !== 95
  ) {
    fail("runtime accounting top-level differential no longer proves 1/95");
  }

  const ordinaryValues = [
    { profile: "object", value: { alpha: 1, beta: 2 } },
    { profile: "array", value: [1, 2] },
    { profile: "nested", value: { alpha: [{ beta: 1 }] } },
  ];
  const ordinaryRows = ordinaryValues.map(({ profile, value }) => {
    const session = raw.createProviderPointRawAdmissionSessionV1({}, limits);
    const before = ledger(session);
    const budget = raw.createProviderPointRawAdmissionBudgetForSessionV1(
      session,
      64,
      10_000,
      10_000,
      10_000,
    );
    assertProductionBudgetObserverDormant(budget);
    raw.walkProviderPointRawJsonIdentityTreeV1(session, value, budget);
    const after = ledger(session);
    const topology = runtimeTopologyRecordV1(value);
    const expectedWorkDelta =
      5 +
      6 * topology.identities +
      topology.ownKeys +
      topology.denseIndices;
    const observedWorkDelta =
      after.precloneAllocationWorkUnitCount -
      before.precloneAllocationWorkUnitCount;
    const observedIdentityDelta =
      after.observedIdentityCount - before.observedIdentityCount;
    if (
      observedIdentityDelta !== topology.identities ||
      observedWorkDelta !== expectedWorkDelta
    ) {
      fail(`${profile} runtime accounting differential drifted`);
    }
    return {
      profile,
      topology,
      observedIdentityDelta,
      observedWorkDelta,
      expectedWorkDelta,
      exact: true,
    };
  });

  const historySession = raw.createProviderPointRawAdmissionSessionV1(
    {},
    limits,
  );
  const historyBefore = ledger(historySession);
  const aggregateBudget = raw.createProviderPointRawAdmissionBudgetForSessionV1(
    historySession,
    65,
    10_000,
    10_000,
    10_000,
  );
  assertProductionBudgetObserverDormant(aggregateBudget);
  const envelopeValues = [{ alpha: [] }, { beta: [{}] }];
  for (let historyIndex = 0; historyIndex < envelopeValues.length; historyIndex += 1) {
    const history = [envelopeValues[historyIndex]];
    if (historyIndex === 0) {
      raw.countProviderPointRawAdmissionBudgetRootV1(aggregateBudget, history);
    } else {
      raw.countProviderPointRawAdmissionBudgetAdditionalRootV1(
        aggregateBudget,
        history,
      );
    }
    const historyToken = raw.observeProviderPointRawObjectIdentityV1(
      historySession,
      history,
    );
    const capture = raw.captureProviderPointRawObservedDenseArrayV1(
      historySession,
      historyToken,
      2,
      aggregateBudget,
      1,
    );
    const envelope = capture.items["0"];
    const envelopeToken = capture.itemTokens["0"];
    const envelopeBudget =
      raw.createProviderPointRawAdmissionBudgetForSessionV1(
        historySession,
        64,
        10_000,
        10_000,
        10_000,
      );
    assertProductionBudgetObserverDormant(envelopeBudget);
    raw.countProviderPointRawAdmissionBudgetRootV1(
      envelopeBudget,
      envelope,
    );
    raw.walkProviderPointRawObservedJsonIdentityTreeWithDualBudgetsV1(
      historySession,
      envelopeToken,
      envelopeBudget,
      aggregateBudget,
    );
  }
  const historyAfter = ledger(historySession);
  const historyEnvelopeTopologies = envelopeValues.map((value) =>
    runtimeTopologyRecordV1(value),
  );
  const expectedHistoryWorkDelta =
    4 +
    historyEnvelopeTopologies.reduce(
      (total, topology) =>
        total +
        10 +
        7 +
        7 * topology.identities +
        topology.ownKeys +
        topology.denseIndices,
      0,
    );
  const observedHistoryWorkDelta =
    historyAfter.precloneAllocationWorkUnitCount -
    historyBefore.precloneAllocationWorkUnitCount;
  const expectedHistoryIdentityDelta =
    envelopeValues.length +
    historyEnvelopeTopologies.reduce(
      (total, topology) => total + topology.identities,
      0,
    );
  const observedHistoryIdentityDelta =
    historyAfter.observedIdentityCount -
    historyBefore.observedIdentityCount;
  if (
    observedHistoryIdentityDelta !== expectedHistoryIdentityDelta ||
    observedHistoryWorkDelta !== expectedHistoryWorkDelta
  ) {
    fail("dual-history/B_H runtime accounting differential drifted");
  }
  const trace = {
    profile: "production_raw_walker_allocation_ledger_differential_v1",
    testSeamIsolation: {
      mutableTestSeamsExcludedFromAccountingAuthority: true,
      allocationCapExerciseActivated: false,
      stringBudgetObserverActivated: false,
      allocationLedgerReadCount,
      productionBudgetObserverRejectionCount,
      authority:
        "fresh_ast_and_unmodified_production_walker_differential_only",
    },
    topLevel: {
      observedIdentities: topLedger.observedIdentityCount,
      observedWorkUnits: topLedger.precloneAllocationWorkUnitCount,
      exact: true,
    },
    ordinaryRows,
    retainedHistory: {
      sharedAggregateBudget: true,
      sharedAggregateBudgetProfile: "B_H",
      historyArrayCount: 2,
      envelopeCount: 2,
      envelopeTopologies: historyEnvelopeTopologies,
      observedIdentityDelta: observedHistoryIdentityDelta,
      expectedIdentityDelta: expectedHistoryIdentityDelta,
      observedWorkDelta: observedHistoryWorkDelta,
      expectedWorkDelta: expectedHistoryWorkDelta,
      exact: true,
    },
  };
  return {
    ...trace,
    semanticDigest: semanticDigestV1(trace),
  };
}

function fail(message) {
  throw new Error(`D-37 topology proof: ${message}`);
}

function vector(identities = 0n, ownKeys = 0n, dense = 0n) {
  return { identities, ownKeys, dense };
}

function addVector(left, right) {
  return vector(
    left.identities + right.identities,
    left.ownKeys + right.ownKeys,
    left.dense + right.dense,
  );
}

function multiplyVector(value, count) {
  return vector(
    value.identities * count,
    value.ownKeys * count,
    value.dense * count,
  );
}

function maxVector(left, right) {
  return vector(
    left.identities > right.identities ? left.identities : right.identities,
    left.ownKeys > right.ownKeys ? left.ownKeys : right.ownKeys,
    left.dense > right.dense ? left.dense : right.dense,
  );
}

function minVector(left, right) {
  return vector(
    left.identities < right.identities ? left.identities : right.identities,
    left.ownKeys < right.ownKeys ? left.ownKeys : right.ownKeys,
    left.dense < right.dense ? left.dense : right.dense,
  );
}

function assertVectorEqual(left, right, label) {
  if (
    left.identities !== right.identities ||
    left.ownKeys !== right.ownKeys ||
    left.dense !== right.dense
  ) {
    fail(
      `${label} drifted: expected ${right.identities}/${right.ownKeys}/${right.dense}, observed ${left.identities}/${left.ownKeys}/${left.dense}`,
    );
  }
}

function ratio(numerator, denominator) {
  if (denominator <= 0n) fail("an expansion atom has no positive byte cost");
  return { numerator, denominator };
}

function maxRatio(left, right) {
  return left.numerator * right.denominator >=
    right.numerator * left.denominator
    ? left
    : right;
}

function maxDensity(left, right) {
  return {
    identities: maxRatio(left.identities, right.identities),
    ownKeys: maxRatio(left.ownKeys, right.ownKeys),
    dense: maxRatio(left.dense, right.dense),
  };
}

function densityForAtom(resources, byteCost) {
  const denominator = BigInt(Math.max(1, byteCost));
  return {
    identities: ratio(resources.identities, denominator),
    ownKeys: ratio(resources.ownKeys, denominator),
    dense: ratio(resources.dense, denominator),
  };
}

function caseDominates(left, right) {
  return (
    left.bytes <= right.bytes &&
    left.resources.identities >= right.resources.identities &&
    left.resources.ownKeys >= right.resources.ownKeys &&
    left.resources.dense >= right.resources.dense &&
    (left.bytes < right.bytes ||
      left.resources.identities > right.resources.identities ||
      left.resources.ownKeys > right.resources.ownKeys ||
      left.resources.dense > right.resources.dense)
  );
}

function pruneBaseCases(cases, path) {
  const unique = new Map();
  for (const item of cases) {
    const key = `${item.bytes}:${item.resources.identities}:${item.resources.ownKeys}:${item.resources.dense}`;
    unique.set(key, item);
  }
  const candidates = [...unique.values()];
  const retained = candidates.filter(
    (candidate, index) =>
      !candidates.some(
        (other, otherIndex) =>
          index !== otherIndex && caseDominates(other, candidate),
      ),
  );
  if (retained.length > 10_000) {
    fail(`base-production frontier is too large to bound at ${path}`);
  }
  return retained.sort((left, right) => {
    if (left.bytes !== right.bytes) return left.bytes - right.bytes;
    const leftKey = `${left.resources.identities}:${left.resources.ownKeys}:${left.resources.dense}`;
    const rightKey = `${right.resources.identities}:${right.resources.ownKeys}:${right.resources.dense}`;
    return leftKey.localeCompare(rightKey);
  });
}

function combineBaseCases(leftCases, rightCases, extraBytes, extraResources, path) {
  const combined = [];
  for (const left of leftCases) {
    for (const right of rightCases) {
      combined.push({
        bytes: left.bytes + extraBytes + right.bytes,
        resources: addVector(
          addVector(left.resources, extraResources),
          right.resources,
        ),
      });
    }
  }
  return pruneBaseCases(combined, path);
}

function maxBaseCaseVector(cases) {
  return cases.reduce(
    (maximum, item) => maxVector(maximum, item.resources),
    ZERO_VECTOR,
  );
}

function densityForBaseCases(cases, extraResources, extraBytes) {
  let density = ZERO_DENSITY;
  for (const item of cases) {
    density = maxDensity(
      density,
      densityForAtom(
        addVector(item.resources, extraResources),
        item.bytes + extraBytes,
      ),
    );
  }
  return density;
}

function saturatingNumber(value, label) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    fail(`${label} exceeded Number.MAX_SAFE_INTEGER after byte bounding`);
  }
  return Number(value);
}

function leastPowerOfTwoAtLeast(value, label) {
  if (value < 1n) fail(`${label} must be positive`);
  let cap = 1n;
  while (cap < value) cap *= 2n;
  return saturatingNumber(cap, label);
}

function resolveJsonPointer(root, reference) {
  if (!reference.startsWith("#/")) {
    fail(`external or malformed $ref is not bounded: ${reference}`);
  }
  let current = root;
  for (const encoded of reference.slice(2).split("/")) {
    const key = encoded.replaceAll("~1", "/").replaceAll("~0", "~");
    if (
      current === null ||
      typeof current !== "object" ||
      !Object.prototype.hasOwnProperty.call(current, key)
    ) {
      fail(`unresolved local $ref: ${reference}`);
    }
    current = current[key];
  }
  return current;
}

function normalizedArrayPath(path) {
  return path
    .replace(/\.(?:anyOf|oneOf)\[\d+\]/gu, "")
    .replace(/\.\$ref\([^)]*\)/gu, "");
}

function cardinalityOverride(context, path) {
  const { branch } = context;
  const normalizedPath = normalizedArrayPath(path);
  let maximum = context.unboundedArrayMaxItems;
  let source = `${branch} canonical-byte ceiling (every array item consumes at least one canonical byte)`;
  if (branch === "registryManifestHistory") {
    maximum = POLICY_CARDINALITY_V1.registryManifestJsonContainerEntryHardCap;
    source = "Registry manifest JSON container hard cap";
    if (
      normalizedPath.endsWith(
        ".verificationKeys.properties.publicKeyRecords",
      )
    ) {
      maximum =
        POLICY_CARDINALITY_V1.maxProviderVerificationPublicKeyRecordsPerProvider;
      source =
        "min(maxProviderVerificationPublicKeyRecordCountPerProvider=256, maxProviderVerificationPublicKeyRecordCountPerUsage=64 by usage)";
    } else if (
      normalizedPath.endsWith(
        ".verificationKeys.properties.bindingDerivationGenerationRecords",
      )
    ) {
      maximum =
        POLICY_CARDINALITY_V1.maxBindingDerivationGenerationRecordsPerProvider;
      source =
        "ProviderTrustHistoryPolicyV1.maxBindingDerivationGenerationRecordCountPerProvider";
    } else if (
      normalizedPath.endsWith(
        ".feasibilityApprovalKeys.properties.publicKeyRecords",
      )
    ) {
      maximum = 2 * POLICY_CARDINALITY_V1.maxApproverPublicKeyRecordsPerRole;
      source =
        "2 role literals × ProviderTrustHistoryPolicyV1.maxApproverPublicKeyRecordCountPerRole";
    } else if (
      normalizedPath.endsWith(".properties.compromisedRevokedKeyIds") ||
      normalizedPath.endsWith(
        ".properties.compromisedRevokedBindingDerivationGenerations",
      )
    ) {
      maximum =
        POLICY_CARDINALITY_V1.maxCompromisedRevocationRecordsPerIdentity;
      source =
        "ProviderTrustHistoryPolicyV1.maxCompromisedRevocationRecordCountPerIdentity";
    }
  }
  return { maximum, normalizedPath, source };
}

function minimumRegexCodeUnits(pattern, path) {
  let index = 0;
  let supported = true;

  function parseAlternatives(stopCharacter) {
    const lengths = [];
    let sequenceLength = 0;
    while (index < pattern.length) {
      const character = pattern[index];
      if (character === stopCharacter) break;
      if (character === "|") {
        lengths.push(sequenceLength);
        sequenceLength = 0;
        index += 1;
        continue;
      }
      sequenceLength += parseAtom();
    }
    lengths.push(sequenceLength);
    return Math.min(...lengths);
  }

  function skipLookaround() {
    let depth = 1;
    let inCharacterClass = false;
    while (index < pattern.length && depth !== 0) {
      const character = pattern[index];
      index += 1;
      if (character === "\\") {
        index += 1;
      } else if (character === "[" && !inCharacterClass) {
        inCharacterClass = true;
      } else if (character === "]" && inCharacterClass) {
        inCharacterClass = false;
      } else if (!inCharacterClass && character === "(") {
        depth += 1;
      } else if (!inCharacterClass && character === ")") {
        depth -= 1;
      }
    }
    if (depth !== 0) fail(`unterminated regex lookaround at ${path}`);
  }

  function parseAtom() {
    let atomLength;
    const character = pattern[index];
    if (character === "^" || character === "$") {
      index += 1;
      atomLength = 0;
    } else if (character === "\\") {
      const escape = pattern[index + 1];
      if (escape === "u") {
        if (pattern[index + 2] === "{") {
          const end = pattern.indexOf("}", index + 3);
          const body = end === -1 ? "" : pattern.slice(index + 3, end);
          if (end === -1 || !/^[0-9a-fA-F]+$/u.test(body)) supported = false;
          index = end === -1 ? pattern.length : end + 1;
        } else {
          const body = pattern.slice(index + 2, index + 6);
          if (!/^[0-9a-fA-F]{4}$/u.test(body)) supported = false;
          index += Math.min(6, pattern.length - index);
        }
        atomLength = 1;
      } else if (escape === "x") {
        const body = pattern.slice(index + 2, index + 4);
        if (!/^[0-9a-fA-F]{2}$/u.test(body)) supported = false;
        index += Math.min(4, pattern.length - index);
        atomLength = 1;
      } else if (escape === "b" || escape === "B") {
        index += 2;
        atomLength = 0;
      } else if (
        typeof escape === "string" &&
        /[dDsSwW\\^$.*+?()[\]{}|/\-]/u.test(escape)
      ) {
        index += 2;
        atomLength = 1;
      } else {
        supported = false;
        index += Math.min(2, pattern.length - index);
        atomLength = 0;
      }
    } else if (character === "[") {
      index += 1;
      let closed = false;
      while (index < pattern.length) {
        const classCharacter = pattern[index];
        index += 1;
        if (classCharacter === "\\") index += 1;
        else if (classCharacter === "]") {
          closed = true;
          break;
        }
      }
      if (!closed) fail(`unterminated regex character class at ${path}`);
      atomLength = 1;
    } else if (character === "(") {
      index += 1;
      if (pattern.startsWith("?:", index)) index += 2;
      else if (
        pattern.startsWith("?!", index) ||
        pattern.startsWith("?=", index) ||
        pattern.startsWith("?<=", index) ||
        pattern.startsWith("?<!", index)
      ) {
        index += pattern[index + 1] === "<" ? 3 : 2;
        skipLookaround();
        atomLength = 0;
        return applyQuantifier(atomLength);
      } else if (pattern[index] === "?") {
        fail(`unsupported regex group production at ${path}: ${pattern}`);
      }
      atomLength = parseAlternatives(")");
      if (pattern[index] !== ")") fail(`unterminated regex group at ${path}`);
      index += 1;
    } else if (character === ")") {
      fail(`unexpected regex group terminator at ${path}`);
    } else {
      index += 1;
      atomLength = 1;
    }
    return applyQuantifier(atomLength);
  }

  function applyQuantifier(atomLength) {
    if (index >= pattern.length) return atomLength;
    const quantifier = pattern[index];
    if (quantifier === "*" || quantifier === "?") {
      index += 1;
      if (pattern[index] === "?") index += 1;
      return 0;
    }
    if (quantifier === "+") {
      index += 1;
      if (pattern[index] === "?") index += 1;
      return atomLength;
    }
    if (quantifier !== "{") return atomLength;
    const end = pattern.indexOf("}", index + 1);
    if (end === -1) fail(`unterminated regex quantifier at ${path}`);
    const body = pattern.slice(index + 1, end);
    const minimumText = body.split(",", 1)[0];
    if (!/^\d+$/u.test(minimumText)) {
      fail(`unsupported regex quantifier at ${path}: {${body}}`);
    }
    index = end + 1;
    if (pattern[index] === "?") index += 1;
    return atomLength * Number(minimumText);
  }

  const minimum = parseAlternatives(undefined);
  if (index !== pattern.length) {
    fail(`regex minimum-length traversal stopped early at ${path}`);
  }
  return supported ? minimum : 0;
}

function minimumPrimitiveBytes(schema, path) {
  if (Object.prototype.hasOwnProperty.call(schema, "const")) {
    return Buffer.byteLength(JSON.stringify(schema.const), "utf8");
  }
  if (Array.isArray(schema.enum) && schema.enum.length !== 0) {
    return Math.min(
      ...schema.enum.map((item) =>
        Buffer.byteLength(JSON.stringify(item), "utf8"),
      ),
    );
  }
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const candidates = [];
  for (const type of types) {
    if (type === "string") {
      if (typeof schema.pattern === "string") {
        try {
          new RegExp(schema.pattern, "u");
        } catch {
          fail(`invalid regex production at ${path}: ${schema.pattern}`);
        }
        // A bare always-failing negative lookahead is a canonical empty
        // language.  Treat it as unsatisfiable instead of manufacturing a
        // two-byte phantom string for a constructive witness.
        if (schema.pattern.includes("(?!)")) {
          fail(`unsatisfiable regex production at ${path}: ${schema.pattern}`);
        }
      }
      // The parser is a strict lower-bound whitelist. Unsupported escapes or
      // constructs contribute zero; a regex-derived minimum that is even one
      // code unit too large can underbound a byte-density upper.
      const patternMinimum =
        typeof schema.pattern === "string"
          ? minimumRegexCodeUnits(schema.pattern, path)
          : 0;
      candidates.push(2 + Math.max(schema.minLength ?? 0, patternMinimum));
    }
    else if (type === "integer" || type === "number") candidates.push(1);
    else if (type === "boolean") candidates.push(4);
    else if (type === "null") candidates.push(4);
  }
  if (candidates.length === 0) {
    fail(`unsupported or unconstrained primitive production at ${path}`);
  }
  return Math.min(...candidates);
}

function literalSchemaValuesV1(schema) {
  if (Object.prototype.hasOwnProperty.call(schema, "const")) {
    return [schema.const];
  }
  if (Array.isArray(schema.enum) && schema.enum.length !== 0) {
    return schema.enum;
  }
  return undefined;
}

function jsonValueDepthV1(value) {
  if (value === null || typeof value !== "object") return 0;
  const children = Array.isArray(value) ? value : Object.values(value);
  return 1 + children.reduce(
    (maximum, child) => Math.max(maximum, jsonValueDepthV1(child)),
    0,
  );
}

function analyzeLiteralSchemaTopologyV1(schema, path) {
  const values = literalSchemaValuesV1(schema);
  if (values === undefined) return undefined;
  const baseCases = values.map((value, index) => {
    let bytes;
    try {
      bytes = Buffer.byteLength(canonicalJsonV1(value), "utf8");
    } catch {
      fail(`non-JSON const/enum value at ${path}[${index}]`);
    }
    return {
      bytes,
      resources: measureJsonTopologyV1(value),
      depth: jsonValueDepthV1(value),
    };
  });
  return {
    minBytes: Math.min(...baseCases.map((item) => item.bytes)),
    base: maxBaseCaseVector(baseCases),
    baseCases: baseCases.map(({ bytes, resources }) => ({ bytes, resources })),
    structuralMax: baseCases.reduce(
      (maximum, item) => maxVector(maximum, item.resources),
      ZERO_VECTOR,
    ),
    density: ZERO_DENSITY,
    maxDepth: Math.max(...baseCases.map((item) => item.depth)),
  };
}

function analyzeLiteralSchemaObjectiveV1(schema, context, path) {
  const values = literalSchemaValuesV1(schema);
  if (values === undefined) return undefined;
  const resourceFor = (value) => {
    const topology = measureJsonTopologyV1(value);
    return (
      context.weights.identities * topology.identities +
      context.weights.ownKeys * topology.ownKeys +
      context.weights.dense * topology.dense
    );
  };
  const baseCases = values.map((value, index) => {
    let bytes;
    try {
      bytes = Buffer.byteLength(canonicalJsonV1(value), "utf8");
    } catch {
      fail(`non-JSON objective const/enum value at ${path}[${index}]`);
    }
    return { bytes, resource: resourceFor(value) };
  });
  return {
    label: `${context.label}:${path}`,
    minBytes: Math.min(...baseCases.map((item) => item.bytes)),
    baseMax: baseCases.reduce(
      (maximum, item) => item.resource > maximum ? item.resource : maximum,
      0n,
    ),
    baseCases: pruneScalarCases(baseCases, path),
    structuralMax: baseCases.reduce(
      (maximum, item) => item.resource > maximum ? item.resource : maximum,
      0n,
    ),
    segments: [],
    maxDepth: Math.max(...values.map((value) => jsonValueDepthV1(value))),
  };
}

function analyzeSchemaInternal(schema, context, path, activeRefs) {
  if (schema === false) {
    fail(`unsatisfiable false schema encountered at ${path}`);
  }
  if (schema === true || schema === null || typeof schema !== "object") {
    fail(`unbounded schema production encountered at ${path}`);
  }
  const literal = analyzeLiteralSchemaTopologyV1(schema, path);
  if (literal !== undefined) return literal;
  if (typeof schema.$ref === "string") {
    context.refsResolved += 1;
    if (activeRefs.has(schema.$ref)) {
      fail(`cyclic $ref cannot be bounded at ${path}: ${schema.$ref}`);
    }
    const resolved = resolveJsonPointer(context.root, schema.$ref);
    const nextRefs = new Set(activeRefs);
    nextRefs.add(schema.$ref);
    return analyzeSchemaInternal(
      resolved,
      context,
      `${path}.$ref(${schema.$ref})`,
      nextRefs,
    );
  }
  if (schema.allOf !== undefined) {
    fail(`allOf production requires an explicit intersection proof at ${path}`);
  }
  const alternatives = schema.oneOf ?? schema.anyOf;
  if (alternatives !== undefined) {
    if (!Array.isArray(alternatives) || alternatives.length === 0) {
      fail(`empty union encountered at ${path}`);
    }
    context.unionsVisited += 1;
    const unionKey = schema.oneOf === alternatives ? "oneOf" : "anyOf";
    const analyses = alternatives.map((alternative, index) =>
      analyzeSchemaInternal(
        alternative,
        context,
        `${path}.${unionKey}[${index}]`,
        activeRefs,
      ),
    );
    const baseCases = pruneBaseCases(
      analyses.flatMap((analysis) => analysis.baseCases),
      path,
    );
    return {
      minBytes: Math.min(...baseCases.map((item) => item.bytes)),
      base: maxBaseCaseVector(baseCases),
      baseCases,
      structuralMax: analyses.reduce(
        (maximum, current) => maxVector(maximum, current.structuralMax),
        ZERO_VECTOR,
      ),
      density: analyses.reduce(
        (maximum, current) => maxDensity(maximum, current.density),
        ZERO_DENSITY,
      ),
      maxDepth: Math.max(...analyses.map((analysis) => analysis.maxDepth)),
    };
  }

  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.includes("object")) {
    if (types.length !== 1) {
      fail(`mixed object type production is not explicitly bounded at ${path}`);
    }
    if (
      schema.additionalProperties !== false ||
      schema.patternProperties !== undefined ||
      schema.unevaluatedProperties !== undefined
    ) {
      fail(`non-strict object production encountered at ${path}`);
    }
    const properties = schema.properties;
    if (
      properties === null ||
      typeof properties !== "object" ||
      Array.isArray(properties)
    ) {
      fail(`object properties are unavailable at ${path}`);
    }
    const required = new Set(schema.required ?? []);
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(properties, key)) {
        fail(`required property ${key} is absent from ${path}.properties`);
      }
    }
    let structuralMax = vector(1n, BigInt(Object.keys(properties).length), 0n);
    let density = ZERO_DENSITY;
    let maxDepth = 1;
    let baseCases = [
      {
        bytes: 2,
        resources: vector(1n, BigInt(required.size), 0n),
      },
    ];
    let requiredIndex = 0;
    for (const [key, childSchema] of Object.entries(properties)) {
      const child = analyzeSchemaInternal(
        childSchema,
        context,
        `${path}.properties.${key}`,
        activeRefs,
      );
      maxDepth = Math.max(maxDepth, 1 + child.maxDepth);
      density = maxDensity(density, child.density);
      structuralMax = addVector(structuralMax, child.structuralMax);
      const propertyPrefixBytes =
        Buffer.byteLength(JSON.stringify(key), "utf8") + 1;
      if (required.has(key)) {
        baseCases = combineBaseCases(
          baseCases,
          child.baseCases,
          propertyPrefixBytes + (requiredIndex === 0 ? 0 : 1),
          ZERO_VECTOR,
          `${path}.properties.${key}`,
        );
        requiredIndex += 1;
      } else {
        density = maxDensity(
          density,
          densityForBaseCases(
            child.baseCases,
            vector(0n, 1n, 0n),
            propertyPrefixBytes,
          ),
        );
      }
    }
    return {
      minBytes: Math.min(...baseCases.map((item) => item.bytes)),
      base: maxBaseCaseVector(baseCases),
      baseCases,
      structuralMax,
      density,
      maxDepth,
    };
  }

  if (types.includes("array")) {
    if (types.length !== 1) {
      fail(`mixed array type production is not explicitly bounded at ${path}`);
    }
    const minItems = schema.minItems ?? 0;
    if (!Number.isSafeInteger(minItems) || minItems < 0) {
      fail(`invalid minItems at ${path}`);
    }
    let maxItems = schema.maxItems;
    if (maxItems === undefined) {
      const override = cardinalityOverride(context, path);
      maxItems = override.maximum;
      context.unboundedArrayOverrides.push({
        path: override.normalizedPath,
        maxItems,
        source: override.source,
      });
    }
    if (
      !Number.isSafeInteger(maxItems) ||
      maxItems < minItems ||
      maxItems < 0
    ) {
      fail(`invalid or unbounded maxItems at ${path}`);
    }
    if (schema.contains !== undefined) {
      fail(`contains production requires a dedicated bound at ${path}`);
    }
    if (schema.uniqueItems === true) {
      fail(
        `uniqueItems requires a distinct-value production proof at ${path}`,
      );
    }
    if (Array.isArray(schema.prefixItems) && schema.prefixItems.length !== 0) {
      if (schema.items !== false || maxItems > schema.prefixItems.length) {
        fail(`open tuple production is not explicitly bounded at ${path}`);
      }
      if (minItems !== maxItems) {
        fail(`optional tuple slots require a dedicated bound at ${path}`);
      }
      let structuralMax = vector(1n, 1n, 0n);
      let density = ZERO_DENSITY;
      let maxDepth = 1;
      let baseCases = [
        { bytes: 2, resources: vector(1n, 1n, 0n) },
      ];
      for (let index = 0; index < maxItems; index += 1) {
        const child = analyzeSchemaInternal(
          schema.prefixItems[index],
          context,
          `${path}.prefixItems[${index}]`,
          activeRefs,
        );
        const slot = vector(0n, 1n, 1n);
        baseCases = combineBaseCases(
          baseCases,
          child.baseCases,
          index === 0 ? 0 : 1,
          slot,
          `${path}.prefixItems[${index}]`,
        );
        structuralMax = addVector(
          structuralMax,
          addVector(child.structuralMax, slot),
        );
        density = maxDensity(density, child.density);
        maxDepth = Math.max(maxDepth, 1 + child.maxDepth);
      }
      return {
        minBytes: Math.min(...baseCases.map((item) => item.bytes)),
        base: maxBaseCaseVector(baseCases),
        baseCases,
        structuralMax,
        density,
        maxDepth,
      };
    }
    if (schema.items === false || schema.items === undefined) {
      if (maxItems !== 0) fail(`array items are unavailable at ${path}`);
      return {
        minBytes: 2,
        base: vector(1n, 1n, 0n),
        baseCases: [
          { bytes: 2, resources: vector(1n, 1n, 0n) },
        ],
        structuralMax: vector(1n, 1n, 0n),
        density: ZERO_DENSITY,
        maxDepth: 1,
      };
    }
    const child = analyzeSchemaInternal(
      schema.items,
      context,
      `${path}.items`,
      activeRefs,
    );
    const itemBase = addVector(child.base, vector(0n, 1n, 1n));
    const itemMax = addVector(child.structuralMax, vector(0n, 1n, 1n));
    let baseCases = [
      { bytes: 2, resources: vector(1n, 1n, 0n) },
    ];
    for (let index = 0; index < minItems; index += 1) {
      baseCases = combineBaseCases(
        baseCases,
        child.baseCases,
        index === 0 ? 0 : 1,
        vector(0n, 1n, 1n),
        `${path}.items[${index}]`,
      );
    }
    const structuralMax = addVector(
      vector(1n, 1n, 0n),
      multiplyVector(itemMax, BigInt(maxItems)),
    );
    const density = maxDensity(
      child.density,
      densityForBaseCases(
        child.baseCases,
        vector(0n, 1n, 1n),
        0,
      ),
    );
    return {
      minBytes: Math.min(...baseCases.map((item) => item.bytes)),
      base: maxBaseCaseVector(baseCases),
      baseCases,
      structuralMax,
      density,
      maxDepth: 1 + child.maxDepth,
    };
  }

  const minBytes = minimumPrimitiveBytes(schema, path);
  return {
    minBytes,
    base: ZERO_VECTOR,
    baseCases: [{ bytes: minBytes, resources: ZERO_VECTOR }],
    structuralMax: ZERO_VECTOR,
    density: ZERO_DENSITY,
    maxDepth: 0,
  };
}

function deduplicateOverrides(overrides) {
  const byKey = new Map();
  for (const override of overrides) {
    const key = `${override.path}\u0000${override.maxItems}\u0000${override.source}`;
    byKey.set(key, override);
  }
  return [...byKey.values()].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
}

export function analyzeJsonSchemaTopologyV1(
  schema,
  { branch = "synthetic", unboundedArrayMaxItems } = {},
) {
  if (
    unboundedArrayMaxItems === undefined &&
    branch !== "registryManifestHistory"
  ) {
    fail(
      `an explicit canonical-byte-derived unboundedArrayMaxItems is required for ${branch}`,
    );
  }
  const context = {
    branch,
    root: schema,
    unboundedArrayMaxItems:
      unboundedArrayMaxItems ??
      POLICY_CARDINALITY_V1.registryManifestJsonContainerEntryHardCap,
    refsResolved: 0,
    unionsVisited: 0,
    unboundedArrayOverrides: [],
  };
  const analysis = analyzeSchemaInternal(schema, context, "$", new Set());
  return {
    ...analysis,
    refsResolved: context.refsResolved,
    unionsVisited: context.unionsVisited,
    unboundedArrayOverrides: deduplicateOverrides(
      context.unboundedArrayOverrides,
    ),
  };
}

function objectiveValue(resources, weights) {
  return (
    resources.identities * weights.identities +
    resources.ownKeys * weights.ownKeys +
    resources.dense * weights.dense
  );
}

function pruneScalarCases(cases, path) {
  const unique = new Map();
  for (const item of cases) {
    unique.set(`${item.bytes}:${item.resource}`, item);
  }
  const candidates = [...unique.values()];
  const retained = candidates.filter(
    (candidate, index) =>
      !candidates.some(
        (other, otherIndex) =>
          index !== otherIndex &&
          other.bytes <= candidate.bytes &&
          other.resource >= candidate.resource &&
          (other.bytes < candidate.bytes ||
            other.resource > candidate.resource),
      ),
  );
  if (retained.length > 10_000) {
    fail(`scalar base-production frontier is too large at ${path}`);
  }
  return retained.sort(
    (left, right) => left.bytes - right.bytes ||
      (left.resource < right.resource ? -1 : left.resource > right.resource ? 1 : 0),
  );
}

function combineScalarCases(leftCases, rightCases, extraBytes, extraResource, path) {
  const combined = [];
  for (const left of leftCases) {
    for (const right of rightCases) {
      combined.push({
        bytes: left.bytes + extraBytes + right.bytes,
        resource: left.resource + extraResource + right.resource,
      });
    }
  }
  return pruneScalarCases(combined, path);
}

function compareSegmentDensity(left, right) {
  const comparison =
    left.density.numerator * right.density.denominator -
    right.density.numerator * left.density.denominator;
  if (comparison !== 0n) return comparison > 0n ? -1 : 1;
  return left.source.localeCompare(right.source);
}

function maximumRatio(left, right) {
  return maxRatio(left, right);
}

function finiteFrontierGain(segments, byteBudget, structuralGainCap) {
  let remainingBytes = BigInt(Math.max(0, byteBudget));
  let remainingStructuralGain = structuralGainCap;
  let gain = 0n;
  for (const segment of [...segments].sort(compareSegmentDensity)) {
    if (
      remainingBytes === 0n ||
      remainingStructuralGain === 0n ||
      segment.maxGain === 0n ||
      segment.density.numerator === 0n
    ) {
      continue;
    }
    const segmentGainCap =
      segment.maxGain < remainingStructuralGain
        ? segment.maxGain
        : remainingStructuralGain;
    const affordableGain =
      (remainingBytes * segment.density.numerator) /
      segment.density.denominator;
    if (affordableGain < segmentGainCap) {
      gain += affordableGain;
      return gain;
    }
    gain += segmentGainCap;
    remainingStructuralGain -= segmentGainCap;
    const bytesForCap =
      (segmentGainCap * segment.density.denominator +
        segment.density.numerator -
        1n) /
      segment.density.numerator;
    remainingBytes =
      bytesForCap >= remainingBytes ? 0n : remainingBytes - bytesForCap;
  }
  return gain;
}

function boundObjectiveProfile(profile, byteCeiling) {
  if (profile.minBytes > byteCeiling) {
    fail(
      `${profile.label} minimum production ${profile.minBytes} exceeds ${byteCeiling}`,
    );
  }
  // Base maxima and structural maxima may come from different union plans.
  // Giving the frontier the complete structural capacity and clamping the
  // final result avoids subtracting an incompatible base plan.
  const structuralGain = profile.structuralMax;
  const gain = finiteFrontierGain(
    profile.segments,
    byteCeiling - profile.minBytes,
    structuralGain,
  );
  const maximum = profile.baseMax + gain;
  return maximum < profile.structuralMax ? maximum : profile.structuralMax;
}

function configurationRatioUpper(
  profile,
  extraResource,
  extraBytes,
  byteCeiling,
) {
  let maximum = ratio(0n, 1n);
  const sortedSegments = [...profile.segments].sort(compareSegmentDensity);
  for (const baseCase of profile.baseCases) {
    const baseBytes = baseCase.bytes + extraBytes;
    if (baseBytes <= 0 || baseBytes > byteCeiling) continue;
    let usedBytes = 0n;
    let resource = baseCase.resource + extraResource;
    const resourceCap = profile.structuralMax + extraResource;
    maximum = maximumRatio(maximum, ratio(resource, BigInt(baseBytes)));
    for (const segment of sortedSegments) {
      if (
        resource >= resourceCap ||
        segment.maxGain === 0n ||
        segment.density.numerator === 0n
      ) {
        continue;
      }
      const availableBytes =
        BigInt(byteCeiling - baseBytes) - usedBytes;
      if (availableBytes <= 0n) break;
      const remainingResource = resourceCap - resource;
      const segmentGainCap =
        segment.maxGain < remainingResource
          ? segment.maxGain
          : remainingResource;
      const affordableGain =
        (availableBytes * segment.density.numerator) /
        segment.density.denominator;
      const addedGain =
        affordableGain < segmentGainCap ? affordableGain : segmentGainCap;
      if (addedGain === 0n) continue;
      const addedBytes =
        (addedGain * segment.density.denominator +
          segment.density.numerator -
          1n) /
        segment.density.numerator;
      resource += addedGain;
      usedBytes += addedBytes;
      maximum = maximumRatio(
        maximum,
        ratio(resource, BigInt(baseBytes) + usedBytes),
      );
      if (addedGain < segmentGainCap) break;
    }
  }
  return maximum;
}

function scaleSegments(segments, count, sourcePrefix) {
  const multiplier = BigInt(count);
  return segments.map((segment) => ({
    ...segment,
    maxGain: segment.maxGain * multiplier,
    source: `${sourcePrefix}${segment.source}`,
  }));
}

function analyzeObjectiveInternal(schema, context, path, activeRefs) {
  if (schema === false) fail(`false objective production at ${path}`);
  if (schema === true || schema === null || typeof schema !== "object") {
    fail(`unbounded objective production at ${path}`);
  }
  const literal = analyzeLiteralSchemaObjectiveV1(schema, context, path);
  if (literal !== undefined) return literal;
  if (typeof schema.$ref === "string") {
    if (activeRefs.has(schema.$ref)) {
      fail(`cyclic objective $ref at ${path}: ${schema.$ref}`);
    }
    const nextRefs = new Set(activeRefs);
    nextRefs.add(schema.$ref);
    return analyzeObjectiveInternal(
      resolveJsonPointer(context.root, schema.$ref),
      context,
      `${path}.$ref(${schema.$ref})`,
      nextRefs,
    );
  }
  if (schema.allOf !== undefined) {
    fail(`allOf objective production requires an intersection proof at ${path}`);
  }
  const alternatives = schema.oneOf ?? schema.anyOf;
  if (alternatives !== undefined) {
    const unionKey = schema.oneOf === alternatives ? "oneOf" : "anyOf";
    const analyses = alternatives.map((alternative, index) =>
      analyzeObjectiveInternal(
        alternative,
        context,
        `${path}.${unionKey}[${index}]`,
        activeRefs,
      ),
    );
    if (analyses.length > 1) {
      context.relaxations.add(
        `${path}.${unionKey}: mutually exclusive alternative segment capacities are combined, then clamped by the largest alternative structural objective`,
      );
    }
    const baseCases = pruneScalarCases(
      analyses.flatMap((analysis) => analysis.baseCases),
      path,
    );
    return {
      label: `${context.label}:${path}`,
      minBytes: Math.min(...baseCases.map((item) => item.bytes)),
      baseMax: baseCases.reduce(
        (maximum, item) => item.resource > maximum ? item.resource : maximum,
        0n,
      ),
      baseCases,
      structuralMax: analyses.reduce(
        (maximum, item) =>
          item.structuralMax > maximum ? item.structuralMax : maximum,
        0n,
      ),
      segments: analyses.flatMap((analysis) => analysis.segments),
      maxDepth: Math.max(...analyses.map((analysis) => analysis.maxDepth)),
    };
  }

  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.includes("object")) {
    if (
      types.length !== 1 ||
      schema.additionalProperties !== false ||
      schema.patternProperties !== undefined ||
      schema.unevaluatedProperties !== undefined
    ) {
      fail(`non-strict objective object at ${path}`);
    }
    const properties = schema.properties;
    if (properties === null || typeof properties !== "object") {
      fail(`objective object properties unavailable at ${path}`);
    }
    const required = new Set(schema.required ?? []);
    const shellResource =
      context.weights.identities +
      BigInt(required.size) * context.weights.ownKeys;
    let baseCases = [{ bytes: 2, resource: shellResource }];
    let structuralMax =
      context.weights.identities +
      BigInt(Object.keys(properties).length) * context.weights.ownKeys;
    let segments = [];
    let maxDepth = 1;
    let requiredIndex = 0;
    for (const [key, childSchema] of Object.entries(properties)) {
      const child = analyzeObjectiveInternal(
        childSchema,
        context,
        `${path}.properties.${key}`,
        activeRefs,
      );
      const propertyBytes =
        Buffer.byteLength(JSON.stringify(key), "utf8") + 1;
      structuralMax += child.structuralMax;
      maxDepth = Math.max(maxDepth, 1 + child.maxDepth);
      if (required.has(key)) {
        baseCases = combineScalarCases(
          baseCases,
          child.baseCases,
          propertyBytes + (requiredIndex === 0 ? 0 : 1),
          0n,
          `${path}.properties.${key}`,
        );
        requiredIndex += 1;
        segments.push(
          ...child.segments.map((segment) => ({
            ...segment,
            source: `${path}.properties.${key} -> ${segment.source}`,
          })),
        );
      } else {
        const optionalRatio = configurationRatioUpper(
          child,
          context.weights.ownKeys,
          propertyBytes,
          context.byteCeiling,
        );
        const optionalMaximum =
          boundObjectiveProfile(child, context.byteCeiling) +
          context.weights.ownKeys;
        segments.push({
          density: optionalRatio,
          maxGain: optionalMaximum,
          source: `${path}.properties.${key} optional complete-production group`,
        });
        context.relaxations.add(
          `${path}.properties.${key}: optional complete-production group uses a finite-capacity fractional ratio`,
        );
      }
    }
    return {
      label: `${context.label}:${path}`,
      minBytes: Math.min(...baseCases.map((item) => item.bytes)),
      baseMax: baseCases.reduce(
        (maximum, item) => item.resource > maximum ? item.resource : maximum,
        0n,
      ),
      baseCases,
      structuralMax,
      segments,
      maxDepth,
    };
  }

  if (types.includes("array")) {
    if (types.length !== 1) fail(`mixed objective array type at ${path}`);
    const minItems = schema.minItems ?? 0;
    let maxItems = schema.maxItems;
    if (maxItems === undefined) {
      maxItems = cardinalityOverride(context, path).maximum;
    }
    if (
      !Number.isSafeInteger(minItems) ||
      !Number.isSafeInteger(maxItems) ||
      minItems < 0 ||
      maxItems < minItems
    ) {
      fail(`invalid objective array cardinality at ${path}`);
    }
    if (schema.contains !== undefined) {
      fail(`contains objective production requires a dedicated bound at ${path}`);
    }
    if (schema.uniqueItems === true) {
      fail(
        `uniqueItems requires a distinct-value objective proof at ${path}`,
      );
    }
    const shellResource = context.weights.identities + context.weights.ownKeys;
    const slotResource = context.weights.ownKeys + context.weights.dense;
    if (Array.isArray(schema.prefixItems) && schema.prefixItems.length !== 0) {
      if (schema.items !== false || minItems !== maxItems) {
        fail(`open objective tuple at ${path}`);
      }
      let baseCases = [{ bytes: 2, resource: shellResource }];
      let structuralMax = shellResource;
      let segments = [];
      let maxDepth = 1;
      for (let index = 0; index < maxItems; index += 1) {
        const child = analyzeObjectiveInternal(
          schema.prefixItems[index],
          context,
          `${path}.prefixItems[${index}]`,
          activeRefs,
        );
        baseCases = combineScalarCases(
          baseCases,
          child.baseCases,
          index === 0 ? 0 : 1,
          slotResource,
          `${path}.prefixItems[${index}]`,
        );
        structuralMax += slotResource + child.structuralMax;
        segments.push(...child.segments);
        maxDepth = Math.max(maxDepth, 1 + child.maxDepth);
      }
      return {
        label: `${context.label}:${path}`,
        minBytes: Math.min(...baseCases.map((item) => item.bytes)),
        baseMax: baseCases.reduce(
          (maximum, item) => item.resource > maximum ? item.resource : maximum,
          0n,
        ),
        baseCases,
        structuralMax,
        segments,
        maxDepth,
      };
    }
    if (schema.items === false || schema.items === undefined) {
      if (maxItems !== 0) fail(`objective array items unavailable at ${path}`);
      return {
        label: `${context.label}:${path}`,
        minBytes: 2,
        baseMax: shellResource,
        baseCases: [{ bytes: 2, resource: shellResource }],
        structuralMax: shellResource,
        segments: [],
        maxDepth: 1,
      };
    }
    const child = analyzeObjectiveInternal(
      schema.items,
      context,
      `${path}.items`,
      activeRefs,
    );
    let baseCases = [{ bytes: 2, resource: shellResource }];
    for (let index = 0; index < minItems; index += 1) {
      baseCases = combineScalarCases(
        baseCases,
        child.baseCases,
        index === 0 ? 0 : 1,
        slotResource,
        `${path}.items[${index}]`,
      );
    }
    const structuralMax =
      shellResource +
      BigInt(maxItems) * (slotResource + child.structuralMax);
    const segments = scaleSegments(
      child.segments,
      minItems,
      `${path}.requiredItem -> `,
    );
    let additionalCount = maxItems - minItems;
    if (minItems === 0 && additionalCount !== 0) {
      const firstItemRatio = configurationRatioUpper(
        child,
        slotResource,
        0,
        context.byteCeiling,
      );
      const firstItemMaximum =
        boundObjectiveProfile(child, context.byteCeiling) + slotResource;
      segments.push({
        density: firstItemRatio,
        maxGain: firstItemMaximum,
        source: `${path}: first complete-item production from an empty array`,
      });
      context.relaxations.add(
        `${path}: the first complete item from an empty array is count-capped and charged no comma byte`,
      );
      additionalCount -= 1;
    }
    if (additionalCount !== 0) {
      const itemRatio = configurationRatioUpper(
        child,
        slotResource,
        1,
        context.byteCeiling,
      );
      const itemMaximum =
        boundObjectiveProfile(child, context.byteCeiling) + slotResource;
      segments.push({
        density: itemRatio,
        maxGain: BigInt(additionalCount) * itemMaximum,
        source: `${path}: ${additionalCount} additional complete-item productions`,
      });
      context.relaxations.add(
        `${path}: repeated complete-item choices use a count-capped fractional frontier; comma cost is charged to every item after a present predecessor`,
      );
    }
    return {
      label: `${context.label}:${path}`,
      minBytes: Math.min(...baseCases.map((item) => item.bytes)),
      baseMax: baseCases.reduce(
        (maximum, item) => item.resource > maximum ? item.resource : maximum,
        0n,
      ),
      baseCases,
      structuralMax,
      segments,
      maxDepth: 1 + child.maxDepth,
    };
  }

  const minBytes = minimumPrimitiveBytes(schema, path);
  return {
    label: `${context.label}:${path}`,
    minBytes,
    baseMax: 0n,
    baseCases: [{ bytes: minBytes, resource: 0n }],
    structuralMax: 0n,
    segments: [],
    maxDepth: 0,
  };
}

export function analyzeJsonSchemaFiniteObjectiveV1(
  schema,
  {
    branch = "synthetic",
    byteCeiling,
    unboundedArrayMaxItems,
    weights = { identities: 1, ownKeys: 0, dense: 0 },
    label = "objective",
  } = {},
) {
  if (!Number.isSafeInteger(byteCeiling) || byteCeiling < 1) {
    fail(`${label} byteCeiling must be a positive safe integer`);
  }
  const normalizedWeights = {
    identities: BigInt(weights.identities),
    ownKeys: BigInt(weights.ownKeys),
    dense: BigInt(weights.dense),
  };
  const context = {
    branch,
    root: schema,
    byteCeiling,
    unboundedArrayMaxItems:
      unboundedArrayMaxItems ??
      (branch === "registryManifestHistory"
        ? POLICY_CARDINALITY_V1.registryManifestJsonContainerEntryHardCap
        : byteCeiling),
    weights: normalizedWeights,
    label,
    relaxations: new Set(),
  };
  const profile = analyzeObjectiveInternal(schema, context, "$", new Set());
  return {
    ...profile,
    maximum: boundObjectiveProfile(profile, byteCeiling),
    weights: {
      identities: Number(normalizedWeights.identities),
      ownKeys: Number(normalizedWeights.ownKeys),
      dense: Number(normalizedWeights.dense),
    },
    relaxations: [...context.relaxations].sort(),
  };
}

export function boundJsonSchemaTopologyV1(analysis, byteCeiling) {
  if (analysis.minBytes > byteCeiling) {
    fail(
      `minimum canonical production (${analysis.minBytes}) exceeds byte ceiling ${byteCeiling}`,
    );
  }
  const bytes = BigInt(byteCeiling);
  const expansion = vector(
    (bytes * analysis.density.identities.numerator) /
      analysis.density.identities.denominator,
    (bytes * analysis.density.ownKeys.numerator) /
      analysis.density.ownKeys.denominator,
    (bytes * analysis.density.dense.numerator) /
      analysis.density.dense.denominator,
  );
  return minVector(analysis.structuralMax, addVector(analysis.base, expansion));
}

function boundSharedHistory(rootAnalysis, registryAnalysis) {
  const rootCount = BigInt(LIMITS_V1.maxRootMetadataHistoryGenerations);
  const registryCount = BigInt(
    LIMITS_V1.maxRegistryManifestHistoryGenerations,
  );
  const structuralMax = addVector(
    multiplyVector(
      boundJsonSchemaTopologyV1(rootAnalysis, LIMITS_V1.maxTrustEnvelopeRawUnits),
      rootCount,
    ),
    multiplyVector(
      boundJsonSchemaTopologyV1(registryAnalysis, LIMITS_V1.maxTrustEnvelopeRawUnits),
      registryCount,
    ),
  );
  const base = addVector(
    multiplyVector(rootAnalysis.base, rootCount),
    multiplyVector(registryAnalysis.base, registryCount),
  );
  const density = maxDensity(rootAnalysis.density, registryAnalysis.density);
  const bytes = BigInt(LIMITS_V1.maxRetainedTrustHistoryRawUnits);
  const expansion = vector(
    (bytes * density.identities.numerator) / density.identities.denominator,
    (bytes * density.ownKeys.numerator) / density.ownKeys.denominator,
    (bytes * density.dense.numerator) / density.dense.denominator,
  );
  return minVector(structuralMax, addVector(base, expansion));
}

function ordinaryWork(topology) {
  return 5n +
    6n * topology.identities +
    topology.ownKeys +
    topology.dense;
}

function historyWork(length, topology) {
  return (
    10n +
    7n * BigInt(length) +
    7n * topology.identities +
    topology.ownKeys +
    topology.dense
  );
}

function extractArrayLiteral(source, name) {
  const match = source.match(
    new RegExp(
      `const ${name} = CapturedObjectFreezeV1\\(\\[([\\s\\S]*?)\\] as const\\);`,
      "u",
    ),
  );
  if (match === null) fail(`cannot extract ${name} from production point`);
  return [...match[1].matchAll(/"([^"]+)"/gu)].map((item) => item[1]);
}

function extractNumericLiteral(source, name) {
  const match = source.match(
    new RegExp(`(?:export )?const ${name} = ([0-9_]+);`, "u"),
  );
  if (match === null) fail(`cannot extract numeric literal ${name}`);
  return Number(match[1].replaceAll("_", ""));
}

function exactConst(schema, property) {
  const value = schema?.properties?.[property]?.const;
  if (!Number.isSafeInteger(value)) {
    fail(`policy literal ${property} is missing or not a safe integer`);
  }
  return value;
}

function assertEqual(actual, expected, label) {
  if (canonicalJsonV1(actual) !== canonicalJsonV1(expected)) {
    fail(`${label} drifted: expected ${canonicalJsonV1(expected)}, observed ${canonicalJsonV1(actual)}`);
  }
}

function sourceDescriptor(branch, schemaName, bytes, schema, analysis) {
  return {
    branch,
    schemaName,
    schemaId: schema.$id,
    rawSha256: rawSha256V1(bytes),
    semanticDigest: semanticDigestV1(schema),
    traversal: {
      refsResolved: analysis.refsResolved,
      unionsVisited: analysis.unionsVisited,
      unboundedArrayOverrides: analysis.unboundedArrayOverrides,
    },
  };
}

function orderedBound(scope, topology, work, derivation) {
  return {
    scope,
    maxIdentities: saturatingNumber(topology.identities, `${scope} identities`),
    maxWorkUnits: saturatingNumber(work, `${scope} work units`),
    derivation,
  };
}

function orderedObjectiveBound(scope, identities, work, derivation) {
  return {
    scope,
    maxIdentities: saturatingNumber(identities, `${scope} identities`),
    maxWorkUnits: saturatingNumber(work, `${scope} work units`),
    derivation,
  };
}

function maximumBaseCaseBytes(analysis) {
  return Math.max(...analysis.baseCases.map((item) => item.bytes));
}

function minimumBaseCase(analysis) {
  return analysis.baseCases.reduce((minimum, item) =>
    item.bytes < minimum.bytes ? item : minimum,
  );
}

function historyGroupUpper(groups, byteCeiling) {
  const segments = groups.map((group) => ({
    density: group.density,
    maxGain: BigInt(group.count) * group.maximumPerEnvelope,
    source: group.source,
  }));
  return finiteFrontierGain(
    segments,
    byteCeiling,
    segments.reduce((total, segment) => total + segment.maxGain, 0n),
  );
}

export function boundSharedFiniteObjectiveV1(groups, sharedByteCeiling) {
  if (!Number.isSafeInteger(sharedByteCeiling) || sharedByteCeiling < 0) {
    fail("shared finite-objective byte ceiling must be a nonnegative safe integer");
  }
  if (!Array.isArray(groups) || groups.length === 0) {
    fail("shared finite-objective groups must be a nonempty array");
  }
  const normalized = groups.map((group, index) => {
    if (
      group === null ||
      typeof group !== "object" ||
      !Number.isSafeInteger(group.count) ||
      group.count < 0 ||
      !Number.isSafeInteger(group.perEnvelopeByteCeiling) ||
      group.perEnvelopeByteCeiling < 1 ||
      typeof group.profile !== "object" ||
      typeof group.extraResource !== "bigint" ||
      typeof group.source !== "string"
    ) {
      fail(`invalid shared finite-objective group at index ${index}`);
    }
    return {
      count: group.count,
      maximumPerEnvelope:
        group.profile.maximum + group.extraResource,
      density: configurationRatioUpper(
        group.profile,
        group.extraResource,
        0,
        group.perEnvelopeByteCeiling,
      ),
      source: group.source,
    };
  });
  return historyGroupUpper(normalized, sharedByteCeiling);
}

function canonicalJsonBytes(value) {
  const json = canonicalJsonV1(value);
  return { json, bytes: Buffer.byteLength(json, "utf8") };
}

function measureJsonTopologyV1(value, path = "$") {
  if (value === null || typeof value !== "object") return ZERO_VECTOR;
  if (Array.isArray(value)) {
    let result = vector(1n, BigInt(value.length + 1), BigInt(value.length));
    for (let index = 0; index < value.length; index += 1) {
      result = addVector(
        result,
        measureJsonTopologyV1(value[index], `${path}[${index}]`),
      );
    }
    return result;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(`constructive witness contains a non-data object at ${path}`);
  }
  const keys = Object.keys(value);
  let result = vector(1n, BigInt(keys.length), 0n);
  for (const key of keys) {
    result = addVector(
      result,
      measureJsonTopologyV1(value[key], `${path}.${key}`),
    );
  }
  return result;
}

function topologyRecord(value, label) {
  const measured = measureJsonTopologyV1(value);
  return {
    identities: saturatingNumber(measured.identities, `${label} identities`),
    ownKeys: saturatingNumber(measured.ownKeys, `${label} own keys`),
    denseIndices: saturatingNumber(measured.dense, `${label} dense indices`),
  };
}

function createWitnessValidatorFactory() {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: false,
  });
  const cache = new WeakMap();
  return (schema) => {
    let validate = cache.get(schema);
    if (validate === undefined) {
      validate = ajv.compile(schema);
      cache.set(schema, validate);
    }
    return validate;
  };
}

function assertSchemaAccepted(validate, value, label) {
  if (validate(value)) return;
  const errors = (validate.errors ?? [])
    .slice(0, 3)
    .map((error) => `${error.instancePath || "$"} ${error.message ?? "invalid"}`)
    .join("; ");
  fail(`${label} is not accepted by its current Ajv Schema: ${errors}`);
}

function minimizeStringWitness(value, validate) {
  let current = value;
  const fixedCandidates = [
    "",
    "0",
    "1",
    "a",
    "00",
    "0.0.0",
    "no-crash",
    "base64url:",
    "1970-01-01T00:00:00Z",
  ];
  for (const candidate of fixedCandidates) {
    if (
      Buffer.byteLength(candidate, "utf8") <
        Buffer.byteLength(current, "utf8") &&
      validate(candidate)
    ) {
      current = candidate;
    }
  }

  let granularity = 2;
  while (current.length !== 0) {
    const chunkLength = Math.ceil(current.length / granularity);
    let removed = false;
    for (let start = 0; start < current.length; start += chunkLength) {
      const candidate =
        current.slice(0, start) + current.slice(start + chunkLength);
      if (validate(candidate)) {
        current = candidate;
        granularity = Math.max(2, granularity - 1);
        removed = true;
        break;
      }
    }
    if (removed) continue;
    if (granularity >= current.length) break;
    granularity = Math.min(current.length, granularity * 2);
  }
  return current;
}

function minimizeWitnessValueV1(schema, value, validatorFor, path = "$") {
  if (schema === false || schema === true || schema === null || typeof schema !== "object") {
    fail(`constructive minimizer requires a closed schema at ${path}`);
  }
  if (schema.$ref !== undefined || schema.allOf !== undefined) {
    fail(`constructive minimizer requires an inline non-allOf schema at ${path}`);
  }
  const validate = validatorFor(schema);
  assertSchemaAccepted(validate, value, `${path} source exemplar`);

  if (Object.prototype.hasOwnProperty.call(schema, "const")) {
    return structuredClone(schema.const);
  }
  if (Array.isArray(schema.enum) && schema.enum.length !== 0) {
    return structuredClone(
      schema.enum.reduce((best, candidate) =>
        canonicalJsonBytes(candidate).bytes < canonicalJsonBytes(best).bytes
          ? candidate
          : best,
      ),
    );
  }

  const alternatives = schema.oneOf ?? schema.anyOf;
  if (alternatives !== undefined) {
    let best;
    for (let index = 0; index < alternatives.length; index += 1) {
      const alternative = alternatives[index];
      const alternativeValidate = validatorFor(alternative);
      if (!alternativeValidate(value)) continue;
      const candidate = minimizeWitnessValueV1(
        alternative,
        structuredClone(value),
        validatorFor,
        `${path}.${schema.oneOf === alternatives ? "oneOf" : "anyOf"}[${index}]`,
      );
      if (!validate(candidate)) continue;
      if (
        best === undefined ||
        canonicalJsonBytes(candidate).bytes < canonicalJsonBytes(best).bytes
      ) {
        best = candidate;
      }
    }
    if (best === undefined) {
      fail(`constructive union has no reproducible selected alternative at ${path}`);
    }
    return best;
  }

  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.length !== 1) {
    fail(`constructive minimizer does not accept mixed types at ${path}`);
  }
  const type = types[0];
  if (type === "object") {
    const properties = schema.properties;
    if (
      schema.additionalProperties !== false ||
      properties === null ||
      typeof properties !== "object"
    ) {
      fail(`constructive minimizer requires a strict object at ${path}`);
    }
    const required = new Set(schema.required ?? []);
    let current = structuredClone(value);
    for (const key of Object.keys(current)) {
      if (required.has(key)) continue;
      const candidate = structuredClone(current);
      delete candidate[key];
      if (validate(candidate)) current = candidate;
    }
    for (const key of Object.keys(current)) {
      const childSchema = properties[key];
      if (childSchema === undefined) continue;
      const minimized = minimizeWitnessValueV1(
        childSchema,
        current[key],
        validatorFor,
        `${path}.properties.${key}`,
      );
      const candidate = structuredClone(current);
      candidate[key] = minimized;
      if (validate(candidate)) current = candidate;
    }
    assertSchemaAccepted(validate, current, `${path} minimized object`);
    return current;
  }
  if (type === "array") {
    if (
      schema.uniqueItems === true ||
      schema.contains !== undefined ||
      schema.prefixItems !== undefined
    ) {
      fail(`constructive minimizer cannot prove constrained array repetition at ${path}`);
    }
    if (schema.items === undefined || schema.items === false) {
      fail(`constructive minimizer requires array items at ${path}`);
    }
    const minimum = schema.minItems ?? 0;
    let current = structuredClone(value);
    while (current.length > minimum) {
      const candidate = current.slice(0, -1);
      if (!validate(candidate)) break;
      current = candidate;
    }
    for (let index = 0; index < current.length; index += 1) {
      const minimized = minimizeWitnessValueV1(
        schema.items,
        current[index],
        validatorFor,
        `${path}.items[${index}]`,
      );
      const candidate = structuredClone(current);
      candidate[index] = minimized;
      if (validate(candidate)) current = candidate;
    }
    assertSchemaAccepted(validate, current, `${path} minimized array`);
    return current;
  }
  if (type === "string") {
    const current = minimizeStringWitness(value, validate);
    assertSchemaAccepted(validate, current, `${path} minimized string`);
    return current;
  }
  if (type === "integer" || type === "number") {
    for (const candidate of [0, 1, -1, schema.minimum, schema.maximum]) {
      if (typeof candidate === "number" && validate(candidate)) return candidate;
    }
    return value;
  }
  if (type === "boolean") return validate(false) ? false : value;
  if (type === "null") return null;
  fail(`constructive minimizer encountered unsupported type at ${path}: ${type}`);
}

function valueAtInstancePath(root, instancePath, label) {
  let current = root;
  for (const component of instancePath) {
    if (
      current === null ||
      typeof current !== "object" ||
      !Object.prototype.hasOwnProperty.call(current, component)
    ) {
      fail(`${label} instance path is unavailable at ${String(component)}`);
    }
    current = current[component];
  }
  return current;
}

function replaceAtInstancePath(root, instancePath, replacement, label) {
  if (instancePath.length === 0) {
    fail(`${label} cannot replace the witness root`);
  }
  const parent = valueAtInstancePath(
    root,
    instancePath.slice(0, -1),
    label,
  );
  const key = instancePath[instancePath.length - 1];
  if (
    parent === null ||
    typeof parent !== "object" ||
    !Object.prototype.hasOwnProperty.call(parent, key)
  ) {
    fail(`${label} replacement path is unavailable at ${String(key)}`);
  }
  parent[key] = replacement;
}

function assertExactSchemaKeywordsV1(schema, allowed, required, label) {
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
    fail(`${label} is not a schema object`);
  }
  const keys = Object.keys(schema).sort();
  const allowedSet = new Set(allowed);
  for (const key of keys) {
    if (!allowedSet.has(key)) {
      fail(`${label} has unproved cross-value keyword ${key}`);
    }
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(schema, key)) {
      fail(`${label} is missing required keyword ${key}`);
    }
  }
  return keys;
}

function auditRepeatableAncestorSchemaV1(schema, label, root = false) {
  if (schema.anyOf !== undefined || schema.oneOf !== undefined) {
    const unionKey = schema.anyOf !== undefined ? "anyOf" : "oneOf";
    assertExactSchemaKeywordsV1(schema, [unionKey], [unionKey], label);
    return;
  }
  if (schema.type === "object") {
    assertExactSchemaKeywordsV1(
      schema,
      root
        ? ["$id", "$schema", "type", "properties", "required", "additionalProperties"]
        : ["type", "properties", "required", "additionalProperties"],
      ["type", "properties", "required", "additionalProperties"],
      label,
    );
    if (schema.additionalProperties !== false) {
      fail(`${label} is not an exact-key object ancestor`);
    }
    return;
  }
  if (schema.type === "array") {
    assertExactSchemaKeywordsV1(
      schema,
      ["type", "items", "minItems"],
      ["type", "items"],
      label,
    );
    return;
  }
  fail(`${label} is not an audited object, array, or union ancestor`);
}

export function assertRepeatableArraySchemaPathV1(
  branchSchema,
  schemaPath,
  label = "constructive array",
) {
  if (!Array.isArray(schemaPath) || schemaPath.length === 0) {
    fail(`${label} schema path must be a nonempty array`);
  }
  let current = branchSchema;
  let path = "$";
  let ancestorCount = 0;
  auditRepeatableAncestorSchemaV1(current, path, true);
  ancestorCount += 1;
  for (let index = 0; index < schemaPath.length; index += 1) {
    const component = schemaPath[index];
    if (component === "properties") {
      const propertyName = schemaPath[index + 1];
      if (
        typeof propertyName !== "string" ||
        current?.properties === null ||
        typeof current?.properties !== "object" ||
        !Object.prototype.hasOwnProperty.call(current.properties, propertyName)
      ) {
        fail(`${label} schema property path is unavailable at ${path}`);
      }
      current = current.properties[propertyName];
      path += `.properties.${propertyName}`;
      index += 1;
    } else if (component === "items") {
      if (current?.items === undefined || current.items === false) {
        fail(`${label} schema items path is unavailable at ${path}`);
      }
      current = current.items;
      path += ".items";
    } else if (component === "anyOf" || component === "oneOf") {
      const alternativeIndex = schemaPath[index + 1];
      if (
        !Number.isSafeInteger(alternativeIndex) ||
        !Array.isArray(current?.[component]) ||
        current[component][alternativeIndex] === undefined
      ) {
        fail(`${label} union schema path is unavailable at ${path}`);
      }
      current = current[component][alternativeIndex];
      path += `.${component}[${alternativeIndex}]`;
      index += 1;
    } else {
      fail(`${label} has unsupported schema path component ${String(component)}`);
    }
    if (index < schemaPath.length - 1) {
      auditRepeatableAncestorSchemaV1(current, path);
      ancestorCount += 1;
    }
  }
  const keywords = assertRepeatableArraySchema(current, `${label}:${path}`);
  return {
    arraySchema: current,
    ancestorCount,
    exactArrayKeywords: keywords,
    auditedSchemaPath: path,
  };
}

function assertRepeatableArraySchema(arraySchema, label) {
  if (
    arraySchema === null ||
    typeof arraySchema !== "object" ||
    arraySchema.type !== "array" ||
    arraySchema.items === undefined ||
    arraySchema.items === false
  ) {
    fail(`${label} is not a homogeneous array production`);
  }
  const keywords = assertExactSchemaKeywordsV1(
    arraySchema,
    ["type", "items", "minItems"],
    ["type", "items"],
    label,
  );
  if ((arraySchema.minItems ?? 0) > 1) {
    fail(`${label} constructive baseline requires minItems <= 1`);
  }
  return keywords;
}

function materializeRepeatedArrayV1(exemplarCanonicalJson, additionalItems) {
  if (!Number.isSafeInteger(additionalItems) || additionalItems < 0) {
    fail("constructive final run length is invalid");
  }
  return JSON.parse(
    `[${exemplarCanonicalJson}${`,${exemplarCanonicalJson}`.repeat(additionalItems)}]`,
  );
}

function buildOrdinaryConstructiveRowV1({
  recipe,
  branchSchema,
  compatibleBase,
  validatorFor,
  ordinaryFormula,
}) {
  const repeatabilityAudit = assertRepeatableArraySchemaPathV1(
    branchSchema,
    recipe.schemaPath,
    `${recipe.branch}:${recipe.path}`,
  );
  assertEqual(
    repeatabilityAudit.arraySchema,
    recipe.arraySchema,
    `${recipe.branch} audited constructive array`,
  );
  const branchValidate = validatorFor(branchSchema);
  const itemValidate = validatorFor(recipe.arraySchema.items);
  const fullBranchBase = structuredClone(compatibleBase[recipe.branch]);
  assertSchemaAccepted(
    branchValidate,
    fullBranchBase,
    `${recipe.branch} compatible-base branch`,
  );
  const targetArray = valueAtInstancePath(
    fullBranchBase,
    recipe.instancePath,
    recipe.branch,
  );
  if (!Array.isArray(targetArray) || targetArray.length === 0) {
    fail(`${recipe.branch} compatible-base target array has no exemplar`);
  }
  let exemplar;
  for (let index = 0; index < targetArray.length; index += 1) {
    const candidate = minimizeWitnessValueV1(
      recipe.arraySchema.items,
      targetArray[index],
      validatorFor,
      `${recipe.branch}:${recipe.path}.items[${index}]`,
    );
    if (
      exemplar === undefined ||
      canonicalJsonBytes(candidate).bytes < canonicalJsonBytes(exemplar).bytes
    ) {
      exemplar = candidate;
    }
  }
  if (exemplar === undefined) {
    fail(`${recipe.branch} compatible-base target array has no valid exemplar`);
  }
  assertSchemaAccepted(itemValidate, exemplar, `${recipe.branch} minimized exemplar`);
  targetArray.splice(0, targetArray.length, structuredClone(exemplar));
  assertSchemaAccepted(
    branchValidate,
    fullBranchBase,
    `${recipe.branch} full-branch constructive base`,
  );

  const once = structuredClone(fullBranchBase);
  valueAtInstancePath(once, recipe.instancePath, recipe.branch).push(
    structuredClone(exemplar),
  );
  assertSchemaAccepted(branchValidate, once, `${recipe.branch} one-repeat probe`);
  const twice = structuredClone(once);
  valueAtInstancePath(twice, recipe.instancePath, recipe.branch).push(
    structuredClone(exemplar),
  );
  assertSchemaAccepted(branchValidate, twice, `${recipe.branch} two-repeat probe`);

  const baseCanonical = canonicalJsonBytes(fullBranchBase);
  const onceCanonical = canonicalJsonBytes(once);
  const twiceCanonical = canonicalJsonBytes(twice);
  const exemplarCanonical = canonicalJsonBytes(exemplar);
  const baseTopology = measureJsonTopologyV1(fullBranchBase);
  const onceTopology = measureJsonTopologyV1(once);
  const twiceTopology = measureJsonTopologyV1(twice);
  const delta = vector(
    onceTopology.identities - baseTopology.identities,
    onceTopology.ownKeys - baseTopology.ownKeys,
    onceTopology.dense - baseTopology.dense,
  );
  const secondDelta = vector(
    twiceTopology.identities - onceTopology.identities,
    twiceTopology.ownKeys - onceTopology.ownKeys,
    twiceTopology.dense - onceTopology.dense,
  );
  const exemplarTopology = measureJsonTopologyV1(exemplar);
  const expectedDelta = addVector(exemplarTopology, vector(0n, 1n, 1n));
  assertVectorEqual(
    delta,
    expectedDelta,
    `${recipe.branch} measured first topology delta`,
  );
  assertVectorEqual(
    secondDelta,
    expectedDelta,
    `${recipe.branch} measured second topology delta`,
  );
  const deltaBytes = exemplarCanonical.bytes + 1;
  assertEqual(
    onceCanonical.bytes - baseCanonical.bytes,
    deltaBytes,
    `${recipe.branch} measured first canonical-byte delta`,
  );
  assertEqual(
    twiceCanonical.bytes - onceCanonical.bytes,
    deltaBytes,
    `${recipe.branch} measured second canonical-byte delta`,
  );

  const repetitions = Math.floor(
    (LIMITS_V1.maxDistributionRawUnits - baseCanonical.bytes) / deltaBytes,
  );
  if (repetitions < 1) {
    fail(`${recipe.branch} full-branch constructive witness has no repetition capacity`);
  }
  const branchCanonicalBytesAtMost =
    baseCanonical.bytes + repetitions * deltaBytes;
  if (
    branchCanonicalBytesAtMost > LIMITS_V1.maxDistributionRawUnits ||
    branchCanonicalBytesAtMost + deltaBytes <= LIMITS_V1.maxDistributionRawUnits
  ) {
    fail(`${recipe.branch} constructive repetition count is not byte-maximal`);
  }
  const finalBranch = structuredClone(fullBranchBase);
  replaceAtInstancePath(
    finalBranch,
    recipe.instancePath,
    materializeRepeatedArrayV1(exemplarCanonical.json, repetitions),
    `${recipe.branch} final materialized witness`,
  );
  assertSchemaAccepted(
    branchValidate,
    finalBranch,
    `${recipe.branch} final materialized run length`,
  );
  const finalCanonical = canonicalJsonBytes(finalBranch);
  assertEqual(
    finalCanonical.bytes,
    branchCanonicalBytesAtMost,
    `${recipe.branch} final materialized canonical bytes`,
  );
  const identityContribution = BigInt(repetitions) * delta.identities;
  const workPerRepetition =
    BigInt(ordinaryFormula.identityCoefficient) * delta.identities +
    BigInt(ordinaryFormula.ownKeyCoefficient) * delta.ownKeys +
    BigInt(ordinaryFormula.denseIndexCoefficient) * delta.dense;
  const workContribution = BigInt(repetitions) * workPerRepetition;
  const baseSemanticDigest = domainSemanticDigestV1(
    "provider-registry-evidence-binding-constructive-full-branch-base-v1",
    fullBranchBase,
  );
  const exemplarSemanticDigest = domainSemanticDigestV1(
    "provider-registry-evidence-binding-constructive-exemplar-v1",
    exemplar,
  );
  return {
    branch: recipe.branch,
    path: recipe.path,
    targetInstancePointer: recipe.instancePointer,
    baseByteAllowance: baseCanonical.bytes,
    itemCanonicalBytes: exemplarCanonical.bytes,
    commaBytesPerRepetition: 1,
    deltaIdentities: saturatingNumber(delta.identities, `${recipe.branch} lower delta identities`),
    deltaOwnKeys: saturatingNumber(delta.ownKeys, `${recipe.branch} lower delta own keys`),
    deltaDenseIndices: saturatingNumber(delta.dense, `${recipe.branch} lower delta dense`),
    repetitions,
    branchCanonicalBytesAtMost,
    identityContribution: saturatingNumber(identityContribution, `${recipe.branch} lower identities`),
    workUnitsPerRepetition: saturatingNumber(workPerRepetition, `${recipe.branch} lower work per repetition`),
    workContribution: saturatingNumber(workContribution, `${recipe.branch} lower work`),
    validation: {
      engine: "ajv_draft_2020_12",
      schemaId: branchSchema.$id,
      repeatabilityProfile:
        "homogeneous_items_without_max_unique_contains_or_tuple_keywords",
      fullBranchBaseItemCount: 1,
      repeatProbeAdditionalItems: 2,
      ajvAcceptedFullBranchBase: true,
      ajvAcceptedRepeatProbe: true,
      ajvAcceptedFinalRunLength: true,
      finalMaterializedItemCount: repetitions + 1,
      finalMaterializedCanonicalBytes: finalCanonical.bytes,
      finalMaterializedRawSha256: rawSha256V1(
        Buffer.from(finalCanonical.json, "utf8"),
      ),
      fullBranchBaseCanonicalJson: baseCanonical.json,
      exemplarCanonicalJson: exemplarCanonical.json,
      fullBranchBaseSemanticDigest: baseSemanticDigest,
      exemplarSemanticDigest,
      runLengthWitnessSemanticDigest: domainSemanticDigestV1(
        "provider-registry-evidence-binding-constructive-run-length-witness-v1",
        {
          branch: recipe.branch,
          targetInstancePointer: recipe.instancePointer,
          fullBranchBaseSemanticDigest: baseSemanticDigest,
          exemplarSemanticDigest,
          repetitions,
        },
      ),
      fullBranchBaseTopology: topologyRecord(
        fullBranchBase,
        `${recipe.branch} full-branch base`,
      ),
      exemplarTopology: topologyRecord(
        exemplar,
        `${recipe.branch} exemplar`,
      ),
      repeatabilityAudit: {
        auditedSchemaPath: repeatabilityAudit.auditedSchemaPath,
        exactArrayKeywords: repeatabilityAudit.exactArrayKeywords,
        auditedAncestorCount: repeatabilityAudit.ancestorCount,
      },
      nextRepetitionWouldExceedByteCeiling: true,
    },
  };
}

async function readSchema(packageRoot, name) {
  const resourcePath = `schemas/v1/${name}.schema.json`;
  const bytes = await readFile(join(packageRoot, resourcePath));
  return { bytes, resourcePath, schema: JSON.parse(bytes.toString("utf8")) };
}

async function readSourceTextV1(packageRoot, sourcePath, sourceOverrides) {
  if (CapturedObjectHasOwnV1(sourceOverrides, sourcePath)) {
    return sourceOverrides[sourcePath];
  }
  const absolutePath = resolve(packageRoot, sourcePath);
  if (CapturedObjectHasOwnV1(sourceOverrides, absolutePath)) {
    return sourceOverrides[absolutePath];
  }
  return readFile(absolutePath, "utf8");
}

async function readCompatibleBaseWitnessV1(packageRoot) {
  const compatibleBaseResourcePath =
    "fixtures/v1/golden/provider-registry-evidence-binding-point-v1.json";
  const compatibleBaseBytes = await readFile(
    join(packageRoot, compatibleBaseResourcePath),
  );
  const compatibleBaseResource = JSON.parse(
    compatibleBaseBytes.toString("utf8"),
  );
  if (
    compatibleBaseResource?.profile !==
      "provider_registry_evidence_binding_point_golden_v1" ||
    compatibleBaseResource.compatibleBase === null ||
    typeof compatibleBaseResource.compatibleBase !== "object"
  ) {
    fail("compatible-base witness resource is missing or malformed");
  }
  return {
    compatibleBaseResourcePath,
    compatibleBaseBytes,
    compatibleBase: compatibleBaseResource.compatibleBase,
  };
}

export async function precomputeProviderRegistryEvidenceBindingParserRuntimeTraceTokenV1(
  { packageRoot } = {},
) {
  if (typeof packageRoot !== "string") fail("packageRoot is required");
  packageRoot = resolve(packageRoot);
  const compatibleBaseWitness =
    await readCompatibleBaseWitnessV1(packageRoot);
  const parserRuntimeTrace = await traceProductionParserBindingsV1({
    packageRoot,
    compatibleBase: compatibleBaseWitness.compatibleBase,
  });
  const token = Object.freeze(Object.create(null));
  PRECOMPUTED_PARSER_RUNTIME_TRACE_TOKENS_V1.set(
    token,
    Object.freeze({
      packageRoot,
      compatibleBaseResourceRawSha256: rawSha256V1(
        compatibleBaseWitness.compatibleBaseBytes,
      ),
      parserRuntimeTrace,
    }),
  );
  return token;
}

function consumePrecomputedParserRuntimeTraceTokenV1({
  token,
  packageRoot,
  sourceOverrides,
}) {
  if (token === undefined) return undefined;
  if (CapturedReflectOwnKeysV1(sourceOverrides).length !== 0) {
    fail("precomputed parser runtime trace token context drifted");
  }
  if (
    (typeof token !== "object" || token === null) &&
    typeof token !== "function"
  ) {
    fail("precomputed parser runtime trace token is not module-issued");
  }
  const state = PRECOMPUTED_PARSER_RUNTIME_TRACE_TOKENS_V1.get(token);
  PRECOMPUTED_PARSER_RUNTIME_TRACE_TOKENS_V1.delete(token);
  if (state === undefined) {
    fail(
      "precomputed parser runtime trace token is not module-issued or was already consumed",
    );
  }
  if (state.packageRoot !== packageRoot) {
    fail("precomputed parser runtime trace token context drifted");
  }
  return state;
}

export async function generateProviderRegistryEvidenceBindingTopologyProofV1({
  packageRoot,
  generatedSchemas,
  runtimeModuleRoot,
  sourceOverrides = {},
  precomputedParserRuntimeTraceToken,
} = {}) {
  if (typeof packageRoot !== "string") fail("packageRoot is required");
  packageRoot = resolve(packageRoot);
  sourceOverrides = snapshotParserRuntimeSourceOverridesV1(
    packageRoot,
    sourceOverrides,
  );
  const precomputedParserRuntimeTraceState =
    consumePrecomputedParserRuntimeTraceTokenV1({
      token: precomputedParserRuntimeTraceToken,
      packageRoot,
      sourceOverrides,
    });
  const resolvedRuntimeModuleRoot =
    runtimeModuleRoot ?? join(packageRoot, "dist");
  const uniqueSchemaNames = [
    ...new Set([
      ...Object.values(BRANCH_SCHEMA_NAMES_V1),
      "provider-trust-history-policy",
      "provider-distribution-history-policy",
    ]),
  ];
  const schemaEntries = await Promise.all(
    uniqueSchemaNames.map(async (name) => [name, await readSchema(packageRoot, name)]),
  );
  const schemas = Object.fromEntries(schemaEntries);

  if (generatedSchemas !== undefined) {
    for (const name of uniqueSchemaNames) {
      if (!Object.prototype.hasOwnProperty.call(generatedSchemas, name)) {
        fail(`current Zod schema inventory is missing ${name}`);
      }
      assertEqual(
        generatedSchemas[name],
        schemas[name].schema,
        `current Zod→JSON Schema production ${name}`,
      );
    }
  }

  const pointSource = await readSourceTextV1(
    packageRoot,
    "src/provider-registry-evidence-binding-point.ts",
    sourceOverrides,
  );
  const rawAdmissionSource = await readSourceTextV1(
    packageRoot,
    "src/provider-point-raw-admission-internal.ts",
    sourceOverrides,
  );
  const manifestHistorySource = await readSourceTextV1(
    packageRoot,
    "src/provider-registry-manifest-history.ts",
    sourceOverrides,
  );
  const jsonSchemaSource = await readSourceTextV1(
    packageRoot,
    "src/json-schema.ts",
    sourceOverrides,
  );
  const {
    compatibleBaseResourcePath,
    compatibleBaseBytes,
    compatibleBase,
  } = await readCompatibleBaseWitnessV1(packageRoot);
  if (
    precomputedParserRuntimeTraceState !== undefined &&
    precomputedParserRuntimeTraceState.compatibleBaseResourceRawSha256 !==
      rawSha256V1(compatibleBaseBytes)
  ) {
    fail("precomputed parser runtime trace compatible-base witness drifted");
  }

  const parserSourcePaths = [
    ...new Set(
      JSON_BRANCH_KEYS_V1.map(
        (branch) => PRODUCTION_PARSER_BINDINGS_V1[branch].parserSourcePath,
      ),
    ),
  ];
  const parserSourceEntries = await Promise.all(
    parserSourcePaths.map(async (sourcePath) => {
      const source = await readSourceTextV1(
        packageRoot,
        sourcePath,
        sourceOverrides,
      );
      return [sourcePath, source];
    }),
  );
  const parserSources = Object.fromEntries(parserSourceEntries);
  const parserAstBindings = assertProductionParserAstBindingsV1({
    packageRoot,
    sourceOverrides,
  });
  const accountingAst = assertRawAdmissionAccountingAstV1({
    packageRoot,
    sourceOverrides,
  });
  const parserRuntimeTrace =
    precomputedParserRuntimeTraceState?.parserRuntimeTrace ??
    (await traceProductionParserBindingsV1({
      packageRoot,
      compatibleBase,
      runtimeModuleRoot: resolvedRuntimeModuleRoot,
      sourceOverrides,
    }));
  const accountingRuntimeTrace = await traceRawAdmissionAccountingV1({
    packageRoot,
    runtimeModuleRoot: resolvedRuntimeModuleRoot,
  });
  const productionParserBindings = JSON_BRANCH_KEYS_V1.map((branch) => {
    const binding = PRODUCTION_PARSER_BINDINGS_V1[branch];
    const source = parserSources[binding.parserSourcePath];
    if (typeof source !== "string") {
      fail(`${branch} production parser source is unavailable`);
    }
    const astBinding = parserAstBindings.find((row) => row.branch === branch);
    const runtimeTrace = parserRuntimeTrace.rows.find(
      (row) => row.branch === branch,
    );
    if (astBinding === undefined || runtimeTrace === undefined) {
      fail(`${branch} parser AST/runtime evidence is unavailable`);
    }
    return {
      branch,
      schemaName: BRANCH_SCHEMA_NAMES_V1[branch],
      zodSchemaSymbol: binding.schemaSymbol,
      parserMode: binding.parserMode,
      parserSourcePath: binding.parserSourcePath,
      parserSourceRawSha256: rawSha256V1(Buffer.from(source, "utf8")),
      parserAst: {
        exportedEntry: astBinding.exportedEntry,
        callsiteFunction: astBinding.callsiteFunction,
        callsiteKind: astBinding.callsiteKind,
        argumentAnchor: astBinding.argumentAnchor,
        runtimeSchemaSymbol: astBinding.runtimeSchemaSymbol,
        runtimeSchemaSourcePath: astBinding.runtimeSchemaSourcePath,
        runtimeMethod: astBinding.runtimeMethod,
        runtimeSchemaExportResolved:
          astBinding.runtimeSchemaExportResolved,
        astReachable: astBinding.astReachable,
        astCallsiteLine: astBinding.astCallsiteLine,
        astCallsiteSemanticDigest: astBinding.astCallsiteSemanticDigest,
        astCallChain: astBinding.astCallChain,
      },
      runtimeTrace: {
        requiredMethod: runtimeTrace.requiredMethod,
        parseHits: runtimeTrace.parseHits,
        safeParseHits: runtimeTrace.safeParseHits,
        hitRequiredParser: runtimeTrace.hitRequiredParser,
        schemaMethodHitAuthority: runtimeTrace.schemaMethodHitAuthority,
        exactCallsiteId: runtimeTrace.exactCallsiteId,
        exactCallsiteHits: runtimeTrace.exactCallsiteHits,
        hitExactCallsite: runtimeTrace.hitExactCallsite,
      },
    };
  });
  assertEqual(
    productionParserBindings.map(({ branch }) => branch),
    JSON_BRANCH_KEYS_V1,
    "21-field production parser binding order",
  );
  assertEqual(extractArrayLiteral(pointSource, "POINT_INPUT_KEYS_V1"), POINT_INPUT_KEYS_V1, "22-field point input order");
  assertEqual(extractArrayLiteral(pointSource, "JSON_INPUT_KEYS_V1"), JSON_BRANCH_KEYS_V1, "21-field JSON branch order");
  const pointLimitNames = {
    maxObservedIdentities: "MAX_C09_1L_OBSERVED_IDENTITIES_V1",
    maxPrecloneAllocationWorkUnits:
      "MAX_C09_1L_PRECLONE_ALLOCATION_WORK_UNITS_V1",
    maxRootMetadataHistoryGenerations:
      "MAX_C09_1L_ROOT_METADATA_HISTORY_GENERATIONS_V1",
    maxRegistryManifestHistoryGenerations:
      "MAX_C09_1L_REGISTRY_MANIFEST_HISTORY_GENERATIONS_V1",
    maxTrustEnvelopeRawUnits: "MAX_C09_1L_TRUST_ENVELOPE_RAW_UNITS_V1",
    maxDistributionRawUnits: "MAX_C09_1L_DISTRIBUTION_RAW_UNITS_V1",
    maxRetainedTrustHistoryRawUnits:
      "MAX_C09_1L_RETAINED_TRUST_HISTORY_RAW_UNITS_V1",
    maxRawDepth: "MAX_C09_1L_RAW_DEPTH_V1",
  };
  for (const [proofName, sourceName] of Object.entries(pointLimitNames)) {
    assertEqual(
      extractNumericLiteral(pointSource, sourceName),
      LIMITS_V1[proofName],
      sourceName,
    );
  }
  assertEqual(
    extractNumericLiteral(
      manifestHistorySource,
      "REGISTRY_MANIFEST_JSON_CONTAINER_ENTRY_HARD_CAP_V1",
    ),
    POLICY_CARDINALITY_V1.registryManifestJsonContainerEntryHardCap,
    "Registry JSON container hard cap",
  );
  const fixedWork = extractNumericLiteral(
    rawAdmissionSource,
    "PROVIDER_POINT_RAW_ADMISSION_FIXED_WORK_UNITS_V1",
  );
  const identityWork = extractNumericLiteral(
    rawAdmissionSource,
    "PROVIDER_POINT_RAW_ADMISSION_IDENTITY_WORK_UNITS_V1",
  );
  assertEqual(
    fixedWork,
    accountingAst.fixedSessionWorkUnits,
    "raw admission fixed work",
  );
  assertEqual(
    identityWork,
    accountingAst.identityObservationWorkUnits,
    "raw admission identity work",
  );
  assertEqual(
    accountingRuntimeTrace.topLevel.observedWorkUnits,
    accountingAst.topLevelWorkUnits,
    "raw admission top-level AST/runtime accounting",
  );

  const trustPolicy = schemas["provider-trust-history-policy"].schema;
  const distributionPolicy =
    schemas["provider-distribution-history-policy"].schema;
  const policyObservations = {
    maxProviderVerificationPublicKeyRecordsPerProvider: exactConst(
      trustPolicy,
      "maxProviderVerificationPublicKeyRecordCountPerProvider",
    ),
    maxProviderVerificationPublicKeyRecordsPerUsage: exactConst(
      trustPolicy,
      "maxProviderVerificationPublicKeyRecordCountPerUsage",
    ),
    maxBindingDerivationGenerationRecordsPerProvider: exactConst(
      trustPolicy,
      "maxBindingDerivationGenerationRecordCountPerProvider",
    ),
    maxApproverPublicKeyRecordsPerRole: exactConst(
      trustPolicy,
      "maxApproverPublicKeyRecordCountPerRole",
    ),
    maxCompromisedRevocationRecordsPerIdentity: exactConst(
      trustPolicy,
      "maxCompromisedRevocationRecordCountPerIdentity",
    ),
    maxTotalRetainedDistributionObjectCount: exactConst(
      distributionPolicy,
      "maxTotalRetainedDistributionObjectCount",
    ),
    registryManifestJsonContainerEntryHardCap: extractNumericLiteral(
      manifestHistorySource,
      "REGISTRY_MANIFEST_JSON_CONTAINER_ENTRY_HARD_CAP_V1",
    ),
  };
  assertEqual(policyObservations, POLICY_CARDINALITY_V1, "policy cardinality literals");
  assertEqual(
    exactConst(trustPolicy, "maxRootMetadataGenerationCountPerInstallationIdentity"),
    LIMITS_V1.maxRootMetadataHistoryGenerations,
    "Root history policy literal",
  );
  assertEqual(
    exactConst(trustPolicy, "maxRegistryManifestGenerationCountPerInstallationIdentity"),
    LIMITS_V1.maxRegistryManifestHistoryGenerations,
    "Registry history policy literal",
  );
  assertEqual(
    exactConst(trustPolicy, "maxSingleTrustEnvelopeLogicalBytes"),
    LIMITS_V1.maxTrustEnvelopeRawUnits,
    "single trust Envelope policy literal",
  );
  assertEqual(
    exactConst(
      trustPolicy,
      "maxTotalTrustHistoryLogicalBytesPerInstallationIdentity",
    ),
    LIMITS_V1.maxRetainedTrustHistoryRawUnits,
    "retained trust history policy literal",
  );

  const analyses = {};
  const schemaSources = [];
  for (const branch of JSON_BRANCH_KEYS_V1) {
    const schemaName = BRANCH_SCHEMA_NAMES_V1[branch];
    const entry = schemas[schemaName];
    const branchByteCeiling =
      branch === "bootstrapTrustBundle" ||
      branch === "providerFeasibilityEvidence" ||
      branch === "rootMetadataHistory" ||
      branch === "registryManifestHistory"
        ? LIMITS_V1.maxTrustEnvelopeRawUnits
        : LIMITS_V1.maxDistributionRawUnits;
    const analysis = analyzeJsonSchemaTopologyV1(entry.schema, {
      branch,
      unboundedArrayMaxItems: branchByteCeiling,
    });
    if (analysis.maxDepth > LIMITS_V1.maxRawDepth) {
      fail(
        `${branch} schema depth ${analysis.maxDepth} exceeds ${LIMITS_V1.maxRawDepth}`,
      );
    }
    analyses[branch] = analysis;
    schemaSources.push(
      sourceDescriptor(branch, schemaName, entry.bytes, entry.schema, analysis),
    );
  }

  const ordinaryAccounting = accountingAst.ordinaryFormula;
  const historyAccounting = accountingAst.historyFormula;
  const topLevelWork = BigInt(accountingAst.topLevelWorkUnits);
  const objectiveProfiles = {};
  const pathRelaxations = new Set();
  for (const branch of JSON_BRANCH_KEYS_V1) {
    const schema = schemas[BRANCH_SCHEMA_NAMES_V1[branch]].schema;
    const byteCeiling =
      branch === "bootstrapTrustBundle" ||
      branch === "providerFeasibilityEvidence" ||
      branch === "rootMetadataHistory" ||
      branch === "registryManifestHistory"
        ? LIMITS_V1.maxTrustEnvelopeRawUnits
        : LIMITS_V1.maxDistributionRawUnits;
    const common = {
      branch,
      byteCeiling,
      unboundedArrayMaxItems:
        branch === "registryManifestHistory"
          ? POLICY_CARDINALITY_V1.registryManifestJsonContainerEntryHardCap
          : byteCeiling,
    };
    const identities = analyzeJsonSchemaFiniteObjectiveV1(schema, {
      ...common,
      weights: { identities: 1, ownKeys: 0, dense: 0 },
      label: `${branch}:identities`,
    });
    const ownKeys = analyzeJsonSchemaFiniteObjectiveV1(schema, {
      ...common,
      weights: { identities: 0, ownKeys: 1, dense: 0 },
      label: `${branch}:own_keys`,
    });
    const dense = analyzeJsonSchemaFiniteObjectiveV1(schema, {
      ...common,
      weights: { identities: 0, ownKeys: 0, dense: 1 },
      label: `${branch}:dense_indices`,
    });
    const history =
      branch === "rootMetadataHistory" ||
      branch === "registryManifestHistory";
    const work = analyzeJsonSchemaFiniteObjectiveV1(schema, {
      ...common,
      weights: {
        identities: history
          ? historyAccounting.identityCoefficient
          : ordinaryAccounting.identityCoefficient,
        ownKeys: history
          ? historyAccounting.ownKeyCoefficient
          : ordinaryAccounting.ownKeyCoefficient,
        dense: history
          ? historyAccounting.denseIndexCoefficient
          : ordinaryAccounting.denseIndexCoefficient,
      },
      label: `${branch}:${history ? "history" : "ordinary"}_work_topology`,
    });
    for (const profile of [identities, ownKeys, dense, work]) {
      for (const relaxation of profile.relaxations) {
        pathRelaxations.add(relaxation);
      }
    }
    objectiveProfiles[branch] = {
      byteCeiling,
      identities,
      ownKeys,
      dense,
      work,
    };
  }

  const orderedBounds = [
    orderedObjectiveBound(
      "topLevel",
      1n,
      topLevelWork,
      "64 fixed session units + 4 top-level identity units + 22 exact own-key units + 1 capture scratch unit + 4 retained-history aggregate-budget construction units = 95; identity count = 1.",
    ),
    orderedObjectiveBound(
      "opaqueCapabilityShell",
      0n,
      0n,
      "strictCryptoCapability is identity-checked as the original opaque handle and is neither observed as a JSON identity nor walked; its shell reservation is included in the session's 64 fixed units.",
    ),
  ];
  for (const branch of JSON_BRANCH_KEYS_V1) {
    if (branch === "installationIdentityGenerationId") {
      orderedBounds.push(
        orderedObjectiveBound(
          branch,
          0n,
          0n,
          "The strict production is a string primitive. Its top-level key is already charged, and production allocates no branch budget, JSON identity, own-key array, dense-index reservation, frame, or WeakSet insertion.",
        ),
      );
      continue;
    }
    const profile = objectiveProfiles[branch];
    if (
      branch === "rootMetadataHistory" ||
      branch === "registryManifestHistory"
    ) {
      const length =
        branch === "rootMetadataHistory"
          ? LIMITS_V1.maxRootMetadataHistoryGenerations
          : LIMITS_V1.maxRegistryManifestHistoryGenerations;
      const maximumIdentities =
        1n + BigInt(length) * profile.identities.maximum;
      const maximumWork =
        BigInt(historyAccounting.arrayConstant) +
        BigInt(length) *
          (BigInt(historyAccounting.perEnvelopeConstant) +
            profile.work.maximum);
      orderedBounds.push(
        orderedObjectiveBound(
          branch,
          maximumIdentities,
          maximumWork,
          `L=${length}. Identity and work are independently maximized by the finite-capacity frontier under the per-Envelope B=4,194,304 ceiling. The history array contributes 1 identity and 10+7L work; each Envelope continuation is optimized directly for 7I+K+D, so max-I/max-K/max-D from different witnesses are never added as one work witness. The aggregate B_H correlation is applied only in symbolicWitness.retainedHistories.`,
        ),
      );
      continue;
    }
    orderedBounds.push(
      orderedObjectiveBound(
        branch,
        profile.identities.maximum,
        BigInt(ordinaryAccounting.branchConstant) + profile.work.maximum,
        `The strict production is bounded under B=${profile.byteCeiling} by a BigInt rational finite-capacity frontier. Identity uses objective I; work independently uses objective 6I+K+D and then adds the exact 5-unit branch constant (4 budget construction + 2 root WeakSet insertions - 1 root/descendant algebraic overlap). Array item count, nested finite capacities, comma bytes, union alternatives, and structural maxima are retained by the solver; listed relaxations only enlarge the upper bound.`,
      ),
    );
  }

  const rootProfiles = objectiveProfiles.rootMetadataHistory;
  const registryProfiles = objectiveProfiles.registryManifestHistory;
  const rootCount = LIMITS_V1.maxRootMetadataHistoryGenerations;
  const registryCount = LIMITS_V1.maxRegistryManifestHistoryGenerations;
  const sharedIdentityGroups = [
    {
      count: rootCount,
      profile: rootProfiles.identities,
      extraResource: 0n,
      perEnvelopeByteCeiling: LIMITS_V1.maxTrustEnvelopeRawUnits,
      source: "Root Envelope complete-production frontier × 256",
    },
    {
      count: registryCount,
      profile: registryProfiles.identities,
      extraResource: 0n,
      perEnvelopeByteCeiling: LIMITS_V1.maxTrustEnvelopeRawUnits,
      source: "Registry Envelope complete-production frontier × 4096",
    },
  ];
  const sharedWorkGroups = [
    {
      count: rootCount,
      profile: rootProfiles.work,
      extraResource: BigInt(historyAccounting.perEnvelopeConstant),
      perEnvelopeByteCeiling: LIMITS_V1.maxTrustEnvelopeRawUnits,
      source: "Root Envelope (7 item overhead + 7I+K+D) frontier × 256",
    },
    {
      count: registryCount,
      profile: registryProfiles.work,
      extraResource: BigInt(historyAccounting.perEnvelopeConstant),
      perEnvelopeByteCeiling: LIMITS_V1.maxTrustEnvelopeRawUnits,
      source:
        "Registry Envelope (7 item overhead + 7I+K+D) frontier × 4096",
    },
  ];
  const sharedHistoryIdentities =
    2n +
    boundSharedFiniteObjectiveV1(
      sharedIdentityGroups,
      LIMITS_V1.maxRetainedTrustHistoryRawUnits,
    );
  const sharedHistoryWork =
    2n * BigInt(historyAccounting.arrayConstant) +
    boundSharedFiniteObjectiveV1(
      sharedWorkGroups,
      LIMITS_V1.maxRetainedTrustHistoryRawUnits,
    );

  let totalIdentityUpper = 1n + sharedHistoryIdentities;
  let totalWorkUpper = topLevelWork + sharedHistoryWork;
  for (const branch of JSON_BRANCH_KEYS_V1) {
    if (
      branch === "rootMetadataHistory" ||
      branch === "registryManifestHistory" ||
      branch === "installationIdentityGenerationId"
    ) {
      continue;
    }
    totalIdentityUpper += objectiveProfiles[branch].identities.maximum;
    totalWorkUpper +=
      BigInt(ordinaryAccounting.branchConstant) +
      objectiveProfiles[branch].work.maximum;
  }

  const ordinaryLowerRecipes = [
    {
      branch: "fixtureCorpusManifest",
      path: "$.properties.payload.properties.records",
      schemaPath: ["properties", "payload", "properties", "records"],
      instancePath: ["payload", "records"],
      instancePointer: "/payload/records",
      arraySchema:
        schemas["provider-real-filesystem-fixture-corpus-manifest-envelope"]
          .schema.properties.payload.properties.records,
    },
    {
      branch: "publicSupportTaxonomy",
      path: "$.properties.payload.properties.filesystemProfiles",
      schemaPath: [
        "properties",
        "payload",
        "properties",
        "filesystemProfiles",
      ],
      instancePath: ["payload", "filesystemProfiles"],
      instancePointer: "/payload/filesystemProfiles",
      arraySchema:
        schemas["provider-public-support-taxonomy-envelope"].schema.properties
          .payload.properties.filesystemProfiles,
    },
    {
      branch: "realFilesystemConformanceResult",
      path: "$.properties.payload.properties.caseResults",
      schemaPath: ["properties", "payload", "properties", "caseResults"],
      instancePath: ["payload", "caseResults"],
      instancePointer: "/payload/caseResults",
      arraySchema:
        schemas["provider-real-filesystem-conformance-result-envelope"].schema
          .properties.payload.properties.caseResults,
    },
    {
      branch: "suiteManifest",
      path: "$.properties.payload.properties.cases.items.properties.requiredCrashCuts",
      schemaPath: [
        "properties",
        "payload",
        "properties",
        "cases",
        "items",
        "properties",
        "requiredCrashCuts",
      ],
      instancePath: ["payload", "cases", 0, "requiredCrashCuts"],
      instancePointer: "/payload/cases/0/requiredCrashCuts",
      arraySchema:
        schemas["provider-real-filesystem-suite-manifest-envelope"].schema
          .properties.payload.properties.cases.items.properties
          .requiredCrashCuts,
    },
    {
      branch: "targetDiscoveryFixtureManifest",
      path: "$.properties.payload.properties.records",
      schemaPath: ["properties", "payload", "properties", "records"],
      instancePath: ["payload", "records"],
      instancePointer: "/payload/records",
      arraySchema:
        schemas["provider-target-discovery-fixture-manifest-envelope"].schema
          .properties.payload.properties.records,
    },
    {
      branch: "targetDiscoveryResult",
      path: "$.properties.payload.properties.targetDiscoveryInputBundle.properties.observations",
      schemaPath: [
        "properties",
        "payload",
        "properties",
        "targetDiscoveryInputBundle",
        "properties",
        "observations",
      ],
      instancePath: [
        "payload",
        "targetDiscoveryInputBundle",
        "observations",
      ],
      instancePointer:
        "/payload/targetDiscoveryInputBundle/observations",
      arraySchema:
        schemas["provider-target-discovery-result-envelope"].schema.properties
          .payload.properties.targetDiscoveryInputBundle.properties.observations,
    },
    {
      branch: "targetDiscoveryRunnerRun",
      path: "$.properties.payload.properties.records",
      schemaPath: ["properties", "payload", "properties", "records"],
      instancePath: ["payload", "records"],
      instancePointer: "/payload/records",
      arraySchema:
        schemas["provider-target-discovery-runner-run-envelope"].schema
          .properties.payload.properties.records,
    },
  ];
  const validatorFor = createWitnessValidatorFactory();
  const constructiveOrdinaryRows = ordinaryLowerRecipes.map((recipe) =>
    buildOrdinaryConstructiveRowV1({
      recipe,
      branchSchema: schemas[BRANCH_SCHEMA_NAMES_V1[recipe.branch]].schema,
      compatibleBase,
      validatorFor,
      ordinaryFormula: ordinaryAccounting,
    }),
  );
  const ordinaryLowerIdentities = constructiveOrdinaryRows.reduce(
    (total, row) => total + BigInt(row.identityContribution),
    0n,
  );
  const ordinaryLowerWork = constructiveOrdinaryRows.reduce(
    (total, row) => total + BigInt(row.workContribution),
    0n,
  );

  const registrySchema = schemas["provider-registry-manifest-envelope"].schema;
  const rootEnvelopeSchema =
    schemas["provider-registry-root-metadata-envelope"].schema;
  const registryMembersSchema =
    registrySchema.properties.payload.anyOf[0].properties.members;
  const registryRepeatabilityAudit = assertRepeatableArraySchemaPathV1(
    registrySchema,
    [
      "properties",
      "payload",
      "anyOf",
      0,
      "properties",
      "members",
    ],
    "registryManifestHistory revoked members",
  );
  assertEqual(
    registryRepeatabilityAudit.arraySchema,
    registryMembersSchema,
    "registryManifestHistory audited members array",
  );
  const revokedMemberSchema =
    registryMembersSchema.items.oneOf[1];
  const sourceRegistryEnvelope = compatibleBase.registryManifestHistory?.find(
    (envelope) =>
      envelope?.payload?.members?.some(
        (member) => member?.disposition === "revoked",
      ),
  );
  const sourceRootEnvelope = compatibleBase.rootMetadataHistory?.[0];
  if (sourceRegistryEnvelope === undefined || sourceRootEnvelope === undefined) {
    fail("compatible-base history does not contain Root and revoked-member exemplars");
  }
  const sourceRevokedMember = sourceRegistryEnvelope.payload.members.find(
    (member) => member.disposition === "revoked",
  );
  const revokedMember = minimizeWitnessValueV1(
    revokedMemberSchema,
    sourceRevokedMember,
    validatorFor,
    "registryManifestHistory:revokedMember",
  );
  const registryEnvelopeBase = structuredClone(sourceRegistryEnvelope);
  registryEnvelopeBase.payload.members.splice(
    0,
    registryEnvelopeBase.payload.members.length,
    structuredClone(revokedMember),
  );
  const rootEnvelopeBase = structuredClone(sourceRootEnvelope);
  const registryValidate = validatorFor(registrySchema);
  const rootValidate = validatorFor(rootEnvelopeSchema);
  const revokedValidate = validatorFor(revokedMemberSchema);
  assertSchemaAccepted(
    revokedValidate,
    revokedMember,
    "Registry revoked-member exemplar",
  );
  assertSchemaAccepted(
    registryValidate,
    registryEnvelopeBase,
    "Registry full-envelope constructive base",
  );
  assertSchemaAccepted(
    rootValidate,
    rootEnvelopeBase,
    "Root full-envelope constructive base",
  );
  const revokedMemberCanonical = canonicalJsonBytes(revokedMember);
  const registryEnvelopeBaseCanonical = canonicalJsonBytes(registryEnvelopeBase);
  const rootEnvelopeBaseCanonical = canonicalJsonBytes(rootEnvelopeBase);
  const revokedMemberTopology = measureJsonTopologyV1(revokedMember);
  const revokedMemberDelta = addVector(
    revokedMemberTopology,
    vector(0n, 1n, 1n),
  );
  const revokedMemberDeltaBytes = revokedMemberCanonical.bytes + 1;
  const constructiveRegistryMemberCount = 500_000;
  const maxAdditionalMembersPerEnvelope = Math.ceil(
    constructiveRegistryMemberCount / registryCount,
  );
  const registryEnvelopeBaseByteAllowance =
    registryEnvelopeBaseCanonical.bytes;
  const rootEnvelopeBaseByteAllowance = rootEnvelopeBaseCanonical.bytes;
  const maxRegistryEnvelopeCanonicalBytes =
    registryEnvelopeBaseByteAllowance +
    maxAdditionalMembersPerEnvelope * revokedMemberDeltaBytes;
  const historyArraySyntaxBytes =
    2 + Math.max(0, rootCount - 1) +
    2 + Math.max(0, registryCount - 1);
  const constructiveSharedHistoryCanonicalBytes =
    rootCount * rootEnvelopeBaseByteAllowance +
    registryCount * registryEnvelopeBaseByteAllowance +
    constructiveRegistryMemberCount * revokedMemberDeltaBytes;
  if (
    1 + maxAdditionalMembersPerEnvelope >
      POLICY_CARDINALITY_V1.registryManifestJsonContainerEntryHardCap ||
    maxRegistryEnvelopeCanonicalBytes >
      LIMITS_V1.maxTrustEnvelopeRawUnits ||
    constructiveSharedHistoryCanonicalBytes >
      LIMITS_V1.maxRetainedTrustHistoryRawUnits
  ) {
    fail("constructive Registry lower-bound recipe no longer fits its frozen capacities");
  }
  const maximumRegistryEnvelopeProbe = structuredClone(registryEnvelopeBase);
  for (let index = 0; index < maxAdditionalMembersPerEnvelope; index += 1) {
    maximumRegistryEnvelopeProbe.payload.members.push(
      structuredClone(revokedMember),
    );
  }
  assertSchemaAccepted(
    registryValidate,
    maximumRegistryEnvelopeProbe,
    "Registry maximum additional-member repeat probe",
  );
  const maximumRegistryEnvelopeProbeCanonical = canonicalJsonBytes(
    maximumRegistryEnvelopeProbe,
  );
  assertEqual(
    maximumRegistryEnvelopeProbeCanonical.bytes,
    maxRegistryEnvelopeCanonicalBytes,
    "Registry repeat-probe canonical bytes",
  );
  const registryBaseTopology = measureJsonTopologyV1(registryEnvelopeBase);
  const registryProbeTopology = measureJsonTopologyV1(
    maximumRegistryEnvelopeProbe,
  );
  assertVectorEqual(
    vector(
      registryProbeTopology.identities - registryBaseTopology.identities,
      registryProbeTopology.ownKeys - registryBaseTopology.ownKeys,
      registryProbeTopology.dense - registryBaseTopology.dense,
    ),
    multiplyVector(
      revokedMemberDelta,
      BigInt(maxAdditionalMembersPerEnvelope),
    ),
    "Registry repeat-probe topology delta",
  );
  const highProfileEnvelopeCount =
    constructiveRegistryMemberCount % registryCount;
  const lowAdditionalMembersPerEnvelope = Math.floor(
    constructiveRegistryMemberCount / registryCount,
  );
  const materializedEnvelopeProfiles = [
    ...(highProfileEnvelopeCount === 0
      ? []
      : [
          {
            additionalItems: maxAdditionalMembersPerEnvelope,
            envelopeCount: highProfileEnvelopeCount,
          },
        ]),
    ...(highProfileEnvelopeCount === registryCount
      ? []
      : [
          {
            additionalItems: lowAdditionalMembersPerEnvelope,
            envelopeCount: registryCount - highProfileEnvelopeCount,
          },
        ]),
  ].map(({ additionalItems, envelopeCount }) => {
    const candidate = structuredClone(registryEnvelopeBase);
    candidate.payload.members = materializeRepeatedArrayV1(
      revokedMemberCanonical.json,
      additionalItems,
    );
    assertSchemaAccepted(
      registryValidate,
      candidate,
      `Registry final materialized ${additionalItems}-additional-member profile`,
    );
    const canonical = canonicalJsonBytes(candidate);
    assertEqual(
      canonical.bytes,
      registryEnvelopeBaseByteAllowance +
        additionalItems * revokedMemberDeltaBytes,
      `Registry final ${additionalItems}-additional-member canonical bytes`,
    );
    return {
      additionalItems,
      envelopeCount,
      materializedMemberCount: additionalItems + 1,
      canonicalBytes: canonical.bytes,
      rawSha256: rawSha256V1(Buffer.from(canonical.json, "utf8")),
      ajvAccepted: true,
    };
  });
  assertEqual(
    materializedEnvelopeProfiles.reduce(
      (total, profile) =>
        total + profile.envelopeCount * profile.additionalItems,
      0,
    ),
    constructiveRegistryMemberCount,
    "Registry final materialized additional-member count",
  );
  assertEqual(
    materializedEnvelopeProfiles.reduce(
      (total, profile) => total + profile.envelopeCount,
      0,
    ),
    registryCount,
    "Registry final materialized Envelope count",
  );
  const rootBaseSemanticDigest = domainSemanticDigestV1(
    "provider-registry-evidence-binding-constructive-root-envelope-base-v1",
    rootEnvelopeBase,
  );
  const registryBaseSemanticDigest = domainSemanticDigestV1(
    "provider-registry-evidence-binding-constructive-registry-envelope-base-v1",
    registryEnvelopeBase,
  );
  const revokedMemberSemanticDigest = domainSemanticDigestV1(
    "provider-registry-evidence-binding-constructive-revoked-member-v1",
    revokedMember,
  );
  const registryHistoryValidation = {
    engine: "ajv_draft_2020_12",
    rootSchemaId: rootEnvelopeSchema.$id,
    registrySchemaId: registrySchema.$id,
    repeatabilityProfile:
      "homogeneous_items_without_max_unique_contains_or_tuple_keywords",
    rootEnvelopeBaseCanonicalJson: rootEnvelopeBaseCanonical.json,
    registryEnvelopeBaseCanonicalJson: registryEnvelopeBaseCanonical.json,
    exemplarCanonicalJson: revokedMemberCanonical.json,
    rootEnvelopeBaseSemanticDigest: rootBaseSemanticDigest,
    registryEnvelopeBaseSemanticDigest: registryBaseSemanticDigest,
    exemplarSemanticDigest: revokedMemberSemanticDigest,
    runLengthWitnessSemanticDigest: domainSemanticDigestV1(
      "provider-registry-evidence-binding-constructive-history-run-length-witness-v1",
      {
        rootEnvelopeBaseSemanticDigest: rootBaseSemanticDigest,
        registryEnvelopeBaseSemanticDigest: registryBaseSemanticDigest,
        exemplarSemanticDigest: revokedMemberSemanticDigest,
        rootCount,
        registryCount,
        constructiveRegistryMemberCount,
      },
    ),
    rootEnvelopeBaseTopology: topologyRecord(
      rootEnvelopeBase,
      "Root full-envelope base",
    ),
    registryEnvelopeBaseTopology: topologyRecord(
      registryEnvelopeBase,
      "Registry full-envelope base",
    ),
    exemplarTopology: topologyRecord(
      revokedMember,
      "Registry revoked-member exemplar",
    ),
    baselineMemberCountPerRegistryEnvelope: 1,
    ajvAcceptedRootEnvelopeBase: true,
    ajvAcceptedRegistryEnvelopeBase: true,
    ajvAcceptedMaximumRepeatProbe: true,
    maximumRepeatProbeAdditionalItems: maxAdditionalMembersPerEnvelope,
    ajvAcceptedFinalRunLength: true,
    finalMaterializedEnvelopeProfiles: materializedEnvelopeProfiles,
    repeatabilityAudit: {
      auditedSchemaPath: registryRepeatabilityAudit.auditedSchemaPath,
      exactArrayKeywords: registryRepeatabilityAudit.exactArrayKeywords,
      auditedAncestorCount: registryRepeatabilityAudit.ancestorCount,
    },
  };
  const historyLowerIdentities =
    BigInt(constructiveRegistryMemberCount) *
    revokedMemberDelta.identities;
  const historyWorkPerMember =
    BigInt(historyAccounting.identityCoefficient) *
      revokedMemberDelta.identities +
    BigInt(historyAccounting.ownKeyCoefficient) * revokedMemberDelta.ownKeys +
    BigInt(historyAccounting.denseIndexCoefficient) * revokedMemberDelta.dense;
  const historyLowerWork =
    BigInt(constructiveRegistryMemberCount) * historyWorkPerMember;
  const constructiveLowerIdentities =
    ordinaryLowerIdentities + historyLowerIdentities;
  const constructiveLowerWork = ordinaryLowerWork + historyLowerWork;
  const identityUpperNumber = saturatingNumber(
    totalIdentityUpper,
    "sound identity upper",
  );
  const workUpperNumber = saturatingNumber(
    totalWorkUpper,
    "sound work upper",
  );
  const recommendedIdentityCap = leastPowerOfTwoAtLeast(
    totalIdentityUpper,
    "recommended identity binary cap",
  );
  const recommendedWorkCap = leastPowerOfTwoAtLeast(
    totalWorkUpper,
    "recommended work binary cap",
  );
  const identityLowerNumber = saturatingNumber(
    constructiveLowerIdentities,
    "constructive identity lower",
  );
  const workLowerNumber = saturatingNumber(
    constructiveLowerWork,
    "constructive work lower",
  );
  if (
    totalIdentityUpper < constructiveLowerIdentities ||
    totalWorkUpper < constructiveLowerWork
  ) {
    fail("finite-capacity upper fell below the constructive lower witness");
  }
  const priorCapFailures = [
    {
      metric: "observed_identities",
      cap: PRIOR_FROZEN_CAPS_V1.maxObservedIdentities,
      soundUpper: identityUpperNumber,
      provenAtLeast: identityLowerNumber,
      exceedsByAtLeast:
        identityLowerNumber - PRIOR_FROZEN_CAPS_V1.maxObservedIdentities,
    },
    {
      metric: "preclone_allocation_work_units",
      cap: PRIOR_FROZEN_CAPS_V1.maxPrecloneAllocationWorkUnits,
      soundUpper: workUpperNumber,
      provenAtLeast: workLowerNumber,
      exceedsByAtLeast:
        workLowerNumber -
        PRIOR_FROZEN_CAPS_V1.maxPrecloneAllocationWorkUnits,
    },
  ].filter((failure) => failure.exceedsByAtLeast > 0);
  const adoptedCapFailures = [
    {
      metric: "observed_identities",
      cap: LIMITS_V1.maxObservedIdentities,
      soundUpper: identityUpperNumber,
      exceedsBy: identityUpperNumber - LIMITS_V1.maxObservedIdentities,
    },
    {
      metric: "preclone_allocation_work_units",
      cap: LIMITS_V1.maxPrecloneAllocationWorkUnits,
      soundUpper: workUpperNumber,
      exceedsBy:
        workUpperNumber - LIMITS_V1.maxPrecloneAllocationWorkUnits,
    },
  ].filter((failure) => failure.exceedsBy > 0);
  if (
    priorCapFailures.length === 0 ||
    !priorCapFailures.some(
      ({ metric }) => metric === "preclone_allocation_work_units",
    )
  ) {
    fail("the prior D-37 cap-reopen witness unexpectedly disappeared");
  }
  if (adoptedCapFailures.length !== 0) {
    fail(
      `the adopted binary caps do not cover the sound finite-capacity upper ${identityUpperNumber}/${workUpperNumber}: ${canonicalJsonV1(adoptedCapFailures)}`,
    );
  }
  if (
    recommendedIdentityCap !== LIMITS_V1.maxObservedIdentities ||
    recommendedWorkCap !== LIMITS_V1.maxPrecloneAllocationWorkUnits
  ) {
    fail("the adopted caps drifted from the least covering binary caps");
  }

  const proofWithoutDigest = {
    schemaVersion: 1,
    recordType: "provider_registry_evidence_binding_topology_proof",
    profile: TOPOLOGY_PROOF_PROFILE_V1,
    status: "accepted_after_contract_reopen",
    contractReopenRequired: false,
    priorContractReopenRequired: true,
    inputKeys: POINT_INPUT_KEYS_V1,
    jsonBranchKeys: JSON_BRANCH_KEYS_V1,
    opaqueField: "strictCryptoCapability",
    limits: LIMITS_V1,
    policyCardinality: POLICY_CARDINALITY_V1,
    sourceAnchors: {
      pointAdmissionContractSemanticDigest: semanticDigestV1({
        inputKeys: POINT_INPUT_KEYS_V1,
        jsonBranchKeys: JSON_BRANCH_KEYS_V1,
        limits: LIMITS_V1,
      }),
      pointImplementationRawSha256: rawSha256V1(
        Buffer.from(pointSource, "utf8"),
      ),
      rawAdmissionImplementationSha256: rawSha256V1(
        Buffer.from(rawAdmissionSource, "utf8"),
      ),
      jsonSchemaGeneratorSourceRawSha256: rawSha256V1(
        Buffer.from(jsonSchemaSource, "utf8"),
      ),
      compatibleBaseResourcePath,
      compatibleBaseResourceRawSha256: rawSha256V1(compatibleBaseBytes),
      productionParserBindingSemanticDigest: semanticDigestV1(
        productionParserBindings,
      ),
      productionParserRuntimeTraceProfile: parserRuntimeTrace.profile,
      productionParserRuntimeTraceInstrumentation:
        parserRuntimeTrace.instrumentation,
      productionParserRuntimeTraceEntryExport:
        parserRuntimeTrace.entryExport,
      productionParserRuntimeTraceSemanticDigest:
        parserRuntimeTrace.semanticDigest,
      productionParserRuntimeTraceSummary: {
        uninstrumentedFreshEmitCompatibleBaseAccepted:
          parserRuntimeTrace.uninstrumentedFreshEmitCompatibleBaseAccepted,
        instrumentedFreshEmitCompatibleBaseAccepted:
          parserRuntimeTrace.instrumentedFreshEmitCompatibleBaseAccepted,
        successProjectionFieldCount:
          parserRuntimeTrace.successProjectionFieldCount,
        successProjectionsEquivalent:
          parserRuntimeTrace.successProjectionsEquivalent,
        successProjectionSemanticDigest:
          parserRuntimeTrace.successProjectionSemanticDigest,
        uninstrumentedCryptoClosure:
          parserRuntimeTrace.uninstrumentedCryptoClosure,
        instrumentedCryptoClosure:
          parserRuntimeTrace.instrumentedCryptoClosure,
        exactAstBindingCount: parserRuntimeTrace.exactAstBindingCount,
        schemaTableConsumerCount:
          parserRuntimeTrace.schemaTableConsumerCount,
        hookLifecycle: parserRuntimeTrace.hookLifecycle,
      },
      manifestContainerHardCap:
        POLICY_CARDINALITY_V1.registryManifestJsonContainerEntryHardCap,
      trustPolicyRawSha256: rawSha256V1(
        schemas["provider-trust-history-policy"].bytes,
      ),
      trustPolicySemanticDigest: semanticDigestV1(trustPolicy),
      distributionPolicyRawSha256: rawSha256V1(
        schemas["provider-distribution-history-policy"].bytes,
      ),
      distributionPolicySemanticDigest: semanticDigestV1(distributionPolicy),
      accountingModel: {
        fixedSessionWorkUnits: fixedWork,
        identityWorkUnits: identityWork,
        topLevelWorkUnits: accountingAst.topLevelWorkUnits,
        ...accountingAst.primitiveCharges,
        ordinaryFormula: accountingAst.ordinaryFormula,
        historyFormula: accountingAst.historyFormula,
        freshAstControlFlow: {
          profile: accountingAst.profile,
          entryExport: accountingAst.entryExport,
          relevantFunctionCount: accountingAst.relevantFunctionCount,
          mutableTestSeamsExcludedFromAccountingAuthority:
            accountingAst.mutableTestSeamsExcludedFromAccountingAuthority,
          semanticDigest: accountingAst.controlFlowAstSemanticDigest,
        },
        runtimeDifferential: accountingRuntimeTrace,
      },
    },
    productionParserBindings,
    schemaSources,
    solver: {
      profile: "finite_capacity_frontier_v1",
      arithmetic: "bigint_rational",
      objectives: ["identities", "ordinary_work", "history_work"],
      relaxations: [
        {
          kind: "fractional_last_atom",
          detail:
            "The last capacity segment may be fractionally occupied. Integer productions are a subset, so this only enlarges the upper bound.",
        },
        {
          kind: "one_of_as_alternative_upper",
          detail:
            "Union base cases are retained, while mutually exclusive finite segment capacities may be combined before the alternative structural maximum clamps the objective.",
        },
        {
          kind: "nested_prerequisite_dropped",
          detail:
            "Required nested segments retain their finite gain caps; optional and repeated children are collapsed into complete-production ratios, but segment prerequisites across relaxed union alternatives are not reimposed.",
        },
        {
          kind: "cross_branch_semantic_and_crypto_equalities_not_modeled",
          detail:
            "The requested proof domain is the strict Zod→JSON Schema production plus frozen byte/cardinality policies. Later cross-branch digest, signature, exact-cover, and history semantics are intentionally not used to shrink this schema upper.",
        },
      ],
      pathRelaxations: [...pathRelaxations].sort(),
    },
    orderedBounds,
    symbolicWitness: {
      kind: "sound_finite_capacity_upper_witness",
      ordinaryBranches: JSON_BRANCH_KEYS_V1.filter(
        (branch) =>
          branch !== "rootMetadataHistory" &&
          branch !== "registryManifestHistory",
      ).map((branch) => ({
        branch,
        maxIdentities: saturatingNumber(
          objectiveProfiles[branch].identities.maximum,
          `${branch} witness identities`,
        ),
        maxOwnKeys: saturatingNumber(
          objectiveProfiles[branch].ownKeys.maximum,
          `${branch} witness own keys`,
        ),
        maxDenseIndices: saturatingNumber(
          objectiveProfiles[branch].dense.maximum,
          `${branch} witness dense indices`,
        ),
        maxWorkTopologyObjective: saturatingNumber(
          objectiveProfiles[branch].work.maximum,
          `${branch} witness work objective`,
        ),
        objectiveWitnessesAreIndependent: true,
      })),
      retainedHistories: {
        rootEnvelopeCount: rootCount,
        registryEnvelopeCount: registryCount,
        sharedRawUnits: LIMITS_V1.maxRetainedTrustHistoryRawUnits,
        maxIdentities: saturatingNumber(
          sharedHistoryIdentities,
          "shared history identities",
        ),
        maxWorkUnits: saturatingNumber(
          sharedHistoryWork,
          "shared history work",
        ),
        derivation:
          "Root<=256 and Registry<=4096 complete-Envelope groups are first bounded by the per-Envelope B=4,194,304 frontier, then jointly optimized under the full B_H=268,435,456 retained-Envelope canonical-byte policy. Outer history-array syntax is not charged by that production policy; the two raw history arrays are instead accounted exactly as 2 identities and 20 work units. Identity and exact history-work objective 7I+K+D+7-per-Envelope are optimized independently.",
      },
      totalMaxIdentities: identityUpperNumber,
      totalMaxWorkUnits: workUpperNumber,
      totalDerivation:
        "Top-level + every ordinary branch's independently optimized I or 6I+K+D objective + the joint retained-history frontier. The work result never adds componentwise maxima from different witnesses. All exact constants include the session-owned 4-unit budget construction and every production WeakSet insertion.",
    },
    capAssessment: {
      priorFrozenCaps: PRIOR_FROZEN_CAPS_V1,
      adoptedCaps: {
        maxObservedIdentities: LIMITS_V1.maxObservedIdentities,
        maxPrecloneAllocationWorkUnits:
          LIMITS_V1.maxPrecloneAllocationWorkUnits,
      },
      soundUpperBounds: {
        maxObservedIdentities: identityUpperNumber,
        maxPrecloneAllocationWorkUnits: workUpperNumber,
      },
      adoptedAssessment: {
        withinSoundUpper: true,
        observedIdentityHeadroom:
          LIMITS_V1.maxObservedIdentities - identityUpperNumber,
        precloneAllocationWorkUnitHeadroom:
          LIMITS_V1.maxPrecloneAllocationWorkUnits - workUpperNumber,
      },
      recommendedBinaryCaps: {
        rule: "least_power_of_two_not_less_than_sound_upper",
        maxObservedIdentities: recommendedIdentityCap,
        maxPrecloneAllocationWorkUnits: recommendedWorkCap,
        observedIdentityHeadroom:
          recommendedIdentityCap - identityUpperNumber,
        precloneAllocationWorkUnitHeadroom:
          recommendedWorkCap - workUpperNumber,
      },
      constructiveLowerBound: {
        basis: "strict_zod_json_schema_production_only",
        doesNotClaimCrossBranchSemanticOrCryptoAcceptance: true,
        ordinaryRows: constructiveOrdinaryRows,
        registryHistoryRow: {
          branch: "registryManifestHistory",
          path:
            "$.properties.payload.anyOf[0].properties.members.items.oneOf[1]",
          variant: "revoked_member",
          rootEnvelopeCount: rootCount,
          registryEnvelopeCount: registryCount,
          registryEnvelopeBaseByteAllowance,
          rootEnvelopeBaseByteAllowance,
          itemCanonicalBytes: revokedMemberCanonical.bytes,
          commaBytesPerRepetition: 1,
          deltaIdentities: saturatingNumber(
            revokedMemberDelta.identities,
            "revoked member delta identities",
          ),
          deltaOwnKeys: saturatingNumber(
            revokedMemberDelta.ownKeys,
            "revoked member delta own keys",
          ),
          deltaDenseIndices: saturatingNumber(
            revokedMemberDelta.dense,
            "revoked member delta dense",
          ),
          repetitions: constructiveRegistryMemberCount,
          maxAdditionalMembersPerEnvelope,
          maxRegistryEnvelopeCanonicalBytes,
          outerHistoryArrayCanonicalSyntaxBytesExcludedFromPolicy:
            historyArraySyntaxBytes,
          sharedHistoryCanonicalBytesAtMost:
            constructiveSharedHistoryCanonicalBytes,
          identityContribution: saturatingNumber(
            historyLowerIdentities,
            "history lower identities",
          ),
          workUnitsPerRepetition: saturatingNumber(
            historyWorkPerMember,
            "history lower work per repetition",
          ),
          workContribution: saturatingNumber(
            historyLowerWork,
            "history lower work",
          ),
          validation: registryHistoryValidation,
        },
        provenAtLeastObservedIdentities: identityLowerNumber,
        provenAtLeastPrecloneAllocationWorkUnits: workLowerNumber,
        derivation:
          "Expansion-only lower: seven ordinary arrays use Ajv-accepted full-branch bases plus Ajv-accepted minimized exemplars under a schema-keyword repeatability induction and integer floor repetitions. 500,000 Ajv-accepted revoked-member expansions are distributed 122/123 per Registry Envelope. Exact base/top-level/history-container resources are deliberately omitted, so the result remains a lower bound.",
      },
      priorFailures: priorCapFailures,
      adoptedFailures: adoptedCapFailures,
    },
    semanticDomain: TOPOLOGY_PROOF_SEMANTIC_DOMAIN_V1,
  };
  return {
    ...proofWithoutDigest,
    aggregateSemanticDigest: domainSemanticDigestV1(
      TOPOLOGY_PROOF_SEMANTIC_DOMAIN_V1,
      proofWithoutDigest,
    ),
  };
}

export function serializeTopologyProofV1(proof) {
  return `${JSON.stringify(proof, null, 2)}\n`;
}
