/*
 * Step15-A production composition smoke.  This is deliberately a Linux-only
 * subprocess harness: root creates the signed installation fixture and starts
 * the real root authority broker; a dedicated runtime principal owns the
 * runtime/ext4 object tree; an unrelated caller reaches it only through the
 * tracked public gateway/client.  The authority fixture uses the existing
 * signed Registry golden history and the real Acceptance/broker stores.  It is
 * not a systemd installer test; service lifecycle is represented by the three
 * real OS processes and a restart of both runtime and gateway.
 */

import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
} from "node:crypto";
import {
  access,
  chmod,
  chown,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  statfs,
  writeFile,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalizeJcsSafeIntegerV1,
} from "@understand-code/durable-object-provider-contracts/jcs";
import {
  ProviderAcceptanceCompareAppendRequestV1Schema,
  ProviderAcceptanceStateEnvelopeV1Schema,
  createProviderAcceptanceStateTokenMessageV1,
  deriveProviderAcceptanceStateContentDigestV1,
  deriveProviderAcceptanceStateGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import {
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestV1Schema,
  StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1Schema,
  StoreDurableObjectProviderRegistryEntryV1Schema,
  StoreDurableObjectProviderVerificationPublicKeyV1Schema,
  createProviderRegistryManifestSignatureMessageV1,
  createStoreDurableObjectProviderRegistryEntrySignatureMessageV1,
  createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1,
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
  deriveStoreDurableObjectProviderRegistryEntryContentDigestV1,
  deriveStoreProviderVerificationKeyIdV1,
} from "@understand-code/durable-object-provider-contracts/provider-registry";
import {
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-acceptance-candidate";
import {
  deriveInstallationIdentityGenerationIdV1,
  deriveInstallationIdentityKeyCheckTokenV1,
} from "@understand-code/durable-object-provider-contracts";
import {
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  createProviderServiceHandoffConfigV1,
  createProviderServiceReadinessReceiptV1,
} from "@understand-code/durable-object-provider-runtime/service-handoff";
import {
  installProviderProductionStrongClientTrustV1,
  providerProductionStrongClientGatewaySocketPathV1,
} from "@understand-code/durable-object-provider-runtime/provider-production-strong-client-trust-lifecycle";
import {
  openProviderProductionStrongObjectClientV1,
  startProviderProductionStrongObjectGatewayServiceV1,
} from "@understand-code/durable-object-provider-client";
import { DurableObjectProviderRuntimeServerV1 } from "@understand-code/durable-object-provider-runtime/server";
import {
  createProviderRuntimeStrongMutationBrokerVerifierInternalV1,
} from "../../durable-object-provider-runtime/dist/strong-mutation-broker-client-internal.js";

const PROVIDER_ID = "durable-object-provider:native-b";
const TARGET_PROFILE_ID = `provider-target-profile:${"a".repeat(64)}`;
const TARGET_FINGERPRINT_DIGEST = `sha256:${"c".repeat(64)}`;
const CAPABILITY_DIGEST = `sha256:${"1".repeat(64)}`;
const SERVICE_UID = 42001;
const SERVICE_GID = 42002;
const CALLER_UID = 42003;
const CALLER_GID = 42004;
const BAD_CALLER_UID = 42005;
const BAD_CALLER_GID = 42006;
const IDENTITY_NONCE = "a1".repeat(16);
const IDENTITY_KEY = Uint8Array.from({ length: 32 }, (_v, i) => i);
const GRANT_SEED = 0x41;
const SERVICE_SEED = 0x51;
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), "../../..");
const REGISTRY_FIXTURE_PATH = join(
  REPO_ROOT,
  "packages/durable-object-provider-contracts/fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json",
);

function privateKey(seed) {
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.alloc(32, seed),
    ]),
    format: "der",
    type: "pkcs8",
  });
}

function publicSpki(key) {
  return `base64url:${Buffer.from(
    createPublicKey(key).export({ format: "der", type: "spki" }),
  ).toString("base64url")}`;
}

function rawPublic(key) {
  const spki = Buffer.from(createPublicKey(key).export({ format: "der", type: "spki" }));
  return `base64url:${spki.subarray(-32).toString("base64url")}`;
}

function digestBytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function digestValue(value) {
  return digestBytes(Buffer.from(canonicalizeJcsSafeIntegerV1(value), "utf8"));
}

function rootPrivate(fixture) {
  return privateKey(Buffer.from(
    fixture.deterministicSeeds.rootHistoryDependencySeeds.compromiseRootSeedHex,
    "hex",
  ));
}

function rootId(fixture) {
  return fixture.rootMetadataHistory.at(-1).rootKeyId;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function clone(value) {
  return structuredClone(value);
}

function createGrantKeyRecord(fixture, generation, seed) {
  const key = privateKey(seed);
  const publicKeyBytes = rawPublic(key);
  const unsigned = {
    profile: "store_durable_object_provider_verification_public_key_v1",
    providerId: PROVIDER_ID,
    registryGenerationIntroduced: generation,
    keyId: deriveStoreProviderVerificationKeyIdV1({
      providerId: PROVIDER_ID,
      usage: "strong_mutation_authority_grant",
      publicKeyBytes,
    }),
    usage: "strong_mutation_authority_grant",
    algorithm: "ed25519",
    publicKeyBytes,
    publicKeyDigest: digestBytes(Buffer.from(publicKeyBytes.slice("base64url:".length), "base64url")),
  };
  return StoreDurableObjectProviderVerificationPublicKeyV1Schema.parse({
    ...unsigned,
    registrySignature: `provider-registry-ed25519:${rootId(fixture)}:${sign(null, Buffer.from(createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1(unsigned, rootId(fixture))), rootPrivate(fixture)).toString("hex")}`,
  });
}

function appendGrantManifest(fixture) {
  const history = clone(fixture.registryManifestHistory);
  const previous = history.at(-1);
  const member = previous.payload.members.find(
    (candidate) => candidate.providerId === PROVIDER_ID && candidate.disposition === "enabled",
  );
  if (member === undefined) throw new Error("enabled Registry member missing");
  const previousEntry = member.registryEntry;
  const generation = previousEntry.registryGeneration + 1;
  const grantKey = createGrantKeyRecord(fixture, generation, GRANT_SEED);
  const { registrySignature: _oldSignature, ...unsignedPrevious } = previousEntry;
  const entryCandidate = clone({
    ...unsignedPrevious,
    registryGeneration: generation,
    predecessorRegistryEntryContentDigest:
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(previousEntry),
  });
  entryCandidate.verificationKeys.publicKeyRecords.push(grantKey);
  entryCandidate.verificationKeys.publicKeyRecords.sort((a, b) =>
    compareUtf8(a.providerId, b.providerId) || compareUtf8(a.usage, b.usage) || compareUtf8(a.keyId, b.keyId));
  entryCandidate.verificationKeys.activeKeyIds.strongMutationAuthorityGrant = grantKey.keyId;
  const entryUnsigned = StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1Schema.parse(entryCandidate);
  const entry = StoreDurableObjectProviderRegistryEntryV1Schema.parse({
    ...entryUnsigned,
    registrySignature: `provider-registry-ed25519:${rootId(fixture)}:${sign(null, Buffer.from(createStoreDurableObjectProviderRegistryEntrySignatureMessageV1(entryUnsigned, rootId(fixture))), rootPrivate(fixture)).toString("hex")}`,
  });
  const members = previous.payload.members.map((candidate) => candidate.providerId === PROVIDER_ID && candidate.disposition === "enabled"
    ? { ...candidate, registryEntryContentDigest: deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(entry), registryEntry: entry }
    : candidate);
  const idFields = {
    installationIdentityGenerationId: previous.payload.installationIdentityGenerationId,
    activeRootMetadata: previous.payload.activeRootMetadata,
    manifestGeneration: previous.payload.manifestGeneration + 1,
    predecessor: { state: "manifest", generationId: previous.generationId, contentDigest: previous.contentDigest },
    members,
    routing: previous.payload.routing,
  };
  const generationId = deriveProviderRegistryManifestGenerationIdV1(idFields);
  const unsignedManifest = { profile: "provider_registry_manifest_v1", generationId, ...idFields, issuedAt: "2026-08-26T00:00:00Z" };
  const manifestPayload = ProviderRegistryManifestV1Schema.parse({
    ...unsignedManifest,
    manifestSignature: `provider-registry-manifest-ed25519:${rootId(fixture)}:${sign(null, Buffer.from(createProviderRegistryManifestSignatureMessageV1(unsignedManifest, rootId(fixture))), rootPrivate(fixture)).toString("hex")}`,
  });
  const envelope = ProviderRegistryManifestEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_registry_manifest",
    generationId,
    contentDigest: deriveProviderRegistryManifestContentDigestV1(manifestPayload),
    payload: manifestPayload,
  });
  return { history: [...history, envelope], grantKey };
}

function trustedConfiguration(fixture, history) {
  const current = history.at(-1);
  const member = current.payload.members.find(
    (candidate) => candidate.providerId === PROVIDER_ID && candidate.disposition === "enabled",
  );
  const entry = member.registryEntry;
  return {
    state: "strong_ready",
    core: {
      activeRootMetadata: current.payload.activeRootMetadata,
      providerRegistryManifest: {
        locatorProfile: "installation_provider_registry_manifest_v1",
        manifestGeneration: current.payload.manifestGeneration,
        generationId: current.generationId,
        contentDigest: current.contentDigest,
      },
      providerSupportCatalog: {
        locatorProfile: "distribution_provider_feasibility_support_catalog_v1",
        catalogGeneration: 1,
        contentDigest: `sha256:${"9".repeat(64)}`,
      },
      activeWriterSelector: {
        profile: "provider_active_writer_selector_v1",
        selections: [{
          targetProfileId: TARGET_PROFILE_ID,
          providerId: PROVIDER_ID,
          registryEntryContentDigest: member.registryEntryContentDigest,
          semanticProviderPolicyDigest: entry.semanticProviderPolicyDigest,
          providerFeasibilityEvidence: entry.providerFeasibilityEvidence,
          runtimeAttestationContentDigest: entry.runtimeAttestation.contentDigest,
          bindingDerivationKeyGeneration: entry.verificationKeys.activeBindingDerivationKeyGeneration,
        }],
      },
    },
    activation: { origin: "bootstrap_or_steady_successor" },
  };
}

function identityGeneration(fixture) {
  return InstallationIdentityGenerationIdV1Schema.parse(fixture.installationIdentityGenerationId);
}

async function makeFixture(work, installRoot, runtimeRoot, paths) {
  const fixture = JSON.parse(await readFile(REGISTRY_FIXTURE_PATH, "utf8"));
  const registry = appendGrantManifest(fixture);
  const installationIdentityGenerationId = identityGeneration(fixture);
  const cryptoHost = {
    sha256(message) { return new Uint8Array(createHash("sha256").update(message).digest()); },
    hmacSha256(key, message) { return new Uint8Array(createHmac("sha256", key).update(message).digest()); },
  };
  const keyCheckToken = await deriveInstallationIdentityKeyCheckTokenV1(
    { generationId: installationIdentityGenerationId, initializationNonce: IDENTITY_NONCE },
    IDENTITY_KEY,
    cryptoHost,
  );
  const configPlaceholder = trustedConfiguration(fixture, registry.history);
  const acceptanceUnsigned = {
    profile: "provider_acceptance_state_v1",
    generationId: deriveProviderAcceptanceStateGenerationIdV1({
      installationIdentityGenerationId,
      acceptanceOrdinal: 1,
      predecessor: { state: "genesis" },
      configuration: configPlaceholder,
    }),
    installationIdentityGenerationId,
    acceptanceOrdinal: 1,
    predecessor: { state: "genesis" },
    configuration: configPlaceholder,
    acceptedAt: "2026-08-26T00:00:00Z",
  };
  const acceptancePayload = {
    ...acceptanceUnsigned,
    acceptanceToken: `hmac-sha256:${createHmac("sha256", IDENTITY_KEY)
      .update(createProviderAcceptanceStateTokenMessageV1(acceptanceUnsigned)).digest("hex")}`,
  };
  const acceptance = ProviderAcceptanceStateEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_acceptance_state",
    generationId: acceptancePayload.generationId,
    installationIdentityGenerationId,
    acceptedAt: acceptancePayload.acceptedAt,
    contentDigest: deriveProviderAcceptanceStateContentDigestV1(acceptancePayload),
    payload: acceptancePayload,
  });
  const acceptanceRequest = ProviderAcceptanceCompareAppendRequestV1Schema.parse({
    profile: "provider_acceptance_compare_append_request_v1",
    operationNonce: "00000000000000000000000000000001",
    installationIdentityGenerationId,
    expected: { state: "genesis", expectedNamespaceState: "absent" },
    candidate: acceptance,
  });
  const servicePrivateKey = privateKey(SERVICE_SEED);
  const config = createProviderServiceHandoffConfigV1({
    payload: {
      schemaVersion: 1,
      profile: "understand_code_provider_service_handoff_payload_v1",
      platform: "linux",
      serviceLabel: "understand-code-step15-production-e2e",
      providerId: PROVIDER_ID,
      principal: { kind: "dedicated_os_principal", name: "ucstep15runtime", uid: SERVICE_UID, gid: SERVICE_GID },
      runtimeRoot,
      socketPath: join(runtimeRoot, "provider.sock"),
      executablePath: process.execPath,
      configPath: join(installRoot, "provider-service-config-v1.json"),
      authKeyPath: join(runtimeRoot, "auth.key"),
      readinessPath: join(runtimeRoot, "readiness.json"),
      signingKeyPath: join(runtimeRoot, "signing.key"),
      installationIdentityCustody: {
        keyPath: join(runtimeRoot, "installation-identity.key"),
        initializationNonce: IDENTITY_NONCE,
        installationIdentityGenerationId,
        keyCheckToken,
      },
      installationIdentityDigest: digestBytes(IDENTITY_KEY),
      binaryDigest: `sha256:${"b".repeat(64)}`,
      capabilityDigest: CAPABILITY_DIGEST,
    },
    privateKey: servicePrivateKey,
  });
  await writeFile(paths.configPath, `${canonicalizeJcsSafeIntegerV1(config)}\n`, { mode: 0o644 });
  await chown(paths.configPath, 0, 0);
  const authKey = randomBytes(32);
  await writeFile(config.payload.authKeyPath, authKey, { mode: 0o600 });
  await chown(config.payload.authKeyPath, SERVICE_UID, SERVICE_GID);
  const signingKey = Buffer.from(servicePrivateKey.export({ format: "der", type: "pkcs8" }));
  await writeFile(config.payload.signingKeyPath, signingKey, { mode: 0o600 });
  await chown(config.payload.signingKeyPath, SERVICE_UID, SERVICE_GID);
  await writeFile(config.payload.installationIdentityCustody.keyPath, IDENTITY_KEY, { mode: 0o600 });
  await chown(config.payload.installationIdentityCustody.keyPath, SERVICE_UID, SERVICE_GID);
  const grantKey = Buffer.from(privateKey(GRANT_SEED).export({ format: "der", type: "pkcs8" }));
  await writeFile(paths.grantKeyPath, grantKey, { mode: 0o600 });
  await chown(paths.grantKeyPath, SERVICE_UID, SERVICE_GID);
  const readiness = createProviderServiceReadinessReceiptV1({
    config,
    observedUid: SERVICE_UID,
    observedGid: SERVICE_GID,
    targetFingerprintDigest: TARGET_FINGERPRINT_DIGEST,
    nonce: Uint8Array.from({ length: 32 }, (_v, i) => 255 - i),
    privateKey: servicePrivateKey,
  });
  await writeFile(config.payload.readinessPath, `${canonicalizeJcsSafeIntegerV1(readiness)}\n`, { mode: 0o600 });
  await chown(config.payload.readinessPath, SERVICE_UID, SERVICE_GID);
  const identityManifest = {
    schemaVersion: 1,
    profile: "understand_code_provider_service_installation_manifest_v1",
    installationRoot: installRoot,
    manifestGeneration: 1,
    platform: "linux",
    serviceLabel: config.payload.serviceLabel,
    providerId: PROVIDER_ID,
    principal: config.payload.principal,
    runtimeRoot,
    installationIdentityDigest: config.payload.installationIdentityDigest,
    handoffPayloadDigest: config.payloadDigest,
    binaryDigest: config.payload.binaryDigest,
    capabilityDigest: CAPABILITY_DIGEST,
    servicePublicKey: config.publicKey,
    managedArtifacts: [
      { kind: "service_config", path: paths.configPath, contentDigest: digestBytes(Buffer.from(`${canonicalizeJcsSafeIntegerV1(config)}\n`)), byteLength: Buffer.byteLength(`${canonicalizeJcsSafeIntegerV1(config)}\n`), mode: 0o644, owner: "authority" },
      { kind: "service_descriptor", path: `${installRoot}.provider-production-strong-client-v1.json`, contentDigest: `sha256:${"d".repeat(64)}`, byteLength: 1, mode: 0o644, owner: "authority" },
      { kind: "runtime_auth_key", path: config.payload.authKeyPath, contentDigest: digestBytes(authKey), byteLength: authKey.byteLength, mode: 0o600, owner: "service_principal" },
      { kind: "runtime_signing_key", path: config.payload.signingKeyPath, contentDigest: digestBytes(signingKey), byteLength: signingKey.byteLength, mode: 0o600, owner: "service_principal" },
    ],
    ephemeralPaths: { socketPath: config.payload.socketPath, readinessPath: config.payload.readinessPath },
    retainedState: { runtimeRoot, installationIdentityKeyPath: config.payload.installationIdentityCustody.keyPath },
    previous: null,
  };
  const manifestEnvelope = {
    payload: identityManifest,
    contentDigest: digestValue(["understand-code-provider-service-installation-manifest-v1", identityManifest]),
  };
  await writeFile(join(installRoot, "provider-service-installation-manifest-v1.json"), `${canonicalizeJcsSafeIntegerV1(manifestEnvelope)}\n`, { mode: 0o600 });
  await chown(join(installRoot, "provider-service-installation-manifest-v1.json"), 0, 0);
  const registryHistory = {
    installationIdentityGenerationId,
    bootstrapTrustBundle: fixture.bootstrapTrustBundle,
    rootMetadataHistory: fixture.rootMetadataHistory,
    registryManifestHistory: registry.history,
  };
  const trust = {
    canonicalTargetRoot: runtimeRoot,
    targetProfileId: TARGET_PROFILE_ID,
    targetFingerprintDigest: TARGET_FINGERPRINT_DIGEST,
    acceptanceHistory: [acceptance],
    currentAcceptance: {
      generationId: acceptance.generationId,
      contentDigest: acceptance.contentDigest,
      acceptanceOrdinal: 1,
      installationIdentityGenerationId,
    },
    registryHistory,
    grantKeyPath: paths.grantKeyPath,
    callerPrincipal: { uid: CALLER_UID, gid: CALLER_GID },
  };
  await installProviderProductionStrongClientTrustV1({
    canonicalInstallationRoot: installRoot,
    serviceConfig: config,
    servicePrivateKey,
    trust,
  });
  await writeFile(paths.fixturePath, `${canonicalizeJcsSafeIntegerV1({
    providerId: PROVIDER_ID,
    serviceUid: SERVICE_UID,
    serviceGid: SERVICE_GID,
    callerUid: CALLER_UID,
    callerGid: CALLER_GID,
    badCallerUid: BAD_CALLER_UID,
    badCallerGid: BAD_CALLER_GID,
    capabilityDigest: CAPABILITY_DIGEST,
    targetProfileId: TARGET_PROFILE_ID,
    targetFingerprintDigest: TARGET_FINGERPRINT_DIGEST,
    installationIdentityGenerationId,
    identityNonce: IDENTITY_NONCE,
    acceptance,
    acceptanceRequest,
    registryHistory,
    config,
    runtimeRoot,
    installRoot,
    authorityTmpRoot: paths.authorityTmpRoot,
    authKeyPath: config.payload.authKeyPath,
    grantKeyPath: paths.grantKeyPath,
    readinessPath: config.payload.readinessPath,
    servicePublicKey: config.publicKey,
    brokerSocketPath: join(runtimeRoot, "strong-mutation-broker-v1.sock"),
    runtimeSocketPath: config.payload.socketPath,
    gatewaySocketPath: providerProductionStrongClientGatewaySocketPathV1(installRoot),
  })}\n`, { mode: 0o644 });
  await chown(paths.fixturePath, 0, 0);
  authKey.fill(0);
  signingKey.fill(0);
  grantKey.fill(0);
  return { config, servicePrivateKey, acceptance, registryHistory };
}

async function readFixture(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function waitForPath(path, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await access(path);
      return;
    } catch {
      if (Date.now() >= deadline) throw new Error(`timed out waiting for ${path}`);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    }
  }
}

function dropTo(uid, gid) {
  if (process.geteuid?.() !== 0) throw new Error("role must start root");
  if (typeof process.setgroups !== "function" || typeof process.getgroups !== "function" ||
      typeof process.setgid !== "function" || typeof process.setuid !== "function") {
    throw new Error("Linux privilege-drop APIs unavailable");
  }
  process.setgroups([gid]);
  process.setgid(gid);
  process.setuid(uid);
  const groups = process.getgroups();
  if (process.geteuid() !== uid || process.getegid() !== gid || groups.includes(0) ||
      groups.some((value) => value !== gid)) throw new Error("privilege drop was not exact");
}

async function strictCryptoCapability() {
  const {
    attestProviderStrictEd25519CryptoHostV1,
    PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
    PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  } = await import("@understand-code/durable-object-provider-contracts/strict-ed25519-conformance");
  const {
    STRICT_ED25519_VERIFICATION_PROFILE_V1,
    validatePrimeSubgroupPoint,
    verifyRawEd25519,
  } = await import("@understand-code/durable-object-provider-contracts/strict-ed25519");
  const manifestPath = join(REPO_ROOT, "packages/durable-object-provider-contracts/provider/ed25519-strict-host-conformance-v1.json");
  const bytes = new Uint8Array(await readFile(manifestPath));
  return attestProviderStrictEd25519CryptoHostV1({
    host: { verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1, validatePrimeSubgroupPoint, verifyRawEd25519 },
    resourceHost: {
      readFixedSignedPackageResource(path, maximumBytes) {
        if (path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 || maximumBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1) {
          throw new Error("unexpected strict resource request");
        }
        return bytes.slice();
      },
    },
  });
}

async function authorityRole(fixturePath) {
  process.env.NODE_ENV = "test";
  const fixture = await readFixture(fixturePath);
  // Fedora's /tmp carries a security xattr that the native authority rightly
  // rejects; use the dedicated ext4 image for the explicit test seam.
  process.env.TMPDIR = fixture.authorityTmpRoot;
  const {
    createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
    provisionProviderAcceptanceAuthorityForTestInternalV1,
    openProviderAcceptanceAuthorityStoreForTestInternalV1,
    openProviderStrongMutationExecutionBrokerStoreForTestInternalV1,
    mintProviderStrongMutationTrustVerifierForTestInternalV1,
    registerProviderStrongMutationLinuxExt4ExecutionFenceTestCapabilityInternalV1,
  } = await import("../../durable-object-provider-authority/dist/test-seam-internal.js");
  const { ProviderStrongMutationBrokerServerInternalV1 } = await import("../../durable-object-provider-authority/dist/strong-mutation-broker-server-internal.js");
  // The native authority owns creation of the final root; pre-creating that
  // inode would correctly fail its create-only namespace bootstrap.
  const authorityRoot = join(fixture.authorityTmpRoot, "authority");
  const capability = createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(authorityRoot);
  let authorityAlreadyProvisioned = true;
  try {
    await access(authorityRoot);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    authorityAlreadyProvisioned = false;
  }
  if (!authorityAlreadyProvisioned) {
    await provisionProviderAcceptanceAuthorityForTestInternalV1(capability, {
      installationIdentityGenerationId: fixture.installationIdentityGenerationId,
      installationIdentityKey: IDENTITY_KEY,
    });
  }
  const acceptance = await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability);
  if (!authorityAlreadyProvisioned) {
    await acceptance.compareAppend(fixture.acceptanceRequest);
  }
  const strict = await strictCryptoCapability();
  const verifier = mintProviderStrongMutationTrustVerifierForTestInternalV1({
    strictCryptoCapability: strict,
    readEvidence: async () => ({
      bootstrapTrustBundle: fixture.registryHistory.bootstrapTrustBundle,
      rootMetadataHistory: fixture.registryHistory.rootMetadataHistory,
      registryManifestHistory: fixture.registryHistory.registryManifestHistory,
    }),
  });
  const fence = registerProviderStrongMutationLinuxExt4ExecutionFenceTestCapabilityInternalV1({
    profile: "linux_ext4_exact_object_dedicated_os_principal_v1",
    providerId: fixture.providerId,
    targetProfileId: fixture.targetProfileId,
    targetFingerprintDigest: fixture.targetFingerprintDigest,
    capabilityDigest: fixture.capabilityDigest,
    installationIdentityGenerationId: fixture.installationIdentityGenerationId,
    principal: {
      uid: fixture.serviceUid,
      gid: fixture.serviceGid,
      handoffPayloadDigest: fixture.config.payloadDigest,
    },
    revalidateExactObjectAuthority(input) {
      return input.request.authorityGrant.payload.providerId === fixture.providerId &&
        input.principalAttestation.providerId === fixture.providerId;
    },
  });
  const broker = await openProviderStrongMutationExecutionBrokerStoreForTestInternalV1(capability, verifier, fence);
  const server = new ProviderStrongMutationBrokerServerInternalV1({
    socketPath: fixture.brokerSocketPath,
    expectedRuntimeUid: fixture.serviceUid,
    expectedRuntimeGid: fixture.serviceGid,
    broker,
  });
  await server.start();
  await writeFile(join(dirname(fixturePath), "authority.ready"), "ready\n", { mode: 0o644 });
  const stopPath = join(dirname(fixturePath), "authority.stop");
  try {
    await waitForPath(stopPath, 24 * 60 * 60 * 1000);
  } finally {
    await server.close();
  }
}

async function runtimeRole(fixturePath) {
  const fixture = await readFixture(fixturePath);
  const { mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1 } = await import("@understand-code/durable-object-provider-contracts/provider-service-installation-identity-custody-internal");
  const serviceKey = privateKey(SERVICE_SEED);
  const identityCapability = await mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1({
    installationIdentityKey: IDENTITY_KEY,
    initializationNonce: fixture.identityNonce,
    installationIdentityGenerationId: fixture.installationIdentityGenerationId,
    keyCheckToken: fixture.config.payload.installationIdentityCustody.keyCheckToken,
  });
  const authKey = new Uint8Array(await readFile(fixture.authKeyPath));
  const verifier = createProviderRuntimeStrongMutationBrokerVerifierInternalV1({
    socketPath: fixture.brokerSocketPath,
    expectedAuthorityUid: 0,
    expectedAuthorityGid: 0,
    expectedSocketGid: fixture.serviceGid,
  });
  const server = new DurableObjectProviderRuntimeServerV1({
    rootPath: fixture.runtimeRoot,
    socketPath: fixture.runtimeSocketPath,
    providerId: fixture.providerId,
    authKey,
    authorizedCapabilityDigest: fixture.capabilityDigest,
    principalAttestation: {
      privateKey: serviceKey,
      handoffPayloadDigest: fixture.config.payloadDigest,
      publicKey: fixture.servicePublicKey,
    },
    acceptanceIdentityVerificationCapability: identityCapability,
    mutationPolicy: "acceptance_authority_session_required",
    strongMutationAuthorityVerifier: verifier,
  });
  // The runtime store is owned by the dedicated provider principal.  Drop
  // every supplementary/root group before opening or mutating that tree;
  // root authority is a separate process and never owns runtime state.
  dropTo(fixture.serviceUid, fixture.serviceGid);
  // Seed only the first process.  A restart recovers the already durable
  // journal and must not manufacture a new revision.
  await server.store.initialize();
  const state = server.store.inspectState();
  if (state.revision === 0) {
    const acceptance = fixture.acceptance;
    const pin = {
      locatorProfile: "provider_acceptance_state_v1",
      acceptanceOrdinal: 1,
      generationId: acceptance.generationId,
      contentDigest: acceptance.contentDigest,
    };
    await server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "0".repeat(31) + "1",
      phase: "final_strong_ready",
      artifacts: {
        finalStrongReadyAcceptance: {
          finalStrongReadyAcceptanceEnvelope: acceptance,
          finalStrongReadyAcceptancePin: pin,
        },
      },
    });
  }
  await server.start();
  const readyPath = join(fixture.runtimeRoot, ".runtime.ready");
  await writeFile(readyPath, "ready\n", { mode: 0o600 });
  const stopPath = join(fixture.runtimeRoot, ".runtime.stop");
  try {
    await waitForPath(stopPath, 24 * 60 * 60 * 1000);
  } finally {
    await server.close();
    authKey.fill(0);
  }
}

async function gatewayRole(fixturePath) {
  const fixture = await readFixture(fixturePath);
  const service = await startProviderProductionStrongObjectGatewayServiceV1({
    canonicalInstallationRoot: fixture.installRoot,
  });
  const readyPath = join(dirname(fixture.gatewaySocketPath), ".gateway.ready");
  await writeFile(readyPath, "ready\n", { mode: 0o600 });
  const stopPath = join(dirname(fixture.gatewaySocketPath), ".gateway.stop");
  try {
    await waitForPath(stopPath, 24 * 60 * 60 * 1000);
  } finally {
    await service.close();
  }
}

async function callerRole(fixturePath, bad = false) {
  const fixture = await readFixture(fixturePath);
  dropTo(bad ? fixture.badCallerUid : fixture.callerUid, bad ? fixture.badCallerGid : fixture.callerGid);
  if (!bad) {
    let keyDenied = false;
    try {
      await readFile(fixture.grantKeyPath);
    } catch (error) {
      keyDenied = error?.code === "EACCES" || error?.code === "EPERM";
    }
    if (!keyDenied) throw new Error("ordinary caller could read service grant key");
  }
  try {
    const client = await openProviderProductionStrongObjectClientV1({ canonicalInstallationRoot: fixture.installRoot });
    if (bad) throw new Error("foreign caller unexpectedly opened public gateway");
    const bytes = Buffer.from("step15-three-principal-ext4\n", "utf8");
    const contentDigest = digestBytes(bytes);
    const locator = { providerId: fixture.providerId, contentDigest };
    const writeResult = await client.writeExactObject({
      locator,
      logicalBytes: bytes.byteLength,
      bytes: `base64url:${bytes.toString("base64url")}`,
      operationNonce: "a".repeat(32),
    });
    const readResult = await client.readExactObject(locator);
    const ownerCanonicalValue = canonicalizeJcsSafeIntegerV1([
      "record-verification-full-input-v1",
      contentDigest,
    ]);
    const compareResult = await client.compareCommit({
      expectedRevision: 1,
      operationNonce: "b".repeat(32),
      phase: "final_strong_ready",
      artifacts: {
        finalStrongReadyAcceptance: {
          finalStrongReadyAcceptanceEnvelope: fixture.acceptance,
          finalStrongReadyAcceptancePin: {
            locatorProfile: "provider_acceptance_state_v1",
            acceptanceOrdinal: fixture.acceptance.payload.acceptanceOrdinal,
            generationId: fixture.acceptance.generationId,
            contentDigest: fixture.acceptance.contentDigest,
          },
        },
        object: locator,
        owner: await client.commitOwnerOnlyState(
          "record-verification-full-input-v1",
          ownerCanonicalValue,
        ),
      },
    });
    await client.close();
    process.stdout.write(`${JSON.stringify({ role: "caller", keyDenied: true, write: writeResult.resolution, read: readResult.verifiedContentDigest, compare: compareResult.resolution, revision: compareResult.state.revision })}\n`);
  } catch (error) {
    if (bad) {
      process.stdout.write(`${JSON.stringify({ role: "bad-caller", rejected: true })}\n`);
      return;
    }
    throw error;
  }
}

async function orchestrate() {
  if (process.platform !== "linux" || process.geteuid?.() !== 0) throw new Error("three-principal smoke requires Linux root");
  const ext4Mount = "/var/mnt/uc-step15-ext4-root";
  const fs = await statfs(ext4Mount, { bigint: true });
  if (fs.type !== 0xef53n) throw new Error("dedicated ext4 mount is unavailable");
  const work = await mkdtemp(join("/var/tmp", "uc-step15-three-principal-"));
  // The descriptor is intentionally public (root-owned 0644) so the ordinary
  // caller can discover the gateway; keep the enclosing test fixture
  // traversable while retaining 0700 on installation/runtime/key directories.
  await chmod(work, 0o755);
  const installRoot = join(work, "installation");
  const runtimeRoot = join(ext4Mount, `step15-three-principal-${process.pid}-${randomBytes(4).toString("hex")}`);
  const paths = {
    configPath: join(installRoot, "provider-service-config-v1.json"),
    grantKeyPath: join(runtimeRoot, "grant.pk8"),
    fixturePath: join(work, "fixture.json"),
    // Keep the native authority on the same real ext4 gate while retaining a
    // dedicated, empty parent that is disjoint from the runtime target root.
    authorityTmpRoot: join(ext4Mount, `step15-authority-tmp-${process.pid}-${randomBytes(4).toString("hex")}`),
  };
  const authorityReadyPath = join(work, "authority.ready");
  const authorityStopPath = join(work, "authority.stop");
  const runtimeReadyPath = join(runtimeRoot, ".runtime.ready");
  const runtimeStopPath = join(runtimeRoot, ".runtime.stop");
  const gatewaySocketPath = providerProductionStrongClientGatewaySocketPathV1(installRoot);
  const gatewayReadyPath = join(dirname(gatewaySocketPath), ".gateway.ready");
  const gatewayStopPath = join(dirname(gatewaySocketPath), ".gateway.stop");
  await mkdir(installRoot, { recursive: true, mode: 0o700 });
  await chmod(installRoot, 0o700);
  await mkdir(runtimeRoot, { recursive: true, mode: 0o700 });
  await chown(runtimeRoot, SERVICE_UID, SERVICE_GID);
  await chmod(runtimeRoot, 0o700);
  await mkdir(paths.authorityTmpRoot, { recursive: true, mode: 0o700 });
  await chmod(paths.authorityTmpRoot, 0o700);
  let authority;
  let runtime;
  let gateway;
  const start = (role, env = {}) => spawn(process.execPath, [SCRIPT_PATH, "--role", role, "--fixture", paths.fixturePath], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const collect = (child) => {
    let stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (code, signal) => { if (code !== 0 && signal !== "SIGTERM") process.stderr.write(stderr); });
    return { child, get stderr() { return stderr; } };
  };
  try {
    await makeFixture(work, installRoot, runtimeRoot, paths);
    authority = collect(start("authority", { NODE_ENV: "test" }));
    await waitForPath(authorityReadyPath);
    runtime = collect(start("runtime"));
    await waitForPath(runtimeReadyPath);
    gateway = collect(start("gateway"));
    await waitForPath(gatewayReadyPath);
    const caller = await new Promise((resolvePromise, rejectPromise) => {
      const child = collect(start("caller"));
      let out = "";
      child.child.stdout?.setEncoding("utf8");
      child.child.stdout?.on("data", (chunk) => { out += chunk; });
      child.child.once("error", rejectPromise);
      child.child.once("exit", (code) => code === 0
        ? resolvePromise(out.trim())
        : rejectPromise(new Error(`caller failed: ${code} ${child.stderr}`)));
    });
    const denied = await new Promise((resolvePromise) => {
      const child = collect(start("bad-caller"));
      child.child.once("exit", (code) => resolvePromise(code === 0));
    });
    await writeFile(gatewayStopPath, "stop\n");
    await new Promise((resolvePromise) => gateway.child.once("exit", resolvePromise));
    await writeFile(runtimeStopPath, "stop\n");
    await new Promise((resolvePromise) => runtime.child.once("exit", resolvePromise));
    await writeFile(authorityStopPath, "stop\n");
    await new Promise((resolvePromise) => authority.child.once("exit", resolvePromise));
    // Restart both production processes and replay the exact nonces.  The
    // caller process is fresh and still has no key custody.
    await Promise.all([
      rm(gatewayReadyPath, { force: true }),
      rm(gatewayStopPath, { force: true }),
      rm(runtimeReadyPath, { force: true }),
      rm(runtimeStopPath, { force: true }),
      rm(authorityReadyPath, { force: true }),
      rm(authorityStopPath, { force: true }),
    ]);
    authority = collect(start("authority", { NODE_ENV: "test" }));
    await waitForPath(authorityReadyPath);
    runtime = collect(start("runtime"));
    await waitForPath(runtimeReadyPath);
    gateway = collect(start("gateway"));
    await waitForPath(gatewayReadyPath);
    const replay = await new Promise((resolvePromise, rejectPromise) => {
      const child = collect(start("caller"));
      let out = "";
      child.child.stdout?.setEncoding("utf8");
      child.child.stdout?.on("data", (chunk) => { out += chunk; });
      child.child.once("exit", (code) => code === 0
        ? resolvePromise(out.trim())
        : rejectPromise(new Error(`replay caller failed: ${code} ${child.stderr}`)));
    });
    await writeFile(gatewayStopPath, "stop\n");
    await new Promise((resolvePromise) => gateway.child.once("exit", resolvePromise));
    await writeFile(runtimeStopPath, "stop\n");
    await new Promise((resolvePromise) => runtime.child.once("exit", resolvePromise));
    await writeFile(authorityStopPath, "stop\n");
    await new Promise((resolvePromise) => authority.child.once("exit", resolvePromise));
    process.stdout.write(`${JSON.stringify({ profile: "provider_production_strong_object_three_principal_linux_v1", status: "verified", ext4: true, caller: JSON.parse(caller), foreignCallerRejected: denied, restartReplay: JSON.parse(replay), authorityUid: 0, runtimeUid: SERVICE_UID, callerUid: CALLER_UID })}\n`);
  } finally {
    for (const child of [gateway?.child, runtime?.child, authority?.child]) {
      if (child && child.exitCode === null) child.kill("SIGTERM");
    }
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
    await rm(runtimeRoot, { recursive: true, force: true }).catch(() => undefined);
    await rm(paths.authorityTmpRoot, { recursive: true, force: true }).catch(() => undefined);
    await rm(`${installRoot}.provider-production-strong-client-v1.json`, { force: true }).catch(() => undefined);
  }
}

const role = process.argv[2];
if (role === "--role") {
  const selected = process.argv[3];
  const fixtureFlag = process.argv.indexOf("--fixture");
  const fixturePath = fixtureFlag >= 0 ? process.argv[fixtureFlag + 1] : undefined;
  if (typeof fixturePath !== "string") throw new Error("fixture path is required");
  if (selected === "authority") await authorityRole(fixturePath);
  else if (selected === "runtime") await runtimeRole(fixturePath);
  else if (selected === "gateway") await gatewayRole(fixturePath);
  else if (selected === "caller") await callerRole(fixturePath, false);
  else if (selected === "bad-caller") await callerRole(fixturePath, true);
  else throw new Error(`unknown role ${selected}`);
} else {
  await orchestrate();
}
