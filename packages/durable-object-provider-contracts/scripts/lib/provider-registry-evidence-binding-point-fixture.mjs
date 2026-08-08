import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
} from "node:crypto";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../../dist/jcs.js";
import {
  deriveProviderBootstrapTrustBundleContentDigestV1,
} from "../../dist/bootstrap-trust-bundle.js";
import {
  deriveProviderSignedPackageIdentityDigestV1,
} from "../../dist/provider-distribution-trust.js";
import {
  ProviderFeasibilityEvidenceEnvelopeV1Schema,
  ProviderFeasibilityEvidenceUnsignedClaimsV1Schema,
  ProviderFeasibilityEvidenceV1Schema,
  buildProviderFeasibilityEvidenceRelativePathV1,
  createProviderFeasibilityEvidenceQaSignatureMessageV1,
  createProviderFeasibilityEvidenceReleaseSignatureMessageV1,
  deriveProviderFeasibilityEvidenceContentDigestV1,
  deriveProviderFeasibilityEvidenceIdV1,
  deriveProviderFeasibilityEvidencePinV1,
} from "../../dist/provider-feasibility-evidence-point.js";
import {
  ProviderFeasibilityApproverPublicKeyV1Schema,
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestV1Schema,
  StoreDurableObjectProviderRegistryEntryV1Schema,
  createProviderFeasibilityApproverPublicKeySignatureMessageV1,
  createProviderRegistryManifestSignatureMessageV1,
  createStoreDurableObjectProviderRegistryEntrySignatureMessageV1,
  deriveProviderFeasibilityApproverKeyIdV1,
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
  deriveStoreDurableObjectProviderRegistryEntryContentDigestV1,
  projectStoreDurableObjectProviderRegistryEntryUnsignedClaimsV1,
} from "../../dist/provider-registry-records.js";
import {
  deriveProviderEd25519PublicKeyDigestInternalV1,
} from "../../dist/provider-registry-trust.js";
import {
  deriveStoreDurableObjectProviderPolicyDigestV1,
} from "../../dist/provider-runtime-attestation-point.js";
import { buildGoldenRealFilesystemConformanceResultFixture } from "./provider-real-filesystem-conformance-result-fixture.mjs";
import { buildGoldenSourceFixture } from "./provider-real-filesystem-source-fixture.mjs";
import { buildGoldenProviderRuntimeAttestationPointFixture } from "./provider-runtime-attestation-point-fixture.mjs";
import { buildGoldenTargetDiscoveryPointFixture } from "./provider-target-discovery-point-fixture.mjs";

export const GOLDEN_RESOURCE_PATH =
  "fixtures/v1/golden/provider-registry-evidence-binding-point-v1.json";
export const GOLDEN_SEMANTIC_DOMAIN =
  "provider-registry-evidence-binding-point-golden-manifest-v1";
export const NATIVE_B_PROVIDER_ID = "durable-object-provider:native-b";
export const ROOT_3_SEED_HEX = "30".repeat(32);
export const QA_APPROVER_SEED_HEX = "7b".repeat(32);
export const RELEASE_APPROVER_SEED_HEX = "7c".repeat(32);

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

function publicKeyBytesFromSeedHex(seedHex) {
  const der = createPublicKey(privateKeyFromSeedHex(seedHex)).export({
    format: "der",
    type: "spki",
  });
  return `base64url:${der.subarray(der.byteLength - 32).toString("base64url")}`;
}

function rawSignatureHex(seedHex, message) {
  return sign(
    null,
    Buffer.from(message),
    privateKeyFromSeedHex(seedHex),
  ).toString("hex");
}

function registrySignature(rootKeyId, seedHex, message) {
  return `provider-registry-ed25519:${rootKeyId}:${rawSignatureHex(
    seedHex,
    message,
  )}`;
}

function manifestSignature(rootKeyId, seedHex, message) {
  return `provider-registry-manifest-ed25519:${rootKeyId}:${rawSignatureHex(
    seedHex,
    message,
  )}`;
}

function evidenceSignature(role, keyId, seedHex, message) {
  return `provider-feasibility-ed25519:${role}:${keyId}:${rawSignatureHex(
    seedHex,
    message,
  )}`;
}

function canonicalEqual(left, right) {
  return Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(left)).equals(
    Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(right)),
  );
}

function findNativeBEntry(registryGolden) {
  const tip = registryGolden.registryManifestHistory.at(-1);
  const member = tip?.payload.members.find(
    (candidate) =>
      candidate.providerId === NATIVE_B_PROVIDER_ID &&
      candidate.disposition === "enabled",
  );
  if (member === undefined) {
    throw new Error("Registry golden has no enabled native-b tip member");
  }
  return member.registryEntry;
}

function assertFrozenDependencyShape(
  rootGolden,
  registryGolden,
  sourceGolden,
) {
  if (
    rootGolden.rootMetadataHistory?.length !== 3 ||
    registryGolden.registryManifestHistory?.length !== 7 ||
    registryGolden.rootMetadataHistory?.length !== 3 ||
    sourceGolden.activeRootMetadata?.rootGeneration !== 3 ||
    sourceGolden.deterministicRootSeedHex !== ROOT_3_SEED_HEX
  ) {
    throw new Error("compatible-base dependencies changed topology");
  }
  const root3 = rootGolden.rootMetadataHistory[2];
  if (
    !canonicalEqual(root3, registryGolden.rootMetadataHistory[2]) ||
    !canonicalEqual(root3.payload.activeRoot, sourceGolden.activeRoot) ||
    root3.rootKeyId !== sourceGolden.activeRoot.rootKeyId
  ) {
    throw new Error("compatible-base dependencies do not share Root 3");
  }
  const seedDefinitions = registryGolden.deterministicSeeds
    ?.feasibilityApproverKeySeeds;
  if (
    seedDefinitions?.find(({ role }) => role === "qa")?.seedHex !==
      QA_APPROVER_SEED_HEX ||
    seedDefinitions?.find(({ role }) => role === "release")?.seedHex !==
      RELEASE_APPROVER_SEED_HEX
  ) {
    throw new Error("Registry 7b/7c approver seeds drifted");
  }
}

function assertGeneratedDistributionMatchesFrozenSource(
  sourceGolden,
  generatedSource,
  generatedDiscovery,
) {
  for (const key of ["activeRootMetadata", "activeRoot"]) {
    if (!canonicalEqual(sourceGolden[key], generatedSource[key])) {
      throw new Error(`generated Source field ${key} drifted`);
    }
  }
  for (const key of [
    "distributionRootBinding",
    "activeRootMetadata",
    "activeRoot",
    "fixtureCorpusManifest",
    "suiteManifest",
  ]) {
    if (!canonicalEqual(generatedSource[key], generatedDiscovery[key])) {
      throw new Error(`generated Discovery source field ${key} drifted`);
    }
  }
}

function buildCompatibleDistributionRootBinding(
  sourceGolden,
  bootstrapTrustBundle,
) {
  const frozenBinding = sourceGolden.distributionRootBinding;
  const fields = {
    resolverProfile: frozenBinding.resolverProfile,
    releaseRevisionDigest: frozenBinding.releaseRevisionDigest,
    bootstrapTrustBundle: {
      locatorProfile: "distribution_provider_bootstrap_trust_bundle_v1",
      contentDigest:
        deriveProviderBootstrapTrustBundleContentDigestV1(
          bootstrapTrustBundle,
        ),
    },
    historyPolicy: jsonClone(frozenBinding.historyPolicy),
  };
  const compatibleBinding = {
    profile: "provider_signed_distribution_root_binding_v1",
    signedPackageIdentityDigest:
      deriveProviderSignedPackageIdentityDigestV1(fields),
    ...fields,
  };
  if (
    compatibleBinding.bootstrapTrustBundle.contentDigest ===
      frozenBinding.bootstrapTrustBundle.contentDigest ||
    !canonicalEqual(
      {
        resolverProfile: compatibleBinding.resolverProfile,
        releaseRevisionDigest: compatibleBinding.releaseRevisionDigest,
        historyPolicy: compatibleBinding.historyPolicy,
      },
      {
        resolverProfile: frozenBinding.resolverProfile,
        releaseRevisionDigest: frozenBinding.releaseRevisionDigest,
        historyPolicy: frozenBinding.historyPolicy,
      },
    )
  ) {
    throw new Error("compatible distribution bootstrap rebind drifted");
  }
  return compatibleBinding;
}

function findApproverRecords(entry) {
  const records = entry.feasibilityApprovalKeys.publicKeyRecords;
  const qa = records.find(({ role }) => role === "qa");
  const release = records.find(({ role }) => role === "release");
  if (
    qa === undefined ||
    release === undefined ||
    qa.publicKeyBytes !== publicKeyBytesFromSeedHex(QA_APPROVER_SEED_HEX) ||
    release.publicKeyBytes !==
      publicKeyBytesFromSeedHex(RELEASE_APPROVER_SEED_HEX)
  ) {
    throw new Error("Registry approver records do not match seeds 7b/7c");
  }
  return { qa, release };
}

function buildEvidence(runtimeGolden, qaRecord, releaseRecord) {
  const resultEnvelope = runtimeGolden.realFilesystemConformanceResult;
  const result = resultEnvelope.payload;
  const policy = runtimeGolden.semanticProviderPolicy;
  const runtimeAttestation = runtimeGolden.runtimeAttestation;
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
      policy.isolation.securityBoundaryProfileDigest,
    ipcPeerAuthenticationPolicyDigest:
      policy.ipcPeerAuthenticationPolicyDigest,
    realFilesystemSuiteDigest: result.suiteDigest,
    realFilesystemConformanceResult: jsonClone(
      runtimeGolden.realFilesystemConformanceResultPin,
    ),
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
    qaRecord.keyId,
  );
  const releaseMessage =
    createProviderFeasibilityEvidenceReleaseSignatureMessageV1(
      unsigned,
      releaseRecord.keyId,
    );
  const payload = ProviderFeasibilityEvidenceV1Schema.parse({
    ...unsigned,
    qaSignature: evidenceSignature(
      "qa",
      qaRecord.keyId,
      QA_APPROVER_SEED_HEX,
      qaMessage,
    ),
    releaseSignature: evidenceSignature(
      "release",
      releaseRecord.keyId,
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
    qaMessage,
    releaseMessage,
  };
}

function rebuildNativeBEntry(
  registryGolden,
  runtimeGolden,
  evidence,
) {
  const oldEntry = findNativeBEntry(registryGolden);
  const activeRoot = runtimeGolden.conformanceResultGolden.activeRoot;
  const draft = {
    ...jsonClone(oldEntry),
    semanticProviderPolicyDigest:
      runtimeGolden.expected.semanticProviderPolicyDigest,
    providerFeasibilityEvidence: jsonClone(evidence.pin),
    runtimeAttestation: jsonClone(runtimeGolden.runtimeAttestation),
  };
  const unsigned = projectStoreDurableObjectProviderRegistryEntryUnsignedClaimsV1(
    draft,
  );
  const message =
    createStoreDurableObjectProviderRegistryEntrySignatureMessageV1(
      unsigned,
      activeRoot.rootKeyId,
    );
  const entry = StoreDurableObjectProviderRegistryEntryV1Schema.parse({
    ...unsigned,
    registrySignature: registrySignature(
      activeRoot.rootKeyId,
      ROOT_3_SEED_HEX,
      message,
    ),
  });
  return {
    entry,
    contentDigest:
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(entry),
    signatureMessage: message,
  };
}

function rebuildManifest(
  originalEnvelope,
  predecessorEnvelope,
  nativeBEntry,
) {
  const original = originalEnvelope.payload;
  const members = original.members.map((member) =>
    member.providerId === NATIVE_B_PROVIDER_ID &&
    member.disposition === "enabled"
      ? {
          providerId: NATIVE_B_PROVIDER_ID,
          disposition: "enabled",
          registryEntryContentDigest: nativeBEntry.contentDigest,
          registryEntry: nativeBEntry.entry,
        }
      : jsonClone(member),
  );
  const predecessor = predecessorEnvelope === undefined
    ? { state: "genesis" }
    : {
        state: "manifest",
        generationId: predecessorEnvelope.generationId,
        contentDigest: predecessorEnvelope.contentDigest,
      };
  const idFields = {
    installationIdentityGenerationId:
      original.installationIdentityGenerationId,
    activeRootMetadata: jsonClone(original.activeRootMetadata),
    members,
    routing: jsonClone(original.routing),
    manifestGeneration: original.manifestGeneration,
    predecessor,
  };
  const generationId = deriveProviderRegistryManifestGenerationIdV1(idFields);
  const unsigned = {
    profile: "provider_registry_manifest_v1",
    generationId,
    installationIdentityGenerationId:
      original.installationIdentityGenerationId,
    activeRootMetadata: jsonClone(original.activeRootMetadata),
    members,
    routing: jsonClone(original.routing),
    issuedAt: original.issuedAt,
    manifestGeneration: original.manifestGeneration,
    predecessor,
  };
  const rootKeyId = original.activeRootMetadata.rootKeyId;
  const message = createProviderRegistryManifestSignatureMessageV1(
    unsigned,
    rootKeyId,
  );
  const payload = ProviderRegistryManifestV1Schema.parse({
    ...unsigned,
    manifestSignature: manifestSignature(
      rootKeyId,
      ROOT_3_SEED_HEX,
      message,
    ),
  });
  return ProviderRegistryManifestEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_registry_manifest",
    generationId,
    contentDigest: deriveProviderRegistryManifestContentDigestV1(payload),
    payload,
  });
}

function rebuildRegistryHistory(registryGolden, nativeBEntry) {
  const original = registryGolden.registryManifestHistory;
  const history = [jsonClone(original[0]), jsonClone(original[1])];
  for (let index = 2; index < original.length; index += 1) {
    history.push(
      rebuildManifest(original[index], history[index - 1], nativeBEntry),
    );
  }
  return history;
}

export function buildCompatibleBaseFixture({
  rootGolden,
  registryGolden,
  sourceGolden,
}) {
  assertFrozenDependencyShape(rootGolden, registryGolden, sourceGolden);
  const root3Envelope = rootGolden.rootMetadataHistory[2];
  const distributionRootBinding =
    buildCompatibleDistributionRootBinding(
      sourceGolden,
      rootGolden.bootstrapTrustBundle,
    );
  const source = buildGoldenSourceFixture({
    distributionRootBinding,
    rootMetadataEnvelope: root3Envelope,
    rootSeedHex: ROOT_3_SEED_HEX,
  });
  const discovery = buildGoldenTargetDiscoveryPointFixture(source);
  assertGeneratedDistributionMatchesFrozenSource(
    sourceGolden,
    source,
    discovery,
  );
  const conformance = buildGoldenRealFilesystemConformanceResultFixture(
    discovery,
    { providerId: NATIVE_B_PROVIDER_ID },
  );
  const runtime = buildGoldenProviderRuntimeAttestationPointFixture(
    conformance,
    ROOT_3_SEED_HEX,
  );
  const oldNativeBEntry = findNativeBEntry(registryGolden);
  const approvers = findApproverRecords(oldNativeBEntry);
  const evidence = buildEvidence(runtime, approvers.qa, approvers.release);
  const nativeBEntry = rebuildNativeBEntry(
    registryGolden,
    runtime,
    evidence,
  );
  const registryManifestHistory = rebuildRegistryHistory(
    registryGolden,
    nativeBEntry,
  );

  const compatibleBase = {
    activeRoot: jsonClone(source.activeRoot),
    activeRootMetadata: jsonClone(source.activeRootMetadata),
    bootstrapTrustBundle: jsonClone(rootGolden.bootstrapTrustBundle),
    distributionRootBinding: jsonClone(source.distributionRootBinding),
    fixtureCorpusManifest: jsonClone(source.fixtureCorpusManifest),
    installationIdentityGenerationId:
      registryGolden.installationIdentityGenerationId,
    providerFeasibilityEvidence: jsonClone(evidence.envelope),
    providerFeasibilityEvidencePin: jsonClone(evidence.pin),
    publicSupportTaxonomy: jsonClone(discovery.publicSupportTaxonomy),
    realFilesystemConformanceResult: jsonClone(
      runtime.realFilesystemConformanceResult,
    ),
    realFilesystemConformanceResultLocator: jsonClone(
      runtime.realFilesystemConformanceResultLocator,
    ),
    realFilesystemConformanceResultPin: jsonClone(
      runtime.realFilesystemConformanceResultPin,
    ),
    registryManifestHistory: jsonClone(registryManifestHistory),
    releaseMatrix: jsonClone(discovery.releaseMatrix),
    rootMetadataHistory: jsonClone(rootGolden.rootMetadataHistory),
    runtimeAttestation: jsonClone(runtime.runtimeAttestation),
    semanticProviderPolicy: jsonClone(runtime.semanticProviderPolicy),
    suiteManifest: jsonClone(source.suiteManifest),
    targetDiscoveryFixtureManifest: jsonClone(
      discovery.targetDiscoveryFixtureManifest,
    ),
    targetDiscoveryResult: jsonClone(discovery.targetDiscoveryResult),
    targetDiscoveryRunnerRun: jsonClone(
      discovery.targetDiscoveryRunnerRun,
    ),
  };

  return {
    compatibleBase,
    source,
    discovery,
    conformance,
    runtime,
    evidence,
    nativeBEntry,
    registryManifestHistory,
    qaApproverPublicKey: approvers.qa,
    releaseApproverPublicKey: approvers.release,
  };
}

export function requestFromCompatibleBase(
  compatibleBase,
  strictCryptoCapability,
) {
  const fields = jsonClone(compatibleBase);
  return {
    activeRoot: fields.activeRoot,
    activeRootMetadata: fields.activeRootMetadata,
    bootstrapTrustBundle: fields.bootstrapTrustBundle,
    distributionRootBinding: fields.distributionRootBinding,
    fixtureCorpusManifest: fields.fixtureCorpusManifest,
    installationIdentityGenerationId:
      fields.installationIdentityGenerationId,
    providerFeasibilityEvidence: fields.providerFeasibilityEvidence,
    providerFeasibilityEvidencePin: fields.providerFeasibilityEvidencePin,
    publicSupportTaxonomy: fields.publicSupportTaxonomy,
    realFilesystemConformanceResult:
      fields.realFilesystemConformanceResult,
    realFilesystemConformanceResultLocator:
      fields.realFilesystemConformanceResultLocator,
    realFilesystemConformanceResultPin:
      fields.realFilesystemConformanceResultPin,
    registryManifestHistory: fields.registryManifestHistory,
    releaseMatrix: fields.releaseMatrix,
    rootMetadataHistory: fields.rootMetadataHistory,
    runtimeAttestation: fields.runtimeAttestation,
    semanticProviderPolicy: fields.semanticProviderPolicy,
    strictCryptoCapability,
    suiteManifest: fields.suiteManifest,
    targetDiscoveryFixtureManifest: fields.targetDiscoveryFixtureManifest,
    targetDiscoveryResult: fields.targetDiscoveryResult,
    targetDiscoveryRunnerRun: fields.targetDiscoveryRunnerRun,
  };
}

/**
 * Node-only fixture helper for inherited adapter generation.  It rebuilds the
 * native-b Registry Entry and every affected Manifest successor after an
 * Evidence/Runtime pin changes.  Runtime code must never import this helper.
 */
export function reanchorCompatibleBaseCandidateForGenerator({
  compatibleBase,
  entryOverrides = {},
  providerFeasibilityEvidencePin =
    compatibleBase.providerFeasibilityEvidencePin,
  runtimeAttestation = compatibleBase.runtimeAttestation,
  semanticProviderPolicyDigest =
    compatibleBase.semanticProviderPolicy.profile ===
    "store_durable_object_provider_policy_v1"
      ? deriveStoreDurableObjectProviderPolicyDigestV1(
          compatibleBase.semanticProviderPolicy,
        )
      : undefined,
}) {
  if (semanticProviderPolicyDigest === undefined) {
    throw new TypeError("generator candidate policy is not structurally valid");
  }
  const currentEntry = findNativeBEntry({
    registryManifestHistory: compatibleBase.registryManifestHistory,
  });
  const unsigned =
    projectStoreDurableObjectProviderRegistryEntryUnsignedClaimsV1({
      ...jsonClone(currentEntry),
      ...jsonClone(entryOverrides),
      semanticProviderPolicyDigest,
      providerFeasibilityEvidence: jsonClone(
        providerFeasibilityEvidencePin,
      ),
      runtimeAttestation: jsonClone(runtimeAttestation),
    });
  const signatureMessage =
    createStoreDurableObjectProviderRegistryEntrySignatureMessageV1(
      unsigned,
      compatibleBase.activeRoot.rootKeyId,
    );
  const entry = StoreDurableObjectProviderRegistryEntryV1Schema.parse({
    ...unsigned,
    registrySignature: registrySignature(
      compatibleBase.activeRoot.rootKeyId,
      ROOT_3_SEED_HEX,
      signatureMessage,
    ),
  });
  const nativeBEntry = {
    entry,
    contentDigest:
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(entry),
    signatureMessage,
  };
  const registryManifestHistory = rebuildRegistryHistory(
    { registryManifestHistory: compatibleBase.registryManifestHistory },
    nativeBEntry,
  );
  return Object.freeze({
    compatibleBase: Object.freeze({
      ...jsonClone(compatibleBase),
      providerFeasibilityEvidencePin: jsonClone(
        providerFeasibilityEvidencePin,
      ),
      runtimeAttestation: jsonClone(runtimeAttestation),
      registryManifestHistory,
    }),
    nativeBEntry: Object.freeze(nativeBEntry),
    registryManifestHistory,
  });
}

export function buildProviderFeasibilityApproverRecordForGenerator({
  role,
  seedHex,
  distributionRegistryGenerationIntroduced,
  activeRoot,
}) {
  const publicKeyBytes = publicKeyBytesFromSeedHex(seedHex);
  const unsigned = {
    profile: "provider_feasibility_approver_public_key_v1",
    distributionRegistryGenerationIntroduced,
    role,
    keyId: deriveProviderFeasibilityApproverKeyIdV1({
      role,
      publicKeyBytes,
    }),
    algorithm: "ed25519",
    publicKeyBytes,
    publicKeyDigest:
      deriveProviderEd25519PublicKeyDigestInternalV1(publicKeyBytes),
  };
  const message =
    createProviderFeasibilityApproverPublicKeySignatureMessageV1(
      unsigned,
      activeRoot.rootKeyId,
    );
  return ProviderFeasibilityApproverPublicKeyV1Schema.parse({
    ...unsigned,
    registrySignature: registrySignature(
      activeRoot.rootKeyId,
      ROOT_3_SEED_HEX,
      message,
    ),
  });
}

export function appendCompatibleBaseEntrySuccessorForGenerator({
  compatibleBase,
  entryOverrides = {},
  issuedAt = "2026-08-05T04:00:00Z",
}) {
  const currentTip = compatibleBase.registryManifestHistory.at(-1);
  const currentEntry = findNativeBEntry({
    registryManifestHistory: compatibleBase.registryManifestHistory,
  });
  if (currentTip === undefined) {
    throw new TypeError("generator candidate has no Registry tip");
  }
  const predecessorRegistryEntryContentDigest =
    deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
      currentEntry,
    );
  const unsignedEntry =
    projectStoreDurableObjectProviderRegistryEntryUnsignedClaimsV1({
      ...jsonClone(currentEntry),
      ...jsonClone(entryOverrides),
      registryGeneration: currentEntry.registryGeneration + 1,
      predecessorRegistryEntryContentDigest,
    });
  const entryMessage =
    createStoreDurableObjectProviderRegistryEntrySignatureMessageV1(
      unsignedEntry,
      compatibleBase.activeRoot.rootKeyId,
    );
  const entry = StoreDurableObjectProviderRegistryEntryV1Schema.parse({
    ...unsignedEntry,
    registrySignature: registrySignature(
      compatibleBase.activeRoot.rootKeyId,
      ROOT_3_SEED_HEX,
      entryMessage,
    ),
  });
  const nativeBEntry = {
    entry,
    contentDigest:
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(entry),
    signatureMessage: entryMessage,
  };
  const members = currentTip.payload.members.map((member) =>
    member.providerId === NATIVE_B_PROVIDER_ID &&
    member.disposition === "enabled"
      ? {
          providerId: NATIVE_B_PROVIDER_ID,
          disposition: "enabled",
          registryEntryContentDigest: nativeBEntry.contentDigest,
          registryEntry: nativeBEntry.entry,
        }
      : jsonClone(member),
  );
  const predecessor = {
    state: "manifest",
    generationId: currentTip.generationId,
    contentDigest: currentTip.contentDigest,
  };
  const idFields = {
    installationIdentityGenerationId:
      currentTip.payload.installationIdentityGenerationId,
    activeRootMetadata: jsonClone(currentTip.payload.activeRootMetadata),
    members,
    routing: jsonClone(currentTip.payload.routing),
    manifestGeneration: currentTip.payload.manifestGeneration + 1,
    predecessor,
  };
  const generationId = deriveProviderRegistryManifestGenerationIdV1(idFields);
  const unsignedManifest = {
    profile: "provider_registry_manifest_v1",
    generationId,
    installationIdentityGenerationId:
      currentTip.payload.installationIdentityGenerationId,
    activeRootMetadata: jsonClone(currentTip.payload.activeRootMetadata),
    members,
    routing: jsonClone(currentTip.payload.routing),
    issuedAt,
    manifestGeneration: currentTip.payload.manifestGeneration + 1,
    predecessor,
  };
  const manifestMessage = createProviderRegistryManifestSignatureMessageV1(
    unsignedManifest,
    compatibleBase.activeRoot.rootKeyId,
  );
  const payload = ProviderRegistryManifestV1Schema.parse({
    ...unsignedManifest,
    manifestSignature: manifestSignature(
      compatibleBase.activeRoot.rootKeyId,
      ROOT_3_SEED_HEX,
      manifestMessage,
    ),
  });
  const manifest = ProviderRegistryManifestEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_registry_manifest",
    generationId,
    contentDigest: deriveProviderRegistryManifestContentDigestV1(payload),
    payload,
  });
  return Object.freeze({
    compatibleBase: Object.freeze({
      ...jsonClone(compatibleBase),
      registryManifestHistory: [
        ...jsonClone(compatibleBase.registryManifestHistory),
        manifest,
      ],
    }),
    nativeBEntry: Object.freeze(nativeBEntry),
    appendedManifest: manifest,
  });
}

export function projectSuccessfulClosure(closure) {
  return {
    installationIdentityGenerationId:
      closure.registryManifestHistoryClosure.installationIdentityGenerationId,
    registryManifestContentDigest:
      closure.registryManifestHistoryClosure.currentRegistryManifest
        .contentDigest,
    candidateRegistryEntryContentDigest:
      closure.candidateRegistryEntryContentDigest,
    providerId: closure.candidateRegistryEntry.providerId,
    runtimeAttestationContentDigest:
      closure.runtimeAttestationPointClosure.runtimeAttestation.contentDigest,
    evidenceId: closure.providerFeasibilityEvidence.evidenceId,
    evidenceContentDigest: closure.providerFeasibilityEvidence.contentDigest,
    evidenceRelativePath: closure.relativePath,
    qaApproverKeyId: closure.qaApproverPublicKey.keyId,
    releaseApproverKeyId: closure.releaseApproverPublicKey.keyId,
  };
}

export function expectedEvidenceRelativePath(evidencePin) {
  return buildProviderFeasibilityEvidenceRelativePathV1(evidencePin);
}
