import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import type { ProviderCryptoHostV1 } from "../src/domain-crypto.js";
import {
  ContentDigestV1Schema,
  Ed25519PublicKeyDigestV1Schema,
} from "../src/primitives.js";
import {
  ProviderEd25519PublicKeyDigestGoldenManifestV1Schema,
  deriveEd25519PublicKeyDigestV1,
  verifyProviderEd25519PublicKeyDigestGoldenManifestV1,
} from "../src/public-key-digest.js";

const publicKeyBytes = new Uint8Array(
  Array.from({ length: 32 }, (_, index) => index),
);
const canonicalPublicKey =
  "base64url:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";
const expectedDigest =
  "sha256:630dcd2966c4336691125448bbb25b4ff412a49c732db2c8abc1b8581bd710dd";
const goldenManifestInput: unknown = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../fixtures/v1/golden/ed25519-public-key-digest-v1.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
);

function sha256(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(bytes).digest());
}

const cryptoHost: ProviderCryptoHostV1 = Object.freeze({
  sha256,
  hmacSha256(key: Uint8Array, message: Uint8Array) {
    return new Uint8Array(createHmac("sha256", key).update(message).digest());
  },
});

function digestWire(bytes: Uint8Array): string {
  return `sha256:${Buffer.from(sha256(bytes)).toString("hex")}`;
}

describe("Ed25519 raw public-key digest", () => {
  it("verifies the distributable raw32 digest and legacy key-ID golden", async () => {
    const manifest =
      await verifyProviderEd25519PublicKeyDigestGoldenManifestV1(
        goldenManifestInput,
        cryptoHost,
      );
    expect(manifest.cases).toHaveLength(1);
    expect(manifest.cases[0]).toMatchObject({
      rawPublicKeyHex:
        "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
      expectedPublicKeyDigest: expectedDigest,
      expectedLegacyProviderRegistryRootKeyId:
        "6e88eeded5ad931d6d2eba",
    });
  });

  it("rejects any change to the immutable raw-key digest golden", async () => {
    const mutated = structuredClone(
      ProviderEd25519PublicKeyDigestGoldenManifestV1Schema.parse(
        goldenManifestInput,
      ),
    ) as unknown as Record<string, unknown>;
    const cases = mutated.cases as Array<Record<string, unknown>>;
    cases[0]!.unexpected = true;
    await expect(
      verifyProviderEd25519PublicKeyDigestGoldenManifestV1(
        mutated,
        cryptoHost,
      ),
    ).rejects.toThrow();
  });

  it("derives the frozen 00..1f digest from exactly the decoded raw32 bytes", async () => {
    let observed: Uint8Array | undefined;
    const observingHost: ProviderCryptoHostV1 = {
      ...cryptoHost,
      sha256(message) {
        observed = message.slice();
        return sha256(message);
      },
    };

    await expect(
      deriveEd25519PublicKeyDigestV1(canonicalPublicKey, observingHost),
    ).resolves.toBe(expectedDigest);
    expect(observed).toEqual(publicKeyBytes);
  });

  it("does not hash base64url text, a JCS string, or RFC 8410 SPKI", async () => {
    const textEncoder = new TextEncoder();
    const spkiPrefix = Uint8Array.from([
      0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
    ]);
    const spki = new Uint8Array(spkiPrefix.byteLength + publicKeyBytes.byteLength);
    spki.set(spkiPrefix);
    spki.set(publicKeyBytes, spkiPrefix.byteLength);

    const derived = await deriveEd25519PublicKeyDigestV1(
      canonicalPublicKey,
      cryptoHost,
    );
    expect(derived).toBe(expectedDigest);
    expect(derived).not.toBe(digestWire(textEncoder.encode(canonicalPublicKey)));
    expect(derived).not.toBe(
      digestWire(textEncoder.encode(JSON.stringify(canonicalPublicKey))),
    );
    expect(derived).not.toBe(digestWire(spki));
  });

  it("keeps the raw-key digest schema independent from a content digest", () => {
    expect(Ed25519PublicKeyDigestV1Schema).not.toBe(ContentDigestV1Schema);
    expect(Ed25519PublicKeyDigestV1Schema.parse(expectedDigest)).toBe(
      expectedDigest,
    );
    expect(() =>
      Ed25519PublicKeyDigestV1Schema.parse(`sha256:${"A".repeat(64)}`),
    ).toThrow();
  });

  it("rejects malformed key encodings before invoking the host", async () => {
    const host: ProviderCryptoHostV1 = {
      sha256: vi.fn(sha256),
      hmacSha256: cryptoHost.hmacSha256,
    };
    for (const value of [
      `base64url:${"A".repeat(42)}`,
      `base64url:${"A".repeat(44)}`,
      `${canonicalPublicKey}=`,
      `base64url:${"A".repeat(42)}B`,
    ]) {
      await expect(
        deriveEd25519PublicKeyDigestV1(value, host),
      ).rejects.toThrow();
    }
    expect(host.sha256).not.toHaveBeenCalled();
  });

  it("rejects non-32-byte host results", async () => {
    for (const length of [0, 31, 33]) {
      const host: ProviderCryptoHostV1 = {
        sha256: () => new Uint8Array(length),
        hmacSha256: cryptoHost.hmacSha256,
      };
      await expect(
        deriveEd25519PublicKeyDigestV1(canonicalPublicKey, host),
      ).rejects.toThrow(/exactly 32 bytes/u);
    }
  });

  it("detects a host that mutates its defensive input copy", async () => {
    const host: ProviderCryptoHostV1 = {
      sha256(message) {
        const snapshot = message.slice();
        message[0] = message[0]! ^ 0xff;
        return sha256(snapshot);
      },
      hmacSha256: cryptoHost.hmacSha256,
    };
    await expect(
      deriveEd25519PublicKeyDigestV1(canonicalPublicKey, host),
    ).rejects.toThrow(/must not mutate/u);
    expect(publicKeyBytes[0]).toBe(0);
  });
});
