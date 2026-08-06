import { createPrivateKey, sign, type KeyObject } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import {
  ProviderReleaseTargetUniversePointClosureValidationError,
  buildProviderReleaseTargetUniverseRelativePathV1,
  createProviderReleaseTargetUniverseSignatureMessageV1,
  deriveProviderReleaseTargetUniverseContentDigestV1,
  diagnoseProviderReleaseTargetUniversePointClosureV1,
  validateProviderReleaseTargetUniversePointClosureV1,
  type ProviderReleaseTargetUniverseEnvelopeV1,
  type ProviderReleaseTargetUniverseV1,
  type ValidateProviderReleaseTargetUniversePointClosureV1Input,
} from "../src/provider-release-target-universe-point.js";
import {
  PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_PATH_V1,
  ProviderTargetDiscoveryPointGoldenManifestV1Schema,
} from "../src/provider-target-discovery-point-fixtures.js";
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

const golden = ProviderTargetDiscoveryPointGoldenManifestV1Schema.parse(
  JSON.parse(
    new TextDecoder().decode(
      resourceBytes(PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_PATH_V1),
    ),
  ),
);
const strictManifestBytes = resourceBytes(
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
);
const rootPrivateKey = privateKeyFromSeedHex(
  golden.deterministicRootSeedHex,
);

let pointCalls = 0;
let verifyCalls = 0;
let capability: ProviderStrictEd25519OpaqueCapabilityV1;
let blockNextVerification = false;
let verificationReached: (() => void) | undefined;
let releaseVerification: (() => void) | undefined;
let mutateDuringNextVerification: (() => void) | undefined;

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
        const mutate = mutateDuringNextVerification;
        mutateDuringNextVerification = undefined;
        mutate?.();
        if (blockNextVerification) {
          blockNextVerification = false;
          verificationReached?.();
          await new Promise<void>((resolve) => {
            releaseVerification = resolve;
          });
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
          throw new TypeError("unexpected strict manifest request");
        }
        return strictManifestBytes;
      },
    }),
  });
  pointCalls = 0;
  verifyCalls = 0;
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function privateKeyFromSeedHex(seedHex: string): KeyObject {
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.from(seedHex, "hex"),
    ]),
    format: "der",
    type: "pkcs8",
  });
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function signUniversePayload(
  rawPayload: unknown,
): ProviderReleaseTargetUniverseV1 {
  const payload = clone(rawPayload) as Record<string, unknown>;
  payload.universeSignature =
    `provider-release-target-universe-ed25519:${golden.activeRoot.rootKeyId}:${"00".repeat(64)}`;
  const signature = sign(
    null,
    Buffer.from(
      createProviderReleaseTargetUniverseSignatureMessageV1(
        payload,
        golden.activeRoot.rootKeyId,
      ),
    ),
    rootPrivateKey,
  ).toString("hex");
  payload.universeSignature =
    `provider-release-target-universe-ed25519:${golden.activeRoot.rootKeyId}:${signature}`;
  return payload as ProviderReleaseTargetUniverseV1;
}

function makeUniverseEnvelope(): ProviderReleaseTargetUniverseEnvelopeV1 {
  const matrixEnvelope = golden.releaseMatrix;
  const matrix = matrixEnvelope.payload;
  const resultEnvelope = golden.targetDiscoveryResult;
  const result = resultEnvelope.payload;
  const reason = "taxonomy_mapping_unresolved" as const;
  const groups = new Map<
    string,
    Array<(typeof result.targets)[number]>
  >();
  for (const entry of result.targets) {
    const entries = groups.get(entry.publicProfileId) ?? [];
    entries.push(entry);
    groups.set(entry.publicProfileId, entries);
  }
  const buckets = [...groups.entries()]
    .sort(([left], [right]) => compareUtf8(left, right))
    .map(([publicProfileId, entries]) => {
      const first = entries[0]!;
      return {
        publicProfileId,
        osPlatform: first.target.osPlatform,
        osReleaseFamilyCode: first.target.osReleaseFamilyCode,
        architecture: first.target.architecture,
        filesystemProfileCode: first.target.filesystemProfileCode,
        coverage: {
          coverageState: "incomplete" as const,
          reason,
          targetProfileIds: entries
            .map((entry) => entry.target.targetProfileId)
            .sort(compareUtf8),
        },
      };
    });
  const unsigned = clone({
    profile: "provider_release_target_universe_v1" as const,
    distributionRootBinding: golden.distributionRootBinding,
    activeRootMetadata: golden.activeRootMetadata,
    registryRootKeyId: golden.activeRoot.rootKeyId,
    universeGeneration: 1,
    publicSupportTaxonomy: result.publicSupportTaxonomy,
    coverageBasis: {
      profile: "provider_release_target_coverage_basis_v1" as const,
      releaseMatrix: {
        locatorProfile: "distribution_provider_release_matrix_v1" as const,
        releaseMatrixGeneration: matrix.releaseMatrixGeneration,
        contentDigest: matrixEnvelope.contentDigest,
      },
      targetDiscoveryResult: {
        locatorProfile:
          "distribution_provider_target_discovery_result_v1" as const,
        discoveryGeneration: result.discoveryGeneration,
        contentDigest: resultEnvelope.contentDigest,
      },
      targetDiscoveryInputBundleContentDigest:
        result.targetDiscoveryInputBundleContentDigest,
      observationCutDigest: result.observationCutDigest,
      observationSetDigest: result.observationSetDigest,
      limits: result.limits,
      discoveryRulesetVersion: result.discoveryRulesetVersion,
      requiredDimensions: result.requiredDimensions,
      observationSources: result.observationSources,
      releaseMatrixTargetCount: matrix.targetCount,
      releaseMatrixTargetSetDigest: matrix.targetSetDigest,
      discoveredTargetCount: result.targetCount,
      discoveredTargetSetDigest: result.targetSetDigest,
      unresolvedObservationCount: result.unresolvedObservationCount,
      resolution: { state: "incomplete" as const, reason },
    },
    targets: result.targets,
    buckets,
  });
  const payload = signUniversePayload(unsigned);
  return {
    schemaVersion: 1,
    recordType: "provider_release_target_universe",
    universeGeneration: payload.universeGeneration,
    contentDigest: deriveProviderReleaseTargetUniverseContentDigestV1(payload),
    payload,
  };
}

function resignUniverseEnvelope(
  envelope: ProviderReleaseTargetUniverseEnvelopeV1,
): ProviderReleaseTargetUniverseEnvelopeV1 {
  const payload = signUniversePayload(envelope.payload);
  return {
    ...clone(envelope),
    universeGeneration: payload.universeGeneration,
    contentDigest: deriveProviderReleaseTargetUniverseContentDigestV1(payload),
    payload,
  };
}

function request(
  universe = makeUniverseEnvelope(),
): ValidateProviderReleaseTargetUniversePointClosureV1Input {
  return {
    activeRoot: clone(golden.activeRoot),
    activeRootMetadata: clone(golden.activeRootMetadata),
    distributionRootBinding: clone(golden.distributionRootBinding),
    fixtureCorpusManifest: clone(golden.fixtureCorpusManifest),
    publicSupportTaxonomy: clone(golden.publicSupportTaxonomy),
    releaseMatrix: clone(golden.releaseMatrix),
    releaseTargetUniverse: clone(universe),
    strictCryptoCapability: capability,
    suiteManifest: clone(golden.suiteManifest),
    targetDiscoveryFixtureManifest: clone(
      golden.targetDiscoveryFixtureManifest,
    ),
    targetDiscoveryResult: clone(golden.targetDiscoveryResult),
    targetDiscoveryRunnerRun: clone(golden.targetDiscoveryRunnerRun),
  };
}

function expectRecursivelyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectRecursivelyFrozen(child);
}

function restoreOwnDescriptor(
  owner: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor === undefined) Reflect.deleteProperty(owner, key);
  else Object.defineProperty(owner, key, descriptor);
}

function expectHardenedPromise(promise: Promise<unknown>): void {
  expect(promise).toBeInstanceOf(Promise);
  expect(Object.isFrozen(promise)).toBe(true);
  expect(Reflect.ownKeys(promise)).toEqual([
    "constructor",
    "then",
    "catch",
    "finally",
  ]);
  const constructor = Object.getOwnPropertyDescriptor(
    promise,
    "constructor",
  )?.value as { readonly prototype: object };
  expect(constructor).not.toBe(Promise);
  expect(Object.isFrozen(constructor)).toBe(true);
  expect(Object.isFrozen(constructor.prototype)).toBe(true);
  expect(
    (constructor as unknown as Record<PropertyKey, unknown>)[Symbol.species],
  ).toBe(constructor);
  for (const key of ["constructor", "then", "catch", "finally"] as const) {
    expect(Object.getOwnPropertyDescriptor(promise, key)).toMatchObject({
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }
}

describe("release target Universe supplied-point closure", () => {
  it("returns the exact recursively frozen 8-field none-only closure at 1/7", async () => {
    pointCalls = 0;
    verifyCalls = 0;
    expect(
      diagnoseProviderReleaseTargetUniversePointClosureV1.constructor.name,
    ).toBe("Function");
    expect(
      validateProviderReleaseTargetUniversePointClosureV1.constructor.name,
    ).toBe("Function");

    const diagnostic =
      await diagnoseProviderReleaseTargetUniversePointClosureV1(request());
    expect(Object.getPrototypeOf(diagnostic)).toBeNull();
    expect(Object.isFrozen(diagnostic)).toBe(true);
    expect(Object.keys(diagnostic)).toEqual(["ok", "value"]);
    expect(diagnostic.ok).toBe(true);
    if (!diagnostic.ok) throw new TypeError("expected Universe success");
    expect(Object.getPrototypeOf(diagnostic.value)).toBeNull();
    expectRecursivelyFrozen(diagnostic.value);
    expect(pointCalls).toBe(1);
    expect(verifyCalls).toBe(7);

    pointCalls = 0;
    verifyCalls = 0;
    const input = request();
    const promise = validateProviderReleaseTargetUniversePointClosureV1(input);
    expectHardenedPromise(promise);
    const chained = promise.then((value) => value).finally(() => undefined);
    expectHardenedPromise(chained);
    const value = await chained;

    expect(Object.getPrototypeOf(value)).toBeNull();
    expect(Object.keys(value)).toEqual([
      "authority",
      "targetDiscoveryPointClosure",
      "releaseTargetUniverse",
      "releaseTargetUniversePin",
      "relativePath",
      "targetCount",
      "bucketCount",
      "coverageResolution",
    ]);
    expect(value.authority).toBe(
      "none_release_target_universe_structure_only",
    );
    expect(value.coverageResolution).toEqual({
      state: "incomplete",
      reason: "taxonomy_mapping_unresolved",
    });
    expect(value.targetCount).toBe(
      golden.targetDiscoveryResult.payload.targetCount,
    );
    expect(value.bucketCount).toBe(value.releaseTargetUniverse.payload.buckets.length);
    expect(value.releaseTargetUniverse).toEqual(input.releaseTargetUniverse);
    expectRecursivelyFrozen(value);
    expect(pointCalls).toBe(1);
    expect(verifyCalls).toBe(7);

    const counts = { pointCalls, verifyCalls };
    expect(
      buildProviderReleaseTargetUniverseRelativePathV1(
        clone(input.releaseTargetUniverse),
      ),
    ).toBe(value.relativePath);
    expect({ pointCalls, verifyCalls }).toEqual(counts);
  });

  it("returns exact hardened diagnostic records and frozen opaque public errors", async () => {
    pointCalls = 0;
    verifyCalls = 0;
    const diagnosticPromise =
      diagnoseProviderReleaseTargetUniversePointClosureV1({});
    expectHardenedPromise(diagnosticPromise);
    const diagnostic = await diagnosticPromise;
    expect(Object.getPrototypeOf(diagnostic)).toBeNull();
    expect(Object.isFrozen(diagnostic)).toBe(true);
    expect(Object.keys(diagnostic)).toEqual(["ok", "stage", "reason"]);
    expect(diagnostic).toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });

    let error: unknown;
    try {
      await validateProviderReleaseTargetUniversePointClosureV1(
        {} as ValidateProviderReleaseTargetUniversePointClosureV1Input,
      );
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(
      ProviderReleaseTargetUniversePointClosureValidationError,
    );
    expect(Object.isFrozen(error)).toBe(true);
    expect(error).toMatchObject({
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
    expect(pointCalls).toBe(0);
    expect(verifyCalls).toBe(0);
  });

  it("bypasses poisoned Promise constructor, then, species, and inherited then on raw failure", () => {
    const promiseConstructorDescriptor = Object.getOwnPropertyDescriptor(
      Promise.prototype,
      "constructor",
    );
    const promiseThenDescriptor = Object.getOwnPropertyDescriptor(
      Promise.prototype,
      "then",
    );
    const speciesDescriptor = Object.getOwnPropertyDescriptor(
      Promise,
      Symbol.species,
    );
    const objectThenDescriptor = Object.getOwnPropertyDescriptor(
      Object.prototype,
      "then",
    );
    let promiseConstructorHits = 0;
    let promiseThenHits = 0;
    let speciesHits = 0;
    let inheritedThenHits = 0;
    let diagnosticValue: unknown;
    let publicError: unknown;
    let diagnosticPromise: Promise<unknown> | undefined;
    let publicPromise: Promise<unknown> | undefined;
    let restored = false;
    const restore = (): void => {
      if (restored) return;
      restoreOwnDescriptor(
        Promise.prototype,
        "constructor",
        promiseConstructorDescriptor,
      );
      restoreOwnDescriptor(Promise.prototype, "then", promiseThenDescriptor);
      restoreOwnDescriptor(Promise, Symbol.species, speciesDescriptor);
      restoreOwnDescriptor(Object.prototype, "then", objectThenDescriptor);
      restored = true;
    };

    const kickoff = createProviderPointFulfilledPromiseV1(undefined);
    const exercise = kickoff.then(() => {
      try {
        function ForgedPromiseConstructor(): Readonly<{ forged: true }> {
          return Object.freeze({ forged: true as const });
        }
        Object.defineProperty(Promise.prototype, "constructor", {
          configurable: true,
          enumerable: false,
          get() {
            promiseConstructorHits += 1;
            return ForgedPromiseConstructor;
          },
        });
        Object.defineProperty(Promise.prototype, "then", {
          configurable: true,
          enumerable: false,
          writable: true,
          value() {
            promiseThenHits += 1;
            return Object.freeze({ forged: true as const });
          },
        });
        Object.defineProperty(Promise, Symbol.species, {
          configurable: true,
          enumerable: false,
          get() {
            speciesHits += 1;
            return ForgedPromiseConstructor;
          },
        });
        Object.defineProperty(Object.prototype, "then", {
          configurable: true,
          enumerable: false,
          get() {
            inheritedThenHits += 1;
            return undefined;
          },
        });

        diagnosticPromise =
          diagnoseProviderReleaseTargetUniversePointClosureV1({});
        publicPromise =
          validateProviderReleaseTargetUniversePointClosureV1(
            {} as ValidateProviderReleaseTargetUniversePointClosureV1Input,
          );
        const observedPublic = publicPromise.then(
          () => {
            throw new TypeError("raw public failure unexpectedly fulfilled");
          },
          (error) => {
            publicError = error;
          },
        );
        return diagnosticPromise
          .then((value) => {
            diagnosticValue = value;
            return observedPublic;
          })
          .finally(restore);
      } catch (error) {
        restore();
        throw error;
      }
    });

    return exercise.then(() => {
      expect(restored).toBe(true);
      expect(promiseConstructorHits).toBe(0);
      expect(promiseThenHits).toBe(0);
      expect(speciesHits).toBe(0);
      expect(inheritedThenHits).toBe(0);
      expectHardenedPromise(diagnosticPromise!);
      expectHardenedPromise(publicPromise!);
      expect(Object.getPrototypeOf(diagnosticValue)).toBeNull();
      expect(diagnosticValue).toEqual({
        ok: false,
        stage: "input",
        reason: "schema_invalid",
      });
      expect(publicError).toBeInstanceOf(
        ProviderReleaseTargetUniversePointClosureValidationError,
      );
      expect(Object.isFrozen(publicError)).toBe(true);
      expect(
        Object.getOwnPropertyDescriptor(Promise.prototype, "constructor"),
      ).toEqual(promiseConstructorDescriptor);
      expect(
        Object.getOwnPropertyDescriptor(Promise.prototype, "then"),
      ).toEqual(promiseThenDescriptor);
      expect(Object.getOwnPropertyDescriptor(Promise, Symbol.species)).toEqual(
        speciesDescriptor,
      );
      expect(
        Object.getOwnPropertyDescriptor(Object.prototype, "then"),
      ).toEqual(objectThenDescriptor);
    });
  });

  it("enforces exact input, opaque capability identity, cross-block identity, and 4096 caps before crypto", async () => {
    pointCalls = 0;
    verifyCalls = 0;

    const extra = request() as ValidateProviderReleaseTargetUniversePointClosureV1Input & {
      current?: boolean;
    };
    extra.current = true;
    await expect(
      diagnoseProviderReleaseTargetUniversePointClosureV1(extra),
    ).resolves.toEqual({ ok: false, stage: "input", reason: "schema_invalid" });

    const nestedRawShapeCases: ReadonlyArray<{
      readonly name: string;
      readonly mutate: (
        payload: Record<string, unknown>,
      ) => void;
    }> = [
      {
        name: "distribution binding extra key",
        mutate(payload) {
          (payload.distributionRootBinding as Record<string, unknown>).extra =
            true;
        },
      },
      {
        name: "bootstrap pin wrong container",
        mutate(payload) {
          (payload.distributionRootBinding as Record<string, unknown>)
            .bootstrapTrustBundle = "not-an-object";
        },
      },
      {
        name: "history policy extra key",
        mutate(payload) {
          const binding = payload.distributionRootBinding as Record<
            string,
            unknown
          >;
          (binding.historyPolicy as Record<string, unknown>).extra = true;
        },
      },
      {
        name: "active root metadata extra key",
        mutate(payload) {
          (payload.activeRootMetadata as Record<string, unknown>).extra = true;
        },
      },
      {
        name: "active root metadata wrong container",
        mutate(payload) {
          payload.activeRootMetadata = [];
        },
      },
    ];
    for (const testCase of nestedRawShapeCases) {
      const nested = request();
      testCase.mutate(
        nested.releaseTargetUniverse.payload as unknown as Record<
          string,
          unknown
        >,
      );
      expect(
        await diagnoseProviderReleaseTargetUniversePointClosureV1(nested),
        testCase.name,
      ).toEqual({ ok: false, stage: "input", reason: "schema_invalid" });
      expect(pointCalls, testCase.name).toBe(0);
      expect(verifyCalls, testCase.name).toBe(0);
    }

    let fakeTrapCalls = 0;
    const fakeCapability = new Proxy(
      {},
      {
        get() {
          fakeTrapCalls += 1;
          throw new Error("fake capability must stay opaque");
        },
        ownKeys() {
          fakeTrapCalls += 1;
          throw new Error("fake capability must stay opaque");
        },
      },
    );
    const fake = request();
    (fake as unknown as Record<string, unknown>).strictCryptoCapability =
      fakeCapability as ProviderStrictEd25519OpaqueCapabilityV1;
    await expect(
      diagnoseProviderReleaseTargetUniversePointClosureV1(fake),
    ).resolves.toEqual({ ok: false, stage: "input", reason: "schema_invalid" });
    expect(fakeTrapCalls).toBe(0);

    const aliased = request();
    aliased.releaseTargetUniverse.payload.distributionRootBinding =
      aliased.distributionRootBinding;
    await expect(
      diagnoseProviderReleaseTargetUniversePointClosureV1(aliased),
    ).resolves.toEqual({ ok: false, stage: "input", reason: "schema_invalid" });

    const cyclic = request();
    const cyclicMetadata = cyclic.releaseTargetUniverse.payload
      .activeRootMetadata as unknown as Record<string, unknown>;
    cyclicMetadata.self = cyclicMetadata;
    await expect(
      diagnoseProviderReleaseTargetUniversePointClosureV1(cyclic),
    ).resolves.toEqual({ ok: false, stage: "input", reason: "schema_invalid" });

    const oversized = request();
    let oversizedOwnKeysCalls = 0;
    oversized.releaseTargetUniverse.payload.targets = new Proxy(Array.from(
      { length: 4097 },
      () => clone(golden.targetDiscoveryResult.payload.targets[0]!),
    ), {
      ownKeys(target) {
        oversizedOwnKeysCalls += 1;
        return Reflect.ownKeys(target);
      },
    });
    await expect(
      diagnoseProviderReleaseTargetUniversePointClosureV1(oversized),
    ).resolves.toEqual({ ok: false, stage: "input", reason: "schema_invalid" });
    expect(oversizedOwnKeysCalls).toBe(0);

    const longString = request();
    (
      longString.releaseTargetUniverse.payload as unknown as Record<
        string,
        unknown
      >
    ).universeSignature = "x".repeat(4097);
    await expect(
      diagnoseProviderReleaseTargetUniversePointClosureV1(longString),
    ).resolves.toEqual({ ok: false, stage: "input", reason: "schema_invalid" });
    expect(pointCalls).toBe(0);
    expect(verifyCalls).toBe(0);
  });

  it("retains nested and self-removing Proxies in the one-clone collector", async () => {
    pointCalls = 0;
    verifyCalls = 0;
    let prototypeReads = 0;
    const input = request();
    const payload = input.releaseTargetUniverse.payload as unknown as {
      activeRootMetadata: object;
    };
    const replacement = clone(golden.activeRootMetadata);
    const proxy = new Proxy(clone(golden.activeRootMetadata), {
      getPrototypeOf(target) {
        prototypeReads += 1;
        payload.activeRootMetadata = replacement;
        return Reflect.getPrototypeOf(target);
      },
    });
    payload.activeRootMetadata = proxy;

    await expect(
      diagnoseProviderReleaseTargetUniversePointClosureV1(input),
    ).resolves.toEqual({ ok: false, stage: "input", reason: "schema_invalid" });
    expect(prototypeReads).toBeGreaterThan(0);
    expect(payload.activeRootMetadata).toBe(replacement);
    expect(pointCalls).toBe(0);
    expect(verifyCalls).toBe(0);
  });

  it("preserves the detached snapshot across after-start and crypto-host mutation", async () => {
    pointCalls = 0;
    verifyCalls = 0;
    const input = request();
    let reachedResolve: (() => void) | undefined;
    const reached = new Promise<void>((resolve) => {
      reachedResolve = resolve;
    });
    verificationReached = reachedResolve;
    blockNextVerification = true;
    const promise = validateProviderReleaseTargetUniversePointClosureV1(input);
    await reached;
    input.releaseTargetUniverse.payload.coverageBasis.resolution = {
      state: "incomplete",
      reason: "target_discovery_unresolved",
    };
    input.releaseTargetUniverse.payload.targets.reverse();
    releaseVerification?.();
    const value = await promise;
    expect(value.coverageResolution).toEqual({
      state: "incomplete",
      reason: "taxonomy_mapping_unresolved",
    });
    expect(value.releaseTargetUniverse.payload.targets).not.toEqual(
      input.releaseTargetUniverse.payload.targets,
    );
    expect(pointCalls).toBe(1);
    expect(verifyCalls).toBe(7);

    pointCalls = 0;
    verifyCalls = 0;
    const hostMutationInput = request();
    mutateDuringNextVerification = () => {
      hostMutationInput.releaseTargetUniverse.payload.buckets.length = 0;
    };
    const hostMutationValue =
      await validateProviderReleaseTargetUniversePointClosureV1(
        hostMutationInput,
      );
    expect(hostMutationValue.bucketCount).toBeGreaterThan(0);
    expect(pointCalls).toBe(1);
    expect(verifyCalls).toBe(7);
  });

  it("short-circuits the 16-stage semantic order with the specified reasons", async () => {
    pointCalls = 0;
    verifyCalls = 0;
    const inheritedFailure = request();
    const inheritedResult = inheritedFailure.targetDiscoveryResult.payload as
      unknown as Record<string, unknown>;
    const inheritedSignature = inheritedResult.discoverySignature as string;
    inheritedResult.discoverySignature =
      `${inheritedSignature.slice(0, -1)}${
        inheritedSignature.endsWith("0") ? "1" : "0"
      }`;
    await expect(
      diagnoseProviderReleaseTargetUniversePointClosureV1(inheritedFailure),
    ).resolves.toEqual({
      ok: false,
      stage: "target_discovery_closure",
      reason: "source_invalid",
    });
    expect(pointCalls).toBe(1);
    expect(verifyCalls).toBe(6);

    type MutableEnvelope = any;
    const cases: ReadonlyArray<{
      readonly name: string;
      readonly mutate: (envelope: MutableEnvelope) => MutableEnvelope;
      readonly stage: string;
      readonly reason: string;
      readonly expectedVerifyCalls: number;
    }> = [
      {
        name: "generation/predecessor",
        mutate(envelope) {
          envelope.payload.universeGeneration = 2;
          return resignUniverseEnvelope(envelope);
        },
        stage: "universe_structure",
        reason: "coverage_mismatch",
        expectedVerifyCalls: 6,
      },
      {
        name: "distribution before active root",
        mutate(envelope) {
          envelope.payload.distributionRootBinding.releaseRevisionDigest =
            `sha256:${"a".repeat(64)}`;
          envelope.payload.activeRootMetadata.contentDigest =
            `sha256:${"b".repeat(64)}`;
          return resignUniverseEnvelope(envelope);
        },
        stage: "universe_distribution_binding",
        reason: "binding_mismatch",
        expectedVerifyCalls: 6,
      },
      {
        name: "active root",
        mutate(envelope) {
          envelope.payload.activeRootMetadata.contentDigest =
            `sha256:${"a".repeat(64)}`;
          return resignUniverseEnvelope(envelope);
        },
        stage: "universe_active_root",
        reason: "root_mismatch",
        expectedVerifyCalls: 6,
      },
      {
        name: "taxonomy pin",
        mutate(envelope) {
          envelope.payload.publicSupportTaxonomy.contentDigest =
            `sha256:${"a".repeat(64)}`;
          return resignUniverseEnvelope(envelope);
        },
        stage: "universe_taxonomy_pin",
        reason: "pin_mismatch",
        expectedVerifyCalls: 6,
      },
      {
        name: "coverage Matrix pin before Discovery pin",
        mutate(envelope) {
          envelope.payload.coverageBasis.releaseMatrix.contentDigest =
            `sha256:${"a".repeat(64)}`;
          envelope.payload.coverageBasis.targetDiscoveryResult.contentDigest =
            `sha256:${"b".repeat(64)}`;
          return resignUniverseEnvelope(envelope);
        },
        stage: "universe_coverage_pins",
        reason: "pin_mismatch",
        expectedVerifyCalls: 6,
      },
      {
        name: "coverage limits before digest",
        mutate(envelope) {
          envelope.payload.coverageBasis.limits.maxTargetEntriesPerArtifact =
            4095;
          envelope.payload.coverageBasis.observationCutDigest =
            `sha256:${"a".repeat(64)}`;
          return resignUniverseEnvelope(envelope);
        },
        stage: "universe_coverage_binding",
        reason: "binding_mismatch",
        expectedVerifyCalls: 6,
      },
      {
        name: "coverage ruleset before dimensions",
        mutate(envelope) {
          envelope.payload.coverageBasis.discoveryRulesetVersion =
            "provider_release_target_discovery_v2";
          envelope.payload.coverageBasis.requiredDimensions[0] =
            "architecture";
          return resignUniverseEnvelope(envelope);
        },
        stage: "universe_coverage_binding",
        reason: "binding_mismatch",
        expectedVerifyCalls: 6,
      },
      {
        name: "coverage dimensions before sources",
        mutate(envelope) {
          envelope.payload.coverageBasis.requiredDimensions[0] =
            "architecture";
          envelope.payload.coverageBasis.observationSources[0] =
            "target_discovery_runner";
          return resignUniverseEnvelope(envelope);
        },
        stage: "universe_coverage_binding",
        reason: "binding_mismatch",
        expectedVerifyCalls: 6,
      },
      {
        name: "coverage sources before adjacent bundle digest",
        mutate(envelope) {
          envelope.payload.coverageBasis.observationSources[0] =
            "target_discovery_runner";
          envelope.payload.coverageBasis.targetDiscoveryInputBundleContentDigest =
            `sha256:${"a".repeat(64)}`;
          return resignUniverseEnvelope(envelope);
        },
        stage: "universe_coverage_binding",
        reason: "binding_mismatch",
        expectedVerifyCalls: 6,
      },
      {
        name: "coverage binding before counts",
        mutate(envelope) {
          envelope.payload.coverageBasis.observationCutDigest =
            `sha256:${"a".repeat(64)}`;
          envelope.payload.coverageBasis.releaseMatrixTargetCount += 1;
          return resignUniverseEnvelope(envelope);
        },
        stage: "universe_coverage_binding",
        reason: "digest_mismatch",
        expectedVerifyCalls: 6,
      },
      {
        name: "coverage count before Matrix set digest",
        mutate(envelope) {
          envelope.payload.coverageBasis.releaseMatrixTargetCount += 1;
          envelope.payload.coverageBasis.releaseMatrixTargetSetDigest =
            `sha256:${"a".repeat(64)}`;
          return resignUniverseEnvelope(envelope);
        },
        stage: "universe_coverage_counts",
        reason: "count_mismatch",
        expectedVerifyCalls: 6,
      },
      {
        name: "Matrix set digest before discovered count",
        mutate(envelope) {
          envelope.payload.coverageBasis.releaseMatrixTargetSetDigest =
            `sha256:${"a".repeat(64)}`;
          envelope.payload.coverageBasis.discoveredTargetCount += 1;
          return resignUniverseEnvelope(envelope);
        },
        stage: "universe_coverage_counts",
        reason: "digest_mismatch",
        expectedVerifyCalls: 6,
      },
      {
        name: "discovered count before set digest",
        mutate(envelope) {
          envelope.payload.coverageBasis.discoveredTargetCount += 1;
          envelope.payload.coverageBasis.discoveredTargetSetDigest =
            `sha256:${"a".repeat(64)}`;
          return resignUniverseEnvelope(envelope);
        },
        stage: "universe_coverage_counts",
        reason: "count_mismatch",
        expectedVerifyCalls: 6,
      },
      {
        name: "discovered set digest before unresolved count",
        mutate(envelope) {
          envelope.payload.coverageBasis.discoveredTargetSetDigest =
            `sha256:${"a".repeat(64)}`;
          envelope.payload.coverageBasis.unresolvedObservationCount += 1;
          return resignUniverseEnvelope(envelope);
        },
        stage: "universe_coverage_counts",
        reason: "digest_mismatch",
        expectedVerifyCalls: 6,
      },
      {
        name: "target ordering before count",
        mutate(envelope) {
          const reversed = [...envelope.payload.targets].reverse();
          reversed.push(clone(reversed[0]));
          envelope.payload.targets = reversed;
          return resignUniverseEnvelope(envelope);
        },
        stage: "universe_target_union",
        reason: "ordering_invalid",
        expectedVerifyCalls: 6,
      },
      {
        name: "resolution",
        mutate(envelope) {
          envelope.payload.coverageBasis.resolution = {
            state: "incomplete",
            reason: "target_discovery_unresolved",
          };
          return resignUniverseEnvelope(envelope);
        },
        stage: "universe_resolution",
        reason: "coverage_mismatch",
        expectedVerifyCalls: 6,
      },
      {
        name: "buckets",
        mutate(envelope) {
          envelope.payload.buckets[0]!.architecture =
            envelope.payload.buckets[0]!.architecture === "arm64"
              ? "x86_64"
              : "arm64";
          return resignUniverseEnvelope(envelope);
        },
        stage: "universe_buckets",
        reason: "coverage_mismatch",
        expectedVerifyCalls: 6,
      },
      {
        name: "signature binding",
        mutate(envelope) {
          envelope.payload.universeSignature =
            envelope.payload.universeSignature.replace(
              golden.activeRoot.rootKeyId,
              "a".repeat(22),
            );
          return envelope;
        },
        stage: "universe_signature_binding",
        reason: "root_mismatch",
        expectedVerifyCalls: 6,
      },
      {
        name: "signature",
        mutate(envelope) {
          envelope.payload.universeSignature =
            `${envelope.payload.universeSignature.slice(0, -1)}${
              envelope.payload.universeSignature.endsWith("0") ? "1" : "0"
            }`;
          return envelope;
        },
        stage: "universe_signature",
        reason: "signature_invalid",
        expectedVerifyCalls: 7,
      },
      {
        name: "digest",
        mutate(envelope) {
          envelope.contentDigest = `sha256:${"a".repeat(64)}`;
          return envelope;
        },
        stage: "universe_digest",
        reason: "digest_mismatch",
        expectedVerifyCalls: 7,
      },
      {
        name: "envelope",
        mutate(envelope) {
          envelope.universeGeneration = 2;
          return envelope;
        },
        stage: "universe_envelope",
        reason: "envelope_mismatch",
        expectedVerifyCalls: 7,
      },
    ];

    for (const testCase of cases) {
      pointCalls = 0;
      verifyCalls = 0;
      const diagnostic =
        await diagnoseProviderReleaseTargetUniversePointClosureV1(
          request(testCase.mutate(makeUniverseEnvelope())),
        );
      expect(diagnostic, testCase.name).toEqual({
        ok: false,
        stage: testCase.stage,
        reason: testCase.reason,
      });
      expect(pointCalls, testCase.name).toBe(1);
      expect(verifyCalls, testCase.name).toBe(testCase.expectedVerifyCalls);
    }
  });

  it("keeps the standalone locator authority-free, one-clone, and getter-free", () => {
    pointCalls = 0;
    verifyCalls = 0;
    const envelope = makeUniverseEnvelope();
    const path = buildProviderReleaseTargetUniverseRelativePathV1(
      clone(envelope),
    );
    expect(path).toMatch(
      /^provider\/release-target-universe\/[^/]+\.json$/u,
    );
    expect(pointCalls).toBe(0);
    expect(verifyCalls).toBe(0);

    let getterCalls = 0;
    const accessor = clone(envelope) as unknown as {
      payload?: unknown;
    };
    Object.defineProperty(accessor, "payload", {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return envelope.payload;
      },
    });
    expect(() =>
      buildProviderReleaseTargetUniverseRelativePathV1(accessor),
    ).toThrow();
    expect(getterCalls).toBe(0);
    expect(pointCalls).toBe(0);
    expect(verifyCalls).toBe(0);

    const wrongDigest = clone(envelope);
    wrongDigest.contentDigest = `sha256:${"a".repeat(64)}` as
      typeof wrongDigest.contentDigest;
    expect(() =>
      buildProviderReleaseTargetUniverseRelativePathV1(wrongDigest),
    ).toThrow();
    const wrongGeneration = clone(envelope);
    wrongGeneration.universeGeneration = 2;
    expect(() =>
      buildProviderReleaseTargetUniverseRelativePathV1(wrongGeneration),
    ).toThrow();

    const structuredCloneDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "structuredClone",
    );
    const selfRemoving = clone(envelope);
    const parent = selfRemoving.payload as unknown as {
      activeRootMetadata: object;
    };
    const replacement = clone(golden.activeRootMetadata);
    let proxyPrototypeReads = 0;
    let replacementCloneCalls = 0;
    parent.activeRootMetadata = new Proxy(clone(golden.activeRootMetadata), {
      getPrototypeOf(target) {
        proxyPrototypeReads += 1;
        parent.activeRootMetadata = replacement;
        Object.defineProperty(globalThis, "structuredClone", {
          configurable: true,
          enumerable: structuredCloneDescriptor?.enumerable ?? false,
          writable: true,
          value() {
            replacementCloneCalls += 1;
            return { forged: true };
          },
        });
        return Reflect.getPrototypeOf(target);
      },
    });
    try {
      expect(() =>
        buildProviderReleaseTargetUniverseRelativePathV1(selfRemoving),
      ).toThrow();
    } finally {
      restoreOwnDescriptor(
        globalThis,
        "structuredClone",
        structuredCloneDescriptor,
      );
    }
    expect(proxyPrototypeReads).toBeGreaterThan(0);
    expect(parent.activeRootMetadata).toBe(replacement);
    expect(replacementCloneCalls).toBe(0);
    expect(
      Object.getOwnPropertyDescriptor(globalThis, "structuredClone"),
    ).toEqual(structuredCloneDescriptor);
  });
});
