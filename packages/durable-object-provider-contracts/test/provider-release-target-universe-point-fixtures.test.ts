import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../src/jcs.js";
import {
  PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INHERITED_CASE_IDS_V1,
  PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_CASE_IDS_V1,
  PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
  PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RESOURCE_PATH_V1,
  PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_SPECIFIC_CASE_IDS_V1,
  ProviderReleaseTargetUniversePointFixtureError,
  executeProviderReleaseTargetUniversePointInvalidCaseV1,
  materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1,
  verifyProviderReleaseTargetUniversePointGoldenResourceV1,
  verifyProviderReleaseTargetUniversePointInvalidResourceV1,
  verifyProviderReleaseTargetUniversePointPositiveVectorsV1,
  type ProviderReleaseTargetUniversePointExecutionCounterV1,
} from "../src/provider-release-target-universe-point-fixtures.js";
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

function semanticDigest(domain: string, value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(canonicalizeJcsSafeIntegerUtf8V1([domain, value]))
    .digest("hex")}`;
}

function descriptorSnapshot(
  target: object,
  key: PropertyKey,
): PropertyDescriptor | undefined {
  return Object.getOwnPropertyDescriptor(target, key);
}

function expectDescriptorRestored(
  target: object,
  key: PropertyKey,
  expected: PropertyDescriptor | undefined,
): void {
  expect(Object.getOwnPropertyDescriptor(target, key)).toEqual(expected);
}

function expectHardenedPromise(value: Promise<unknown>): void {
  expect(value).toBeInstanceOf(Promise);
  expect(Object.isFrozen(value)).toBe(true);
  const constructorDescriptor = Object.getOwnPropertyDescriptor(
    value,
    "constructor",
  );
  const thenDescriptor = Object.getOwnPropertyDescriptor(value, "then");
  const catchDescriptor = Object.getOwnPropertyDescriptor(value, "catch");
  const finallyDescriptor = Object.getOwnPropertyDescriptor(value, "finally");
  for (const descriptor of [
    constructorDescriptor,
    thenDescriptor,
    catchDescriptor,
    finallyDescriptor,
  ]) {
    expect(descriptor).toMatchObject({
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }
  const stableConstructor = constructorDescriptor!.value as Function;
  expect(stableConstructor).not.toBe(Promise);
  expect(Object.isFrozen(stableConstructor)).toBe(true);
  expect(Object.isFrozen(stableConstructor.prototype)).toBe(true);
  expect(
    (stableConstructor as unknown as Record<PropertyKey, unknown>)[
      Symbol.species
    ],
  ).toBe(stableConstructor);
}

function hardenedPromiseMethodIdentities(value: Promise<unknown>): readonly unknown[] {
  return [
    Object.getOwnPropertyDescriptor(value, "constructor")!.value,
    Object.getOwnPropertyDescriptor(value, "then")!.value,
    Object.getOwnPropertyDescriptor(value, "catch")!.value,
    Object.getOwnPropertyDescriptor(value, "finally")!.value,
  ];
}

const goldenBytes = resourceBytes(
  PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_PATH_V1,
);
const invalidBytes = resourceBytes(
  PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RESOURCE_PATH_V1,
);
const strictManifestBytes = resourceBytes(
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
);

let pointAdmissionCount = 0;
let signatureVerificationCount = 0;
let nextSignatureMutation: (() => void) | undefined;
let capability: ProviderStrictEd25519OpaqueCapabilityV1;

const executionCounter: ProviderReleaseTargetUniversePointExecutionCounterV1 =
  Object.freeze({
    pointAdmissionCount() {
      return pointAdmissionCount;
    },
    signatureVerificationCount() {
      return signatureVerificationCount;
    },
    mutateDuringNextSignature(mutation: () => void) {
      if (nextSignatureMutation !== undefined) {
        throw new TypeError("a crypto-host mutation is already pending");
      }
      nextSignatureMutation = mutation;
    },
  });

beforeAll(async () => {
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
        const mutation = nextSignatureMutation;
        nextSignatureMutation = undefined;
        mutation?.();
        return verifyRawEd25519(publicKey, message, signature);
      },
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(path: string, maxBytes: number) {
        if (
          path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
          maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
        ) {
          throw new TypeError("unexpected strict resource request");
        }
        return strictManifestBytes;
      },
    }),
  });
  pointAdmissionCount = 0;
  signatureVerificationCount = 0;
});

describe("release target Universe point fixture resources", () => {
  it(
    "verifies the immutable golden and all four 1/7 positive vectors",
    async () => {
      pointAdmissionCount = 0;
      signatureVerificationCount = 0;
      const result =
        await verifyProviderReleaseTargetUniversePointGoldenResourceV1(
          goldenBytes,
          capability,
        );
      expect(result.authority).toBe(
        "none_release_target_universe_structure_only",
      );
      expect(result.manifest.positiveVectors.map(({ vectorId }) => vectorId)).toEqual(
        [
          "taxonomy-mapping-unresolved",
          "target-discovery-unresolved",
          "release-matrix-incomplete",
          "closed-world-complete",
        ],
      );
      expect({ pointAdmissionCount, signatureVerificationCount }).toEqual({
        pointAdmissionCount: 1,
        signatureVerificationCount: 7,
      });
      expect(Object.getPrototypeOf(result)).toBeNull();
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.getPrototypeOf(result.pointClosure)).toBeNull();
      expect(Object.isFrozen(result.pointClosure)).toBe(true);

      pointAdmissionCount = 0;
      signatureVerificationCount = 0;
      const closures =
        await verifyProviderReleaseTargetUniversePointPositiveVectorsV1(
          result.manifest,
          capability,
        );
      expect(closures).toHaveLength(4);
      expect(Object.isFrozen(closures)).toBe(true);
      expect({ pointAdmissionCount, signatureVerificationCount }).toEqual({
        pointAdmissionCount: 4,
        signatureVerificationCount: 28,
      });
    },
    120_000,
  );

  it(
    "verifies the exact 116 + 169 inventory and every fresh witness digest",
    () => {
      const golden = JSON.parse(new TextDecoder().decode(goldenBytes));
      const invalid =
        verifyProviderReleaseTargetUniversePointInvalidResourceV1(invalidBytes);
      expect(invalid.inheritedCaseCount).toBe(
        PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INHERITED_CASE_IDS_V1.length,
      );
      expect(invalid.pointCaseCount).toBe(
        PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_SPECIFIC_CASE_IDS_V1.length,
      );
      expect(invalid.caseCount).toBe(
        PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_CASE_IDS_V1.length,
      );
      expect(invalid.caseIds).toEqual(
        PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_CASE_IDS_V1,
      );
      expect(new Set(invalid.caseIds).size).toBe(invalid.caseCount);
      for (const invalidCase of invalid.cases) {
        const first =
          materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1(
            golden,
            invalid,
            invalidCase,
          );
        const second =
          materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1(
            golden,
            invalid,
            invalidCase,
          );
        expect(first, invalidCase.caseId).not.toBe(second);
        const firstDigest = semanticDigest(
          PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
          first,
        );
        const secondDigest = semanticDigest(
          PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
          second,
        );
        expect(firstDigest, invalidCase.caseId).toBe(
          invalidCase.expected.materializedRequestSemanticDigest,
        );
        expect(secondDigest, invalidCase.caseId).toBe(firstDigest);
      }
    },
    180_000,
  );

  it(
    "executes all 285 cases with fresh diagnostic/public inputs and exact counters",
    async () => {
      const golden = JSON.parse(new TextDecoder().decode(goldenBytes));
      const invalid =
        verifyProviderReleaseTargetUniversePointInvalidResourceV1(invalidBytes);
      const objectThenBefore = descriptorSnapshot(Object.prototype, "then");
      const objectValueBefore = descriptorSnapshot(Object.prototype, "value");
      const arrayZeroBefore = descriptorSnapshot(Array.prototype, "0");
      const arrayPushBefore = descriptorSnapshot(Array.prototype, "push");
      const structuredCloneBefore = descriptorSnapshot(
        globalThis,
        "structuredClone",
      );
      const promiseConstructorBefore = descriptorSnapshot(
        Promise.prototype,
        "constructor",
      );
      const promiseThenBefore = descriptorSnapshot(Promise.prototype, "then");
      const promiseSpeciesBefore = descriptorSnapshot(Promise, Symbol.species);

      for (const invalidCase of invalid.cases) {
        pointAdmissionCount = 0;
        signatureVerificationCount = 0;
        nextSignatureMutation = undefined;
        const pending = executeProviderReleaseTargetUniversePointInvalidCaseV1(
          golden,
          invalid,
          invalidCase,
          capability,
          executionCounter,
        );
        expectHardenedPromise(pending);
        let outcome: Awaited<
          ReturnType<
            typeof executeProviderReleaseTargetUniversePointInvalidCaseV1
          >
        >;
        if (invalidCase.caseId === "point-security-promise-primordials") {
          const stableMethods = hardenedPromiseMethodIdentities(pending);
          let thenSettled = false;
          let catchSettled = false;
          let finallySettled = false;
          const thenDerived = pending.then((value) => {
            thenSettled = true;
            return value;
          });
          const catchDerived = thenDerived.catch((error) => {
            catchSettled = true;
            throw error;
          });
          const finallyDerived = catchDerived.finally(() => {
            finallySettled = true;
          });
          const mixedOne = finallyDerived.then((value) => value);
          const mixedTwo = mixedOne.catch((error) => {
            throw error;
          });
          const mixedThree = mixedTwo.finally(() => undefined);
          for (const derived of [
            thenDerived,
            catchDerived,
            finallyDerived,
            mixedOne,
            mixedTwo,
            mixedThree,
          ]) {
            expectHardenedPromise(derived);
            expect(hardenedPromiseMethodIdentities(derived)).toEqual(
              stableMethods,
            );
          }
          outcome = await mixedThree;
          expect(thenSettled).toBe(true);
          expect(catchSettled).toBe(false);
          expect(finallySettled).toBe(true);
        } else {
          outcome = await pending;
        }
        expect(Object.getPrototypeOf(outcome), invalidCase.caseId).toBeNull();
        expect(Object.isFrozen(outcome), invalidCase.caseId).toBe(true);
        expect(nextSignatureMutation, invalidCase.caseId).toBeUndefined();
        expect(
          {
            pointAdmissionCount: outcome.pointAdmissionCount,
            signatureVerificationCount: outcome.signatureVerificationCount,
          },
          invalidCase.caseId,
        ).toEqual({
          pointAdmissionCount: invalidCase.expected.pointAdmissionCount,
          signatureVerificationCount:
            invalidCase.expected.signatureVerificationCount,
        });

        if (invalidCase.expected.boundary === "snapshot_stability") {
          expect(outcome, invalidCase.caseId).toMatchObject({
            kind: "snapshot_acceptance",
            boundary: "snapshot_stability",
            authority: invalidCase.expected.authority,
            snapshotProjection: invalidCase.expected.snapshotProjection,
          });
        } else if (invalidCase.expected.boundary === "locator_builder") {
          expect(outcome, invalidCase.caseId).toMatchObject({
            kind: "rejection",
            boundary: "locator_builder",
            stage: invalidCase.expected.stage,
            reason: invalidCase.expected.reason,
          });
        } else {
          expect(outcome, invalidCase.caseId).toMatchObject({
            kind: "rejection",
            boundary: "internal_diagnostic",
            stage: invalidCase.expected.stage,
            reason: invalidCase.expected.reason,
            publicFailure: invalidCase.expected.publicFailure,
          });
        }

        expectDescriptorRestored(Object.prototype, "then", objectThenBefore);
        expectDescriptorRestored(Object.prototype, "value", objectValueBefore);
        expectDescriptorRestored(Array.prototype, "0", arrayZeroBefore);
        expectDescriptorRestored(Array.prototype, "push", arrayPushBefore);
        expectDescriptorRestored(
          globalThis,
          "structuredClone",
          structuredCloneBefore,
        );
        expectDescriptorRestored(
          Promise.prototype,
          "constructor",
          promiseConstructorBefore,
        );
        expectDescriptorRestored(Promise.prototype, "then", promiseThenBefore);
        expectDescriptorRestored(Promise, Symbol.species, promiseSpeciesBefore);
      }

      const doubled = invalid.cases.find(
        ({ caseId }) => caseId === "discovery-taxonomy-code-mismatch",
      )!;
      expect(doubled.expected.boundary).toBe("internal_diagnostic");
      expect(doubled.expected.pointAdmissionCount).toBeGreaterThanOrEqual(2);
      expect(
        doubled.expected.signatureVerificationCount % 2,
      ).toBe(0);
    },
    300_000,
  );

  it("rejects byte substitutions without weakening authority", async () => {
    const changedGolden = goldenBytes.slice();
    changedGolden[changedGolden.length - 2] =
      changedGolden[changedGolden.length - 2]! ^ 1;
    await expect(
      verifyProviderReleaseTargetUniversePointGoldenResourceV1(
        changedGolden,
        capability,
      ),
    ).rejects.toBeInstanceOf(ProviderReleaseTargetUniversePointFixtureError);

    const changedInvalid = invalidBytes.slice();
    changedInvalid[changedInvalid.length - 2] =
      changedInvalid[changedInvalid.length - 2]! ^ 1;
    expect(() =>
      verifyProviderReleaseTargetUniversePointInvalidResourceV1(changedInvalid),
    ).toThrow(ProviderReleaseTargetUniversePointFixtureError);
  });
});
