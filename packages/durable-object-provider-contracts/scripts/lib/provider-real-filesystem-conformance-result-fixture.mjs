import { canonicalizeJcsSafeIntegerUtf8V1 } from "../../dist/jcs.js";
import {
  ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  ProviderRealFilesystemConformanceResultLocatorV1Schema,
  ProviderRealFilesystemConformanceResultPinV1Schema,
  ProviderRealFilesystemConformanceResultV1Schema,
  buildProviderRealFilesystemConformanceResultRelativePathV1,
  deriveProviderRealFilesystemConformanceResultContentDigestV1,
  deriveProviderRealFilesystemConformanceResultIdV1,
} from "../../dist/provider-real-filesystem-conformance-result.js";
import {
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_CASE_IDS_V1,
  executeProviderRealFilesystemConformanceResultInvalidCaseV1,
  materializeProviderRealFilesystemConformanceResultInvalidRequestWitnessV1,
} from "../../dist/provider-real-filesystem-conformance-result-fixtures.js";

export const GOLDEN_RESOURCE_PATH =
  "fixtures/v1/golden/provider-real-filesystem-conformance-result-v1.json";
export const INVALID_RESOURCE_PATH =
  "fixtures/v1/invalid/provider-real-filesystem-conformance-result-v1.json";
export const GOLDEN_SEMANTIC_DOMAIN =
  "provider-real-filesystem-conformance-result-golden-manifest-v1";
export const INVALID_SEMANTIC_DOMAIN =
  "provider-real-filesystem-conformance-result-invalid-manifest-v1";
export const INVALID_MATERIALIZED_REQUEST_DOMAIN =
  "provider-real-filesystem-conformance-result-invalid-materialized-request-v1";
export const INVALID_RECIPE_DIALECT =
  "provider_real_filesystem_conformance_result_invalid_recipe_v1";

export const INVALID_CASE_IDS =
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_CASE_IDS_V1;
export const executeProviderRealFilesystemConformanceResultInvalidCase =
  executeProviderRealFilesystemConformanceResultInvalidCaseV1;
export const materializeInvalidRequestWitness =
  materializeProviderRealFilesystemConformanceResultInvalidRequestWitnessV1;

export function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(character) {
  return `sha256:${character.repeat(64)}`;
}

function aggregate(caseResults) {
  if (caseResults.some((entry) => entry.outcome === "failed")) return "failed";
  if (caseResults.some((entry) => entry.outcome === "unsupported")) return "unsupported";
  return "passed";
}

function idFields(payload) {
  const { profile: _profile, resultId: _resultId, ...fields } = payload;
  return fields;
}

function finalizeResult(base) {
  const result = base.result ?? aggregate(base.caseResults);
  const { profile: _profile, resultId: _oldResultId, result: _oldResult, ...fields } = base;
  const resultId = deriveProviderRealFilesystemConformanceResultIdV1({ ...fields, result });
  const payload = ProviderRealFilesystemConformanceResultV1Schema.parse({
    ...fields,
    profile: "provider_real_fs_conformance_result_v1",
    resultId,
    result,
  });
  const envelope = ProviderRealFilesystemConformanceResultEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_real_fs_conformance_result",
    resultId,
    contentDigest: deriveProviderRealFilesystemConformanceResultContentDigestV1(payload),
    payload,
  });
  const locator = ProviderRealFilesystemConformanceResultLocatorV1Schema.parse({
    locatorProfile: "installation_provider_real_fs_conformance_result_v1",
    resultId,
  });
  const pin = ProviderRealFilesystemConformanceResultPinV1Schema.parse({
    ...locator,
    contentDigest: envelope.contentDigest,
  });
  return { envelope, locator, pin };
}

function selectResultTarget(discovery, targetProfileId) {
  if (targetProfileId === undefined) {
    const first = discovery.payload.targets[0];
    if (first === undefined) {
      throw new TypeError("target discovery golden has no result target");
    }
    return first.target;
  }
  const matches = discovery.payload.targets.filter(
    (entry) => entry.target.targetProfileId === targetProfileId,
  );
  if (matches.length !== 1) {
    throw new TypeError(
      `target discovery golden must contain exactly one target ${targetProfileId}`,
    );
  }
  return matches[0].target;
}

function baseResult(discoveryGolden, providerId, targetProfileId) {
  const suite = discoveryGolden.suiteManifest;
  const discovery = discoveryGolden.targetDiscoveryResult;
  const caseResults = suite.payload.cases.flatMap((suiteCase) =>
    suiteCase.requiredCrashCuts.map((cut) => ({
      caseId: suiteCase.caseId,
      crashCutId: cut.crashCutId,
      outcome: "passed",
      resultCode: "passed",
    })),
  );
  return {
    profile: "provider_real_fs_conformance_result_v1",
    providerId,
    semanticProviderPolicyDigest: digest("a"),
    implementationDigest: digest("b"),
    binaryAttestationDigest: digest("c"),
    target: jsonClone(selectResultTarget(discovery, targetProfileId)),
    targetDiscoveryResult: {
      locatorProfile: "distribution_provider_target_discovery_result_v1",
      discoveryGeneration: discovery.payload.discoveryGeneration,
      contentDigest: discovery.contentDigest,
    },
    targetDiscoveryInputBundleContentDigest:
      discovery.payload.targetDiscoveryInputBundleContentDigest,
    realFilesystemSuiteManifest: {
      locatorProfile: "distribution_provider_real_fs_suite_manifest_v1",
      distributionRootBinding: jsonClone(suite.payload.distributionRootBinding),
      suiteDigest: suite.payload.suiteDigest,
      fixtureManifestDigest: suite.payload.fixtureCorpusManifest.fixtureManifestDigest,
      contentDigest: suite.contentDigest,
    },
    suiteDigest: suite.payload.suiteDigest,
    fixtureManifestDigest: suite.payload.fixtureCorpusManifest.fixtureManifestDigest,
    runnerProfileDigest: suite.payload.runnerProfileDigest,
    crashCutCoverageDigest: suite.payload.requiredCaseCutSetDigest,
    caseResults,
    result: "passed",
    completedAt: "2026-08-03T04:00:00Z",
  };
}

export function buildGoldenRealFilesystemConformanceResultFixture(
  discoveryGolden,
  options = {},
) {
  const providerId =
    options.providerId ?? "durable-object-provider:local-helper";
  const finalized = finalizeResult(
    baseResult(discoveryGolden, providerId, options.targetProfileId),
  );
  const resultIdPreimage = [
    "provider-real-fs-conformance-result-id-v1",
    idFields(finalized.envelope.payload),
  ];
  return {
    schemaVersion: 1,
    profile: "provider_real_filesystem_conformance_result_golden_v1",
    fixtureAuthority: "none_real_fs_conformance_result_structure_only",
    canonicalizationProfile: "rfc8785-jcs-safe-integer-v1",
    verificationProfile: "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
    distributionRootBinding: jsonClone(discoveryGolden.distributionRootBinding),
    activeRootMetadata: jsonClone(discoveryGolden.activeRootMetadata),
    activeRoot: jsonClone(discoveryGolden.activeRoot),
    fixtureCorpusManifest: jsonClone(discoveryGolden.fixtureCorpusManifest),
    suiteManifest: jsonClone(discoveryGolden.suiteManifest),
    publicSupportTaxonomy: jsonClone(discoveryGolden.publicSupportTaxonomy),
    releaseMatrix: jsonClone(discoveryGolden.releaseMatrix),
    targetDiscoveryFixtureManifest: jsonClone(discoveryGolden.targetDiscoveryFixtureManifest),
    targetDiscoveryRunnerRun: jsonClone(discoveryGolden.targetDiscoveryRunnerRun),
    targetDiscoveryResult: jsonClone(discoveryGolden.targetDiscoveryResult),
    realFilesystemConformanceResult: finalized.envelope,
    realFilesystemConformanceResultLocator: finalized.locator,
    realFilesystemConformanceResultPin: finalized.pin,
    expected: {
      resultIdPreimageCanonicalUtf8Hex: Buffer.from(
        canonicalizeJcsSafeIntegerUtf8V1(resultIdPreimage),
      ).toString("hex"),
      resultCanonicalUtf8Hex: Buffer.from(
        canonicalizeJcsSafeIntegerUtf8V1(finalized.envelope.payload),
      ).toString("hex"),
      relativePath: buildProviderRealFilesystemConformanceResultRelativePathV1(
        finalized.locator,
      ),
      caseResultCount: finalized.envelope.payload.caseResults.length,
      passedCaseResultCount: finalized.envelope.payload.caseResults.length,
      failedCaseResultCount: 0,
      unsupportedCaseResultCount: 0,
      targetMatchCount: 1,
      activeRootPointAdmissionCount: 1,
      signatureVerificationCount: 6,
      resultSignatureCount: 0,
      resultRunnerProfileSource: "signed_real_filesystem_suite_manifest",
    },
  };
}

export function requestFromGolden(golden, strictCryptoCapability) {
  return {
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
    realFilesystemConformanceResult: jsonClone(golden.realFilesystemConformanceResult),
    realFilesystemConformanceResultLocator: jsonClone(
      golden.realFilesystemConformanceResultLocator,
    ),
    realFilesystemConformanceResultPin: jsonClone(golden.realFilesystemConformanceResultPin),
    strictCryptoCapability,
  };
}
