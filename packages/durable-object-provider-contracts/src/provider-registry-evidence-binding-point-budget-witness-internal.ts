/**
 * Compact runtime materializers and evidence assertions for the frozen C09-1L
 * budget recipes. This module is package-internal and deliberately absent from
 * package exports/root barrel.
 */

import {
  MAX_C09_1L_OBSERVED_IDENTITIES_V1,
  MAX_C09_1L_PRECLONE_ALLOCATION_WORK_UNITS_V1,
  MAX_C09_1L_REGISTRY_MANIFEST_HISTORY_GENERATIONS_V1,
  MAX_C09_1L_RETAINED_TRUST_HISTORY_RAW_UNITS_V1,
  MAX_C09_1L_TRUST_ENVELOPE_RAW_UNITS_V1,
} from "./provider-registry-evidence-binding-point.js";
import {
  discardProviderRegistryEvidenceBindingBudgetReplayForTestV1,
  registerProviderRegistryEvidenceBindingBudgetReplayForTestV1,
  takeProviderRegistryEvidenceBindingBudgetReplayResultForTestV1,
  type ProviderRegistryEvidenceBindingBudgetRecipeForTestV1,
  type ProviderRegistryEvidenceBindingBudgetReplayResultForTestV1,
} from "./provider-registry-evidence-binding-point-budget-test-seam-internal.js";

const CapturedArrayFromV1 = Array.from;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedStringV1 = String;
const CapturedStringPrototypeRepeatV1 = String.prototype.repeat;
const CapturedTypeErrorV1 = TypeError;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedReflectApplyV1 = Reflect.apply;

const repeatStringV1 = CapturedReflectApplyV1(
  CapturedFunctionPrototypeBindV1,
  CapturedFunctionPrototypeCallV1,
  [CapturedStringPrototypeRepeatV1],
) as (receiver: string, count: number) => string;

const HISTORY_CHUNK_COUNT_V1 = 64;
const HISTORY_CHUNK_HEADROOM_V1 = 1_024;
const HISTORY_CHUNK_CODE_UNITS_V1 =
  MAX_C09_1L_TRUST_ENVELOPE_RAW_UNITS_V1 - HISTORY_CHUNK_HEADROOM_V1;
const HISTORY_REGISTRY_INDEX_CODE_UNITS_V1 = 118;
const HISTORY_ROOT_INDEX_CODE_UNITS_V1 = 1;
const HISTORY_ENVELOPE_FIELD_NAME_CODE_UNITS_V1 = 66;
const HISTORY_FIXED_CODE_UNITS_V1 =
  HISTORY_REGISTRY_INDEX_CODE_UNITS_V1 +
  HISTORY_ROOT_INDEX_CODE_UNITS_V1 +
  HISTORY_ENVELOPE_FIELD_NAME_CODE_UNITS_V1;
const HISTORY_TAIL_CODE_UNITS_V1 =
  MAX_C09_1L_RETAINED_TRUST_HISTORY_RAW_UNITS_V1 -
  HISTORY_FIXED_CODE_UNITS_V1 -
  HISTORY_CHUNK_COUNT_V1 * HISTORY_CHUNK_CODE_UNITS_V1;

export interface ProviderRegistryEvidenceBindingBudgetPreparedWitnessInternalV1 {
  readonly request: object;
  readonly getterCalls: () => number;
}

function failV1(message: string): never {
  throw new CapturedTypeErrorV1(message);
}

function plainRecordV1(): Record<string, unknown> {
  return CapturedObjectCreateV1(CapturedObjectPrototypeV1) as Record<
    string,
    unknown
  >;
}

function defineDataV1(target: object, key: string, value: unknown): void {
  CapturedObjectDefinePropertyV1(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function defineSentinelAccessorV1(
  target: object,
  key: string,
  onGetter: () => void,
): void {
  CapturedObjectDefinePropertyV1(target, key, {
    configurable: true,
    enumerable: true,
    get() {
      onGetter();
      return true;
    },
  });
}

function decimalIndexCodeUnitsV1(length: number): number {
  let total = 0;
  for (let index = 0; index < length; index += 1) {
    total += CapturedStringV1(index).length;
  }
  return total;
}

function assertFrozenHistoryFormulaV1(): void {
  if (
    decimalIndexCodeUnitsV1(HISTORY_CHUNK_COUNT_V1) !==
      HISTORY_REGISTRY_INDEX_CODE_UNITS_V1 ||
    decimalIndexCodeUnitsV1(1) !== HISTORY_ROOT_INDEX_CODE_UNITS_V1 ||
    HISTORY_ENVELOPE_FIELD_NAME_CODE_UNITS_V1 !==
      HISTORY_CHUNK_COUNT_V1 + 2 ||
    HISTORY_FIXED_CODE_UNITS_V1 !== 185 ||
    HISTORY_TAIL_CODE_UNITS_V1 !== 65_351 ||
    HISTORY_CHUNK_CODE_UNITS_V1 + 1 >=
      MAX_C09_1L_TRUST_ENVELOPE_RAW_UNITS_V1 ||
    HISTORY_TAIL_CODE_UNITS_V1 + 2 >=
      MAX_C09_1L_TRUST_ENVELOPE_RAW_UNITS_V1 ||
    HISTORY_FIXED_CODE_UNITS_V1 +
      HISTORY_CHUNK_COUNT_V1 * HISTORY_CHUNK_CODE_UNITS_V1 +
      HISTORY_TAIL_CODE_UNITS_V1 !==
      MAX_C09_1L_RETAINED_TRUST_HISTORY_RAW_UNITS_V1
  ) {
    return failV1("C09-1L compact aggregate-history budget formula drifted");
  }
}

/** Materializes one small recipe and registers its exact request identity. */
export function materializeProviderRegistryEvidenceBindingBudgetWitnessInternalV1(
  requestInput: object,
  recipe: ProviderRegistryEvidenceBindingBudgetRecipeForTestV1,
): ProviderRegistryEvidenceBindingBudgetPreparedWitnessInternalV1 {
  if (
    requestInput === null ||
    typeof requestInput !== "object" ||
    (recipe.relation !== "equal" && recipe.relation !== "plus_one")
  ) {
    return failV1("invalid C09-1L compact budget witness input");
  }
  const request = requestInput as Record<string, unknown>;
  let getterCount = 0;
  const countGetter = (): void => {
    getterCount += 1;
  };

  if (recipe.budget === "value_b") {
    const branch = plainRecordV1();
    defineDataV1(
      branch,
      "",
      repeatStringV1(
        "v",
        MAX_C09_1L_TRUST_ENVELOPE_RAW_UNITS_V1 +
          (recipe.relation === "plus_one" ? 1 : 0),
      ),
    );
    request.bootstrapTrustBundle = branch;
    const sentinel = plainRecordV1();
    defineSentinelAccessorV1(sentinel, "sentinel", countGetter);
    request.targetDiscoveryRunnerRun = sentinel;
  } else if (recipe.budget === "key_b") {
    const branch = plainRecordV1();
    const oversizedUnknownKey = repeatStringV1(
      "k",
      MAX_C09_1L_TRUST_ENVELOPE_RAW_UNITS_V1 +
        (recipe.relation === "plus_one" ? 1 : 0),
    );
    defineDataV1(branch, oversizedUnknownKey, null);
    request.bootstrapTrustBundle = branch;
    const sentinel = plainRecordV1();
    defineSentinelAccessorV1(sentinel, "sentinel", countGetter);
    request.targetDiscoveryRunnerRun = sentinel;
  } else if (recipe.budget === "history_bh") {
    assertFrozenHistoryFormulaV1();
    const chunk = repeatStringV1("h", HISTORY_CHUNK_CODE_UNITS_V1);
    const registryHistory = CapturedArrayFromV1(
      { length: HISTORY_CHUNK_COUNT_V1 },
      () => {
        const envelope = plainRecordV1();
        defineDataV1(envelope, "v", chunk);
        return envelope;
      },
    );
    const tail = plainRecordV1();
    defineDataV1(
      tail,
      "v",
      repeatStringV1(
        "t",
        HISTORY_TAIL_CODE_UNITS_V1 +
          (recipe.relation === "plus_one" ? 1 : 0),
      ),
    );
    defineSentinelAccessorV1(tail, "s", countGetter);
    request.registryManifestHistory = registryHistory;
    request.rootMetadataHistory = [tail];
  } else if (recipe.budget === "history_count") {
    if (recipe.relation !== "plus_one") {
      return failV1("C09-1L history-count recipe must be plus_one");
    }
    request.registryManifestHistory = CapturedArrayFromV1(
      { length: MAX_C09_1L_REGISTRY_MANIFEST_HISTORY_GENERATIONS_V1 + 1 },
      () => null,
    );
  } else if (
    recipe.budget !== "identities_c" &&
    recipe.budget !== "work_w"
  ) {
    return failV1("unknown C09-1L compact budget witness kind");
  }

  registerProviderRegistryEvidenceBindingBudgetReplayForTestV1(request, recipe);
  return {
    request,
    getterCalls: () => getterCount,
  };
}

function assertAllocationClosureV1(
  result: ProviderRegistryEvidenceBindingBudgetReplayResultForTestV1,
): void {
  const ledger = result.allocationLedger;
  if (
    !ledger.scoped ||
    ledger.maxObservedIdentities !== MAX_C09_1L_OBSERVED_IDENTITIES_V1 ||
    ledger.maxPrecloneAllocationWorkUnits !==
      MAX_C09_1L_PRECLONE_ALLOCATION_WORK_UNITS_V1
  ) {
    return failV1("C09-1L budget replay lost its exact production allocation caps");
  }
}

/** Takes/deletes and validates the exact budget evidence for one execution. */
export function takeAndVerifyProviderRegistryEvidenceBindingBudgetReplayInternalV1(
  request: object,
  recipe: ProviderRegistryEvidenceBindingBudgetRecipeForTestV1,
): ProviderRegistryEvidenceBindingBudgetReplayResultForTestV1 {
  const result =
    takeProviderRegistryEvidenceBindingBudgetReplayResultForTestV1(request);
  if (
    result === undefined ||
    result.recipe.budget !== recipe.budget ||
    result.recipe.relation !== recipe.relation
  ) {
    return failV1("C09-1L budget replay result is missing or cross-wired");
  }
  assertAllocationClosureV1(result);
  const allocation = result.allocationLedger;
  const plusOne = recipe.relation === "plus_one";

  if (recipe.budget === "value_b" || recipe.budget === "key_b") {
    const budget = result.stringBudgetLedger;
    const charge =
      MAX_C09_1L_TRUST_ENVELOPE_RAW_UNITS_V1 + (plusOne ? 1 : 0);
    if (
      budget === undefined ||
      budget.maxStringCodeUnits !== MAX_C09_1L_TRUST_ENVELOPE_RAW_UNITS_V1 ||
      budget.maxTotalStringCodeUnits !==
        MAX_C09_1L_TRUST_ENVELOPE_RAW_UNITS_V1 ||
      budget.lastStringChargeBefore !== 0 ||
      budget.lastStringChargeUnits !== charge ||
      budget.lastStringChargeOverflow !== plusOne ||
      budget.totalStringCodeUnits !==
        (plusOne ? 0 : MAX_C09_1L_TRUST_ENVELOPE_RAW_UNITS_V1) ||
      allocation.cloneAttemptCount !== 0
    ) {
      return failV1(`C09-1L ${recipe.budget} replay did not prove B/B+1`);
    }
  } else if (recipe.budget === "history_bh") {
    assertFrozenHistoryFormulaV1();
    const budget = result.stringBudgetLedger;
    const before =
      HISTORY_FIXED_CODE_UNITS_V1 +
      HISTORY_CHUNK_COUNT_V1 * HISTORY_CHUNK_CODE_UNITS_V1;
    const charge = HISTORY_TAIL_CODE_UNITS_V1 + (plusOne ? 1 : 0);
    if (
      budget === undefined ||
      budget.maxStringCodeUnits !==
        MAX_C09_1L_RETAINED_TRUST_HISTORY_RAW_UNITS_V1 ||
      budget.maxTotalStringCodeUnits !==
        MAX_C09_1L_RETAINED_TRUST_HISTORY_RAW_UNITS_V1 ||
      budget.lastStringChargeBefore !== before ||
      budget.lastStringChargeUnits !== charge ||
      budget.lastStringChargeOverflow !== plusOne ||
      budget.totalStringCodeUnits !==
        (plusOne
          ? before
          : MAX_C09_1L_RETAINED_TRUST_HISTORY_RAW_UNITS_V1) ||
      allocation.cloneAttemptCount !== 0
    ) {
      return failV1("C09-1L aggregate-history replay did not prove BH/BH+1");
    }
  } else if (recipe.budget === "history_count") {
    if (
      !plusOne ||
      result.stringBudgetLedger !== undefined ||
      allocation.lastDenseArrayLength !==
        MAX_C09_1L_REGISTRY_MANIFEST_HISTORY_GENERATIONS_V1 + 1 ||
      allocation.lastDenseArrayMaxLength !==
        MAX_C09_1L_REGISTRY_MANIFEST_HISTORY_GENERATIONS_V1 ||
      allocation.lastDenseArrayLengthOverflow !== true ||
      allocation.cloneAttemptCount !== 0
    ) {
      return failV1("C09-1L history-count replay did not prove 4096/4097");
    }
  } else {
    const limit =
      recipe.budget === "identities_c"
        ? MAX_C09_1L_OBSERVED_IDENTITIES_V1
        : MAX_C09_1L_PRECLONE_ALLOCATION_WORK_UNITS_V1;
    if (
      result.stringBudgetLedger !== undefined ||
      allocation.testCapExerciseKind !== recipe.budget ||
      allocation.testCapExerciseRelation !== recipe.relation ||
      allocation.testCapExerciseLimit !== limit ||
      allocation.testCapExerciseBefore !== limit - (plusOne ? 0 : 1) ||
      allocation.testCapExerciseCharge !== 1 ||
      allocation.testCapExerciseOverflow !== plusOne ||
      allocation.cloneAttemptCount !== (plusOne ? 0 : 1) ||
      (recipe.budget === "identities_c" &&
        allocation.observedIdentityCount !== limit) ||
      (recipe.budget === "work_w" &&
        (allocation.precloneAllocationWorkUnitCount !== limit ||
          allocation.remainingPrecloneAllocationWorkUnits !== 0))
    ) {
      return failV1(`C09-1L ${recipe.budget} replay did not prove its exact cap`);
    }
  }
  return result;
}

export function discardProviderRegistryEvidenceBindingBudgetWitnessInternalV1(
  request: object,
): boolean {
  return discardProviderRegistryEvidenceBindingBudgetReplayForTestV1(request);
}

CapturedObjectFreezeV1(
  materializeProviderRegistryEvidenceBindingBudgetWitnessInternalV1,
);
CapturedObjectFreezeV1(
  takeAndVerifyProviderRegistryEvidenceBindingBudgetReplayInternalV1,
);
CapturedObjectFreezeV1(
  discardProviderRegistryEvidenceBindingBudgetWitnessInternalV1,
);
