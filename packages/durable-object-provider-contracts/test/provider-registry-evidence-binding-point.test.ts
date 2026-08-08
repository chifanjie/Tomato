import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { ValidateProviderRegistryEvidenceBindingPointClosureV1Input } from "../src/provider-registry-evidence-binding-point.js";
import {
  PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1,
  ProviderRegistryEvidenceBindingPointClosureValidationError,
  diagnoseProviderRegistryEvidenceBindingPointClosureV1,
  validateProviderRegistryEvidenceBindingPointClosureV1,
} from "../src/provider-registry-evidence-binding-point.js";
import type { ProviderRegistryManifestEnvelopeV1 } from "../src/provider-registry-records.js";
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

interface EvidenceBindingGoldenV1 {
  readonly compatibleBase: Omit<
    ValidateProviderRegistryEvidenceBindingPointClosureV1Input,
    "strictCryptoCapability"
  >;
  readonly expected: {
    readonly providerId: string;
    readonly registryCryptoClosure: {
      readonly pointAdmissionCount: number;
      readonly signatureVerificationCount: number;
    };
    readonly completeCryptoClosure: {
      readonly pointAdmissionCount: number;
      readonly signatureVerificationCount: number;
    };
    readonly candidateRegistryEntryContentDigest: string;
    readonly providerFeasibilityEvidenceId: string;
    readonly providerFeasibilityEvidenceContentDigest: string;
    readonly qaApproverKeyId: string;
    readonly releaseApproverKeyId: string;
    readonly successProjection: Record<string, unknown>;
  };
}

function resourceBytes(relativePath: string): Uint8Array {
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url))),
  );
}

const golden = JSON.parse(
  new TextDecoder().decode(
    resourceBytes(
      "fixtures/v1/golden/provider-registry-evidence-binding-point-v1.json",
    ),
  ),
) as EvidenceBindingGoldenV1;
const strictManifestBytes = resourceBytes(
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
);

let capability: ProviderStrictEd25519OpaqueCapabilityV1;
let pointCalls = 0;
let signatureCalls = 0;
let blockNextSignature = false;
let signatureReached: (() => void) | undefined;
let releaseSignature: (() => void) | undefined;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function request(): ValidateProviderRegistryEvidenceBindingPointClosureV1Input {
  return {
    ...clone(golden.compatibleBase),
    strictCryptoCapability: capability,
  };
}

function expectRecursivelyFrozen(value: unknown, seen = new Set<object>()): void {
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

function expectHardenedPromise(value: Promise<unknown>): void {
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of ["constructor", "then", "catch", "finally"] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    expect(descriptor).toMatchObject({
      configurable: false,
      enumerable: false,
      writable: false,
    });
    expect(typeof descriptor?.value).toBe("function");
  }
}

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
        signatureCalls += 1;
        if (blockNextSignature) {
          blockNextSignature = false;
          signatureReached?.();
          await new Promise<void>((resolve) => {
            releaseSignature = resolve;
          });
        }
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
});

beforeEach(() => {
  pointCalls = 0;
  signatureCalls = 0;
  blockNextSignature = false;
  signatureReached = undefined;
  releaseSignature = undefined;
});

describe("provider Registry Entry/Evidence binding point", () => {
  it("closes the compatible seven-generation candidate at exactly 24/46", async () => {
    const input = request();
    const value = await validateProviderRegistryEvidenceBindingPointClosureV1(
      input,
    );

    expect(pointCalls).toBe(
      golden.expected.completeCryptoClosure.pointAdmissionCount,
    );
    expect(signatureCalls).toBe(
      golden.expected.completeCryptoClosure.signatureVerificationCount,
    );
    expect(Object.getPrototypeOf(value)).toBeNull();
    expect(Object.keys(value)).toEqual([
      "authority",
      "registryManifestHistoryClosure",
      "runtimeAttestationPointClosure",
      "candidateRegistryEntryContentDigest",
      "candidateRegistryEntry",
      "providerFeasibilityEvidence",
      "providerFeasibilityEvidencePin",
      "relativePath",
      "qaApproverPublicKey",
      "releaseApproverPublicKey",
    ]);
    expect(value.authority).toBe(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1,
    );
    expect(value.candidateRegistryEntryContentDigest).toBe(
      golden.expected.candidateRegistryEntryContentDigest,
    );
    expect(value.candidateRegistryEntry.providerId).toBe(
      golden.expected.providerId,
    );
    expect(value.providerFeasibilityEvidence.evidenceId).toBe(
      golden.expected.providerFeasibilityEvidenceId,
    );
    expect(value.providerFeasibilityEvidence.contentDigest).toBe(
      golden.expected.providerFeasibilityEvidenceContentDigest,
    );
    expect(value.qaApproverPublicKey.keyId).toBe(
      golden.expected.qaApproverKeyId,
    );
    expect(value.releaseApproverPublicKey.keyId).toBe(
      golden.expected.releaseApproverKeyId,
    );
    expect(value.registryManifestHistoryClosure.rootMetadataHistory).not.toBe(
      input.rootMetadataHistory,
    );
    expect(
      value.registryManifestHistoryClosure.registryManifestHistory,
    ).not.toBe(input.registryManifestHistory);
    expectRecursivelyFrozen(value);
  });

  it("preserves the frozen snapshot when the caller mutates after start", async () => {
    const input = request();
    let reachedResolve: (() => void) | undefined;
    const reached = new Promise<void>((resolve) => {
      reachedResolve = resolve;
    });
    signatureReached = reachedResolve;
    blockNextSignature = true;

    const promise = validateProviderRegistryEvidenceBindingPointClosureV1(input);
    expectHardenedPromise(promise);
    await reached;
    (
      input.providerFeasibilityEvidence.payload as unknown as Record<
        string,
        unknown
      >
    ).qaSignature = "mutated";
    (input.registryManifestHistory as ProviderRegistryManifestEnvelopeV1[])
      .length = 0;
    releaseSignature?.();

    const value = await promise;
    expect(value.providerFeasibilityEvidence.payload.qaSignature).not.toBe(
      "mutated",
    );
    expect(value.registryManifestHistoryClosure.registryManifestHistory).toHaveLength(
      7,
    );
    expect(pointCalls).toBe(
      golden.expected.completeCryptoClosure.pointAdmissionCount,
    );
    expect(signatureCalls).toBe(
      golden.expected.completeCryptoClosure.signatureVerificationCount,
    );
  });

  it("keeps the frozen 26-stage ordering around signature grammar", async () => {
    const malformedQa = request();
    (
      malformedQa.providerFeasibilityEvidence.payload as unknown as Record<
        string,
        unknown
      >
    ).qaSignature = "malformed";
    await expect(
      diagnoseProviderRegistryEvidenceBindingPointClosureV1(malformedQa),
    ).resolves.toEqual({
      ok: false,
      stage: "evidence_qa_signature_binding",
      reason: "binding_mismatch",
    });
    expect(pointCalls).toBe(
      golden.expected.completeCryptoClosure.pointAdmissionCount,
    );
    expect(signatureCalls).toBe(
      golden.expected.registryCryptoClosure.signatureVerificationCount + 6,
    );

    pointCalls = 0;
    signatureCalls = 0;
    const malformedRelease = request();
    (
      malformedRelease.providerFeasibilityEvidence.payload as unknown as Record<
        string,
        unknown
      >
    ).releaseSignature = "malformed";
    await expect(
      diagnoseProviderRegistryEvidenceBindingPointClosureV1(malformedRelease),
    ).resolves.toEqual({
      ok: false,
      stage: "evidence_release_signature_binding",
      reason: "binding_mismatch",
    });
    expect(pointCalls).toBe(
      golden.expected.completeCryptoClosure.pointAdmissionCount,
    );
    expect(signatureCalls).toBe(
      golden.expected.registryCryptoClosure.signatureVerificationCount + 6,
    );
  });

  it("short-circuits Entry pin and Runtime binding before Runtime distribution crypto", async () => {
    const wrongEvidencePin = request();
    (
      wrongEvidencePin.providerFeasibilityEvidencePin as unknown as Record<
        string,
        unknown
      >
    ).contentDigest = `sha256:${"0".repeat(64)}`;
    await expect(
      diagnoseProviderRegistryEvidenceBindingPointClosureV1(wrongEvidencePin),
    ).resolves.toEqual({
      ok: false,
      stage: "registry_evidence_pin_binding",
      reason: "pin_mismatch",
    });
    expect(pointCalls).toBe(
      golden.expected.registryCryptoClosure.pointAdmissionCount,
    );
    expect(signatureCalls).toBe(
      golden.expected.registryCryptoClosure.signatureVerificationCount,
    );

    pointCalls = 0;
    signatureCalls = 0;
    const wrongRuntime = request();
    (
      wrongRuntime.runtimeAttestation as unknown as Record<string, unknown>
    ).contentDigest = `sha256:${"0".repeat(64)}`;
    await expect(
      diagnoseProviderRegistryEvidenceBindingPointClosureV1(wrongRuntime),
    ).resolves.toEqual({
      ok: false,
      stage: "registry_runtime_binding",
      reason: "binding_mismatch",
    });
    expect(pointCalls).toBe(
      golden.expected.registryCryptoClosure.pointAdmissionCount,
    );
    expect(signatureCalls).toBe(
      golden.expected.registryCryptoClosure.signatureVerificationCount,
    );
  });

  it("does not let a valid Entry pin elevate a malformed Evidence envelope", async () => {
    const wrongDigest = request();
    (
      wrongDigest.providerFeasibilityEvidence as unknown as Record<
        string,
        unknown
      >
    ).contentDigest = `sha256:${"0".repeat(64)}`;
    await expect(
      diagnoseProviderRegistryEvidenceBindingPointClosureV1(wrongDigest),
    ).resolves.toEqual({
      ok: false,
      stage: "evidence_digest",
      reason: "digest_mismatch",
    });
    expect(pointCalls).toBe(
      golden.expected.completeCryptoClosure.pointAdmissionCount,
    );
    expect(signatureCalls).toBe(
      golden.expected.completeCryptoClosure.signatureVerificationCount,
    );

    pointCalls = 0;
    signatureCalls = 0;
    const wrongEnvelopeId = request();
    (
      wrongEnvelopeId.providerFeasibilityEvidence as unknown as Record<
        string,
        unknown
      >
    ).evidenceId = `provider-feasibility-evidence:${"a".repeat(22)}`;
    await expect(
      diagnoseProviderRegistryEvidenceBindingPointClosureV1(wrongEnvelopeId),
    ).resolves.toEqual({
      ok: false,
      stage: "evidence_envelope",
      reason: "envelope_mismatch",
    });
    expect(pointCalls).toBe(
      golden.expected.completeCryptoClosure.pointAdmissionCount,
    );
    expect(signatureCalls).toBe(
      golden.expected.completeCryptoClosure.signatureVerificationCount,
    );
  });

  it("returns hardened diagnostics and one opaque public error", async () => {
    const diagnosticPromise =
      diagnoseProviderRegistryEvidenceBindingPointClosureV1({});
    expectHardenedPromise(diagnosticPromise);
    const diagnostic = await diagnosticPromise;
    expect(Object.getPrototypeOf(diagnostic)).toBeNull();
    expect(Object.isFrozen(diagnostic)).toBe(true);
    expect(diagnostic).toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });
    expect(pointCalls).toBe(0);
    expect(signatureCalls).toBe(0);

    const publicPromise = validateProviderRegistryEvidenceBindingPointClosureV1(
      {} as ValidateProviderRegistryEvidenceBindingPointClosureV1Input,
    );
    expectHardenedPromise(publicPromise);
    let error: unknown;
    try {
      await publicPromise;
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(
      ProviderRegistryEvidenceBindingPointClosureValidationError,
    );
    expect(Object.isFrozen(error)).toBe(true);
    expect(error).toMatchObject({
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
  });
});
