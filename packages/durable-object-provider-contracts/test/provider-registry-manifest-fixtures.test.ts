import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  PROVIDER_REGISTRY_MANIFEST_HISTORY_FIXTURE_MAX_BYTES_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  ProviderRegistryManifestHistoryFixtureError,
  ProviderRegistryManifestHistoryGoldenManifestV1Schema,
  verifyProviderRegistryManifestHistoryGoldenResourceV1,
} from "../src/provider-registry-manifest-fixtures.js";

const goldenBytes = readFileSync(
  fileURLToPath(
    new URL(
      "../fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json",
      import.meta.url,
    ),
  ),
);

function rawSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function expectFixtureRejection(bytes: unknown): void {
  expect(() =>
    verifyProviderRegistryManifestHistoryGoldenResourceV1(bytes),
  ).toThrow(ProviderRegistryManifestHistoryFixtureError);
}

describe("provider Registry Manifest history fixture", () => {
  it("anchors and verifies the exact seven-generation golden resource", () => {
    expect(goldenBytes.byteLength).toBe(
      PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    );
    expect(rawSha256(goldenBytes)).toBe(
      PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
    );
    expect(
      PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    ).toBe(
      "sha256:6c2c8e75f7a4c8e6b43cb151db0dc292146a20182d0fce9b623b346437a0a12a",
    );

    const manifest =
      verifyProviderRegistryManifestHistoryGoldenResourceV1(
        new Uint8Array(goldenBytes),
      );
    expect(manifest.fixtureAuthority).toBe(
      "none_registry_structure_and_history_only",
    );
    expect(
      manifest.registryManifestHistory.map(
        ({ payload }) => payload.manifestGeneration,
      ),
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(
      manifest.expected.manifestVectors.map(
        ({ manifestGeneration }) => manifestGeneration,
      ),
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(manifest.expected.cryptoClosure).toMatchObject({
      postAttestationPointCalls: 24,
      postAttestationSignatureCalls: 38,
    });
    expect(manifest.expected.uniqueClosure).toEqual({
      rootMetadataCount: 3,
      providerVerificationPublicKeyRecordCount: 11,
      bindingDerivationGenerationRecordCount: 2,
      feasibilityApproverPublicKeyRecordCount: 2,
      runtimeAttestationCount: 3,
      registryEntryCount: 4,
      registryManifestCount: 7,
      sourceProviderTombstoneCount: 1,
    });
  });

  it("returns a recursively frozen snapshot independent of caller bytes", () => {
    const callerBytes = new Uint8Array(goldenBytes);
    const manifest =
      verifyProviderRegistryManifestHistoryGoldenResourceV1(callerBytes);
    callerBytes.fill(0);

    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.deterministicSeeds)).toBe(true);
    expect(Object.isFrozen(manifest.registryManifestHistory)).toBe(true);
    expect(Object.isFrozen(manifest.registryManifestHistory[2].payload)).toBe(
      true,
    );
    expect(Object.isFrozen(manifest.expected.manifestVectors)).toBe(true);
    expect(manifest.registryManifestHistory).toHaveLength(7);
    expect(() => {
      (manifest.expected.cryptoClosure as { postAttestationPointCalls: number })
        .postAttestationPointCalls = 999;
    }).toThrow();
  });

  it("rejects raw and coherent semantic tampering", () => {
    const rawTamper = new Uint8Array(goldenBytes);
    rawTamper[rawTamper.byteLength - 2] =
      rawTamper[rawTamper.byteLength - 2]! ^ 1;
    expectFixtureRejection(rawTamper);

    const semanticTamper = JSON.parse(
      goldenBytes.toString("utf8"),
    ) as Record<string, any>;
    semanticTamper.expected.currentRegistryManifest.contentDigest =
      `sha256:${"f".repeat(64)}`;
    semanticTamper.expected.manifestVectors[6].contentDigest =
      semanticTamper.expected.currentRegistryManifest.contentDigest;
    expectFixtureRejection(
      new TextEncoder().encode(
        `${JSON.stringify(semanticTamper, null, 2)}\n`,
      ),
    );
  });

  it("rejects pretty, compact, key-order, BOM and trailing-byte aliases", () => {
    const value = JSON.parse(goldenBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    const reordered = {
      profile: value.profile,
      schemaVersion: value.schemaVersion,
      ...Object.fromEntries(
        Object.entries(value).filter(
          ([key]) => key !== "profile" && key !== "schemaVersion",
        ),
      ),
    };
    const aliases = [
      new TextEncoder().encode(`${JSON.stringify(value, null, 4)}\n`),
      new TextEncoder().encode(JSON.stringify(value)),
      new TextEncoder().encode(`${JSON.stringify(reordered, null, 2)}\n`),
      new Uint8Array([
        0xef,
        0xbb,
        0xbf,
        ...new Uint8Array(goldenBytes),
      ]),
      new Uint8Array([...new Uint8Array(goldenBytes), 0x0a]),
    ];
    for (const alias of aliases) expectFixtureRejection(alias);
  });

  it("rejects Uint8Array subclasses, proxies, Buffers and oversized views", () => {
    let subclassGetterInvoked = false;
    class HostileBytes extends Uint8Array {
      override get byteLength(): number {
        subclassGetterInvoked = true;
        throw new Error("must not invoke subclass getter");
      }
    }
    expectFixtureRejection(new HostileBytes(goldenBytes));
    expect(subclassGetterInvoked).toBe(false);

    let proxyGetInvoked = false;
    const proxied = new Proxy(new Uint8Array(goldenBytes), {
      get() {
        proxyGetInvoked = true;
        throw new Error("must not invoke proxy get trap");
      },
    });
    expectFixtureRejection(proxied);
    expect(proxyGetInvoked).toBe(false);

    expectFixtureRejection(Buffer.from(goldenBytes));
    expectFixtureRejection(
      new Uint8Array(
        PROVIDER_REGISTRY_MANIFEST_HISTORY_FIXTURE_MAX_BYTES_V1 + 1,
      ),
    );
  });

  it("keeps seeds, vectors and expected closure exact and closed", () => {
    const value = JSON.parse(goldenBytes.toString("utf8")) as Record<
      string,
      any
    >;
    expect(() =>
      ProviderRegistryManifestHistoryGoldenManifestV1Schema.parse({
        ...value,
        deterministicSeeds: {
          ...value.deterministicSeeds,
          callerSeed: "00".repeat(32),
        },
      }),
    ).toThrow();
    expect(() =>
      ProviderRegistryManifestHistoryGoldenManifestV1Schema.parse({
        ...value,
        expected: {
          ...value.expected,
          manifestVectors: value.expected.manifestVectors.slice(0, 6),
        },
      }),
    ).toThrow();
    expect(() =>
      ProviderRegistryManifestHistoryGoldenManifestV1Schema.parse({
        ...value,
        expected: {
          ...value.expected,
          uniqueClosure: {
            ...value.expected.uniqueClosure,
            registryEntryCount: 5,
          },
        },
      }),
    ).toThrow();
  });
});
