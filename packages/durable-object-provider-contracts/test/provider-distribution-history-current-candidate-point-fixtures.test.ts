import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import {
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_FIXTURE_MAX_BYTES_V1,
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_FIVE_CHAIN_STRUCTURE_CASE_IDS_V1,
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_FORBIDDEN_EXTRA_KEY_CASE_IDS_V1,
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_HISTORICAL_SIGNATURE_CASE_IDS_V1,
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_HISTORICAL_SEMANTIC_CASE_IDS_V1,
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_CASE_IDS_V1,
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_RESOURCE_PATH_V1,
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_POSITIVE_VECTOR_IDS_V1,
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_RETAINED_EXACT_COVER_CASE_IDS_V1,
  executeProviderDistributionHistoryCurrentCandidatePointInvalidCaseV1,
  materializeProviderDistributionHistoryCurrentCandidatePointInvalidCaseRequestV1,
  materializeProviderDistributionHistoryCurrentCandidatePointPositiveVectorRequestV1,
  verifyProviderDistributionHistoryCurrentCandidatePointGoldenResourceV1,
  verifyProviderDistributionHistoryCurrentCandidatePointInvalidResourceV1,
  verifyProviderDistributionHistoryCurrentCandidatePointPositiveVectorsV1,
  type ProviderDistributionHistoryCurrentCandidatePointExecutionCounterV1,
  type ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1,
  type ProviderDistributionHistoryCurrentCandidatePointInvalidManifestV1,
} from "../src/provider-distribution-history-current-candidate-point-fixtures.js";
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
import { buildTwoGenerationHistoryFixture } from "../scripts/lib/provider-distribution-history-current-candidate-point-fixture.mjs";

const RAW_KEYS_V1 = [
  "bootstrapTrustBundle",
  "distributionRootBinding",
  "installationIdentityGenerationId",
  "providerFeasibilitySupportCandidateArtifacts",
  "providerFeasibilitySupportCatalogHistory",
  "publicSupportTaxonomyHistory",
  "realFilesystemFixtureCorpusManifests",
  "realFilesystemSuiteManifests",
  "registryManifestHistory",
  "releaseMatrixHistory",
  "releaseTargetUniverseHistory",
  "rootMetadataHistory",
  "targetDiscoveryFixtureManifests",
  "targetDiscoveryResultHistory",
  "targetDiscoveryRunnerRuns",
] as const;

const SUCCESS_KEYS_V1 = [
  "authority",
  "catalogPointClosure",
  "currentCatalogProjection",
  "providerFeasibilitySupportCatalogTip",
  "publicSupportTaxonomyTip",
  "releaseMatrixTip",
  "releaseTargetUniverseTip",
  "targetDiscoveryResultTip",
] as const;

function resourceBytes(relativePath: string): Uint8Array {
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url))),
  );
}

function rawSha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function expectRecursivelyFrozenV1(
  value: unknown,
  seen = new Set<object>(),
): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      expectRecursivelyFrozenV1(descriptor.value, seen);
    }
  }
}

const goldenBytes = resourceBytes(
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_PATH_V1,
);
const invalidBytes = resourceBytes(
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_RESOURCE_PATH_V1,
);
const catalogGolden = JSON.parse(
  new TextDecoder().decode(
    resourceBytes(
      "fixtures/v1/golden/provider-feasibility-support-catalog-point-v1.json",
    ),
  ),
);
const strictManifestBytes = resourceBytes(
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
);

let pointAdmissionCount = 0;
let signatureVerificationCount = 0;
let capability: ProviderStrictEd25519OpaqueCapabilityV1;
let goldenManifest: ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1;
let invalidManifest: ProviderDistributionHistoryCurrentCandidatePointInvalidManifestV1;

const executionCounter: ProviderDistributionHistoryCurrentCandidatePointExecutionCounterV1 =
  Object.freeze({
    pointAdmissionCount() {
      return pointAdmissionCount;
    },
    signatureVerificationCount() {
      return signatureVerificationCount;
    },
  });

function resetCryptoCountsV1(): void {
  pointAdmissionCount = 0;
  signatureVerificationCount = 0;
}

beforeAll(async () => {
  goldenManifest =
    verifyProviderDistributionHistoryCurrentCandidatePointGoldenResourceV1(
      goldenBytes,
    );
  invalidManifest =
    verifyProviderDistributionHistoryCurrentCandidatePointInvalidResourceV1(
      invalidBytes,
    );
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
  resetCryptoCountsV1();
});

describe("provider distribution history current-candidate fixture resources", () => {
  it("locks byte anchors, semantic anchors, exact inventories, and browser-safe source", () => {
    expect(goldenBytes.byteLength).toBe(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    );
    expect(rawSha256Hex(goldenBytes)).toBe(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
    );
    expect(invalidBytes.byteLength).toBe(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
    );
    expect(rawSha256Hex(invalidBytes)).toBe(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
    );
    expect(goldenBytes.byteLength).toBeLessThanOrEqual(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_FIXTURE_MAX_BYTES_V1,
    );
    expect(invalidBytes.byteLength).toBeLessThanOrEqual(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_FIXTURE_MAX_BYTES_V1,
    );
    expect(goldenManifest.semanticContentDigest).toBe(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    );
    expect(invalidManifest.semanticContentDigest).toBe(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
    );
    expect(goldenManifest.positiveVectors.map(({ vectorId }) => vectorId)).toEqual(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_POSITIVE_VECTOR_IDS_V1,
    );
    expect(invalidManifest.caseIds).toEqual(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_CASE_IDS_V1,
    );
    expect(new Set(invalidManifest.caseIds).size).toBe(39);
    expect(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_HISTORICAL_SIGNATURE_CASE_IDS_V1,
    ).toHaveLength(3);
    expect(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_HISTORICAL_SEMANTIC_CASE_IDS_V1,
    ).toHaveLength(5);
    expect(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_FORBIDDEN_EXTRA_KEY_CASE_IDS_V1,
    ).toHaveLength(3);
    expect(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_FIVE_CHAIN_STRUCTURE_CASE_IDS_V1,
    ).toHaveLength(15);
    expect(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_RETAINED_EXACT_COVER_CASE_IDS_V1,
    ).toHaveLength(12);
    expect(invalidManifest.catalogCrossPinCaseCount).toBe(1);
    expectRecursivelyFrozenV1(goldenManifest);
    expectRecursivelyFrozenV1(invalidManifest);

    const fixtureSource = readFileSync(
      fileURLToPath(
        new URL(
          "../src/provider-distribution-history-current-candidate-point-fixtures.ts",
          import.meta.url,
        ),
      ),
      "utf8",
    );
    expect(fixtureSource).not.toContain('from "node:');
    expect(fixtureSource).not.toContain("from 'node:");
  });

  it("materializes every positive as a fresh exact 15-key raw to 16-key capability request", () => {
    for (const vector of goldenManifest.positiveVectors) {
      expect(Object.keys(vector.request).sort()).toEqual(RAW_KEYS_V1);
      const first =
        materializeProviderDistributionHistoryCurrentCandidatePointPositiveVectorRequestV1(
          goldenManifest,
          vector.vectorId,
          capability,
        );
      const second =
        materializeProviderDistributionHistoryCurrentCandidatePointPositiveVectorRequestV1(
          goldenManifest,
          vector.vectorId,
          capability,
        );
      expect(first).not.toBe(second);
      expect(first.bootstrapTrustBundle).not.toBe(second.bootstrapTrustBundle);
      expect(Object.keys(first).sort()).toEqual(
        [...RAW_KEYS_V1, "strictCryptoCapability"].sort(),
      );
      expect(Reflect.ownKeys(first)).toHaveLength(16);
      expect(
        Object.getOwnPropertyDescriptor(first, "strictCryptoCapability"),
      ).toMatchObject({
        value: capability,
        enumerable: true,
        configurable: false,
        writable: false,
      });
      expectRecursivelyFrozenV1(first);
      expectRecursivelyFrozenV1(second);
    }
  });

  it(
    "executes genesis, shared, and distinct positives with exact projections and 93/206 aggregate crypto",
    async () => {
      resetCryptoCountsV1();
      const result =
        await verifyProviderDistributionHistoryCurrentCandidatePointPositiveVectorsV1(
          goldenManifest,
          capability,
          executionCounter,
        );
      expect(result.vectors.map(({ vectorId }) => vectorId)).toEqual([
        "genesis",
        "two-generation-shared",
        "two-generation-distinct",
      ]);
      expect(result.vectors.map(({ cryptoCounts }) => cryptoCounts)).toEqual([
        { pointAdmissionCount: 31, signatureVerificationCount: 64 },
        { pointAdmissionCount: 31, signatureVerificationCount: 70 },
        { pointAdmissionCount: 31, signatureVerificationCount: 72 },
      ]);
      expect(result.cryptoCounts).toEqual({
        pointAdmissionCount: 93,
        signatureVerificationCount: 206,
      });
      for (let index = 0; index < result.vectors.length; index += 1) {
        const execution = result.vectors[index]!;
        const vector = goldenManifest.positiveVectors[index]!;
        expect(Object.keys(execution.value).sort()).toEqual(SUCCESS_KEYS_V1);
        expect(execution.value.currentCatalogProjection).toEqual(
          vector.expected.currentCatalogProjection,
        );
      }
      expectRecursivelyFrozenV1(result);
    },
    30_000,
  );

  it("keeps default two-generation builder options byte-for-byte aligned with the distinct vector", () => {
    const built = buildTwoGenerationHistoryFixture(catalogGolden);
    expect(built.request).toEqual(goldenManifest.positiveVectors[2].request);
  });

  it("materializes every invalid case freshly", () => {
    for (const invalidCase of invalidManifest.cases) {
      const first =
        materializeProviderDistributionHistoryCurrentCandidatePointInvalidCaseRequestV1(
          goldenManifest,
          invalidManifest,
          invalidCase.caseId,
          capability,
        );
      const second =
        materializeProviderDistributionHistoryCurrentCandidatePointInvalidCaseRequestV1(
          goldenManifest,
          invalidManifest,
          invalidCase.caseId,
          capability,
        );
      expect(first, invalidCase.caseId).not.toBe(second);
      expect(first.bootstrapTrustBundle, invalidCase.caseId).not.toBe(
        second.bootstrapTrustBundle,
      );
      expect(Reflect.ownKeys(first), invalidCase.caseId).toHaveLength(
        invalidCase.group === "forbidden_extra_key" ? 17 : 16,
      );
      expectRecursivelyFrozenV1(first);
      expectRecursivelyFrozenV1(second);
    }
  });

  it.each(
    PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_INVALID_CASE_IDS_V1,
  )(
    "diagnoses and publicly rejects invalid case %s from fresh requests",
    async (caseId) => {
      resetCryptoCountsV1();
      const invalidCase = invalidManifest.cases.find(
        (candidate) => candidate.caseId === caseId,
      );
      expect(invalidCase).toBeDefined();
      if (invalidCase === undefined) return;
      const execution =
        await executeProviderDistributionHistoryCurrentCandidatePointInvalidCaseV1(
          goldenManifest,
          invalidManifest,
          invalidCase.caseId,
          capability,
          executionCounter,
        );
      expect(execution, invalidCase.caseId).toMatchObject({
        caseId: invalidCase.caseId,
        stage: invalidCase.expected.stage,
        reason: invalidCase.expected.reason,
        publicFailure: invalidCase.expected.publicFailure,
        cryptoCounts: invalidCase.expected.cryptoCounts,
      });
      expectRecursivelyFrozenV1(execution);
    },
    10_000,
  );
});
