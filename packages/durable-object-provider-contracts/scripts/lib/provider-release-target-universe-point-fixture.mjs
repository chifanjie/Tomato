import { createHash, createPrivateKey, sign } from "node:crypto";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../../dist/jcs.js";
import {
  ProviderReleaseTargetUniverseEnvelopeV1Schema,
  ProviderReleaseTargetUniverseV1Schema,
  buildProviderReleaseTargetUniverseRelativePathV1,
  createProviderReleaseTargetUniverseSignatureMessageV1,
  deriveProviderReleaseTargetUniverseContentDigestV1,
} from "../../dist/provider-release-target-universe-point.js";
import {
  ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema,
  ProviderTargetDiscoveryInputBundleV1Schema,
  ProviderTargetDiscoveryResultEnvelopeV1Schema,
  ProviderTargetDiscoveryResultV1Schema,
  ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema,
  createProviderTargetDiscoveryInputBundleSignatureMessageV1,
  createProviderTargetDiscoveryResultSignatureMessageV1,
  deriveProviderPublicSupportProfileIdV1,
  deriveProviderReleaseTargetEntrySetDigestV1,
  deriveProviderTargetDiscoveryFixtureManifestContentDigestV1,
  deriveProviderTargetDiscoveryInputBundleContentDigestV1,
  deriveProviderTargetDiscoveryInputObservationSetDigestV1,
  deriveProviderTargetDiscoveryObservationCutDigestV1,
  deriveProviderTargetDiscoveryObservationKeyDigestV1,
  deriveProviderTargetDiscoveryPrivacySafeObservationClaimsDigestV1,
  deriveProviderTargetDiscoveryResultContentDigestV1,
  deriveProviderTargetDiscoveryRunnerRunManifestContentDigestV1,
  deriveProviderTargetDiscoverySourceManifestRecordSetDigestV1,
  deriveProviderTargetDiscoverySourceObservationSetDigestV1,
  deriveProviderTargetProfileIdV1,
} from "../../dist/provider-target-discovery-point.js";
import {
  INVALID_CASE_IDS as TARGET_DISCOVERY_INVALID_CASE_IDS,
  buildGoldenTargetDiscoveryPointFixture,
  jsonClone,
  materializeInvalidRequest as materializeTargetDiscoveryInvalidRequest,
} from "./provider-target-discovery-point-fixture.mjs";

export const GOLDEN_RESOURCE_PATH =
  "fixtures/v1/golden/provider-release-target-universe-point-v1.json";
export const INVALID_RESOURCE_PATH =
  "fixtures/v1/invalid/provider-release-target-universe-point-v1.json";
export const GOLDEN_SEMANTIC_DOMAIN =
  "provider-release-target-universe-point-golden-manifest-v1";
export const INVALID_SEMANTIC_DOMAIN =
  "provider-release-target-universe-point-invalid-manifest-v1";
export const INVALID_MATERIALIZED_REQUEST_DOMAIN =
  "provider-release-target-universe-point-invalid-materialized-request-v1";
export const INVALID_RECIPE_DIALECT =
  "provider_release_target_universe_point_invalid_recipe_v1";

export const POSITIVE_VECTOR_IDS = Object.freeze([
  "taxonomy-mapping-unresolved",
  "target-discovery-unresolved",
  "release-matrix-incomplete",
  "closed-world-complete",
]);

const ROOT_SIGNATURE_PREFIX =
  "provider-release-target-universe-ed25519";
const WRONG_ROOT_SEED_HEX = "ee".repeat(32);

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

export function digest(character) {
  return `sha256:${character.repeat(64)}`;
}

export function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function privateKeyFromSeedHex(seedHex) {
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.from(seedHex, "hex"),
    ]),
    format: "der",
    type: "pkcs8",
  });
}

function rawSignatureHex(seedHex, message) {
  return sign(
    null,
    Buffer.from(message),
    privateKeyFromSeedHex(seedHex),
  ).toString("hex");
}

function universeSignature(rootKeyId, seedHex, message) {
  return `${ROOT_SIGNATURE_PREFIX}:${rootKeyId}:${rawSignatureHex(
    seedHex,
    message,
  )}`;
}

function rootSignature(prefix, rootKeyId, seedHex, message) {
  return `${prefix}:${rootKeyId}:${rawSignatureHex(seedHex, message)}`;
}

function observation(
  observationSource,
  sourceArtifactContentDigest,
  sourceRecordOrdinal,
  outcome,
) {
  const sourceRecord = {
    observationSource,
    sourceArtifactContentDigest,
    sourceRecordOrdinal,
    outcome: jsonClone(outcome),
  };
  const privacySafeObservationClaimsDigest =
    deriveProviderTargetDiscoveryPrivacySafeObservationClaimsDigestV1(
      sourceRecord,
    );
  return {
    ...sourceRecord,
    privacySafeObservationClaimsDigest,
    observationKeyDigest: deriveProviderTargetDiscoveryObservationKeyDigestV1({
      observationSource,
      sourceArtifactContentDigest,
      sourceRecordOrdinal,
      privacySafeObservationClaimsDigest,
    }),
  };
}

function targetFromFields(fields) {
  const targetFields = {
    osPlatform: fields.osPlatform,
    osReleaseFamilyCode: fields.osReleaseFamilyCode,
    osBuildDigest: fields.osBuildDigest,
    architecture: fields.architecture,
    filesystemProfileCode: fields.filesystemProfileCode,
    filesystemFeatureProfileDigest: fields.filesystemFeatureProfileDigest,
    mountOptionProfileDigest: fields.mountOptionProfileDigest,
  };
  return {
    target: {
      targetProfileId: deriveProviderTargetProfileIdV1(targetFields),
      ...targetFields,
    },
    publicProfileId: deriveProviderPublicSupportProfileIdV1({
      osPlatform: fields.osPlatform,
      osReleaseFamilyCode: fields.osReleaseFamilyCode,
      architecture: fields.architecture,
      filesystemProfileCode: fields.filesystemProfileCode,
    }),
  };
}

function fixturePinFromEnvelope(golden, envelope) {
  const suitePin = envelope.payload.realFilesystemSuiteManifest;
  return {
    locatorProfile: "distribution_provider_real_fs_fixture_manifest_v1",
    realFilesystemSuiteManifest: jsonClone(suitePin),
    realFilesystemSuiteDigest: envelope.payload.realFilesystemSuiteDigest,
    fixtureManifestDigest: envelope.payload.fixtureManifestDigest,
    contentDigest: envelope.contentDigest,
  };
}

function runnerPinFromEnvelope(envelope) {
  const payload = envelope.payload;
  return {
    locatorProfile: "distribution_provider_target_discovery_runner_run_v1",
    producerName: payload.producerName,
    producerVersion: payload.producerVersion,
    implementationDigest: payload.implementationDigest,
    binaryAttestationDigest: payload.binaryAttestationDigest,
    runnerProfileDigest: payload.runnerProfileDigest,
    runManifestContentDigest: envelope.contentDigest,
    releaseRevisionDigest: payload.releaseRevisionDigest,
    executedAt: payload.executedAt,
  };
}

/**
 * Rebuild every Discovery artifact downstream of Fixture/Runner records.  This
 * deliberately uses the normative digest/signature functions rather than
 * rewriting only the final Result, so every positive vector is a genuine
 * C09-1G closure.
 */
export function rebuildTargetDiscoveryFromRecords(
  sourceGolden,
  fixtureRecordsInput,
  runnerRecordsInput,
) {
  const golden = jsonClone(sourceGolden);
  const rootKeyId = golden.activeRoot.rootKeyId;
  const rootSeedHex = golden.deterministicRootSeedHex;
  const fixtureRecords = jsonClone(fixtureRecordsInput);
  const runnerRecords = jsonClone(runnerRecordsInput);

  const fixturePayload = golden.targetDiscoveryFixtureManifest.payload;
  fixturePayload.records = fixtureRecords;
  fixturePayload.targetRecordCount = fixtureRecords.length;
  fixturePayload.targetRecordSetDigest =
    deriveProviderTargetDiscoverySourceManifestRecordSetDigestV1({
      observationSource: "real_filesystem_fixture_manifest",
      entries: fixtureRecords,
    });
  golden.targetDiscoveryFixtureManifest =
    ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_target_discovery_fixture_manifest",
      fixtureManifestDigest: fixturePayload.fixtureManifestDigest,
      contentDigest:
        deriveProviderTargetDiscoveryFixtureManifestContentDigestV1(
          fixturePayload,
        ),
      payload: fixturePayload,
    });

  const runnerPayload = golden.targetDiscoveryRunnerRun.payload;
  runnerPayload.records = runnerRecords;
  runnerPayload.targetRecordCount = runnerRecords.length;
  runnerPayload.targetRecordSetDigest =
    deriveProviderTargetDiscoverySourceManifestRecordSetDigestV1({
      observationSource: "target_discovery_runner",
      entries: runnerRecords,
    });
  golden.targetDiscoveryRunnerRun =
    ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_target_discovery_runner_run",
      contentDigest:
        deriveProviderTargetDiscoveryRunnerRunManifestContentDigestV1(
          runnerPayload,
        ),
      payload: runnerPayload,
    });

  const matrixEnvelope = golden.releaseMatrix;
  const fixtureEnvelope = golden.targetDiscoveryFixtureManifest;
  const runnerEnvelope = golden.targetDiscoveryRunnerRun;
  const fixturePin = fixturePinFromEnvelope(golden, fixtureEnvelope);
  const runnerPin = runnerPinFromEnvelope(runnerEnvelope);
  const bundle = golden.targetDiscoveryResult.payload.targetDiscoveryInputBundle;
  bundle.realFilesystemFixtureManifest = jsonClone(fixturePin);
  bundle.targetDiscoveryRunner = jsonClone(runnerPin);
  bundle.observationCut.realFilesystemFixtureManifest = jsonClone(fixturePin);
  bundle.observationCut.targetDiscoveryRunner = jsonClone(runnerPin);
  bundle.observationCutDigest =
    deriveProviderTargetDiscoveryObservationCutDigestV1(bundle.observationCut);

  const observationsBySource = [
    matrixEnvelope.payload.targets.map((matrixTarget, sourceRecordOrdinal) =>
      observation(
        "signed_release_matrix",
        matrixEnvelope.contentDigest,
        sourceRecordOrdinal,
        { state: "resolved", target: matrixTarget },
      )),
    fixtureRecords.map((record) =>
      observation(
        "real_filesystem_fixture_manifest",
        fixtureEnvelope.contentDigest,
        record.sourceRecordOrdinal,
        record.outcome,
      )),
    runnerRecords.map((record) =>
      observation(
        "target_discovery_runner",
        runnerEnvelope.contentDigest,
        record.sourceRecordOrdinal,
        record.outcome,
      )),
  ];
  const sourceDigests = [
    matrixEnvelope.contentDigest,
    fixtureEnvelope.contentDigest,
    runnerEnvelope.contentDigest,
  ];
  bundle.sourceObservationSets = observationsBySource.map((entries, index) => {
    const observationSource = bundle.observationSources[index];
    const sourceArtifactContentDigest = sourceDigests[index];
    return {
      observationSource,
      sourceArtifactContentDigest,
      observationCount: entries.length,
      observationSetDigest:
        deriveProviderTargetDiscoverySourceObservationSetDigestV1({
          observationSource,
          sourceArtifactContentDigest,
          entries,
        }),
    };
  });
  bundle.observations = observationsBySource.flat();
  bundle.observationCount = bundle.observations.length;
  bundle.observationSetDigest =
    deriveProviderTargetDiscoveryInputObservationSetDigestV1({
      entries: bundle.observations,
    });
  const bundleUnsigned = jsonClone(bundle);
  delete bundleUnsigned.bundleSignature;
  const signedBundle = ProviderTargetDiscoveryInputBundleV1Schema.parse({
    ...bundleUnsigned,
    bundleSignature: rootSignature(
      "provider-target-discovery-input-bundle-ed25519",
      rootKeyId,
      rootSeedHex,
      createProviderTargetDiscoveryInputBundleSignatureMessageV1(
        bundleUnsigned,
        rootKeyId,
      ),
    ),
  });

  const resolvedTargetsById = new Map();
  for (const entry of signedBundle.observations) {
    if (entry.outcome.state !== "resolved") continue;
    const candidate = entry.outcome.target;
    const targetProfileId = candidate.target.targetProfileId;
    const previous = resolvedTargetsById.get(targetProfileId);
    if (
      previous !== undefined &&
      Buffer.compare(
        Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(previous)),
        Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(candidate)),
      ) !== 0
    ) {
      throw new Error(`conflicting target ${targetProfileId} in positive vector`);
    }
    resolvedTargetsById.set(targetProfileId, candidate);
  }
  const targets = [...resolvedTargetsById.values()].sort((left, right) =>
    compareUtf8(left.target.targetProfileId, right.target.targetProfileId),
  );
  const unresolvedObservations = signedBundle.observations
    .filter((entry) => entry.outcome.state === "unresolved")
    .map((entry) => ({
      observationSource: entry.observationSource,
      sourceArtifactContentDigest: entry.sourceArtifactContentDigest,
      sourceRecordOrdinal: entry.sourceRecordOrdinal,
      privacySafeObservationClaimsDigest:
        entry.privacySafeObservationClaimsDigest,
      observationKeyDigest: entry.observationKeyDigest,
      reason: entry.outcome.reason,
    }))
    .sort((left, right) => {
      const sourceOrder = compareUtf8(
        left.observationSource,
        right.observationSource,
      );
      return sourceOrder ||
        compareUtf8(left.observationKeyDigest, right.observationKeyDigest);
    });

  const result = golden.targetDiscoveryResult.payload;
  const resultUnsigned = jsonClone({
    ...result,
    targetDiscoveryInputBundleContentDigest:
      deriveProviderTargetDiscoveryInputBundleContentDigestV1(signedBundle),
    targetDiscoveryInputBundle: signedBundle,
    observationCutDigest: signedBundle.observationCutDigest,
    observationSetDigest: signedBundle.observationSetDigest,
    targetCount: targets.length,
    targetSetDigest: deriveProviderReleaseTargetEntrySetDigestV1({ targets }),
    targets,
    unresolvedObservationCount: unresolvedObservations.length,
    unresolvedObservations,
  });
  delete resultUnsigned.discoverySignature;
  const resultPayload = ProviderTargetDiscoveryResultV1Schema.parse({
    ...resultUnsigned,
    discoverySignature: rootSignature(
      "provider-target-discovery-result-ed25519",
      rootKeyId,
      rootSeedHex,
      createProviderTargetDiscoveryResultSignatureMessageV1(
        resultUnsigned,
        rootKeyId,
      ),
    ),
  });
  golden.targetDiscoveryResult =
    ProviderTargetDiscoveryResultEnvelopeV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_target_discovery_result",
      discoveryGeneration: resultPayload.discoveryGeneration,
      contentDigest:
        deriveProviderTargetDiscoveryResultContentDigestV1(resultPayload),
      payload: resultPayload,
    });

  golden.expected.observationCount = signedBundle.observationCount;
  golden.expected.targetCount = resultPayload.targetCount;
  golden.expected.unresolvedObservationCount =
    resultPayload.unresolvedObservationCount;
  return golden;
}

export function buildTargetDiscoveryPositiveVariant(
  sourceRealFilesystemGolden,
  vectorId,
) {
  if (!POSITIVE_VECTOR_IDS.includes(vectorId)) {
    throw new TypeError(`unknown Universe positive vector ${vectorId}`);
  }
  if (vectorId === "closed-world-complete") {
    return buildGoldenTargetDiscoveryPointFixture(sourceRealFilesystemGolden, {
      emptyObservationManifests: true,
    });
  }
  const base = buildGoldenTargetDiscoveryPointFixture(sourceRealFilesystemGolden);
  if (vectorId === "taxonomy-mapping-unresolved") return base;

  const fixtureRecords = jsonClone(
    base.targetDiscoveryFixtureManifest.payload.records,
  );
  const runnerRecords = jsonClone(
    base.targetDiscoveryRunnerRun.payload.records,
  );
  if (vectorId === "target-discovery-unresolved") {
    fixtureRecords[1].outcome.reason = "observation_source_unavailable";
    return rebuildTargetDiscoveryFromRecords(base, fixtureRecords, runnerRecords);
  }

  const first = base.releaseMatrix.payload.targets[0].target;
  const discoveredOnlyTarget = targetFromFields({
    osPlatform: first.osPlatform,
    osReleaseFamilyCode: first.osReleaseFamilyCode,
    osBuildDigest: digest("a"),
    architecture: first.architecture,
    filesystemProfileCode: first.filesystemProfileCode,
    filesystemFeatureProfileDigest: digest("b"),
    mountOptionProfileDigest: digest("c"),
  });
  fixtureRecords[1].outcome = {
    state: "resolved",
    target: discoveredOnlyTarget,
  };
  runnerRecords[2].outcome = {
    state: "resolved",
    target: jsonClone(base.releaseMatrix.payload.targets[0]),
  };
  return rebuildTargetDiscoveryFromRecords(base, fixtureRecords, runnerRecords);
}

export function deriveCoverageResolution(sourceGolden) {
  const result = sourceGolden.targetDiscoveryResult.payload;
  if (
    result.unresolvedObservations.some(
      (entry) => entry.reason === "taxonomy_mapping_unresolved",
    )
  ) {
    return {
      state: "incomplete",
      reason: "taxonomy_mapping_unresolved",
    };
  }
  if (result.unresolvedObservations.length > 0) {
    return {
      state: "incomplete",
      reason: "target_discovery_unresolved",
    };
  }
  if (
    Buffer.compare(
      Buffer.from(
        canonicalizeJcsSafeIntegerUtf8V1(
          sourceGolden.releaseMatrix.payload.targets,
        ),
      ),
      Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(result.targets)),
    ) !== 0
  ) {
    return {
      state: "incomplete",
      reason: "release_matrix_incomplete",
    };
  }
  return { state: "closed_world_complete" };
}

export function signUniversePayload(
  rawPayload,
  sourceGolden,
  options = {},
) {
  const payload = jsonClone(rawPayload);
  const rootKeyId = options.signatureRootKeyId ?? sourceGolden.activeRoot.rootKeyId;
  const seedHex = options.signerSeedHex ?? sourceGolden.deterministicRootSeedHex;
  payload.universeSignature =
    `${ROOT_SIGNATURE_PREFIX}:${rootKeyId}:${"00".repeat(64)}`;
  const message =
    options.message ??
    createProviderReleaseTargetUniverseSignatureMessageV1(
      payload,
      rootKeyId,
    );
  payload.universeSignature = universeSignature(
    rootKeyId,
    seedHex,
    message,
  );
  return ProviderReleaseTargetUniverseV1Schema.parse(payload);
}

export function buildSignedUniverseEnvelope(sourceGolden, options = {}) {
  const matrixEnvelope = sourceGolden.releaseMatrix;
  const matrix = matrixEnvelope.payload;
  const resultEnvelope = sourceGolden.targetDiscoveryResult;
  const result = resultEnvelope.payload;
  const resolution = deriveCoverageResolution(sourceGolden);
  const groups = new Map();
  for (const entry of result.targets) {
    const entries = groups.get(entry.publicProfileId) ?? [];
    entries.push(entry);
    groups.set(entry.publicProfileId, entries);
  }
  const buckets = [...groups.entries()]
    .sort(([left], [right]) => compareUtf8(left, right))
    .map(([publicProfileId, entries]) => {
      const first = entries[0];
      const coverage = resolution.state === "closed_world_complete"
        ? {
            coverageState: "closed_world_complete",
            targetProfileIds: entries
              .map((entry) => entry.target.targetProfileId)
              .sort(compareUtf8),
          }
        : {
            coverageState: "incomplete",
            reason: resolution.reason,
            targetProfileIds: entries
              .map((entry) => entry.target.targetProfileId)
              .sort(compareUtf8),
          };
      return {
        publicProfileId,
        osPlatform: first.target.osPlatform,
        osReleaseFamilyCode: first.target.osReleaseFamilyCode,
        architecture: first.target.architecture,
        filesystemProfileCode: first.target.filesystemProfileCode,
        coverage,
      };
    });
  const generation = options.universeGeneration ?? 1;
  const unsigned = {
    profile: "provider_release_target_universe_v1",
    distributionRootBinding: jsonClone(sourceGolden.distributionRootBinding),
    activeRootMetadata: jsonClone(sourceGolden.activeRootMetadata),
    registryRootKeyId: sourceGolden.activeRoot.rootKeyId,
    universeGeneration: generation,
    ...(generation === 1
      ? {}
      : {
          predecessorUniverseContentDigest:
            options.predecessorUniverseContentDigest ?? digest("d"),
        }),
    publicSupportTaxonomy: jsonClone(result.publicSupportTaxonomy),
    coverageBasis: {
      profile: "provider_release_target_coverage_basis_v1",
      releaseMatrix: {
        locatorProfile: "distribution_provider_release_matrix_v1",
        releaseMatrixGeneration: matrix.releaseMatrixGeneration,
        contentDigest: matrixEnvelope.contentDigest,
      },
      targetDiscoveryResult: {
        locatorProfile:
          "distribution_provider_target_discovery_result_v1",
        discoveryGeneration: result.discoveryGeneration,
        contentDigest: resultEnvelope.contentDigest,
      },
      targetDiscoveryInputBundleContentDigest:
        result.targetDiscoveryInputBundleContentDigest,
      observationCutDigest: result.observationCutDigest,
      observationSetDigest: result.observationSetDigest,
      limits: jsonClone(result.limits),
      discoveryRulesetVersion: result.discoveryRulesetVersion,
      requiredDimensions: jsonClone(result.requiredDimensions),
      observationSources: jsonClone(result.observationSources),
      releaseMatrixTargetCount: matrix.targetCount,
      releaseMatrixTargetSetDigest: matrix.targetSetDigest,
      discoveredTargetCount: result.targetCount,
      discoveredTargetSetDigest: result.targetSetDigest,
      unresolvedObservationCount: result.unresolvedObservationCount,
      resolution,
    },
    targets: jsonClone(result.targets),
    buckets,
  };
  const payload = signUniversePayload(unsigned, sourceGolden, options);
  return ProviderReleaseTargetUniverseEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_release_target_universe",
    universeGeneration: payload.universeGeneration,
    contentDigest: deriveProviderReleaseTargetUniverseContentDigestV1(payload),
    payload,
  });
}

export function resignAndReanchorUniverseEnvelope(
  envelope,
  sourceGolden,
  options = {},
) {
  const payload = signUniversePayload(envelope.payload, sourceGolden, options);
  return ProviderReleaseTargetUniverseEnvelopeV1Schema.parse({
    ...jsonClone(envelope),
    universeGeneration: payload.universeGeneration,
    contentDigest: deriveProviderReleaseTargetUniverseContentDigestV1(payload),
    payload,
  });
}

export function requestFromSourceAndUniverse(sourceGolden, envelope) {
  return {
    activeRoot: jsonClone(sourceGolden.activeRoot),
    activeRootMetadata: jsonClone(sourceGolden.activeRootMetadata),
    distributionRootBinding: jsonClone(sourceGolden.distributionRootBinding),
    fixtureCorpusManifest: jsonClone(sourceGolden.fixtureCorpusManifest),
    publicSupportTaxonomy: jsonClone(sourceGolden.publicSupportTaxonomy),
    releaseMatrix: jsonClone(sourceGolden.releaseMatrix),
    releaseTargetUniverse: jsonClone(envelope),
    suiteManifest: jsonClone(sourceGolden.suiteManifest),
    targetDiscoveryFixtureManifest: jsonClone(
      sourceGolden.targetDiscoveryFixtureManifest,
    ),
    targetDiscoveryResult: jsonClone(sourceGolden.targetDiscoveryResult),
    targetDiscoveryRunnerRun: jsonClone(
      sourceGolden.targetDiscoveryRunnerRun,
    ),
  };
}

export function projectAcceptedSnapshot(closure) {
  return {
    publicSupportTaxonomyContentDigest:
      closure.targetDiscoveryPointClosure.publicSupportTaxonomy.contentDigest,
    releaseMatrixContentDigest:
      closure.targetDiscoveryPointClosure.releaseMatrix.contentDigest,
    targetDiscoveryResultContentDigest:
      closure.targetDiscoveryPointClosure.targetDiscoveryResult.contentDigest,
    targetDiscoveryInputBundleContentDigest:
      closure.releaseTargetUniverse.payload.coverageBasis
        .targetDiscoveryInputBundleContentDigest,
    releaseMatrixTargetCount:
      closure.releaseTargetUniverse.payload.coverageBasis
        .releaseMatrixTargetCount,
    discoveredTargetCount:
      closure.releaseTargetUniverse.payload.coverageBasis.discoveredTargetCount,
    unresolvedObservationCount:
      closure.releaseTargetUniverse.payload.coverageBasis
        .unresolvedObservationCount,
    universeGeneration:
      closure.releaseTargetUniverse.payload.universeGeneration,
    universeContentDigest: closure.releaseTargetUniverse.contentDigest,
    universeTargetCount: closure.targetCount,
    universeBucketCount: closure.bucketCount,
    coverageResolution: jsonClone(closure.coverageResolution),
    universeRelativePath: closure.relativePath,
  };
}

export function buildPositiveVector(sourceRealFilesystemGolden, vectorId) {
  const source = buildTargetDiscoveryPositiveVariant(
    sourceRealFilesystemGolden,
    vectorId,
  );
  const releaseTargetUniverse = buildSignedUniverseEnvelope(source);
  return {
    vectorId,
    targetDiscoveryPoint: source,
    releaseTargetUniverse,
    expected: {
      authority: "none_release_target_universe_structure_only",
      activeRootPointAdmissionCount: 1,
      signatureVerificationCount: 7,
      coverageResolution: deriveCoverageResolution(source),
      universeContentDigest: releaseTargetUniverse.contentDigest,
      universeRelativePath:
        buildProviderReleaseTargetUniverseRelativePathV1(
          releaseTargetUniverse,
        ),
      universeTargetCount: releaseTargetUniverse.payload.targets.length,
      universeBucketCount: releaseTargetUniverse.payload.buckets.length,
    },
  };
}

export function wrongUniverseSignerSeedHex() {
  return WRONG_ROOT_SEED_HEX;
}

export function bitflipLastHexWire(value) {
  return `${value.slice(0, -1)}${value.endsWith("0") ? "1" : "0"}`;
}

export function wrongUniverseSignatureMessage(label, payload) {
  return canonicalizeJcsSafeIntegerUtf8V1([
    `provider-release-target-universe-hostile-${label}-v1`,
    payload,
  ]);
}

function jsonEqual(left, right) {
  try {
    return Buffer.compare(
      Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(left)),
      Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(right)),
    ) === 0;
  } catch {
    // Invalid fixtures intentionally include values (for example an unsafe
    // integer) that JCS must reject.  Diffing those raw inputs still needs a
    // side-effect-free equality check so the rejection recipe can be frozen.
    return JSON.stringify(left) === JSON.stringify(right);
  }
}

export function setOperation(path, value) {
  return { op: "set", path: [...path], value: jsonClone(value) };
}

export function deleteOperation(path) {
  return { op: "delete", path: [...path] };
}

export function reverseOperation(path) {
  return { op: "reverse", path: [...path] };
}

export function spliceOperation(path, start, deleteCount, items = []) {
  return {
    op: "splice",
    path: [...path],
    start,
    deleteCount,
    items: jsonClone(items),
  };
}

/** Create a deterministic compact JSON patch between two fixture requests. */
export function diffJsonPatchOperations(before, after) {
  const operations = [];
  const visit = (left, right, path) => {
    if (jsonEqual(left, right)) return;
    if (Array.isArray(left) && Array.isArray(right)) {
      if (
        left.length === right.length &&
        left.length > 1 &&
        jsonEqual([...left].reverse(), right)
      ) {
        operations.push(reverseOperation(path));
        return;
      }
      const commonLength = Math.min(left.length, right.length);
      for (let index = 0; index < commonLength; index += 1) {
        visit(left[index], right[index], [...path, index]);
      }
      if (left.length !== right.length) {
        operations.push(
          spliceOperation(
            path,
            commonLength,
            left.length - commonLength,
            right.slice(commonLength),
          ),
        );
      }
      return;
    }
    if (
      left !== null &&
      right !== null &&
      typeof left === "object" &&
      typeof right === "object" &&
      !Array.isArray(left) &&
      !Array.isArray(right)
    ) {
      const leftKeys = Object.keys(left).sort(compareUtf8);
      const rightKeys = Object.keys(right).sort(compareUtf8);
      const rightKeySet = new Set(rightKeys);
      for (const key of leftKeys) {
        if (!rightKeySet.has(key)) {
          operations.push(deleteOperation([...path, key]));
        }
      }
      const leftKeySet = new Set(leftKeys);
      for (const key of rightKeys) {
        if (!leftKeySet.has(key)) {
          operations.push(setOperation([...path, key], right[key]));
        } else {
          visit(left[key], right[key], [...path, key]);
        }
      }
      return;
    }
    operations.push(setOperation(path, right));
  };
  visit(before, after, []);
  return operations;
}

function targetDiscoveryBaseRequest(golden) {
  return {
    distributionRootBinding: jsonClone(golden.distributionRootBinding),
    activeRootMetadata: jsonClone(golden.activeRootMetadata),
    activeRoot: jsonClone(golden.activeRoot),
    fixtureCorpusManifest: jsonClone(golden.fixtureCorpusManifest),
    suiteManifest: jsonClone(golden.suiteManifest),
    publicSupportTaxonomy: jsonClone(golden.publicSupportTaxonomy),
    releaseMatrix: jsonClone(golden.releaseMatrix),
    targetDiscoveryFixtureManifest: jsonClone(
      golden.targetDiscoveryFixtureManifest,
    ),
    targetDiscoveryRunnerRun: jsonClone(golden.targetDiscoveryRunnerRun),
    targetDiscoveryResult: jsonClone(golden.targetDiscoveryResult),
  };
}

function inheritedLocatorOperations(golden, sourceOperation) {
  const operations = [];
  switch (sourceOperation) {
    case "taxonomy-locator-bare-dto":
      return [
        setOperation([], {
          locatorProfile: "distribution_provider_public_support_taxonomy_v1",
          taxonomyGeneration: golden.publicSupportTaxonomy.taxonomyGeneration,
        }),
      ];
    case "matrix-locator-bare-dto":
      return [
        setOperation([], {
          locatorProfile: "distribution_provider_release_matrix_v1",
          releaseMatrixGeneration: golden.releaseMatrix.releaseMatrixGeneration,
        }),
      ];
    case "fixture-locator-bare-digest":
      return [
        setOperation([], {
          contentDigest: golden.targetDiscoveryFixtureManifest.contentDigest,
        }),
      ];
    case "runner-locator-bare-digest":
      return [
        setOperation([], {
          runManifestContentDigest:
            golden.targetDiscoveryRunnerRun.contentDigest,
        }),
      ];
    case "result-locator-bare-dto":
      return [
        setOperation([], {
          locatorProfile:
            "distribution_provider_target_discovery_result_v1",
          discoveryGeneration:
            golden.targetDiscoveryResult.discoveryGeneration,
        }),
      ];
    case "fixture-locator-semantic-digest-substitution":
      operations.push(
        setOperation(
          ["contentDigest"],
          golden.targetDiscoveryFixtureManifest.fixtureManifestDigest,
        ),
      );
      return operations;
    case "fixture-locator-outer-semantic-digest-mismatch":
      operations.push(setOperation(["fixtureManifestDigest"], digest("f")));
      return operations;
    case "runner-locator-semantic-digest-substitution":
      operations.push(
        setOperation(
          ["contentDigest"],
          golden.targetDiscoveryRunnerRun.payload.runnerProfileDigest,
        ),
      );
      return operations;
    case "taxonomy-locator-path-alias":
      operations.push(
        setOperation(
          ["relativePath"],
          "provider/public-support-taxonomy/latest.json",
        ),
      );
      return operations;
    case "matrix-locator-latest-alias":
      operations.push(setOperation(["latest"], true));
      return operations;
    case "result-locator-path-alias":
      operations.push(
        setOperation(
          ["relativePath"],
          "provider/target-discovery-results/latest.json",
        ),
      );
      return operations;
    default:
      throw new TypeError(`unknown inherited locator ${sourceOperation}`);
  }
}

/**
 * Freeze the exact old 116 operations into the new detailed replay dialect.
 * The public inherited recipe remains the smaller D-36 source-operation pair;
 * this tuple is the executable parallel evidence.
 */
export function buildInheritedReplayRecipes(golden) {
  const base = targetDiscoveryBaseRequest(golden);
  return TARGET_DISCOVERY_INVALID_CASE_IDS.map((sourceOperation, index) => {
    let recipe;
    if (index <= 89) {
      const mutated = materializeTargetDiscoveryInvalidRequest(
        golden,
        sourceOperation,
      );
      recipe = {
        kind: "patch",
        operations: diffJsonPatchOperations(base, mutated),
      };
    } else if (index >= 90 && index <= 92) {
      const definitions = {
        "matrix-target-4097": {
          path: ["releaseMatrix", "payload", "targets"],
          countPath: ["releaseMatrix", "payload", "targetCount"],
        },
        "result-target-4097": {
          path: ["targetDiscoveryResult", "payload", "targets"],
          countPath: ["targetDiscoveryResult", "payload", "targetCount"],
        },
        "result-unresolved-4097": {
          path: [
            "targetDiscoveryResult",
            "payload",
            "unresolvedObservations",
          ],
          countPath: [
            "targetDiscoveryResult",
            "payload",
            "unresolvedObservationCount",
          ],
        },
      };
      const definition = definitions[sourceOperation];
      recipe = {
        kind: "repeat",
        path: definition.path,
        sourceIndex: 0,
        count: 4097,
        operations: [setOperation(definition.countPath, 4097)],
        postOperations: [],
      };
    } else if (index >= 93 && index <= 94) {
      const mutated = materializeTargetDiscoveryInvalidRequest(
        golden,
        sourceOperation,
      );
      const path = sourceOperation === "embedded-bundle-16mib-plus-one"
        ? [
            "targetDiscoveryResult",
            "payload",
            "targetDiscoveryInputBundle",
            "targetDiscoveryRunner",
            "producerVersion",
          ]
        : [
            "targetDiscoveryRunnerRun",
            "payload",
            "producerVersion",
          ];
      let value = mutated;
      for (const segment of path) value = value[segment];
      recipe = {
        kind: "padding",
        path,
        prefix: "0.1.0+",
        character: "a",
        codeUnitLength: value.length,
        operations: [],
        postOperations: [],
      };
    } else if (index >= 95 && index <= 105) {
      recipe = {
        kind: "locator_builder",
        profile: `discovery-${sourceOperation}`,
        operations: inheritedLocatorOperations(golden, sourceOperation),
      };
    } else if (index >= 106 && index <= 114) {
      recipe = {
        kind: "hostile_input",
        profile: `discovery-${sourceOperation}`,
      };
    } else if (index === 115) {
      recipe = { kind: "async_mutation", profile: "after_start" };
    } else {
      throw new TypeError(`unclassified inherited case ${sourceOperation}`);
    }
    canonicalizeJcsSafeIntegerUtf8V1(recipe);
    return recipe;
  });
}

function readPath(root, path) {
  let value = root;
  for (const segment of path) value = value[segment];
  return value;
}

function replaceAtPath(root, path, value) {
  if (path.length === 0) return value;
  const parent = readPath(root, path.slice(0, -1));
  parent[path.at(-1)] = value;
  return root;
}

function applyPatchOperations(rootInput, operations) {
  let root = rootInput;
  for (const operation of operations) {
    if (operation.op === "set") {
      root = replaceAtPath(root, operation.path, jsonClone(operation.value));
      continue;
    }
    if (operation.op === "delete") {
      if (operation.path.length === 0) {
        throw new TypeError("cannot delete replay root");
      }
      const parent = readPath(root, operation.path.slice(0, -1));
      delete parent[operation.path.at(-1)];
      continue;
    }
    const target = readPath(root, operation.path);
    if (!Array.isArray(target)) {
      throw new TypeError(`replay ${operation.op} target is not an array`);
    }
    if (operation.op === "reverse") {
      target.reverse();
      continue;
    }
    if (operation.op === "splice") {
      target.splice(
        operation.start,
        operation.deleteCount,
        ...jsonClone(operation.items),
      );
      continue;
    }
    throw new TypeError(`unknown patch operation ${operation.op}`);
  }
  return root;
}

export function applyReplayRecipeForNode(baseInput, recipe) {
  let root = jsonClone(baseInput);
  if (recipe.kind === "patch") {
    return applyPatchOperations(root, recipe.operations);
  }
  if (recipe.kind === "repeat") {
    root = applyPatchOperations(root, recipe.operations);
    const target = readPath(root, recipe.path);
    if (!Array.isArray(target) || target[recipe.sourceIndex] === undefined) {
      throw new TypeError("invalid repeat recipe source");
    }
    const source = target[recipe.sourceIndex];
    root = replaceAtPath(
      root,
      recipe.path,
      Array.from({ length: recipe.count }, () => jsonClone(source)),
    );
    return applyPatchOperations(root, recipe.postOperations);
  }
  if (recipe.kind === "padding") {
    root = applyPatchOperations(root, recipe.operations);
    root = replaceAtPath(
      root,
      recipe.path,
      `${recipe.prefix}${recipe.character.repeat(
        recipe.codeUnitLength - recipe.prefix.length,
      )}`,
    );
    if (recipe.repeat !== undefined) {
      const target = readPath(root, recipe.repeat.path);
      if (
        !Array.isArray(target) ||
        target[recipe.repeat.sourceIndex] === undefined
      ) {
        throw new TypeError("invalid padding repeat source");
      }
      const source = target[recipe.repeat.sourceIndex];
      root = replaceAtPath(
        root,
        recipe.repeat.path,
        Array.from(
          { length: recipe.repeat.count },
          () => jsonClone(source),
        ),
      );
    }
    return applyPatchOperations(root, recipe.postOperations);
  }
  throw new TypeError(`Node cannot materialize ${recipe.kind} replay directly`);
}

export function verifyInheritedReplayRecipesByteIdentical(golden, recipes) {
  if (recipes.length !== TARGET_DISCOVERY_INVALID_CASE_IDS.length) {
    throw new Error("inherited replay recipe count drift");
  }
  const base = targetDiscoveryBaseRequest(golden);
  for (let index = 0; index <= 94; index += 1) {
    const sourceOperation = TARGET_DISCOVERY_INVALID_CASE_IDS[index];
    const expected = materializeTargetDiscoveryInvalidRequest(
      golden,
      sourceOperation,
    );
    const actual = applyReplayRecipeForNode(base, recipes[index]);
    const expectedBytes = canonicalizeJcsSafeIntegerUtf8V1(expected);
    const actualBytes = canonicalizeJcsSafeIntegerUtf8V1(actual);
    if (
      Buffer.compare(Buffer.from(actualBytes), Buffer.from(expectedBytes)) !== 0
    ) {
      throw new Error(
        `inherited ${sourceOperation} replay is not JCS byte-identical`,
      );
    }
  }
}

const POINT_BASE_VECTOR_DEFAULT = "taxonomy-mapping-unresolved";
const UNIVERSE_TOTAL_STRING_LIMIT = 16_777_216;
const REANCHOR_POINT_CASE_IDS = new Set([
  "universe-generation-one-with-predecessor",
  "universe-generation-two-without-predecessor",
  "universe-distribution-binding-mismatch",
  "universe-distribution-active-root-compound",
  "universe-active-root-metadata-mismatch",
  "universe-registry-root-key-id-mismatch",
  "universe-active-root-taxonomy-compound",
  "universe-taxonomy-pin-generation-mismatch",
  "universe-taxonomy-pin-digest-mismatch",
  "universe-matrix-pin-generation-mismatch",
  "universe-matrix-discovery-pin-compound",
  "universe-discovery-pin-digest-mismatch",
  "coverage-limits-profile-mismatch",
  "coverage-limit-target-entries-mismatch",
  "coverage-limit-union-targets-mismatch",
  "coverage-limit-unresolved-mismatch",
  "coverage-limit-envelope-bytes-mismatch",
  "coverage-ruleset-mismatch",
  "coverage-required-dimension-os-platform-mismatch",
  "coverage-required-dimension-os-release-family-mismatch",
  "coverage-required-dimension-os-build-mismatch",
  "coverage-required-dimension-architecture-mismatch",
  "coverage-required-dimension-filesystem-profile-mismatch",
  "coverage-required-dimension-filesystem-feature-mismatch",
  "coverage-required-dimension-mount-option-mismatch",
  "coverage-observation-source-matrix-mismatch",
  "coverage-observation-source-fixture-mismatch",
  "coverage-observation-source-runner-mismatch",
  "coverage-bundle-digest-mismatch",
  "coverage-observation-cut-digest-mismatch",
  "coverage-observation-set-digest-mismatch",
  "coverage-limits-before-digest-compound",
  "coverage-dimension-before-source-compound",
  "coverage-sources-before-bundle-digest-compound",
  "coverage-matrix-count-mismatch",
  "coverage-matrix-set-digest-mismatch",
  "coverage-discovered-count-mismatch",
  "coverage-discovered-set-digest-mismatch",
  "coverage-unresolved-count-mismatch",
  "coverage-matrix-count-before-digest-compound",
  "coverage-matrix-digest-before-discovered-count-compound",
  "coverage-discovered-count-before-digest-compound",
  "coverage-discovered-digest-before-unresolved-count-compound",
  "universe-target-order-reversed",
  "universe-target-duplicate",
  "universe-target-missing",
  "universe-target-extra",
  "universe-target-public-id-substitution",
  "universe-target-private-fields-substitution",
  "universe-target-order-before-count-compound",
  "universe-target-count-before-coverage-compound",
  "resolution-taxonomy-to-target-discovery",
  "resolution-taxonomy-to-release-matrix",
  "resolution-target-discovery-to-taxonomy",
  "resolution-release-matrix-to-target-discovery",
  "resolution-closed-world-to-incomplete",
  "universe-bucket-order-reversed",
  "universe-bucket-duplicate",
  "universe-bucket-target-id-order-reversed",
  "universe-bucket-target-id-duplicate",
  "universe-bucket-public-id-mismatch",
  "universe-bucket-os-platform-mismatch",
  "universe-bucket-os-family-mismatch",
  "universe-bucket-architecture-mismatch",
  "universe-bucket-filesystem-profile-mismatch",
  "universe-bucket-partition-missing",
  "universe-bucket-partition-extra",
  "universe-bucket-partition-duplicate-across-buckets",
  "universe-bucket-wrong-membership",
  "universe-bucket-incomplete-state-mismatch",
  "universe-bucket-incomplete-reason-mismatch",
  "universe-bucket-complete-state-mismatch",
  "universe-bucket-order-before-mapping-compound",
  "universe-bucket-mapping-before-partition-compound",
]);

function positiveVectorById(golden, vectorId) {
  const vector = golden.positiveVectors.find(
    (candidate) => candidate.vectorId === vectorId,
  );
  if (vector === undefined) {
    throw new TypeError(`missing Universe positive vector ${vectorId}`);
  }
  return vector;
}

function sourceGoldenFromPointRequest(golden, request) {
  return {
    deterministicRootSeedHex: golden.deterministicRootSeedHex,
    activeRoot: request.activeRoot,
    activeRootMetadata: request.activeRootMetadata,
    distributionRootBinding: request.distributionRootBinding,
    fixtureCorpusManifest: request.fixtureCorpusManifest,
    publicSupportTaxonomy: request.publicSupportTaxonomy,
    releaseMatrix: request.releaseMatrix,
    suiteManifest: request.suiteManifest,
    targetDiscoveryFixtureManifest: request.targetDiscoveryFixtureManifest,
    targetDiscoveryResult: request.targetDiscoveryResult,
    targetDiscoveryRunnerRun: request.targetDiscoveryRunnerRun,
  };
}

function mutateAndPatch(baseRequest, mutation) {
  const mutated = jsonClone(baseRequest);
  mutation(mutated);
  return {
    kind: "patch",
    operations: diffJsonPatchOperations(baseRequest, mutated),
  };
}

function stringCodeUnitTotal(value) {
  if (typeof value === "string") return value.length;
  if (value === null || typeof value !== "object") return 0;
  let total = 0;
  if (Array.isArray(value)) {
    for (const entry of value) total += stringCodeUnitTotal(entry);
    return total;
  }
  for (const entry of Object.values(value)) {
    total += stringCodeUnitTotal(entry);
  }
  return total;
}

function buildAggregateStringRecipe(baseRequest, targetCodeUnits) {
  const universe = baseRequest.releaseTargetUniverse;
  const ids = universe.payload.buckets[0].coverage.targetProfileIds;
  const otherCoverageIdCount = universe.payload.buckets
    .slice(1)
    .reduce(
      (count, candidate) =>
        count + candidate.coverage.targetProfileIds.length,
      0,
    );
  const repeatCount = 4096 - otherCoverageIdCount;
  const originalId = ids[0];
  const originalSignature = universe.payload.universeSignature;
  const fixedCodeUnits =
    stringCodeUnitTotal(universe) - originalId.length - originalSignature.length;
  let idLength = Math.floor(
    (targetCodeUnits - fixedCodeUnits - 1) / repeatCount,
  );
  let signatureLength =
    targetCodeUnits - fixedCodeUnits - (repeatCount * idLength);
  while (signatureLength > 4096 && idLength < 4096) {
    idLength += 1;
    signatureLength -= repeatCount;
  }
  if (
    idLength < "provider-target-profile:".length ||
    idLength > 4096 ||
    signatureLength < 1 ||
    signatureLength > 4096
  ) {
    throw new Error("aggregate string replay cannot reach requested boundary");
  }
  const recipe = {
    kind: "padding",
    operations: [],
    path: [
      "releaseTargetUniverse",
      "payload",
      "buckets",
      0,
      "coverage",
      "targetProfileIds",
      0,
    ],
    prefix: "provider-target-profile:",
    character: "a",
    codeUnitLength: idLength,
    repeat: {
      path: [
        "releaseTargetUniverse",
        "payload",
        "buckets",
        0,
        "coverage",
        "targetProfileIds",
      ],
      sourceIndex: 0,
      count: repeatCount,
    },
    postOperations: [
      setOperation(
        ["releaseTargetUniverse", "payload", "universeSignature"],
        "x".repeat(signatureLength),
      ),
    ],
  };
  const materialized = applyReplayRecipeForNode(baseRequest, recipe);
  const actual = stringCodeUnitTotal(materialized.releaseTargetUniverse);
  if (actual !== targetCodeUnits) {
    throw new Error(
      `aggregate string replay reached ${actual}, expected ${targetCodeUnits}`,
    );
  }
  return recipe;
}

export function baseVectorIdForPointCase(caseId) {
  switch (caseId) {
    case "resolution-target-discovery-to-taxonomy":
      return "target-discovery-unresolved";
    case "resolution-release-matrix-to-target-discovery":
      return "release-matrix-incomplete";
    case "resolution-closed-world-to-incomplete":
    case "universe-bucket-complete-state-mismatch":
      return "closed-world-complete";
    case "universe-bucket-target-id-order-reversed":
    case "universe-bucket-partition-missing":
      return "release-matrix-incomplete";
    default:
      return POINT_BASE_VECTOR_DEFAULT;
  }
}

function repeatRecipe(path, count, operations = [], postOperations = []) {
  return {
    kind: "repeat",
    operations,
    path,
    sourceIndex: 0,
    count,
    postOperations,
  };
}

function paddingRecipe(path, codeUnitLength, prefix = "", character = "a") {
  return {
    kind: "padding",
    operations: [],
    path,
    prefix,
    character,
    codeUnitLength,
    postOperations: [],
  };
}

function pointLocatorRecipe(caseId, baseRequest) {
  const envelope = baseRequest.releaseTargetUniverse;
  let operations = [];
  switch (caseId) {
    case "universe-locator-bare-pin":
      operations = [
        setOperation([], {
          locatorProfile: "distribution_provider_release_target_universe_v1",
          universeGeneration: envelope.universeGeneration,
          contentDigest: envelope.contentDigest,
        }),
      ];
      break;
    case "universe-locator-path-alias":
      operations = [
        setOperation(
          ["relativePath"],
          "provider/release-target-universe/latest.json",
        ),
      ];
      break;
    case "universe-locator-latest-alias":
      operations = [setOperation(["latest"], true)];
      break;
    case "universe-locator-generation-mismatch":
      operations = [setOperation(["universeGeneration"], 2)];
      break;
    case "universe-locator-digest-mismatch":
      operations = [setOperation(["contentDigest"], digest("f"))];
      break;
    case "universe-locator-ordinary-accessor":
    case "universe-locator-top-level-proxy":
    case "universe-locator-nested-proxy":
    case "universe-locator-self-removing-proxy":
    case "universe-locator-get-only-proxy":
    case "universe-locator-structured-clone-replacement":
    case "universe-locator-array-push-pollution":
    case "universe-locator-inherited-index-setter":
    case "universe-locator-sequential-pollution":
      break;
    default:
      throw new TypeError(`unknown Universe locator case ${caseId}`);
  }
  return { kind: "locator_builder", profile: caseId, operations };
}

function pointSpecialRecipe(caseId, baseRequest) {
  switch (caseId) {
    case "point-input-plain-validation-dto":
      return {
        kind: "patch",
        operations: [
          setOperation([], {
            authority: "none_release_target_universe_structure_only",
            targetCount:
              baseRequest.releaseTargetUniverse.payload.targets.length,
            bucketCount:
              baseRequest.releaseTargetUniverse.payload.buckets.length,
          }),
        ],
      };
    case "point-input-fake-capability":
    case "point-input-fake-capability-getter":
    case "point-input-fake-capability-proxy":
    case "point-security-top-level-proxy":
    case "point-security-universe-proxy":
    case "point-security-universe-nested-proxy":
    case "point-security-universe-self-removing-proxy":
    case "point-security-top-level-getter":
    case "point-security-universe-getter":
    case "point-security-universe-nested-getter":
    case "point-security-top-level-hidden":
    case "point-security-universe-nested-hidden":
    case "point-security-top-level-symbol":
    case "point-security-universe-nested-symbol":
    case "point-security-universe-sparse-targets":
    case "point-security-universe-sparse-buckets":
    case "point-security-universe-sparse-bucket-target-ids":
    case "point-security-universe-cycle":
    case "point-security-universe-alias":
    case "point-security-universe-to-inherited-alias":
    case "point-security-inherited-to-universe-alias":
    case "point-security-object-prototype-then":
    case "point-security-promise-primordials":
    case "universe-generation-fractional":
    case "universe-generation-unsafe":
      return { kind: "hostile_input", profile: caseId };
    case "point-input-universe-target-4097":
      return repeatRecipe(
        ["releaseTargetUniverse", "payload", "targets"],
        4097,
      );
    case "point-input-universe-bucket-4097":
      return repeatRecipe(
        ["releaseTargetUniverse", "payload", "buckets"],
        4097,
      );
    case "point-input-bucket-target-id-4097":
      return repeatRecipe(
        [
          "releaseTargetUniverse",
          "payload",
          "buckets",
          0,
          "coverage",
          "targetProfileIds",
        ],
        4097,
      );
    case "point-input-total-bucket-target-id-4097":
      return repeatRecipe(
        [
          "releaseTargetUniverse",
          "payload",
          "buckets",
          0,
          "coverage",
          "targetProfileIds",
        ],
        4096,
      );
    case "point-input-string-4097":
      return paddingRecipe(
        ["releaseTargetUniverse", "payload", "universeSignature"],
        4097,
      );
    case "point-input-string-4096-reaches-structure":
      return paddingRecipe(
        ["releaseTargetUniverse", "payload", "universeSignature"],
        4096,
      );
    case "point-input-aggregate-string-cap-reaches-structure":
      return buildAggregateStringRecipe(
        baseRequest,
        UNIVERSE_TOTAL_STRING_LIMIT,
      );
    case "point-input-aggregate-string-cap-plus-one":
      return buildAggregateStringRecipe(
        baseRequest,
        UNIVERSE_TOTAL_STRING_LIMIT + 1,
      );
    case "universe-locator-bare-pin":
    case "universe-locator-path-alias":
    case "universe-locator-latest-alias":
    case "universe-locator-generation-mismatch":
    case "universe-locator-digest-mismatch":
    case "universe-locator-ordinary-accessor":
    case "universe-locator-top-level-proxy":
    case "universe-locator-nested-proxy":
    case "universe-locator-self-removing-proxy":
    case "universe-locator-get-only-proxy":
    case "universe-locator-structured-clone-replacement":
    case "universe-locator-array-push-pollution":
    case "universe-locator-inherited-index-setter":
    case "universe-locator-sequential-pollution":
      return pointLocatorRecipe(caseId, baseRequest);
    case "point-security-universe-after-start-mutation":
      return { kind: "async_mutation", profile: "after_start" };
    case "point-security-universe-crypto-host-mutation":
      return { kind: "async_mutation", profile: "crypto_host" };
    default:
      return undefined;
  }
}

function mutatePointJsonRequest(request, caseId, golden) {
  const envelope = request.releaseTargetUniverse;
  const universe = envelope.payload;
  const coverage = universe.coverageBasis;
  const bucket = universe.buckets[0];
  const wrongRootKeyId = "f".repeat(22);
  const validUnknownTargetId = `provider-target-profile:${"0".repeat(64)}`;
  const validUnknownPublicId =
    `provider-public-support-profile:${"f".repeat(64)}`;
  const sourceGolden = sourceGoldenFromPointRequest(golden, request);
  switch (caseId) {
    case "point-input-extra-field":
      request.unexpected = true;
      break;
    case "point-input-missing-universe":
      delete request.releaseTargetUniverse;
      break;
    case "point-input-caller-universe-pin":
      request.releaseTargetUniverse = {
        locatorProfile: "distribution_provider_release_target_universe_v1",
        universeGeneration: envelope.universeGeneration,
        contentDigest: envelope.contentDigest,
      };
      break;
    case "point-input-caller-universe-locator":
      request.releaseTargetUniverse =
        buildProviderReleaseTargetUniverseRelativePathV1(envelope);
      break;
    case "point-input-caller-current-flag":
      request.current = true;
      break;
    case "point-input-targets-wrong-container":
      universe.targets = {};
      break;
    case "point-input-buckets-wrong-container":
      universe.buckets = {};
      break;
    case "point-input-coverage-wrong-container":
      bucket.coverage = [];
      break;
    case "point-input-target-ids-wrong-container":
      bucket.coverage.targetProfileIds = {};
      break;
    case "point-input-bucket-private-build-digest":
      bucket.osBuildDigest = digest("f");
      break;
    case "point-input-bucket-private-raw-path":
      bucket.rawPath = "/private/provider-target";
      break;
    case "point-input-bucket-private-environment-fields":
      bucket.environment = { hostname: "fixture-host" };
      break;
    case "point-input-universe-distribution-binding-extra-field":
      universe.distributionRootBinding.unexpected = true;
      break;
    case "point-input-universe-distribution-binding-wrong-container":
      universe.distributionRootBinding = [];
      break;
    case "point-input-universe-active-root-metadata-extra-field":
      universe.activeRootMetadata.unexpected = true;
      break;
    case "point-input-universe-active-root-metadata-wrong-container":
      universe.activeRootMetadata = [];
      break;
    case "point-input-universe-bootstrap-trust-bundle-extra-field":
      universe.distributionRootBinding.bootstrapTrustBundle.unexpected = true;
      break;
    case "point-input-universe-bootstrap-trust-bundle-wrong-container":
      universe.distributionRootBinding.bootstrapTrustBundle = [];
      break;
    case "point-input-universe-history-policy-extra-field":
      universe.distributionRootBinding.historyPolicy.unexpected = true;
      break;
    case "point-input-universe-history-policy-wrong-container":
      universe.distributionRootBinding.historyPolicy = [];
      break;
    case "universe-envelope-schema-version-invalid":
      envelope.schemaVersion = 2;
      break;
    case "universe-envelope-record-type-invalid":
      envelope.recordType = "provider_release_target_universe_latest";
      break;
    case "universe-envelope-generation-zero":
      envelope.universeGeneration = 0;
      break;
    case "universe-profile-invalid":
      universe.profile = "provider_release_target_universe_latest";
      break;
    case "universe-registry-root-key-id-invalid":
      universe.registryRootKeyId = "invalid-root";
      break;
    case "universe-generation-zero":
      universe.universeGeneration = 0;
      break;
    case "universe-generation-fractional":
      universe.universeGeneration = 1.5;
      break;
    case "universe-generation-unsafe":
      universe.universeGeneration = Number.MAX_SAFE_INTEGER + 1;
      break;
    case "universe-predecessor-digest-invalid":
      universe.predecessorUniverseContentDigest = "sha256:invalid";
      break;
    case "universe-taxonomy-pin-profile-invalid":
      universe.publicSupportTaxonomy.locatorProfile = "invalid";
      break;
    case "universe-coverage-profile-invalid":
      coverage.profile = "invalid";
      break;
    case "universe-release-matrix-pin-profile-invalid":
      coverage.releaseMatrix.locatorProfile = "invalid";
      break;
    case "universe-target-discovery-pin-profile-invalid":
      coverage.targetDiscoveryResult.locatorProfile = "invalid";
      break;
    case "universe-resolution-state-invalid":
      coverage.resolution = { state: "invalid" };
      break;
    case "universe-target-entry-invalid":
      universe.targets[0].target.targetProfileId = "invalid";
      break;
    case "universe-bucket-public-profile-id-invalid":
      bucket.publicProfileId = "invalid";
      break;
    case "universe-generation-one-with-predecessor":
      universe.predecessorUniverseContentDigest = digest("d");
      break;
    case "universe-generation-two-without-predecessor":
      universe.universeGeneration = 2;
      envelope.universeGeneration = 2;
      break;
    case "universe-distribution-binding-mismatch":
      universe.distributionRootBinding.releaseRevisionDigest = digest("f");
      break;
    case "universe-distribution-active-root-compound":
      universe.distributionRootBinding.releaseRevisionDigest = digest("f");
      universe.activeRootMetadata.contentDigest = digest("e");
      break;
    case "universe-active-root-metadata-mismatch":
      universe.activeRootMetadata.contentDigest = digest("f");
      break;
    case "universe-registry-root-key-id-mismatch":
      universe.registryRootKeyId = wrongRootKeyId;
      break;
    case "universe-active-root-taxonomy-compound":
      universe.activeRootMetadata.contentDigest = digest("f");
      universe.publicSupportTaxonomy.contentDigest = digest("e");
      break;
    case "universe-taxonomy-pin-generation-mismatch":
      universe.publicSupportTaxonomy.taxonomyGeneration += 1;
      break;
    case "universe-taxonomy-pin-digest-mismatch":
      universe.publicSupportTaxonomy.contentDigest = digest("f");
      break;
    case "universe-matrix-pin-generation-mismatch":
      coverage.releaseMatrix.releaseMatrixGeneration += 1;
      break;
    case "universe-matrix-discovery-pin-compound":
      coverage.releaseMatrix.contentDigest = digest("f");
      coverage.targetDiscoveryResult.contentDigest = digest("e");
      break;
    case "universe-discovery-pin-digest-mismatch":
      coverage.targetDiscoveryResult.contentDigest = digest("f");
      break;
    case "coverage-limits-profile-mismatch":
      coverage.limits.profile =
        "provider_release_coverage_artifact_limits_v2";
      break;
    case "coverage-limit-target-entries-mismatch":
      coverage.limits.maxTargetEntriesPerArtifact = 4095;
      break;
    case "coverage-limit-union-targets-mismatch":
      coverage.limits.maxCanonicalUnionTargetEntries = 4095;
      break;
    case "coverage-limit-unresolved-mismatch":
      coverage.limits.maxUnresolvedObservationsPerDiscoveryResult = 4095;
      break;
    case "coverage-limit-envelope-bytes-mismatch":
      coverage.limits.maxCanonicalEnvelopeBytes = 16_777_215;
      break;
    case "coverage-ruleset-mismatch":
      coverage.discoveryRulesetVersion = "provider_release_target_discovery_v2";
      break;
    case "coverage-required-dimension-os-platform-mismatch":
      coverage.requiredDimensions[0] = "architecture";
      break;
    case "coverage-required-dimension-os-release-family-mismatch":
      coverage.requiredDimensions[1] = "architecture";
      break;
    case "coverage-required-dimension-os-build-mismatch":
      coverage.requiredDimensions[2] = "architecture";
      break;
    case "coverage-required-dimension-architecture-mismatch":
      coverage.requiredDimensions[3] = "osBuildDigest";
      break;
    case "coverage-required-dimension-filesystem-profile-mismatch":
      coverage.requiredDimensions[4] = "architecture";
      break;
    case "coverage-required-dimension-filesystem-feature-mismatch":
      coverage.requiredDimensions[5] = "architecture";
      break;
    case "coverage-required-dimension-mount-option-mismatch":
      coverage.requiredDimensions[6] = "architecture";
      break;
    case "coverage-observation-source-matrix-mismatch":
      coverage.observationSources[0] = "target_discovery_runner";
      break;
    case "coverage-observation-source-fixture-mismatch":
      coverage.observationSources[1] = "target_discovery_runner";
      break;
    case "coverage-observation-source-runner-mismatch":
      coverage.observationSources[2] = "signed_release_matrix";
      break;
    case "coverage-bundle-digest-mismatch":
      coverage.targetDiscoveryInputBundleContentDigest = digest("f");
      break;
    case "coverage-observation-cut-digest-mismatch":
      coverage.observationCutDigest = digest("f");
      break;
    case "coverage-observation-set-digest-mismatch":
      coverage.observationSetDigest = digest("f");
      break;
    case "coverage-limits-before-digest-compound":
      coverage.limits.maxTargetEntriesPerArtifact = 4095;
      coverage.observationCutDigest = digest("f");
      break;
    case "coverage-dimension-before-source-compound":
      coverage.requiredDimensions[0] = "architecture";
      coverage.observationSources[0] = "target_discovery_runner";
      break;
    case "coverage-sources-before-bundle-digest-compound":
      coverage.observationSources[0] = "target_discovery_runner";
      coverage.targetDiscoveryInputBundleContentDigest = digest("f");
      break;
    case "coverage-matrix-count-mismatch":
      coverage.releaseMatrixTargetCount += 1;
      break;
    case "coverage-matrix-set-digest-mismatch":
      coverage.releaseMatrixTargetSetDigest = digest("f");
      break;
    case "coverage-discovered-count-mismatch":
      coverage.discoveredTargetCount += 1;
      break;
    case "coverage-discovered-set-digest-mismatch":
      coverage.discoveredTargetSetDigest = digest("f");
      break;
    case "coverage-unresolved-count-mismatch":
      coverage.unresolvedObservationCount += 1;
      break;
    case "coverage-matrix-count-before-digest-compound":
      coverage.releaseMatrixTargetCount += 1;
      coverage.releaseMatrixTargetSetDigest = digest("f");
      break;
    case "coverage-matrix-digest-before-discovered-count-compound":
      coverage.releaseMatrixTargetSetDigest = digest("f");
      coverage.discoveredTargetCount += 1;
      break;
    case "coverage-discovered-count-before-digest-compound":
      coverage.discoveredTargetCount += 1;
      coverage.discoveredTargetSetDigest = digest("f");
      break;
    case "coverage-discovered-digest-before-unresolved-count-compound":
      coverage.discoveredTargetSetDigest = digest("f");
      coverage.unresolvedObservationCount += 1;
      break;
    case "universe-target-order-reversed":
      universe.targets.reverse();
      break;
    case "universe-target-duplicate":
      universe.targets[1] = jsonClone(universe.targets[0]);
      break;
    case "universe-target-missing":
      universe.targets.splice(0, 1);
      break;
    case "universe-target-extra": {
      const extra = jsonClone(universe.targets[0]);
      extra.target.targetProfileId = validUnknownTargetId;
      universe.targets.push(extra);
      universe.targets.sort((left, right) =>
        compareUtf8(left.target.targetProfileId, right.target.targetProfileId),
      );
      break;
    }
    case "universe-target-public-id-substitution":
      universe.targets[0].publicProfileId = validUnknownPublicId;
      break;
    case "universe-target-private-fields-substitution":
      universe.targets[0].target.osBuildDigest = digest("f");
      break;
    case "universe-target-order-before-count-compound": {
      universe.targets.reverse();
      universe.targets.push(jsonClone(universe.targets[0]));
      break;
    }
    case "universe-target-count-before-coverage-compound": {
      const extra = jsonClone(universe.targets[0]);
      extra.target.targetProfileId = validUnknownTargetId;
      universe.targets.push(extra);
      universe.targets.sort((left, right) =>
        compareUtf8(left.target.targetProfileId, right.target.targetProfileId),
      );
      universe.targets[0].publicProfileId = validUnknownPublicId;
      break;
    }
    case "resolution-taxonomy-to-target-discovery":
      coverage.resolution = {
        state: "incomplete",
        reason: "target_discovery_unresolved",
      };
      break;
    case "resolution-taxonomy-to-release-matrix":
      coverage.resolution = {
        state: "incomplete",
        reason: "release_matrix_incomplete",
      };
      break;
    case "resolution-target-discovery-to-taxonomy":
      coverage.resolution = {
        state: "incomplete",
        reason: "taxonomy_mapping_unresolved",
      };
      break;
    case "resolution-release-matrix-to-target-discovery":
      coverage.resolution = {
        state: "incomplete",
        reason: "target_discovery_unresolved",
      };
      break;
    case "resolution-closed-world-to-incomplete":
      coverage.resolution = {
        state: "incomplete",
        reason: "target_discovery_unresolved",
      };
      break;
    case "universe-bucket-order-reversed":
      universe.buckets.reverse();
      break;
    case "universe-bucket-duplicate":
      universe.buckets[1] = jsonClone(universe.buckets[0]);
      break;
    case "universe-bucket-target-id-order-reversed":
      bucket.coverage.targetProfileIds.reverse();
      break;
    case "universe-bucket-target-id-duplicate":
      bucket.coverage.targetProfileIds.push(
        bucket.coverage.targetProfileIds[0],
      );
      break;
    case "universe-bucket-public-id-mismatch":
      universe.buckets.at(-1).publicProfileId = validUnknownPublicId;
      break;
    case "universe-bucket-os-platform-mismatch":
      bucket.osPlatform = bucket.osPlatform === "darwin" ? "linux" : "darwin";
      break;
    case "universe-bucket-os-family-mismatch":
      bucket.osReleaseFamilyCode = universe.buckets[1].osReleaseFamilyCode;
      break;
    case "universe-bucket-architecture-mismatch":
      bucket.architecture = bucket.architecture === "arm64" ? "x86_64" : "arm64";
      break;
    case "universe-bucket-filesystem-profile-mismatch":
      bucket.filesystemProfileCode = universe.buckets[1].filesystemProfileCode;
      break;
    case "universe-bucket-partition-missing":
      bucket.coverage.targetProfileIds.splice(0, 1);
      break;
    case "universe-bucket-partition-extra":
      bucket.coverage.targetProfileIds.push(validUnknownTargetId);
      bucket.coverage.targetProfileIds.sort(compareUtf8);
      break;
    case "universe-bucket-partition-duplicate-across-buckets":
      universe.buckets[1].coverage.targetProfileIds.push(
        bucket.coverage.targetProfileIds[0],
      );
      universe.buckets[1].coverage.targetProfileIds.sort(compareUtf8);
      break;
    case "universe-bucket-wrong-membership": {
      const firstId = bucket.coverage.targetProfileIds[0];
      bucket.coverage.targetProfileIds[0] =
        universe.buckets[1].coverage.targetProfileIds[0];
      universe.buckets[1].coverage.targetProfileIds[0] = firstId;
      break;
    }
    case "universe-bucket-incomplete-state-mismatch":
      bucket.coverage = {
        coverageState: "closed_world_complete",
        targetProfileIds: jsonClone(bucket.coverage.targetProfileIds),
      };
      break;
    case "universe-bucket-incomplete-reason-mismatch":
      bucket.coverage.reason = "target_discovery_unresolved";
      break;
    case "universe-bucket-complete-state-mismatch":
      bucket.coverage = {
        coverageState: "incomplete",
        reason: "target_discovery_unresolved",
        targetProfileIds: jsonClone(bucket.coverage.targetProfileIds),
      };
      break;
    case "universe-bucket-order-before-mapping-compound":
      universe.buckets.reverse();
      universe.buckets[0].architecture =
        universe.buckets[0].architecture === "arm64" ? "x86_64" : "arm64";
      break;
    case "universe-bucket-mapping-before-partition-compound":
      bucket.architecture = bucket.architecture === "arm64" ? "x86_64" : "arm64";
      bucket.coverage.targetProfileIds.push(validUnknownTargetId);
      bucket.coverage.targetProfileIds.sort(compareUtf8);
      break;
    case "universe-signature-format-invalid":
      universe.universeSignature = "invalid-signature";
      break;
    case "universe-signature-prefix-invalid":
      universe.universeSignature = universe.universeSignature.replace(
        "provider-release-target-universe-ed25519",
        "provider-target-discovery-result-ed25519",
      );
      break;
    case "universe-signature-root-binding-mismatch":
      universe.universeSignature = universe.universeSignature.replace(
        sourceGolden.activeRoot.rootKeyId,
        wrongRootKeyId,
      );
      break;
    case "universe-signature-bitflip":
      universe.universeSignature = bitflipLastHexWire(
        universe.universeSignature,
      );
      break;
    case "universe-signature-wrong-signer":
      universe.universeSignature = signUniversePayload(
        universe,
        sourceGolden,
        { signerSeedHex: wrongUniverseSignerSeedHex() },
      ).universeSignature;
      break;
    case "universe-signature-wrong-domain":
      universe.universeSignature = signUniversePayload(
        universe,
        sourceGolden,
        {
          message: wrongUniverseSignatureMessage("domain", universe),
        },
      ).universeSignature;
      break;
    case "universe-signature-wrong-claims":
      universe.universeSignature = signUniversePayload(
        universe,
        sourceGolden,
        {
          message: wrongUniverseSignatureMessage("claims", {
            universeGeneration: universe.universeGeneration + 1,
          }),
        },
      ).universeSignature;
      break;
    case "universe-signature-small-order-r":
      universe.universeSignature =
        `${ROOT_SIGNATURE_PREFIX}:${sourceGolden.activeRoot.rootKeyId}:${"00".repeat(64)}`;
      break;
    case "universe-signature-before-digest-compound":
      universe.universeSignature = bitflipLastHexWire(
        universe.universeSignature,
      );
      envelope.contentDigest = digest("f");
      break;
    case "universe-content-digest-mismatch":
      envelope.contentDigest = digest("f");
      break;
    case "universe-envelope-generation-mismatch":
      envelope.universeGeneration += 1;
      break;
    default:
      throw new TypeError(`unknown JSON Universe point case ${caseId}`);
  }
}

export function buildPointReplayRecipes(golden, pointCaseIds) {
  return pointCaseIds.map((caseId) => {
    const baseVectorId = baseVectorIdForPointCase(caseId);
    const baseRequest = positiveVectorById(golden, baseVectorId).request;
    const special = pointSpecialRecipe(caseId, baseRequest);
    const recipe = special ?? mutateAndPatch(baseRequest, (request) => {
      mutatePointJsonRequest(request, caseId, golden);
      if (REANCHOR_POINT_CASE_IDS.has(caseId)) {
        request.releaseTargetUniverse = resignAndReanchorUniverseEnvelope(
          request.releaseTargetUniverse,
          sourceGoldenFromPointRequest(golden, request),
        );
      }
    });
    // The replay is itself signed fixture data.  Live non-JCS inputs must use
    // hostile execution profiles rather than smuggling fractional or unsafe
    // numbers into the recipe manifest.
    canonicalizeJcsSafeIntegerUtf8V1(recipe);
    return { caseId, baseVectorId, recipe };
  });
}
