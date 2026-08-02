import { createHash, createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import type { ProviderCryptoHostV1 } from "../src/domain-crypto.js";
import {
  deriveInstallationIdentityGenerationIdV1,
  deriveInstallationIdentityKeyCheckTokenV1,
  deriveProviderRegistryRootKeyIdV1,
} from "../src/provider-foundation.js";

const cryptoHost: ProviderCryptoHostV1 = Object.freeze({
  sha256(message: Uint8Array) {
    return new Uint8Array(createHash("sha256").update(message).digest());
  },
  hmacSha256(key: Uint8Array, message: Uint8Array) {
    return new Uint8Array(createHmac("sha256", key).update(message).digest());
  },
});

const initializationNonce = "000102030405060708090a0b0c0d0e0f";
const generationId =
  "installation-identity-generation:4fe634940e20afac35e02d";
const rootPublicKey =
  "base64url:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";
const installationKey = new Uint8Array(
  Array.from({ length: 32 }, (_, index) => index),
);

describe("domain-specific provider crypto builders", () => {
  it("derives frozen installation and registry root identities", async () => {
    await expect(
      deriveInstallationIdentityGenerationIdV1(
        { initializationNonce },
        cryptoHost,
      ),
    ).resolves.toBe(generationId);
    await expect(
      deriveProviderRegistryRootKeyIdV1(
        { publicKeyBytes: rootPublicKey },
        cryptoHost,
      ),
    ).resolves.toBe("6e88eeded5ad931d6d2eba");
  });

  it("derives the domain-separated key-check HMAC", async () => {
    await expect(
      deriveInstallationIdentityKeyCheckTokenV1(
        { generationId, initializationNonce },
        installationKey,
        cryptoHost,
      ),
    ).resolves.toBe(
      "hmac-sha256:9b585cbb13d23ae739df3988278dfdc09ed612ccd8af853ac26f570bc8ce2eef",
    );
  });

  it("rejects extra, null, and mismatched fields before cryptography", async () => {
    const host: ProviderCryptoHostV1 = {
      sha256: vi.fn(cryptoHost.sha256),
      hmacSha256: vi.fn(cryptoHost.hmacSha256),
    };
    await expect(
      deriveInstallationIdentityGenerationIdV1(
        { initializationNonce, extra: true },
        host,
      ),
    ).rejects.toThrow();
    await expect(
      deriveInstallationIdentityGenerationIdV1(
        { initializationNonce: null },
        host,
      ),
    ).rejects.toThrow();
    expect(host.sha256).not.toHaveBeenCalled();

    await expect(
      deriveInstallationIdentityKeyCheckTokenV1(
        {
          generationId: `installation-identity-generation:${"0".repeat(22)}`,
          initializationNonce,
        },
        installationKey,
        host,
      ),
    ).rejects.toThrow(/derived/u);
    expect(host.hmacSha256).not.toHaveBeenCalled();
  });

  it("rejects getters before schema parsing without executing them", async () => {
    let invoked = false;
    const input = Object.defineProperty({}, "initializationNonce", {
      enumerable: true,
      get() {
        invoked = true;
        return initializationNonce;
      },
    });
    await expect(
      deriveInstallationIdentityGenerationIdV1(input, cryptoHost),
    ).rejects.toThrow(/data property/u);
    expect(invoked).toBe(false);
  });

  it("rejects deeply nested unknown input before recursive canonicalization", async () => {
    let nested: unknown = "leaf";
    for (let depth = 0; depth < 25_000; depth += 1) {
      nested = [nested];
    }
    const host: ProviderCryptoHostV1 = {
      sha256: vi.fn(cryptoHost.sha256),
      hmacSha256: vi.fn(cryptoHost.hmacSha256),
    };
    let rejection: unknown;
    try {
      await deriveInstallationIdentityGenerationIdV1(
        { initializationNonce, unknown: nested },
        host,
      );
    } catch (error) {
      rejection = error;
    }
    expect(rejection).toBeInstanceOf(ZodError);
    expect(rejection).not.toBeInstanceOf(RangeError);
    expect((rejection as ZodError).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unrecognized_keys",
          keys: ["unknown"],
        }),
      ]),
    );
    expect(host.sha256).not.toHaveBeenCalled();
  });

  it("requires exact 32-byte keys and crypto host outputs", async () => {
    await expect(
      deriveInstallationIdentityKeyCheckTokenV1(
        { generationId, initializationNonce },
        new Uint8Array(31),
        cryptoHost,
      ),
    ).rejects.toThrow(/32 bytes/u);

    const shortHashHost: ProviderCryptoHostV1 = {
      sha256: () => new Uint8Array(31),
      hmacSha256: () => new Uint8Array(31),
    };
    await expect(
      deriveInstallationIdentityGenerationIdV1(
        { initializationNonce },
        shortHashHost,
      ),
    ).rejects.toThrow(/32 bytes/u);
  });

  it("passes exact no-newline preimage bytes to the injected host", async () => {
    let observed = "";
    const observingHost: ProviderCryptoHostV1 = {
      sha256(message) {
        observed = new TextDecoder().decode(message);
        return cryptoHost.sha256(message);
      },
      hmacSha256: cryptoHost.hmacSha256,
    };
    await deriveInstallationIdentityGenerationIdV1(
      { initializationNonce },
      observingHost,
    );
    expect(observed).toBe(
      '["installation-identity-generation-v1",{"initializationNonce":"000102030405060708090a0b0c0d0e0f"}]',
    );
    expect(observed.endsWith("\n")).toBe(false);
  });
});
