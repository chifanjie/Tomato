import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import {
  takeProviderRegistryEvidenceBindingBudgetReplayResultForTestV1,
  type ProviderRegistryEvidenceBindingBudgetRecipeForTestV1,
} from "../src/provider-registry-evidence-binding-point-budget-test-seam-internal.js";
import {
  materializeProviderRegistryEvidenceBindingBudgetWitnessInternalV1,
  takeAndVerifyProviderRegistryEvidenceBindingBudgetReplayInternalV1,
} from "../src/provider-registry-evidence-binding-point-budget-witness-internal.js";
import type { ValidateProviderRegistryEvidenceBindingPointClosureV1Input } from "../src/provider-registry-evidence-binding-point.js";
import {
  diagnoseProviderRegistryEvidenceBindingPointClosureV1,
} from "../src/provider-registry-evidence-binding-point.js";
import {
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  attestProviderStrictEd25519CryptoHostV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "../src/strict-ed25519-conformance.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "../src/strict-ed25519.js";

interface EvidenceBindingGoldenV1 {
  readonly compatibleBase: Omit<
    ValidateProviderRegistryEvidenceBindingPointClosureV1Input,
    "strictCryptoCapability"
  >;
  readonly expected: {
    readonly completeCryptoClosure: {
      readonly pointAdmissionCount: number;
      readonly signatureVerificationCount: number;
    };
  };
}

function resourceBytes(relativePath: string): Uint8Array {
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url))),
  );
}

const golden = JSON.parse(
  new TextDecoder().decode(
    resourceBytes(
      "fixtures/v1/golden/provider-registry-evidence-binding-point-v1.json",
    ),
  ),
) as EvidenceBindingGoldenV1;
const strictManifestBytes = resourceBytes(
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
);

const recipes = [
  { budget: "value_b", relation: "equal" },
  { budget: "value_b", relation: "plus_one" },
  { budget: "key_b", relation: "equal" },
  { budget: "key_b", relation: "plus_one" },
  { budget: "history_bh", relation: "equal" },
  { budget: "history_bh", relation: "plus_one" },
  { budget: "history_count", relation: "plus_one" },
  { budget: "identities_c", relation: "equal" },
  { budget: "identities_c", relation: "plus_one" },
  { budget: "work_w", relation: "equal" },
  { budget: "work_w", relation: "plus_one" },
] as const satisfies readonly ProviderRegistryEvidenceBindingBudgetRecipeForTestV1[];

interface RawBudgetReplayKatCaseV1 {
  readonly recipe: ProviderRegistryEvidenceBindingBudgetRecipeForTestV1;
  readonly stringBudgetLedger:
    | undefined
    | Readonly<{
        maxStringCodeUnits: number;
        maxTotalStringCodeUnits: number;
        totalStringCodeUnits: number;
        lastStringChargeBefore: number;
        lastStringChargeUnits: number;
        lastStringChargeOverflow: boolean;
      }>;
  readonly allocationLedger: Readonly<{
    scoped: true;
    maxObservedIdentities: number;
    maxPrecloneAllocationWorkUnits: number;
    cloneAttemptCount: 0 | 1;
    lastDenseArrayLength?: number | undefined;
    lastDenseArrayMaxLength?: number | undefined;
    lastDenseArrayLengthOverflow?: boolean | undefined;
    observedIdentityCount?: number;
    precloneAllocationWorkUnitCount?: number;
    remainingPrecloneAllocationWorkUnits?: number;
    testCapExerciseKind?: "identities_c" | "work_w" | undefined;
    testCapExerciseRelation?: "equal" | "plus_one" | undefined;
    testCapExerciseLimit?: number;
    testCapExerciseBefore?: number;
    testCapExerciseCharge?: number;
    testCapExerciseOverflow?: boolean;
  }>;
  readonly outcome:
    | Readonly<{
        kind: "accepted";
        pointAdmissionCount: 24;
        signatureVerificationCount: 46;
      }>
    | Readonly<{
        kind: "diagnostic";
        stage: "input";
        reason: "schema_invalid";
        pointAdmissionCount: 0;
        signatureVerificationCount: 0;
      }>;
}

const RAW_BUDGET_REPLAY_KAT_CASES_V1 = [
  {
    recipe: { budget: "value_b", relation: "equal" },
    stringBudgetLedger: {
      maxStringCodeUnits: 4_194_304,
      maxTotalStringCodeUnits: 4_194_304,
      totalStringCodeUnits: 4_194_304,
      lastStringChargeBefore: 0,
      lastStringChargeUnits: 4_194_304,
      lastStringChargeOverflow: false,
    },
    allocationLedger: {
      scoped: true,
      maxObservedIdentities: 4_194_304,
      maxPrecloneAllocationWorkUnits: 268_435_456,
      cloneAttemptCount: 0,
      testCapExerciseKind: undefined,
      testCapExerciseRelation: undefined,
    },
    outcome: {
      kind: "diagnostic",
      stage: "input",
      reason: "schema_invalid",
      pointAdmissionCount: 0,
      signatureVerificationCount: 0,
    },
  },
  {
    recipe: { budget: "value_b", relation: "plus_one" },
    stringBudgetLedger: {
      maxStringCodeUnits: 4_194_304,
      maxTotalStringCodeUnits: 4_194_304,
      totalStringCodeUnits: 0,
      lastStringChargeBefore: 0,
      lastStringChargeUnits: 4_194_305,
      lastStringChargeOverflow: true,
    },
    allocationLedger: {
      scoped: true,
      maxObservedIdentities: 4_194_304,
      maxPrecloneAllocationWorkUnits: 268_435_456,
      cloneAttemptCount: 0,
      testCapExerciseKind: undefined,
      testCapExerciseRelation: undefined,
    },
    outcome: {
      kind: "diagnostic",
      stage: "input",
      reason: "schema_invalid",
      pointAdmissionCount: 0,
      signatureVerificationCount: 0,
    },
  },
  {
    recipe: { budget: "key_b", relation: "equal" },
    stringBudgetLedger: {
      maxStringCodeUnits: 4_194_304,
      maxTotalStringCodeUnits: 4_194_304,
      totalStringCodeUnits: 4_194_304,
      lastStringChargeBefore: 0,
      lastStringChargeUnits: 4_194_304,
      lastStringChargeOverflow: false,
    },
    allocationLedger: {
      scoped: true,
      maxObservedIdentities: 4_194_304,
      maxPrecloneAllocationWorkUnits: 268_435_456,
      cloneAttemptCount: 0,
      testCapExerciseKind: undefined,
      testCapExerciseRelation: undefined,
    },
    outcome: {
      kind: "diagnostic",
      stage: "input",
      reason: "schema_invalid",
      pointAdmissionCount: 0,
      signatureVerificationCount: 0,
    },
  },
  {
    recipe: { budget: "key_b", relation: "plus_one" },
    stringBudgetLedger: {
      maxStringCodeUnits: 4_194_304,
      maxTotalStringCodeUnits: 4_194_304,
      totalStringCodeUnits: 0,
      lastStringChargeBefore: 0,
      lastStringChargeUnits: 4_194_305,
      lastStringChargeOverflow: true,
    },
    allocationLedger: {
      scoped: true,
      maxObservedIdentities: 4_194_304,
      maxPrecloneAllocationWorkUnits: 268_435_456,
      cloneAttemptCount: 0,
      testCapExerciseKind: undefined,
      testCapExerciseRelation: undefined,
    },
    outcome: {
      kind: "diagnostic",
      stage: "input",
      reason: "schema_invalid",
      pointAdmissionCount: 0,
      signatureVerificationCount: 0,
    },
  },
  {
    recipe: { budget: "history_bh", relation: "equal" },
    stringBudgetLedger: {
      maxStringCodeUnits: 268_435_456,
      maxTotalStringCodeUnits: 268_435_456,
      totalStringCodeUnits: 268_435_456,
      lastStringChargeBefore: 268_370_105,
      lastStringChargeUnits: 65_351,
      lastStringChargeOverflow: false,
    },
    allocationLedger: {
      scoped: true,
      maxObservedIdentities: 4_194_304,
      maxPrecloneAllocationWorkUnits: 268_435_456,
      cloneAttemptCount: 0,
      testCapExerciseKind: undefined,
      testCapExerciseRelation: undefined,
    },
    outcome: {
      kind: "diagnostic",
      stage: "input",
      reason: "schema_invalid",
      pointAdmissionCount: 0,
      signatureVerificationCount: 0,
    },
  },
  {
    recipe: { budget: "history_bh", relation: "plus_one" },
    stringBudgetLedger: {
      maxStringCodeUnits: 268_435_456,
      maxTotalStringCodeUnits: 268_435_456,
      totalStringCodeUnits: 268_370_105,
      lastStringChargeBefore: 268_370_105,
      lastStringChargeUnits: 65_352,
      lastStringChargeOverflow: true,
    },
    allocationLedger: {
      scoped: true,
      maxObservedIdentities: 4_194_304,
      maxPrecloneAllocationWorkUnits: 268_435_456,
      cloneAttemptCount: 0,
      testCapExerciseKind: undefined,
      testCapExerciseRelation: undefined,
    },
    outcome: {
      kind: "diagnostic",
      stage: "input",
      reason: "schema_invalid",
      pointAdmissionCount: 0,
      signatureVerificationCount: 0,
    },
  },
  {
    recipe: { budget: "history_count", relation: "plus_one" },
    stringBudgetLedger: undefined,
    allocationLedger: {
      scoped: true,
      maxObservedIdentities: 4_194_304,
      maxPrecloneAllocationWorkUnits: 268_435_456,
      cloneAttemptCount: 0,
      lastDenseArrayLength: 4_097,
      lastDenseArrayMaxLength: 4_096,
      lastDenseArrayLengthOverflow: true,
      testCapExerciseKind: undefined,
      testCapExerciseRelation: undefined,
    },
    outcome: {
      kind: "diagnostic",
      stage: "input",
      reason: "schema_invalid",
      pointAdmissionCount: 0,
      signatureVerificationCount: 0,
    },
  },
  {
    recipe: { budget: "identities_c", relation: "equal" },
    stringBudgetLedger: undefined,
    allocationLedger: {
      scoped: true,
      maxObservedIdentities: 4_194_304,
      maxPrecloneAllocationWorkUnits: 268_435_456,
      observedIdentityCount: 4_194_304,
      cloneAttemptCount: 1,
      testCapExerciseKind: "identities_c",
      testCapExerciseRelation: "equal",
      testCapExerciseLimit: 4_194_304,
      testCapExerciseBefore: 4_194_303,
      testCapExerciseCharge: 1,
      testCapExerciseOverflow: false,
    },
    outcome: {
      kind: "accepted",
      pointAdmissionCount: 24,
      signatureVerificationCount: 46,
    },
  },
  {
    recipe: { budget: "identities_c", relation: "plus_one" },
    stringBudgetLedger: undefined,
    allocationLedger: {
      scoped: true,
      maxObservedIdentities: 4_194_304,
      maxPrecloneAllocationWorkUnits: 268_435_456,
      observedIdentityCount: 4_194_304,
      cloneAttemptCount: 0,
      testCapExerciseKind: "identities_c",
      testCapExerciseRelation: "plus_one",
      testCapExerciseLimit: 4_194_304,
      testCapExerciseBefore: 4_194_304,
      testCapExerciseCharge: 1,
      testCapExerciseOverflow: true,
    },
    outcome: {
      kind: "diagnostic",
      stage: "input",
      reason: "schema_invalid",
      pointAdmissionCount: 0,
      signatureVerificationCount: 0,
    },
  },
  {
    recipe: { budget: "work_w", relation: "equal" },
    stringBudgetLedger: undefined,
    allocationLedger: {
      scoped: true,
      maxObservedIdentities: 4_194_304,
      maxPrecloneAllocationWorkUnits: 268_435_456,
      precloneAllocationWorkUnitCount: 268_435_456,
      remainingPrecloneAllocationWorkUnits: 0,
      cloneAttemptCount: 1,
      testCapExerciseKind: "work_w",
      testCapExerciseRelation: "equal",
      testCapExerciseLimit: 268_435_456,
      testCapExerciseBefore: 268_435_455,
      testCapExerciseCharge: 1,
      testCapExerciseOverflow: false,
    },
    outcome: {
      kind: "accepted",
      pointAdmissionCount: 24,
      signatureVerificationCount: 46,
    },
  },
  {
    recipe: { budget: "work_w", relation: "plus_one" },
    stringBudgetLedger: undefined,
    allocationLedger: {
      scoped: true,
      maxObservedIdentities: 4_194_304,
      maxPrecloneAllocationWorkUnits: 268_435_456,
      precloneAllocationWorkUnitCount: 268_435_456,
      remainingPrecloneAllocationWorkUnits: 0,
      cloneAttemptCount: 0,
      testCapExerciseKind: "work_w",
      testCapExerciseRelation: "plus_one",
      testCapExerciseLimit: 268_435_456,
      testCapExerciseBefore: 268_435_456,
      testCapExerciseCharge: 1,
      testCapExerciseOverflow: true,
    },
    outcome: {
      kind: "diagnostic",
      stage: "input",
      reason: "schema_invalid",
      pointAdmissionCount: 0,
      signatureVerificationCount: 0,
    },
  },
] as const satisfies readonly RawBudgetReplayKatCaseV1[];

interface BudgetManifestKatRowV1 {
  readonly caseId: string;
  readonly budget: ProviderRegistryEvidenceBindingBudgetRecipeForTestV1["budget"];
  readonly relation: ProviderRegistryEvidenceBindingBudgetRecipeForTestV1["relation"];
  readonly outcome: "accepted_snapshot" | "diagnostic";
  readonly stage: "input" | undefined;
  readonly reason: "schema_invalid" | undefined;
  readonly pointAdmissionCount: 0 | 24;
  readonly signatureVerificationCount: 0 | 46;
}

interface BudgetManifestProjectionInputV1 {
  readonly cases: readonly {
    readonly caseId: string;
    readonly mutation: {
      readonly witnessRecipe:
        | Readonly<{
            kind: "symbolic_budget";
            budget: ProviderRegistryEvidenceBindingBudgetRecipeForTestV1["budget"];
            relation: ProviderRegistryEvidenceBindingBudgetRecipeForTestV1["relation"];
          }>
        | Readonly<{ kind: "request_patch" | "execution_profile" }>;
    };
    readonly outerExpected:
      | Readonly<{
          kind: "diagnostic";
          stage: string;
          reason: string;
          pointAdmissionCount: number;
          signatureVerificationCount: number;
        }>
      | Readonly<{
          kind: "accepted_snapshot";
          pointAdmissionCount: number;
          signatureVerificationCount: number;
        }>;
  }[];
}

const BUDGET_MANIFEST_KAT_ROWS_V1 = [
  {
    caseId: "registry-history-count-cap-4097",
    budget: "history_count",
    relation: "plus_one",
    outcome: "diagnostic",
    stage: "input",
    reason: "schema_invalid",
    pointAdmissionCount: 0,
    signatureVerificationCount: 0,
  },
  {
    caseId: "registry-single-envelope-byte-cap",
    budget: "value_b",
    relation: "plus_one",
    outcome: "diagnostic",
    stage: "input",
    reason: "schema_invalid",
    pointAdmissionCount: 0,
    signatureVerificationCount: 0,
  },
  {
    caseId: "registry-total-history-byte-cap",
    budget: "history_bh",
    relation: "plus_one",
    outcome: "diagnostic",
    stage: "input",
    reason: "schema_invalid",
    pointAdmissionCount: 0,
    signatureVerificationCount: 0,
  },
  {
    caseId: "point-budget-value-b",
    budget: "value_b",
    relation: "equal",
    outcome: "diagnostic",
    stage: "input",
    reason: "schema_invalid",
    pointAdmissionCount: 0,
    signatureVerificationCount: 0,
  },
  {
    caseId: "point-budget-value-b-plus-one",
    budget: "value_b",
    relation: "plus_one",
    outcome: "diagnostic",
    stage: "input",
    reason: "schema_invalid",
    pointAdmissionCount: 0,
    signatureVerificationCount: 0,
  },
  {
    caseId: "point-budget-key-b",
    budget: "key_b",
    relation: "equal",
    outcome: "diagnostic",
    stage: "input",
    reason: "schema_invalid",
    pointAdmissionCount: 0,
    signatureVerificationCount: 0,
  },
  {
    caseId: "point-budget-key-b-plus-one",
    budget: "key_b",
    relation: "plus_one",
    outcome: "diagnostic",
    stage: "input",
    reason: "schema_invalid",
    pointAdmissionCount: 0,
    signatureVerificationCount: 0,
  },
  {
    caseId: "point-budget-history-bh",
    budget: "history_bh",
    relation: "equal",
    outcome: "diagnostic",
    stage: "input",
    reason: "schema_invalid",
    pointAdmissionCount: 0,
    signatureVerificationCount: 0,
  },
  {
    caseId: "point-budget-history-bh-plus-one",
    budget: "history_bh",
    relation: "plus_one",
    outcome: "diagnostic",
    stage: "input",
    reason: "schema_invalid",
    pointAdmissionCount: 0,
    signatureVerificationCount: 0,
  },
  {
    caseId: "point-budget-identities-c",
    budget: "identities_c",
    relation: "equal",
    outcome: "accepted_snapshot",
    stage: undefined,
    reason: undefined,
    pointAdmissionCount: 24,
    signatureVerificationCount: 46,
  },
  {
    caseId: "point-budget-identities-c-plus-one",
    budget: "identities_c",
    relation: "plus_one",
    outcome: "diagnostic",
    stage: "input",
    reason: "schema_invalid",
    pointAdmissionCount: 0,
    signatureVerificationCount: 0,
  },
  {
    caseId: "point-budget-work-w",
    budget: "work_w",
    relation: "equal",
    outcome: "accepted_snapshot",
    stage: undefined,
    reason: undefined,
    pointAdmissionCount: 24,
    signatureVerificationCount: 46,
  },
  {
    caseId: "point-budget-work-w-plus-one",
    budget: "work_w",
    relation: "plus_one",
    outcome: "diagnostic",
    stage: "input",
    reason: "schema_invalid",
    pointAdmissionCount: 0,
    signatureVerificationCount: 0,
  },
] as const satisfies readonly BudgetManifestKatRowV1[];

let capability: ProviderStrictEd25519OpaqueCapabilityV1;
let pointCalls = 0;
let signatureCalls = 0;

beforeAll(async () => {
  capability = await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint(encodedPoint: Uint8Array) {
        pointCalls += 1;
        return validatePrimeSubgroupPoint(encodedPoint);
      },
      async verifyRawEd25519(
        publicKey: Uint8Array,
        message: Uint8Array,
        signature: Uint8Array,
      ) {
        signatureCalls += 1;
        return verifyRawEd25519(publicKey, message, signature);
      },
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(path: string, maxBytes: number) {
        expect(path).toBe(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1);
        expect(maxBytes).toBe(PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1);
        return strictManifestBytes.slice();
      },
    }),
  });
});

describe("provider Registry Entry/Evidence binding compact budget witnesses", () => {
  it("replays every frozen boundary through production counters", async () => {
    for (const recipe of recipes) {
      pointCalls = 0;
      signatureCalls = 0;
      const baseRequest = {
        ...structuredClone(golden.compatibleBase),
        strictCryptoCapability: capability,
      };
      const prepared =
        materializeProviderRegistryEvidenceBindingBudgetWitnessInternalV1(
          baseRequest,
          recipe,
        );

      const diagnostic =
        await diagnoseProviderRegistryEvidenceBindingPointClosureV1(
          prepared.request,
        );
      expect(prepared.getterCalls(), `${recipe.budget}/${recipe.relation}`).toBe(
        0,
      );
      takeAndVerifyProviderRegistryEvidenceBindingBudgetReplayInternalV1(
        prepared.request,
        recipe,
      );

      const shouldAccept =
        recipe.relation === "equal" &&
        (recipe.budget === "identities_c" || recipe.budget === "work_w");
      if (shouldAccept) {
        expect(diagnostic.ok, `${recipe.budget}/${recipe.relation}`).toBe(true);
        expect(pointCalls).toBe(
          golden.expected.completeCryptoClosure.pointAdmissionCount,
        );
        expect(signatureCalls).toBe(
          golden.expected.completeCryptoClosure.signatureVerificationCount,
        );
      } else {
        expect(diagnostic.ok, `${recipe.budget}/${recipe.relation}`).toBe(false);
        if (diagnostic.ok) throw new TypeError("unreachable accepted budget witness");
        expect(diagnostic.stage).toBe("input");
        expect(diagnostic.reason).toBe("schema_invalid");
        expect(pointCalls).toBe(0);
        expect(signatureCalls).toBe(0);
      }
    }
  });

  it("independently pins all raw ledgers and outcomes without the shared verifier", async () => {
    expect(RAW_BUDGET_REPLAY_KAT_CASES_V1).toHaveLength(11);
    for (const katCase of RAW_BUDGET_REPLAY_KAT_CASES_V1) {
      const label = `${katCase.recipe.budget}/${katCase.recipe.relation}`;
      pointCalls = 0;
      signatureCalls = 0;
      const prepared =
        materializeProviderRegistryEvidenceBindingBudgetWitnessInternalV1(
          {
            ...structuredClone(golden.compatibleBase),
            strictCryptoCapability: capability,
          },
          katCase.recipe,
        );

      const diagnostic =
        await diagnoseProviderRegistryEvidenceBindingPointClosureV1(
          prepared.request,
        );
      const replayResult =
        takeProviderRegistryEvidenceBindingBudgetReplayResultForTestV1(
          prepared.request,
        );
      expect(replayResult, label).toBeDefined();
      if (replayResult === undefined) {
        throw new TypeError(`missing independent raw budget replay for ${label}`);
      }

      expect(prepared.getterCalls(), label).toBe(0);
      expect(Object.getPrototypeOf(replayResult), label).toBe(null);
      expect(Object.isFrozen(replayResult), label).toBe(true);
      expect(replayResult.recipe, label).toEqual(katCase.recipe);
      if (katCase.stringBudgetLedger === undefined) {
        expect(replayResult.stringBudgetLedger, label).toBeUndefined();
      } else {
        expect(replayResult.stringBudgetLedger, label).toMatchObject(
          katCase.stringBudgetLedger,
        );
        expect(Object.isFrozen(replayResult.stringBudgetLedger), label).toBe(
          true,
        );
      }
      expect(replayResult.allocationLedger, label).toMatchObject(
        katCase.allocationLedger,
      );
      expect(Object.isFrozen(replayResult.allocationLedger), label).toBe(true);
      expect(
        takeProviderRegistryEvidenceBindingBudgetReplayResultForTestV1(
          prepared.request,
        ),
        label,
      ).toBeUndefined();

      if (katCase.outcome.kind === "accepted") {
        expect(diagnostic.ok, label).toBe(true);
      } else {
        expect(diagnostic, label).toMatchObject({
          ok: false,
          stage: katCase.outcome.stage,
          reason: katCase.outcome.reason,
        });
      }
      expect(pointCalls, label).toBe(katCase.outcome.pointAdmissionCount);
      expect(signatureCalls, label).toBe(
        katCase.outcome.signatureVerificationCount,
      );
    }
  });

  it("independently pins the exact 13 budget case IDs and final outcomes", () => {
    const invalidManifest = JSON.parse(
      new TextDecoder().decode(
        resourceBytes(
          "fixtures/v1/invalid/provider-registry-evidence-binding-point-v1.json",
        ),
      ),
    ) as BudgetManifestProjectionInputV1;
    const actualRows = invalidManifest.cases.flatMap((invalidCase) => {
      const recipe = invalidCase.mutation.witnessRecipe;
      if (recipe.kind !== "symbolic_budget") return [];
      const outcome = invalidCase.outerExpected;
      return [
        {
          caseId: invalidCase.caseId,
          budget: recipe.budget,
          relation: recipe.relation,
          outcome: outcome.kind,
          stage: outcome.kind === "diagnostic" ? outcome.stage : undefined,
          reason: outcome.kind === "diagnostic" ? outcome.reason : undefined,
          pointAdmissionCount: outcome.pointAdmissionCount,
          signatureVerificationCount: outcome.signatureVerificationCount,
        },
      ];
    });

    expect(BUDGET_MANIFEST_KAT_ROWS_V1).toHaveLength(13);
    expect(actualRows).toEqual(BUDGET_MANIFEST_KAT_ROWS_V1);
    expect(new Set(actualRows.map((row) => row.caseId)).size).toBe(13);
  });

  it("uses captured primordials for the aggregate-history witness", async () => {
    const originalStringDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "String",
    );
    if (originalStringDescriptor === undefined) {
      throw new TypeError("global String descriptor is unavailable");
    }

    let poisonedStringCalls = 0;
    Object.defineProperty(globalThis, "String", {
      ...originalStringDescriptor,
      value() {
        poisonedStringCalls += 1;
        throw new TypeError("poisoned global String was called");
      },
    });

    let diagnostic:
      | Awaited<
          ReturnType<
            typeof diagnoseProviderRegistryEvidenceBindingPointClosureV1
          >
        >
      | undefined;
    let getterCalls = -1;
    try {
      pointCalls = 0;
      signatureCalls = 0;
      const recipe = { budget: "history_bh", relation: "equal" } as const;
      const prepared =
        materializeProviderRegistryEvidenceBindingBudgetWitnessInternalV1(
          {
            ...structuredClone(golden.compatibleBase),
            strictCryptoCapability: capability,
          },
          recipe,
        );
      diagnostic = await diagnoseProviderRegistryEvidenceBindingPointClosureV1(
        prepared.request,
      );
      getterCalls = prepared.getterCalls();
      takeAndVerifyProviderRegistryEvidenceBindingBudgetReplayInternalV1(
        prepared.request,
        recipe,
      );
    } finally {
      Object.defineProperty(globalThis, "String", originalStringDescriptor);
    }

    expect(getterCalls).toBe(0);
    expect(diagnostic).toMatchObject({
      ok: false,
      reason: "schema_invalid",
      stage: "input",
    });
    expect(pointCalls).toBe(0);
    expect(signatureCalls).toBe(0);
    expect(poisonedStringCalls).toBe(0);
  });

  it("contains no live String(index) or Object.freeze call sites", () => {
    const source = readFileSync(
      fileURLToPath(
        new URL(
          "../src/provider-registry-evidence-binding-point-budget-witness-internal.ts",
          import.meta.url,
        ),
      ),
      "utf8",
    );
    expect(source).not.toContain("String(index)");
    expect(source).not.toContain("Object.freeze(");
  });
});
