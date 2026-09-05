import { generateKeyPairSync, sign } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createReleaseAttestationMessageV1,
  deriveReleaseTrustKeyIdV1,
  verifyReleaseAttestationV1,
  type ReleaseAttestationClaimsV1,
} from "../src/release-attestation.js";

function fixture() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeySpkiBase64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  const claims: ReleaseAttestationClaimsV1 = {
    schemaVersion: "understand-code-release-attestation-v1",
    product: "understand-code",
    package: { name: "@understand-code/preview", version: "0.1.0" },
    releaseManifest: { sha256: `sha256:${"1".repeat(64)}` },
    sbom: { sha256: `sha256:${"2".repeat(64)}` },
    provenance: { sha256: `sha256:${"3".repeat(64)}` },
    payloadInventory: { sha256: `sha256:${"4".repeat(64)}`, fileCount: 91 },
  };
  const signature = sign(null, createReleaseAttestationMessageV1(claims), privateKey);
  const keyId = deriveReleaseTrustKeyIdV1(publicKeySpkiBase64);
  return {
    envelope: {
      schemaVersion: "understand-code-release-attestation-v1",
      algorithm: "Ed25519",
      keyId,
      claims,
      signature: `ed25519:${signature.toString("hex")}`,
    },
    trustBundle: {
      schemaVersion: "understand-code-release-trust-bundle-v1",
      product: "understand-code",
      keys: [{ keyId, algorithm: "Ed25519", publicKeySpkiBase64 }],
    },
  };
}

describe("release attestation verifier", () => {
  it("verifies a publisher signature supplied with an external trust bundle", () => {
    const { envelope, trustBundle } = fixture();
    expect(verifyReleaseAttestationV1(envelope, trustBundle)).toBe(true);
  });

  it("fails closed for changed claims, unknown keys, malformed keys, and bad signatures", () => {
    const { envelope, trustBundle } = fixture();
    expect(verifyReleaseAttestationV1({
      ...envelope,
      claims: { ...envelope.claims, sbom: { sha256: `sha256:${"9".repeat(64)}` } },
    }, trustBundle)).toBe(false);
    expect(verifyReleaseAttestationV1({
      ...envelope,
      keyId: `ed25519-spki-sha256:${"f".repeat(64)}`,
    }, trustBundle)).toBe(false);
    expect(verifyReleaseAttestationV1(envelope, {
      ...trustBundle,
      keys: [{ ...trustBundle.keys[0], keyId: `ed25519-spki-sha256:${"f".repeat(64)}` }],
    })).toBe(false);
    expect(verifyReleaseAttestationV1({
      ...envelope,
      signature: `ed25519:${"0".repeat(128)}`,
    }, trustBundle)).toBe(false);
    expect(verifyReleaseAttestationV1(envelope, {
      ...trustBundle,
      keys: [trustBundle.keys[0], trustBundle.keys[0]],
    })).toBe(false);
  });
});

