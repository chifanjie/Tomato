import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_CASE_IDS_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
  ProviderRegistryRootHistoryFixtureError,
  verifyProviderRegistryRootHistoryGoldenManifestResourceV1,
  verifyProviderRegistryRootHistoryInvalidManifestResourceV1,
} from "../src/provider-registry-root-history-fixtures.js";

const goldenBytes = readFileSync(
  fileURLToPath(
    new URL(
      "../fixtures/v1/golden/provider-registry-root-history-v1.json",
      import.meta.url,
    ),
  ),
);
const invalidBytes = readFileSync(
  fileURLToPath(
    new URL(
      "../fixtures/v1/invalid/provider-registry-root-history-v1.json",
      import.meta.url,
    ),
  ),
);

function rawSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("provider registry root history cross-language fixtures", () => {
  it("anchors and parses the exact three-generation golden resource", () => {
    expect(goldenBytes.byteLength).toBe(
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    );
    expect(rawSha256(goldenBytes)).toBe(
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
    );
    expect(
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    ).toBe(
      "sha256:a57984671d7761e19a3fa04c704d7147bb8e3809994c554b46ca8c0dc7b3f922",
    );

    const manifest =
      verifyProviderRegistryRootHistoryGoldenManifestResourceV1(
        new Uint8Array(goldenBytes),
      );
    expect(manifest.fixtureAuthority).toBe(
      "none_structure_and_history_only",
    );
    expect(
      manifest.rootMetadataHistory.map(
        ({ payload }) => payload.activation,
      ),
    ).toEqual([
      "bootstrap",
      "planned_rollover",
      "compromise_recovery",
    ]);
    expect(manifest.expected.rootMetadataCount).toBe(3);
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.rootMetadataHistory)).toBe(true);
  });

  it("anchors and exact-covers all 31 executable rejection recipes", () => {
    expect(invalidBytes.byteLength).toBe(
      PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1,
    );
    expect(rawSha256(invalidBytes)).toBe(
      PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1,
    );
    expect(
      PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
    ).toBe(
      "sha256:d20735dc3d5f06a9cc12e990b72f11cf3a6e6a1f7561552b763b21fb4816cdab",
    );

    const manifest =
      verifyProviderRegistryRootHistoryInvalidManifestResourceV1(
        new Uint8Array(invalidBytes),
      );
    expect(manifest.fixtureAuthority).toBe("none_rejection_only");
    expect(manifest.cases.map(({ caseId }) => caseId)).toEqual(
      PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_CASE_IDS_V1,
    );
    expect(
      new Set(
        manifest.cases.map(
          ({ mutation }) =>
            `${mutation.operation}:${mutation.targetJsonPointer}:${JSON.stringify(
              mutation.operands,
            )}`,
        ),
      ).size,
    ).toBe(manifest.cases.length);
    expect(
      manifest.cases.every(
        ({ expected }) =>
          expected.publicFailureReason === "attestation_invalid",
      ),
    ).toBe(true);
  });

  it("rejects raw aliases and coherent semantic substitutions", () => {
    const golden = JSON.parse(
      goldenBytes.toString("utf8"),
    ) as Record<string, unknown>;
    const compactAlias = new TextEncoder().encode(
      JSON.stringify(golden),
    );
    expect(() =>
      verifyProviderRegistryRootHistoryGoldenManifestResourceV1(
        compactAlias,
      ),
    ).toThrow(ProviderRegistryRootHistoryFixtureError);

    const substituted = structuredClone(golden);
    (
      substituted.deterministicSeeds as Record<string, unknown>
    ).purpose = "non_production_fixture_only";
    (
      substituted.expected as Record<string, unknown>
    ).canonicalEnvelopeLogicalBytes =
      Number(
        (
          substituted.expected as Record<string, unknown>
        ).canonicalEnvelopeLogicalBytes,
      ) + 1;
    const substitutedBytes = new TextEncoder().encode(
      `${JSON.stringify(substituted, null, 2)}\n`,
    );
    expect(() =>
      verifyProviderRegistryRootHistoryGoldenManifestResourceV1(
        substitutedBytes,
      ),
    ).toThrow(ProviderRegistryRootHistoryFixtureError);

    const invalid = new Uint8Array(invalidBytes);
    const tamperedIndex = invalid.byteLength - 2;
    invalid[tamperedIndex] = invalid[tamperedIndex]! ^ 1;
    expect(() =>
      verifyProviderRegistryRootHistoryInvalidManifestResourceV1(
        invalid,
      ),
    ).toThrow(ProviderRegistryRootHistoryFixtureError);
  });

  it("rejects hostile and oversized byte views before parsing", () => {
    class HostileBytes extends Uint8Array {
      override get byteLength(): number {
        throw new Error("must not invoke subclass getter");
      }
    }
    expect(() =>
      verifyProviderRegistryRootHistoryGoldenManifestResourceV1(
        new HostileBytes(goldenBytes),
      ),
    ).toThrow(ProviderRegistryRootHistoryFixtureError);

    const proxied = new Proxy(new Uint8Array(goldenBytes), {
      get() {
        throw new Error("must not read proxy bytes");
      },
    });
    expect(() =>
      verifyProviderRegistryRootHistoryGoldenManifestResourceV1(
        proxied,
      ),
    ).toThrow(ProviderRegistryRootHistoryFixtureError);

    expect(() =>
      verifyProviderRegistryRootHistoryGoldenManifestResourceV1(
        new Uint8Array(4_194_305),
      ),
    ).toThrow(ProviderRegistryRootHistoryFixtureError);
  });
});
