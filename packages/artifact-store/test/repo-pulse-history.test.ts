import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  IdempotencyRecordV1Schema,
  RepoPulseArtifactV1Schema,
  RepositorySnapshotArtifactV1Schema,
  TaskEventV1Schema,
  TaskManifestArtifactV1Schema,
  TaskManifestV1Schema,
  TaskOperationJournalArtifactV1Schema,
  TaskOperationReceiptV1Schema,
  type PersistedArtifactV1,
  type RepoPulseArtifactV1,
  type TaskArtifactBundleV1,
} from "@understand-code/contracts";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  ArtifactStore,
  sha256CanonicalJson,
} from "../src/index.js";
import {
  cleanupTemporaryWorktrees,
  createTemporaryWorktree,
  FIXTURE_PRODUCER_VERSION,
  FIXTURE_REPOSITORY_ID,
  FIXTURE_WORKTREE_ID,
  loadContractFixture,
  loadRepoPulse,
  loadRepositorySnapshot,
  openFixtureStore,
} from "./helpers.js";

const CREATED_TASK_ID = "01ARZ3NDEKTSV4RRFFQ69G5FB0";
const NEW_TASK_ID = "01ARZ3NDEKTSV4RRFFQ69G5FB1";
const TERMINAL_TASK_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

afterEach(async () => {
  await cleanupTemporaryWorktrees();
});

async function nextSnapshot(
  snapshotId: string,
  createdAt: string,
): Promise<PersistedArtifactV1> {
  const current = await loadRepositorySnapshot();
  if (current.artifactType !== "repository_snapshot") {
    throw new TypeError("Repository Snapshot fixture required.");
  }
  const payload = {
    ...current.payload,
    snapshotId,
    createdAt,
    limitations: [`state captured for ${snapshotId}`],
  };
  return RepositorySnapshotArtifactV1Schema.parse({
    ...current,
    artifactId: `artifact:repository-snapshot:${snapshotId}`,
    sourceSnapshotId: snapshotId,
    createdAt,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

async function pulseVersion(
  snapshotId: string,
  revision: number,
  evaluatedAt: string,
  label: string,
): Promise<RepoPulseArtifactV1> {
  const current = await loadRepoPulse();
  const payload = {
    ...current.payload,
    evaluatedSnapshotId: snapshotId,
    evaluatedAt,
    repositoryState: {
      ...current.payload.repositoryState!,
      branch: `feature/${label}`,
    },
  };
  return RepoPulseArtifactV1Schema.parse({
    ...current,
    // Deliberately reuse the legacy logical ID. The Store must derive a
    // deterministic publication identity without rewriting historical pins.
    artifactId: "artifact:repo-pulse",
    sourceSnapshotId: snapshotId,
    revision,
    createdAt: evaluatedAt,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

async function createdTaskTransaction(
  taskId: string,
  snapshotId: string,
  suffix: string,
) {
  const reference =
    await loadContractFixture<
      ReturnType<typeof TaskManifestArtifactV1Schema.parse>
    >("reference/task.json");
  const {
    currentChangeCheckId: _currentChangeCheckId,
    currentChangeCheckRevision: _currentChangeCheckRevision,
    ...base
  } = reference.payload;
  const occurredAt = `2026-07-30T10:0${suffix === "before" ? "0" : "5"}:00Z`;
  const task = TaskManifestV1Schema.parse({
    ...base,
    taskId,
    title: `Created Task ${suffix}`,
    status: "created",
    latestSnapshotId: snapshotId,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    revision: 1,
  });
  const taskArtifact = TaskManifestArtifactV1Schema.parse({
    ...reference,
    artifactId: `artifact:task-manifest:${suffix}`,
    sourceSnapshotId: snapshotId,
    taskId,
    revision: 1,
    createdAt: occurredAt,
    contentDigest: sha256CanonicalJson(task),
    payload: task,
  });
  const idempotencyKey = `pulse-history-create-${suffix}`;
  const requestDigest = sha256CanonicalJson({
    operation: "task_created",
    taskId,
    snapshotId,
    suffix,
  });
  const eventWithoutDigest = {
    schemaVersion: 1 as const,
    eventId: `event:pulse-history:${suffix}:1`,
    repositoryId: FIXTURE_REPOSITORY_ID,
    worktreeId: FIXTURE_WORKTREE_ID,
    taskId,
    previousRevision: 0,
    revision: 1,
    actor: "codex",
    idempotencyKey,
    requestDigest,
    sourceSnapshotId: snapshotId,
    occurredAt,
    resultingStatus: "created" as const,
    action: { type: "task_created" as const },
  };
  const event = TaskEventV1Schema.parse({
    ...eventWithoutDigest,
    eventDigest: sha256CanonicalJson(eventWithoutDigest),
  });
  const journalArtifactId = `artifact:task-operation-journal:${suffix}`;
  const result = {
    task,
    mutation: {
      taskId,
      revision: 1,
      eventId: event.eventId,
      artifactIds: [taskArtifact.artifactId, journalArtifactId],
      idempotentReplay: false,
    },
  };
  const receipt = TaskOperationReceiptV1Schema.parse({
    schemaVersion: 1,
    operation: "task_created",
    taskId,
    eventId: event.eventId,
    resultDigest: sha256CanonicalJson(result),
    result,
  });
  const record = IdempotencyRecordV1Schema.parse({
    schemaVersion: 1,
    worktreeId: FIXTURE_WORKTREE_ID,
    scope: {
      kind: "task_create",
      createScope: `pulse-history-${suffix}`,
    },
    idempotencyKey,
    actor: "codex",
    requestDigest,
    taskId,
    resultRevision: 1,
    eventId: event.eventId,
    resultDigest: receipt.resultDigest,
    createdAt: occurredAt,
  });
  const journalPayload = {
    idempotencyRecords: [record],
    receipts: [receipt],
  };
  const journal = TaskOperationJournalArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "task_operation_journal",
    artifactId: journalArtifactId,
    repositoryId: FIXTURE_REPOSITORY_ID,
    worktreeId: FIXTURE_WORKTREE_ID,
    sourceSnapshotId: snapshotId,
    taskId,
    revision: 1,
    producerVersion: FIXTURE_PRODUCER_VERSION,
    createdAt: occurredAt,
    contentDigest: sha256CanonicalJson(journalPayload),
    payload: journalPayload,
  });
  return {
    input: {
      artifacts: [taskArtifact, journal],
      events: [event],
      idempotencyRecords: [record],
    },
    options: {
      expectedRevision: 0,
      idempotencyKey,
      requestDigest,
    },
  };
}

async function persistReferenceTerminalTask(
  store: ArtifactStore,
): Promise<void> {
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
    ].map((file) =>
      loadContractFixture<PersistedArtifactV1>(`reference/${file}`),
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
}

async function openExistingStore(root: string): Promise<ArtifactStore> {
  const store = await ArtifactStore.open(root, {
    repositoryId: FIXTURE_REPOSITORY_ID,
    worktreeId: FIXTURE_WORKTREE_ID,
    producerVersion: FIXTURE_PRODUCER_VERSION,
    lock: {
      timeoutMs: 500,
      staleAfterMs: 2_000,
      pollMinMs: 2,
      pollMaxMs: 5,
    },
  });
  await store.initialize();
  return store;
}

describe("Repo Pulse immutable history", () => {
  it("publishes new Snapshot/Pulse state with created and terminal Tasks while preserving every historical pin", async () => {
    const root = await createTemporaryWorktree("pulse-history-liveness-");
    const store = await openFixtureStore(root);
    const initialSnapshot = await loadRepositorySnapshot();
    const initialPulse = await loadRepoPulse();
    await store.persistArtifact(initialSnapshot);
    await store.persistArtifact(initialPulse);

    const created = await createdTaskTransaction(
      CREATED_TASK_ID,
      initialSnapshot.sourceSnapshotId,
      "before",
    );
    await store.persistTaskBundle(created.input, created.options);
    await persistReferenceTerminalTask(store);

    const advancedSnapshotId = "snapshot:pulse-history-next";
    await store.persistArtifact(
      await nextSnapshot(
        advancedSnapshotId,
        "2026-07-30T10:10:00Z",
      ),
    );
    const nextPulseInput = await pulseVersion(
      advancedSnapshotId,
      1,
      "2026-07-30T10:10:01Z",
      "pulse-history-next",
    );
    const nextRequestDigest = sha256CanonicalJson({
      operation: "publish_repo_pulse",
      version: 1,
    });
    const nextPulse = await store.persistArtifact(nextPulseInput, {
      expectedRevision: 0,
      idempotencyKey: "pulse-history-next",
      requestDigest: nextRequestDigest,
    });
    expect(nextPulse.artifact.artifactId).not.toBe(
      nextPulseInput.artifactId,
    );
    expect(nextPulse.descriptor.artifactId).toBe(
      nextPulse.artifact.artifactId,
    );
    await expect(
      store.persistArtifact(nextPulseInput, {
        expectedRevision: 0,
        idempotencyKey: "pulse-history-next",
        requestDigest: nextRequestDigest,
      }),
    ).resolves.toMatchObject({
      replayed: true,
      artifact: { artifactId: nextPulse.artifact.artifactId },
      descriptor: { artifactId: nextPulse.artifact.artifactId },
    });

    await expect(
      store.readTaskBundle(CREATED_TASK_ID),
    ).resolves.toMatchObject({
      bundle: { manifest: { taskId: CREATED_TASK_ID } },
      freshness: "stale",
    });
    const afterAdvance = await store.readManifest();
    const terminalTaskDescriptor = afterAdvance.artifacts.find(
      (descriptor) =>
        descriptor.taskId === TERMINAL_TASK_ID &&
        descriptor.artifactType === "task_manifest",
    );
    expect(terminalTaskDescriptor).toMatchObject({
      freshness: "stale",
      dependencies: expect.arrayContaining([
        expect.objectContaining({
          artifactId: initialPulse.artifactId,
          requiredDigest: initialPulse.contentDigest,
          requiredSnapshotId: initialPulse.sourceSnapshotId,
        }),
      ]),
    });
    const initialHistory = afterAdvance.artifacts.find(
      (descriptor) =>
        descriptor.artifactType === "repo_pulse" &&
        descriptor.artifactId === initialPulse.artifactId,
    );
    expect(initialHistory).toMatchObject({
      state: "historical",
      freshness: "stale",
      sourceSnapshotId: initialPulse.sourceSnapshotId,
      contentDigest: initialPulse.contentDigest,
    });
    expect(initialHistory?.path).toMatch(
      /^\.understand-code\/pulses\/[0-9a-f]{64}\.json$/u,
    );
    expect(
      JSON.parse(
        await readFile(
          path.join(root, ...initialHistory!.path.split("/")),
          "utf8",
        ),
      ),
    ).toEqual(initialPulse);
    expect(
      afterAdvance.artifacts.filter(
        (descriptor) =>
          descriptor.artifactType === "repo_pulse" &&
          descriptor.state === "current",
      ),
    ).toHaveLength(1);

    const newTask = await createdTaskTransaction(
      NEW_TASK_ID,
      advancedSnapshotId,
      "after",
    );
    await store.persistTaskBundle(newTask.input, newTask.options);
    const newTaskDescriptor = (await store.readManifest()).artifacts.find(
      (descriptor) =>
        descriptor.taskId === NEW_TASK_ID &&
        descriptor.artifactType === "task_manifest",
    );
    expect(newTaskDescriptor?.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactId: nextPulse.artifact.artifactId,
          requiredDigest: nextPulse.artifact.contentDigest,
          requiredSnapshotId: advancedSnapshotId,
        }),
      ]),
    );

    const sameSnapshotPulseInput = await pulseVersion(
      advancedSnapshotId,
      2,
      "2026-07-30T10:10:02Z",
      "same-snapshot-refresh",
    );
    const sameSnapshotPulse = await store.persistArtifact(
      sameSnapshotPulseInput,
      {
        expectedRevision: 1,
        idempotencyKey: "pulse-history-same-snapshot",
        requestDigest: sha256CanonicalJson({
          operation: "publish_repo_pulse",
          version: 2,
        }),
      },
    );
    expect(sameSnapshotPulse.artifact.artifactId).not.toBe(
      nextPulse.artifact.artifactId,
    );
    await expect(store.readTaskBundle(NEW_TASK_ID)).resolves.toMatchObject({
      freshness: "stale",
    });

    const reopened = await openExistingStore(root);
    for (const taskId of [CREATED_TASK_ID, NEW_TASK_ID]) {
      await expect(reopened.readTaskBundle(taskId)).resolves.toMatchObject({
        bundle: { manifest: { taskId } },
      });
    }
    const reopenedManifest = await reopened.readManifest();
    expect(
      reopenedManifest.artifacts.find(
        (descriptor) =>
          descriptor.taskId === TERMINAL_TASK_ID &&
          descriptor.artifactType === "task_manifest",
      ),
    ).toMatchObject({ freshness: "stale" });
    expect(
      reopenedManifest.artifacts.filter(
        (descriptor) => descriptor.artifactType === "repo_pulse",
      ),
    ).toHaveLength(3);
    await expect(reopened.readArtifact("repo_pulse")).resolves.toMatchObject({
      artifact: { artifactId: sameSnapshotPulse.artifact.artifactId },
      state: "current",
    });
  });

  it.each([
    ["history", "after_rename"],
    ["canonical", "after_rename"],
    ["manifest", "before_rename"],
  ] as const)(
    "rolls back a %s write failure at %s without weakening the old publication",
    async (target, failureStage) => {
      const root = await createTemporaryWorktree(
        `pulse-history-${target}-rollback-`,
      );
      const store = await openFixtureStore(root);
      const initialSnapshot = await loadRepositorySnapshot();
      const initialPulse = await loadRepoPulse();
      await store.persistArtifact(initialSnapshot);
      await store.persistArtifact(initialPulse);
      const advancedSnapshotId = `snapshot:${target}-rollback`;
      await store.persistArtifact(
        await nextSnapshot(
          advancedSnapshotId,
          "2026-07-30T11:00:00Z",
        ),
      );
      const nextPulse = await pulseVersion(
        advancedSnapshotId,
        1,
        "2026-07-30T11:00:01Z",
        `${target}-rollback`,
      );
      const fault = {
        faultInjector({
          stage,
        }: {
          stage: string;
        }) {
          if (stage === failureStage) {
            throw new Error(`${target} publication interrupted`);
          }
        },
      };
      await expect(
        store.persistArtifact(nextPulse, {
          expectedRevision: 0,
          ...(target === "history"
            ? { historyWrite: fault }
            : target === "canonical"
              ? { artifactWrite: fault }
              : { manifestWrite: fault }),
        }),
      ).rejects.toMatchObject({ code: "artifact_corrupt" });
      await expect(store.readArtifact("repo_pulse")).resolves.toMatchObject({
        artifact: {
          artifactId: initialPulse.artifactId,
          contentDigest: initialPulse.contentDigest,
        },
      });
      await expect(
        readFile(store.layout.repoPulseTransactionMarker),
      ).rejects.toMatchObject({ code: "ENOENT" });
      await expect(
        store.persistArtifact(nextPulse, { expectedRevision: 0 }),
      ).resolves.toMatchObject({ replayed: false });
    },
  );

  it("recovers an after-rename Manifest ambiguity using the Manifest as commit record", async () => {
    const root = await createTemporaryWorktree(
      "pulse-history-manifest-ambiguous-",
    );
    const store = await openFixtureStore(root);
    const initialSnapshot = await loadRepositorySnapshot();
    await store.persistArtifact(initialSnapshot);
    await store.persistArtifact(await loadRepoPulse());
    const advancedSnapshotId = "snapshot:pulse-manifest-ambiguous";
    await store.persistArtifact(
      await nextSnapshot(
        advancedSnapshotId,
        "2026-07-30T12:00:00Z",
      ),
    );
    const nextPulse = await pulseVersion(
      advancedSnapshotId,
      1,
      "2026-07-30T12:00:01Z",
      "manifest-ambiguous",
    );
    await expect(
      store.persistArtifact(nextPulse, {
        expectedRevision: 0,
        manifestWrite: {
          faultInjector({ stage }) {
            if (stage === "after_rename") {
              throw new Error("Manifest durability is ambiguous");
            }
          },
        },
      }),
    ).rejects.toMatchObject({
      details: {
        committed: true,
        durabilityConfirmed: false,
        targetPath: store.layout.manifest,
      },
    });
    await expect(
      readFile(store.layout.repoPulseTransactionMarker),
    ).resolves.toBeInstanceOf(Buffer);

    const reopened = await openExistingStore(root);
    await expect(
      readFile(reopened.layout.repoPulseTransactionMarker),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(reopened.readArtifact("repo_pulse")).resolves.toMatchObject({
      artifact: {
        sourceSnapshotId: advancedSnapshotId,
        revision: 1,
      },
      state: "current",
    });
    expect(
      (await reopened.readManifest()).artifacts.filter(
        (descriptor) => descriptor.artifactType === "repo_pulse",
      ),
    ).toHaveLength(2);
  });

  it("marks only a failed canonical Pulse corrupt and preserves historical Task pins", async () => {
    const root = await createTemporaryWorktree(
      "pulse-history-canonical-corrupt-",
    );
    const store = await openFixtureStore(root);
    const snapshot = await loadRepositorySnapshot();
    const initialPulse = await loadRepoPulse();
    await store.persistArtifact(snapshot);
    await store.persistArtifact(initialPulse);
    const task = await createdTaskTransaction(
      CREATED_TASK_ID,
      snapshot.sourceSnapshotId,
      "before",
    );
    await store.persistTaskBundle(task.input, task.options);

    const nextPulse = await store.persistArtifact(
      await pulseVersion(
        snapshot.sourceSnapshotId,
        1,
        "2026-07-30T13:00:00Z",
        "canonical-corrupt",
      ),
      { expectedRevision: 0 },
    );
    expect(nextPulse.backupPath).toBeDefined();
    await writeFile(store.layout.repoPulse, '{"broken canonical":');
    await writeFile(nextPulse.backupPath!, '{"broken backup":');

    await expect(
      store.readArtifact("repo_pulse", {}, { recover: true }),
    ).rejects.toMatchObject({ code: "artifact_corrupt" });

    const failedManifest = await store.readManifest({
      verifyArtifacts: false,
    });
    expect(
      failedManifest.artifacts.find(
        (descriptor) =>
          descriptor.artifactId === nextPulse.artifact.artifactId,
      ),
    ).toMatchObject({
      state: "corrupt",
      freshness: "invalid",
    });
    expect(
      failedManifest.artifacts.find(
        (descriptor) =>
          descriptor.artifactId === initialPulse.artifactId,
      ),
    ).toMatchObject({
      state: "historical",
      freshness: "stale",
      contentDigest: initialPulse.contentDigest,
    });
    await expect(
      store.readTaskBundle(CREATED_TASK_ID),
    ).resolves.toMatchObject({
      bundle: { manifest: { taskId: CREATED_TASK_ID } },
      freshness: "stale",
    });
  });
});
