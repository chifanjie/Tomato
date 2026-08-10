import { createHash, createPrivateKey, sign } from "node:crypto";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../../dist/jcs.js";
import {
  ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
  ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
  ProviderRealFilesystemSuiteManifestV1Schema,
  createProviderRealFilesystemSuiteManifestSignatureMessageV1,
  deriveProviderRealFilesystemFixtureCorpusManifestContentDigestV1,
  deriveProviderRealFilesystemSuiteManifestContentDigestV1,
} from "../../dist/provider-real-filesystem-source.js";
import {
  buildProviderFeasibilitySupportCandidateFixture,
  resignProviderFeasibilitySupportCatalogEnvelopeFixture,
} from "./provider-feasibility-support-catalog-point-fixture.mjs";
import { buildGoldenSourceFixture } from "./provider-real-filesystem-source-fixture.mjs";
import { ROOT_3_SEED_HEX } from "./provider-registry-evidence-binding-point-fixture.mjs";
import {
  buildSignedUniverseEnvelope,
  rebuildTargetDiscoveryFromRecords,
  resignAndReanchorTargetDiscoveryResultEnvelope,
  resignAndReanchorUniverseEnvelope,
} from "./provider-release-target-universe-point-fixture.mjs";
import { buildGoldenTargetDiscoveryPointFixture } from "./provider-target-discovery-point-fixture.mjs";

export const GOLDEN_RESOURCE_PATH =
  "fixtures/v1/golden/provider-distribution-history-current-candidate-point-v1.json";
export const INVALID_RESOURCE_PATH =
  "fixtures/v1/invalid/provider-distribution-history-current-candidate-point-v1.json";
export const GOLDEN_SEMANTIC_DOMAIN =
  "provider-distribution-history-current-candidate-point-golden-manifest-v1";
export const INVALID_SEMANTIC_DOMAIN =
  "provider-distribution-history-current-candidate-point-invalid-manifest-v1";
export const INVALID_MATERIALIZED_REQUEST_DOMAIN =
  "provider-distribution-history-current-candidate-point-invalid-materialized-request-v1";
export const INVALID_RECIPE_DIALECT =
  "provider_distribution_history_current_candidate_point_invalid_recipe_v1";

export const POSITIVE_VECTOR_IDS = Object.freeze([
  "genesis",
  "two-generation-shared",
  "two-generation-distinct",
]);

const HISTORY_DEFINITIONS = Object.freeze([
  Object.freeze({
    label: "taxonomy",
    field: "publicSupportTaxonomyHistory",
    generationField: "taxonomyGeneration",
    predecessorField: "predecessorTaxonomyContentDigest",
    stage: "public_support_taxonomy_history",
  }),
  Object.freeze({
    label: "matrix",
    field: "releaseMatrixHistory",
    generationField: "releaseMatrixGeneration",
    predecessorField: "predecessorReleaseMatrixContentDigest",
    stage: "release_matrix_history",
  }),
  Object.freeze({
    label: "discovery",
    field: "targetDiscoveryResultHistory",
    generationField: "discoveryGeneration",
    predecessorField: "predecessorDiscoveryContentDigest",
    stage: "target_discovery_result_history",
  }),
  Object.freeze({
    label: "universe",
    field: "releaseTargetUniverseHistory",
    generationField: "universeGeneration",
    predecessorField: "predecessorUniverseContentDigest",
    stage: "release_target_universe_history",
  }),
  Object.freeze({
    label: "catalog",
    field: "providerFeasibilitySupportCatalogHistory",
    generationField: "catalogGeneration",
    predecessorField: "predecessorCatalogContentDigest",
    stage: "provider_feasibility_support_catalog_history",
  }),
]);

const RETAINED_SOURCE_DEFINITIONS = Object.freeze([
  Object.freeze({
    label: "fixture",
    field: "targetDiscoveryFixtureManifests",
  }),
  Object.freeze({
    label: "runner",
    field: "targetDiscoveryRunnerRuns",
  }),
  Object.freeze({
    label: "suite",
    field: "realFilesystemSuiteManifests",
  }),
  Object.freeze({
    label: "corpus",
    field: "realFilesystemFixtureCorpusManifests",
  }),
]);

const signatureCases = [
  ["historical-bundle-signature-bitflip", "bundle"],
  ["historical-suite-signature-bitflip", "suite"],
  ["historical-corpus-signature-bitflip", "corpus"],
].map(([caseId, tamper]) =>
  Object.freeze({
    caseId,
    group: "historical_signature",
    baseVectorId: "two-generation-distinct",
    stage: "current_source_closure",
    reason: "signature_invalid",
    operation: Object.freeze({ kind: "historical_signature", tamper }),
  }),
);

const historicalSemanticCases = [
  ["historical-semantic-suite-cases-order", "suite_cases_order", "current_source_closure"],
  ["historical-semantic-fixture-record-ordinal", "fixture_record_ordinal", "current_source_closure"],
  ["historical-semantic-result-target-count", "result_target_count", "target_discovery_result_history"],
  ["historical-semantic-universe-discovered-count", "universe_discovered_count", "release_target_universe_history"],
  ["historical-semantic-catalog-target-order", "catalog_target_order", "provider_feasibility_support_catalog_history"],
].map(([caseId, tamper, stage]) =>
  Object.freeze({
    caseId,
    group: "historical_semantic",
    baseVectorId: "two-generation-distinct",
    stage,
    reason: "source_invalid",
    operation: Object.freeze({ kind: "historical_semantic", tamper }),
  }),
);

const forbiddenExtraCases = [
  ["input-forbidden-active-root", "activeRoot"],
  ["input-forbidden-current", "current"],
  ["input-forbidden-path", "path"],
].map(([caseId, field]) =>
  Object.freeze({
    caseId,
    group: "forbidden_extra_key",
    baseVectorId: "genesis",
    stage: "input",
    reason: "schema_invalid",
    operation: Object.freeze({ kind: "forbidden_extra_key", field }),
  }),
);

const historyEmptyCases = HISTORY_DEFINITIONS.map((history) =>
  Object.freeze({
    caseId: `${history.label}-history-empty`,
    group: "five_chain_structure",
    baseVectorId: "genesis",
    stage: history.stage,
    reason: "history_empty",
    operation: Object.freeze({ kind: "history_empty", history }),
  }),
);
const historyNonGenesisCases = HISTORY_DEFINITIONS.map((history) =>
  Object.freeze({
    caseId: `${history.label}-history-non-genesis-first`,
    group: "five_chain_structure",
    baseVectorId: "genesis",
    stage: history.stage,
    reason: "generation_not_contiguous",
    operation: Object.freeze({ kind: "history_non_genesis", history }),
  }),
);
const historyPredecessorCases = HISTORY_DEFINITIONS.map((history) =>
  Object.freeze({
    caseId: `${history.label}-history-genesis-predecessor`,
    group: "five_chain_structure",
    baseVectorId: "genesis",
    stage: history.stage,
    reason: "predecessor_digest_mismatch",
    operation: Object.freeze({ kind: "history_predecessor", history }),
  }),
);

function retainedCasesForOperation(operationName) {
  return RETAINED_SOURCE_DEFINITIONS.map((source) =>
    Object.freeze({
      caseId: `retained-${source.label}-${operationName}`,
      group: "retained_exact_cover",
      baseVectorId: "genesis",
      stage: "retained_history_accounting",
      reason: "source_exact_cover_mismatch",
      operation: Object.freeze({
        kind: `retained_${operationName}`,
        source,
      }),
    }),
  );
}

export const INVALID_CASE_DEFINITIONS = Object.freeze([
  ...signatureCases,
  ...historicalSemanticCases,
  ...forbiddenExtraCases,
  ...historyEmptyCases,
  ...historyNonGenesisCases,
  ...historyPredecessorCases,
  ...retainedCasesForOperation("missing"),
  ...retainedCasesForOperation("duplicate"),
  ...retainedCasesForOperation("extra"),
  Object.freeze({
    caseId: "catalog-cross-pin-universe",
    group: "catalog_cross_pin",
    baseVectorId: "genesis",
    stage: "history_pin_closure",
    reason: "pin_mismatch",
    operation: Object.freeze({ kind: "catalog_cross_pin" }),
  }),
]);

export const INVALID_CASE_IDS = Object.freeze(
  INVALID_CASE_DEFINITIONS.map(({ caseId }) => caseId),
);

const GENESIS_PREDECESSOR_DIGEST = `sha256:${"ab".repeat(32)}`;
const CROSS_PIN_DIGEST = `sha256:${"cd".repeat(32)}`;
const UNREFERENCED_SOURCE_DIGEST = `sha256:${"ef".repeat(32)}`;

export function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function semanticDigest(domain, value) {
  return `sha256:${sha256Hex(
    canonicalizeJcsSafeIntegerUtf8V1([domain, value]),
  )}`;
}

export function prettyBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function catalogVector(catalogGolden) {
  const vector = catalogGolden?.positiveVectors?.[0];
  if (vector === undefined) {
    throw new TypeError("Catalog golden has no baseline positive vector");
  }
  return vector;
}

export function buildGenesisHistoryRawRequest(catalogGolden) {
  const request = jsonClone(catalogVector(catalogGolden).request);
  return {
    bootstrapTrustBundle: request.bootstrapTrustBundle,
    distributionRootBinding: request.distributionRootBinding,
    installationIdentityGenerationId:
      request.installationIdentityGenerationId,
    providerFeasibilitySupportCandidateArtifacts:
      request.providerFeasibilitySupportCandidateArtifacts,
    providerFeasibilitySupportCatalogHistory: [
      request.providerFeasibilitySupportCatalog,
    ],
    publicSupportTaxonomyHistory: [request.publicSupportTaxonomy],
    realFilesystemFixtureCorpusManifests: [request.fixtureCorpusManifest],
    realFilesystemSuiteManifests: [request.suiteManifest],
    registryManifestHistory: request.registryManifestHistory,
    releaseMatrixHistory: [request.releaseMatrix],
    releaseTargetUniverseHistory: [request.releaseTargetUniverse],
    rootMetadataHistory: request.rootMetadataHistory,
    targetDiscoveryFixtureManifests: [
      request.targetDiscoveryFixtureManifest,
    ],
    targetDiscoveryResultHistory: [request.targetDiscoveryResult],
    targetDiscoveryRunnerRuns: [request.targetDiscoveryRunnerRun],
  };
}

function privateKeyFromSeedHex(seedHex) {
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.from(seedHex, "hex"),
    ]),
    format: "der",
    type: "pkcs8",
  });
}

function signRootPayload(prefix, rootKeyId, message) {
  return `${prefix}:${rootKeyId}:${sign(
    null,
    Buffer.from(message),
    privateKeyFromSeedHex(ROOT_3_SEED_HEX),
  ).toString("hex")}`;
}

function bitflipSignature(signature) {
  const final = signature.at(-1);
  if (final === undefined) throw new TypeError("signature fixture is empty");
  return `${signature.slice(0, -1)}${final === "0" ? "1" : "0"}`;
}

function reanchorCorpusEnvelope(rawEnvelope) {
  return ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema.parse({
    ...jsonClone(rawEnvelope),
    contentDigest:
      deriveProviderRealFilesystemFixtureCorpusManifestContentDigestV1(
        rawEnvelope.payload,
      ),
  });
}

function resignAndReanchorSuiteEnvelope(rawEnvelope) {
  const unsigned = jsonClone(rawEnvelope.payload);
  delete unsigned.suiteSignature;
  const rootKeyId = unsigned.registryRootKeyId;
  const payload = ProviderRealFilesystemSuiteManifestV1Schema.parse({
    ...unsigned,
    suiteSignature: signRootPayload(
      "provider-real-fs-suite-manifest-ed25519",
      rootKeyId,
      createProviderRealFilesystemSuiteManifestSignatureMessageV1(
        unsigned,
        rootKeyId,
      ),
    ),
  });
  return ProviderRealFilesystemSuiteManifestEnvelopeV1Schema.parse({
    ...jsonClone(rawEnvelope),
    contentDigest:
      deriveProviderRealFilesystemSuiteManifestContentDigestV1(payload),
    payload,
  });
}

function catalogPin(taxonomy) {
  return {
    locatorProfile: "distribution_provider_public_support_taxonomy_v1",
    taxonomyGeneration: taxonomy.taxonomyGeneration,
    contentDigest: taxonomy.contentDigest,
  };
}

function universePin(universe) {
  return {
    locatorProfile: "distribution_provider_release_target_universe_v1",
    universeGeneration: universe.universeGeneration,
    contentDigest: universe.contentDigest,
  };
}

function buildCatalogGeneration(
  template,
  generation,
  predecessorCatalogContentDigest,
  taxonomy,
  universe,
  targets,
) {
  const envelope = jsonClone(template);
  envelope.catalogGeneration = generation;
  envelope.payload.catalogGeneration = generation;
  if (predecessorCatalogContentDigest === undefined) {
    delete envelope.payload.predecessorCatalogContentDigest;
  } else {
    envelope.payload.predecessorCatalogContentDigest =
      predecessorCatalogContentDigest;
  }
  envelope.payload.publicSupportTaxonomy = catalogPin(taxonomy);
  envelope.payload.releaseTargetUniverse = universePin(universe);
  envelope.payload.targets = jsonClone(targets);
  return resignProviderFeasibilitySupportCatalogEnvelopeFixture(envelope, {
    rootKeyId: envelope.payload.registryRootKeyId,
    rootSeedHex: ROOT_3_SEED_HEX,
  });
}

function uniqueEnvelopesByDigest(envelopes) {
  const byDigest = new Map();
  for (const envelope of envelopes) {
    byDigest.set(envelope.contentDigest, jsonClone(envelope));
  }
  return [...byDigest.values()];
}

export function buildTwoGenerationHistoryFixture(catalogGolden, options = {}) {
  const allowedOptionKeys = new Set([
    "historicalSemanticTamper",
    "historicalSignatureTamper",
    "retainedSourceRelationship",
  ]);
  for (const key of Object.keys(options)) {
    if (!allowedOptionKeys.has(key)) {
      throw new TypeError(`unknown two-generation fixture option: ${key}`);
    }
  }
  const historicalSignatureTamper =
    options.historicalSignatureTamper ?? "none";
  const historicalSemanticTamper = options.historicalSemanticTamper ?? "none";
  const retainedSourceRelationship =
    options.retainedSourceRelationship ?? "distinct";
  if (
    !["none", "bundle", "suite", "corpus"].includes(
      historicalSignatureTamper,
    ) ||
    ![
      "none",
      "suite_cases_order",
      "fixture_record_ordinal",
      "result_target_count",
      "universe_discovered_count",
      "catalog_target_order",
    ].includes(historicalSemanticTamper) ||
    !["distinct", "shared"].includes(retainedSourceRelationship)
  ) {
    throw new TypeError("invalid two-generation fixture option");
  }

  const request = jsonClone(catalogVector(catalogGolden).request);
  const rootMetadataEnvelope = request.rootMetadataHistory.at(-1);
  if (rootMetadataEnvelope === undefined) {
    throw new TypeError("Catalog golden has no active root metadata");
  }
  const targetEntries = jsonClone(request.releaseMatrix.payload.targets);

  const historicalSource = buildGoldenSourceFixture({
    distributionRootBinding: request.distributionRootBinding,
    rootMetadataEnvelope,
    rootSeedHex: ROOT_3_SEED_HEX,
    sourceVersion:
      retainedSourceRelationship === "shared" ? "1.0.0" : "0.9.0",
  });
  if (historicalSignatureTamper === "suite") {
    historicalSource.suiteManifest.payload.suiteSignature = bitflipSignature(
      historicalSource.suiteManifest.payload.suiteSignature,
    );
    historicalSource.suiteManifest =
      ProviderRealFilesystemSuiteManifestEnvelopeV1Schema.parse({
        ...historicalSource.suiteManifest,
        contentDigest:
          deriveProviderRealFilesystemSuiteManifestContentDigestV1(
            historicalSource.suiteManifest.payload,
          ),
      });
  }
  if (historicalSignatureTamper === "corpus") {
    historicalSource.fixtureCorpusManifest.payload.corpusSignature =
      bitflipSignature(
        historicalSource.fixtureCorpusManifest.payload.corpusSignature,
      );
    historicalSource.fixtureCorpusManifest = reanchorCorpusEnvelope(
      historicalSource.fixtureCorpusManifest,
    );
    historicalSource.suiteManifest.payload.fixtureCorpusManifest.contentDigest =
      historicalSource.fixtureCorpusManifest.contentDigest;
    historicalSource.suiteManifest = resignAndReanchorSuiteEnvelope(
      historicalSource.suiteManifest,
    );
  }
  if (historicalSemanticTamper === "suite_cases_order") {
    historicalSource.suiteManifest.payload.cases.reverse();
    historicalSource.suiteManifest = resignAndReanchorSuiteEnvelope(
      historicalSource.suiteManifest,
    );
  }

  let historicalDiscovery = buildGoldenTargetDiscoveryPointFixture(
    historicalSource,
    {
      emptyObservationManifests: true,
      targets: targetEntries,
    },
  );
  if (historicalSignatureTamper === "bundle") {
    historicalDiscovery.targetDiscoveryResult.payload.targetDiscoveryInputBundle.bundleSignature =
      bitflipSignature(
        historicalDiscovery.targetDiscoveryResult.payload
          .targetDiscoveryInputBundle.bundleSignature,
      );
    historicalDiscovery.targetDiscoveryResult =
      resignAndReanchorTargetDiscoveryResultEnvelope(
        historicalDiscovery.targetDiscoveryResult,
      historicalDiscovery,
    );
  }
  if (historicalSemanticTamper === "fixture_record_ordinal") {
    historicalDiscovery = rebuildTargetDiscoveryFromRecords(
      historicalDiscovery,
      [
        {
          sourceRecordOrdinal: 1,
          outcome: {
            state: "unresolved",
            reason: "target_dimensions_missing",
          },
        },
      ],
      historicalDiscovery.targetDiscoveryRunnerRun.payload.records,
    );
  }
  if (historicalSemanticTamper === "result_target_count") {
    const historicalResult = jsonClone(
      historicalDiscovery.targetDiscoveryResult,
    );
    historicalResult.payload.targetCount += 1;
    historicalDiscovery.targetDiscoveryResult =
      resignAndReanchorTargetDiscoveryResultEnvelope(
        historicalResult,
        historicalDiscovery,
      );
  }

  const currentSource = buildGoldenSourceFixture({
    distributionRootBinding: request.distributionRootBinding,
    rootMetadataEnvelope,
    rootSeedHex: ROOT_3_SEED_HEX,
  });
  const currentDiscovery = buildGoldenTargetDiscoveryPointFixture(
    currentSource,
    {
      discoveryGeneration: 2,
      emptyObservationManifests: true,
      predecessorDiscoveryContentDigest:
        historicalDiscovery.targetDiscoveryResult.contentDigest,
      predecessorReleaseMatrixContentDigest:
        historicalDiscovery.releaseMatrix.contentDigest,
      predecessorTaxonomyContentDigest:
        historicalDiscovery.publicSupportTaxonomy.contentDigest,
      releaseMatrixGeneration: 2,
      targets: targetEntries,
      taxonomyGeneration: 2,
    },
  );

  let historicalUniverse = buildSignedUniverseEnvelope(historicalDiscovery);
  if (historicalSemanticTamper === "universe_discovered_count") {
    historicalUniverse.payload.coverageBasis.discoveredTargetCount += 1;
    historicalUniverse = resignAndReanchorUniverseEnvelope(
      historicalUniverse,
      historicalDiscovery,
    );
  }
  const currentUniverse = buildSignedUniverseEnvelope(currentDiscovery, {
    predecessorUniverseContentDigest: historicalUniverse.contentDigest,
    universeGeneration: 2,
  });
  const historicalCatalogTargets = jsonClone(
    request.providerFeasibilitySupportCatalog.payload.targets,
  );
  if (historicalSemanticTamper === "catalog_target_order") {
    historicalCatalogTargets.reverse();
  }
  const historicalCatalog = buildCatalogGeneration(
    request.providerFeasibilitySupportCatalog,
    1,
    undefined,
    historicalDiscovery.publicSupportTaxonomy,
    historicalUniverse,
    historicalCatalogTargets,
  );
  const approvalKeys =
    request.providerFeasibilitySupportCatalog.payload.feasibilityApprovalKeys
      .publicKeyRecords;
  const qaApproverPublicKey = approvalKeys.find(({ role }) => role === "qa");
  const releaseApproverPublicKey = approvalKeys.find(
    ({ role }) => role === "release",
  );
  if (
    qaApproverPublicKey === undefined ||
    releaseApproverPublicKey === undefined
  ) {
    throw new TypeError("Catalog golden has no active approval keys");
  }
  const currentCandidates = currentUniverse.payload.targets.map((entry) =>
    buildProviderFeasibilitySupportCandidateFixture({
      discovery: currentDiscovery,
      targetProfileId: entry.target.targetProfileId,
      qaApproverPublicKey,
      releaseApproverPublicKey,
      result: "passed",
      releaseDisposition: "strong_read_write",
      rootSeedHex: ROOT_3_SEED_HEX,
    }),
  );
  const currentCatalogTargets = currentUniverse.payload.targets.map(
    (entry, index) => ({
      target: jsonClone(entry.target),
      candidates: [jsonClone(currentCandidates[index].catalogCandidate)],
    }),
  );
  const currentCatalog = buildCatalogGeneration(
    request.providerFeasibilitySupportCatalog,
    2,
    historicalCatalog.contentDigest,
    currentDiscovery.publicSupportTaxonomy,
    currentUniverse,
    currentCatalogTargets,
  );

  return {
    request: {
      bootstrapTrustBundle: request.bootstrapTrustBundle,
      distributionRootBinding: request.distributionRootBinding,
      installationIdentityGenerationId:
        request.installationIdentityGenerationId,
      providerFeasibilitySupportCandidateArtifacts: currentCandidates.map(
        ({ candidateArtifact }) => jsonClone(candidateArtifact),
      ),
      providerFeasibilitySupportCatalogHistory: [
        historicalCatalog,
        currentCatalog,
      ],
      publicSupportTaxonomyHistory: [
        historicalDiscovery.publicSupportTaxonomy,
        currentDiscovery.publicSupportTaxonomy,
      ],
      realFilesystemFixtureCorpusManifests: uniqueEnvelopesByDigest([
        historicalSource.fixtureCorpusManifest,
        currentSource.fixtureCorpusManifest,
      ]),
      realFilesystemSuiteManifests: uniqueEnvelopesByDigest([
        historicalSource.suiteManifest,
        currentSource.suiteManifest,
      ]),
      registryManifestHistory: request.registryManifestHistory,
      releaseMatrixHistory: [
        historicalDiscovery.releaseMatrix,
        currentDiscovery.releaseMatrix,
      ],
      releaseTargetUniverseHistory: [
        historicalUniverse,
        currentUniverse,
      ],
      rootMetadataHistory: request.rootMetadataHistory,
      targetDiscoveryFixtureManifests: uniqueEnvelopesByDigest([
        historicalDiscovery.targetDiscoveryFixtureManifest,
        currentDiscovery.targetDiscoveryFixtureManifest,
      ]),
      targetDiscoveryResultHistory: [
        historicalDiscovery.targetDiscoveryResult,
        currentDiscovery.targetDiscoveryResult,
      ],
      targetDiscoveryRunnerRuns: uniqueEnvelopesByDigest([
        historicalDiscovery.targetDiscoveryRunnerRun,
        currentDiscovery.targetDiscoveryRunnerRun,
      ]),
    },
    current: {
      catalog: currentCatalog,
      discovery: currentDiscovery.targetDiscoveryResult,
      matrix: currentDiscovery.releaseMatrix,
      taxonomy: currentDiscovery.publicSupportTaxonomy,
      universe: currentUniverse,
    },
  };
}

export function buildPositiveRawRequest(catalogGolden, vectorId) {
  if (vectorId === "genesis") {
    return buildGenesisHistoryRawRequest(catalogGolden);
  }
  if (vectorId === "two-generation-shared") {
    return buildTwoGenerationHistoryFixture(catalogGolden, {
      retainedSourceRelationship: "shared",
    }).request;
  }
  if (vectorId === "two-generation-distinct") {
    return buildTwoGenerationHistoryFixture(catalogGolden).request;
  }
  throw new TypeError(`unknown positive vector: ${String(vectorId)}`);
}

function topLevelPatch(baseRequest, invalidRequest) {
  const keys = [...new Set([
    ...Object.keys(baseRequest),
    ...Object.keys(invalidRequest),
  ])].sort();
  const operations = [];
  for (const field of keys) {
    const baseHas = Object.hasOwn(baseRequest, field);
    const invalidHas = Object.hasOwn(invalidRequest, field);
    if (!invalidHas) {
      throw new TypeError("invalid fixture unexpectedly deletes a raw field");
    }
    if (
      !baseHas ||
      JSON.stringify(baseRequest[field]) !== JSON.stringify(invalidRequest[field])
    ) {
      operations.push({
        kind: baseHas ? "replace" : "add",
        field,
        value: jsonClone(invalidRequest[field]),
      });
    }
  }
  if (operations.length === 0) {
    throw new TypeError("invalid fixture recipe has no mutation");
  }
  return operations;
}

function findInvalidDefinition(caseId) {
  const definition = INVALID_CASE_DEFINITIONS.find(
    (candidate) => candidate.caseId === caseId,
  );
  if (definition === undefined) {
    throw new TypeError(`unknown invalid case: ${String(caseId)}`);
  }
  return definition;
}

export function buildInvalidCase(catalogGolden, caseId) {
  const definition = findInvalidDefinition(caseId);
  const baseRequest = buildPositiveRawRequest(
    catalogGolden,
    definition.baseVectorId,
  );
  let invalidRequest;
  const operation = definition.operation;
  if (operation.kind === "historical_signature") {
    invalidRequest = buildTwoGenerationHistoryFixture(catalogGolden, {
      historicalSignatureTamper: operation.tamper,
    }).request;
  } else if (operation.kind === "historical_semantic") {
    invalidRequest = buildTwoGenerationHistoryFixture(catalogGolden, {
      historicalSemanticTamper: operation.tamper,
    }).request;
  } else {
    invalidRequest = jsonClone(baseRequest);
    if (operation.kind === "forbidden_extra_key") {
      const catalogRequest = catalogVector(catalogGolden).request;
      invalidRequest[operation.field] =
        operation.field === "activeRoot"
          ? jsonClone(catalogRequest.activeRoot)
          : operation.field === "current"
            ? true
            : "provider/support-catalog/latest.json";
    } else if (operation.kind === "history_empty") {
      invalidRequest[operation.history.field] = [];
    } else if (operation.kind === "history_non_genesis") {
      const envelope = invalidRequest[operation.history.field][0];
      envelope[operation.history.generationField] = 2;
      envelope.payload[operation.history.generationField] = 2;
    } else if (operation.kind === "history_predecessor") {
      invalidRequest[operation.history.field][0].payload[
        operation.history.predecessorField
      ] = GENESIS_PREDECESSOR_DIGEST;
    } else if (operation.kind === "retained_missing") {
      invalidRequest[operation.source.field] = [];
    } else if (operation.kind === "retained_duplicate") {
      const source = invalidRequest[operation.source.field][0];
      invalidRequest[operation.source.field] = [source, jsonClone(source)];
    } else if (operation.kind === "retained_extra") {
      const source = invalidRequest[operation.source.field];
      const extra = jsonClone(source[0]);
      extra.contentDigest = UNREFERENCED_SOURCE_DIGEST;
      invalidRequest[operation.source.field] = [...source, extra];
    } else if (operation.kind === "catalog_cross_pin") {
      const catalog =
        invalidRequest.providerFeasibilitySupportCatalogHistory[0];
      catalog.payload.releaseTargetUniverse.contentDigest = CROSS_PIN_DIGEST;
      invalidRequest.providerFeasibilitySupportCatalogHistory[0] =
        resignProviderFeasibilitySupportCatalogEnvelopeFixture(catalog, {
          rootKeyId: catalog.payload.registryRootKeyId,
          rootSeedHex: ROOT_3_SEED_HEX,
        });
    } else {
      throw new TypeError(`unsupported invalid fixture operation: ${caseId}`);
    }
  }
  return {
    caseId: definition.caseId,
    group: definition.group,
    baseVectorId: definition.baseVectorId,
    recipe: {
      dialect: INVALID_RECIPE_DIALECT,
      operations: topLevelPatch(baseRequest, invalidRequest),
    },
    request: invalidRequest,
    expected: {
      stage: definition.stage,
      reason: definition.reason,
    },
  };
}
