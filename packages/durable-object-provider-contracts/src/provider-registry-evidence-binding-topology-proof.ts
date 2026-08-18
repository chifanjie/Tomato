import { z } from "./zod-runtime.js";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import { ContentDigestV1Schema } from "./primitives.js";
import { sha256InternalV1 } from "./sha256.js";

export const PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_PROFILE_V1 =
  "provider_registry_evidence_binding_topology_proof_v1" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_SEMANTIC_DOMAIN_V1 =
  "provider-registry-evidence-binding-topology-proof-v1" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_RESOURCE_PATH_V1 =
  "fixtures/v1/golden/provider-registry-evidence-binding-topology-proof-v1.json" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_RESOURCE_BYTE_LENGTH_V1 =
  182_222 as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_RESOURCE_SHA256_HEX_V1 =
  "c0be3ef046020b926b9cc9e08b6cd420a979b7b01e1b54e6a46c5200b86e7c93" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_AGGREGATE_SEMANTIC_DIGEST_V1 =
  "sha256:6ddacc662900715a5836aaa0e15a15a03a72ba1650574220299fe9fad8cb3f89" as const;
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_MAX_BYTES_V1 =
  1_048_576 as const;

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectValuesV1 = Object.values;

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
const NonemptyStringV1Schema = z.string().min(1);
const ExactParserAstCallsiteIdV1Schema = z
  .string()
  .regex(/^exact_ast_callsite_v1:[a-zA-Z][a-zA-Z0-9]*:sha256:[0-9a-f]{64}$/u);

const InputKeysV1Schema = z.tuple([
  z.literal("activeRoot"),
  z.literal("activeRootMetadata"),
  z.literal("bootstrapTrustBundle"),
  z.literal("distributionRootBinding"),
  z.literal("fixtureCorpusManifest"),
  z.literal("installationIdentityGenerationId"),
  z.literal("providerFeasibilityEvidence"),
  z.literal("providerFeasibilityEvidencePin"),
  z.literal("publicSupportTaxonomy"),
  z.literal("realFilesystemConformanceResult"),
  z.literal("realFilesystemConformanceResultLocator"),
  z.literal("realFilesystemConformanceResultPin"),
  z.literal("registryManifestHistory"),
  z.literal("releaseMatrix"),
  z.literal("rootMetadataHistory"),
  z.literal("runtimeAttestation"),
  z.literal("semanticProviderPolicy"),
  z.literal("strictCryptoCapability"),
  z.literal("suiteManifest"),
  z.literal("targetDiscoveryFixtureManifest"),
  z.literal("targetDiscoveryResult"),
  z.literal("targetDiscoveryRunnerRun"),
]);

const JsonBranchKeysV1Schema = z.tuple([
  z.literal("activeRoot"),
  z.literal("activeRootMetadata"),
  z.literal("bootstrapTrustBundle"),
  z.literal("distributionRootBinding"),
  z.literal("fixtureCorpusManifest"),
  z.literal("installationIdentityGenerationId"),
  z.literal("providerFeasibilityEvidence"),
  z.literal("providerFeasibilityEvidencePin"),
  z.literal("publicSupportTaxonomy"),
  z.literal("realFilesystemConformanceResult"),
  z.literal("realFilesystemConformanceResultLocator"),
  z.literal("realFilesystemConformanceResultPin"),
  z.literal("registryManifestHistory"),
  z.literal("releaseMatrix"),
  z.literal("rootMetadataHistory"),
  z.literal("runtimeAttestation"),
  z.literal("semanticProviderPolicy"),
  z.literal("suiteManifest"),
  z.literal("targetDiscoveryFixtureManifest"),
  z.literal("targetDiscoveryResult"),
  z.literal("targetDiscoveryRunnerRun"),
]);

const UnboundedArrayOverrideV1Schema = z.strictObject({
  path: NonemptyStringV1Schema,
  maxItems: PositiveSafeIntegerV1Schema,
  source: NonemptyStringV1Schema,
});

const SchemaSourceTraversalV1Schema = z.strictObject({
  refsResolved: NonnegativeSafeIntegerV1Schema,
  unionsVisited: NonnegativeSafeIntegerV1Schema,
  unboundedArrayOverrides: z.array(UnboundedArrayOverrideV1Schema),
});

function schemaSourceV1(
  branch: string,
  schemaName: string,
) {
  return z.strictObject({
    branch: z.literal(branch),
    schemaName: z.literal(schemaName),
    schemaId: z.literal(
      `urn:understand-code:provider-contract:schema:v1:${schemaName}`,
    ),
    rawSha256: ContentDigestV1Schema,
    semanticDigest: ContentDigestV1Schema,
    traversal: SchemaSourceTraversalV1Schema,
  });
}

const SchemaSourcesV1Schema = z.tuple([
  schemaSourceV1("activeRoot", "provider-registry-root-public-key"),
  schemaSourceV1("activeRootMetadata", "provider-registry-root-metadata-pin"),
  schemaSourceV1("bootstrapTrustBundle", "provider-bootstrap-trust-bundle"),
  schemaSourceV1(
    "distributionRootBinding",
    "provider-signed-distribution-root-binding",
  ),
  schemaSourceV1(
    "fixtureCorpusManifest",
    "provider-real-filesystem-fixture-corpus-manifest-envelope",
  ),
  schemaSourceV1(
    "installationIdentityGenerationId",
    "installation-identity-generation-id",
  ),
  schemaSourceV1(
    "providerFeasibilityEvidence",
    "provider-feasibility-evidence-envelope",
  ),
  schemaSourceV1(
    "providerFeasibilityEvidencePin",
    "provider-feasibility-evidence-pin",
  ),
  schemaSourceV1(
    "publicSupportTaxonomy",
    "provider-public-support-taxonomy-envelope",
  ),
  schemaSourceV1(
    "realFilesystemConformanceResult",
    "provider-real-filesystem-conformance-result-envelope",
  ),
  schemaSourceV1(
    "realFilesystemConformanceResultLocator",
    "provider-real-filesystem-conformance-result-locator",
  ),
  schemaSourceV1(
    "realFilesystemConformanceResultPin",
    "provider-real-filesystem-conformance-result-pin",
  ),
  schemaSourceV1(
    "registryManifestHistory",
    "provider-registry-manifest-envelope",
  ),
  schemaSourceV1("releaseMatrix", "provider-release-matrix-envelope"),
  schemaSourceV1(
    "rootMetadataHistory",
    "provider-registry-root-metadata-envelope",
  ),
  schemaSourceV1(
    "runtimeAttestation",
    "store-durable-object-provider-runtime-attestation-pin",
  ),
  schemaSourceV1(
    "semanticProviderPolicy",
    "store-durable-object-provider-policy",
  ),
  schemaSourceV1(
    "suiteManifest",
    "provider-real-filesystem-suite-manifest-envelope",
  ),
  schemaSourceV1(
    "targetDiscoveryFixtureManifest",
    "provider-target-discovery-fixture-manifest-envelope",
  ),
  schemaSourceV1(
    "targetDiscoveryResult",
    "provider-target-discovery-result-envelope",
  ),
  schemaSourceV1(
    "targetDiscoveryRunnerRun",
    "provider-target-discovery-runner-run-envelope",
  ),
]);

const ProductionParserAstExpectationsV1 = {
  activeRoot: [
    "bindCandidateRootV1",
    "direct_schema_method",
    "activeRoot",
    "ProviderRegistryRootPublicKeyV1Schema",
    "src/provider-registry-trust.ts",
    "safeParse",
  ],
  activeRootMetadata: [
    "bindCandidateRootV1",
    "direct_schema_method",
    "activeRootMetadata",
    "ProviderRegistryRootMetadataPinV1Schema",
    "src/provider-registry-trust.ts",
    "safeParse",
  ],
  bootstrapTrustBundle: [
    "validateBootstrapDistributionBindingV1",
    "direct_schema_method",
    "bootstrapTrustBundle",
    "ProviderBootstrapTrustBundleV1Schema",
    "src/bootstrap-trust-bundle.ts",
    "parse",
  ],
  distributionRootBinding: [
    "validateBootstrapDistributionBindingV1",
    "direct_schema_method",
    "distributionRootBinding",
    "ProviderSignedDistributionRootBindingV1Schema",
    "src/provider-distribution-trust.ts",
    "parse",
  ],
  fixtureCorpusManifest: [
    "validatePointClosureInternalV1",
    "direct_schema_method",
    "fixtureCorpusManifest",
    "ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema",
    "src/provider-real-filesystem-source.ts",
    "parse",
  ],
  installationIdentityGenerationId: [
    "bindCandidateRootV1",
    "direct_schema_method",
    "installationIdentityGenerationId",
    "InstallationIdentityGenerationIdV1Schema",
    "src/primitives.ts",
    "safeParse",
  ],
  providerFeasibilityEvidence: [
    "validateCompleteEvidenceEnvelopeV1",
    "direct_schema_method",
    "envelope",
    "ProviderFeasibilityEvidenceEnvelopeV1Schema",
    "src/provider-feasibility-evidence-point.ts",
    "safeParse",
  ],
  providerFeasibilityEvidencePin: [
    "validatePreparedEvidencePinStructureV1",
    "direct_schema_method",
    "input",
    "ProviderFeasibilityEvidencePinV1Schema",
    "src/provider-registry-records.ts",
    "safeParse",
  ],
  publicSupportTaxonomy: [
    "validatePointClosureInternalV1",
    "schema_table",
    "publicSupportTaxonomy",
    "ProviderPublicSupportTaxonomyEnvelopeV1Schema",
    "src/provider-target-discovery-point.ts",
    "parse",
  ],
  realFilesystemConformanceResult: [
    "validateResultClosureFromSnapshotInternalV1",
    "direct_schema_method",
    "realFilesystemConformanceResult",
    "ProviderRealFilesystemConformanceResultEnvelopeV1Schema",
    "src/provider-real-filesystem-conformance-result.ts",
    "parse",
  ],
  realFilesystemConformanceResultLocator: [
    "validateResultClosureFromSnapshotInternalV1",
    "direct_schema_method",
    "realFilesystemConformanceResultLocator",
    "ProviderRealFilesystemConformanceResultLocatorV1Schema",
    "src/provider-real-filesystem-conformance-result.ts",
    "parse",
  ],
  realFilesystemConformanceResultPin: [
    "validateResultClosureFromSnapshotInternalV1",
    "direct_schema_method",
    "realFilesystemConformanceResultPin",
    "ProviderRealFilesystemConformanceResultPinV1Schema",
    "src/provider-real-filesystem-conformance-result.ts",
    "parse",
  ],
  registryManifestHistory: [
    "validatePreparedInternalV1",
    "direct_schema_method",
    "envelope",
    "ProviderRegistryManifestEnvelopeV1Schema",
    "src/provider-registry-records.ts",
    "safeParse",
  ],
  releaseMatrix: [
    "validatePointClosureInternalV1",
    "schema_table",
    "releaseMatrix",
    "ProviderReleaseMatrixEnvelopeV1Schema",
    "src/provider-target-discovery-point.ts",
    "parse",
  ],
  rootMetadataHistory: [
    "diagnoseProviderRegistryRootMetadataEnvelopeStructureInternalV1",
    "direct_schema_method",
    "input",
    "ProviderRegistryRootMetadataEnvelopeV1Schema",
    "src/provider-registry-trust.ts",
    "parse",
  ],
  runtimeAttestation: [
    "validateRuntimePointClosureFromSnapshotInternalV1",
    "direct_schema_method",
    "payload",
    "StoreDurableObjectProviderRuntimeAttestationV1Schema",
    "src/provider-registry-records.ts",
    "parse",
  ],
  semanticProviderPolicy: [
    "validateRuntimePointClosureFromSnapshotInternalV1",
    "schema_argument",
    "semanticProviderPolicy",
    "StoreDurableObjectProviderPolicyV1Schema",
    "src/provider-runtime-attestation-point.ts",
    "parse",
  ],
  suiteManifest: [
    "validatePointClosureInternalV1",
    "direct_schema_method",
    "suiteManifest",
    "ProviderRealFilesystemSuiteManifestEnvelopeV1Schema",
    "src/provider-real-filesystem-source.ts",
    "parse",
  ],
  targetDiscoveryFixtureManifest: [
    "validatePointClosureInternalV1",
    "schema_table",
    "targetDiscoveryFixtureManifest",
    "ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema",
    "src/provider-target-discovery-point.ts",
    "parse",
  ],
  targetDiscoveryResult: [
    "validatePointClosureInternalV1",
    "schema_table",
    "targetDiscoveryResult",
    "ProviderTargetDiscoveryResultEnvelopeV1Schema",
    "src/provider-target-discovery-point.ts",
    "parse",
  ],
  targetDiscoveryRunnerRun: [
    "validatePointClosureInternalV1",
    "schema_table",
    "targetDiscoveryRunnerRun",
    "ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema",
    "src/provider-target-discovery-point.ts",
    "parse",
  ],
} as const;

function productionParserBindingV1(
  branch: keyof typeof ProductionParserAstExpectationsV1,
  schemaName: string,
  zodSchemaSymbol: string,
  parserSourcePath: string,
) {
  const [
    callsiteFunction,
    callsiteKind,
    argumentAnchor,
    runtimeSchemaSymbol,
    runtimeSchemaSourcePath,
    runtimeMethod,
  ] = ProductionParserAstExpectationsV1[branch];
  return z.strictObject({
    branch: z.literal(branch),
    schemaName: z.literal(schemaName),
    zodSchemaSymbol: z.literal(zodSchemaSymbol),
    parserMode: NonemptyStringV1Schema,
    parserSourcePath: z.literal(parserSourcePath),
    parserSourceRawSha256: ContentDigestV1Schema,
    parserAst: z.strictObject({
      exportedEntry: z.literal(
        "src/provider-registry-evidence-binding-point.ts#validateProviderRegistryEvidenceBindingPointClosureV1",
      ),
      callsiteFunction: z.literal(callsiteFunction),
      callsiteKind: z.literal(callsiteKind),
      argumentAnchor: z.literal(argumentAnchor),
      runtimeSchemaSymbol: z.literal(runtimeSchemaSymbol),
      runtimeSchemaSourcePath: z.literal(runtimeSchemaSourcePath),
      runtimeMethod: z.literal(runtimeMethod),
      runtimeSchemaExportResolved: z.literal(true),
      astReachable: z.literal(true),
      astCallsiteLine: PositiveSafeIntegerV1Schema,
      astCallsiteSemanticDigest: ContentDigestV1Schema,
      astCallChain: z.array(NonemptyStringV1Schema).min(2),
    }),
    runtimeTrace: z.strictObject({
      requiredMethod: z.literal(runtimeMethod),
      parseHits: NonnegativeSafeIntegerV1Schema,
      safeParseHits: NonnegativeSafeIntegerV1Schema,
      hitRequiredParser: z.literal(true),
      schemaMethodHitAuthority: z.literal("auxiliary_non_authority"),
      exactCallsiteId: ExactParserAstCallsiteIdV1Schema,
      exactCallsiteHits: PositiveSafeIntegerV1Schema,
      hitExactCallsite: z.literal(true),
    }),
  });
}

const ProductionParserBindingsV1Schema = z.tuple([
  productionParserBindingV1(
    "activeRoot",
    "provider-registry-root-public-key",
    "ProviderRegistryRootPublicKeyV1Schema",
    "src/provider-registry-evidence-binding-point.ts",
  ),
  productionParserBindingV1(
    "activeRootMetadata",
    "provider-registry-root-metadata-pin",
    "ProviderRegistryRootMetadataPinV1Schema",
    "src/provider-registry-evidence-binding-point.ts",
  ),
  productionParserBindingV1(
    "bootstrapTrustBundle",
    "provider-bootstrap-trust-bundle",
    "ProviderBootstrapTrustBundleV1Schema",
    "src/provider-registry-evidence-binding-point.ts",
  ),
  productionParserBindingV1(
    "distributionRootBinding",
    "provider-signed-distribution-root-binding",
    "ProviderSignedDistributionRootBindingV1Schema",
    "src/provider-registry-evidence-binding-point.ts",
  ),
  productionParserBindingV1(
    "fixtureCorpusManifest",
    "provider-real-filesystem-fixture-corpus-manifest-envelope",
    "ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema",
    "src/provider-target-discovery-point.ts",
  ),
  productionParserBindingV1(
    "installationIdentityGenerationId",
    "installation-identity-generation-id",
    "InstallationIdentityGenerationIdV1Schema",
    "src/provider-registry-evidence-binding-point.ts",
  ),
  productionParserBindingV1(
    "providerFeasibilityEvidence",
    "provider-feasibility-evidence-envelope",
    "ProviderFeasibilityEvidenceEnvelopeV1Schema",
    "src/provider-registry-evidence-binding-point.ts",
  ),
  productionParserBindingV1(
    "providerFeasibilityEvidencePin",
    "provider-feasibility-evidence-pin",
    "ProviderFeasibilityEvidencePinV1Schema",
    "src/provider-registry-evidence-binding-point.ts",
  ),
  productionParserBindingV1(
    "publicSupportTaxonomy",
    "provider-public-support-taxonomy-envelope",
    "ProviderPublicSupportTaxonomyEnvelopeV1Schema",
    "src/provider-target-discovery-point.ts",
  ),
  productionParserBindingV1(
    "realFilesystemConformanceResult",
    "provider-real-filesystem-conformance-result-envelope",
    "ProviderRealFilesystemConformanceResultEnvelopeV1Schema",
    "src/provider-real-filesystem-conformance-result.ts",
  ),
  productionParserBindingV1(
    "realFilesystemConformanceResultLocator",
    "provider-real-filesystem-conformance-result-locator",
    "ProviderRealFilesystemConformanceResultLocatorV1Schema",
    "src/provider-real-filesystem-conformance-result.ts",
  ),
  productionParserBindingV1(
    "realFilesystemConformanceResultPin",
    "provider-real-filesystem-conformance-result-pin",
    "ProviderRealFilesystemConformanceResultPinV1Schema",
    "src/provider-real-filesystem-conformance-result.ts",
  ),
  productionParserBindingV1(
    "registryManifestHistory",
    "provider-registry-manifest-envelope",
    "ProviderRegistryManifestEnvelopeV1Schema",
    "src/provider-registry-manifest-history.ts",
  ),
  productionParserBindingV1(
    "releaseMatrix",
    "provider-release-matrix-envelope",
    "ProviderReleaseMatrixEnvelopeV1Schema",
    "src/provider-target-discovery-point.ts",
  ),
  productionParserBindingV1(
    "rootMetadataHistory",
    "provider-registry-root-metadata-envelope",
    "ProviderRegistryRootMetadataEnvelopeV1Schema",
    "src/provider-registry-trust.ts",
  ),
  productionParserBindingV1(
    "runtimeAttestation",
    "store-durable-object-provider-runtime-attestation-pin",
    "StoreDurableObjectProviderRuntimeAttestationPinV1Schema",
    "src/provider-runtime-attestation-point.ts",
  ),
  productionParserBindingV1(
    "semanticProviderPolicy",
    "store-durable-object-provider-policy",
    "StoreDurableObjectProviderPolicyV1Schema",
    "src/provider-runtime-attestation-point.ts",
  ),
  productionParserBindingV1(
    "suiteManifest",
    "provider-real-filesystem-suite-manifest-envelope",
    "ProviderRealFilesystemSuiteManifestEnvelopeV1Schema",
    "src/provider-target-discovery-point.ts",
  ),
  productionParserBindingV1(
    "targetDiscoveryFixtureManifest",
    "provider-target-discovery-fixture-manifest-envelope",
    "ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema",
    "src/provider-target-discovery-point.ts",
  ),
  productionParserBindingV1(
    "targetDiscoveryResult",
    "provider-target-discovery-result-envelope",
    "ProviderTargetDiscoveryResultEnvelopeV1Schema",
    "src/provider-target-discovery-point.ts",
  ),
  productionParserBindingV1(
    "targetDiscoveryRunnerRun",
    "provider-target-discovery-runner-run-envelope",
    "ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema",
    "src/provider-target-discovery-point.ts",
  ),
]);

function orderedBoundV1(scope: string) {
  return z.strictObject({
    scope: z.literal(scope),
    maxIdentities: NonnegativeSafeIntegerV1Schema,
    maxWorkUnits: NonnegativeSafeIntegerV1Schema,
    derivation: NonemptyStringV1Schema,
  });
}

const OrderedBoundsV1Schema = z.tuple([
  orderedBoundV1("topLevel"),
  orderedBoundV1("opaqueCapabilityShell"),
  orderedBoundV1("activeRoot"),
  orderedBoundV1("activeRootMetadata"),
  orderedBoundV1("bootstrapTrustBundle"),
  orderedBoundV1("distributionRootBinding"),
  orderedBoundV1("fixtureCorpusManifest"),
  orderedBoundV1("installationIdentityGenerationId"),
  orderedBoundV1("providerFeasibilityEvidence"),
  orderedBoundV1("providerFeasibilityEvidencePin"),
  orderedBoundV1("publicSupportTaxonomy"),
  orderedBoundV1("realFilesystemConformanceResult"),
  orderedBoundV1("realFilesystemConformanceResultLocator"),
  orderedBoundV1("realFilesystemConformanceResultPin"),
  orderedBoundV1("registryManifestHistory"),
  orderedBoundV1("releaseMatrix"),
  orderedBoundV1("rootMetadataHistory"),
  orderedBoundV1("runtimeAttestation"),
  orderedBoundV1("semanticProviderPolicy"),
  orderedBoundV1("suiteManifest"),
  orderedBoundV1("targetDiscoveryFixtureManifest"),
  orderedBoundV1("targetDiscoveryResult"),
  orderedBoundV1("targetDiscoveryRunnerRun"),
]);

function ordinaryWitnessV1(branch: string) {
  return z.strictObject({
    branch: z.literal(branch),
    maxIdentities: NonnegativeSafeIntegerV1Schema,
    maxOwnKeys: NonnegativeSafeIntegerV1Schema,
    maxDenseIndices: NonnegativeSafeIntegerV1Schema,
    maxWorkTopologyObjective: NonnegativeSafeIntegerV1Schema,
    objectiveWitnessesAreIndependent: z.literal(true),
  });
}

const OrdinaryWitnessesV1Schema = z.tuple([
  ordinaryWitnessV1("activeRoot"),
  ordinaryWitnessV1("activeRootMetadata"),
  ordinaryWitnessV1("bootstrapTrustBundle"),
  ordinaryWitnessV1("distributionRootBinding"),
  ordinaryWitnessV1("fixtureCorpusManifest"),
  ordinaryWitnessV1("installationIdentityGenerationId"),
  ordinaryWitnessV1("providerFeasibilityEvidence"),
  ordinaryWitnessV1("providerFeasibilityEvidencePin"),
  ordinaryWitnessV1("publicSupportTaxonomy"),
  ordinaryWitnessV1("realFilesystemConformanceResult"),
  ordinaryWitnessV1("realFilesystemConformanceResultLocator"),
  ordinaryWitnessV1("realFilesystemConformanceResultPin"),
  ordinaryWitnessV1("releaseMatrix"),
  ordinaryWitnessV1("runtimeAttestation"),
  ordinaryWitnessV1("semanticProviderPolicy"),
  ordinaryWitnessV1("suiteManifest"),
  ordinaryWitnessV1("targetDiscoveryFixtureManifest"),
  ordinaryWitnessV1("targetDiscoveryResult"),
  ordinaryWitnessV1("targetDiscoveryRunnerRun"),
]);

const RepeatabilityAuditV1Schema = z.strictObject({
  auditedSchemaPath: NonemptyStringV1Schema,
  exactArrayKeywords: z.array(NonemptyStringV1Schema).min(2),
  auditedAncestorCount: PositiveSafeIntegerV1Schema,
});

const ConstructiveOrdinaryRowShapeV1 = {
  path: NonemptyStringV1Schema,
  targetInstancePointer: NonemptyStringV1Schema,
  baseByteAllowance: PositiveSafeIntegerV1Schema,
  itemCanonicalBytes: PositiveSafeIntegerV1Schema,
  commaBytesPerRepetition: z.literal(1),
  deltaIdentities: PositiveSafeIntegerV1Schema,
  deltaOwnKeys: PositiveSafeIntegerV1Schema,
  deltaDenseIndices: PositiveSafeIntegerV1Schema,
  repetitions: PositiveSafeIntegerV1Schema,
  branchCanonicalBytesAtMost: PositiveSafeIntegerV1Schema,
  identityContribution: PositiveSafeIntegerV1Schema,
  workUnitsPerRepetition: PositiveSafeIntegerV1Schema,
  workContribution: PositiveSafeIntegerV1Schema,
  validation: z.strictObject({
    engine: z.literal("ajv_draft_2020_12"),
    schemaId: NonemptyStringV1Schema,
    repeatabilityProfile: z.literal(
      "homogeneous_items_without_max_unique_contains_or_tuple_keywords",
    ),
    fullBranchBaseItemCount: z.literal(1),
    repeatProbeAdditionalItems: z.literal(2),
    ajvAcceptedFullBranchBase: z.literal(true),
    ajvAcceptedRepeatProbe: z.literal(true),
    ajvAcceptedFinalRunLength: z.literal(true),
    finalMaterializedItemCount: PositiveSafeIntegerV1Schema,
    finalMaterializedCanonicalBytes: PositiveSafeIntegerV1Schema,
    finalMaterializedRawSha256: ContentDigestV1Schema,
    fullBranchBaseCanonicalJson: NonemptyStringV1Schema,
    exemplarCanonicalJson: NonemptyStringV1Schema,
    fullBranchBaseSemanticDigest: ContentDigestV1Schema,
    exemplarSemanticDigest: ContentDigestV1Schema,
    runLengthWitnessSemanticDigest: ContentDigestV1Schema,
    fullBranchBaseTopology: z.strictObject({
      identities: PositiveSafeIntegerV1Schema,
      ownKeys: PositiveSafeIntegerV1Schema,
      denseIndices: NonnegativeSafeIntegerV1Schema,
    }),
    exemplarTopology: z.strictObject({
      identities: PositiveSafeIntegerV1Schema,
      ownKeys: PositiveSafeIntegerV1Schema,
      denseIndices: NonnegativeSafeIntegerV1Schema,
    }),
    repeatabilityAudit: RepeatabilityAuditV1Schema,
    nextRepetitionWouldExceedByteCeiling: z.literal(true),
  }),
};

function constructiveOrdinaryRowV1(branch: string) {
  return z.strictObject({
    branch: z.literal(branch),
    ...ConstructiveOrdinaryRowShapeV1,
  });
}

const ConstructiveOrdinaryRowsV1Schema = z.tuple([
  constructiveOrdinaryRowV1("fixtureCorpusManifest"),
  constructiveOrdinaryRowV1("publicSupportTaxonomy"),
  constructiveOrdinaryRowV1("realFilesystemConformanceResult"),
  constructiveOrdinaryRowV1("suiteManifest"),
  constructiveOrdinaryRowV1("targetDiscoveryFixtureManifest"),
  constructiveOrdinaryRowV1("targetDiscoveryResult"),
  constructiveOrdinaryRowV1("targetDiscoveryRunnerRun"),
]);

function capFailureV1(metric: string) {
  return z.strictObject({
    metric: z.literal(metric),
    cap: PositiveSafeIntegerV1Schema,
    soundUpper: PositiveSafeIntegerV1Schema,
    provenAtLeast: PositiveSafeIntegerV1Schema,
    exceedsByAtLeast: PositiveSafeIntegerV1Schema,
  });
}

const RuntimeTopologyV1Schema = z.strictObject({
  identities: PositiveSafeIntegerV1Schema,
  ownKeys: PositiveSafeIntegerV1Schema,
  denseIndices: NonnegativeSafeIntegerV1Schema,
});

function accountingRuntimeOrdinaryRowV1(profile: string) {
  return z.strictObject({
    profile: z.literal(profile),
    topology: RuntimeTopologyV1Schema,
    observedIdentityDelta: PositiveSafeIntegerV1Schema,
    observedWorkDelta: PositiveSafeIntegerV1Schema,
    expectedWorkDelta: PositiveSafeIntegerV1Schema,
    exact: z.literal(true),
  });
}

export const ProviderRegistryEvidenceBindingTopologyProofV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    recordType: z.literal(
      "provider_registry_evidence_binding_topology_proof",
    ),
    profile: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_PROFILE_V1,
    ),
    status: z.literal("accepted_after_contract_reopen"),
    contractReopenRequired: z.literal(false),
    priorContractReopenRequired: z.literal(true),
    inputKeys: InputKeysV1Schema,
    jsonBranchKeys: JsonBranchKeysV1Schema,
    opaqueField: z.literal("strictCryptoCapability"),
    limits: z.strictObject({
      maxObservedIdentities: z.literal(4_194_304),
      maxPrecloneAllocationWorkUnits: z.literal(268_435_456),
      maxRootMetadataHistoryGenerations: z.literal(256),
      maxRegistryManifestHistoryGenerations: z.literal(4_096),
      maxTrustEnvelopeRawUnits: z.literal(4_194_304),
      maxDistributionRawUnits: z.literal(16_777_216),
      maxRetainedTrustHistoryRawUnits: z.literal(268_435_456),
      maxRawDepth: z.literal(64),
    }),
    policyCardinality: z.strictObject({
      maxProviderVerificationPublicKeyRecordsPerProvider: z.literal(256),
      maxProviderVerificationPublicKeyRecordsPerUsage: z.literal(64),
      maxBindingDerivationGenerationRecordsPerProvider: z.literal(64),
      maxApproverPublicKeyRecordsPerRole: z.literal(64),
      maxCompromisedRevocationRecordsPerIdentity: z.literal(256),
      maxTotalRetainedDistributionObjectCount: z.literal(65_536),
      registryManifestJsonContainerEntryHardCap: z.literal(65_536),
    }),
    sourceAnchors: z.strictObject({
      pointAdmissionContractSemanticDigest: z.literal(
        "sha256:04214a7fc05d2d84af781ca36db649b78576b545aac88701c2f3a324d8f07cce",
      ),
      pointImplementationRawSha256: ContentDigestV1Schema,
      rawAdmissionImplementationSha256: z.literal(
        "sha256:29654ab2688bf11de0c4e8f786e5618afc4f1f09fc5334428b653357f165aa3d",
      ),
      jsonSchemaGeneratorSourceRawSha256: ContentDigestV1Schema,
      compatibleBaseResourcePath: z.literal(
        "fixtures/v1/golden/provider-registry-evidence-binding-point-v1.json",
      ),
      compatibleBaseResourceRawSha256: ContentDigestV1Schema,
      productionParserBindingSemanticDigest: ContentDigestV1Schema,
      productionParserRuntimeTraceProfile: z.literal(
        "fresh_emit_exact_ast_callsite_trace_v1",
      ),
      productionParserRuntimeTraceInstrumentation: z.literal(
        "typescript_before_transform_exact_ast_callsite_nonce_global_hook_v1",
      ),
      productionParserRuntimeTraceEntryExport: z.literal(
        "src/provider-registry-evidence-binding-point.ts#validateProviderRegistryEvidenceBindingPointClosureV1",
      ),
      productionParserRuntimeTraceSemanticDigest: ContentDigestV1Schema,
      productionParserRuntimeTraceSummary: z.strictObject({
        uninstrumentedFreshEmitCompatibleBaseAccepted: z.literal(true),
        instrumentedFreshEmitCompatibleBaseAccepted: z.literal(true),
        successProjectionFieldCount: z.literal(10),
        successProjectionsEquivalent: z.literal(true),
        successProjectionSemanticDigest: ContentDigestV1Schema,
        uninstrumentedCryptoClosure: z.strictObject({
          pointAdmissionCount: z.literal(24),
          signatureVerificationCount: z.literal(46),
        }),
        instrumentedCryptoClosure: z.strictObject({
          pointAdmissionCount: z.literal(24),
          signatureVerificationCount: z.literal(46),
        }),
        exactAstBindingCount: z.literal(21),
        schemaTableConsumerCount: z.literal(1),
        hookLifecycle: z.strictObject({
          randomizedNonceGlobalOwnProperty: z.literal(true),
          nonEnumerable: z.literal(true),
          configurableForCleanup: z.literal(true),
          frozenHookValue: z.literal(true),
          residualPropertyAfterCleanup: z.literal(false),
        }),
      }),
      manifestContainerHardCap: z.literal(65_536),
      trustPolicyRawSha256: z.literal(
        "sha256:61f9d442043fbf621b8b7ea837dec107fa8668514f747398c0577dd7170e7888",
      ),
      trustPolicySemanticDigest: z.literal(
        "sha256:c1d43aa90bc8a5cf99f3384fb3090cdb7b19540be322ad37a3267fc562a161ae",
      ),
      distributionPolicyRawSha256: z.literal(
        "sha256:ad4e1637c5612c5234011a3a2d1aa65449c7a79e7977c9cbfdfd333da00bedcd",
      ),
      distributionPolicySemanticDigest: z.literal(
        "sha256:3e02de99c553c059d02a5070b8d50fd7a263253e2d8729e1e3a31c43011a21ca",
      ),
      accountingModel: z.strictObject({
        fixedSessionWorkUnits: z.literal(64),
        identityWorkUnits: z.literal(4),
        topLevelWorkUnits: z.literal(95),
        sessionOwnedBudgetConstructionWorkUnits: z.literal(4),
        budgetRootWeakSetInsertionWorkUnits: z.literal(2),
        descendantWeakSetInsertionWorkUnitsPerBudget: z.literal(1),
        ordinaryFormula: z.strictObject({
          branchConstant: z.literal(5),
          identityCoefficient: z.literal(6),
          ownKeyCoefficient: z.literal(1),
          denseIndexCoefficient: z.literal(1),
        }),
        historyFormula: z.strictObject({
          arrayConstant: z.literal(10),
          perEnvelopeConstant: z.literal(7),
          identityCoefficient: z.literal(7),
          ownKeyCoefficient: z.literal(1),
          denseIndexCoefficient: z.literal(1),
          sharedAggregateBudgetConstructionWorkUnits: z.literal(4),
        }),
        freshAstControlFlow: z.strictObject({
          profile: z.literal(
            "fresh_typescript_ast_accounting_control_flow_v1",
          ),
          entryExport: z.literal(
            "src/provider-registry-evidence-binding-point.ts#validateProviderRegistryEvidenceBindingPointClosureV1",
          ),
          relevantFunctionCount: z.literal(26),
          mutableTestSeamsExcludedFromAccountingAuthority: z.literal(true),
          semanticDigest: z.literal(
            "sha256:b44c643fb7b9d34c7c1a4ce55d6afe649621ad0fce61efaaee18e0deb689bddf",
          ),
        }),
        runtimeDifferential: z.strictObject({
          profile: z.literal(
            "production_raw_walker_allocation_ledger_differential_v1",
          ),
          testSeamIsolation: z.strictObject({
            mutableTestSeamsExcludedFromAccountingAuthority: z.literal(true),
            allocationCapExerciseActivated: z.literal(false),
            stringBudgetObserverActivated: z.literal(false),
            allocationLedgerReadCount: z.literal(9),
            productionBudgetObserverRejectionCount: z.literal(7),
            authority: z.literal(
              "fresh_ast_and_unmodified_production_walker_differential_only",
            ),
          }),
          topLevel: z.strictObject({
            observedIdentities: z.literal(1),
            observedWorkUnits: z.literal(95),
            exact: z.literal(true),
          }),
          ordinaryRows: z.tuple([
            accountingRuntimeOrdinaryRowV1("object"),
            accountingRuntimeOrdinaryRowV1("array"),
            accountingRuntimeOrdinaryRowV1("nested"),
          ]),
          retainedHistory: z.strictObject({
            sharedAggregateBudget: z.literal(true),
            sharedAggregateBudgetProfile: z.literal("B_H"),
            historyArrayCount: z.literal(2),
            envelopeCount: z.literal(2),
            envelopeTopologies: z.tuple([
              RuntimeTopologyV1Schema,
              RuntimeTopologyV1Schema,
            ]),
            observedIdentityDelta: z.literal(7),
            expectedIdentityDelta: z.literal(7),
            observedWorkDelta: z.literal(79),
            expectedWorkDelta: z.literal(79),
            exact: z.literal(true),
          }),
          semanticDigest: z.literal(
            "sha256:8d1375513cbdf2c1079c4d4951dcb53ff0731db120247857e8ed98469b3b7f67",
          ),
        }),
      }),
    }),
    productionParserBindings: ProductionParserBindingsV1Schema,
    schemaSources: SchemaSourcesV1Schema,
    solver: z.strictObject({
      profile: z.literal("finite_capacity_frontier_v1"),
      arithmetic: z.literal("bigint_rational"),
      objectives: z.tuple([
        z.literal("identities"),
        z.literal("ordinary_work"),
        z.literal("history_work"),
      ]),
      relaxations: z.tuple([
        z.strictObject({
          kind: z.literal("fractional_last_atom"),
          detail: NonemptyStringV1Schema,
        }),
        z.strictObject({
          kind: z.literal("one_of_as_alternative_upper"),
          detail: NonemptyStringV1Schema,
        }),
        z.strictObject({
          kind: z.literal("nested_prerequisite_dropped"),
          detail: NonemptyStringV1Schema,
        }),
        z.strictObject({
          kind: z.literal(
            "cross_branch_semantic_and_crypto_equalities_not_modeled",
          ),
          detail: NonemptyStringV1Schema,
        }),
      ]),
      pathRelaxations: z.array(NonemptyStringV1Schema).min(1),
    }),
    orderedBounds: OrderedBoundsV1Schema,
    symbolicWitness: z.strictObject({
      kind: z.literal("sound_finite_capacity_upper_witness"),
      ordinaryBranches: OrdinaryWitnessesV1Schema,
      retainedHistories: z.strictObject({
        rootEnvelopeCount: z.literal(256),
        registryEnvelopeCount: z.literal(4_096),
        sharedRawUnits: z.literal(268_435_456),
        maxIdentities: PositiveSafeIntegerV1Schema,
        maxWorkUnits: PositiveSafeIntegerV1Schema,
        derivation: NonemptyStringV1Schema,
      }),
      totalMaxIdentities: z.literal(3_126_096),
      totalMaxWorkUnits: z.literal(235_725_869),
      totalDerivation: NonemptyStringV1Schema,
    }),
    capAssessment: z.strictObject({
      priorFrozenCaps: z.strictObject({
        maxObservedIdentities: z.literal(2_097_152),
        maxPrecloneAllocationWorkUnits: z.literal(16_777_216),
      }),
      adoptedCaps: z.strictObject({
        maxObservedIdentities: z.literal(4_194_304),
        maxPrecloneAllocationWorkUnits: z.literal(268_435_456),
      }),
      soundUpperBounds: z.strictObject({
        maxObservedIdentities: z.literal(3_126_096),
        maxPrecloneAllocationWorkUnits: z.literal(235_725_869),
      }),
      adoptedAssessment: z.strictObject({
        withinSoundUpper: z.literal(true),
        observedIdentityHeadroom: z.literal(1_068_208),
        precloneAllocationWorkUnitHeadroom: z.literal(32_709_587),
      }),
      recommendedBinaryCaps: z.strictObject({
        rule: z.literal("least_power_of_two_not_less_than_sound_upper"),
        maxObservedIdentities: z.literal(4_194_304),
        maxPrecloneAllocationWorkUnits: z.literal(268_435_456),
        observedIdentityHeadroom: z.literal(1_068_208),
        precloneAllocationWorkUnitHeadroom: z.literal(32_709_587),
      }),
      constructiveLowerBound: z.strictObject({
        basis: z.literal("strict_zod_json_schema_production_only"),
        doesNotClaimCrossBranchSemanticOrCryptoAcceptance: z.literal(true),
        ordinaryRows: ConstructiveOrdinaryRowsV1Schema,
        registryHistoryRow: z.strictObject({
          branch: z.literal("registryManifestHistory"),
          path: z.literal(
            "$.properties.payload.anyOf[0].properties.members.items.oneOf[1]",
          ),
          variant: z.literal("revoked_member"),
          rootEnvelopeCount: z.literal(256),
          registryEnvelopeCount: z.literal(4_096),
          registryEnvelopeBaseByteAllowance: PositiveSafeIntegerV1Schema,
          rootEnvelopeBaseByteAllowance: PositiveSafeIntegerV1Schema,
          itemCanonicalBytes: PositiveSafeIntegerV1Schema,
          commaBytesPerRepetition: z.literal(1),
          deltaIdentities: PositiveSafeIntegerV1Schema,
          deltaOwnKeys: PositiveSafeIntegerV1Schema,
          deltaDenseIndices: PositiveSafeIntegerV1Schema,
          repetitions: PositiveSafeIntegerV1Schema,
          maxAdditionalMembersPerEnvelope: PositiveSafeIntegerV1Schema,
          maxRegistryEnvelopeCanonicalBytes: PositiveSafeIntegerV1Schema,
          outerHistoryArrayCanonicalSyntaxBytesExcludedFromPolicy:
            PositiveSafeIntegerV1Schema,
          sharedHistoryCanonicalBytesAtMost: PositiveSafeIntegerV1Schema,
          identityContribution: PositiveSafeIntegerV1Schema,
          workUnitsPerRepetition: PositiveSafeIntegerV1Schema,
          workContribution: PositiveSafeIntegerV1Schema,
          validation: z.strictObject({
            engine: z.literal("ajv_draft_2020_12"),
            rootSchemaId: NonemptyStringV1Schema,
            registrySchemaId: NonemptyStringV1Schema,
            repeatabilityProfile: z.literal(
              "homogeneous_items_without_max_unique_contains_or_tuple_keywords",
            ),
            rootEnvelopeBaseCanonicalJson: NonemptyStringV1Schema,
            registryEnvelopeBaseCanonicalJson: NonemptyStringV1Schema,
            exemplarCanonicalJson: NonemptyStringV1Schema,
            rootEnvelopeBaseSemanticDigest: ContentDigestV1Schema,
            registryEnvelopeBaseSemanticDigest: ContentDigestV1Schema,
            exemplarSemanticDigest: ContentDigestV1Schema,
            runLengthWitnessSemanticDigest: ContentDigestV1Schema,
            rootEnvelopeBaseTopology: z.strictObject({
              identities: PositiveSafeIntegerV1Schema,
              ownKeys: PositiveSafeIntegerV1Schema,
              denseIndices: NonnegativeSafeIntegerV1Schema,
            }),
            registryEnvelopeBaseTopology: z.strictObject({
              identities: PositiveSafeIntegerV1Schema,
              ownKeys: PositiveSafeIntegerV1Schema,
              denseIndices: NonnegativeSafeIntegerV1Schema,
            }),
            exemplarTopology: z.strictObject({
              identities: PositiveSafeIntegerV1Schema,
              ownKeys: PositiveSafeIntegerV1Schema,
              denseIndices: NonnegativeSafeIntegerV1Schema,
            }),
            baselineMemberCountPerRegistryEnvelope: z.literal(1),
            ajvAcceptedRootEnvelopeBase: z.literal(true),
            ajvAcceptedRegistryEnvelopeBase: z.literal(true),
            ajvAcceptedMaximumRepeatProbe: z.literal(true),
            maximumRepeatProbeAdditionalItems:
              PositiveSafeIntegerV1Schema,
            ajvAcceptedFinalRunLength: z.literal(true),
            finalMaterializedEnvelopeProfiles: z.array(
              z.strictObject({
                additionalItems: PositiveSafeIntegerV1Schema,
                envelopeCount: PositiveSafeIntegerV1Schema,
                materializedMemberCount: PositiveSafeIntegerV1Schema,
                canonicalBytes: PositiveSafeIntegerV1Schema,
                rawSha256: ContentDigestV1Schema,
                ajvAccepted: z.literal(true),
              }),
            ).min(1),
            repeatabilityAudit: RepeatabilityAuditV1Schema,
          }),
        }),
        provenAtLeastObservedIdentities: z.literal(2_118_023),
        provenAtLeastPrecloneAllocationWorkUnits: z.literal(22_569_542),
        derivation: NonemptyStringV1Schema,
      }),
      priorFailures: z.tuple([
        capFailureV1("observed_identities"),
        capFailureV1("preclone_allocation_work_units"),
      ]),
      adoptedFailures: z.array(z.never()).length(0),
    }),
    semanticDomain: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_SEMANTIC_DOMAIN_V1,
    ),
    aggregateSemanticDigest: z.literal(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_AGGREGATE_SEMANTIC_DIGEST_V1,
    ),
  });

export type ProviderRegistryEvidenceBindingTopologyProofV1 = z.infer<
  typeof ProviderRegistryEvidenceBindingTopologyProofV1Schema
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
  return `sha256:${rawSha256HexV1(
    canonicalizeJcsSafeIntegerUtf8V1([domain, value]),
  )}`;
}

function deepFreezeJsonV1<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of CapturedObjectValuesV1(value)) {
      deepFreezeJsonV1(child);
    }
    CapturedObjectFreezeV1(value);
  }
  return value;
}

export class ProviderRegistryEvidenceBindingTopologyProofError extends TypeError {}

export function verifyProviderRegistryEvidenceBindingTopologyProofResourceV1(
  bytes: Uint8Array,
): ProviderRegistryEvidenceBindingTopologyProofV1 {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength >
      PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_MAX_BYTES_V1 ||
    bytes.byteLength !==
      PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_RESOURCE_BYTE_LENGTH_V1 ||
    rawSha256HexV1(bytes) !==
      PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_RESOURCE_SHA256_HEX_V1
  ) {
    throw new ProviderRegistryEvidenceBindingTopologyProofError(
      "provider Registry evidence-binding topology proof bytes do not match the immutable anchor",
    );
  }

  let proof: ProviderRegistryEvidenceBindingTopologyProofV1;
  try {
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    proof = ProviderRegistryEvidenceBindingTopologyProofV1Schema.parse(
      JSON.parse(text) as unknown,
    );
  } catch {
    throw new ProviderRegistryEvidenceBindingTopologyProofError(
      "provider Registry evidence-binding topology proof is not strict UTF-8 JSON with the frozen schema",
    );
  }

  const { aggregateSemanticDigest, ...semanticFields } = proof;
  if (
    semanticDigestV1(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_SEMANTIC_DOMAIN_V1,
      semanticFields,
    ) !== aggregateSemanticDigest
  ) {
    throw new ProviderRegistryEvidenceBindingTopologyProofError(
      "provider Registry evidence-binding topology proof semantic digest mismatch",
    );
  }
  return deepFreezeJsonV1(proof);
}
