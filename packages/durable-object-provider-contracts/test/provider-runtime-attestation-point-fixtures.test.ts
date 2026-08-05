import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../src/jcs.js";
import {
  PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_CASE_IDS_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_PATH_V1,
  ProviderRuntimeAttestationPointFixtureError,
  ProviderRuntimeAttestationPointInvalidManifestV1Schema,
  executeProviderRuntimeAttestationPointInvalidCaseV1,
  materializeProviderRuntimeAttestationPointInvalidRequestWitnessV1,
  verifyProviderRuntimeAttestationPointGoldenResourceV1,
  verifyProviderRuntimeAttestationPointInvalidResourceV1,
} from "../src/provider-runtime-attestation-point-fixtures.js";
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

function semanticDigest(domain: string, value: object): string {
  return `sha256:${createHash("sha256")
    .update(canonicalizeJcsSafeIntegerUtf8V1([domain, value]))
    .digest("hex")}`;
}

const goldenBytes = resourceBytes(
  PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_PATH_V1,
);
const invalidBytes = resourceBytes(
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_PATH_V1,
);
const strictManifestBytes = resourceBytes(
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
);
let pointCalls = 0;
let verifyCalls = 0;
let capability: ProviderStrictEd25519OpaqueCapabilityV1;

beforeAll(async () => {
  capability = await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint(encodedPoint: Uint8Array) {
        pointCalls += 1;
        return validatePrimeSubgroupPoint(encodedPoint);
      },
      async verifyRawEd25519(
        publicKey: Uint8Array,
        message: Uint8Array,
        signature: Uint8Array,
      ) {
        verifyCalls += 1;
        return verifyRawEd25519(publicKey, message, signature);
      },
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(path: string, maxBytes: number) {
        if (
          path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
          maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
        ) {
          throw new TypeError("unexpected fixed resource request");
        }
        return strictManifestBytes;
      },
    }),
  });
  pointCalls = 0;
  verifyCalls = 0;
});

describe("provider runtime attestation point fixture resources", () => {
  it("verifies immutable golden bytes and exact one-point/seven-signature closure", async () => {
    pointCalls = 0;
    verifyCalls = 0;
    const result = await verifyProviderRuntimeAttestationPointGoldenResourceV1(
      goldenBytes,
      capability,
    );
    expect(result.authority).toBe(
      "none_provider_runtime_attestation_structure_only",
    );
    expect(result.pointClosure.conformanceResultClosure.authority).toBe(
      "none_real_fs_conformance_result_structure_only",
    );
    expect(pointCalls).toBe(1);
    expect(verifyCalls).toBe(7);
    expect(result.manifest.expected.runtimeSignatureCount).toBe(1);
    expect(result.manifest.expected.conformanceResultSignatureCount).toBe(0);
  });

  it("freezes the exact ordered inherited and point-specific inventory", () => {
    const manifest = verifyProviderRuntimeAttestationPointInvalidResourceV1(
      invalidBytes,
    );
    expect(manifest.fixtureAuthority).toBe("none_rejection_only");
    expect(manifest.innerCaseCount).toBe(50);
    expect(manifest.pointCaseCount).toBe(72);
    expect(manifest.caseCount).toBe(122);
    expect(manifest.caseIds).toEqual(
      PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_CASE_IDS_V1,
    );
    expect(new Set(manifest.caseIds).size).toBe(manifest.caseCount);
    expect(manifest.caseIds).toEqual(
      expect.arrayContaining([
        "runtime-pin-content-digest-missing",
        "runtime-pin-extra-field",
        "runtime-payload-profile-invalid",
        "runtime-payload-required-field-missing",
        "runtime-generation-zero",
        "runtime-generation-fractional",
        "runtime-generation-unsafe",
        "runtime-issued-at-noncanonical",
        "runtime-issued-at-invalid-date",
        "runtime-os-platform-invalid",
        "runtime-architecture-invalid",
        "runtime-ipc-endpoint-digest-invalid",
        "runtime-signature-format-invalid",
      ]),
    );
    expect(
      new Set(
        manifest.cases.map(
          (entry) => entry.expected.materializedRequestSemanticDigest,
        ),
      ).size,
    ).toBe(manifest.caseCount);
    expect(
      new Set(
        manifest.cases.flatMap((entry) =>
          entry.expected.boundary === "internal_diagnostic"
            ? [entry.expected.stage]
            : [],
        ),
      ),
    ).toEqual(
      new Set([
        "input",
        "conformance_result_closure",
        "semantic_policy_structure",
        "semantic_policy_digest",
        "result_policy_binding",
        "runtime_pin",
        "runtime_structure",
        "runtime_result_binding",
        "runtime_root",
        "runtime_signature",
      ]),
    );
    const tampered = JSON.parse(new TextDecoder().decode(invalidBytes)) as typeof manifest;
    tampered.cases[0]!.mutation.operation = manifest.caseIds[1]!;
    expect(() =>
      ProviderRuntimeAttestationPointInvalidManifestV1Schema.parse(tampered),
    ).toThrow();
    const policyPrecedence = manifest.cases.find(
      (entry) => entry.caseId === "precedence-policy-digest-before-runtime-structure",
    );
    const bindingPrecedence = manifest.cases.find(
      (entry) => entry.caseId === "precedence-result-policy-binding-before-runtime-pin",
    );
    expect(policyPrecedence?.expected).toMatchObject({
      boundary: "internal_diagnostic",
      stage: "semantic_policy_digest",
      reason: "digest_mismatch",
    });
    expect(bindingPrecedence?.expected).toMatchObject({
      boundary: "internal_diagnostic",
      stage: "result_policy_binding",
      reason: "binding_mismatch",
    });
    for (const caseId of [
      "runtime-pin-profile-invalid",
      "runtime-pin-content-digest-missing",
      "runtime-pin-extra-field",
    ] as const) {
      expect(manifest.cases.find((entry) => entry.caseId === caseId)?.expected).toMatchObject({
        boundary: "internal_diagnostic",
        stage: "runtime_pin",
        reason: "schema_invalid",
        pointAdmissionCount: 2,
        signatureVerificationCount: 12,
      });
    }
    for (const caseId of [
      "runtime-payload-profile-invalid",
      "runtime-payload-required-field-missing",
      "runtime-payload-extra-field",
      "runtime-generation-zero",
      "runtime-generation-fractional",
      "runtime-generation-unsafe",
      "runtime-issued-at-noncanonical",
      "runtime-issued-at-invalid-date",
      "runtime-os-platform-invalid",
      "runtime-architecture-invalid",
      "runtime-ipc-endpoint-digest-invalid",
      "runtime-signature-format-invalid",
    ] as const) {
      expect(manifest.cases.find((entry) => entry.caseId === caseId)?.expected).toMatchObject({
        boundary: "internal_diagnostic",
        stage: "runtime_structure",
        reason: "schema_invalid",
        pointAdmissionCount: 2,
        signatureVerificationCount: 12,
      });
    }
  });

  it("replays all recipes at their real first boundary with exact crypto counts", async () => {
    const golden = await verifyProviderRuntimeAttestationPointGoldenResourceV1(
      goldenBytes,
      capability,
    );
    const invalid = verifyProviderRuntimeAttestationPointInvalidResourceV1(
      invalidBytes,
    );
    let executed = 0;
    for (const [index, invalidCase] of invalid.cases.entries()) {
      expect(invalidCase.caseId).toBe(invalid.caseIds[index]);
      expect(invalidCase.mutation.operation).toBe(invalidCase.caseId);
      const materialized =
        materializeProviderRuntimeAttestationPointInvalidRequestWitnessV1(
          golden.manifest,
          invalidCase,
        );
      expect(
        semanticDigest(
          PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
          materialized as object,
        ),
      ).toBe(invalidCase.expected.materializedRequestSemanticDigest);
      pointCalls = 0;
      verifyCalls = 0;
      const outcome = await executeProviderRuntimeAttestationPointInvalidCaseV1(
        golden.manifest,
        invalidCase,
        capability,
      );
      expect(pointCalls).toBe(invalidCase.expected.pointAdmissionCount);
      expect(verifyCalls).toBe(invalidCase.expected.signatureVerificationCount);
      if (invalidCase.expected.boundary === "snapshot_stability") {
        expect(invalidCase.expected.snapshotProjection).toEqual({
          runtimeAttestationContentDigest:
            golden.manifest.runtimeAttestation.contentDigest,
          runtimeAttestationGeneration:
            golden.manifest.runtimeAttestation.payload.attestationGeneration,
          runtimeIssuedAt: golden.manifest.runtimeAttestation.payload.issuedAt,
          runtimeIpcEndpointAttestationDigest:
            golden.manifest.runtimeAttestation.payload
              .ipcEndpointAttestationDigest,
          semanticProviderPolicyDigest:
            golden.manifest.expected.semanticProviderPolicyDigest,
          filesystemProfileDigest:
            golden.manifest.expected.filesystemProfileDigest,
          realFilesystemConformanceResultContentDigest:
            golden.manifest.realFilesystemConformanceResult.contentDigest,
          conformanceCaseResultCount:
            golden.pointClosure.conformanceResultClosure.caseResultCount,
          conformancePassedCaseResultCount:
            golden.pointClosure.conformanceResultClosure.passedCaseResultCount,
          conformanceFailedCaseResultCount:
            golden.pointClosure.conformanceResultClosure.failedCaseResultCount,
          conformanceUnsupportedCaseResultCount:
            golden.pointClosure.conformanceResultClosure
              .unsupportedCaseResultCount,
        });
        expect(
          invalidCase.expected.snapshotProjection
            .conformancePassedCaseResultCount +
            invalidCase.expected.snapshotProjection
              .conformanceFailedCaseResultCount +
            invalidCase.expected.snapshotProjection
              .conformanceUnsupportedCaseResultCount,
        ).toBe(
          invalidCase.expected.snapshotProjection.conformanceCaseResultCount,
        );
        expect(outcome).toEqual({
          kind: "snapshot_acceptance",
          boundary: "snapshot_stability",
          authority: invalidCase.expected.authority,
          snapshotProjection: invalidCase.expected.snapshotProjection,
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
      executed += 1;
    }
    expect(executed).toBe(invalid.caseCount);
  }, 180_000);

  it("rejects raw-byte substitutions before semantic use", async () => {
    const changedGolden = goldenBytes.slice();
    changedGolden[changedGolden.length - 2] =
      changedGolden[changedGolden.length - 2]! ^ 1;
    await expect(
      verifyProviderRuntimeAttestationPointGoldenResourceV1(
        changedGolden,
        capability,
      ),
    ).rejects.toBeInstanceOf(ProviderRuntimeAttestationPointFixtureError);

    const changedInvalid = invalidBytes.slice();
    changedInvalid[changedInvalid.length - 2] =
      changedInvalid[changedInvalid.length - 2]! ^ 1;
    expect(() =>
      verifyProviderRuntimeAttestationPointInvalidResourceV1(changedInvalid),
    ).toThrow(ProviderRuntimeAttestationPointFixtureError);
  });
});
