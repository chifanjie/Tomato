import { describe, expect, it } from "vitest";

import * as publicPackageModuleV1 from "../src/index.js";
import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointFulfilledPromiseV1,
  createProviderPointIntrinsicAwaitProbeV1,
  createProviderPointPromiseV1,
  createProviderPointRejectedPromiseV1,
  hardenProviderPointPromiseV1,
} from "../src/provider-point-runtime-internal.js";

const NativePromiseV1 = Promise;
const PromiseSpeciesV1 = Symbol.species;

type PromiseConstructorLikeV1 = new <T>(
  executor: (
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: unknown) => void,
  ) => void,
) => Promise<T>;

function expectFrozenDataDescriptorV1(
  owner: object,
  key: PropertyKey,
  expectedValue?: unknown,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(owner, key);
  expect(descriptor).toBeDefined();
  expect(descriptor).not.toHaveProperty("get");
  expect(descriptor).not.toHaveProperty("set");
  expect(descriptor?.enumerable).toBe(false);
  expect(descriptor?.writable).toBe(false);
  expect(descriptor?.configurable).toBe(false);
  if (arguments.length >= 3) expect(descriptor?.value).toBe(expectedValue);
}

function expectHardenedPromiseV1(
  promise: Promise<unknown>,
  stableMethods?: Readonly<{
    then: unknown;
    catch: unknown;
    finally: unknown;
    constructor: unknown;
  }>,
): Readonly<{
  then: unknown;
  catch: unknown;
  finally: unknown;
  constructor: PromiseConstructorLikeV1;
}> {
  expect(promise).toBeInstanceOf(NativePromiseV1);
  expect(Object.isFrozen(promise)).toBe(true);
  const constructor = Object.getOwnPropertyDescriptor(
    promise,
    "constructor",
  )?.value as PromiseConstructorLikeV1;
  const then = Object.getOwnPropertyDescriptor(promise, "then")?.value;
  const caught = Object.getOwnPropertyDescriptor(promise, "catch")?.value;
  const finalized = Object.getOwnPropertyDescriptor(promise, "finally")?.value;
  expect(constructor).not.toBe(NativePromiseV1);
  expect(typeof constructor).toBe("function");
  expect(Object.isFrozen(constructor)).toBe(true);
  expect(Object.isFrozen(constructor.prototype)).toBe(true);
  expect(
    (constructor as unknown as Record<PropertyKey, unknown>)[
      PromiseSpeciesV1
    ],
  ).toBe(constructor);
  expectFrozenDataDescriptorV1(promise, "constructor", constructor);
  expectFrozenDataDescriptorV1(promise, "then", then);
  expectFrozenDataDescriptorV1(promise, "catch", caught);
  expectFrozenDataDescriptorV1(promise, "finally", finalized);
  expectFrozenDataDescriptorV1(
    constructor,
    PromiseSpeciesV1,
    constructor,
  );
  expect(Object.isFrozen(then)).toBe(true);
  expect(Object.isFrozen(caught)).toBe(true);
  expect(Object.isFrozen(finalized)).toBe(true);
  if (stableMethods !== undefined) {
    expect(constructor).toBe(stableMethods.constructor);
    expect(then).toBe(stableMethods.then);
    expect(caught).toBe(stableMethods.catch);
    expect(finalized).toBe(stableMethods.finally);
  }
  return { constructor, then, catch: caught, finally: finalized };
}

function restoreOwnDescriptorV1(
  owner: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor === undefined) {
    expect(Reflect.deleteProperty(owner, key)).toBe(true);
  } else {
    Object.defineProperty(owner, key, descriptor);
  }
}

describe("provider point internal hardened runtime", () => {
  it("keeps every runtime hardening helper out of the public barrel", () => {
    for (const exportName of [
      "createProviderNonThenableFrozenRecordV1",
      "createProviderPointFulfilledPromiseV1",
      "createProviderPointIntrinsicAwaitProbeV1",
      "createProviderPointPromiseV1",
      "createProviderPointRejectedPromiseV1",
      "hardenProviderPointPromiseV1",
    ]) {
      expect(Object.hasOwn(publicPackageModuleV1, exportName)).toBe(false);
    }
  });

  it("creates an exact null-prototype frozen own-data record", () => {
    const source = {
      ok: false as const,
      stage: "input" as const,
      reason: "schema_invalid" as const,
    };
    const record = createProviderNonThenableFrozenRecordV1(source);
    expect(Object.getPrototypeOf(record)).toBeNull();
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.keys(record)).toEqual(["ok", "stage", "reason"]);
    expect(record).toEqual(source);
    expect("then" in record).toBe(false);
    for (const key of Object.keys(record)) {
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      expect(descriptor).toMatchObject({
        enumerable: true,
        writable: false,
        configurable: false,
      });
      expect(descriptor).not.toHaveProperty("get");
      expect(descriptor).not.toHaveProperty("set");
    }
  });

  it("settles pending fulfill and reject paths without changing native identity", async () => {
    let fulfill!: (value: number) => void;
    const fulfilled = createProviderPointPromiseV1<number>((resolve) => {
      fulfill = resolve;
    });
    const methods = expectHardenedPromiseV1(fulfilled);
    expect(hardenProviderPointPromiseV1(fulfilled)).toBe(fulfilled);
    fulfill(41);
    await expect(fulfilled).resolves.toBe(41);

    let reject!: (reason?: unknown) => void;
    const rejected = createProviderPointPromiseV1<number>((_resolve, reject_) => {
      reject = reject_;
    });
    expectHardenedPromiseV1(rejected, methods);
    const marker = new Error("pending rejection");
    reject(marker);
    await expect(rejected).rejects.toBe(marker);
  });

  it("preserves direct then, catch and finally settlement across hardened chains", async () => {
    const fulfilled = createProviderPointFulfilledPromiseV1(4);
    const methods = expectHardenedPromiseV1(fulfilled);
    const viaThen = fulfilled.then((value) => value + 3);
    expectHardenedPromiseV1(viaThen, methods);
    await expect(viaThen).resolves.toBe(7);

    const marker = new Error("captured rejection");
    const recovered = createProviderPointRejectedPromiseV1<number>(marker).catch(
      (reason) => {
        expect(reason).toBe(marker);
        return 9;
      },
    );
    expectHardenedPromiseV1(recovered, methods);
    await expect(recovered).resolves.toBe(9);

    let finallyCalls = 0;
    const finalized = createProviderPointFulfilledPromiseV1(11).finally(() => {
      finallyCalls += 1;
    });
    expectHardenedPromiseV1(finalized, methods);
    await expect(finalized).resolves.toBe(11);
    expect(finallyCalls).toBe(1);

    const rejectedFinally = createProviderPointRejectedPromiseV1(marker).finally(
      () => {
        finallyCalls += 1;
      },
    );
    expectHardenedPromiseV1(rejectedFinally, methods);
    await expect(rejectedFinally).rejects.toBe(marker);
    expect(finallyCalls).toBe(2);
  });

  it("keeps the private species constructible and closes its returned promise", async () => {
    const promise = createProviderPointFulfilledPromiseV1(1);
    const methods = expectHardenedPromiseV1(promise);
    const constructed = new methods.constructor<number>((resolve) => {
      resolve(13);
    });
    expectHardenedPromiseV1(constructed, methods);
    await expect(constructed).resolves.toBe(13);
    expect(() => {
      (methods.constructor as unknown as (
        executor: (resolve: (value: unknown) => void) => void,
      ) => Promise<unknown>)((resolve) => resolve(undefined));
    }).toThrow(TypeError);
  });

  it("bypasses poisoned Promise inheritance and species through await and mixed chains", () => {
    const constructorDescriptor = Object.getOwnPropertyDescriptor(
      NativePromiseV1.prototype,
      "constructor",
    );
    const thenDescriptor = Object.getOwnPropertyDescriptor(
      NativePromiseV1.prototype,
      "then",
    );
    const speciesDescriptor = Object.getOwnPropertyDescriptor(
      NativePromiseV1,
      PromiseSpeciesV1,
    );
    let poisonedThenCalls = 0;
    let poisonedSpeciesCalls = 0;
    let restored = false;

    const restore = (): void => {
      if (restored) return;
      restoreOwnDescriptorV1(
        NativePromiseV1.prototype,
        "constructor",
        constructorDescriptor,
      );
      restoreOwnDescriptorV1(
        NativePromiseV1.prototype,
        "then",
        thenDescriptor,
      );
      restoreOwnDescriptorV1(
        NativePromiseV1,
        PromiseSpeciesV1,
        speciesDescriptor,
      );
      restored = true;
    };

    const kickoff = createProviderPointFulfilledPromiseV1(undefined);
    const methods = expectHardenedPromiseV1(kickoff);
    const exercise = kickoff.then(() => {
      try {
        function PoisonedPromiseConstructor(
          _executor: unknown,
        ): Readonly<{ forged: true }> {
          return Object.freeze({ forged: true as const });
        }
        Object.defineProperty(NativePromiseV1.prototype, "constructor", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: PoisonedPromiseConstructor,
        });
        Object.defineProperty(NativePromiseV1.prototype, "then", {
          configurable: true,
          enumerable: false,
          writable: true,
          value() {
            poisonedThenCalls += 1;
            return Object.freeze({ forged: true as const });
          },
        });
        Object.defineProperty(NativePromiseV1, PromiseSpeciesV1, {
          configurable: true,
          enumerable: false,
          get() {
            poisonedSpeciesCalls += 1;
            return PoisonedPromiseConstructor;
          },
        });

        const diagnostic = createProviderNonThenableFrozenRecordV1({
          ok: false as const,
          stage: "input" as const,
          reason: "schema_invalid" as const,
        });
        const promise = createProviderPointFulfilledPromiseV1(diagnostic);
        expectHardenedPromiseV1(promise, methods);
        expect(promise.constructor).toBe(methods.constructor);

        const awaited = createProviderPointIntrinsicAwaitProbeV1(promise);
        expectHardenedPromiseV1(awaited, methods);
        const directThen = awaited.then((value) => {
          expect(value).toBe(diagnostic);
          return 2;
        });
        expectHardenedPromiseV1(directThen, methods);
        const finalized = directThen.finally(() => undefined);
        expectHardenedPromiseV1(finalized, methods);
        const forcedRejection = finalized.then(() => {
          throw new Error("mixed-chain-marker");
        });
        expectHardenedPromiseV1(forcedRejection, methods);
        const recovered = forcedRejection.catch((error: unknown) => {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe("mixed-chain-marker");
          return 5;
        });
        expectHardenedPromiseV1(recovered, methods);
        const finalValue = recovered.then((value) => value + 1);
        expectHardenedPromiseV1(finalValue, methods);

        const rejectedMarker = new Error("poisoned public rejection");
        const caught = createProviderPointRejectedPromiseV1<number>(
          rejectedMarker,
        ).catch((reason) => {
          expect(reason).toBe(rejectedMarker);
          return 8;
        });
        expectHardenedPromiseV1(caught, methods);
        const caughtAndFinalized = caught.finally(() => undefined);
        expectHardenedPromiseV1(caughtAndFinalized, methods);

        const joined = finalValue.then((value) =>
          caughtAndFinalized.then((caughtValue) => {
            expect(value).toBe(6);
            expect(caughtValue).toBe(8);
            expect(poisonedThenCalls).toBe(0);
            expect(poisonedSpeciesCalls).toBe(0);
          }),
        );
        expectHardenedPromiseV1(joined, methods);
        return joined.finally(() => {
          restore();
          expect(poisonedThenCalls).toBe(0);
          expect(poisonedSpeciesCalls).toBe(0);
          expect(
            Object.getOwnPropertyDescriptor(
              NativePromiseV1.prototype,
              "constructor",
            ),
          ).toEqual(constructorDescriptor);
          expect(
            Object.getOwnPropertyDescriptor(
              NativePromiseV1.prototype,
              "then",
            ),
          ).toEqual(thenDescriptor);
          expect(
            Object.getOwnPropertyDescriptor(
              NativePromiseV1,
              PromiseSpeciesV1,
            ),
          ).toEqual(speciesDescriptor);
        });
      } catch (error) {
        restore();
        throw error;
      }
    });
    expectHardenedPromiseV1(exercise, methods);
    return exercise;
  });
});
