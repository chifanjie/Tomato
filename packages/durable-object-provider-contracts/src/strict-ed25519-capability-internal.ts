export type ProviderStrictEd25519CryptoResultInternalV1 =
  | boolean
  | Promise<boolean>;

export interface ProviderStrictEd25519BoundMethodsInternalV1 {
  readonly validatePrimeSubgroupPoint: (
    encodedPoint: Uint8Array,
  ) => ProviderStrictEd25519CryptoResultInternalV1;
  readonly verifyRawEd25519: (
    publicKey: Uint8Array,
    message: Uint8Array,
    signature: Uint8Array,
  ) => ProviderStrictEd25519CryptoResultInternalV1;
}

interface ProviderStrictEd25519OpaqueCapabilityStateInternalV1 {
  readonly methods: ProviderStrictEd25519BoundMethodsInternalV1;
  readonly capabilityBytes: Uint8Array;
}

const CapturedObjectCreateV1 = Object.create;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapHasV1 = CapturedWeakMapV1.prototype.has;
const CapturedWeakMapGetV1 = CapturedWeakMapV1.prototype.get;
const CapturedWeakMapSetV1 = CapturedWeakMapV1.prototype.set;

const opaqueCapabilityStatesByOwnerV1 = new CapturedWeakMapV1<
  object,
  WeakMap<object, ProviderStrictEd25519OpaqueCapabilityStateInternalV1>
>();

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

const weakMapHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapHasV1,
) as (map: WeakMap<object, unknown>, key: object) => boolean;
const weakMapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapGetV1,
) as <T>(map: WeakMap<object, T>, key: object) => T | undefined;
const weakMapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapSetV1,
) as <T>(map: WeakMap<object, T>, key: object, value: T) => void;

function isWeakMapKeyV1(value: unknown): value is object {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function")
  );
}

function getOwnerStatesV1(
  owner: object,
  create: boolean,
):
  | WeakMap<object, ProviderStrictEd25519OpaqueCapabilityStateInternalV1>
  | undefined {
  const existing = weakMapGetV1(
    opaqueCapabilityStatesByOwnerV1,
    owner,
  );
  if (existing !== undefined || !create) return existing;
  const created = new CapturedWeakMapV1<
    object,
    ProviderStrictEd25519OpaqueCapabilityStateInternalV1
  >();
  weakMapSetV1(opaqueCapabilityStatesByOwnerV1, owner, created);
  return created;
}

function createFrozenStateV1(
  methods: ProviderStrictEd25519BoundMethodsInternalV1,
  capabilityBytes: Uint8Array,
): ProviderStrictEd25519OpaqueCapabilityStateInternalV1 {
  const state = CapturedObjectCreateV1(null) as Record<string, unknown>;
  const methodsDescriptor = CapturedObjectCreateV1(
    null,
  ) as PropertyDescriptor;
  methodsDescriptor.value = methods;
  methodsDescriptor.enumerable = false;
  methodsDescriptor.writable = false;
  methodsDescriptor.configurable = false;
  CapturedObjectDefinePropertyV1(state, "methods", methodsDescriptor);

  const bytesDescriptor = CapturedObjectCreateV1(
    null,
  ) as PropertyDescriptor;
  bytesDescriptor.value =
    copyProviderStrictEd25519BytesInternalV1(capabilityBytes);
  bytesDescriptor.enumerable = false;
  bytesDescriptor.writable = false;
  bytesDescriptor.configurable = false;
  CapturedObjectDefinePropertyV1(
    state,
    "capabilityBytes",
    bytesDescriptor,
  );
  return CapturedObjectFreezeV1(
    state,
  ) as unknown as ProviderStrictEd25519OpaqueCapabilityStateInternalV1;
}

/**
 * Package-internal typed-array copy primitive. It deliberately avoids a
 * late-bound prototype method so post-import primordial replacement cannot
 * affect capability state or defensive copies.
 *
 * @internal
 */
export function copyProviderStrictEd25519BytesInternalV1(
  value: Uint8Array,
): Uint8Array {
  return new CapturedUint8ArrayV1(value);
}

/** @internal */
export function copyProviderStrictEd25519ByteRangeInternalV1(
  value: Uint8Array,
  start: number,
  end: number,
): Uint8Array {
  if (
    !CapturedNumberIsSafeIntegerV1(start) ||
    !CapturedNumberIsSafeIntegerV1(end) ||
    start < 0 ||
    end < start ||
    end > value.byteLength
  ) {
    throw new CapturedTypeErrorV1("invalid strict Ed25519 byte range");
  }
  const result = new CapturedUint8ArrayV1(end - start);
  for (let index = start; index < end; index += 1) {
    result[index - start] = value[index]!;
  }
  return result;
}

/** @internal */
export function registerProviderStrictEd25519OpaqueCapabilityStateV1(
  owner: object,
  capability: object,
  methods: ProviderStrictEd25519BoundMethodsInternalV1,
  capabilityBytes: Uint8Array,
): void {
  const ownerStates = getOwnerStatesV1(owner, true)!;
  if (weakMapHasV1(ownerStates, capability)) {
    throw new CapturedTypeErrorV1(
      "strict Ed25519 capability already registered",
    );
  }
  const state = createFrozenStateV1(methods, capabilityBytes);
  weakMapSetV1(ownerStates, capability, state);
}

/**
 * Performs only an exact WeakMap identity check. It never observes caller
 * properties, so getters and Proxy traps on forged handles remain inert.
 * The owner argument is the lexically imported
 * `ProviderStrictEd25519AttestationError` constructor for the conformance
 * module instance. The Universe point must pass that same constructor:
 * `assertProviderStrictEd25519CryptoCapabilityIdentityV1(
 *   ProviderStrictEd25519AttestationError,
 *   capability,
 * )`. Owner partitioning keeps query-reimported module instances foreign.
 *
 * @internal
 */
export function assertProviderStrictEd25519CryptoCapabilityIdentityV1(
  owner: object,
  capability: unknown,
): asserts capability is object {
  const ownerStates = getOwnerStatesV1(owner, false);
  if (
    ownerStates === undefined ||
    !isWeakMapKeyV1(capability) ||
    !weakMapHasV1(ownerStates, capability)
  ) {
    throw new CapturedTypeErrorV1(
      "invalid strict Ed25519 opaque capability identity",
    );
  }
}

/** @internal */
export function getProviderStrictEd25519OpaqueCapabilityMethodsV1(
  owner: object,
  capability: unknown,
): ProviderStrictEd25519BoundMethodsInternalV1 {
  assertProviderStrictEd25519CryptoCapabilityIdentityV1(owner, capability);
  const ownerStates = getOwnerStatesV1(owner, false)!;
  const state = weakMapGetV1(ownerStates, capability);
  if (state === undefined) {
    throw new CapturedTypeErrorV1(
      "invalid strict Ed25519 opaque capability state",
    );
  }
  return state.methods;
}

/** @internal */
export function copyProviderStrictEd25519CryptoCapabilityBytesV1(
  owner: object,
  capability: unknown,
): Uint8Array {
  assertProviderStrictEd25519CryptoCapabilityIdentityV1(owner, capability);
  const ownerStates = getOwnerStatesV1(owner, false)!;
  const state = weakMapGetV1(ownerStates, capability);
  if (state === undefined) {
    throw new CapturedTypeErrorV1(
      "invalid strict Ed25519 opaque capability state",
    );
  }
  return copyProviderStrictEd25519BytesInternalV1(state.capabilityBytes);
}
