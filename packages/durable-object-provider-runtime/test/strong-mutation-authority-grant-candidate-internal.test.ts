import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  sign,
  type KeyObject,
} from "node:crypto";
import { readFileSync } from "node:fs";
import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  INSTALLATION_IDENTITY_GENERATION_DOMAIN_V1,
  INSTALLATION_IDENTITY_KEY_CHECK_DOMAIN_V1,
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
  type ProviderBootstrapTrustBundleV1,
  type ProviderRegistryManifestEnvelopeV1,
  type ProviderRegistryRootMetadataEnvelopeV1,
  type StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1,
  type StoreDurableObjectProviderRegistryEntryV1,
  type StoreDurableObjectProviderVerificationPublicKeyV1,
} from "@understand-code/durable-object-provider-contracts";
import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex32V1Schema,
  ProviderTargetProfileIdV1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1,
  deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1,
  deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1,
  parseProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1,
  type ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
  ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
  type ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-acceptance-candidate";
import {
  mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1,
} from "@understand-code/durable-object-provider-contracts/provider-service-installation-identity-custody-internal";
import {
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  attestProviderStrictEd25519CryptoHostV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "@understand-code/durable-object-provider-contracts/strict-ed25519-conformance";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "@understand-code/durable-object-provider-contracts/strict-ed25519";

import {
  PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_GENERATION_PROFILE_V1,
  PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_HEAD_PROFILE_V1,
  deriveProviderInstallationAcceptanceStoreSubstrateGenerationSetDigestV1,
  mintProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1,
} from "../src/installation-acceptance-store-substrate.js";
import {
  diagnoseProviderRuntimeStrongMutationAuthorityGrantCandidateInternalV1,
  mintProviderRuntimeStrongMutationAuthorityGrantCandidateResolverCapabilityInternalV1,
  type ProviderRuntimeStrongMutationAuthorityGrantCandidateResolverCapabilityInternalV1,
  type ProviderRuntimeStrongMutationAuthorityGrantCandidateContextInternalV1,
} from "../src/strong-mutation-authority-grant-candidate-internal.js";

interface RegistryFixtureV1 {
  readonly installationIdentityGenerationId:
    `installation-identity-generation:${string}`;
  readonly bootstrapTrustBundle: ProviderBootstrapTrustBundleV1;
  readonly rootMetadataHistory:
    readonly ProviderRegistryRootMetadataEnvelopeV1[];
  readonly registryManifestHistory:
    readonly ProviderRegistryManifestEnvelopeV1[];
  readonly deterministicSeeds: {
    readonly installationInitializationNonceHex: string;
    readonly rootHistoryDependencySeeds: {
      readonly compromiseRootSeedHex: string;
    };
  };
}

const registryFixture = JSON.parse(
  readFileSync(
    fileURLToPath(new URL(
      "../../durable-object-provider-contracts/fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json",
      import.meta.url,
    )),
    "utf8",
  ),
) as RegistryFixtureV1;
const strictManifestBytes = new Uint8Array(readFileSync(fileURLToPath(new URL(
  "../../durable-object-provider-contracts/provider/ed25519-strict-host-conformance-v1.json",
  import.meta.url,
))));

const PROVIDER_ID = "durable-object-provider:native-b" as const;
const NON_SELECTED_PROVIDER_ID = "durable-object-provider:native-a" as const;
const GRANT_USAGE = "strong_mutation_authority_grant" as const;
const INSTALLATION_IDENTITY_KEY = Uint8Array.from(
  { length: 32 },
  (_value, index) => index,
);
const INITIALIZATION_NONCE = LowerHex32V1Schema.parse(
  registryFixture.deterministicSeeds.installationInitializationNonceHex,
);
const INSTALLATION_IDENTITY = InstallationIdentityGenerationIdV1Schema.parse(
  `installation-identity-generation:${createHash("sha256")
    .update(canonicalizeJcsSafeIntegerV1([
      INSTALLATION_IDENTITY_GENERATION_DOMAIN_V1,
      { initializationNonce: INITIALIZATION_NONCE },
    ]))
    .digest("hex")
    .slice(0, 22)}`,
);
const digestV1 = (nibble: string) => ContentDigestV1Schema.parse(
  `sha256:${nibble.repeat(64)}`,
);
const TARGET_PROFILE_ID = ProviderTargetProfileIdV1Schema.parse(
  `provider-target-profile:${"a".repeat(64)}`,
);
const NON_SELECTED_TARGET_PROFILE_ID = ProviderTargetProfileIdV1Schema.parse(
  `provider-target-profile:${"b".repeat(64)}`,
);
const TARGET_FINGERPRINT_DIGEST = digestV1("c");

let strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
let temporaryRoots: string[] = [];

function cloneV1<T>(value: T): T {
  return structuredClone(value);
}

function compareUtf8V1(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function rootPrivateKeyV1(): KeyObject {
  const seed = Buffer.from(
    registryFixture.deterministicSeeds.rootHistoryDependencySeeds
      .compromiseRootSeedHex,
    "hex",
  );
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      seed,
    ]),
    format: "der",
    type: "pkcs8",
  });
}

function rootKeyIdV1(): string {
  const root = registryFixture.rootMetadataHistory.at(-1);
  if (root === undefined) throw new TypeError("current Registry root absent");
  return root.rootKeyId;
}

function rootSignatureV1(
  prefix: "provider-registry-ed25519" | "provider-registry-manifest-ed25519",
  message: Uint8Array,
): string {
  return `${prefix}:${rootKeyIdV1()}:${sign(
    null,
    Buffer.from(message),
    rootPrivateKeyV1(),
  ).toString("hex")}`;
}

function grantPrivateKeyV1(seedOctet: number): KeyObject {
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.alloc(32, seedOctet),
    ]),
    format: "der",
    type: "pkcs8",
  });
}

function rawPublicKeyBytesV1(privateKey: KeyObject): `base64url:${string}` {
  const spki = Buffer.from(
    createPublicKey(privateKey).export({ format: "der", type: "spki" }),
  );
  return `base64url:${spki.subarray(-32).toString("base64url")}`;
}

function publicKeyDigestV1(publicKeyBytes: `base64url:${string}`): string {
  return `sha256:${createHash("sha256")
    .update(Buffer.from(publicKeyBytes.slice("base64url:".length), "base64url"))
    .digest("hex")}`;
}

function createGrantKeyRecordV1(
  registryGenerationIntroduced: number,
  seedOctet: number,
): StoreDurableObjectProviderVerificationPublicKeyV1 {
  const publicKeyBytes = rawPublicKeyBytesV1(grantPrivateKeyV1(seedOctet));
  const unsignedClaims = {
    profile: "store_durable_object_provider_verification_public_key_v1",
    providerId: PROVIDER_ID,
    registryGenerationIntroduced,
    keyId: deriveStoreProviderVerificationKeyIdV1({
      providerId: PROVIDER_ID,
      usage: GRANT_USAGE,
      publicKeyBytes,
    }),
    usage: GRANT_USAGE,
    algorithm: "ed25519",
    publicKeyBytes,
    publicKeyDigest: publicKeyDigestV1(publicKeyBytes),
  } as const;
  return StoreDurableObjectProviderVerificationPublicKeyV1Schema.parse({
    ...unsignedClaims,
    registrySignature: rootSignatureV1(
      "provider-registry-ed25519",
      createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1(
        unsignedClaims,
        rootKeyIdV1(),
      ),
    ),
  });
}

function sortVerificationRecordsV1(
  records: StoreDurableObjectProviderVerificationPublicKeyV1[],
): void {
  records.sort((left, right) => {
    const providerOrder = compareUtf8V1(left.providerId, right.providerId);
    if (providerOrder !== 0) return providerOrder;
    const usageOrder = compareUtf8V1(left.usage, right.usage);
    return usageOrder !== 0
      ? usageOrder
      : compareUtf8V1(left.keyId, right.keyId);
  });
}

function currentEntryV1(
  history: readonly ProviderRegistryManifestEnvelopeV1[],
): StoreDurableObjectProviderRegistryEntryV1 {
  const member = history.at(-1)?.payload.members.find(
    (candidate) =>
      candidate.providerId === PROVIDER_ID &&
      candidate.disposition === "enabled",
  );
  if (member === undefined || member.disposition !== "enabled") {
    throw new TypeError("current enabled Registry entry absent");
  }
  return cloneV1(member.registryEntry);
}

function createEntrySuccessorV1(
  previous: StoreDurableObjectProviderRegistryEntryV1,
  mutate: (
    entry: StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1,
  ) => void,
): StoreDurableObjectProviderRegistryEntryV1 {
  const { registrySignature: _signature, ...previousUnsigned } = previous;
  const candidate = cloneV1({
    ...previousUnsigned,
    registryGeneration: previous.registryGeneration + 1,
    predecessorRegistryEntryContentDigest:
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(previous),
  });
  mutate(candidate as StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1);
  const unsigned =
    StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1Schema.parse(
      candidate,
    );
  return StoreDurableObjectProviderRegistryEntryV1Schema.parse({
    ...unsigned,
    registrySignature: rootSignatureV1(
      "provider-registry-ed25519",
      createStoreDurableObjectProviderRegistryEntrySignatureMessageV1(
        unsigned,
        rootKeyIdV1(),
      ),
    ),
  });
}

function appendManifestV1(
  input: readonly ProviderRegistryManifestEnvelopeV1[],
  entry: StoreDurableObjectProviderRegistryEntryV1,
  issuedAt: string,
): readonly ProviderRegistryManifestEnvelopeV1[] {
  const history = cloneV1(input);
  const previous = history.at(-1);
  if (previous === undefined) throw new TypeError("Registry history absent");
  const members = previous.payload.members.map((member) =>
    member.providerId === PROVIDER_ID && member.disposition === "enabled"
      ? {
          ...member,
          registryEntryContentDigest:
            deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
              entry,
            ),
          registryEntry: entry,
        }
      : member
  );
  const idFields = {
    installationIdentityGenerationId:
      previous.payload.installationIdentityGenerationId,
    activeRootMetadata: previous.payload.activeRootMetadata,
    manifestGeneration: previous.payload.manifestGeneration + 1,
    predecessor: {
      state: "manifest" as const,
      generationId: previous.generationId,
      contentDigest: previous.contentDigest,
    },
    members,
    routing: previous.payload.routing,
  };
  const generationId = deriveProviderRegistryManifestGenerationIdV1(idFields);
  const unsigned = {
    profile: "provider_registry_manifest_v1" as const,
    generationId,
    ...idFields,
    issuedAt,
  };
  const payload = ProviderRegistryManifestV1Schema.parse({
    ...unsigned,
    manifestSignature: rootSignatureV1(
      "provider-registry-manifest-ed25519",
      createProviderRegistryManifestSignatureMessageV1(
        unsigned,
        rootKeyIdV1(),
      ),
    ),
  });
  const envelope = ProviderRegistryManifestEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_registry_manifest",
    generationId,
    contentDigest: deriveProviderRegistryManifestContentDigestV1(payload),
    payload,
  });
  return [...history, envelope];
}

function addGrantKeyV1(
  entry: StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1,
  seedOctet: number,
): StoreDurableObjectProviderVerificationPublicKeyV1 {
  const record = createGrantKeyRecordV1(entry.registryGeneration, seedOctet);
  entry.verificationKeys.publicKeyRecords.push(record);
  sortVerificationRecordsV1(entry.verificationKeys.publicKeyRecords);
  entry.verificationKeys.activeKeyIds.strongMutationAuthorityGrant =
    record.keyId;
  return record;
}

interface GrantRegistryHistoryV1 {
  readonly history: readonly ProviderRegistryManifestEnvelopeV1[];
  readonly initialKey: StoreDurableObjectProviderVerificationPublicKeyV1;
  readonly activeKey: StoreDurableObjectProviderVerificationPublicKeyV1;
  readonly activeSeed: number;
}

function grantRegistryHistoryV1(
  state: "initial" | "rotated" | "revoked",
): GrantRegistryHistoryV1 {
  const legacy = cloneV1(registryFixture.registryManifestHistory);
  let initialKey!: StoreDurableObjectProviderVerificationPublicKeyV1;
  const initialEntry = createEntrySuccessorV1(
    currentEntryV1(legacy),
    (entry) => {
      initialKey = addGrantKeyV1(entry, 0x41);
    },
  );
  const initialHistory = appendManifestV1(
    legacy,
    initialEntry,
    "2026-08-19T00:00:00Z",
  );
  if (state === "initial") {
    return {
      history: initialHistory,
      initialKey,
      activeKey: initialKey,
      activeSeed: 0x41,
    };
  }
  let rotatedKey!: StoreDurableObjectProviderVerificationPublicKeyV1;
  const rotatedEntry = createEntrySuccessorV1(initialEntry, (entry) => {
    rotatedKey = addGrantKeyV1(entry, 0x42);
  });
  const rotatedHistory = appendManifestV1(
    initialHistory,
    rotatedEntry,
    "2026-08-19T00:00:01Z",
  );
  if (state === "rotated") {
    return {
      history: rotatedHistory,
      initialKey,
      activeKey: rotatedKey,
      activeSeed: 0x42,
    };
  }
  const revokedEntry = createEntrySuccessorV1(rotatedEntry, (entry) => {
    delete entry.verificationKeys.activeKeyIds.strongMutationAuthorityGrant;
    entry.verificationKeys.compromisedRevokedKeyIds.push(rotatedKey.keyId);
    entry.verificationKeys.compromisedRevokedKeyIds.sort(compareUtf8V1);
  });
  return {
    history: appendManifestV1(
      rotatedHistory,
      revokedEntry,
      "2026-08-19T00:00:02Z",
    ),
    initialKey,
    activeKey: rotatedKey,
    activeSeed: 0x42,
  };
}

function registryPinV1(history: readonly ProviderRegistryManifestEnvelopeV1[]) {
  const current = history.at(-1);
  if (current === undefined) throw new TypeError("Registry history absent");
  return {
    locatorProfile: "installation_provider_registry_manifest_v1" as const,
    manifestGeneration: current.payload.manifestGeneration,
    generationId: current.generationId,
    contentDigest: current.contentDigest,
  };
}

function keyedTokenV1(domain: string, fields: object): string {
  return `hmac-sha256:${createHmac("sha256", INSTALLATION_IDENTITY_KEY)
    .update(canonicalizeJcsSafeIntegerV1([domain, fields]))
    .digest("hex")}`;
}

function acceptanceEnvelopeV1(
  history: readonly ProviderRegistryManifestEnvelopeV1[],
  selectorProviderId: string = PROVIDER_ID,
  selectorEntryContentDigest?: ReturnType<typeof digestV1>,
): ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1 {
  const current = history.at(-1);
  const member = current?.payload.members.find(
    (candidate) =>
      candidate.providerId === PROVIDER_ID &&
      candidate.disposition === "enabled",
  );
  if (
    current === undefined ||
    member === undefined ||
    member.disposition !== "enabled"
  ) throw new TypeError("current Registry member absent");
  const entry = member.registryEntry;
  const configuration = {
    state: "strong_ready" as const,
    core: {
      activeRootMetadata: current.payload.activeRootMetadata,
      providerRegistryManifest: registryPinV1(history),
      providerSupportCatalog: {
        locatorProfile:
          "distribution_provider_feasibility_support_catalog_v1" as const,
        catalogGeneration: 1,
        contentDigest: digestV1("9"),
      },
      activeWriterSelector: {
        profile: "provider_active_writer_selector_v1" as const,
        selections: [{
          targetProfileId: TARGET_PROFILE_ID,
          providerId: selectorProviderId,
          registryEntryContentDigest:
            selectorEntryContentDigest ?? member.registryEntryContentDigest,
          semanticProviderPolicyDigest: entry.semanticProviderPolicyDigest,
          providerFeasibilityEvidence: entry.providerFeasibilityEvidence,
          runtimeAttestationContentDigest:
            entry.runtimeAttestation.contentDigest,
          bindingDerivationKeyGeneration:
            entry.verificationKeys.activeBindingDerivationKeyGeneration,
        }],
      },
    },
    activation: { origin: "bootstrap_or_steady_successor" as const },
  };
  const generationId = deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
    installationIdentityGenerationId: INSTALLATION_IDENTITY,
    acceptanceOrdinal: 1,
    predecessor: { state: "genesis" },
    configuration,
  });
  const unsigned = {
    profile: "provider_acceptance_state_v1" as const,
    generationId,
    installationIdentityGenerationId: INSTALLATION_IDENTITY,
    acceptanceOrdinal: 1,
    predecessor: { state: "genesis" as const },
    configuration,
    acceptedAt: "2026-08-19T00:01:00Z",
  };
  const payload = {
    ...unsigned,
    acceptanceToken: KeyedStateTokenV1Schema.parse(
      keyedTokenV1(PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1, unsigned),
    ),
  };
  return ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_acceptance_state",
    generationId,
    installationIdentityGenerationId: INSTALLATION_IDENTITY,
    acceptedAt: payload.acceptedAt,
    contentDigest:
      deriveProviderStrongReadyAcceptanceStateContentDigestV1(payload),
    payload,
  });
}

async function acceptanceReaderV1(
  envelope: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
) {
  const authorityRoot = await realpath(await mkdtemp(
    join(tmpdir(), "understand-code-grant-candidate-"),
  ));
  temporaryRoots.push(authorityRoot);
  const generationsRoot = join(authorityRoot, "generations");
  await mkdir(generationsRoot, { mode: 0o700 });
  await chmod(authorityRoot, 0o700);
  const generationRecord = {
    schemaVersion: 1,
    profile:
      PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_GENERATION_PROFILE_V1,
    installationIdentityGenerationId: INSTALLATION_IDENTITY,
    envelope,
  };
  const generationPath = join(generationsRoot, "0000000000000001.json");
  await writeFile(
    generationPath,
    `${canonicalizeJcsSafeIntegerV1(generationRecord)}\n`,
    { mode: 0o600 },
  );
  await chmod(generationPath, 0o400);
  const enumeration = [{
    acceptanceOrdinal: 1,
    generationId: envelope.generationId,
    contentDigest: envelope.contentDigest,
    predecessor: envelope.payload.predecessor,
  }];
  const currentAcceptance =
    ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema.parse({
      locatorProfile: "installation_provider_acceptance_state_v1",
      acceptanceOrdinal: 1,
      generationId: envelope.generationId,
      contentDigest: envelope.contentDigest,
    });
  await writeFile(
    join(authorityRoot, "current.json"),
    `${canonicalizeJcsSafeIntegerV1({
      schemaVersion: 1,
      profile:
        PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_HEAD_PROFILE_V1,
      installationIdentityGenerationId: INSTALLATION_IDENTITY,
      highWaterRevision: 1,
      generationCount: 1,
      generationSetDigest:
        deriveProviderInstallationAcceptanceStoreSubstrateGenerationSetDigestV1(
          INSTALLATION_IDENTITY,
          enumeration,
        ),
      currentAcceptance,
    })}\n`,
    { mode: 0o600 },
  );
  const identityVerificationCapability =
    await mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1({
      installationIdentityKey: INSTALLATION_IDENTITY_KEY.slice(),
      initializationNonce: INITIALIZATION_NONCE,
      installationIdentityGenerationId: INSTALLATION_IDENTITY,
      keyCheckToken: KeyedStateTokenV1Schema.parse(keyedTokenV1(
        INSTALLATION_IDENTITY_KEY_CHECK_DOMAIN_V1,
        {
          generationId: INSTALLATION_IDENTITY,
          initializationNonce: INITIALIZATION_NONCE,
        },
      )),
    });
  return mintProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1({
    authorityRoot,
    expectedAuthorityUid: process.getuid!(),
    expectedAuthorityGid: process.getgid!(),
    identityVerificationCapability,
  });
}

function acceptanceIdentityV1(
  envelope: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
) {
  return {
    generationId: envelope.generationId,
    contentDigest: envelope.contentDigest,
    acceptanceOrdinal: envelope.payload.acceptanceOrdinal,
    installationIdentityGenerationId:
      envelope.installationIdentityGenerationId,
  };
}

function grantEnvelopeV1(input: {
  readonly history: readonly ProviderRegistryManifestEnvelopeV1[];
  readonly acceptanceEnvelope:
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1;
  readonly signerKey: StoreDurableObjectProviderVerificationPublicKeyV1;
  readonly signerSeed: number;
  readonly targetProfileId?: typeof TARGET_PROFILE_ID;
  readonly targetFingerprintDigest?: ReturnType<typeof digestV1>;
}): ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1 {
  const fields = {
    signerKeyId: input.signerKey.keyId,
    providerId: PROVIDER_ID,
    targetProfileId: input.targetProfileId ?? TARGET_PROFILE_ID,
    targetFingerprintDigest:
      input.targetFingerprintDigest ?? TARGET_FINGERPRINT_DIGEST,
    registryManifest: registryPinV1(input.history),
    acceptanceIdentity: acceptanceIdentityV1(input.acceptanceEnvelope),
    capabilityDigest: digestV1("1"),
    principalAttestationDigest: digestV1("2"),
    journalHead: {
      revision: 7,
      phase: "final_strong_ready",
      mutationDigest: digestV1("3"),
    },
    operation: "write_object" as const,
    operationNonce: "4".repeat(32),
    requestDigest: digestV1("5"),
  };
  const grantId =
    deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1(fields);
  const unsigned = {
    profile: "provider_runtime_ipc_strong_mutation_authority_grant_v1" as const,
    grantId,
    ...fields,
  };
  const payload = {
    ...unsigned,
    signature: `base64url:${sign(
      null,
      Buffer.from(
        createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1(
          unsigned,
        ),
      ),
      grantPrivateKeyV1(input.signerSeed),
    ).toString("base64url")}`,
  };
  return parseProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1({
    schemaVersion: 1,
    recordType: "provider_runtime_ipc_strong_mutation_authority_grant",
    grantId,
    contentDigest:
      deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1(
        payload,
      ),
    payload,
  });
}

function contextV1(
  grant: ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1,
): ProviderRuntimeStrongMutationAuthorityGrantCandidateContextInternalV1 {
  return {
    providerId: grant.payload.providerId,
    targetProfileId: grant.payload.targetProfileId,
    targetFingerprintDigest: grant.payload.targetFingerprintDigest,
    capabilityDigest: grant.payload.capabilityDigest,
    principalAttestationDigest: grant.payload.principalAttestationDigest,
    operation: grant.payload.operation,
    operationNonce: grant.payload.operationNonce,
    requestDigest: grant.payload.requestDigest,
    journalHead: grant.payload.journalHead,
    acceptanceIdentity: grant.payload.acceptanceIdentity,
    authorityGrant: grant,
  };
}

async function candidateFixtureV1(
  state: "initial" | "rotated" | "revoked",
  selectorProviderId: string = PROVIDER_ID,
  selectorEntryContentDigest?: ReturnType<typeof digestV1>,
) {
  const registry = grantRegistryHistoryV1(state);
  const acceptanceEnvelope = acceptanceEnvelopeV1(
    registry.history,
    selectorProviderId,
    selectorEntryContentDigest,
  );
  const acceptanceReaderCapability =
    await acceptanceReaderV1(acceptanceEnvelope);
  const evidence = {
    acceptanceEnvelope,
    registryHistory: {
      installationIdentityGenerationId: INSTALLATION_IDENTITY,
      bootstrapTrustBundle: registryFixture.bootstrapTrustBundle,
      rootMetadataHistory: registryFixture.rootMetadataHistory,
      registryManifestHistory: registry.history,
    },
  };
  const resolver =
    mintProviderRuntimeStrongMutationAuthorityGrantCandidateResolverCapabilityInternalV1({
      acceptanceReaderCapability,
      strictCryptoCapability,
      readUntrustedEvidence: () => evidence,
    });
  return {
    registry,
    acceptanceEnvelope,
    acceptanceReaderCapability,
    evidence,
    resolver,
  };
}

function tamperSignatureV1(
  grant: ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1,
): ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1 {
  const signature = Buffer.from(
    grant.payload.signature.slice("base64url:".length),
    "base64url",
  );
  signature[0] = signature[0]! ^ 0x01;
  const payload = {
    ...grant.payload,
    signature: `base64url:${signature.toString("base64url")}`,
  };
  return parseProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1({
    ...grant,
    contentDigest:
      deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1(
        payload,
      ),
    payload,
  });
}

beforeAll(async () => {
  expect(INSTALLATION_IDENTITY).toBe(
    registryFixture.installationIdentityGenerationId,
  );
  strictCryptoCapability = await attestProviderStrictEd25519CryptoHostV1({
    host: {
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint,
      verifyRawEd25519,
    },
    resourceHost: {
      readFixedSignedPackageResource(path, maxBytes) {
        expect(path).toBe(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1);
        expect(maxBytes).toBe(PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1);
        return strictManifestBytes.slice();
      },
    },
  });
});

afterEach(async () => {
  const roots = temporaryRoots;
  temporaryRoots = [];
  await Promise.all(roots.map((root) => rm(root, {
    recursive: true,
    force: true,
  })));
});

describe.skipIf(
  process.getuid === undefined || process.getgid === undefined,
)("strong-mutation authority grant locked candidate", () => {
  it("strictly verifies the active Acceptance-pinned Registry key but remains locked", async () => {
    const fixture = await candidateFixtureV1("initial");
    const grant = grantEnvelopeV1({
      history: fixture.registry.history,
      acceptanceEnvelope: fixture.acceptanceEnvelope,
      signerKey: fixture.registry.activeKey,
      signerSeed: fixture.registry.activeSeed,
    });

    await expect(
      diagnoseProviderRuntimeStrongMutationAuthorityGrantCandidateInternalV1(
        fixture.resolver,
        contextV1(grant),
      ),
    ).resolves.toEqual({
      ok: true,
      value: {
        status:
          "provider_runtime_strong_mutation_authority_grant_candidate",
        authority: "none",
        accessMode: "read_only",
        strongWriteStatus: "locked",
        cryptographicGrantStatus:
          "strict_ed25519_signature_and_exact_claims_verified",
        currentBinding:
          "process_observed_acceptance_and_acceptance_pinned_registry",
        crossRestartRollbackResistance: "not_established",
        replayStatus: "not_consumed",
        grantId: grant.grantId,
        requiredNext:
          "root_os_production_current_authority_and_durable_replay_consume",
      },
    });
  });

  it("rejects a rotated signer and a revoked-to-locked Registry", async () => {
    const rotated = await candidateFixtureV1("rotated");
    const oldGrant = grantEnvelopeV1({
      history: rotated.registry.history,
      acceptanceEnvelope: rotated.acceptanceEnvelope,
      signerKey: rotated.registry.initialKey,
      signerSeed: 0x41,
    });
    await expect(
      diagnoseProviderRuntimeStrongMutationAuthorityGrantCandidateInternalV1(
        rotated.resolver,
        contextV1(oldGrant),
      ),
    ).resolves.toMatchObject({ ok: false, stage: "active_grant_key" });

    const revoked = await candidateFixtureV1("revoked");
    const revokedGrant = grantEnvelopeV1({
      history: revoked.registry.history,
      acceptanceEnvelope: revoked.acceptanceEnvelope,
      signerKey: revoked.registry.activeKey,
      signerSeed: revoked.registry.activeSeed,
    });
    await expect(
      diagnoseProviderRuntimeStrongMutationAuthorityGrantCandidateInternalV1(
        revoked.resolver,
        contextV1(revokedGrant),
      ),
    ).resolves.toMatchObject({ ok: false, stage: "active_grant_key" });
  });

  it("rejects a server-derived binding mismatch and a real signature failure", async () => {
    const fixture = await candidateFixtureV1("initial");
    const grant = grantEnvelopeV1({
      history: fixture.registry.history,
      acceptanceEnvelope: fixture.acceptanceEnvelope,
      signerKey: fixture.registry.activeKey,
      signerSeed: fixture.registry.activeSeed,
    });
    await expect(
      diagnoseProviderRuntimeStrongMutationAuthorityGrantCandidateInternalV1(
        fixture.resolver,
        {
          ...contextV1(grant),
          requestDigest: digestV1("f"),
        },
      ),
    ).resolves.toMatchObject({ ok: false, stage: "server_binding" });

    await expect(
      diagnoseProviderRuntimeStrongMutationAuthorityGrantCandidateInternalV1(
        fixture.resolver,
        {
          ...contextV1(grant),
          targetFingerprintDigest: digestV1("d"),
        },
      ),
    ).resolves.toMatchObject({ ok: false, stage: "server_binding" });

    const tampered = tamperSignatureV1(grant);
    await expect(
      diagnoseProviderRuntimeStrongMutationAuthorityGrantCandidateInternalV1(
        fixture.resolver,
        contextV1(tampered),
      ),
    ).resolves.toMatchObject({ ok: false, stage: "grant_signature" });
  });

  it("rejects a target, provider, or entry digest outside the exact active-writer selection", async () => {
    const targetFixture = await candidateFixtureV1("initial");
    const wrongTargetGrant = grantEnvelopeV1({
      history: targetFixture.registry.history,
      acceptanceEnvelope: targetFixture.acceptanceEnvelope,
      signerKey: targetFixture.registry.activeKey,
      signerSeed: targetFixture.registry.activeSeed,
      targetProfileId: NON_SELECTED_TARGET_PROFILE_ID,
    });
    await expect(
      diagnoseProviderRuntimeStrongMutationAuthorityGrantCandidateInternalV1(
        targetFixture.resolver,
        contextV1(wrongTargetGrant),
      ),
    ).resolves.toMatchObject({
      ok: false,
      stage: "active_writer_selection",
    });

    const providerFixture = await candidateFixtureV1(
      "initial",
      NON_SELECTED_PROVIDER_ID,
    );
    const wrongProviderGrant = grantEnvelopeV1({
      history: providerFixture.registry.history,
      acceptanceEnvelope: providerFixture.acceptanceEnvelope,
      signerKey: providerFixture.registry.activeKey,
      signerSeed: providerFixture.registry.activeSeed,
    });
    await expect(
      diagnoseProviderRuntimeStrongMutationAuthorityGrantCandidateInternalV1(
        providerFixture.resolver,
        contextV1(wrongProviderGrant),
      ),
    ).resolves.toMatchObject({
      ok: false,
      stage: "active_writer_selection",
    });

    const digestFixture = await candidateFixtureV1(
      "initial",
      PROVIDER_ID,
      digestV1("e"),
    );
    const wrongEntryDigestGrant = grantEnvelopeV1({
      history: digestFixture.registry.history,
      acceptanceEnvelope: digestFixture.acceptanceEnvelope,
      signerKey: digestFixture.registry.activeKey,
      signerSeed: digestFixture.registry.activeSeed,
    });
    await expect(
      diagnoseProviderRuntimeStrongMutationAuthorityGrantCandidateInternalV1(
        digestFixture.resolver,
        contextV1(wrongEntryDigestGrant),
      ),
    ).resolves.toMatchObject({
      ok: false,
      stage: "active_writer_selection",
    });
  });

  it("keeps the candidate resolver outside every public runtime boundary", () => {
    const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL(
      "../package.json",
      import.meta.url,
    )), "utf8")) as { readonly exports: Record<string, unknown> };
    const indexSource = readFileSync(fileURLToPath(new URL(
      "../src/index.ts",
      import.meta.url,
    )), "utf8");
    expect(
      packageJson.exports["./strong-mutation-authority-grant-candidate-internal"],
    ).toBeUndefined();
    expect(indexSource).not.toContain(
      "strong-mutation-authority-grant-candidate-internal",
    );
  });

  it("snapshots untrusted Registry evidence without invoking accessors", async () => {
    const fixture = await candidateFixtureV1("initial");
    const grant = grantEnvelopeV1({
      history: fixture.registry.history,
      acceptanceEnvelope: fixture.acceptanceEnvelope,
      signerKey: fixture.registry.activeKey,
      signerSeed: fixture.registry.activeSeed,
    });
    let getterCalls = 0;
    const hostileBootstrap = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostileBootstrap, "schemaVersion", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 1;
      },
    });
    const resolver =
      mintProviderRuntimeStrongMutationAuthorityGrantCandidateResolverCapabilityInternalV1({
        acceptanceReaderCapability: fixture.acceptanceReaderCapability,
        strictCryptoCapability,
        readUntrustedEvidence: () => ({
          ...fixture.evidence,
          registryHistory: {
            ...fixture.evidence.registryHistory,
            bootstrapTrustBundle: hostileBootstrap,
          },
        }),
      });

    await expect(
      diagnoseProviderRuntimeStrongMutationAuthorityGrantCandidateInternalV1(
        resolver,
        contextV1(grant),
      ),
    ).resolves.toMatchObject({ ok: false, stage: "evidence" });
    expect(getterCalls).toBe(0);
  });

  it("rejects a structurally compatible resolver handle", async () => {
    const fixture = await candidateFixtureV1("initial");
    const grant = grantEnvelopeV1({
      history: fixture.registry.history,
      acceptanceEnvelope: fixture.acceptanceEnvelope,
      signerKey: fixture.registry.activeKey,
      signerSeed: fixture.registry.activeSeed,
    });
    const forged = Object.freeze(Object.create(null)) as
      ProviderRuntimeStrongMutationAuthorityGrantCandidateResolverCapabilityInternalV1;
    await expect(
      diagnoseProviderRuntimeStrongMutationAuthorityGrantCandidateInternalV1(
        forged,
        contextV1(grant),
      ),
    ).resolves.toEqual({
      ok: false,
      code: "provider_unavailable",
      reason: "attestation_invalid",
      stage: "resolver_capability",
    });
  });
});
