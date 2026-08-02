import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { ProviderCryptoHostV1 } from "../src/domain-crypto.js";
import {
  ProviderContractGoldenManifestV1Schema,
  ProviderContractNegativeManifestV1Schema,
  verifyProviderContractGoldenManifestV1,
  verifyProviderContractNegativeManifestV1,
} from "../src/golden-vectors.js";

const goldenPath = fileURLToPath(
  new URL("../fixtures/v1/golden/manifest.json", import.meta.url),
);
const negativePath = fileURLToPath(
  new URL("../fixtures/v1/invalid/manifest.json", import.meta.url),
);
const goldenInput: unknown = JSON.parse(readFileSync(goldenPath, "utf8"));
const negativeInput: unknown = JSON.parse(readFileSync(negativePath, "utf8"));
const cryptoHost: ProviderCryptoHostV1 = {
  sha256(message) {
    return new Uint8Array(createHash("sha256").update(message).digest());
  },
  hmacSha256(key, message) {
    return new Uint8Array(createHmac("sha256", key).update(message).digest());
  },
};

describe("immutable provider contract fixtures", () => {
  it("verifies every literal golden vector against exact bytes", async () => {
    const manifest = await verifyProviderContractGoldenManifestV1(
      goldenInput,
      cryptoHost,
    );
    expect(manifest.stableIdVectors).toHaveLength(2);
    expect(manifest.hmacVectors).toHaveLength(1);
    expect(manifest.canonicalJsonVectors).toHaveLength(6);
    expect(manifest.canonicalJsonVectors[3]!.expectedUtf8Hex).not.toBe(
      manifest.canonicalJsonVectors[4]!.expectedUtf8Hex,
    );
  });

  it("verifies every tracked negative descriptor", async () => {
    const negative = await verifyProviderContractNegativeManifestV1(
      negativeInput,
      goldenInput,
      cryptoHost,
    );
    expect(negative.cases).toHaveLength(80);
    expect(new Set(negative.cases.map(({ caseId }) => caseId)).size).toBe(
      negative.cases.length,
    );
    expect(new Set(negative.cases.map(({ kind }) => kind))).toEqual(
      new Set([
        "canonical_bytes",
        "unsupported_value",
        "schema",
        "utf8_bytewise_string_set",
        "substitution",
      ]),
    );
  });

  it("fails closed when an expected byte or cryptographic result changes", async () => {
    const mutated = structuredClone(
      ProviderContractGoldenManifestV1Schema.parse(goldenInput),
    );
    mutated.stableIdVectors[0].expected.sha256Hex = "0".repeat(64);
    await expect(
      verifyProviderContractGoldenManifestV1(mutated, cryptoHost),
    ).rejects.toThrow(/mismatch/u);
  });

  it("rejects unknown manifest fields and missing negative coverage", () => {
    expect(() =>
      ProviderContractGoldenManifestV1Schema.parse({
        ...(goldenInput as Record<string, unknown>),
        unexpected: true,
      }),
    ).toThrow();
    expect(() =>
      ProviderContractNegativeManifestV1Schema.parse({
        ...(negativeInput as Record<string, unknown>),
        cases: [],
      }),
    ).toThrow();
  });
});
