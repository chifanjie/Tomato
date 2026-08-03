import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  buildProviderRegistryManifestRelativePathV1,
  buildProviderRegistryRootMetadataRelativePathV1,
  decodeShortStoreFilenameKeyV1,
  encodeStoreFilenameKeyV1,
  HashedStoreFilenameKeyV1Schema,
  PROVIDER_REGISTRY_MANIFEST_LOCATOR_PROFILE_V1,
  ProviderRegistryManifestLocatorV1Schema,
  ShortStoreFilenameKeyV1Schema,
  StoreFilenameKeyV1Schema,
  validateProviderRegistryManifestRelativePathV1,
  verifyStoreFilenameKeyForSemanticIdV1,
} from "../src/provider-fixed-locator.js";

const rootKeyId = "0123456789abcdefabcdef";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

describe("StoreFilenameKeyV1 canonical codec", () => {
  it("matches the RFC 4648 base32hex vectors in lowercase without padding", () => {
    for (const [semanticId, body] of [
      ["f", "co"],
      ["fo", "cpng"],
      ["foo", "cpnmu"],
      ["foob", "cpnmuog"],
      ["fooba", "cpnmuoj1"],
      ["foobar", "cpnmuoj1e8"],
    ] as const) {
      const key = `id-${body}`;
      expect(encodeStoreFilenameKeyV1(semanticId)).toBe(key);
      expect(decodeShortStoreFilenameKeyV1(key)).toBe(semanticId);
    }
  });

  it("has a stable short golden and round-trips exact semantic bytes", () => {
    const semanticId = "provider-real-fs-result:0123456789abcdefabcdef";
    const key = encodeStoreFilenameKeyV1(semanticId);
    expect(key).toBe(
      "id-e1p6utj9chin4bbiclgmobb6ecmn4pbjelm78ehg64p36d1l6orjgeb1c9hm8pb6c5h66p35co",
    );
    expect(StoreFilenameKeyV1Schema.parse(key)).toBe(key);
    expect(decodeShortStoreFilenameKeyV1(key)).toBe(semanticId);
  });

  it("round-trips Unicode scalars without normalization or BOM loss", () => {
    const values = ["语义:🚀", "\ufeffroot:é", "root:e\u0301"];
    for (const value of values) {
      const key = encodeStoreFilenameKeyV1(value);
      expect(key.startsWith("id-")).toBe(true);
      expect(decodeShortStoreFilenameKeyV1(key)).toBe(value);
    }
    expect(encodeStoreFilenameKeyV1("é")).not.toBe(
      encodeStoreFilenameKeyV1("e\u0301"),
    );
  });

  it("uses the unique short branch through body length 220", () => {
    const semanticId = "a".repeat(137);
    const key = encodeStoreFilenameKeyV1(semanticId);
    expect(key).toBe(`id-${"c5gm2ob1".repeat(27)}c5gg`);
    expect(key.slice("id-".length)).toHaveLength(220);
    expect(ShortStoreFilenameKeyV1Schema.parse(key)).toBe(key);
    expect(decodeShortStoreFilenameKeyV1(key)).toBe(semanticId);
  });

  it("switches only to the full SHA-256 branch above the body limit", () => {
    const semanticId = "a".repeat(138);
    const key = encodeStoreFilenameKeyV1(semanticId);
    expect(key).toBe(`idh-${sha256Hex(semanticId)}`);
    expect(HashedStoreFilenameKeyV1Schema.parse(key)).toBe(key);
    expect(() => decodeShortStoreFilenameKeyV1(key)).toThrow();
    expect(() =>
      ShortStoreFilenameKeyV1Schema.parse(`id-${"A".repeat(221)}`),
    ).toThrow();
  });

  it("chooses the boundary from UTF-8 bytes rather than UTF-16 length", () => {
    const exact137Utf8Bytes = `${"界".repeat(45)}ab`;
    const shortKey = encodeStoreFilenameKeyV1(exact137Utf8Bytes);
    expect(shortKey.slice("id-".length)).toHaveLength(220);
    expect(decodeShortStoreFilenameKeyV1(shortKey)).toBe(exact137Utf8Bytes);

    const overBoundaryUtf8Bytes = `${exact137Utf8Bytes}a`;
    expect(new TextEncoder().encode(overBoundaryUtf8Bytes)).toHaveLength(138);
    expect(encodeStoreFilenameKeyV1(overBoundaryUtf8Bytes)).toBe(
      `idh-${sha256Hex(overBoundaryUtf8Bytes)}`,
    );
  });

  it("stays collision-free after case folding on default desktop filesystems", () => {
    for (const [left, right, expectedLeft, expectedRight] of [
      ["AAG", "AAa", "id-850ke", "id-850m2"],
      ["ࠀ", "ࠚ", "id-s2g80", "id-s2g9k"],
    ] as const) {
      const leftKey = encodeStoreFilenameKeyV1(left);
      const rightKey = encodeStoreFilenameKeyV1(right);
      expect(leftKey).toBe(expectedLeft);
      expect(rightKey).toBe(expectedRight);
      expect(leftKey).toBe(leftKey.toLowerCase());
      expect(rightKey).toBe(rightKey.toLowerCase());
      expect(leftKey.toLowerCase()).not.toBe(rightKey.toLowerCase());
    }
  });

  it("rejects empty IDs, unpaired surrogates, and non-canonical short keys", () => {
    expect(() => encodeStoreFilenameKeyV1("")).toThrow(/non-empty/u);
    expect(() => encodeStoreFilenameKeyV1("high\ud800")).toThrow(
      /unpaired high surrogate/u,
    );
    expect(() => encodeStoreFilenameKeyV1("low\udc00")).toThrow(
      /unpaired low surrogate/u,
    );
    for (const key of [
      "id-",
      "id-c4==",
      "id-c5",
      "id-vs",
      "id-000",
      "id-C4",
      "ID-c4",
      `idh-${"A".repeat(64)}`,
      `idh-${"0".repeat(63)}`,
    ]) {
      expect(() => StoreFilenameKeyV1Schema.parse(key), key).toThrow();
    }
  });

  it("verifies hashed keys against the original semantic ID", () => {
    const longId = `long:${"z".repeat(300)}`;
    const longKey = encodeStoreFilenameKeyV1(longId);
    expect(verifyStoreFilenameKeyForSemanticIdV1(longKey, longId)).toBe(
      longKey,
    );

    const substitutedId = `long:${"y".repeat(300)}`;
    expect(() =>
      verifyStoreFilenameKeyForSemanticIdV1(longKey, substitutedId),
    ).toThrow(/exact semantic ID/u);
  });

  it("does not allow callers to force the hashed branch", () => {
    const shortId = "root:1";
    const forcedHash = `idh-${sha256Hex(shortId)}`;
    expect(() =>
      verifyStoreFilenameKeyForSemanticIdV1(forcedHash, shortId),
    ).toThrow(/exact semantic ID/u);

    const longId = "l".repeat(300);
    const shortSubstitution = `id-${"0".repeat(221)}`;
    expect(() => StoreFilenameKeyV1Schema.parse(shortSubstitution)).toThrow();
  });
});

describe("Provider Registry Root Metadata fixed locator", () => {
  it("builds the one canonical relative path from typed semantic fields", () => {
    expect(
      buildProviderRegistryRootMetadataRelativePathV1({
        locatorProfile: "installation_provider_registry_root_metadata_v1",
        rootGeneration: 1,
        rootKeyId,
      }),
    ).toBe(
      "provider/root-metadata/id-64t30c9i6cq3adhn70sm2oj3chimcob2cdi6apg.json",
    );
  });

  it("rejects unsafe generations and malformed root key IDs", () => {
    for (const rootGeneration of [
      0,
      -0,
      -1,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
      Number.POSITIVE_INFINITY,
      Number.NaN,
    ]) {
      expect(() =>
        buildProviderRegistryRootMetadataRelativePathV1({
          locatorProfile: "installation_provider_registry_root_metadata_v1",
          rootGeneration,
          rootKeyId,
        }),
      ).toThrow();
    }
    for (const invalidRootKeyId of [
      rootKeyId.toUpperCase(),
      "0".repeat(21),
      "0".repeat(23),
      `g${"0".repeat(21)}`,
    ]) {
      expect(() =>
        buildProviderRegistryRootMetadataRelativePathV1({
          locatorProfile: "installation_provider_registry_root_metadata_v1",
          rootGeneration: 1,
          rootKeyId: invalidRootKeyId,
        }),
      ).toThrow();
    }
  });

  it("rejects aliases, caller paths, extra and hidden fields", () => {
    const valid = {
      locatorProfile: "installation_provider_registry_root_metadata_v1",
      rootGeneration: 1,
      rootKeyId,
    };
    for (const input of [
      { ...valid, locatorProfile: "provider_registry_root_metadata_v1" },
      { ...valid, path: "provider/root-metadata/latest.json" },
      { ...valid, relativePath: "provider/root-metadata/alias.json" },
      { ...valid, alias: "latest" },
    ]) {
      expect(() =>
        buildProviderRegistryRootMetadataRelativePathV1(input),
      ).toThrow();
    }

    const hidden = Object.defineProperty({ ...valid }, "path", {
      value: "provider/root-metadata/latest.json",
      enumerable: false,
    });
    expect(() =>
      buildProviderRegistryRootMetadataRelativePathV1(hidden),
    ).toThrow(/exact fields/u);
  });

  it("rejects accessors without invoking them", () => {
    let invoked = false;
    const input = {
      locatorProfile: "installation_provider_registry_root_metadata_v1",
      rootGeneration: 1,
    } as Record<string, unknown>;
    Object.defineProperty(input, "rootKeyId", {
      enumerable: true,
      get() {
        invoked = true;
        return rootKeyId;
      },
    });
    expect(() =>
      buildProviderRegistryRootMetadataRelativePathV1(input),
    ).toThrow(/data property/u);
    expect(invoked).toBe(false);
  });

  it("rejects proxies before any value-get trap can select a path", () => {
    let getInvoked = false;
    const proxied = new Proxy(
      {
        locatorProfile: "installation_provider_registry_root_metadata_v1",
        rootGeneration: 1,
        rootKeyId,
      },
      {
        get() {
          getInvoked = true;
          throw new Error("must not read through caller proxy");
        },
      },
    );
    expect(() =>
      buildProviderRegistryRootMetadataRelativePathV1(proxied),
    ).toThrow(/non-proxy/u);
    expect(getInvoked).toBe(false);
  });

  it("rejects custom prototypes and symbol fields", () => {
    const prototypeInput = Object.assign(
      Object.create({ inherited: true }) as Record<string, unknown>,
      {
        locatorProfile: "installation_provider_registry_root_metadata_v1",
        rootGeneration: 1,
        rootKeyId,
      },
    );
    expect(() =>
      buildProviderRegistryRootMetadataRelativePathV1(prototypeInput),
    ).toThrow(/plain data object/u);

    const symbolInput = {
      locatorProfile: "installation_provider_registry_root_metadata_v1",
      rootGeneration: 1,
      rootKeyId,
      [Symbol("path")]: "provider/root-metadata/latest.json",
    };
    expect(() =>
      buildProviderRegistryRootMetadataRelativePathV1(symbolInput),
    ).toThrow(/symbols/u);
  });
});

describe("Provider Registry Manifest fixed locator", () => {
  const generationId =
    "provider-registry-manifest:0123456789abcdefabcdef";
  const valid = {
    locatorProfile: PROVIDER_REGISTRY_MANIFEST_LOCATOR_PROFILE_V1,
    generationId,
  };

  it("builds the one canonical short relative path", () => {
    const locator = ProviderRegistryManifestLocatorV1Schema.parse(valid);
    const path = buildProviderRegistryManifestRelativePathV1(locator);

    expect(path).toBe(
      "provider/registry-manifests/id-e1p6utj9chin4bbicljmisrke9siqrb1dpkmcpbjegt30c9i6cq3adhn70sm2oj3chimcob2cdi6apg.json",
    );
    expect(path).toBe(
      `provider/registry-manifests/${encodeStoreFilenameKeyV1(generationId)}.json`,
    );
    expect(validateProviderRegistryManifestRelativePathV1(valid)).toBe(path);
    expect(path).toContain("/id-");
  });

  it("does not accept a caller-forced hashed alias", () => {
    const canonical = buildProviderRegistryManifestRelativePathV1(valid);
    const forcedHash =
      `provider/registry-manifests/idh-${sha256Hex(generationId)}.json`;
    expect(canonical).not.toBe(forcedHash);

    for (const input of [
      { ...valid, filenameKey: `idh-${sha256Hex(generationId)}` },
      { ...valid, path: forcedHash },
      { ...valid, relativePath: forcedHash },
      { ...valid, alias: "latest" },
    ]) {
      expect(() =>
        buildProviderRegistryManifestRelativePathV1(input),
      ).toThrow(/exact fields/u);
    }
  });

  it("rejects profile, prefix, case and generation-body substitutions", () => {
    for (const input of [
      {
        ...valid,
        locatorProfile: "provider_registry_manifest_v1",
      },
      { ...valid, generationId: generationId.toUpperCase() },
      {
        ...valid,
        generationId: generationId.replace(
          "provider-registry-manifest:",
          "provider_registry_manifest:",
        ),
      },
      {
        ...valid,
        generationId: `provider-registry-manifest:${"0".repeat(21)}`,
      },
      {
        ...valid,
        generationId: `provider-registry-manifest:${"0".repeat(23)}`,
      },
      {
        ...valid,
        generationId: `provider-registry-manifest:g${"0".repeat(21)}`,
      },
    ]) {
      expect(() =>
        buildProviderRegistryManifestRelativePathV1(input),
      ).toThrow();
    }
  });

  it("rejects accessors without invoking them", () => {
    let invoked = false;
    const input = {
      locatorProfile: PROVIDER_REGISTRY_MANIFEST_LOCATOR_PROFILE_V1,
    } as Record<string, unknown>;
    Object.defineProperty(input, "generationId", {
      enumerable: true,
      get() {
        invoked = true;
        return generationId;
      },
    });

    expect(() =>
      buildProviderRegistryManifestRelativePathV1(input),
    ).toThrow(/data property/u);
    expect(invoked).toBe(false);
  });

  it("rejects proxies before a value-get trap can influence lookup", () => {
    let getInvoked = false;
    const proxied = new Proxy(valid, {
      get() {
        getInvoked = true;
        throw new Error("must not read through caller proxy");
      },
    });

    expect(() =>
      buildProviderRegistryManifestRelativePathV1(proxied),
    ).toThrow(/non-proxy/u);
    expect(getInvoked).toBe(false);
  });
});
