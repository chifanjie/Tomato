import {
  createPrivateKey,
  createPublicKey,
  sign,
  type KeyObject,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import {
  ProviderFeasibilityEvidencePointGoldenManifestV1Schema,
} from "../src/provider-feasibility-evidence-point-fixtures.js";
import {
  diagnoseProviderFeasibilityEvidencePointPreparedInternalV1,
  diagnoseProviderFeasibilityEvidencePointRegistryTrustedPreparedInternalV1,
  registerProviderFeasibilityEvidenceRegistryTrustedApproversInternalV1,
  type ProviderFeasibilityEvidenceRegistryTrustedApproverHandleV1,
} from "../src/provider-feasibility-evidence-point-prepared-internal.js";
import type { ValidateProviderFeasibilityEvidencePointClosureV1Input } from "../src/provider-feasibility-evidence-point.js";
import {
  createProviderFeasibilityApproverPublicKeySignatureMessageV1,
  type ProviderFeasibilityApproverPublicKeyV1,
} from "../src/provider-registry-records.js";
import {
  deriveProviderRegistryRootKeyIdInternalV1,
} from "../src/provider-registry-trust.js";
import {
  ProviderReleaseTargetUniversePointGoldenManifestV1Schema,
} from "../src/provider-release-target-universe-point-fixtures.js";
import {
  diagnoseProviderReleaseTargetUniversePointPreparedInternalV1,
} from "../src/provider-release-target-universe-point-prepared-internal.js";
import type { ValidateProviderReleaseTargetUniversePointClosureV1Input } from "../src/provider-release-target-universe-point.js";
import {
  createProviderPointFulfilledPromiseV1,
} from "../src/provider-point-runtime-internal.js";
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

function cloneJsonV1<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function privateKeyFromSeedHexV1(seedHex: string): KeyObject {
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.from(seedHex, "hex"),
    ]),
    format: "der",
    type: "pkcs8",
  });
}

const historicalRootPrivateKeyV1 = privateKeyFromSeedHexV1("73".repeat(32));
const historicalRootPublicKeyRawV1 = Buffer.from(
  createPublicKey(historicalRootPrivateKeyV1).export({
    format: "der",
    type: "spki",
  }),
).subarray(-32);
const historicalRootPublicKeyBytesV1 =
  `base64url:${historicalRootPublicKeyRawV1.toString("base64url")}`;
const historicalRootKeyIdV1 = deriveProviderRegistryRootKeyIdInternalV1({
  publicKeyBytes: historicalRootPublicKeyBytesV1,
});

function historicalRootSignedApproverRecordV1(
  record: ProviderFeasibilityApproverPublicKeyV1,
): ProviderFeasibilityApproverPublicKeyV1 {
  const { registrySignature: _registrySignature, ...unsigned } =
    cloneJsonV1(record);
  const signature = sign(
    null,
    Buffer.from(
      createProviderFeasibilityApproverPublicKeySignatureMessageV1(
        unsigned,
        historicalRootKeyIdV1,
      ),
    ),
    historicalRootPrivateKeyV1,
  ).toString("hex");
  return {
    ...unsigned,
    registrySignature:
      `provider-registry-ed25519:${historicalRootKeyIdV1}:${signature}`,
  } as ProviderFeasibilityApproverPublicKeyV1;
}

function freezeJsonV1<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeJsonV1(child);
    Object.freeze(value);
  }
  return value;
}

function freezePreparedInputV1<T extends object>(
  input: T,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): T {
  for (const [key, value] of Object.entries(input)) {
    if (key !== "strictCryptoCapability") freezeJsonV1(value);
  }
  Object.defineProperty(input, "strictCryptoCapability", {
    configurable: false,
    enumerable: true,
    value: capability,
    writable: false,
  });
  return Object.freeze(input);
}

function expectHardenedPromiseV1(promise: Promise<unknown>): void {
  expect(Object.isFrozen(promise)).toBe(true);
  expect(Reflect.ownKeys(promise)).toEqual([
    "constructor",
    "then",
    "catch",
    "finally",
  ]);
  for (const key of ["constructor", "then", "catch", "finally"] as const) {
    expect(Object.getOwnPropertyDescriptor(promise, key)).toMatchObject({
      configurable: false,
      enumerable: false,
      writable: false,
    });
  }
}

const evidenceGolden =
  ProviderFeasibilityEvidencePointGoldenManifestV1Schema.parse(
    JSON.parse(
      new TextDecoder().decode(
        resourceBytes(
          "fixtures/v1/golden/provider-feasibility-evidence-point-v1.json",
        ),
      ),
    ),
  );
const universeGolden =
  ProviderReleaseTargetUniversePointGoldenManifestV1Schema.parse(
    JSON.parse(
      new TextDecoder().decode(
        resourceBytes(
          "fixtures/v1/golden/provider-release-target-universe-point-v1.json",
        ),
      ),
    ),
  );
const strictManifestBytes = resourceBytes(
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
);

let pointCalls = 0;
let verifyCalls = 0;
let throwNextVerification = false;
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
        if (throwNextVerification) {
          throwNextVerification = false;
          throw new TypeError("synthetic prepared-host failure");
        }
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

function preparedEvidenceRequestV1(
  qaApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1 =
    evidenceGolden.qaApproverPublicKey,
  releaseApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1 =
    evidenceGolden.releaseApproverPublicKey,
): ValidateProviderFeasibilityEvidencePointClosureV1Input {
  const runtimeGolden = evidenceGolden.runtimeAttestationPointGolden;
  const source = runtimeGolden.conformanceResultGolden;
  const vector = evidenceGolden.positiveVectors[0]!;
  return freezePreparedInputV1(
    {
      activeRoot: cloneJsonV1(source.activeRoot),
      activeRootMetadata: cloneJsonV1(source.activeRootMetadata),
      distributionRootBinding: cloneJsonV1(source.distributionRootBinding),
      fixtureCorpusManifest: cloneJsonV1(source.fixtureCorpusManifest),
      providerFeasibilityEvidence: cloneJsonV1(
        vector.providerFeasibilityEvidence,
      ),
      providerFeasibilityEvidencePin: cloneJsonV1(
        vector.providerFeasibilityEvidencePin,
      ),
      publicSupportTaxonomy: cloneJsonV1(source.publicSupportTaxonomy),
      qaApproverPublicKey: cloneJsonV1(qaApproverPublicKey),
      realFilesystemConformanceResult: cloneJsonV1(
        vector.realFilesystemConformanceResult,
      ),
      realFilesystemConformanceResultLocator: cloneJsonV1(
        vector.realFilesystemConformanceResultLocator,
      ),
      realFilesystemConformanceResultPin: cloneJsonV1(
        vector.realFilesystemConformanceResultPin,
      ),
      releaseApproverPublicKey: cloneJsonV1(releaseApproverPublicKey),
      releaseMatrix: cloneJsonV1(source.releaseMatrix),
      runtimeAttestation: cloneJsonV1(vector.runtimeAttestation),
      semanticProviderPolicy: cloneJsonV1(runtimeGolden.semanticProviderPolicy),
      strictCryptoCapability: capability,
      suiteManifest: cloneJsonV1(source.suiteManifest),
      targetDiscoveryFixtureManifest: cloneJsonV1(
        source.targetDiscoveryFixtureManifest,
      ),
      targetDiscoveryResult: cloneJsonV1(source.targetDiscoveryResult),
      targetDiscoveryRunnerRun: cloneJsonV1(source.targetDiscoveryRunnerRun),
    },
    capability,
  );
}

function preparedUniverseRequestV1(): ValidateProviderReleaseTargetUniversePointClosureV1Input {
  const request = cloneJsonV1(universeGolden.positiveVectors[0]!.request);
  return freezePreparedInputV1(
    {
      ...request,
      strictCryptoCapability: capability,
    },
    capability,
  ) as ValidateProviderReleaseTargetUniversePointClosureV1Input;
}

describe("Catalog prepared point bridges", () => {
  it("runs Evidence without a nested clone and repeats every crypto proof on every logical call", () => {
    const firstInput = preparedEvidenceRequestV1();
    const originalStructuredClone = globalThis.structuredClone;
    const originalThen = Object.getOwnPropertyDescriptor(
      Promise.prototype,
      "then",
    );
    let promiseThenHits = 0;
    let first: Awaited<
      ReturnType<
        typeof diagnoseProviderFeasibilityEvidencePointPreparedInternalV1
      >
    > | undefined;
    const restore = (): void => {
      Object.defineProperty(globalThis, "structuredClone", {
        configurable: true,
        value: originalStructuredClone,
        writable: true,
      });
      if (originalThen !== undefined) {
        Object.defineProperty(Promise.prototype, "then", originalThen);
      }
    };

    const kickoff = createProviderPointFulfilledPromiseV1(undefined);
    const exercise = kickoff.then(() => {
      try {
        Object.defineProperty(globalThis, "structuredClone", {
          configurable: true,
          value() {
            throw new TypeError("prepared path attempted structuredClone");
          },
          writable: true,
        });
        Object.defineProperty(Promise.prototype, "then", {
          configurable: true,
          value() {
            promiseThenHits += 1;
            return Object.freeze({ forged: true as const });
          },
          writable: true,
        });
        pointCalls = 0;
        verifyCalls = 0;
        const pending =
          diagnoseProviderFeasibilityEvidencePointPreparedInternalV1(
            firstInput,
          );
        expectHardenedPromiseV1(pending);
        return pending
          .then((value) => {
            first = value;
          })
          .finally(restore);
      } catch (error) {
        restore();
        throw error;
      }
    });

    return exercise.then(() => {
      expect(promiseThenHits).toBe(0);
      expect(first).toMatchObject({ ok: true });
      expect(Object.getPrototypeOf(first)).toBeNull();
      expect(Object.isFrozen(first)).toBe(true);
      expect(pointCalls).toBe(3);
      expect(verifyCalls).toBe(11);

      pointCalls = 0;
      verifyCalls = 0;
      return diagnoseProviderFeasibilityEvidencePointPreparedInternalV1(
        preparedEvidenceRequestV1(),
      ).then((second) => {
        expect(second).toMatchObject({ ok: true });
        expect(pointCalls).toBe(3);
        expect(verifyCalls).toBe(11);
      });
    });
  });

  it("consumes Universe prepared input once without cloning and rejects replay before crypto", async () => {
    const input = preparedUniverseRequestV1();
    const originalStructuredClone = globalThis.structuredClone;
    Object.defineProperty(globalThis, "structuredClone", {
      configurable: true,
      value() {
        throw new TypeError("prepared path attempted structuredClone");
      },
      writable: true,
    });
    pointCalls = 0;
    verifyCalls = 0;
    let first;
    try {
      const pending =
        diagnoseProviderReleaseTargetUniversePointPreparedInternalV1(input);
      expectHardenedPromiseV1(pending);
      first = await pending;
    } finally {
      Object.defineProperty(globalThis, "structuredClone", {
        configurable: true,
        value: originalStructuredClone,
        writable: true,
      });
    }
    expect(first).toMatchObject({ ok: true });
    expect(pointCalls).toBe(1);
    expect(verifyCalls).toBe(7);

    pointCalls = 0;
    verifyCalls = 0;
    await expect(
      diagnoseProviderReleaseTargetUniversePointPreparedInternalV1(input),
    ).resolves.toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });
    expect(pointCalls).toBe(0);
    expect(verifyCalls).toBe(0);
  });

  it("maps a native prepared-host throw to a frozen diagnostic", async () => {
    pointCalls = 0;
    verifyCalls = 0;
    throwNextVerification = true;
    const result =
      await diagnoseProviderFeasibilityEvidencePointPreparedInternalV1(
        preparedEvidenceRequestV1(),
      );
    expect(result).toEqual({
      ok: false,
      stage: "runtime_attestation_closure",
      reason: "source_invalid",
    });
    expect(Object.getPrototypeOf(result)).toBeNull();
    expect(Object.isFrozen(result)).toBe(true);
    expect(verifyCalls).toBe(1);
  });

  it("consumes Registry-trusted historical approvers once and skips only their two root signatures", async () => {
    const historicalQa = historicalRootSignedApproverRecordV1(
      evidenceGolden.qaApproverPublicKey,
    );
    const historicalRelease = historicalRootSignedApproverRecordV1(
      evidenceGolden.releaseApproverPublicKey,
    );
    const input = preparedEvidenceRequestV1(
      historicalQa,
      historicalRelease,
    );
    const handle =
      registerProviderFeasibilityEvidenceRegistryTrustedApproversInternalV1(
        input,
        input.qaApproverPublicKey,
        input.releaseApproverPublicKey,
        capability,
      );
    pointCalls = 0;
    verifyCalls = 0;

    const trusted =
      await diagnoseProviderFeasibilityEvidencePointRegistryTrustedPreparedInternalV1(
        input,
        handle,
        capability,
      );

    expect(trusted).toMatchObject({ ok: true });
    expect(pointCalls).toBe(3);
    expect(verifyCalls).toBe(9);

    pointCalls = 0;
    verifyCalls = 0;
    await expect(
      diagnoseProviderFeasibilityEvidencePointRegistryTrustedPreparedInternalV1(
        input,
        handle,
        capability,
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });
    expect(pointCalls).toBe(0);
    expect(verifyCalls).toBe(0);

    const mismatchedInput = preparedEvidenceRequestV1(
      historicalQa,
      historicalRelease,
    );
    const mismatchedHandle =
      registerProviderFeasibilityEvidenceRegistryTrustedApproversInternalV1(
        mismatchedInput,
        mismatchedInput.qaApproverPublicKey,
        mismatchedInput.releaseApproverPublicKey,
        capability,
      );
    const fakeCapability = Object.freeze({}) as unknown as
      ProviderStrictEd25519OpaqueCapabilityV1;
    pointCalls = 0;
    verifyCalls = 0;
    await expect(
      diagnoseProviderFeasibilityEvidencePointRegistryTrustedPreparedInternalV1(
        mismatchedInput,
        mismatchedHandle,
        fakeCapability,
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });
    expect(pointCalls).toBe(0);
    expect(verifyCalls).toBe(0);

    const handleMismatchInput = preparedEvidenceRequestV1(
      historicalQa,
      historicalRelease,
    );
    const handleMismatch =
      registerProviderFeasibilityEvidenceRegistryTrustedApproversInternalV1(
        handleMismatchInput,
        handleMismatchInput.qaApproverPublicKey,
        handleMismatchInput.releaseApproverPublicKey,
        capability,
      );
    pointCalls = 0;
    verifyCalls = 0;
    await expect(
      diagnoseProviderFeasibilityEvidencePointRegistryTrustedPreparedInternalV1(
        handleMismatchInput,
        Object.freeze({}) as unknown as
          ProviderFeasibilityEvidenceRegistryTrustedApproverHandleV1,
        capability,
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });
    expect(pointCalls).toBe(0);
    expect(verifyCalls).toBe(0);
    await expect(
      diagnoseProviderFeasibilityEvidencePointRegistryTrustedPreparedInternalV1(
        handleMismatchInput,
        handleMismatch,
        capability,
      ),
    ).resolves.toMatchObject({ ok: false });
  });
});
