/**
 * Package-private one-shot no-snapshot bridge for a detached C09-1M -> C09-1K
 * Universe invocation. Consumption happens before the registered core runs, so
 * success, false, throw, and rejection all make the exact input non-replayable.
 */

import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointFulfilledPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import type {
  ProviderReleaseTargetUniversePointClosureDiagnosticResultV1,
  ValidateProviderReleaseTargetUniversePointClosureV1Input,
} from "./provider-release-target-universe-point.js";

const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedTypeErrorV1 = TypeError;
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

type PreparedUniverseCoreV1 = (
  input: ValidateProviderReleaseTargetUniversePointClosureV1Input,
) => Promise<ProviderReleaseTargetUniversePointClosureDiagnosticResultV1>;

let preparedUniverseCoreV1: PreparedUniverseCoreV1 | undefined;
const consumedPreparedUniverseInputsV1 = new CapturedWeakSetV1<object>();

function failureV1(): ProviderReleaseTargetUniversePointClosureDiagnosticResultV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage: "input" as const,
    reason: "schema_invalid" as const,
  });
}

export function registerProviderReleaseTargetUniversePointPreparedCoreInternalV1(
  core: PreparedUniverseCoreV1,
): void {
  if (preparedUniverseCoreV1 !== undefined) {
    throw new CapturedTypeErrorV1(
      "prepared release target Universe core is already registered",
    );
  }
  preparedUniverseCoreV1 = CapturedObjectFreezeV1(core);
}

export function diagnoseProviderReleaseTargetUniversePointPreparedInternalV1(
  input: unknown,
): Promise<ProviderReleaseTargetUniversePointClosureDiagnosticResultV1> {
  if (
    input === null ||
    (typeof input !== "object" && typeof input !== "function") ||
    !CapturedObjectIsFrozenV1(input) ||
    weakSetHasV1(consumedPreparedUniverseInputsV1, input)
  ) {
    return createProviderPointFulfilledPromiseV1(failureV1());
  }
  weakSetAddV1(consumedPreparedUniverseInputsV1, input);

  if (preparedUniverseCoreV1 === undefined) {
    return createProviderPointFulfilledPromiseV1(failureV1());
  }
  let operation: Promise<ProviderReleaseTargetUniversePointClosureDiagnosticResultV1>;
  try {
    operation = hardenProviderPointPromiseV1(
      preparedUniverseCoreV1(
        input as ValidateProviderReleaseTargetUniversePointClosureV1Input,
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

CapturedObjectFreezeV1(
  registerProviderReleaseTargetUniversePointPreparedCoreInternalV1,
);
CapturedObjectFreezeV1(
  diagnoseProviderReleaseTargetUniversePointPreparedInternalV1,
);
