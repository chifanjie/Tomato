/**
 * Package-private D-39 observation-capability kernel for the next WP5-1P
 * aggregate slice.
 *
 * This module is a none-authority contract/test seam. Supplying an observation
 * host here does not establish OS trust, prove that an opened root came from a
 * production adapter, or authorize provider I/O. A production authority still
 * requires an OS-isolated adapter and authenticated IPC. The opaque handle has
 * no accessors: its authority exists only in this module instance's WeakMap.
 */

import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import {
  ProviderTargetProfileIdV1Schema,
} from "./primitives.js";
import {
  captureProviderPointDetachedExactDataObjectV1,
} from "./provider-point-raw-admission-internal.js";
import {
  createProviderPointFulfilledPromiseV1,
  createProviderPointRejectedPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  PROVIDER_TARGET_PROFILE_ID_DOMAIN_V1,
  ProviderFeasibilityTargetV1Schema,
  type ProviderFeasibilityTargetV1,
} from "./provider-target-discovery-point.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedFunctionPrototypeHasInstanceV1 =
  Function.prototype[Symbol.hasInstance];
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedTextEncoderV1 = TextEncoder;
const CapturedTextEncoderPrototypeEncodeV1 = TextEncoder.prototype.encode;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedTypedArrayPrototypeV1 = CapturedObjectGetPrototypeOfV1(
  CapturedUint8ArrayV1.prototype,
);
const CapturedTypedArrayByteLengthGetterCandidateV1 =
  CapturedObjectGetOwnPropertyDescriptorV1(
    CapturedTypedArrayPrototypeV1,
    "byteLength",
  )?.get;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapDeleteV1 = CapturedWeakMapV1.prototype.delete;
const CapturedWeakMapGetV1 = CapturedWeakMapV1.prototype.get;
const CapturedWeakMapHasV1 = CapturedWeakMapV1.prototype.has;
const CapturedWeakMapSetV1 = CapturedWeakMapV1.prototype.set;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetAddV1 = CapturedWeakSetV1.prototype.add;
const CapturedWeakSetHasV1 = CapturedWeakSetV1.prototype.has;

if (CapturedTypedArrayByteLengthGetterCandidateV1 === undefined) {
  throw new CapturedTypeErrorV1(
    "Uint8Array byteLength primordial unavailable",
  );
}
const CapturedTypedArrayByteLengthGetterV1 =
  CapturedTypedArrayByteLengthGetterCandidateV1;
const CapturedUtf8EncoderV1 = CapturedObjectFreezeV1(
  new CapturedTextEncoderV1(),
);
const MINT_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "openedRootAuthority",
  "physicalTargetObservationHost",
] as const);
const OBSERVATION_HOST_KEYS_V1 = CapturedObjectFreezeV1([
  "observeOpenedRootPhysicalTargetV1",
] as const);
const OBSERVATION_RESULT_KEYS_V1 = CapturedObjectFreezeV1([
  "target",
  "rootVolumeContinuityWitness",
] as const);
const TARGET_KEYS_V1 = CapturedObjectFreezeV1([
  "targetProfileId",
  "osPlatform",
  "osReleaseFamilyCode",
  "osBuildDigest",
  "architecture",
  "filesystemProfileCode",
  "filesystemFeatureProfileDigest",
  "mountOptionProfileDigest",
] as const);

function bindUncurriedAtBootstrapV1(method: Function): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      CapturedObjectFreezeV1([method]),
    ) as Function,
  );
}

function bindMethodAtBootstrapV1(
  method: Function,
  receiver: object,
): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      method,
      CapturedObjectFreezeV1([receiver]),
    ) as Function,
  );
}

const functionHasInstanceV1 = bindUncurriedAtBootstrapV1(
  CapturedFunctionPrototypeHasInstanceV1,
) as (constructor: Function, value: unknown) => boolean;
const typedArrayByteLengthV1 = bindUncurriedAtBootstrapV1(
  CapturedTypedArrayByteLengthGetterV1,
) as (value: Uint8Array) => number;
const weakMapDeleteV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapDeleteV1,
) as <K extends object>(map: WeakMap<K, unknown>, key: K) => boolean;
const weakMapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapGetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K) => V | undefined;
const weakMapHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapHasV1,
) as <K extends object>(map: WeakMap<K, unknown>, key: K) => boolean;
const weakMapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapSetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K, value: V) => void;
const weakSetAddV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetAddV1,
) as <T extends object>(set: WeakSet<T>, value: T) => void;
const weakSetHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetHasV1,
) as <T extends object>(set: WeakSet<T>, value: T) => boolean;
const parseProviderFeasibilityTargetV1 = bindMethodAtBootstrapV1(
  ProviderFeasibilityTargetV1Schema.parse,
  ProviderFeasibilityTargetV1Schema,
) as (value: unknown) => ProviderFeasibilityTargetV1;
const parseProviderTargetProfileIdV1 = bindMethodAtBootstrapV1(
  ProviderTargetProfileIdV1Schema.parse,
  ProviderTargetProfileIdV1Schema,
) as (value: unknown) => ProviderFeasibilityTargetV1["targetProfileId"];

export const PROVIDER_ROOT_VOLUME_CONTINUITY_WITNESS_MIN_BYTES_INTERNAL_V1 =
  1 as const;
export const PROVIDER_ROOT_VOLUME_CONTINUITY_WITNESS_MAX_BYTES_INTERNAL_V1 =
  4096 as const;

export type ProviderTrustedLocalPhysicalTargetObservationStageInternalV1 =
  | "physical_target_observation_capability"
  | "physical_target_baseline"
  | "physical_target_precheck"
  | "physical_target_postcheck";

export type ProviderTrustedLocalPhysicalTargetObservationReasonInternalV1 =
  | "capability_invalid"
  | "observation_unavailable"
  | "observation_invalid"
  | "observation_changed"
  | "root_volume_changed";

const observationCapabilityErrorsV1 = new CapturedWeakSetV1<object>();

/** Opaque internal diagnostic; callback failures are deliberately not wrapped. */
export class ProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1 extends CapturedTypeErrorV1 {
  readonly stage: ProviderTrustedLocalPhysicalTargetObservationStageInternalV1;
  readonly reason: ProviderTrustedLocalPhysicalTargetObservationReasonInternalV1;

  constructor(
    stage: ProviderTrustedLocalPhysicalTargetObservationStageInternalV1,
    reason: ProviderTrustedLocalPhysicalTargetObservationReasonInternalV1,
  ) {
    super("trusted local physical-target observation failed");
    this.name =
      "ProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1";
    this.stage = stage;
    this.reason = reason;
    weakSetAddV1(observationCapabilityErrorsV1, this);
    CapturedObjectFreezeV1(this);
  }
}

/** Identity-safe internal error discriminator for the public diagnostic wrapper. */
export function isProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1(
  value: unknown,
): value is ProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1 {
  return (
    isObjectIdentityV1(value) &&
    weakSetHasV1(observationCapabilityErrorsV1, value)
  );
}

/**
 * An unbranded internal view of the public opaque type. The public module owns
 * the nominal brand; this module owns the only minting WeakMap.
 */
export type ProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1 =
  Readonly<Record<never, never>>;

export interface ProviderOpenedRootPhysicalTargetObservationResultInternalV1 {
  readonly target: ProviderFeasibilityTargetV1;
  readonly rootVolumeContinuityWitness: Uint8Array;
}

/** Raw host boundary result; the kernel validates the exact two-field value. */
export type ProviderOpenedRootPhysicalTargetObservationHostResultInternalV1 =
  unknown;

export interface ProviderOpenedRootPhysicalTargetObservationHostInternalV1 {
  readonly observeOpenedRootPhysicalTargetV1: (
    openedRootAuthority: object,
  ) => ProviderOpenedRootPhysicalTargetObservationHostResultInternalV1;
}

export interface MintProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1Input {
  readonly openedRootAuthority: object;
  readonly physicalTargetObservationHost:
    ProviderOpenedRootPhysicalTargetObservationHostInternalV1;
}

interface ProviderTrustedLocalPhysicalTargetObservationInternalV1 {
  readonly target: ProviderFeasibilityTargetV1;
  readonly rootVolumeContinuityWitness: Uint8Array;
  readonly canonicalTarget: string;
}

/** Private callback view; every witness is a fresh defensive copy. */
export interface ProviderTrustedLocalPhysicalTargetObservationPairInternalV1 {
  readonly baseline: ProviderOpenedRootPhysicalTargetObservationResultInternalV1;
  readonly pre: ProviderOpenedRootPhysicalTargetObservationResultInternalV1;
}

export interface ProviderTrustedLocalPhysicalTargetObservationConsumptionInternalV1<
  TResult,
> {
  /** Detached baseline target, released only after a matching postcheck. */
  readonly observedTarget: ProviderFeasibilityTargetV1;
  readonly result: TResult;
}

export type ConsumeProviderTrustedLocalPhysicalTargetObservationCallbackInternalV1<
  TResult,
> = (
  observations: ProviderTrustedLocalPhysicalTargetObservationPairInternalV1,
) => TResult | PromiseLike<TResult>;

type ObserveOpenedRootPhysicalTargetMethodInternalV1 = (
  openedRootAuthority: object,
) => ProviderOpenedRootPhysicalTargetObservationHostResultInternalV1;

interface ProviderTrustedLocalPhysicalTargetObserverBindingInternalV1 {
  readonly openedRootAuthority: object;
  readonly physicalTargetObservationHost: object;
  readonly observeOpenedRootPhysicalTargetV1:
    ObserveOpenedRootPhysicalTargetMethodInternalV1;
}

interface ProviderTrustedLocalPhysicalTargetCapabilityStateInternalV1
  extends ProviderTrustedLocalPhysicalTargetObserverBindingInternalV1 {
  readonly baseline: ProviderTrustedLocalPhysicalTargetObservationInternalV1;
}

/**
 * This single per-module-instance map is the owner partition. A shell minted
 * by another evaluated module instance, a clone, or a lookalike has no state.
 */
const capabilityStatesByHandleV1 = new CapturedWeakMapV1<
  object,
  ProviderTrustedLocalPhysicalTargetCapabilityStateInternalV1
>();

function isObjectIdentityV1(value: unknown): value is object {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function")
  );
}

function failV1(
  stage: ProviderTrustedLocalPhysicalTargetObservationStageInternalV1,
  reason: ProviderTrustedLocalPhysicalTargetObservationReasonInternalV1,
): never {
  throw new ProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1(
    stage,
    reason,
  );
}

function defineFrozenEnumerableDataV1(
  target: object,
  key: string,
  value: unknown,
): void {
  const descriptor = CapturedObjectCreateV1(null) as Record<string, unknown>;
  descriptor.value = value;
  descriptor.enumerable = true;
  descriptor.configurable = false;
  descriptor.writable = false;
  CapturedObjectDefinePropertyV1(target, key, descriptor);
}

function createFrozenRecordV1<T extends object>(
  entries: readonly (readonly [string, unknown])[],
): T {
  const record = CapturedObjectCreateV1(null) as object;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    defineFrozenEnumerableDataV1(record, entry[0], entry[1]);
  }
  return CapturedObjectFreezeV1(record) as T;
}

function textEncoderEncodeV1(value: string): Uint8Array {
  return CapturedReflectApplyV1(
    CapturedTextEncoderPrototypeEncodeV1,
    CapturedUtf8EncoderV1,
    [value],
  ) as Uint8Array;
}

function bytesToLowerHexV1(bytes: Uint8Array): string {
  const alphabet = "0123456789abcdef";
  let output = "";
  const byteLength = typedArrayByteLengthV1(bytes);
  for (let index = 0; index < byteLength; index += 1) {
    const byte = bytes[index]!;
    output += alphabet[(byte >>> 4) & 0x0f]!;
    output += alphabet[byte & 0x0f]!;
  }
  return output;
}

function deriveTargetProfileIdFromDetachedFieldsV1(
  fields: Readonly<Record<string, unknown>>,
): ProviderFeasibilityTargetV1["targetProfileId"] {
  const canonicalPreimage = canonicalizeJcsSafeIntegerV1([
    PROVIDER_TARGET_PROFILE_ID_DOMAIN_V1,
    fields,
  ]);
  const digest = sha256InternalV1(textEncoderEncodeV1(canonicalPreimage));
  return parseProviderTargetProfileIdV1(
    `provider-target-profile:${bytesToLowerHexV1(digest)}`,
  );
}

function detachAndValidateTargetV1(
  value: unknown,
): Readonly<{
  target: ProviderFeasibilityTargetV1;
  canonicalTarget: string;
}> {
  const fields = captureProviderPointDetachedExactDataObjectV1(
    value,
    TARGET_KEYS_V1,
  );
  const parsed = parseProviderFeasibilityTargetV1(fields);
  const targetFields = createFrozenRecordV1<Readonly<Record<string, unknown>>>([
    ["osPlatform", parsed.osPlatform],
    ["osReleaseFamilyCode", parsed.osReleaseFamilyCode],
    ["osBuildDigest", parsed.osBuildDigest],
    ["architecture", parsed.architecture],
    ["filesystemProfileCode", parsed.filesystemProfileCode],
    [
      "filesystemFeatureProfileDigest",
      parsed.filesystemFeatureProfileDigest,
    ],
    ["mountOptionProfileDigest", parsed.mountOptionProfileDigest],
  ]);
  if (
    parsed.targetProfileId !==
    deriveTargetProfileIdFromDetachedFieldsV1(targetFields)
  ) {
    throw new CapturedTypeErrorV1("physical target profile ID mismatch");
  }
  const target = createFrozenRecordV1<ProviderFeasibilityTargetV1>([
    ["targetProfileId", parsed.targetProfileId],
    ["osPlatform", parsed.osPlatform],
    ["osReleaseFamilyCode", parsed.osReleaseFamilyCode],
    ["osBuildDigest", parsed.osBuildDigest],
    ["architecture", parsed.architecture],
    ["filesystemProfileCode", parsed.filesystemProfileCode],
    [
      "filesystemFeatureProfileDigest",
      parsed.filesystemFeatureProfileDigest,
    ],
    ["mountOptionProfileDigest", parsed.mountOptionProfileDigest],
  ]);
  return createFrozenRecordV1<Readonly<{
    target: ProviderFeasibilityTargetV1;
    canonicalTarget: string;
  }>>([
    ["target", target],
    ["canonicalTarget", canonicalizeJcsSafeIntegerV1(target)],
  ]);
}

function copyWitnessV1(value: Uint8Array): Uint8Array {
  return new CapturedUint8ArrayV1(value);
}

function validateObservationV1(
  value: unknown,
  stage: ProviderTrustedLocalPhysicalTargetObservationStageInternalV1,
): ProviderTrustedLocalPhysicalTargetObservationInternalV1 {
  try {
    const fields = captureProviderPointDetachedExactDataObjectV1(
      value,
      OBSERVATION_RESULT_KEYS_V1,
    );
    const witness = fields.rootVolumeContinuityWitness;
    if (
      !functionHasInstanceV1(CapturedUint8ArrayV1, witness)
    ) {
      return failV1(stage, "observation_invalid");
    }
    const witnessLength = typedArrayByteLengthV1(witness as Uint8Array);
    if (
      witnessLength <
        PROVIDER_ROOT_VOLUME_CONTINUITY_WITNESS_MIN_BYTES_INTERNAL_V1 ||
      witnessLength >
        PROVIDER_ROOT_VOLUME_CONTINUITY_WITNESS_MAX_BYTES_INTERNAL_V1
    ) {
      return failV1(stage, "observation_invalid");
    }
    const detached = detachAndValidateTargetV1(fields.target);
    return createFrozenRecordV1<ProviderTrustedLocalPhysicalTargetObservationInternalV1>([
      ["target", detached.target],
      [
        "rootVolumeContinuityWitness",
        copyWitnessV1(witness as Uint8Array),
      ],
      ["canonicalTarget", detached.canonicalTarget],
    ]);
  } catch (error) {
    if (
      isProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1(
        error,
      )
    ) {
      throw error;
    }
    return failV1(stage, "observation_invalid");
  }
}

function prepareObserverBindingV1(
  input: unknown,
): ProviderTrustedLocalPhysicalTargetObserverBindingInternalV1 {
  try {
    const fields = captureProviderPointDetachedExactDataObjectV1(
      input,
      MINT_INPUT_KEYS_V1,
    );
    if (!isObjectIdentityV1(fields.openedRootAuthority)) {
      return failV1(
        "physical_target_observation_capability",
        "capability_invalid",
      );
    }
    const hostFields = captureProviderPointDetachedExactDataObjectV1(
      fields.physicalTargetObservationHost,
      OBSERVATION_HOST_KEYS_V1,
    );
    if (typeof hostFields.observeOpenedRootPhysicalTargetV1 !== "function") {
      return failV1(
        "physical_target_observation_capability",
        "capability_invalid",
      );
    }
    return createFrozenRecordV1<ProviderTrustedLocalPhysicalTargetObserverBindingInternalV1>([
      ["openedRootAuthority", fields.openedRootAuthority],
      [
        "physicalTargetObservationHost",
        fields.physicalTargetObservationHost,
      ],
      [
        "observeOpenedRootPhysicalTargetV1",
        hostFields.observeOpenedRootPhysicalTargetV1,
      ],
    ]);
  } catch (error) {
    if (
      isProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1(
        error,
      )
    ) {
      throw error;
    }
    return failV1(
      "physical_target_observation_capability",
      "capability_invalid",
    );
  }
}

function invokeObservationV1(
  binding: ProviderTrustedLocalPhysicalTargetObserverBindingInternalV1,
  stage: ProviderTrustedLocalPhysicalTargetObservationStageInternalV1,
): Promise<ProviderTrustedLocalPhysicalTargetObservationInternalV1> {
  let produced: ProviderOpenedRootPhysicalTargetObservationHostResultInternalV1;
  try {
    produced = CapturedReflectApplyV1(
      binding.observeOpenedRootPhysicalTargetV1,
      binding.physicalTargetObservationHost,
      [binding.openedRootAuthority],
    ) as ProviderOpenedRootPhysicalTargetObservationHostResultInternalV1;
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1(
        stage,
        "observation_unavailable",
      ),
    );
  }
  return createProviderPointFulfilledPromiseV1(produced).then(
    (value) => validateObservationV1(value, stage),
    () => {
      throw new ProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1(
        stage,
        "observation_unavailable",
      );
    },
  );
}

function witnessEqualV1(left: Uint8Array, right: Uint8Array): boolean {
  const leftLength = typedArrayByteLengthV1(left);
  const rightLength = typedArrayByteLengthV1(right);
  if (leftLength !== rightLength) return false;
  let difference = 0;
  for (let index = 0; index < leftLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function assertObservationContinuityV1(
  baseline: ProviderTrustedLocalPhysicalTargetObservationInternalV1,
  observation: ProviderTrustedLocalPhysicalTargetObservationInternalV1,
  stage: "physical_target_precheck" | "physical_target_postcheck",
): void {
  if (
    !witnessEqualV1(
      baseline.rootVolumeContinuityWitness,
      observation.rootVolumeContinuityWitness,
    )
  ) {
    return failV1(stage, "root_volume_changed");
  }
  if (baseline.canonicalTarget !== observation.canonicalTarget) {
    return failV1(stage, "observation_changed");
  }
}

function createCallbackObservationV1(
  observation: ProviderTrustedLocalPhysicalTargetObservationInternalV1,
): ProviderOpenedRootPhysicalTargetObservationResultInternalV1 {
  return createFrozenRecordV1<ProviderOpenedRootPhysicalTargetObservationResultInternalV1>([
    ["target", observation.target],
    [
      "rootVolumeContinuityWitness",
      copyWitnessV1(observation.rootVolumeContinuityWitness),
    ],
  ]);
}

function createCallbackObservationPairV1(
  baseline: ProviderTrustedLocalPhysicalTargetObservationInternalV1,
  pre: ProviderTrustedLocalPhysicalTargetObservationInternalV1,
): ProviderTrustedLocalPhysicalTargetObservationPairInternalV1 {
  return createFrozenRecordV1<ProviderTrustedLocalPhysicalTargetObservationPairInternalV1>([
    ["baseline", createCallbackObservationV1(baseline)],
    ["pre", createCallbackObservationV1(pre)],
  ]);
}

function createOpaqueCapabilityV1(): ProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1 {
  return CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1;
}

/**
 * Mints only after one valid baseline observation. The returned Promise is
 * hardened before it escapes; the returned shell is frozen/null-prototype and
 * has zero own keys.
 */
export function mintProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1(
  input: MintProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1Input,
): Promise<ProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1> {
  let binding: ProviderTrustedLocalPhysicalTargetObserverBindingInternalV1;
  try {
    binding = prepareObserverBindingV1(input);
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }
  return invokeObservationV1(binding, "physical_target_baseline").then(
    (baseline) => {
      const capability = createOpaqueCapabilityV1();
      const state = createFrozenRecordV1<ProviderTrustedLocalPhysicalTargetCapabilityStateInternalV1>([
        ["openedRootAuthority", binding.openedRootAuthority],
        [
          "physicalTargetObservationHost",
          binding.physicalTargetObservationHost,
        ],
        [
          "observeOpenedRootPhysicalTargetV1",
          binding.observeOpenedRootPhysicalTargetV1,
        ],
        ["baseline", baseline],
      ]);
      weakMapSetV1(capabilityStatesByHandleV1, capability, state);
      return capability;
    },
  );
}

/**
 * Atomically burns the exact handle before callback validation, pre-observation
 * or any await boundary. Concurrent/replayed consumers therefore fail closed.
 * Callback errors retain their exact identity; successful callbacks are
 * released only after a matching post-observation.
 */
export function consumeProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1<
  TResult,
>(
  capability: unknown,
  callback: ConsumeProviderTrustedLocalPhysicalTargetObservationCallbackInternalV1<TResult>,
): Promise<ProviderTrustedLocalPhysicalTargetObservationConsumptionInternalV1<TResult>> {
  if (
    !isObjectIdentityV1(capability) ||
    !weakMapHasV1(capabilityStatesByHandleV1, capability)
  ) {
    return createProviderPointRejectedPromiseV1(
      new ProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1(
        "physical_target_observation_capability",
        "capability_invalid",
      ),
    );
  }
  const state = weakMapGetV1(capabilityStatesByHandleV1, capability);
  if (
    state === undefined ||
    !weakMapDeleteV1(capabilityStatesByHandleV1, capability)
  ) {
    return createProviderPointRejectedPromiseV1(
      new ProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1(
        "physical_target_observation_capability",
        "capability_invalid",
      ),
    );
  }

  // The one-shot state is already gone before this runtime check.
  if (typeof callback !== "function") {
    return createProviderPointRejectedPromiseV1(
      new ProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1(
        "physical_target_observation_capability",
        "capability_invalid",
      ),
    );
  }

  return invokeObservationV1(state, "physical_target_precheck").then(
    (pre) => {
      assertObservationContinuityV1(
        state.baseline,
        pre,
        "physical_target_precheck",
      );
      const callbackInput = createCallbackObservationPairV1(
        state.baseline,
        pre,
      );
      let callbackResult: TResult | PromiseLike<TResult>;
      try {
        callbackResult = CapturedReflectApplyV1(
          callback,
          undefined,
          [callbackInput],
        ) as TResult | PromiseLike<TResult>;
      } catch (error) {
        throw error;
      }
      return createProviderPointFulfilledPromiseV1(callbackResult).then(
        (result) =>
          invokeObservationV1(state, "physical_target_postcheck").then(
            (post) => {
              assertObservationContinuityV1(
                state.baseline,
                post,
                "physical_target_postcheck",
              );
              return createFrozenRecordV1<ProviderTrustedLocalPhysicalTargetObservationConsumptionInternalV1<TResult>>([
                ["observedTarget", state.baseline.target],
                ["result", result],
              ]);
            },
          ),
      );
    },
  );
}

CapturedObjectFreezeV1(
  isProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1,
);
CapturedObjectFreezeV1(
  mintProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  consumeProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1,
);
