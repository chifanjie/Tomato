import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../src/jcs.js";
import { validateProviderRegistryEvidenceBindingPointClosureV1 } from "../src/provider-registry-evidence-binding-point.js";
import * as FixtureExports from "../src/provider-registry-evidence-binding-point-fixtures.js";
import {
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_AGGREGATE_CONTENT_DIGEST_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_CASE_IDS_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SEMANTIC_DOMAIN_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_POINT_SPECIFIC_INVALID_CASE_IDS_V1,
  ProviderRegistryEvidenceBindingPointCompatibleBaseV1Schema,
  ProviderRegistryEvidenceBindingPointFixtureError,
  ProviderRegistryEvidenceBindingPointGoldenManifestV1Schema,
  ProviderRegistryEvidenceBindingPointInvalidManifestV1Schema,
  ProviderRegistryEvidenceBindingPointSuccessProjectionV1Schema,
  materializeProviderRegistryEvidenceBindingPointInvalidCaseV1,
  materializeProviderRegistryEvidenceBindingPointGoldenRequestV1,
  projectProviderRegistryEvidenceBindingPointClosureSnapshotV1,
  type ProviderRegistryEvidenceBindingPointInvalidCaseIdV1,
  verifyProviderRegistryEvidenceBindingPointGoldenResourceV1,
  verifyProviderRegistryEvidenceBindingPointInvalidResourceV1,
} from "../src/provider-registry-evidence-binding-point-fixtures.js";
// @ts-expect-error Package-internal Registry adapter helpers intentionally have no declaration output.
import { deriveProviderRegistryEvidenceBindingRegistryAdapterMaterializedRequestDigestV1 } from "../scripts/lib/provider-registry-evidence-binding-point-registry-adapter.mjs";
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

const knownRegistryInvalidCaseIdV1:
  ProviderRegistryEvidenceBindingPointInvalidCaseIdV1 =
    "registry-history-empty";
// @ts-expect-error Registry-derived case IDs are a closed literal union.
const unknownRegistryInvalidCaseIdV1:
  ProviderRegistryEvidenceBindingPointInvalidCaseIdV1 =
    "registry-not-a-real-case";
void knownRegistryInvalidCaseIdV1;
void unknownRegistryInvalidCaseIdV1;

function resourceBytes(relativePath: string): Uint8Array {
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url))),
  );
}

function semanticDigest(domain: string, value: object): string {
  return `sha256:${createHash("sha256")
    .update(canonicalizeJcsSafeIntegerUtf8V1([domain, value]))
    .digest("hex")}`;
}

function assertRecursivelyFrozen(
  value: object,
  seen = new Set<object>(),
): void {
  if (seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === "object") {
      assertRecursivelyFrozen(child, seen);
    }
  }
}

const goldenBytes = resourceBytes(
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_PATH_V1,
);
const invalidBytes = resourceBytes(
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_PATH_V1,
);
const strictManifestBytes = resourceBytes(
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
);
let pointCalls = 0;
let signatureCalls = 0;
let capability: ProviderStrictEd25519OpaqueCapabilityV1;

beforeAll(async () => {
  capability = await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint(point: Uint8Array) {
        pointCalls += 1;
        return validatePrimeSubgroupPoint(point);
      },
      async verifyRawEd25519(
        publicKey: Uint8Array,
        message: Uint8Array,
        signature: Uint8Array,
      ) {
        signatureCalls += 1;
        return verifyRawEd25519(publicKey, message, signature);
      },
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(path: string, maxBytes: number) {
        if (
          path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
          maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
        ) {
          throw new TypeError("unexpected strict Ed25519 resource request");
        }
        return strictManifestBytes;
      },
    }),
  });
  pointCalls = 0;
  signatureCalls = 0;
});

describe("provider Registry Entry/Evidence binding point fixtures", () => {
  it("verifies the immutable raw and semantic anchors before returning a frozen strict manifest", () => {
    expect(goldenBytes.byteLength).toBe(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    );
    expect(createHash("sha256").update(goldenBytes).digest("hex")).toBe(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
    );
    const manifest =
      verifyProviderRegistryEvidenceBindingPointGoldenResourceV1(goldenBytes);
    const { semanticContentDigest: _semanticContentDigest, ...semanticFields } =
      manifest;
    expect(
      semanticDigest(
        PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
        semanticFields,
      ),
    ).toBe(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    );
    expect(manifest.semanticContentDigest).toBe(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    );
    expect(manifest.expected.registryCryptoClosure).toEqual({
      pointAdmissionCount: 24,
      signatureVerificationCount: 38,
    });
    expect(manifest.expected.completeCryptoClosure).toEqual({
      pointAdmissionCount: 24,
      signatureVerificationCount: 46,
    });
    expect(manifest.expected.manifestGenerationDigests).toHaveLength(7);
    assertRecursivelyFrozen(manifest);

    const tamperedBytes = goldenBytes.slice();
    tamperedBytes[tamperedBytes.byteLength - 1] = 0x20;
    expect(() =>
      verifyProviderRegistryEvidenceBindingPointGoldenResourceV1(tamperedBytes),
    ).toThrow(ProviderRegistryEvidenceBindingPointFixtureError);
  });

  it("uses strict schemas for the top level, compatible base, and every projection layer", () => {
    const manifest =
      verifyProviderRegistryEvidenceBindingPointGoldenResourceV1(goldenBytes);
    expect(
      ProviderRegistryEvidenceBindingPointGoldenManifestV1Schema.safeParse({
        ...manifest,
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(
      ProviderRegistryEvidenceBindingPointCompatibleBaseV1Schema.safeParse({
        ...manifest.compatibleBase,
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(
      ProviderRegistryEvidenceBindingPointGoldenManifestV1Schema.safeParse({
        ...manifest,
        dependencies: {
          ...manifest.dependencies,
          registryGolden: {
            ...manifest.dependencies.registryGolden,
            unexpected: true,
          },
        },
      }).success,
    ).toBe(false);
    expect(
      ProviderRegistryEvidenceBindingPointSuccessProjectionV1Schema.safeParse({
        ...manifest.expected.successProjection,
        unexpected: true,
      }).success,
    ).toBe(false);
  });

  it("materializes fresh detached 22-field requests with only the opaque capability retained by identity", () => {
    const manifest =
      verifyProviderRegistryEvidenceBindingPointGoldenResourceV1(goldenBytes);
    const first =
      materializeProviderRegistryEvidenceBindingPointGoldenRequestV1(
        manifest,
        capability,
      );
    const second =
      materializeProviderRegistryEvidenceBindingPointGoldenRequestV1(
        manifest,
        capability,
      );
    expect(Object.keys(manifest.compatibleBase)).toHaveLength(21);
    expect(Object.keys(first)).toEqual([
      "activeRoot",
      "activeRootMetadata",
      "bootstrapTrustBundle",
      "distributionRootBinding",
      "fixtureCorpusManifest",
      "installationIdentityGenerationId",
      "providerFeasibilityEvidence",
      "providerFeasibilityEvidencePin",
      "publicSupportTaxonomy",
      "realFilesystemConformanceResult",
      "realFilesystemConformanceResultLocator",
      "realFilesystemConformanceResultPin",
      "registryManifestHistory",
      "releaseMatrix",
      "rootMetadataHistory",
      "runtimeAttestation",
      "semanticProviderPolicy",
      "strictCryptoCapability",
      "suiteManifest",
      "targetDiscoveryFixtureManifest",
      "targetDiscoveryResult",
      "targetDiscoveryRunnerRun",
    ]);
    expect(first).not.toBe(second);
    expect(first.strictCryptoCapability).toBe(capability);
    expect(second.strictCryptoCapability).toBe(capability);
    expect(first.rootMetadataHistory).not.toBe(second.rootMetadataHistory);
    expect(first.registryManifestHistory).not.toBe(
      second.registryManifestHistory,
    );
    expect(first.providerFeasibilityEvidence).not.toBe(
      second.providerFeasibilityEvidence,
    );
    expect(first.rootMetadataHistory[0]).not.toBe(
      manifest.compatibleBase.rootMetadataHistory[0],
    );
    expect(first.registryManifestHistory[0]).not.toBe(
      manifest.compatibleBase.registryManifestHistory[0],
    );
    expect(first).not.toHaveProperty("authority");
    expect(first).not.toHaveProperty("fixtureAuthority");
    expect(first).not.toHaveProperty("callerAuthority");
    expect(first).not.toHaveProperty("compatibleBase");
  });

  it("materializes the sparse Registry source witness as the exact one-slot hole and digest", () => {
    const golden =
      verifyProviderRegistryEvidenceBindingPointGoldenResourceV1(goldenBytes);
    const invalid =
      verifyProviderRegistryEvidenceBindingPointInvalidResourceV1(invalidBytes);
    const invalidCase = invalid.cases.find(
      ({ caseId }) => caseId === "registry-history-sparse-array",
    );
    expect(invalidCase).toBeDefined();

    const prepared =
      materializeProviderRegistryEvidenceBindingPointInvalidCaseV1(
        golden,
        invalidCase!,
        capability,
      );
    expect(prepared.request).not.toBeNull();
    expect(typeof prepared.request).toBe("object");
    const history = (
      prepared.request as { readonly registryManifestHistory: unknown }
    ).registryManifestHistory;
    expect(Array.isArray(history)).toBe(true);
    if (!Array.isArray(history)) {
      throw new TypeError("sparse Registry history witness must be an array");
    }
    expect(history).toHaveLength(1);
    expect(Object.keys(history)).toEqual([]);
    expect(Object.hasOwn(history, 0)).toBe(false);
    expect(
      deriveProviderRegistryEvidenceBindingRegistryAdapterMaterializedRequestDigestV1(
        prepared.request,
      ),
    ).toBe(
      "sha256:46fd075afc173baf636917cdfb202fcc795a3cf89198f28e41628017a01dc89d",
    );
    expect(invalidCase!.outerExpected.materializedRequestSemanticDigest).toBe(
      "sha256:46fd075afc173baf636917cdfb202fcc795a3cf89198f28e41628017a01dc89d",
    );
  });

  it("projects the real 24/46 closure to the complete frozen ten-field snapshot", async () => {
    const manifest =
      verifyProviderRegistryEvidenceBindingPointGoldenResourceV1(goldenBytes);
    pointCalls = 0;
    signatureCalls = 0;
    const closure = await validateProviderRegistryEvidenceBindingPointClosureV1(
      materializeProviderRegistryEvidenceBindingPointGoldenRequestV1(
        manifest,
        capability,
      ),
    );
    expect(pointCalls).toBe(24);
    expect(signatureCalls).toBe(46);
    const projection =
      projectProviderRegistryEvidenceBindingPointClosureSnapshotV1(closure);
    expect(Object.keys(projection)).toHaveLength(10);
    expect(projection).toEqual(manifest.expected.successProjection);
    expect(
      ProviderRegistryEvidenceBindingPointSuccessProjectionV1Schema.parse(
        projection,
      ),
    ).toEqual(projection);
    assertRecursivelyFrozen(projection);
  });

  it("does not export internal helpers or a caller-usable authority token", () => {
    const names = Object.keys(FixtureExports);
    expect(names.some((name) => /internal|helper/iu.test(name))).toBe(false);
    expect(names).not.toContain(
      "PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1",
    );
    expect(names).not.toContain("jsonCloneV1");
    expect(names).not.toContain("semanticDigestV1");
    expect(names).not.toContain("rawSha256HexV1");
  });

  it("verifies the complete 354-row invalid/semantic inventory and exact 32-row shards", () => {
    expect(invalidBytes.byteLength).toBe(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
    );
    expect(createHash("sha256").update(invalidBytes).digest("hex")).toBe(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
    );
    const manifest =
      verifyProviderRegistryEvidenceBindingPointInvalidResourceV1(invalidBytes);
    expect(manifest.caseIds).toEqual(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_CASE_IDS_V1,
    );
    expect(manifest.caseCount).toBe(354);
    expect(manifest.inheritedEvidenceCaseCount).toBe(227);
    expect(manifest.inheritedRegistryCaseCount).toBe(89);
    expect(manifest.pointSpecificCaseCount).toBe(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_POINT_SPECIFIC_INVALID_CASE_IDS_V1.length,
    );
    expect(manifest.shardSize).toBe(32);
    expect(manifest.maxWorkers).toBe(4);
    expect(manifest.shards).toHaveLength(12);
    expect(manifest.shards.at(-1)).toMatchObject({
      startCaseIndex: 352,
      endCaseIndexExclusive: 354,
      caseCount: 2,
    });
    expect(manifest.aggregateContentDigest).toBe(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_AGGREGATE_CONTENT_DIGEST_V1,
    );
    const { semanticContentDigest: _semanticContentDigest, ...semanticFields } =
      manifest;
    expect(
      semanticDigest(
        PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SEMANTIC_DOMAIN_V1,
        semanticFields,
      ),
    ).toBe(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
    );
    const stage6 = manifest.stageCoverage.find(
      ({ stage }) => stage === "candidate_root_binding",
    );
    const stage11 = manifest.stageCoverage.find(
      ({ stage }) => stage === "registry_policy_binding",
    );
    expect(stage6?.unreachableRejections).toEqual([
      expect.objectContaining({ reason: "identity_mismatch" }),
    ]);
    expect(stage11).toMatchObject({
      traversedBySuccess: true,
      reachableRejection: false,
      rejectionCaseIds: [],
      unreachableRejections: [
        expect.objectContaining({ reason: "binding_mismatch" }),
      ],
    });
    expect(
      ProviderRegistryEvidenceBindingPointInvalidManifestV1Schema.safeParse({
        ...manifest,
        unexpected: true,
      }).success,
    ).toBe(false);
    assertRecursivelyFrozen(manifest);
  });
});
