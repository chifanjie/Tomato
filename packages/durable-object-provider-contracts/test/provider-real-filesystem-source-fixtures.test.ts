import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import {
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_CASE_IDS_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_RESOURCE_PATH_V1,
  ProviderRealFilesystemSourceFixtureError,
  verifyProviderRealFilesystemSourceGoldenResourceV1,
  verifyProviderRealFilesystemSourceInvalidResourceV1,
} from "../src/provider-real-filesystem-source-fixtures.js";
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

function resourceBytes(relativePath: string): Uint8Array {
  return new Uint8Array(
    readFileSync(
      fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
    ),
  );
}

const goldenBytes = resourceBytes(
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
);
const invalidBytes = resourceBytes(
  PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_RESOURCE_PATH_V1,
);
const strictManifestBytes = resourceBytes(
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
);
let capability: ProviderStrictEd25519OpaqueCapabilityV1;

beforeAll(async () => {
  capability = await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint,
      verifyRawEd25519,
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(path: string, maxBytes: number) {
        if (
          path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
          maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
        ) {
          throw new TypeError("unexpected strict resource request");
        }
        return strictManifestBytes;
      },
    }),
  });
});

describe("real filesystem source fixture resources", () => {
  it("verifies immutable golden bytes and the none-only authority", async () => {
    const result = await verifyProviderRealFilesystemSourceGoldenResourceV1(
      goldenBytes,
      capability,
    );
    expect(result.authority).toBe("none_real_fs_source_structure_only");
    expect(result.sourceClosure.recordCount).toBe(12);
    expect(result.sourceClosure.caseCount).toBe(4);
    expect(result.sourceClosure.requiredCaseCutCount).toBe(8);
  });

  it("verifies the exact ordered invalid corpus inventory", () => {
    const manifest =
      verifyProviderRealFilesystemSourceInvalidResourceV1(invalidBytes);
    expect(manifest.fixtureAuthority).toBe("none_rejection_only");
    expect(manifest.caseIds).toEqual(
      PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_CASE_IDS_V1,
    );
    expect(manifest.cases).toHaveLength(43);
  });

  it("rejects raw-byte and authority substitutions", async () => {
    const changedGolden = goldenBytes.slice();
    changedGolden[changedGolden.length - 2] =
      changedGolden[changedGolden.length - 2]! ^ 1;
    await expect(
      verifyProviderRealFilesystemSourceGoldenResourceV1(
        changedGolden,
        capability,
      ),
    ).rejects.toBeInstanceOf(ProviderRealFilesystemSourceFixtureError);

    const changedInvalid = invalidBytes.slice();
    const marker = new TextEncoder().encode("none_rejection_only");
    const index = Buffer.from(changedInvalid).indexOf(Buffer.from(marker));
    expect(index).toBeGreaterThan(0);
    changedInvalid[index] = "s".charCodeAt(0);
    expect(() =>
      verifyProviderRealFilesystemSourceInvalidResourceV1(changedInvalid),
    ).toThrow(ProviderRealFilesystemSourceFixtureError);
  });
});
