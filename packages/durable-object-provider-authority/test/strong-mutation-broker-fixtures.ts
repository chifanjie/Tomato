import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  type KeyObject,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
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

import { canonicalizeJcsSafeIntegerUtf8V1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
  PROVIDER_RUNTIME_IPC_STRONG_MUTATION_REQUEST_DOMAIN_V1,
  PROVIDER_RUNTIME_IPC_STRONG_MUTATION_SESSION_BINDING_DOMAIN_V1,
  ProviderRuntimeIpcPrincipalAttestationClaimsV1Schema,
  ProviderRuntimeIpcPrincipalAttestationV1Schema,
  ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema,
  ProviderRuntimeIpcStrongMutationRequestV1Schema,
  ProviderRuntimeIpcStrongMutationResponseV1Schema,
  canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1,
  canonicalizeProviderRuntimeIpcPrincipalAttestationTranscriptV1,
  canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1,
  createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1,
  deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1,
  deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1,
  type ProviderRuntimeIpcAcceptanceIdentityProofV1,
  type ProviderRuntimeIpcPrincipalAttestationV1,
  type ProviderRuntimeIpcStrongMutationRequestV1,
  type ProviderRuntimeIpcStrongMutationResponseV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  ProviderAcceptedConfigurationV1Schema,
  type ProviderAcceptanceCurrentReadV1,
  type ProviderAcceptedConfigurationV1,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import {
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  attestProviderStrictEd25519CryptoHostV1,
} from "@understand-code/durable-object-provider-contracts/strict-ed25519-conformance";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "@understand-code/durable-object-provider-contracts/strict-ed25519";

import {
  mintProviderStrongMutationTrustVerifierForTestInternalV1,
  type MintProviderStrongMutationTrustVerifierCapabilityInternalV1Input,
  type ProviderStrongMutationTrustVerifierCapabilityInternalV1,
} from "../src/test-seam-internal.js";

export const TEST_BROKER_PROVIDER_ID =
  "durable-object-provider:native-b" as const;

const TEST_BROKER_TARGET_PROFILE_ID =
  `provider-target-profile:${"a".repeat(64)}` as const;
const TEST_BROKER_TARGET_FINGERPRINT_DIGEST =
  `sha256:${"c".repeat(64)}` as const;
const TEST_BROKER_CAPABILITY_DIGEST = `sha256:${"1".repeat(64)}` as const;
const TEST_BROKER_HANDOFF_PAYLOAD_DIGEST =
  `sha256:${"8".repeat(64)}` as const;
const TEST_BROKER_GRANT_USAGE =
  "strong_mutation_authority_grant" as const;
const TEST_BROKER_GRANT_SEED = 0x41;
const TEST_BROKER_PRINCIPAL_SEED = 0x51;
const TEST_BROKER_JOURNAL_HEAD = Object.freeze({
  revision: 0,
  phase: "ready",
  mutationDigest: "none" as const,
});

interface RegistryFixtureV1 {
  readonly installationIdentityGenerationId: string;
  readonly bootstrapTrustBundle: ProviderBootstrapTrustBundleV1;
  readonly rootMetadataHistory:
    readonly ProviderRegistryRootMetadataEnvelopeV1[];
  readonly registryManifestHistory:
    readonly ProviderRegistryManifestEnvelopeV1[];
  readonly deterministicSeeds: {
    readonly rootHistoryDependencySeeds: {
      readonly compromiseRootSeedHex: string;
    };
  };
}

const registryFixtureV1 = JSON.parse(
  readFileSync(
    fileURLToPath(new URL(
      "../../durable-object-provider-contracts/fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json",
      import.meta.url,
    )),
    "utf8",
  ),
) as RegistryFixtureV1;
export const TEST_BROKER_INSTALLATION_IDENTITY_GENERATION_ID =
  InstallationIdentityGenerationIdV1Schema.parse(
    registryFixtureV1.installationIdentityGenerationId,
  );
const strictManifestBytesV1 = new Uint8Array(readFileSync(fileURLToPath(new URL(
  "../../durable-object-provider-contracts/provider/ed25519-strict-host-conformance-v1.json",
  import.meta.url,
))));

let strictCryptoCapabilityPromiseV1: ReturnType<
  typeof attestProviderStrictEd25519CryptoHostV1
> | undefined;

function strictCryptoCapabilityV1() {
  strictCryptoCapabilityPromiseV1 ??=
    attestProviderStrictEd25519CryptoHostV1({
      host: {
        verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
        validatePrimeSubgroupPoint,
        verifyRawEd25519,
      },
      resourceHost: {
        readFixedSignedPackageResource(path, maximumBytes) {
          if (
            path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
            maximumBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
          ) throw new TypeError("unexpected strict Ed25519 resource request");
          return strictManifestBytesV1.slice();
        },
      },
    });
  return strictCryptoCapabilityPromiseV1;
}

export async function strongMutationTrustVerifierV1(
  readEvidence: MintProviderStrongMutationTrustVerifierCapabilityInternalV1Input[
    "readEvidence"
  ] = (query) => strongMutationTrustEvidenceV1(query.acceptanceIdentity),
): Promise<ProviderStrongMutationTrustVerifierCapabilityInternalV1> {
  return mintProviderStrongMutationTrustVerifierForTestInternalV1({
    strictCryptoCapability: await strictCryptoCapabilityV1(),
    readEvidence,
  });
}

function cloneV1<T>(value: T): T {
  return structuredClone(value);
}

function compareUtf8V1(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function ed25519PrivateKeyV1(seedOctet: number): KeyObject {
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.alloc(32, seedOctet),
    ]),
    format: "der",
    type: "pkcs8",
  });
}

function rootPrivateKeyV1(): KeyObject {
  const seed = Buffer.from(
    registryFixtureV1.deterministicSeeds.rootHistoryDependencySeeds
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
  const root = registryFixtureV1.rootMetadataHistory.at(-1);
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

function rawPublicKeyBytesV1(privateKey: KeyObject): `base64url:${string}` {
  const spki = Buffer.from(
    createPublicKey(privateKey).export({ format: "der", type: "spki" }),
  );
  return `base64url:${spki.subarray(-32).toString("base64url")}`;
}

function publicKeyDigestV1(
  publicKeyBytes: `base64url:${string}`,
): `sha256:${string}` {
  return sha256OracleV1(
    Buffer.from(publicKeyBytes.slice("base64url:".length), "base64url"),
  );
}

function createGrantKeyRecordV1(
  registryGenerationIntroduced: number,
  seedOctet: number,
  input: Readonly<{
    providerId?: string;
    usage?:
      | "operation_receipt"
      | "strong_mutation_authority_grant";
  }> = {},
): StoreDurableObjectProviderVerificationPublicKeyV1 {
  const providerId = input.providerId ?? TEST_BROKER_PROVIDER_ID;
  const usage = input.usage ?? TEST_BROKER_GRANT_USAGE;
  const publicKeyBytes = rawPublicKeyBytesV1(ed25519PrivateKeyV1(seedOctet));
  const unsignedClaims = {
    profile: "store_durable_object_provider_verification_public_key_v1",
    providerId,
    registryGenerationIntroduced,
    keyId: deriveStoreProviderVerificationKeyIdV1({
      providerId,
      usage,
      publicKeyBytes,
    }),
    usage,
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

function currentEntryV1(
  history: readonly ProviderRegistryManifestEnvelopeV1[],
): StoreDurableObjectProviderRegistryEntryV1 {
  const member = history.at(-1)?.payload.members.find(
    (candidate) =>
      candidate.providerId === TEST_BROKER_PROVIDER_ID &&
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
    member.providerId === TEST_BROKER_PROVIDER_ID &&
      member.disposition === "enabled"
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
  return [...history, ProviderRegistryManifestEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_registry_manifest",
    generationId,
    contentDigest: deriveProviderRegistryManifestContentDigestV1(payload),
    payload,
  })];
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

export interface StrongMutationTrustRegistryV1 {
  readonly history: readonly ProviderRegistryManifestEnvelopeV1[];
  readonly initialKey: StoreDurableObjectProviderVerificationPublicKeyV1;
  readonly initialSeed: number;
  readonly activeKey: StoreDurableObjectProviderVerificationPublicKeyV1;
  readonly activeSeed: number;
}

let initialTrustRegistryCacheV1: StrongMutationTrustRegistryV1 | undefined;

export function strongMutationTrustRegistryV1(
  state: "initial" | "rotated" | "revoked" = "initial",
  input: Readonly<{
    initialKeyProviderId?: string;
    initialKeyUsage?: "operation_receipt" | "strong_mutation_authority_grant";
  }> = {},
): StrongMutationTrustRegistryV1 {
  if (
    state === "initial" &&
    input.initialKeyProviderId === undefined &&
    input.initialKeyUsage === undefined &&
    initialTrustRegistryCacheV1 !== undefined
  ) return initialTrustRegistryCacheV1;
  const legacy = cloneV1(registryFixtureV1.registryManifestHistory);
  let initialKey!: StoreDurableObjectProviderVerificationPublicKeyV1;
  const initialEntry = createEntrySuccessorV1(
    currentEntryV1(legacy),
    (entry) => {
      initialKey = createGrantKeyRecordV1(
        entry.registryGeneration,
        TEST_BROKER_GRANT_SEED,
        {
          providerId: input.initialKeyProviderId,
          usage: input.initialKeyUsage,
        },
      );
      entry.verificationKeys.publicKeyRecords.push(initialKey);
      sortVerificationRecordsV1(entry.verificationKeys.publicKeyRecords);
      entry.verificationKeys.activeKeyIds.strongMutationAuthorityGrant =
        initialKey.keyId;
    },
  );
  const initialHistory = appendManifestV1(
    legacy,
    initialEntry,
    "2026-08-19T00:00:00Z",
  );
  if (state === "initial") {
    const result = {
      history: initialHistory,
      initialKey,
      initialSeed: TEST_BROKER_GRANT_SEED,
      activeKey: initialKey,
      activeSeed: TEST_BROKER_GRANT_SEED,
    };
    if (
      input.initialKeyProviderId === undefined &&
      input.initialKeyUsage === undefined
    ) initialTrustRegistryCacheV1 = result;
    return result;
  }

  let rotatedKey!: StoreDurableObjectProviderVerificationPublicKeyV1;
  const rotatedEntry = createEntrySuccessorV1(initialEntry, (entry) => {
    rotatedKey = createGrantKeyRecordV1(
      entry.registryGeneration,
      TEST_BROKER_GRANT_SEED + 1,
    );
    entry.verificationKeys.publicKeyRecords.push(rotatedKey);
    sortVerificationRecordsV1(entry.verificationKeys.publicKeyRecords);
    entry.verificationKeys.activeKeyIds.strongMutationAuthorityGrant =
      rotatedKey.keyId;
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
      initialSeed: TEST_BROKER_GRANT_SEED,
      activeKey: rotatedKey,
      activeSeed: TEST_BROKER_GRANT_SEED + 1,
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
    initialSeed: TEST_BROKER_GRANT_SEED,
    activeKey: rotatedKey,
    activeSeed: TEST_BROKER_GRANT_SEED + 1,
  };
}

function registryPinV1(
  history: readonly ProviderRegistryManifestEnvelopeV1[],
) {
  const current = history.at(-1);
  if (current === undefined) throw new TypeError("Registry history absent");
  return {
    locatorProfile: "installation_provider_registry_manifest_v1" as const,
    manifestGeneration: current.payload.manifestGeneration,
    generationId: current.generationId,
    contentDigest: current.contentDigest,
  };
}

export function strongMutationTrustedConfigurationV1(
  registry: StrongMutationTrustRegistryV1 = strongMutationTrustRegistryV1(),
  input: Readonly<{
    selectorProviderId?: string;
    selectorEntryContentDigest?: `sha256:${string}`;
  }> = {},
): ProviderAcceptedConfigurationV1 {
  const current = registry.history.at(-1);
  const member = current?.payload.members.find(
    (candidate) =>
      candidate.providerId === TEST_BROKER_PROVIDER_ID &&
      candidate.disposition === "enabled",
  );
  if (
    current === undefined ||
    member === undefined ||
    member.disposition !== "enabled"
  ) throw new TypeError("current Registry member absent");
  const entry = member.registryEntry;
  return ProviderAcceptedConfigurationV1Schema.parse({
    state: "strong_ready",
    core: {
      activeRootMetadata: current.payload.activeRootMetadata,
      providerRegistryManifest: registryPinV1(registry.history),
      providerSupportCatalog: {
        locatorProfile:
          "distribution_provider_feasibility_support_catalog_v1",
        catalogGeneration: 1,
        contentDigest: `sha256:${"9".repeat(64)}`,
      },
      activeWriterSelector: {
        profile: "provider_active_writer_selector_v1",
        selections: [{
          targetProfileId: TEST_BROKER_TARGET_PROFILE_ID,
          providerId:
            input.selectorProviderId ?? TEST_BROKER_PROVIDER_ID,
          registryEntryContentDigest:
            input.selectorEntryContentDigest ??
              member.registryEntryContentDigest,
          semanticProviderPolicyDigest: entry.semanticProviderPolicyDigest,
          providerFeasibilityEvidence: entry.providerFeasibilityEvidence,
          runtimeAttestationContentDigest:
            entry.runtimeAttestation.contentDigest,
          bindingDerivationKeyGeneration:
            entry.verificationKeys.activeBindingDerivationKeyGeneration,
        }],
      },
    },
    activation: { origin: "bootstrap_or_steady_successor" },
  });
}

export function strongMutationTrustedGenerationFloorsV1(
  registry: StrongMutationTrustRegistryV1 = strongMutationTrustRegistryV1(),
) {
  const configuration = strongMutationTrustedConfigurationV1(registry);
  if (configuration.state !== "strong_ready") {
    throw new TypeError("expected strong-ready configuration");
  }
  return {
    rootMetadataGeneration:
      configuration.core.activeRootMetadata.rootGeneration + 1,
    registryManifestGeneration:
      configuration.core.providerRegistryManifest.manifestGeneration + 1,
    supportCatalogGeneration:
      configuration.core.providerSupportCatalog.catalogGeneration + 1,
  };
}

function principalSpkiV1(seedOctet = TEST_BROKER_PRINCIPAL_SEED) {
  return `base64url:${Buffer.from(
    createPublicKey(ed25519PrivateKeyV1(seedOctet)).export({
      format: "der",
      type: "spki",
    }),
  ).toString("base64url")}` as const;
}

export function strongMutationPrincipalAttestationV1(
  acceptanceIdentity: ProviderRuntimeIpcAcceptanceIdentityProofV1,
  input: Readonly<{
    seedOctet?: number;
    publicKey?: `base64url:${string}`;
    signatureBitFlip?: boolean;
    claimsOverrides?: Readonly<Record<string, unknown>>;
  }> = {},
): ProviderRuntimeIpcPrincipalAttestationV1 {
  const seedOctet = input.seedOctet ?? TEST_BROKER_PRINCIPAL_SEED;
  const claims = ProviderRuntimeIpcPrincipalAttestationClaimsV1Schema.parse({
    providerId: TEST_BROKER_PROVIDER_ID,
    capabilityDigest: TEST_BROKER_CAPABILITY_DIGEST,
    challenge: "a".repeat(64),
    connectionNonce: "b".repeat(64),
    processId: 4242,
    ...TEST_BROKER_JOURNAL_HEAD,
    handoffPayloadDigest: TEST_BROKER_HANDOFF_PAYLOAD_DIGEST,
    publicKey: input.publicKey ?? principalSpkiV1(seedOctet),
    acceptanceIdentity,
    ...input.claimsOverrides,
  });
  const signature = sign(
    null,
    canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1(claims),
    ed25519PrivateKeyV1(seedOctet),
  );
  if (input.signatureBitFlip === true) {
    signature[0] = (signature[0] ?? 0) ^ 1;
  }
  return ProviderRuntimeIpcPrincipalAttestationV1Schema.parse({
    protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
    kind: "principal_attestation",
    ...claims,
    signature: `base64url:${signature.toString("base64url")}`,
  });
}

export function strongMutationTrustEvidenceV1(
  acceptanceIdentity: ProviderRuntimeIpcAcceptanceIdentityProofV1,
  input: Readonly<{
    registry?: StrongMutationTrustRegistryV1;
    principalAttestation?: ProviderRuntimeIpcPrincipalAttestationV1;
  }> = {},
) {
  const registry = input.registry ?? strongMutationTrustRegistryV1();
  return {
    bootstrapTrustBundle: registryFixtureV1.bootstrapTrustBundle,
    rootMetadataHistory: registryFixtureV1.rootMetadataHistory,
    registryManifestHistory: registry.history,
    principalAttestation:
      input.principalAttestation ??
      strongMutationPrincipalAttestationV1(acceptanceIdentity),
  };
}

export function sha256OracleV1(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function canonicalDigestOracleV1(value: unknown): `sha256:${string}` {
  return sha256OracleV1(canonicalizeJcsSafeIntegerUtf8V1(value));
}

export function currentAcceptanceIdentityV1(
  current: ProviderAcceptanceCurrentReadV1,
) {
  const accepted = current.highWater.payload.currentAcceptance;
  return {
    generationId: accepted.generationId,
    contentDigest: accepted.contentDigest,
    acceptanceOrdinal: accepted.acceptanceOrdinal,
    installationIdentityGenerationId:
      current.highWater.payload.installationIdentityGenerationId,
  };
}

export function strongMutationRequestDigestOracleV1(input: Readonly<{
  operation: "write_object" | "compare_commit";
  operationNonce: string;
  payload: unknown;
}>): `sha256:${string}` {
  return canonicalDigestOracleV1({
    domain: PROVIDER_RUNTIME_IPC_STRONG_MUTATION_REQUEST_DOMAIN_V1,
    operation: input.operation,
    operationNonce: input.operationNonce,
    payload: input.payload,
  });
}

export function strongMutationBindingDigestOracleV1(input: Readonly<{
  principalAttestationDigest: string;
  operation: "write_object" | "compare_commit";
  operationNonce: string;
  requestDigest: string;
  authorityGrant: unknown;
}>): `sha256:${string}` {
  return canonicalDigestOracleV1({
    domain: PROVIDER_RUNTIME_IPC_STRONG_MUTATION_SESSION_BINDING_DOMAIN_V1,
    claims: {
      principalAttestationDigest: input.principalAttestationDigest,
      operation: input.operation,
      operationNonce: input.operationNonce,
      requestDigest: input.requestDigest,
      authorityGrant: input.authorityGrant,
    },
  });
}

export function strongMutationRequestV1(
  current: ProviderAcceptanceCurrentReadV1,
  options: Readonly<{
    requestId?: string;
    nonceDigit?: string;
    body?: string;
    registry?: StrongMutationTrustRegistryV1;
    principalAttestation?: ProviderRuntimeIpcPrincipalAttestationV1;
    signerKey?: StoreDurableObjectProviderVerificationPublicKeyV1;
    signerKeyId?: StoreDurableObjectProviderVerificationPublicKeyV1["keyId"];
    signerSeed?: number;
    grantSignatureBitFlip?: boolean;
  }> = {},
): ProviderRuntimeIpcStrongMutationRequestV1 {
  const nonceDigit = options.nonceDigit ?? "3";
  const operationNonce = nonceDigit.repeat(32);
  const bytes = Buffer.from(
    options.body ?? "broker records intent but performs no provider write",
    "utf8",
  );
  const payload = {
    locator: {
      providerId: TEST_BROKER_PROVIDER_ID,
      contentDigest: sha256OracleV1(bytes),
    },
    logicalBytes: bytes.byteLength,
    bytes: `base64url:${bytes.toString("base64url")}` as const,
  };
  const requestDigest = strongMutationRequestDigestOracleV1({
    operation: "write_object",
    operationNonce,
    payload,
  });
  const registry = options.registry ?? strongMutationTrustRegistryV1();
  const principalAttestation =
    options.principalAttestation ??
    strongMutationPrincipalAttestationV1(currentAcceptanceIdentityV1(current));
  const principalAttestationDigest = sha256OracleV1(
    canonicalizeProviderRuntimeIpcPrincipalAttestationTranscriptV1(
      principalAttestation,
    ),
  );
  const signerKey = options.signerKey ?? registry.activeKey;
  const signerSeed = options.signerSeed ?? registry.activeSeed;
  const grantFields = {
    signerKeyId: options.signerKeyId ?? signerKey.keyId,
    providerId: TEST_BROKER_PROVIDER_ID,
    targetProfileId: TEST_BROKER_TARGET_PROFILE_ID,
    targetFingerprintDigest: TEST_BROKER_TARGET_FINGERPRINT_DIGEST,
    registryManifest: registryPinV1(registry.history),
    acceptanceIdentity: currentAcceptanceIdentityV1(current),
    capabilityDigest: TEST_BROKER_CAPABILITY_DIGEST,
    principalAttestationDigest,
    journalHead: TEST_BROKER_JOURNAL_HEAD,
    operation: "write_object" as const,
    operationNonce,
    requestDigest,
  };
  const grantId =
    deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1(grantFields);
  const unsignedGrant = {
    profile:
      "provider_runtime_ipc_strong_mutation_authority_grant_v1" as const,
    grantId,
    ...grantFields,
  };
  const grantSignature = sign(
      null,
      createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1(
        unsignedGrant,
      ),
      ed25519PrivateKeyV1(signerSeed),
    );
  if (options.grantSignatureBitFlip === true) {
    grantSignature[0] = (grantSignature[0] ?? 0) ^ 1;
  }
  const grantPayload = {
    ...unsignedGrant,
    signature: `base64url:${grantSignature.toString("base64url")}`,
  };
  const authorityGrant =
    ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_runtime_ipc_strong_mutation_authority_grant",
      grantId,
      contentDigest:
        deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1(
          grantPayload,
        ),
      payload: grantPayload,
    });
  const bindingDigest = strongMutationBindingDigestOracleV1({
    principalAttestationDigest,
    operation: "write_object",
    operationNonce,
    requestDigest,
    authorityGrant,
  });
  return ProviderRuntimeIpcStrongMutationRequestV1Schema.parse({
    protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
    kind: "strong_mutation_request",
    requestId: options.requestId ?? "4".repeat(32),
    principalAttestationDigest,
    bindingDigest,
    operation: "write_object",
    operationNonce,
    requestDigest,
    authorityGrant,
    payload,
  });
}

export function strongMutationCompareRequestV1(
  current: ProviderAcceptanceCurrentReadV1,
  options: Readonly<{
    requestId?: string;
    nonceDigit?: string;
    expectedRevision?: number;
    registry?: StrongMutationTrustRegistryV1;
    principalAttestation?: ProviderRuntimeIpcPrincipalAttestationV1;
    signerKey?: StoreDurableObjectProviderVerificationPublicKeyV1;
    signerKeyId?: StoreDurableObjectProviderVerificationPublicKeyV1["keyId"];
    signerSeed?: number;
    grantSignatureBitFlip?: boolean;
  }> = {},
): ProviderRuntimeIpcStrongMutationRequestV1 {
  const nonceDigit = options.nonceDigit ?? "b";
  const operationNonce = nonceDigit.repeat(32);
  const payload = {
    expectedRevision: options.expectedRevision ?? 7,
    operationNonce,
    phase: "broker-test-committed-phase",
    artifacts: {
      alpha: { digest: `sha256:${"d".repeat(64)}` },
      beta: [1, true, "exact"],
    },
  };
  const requestDigest = strongMutationRequestDigestOracleV1({
    operation: "compare_commit",
    operationNonce,
    payload,
  });
  const registry = options.registry ?? strongMutationTrustRegistryV1();
  const principalAttestation =
    options.principalAttestation ??
    strongMutationPrincipalAttestationV1(currentAcceptanceIdentityV1(current));
  const principalAttestationDigest = sha256OracleV1(
    canonicalizeProviderRuntimeIpcPrincipalAttestationTranscriptV1(
      principalAttestation,
    ),
  );
  const signerKey = options.signerKey ?? registry.activeKey;
  const signerSeed = options.signerSeed ?? registry.activeSeed;
  const grantFields = {
    signerKeyId: options.signerKeyId ?? signerKey.keyId,
    providerId: TEST_BROKER_PROVIDER_ID,
    targetProfileId: TEST_BROKER_TARGET_PROFILE_ID,
    targetFingerprintDigest: TEST_BROKER_TARGET_FINGERPRINT_DIGEST,
    registryManifest: registryPinV1(registry.history),
    acceptanceIdentity: currentAcceptanceIdentityV1(current),
    capabilityDigest: TEST_BROKER_CAPABILITY_DIGEST,
    principalAttestationDigest,
    journalHead: TEST_BROKER_JOURNAL_HEAD,
    operation: "compare_commit" as const,
    operationNonce,
    requestDigest,
  };
  const grantId =
    deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1(grantFields);
  const unsignedGrant = {
    profile:
      "provider_runtime_ipc_strong_mutation_authority_grant_v1" as const,
    grantId,
    ...grantFields,
  };
  const grantSignature = sign(
      null,
      createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1(
        unsignedGrant,
      ),
      ed25519PrivateKeyV1(signerSeed),
    );
  if (options.grantSignatureBitFlip === true) {
    grantSignature[0] = (grantSignature[0] ?? 0) ^ 1;
  }
  const grantPayload = {
    ...unsignedGrant,
    signature: `base64url:${grantSignature.toString("base64url")}`,
  };
  const authorityGrant =
    ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_runtime_ipc_strong_mutation_authority_grant",
      grantId,
      contentDigest:
        deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1(
          grantPayload,
        ),
      payload: grantPayload,
    });
  const bindingDigest = strongMutationBindingDigestOracleV1({
    principalAttestationDigest,
    operation: "compare_commit",
    operationNonce,
    requestDigest,
    authorityGrant,
  });
  return ProviderRuntimeIpcStrongMutationRequestV1Schema.parse({
    protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
    kind: "strong_mutation_request",
    requestId: options.requestId ?? "b".repeat(32),
    principalAttestationDigest,
    bindingDigest,
    operation: "compare_commit",
    operationNonce,
    requestDigest,
    authorityGrant,
    payload,
  });
}

export function strongMutationResponseV1(
  request: ProviderRuntimeIpcStrongMutationRequestV1,
  options: Readonly<{
    signatureBitFlip?: boolean;
    signerSeed?: number;
  }> = {},
): ProviderRuntimeIpcStrongMutationResponseV1 {
  if (request.operation !== "write_object") {
    throw new Error("broker fixture requires write_object");
  }
  const unsignedResponse = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse({
    protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
    kind: "strong_mutation_response",
    requestId: request.requestId,
    principalAttestationDigest: request.principalAttestationDigest,
    bindingDigest: request.bindingDigest,
    operation: request.operation,
    operationNonce: request.operationNonce,
    requestDigest: request.requestDigest,
    signature: `base64url:${Buffer.alloc(64).toString("base64url")}`,
    ok: true,
    payload: {
      operation: "write_object",
      resolution: "committed",
      locator: request.payload.locator,
      logicalBytes: request.payload.logicalBytes,
      verifiedContentDigest: request.payload.locator.contentDigest,
    },
  });
  const signature = sign(
    null,
    canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1(
      unsignedResponse,
    ),
    ed25519PrivateKeyV1(options.signerSeed ?? TEST_BROKER_PRINCIPAL_SEED),
  );
  if (options.signatureBitFlip === true) {
    signature[0] = (signature[0] ?? 0) ^ 1;
  }
  return ProviderRuntimeIpcStrongMutationResponseV1Schema.parse({
    ...unsignedResponse,
    signature: `base64url:${signature.toString("base64url")}`,
  });
}

export function strongMutationCompareResponseV1(
  request: ProviderRuntimeIpcStrongMutationRequestV1,
  resolution: "committed" | "replayed" | "stale" | "error" = "committed",
): ProviderRuntimeIpcStrongMutationResponseV1 {
  if (request.operation !== "compare_commit") {
    throw new Error("broker fixture requires compare_commit");
  }
  const common = {
    protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
    kind: "strong_mutation_response" as const,
    requestId: request.requestId,
    principalAttestationDigest: request.principalAttestationDigest,
    bindingDigest: request.bindingDigest,
    operation: request.operation,
    operationNonce: request.operationNonce,
    requestDigest: request.requestDigest,
    signature: `base64url:${Buffer.alloc(64).toString("base64url")}`,
  };
  let unsignedResponse: ProviderRuntimeIpcStrongMutationResponseV1;
  if (resolution === "error") {
    unsignedResponse = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse({
      ...common,
      ok: false,
      error: {
        code: "storage_failure",
        message: "synthetic provider failure",
      },
    });
  } else {
    unsignedResponse = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse({
      ...common,
      ok: true,
      payload: {
        operation: "compare_commit",
        resolution,
        state: resolution === "committed"
          ? {
              profile: "provider_runtime_durable_journal_state_v1",
              revision: request.payload.expectedRevision + 1,
              phase: request.payload.phase,
              operationNonce: request.payload.operationNonce,
              mutationDigest: `sha256:${"e".repeat(64)}`,
              artifacts: request.payload.artifacts,
            }
          : {
              profile: "provider_runtime_durable_journal_state_v1",
              revision: 1,
              phase: "observed-provider-head",
              operationNonce: "none",
              mutationDigest: "none",
              artifacts: { observed: resolution },
            },
      },
    });
  }
  const signature = sign(
    null,
    canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1(
      unsignedResponse,
    ),
    ed25519PrivateKeyV1(TEST_BROKER_PRINCIPAL_SEED),
  );
  return ProviderRuntimeIpcStrongMutationResponseV1Schema.parse({
    ...unsignedResponse,
    signature: `base64url:${signature.toString("base64url")}`,
  });
}

export function resignStrongMutationResponseV1(
  response: ProviderRuntimeIpcStrongMutationResponseV1,
  signerSeed = TEST_BROKER_PRINCIPAL_SEED,
): ProviderRuntimeIpcStrongMutationResponseV1 {
  const parsed = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
    response,
  );
  const signature = sign(
    null,
    canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1(parsed),
    ed25519PrivateKeyV1(signerSeed),
  );
  return ProviderRuntimeIpcStrongMutationResponseV1Schema.parse({
    ...parsed,
    signature: `base64url:${signature.toString("base64url")}`,
  });
}

export function brokerResolveRequestV1(
  intent: Readonly<{
    grantId: string;
    requestContentDigest: string;
    requestDigest: string;
    bindingDigest: string;
  }>,
  response: ProviderRuntimeIpcStrongMutationResponseV1,
) {
  return {
    profile: "provider_strong_mutation_broker_resolve_request_v1" as const,
    grantId: intent.grantId,
    requestContentDigest: intent.requestContentDigest,
    requestDigest: intent.requestDigest,
    bindingDigest: intent.bindingDigest,
    response,
  };
}
