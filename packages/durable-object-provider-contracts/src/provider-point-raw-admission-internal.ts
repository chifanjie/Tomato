/**
 * Package-internal raw-object admission primitives shared by Provider points.
 *
 * This module is intentionally absent from the package export map and root
 * barrel.  It handles same-realm JavaScript objects only; a production
 * transport must still apply a byte limit and a safe JSON parser first.
 */

type StructuredCloneCandidateV1 = (value: unknown) => unknown;

const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedArrayPrototypeV1 = Array.prototype;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedObjectPrototypeHasOwnPropertyV1 =
  Object.prototype.hasOwnProperty;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const CapturedReflectSetV1 = Reflect.set;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetHasMethodV1 = CapturedWeakSetV1.prototype.has;
const CapturedWeakSetAddMethodV1 = CapturedWeakSetV1.prototype.add;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedNumberV1 = Number;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedProxyV1 = Proxy;
const CapturedStringV1 = String;
const CapturedTypeErrorV1 = TypeError;
const CapturedGlobalThisV1 = globalThis;
const CapturedDOMExceptionV1 = CapturedGlobalThisV1.DOMException;
const CapturedStructuredCloneV1: unknown =
  CapturedGlobalThisV1.structuredClone;

function bindUncurriedAtBootstrapV1(method: Function): Function {
  const argumentsList = CapturedObjectFreezeV1([method]);
  return CapturedReflectApplyV1(
    CapturedFunctionPrototypeBindV1,
    CapturedFunctionPrototypeCallV1,
    argumentsList,
  ) as Function;
}

function bindReceiverAtBootstrapV1(
  method: Function,
  receiver: unknown,
): Function {
  const argumentsList = CapturedObjectFreezeV1([receiver]);
  return CapturedReflectApplyV1(
    CapturedFunctionPrototypeBindV1,
    method,
    argumentsList,
  ) as Function;
}

const BoundCapturedStructuredCloneV1 =
  typeof CapturedStructuredCloneV1 === "function"
    ? (bindReceiverAtBootstrapV1(
        CapturedStructuredCloneV1,
        CapturedGlobalThisV1,
      ) as StructuredCloneCandidateV1)
    : undefined;

const hasOwnV1 = bindUncurriedAtBootstrapV1(
  CapturedObjectPrototypeHasOwnPropertyV1,
) as (receiver: object, key: PropertyKey) => boolean;
const weakSetHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetHasMethodV1,
) as (receiver: WeakSet<object>, value: object) => boolean;
const weakSetAddV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetAddMethodV1,
) as (receiver: WeakSet<object>, value: object) => WeakSet<object>;

const CapturedDOMExceptionNameGetterV1 = (() => {
  if (typeof CapturedDOMExceptionV1 !== "function") return undefined;
  const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
    CapturedDOMExceptionV1.prototype,
    "name",
  );
  if (descriptor === undefined || typeof descriptor.get !== "function") {
    return undefined;
  }
  return bindUncurriedAtBootstrapV1(descriptor.get) as (
    receiver: DOMException,
  ) => string;
})();

function failV1(message: string): never {
  throw new CapturedTypeErrorV1(message);
}

/**
 * Every descriptor passed to Object.defineProperty is a fresh null-prototype
 * record.  The own fields are deliberately installed in the normative order.
 */
function createDataDescriptorV1(
  value: unknown,
  enumerable: boolean,
  configurable: boolean,
  writable: boolean,
): PropertyDescriptor {
  const descriptor = CapturedObjectCreateV1(null) as Record<
    PropertyKey,
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
    return failV1("provider point scratch descriptor construction failed");
  }
  return descriptor;
}

function defineDataPropertyV1(
  target: object,
  key: PropertyKey,
  value: unknown,
  enumerable: boolean,
  configurable: boolean,
  writable: boolean,
): void {
  CapturedObjectDefinePropertyV1(
    target,
    key,
    createDataDescriptorV1(value, enumerable, configurable, writable),
  );
}

function readDescriptorRecordFieldV1(
  descriptor: PropertyDescriptor,
  key: "value" | "enumerable" | "configurable" | "writable",
): unknown {
  const metaDescriptor = CapturedObjectGetOwnPropertyDescriptorV1(
    descriptor,
    key,
  );
  if (metaDescriptor === undefined || !hasOwnV1(metaDescriptor, "value")) {
    return failV1("platform returned a malformed property descriptor");
  }
  return metaDescriptor.value;
}

function readEnumerableDataPropertyV1(
  value: object,
  key: PropertyKey,
): unknown {
  const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(value, key);
  if (
    descriptor === undefined ||
    !hasOwnV1(descriptor, "value") ||
    readDescriptorRecordFieldV1(descriptor, "enumerable") !== true
  ) {
    return failV1(
      "provider point raw properties must be enumerable own data properties",
    );
  }
  return readDescriptorRecordFieldV1(descriptor, "value");
}

function readOwnDataPropertyWithEnumerabilityV1(
  value: object,
  key: PropertyKey,
  expectedEnumerable: boolean,
): unknown {
  const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(value, key);
  if (
    descriptor === undefined ||
    !hasOwnV1(descriptor, "value") ||
    readDescriptorRecordFieldV1(descriptor, "enumerable") !==
      expectedEnumerable
  ) {
    return failV1("provider point raw property descriptor is invalid");
  }
  return readDescriptorRecordFieldV1(descriptor, "value");
}

/** Platform-created own-key arrays are never read through Array.prototype. */
function readPlatformArrayLengthV1(value: readonly unknown[]): number {
  const length = readOwnDataPropertyWithEnumerabilityV1(
    value,
    "length",
    false,
  );
  if (
    typeof length !== "number" ||
    !CapturedNumberIsSafeIntegerV1(length) ||
    length < 0
  ) {
    return failV1("platform returned an invalid own-key array length");
  }
  return length;
}

function readPlatformArrayElementV1(
  value: readonly unknown[],
  index: number,
): unknown {
  return readOwnDataPropertyWithEnumerabilityV1(
    value,
    CapturedStringV1(index),
    true,
  );
}

function isDataCloneErrorV1(error: unknown): boolean {
  if (
    typeof CapturedDOMExceptionV1 !== "function" ||
    CapturedDOMExceptionNameGetterV1 === undefined ||
    !(error instanceof CapturedDOMExceptionV1)
  ) {
    return false;
  }
  try {
    return CapturedDOMExceptionNameGetterV1(error) === "DataCloneError";
  } catch {
    return false;
  }
}

function createBootstrapProbeObjectV1(): {
  readonly root: object;
  readonly child: object;
} {
  const child = CapturedObjectCreateV1(CapturedObjectPrototypeV1) as object;
  defineDataPropertyV1(child, "marker", "before", true, true, true);
  const root = CapturedObjectCreateV1(CapturedObjectPrototypeV1) as object;
  defineDataPropertyV1(root, "child", child, true, true, true);
  return CapturedObjectFreezeV1({ root, child });
}

function probeStructuredCloneCandidateV1(candidate: unknown): boolean {
  if (typeof candidate !== "function") return false;
  const clone = candidate as StructuredCloneCandidateV1;
  try {
    const probe = createBootstrapProbeObjectV1();
    const detached = clone(probe.root);
    if (
      detached === null ||
      typeof detached !== "object" ||
      detached === probe.root ||
      CapturedArrayIsArrayV1(detached) ||
      CapturedObjectGetPrototypeOfV1(detached) !== CapturedObjectPrototypeV1
    ) {
      return false;
    }
    const detachedChild = readEnumerableDataPropertyV1(detached, "child");
    if (
      detachedChild === null ||
      typeof detachedChild !== "object" ||
      detachedChild === probe.child ||
      readEnumerableDataPropertyV1(detachedChild, "marker") !== "before"
    ) {
      return false;
    }
    if (!CapturedReflectSetV1(probe.child, "marker", "after", probe.child)) {
      return false;
    }
    if (readEnumerableDataPropertyV1(detachedChild, "marker") !== "before") {
      return false;
    }
    try {
      clone(new CapturedProxyV1(probe.root, CapturedObjectCreateV1(null)));
      return false;
    } catch (error) {
      return isDataCloneErrorV1(error);
    }
  } catch {
    return false;
  }
}

const providerPointStructuredCloneBootstrapConformantV1 =
  probeStructuredCloneCandidateV1(BoundCapturedStructuredCloneV1);
const TrustedStructuredCloneV1 = providerPointStructuredCloneBootstrapConformantV1
  ? BoundCapturedStructuredCloneV1
  : undefined;

const SessionStateKeyV1 = Symbol("provider-point-raw-admission-session-state-v1");
const ObservedTokenStateKeyV1 = Symbol(
  "provider-point-raw-admission-observed-token-state-v1",
);
const BudgetStateKeyV1 = Symbol(
  "provider-point-raw-admission-budget-state-v1",
);

interface ProviderPointRawAdmissionSessionStateV1 {
  readonly originalInput: object;
  readonly observedIdentities: Record<PropertyKey, unknown>;
  readonly seen: WeakSet<object>;
  readonly topToken: ProviderPointRawObservedObjectV1;
  identityCount: number;
  cloneAttemptCount: number;
  phase: "open" | "clone_attempted";
}

interface ProviderPointRawObservedTokenStateV1 {
  readonly session: ProviderPointRawAdmissionSessionV1;
  readonly value: object;
  inspected: boolean;
}

interface ProviderPointRawAdmissionBudgetStateV1 {
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly maxStringCodeUnits: number;
  readonly maxTotalStringCodeUnits: number;
  rootCounted: boolean;
  rootIdentity: object | undefined;
  nodeCount: number;
  totalStringCodeUnits: number;
}

/** @internal */
export interface ProviderPointRawAdmissionSessionV1 {
  readonly [SessionStateKeyV1]: ProviderPointRawAdmissionSessionStateV1;
}

/** @internal */
export interface ProviderPointRawObservedObjectV1 {
  readonly [ObservedTokenStateKeyV1]: ProviderPointRawObservedTokenStateV1;
}

/** @internal */
export interface ProviderPointRawAdmissionBudgetV1 {
  readonly [BudgetStateKeyV1]: ProviderPointRawAdmissionBudgetStateV1;
}

function readHiddenOwnStateV1<T>(
  value: object,
  key: PropertyKey,
  message: string,
): T {
  const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(value, key);
  if (
    descriptor === undefined ||
    !hasOwnV1(descriptor, "value") ||
    readDescriptorRecordFieldV1(descriptor, "enumerable") !== false
  ) {
    return failV1(message);
  }
  return readDescriptorRecordFieldV1(descriptor, "value") as T;
}

function sessionStateV1(
  session: ProviderPointRawAdmissionSessionV1,
): ProviderPointRawAdmissionSessionStateV1 {
  if (session === null || typeof session !== "object") {
    return failV1("invalid provider point raw admission session");
  }
  return readHiddenOwnStateV1<ProviderPointRawAdmissionSessionStateV1>(
    session,
    SessionStateKeyV1,
    "invalid provider point raw admission session",
  );
}

function tokenStateV1(
  token: ProviderPointRawObservedObjectV1,
): ProviderPointRawObservedTokenStateV1 {
  if (token === null || typeof token !== "object") {
    return failV1("invalid provider point observed-object token");
  }
  return readHiddenOwnStateV1<ProviderPointRawObservedTokenStateV1>(
    token,
    ObservedTokenStateKeyV1,
    "invalid provider point observed-object token",
  );
}

function budgetStateV1(
  budget: ProviderPointRawAdmissionBudgetV1,
): ProviderPointRawAdmissionBudgetStateV1 {
  if (budget === null || typeof budget !== "object") {
    return failV1("invalid provider point raw admission budget");
  }
  return readHiddenOwnStateV1<ProviderPointRawAdmissionBudgetStateV1>(
    budget,
    BudgetStateKeyV1,
    "invalid provider point raw admission budget",
  );
}

function setNullRecordOwnFieldV1(
  target: Record<PropertyKey, unknown>,
  key: PropertyKey,
  value: unknown,
): void {
  if (!CapturedReflectSetV1(target, key, value, target)) {
    return failV1("provider point scratch state update failed");
  }
}

function assertOpenSessionV1(
  state: ProviderPointRawAdmissionSessionStateV1,
): void {
  if (state.phase !== "open") {
    return failV1("provider point raw admission session is already consumed");
  }
}

function observeObjectIdentityInternalV1(
  session: ProviderPointRawAdmissionSessionV1,
  value: unknown,
): ProviderPointRawObservedObjectV1 {
  const state = sessionStateV1(session);
  assertOpenSessionV1(state);
  if (value === null || typeof value !== "object") {
    return failV1("provider point raw identity must be an object or array");
  }
  if (weakSetHasV1(state.seen, value)) {
    return failV1("provider point raw JSON identities must form one tree");
  }
  weakSetAddV1(state.seen, value);

  const identityIndex = state.identityCount;
  defineDataPropertyV1(
    state.observedIdentities,
    CapturedStringV1(identityIndex),
    value,
    true,
    false,
    false,
  );
  setNullRecordOwnFieldV1(
    state as unknown as Record<PropertyKey, unknown>,
    "identityCount",
    identityIndex + 1,
  );

  const tokenState = CapturedObjectCreateV1(null) as unknown as
    ProviderPointRawObservedTokenStateV1;
  defineDataPropertyV1(tokenState, "session", session, true, false, false);
  defineDataPropertyV1(tokenState, "value", value, true, false, false);
  defineDataPropertyV1(tokenState, "inspected", false, true, false, true);
  const token = CapturedObjectCreateV1(null) as ProviderPointRawObservedObjectV1;
  defineDataPropertyV1(
    token,
    ObservedTokenStateKeyV1,
    tokenState,
    false,
    false,
    false,
  );
  return CapturedObjectFreezeV1(token);
}

/**
 * Creates all request scratch storage and records the exact top-level identity
 * before any potentially trapping reflection is performed on caller input.
 *
 * @internal
 */
export function createProviderPointRawAdmissionSessionV1(
  originalInput: unknown,
): ProviderPointRawAdmissionSessionV1 {
  if (TrustedStructuredCloneV1 === undefined) {
    return failV1(
      "provider point requires a conformant platform structuredClone",
    );
  }
  if (originalInput === null || typeof originalInput !== "object") {
    return failV1("provider point raw input must be an object");
  }
  const observedIdentities = CapturedObjectCreateV1(null) as Record<
    PropertyKey,
    unknown
  >;
  const seen = CapturedObjectFreezeV1(new CapturedWeakSetV1<object>());
  const state = CapturedObjectCreateV1(null) as unknown as
    ProviderPointRawAdmissionSessionStateV1;
  const session = CapturedObjectCreateV1(null) as ProviderPointRawAdmissionSessionV1;

  defineDataPropertyV1(state, "originalInput", originalInput, true, false, false);
  defineDataPropertyV1(
    state,
    "observedIdentities",
    observedIdentities,
    true,
    false,
    false,
  );
  defineDataPropertyV1(state, "seen", seen, true, false, false);
  defineDataPropertyV1(state, "identityCount", 0, true, false, true);
  defineDataPropertyV1(state, "cloneAttemptCount", 0, true, false, true);
  defineDataPropertyV1(state, "phase", "open", true, false, true);
  defineDataPropertyV1(
    session,
    SessionStateKeyV1,
    state,
    false,
    false,
    false,
  );
  CapturedObjectFreezeV1(session);

  const topToken = observeObjectIdentityInternalV1(session, originalInput);
  defineDataPropertyV1(state, "topToken", topToken, true, false, false);
  return session;
}

function assertPositiveSafeBudgetLimitV1(
  value: number,
  name: string,
): void {
  if (!CapturedNumberIsSafeIntegerV1(value) || value < 1) {
    return failV1(`provider point raw ${name} must be a positive safe integer`);
  }
}

/**
 * Creates request-local bounded-preflight accounting. The mutable state is a
 * private null-prototype record; callers can only advance it through captured
 * descriptor reads in this module.
 *
 * @internal
 */
export function createProviderPointRawAdmissionBudgetV1(
  maxDepth: number,
  maxNodes: number,
  maxStringCodeUnits: number,
  maxTotalStringCodeUnits: number,
): ProviderPointRawAdmissionBudgetV1 {
  assertPositiveSafeBudgetLimitV1(maxDepth, "depth cap");
  assertPositiveSafeBudgetLimitV1(maxNodes, "node cap");
  assertPositiveSafeBudgetLimitV1(
    maxStringCodeUnits,
    "single-string code-unit cap",
  );
  assertPositiveSafeBudgetLimitV1(
    maxTotalStringCodeUnits,
    "total-string code-unit cap",
  );

  const state = CapturedObjectCreateV1(null) as unknown as
    ProviderPointRawAdmissionBudgetStateV1;
  defineDataPropertyV1(state, "maxDepth", maxDepth, true, false, false);
  defineDataPropertyV1(state, "maxNodes", maxNodes, true, false, false);
  defineDataPropertyV1(
    state,
    "maxStringCodeUnits",
    maxStringCodeUnits,
    true,
    false,
    false,
  );
  defineDataPropertyV1(
    state,
    "maxTotalStringCodeUnits",
    maxTotalStringCodeUnits,
    true,
    false,
    false,
  );
  defineDataPropertyV1(state, "nodeCount", 0, true, false, true);
  defineDataPropertyV1(state, "rootCounted", false, true, false, true);
  defineDataPropertyV1(state, "rootIdentity", undefined, true, false, true);
  defineDataPropertyV1(
    state,
    "totalStringCodeUnits",
    0,
    true,
    false,
    true,
  );

  const budget = CapturedObjectCreateV1(null) as
    ProviderPointRawAdmissionBudgetV1;
  defineDataPropertyV1(
    budget,
    BudgetStateKeyV1,
    state,
    false,
    false,
    false,
  );
  return CapturedObjectFreezeV1(budget);
}

function countProviderPointRawAdmissionValueV1(
  budget: ProviderPointRawAdmissionBudgetV1,
  value: unknown,
  depth: number,
): void {
  const state = budgetStateV1(budget);
  if (!CapturedNumberIsSafeIntegerV1(depth) || depth < 1) {
    return failV1("provider point raw node depth must be a positive safe integer");
  }
  if (depth > state.maxDepth) {
    return failV1("provider point raw tree exceeds its depth cap");
  }
  if (state.nodeCount >= state.maxNodes) {
    return failV1("provider point raw tree exceeds its node cap");
  }
  setNullRecordOwnFieldV1(
    state as unknown as Record<PropertyKey, unknown>,
    "nodeCount",
    state.nodeCount + 1,
  );

  if (typeof value !== "string") return;
  const codeUnits = value.length;
  if (codeUnits > state.maxStringCodeUnits) {
    return failV1("provider point raw string exceeds its code-unit cap");
  }
  if (
    codeUnits >
    state.maxTotalStringCodeUnits - state.totalStringCodeUnits
  ) {
    return failV1("provider point raw tree exceeds its total string cap");
  }
  setNullRecordOwnFieldV1(
    state as unknown as Record<PropertyKey, unknown>,
    "totalStringCodeUnits",
    state.totalStringCodeUnits + codeUnits,
  );
}

/** Counts the bounded-preflight root before any reflection on that root. @internal */
export function countProviderPointRawAdmissionBudgetRootV1(
  budget: ProviderPointRawAdmissionBudgetV1,
  root: unknown,
): void {
  const state = budgetStateV1(budget);
  if (state.rootCounted) {
    return failV1("provider point raw admission budget root was already counted");
  }
  if (root === null || typeof root !== "object") {
    return failV1("provider point raw admission budget root must be an object");
  }
  setNullRecordOwnFieldV1(
    state as unknown as Record<PropertyKey, unknown>,
    "rootCounted",
    true,
  );
  setNullRecordOwnFieldV1(
    state as unknown as Record<PropertyKey, unknown>,
    "rootIdentity",
    root,
  );
  countProviderPointRawAdmissionValueV1(budget, root, 1);
}

function assertProviderPointRawBudgetContainerV1(
  value: object,
  budget: ProviderPointRawAdmissionBudgetV1 | undefined,
  containerDepth: number | undefined,
): void {
  if (budget === undefined && containerDepth === undefined) return;
  if (budget === undefined || containerDepth === undefined) {
    return failV1("provider point raw budget and depth must be provided together");
  }
  if (
    !CapturedNumberIsSafeIntegerV1(containerDepth) ||
    containerDepth < 1
  ) {
    return failV1("provider point raw container depth must be positive");
  }
  const state = budgetStateV1(budget);
  if (!state.rootCounted) {
    return failV1("provider point raw admission budget root was not counted");
  }
  if (containerDepth === 1 && state.rootIdentity !== value) {
    return failV1("provider point raw admission budget root identity changed");
  }
  if (containerDepth > state.maxDepth) {
    return failV1("provider point raw tree exceeds its depth cap");
  }
}

function readBudgetedEnumerableDataPropertyV1(
  value: object,
  key: PropertyKey,
  budget: ProviderPointRawAdmissionBudgetV1 | undefined,
  containerDepth: number | undefined,
): unknown {
  const fieldValue = readEnumerableDataPropertyV1(value, key);
  if (budget === undefined && containerDepth === undefined) return fieldValue;
  if (budget === undefined || containerDepth === undefined) {
    return failV1("provider point raw budget and depth must be provided together");
  }
  countProviderPointRawAdmissionValueV1(
    budget,
    fieldValue,
    containerDepth + 1,
  );
  return fieldValue;
}

/** Records an object identity without reflecting on it. @internal */
export function observeProviderPointRawObjectIdentityV1(
  session: ProviderPointRawAdmissionSessionV1,
  value: unknown,
): ProviderPointRawObservedObjectV1 {
  return observeObjectIdentityInternalV1(session, value);
}

function trustedArrayItemV1(
  value: readonly string[],
  index: number,
): string {
  const item = readPlatformArrayElementV1(value, index);
  if (typeof item !== "string") {
    return failV1("provider point expected-key constants must contain strings");
  }
  return item;
}

function assertTrustedExpectedKeysV1(expectedKeys: readonly string[]): number {
  if (!CapturedArrayIsArrayV1(expectedKeys)) {
    return failV1("provider point expected keys must be a frozen array");
  }
  if (!CapturedObjectIsFrozenV1(expectedKeys)) {
    return failV1("provider point expected keys must be a frozen array");
  }
  const length = readPlatformArrayLengthV1(expectedKeys);
  for (let index = 0; index < length; index += 1) {
    const key = trustedArrayItemV1(expectedKeys, index);
    for (let priorIndex = 0; priorIndex < index; priorIndex += 1) {
      if (trustedArrayItemV1(expectedKeys, priorIndex) === key) {
        return failV1("provider point expected keys must be unique");
      }
    }
  }
  return length;
}

function consumeObservedTokenForInspectionV1(
  session: ProviderPointRawAdmissionSessionV1,
  token: ProviderPointRawObservedObjectV1,
): object {
  const sessionState = sessionStateV1(session);
  assertOpenSessionV1(sessionState);
  const observed = tokenStateV1(token);
  if (observed.session !== session || observed.inspected) {
    return failV1("provider point observed-object token is invalid or consumed");
  }
  setNullRecordOwnFieldV1(
    observed as unknown as Record<PropertyKey, unknown>,
    "inspected",
    true,
  );
  return observed.value;
}

function assertPlainObjectIdentityV1(value: object): void {
  if (CapturedArrayIsArrayV1(value)) {
    return failV1("provider point raw object must not be an array");
  }
  const prototype = CapturedObjectGetPrototypeOfV1(value);
  if (
    prototype !== CapturedObjectPrototypeV1 &&
    prototype !== null
  ) {
    return failV1("provider point raw objects must use a plain prototype");
  }
}

function snapshotExactDataObjectInternalV1(
  value: object,
  expectedKeys: readonly string[],
  budget?: ProviderPointRawAdmissionBudgetV1,
  containerDepth?: number,
): Readonly<Record<string, unknown>> {
  assertProviderPointRawBudgetContainerV1(value, budget, containerDepth);
  assertPlainObjectIdentityV1(value);
  const expectedLength = assertTrustedExpectedKeysV1(expectedKeys);
  const captured = CapturedObjectCreateV1(null) as Record<string, unknown>;

  // Read known descriptors first.  No getter is ever invoked.
  for (let index = 0; index < expectedLength; index += 1) {
    const key = trustedArrayItemV1(expectedKeys, index);
    const fieldValue = readBudgetedEnumerableDataPropertyV1(
      value,
      key,
      budget,
      containerDepth,
    );
    defineDataPropertyV1(captured, key, fieldValue, true, false, false);
  }

  // Then prove that no hidden, symbol, or unknown field was present.
  const ownKeys = CapturedReflectOwnKeysV1(value);
  const ownKeyCount = readPlatformArrayLengthV1(ownKeys);
  if (ownKeyCount !== expectedLength) {
    return failV1("provider point raw object has an unexpected own key set");
  }
  for (let ownIndex = 0; ownIndex < ownKeyCount; ownIndex += 1) {
    const ownKey = readPlatformArrayElementV1(ownKeys, ownIndex);
    if (typeof ownKey !== "string") {
      return failV1("provider point raw object must not contain symbol keys");
    }
    let matched = false;
    for (let expectedIndex = 0; expectedIndex < expectedLength; expectedIndex += 1) {
      if (trustedArrayItemV1(expectedKeys, expectedIndex) === ownKey) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      return failV1("provider point raw object has an unexpected own key set");
    }
  }
  return CapturedObjectFreezeV1(captured);
}

/**
 * Consumes the already-recorded top-level token and snapshots an exact own
 * enumerable data-key set without evaluating getters.
 *
 * @internal
 */
export function captureProviderPointRawExactTopLevelV1(
  session: ProviderPointRawAdmissionSessionV1,
  expectedKeys: readonly string[],
  budget?: ProviderPointRawAdmissionBudgetV1,
  containerDepth?: number,
): Readonly<Record<string, unknown>> {
  const state = sessionStateV1(session);
  const value = consumeObservedTokenForInspectionV1(
    session,
    state.topToken,
  );
  return snapshotExactDataObjectInternalV1(
    value,
    expectedKeys,
    budget,
    containerDepth,
  );
}

/**
 * Inspects an identity previously appended to the collector.  Universe
 * preflight can keep the returned token in a null-prototype work frame and
 * call this function only when the node is reached.
 *
 * @internal
 */
export function captureProviderPointRawObservedExactDataObjectV1(
  session: ProviderPointRawAdmissionSessionV1,
  token: ProviderPointRawObservedObjectV1,
  expectedKeys: readonly string[],
  budget?: ProviderPointRawAdmissionBudgetV1,
  containerDepth?: number,
): Readonly<Record<string, unknown>> {
  return snapshotExactDataObjectInternalV1(
    consumeObservedTokenForInspectionV1(session, token),
    expectedKeys,
    budget,
    containerDepth,
  );
}

/** @internal */
export interface ProviderPointRawExactObjectUnionCaptureV1 {
  readonly fields: Readonly<Record<string, unknown>>;
  readonly variantIndex: number;
}

function trustedExpectedVariantV1(
  expectedKeyVariants: readonly (readonly string[])[],
  index: number,
): readonly string[] {
  const variant = readPlatformArrayElementV1(expectedKeyVariants, index);
  if (!CapturedArrayIsArrayV1(variant) || !CapturedObjectIsFrozenV1(variant)) {
    return failV1(
      "provider point expected-key variants must contain frozen arrays",
    );
  }
  return variant as readonly string[];
}

function expectedKeysContainV1(
  expectedKeys: readonly string[],
  key: string,
): boolean {
  const length = readPlatformArrayLengthV1(expectedKeys);
  for (let index = 0; index < length; index += 1) {
    if (trustedArrayItemV1(expectedKeys, index) === key) return true;
  }
  return false;
}

function ownKeysExactlyMatchExpectedV1(
  ownKeys: readonly PropertyKey[],
  ownKeyCount: number,
  expectedKeys: readonly string[],
): boolean {
  const expectedLength = readPlatformArrayLengthV1(expectedKeys);
  if (ownKeyCount !== expectedLength) return false;
  for (let index = 0; index < ownKeyCount; index += 1) {
    const ownKey = readPlatformArrayElementV1(ownKeys, index);
    if (
      typeof ownKey !== "string" ||
      !expectedKeysContainV1(expectedKeys, ownKey)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Selects one of several exact key tuples without consuming a one-shot token
 * more than once.  Fields common to every variant are descriptor-snapshotted
 * before exact own-key enumeration; the selected variant's optional fields
 * are then read descriptor-only.
 *
 * @internal
 */
export function captureProviderPointRawObservedExactDataObjectUnionV1(
  session: ProviderPointRawAdmissionSessionV1,
  token: ProviderPointRawObservedObjectV1,
  expectedKeyVariants: readonly (readonly string[])[],
  budget?: ProviderPointRawAdmissionBudgetV1,
  containerDepth?: number,
): ProviderPointRawExactObjectUnionCaptureV1 {
  if (
    !CapturedArrayIsArrayV1(expectedKeyVariants) ||
    !CapturedObjectIsFrozenV1(expectedKeyVariants)
  ) {
    return failV1("provider point expected-key variants must be frozen");
  }
  const variantCount = readPlatformArrayLengthV1(expectedKeyVariants);
  if (variantCount === 0) {
    return failV1("provider point expected-key variants must not be empty");
  }
  for (let index = 0; index < variantCount; index += 1) {
    assertTrustedExpectedKeysV1(
      trustedExpectedVariantV1(expectedKeyVariants, index),
    );
  }

  const value = consumeObservedTokenForInspectionV1(session, token);
  assertProviderPointRawBudgetContainerV1(value, budget, containerDepth);
  assertPlainObjectIdentityV1(value);
  const firstVariant = trustedExpectedVariantV1(expectedKeyVariants, 0);
  const firstVariantLength = readPlatformArrayLengthV1(firstVariant);
  const commonFields = CapturedObjectCreateV1(null) as Record<string, unknown>;

  // Snapshot only keys known to every variant before any own-key trap.
  for (let keyIndex = 0; keyIndex < firstVariantLength; keyIndex += 1) {
    const key = trustedArrayItemV1(firstVariant, keyIndex);
    let common = true;
    for (let variantIndex = 1; variantIndex < variantCount; variantIndex += 1) {
      if (
        !expectedKeysContainV1(
          trustedExpectedVariantV1(expectedKeyVariants, variantIndex),
          key,
        )
      ) {
        common = false;
        break;
      }
    }
    if (common) {
      defineDataPropertyV1(
        commonFields,
        key,
        readBudgetedEnumerableDataPropertyV1(
          value,
          key,
          budget,
          containerDepth,
        ),
        true,
        false,
        false,
      );
    }
  }
  CapturedObjectFreezeV1(commonFields);

  const ownKeys = CapturedReflectOwnKeysV1(value);
  const ownKeyCount = readPlatformArrayLengthV1(ownKeys);
  let selectedVariantIndex = -1;
  for (let variantIndex = 0; variantIndex < variantCount; variantIndex += 1) {
    const variant = trustedExpectedVariantV1(
      expectedKeyVariants,
      variantIndex,
    );
    if (ownKeysExactlyMatchExpectedV1(ownKeys, ownKeyCount, variant)) {
      if (selectedVariantIndex !== -1) {
        return failV1("provider point expected-key variants are ambiguous");
      }
      selectedVariantIndex = variantIndex;
    }
  }
  if (selectedVariantIndex === -1) {
    return failV1("provider point raw object has an unexpected own key set");
  }

  const selectedVariant = trustedExpectedVariantV1(
    expectedKeyVariants,
    selectedVariantIndex,
  );
  const selectedLength = readPlatformArrayLengthV1(selectedVariant);
  const fields = CapturedObjectCreateV1(null) as Record<string, unknown>;
  for (let keyIndex = 0; keyIndex < selectedLength; keyIndex += 1) {
    const key = trustedArrayItemV1(selectedVariant, keyIndex);
    const fieldValue = hasOwnV1(commonFields, key)
      ? readEnumerableDataPropertyV1(commonFields, key)
      : readBudgetedEnumerableDataPropertyV1(
          value,
          key,
          budget,
          containerDepth,
        );
    defineDataPropertyV1(fields, key, fieldValue, true, false, false);
  }
  CapturedObjectFreezeV1(fields);

  const capture = CapturedObjectCreateV1(null) as unknown as
    ProviderPointRawExactObjectUnionCaptureV1;
  defineDataPropertyV1(
    capture,
    "fields",
    fields,
    true,
    false,
    false,
  );
  defineDataPropertyV1(
    capture,
    "variantIndex",
    selectedVariantIndex,
    true,
    false,
    false,
  );
  return CapturedObjectFreezeV1(capture);
}

/** @internal */
export interface ProviderPointRawDenseArrayCaptureV1 {
  readonly length: number;
  readonly items: Readonly<Record<string, unknown>>;
  /** Tokens are present only at indices whose raw item is an object/array. */
  readonly itemTokens: Readonly<
    Record<string, ProviderPointRawObservedObjectV1>
  >;
}

/**
 * Consumes one observed array token, checks its length cap before own-key
 * enumeration, then captures a dense descriptor-only item list. Object items
 * are appended to the shared identity collector immediately and returned as
 * one-shot tokens for the caller's next exact-shape inspection.
 *
 * @internal
 */
export function captureProviderPointRawObservedDenseArrayV1(
  session: ProviderPointRawAdmissionSessionV1,
  token: ProviderPointRawObservedObjectV1,
  maxLength: number,
  budget?: ProviderPointRawAdmissionBudgetV1,
  containerDepth?: number,
): ProviderPointRawDenseArrayCaptureV1 {
  if (
    !CapturedNumberIsSafeIntegerV1(maxLength) ||
    maxLength < 0
  ) {
    return failV1("provider point raw array cap must be a safe integer");
  }
  const value = consumeObservedTokenForInspectionV1(session, token);
  assertProviderPointRawBudgetContainerV1(value, budget, containerDepth);
  if (!CapturedArrayIsArrayV1(value)) {
    return failV1("provider point raw array node must be an array");
  }
  if (CapturedObjectGetPrototypeOfV1(value) !== CapturedArrayPrototypeV1) {
    return failV1("provider point raw arrays must use Array.prototype");
  }
  const rawLength = readOwnDataPropertyWithEnumerabilityV1(
    value,
    "length",
    false,
  );
  if (
    typeof rawLength !== "number" ||
    !CapturedNumberIsSafeIntegerV1(rawLength) ||
    rawLength < 0
  ) {
    return failV1("provider point raw array length is invalid");
  }
  if (rawLength > maxLength) {
    return failV1("provider point raw array length exceeds its cap");
  }

  const ownKeys = CapturedReflectOwnKeysV1(value);
  const ownKeyCount = readPlatformArrayLengthV1(ownKeys);
  if (ownKeyCount !== rawLength + 1) {
    return failV1("provider point raw arrays must be dense");
  }
  const items = CapturedObjectCreateV1(null) as Record<string, unknown>;
  const itemTokens = CapturedObjectCreateV1(null) as Record<
    string,
    ProviderPointRawObservedObjectV1
  >;
  let sawLength = false;
  for (let ownKeyIndex = 0; ownKeyIndex < ownKeyCount; ownKeyIndex += 1) {
    const key = readPlatformArrayElementV1(ownKeys, ownKeyIndex);
    if (typeof key !== "string") {
      return failV1("provider point raw arrays must not contain symbol keys");
    }
    if (key === "length") {
      if (sawLength) return failV1("provider point raw arrays must be dense");
      sawLength = true;
      continue;
    }
    parseDenseArrayIndexV1(key, rawLength);
    const item = readBudgetedEnumerableDataPropertyV1(
      value,
      key,
      budget,
      containerDepth,
    );
    defineDataPropertyV1(items, key, item, true, false, false);
    if (item !== null && typeof item === "object") {
      defineDataPropertyV1(
        itemTokens,
        key,
        observeObjectIdentityInternalV1(session, item),
        true,
        false,
        false,
      );
    }
  }
  if (!sawLength) return failV1("provider point raw arrays must be dense");
  CapturedObjectFreezeV1(items);
  CapturedObjectFreezeV1(itemTokens);

  const capture = CapturedObjectCreateV1(null) as unknown as
    ProviderPointRawDenseArrayCaptureV1;
  defineDataPropertyV1(capture, "length", rawLength, true, false, false);
  defineDataPropertyV1(capture, "items", items, true, false, false);
  defineDataPropertyV1(
    capture,
    "itemTokens",
    itemTokens,
    true,
    false,
    false,
  );
  return CapturedObjectFreezeV1(capture);
}

interface ProviderPointRawWalkFrameStateV1 {
  readonly token: ProviderPointRawObservedObjectV1;
  readonly next: ProviderPointRawWalkFrameStateV1 | null;
  readonly depth: number;
}

function createWalkFrameV1(
  token: ProviderPointRawObservedObjectV1,
  next: ProviderPointRawWalkFrameStateV1 | null,
  depth: number,
): ProviderPointRawWalkFrameStateV1 {
  const frame = CapturedObjectCreateV1(null) as unknown as
    ProviderPointRawWalkFrameStateV1;
  defineDataPropertyV1(frame, "token", token, true, false, false);
  defineDataPropertyV1(frame, "next", next, true, false, false);
  defineDataPropertyV1(frame, "depth", depth, true, false, false);
  return CapturedObjectFreezeV1(frame);
}

function readFrameFieldV1<T>(
  frame: ProviderPointRawWalkFrameStateV1,
  key: "token" | "next" | "depth",
): T {
  return readEnumerableDataPropertyV1(frame, key) as T;
}

function parseDenseArrayIndexV1(key: string, length: number): number {
  if (key.length === 0) {
    return failV1("provider point raw arrays must contain canonical indices");
  }
  const index = CapturedNumberV1(key);
  if (
    !CapturedNumberIsSafeIntegerV1(index) ||
    index < 0 ||
    index >= length ||
    CapturedStringV1(index) !== key
  ) {
    return failV1("provider point raw arrays must contain canonical indices");
  }
  return index;
}

function inspectObservedJsonNodeV1(
  session: ProviderPointRawAdmissionSessionV1,
  token: ProviderPointRawObservedObjectV1,
  pending: ProviderPointRawWalkFrameStateV1 | null,
  depth: number,
  budget?: ProviderPointRawAdmissionBudgetV1,
): ProviderPointRawWalkFrameStateV1 | null {
  const value = consumeObservedTokenForInspectionV1(session, token);
  const isArray = CapturedArrayIsArrayV1(value);
  const prototype = CapturedObjectGetPrototypeOfV1(value);
  if (
    (isArray && prototype !== CapturedArrayPrototypeV1) ||
    (!isArray &&
      prototype !== CapturedObjectPrototypeV1 &&
      prototype !== null)
  ) {
    return failV1("provider point raw JSON must use plain prototypes");
  }

  let arrayLength = -1;
  if (isArray) {
    const rawLength = readOwnDataPropertyWithEnumerabilityV1(
      value,
      "length",
      false,
    );
    if (
      typeof rawLength !== "number" ||
      !CapturedNumberIsSafeIntegerV1(rawLength) ||
      rawLength < 0
    ) {
      return failV1("provider point raw array length is invalid");
    }
    arrayLength = rawLength;
  }

  const keys = CapturedReflectOwnKeysV1(value);
  const keyCount = readPlatformArrayLengthV1(keys);
  if (isArray && keyCount !== arrayLength + 1) {
    return failV1("provider point raw arrays must be dense");
  }

  let sawArrayLength = false;
  let nextPending = pending;
  for (let index = 0; index < keyCount; index += 1) {
    const key = readPlatformArrayElementV1(keys, index);
    if (typeof key !== "string") {
      return failV1("provider point raw JSON must not contain symbol keys");
    }
    if (isArray && key === "length") {
      if (sawArrayLength) {
        return failV1("provider point raw arrays must be dense");
      }
      sawArrayLength = true;
      continue;
    }
    if (isArray) parseDenseArrayIndexV1(key, arrayLength);
    const child = readBudgetedEnumerableDataPropertyV1(
      value,
      key,
      budget,
      budget === undefined ? undefined : depth,
    );
    if (child !== null && typeof child === "object") {
      // Claim at descriptor-discovery time, before reflecting on the child.
      const childToken = observeObjectIdentityInternalV1(session, child);
      nextPending = createWalkFrameV1(childToken, nextPending, depth + 1);
    }
  }
  if (isArray && !sawArrayLength) {
    return failV1("provider point raw arrays must be dense");
  }
  return nextPending;
}

/**
 * Iteratively validates one JSON identity tree.  Primitive literals are left
 * to the later strict schema, matching the established C09-1G semantics.
 * The shared session rejects aliases and cycles across separate tree calls.
 *
 * @internal
 */
export function walkProviderPointRawJsonIdentityTreeV1(
  session: ProviderPointRawAdmissionSessionV1,
  root: unknown,
  budget?: ProviderPointRawAdmissionBudgetV1,
  rootDepth = 1,
): void {
  if (budget !== undefined) {
    if (rootDepth !== 1) {
      return failV1("budgeted provider point raw walk must begin at depth one");
    }
    countProviderPointRawAdmissionBudgetRootV1(budget, root);
  }
  let pending: ProviderPointRawWalkFrameStateV1 | null = createWalkFrameV1(
    observeObjectIdentityInternalV1(session, root),
    null,
    rootDepth,
  );
  while (pending !== null) {
    const frame = pending;
    pending = readFrameFieldV1<ProviderPointRawWalkFrameStateV1 | null>(
      frame,
      "next",
    );
    pending = inspectObservedJsonNodeV1(
      session,
      readFrameFieldV1<ProviderPointRawObservedObjectV1>(frame, "token"),
      pending,
      readFrameFieldV1<number>(frame, "depth"),
      budget,
    );
  }
}

/**
 * Walks a tree whose root was claimed earlier (for example immediately after
 * a top-level descriptor snapshot).
 *
 * @internal
 */
export function walkProviderPointRawObservedJsonIdentityTreeV1(
  session: ProviderPointRawAdmissionSessionV1,
  rootToken: ProviderPointRawObservedObjectV1,
  budget?: ProviderPointRawAdmissionBudgetV1,
  rootDepth = 1,
): void {
  if (budget !== undefined) {
    const rootState = tokenStateV1(rootToken);
    assertProviderPointRawBudgetContainerV1(
      rootState.value,
      budget,
      rootDepth,
    );
  }
  let pending: ProviderPointRawWalkFrameStateV1 | null = createWalkFrameV1(
    rootToken,
    null,
    rootDepth,
  );
  while (pending !== null) {
    const frame = pending;
    pending = readFrameFieldV1<ProviderPointRawWalkFrameStateV1 | null>(
      frame,
      "next",
    );
    pending = inspectObservedJsonNodeV1(
      session,
      readFrameFieldV1<ProviderPointRawObservedObjectV1>(frame, "token"),
      pending,
      readFrameFieldV1<number>(frame, "depth"),
      budget,
    );
  }
}

/**
 * Seals the collector and performs the one permitted request clone over the
 * exact raw top-level identity.  Only the safely extracted cloned input is
 * returned; the cloned collector branch is dropped immediately.
 *
 * @internal
 */
export function cloneProviderPointRawAdmissionCapsuleV1(
  session: ProviderPointRawAdmissionSessionV1,
): unknown {
  const state = sessionStateV1(session);
  assertOpenSessionV1(state);
  if (TrustedStructuredCloneV1 === undefined) {
    return failV1(
      "provider point requires a conformant platform structuredClone",
    );
  }
  setNullRecordOwnFieldV1(
    state as unknown as Record<PropertyKey, unknown>,
    "phase",
    "clone_attempted",
  );
  setNullRecordOwnFieldV1(
    state as unknown as Record<PropertyKey, unknown>,
    "cloneAttemptCount",
    state.cloneAttemptCount + 1,
  );
  CapturedObjectFreezeV1(state.observedIdentities);

  const capsule = CapturedObjectCreateV1(null) as Record<PropertyKey, unknown>;
  defineDataPropertyV1(
    capsule,
    "originalInput",
    state.originalInput,
    true,
    false,
    false,
  );
  defineDataPropertyV1(
    capsule,
    "observedIdentities",
    state.observedIdentities,
    true,
    false,
    false,
  );
  CapturedObjectFreezeV1(capsule);

  const clonedCapsule = TrustedStructuredCloneV1(capsule);
  if (clonedCapsule === null || typeof clonedCapsule !== "object") {
    return failV1("platform structuredClone returned an invalid capsule");
  }
  // Read both fields to prove the platform preserved the capsule shape, but
  // retain no reference to the cloned collector after this function returns.
  const clonedOriginalInput = readEnumerableDataPropertyV1(
    clonedCapsule,
    "originalInput",
  );
  readEnumerableDataPropertyV1(clonedCapsule, "observedIdentities");
  const clonedKeys = CapturedReflectOwnKeysV1(clonedCapsule);
  if (readPlatformArrayLengthV1(clonedKeys) !== 2) {
    return failV1("platform structuredClone returned an invalid capsule");
  }
  return clonedOriginalInput;
}

/** Safely snapshots exact fields from trusted detached clone output. @internal */
export function captureProviderPointDetachedExactDataObjectV1(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object") {
    return failV1("detached provider point value must be an object");
  }
  return snapshotExactDataObjectInternalV1(value, expectedKeys);
}

interface ProviderPointDetachedFreezeFrameV1 {
  readonly value: object;
  readonly next: ProviderPointDetachedFreezeFrameV1 | null;
}

function createDetachedFreezeFrameV1(
  value: object,
  next: ProviderPointDetachedFreezeFrameV1 | null,
): ProviderPointDetachedFreezeFrameV1 {
  const frame = CapturedObjectCreateV1(null) as unknown as
    ProviderPointDetachedFreezeFrameV1;
  defineDataPropertyV1(frame, "value", value, true, false, false);
  defineDataPropertyV1(frame, "next", next, true, false, false);
  return CapturedObjectFreezeV1(frame);
}

/**
 * Revalidates and recursively freezes one detached JSON tree.  Callers must
 * invoke it only for JSON fields, never for the retained opaque capability.
 *
 * @internal
 */
export function deepFreezeProviderPointDetachedDataTreeV1<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return failV1("detached provider point JSON root must be an object or array");
  }
  const seen = CapturedObjectFreezeV1(new CapturedWeakSetV1<object>());
  let pending: ProviderPointDetachedFreezeFrameV1 | null =
    createDetachedFreezeFrameV1(value, null);
  while (pending !== null) {
    const frame = pending;
    const current = readEnumerableDataPropertyV1(frame, "value");
    pending = readEnumerableDataPropertyV1(frame, "next") as
      ProviderPointDetachedFreezeFrameV1 | null;
    if (current === null || typeof current !== "object") {
      return failV1("detached provider point freeze frame is invalid");
    }
    if (weakSetHasV1(seen, current)) {
      return failV1("detached provider point JSON identities must form a tree");
    }
    weakSetAddV1(seen, current);

    const isArray = CapturedArrayIsArrayV1(current);
    const prototype = CapturedObjectGetPrototypeOfV1(current);
    if (
      (isArray && prototype !== CapturedArrayPrototypeV1) ||
      (!isArray &&
        prototype !== CapturedObjectPrototypeV1 &&
        prototype !== null)
    ) {
      return failV1("detached provider point JSON must use plain prototypes");
    }
    const keys = CapturedReflectOwnKeysV1(current);
    const keyCount = readPlatformArrayLengthV1(keys);
    let arrayLength = -1;
    if (isArray) {
      const rawLength = readOwnDataPropertyWithEnumerabilityV1(
        current,
        "length",
        false,
      );
      if (
        typeof rawLength !== "number" ||
        !CapturedNumberIsSafeIntegerV1(rawLength) ||
        rawLength < 0 ||
        keyCount !== rawLength + 1
      ) {
        return failV1("detached provider point arrays must be dense");
      }
      arrayLength = rawLength;
    }
    let sawArrayLength = false;
    for (let index = 0; index < keyCount; index += 1) {
      const key = readPlatformArrayElementV1(keys, index);
      if (typeof key !== "string") {
        return failV1("detached provider point JSON must not contain symbols");
      }
      if (isArray && key === "length") {
        sawArrayLength = true;
        continue;
      }
      if (isArray) parseDenseArrayIndexV1(key, arrayLength);
      const child = readEnumerableDataPropertyV1(current, key);
      if (child !== null && typeof child === "object") {
        pending = createDetachedFreezeFrameV1(child, pending);
      }
    }
    if (isArray && !sawArrayLength) {
      return failV1("detached provider point arrays must be dense");
    }
    CapturedObjectFreezeV1(current);
  }
  return value;
}

/** Internal bootstrap state probe used only by focused tests. @internal */
export function isProviderPointStructuredCloneBootstrapConformantV1(): boolean {
  return providerPointStructuredCloneBootstrapConformantV1;
}

/** Internal candidate probe used to exercise fail-closed bootstrap logic. @internal */
export function probeProviderPointStructuredCloneCandidateForTestV1(
  candidate: unknown,
): boolean {
  return probeStructuredCloneCandidateV1(candidate);
}

/** Internal per-session test seam; it cannot alter clone authority. @internal */
export function getProviderPointRawAdmissionCloneAttemptCountForTestV1(
  session: ProviderPointRawAdmissionSessionV1,
): number {
  return sessionStateV1(session).cloneAttemptCount;
}

CapturedObjectFreezeV1(createProviderPointRawAdmissionSessionV1);
CapturedObjectFreezeV1(createProviderPointRawAdmissionBudgetV1);
CapturedObjectFreezeV1(countProviderPointRawAdmissionBudgetRootV1);
CapturedObjectFreezeV1(observeProviderPointRawObjectIdentityV1);
CapturedObjectFreezeV1(captureProviderPointRawExactTopLevelV1);
CapturedObjectFreezeV1(captureProviderPointRawObservedExactDataObjectV1);
CapturedObjectFreezeV1(captureProviderPointRawObservedExactDataObjectUnionV1);
CapturedObjectFreezeV1(captureProviderPointRawObservedDenseArrayV1);
CapturedObjectFreezeV1(walkProviderPointRawJsonIdentityTreeV1);
CapturedObjectFreezeV1(walkProviderPointRawObservedJsonIdentityTreeV1);
CapturedObjectFreezeV1(cloneProviderPointRawAdmissionCapsuleV1);
CapturedObjectFreezeV1(captureProviderPointDetachedExactDataObjectV1);
CapturedObjectFreezeV1(deepFreezeProviderPointDetachedDataTreeV1);
CapturedObjectFreezeV1(isProviderPointStructuredCloneBootstrapConformantV1);
CapturedObjectFreezeV1(probeProviderPointStructuredCloneCandidateForTestV1);
CapturedObjectFreezeV1(getProviderPointRawAdmissionCloneAttemptCountForTestV1);
