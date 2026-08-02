import {
  createPrivateKey,
  createPublicKey,
  sign,
  type KeyObject,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../src/jcs.js";
import {
  ProviderRegistryRootCrossSignatureWrapperV1Schema,
  ProviderRegistryRootHistoryValidationError,
  ProviderRegistryRootRecoverySignatureWrapperV1Schema,
  createProviderRegistryRootCrossSignatureMessageV1,
  createProviderRegistryRootRecoverySignatureMessageV1,
  diagnoseProviderRegistryRootMetadataHistoryInternalV1,
  validateProviderRegistryRootMetadataHistoryV1,
} from "../src/provider-registry-root-history.js";
import {
  PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1,
  PROVIDER_REGISTRY_ROOT_RECOVERY_SIGNATURE_DOMAIN_V1,
  ProviderRegistryRootCrossSignatureV1Schema,
  ProviderRegistryRootMetadataEnvelopeV1Schema,
  ProviderRegistryRootMetadataV1Schema,
  ProviderRegistryRootRecoverySignatureV1Schema,
  ProviderRegistryRootSelfSignatureV1Schema,
  deriveProviderEd25519PublicKeyDigestInternalV1,
  deriveProviderRegistryRecoveryKeyIdInternalV1,
  deriveProviderRegistryRootKeyIdInternalV1,
  deriveProviderRegistryRootMetadataContentDigestV1,
  createProviderRegistryRootSelfSignatureMessageV1,
  projectProviderRegistryRootMetadataUnsignedClaimsV1,
  type ProviderRegistryRecoveryPublicKeyV1,
  type ProviderRegistryRootMetadataEnvelopeV1,
  type ProviderRegistryRootPublicKeyV1,
} from "../src/provider-registry-trust.js";
import {
  PROVIDER_STRICT_ED25519_CRYPTO_CAPABILITY_V1,
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
import { PROVIDER_TRUST_HISTORY_POLICY_V1 } from "../src/provider-trust-policy.js";
import type { ProviderBootstrapTrustBundleV1 } from "../src/bootstrap-trust-bundle.js";

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

interface DeterministicKeyPair {
  readonly privateKey: KeyObject;
  readonly publicKeyBytes: `base64url:${string}`;
}

interface RecoveryRecord {
  readonly pair: DeterministicKeyPair;
  readonly key: ProviderRegistryRecoveryPublicKeyV1;
}

function deterministicKeyPair(seedByte: number): DeterministicKeyPair {
  const prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const privateKey = createPrivateKey({
    key: Buffer.concat([prefix, Buffer.alloc(32, seedByte)]),
    format: "der",
    type: "pkcs8",
  });
  const spki = createPublicKey(privateKey).export({
    format: "der",
    type: "spki",
  });
  return {
    privateKey,
    publicKeyBytes: `base64url:${Buffer.from(
      spki.subarray(spki.byteLength - 32),
    ).toString("base64url")}`,
  };
}

function rootPublicKey(pair: DeterministicKeyPair): ProviderRegistryRootPublicKeyV1 {
  return {
    profile: "provider_registry_root_public_key_v1",
    rootKeyId: deriveProviderRegistryRootKeyIdInternalV1({
      publicKeyBytes: pair.publicKeyBytes,
    }),
    algorithm: "ed25519",
    publicKeyBytes: pair.publicKeyBytes as never,
    publicKeyDigest: deriveProviderEd25519PublicKeyDigestInternalV1(
      pair.publicKeyBytes,
    ),
  };
}

function recoveryPublicKey(
  pair: DeterministicKeyPair,
): ProviderRegistryRecoveryPublicKeyV1 {
  return {
    profile: "provider_registry_recovery_public_key_v1",
    recoveryKeyId: deriveProviderRegistryRecoveryKeyIdInternalV1({
      publicKeyBytes: pair.publicKeyBytes,
    }),
    algorithm: "ed25519",
    publicKeyBytes: pair.publicKeyBytes as never,
    publicKeyDigest: deriveProviderEd25519PublicKeyDigestInternalV1(
      pair.publicKeyBytes,
    ),
  };
}

function signatureHex(pair: DeterministicKeyPair, message: Uint8Array): string {
  return sign(null, Buffer.from(message), pair.privateKey).toString("hex");
}

function zeroSignature(prefix: string, keyId: string): string {
  return `${prefix}:${keyId}:${"0".repeat(128)}`;
}

function envelopeForPayload(
  payload: ReturnType<typeof ProviderRegistryRootMetadataV1Schema.parse>,
): ProviderRegistryRootMetadataEnvelopeV1 {
  return ProviderRegistryRootMetadataEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_registry_root_metadata",
    rootGeneration: payload.rootGeneration,
    rootKeyId: payload.activeRoot.rootKeyId,
    contentDigest: deriveProviderRegistryRootMetadataContentDigestV1(payload),
    payload,
  });
}

function bootstrapEnvelope(
  pair: DeterministicKeyPair,
): ProviderRegistryRootMetadataEnvelopeV1 {
  const activeRoot = rootPublicKey(pair);
  const carrier = ProviderRegistryRootMetadataV1Schema.parse({
    profile: "provider_registry_root_metadata_v1",
    rootGeneration: 1,
    activeRoot,
    issuedAt: "2026-08-03T00:00:00Z",
    selfSignature: zeroSignature(
      "provider-root-self-ed25519",
      activeRoot.rootKeyId,
    ),
    activation: "bootstrap",
    predecessor: { state: "genesis" },
    recoverySignatures: [],
  });
  return envelopeForPayload(
    ProviderRegistryRootMetadataV1Schema.parse({
      ...carrier,
      selfSignature: ProviderRegistryRootSelfSignatureV1Schema.parse(
        `provider-root-self-ed25519:${activeRoot.rootKeyId}:${signatureHex(
          pair,
          createProviderRegistryRootSelfSignatureMessageV1(carrier),
        )}`,
      ),
    }),
  );
}

interface SuccessorOptions {
  readonly activation: "planned_rollover" | "compromise_recovery";
  readonly generation?: number;
  readonly predecessorPin?: {
    readonly rootGeneration: number;
    readonly rootKeyId: string;
    readonly contentDigest: string;
  };
  readonly recoveryRecords?: readonly RecoveryRecord[];
  readonly crossSigningPair?: DeterministicKeyPair;
}

function successorEnvelope(
  predecessor: ProviderRegistryRootMetadataEnvelopeV1,
  predecessorPair: DeterministicKeyPair,
  nextPair: DeterministicKeyPair,
  recoveryRecords: readonly RecoveryRecord[],
  options: SuccessorOptions,
): ProviderRegistryRootMetadataEnvelopeV1 {
  const activeRoot = rootPublicKey(nextPair);
  const selectedRecovery = [...(options.recoveryRecords ?? recoveryRecords.slice(0, 2))]
    .sort((left, right) =>
      left.key.recoveryKeyId.localeCompare(right.key.recoveryKeyId),
    );
  const predecessorPin = options.predecessorPin ?? {
    state: "root_metadata" as const,
    rootGeneration: predecessor.rootGeneration,
    rootKeyId: predecessor.rootKeyId,
    contentDigest: predecessor.contentDigest,
  };
  const common = {
    profile: "provider_registry_root_metadata_v1" as const,
    rootGeneration: options.generation ?? predecessor.rootGeneration + 1,
    activeRoot,
    issuedAt: `2026-08-03T00:00:0${Math.min(
      options.generation ?? predecessor.rootGeneration + 1,
      9,
    )}Z`,
    selfSignature: zeroSignature(
      "provider-root-self-ed25519",
      activeRoot.rootKeyId,
    ),
    activation: options.activation,
    predecessor: { state: "root_metadata" as const, ...predecessorPin },
    recoverySignatures: selectedRecovery.map((record) =>
      zeroSignature(
        "provider-root-recovery-ed25519",
        record.key.recoveryKeyId,
      ),
    ),
  };
  const carrier = ProviderRegistryRootMetadataV1Schema.parse(
    options.activation === "planned_rollover"
      ? {
          ...common,
          predecessorCrossSignature: zeroSignature(
            "provider-root-cross-ed25519",
            predecessor.rootKeyId,
          ),
        }
      : common,
  );
  const selfSignature = ProviderRegistryRootSelfSignatureV1Schema.parse(
    `provider-root-self-ed25519:${activeRoot.rootKeyId}:${signatureHex(
      nextPair,
      createProviderRegistryRootSelfSignatureMessageV1(carrier),
    )}`,
  );
  const recoverySignatures = selectedRecovery.map((record) =>
    ProviderRegistryRootRecoverySignatureV1Schema.parse(
      `provider-root-recovery-ed25519:${record.key.recoveryKeyId}:${signatureHex(
        record.pair,
        createProviderRegistryRootRecoverySignatureMessageV1(
          carrier,
          record.key.recoveryKeyId,
        ),
      )}`,
    ),
  );
  if (carrier.activation === "planned_rollover") {
    return envelopeForPayload(
      ProviderRegistryRootMetadataV1Schema.parse({
        ...carrier,
        selfSignature,
        predecessorCrossSignature: ProviderRegistryRootCrossSignatureV1Schema.parse(
          `provider-root-cross-ed25519:${predecessor.rootKeyId}:${signatureHex(
            options.crossSigningPair ?? predecessorPair,
            createProviderRegistryRootCrossSignatureMessageV1(carrier),
          )}`,
        ),
        recoverySignatures,
      }),
    );
  }
  return envelopeForPayload(
    ProviderRegistryRootMetadataV1Schema.parse({
      ...carrier,
      selfSignature,
      recoverySignatures,
    }),
  );
}

const bootstrapPair = deterministicKeyPair(51);
const plannedPair = deterministicKeyPair(52);
const compromisePair = deterministicKeyPair(53);
const outsiderPair = deterministicKeyPair(54);
const recoveryRecords = [55, 56, 57]
  .map((seed) => {
    const pair = deterministicKeyPair(seed);
    return { pair, key: recoveryPublicKey(pair) };
  })
  .sort((left, right) =>
    left.key.recoveryKeyId.localeCompare(right.key.recoveryKeyId),
  );
const bootstrap = bootstrapEnvelope(bootstrapPair);
const bootstrapBundle: ProviderBootstrapTrustBundleV1 = {
  profile: "provider_bootstrap_trust_bundle_v1",
  strictCryptoCapability: PROVIDER_STRICT_ED25519_CRYPTO_CAPABILITY_V1,
  bootstrapProviderRegistryRoot: JSON.parse(
    JSON.stringify(bootstrap.payload.activeRoot),
  ) as ProviderRegistryRootPublicKeyV1,
  bootstrapProviderRegistryRootMetadata: bootstrap,
  providerRegistryRecoveryKeys: recoveryRecords.map((record) => record.key) as never,
  providerRegistryRecoveryThreshold: 2,
  providerTrustHistoryPolicy: PROVIDER_TRUST_HISTORY_POLICY_V1,
};

let capability: ProviderStrictEd25519OpaqueCapabilityV1;

function request(history: readonly ProviderRegistryRootMetadataEnvelopeV1[]) {
  return {
    bootstrapTrustBundle: bootstrapBundle,
    rootMetadataHistory: history,
    strictCryptoCapability: capability,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function resignPayload(
  envelope: ProviderRegistryRootMetadataEnvelopeV1,
  payload: ReturnType<typeof ProviderRegistryRootMetadataV1Schema.parse>,
): ProviderRegistryRootMetadataEnvelopeV1 {
  void envelope;
  return envelopeForPayload(payload);
}

beforeAll(async () => {
  capability = await attestProviderStrictEd25519CryptoHostV1({
    host: {
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint(point) {
        return validatePrimeSubgroupPoint(point);
      },
      verifyRawEd25519(publicKey, message, signature) {
        return verifyRawEd25519(publicKey, message, signature);
      },
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

describe("provider registry root metadata history", () => {
  it("validates planned rollover and compromise recovery without granting authority", async () => {
    const planned = successorEnvelope(
      bootstrap,
      bootstrapPair,
      plannedPair,
      recoveryRecords,
      { activation: "planned_rollover" },
    );
    const compromise = successorEnvelope(
      planned,
      plannedPair,
      compromisePair,
      recoveryRecords,
      { activation: "compromise_recovery" },
    );

    const candidate = request([bootstrap, planned, compromise]);
    const diagnostic =
      await diagnoseProviderRegistryRootMetadataHistoryInternalV1(candidate);
    expect(diagnostic).toMatchObject({ ok: true });
    const result = await validateProviderRegistryRootMetadataHistoryV1(candidate);

    expect(result.authority).toBe("none_structure_and_history_only");
    expect(result.currentRootMetadata).toEqual({
      locatorProfile: "installation_provider_registry_root_metadata_v1",
      rootGeneration: 3,
      rootKeyId: compromise.rootKeyId,
      contentDigest: compromise.contentDigest,
    });
    expect(result.retainedRootMetadataGenerationCount).toBe(3);
    expect(result.retainedRootMetadataCanonicalBytes).toBe(
      [bootstrap, planned, compromise].reduce(
        (total, item) =>
          total + canonicalizeJcsSafeIntegerUtf8V1(item).byteLength,
        0,
      ),
    );
    expect(Object.isFrozen(result.rootMetadataHistory)).toBe(true);
    expect(Object.isFrozen(result.rootMetadataHistory[2]!.payload)).toBe(true);
    expect("predecessorCrossSignature" in compromise.payload).toBe(false);
  });

  it("binds cross and recovery wrappers to only their applicable activation modes", () => {
    const planned = successorEnvelope(
      bootstrap,
      bootstrapPair,
      plannedPair,
      recoveryRecords,
      { activation: "planned_rollover" },
    );
    const compromise = successorEnvelope(
      planned,
      plannedPair,
      compromisePair,
      recoveryRecords,
      { activation: "compromise_recovery" },
    );
    const bootstrapClaims =
      projectProviderRegistryRootMetadataUnsignedClaimsV1(
        bootstrap.payload,
      );
    const plannedClaims =
      projectProviderRegistryRootMetadataUnsignedClaimsV1(
        planned.payload,
      );
    const compromiseClaims =
      projectProviderRegistryRootMetadataUnsignedClaimsV1(
        compromise.payload,
      );

    expect(
      ProviderRegistryRootCrossSignatureWrapperV1Schema.safeParse({
        rootKeyId: bootstrap.rootKeyId,
        domain: PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1,
        claims: plannedClaims,
      }).success,
    ).toBe(true);
    for (const claims of [bootstrapClaims, compromiseClaims]) {
      expect(
        ProviderRegistryRootCrossSignatureWrapperV1Schema.safeParse({
          rootKeyId: bootstrap.rootKeyId,
          domain: PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1,
          claims,
        }).success,
      ).toBe(false);
    }

    for (const claims of [plannedClaims, compromiseClaims]) {
      expect(
        ProviderRegistryRootRecoverySignatureWrapperV1Schema.safeParse({
          recoveryKeyId: recoveryRecords[0]!.key.recoveryKeyId,
          domain: PROVIDER_REGISTRY_ROOT_RECOVERY_SIGNATURE_DOMAIN_V1,
          claims,
        }).success,
      ).toBe(true);
    }
    expect(
      ProviderRegistryRootRecoverySignatureWrapperV1Schema.safeParse({
        recoveryKeyId: recoveryRecords[0]!.key.recoveryKeyId,
        domain: PROVIDER_REGISTRY_ROOT_RECOVERY_SIGNATURE_DOMAIN_V1,
        claims: bootstrapClaims,
      }).success,
    ).toBe(false);
    expect(() =>
      createProviderRegistryRootCrossSignatureMessageV1(
        compromise.payload,
      ),
    ).toThrow(TypeError);
    expect(() =>
      createProviderRegistryRootRecoverySignatureMessageV1(
        bootstrap.payload,
        recoveryRecords[0]!.key.recoveryKeyId,
      ),
    ).toThrow(TypeError);
  });

  it("rejects signatures over the wrong domain and from the wrong signer", async () => {
    const planned = successorEnvelope(
      bootstrap,
      bootstrapPair,
      plannedPair,
      recoveryRecords,
      { activation: "planned_rollover" },
    );
    const wrongDomain = clone(planned);
    if (wrongDomain.payload.activation !== "planned_rollover") throw new Error();
    wrongDomain.payload.predecessorCrossSignature =
      ProviderRegistryRootCrossSignatureV1Schema.parse(
        `provider-root-cross-ed25519:${bootstrap.rootKeyId}:${signatureHex(
          bootstrapPair,
          canonicalizeJcsSafeIntegerUtf8V1(["wrong-domain", {}]),
        )}`,
      );
    const wrongDomainEnvelope = resignPayload(wrongDomain, wrongDomain.payload);
    await expect(
      validateProviderRegistryRootMetadataHistoryV1(
        request([bootstrap, wrongDomainEnvelope]),
      ),
    ).rejects.toBeInstanceOf(ProviderRegistryRootHistoryValidationError);

    const wrongSigner = successorEnvelope(
      bootstrap,
      bootstrapPair,
      plannedPair,
      recoveryRecords,
      {
        activation: "planned_rollover",
        crossSigningPair: outsiderPair,
      },
    );
    await expect(
      validateProviderRegistryRootMetadataHistoryV1(
        request([bootstrap, wrongSigner]),
      ),
    ).rejects.toBeInstanceOf(ProviderRegistryRootHistoryValidationError);
  });

  it("rejects invalid recovery quorum membership and wire order", async () => {
    const outsiderRecovery: RecoveryRecord = {
      pair: outsiderPair,
      key: recoveryPublicKey(outsiderPair),
    };
    const wrongQuorum = successorEnvelope(
      bootstrap,
      bootstrapPair,
      plannedPair,
      recoveryRecords,
      {
        activation: "planned_rollover",
        recoveryRecords: [recoveryRecords[0]!, outsiderRecovery],
      },
    );
    await expect(
      validateProviderRegistryRootMetadataHistoryV1(
        request([bootstrap, wrongQuorum]),
      ),
    ).rejects.toBeInstanceOf(ProviderRegistryRootHistoryValidationError);

    const planned = successorEnvelope(
      bootstrap,
      bootstrapPair,
      plannedPair,
      recoveryRecords,
      { activation: "planned_rollover" },
    );
    const reversed = clone(planned);
    reversed.payload.recoverySignatures.reverse();
    const reversedEnvelope = resignPayload(reversed, reversed.payload);
    await expect(
      validateProviderRegistryRootMetadataHistoryV1(
        request([bootstrap, reversedEnvelope]),
      ),
    ).rejects.toBeInstanceOf(ProviderRegistryRootHistoryValidationError);
  });

  it("rejects generation gaps and non-exact predecessor pins", async () => {
    const gap = successorEnvelope(
      bootstrap,
      bootstrapPair,
      plannedPair,
      recoveryRecords,
      { activation: "planned_rollover", generation: 3 },
    );
    await expect(
      validateProviderRegistryRootMetadataHistoryV1(request([bootstrap, gap])),
    ).rejects.toBeInstanceOf(ProviderRegistryRootHistoryValidationError);

    const badPredecessor = successorEnvelope(
      bootstrap,
      bootstrapPair,
      plannedPair,
      recoveryRecords,
      {
        activation: "planned_rollover",
        predecessorPin: {
          rootGeneration: bootstrap.rootGeneration,
          rootKeyId: bootstrap.rootKeyId,
          contentDigest: `sha256:${"0".repeat(64)}`,
        },
      },
    );
    await expect(
      validateProviderRegistryRootMetadataHistoryV1(
        request([bootstrap, badPredecessor]),
      ),
    ).rejects.toBeInstanceOf(ProviderRegistryRootHistoryValidationError);
  });

  it("rejects new root material aliased to historical root or recovery material", async () => {
    const historicalAlias = successorEnvelope(
      bootstrap,
      bootstrapPair,
      bootstrapPair,
      recoveryRecords,
      { activation: "planned_rollover" },
    );
    await expect(
      validateProviderRegistryRootMetadataHistoryV1(
        request([bootstrap, historicalAlias]),
      ),
    ).rejects.toBeInstanceOf(ProviderRegistryRootHistoryValidationError);

    const recoveryAlias = successorEnvelope(
      bootstrap,
      bootstrapPair,
      recoveryRecords[0]!.pair,
      recoveryRecords,
      { activation: "planned_rollover" },
    );
    await expect(
      validateProviderRegistryRootMetadataHistoryV1(
        request([bootstrap, recoveryAlias]),
      ),
    ).rejects.toBeInstanceOf(ProviderRegistryRootHistoryValidationError);
  });

  it("rejects a 257-generation candidate before cryptographic history traversal", async () => {
    const oversized = Array.from({ length: 257 }, () => clone(bootstrap));
    await expect(
      validateProviderRegistryRootMetadataHistoryV1(request(oversized)),
    ).rejects.toBeInstanceOf(ProviderRegistryRootHistoryValidationError);

    const ownKeys = vi.fn(() => Reflect.ownKeys(oversized));
    const oversizedProxy = new Proxy(oversized, { ownKeys });
    const diagnostic =
      await diagnoseProviderRegistryRootMetadataHistoryInternalV1(
        request(oversizedProxy),
      );
    expect(diagnostic).toEqual({
      ok: false,
      stage: "history_limit",
      reason: "history_generation_limit_exceeded",
    });
    expect(ownKeys).not.toHaveBeenCalled();
  });

  it("classifies a raw envelope above 4 MiB before strict schema parsing", async () => {
    const oversizedRawEnvelope = {
      ...clone(bootstrap),
      padding: "x".repeat(4_194_304),
    };
    const diagnostic =
      await diagnoseProviderRegistryRootMetadataHistoryInternalV1({
        ...request([]),
        rootMetadataHistory: [oversizedRawEnvelope],
      });
    expect(diagnostic).toEqual({
      ok: false,
      stage: "history_limit",
      reason: "envelope_byte_limit_exceeded",
    });
    await expect(
      validateProviderRegistryRootMetadataHistoryV1({
        ...request([]),
        rootMetadataHistory: [oversizedRawEnvelope],
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: "ProviderRegistryRootHistoryValidationError",
        code: "provider_unavailable",
        reason: "attestation_invalid",
        message: "Provider registry root metadata history validation failed",
      }),
    );
  });

  it("rejects compromise recovery carrying a cross field and never invokes hostile getters", async () => {
    const compromise = successorEnvelope(
      bootstrap,
      bootstrapPair,
      compromisePair,
      recoveryRecords,
      { activation: "compromise_recovery" },
    );
    const withCross = {
      ...compromise,
      payload: {
        ...compromise.payload,
        predecessorCrossSignature: zeroSignature(
          "provider-root-cross-ed25519",
          bootstrap.rootKeyId,
        ),
      },
    };
    await expect(
      validateProviderRegistryRootMetadataHistoryV1(
        request([bootstrap, withCross as never]),
      ),
    ).rejects.toBeInstanceOf(ProviderRegistryRootHistoryValidationError);

    const getter = vi.fn(() => [bootstrap]);
    const hostile = {
      bootstrapTrustBundle: bootstrapBundle,
      strictCryptoCapability: capability,
    } as Record<string, unknown>;
    Object.defineProperty(hostile, "rootMetadataHistory", {
      enumerable: true,
      get: getter,
    });
    await expect(
      validateProviderRegistryRootMetadataHistoryV1(hostile),
    ).rejects.toBeInstanceOf(ProviderRegistryRootHistoryValidationError);
    expect(getter).not.toHaveBeenCalled();
  });

  it("validates one immutable descriptor snapshot instead of rereading a hostile history proxy", async () => {
    const indexedGet = vi.fn(() => bootstrap);
    const hostileHistory = new Proxy([bootstrap], {
      get(target, property, receiver) {
        if (property === "0") return indexedGet();
        return Reflect.get(target, property, receiver);
      },
      getOwnPropertyDescriptor(target, property) {
        if (property === "0") {
          return {
            configurable: true,
            enumerable: true,
            writable: true,
            value: {},
          };
        }
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });

    const diagnostic =
      await diagnoseProviderRegistryRootMetadataHistoryInternalV1(
        request(hostileHistory as never),
      );
    expect(diagnostic).toEqual({
      ok: false,
      stage: "root_metadata_envelope",
      reason: "schema_invalid",
    });
    expect(indexedGet).not.toHaveBeenCalled();

    const alternatingGet = vi
      .fn()
      .mockReturnValueOnce({})
      .mockReturnValue(bootstrap);
    const stableDescriptorHistory = new Proxy([bootstrap], {
      get(target, property, receiver) {
        if (property === "0") return alternatingGet();
        return Reflect.get(target, property, receiver);
      },
    });
    const validation =
      await validateProviderRegistryRootMetadataHistoryV1(
        request(stableDescriptorHistory),
      );
    expect(validation.retainedRootMetadataCanonicalBytes).toBe(
      canonicalizeJcsSafeIntegerUtf8V1(bootstrap).byteLength,
    );
    expect(validation.rootMetadataHistory[0]).toEqual(bootstrap);
    expect(alternatingGet).not.toHaveBeenCalled();
  });

  it("classifies thrown crypto-host failures at the exact point or signature stage", async () => {
    let throwPoint = false;
    let signatureCalls = 0;
    let throwSignatureAt = Number.POSITIVE_INFINITY;
    const throwingCapability =
      await attestProviderStrictEd25519CryptoHostV1({
        host: {
          verificationProfile:
            STRICT_ED25519_VERIFICATION_PROFILE_V1,
          validatePrimeSubgroupPoint(point) {
            if (throwPoint) throw new Error("point host failure");
            return validatePrimeSubgroupPoint(point);
          },
          verifyRawEd25519(publicKey, message, signature) {
            signatureCalls += 1;
            if (signatureCalls === throwSignatureAt) {
              throw new Error("signature host failure");
            }
            return verifyRawEd25519(
              publicKey,
              message,
              signature,
            );
          },
        },
        resourceHost: {
          readFixedSignedPackageResource() {
            return strictManifestBytes.slice();
          },
        },
      });
    const planned = successorEnvelope(
      bootstrap,
      bootstrapPair,
      plannedPair,
      recoveryRecords,
      { activation: "planned_rollover" },
    );
    const throwingRequest = {
      ...request([bootstrap, planned]),
      strictCryptoCapability: throwingCapability,
    };

    throwPoint = true;
    expect(
      await diagnoseProviderRegistryRootMetadataHistoryInternalV1(
        throwingRequest,
      ),
    ).toEqual({
      ok: false,
      stage: "root_key_admission",
      reason: "point_admission_failed",
    });

    throwPoint = false;
    signatureCalls = 0;
    throwSignatureAt = 5;
    expect(
      await diagnoseProviderRegistryRootMetadataHistoryInternalV1(
        throwingRequest,
      ),
    ).toEqual({
      ok: false,
      stage: "root_recovery_signature",
      reason: "recovery_quorum_invalid",
    });
  });
});
