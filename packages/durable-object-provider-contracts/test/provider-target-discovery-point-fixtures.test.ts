import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import {
  PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_TARGET_DISCOVERY_POINT_INVALID_CASE_IDS_V1,
  PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RESOURCE_PATH_V1,
  ProviderTargetDiscoveryPointFixtureError,
  verifyProviderTargetDiscoveryPointGoldenResourceV1,
  verifyProviderTargetDiscoveryPointInvalidResourceV1,
} from "../src/provider-target-discovery-point-fixtures.js";
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
const goldenBytes = resourceBytes(PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_PATH_V1);
const invalidBytes = resourceBytes(PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RESOURCE_PATH_V1);
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

describe("target discovery point fixture resources", () => {
  it("verifies immutable golden bytes, five locators and none-only authority", async () => {
    const result = await verifyProviderTargetDiscoveryPointGoldenResourceV1(goldenBytes, capability);
    expect(result.authority).toBe("none_target_discovery_point_structure_only");
    expect(result.pointClosure.sourceRecordCount).toBe(12);
    expect(result.pointClosure.observationCount).toBe(7);
    expect(result.pointClosure.targetCount).toBe(2);
    expect(result.pointClosure.unresolvedObservationCount).toBe(2);
    expect(Object.keys(result.pointClosure.locators)).toHaveLength(5);
    expect(result.manifest.expected.signatureVerificationCount).toBe(6);
  });

  it("verifies the exact ordered 116-case rejection and executable inventory", () => {
    const manifest = verifyProviderTargetDiscoveryPointInvalidResourceV1(invalidBytes);
    expect(manifest.fixtureAuthority).toBe("none_rejection_only");
    expect(manifest.caseIds).toEqual(PROVIDER_TARGET_DISCOVERY_POINT_INVALID_CASE_IDS_V1);
    expect(manifest.cases).toHaveLength(116);
    expect(new Set(manifest.cases.map((entry) => entry.expected.materializedRequestSemanticDigest)).size).toBe(116);
    expect(manifest.cases.map((entry) => entry.expected.boundary)).toContain("internal_diagnostic");
    expect(manifest.cases.map((entry) => entry.expected.boundary)).toContain("locator_builder");
    expect(manifest.cases.map((entry) => entry.expected.boundary)).toContain("snapshot_stability");
    expect(
      manifest.cases.find((entry) => entry.caseId === "resolved-target-conflict")?.expected,
    ).toMatchObject({
      boundary: "internal_diagnostic",
      stage: "result_projection",
      reason: "conflicting_resolved_targets",
    });
    for (const [caseId, stage] of [
      ["taxonomy-signature-wrong-signer", "taxonomy_signature"],
      ["matrix-signature-wrong-signer", "matrix_signature"],
      ["bundle-signature-wrong-signer", "bundle_signature"],
      ["result-signature-wrong-signer", "result_signature"],
    ] as const) {
      expect(manifest.cases.find((entry) => entry.caseId === caseId)?.expected).toMatchObject({
        boundary: "internal_diagnostic",
        stage,
        reason: "signature_invalid",
      });
    }
  });

  it("rejects raw-byte and authority substitutions", async () => {
    const changedGolden = goldenBytes.slice();
    changedGolden[changedGolden.length - 2] = changedGolden[changedGolden.length - 2]! ^ 1;
    await expect(
      verifyProviderTargetDiscoveryPointGoldenResourceV1(changedGolden, capability),
    ).rejects.toBeInstanceOf(ProviderTargetDiscoveryPointFixtureError);

    const changedInvalid = invalidBytes.slice();
    const marker = Buffer.from("none_rejection_only", "utf8");
    const index = Buffer.from(changedInvalid).indexOf(marker);
    expect(index).toBeGreaterThan(0);
    changedInvalid[index] = "s".charCodeAt(0);
    expect(() => verifyProviderTargetDiscoveryPointInvalidResourceV1(changedInvalid)).toThrow(
      ProviderTargetDiscoveryPointFixtureError,
    );
  });
});
