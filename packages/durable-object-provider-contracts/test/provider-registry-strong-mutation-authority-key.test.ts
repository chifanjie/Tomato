import {
  createPrivateKey,
  createPublicKey,
  sign,
  type KeyObject,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import type { ProviderBootstrapTrustBundleV1 } from "../src/bootstrap-trust-bundle.js";
import type { StoreProviderVerificationKeyIdV1 } from "../src/primitives.js";
import {
  diagnoseProviderRegistryManifestHistoryInternalV1,
  validateProviderRegistryManifestHistoryV1,
  type ValidateProviderRegistryManifestHistoryV1Input,
} from "../src/provider-registry-manifest-history.js";
import {
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestV1Schema,
  StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1Schema,
  StoreDurableObjectProviderRegistryEntryV1Schema,
  StoreDurableObjectProviderVerificationKeyUsageV1Schema,
  StoreDurableObjectProviderVerificationPublicKeyV1Schema,
  createProviderRegistryManifestSignatureMessageV1,
  createStoreDurableObjectProviderRegistryEntrySignatureMessageV1,
  createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1,
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
  deriveStoreDurableObjectProviderRegistryEntryContentDigestV1,
  deriveStoreProviderVerificationKeyIdV1,
  type ProviderRegistryManifestEnvelopeV1,
  type StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1,
  type StoreDurableObjectProviderRegistryEntryV1,
  type StoreDurableObjectProviderVerificationPublicKeyV1,
} from "../src/provider-registry-records.js";
import {
  deriveProviderEd25519PublicKeyDigestInternalV1,
  type ProviderRegistryRootMetadataEnvelopeV1,
} from "../src/provider-registry-trust.js";
import {
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  attestProviderStrictEd25519CryptoHostV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "../src/strict-ed25519-conformance.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "../src/strict-ed25519.js";

interface RegistryFixtureV1 {
  readonly installationIdentityGenerationId:
    ValidateProviderRegistryManifestHistoryV1Input["installationIdentityGenerationId"];
  readonly bootstrapTrustBundle: ProviderBootstrapTrustBundleV1;
  readonly rootMetadataHistory:
    readonly ProviderRegistryRootMetadataEnvelopeV1[];
  readonly registryManifestHistory:
    readonly ProviderRegistryManifestEnvelopeV1[];
  readonly deterministicSeeds: {
    readonly rootHistoryDependencySeeds: {
      readonly bootstrapRootSeedHex: string;
      readonly plannedRootSeedHex: string;
      readonly compromiseRootSeedHex: string;
    };
  };
}

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as RegistryFixtureV1;

const strictManifestBytes = new Uint8Array(
  readFileSync(
    fileURLToPath(
      new URL(
        "../provider/ed25519-strict-host-conformance-v1.json",
        import.meta.url,
      ),
    ),
  ),
);

const PROVIDER_ID = "durable-object-provider:native-b";
const ROOT_GENERATION = 3;
const GRANT_USAGE = "strong_mutation_authority_grant" as const;

let capability: ProviderStrictEd25519OpaqueCapabilityV1;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function rootPrivateKey(): KeyObject {
  const seed = Buffer.from(
    fixture.deterministicSeeds.rootHistoryDependencySeeds
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

function rootKeyId(): string {
  const root = fixture.rootMetadataHistory[ROOT_GENERATION - 1];
  if (root === undefined) throw new TypeError("current fixture root absent");
  return root.rootKeyId;
}

function rootSignature(
  prefix: "provider-registry-ed25519" | "provider-registry-manifest-ed25519",
  message: Uint8Array,
): string {
  return `${prefix}:${rootKeyId()}:${sign(
    null,
    Buffer.from(message),
    rootPrivateKey(),
  ).toString("hex")}`;
}

function rawPublicKeyBytes(privateKey: KeyObject): `base64url:${string}` {
  const spki = Buffer.from(
    createPublicKey(privateKey).export({ format: "der", type: "spki" }),
  );
  return `base64url:${spki.subarray(spki.byteLength - 32).toString("base64url")}`;
}

function grantPrivateKey(seedOctet: number): KeyObject {
  const seed = Buffer.alloc(32, seedOctet);
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      seed,
    ]),
    format: "der",
    type: "pkcs8",
  });
}

function createGrantKeyRecord(
  registryGenerationIntroduced: number,
  seedOctet: number,
): StoreDurableObjectProviderVerificationPublicKeyV1 {
  const privateKey = grantPrivateKey(seedOctet);
  const publicKeyBytes = rawPublicKeyBytes(privateKey);
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
    publicKeyDigest:
      deriveProviderEd25519PublicKeyDigestInternalV1(publicKeyBytes),
  } as const;
  return StoreDurableObjectProviderVerificationPublicKeyV1Schema.parse({
    ...unsignedClaims,
    registrySignature: rootSignature(
      "provider-registry-ed25519",
      createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1(
        unsignedClaims,
        rootKeyId(),
      ),
    ),
  });
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function sortVerificationRecords(
  records: StoreDurableObjectProviderVerificationPublicKeyV1[],
): void {
  records.sort((left, right) => {
    const providerOrder = compareUtf8(left.providerId, right.providerId);
    if (providerOrder !== 0) return providerOrder;
    const usageOrder = compareUtf8(left.usage, right.usage);
    return usageOrder !== 0
      ? usageOrder
      : compareUtf8(left.keyId, right.keyId);
  });
}

function currentEnabledEntry(
  history: readonly ProviderRegistryManifestEnvelopeV1[],
): StoreDurableObjectProviderRegistryEntryV1 {
  const member = history.at(-1)?.payload.members.find(
    (candidate) =>
      candidate.providerId === PROVIDER_ID &&
      candidate.disposition === "enabled",
  );
  if (member === undefined || member.disposition !== "enabled") {
    throw new TypeError("current enabled fixture entry absent");
  }
  return clone(member.registryEntry);
}

function createEntrySuccessor(
  previous: StoreDurableObjectProviderRegistryEntryV1,
  mutate: (
    entry: StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1,
  ) => void,
): StoreDurableObjectProviderRegistryEntryV1 {
  const { registrySignature: _oldSignature, ...previousUnsigned } = previous;
  const candidate = clone({
    ...previousUnsigned,
    registryGeneration: previous.registryGeneration + 1,
    predecessorRegistryEntryContentDigest:
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(previous),
  });
  mutate(candidate as StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1);
  const unsignedClaims =
    StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1Schema.parse(
      candidate,
    );
  return StoreDurableObjectProviderRegistryEntryV1Schema.parse({
    ...unsignedClaims,
    registrySignature: rootSignature(
      "provider-registry-ed25519",
      createStoreDurableObjectProviderRegistryEntrySignatureMessageV1(
        unsignedClaims,
        rootKeyId(),
      ),
    ),
  });
}

function appendManifest(
  input: readonly ProviderRegistryManifestEnvelopeV1[],
  entry: StoreDurableObjectProviderRegistryEntryV1,
  issuedAt: string,
): readonly ProviderRegistryManifestEnvelopeV1[] {
  const history = clone(input);
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
      : member,
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
  const unsignedClaims = {
    profile: "provider_registry_manifest_v1" as const,
    generationId,
    ...idFields,
    issuedAt,
  };
  const payload = ProviderRegistryManifestV1Schema.parse({
    ...unsignedClaims,
    manifestSignature: rootSignature(
      "provider-registry-manifest-ed25519",
      createProviderRegistryManifestSignatureMessageV1(
        unsignedClaims,
        rootKeyId(),
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

function request(
  registryManifestHistory: readonly ProviderRegistryManifestEnvelopeV1[],
): ValidateProviderRegistryManifestHistoryV1Input {
  return {
    installationIdentityGenerationId:
      fixture.installationIdentityGenerationId,
    bootstrapTrustBundle: fixture.bootstrapTrustBundle,
    rootMetadataHistory: fixture.rootMetadataHistory,
    registryManifestHistory,
    strictCryptoCapability: capability,
  };
}

function addGrantKey(
  entry: StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1,
  seedOctet: number,
): StoreDurableObjectProviderVerificationPublicKeyV1 {
  const record = createGrantKeyRecord(entry.registryGeneration, seedOctet);
  entry.verificationKeys.publicKeyRecords.push(record);
  sortVerificationRecords(entry.verificationKeys.publicKeyRecords);
  entry.verificationKeys.activeKeyIds.strongMutationAuthorityGrant =
    record.keyId;
  return record;
}

function removeActiveGrantKey(
  entry: StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1,
): void {
  delete entry.verificationKeys.activeKeyIds.strongMutationAuthorityGrant;
}

function requireActiveGrantKeyId(
  entry: StoreDurableObjectProviderRegistryEntryV1,
): StoreProviderVerificationKeyIdV1 {
  const keyId =
    entry.verificationKeys.activeKeyIds.strongMutationAuthorityGrant;
  if (keyId === undefined) {
    throw new TypeError("active strong-mutation authority grant key absent");
  }
  return keyId;
}

beforeAll(async () => {
  capability = await attestProviderStrictEd25519CryptoHostV1({
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

describe("Registry strong-mutation authority grant key lifecycle", () => {
  it("keeps legacy history valid and accepts initial, rotation, and revoke-to-locked successors", async () => {
    expect(
      StoreDurableObjectProviderVerificationKeyUsageV1Schema.parse(
        GRANT_USAGE,
      ),
    ).toBe(GRANT_USAGE);

    const legacy = clone(fixture.registryManifestHistory);
    await expect(
      validateProviderRegistryManifestHistoryV1(request(legacy)),
    ).resolves.toMatchObject({
      authority: "none_registry_structure_and_history_only",
    });

    const initialEntry = createEntrySuccessor(
      currentEnabledEntry(legacy),
      (entry) => {
        addGrantKey(entry, 0x41);
      },
    );
    const initial = appendManifest(
      legacy,
      initialEntry,
      "2026-08-03T00:05:00Z",
    );
    await expect(
      validateProviderRegistryManifestHistoryV1(request(initial)),
    ).resolves.toMatchObject({
      retainedRegistryManifestGenerationCount: 8,
    });

    const rotatedEntry = createEntrySuccessor(initialEntry, (entry) => {
      addGrantKey(entry, 0x42);
    });
    const rotatedKeyId = requireActiveGrantKeyId(rotatedEntry);
    const rotated = appendManifest(
      initial,
      rotatedEntry,
      "2026-08-03T00:05:10Z",
    );
    await expect(
      validateProviderRegistryManifestHistoryV1(request(rotated)),
    ).resolves.toMatchObject({
      retainedRegistryManifestGenerationCount: 9,
    });

    const lockedEntry = createEntrySuccessor(rotatedEntry, (entry) => {
      removeActiveGrantKey(entry);
      entry.verificationKeys.compromisedRevokedKeyIds.push(rotatedKeyId);
      entry.verificationKeys.compromisedRevokedKeyIds.sort(compareUtf8);
    });
    const locked = appendManifest(
      rotated,
      lockedEntry,
      "2026-08-03T00:05:20Z",
    );
    await expect(
      validateProviderRegistryManifestHistoryV1(request(locked)),
    ).resolves.toMatchObject({
      retainedRegistryManifestGenerationCount: 10,
    });
  });

  it("rejects an active ID with the wrong usage and an active revoked key", async () => {
    const legacy = clone(fixture.registryManifestHistory);
    const legacyEntry = currentEnabledEntry(legacy);
    const wrongUsageEntry = createEntrySuccessor(legacyEntry, (entry) => {
      const operationKey = entry.verificationKeys.publicKeyRecords.find(
        (record) => record.usage === "operation_receipt",
      );
      if (operationKey === undefined) {
        throw new TypeError("fixture operation key absent");
      }
      entry.verificationKeys.activeKeyIds.strongMutationAuthorityGrant =
        operationKey.keyId;
    });
    const wrongUsage = appendManifest(
      legacy,
      wrongUsageEntry,
      "2026-08-03T00:05:00Z",
    );
    await expect(
      diagnoseProviderRegistryManifestHistoryInternalV1(request(wrongUsage)),
    ).resolves.toMatchObject({ ok: false });

    const initialEntry = createEntrySuccessor(legacyEntry, (entry) => {
      addGrantKey(entry, 0x43);
    });
    const initialKeyId = requireActiveGrantKeyId(initialEntry);
    const initial = appendManifest(
      legacy,
      initialEntry,
      "2026-08-03T00:05:00Z",
    );
    const revokedActiveEntry = createEntrySuccessor(initialEntry, (entry) => {
      entry.verificationKeys.compromisedRevokedKeyIds.push(initialKeyId);
      entry.verificationKeys.compromisedRevokedKeyIds.sort(compareUtf8);
    });
    const revokedActive = appendManifest(
      initial,
      revokedActiveEntry,
      "2026-08-03T00:05:10Z",
    );
    await expect(
      diagnoseProviderRegistryManifestHistoryInternalV1(
        request(revokedActive),
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "key_history",
      reason: "active_record_invalid",
    });
  });

  it("rejects reactivation of an older key after rotation", async () => {
    const legacy = clone(fixture.registryManifestHistory);
    const initialEntry = createEntrySuccessor(
      currentEnabledEntry(legacy),
      (entry) => {
        addGrantKey(entry, 0x44);
      },
    );
    const initialKeyId = requireActiveGrantKeyId(initialEntry);
    const initial = appendManifest(
      legacy,
      initialEntry,
      "2026-08-03T00:05:00Z",
    );
    const rotatedEntry = createEntrySuccessor(initialEntry, (entry) => {
      addGrantKey(entry, 0x45);
    });
    const rotated = appendManifest(
      initial,
      rotatedEntry,
      "2026-08-03T00:05:10Z",
    );
    const reactivatedEntry = createEntrySuccessor(rotatedEntry, (entry) => {
      entry.verificationKeys.activeKeyIds.strongMutationAuthorityGrant =
        initialKeyId;
    });
    const reactivated = appendManifest(
      rotated,
      reactivatedEntry,
      "2026-08-03T00:05:20Z",
    );

    await expect(
      diagnoseProviderRegistryManifestHistoryInternalV1(request(reactivated)),
    ).resolves.toEqual({
      ok: false,
      stage: "registry_entry",
      reason: "entry_successor_invalid",
    });
  });

  it("rejects removal of an active key without append-only revocation", async () => {
    const legacy = clone(fixture.registryManifestHistory);
    const initialEntry = createEntrySuccessor(
      currentEnabledEntry(legacy),
      (entry) => {
        addGrantKey(entry, 0x46);
      },
    );
    const initial = appendManifest(
      legacy,
      initialEntry,
      "2026-08-03T00:05:00Z",
    );
    const removedEntry = createEntrySuccessor(initialEntry, (entry) => {
      removeActiveGrantKey(entry);
    });
    const removed = appendManifest(
      initial,
      removedEntry,
      "2026-08-03T00:05:10Z",
    );

    await expect(
      diagnoseProviderRegistryManifestHistoryInternalV1(request(removed)),
    ).resolves.toEqual({
      ok: false,
      stage: "registry_entry",
      reason: "entry_successor_invalid",
    });
  });
});
