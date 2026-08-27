import { afterEach, describe, expect, it } from "vitest";
import type {
  PersistedArtifactV1,
  TaskArtifactBundleV1,
} from "@understand-code/contracts";

import {
  cleanupTemporaryWorktrees,
  createTemporaryWorktree,
  FIXTURE_TASK_ID,
  loadContractFixture,
  loadRepositorySnapshot,
  openFixtureStore,
} from "./helpers.js";

afterEach(cleanupTemporaryWorktrees);

async function openPublishedFixtureStore() {
  const store = await openFixtureStore(await createTemporaryWorktree());
  await store.persistArtifact(await loadRepositorySnapshot());
  await store.persistArtifact(
    await loadContractFixture<PersistedArtifactV1>(
      "reference/repo-pulse.json",
    ),
  );
  const bundle = await loadContractFixture<TaskArtifactBundleV1>(
    "reference/task-bundle.json",
  );
  const artifacts = await Promise.all(
    [
      "task.json",
      "task-brief.json",
      "claims.json",
      "evidence.json",
      "impact.json",
      "change-check.json",
      "verification.json",
    ].map((name) =>
      loadContractFixture<PersistedArtifactV1>(`reference/${name}`)
    ),
  );
  const control = bundle.idempotencyRecords.at(-1)!;
  await store.persistTaskBundle(
    {
      artifacts,
      events: bundle.events,
      idempotencyRecords: bundle.idempotencyRecords,
    },
    {
      expectedRevision: 0,
      historyImport: true,
      idempotencyKey: control.idempotencyKey,
      requestDigest: control.requestDigest,
    },
  );
  return store;
}

function providerBinding(cut: Readonly<{
  expectedRevision: number;
  idempotencyKey: string;
  requestDigest: string;
}>) {
  return {
    profile: "strong_operation_provider_object_binding_v1" as const,
    phase: "strong_change_check_v1" as const,
    projection: {
      role: "projection" as const,
      providerId: "provider:fixture",
      contentDigest: `sha256:${"b".repeat(64)}` as const,
      logicalBytes: 17,
      operationNonce: "c".repeat(32),
    },
    ownerDetail: "none" as const,
    compareArtifacts: {
      projectionProviderId: "provider:fixture",
      projectionContentDigest: `sha256:${"b".repeat(64)}`,
      projectionLogicalBytes: 17,
      requestDigest: cut.requestDigest,
      idempotencyKey: cut.idempotencyKey,
      taskExpectedRevision: cut.expectedRevision,
    },
  };
}

describe("strong operation Provider revision intent", () => {
  it("converges concurrent stale advances without spending the retry twice", async () => {
    const store = await openPublishedFixtureStore();
    const cut = {
      taskId: FIXTURE_TASK_ID,
      expectedRevision: 12,
      operation: "check_change" as const,
      idempotencyKey: "same-request",
      actor: "codex",
      requestDigest: `sha256:${"a".repeat(64)}`,
    };
    const providerObjectBinding = providerBinding(cut);
    await store.reserveStrongOperationIntent({
      ...cut,
      proposedAt: "2026-08-26T00:00:00.000Z",
    });
    expect(await store.resolveStrongOperationProviderRevision({
      ...cut,
      observedProviderRevision: 0,
      providerObjectBinding,
    })).toBe(0);

    expect(await store.advanceStrongOperationProviderRevision({
      ...cut,
      attemptedProviderRevision: 0,
      observedProviderRevision: 1,
    })).toBe(1);
    expect(await store.advanceStrongOperationProviderRevision({
      ...cut,
      attemptedProviderRevision: 0,
      observedProviderRevision: 1,
    })).toBe(1);

    for (let attempted = 1; attempted < 8; attempted += 1) {
      expect(await store.advanceStrongOperationProviderRevision({
        ...cut,
        attemptedProviderRevision: attempted,
        observedProviderRevision: attempted + 1,
      })).toBe(attempted + 1);
    }
    await expect(store.advanceStrongOperationProviderRevision({
      ...cut,
      attemptedProviderRevision: 8,
      observedProviderRevision: 9,
    })).rejects.toMatchObject({ code: "revision_conflict" });
  });

  it("releases only a reserved cut and retains an active cut for exact replay", async () => {
    const store = await openPublishedFixtureStore();
    const first = {
      taskId: FIXTURE_TASK_ID,
      expectedRevision: 12,
      operation: "check_change" as const,
      idempotencyKey: "invalid-preflight",
      actor: "codex",
      requestDigest: `sha256:${"d".repeat(64)}`,
    };
    await store.reserveStrongOperationIntent({
      ...first,
      proposedAt: "2026-08-26T00:00:00.000Z",
    });
    await expect(store.abortReservedStrongOperationIntent(first)).resolves
      .toBe(true);

    const second = {
      ...first,
      idempotencyKey: "valid-after-abort",
      requestDigest: `sha256:${"e".repeat(64)}`,
    };
    await expect(store.reserveStrongOperationIntent({
      ...second,
      proposedAt: "2026-08-26T00:00:01.000Z",
    })).resolves.toBe("2026-08-26T00:00:01.000Z");
    const binding = providerBinding(second);
    await expect(store.resolveStrongOperationProviderRevision({
      ...second,
      observedProviderRevision: 11,
      providerObjectBinding: binding,
    })).resolves.toBe(11);
    await expect(store.abortReservedStrongOperationIntent(second)).resolves
      .toBe(false);
    await expect(store.resolveStrongOperationProviderRevision({
      ...second,
      observedProviderRevision: 99,
      providerObjectBinding: binding,
    })).resolves.toBe(11);
  });
});
