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
  PROVIDER_BOOTSTRAP_TRUST_BUNDLE_DOMAIN_V1,
  PROVIDER_BOOTSTRAP_TRUST_BUNDLE_MAX_BYTES_V1,
  ProviderBootstrapTrustBundleEnvelopeV1Schema,
  ProviderBootstrapTrustStructureError,
  createProviderBootstrapTrustBundlePinV1,
  deriveProviderBootstrapTrustBundleContentDigestV1,
  validateProviderBootstrapTrustBundleStructureV1,
  type ProviderBootstrapTrustBundleEnvelopeV1,
  type ValidateProviderBootstrapTrustBundleStructureV1Input,
} from "../src/bootstrap-trust-bundle.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "../src/jcs.js";
import { ProviderBootstrapTrustBundlePinV1Schema } from "../src/provider-distribution-trust.js";
import {
  ProviderRegistryRecoveryPublicKeyV1Schema,
  ProviderRegistryRootMetadataEnvelopeV1Schema,
  ProviderRegistryRootMetadataV1Schema,
  ProviderRegistryRootPublicKeyV1Schema,
  ProviderRegistryRootSelfSignatureV1Schema,
  createProviderRegistryRootSelfSignatureMessageV1,
  deriveProviderEd25519PublicKeyDigestInternalV1,
  deriveProviderRegistryRecoveryKeyIdInternalV1,
  deriveProviderRegistryRootKeyIdInternalV1,
  deriveProviderRegistryRootMetadataContentDigestV1,
  type ProviderRegistryRecoveryPublicKeyV1,
  type ProviderRegistryRootMetadataEnvelopeV1,
  type ProviderRegistryRootPublicKeyV1,
} from "../src/provider-registry-trust.js";
import { PROVIDER_TRUST_HISTORY_POLICY_V1 } from "../src/provider-trust-policy.js";
import {
  PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_DOMAIN_V1,
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

const strictManifestEnvelopeBytes = new Uint8Array(
  readFileSync(
    fileURLToPath(
      new URL(
        "../provider/ed25519-strict-host-conformance-v1.json",
        import.meta.url,
      ),
    ),
  ),
);

interface DeterministicEd25519KeyPair {
  readonly privateKey: KeyObject;
  readonly rawPublicKey: Uint8Array;
  readonly publicKeyBytes: `base64url:${string}`;
}

function deterministicEd25519KeyPair(seedByte: number): DeterministicEd25519KeyPair {
  const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const privateKey = createPrivateKey({
    key: Buffer.concat([pkcs8Prefix, Buffer.alloc(32, seedByte)]),
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

function signRootMetadata(
  keyPair: DeterministicEd25519KeyPair,
  activeRoot: ProviderRegistryRootPublicKeyV1,
): ProviderRegistryRootMetadataEnvelopeV1 {
  const placeholder = ProviderRegistryRootMetadataV1Schema.parse({
    profile: "provider_registry_root_metadata_v1",
    rootGeneration: 1,
    activeRoot,
    issuedAt: "2026-08-02T00:00:00Z",
    selfSignature:
      `provider-root-self-ed25519:${activeRoot.rootKeyId}:${"0".repeat(128)}`,
    activation: "bootstrap",
    predecessor: { state: "genesis" },
    recoverySignatures: [],
  });
  const signature = sign(
    null,
    Buffer.from(createProviderRegistryRootSelfSignatureMessageV1(placeholder)),
    keyPair.privateKey,
  ).toString("hex");
  const payload = ProviderRegistryRootMetadataV1Schema.parse({
    ...placeholder,
    selfSignature: ProviderRegistryRootSelfSignatureV1Schema.parse(
      `provider-root-self-ed25519:${activeRoot.rootKeyId}:${signature}`,
    ),
  });
  return ProviderRegistryRootMetadataEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_registry_root_metadata",
    rootGeneration: 1,
    rootKeyId: activeRoot.rootKeyId,
    contentDigest: deriveProviderRegistryRootMetadataContentDigestV1(payload),
    payload,
  });
}

function sha256DomainDigest(domain: string, payload: object): string {
  return `sha256:${createHash("sha256")
    .update(canonicalizeJcsSafeIntegerUtf8V1([domain, payload]))
    .digest("hex")}`;
}

const rootKeyPair = deterministicEd25519KeyPair(21);
const alternateRootKeyPair = deterministicEd25519KeyPair(22);
const recoveryKeyPairs = [
  deterministicEd25519KeyPair(23),
  deterministicEd25519KeyPair(24),
  deterministicEd25519KeyPair(25),
] as const;
const root = rootPublicKey(rootKeyPair);
const alternateRoot = rootPublicKey(alternateRootKeyPair);
const rootMetadataEnvelope = signRootMetadata(rootKeyPair, root);
const alternateRootMetadataEnvelope = signRootMetadata(
  alternateRootKeyPair,
  alternateRoot,
);
const recoveryKeys = recoveryKeyPairs
  .map(recoveryPublicKey)
  .sort((left, right) =>
    left.recoveryKeyId.localeCompare(right.recoveryKeyId),
  );

const bundleEnvelope = ProviderBootstrapTrustBundleEnvelopeV1Schema.parse({
  schemaVersion: 1,
  recordType: "provider_bootstrap_trust_bundle",
  contentDigest: `sha256:${"0".repeat(64)}`,
  payload: {
    profile: "provider_bootstrap_trust_bundle_v1",
    strictCryptoCapability: PROVIDER_STRICT_ED25519_CRYPTO_CAPABILITY_V1,
    bootstrapProviderRegistryRoot: root,
    bootstrapProviderRegistryRootMetadata: rootMetadataEnvelope,
    providerRegistryRecoveryKeys: recoveryKeys,
    providerRegistryRecoveryThreshold: 2,
    providerTrustHistoryPolicy: PROVIDER_TRUST_HISTORY_POLICY_V1,
  },
});
bundleEnvelope.contentDigest =
  deriveProviderBootstrapTrustBundleContentDigestV1(bundleEnvelope.payload);
const bundleEnvelopeBytes = canonicalizeJcsSafeIntegerUtf8V1(bundleEnvelope);

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
        return strictManifestEnvelopeBytes;
      },
    }),
  });
});

function validationInput(
  overrides: Partial<ValidateProviderBootstrapTrustBundleStructureV1Input> = {},
): ValidateProviderBootstrapTrustBundleStructureV1Input {
  return {
    bundleEnvelopeBytes,
    strictManifestEnvelopeBytes,
    strictCryptoCapability: strictCapability,
    ...overrides,
  };
}

function mutableBundleEnvelope(): Record<string, unknown> {
  return structuredClone(bundleEnvelope) as unknown as Record<string, unknown>;
}

function bundlePayload(
  envelope: Record<string, unknown>,
): Record<string, unknown> {
  return envelope.payload as Record<string, unknown>;
}

function sealBundleEnvelope(envelope: Record<string, unknown>): Uint8Array {
  envelope.contentDigest = deriveProviderBootstrapTrustBundleContentDigestV1(
    envelope.payload,
  );
  return canonicalizeJcsSafeIntegerUtf8V1(envelope);
}

function canonicalUnsealedResource(value: unknown): Uint8Array {
  return canonicalizeJcsSafeIntegerUtf8V1(value);
}

async function expectStructureFailure(
  input: ValidateProviderBootstrapTrustBundleStructureV1Input,
): Promise<void> {
  try {
    await validateProviderBootstrapTrustBundleStructureV1(input);
    throw new Error("bootstrap trust validation unexpectedly succeeded");
  } catch (error) {
    expect(error).toBeInstanceOf(ProviderBootstrapTrustStructureError);
    expect(error).toMatchObject({
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
    expect(String(error)).not.toMatch(
      /base64url:|provider\/bootstrap|signature.*[0-9a-f]{32}/u,
    );
  }
}

function mutateLastHex(value: string): string {
  return `${value.slice(0, -1)}${value.endsWith("0") ? "1" : "0"}`;
}

function mixedOrderRecoveryKey(): ProviderRegistryRecoveryPublicKeyV1 {
  const publicKeyBytes =
    "base64url:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";
  return ProviderRegistryRecoveryPublicKeyV1Schema.parse({
    profile: "provider_registry_recovery_public_key_v1",
    recoveryKeyId: deriveProviderRegistryRecoveryKeyIdInternalV1({
      publicKeyBytes,
    }),
    algorithm: "ed25519",
    publicKeyBytes,
    publicKeyDigest:
      deriveProviderEd25519PublicKeyDigestInternalV1(publicKeyBytes),
  });
}

describe("bootstrap trust bundle structure-only validation", () => {
  it("returns a deeply frozen non-authoritative result for the complete closure", async () => {
    const result = await validateProviderBootstrapTrustBundleStructureV1(
      validationInput(),
    );
    expect(result).toEqual({
      authority: "none_structure_only",
      bundleEnvelope,
      strictManifestEnvelope: JSON.parse(
        new TextDecoder().decode(strictManifestEnvelopeBytes),
      ),
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.bundleEnvelope)).toBe(true);
    expect(Object.isFrozen(result.bundleEnvelope.payload)).toBe(true);
    expect(Object.isFrozen(result.strictManifestEnvelope.payload.cases)).toBe(
      true,
    );

    const expectedDigest = sha256DomainDigest(
      PROVIDER_BOOTSTRAP_TRUST_BUNDLE_DOMAIN_V1,
      bundleEnvelope.payload,
    );
    expect(bundleEnvelope.contentDigest).toBe(expectedDigest);
    expect(bundleEnvelopeBytes).toEqual(
      canonicalizeJcsSafeIntegerUtf8V1(bundleEnvelope),
    );
  });

  it("performs exactly four trust-key point admissions and one self verification after KAT", async () => {
    pointSpy.mockClear();
    verifySpy.mockClear();
    await validateProviderBootstrapTrustBundleStructureV1(validationInput());
    expect(pointSpy).toHaveBeenCalledTimes(4);
    expect(verifySpy).toHaveBeenCalledTimes(1);

    const admittedHex = pointSpy.mock.calls
      .map(([bytes]) => Buffer.from(bytes).toString("hex"))
      .sort();
    const expectedHex = [
      rootKeyPair.rawPublicKey,
      ...recoveryKeyPairs.map((keyPair) => keyPair.rawPublicKey),
    ]
      .map((bytes) => Buffer.from(bytes).toString("hex"))
      .sort();
    expect(admittedHex).toEqual(expectedHex);
    expect(verifySpy.mock.calls[0]?.[0]).toEqual(rootKeyPair.rawPublicKey);
    expect(verifySpy.mock.calls[0]?.[1]).toEqual(
      createProviderRegistryRootSelfSignatureMessageV1(
        rootMetadataEnvelope.payload,
      ),
    );
  });

  it("derives the fixed Pin only from a closed Envelope", () => {
    const pin = createProviderBootstrapTrustBundlePinV1(bundleEnvelope);
    expect(pin).toEqual({
      locatorProfile: "distribution_provider_bootstrap_trust_bundle_v1",
      contentDigest: bundleEnvelope.contentDigest,
    });
    expect(ProviderBootstrapTrustBundlePinV1Schema.parse(pin)).toEqual(pin);
    expect(
      ProviderBootstrapTrustBundlePinV1Schema.safeParse({
        ...pin,
        locatorProfile: "distribution_provider_bootstrap_trust_bundle_alias_v1",
      }).success,
    ).toBe(false);
    expect(() =>
      createProviderBootstrapTrustBundlePinV1({
        ...bundleEnvelope,
        contentDigest: `sha256:${"f".repeat(64)}`,
      }),
    ).toThrow(/digest mismatch/u);
  });
});

describe("fixed resource byte boundaries", () => {
  it("applies independent 4 MiB pre-parse caps to Bundle and manifest", async () => {
    expect(PROVIDER_BOOTSTRAP_TRUST_BUNDLE_MAX_BYTES_V1).toBe(4_194_304);
    expect(PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1).toBe(4_194_304);

    for (const overrides of [
      {
        bundleEnvelopeBytes: new Uint8Array(
          PROVIDER_BOOTSTRAP_TRUST_BUNDLE_MAX_BYTES_V1 + 1,
        ),
      },
      {
        strictManifestEnvelopeBytes: new Uint8Array(
          PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1 + 1,
        ),
      },
    ]) {
      pointSpy.mockClear();
      verifySpy.mockClear();
      await expectStructureFailure(validationInput(overrides));
      expect(pointSpy).not.toHaveBeenCalled();
      expect(verifySpy).not.toHaveBeenCalled();
    }
  });

  it("rejects noncanonical but JSON-equivalent Bundle and manifest bytes", async () => {
    const noncanonicalBundleBytes = new TextEncoder().encode(
      JSON.stringify(bundleEnvelope),
    );
    expect(noncanonicalBundleBytes).not.toEqual(bundleEnvelopeBytes);
    const parsedManifest = JSON.parse(
      new TextDecoder().decode(strictManifestEnvelopeBytes),
    ) as Record<string, unknown>;
    const noncanonicalManifestBytes = new TextEncoder().encode(
      JSON.stringify({
        schemaVersion: parsedManifest.schemaVersion,
        recordType: parsedManifest.recordType,
        manifestVersion: parsedManifest.manifestVersion,
        contentDigest: parsedManifest.contentDigest,
        payload: parsedManifest.payload,
      }),
    );

    for (const overrides of [
      { bundleEnvelopeBytes: noncanonicalBundleBytes },
      {
        bundleEnvelopeBytes: new Uint8Array([
          ...bundleEnvelopeBytes,
          "\n".charCodeAt(0),
        ]),
      },
      { strictManifestEnvelopeBytes: noncanonicalManifestBytes },
      {
        strictManifestEnvelopeBytes: new Uint8Array([
          ...strictManifestEnvelopeBytes,
          "\n".charCodeAt(0),
        ]),
      },
    ]) {
      await expectStructureFailure(validationInput(overrides));
    }
  });
});

describe("Bundle, manifest, profile, and policy substitutions", () => {
  it("rejects Bundle digest and outer Envelope substitutions", async () => {
    const candidates = [
      {
        ...bundleEnvelope,
        contentDigest: `sha256:${"0".repeat(64)}`,
      },
      { ...bundleEnvelope, schemaVersion: 2 },
      { ...bundleEnvelope, recordType: "provider_bootstrap_trust_bundle_alias" },
      { ...bundleEnvelope, unexpected: true },
    ];
    for (const candidate of candidates) {
      await expectStructureFailure(
        validationInput({
          bundleEnvelopeBytes: canonicalUnsealedResource(candidate),
        }),
      );
    }
  });

  it("rejects strict capability profile and manifest Pin substitutions", async () => {
    const profileCandidate = mutableBundleEnvelope();
    (
      bundlePayload(profileCandidate).strictCryptoCapability as Record<
        string,
        unknown
      >
    ).profile = "provider_strict_ed25519_crypto_capability_alias_v1";

    const manifestPinCandidate = mutableBundleEnvelope();
    const strictCapabilityObject = bundlePayload(manifestPinCandidate)
      .strictCryptoCapability as Record<string, unknown>;
    (
      strictCapabilityObject.adversarialManifest as Record<string, unknown>
    ).contentDigest = `sha256:${"a".repeat(64)}`;
    const manifestPinBytes = sealBundleEnvelope(manifestPinCandidate);

    await expectStructureFailure(
      validationInput({
        bundleEnvelopeBytes: canonicalUnsealedResource(profileCandidate),
      }),
    );
    await expectStructureFailure(
      validationInput({ bundleEnvelopeBytes: manifestPinBytes }),
    );
  });

  it("rejects policy mutation even when the rest of the payload is unchanged", async () => {
    const candidate = mutableBundleEnvelope();
    const policy = bundlePayload(candidate).providerTrustHistoryPolicy as Record<
      string,
      unknown
    >;
    policy.maxRootMetadataGenerationCountPerInstallationIdentity = 255;
    await expectStructureFailure(
      validationInput({
        bundleEnvelopeBytes: canonicalUnsealedResource(candidate),
      }),
    );
  });

  it("rejects manifest content and compiled-digest substitutions", async () => {
    const manifest = JSON.parse(
      new TextDecoder().decode(strictManifestEnvelopeBytes),
    ) as Record<string, unknown>;
    const changedPayloadManifest = structuredClone(manifest);
    const changedPayload = changedPayloadManifest.payload as Record<
      string,
      unknown
    >;
    const cases = changedPayload.cases as Array<Record<string, unknown>>;
    cases[0]!.messageBytes = "base64url:AA";
    changedPayloadManifest.contentDigest = sha256DomainDigest(
      PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_DOMAIN_V1,
      changedPayload,
    );

    const wrongOuterDigest = structuredClone(manifest);
    wrongOuterDigest.contentDigest = `sha256:${"b".repeat(64)}`;
    for (const candidate of [changedPayloadManifest, wrongOuterDigest]) {
      pointSpy.mockClear();
      verifySpy.mockClear();
      await expectStructureFailure(
        validationInput({
          strictManifestEnvelopeBytes: canonicalUnsealedResource(candidate),
        }),
      );
      expect(pointSpy).not.toHaveBeenCalled();
      expect(verifySpy).not.toHaveBeenCalled();
    }
  });
});

describe("registry root and recovery-key closure substitutions", () => {
  it("rejects a different otherwise-valid bootstrap Root Metadata Envelope", async () => {
    const candidate = mutableBundleEnvelope();
    bundlePayload(candidate).bootstrapProviderRegistryRootMetadata =
      alternateRootMetadataEnvelope;
    await expectStructureFailure(
      validationInput({ bundleEnvelopeBytes: sealBundleEnvelope(candidate) }),
    );
  });

  it("rejects root-metadata outer mismatch and self-signature substitution", async () => {
    const outerCandidate = mutableBundleEnvelope();
    const outerMetadata = bundlePayload(outerCandidate)
      .bootstrapProviderRegistryRootMetadata as Record<string, unknown>;
    outerMetadata.rootKeyId = alternateRoot.rootKeyId;

    const signatureCandidate = mutableBundleEnvelope();
    const signatureMetadata = bundlePayload(signatureCandidate)
      .bootstrapProviderRegistryRootMetadata as Record<string, unknown>;
    const signaturePayload = signatureMetadata.payload as Record<string, unknown>;
    signaturePayload.selfSignature = mutateLastHex(
      signaturePayload.selfSignature as string,
    );
    signatureMetadata.contentDigest =
      deriveProviderRegistryRootMetadataContentDigestV1(signaturePayload);

    for (const candidate of [outerCandidate, signatureCandidate]) {
      await expectStructureFailure(
        validationInput({ bundleEnvelopeBytes: sealBundleEnvelope(candidate) }),
      );
    }
  });

  it("rejects independently substituted recovery key IDs and raw digests", async () => {
    const idCandidate = mutableBundleEnvelope();
    const idKeys = bundlePayload(idCandidate)
      .providerRegistryRecoveryKeys as Array<Record<string, unknown>>;
    idKeys[0]!.recoveryKeyId = alternateRoot.rootKeyId;

    const digestCandidate = mutableBundleEnvelope();
    const digestKeys = bundlePayload(digestCandidate)
      .providerRegistryRecoveryKeys as Array<Record<string, unknown>>;
    digestKeys[0]!.publicKeyDigest = `sha256:${"c".repeat(64)}`;

    for (const candidate of [idCandidate, digestCandidate]) {
      await expectStructureFailure(
        validationInput({ bundleEnvelopeBytes: sealBundleEnvelope(candidate) }),
      );
    }
  });

  it("rejects reordered, duplicate, and root/recovery material aliases", async () => {
    const reorderedCandidate = mutableBundleEnvelope();
    const reorderedKeys = bundlePayload(reorderedCandidate)
      .providerRegistryRecoveryKeys as unknown[];
    reorderedKeys.reverse();

    const duplicateCandidate = mutableBundleEnvelope();
    const duplicateKeys = bundlePayload(duplicateCandidate)
      .providerRegistryRecoveryKeys as unknown[];
    duplicateKeys[1] = structuredClone(duplicateKeys[0]);

    const rootAliasCandidate = mutableBundleEnvelope();
    const aliasKeys = bundlePayload(rootAliasCandidate)
      .providerRegistryRecoveryKeys as Array<Record<string, unknown>>;
    const rootMaterialAsRecovery = recoveryPublicKey({
      privateKey: rootKeyPair.privateKey,
      rawPublicKey: rootKeyPair.rawPublicKey,
      publicKeyBytes: rootKeyPair.publicKeyBytes,
    });
    aliasKeys[0] = rootMaterialAsRecovery as unknown as Record<string, unknown>;
    aliasKeys.sort((left, right) =>
      String(left.recoveryKeyId).localeCompare(String(right.recoveryKeyId)),
    );

    for (const candidate of [
      reorderedCandidate,
      duplicateCandidate,
      rootAliasCandidate,
    ]) {
      await expectStructureFailure(
        validationInput({ bundleEnvelopeBytes: sealBundleEnvelope(candidate) }),
      );
    }
  });

  it("keeps the legacy mixed-order key derivable but rejects it at trust admission", async () => {
    const mixedOrderCandidate = mutableBundleEnvelope();
    const keys = bundlePayload(mixedOrderCandidate)
      .providerRegistryRecoveryKeys as Array<Record<string, unknown>>;
    const mixedOrder = mixedOrderRecoveryKey();
    expect(mixedOrder.publicKeyDigest).toBe(
      "sha256:630dcd2966c4336691125448bbb25b4ff412a49c732db2c8abc1b8581bd710dd",
    );
    keys[0] = mixedOrder as unknown as Record<string, unknown>;
    keys.sort((left, right) =>
      String(left.recoveryKeyId).localeCompare(String(right.recoveryKeyId)),
    );

    pointSpy.mockClear();
    verifySpy.mockClear();
    await expectStructureFailure(
      validationInput({
        bundleEnvelopeBytes: sealBundleEnvelope(mixedOrderCandidate),
      }),
    );
    expect(pointSpy).toHaveBeenCalled();
    expect(verifySpy).not.toHaveBeenCalled();
  });
});

describe("unforgeable capability and hostile input boundary", () => {
  it("rejects a fake opaque capability before trust-key cryptography", async () => {
    pointSpy.mockClear();
    verifySpy.mockClear();
    await expectStructureFailure(
      validationInput({
        strictCryptoCapability:
          Object.freeze({}) as ProviderStrictEd25519OpaqueCapabilityV1,
      }),
    );
    expect(pointSpy).not.toHaveBeenCalled();
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it("rejects typed-array subclasses, proxies, and shared backing memory without invoking overrides", async () => {
    let subclassGetterInvoked = false;
    let subclassSliceInvoked = false;
    class HostileUint8Array extends Uint8Array {
      override get byteLength(): number {
        subclassGetterInvoked = true;
        return 1;
      }

      override slice(
        _start?: number,
        _end?: number,
      ): Uint8Array<ArrayBuffer> {
        subclassSliceInvoked = true;
        return new Uint8Array(
          new ArrayBuffer(
            PROVIDER_BOOTSTRAP_TRUST_BUNDLE_MAX_BYTES_V1 + 1,
          ),
        );
      }
    }
    const subclassBytes = new HostileUint8Array(bundleEnvelopeBytes);
    pointSpy.mockClear();
    verifySpy.mockClear();
    await expectStructureFailure(
      validationInput({ bundleEnvelopeBytes: subclassBytes }),
    );
    expect(subclassGetterInvoked).toBe(false);
    expect(subclassSliceInvoked).toBe(false);
    expect(pointSpy).not.toHaveBeenCalled();
    expect(verifySpy).not.toHaveBeenCalled();

    let proxyGetterInvoked = false;
    const proxyBytes = new Proxy(bundleEnvelopeBytes, {
      get(target, property, receiver) {
        proxyGetterInvoked = true;
        return Reflect.get(target, property, receiver);
      },
    });
    await expectStructureFailure(
      validationInput({ bundleEnvelopeBytes: proxyBytes }),
    );
    expect(proxyGetterInvoked).toBe(false);

    if (typeof SharedArrayBuffer === "function") {
      const sharedBytes = new Uint8Array(
        new SharedArrayBuffer(bundleEnvelopeBytes.byteLength),
      );
      sharedBytes.set(bundleEnvelopeBytes);
      await expectStructureFailure(
        validationInput({ bundleEnvelopeBytes: sharedBytes }),
      );
    }
  });

  it("does not consult a mutable SharedArrayBuffer global while rejecting shared memory", async () => {
    if (typeof SharedArrayBuffer !== "function") return;
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "SharedArrayBuffer",
    );
    if (descriptor?.configurable !== true) return;

    const sharedBytes = new Uint8Array(
      new SharedArrayBuffer(bundleEnvelopeBytes.byteLength),
    );
    sharedBytes.set(bundleEnvelopeBytes);
    let globalGetterInvoked = false;
    Object.defineProperty(globalThis, "SharedArrayBuffer", {
      configurable: true,
      get() {
        globalGetterInvoked = true;
        return undefined;
      },
    });
    try {
      await expectStructureFailure(
        validationInput({ bundleEnvelopeBytes: sharedBytes }),
      );
    } finally {
      Object.defineProperty(
        globalThis,
        "SharedArrayBuffer",
        descriptor,
      );
    }
    expect(globalGetterInvoked).toBe(false);
  });

  it("rejects a top-level getter without executing it", async () => {
    let getterInvoked = false;
    const hostile = {
      strictManifestEnvelopeBytes,
      strictCryptoCapability: strictCapability,
    } as Record<string, unknown>;
    Object.defineProperty(hostile, "bundleEnvelopeBytes", {
      enumerable: true,
      get() {
        getterInvoked = true;
        return bundleEnvelopeBytes;
      },
    });
    await expectStructureFailure(
      hostile as unknown as ValidateProviderBootstrapTrustBundleStructureV1Input,
    );
    expect(getterInvoked).toBe(false);
  });
});
