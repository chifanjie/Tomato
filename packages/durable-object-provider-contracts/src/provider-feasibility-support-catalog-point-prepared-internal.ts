/**
 * Package-private one-shot no-snapshot bridge for a detached distribution
 * history -> C09-1M Catalog invocation. Consumption happens before the
 * registered core runs, so success, failure, throw, and rejection all make
 * the exact input non-replayable.
 */

import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointFulfilledPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import type {
  ProviderFeasibilitySupportCatalogPointClosureDiagnosticResultV1,
  ValidateProviderFeasibilitySupportCatalogPointClosureV1Input,
} from "./provider-feasibility-support-catalog-point.js";
import {
  discardRegistryHistoryVerifiedWitnessInternalV1,
  type RegistryTrustWitnessHandleV1,
} from "./provider-registry-history-prepared-handle-internal.js";
import type {
  ProviderRegistryManifestHistoryValidationV1,
} from "./provider-registry-manifest-history.js";
import type {
  ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedObjectCreateV1 = Object.create;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapDeleteV1 = CapturedWeakMapV1.prototype.delete;
const CapturedWeakMapGetV1 = CapturedWeakMapV1.prototype.get;
const CapturedWeakMapHasV1 = CapturedWeakMapV1.prototype.has;
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

const weakSetAddV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetAddV1,
) as (set: WeakSet<object>, value: object) => void;
const weakSetHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetHasV1,
) as (set: WeakSet<object>, value: object) => boolean;
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

declare const ProviderFeasibilitySupportCatalogRegistryTrustedHandleV1Brand:
  unique symbol;
export interface ProviderFeasibilitySupportCatalogRegistryTrustedHandleV1 {
  readonly [ProviderFeasibilitySupportCatalogRegistryTrustedHandleV1Brand]: true;
}

export interface ProviderFeasibilitySupportCatalogRegistryTrustedContextInternalV1 {
  readonly registryClosure: ProviderRegistryManifestHistoryValidationV1;
  readonly registryTrustWitnessHandle: RegistryTrustWitnessHandleV1;
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
}

type PreparedCatalogCoreV1 = (
  input: ValidateProviderFeasibilitySupportCatalogPointClosureV1Input,
  trustedRegistryContext?: ProviderFeasibilitySupportCatalogRegistryTrustedContextInternalV1,
) => Promise<ProviderFeasibilitySupportCatalogPointClosureDiagnosticResultV1>;

interface TrustedRegistryEntryV1
  extends ProviderFeasibilitySupportCatalogRegistryTrustedContextInternalV1 {
  readonly input: object;
  readonly handle: ProviderFeasibilitySupportCatalogRegistryTrustedHandleV1;
}

let preparedCatalogCoreV1: PreparedCatalogCoreV1 | undefined;
const consumedPreparedCatalogInputsV1 = new CapturedWeakSetV1<object>();
const trustedRegistryEntriesByInputV1 = new CapturedWeakMapV1<
  object,
  TrustedRegistryEntryV1
>();
const trustedRegistryEntriesByHandleV1 = new CapturedWeakMapV1<
  object,
  TrustedRegistryEntryV1
>();

function failureV1(): ProviderFeasibilitySupportCatalogPointClosureDiagnosticResultV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage: "input" as const,
    reason: "schema_invalid" as const,
  });
}

function isObjectIdentityV1(value: unknown): value is object {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function")
  );
}

function discardTrustedRegistryEntryV1(
  entry: ProviderFeasibilitySupportCatalogRegistryTrustedContextInternalV1,
): void {
  try {
    discardRegistryHistoryVerifiedWitnessInternalV1(
      entry.registryClosure,
      entry.registryTrustWitnessHandle,
      entry.strictCryptoCapability,
    );
  } catch {
    // Cleanup is fail closed; the diagnostic remains the stable input failure.
  }
}

function deleteTrustedRegistryEntryIndexesV1(
  entry: TrustedRegistryEntryV1,
): void {
  if (weakMapGetV1(trustedRegistryEntriesByInputV1, entry.input) === entry) {
    weakMapDeleteV1(trustedRegistryEntriesByInputV1, entry.input);
  }
  if (
    weakMapGetV1(trustedRegistryEntriesByHandleV1, entry.handle) === entry
  ) {
    weakMapDeleteV1(trustedRegistryEntriesByHandleV1, entry.handle);
  }
}

function burnTrustedRegistryEntryV1(entry: TrustedRegistryEntryV1): void {
  deleteTrustedRegistryEntryIndexesV1(entry);
  weakSetAddV1(consumedPreparedCatalogInputsV1, entry.input);
  discardTrustedRegistryEntryV1(entry);
}

function inputOwnsExactCapabilityV1(
  input: object,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): boolean {
  const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
    input,
    "strictCryptoCapability",
  );
  return descriptor !== undefined &&
    "value" in descriptor &&
    descriptor.value === strictCryptoCapability;
}

function consumePreparedCatalogInputV1(input: unknown): input is object {
  if (
    !isObjectIdentityV1(input) ||
    !CapturedObjectIsFrozenV1(input) ||
    weakSetHasV1(consumedPreparedCatalogInputsV1, input)
  ) {
    return false;
  }
  weakSetAddV1(consumedPreparedCatalogInputsV1, input);
  return true;
}

function invokePreparedCatalogCoreV1(
  input: ValidateProviderFeasibilitySupportCatalogPointClosureV1Input,
  trustedRegistryContext?: ProviderFeasibilitySupportCatalogRegistryTrustedContextInternalV1,
): Promise<ProviderFeasibilitySupportCatalogPointClosureDiagnosticResultV1> {
  if (preparedCatalogCoreV1 === undefined) {
    if (trustedRegistryContext !== undefined) {
      discardTrustedRegistryEntryV1(trustedRegistryContext);
    }
    return createProviderPointFulfilledPromiseV1(failureV1());
  }
  let operation: Promise<ProviderFeasibilitySupportCatalogPointClosureDiagnosticResultV1>;
  try {
    operation = hardenProviderPointPromiseV1(
      preparedCatalogCoreV1(input, trustedRegistryContext),
    );
  } catch {
    if (trustedRegistryContext !== undefined) {
      discardTrustedRegistryEntryV1(trustedRegistryContext);
    }
    return createProviderPointFulfilledPromiseV1(failureV1());
  }
  return operation.then(
    (diagnostic) => {
      if (trustedRegistryContext !== undefined) {
        discardTrustedRegistryEntryV1(trustedRegistryContext);
      }
      return diagnostic;
    },
    () => {
      if (trustedRegistryContext !== undefined) {
        discardTrustedRegistryEntryV1(trustedRegistryContext);
      }
      return failureV1();
    },
  );
}

export function registerProviderFeasibilitySupportCatalogPointPreparedCoreInternalV1(
  core: PreparedCatalogCoreV1,
): void {
  if (preparedCatalogCoreV1 !== undefined) {
    throw new CapturedTypeErrorV1(
      "prepared feasibility support Catalog core is already registered",
    );
  }
  preparedCatalogCoreV1 = CapturedObjectFreezeV1(core);
}

export function registerProviderFeasibilitySupportCatalogRegistryTrustedInternalV1(
  input: object,
  registryClosure: ProviderRegistryManifestHistoryValidationV1,
  registryTrustWitnessHandle: RegistryTrustWitnessHandleV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): ProviderFeasibilitySupportCatalogRegistryTrustedHandleV1 {
  if (
    !isObjectIdentityV1(input) ||
    !CapturedObjectIsFrozenV1(input) ||
    !isObjectIdentityV1(registryClosure) ||
    !CapturedObjectIsFrozenV1(registryClosure) ||
    !isObjectIdentityV1(registryTrustWitnessHandle) ||
    !CapturedObjectIsFrozenV1(registryTrustWitnessHandle) ||
    !isObjectIdentityV1(strictCryptoCapability) ||
    !inputOwnsExactCapabilityV1(input, strictCryptoCapability) ||
    weakSetHasV1(consumedPreparedCatalogInputsV1, input) ||
    weakMapHasV1(trustedRegistryEntriesByInputV1, input)
  ) {
    throw new CapturedTypeErrorV1(
      "prepared feasibility support Catalog Registry trust is invalid",
    );
  }
  const handle = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderFeasibilitySupportCatalogRegistryTrustedHandleV1;
  const entry = createProviderNonThenableFrozenRecordV1({
    input,
    handle,
    registryClosure,
    registryTrustWitnessHandle,
    strictCryptoCapability,
  });
  weakMapSetV1(trustedRegistryEntriesByInputV1, input, entry);
  weakMapSetV1(trustedRegistryEntriesByHandleV1, handle, entry);
  return handle;
}

export function diagnoseProviderFeasibilitySupportCatalogPointRegistryTrustedPreparedInternalV1(
  input: unknown,
  handle: ProviderFeasibilitySupportCatalogRegistryTrustedHandleV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<ProviderFeasibilitySupportCatalogPointClosureDiagnosticResultV1> {
  const inputIdentity = isObjectIdentityV1(input) ? input : undefined;
  const handleIdentity = isObjectIdentityV1(handle) ? handle : undefined;
  const entryByInput = inputIdentity === undefined
    ? undefined
    : weakMapGetV1(trustedRegistryEntriesByInputV1, inputIdentity);
  const entryByHandle = handleIdentity === undefined
    ? undefined
    : weakMapGetV1(trustedRegistryEntriesByHandleV1, handleIdentity);
  const inputConsumed = consumePreparedCatalogInputV1(input);
  if (
    !inputConsumed ||
    entryByInput === undefined ||
    entryByInput !== entryByHandle ||
    entryByInput.handle !== handle ||
    entryByInput.strictCryptoCapability !== strictCryptoCapability ||
    !inputOwnsExactCapabilityV1(entryByInput.input, strictCryptoCapability)
  ) {
    if (entryByInput !== undefined) {
      burnTrustedRegistryEntryV1(entryByInput);
    }
    if (
      entryByHandle !== undefined &&
      entryByHandle !== entryByInput
    ) {
      burnTrustedRegistryEntryV1(entryByHandle);
    }
    return createProviderPointFulfilledPromiseV1(failureV1());
  }
  deleteTrustedRegistryEntryIndexesV1(entryByInput);
  return invokePreparedCatalogCoreV1(
    input as ValidateProviderFeasibilitySupportCatalogPointClosureV1Input,
    entryByInput,
  );
}

export function diagnoseProviderFeasibilitySupportCatalogPointPreparedInternalV1(
  input: unknown,
): Promise<ProviderFeasibilitySupportCatalogPointClosureDiagnosticResultV1> {
  if (!consumePreparedCatalogInputV1(input)) {
    return createProviderPointFulfilledPromiseV1(failureV1());
  }
  const unexpectedTrustedEntry = weakMapGetV1(
    trustedRegistryEntriesByInputV1,
    input,
  );
  if (unexpectedTrustedEntry !== undefined) {
    burnTrustedRegistryEntryV1(unexpectedTrustedEntry);
    return createProviderPointFulfilledPromiseV1(failureV1());
  }
  return invokePreparedCatalogCoreV1(
    input as ValidateProviderFeasibilitySupportCatalogPointClosureV1Input,
  );
}

CapturedObjectFreezeV1(
  registerProviderFeasibilitySupportCatalogPointPreparedCoreInternalV1,
);
CapturedObjectFreezeV1(
  diagnoseProviderFeasibilitySupportCatalogPointPreparedInternalV1,
);
CapturedObjectFreezeV1(
  registerProviderFeasibilitySupportCatalogRegistryTrustedInternalV1,
);
CapturedObjectFreezeV1(
  diagnoseProviderFeasibilitySupportCatalogPointRegistryTrustedPreparedInternalV1,
);
