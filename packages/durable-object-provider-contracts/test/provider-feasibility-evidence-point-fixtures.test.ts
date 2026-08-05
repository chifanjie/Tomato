import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../src/jcs.js";
import {
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_CASE_IDS_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_PATH_V1,
  ProviderFeasibilityEvidencePointFixtureError,
  ProviderFeasibilityEvidencePointInvalidManifestV1Schema,
  executeProviderFeasibilityEvidencePointInvalidCaseV1,
  materializeProviderFeasibilityEvidencePointInvalidRequestWitnessV1,
  verifyProviderFeasibilityEvidencePointGoldenResourceV1,
  verifyProviderFeasibilityEvidencePointInvalidResourceV1,
  verifyProviderFeasibilityEvidencePointPositiveVectorV1,
} from "../src/provider-feasibility-evidence-point-fixtures.js";
import {
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_CASE_IDS_V1,
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
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_PATH_V1,
);
const invalidBytes = resourceBytes(
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_PATH_V1,
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

describe("provider feasibility evidence point fixture resources", () => {
  it("verifies immutable golden bytes at exact three-point/eleven-signature closure", async () => {
    pointCalls = 0;
    verifyCalls = 0;
    const result =
      await verifyProviderFeasibilityEvidencePointGoldenResourceV1(
        goldenBytes,
        capability,
      );
    expect(result.authority).toBe(
      "none_provider_feasibility_evidence_structure_only",
    );
    expect(result.pointClosure.runtimeAttestationPointClosure.authority).toBe(
      "none_provider_runtime_attestation_structure_only",
    );
    expect(pointCalls).toBe(3);
    expect(verifyCalls).toBe(11);
    expect(result.manifest.expected).toMatchObject({
      activeRootPointAdmissionCount: 3,
      signatureVerificationCount: 11,
      approverRecordSignatureCount: 2,
      evidenceSignatureCount: 2,
    });
    expect(Object.isFrozen(result.pointClosure)).toBe(true);
    expect(
      Object.isFrozen(result.pointClosure.providerFeasibilityEvidence.payload),
    ).toBe(true);
  });

  it("accepts passed, failed, and unsupported vectors with exact nanosecond boundaries", async () => {
    const golden =
      await verifyProviderFeasibilityEvidencePointGoldenResourceV1(
        goldenBytes,
        capability,
      );
    expect(golden.manifest.positiveVectors.map((vector) => vector.vectorId)).toEqual([
      "passed-exact-equal",
      "failed-after-one-nanosecond",
      "unsupported-equal-different-fraction-length",
    ]);
    for (const [index, vector] of golden.manifest.positiveVectors.entries()) {
      pointCalls = 0;
      verifyCalls = 0;
      const closure =
        await verifyProviderFeasibilityEvidencePointPositiveVectorV1(
          golden.manifest,
          index,
          capability,
        );
      expect(closure.authority).toBe(golden.authority);
      expect(closure.providerFeasibilityEvidence.payload.result).toBe(
        vector.result,
      );
      expect(closure.providerFeasibilityEvidence.payload.issuedAt).toBe(
        vector.issuedAt,
      );
      expect(pointCalls).toBe(3);
      expect(verifyCalls).toBe(11);
    }
    await expect(
      verifyProviderFeasibilityEvidencePointPositiveVectorV1(
        golden.manifest,
        3,
        capability,
      ),
    ).rejects.toBeInstanceOf(ProviderFeasibilityEvidencePointFixtureError);
  });

  it("freezes 122 inherited cases before the measured 105 point cases", () => {
    const invalid =
      verifyProviderFeasibilityEvidencePointInvalidResourceV1(invalidBytes);
    expect(invalid.runtimeCaseCount).toBe(122);
    expect(invalid.pointCaseCount).toBe(105);
    expect(invalid.caseCount).toBe(227);
    expect(invalid.caseIds).toEqual(
      PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_CASE_IDS_V1,
    );
    expect(new Set(invalid.caseIds).size).toBe(invalid.caseCount);
    for (const [index, sourceOperation] of
      PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_CASE_IDS_V1.entries()) {
      const invalidCase = invalid.cases[index]!;
      expect(invalidCase).toMatchObject({
        caseId: `runtime-${sourceOperation}`,
        group: "runtime_attestation_point",
        mutation: {
          operation: `runtime-${sourceOperation}`,
          recipe: {
            kind: "runtime_attestation_point",
            sourceOperation,
          },
        },
      });
    }
    const inherited = invalid.cases.slice(0, invalid.runtimeCaseCount);
    const inheritedInput = inherited.filter(
      (entry) =>
        entry.expected.boundary === "internal_diagnostic" &&
        entry.expected.stage === "input",
    );
    expect(inheritedInput).toHaveLength(24);
    for (const entry of inheritedInput) {
      expect(entry.expected).toMatchObject({
        reason: "schema_invalid",
        pointAdmissionCount: 0,
        signatureVerificationCount: 0,
      });
    }
    const inheritedRuntime = inherited.filter(
      (entry) =>
        entry.expected.boundary === "internal_diagnostic" &&
        entry.expected.stage === "runtime_attestation_closure",
    );
    expect(inheritedRuntime).toHaveLength(96);
    const inheritedSuiteBitflip = inheritedRuntime.filter(
      (entry) => entry.caseId === "runtime-inner-source-suite-signature-bitflip",
    );
    expect(inheritedSuiteBitflip).toHaveLength(1);
    expect(inheritedSuiteBitflip[0]!.expected).toMatchObject({
      reason: "source_invalid",
      pointAdmissionCount: 2,
      signatureVerificationCount: 4,
    });
    const inheritedRuntimeSignatureIds = [
      "runtime-runtime-signature-bitflip",
      "runtime-runtime-signature-wrong-signer",
      "runtime-runtime-signature-wrong-domain",
    ];
    const inheritedRuntimeSignatures = inheritedRuntime.filter((entry) =>
      inheritedRuntimeSignatureIds.includes(entry.caseId),
    );
    expect(inheritedRuntimeSignatures.map((entry) => entry.caseId)).toEqual(
      inheritedRuntimeSignatureIds,
    );
    for (const entry of inheritedRuntimeSignatures) {
      expect(entry.expected).toMatchObject({
        reason: "source_invalid",
        pointAdmissionCount: 2,
        signatureVerificationCount: 14,
      });
    }
    const inheritedOrdinaryRuntime = inheritedRuntime.filter(
      (entry) =>
        entry.caseId !== "runtime-inner-source-suite-signature-bitflip" &&
        !inheritedRuntimeSignatureIds.includes(entry.caseId),
    );
    expect(inheritedOrdinaryRuntime).toHaveLength(92);
    for (const entry of inheritedOrdinaryRuntime) {
      expect(entry.expected).toMatchObject({
        reason: "source_invalid",
        pointAdmissionCount: 2,
        signatureVerificationCount: 12,
      });
    }
    const inheritedSnapshots = inherited.filter(
      (entry) => entry.expected.boundary === "snapshot_stability",
    );
    expect(inheritedSnapshots.map((entry) => entry.caseId)).toEqual([
      "runtime-inner-security-async-mutation",
      "runtime-point-security-async-mutation",
    ]);
    for (const entry of inheritedSnapshots) {
      expect(entry.expected).toMatchObject({
        pointAdmissionCount: 3,
        signatureVerificationCount: 11,
      });
    }
    expect(
      invalid.cases.filter(
        (entry) => entry.expected.boundary === "snapshot_stability",
      ),
    ).toHaveLength(6);

    const diagnosticExpected = invalid.cases.flatMap((entry) =>
      entry.expected.boundary === "internal_diagnostic"
        ? [entry.expected]
        : [],
    );
    expect(
      new Set(diagnosticExpected.map((expected) => expected.stage)),
    ).toEqual(
      new Set([
        "input",
        "runtime_attestation_closure",
        "evidence_structure",
        "evidence_pin_structure",
        "qa_approver_key_structure",
        "release_approver_key_structure",
        "qa_approver_key_identity",
        "release_approver_key_identity",
        "approver_key_separation",
        "qa_approver_key_root",
        "release_approver_key_root",
        "qa_approver_key_admission",
        "release_approver_key_admission",
        "qa_approver_key_signature",
        "release_approver_key_signature",
        "evidence_result_binding",
        "evidence_policy_binding",
        "evidence_runtime_binding",
        "evidence_time",
        "evidence_id",
        "evidence_qa_signature_binding",
        "evidence_release_signature_binding",
        "evidence_qa_signature",
        "evidence_release_signature",
        "evidence_digest",
        "evidence_envelope",
        "evidence_pin",
      ]),
    );
    expect(
      new Set(diagnosticExpected.map((expected) => expected.reason)),
    ).toEqual(
      new Set([
        "schema_invalid",
        "source_invalid",
        "binding_mismatch",
        "identity_mismatch",
        "digest_mismatch",
        "pin_mismatch",
        "root_mismatch",
        "public_key_invalid",
        "signature_invalid",
        "ordering_invalid",
        "envelope_mismatch",
      ]),
    );

    const expectedById = (caseId: string) =>
      invalid.cases.find((entry) => entry.caseId === caseId)?.expected;
    expect(expectedById("qa-key-role-key-id-compound")).toMatchObject({
      stage: "qa_approver_key_identity",
      reason: "binding_mismatch",
      pointAdmissionCount: 2,
      signatureVerificationCount: 14,
    });
    expect(expectedById("qa-key-id-digest-compound")).toMatchObject({
      stage: "qa_approver_key_identity",
      reason: "identity_mismatch",
    });
    expect(expectedById("evidence-ordinary-result-pin-compound")).toMatchObject({
      stage: "evidence_result_binding",
      reason: "binding_mismatch",
    });
    expect(expectedById("evidence-result-pin-digest-compound")).toMatchObject({
      stage: "evidence_result_binding",
      reason: "pin_mismatch",
    });
    expect(expectedById("qa-key-point-invalid")).toMatchObject({
      stage: "qa_approver_key_admission",
      pointAdmissionCount: 4,
      signatureVerificationCount: 14,
    });
    expect(expectedById("release-key-point-invalid")).toMatchObject({
      stage: "release_approver_key_admission",
      pointAdmissionCount: 6,
      signatureVerificationCount: 14,
    });
    expect(expectedById("qa-key-signature-bitflip")).toMatchObject({
      stage: "qa_approver_key_signature",
      pointAdmissionCount: 6,
      signatureVerificationCount: 16,
    });
    expect(expectedById("evidence-qa-signature-bitflip")).toMatchObject({
      stage: "evidence_qa_signature",
      pointAdmissionCount: 6,
      signatureVerificationCount: 20,
    });
    expect(expectedById("evidence-release-signature-bitflip")).toMatchObject({
      stage: "evidence_release_signature",
      pointAdmissionCount: 6,
      signatureVerificationCount: 22,
    });
    expect(expectedById("evidence-time-before-one-nanosecond")).toMatchObject({
      stage: "evidence_time",
      reason: "ordering_invalid",
      pointAdmissionCount: 6,
      signatureVerificationCount: 18,
    });

    const preAdmissionStages = new Set([
      "evidence_structure",
      "evidence_pin_structure",
      "qa_approver_key_structure",
      "release_approver_key_structure",
      "qa_approver_key_identity",
      "release_approver_key_identity",
      "approver_key_separation",
      "qa_approver_key_root",
      "release_approver_key_root",
    ]);
    const evidencePreSignatureStages = new Set([
      "evidence_result_binding",
      "evidence_policy_binding",
      "evidence_runtime_binding",
      "evidence_time",
      "evidence_id",
      "evidence_qa_signature_binding",
      "evidence_release_signature_binding",
    ]);
    const postReleaseSignatureStages = new Set([
      "evidence_release_signature",
      "evidence_digest",
      "evidence_envelope",
      "evidence_pin",
    ]);
    for (const entry of invalid.cases.slice(invalid.runtimeCaseCount)) {
      const expected = entry.expected;
      if (expected.boundary === "snapshot_stability") {
        expect(expected).toMatchObject({
          pointAdmissionCount: 3,
          signatureVerificationCount: 11,
        });
      } else if (expected.stage === "input") {
        expect(expected).toMatchObject({
          pointAdmissionCount: 0,
          signatureVerificationCount: 0,
        });
      } else if (preAdmissionStages.has(expected.stage)) {
        expect(expected).toMatchObject({
          pointAdmissionCount: 2,
          signatureVerificationCount: 14,
        });
      } else if (expected.stage === "qa_approver_key_admission") {
        expect(expected).toMatchObject({ pointAdmissionCount: 4, signatureVerificationCount: 14 });
      } else if (expected.stage === "release_approver_key_admission") {
        expect(expected).toMatchObject({ pointAdmissionCount: 6, signatureVerificationCount: 14 });
      } else if (expected.stage === "qa_approver_key_signature") {
        expect(expected).toMatchObject({ pointAdmissionCount: 6, signatureVerificationCount: 16 });
      } else if (expected.stage === "release_approver_key_signature") {
        expect(expected).toMatchObject({ pointAdmissionCount: 6, signatureVerificationCount: 18 });
      } else if (evidencePreSignatureStages.has(expected.stage)) {
        expect(expected).toMatchObject({ pointAdmissionCount: 6, signatureVerificationCount: 18 });
      } else if (expected.stage === "evidence_qa_signature") {
        expect(expected).toMatchObject({ pointAdmissionCount: 6, signatureVerificationCount: 20 });
      } else if (postReleaseSignatureStages.has(expected.stage)) {
        expect(expected).toMatchObject({ pointAdmissionCount: 6, signatureVerificationCount: 22 });
      } else {
        throw new Error(`unclassified point crypto stage ${expected.stage}`);
      }
    }

    const tampered = JSON.parse(new TextDecoder().decode(invalidBytes)) as {
      caseIds: string[];
      cases: Array<{ mutation: { operation: string } }>;
    };
    tampered.cases[0]!.mutation.operation = tampered.caseIds[1]!;
    expect(() =>
      ProviderFeasibilityEvidencePointInvalidManifestV1Schema.parse(tampered),
    ).toThrow();
  });

  it("replays all 227 recipes with exact witness, diagnostic, opaque error, and crypto counts", async () => {
    const golden =
      await verifyProviderFeasibilityEvidencePointGoldenResourceV1(
        goldenBytes,
        capability,
      );
    const invalid =
      verifyProviderFeasibilityEvidencePointInvalidResourceV1(invalidBytes);
    let executed = 0;
    for (const [index, invalidCase] of invalid.cases.entries()) {
      expect(invalidCase.caseId).toBe(invalid.caseIds[index]);
      expect(invalidCase.mutation.operation).toBe(invalidCase.caseId);
      const witness =
        materializeProviderFeasibilityEvidencePointInvalidRequestWitnessV1(
          golden.manifest,
          invalid,
          invalidCase,
        );
      expect(
        semanticDigest(
          PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
          witness as object,
        ),
      ).toBe(invalidCase.expected.materializedRequestSemanticDigest);
      pointCalls = 0;
      verifyCalls = 0;
      const outcome = await executeProviderFeasibilityEvidencePointInvalidCaseV1(
        golden.manifest,
        invalid,
        invalidCase,
        capability,
      );
      expect(pointCalls).toBe(invalidCase.expected.pointAdmissionCount);
      expect(verifyCalls).toBe(invalidCase.expected.signatureVerificationCount);
      if (invalidCase.expected.boundary === "snapshot_stability") {
        expect(outcome).toEqual({
          kind: "snapshot_acceptance",
          boundary: "snapshot_stability",
          authority: invalidCase.expected.authority,
          snapshotProjection: invalidCase.expected.snapshotProjection,
        });
        expect(Object.keys(invalidCase.expected.snapshotProjection).sort()).toEqual([
          "conformanceCaseResultCount",
          "conformanceFailedCaseResultCount",
          "conformancePassedCaseResultCount",
          "conformanceUnsupportedCaseResultCount",
          "evidenceContentDigest",
          "evidenceId",
          "evidenceIssuedAt",
          "evidenceRelativePath",
          "evidenceResult",
          "filesystemProfileDigest",
          "qaApproverKeyId",
          "qaApproverPublicKeyDigest",
          "realFilesystemConformanceResultContentDigest",
          "releaseApproverKeyId",
          "releaseApproverPublicKeyDigest",
          "runtimeAttestationContentDigest",
          "runtimeAttestationGeneration",
          "runtimeIpcEndpointAttestationDigest",
          "runtimeIssuedAt",
          "semanticProviderPolicyDigest",
        ]);
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
    expect(executed).toBe(227);
  }, 300_000);

  it("rejects raw-byte substitutions before semantic use", async () => {
    const changedGolden = goldenBytes.slice();
    changedGolden[changedGolden.length - 2] =
      changedGolden[changedGolden.length - 2]! ^ 1;
    await expect(
      verifyProviderFeasibilityEvidencePointGoldenResourceV1(
        changedGolden,
        capability,
      ),
    ).rejects.toBeInstanceOf(ProviderFeasibilityEvidencePointFixtureError);

    const changedInvalid = invalidBytes.slice();
    changedInvalid[changedInvalid.length - 2] =
      changedInvalid[changedInvalid.length - 2]! ^ 1;
    expect(() =>
      verifyProviderFeasibilityEvidencePointInvalidResourceV1(changedInvalid),
    ).toThrow(ProviderFeasibilityEvidencePointFixtureError);
  });
});
