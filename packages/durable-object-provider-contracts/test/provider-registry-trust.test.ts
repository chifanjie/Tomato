import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  type KeyObject,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  ProviderBootstrapTrustGoldenManifestV1Schema,
} from "../src/bootstrap-trust-golden.js";
import type { ProviderCryptoHostV1 } from "../src/domain-crypto.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "../src/jcs.js";
import { deriveProviderRegistryRootKeyIdV1 } from "../src/provider-foundation.js";
import {
  PROVIDER_REGISTRY_RECOVERY_KEY_ID_DOMAIN_V1,
  PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1,
  PROVIDER_REGISTRY_ROOT_METADATA_DOMAIN_V1,
  PROVIDER_REGISTRY_ROOT_RECOVERY_SIGNATURE_DOMAIN_V1,
  PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
  ProviderRegistryRecoveryKeyIdV1Schema,
  ProviderRegistryRecoveryPublicKeyV1Schema,
  ProviderRegistryRootCrossSignatureV1Schema,
  ProviderRegistryRootMetadataEnvelopeV1Schema,
  ProviderRegistryRootMetadataPinV1Schema,
  ProviderRegistryRootMetadataV1Schema,
  ProviderRegistryRootPublicKeyV1Schema,
  ProviderRegistryRootRecoverySignatureV1Schema,
  ProviderRegistryRootSelfSignatureV1Schema,
  createProviderRegistryRootSelfSignatureMessageV1,
  deriveProviderEd25519PublicKeyDigestInternalV1,
  deriveProviderRegistryRecoveryKeyIdInternalV1,
  deriveProviderRegistryRootKeyIdInternalV1,
  deriveProviderRegistryRootMetadataContentDigestV1,
  projectProviderRegistryRootMetadataUnsignedClaimsV1,
  validateProviderRegistryRecoveryPublicKeyV1,
  validateProviderRegistryRootMetadataEnvelopeStructureV1,
  validateProviderRegistryRootPublicKeyV1,
  verifyProviderRegistryBootstrapRootSelfSignatureV1,
  verifyProviderRegistryRootSelfSignatureV1,
  type ProviderRegistryRecoveryPublicKeyV1,
  type ProviderRegistryRootMetadataEnvelopeV1,
  type ProviderRegistryRootMetadataV1,
  type ProviderRegistryRootPublicKeyV1,
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

const strictManifestResourceBytes = new Uint8Array(
  readFileSync(
    fileURLToPath(
      new URL(
        "../provider/ed25519-strict-host-conformance-v1.json",
        import.meta.url,
      ),
    ),
  ),
);
const bootstrapGolden =
  ProviderBootstrapTrustGoldenManifestV1Schema.parse(
    JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL(
            "../fixtures/v1/golden/provider-bootstrap-structure-crypto-v1.json",
            import.meta.url,
          ),
        ),
        "utf8",
      ),
    ),
  );
const deterministicRootSelfSignatureVector =
  bootstrapGolden.vectors.deterministicRootSelfSignatureSigning;

const nodeCryptoHost: ProviderCryptoHostV1 = Object.freeze({
  sha256(message: Uint8Array) {
    return new Uint8Array(createHash("sha256").update(message).digest());
  },
  hmacSha256() {
    throw new Error("unused");
  },
});

interface DeterministicEd25519KeyPair {
  readonly privateKey: KeyObject;
  readonly rawPublicKey: Uint8Array;
  readonly publicKeyBytes: `base64url:${string}`;
}

function deterministicEd25519KeyPair(seedByte: number): DeterministicEd25519KeyPair {
  const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const seed = Buffer.alloc(32, seedByte);
  const privateKey = createPrivateKey({
    key: Buffer.concat([pkcs8Prefix, seed]),
    format: "der",
    type: "pkcs8",
  });
  const spki = createPublicKey(privateKey).export({
    format: "der",
    type: "spki",
  });
  const rawPublicKey = new Uint8Array(spki.subarray(spki.byteLength - 32));
  return {
    privateKey,
    rawPublicKey,
    publicKeyBytes: `base64url:${Buffer.from(rawPublicKey).toString("base64url")}`,
  };
}

function rootPublicKey(
  keyPair: DeterministicEd25519KeyPair,
): ProviderRegistryRootPublicKeyV1 {
  return ProviderRegistryRootPublicKeyV1Schema.parse({
    profile: "provider_registry_root_public_key_v1",
    rootKeyId: deriveProviderRegistryRootKeyIdInternalV1({
      publicKeyBytes: keyPair.publicKeyBytes,
    }),
    algorithm: "ed25519",
    publicKeyBytes: keyPair.publicKeyBytes,
    publicKeyDigest: deriveProviderEd25519PublicKeyDigestInternalV1(
      keyPair.publicKeyBytes,
    ),
  });
}

function recoveryPublicKey(
  keyPair: DeterministicEd25519KeyPair,
): ProviderRegistryRecoveryPublicKeyV1 {
  return ProviderRegistryRecoveryPublicKeyV1Schema.parse({
    profile: "provider_registry_recovery_public_key_v1",
    recoveryKeyId: deriveProviderRegistryRecoveryKeyIdInternalV1({
      publicKeyBytes: keyPair.publicKeyBytes,
    }),
    algorithm: "ed25519",
    publicKeyBytes: keyPair.publicKeyBytes,
    publicKeyDigest: deriveProviderEd25519PublicKeyDigestInternalV1(
      keyPair.publicKeyBytes,
    ),
  });
}

function signatureHex(privateKey: KeyObject, message: Uint8Array): string {
  return sign(null, Buffer.from(message), privateKey).toString("hex");
}

function zeroRootSelfSignature(rootKeyId: string): string {
  return `provider-root-self-ed25519:${rootKeyId}:${"0".repeat(128)}`;
}

function mutateSignature(signature: string): string {
  const replacement = signature.endsWith("0") ? "1" : "0";
  return `${signature.slice(0, -1)}${replacement}`;
}

function signedBootstrapEnvelope(
  keyPair: DeterministicEd25519KeyPair,
  activeRoot: ProviderRegistryRootPublicKeyV1,
): ProviderRegistryRootMetadataEnvelopeV1 {
  const unsignedCarrier = ProviderRegistryRootMetadataV1Schema.parse({
    profile: "provider_registry_root_metadata_v1",
    rootGeneration: 1,
    activeRoot,
    issuedAt: "2026-08-02T00:00:00Z",
    selfSignature: zeroRootSelfSignature(activeRoot.rootKeyId),
    activation: "bootstrap",
    predecessor: { state: "genesis" },
    recoverySignatures: [],
  });
  const signature = ProviderRegistryRootSelfSignatureV1Schema.parse(
    `provider-root-self-ed25519:${activeRoot.rootKeyId}:${signatureHex(
      keyPair.privateKey,
      createProviderRegistryRootSelfSignatureMessageV1(unsignedCarrier),
    )}`,
  );
  const payload = ProviderRegistryRootMetadataV1Schema.parse({
    ...unsignedCarrier,
    selfSignature: signature,
  });
  return ProviderRegistryRootMetadataEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_registry_root_metadata",
    rootGeneration: payload.rootGeneration,
    rootKeyId: payload.activeRoot.rootKeyId,
    contentDigest: deriveProviderRegistryRootMetadataContentDigestV1(payload),
    payload,
  });
}

function recoverySignature(recoveryKeyId: string, fill: string): string {
  return `provider-root-recovery-ed25519:${recoveryKeyId}:${fill.repeat(128)}`;
}

const rootKeyPair = deterministicEd25519KeyPair(1);
const predecessorKeyPair = deterministicEd25519KeyPair(2);
const recoveryKeyPairs = [
  deterministicEd25519KeyPair(3),
  deterministicEd25519KeyPair(4),
  deterministicEd25519KeyPair(5),
] as const;
const root = rootPublicKey(rootKeyPair);
const predecessorRoot = rootPublicKey(predecessorKeyPair);
const recoveryKeys = recoveryKeyPairs.map(recoveryPublicKey).sort((left, right) =>
  left.recoveryKeyId.localeCompare(right.recoveryKeyId),
);
const bootstrapEnvelope = signedBootstrapEnvelope(rootKeyPair, root);
const recoverySignatures = [
  recoverySignature(recoveryKeys[0]!.recoveryKeyId, "1"),
  recoverySignature(recoveryKeys[1]!.recoveryKeyId, "2"),
] as const;
const plannedMetadata = ProviderRegistryRootMetadataV1Schema.parse({
  ...bootstrapEnvelope.payload,
  rootGeneration: 2,
  activation: "planned_rollover",
  predecessor: {
    state: "root_metadata",
    rootGeneration: 1,
    rootKeyId: predecessorRoot.rootKeyId,
    contentDigest: `sha256:${"3".repeat(64)}`,
  },
  predecessorCrossSignature:
    `provider-root-cross-ed25519:${predecessorRoot.rootKeyId}:${"4".repeat(128)}`,
  recoverySignatures,
}) as Extract<
  ProviderRegistryRootMetadataV1,
  { activation: "planned_rollover" }
>;
const compromiseMetadata = ProviderRegistryRootMetadataV1Schema.parse({
  profile: plannedMetadata.profile,
  rootGeneration: plannedMetadata.rootGeneration,
  activeRoot: plannedMetadata.activeRoot,
  issuedAt: plannedMetadata.issuedAt,
  selfSignature: plannedMetadata.selfSignature,
  activation: "compromise_recovery",
  predecessor: plannedMetadata.predecessor,
  recoverySignatures: plannedMetadata.recoverySignatures,
}) as Extract<
  ProviderRegistryRootMetadataV1,
  { activation: "compromise_recovery" }
>;

const pointSpy = vi.fn(validatePrimeSubgroupPoint);
const verifySpy = vi.fn(verifyRawEd25519);
let strictCapability: ProviderStrictEd25519OpaqueCapabilityV1;

beforeAll(async () => {
  strictCapability = await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint: pointSpy,
      verifyRawEd25519: verifySpy,
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(
        resourcePath: typeof PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
        maxBytes: typeof PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
      ) {
        if (
          resourcePath !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
          maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
        ) {
          throw new Error("unexpected strict resource request");
        }
        return strictManifestResourceBytes;
      },
    }),
  });
});

describe("provider registry key identities and raw digests", () => {
  it("keeps root ID compatibility while separating recovery ID and raw digest domains", async () => {
    const legacyPublicKey =
      "base64url:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";
    const rootKeyId = deriveProviderRegistryRootKeyIdInternalV1({
      publicKeyBytes: legacyPublicKey,
    });
    expect(rootKeyId).toBe("6e88eeded5ad931d6d2eba");
    await expect(
      deriveProviderRegistryRootKeyIdV1(
        { publicKeyBytes: legacyPublicKey },
        nodeCryptoHost,
      ),
    ).resolves.toBe(rootKeyId);

    const recoveryKeyId = deriveProviderRegistryRecoveryKeyIdInternalV1({
      publicKeyBytes: legacyPublicKey,
    });
    const independentRecoveryDigest = createHash("sha256")
      .update(
        canonicalizeJcsSafeIntegerUtf8V1([
          PROVIDER_REGISTRY_RECOVERY_KEY_ID_DOMAIN_V1,
          { publicKeyBytes: legacyPublicKey },
        ]),
      )
      .digest("hex")
      .slice(0, 22);
    expect(recoveryKeyId).toBe(independentRecoveryDigest);
    expect(recoveryKeyId).not.toBe(rootKeyId);
    expect(ProviderRegistryRecoveryKeyIdV1Schema.parse(recoveryKeyId)).toBe(
      recoveryKeyId,
    );

    expect(deriveProviderEd25519PublicKeyDigestInternalV1(legacyPublicKey)).toBe(
      "sha256:630dcd2966c4336691125448bbb25b4ff412a49c732db2c8abc1b8581bd710dd",
    );
    expect(
      createHash("sha256").update(legacyPublicKey, "utf8").digest("hex"),
    ).not.toBe(
      deriveProviderEd25519PublicKeyDigestInternalV1(legacyPublicKey).slice(
        "sha256:".length,
      ),
    );
  });

  it("validates semantic key material instead of trusting same-shaped brands", () => {
    expect(validateProviderRegistryRootPublicKeyV1(root)).toEqual(root);
    expect(validateProviderRegistryRecoveryPublicKeyV1(recoveryKeys[0])).toEqual(
      recoveryKeys[0],
    );

    expect(() =>
      validateProviderRegistryRootPublicKeyV1({
        ...root,
        rootKeyId: recoveryKeys[0]!.recoveryKeyId,
      }),
    ).toThrow(/material mismatch/u);
    expect(() =>
      validateProviderRegistryRecoveryPublicKeyV1({
        ...recoveryKeys[0]!,
        publicKeyDigest: root.publicKeyDigest,
      }),
    ).toThrow(/material mismatch/u);
  });

  it("rejects field injection and accessors before key-ID hashing", () => {
    expect(() =>
      deriveProviderRegistryRecoveryKeyIdInternalV1({
        publicKeyBytes: root.publicKeyBytes,
        domain: PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
      }),
    ).toThrow();

    let getterInvoked = false;
    const fields = Object.defineProperty({}, "publicKeyBytes", {
      enumerable: true,
      get() {
        getterInvoked = true;
        return root.publicKeyBytes;
      },
    });
    expect(() => deriveProviderRegistryRootKeyIdInternalV1(fields)).toThrow(
      /data property/u,
    );
    expect(getterInvoked).toBe(false);
  });
});

describe("registry root signature wires and metadata schemas", () => {
  it("brands self, cross, and recovery wires with closed prefixes and lengths", () => {
    const self = zeroRootSelfSignature(root.rootKeyId);
    const cross =
      `provider-root-cross-ed25519:${root.rootKeyId}:${"1".repeat(128)}`;
    const recovery = recoverySignature(recoveryKeys[0]!.recoveryKeyId, "2");
    expect(ProviderRegistryRootSelfSignatureV1Schema.parse(self)).toBe(self);
    expect(ProviderRegistryRootCrossSignatureV1Schema.parse(cross)).toBe(cross);
    expect(ProviderRegistryRootRecoverySignatureV1Schema.parse(recovery)).toBe(
      recovery,
    );
    for (const invalid of [
      cross,
      self.toUpperCase(),
      `${self}0`,
      self.slice(0, -1),
      self.replace(root.rootKeyId, root.rootKeyId.slice(1)),
    ]) {
      expect(ProviderRegistryRootSelfSignatureV1Schema.safeParse(invalid).success).toBe(
        false,
      );
    }
    expect(PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1).not.toBe(
      PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
    );
    expect(PROVIDER_REGISTRY_ROOT_RECOVERY_SIGNATURE_DOMAIN_V1).not.toBe(
      PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
    );
  });

  it("accepts the three exact metadata branches and rejects conditional leakage", () => {
    expect(
      ProviderRegistryRootMetadataV1Schema.parse(bootstrapEnvelope.payload)
        .activation,
    ).toBe("bootstrap");
    expect(
      ProviderRegistryRootMetadataV1Schema.parse(plannedMetadata).activation,
    ).toBe("planned_rollover");
    expect(
      ProviderRegistryRootMetadataV1Schema.parse(compromiseMetadata).activation,
    ).toBe("compromise_recovery");

    expect(
      ProviderRegistryRootMetadataV1Schema.safeParse({
        ...bootstrapEnvelope.payload,
        predecessorCrossSignature:
          plannedMetadata.predecessorCrossSignature,
      }).success,
    ).toBe(false);
    const plannedWithoutCross = structuredClone(plannedMetadata) as Record<
      string,
      unknown
    >;
    delete plannedWithoutCross.predecessorCrossSignature;
    expect(
      ProviderRegistryRootMetadataV1Schema.safeParse(plannedWithoutCross).success,
    ).toBe(false);
    expect(
      ProviderRegistryRootMetadataV1Schema.safeParse({
        ...compromiseMetadata,
        predecessorCrossSignature:
          plannedMetadata.predecessorCrossSignature,
      }).success,
    ).toBe(false);
    expect(
      ProviderRegistryRootMetadataV1Schema.safeParse({
        ...plannedMetadata,
        recoverySignatures: [plannedMetadata.recoverySignatures[0]],
      }).success,
    ).toBe(false);
    expect(
      ProviderRegistryRootMetadataV1Schema.safeParse({
        ...plannedMetadata,
        recoverySignatures: [
          ...plannedMetadata.recoverySignatures,
          plannedMetadata.recoverySignatures[0],
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects invalid dates, unsafe generations, extra fields, and loose pins", () => {
    expect(
      ProviderRegistryRootMetadataV1Schema.safeParse({
        ...bootstrapEnvelope.payload,
        issuedAt: "2026-02-30T00:00:00Z",
      }).success,
    ).toBe(false);
    expect(
      ProviderRegistryRootMetadataV1Schema.safeParse({
        ...bootstrapEnvelope.payload,
        rootGeneration: Number.MAX_SAFE_INTEGER + 1,
      }).success,
    ).toBe(false);
    expect(
      ProviderRegistryRootMetadataEnvelopeV1Schema.safeParse({
        ...bootstrapEnvelope,
        unexpected: true,
      }).success,
    ).toBe(false);

    const pin = {
      locatorProfile: "installation_provider_registry_root_metadata_v1",
      rootGeneration: bootstrapEnvelope.rootGeneration,
      rootKeyId: bootstrapEnvelope.rootKeyId,
      contentDigest: bootstrapEnvelope.contentDigest,
    };
    expect(ProviderRegistryRootMetadataPinV1Schema.parse(pin)).toEqual(pin);
    expect(
      ProviderRegistryRootMetadataPinV1Schema.safeParse({ ...pin, path: "/tmp" })
        .success,
    ).toBe(false);
  });
});

describe("root metadata digest, projection, and envelope closure", () => {
  it("projects every signature field out without mutating bootstrap or rollover records", () => {
    const bootstrapProjection =
      projectProviderRegistryRootMetadataUnsignedClaimsV1(
        bootstrapEnvelope.payload,
      );
    expect(bootstrapProjection).toEqual({
      profile: "provider_registry_root_metadata_v1",
      rootGeneration: 1,
      activeRoot: root,
      issuedAt: "2026-08-02T00:00:00Z",
      activation: "bootstrap",
      predecessor: { state: "genesis" },
    });
    expect("selfSignature" in bootstrapProjection).toBe(false);
    expect("recoverySignatures" in bootstrapProjection).toBe(false);
    expect(bootstrapEnvelope.payload.recoverySignatures).toEqual([]);

    const plannedProjection =
      projectProviderRegistryRootMetadataUnsignedClaimsV1(plannedMetadata);
    expect("selfSignature" in plannedProjection).toBe(false);
    expect("predecessorCrossSignature" in plannedProjection).toBe(false);
    expect("recoverySignatures" in plannedProjection).toBe(false);
    expect(plannedProjection.predecessor).toEqual(plannedMetadata.predecessor);
  });

  it("builds the exact signer-identity wrapper and no-newline canonical message", () => {
    expect(bootstrapEnvelope.payload).toEqual(
      deterministicRootSelfSignatureVector.fields,
    );
    const expected = new Uint8Array(
      Buffer.from(
        deterministicRootSelfSignatureVector.expected
          .canonicalMessageUtf8Hex,
        "hex",
      ),
    );
    const actual = createProviderRegistryRootSelfSignatureMessageV1(
      bootstrapEnvelope.payload,
    );
    expect(actual).toEqual(expected);
    expect(bootstrapEnvelope.payload.selfSignature).toBe(
      deterministicRootSelfSignatureVector.expected.signature,
    );
    const decoded = new TextDecoder().decode(actual);
    expect(decoded.startsWith('["provider-registry-root-self-signature-v1",')).toBe(
      true,
    );
    expect(decoded).toContain(`"rootKeyId":"${root.rootKeyId}"`);
    expect(decoded.endsWith("\n")).toBe(false);
  });

  it("hashes the complete signed metadata record and closes outer fields", () => {
    const independentDigest = `sha256:${createHash("sha256")
      .update(
        canonicalizeJcsSafeIntegerUtf8V1([
          PROVIDER_REGISTRY_ROOT_METADATA_DOMAIN_V1,
          bootstrapEnvelope.payload,
        ]),
      )
      .digest("hex")}`;
    expect(
      deriveProviderRegistryRootMetadataContentDigestV1(
        bootstrapEnvelope.payload,
      ),
    ).toBe(independentDigest);
    expect(validateProviderRegistryRootMetadataEnvelopeStructureV1(bootstrapEnvelope)).toEqual(
      bootstrapEnvelope,
    );

    const changedSignature = ProviderRegistryRootMetadataV1Schema.parse({
      ...bootstrapEnvelope.payload,
      selfSignature: mutateSignature(bootstrapEnvelope.payload.selfSignature),
    });
    expect(
      deriveProviderRegistryRootMetadataContentDigestV1(changedSignature),
    ).not.toBe(bootstrapEnvelope.contentDigest);

    for (const invalid of [
      { ...bootstrapEnvelope, rootGeneration: 2 },
      { ...bootstrapEnvelope, rootKeyId: predecessorRoot.rootKeyId },
      { ...bootstrapEnvelope, contentDigest: `sha256:${"0".repeat(64)}` },
    ]) {
      expect(() => validateProviderRegistryRootMetadataEnvelopeStructureV1(invalid)).toThrow(
        /envelope mismatch/u,
      );
    }
  });

  it("rejects mismatched cross signers and unordered recovery signer IDs", () => {
    const plannedEnvelope = {
      schemaVersion: 1,
      recordType: "provider_registry_root_metadata",
      rootGeneration: plannedMetadata.rootGeneration,
      rootKeyId: plannedMetadata.activeRoot.rootKeyId,
      contentDigest:
        deriveProviderRegistryRootMetadataContentDigestV1(plannedMetadata),
      payload: plannedMetadata,
    };
    expect(validateProviderRegistryRootMetadataEnvelopeStructureV1(plannedEnvelope)).toEqual(
      plannedEnvelope,
    );

    const wrongCrossPayload = ProviderRegistryRootMetadataV1Schema.parse({
      ...plannedMetadata,
      predecessorCrossSignature:
        `provider-root-cross-ed25519:${root.rootKeyId}:${"4".repeat(128)}`,
    });
    expect(() =>
      validateProviderRegistryRootMetadataEnvelopeStructureV1({
        ...plannedEnvelope,
        contentDigest:
          deriveProviderRegistryRootMetadataContentDigestV1(wrongCrossPayload),
        payload: wrongCrossPayload,
      }),
    ).toThrow(/predecessor signature/u);

    const reversedPayload = ProviderRegistryRootMetadataV1Schema.parse({
      ...plannedMetadata,
      recoverySignatures: [...plannedMetadata.recoverySignatures].reverse(),
    });
    expect(() =>
      validateProviderRegistryRootMetadataEnvelopeStructureV1({
        ...plannedEnvelope,
        contentDigest:
          deriveProviderRegistryRootMetadataContentDigestV1(reversedPayload),
        payload: reversedPayload,
      }),
    ).toThrow(/ordered/u);
  });
});

describe("strict bootstrap root self-signature verification", () => {
  it("uses the attested point and raw-signature methods exactly once", async () => {
    pointSpy.mockClear();
    verifySpy.mockClear();
    await expect(
      verifyProviderRegistryBootstrapRootSelfSignatureV1(
        bootstrapEnvelope,
        strictCapability,
      ),
    ).resolves.toBe(true);
    expect(pointSpy).toHaveBeenCalledTimes(1);
    expect(pointSpy.mock.calls[0]?.[0]).toEqual(rootKeyPair.rawPublicKey);
    expect(verifySpy).toHaveBeenCalledTimes(1);
    expect(verifySpy.mock.calls[0]?.[0]).toEqual(rootKeyPair.rawPublicKey);
    expect(verifySpy.mock.calls[0]?.[1]).toEqual(
      createProviderRegistryRootSelfSignatureMessageV1(
        bootstrapEnvelope.payload,
      ),
    );
  });

  it("rejects prefix, signature, domain, and message-shape substitutions", async () => {
    const claims = projectProviderRegistryRootMetadataUnsignedClaimsV1(
      bootstrapEnvelope.payload,
    );
    const substitutedMessages = [
      canonicalizeJcsSafeIntegerUtf8V1([
        PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1,
        {
          rootKeyId: root.rootKeyId,
          domain: PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1,
          claims,
        },
      ]),
      canonicalizeJcsSafeIntegerUtf8V1([
        PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
        claims,
      ]),
      canonicalizeJcsSafeIntegerUtf8V1({
        rootKeyId: root.rootKeyId,
        domain: PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
        claims,
      }),
    ];

    const invalidPayloads: ProviderRegistryRootMetadataV1[] = [
      ProviderRegistryRootMetadataV1Schema.parse({
        ...bootstrapEnvelope.payload,
        selfSignature: mutateSignature(bootstrapEnvelope.payload.selfSignature),
      }),
      ProviderRegistryRootMetadataV1Schema.parse({
        ...bootstrapEnvelope.payload,
        selfSignature:
          `provider-root-self-ed25519:${predecessorRoot.rootKeyId}:${bootstrapEnvelope.payload.selfSignature.slice(-128)}`,
      }),
      ...substitutedMessages.map((message) =>
        ProviderRegistryRootMetadataV1Schema.parse({
          ...bootstrapEnvelope.payload,
          selfSignature:
            `provider-root-self-ed25519:${root.rootKeyId}:${signatureHex(rootKeyPair.privateKey, message)}`,
        }),
      ),
    ];
    for (const payload of invalidPayloads) {
      await expect(
        verifyProviderRegistryRootSelfSignatureV1(payload, strictCapability),
      ).resolves.toBe(false);
    }
  });

  it("requires a closed generation-one bootstrap Envelope", async () => {
    const plannedEnvelope = {
      schemaVersion: 1,
      recordType: "provider_registry_root_metadata",
      rootGeneration: plannedMetadata.rootGeneration,
      rootKeyId: plannedMetadata.activeRoot.rootKeyId,
      contentDigest:
        deriveProviderRegistryRootMetadataContentDigestV1(plannedMetadata),
      payload: plannedMetadata,
    };
    await expect(
      verifyProviderRegistryBootstrapRootSelfSignatureV1(
        plannedEnvelope,
        strictCapability,
      ),
    ).resolves.toBe(false);
    await expect(
      verifyProviderRegistryBootstrapRootSelfSignatureV1(
        { ...bootstrapEnvelope, payload: undefined },
        strictCapability,
      ),
    ).resolves.toBe(false);
    await expect(
      verifyProviderRegistryBootstrapRootSelfSignatureV1(
        {
          ...bootstrapEnvelope,
          contentDigest: `sha256:${"f".repeat(64)}`,
        },
        strictCapability,
      ),
    ).resolves.toBe(false);
  });
});
