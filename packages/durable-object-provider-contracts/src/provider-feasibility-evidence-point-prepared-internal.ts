/**
 * Package-private no-snapshot bridge for a detached C09-1M -> C09-J Evidence
 * invocation. The public Evidence module owns and registers the semantic core;
 * this bridge only hardens its asynchronous boundary and projects failures.
 */

import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointFulfilledPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import type {
  ProviderFeasibilityEvidencePointClosureDiagnosticResultV1,
  ValidateProviderFeasibilityEvidencePointClosureV1Input,
} from "./provider-feasibility-evidence-point.js";
import type { ProviderFeasibilityApproverPublicKeyV1 } from "./provider-registry-records.js";
import type { ProviderStrictEd25519OpaqueCapabilityV1 } from "./strict-ed25519-conformance.js";

const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapDeleteV1 = CapturedWeakMapV1.prototype.delete;
const CapturedWeakMapGetV1 = CapturedWeakMapV1.prototype.get;
const CapturedWeakMapSetV1 = CapturedWeakMapV1.prototype.set;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetAddV1 = CapturedWeakSetV1.prototype.add;
const CapturedWeakSetHasV1 = CapturedWeakSetV1.prototype.has;

function bindUncurriedAtBootstrapV1(method: Function): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      CapturedObjectFreezeV1([method]),
    ) as Function,
  );
}

const weakMapDeleteV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapDeleteV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K) => boolean;
const weakMapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapGetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K) => V | undefined;
const weakMapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapSetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K, value: V) => void;
const weakSetAddV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetAddV1,
) as <T extends object>(set: WeakSet<T>, value: T) => void;
const weakSetHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetHasV1,
) as <T extends object>(set: WeakSet<T>, value: T) => boolean;

declare const registryTrustedApproverHandleBrandV1: unique symbol;
export interface ProviderFeasibilityEvidenceRegistryTrustedApproverHandleV1 {
  readonly [registryTrustedApproverHandleBrandV1]:
    "ProviderFeasibilityEvidenceRegistryTrustedApproverHandleV1";
}

type PreparedEvidenceCoreV1 = (
  input: ValidateProviderFeasibilityEvidencePointClosureV1Input,
) => Promise<ProviderFeasibilityEvidencePointClosureDiagnosticResultV1>;

interface RegistryTrustedApproverStateV1 {
  readonly handle: ProviderFeasibilityEvidenceRegistryTrustedApproverHandleV1;
  readonly qaApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1;
  readonly releaseApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1;
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
}

let preparedEvidenceCoreV1: PreparedEvidenceCoreV1 | undefined;
let registryTrustedPreparedEvidenceCoreV1:
  | PreparedEvidenceCoreV1
  | undefined;
const registeredRegistryTrustedApproverInputsV1 = new CapturedWeakSetV1<object>();
const pendingRegistryTrustedApproverStatesV1 = new CapturedWeakMapV1<
  object,
  RegistryTrustedApproverStateV1
>();

function failureV1(): ProviderFeasibilityEvidencePointClosureDiagnosticResultV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage: "input" as const,
    reason: "schema_invalid" as const,
  });
}

export function registerProviderFeasibilityEvidencePointPreparedCoreInternalV1(
  core: PreparedEvidenceCoreV1,
): void {
  if (preparedEvidenceCoreV1 !== undefined) {
    throw new CapturedTypeErrorV1(
      "prepared provider feasibility Evidence core is already registered",
    );
  }
  preparedEvidenceCoreV1 = CapturedObjectFreezeV1(core);
}

export function registerProviderFeasibilityEvidencePointRegistryTrustedPreparedCoreInternalV1(
  core: PreparedEvidenceCoreV1,
): void {
  if (registryTrustedPreparedEvidenceCoreV1 !== undefined) {
    throw new CapturedTypeErrorV1(
      "Registry-trusted prepared provider feasibility Evidence core is already registered",
    );
  }
  registryTrustedPreparedEvidenceCoreV1 = CapturedObjectFreezeV1(core);
}

function readFrozenPreparedInputIdentityV1(
  input: object,
  key:
    | "qaApproverPublicKey"
    | "releaseApproverPublicKey"
    | "strictCryptoCapability",
): unknown {
  if (!CapturedObjectIsFrozenV1(input)) {
    throw new CapturedTypeErrorV1(
      "Registry-trusted prepared Evidence input must be frozen",
    );
  }
  const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(input, key);
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    descriptor.enumerable !== true
  ) {
    throw new CapturedTypeErrorV1(
      "Registry-trusted prepared Evidence identity must be enumerable own data",
    );
  }
  return descriptor.value;
}

export function registerProviderFeasibilityEvidenceRegistryTrustedApproversInternalV1(
  input: ValidateProviderFeasibilityEvidencePointClosureV1Input,
  qaApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1,
  releaseApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): ProviderFeasibilityEvidenceRegistryTrustedApproverHandleV1 {
  const inputObject = input as object;
  if (
    weakSetHasV1(registeredRegistryTrustedApproverInputsV1, inputObject) ||
    readFrozenPreparedInputIdentityV1(inputObject, "qaApproverPublicKey") !==
      qaApproverPublicKey ||
    readFrozenPreparedInputIdentityV1(
      inputObject,
      "releaseApproverPublicKey",
    ) !== releaseApproverPublicKey ||
    readFrozenPreparedInputIdentityV1(
      inputObject,
      "strictCryptoCapability",
    ) !== strictCryptoCapability
  ) {
    throw new CapturedTypeErrorV1(
      "Registry-trusted prepared Evidence identities do not match",
    );
  }

  const handle = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderFeasibilityEvidenceRegistryTrustedApproverHandleV1;
  const state = CapturedObjectFreezeV1({
    handle,
    qaApproverPublicKey,
    releaseApproverPublicKey,
    strictCryptoCapability,
  });
  weakSetAddV1(registeredRegistryTrustedApproverInputsV1, inputObject);
  weakMapSetV1(pendingRegistryTrustedApproverStatesV1, inputObject, state);
  return handle;
}

function takeRegistryTrustedApproverStateV1(
  input: object,
  handle: ProviderFeasibilityEvidenceRegistryTrustedApproverHandleV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): RegistryTrustedApproverStateV1 | undefined {
  const state = weakMapGetV1(
    pendingRegistryTrustedApproverStatesV1,
    input,
  );
  if (state === undefined) return undefined;
  try {
    if (
      state.handle !== handle ||
      state.strictCryptoCapability !== strictCryptoCapability ||
      readFrozenPreparedInputIdentityV1(input, "qaApproverPublicKey") !==
        state.qaApproverPublicKey ||
      readFrozenPreparedInputIdentityV1(
        input,
        "releaseApproverPublicKey",
      ) !== state.releaseApproverPublicKey ||
      readFrozenPreparedInputIdentityV1(
        input,
        "strictCryptoCapability",
      ) !== state.strictCryptoCapability
    ) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  if (!weakMapDeleteV1(pendingRegistryTrustedApproverStatesV1, input)) {
    return undefined;
  }
  return state;
}

export function diagnoseProviderFeasibilityEvidencePointPreparedInternalV1(
  input: unknown,
): Promise<ProviderFeasibilityEvidencePointClosureDiagnosticResultV1> {
  if (
    input === null ||
    (typeof input !== "object" && typeof input !== "function") ||
    !CapturedObjectIsFrozenV1(input) ||
    preparedEvidenceCoreV1 === undefined
  ) {
    return createProviderPointFulfilledPromiseV1(failureV1());
  }

  let operation: Promise<ProviderFeasibilityEvidencePointClosureDiagnosticResultV1>;
  try {
    operation = hardenProviderPointPromiseV1(
      preparedEvidenceCoreV1(
        input as ValidateProviderFeasibilityEvidencePointClosureV1Input,
      ),
    );
  } catch {
    return createProviderPointFulfilledPromiseV1(failureV1());
  }
  return operation.then(
    (diagnostic) => diagnostic,
    () => failureV1(),
  );
}

export function diagnoseProviderFeasibilityEvidencePointRegistryTrustedPreparedInternalV1(
  input: unknown,
  handle: ProviderFeasibilityEvidenceRegistryTrustedApproverHandleV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<ProviderFeasibilityEvidencePointClosureDiagnosticResultV1> {
  if (
    input === null ||
    (typeof input !== "object" && typeof input !== "function") ||
    takeRegistryTrustedApproverStateV1(
      input,
      handle,
      strictCryptoCapability,
    ) === undefined ||
    registryTrustedPreparedEvidenceCoreV1 === undefined
  ) {
    return createProviderPointFulfilledPromiseV1(failureV1());
  }

  let operation: Promise<ProviderFeasibilityEvidencePointClosureDiagnosticResultV1>;
  try {
    operation = hardenProviderPointPromiseV1(
      registryTrustedPreparedEvidenceCoreV1(
        input as ValidateProviderFeasibilityEvidencePointClosureV1Input,
      ),
    );
  } catch {
    return createProviderPointFulfilledPromiseV1(failureV1());
  }
  return operation.then(
    (diagnostic) => diagnostic,
    () => failureV1(),
  );
}

/**
 * Synchronously burn a Registry-trusted prepared Evidence claim that will not
 * be executed.  Callers use this on an earlier cohort failure so the retained
 * approver identities can never be replayed with a later Evidence request.
 */
export function discardProviderFeasibilityEvidenceRegistryTrustedApproversInternalV1(
  input: unknown,
  handle: ProviderFeasibilityEvidenceRegistryTrustedApproverHandleV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): boolean {
  if (
    input === null ||
    (typeof input !== "object" && typeof input !== "function")
  ) {
    return false;
  }
  return takeRegistryTrustedApproverStateV1(
    input,
    handle,
    strictCryptoCapability,
  ) !== undefined;
}

CapturedObjectFreezeV1(
  registerProviderFeasibilityEvidencePointPreparedCoreInternalV1,
);
CapturedObjectFreezeV1(
  diagnoseProviderFeasibilityEvidencePointPreparedInternalV1,
);
CapturedObjectFreezeV1(
  registerProviderFeasibilityEvidencePointRegistryTrustedPreparedCoreInternalV1,
);
CapturedObjectFreezeV1(
  registerProviderFeasibilityEvidenceRegistryTrustedApproversInternalV1,
);
CapturedObjectFreezeV1(
  diagnoseProviderFeasibilityEvidencePointRegistryTrustedPreparedInternalV1,
);
CapturedObjectFreezeV1(
  discardProviderFeasibilityEvidenceRegistryTrustedApproversInternalV1,
);
