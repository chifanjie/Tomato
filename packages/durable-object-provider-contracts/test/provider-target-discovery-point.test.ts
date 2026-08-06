import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import {
  ProviderTargetDiscoveryPointClosureValidationError,
  buildProviderPublicSupportTaxonomyRelativePathV1,
  buildProviderReleaseMatrixRelativePathV1,
  buildProviderTargetDiscoveryFixtureManifestRelativePathV1,
  buildProviderTargetDiscoveryResultRelativePathV1,
  buildProviderTargetDiscoveryRunnerRunRelativePathV1,
  diagnoseProviderTargetDiscoveryPointClosureV1,
  validateProviderTargetDiscoveryPointClosureV1,
  type ValidateProviderTargetDiscoveryPointClosureV1Input,
} from "../src/provider-target-discovery-point.js";
import {
  createProviderTargetDiscoveryPointSnapshotV1,
  registerProviderTargetDiscoveryPointPreSnapshotV1,
  takeProviderTargetDiscoveryPointClosureSnapshotV1,
  takeProviderTargetDiscoveryPointPreSnapshotV1,
  type ProviderTargetDiscoveryPointSnapshotV1,
} from "../src/provider-target-discovery-point-internal.js";
import {
  PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_PATH_V1,
  ProviderTargetDiscoveryPointGoldenManifestV1Schema,
  type ProviderTargetDiscoveryPointGoldenManifestV1,
} from "../src/provider-target-discovery-point-fixtures.js";
import {
  createProviderPointFulfilledPromiseV1,
  createProviderPointIntrinsicAwaitProbeV1,
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
const strictManifestBytes = resourceBytes(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1);
let pointCalls = 0;
let verifyCalls = 0;
let blockNextVerification = false;
let verificationReached: (() => void) | undefined;
let releaseVerification: (() => void) | undefined;
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
        ) throw new TypeError("unexpected fixed resource request");
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

function deepFreezeForTest<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreezeForTest(child);
    Object.freeze(value);
  }
  return value;
}

function request(
  manifest: ProviderTargetDiscoveryPointGoldenManifestV1 = golden,
): ValidateProviderTargetDiscoveryPointClosureV1Input {
  return {
    distributionRootBinding: clone(manifest.distributionRootBinding),
    activeRootMetadata: clone(manifest.activeRootMetadata),
    activeRoot: clone(manifest.activeRoot),
    fixtureCorpusManifest: clone(manifest.fixtureCorpusManifest),
    suiteManifest: clone(manifest.suiteManifest),
    publicSupportTaxonomy: clone(manifest.publicSupportTaxonomy),
    releaseMatrix: clone(manifest.releaseMatrix),
    targetDiscoveryFixtureManifest: clone(manifest.targetDiscoveryFixtureManifest),
    targetDiscoveryRunnerRun: clone(manifest.targetDiscoveryRunnerRun),
    targetDiscoveryResult: clone(manifest.targetDiscoveryResult),
    strictCryptoCapability: capability,
  };
}

function snapshotForTest(
  input: ValidateProviderTargetDiscoveryPointClosureV1Input,
): ProviderTargetDiscoveryPointSnapshotV1 {
  return createProviderTargetDiscoveryPointSnapshotV1({
    activeRoot: deepFreezeForTest(input.activeRoot),
    activeRootMetadata: deepFreezeForTest(input.activeRootMetadata),
    distributionRootBinding: deepFreezeForTest(input.distributionRootBinding),
    fixtureCorpusManifest: deepFreezeForTest(input.fixtureCorpusManifest),
    publicSupportTaxonomy: deepFreezeForTest(input.publicSupportTaxonomy),
    releaseMatrix: deepFreezeForTest(input.releaseMatrix),
    strictCryptoCapability: input.strictCryptoCapability,
    suiteManifest: deepFreezeForTest(input.suiteManifest),
    targetDiscoveryFixtureManifest: deepFreezeForTest(
      input.targetDiscoveryFixtureManifest,
    ),
    targetDiscoveryResult: deepFreezeForTest(input.targetDiscoveryResult),
    targetDiscoveryRunnerRun: deepFreezeForTest(
      input.targetDiscoveryRunnerRun,
    ),
  });
}

function restoreOwnDescriptorForTest(
  owner: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor === undefined) {
    Reflect.deleteProperty(owner, key);
  } else {
    Object.defineProperty(owner, key, descriptor);
  }
}

function createSelfRemovingTopLevelDescriptorProxyForTest<T extends object>(
  target: T,
  onFirstDescriptorTrap: () => void,
): Readonly<{ readonly holder: { current: T }; readonly proxy: T }> {
  const holder = Object.create(null) as { current: T };
  let descriptorTrapCalls = 0;
  const proxy = new Proxy(target, {
    getOwnPropertyDescriptor(innerTarget, key) {
      descriptorTrapCalls += 1;
      if (descriptorTrapCalls === 1) {
        holder.current = innerTarget;
        onFirstDescriptorTrap();
      }
      return Reflect.getOwnPropertyDescriptor(innerTarget, key);
    },
  });
  holder.current = proxy;
  return Object.freeze({ holder, proxy });
}

interface HardenedPromiseMethodsForTest {
  readonly constructor: unknown;
  readonly then: unknown;
  readonly catch: unknown;
  readonly finally: unknown;
}

function expectHardenedPointPromiseForTest(
  promise: Promise<unknown>,
  expected?: HardenedPromiseMethodsForTest,
): HardenedPromiseMethodsForTest {
  expect(promise).toBeInstanceOf(Promise);
  expect(Object.isFrozen(promise)).toBe(true);
  expect(Reflect.ownKeys(promise)).toEqual([
    "constructor",
    "then",
    "catch",
    "finally",
  ]);
  const methods = {
    constructor: Object.getOwnPropertyDescriptor(promise, "constructor")
      ?.value,
    then: Object.getOwnPropertyDescriptor(promise, "then")?.value,
    catch: Object.getOwnPropertyDescriptor(promise, "catch")?.value,
    finally: Object.getOwnPropertyDescriptor(promise, "finally")?.value,
  };
  for (const key of ["constructor", "then", "catch", "finally"] as const) {
    expect(Object.getOwnPropertyDescriptor(promise, key)).toMatchObject({
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }
  expect(methods.constructor).not.toBe(Promise);
  expect(typeof methods.constructor).toBe("function");
  expect(Object.isFrozen(methods.constructor)).toBe(true);
  expect(
    Object.isFrozen(
      (methods.constructor as { readonly prototype: object }).prototype,
    ),
  ).toBe(true);
  expect(
    Object.getOwnPropertyDescriptor(methods.constructor as object, Symbol.species),
  ).toMatchObject({
    value: methods.constructor,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  expect(Object.isFrozen(methods.then)).toBe(true);
  expect(Object.isFrozen(methods.catch)).toBe(true);
  expect(Object.isFrozen(methods.finally)).toBe(true);
  if (expected !== undefined) expect(methods).toEqual(expected);
  return methods;
}

function expectRecursivelyFrozenForTest(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) {
    expectRecursivelyFrozenForTest(child);
  }
}

async function expectInputDiagnostic(input: unknown): Promise<void> {
  const diagnostic = await diagnoseProviderTargetDiscoveryPointClosureV1(input);
  expect(diagnostic).toEqual({ ok: false, stage: "input", reason: "schema_invalid" });
}

describe("signed target discovery point closure", () => {
  it("exposes non-async wrappers and hardens clean success plus mixed Promise chains", async () => {
    expect(diagnoseProviderTargetDiscoveryPointClosureV1.constructor.name).toBe(
      "Function",
    );
    expect(validateProviderTargetDiscoveryPointClosureV1.constructor.name).toBe(
      "Function",
    );
    expect(
      Object.hasOwn(
        diagnoseProviderTargetDiscoveryPointClosureV1,
        "prototype",
      ),
    ).toBe(true);
    expect(
      Object.hasOwn(
        validateProviderTargetDiscoveryPointClosureV1,
        "prototype",
      ),
    ).toBe(true);

    const root = validateProviderTargetDiscoveryPointClosureV1(request());
    const methods = expectHardenedPointPromiseForTest(root);
    const first = root.then((value) => value);
    expectHardenedPointPromiseForTest(first, methods);
    const second = first.then((value) => value);
    expectHardenedPointPromiseForTest(second, methods);
    const marker = new Error("mixed target-discovery chain");
    const forcedRejection = second.then(() => {
      throw marker;
    });
    expectHardenedPointPromiseForTest(forcedRejection, methods);
    const recovered = forcedRejection.catch((error) => {
      expect(error).toBe(marker);
      return first;
    });
    expectHardenedPointPromiseForTest(recovered, methods);
    let finallyCalls = 0;
    const finalized = recovered.finally(() => {
      finallyCalls += 1;
    });
    expectHardenedPointPromiseForTest(finalized, methods);
    await expect(finalized).resolves.toMatchObject({
      authority: "none_target_discovery_point_structure_only",
    });
    expect(finallyCalls).toBe(1);
  });

  it("returns exact frozen null-prototype diagnostic and closure records", async () => {
    const failure = await diagnoseProviderTargetDiscoveryPointClosureV1({});
    expect(Object.getPrototypeOf(failure)).toBeNull();
    expect(Object.isFrozen(failure)).toBe(true);
    expect(Object.keys(failure)).toEqual(["ok", "stage", "reason"]);
    expect(failure).toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });

    const diagnostic = await diagnoseProviderTargetDiscoveryPointClosureV1(
      request(),
    );
    expect(Object.getPrototypeOf(diagnostic)).toBeNull();
    expect(Object.isFrozen(diagnostic)).toBe(true);
    expect(Object.keys(diagnostic)).toEqual(["ok", "value"]);
    expect(diagnostic.ok).toBe(true);
    if (!diagnostic.ok) throw new TypeError("expected successful diagnostic");
    const closure = diagnostic.value;
    expect(Object.getPrototypeOf(closure)).toBeNull();
    expect(Object.isFrozen(closure)).toBe(true);
    expect(Object.keys(closure)).toEqual([
      "authority",
      "distributionRootBinding",
      "activeRootMetadata",
      "publicSupportTaxonomy",
      "releaseMatrix",
      "realFilesystemSuiteManifest",
      "targetDiscoveryFixtureManifest",
      "targetDiscoveryRunner",
      "targetDiscoveryInputBundleContentDigest",
      "targetDiscoveryResult",
      "locators",
      "sourceRecordCount",
      "observationCount",
      "targetCount",
      "unresolvedObservationCount",
    ]);
    expectRecursivelyFrozenForTest(closure);

    const publicClosure = await validateProviderTargetDiscoveryPointClosureV1(
      request(),
    );
    expect(Object.getPrototypeOf(publicClosure)).toBeNull();
    expect(Object.isFrozen(publicClosure)).toBe(true);
    expect(Object.keys(publicClosure)).toEqual(Object.keys(closure));
    expect(
      takeProviderTargetDiscoveryPointClosureSnapshotV1(publicClosure),
    ).toBeUndefined();
  });

  it("rejects forged opaque capabilities before property observation or crypto", async () => {
    const cases: Array<{
      readonly capability: ProviderStrictEd25519OpaqueCapabilityV1;
      readonly observed: () => number;
    }> = [];

    cases.push({
      capability: {} as ProviderStrictEd25519OpaqueCapabilityV1,
      observed: () => 0,
    });

    let getterCalls = 0;
    const getterCapability = {};
    Object.defineProperty(getterCapability, "host", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "forged";
      },
    });
    cases.push({
      capability:
        getterCapability as ProviderStrictEd25519OpaqueCapabilityV1,
      observed: () => getterCalls,
    });

    let proxyTrapCalls = 0;
    const proxyCapability = new Proxy(
      {},
      {
        get() {
          proxyTrapCalls += 1;
          return undefined;
        },
        getOwnPropertyDescriptor() {
          proxyTrapCalls += 1;
          return undefined;
        },
        getPrototypeOf() {
          proxyTrapCalls += 1;
          return Object.prototype;
        },
        ownKeys() {
          proxyTrapCalls += 1;
          return [];
        },
      },
    );
    cases.push({
      capability: proxyCapability as ProviderStrictEd25519OpaqueCapabilityV1,
      observed: () => proxyTrapCalls,
    });

    for (let index = 0; index < cases.length; index += 1) {
      pointCalls = 0;
      verifyCalls = 0;
      const candidate = request();
      const selected = cases[index]!;
      const forged = {
        ...candidate,
        strictCryptoCapability: selected.capability,
      };
      await expectInputDiagnostic(forged);
      expect(selected.observed()).toBe(0);
      expect(pointCalls).toBe(0);
      expect(verifyCalls).toBe(0);
    }
  });

  it("does not consult Array iteration during the pre-clone JSON walk", async () => {
    const iteratorDescriptor = Object.getOwnPropertyDescriptor(
      Array.prototype,
      Symbol.iterator,
    );
    let iteratorCalls = 0;
    let getterCalls = 0;
    const input = request();
    Object.defineProperty(input.activeRoot, "unexpected", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return true;
      },
    });
    let pending!: Promise<unknown>;
    try {
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        configurable: true,
        enumerable: false,
        writable: true,
        value() {
          iteratorCalls += 1;
          throw new TypeError("poisoned Array iterator");
        },
      });
      pending = diagnoseProviderTargetDiscoveryPointClosureV1(input);
    } finally {
      restoreOwnDescriptorForTest(
        Array.prototype,
        Symbol.iterator,
        iteratorDescriptor,
      );
    }
    await expect(pending).resolves.toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });
    expect(iteratorCalls).toBe(0);
    expect(getterCalls).toBe(0);
  });

  it("uses captured global primordials through a full raw walk and clone rejection", async () => {
    const NativeObject = Object;
    const NativePromise = Promise;
    const NativeReflect = Reflect;
    const NativeWeakSet = WeakSet;
    const nativeDefineProperty = NativeObject.defineProperty;
    const nativeDeleteProperty = NativeReflect.deleteProperty;
    const objectDescriptor = NativeObject.getOwnPropertyDescriptor(
      globalThis,
      "Object",
    );
    const promiseDescriptor = NativeObject.getOwnPropertyDescriptor(
      globalThis,
      "Promise",
    );
    const reflectDescriptor = NativeObject.getOwnPropertyDescriptor(
      globalThis,
      "Reflect",
    );
    const weakSetDescriptor = NativeObject.getOwnPropertyDescriptor(
      globalThis,
      "WeakSet",
    );
    const iteratorKey = Symbol.iterator;
    const iteratorDescriptor = NativeObject.getOwnPropertyDescriptor(
      Array.prototype,
      iteratorKey,
    );
    const hits = {
      object: 0,
      promise: 0,
      reflect: 0,
      weakSet: 0,
      iterator: 0,
    };
    const restoreCaptured = (
      owner: object,
      key: PropertyKey,
      descriptor: PropertyDescriptor | undefined,
    ): void => {
      if (descriptor === undefined) {
        nativeDeleteProperty(owner, key);
      } else {
        nativeDefineProperty(owner, key, descriptor);
      }
    };

    const input = request();
    input.targetDiscoveryResult.payload = new Proxy(
      input.targetDiscoveryResult.payload,
      {},
    );
    let pending!: Promise<unknown>;
    try {
      nativeDefineProperty(globalThis, "Object", {
        configurable: true,
        enumerable: objectDescriptor?.enumerable ?? false,
        get() {
          hits.object += 1;
          return NativeObject;
        },
      });
      nativeDefineProperty(globalThis, "Promise", {
        configurable: true,
        enumerable: promiseDescriptor?.enumerable ?? false,
        get() {
          hits.promise += 1;
          return NativePromise;
        },
      });
      nativeDefineProperty(globalThis, "Reflect", {
        configurable: true,
        enumerable: reflectDescriptor?.enumerable ?? false,
        get() {
          hits.reflect += 1;
          return NativeReflect;
        },
      });
      nativeDefineProperty(globalThis, "WeakSet", {
        configurable: true,
        enumerable: weakSetDescriptor?.enumerable ?? false,
        get() {
          hits.weakSet += 1;
          return NativeWeakSet;
        },
      });
      nativeDefineProperty(Array.prototype, iteratorKey, {
        configurable: true,
        enumerable: false,
        writable: true,
        value() {
          hits.iterator += 1;
          throw new TypeError("poisoned Array iterator");
        },
      });
      pending = diagnoseProviderTargetDiscoveryPointClosureV1(input);
    } finally {
      restoreCaptured(globalThis, "Object", objectDescriptor);
      restoreCaptured(globalThis, "Promise", promiseDescriptor);
      restoreCaptured(globalThis, "Reflect", reflectDescriptor);
      restoreCaptured(globalThis, "WeakSet", weakSetDescriptor);
      restoreCaptured(Array.prototype, iteratorKey, iteratorDescriptor);
    }

    await expect(pending).resolves.toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });
    expect(hits).toEqual({
      object: 0,
      promise: 0,
      reflect: 0,
      weakSet: 0,
      iterator: 0,
    });
    expect(NativeObject.getOwnPropertyDescriptor(globalThis, "Object")).toEqual(
      objectDescriptor,
    );
    expect(
      NativeObject.getOwnPropertyDescriptor(globalThis, "Promise"),
    ).toEqual(promiseDescriptor);
    expect(NativeObject.getOwnPropertyDescriptor(globalThis, "Reflect")).toEqual(
      reflectDescriptor,
    );
    expect(
      NativeObject.getOwnPropertyDescriptor(globalThis, "WeakSet"),
    ).toEqual(weakSetDescriptor);
    expect(
      NativeObject.getOwnPropertyDescriptor(Array.prototype, iteratorKey),
    ).toEqual(iteratorDescriptor);
  });

  it("keeps pre-snapshot and successful closure sidecars explicit and one-shot", async () => {
    const ordinary = await diagnoseProviderTargetDiscoveryPointClosureV1(
      request(),
    );
    expect(ordinary.ok).toBe(true);
    if (!ordinary.ok) throw new TypeError("expected ordinary success");
    expect(
      takeProviderTargetDiscoveryPointClosureSnapshotV1(ordinary.value),
    ).toBeUndefined();

    const optedInput = request();
    const optedSnapshot = snapshotForTest(optedInput);
    expect(Object.getPrototypeOf(optedSnapshot)).toBeNull();
    expect(Object.isFrozen(optedSnapshot)).toBe(true);
    expect(Object.keys(optedSnapshot)).toEqual([
      "activeRoot",
      "activeRootMetadata",
      "distributionRootBinding",
      "fixtureCorpusManifest",
      "publicSupportTaxonomy",
      "releaseMatrix",
      "strictCryptoCapability",
      "suiteManifest",
      "targetDiscoveryFixtureManifest",
      "targetDiscoveryResult",
      "targetDiscoveryRunnerRun",
    ]);
    expect(optedSnapshot.strictCryptoCapability).toBe(capability);
    registerProviderTargetDiscoveryPointPreSnapshotV1(
      optedInput,
      optedSnapshot,
    );
    const opted = await diagnoseProviderTargetDiscoveryPointClosureV1(
      optedInput,
    );
    expect(opted.ok).toBe(true);
    if (!opted.ok) throw new TypeError("expected opted-in success");
    expect(
      takeProviderTargetDiscoveryPointClosureSnapshotV1(opted.value),
    ).toBe(optedSnapshot);
    expect(
      takeProviderTargetDiscoveryPointClosureSnapshotV1(opted.value),
    ).toBeUndefined();
    expect(
      takeProviderTargetDiscoveryPointPreSnapshotV1(optedInput),
    ).toBeUndefined();

    const failedInput = request();
    failedInput.targetDiscoveryResult.payload.discoverySignature =
      failedInput.targetDiscoveryResult.payload.discoverySignature.replace(
        /.$/u,
        failedInput.targetDiscoveryResult.payload.discoverySignature.endsWith(
          "0",
        )
          ? "1"
          : "0",
      ) as typeof failedInput.targetDiscoveryResult.payload.discoverySignature;
    const failedSnapshot = snapshotForTest(failedInput);
    registerProviderTargetDiscoveryPointPreSnapshotV1(
      failedInput,
      failedSnapshot,
    );
    const failed = await diagnoseProviderTargetDiscoveryPointClosureV1(
      failedInput,
    );
    expect(failed).toEqual({
      ok: false,
      stage: "result_signature",
      reason: "signature_invalid",
    });
    expect(
      takeProviderTargetDiscoveryPointPreSnapshotV1(failedInput),
    ).toBeUndefined();
    expect(
      takeProviderTargetDiscoveryPointClosureSnapshotV1(failed),
    ).toBeUndefined();

    const leftInput = request();
    const rightInput = request();
    const leftSnapshot = snapshotForTest(leftInput);
    const rightSnapshot = snapshotForTest(rightInput);
    registerProviderTargetDiscoveryPointPreSnapshotV1(
      leftInput,
      leftSnapshot,
    );
    registerProviderTargetDiscoveryPointPreSnapshotV1(
      rightInput,
      rightSnapshot,
    );
    const [left, right] = await Promise.all([
      diagnoseProviderTargetDiscoveryPointClosureV1(leftInput),
      diagnoseProviderTargetDiscoveryPointClosureV1(rightInput),
    ]);
    expect(left.ok).toBe(true);
    expect(right.ok).toBe(true);
    if (!left.ok || !right.ok) throw new TypeError("expected parallel success");
    expect(
      takeProviderTargetDiscoveryPointClosureSnapshotV1(left.value),
    ).toBe(leftSnapshot);
    expect(
      takeProviderTargetDiscoveryPointClosureSnapshotV1(right.value),
    ).toBe(rightSnapshot);

    const mutableCapability = {} as ProviderStrictEd25519OpaqueCapabilityV1;
    const mutableCapabilityInput = request();
    const identitySnapshot = createProviderTargetDiscoveryPointSnapshotV1({
      ...mutableCapabilityInput,
      strictCryptoCapability: mutableCapability,
    });
    expect(identitySnapshot.strictCryptoCapability).toBe(mutableCapability);
    expect(Object.isFrozen(mutableCapability)).toBe(false);
    expect(Object.isFrozen(identitySnapshot)).toBe(true);
  });

  it("uses the bootstrap-captured TypeError after a self-removing raw Proxy poisons the global", async () => {
    const NativeTypeError = TypeError;
    const typeErrorDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "TypeError",
    );
    let globalTypeErrorGetterCalls = 0;
    const target = {
      ...request(),
      strictCryptoCapability:
        {} as ProviderStrictEd25519OpaqueCapabilityV1,
    } satisfies ValidateProviderTargetDiscoveryPointClosureV1Input;
    const { holder, proxy } =
      createSelfRemovingTopLevelDescriptorProxyForTest(target, () => {
        Object.defineProperty(globalThis, "TypeError", {
          configurable: true,
          enumerable: typeErrorDescriptor?.enumerable ?? false,
          get() {
            globalTypeErrorGetterCalls += 1;
            return NativeTypeError;
          },
        });
      });

    pointCalls = 0;
    verifyCalls = 0;
    let pending!: Promise<unknown>;
    try {
      pending = diagnoseProviderTargetDiscoveryPointClosureV1(proxy);
      expect(holder.current).toBe(target);
    } finally {
      restoreOwnDescriptorForTest(
        globalThis,
        "TypeError",
        typeErrorDescriptor,
      );
    }

    await expect(pending).resolves.toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });
    expect(globalTypeErrorGetterCalls).toBe(0);
    expect(pointCalls).toBe(0);
    expect(verifyCalls).toBe(0);
    expect(Object.getOwnPropertyDescriptor(globalThis, "TypeError")).toEqual(
      typeErrorDescriptor,
    );
  });

  it("keeps the same-call self-removing Proxy failure non-thenable after poisoning Object.prototype.then", () => {
    const thenDescriptor = Object.getOwnPropertyDescriptor(
      Object.prototype,
      "then",
    );
    let inheritedThenCalls = 0;
    let observed: unknown;
    let restored = false;
    const forgedAcceptedValue = Object.freeze({ forgedAccepted: true as const });
    function inheritedForgedThen(
      resolve: (value: typeof forgedAcceptedValue) => void,
    ): void {
      inheritedThenCalls += 1;
      resolve(forgedAcceptedValue);
    }
    const restore = (): void => {
      if (restored) return;
      restoreOwnDescriptorForTest(Object.prototype, "then", thenDescriptor);
      restored = true;
    };
    const kickoff = createProviderPointFulfilledPromiseV1(undefined);
    const exercise = kickoff.then(() => {
      try {
        pointCalls = 0;
        verifyCalls = 0;
        const target = request();
        const { holder, proxy } =
          createSelfRemovingTopLevelDescriptorProxyForTest(target, () => {
            Object.defineProperty(Object.prototype, "then", {
              configurable: true,
              enumerable: false,
              writable: true,
              value: inheritedForgedThen,
            });
          });
        const pending = diagnoseProviderTargetDiscoveryPointClosureV1(proxy);
        expect(holder.current).toBe(target);
        expectHardenedPointPromiseForTest(pending);
        return pending.then((value) => {
          observed = value;
          expect(Object.getPrototypeOf(value)).toBeNull();
          expect(Object.isFrozen(value)).toBe(true);
          expect(Object.keys(value)).toEqual(["ok", "stage", "reason"]);
          expect(value).toEqual({
            ok: false,
            stage: "input",
            reason: "schema_invalid",
          });
          expect(pointCalls).toBe(0);
          expect(verifyCalls).toBe(0);
          expect(inheritedThenCalls).toBe(0);
        }).finally(() => {
          restore();
        });
      } catch (error) {
        restore();
        throw error;
      }
    });
    return exercise.then(() => {
      expect(restored).toBe(true);
      expect(inheritedThenCalls).toBe(0);
      expect(Object.getPrototypeOf(observed)).toBeNull();
      expect(observed).toEqual({
        ok: false,
        stage: "input",
        reason: "schema_invalid",
      });
      expect(pointCalls).toBe(0);
      expect(verifyCalls).toBe(0);
      expect(
        Object.getOwnPropertyDescriptor(Object.prototype, "then"),
      ).toEqual(thenDescriptor);
    });
  });

  it("closes await, then, catch, finally and mixed chains when the same raw Proxy poisons Promise primordials", () => {
    const NativePromise = Promise;
    const PromiseSpecies = Symbol.species;
    const constructorDescriptor = Object.getOwnPropertyDescriptor(
      NativePromise.prototype,
      "constructor",
    );
    const thenDescriptor = Object.getOwnPropertyDescriptor(
      NativePromise.prototype,
      "then",
    );
    const speciesDescriptor = Object.getOwnPropertyDescriptor(
      NativePromise,
      PromiseSpecies,
    );
    let constructorPoisonCalls = 0;
    let thenPoisonCalls = 0;
    let speciesPoisonCalls = 0;
    let diagnosticFinallyCalls = 0;
    let publicFinallyCalls = 0;
    let diagnosticValue: unknown;
    let publicError: unknown;
    let diagnosticPromise: Promise<unknown> | undefined;
    let publicPromise: Promise<unknown> | undefined;
    let restored = false;
    const mixedChainMarker = new Error("target discovery mixed chain marker");
    const restore = (): void => {
      if (restored) return;
      restoreOwnDescriptorForTest(
        NativePromise.prototype,
        "constructor",
        constructorDescriptor,
      );
      restoreOwnDescriptorForTest(
        NativePromise.prototype,
        "then",
        thenDescriptor,
      );
      restoreOwnDescriptorForTest(
        NativePromise,
        PromiseSpecies,
        speciesDescriptor,
      );
      restored = true;
    };

    const kickoff = createProviderPointFulfilledPromiseV1(undefined);
    const stableMethods = expectHardenedPointPromiseForTest(kickoff);
    const exercise = kickoff.then(() => {
      try {
        function PoisonedPromiseConstructor(): Readonly<{ forged: true }> {
          return Object.freeze({ forged: true as const });
        }
        const poisonPromisePrimordials = (): void => {
          Object.defineProperty(NativePromise.prototype, "constructor", {
            configurable: true,
            enumerable: false,
            get() {
              constructorPoisonCalls += 1;
              return PoisonedPromiseConstructor;
            },
          });
          Object.defineProperty(NativePromise.prototype, "then", {
            configurable: true,
            enumerable: false,
            writable: true,
            value() {
              thenPoisonCalls += 1;
              return Object.freeze({ forged: true as const });
            },
          });
          Object.defineProperty(NativePromise, PromiseSpecies, {
            configurable: true,
            enumerable: false,
            get() {
              speciesPoisonCalls += 1;
              return PoisonedPromiseConstructor;
            },
          });
        };

        pointCalls = 0;
        verifyCalls = 0;
        const diagnosticTarget = request();
        const diagnosticRaw =
          createSelfRemovingTopLevelDescriptorProxyForTest(
            diagnosticTarget,
            poisonPromisePrimordials,
          );
        const publicTarget = request();
        const publicRaw = createSelfRemovingTopLevelDescriptorProxyForTest(
          publicTarget,
          () => undefined,
        );

        diagnosticPromise = diagnoseProviderTargetDiscoveryPointClosureV1(
          diagnosticRaw.proxy,
        );
        expect(diagnosticRaw.holder.current).toBe(diagnosticTarget);
        expectHardenedPointPromiseForTest(diagnosticPromise, stableMethods);
        publicPromise = validateProviderTargetDiscoveryPointClosureV1(
          publicRaw.proxy,
        );
        expect(publicRaw.holder.current).toBe(publicTarget);
        expectHardenedPointPromiseForTest(publicPromise, stableMethods);

        const awaitedDiagnostic = createProviderPointIntrinsicAwaitProbeV1(
          diagnosticPromise,
        );
        expectHardenedPointPromiseForTest(
          awaitedDiagnostic,
          stableMethods,
        );
        const directThen = awaitedDiagnostic.then((value) => {
          diagnosticValue = value;
          return value;
        });
        expectHardenedPointPromiseForTest(directThen, stableMethods);
        const diagnosticFinalized = directThen.finally(() => {
          diagnosticFinallyCalls += 1;
        });
        expectHardenedPointPromiseForTest(
          diagnosticFinalized,
          stableMethods,
        );
        const forcedRejection = diagnosticFinalized.then(() => {
          throw mixedChainMarker;
        });
        expectHardenedPointPromiseForTest(forcedRejection, stableMethods);
        const recovered = forcedRejection.catch((error) => {
          expect(error).toBe(mixedChainMarker);
          return diagnosticValue;
        });
        expectHardenedPointPromiseForTest(recovered, stableMethods);
        const mixedFinal = recovered.then((value) => value);
        expectHardenedPointPromiseForTest(mixedFinal, stableMethods);

        const publicCaught = publicPromise.catch((error) => {
          publicError = error;
          return "public-rejection-caught" as const;
        });
        expectHardenedPointPromiseForTest(publicCaught, stableMethods);
        const publicFinalized = publicCaught.finally(() => {
          publicFinallyCalls += 1;
        });
        expectHardenedPointPromiseForTest(publicFinalized, stableMethods);

        const joined = mixedFinal.then((value) =>
          publicFinalized.then((publicOutcome) => {
            expect(value).toBe(diagnosticValue);
            expect(publicOutcome).toBe("public-rejection-caught");
            if (value === null || typeof value !== "object") {
              throw new Error("expected a diagnostic record object");
            }
            expect(Object.getPrototypeOf(value)).toBeNull();
            expect(Object.isFrozen(value)).toBe(true);
            expect(Object.keys(value)).toEqual(["ok", "stage", "reason"]);
            expect(value).toEqual({
              ok: false,
              stage: "input",
              reason: "schema_invalid",
            });
            expect(publicError).toBeInstanceOf(
              ProviderTargetDiscoveryPointClosureValidationError,
            );
            expect(diagnosticFinallyCalls).toBe(1);
            expect(publicFinallyCalls).toBe(1);
            expect(pointCalls).toBe(0);
            expect(verifyCalls).toBe(0);
            expect(constructorPoisonCalls).toBe(0);
            expect(thenPoisonCalls).toBe(0);
            expect(speciesPoisonCalls).toBe(0);
          }),
        );
        expectHardenedPointPromiseForTest(joined, stableMethods);
        const restoredJoined = joined.finally(() => {
          restore();
          expect(
            Object.getOwnPropertyDescriptor(
              NativePromise.prototype,
              "constructor",
            ),
          ).toEqual(constructorDescriptor);
          expect(
            Object.getOwnPropertyDescriptor(NativePromise.prototype, "then"),
          ).toEqual(thenDescriptor);
          expect(
            Object.getOwnPropertyDescriptor(NativePromise, PromiseSpecies),
          ).toEqual(speciesDescriptor);
        });
        expectHardenedPointPromiseForTest(restoredJoined, stableMethods);
        return restoredJoined;
      } catch (error) {
        restore();
        throw error;
      }
    });
    expectHardenedPointPromiseForTest(exercise, stableMethods);
    const completion = exercise.then(() => {
      expect(restored).toBe(true);
      expect(constructorPoisonCalls).toBe(0);
      expect(thenPoisonCalls).toBe(0);
      expect(speciesPoisonCalls).toBe(0);
      expect(diagnosticPromise).toBeDefined();
      expect(publicPromise).toBeDefined();
      expectHardenedPointPromiseForTest(diagnosticPromise!);
      expectHardenedPointPromiseForTest(publicPromise!);
      expect(Object.getPrototypeOf(diagnosticValue)).toBeNull();
      expect(diagnosticValue).toEqual({
        ok: false,
        stage: "input",
        reason: "schema_invalid",
      });
      expect(publicError).toBeInstanceOf(
        ProviderTargetDiscoveryPointClosureValidationError,
      );
      expect(
        Object.getOwnPropertyDescriptor(
          NativePromise.prototype,
          "constructor",
        ),
      ).toEqual(constructorDescriptor);
      expect(
        Object.getOwnPropertyDescriptor(NativePromise.prototype, "then"),
      ).toEqual(thenDescriptor);
      expect(
        Object.getOwnPropertyDescriptor(NativePromise, PromiseSpecies),
      ).toEqual(speciesDescriptor);
    });
    expectHardenedPointPromiseForTest(completion, stableMethods);
    return completion;
  });

  it("performs exactly one active-root point admission and six signature verifications", async () => {
    pointCalls = 0;
    verifyCalls = 0;
    const result = await validateProviderTargetDiscoveryPointClosureV1(request());
    expect(result.authority).toBe("none_target_discovery_point_structure_only");
    expect(pointCalls).toBe(1);
    expect(verifyCalls).toBe(6);
    expect(Object.keys(result.locators)).toEqual([
      "publicSupportTaxonomy",
      "releaseMatrix",
      "targetDiscoveryFixtureManifest",
      "targetDiscoveryRunnerRun",
      "targetDiscoveryResult",
    ]);
  });

  it("keeps the discovery runner profile independent from the real-FS suite runner profile", async () => {
    const input = request();
    expect(input.targetDiscoveryRunnerRun.payload.runnerProfileDigest).not.toBe(
      input.suiteManifest.payload.runnerProfileDigest,
    );
    await expect(validateProviderTargetDiscoveryPointClosureV1(input)).resolves.toMatchObject({
      authority: "none_target_discovery_point_structure_only",
    });
  });

  it("requires complete content-bound Envelopes for all five locator builders", () => {
    expect(() => buildProviderPublicSupportTaxonomyRelativePathV1({
      locatorProfile: "distribution_provider_public_support_taxonomy_v1",
      taxonomyGeneration: 1,
    })).toThrow();
    expect(() => buildProviderReleaseMatrixRelativePathV1({
      locatorProfile: "distribution_provider_release_matrix_v1",
      releaseMatrixGeneration: 1,
    })).toThrow();
    expect(() => buildProviderTargetDiscoveryFixtureManifestRelativePathV1({
      contentDigest: golden.targetDiscoveryFixtureManifest.contentDigest,
    })).toThrow();
    expect(() => buildProviderTargetDiscoveryRunnerRunRelativePathV1({
      runManifestContentDigest: golden.targetDiscoveryRunnerRun.contentDigest,
    })).toThrow();
    expect(() => buildProviderTargetDiscoveryResultRelativePathV1({
      locatorProfile: "distribution_provider_target_discovery_result_v1",
      discoveryGeneration: 1,
    })).toThrow();

    const semanticSubstitution = clone(golden.targetDiscoveryFixtureManifest);
    semanticSubstitution.contentDigest = semanticSubstitution.fixtureManifestDigest;
    expect(() => buildProviderTargetDiscoveryFixtureManifestRelativePathV1(semanticSubstitution)).toThrow();

    const outerSemanticMismatch = clone(golden.targetDiscoveryFixtureManifest);
    outerSemanticMismatch.fixtureManifestDigest = `sha256:${"f".repeat(64)}` as typeof outerSemanticMismatch.fixtureManifestDigest;
    expect(() => buildProviderTargetDiscoveryFixtureManifestRelativePathV1(outerSemanticMismatch)).toThrow();
  });

  it("rejects top-level and nested Proxy values", async () => {
    await expectInputDiagnostic(new Proxy(request(), {}));
    const nested = request();
    nested.targetDiscoveryResult.payload = new Proxy(
      nested.targetDiscoveryResult.payload,
      {},
    );
    await expectInputDiagnostic(nested);
  });

  it("rejects getters without executing them", async () => {
    let getterCalls = 0;
    const topLevel = request() as ValidateProviderTargetDiscoveryPointClosureV1Input & {
      unexpected?: boolean;
    };
    Object.defineProperty(topLevel, "unexpected", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return true;
      },
    });
    await expectInputDiagnostic(topLevel);
    expect(getterCalls).toBe(0);

    const nested = request();
    Object.defineProperty(nested.targetDiscoveryResult.payload, "unexpected", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return true;
      },
    });
    await expectInputDiagnostic(nested);
    expect(getterCalls).toBe(0);
  });

  it("rejects hidden fields, symbols, sparse arrays, cycles and aliases", async () => {
    const hidden = request();
    Object.defineProperty(hidden.targetDiscoveryResult.payload, "hidden", {
      enumerable: false,
      value: true,
    });
    await expectInputDiagnostic(hidden);

    const symbol = request();
    Object.defineProperty(symbol.targetDiscoveryResult.payload, Symbol("hostile"), {
      enumerable: true,
      value: true,
    });
    await expectInputDiagnostic(symbol);

    const sparse = request();
    delete sparse.targetDiscoveryResult.payload.targets[0];
    await expectInputDiagnostic(sparse);

    const cycle = request() as ValidateProviderTargetDiscoveryPointClosureV1Input & {
      targetDiscoveryResult: ValidateProviderTargetDiscoveryPointClosureV1Input["targetDiscoveryResult"] & {
        cycle?: unknown;
      };
    };
    cycle.targetDiscoveryResult.cycle = cycle.targetDiscoveryResult;
    await expectInputDiagnostic(cycle);

    const alias = request();
    alias.targetDiscoveryResult.payload.targets[1] =
      alias.targetDiscoveryResult.payload.targets[0]!;
    await expectInputDiagnostic(alias);
  });

  it("uses an immutable snapshot across asynchronous signature verification", async () => {
    const input = request();
    let reachedResolve!: () => void;
    const reached = new Promise<void>((resolve) => {
      reachedResolve = resolve;
    });
    verificationReached = reachedResolve;
    blockNextVerification = true;
    const pending = validateProviderTargetDiscoveryPointClosureV1(input);
    await reached;
    input.targetDiscoveryResult.payload.targets[0]!.target.osBuildDigest =
      `sha256:${"f".repeat(64)}` as typeof input.targetDiscoveryResult.payload.targets[number]["target"]["osBuildDigest"];
    releaseVerification?.();
    await expect(pending).resolves.toMatchObject({
      authority: "none_target_discovery_point_structure_only",
      targetCount: 2,
    });
    verificationReached = undefined;
    releaseVerification = undefined;
  });

  it("maps every public validation failure to one opaque provider error", async () => {
    const input = request();
    input.targetDiscoveryResult.payload.discoverySignature =
      input.targetDiscoveryResult.payload.discoverySignature.replace(/.$/u, "0") as typeof input.targetDiscoveryResult.payload.discoverySignature;
    await expect(validateProviderTargetDiscoveryPointClosureV1(input)).rejects.toMatchObject({
      name: "ProviderTargetDiscoveryPointClosureValidationError",
      code: "provider_unavailable",
      reason: "attestation_invalid",
      message: "Provider target discovery point closure validation failed",
    });
    await expect(validateProviderTargetDiscoveryPointClosureV1(input)).rejects.toBeInstanceOf(
      ProviderTargetDiscoveryPointClosureValidationError,
    );
  });
});
