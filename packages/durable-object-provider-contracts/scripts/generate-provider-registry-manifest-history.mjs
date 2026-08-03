import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalizeJcsSafeIntegerUtf8V1,
} from "../dist/jcs.js";
import {
  buildProviderRegistryManifestRelativePathV1,
} from "../dist/provider-fixed-locator.js";
import {
  INSTALLATION_IDENTITY_GENERATION_DOMAIN_V1,
  deriveInstallationIdentityGenerationIdV1,
} from "../dist/provider-foundation.js";
import {
  PROVIDER_FEASIBILITY_APPROVER_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
  PROVIDER_REGISTRY_MANIFEST_DOMAIN_V1,
  PROVIDER_REGISTRY_MANIFEST_ID_DOMAIN_V1,
  PROVIDER_REGISTRY_MANIFEST_SIGNATURE_DOMAIN_V1,
  ProviderFeasibilityApproverPublicKeyV1Schema,
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestV1Schema,
  STORE_DURABLE_OBJECT_PROVIDER_BINDING_DERIVATION_GENERATION_SIGNATURE_DOMAIN_V1,
  STORE_DURABLE_OBJECT_PROVIDER_REGISTRY_ENTRY_DOMAIN_V1,
  STORE_DURABLE_OBJECT_PROVIDER_REGISTRY_ENTRY_SIGNATURE_DOMAIN_V1,
  STORE_DURABLE_OBJECT_PROVIDER_VERIFICATION_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
  STORE_PROVIDER_RUNTIME_ATTESTATION_SIGNATURE_DOMAIN_V1,
  StoreDurableObjectProviderBindingDerivationGenerationV1Schema,
  StoreDurableObjectProviderRegistryEntryV1Schema,
  StoreDurableObjectProviderRuntimeAttestationV1Schema,
  StoreDurableObjectProviderVerificationPublicKeyV1Schema,
  createProviderFeasibilityApproverPublicKeySignatureMessageV1,
  createProviderRegistryManifestSignatureMessageV1,
  createStoreDurableObjectProviderBindingDerivationGenerationSignatureMessageV1,
  createStoreDurableObjectProviderRegistryEntrySignatureMessageV1,
  createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1,
  createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1,
  deriveProviderFeasibilityApproverKeyIdV1,
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
  deriveStoreDurableObjectProviderRegistryEntryContentDigestV1,
  deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1,
  deriveStoreProviderVerificationKeyIdV1,
  projectProviderRegistryManifestIdFieldsV1,
  projectProviderRegistryManifestUnsignedClaimsV1,
  projectStoreDurableObjectProviderRegistryEntryUnsignedClaimsV1,
} from "../dist/provider-registry-records.js";
import {
  diagnoseProviderRegistryManifestHistoryInternalV1,
} from "../dist/provider-registry-manifest-history.js";
import {
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_DOMAIN_V1,
} from "../dist/provider-registry-root-history-fixtures.js";
import {
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  attestProviderStrictEd25519CryptoHostV1,
} from "../dist/strict-ed25519-conformance.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "../dist/strict-ed25519.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const goldenResourcePath =
  "fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json";
const goldenPath = join(packageRoot, ...goldenResourcePath.split("/"));
const rootHistoryPath = join(
  packageRoot,
  ...PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1.split("/"),
);
const strictManifestPath = join(
  packageRoot,
  ...PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1.split("/"),
);

const domains = Object.freeze({
  fixtureContent:
    "provider-registry-entry-manifest-history-fixture-content-v1",
  fixtureIdentifier:
    "provider-registry-entry-manifest-history-fixture-id-v1",
  goldenManifest:
    "provider-registry-entry-manifest-history-golden-manifest-v1",
});

const expectedCryptoCalls = Object.freeze({
  postAttestationPointCalls: 24,
  postAttestationSignatureCalls: 38,
});

const providerA = "durable-object-provider:native-a";
const providerB = "durable-object-provider:native-b";
const installationInitializationNonceHex = "a1".repeat(16);

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest();
}

function hex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

function canonicalHex(value) {
  return hex(canonicalizeJcsSafeIntegerUtf8V1(value));
}

function semanticDigest(domain, value) {
  return `sha256:${hex(
    sha256Bytes(canonicalizeJcsSafeIntegerUtf8V1([domain, value])),
  )}`;
}

function fixtureContentDigest(kind, label) {
  return semanticDigest(domains.fixtureContent, { kind, label });
}

function fixtureShortHex(kind, label) {
  return hex(
    sha256Bytes(
      canonicalizeJcsSafeIntegerUtf8V1([
        domains.fixtureIdentifier,
        { kind, label },
      ]),
    ),
  ).slice(0, 22);
}

function deterministicKey(seedHex) {
  const seed = Buffer.from(seedHex, "hex");
  if (seed.byteLength !== 32) {
    throw new Error("deterministic Ed25519 seed must be exactly 32 bytes");
  }
  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      seed,
    ]),
    format: "der",
    type: "pkcs8",
  });
  const spki = createPublicKey(privateKey).export({
    format: "der",
    type: "spki",
  });
  const rawPublicKey = Buffer.from(spki.subarray(spki.byteLength - 32));
  return Object.freeze({
    privateKey,
    publicKeyBytes: `base64url:${rawPublicKey.toString("base64url")}`,
    publicKeyDigest: `sha256:${hex(sha256Bytes(rawPublicKey))}`,
  });
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function registrySignature(root, message) {
  return (
    `provider-registry-ed25519:${root.rootKeyId}:` +
    sign(null, Buffer.from(message), root.privateKey).toString("hex")
  );
}

function manifestSignature(root, message) {
  return (
    `provider-registry-manifest-ed25519:${root.rootKeyId}:` +
    sign(null, Buffer.from(message), root.privateKey).toString("hex")
  );
}

function rootPin(envelope) {
  return {
    locatorProfile: "installation_provider_registry_root_metadata_v1",
    rootGeneration: envelope.rootGeneration,
    rootKeyId: envelope.rootKeyId,
    contentDigest: envelope.contentDigest,
  };
}

function registryManifestPin(envelope) {
  return {
    locatorProfile: "installation_provider_registry_manifest_v1",
    manifestGeneration: envelope.payload.manifestGeneration,
    generationId: envelope.generationId,
    contentDigest: envelope.contentDigest,
  };
}

function canonicalJsonEqual(left, right) {
  return Buffer.from(
    canonicalizeJcsSafeIntegerUtf8V1(left),
  ).equals(Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(right)));
}

function prettyJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const rootHistoryBytes = await readFile(rootHistoryPath);
const rootHistory = JSON.parse(rootHistoryBytes.toString("utf8"));
const observedRootHistorySemanticDigest = semanticDigest(
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_DOMAIN_V1,
  rootHistory,
);
if (
  rootHistoryBytes.byteLength !==
    PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1 ||
  hex(sha256Bytes(rootHistoryBytes)) !==
    PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1 ||
  observedRootHistorySemanticDigest !==
    PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1 ||
  rootHistory.deterministicSeeds?.purpose !==
    "non_production_fixture_only" ||
  rootHistory.rootMetadataHistory?.length !== 3
) {
  throw new Error("provider root-history dependency is not the frozen golden");
}

const rootSeedHexes = [
  rootHistory.deterministicSeeds.bootstrapRootSeedHex,
  rootHistory.deterministicSeeds.plannedRootSeedHex,
  rootHistory.deterministicSeeds.compromiseRootSeedHex,
];
const roots = rootHistory.rootMetadataHistory.map((envelope, index) => {
  const key = deterministicKey(rootSeedHexes[index]);
  if (
    key.publicKeyBytes !== envelope.payload.activeRoot.publicKeyBytes ||
    key.publicKeyDigest !== envelope.payload.activeRoot.publicKeyDigest
  ) {
    throw new Error(`root ${index + 1} seed does not reproduce root history`);
  }
  return Object.freeze({
    rootGeneration: envelope.rootGeneration,
    rootKeyId: envelope.rootKeyId,
    privateKey: key.privateKey,
    envelope,
    pin: rootPin(envelope),
  });
});
const [root1, root2, root3] = roots;

const cryptoHost = Object.freeze({
  sha256(message) {
    return new Uint8Array(sha256Bytes(message));
  },
  hmacSha256() {
    throw new Error("fixture generation does not request HMAC-SHA-256");
  },
});
const installationIdentityGenerationId =
  await deriveInstallationIdentityGenerationIdV1(
    { initializationNonce: installationInitializationNonceHex },
    cryptoHost,
  );
const installationIdPreimage = canonicalizeJcsSafeIntegerUtf8V1([
  INSTALLATION_IDENTITY_GENERATION_DOMAIN_V1,
  { initializationNonce: installationInitializationNonceHex },
]);
if (
  installationIdentityGenerationId !==
  `installation-identity-generation:${hex(
    sha256Bytes(installationIdPreimage),
  ).slice(0, 22)}`
) {
  throw new Error("installation identity derivation differs from exact domain");
}

const providerKeySeedDefinitions = Object.freeze([
  {
    vectorId: "a1-containment-proof",
    providerId: providerA,
    usage: "containment_proof",
    registryGenerationIntroduced: 1,
    signerRootGeneration: 1,
    seedHex: "71".repeat(32),
  },
  {
    vectorId: "a1-journal-version",
    providerId: providerA,
    usage: "journal_version",
    registryGenerationIntroduced: 1,
    signerRootGeneration: 1,
    seedHex: "73".repeat(32),
  },
  {
    vectorId: "a1-migration-semantic-proof",
    providerId: providerA,
    usage: "migration_semantic_proof",
    registryGenerationIntroduced: 1,
    signerRootGeneration: 1,
    seedHex: "74".repeat(32),
  },
  {
    vectorId: "a1-operation-receipt",
    providerId: providerA,
    usage: "operation_receipt",
    registryGenerationIntroduced: 1,
    signerRootGeneration: 1,
    seedHex: "70".repeat(32),
  },
  {
    vectorId: "a2-operation-receipt-rotated",
    providerId: providerA,
    usage: "operation_receipt",
    registryGenerationIntroduced: 2,
    signerRootGeneration: 2,
    seedHex: "75".repeat(32),
  },
  {
    vectorId: "a1-state-version",
    providerId: providerA,
    usage: "state_version",
    registryGenerationIntroduced: 1,
    signerRootGeneration: 1,
    seedHex: "72".repeat(32),
  },
  {
    vectorId: "b1-containment-proof",
    providerId: providerB,
    usage: "containment_proof",
    registryGenerationIntroduced: 1,
    signerRootGeneration: 3,
    seedHex: "77".repeat(32),
  },
  {
    vectorId: "b1-journal-version",
    providerId: providerB,
    usage: "journal_version",
    registryGenerationIntroduced: 1,
    signerRootGeneration: 3,
    seedHex: "79".repeat(32),
  },
  {
    vectorId: "b1-migration-semantic-proof",
    providerId: providerB,
    usage: "migration_semantic_proof",
    registryGenerationIntroduced: 1,
    signerRootGeneration: 3,
    seedHex: "7a".repeat(32),
  },
  {
    vectorId: "b1-operation-receipt",
    providerId: providerB,
    usage: "operation_receipt",
    registryGenerationIntroduced: 1,
    signerRootGeneration: 3,
    seedHex: "76".repeat(32),
  },
  {
    vectorId: "b1-state-version",
    providerId: providerB,
    usage: "state_version",
    registryGenerationIntroduced: 1,
    signerRootGeneration: 3,
    seedHex: "78".repeat(32),
  },
]);
const approverSeedDefinitions = Object.freeze([
  { role: "qa", seedHex: "7b".repeat(32) },
  { role: "release", seedHex: "7c".repeat(32) },
]);
const bindingSecretSeedDefinitions = Object.freeze([
  { providerId: providerA, generation: 1, seedHex: "80".repeat(32) },
  { providerId: providerB, generation: 1, seedHex: "81".repeat(32) },
]);

const nestedRecordVectorInputs = [];
const entryVectorInputs = [];

function createSignedRegistryRecord({
  vectorId,
  recordKind,
  domain,
  unsignedClaims,
  root,
  schema,
  messageBuilder,
  expectedFields = {},
}) {
  const message = messageBuilder(unsignedClaims, root.rootKeyId);
  const signedRecord = schema.parse({
    ...unsignedClaims,
    registrySignature: registrySignature(root, message),
  });
  nestedRecordVectorInputs.push({
    vectorId,
    recordKind,
    domain,
    rootKeyId: root.rootKeyId,
    message,
    signedRecord,
    expectedFields,
  });
  return signedRecord;
}

const providerKeyRecordsByVectorId = new Map();
for (const definition of providerKeySeedDefinitions) {
  const key = deterministicKey(definition.seedHex);
  const keyId = deriveStoreProviderVerificationKeyIdV1({
    providerId: definition.providerId,
    usage: definition.usage,
    publicKeyBytes: key.publicKeyBytes,
  });
  const unsignedClaims = {
    profile: "store_durable_object_provider_verification_public_key_v1",
    providerId: definition.providerId,
    registryGenerationIntroduced:
      definition.registryGenerationIntroduced,
    keyId,
    usage: definition.usage,
    algorithm: "ed25519",
    publicKeyBytes: key.publicKeyBytes,
    publicKeyDigest: key.publicKeyDigest,
  };
  const record = createSignedRegistryRecord({
    vectorId: definition.vectorId,
    recordKind: "provider_verification_public_key",
    domain:
      STORE_DURABLE_OBJECT_PROVIDER_VERIFICATION_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
    unsignedClaims,
    root: roots[definition.signerRootGeneration - 1],
    schema: StoreDurableObjectProviderVerificationPublicKeyV1Schema,
    messageBuilder:
      createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1,
    expectedFields: {
      providerId: definition.providerId,
      usage: definition.usage,
      keyId,
      registryGenerationIntroduced:
        definition.registryGenerationIntroduced,
    },
  });
  providerKeyRecordsByVectorId.set(definition.vectorId, record);
}

function sortedProviderKeyRecords(vectorIds) {
  return vectorIds
    .map((vectorId) => providerKeyRecordsByVectorId.get(vectorId))
    .sort((left, right) => {
      const providerOrder = compareUtf8(left.providerId, right.providerId);
      if (providerOrder !== 0) return providerOrder;
      const usageOrder = compareUtf8(left.usage, right.usage);
      return usageOrder !== 0
        ? usageOrder
        : compareUtf8(left.keyId, right.keyId);
    });
}

const aInitialKeyVectorIds = [
  "a1-containment-proof",
  "a1-journal-version",
  "a1-migration-semantic-proof",
  "a1-operation-receipt",
  "a1-state-version",
];
const aAllKeyVectorIds = [
  ...aInitialKeyVectorIds,
  "a2-operation-receipt-rotated",
];
const bKeyVectorIds = [
  "b1-containment-proof",
  "b1-journal-version",
  "b1-migration-semantic-proof",
  "b1-operation-receipt",
  "b1-state-version",
];
const aInitialKeyRecords = sortedProviderKeyRecords(aInitialKeyVectorIds);
const aAllKeyRecords = sortedProviderKeyRecords(aAllKeyVectorIds);
const bKeyRecords = sortedProviderKeyRecords(bKeyVectorIds);

const approverRecords = approverSeedDefinitions.map((definition) => {
  const key = deterministicKey(definition.seedHex);
  const keyId = deriveProviderFeasibilityApproverKeyIdV1({
    role: definition.role,
    publicKeyBytes: key.publicKeyBytes,
  });
  return createSignedRegistryRecord({
    vectorId: `global-${definition.role}-approver`,
    recordKind: "feasibility_approver_public_key",
    domain: PROVIDER_FEASIBILITY_APPROVER_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
    unsignedClaims: {
      profile: "provider_feasibility_approver_public_key_v1",
      distributionRegistryGenerationIntroduced: 1,
      role: definition.role,
      keyId,
      algorithm: "ed25519",
      publicKeyBytes: key.publicKeyBytes,
      publicKeyDigest: key.publicKeyDigest,
    },
    root: root1,
    schema: ProviderFeasibilityApproverPublicKeyV1Schema,
    messageBuilder:
      createProviderFeasibilityApproverPublicKeySignatureMessageV1,
    expectedFields: { role: definition.role, keyId },
  });
});
approverRecords.sort((left, right) => {
  const roleOrder = compareUtf8(left.role, right.role);
  return roleOrder !== 0 ? roleOrder : compareUtf8(left.keyId, right.keyId);
});
const approverByRole = new Map(
  approverRecords.map((record) => [record.role, record]),
);
const feasibilityApprovalKeys = {
  profile: "provider_feasibility_approval_keys_v1",
  activeKeyIds: {
    qa: approverByRole.get("qa").keyId,
    release: approverByRole.get("release").keyId,
  },
  publicKeyRecords: approverRecords,
  compromisedRevokedKeyIds: [],
};

const bindingRecords = bindingSecretSeedDefinitions.map((definition) => {
  const root = definition.providerId === providerA ? root1 : root3;
  return createSignedRegistryRecord({
    vectorId:
      definition.providerId === providerA ? "a1-binding-1" : "b1-binding-1",
    recordKind: "binding_derivation_generation",
    domain:
      STORE_DURABLE_OBJECT_PROVIDER_BINDING_DERIVATION_GENERATION_SIGNATURE_DOMAIN_V1,
    unsignedClaims: {
      profile:
        "store_durable_object_provider_binding_derivation_generation_v1",
      providerId: definition.providerId,
      registryGenerationIntroduced: 1,
      generation: definition.generation,
      algorithm: "hmac_sha256_provider_private",
      keyCommitmentDigest: `sha256:${hex(
        sha256Bytes(Buffer.from(definition.seedHex, "hex")),
      )}`,
    },
    root,
    schema: StoreDurableObjectProviderBindingDerivationGenerationV1Schema,
    messageBuilder:
      createStoreDurableObjectProviderBindingDerivationGenerationSignatureMessageV1,
    expectedFields: {
      providerId: definition.providerId,
      generation: definition.generation,
    },
  });
});
const bindingByProvider = new Map(
  bindingRecords.map((record) => [record.providerId, record]),
);

function createRuntime({
  vectorId,
  providerId,
  semanticProviderPolicyDigest,
  attestationGeneration,
  issuedAt,
  root,
}) {
  const unsignedClaims = {
    profile: "store_durable_object_provider_runtime_attestation_v1",
    providerId,
    semanticProviderPolicyDigest,
    implementationDigest: fixtureContentDigest("implementation", vectorId),
    binaryAttestationDigest: fixtureContentDigest("binary_attestation", vectorId),
    ipcEndpointAttestationDigest: fixtureContentDigest(
      "ipc_endpoint_attestation",
      vectorId,
    ),
    osPlatform: "linux",
    osReleaseFamilyCode: `provider-os-family:${fixtureShortHex(
      "os_release_family",
      "linux-fixture-family",
    )}`,
    osBuildDigest: fixtureContentDigest("os_build", vectorId),
    architecture: "x86_64",
    filesystemProfileDigest: fixtureContentDigest(
      "filesystem_profile",
      vectorId,
    ),
    realFilesystemConformanceResultDigest: fixtureContentDigest(
      "real_filesystem_conformance_result",
      vectorId,
    ),
    attestationGeneration,
    issuedAt,
  };
  const payload = createSignedRegistryRecord({
    vectorId,
    recordKind: "runtime_attestation",
    domain: STORE_PROVIDER_RUNTIME_ATTESTATION_SIGNATURE_DOMAIN_V1,
    unsignedClaims,
    root,
    schema: StoreDurableObjectProviderRuntimeAttestationV1Schema,
    messageBuilder:
      createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1,
    expectedFields: { providerId, attestationGeneration },
  });
  return {
    profile: "store_durable_object_provider_runtime_attestation_pin_v1",
    contentDigest:
      deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1(
        payload,
      ),
    payload,
  };
}

const semanticPolicyA = fixtureContentDigest("semantic_provider_policy", "a");
const semanticPolicyB = fixtureContentDigest("semantic_provider_policy", "b");
const runtimeA1 = createRuntime({
  vectorId: "a-runtime-1",
  providerId: providerA,
  semanticProviderPolicyDigest: semanticPolicyA,
  attestationGeneration: 1,
  issuedAt: "2026-08-03T00:00:10Z",
  root: root1,
});
const runtimeA2 = createRuntime({
  vectorId: "a-runtime-2",
  providerId: providerA,
  semanticProviderPolicyDigest: semanticPolicyA,
  attestationGeneration: 2,
  issuedAt: "2026-08-03T00:01:10Z",
  root: root2,
});
const runtimeB1 = createRuntime({
  vectorId: "b-runtime-1",
  providerId: providerB,
  semanticProviderPolicyDigest: semanticPolicyB,
  attestationGeneration: 1,
  issuedAt: "2026-08-03T00:02:10Z",
  root: root3,
});

function activeKeyIds(records, operationVectorId) {
  const operationKeyId = providerKeyRecordsByVectorId.get(operationVectorId).keyId;
  const byUsage = new Map(
    records.map((record) => [record.usage, record.keyId]),
  );
  return {
    operationReceipt: operationKeyId,
    containmentProof: byUsage.get("containment_proof"),
    stateVersion: byUsage.get("state_version"),
    journalVersion: byUsage.get("journal_version"),
  };
}

function verificationKeys({
  providerId,
  records,
  operationVectorId,
}) {
  return {
    profile: "store_durable_object_provider_verification_keys_v1",
    activeKeyIds: activeKeyIds(records, operationVectorId),
    activeBindingDerivationKeyGeneration: 1,
    publicKeyRecords: records,
    bindingDerivationGenerationRecords: [bindingByProvider.get(providerId)],
    compromisedRevokedKeyIds: [],
    compromisedRevokedBindingDerivationGenerations: [],
  };
}

function evidencePin(providerId, runtimeLabel) {
  return {
    locatorProfile: "installation_provider_feasibility_evidence_v1",
    evidenceId: `provider-feasibility-evidence:${fixtureShortHex(
      "feasibility_evidence",
      `${providerId}:${runtimeLabel}`,
    )}`,
    contentDigest: fixtureContentDigest(
      "feasibility_evidence",
      `${providerId}:${runtimeLabel}`,
    ),
  };
}

function createEntry({
  vectorId,
  providerId,
  semanticProviderPolicyDigest,
  registryGeneration,
  predecessorRegistryEntryContentDigest,
  activeRoot,
  runtimeAttestation,
  verificationKeySet,
  evidenceLabel,
}) {
  const unsignedClaims = {
    profile: "store_durable_object_provider_registry_entry_v1",
    installationIdentityGenerationId,
    activeRootMetadata: activeRoot.pin,
    registryRootKeyId: activeRoot.rootKeyId,
    providerId,
    semanticProviderPolicyDigest,
    providerFeasibilityEvidence: evidencePin(providerId, evidenceLabel),
    runtimeAttestation,
    verificationKeys: verificationKeySet,
    feasibilityApprovalKeys,
    status: "enabled",
    registryGeneration,
    ...(predecessorRegistryEntryContentDigest === undefined
      ? {}
      : { predecessorRegistryEntryContentDigest }),
  };
  const message =
    createStoreDurableObjectProviderRegistryEntrySignatureMessageV1(
      unsignedClaims,
      activeRoot.rootKeyId,
    );
  const entry = StoreDurableObjectProviderRegistryEntryV1Schema.parse({
    ...unsignedClaims,
    registrySignature: registrySignature(activeRoot, message),
  });
  const contentDigest =
    deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(entry);
  entryVectorInputs.push({
    vectorId,
    providerId,
    registryGeneration,
    rootKeyId: activeRoot.rootKeyId,
    entry,
    message,
    contentDigest,
  });
  return Object.freeze({ entry, contentDigest });
}

const entryA1 = createEntry({
  vectorId: "a-entry-1",
  providerId: providerA,
  semanticProviderPolicyDigest: semanticPolicyA,
  registryGeneration: 1,
  activeRoot: root1,
  runtimeAttestation: runtimeA1,
  verificationKeySet: verificationKeys({
    providerId: providerA,
    records: aInitialKeyRecords,
    operationVectorId: "a1-operation-receipt",
  }),
  evidenceLabel: "runtime-1",
});
const entryA2 = createEntry({
  vectorId: "a-entry-2",
  providerId: providerA,
  semanticProviderPolicyDigest: semanticPolicyA,
  registryGeneration: 2,
  predecessorRegistryEntryContentDigest: entryA1.contentDigest,
  activeRoot: root2,
  runtimeAttestation: runtimeA2,
  verificationKeySet: verificationKeys({
    providerId: providerA,
    records: aAllKeyRecords,
    operationVectorId: "a2-operation-receipt-rotated",
  }),
  evidenceLabel: "runtime-2",
});
const entryA3 = createEntry({
  vectorId: "a-entry-3-root-rollover",
  providerId: providerA,
  semanticProviderPolicyDigest: semanticPolicyA,
  registryGeneration: 3,
  predecessorRegistryEntryContentDigest: entryA2.contentDigest,
  activeRoot: root3,
  runtimeAttestation: runtimeA2,
  verificationKeySet: entryA2.entry.verificationKeys,
  evidenceLabel: "runtime-2",
});
const entryB1 = createEntry({
  vectorId: "b-entry-1",
  providerId: providerB,
  semanticProviderPolicyDigest: semanticPolicyB,
  registryGeneration: 1,
  activeRoot: root3,
  runtimeAttestation: runtimeB1,
  verificationKeySet: verificationKeys({
    providerId: providerB,
    records: bKeyRecords,
    operationVectorId: "b1-operation-receipt",
  }),
  evidenceLabel: "runtime-1",
});

function enabledMember(entryValue) {
  return {
    providerId: entryValue.entry.providerId,
    disposition: "enabled",
    registryEntryContentDigest: entryValue.contentDigest,
    registryEntry: entryValue.entry,
  };
}

const migrationId = `provider-migration:${fixtureShortHex(
  "same_installation_provider_migration",
  "native-a-to-native-b",
)}`;
const revokedA = Object.freeze({
  providerId: providerA,
  disposition: "revoked",
  lastEnabledRegistryEntryContentDigest: entryA3.contentDigest,
  revokedAtManifestGeneration: 6,
  reason: "migration_completed",
});

function createManifest({
  manifestGeneration,
  activeRoot,
  predecessorEnvelope,
  members,
  routing,
  issuedAt,
}) {
  const predecessor =
    predecessorEnvelope === undefined
      ? { state: "genesis" }
      : {
          state: "manifest",
          generationId: predecessorEnvelope.generationId,
          contentDigest: predecessorEnvelope.contentDigest,
        };
  const idFields = {
    installationIdentityGenerationId,
    activeRootMetadata: activeRoot.pin,
    members,
    routing,
    manifestGeneration,
    predecessor,
  };
  const generationId = deriveProviderRegistryManifestGenerationIdV1(idFields);
  const unsignedClaims = {
    profile: "provider_registry_manifest_v1",
    generationId,
    installationIdentityGenerationId,
    activeRootMetadata: activeRoot.pin,
    members,
    routing,
    issuedAt,
    manifestGeneration,
    predecessor,
  };
  const message = createProviderRegistryManifestSignatureMessageV1(
    unsignedClaims,
    activeRoot.rootKeyId,
  );
  const payload = ProviderRegistryManifestV1Schema.parse({
    ...unsignedClaims,
    manifestSignature: manifestSignature(activeRoot, message),
  });
  const contentDigest = deriveProviderRegistryManifestContentDigestV1(payload);
  return ProviderRegistryManifestEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_registry_manifest",
    generationId,
    contentDigest,
    payload,
  });
}

const registryManifestHistory = [];
registryManifestHistory.push(
  createManifest({
    manifestGeneration: 1,
    activeRoot: root1,
    members: [enabledMember(entryA1)],
    routing: { state: "steady" },
    issuedAt: "2026-08-03T00:00:30Z",
  }),
);
registryManifestHistory.push(
  createManifest({
    manifestGeneration: 2,
    activeRoot: root2,
    predecessorEnvelope: registryManifestHistory[0],
    members: [enabledMember(entryA2)],
    routing: { state: "steady" },
    issuedAt: "2026-08-03T00:01:30Z",
  }),
);
registryManifestHistory.push(
  createManifest({
    manifestGeneration: 3,
    activeRoot: root3,
    predecessorEnvelope: registryManifestHistory[1],
    members: [enabledMember(entryA3), enabledMember(entryB1)],
    routing: {
      state: "migration",
      migrationId,
      sourceProviderId: providerA,
      destinationProviderId: providerB,
      activeForMigrationWrites: providerA,
      phase: "prepared",
    },
    issuedAt: "2026-08-03T00:02:30Z",
  }),
);
registryManifestHistory.push(
  createManifest({
    manifestGeneration: 4,
    activeRoot: root3,
    predecessorEnvelope: registryManifestHistory[2],
    members: [enabledMember(entryA3), enabledMember(entryB1)],
    routing: {
      state: "migration",
      migrationId,
      sourceProviderId: providerA,
      destinationProviderId: providerB,
      activeForMigrationWrites: providerB,
      phase: "rebinding",
    },
    issuedAt: "2026-08-03T00:03:00Z",
  }),
);
registryManifestHistory.push(
  createManifest({
    manifestGeneration: 5,
    activeRoot: root3,
    predecessorEnvelope: registryManifestHistory[3],
    members: [enabledMember(entryA3), enabledMember(entryB1)],
    routing: {
      state: "migration",
      migrationId,
      sourceProviderId: providerA,
      destinationProviderId: providerB,
      activeForMigrationWrites: providerB,
      phase: "source_drained",
    },
    issuedAt: "2026-08-03T00:03:30Z",
  }),
);
registryManifestHistory.push(
  createManifest({
    manifestGeneration: 6,
    activeRoot: root3,
    predecessorEnvelope: registryManifestHistory[4],
    members: [revokedA, enabledMember(entryB1)],
    routing: { state: "steady" },
    issuedAt: "2026-08-03T00:04:00Z",
  }),
);
registryManifestHistory.push(
  createManifest({
    manifestGeneration: 7,
    activeRoot: root3,
    predecessorEnvelope: registryManifestHistory[5],
    members: [revokedA, enabledMember(entryB1)],
    routing: { state: "steady" },
    issuedAt: "2026-08-03T00:04:30Z",
  }),
);

const strictManifestBytes = new Uint8Array(await readFile(strictManifestPath));
let pointCalls = 0;
let signatureCalls = 0;
const strictCryptoCapability =
  await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint(point) {
        pointCalls += 1;
        return validatePrimeSubgroupPoint(point);
      },
      verifyRawEd25519(publicKey, message, signature) {
        signatureCalls += 1;
        return verifyRawEd25519(publicKey, message, signature);
      },
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(resourcePath, maxBytes) {
        if (
          resourcePath !==
            PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
          maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
        ) {
          throw new Error("unexpected strict Ed25519 manifest request");
        }
        return strictManifestBytes.slice();
      },
    }),
  });

pointCalls = 0;
signatureCalls = 0;
const diagnostic =
  await diagnoseProviderRegistryManifestHistoryInternalV1({
    installationIdentityGenerationId,
    bootstrapTrustBundle: rootHistory.bootstrapTrustBundle,
    rootMetadataHistory: rootHistory.rootMetadataHistory,
    registryManifestHistory,
    strictCryptoCapability,
  });
if (!diagnostic.ok) {
  throw new Error(
    `generated registry history failed strict validation: ${diagnostic.stage}/${diagnostic.reason}`,
  );
}
if (
  pointCalls !== expectedCryptoCalls.postAttestationPointCalls ||
  signatureCalls !== expectedCryptoCalls.postAttestationSignatureCalls
) {
  throw new Error(
    `registry history crypto closure changed: observed ${pointCalls} point and ${signatureCalls} signature calls`,
  );
}
const validation = diagnostic.value;

const canonicalEnvelopeLogicalBytes = registryManifestHistory.map(
  (envelope) => canonicalizeJcsSafeIntegerUtf8V1(envelope).byteLength,
);
const retainedRegistryManifestCanonicalBytes =
  canonicalEnvelopeLogicalBytes.reduce((total, bytes) => total + bytes, 0);
const currentRegistryManifest = registryManifestPin(
  registryManifestHistory[registryManifestHistory.length - 1],
);
if (
  validation.authority !== "none_registry_structure_and_history_only" ||
  validation.retainedRegistryManifestGenerationCount !== 7 ||
  validation.retainedRegistryManifestCanonicalBytes !==
    retainedRegistryManifestCanonicalBytes ||
  validation.retainedRootMetadataCanonicalBytes !==
    rootHistory.expected.canonicalEnvelopeLogicalBytes ||
  !canonicalJsonEqual(
    validation.currentRootMetadata,
    rootHistory.expected.currentRootMetadata,
  ) ||
  !canonicalJsonEqual(validation.currentRegistryManifest, currentRegistryManifest)
) {
  throw new Error("generated registry history validation summary mismatch");
}

const nestedRecordSignatureVectors = nestedRecordVectorInputs.map(
  ({
    vectorId,
    recordKind,
    domain,
    rootKeyId,
    message,
    signedRecord,
    expectedFields,
  }) => ({
    vectorId,
    recordKind,
    ...expectedFields,
    rootKeyId,
    signatureDomain: domain,
    signatureMessageCanonicalUtf8Hex: hex(message),
    registrySignature: signedRecord.registrySignature,
    canonicalRecordUtf8Hex: canonicalHex(signedRecord),
    ...(recordKind === "runtime_attestation"
      ? {
          contentDigest:
            deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1(
              signedRecord,
            ),
        }
      : {}),
  }),
);

const entryVectors = entryVectorInputs.map(
  ({
    vectorId,
    providerId,
    registryGeneration,
    rootKeyId,
    entry,
    message,
    contentDigest,
  }) => ({
    vectorId,
    providerId,
    registryGeneration,
    rootKeyId,
    contentDigest,
    runtimeAttestationContentDigest: entry.runtimeAttestation.contentDigest,
    predecessor:
      "predecessorRegistryEntryContentDigest" in entry
        ? {
            state: "registry_entry",
            contentDigest: entry.predecessorRegistryEntryContentDigest,
          }
        : { state: "genesis" },
    signatureDomain:
      STORE_DURABLE_OBJECT_PROVIDER_REGISTRY_ENTRY_SIGNATURE_DOMAIN_V1,
    unsignedClaimsCanonicalUtf8Hex: canonicalHex(
      projectStoreDurableObjectProviderRegistryEntryUnsignedClaimsV1(entry),
    ),
    signatureMessageCanonicalUtf8Hex: hex(message),
    registrySignature: entry.registrySignature,
    canonicalEntryUtf8Hex: canonicalHex(entry),
  }),
);

const manifestVectors = registryManifestHistory.map((envelope, index) => {
  const idFields = projectProviderRegistryManifestIdFieldsV1(envelope.payload);
  const idPreimage = canonicalizeJcsSafeIntegerUtf8V1([
    PROVIDER_REGISTRY_MANIFEST_ID_DOMAIN_V1,
    idFields,
  ]);
  const idPreimageSha256Hex = hex(sha256Bytes(idPreimage));
  const signatureMessage = createProviderRegistryManifestSignatureMessageV1(
    envelope.payload,
  );
  if (
    envelope.generationId !==
      `provider-registry-manifest:${idPreimageSha256Hex.slice(0, 22)}`
  ) {
    throw new Error(`manifest ${index + 1} full ID preimage mismatch`);
  }
  return {
    manifestGeneration: envelope.payload.manifestGeneration,
    activeRootMetadata: envelope.payload.activeRootMetadata,
    routing: envelope.payload.routing,
    enabledRegistryEntries: envelope.payload.members
      .filter(({ disposition }) => disposition === "enabled")
      .map((member) => ({
        providerId: member.providerId,
        registryGeneration: member.registryEntry.registryGeneration,
        registryEntryContentDigest: member.registryEntryContentDigest,
      })),
    revokedMembers: envelope.payload.members
      .filter(({ disposition }) => disposition === "revoked")
      .map((member) => member),
    manifestIdFieldsCanonicalUtf8Hex: canonicalHex(idFields),
    manifestIdFullPreimageCanonicalUtf8Hex: hex(idPreimage),
    manifestIdFullPreimageSha256Hex: idPreimageSha256Hex,
    generationId: envelope.generationId,
    contentDigest: envelope.contentDigest,
    signatureDomain: PROVIDER_REGISTRY_MANIFEST_SIGNATURE_DOMAIN_V1,
    unsignedClaimsCanonicalUtf8Hex: canonicalHex(
      projectProviderRegistryManifestUnsignedClaimsV1(envelope.payload),
    ),
    signatureMessageCanonicalUtf8Hex: hex(signatureMessage),
    manifestSignature: envelope.payload.manifestSignature,
    envelopeCanonicalLogicalBytes: canonicalEnvelopeLogicalBytes[index],
    envelopeCanonicalUtf8Hex: canonicalHex(envelope),
    locator: buildProviderRegistryManifestRelativePathV1({
      locatorProfile: "installation_provider_registry_manifest_v1",
      generationId: envelope.generationId,
    }),
  };
});

const a2AndA3VerificationKeysHex = canonicalHex(
  entryA2.entry.verificationKeys,
);
if (
  a2AndA3VerificationKeysHex !==
    canonicalHex(entryA3.entry.verificationKeys) ||
  canonicalHex(entryA2.entry.runtimeAttestation) !==
    canonicalHex(entryA3.entry.runtimeAttestation) ||
  canonicalHex(entryA2.entry.feasibilityApprovalKeys) !==
    canonicalHex(entryA3.entry.feasibilityApprovalKeys) ||
  canonicalHex(
    registryManifestHistory[5].payload.members.find(
      ({ providerId }) => providerId === providerA,
    ),
  ) !==
    canonicalHex(
      registryManifestHistory[6].payload.members.find(
        ({ providerId }) => providerId === providerA,
      ),
    )
) {
  throw new Error("retained registry closure is not byte-identical");
}

const goldenManifest = {
  schemaVersion: 1,
  profile: "provider_registry_entry_manifest_history_golden_manifest_v1",
  canonicalizationProfile: "rfc8785-jcs-safe-integer-v1",
  verificationProfile:
    "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
  fixtureAuthority: "none_registry_structure_and_history_only",
  deterministicSeeds: {
    purpose: "non_production_fixture_only",
    rootHistoryDependencySeeds: rootHistory.deterministicSeeds,
    installationInitializationNonceHex,
    providerVerificationKeySeeds: providerKeySeedDefinitions,
    feasibilityApproverKeySeeds: approverSeedDefinitions,
    bindingDerivationSecretSeeds: bindingSecretSeedDefinitions,
    fixtureIdentifierDerivation: {
      domain: domains.fixtureIdentifier,
      warning: "non_production_fixture_only",
    },
    fixtureContentDigestDerivation: {
      domain: domains.fixtureContent,
      warning: "non_production_fixture_only",
    },
  },
  rootHistoryDependency: {
    resourcePath: PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
    resourceByteLength:
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    resourceSha256Hex:
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
    semanticContentDigest:
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  },
  installationIdentityGenerationId,
  bootstrapTrustBundle: rootHistory.bootstrapTrustBundle,
  rootMetadataHistory: rootHistory.rootMetadataHistory,
  registryManifestHistory,
  expected: {
    registryManifestCount: 7,
    canonicalEnvelopeLogicalBytes,
    retainedRootMetadataCanonicalBytes:
      validation.retainedRootMetadataCanonicalBytes,
    retainedRegistryManifestCanonicalBytes,
    retainedTrustHistoryCanonicalBytes:
      validation.retainedTrustHistoryCanonicalBytes,
    currentRootMetadata: validation.currentRootMetadata,
    currentRegistryManifest,
    uniqueClosure: {
      rootMetadataCount: 3,
      providerVerificationPublicKeyRecordCount: 11,
      bindingDerivationGenerationRecordCount: 2,
      feasibilityApproverPublicKeyRecordCount: 2,
      runtimeAttestationCount: 3,
      registryEntryCount: 4,
      registryManifestCount: 7,
      sourceProviderTombstoneCount: 1,
    },
    cryptoClosure: {
      postAttestationPointCalls: pointCalls,
      postAttestationSignatureCalls: signatureCalls,
      rootHistory: { pointCalls: 11, signatureCalls: 9 },
      registryManifestAndUniqueRecordClosure: {
        pointCalls: pointCalls - 11,
        signatureCalls: signatureCalls - 9,
      },
    },
    retainedByteIdentities: {
      globalFeasibilityApprovalKeysCanonicalUtf8Hex: canonicalHex(
        feasibilityApprovalKeys,
      ),
      aInitialProviderVerificationRecordsCanonicalUtf8Hex: canonicalHex(
        aInitialKeyRecords,
      ),
      a2AndA3VerificationKeysCanonicalUtf8Hex:
        a2AndA3VerificationKeysHex,
      a2AndA3RuntimeAttestationCanonicalUtf8Hex: canonicalHex(
        entryA2.entry.runtimeAttestation,
      ),
      b1RegistryEntryCanonicalUtf8Hex: canonicalHex(entryB1.entry),
      g6AndG7SourceTombstoneCanonicalUtf8Hex: canonicalHex(revokedA),
    },
    nestedRecordSignatureVectors,
    entryVectors,
    manifestVectors,
  },
};

const goldenBytes = prettyJsonBytes(goldenManifest);
const anchors = {
  resourcePath: goldenResourcePath,
  resourceByteLength: goldenBytes.byteLength,
  resourceSha256Hex: hex(sha256Bytes(goldenBytes)),
  semanticContentDigest: semanticDigest(domains.goldenManifest, goldenManifest),
};

if (process.argv.includes("--anchors")) {
  process.stdout.write(`${JSON.stringify(anchors, null, 2)}\n`);
  process.exit(0);
}

if (process.argv.includes("--check")) {
  const checked = await readFile(goldenPath);
  if (!checked.equals(goldenBytes)) {
    throw new Error(
      "provider Registry Entry/Manifest history fixture differs from deterministic generation",
    );
  }
  process.stdout.write(
    "Verified deterministic provider Registry Entry/Manifest history fixture: 7 generations.\n",
  );
  process.exit(0);
}

await mkdir(dirname(goldenPath), { recursive: true });
await writeFile(goldenPath, goldenBytes);
process.stdout.write(
  "Generated provider Registry Entry/Manifest history fixture: 7 generations.\n",
);
