import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import { diagnoseProviderDistributionHistoryCurrentCandidatePointV1 } from "../src/provider-distribution-history-current-candidate-point.js";
import {
  ProviderFeasibilitySupportCatalogPointGoldenManifestV1Schema,
  projectProviderFeasibilitySupportCatalogPointFixtureClosureV1,
} from "../src/provider-feasibility-support-catalog-point-fixtures.js";
import {
  buildProviderFeasibilitySupportCandidateFixture,
  resignProviderFeasibilitySupportCatalogEnvelopeFixture,
} from "../scripts/lib/provider-feasibility-support-catalog-point-fixture.mjs";
import { buildGoldenSourceFixture } from "../scripts/lib/provider-real-filesystem-source-fixture.mjs";
import * as releaseTargetUniverseFixtureRuntimeV1 from "../scripts/lib/provider-release-target-universe-point-fixture.mjs";
import {
  buildSignedUniverseEnvelope,
  resignAndReanchorTargetDiscoveryResultEnvelope,
} from "../scripts/lib/provider-release-target-universe-point-fixture.mjs";
import { ROOT_3_SEED_HEX } from "../scripts/lib/provider-registry-evidence-binding-point-fixture.mjs";
import { buildGoldenTargetDiscoveryPointFixture } from "../scripts/lib/provider-target-discovery-point-fixture.mjs";
import {
  ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
  ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
  ProviderRealFilesystemSuiteManifestV1Schema,
  createProviderRealFilesystemSuiteManifestSignatureMessageV1,
  deriveProviderRealFilesystemFixtureCorpusManifestContentDigestV1,
  deriveProviderRealFilesystemSuiteManifestContentDigestV1,
} from "../src/provider-real-filesystem-source.js";
import {
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  attestProviderStrictEd25519CryptoHostV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "../src/strict-ed25519-conformance.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "../src/strict-ed25519.js";

const EXPECTED_RAW_KEYS_V1 = [
  "bootstrapTrustBundle",
  "distributionRootBinding",
  "installationIdentityGenerationId",
  "providerFeasibilitySupportCandidateArtifacts",
  "providerFeasibilitySupportCatalogHistory",
  "publicSupportTaxonomyHistory",
  "realFilesystemFixtureCorpusManifests",
  "realFilesystemSuiteManifests",
  "registryManifestHistory",
  "releaseMatrixHistory",
  "releaseTargetUniverseHistory",
  "rootMetadataHistory",
  "strictCryptoCapability",
  "targetDiscoveryFixtureManifests",
  "targetDiscoveryResultHistory",
  "targetDiscoveryRunnerRuns",
] as const;

const EXPECTED_SUCCESS_KEYS_V1 = [
  "authority",
  "catalogPointClosure",
  "currentCatalogProjection",
  "providerFeasibilitySupportCatalogTip",
  "publicSupportTaxonomyTip",
  "releaseMatrixTip",
  "releaseTargetUniverseTip",
  "targetDiscoveryResultTip",
] as const;

const EXPECTED_CATALOG_PROJECTION_KEYS_V1 = [
  "authority",
  "candidateCount",
  "ownerTargetCapabilities",
  "providerFeasibilitySupportCatalogContentDigest",
  "providerFeasibilitySupportCatalogPin",
  "publicSupport",
  "publicSupportRowCount",
  "relativePath",
  "targetCount",
] as const;

const GENESIS_PREDECESSOR_DIGEST_V1 = `sha256:${"ab".repeat(32)}`;
const CROSS_PIN_DIGEST_V1 = `sha256:${"cd".repeat(32)}`;
const UNREFERENCED_SOURCE_DIGEST_V1 = `sha256:${"ef".repeat(32)}`;

type MutableJsonRecordV1 = Record<string, any>;

const {
  rebuildTargetDiscoveryFromRecords,
  resignAndReanchorUniverseEnvelope,
} = releaseTargetUniverseFixtureRuntimeV1 as unknown as {
  readonly rebuildTargetDiscoveryFromRecords: (
    sourceGolden: MutableJsonRecordV1,
    fixtureRecords: readonly MutableJsonRecordV1[],
    runnerRecords: readonly MutableJsonRecordV1[],
  ) => MutableJsonRecordV1;
  readonly resignAndReanchorUniverseEnvelope: (
    rawEnvelope: MutableJsonRecordV1,
    sourceGolden: MutableJsonRecordV1,
  ) => MutableJsonRecordV1;
};
type GenesisFieldsV1 = Record<string, unknown>;

function resourceBytes(relativePath: string): Uint8Array {
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url))),
  );
}

function cloneJsonV1<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectRecursivelyFrozenV1(
  value: unknown,
  seen = new Set<object>(),
): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      expectRecursivelyFrozenV1(descriptor.value, seen);
    }
  }
}

const golden = ProviderFeasibilitySupportCatalogPointGoldenManifestV1Schema.parse(
  JSON.parse(
    new TextDecoder().decode(
      resourceBytes(
        "fixtures/v1/golden/provider-feasibility-support-catalog-point-v1.json",
      ),
    ),
  ),
);
const vector = golden.positiveVectors[0]!;
const strictManifestBytes = resourceBytes(
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
);

let pointAdmissionCount = 0;
let signatureVerificationCount = 0;
let capability: ProviderStrictEd25519OpaqueCapabilityV1;

beforeAll(async () => {
  capability = await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint(encodedPoint: Uint8Array) {
        pointAdmissionCount += 1;
        return validatePrimeSubgroupPoint(encodedPoint);
      },
      async verifyRawEd25519(
        publicKey: Uint8Array,
        message: Uint8Array,
        signature: Uint8Array,
      ) {
        signatureVerificationCount += 1;
        return verifyRawEd25519(publicKey, message, signature);
      },
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(path: string, maxBytes: number) {
        expect(path).toBe(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1);
        expect(maxBytes).toBe(PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1);
        return strictManifestBytes.slice();
      },
    }),
  });
  resetCryptoCountsV1();
});

function resetCryptoCountsV1(): void {
  pointAdmissionCount = 0;
  signatureVerificationCount = 0;
}

function genesisFieldsV1(): GenesisFieldsV1 {
  const request = cloneJsonV1(vector.request);
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

function materializeInputV1(
  mutate?: (fields: GenesisFieldsV1) => void,
): Readonly<Record<string, unknown>> {
  const fields = genesisFieldsV1();
  mutate?.(fields);
  Object.defineProperty(fields, "strictCryptoCapability", {
    configurable: false,
    enumerable: true,
    value: capability,
    writable: false,
  });
  return Object.freeze(fields);
}

type HistoricalRetainedSignatureTamperV1 =
  | "none"
  | "bundle"
  | "suite"
  | "corpus";
type RetainedSourceRelationshipV1 = "distinct" | "shared";
type HistoricalRetainedSemanticTamperV1 =
  | "none"
  | "suite_cases_order"
  | "fixture_record_ordinal"
  | "result_target_count"
  | "universe_discovered_count"
  | "catalog_target_order";

interface TwoGenerationHistoryFixtureV1 {
  readonly fields: GenesisFieldsV1;
  readonly current: {
    readonly catalog: MutableJsonRecordV1;
    readonly discovery: MutableJsonRecordV1;
    readonly matrix: MutableJsonRecordV1;
    readonly taxonomy: MutableJsonRecordV1;
    readonly universe: MutableJsonRecordV1;
  };
}

type HistoricalTipDependencySkewV1 =
  | "matrix_to_taxonomy_tip"
  | "result_to_taxonomy_and_matrix_tips"
  | "universe_to_result_tip"
  | "catalog_to_universe_tip";

function privateKeyFromSeedHexV1(seedHex: string): ReturnType<typeof createPrivateKey> {
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.from(seedHex, "hex"),
    ]),
    format: "der",
    type: "pkcs8",
  });
}

function signRootPayloadV1(
  prefix: string,
  rootKeyId: string,
  message: Uint8Array,
): string {
  return `${prefix}:${rootKeyId}:${sign(
    null,
    Buffer.from(message),
    privateKeyFromSeedHexV1(ROOT_3_SEED_HEX),
  ).toString("hex")}`;
}

function bitflipSignatureV1(signature: string): string {
  const final = signature.at(-1);
  if (final === undefined) throw new TypeError("signature fixture is empty");
  return `${signature.slice(0, -1)}${final === "0" ? "1" : "0"}`;
}

function reanchorCorpusEnvelopeV1(
  rawEnvelope: MutableJsonRecordV1,
): MutableJsonRecordV1 {
  return ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema.parse({
    ...cloneJsonV1(rawEnvelope),
    contentDigest:
      deriveProviderRealFilesystemFixtureCorpusManifestContentDigestV1(
        rawEnvelope.payload,
      ),
  }) as MutableJsonRecordV1;
}

function resignAndReanchorSuiteEnvelopeV1(
  rawEnvelope: MutableJsonRecordV1,
): MutableJsonRecordV1 {
  const unsigned = cloneJsonV1(rawEnvelope.payload);
  delete unsigned.suiteSignature;
  const rootKeyId = unsigned.registryRootKeyId as string;
  const payload = ProviderRealFilesystemSuiteManifestV1Schema.parse({
    ...unsigned,
    suiteSignature: signRootPayloadV1(
      "provider-real-fs-suite-manifest-ed25519",
      rootKeyId,
      createProviderRealFilesystemSuiteManifestSignatureMessageV1(
        unsigned as never,
        rootKeyId as never,
      ),
    ),
  });
  return ProviderRealFilesystemSuiteManifestEnvelopeV1Schema.parse({
    ...cloneJsonV1(rawEnvelope),
    contentDigest:
      deriveProviderRealFilesystemSuiteManifestContentDigestV1(payload),
    payload,
  }) as MutableJsonRecordV1;
}

function catalogPinV1(
  taxonomy: MutableJsonRecordV1,
): MutableJsonRecordV1 {
  return {
    locatorProfile: "distribution_provider_public_support_taxonomy_v1",
    taxonomyGeneration: taxonomy.taxonomyGeneration,
    contentDigest: taxonomy.contentDigest,
  };
}

function universePinV1(
  universe: MutableJsonRecordV1,
): MutableJsonRecordV1 {
  return {
    locatorProfile: "distribution_provider_release_target_universe_v1",
    universeGeneration: universe.universeGeneration,
    contentDigest: universe.contentDigest,
  };
}

function buildCatalogGenerationV1(
  template: MutableJsonRecordV1,
  generation: number,
  predecessorCatalogContentDigest: string | undefined,
  taxonomy: MutableJsonRecordV1,
  universe: MutableJsonRecordV1,
  targets: readonly MutableJsonRecordV1[],
): MutableJsonRecordV1 {
  const envelope = cloneJsonV1(template);
  envelope.catalogGeneration = generation;
  envelope.payload.catalogGeneration = generation;
  if (predecessorCatalogContentDigest === undefined) {
    delete envelope.payload.predecessorCatalogContentDigest;
  } else {
    envelope.payload.predecessorCatalogContentDigest =
      predecessorCatalogContentDigest;
  }
  envelope.payload.publicSupportTaxonomy = catalogPinV1(taxonomy);
  envelope.payload.releaseTargetUniverse = universePinV1(universe);
  envelope.payload.targets = cloneJsonV1(targets);
  return resignProviderFeasibilitySupportCatalogEnvelopeFixture(
    envelope as never,
    {
      rootKeyId: envelope.payload.registryRootKeyId,
      rootSeedHex: ROOT_3_SEED_HEX,
    },
  ) as MutableJsonRecordV1;
}

function uniqueEnvelopesByDigestV1(
  envelopes: readonly MutableJsonRecordV1[],
): MutableJsonRecordV1[] {
  const byDigest = new Map<string, MutableJsonRecordV1>();
  for (const envelope of envelopes) {
    byDigest.set(envelope.contentDigest as string, cloneJsonV1(envelope));
  }
  return [...byDigest.values()];
}

function buildTwoGenerationHistoryFixtureV1(
  tamper: HistoricalRetainedSignatureTamperV1 = "none",
  retainedSourceRelationship: RetainedSourceRelationshipV1 = "distinct",
  semanticTamper: HistoricalRetainedSemanticTamperV1 = "none",
): TwoGenerationHistoryFixtureV1 {
  const request = cloneJsonV1(vector.request) as MutableJsonRecordV1;
  const rootMetadataEnvelope = request.rootMetadataHistory.at(-1);
  if (rootMetadataEnvelope === undefined) {
    throw new TypeError("Catalog golden has no active root metadata");
  }
  const targetEntries = cloneJsonV1(
    request.releaseMatrix.payload.targets,
  ) as MutableJsonRecordV1[];

  const historicalSource = buildGoldenSourceFixture({
    distributionRootBinding: request.distributionRootBinding,
    rootMetadataEnvelope,
    rootSeedHex: ROOT_3_SEED_HEX,
    sourceVersion:
      retainedSourceRelationship === "shared" ? "1.0.0" : "0.9.0",
  }) as MutableJsonRecordV1;
  if (tamper === "suite") {
    historicalSource.suiteManifest.payload.suiteSignature =
      bitflipSignatureV1(
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
  if (tamper === "corpus") {
    historicalSource.fixtureCorpusManifest.payload.corpusSignature =
      bitflipSignatureV1(
        historicalSource.fixtureCorpusManifest.payload.corpusSignature,
      );
    historicalSource.fixtureCorpusManifest = reanchorCorpusEnvelopeV1(
      historicalSource.fixtureCorpusManifest,
    );
    historicalSource.suiteManifest.payload.fixtureCorpusManifest.contentDigest =
      historicalSource.fixtureCorpusManifest.contentDigest;
    historicalSource.suiteManifest = resignAndReanchorSuiteEnvelopeV1(
      historicalSource.suiteManifest,
    );
  }
  if (semanticTamper === "suite_cases_order") {
    historicalSource.suiteManifest.payload.cases.reverse();
    historicalSource.suiteManifest = resignAndReanchorSuiteEnvelopeV1(
      historicalSource.suiteManifest,
    );
  }

  let historicalDiscovery = buildGoldenTargetDiscoveryPointFixture(
    historicalSource,
    {
      emptyObservationManifests: true,
      targets: targetEntries,
    },
  ) as MutableJsonRecordV1;
  if (tamper === "bundle") {
    const historicalResult = cloneJsonV1(
      historicalDiscovery.targetDiscoveryResult,
    );
    historicalResult.payload.targetDiscoveryInputBundle.bundleSignature =
      bitflipSignatureV1(
        historicalResult.payload.targetDiscoveryInputBundle.bundleSignature,
      );
    historicalDiscovery.targetDiscoveryResult =
      resignAndReanchorTargetDiscoveryResultEnvelope(
        historicalResult,
        historicalDiscovery,
      );
  }
  if (semanticTamper === "fixture_record_ordinal") {
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
    ) as MutableJsonRecordV1;
  }
  if (semanticTamper === "result_target_count") {
    const historicalResult = cloneJsonV1(
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
  }) as MutableJsonRecordV1;
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
  ) as MutableJsonRecordV1;

  let historicalUniverse = buildSignedUniverseEnvelope(
    historicalDiscovery,
  ) as MutableJsonRecordV1;
  if (semanticTamper === "universe_discovered_count") {
    historicalUniverse.payload.coverageBasis.discoveredTargetCount += 1;
    historicalUniverse = resignAndReanchorUniverseEnvelope(
      historicalUniverse,
      historicalDiscovery,
    ) as MutableJsonRecordV1;
  }
  const currentUniverse = buildSignedUniverseEnvelope(currentDiscovery, {
    predecessorUniverseContentDigest: historicalUniverse.contentDigest,
    universeGeneration: 2,
  }) as MutableJsonRecordV1;

  const historicalCatalogTargets = cloneJsonV1(
    request.providerFeasibilitySupportCatalog.payload.targets,
  ) as MutableJsonRecordV1[];
  if (semanticTamper === "catalog_target_order") {
    historicalCatalogTargets.reverse();
  }
  const historicalCatalog = buildCatalogGenerationV1(
    request.providerFeasibilitySupportCatalog,
    1,
    undefined,
    historicalDiscovery.publicSupportTaxonomy,
    historicalUniverse,
    historicalCatalogTargets,
  );
  const approvalKeys =
    request.providerFeasibilitySupportCatalog.payload.feasibilityApprovalKeys
      .publicKeyRecords as MutableJsonRecordV1[];
  const qaApproverPublicKey = approvalKeys.find(
    (entry) => entry.role === "qa",
  );
  const releaseApproverPublicKey = approvalKeys.find(
    (entry) => entry.role === "release",
  );
  if (
    qaApproverPublicKey === undefined ||
    releaseApproverPublicKey === undefined
  ) {
    throw new TypeError("Catalog golden has no active approval keys");
  }
  const currentCandidates: MutableJsonRecordV1[] = (
    currentUniverse.payload.targets as MutableJsonRecordV1[]
  ).map(
    (entry: MutableJsonRecordV1) =>
      buildProviderFeasibilitySupportCandidateFixture({
        discovery: currentDiscovery as never,
        targetProfileId: entry.target.targetProfileId,
        qaApproverPublicKey: qaApproverPublicKey as never,
        releaseApproverPublicKey: releaseApproverPublicKey as never,
        result: "passed",
        releaseDisposition: "strong_read_write",
        rootSeedHex: ROOT_3_SEED_HEX,
      }) as MutableJsonRecordV1,
  );
  const currentCatalogTargets = currentUniverse.payload.targets.map(
    (entry: MutableJsonRecordV1, index: number) => ({
      target: cloneJsonV1(entry.target),
      candidates: [cloneJsonV1(currentCandidates[index]!.catalogCandidate)],
    }),
  );
  const currentCatalog = buildCatalogGenerationV1(
    request.providerFeasibilitySupportCatalog,
    2,
    historicalCatalog.contentDigest,
    currentDiscovery.publicSupportTaxonomy,
    currentUniverse,
    currentCatalogTargets,
  );

  return {
    fields: {
      bootstrapTrustBundle: request.bootstrapTrustBundle,
      distributionRootBinding: request.distributionRootBinding,
      installationIdentityGenerationId:
        request.installationIdentityGenerationId,
      providerFeasibilitySupportCandidateArtifacts: currentCandidates.map(
        (candidate) => cloneJsonV1(candidate.candidateArtifact),
      ),
      providerFeasibilitySupportCatalogHistory: [
        historicalCatalog,
        currentCatalog,
      ],
      publicSupportTaxonomyHistory: [
        historicalDiscovery.publicSupportTaxonomy,
        currentDiscovery.publicSupportTaxonomy,
      ],
      realFilesystemFixtureCorpusManifests: uniqueEnvelopesByDigestV1([
        historicalSource.fixtureCorpusManifest,
        currentSource.fixtureCorpusManifest,
      ]),
      realFilesystemSuiteManifests: uniqueEnvelopesByDigestV1([
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
      targetDiscoveryFixtureManifests: uniqueEnvelopesByDigestV1([
        historicalDiscovery.targetDiscoveryFixtureManifest,
        currentDiscovery.targetDiscoveryFixtureManifest,
      ]),
      targetDiscoveryResultHistory: [
        historicalDiscovery.targetDiscoveryResult,
        currentDiscovery.targetDiscoveryResult,
      ],
      targetDiscoveryRunnerRuns: uniqueEnvelopesByDigestV1([
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

function buildHistoricalTipDependencySkewFixtureV1(
  skew: HistoricalTipDependencySkewV1,
): TwoGenerationHistoryFixtureV1 {
  const request = cloneJsonV1(vector.request) as MutableJsonRecordV1;
  const rootMetadataEnvelope = request.rootMetadataHistory.at(-1);
  if (rootMetadataEnvelope === undefined) {
    throw new TypeError("Catalog golden has no active root metadata");
  }
  const targetEntries = cloneJsonV1(
    request.releaseMatrix.payload.targets,
  ) as MutableJsonRecordV1[];
  const source = buildGoldenSourceFixture({
    distributionRootBinding: request.distributionRootBinding,
    rootMetadataEnvelope,
    rootSeedHex: ROOT_3_SEED_HEX,
  }) as MutableJsonRecordV1;
  const baseDiscovery = buildGoldenTargetDiscoveryPointFixture(source, {
    emptyObservationManifests: true,
    targets: targetEntries,
  }) as MutableJsonRecordV1;

  let currentDiscovery = baseDiscovery;
  let taxonomyHistory = [baseDiscovery.publicSupportTaxonomy];
  let matrixHistory = [baseDiscovery.releaseMatrix];
  let discoveryHistory = [baseDiscovery.targetDiscoveryResult];
  if (skew === "matrix_to_taxonomy_tip") {
    currentDiscovery = buildGoldenTargetDiscoveryPointFixture(source, {
      emptyObservationManifests: true,
      predecessorReleaseMatrixContentDigest:
        baseDiscovery.releaseMatrix.contentDigest,
      releaseMatrixGeneration: 2,
      targets: targetEntries,
      taxonomyGeneration: 1,
    }) as MutableJsonRecordV1;
    taxonomyHistory = [currentDiscovery.publicSupportTaxonomy];
    matrixHistory = [
      baseDiscovery.releaseMatrix,
      currentDiscovery.releaseMatrix,
    ];
    discoveryHistory = [currentDiscovery.targetDiscoveryResult];
  } else if (skew === "result_to_taxonomy_and_matrix_tips") {
    currentDiscovery = buildGoldenTargetDiscoveryPointFixture(source, {
      discoveryGeneration: 2,
      emptyObservationManifests: true,
      predecessorDiscoveryContentDigest:
        baseDiscovery.targetDiscoveryResult.contentDigest,
      releaseMatrixGeneration: 1,
      targets: targetEntries,
      taxonomyGeneration: 1,
    }) as MutableJsonRecordV1;
    taxonomyHistory = [currentDiscovery.publicSupportTaxonomy];
    matrixHistory = [currentDiscovery.releaseMatrix];
    discoveryHistory = [
      baseDiscovery.targetDiscoveryResult,
      currentDiscovery.targetDiscoveryResult,
    ];
  }

  const firstUniverse = buildSignedUniverseEnvelope(
    currentDiscovery,
  ) as MutableJsonRecordV1;
  let currentUniverse = firstUniverse;
  let universeHistory = [firstUniverse];
  if (skew === "universe_to_result_tip") {
    currentUniverse = buildSignedUniverseEnvelope(currentDiscovery, {
      predecessorUniverseContentDigest: firstUniverse.contentDigest,
      universeGeneration: 2,
    }) as MutableJsonRecordV1;
    universeHistory = [firstUniverse, currentUniverse];
  }

  const approvalKeys =
    request.providerFeasibilitySupportCatalog.payload.feasibilityApprovalKeys
      .publicKeyRecords as MutableJsonRecordV1[];
  const qaApproverPublicKey = approvalKeys.find(
    (entry) => entry.role === "qa",
  );
  const releaseApproverPublicKey = approvalKeys.find(
    (entry) => entry.role === "release",
  );
  if (
    qaApproverPublicKey === undefined ||
    releaseApproverPublicKey === undefined
  ) {
    throw new TypeError("Catalog golden has no active approval keys");
  }
  const currentCandidates: MutableJsonRecordV1[] = (
    currentUniverse.payload.targets as MutableJsonRecordV1[]
  ).map(
    (entry: MutableJsonRecordV1) =>
      buildProviderFeasibilitySupportCandidateFixture({
        discovery: currentDiscovery as never,
        targetProfileId: entry.target.targetProfileId,
        qaApproverPublicKey: qaApproverPublicKey as never,
        releaseApproverPublicKey: releaseApproverPublicKey as never,
        result: "passed",
        releaseDisposition: "strong_read_write",
        rootSeedHex: ROOT_3_SEED_HEX,
      }) as MutableJsonRecordV1,
  );
  const catalogTargets = currentUniverse.payload.targets.map(
    (entry: MutableJsonRecordV1, index: number) => ({
      target: cloneJsonV1(entry.target),
      candidates: [cloneJsonV1(currentCandidates[index]!.catalogCandidate)],
    }),
  );
  const firstCatalog = buildCatalogGenerationV1(
    request.providerFeasibilitySupportCatalog,
    1,
    undefined,
    currentDiscovery.publicSupportTaxonomy,
    currentUniverse,
    catalogTargets,
  );
  const currentCatalog = skew === "catalog_to_universe_tip"
    ? buildCatalogGenerationV1(
        request.providerFeasibilitySupportCatalog,
        2,
        firstCatalog.contentDigest,
        currentDiscovery.publicSupportTaxonomy,
        currentUniverse,
        catalogTargets,
      )
    : firstCatalog;
  const catalogHistory = skew === "catalog_to_universe_tip"
    ? [firstCatalog, currentCatalog]
    : [currentCatalog];

  return {
    fields: {
      bootstrapTrustBundle: request.bootstrapTrustBundle,
      distributionRootBinding: request.distributionRootBinding,
      installationIdentityGenerationId:
        request.installationIdentityGenerationId,
      providerFeasibilitySupportCandidateArtifacts: currentCandidates.map(
        (candidate) => cloneJsonV1(candidate.candidateArtifact),
      ),
      providerFeasibilitySupportCatalogHistory: catalogHistory,
      publicSupportTaxonomyHistory: taxonomyHistory,
      realFilesystemFixtureCorpusManifests: [source.fixtureCorpusManifest],
      realFilesystemSuiteManifests: [source.suiteManifest],
      registryManifestHistory: request.registryManifestHistory,
      releaseMatrixHistory: matrixHistory,
      releaseTargetUniverseHistory: universeHistory,
      rootMetadataHistory: request.rootMetadataHistory,
      targetDiscoveryFixtureManifests: uniqueEnvelopesByDigestV1(
        discoveryHistory.map((_entry, index) =>
          index === discoveryHistory.length - 1
            ? currentDiscovery.targetDiscoveryFixtureManifest
            : baseDiscovery.targetDiscoveryFixtureManifest
        ),
      ),
      targetDiscoveryResultHistory: discoveryHistory,
      targetDiscoveryRunnerRuns: uniqueEnvelopesByDigestV1(
        discoveryHistory.map((_entry, index) =>
          index === discoveryHistory.length - 1
            ? currentDiscovery.targetDiscoveryRunnerRun
            : baseDiscovery.targetDiscoveryRunnerRun
        ),
      ),
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

function materializeTwoGenerationInputV1(
  fixture: TwoGenerationHistoryFixtureV1,
): Readonly<Record<string, unknown>> {
  const fields = cloneJsonV1(fixture.fields);
  Object.defineProperty(fields, "strictCryptoCapability", {
    configurable: false,
    enumerable: true,
    value: capability,
    writable: false,
  });
  return Object.freeze(fields);
}

const historyCasesV1 = [
  [
    "publicSupportTaxonomyHistory",
    "taxonomyGeneration",
    "predecessorTaxonomyContentDigest",
    "public_support_taxonomy_history",
  ],
  [
    "releaseMatrixHistory",
    "releaseMatrixGeneration",
    "predecessorReleaseMatrixContentDigest",
    "release_matrix_history",
  ],
  [
    "targetDiscoveryResultHistory",
    "discoveryGeneration",
    "predecessorDiscoveryContentDigest",
    "target_discovery_result_history",
  ],
  [
    "releaseTargetUniverseHistory",
    "universeGeneration",
    "predecessorUniverseContentDigest",
    "release_target_universe_history",
  ],
  [
    "providerFeasibilitySupportCatalogHistory",
    "catalogGeneration",
    "predecessorCatalogContentDigest",
    "provider_feasibility_support_catalog_history",
  ],
] as const;

const retainedSourceCasesV1 = [
  "targetDiscoveryFixtureManifests",
  "targetDiscoveryRunnerRuns",
  "realFilesystemSuiteManifests",
  "realFilesystemFixtureCorpusManifests",
] as const;

describe("provider distribution history current-candidate point", () => {
  it("accepts the exact genesis five-chain closure with none-only authority and runs the prepared Catalog once", async () => {
    const input = materializeInputV1();
    expect(Object.keys(input).sort()).toEqual(EXPECTED_RAW_KEYS_V1);
    resetCryptoCountsV1();

    const result =
      await diagnoseProviderDistributionHistoryCurrentCandidatePointV1(input);

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new TypeError("genesis current-candidate rejected");
    expect(EXPECTED_SUCCESS_KEYS_V1).toHaveLength(8);
    expect(Object.keys(result.value).sort()).toEqual(EXPECTED_SUCCESS_KEYS_V1);
    expect(result.value).toMatchObject({
      authority:
        "none_provider_distribution_history_current_candidate_structure_only",
      publicSupportTaxonomyTip: vector.request.publicSupportTaxonomy,
      releaseMatrixTip: vector.request.releaseMatrix,
      targetDiscoveryResultTip: vector.request.targetDiscoveryResult,
      releaseTargetUniverseTip: vector.request.releaseTargetUniverse,
      providerFeasibilitySupportCatalogTip:
        vector.request.providerFeasibilitySupportCatalog,
      currentCatalogProjection: vector.expected.projection,
    });
    expect(
      projectProviderFeasibilitySupportCatalogPointFixtureClosureV1(
        result.value.catalogPointClosure,
      ),
    ).toEqual(vector.expected.projection);
    expectRecursivelyFrozenV1(result);

    const observedCryptoDelta = Object.freeze({
      pointAdmissionCount,
      signatureVerificationCount,
    });
    // Catalog deep validation already verifies all five tips and the tip
    // Bundle/Suite/Corpus closure. Genesis has no non-tip retained object, so
    // the coordinator must add no crypto and must not rerun Registry.
    expect(observedCryptoDelta).toEqual({
      pointAdmissionCount: 31,
      signatureVerificationCount: 64,
    });
  });

  it("accepts a genuine two-generation five-chain history and selects only the generation-2 tips", async () => {
    const fixture = buildTwoGenerationHistoryFixtureV1();
    const input = materializeTwoGenerationInputV1(fixture);
    expect(Object.keys(input).sort()).toEqual(EXPECTED_RAW_KEYS_V1);
    expect(
      fixture.fields.realFilesystemSuiteManifests as unknown[],
    ).toHaveLength(2);
    expect(
      fixture.fields.realFilesystemFixtureCorpusManifests as unknown[],
    ).toHaveLength(2);
    resetCryptoCountsV1();

    const result =
      await diagnoseProviderDistributionHistoryCurrentCandidatePointV1(input);

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new TypeError("two-generation current-candidate rejected");
    expect(Object.keys(result.value).sort()).toEqual(EXPECTED_SUCCESS_KEYS_V1);
    expect(result.value).toMatchObject({
      authority:
        "none_provider_distribution_history_current_candidate_structure_only",
      publicSupportTaxonomyTip: fixture.current.taxonomy,
      releaseMatrixTip: fixture.current.matrix,
      targetDiscoveryResultTip: fixture.current.discovery,
      releaseTargetUniverseTip: fixture.current.universe,
      providerFeasibilitySupportCatalogTip: fixture.current.catalog,
    });
    const projected =
      projectProviderFeasibilitySupportCatalogPointFixtureClosureV1(
        result.value.catalogPointClosure,
      );
    expect(Object.keys(projected).sort()).toEqual(
      EXPECTED_CATALOG_PROJECTION_KEYS_V1,
    );
    expect(result.value.currentCatalogProjection).toEqual(projected);
    expect(projected).toMatchObject({
      authority: "none_provider_feasibility_support_catalog_structure_only",
      ownerTargetCapabilities: vector.expected.projection.ownerTargetCapabilities,
      providerFeasibilitySupportCatalogContentDigest:
        fixture.current.catalog.contentDigest,
      providerFeasibilitySupportCatalogPin: {
        locatorProfile:
          "distribution_provider_feasibility_support_catalog_v1",
        catalogGeneration: 2,
        contentDigest: fixture.current.catalog.contentDigest,
      },
      publicSupport: vector.expected.projection.publicSupport,
      targetCount: 2,
      candidateCount: 2,
      publicSupportRowCount: 1,
    });
    expectRecursivelyFrozenV1(result);

    // The current Catalog deep path stays at the genesis 31/64 baseline.
    // Five non-tip history Envelopes, one non-tip Bundle, one unique old Suite,
    // and one unique old Corpus add exactly eight signature checks and no
    // point admissions.
    expect({ pointAdmissionCount, signatureVerificationCount }).toEqual({
      pointAdmissionCount: 31,
      signatureVerificationCount: 72,
    });
  });

  it("accepts two generations that share an exact retained source closure without double-counting it", async () => {
    const fixture = buildTwoGenerationHistoryFixtureV1("none", "shared");
    const input = materializeTwoGenerationInputV1(fixture);
    const discoveryHistory =
      fixture.fields.targetDiscoveryResultHistory as MutableJsonRecordV1[];
    expect(
      fixture.fields.realFilesystemFixtureCorpusManifests as unknown[],
    ).toHaveLength(1);
    expect(
      fixture.fields.realFilesystemSuiteManifests as unknown[],
    ).toHaveLength(1);
    expect(
      fixture.fields.targetDiscoveryFixtureManifests as unknown[],
    ).toHaveLength(1);
    expect(
      fixture.fields.targetDiscoveryRunnerRuns as unknown[],
    ).toHaveLength(1);
    expect(
      discoveryHistory[0]!.payload.targetDiscoveryInputBundleContentDigest,
    ).not.toBe(
      discoveryHistory[1]!.payload.targetDiscoveryInputBundleContentDigest,
    );
    resetCryptoCountsV1();

    const result =
      await diagnoseProviderDistributionHistoryCurrentCandidatePointV1(input);

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) {
      throw new TypeError("shared-source two-generation candidate rejected");
    }
    expect(Object.keys(result.value).sort()).toEqual(EXPECTED_SUCCESS_KEYS_V1);
    expect(result.value).toMatchObject({
      authority:
        "none_provider_distribution_history_current_candidate_structure_only",
      publicSupportTaxonomyTip: fixture.current.taxonomy,
      releaseMatrixTip: fixture.current.matrix,
      targetDiscoveryResultTip: fixture.current.discovery,
      releaseTargetUniverseTip: fixture.current.universe,
      providerFeasibilitySupportCatalogTip: fixture.current.catalog,
    });
    const projected =
      projectProviderFeasibilitySupportCatalogPointFixtureClosureV1(
        result.value.catalogPointClosure,
      );
    expect(Object.keys(projected).sort()).toEqual(
      EXPECTED_CATALOG_PROJECTION_KEYS_V1,
    );
    expect(result.value.currentCatalogProjection).toEqual(projected);
    expect(projected).toMatchObject({
      providerFeasibilitySupportCatalogContentDigest:
        fixture.current.catalog.contentDigest,
      providerFeasibilitySupportCatalogPin: {
        catalogGeneration: 2,
        contentDigest: fixture.current.catalog.contentDigest,
      },
      ownerTargetCapabilities: vector.expected.projection.ownerTargetCapabilities,
      publicSupport: vector.expected.projection.publicSupport,
      targetCount: 2,
      candidateCount: 2,
      publicSupportRowCount: 1,
    });
    expectRecursivelyFrozenV1(result);

    // The five non-tip history Envelopes and historical Bundle add six checks
    // to 31/64. Exact shared Suite/Corpus bytes are retained once and their
    // signatures are already covered by the current Catalog deep path.
    expect({ pointAdmissionCount, signatureVerificationCount }).toEqual({
      pointAdmissionCount: 31,
      signatureVerificationCount: 70,
    });
  });

  it.each([
    ["matrix_to_taxonomy_tip", 65],
    ["result_to_taxonomy_and_matrix_tips", 66],
    ["universe_to_result_tip", 65],
    ["catalog_to_universe_tip", 65],
  ] as const)(
    "accepts a non-tip %s exact-resolving to a dependency-chain tip without extra crypto",
    async (skew, expectedSignatureVerificationCount) => {
      const fixture = buildHistoricalTipDependencySkewFixtureV1(skew);
      const fields = fixture.fields as Record<string, MutableJsonRecordV1[]>;
      const taxonomyTip = fields.publicSupportTaxonomyHistory!.at(-1)!;
      const matrixTip = fields.releaseMatrixHistory!.at(-1)!;
      const resultTip = fields.targetDiscoveryResultHistory!.at(-1)!;
      const universeTip = fields.releaseTargetUniverseHistory!.at(-1)!;
      if (skew === "matrix_to_taxonomy_tip") {
        expect(
          fields.releaseMatrixHistory![0]!.payload.publicSupportTaxonomy,
        ).toMatchObject(catalogPinV1(taxonomyTip));
      } else if (skew === "result_to_taxonomy_and_matrix_tips") {
        const historicalResult = fields.targetDiscoveryResultHistory![0]!
          .payload;
        expect(historicalResult.publicSupportTaxonomy).toMatchObject(
          catalogPinV1(taxonomyTip),
        );
        expect(
          historicalResult.targetDiscoveryInputBundle.releaseMatrix,
        ).toMatchObject({
          releaseMatrixGeneration: matrixTip.releaseMatrixGeneration,
          contentDigest: matrixTip.contentDigest,
        });
      } else if (skew === "universe_to_result_tip") {
        expect(
          fields.releaseTargetUniverseHistory![0]!.payload.coverageBasis
            .targetDiscoveryResult,
        ).toMatchObject({
          discoveryGeneration: resultTip.discoveryGeneration,
          contentDigest: resultTip.contentDigest,
        });
      } else {
        expect(
          fields.providerFeasibilitySupportCatalogHistory![0]!.payload
            .releaseTargetUniverse,
        ).toMatchObject(universePinV1(universeTip));
      }
      resetCryptoCountsV1();

      const result =
        await diagnoseProviderDistributionHistoryCurrentCandidatePointV1(
          materializeTwoGenerationInputV1(fixture),
        );

      expect(result).toMatchObject({ ok: true });
      expect({ pointAdmissionCount, signatureVerificationCount }).toEqual({
        pointAdmissionCount: 31,
        signatureVerificationCount: expectedSignatureVerificationCount,
      });
    },
  );

  it("rejects a non-tip Bundle signature bitflip under a validly re-signed outer history", async () => {
    const fixture = buildTwoGenerationHistoryFixtureV1("bundle");
    const input = materializeTwoGenerationInputV1(fixture);

    await expect(
      diagnoseProviderDistributionHistoryCurrentCandidatePointV1(input),
    ).resolves.toEqual({
      ok: false,
      stage: "current_source_closure",
      reason: "signature_invalid",
    });
  });

  it.each(["suite", "corpus"] as const)(
    "rejects a historical %s signature bitflip under a validly re-anchored source and outer history",
    async (tamper) => {
      const fixture = buildTwoGenerationHistoryFixtureV1(tamper);
      const input = materializeTwoGenerationInputV1(fixture);

      await expect(
        diagnoseProviderDistributionHistoryCurrentCandidatePointV1(input),
      ).resolves.toEqual({
        ok: false,
        stage: "current_source_closure",
        reason: "signature_invalid",
      });
    },
  );

  it.each([
    ["suite_cases_order", "current_source_closure"],
    ["fixture_record_ordinal", "current_source_closure"],
    ["result_target_count", "target_discovery_result_history"],
    ["universe_discovered_count", "release_target_universe_history"],
    [
      "catalog_target_order",
      "provider_feasibility_support_catalog_history",
    ],
  ] as const)(
    "rejects validly re-signed non-tip %s semantic corruption",
    async (semanticTamper, stage) => {
      const fixture = buildTwoGenerationHistoryFixtureV1(
        "none",
        "distinct",
        semanticTamper,
      );
      const input = materializeTwoGenerationInputV1(fixture);

      await expect(
        diagnoseProviderDistributionHistoryCurrentCandidatePointV1(input),
      ).resolves.toEqual({
        ok: false,
        stage,
        reason: "source_invalid",
      });
    },
  );

  it.each([
    ["activeRoot", vector.request.activeRoot],
    ["current", true],
    ["path", "provider/support-catalog/latest.json"],
  ] as const)(
    "rejects caller-owned %s before crypto",
    async (extraKey, extraValue) => {
      const input = materializeInputV1((fields) => {
        fields[extraKey] = cloneJsonV1(extraValue);
      });
      resetCryptoCountsV1();

      await expect(
        diagnoseProviderDistributionHistoryCurrentCandidatePointV1(input),
      ).resolves.toEqual({
        ok: false,
        stage: "input",
        reason: "schema_invalid",
      });
      expect(pointAdmissionCount).toBe(0);
      expect(signatureVerificationCount).toBe(0);
    },
  );

  it.each(historyCasesV1)(
    "rejects an empty %s",
    async (historyKey, _generationKey, _predecessorKey, stage) => {
      const input = materializeInputV1((fields) => {
        fields[historyKey] = [];
      });
      await expect(
        diagnoseProviderDistributionHistoryCurrentCandidatePointV1(input),
      ).resolves.toEqual({ ok: false, stage, reason: "history_empty" });
    },
  );

  it.each(historyCasesV1)(
    "rejects a non-genesis first entry in %s",
    async (historyKey, generationKey, _predecessorKey, stage) => {
      const input = materializeInputV1((fields) => {
        const envelope = (fields[historyKey] as MutableJsonRecordV1[])[0]!;
        envelope[generationKey] = 2;
        envelope.payload[generationKey] = 2;
      });
      await expect(
        diagnoseProviderDistributionHistoryCurrentCandidatePointV1(input),
      ).resolves.toEqual({
        ok: false,
        stage,
        reason: "generation_not_contiguous",
      });
    },
  );

  it.each(historyCasesV1)(
    "rejects a predecessor on the genesis entry in %s",
    async (historyKey, _generationKey, predecessorKey, stage) => {
      const input = materializeInputV1((fields) => {
        const envelope = (fields[historyKey] as MutableJsonRecordV1[])[0]!;
        envelope.payload[predecessorKey] = GENESIS_PREDECESSOR_DIGEST_V1;
      });
      await expect(
        diagnoseProviderDistributionHistoryCurrentCandidatePointV1(input),
      ).resolves.toEqual({
        ok: false,
        stage,
        reason: "predecessor_digest_mismatch",
      });
    },
  );

  it.each(retainedSourceCasesV1)(
    "rejects a missing retained source in %s",
    async (sourceKey) => {
      const input = materializeInputV1((fields) => {
        fields[sourceKey] = [];
      });
      await expect(
        diagnoseProviderDistributionHistoryCurrentCandidatePointV1(input),
      ).resolves.toEqual({
        ok: false,
        stage: "retained_history_accounting",
        reason: "source_exact_cover_mismatch",
      });
    },
  );

  it.each(retainedSourceCasesV1)(
    "rejects a duplicate retained source in %s",
    async (sourceKey) => {
      const input = materializeInputV1((fields) => {
        const source = (fields[sourceKey] as MutableJsonRecordV1[])[0]!;
        fields[sourceKey] = [source, cloneJsonV1(source)];
      });
      await expect(
        diagnoseProviderDistributionHistoryCurrentCandidatePointV1(input),
      ).resolves.toEqual({
        ok: false,
        stage: "retained_history_accounting",
        reason: "source_exact_cover_mismatch",
      });
    },
  );

  it.each(retainedSourceCasesV1)(
    "rejects an unreferenced extra retained source in %s",
    async (sourceKey) => {
      const input = materializeInputV1((fields) => {
        const source = fields[sourceKey] as MutableJsonRecordV1[];
        const extra = cloneJsonV1(source[0]!);
        extra.contentDigest = UNREFERENCED_SOURCE_DIGEST_V1;
        fields[sourceKey] = [...source, extra];
      });
      await expect(
        diagnoseProviderDistributionHistoryCurrentCandidatePointV1(input),
      ).resolves.toEqual({
        ok: false,
        stage: "retained_history_accounting",
        reason: "source_exact_cover_mismatch",
      });
    },
  );

  it("rejects a validly re-signed Catalog tip that cross-pins another Universe", async () => {
    const input = materializeInputV1((fields) => {
      const history = fields.providerFeasibilitySupportCatalogHistory as
        MutableJsonRecordV1[];
      const catalog = history[0]!;
      catalog.payload.releaseTargetUniverse.contentDigest =
        CROSS_PIN_DIGEST_V1;
      history[0] = resignProviderFeasibilitySupportCatalogEnvelopeFixture(
        catalog as never,
        { rootKeyId: catalog.payload.registryRootKeyId },
      );
    });

    await expect(
      diagnoseProviderDistributionHistoryCurrentCandidatePointV1(input),
    ).resolves.toEqual({
      ok: false,
      stage: "history_pin_closure",
      reason: "pin_mismatch",
    });
  });
});
