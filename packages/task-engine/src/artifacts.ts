import { createHash } from "node:crypto";

import {
  canonicalTaskEventDigestJsonV1,
  parsePersistedArtifactV1,
  TaskEventV1Schema,
  type ClaimV1,
  type ContentDigest,
  type EvidenceV1,
  type IdempotencyRecordV1,
  type ImpactPathV1,
  type MutationResultV1,
  type PersistedArtifactV1,
  type TaskBriefV1,
  type TaskEventActionV1,
  type TaskEventV1,
  type TaskManifestV1,
  type TaskOperationReceiptV1,
} from "@understand-code/contracts";

import { sha256CanonicalJson } from "./ids.js";

const artifactId = (type: string, taskId: string): string =>
  `artifact:${type}:${taskId}`;

export interface TaskArtifactBuildInput {
  manifest: TaskManifestV1;
  brief?: TaskBriefV1;
  claims?: readonly ClaimV1[];
  evidence?: readonly EvidenceV1[];
  impactPaths?: readonly ImpactPathV1[];
  changeCheck?: unknown;
  verificationRecords?: readonly unknown[];
  idempotencyRecords: readonly IdempotencyRecordV1[];
  receipts: readonly TaskOperationReceiptV1[];
  createdAt: string;
}

function envelope(
  input: TaskArtifactBuildInput,
  artifactType: PersistedArtifactV1["artifactType"],
  payload: unknown,
): PersistedArtifactV1 {
  return parsePersistedArtifactV1({
    schemaVersion: 1,
    artifactType,
    artifactId: artifactId(artifactType, input.manifest.taskId),
    repositoryId: input.manifest.repositoryId,
    worktreeId: input.manifest.worktreeId,
    sourceSnapshotId: input.manifest.latestSnapshotId,
    taskId: input.manifest.taskId,
    revision: input.manifest.revision,
    producerVersion: input.manifest.producerVersion,
    createdAt: input.createdAt,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

export function buildTaskArtifacts(
  input: TaskArtifactBuildInput,
): PersistedArtifactV1[] {
  const artifacts = [
    envelope(input, "task_manifest", input.manifest),
  ];
  if (input.brief !== undefined) {
    artifacts.push(
      envelope(input, "task_brief", input.brief),
      envelope(input, "claim_ledger", {
        claims: [...(input.claims ?? [])],
      }),
      envelope(input, "evidence_ledger", {
        evidence: [...(input.evidence ?? [])],
      }),
      envelope(input, "impact", {
        paths: [...(input.impactPaths ?? [])],
      }),
    );
  }
  artifacts.push(
    envelope(input, "task_operation_journal", {
      idempotencyRecords: [...input.idempotencyRecords],
      receipts: [...input.receipts],
    }),
  );
  if (input.changeCheck !== undefined) {
    artifacts.push(envelope(input, "change_check", input.changeCheck));
  }
  if (input.verificationRecords !== undefined) {
    artifacts.push(
      envelope(input, "verification", {
        records: [...input.verificationRecords],
      }),
    );
  }
  return artifacts;
}

export interface TaskEventBuildInput {
  manifest: TaskManifestV1;
  previousManifest?: TaskManifestV1;
  previousEvent?: TaskEventV1;
  action: TaskEventActionV1;
  actor: string;
  idempotencyKey: string;
  requestDigest: ContentDigest;
  occurredAt: string;
}

export function buildTaskEvent(input: TaskEventBuildInput): TaskEventV1 {
  const eventWithoutDigest = {
    schemaVersion: 1 as const,
    eventId: `event:${input.manifest.taskId}:${input.manifest.revision}`,
    repositoryId: input.manifest.repositoryId,
    worktreeId: input.manifest.worktreeId,
    taskId: input.manifest.taskId,
    previousRevision: input.manifest.revision - 1,
    revision: input.manifest.revision,
    actor: input.actor,
    idempotencyKey: input.idempotencyKey,
    requestDigest: input.requestDigest,
    sourceSnapshotId: input.manifest.latestSnapshotId,
    occurredAt: input.occurredAt,
    ...(input.previousManifest === undefined
      ? {}
      : { previousStatus: input.previousManifest.status }),
    resultingStatus: input.manifest.status,
    action: input.action,
    ...(input.previousEvent === undefined
      ? {}
      : { previousEventDigest: input.previousEvent.eventDigest }),
  };
  const eventWithPlaceholder = {
    ...eventWithoutDigest,
    eventDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  };
  return TaskEventV1Schema.parse({
    ...eventWithoutDigest,
    eventDigest: sha256CanonicalEvent(eventWithPlaceholder),
  });
}

function sha256CanonicalEvent(event: TaskEventV1): ContentDigest {
  const canonical = canonicalTaskEventDigestJsonV1(event);
  return `sha256:${createHash("sha256")
    .update(canonical, "utf8")
    .digest("hex")}`;
}

export function mutationResult(
  task: TaskManifestV1,
  event: TaskEventV1,
  artifactIds: readonly string[],
  idempotentReplay = false,
): MutationResultV1 {
  return {
    taskId: task.taskId,
    revision: task.revision,
    eventId: event.eventId,
    artifactIds: [...artifactIds],
    idempotentReplay,
  };
}
