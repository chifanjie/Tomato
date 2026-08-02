import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify as verifyNodeEd25519,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import {
  PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_PROFILE_V1,
  PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_MAX_BYTES_V1,
  PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_SHA256_HEX_V1,
  PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_SEMANTIC_CONTENT_DIGEST_V1,
  ProviderBootstrapTrustGoldenManifestV1Schema,
  verifyProviderBootstrapTrustGoldenManifestV1,
  verifyProviderBootstrapTrustGoldenManifestResourceV1,
} from "../src/bootstrap-trust-golden.js";
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

const goldenPath = fileURLToPath(
  new URL(
    "../fixtures/v1/golden/provider-bootstrap-structure-crypto-v1.json",
    import.meta.url,
  ),
);
const bundlePath = fileURLToPath(
  new URL(
    "../provider/bootstrap-trust-bundle-v1.json",
    import.meta.url,
  ),
);
const goldenBytes = readFileSync(goldenPath);
const goldenInput: unknown = JSON.parse(goldenBytes.toString("utf8"));
const golden =
  ProviderBootstrapTrustGoldenManifestV1Schema.parse(goldenInput);
const bundleBytes = readFileSync(bundlePath);
const bundleEnvelope = JSON.parse(
  bundleBytes.toString("utf8"),
) as Record<string, unknown>;
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
let strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;

beforeAll(async () => {
  strictCryptoCapability =
    await attestProviderStrictEd25519CryptoHostV1({
      host: Object.freeze({
        verificationProfile:
          STRICT_ED25519_VERIFICATION_PROFILE_V1,
        validatePrimeSubgroupPoint,
        verifyRawEd25519,
      }),
      resourceHost: Object.freeze({
        readFixedSignedPackageResource(
          resourcePath: string,
          maxBytes: number,
        ) {
          if (
            resourcePath !==
              PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
            maxBytes !==
              PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
          ) {
            throw new Error("unexpected strict manifest request");
          }
          return strictManifestBytes;
        },
      }),
    });
});

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nodePublicKeyFromRaw(rawPublicKey: Buffer) {
  return createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      rawPublicKey,
    ]),
    format: "der",
    type: "spki",
  });
}

describe("immutable bootstrap trust cross-language golden manifest", () => {
  it("verifies all eight cases only after strict host attestation", async () => {
    const validation =
      await verifyProviderBootstrapTrustGoldenManifestV1(
        goldenInput,
        strictCryptoCapability,
      );
    expect(validation.authority).toBe("none_structure_only");
    expect(validation.manifest.profile).toBe(
      PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_PROFILE_V1,
    );
    expect(
      PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_SEMANTIC_CONTENT_DIGEST_V1,
    ).toBe(
      "sha256:791dcb58e8168c8731edb7c96198d9c50da543a43d13a534ef02462fd5bed83c",
    );
    expect(validation.manifest.vectors.recoveryKeyIds).toHaveLength(3);
    expect(Object.isFrozen(validation)).toBe(true);
    expect(Object.isFrozen(validation.manifest.vectors)).toBe(true);

    const caseIds = [
      validation.manifest.vectors.signedPackageIdentityDigest.caseId,
      validation.manifest.vectors.bootstrapTrustBundleDigest.caseId,
      validation.manifest.vectors.bootstrapRootMetadataDigest.caseId,
      validation.manifest.vectors.bootstrapRootSelfSignatureVerification
        .caseId,
      validation.manifest.vectors.deterministicRootSelfSignatureSigning
        .caseId,
      ...validation.manifest.vectors.recoveryKeyIds.map(
        ({ caseId }) => caseId,
      ),
    ];
    expect(caseIds).toHaveLength(8);
    expect(new Set(caseIds).size).toBe(8);
  });

  it("anchors the exact raw fixture bytes before semantic verification", async () => {
    expect(goldenBytes.byteLength).toBe(
      PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_BYTE_LENGTH_V1,
    );
    expect(createHash("sha256").update(goldenBytes).digest("hex")).toBe(
      PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_SHA256_HEX_V1,
    );
    const validation =
      await verifyProviderBootstrapTrustGoldenManifestResourceV1(
        new Uint8Array(goldenBytes),
        strictCryptoCapability,
      );
    expect(validation.authority).toBe("none_structure_only");

    const semanticallyEqualDifferentBytes = new TextEncoder().encode(
      JSON.stringify(goldenInput),
    );
    await expect(
      verifyProviderBootstrapTrustGoldenManifestResourceV1(
        semanticallyEqualDifferentBytes,
        strictCryptoCapability,
      ),
    ).rejects.toThrow(/byte anchor mismatch/u);
  });

  it("rejects oversized and exotic raw resource views before reading overrides", async () => {
    await expect(
      verifyProviderBootstrapTrustGoldenManifestResourceV1(
        new Uint8Array(
          PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_MAX_BYTES_V1 + 1,
        ),
        strictCryptoCapability,
      ),
    ).rejects.toThrow(/invalid fixed resource bytes/u);

    let subclassByteLengthRead = false;
    let subclassSliceCalled = false;
    class HostileUint8Array extends Uint8Array {
      override get byteLength(): number {
        subclassByteLengthRead = true;
        return goldenBytes.byteLength;
      }

      override slice(
        _start?: number,
        _end?: number,
      ): Uint8Array<ArrayBuffer> {
        subclassSliceCalled = true;
        return new Uint8Array(goldenBytes);
      }
    }
    await expect(
      verifyProviderBootstrapTrustGoldenManifestResourceV1(
        new HostileUint8Array(goldenBytes),
        strictCryptoCapability,
      ),
    ).rejects.toThrow(/invalid fixed resource bytes/u);
    expect(subclassByteLengthRead).toBe(false);
    expect(subclassSliceCalled).toBe(false);

    let proxyGetterRead = false;
    const proxiedBytes = new Proxy(new Uint8Array(goldenBytes), {
      get(target, property, receiver) {
        proxyGetterRead = true;
        return Reflect.get(target, property, receiver);
      },
    });
    await expect(
      verifyProviderBootstrapTrustGoldenManifestResourceV1(
        proxiedBytes,
        strictCryptoCapability,
      ),
    ).rejects.toThrow(/invalid fixed resource bytes/u);
    expect(proxyGetterRead).toBe(false);

    if (typeof SharedArrayBuffer === "function") {
      const sharedBytes = new Uint8Array(
        new SharedArrayBuffer(goldenBytes.byteLength),
      );
      sharedBytes.set(goldenBytes);
      await expect(
        verifyProviderBootstrapTrustGoldenManifestResourceV1(
          sharedBytes,
          strictCryptoCapability,
        ),
      ).rejects.toThrow(/invalid fixed resource bytes/u);
    }
  });

  it("rejects a schema-valid crypto-coherent alternate semantic manifest", async () => {
    const alternate = cloneJson(golden);
    alternate.fixedBundleResource.resourceBytesSha256Hex =
      "f".repeat(64);
    expect(
      ProviderBootstrapTrustGoldenManifestV1Schema.safeParse(
        alternate,
      ).success,
    ).toBe(true);
    await expect(
      verifyProviderBootstrapTrustGoldenManifestV1(
        alternate,
        strictCryptoCapability,
      ),
    ).rejects.toThrow(/compiled digest golden mismatch/u);
  });

  it("binds the literal manifest to the exact fixed Bundle bytes and records", () => {
    const fixed = golden.fixedBundleResource;
    expect(bundleBytes.byteLength).toBe(fixed.resourceByteLength);
    expect(createHash("sha256").update(bundleBytes).digest("hex")).toBe(
      fixed.resourceBytesSha256Hex,
    );
    expect(bundleEnvelope.contentDigest).toBe(
      fixed.bundlePayloadContentDigest,
    );
    expect(bundleEnvelope.payload).toEqual(
      golden.vectors.bootstrapTrustBundleDigest.fields,
    );

    const bundlePayload = bundleEnvelope.payload as Record<string, unknown>;
    const rootMetadataEnvelope =
      bundlePayload.bootstrapProviderRegistryRootMetadata as Record<
        string,
        unknown
      >;
    expect(rootMetadataEnvelope.payload).toEqual(
      golden.vectors.bootstrapRootMetadataDigest.fields,
    );
    expect(rootMetadataEnvelope.contentDigest).toBe(
      golden.vectors.bootstrapRootMetadataDigest.expected
        .envelopeContentDigest,
    );

    const recoveryKeys =
      bundlePayload.providerRegistryRecoveryKeys as Array<
        Record<string, unknown>
      >;
    for (const vector of golden.vectors.recoveryKeyIds) {
      const record = recoveryKeys[vector.recoveryKeyOrdinal]!;
      expect(vector.fields.publicKeyBytes).toBe(record.publicKeyBytes);
      expect(vector.expected.id).toBe(record.recoveryKeyId);
      expect(vector.expected.publicKeyDigest).toBe(
        record.publicKeyDigest,
      );
    }
  });

  it("verifies both literal root signatures with an independent Node backend", () => {
    for (const vector of [
      golden.vectors.bootstrapRootSelfSignatureVerification,
      golden.vectors.deterministicRootSelfSignatureSigning,
    ]) {
      const publicKey = nodePublicKeyFromRaw(
        Buffer.from(vector.expected.rawPublicKeyHex, "hex"),
      );
      expect(
        verifyNodeEd25519(
          null,
          Buffer.from(vector.expected.canonicalMessageUtf8Hex, "hex"),
          publicKey,
          Buffer.from(vector.expected.rawSignatureHex, "hex"),
        ),
      ).toBe(true);
    }
  });

  it("reproduces the deterministic signature from the published non-production seed", () => {
    const vector =
      golden.vectors.deterministicRootSelfSignatureSigning;
    const privateKey = createPrivateKey({
      key: Buffer.concat([
        Buffer.from("302e020100300506032b657004220420", "hex"),
        Buffer.from(vector.rfc8032TestSeedHex, "hex"),
      ]),
      format: "der",
      type: "pkcs8",
    });
    const spki = createPublicKey(privateKey).export({
      format: "der",
      type: "spki",
    });
    const rawPublicKey = spki.subarray(spki.byteLength - 32);
    expect(rawPublicKey.toString("hex")).toBe(
      vector.expected.rawPublicKeyHex,
    );
    expect(
      sign(
        null,
        Buffer.from(vector.expected.canonicalMessageUtf8Hex, "hex"),
        privateKey,
      ).toString("hex"),
    ).toBe(vector.expected.rawSignatureHex);
  });

  it("fails closed on expected-byte mutation, case reorder, and key aliasing", async () => {
    const changedDigest = cloneJson(golden);
    changedDigest.vectors.signedPackageIdentityDigest.expected.sha256Hex =
      "0".repeat(64);
    await expect(
      verifyProviderBootstrapTrustGoldenManifestV1(
        changedDigest,
        strictCryptoCapability,
      ),
    ).rejects.toThrow(/golden mismatch/u);

    const reordered = cloneJson(golden) as unknown as Record<
      string,
      unknown
    >;
    const vectors = reordered.vectors as Record<string, unknown>;
    const recoveryKeyIds = vectors.recoveryKeyIds as unknown[];
    recoveryKeyIds.reverse();
    expect(
      ProviderBootstrapTrustGoldenManifestV1Schema.safeParse(
        reordered,
      ).success,
    ).toBe(false);

    const aliased = cloneJson(golden);
    aliased.vectors.deterministicRootSelfSignatureSigning.expected.publicKeyBytes =
      aliased.vectors.bootstrapRootMetadataDigest.fields.activeRoot.publicKeyBytes;
    await expect(
      verifyProviderBootstrapTrustGoldenManifestV1(
        aliased,
        strictCryptoCapability,
      ),
    ).rejects.toThrow(/golden mismatch|aliases fixed Bundle key/u);
  });

  it("rejects a forged opaque capability before signature vectors can pass", async () => {
    await expect(
      verifyProviderBootstrapTrustGoldenManifestV1(
        goldenInput,
        Object.freeze(
          {},
        ) as ProviderStrictEd25519OpaqueCapabilityV1,
      ),
    ).rejects.toThrow();
  });

  it("rejects unknown manifest fields and authority substitutions", () => {
    expect(() =>
      ProviderBootstrapTrustGoldenManifestV1Schema.parse({
        ...cloneJson(golden),
        acceptedAuthority: "strong_ready",
      }),
    ).toThrow();
    expect(() =>
      ProviderBootstrapTrustGoldenManifestV1Schema.parse({
        ...cloneJson(golden),
        fixtureAuthority: "strong_ready",
      }),
    ).toThrow();
  });
});
