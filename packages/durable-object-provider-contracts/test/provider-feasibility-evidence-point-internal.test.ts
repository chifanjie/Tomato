import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import * as publicPackageModuleV1 from "../src/index.js";
import {
  createProviderFeasibilityEvidenceQaSignatureMessageFromPreparedPayloadInternalV1,
  createProviderFeasibilityEvidenceReleaseSignatureMessageFromPreparedPayloadInternalV1,
  deriveProviderFeasibilityEvidenceContentDigestFromPreparedPayloadInternalV1,
  deriveProviderFeasibilityEvidenceIdFromPreparedPayloadInternalV1,
  parseProviderFeasibilityEvidenceSignatureBindingInternalV1,
  projectProviderFeasibilityEvidenceIdFieldsFromPreparedPayloadInternalV1,
  projectProviderFeasibilityEvidenceUnsignedClaimsFromPreparedPayloadInternalV1,
} from "../src/provider-feasibility-evidence-point-internal.js";
import * as publicEvidencePointModuleV1 from "../src/provider-feasibility-evidence-point.js";
import {
  createProviderFeasibilityEvidenceQaSignatureMessageV1,
  createProviderFeasibilityEvidenceReleaseSignatureMessageV1,
  deriveProviderFeasibilityEvidenceContentDigestV1,
  deriveProviderFeasibilityEvidenceIdV1,
  projectProviderFeasibilityEvidenceIdFieldsV1,
  projectProviderFeasibilityEvidenceUnsignedClaimsV1,
  type ProviderFeasibilityEvidenceV1,
} from "../src/provider-feasibility-evidence-point.js";
import {
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_PATH_V1,
  ProviderFeasibilityEvidencePointGoldenManifestV1Schema,
} from "../src/provider-feasibility-evidence-point-fixtures.js";

const packageManifest = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
) as { readonly exports: Readonly<Record<string, unknown>> };

const golden = ProviderFeasibilityEvidencePointGoldenManifestV1Schema.parse(
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(
          `../${PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_PATH_V1}`,
          import.meta.url,
        ),
      ),
      "utf8",
    ),
  ),
);
const evidence = golden.providerFeasibilityEvidence.payload;

const IDENTITY_FIELD_NAMES_V1 = Object.freeze([
  "providerId",
  "semanticProviderPolicyDigest",
  "runtimeAttestationContentDigest",
  "implementationDigest",
  "binaryAttestationDigest",
  "target",
  "isolationSecurityBoundaryProfileDigest",
  "ipcPeerAuthenticationPolicyDigest",
  "realFilesystemSuiteDigest",
  "realFilesystemConformanceResult",
  "realFilesystemConformanceResultDigest",
  "fixtureManifestDigest",
  "runnerProfileDigest",
  "crashCutCoverageDigest",
  "result",
  "issuedAt",
]);

const INTERNAL_EXPORT_NAMES_V1 = Object.freeze([
  "projectProviderFeasibilityEvidenceIdFieldsFromPreparedPayloadInternalV1",
  "deriveProviderFeasibilityEvidenceIdFromPreparedPayloadInternalV1",
  "projectProviderFeasibilityEvidenceUnsignedClaimsFromPreparedPayloadInternalV1",
  "createProviderFeasibilityEvidenceQaSignatureMessageFromPreparedPayloadInternalV1",
  "createProviderFeasibilityEvidenceReleaseSignatureMessageFromPreparedPayloadInternalV1",
  "deriveProviderFeasibilityEvidenceContentDigestFromPreparedPayloadInternalV1",
  "parseProviderFeasibilityEvidenceSignatureBindingInternalV1",
]);

function bytesToHexV1(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function signatureHexV1(signature: string): string {
  const fields = signature.split(":");
  const signatureHex = fields[3];
  if (signatureHex === undefined) throw new TypeError("missing signature bytes");
  return signatureHex;
}

describe("provider feasibility Evidence prepared-payload internals", () => {
  it("keeps every prepared helper outside the public modules and package subpaths", () => {
    for (const exportName of INTERNAL_EXPORT_NAMES_V1) {
      expect(Object.hasOwn(publicPackageModuleV1, exportName)).toBe(false);
      expect(Object.hasOwn(publicEvidencePointModuleV1, exportName)).toBe(false);
    }
    expect(
      Object.hasOwn(
        packageManifest.exports,
        "./provider-feasibility-evidence-point-internal",
      ),
    ).toBe(false);
  });

  it("is byte-equivalent to every public D-35 derivation for the C09-1J golden", () => {
    const preparedIdFields =
      projectProviderFeasibilityEvidenceIdFieldsFromPreparedPayloadInternalV1(
        evidence,
      );
    const publicIdFields = projectProviderFeasibilityEvidenceIdFieldsV1(evidence);
    expect(Object.keys(preparedIdFields)).toEqual(IDENTITY_FIELD_NAMES_V1);
    expect(Object.keys(preparedIdFields)).toHaveLength(16);
    expect(preparedIdFields).toEqual(publicIdFields);
    expect(Object.getPrototypeOf(preparedIdFields)).toBeNull();
    expect(Object.isFrozen(preparedIdFields)).toBe(true);

    const preparedId =
      deriveProviderFeasibilityEvidenceIdFromPreparedPayloadInternalV1(evidence);
    expect(preparedId).toBe(deriveProviderFeasibilityEvidenceIdV1(evidence));
    expect(preparedId).toBe(golden.expected.evidenceId);

    const preparedClaims =
      projectProviderFeasibilityEvidenceUnsignedClaimsFromPreparedPayloadInternalV1(
        evidence,
      );
    expect(preparedClaims).toEqual(
      projectProviderFeasibilityEvidenceUnsignedClaimsV1(evidence),
    );
    expect(Object.keys(preparedClaims)).toEqual([
      "profile",
      "evidenceId",
      ...IDENTITY_FIELD_NAMES_V1,
    ]);
    expect(Object.getPrototypeOf(preparedClaims)).toBeNull();
    expect(Object.isFrozen(preparedClaims)).toBe(true);

    const preparedQaMessage =
      createProviderFeasibilityEvidenceQaSignatureMessageFromPreparedPayloadInternalV1(
        evidence,
        golden.expected.qaApproverKeyId,
      );
    const publicQaMessage = createProviderFeasibilityEvidenceQaSignatureMessageV1(
      evidence,
      golden.expected.qaApproverKeyId,
    );
    expect(preparedQaMessage).toEqual(publicQaMessage);
    expect(bytesToHexV1(preparedQaMessage)).toBe(
      golden.expected.qaSignatureMessageUtf8Hex,
    );

    const preparedReleaseMessage =
      createProviderFeasibilityEvidenceReleaseSignatureMessageFromPreparedPayloadInternalV1(
        evidence,
        golden.expected.releaseApproverKeyId,
      );
    const publicReleaseMessage =
      createProviderFeasibilityEvidenceReleaseSignatureMessageV1(
        evidence,
        golden.expected.releaseApproverKeyId,
      );
    expect(preparedReleaseMessage).toEqual(publicReleaseMessage);
    expect(bytesToHexV1(preparedReleaseMessage)).toBe(
      golden.expected.releaseSignatureMessageUtf8Hex,
    );

    const preparedContentDigest =
      deriveProviderFeasibilityEvidenceContentDigestFromPreparedPayloadInternalV1(
        evidence,
      );
    expect(preparedContentDigest).toBe(
      deriveProviderFeasibilityEvidenceContentDigestV1(evidence),
    );
    expect(preparedContentDigest).toBe(golden.expected.evidenceContentDigest);
  });

  it("extracts each role-specific key ID and all 64 canonical signature bytes", () => {
    for (const [role, signature, expectedKeyId] of [
      ["qa", evidence.qaSignature, golden.expected.qaApproverKeyId],
      ["release", evidence.releaseSignature, golden.expected.releaseApproverKeyId],
    ] as const) {
      const binding =
        parseProviderFeasibilityEvidenceSignatureBindingInternalV1(
          signature,
          role,
        );
      expect(binding.role).toBe(role);
      expect(binding.keyId).toBe(expectedKeyId);
      expect(binding.signatureBytes).toHaveLength(64);
      expect(bytesToHexV1(binding.signatureBytes)).toBe(
        signatureHexV1(signature),
      );
      expect(Object.getPrototypeOf(binding)).toBeNull();
      expect(Object.isFrozen(binding)).toBe(true);
    }
  });

  it("rejects wrong roles, prefixes, case, lengths, and non-string wires", () => {
    for (const [role, otherRole, signature] of [
      ["qa", "release", evidence.qaSignature],
      ["release", "qa", evidence.releaseSignature],
    ] as const) {
      const [prefix, wireRole, keyId, signatureHex] = signature.split(":") as [
        string,
        string,
        string,
        string,
      ];
      expect(() =>
        parseProviderFeasibilityEvidenceSignatureBindingInternalV1(
          signature,
          otherRole,
        ),
      ).toThrow(TypeError);
      for (const malformed of [
        ["provider-feasibility-ed448", wireRole, keyId, signatureHex].join(":"),
        [prefix, wireRole, keyId.toUpperCase(), signatureHex].join(":"),
        [prefix, wireRole, keyId, signatureHex.toUpperCase()].join(":"),
        [prefix, wireRole, keyId.slice(1), signatureHex].join(":"),
        [prefix, wireRole, `${keyId}0`, signatureHex].join(":"),
        [prefix, wireRole, keyId, signatureHex.slice(1)].join(":"),
        [prefix, wireRole, keyId, `${signatureHex}0`].join(":"),
        `${signature}:trailing`,
      ]) {
        expect(() =>
          parseProviderFeasibilityEvidenceSignatureBindingInternalV1(
            malformed,
            role,
          ),
        ).toThrow(TypeError);
      }
    }
    for (const signature of [undefined, null, 42, {}, new Uint8Array(64)]) {
      expect(() =>
        parseProviderFeasibilityEvidenceSignatureBindingInternalV1(
          signature,
          "qa",
        ),
      ).toThrow(TypeError);
    }
  });

  it("does not let the other role's malformed wire preempt identity or message stages", () => {
    const malformedRelease = {
      ...evidence,
      releaseSignature: "malformed-release-signature",
    } as unknown as ProviderFeasibilityEvidenceV1;
    const malformedQa = {
      ...evidence,
      qaSignature: "malformed-qa-signature",
    } as unknown as ProviderFeasibilityEvidenceV1;

    expect(
      projectProviderFeasibilityEvidenceIdFieldsFromPreparedPayloadInternalV1(
        malformedRelease,
      ),
    ).toEqual(
      projectProviderFeasibilityEvidenceIdFieldsFromPreparedPayloadInternalV1(
        evidence,
      ),
    );
    expect(
      deriveProviderFeasibilityEvidenceIdFromPreparedPayloadInternalV1(
        malformedRelease,
      ),
    ).toBe(golden.expected.evidenceId);
    expect(
      projectProviderFeasibilityEvidenceUnsignedClaimsFromPreparedPayloadInternalV1(
        malformedRelease,
      ),
    ).toEqual(
      projectProviderFeasibilityEvidenceUnsignedClaimsFromPreparedPayloadInternalV1(
        evidence,
      ),
    );
    expect(
      createProviderFeasibilityEvidenceQaSignatureMessageFromPreparedPayloadInternalV1(
        malformedRelease,
        golden.expected.qaApproverKeyId,
      ),
    ).toEqual(
      createProviderFeasibilityEvidenceQaSignatureMessageFromPreparedPayloadInternalV1(
        evidence,
        golden.expected.qaApproverKeyId,
      ),
    );
    expect(
      createProviderFeasibilityEvidenceReleaseSignatureMessageFromPreparedPayloadInternalV1(
        malformedQa,
        golden.expected.releaseApproverKeyId,
      ),
    ).toEqual(
      createProviderFeasibilityEvidenceReleaseSignatureMessageFromPreparedPayloadInternalV1(
        evidence,
        golden.expected.releaseApproverKeyId,
      ),
    );
  });
});
