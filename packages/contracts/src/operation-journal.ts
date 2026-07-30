import { z } from "zod";

import { createArtifactEnvelopeV1Schema } from "./artifact-envelope.js";
import {
  ChangeCheckV1Schema,
  VerificationRecordV1Schema,
} from "./change.js";
import {
  ClaimIdSchema,
  ContentDigestSchema,
  EvidenceIdSchema,
  EventIdSchema,
  SchemaVersionV1Schema,
  TaskIdSchema,
} from "./primitives.js";
import {
  IdempotencyRecordV1Schema,
  MutationResultV1Schema,
  TaskBriefV1Schema,
  TaskManifestV1Schema,
} from "./task.js";

const TaskAndMutationResultV1Schema = z.strictObject({
  task: TaskManifestV1Schema,
  mutation: MutationResultV1Schema,
});

const BuildTaskBriefReceiptResultV1Schema =
  TaskAndMutationResultV1Schema.extend({
    brief: TaskBriefV1Schema,
    claimIds: z.array(ClaimIdSchema),
    evidenceIds: z.array(EvidenceIdSchema),
  });

const CheckChangeReceiptResultV1Schema = z.strictObject({
  changeCheck: ChangeCheckV1Schema,
  mutation: MutationResultV1Schema,
});

const RecordVerificationReceiptResultV1Schema = z.strictObject({
  verification: VerificationRecordV1Schema,
  mutation: MutationResultV1Schema,
});

const receiptCommonShape = {
  schemaVersion: SchemaVersionV1Schema,
  taskId: TaskIdSchema,
  eventId: EventIdSchema,
  resultDigest: ContentDigestSchema,
};

export const TaskOperationReceiptV1Schema = z
  .discriminatedUnion("operation", [
    z.strictObject({
      ...receiptCommonShape,
      operation: z.literal("task_created"),
      result: TaskAndMutationResultV1Schema,
    }),
    z.strictObject({
      ...receiptCommonShape,
      operation: z.literal("build_task_brief"),
      result: BuildTaskBriefReceiptResultV1Schema,
    }),
    z.strictObject({
      ...receiptCommonShape,
      operation: z.literal("update_task"),
      result: TaskAndMutationResultV1Schema,
    }),
    z.strictObject({
      ...receiptCommonShape,
      operation: z.literal("check_change"),
      result: CheckChangeReceiptResultV1Schema,
    }),
    z.strictObject({
      ...receiptCommonShape,
      operation: z.literal("record_verification"),
      result: RecordVerificationReceiptResultV1Schema,
    }),
  ])
  .superRefine((receipt, context) => {
    const mutation = receipt.result.mutation;
    if (mutation.idempotentReplay) {
      context.addIssue({
        code: "custom",
        message:
          "persisted operation receipts must contain the original non-replay mutation result",
        path: ["result", "mutation", "idempotentReplay"],
      });
    }
    if (
      mutation.taskId !== receipt.taskId ||
      mutation.eventId !== receipt.eventId
    ) {
      context.addIssue({
        code: "custom",
        message:
          "operation receipt identity must match its persisted mutation result",
        path: ["result", "mutation"],
      });
    }
    if (
      (receipt.operation === "task_created" ||
        receipt.operation === "build_task_brief" ||
        receipt.operation === "update_task") &&
      (receipt.result.task.taskId !== receipt.taskId ||
        receipt.result.task.revision !== mutation.revision)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "operation receipt Task Manifest must match its mutation identity and revision",
        path: ["result", "task"],
      });
    }
    if (
      receipt.operation === "check_change" &&
      (receipt.result.changeCheck.taskId !== receipt.taskId ||
        receipt.result.changeCheck.taskRevision !== mutation.revision)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Change Check receipt must match its mutation Task and revision",
        path: ["result", "changeCheck"],
      });
    }
    if (
      receipt.operation === "record_verification" &&
      receipt.result.verification.taskId !== receipt.taskId
    ) {
      context.addIssue({
        code: "custom",
        message: "Verification receipt must match its mutation Task",
        path: ["result", "verification", "taskId"],
      });
    }
  });

export type TaskOperationReceiptV1 = z.infer<
  typeof TaskOperationReceiptV1Schema
>;

export const TaskOperationJournalPayloadV1Schema = z
  .strictObject({
    idempotencyRecords: z.array(IdempotencyRecordV1Schema).min(1),
    receipts: z.array(TaskOperationReceiptV1Schema).min(1),
  })
  .superRefine((journal, context) => {
    const receipts = new Map(
      journal.receipts.map((receipt) => [receipt.eventId, receipt]),
    );
    if (receipts.size !== journal.receipts.length) {
      context.addIssue({
        code: "custom",
        message: "operation receipt eventIds must be unique",
        path: ["receipts"],
      });
    }
    const recordEvents = new Set<string>();
    journal.idempotencyRecords.forEach((record, index) => {
      if (recordEvents.has(record.eventId)) {
        context.addIssue({
          code: "custom",
          message: "operation journal idempotency eventIds must be unique",
          path: ["idempotencyRecords", index, "eventId"],
        });
      }
      recordEvents.add(record.eventId);
      const receipt = receipts.get(record.eventId);
      if (
        receipt === undefined ||
        receipt.taskId !== record.taskId ||
        receipt.result.mutation.revision !== record.resultRevision ||
        receipt.resultDigest !== record.resultDigest
      ) {
        context.addIssue({
          code: "custom",
          message:
            "every idempotency record must map to one matching operation receipt",
          path: ["idempotencyRecords", index],
        });
      }
    });
    journal.receipts.forEach((receipt, index) => {
      if (!recordEvents.has(receipt.eventId)) {
        context.addIssue({
          code: "custom",
          message:
            "every operation receipt must map to one idempotency record",
          path: ["receipts", index],
        });
      }
    });
  });

export type TaskOperationJournalPayloadV1 = z.infer<
  typeof TaskOperationJournalPayloadV1Schema
>;

export const TaskOperationJournalArtifactV1Schema =
  createArtifactEnvelopeV1Schema(
    "task_operation_journal",
    TaskOperationJournalPayloadV1Schema,
  ).superRefine((artifact, context) => {
    const taskId = artifact.taskId;
    const latestRevision = Math.max(
      ...artifact.payload.idempotencyRecords.map(
        (record) => record.resultRevision,
      ),
    );
    if (
      taskId === undefined ||
      artifact.payload.idempotencyRecords.some(
        (record) => record.taskId !== taskId,
      ) ||
      artifact.payload.receipts.some((receipt) => receipt.taskId !== taskId)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "operation journal envelope and every persisted record must use the same Task ID",
        path: ["taskId"],
      });
    }
    if (artifact.revision !== latestRevision) {
      context.addIssue({
        code: "custom",
        message:
          "operation journal revision must equal its latest idempotency result revision",
        path: ["revision"],
      });
    }
  });

export type TaskOperationJournalArtifactV1 = z.infer<
  typeof TaskOperationJournalArtifactV1Schema
>;

export interface TaskOperationReceiptIntegrityV1 {
  valid: boolean;
  expectedDigest: string;
  actualDigest: string;
}

export function verifyTaskOperationReceiptV1(
  receipt: TaskOperationReceiptV1,
  digestCanonicalResult: (result: unknown) => string,
): TaskOperationReceiptIntegrityV1 {
  const actualDigest = ContentDigestSchema.parse(
    digestCanonicalResult(receipt.result),
  );
  return {
    valid: actualDigest === receipt.resultDigest,
    expectedDigest: receipt.resultDigest,
    actualDigest,
  };
}
