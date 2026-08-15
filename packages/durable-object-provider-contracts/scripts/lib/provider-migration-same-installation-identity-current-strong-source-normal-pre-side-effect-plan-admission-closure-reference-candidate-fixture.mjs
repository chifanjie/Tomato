import {
  createPrivateKey,
  createPublicKey,
  sign,
} from "node:crypto";

import {
  StoreDurableObjectProviderBindingDerivationGenerationV1Schema,
  StoreDurableObjectProviderRegistryEntryV1Schema,
  StoreDurableObjectProviderVerificationPublicKeyV1Schema,
  createStoreDurableObjectProviderBindingDerivationGenerationSignatureMessageV1,
  createStoreDurableObjectProviderRegistryEntrySignatureMessageV1,
  createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1,
  deriveStoreDurableObjectProviderRegistryEntryContentDigestV1,
  deriveStoreDurableObjectProviderVerificationKeyIdV1,
  projectStoreDurableObjectProviderRegistryEntryUnsignedClaimsV1,
} from "../../dist/provider-registry-records.js";
import {
  deriveProviderEd25519PublicKeyDigestInternalV1,
} from "../../dist/provider-registry-trust.js";
import {
  deriveStoreDurableObjectProviderPolicyDigestV1,
} from "../../dist/provider-runtime-attestation-point.js";
import {
  buildProviderFeasibilitySupportCandidateFixture,
} from "./provider-feasibility-support-catalog-point-fixture.mjs";
import {
  NATIVE_B_PROVIDER_ID,
  ROOT_3_SEED_HEX,
} from "./provider-registry-evidence-binding-point-fixture.mjs";

const PROSPECTIVE_PROVIDER_SEEDS_BY_USAGE = Object.freeze({
  containment_proof: "d1".repeat(32),
  journal_version: "d2".repeat(32),
  migration_semantic_proof: "d3".repeat(32),
  operation_receipt: "d4".repeat(32),
  state_version: "d5".repeat(32),
});
const VERIFICATION_USAGES = Object.freeze([
  "containment_proof",
  "journal_version",
  "migration_semantic_proof",
  "operation_receipt",
  "state_version",
]);

function jsonClone(value) {
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

function publicKeyBytesFromSeedHex(seedHex) {
  const der = createPublicKey(privateKeyFromSeedHex(seedHex)).export({
    format: "der",
    type: "spki",
  });
  return `base64url:${der.subarray(der.byteLength - 32).toString("base64url")}`;
}

function registrySignature(rootKeyId, message) {
  const signature = sign(
    null,
    Buffer.from(message),
    privateKeyFromSeedHex(ROOT_3_SEED_HEX),
  ).toString("hex");
  return `provider-registry-ed25519:${rootKeyId}:${signature}`;
}

function sourceEntryAtCurrentTip(rawRequest) {
  const tip = rawRequest.registryManifestHistory.at(-1);
  const matches = tip?.payload.members.filter(
    (member) =>
      member.disposition === "enabled" &&
      member.providerId === NATIVE_B_PROVIDER_ID,
  );
  if (tip === undefined || matches?.length !== 1) {
    throw new TypeError(
      "D-41 fixture requires one current enabled native-b source Entry",
    );
  }
  return { tip, sourceEntry: matches[0].registryEntry };
}

function reconstructDiscovery(rawRequest, tip) {
  const rootTip = rawRequest.rootMetadataHistory.at(-1);
  const fixtureCorpusManifest =
    rawRequest.realFilesystemFixtureCorpusManifests[0];
  const suiteManifest = rawRequest.realFilesystemSuiteManifests[0];
  const publicSupportTaxonomy = rawRequest.publicSupportTaxonomyHistory[0];
  const releaseMatrix = rawRequest.releaseMatrixHistory[0];
  const targetDiscoveryFixtureManifest =
    rawRequest.targetDiscoveryFixtureManifests[0];
  const targetDiscoveryRunnerRun = rawRequest.targetDiscoveryRunnerRuns[0];
  const targetDiscoveryResult = rawRequest.targetDiscoveryResultHistory[0];
  if (
    rootTip === undefined ||
    fixtureCorpusManifest === undefined ||
    suiteManifest === undefined ||
    publicSupportTaxonomy === undefined ||
    releaseMatrix === undefined ||
    targetDiscoveryFixtureManifest === undefined ||
    targetDiscoveryRunnerRun === undefined ||
    targetDiscoveryResult === undefined
  ) {
    throw new TypeError("D-41 fixture lost its retained discovery closure");
  }
  return {
    distributionRootBinding: jsonClone(rawRequest.distributionRootBinding),
    activeRootMetadata: jsonClone(tip.payload.activeRootMetadata),
    activeRoot: jsonClone(rootTip.payload.activeRoot),
    fixtureCorpusManifest: jsonClone(fixtureCorpusManifest),
    suiteManifest: jsonClone(suiteManifest),
    publicSupportTaxonomy: jsonClone(publicSupportTaxonomy),
    releaseMatrix: jsonClone(releaseMatrix),
    targetDiscoveryFixtureManifest: jsonClone(
      targetDiscoveryFixtureManifest,
    ),
    targetDiscoveryRunnerRun: jsonClone(targetDiscoveryRunnerRun),
    targetDiscoveryResult: jsonClone(targetDiscoveryResult),
  };
}

function buildVerificationPublicKeyRecord({
  providerId,
  usage,
  rootKeyId,
  aliasPublicKeyBytes,
}) {
  const seedHex = PROSPECTIVE_PROVIDER_SEEDS_BY_USAGE[usage];
  const publicKeyBytes =
    aliasPublicKeyBytes ?? publicKeyBytesFromSeedHex(seedHex);
  const unsigned = {
    profile: "store_durable_object_provider_verification_public_key_v1",
    providerId,
    registryGenerationIntroduced: 1,
    keyId: deriveStoreDurableObjectProviderVerificationKeyIdV1({
      providerId,
      usage,
      publicKeyBytes,
    }),
    usage,
    algorithm: "ed25519",
    publicKeyBytes,
    publicKeyDigest:
      deriveProviderEd25519PublicKeyDigestInternalV1(publicKeyBytes),
  };
  return StoreDurableObjectProviderVerificationPublicKeyV1Schema.parse({
    ...unsigned,
    registrySignature: registrySignature(
      rootKeyId,
      createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1(
        unsigned,
        rootKeyId,
      ),
    ),
  });
}

function buildVerificationKeys({
  providerId,
  rootKeyId,
  materialAliasPublicKeyBytes,
}) {
  const publicKeyRecords = VERIFICATION_USAGES.map((usage, index) =>
    buildVerificationPublicKeyRecord({
      providerId,
      usage,
      rootKeyId,
      aliasPublicKeyBytes:
        index === 0 ? materialAliasPublicKeyBytes : undefined,
    }),
  );
  const keyIdByUsage = new Map(
    publicKeyRecords.map((record) => [record.usage, record.keyId]),
  );
  const bindingUnsigned = {
    profile:
      "store_durable_object_provider_binding_derivation_generation_v1",
    providerId,
    registryGenerationIntroduced: 1,
    generation: 1,
    algorithm: "hmac_sha256_provider_private",
    keyCommitmentDigest: `sha256:${"d6".repeat(32)}`,
  };
  const bindingRecord =
    StoreDurableObjectProviderBindingDerivationGenerationV1Schema.parse({
      ...bindingUnsigned,
      registrySignature: registrySignature(
        rootKeyId,
        createStoreDurableObjectProviderBindingDerivationGenerationSignatureMessageV1(
          bindingUnsigned,
          rootKeyId,
        ),
      ),
    });
  return {
    profile: "store_durable_object_provider_verification_keys_v1",
    activeKeyIds: {
      operationReceipt: keyIdByUsage.get("operation_receipt"),
      containmentProof: keyIdByUsage.get("containment_proof"),
      stateVersion: keyIdByUsage.get("state_version"),
      journalVersion: keyIdByUsage.get("journal_version"),
    },
    activeBindingDerivationKeyGeneration: 1,
    publicKeyRecords,
    bindingDerivationGenerationRecords: [bindingRecord],
    compromisedRevokedKeyIds: [],
    compromisedRevokedBindingDerivationGenerations: [],
  };
}

export function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSignedProspectiveDestinationFixture({
  distributionRawRequest,
  targetOrdinal = 1,
  providerId = "durable-object-provider:d41-prospective",
  materialAliasPublicKeyBytes,
}) {
  const { tip, sourceEntry } = sourceEntryAtCurrentTip(
    distributionRawRequest,
  );
  const universe =
    distributionRawRequest.releaseTargetUniverseHistory.at(-1);
  const universeTarget = universe?.payload.targets[targetOrdinal];
  if (universeTarget === undefined) {
    throw new TypeError("D-41 fixture target ordinal is outside the Universe");
  }
  const discovery = reconstructDiscovery(distributionRawRequest, tip);
  const qaApproverPublicKey =
    sourceEntry.feasibilityApprovalKeys.publicKeyRecords.find(
      (record) => record.role === "qa",
    );
  const releaseApproverPublicKey =
    sourceEntry.feasibilityApprovalKeys.publicKeyRecords.find(
      (record) => record.role === "release",
    );
  if (
    qaApproverPublicKey === undefined ||
    releaseApproverPublicKey === undefined
  ) {
    throw new TypeError("D-41 fixture source Entry lost current approvers");
  }
  const candidate = buildProviderFeasibilitySupportCandidateFixture({
    discovery,
    targetProfileId: universeTarget.target.targetProfileId,
    qaApproverPublicKey,
    releaseApproverPublicKey,
    providerId,
    result: "passed",
    releaseDisposition: "strong_read_write",
    rootSeedHex: ROOT_3_SEED_HEX,
  });
  const rootKeyId = tip.payload.activeRootMetadata.rootKeyId;
  const draft = {
    profile: "store_durable_object_provider_registry_entry_v1",
    installationIdentityGenerationId:
      tip.payload.installationIdentityGenerationId,
    activeRootMetadata: jsonClone(tip.payload.activeRootMetadata),
    registryRootKeyId: rootKeyId,
    providerId,
    semanticProviderPolicyDigest:
      deriveStoreDurableObjectProviderPolicyDigestV1(
        candidate.catalogCandidate.semanticProviderPolicy,
      ),
    providerFeasibilityEvidence: jsonClone(
      candidate.catalogCandidate.providerFeasibilityEvidence,
    ),
    runtimeAttestation: jsonClone(
      candidate.catalogCandidate.runtimeAttestation,
    ),
    verificationKeys: buildVerificationKeys({
      providerId,
      rootKeyId,
      materialAliasPublicKeyBytes,
    }),
    feasibilityApprovalKeys: jsonClone(sourceEntry.feasibilityApprovalKeys),
    status: "enabled",
    registryGeneration: 1,
  };
  const unsigned =
    projectStoreDurableObjectProviderRegistryEntryUnsignedClaimsV1(draft);
  const prospectiveRegistryEntry =
    StoreDurableObjectProviderRegistryEntryV1Schema.parse({
      ...unsigned,
      registrySignature: registrySignature(
        rootKeyId,
        createStoreDurableObjectProviderRegistryEntrySignatureMessageV1(
          unsigned,
          rootKeyId,
        ),
      ),
    });
  const evidenceValidationSource = {
    ...jsonClone(discovery),
    providerFeasibilityEvidence: jsonClone(
      candidate.candidateArtifact.providerFeasibilityEvidence,
    ),
    providerFeasibilityEvidencePin: jsonClone(
      candidate.catalogCandidate.providerFeasibilityEvidence,
    ),
    realFilesystemConformanceResult: jsonClone(
      candidate.candidateArtifact.realFilesystemConformanceResult,
    ),
    realFilesystemConformanceResultLocator: jsonClone(
      candidate.runtime.realFilesystemConformanceResultLocator,
    ),
    realFilesystemConformanceResultPin: jsonClone(
      candidate.runtime.realFilesystemConformanceResultPin,
    ),
    runtimeAttestation: jsonClone(candidate.runtimeAttestation),
    semanticProviderPolicy: jsonClone(
      candidate.catalogCandidate.semanticProviderPolicy,
    ),
  };
  return Object.freeze({
    providerId,
    targetOrdinal,
    target: jsonClone(universeTarget.target),
    prospectiveRegistryEntry,
    prospectiveRegistryEntryContentDigest:
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
        prospectiveRegistryEntry,
      ),
    prospectiveSupportCandidate: jsonClone(candidate.catalogCandidate),
    evidenceEnvelope: jsonClone(
      candidate.candidateArtifact.providerFeasibilityEvidence,
    ),
    realFilesystemConformanceResult: jsonClone(
      candidate.candidateArtifact.realFilesystemConformanceResult,
    ),
    evidenceValidationSource,
  });
}
