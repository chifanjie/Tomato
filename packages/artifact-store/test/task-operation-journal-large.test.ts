import { afterEach, describe, expect, it } from "vitest";

import {
  TaskEventV1Schema,
  TaskManifestArtifactV1Schema,
  TaskManifestV1Schema,
  TaskOperationJournalArtifactV1Schema,
  canonicalTaskEventDigestJsonV1,
  type IdempotencyRecordV1,
  type TaskEventV1,
  type TaskManifestV1,
  type TaskOperationReceiptV1,
} from "@understand-code/contracts";

import {
  sha256Bytes,
  sha256CanonicalJson,
} from "../src/index.js";
import {
  cleanupTemporaryWorktrees,
  createTemporaryWorktree,
  FIXTURE_PRODUCER_VERSION,
  FIXTURE_REPOSITORY_ID,
  FIXTURE_TASK_ID,
  FIXTURE_WORKTREE_ID,
  loadContractFixture,
  openFixtureStore,
} from "./helpers.js";

const HISTORY_LENGTH = 2_001;
const SNAPSHOT_ID = "snapshot:actual";
const START = Date.parse("2026-07-28T10:00:00.000Z");

afterEach(cleanupTemporaryWorktrees);

function at(revision: number): string {
  return new Date(START + revision * 1_000).toISOString();
}

function taskAt(
  base: TaskManifestV1,
  revision: number,
): TaskManifestV1 {
  const blocked = revision > 1 && revision % 2 === 0;
  const {
    currentChangeCheckId: _currentChangeCheckId,
    currentChangeCheckRevision: _currentChangeCheckRevision,
    blockedState: _blockedState,
    staleState: _staleState,
    supersession: _supersession,
    ...stable
  } = base;
  return TaskManifestV1Schema.parse({
    ...stable,
    status: blocked ? "blocked" : "created",
    createdAt: at(1),
    updatedAt: at(revision),
    revision,
    ...(blocked
      ? {
          blockedState: {
            resumeStatus: "created",
            reasonCode: "large_journal_fixture",
            message: "Exercise the durable operation journal boundary.",
            actor: "benchmark",
            blockedAt: at(revision),
          },
        }
      : {}),
  });
}

function eventAt(
  task: TaskManifestV1,
  previous: TaskEventV1 | undefined,
): TaskEventV1 {
  const revision = task.revision;
  const blocked = task.status === "blocked";
  const requestDigest = sha256CanonicalJson({
    fixture: "large-journal",
    revision,
    action: revision === 1 ? "task_created" : blocked ? "block" : "resume",
  });
  const event = TaskEventV1Schema.parse({
    schemaVersion: 1,
    eventId: `event:large-journal:${revision}`,
    repositoryId: FIXTURE_REPOSITORY_ID,
    worktreeId: FIXTURE_WORKTREE_ID,
    taskId: FIXTURE_TASK_ID,
    previousRevision: revision - 1,
    revision,
    actor: "benchmark",
    idempotencyKey: `large-journal-key-${revision}`,
    requestDigest,
    sourceSnapshotId: SNAPSHOT_ID,
    occurredAt: at(revision),
    ...(previous === undefined
      ? {}
      : {
          previousStatus: previous.resultingStatus,
          previousEventDigest: previous.eventDigest,
        }),
    resultingStatus: task.status,
    action:
      revision === 1
        ? { type: "task_created" as const }
        : blocked
          ? {
              type: "block_task" as const,
              reasonCode: "large_journal_fixture",
              message: "Exercise the durable operation journal boundary.",
            }
          : { type: "resume_task" as const },
    eventDigest: sha256Bytes("placeholder"),
  });
  return TaskEventV1Schema.parse({
    ...event,
    eventDigest: sha256Bytes(canonicalTaskEventDigestJsonV1(event)),
  });
}

function receiptAndRecord(
  task: TaskManifestV1,
  event: TaskEventV1,
): {
  receipt: TaskOperationReceiptV1;
  record: IdempotencyRecordV1;
} {
  const result = {
    task,
    mutation: {
      taskId: FIXTURE_TASK_ID,
      revision: task.revision,
      eventId: event.eventId,
      artifactIds: [
        "artifact:task-manifest:large-journal",
        "artifact:task-operation-journal:large-journal",
      ],
      idempotentReplay: false,
    },
  };
  const resultDigest = sha256CanonicalJson(result);
  const receipt: TaskOperationReceiptV1 = {
    schemaVersion: 1,
    operation: task.revision === 1 ? "task_created" : "update_task",
    taskId: FIXTURE_TASK_ID,
    eventId: event.eventId,
    resultDigest,
    result,
  };
  const record: IdempotencyRecordV1 = {
    schemaVersion: 1,
    worktreeId: FIXTURE_WORKTREE_ID,
    scope:
      task.revision === 1
        ? { kind: "task_create", createScope: "large-journal-fixture" }
        : { kind: "task", taskId: FIXTURE_TASK_ID },
    idempotencyKey: event.idempotencyKey,
    actor: event.actor,
    requestDigest: event.requestDigest,
    taskId: FIXTURE_TASK_ID,
    resultRevision: task.revision,
    eventId: event.eventId,
    resultDigest,
    createdAt: event.occurredAt,
  };
  return { receipt, record };
}

async function genesisTransaction() {
  const reference = await loadContractFixture<
    ReturnType<typeof TaskManifestArtifactV1Schema.parse>
  >("reference/task.json");
  const task = taskAt(reference.payload, 1);
  const event = eventAt(task, undefined);
  const { receipt, record } = receiptAndRecord(task, event);
  const manifestArtifact = TaskManifestArtifactV1Schema.parse({
    ...reference,
    artifactId: "artifact:task-manifest:large-journal",
    sourceSnapshotId: SNAPSHOT_ID,
    revision: 1,
    createdAt: task.updatedAt,
    contentDigest: sha256CanonicalJson(task),
    payload: task,
  });
  const journalPayload = {
    idempotencyRecords: [record],
    receipts: [receipt],
  };
  const journalArtifact = TaskOperationJournalArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "task_operation_journal",
    artifactId: "artifact:task-operation-journal:large-journal",
    repositoryId: FIXTURE_REPOSITORY_ID,
    worktreeId: FIXTURE_WORKTREE_ID,
    sourceSnapshotId: SNAPSHOT_ID,
    taskId: FIXTURE_TASK_ID,
    revision: 1,
    producerVersion: FIXTURE_PRODUCER_VERSION,
    createdAt: task.updatedAt,
    contentDigest: sha256CanonicalJson(journalPayload),
    payload: journalPayload,
  });
  return {
    manifestArtifact,
    journalArtifact,
    event,
    record,
    receipt,
  };
}

describe("large trusted Task operation journal", () => {
  it("requires a Journal for live writes and rejects a self-consistent Receipt bound to the wrong Event action", async () => {
    const root = await createTemporaryWorktree(
      "artifact-store-journal-negative-",
    );
    const store = await openFixtureStore(root);
    const transaction = await genesisTransaction();
    const control = {
      expectedRevision: 0,
      idempotencyKey: transaction.record.idempotencyKey,
      requestDigest: transaction.record.requestDigest,
    };

    await expect(
      store.persistTaskBundle(
        {
          artifacts: [transaction.manifestArtifact],
          events: [transaction.event],
          idempotencyRecords: [transaction.record],
        },
        control,
      ),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });

    if (transaction.receipt.operation !== "task_created") {
      throw new TypeError("Genesis fixture must use task_created.");
    }
    const mismatchedReceipt: TaskOperationReceiptV1 = {
      ...transaction.receipt,
      operation: "update_task",
    };
    const mismatchedRecord: IdempotencyRecordV1 = {
      ...transaction.record,
      scope: { kind: "task", taskId: FIXTURE_TASK_ID },
    };
    const mismatchedPayload = {
      idempotencyRecords: [mismatchedRecord],
      receipts: [mismatchedReceipt],
    };
    const mismatchedJournal = TaskOperationJournalArtifactV1Schema.parse({
      ...transaction.journalArtifact,
      contentDigest: sha256CanonicalJson(mismatchedPayload),
      payload: mismatchedPayload,
    });
    await expect(
      store.persistTaskBundle(
        {
          artifacts: [
            transaction.manifestArtifact,
            mismatchedJournal,
          ],
          events: [transaction.event],
          idempotencyRecords: [mismatchedRecord],
        },
        control,
      ),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });

    await expect(
      store.persistTaskBundle(
        {
          artifacts: [
            transaction.manifestArtifact,
            transaction.journalArtifact,
          ],
          events: [transaction.event],
          idempotencyRecords: [transaction.record],
        },
        control,
      ),
    ).resolves.toMatchObject({
      replayed: false,
      bundle: { manifest: { revision: 1 } },
    });
  });

  it("replays the first receipt after the compact cache exceeds 2,000 records", async () => {
    const root = await createTemporaryWorktree(
      "artifact-store-large-journal-",
    );
    const store = await openFixtureStore(root);
    const reference = await loadContractFixture<
      ReturnType<typeof TaskManifestArtifactV1Schema.parse>
    >("reference/task.json");
    const tasks: TaskManifestV1[] = [];
    const events: TaskEventV1[] = [];
    const records: IdempotencyRecordV1[] = [];
    const receipts: TaskOperationReceiptV1[] = [];

    for (let revision = 1; revision <= HISTORY_LENGTH; revision += 1) {
      const task = taskAt(reference.payload, revision);
      const event = eventAt(task, events.at(-1));
      const pair = receiptAndRecord(task, event);
      tasks.push(task);
      events.push(event);
      records.push(pair.record);
      receipts.push(pair.receipt);
    }

    const latest = tasks.at(-1)!;
    const manifestArtifact = TaskManifestArtifactV1Schema.parse({
      ...reference,
      artifactId: "artifact:task-manifest:large-journal",
      sourceSnapshotId: SNAPSHOT_ID,
      revision: latest.revision,
      createdAt: latest.updatedAt,
      contentDigest: sha256CanonicalJson(latest),
      payload: latest,
    });
    const journalPayload = {
      idempotencyRecords: records,
      receipts,
    };
    const journalArtifact = TaskOperationJournalArtifactV1Schema.parse({
      schemaVersion: 1,
      artifactType: "task_operation_journal",
      artifactId: "artifact:task-operation-journal:large-journal",
      repositoryId: FIXTURE_REPOSITORY_ID,
      worktreeId: FIXTURE_WORKTREE_ID,
      sourceSnapshotId: SNAPSHOT_ID,
      taskId: FIXTURE_TASK_ID,
      revision: latest.revision,
      producerVersion: FIXTURE_PRODUCER_VERSION,
      createdAt: latest.updatedAt,
      contentDigest: sha256CanonicalJson(journalPayload),
      payload: journalPayload,
    });

    await store.persistTaskBundle(
      {
        artifacts: [manifestArtifact, journalArtifact],
        events,
        idempotencyRecords: records,
      },
      {
        expectedRevision: 0,
        historyImport: true,
        idempotencyKey: records.at(-1)!.idempotencyKey,
        requestDigest: records.at(-1)!.requestDigest,
      },
    );

    const historical = await store.lookupTaskOperationReceipt(
      FIXTURE_TASK_ID,
      records[0]!.scope,
      records[0]!.idempotencyKey,
    );
    expect(historical).toEqual({
      record: records[0],
      receipt: receipts[0],
    });
    expect(historical!.receipt.result.mutation.revision).toBe(1);
    const trusted = await store.readTaskBundle(FIXTURE_TASK_ID);
    expect(trusted.bundle.manifest.revision).toBe(HISTORY_LENGTH);
    expect(trusted.bundle.idempotencyRecords).toHaveLength(HISTORY_LENGTH);
    expect(trusted.receipts).toHaveLength(HISTORY_LENGTH);
  }, 60_000);
});
