import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import {
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_CASE_IDS_V1,
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_RESOURCE_PATH_V1,
  ProviderRealFilesystemConformanceResultFixtureError,
  ProviderRealFilesystemConformanceResultInvalidManifestV1Schema,
  executeProviderRealFilesystemConformanceResultInvalidCaseV1,
  verifyProviderRealFilesystemConformanceResultGoldenResourceV1,
  verifyProviderRealFilesystemConformanceResultInvalidResourceV1,
} from "../src/provider-real-filesystem-conformance-result-fixtures.js";
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
    readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url))),
  );
}

const goldenBytes = resourceBytes(
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_PATH_V1,
);
const invalidBytes = resourceBytes(
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_RESOURCE_PATH_V1,
);
const strictManifestBytes = resourceBytes(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1);
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
        ) throw new TypeError("unexpected fixed resource request");
        return strictManifestBytes;
      },
    }),
  });
});

describe("real filesystem conformance result fixture resources", () => {
  it("verifies immutable golden bytes and the unsigned point closure", async () => {
    const result = await verifyProviderRealFilesystemConformanceResultGoldenResourceV1(
      goldenBytes,
      capability,
    );
    expect(result.authority).toBe("none_real_fs_conformance_result_structure_only");
    expect(result.resultClosure.caseResultCount).toBe(8);
    expect(result.resultClosure.passedCaseResultCount).toBe(8);
    expect(result.manifest.expected.targetMatchCount).toBe(1);
    expect(result.manifest.expected.signatureVerificationCount).toBe(6);
    expect(result.manifest.expected.resultSignatureCount).toBe(0);
    expect(result.resultClosure.relativePath).toBe(result.manifest.expected.relativePath);
  });

  it("verifies the exact ordered 50-case executable inventory", () => {
    const manifest = verifyProviderRealFilesystemConformanceResultInvalidResourceV1(
      invalidBytes,
    );
    expect(manifest.fixtureAuthority).toBe("none_rejection_only");
    expect(manifest.caseCount).toBe(50);
    expect(manifest.caseIds).toEqual(
      PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_CASE_IDS_V1,
    );
    expect(manifest.cases).toHaveLength(50);
    expect(
      new Set(
        manifest.cases.map(
          (entry) => entry.expected.materializedRequestSemanticDigest,
        ),
      ).size,
    ).toBe(50);
    expect(manifest.cases.map((entry) => entry.expected.boundary)).toContain(
      "internal_diagnostic",
    );
    expect(manifest.cases.map((entry) => entry.expected.boundary)).toContain(
      "locator_builder",
    );
    expect(manifest.cases.map((entry) => entry.expected.boundary)).toContain(
      "snapshot_stability",
    );

    const tamperedOperation = JSON.parse(
      new TextDecoder().decode(invalidBytes),
    ) as typeof manifest;
    tamperedOperation.cases[0]!.mutation.operation =
      PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_CASE_IDS_V1[1]!;
    expect(() =>
      ProviderRealFilesystemConformanceResultInvalidManifestV1Schema.parse(
        tamperedOperation,
      ),
    ).toThrow();
  });

  it("replays every ordered case against its exact expected boundary", async () => {
    const golden = await verifyProviderRealFilesystemConformanceResultGoldenResourceV1(
      goldenBytes,
      capability,
    );
    const invalid = verifyProviderRealFilesystemConformanceResultInvalidResourceV1(
      invalidBytes,
    );
    let executedCaseCount = 0;
    for (const [index, invalidCase] of invalid.cases.entries()) {
      expect(invalidCase.caseId).toBe(invalid.caseIds[index]);
      expect(invalidCase.mutation.operation).toBe(invalidCase.caseId);
      const outcome =
        await executeProviderRealFilesystemConformanceResultInvalidCaseV1(
          golden.manifest,
          invalidCase.mutation.operation,
          capability,
        );
      if (invalidCase.expected.boundary === "snapshot_stability") {
        expect(outcome).toEqual({
          kind: "snapshot_acceptance",
          boundary: "snapshot_stability",
          authority: invalidCase.expected.authority,
          caseResultCount: invalidCase.expected.caseResultCount,
          passedCaseResultCount: invalidCase.expected.passedCaseResultCount,
        });
      } else if (invalidCase.expected.boundary === "locator_builder") {
        expect(outcome).toEqual({
          kind: "rejection",
          boundary: "locator_builder",
          stage: invalidCase.expected.stage,
          reason: invalidCase.expected.reason,
        });
      } else {
        expect(outcome).toEqual({
          kind: "rejection",
          boundary: "internal_diagnostic",
          stage: invalidCase.expected.stage,
          reason: invalidCase.expected.reason,
          publicFailure: invalidCase.expected.publicFailure,
        });
      }
      executedCaseCount += 1;
    }
    expect(executedCaseCount).toBe(invalid.caseCount);
  }, 120_000);

  it("rejects raw-byte substitutions", async () => {
    const changedGolden = goldenBytes.slice();
    changedGolden[changedGolden.length - 2] = changedGolden[changedGolden.length - 2]! ^ 1;
    await expect(
      verifyProviderRealFilesystemConformanceResultGoldenResourceV1(
        changedGolden,
        capability,
      ),
    ).rejects.toBeInstanceOf(ProviderRealFilesystemConformanceResultFixtureError);

    const changedInvalid = invalidBytes.slice();
    changedInvalid[changedInvalid.length - 2] = changedInvalid[changedInvalid.length - 2]! ^ 1;
    expect(() =>
      verifyProviderRealFilesystemConformanceResultInvalidResourceV1(changedInvalid),
    ).toThrow(ProviderRealFilesystemConformanceResultFixtureError);
  });
});
