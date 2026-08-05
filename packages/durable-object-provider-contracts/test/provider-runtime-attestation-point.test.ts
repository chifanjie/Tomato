import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import {
  ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  ProviderRealFilesystemConformanceResultLocatorV1Schema,
  ProviderRealFilesystemConformanceResultPinV1Schema,
  ProviderRealFilesystemConformanceResultV1Schema,
  deriveProviderRealFilesystemConformanceResultContentDigestV1,
  deriveProviderRealFilesystemConformanceResultIdV1,
} from "../src/provider-real-filesystem-conformance-result.js";
import {
  ProviderRuntimeAttestationPointGoldenManifestV1Schema,
  type ProviderRuntimeAttestationPointGoldenManifestV1,
} from "../src/provider-runtime-attestation-point-fixtures.js";
import {
  StoreDurableObjectProviderRuntimeAttestationPinV1Schema,
  StoreDurableObjectProviderRuntimeAttestationV1Schema,
  createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1,
  deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1,
} from "../src/provider-registry-records.js";
import {
  ProviderRuntimeAttestationPointClosureValidationError,
  deriveStoreDurableObjectProviderPolicyDigestV1,
  deriveStoreProviderFilesystemProfileDigestV1,
  diagnoseProviderRuntimeAttestationPointClosureV1,
  validateProviderRuntimeAttestationPointClosureV1,
  type StoreDurableObjectProviderPolicyV1,
  type ValidateProviderRuntimeAttestationPointClosureV1Input,
} from "../src/provider-runtime-attestation-point.js";
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

function requestFromGolden(
  manifest: ProviderRuntimeAttestationPointGoldenManifestV1,
): ValidateProviderRuntimeAttestationPointClosureV1Input {
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

function rootPrivateKey() {
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.from(discoveryGolden.deterministicRootSeedHex, "hex"),
    ]),
    format: "der",
    type: "pkcs8",
  });
}

function signRuntime(runtime: Record<string, unknown>) {
  const rootKeyId = golden.conformanceResultGolden.activeRoot.rootKeyId;
  const message =
    createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
      runtime,
      rootKeyId,
    );
  return `provider-registry-ed25519:${rootKeyId}:${sign(
    null,
    Buffer.from(message),
    rootPrivateKey(),
  ).toString("hex")}`;
}

function rebuild(
  mutatePolicy: (policy: StoreDurableObjectProviderPolicyV1) => void,
  mutateResult: (
    result: ProviderRuntimeAttestationPointGoldenManifestV1["realFilesystemConformanceResult"]["payload"],
  ) => void,
  mutateRuntime: (runtime: Record<string, unknown>) => void,
): ValidateProviderRuntimeAttestationPointClosureV1Input {
  const request = requestFromGolden(golden);
  const policy = clone(request.semanticProviderPolicy);
  mutatePolicy(policy);
  const policyDigest = deriveStoreDurableObjectProviderPolicyDigestV1(policy);

  const result = clone(request.realFilesystemConformanceResult.payload);
  result.semanticProviderPolicyDigest = policyDigest;
  mutateResult(result);
  const { profile: _profile, resultId: _resultId, ...resultFields } = result;
  const nextResultId =
    deriveProviderRealFilesystemConformanceResultIdV1(resultFields);
  const nextResult = ProviderRealFilesystemConformanceResultV1Schema.parse({
    ...resultFields,
    profile: "provider_real_fs_conformance_result_v1",
    resultId: nextResultId,
  });
  const envelope = ProviderRealFilesystemConformanceResultEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_real_fs_conformance_result",
    resultId: nextResultId,
    contentDigest:
      deriveProviderRealFilesystemConformanceResultContentDigestV1(nextResult),
    payload: nextResult,
  });
  const locator = ProviderRealFilesystemConformanceResultLocatorV1Schema.parse({
    locatorProfile: "installation_provider_real_fs_conformance_result_v1",
    resultId: nextResultId,
  });
  const pin = ProviderRealFilesystemConformanceResultPinV1Schema.parse({
    ...locator,
    contentDigest: envelope.contentDigest,
  });

  const target = nextResult.target;
  const runtime = clone(request.runtimeAttestation.payload) as unknown as
    Record<string, unknown>;
  delete runtime.registrySignature;
  Object.assign(runtime, {
    providerId: nextResult.providerId,
    semanticProviderPolicyDigest: policyDigest,
    implementationDigest: nextResult.implementationDigest,
    binaryAttestationDigest: nextResult.binaryAttestationDigest,
    osPlatform: target.osPlatform,
    osReleaseFamilyCode: target.osReleaseFamilyCode,
    osBuildDigest: target.osBuildDigest,
    architecture: target.architecture,
    filesystemProfileDigest: deriveStoreProviderFilesystemProfileDigestV1({
      filesystemProfileCode: target.filesystemProfileCode,
      filesystemFeatureProfileDigest: target.filesystemFeatureProfileDigest,
      mountOptionProfileDigest: target.mountOptionProfileDigest,
    }),
    realFilesystemConformanceResultDigest: envelope.contentDigest,
  });
  mutateRuntime(runtime);
  const signedRuntime = StoreDurableObjectProviderRuntimeAttestationV1Schema.parse({
    ...runtime,
    registrySignature: signRuntime(runtime),
  });
  const runtimePin = StoreDurableObjectProviderRuntimeAttestationPinV1Schema.parse({
    profile: "store_durable_object_provider_runtime_attestation_pin_v1",
    contentDigest:
      deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1(
        signedRuntime,
      ),
    payload: signedRuntime,
  });
  return {
    ...request,
    semanticProviderPolicy: policy,
    realFilesystemConformanceResult: envelope,
    realFilesystemConformanceResultLocator: locator,
    realFilesystemConformanceResultPin: pin,
    runtimeAttestation: runtimePin,
  };
}

async function expectOnePointSevenSignatures(
  request: ValidateProviderRuntimeAttestationPointClosureV1Input,
) {
  pointCalls = 0;
  verifyCalls = 0;
  const value = await validateProviderRuntimeAttestationPointClosureV1(request);
  expect(value.authority).toBe(
    "none_provider_runtime_attestation_structure_only",
  );
  expect(pointCalls).toBe(1);
  expect(verifyCalls).toBe(7);
  return value;
}

describe("provider runtime attestation point closure", () => {
  it("closes the frozen Result/Policy/Runtime projection with one point and seven signatures", async () => {
    const value = await expectOnePointSevenSignatures(requestFromGolden(golden));
    expect(value.semanticProviderPolicyDigest).toBe(
      golden.expected.semanticProviderPolicyDigest,
    );
    expect(value.filesystemProfileDigest).toBe(
      golden.expected.filesystemProfileDigest,
    );
    expect(value.runtimeAttestation.contentDigest).toBe(
      golden.expected.runtimeAttestationContentDigest,
    );
    expectRecursivelyFrozen(value);
  });

  it.each([
    ["failed", "assertion_failed"],
    ["unsupported", "unsupported_by_target_profile"],
  ] as const)("keeps an honest %s Result structural-only", async (outcome, code) => {
    const request = rebuild(
      () => undefined,
      (result) => {
        result.caseResults[0]!.outcome = outcome;
        result.caseResults[0]!.resultCode = code;
        result.result = outcome;
      },
      () => undefined,
    );
    const value = await expectOnePointSevenSignatures(request);
    expect(value.conformanceResultClosure.failedCaseResultCount).toBe(
      outcome === "failed" ? 1 : 0,
    );
    expect(value.conformanceResultClosure.unsupportedCaseResultCount).toBe(
      outcome === "unsupported" ? 1 : 0,
    );
  });

  it("accepts the alternate frozen isolation/delete union without widening authority", async () => {
    const request = rebuild(
      (policy) => {
        policy.isolation = {
          kind: "kernel_isolated_storage_domain",
          securityBoundaryProfileDigest:
            policy.isolation.securityBoundaryProfileDigest,
        };
        policy.deleteSemantics = "disabled";
      },
      () => undefined,
      () => undefined,
    );
    const value = await expectOnePointSevenSignatures(request);
    expect(value.semanticProviderPolicy.isolation.kind).toBe(
      "kernel_isolated_storage_domain",
    );
    expect(value.semanticProviderPolicy.deleteSemantics).toBe("disabled");
  });

  it("allows free signed runtime fields to change only after re-signing and re-pinning", async () => {
    const request = rebuild(
      () => undefined,
      () => undefined,
      (runtime) => {
        runtime.ipcEndpointAttestationDigest = `sha256:${"7".repeat(64)}`;
        runtime.attestationGeneration = 2;
        runtime.issuedAt = "2026-08-01T00:00:00Z";
      },
    );
    const value = await expectOnePointSevenSignatures(request);
    expect(value.runtimeAttestation.payload.attestationGeneration).toBe(2);
    expect(value.runtimeAttestation.payload.issuedAt).toBe("2026-08-01T00:00:00Z");
    expect(
      value.runtimeAttestation.payload.issuedAt <
        request.realFilesystemConformanceResult.payload.completedAt,
    ).toBe(true);
  });

  it("keeps the public failure opaque while diagnostics retain frozen stage/reason", async () => {
    const request = requestFromGolden(golden) as unknown as Record<string, unknown>;
    request.verified = true;
    const diagnostic = await diagnoseProviderRuntimeAttestationPointClosureV1(request);
    expect(diagnostic).toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });
    let publicFailure: unknown;
    try {
      await validateProviderRuntimeAttestationPointClosureV1(
        request as unknown as ValidateProviderRuntimeAttestationPointClosureV1Input,
      );
    } catch (error) {
      publicFailure = error;
    }
    expect(publicFailure).toBeInstanceOf(
      ProviderRuntimeAttestationPointClosureValidationError,
    );
    const projectedFailure = publicFailure as ProviderRuntimeAttestationPointClosureValidationError;
    expect(Object.keys(projectedFailure).sort()).toEqual(["code", "name", "reason"]);
    expect(Object.getOwnPropertySymbols(projectedFailure)).toEqual([]);
    expect(
      Object.getOwnPropertyNames(projectedFailure).filter(
        (key) => !["stack", "message", "code", "name", "reason"].includes(key),
      ),
    ).toEqual([]);
    expect({
      name: projectedFailure.name,
      message: projectedFailure.message,
      code: projectedFailure.code,
      reason: projectedFailure.reason,
    }).toEqual({
      name: "ProviderRuntimeAttestationPointClosureValidationError",
      message: "Provider runtime attestation point closure validation failed",
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
  });
});
