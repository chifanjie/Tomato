import { createHash, createPrivateKey, sign } from "node:crypto";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../../dist/jcs.js";
import {
  ProviderFeasibilityEvidenceEnvelopeV1Schema,
  ProviderFeasibilityEvidenceUnsignedClaimsV1Schema,
  ProviderFeasibilityEvidenceV1Schema,
  createProviderFeasibilityEvidenceQaSignatureMessageV1,
  createProviderFeasibilityEvidenceReleaseSignatureMessageV1,
  deriveProviderFeasibilityEvidenceContentDigestV1,
  deriveProviderFeasibilityEvidenceIdV1,
  deriveProviderFeasibilityEvidencePinV1,
} from "../../dist/provider-feasibility-evidence-point.js";
import {
  ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  ProviderRealFilesystemConformanceResultV1Schema,
  deriveProviderRealFilesystemConformanceResultContentDigestV1,
  deriveProviderRealFilesystemConformanceResultIdV1,
} from "../../dist/provider-real-filesystem-conformance-result.js";
import {
  StoreDurableObjectProviderRuntimeAttestationPinV1Schema,
  StoreDurableObjectProviderRuntimeAttestationV1Schema,
  createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1,
  deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1,
} from "../../dist/provider-registry-records.js";
import { buildGoldenRealFilesystemConformanceResultFixture } from "./provider-real-filesystem-conformance-result-fixture.mjs";
import { buildGoldenProviderRuntimeAttestationPointFixture } from "./provider-runtime-attestation-point-fixture.mjs";
import {
  NATIVE_B_PROVIDER_ID,
  QA_APPROVER_SEED_HEX,
  RELEASE_APPROVER_SEED_HEX,
  ROOT_3_SEED_HEX,
  buildCompatibleBaseFixture,
} from "./provider-registry-evidence-binding-point-fixture.mjs";
import {
  buildSignedUniverseEnvelope,
} from "./provider-release-target-universe-point-fixture.mjs";
import { deriveProviderTargetProfileIdV1 } from "../../dist/provider-target-discovery-point.js";
import { buildGoldenTargetDiscoveryPointFixture } from "./provider-target-discovery-point-fixture.mjs";

export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_DOMAIN_V1 =
  "provider-feasibility-support-catalog-v1";
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_SIGNATURE_DOMAIN_V1 =
  "provider-feasibility-support-catalog-signature-v1";
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_SIGNATURE_PREFIX_V1 =
  "provider-support-catalog-ed25519";
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_LOCATOR_PROFILE_V1 =
  "distribution_provider_feasibility_support_catalog_v1";

export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POSITIVE_VECTOR_DEFINITIONS =
  Object.freeze([
    Object.freeze({
      vectorId: "both-passed-strong",
      secondResult: "passed",
      secondReleaseDisposition: "strong_read_write",
      expectedPublicCapability: "strong_read_write",
    }),
    Object.freeze({
      vectorId: "second-passed-read-only",
      secondResult: "passed",
      secondReleaseDisposition: "legacy_redacted_read_only",
      expectedPublicCapability: "legacy_redacted_read_only",
    }),
    Object.freeze({
      vectorId: "second-failed-read-only",
      secondResult: "failed",
      secondReleaseDisposition: "legacy_redacted_read_only",
      expectedPublicCapability: "legacy_redacted_read_only",
    }),
    Object.freeze({
      vectorId: "second-unsupported-read-only",
      secondResult: "unsupported",
      secondReleaseDisposition: "legacy_redacted_read_only",
      expectedPublicCapability: "legacy_redacted_read_only",
    }),
  ]);

export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POSITIVE_VECTOR_IDS =
  Object.freeze(
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POSITIVE_VECTOR_DEFINITIONS.map(
      (definition) => definition.vectorId,
    ),
  );

export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_INVALID_MATERIALIZED_CASE_DEFINITIONS =
  Object.freeze([
    Object.freeze({
      caseId: "catalog-target-missing",
      stage: "catalog_target_exact_cover",
      reason: "coverage_mismatch",
    }),
    Object.freeze({
      caseId: "catalog-target-extra",
      stage: "catalog_target_exact_cover",
      reason: "coverage_mismatch",
    }),
    Object.freeze({
      caseId: "catalog-target-duplicate",
      stage: "catalog_target_order",
      reason: "ordering_invalid",
    }),
    Object.freeze({
      caseId: "catalog-provider-duplicate",
      stage: "catalog_candidate_order",
      reason: "ordering_invalid",
    }),
    Object.freeze({
      caseId: "catalog-evidence-cross-group",
      stage: "catalog_candidate_binding",
      reason: "binding_mismatch",
    }),
    Object.freeze({
      caseId: "catalog-failed-strong",
      stage: "catalog_release_disposition",
      reason: "result_not_passed",
    }),
    Object.freeze({
      caseId: "catalog-unsupported-strong",
      stage: "catalog_release_disposition",
      reason: "result_not_passed",
    }),
  ]);

export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_INVALID_MATERIALIZED_CASE_IDS =
  Object.freeze(
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_INVALID_MATERIALIZED_CASE_DEFINITIONS.map(
      (definition) => definition.caseId,
    ),
  );

export function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
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

function rawSignatureHex(seedHex, message) {
  return sign(
    null,
    Buffer.from(message),
    privateKeyFromSeedHex(seedHex),
  ).toString("hex");
}

function digestForDomain(domain, fields) {
  return `sha256:${createHash("sha256")
    .update(canonicalizeJcsSafeIntegerUtf8V1([domain, fields]))
    .digest("hex")}`;
}

function catalogUnsignedClaims(payload) {
  const claims = jsonClone(payload);
  delete claims.catalogSignature;
  return claims;
}

function createCatalogSignatureMessage(payload, rootKeyId) {
  const domain = PROVIDER_FEASIBILITY_SUPPORT_CATALOG_SIGNATURE_DOMAIN_V1;
  return canonicalizeJcsSafeIntegerUtf8V1([
    domain,
    {
      rootKeyId,
      domain,
      claims: catalogUnsignedClaims(payload),
    },
  ]);
}

function finalizeResult(base) {
  const draft = jsonClone(base);
  delete draft.profile;
  delete draft.resultId;
  const resultId = deriveProviderRealFilesystemConformanceResultIdV1(draft);
  const payload = ProviderRealFilesystemConformanceResultV1Schema.parse({
    ...draft,
    profile: "provider_real_fs_conformance_result_v1",
    resultId,
  });
  return ProviderRealFilesystemConformanceResultEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_real_fs_conformance_result",
    resultId,
    contentDigest:
      deriveProviderRealFilesystemConformanceResultContentDigestV1(payload),
    payload,
  });
}

function finalizeRuntime(base, rootKeyId, rootSeedHex) {
  const unsigned = jsonClone(base);
  delete unsigned.registrySignature;
  const message =
    createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
      unsigned,
      rootKeyId,
    );
  const payload = StoreDurableObjectProviderRuntimeAttestationV1Schema.parse({
    ...unsigned,
    registrySignature:
      `provider-registry-ed25519:${rootKeyId}:${rawSignatureHex(
        rootSeedHex,
        message,
      )}`,
  });
  return StoreDurableObjectProviderRuntimeAttestationPinV1Schema.parse({
    profile: "store_durable_object_provider_runtime_attestation_pin_v1",
    contentDigest:
      deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1(
        payload,
      ),
    payload,
  });
}

function evidenceSignature(role, keyId, seedHex, message) {
  return `provider-feasibility-ed25519:${role}:${keyId}:${rawSignatureHex(
    seedHex,
    message,
  )}`;
}

function finalizeEvidence({
  resultEnvelope,
  runtimeAttestation,
  semanticProviderPolicy,
  qaApproverPublicKey,
  releaseApproverPublicKey,
}) {
  const result = resultEnvelope.payload;
  const draft = {
    profile: "provider_feasibility_evidence_v1",
    evidenceId: "provider-feasibility-evidence:0000000000000000000000",
    providerId: result.providerId,
    semanticProviderPolicyDigest: result.semanticProviderPolicyDigest,
    runtimeAttestationContentDigest: runtimeAttestation.contentDigest,
    implementationDigest: result.implementationDigest,
    binaryAttestationDigest: result.binaryAttestationDigest,
    target: jsonClone(result.target),
    isolationSecurityBoundaryProfileDigest:
      semanticProviderPolicy.isolation.securityBoundaryProfileDigest,
    ipcPeerAuthenticationPolicyDigest:
      semanticProviderPolicy.ipcPeerAuthenticationPolicyDigest,
    realFilesystemSuiteDigest: result.suiteDigest,
    realFilesystemConformanceResult: {
      locatorProfile: "installation_provider_real_fs_conformance_result_v1",
      resultId: resultEnvelope.resultId,
      contentDigest: resultEnvelope.contentDigest,
    },
    realFilesystemConformanceResultDigest: resultEnvelope.contentDigest,
    fixtureManifestDigest: result.fixtureManifestDigest,
    runnerProfileDigest: result.runnerProfileDigest,
    crashCutCoverageDigest: result.crashCutCoverageDigest,
    result: result.result,
    issuedAt: runtimeAttestation.payload.issuedAt,
  };
  const {
    profile: _profile,
    evidenceId: _placeholderEvidenceId,
    ...evidenceIdFields
  } = draft;
  draft.evidenceId = deriveProviderFeasibilityEvidenceIdV1(evidenceIdFields);
  const unsigned = ProviderFeasibilityEvidenceUnsignedClaimsV1Schema.parse(
    draft,
  );
  const qaMessage = createProviderFeasibilityEvidenceQaSignatureMessageV1(
    unsigned,
    qaApproverPublicKey.keyId,
  );
  const releaseMessage =
    createProviderFeasibilityEvidenceReleaseSignatureMessageV1(
      unsigned,
      releaseApproverPublicKey.keyId,
    );
  const payload = ProviderFeasibilityEvidenceV1Schema.parse({
    ...unsigned,
    qaSignature: evidenceSignature(
      "qa",
      qaApproverPublicKey.keyId,
      QA_APPROVER_SEED_HEX,
      qaMessage,
    ),
    releaseSignature: evidenceSignature(
      "release",
      releaseApproverPublicKey.keyId,
      RELEASE_APPROVER_SEED_HEX,
      releaseMessage,
    ),
  });
  const envelope = ProviderFeasibilityEvidenceEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_feasibility_evidence",
    evidenceId: payload.evidenceId,
    contentDigest: deriveProviderFeasibilityEvidenceContentDigestV1(payload),
    payload,
  });
  return {
    envelope,
    pin: deriveProviderFeasibilityEvidencePinV1(envelope),
  };
}

export function buildProviderFeasibilitySupportCandidateFixture({
  discovery,
  targetProfileId,
  qaApproverPublicKey,
  releaseApproverPublicKey,
  providerId = NATIVE_B_PROVIDER_ID,
  result = "passed",
  releaseDisposition = "strong_read_write",
  rootSeedHex = ROOT_3_SEED_HEX,
}) {
  if (!new Set(["passed", "failed", "unsupported"]).has(result)) {
    throw new TypeError(`unsupported fixture result ${result}`);
  }
  const conformance = buildGoldenRealFilesystemConformanceResultFixture(
    discovery,
    { providerId, targetProfileId },
  );
  const runtime = buildGoldenProviderRuntimeAttestationPointFixture(
    conformance,
    rootSeedHex,
  );
  let resultEnvelope = runtime.realFilesystemConformanceResult;
  let runtimeAttestation = runtime.runtimeAttestation;
  if (result !== "passed") {
    const resultDraft = jsonClone(resultEnvelope.payload);
    const firstCase = resultDraft.caseResults[0];
    if (firstCase === undefined) {
      throw new TypeError("candidate fixture result has no required case");
    }
    firstCase.outcome = result;
    firstCase.resultCode =
      result === "failed"
        ? "assertion_failed"
        : "unsupported_by_target_profile";
    resultDraft.result = result;
    resultEnvelope = finalizeResult(resultDraft);
    runtimeAttestation = finalizeRuntime(
      {
        ...jsonClone(runtimeAttestation.payload),
        realFilesystemConformanceResultDigest: resultEnvelope.contentDigest,
      },
      discovery.activeRoot.rootKeyId,
      rootSeedHex,
    );
  }
  const evidence = finalizeEvidence({
    resultEnvelope,
    runtimeAttestation,
    semanticProviderPolicy: runtime.semanticProviderPolicy,
    qaApproverPublicKey,
    releaseApproverPublicKey,
  });
  return {
    catalogCandidate: {
      providerId,
      providerFeasibilityEvidence: jsonClone(evidence.pin),
      semanticProviderPolicy: jsonClone(runtime.semanticProviderPolicy),
      runtimeAttestation: jsonClone(runtimeAttestation),
      releaseDisposition,
    },
    candidateArtifact: {
      providerFeasibilityEvidence: jsonClone(evidence.envelope),
      realFilesystemConformanceResult: jsonClone(resultEnvelope),
    },
    conformance,
    runtime,
    resultEnvelope,
    runtimeAttestation,
    evidence,
  };
}

export function resignProviderFeasibilitySupportCatalogEnvelopeFixture(
  rawEnvelope,
  { rootKeyId, rootSeedHex = ROOT_3_SEED_HEX },
) {
  const envelope = jsonClone(rawEnvelope);
  const unsigned = catalogUnsignedClaims(envelope.payload);
  const message = createCatalogSignatureMessage(unsigned, rootKeyId);
  const payload = {
    ...unsigned,
    catalogSignature:
      `${PROVIDER_FEASIBILITY_SUPPORT_CATALOG_SIGNATURE_PREFIX_V1}:` +
      `${rootKeyId}:${rawSignatureHex(rootSeedHex, message)}`,
  };
  envelope.schemaVersion = 1;
  envelope.recordType = "provider_feasibility_support_catalog";
  envelope.catalogGeneration = payload.catalogGeneration;
  envelope.contentDigest = digestForDomain(
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_DOMAIN_V1,
    unsigned,
  );
  envelope.payload = payload;
  return envelope;
}

export function deriveProviderFeasibilitySupportCatalogPinFixture(envelope) {
  return {
    locatorProfile:
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_LOCATOR_PROFILE_V1,
    catalogGeneration: envelope.catalogGeneration,
    contentDigest: envelope.contentDigest,
  };
}

function deriveOwnerTargetCapabilities(targets, candidateFixtures) {
  return targets.map((entry, index) => ({
    target: jsonClone(entry.target),
    capability:
      candidateFixtures[index].evidence.envelope.payload.result === "passed" &&
      candidateFixtures[index].catalogCandidate.releaseDisposition ===
        "strong_read_write"
        ? "strong_read_write"
        : "legacy_redacted_read_only",
  }));
}

function derivePublicSupport(universe, ownerTargetCapabilities) {
  const capabilities = new Map(
    ownerTargetCapabilities.map((entry) => [
      entry.target.targetProfileId,
      entry.capability,
    ]),
  );
  return universe.payload.buckets.map((bucket) => ({
    profile: "provider_feasibility_public_support_v1",
    publicProfileId: bucket.publicProfileId,
    osPlatform: bucket.osPlatform,
    osReleaseFamilyCode: bucket.osReleaseFamilyCode,
    architecture: bucket.architecture,
    filesystemProfileCode: bucket.filesystemProfileCode,
    capability:
      bucket.coverage.coverageState === "closed_world_complete" &&
      bucket.coverage.targetProfileIds.every(
        (targetProfileId) =>
          capabilities.get(targetProfileId) === "strong_read_write",
      )
        ? "strong_read_write"
        : "legacy_redacted_read_only",
  }));
}

function assertSamePublicProfileTwoTargetUniverse(
  discovery,
  releaseTargetUniverse,
) {
  const targets = discovery.releaseMatrix.payload.targets;
  if (targets.length !== 2) {
    throw new TypeError("Catalog point golden requires exactly two targets");
  }
  const [first, second] = targets;
  const publicFields = [
    "osPlatform",
    "osReleaseFamilyCode",
    "architecture",
    "filesystemProfileCode",
  ];
  for (const field of publicFields) {
    if (first.target[field] !== second.target[field]) {
      throw new TypeError(
        `Catalog point golden targets differ at public field ${field}`,
      );
    }
  }
  const privateFields = [
    "osBuildDigest",
    "filesystemFeatureProfileDigest",
    "mountOptionProfileDigest",
  ];
  for (const field of privateFields) {
    if (first.target[field] === second.target[field]) {
      throw new TypeError(
        `Catalog point golden targets do not differ at private field ${field}`,
      );
    }
  }
  if (first.publicProfileId !== second.publicProfileId) {
    throw new TypeError(
      "Catalog point golden targets do not share one public profile",
    );
  }
  const buckets = releaseTargetUniverse.payload.buckets;
  if (
    buckets.length !== 1 ||
    buckets[0].publicProfileId !== first.publicProfileId ||
    buckets[0].coverage.coverageState !== "closed_world_complete" ||
    buckets[0].coverage.targetProfileIds.length !== 2
  ) {
    throw new TypeError(
      "Catalog point golden Universe is not one closed-world two-target bucket",
    );
  }
}

function buildSamePublicProfileDiscovery(sourceGolden) {
  const template = buildGoldenTargetDiscoveryPointFixture(sourceGolden, {
    emptyObservationManifests: true,
  });
  const first = jsonClone(template.releaseMatrix.payload.targets[0]);
  if (first === undefined) {
    throw new TypeError("Catalog point golden target template is empty");
  }
  const secondFields = {
    osPlatform: first.target.osPlatform,
    osReleaseFamilyCode: first.target.osReleaseFamilyCode,
    osBuildDigest: `sha256:${"d".repeat(64)}`,
    architecture: first.target.architecture,
    filesystemProfileCode: first.target.filesystemProfileCode,
    filesystemFeatureProfileDigest: `sha256:${"e".repeat(64)}`,
    mountOptionProfileDigest: `sha256:${"f".repeat(64)}`,
  };
  const second = {
    target: {
      targetProfileId: deriveProviderTargetProfileIdV1(secondFields),
      ...secondFields,
    },
    publicProfileId: first.publicProfileId,
  };
  return buildGoldenTargetDiscoveryPointFixture(sourceGolden, {
    emptyObservationManifests: true,
    targets: [first, second],
  });
}

function buildPositiveVector({
  compatible,
  discovery,
  releaseTargetUniverse,
  definition,
}) {
  const targetEntries = releaseTargetUniverse.payload.targets;
  const candidateFixtures = targetEntries.map((entry, index) =>
    buildProviderFeasibilitySupportCandidateFixture({
      discovery,
      targetProfileId: entry.target.targetProfileId,
      qaApproverPublicKey: compatible.qaApproverPublicKey,
      releaseApproverPublicKey: compatible.releaseApproverPublicKey,
      result: index === 1 ? definition.secondResult : "passed",
      releaseDisposition:
        index === 1
          ? definition.secondReleaseDisposition
          : "strong_read_write",
    }),
  );
  const catalogUnsigned = {
    profile: "provider_feasibility_support_catalog_v1",
    distributionRootBinding: jsonClone(discovery.distributionRootBinding),
    activeRootMetadata: jsonClone(discovery.activeRootMetadata),
    registryRootKeyId: discovery.activeRoot.rootKeyId,
    catalogGeneration: 1,
    feasibilityApprovalKeys: jsonClone(
      compatible.nativeBEntry.entry.feasibilityApprovalKeys,
    ),
    publicSupportTaxonomy: jsonClone(
      releaseTargetUniverse.payload.publicSupportTaxonomy,
    ),
    releaseTargetUniverse: {
      locatorProfile: "distribution_provider_release_target_universe_v1",
      universeGeneration: releaseTargetUniverse.universeGeneration,
      contentDigest: releaseTargetUniverse.contentDigest,
    },
    targets: targetEntries.map((entry, index) => ({
      target: jsonClone(entry.target),
      candidates: [jsonClone(candidateFixtures[index].catalogCandidate)],
    })),
  };
  const providerFeasibilitySupportCatalog =
    resignProviderFeasibilitySupportCatalogEnvelopeFixture(
      {
        schemaVersion: 1,
        recordType: "provider_feasibility_support_catalog",
        catalogGeneration: 1,
        contentDigest: `sha256:${"0".repeat(64)}`,
        payload: catalogUnsigned,
      },
      {
        rootKeyId: discovery.activeRoot.rootKeyId,
        rootSeedHex: ROOT_3_SEED_HEX,
      },
    );
  const ownerTargetCapabilities = deriveOwnerTargetCapabilities(
    targetEntries,
    candidateFixtures,
  );
  const publicSupport = derivePublicSupport(
    releaseTargetUniverse,
    ownerTargetCapabilities,
  );
  if (
    publicSupport.length !== 1 ||
    publicSupport[0].capability !== definition.expectedPublicCapability
  ) {
    throw new TypeError(
      `Catalog point ${definition.vectorId} public projection mismatch`,
    );
  }
  return {
    vectorId: definition.vectorId,
    providerFeasibilitySupportCatalog,
    providerFeasibilitySupportCatalogPin:
      deriveProviderFeasibilitySupportCatalogPinFixture(
        providerFeasibilitySupportCatalog,
      ),
    providerFeasibilitySupportCandidateArtifacts: candidateFixtures.map(
      (candidate) => jsonClone(candidate.candidateArtifact),
    ),
    candidateFixtures,
    expected: {
      authority:
        "none_provider_feasibility_support_catalog_structure_only",
      ownerTargetCapabilities,
      publicSupport,
    },
  };
}

export function buildGoldenProviderFeasibilitySupportCatalogPointFixture({
  rootGolden,
  registryGolden,
  sourceGolden,
}) {
  const compatible = buildCompatibleBaseFixture({
    rootGolden,
    registryGolden,
    sourceGolden,
  });
  const discovery = buildSamePublicProfileDiscovery(compatible.source);
  const releaseTargetUniverse = buildSignedUniverseEnvelope(discovery);
  assertSamePublicProfileTwoTargetUniverse(
    discovery,
    releaseTargetUniverse,
  );
  const positiveVectors =
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POSITIVE_VECTOR_DEFINITIONS.map(
      (definition) =>
        buildPositiveVector({
          compatible,
          discovery,
          releaseTargetUniverse,
          definition,
        }),
    );
  const baseline = positiveVectors[0];
  if (baseline === undefined) {
    throw new TypeError("Catalog point golden has no baseline vector");
  }
  return {
    compatible,
    discovery,
    releaseTargetUniverse,
    positiveVectors,
    ...baseline,
  };
}

export function requestFromGoldenProviderFeasibilitySupportCatalogPositiveVectorFixture(
  golden,
  vectorId,
  strictCryptoCapability,
) {
  const vector = golden.positiveVectors.find(
    (candidate) => candidate.vectorId === vectorId,
  );
  if (vector === undefined) {
    throw new TypeError(`unknown Catalog positive vector ${vectorId}`);
  }
  return requestFromGoldenProviderFeasibilitySupportCatalogPointFixture(
    { ...golden, ...vector },
    strictCryptoCapability,
  );
}

export function requestFromGoldenProviderFeasibilitySupportCatalogPointFixture(
  golden,
  strictCryptoCapability,
) {
  const base = golden.compatible.compatibleBase;
  const discovery = golden.discovery;
  return {
    activeRoot: jsonClone(discovery.activeRoot),
    activeRootMetadata: jsonClone(discovery.activeRootMetadata),
    bootstrapTrustBundle: jsonClone(base.bootstrapTrustBundle),
    distributionRootBinding: jsonClone(discovery.distributionRootBinding),
    fixtureCorpusManifest: jsonClone(discovery.fixtureCorpusManifest),
    installationIdentityGenerationId:
      base.installationIdentityGenerationId,
    providerFeasibilitySupportCandidateArtifacts: jsonClone(
      golden.providerFeasibilitySupportCandidateArtifacts,
    ),
    providerFeasibilitySupportCatalog: jsonClone(
      golden.providerFeasibilitySupportCatalog,
    ),
    publicSupportTaxonomy: jsonClone(discovery.publicSupportTaxonomy),
    registryManifestHistory: jsonClone(base.registryManifestHistory),
    releaseMatrix: jsonClone(discovery.releaseMatrix),
    releaseTargetUniverse: jsonClone(golden.releaseTargetUniverse),
    rootMetadataHistory: jsonClone(base.rootMetadataHistory),
    strictCryptoCapability,
    suiteManifest: jsonClone(discovery.suiteManifest),
    targetDiscoveryFixtureManifest: jsonClone(
      discovery.targetDiscoveryFixtureManifest,
    ),
    targetDiscoveryResult: jsonClone(discovery.targetDiscoveryResult),
    targetDiscoveryRunnerRun: jsonClone(
      discovery.targetDiscoveryRunnerRun,
    ),
  };
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function invalidCaseDefinition(caseId) {
  const definition =
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_INVALID_MATERIALIZED_CASE_DEFINITIONS.find(
      (candidate) => candidate.caseId === caseId,
    );
  if (definition === undefined) {
    throw new TypeError(`unknown Catalog invalid materialized case ${caseId}`);
  }
  return definition;
}

function requestWithoutCapability(golden) {
  const request =
    requestFromGoldenProviderFeasibilitySupportCatalogPointFixture(
      golden,
      undefined,
    );
  delete request.strictCryptoCapability;
  return request;
}

function replaceFirstCandidateWithResult(golden, request, result) {
  const group = request.providerFeasibilitySupportCatalog.payload.targets[0];
  if (group === undefined) {
    throw new TypeError("Catalog invalid fixture has no first target group");
  }
  const replacement = buildProviderFeasibilitySupportCandidateFixture({
    discovery: golden.discovery,
    targetProfileId: group.target.targetProfileId,
    qaApproverPublicKey: golden.compatible.qaApproverPublicKey,
    releaseApproverPublicKey:
      golden.compatible.releaseApproverPublicKey,
    result,
    releaseDisposition: "strong_read_write",
  });
  group.candidates = [jsonClone(replacement.catalogCandidate)];
  request.providerFeasibilitySupportCandidateArtifacts[0] = jsonClone(
    replacement.candidateArtifact,
  );
}

export function buildProviderFeasibilitySupportCatalogInvalidMaterializedRequestCaseFixture(
  golden,
  caseId,
) {
  const definition = invalidCaseDefinition(caseId);
  const request = requestWithoutCapability(golden);
  const groups = request.providerFeasibilitySupportCatalog.payload.targets;
  const first = groups[0];
  const second = groups[1];
  if (first === undefined || second === undefined) {
    throw new TypeError(
      "Catalog invalid fixture requires exactly two baseline target groups",
    );
  }
  switch (caseId) {
    case "catalog-target-missing":
      groups.splice(1, 1);
      break;
    case "catalog-target-extra": {
      const extra = jsonClone(first);
      const fields = {
        osPlatform: extra.target.osPlatform,
        osReleaseFamilyCode: extra.target.osReleaseFamilyCode,
        osBuildDigest: `sha256:${"a".repeat(64)}`,
        architecture: extra.target.architecture,
        filesystemProfileCode: extra.target.filesystemProfileCode,
        filesystemFeatureProfileDigest: `sha256:${"b".repeat(64)}`,
        mountOptionProfileDigest: `sha256:${"c".repeat(64)}`,
      };
      extra.target = {
        targetProfileId: deriveProviderTargetProfileIdV1(fields),
        ...fields,
      };
      groups.push(extra);
      groups.sort((left, right) =>
        compareUtf8(
          left.target.targetProfileId,
          right.target.targetProfileId,
        ),
      );
      break;
    }
    case "catalog-target-duplicate":
      groups.splice(1, 0, jsonClone(first));
      break;
    case "catalog-provider-duplicate":
      first.candidates.push(jsonClone(first.candidates[0]));
      break;
    case "catalog-evidence-cross-group": {
      const firstCandidates = first.candidates;
      first.candidates = second.candidates;
      second.candidates = firstCandidates;
      break;
    }
    case "catalog-failed-strong":
      replaceFirstCandidateWithResult(golden, request, "failed");
      break;
    case "catalog-unsupported-strong":
      replaceFirstCandidateWithResult(golden, request, "unsupported");
      break;
    default:
      throw new TypeError(`unhandled Catalog invalid materialized case ${caseId}`);
  }
  request.providerFeasibilitySupportCatalog =
    resignProviderFeasibilitySupportCatalogEnvelopeFixture(
      request.providerFeasibilitySupportCatalog,
      { rootKeyId: golden.discovery.activeRoot.rootKeyId },
    );
  return {
    caseId: definition.caseId,
    request,
    expected: {
      stage: definition.stage,
      reason: definition.reason,
    },
  };
}

export function buildProviderFeasibilitySupportCatalogInvalidMaterializedRequestCasesFixture(
  golden,
) {
  return PROVIDER_FEASIBILITY_SUPPORT_CATALOG_INVALID_MATERIALIZED_CASE_IDS.map(
    (caseId) =>
      buildProviderFeasibilitySupportCatalogInvalidMaterializedRequestCaseFixture(
        golden,
        caseId,
      ),
  );
}
