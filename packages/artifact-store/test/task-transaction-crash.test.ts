import { spawn } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  IdempotencyRecordV1Schema,
  TaskEventV1Schema,
  TaskManifestArtifactV1Schema,
  TaskOperationJournalArtifactV1Schema,
  TaskOperationReceiptV1Schema,
  canonicalTaskEventDigestJsonV1,
  type TaskManifestArtifactV1,
} from "@understand-code/contracts";

import {
  ArtifactStore,
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
  loadReferenceEvents,
  openFixtureStore,
} from "./helpers.js";

afterEach(cleanupTemporaryWorktrees);

const CREATED_AT = "2026-07-28T08:00:00Z";
const BLOCKED_AT = "2026-07-28T08:00:01Z";

function taskManifestAt(
  reference: TaskManifestArtifactV1,
  revision: 1 | 2,
  status: "created" | "blocked",
  updatedAt: string,
): TaskManifestArtifactV1 {
  const {
    currentChangeCheckId: _currentChangeCheckId,
    currentChangeCheckRevision: _currentChangeCheckRevision,
    blockedState: _blockedState,
    staleState: _staleState,
    supersession: _supersession,
    ...base
  } = reference.payload;
  const payload = {
    ...base,
    revision,
    status,
    updatedAt,
    ...(status === "blocked"
      ? {
          blockedState: {
            resumeStatus: "created" as const,
            reasonCode: "hard_exit",
            message: "Exercise durable whole-task recovery.",
            actor: "developer" as const,
            blockedAt: updatedAt,
          },
        }
      : {}),
  };
  return TaskManifestArtifactV1Schema.parse({
    ...reference,
    revision,
    createdAt: updatedAt,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

function journalAt(
  revision: number,
  createdAt: string,
  idempotencyRecords: ReturnType<typeof IdempotencyRecordV1Schema.parse>[],
  receipts: ReturnType<typeof TaskOperationReceiptV1Schema.parse>[],
) {
  const payload = { idempotencyRecords, receipts };
  return TaskOperationJournalArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "task_operation_journal",
    artifactId: "artifact:task-operation-journal",
    repositoryId: FIXTURE_REPOSITORY_ID,
    worktreeId: FIXTURE_WORKTREE_ID,
    sourceSnapshotId: "snapshot:actual",
    taskId: FIXTURE_TASK_ID,
    revision,
    producerVersion: FIXTURE_PRODUCER_VERSION,
    createdAt,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

async function runCrashChild(
  root: string,
  transactionPath: string,
  crashTarget: string,
): Promise<number | null> {
  const childPath = fileURLToPath(
    new URL("./task-transaction-crash-child.mjs", import.meta.url),
  );
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [childPath, root, transactionPath, crashTarget],
      {
        cwd: path.dirname(childPath),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 86 && stderr.length > 0) {
        reject(new Error(stderr));
        return;
      }
      resolve(code);
    });
  });
}

describe("durable whole-task transaction recovery", () => {
  it.each([
    ["task.json", 1, false],
    ["operation-journal.json", 1, false],
    ["events.jsonl", 1, false],
    ["artifact-manifest.json", 2, true],
  ] as const)(
    "recovers a hard process exit after %s rename",
    async (crashTarget, recoveredRevision, replayed) => {
      const root = await createTemporaryWorktree(
        `artifact-store-hard-exit-${crashTarget}-`,
      );
      const store = await openFixtureStore(root);
      const reference =
        await loadContractFixture<TaskManifestArtifactV1>(
          "reference/task.json",
        );
      const [createdEvent] = await loadReferenceEvents();
      expect(createdEvent).toBeDefined();

      const createdManifest = taskManifestAt(
        reference,
        1,
        "created",
        CREATED_AT,
      );
      const createdResult = {
        task: createdManifest.payload,
        mutation: {
          taskId: FIXTURE_TASK_ID,
          revision: 1,
          eventId: createdEvent!.eventId,
          artifactIds: [
            createdManifest.artifactId,
            "artifact:task-operation-journal",
          ],
          idempotentReplay: false,
        },
      };
      const createdReceipt = TaskOperationReceiptV1Schema.parse({
        schemaVersion: 1,
        operation: "task_created",
        taskId: FIXTURE_TASK_ID,
        eventId: createdEvent!.eventId,
        resultDigest: sha256CanonicalJson(createdResult),
        result: createdResult,
      });
      const createdRecord = IdempotencyRecordV1Schema.parse({
        schemaVersion: 1,
        worktreeId: FIXTURE_WORKTREE_ID,
        scope: {
          kind: "task_create",
          createScope: "hard-exit-recovery",
        },
        idempotencyKey: createdEvent!.idempotencyKey,
        actor: createdEvent!.actor,
        requestDigest: createdEvent!.requestDigest,
        taskId: FIXTURE_TASK_ID,
        resultRevision: 1,
        eventId: createdEvent!.eventId,
        resultDigest: createdReceipt.resultDigest,
        createdAt: createdEvent!.occurredAt,
      });
      const createdJournal = journalAt(
        1,
        CREATED_AT,
        [createdRecord],
        [createdReceipt],
      );
      await store.persistTaskBundle(
        {
          artifacts: [createdManifest, createdJournal],
          events: [createdEvent!],
          idempotencyRecords: [createdRecord],
        },
        {
          expectedRevision: 0,
          idempotencyKey: createdRecord.idempotencyKey,
          requestDigest: createdRecord.requestDigest,
        },
      );
      const oldCanonicalBytes = new Map(
        await Promise.all(
          [
            store.layout.manifest,
            store.layout.task(FIXTURE_TASK_ID).taskManifest,
            store.layout.task(FIXTURE_TASK_ID).operationJournal,
            store.layout.task(FIXTURE_TASK_ID).events,
          ].map(async (targetPath) => [
            targetPath,
            await readFile(targetPath),
          ] as const),
        ),
      );

      const blockedManifest = taskManifestAt(
        reference,
        2,
        "blocked",
        BLOCKED_AT,
      );
      const eventWithoutDigest = TaskEventV1Schema.parse({
        schemaVersion: 1,
        eventId: "event:hard-exit-blocked",
        repositoryId: FIXTURE_REPOSITORY_ID,
        worktreeId: FIXTURE_WORKTREE_ID,
        taskId: FIXTURE_TASK_ID,
        previousRevision: 1,
        revision: 2,
        actor: "developer",
        idempotencyKey: "hard-exit-block-request",
        requestDigest: sha256CanonicalJson({
          operation: "hard-exit-block",
        }),
        sourceSnapshotId: "snapshot:actual",
        occurredAt: BLOCKED_AT,
        previousStatus: "created",
        resultingStatus: "blocked",
        action: {
          type: "block_task",
          reasonCode: "hard_exit",
          message: "Exercise durable whole-task recovery.",
        },
        previousEventDigest: createdEvent!.eventDigest,
        eventDigest: sha256Bytes("placeholder"),
      });
      const blockedEvent = TaskEventV1Schema.parse({
        ...eventWithoutDigest,
        eventDigest: sha256Bytes(
          canonicalTaskEventDigestJsonV1(eventWithoutDigest),
        ),
      });
      const blockedResult = {
        task: blockedManifest.payload,
        mutation: {
          taskId: FIXTURE_TASK_ID,
          revision: 2,
          eventId: blockedEvent.eventId,
          artifactIds: [
            blockedManifest.artifactId,
            "artifact:task-operation-journal",
          ],
          idempotentReplay: false,
        },
      };
      const blockedReceipt = TaskOperationReceiptV1Schema.parse({
        schemaVersion: 1,
        operation: "update_task",
        taskId: FIXTURE_TASK_ID,
        eventId: blockedEvent.eventId,
        resultDigest: sha256CanonicalJson(blockedResult),
        result: blockedResult,
      });
      const blockedRecord = IdempotencyRecordV1Schema.parse({
        schemaVersion: 1,
        worktreeId: FIXTURE_WORKTREE_ID,
        scope: { kind: "task", taskId: FIXTURE_TASK_ID },
        idempotencyKey: blockedEvent.idempotencyKey,
        actor: blockedEvent.actor,
        requestDigest: blockedEvent.requestDigest,
        taskId: FIXTURE_TASK_ID,
        resultRevision: 2,
        eventId: blockedEvent.eventId,
        resultDigest: blockedReceipt.resultDigest,
        createdAt: blockedEvent.occurredAt,
      });
      const blockedJournal = journalAt(
        2,
        BLOCKED_AT,
        [createdRecord, blockedRecord],
        [createdReceipt, blockedReceipt],
      );
      const input = {
        artifacts: [blockedManifest, blockedJournal],
        events: [createdEvent!, blockedEvent],
        idempotencyRecords: [createdRecord, blockedRecord],
      };
      const persistOptions = {
        expectedRevision: 1,
        idempotencyKey: blockedRecord.idempotencyKey,
        requestDigest: blockedRecord.requestDigest,
      };
      const transactionPath = path.join(
        root,
        `hard-exit-${crashTarget}.json`,
      );
      await writeFile(
        transactionPath,
        `${JSON.stringify({
          storeOptions: {
            repositoryId: FIXTURE_REPOSITORY_ID,
            worktreeId: FIXTURE_WORKTREE_ID,
            producerVersion: FIXTURE_PRODUCER_VERSION,
          },
          input,
          persistOptions,
        })}\n`,
        "utf8",
      );

      await expect(
        runCrashChild(root, transactionPath, crashTarget),
      ).resolves.toBe(86);

      const reopened = await ArtifactStore.open(root, {
        repositoryId: FIXTURE_REPOSITORY_ID,
        worktreeId: FIXTURE_WORKTREE_ID,
        producerVersion: FIXTURE_PRODUCER_VERSION,
        lock: {
          timeoutMs: 1_000,
          staleAfterMs: 1,
          pollMinMs: 2,
          pollMaxMs: 5,
        },
      });
      await reopened.initialize();
      const recovered = await reopened.readTaskBundle(FIXTURE_TASK_ID);
      expect(recovered).toMatchObject({
        bundle: { manifest: { revision: recoveredRevision } },
        receipts: { length: recoveredRevision },
      });
      expect(recovered.bundle.events).toHaveLength(recoveredRevision);
      expect(recovered.artifacts).toHaveLength(2);
      const oldOperation = await reopened.lookupTaskOperationReceipt(
        FIXTURE_TASK_ID,
        createdRecord.scope,
        createdRecord.idempotencyKey,
      );
      expect(oldOperation).toEqual({
        record: createdRecord,
        receipt: createdReceipt,
      });
      if (recoveredRevision === 1) {
        expect(recovered.bundle.events).toEqual([createdEvent]);
        expect(recovered.receipts).toEqual([createdReceipt]);
        for (const [targetPath, oldBytes] of oldCanonicalBytes) {
          expect(await readFile(targetPath)).toEqual(oldBytes);
        }
      } else {
        expect(recovered.bundle.events).toEqual([
          createdEvent,
          blockedEvent,
        ]);
        expect(recovered.receipts).toEqual([
          createdReceipt,
          blockedReceipt,
        ]);
      }
      await expect(
        reopened.persistTaskBundle(input, persistOptions),
      ).resolves.toMatchObject({
        replayed,
        bundle: { manifest: { revision: 2, status: "blocked" } },
      });
      expect(
        (await readdir(reopened.layout.taskTransactions)).filter(
          (entry) => entry.endsWith(".json"),
        ),
      ).toEqual([]);
    },
  );
});
