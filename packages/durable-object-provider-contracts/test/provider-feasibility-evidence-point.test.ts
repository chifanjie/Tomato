import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  type KeyObject,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import {
  ProviderFeasibilityEvidenceEnvelopeV1Schema,
  ProviderFeasibilityEvidenceUnsignedClaimsV1Schema,
  ProviderFeasibilityEvidenceV1Schema,
  ProviderFeasibilityEvidencePointClosureValidationError,
  buildProviderFeasibilityEvidenceRelativePathV1,
  compareProviderFeasibilityEvidenceTimestampsV1,
  createProviderFeasibilityEvidenceQaSignatureMessageV1,
  createProviderFeasibilityEvidenceReleaseSignatureMessageV1,
  deriveProviderFeasibilityEvidenceContentDigestV1,
  deriveProviderFeasibilityEvidenceIdV1,
  deriveProviderFeasibilityEvidencePinV1,
  diagnoseProviderFeasibilityEvidencePointClosureV1,
  validateProviderFeasibilityEvidencePointClosureV1,
  type ProviderFeasibilityEvidenceV1,
  type ValidateProviderFeasibilityEvidencePointClosureV1Input,
} from "../src/provider-feasibility-evidence-point.js";
import {
  ProviderRuntimeAttestationPointGoldenManifestV1Schema,
  type ProviderRuntimeAttestationPointGoldenManifestV1,
} from "../src/provider-runtime-attestation-point-fixtures.js";
import {
  ProviderFeasibilityApproverPublicKeyV1Schema,
  createProviderFeasibilityApproverPublicKeySignatureMessageV1,
  deriveProviderFeasibilityApproverKeyIdV1,
  type ProviderFeasibilityApproverPublicKeyV1,
} from "../src/provider-registry-records.js";
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectRecursivelyFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    if ("value" in descriptor) expectRecursivelyFrozen(descriptor.value, seen);
  }
}

const golden = ProviderRuntimeAttestationPointGoldenManifestV1Schema.parse(
  JSON.parse(
    new TextDecoder().decode(
      resourceBytes(
        "fixtures/v1/golden/provider-runtime-attestation-point-v1.json",
      ),
    ),
  ),
);
const discoveryGolden = JSON.parse(
  new TextDecoder().decode(
    resourceBytes("fixtures/v1/golden/provider-target-discovery-point-v1.json"),
  ),
) as { readonly deterministicRootSeedHex: string };
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

function runtimeRequestFromGolden(
  manifest: ProviderRuntimeAttestationPointGoldenManifestV1,
) {
  const source = manifest.conformanceResultGolden;
  return {
    activeRoot: clone(source.activeRoot),
    activeRootMetadata: clone(source.activeRootMetadata),
    distributionRootBinding: clone(source.distributionRootBinding),
    fixtureCorpusManifest: clone(source.fixtureCorpusManifest),
    publicSupportTaxonomy: clone(source.publicSupportTaxonomy),
    realFilesystemConformanceResult: clone(
      manifest.realFilesystemConformanceResult,
    ),
    realFilesystemConformanceResultLocator: clone(
      manifest.realFilesystemConformanceResultLocator,
    ),
    realFilesystemConformanceResultPin: clone(
      manifest.realFilesystemConformanceResultPin,
    ),
    releaseMatrix: clone(source.releaseMatrix),
    runtimeAttestation: clone(manifest.runtimeAttestation),
    semanticProviderPolicy: clone(manifest.semanticProviderPolicy),
    strictCryptoCapability: capability,
    suiteManifest: clone(source.suiteManifest),
    targetDiscoveryFixtureManifest: clone(source.targetDiscoveryFixtureManifest),
    targetDiscoveryResult: clone(source.targetDiscoveryResult),
    targetDiscoveryRunnerRun: clone(source.targetDiscoveryRunnerRun),
  };
}

function privateKeyFromSeed(seedHex: string): KeyObject {
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.from(seedHex, "hex"),
    ]),
    format: "der",
    type: "pkcs8",
  });
}

function publicKeyMaterial(privateKey: KeyObject) {
  const spki = createPublicKey(privateKey).export({
    format: "der",
    type: "spki",
  });
  const raw = Buffer.from(spki).subarray(-32);
  return {
    publicKeyBytes: `base64url:${raw.toString("base64url")}`,
    publicKeyDigest: `sha256:${createHash("sha256").update(raw).digest("hex")}`,
  };
}

const rootPrivateKey = privateKeyFromSeed(
  discoveryGolden.deterministicRootSeedHex,
);
const qaPrivateKey = privateKeyFromSeed("31".repeat(32));
const releasePrivateKey = privateKeyFromSeed("42".repeat(32));

function signedApproverRecord(
  role: "qa" | "release",
  privateKey: KeyObject,
): ProviderFeasibilityApproverPublicKeyV1 {
  const key = publicKeyMaterial(privateKey);
  const keyId = deriveProviderFeasibilityApproverKeyIdV1({
    role,
    publicKeyBytes: key.publicKeyBytes,
  });
  const unsigned = {
    profile: "provider_feasibility_approver_public_key_v1" as const,
    distributionRegistryGenerationIntroduced: 1,
    role,
    keyId,
    algorithm: "ed25519" as const,
    ...key,
  };
  const rootKeyId = golden.conformanceResultGolden.activeRoot.rootKeyId;
  const signature = sign(
    null,
    Buffer.from(
      createProviderFeasibilityApproverPublicKeySignatureMessageV1(
        unsigned,
        rootKeyId,
      ),
    ),
    rootPrivateKey,
  ).toString("hex");
  return ProviderFeasibilityApproverPublicKeyV1Schema.parse({
    ...unsigned,
    registrySignature: `provider-registry-ed25519:${rootKeyId}:${signature}`,
  });
}

const qaApproverPublicKey = signedApproverRecord("qa", qaPrivateKey);
const releaseApproverPublicKey = signedApproverRecord(
  "release",
  releasePrivateKey,
);

function signedEvidence(
  runtimeRequest: ReturnType<typeof runtimeRequestFromGolden>,
  issuedAt = runtimeRequest.realFilesystemConformanceResult.payload.completedAt,
): ProviderFeasibilityEvidenceV1 {
  const result = runtimeRequest.realFilesystemConformanceResult.payload;
  const policy = runtimeRequest.semanticProviderPolicy;
  const idFields = {
    providerId: result.providerId,
    semanticProviderPolicyDigest: result.semanticProviderPolicyDigest,
    runtimeAttestationContentDigest:
      runtimeRequest.runtimeAttestation.contentDigest,
    implementationDigest: result.implementationDigest,
    binaryAttestationDigest: result.binaryAttestationDigest,
    target: clone(result.target),
    isolationSecurityBoundaryProfileDigest:
      policy.isolation.securityBoundaryProfileDigest,
    ipcPeerAuthenticationPolicyDigest:
      policy.ipcPeerAuthenticationPolicyDigest,
    realFilesystemSuiteDigest: result.suiteDigest,
    realFilesystemConformanceResult: clone(
      runtimeRequest.realFilesystemConformanceResultPin,
    ),
    realFilesystemConformanceResultDigest:
      runtimeRequest.realFilesystemConformanceResult.contentDigest,
    fixtureManifestDigest: result.fixtureManifestDigest,
    runnerProfileDigest: result.runnerProfileDigest,
    crashCutCoverageDigest: result.crashCutCoverageDigest,
    result: result.result,
    issuedAt,
  };
  const unsigned = ProviderFeasibilityEvidenceUnsignedClaimsV1Schema.parse({
    profile: "provider_feasibility_evidence_v1",
    evidenceId: deriveProviderFeasibilityEvidenceIdV1(idFields),
    ...idFields,
  });
  const qaSignature = sign(
    null,
    Buffer.from(
      createProviderFeasibilityEvidenceQaSignatureMessageV1(
        unsigned,
        qaApproverPublicKey.keyId,
      ),
    ),
    qaPrivateKey,
  ).toString("hex");
  const releaseSignature = sign(
    null,
    Buffer.from(
      createProviderFeasibilityEvidenceReleaseSignatureMessageV1(
        unsigned,
        releaseApproverPublicKey.keyId,
      ),
    ),
    releasePrivateKey,
  ).toString("hex");
  return ProviderFeasibilityEvidenceV1Schema.parse({
    ...unsigned,
    qaSignature: `provider-feasibility-ed25519:qa:${qaApproverPublicKey.keyId}:${qaSignature}`,
    releaseSignature: `provider-feasibility-ed25519:release:${releaseApproverPublicKey.keyId}:${releaseSignature}`,
  });
}

function requestFromGolden(): ValidateProviderFeasibilityEvidencePointClosureV1Input {
  const runtimeRequest = runtimeRequestFromGolden(golden);
  const evidence = signedEvidence(runtimeRequest);
  const envelope = ProviderFeasibilityEvidenceEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_feasibility_evidence",
    evidenceId: evidence.evidenceId,
    contentDigest: deriveProviderFeasibilityEvidenceContentDigestV1(evidence),
    payload: evidence,
  });
  return {
    ...runtimeRequest,
    providerFeasibilityEvidence: envelope,
    providerFeasibilityEvidencePin:
      deriveProviderFeasibilityEvidencePinV1(envelope),
    qaApproverPublicKey: clone(qaApproverPublicKey),
    releaseApproverPublicKey: clone(releaseApproverPublicKey),
  };
}

describe("provider feasibility evidence point closure", () => {
  it("closes the signed Result/Policy/Runtime/Evidence DAG with three points and eleven signatures", async () => {
    pointCalls = 0;
    verifyCalls = 0;
    const value = await validateProviderFeasibilityEvidencePointClosureV1(
      requestFromGolden(),
    );
    expect(value.authority).toBe(
      "none_provider_feasibility_evidence_structure_only",
    );
    expect(value.runtimeAttestationPointClosure.authority).toBe(
      "none_provider_runtime_attestation_structure_only",
    );
    expect(value.relativePath).toBe(
      buildProviderFeasibilityEvidenceRelativePathV1(
        value.providerFeasibilityEvidencePin,
      ),
    );
    expect(pointCalls).toBe(3);
    expect(verifyCalls).toBe(11);
    expectRecursivelyFrozen(value);
  });

  it("compares canonical UTC timestamps at nanosecond precision and allows equality", () => {
    expect(
      compareProviderFeasibilityEvidenceTimestampsV1(
        "2026-08-03T04:00:00Z",
        "2026-08-03T04:00:00.000000000Z",
      ),
    ).toBe(0);
    expect(
      compareProviderFeasibilityEvidenceTimestampsV1(
        "2026-08-03T04:00:00.000000001Z",
        "2026-08-03T04:00:00Z",
      ),
    ).toBeGreaterThan(0);
    expect(
      compareProviderFeasibilityEvidenceTimestampsV1(
        "2026-08-03T03:59:59.999999999Z",
        "2026-08-03T04:00:00Z",
      ),
    ).toBeLessThan(0);
  });

  it("checks both Evidence signature bindings before attempting either Evidence signature", async () => {
    const request = requestFromGolden();
    const changed = clone(
      request.providerFeasibilityEvidence,
    ) as unknown as {
      payload: { qaSignature: string; releaseSignature: string };
    };
    changed.payload.qaSignature = `${changed.payload.qaSignature.slice(0, -1)}${
      changed.payload.qaSignature.endsWith("0") ? "1" : "0"
    }`;
    const releaseParts = changed.payload.releaseSignature.split(":");
    changed.payload.releaseSignature = [
      releaseParts[0],
      releaseParts[1],
      "0".repeat(22),
      releaseParts[3],
    ].join(":");
    const tampered = {
      ...request,
      providerFeasibilityEvidence: changed,
    } as unknown as ValidateProviderFeasibilityEvidencePointClosureV1Input;

    pointCalls = 0;
    verifyCalls = 0;
    await expect(
      diagnoseProviderFeasibilityEvidencePointClosureV1(tampered),
    ).resolves.toEqual({
      ok: false,
      stage: "evidence_release_signature_binding",
      reason: "binding_mismatch",
    });
    expect(pointCalls).toBe(3);
    expect(verifyCalls).toBe(9);
  });

  it("preserves exact stage/reason diagnostics while the public error stays opaque", async () => {
    const request = requestFromGolden();
    const changed = clone(
      request.providerFeasibilityEvidence,
    ) as unknown as { payload: Record<string, unknown> };
    changed.payload.providerId = "durable-object-provider:changed";
    const tampered = {
      ...request,
      providerFeasibilityEvidence: changed,
    } as unknown as ValidateProviderFeasibilityEvidencePointClosureV1Input;
    const diagnostic = await diagnoseProviderFeasibilityEvidencePointClosureV1(
      tampered,
    );
    expect(diagnostic).toEqual({
      ok: false,
      stage: "evidence_result_binding",
      reason: "binding_mismatch",
    });

    let publicFailure: unknown;
    try {
      await validateProviderFeasibilityEvidencePointClosureV1(tampered);
    } catch (error) {
      publicFailure = error;
    }
    expect(publicFailure).toBeInstanceOf(
      ProviderFeasibilityEvidencePointClosureValidationError,
    );
    const projectedFailure =
      publicFailure as ProviderFeasibilityEvidencePointClosureValidationError;
    expect(Object.keys(projectedFailure).sort()).toEqual([
      "code",
      "name",
      "reason",
    ]);
    expect(Object.getOwnPropertySymbols(projectedFailure)).toEqual([]);
    expect({
      name: projectedFailure.name,
      message: projectedFailure.message,
      code: projectedFailure.code,
      reason: projectedFailure.reason,
    }).toEqual({
      name: "ProviderFeasibilityEvidencePointClosureValidationError",
      message: "Provider feasibility evidence point closure validation failed",
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
  });
});
