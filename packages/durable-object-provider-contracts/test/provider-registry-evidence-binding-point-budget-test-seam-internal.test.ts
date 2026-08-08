import { describe, expect, it } from "vitest";

import {
  completeProviderRegistryEvidenceBindingBudgetReplayForTestV1,
  discardProviderRegistryEvidenceBindingBudgetReplayForTestV1,
  hasPendingProviderRegistryEvidenceBindingBudgetReplayForTestV1,
  readProviderRegistryEvidenceBindingBudgetRecipeForTestV1,
  recordProviderRegistryEvidenceBindingStringBudgetForTestV1,
  registerProviderRegistryEvidenceBindingBudgetReplayForTestV1,
  takeProviderRegistryEvidenceBindingBudgetReplayForTestV1,
  takeProviderRegistryEvidenceBindingBudgetReplayResultForTestV1,
  type ProviderRegistryEvidenceBindingBudgetAllocationLedgerForTestV1,
} from "../src/provider-registry-evidence-binding-point-budget-test-seam-internal.js";

const allocationLedger = Object.freeze({
  scoped: true,
  maxObservedIdentities: 10,
  maxPrecloneAllocationWorkUnits: 100,
  observedIdentityCount: 2,
  precloneAllocationWorkUnitCount: 80,
  remainingPrecloneAllocationWorkUnits: 20,
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
}) satisfies ProviderRegistryEvidenceBindingBudgetAllocationLedgerForTestV1;

const stringLedger = Object.freeze({
  maxDepth: 2,
  maxNodes: 5,
  maxStringCodeUnits: 5,
  maxTotalStringCodeUnits: 5,
  nodeCount: 2,
  totalStringCodeUnits: 5,
  lastStringChargeBefore: 0,
  lastStringChargeUnits: 5,
  lastStringChargeOverflow: false,
});

describe("C09-1L request-bound budget replay seam", () => {
  it("takes request and result independently once and rejects duplicate registration", () => {
    const request = {};
    const recipe = { budget: "value_b", relation: "equal" } as const;
    registerProviderRegistryEvidenceBindingBudgetReplayForTestV1(request, recipe);
    expect(
      hasPendingProviderRegistryEvidenceBindingBudgetReplayForTestV1(request),
    ).toBe(true);
    expect(() =>
      registerProviderRegistryEvidenceBindingBudgetReplayForTestV1(
        request,
        recipe,
      ),
    ).toThrow(TypeError);

    const token =
      takeProviderRegistryEvidenceBindingBudgetReplayForTestV1(request);
    expect(token).toBeDefined();
    expect(
      takeProviderRegistryEvidenceBindingBudgetReplayForTestV1(request),
    ).toBeUndefined();
    expect(readProviderRegistryEvidenceBindingBudgetRecipeForTestV1(token!)).toEqual(
      recipe,
    );
    recordProviderRegistryEvidenceBindingStringBudgetForTestV1(
      token!,
      stringLedger,
    );
    expect(() =>
      recordProviderRegistryEvidenceBindingStringBudgetForTestV1(
        token!,
        stringLedger,
      ),
    ).toThrow(TypeError);
    completeProviderRegistryEvidenceBindingBudgetReplayForTestV1(
      token!,
      allocationLedger,
    );
    expect(() =>
      completeProviderRegistryEvidenceBindingBudgetReplayForTestV1(
        token!,
        allocationLedger,
      ),
    ).toThrow(TypeError);
    const result =
      takeProviderRegistryEvidenceBindingBudgetReplayResultForTestV1(request);
    expect(Object.getPrototypeOf(result)).toBe(null);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result).toMatchObject({ recipe, stringBudgetLedger: stringLedger });
    expect(
      takeProviderRegistryEvidenceBindingBudgetReplayResultForTestV1(request),
    ).toBeUndefined();
  });

  it("cleans an unconsumed failure and cannot revive the identity", () => {
    const request = {};
    registerProviderRegistryEvidenceBindingBudgetReplayForTestV1(request, {
      budget: "history_count",
      relation: "plus_one",
    });
    expect(
      discardProviderRegistryEvidenceBindingBudgetReplayForTestV1(request),
    ).toBe(true);
    expect(
      discardProviderRegistryEvidenceBindingBudgetReplayForTestV1(request),
    ).toBe(false);
    expect(
      takeProviderRegistryEvidenceBindingBudgetReplayForTestV1(request),
    ).toBeUndefined();
    expect(() =>
      registerProviderRegistryEvidenceBindingBudgetReplayForTestV1(request, {
        budget: "history_count",
        relation: "plus_one",
      }),
    ).toThrow(TypeError);
  });

  it("keeps concurrent request identities isolated when completion order reverses", () => {
    const first = {};
    const second = {};
    registerProviderRegistryEvidenceBindingBudgetReplayForTestV1(first, {
      budget: "identities_c",
      relation: "equal",
    });
    registerProviderRegistryEvidenceBindingBudgetReplayForTestV1(second, {
      budget: "work_w",
      relation: "plus_one",
    });
    const firstToken =
      takeProviderRegistryEvidenceBindingBudgetReplayForTestV1(first)!;
    const secondToken =
      takeProviderRegistryEvidenceBindingBudgetReplayForTestV1(second)!;
    completeProviderRegistryEvidenceBindingBudgetReplayForTestV1(
      secondToken,
      allocationLedger,
    );
    completeProviderRegistryEvidenceBindingBudgetReplayForTestV1(
      firstToken,
      allocationLedger,
    );
    expect(
      takeProviderRegistryEvidenceBindingBudgetReplayResultForTestV1(first)
        ?.recipe,
    ).toEqual({ budget: "identities_c", relation: "equal" });
    expect(
      takeProviderRegistryEvidenceBindingBudgetReplayResultForTestV1(second)
        ?.recipe,
    ).toEqual({ budget: "work_w", relation: "plus_one" });
  });
});
