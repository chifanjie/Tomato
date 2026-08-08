import { describe, expect, it } from "vitest";

import {
  captureProviderPointDetachedExactDataObjectV1,
  captureProviderPointRawExactTopLevelV1,
  captureProviderPointRawObservedDenseArrayV1,
  captureProviderPointRawObservedExactDataObjectV1,
  captureProviderPointRawObservedExactDataObjectUnionV1,
  cloneProviderPointRawAdmissionCapsuleV1,
  countProviderPointRawAdmissionBudgetAdditionalRootV1,
  countProviderPointRawAdmissionBudgetRootV1,
  createProviderPointRawAdmissionBudgetForSessionV1,
  createProviderPointRawAdmissionBudgetForSessionObservedForTestV1,
  createProviderPointRawAdmissionBudgetV1,
  createProviderPointRawAdmissionSessionV1,
  deepFreezeProviderPointDetachedDataTreeV1,
  exerciseProviderPointRawAdmissionAllocationCapForTestV1,
  getProviderPointRawAdmissionAllocationLedgerForTestV1,
  getProviderPointRawAdmissionBudgetLedgerForTestV1,
  getProviderPointRawAdmissionCloneAttemptCountForTestV1,
  isProviderPointStructuredCloneBootstrapConformantV1,
  observeProviderPointRawObjectIdentityV1,
  probeProviderPointStructuredCloneCandidateForTestV1,
  walkProviderPointRawJsonIdentityTreeV1,
  walkProviderPointRawObservedJsonIdentityTreeV1,
  walkProviderPointRawObservedJsonIdentityTreeWithDualBudgetsV1,
  type ProviderPointRawAdmissionSessionV1,
} from "../src/provider-point-raw-admission-internal.js";

const PAYLOAD_KEYS = Object.freeze(["payload"] as const);
const TWO_BLOCK_KEYS = Object.freeze(["first", "second"] as const);
const JSON_AND_CAPABILITY_KEYS = Object.freeze([
  "capability",
  "json",
] as const);
const UNIVERSE_AND_INHERITED_KEYS = Object.freeze([
  "inherited",
  "universe",
] as const);
const UNIVERSE_KEYS = Object.freeze(["payload"] as const);
const UNIVERSE_PAYLOAD_KEYS = Object.freeze(["target"] as const);
const ITEM_KEYS = Object.freeze(["id"] as const);
const UNION_BASE_KEYS = Object.freeze(["state"] as const);
const UNION_REASON_KEYS = Object.freeze(["reason", "state"] as const);
const UNION_KEY_VARIANTS = Object.freeze([
  UNION_BASE_KEYS,
  UNION_REASON_KEYS,
]);
const BUDGET_VALUE_KEYS = Object.freeze(["value"] as const);
const BUDGET_SHORT_VALUE_KEYS = Object.freeze(["v"] as const);
const BUDGET_CHILD_KEYS = Object.freeze(["child"] as const);
const BUDGET_UNION_BASE_KEYS = Object.freeze(["kind"] as const);
const BUDGET_UNION_NOTE_KEYS = Object.freeze(["kind", "note"] as const);
const BUDGET_UNION_KEY_VARIANTS = Object.freeze([
  BUDGET_UNION_BASE_KEYS,
  BUDGET_UNION_NOTE_KEYS,
]);
const BUDGET_FOUR_KEYS = Object.freeze([
  "first",
  "second",
  "third",
  "fourth",
] as const);
const BUDGET_LONG_UNION_BASE_KEYS = Object.freeze(["first"] as const);
const BUDGET_LONG_UNION_FULL_KEYS = BUDGET_FOUR_KEYS;
const BUDGET_LONG_UNION_KEY_VARIANTS = Object.freeze([
  BUDGET_LONG_UNION_BASE_KEYS,
  BUDGET_LONG_UNION_FULL_KEYS,
]);
const HISTORY_KEYS = Object.freeze([
  "registryHistory",
  "rootHistory",
] as const);

function preparePayload(input: object): {
  readonly session: ProviderPointRawAdmissionSessionV1;
  readonly captured: Readonly<Record<string, unknown>>;
} {
  const session = createProviderPointRawAdmissionSessionV1(input);
  const captured = captureProviderPointRawExactTopLevelV1(
    session,
    PAYLOAD_KEYS,
  );
  return { session, captured };
}

function expectDataCloneError(operation: () => unknown): void {
  let thrown: unknown;
  try {
    operation();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(DOMException);
  expect((thrown as DOMException).name).toBe("DataCloneError");
}

function restoreExactDescriptor(
  target: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor === undefined) {
    Reflect.deleteProperty(target, key);
  } else {
    Object.defineProperty(target, key, descriptor);
  }
}

describe("provider point package-internal raw admission", () => {
  it("freezes a descriptor-only exact top-level capture without invoking getters", () => {
    let getterCalls = 0;
    const input = { payload: { accepted: true } } as {
      payload: object;
      extra?: unknown;
    };
    Object.defineProperty(input, "extra", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return true;
      },
    });

    const session = createProviderPointRawAdmissionSessionV1(input);
    expect(() =>
      captureProviderPointRawExactTopLevelV1(session, PAYLOAD_KEYS),
    ).toThrow(TypeError);
    expect(getterCalls).toBe(0);

    const reordered = { second: 2, first: 1 };
    const exactSession = createProviderPointRawAdmissionSessionV1(reordered);
    const exact = captureProviderPointRawExactTopLevelV1(
      exactSession,
      TWO_BLOCK_KEYS,
    );
    expect(Object.getPrototypeOf(exact)).toBeNull();
    expect(Object.keys(exact)).toEqual(["first", "second"]);
    expect(exact).toEqual({ first: 1, second: 2 });
    expect(Object.isFrozen(exact)).toBe(true);
  });

  it("rejects stable nested accessors without executing them", () => {
    let getterCalls = 0;
    const payload = {} as { hostile?: unknown };
    Object.defineProperty(payload, "hostile", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "unreachable";
      },
    });
    const { session, captured } = preparePayload({ payload });
    expect(() =>
      walkProviderPointRawJsonIdentityTreeV1(session, captured.payload),
    ).toThrow(TypeError);
    expect(getterCalls).toBe(0);
  });

  it("records and rejects transparent top-level and nested Proxies", () => {
    const topProxy = new Proxy({ payload: { accepted: true } }, {});
    const topSession = createProviderPointRawAdmissionSessionV1(topProxy);
    const topCaptured = captureProviderPointRawExactTopLevelV1(
      topSession,
      PAYLOAD_KEYS,
    );
    walkProviderPointRawJsonIdentityTreeV1(topSession, topCaptured.payload);
    expectDataCloneError(() =>
      cloneProviderPointRawAdmissionCapsuleV1(topSession),
    );
    expect(
      getProviderPointRawAdmissionCloneAttemptCountForTestV1(topSession),
    ).toBe(1);

    const nestedProxy = new Proxy({ accepted: true }, {});
    const { session, captured } = preparePayload({ payload: nestedProxy });
    walkProviderPointRawJsonIdentityTreeV1(session, captured.payload);
    expectDataCloneError(() =>
      cloneProviderPointRawAdmissionCapsuleV1(session),
    );
  });

  it("retains a self-removing nested Proxy in the sealed identity collector", () => {
    let trapCalls = 0;
    const parent: { child: object } = { child: {} };
    const proxy = new Proxy(
      {},
      {
        getPrototypeOf(target) {
          trapCalls += 1;
          parent.child = { replacement: true };
          return Reflect.getPrototypeOf(target);
        },
      },
    );
    parent.child = proxy;
    const { session, captured } = preparePayload({ payload: parent });
    walkProviderPointRawJsonIdentityTreeV1(session, captured.payload);
    expect(trapCalls).toBeGreaterThan(0);
    expect(parent.child).not.toBe(proxy);
    expectDataCloneError(() =>
      cloneProviderPointRawAdmissionCapsuleV1(session),
    );
    expect(
      getProviderPointRawAdmissionCloneAttemptCountForTestV1(session),
    ).toBe(1);
  });

  it("rejects hidden fields, symbols, sparse arrays, and custom prototypes", () => {
    const hiddenPayload = { visible: true } as {
      visible: boolean;
      hidden?: boolean;
    };
    Object.defineProperty(hiddenPayload, "hidden", {
      value: true,
      enumerable: false,
    });
    const hidden = preparePayload({ payload: hiddenPayload });
    expect(() =>
      walkProviderPointRawJsonIdentityTreeV1(
        hidden.session,
        hidden.captured.payload,
      ),
    ).toThrow(TypeError);

    const symbolPayload = { visible: true };
    Object.defineProperty(symbolPayload, Symbol("hostile"), {
      value: true,
      enumerable: true,
    });
    const symbol = preparePayload({ payload: symbolPayload });
    expect(() =>
      walkProviderPointRawJsonIdentityTreeV1(
        symbol.session,
        symbol.captured.payload,
      ),
    ).toThrow(TypeError);

    const sparsePayload = new Array(2) as unknown[];
    sparsePayload[1] = { present: true };
    const sparse = preparePayload({ payload: sparsePayload });
    expect(() =>
      walkProviderPointRawJsonIdentityTreeV1(
        sparse.session,
        sparse.captured.payload,
      ),
    ).toThrow(TypeError);

    const customPayload = Object.create({ inherited: true }) as object;
    Object.defineProperty(customPayload, "visible", {
      value: true,
      enumerable: true,
    });
    const custom = preparePayload({ payload: customPayload });
    expect(() =>
      walkProviderPointRawJsonIdentityTreeV1(
        custom.session,
        custom.captured.payload,
      ),
    ).toThrow(TypeError);
  });

  it("rejects cycles, aliases, and aliases across separately walked blocks", () => {
    const cyclePayload: { self?: unknown } = {};
    cyclePayload.self = cyclePayload;
    const cycle = preparePayload({ payload: cyclePayload });
    expect(() =>
      walkProviderPointRawJsonIdentityTreeV1(
        cycle.session,
        cycle.captured.payload,
      ),
    ).toThrow(TypeError);

    const shared = { leaf: true };
    const alias = preparePayload({
      payload: { first: shared, second: shared },
    });
    expect(() =>
      walkProviderPointRawJsonIdentityTreeV1(
        alias.session,
        alias.captured.payload,
      ),
    ).toThrow(TypeError);

    const crossShared = { leaf: true };
    const crossInput = {
      first: { child: crossShared },
      second: { child: crossShared },
    };
    const crossSession = createProviderPointRawAdmissionSessionV1(crossInput);
    const crossCaptured = captureProviderPointRawExactTopLevelV1(
      crossSession,
      TWO_BLOCK_KEYS,
    );
    walkProviderPointRawJsonIdentityTreeV1(
      crossSession,
      crossCaptured.first,
    );
    expect(() =>
      walkProviderPointRawJsonIdentityTreeV1(
        crossSession,
        crossCaptured.second,
      ),
    ).toThrow(TypeError);
  });

  it("selects one exact object key-set variant with a one-shot token", () => {
    const base = preparePayload({ payload: { state: "complete" } });
    const baseToken = observeProviderPointRawObjectIdentityV1(
      base.session,
      base.captured.payload,
    );
    const baseCapture =
      captureProviderPointRawObservedExactDataObjectUnionV1(
        base.session,
        baseToken,
        UNION_KEY_VARIANTS,
      );
    expect(baseCapture.variantIndex).toBe(0);
    expect(baseCapture.fields).toEqual({ state: "complete" });
    expect(Object.getPrototypeOf(baseCapture)).toBeNull();
    expect(Object.getPrototypeOf(baseCapture.fields)).toBeNull();
    expect(Object.isFrozen(baseCapture)).toBe(true);
    expect(Object.isFrozen(baseCapture.fields)).toBe(true);
    expect(() =>
      captureProviderPointRawObservedExactDataObjectUnionV1(
        base.session,
        baseToken,
        UNION_KEY_VARIANTS,
      ),
    ).toThrow(TypeError);

    const withReason = preparePayload({
      payload: { state: "incomplete", reason: "unresolved" },
    });
    const reasonToken = observeProviderPointRawObjectIdentityV1(
      withReason.session,
      withReason.captured.payload,
    );
    const reasonCapture =
      captureProviderPointRawObservedExactDataObjectUnionV1(
        withReason.session,
        reasonToken,
        UNION_KEY_VARIANTS,
      );
    expect(reasonCapture.variantIndex).toBe(1);
    expect(reasonCapture.fields).toEqual({
      reason: "unresolved",
      state: "incomplete",
    });
  });

  it("rejects union optional accessors and unknown keys without invoking getters", () => {
    let getterCalls = 0;
    const accessor = { state: "incomplete" } as {
      state: string;
      reason?: string;
    };
    Object.defineProperty(accessor, "reason", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "unreachable";
      },
    });
    const accessorInput = preparePayload({ payload: accessor });
    const accessorToken = observeProviderPointRawObjectIdentityV1(
      accessorInput.session,
      accessorInput.captured.payload,
    );
    expect(() =>
      captureProviderPointRawObservedExactDataObjectUnionV1(
        accessorInput.session,
        accessorToken,
        UNION_KEY_VARIANTS,
      ),
    ).toThrow(TypeError);
    expect(getterCalls).toBe(0);

    const unknown = { state: "complete" } as {
      state: string;
      unexpected?: string;
    };
    Object.defineProperty(unknown, "unexpected", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "unreachable";
      },
    });
    const unknownInput = preparePayload({ payload: unknown });
    const unknownToken = observeProviderPointRawObjectIdentityV1(
      unknownInput.session,
      unknownInput.captured.payload,
    );
    expect(() =>
      captureProviderPointRawObservedExactDataObjectUnionV1(
        unknownInput.session,
        unknownToken,
        UNION_KEY_VARIANTS,
      ),
    ).toThrow(TypeError);
    expect(getterCalls).toBe(0);
  });

  it("captures a dense observed array at its exact cap and returns child tokens", () => {
    const input = preparePayload({
      payload: [{ id: "target-1" }, "primitive"],
    });
    const arrayToken = observeProviderPointRawObjectIdentityV1(
      input.session,
      input.captured.payload,
    );
    const dense = captureProviderPointRawObservedDenseArrayV1(
      input.session,
      arrayToken,
      2,
    );
    expect(dense.length).toBe(2);
    expect(dense.items).toEqual({
      0: { id: "target-1" },
      1: "primitive",
    });
    expect(Object.getPrototypeOf(dense)).toBeNull();
    expect(Object.getPrototypeOf(dense.items)).toBeNull();
    expect(Object.getPrototypeOf(dense.itemTokens)).toBeNull();
    expect(Object.keys(dense.itemTokens)).toEqual(["0"]);
    expect(Object.isFrozen(dense)).toBe(true);
    expect(Object.isFrozen(dense.items)).toBe(true);
    expect(Object.isFrozen(dense.itemTokens)).toBe(true);
    expect(
      captureProviderPointRawObservedExactDataObjectV1(
        input.session,
        dense.itemTokens["0"]!,
        ITEM_KEYS,
      ),
    ).toEqual({ id: "target-1" });
  });

  it("charges exact and union descriptor values at the configured budget boundary", () => {
    const exactInput = preparePayload({ payload: { v: "12345" } });
    const exactToken = observeProviderPointRawObjectIdentityV1(
      exactInput.session,
      exactInput.captured.payload,
    );
    const exactBudget = createProviderPointRawAdmissionBudgetV1(
      64,
      16,
      4,
      16,
      true,
    );
    countProviderPointRawAdmissionBudgetRootV1(
      exactBudget,
      exactInput.captured.payload,
    );
    expect(() =>
      captureProviderPointRawObservedExactDataObjectV1(
        exactInput.session,
        exactToken,
        BUDGET_SHORT_VALUE_KEYS,
        exactBudget,
        1,
      ),
    ).toThrow(TypeError);

    const unionInput = preparePayload({
      payload: { kind: "x", note: "12345" },
    });
    const unionToken = observeProviderPointRawObjectIdentityV1(
      unionInput.session,
      unionInput.captured.payload,
    );
    const unionBudget = createProviderPointRawAdmissionBudgetV1(
      64,
      16,
      8,
      13,
      true,
    );
    countProviderPointRawAdmissionBudgetRootV1(
      unionBudget,
      unionInput.captured.payload,
    );
    expect(() =>
      captureProviderPointRawObservedExactDataObjectUnionV1(
        unionInput.session,
        unionToken,
        BUDGET_UNION_KEY_VARIANTS,
        unionBudget,
        1,
      ),
    ).toThrow(TypeError);
  });

  it("makes root accounting one-shot and budgets an exact top-level capture", () => {
    const input = { value: "four" };
    const session = createProviderPointRawAdmissionSessionV1(input);
    const budget = createProviderPointRawAdmissionBudgetV1(2, 2, 5, 9);
    countProviderPointRawAdmissionBudgetRootV1(budget, input);
    expect(() =>
      countProviderPointRawAdmissionBudgetRootV1(budget, input),
    ).toThrow(TypeError);
    expect(
      captureProviderPointRawExactTopLevelV1(
        session,
        BUDGET_VALUE_KEYS,
        budget,
        1,
      ),
    ).toEqual({ value: "four" });
  });

  it("charges session-owned budget storage and root WeakSet entries at exact W boundaries", () => {
    const exactInput = {};
    const exactSession = createProviderPointRawAdmissionSessionV1(exactInput, {
      maxObservedIdentities: 1,
      maxPrecloneAllocationWorkUnits: 74,
    });
    const exactBudget = createProviderPointRawAdmissionBudgetForSessionV1(
      exactSession,
      1,
      1,
      1,
      1,
    );
    countProviderPointRawAdmissionBudgetRootV1(exactBudget, exactInput);
    expect(
      getProviderPointRawAdmissionAllocationLedgerForTestV1(exactSession),
    ).toMatchObject({
      precloneAllocationWorkUnitCount: 74,
      remainingPrecloneAllocationWorkUnits: 0,
    });

    const rootCappedInput = {};
    const rootCappedSession = createProviderPointRawAdmissionSessionV1(
      rootCappedInput,
      {
        maxObservedIdentities: 1,
        maxPrecloneAllocationWorkUnits: 73,
      },
    );
    const rootCappedBudget = createProviderPointRawAdmissionBudgetForSessionV1(
      rootCappedSession,
      1,
      1,
      1,
      1,
    );
    expect(() =>
      countProviderPointRawAdmissionBudgetRootV1(
        rootCappedBudget,
        rootCappedInput,
      ),
    ).toThrow(TypeError);
    expect(
      getProviderPointRawAdmissionAllocationLedgerForTestV1(rootCappedSession),
    ).toMatchObject({
      precloneAllocationWorkUnitCount: 72,
      remainingPrecloneAllocationWorkUnits: 1,
      cloneAttemptCount: 0,
    });

    const shellCappedSession = createProviderPointRawAdmissionSessionV1({}, {
      maxObservedIdentities: 1,
      maxPrecloneAllocationWorkUnits: 71,
    });
    expect(() =>
      createProviderPointRawAdmissionBudgetForSessionV1(
        shellCappedSession,
        1,
        1,
        1,
        1,
      ),
    ).toThrow(TypeError);
    expect(
      getProviderPointRawAdmissionAllocationLedgerForTestV1(shellCappedSession),
    ).toMatchObject({
      precloneAllocationWorkUnitCount: 68,
      remainingPrecloneAllocationWorkUnits: 3,
      cloneAttemptCount: 0,
    });
  });

  it("charges both budget WeakSets exactly during a dual-budget walk", () => {
    function exercise(maxWorkUnits: number): {
      readonly session: ProviderPointRawAdmissionSessionV1;
      readonly walk: () => void;
      readonly childPrototypeReads: () => number;
    } {
      let prototypeReads = 0;
      const child = new Proxy(
        {},
        {
          getPrototypeOf(target) {
            prototypeReads += 1;
            return Reflect.getPrototypeOf(target);
          },
        },
      );
      const input = { payload: [{ child }] };
      const session = createProviderPointRawAdmissionSessionV1(input, {
        maxObservedIdentities: 4,
        maxPrecloneAllocationWorkUnits: maxWorkUnits,
      });
      const top = captureProviderPointRawExactTopLevelV1(session, PAYLOAD_KEYS);
      const historyToken = observeProviderPointRawObjectIdentityV1(
        session,
        top.payload,
      );
      const aggregateBudget = createProviderPointRawAdmissionBudgetForSessionV1(
        session,
        3,
        4,
        16,
        64,
      );
      countProviderPointRawAdmissionBudgetRootV1(
        aggregateBudget,
        top.payload,
      );
      const dense = captureProviderPointRawObservedDenseArrayV1(
        session,
        historyToken,
        1,
        aggregateBudget,
        1,
      );
      const branchBudget = createProviderPointRawAdmissionBudgetForSessionV1(
        session,
        2,
        2,
        16,
        64,
      );
      countProviderPointRawAdmissionBudgetRootV1(
        branchBudget,
        dense.items["0"],
      );
      return {
        session,
        walk: () =>
          walkProviderPointRawObservedJsonIdentityTreeWithDualBudgetsV1(
            session,
            dense.itemTokens["0"]!,
            branchBudget,
            aggregateBudget,
          ),
        childPrototypeReads: () => prototypeReads,
      };
    }

    const exact = exercise(106);
    expect(exact.walk).not.toThrow();
    expect(exact.childPrototypeReads()).toBe(1);
    expect(
      getProviderPointRawAdmissionAllocationLedgerForTestV1(exact.session),
    ).toMatchObject({
      observedIdentityCount: 4,
      precloneAllocationWorkUnitCount: 106,
      remainingPrecloneAllocationWorkUnits: 0,
      cloneAttemptCount: 0,
    });

    const capped = exercise(105);
    expect(capped.walk).toThrow(TypeError);
    expect(capped.childPrototypeReads()).toBe(0);
    expect(
      getProviderPointRawAdmissionAllocationLedgerForTestV1(capped.session),
    ).toMatchObject({
      observedIdentityCount: 4,
      precloneAllocationWorkUnitCount: 105,
      remainingPrecloneAllocationWorkUnits: 0,
      cloneAttemptCount: 0,
    });
  });

  it("does not double-count an already-budgeted observed walker root", () => {
    const input = preparePayload({ payload: { child: {} } });
    const parentToken = observeProviderPointRawObjectIdentityV1(
      input.session,
      input.captured.payload,
    );
    const budget = createProviderPointRawAdmissionBudgetV1(2, 2, 5, 5);
    countProviderPointRawAdmissionBudgetRootV1(
      budget,
      input.captured.payload,
    );
    const parent = captureProviderPointRawObservedExactDataObjectV1(
      input.session,
      parentToken,
      BUDGET_CHILD_KEYS,
      budget,
      1,
    );
    const childToken = observeProviderPointRawObjectIdentityV1(
      input.session,
      parent.child,
    );
    expect(() =>
      walkProviderPointRawObservedJsonIdentityTreeV1(
        input.session,
        childToken,
        budget,
        2,
      ),
    ).not.toThrow();
  });

  it("stops exact and union descriptor traversal at node cap+1", () => {
    function proxiedFields(): {
      readonly value: Record<string, boolean>;
      readonly descriptorKeys: string[];
    } {
      const descriptorKeys: string[] = [];
      const value = new Proxy(
        { first: true, second: true, third: true, fourth: true },
        {
          getOwnPropertyDescriptor(target, key) {
            descriptorKeys.push(String(key));
            return Reflect.getOwnPropertyDescriptor(target, key);
          },
        },
      );
      return { value, descriptorKeys };
    }

    const exact = proxiedFields();
    const exactInput = preparePayload({ payload: exact.value });
    const exactToken = observeProviderPointRawObjectIdentityV1(
      exactInput.session,
      exactInput.captured.payload,
    );
    const exactBudget = createProviderPointRawAdmissionBudgetV1(4, 3, 6, 22);
    countProviderPointRawAdmissionBudgetRootV1(
      exactBudget,
      exactInput.captured.payload,
    );
    expect(() =>
      captureProviderPointRawObservedExactDataObjectV1(
        exactInput.session,
        exactToken,
        BUDGET_FOUR_KEYS,
        exactBudget,
        1,
      ),
    ).toThrow(TypeError);
    expect(exact.descriptorKeys).toContain("third");
    expect(exact.descriptorKeys).not.toContain("fourth");

    const union = proxiedFields();
    const unionInput = preparePayload({ payload: union.value });
    const unionToken = observeProviderPointRawObjectIdentityV1(
      unionInput.session,
      unionInput.captured.payload,
    );
    const unionBudget = createProviderPointRawAdmissionBudgetV1(4, 3, 6, 22);
    countProviderPointRawAdmissionBudgetRootV1(
      unionBudget,
      unionInput.captured.payload,
    );
    expect(() =>
      captureProviderPointRawObservedExactDataObjectUnionV1(
        unionInput.session,
        unionToken,
        BUDGET_LONG_UNION_KEY_VARIANTS,
        unionBudget,
        1,
      ),
    ).toThrow(TypeError);
    expect(union.descriptorKeys).toContain("third");
    expect(union.descriptorKeys).not.toContain("fourth");
  });

  it("stops dense-array descriptor traversal immediately at node and string caps", () => {
    function exercise(
      values: readonly unknown[],
      budget: ReturnType<typeof createProviderPointRawAdmissionBudgetV1>,
    ): readonly string[] {
      const descriptorKeys: string[] = [];
      const array = new Proxy([...values], {
        getOwnPropertyDescriptor(target, key) {
          descriptorKeys.push(String(key));
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });
      const input = preparePayload({ payload: array });
      const token = observeProviderPointRawObjectIdentityV1(
        input.session,
        input.captured.payload,
      );
      countProviderPointRawAdmissionBudgetRootV1(
        budget,
        input.captured.payload,
      );
      expect(() =>
        captureProviderPointRawObservedDenseArrayV1(
          input.session,
          token,
          values.length,
          budget,
          1,
        ),
      ).toThrow(TypeError);
      return descriptorKeys;
    }

    const nodeKeys = exercise(
      [true, false, true, false],
      createProviderPointRawAdmissionBudgetV1(64, 3, 16, 64, true),
    );
    expect(nodeKeys).toContain("2");
    expect(nodeKeys).not.toContain("3");

    const stringKeys = exercise(
      ["aa", "bb", "cc", "dd"],
      createProviderPointRawAdmissionBudgetV1(64, 16, 4, 8, true),
    );
    expect(stringKeys).toContain("2");
    expect(stringKeys).not.toContain("3");
  });

  it("charges every raw string property name before its descriptor but excludes array length", () => {
    const admitted = { v: true };
    const admittedSession = createProviderPointRawAdmissionSessionV1(admitted);
    const admittedBudget = createProviderPointRawAdmissionBudgetV1(
      2,
      2,
      1,
      1,
      true,
    );
    countProviderPointRawAdmissionBudgetRootV1(admittedBudget, admitted);
    expect(
      captureProviderPointRawExactTopLevelV1(
        admittedSession,
        BUDGET_SHORT_VALUE_KEYS,
        admittedBudget,
        1,
      ),
    ).toEqual({ v: true });

    let unknownDescriptorCalls = 0;
    let unknownGetterCalls = 0;
    const unknownTarget = { v: true } as { v: boolean; oversized?: unknown };
    Object.defineProperty(unknownTarget, "oversized", {
      enumerable: true,
      configurable: true,
      get() {
        unknownGetterCalls += 1;
        return "unreachable";
      },
    });
    const unknown = new Proxy(unknownTarget, {
      getOwnPropertyDescriptor(target, key) {
        unknownDescriptorCalls += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const unknownSession = createProviderPointRawAdmissionSessionV1(unknown);
    const unknownBudget = createProviderPointRawAdmissionBudgetV1(
      2,
      4,
      "oversized".length - 1,
      64,
      true,
    );
    countProviderPointRawAdmissionBudgetRootV1(unknownBudget, unknown);
    expect(() =>
      captureProviderPointRawExactTopLevelV1(
        unknownSession,
        BUDGET_SHORT_VALUE_KEYS,
        unknownBudget,
        1,
      ),
    ).toThrow(TypeError);
    expect(unknownDescriptorCalls).toBe(0);
    expect(unknownGetterCalls).toBe(0);
    expect(
      getProviderPointRawAdmissionCloneAttemptCountForTestV1(unknownSession),
    ).toBe(0);

    const arrayInput = preparePayload({ payload: [true] });
    const arrayToken = observeProviderPointRawObjectIdentityV1(
      arrayInput.session,
      arrayInput.captured.payload,
    );
    const arrayBudget = createProviderPointRawAdmissionBudgetV1(
      2,
      2,
      1,
      1,
      true,
    );
    countProviderPointRawAdmissionBudgetRootV1(
      arrayBudget,
      arrayInput.captured.payload,
    );
    expect(() =>
      captureProviderPointRawObservedDenseArrayV1(
        arrayInput.session,
        arrayToken,
        1,
        arrayBudget,
        1,
      ),
    ).not.toThrow();
  });

  it("charges two history roots against one exact aggregate budget and preserves C/W/clone ledgers", () => {
    const rootEnvelope = { payload: { label: "a" } };
    const registryEnvelope = { payload: { label: "b" } };
    const input = {
      rootHistory: [rootEnvelope],
      registryHistory: [registryEnvelope],
    };
    const session = createProviderPointRawAdmissionSessionV1(input, {
      maxObservedIdentities: 7,
      maxPrecloneAllocationWorkUnits: 115,
    });
    const top = captureProviderPointRawExactTopLevelV1(session, HISTORY_KEYS);
    const rootHistoryToken = observeProviderPointRawObjectIdentityV1(
      session,
      top.rootHistory,
    );
    const registryHistoryToken = observeProviderPointRawObjectIdentityV1(
      session,
      top.registryHistory,
    );
    const aggregateBudget = createProviderPointRawAdmissionBudgetV1(
      4,
      8,
      7,
      28,
      true,
    );
    countProviderPointRawAdmissionBudgetRootV1(
      aggregateBudget,
      top.rootHistory,
    );
    countProviderPointRawAdmissionBudgetAdditionalRootV1(
      aggregateBudget,
      top.registryHistory,
    );
    const rootDense = captureProviderPointRawObservedDenseArrayV1(
      session,
      rootHistoryToken,
      1,
      aggregateBudget,
      1,
    );
    const registryDense = captureProviderPointRawObservedDenseArrayV1(
      session,
      registryHistoryToken,
      1,
      aggregateBudget,
      1,
    );
    const rootBranchBudget = createProviderPointRawAdmissionBudgetV1(
      3,
      3,
      7,
      13,
      true,
    );
    const registryBranchBudget = createProviderPointRawAdmissionBudgetV1(
      3,
      3,
      7,
      13,
      true,
    );
    countProviderPointRawAdmissionBudgetRootV1(
      rootBranchBudget,
      rootDense.items["0"],
    );
    countProviderPointRawAdmissionBudgetRootV1(
      registryBranchBudget,
      registryDense.items["0"],
    );
    walkProviderPointRawObservedJsonIdentityTreeWithDualBudgetsV1(
      session,
      rootDense.itemTokens["0"]!,
      rootBranchBudget,
      aggregateBudget,
    );
    walkProviderPointRawObservedJsonIdentityTreeWithDualBudgetsV1(
      session,
      registryDense.itemTokens["0"]!,
      registryBranchBudget,
      aggregateBudget,
    );
    expect(
      getProviderPointRawAdmissionAllocationLedgerForTestV1(session),
    ).toMatchObject({
      observedIdentityCount: 7,
      precloneAllocationWorkUnitCount: 115,
      remainingPrecloneAllocationWorkUnits: 0,
      cloneAttemptCount: 0,
    });
    expect(() => cloneProviderPointRawAdmissionCapsuleV1(session)).not.toThrow();
    expect(getProviderPointRawAdmissionCloneAttemptCountForTestV1(session)).toBe(
      1,
    );
  });

  it("fails either history branch or aggregate name budget before one shared descriptor traversal", () => {
    function exercise(
      branchSingleCap: number,
      aggregateSingleCap: number,
      expectedFailure = true,
    ): {
      readonly ownKeysCalls: number;
      readonly descriptorCalls: number;
      readonly session: ProviderPointRawAdmissionSessionV1;
    } {
      let ownKeysCalls = 0;
      let descriptorCalls = 0;
      const envelope = new Proxy(
        { payload: { label: "a" } },
        {
          ownKeys(target) {
            ownKeysCalls += 1;
            return Reflect.ownKeys(target);
          },
          getOwnPropertyDescriptor(target, key) {
            descriptorCalls += 1;
            return Reflect.getOwnPropertyDescriptor(target, key);
          },
        },
      );
      const input = { payload: [envelope] };
      const session = createProviderPointRawAdmissionSessionV1(input);
      const top = captureProviderPointRawExactTopLevelV1(session, PAYLOAD_KEYS);
      const historyToken = observeProviderPointRawObjectIdentityV1(
        session,
        top.payload,
      );
      const aggregateBudget = createProviderPointRawAdmissionBudgetV1(
        4,
        4,
        aggregateSingleCap,
        64,
        true,
      );
      countProviderPointRawAdmissionBudgetRootV1(
        aggregateBudget,
        top.payload,
      );
      const dense = captureProviderPointRawObservedDenseArrayV1(
        session,
        historyToken,
        1,
        aggregateBudget,
        1,
      );
      const branchBudget = createProviderPointRawAdmissionBudgetV1(
        3,
        3,
        branchSingleCap,
        64,
        true,
      );
      countProviderPointRawAdmissionBudgetRootV1(
        branchBudget,
        dense.items["0"],
      );
      const walk = () =>
        walkProviderPointRawObservedJsonIdentityTreeWithDualBudgetsV1(
          session,
          dense.itemTokens["0"]!,
          branchBudget,
          aggregateBudget,
        );
      if (expectedFailure) {
        expect(walk).toThrow(TypeError);
      } else {
        expect(walk).not.toThrow();
      }
      return { ownKeysCalls, descriptorCalls, session };
    }

    const branchFirst = exercise(6, 7);
    expect(branchFirst.ownKeysCalls).toBe(1);
    expect(branchFirst.descriptorCalls).toBe(0);
    expect(
      getProviderPointRawAdmissionCloneAttemptCountForTestV1(
        branchFirst.session,
      ),
    ).toBe(0);

    const aggregateFirst = exercise(7, 6);
    expect(aggregateFirst.ownKeysCalls).toBe(1);
    expect(aggregateFirst.descriptorCalls).toBe(0);
    expect(
      getProviderPointRawAdmissionCloneAttemptCountForTestV1(
        aggregateFirst.session,
      ),
    ).toBe(0);

    const exact = exercise(7, 7, false);
    expect(exact.ownKeysCalls).toBe(1);
    expect(exact.descriptorCalls).toBe(1);
    expect(
      getProviderPointRawAdmissionAllocationLedgerForTestV1(exact.session),
    ).toMatchObject({
      observedIdentityCount: 4,
      cloneAttemptCount: 0,
    });
  });

  it("still rejects an Envelope identity aliased across the two history arrays", () => {
    const sharedEnvelope = { payload: { label: "shared" } };
    const input = {
      rootHistory: [sharedEnvelope],
      registryHistory: [sharedEnvelope],
    };
    const session = createProviderPointRawAdmissionSessionV1(input);
    const top = captureProviderPointRawExactTopLevelV1(session, HISTORY_KEYS);
    const rootHistoryToken = observeProviderPointRawObjectIdentityV1(
      session,
      top.rootHistory,
    );
    const registryHistoryToken = observeProviderPointRawObjectIdentityV1(
      session,
      top.registryHistory,
    );
    const aggregateBudget = createProviderPointRawAdmissionBudgetV1(
      4,
      16,
      16,
      128,
    );
    countProviderPointRawAdmissionBudgetRootV1(
      aggregateBudget,
      top.rootHistory,
    );
    countProviderPointRawAdmissionBudgetAdditionalRootV1(
      aggregateBudget,
      top.registryHistory,
    );
    captureProviderPointRawObservedDenseArrayV1(
      session,
      rootHistoryToken,
      1,
      aggregateBudget,
      1,
    );
    expect(() =>
      captureProviderPointRawObservedDenseArrayV1(
        session,
        registryHistoryToken,
        1,
        aggregateBudget,
        1,
      ),
    ).toThrow(TypeError);
    expect(getProviderPointRawAdmissionCloneAttemptCountForTestV1(session)).toBe(
      0,
    );
  });

  it("rejects the first value at depth cap+1 before reflecting on that child", () => {
    let childPrototypeReads = 0;
    const deepChild = new Proxy(
      { unreachable: true },
      {
        getPrototypeOf(target) {
          childPrototypeReads += 1;
          return Reflect.getPrototypeOf(target);
        },
      },
    );
    const parent = { child: deepChild };
    const input = preparePayload({ payload: parent });
    const parentToken = observeProviderPointRawObjectIdentityV1(
      input.session,
      input.captured.payload,
    );
    const budget = createProviderPointRawAdmissionBudgetV1(1, 16, 16, 64);
    countProviderPointRawAdmissionBudgetRootV1(budget, input.captured.payload);
    expect(() =>
      captureProviderPointRawObservedExactDataObjectV1(
        input.session,
        parentToken,
        BUDGET_CHILD_KEYS,
        budget,
        1,
      ),
    ).toThrow(TypeError);
    expect(childPrototypeReads).toBe(0);
  });

  it("rejects an observed array at cap+1 before own-key enumeration", () => {
    let ownKeysCalls = 0;
    const oversized = new Proxy(
      [{ id: "1" }, { id: "2" }, { id: "3" }],
      {
        ownKeys(target) {
          ownKeysCalls += 1;
          return Reflect.ownKeys(target);
        },
      },
    );
    const input = preparePayload({ payload: oversized });
    const arrayToken = observeProviderPointRawObjectIdentityV1(
      input.session,
      input.captured.payload,
    );
    expect(() =>
      captureProviderPointRawObservedDenseArrayV1(
        input.session,
        arrayToken,
        2,
      ),
    ).toThrow(TypeError);
    expect(ownKeysCalls).toBe(0);
  });

  it("rejects sparse/accessor/symbol/aliased observed arrays without getters", () => {
    const sparse = new Array(2) as unknown[];
    sparse[1] = "present";
    const sparseInput = preparePayload({ payload: sparse });
    const sparseToken = observeProviderPointRawObjectIdentityV1(
      sparseInput.session,
      sparseInput.captured.payload,
    );
    expect(() =>
      captureProviderPointRawObservedDenseArrayV1(
        sparseInput.session,
        sparseToken,
        2,
      ),
    ).toThrow(TypeError);

    let getterCalls = 0;
    const accessor: unknown[] = [];
    Object.defineProperty(accessor, "0", {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return "unreachable";
      },
    });
    const accessorInput = preparePayload({ payload: accessor });
    const accessorToken = observeProviderPointRawObjectIdentityV1(
      accessorInput.session,
      accessorInput.captured.payload,
    );
    expect(() =>
      captureProviderPointRawObservedDenseArrayV1(
        accessorInput.session,
        accessorToken,
        1,
      ),
    ).toThrow(TypeError);
    expect(getterCalls).toBe(0);

    const symbolic = ["present"];
    Object.defineProperty(symbolic, Symbol("hostile"), {
      value: true,
      enumerable: true,
    });
    const symbolInput = preparePayload({ payload: symbolic });
    const symbolToken = observeProviderPointRawObjectIdentityV1(
      symbolInput.session,
      symbolInput.captured.payload,
    );
    expect(() =>
      captureProviderPointRawObservedDenseArrayV1(
        symbolInput.session,
        symbolToken,
        1,
      ),
    ).toThrow(TypeError);

    const shared = { id: "same" };
    const aliasInput = preparePayload({ payload: [shared, shared] });
    const aliasToken = observeProviderPointRawObjectIdentityV1(
      aliasInput.session,
      aliasInput.captured.payload,
    );
    expect(() =>
      captureProviderPointRawObservedDenseArrayV1(
        aliasInput.session,
        aliasToken,
        2,
      ),
    ).toThrow(TypeError);
  });

  it("supports a shared preflight session and pre-observed work tokens", () => {
    const input = {
      inherited: { source: { id: "source-1" } },
      universe: { payload: { target: { id: "target-1" } } },
    };
    const session = createProviderPointRawAdmissionSessionV1(input);
    const top = captureProviderPointRawExactTopLevelV1(
      session,
      UNIVERSE_AND_INHERITED_KEYS,
    );
    const universeToken = observeProviderPointRawObjectIdentityV1(
      session,
      top.universe,
    );
    const universe = captureProviderPointRawObservedExactDataObjectV1(
      session,
      universeToken,
      UNIVERSE_KEYS,
    );
    const payloadToken = observeProviderPointRawObjectIdentityV1(
      session,
      universe.payload,
    );
    const payload = captureProviderPointRawObservedExactDataObjectV1(
      session,
      payloadToken,
      UNIVERSE_PAYLOAD_KEYS,
    );
    const targetToken = observeProviderPointRawObjectIdentityV1(
      session,
      payload.target,
    );
    walkProviderPointRawObservedJsonIdentityTreeV1(session, targetToken);
    walkProviderPointRawJsonIdentityTreeV1(session, top.inherited);
    expect(() => cloneProviderPointRawAdmissionCapsuleV1(session)).not.toThrow();

    // WeakSet state is per session: the same caller tree may be admitted by an
    // independent request, but never twice within one request.
    const second = createProviderPointRawAdmissionSessionV1(input);
    const secondTop = captureProviderPointRawExactTopLevelV1(
      second,
      UNIVERSE_AND_INHERITED_KEYS,
    );
    expect(() =>
      walkProviderPointRawJsonIdentityTreeV1(second, secondTop.inherited),
    ).not.toThrow();
  });

  it("rejects a Universe-to-inherited cross-block binding alias", () => {
    const shared = { id: "same-identity" };
    const input = {
      inherited: { target: shared },
      universe: { payload: { target: shared } },
    };
    const session = createProviderPointRawAdmissionSessionV1(input);
    const top = captureProviderPointRawExactTopLevelV1(
      session,
      UNIVERSE_AND_INHERITED_KEYS,
    );
    const universeToken = observeProviderPointRawObjectIdentityV1(
      session,
      top.universe,
    );
    const universe = captureProviderPointRawObservedExactDataObjectV1(
      session,
      universeToken,
      UNIVERSE_KEYS,
    );
    const payloadToken = observeProviderPointRawObjectIdentityV1(
      session,
      universe.payload,
    );
    const payload = captureProviderPointRawObservedExactDataObjectV1(
      session,
      payloadToken,
      UNIVERSE_PAYLOAD_KEYS,
    );
    const sharedToken = observeProviderPointRawObjectIdentityV1(
      session,
      payload.target,
    );
    walkProviderPointRawObservedJsonIdentityTreeV1(session, sharedToken);
    expect(() =>
      walkProviderPointRawJsonIdentityTreeV1(session, top.inherited),
    ).toThrow(TypeError);
  });

  it("deep-detaches caller mutation and freezes only selected JSON fields", () => {
    const capability = { opaque: true };
    const input = {
      capability,
      json: { nested: [{ value: "before" }] },
    };
    const session = createProviderPointRawAdmissionSessionV1(input);
    const captured = captureProviderPointRawExactTopLevelV1(
      session,
      JSON_AND_CAPABILITY_KEYS,
    );
    walkProviderPointRawJsonIdentityTreeV1(session, captured.json);
    const clonedInput = cloneProviderPointRawAdmissionCapsuleV1(session);
    expect(
      getProviderPointRawAdmissionCloneAttemptCountForTestV1(session),
    ).toBe(1);
    const detached = captureProviderPointDetachedExactDataObjectV1(
      clonedInput,
      JSON_AND_CAPABILITY_KEYS,
    );
    const detachedJson = deepFreezeProviderPointDetachedDataTreeV1(
      detached.json,
    ) as { nested: Array<{ value: string }> };

    input.json.nested[0]!.value = "after";
    expect(detachedJson.nested[0]!.value).toBe("before");
    expect(Object.isFrozen(detachedJson)).toBe(true);
    expect(Object.isFrozen(detachedJson.nested)).toBe(true);
    expect(Object.isFrozen(detachedJson.nested[0])).toBe(true);
    expect(Object.isFrozen(capability)).toBe(false);
    expect(detached.capability).not.toBe(capability);
  });

  it("uses exactly one trusted request clone and consumes the session", () => {
    const { session, captured } = preparePayload({
      payload: { accepted: true },
    });
    walkProviderPointRawJsonIdentityTreeV1(session, captured.payload);
    expect(
      getProviderPointRawAdmissionCloneAttemptCountForTestV1(session),
    ).toBe(0);
    cloneProviderPointRawAdmissionCapsuleV1(session);
    expect(
      getProviderPointRawAdmissionCloneAttemptCountForTestV1(session),
    ).toBe(1);
    expect(() => cloneProviderPointRawAdmissionCapsuleV1(session)).toThrow(
      TypeError,
    );
    expect(
      getProviderPointRawAdmissionCloneAttemptCountForTestV1(session),
    ).toBe(1);
  });

  it("applies scoped identity and allocation-work caps without changing the default path", () => {
    const defaultInput = { payload: { accepted: true } };
    const defaultSession = createProviderPointRawAdmissionSessionV1(defaultInput);
    const defaultCaptured = captureProviderPointRawExactTopLevelV1(
      defaultSession,
      PAYLOAD_KEYS,
    );
    walkProviderPointRawJsonIdentityTreeV1(
      defaultSession,
      defaultCaptured.payload,
    );
    expect(
      getProviderPointRawAdmissionAllocationLedgerForTestV1(defaultSession),
    ).toEqual({
      scoped: false,
      maxObservedIdentities: undefined,
      maxPrecloneAllocationWorkUnits: undefined,
      observedIdentityCount: 2,
      precloneAllocationWorkUnitCount: 0,
      remainingPrecloneAllocationWorkUnits: undefined,
      cloneAttemptCount: 0,
      lastDenseArrayLength: undefined,
      lastDenseArrayMaxLength: undefined,
      lastDenseArrayLengthOverflow: undefined,
      testCapExerciseKind: undefined,
      testCapExerciseRelation: undefined,
      testCapExerciseLimit: undefined,
      testCapExerciseBefore: undefined,
      testCapExerciseCharge: undefined,
      testCapExerciseOverflow: undefined,
    });

    const exactInput = { payload: { accepted: true } };
    const exactSession = createProviderPointRawAdmissionSessionV1(exactInput, {
      maxObservedIdentities: 2,
      maxPrecloneAllocationWorkUnits: 76,
    });
    const exactCaptured = captureProviderPointRawExactTopLevelV1(
      exactSession,
      PAYLOAD_KEYS,
    );
    walkProviderPointRawJsonIdentityTreeV1(
      exactSession,
      exactCaptured.payload,
    );
    expect(
      getProviderPointRawAdmissionAllocationLedgerForTestV1(exactSession),
    ).toEqual({
      scoped: true,
      maxObservedIdentities: 2,
      maxPrecloneAllocationWorkUnits: 76,
      observedIdentityCount: 2,
      precloneAllocationWorkUnitCount: 76,
      remainingPrecloneAllocationWorkUnits: 0,
      cloneAttemptCount: 0,
      lastDenseArrayLength: undefined,
      lastDenseArrayMaxLength: undefined,
      lastDenseArrayLengthOverflow: undefined,
      testCapExerciseKind: undefined,
      testCapExerciseRelation: undefined,
      testCapExerciseLimit: undefined,
      testCapExerciseBefore: undefined,
      testCapExerciseCharge: undefined,
      testCapExerciseOverflow: undefined,
    });
    expect(() => cloneProviderPointRawAdmissionCapsuleV1(exactSession)).not.toThrow();
    expect(
      getProviderPointRawAdmissionCloneAttemptCountForTestV1(exactSession),
    ).toBe(1);

    const identityInput = { payload: { accepted: true } };
    const identitySession = createProviderPointRawAdmissionSessionV1(
      identityInput,
      {
        maxObservedIdentities: 1,
        maxPrecloneAllocationWorkUnits: 76,
      },
    );
    const identityCaptured = captureProviderPointRawExactTopLevelV1(
      identitySession,
      PAYLOAD_KEYS,
    );
    expect(() =>
      walkProviderPointRawJsonIdentityTreeV1(
        identitySession,
        identityCaptured.payload,
      ),
    ).toThrow(TypeError);
    expect(
      getProviderPointRawAdmissionAllocationLedgerForTestV1(identitySession),
    ).toMatchObject({
      observedIdentityCount: 1,
      precloneAllocationWorkUnitCount: 70,
      cloneAttemptCount: 0,
    });
    expect(() => cloneProviderPointRawAdmissionCapsuleV1(identitySession)).toThrow(
      TypeError,
    );
    expect(
      getProviderPointRawAdmissionCloneAttemptCountForTestV1(identitySession),
    ).toBe(0);

    const workInput = { payload: { accepted: true } };
    const workSession = createProviderPointRawAdmissionSessionV1(workInput, {
      maxObservedIdentities: 2,
      maxPrecloneAllocationWorkUnits: 75,
    });
    const workCaptured = captureProviderPointRawExactTopLevelV1(
      workSession,
      PAYLOAD_KEYS,
    );
    expect(() =>
      walkProviderPointRawJsonIdentityTreeV1(workSession, workCaptured.payload),
    ).toThrow(TypeError);
    expect(
      getProviderPointRawAdmissionAllocationLedgerForTestV1(workSession),
    ).toMatchObject({
      observedIdentityCount: 2,
      precloneAllocationWorkUnitCount: 75,
      remainingPrecloneAllocationWorkUnits: 0,
      cloneAttemptCount: 0,
    });
    expect(() => cloneProviderPointRawAdmissionCapsuleV1(workSession)).toThrow(
      TypeError,
    );
    expect(
      getProviderPointRawAdmissionCloneAttemptCountForTestV1(workSession),
    ).toBe(0);
  });

  it("charges dense indices and reserves the complete own-key set before iteration", () => {
    const exactInput = { payload: [true] };
    const exactSession = createProviderPointRawAdmissionSessionV1(exactInput, {
      maxObservedIdentities: 2,
      maxPrecloneAllocationWorkUnits: 78,
    });
    const exactCaptured = captureProviderPointRawExactTopLevelV1(
      exactSession,
      PAYLOAD_KEYS,
    );
    walkProviderPointRawJsonIdentityTreeV1(
      exactSession,
      exactCaptured.payload,
    );
    expect(
      getProviderPointRawAdmissionAllocationLedgerForTestV1(exactSession),
    ).toMatchObject({
      observedIdentityCount: 2,
      precloneAllocationWorkUnitCount: 78,
      remainingPrecloneAllocationWorkUnits: 0,
      cloneAttemptCount: 0,
    });

    let ownKeysCalls = 0;
    let indexDescriptorCalls = 0;
    const array = new Proxy([true], {
      ownKeys(target) {
        ownKeysCalls += 1;
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, key) {
        if (key === "0") indexDescriptorCalls += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const cappedInput = { payload: array };
    const cappedSession = createProviderPointRawAdmissionSessionV1(cappedInput, {
      maxObservedIdentities: 2,
      maxPrecloneAllocationWorkUnits: 77,
    });
    const cappedCaptured = captureProviderPointRawExactTopLevelV1(
      cappedSession,
      PAYLOAD_KEYS,
    );
    expect(() =>
      walkProviderPointRawJsonIdentityTreeV1(
        cappedSession,
        cappedCaptured.payload,
      ),
    ).toThrow(TypeError);
    expect(ownKeysCalls).toBe(1);
    expect(indexDescriptorCalls).toBe(0);
    expect(
      getProviderPointRawAdmissionAllocationLedgerForTestV1(cappedSession),
    ).toMatchObject({
      precloneAllocationWorkUnitCount: 76,
      remainingPrecloneAllocationWorkUnits: 1,
      cloneAttemptCount: 0,
    });
    expect(() => cloneProviderPointRawAdmissionCapsuleV1(cappedSession)).toThrow(
      TypeError,
    );
  });

  it("resists post-import primordial pollution and restores exact descriptors", () => {
    const input = { payload: { items: [{ value: "stable" }] } };
    const objectValueDescriptor = Object.getOwnPropertyDescriptor(
      Object.prototype,
      "value",
    );
    const arrayPushDescriptor = Object.getOwnPropertyDescriptor(
      Array.prototype,
      "push",
    );
    const arrayZeroDescriptor = Object.getOwnPropertyDescriptor(
      Array.prototype,
      "0",
    );
    const cloneDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "structuredClone",
    );
    let objectMetaGetterCalls = 0;
    let arrayPushCalls = 0;
    let arraySetterCalls = 0;
    let replacedCloneCalls = 0;
    let admitted = false;
    let frozen = false;
    let failure: unknown;
    const arrayZeroPoisonDescriptor = Object.create(
      null,
    ) as PropertyDescriptor;
    Reflect.set(arrayZeroPoisonDescriptor, "configurable", true);
    Reflect.set(arrayZeroPoisonDescriptor, "set", () => {
      arraySetterCalls += 1;
      throw new Error("poisoned Array.prototype numeric setter");
    });

    try {
      Object.defineProperty(Object.prototype, "value", {
        configurable: true,
        get() {
          objectMetaGetterCalls += 1;
          throw new Error("poisoned Object.prototype.value");
        },
      });
      Object.defineProperty(Array.prototype, "push", {
        configurable: true,
        writable: true,
        value() {
          arrayPushCalls += 1;
          throw new Error("poisoned Array.prototype.push");
        },
      });
      Object.defineProperty(
        Array.prototype,
        "0",
        arrayZeroPoisonDescriptor,
      );
      Object.defineProperty(globalThis, "structuredClone", {
        configurable: cloneDescriptor?.configurable ?? true,
        enumerable: cloneDescriptor?.enumerable ?? true,
        writable: cloneDescriptor === undefined || "writable" in cloneDescriptor
          ? cloneDescriptor?.writable ?? true
          : true,
        value() {
          replacedCloneCalls += 1;
          throw new Error("late-bound structuredClone was used");
        },
      });

      const session = createProviderPointRawAdmissionSessionV1(input);
      const captured = captureProviderPointRawExactTopLevelV1(
        session,
        PAYLOAD_KEYS,
      );
      walkProviderPointRawJsonIdentityTreeV1(session, captured.payload);
      const cloned = cloneProviderPointRawAdmissionCapsuleV1(session);
      const detached = captureProviderPointDetachedExactDataObjectV1(
        cloned,
        PAYLOAD_KEYS,
      );
      deepFreezeProviderPointDetachedDataTreeV1(detached.payload);
      admitted = true;
      frozen = Object.isFrozen(detached.payload);
    } catch (error) {
      failure = error;
    } finally {
      restoreExactDescriptor(globalThis, "structuredClone", cloneDescriptor);
      restoreExactDescriptor(Array.prototype, "0", arrayZeroDescriptor);
      restoreExactDescriptor(Array.prototype, "push", arrayPushDescriptor);
      restoreExactDescriptor(
        Object.prototype,
        "value",
        objectValueDescriptor,
      );
    }

    expect(failure).toBeUndefined();
    expect(admitted).toBe(true);
    expect(frozen).toBe(true);
    expect(objectMetaGetterCalls).toBe(0);
    expect(arrayPushCalls).toBe(0);
    expect(arraySetterCalls).toBe(0);
    expect(replacedCloneCalls).toBe(0);
    expect(
      Object.getOwnPropertyDescriptor(globalThis, "structuredClone"),
    ).toEqual(cloneDescriptor);
    expect(Object.getOwnPropertyDescriptor(Array.prototype, "0")).toEqual(
      arrayZeroDescriptor,
    );
    expect(Object.getOwnPropertyDescriptor(Array.prototype, "push")).toEqual(
      arrayPushDescriptor,
    );
    expect(Object.getOwnPropertyDescriptor(Object.prototype, "value")).toEqual(
      objectValueDescriptor,
    );
  });

  it("records observed string and dense-length boundary attempts without changing counters", () => {
    const equalInput = { payload: { "": "x".repeat(5) } };
    const equalSession = createProviderPointRawAdmissionSessionV1(equalInput, {
      maxObservedIdentities: 2,
      maxPrecloneAllocationWorkUnits: 128,
    });
    const equalTop = captureProviderPointRawExactTopLevelV1(
      equalSession,
      PAYLOAD_KEYS,
    );
    const equalBudget =
      createProviderPointRawAdmissionBudgetForSessionObservedForTestV1(
        equalSession,
        2,
        2,
        5,
        5,
      );
    expect(() =>
      walkProviderPointRawJsonIdentityTreeV1(
        equalSession,
        equalTop.payload,
        equalBudget,
      ),
    ).not.toThrow();
    expect(getProviderPointRawAdmissionBudgetLedgerForTestV1(equalBudget)).toMatchObject({
      maxStringCodeUnits: 5,
      maxTotalStringCodeUnits: 5,
      totalStringCodeUnits: 5,
      lastStringChargeBefore: 0,
      lastStringChargeUnits: 5,
      lastStringChargeOverflow: false,
    });

    const overflowInput = { payload: { "": "x".repeat(6) } };
    const overflowSession = createProviderPointRawAdmissionSessionV1(
      overflowInput,
      {
        maxObservedIdentities: 2,
        maxPrecloneAllocationWorkUnits: 128,
      },
    );
    const overflowTop = captureProviderPointRawExactTopLevelV1(
      overflowSession,
      PAYLOAD_KEYS,
    );
    const overflowBudget =
      createProviderPointRawAdmissionBudgetForSessionObservedForTestV1(
        overflowSession,
        2,
        2,
        5,
        5,
      );
    expect(() =>
      walkProviderPointRawJsonIdentityTreeV1(
        overflowSession,
        overflowTop.payload,
        overflowBudget,
      ),
    ).toThrow(TypeError);
    expect(
      getProviderPointRawAdmissionBudgetLedgerForTestV1(overflowBudget),
    ).toMatchObject({
      totalStringCodeUnits: 0,
      lastStringChargeBefore: 0,
      lastStringChargeUnits: 6,
      lastStringChargeOverflow: true,
    });

    const denseInput = { payload: [null, null] };
    const denseSession = createProviderPointRawAdmissionSessionV1(denseInput, {
      maxObservedIdentities: 2,
      maxPrecloneAllocationWorkUnits: 128,
    });
    const denseTop = captureProviderPointRawExactTopLevelV1(
      denseSession,
      PAYLOAD_KEYS,
    );
    const denseToken = observeProviderPointRawObjectIdentityV1(
      denseSession,
      denseTop.payload,
    );
    expect(() =>
      captureProviderPointRawObservedDenseArrayV1(denseSession, denseToken, 1),
    ).toThrow(TypeError);
    expect(
      getProviderPointRawAdmissionAllocationLedgerForTestV1(denseSession),
    ).toMatchObject({
      lastDenseArrayLength: 2,
      lastDenseArrayMaxLength: 1,
      lastDenseArrayLengthOverflow: true,
      cloneAttemptCount: 0,
    });
  });

  it("exercises identity and work equality/plus-one through a strict one-shot seam", () => {
    const identityEqual = createProviderPointRawAdmissionSessionV1({}, {
      maxObservedIdentities: 2,
      maxPrecloneAllocationWorkUnits: 100,
    });
    expect(() =>
      exerciseProviderPointRawAdmissionAllocationCapForTestV1(
        identityEqual,
        "identities_c",
        "equal",
        2,
        100,
      ),
    ).not.toThrow();
    expect(() => cloneProviderPointRawAdmissionCapsuleV1(identityEqual)).not.toThrow();
    expect(
      getProviderPointRawAdmissionAllocationLedgerForTestV1(identityEqual),
    ).toMatchObject({
      observedIdentityCount: 2,
      cloneAttemptCount: 1,
      testCapExerciseKind: "identities_c",
      testCapExerciseBefore: 1,
      testCapExerciseCharge: 1,
      testCapExerciseOverflow: false,
    });

    const identityOverflow = createProviderPointRawAdmissionSessionV1({}, {
      maxObservedIdentities: 2,
      maxPrecloneAllocationWorkUnits: 100,
    });
    expect(() =>
      exerciseProviderPointRawAdmissionAllocationCapForTestV1(
        identityOverflow,
        "identities_c",
        "plus_one",
        2,
        100,
      ),
    ).toThrow(TypeError);
    expect(
      getProviderPointRawAdmissionAllocationLedgerForTestV1(identityOverflow),
    ).toMatchObject({
      observedIdentityCount: 2,
      cloneAttemptCount: 0,
      testCapExerciseBefore: 2,
      testCapExerciseOverflow: true,
    });
    expect(() =>
      exerciseProviderPointRawAdmissionAllocationCapForTestV1(
        identityOverflow,
        "identities_c",
        "plus_one",
        2,
        100,
      ),
    ).toThrow(TypeError);

    for (const relation of ["equal", "plus_one"] as const) {
      const session = createProviderPointRawAdmissionSessionV1({}, {
        maxObservedIdentities: 2,
        maxPrecloneAllocationWorkUnits: 100,
      });
      const exercise = () =>
        exerciseProviderPointRawAdmissionAllocationCapForTestV1(
          session,
          "work_w",
          relation,
          2,
          100,
        );
      if (relation === "equal") expect(exercise).not.toThrow();
      else expect(exercise).toThrow(TypeError);
      if (relation === "equal") {
        expect(() => cloneProviderPointRawAdmissionCapsuleV1(session)).not.toThrow();
      }
      expect(
        getProviderPointRawAdmissionAllocationLedgerForTestV1(session),
      ).toMatchObject({
        precloneAllocationWorkUnitCount: 100,
        remainingPrecloneAllocationWorkUnits: 0,
        cloneAttemptCount: relation === "equal" ? 1 : 0,
        testCapExerciseKind: "work_w",
        testCapExerciseRelation: relation,
        testCapExerciseBefore: relation === "equal" ? 99 : 100,
        testCapExerciseCharge: 1,
        testCapExerciseOverflow: relation === "plus_one",
      });
    }
  });

  it("probes deep detach, shared alias memoization, and Proxy DataCloneError", () => {
    expect(isProviderPointStructuredCloneBootstrapConformantV1()).toBe(true);
    expect(
      probeProviderPointStructuredCloneCandidateForTestV1(structuredClone),
    ).toBe(true);
    expect(probeProviderPointStructuredCloneCandidateForTestV1(undefined)).toBe(
      false,
    );
    expect(
      probeProviderPointStructuredCloneCandidateForTestV1(
        (value: unknown) => value,
      ),
    ).toBe(false);
    expect(
      probeProviderPointStructuredCloneCandidateForTestV1(() => ({
        originalInput: { child: { marker: "before" } },
        observedIdentities: { 0: { marker: "before" } },
      })),
    ).toBe(false);
  });
});
