import { describe, expect, it } from "vitest";

import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-pre-plan-reference-capability-internal.js";

function digestV1(character: string) {
  return `sha256:${character.repeat(64)}` as const;
}

function budgetsV1() {
  return ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema.parse(
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
  );
}

function requestV1() {
  return {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_request_reference_candidate_v1" as const,
    mode: "same_installation_identity" as const,
    reason: "provider_decommission" as const,
    admissionClass: "normal" as const,
    createdAt: "2026-08-15T00:00:00.000Z",
    migrationBudgets: budgetsV1(),
    liveReferenceSchemaDigest: digestV1("a"),
    migrationProtocolDigest: digestV1("b"),
  };
}

function forgedCapabilityV1(): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityV1 {
  return Object.freeze(
    Object.create(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityV1;
}

function auditSnapshotV1(revision = 0) {
  const sink = () => ({
    revision,
    count: 0,
    contentDigest: digestV1("c"),
  });
  return {
    reservationWrites: sink(),
    planPublications: sink(),
    acceptanceAppends: sink(),
    progressAppends: sink(),
    operationReceiptWrites: sink(),
    destinationObjectAllocations: sink(),
    quotaConsumptions: sink(),
    emergencyReserveConsumptions: sink(),
    pendingIntents: sink(),
  };
}

function invalidMintInputV1(observeSideEffectSinks: () => unknown) {
  return {
    acceptanceClosureIdentity: null,
    endpointObservationHost: null,
    prospectiveDestinationPreparedSourceCapability: null,
    quotaObservationHost: null,
    request: requestV1(),
    sideEffectAuditObserver: { observeSideEffectSinks },
    sourceStreamHost: null,
    verifiedLiveReferenceSchemaDigest: digestV1("a"),
    verifiedMigrationProtocolDigest: digestV1("b"),
  };
}

describe("D-41 pre-plan single-cohort capability boundary", () => {
  it("rejects outer/request extras before capability claim and never evaluates getters", async () => {
    const capability = forgedCapabilityV1();
    const requestWithExtra = { ...requestV1(), extra: true };
    expect(
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
        { request: requestWithExtra, prePlanReferenceCapability: capability },
      ),
    ).toEqual({ ok: false, stage: "input", reason: "schema_invalid" });

    let getterCalls = 0;
    const getterInput = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(getterInput, "request", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return requestV1();
      },
    });
    Object.defineProperty(getterInput, "prePlanReferenceCapability", {
      enumerable: true,
      value: capability,
    });
    expect(
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
        getterInput,
      ),
    ).toEqual({ ok: false, stage: "input", reason: "schema_invalid" });
    expect(getterCalls).toBe(0);

    // Caller-assembled exact2 values are never registered build inputs, even
    // when their nested request is otherwise valid.
    expect(
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
        { request: requestV1(), prePlanReferenceCapability: capability },
      ),
    ).toEqual({ ok: false, stage: "input", reason: "schema_invalid" });
  });

  it("rejects forged/copy identities and returns a captured-intrinsic hardened Promise", async () => {
    const forged = forgedCapabilityV1();
    const copy = Object.freeze({ ...forged });
    expect(Reflect.ownKeys(forged)).toEqual([]);
    expect(Object.getPrototypeOf(forged)).toBeNull();
    expect(Object.isFrozen(forged)).toBe(true);

    const operation =
      diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
        { request: requestV1(), prePlanReferenceCapability: copy },
      );
    expect(Object.isFrozen(operation)).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(operation, "then")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(operation, "catch")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(operation, "finally")).toBe(true);
    expect(await operation).toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });
  });

  it("keeps descriptor admission and capability lookup on bootstrap-captured intrinsics", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor;
    const originalWeakMapGet = WeakMap.prototype.get;
    let operation: ReturnType<
      typeof diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1
    >;
    try {
      Object.getOwnPropertyDescriptor = (() => {
        throw new Error("late Object.getOwnPropertyDescriptor");
      }) as typeof Object.getOwnPropertyDescriptor;
      WeakMap.prototype.get = (() => {
        throw new Error("late WeakMap.prototype.get");
      }) as typeof WeakMap.prototype.get;
      operation =
        diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
          {
            request: requestV1(),
            prePlanReferenceCapability: forgedCapabilityV1(),
          },
        );
    } finally {
      Object.getOwnPropertyDescriptor = originalDescriptor;
      WeakMap.prototype.get = originalWeakMapGet;
    }
    expect(await operation!).toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });
  });

  it("audits async mint failures and lets side-effect evidence override the earlier failure", async () => {
    let stableCalls = 0;
    await expect(
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityInternalV1(
        invalidMintInputV1(() => {
          stableCalls += 1;
          return auditSnapshotV1();
        }),
      ),
    ).rejects.toThrow("provider migration pre-plan reference operation failed");
    expect(stableCalls).toBe(2);

    let driftingCalls = 0;
    try {
      await mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityInternalV1(
        invalidMintInputV1(() => {
          driftingCalls += 1;
          return auditSnapshotV1(driftingCalls - 1);
        }),
      );
      throw new Error("mint should fail");
    } catch (error) {
      expect(error).toMatchObject({
        stage: "side_effect_boundary",
        reason: "side_effect_detected",
      });
    }
    expect(driftingCalls).toBe(2);

    const sinkKeys = [
      "reservationWrites",
      "planPublications",
      "acceptanceAppends",
      "progressAppends",
      "operationReceiptWrites",
      "destinationObjectAllocations",
      "quotaConsumptions",
      "emergencyReserveConsumptions",
      "pendingIntents",
    ] as const;
    for (const sinkKey of sinkKeys) {
      let calls = 0;
      try {
        await mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityInternalV1(
          invalidMintInputV1(() => {
            calls += 1;
            const snapshot = auditSnapshotV1();
            if (calls === 2) {
              snapshot[sinkKey] = {
                ...snapshot[sinkKey],
                count: 1,
              };
            }
            return snapshot;
          }),
        );
        throw new Error("mint should fail");
      } catch (error) {
        expect(error).toMatchObject({
          stage: "side_effect_boundary",
          reason: "side_effect_detected",
        });
      }
      expect(calls).toBe(2);
    }
  });

  it("does not enumerate mint transports or invoke accessors", async () => {
    let ownKeysCalls = 0;
    let auditOwnKeysCalls = 0;
    let auditCalls = 0;
    const target = invalidMintInputV1(() => {
      auditCalls += 1;
      return new Proxy(auditSnapshotV1(), {
        ownKeys() {
          auditOwnKeysCalls += 1;
          throw new Error("audit ownKeys must not run");
        },
      });
    });
    const transport = new Proxy(target, {
      ownKeys() {
        ownKeysCalls += 1;
        throw new Error("ownKeys must not run");
      },
    });
    await expect(
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityInternalV1(
        transport,
      ),
    ).rejects.toMatchObject({
      stage: "endpoint_trust",
      reason: "trust_closure_invalid",
    });
    expect(ownKeysCalls).toBe(0);
    expect(auditOwnKeysCalls).toBe(0);
    expect(auditCalls).toBe(2);

    let getterCalls = 0;
    const getterTransport = {
      ...target,
      get acceptanceClosureIdentity() {
        getterCalls += 1;
        return null;
      },
    };
    await expect(
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityInternalV1(
        getterTransport,
      ),
    ).rejects.toMatchObject({
      stage: "pre_plan_reference_capability",
      reason: "capability_invalid",
    });
    expect(getterCalls).toBe(0);
  });
});
