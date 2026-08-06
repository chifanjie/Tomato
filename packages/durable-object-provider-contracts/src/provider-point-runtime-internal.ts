type ProviderPointPromiseExecutorV1<T> = (
  resolve: (value: T | PromiseLike<T>) => void,
  reject: (reason?: unknown) => void,
) => void;

const CapturedObjectCreateV1 = Object.create;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectPrototypeHasOwnPropertyV1 =
  Object.prototype.hasOwnProperty;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const CapturedReflectSetV1 = Reflect.set;
const CapturedPromiseV1 = Promise;
const CapturedPromiseResolveV1 = CapturedPromiseV1.resolve.bind(
  CapturedPromiseV1,
) as <T>(value: T | PromiseLike<T>) => Promise<Awaited<T>>;
const CapturedPromiseRejectV1 = CapturedPromiseV1.reject.bind(
  CapturedPromiseV1,
) as <T = never>(reason?: unknown) => Promise<T>;
const CapturedPromiseThenV1 = CapturedPromiseV1.prototype.then;
const CapturedPromiseCatchV1 = CapturedPromiseV1.prototype.catch;
const CapturedPromiseFinallyV1 = CapturedPromiseV1.prototype.finally;
const CapturedPromiseSpeciesV1 = Symbol.species;
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetHasV1 = CapturedWeakSetV1.prototype.has;
const CapturedWeakSetAddV1 = CapturedWeakSetV1.prototype.add;

const hardenedProviderPointPromisesV1 = new CapturedWeakSetV1<object>();

function bindUncurriedAtBootstrapV1(method: Function): Function {
  const argumentsList = CapturedObjectFreezeV1([method]);
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      argumentsList,
    ) as Function,
  );
}

const hasOwnV1 = bindUncurriedAtBootstrapV1(
  CapturedObjectPrototypeHasOwnPropertyV1,
) as (value: object, key: PropertyKey) => boolean;
const weakSetHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetHasV1,
) as (set: WeakSet<object>, value: object) => boolean;
const weakSetAddV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetAddV1,
) as (set: WeakSet<object>, value: object) => void;
const invokeCapturedPromiseThenV1 = bindUncurriedAtBootstrapV1(
  CapturedPromiseThenV1,
) as (
  receiver: Promise<unknown>,
  onFulfilled?: ((value: unknown) => unknown) | null,
  onRejected?: ((reason: unknown) => unknown) | null,
) => Promise<unknown>;
const invokeCapturedPromiseCatchV1 = bindUncurriedAtBootstrapV1(
  CapturedPromiseCatchV1,
) as (
  receiver: Promise<unknown>,
  onRejected?: ((reason: unknown) => unknown) | null,
) => Promise<unknown>;
const invokeCapturedPromiseFinallyV1 = bindUncurriedAtBootstrapV1(
  CapturedPromiseFinallyV1,
) as (
  receiver: Promise<unknown>,
  onFinally?: (() => void) | null,
) => Promise<unknown>;

function createDataPropertyDescriptorV1(
  value: unknown,
  enumerable: boolean,
  writable: boolean,
  configurable: boolean,
): PropertyDescriptor {
  const descriptor = CapturedObjectCreateV1(null) as Record<
    string,
    unknown
  >;
  if (
    !CapturedReflectSetV1(descriptor, "value", value, descriptor) ||
    !CapturedReflectSetV1(
      descriptor,
      "enumerable",
      enumerable,
      descriptor,
    ) ||
    !CapturedReflectSetV1(
      descriptor,
      "configurable",
      configurable,
      descriptor,
    ) ||
    !CapturedReflectSetV1(
      descriptor,
      "writable",
      writable,
      descriptor,
    )
  ) {
    throw new CapturedTypeErrorV1(
      "failed to create provider point data descriptor",
    );
  }
  return descriptor;
}

function defineFrozenOwnDataPropertyV1(
  target: object,
  key: PropertyKey,
  value: unknown,
  enumerable: boolean,
): void {
  CapturedObjectDefinePropertyV1(
    target,
    key,
    createDataPropertyDescriptorV1(value, enumerable, false, false),
  );
}

/**
 * Builds the exact top-level DTO shell used as a fulfilled async value. The
 * caller-provided fields object is only a synchronous construction source; it
 * is never exposed as the returned value.
 */
export function createProviderNonThenableFrozenRecordV1<T extends object>(
  fields: T,
): Readonly<T> {
  const result = CapturedObjectCreateV1(null) as Record<
    PropertyKey,
    unknown
  >;
  const keys = CapturedReflectOwnKeysV1(fields);
  const keyCount = keys.length;
  for (let index = 0; index < keyCount; index += 1) {
    const key = keys[index];
    if (typeof key !== "string" || key === "then") {
      throw new CapturedTypeErrorV1(
        "provider point fulfilled records require non-then string keys",
      );
    }
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(fields, key);
    if (
      descriptor === undefined ||
      !hasOwnV1(descriptor, "value") ||
      descriptor.enumerable !== true
    ) {
      throw new CapturedTypeErrorV1(
        "provider point fulfilled records require enumerable data fields",
      );
    }
    defineFrozenOwnDataPropertyV1(result, key, descriptor.value, true);
  }
  return CapturedObjectFreezeV1(result) as Readonly<T>;
}

function hardenedProviderPointThenV1(
  this: Promise<unknown>,
  onFulfilled?: ((value: unknown) => unknown) | null,
  onRejected?: ((reason: unknown) => unknown) | null,
): Promise<unknown> {
  const derived = invokeCapturedPromiseThenV1(
    this,
    onFulfilled,
    onRejected,
  );
  return hardenProviderPointPromiseV1(derived);
}

function hardenedProviderPointCatchV1(
  this: Promise<unknown>,
  onRejected?: ((reason: unknown) => unknown) | null,
): Promise<unknown> {
  const derived = invokeCapturedPromiseCatchV1(
    this,
    onRejected,
  );
  return hardenProviderPointPromiseV1(derived);
}

function hardenedProviderPointFinallyV1(
  this: Promise<unknown>,
  onFinally?: (() => void) | null,
): Promise<unknown> {
  const derived = invokeCapturedPromiseFinallyV1(
    this,
    onFinally,
  );
  return hardenProviderPointPromiseV1(derived);
}

function HardenedProviderPointPromiseConstructorV1(
  executor: ProviderPointPromiseExecutorV1<unknown>,
): Promise<unknown> {
  if (new.target === undefined) {
    throw new CapturedTypeErrorV1(
      "HardenedProviderPointPromiseConstructorV1 requires construction",
    );
  }
  return hardenProviderPointPromiseV1(
    new CapturedPromiseV1<unknown>(executor),
  );
}

defineFrozenOwnDataPropertyV1(
  HardenedProviderPointPromiseConstructorV1,
  CapturedPromiseSpeciesV1,
  HardenedProviderPointPromiseConstructorV1,
  false,
);
CapturedObjectFreezeV1(HardenedProviderPointPromiseConstructorV1.prototype);
CapturedObjectFreezeV1(HardenedProviderPointPromiseConstructorV1);
CapturedObjectFreezeV1(hardenedProviderPointThenV1);
CapturedObjectFreezeV1(hardenedProviderPointCatchV1);
CapturedObjectFreezeV1(hardenedProviderPointFinallyV1);

/** Immediately installs stable own Promise methods and a closed species. */
export function hardenProviderPointPromiseV1<T>(
  promise: Promise<T>,
): Promise<T> {
  const promiseObject = promise as object;
  if (weakSetHasV1(hardenedProviderPointPromisesV1, promiseObject)) {
    return promise;
  }
  defineFrozenOwnDataPropertyV1(
    promiseObject,
    "constructor",
    HardenedProviderPointPromiseConstructorV1,
    false,
  );
  defineFrozenOwnDataPropertyV1(
    promiseObject,
    "then",
    hardenedProviderPointThenV1,
    false,
  );
  defineFrozenOwnDataPropertyV1(
    promiseObject,
    "catch",
    hardenedProviderPointCatchV1,
    false,
  );
  defineFrozenOwnDataPropertyV1(
    promiseObject,
    "finally",
    hardenedProviderPointFinallyV1,
    false,
  );
  CapturedObjectFreezeV1(promiseObject);
  weakSetAddV1(hardenedProviderPointPromisesV1, promiseObject);
  return promise;
}

export function createProviderPointPromiseV1<T>(
  executor: ProviderPointPromiseExecutorV1<T>,
): Promise<T> {
  return hardenProviderPointPromiseV1(new CapturedPromiseV1<T>(executor));
}

export function createProviderPointFulfilledPromiseV1<T>(
  value: T | PromiseLike<T>,
): Promise<Awaited<T>> {
  return hardenProviderPointPromiseV1(CapturedPromiseResolveV1(value));
}

export function createProviderPointRejectedPromiseV1<T = never>(
  reason?: unknown,
): Promise<T> {
  return hardenProviderPointPromiseV1(CapturedPromiseRejectV1<T>(reason));
}

/** Internal test probe: hardens the async outer Promise before it escapes. */
export function createProviderPointIntrinsicAwaitProbeV1<T>(
  value: Promise<T>,
): Promise<T> {
  const outer = (async (): Promise<T> => await value)();
  return hardenProviderPointPromiseV1(outer);
}

CapturedObjectFreezeV1(createProviderNonThenableFrozenRecordV1);
CapturedObjectFreezeV1(hardenProviderPointPromiseV1);
CapturedObjectFreezeV1(createProviderPointPromiseV1);
CapturedObjectFreezeV1(createProviderPointFulfilledPromiseV1);
CapturedObjectFreezeV1(createProviderPointRejectedPromiseV1);
CapturedObjectFreezeV1(createProviderPointIntrinsicAwaitProbeV1);
