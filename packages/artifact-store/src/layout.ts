import path from "node:path";

import {
  ArtifactTypeV1Schema,
  TaskIdSchema,
  type ArtifactTypeV1,
  type TaskId,
} from "@understand-code/contracts";

import {
  assertSafeIdentifierSegment,
  canonicalizeWorktreeRoot,
} from "./path-guard.js";

export const STORE_DIRECTORY = ".understand-code";

export interface TaskDirectoryLayout {
  readonly root: string;
  readonly taskManifest: string;
  readonly taskBrief: string;
  readonly taskBriefMarkdown: string;
  readonly claims: string;
  readonly evidence: string;
  readonly impact: string;
  readonly operationJournal: string;
  readonly changeCheck: string;
  readonly verification: string;
  readonly events: string;
  readonly idempotency: string;
}

export interface ArtifactStoreLayout {
  readonly worktreeRoot: string;
  readonly storeRoot: string;
  readonly repository: string;
  readonly manifest: string;
  readonly repoPulse: string;
  readonly repoPulseHistory: string;
  readonly snapshots: string;
  readonly knowledgeGraph: string;
  readonly fingerprints: string;
  readonly knowledgeBase: string;
  readonly tasks: string;
  readonly locks: string;
  readonly recovery: string;
  readonly backups: string;
  readonly quarantine: string;
  readonly migrations: string;
  readonly pulseTransactions: string;
  readonly taskTransactions: string;
  readonly repositoryLock: string;
  task(taskId: string): TaskDirectoryLayout;
  taskLock(taskId: string): string;
  repoPulseHistoryVersion(versionKey: string): string;
  readonly repoPulseTransactionMarker: string;
  taskTransactionMarker(taskId: string): string;
  snapshot(snapshotId: string): string;
  artifact(artifactType: ArtifactTypeV1, options?: {
    taskId?: string;
    snapshotId?: string;
  }): string;
}

function buildTaskLayout(tasksRoot: string, taskIdInput: string): TaskDirectoryLayout {
  const taskId = TaskIdSchema.parse(taskIdInput);
  const root = path.join(tasksRoot, taskId);
  return Object.freeze({
    root,
    taskManifest: path.join(root, "task.json"),
    taskBrief: path.join(root, "task-brief.json"),
    taskBriefMarkdown: path.join(root, "task-brief.md"),
    claims: path.join(root, "claims.json"),
    evidence: path.join(root, "evidence.json"),
    impact: path.join(root, "impact.json"),
    operationJournal: path.join(root, "operation-journal.json"),
    changeCheck: path.join(root, "change-check.json"),
    verification: path.join(root, "verification.json"),
    events: path.join(root, "events.jsonl"),
    idempotency: path.join(root, ".idempotency.json"),
  });
}

export async function createArtifactStoreLayout(
  worktreeRoot: string,
): Promise<ArtifactStoreLayout> {
  const canonicalRoot = await canonicalizeWorktreeRoot(worktreeRoot);
  const storeRoot = path.join(canonicalRoot, STORE_DIRECTORY);
  const tasks = path.join(storeRoot, "tasks");
  const locks = path.join(storeRoot, ".locks");
  const recovery = path.join(storeRoot, ".recovery");
  const snapshots = path.join(storeRoot, "snapshots");
  const repoPulseHistory = path.join(storeRoot, "pulses");
  const pulseTransactions = path.join(recovery, "pulse-transactions");

  const layout: ArtifactStoreLayout = {
    worktreeRoot: canonicalRoot,
    storeRoot,
    repository: path.join(storeRoot, "repository.json"),
    manifest: path.join(storeRoot, "artifact-manifest.json"),
    repoPulse: path.join(storeRoot, "repo-pulse.json"),
    repoPulseHistory,
    snapshots,
    knowledgeGraph: path.join(storeRoot, "knowledge-graph.json"),
    fingerprints: path.join(storeRoot, "fingerprints.json"),
    knowledgeBase: path.join(storeRoot, "knowledge-base"),
    tasks,
    locks,
    recovery,
    backups: path.join(recovery, "backups"),
    quarantine: path.join(recovery, "quarantine"),
    migrations: path.join(recovery, "migrations"),
    pulseTransactions,
    taskTransactions: path.join(recovery, "task-transactions"),
    repositoryLock: path.join(locks, "repository.lock"),
    task(taskId: string): TaskDirectoryLayout {
      return buildTaskLayout(tasks, taskId);
    },
    taskLock(taskId: string): string {
      const validated = TaskIdSchema.parse(taskId);
      return path.join(locks, "tasks", `${validated}.lock`);
    },
    repoPulseHistoryVersion(versionKey: string): string {
      const validated = assertSafeIdentifierSegment(
        versionKey,
        "Repo Pulse version key",
      );
      return path.join(repoPulseHistory, `${validated}.json`);
    },
    repoPulseTransactionMarker: path.join(
      pulseTransactions,
      "current.json",
    ),
    taskTransactionMarker(taskId: string): string {
      const validated = TaskIdSchema.parse(taskId);
      return path.join(recovery, "task-transactions", `${validated}.json`);
    },
    snapshot(snapshotId: string): string {
      const safeSnapshotId = assertSafeIdentifierSegment(
        snapshotId,
        "snapshotId",
      );
      return path.join(snapshots, `${safeSnapshotId}.json`);
    },
    artifact(
      artifactTypeInput: ArtifactTypeV1,
      options: { taskId?: string; snapshotId?: string } = {},
    ): string {
      const artifactType = ArtifactTypeV1Schema.parse(artifactTypeInput);
      if (artifactType === "repository_snapshot") {
        if (options.snapshotId === undefined) {
          throw new TypeError("repository_snapshot requires snapshotId");
        }
        return layout.snapshot(options.snapshotId);
      }
      if (artifactType === "repo_pulse") return layout.repoPulse;
      if (options.taskId === undefined) {
        throw new TypeError(`${artifactType} requires taskId`);
      }
      const taskLayout = layout.task(options.taskId);
      const taskArtifactPaths: Record<Exclude<ArtifactTypeV1, "repository_snapshot" | "repo_pulse">, string> = {
        task_manifest: taskLayout.taskManifest,
        task_brief: taskLayout.taskBrief,
        claim_ledger: taskLayout.claims,
        evidence_ledger: taskLayout.evidence,
        impact: taskLayout.impact,
        task_operation_journal: taskLayout.operationJournal,
        change_check: taskLayout.changeCheck,
        verification: taskLayout.verification,
      };
      return taskArtifactPaths[artifactType];
    },
  };
  return Object.freeze(layout);
}

export function taskDirectoryName(taskId: TaskId): string {
  return TaskIdSchema.parse(taskId);
}
