import { describe, expect, it } from "vitest";

import * as publicFacadeModuleV1 from "../src/provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationError,
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate.js";
import { ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema } from "../src/provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";

function digestV1(character: string) {
  return `sha256:${character.repeat(64)}` as const;
}

function requestV1() {
  return {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_request_reference_candidate_v1" as const,
    mode: "same_installation_identity" as const,
    reason: "provider_decommission" as const,
    admissionClass: "normal" as const,
    createdAt: "2026-08-15T00:00:00.000Z",
    migrationBudgets:
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema.parse(
        {
          profile:
            "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_budgets_reference_candidate_v1",
          maxRootEntries: 6,
          maxLiveObjects: 1,
          maxReferenceEdges: 1,
          maxRewriteObjects: 1,
          maxRewriteReferenceMappings: 1,
          maxRewriteSccs: 1,
          maxLogicalObjectBytesTotal: 100,
          maxProgressRecords: 9,
          maxProgressOperationReceipts: 1,
          maxCanonicalUniverseBytes: 1_000_000,
          maxCanonicalReferenceSetBytes: 1_000_000,
          maxCanonicalRewritePlanBytes: 1,
          maxCanonicalRewrittenReferenceSetBytesTotal: 1,
          maxCanonicalSemanticEquivalenceProofBytesTotal: 1,
          maxCanonicalRootRewriteProofSetBytes: 1,
          maxCanonicalZeroLiveProofBytes: 1,
          maxCanonicalReceiptBytesTotal: 1,
          maxCanonicalProgressRecordSetBytes: 1,
          maxCanonicalProgressOperationReceiptBytesTotal: 1,
          maxCanonicalMigrationBytesTotal: 4_194_304,
          maxRetainedMigrationHistoryLogicalBytesTotal: 4_194_304,
          maxRetainedMigrationHistoryProviderAllocatedBytesTotal: 8_388_608,
          maxSingleRecordBytes: 4_194_304,
        },
      ),
    liveReferenceSchemaDigest: digestV1("a"),
    migrationProtocolDigest: digestV1("b"),
  };
}

interface HardenedPromiseMethodsV1 {
  readonly constructor: unknown;
  readonly then: unknown;
  readonly catch: unknown;
  readonly finally: unknown;
}

function expectHardenedPromiseV1(
  promise: Promise<unknown>,
  expected?: HardenedPromiseMethodsV1,
): HardenedPromiseMethodsV1 {
  expect(Object.isFrozen(promise)).toBe(true);
  const methods = {
    constructor: Object.getOwnPropertyDescriptor(promise, "constructor")?.value,
    then: Object.getOwnPropertyDescriptor(promise, "then")?.value,
    catch: Object.getOwnPropertyDescriptor(promise, "catch")?.value,
    finally: Object.getOwnPropertyDescriptor(promise, "finally")?.value,
  };
  for (const key of ["constructor", "then", "catch", "finally"] as const) {
    expect(Object.getOwnPropertyDescriptor(promise, key)).toMatchObject({
      configurable: false,
      enumerable: false,
      writable: false,
    });
    expect(typeof methods[key]).toBe("function");
    expect(Object.isFrozen(methods[key])).toBe(true);
    if (expected !== undefined) expect(methods[key]).toBe(expected[key]);
  }
  return methods;
}

async function expectOpaqueFailureV1(input: unknown): Promise<void> {
  const operation =
    buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1(
      input,
    );
  const methods = expectHardenedPromiseV1(operation);
  let error: unknown;
  const observed = operation.catch((caught) => {
    error = caught;
  });
  expectHardenedPromiseV1(observed, methods);
  await observed;

  expect(error).toBeInstanceOf(
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationError,
  );
  expect(Object.isFrozen(error)).toBe(true);
  expect(error).toMatchObject({
    code: "provider_unavailable",
    reason: "attestation_invalid",
  });
  for (const leakedField of [
    "ok",
    "stage",
    "partial",
    "diagnostic",
    "value",
    "cause",
  ]) {
    expect(Object.hasOwn(error as object, leakedField)).toBe(false);
  }
  expect(String(error)).not.toMatch(
    /schema_invalid|capability_invalid|pre_plan_reference_capability/u,
  );
}

describe("D-41 public pre-side-effect Plan/admission facade", () => {
  it("maps non-exact2 input and a forged capability to one opaque public error", async () => {
    const forgedCapability = Object.freeze(Object.create(null));
    await expectOpaqueFailureV1({
      request: requestV1(),
      prePlanReferenceCapability: forgedCapability,
      unexpected: true,
    });
    await expectOpaqueFailureV1({
      request: requestV1(),
      prePlanReferenceCapability: forgedCapability,
    });
  });

  it("freezes its public operation/class and exports no diagnostics, mint, or machine", () => {
    expect(
      Object.isFrozen(
        buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1,
      ),
    ).toBe(true);
    expect(
      Object.isFrozen(
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationError,
      ),
    ).toBe(true);

    expect(Object.keys(publicFacadeModuleV1).sort()).toEqual(
      [
        "ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationError",
        "ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1Schema",
        "buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1",
      ].sort(),
    );
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1Schema,
    ).toBeDefined();
    for (const exportName of Object.keys(publicFacadeModuleV1)) {
      expect(exportName).not.toMatch(
        /(?:^diagnose|^mint|^validate|^verify|^derive|Domain|DOMAIN|InternalV1|Machine)/u,
      );
    }
    expect(
      Object.hasOwn(
        publicFacadeModuleV1,
        "diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1",
      ),
    ).toBe(false);
    expect(
      Object.hasOwn(
        publicFacadeModuleV1,
        "mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityInternalV1",
      ),
    ).toBe(false);
  });
});
