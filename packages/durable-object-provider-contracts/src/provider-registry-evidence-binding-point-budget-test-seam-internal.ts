/**
 * Package-internal, request-identity-bound one-shot registry for C09-1L budget
 * fixtures. This module is intentionally absent from the package export map and
 * root barrel. It can select only the frozen budget recipes below; it cannot
 * alter a caller-supplied production request or choose an arbitrary limit.
 */

const CapturedObjectCreateV1 = Object.create;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakSetV1 = WeakSet;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedReflectSetV1 = Reflect.set;

function bindUncurriedV1(method: Function): Function {
  return CapturedReflectApplyV1(
    CapturedFunctionPrototypeBindV1,
    CapturedFunctionPrototypeCallV1,
    CapturedObjectFreezeV1([method]),
  ) as Function;
}

const weakMapGetV1 = bindUncurriedV1(CapturedWeakMapV1.prototype.get) as <K extends object, V>(
  receiver: WeakMap<K, V>,
  key: K,
) => V | undefined;
const weakMapSetV1 = bindUncurriedV1(CapturedWeakMapV1.prototype.set) as <K extends object, V>(
  receiver: WeakMap<K, V>,
  key: K,
  value: V,
) => WeakMap<K, V>;
const weakMapDeleteV1 = bindUncurriedV1(CapturedWeakMapV1.prototype.delete) as <K extends object>(
  receiver: WeakMap<K, unknown>,
  key: K,
) => boolean;
const weakSetHasV1 = bindUncurriedV1(CapturedWeakSetV1.prototype.has) as <T extends object>(
  receiver: WeakSet<T>,
  value: T,
) => boolean;
const weakSetAddV1 = bindUncurriedV1(CapturedWeakSetV1.prototype.add) as <T extends object>(
  receiver: WeakSet<T>,
  value: T,
) => WeakSet<T>;

function defineDataPropertyV1(
  target: object,
  key: PropertyKey,
  value: unknown,
  writable: boolean,
): void {
  const descriptor = CapturedObjectCreateV1(null) as Record<
    PropertyKey,
    unknown
  >;
  if (
    !CapturedReflectSetV1(descriptor, "value", value, descriptor) ||
    !CapturedReflectSetV1(descriptor, "enumerable", true, descriptor) ||
    !CapturedReflectSetV1(descriptor, "configurable", false, descriptor) ||
    !CapturedReflectSetV1(descriptor, "writable", writable, descriptor)
  ) {
    throw new CapturedTypeErrorV1("C09-1L seam descriptor construction failed");
  }
  CapturedObjectDefinePropertyV1(target, key, descriptor);
}

export type ProviderRegistryEvidenceBindingBudgetKindForTestV1 =
  | "history_count"
  | "value_b"
  | "key_b"
  | "history_bh"
  | "identities_c"
  | "work_w";

export type ProviderRegistryEvidenceBindingBudgetRelationForTestV1 =
  | "equal"
  | "plus_one";

export interface ProviderRegistryEvidenceBindingBudgetRecipeForTestV1 {
  readonly budget: ProviderRegistryEvidenceBindingBudgetKindForTestV1;
  readonly relation: ProviderRegistryEvidenceBindingBudgetRelationForTestV1;
}

export interface ProviderRegistryEvidenceBindingBudgetStringLedgerForTestV1 {
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly maxStringCodeUnits: number;
  readonly maxTotalStringCodeUnits: number;
  readonly nodeCount: number;
  readonly totalStringCodeUnits: number;
  readonly lastStringChargeBefore: number;
  readonly lastStringChargeUnits: number;
  readonly lastStringChargeOverflow: boolean;
}

export interface ProviderRegistryEvidenceBindingBudgetAllocationLedgerForTestV1 {
  readonly scoped: boolean;
  readonly maxObservedIdentities: number | undefined;
  readonly maxPrecloneAllocationWorkUnits: number | undefined;
  readonly observedIdentityCount: number;
  readonly precloneAllocationWorkUnitCount: number;
  readonly remainingPrecloneAllocationWorkUnits: number | undefined;
  readonly cloneAttemptCount: number;
  readonly lastDenseArrayLength: number | undefined;
  readonly lastDenseArrayMaxLength: number | undefined;
  readonly lastDenseArrayLengthOverflow: boolean | undefined;
  readonly testCapExerciseKind: "identities_c" | "work_w" | undefined;
  readonly testCapExerciseRelation:
    | ProviderRegistryEvidenceBindingBudgetRelationForTestV1
    | undefined;
  readonly testCapExerciseLimit: number | undefined;
  readonly testCapExerciseBefore: number | undefined;
  readonly testCapExerciseCharge: number | undefined;
  readonly testCapExerciseOverflow: boolean | undefined;
}

export interface ProviderRegistryEvidenceBindingBudgetReplayResultForTestV1 {
  readonly recipe: ProviderRegistryEvidenceBindingBudgetRecipeForTestV1;
  readonly stringBudgetLedger:
    | ProviderRegistryEvidenceBindingBudgetStringLedgerForTestV1
    | undefined;
  readonly allocationLedger: ProviderRegistryEvidenceBindingBudgetAllocationLedgerForTestV1;
}

interface BudgetReplayStateV1 {
  readonly request: object;
  readonly recipe: ProviderRegistryEvidenceBindingBudgetRecipeForTestV1;
  phase: "pending" | "active" | "complete" | "discarded";
  stringBudgetLedger:
    | ProviderRegistryEvidenceBindingBudgetStringLedgerForTestV1
    | undefined;
}

/** Opaque package-internal token. */
export interface ProviderRegistryEvidenceBindingBudgetReplayTokenForTestV1 {
  readonly __providerRegistryEvidenceBindingBudgetReplayTokenV1?: never;
}

const pendingByRequestV1 = new CapturedWeakMapV1<object, BudgetReplayStateV1>();
const resultByRequestV1 = new CapturedWeakMapV1<
  object,
  ProviderRegistryEvidenceBindingBudgetReplayResultForTestV1
>();
const stateByTokenV1 = new CapturedWeakMapV1<
  ProviderRegistryEvidenceBindingBudgetReplayTokenForTestV1,
  BudgetReplayStateV1
>();
const seenRequestsV1 = new CapturedWeakSetV1<object>();

function failV1(message: string): never {
  throw new CapturedTypeErrorV1(message);
}

function isBudgetKindV1(
  value: unknown,
): value is ProviderRegistryEvidenceBindingBudgetKindForTestV1 {
  return (
    value === "history_count" ||
    value === "value_b" ||
    value === "key_b" ||
    value === "history_bh" ||
    value === "identities_c" ||
    value === "work_w"
  );
}

function freezeRecipeV1(
  recipe: ProviderRegistryEvidenceBindingBudgetRecipeForTestV1,
): ProviderRegistryEvidenceBindingBudgetRecipeForTestV1 {
  if (
    recipe === null ||
    typeof recipe !== "object" ||
    !isBudgetKindV1(recipe.budget) ||
    (recipe.relation !== "equal" && recipe.relation !== "plus_one") ||
    (recipe.budget === "history_count" && recipe.relation !== "plus_one")
  ) {
    return failV1("invalid C09-1L package-internal budget replay recipe");
  }
  const frozen = CapturedObjectCreateV1(null) as {
    budget: ProviderRegistryEvidenceBindingBudgetKindForTestV1;
    relation: ProviderRegistryEvidenceBindingBudgetRelationForTestV1;
  };
  defineDataPropertyV1(frozen, "budget", recipe.budget, false);
  defineDataPropertyV1(frozen, "relation", recipe.relation, false);
  return CapturedObjectFreezeV1(frozen);
}

function stateForTokenV1(
  token: ProviderRegistryEvidenceBindingBudgetReplayTokenForTestV1,
): BudgetReplayStateV1 {
  if (token === null || typeof token !== "object") {
    return failV1("invalid C09-1L budget replay token");
  }
  const state = weakMapGetV1(stateByTokenV1, token);
  if (state === undefined) {
    return failV1("invalid C09-1L budget replay token");
  }
  return state;
}

/** Registers exactly one compact recipe against one freshly materialized request. */
export function registerProviderRegistryEvidenceBindingBudgetReplayForTestV1(
  request: object,
  recipe: ProviderRegistryEvidenceBindingBudgetRecipeForTestV1,
): void {
  if (request === null || typeof request !== "object") {
    return failV1("C09-1L budget replay requires an object request identity");
  }
  if (weakSetHasV1(seenRequestsV1, request)) {
    return failV1("C09-1L budget replay request identity was already registered");
  }
  weakSetAddV1(seenRequestsV1, request);
  const state = CapturedObjectCreateV1(null) as BudgetReplayStateV1;
  defineDataPropertyV1(state, "request", request, false);
  defineDataPropertyV1(state, "recipe", freezeRecipeV1(recipe), false);
  defineDataPropertyV1(state, "phase", "pending", true);
  defineDataPropertyV1(state, "stringBudgetLedger", undefined, true);
  weakMapSetV1(pendingByRequestV1, request, state);
}

/** Takes and deletes the request registration before the point uses the seam. */
export function takeProviderRegistryEvidenceBindingBudgetReplayForTestV1(
  request: unknown,
): ProviderRegistryEvidenceBindingBudgetReplayTokenForTestV1 | undefined {
  if (request === null || typeof request !== "object") return undefined;
  const state = weakMapGetV1(pendingByRequestV1, request);
  if (state === undefined) return undefined;
  weakMapDeleteV1(pendingByRequestV1, request);
  if (state.phase !== "pending") {
    return failV1("C09-1L budget replay registration was already consumed");
  }
  state.phase = "active";
  const token = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderRegistryEvidenceBindingBudgetReplayTokenForTestV1;
  weakMapSetV1(stateByTokenV1, token, state);
  return token;
}

export function readProviderRegistryEvidenceBindingBudgetRecipeForTestV1(
  token: ProviderRegistryEvidenceBindingBudgetReplayTokenForTestV1,
): ProviderRegistryEvidenceBindingBudgetRecipeForTestV1 {
  const state = stateForTokenV1(token);
  if (state.phase !== "active") {
    return failV1("C09-1L budget replay token is not active");
  }
  return state.recipe;
}

export function recordProviderRegistryEvidenceBindingStringBudgetForTestV1(
  token: ProviderRegistryEvidenceBindingBudgetReplayTokenForTestV1,
  ledger: ProviderRegistryEvidenceBindingBudgetStringLedgerForTestV1,
): void {
  const state = stateForTokenV1(token);
  if (state.phase !== "active" || state.stringBudgetLedger !== undefined) {
    return failV1("C09-1L string budget replay was already recorded");
  }
  state.stringBudgetLedger = ledger;
}

export function completeProviderRegistryEvidenceBindingBudgetReplayForTestV1(
  token: ProviderRegistryEvidenceBindingBudgetReplayTokenForTestV1,
  allocationLedger: ProviderRegistryEvidenceBindingBudgetAllocationLedgerForTestV1,
): void {
  const state = stateForTokenV1(token);
  if (state.phase !== "active") {
    return failV1("C09-1L budget replay token was already completed");
  }
  state.phase = "complete";
  const result = CapturedObjectCreateV1(
    null,
  ) as ProviderRegistryEvidenceBindingBudgetReplayResultForTestV1;
  defineDataPropertyV1(result, "recipe", state.recipe, false);
  defineDataPropertyV1(
    result,
    "stringBudgetLedger",
    state.stringBudgetLedger,
    false,
  );
  defineDataPropertyV1(result, "allocationLedger", allocationLedger, false);
  CapturedObjectFreezeV1(result);
  weakMapSetV1(resultByRequestV1, state.request, result);
}

/** Result retrieval is independently one-shot and deletes before returning. */
export function takeProviderRegistryEvidenceBindingBudgetReplayResultForTestV1(
  request: object,
): ProviderRegistryEvidenceBindingBudgetReplayResultForTestV1 | undefined {
  const result = weakMapGetV1(resultByRequestV1, request);
  if (result === undefined) return undefined;
  weakMapDeleteV1(resultByRequestV1, request);
  return result;
}

/** Cleans an unconsumed registration after materialization/generation failure. */
export function discardProviderRegistryEvidenceBindingBudgetReplayForTestV1(
  request: object,
): boolean {
  const state = weakMapGetV1(pendingByRequestV1, request);
  if (state === undefined) return false;
  weakMapDeleteV1(pendingByRequestV1, request);
  state.phase = "discarded";
  return true;
}

/** Read-only focused-test probe; it grants no ability to mutate a recipe. */
export function hasPendingProviderRegistryEvidenceBindingBudgetReplayForTestV1(
  request: object,
): boolean {
  return weakMapGetV1(pendingByRequestV1, request) !== undefined;
}

CapturedObjectFreezeV1(registerProviderRegistryEvidenceBindingBudgetReplayForTestV1);
CapturedObjectFreezeV1(takeProviderRegistryEvidenceBindingBudgetReplayForTestV1);
CapturedObjectFreezeV1(readProviderRegistryEvidenceBindingBudgetRecipeForTestV1);
CapturedObjectFreezeV1(recordProviderRegistryEvidenceBindingStringBudgetForTestV1);
CapturedObjectFreezeV1(completeProviderRegistryEvidenceBindingBudgetReplayForTestV1);
CapturedObjectFreezeV1(takeProviderRegistryEvidenceBindingBudgetReplayResultForTestV1);
CapturedObjectFreezeV1(discardProviderRegistryEvidenceBindingBudgetReplayForTestV1);
CapturedObjectFreezeV1(hasPendingProviderRegistryEvidenceBindingBudgetReplayForTestV1);
