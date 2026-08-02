import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canonicalizeJcsSafeIntegerUtf8V1,
  parseCanonicalJcsSafeIntegerUtf8V1,
} from "../src/jcs.js";
import {
  PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_CONTENT_DIGEST_V1,
  PROVIDER_STRICT_ED25519_CRYPTO_CAPABILITY_V1,
  PROVIDER_STRICT_ED25519_HOST_OPERATION_TIMEOUT_MS_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  PROVIDER_STRICT_ED25519_REQUIRED_CASE_IDS_V1,
  ProviderStrictEd25519AdversarialManifestEnvelopeV1Schema,
  ProviderStrictEd25519AttestationError,
  attestProviderStrictEd25519CryptoHostV1,
  getProviderStrictEd25519CryptoCapabilityBytesV1,
  validateProviderStrictEd25519PointWithCapabilityV1,
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519CryptoHostV1,
  type ProviderStrictEd25519FixedResourceHostV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "../src/strict-ed25519-conformance.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "../src/strict-ed25519.js";

const resourcePath = fileURLToPath(
  new URL(
    "../provider/ed25519-strict-host-conformance-v1.json",
    import.meta.url,
  ),
);
const manifestResourceBytes = new Uint8Array(readFileSync(resourcePath));
const parsedResource =
  ProviderStrictEd25519AdversarialManifestEnvelopeV1Schema.parse(
    JSON.parse(new TextDecoder().decode(manifestResourceBytes)),
  );

const strictHost: ProviderStrictEd25519CryptoHostV1 = Object.freeze({
  verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
});

function createResourceHost(
  resourceBytes: Uint8Array = manifestResourceBytes,
): ProviderStrictEd25519FixedResourceHostV1 {
  return {
    readFixedSignedPackageResource: vi.fn(() => resourceBytes),
  };
}

function createAttestationInput(
  overrides: Partial<{
    host: ProviderStrictEd25519CryptoHostV1;
    resourceHost: ProviderStrictEd25519FixedResourceHostV1;
  }> = {},
) {
  return {
    host: overrides.host ?? strictHost,
    resourceHost: overrides.resourceHost ?? createResourceHost(),
  };
}

function decodeWireBytes(value: string): Uint8Array {
  return new Uint8Array(
    Buffer.from(value.slice("base64url:".length), "base64url"),
  );
}

function encodeWireBytes(value: Uint8Array): string {
  return `base64url:${Buffer.from(value).toString("base64url")}`;
}

function cloneResource(): Record<string, unknown> {
  return structuredClone(
    JSON.parse(new TextDecoder().decode(manifestResourceBytes)) as Record<
      string,
      unknown
    >,
  );
}

function canonicalResourceBytes(value: unknown): Uint8Array {
  return canonicalizeJcsSafeIntegerUtf8V1(value);
}

function mutableCases(
  resource: Record<string, unknown>,
): Array<Record<string, unknown>> {
  return (
    (resource.payload as Record<string, unknown>).cases as Array<
      Record<string, unknown>
    >
  );
}

async function expectAttestationFailure(
  input: ReturnType<typeof createAttestationInput>,
): Promise<void> {
  try {
    await attestProviderStrictEd25519CryptoHostV1(input);
    throw new Error("attestation unexpectedly succeeded");
  } catch (error) {
    expect(error).toBeInstanceOf(ProviderStrictEd25519AttestationError);
    expect(error).toMatchObject({
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
    expect(String(error)).not.toMatch(
      /base64url:|signature|public-key|provider\/|secret-canary/u,
    );
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("fixed strict Ed25519 adversarial manifest", () => {
  it("freezes canonical resource bytes, the semantic digest, and exact cases", () => {
    expect(parseCanonicalJcsSafeIntegerUtf8V1(manifestResourceBytes)).toEqual(
      parsedResource,
    );
    expect(parsedResource.contentDigest).toBe(
      PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_CONTENT_DIGEST_V1,
    );
    expect(parsedResource.payload.cases.map(({ caseId }) => caseId)).toEqual(
      PROVIDER_STRICT_ED25519_REQUIRED_CASE_IDS_V1,
    );
    expect(
      new Set(parsedResource.payload.cases.map(({ caseId }) => caseId)).size,
    ).toBe(28);

    const accepted = parsedResource.payload.cases
      .filter(({ expectedResult }) => expectedResult === "accept")
      .map(({ caseId }) => caseId);
    expect(accepted).toEqual([
      "provider-wrapper-valid",
      "rfc8032-empty-valid",
      "rfc8032-one-byte-valid",
      "rfc8032-test-1024-valid",
      "rfc8032-two-byte-valid",
    ]);
    expect(Object.isFrozen(PROVIDER_STRICT_ED25519_REQUIRED_CASE_IDS_V1)).toBe(
      true,
    );
    expect(() => {
      (
        PROVIDER_STRICT_ED25519_REQUIRED_CASE_IDS_V1 as unknown as string[]
      )[0] = "replacement";
    }).toThrow();
    expect(PROVIDER_STRICT_ED25519_REQUIRED_CASE_IDS_V1[0]).toBe(
      "caller-prehash-substitution",
    );
  });

  it("pins dangerous regression bytes and the RFC TEST 1024 octet count", () => {
    const byId = new Map(
      parsedResource.payload.cases.map((vector) => [vector.caseId, vector]),
    );
    expect(byId.get("identity-universal-forgery")).toMatchObject({
      publicKeyBytes:
        "base64url:AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      messageBytes: "base64url:dGVzdA",
      signatureBytes:
        "base64url:AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      expectedPublicKeyPointAdmission: "reject",
      expectedSignatureRPointAdmission: "reject",
      expectedResult: "reject",
    });
    expect(byId.get("public-key-mixed-order")).toMatchObject({
      publicKeyBytes:
        "base64url:lZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZk",
      messageBytes: "base64url:bWl4ZWQtMA",
      signatureBytes:
        "base64url:WGZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmYFNgrUYD-aM4nc_dUoG9OVFxUNr_IfbNwutPySDWcNBg",
      expectedResult: "reject",
    });

    const test1024 = byId.get("rfc8032-test-1024-valid")!;
    const message = decodeWireBytes(test1024.messageBytes);
    expect(message).toHaveLength(1023);
    expect(createHash("sha256").update(message).digest("hex")).toBe(
      "358c67baee6b3e0265787951d1840a8468b9e9044852f1c67229a892b2cc0d22",
    );
  });

  it("keeps point expectations independent from whole-signature results", () => {
    for (const caseId of [
      "caller-prehash-substitution",
      "ed25519ctx-substitution",
      "ed25519ph-substitution",
      "equation-message-bitflip",
      "s-equals-l",
      "s-l-plus-one",
      "s-max",
      "s-plus-l-malleability",
      "signature-63-bytes",
      "signature-65-bytes",
    ]) {
      const vector = parsedResource.payload.cases.find(
        (candidate) => candidate.caseId === caseId,
      )!;
      expect(vector).toMatchObject({
        expectedPublicKeyPointAdmission: "accept",
        expectedSignatureRPointAdmission: "accept",
        expectedResult: "reject",
      });
    }
  });

  it("uses a canonical provider wrapper as the fifth positive message", () => {
    const vector = parsedResource.payload.cases.find(
      ({ caseId }) => caseId === "provider-wrapper-valid",
    )!;
    expect(
      parseCanonicalJcsSafeIntegerUtf8V1(
        decodeWireBytes(vector.messageBytes),
      ),
    ).toEqual([
      "store-provider-operation-receipt-v1",
      {
        claims: { caseId: "provider-wrapper-valid" },
        keyId: "925adc2d30560467a291ed",
        providerId: "durable-object-provider:fixture",
        usage: "operation_receipt",
      },
    ]);
  });
});

describe("strict Ed25519 host attestation", () => {
  it("loads only the fixed capped resource and runs exactly 56+28 calls in order", async () => {
    const events: Array<
      | { kind: "point"; bytes: string }
      | {
          kind: "verify";
          publicKey: string;
          message: string;
          signature: string;
        }
    > = [];
    const observingHost: ProviderStrictEd25519CryptoHostV1 = {
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint(point) {
        events.push({ kind: "point", bytes: encodeWireBytes(point) });
        return validatePrimeSubgroupPoint(point);
      },
      verifyRawEd25519(publicKey, message, signature) {
        events.push({
          kind: "verify",
          publicKey: encodeWireBytes(publicKey),
          message: encodeWireBytes(message),
          signature: encodeWireBytes(signature),
        });
        return verifyRawEd25519(publicKey, message, signature);
      },
    };
    const resourceHost = createResourceHost();
    const capability = await attestProviderStrictEd25519CryptoHostV1(
      createAttestationInput({ host: observingHost, resourceHost }),
    );

    expect(resourceHost.readFixedSignedPackageResource).toHaveBeenCalledOnce();
    expect(resourceHost.readFixedSignedPackageResource).toHaveBeenCalledWith(
      PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
      PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
    );
    expect(events.filter(({ kind }) => kind === "point")).toHaveLength(56);
    expect(events.filter(({ kind }) => kind === "verify")).toHaveLength(28);
    expect(events).toHaveLength(84);

    const expectedEvents = parsedResource.payload.cases.flatMap((vector) => [
      { kind: "point", bytes: vector.publicKeyBytes },
      {
        kind: "point",
        bytes: encodeWireBytes(
          decodeWireBytes(vector.signatureBytes).slice(0, 32),
        ),
      },
      {
        kind: "verify",
        publicKey: vector.publicKeyBytes,
        message: vector.messageBytes,
        signature: vector.signatureBytes,
      },
    ]);
    expect(events).toEqual(expectedEvents);
    expect(Object.keys(capability)).toEqual([]);
    expect(Object.isFrozen(capability)).toBe(true);
  });

  it("binds immutable method references and defensive capability bytes", async () => {
    const replaceableHost: ProviderStrictEd25519CryptoHostV1 = {
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint,
      verifyRawEd25519,
    };
    const capability = await attestProviderStrictEd25519CryptoHostV1(
      createAttestationInput({ host: replaceableHost }),
    );
    replaceableHost.validatePrimeSubgroupPoint = () => false;
    replaceableHost.verifyRawEd25519 = () => false;

    const valid = parsedResource.payload.cases.find(
      ({ caseId }) => caseId === "rfc8032-empty-valid",
    )!;
    await expect(
      validateProviderStrictEd25519PointWithCapabilityV1(
        capability,
        decodeWireBytes(valid.publicKeyBytes),
      ),
    ).resolves.toBe(true);
    await expect(
      verifyRawEd25519WithCapabilityV1(
        capability,
        decodeWireBytes(valid.publicKeyBytes),
        decodeWireBytes(valid.messageBytes),
        decodeWireBytes(valid.signatureBytes),
      ),
    ).resolves.toBe(true);

    const firstBytes =
      getProviderStrictEd25519CryptoCapabilityBytesV1(capability);
    expect(firstBytes).toEqual(
      canonicalizeJcsSafeIntegerUtf8V1(
        PROVIDER_STRICT_ED25519_CRYPTO_CAPABILITY_V1,
      ),
    );
    firstBytes.fill(0);
    expect(
      getProviderStrictEd25519CryptoCapabilityBytesV1(capability),
    ).not.toEqual(firstBytes);
  });

  it("snapshots the selected host before awaiting the fixed resource", async () => {
    const mutableInput = createAttestationInput();
    mutableInput.resourceHost = {
      async readFixedSignedPackageResource() {
        mutableInput.host = {
          ...strictHost,
          validatePrimeSubgroupPoint: () => false,
          verifyRawEd25519: () => false,
        };
        await Promise.resolve();
        return manifestResourceBytes;
      },
    };
    await expect(
      attestProviderStrictEd25519CryptoHostV1(mutableInput),
    ).resolves.toBeDefined();
  });

  it("does not inspect Ed25519 host accessors before resource closure", async () => {
    const accessorSpy = vi.fn();
    const accessorHost = Object.defineProperties(
      {},
      {
        verificationProfile: {
          enumerable: true,
          get() {
            accessorSpy();
            return STRICT_ED25519_VERIFICATION_PROFILE_V1;
          },
        },
        validatePrimeSubgroupPoint: {
          enumerable: true,
          get() {
            accessorSpy();
            return validatePrimeSubgroupPoint;
          },
        },
        verifyRawEd25519: {
          enumerable: true,
          get() {
            accessorSpy();
            return verifyRawEd25519;
          },
        },
      },
    ) as ProviderStrictEd25519CryptoHostV1;
    const invalidResource = cloneResource();
    invalidResource.contentDigest = `sha256:${"0".repeat(64)}`;
    await expectAttestationFailure(
      createAttestationInput({
        host: accessorHost,
        resourceHost: createResourceHost(
          canonicalResourceBytes(invalidResource),
        ),
      }),
    );
    expect(accessorSpy).not.toHaveBeenCalled();
  });

  it("rejects forged handles and refuses non-raw key/signature lengths", async () => {
    const forged = Object.freeze(
      {},
    ) as ProviderStrictEd25519OpaqueCapabilityV1;
    expect(() =>
      getProviderStrictEd25519CryptoCapabilityBytesV1(forged),
    ).toThrow(ProviderStrictEd25519AttestationError);

    const capability = await attestProviderStrictEd25519CryptoHostV1(
      createAttestationInput(),
    );
    await expect(
      validateProviderStrictEd25519PointWithCapabilityV1(
        capability,
        new Uint8Array(31),
      ),
    ).resolves.toBe(false);
    await expect(
      verifyRawEd25519WithCapabilityV1(
        capability,
        new Uint8Array(31),
        new Uint8Array(),
        new Uint8Array(64),
      ),
    ).resolves.toBe(false);
    await expect(
      verifyRawEd25519WithCapabilityV1(
        capability,
        new Uint8Array(32),
        new Uint8Array(),
        new Uint8Array(65),
      ),
    ).resolves.toBe(false);
  });

  it("rejects wrong profiles, missing methods, constants, and method divergence", async () => {
    const invalidHosts: unknown[] = [
      {
        ...strictHost,
        verificationProfile: "ed25519",
      },
      {
        verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
        verifyRawEd25519,
      },
      {
        verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
        validatePrimeSubgroupPoint,
      },
      {
        verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
        validatePrimeSubgroupPoint: () => true,
        verifyRawEd25519,
      },
      {
        verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
        validatePrimeSubgroupPoint: () => false,
        verifyRawEd25519,
      },
      {
        verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
        validatePrimeSubgroupPoint,
        verifyRawEd25519: () => true,
      },
    ];

    for (const host of invalidHosts) {
      await expectAttestationFailure(
        createAttestationInput({
          host: host as ProviderStrictEd25519CryptoHostV1,
        }),
      );
    }
  });

  it("fails closed on throw, rejection, non-boolean output, or input mutation", async () => {
    const invalidHosts: ProviderStrictEd25519CryptoHostV1[] = [
      {
        ...strictHost,
        validatePrimeSubgroupPoint() {
          throw new Error("secret-canary");
        },
      },
      {
        ...strictHost,
        validatePrimeSubgroupPoint() {
          return Promise.reject(new Error("secret-canary"));
        },
      },
      {
        ...strictHost,
        validatePrimeSubgroupPoint() {
          return "accept" as unknown as boolean;
        },
      },
      {
        ...strictHost,
        validatePrimeSubgroupPoint(point) {
          const snapshot = point.slice();
          point[0] = point[0]! ^ 0xff;
          return validatePrimeSubgroupPoint(snapshot);
        },
      },
      {
        ...strictHost,
        verifyRawEd25519(publicKey, message, signature) {
          const keySnapshot = publicKey.slice();
          const messageSnapshot = message.slice();
          const signatureSnapshot = signature.slice();
          signature[0] = signature[0]! ^ 0xff;
          return verifyRawEd25519(
            keySnapshot,
            messageSnapshot,
            signatureSnapshot,
          );
        },
      },
    ];

    for (const host of invalidHosts) {
      await expectAttestationFailure(createAttestationInput({ host }));
    }
  });

  it("times out a rejected-to-settle host without minting a handle", async () => {
    vi.useFakeTimers();
    const never = new Promise<boolean>(() => undefined);
    const promise = attestProviderStrictEd25519CryptoHostV1(
      createAttestationInput({
        host: {
          ...strictHost,
          validatePrimeSubgroupPoint: () => never,
        },
      }),
    );
    const assertion = expect(promise).rejects.toBeInstanceOf(
      ProviderStrictEd25519AttestationError,
    );
    await vi.advanceTimersByTimeAsync(
      PROVIDER_STRICT_ED25519_HOST_OPERATION_TIMEOUT_MS_V1,
    );
    await assertion;
  });

  it("enforces the 4 MiB cap before digesting or running KAT", async () => {
    const pointSpy = vi.fn(validatePrimeSubgroupPoint);
    await expectAttestationFailure(
      createAttestationInput({
        host: {
          ...strictHost,
          validatePrimeSubgroupPoint: pointSpy,
        },
        resourceHost: createResourceHost(
          new Uint8Array(
            PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1 + 1,
          ),
        ),
      }),
    );
    expect(pointSpy).not.toHaveBeenCalled();
  });
});

describe("manifest substitution rejection", () => {
  it("rejects missing, duplicate, reordered, and extra cases before KAT", async () => {
    const mutations: Array<(resource: Record<string, unknown>) => void> = [
      (resource) => {
        mutableCases(resource).pop();
      },
      (resource) => {
        const cases = mutableCases(resource);
        cases[1] = structuredClone(cases[0]!);
      },
      (resource) => {
        const cases = mutableCases(resource);
        [cases[0], cases[1]] = [cases[1]!, cases[0]!];
      },
      (resource) => {
        mutableCases(resource).push({
          ...mutableCases(resource)[0]!,
          caseId: "unexpected-case",
        });
      },
    ];

    for (const mutate of mutations) {
      const resource = cloneResource();
      mutate(resource);
      const pointSpy = vi.fn(validatePrimeSubgroupPoint);
      await expectAttestationFailure(
        createAttestationInput({
          host: {
            ...strictHost,
            validatePrimeSubgroupPoint: pointSpy,
          },
          resourceHost: createResourceHost(canonicalResourceBytes(resource)),
        }),
      );
      expect(pointSpy).not.toHaveBeenCalled();
    }
  });

  it("rejects schema, expected-field, payload, and compiled-digest substitution", async () => {
    const mutations: Array<(resource: Record<string, unknown>) => void> = [
      (resource) => {
        resource.unexpected = "secret-canary";
      },
      (resource) => {
        mutableCases(resource)[0]!.expectedPublicKeyPointAdmission = "reject";
      },
      (resource) => {
        mutableCases(resource)[0]!.messageBytes = "base64url:AA";
      },
      (resource) => {
        mutableCases(resource)[0]!.category = "equation_mismatch";
      },
      (resource) => {
        resource.contentDigest = `sha256:${"0".repeat(64)}`;
      },
    ];

    for (const mutate of mutations) {
      const resource = cloneResource();
      mutate(resource);
      await expectAttestationFailure(
        createAttestationInput({
          resourceHost: createResourceHost(canonicalResourceBytes(resource)),
        }),
      );
    }
  });

  it("rejects non-canonical fixed resource bytes", async () => {
    const withTrailingNewline = new Uint8Array(
      manifestResourceBytes.byteLength + 1,
    );
    withTrailingNewline.set(manifestResourceBytes);
    withTrailingNewline[withTrailingNewline.byteLength - 1] = 0x0a;
    await expectAttestationFailure(
      createAttestationInput({
        resourceHost: createResourceHost(withTrailingNewline),
      }),
    );
  });

  it("does not expose a caller-substitutable digest host", async () => {
    const legacySpoofedInput = {
      ...createAttestationInput(),
      cryptoHost: {
        sha256: () =>
          decodeWireBytes(
            "base64url:bGXkCiDYLFV7pkhQCLzmKpA9gf8VzIWPq1idIDkE8dk",
          ),
      },
    };
    await expectAttestationFailure(
      legacySpoofedInput as ReturnType<typeof createAttestationInput>,
    );
  });
});
