import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../src/canonical-json.js";
import {
  TaskArtifactBundleV1Schema,
  type TaskArtifactBundleV1,
} from "../src/invariants.js";
import {
  TaskOperationJournalArtifactV1Schema,
  TaskOperationJournalPayloadV1Schema,
  TaskOperationReceiptV1Schema,
  verifyTaskOperationReceiptV1,
} from "../src/operation-journal.js";

const sha256CanonicalJson = (value: unknown): string =>
  `sha256:${createHash("sha256")
    .update(canonicalizeJson(value), "utf8")
    .digest("hex")}`;

async function referenceBundle(): Promise<TaskArtifactBundleV1> {
  const fixtureUrl = new URL(
    "../fixtures/v1/reference/task-bundle.json",
    import.meta.url,
  );
  return JSON.parse(await readFile(fixtureUrl, "utf8")) as TaskArtifactBundleV1;
}

describe("Task operation journal", () => {
  it("binds every complete idempotency record to a digest-verified historical result", async () => {
    const bundle = await referenceBundle();
    const record = bundle.idempotencyRecords.at(-1)!;
    const result = {
      task: bundle.manifest,
      mutation: {
        taskId: bundle.manifest.taskId,
        revision: bundle.manifest.revision,
        eventId: record.eventId,
        artifactIds: [],
        idempotentReplay: false,
      },
    };
    const resultDigest = sha256CanonicalJson(result);
    const receipt = {
      schemaVersion: 1 as const,
      operation: "update_task" as const,
      taskId: bundle.manifest.taskId,
      eventId: record.eventId,
      resultDigest,
      result,
    };
    const payload = TaskOperationJournalPayloadV1Schema.parse({
      idempotencyRecords: [{ ...record, resultDigest }],
      receipts: [receipt],
    });
    expect(
      verifyTaskOperationReceiptV1(receipt, sha256CanonicalJson),
    ).toMatchObject({ valid: true });

    expect(
      TaskOperationJournalArtifactV1Schema.safeParse({
        schemaVersion: 1,
        artifactType: "task_operation_journal",
        artifactId: "artifact:operation-journal",
        repositoryId: bundle.manifest.repositoryId,
        worktreeId: bundle.manifest.worktreeId,
        sourceSnapshotId: bundle.manifest.latestSnapshotId,
        taskId: bundle.manifest.taskId,
        revision: bundle.manifest.revision,
        producerVersion: bundle.manifest.producerVersion,
        createdAt: bundle.manifest.updatedAt,
        contentDigest: sha256CanonicalJson(payload),
        payload,
      }).success,
    ).toBe(true);
  });

  it("rejects a receipt whose result digest was changed", async () => {
    const bundle = await referenceBundle();
    const record = bundle.idempotencyRecords.at(-1)!;
    const receipt = {
      schemaVersion: 1 as const,
      operation: "update_task" as const,
      taskId: bundle.manifest.taskId,
      eventId: record.eventId,
      resultDigest: record.resultDigest,
      result: {
        task: bundle.manifest,
        mutation: {
          taskId: bundle.manifest.taskId,
          revision: bundle.manifest.revision,
          eventId: record.eventId,
          artifactIds: [],
          idempotentReplay: false,
        },
      },
    };
    expect(
      verifyTaskOperationReceiptV1(receipt, sha256CanonicalJson).valid,
    ).toBe(false);
  });

  it("rejects a persisted receipt marked as an idempotent replay", async () => {
    const bundle = await referenceBundle();
    const record = bundle.idempotencyRecords.at(-1)!;
    const result = {
      task: bundle.manifest,
      mutation: {
        taskId: bundle.manifest.taskId,
        revision: bundle.manifest.revision,
        eventId: record.eventId,
        artifactIds: [],
        idempotentReplay: true,
      },
    };
    const parsed = TaskOperationReceiptV1Schema.safeParse({
      schemaVersion: 1,
      operation: "update_task",
      taskId: bundle.manifest.taskId,
      eventId: record.eventId,
      resultDigest: sha256CanonicalJson(result),
      result,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((issue) =>
          issue.message.includes("original non-replay"),
        ),
      ).toBe(true);
    }
  });
});

describe("Task exceptional lifecycle projection", () => {
  it("rejects an idempotency record whose audit time differs from its Event", async () => {
    const bundle = structuredClone(await referenceBundle());
    bundle.idempotencyRecords[0]!.createdAt =
      "2026-07-28T00:00:00.000Z";

    const parsed = TaskArtifactBundleV1Schema.safeParse(bundle);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((issue) =>
          issue.message.includes("audit time"),
        ),
      ).toBe(true);
    }
  });

  it.each([
    ["blocked", "blocked"],
    ["stale", "stale"],
    ["verified", "verified"],
    ["superseded", "superseded"],
  ] as const)(
    "rejects %s Tasks performing a normal confirmation",
    async (previousStatus, resultingStatus) => {
      const bundle = structuredClone(await referenceBundle());
      const event = bundle.events[2]!;
      event.previousStatus = previousStatus;
      event.resultingStatus = resultingStatus;

      const parsed = TaskArtifactBundleV1Schema.safeParse(bundle);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const expected =
          previousStatus === "blocked"
            ? "blocked Tasks only allow"
            : previousStatus === "stale"
              ? "stale Tasks only allow"
              : "verified and superseded Tasks are terminal";
        expect(
          parsed.error.issues.some((issue) =>
            issue.message.includes(expected),
          ),
        ).toBe(true);
      }
    },
  );

  it("rejects resume_task when it skips the status captured by block_task", async () => {
    const bundle = structuredClone(await referenceBundle());
    const blocked = bundle.events[6]!;
    const resumed = bundle.events[7]!;
    blocked.previousStatus = "planned";
    blocked.resultingStatus = "blocked";
    blocked.action = {
      type: "block_task",
      reasonCode: "waiting_for_owner",
      message: "Owner input is required.",
    };
    resumed.previousStatus = "blocked";
    resumed.resultingStatus = "check_required";
    resumed.action = { type: "resume_task" };

    const parsed = TaskArtifactBundleV1Schema.safeParse(bundle);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((issue) =>
          issue.message.includes("exact status captured"),
        ),
      ).toBe(true);
    }
  });
});
