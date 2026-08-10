import { createPrivateKey, sign } from "node:crypto";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../../dist/jcs.js";
import {
  ProviderPublicSupportTaxonomyEnvelopeV1Schema,
  ProviderPublicSupportTaxonomyV1Schema,
  ProviderReleaseMatrixEnvelopeV1Schema,
  ProviderReleaseMatrixV1Schema,
  ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema,
  ProviderTargetDiscoveryInputBundleV1Schema,
  ProviderTargetDiscoveryResultEnvelopeV1Schema,
  ProviderTargetDiscoveryResultV1Schema,
  ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema,
  buildProviderPublicSupportTaxonomyRelativePathV1,
  buildProviderReleaseMatrixRelativePathV1,
  buildProviderTargetDiscoveryFixtureManifestRelativePathV1,
  buildProviderTargetDiscoveryResultRelativePathV1,
  buildProviderTargetDiscoveryRunnerRunRelativePathV1,
  createProviderPublicSupportTaxonomySignatureMessageV1,
  createProviderReleaseMatrixSignatureMessageV1,
  createProviderTargetDiscoveryInputBundleSignatureMessageV1,
  createProviderTargetDiscoveryResultSignatureMessageV1,
  deriveProviderFilesystemProfileCodeV1,
  deriveProviderOsReleaseFamilyCodeV1,
  deriveProviderPublicSupportProfileIdV1,
  deriveProviderPublicSupportTaxonomyContentDigestV1,
  deriveProviderReleaseMatrixContentDigestV1,
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
  diagnoseProviderTargetDiscoveryPointClosureV1,
  validateProviderTargetDiscoveryPointClosureV1,
} from "../../dist/provider-target-discovery-point.js";

export const GOLDEN_RESOURCE_PATH =
  "fixtures/v1/golden/provider-target-discovery-point-v1.json";
export const INVALID_RESOURCE_PATH =
  "fixtures/v1/invalid/provider-target-discovery-point-v1.json";
export const GOLDEN_SEMANTIC_DOMAIN =
  "provider-target-discovery-point-golden-manifest-v1";
export const INVALID_SEMANTIC_DOMAIN =
  "provider-target-discovery-point-invalid-manifest-v1";
export const INVALID_MATERIALIZED_REQUEST_DOMAIN =
  "provider-target-discovery-point-invalid-materialized-request-v1";
export const INVALID_RECIPE_DIALECT =
  "provider_target_discovery_point_invalid_recipe_v1";

export function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(character) {
  return `sha256:${character.repeat(64)}`;
}
function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
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
function rootSignature(prefix, rootKeyId, privateKey, message) {
  return `${prefix}:${rootKeyId}:${sign(null, Buffer.from(message), privateKey).toString("hex")}`;
}
function target(fields) {
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
function observation(observationSource, sourceArtifactContentDigest, sourceRecordOrdinal, outcome) {
  const sourceRecord = {
    observationSource,
    sourceArtifactContentDigest,
    sourceRecordOrdinal,
    outcome: jsonClone(outcome),
  };
  const privacySafeObservationClaimsDigest =
    deriveProviderTargetDiscoveryPrivacySafeObservationClaimsDigestV1(sourceRecord);
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

export function buildGoldenTargetDiscoveryPointFixture(sourceGolden, options = {}) {
  const distributionRootBinding = jsonClone(sourceGolden.distributionRootBinding);
  const activeRootMetadata = jsonClone(sourceGolden.activeRootMetadata);
  const activeRoot = jsonClone(sourceGolden.activeRoot);
  const rootPrivateKey = privateKeyFromSeedHex(sourceGolden.deterministicRootSeedHex);
  const rootKeyId = activeRoot.rootKeyId;

  const osReleaseFamilies = [
    {
      descriptor: {
        osPlatform: "darwin",
        resolver: "darwin_product_major_version_v1",
        productMajorVersion: 15,
      },
    },
    {
      descriptor: {
        osPlatform: "linux",
        resolver: "linux_os_release_id_major_version_v1",
        distributionId: "ubuntu",
        distributionMajorVersion: 24,
      },
    },
  ].map(({ descriptor }) => ({
    descriptor,
    osReleaseFamilyCode: deriveProviderOsReleaseFamilyCodeV1({ descriptor }),
  })).sort((left, right) => compareUtf8(left.osReleaseFamilyCode, right.osReleaseFamilyCode));
  const filesystemProfiles = [
    {
      descriptor: {
        osPlatform: "darwin",
        resolver: "darwin_filesystem_type_v1",
        filesystemKind: "apfs",
      },
    },
    {
      descriptor: {
        osPlatform: "linux",
        resolver: "linux_statfs_type_v1",
        filesystemKind: "ext4",
      },
    },
  ].map(({ descriptor }) => ({
    descriptor,
    filesystemProfileCode: deriveProviderFilesystemProfileCodeV1({ descriptor }),
  })).sort((left, right) => compareUtf8(left.filesystemProfileCode, right.filesystemProfileCode));
  const darwinOs = osReleaseFamilies.find((record) => record.descriptor.osPlatform === "darwin");
  const linuxOs = osReleaseFamilies.find((record) => record.descriptor.osPlatform === "linux");
  const apfs = filesystemProfiles.find((record) => record.descriptor.osPlatform === "darwin");
  const ext4 = filesystemProfiles.find((record) => record.descriptor.osPlatform === "linux");
  if (!darwinOs || !linuxOs || !apfs || !ext4) throw new Error("taxonomy fixture projection failed");

  const taxonomyUnsigned = {
    profile: "provider_public_support_taxonomy_v1",
    distributionRootBinding,
    activeRootMetadata,
    registryRootKeyId: rootKeyId,
    taxonomyGeneration: 1,
    osReleaseFamilies,
    filesystemProfiles,
    derivationPolicy: {
      osFamilySource: "strict_public_platform_release_api_without_build_identifier",
      filesystemSource: "strict_public_filesystem_kind_without_features_or_mount_options",
      excludedPrivateInputs: ["osBuildDigest", "filesystemFeatureProfileDigest", "mountOptionProfileDigest"],
      unknownOrNoncanonicalObservation: "public_strong_forbidden",
    },
  };
  const taxonomyMessage = createProviderPublicSupportTaxonomySignatureMessageV1(taxonomyUnsigned, rootKeyId);
  const taxonomyPayload = ProviderPublicSupportTaxonomyV1Schema.parse({
    ...taxonomyUnsigned,
    taxonomySignature: rootSignature(
      "provider-public-support-taxonomy-ed25519",
      rootKeyId,
      rootPrivateKey,
      taxonomyMessage,
    ),
  });
  const publicSupportTaxonomy = ProviderPublicSupportTaxonomyEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_public_support_taxonomy",
    taxonomyGeneration: 1,
    contentDigest: deriveProviderPublicSupportTaxonomyContentDigestV1(taxonomyPayload),
    payload: taxonomyPayload,
  });
  const taxonomyPin = {
    locatorProfile: "distribution_provider_public_support_taxonomy_v1",
    taxonomyGeneration: 1,
    contentDigest: publicSupportTaxonomy.contentDigest,
  };

  const targets = jsonClone(
    options.targets ?? [
      target({
        osPlatform: "darwin",
        osReleaseFamilyCode: darwinOs.osReleaseFamilyCode,
        osBuildDigest: digest("1"),
        architecture: "arm64",
        filesystemProfileCode: apfs.filesystemProfileCode,
        filesystemFeatureProfileDigest: digest("2"),
        mountOptionProfileDigest: digest("3"),
      }),
      target({
        osPlatform: "linux",
        osReleaseFamilyCode: linuxOs.osReleaseFamilyCode,
        osBuildDigest: digest("4"),
        architecture: "x86_64",
        filesystemProfileCode: ext4.filesystemProfileCode,
        filesystemFeatureProfileDigest: digest("5"),
        mountOptionProfileDigest: digest("6"),
      }),
    ],
  ).sort((left, right) =>
    compareUtf8(left.target.targetProfileId, right.target.targetProfileId),
  );
  const limits = {
    profile: "provider_release_coverage_artifact_limits_v1",
    maxTargetEntriesPerArtifact: 4096,
    maxCanonicalUnionTargetEntries: 4096,
    maxUnresolvedObservationsPerDiscoveryResult: 4096,
    maxCanonicalEnvelopeBytes: 16_777_216,
  };
  const matrixUnsigned = {
    profile: "provider_release_matrix_v1",
    distributionRootBinding,
    activeRootMetadata,
    registryRootKeyId: rootKeyId,
    releaseMatrixGeneration: 1,
    publicSupportTaxonomy: taxonomyPin,
    limits,
    targetCount: targets.length,
    targetSetDigest: deriveProviderReleaseTargetEntrySetDigestV1({ targets }),
    targets,
  };
  const matrixMessage = createProviderReleaseMatrixSignatureMessageV1(matrixUnsigned, rootKeyId);
  const matrixPayload = ProviderReleaseMatrixV1Schema.parse({
    ...matrixUnsigned,
    matrixSignature: rootSignature(
      "provider-release-matrix-ed25519",
      rootKeyId,
      rootPrivateKey,
      matrixMessage,
    ),
  });
  const releaseMatrix = ProviderReleaseMatrixEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_release_matrix",
    releaseMatrixGeneration: 1,
    contentDigest: deriveProviderReleaseMatrixContentDigestV1(matrixPayload),
    payload: matrixPayload,
  });
  const matrixPin = {
    locatorProfile: "distribution_provider_release_matrix_v1",
    releaseMatrixGeneration: 1,
    contentDigest: releaseMatrix.contentDigest,
  };

  const suitePin = {
    locatorProfile: "distribution_provider_real_fs_suite_manifest_v1",
    distributionRootBinding,
    suiteDigest: sourceGolden.suiteManifest.payload.suiteDigest,
    fixtureManifestDigest: sourceGolden.suiteManifest.payload.fixtureCorpusManifest.fixtureManifestDigest,
    contentDigest: sourceGolden.suiteManifest.contentDigest,
  };
  const fixtureRecords = options.emptyObservationManifests === true ? [] : [
    { sourceRecordOrdinal: 0, outcome: { state: "resolved", target: targets[1] } },
    { sourceRecordOrdinal: 1, outcome: { state: "unresolved", reason: "taxonomy_mapping_unresolved" } },
  ];
  const fixturePayload = jsonClone({
    profile: "provider_target_discovery_fixture_manifest_v1",
    distributionRootBinding,
    releaseRevisionDigest: distributionRootBinding.releaseRevisionDigest,
    realFilesystemSuiteManifest: suitePin,
    realFilesystemSuiteDigest: suitePin.suiteDigest,
    fixtureManifestDigest: suitePin.fixtureManifestDigest,
    targetRecordCount: fixtureRecords.length,
    targetRecordSetDigest: deriveProviderTargetDiscoverySourceManifestRecordSetDigestV1({
      observationSource: "real_filesystem_fixture_manifest",
      entries: fixtureRecords,
    }),
    records: fixtureRecords,
    completedAt: "2026-08-03T03:10:00Z",
  });
  const targetDiscoveryFixtureManifest = ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_target_discovery_fixture_manifest",
    fixtureManifestDigest: fixturePayload.fixtureManifestDigest,
    contentDigest: deriveProviderTargetDiscoveryFixtureManifestContentDigestV1(fixturePayload),
    payload: fixturePayload,
  });
  const fixturePin = {
    locatorProfile: "distribution_provider_real_fs_fixture_manifest_v1",
    realFilesystemSuiteManifest: suitePin,
    realFilesystemSuiteDigest: suitePin.suiteDigest,
    fixtureManifestDigest: suitePin.fixtureManifestDigest,
    contentDigest: targetDiscoveryFixtureManifest.contentDigest,
  };

  const runnerRecords = options.emptyObservationManifests === true ? [] : [
    { sourceRecordOrdinal: 0, outcome: { state: "resolved", target: targets[0] } },
    { sourceRecordOrdinal: 1, outcome: { state: "resolved", target: targets[1] } },
    { sourceRecordOrdinal: 2, outcome: { state: "unresolved", reason: "observation_source_unavailable" } },
  ];
  const runnerPayload = {
    profile: "provider_target_discovery_runner_run_manifest_v1",
    distributionRootBinding,
    releaseRevisionDigest: distributionRootBinding.releaseRevisionDigest,
    producerName: "understand-code",
    producerVersion: "0.1.0",
    implementationDigest: digest("7"),
    binaryAttestationDigest: digest("8"),
    runnerProfileDigest: digest("9"),
    targetRecordCount: runnerRecords.length,
    targetRecordSetDigest: deriveProviderTargetDiscoverySourceManifestRecordSetDigestV1({
      observationSource: "target_discovery_runner",
      entries: runnerRecords,
    }),
    records: runnerRecords,
    executedAt: "2026-08-03T03:20:00Z",
  };
  const targetDiscoveryRunnerRun = ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_target_discovery_runner_run",
    contentDigest: deriveProviderTargetDiscoveryRunnerRunManifestContentDigestV1(runnerPayload),
    payload: runnerPayload,
  });
  const runnerPin = {
    locatorProfile: "distribution_provider_target_discovery_runner_run_v1",
    producerName: runnerPayload.producerName,
    producerVersion: runnerPayload.producerVersion,
    implementationDigest: runnerPayload.implementationDigest,
    binaryAttestationDigest: runnerPayload.binaryAttestationDigest,
    runnerProfileDigest: runnerPayload.runnerProfileDigest,
    runManifestContentDigest: targetDiscoveryRunnerRun.contentDigest,
    releaseRevisionDigest: runnerPayload.releaseRevisionDigest,
    executedAt: runnerPayload.executedAt,
  };

  const requiredDimensions = [
    "osPlatform",
    "osReleaseFamilyCode",
    "osBuildDigest",
    "architecture",
    "filesystemProfileCode",
    "filesystemFeatureProfileDigest",
    "mountOptionProfileDigest",
  ];
  const observationSources = [
    "signed_release_matrix",
    "real_filesystem_fixture_manifest",
    "target_discovery_runner",
  ];
  const observationCut = jsonClone({
    profile: "provider_target_discovery_observation_cut_v1",
    distributionRootBinding,
    activeRootMetadata,
    publicSupportTaxonomy: taxonomyPin,
    releaseMatrix: matrixPin,
    realFilesystemFixtureManifest: fixturePin,
    targetDiscoveryRunner: runnerPin,
    discoveryRulesetVersion: "provider_release_target_discovery_v1",
    requiredDimensions,
    observationSources,
    freshnessRule: "exact_release_revision_and_source_digest_cut_v1",
  });
  const observationsBySource = [
    releaseMatrix.payload.targets.map((matrixTarget, sourceRecordOrdinal) =>
      observation("signed_release_matrix", releaseMatrix.contentDigest, sourceRecordOrdinal, { state: "resolved", target: matrixTarget })),
    fixtureRecords.map((record) =>
      observation("real_filesystem_fixture_manifest", targetDiscoveryFixtureManifest.contentDigest, record.sourceRecordOrdinal, record.outcome)),
    runnerRecords.map((record) =>
      observation("target_discovery_runner", targetDiscoveryRunnerRun.contentDigest, record.sourceRecordOrdinal, record.outcome)),
  ];
  const observations = observationsBySource.flat();
  const sourceObservationSets = observationsBySource.map((entries, index) => {
    const observationSource = observationSources[index];
    const sourceArtifactContentDigest = [
      releaseMatrix.contentDigest,
      targetDiscoveryFixtureManifest.contentDigest,
      targetDiscoveryRunnerRun.contentDigest,
    ][index];
    return {
      observationSource,
      sourceArtifactContentDigest,
      observationCount: entries.length,
      observationSetDigest: deriveProviderTargetDiscoverySourceObservationSetDigestV1({
        observationSource,
        sourceArtifactContentDigest,
        entries,
      }),
    };
  });
  const observationCutDigest = deriveProviderTargetDiscoveryObservationCutDigestV1(observationCut);
  const observationSetDigest = deriveProviderTargetDiscoveryInputObservationSetDigestV1({ entries: observations });
  const bundleUnsigned = jsonClone({
    profile: "provider_target_discovery_input_bundle_v1",
    distributionRootBinding,
    activeRootMetadata,
    registryRootKeyId: rootKeyId,
    publicSupportTaxonomy: taxonomyPin,
    releaseMatrix: matrixPin,
    realFilesystemFixtureManifest: fixturePin,
    targetDiscoveryRunner: runnerPin,
    discoveryRulesetVersion: "provider_release_target_discovery_v1",
    requiredDimensions,
    observationSources,
    observationCut,
    observationCutDigest,
    sourceObservationSets,
    observationCount: observations.length,
    observationSetDigest,
    observations,
  });
  const bundleMessage = createProviderTargetDiscoveryInputBundleSignatureMessageV1(bundleUnsigned, rootKeyId);
  const bundle = ProviderTargetDiscoveryInputBundleV1Schema.parse({
    ...bundleUnsigned,
    bundleSignature: rootSignature(
      "provider-target-discovery-input-bundle-ed25519",
      rootKeyId,
      rootPrivateKey,
      bundleMessage,
    ),
  });
  const bundleContentDigest = deriveProviderTargetDiscoveryInputBundleContentDigestV1(bundle);
  const unresolvedObservations = observations
    .filter((entry) => entry.outcome.state === "unresolved")
    .map((entry) => ({
      observationSource: entry.observationSource,
      sourceArtifactContentDigest: entry.sourceArtifactContentDigest,
      sourceRecordOrdinal: entry.sourceRecordOrdinal,
      privacySafeObservationClaimsDigest: entry.privacySafeObservationClaimsDigest,
      observationKeyDigest: entry.observationKeyDigest,
      reason: entry.outcome.reason,
    }))
    .sort((left, right) => {
      const sourceOrder = compareUtf8(left.observationSource, right.observationSource);
      return sourceOrder || compareUtf8(left.observationKeyDigest, right.observationKeyDigest);
    });
  const resultUnsigned = jsonClone({
    profile: "provider_target_discovery_result_v1",
    distributionRootBinding,
    activeRootMetadata,
    registryRootKeyId: rootKeyId,
    discoveryGeneration: 1,
    publicSupportTaxonomy: taxonomyPin,
    limits,
    targetDiscoveryInputBundleContentDigest: bundleContentDigest,
    targetDiscoveryInputBundle: bundle,
    observationCutDigest,
    observationSetDigest,
    discoveryRulesetVersion: "provider_release_target_discovery_v1",
    requiredDimensions,
    observationSources,
    targetCount: targets.length,
    targetSetDigest: deriveProviderReleaseTargetEntrySetDigestV1({ targets }),
    targets,
    unresolvedObservationCount: unresolvedObservations.length,
    unresolvedObservations,
  });
  const resultMessage = createProviderTargetDiscoveryResultSignatureMessageV1(resultUnsigned, rootKeyId);
  const resultPayload = ProviderTargetDiscoveryResultV1Schema.parse({
    ...resultUnsigned,
    discoverySignature: rootSignature(
      "provider-target-discovery-result-ed25519",
      rootKeyId,
      rootPrivateKey,
      resultMessage,
    ),
  });
  const targetDiscoveryResult = ProviderTargetDiscoveryResultEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_target_discovery_result",
    discoveryGeneration: 1,
    contentDigest: deriveProviderTargetDiscoveryResultContentDigestV1(resultPayload),
    payload: resultPayload,
  });

  return {
    schemaVersion: 1,
    profile: "provider_target_discovery_point_golden_v1",
    fixtureAuthority: "none_target_discovery_point_structure_only",
    canonicalizationProfile: "rfc8785-jcs-safe-integer-v1",
    verificationProfile: "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
    deterministicRootSeedHex: sourceGolden.deterministicRootSeedHex,
    distributionRootBinding,
    activeRootMetadata,
    activeRoot,
    fixtureCorpusManifest: jsonClone(sourceGolden.fixtureCorpusManifest),
    suiteManifest: jsonClone(sourceGolden.suiteManifest),
    publicSupportTaxonomy,
    releaseMatrix,
    targetDiscoveryFixtureManifest,
    targetDiscoveryRunnerRun,
    targetDiscoveryResult,
    expected: {
      taxonomySignatureMessageUtf8Hex: Buffer.from(taxonomyMessage).toString("hex"),
      matrixSignatureMessageUtf8Hex: Buffer.from(matrixMessage).toString("hex"),
      bundleSignatureMessageUtf8Hex: Buffer.from(bundleMessage).toString("hex"),
      resultSignatureMessageUtf8Hex: Buffer.from(resultMessage).toString("hex"),
      bundleCanonicalUtf8Hex: Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(bundle)).toString("hex"),
      locators: {
        publicSupportTaxonomy: buildProviderPublicSupportTaxonomyRelativePathV1(publicSupportTaxonomy),
        releaseMatrix: buildProviderReleaseMatrixRelativePathV1(releaseMatrix),
        targetDiscoveryFixtureManifest: buildProviderTargetDiscoveryFixtureManifestRelativePathV1(targetDiscoveryFixtureManifest),
        targetDiscoveryRunnerRun: buildProviderTargetDiscoveryRunnerRunRelativePathV1(targetDiscoveryRunnerRun),
        targetDiscoveryResult: buildProviderTargetDiscoveryResultRelativePathV1(targetDiscoveryResult),
      },
      sourceRecordCount: sourceGolden.fixtureCorpusManifest.payload.recordCount,
      observationCount: observations.length,
      targetCount: targets.length,
      unresolvedObservationCount: unresolvedObservations.length,
      signatureVerificationCount: 6,
    },
  };
}

export const INVALID_CASE_IDS = Object.freeze([
  "input-extra-field",
  "input-missing-result",
  "taxonomy-envelope-extra-field",
  "taxonomy-code-mismatch",
  "taxonomy-order-reversed",
  "taxonomy-signature-bitflip",
  "taxonomy-envelope-digest-mismatch",
  "taxonomy-outer-generation-mismatch",
  "matrix-taxonomy-pin-mismatch",
  "matrix-target-count-mismatch",
  "matrix-target-id-mismatch",
  "matrix-public-id-mismatch",
  "matrix-target-order-reversed",
  "matrix-target-set-digest-mismatch",
  "matrix-signature-bitflip",
  "matrix-envelope-digest-mismatch",
  "fixture-suite-pin-mismatch",
  "fixture-suite-semantic-digest-mismatch",
  "fixture-corpus-semantic-digest-mismatch",
  "fixture-record-ordinal-gap",
  "fixture-record-count-mismatch",
  "fixture-record-set-digest-mismatch",
  "fixture-envelope-content-digest-mismatch",
  "runner-record-ordinal-gap",
  "runner-record-count-mismatch",
  "runner-record-set-digest-mismatch",
  "runner-envelope-content-digest-mismatch",
  "bundle-taxonomy-pin-mismatch",
  "bundle-fixture-pin-mismatch",
  "bundle-runner-pin-mismatch",
  "bundle-observation-cut-mismatch",
  "bundle-observation-cut-digest-mismatch",
  "bundle-source-summary-order-reversed",
  "bundle-observation-count-mismatch",
  "bundle-observation-outcome-rewritten",
  "bundle-observation-key-mismatch",
  "bundle-observation-set-digest-mismatch",
  "bundle-signature-bitflip",
  "result-bundle-content-digest-mismatch",
  "result-target-count-mismatch",
  "result-target-order-reversed",
  "result-target-set-digest-mismatch",
  "result-unresolved-count-mismatch",
  "result-unresolved-order-reversed",
  "result-signature-bitflip",
  "result-envelope-content-digest-mismatch",
  "resolved-target-conflict",
  "source-suite-signature-bitflip",
  "caller-distribution-binding-mismatch",
  "caller-active-root-metadata-mismatch",
  "caller-active-root-key-mismatch",
  "taxonomy-distribution-binding-mismatch",
  "taxonomy-active-root-mismatch",
  "taxonomy-root-key-id-mismatch",
  "matrix-distribution-binding-mismatch",
  "matrix-active-root-mismatch",
  "matrix-root-key-id-mismatch",
  "fixture-distribution-binding-mismatch",
  "fixture-release-revision-mismatch",
  "runner-distribution-binding-mismatch",
  "runner-release-revision-mismatch",
  "bundle-distribution-binding-mismatch",
  "bundle-active-root-mismatch",
  "bundle-root-key-id-mismatch",
  "result-distribution-binding-mismatch",
  "result-active-root-mismatch",
  "result-root-key-id-mismatch",
  "taxonomy-signature-wrong-signer",
  "taxonomy-signature-wrong-domain",
  "taxonomy-signature-wrong-prefix",
  "taxonomy-signature-wrong-claims",
  "matrix-signature-wrong-signer",
  "matrix-signature-wrong-domain",
  "matrix-signature-wrong-prefix",
  "matrix-signature-wrong-claims",
  "bundle-signature-wrong-signer",
  "bundle-signature-wrong-domain",
  "bundle-signature-wrong-prefix",
  "bundle-signature-wrong-claims",
  "result-signature-wrong-signer",
  "result-signature-wrong-domain",
  "result-signature-wrong-prefix",
  "result-signature-wrong-claims",
  "matrix-source-artifact-semantic-digest-substitution",
  "fixture-source-artifact-semantic-digest-substitution",
  "runner-source-artifact-semantic-digest-substitution",
  "bundle-observation-missing",
  "bundle-observation-extra",
  "bundle-observation-duplicate",
  "bundle-observation-reordered",
  "matrix-target-4097",
  "result-target-4097",
  "result-unresolved-4097",
  "embedded-bundle-16mib-plus-one",
  "runner-envelope-16mib-plus-one",
  "taxonomy-locator-bare-dto",
  "matrix-locator-bare-dto",
  "fixture-locator-bare-digest",
  "runner-locator-bare-digest",
  "result-locator-bare-dto",
  "fixture-locator-semantic-digest-substitution",
  "fixture-locator-outer-semantic-digest-mismatch",
  "runner-locator-semantic-digest-substitution",
  "taxonomy-locator-path-alias",
  "matrix-locator-latest-alias",
  "result-locator-path-alias",
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

export const EXECUTABLE_ONLY_CASE_IDS = Object.freeze([
  "taxonomy-locator-bare-dto",
  "matrix-locator-bare-dto",
  "fixture-locator-bare-digest",
  "runner-locator-bare-digest",
  "result-locator-bare-dto",
  "fixture-locator-semantic-digest-substitution",
  "fixture-locator-outer-semantic-digest-mismatch",
  "runner-locator-semantic-digest-substitution",
  "taxonomy-locator-path-alias",
  "matrix-locator-latest-alias",
  "result-locator-path-alias",
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

function bitflipLast(value) {
  return `${value.slice(0, -1)}${value.endsWith("0") ? "1" : "0"}`;
}

function signatureWithMessage(prefix, rootKeyId, seedHex, message) {
  return rootSignature(
    prefix,
    rootKeyId,
    privateKeyFromSeedHex(seedHex),
    message,
  );
}

function wrongSignatureMessage(label, payload) {
  return canonicalizeJcsSafeIntegerUtf8V1([
    `provider-target-discovery-hostile-${label}-v1`,
    payload,
  ]);
}

function padStringFieldToCanonicalBytes(object, owner, field, targetBytes) {
  const currentBytes = canonicalizeJcsSafeIntegerUtf8V1(object).byteLength;
  const current = owner[field];
  const prefix = "0.1.0+";
  const paddingLength = targetBytes - currentBytes - (prefix.length - current.length);
  if (paddingLength < 1) throw new Error("target byte padding is not positive");
  owner[field] = `${prefix}${"a".repeat(paddingLength)}`;
  if (canonicalizeJcsSafeIntegerUtf8V1(object).byteLength !== targetBytes) {
    throw new Error("target byte padding did not reach the exact boundary");
  }
}

function materializeResolvedTargetConflict(request, golden) {
  const rootKeyId = golden.activeRoot.rootKeyId;
  const rootSeedHex = golden.deterministicRootSeedHex;
  const matrixEnvelope = request.releaseMatrix;
  const fixtureEnvelope = request.targetDiscoveryFixtureManifest;
  const runnerEnvelope = request.targetDiscoveryRunnerRun;
  const resultEnvelope = request.targetDiscoveryResult;
  const fixture = fixtureEnvelope.payload;
  const runner = runnerEnvelope.payload;
  const bundle = resultEnvelope.payload.targetDiscoveryInputBundle;
  const result = resultEnvelope.payload;

  fixture.records[0].outcome.target.target.osBuildDigest = digest("f");
  fixture.targetRecordSetDigest = deriveProviderTargetDiscoverySourceManifestRecordSetDigestV1({
    observationSource: "real_filesystem_fixture_manifest",
    entries: fixture.records,
  });
  fixtureEnvelope.contentDigest =
    deriveProviderTargetDiscoveryFixtureManifestContentDigestV1(fixture);
  bundle.realFilesystemFixtureManifest.contentDigest = fixtureEnvelope.contentDigest;
  bundle.observationCut.realFilesystemFixtureManifest.contentDigest =
    fixtureEnvelope.contentDigest;

  const observationsBySource = [
    matrixEnvelope.payload.targets.map((matrixTarget, sourceRecordOrdinal) =>
      observation(
        "signed_release_matrix",
        matrixEnvelope.contentDigest,
        sourceRecordOrdinal,
        { state: "resolved", target: matrixTarget },
      )),
    fixture.records.map((record) =>
      observation(
        "real_filesystem_fixture_manifest",
        fixtureEnvelope.contentDigest,
        record.sourceRecordOrdinal,
        record.outcome,
      )),
    runner.records.map((record) =>
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
  bundle.observationCutDigest =
    deriveProviderTargetDiscoveryObservationCutDigestV1(bundle.observationCut);
  bundle.sourceObservationSets = observationsBySource.map((entries, index) => {
    const observationSource = bundle.observationSources[index];
    const sourceArtifactContentDigest = sourceDigests[index];
    return {
      observationSource,
      sourceArtifactContentDigest,
      observationCount: entries.length,
      observationSetDigest: deriveProviderTargetDiscoverySourceObservationSetDigestV1({
        observationSource,
        sourceArtifactContentDigest,
        entries,
      }),
    };
  });
  bundle.observations = observationsBySource.flat();
  bundle.observationCount = bundle.observations.length;
  bundle.observationSetDigest = deriveProviderTargetDiscoveryInputObservationSetDigestV1({
    entries: bundle.observations,
  });
  bundle.bundleSignature = signatureWithMessage(
    "provider-target-discovery-input-bundle-ed25519",
    rootKeyId,
    rootSeedHex,
    createProviderTargetDiscoveryInputBundleSignatureMessageV1(bundle, rootKeyId),
  );

  result.targetDiscoveryInputBundleContentDigest =
    deriveProviderTargetDiscoveryInputBundleContentDigestV1(bundle);
  result.observationCutDigest = bundle.observationCutDigest;
  result.observationSetDigest = bundle.observationSetDigest;
  result.discoverySignature = signatureWithMessage(
    "provider-target-discovery-result-ed25519",
    rootKeyId,
    rootSeedHex,
    createProviderTargetDiscoveryResultSignatureMessageV1(result, rootKeyId),
  );
  resultEnvelope.contentDigest = deriveProviderTargetDiscoveryResultContentDigestV1(result);
}

export function materializeInvalidRequest(golden, caseId) {
  const request = {
    distributionRootBinding: jsonClone(golden.distributionRootBinding),
    activeRootMetadata: jsonClone(golden.activeRootMetadata),
    activeRoot: jsonClone(golden.activeRoot),
    fixtureCorpusManifest: jsonClone(golden.fixtureCorpusManifest),
    suiteManifest: jsonClone(golden.suiteManifest),
    publicSupportTaxonomy: jsonClone(golden.publicSupportTaxonomy),
    releaseMatrix: jsonClone(golden.releaseMatrix),
    targetDiscoveryFixtureManifest: jsonClone(golden.targetDiscoveryFixtureManifest),
    targetDiscoveryRunnerRun: jsonClone(golden.targetDiscoveryRunnerRun),
    targetDiscoveryResult: jsonClone(golden.targetDiscoveryResult),
  };
  const bundle = request.targetDiscoveryResult.payload.targetDiscoveryInputBundle;
  const result = request.targetDiscoveryResult.payload;
  const rootKeyId = golden.activeRoot.rootKeyId;
  const wrongRootKeyId = "f".repeat(22);
  const wrongSignerSeedHex = "e".repeat(64);
  switch (caseId) {
    case "input-extra-field": request.unexpected = true; break;
    case "input-missing-result": delete request.targetDiscoveryResult; break;
    case "taxonomy-envelope-extra-field": request.publicSupportTaxonomy.unexpected = true; break;
    case "taxonomy-code-mismatch": request.publicSupportTaxonomy.payload.osReleaseFamilies[0].osReleaseFamilyCode = `provider-os-family:${"f".repeat(22)}`; break;
    case "taxonomy-order-reversed": request.publicSupportTaxonomy.payload.osReleaseFamilies.reverse(); break;
    case "taxonomy-signature-bitflip": request.publicSupportTaxonomy.payload.taxonomySignature = bitflipLast(request.publicSupportTaxonomy.payload.taxonomySignature); break;
    case "taxonomy-envelope-digest-mismatch": request.publicSupportTaxonomy.contentDigest = digest("f"); break;
    case "taxonomy-outer-generation-mismatch": request.publicSupportTaxonomy.taxonomyGeneration = 2; break;
    case "matrix-taxonomy-pin-mismatch": request.releaseMatrix.payload.publicSupportTaxonomy.contentDigest = digest("f"); break;
    case "matrix-target-count-mismatch": request.releaseMatrix.payload.targetCount += 1; break;
    case "matrix-target-id-mismatch": request.releaseMatrix.payload.targets[0].target.targetProfileId = `provider-target-profile:${"f".repeat(64)}`; break;
    case "matrix-public-id-mismatch": request.releaseMatrix.payload.targets[0].publicProfileId = `provider-public-support-profile:${"f".repeat(64)}`; break;
    case "matrix-target-order-reversed": request.releaseMatrix.payload.targets.reverse(); break;
    case "matrix-target-set-digest-mismatch": request.releaseMatrix.payload.targetSetDigest = digest("f"); break;
    case "matrix-signature-bitflip": request.releaseMatrix.payload.matrixSignature = bitflipLast(request.releaseMatrix.payload.matrixSignature); break;
    case "matrix-envelope-digest-mismatch": request.releaseMatrix.contentDigest = digest("f"); break;
    case "fixture-suite-pin-mismatch": request.targetDiscoveryFixtureManifest.payload.realFilesystemSuiteManifest.contentDigest = digest("f"); break;
    case "fixture-suite-semantic-digest-mismatch": request.targetDiscoveryFixtureManifest.payload.realFilesystemSuiteDigest = digest("f"); break;
    case "fixture-corpus-semantic-digest-mismatch": request.targetDiscoveryFixtureManifest.payload.fixtureManifestDigest = digest("f"); break;
    case "fixture-record-ordinal-gap": request.targetDiscoveryFixtureManifest.payload.records[1].sourceRecordOrdinal = 2; break;
    case "fixture-record-count-mismatch": request.targetDiscoveryFixtureManifest.payload.targetRecordCount += 1; break;
    case "fixture-record-set-digest-mismatch": request.targetDiscoveryFixtureManifest.payload.targetRecordSetDigest = digest("f"); break;
    case "fixture-envelope-content-digest-mismatch": request.targetDiscoveryFixtureManifest.contentDigest = digest("f"); break;
    case "runner-record-ordinal-gap": request.targetDiscoveryRunnerRun.payload.records[1].sourceRecordOrdinal = 3; break;
    case "runner-record-count-mismatch": request.targetDiscoveryRunnerRun.payload.targetRecordCount += 1; break;
    case "runner-record-set-digest-mismatch": request.targetDiscoveryRunnerRun.payload.targetRecordSetDigest = digest("f"); break;
    case "runner-envelope-content-digest-mismatch": request.targetDiscoveryRunnerRun.contentDigest = digest("f"); break;
    case "bundle-taxonomy-pin-mismatch": bundle.publicSupportTaxonomy.contentDigest = digest("f"); break;
    case "bundle-fixture-pin-mismatch": bundle.realFilesystemFixtureManifest.contentDigest = digest("f"); break;
    case "bundle-runner-pin-mismatch": bundle.targetDiscoveryRunner.runManifestContentDigest = digest("f"); break;
    case "bundle-observation-cut-mismatch": bundle.observationCut.freshnessRule = "invalid"; break;
    case "bundle-observation-cut-digest-mismatch": bundle.observationCutDigest = digest("f"); break;
    case "bundle-source-summary-order-reversed": bundle.sourceObservationSets.reverse(); break;
    case "bundle-observation-count-mismatch": bundle.observationCount += 1; break;
    case "bundle-observation-outcome-rewritten": bundle.observations[0].outcome = { state: "unresolved", reason: "conflicting_target_claims" }; break;
    case "bundle-observation-key-mismatch": bundle.observations[0].observationKeyDigest = digest("f"); break;
    case "bundle-observation-set-digest-mismatch": bundle.observationSetDigest = digest("f"); break;
    case "bundle-signature-bitflip": bundle.bundleSignature = bitflipLast(bundle.bundleSignature); break;
    case "result-bundle-content-digest-mismatch": result.targetDiscoveryInputBundleContentDigest = digest("f"); break;
    case "result-target-count-mismatch": result.targetCount += 1; break;
    case "result-target-order-reversed": result.targets.reverse(); break;
    case "result-target-set-digest-mismatch": result.targetSetDigest = digest("f"); break;
    case "result-unresolved-count-mismatch": result.unresolvedObservationCount += 1; break;
    case "result-unresolved-order-reversed": result.unresolvedObservations.reverse(); break;
    case "result-signature-bitflip": result.discoverySignature = bitflipLast(result.discoverySignature); break;
    case "result-envelope-content-digest-mismatch": request.targetDiscoveryResult.contentDigest = digest("f"); break;
    case "resolved-target-conflict": materializeResolvedTargetConflict(request, golden); break;
    case "source-suite-signature-bitflip": request.suiteManifest.payload.suiteSignature = bitflipLast(request.suiteManifest.payload.suiteSignature); break;
    case "caller-distribution-binding-mismatch": request.distributionRootBinding.releaseRevisionDigest = digest("f"); break;
    case "caller-active-root-metadata-mismatch": request.activeRootMetadata.contentDigest = digest("f"); break;
    case "caller-active-root-key-mismatch": request.activeRoot.rootKeyId = wrongRootKeyId; break;
    case "taxonomy-distribution-binding-mismatch": request.publicSupportTaxonomy.payload.distributionRootBinding.releaseRevisionDigest = digest("f"); break;
    case "taxonomy-active-root-mismatch": request.publicSupportTaxonomy.payload.activeRootMetadata.contentDigest = digest("f"); break;
    case "taxonomy-root-key-id-mismatch": request.publicSupportTaxonomy.payload.registryRootKeyId = wrongRootKeyId; break;
    case "matrix-distribution-binding-mismatch": request.releaseMatrix.payload.distributionRootBinding.releaseRevisionDigest = digest("f"); break;
    case "matrix-active-root-mismatch": request.releaseMatrix.payload.activeRootMetadata.contentDigest = digest("f"); break;
    case "matrix-root-key-id-mismatch": request.releaseMatrix.payload.registryRootKeyId = wrongRootKeyId; break;
    case "fixture-distribution-binding-mismatch": request.targetDiscoveryFixtureManifest.payload.distributionRootBinding.releaseRevisionDigest = digest("f"); break;
    case "fixture-release-revision-mismatch": request.targetDiscoveryFixtureManifest.payload.releaseRevisionDigest = digest("f"); break;
    case "runner-distribution-binding-mismatch": request.targetDiscoveryRunnerRun.payload.distributionRootBinding.releaseRevisionDigest = digest("f"); break;
    case "runner-release-revision-mismatch": request.targetDiscoveryRunnerRun.payload.releaseRevisionDigest = digest("f"); break;
    case "bundle-distribution-binding-mismatch": bundle.distributionRootBinding.releaseRevisionDigest = digest("f"); break;
    case "bundle-active-root-mismatch": bundle.activeRootMetadata.contentDigest = digest("f"); break;
    case "bundle-root-key-id-mismatch": bundle.registryRootKeyId = wrongRootKeyId; break;
    case "result-distribution-binding-mismatch": result.distributionRootBinding.releaseRevisionDigest = digest("f"); break;
    case "result-active-root-mismatch": result.activeRootMetadata.contentDigest = digest("f"); break;
    case "result-root-key-id-mismatch": result.registryRootKeyId = wrongRootKeyId; break;
    case "taxonomy-signature-wrong-signer": request.publicSupportTaxonomy.payload.taxonomySignature = signatureWithMessage("provider-public-support-taxonomy-ed25519", rootKeyId, wrongSignerSeedHex, createProviderPublicSupportTaxonomySignatureMessageV1(request.publicSupportTaxonomy.payload, rootKeyId)); break;
    case "taxonomy-signature-wrong-domain": request.publicSupportTaxonomy.payload.taxonomySignature = signatureWithMessage("provider-public-support-taxonomy-ed25519", rootKeyId, golden.deterministicRootSeedHex, wrongSignatureMessage("taxonomy-domain", request.publicSupportTaxonomy.payload)); break;
    case "taxonomy-signature-wrong-prefix": request.publicSupportTaxonomy.payload.taxonomySignature = request.publicSupportTaxonomy.payload.taxonomySignature.replace("provider-public-support-taxonomy-ed25519", "provider-release-matrix-ed25519"); break;
    case "taxonomy-signature-wrong-claims": request.publicSupportTaxonomy.payload.taxonomySignature = signatureWithMessage("provider-public-support-taxonomy-ed25519", rootKeyId, golden.deterministicRootSeedHex, wrongSignatureMessage("taxonomy-claims", { taxonomyGeneration: 2 })); break;
    case "matrix-signature-wrong-signer": request.releaseMatrix.payload.matrixSignature = signatureWithMessage("provider-release-matrix-ed25519", rootKeyId, wrongSignerSeedHex, createProviderReleaseMatrixSignatureMessageV1(request.releaseMatrix.payload, rootKeyId)); break;
    case "matrix-signature-wrong-domain": request.releaseMatrix.payload.matrixSignature = signatureWithMessage("provider-release-matrix-ed25519", rootKeyId, golden.deterministicRootSeedHex, wrongSignatureMessage("matrix-domain", request.releaseMatrix.payload)); break;
    case "matrix-signature-wrong-prefix": request.releaseMatrix.payload.matrixSignature = request.releaseMatrix.payload.matrixSignature.replace("provider-release-matrix-ed25519", "provider-public-support-taxonomy-ed25519"); break;
    case "matrix-signature-wrong-claims": request.releaseMatrix.payload.matrixSignature = signatureWithMessage("provider-release-matrix-ed25519", rootKeyId, golden.deterministicRootSeedHex, wrongSignatureMessage("matrix-claims", { releaseMatrixGeneration: 2 })); break;
    case "bundle-signature-wrong-signer": bundle.bundleSignature = signatureWithMessage("provider-target-discovery-input-bundle-ed25519", rootKeyId, wrongSignerSeedHex, createProviderTargetDiscoveryInputBundleSignatureMessageV1(bundle, rootKeyId)); break;
    case "bundle-signature-wrong-domain": bundle.bundleSignature = signatureWithMessage("provider-target-discovery-input-bundle-ed25519", rootKeyId, golden.deterministicRootSeedHex, wrongSignatureMessage("bundle-domain", bundle)); break;
    case "bundle-signature-wrong-prefix": bundle.bundleSignature = bundle.bundleSignature.replace("provider-target-discovery-input-bundle-ed25519", "provider-target-discovery-result-ed25519"); break;
    case "bundle-signature-wrong-claims": bundle.bundleSignature = signatureWithMessage("provider-target-discovery-input-bundle-ed25519", rootKeyId, golden.deterministicRootSeedHex, wrongSignatureMessage("bundle-claims", { observationCount: bundle.observationCount + 1 })); break;
    case "result-signature-wrong-signer": result.discoverySignature = signatureWithMessage("provider-target-discovery-result-ed25519", rootKeyId, wrongSignerSeedHex, createProviderTargetDiscoveryResultSignatureMessageV1(result, rootKeyId)); break;
    case "result-signature-wrong-domain": result.discoverySignature = signatureWithMessage("provider-target-discovery-result-ed25519", rootKeyId, golden.deterministicRootSeedHex, wrongSignatureMessage("result-domain", result)); break;
    case "result-signature-wrong-prefix": result.discoverySignature = result.discoverySignature.replace("provider-target-discovery-result-ed25519", "provider-target-discovery-input-bundle-ed25519"); break;
    case "result-signature-wrong-claims": result.discoverySignature = signatureWithMessage("provider-target-discovery-result-ed25519", rootKeyId, golden.deterministicRootSeedHex, wrongSignatureMessage("result-claims", { discoveryGeneration: 2 })); break;
    case "matrix-source-artifact-semantic-digest-substitution": bundle.observations[0].sourceArtifactContentDigest = request.releaseMatrix.payload.targetSetDigest; break;
    case "fixture-source-artifact-semantic-digest-substitution": bundle.observations[2].sourceArtifactContentDigest = request.targetDiscoveryFixtureManifest.payload.fixtureManifestDigest; break;
    case "runner-source-artifact-semantic-digest-substitution": bundle.observations[4].sourceArtifactContentDigest = request.targetDiscoveryRunnerRun.payload.runnerProfileDigest; break;
    case "bundle-observation-missing": bundle.observations.splice(0, 1); break;
    case "bundle-observation-extra": bundle.observations.push(jsonClone(bundle.observations.at(-1))); break;
    case "bundle-observation-duplicate": bundle.observations[1] = jsonClone(bundle.observations[0]); break;
    case "bundle-observation-reordered": [bundle.observations[0], bundle.observations[1]] = [bundle.observations[1], bundle.observations[0]]; break;
    case "matrix-target-4097": request.releaseMatrix.payload.targets = Array.from({ length: 4097 }, () => jsonClone(request.releaseMatrix.payload.targets[0])); request.releaseMatrix.payload.targetCount = 4097; break;
    case "result-target-4097": result.targets = Array.from({ length: 4097 }, () => jsonClone(result.targets[0])); result.targetCount = 4097; break;
    case "result-unresolved-4097": result.unresolvedObservations = Array.from({ length: 4097 }, () => jsonClone(result.unresolvedObservations[0])); result.unresolvedObservationCount = 4097; break;
    case "embedded-bundle-16mib-plus-one": padStringFieldToCanonicalBytes(bundle, bundle.targetDiscoveryRunner, "producerVersion", 16_777_217); break;
    case "runner-envelope-16mib-plus-one": padStringFieldToCanonicalBytes(request.targetDiscoveryRunnerRun, request.targetDiscoveryRunnerRun.payload, "producerVersion", 16_777_217); break;
    case "taxonomy-locator-bare-dto":
    case "matrix-locator-bare-dto":
    case "fixture-locator-bare-digest":
    case "runner-locator-bare-digest":
    case "result-locator-bare-dto":
    case "fixture-locator-semantic-digest-substitution":
    case "fixture-locator-outer-semantic-digest-mismatch":
    case "runner-locator-semantic-digest-substitution":
    case "taxonomy-locator-path-alias":
    case "matrix-locator-latest-alias":
    case "result-locator-path-alias":
    case "security-top-level-proxy":
    case "security-nested-proxy":
    case "security-top-level-getter":
    case "security-nested-getter":
    case "security-nested-hidden":
    case "security-nested-symbol":
    case "security-sparse-array":
    case "security-cycle":
    case "security-alias":
    case "security-async-mutation": break;
    default: throw new TypeError(`unknown target discovery invalid case ${caseId}`);
  }
  return request;
}

export function materializeInvalidRequestWitness(golden, caseId) {
  if (EXECUTABLE_ONLY_CASE_IDS.includes(caseId)) {
    return {
      caseId,
      executionProfile: caseId.startsWith("security-")
        ? "provider_target_discovery_hostile_input_execution_v1"
        : "provider_target_discovery_complete_envelope_locator_execution_v1",
      goldenSemanticContentDigest: golden.semanticContentDigest,
    };
  }
  return { caseId, ...materializeInvalidRequest(golden, caseId) };
}

function locatorExecution(golden, caseId) {
  switch (caseId) {
    case "taxonomy-locator-bare-dto":
      return () => buildProviderPublicSupportTaxonomyRelativePathV1({
        locatorProfile: "distribution_provider_public_support_taxonomy_v1",
        taxonomyGeneration: golden.publicSupportTaxonomy.taxonomyGeneration,
      });
    case "matrix-locator-bare-dto":
      return () => buildProviderReleaseMatrixRelativePathV1({
        locatorProfile: "distribution_provider_release_matrix_v1",
        releaseMatrixGeneration: golden.releaseMatrix.releaseMatrixGeneration,
      });
    case "fixture-locator-bare-digest":
      return () => buildProviderTargetDiscoveryFixtureManifestRelativePathV1({
        contentDigest: golden.targetDiscoveryFixtureManifest.contentDigest,
      });
    case "runner-locator-bare-digest":
      return () => buildProviderTargetDiscoveryRunnerRunRelativePathV1({
        runManifestContentDigest: golden.targetDiscoveryRunnerRun.contentDigest,
      });
    case "result-locator-bare-dto":
      return () => buildProviderTargetDiscoveryResultRelativePathV1({
        locatorProfile: "distribution_provider_target_discovery_result_v1",
        discoveryGeneration: golden.targetDiscoveryResult.discoveryGeneration,
      });
    case "fixture-locator-semantic-digest-substitution": {
      const envelope = jsonClone(golden.targetDiscoveryFixtureManifest);
      envelope.contentDigest = envelope.fixtureManifestDigest;
      return () => buildProviderTargetDiscoveryFixtureManifestRelativePathV1(envelope);
    }
    case "fixture-locator-outer-semantic-digest-mismatch": {
      const envelope = jsonClone(golden.targetDiscoveryFixtureManifest);
      envelope.fixtureManifestDigest = digest("f");
      return () => buildProviderTargetDiscoveryFixtureManifestRelativePathV1(envelope);
    }
    case "runner-locator-semantic-digest-substitution": {
      const envelope = jsonClone(golden.targetDiscoveryRunnerRun);
      envelope.contentDigest = envelope.payload.runnerProfileDigest;
      return () => buildProviderTargetDiscoveryRunnerRunRelativePathV1(envelope);
    }
    case "taxonomy-locator-path-alias": {
      const envelope = jsonClone(golden.publicSupportTaxonomy);
      envelope.relativePath = "provider/public-support-taxonomy/latest.json";
      return () => buildProviderPublicSupportTaxonomyRelativePathV1(envelope);
    }
    case "matrix-locator-latest-alias": {
      const envelope = jsonClone(golden.releaseMatrix);
      envelope.latest = true;
      return () => buildProviderReleaseMatrixRelativePathV1(envelope);
    }
    case "result-locator-path-alias": {
      const envelope = jsonClone(golden.targetDiscoveryResult);
      envelope.relativePath = "provider/target-discovery-results/latest.json";
      return () => buildProviderTargetDiscoveryResultRelativePathV1(envelope);
    }
    default:
      return undefined;
  }
}

function hostileInputExecution(golden, caseId, strictCryptoCapability) {
  const request = {
    ...materializeInvalidRequest(golden, caseId),
    strictCryptoCapability,
  };
  let getterCalls = 0;
  switch (caseId) {
    case "security-top-level-proxy":
      return { input: new Proxy(request, {}), getterCalls: () => getterCalls };
    case "security-nested-proxy":
      request.targetDiscoveryResult.payload = new Proxy(request.targetDiscoveryResult.payload, {});
      break;
    case "security-top-level-getter":
      Object.defineProperty(request, "unexpected", {
        enumerable: true,
        get() {
          getterCalls += 1;
          return true;
        },
      });
      break;
    case "security-nested-getter":
      Object.defineProperty(request.targetDiscoveryResult.payload, "unexpected", {
        enumerable: true,
        get() {
          getterCalls += 1;
          return true;
        },
      });
      break;
    case "security-nested-hidden":
      Object.defineProperty(request.targetDiscoveryResult.payload, "hidden", {
        enumerable: false,
        value: true,
      });
      break;
    case "security-nested-symbol":
      Object.defineProperty(request.targetDiscoveryResult.payload, Symbol("hostile"), {
        enumerable: true,
        value: true,
      });
      break;
    case "security-sparse-array":
      delete request.targetDiscoveryResult.payload.targets[0];
      break;
    case "security-cycle":
      request.targetDiscoveryResult.cycle = request.targetDiscoveryResult;
      break;
    case "security-alias":
      request.targetDiscoveryResult.payload.targets[1] =
        request.targetDiscoveryResult.payload.targets[0];
      break;
    case "security-async-mutation":
      break;
    default:
      throw new TypeError(`unknown hostile input case ${caseId}`);
  }
  return { input: request, getterCalls: () => getterCalls };
}

function publicFailureProjection(error) {
  if (error === null || typeof error !== "object") return undefined;
  return {
    errorName: error.name,
    code: error.code,
    reason: error.reason,
  };
}

export async function executeProviderTargetDiscoveryInvalidCase(
  golden,
  caseId,
  strictCryptoCapability,
) {
  const locator = locatorExecution(golden, caseId);
  if (locator !== undefined) {
    try {
      locator();
      return { kind: "unexpected_acceptance" };
    } catch {
      return {
        kind: "rejection",
        boundary: "locator_builder",
        stage: "locator",
        reason: "envelope_mismatch",
      };
    }
  }

  if (caseId === "security-async-mutation") {
    const { input } = hostileInputExecution(golden, caseId, strictCryptoCapability);
    const pending = validateProviderTargetDiscoveryPointClosureV1(input);
    input.targetDiscoveryResult.payload.targets[0].target.osBuildDigest = digest("f");
    const value = await pending;
    return {
      kind: "snapshot_acceptance",
      boundary: "snapshot_stability",
      authority: value.authority,
      observationCount: value.observationCount,
      targetCount: value.targetCount,
      unresolvedObservationCount: value.unresolvedObservationCount,
    };
  }

  const executable = caseId.startsWith("security-")
    ? hostileInputExecution(golden, caseId, strictCryptoCapability)
    : {
        input: {
          ...materializeInvalidRequest(golden, caseId),
          strictCryptoCapability,
        },
        getterCalls: () => 0,
      };
  const diagnostic = await diagnoseProviderTargetDiscoveryPointClosureV1(executable.input);
  if (executable.getterCalls() !== 0) {
    throw new Error(`${caseId} executed an attacker-owned getter`);
  }
  let publicFailure;
  try {
    await validateProviderTargetDiscoveryPointClosureV1(executable.input);
  } catch (error) {
    publicFailure = publicFailureProjection(error);
  }
  if (executable.getterCalls() !== 0) {
    throw new Error(`${caseId} executed an attacker-owned getter during public validation`);
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
