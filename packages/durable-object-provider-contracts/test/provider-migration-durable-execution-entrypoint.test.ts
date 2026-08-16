import { describe, expect, it, vi } from "vitest";

const orchestratorMock = vi.hoisted(() => ({
  diagnose: vi.fn(),
}));

vi.mock(
  "../src/provider-migration-durable-execution-orchestrator-internal.js",
  () => ({
    diagnoseProviderMigrationDurableExecutionOrchestratorInternalV1:
      orchestratorMock.diagnose,
  }),
);

import {
  runProviderMigrationDurableExecutionV1,
  type ProviderMigrationDurableExecutionHostV1,
} from "../src/provider-migration-durable-execution-entrypoint.js";

const host = Object.freeze({
  profile: "provider_migration_durable_execution_host_capability_v1" as const,
  sourceProviderId: "durable-object-provider:source",
  destinationProviderId: "durable-object-provider:destination",
  readSourceObject: vi.fn(),
  writeDestinationObject: vi.fn(),
  compareCommitDestinationJournal: vi.fn(),
}) satisfies ProviderMigrationDurableExecutionHostV1;

function inputV1() {
  return {
    lifecycleInput: {} as never,
    durableHost: host,
    expectedDurableJournalRevision: 0,
    durableOperationNonceSeed: "1".repeat(32),
  };
}

describe("package-level durable migration execution entrypoint", () => {
  it("maps an internally produced success to a capability-locked summary", async () => {
    orchestratorMock.diagnose.mockResolvedValueOnce({
      ok: true,
      value: {
        sourceProviderId: host.sourceProviderId,
        destinationProviderId: host.destinationProviderId,
        copiedObjectCount: 1,
        copiedLogicalBytes: 12,
        finalJournalState: {
          revision: 4,
          phase: "final_strong_ready",
        },
      },
    });
    const result = await runProviderMigrationDurableExecutionV1(inputV1());
    expect(result).toEqual({
      ok: true,
      value: {
        profile: "provider_migration_durable_execution_summary_v1",
        durability: "separate_process_private_filesystem_durable_candidate_v1",
        osIsolationAuthority: "not_yet_proven_service_principal_v1",
        strongWriteCapability: "locked_to_verified_runtime_selection_v1",
        sourceProviderId: host.sourceProviderId,
        destinationProviderId: host.destinationProviderId,
        copiedObjectCount: 1,
        copiedLogicalBytes: 12,
        finalJournalRevision: 4,
        finalJournalPhase: "final_strong_ready",
      },
    });
  });

  it("does not turn a rejected/reference DTO into durable authority", async () => {
    orchestratorMock.diagnose.mockResolvedValueOnce({
      ok: false,
      stage: "reference_lifecycle",
      reason: "reference_lifecycle_rejected",
      upstream: { ok: false, stage: "input", reason: "schema_invalid" },
    });
    const result = await runProviderMigrationDurableExecutionV1(inputV1());
    expect(result).toEqual({
      ok: false,
      stage: "reference_lifecycle",
      reason: "reference_lifecycle_rejected",
      upstreamStage: "input",
    });
  });
});
