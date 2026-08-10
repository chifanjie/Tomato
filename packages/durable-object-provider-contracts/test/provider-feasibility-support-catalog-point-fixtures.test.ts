import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import {
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_FIXTURE_MAX_BYTES_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_CASE_IDS_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_RESOURCE_PATH_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_SEMANTIC_DOMAIN_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_POSITIVE_VECTOR_IDS_V1,
  ProviderFeasibilitySupportCatalogPointFixtureError,
  deriveProviderFeasibilitySupportCatalogPointFixtureSemanticContentDigestV1,
  executeProviderFeasibilitySupportCatalogPointInvalidCaseV1,
  materializeProviderFeasibilitySupportCatalogPointInvalidCaseRequestV1,
  verifyProviderFeasibilitySupportCatalogPointGoldenResourceV1,
  verifyProviderFeasibilitySupportCatalogPointInvalidResourceV1,
  verifyProviderFeasibilitySupportCatalogPointPositiveVectorsV1,
  type ProviderFeasibilitySupportCatalogPointGoldenManifestV1,
  type ProviderFeasibilitySupportCatalogPointInvalidCaseIdV1,
  type ProviderFeasibilitySupportCatalogPointInvalidManifestV1,
} from "../src/provider-feasibility-support-catalog-point-fixtures.js";
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

function rawSha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function expectRecursivelyFrozen(
  value: unknown,
  seen = new Set<object>(),
): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      expectRecursivelyFrozen(descriptor.value, seen);
    }
  }
}

const invalidExpectations = [
  ["catalog-target-missing", "catalog_target_exact_cover", "coverage_mismatch", 50, 90],
  ["catalog-target-extra", "catalog_target_exact_cover", "coverage_mismatch", 50, 90],
  ["catalog-target-duplicate", "catalog_target_order", "ordering_invalid", 50, 90],
  ["catalog-provider-duplicate", "catalog_candidate_order", "ordering_invalid", 50, 90],
  ["catalog-evidence-cross-group", "catalog_candidate_binding", "binding_mismatch", 50, 90],
  ["catalog-failed-strong", "catalog_release_disposition", "result_not_passed", 62, 126],
  ["catalog-unsupported-strong", "catalog_release_disposition", "result_not_passed", 62, 126],
] as const satisfies readonly (readonly [
  ProviderFeasibilitySupportCatalogPointInvalidCaseIdV1,
  string,
  string,
  number,
  number,
])[];

const goldenBytes = resourceBytes(
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_PATH_V1,
);
const invalidBytes = resourceBytes(
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_RESOURCE_PATH_V1,
);
const strictManifestBytes = resourceBytes(
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
);

let pointAdmissionCount = 0;
let signatureVerificationCount = 0;
let capability: ProviderStrictEd25519OpaqueCapabilityV1;
let goldenManifest: ProviderFeasibilitySupportCatalogPointGoldenManifestV1;
let invalidManifest: ProviderFeasibilitySupportCatalogPointInvalidManifestV1;

beforeAll(async () => {
  goldenManifest =
    verifyProviderFeasibilitySupportCatalogPointGoldenResourceV1(goldenBytes);
  invalidManifest =
    verifyProviderFeasibilitySupportCatalogPointInvalidResourceV1(invalidBytes);
  capability = await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint(encodedPoint: Uint8Array) {
        pointAdmissionCount += 1;
        return validatePrimeSubgroupPoint(encodedPoint);
      },
      async verifyRawEd25519(
        publicKey: Uint8Array,
        message: Uint8Array,
        signature: Uint8Array,
      ) {
        signatureVerificationCount += 1;
        return verifyRawEd25519(publicKey, message, signature);
      },
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(path: string, maxBytes: number) {
        expect(path).toBe(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1);
        expect(maxBytes).toBe(PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1);
        return strictManifestBytes.slice();
      },
    }),
  });
  pointAdmissionCount = 0;
  signatureVerificationCount = 0;
});

describe("provider feasibility support Catalog point fixture resources", () => {
  it("locks raw bytes, semantic anchors, exact inventories, and frozen admission", () => {
    expect(goldenBytes.byteLength).toBe(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    );
    expect(rawSha256Hex(goldenBytes)).toBe(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
    );
    expect(invalidBytes.byteLength).toBe(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
    );
    expect(rawSha256Hex(invalidBytes)).toBe(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
    );
    expect(goldenBytes.byteLength).toBeLessThanOrEqual(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_FIXTURE_MAX_BYTES_V1,
    );
    expect(invalidBytes.byteLength).toBeLessThanOrEqual(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_FIXTURE_MAX_BYTES_V1,
    );

    const {
      semanticContentDigest: _goldenDigest,
      ...goldenSemanticFields
    } = goldenManifest;
    expect(
      deriveProviderFeasibilitySupportCatalogPointFixtureSemanticContentDigestV1(
        PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
        goldenSemanticFields,
      ),
    ).toBe(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    );
    const {
      semanticContentDigest: _invalidDigest,
      ...invalidSemanticFields
    } = invalidManifest;
    expect(
      deriveProviderFeasibilitySupportCatalogPointFixtureSemanticContentDigestV1(
        PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_SEMANTIC_DOMAIN_V1,
        invalidSemanticFields,
      ),
    ).toBe(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
    );
    expect(goldenManifest.positiveVectors.map((vector) => vector.vectorId))
      .toEqual(PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_POSITIVE_VECTOR_IDS_V1);
    expect(invalidManifest.cases.map((invalidCase) => invalidCase.caseId))
      .toEqual(PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_CASE_IDS_V1);
    const baselineTargets =
      goldenManifest.positiveVectors[0].request.releaseTargetUniverse.payload
        .targets;
    expect(baselineTargets).toHaveLength(2);
    expect(baselineTargets[0]!.publicProfileId).toBe(
      baselineTargets[1]!.publicProfileId,
    );
    for (const field of [
      "osPlatform",
      "osReleaseFamilyCode",
      "architecture",
      "filesystemProfileCode",
    ] as const) {
      expect(baselineTargets[0]!.target[field]).toBe(
        baselineTargets[1]!.target[field],
      );
    }
    for (const field of [
      "osBuildDigest",
      "filesystemFeatureProfileDigest",
      "mountOptionProfileDigest",
    ] as const) {
      expect(baselineTargets[0]!.target[field]).not.toBe(
        baselineTargets[1]!.target[field],
      );
    }
    const expectedSecondResults = [
      "passed",
      "passed",
      "failed",
      "unsupported",
    ] as const;
    const expectedSecondDispositions = [
      "strong_read_write",
      "legacy_redacted_read_only",
      "legacy_redacted_read_only",
      "legacy_redacted_read_only",
    ] as const;
    for (
      let index = 0;
      index < goldenManifest.positiveVectors.length;
      index += 1
    ) {
      const vector = goldenManifest.positiveVectors[index]!;
      expect(
        vector.request.providerFeasibilitySupportCandidateArtifacts[0]!
          .realFilesystemConformanceResult.payload.result,
      ).toBe("passed");
      expect(
        vector.request.providerFeasibilitySupportCandidateArtifacts[1]!
          .realFilesystemConformanceResult.payload.result,
      ).toBe(expectedSecondResults[index]);
      expect(
        vector.request.providerFeasibilitySupportCatalog.payload.targets[0]!
          .candidates[0]!.releaseDisposition,
      ).toBe("strong_read_write");
      expect(
        vector.request.providerFeasibilitySupportCatalog.payload.targets[1]!
          .candidates[0]!.releaseDisposition,
      ).toBe(expectedSecondDispositions[index]);
    }
    expectRecursivelyFrozen(goldenManifest);
    expectRecursivelyFrozen(invalidManifest);
    expect(pointAdmissionCount).toBe(0);
    expect(signatureVerificationCount).toBe(0);
  });

  it("fails closed on a one-byte raw-anchor change and on unadmitted manifests", async () => {
    const changedGolden = goldenBytes.slice();
    const goldenMutationIndex = changedGolden.byteLength - 2;
    changedGolden[goldenMutationIndex] =
      changedGolden[goldenMutationIndex]! ^ 1;
    expect(() =>
      verifyProviderFeasibilitySupportCatalogPointGoldenResourceV1(
        changedGolden,
      ),
    ).toThrow(ProviderFeasibilitySupportCatalogPointFixtureError);
    const changedInvalid = invalidBytes.slice();
    const invalidMutationIndex = changedInvalid.byteLength - 2;
    changedInvalid[invalidMutationIndex] =
      changedInvalid[invalidMutationIndex]! ^ 1;
    expect(() =>
      verifyProviderFeasibilitySupportCatalogPointInvalidResourceV1(
        changedInvalid,
      ),
    ).toThrow(ProviderFeasibilitySupportCatalogPointFixtureError);

    const unadmitted = JSON.parse(
      new TextDecoder().decode(goldenBytes),
    ) as ProviderFeasibilitySupportCatalogPointGoldenManifestV1;
    await expect(
      verifyProviderFeasibilitySupportCatalogPointPositiveVectorsV1(
        unadmitted,
        capability,
      ),
    ).rejects.toBeInstanceOf(
      ProviderFeasibilitySupportCatalogPointFixtureError,
    );
  });

  it("executes all four genuine positive vectors with exact 2/2/1 projections", async () => {
    const beforePoint = pointAdmissionCount;
    const beforeSignature = signatureVerificationCount;
    const pending =
      verifyProviderFeasibilitySupportCatalogPointPositiveVectorsV1(
        goldenManifest,
        capability,
      );
    expect(Object.isFrozen(pending)).toBe(true);
    const execution = await pending;

    expect(execution.vectors.map((vector) => vector.vectorId)).toEqual(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_POSITIVE_VECTOR_IDS_V1,
    );
    expect(execution.cryptoCounts).toEqual({
      pointAdmissionCount: 124,
      signatureVerificationCount: 256,
    });
    expect(pointAdmissionCount - beforePoint).toBe(124);
    expect(signatureVerificationCount - beforeSignature).toBe(256);
    for (let index = 0; index < execution.vectors.length; index += 1) {
      const vector = execution.vectors[index]!;
      expect(vector.cryptoCounts).toEqual({
        pointAdmissionCount: 31,
        signatureVerificationCount: 64,
      });
      expect(vector.closure.targetCount).toBe(2);
      expect(vector.closure.candidateCount).toBe(2);
      expect(vector.closure.publicSupportRowCount).toBe(1);
      expect(vector.closure.publicSupport).toHaveLength(1);
      expect(
        vector.closure.releaseTargetUniversePointClosure.releaseTargetUniverse
          .payload.targets,
      ).toHaveLength(2);
      expect(
        vector.closure.releaseTargetUniversePointClosure.releaseTargetUniverse
          .payload.buckets,
      ).toHaveLength(1);
      expect(vector.closure.publicSupport[0]!.capability).toBe(
        index === 0
          ? "strong_read_write"
          : "legacy_redacted_read_only",
      );
      expect(
        vector.closure.ownerTargetCapabilities.map(
          (entry) => entry.capability,
        ),
      ).toEqual(
        index === 0
          ? ["strong_read_write", "strong_read_write"]
          : ["strong_read_write", "legacy_redacted_read_only"],
      );
      expectRecursivelyFrozen(vector.closure);
    }
    expectRecursivelyFrozen(execution);
  });

  it.each(invalidExpectations)(
    "executes fresh invalid case %s at exact %s/%s with actual crypto counts",
    async (
      caseId,
      stage,
      reason,
      expectedPointCount,
      expectedSignatureCount,
    ) => {
      const invalidCase = invalidManifest.cases.find(
        (candidate) => candidate.caseId === caseId,
      )!;
      const materializedA =
        materializeProviderFeasibilitySupportCatalogPointInvalidCaseRequestV1(
          invalidManifest,
          caseId,
          capability,
        );
      const materializedB =
        materializeProviderFeasibilitySupportCatalogPointInvalidCaseRequestV1(
          invalidManifest,
          caseId,
          capability,
        );
      expect(materializedA).not.toBe(materializedB);
      expect(Reflect.ownKeys(materializedA)).toHaveLength(18);
      expect(Object.isFrozen(materializedA)).toBe(true);
      expect(
        deriveProviderFeasibilitySupportCatalogPointFixtureSemanticContentDigestV1(
          PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
          invalidCase.request,
        ),
      ).toBe(invalidCase.expected.materializedRequestSemanticDigest);

      const beforePoint = pointAdmissionCount;
      const beforeSignature = signatureVerificationCount;
      const pending =
        executeProviderFeasibilitySupportCatalogPointInvalidCaseV1(
          invalidManifest,
          caseId,
          capability,
        );
      expect(Object.isFrozen(pending)).toBe(true);
      const execution = await pending;

      expect(execution).toEqual({
        caseId,
        stage,
        reason,
        publicFailure: {
          errorName:
            "ProviderFeasibilitySupportCatalogPointClosureValidationError",
          code: "provider_unavailable",
          reason: "attestation_invalid",
        },
        cryptoCounts: {
          pointAdmissionCount: expectedPointCount,
          signatureVerificationCount: expectedSignatureCount,
        },
      });
      expect(pointAdmissionCount - beforePoint).toBe(expectedPointCount);
      expect(signatureVerificationCount - beforeSignature).toBe(
        expectedSignatureCount,
      );
      expectRecursivelyFrozen(execution);
    },
  );
});
