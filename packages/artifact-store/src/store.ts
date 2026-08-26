import { randomUUID } from "node:crypto";
import {
  readdir,
  rename,
  rmdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import {
  ActorSchema,
  ArtifactDependencyV1Schema,
  ArtifactDescriptorV1Schema,
  ArtifactManifestV1Schema,
  ArtifactTypeV1Schema,
  ContentDigestSchema,
  IdempotencyScopeV1Schema,
  IdempotencyKeySchema,
  IsoTimestampSchema,
  KeyedStateTokenV1Schema,
  PathSafeRepositorySnapshotIdV1Schema,
  ProducerVersionSchema,
  RepositoryIdSchema,
  TaskIdSchema,
  TaskManifestV1Schema,
  WorktreeIdSchema,
  canonicalizeJson,
  migrateArtifactValueV1,
  parsePersistedArtifactV1,
  verifyTaskOperationReceiptV1,
  type Actor,
  verifyArtifactContentDigestV1,
  type ArtifactDependencyV1,
  type ArtifactDescriptorFreshnessV1,
  type ArtifactDescriptorStateV1,
  type ArtifactManifestV1,
  type ArtifactTypeV1,
  type ContentDigest,
  type JsonValue,
  type IdempotencyRecordV1,
  type IdempotencyScopeV1,
  type MigrationStepV1,
  type PersistedArtifactV1,
  type TaskArtifactBundleV1,
  type TaskEventV1,
  type TaskManifestV1,
  type TaskOperationReceiptV1,
} from "@understand-code/contracts";

import {
  appendTaskEvent as appendTaskEventFile,
  parseTrustedTaskBundle,
  readTaskEventLog,
  type AppendTaskEventOptions,
  type AppendTaskEventResult,
  type ParsedTaskEventLog,
} from "./event-log.js";
import {
  atomicWriteFile,
  atomicWriteJson,
  fsyncDirectory,
  readManagedFile,
  readManagedJson,
  type AtomicWriteOptions,
} from "./atomic.js";
import {
  digestCanonicalJson,
  sha256Bytes,
  sha256CanonicalJson,
} from "./digest.js";
import { ArtifactStoreError } from "./errors.js";
import {
  createArtifactStoreLayout,
  type ArtifactStoreLayout,
} from "./layout.js";
import {
  withStoreLock,
  type LockAcquireOptions,
} from "./lock.js";
import {
  assertManagedParentStable,
  ensureManagedDirectory,
  repositoryRelativePathFromAbsolute,
  resolveManagedPath,
} from "./path-guard.js";

interface StoreIdempotencyRecord {
  key: string;
  requestDigest: ContentDigest;
  /**
   * Legacy compact indexes did not persist the operation scope. New Task
   * transaction entries always persist scope and actor together; unscoped
   * entries remain valid for backwards compatibility and standalone Artifact
   * mutations.
   */
  scope?: IdempotencyScopeV1;
  actor?: Actor;
  artifactType: ArtifactTypeV1;
  artifactId: string;
  resultRevision: number;
  resultDigest: ContentDigest;
  recordedAt: string;
}

interface StoreIdempotencyIndex {
  version: 1;
  records: StoreIdempotencyRecord[];
}

type StoreIdempotencyControl = {
  key: string;
  requestDigest: ContentDigest;
} & (
  | { scope?: never; actor?: never }
  | { scope: IdempotencyScopeV1; actor: Actor }
);

export interface ArtifactStoreOptions {
  repositoryId: string;
  worktreeId: string;
  producerVersion: string;
  clock?: () => Date;
  lock?: LockAcquireOptions;
}

export interface PersistArtifactOptions {
  expectedRevision?: number;
  idempotencyKey?: string;
  requestDigest?: ContentDigest;
  dependencies?: readonly ArtifactDependencyV1[];
  state?: ArtifactDescriptorStateV1;
  freshness?: ArtifactDescriptorFreshnessV1;
  artifactWrite?: AtomicWriteOptions;
  /**
   * Fault-injection and durability control for the immutable history copy
   * created before a canonical Repo Pulse is replaced.
   */
  historyWrite?: AtomicWriteOptions;
  manifestWrite?: AtomicWriteOptions;
  promoteRecovery?: boolean;
}

export interface PersistArtifactResult<TArtifact extends PersistedArtifactV1> {
  artifact: TArtifact;
  descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>;
  replayed: boolean;
  backupPath?: string;
}

export interface ReadArtifactResult<TArtifact extends PersistedArtifactV1> {
  artifact: TArtifact;
  descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>;
  state: ArtifactDescriptorStateV1;
  freshness: ArtifactDescriptorFreshnessV1;
  latestSnapshotId?: string;
  recoveryState: "current" | "historical" | "read_only_recovery";
}

export interface ReadTaskEventsResult extends ParsedTaskEventLog {
  descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>;
  state: ArtifactDescriptorStateV1;
  freshness: ArtifactDescriptorFreshnessV1;
  latestSnapshotId?: string;
}

export interface ReadManifestOptions {
  verifyArtifacts?: boolean;
}

export interface MigrationExecutionOptions {
  relativePath: string;
  format: string;
  fromVersion: string;
  toVersion: string;
  steps: readonly MigrationStepV1[];
  validate: (value: unknown) => unknown | Promise<unknown>;
  write?: AtomicWriteOptions;
  manifestWrite?: AtomicWriteOptions;
  afterSwitch?: () => void | Promise<void>;
}

export interface MigrationExecutionResult {
  value: JsonValue;
  appliedVersions: string[];
  migrated: boolean;
  backupPath?: string;
}

export interface PersistTaskBundleInput {
  artifacts: readonly PersistedArtifactV1[];
  events: readonly TaskEventV1[];
  idempotencyRecords: readonly IdempotencyRecordV1[];
}

export interface PersistTaskBundleOptions {
  expectedRevision: number;
  idempotencyKey: string;
  requestDigest: ContentDigest;
  /**
   * Compatibility-only import of a previously validated, contiguous Event
   * history into an empty Store. Live Task mutations must leave this false.
   */
  historyImport?: boolean;
  dependenciesByArtifactId?: Readonly<
    Record<string, readonly ArtifactDependencyV1[]>
  >;
  artifactWrite?: AtomicWriteOptions;
  manifestWrite?: AtomicWriteOptions;
  promoteRecovery?: boolean;
}

export interface PersistTaskBundleResult {
  bundle: TaskArtifactBundleV1;
  artifacts: PersistedArtifactV1[];
  replayed: boolean;
}

export interface ReadTaskBundleResult {
  bundle: TaskArtifactBundleV1;
  artifacts: PersistedArtifactV1[];
  receipts: TaskOperationReceiptV1[];
  state: ArtifactDescriptorStateV1;
  freshness: ArtifactDescriptorFreshnessV1;
  latestSnapshotId?: string;
  recoveryState: "current" | "read_only_recovery";
}

export interface TaskOperationReceiptLookupResult {
  record: IdempotencyRecordV1;
  receipt: TaskOperationReceiptV1;
}

interface PreparedTaskBundle {
  bundle: TaskArtifactBundleV1;
  artifacts: PersistedArtifactV1[];
  taskId: string;
  revision: number;
  contextual: boolean;
}

interface TaskTransactionBytesV1 {
  contentBase64: string;
  contentDigest: ContentDigest;
}

interface TaskTransactionFileBackupV1 {
  relativePath: string;
  existed: boolean;
  contentBase64?: string;
  contentDigest?: ContentDigest;
}

interface PendingTaskTransactionMarkerV1 {
  version: 1;
  repositoryId: string;
  worktreeId: string;
  taskId: string;
  expectedRevision: number;
  targetRevision: number;
  createdAt: string;
  oldManifest: TaskTransactionBytesV1;
  oldFiles: TaskTransactionFileBackupV1[];
  targetDescriptors: ReturnType<typeof ArtifactDescriptorV1Schema.parse>[];
}

interface PendingRepoPulseTransactionMarkerV1 {
  version: 1;
  repositoryId: string;
  worktreeId: string;
  createdAt: string;
  oldManifest: TaskTransactionBytesV1;
  oldPulse: TaskTransactionBytesV1;
  historyExisted: boolean;
  historyDescriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>;
  targetDescriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>;
}

interface RepoPulseHistoryPublication {
  historyDescriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>;
}

interface TaskBundleWrite {
  path: string;
  content: string;
}

function idempotencyScopeKey(scope: IdempotencyScopeV1): string {
  return scope.kind === "task"
    ? `task:${scope.taskId}`
    : `task_create:${scope.createScope}`;
}

function storeIdempotencyIdentity(
  record: Pick<StoreIdempotencyRecord, "key" | "scope">,
): string {
  return record.scope === undefined
    ? `legacy\u0000${record.key}`
    : `scoped\u0000${idempotencyScopeKey(record.scope)}\u0000${record.key}`;
}

const TASK_CONTEXT_PAYLOAD_TYPES = [
  "task_brief",
  "claim_ledger",
  "evidence_ledger",
  "impact",
] as const satisfies readonly ArtifactTypeV1[];

const TASK_GUARDED_PAYLOAD_TYPES = [
  ...TASK_CONTEXT_PAYLOAD_TYPES,
  "change_check",
  "verification",
] as const satisfies readonly ArtifactTypeV1[];

const TASK_TRANSACTION_FILE_NAMES = new Set([
  "task.json",
  "task-brief.json",
  "claims.json",
  "evidence.json",
  "impact.json",
  "operation-journal.json",
  "change-check.json",
  "verification.json",
  "events.jsonl",
]);

interface TaskPayloadMutationPolicy {
  mutable: ReadonlySet<ArtifactTypeV1>;
  removable: ReadonlySet<ArtifactTypeV1>;
}

function taskPayloadMutationPolicy(
  previous: TaskManifestV1,
  event: TaskEventV1,
): TaskPayloadMutationPolicy {
  const mutable = new Set<ArtifactTypeV1>();
  const removable = new Set<ArtifactTypeV1>();
  const action = event.action;
  switch (action.type) {
    case "transition_status":
      if (
        previous.status === "created" &&
        action.to === "context_ready"
      ) {
        TASK_CONTEXT_PAYLOAD_TYPES.forEach((type) => mutable.add(type));
      } else if (
        (previous.status === "in_progress" ||
          previous.status === "verification_required") &&
        action.to === "check_required" &&
        previous.latestSnapshotId !== event.sourceSnapshotId
      ) {
        removable.add("change_check");
        removable.add("verification");
        mutable.add("claim_ledger");
      }
      break;
    case "refresh_task_context":
    case "rebase_task":
      TASK_CONTEXT_PAYLOAD_TYPES.forEach((type) => mutable.add(type));
      removable.add("change_check");
      removable.add("verification");
      break;
    case "confirm_goal":
    case "confirm_acceptance_criteria":
    case "record_assumption":
    case "confirm_unknown":
      // Human-confirmed Claims are required to backlink the newly produced
      // human Evidence, so these two ledgers form one semantic mutation.
      mutable.add("claim_ledger");
      mutable.add("evidence_ledger");
      break;
    case "accept_finding":
      mutable.add("change_check");
      break;
    case "change_checked":
      mutable.add("change_check");
      // New Findings require symmetric Finding Claims/backlinks.
      mutable.add("claim_ledger");
      // Findings may introduce diff Evidence and observed Impact paths while
      // the confirmed Task Brief remains immutable.
      mutable.add("evidence_ledger");
      mutable.add("impact");
      break;
    case "verification_recorded":
      // New Verification records require symmetric Claim backlinks.
      mutable.add("claim_ledger");
      mutable.add("verification");
      break;
    case "accept_verification_skip":
      mutable.add("verification");
      break;
    case "task_created":
    case "confirm_plan":
    case "block_task":
    case "resume_task":
      break;
    case "task_context_staled":
      removable.add("change_check");
      removable.add("verification");
      mutable.add("claim_ledger");
      break;
    case "supersede_task":
      if (previous.latestSnapshotId !== event.sourceSnapshotId) {
        removable.add("change_check");
        removable.add("verification");
        mutable.add("claim_ledger");
      }
      break;
  }
  return { mutable, removable };
}

function taskTransactionBytes(bytes: Uint8Array): TaskTransactionBytesV1 {
  return {
    contentBase64: Buffer.from(bytes).toString("base64"),
    contentDigest: sha256Bytes(bytes),
  };
}

function decodeTaskTransactionBytes(
  contentBase64: unknown,
  contentDigest: unknown,
  label: string,
): Buffer {
  if (
    typeof contentBase64 !== "string" ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u
      .test(contentBase64)
  ) {
    throw new ArtifactStoreError(
      "artifact_corrupt",
      `${label} is not canonical base64.`,
    );
  }
  const bytes = Buffer.from(contentBase64, "base64");
  if (bytes.toString("base64") !== contentBase64) {
    throw new ArtifactStoreError(
      "artifact_corrupt",
      `${label} is not canonical base64.`,
    );
  }
  const digest = ContentDigestSchema.parse(contentDigest);
  if (sha256Bytes(bytes) !== digest) {
    throw new ArtifactStoreError(
      "artifact_corrupt",
      `${label} does not match its durable digest.`,
      { expectedDigest: digest, actualDigest: sha256Bytes(bytes) },
    );
  }
  return bytes;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalTaskDescriptors(
  descriptors: readonly ReturnType<
    typeof ArtifactDescriptorV1Schema.parse
  >[],
): string {
  return canonicalizeJson(
    [...descriptors].sort((left, right) => {
      const typeOrder = compareCodeUnits(
        left.artifactType,
        right.artifactType,
      );
      if (typeOrder !== 0) return typeOrder;
      const idOrder = compareCodeUnits(left.artifactId, right.artifactId);
      return idOrder !== 0
        ? idOrder
        : compareCodeUnits(left.path, right.path);
    }),
  );
}

function parseIdempotencyIndex(input: unknown): StoreIdempotencyIndex {
  if (typeof input !== "object" || input === null) {
    throw new ArtifactStoreError(
      "artifact_corrupt",
      "Store idempotency index is not an object.",
    );
  }
  const candidate = input as {
    version?: unknown;
    records?: unknown;
  };
  if (candidate.version !== 1 || !Array.isArray(candidate.records)) {
    throw new ArtifactStoreError(
      "artifact_corrupt",
      "Store idempotency index has an unsupported shape.",
    );
  }
  const records = candidate.records.map((record, index) => {
    if (typeof record !== "object" || record === null) {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Store idempotency record is invalid.",
        { index },
      );
    }
    const value = record as Partial<StoreIdempotencyRecord>;
    const key = IdempotencyKeySchema.parse(value.key);
    const requestDigest = ContentDigestSchema.parse(value.requestDigest);
    const resultDigest = ContentDigestSchema.parse(value.resultDigest);
    const recordedAt = IsoTimestampSchema.parse(value.recordedAt);
    const scope =
      value.scope === undefined
        ? undefined
        : IdempotencyScopeV1Schema.parse(value.scope);
    const actor =
      value.actor === undefined ? undefined : ActorSchema.parse(value.actor);
    if ((scope === undefined) !== (actor === undefined)) {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Scoped Store idempotency records must persist scope and actor together.",
        { index },
      );
    }
    if (
      typeof value.artifactType !== "string" ||
      typeof value.artifactId !== "string" ||
      typeof value.resultRevision !== "number" ||
      !Number.isSafeInteger(value.resultRevision) ||
      value.resultRevision < 0
    ) {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Store idempotency record fields are invalid.",
        { index },
      );
    }
    return {
      key,
      requestDigest,
      ...(scope === undefined ? {} : { scope, actor: actor! }),
      artifactType: ArtifactTypeV1Schema.parse(value.artifactType),
      artifactId: value.artifactId,
      resultRevision: value.resultRevision,
      resultDigest,
      recordedAt,
    };
  });
  if (
    new Set(records.map(storeIdempotencyIdentity)).size !== records.length
  ) {
    throw new ArtifactStoreError(
      "artifact_corrupt",
      "Store idempotency index contains duplicate scope/key identities.",
    );
  }
  return { version: 1, records };
}

function compareArtifacts(
  left: PersistedArtifactV1,
  right: PersistedArtifactV1,
): boolean {
  return canonicalizeJson(left) === canonicalizeJson(right);
}

const UPDATE_TASK_ACTION_TYPES = new Set<TaskEventV1["action"]["type"]>([
  "confirm_goal",
  "confirm_acceptance_criteria",
  "confirm_plan",
  "record_assumption",
  "confirm_unknown",
  "transition_status",
  "accept_finding",
  "block_task",
  "resume_task",
  "task_context_staled",
  "refresh_task_context",
  "rebase_task",
  "supersede_task",
  "accept_verification_skip",
]);

function taskOperationReceiptEventIssue(
  receipt: TaskOperationReceiptV1,
  event: TaskEventV1,
): string | undefined {
  if (
    receipt.taskId !== event.taskId ||
    receipt.eventId !== event.eventId ||
    receipt.result.mutation.revision !== event.revision
  ) {
    return "operation receipt identity and revision must match its Task Event";
  }
  if (receipt.result.mutation.idempotentReplay) {
    return "persisted operation receipts must record the original non-replay mutation result";
  }
  if (
    receipt.operation === "task_created" ||
    receipt.operation === "build_task_brief" ||
    receipt.operation === "update_task"
  ) {
    const task = receipt.result.task;
    if (
      task.repositoryId !== event.repositoryId ||
      task.worktreeId !== event.worktreeId ||
      task.taskId !== event.taskId ||
      task.revision !== event.revision ||
      task.status !== event.resultingStatus ||
      task.latestSnapshotId !== event.sourceSnapshotId
    ) {
      return "operation receipt Task result must match the Event repository, worktree, snapshot, revision, and resulting status";
    }
  }
  switch (receipt.operation) {
    case "task_created":
      return event.action.type === "task_created"
        ? undefined
        : "task_created receipt requires a task_created Event";
    case "build_task_brief":
      return event.action.type === "transition_status" &&
          event.action.to === "context_ready"
        ? undefined
        : "build_task_brief receipt requires a transition_status Event to context_ready";
    case "update_task":
      return UPDATE_TASK_ACTION_TYPES.has(event.action.type)
        ? undefined
        : "update_task receipt requires an update_task action Event";
    case "check_change":
      if (
        event.action.type !== "change_checked" ||
        event.previousStatus !== "check_required" ||
        event.resultingStatus !== "check_required" ||
        event.action.changeCheckId !== receipt.result.changeCheck.id ||
        receipt.result.changeCheck.actualSnapshotId !==
          event.sourceSnapshotId
      ) {
        return "check_change receipt must match its change_checked Event and actual Snapshot";
      }
      return undefined;
    case "record_verification":
      if (
        event.action.type !== "verification_recorded" ||
        event.previousStatus !== "verification_required" ||
        event.resultingStatus !== "verification_required" ||
        event.action.verificationRecordId !==
          receipt.result.verification.id ||
        receipt.result.verification.snapshotId !== event.sourceSnapshotId ||
        receipt.result.verification.recordedAt !== event.occurredAt ||
        (!("profile" in receipt.result.verification) &&
          receipt.result.verification.actor !== event.actor)
      ) {
        return "record_verification receipt must match its verification_recorded Event status, Snapshot, and audit time";
      }
      return undefined;
  }
}

function taskIdempotencyRecordEventIssue(
  record: IdempotencyRecordV1,
  event: TaskEventV1,
): string | undefined {
  return record.taskId !== event.taskId ||
    record.worktreeId !== event.worktreeId ||
    record.eventId !== event.eventId ||
    record.idempotencyKey !== event.idempotencyKey ||
    record.actor !== event.actor ||
    record.requestDigest !== event.requestDigest ||
    record.resultRevision !== event.revision ||
    record.createdAt !== event.occurredAt
    ? "idempotency record identity, actor, request, revision, and audit time must match its Task Event"
    : undefined;
}

function taskManifestFromOperationReceipt(
  receipt: TaskOperationReceiptV1,
): TaskManifestV1 | undefined {
  switch (receipt.operation) {
    case "task_created":
    case "build_task_brief":
    case "update_task":
      return receipt.result.task;
    case "check_change":
    case "record_verification":
      return undefined;
  }
}

function taskOperationHistoryIssue(
  receipts: readonly TaskOperationReceiptV1[],
  events: readonly TaskEventV1[],
  finalTask: TaskManifestV1,
): string | undefined {
  if (receipts.length !== events.length || receipts.length === 0) {
    return "operation history must contain exactly one Receipt per Task Event";
  }
  let previous: TaskManifestV1 | undefined;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    const receipt = receipts[index]!;
    const receiptTask = taskManifestFromOperationReceipt(receipt);
    let candidate: TaskManifestV1;
    if (previous === undefined) {
      if (
        event.action.type !== "task_created" ||
        receipt.operation !== "task_created" ||
        receiptTask === undefined
      ) {
        return "operation history must begin with the complete task_created result";
      }
      candidate = receiptTask;
      if (candidate.updatedAt !== event.occurredAt) {
        return "task_created result update time must equal its Genesis Event time";
      }
    } else if (receiptTask !== undefined) {
      candidate = receiptTask;
      const transitionIssue = taskManifestTransitionIssue(
        previous,
        candidate,
        event,
      );
      if (transitionIssue !== undefined) {
        return `historical Task result is inconsistent at revision ${event.revision}: ${transitionIssue}`;
      }
    } else {
      const derived = TaskManifestV1Schema.safeParse({
        ...previous,
        revision: event.revision,
        updatedAt: event.occurredAt,
        status: event.resultingStatus,
        ...(event.sourceSnapshotId === undefined
          ? {}
          : { latestSnapshotId: event.sourceSnapshotId }),
      });
      if (!derived.success) {
        return `historical non-Task receipt cannot derive a valid Task projection at revision ${event.revision}`;
      }
      candidate = derived.data;
      const transitionIssue = taskManifestTransitionIssue(
        previous,
        candidate,
        event,
      );
      if (transitionIssue !== undefined) {
        return `historical non-Task result is inconsistent at revision ${event.revision}: ${transitionIssue}`;
      }
    }
    if (candidate.parentTaskId !== finalTask.parentTaskId) {
      return "historical Task result changed immutable parentTaskId";
    }
    previous = candidate;
  }
  return previous === undefined ||
    canonicalizeJson(previous) !== canonicalizeJson(finalTask)
      ? "operation history does not reconstruct the final committed Task Manifest"
      : undefined;
}

function taskSnapshotChangeAllowed(
  previous: TaskManifestV1,
  next: TaskManifestV1,
  event: TaskEventV1,
): boolean {
  const action = event.action;
  switch (action.type) {
    case "transition_status":
      return (
        (previous.status === "created" &&
          next.status === "context_ready" &&
          action.to === "context_ready") ||
        ((previous.status === "in_progress" ||
          previous.status === "verification_required") &&
          next.status === "check_required" &&
          action.to === "check_required")
      );
    case "task_context_staled":
      return (
        next.status === "stale" &&
        previous.status !== "stale" &&
        previous.status !== "verified" &&
        previous.status !== "superseded"
      );
    case "refresh_task_context":
    case "rebase_task":
      return previous.status === "stale" && next.status === "context_ready";
    case "supersede_task":
      return (
        next.status === "superseded" &&
        previous.status !== "verified" &&
        previous.status !== "superseded"
      );
    case "task_created":
    case "confirm_goal":
    case "confirm_acceptance_criteria":
    case "confirm_plan":
    case "record_assumption":
    case "confirm_unknown":
    case "accept_finding":
    case "accept_verification_skip":
    case "block_task":
    case "resume_task":
    case "change_checked":
    case "verification_recorded":
      return false;
  }
}

function taskManifestTransitionIssue(
  previous: TaskManifestV1,
  next: TaskManifestV1,
  event: TaskEventV1,
): string | undefined {
  if (
    next.taskId !== previous.taskId ||
    next.repositoryId !== previous.repositoryId ||
    next.worktreeId !== previous.worktreeId ||
    next.title !== previous.title ||
    next.originalIntent !== previous.originalIntent ||
    next.parentTaskId !== previous.parentTaskId ||
    next.createdAt !== previous.createdAt ||
    next.producerVersion !== previous.producerVersion
  ) {
    return "a live Task mutation changed immutable Task identity fields";
  }
  if (
    next.revision !== previous.revision + 1 ||
    next.revision !== event.revision ||
    next.updatedAt !== event.occurredAt ||
    event.previousStatus !== previous.status ||
    event.resultingStatus !== next.status ||
    event.sourceSnapshotId !== next.latestSnapshotId
  ) {
    return "Task Manifest revision, time, status, or Snapshot does not match its appended Event";
  }
  const action = event.action;
  if (
    next.latestSnapshotId !== previous.latestSnapshotId &&
    !taskSnapshotChangeAllowed(previous, next, event)
  ) {
    return `${event.action.type} cannot change the Task Snapshot across this Lifecycle transition`;
  }
  if (
    action.type === "transition_status" &&
    previous.status === "verification_required" &&
    next.status === "check_required" &&
    next.latestSnapshotId === previous.latestSnapshotId
  ) {
    return "verification_required can return to check_required only after the actual Repository Snapshot changes";
  }
  if (
    previous.status === "blocked" &&
    !["resume_task", "task_context_staled", "supersede_task"].includes(
      action.type,
    )
  ) {
    return "blocked Tasks only allow resume_task, task_context_staled, or supersede_task";
  }
  if (
    previous.status === "stale" &&
    !["refresh_task_context", "rebase_task", "supersede_task"].includes(
      action.type,
    )
  ) {
    return "stale Tasks only allow refresh_task_context, rebase_task, or supersede_task";
  }
  if (
    previous.status === "verified" ||
    previous.status === "superseded"
  ) {
    return "verified and superseded Tasks are terminal";
  }

  if (action.type === "rebase_task") {
    if (next.baselineSnapshotId !== action.newBaselineSnapshotId) {
      return "rebase_task must set the declared new baseline Snapshot";
    }
    if (next.baselineSnapshotId === previous.baselineSnapshotId) {
      return "rebase_task must change the Task baseline Snapshot";
    }
  } else if (next.baselineSnapshotId !== previous.baselineSnapshotId) {
    return "baselineSnapshotId may change only through rebase_task";
  }

  switch (action.type) {
    case "task_created":
      return "task_created is valid only for the revision-1 Genesis";
    case "transition_status":
      return next.status === action.to
        ? undefined
        : "transition_status must produce its declared target status";
    case "block_task":
      return next.status === "blocked" &&
          next.blockedState?.resumeStatus === previous.status &&
          next.blockedState.reasonCode === action.reasonCode &&
          next.blockedState.message === action.message &&
          next.blockedState.actor === event.actor &&
          next.blockedState.blockedAt === event.occurredAt
        ? undefined
        : "block_task must persist the exact resumable blocked state";
    case "resume_task":
      return previous.status === "blocked" &&
          previous.blockedState !== undefined &&
          next.status === previous.blockedState.resumeStatus &&
          next.blockedState === undefined
        ? undefined
        : "resume_task must restore and clear the exact blocked state";
    case "task_context_staled":
      return next.status === "stale" &&
          next.staleState?.staleFromStatus === previous.status &&
          canonicalizeJson(next.staleState.reasonCodes) ===
            canonicalizeJson(action.reasonCodes) &&
          next.staleState.detectedAtSnapshotId ===
            action.detectedAtSnapshotId &&
          action.detectedAtSnapshotId === next.latestSnapshotId &&
          next.staleState.detectedAt === event.occurredAt
        ? undefined
        : "task_context_staled must persist the exact stale state";
    case "refresh_task_context":
      return next.status === "context_ready" &&
          next.latestSnapshotId === action.targetSnapshotId &&
          next.staleState === undefined
        ? undefined
        : "refresh_task_context must publish context_ready on its target Snapshot";
    case "rebase_task":
      return next.status === "context_ready" &&
          next.staleState === undefined
        ? undefined
        : "rebase_task must return a stale Task to context_ready";
    case "supersede_task":
      return next.status === "superseded" &&
          next.supersession?.supersededFromStatus === previous.status &&
          next.supersession.reason === action.reason &&
          next.supersession.replacementTaskId === action.replacementTaskId &&
          next.supersession.actor === event.actor &&
          next.supersession.supersededAt === event.occurredAt
        ? undefined
        : "supersede_task must persist the exact supersession state";
    case "confirm_goal":
    case "confirm_acceptance_criteria":
    case "confirm_plan":
    case "record_assumption":
    case "confirm_unknown":
    case "accept_finding":
    case "accept_verification_skip":
      return next.status === previous.status
        ? undefined
        : `${action.type} must not change Task status`;
    case "change_checked":
      return previous.status === "check_required" &&
          next.status === "check_required"
        ? undefined
        : "change_checked requires and preserves check_required";
    case "verification_recorded":
      return previous.status === "verification_required" &&
          next.status === "verification_required"
        ? undefined
        : "verification_recorded requires and preserves verification_required";
  }
}

function isArtifactIntegrityFailure(
  error: unknown,
): error is ArtifactStoreError {
  return (
    error instanceof ArtifactStoreError &&
    (error.code === "artifact_corrupt" ||
      error.code === "artifact_not_found" ||
      error.code === "manifest_inconsistent" ||
      error.code === "reference_integrity_failed")
  );
}

function isCommittedAtomicWriteError(
  error: unknown,
  targetPath: string,
): error is ArtifactStoreError {
  return (
    error instanceof ArtifactStoreError &&
    error.details?.committed === true &&
    error.details?.targetPath === targetPath
  );
}

function isDurablyCommittedAtomicWriteError(
  error: unknown,
  targetPath: string,
): error is ArtifactStoreError {
  return (
    isCommittedAtomicWriteError(error, targetPath) &&
    error.details?.durabilityConfirmed === true
  );
}

export class ArtifactStore {
  readonly layout: ArtifactStoreLayout;
  readonly repositoryId: string;
  readonly worktreeId: string;
  readonly producerVersion: string;
  readonly #clock: () => Date;
  readonly #lockOptions?: LockAcquireOptions;

  private constructor(
    layout: ArtifactStoreLayout,
    options: ArtifactStoreOptions,
  ) {
    this.layout = layout;
    this.repositoryId = RepositoryIdSchema.parse(options.repositoryId);
    this.worktreeId = WorktreeIdSchema.parse(options.worktreeId);
    this.producerVersion = ProducerVersionSchema.parse(
      options.producerVersion,
    );
    this.#clock = options.clock ?? (() => new Date());
    this.#lockOptions = options.lock;
  }

  static async open(
    worktreeRoot: string,
    options: ArtifactStoreOptions,
  ): Promise<ArtifactStore> {
    const layout = await createArtifactStoreLayout(worktreeRoot);
    return new ArtifactStore(layout, options);
  }

  #now(): string {
    return IsoTimestampSchema.parse(this.#clock().toISOString());
  }

  /**
   * Marker-first reservation for strong mutations. The cut identity excludes
   * the idempotency key so a second key cannot create an orphan Provider blob
   * while the local Task still reflects the pre-commit revision.
   */
  async reserveStrongOperationIntent(inputValue: Readonly<{
    taskId: string;
    expectedRevision: number;
    operation: "check_change" | "record_verification";
    idempotencyKey: string;
    actor: string;
    proposedAt: string;
    requestDigest?: string;
    fullInputEqualityTag?: string;
  }>): Promise<string> {
    const input = {
      taskId: TaskIdSchema.parse(inputValue.taskId),
      expectedRevision: inputValue.expectedRevision,
      operation: inputValue.operation,
      idempotencyKey: IdempotencyKeySchema.parse(inputValue.idempotencyKey),
      actor: ActorSchema.parse(inputValue.actor),
      proposedAt: IsoTimestampSchema.parse(inputValue.proposedAt),
      ...(inputValue.requestDigest === undefined
        ? {}
        : { requestDigest: ContentDigestSchema.parse(inputValue.requestDigest) }),
      ...(inputValue.fullInputEqualityTag === undefined
        ? {}
        : {
            fullInputEqualityTag: KeyedStateTokenV1Schema.parse(
              inputValue.fullInputEqualityTag,
            ),
          }),
    };
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
      throw new ArtifactStoreError("revision_conflict", "Strong operation intent revision is invalid.");
    }
    const cut = sha256CanonicalJson([
      "strong-operation-intent-cut-v1",
      {
        taskId: input.taskId,
        expectedRevision: input.expectedRevision,
        operation: input.operation,
      },
    ]).slice("sha256:".length, "sha256:".length + 32);
    const relativeDirectory = `.understand-code/.recovery/strong-operation-intents/${input.taskId}`;
    const targetPath = path.join(this.layout.worktreeRoot, relativeDirectory, `${cut}.json`);
    await ensureManagedDirectory(this.layout.worktreeRoot, relativeDirectory);
    return withStoreLock(
      this.layout.worktreeRoot,
      this.layout.taskLock(input.taskId),
      async () => {
        let existing: unknown;
        try {
          existing = await readManagedJson(this.layout.worktreeRoot, targetPath);
        } catch (error) {
          if (
            !(
              error instanceof ArtifactStoreError &&
              error.code === "artifact_not_found"
            ) &&
            (error as NodeJS.ErrnoException).code !== "ENOENT"
          ) throw error;
        }
        if (existing !== undefined) {
          if (
            typeof existing !== "object" || existing === null ||
            Array.isArray(existing)
          ) {
            throw new ArtifactStoreError("artifact_corrupt", "Strong operation intent marker is invalid.");
          }
          const marker = existing as Record<string, unknown>;
          if (
            marker.profile !== "strong_operation_intent_v1" ||
            marker.taskId !== input.taskId ||
            marker.expectedRevision !== input.expectedRevision ||
            marker.operation !== input.operation ||
            marker.idempotencyKey !== input.idempotencyKey ||
            marker.actor !== input.actor ||
            (input.requestDigest !== undefined && marker.requestDigest !== input.requestDigest) ||
            (input.fullInputEqualityTag !== undefined &&
              marker.fullInputEqualityTag !== input.fullInputEqualityTag) ||
            typeof marker.occurredAt !== "string"
          ) {
            throw new ArtifactStoreError("idempotency_conflict", "A different strong request already owns this Task cut.");
          }
          return IsoTimestampSchema.parse(marker.occurredAt);
        }
        const marker = {
          profile: "strong_operation_intent_v1",
          taskId: input.taskId,
          expectedRevision: input.expectedRevision,
          operation: input.operation,
          idempotencyKey: input.idempotencyKey,
          actor: input.actor,
          ...(input.requestDigest === undefined ? {} : { requestDigest: input.requestDigest }),
          ...(input.fullInputEqualityTag === undefined
            ? {}
            : { fullInputEqualityTag: input.fullInputEqualityTag }),
          occurredAt: input.proposedAt,
        };
        await atomicWriteJson(this.layout.worktreeRoot, targetPath, marker, { mode: 0o600 });
        return input.proposedAt;
      },
      this.#lockOptions,
    );
  }

  /**
   * Durable marker for the strong Task-creation transaction.  Task creation
   * must reserve this marker before the baseline authority is allowed to
   * create a Git lease or Provider-private object.  The marker is recovery
   * state only (owner-readable, never part of a public Artifact projection)
   * and binds the complete request to one immutable Snapshot cut.
   */
  async persistStrongTaskCreationIntent(inputValue: Readonly<{
    taskId: string;
    idempotencyKey: string;
    actor: string;
    requestDigest: string;
    snapshotId: string;
    snapshotContentDigest: string;
    contextBuildSpec: Readonly<Record<string, unknown>>;
  }>): Promise<Readonly<Record<string, unknown>>> {
    const taskId = TaskIdSchema.parse(inputValue.taskId);
    const idempotencyKey = IdempotencyKeySchema.parse(inputValue.idempotencyKey);
    const actor = ActorSchema.parse(inputValue.actor);
    const requestDigest = ContentDigestSchema.parse(inputValue.requestDigest);
    const snapshotId = PathSafeRepositorySnapshotIdV1Schema.parse(
      inputValue.snapshotId,
    );
    const snapshotContentDigest = ContentDigestSchema.parse(
      inputValue.snapshotContentDigest,
    );
    if (
      typeof inputValue.contextBuildSpec !== "object" ||
      inputValue.contextBuildSpec === null ||
      Array.isArray(inputValue.contextBuildSpec)
    ) {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Strong Task creation context build spec is invalid.",
      );
    }
    const marker = {
      profile: "strong_task_creation_intent_v1" as const,
      schemaVersion: 1 as const,
      taskId,
      idempotencyKey,
      actor,
      requestDigest,
      snapshotId,
      snapshotContentDigest,
      contextBuildSpec: inputValue.contextBuildSpec,
    };
    const relativeDirectory =
      ".understand-code/.recovery/task-creation-intents";
    const targetPath = path.join(
      this.layout.worktreeRoot,
      relativeDirectory,
      `${taskId}.json`,
    );
    await ensureManagedDirectory(this.layout.worktreeRoot, relativeDirectory);
    return withStoreLock(
      this.layout.worktreeRoot,
      this.layout.taskLock(taskId),
      async () => {
        try {
          const existing = await readManagedJson(
            this.layout.worktreeRoot,
            targetPath,
          );
          if (canonicalizeJson(existing) !== canonicalizeJson(marker)) {
            throw new ArtifactStoreError(
              "idempotency_conflict",
              "A different strong Task creation already owns this cut.",
            );
          }
          return marker;
        } catch (error) {
          if (
            !(
              error instanceof ArtifactStoreError &&
              error.code === "artifact_not_found"
            ) &&
            (error as NodeJS.ErrnoException).code !== "ENOENT"
          ) throw error;
        }
        await atomicWriteJson(this.layout.worktreeRoot, targetPath, marker, {
          mode: 0o600,
        });
        const readback = await readManagedJson(
          this.layout.worktreeRoot,
          targetPath,
        );
        if (canonicalizeJson(readback) !== canonicalizeJson(marker)) {
          throw new ArtifactStoreError(
            "artifact_corrupt",
            "Strong Task creation intent read-back mismatch.",
          );
        }
        return marker;
      },
      this.#lockOptions,
    );
  }

  async readStrongTaskCreationIntent(
    taskIdValue: string,
  ): Promise<Readonly<Record<string, unknown>> | undefined> {
    const taskId = TaskIdSchema.parse(taskIdValue);
    const relativeDirectory =
      ".understand-code/.recovery/task-creation-intents";
    const targetPath = path.join(
      this.layout.worktreeRoot,
      relativeDirectory,
      `${taskId}.json`,
    );
    let value: unknown;
    try {
      value = await readManagedJson(this.layout.worktreeRoot, targetPath);
    } catch (error) {
      if (
        (error instanceof ArtifactStoreError &&
          error.code === "artifact_not_found") ||
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) return undefined;
      throw error;
    }
    if (
      typeof value !== "object" || value === null || Array.isArray(value)
    ) {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Strong Task creation intent marker is invalid.",
      );
    }
    const marker = value as Record<string, unknown>;
    if (
      marker.profile !== "strong_task_creation_intent_v1" ||
      marker.schemaVersion !== 1 ||
      marker.taskId !== taskId ||
      typeof marker.idempotencyKey !== "string" ||
      typeof marker.actor !== "string" ||
      typeof marker.requestDigest !== "string" ||
      typeof marker.snapshotId !== "string" ||
      typeof marker.snapshotContentDigest !== "string" ||
      typeof marker.contextBuildSpec !== "object" ||
      marker.contextBuildSpec === null ||
      Array.isArray(marker.contextBuildSpec)
    ) {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Strong Task creation intent marker has an unsupported shape.",
      );
    }
    return marker;
  }

  async completeStrongTaskCreationIntent(taskIdValue: string): Promise<void> {
    const taskId = TaskIdSchema.parse(taskIdValue);
    const relativeDirectory =
      ".understand-code/.recovery/task-creation-intents";
    const targetPath = path.join(
      this.layout.worktreeRoot,
      relativeDirectory,
      `${taskId}.json`,
    );
    await withStoreLock(
      this.layout.worktreeRoot,
      this.layout.taskLock(taskId),
      async () => {
        try {
          await unlink(targetPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          return;
        }
        await fsyncDirectory(
          path.join(this.layout.worktreeRoot, relativeDirectory),
        );
      },
      this.#lockOptions,
    );
  }

  /**
   * Durable single-envelope transaction intent for a Task Baseline lease.
   * The envelope binds the exact Git lease plan and Provider blob plan before
   * either authority is allowed to produce a side effect.
   */
  async persistStrongBaselineTransactionIntent(inputValue: Readonly<{
    taskId: string;
    markerNonce: string;
    gitLease: Readonly<Record<string, unknown>>;
    providerPlan: Readonly<Record<string, unknown>>;
  }>): Promise<Readonly<{
    markerContentDigest: ContentDigest;
    markerRelativePath: string;
    marker: Readonly<Record<string, unknown>>;
  }>> {
    const taskId = TaskIdSchema.parse(inputValue.taskId);
    if (!/^[0-9a-f]{32}$/u.test(inputValue.markerNonce)) {
      throw new ArtifactStoreError("revision_conflict", "Baseline marker nonce is invalid.");
    }
    const marker = {
      gitLease: inputValue.gitLease,
      profile: "task_baseline_transaction_intent_v1" as const,
      providerPlan: inputValue.providerPlan,
      schemaVersion: 1 as const,
    };
    const canonical = canonicalizeJson(marker);
    // The native descriptor-bound verifier consumes this envelope byte-for-
    // byte.  It is written through atomicWriteFile below (no terminal LF).
    const persistedBytes = Buffer.from(canonical, "utf8");
    const markerContentDigest = sha256Bytes(persistedBytes);
    const markerRelativePath =
      `.understand-code/.recovery/task-baseline-transactions/${taskId}-${inputValue.markerNonce}.json`;
    const targetPath = path.join(this.layout.worktreeRoot, markerRelativePath);
    await ensureManagedDirectory(
      this.layout.worktreeRoot,
      ".understand-code/.recovery/task-baseline-transactions",
    );
    return withStoreLock(
      this.layout.worktreeRoot,
      this.layout.taskLock(taskId),
      async () => {
        try {
          const existing = await readManagedJson(this.layout.worktreeRoot, targetPath);
          if (canonicalizeJson(existing) !== canonical) {
            throw new ArtifactStoreError(
              "idempotency_conflict",
              "A different baseline transaction already owns this cut.",
            );
          }
          return { markerContentDigest, markerRelativePath, marker };
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        // The native SafeGit lease gate pins the exact canonical marker bytes
        // (including their digest) through a descriptor-relative handle.  Keep
        // this transaction envelope newline-free so the bytes hashed here are
        // exactly the bytes the native side reads; the ordinary JSON artifact
        // writer's trailing newline would otherwise create a split-brain hash.
        await atomicWriteFile(this.layout.worktreeRoot, targetPath, canonical, {
          mode: 0o600,
        });
        const readback = await readManagedJson(this.layout.worktreeRoot, targetPath);
        if (canonicalizeJson(readback) !== canonical) {
          throw new ArtifactStoreError(
            "artifact_corrupt",
            "Baseline transaction marker read-back mismatch.",
          );
        }
        return { markerContentDigest, markerRelativePath, marker };
      },
      this.#lockOptions,
    );
  }

  /**
   * Reads the single baseline transaction envelope created before the Git
   * lease/Provider writes.  Recovery callers use this to recover the exact
   * Provider baseline locator (including dirty-overlay private blobs) instead
   * of reconstructing a baseline from a live worktree.
   */
  async readStrongBaselineTransactionIntent(inputValue: Readonly<{
    taskId: string;
    markerNonce: string;
  }>): Promise<Readonly<Record<string, unknown>> | undefined> {
    const taskId = TaskIdSchema.parse(inputValue.taskId);
    if (!/^[0-9a-f]{32}$/u.test(inputValue.markerNonce)) {
      throw new ArtifactStoreError("revision_conflict", "Baseline marker nonce is invalid.");
    }
    const markerRelativePath =
      `.understand-code/.recovery/task-baseline-transactions/${taskId}-${inputValue.markerNonce}.json`;
    const targetPath = path.join(this.layout.worktreeRoot, markerRelativePath);
    let marker: unknown;
    try {
      marker = await readManagedJson(this.layout.worktreeRoot, targetPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
    if (
      typeof marker !== "object" || marker === null || Array.isArray(marker)
    ) {
      throw new ArtifactStoreError("artifact_corrupt", "Baseline transaction marker is invalid.");
    }
    const value = marker as Record<string, unknown>;
    if (
      value.profile !== "task_baseline_transaction_intent_v1" ||
      value.schemaVersion !== 1 ||
      typeof value.gitLease !== "object" || value.gitLease === null ||
      Array.isArray(value.gitLease) ||
      typeof value.providerPlan !== "object" || value.providerPlan === null ||
      Array.isArray(value.providerPlan)
    ) {
      throw new ArtifactStoreError("artifact_corrupt", "Baseline transaction marker has an unsupported shape.");
    }
    return value;
  }

  /**
   * Removes baseline transaction intents only after the corresponding Task
   * bundle has reached its durable created-stage commit point. Matching is
   * restricted to one validated TaskId prefix inside the managed recovery
   * directory, so an orphaned lease can never be silently discarded for a
   * different Task.
   */
  async completeStrongBaselineTransactionIntent(taskIdValue: string): Promise<void> {
    const taskId = TaskIdSchema.parse(taskIdValue);
    const relativeDirectory =
      ".understand-code/.recovery/task-baseline-transactions";
    const directory = path.join(this.layout.worktreeRoot, relativeDirectory);
    await withStoreLock(
      this.layout.worktreeRoot,
      this.layout.taskLock(taskId),
      async () => {
        let entries: string[];
        try {
          entries = await readdir(directory);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
          throw error;
        }
        const prefix = `${taskId}-`;
        const matches = entries.filter(
          (entry) =>
            entry.startsWith(prefix) &&
            entry.endsWith(".json") &&
            /^[0-9a-f]{32}\.json$/u.test(entry.slice(prefix.length)),
        );
        for (const entry of matches) {
          await unlink(path.join(directory, entry));
        }
        if (matches.length > 0) await fsyncDirectory(directory);
      },
      this.#lockOptions,
    );
  }

  async #verifiedSnapshotDescriptor(
    manifest: ArtifactManifestV1,
    snapshotId: string,
    options: {
      requireLatest: boolean;
      subject: string;
    },
  ): Promise<ReturnType<typeof ArtifactDescriptorV1Schema.parse>> {
    if (
      options.requireLatest &&
      manifest.latestSnapshotId !== snapshotId
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `${options.subject} does not target the latest published Repository Snapshot.`,
        {
          sourceSnapshotId: snapshotId,
          latestSnapshotId: manifest.latestSnapshotId,
        },
      );
    }
    const descriptor = manifest.artifacts.find(
      (candidate) =>
        candidate.artifactType === "repository_snapshot" &&
        candidate.storageFormat === "enveloped_v1" &&
        candidate.schemaVersion === 1 &&
        candidate.sourceSnapshotId === snapshotId &&
        candidate.state !== "corrupt" &&
        (!options.requireLatest ||
          candidate.state === "current" ||
          candidate.state === "read_only_recovery"),
    );
    if (descriptor === undefined) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `${options.subject} requires a published Repository Snapshot descriptor.`,
        {
          sourceSnapshotId: snapshotId,
          latestSnapshotId: manifest.latestSnapshotId,
        },
      );
    }

    const snapshotPath = this.layout.snapshot(snapshotId);
    const expectedPath = repositoryRelativePathFromAbsolute(
      this.layout.worktreeRoot,
      snapshotPath,
    );
    if (descriptor.path !== expectedPath) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "Repository Snapshot descriptor path is not canonical.",
        {
          artifactId: descriptor.artifactId,
          expectedPath,
          actualPath: descriptor.path,
        },
      );
    }
    const artifact = await this.#readArtifactPath(snapshotPath);
    if (
      artifact.artifactType !== "repository_snapshot" ||
      artifact.artifactId !== descriptor.artifactId ||
      artifact.sourceSnapshotId !== snapshotId ||
      artifact.revision !== descriptor.revision ||
      artifact.contentDigest !== descriptor.contentDigest ||
      artifact.taskId !== undefined
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "Repository Snapshot bytes do not match their published descriptor.",
        { artifactId: descriptor.artifactId, sourceSnapshotId: snapshotId },
      );
    }
    return descriptor;
  }

  async #usableSnapshotDescriptor(
    manifest: ArtifactManifestV1,
    snapshotId: string,
  ): Promise<
    ReturnType<typeof ArtifactDescriptorV1Schema.parse> | undefined
  > {
    try {
      return await this.#verifiedSnapshotDescriptor(manifest, snapshotId, {
        requireLatest: true,
        subject: "The write transaction",
      });
    } catch (error) {
      if (isArtifactIntegrityFailure(error)) return undefined;
      throw error;
    }
  }

  async #hasUsableSnapshot(
    manifest: ArtifactManifestV1,
    snapshotId: string,
  ): Promise<boolean> {
    return (
      (await this.#usableSnapshotDescriptor(manifest, snapshotId)) !==
      undefined
    );
  }

  async #requireUsableSnapshot(
    manifest: ArtifactManifestV1,
    snapshotId: string,
    subject: string,
  ): Promise<ReturnType<typeof ArtifactDescriptorV1Schema.parse>> {
    const descriptor = await this.#usableSnapshotDescriptor(
      manifest,
      snapshotId,
    );
    if (descriptor !== undefined) return descriptor;
    throw new ArtifactStoreError(
      "reference_integrity_failed",
      `${subject} requires verified bytes for the current published Repository Snapshot.`,
      {
        sourceSnapshotId: snapshotId,
        latestSnapshotId: manifest.latestSnapshotId,
      },
    );
  }

  async #requireReadableSourceSnapshot(
    manifest: ArtifactManifestV1,
    snapshotId: string,
    subject: string,
  ): Promise<ReturnType<typeof ArtifactDescriptorV1Schema.parse>> {
    try {
      return await this.#verifiedSnapshotDescriptor(manifest, snapshotId, {
        requireLatest: false,
        subject,
      });
    } catch (error) {
      if (!isArtifactIntegrityFailure(error)) throw error;
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `${subject} cannot be trusted because its source Repository Snapshot bytes are unavailable or invalid.`,
        {
          sourceSnapshotId: snapshotId,
          integrityCode: error.code,
        },
        { cause: error },
      );
    }
  }

  async #requireArtifactSourceSnapshot(
    manifest: ArtifactManifestV1,
    descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>,
    artifact: PersistedArtifactV1,
    subject: string,
  ): Promise<void> {
    if (
      artifact.artifactType === "repository_snapshot" ||
      this.#isContextlessColdRecovery(manifest, descriptor)
    ) {
      return;
    }
    await this.#requireReadableSourceSnapshot(
      manifest,
      artifact.sourceSnapshotId,
      subject,
    );
  }

  async #requireReplayableArtifact(
    artifact: PersistedArtifactV1,
    targetPath: string,
    subject: string,
  ): Promise<ReturnType<typeof ArtifactDescriptorV1Schema.parse>> {
    const manifest = await this.#readManifestRaw();
    const descriptor = await this.#requirePublishedDescriptor(
      artifact,
      targetPath,
      manifest,
    );
    await this.#requireArtifactSourceSnapshot(
      manifest,
      descriptor,
      artifact,
      subject,
    );
    if (artifact.taskId === undefined) {
      await this.#verifyDescriptorGraph(manifest, [descriptor]);
    } else {
      await this.#verifyTaskDescriptorSet(manifest, artifact.taskId);
    }
    await this.#requireStableManifest(manifest);
    return descriptor;
  }

  #readArtifactResult<TArtifact extends PersistedArtifactV1>(
    artifact: TArtifact,
    descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>,
    manifest: ArtifactManifestV1,
  ): ReadArtifactResult<TArtifact> {
    return {
      artifact,
      descriptor,
      state: descriptor.state,
      freshness: descriptor.freshness,
      ...(manifest.latestSnapshotId === undefined
        ? {}
        : { latestSnapshotId: manifest.latestSnapshotId }),
      recoveryState:
        descriptor.state === "read_only_recovery"
          ? "read_only_recovery"
          : descriptor.state === "historical"
            ? "historical"
            : "current",
    };
  }

  async #verifyDescriptorBytes(
    manifest: ArtifactManifestV1,
    descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>,
  ): Promise<void> {
    if (
      descriptor.state === "corrupt" ||
      descriptor.freshness === "invalid"
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "A trusted read cannot use a corrupt or invalid Artifact descriptor.",
        {
          artifactId: descriptor.artifactId,
          state: descriptor.state,
          freshness: descriptor.freshness,
        },
      );
    }
    const absolutePath = await resolveManagedPath(
      this.layout.worktreeRoot,
      descriptor.path,
    );
    if (descriptor.storageFormat === "enveloped_v1") {
      const artifact = await this.#readArtifactPath(absolutePath);
      await this.#requirePublishedDescriptor(
        artifact,
        absolutePath,
        manifest,
      );
      await this.#requireArtifactSourceSnapshot(
        manifest,
        descriptor,
        artifact,
        `Artifact dependency ${descriptor.artifactId}`,
      );
      return;
    }
    if (descriptor.storageFormat === "jsonl_v1") {
      if (
        descriptor.taskId === undefined ||
        descriptor.sourceSnapshotId === undefined ||
        absolutePath !== this.layout.task(descriptor.taskId).events
      ) {
        throw new ArtifactStoreError(
          "manifest_inconsistent",
          "Task event-log dependency path or identity is not canonical.",
          { artifactId: descriptor.artifactId },
        );
      }
      const parsed = await readTaskEventLog(
        this.layout,
        descriptor.taskId,
      );
      const lastEvent = parsed.events.at(-1);
      if (
        parsed.truncatedTail !== undefined ||
        parsed.contentDigest !== descriptor.contentDigest ||
        lastEvent?.revision !== descriptor.revision ||
        (lastEvent?.sourceSnapshotId !== undefined &&
          lastEvent.sourceSnapshotId !== descriptor.sourceSnapshotId) ||
        parsed.events.some(
          (event) =>
            event.repositoryId !== this.repositoryId ||
            event.worktreeId !== this.worktreeId ||
            event.taskId !== descriptor.taskId,
        )
      ) {
        throw new ArtifactStoreError(
          "manifest_inconsistent",
          "Task event-log dependency bytes do not match their descriptor.",
          { artifactId: descriptor.artifactId },
        );
      }
      if (!this.#isContextlessColdRecovery(manifest, descriptor)) {
        await this.#requireReadableSourceSnapshot(
          manifest,
          descriptor.sourceSnapshotId,
          `Task Event log ${descriptor.artifactId}`,
        );
      }
      return;
    }
    const bytes = await readManagedFile(
      this.layout.worktreeRoot,
      absolutePath,
    );
    if (
      descriptor.contentDigest !== undefined &&
      sha256Bytes(bytes) !== descriptor.contentDigest
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "Legacy Artifact dependency digest does not match its descriptor.",
        { artifactId: descriptor.artifactId },
      );
    }
  }

  async #verifyDescriptorGraph(
    manifest: ArtifactManifestV1,
    roots: readonly ReturnType<typeof ArtifactDescriptorV1Schema.parse>[],
  ): Promise<void> {
    const verified = new Set<string>();
    const verify = async (
      descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>,
    ): Promise<void> => {
      if (verified.has(descriptor.artifactId)) return;
      verified.add(descriptor.artifactId);
      await this.#verifyDescriptorBytes(manifest, descriptor);
      for (const dependency of descriptor.dependencies) {
        const target = manifest.artifacts.find(
          (candidate) =>
            candidate.artifactId === dependency.artifactId,
        );
        if (
          target === undefined ||
          (dependency.requiredDigest !== undefined &&
            target.contentDigest !== dependency.requiredDigest) ||
          (dependency.requiredSnapshotId !== undefined &&
            target.sourceSnapshotId !== dependency.requiredSnapshotId)
        ) {
          throw new ArtifactStoreError(
            "reference_integrity_failed",
            "Artifact dependency does not resolve to its digest- and Snapshot-pinned descriptor.",
            {
              artifactId: descriptor.artifactId,
              dependencyArtifactId: dependency.artifactId,
            },
          );
        }
        await verify(target);
      }
    };
    try {
      for (const root of roots) await verify(root);
    } catch (error) {
      if (
        error instanceof ArtifactStoreError &&
        error.code === "reference_integrity_failed"
      ) {
        throw error;
      }
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Artifact dependency bytes are unavailable, corrupt, or inconsistent.",
        { rootArtifactIds: roots.map((root) => root.artifactId) },
        { cause: error },
      );
    }
  }

  async #verifyTaskDescriptorSet(
    manifest: ArtifactManifestV1,
    taskId: string,
  ): Promise<void> {
    const descriptors = manifest.artifacts.filter(
      (descriptor) => descriptor.taskId === taskId,
    );
    const taskManifest = descriptors.find(
      (descriptor) => descriptor.artifactType === "task_manifest",
    );
    const eventLog = descriptors.find(
      (descriptor) => descriptor.artifactType === "task_event_log",
    );
    if (
      taskManifest === undefined ||
      eventLog === undefined ||
      taskManifest.revision === undefined ||
      taskManifest.sourceSnapshotId === undefined ||
      descriptors.some(
        (descriptor) =>
          descriptor.revision !== taskManifest.revision ||
          descriptor.sourceSnapshotId !==
            taskManifest.sourceSnapshotId,
      )
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "A trusted Task read requires one complete, single-revision Artifact and Event descriptor set.",
        { taskId },
      );
    }
    await this.#verifyDescriptorGraph(manifest, descriptors);
  }

  async #requireStableManifest(
    expected: ArtifactManifestV1,
  ): Promise<void> {
    const observed = await this.#readManifestRaw();
    if (canonicalizeJson(observed) !== canonicalizeJson(expected)) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Artifact Manifest changed during a trusted read.",
      );
    }
  }

  #isContextlessColdRecovery(
    manifest: ArtifactManifestV1,
    descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>,
  ): boolean {
    if (
      manifest.status !== "cold" ||
      manifest.latestSnapshotId !== undefined ||
      descriptor.taskId === undefined ||
      descriptor.freshness !== "partial" ||
      (descriptor.artifactType !== "task_manifest" &&
        descriptor.artifactType !== "task_operation_journal" &&
        descriptor.artifactType !== "task_event_log")
    ) {
      return false;
    }
    const taskDescriptors = manifest.artifacts.filter(
      (candidate) => candidate.taskId === descriptor.taskId,
    );
    return (
      taskDescriptors.some(
        (candidate) => candidate.artifactType === "task_manifest",
      ) &&
      taskDescriptors.every(
        (candidate) =>
          candidate.artifactType === "task_manifest" ||
          candidate.artifactType === "task_operation_journal" ||
          candidate.artifactType === "task_event_log",
      )
    );
  }

  #requiredDependency(
    descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>,
  ): ArtifactDependencyV1 {
    if (descriptor.contentDigest === undefined) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "A canonical V1 dependency target requires a content digest.",
        { artifactId: descriptor.artifactId },
      );
    }
    return ArtifactDependencyV1Schema.parse({
      artifactId: descriptor.artifactId,
      relation: "requires",
      requiredDigest: descriptor.contentDigest,
      requiredSnapshotId: descriptor.sourceSnapshotId,
    });
  }

  #requiredArtifactDependency(
    artifact: PersistedArtifactV1,
  ): ArtifactDependencyV1 {
    return ArtifactDependencyV1Schema.parse({
      artifactId: artifact.artifactId,
      relation: "requires",
      requiredDigest: artifact.contentDigest,
      requiredSnapshotId: artifact.sourceSnapshotId,
    });
  }

  #mergeRequiredDependencies(
    required: readonly ArtifactDependencyV1[],
    supplied: readonly ArtifactDependencyV1[] = [],
  ): ArtifactDependencyV1[] {
    const merged = new Map<string, ArtifactDependencyV1>();
    for (const dependency of required) {
      merged.set(dependency.artifactId, dependency);
    }
    for (const input of supplied) {
      const dependency = ArtifactDependencyV1Schema.parse(input);
      const canonical = merged.get(dependency.artifactId);
      if (
        canonical !== undefined &&
        canonicalizeJson(canonical) !== canonicalizeJson(dependency)
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "A caller cannot weaken or replace a canonical dependency pin.",
          { artifactId: dependency.artifactId },
        );
      }
      merged.set(dependency.artifactId, dependency);
    }
    return [...merged.values()].sort((left, right) =>
      left.artifactId.localeCompare(right.artifactId),
    );
  }

  async #requireCurrentRepoPulse(
    manifest: ArtifactManifestV1,
    snapshotId: string,
  ): Promise<ReturnType<typeof ArtifactDescriptorV1Schema.parse>> {
    const descriptor = manifest.artifacts.find(
      (candidate) =>
        candidate.artifactType === "repo_pulse" &&
        candidate.storageFormat === "enveloped_v1" &&
        candidate.state === "current" &&
        (candidate.freshness === "fresh" ||
          candidate.freshness === "partial") &&
        candidate.sourceSnapshotId === snapshotId,
    );
    if (descriptor === undefined) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "A contextual Task transaction requires the current Repo Pulse.",
        { snapshotId },
      );
    }
    const targetPath = this.layout.artifact("repo_pulse");
    if (
      descriptor.path !==
      repositoryRelativePathFromAbsolute(
        this.layout.worktreeRoot,
        targetPath,
      )
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "The current Repo Pulse descriptor path is not canonical.",
        { artifactId: descriptor.artifactId },
      );
    }
    const pulse = await this.#readArtifactPath(targetPath);
    if (
      pulse.artifactType !== "repo_pulse" ||
      pulse.artifactId !== descriptor.artifactId ||
      pulse.sourceSnapshotId !== snapshotId ||
      pulse.revision !== descriptor.revision ||
      pulse.contentDigest !== descriptor.contentDigest
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "The current Repo Pulse bytes do not match their descriptor.",
        { artifactId: descriptor.artifactId },
      );
    }
    return descriptor;
  }

  async #assertTaskBaselineAuthority(
    manifest: ArtifactManifestV1,
    prepared: PreparedTaskBundle,
  ): Promise<void> {
    const task = prepared.bundle.manifest;
    if (task.baselineSnapshotId === task.latestSnapshotId) return;
    const event = prepared.bundle.events.at(-1);
    if (event === undefined) return;
    const isContextBuild =
      event.previousStatus === "created" &&
      event.action.type === "transition_status" &&
      event.action.to === "context_ready";
    const requiresDeclaredBaseline =
      event.action.type === "task_created" ||
      event.action.type === "rebase_task" ||
      isContextBuild;
    if (!requiresDeclaredBaseline) return;
    const pulseDescriptor = manifest.artifacts.find(
      (descriptor) =>
        descriptor.artifactType === "repo_pulse" &&
        descriptor.state === "current" &&
        descriptor.sourceSnapshotId === task.latestSnapshotId,
    );
    if (pulseDescriptor === undefined) {
      // Stage 1 deliberately persists user intent before Repo Pulse is ready;
      // Stage 2 must bind the baseline to authoritative Pulse bytes.
      if (event.action.type === "task_created") return;
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Task context/rebase requires a current Repo Pulse that declares its logical baseline.",
        {
          taskId: prepared.taskId,
          baselineSnapshotId: task.baselineSnapshotId,
          latestSnapshotId: task.latestSnapshotId,
        },
      );
    }
    await this.#requireCurrentRepoPulse(manifest, task.latestSnapshotId);
    const pulse = await this.#readArtifactPath(this.layout.repoPulse);
    if (
      pulse.artifactType !== "repo_pulse" ||
      pulse.payload.baselineSnapshotId !== task.baselineSnapshotId
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Task baselineSnapshotId is not declared by the current trusted Repo Pulse.",
        {
          taskId: prepared.taskId,
          baselineSnapshotId: task.baselineSnapshotId,
          pulseBaselineSnapshotId:
            pulse.artifactType === "repo_pulse"
              ? pulse.payload.baselineSnapshotId
              : undefined,
        },
      );
    }
  }

  async #taskBundleFreshness(
    manifest: ArtifactManifestV1,
    prepared: PreparedTaskBundle,
  ): Promise<"fresh" | "partial"> {
    const contextless = !prepared.contextual;
    const latestEvent = prepared.bundle.events.at(-1);
    const previousEvent = prepared.bundle.events.at(-2);
    const latestAction = latestEvent?.action.type;
    const snapshotCheckAlignment =
      (latestEvent?.previousStatus === "in_progress" ||
        latestEvent?.previousStatus === "verification_required") &&
      latestEvent.action.type === "transition_status" &&
      latestEvent.action.to === "check_required" &&
      previousEvent?.sourceSnapshotId !== latestEvent.sourceSnapshotId;
    const lifecycleControlOnly =
      latestAction === "task_context_staled" ||
      latestAction === "supersede_task" ||
      snapshotCheckAlignment;
    const snapshotDescriptor = await this.#usableSnapshotDescriptor(
      manifest,
      prepared.bundle.manifest.latestSnapshotId,
    );
    if (snapshotDescriptor !== undefined) {
      await this.#assertTaskBaselineAuthority(manifest, prepared);
      if (contextless || lifecycleControlOnly) {
        return "partial";
      }
      const pulseDescriptor = await this.#requireCurrentRepoPulse(
        manifest,
        prepared.bundle.manifest.latestSnapshotId,
      );
      return snapshotDescriptor.state === "current" &&
        snapshotDescriptor.freshness === "fresh" &&
        pulseDescriptor.freshness === "fresh"
        ? "fresh"
        : "partial";
    }
    if (
      contextless &&
      prepared.artifacts.some(
        (artifact) => artifact.artifactType === "task_manifest",
      ) &&
      manifest.status === "cold" &&
      manifest.latestSnapshotId === undefined
    ) {
      return "partial";
    }
    throw new ArtifactStoreError(
      "reference_integrity_failed",
      "A contextual Task bundle requires the current published Repository Snapshot.",
      {
        taskId: prepared.taskId,
        sourceSnapshotId: prepared.bundle.manifest.latestSnapshotId,
        latestSnapshotId: manifest.latestSnapshotId,
      },
    );
  }

  async #publishedTaskArtifact(
    manifest: ArtifactManifestV1,
    taskId: string,
    artifactType: ArtifactTypeV1,
  ): Promise<PersistedArtifactV1 | undefined> {
    const descriptor = manifest.artifacts.find(
      (candidate) =>
        candidate.taskId === taskId &&
        candidate.artifactType === artifactType,
    );
    if (descriptor === undefined) return undefined;
    const targetPath = this.layout.artifact(artifactType, { taskId });
    const artifact = await this.#readArtifactPath(targetPath);
    if (artifact.artifactType !== artifactType) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        `The published ${artifactType} path resolved another Artifact type.`,
        { taskId, artifactType },
      );
    }
    await this.#requirePublishedDescriptor(
      artifact,
      targetPath,
      manifest,
    );
    return artifact;
  }

  async #assertConfirmPayloadDelta(
    manifest: ArtifactManifestV1,
    prepared: PreparedTaskBundle,
    event: TaskEventV1,
  ): Promise<void> {
    const action = event.action;
    const targetKinds = new Map<string, string>();
    switch (action.type) {
      case "confirm_goal":
        targetKinds.set(action.claimId, "goal");
        break;
      case "confirm_acceptance_criteria":
        action.claimIds.forEach((claimId) =>
          targetKinds.set(claimId, "acceptance"),
        );
        break;
      case "record_assumption":
        targetKinds.set(action.claimId, "assumption");
        break;
      case "confirm_unknown":
        targetKinds.set(action.claimId, "unknown");
        break;
      default:
        return;
    }
    const currentClaims = await this.#publishedTaskArtifact(
      manifest,
      prepared.taskId,
      "claim_ledger",
    );
    const currentEvidence = await this.#publishedTaskArtifact(
      manifest,
      prepared.taskId,
      "evidence_ledger",
    );
    const candidateClaims = prepared.artifacts.find(
      (artifact) => artifact.artifactType === "claim_ledger",
    );
    const candidateEvidence = prepared.artifacts.find(
      (artifact) => artifact.artifactType === "evidence_ledger",
    );
    if (
      currentClaims?.artifactType !== "claim_ledger" ||
      currentEvidence?.artifactType !== "evidence_ledger" ||
      candidateClaims?.artifactType !== "claim_ledger" ||
      candidateEvidence?.artifactType !== "evidence_ledger"
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `${action.type} requires current and candidate Claim/Evidence ledgers.`,
        { taskId: prepared.taskId, action: action.type },
      );
    }
    const beforeClaims = currentClaims.payload.claims;
    const afterClaims = candidateClaims.payload.claims;
    const beforeEvidence = currentEvidence.payload.evidence;
    const afterEvidence = candidateEvidence.payload.evidence;
    if (
      beforeClaims.length !== afterClaims.length ||
      canonicalizeJson(
        afterEvidence.slice(0, beforeEvidence.length),
      ) !== canonicalizeJson(beforeEvidence) ||
      afterEvidence.length !== beforeEvidence.length + targetKinds.size
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `${action.type} must preserve existing Claim/Evidence facts and append one human Evidence per target Claim.`,
        { taskId: prepared.taskId, action: action.type },
      );
    }
    const appendedEvidence = afterEvidence.slice(beforeEvidence.length);
    const usedEvidenceIds = new Set<string>();
    for (let index = 0; index < beforeClaims.length; index += 1) {
      const before = beforeClaims[index]!;
      const after = afterClaims[index]!;
      if (before.id !== after.id) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `${action.type} cannot reorder or replace Claims.`,
          { taskId: prepared.taskId, action: action.type, claimId: before.id },
        );
      }
      const expectedKind = targetKinds.get(before.id);
      if (expectedKind === undefined) {
        if (canonicalizeJson(before) !== canonicalizeJson(after)) {
          throw new ArtifactStoreError(
            "reference_integrity_failed",
            `${action.type} cannot mutate a non-target Claim.`,
            {
              taskId: prepared.taskId,
              action: action.type,
              claimId: before.id,
            },
          );
        }
        continue;
      }
      if (before.kind !== expectedKind) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `${action.type} target Claim has the wrong kind.`,
          {
            taskId: prepared.taskId,
            action: action.type,
            claimId: before.id,
            expectedKind,
            actualKind: before.kind,
          },
        );
      }
      const humanEvidence = appendedEvidence.filter(
        (item) =>
          item.kind === "human" &&
          item.claimIds.length === 1 &&
          item.claimIds[0] === before.id,
      );
      if (humanEvidence.length !== 1) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `${action.type} requires exactly one appended human Evidence for each target Claim.`,
          { taskId: prepared.taskId, action: action.type, claimId: before.id },
        );
      }
      const evidence = humanEvidence[0]!;
      if (
        usedEvidenceIds.has(evidence.id) ||
        evidence.epistemicStatus !== "human_confirmed" ||
        evidence.freshness !== "current" ||
        evidence.nodeIds.length !== 0 ||
        evidence.producedBy !== "task-engine" ||
        evidence.createdAt !== event.occurredAt ||
        evidence.observedAtSnapshotId !== event.sourceSnapshotId ||
        evidence.confirmation.actor !== event.actor ||
        evidence.confirmation.input !== before.statement ||
        evidence.confirmation.confirmedAt !== event.occurredAt
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `${action.type} human Evidence must match its Event actor, time, Snapshot, and Claim statement.`,
          { taskId: prepared.taskId, action: action.type, claimId: before.id },
        );
      }
      usedEvidenceIds.add(evidence.id);
      if (!("boundaryReason" in before)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `${action.type} cannot target a strong Finding Claim.`,
          { taskId: prepared.taskId, action: action.type, claimId: before.id },
        );
      }
      const {
        boundaryReason,
        derivationPath: _derivationPath,
        ...base
      } = before;
      const expectedClaim = {
        ...base,
        epistemicStatus: "human_confirmed",
        lifecycleStatus: "supported",
        freshness: "current",
        evidenceIds: [...new Set([...before.evidenceIds, evidence.id])],
        confirmationEventId: event.eventId,
        ...(before.kind === "unknown" && boundaryReason !== undefined
          ? { boundaryReason }
          : {}),
        updatedAt: event.occurredAt,
      };
      if (canonicalizeJson(expectedClaim) !== canonicalizeJson(after)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `${action.type} may update only the target Claim confirmation fields.`,
          { taskId: prepared.taskId, action: action.type, claimId: before.id },
        );
      }
    }
    if (
      usedEvidenceIds.size !== targetKinds.size ||
      [...targetKinds.keys()].some(
        (claimId) => !beforeClaims.some((claim) => claim.id === claimId),
      )
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `${action.type} target Claims and appended human Evidence are incomplete.`,
        { taskId: prepared.taskId, action: action.type },
      );
    }
  }

  async #assertTargetedResolutionDelta(
    manifest: ArtifactManifestV1,
    prepared: PreparedTaskBundle,
    event: TaskEventV1,
  ): Promise<void> {
    const action = event.action;
    if (action.type === "accept_finding") {
      const current = await this.#publishedTaskArtifact(
        manifest,
        prepared.taskId,
        "change_check",
      );
      const candidate = prepared.artifacts.find(
        (artifact) => artifact.artifactType === "change_check",
      );
      if (
        current?.artifactType !== "change_check" ||
        candidate?.artifactType !== "change_check"
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "accept_finding requires current and candidate Change Checks.",
          { taskId: prepared.taskId, findingId: action.findingId },
        );
      }
      const target = current.payload.findings.find(
        (finding) => finding.id === action.findingId,
      );
      if (target === undefined || target.resolution !== undefined) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "accept_finding requires one unresolved target Finding.",
          { taskId: prepared.taskId, findingId: action.findingId },
        );
      }
      const expected = {
        ...current.payload,
        findings: current.payload.findings.map((finding) =>
          finding.id === action.findingId
            ? {
                ...finding,
                resolution: {
                  kind: "accepted" as const,
                  actor: event.actor,
                  reason: action.reason,
                  at: event.occurredAt,
                  eventId: event.eventId,
                },
              }
            : finding,
        ),
      };
      if (canonicalizeJson(expected) !== canonicalizeJson(candidate.payload)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "accept_finding may mutate only the target Finding resolution.",
          { taskId: prepared.taskId, findingId: action.findingId },
        );
      }
    }
    if (action.type === "accept_verification_skip") {
      const current = await this.#publishedTaskArtifact(
        manifest,
        prepared.taskId,
        "verification",
      );
      const candidate = prepared.artifacts.find(
        (artifact) => artifact.artifactType === "verification",
      );
      if (
        current?.artifactType !== "verification" ||
        candidate?.artifactType !== "verification"
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "accept_verification_skip requires current and candidate Verification records.",
          {
            taskId: prepared.taskId,
            verificationRecordId: action.verificationRecordId,
          },
        );
      }
      const target = current.payload.records.find(
        (record) => record.id === action.verificationRecordId,
      );
      if (
        target === undefined ||
        "profile" in target ||
        target.status !== "skipped" ||
        target.skipAcceptance !== undefined
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "accept_verification_skip requires one unaccepted skipped target record.",
          {
            taskId: prepared.taskId,
            verificationRecordId: action.verificationRecordId,
          },
        );
      }
      const expected = {
        records: current.payload.records.map((record) =>
          record.id === action.verificationRecordId
            ? {
                ...record,
                skipAcceptance: {
                  actor: event.actor,
                  reason: action.reason,
                  acceptedAt: event.occurredAt,
                  eventId: event.eventId,
                },
              }
            : record,
        ),
      };
      if (canonicalizeJson(expected) !== canonicalizeJson(candidate.payload)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "accept_verification_skip may mutate only the target record acceptance.",
          {
            taskId: prepared.taskId,
            verificationRecordId: action.verificationRecordId,
          },
        );
      }
    }
  }

  async #assertSnapshotCleanupClaimDelta(
    manifest: ArtifactManifestV1,
    prepared: PreparedTaskBundle,
    previousTask: TaskManifestV1,
    event: TaskEventV1,
  ): Promise<void> {
    const action = event.action;
    const isSnapshotCleanup =
      action.type === "task_context_staled" ||
      (action.type === "supersede_task" &&
        previousTask.latestSnapshotId !== event.sourceSnapshotId) ||
      (action.type === "transition_status" &&
        (previousTask.status === "in_progress" ||
          previousTask.status === "verification_required") &&
        action.to === "check_required" &&
        previousTask.latestSnapshotId !== event.sourceSnapshotId);
    if (!isSnapshotCleanup) return;
    const currentClaims = await this.#publishedTaskArtifact(
      manifest,
      prepared.taskId,
      "claim_ledger",
    );
    const candidateClaims = prepared.artifacts.find(
      (artifact) => artifact.artifactType === "claim_ledger",
    );
    if (
      currentClaims === undefined &&
      candidateClaims === undefined
    ) {
      return;
    }
    if (
      currentClaims?.artifactType !== "claim_ledger" ||
      candidateClaims?.artifactType !== "claim_ledger"
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `${action.type} Snapshot cleanup must preserve the Claim ledger.`,
        { taskId: prepared.taskId, action: action.type },
      );
    }
    const currentCheck = await this.#publishedTaskArtifact(
      manifest,
      prepared.taskId,
      "change_check",
    );
    const currentVerification = await this.#publishedTaskArtifact(
      manifest,
      prepared.taskId,
      "verification",
    );
    const candidateCheck = prepared.artifacts.find(
      (artifact) => artifact.artifactType === "change_check",
    );
    const candidateVerification = prepared.artifacts.find(
      (artifact) => artifact.artifactType === "verification",
    );
    if (candidateCheck !== undefined || candidateVerification !== undefined) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `${action.type} Snapshot cleanup must remove canonical Check and Verification projections.`,
        { taskId: prepared.taskId, action: action.type },
      );
    }
    const removedFindingIds =
      currentCheck?.artifactType === "change_check"
        ? new Set(
            currentCheck.payload.findings.map((finding) => finding.id),
          )
        : new Set<string>();
    const removedVerificationIds =
      currentVerification?.artifactType === "verification"
        ? new Set(
            currentVerification.payload.records.map((record) => record.id),
          )
        : new Set<string>();
    const expected = {
      claims: currentClaims.payload.claims.flatMap<unknown>((claim) => {
        const findingIds = (claim.findingIds as readonly string[]).filter(
          (findingId) => !removedFindingIds.has(findingId),
        );
        if (!("verificationRecordIds" in claim)) {
          return findingIds.length === 0 ? [] : [{ ...claim, findingIds }];
        }
        return [{
          ...claim,
          findingIds,
          verificationRecordIds: claim.verificationRecordIds.filter(
            (recordId) => !removedVerificationIds.has(recordId),
          ),
        }];
      }),
    };
    if (
      canonicalizeJson(expected) !==
      canonicalizeJson(candidateClaims.payload)
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `${action.type} may change Claims only by removing backlinks to deleted Check/Verification facts.`,
        { taskId: prepared.taskId, action: action.type },
      );
    }
  }

  async #assertChangeCheckedPayloadDelta(
    manifest: ArtifactManifestV1,
    prepared: PreparedTaskBundle,
    event: TaskEventV1,
  ): Promise<void> {
    if (event.action.type !== "change_checked") return;
    const [
      currentClaims,
      currentEvidence,
      currentImpact,
      currentVerification,
    ] = await Promise.all([
      this.#publishedTaskArtifact(
        manifest,
        prepared.taskId,
        "claim_ledger",
      ),
      this.#publishedTaskArtifact(
        manifest,
        prepared.taskId,
        "evidence_ledger",
      ),
      this.#publishedTaskArtifact(manifest, prepared.taskId, "impact"),
      this.#publishedTaskArtifact(
        manifest,
        prepared.taskId,
        "verification",
      ),
    ]);
    const candidateClaims = prepared.artifacts.find(
      (artifact) => artifact.artifactType === "claim_ledger",
    );
    const candidateEvidence = prepared.artifacts.find(
      (artifact) => artifact.artifactType === "evidence_ledger",
    );
    const candidateImpact = prepared.artifacts.find(
      (artifact) => artifact.artifactType === "impact",
    );
    const candidateCheck = prepared.artifacts.find(
      (artifact) => artifact.artifactType === "change_check",
    );
    const candidateVerification = prepared.artifacts.find(
      (artifact) => artifact.artifactType === "verification",
    );
    if (
      currentClaims?.artifactType !== "claim_ledger" ||
      currentEvidence?.artifactType !== "evidence_ledger" ||
      currentImpact?.artifactType !== "impact" ||
      candidateClaims?.artifactType !== "claim_ledger" ||
      candidateEvidence?.artifactType !== "evidence_ledger" ||
      candidateImpact?.artifactType !== "impact" ||
      candidateCheck?.artifactType !== "change_check"
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "change_checked requires current and candidate Claim, Evidence, and Impact ledgers plus its candidate Change Check.",
        { taskId: prepared.taskId },
      );
    }
    if (
      candidateCheck.payload.id !== event.action.changeCheckId ||
      candidateCheck.artifactId !==
        event.action.changeCheckArtifactId
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "change_checked must publish the exact Change Check identified by its Event.",
        { taskId: prepared.taskId },
      );
    }

    if (
      (currentVerification === undefined) !==
        (candidateVerification === undefined) ||
      (currentVerification?.artifactType === "verification" &&
        candidateVerification?.artifactType === "verification" &&
        canonicalizeJson(currentVerification.payload) !==
          canonicalizeJson(candidateVerification.payload))
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "change_checked cannot add, remove, or rewrite Verification history.",
        { taskId: prepared.taskId },
      );
    }

    const findings = candidateCheck.payload.findings;
    const beforeClaims = currentClaims.payload.claims;
    const afterClaims = candidateClaims.payload.claims;
    if (afterClaims.length < beforeClaims.length) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "change_checked cannot delete historical Claims.",
        { taskId: prepared.taskId },
      );
    }
    for (let index = 0; index < beforeClaims.length; index += 1) {
      const before = beforeClaims[index]!;
      const after = afterClaims[index]!;
      const appendedFindingIds = findings
        .filter(
          (finding) =>
            finding.claimIds.includes(before.id) &&
            !(before.findingIds as readonly string[]).includes(finding.id),
        )
        .map((finding) => finding.id);
      const expected = {
        ...before,
        findingIds: [...before.findingIds, ...appendedFindingIds],
      };
      if (canonicalizeJson(expected) !== canonicalizeJson(after)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "change_checked may mutate an existing Claim only by appending backlinks to Findings in this Check.",
          { taskId: prepared.taskId, claimId: before.id },
        );
      }
    }
    const appendedClaims = afterClaims.slice(beforeClaims.length);
    for (const claim of appendedClaims) {
      const linkedFindingIds = findings
        .filter((finding) => finding.claimIds.includes(claim.id))
        .map((finding) => finding.id);
      if (
        claim.kind !== "finding" ||
        linkedFindingIds.length === 0 ||
        canonicalizeJson(claim.findingIds) !==
          canonicalizeJson(linkedFindingIds)
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "change_checked may append only Finding Claims exactly linked to this Check.",
          { taskId: prepared.taskId, claimId: claim.id },
        );
      }
    }

    const beforeEvidence = currentEvidence.payload.evidence;
    const afterEvidence = candidateEvidence.payload.evidence;
    if (afterEvidence.length < beforeEvidence.length) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "change_checked cannot delete historical Evidence.",
        { taskId: prepared.taskId },
      );
    }
    for (let index = 0; index < beforeEvidence.length; index += 1) {
      const before = beforeEvidence[index]!;
      const after = afterEvidence[index]!;
      const appendedClaimIds = appendedClaims
        .filter(
          (claim) =>
            (claim.evidenceIds as readonly string[]).includes(before.id) &&
            findings.some(
              (finding) =>
                finding.claimIds.includes(claim.id) &&
                finding.evidenceIds.includes(before.id),
            ) &&
            !before.claimIds.includes(claim.id),
        )
        .map((claim) => claim.id);
      const expected = {
        ...before,
        claimIds: [...before.claimIds, ...appendedClaimIds],
      };
      if (canonicalizeJson(expected) !== canonicalizeJson(after)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "change_checked may mutate existing Evidence only by appending backlinks to new Finding Claims in this Check.",
          { taskId: prepared.taskId, evidenceId: before.id },
        );
      }
    }
    for (const evidence of afterEvidence.slice(beforeEvidence.length)) {
      if (
        !findings.some((finding) =>
          finding.evidenceIds.includes(evidence.id),
        )
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "change_checked may append only Evidence referenced by this Check.",
          { taskId: prepared.taskId, evidenceId: evidence.id },
        );
      }
    }

    const beforePaths = currentImpact.payload.paths;
    const afterPaths = candidateImpact.payload.paths;
    if (afterPaths.length < beforePaths.length) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "change_checked cannot delete historical Impact paths.",
        { taskId: prepared.taskId },
      );
    }
    for (let index = 0; index < beforePaths.length; index += 1) {
      const before = beforePaths[index]!;
      const after = afterPaths[index]!;
      const appendedClaimIds = appendedClaims
        .filter(
          (claim) =>
            findings.some(
              (finding) =>
                finding.claimIds.includes(claim.id) &&
                finding.impactPathIds.includes(before.id),
            ) &&
            !before.claimIds.includes(claim.id),
        )
        .map((claim) => claim.id);
      const expected = {
        ...before,
        claimIds: [...before.claimIds, ...appendedClaimIds],
      };
      if (canonicalizeJson(expected) !== canonicalizeJson(after)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "change_checked may mutate existing Impact only by appending backlinks to new Finding Claims in this Check.",
          { taskId: prepared.taskId, impactPathId: before.id },
        );
      }
    }
    for (const impactPath of afterPaths.slice(beforePaths.length)) {
      if (
        !findings.some((finding) =>
          finding.impactPathIds.includes(impactPath.id),
        )
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "change_checked may append only Impact paths referenced by this Check.",
          { taskId: prepared.taskId, impactPathId: impactPath.id },
        );
      }
    }
  }

  async #assertVerificationRecordedPayloadDelta(
    manifest: ArtifactManifestV1,
    prepared: PreparedTaskBundle,
    event: TaskEventV1,
  ): Promise<void> {
    if (event.action.type !== "verification_recorded") return;
    const currentClaims = await this.#publishedTaskArtifact(
      manifest,
      prepared.taskId,
      "claim_ledger",
    );
    const currentVerification = await this.#publishedTaskArtifact(
      manifest,
      prepared.taskId,
      "verification",
    );
    const candidateClaims = prepared.artifacts.find(
      (artifact) => artifact.artifactType === "claim_ledger",
    );
    const candidateVerification = prepared.artifacts.find(
      (artifact) => artifact.artifactType === "verification",
    );
    if (
      currentClaims?.artifactType !== "claim_ledger" ||
      candidateClaims?.artifactType !== "claim_ledger" ||
      candidateVerification?.artifactType !== "verification"
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "verification_recorded requires current/candidate Claims and a candidate Verification ledger.",
        { taskId: prepared.taskId },
      );
    }
    const beforeRecords =
      currentVerification?.artifactType === "verification"
        ? currentVerification.payload.records
        : [];
    const afterRecords = candidateVerification.payload.records;
    if (
      afterRecords.length !== beforeRecords.length + 1 ||
      canonicalizeJson(afterRecords.slice(0, beforeRecords.length)) !==
        canonicalizeJson(beforeRecords)
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "verification_recorded must preserve Verification history and append exactly one record.",
        { taskId: prepared.taskId },
      );
    }
    const appendedRecord = afterRecords.at(-1)!;
    if (appendedRecord.id !== event.action.verificationRecordId) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "verification_recorded appended a record other than the Event target.",
        {
          taskId: prepared.taskId,
          verificationRecordId: event.action.verificationRecordId,
        },
      );
    }

    const beforeClaims = currentClaims.payload.claims;
    const afterClaims = candidateClaims.payload.claims;
    if (afterClaims.length !== beforeClaims.length) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "verification_recorded cannot add or delete Claims.",
        { taskId: prepared.taskId },
      );
    }
    for (let index = 0; index < beforeClaims.length; index += 1) {
      const before = beforeClaims[index]!;
      const after = afterClaims[index]!;
      const expected = appendedRecord.claimIds.includes(before.id) &&
          "verificationRecordIds" in before
        ? {
            ...before,
            verificationRecordIds: [
              ...before.verificationRecordIds,
              appendedRecord.id,
            ],
          }
        : before;
      if (canonicalizeJson(expected) !== canonicalizeJson(after)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "verification_recorded may mutate a Claim only by appending the new Verification backlink.",
          { taskId: prepared.taskId, claimId: before.id },
        );
      }
    }
  }

  async #assertTaskPayloadMutationPolicy(
    manifest: ArtifactManifestV1,
    prepared: PreparedTaskBundle,
    previousTask: TaskManifestV1,
    event: TaskEventV1,
  ): Promise<void> {
    await this.#assertConfirmPayloadDelta(
      manifest,
      prepared,
      event,
    );
    await this.#assertTargetedResolutionDelta(
      manifest,
      prepared,
      event,
    );
    await this.#assertSnapshotCleanupClaimDelta(
      manifest,
      prepared,
      previousTask,
      event,
    );
    await this.#assertChangeCheckedPayloadDelta(
      manifest,
      prepared,
      event,
    );
    await this.#assertVerificationRecordedPayloadDelta(
      manifest,
      prepared,
      event,
    );
    const policy = taskPayloadMutationPolicy(previousTask, event);
    for (const artifactType of TASK_GUARDED_PAYLOAD_TYPES) {
      const currentDescriptor = manifest.artifacts.find(
        (descriptor) =>
          descriptor.taskId === prepared.taskId &&
          descriptor.artifactType === artifactType,
      );
      const candidate = prepared.artifacts.find(
        (artifact) => artifact.artifactType === artifactType,
      );
      if (policy.mutable.has(artifactType)) continue;
      if (
        policy.removable.has(artifactType) &&
        currentDescriptor !== undefined &&
        candidate === undefined
      ) {
        continue;
      }
      if (
        (currentDescriptor === undefined) !== (candidate === undefined)
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Task action ${event.action.type} cannot add or remove ${artifactType} payload state.`,
          {
            taskId: prepared.taskId,
            action: event.action.type,
            artifactType,
          },
        );
      }
      if (currentDescriptor === undefined || candidate === undefined) {
        continue;
      }
      const current = await this.#publishedTaskArtifact(
        manifest,
        prepared.taskId,
        artifactType,
      );
      if (current === undefined) {
        throw new ArtifactStoreError(
          "manifest_inconsistent",
          `The published ${artifactType} descriptor has no readable Artifact.`,
          { taskId: prepared.taskId, artifactType },
        );
      }
      if (
        canonicalizeJson(current.payload) !==
        canonicalizeJson(candidate.payload)
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Task action ${event.action.type} cannot mutate ${artifactType} payload state.`,
          {
            taskId: prepared.taskId,
            action: event.action.type,
            artifactType,
          },
        );
      }
    }
  }

  #parsePendingTaskTransactionMarker(
    input: unknown,
  ): PendingTaskTransactionMarkerV1 {
    try {
      if (typeof input !== "object" || input === null) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Task transaction marker is not an object.",
        );
      }
      const candidate = input as Record<string, unknown>;
      if (candidate.version !== 1) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Task transaction marker has an unsupported version.",
        );
      }
      const repositoryId = RepositoryIdSchema.parse(candidate.repositoryId);
      const worktreeId = WorktreeIdSchema.parse(candidate.worktreeId);
      const taskId = TaskIdSchema.parse(candidate.taskId);
      const createdAt = IsoTimestampSchema.parse(candidate.createdAt);
      const expectedRevision = candidate.expectedRevision;
      const targetRevision = candidate.targetRevision;
      if (
        !Number.isSafeInteger(expectedRevision) ||
        (expectedRevision as number) < 0 ||
        !Number.isSafeInteger(targetRevision) ||
        (targetRevision as number) < 1 ||
        ((expectedRevision as number) > 0 &&
          targetRevision !== (expectedRevision as number) + 1)
      ) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Task transaction marker has an invalid revision boundary.",
          { taskId, expectedRevision, targetRevision },
        );
      }
      if (
        repositoryId !== this.repositoryId ||
        worktreeId !== this.worktreeId
      ) {
        throw new ArtifactStoreError(
          "manifest_inconsistent",
          "Pending Task transaction marker belongs to another Store.",
          { repositoryId, worktreeId, taskId },
        );
      }

      if (
        typeof candidate.oldManifest !== "object" ||
        candidate.oldManifest === null
      ) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Task transaction marker has no durable old Manifest.",
          { taskId },
        );
      }
      const oldManifestValue = candidate.oldManifest as Record<
        string,
        unknown
      >;
      const oldManifestBytes = decodeTaskTransactionBytes(
        oldManifestValue.contentBase64,
        oldManifestValue.contentDigest,
        "Pending Task transaction old Manifest",
      );
      const oldManifest = ArtifactManifestV1Schema.parse(
        JSON.parse(oldManifestBytes.toString("utf8")) as unknown,
      );
      if (
        oldManifest.repositoryId !== repositoryId ||
        oldManifest.worktreeId !== worktreeId
      ) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Task transaction old Manifest identity is invalid.",
          { taskId },
        );
      }
      const oldTaskDescriptors = oldManifest.artifacts.filter(
        (descriptor) => descriptor.taskId === taskId,
      );
      const oldTaskManifest = oldTaskDescriptors.find(
        (descriptor) => descriptor.artifactType === "task_manifest",
      );
      if (
        ((expectedRevision as number) === 0 &&
          oldTaskDescriptors.length !== 0) ||
        ((expectedRevision as number) > 0 &&
          (oldTaskManifest?.revision !== expectedRevision ||
            oldTaskDescriptors.some(
              (descriptor) => descriptor.revision !== expectedRevision,
            )))
      ) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Task transaction old Manifest does not match expectedRevision.",
          { taskId, expectedRevision },
        );
      }

      if (!Array.isArray(candidate.oldFiles)) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Task transaction marker has no old file set.",
          { taskId },
        );
      }
      const taskPrefix = `.understand-code/tasks/${taskId}/`;
      const seenPaths = new Set<string>();
      const oldFiles = candidate.oldFiles.map((value, index) => {
        if (typeof value !== "object" || value === null) {
          throw new ArtifactStoreError(
            "artifact_corrupt",
            "Pending Task transaction file backup is invalid.",
            { taskId, index },
          );
        }
        const file = value as Record<string, unknown>;
        const relativePath = file.relativePath;
        const existed = file.existed;
        if (
          typeof relativePath !== "string" ||
          !relativePath.startsWith(taskPrefix) ||
          relativePath.slice(taskPrefix.length).includes("/") ||
          !TASK_TRANSACTION_FILE_NAMES.has(path.posix.basename(relativePath)) ||
          seenPaths.has(relativePath) ||
          typeof existed !== "boolean"
        ) {
          throw new ArtifactStoreError(
            "artifact_corrupt",
            "Pending Task transaction file identity is invalid.",
            { taskId, index, relativePath },
          );
        }
        seenPaths.add(relativePath);
        if (!existed) {
          if (
            file.contentBase64 !== undefined ||
            file.contentDigest !== undefined
          ) {
            throw new ArtifactStoreError(
              "artifact_corrupt",
              "A missing old Task file cannot contain backup bytes.",
              { taskId, relativePath },
            );
          }
          return { relativePath, existed: false };
        }
        decodeTaskTransactionBytes(
          file.contentBase64,
          file.contentDigest,
          `Pending Task transaction file ${relativePath}`,
        );
        return {
          relativePath,
          existed: true,
          contentBase64: file.contentBase64 as string,
          contentDigest: ContentDigestSchema.parse(file.contentDigest),
        };
      });

      if (!Array.isArray(candidate.targetDescriptors)) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Task transaction marker has no target descriptor set.",
          { taskId },
        );
      }
      const targetDescriptors = candidate.targetDescriptors.map(
        (descriptor, index) => {
          const parsed = ArtifactDescriptorV1Schema.parse(descriptor);
          if (
            parsed.taskId !== taskId ||
            parsed.revision !== targetRevision ||
            !parsed.path.startsWith(taskPrefix) ||
            parsed.path.slice(taskPrefix.length).includes("/") ||
            !TASK_TRANSACTION_FILE_NAMES.has(
              path.posix.basename(parsed.path),
            )
          ) {
            throw new ArtifactStoreError(
              "artifact_corrupt",
              "Pending Task transaction target descriptor is invalid.",
              { taskId, index, artifactType: parsed.artifactType },
            );
          }
          return parsed;
        },
      );
      const targetPaths = new Set(
        targetDescriptors.map((descriptor) => descriptor.path),
      );
      if (
        targetDescriptors.length !== targetPaths.size ||
        !targetDescriptors.some(
          (descriptor) => descriptor.artifactType === "task_manifest",
        ) ||
        !targetDescriptors.some(
          (descriptor) => descriptor.artifactType === "task_event_log",
        ) ||
        targetPaths.size !== seenPaths.size ||
        [...targetPaths].some((targetPath) => !seenPaths.has(targetPath))
      ) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Task transaction marker does not describe one complete target file set.",
          { taskId },
        );
      }

      return {
        version: 1,
        repositoryId,
        worktreeId,
        taskId,
        expectedRevision: expectedRevision as number,
        targetRevision: targetRevision as number,
        createdAt,
        oldManifest: {
          contentBase64: oldManifestValue.contentBase64 as string,
          contentDigest: ContentDigestSchema.parse(
            oldManifestValue.contentDigest,
          ),
        },
        oldFiles,
        targetDescriptors,
      };
    } catch (error) {
      if (error instanceof ArtifactStoreError) throw error;
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Pending Task transaction marker failed validation.",
        undefined,
        { cause: error },
      );
    }
  }

  async #durablyUnlinkManagedFile(targetPath: string): Promise<void> {
    const relativePath = repositoryRelativePathFromAbsolute(
      this.layout.worktreeRoot,
      targetPath,
    );
    await resolveManagedPath(this.layout.worktreeRoot, relativePath, {
      allowMissing: true,
    });
    await assertManagedParentStable(
      this.layout.worktreeRoot,
      targetPath,
    );
    try {
      await unlink(targetPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // A prior unlink may have reached the namespace but failed its
        // directory fsync. Re-sync even when the retry no longer sees the
        // marker so its absence is actually durable before we proceed.
        await fsyncDirectory(path.dirname(targetPath));
        return;
      }
      throw error;
    }
    await fsyncDirectory(path.dirname(targetPath));
  }

  #manifestPublishesTaskTransaction(
    manifest: ArtifactManifestV1,
    marker: PendingTaskTransactionMarkerV1,
  ): boolean {
    const published = manifest.artifacts.filter(
      (descriptor) => descriptor.taskId === marker.taskId,
    );
    return (
      published.length === marker.targetDescriptors.length &&
      canonicalTaskDescriptors(published) ===
        canonicalTaskDescriptors(marker.targetDescriptors)
    );
  }

  async #rollbackPendingTaskTransaction(
    marker: PendingTaskTransactionMarkerV1,
  ): Promise<void> {
    const oldManifestBytes = decodeTaskTransactionBytes(
      marker.oldManifest.contentBase64,
      marker.oldManifest.contentDigest,
      "Pending Task transaction old Manifest",
    );
    const restorations = marker.oldFiles.map((file) => ({
      targetPath: path.join(
        this.layout.worktreeRoot,
        ...file.relativePath.split("/"),
      ),
      ...(file.existed
        ? {
            bytes: decodeTaskTransactionBytes(
              file.contentBase64,
              file.contentDigest,
              `Pending Task transaction file ${file.relativePath}`,
            ),
          }
        : {}),
    }));
    for (const restoration of restorations) {
      if (restoration.bytes === undefined) {
        await this.#durablyUnlinkManagedFile(restoration.targetPath);
      } else {
        await atomicWriteFile(
          this.layout.worktreeRoot,
          restoration.targetPath,
          restoration.bytes,
        );
      }
    }
    await atomicWriteFile(
      this.layout.worktreeRoot,
      this.layout.manifest,
      oldManifestBytes,
    );
  }

  #parsePendingRepoPulseTransactionMarker(
    input: unknown,
  ): PendingRepoPulseTransactionMarkerV1 {
    try {
      if (typeof input !== "object" || input === null) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Repo Pulse transaction marker is not an object.",
        );
      }
      const candidate = input as Record<string, unknown>;
      if (candidate.version !== 1) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Repo Pulse transaction marker has an unsupported version.",
        );
      }
      const repositoryId = RepositoryIdSchema.parse(candidate.repositoryId);
      const worktreeId = WorktreeIdSchema.parse(candidate.worktreeId);
      const createdAt = IsoTimestampSchema.parse(candidate.createdAt);
      if (
        repositoryId !== this.repositoryId ||
        worktreeId !== this.worktreeId
      ) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Repo Pulse transaction belongs to another repository or worktree.",
          { repositoryId, worktreeId },
        );
      }
      const oldManifestValue = candidate.oldManifest as
        | Record<string, unknown>
        | undefined;
      const oldPulseValue = candidate.oldPulse as
        | Record<string, unknown>
        | undefined;
      if (oldManifestValue === undefined || oldPulseValue === undefined) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Repo Pulse transaction is missing rollback bytes.",
        );
      }
      const oldManifestBytes = decodeTaskTransactionBytes(
        oldManifestValue.contentBase64,
        oldManifestValue.contentDigest,
        "Pending Repo Pulse transaction old Manifest",
      );
      const oldPulseBytes = decodeTaskTransactionBytes(
        oldPulseValue.contentBase64,
        oldPulseValue.contentDigest,
        "Pending Repo Pulse transaction old Pulse",
      );
      const oldManifest = ArtifactManifestV1Schema.parse(
        JSON.parse(oldManifestBytes.toString("utf8")) as unknown,
      );
      if (
        oldManifest.repositoryId !== this.repositoryId ||
        oldManifest.worktreeId !== this.worktreeId
      ) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Repo Pulse rollback Manifest has the wrong identity.",
        );
      }
      const oldPulse = this.#parseTrustedArtifact(
        JSON.parse(oldPulseBytes.toString("utf8")) as unknown,
      );
      const historyDescriptor = ArtifactDescriptorV1Schema.parse(
        candidate.historyDescriptor,
      );
      const targetDescriptor = ArtifactDescriptorV1Schema.parse(
        candidate.targetDescriptor,
      );
      if (typeof candidate.historyExisted !== "boolean") {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Repo Pulse transaction history existence flag is invalid.",
        );
      }
      const canonicalPulsePath = repositoryRelativePathFromAbsolute(
        this.layout.worktreeRoot,
        this.layout.repoPulse,
      );
      const expectedHistoryPath = repositoryRelativePathFromAbsolute(
        this.layout.worktreeRoot,
        this.layout.repoPulseHistoryVersion(
          this.#repoPulseVersionToken(oldPulse),
        ),
      );
      const oldDescriptor = oldManifest.artifacts.find(
        (descriptor) =>
          descriptor.artifactId === oldPulse.artifactId &&
          descriptor.path === canonicalPulsePath,
      );
      if (
        oldPulse.artifactType !== "repo_pulse" ||
        oldDescriptor === undefined ||
        oldDescriptor.artifactType !== "repo_pulse" ||
        oldDescriptor.sourceSnapshotId !== oldPulse.sourceSnapshotId ||
        oldDescriptor.revision !== oldPulse.revision ||
        oldDescriptor.contentDigest !== oldPulse.contentDigest ||
        historyDescriptor.artifactType !== "repo_pulse" ||
        historyDescriptor.artifactId !== oldPulse.artifactId ||
        historyDescriptor.sourceSnapshotId !== oldPulse.sourceSnapshotId ||
        historyDescriptor.revision !== oldPulse.revision ||
        historyDescriptor.contentDigest !== oldPulse.contentDigest ||
        historyDescriptor.path !== expectedHistoryPath ||
        historyDescriptor.state !== "historical" ||
        historyDescriptor.freshness !== "stale" ||
        targetDescriptor.artifactType !== "repo_pulse" ||
        targetDescriptor.path !== canonicalPulsePath ||
        targetDescriptor.state !== "current" ||
        targetDescriptor.freshness === "invalid" ||
        targetDescriptor.artifactId === historyDescriptor.artifactId ||
        oldManifest.artifacts.some(
          (descriptor) =>
            descriptor.artifactId === targetDescriptor.artifactId ||
            descriptor.path === historyDescriptor.path,
        )
      ) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Repo Pulse transaction marker has inconsistent publication identities.",
          {
            oldArtifactId: oldPulse.artifactId,
            targetArtifactId: targetDescriptor.artifactId,
          },
        );
      }
      return {
        version: 1,
        repositoryId,
        worktreeId,
        createdAt,
        oldManifest: {
          contentBase64: oldManifestValue.contentBase64 as string,
          contentDigest: ContentDigestSchema.parse(
            oldManifestValue.contentDigest,
          ),
        },
        oldPulse: {
          contentBase64: oldPulseValue.contentBase64 as string,
          contentDigest: ContentDigestSchema.parse(
            oldPulseValue.contentDigest,
          ),
        },
        historyExisted: candidate.historyExisted,
        historyDescriptor,
        targetDescriptor,
      };
    } catch (error) {
      if (error instanceof ArtifactStoreError) throw error;
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Pending Repo Pulse transaction marker failed validation.",
        undefined,
        { cause: error },
      );
    }
  }

  #manifestPublishesRepoPulseTransaction(
    manifest: ArtifactManifestV1,
    marker: PendingRepoPulseTransactionMarkerV1,
  ): boolean {
    const current = manifest.artifacts.find(
      (descriptor) =>
        descriptor.artifactId === marker.targetDescriptor.artifactId,
    );
    const history = manifest.artifacts.find(
      (descriptor) =>
        descriptor.artifactId === marker.historyDescriptor.artifactId,
    );
    return (
      current !== undefined &&
      history !== undefined &&
      manifest.artifacts.filter(
        (descriptor) =>
          descriptor.artifactType === "repo_pulse" &&
          descriptor.state === "current",
      ).length === 1 &&
      canonicalizeJson(current) ===
        canonicalizeJson(marker.targetDescriptor) &&
      canonicalizeJson(history) ===
        canonicalizeJson(marker.historyDescriptor)
    );
  }

  async #rollbackPendingRepoPulseTransaction(
    marker: PendingRepoPulseTransactionMarkerV1,
  ): Promise<void> {
    const oldManifestBytes = decodeTaskTransactionBytes(
      marker.oldManifest.contentBase64,
      marker.oldManifest.contentDigest,
      "Pending Repo Pulse transaction old Manifest",
    );
    const oldPulseBytes = decodeTaskTransactionBytes(
      marker.oldPulse.contentBase64,
      marker.oldPulse.contentDigest,
      "Pending Repo Pulse transaction old Pulse",
    );
    await atomicWriteFile(
      this.layout.worktreeRoot,
      this.layout.repoPulse,
      oldPulseBytes,
    );
    await atomicWriteFile(
      this.layout.worktreeRoot,
      this.layout.manifest,
      oldManifestBytes,
    );
    if (!marker.historyExisted) {
      const historyPath = path.join(
        this.layout.worktreeRoot,
        ...marker.historyDescriptor.path.split("/"),
      );
      await this.#durablyUnlinkManagedFile(historyPath);
    }
  }

  async #recoverPendingRepoPulseTransaction(): Promise<void> {
    let marker: PendingRepoPulseTransactionMarkerV1;
    try {
      marker = this.#parsePendingRepoPulseTransactionMarker(
        await readManagedJson(
          this.layout.worktreeRoot,
          this.layout.repoPulseTransactionMarker,
        ),
      );
    } catch (error) {
      if (
        error instanceof ArtifactStoreError &&
        error.code === "artifact_not_found"
      ) {
        await fsyncDirectory(this.layout.pulseTransactions);
        return;
      }
      throw error;
    }
    let currentManifest: ArtifactManifestV1 | undefined;
    try {
      currentManifest = await this.#readManifestRaw();
    } catch (error) {
      if (
        !(
          error instanceof ArtifactStoreError &&
          (error.code === "artifact_not_found" ||
            error.code === "artifact_corrupt" ||
            error.code === "manifest_inconsistent")
        )
      ) {
        throw error;
      }
    }
    if (
      currentManifest !== undefined &&
      this.#manifestPublishesRepoPulseTransaction(currentManifest, marker)
    ) {
      await fsyncDirectory(path.dirname(this.layout.manifest));
      await this.#durablyUnlinkManagedFile(
        this.layout.repoPulseTransactionMarker,
      );
      return;
    }
    await this.#rollbackPendingRepoPulseTransaction(marker);
    await this.#durablyUnlinkManagedFile(
      this.layout.repoPulseTransactionMarker,
    );
  }

  async #recoverPendingTaskTransactions(): Promise<void> {
    await this.#recoverPendingRepoPulseTransaction();
    const directoryEntries = await readdir(this.layout.taskTransactions, {
      withFileTypes: true,
    });
    const entries = directoryEntries
      .filter((entry) => entry.name.endsWith(".json"))
      .sort((left, right) => compareCodeUnits(left.name, right.name));
    for (const entry of entries) {
      if (!entry.isFile()) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Task transaction marker must be a regular file.",
          { entry: entry.name },
        );
      }
      const markerPath = path.join(
        this.layout.taskTransactions,
        entry.name,
      );
      const marker = this.#parsePendingTaskTransactionMarker(
        await readManagedJson(this.layout.worktreeRoot, markerPath),
      );
      if (entry.name !== `${marker.taskId}.json`) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Pending Task transaction marker filename does not match taskId.",
          { markerPath, taskId: marker.taskId },
        );
      }
      let currentManifest: ArtifactManifestV1 | undefined;
      try {
        currentManifest = await this.#readManifestRaw();
      } catch (error) {
        if (
          !(
            error instanceof ArtifactStoreError &&
            (error.code === "artifact_not_found" ||
              error.code === "artifact_corrupt" ||
              error.code === "manifest_inconsistent")
          )
        ) {
          throw error;
        }
      }
      if (
        currentManifest !== undefined &&
        this.#manifestPublishesTaskTransaction(currentManifest, marker)
      ) {
        // The Manifest is the transaction commit record. Never infer a
        // partial commit from whichever individual Task files happen to be
        // present after a crash.
        await fsyncDirectory(path.dirname(this.layout.manifest));
        await this.#durablyUnlinkManagedFile(markerPath);
        continue;
      }
      await this.#rollbackPendingTaskTransaction(marker);
      await this.#durablyUnlinkManagedFile(markerPath);
    }
    // A previous unlink may have reached the namespace while both of its
    // directory-sync attempts failed. Re-sync on every successful drain,
    // including an empty directory, before any later Manifest mutation.
    await fsyncDirectory(this.layout.taskTransactions);
  }

  async initialize(): Promise<ArtifactManifestV1> {
    const directories = [
      ".understand-code",
      ".understand-code/pulses",
      ".understand-code/snapshots",
      ".understand-code/knowledge-base",
      ".understand-code/tasks",
      ".understand-code/.locks",
      ".understand-code/.locks/tasks",
      ".understand-code/.recovery",
      ".understand-code/.recovery/backups",
      ".understand-code/.recovery/quarantine",
      ".understand-code/.recovery/migrations",
      ".understand-code/.recovery/pulse-transactions",
      ".understand-code/.recovery/task-transactions",
    ];
    for (const directory of directories) {
      await ensureManagedDirectory(this.layout.worktreeRoot, directory);
    }

    return withStoreLock(
      this.layout.worktreeRoot,
      this.layout.repositoryLock,
      async () => {
        await this.#recoverPendingTaskTransactions();
        let manifest: ArtifactManifestV1;
        try {
          manifest = await this.#readManifestRaw();
        } catch (error) {
          if (
            error instanceof ArtifactStoreError &&
            error.code === "artifact_not_found"
          ) {
            const manifestBackups = await this.#backupCandidates(
              this.layout.manifest,
            );
            if (manifestBackups.length > 0) {
              manifest = await this.#recoverManifestFromBackup();
              await this.#verifyManifestArtifacts(manifest);
              return manifest;
            }
            const coldManifest = ArtifactManifestV1Schema.parse({
              schemaVersion: 1,
              repositoryId: this.repositoryId,
              worktreeId: this.worktreeId,
              status: "cold",
              producerVersion: this.producerVersion,
              updatedAt: this.#now(),
              reasons: ["No Repository Snapshot has been persisted yet."],
              artifacts: [],
            });
            await atomicWriteJson(
              this.layout.worktreeRoot,
              this.layout.manifest,
              coldManifest,
            );
            return coldManifest;
          }
          if (
            error instanceof ArtifactStoreError &&
            error.code === "artifact_corrupt"
          ) {
            manifest = await this.#recoverManifestFromBackup();
          } else {
            throw error;
          }
        }
        await this.#verifyManifestArtifacts(manifest);
        return manifest;
      },
      this.#lockOptions,
    );
  }

  async #readManifestRaw(): Promise<ArtifactManifestV1> {
    const input = await readManagedJson(
      this.layout.worktreeRoot,
      this.layout.manifest,
    );
    let manifest: ArtifactManifestV1;
    try {
      manifest = ArtifactManifestV1Schema.parse(input);
    } catch (error) {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Artifact Manifest failed its V1 contract.",
        undefined,
        { cause: error },
      );
    }
    if (
      manifest.repositoryId !== this.repositoryId ||
      manifest.worktreeId !== this.worktreeId
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "Artifact Manifest belongs to a different repository or worktree.",
        {
          expectedRepositoryId: this.repositoryId,
          actualRepositoryId: manifest.repositoryId,
          expectedWorktreeId: this.worktreeId,
          actualWorktreeId: manifest.worktreeId,
        },
      );
    }
    return manifest;
  }

  async readManifest(
    options: ReadManifestOptions = {},
  ): Promise<ArtifactManifestV1> {
    const manifest = await this.#readManifestRaw();
    if (options.verifyArtifacts !== false) {
      await this.#verifyManifestArtifacts(manifest);
    }
    return manifest;
  }

  #artifactPath(artifact: PersistedArtifactV1): string {
    return this.layout.artifact(artifact.artifactType, {
      ...(artifact.taskId === undefined ? {} : { taskId: artifact.taskId }),
      ...(artifact.artifactType === "repository_snapshot"
        ? { snapshotId: artifact.sourceSnapshotId }
        : {}),
    });
  }

  #repoPulseVersionToken(
    artifact: PersistedArtifactV1,
  ): string {
    if (artifact.artifactType !== "repo_pulse") {
      throw new TypeError("Repo Pulse versioning requires a Repo Pulse.");
    }
    return sha256CanonicalJson({
      artifactId: artifact.artifactId,
      repositoryId: artifact.repositoryId,
      worktreeId: artifact.worktreeId,
      sourceSnapshotId: artifact.sourceSnapshotId,
      revision: artifact.revision,
      contentDigest: artifact.contentDigest,
    }).slice("sha256:".length);
  }

  #canonicalizeRepoPulseIdentity<TArtifact extends PersistedArtifactV1>(
    artifact: TArtifact,
    current: PersistedArtifactV1 | undefined,
    manifest: ArtifactManifestV1,
  ): TArtifact {
    if (artifact.artifactType !== "repo_pulse") return artifact;
    if (
      current?.artifactType === "repo_pulse" &&
      compareArtifacts(current, artifact)
    ) {
      return artifact;
    }
    const requestedIdentityConflict =
      current?.artifactId === artifact.artifactId ||
      manifest.artifacts.some(
        (descriptor) => descriptor.artifactId === artifact.artifactId,
      );
    if (!requestedIdentityConflict) return artifact;

    const versionedArtifactId =
      `artifact:repo-pulse:${this.#repoPulseVersionToken(artifact)}`;
    const existingVersion = manifest.artifacts.find(
      (descriptor) => descriptor.artifactId === versionedArtifactId,
    );
    if (
      existingVersion !== undefined &&
      (existingVersion.artifactType !== "repo_pulse" ||
        existingVersion.sourceSnapshotId !== artifact.sourceSnapshotId ||
        existingVersion.revision !== artifact.revision ||
        existingVersion.contentDigest !== artifact.contentDigest ||
        existingVersion.path !==
          repositoryRelativePathFromAbsolute(
            this.layout.worktreeRoot,
            this.layout.repoPulse,
          ) ||
        existingVersion.state !== "current")
    ) {
      throw new ArtifactStoreError(
        "revision_conflict",
        "The deterministic Repo Pulse version identity already belongs to a different or historical publication.",
        {
          requestedArtifactId: artifact.artifactId,
          versionedArtifactId,
          sourceSnapshotId: artifact.sourceSnapshotId,
          revision: artifact.revision,
        },
      );
    }
    return this.#parseTrustedArtifact({
      ...artifact,
      artifactId: versionedArtifactId,
    }) as TArtifact;
  }

  #repoPulseHistoryDescriptor(
    artifact: PersistedArtifactV1,
    descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>,
  ): ReturnType<typeof ArtifactDescriptorV1Schema.parse> {
    if (
      artifact.artifactType !== "repo_pulse" ||
      descriptor.artifactType !== "repo_pulse" ||
      artifact.artifactId !== descriptor.artifactId ||
      artifact.sourceSnapshotId !== descriptor.sourceSnapshotId ||
      artifact.revision !== descriptor.revision ||
      artifact.contentDigest !== descriptor.contentDigest
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "The canonical Repo Pulse cannot be archived under a mismatched descriptor.",
        { artifactId: artifact.artifactId },
      );
    }
    const historyPath = this.layout.repoPulseHistoryVersion(
      this.#repoPulseVersionToken(artifact),
    );
    return ArtifactDescriptorV1Schema.parse({
      ...descriptor,
      path: repositoryRelativePathFromAbsolute(
        this.layout.worktreeRoot,
        historyPath,
      ),
      state: "historical",
      freshness: "stale",
    });
  }

  #assertArtifactIdentity(artifact: PersistedArtifactV1): void {
    if (
      artifact.repositoryId !== this.repositoryId ||
      artifact.worktreeId !== this.worktreeId
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Persisted Artifact belongs to a different repository or worktree.",
        {
          artifactId: artifact.artifactId,
          repositoryId: artifact.repositoryId,
          worktreeId: artifact.worktreeId,
        },
      );
    }
    const integrity = verifyArtifactContentDigestV1(
      artifact,
      digestCanonicalJson,
    );
    if (!integrity.valid) {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Persisted Artifact payload digest does not match its envelope.",
        {
          artifactId: artifact.artifactId,
          expectedDigest: integrity.expectedDigest,
          actualDigest: integrity.actualDigest,
        },
      );
    }
  }

  #parseTrustedArtifact(input: unknown): PersistedArtifactV1 {
    let artifact: PersistedArtifactV1;
    try {
      artifact = parsePersistedArtifactV1(input);
    } catch (error) {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Persisted Artifact failed its typed V1 parser.",
        undefined,
        { cause: error },
      );
    }
    this.#assertArtifactIdentity(artifact);
    return artifact;
  }

  async #readArtifactPath(targetPath: string): Promise<PersistedArtifactV1> {
    return this.#parseTrustedArtifact(
      await readManagedJson(this.layout.worktreeRoot, targetPath),
    );
  }

  async readArtifact(
    artifactType: ArtifactTypeV1,
    identifiers: { taskId?: string; snapshotId?: string } = {},
    options: { recover?: boolean } = {},
  ): Promise<ReadArtifactResult<PersistedArtifactV1>> {
    const targetPath = this.layout.artifact(artifactType, identifiers);
    try {
      const artifact = await this.#readArtifactPath(targetPath);
      if (artifact.artifactType !== artifactType) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Artifact type does not match its canonical path.",
          { expected: artifactType, actual: artifact.artifactType },
        );
      }
      if (
        (identifiers.taskId !== undefined &&
          artifact.taskId !== identifiers.taskId) ||
        (identifiers.snapshotId !== undefined &&
          artifact.sourceSnapshotId !== identifiers.snapshotId)
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "Artifact identity does not match the requested Task or Snapshot.",
          {
            requestedTaskId: identifiers.taskId,
            actualTaskId: artifact.taskId,
            requestedSnapshotId: identifiers.snapshotId,
            actualSnapshotId: artifact.sourceSnapshotId,
          },
        );
      }
      const manifest = await this.#readManifestRaw();
      const descriptor = await this.#requirePublishedDescriptor(
        artifact,
        targetPath,
        manifest,
      );
      await this.#requireArtifactSourceSnapshot(
        manifest,
        descriptor,
        artifact,
        `Artifact ${artifact.artifactId}`,
      );
      if (artifact.taskId === undefined) {
        await this.#verifyDescriptorGraph(manifest, [descriptor]);
      } else {
        await this.#verifyTaskDescriptorSet(
          manifest,
          artifact.taskId,
        );
      }
      await this.#requireStableManifest(manifest);
      return this.#readArtifactResult(artifact, descriptor, manifest);
    } catch (error) {
      if (
        options.recover === true &&
        error instanceof ArtifactStoreError &&
        (error.code === "artifact_corrupt" ||
          error.code === "artifact_not_found" ||
          error.code === "manifest_inconsistent")
      ) {
        if (identifiers.taskId !== undefined) {
          throw new ArtifactStoreError(
            "reference_integrity_failed",
            "Task-scoped Artifacts cannot be recovered one file at a time because every Task revision must remain an atomic descriptor set.",
            {
              artifactType,
              taskId: identifiers.taskId,
              recoveryPolicy: "whole_task_required",
            },
            { cause: error },
          );
        }
        return this.#recoverArtifact(
          artifactType,
          identifiers,
          targetPath,
          error,
        );
      }
      throw error;
    }
  }

  async persistArtifact<TArtifact extends PersistedArtifactV1>(
    artifactInput: TArtifact,
    options: PersistArtifactOptions = {},
  ): Promise<PersistArtifactResult<TArtifact>> {
    const artifact = this.#parseTrustedArtifact(artifactInput) as TArtifact;
    if (
      artifact.artifactType === "repository_snapshot" &&
      artifact.revision !== 0
    ) {
      throw new ArtifactStoreError(
        "revision_conflict",
        "Repository Snapshots are immutable facts and must use revision 0.",
        {
          artifactId: artifact.artifactId,
          sourceSnapshotId: artifact.sourceSnapshotId,
          actualRevision: artifact.revision,
          requiredRevision: 0,
        },
      );
    }
    if (artifact.taskId !== undefined) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Task-scoped Artifacts must be committed through persistTaskBundle so Artifact, Event, CAS, and idempotency state advance together.",
        {
          artifactId: artifact.artifactId,
          artifactType: artifact.artifactType,
          taskId: artifact.taskId,
        },
      );
    }
    const targetPath = this.#artifactPath(artifact);
    const taskId = artifact.taskId;
    const lockPath =
      taskId === undefined
        ? this.layout.repositoryLock
        : this.layout.taskLock(taskId);
    await this.#ensureArtifactParent(artifact);

    return withStoreLock(
      this.layout.worktreeRoot,
      lockPath,
      async () => {
        await this.#recoverPendingTaskTransactions();
        return this.#persistArtifactLocked(artifact, targetPath, options);
      },
      this.#lockOptions,
    );
  }

  async #ensureArtifactParent(artifact: PersistedArtifactV1): Promise<void> {
    if (artifact.taskId !== undefined) {
      TaskIdSchema.parse(artifact.taskId);
      await ensureManagedDirectory(
        this.layout.worktreeRoot,
        `.understand-code/tasks/${artifact.taskId}`,
      );
      return;
    }
    if (artifact.artifactType === "repository_snapshot") {
      await ensureManagedDirectory(
        this.layout.worktreeRoot,
        ".understand-code/snapshots",
      );
    }
  }

  async #persistArtifactLocked<TArtifact extends PersistedArtifactV1>(
    artifact: TArtifact,
    targetPath: string,
    options: PersistArtifactOptions,
  ): Promise<PersistArtifactResult<TArtifact>> {
    const current = await this.#tryReadArtifactPath(targetPath);
    if (
      artifact.artifactType === "repository_snapshot" &&
      current !== undefined &&
      !compareArtifacts(current, artifact)
    ) {
      throw new ArtifactStoreError(
        "revision_conflict",
        "A published Repository Snapshot identity cannot be revised or replaced in place.",
        {
          artifactId: artifact.artifactId,
          sourceSnapshotId: artifact.sourceSnapshotId,
          currentArtifactId: current.artifactId,
          currentSnapshotId: current.sourceSnapshotId,
          currentRevision: current.revision,
          attemptedRevision: artifact.revision,
        },
      );
    }
    if (
      artifact.artifactType === "repository_snapshot" &&
      current === undefined
    ) {
      const targetRelative = repositoryRelativePathFromAbsolute(
        this.layout.worktreeRoot,
        targetPath,
      );
      const manifest = await this.#readManifestRaw();
      const publishedIdentity = manifest.artifacts.find(
        (descriptor) =>
          descriptor.artifactType === "repository_snapshot" &&
          (descriptor.artifactId === artifact.artifactId ||
            descriptor.path === targetRelative ||
            descriptor.sourceSnapshotId === artifact.sourceSnapshotId),
      );
      if (publishedIdentity !== undefined) {
        throw new ArtifactStoreError(
          "revision_conflict",
          publishedIdentity.path === targetRelative ||
            publishedIdentity.sourceSnapshotId ===
              artifact.sourceSnapshotId
            ? "A missing published Repository Snapshot must be restored through recovery, never replaced by caller-supplied bytes."
            : "A Repository Snapshot artifactId cannot be reused for a different immutable Snapshot.",
          {
            artifactId: artifact.artifactId,
            sourceSnapshotId: artifact.sourceSnapshotId,
            existingArtifactId: publishedIdentity.artifactId,
            existingSnapshotId: publishedIdentity.sourceSnapshotId,
            recoveryRequired:
              publishedIdentity.path === targetRelative ||
              publishedIdentity.sourceSnapshotId ===
                artifact.sourceSnapshotId,
          },
        );
      }
    }
    if (artifact.artifactType === "repo_pulse") {
      artifact = this.#canonicalizeRepoPulseIdentity(
        artifact,
        current,
        await this.#readManifestRaw(),
      );
    }
    const idempotency = this.#validateIdempotencyOptions(options);
    const idempotencyPath = this.#idempotencyPath(artifact.taskId);
    const idempotencyIndex =
      idempotency === undefined
        ? undefined
        : await this.#readIdempotencyIndex(idempotencyPath);
    const existingRecord =
      idempotency === undefined
        ? undefined
        : idempotencyIndex?.records.find(
            (record) =>
              record.scope === undefined &&
              record.key === idempotency.key,
          );
    let currentDescriptor:
      | ReturnType<typeof ArtifactDescriptorV1Schema.parse>
      | undefined;
    if (current !== undefined) {
      try {
        currentDescriptor = await this.#requirePublishedDescriptor(
          current,
          targetPath,
        );
      } catch (error) {
        if (
          error instanceof ArtifactStoreError &&
          error.code === "manifest_inconsistent" &&
          idempotency !== undefined &&
          compareArtifacts(current, artifact)
        ) {
          if (
            existingRecord !== undefined &&
            (existingRecord.requestDigest !== idempotency.requestDigest ||
              existingRecord.artifactType !== artifact.artifactType ||
              existingRecord.artifactId !== artifact.artifactId ||
              existingRecord.resultRevision !== artifact.revision ||
              existingRecord.resultDigest !== artifact.contentDigest)
          ) {
            throw new ArtifactStoreError(
              "idempotency_conflict",
              "Idempotency key was already used for a different mutation.",
              { key: idempotency.key },
            );
          }
          const relativePath = repositoryRelativePathFromAbsolute(
            this.layout.worktreeRoot,
            targetPath,
          );
          const manifest = await this.#readManifestRaw();
          const descriptorAtPath = manifest.artifacts.find(
            (candidate) => candidate.path === relativePath,
          );
          if (
            descriptorAtPath !== undefined &&
            (descriptorAtPath.artifactType !== artifact.artifactType ||
              descriptorAtPath.artifactId !== artifact.artifactId)
          ) {
            throw error;
          }
          const publishedRevision = descriptorAtPath?.revision ?? 0;
          if (
            options.expectedRevision === undefined ||
            options.expectedRevision !== publishedRevision ||
            artifact.revision !== publishedRevision + 1
          ) {
            throw new ArtifactStoreError(
              "revision_conflict",
              "Orphan reconciliation must advance the published revision exactly once.",
              {
                artifactId: artifact.artifactId,
                expectedRevision: options.expectedRevision,
                publishedRevision,
                actualRevision: artifact.revision,
              },
            );
          }
          const descriptor = await this.#updateManifestForArtifact(
            artifact,
            options,
          );
          await this.#recordIdempotency(
            idempotencyPath,
            idempotencyIndex ?? { version: 1, records: [] },
            artifact,
            idempotency,
          );
          return { artifact, descriptor, replayed: true };
        }
        throw error;
      }
      if (
        currentDescriptor.state === "read_only_recovery" &&
        options.promoteRecovery !== true
      ) {
        throw new ArtifactStoreError(
          "revision_conflict",
          "Recovered Artifacts are read-only until explicitly promoted.",
          { artifactId: current.artifactId },
        );
      }
    }
    if (existingRecord !== undefined && idempotency !== undefined) {
      if (
        existingRecord.requestDigest !== idempotency.requestDigest ||
        existingRecord.artifactType !== artifact.artifactType ||
        existingRecord.artifactId !== artifact.artifactId
      ) {
        throw new ArtifactStoreError(
          "idempotency_conflict",
          "Idempotency key was already used for a different mutation.",
          { key: idempotency.key },
        );
      }
      if (
        current === undefined ||
        current.revision !== existingRecord.resultRevision ||
        current.contentDigest !== existingRecord.resultDigest
      ) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Idempotency record does not match the current persisted Artifact.",
          { key: idempotency.key },
        );
      }
      const replayDescriptor = await this.#requireReplayableArtifact(
        current,
        targetPath,
        `Idempotent replay of Artifact ${current.artifactId}`,
      );
      return {
        artifact: current as TArtifact,
        descriptor: replayDescriptor,
        replayed: true,
      };
    }

    if (
      idempotency !== undefined &&
      current !== undefined &&
      compareArtifacts(current, artifact)
    ) {
      const replayDescriptor = await this.#requireReplayableArtifact(
        current,
        targetPath,
        `Idempotent replay of Artifact ${current.artifactId}`,
      );
      await this.#recordIdempotency(
        idempotencyPath,
        idempotencyIndex ?? { version: 1, records: [] },
        artifact,
        idempotency,
      );
      return {
        artifact,
        descriptor: replayDescriptor,
        replayed: true,
      };
    }

    if (current !== undefined && options.expectedRevision === undefined) {
      if (compareArtifacts(current, artifact)) {
        const replayDescriptor = await this.#requireReplayableArtifact(
          current,
          targetPath,
          `Replay of Artifact ${current.artifactId}`,
        );
        return {
          artifact: current as TArtifact,
          descriptor: replayDescriptor,
          replayed: true,
        };
      }
      throw new ArtifactStoreError(
        "revision_conflict",
        "Replacing an existing canonical Artifact requires expectedRevision.",
        {
          artifactId: artifact.artifactId,
          currentRevision: current.revision,
        },
      );
    }

    if (options.expectedRevision !== undefined) {
      const currentRevision = current?.revision ?? 0;
      if (options.expectedRevision !== currentRevision) {
        throw new ArtifactStoreError(
          "revision_conflict",
          "Artifact compare-and-swap revision does not match current state.",
          {
            artifactId: artifact.artifactId,
            expectedRevision: options.expectedRevision,
            currentRevision,
          },
        );
      }
      const requiredRevision =
        current === undefined && options.expectedRevision === 0
          ? 1
          : currentRevision + 1;
      if (artifact.revision !== requiredRevision) {
        throw new ArtifactStoreError(
          "revision_conflict",
          "Replacement Artifact does not advance revision exactly once.",
          {
            artifactId: artifact.artifactId,
            requiredRevision,
            actualRevision: artifact.revision,
          },
        );
      }
    }

    if (
      artifact.artifactType === "repo_pulse" &&
      current?.artifactType === "repo_pulse" &&
      currentDescriptor !== undefined &&
      !compareArtifacts(current, artifact)
    ) {
      const publication = await this.#persistRepoPulseHistoryTransaction(
        current,
        currentDescriptor,
        artifact,
        options,
      );
      if (idempotency !== undefined) {
        await this.#recordIdempotency(
          idempotencyPath,
          idempotencyIndex ?? { version: 1, records: [] },
          artifact,
          idempotency,
        );
      }
      return {
        artifact,
        descriptor: publication.descriptor,
        replayed: false,
        backupPath: publication.backupPath,
      };
    }

    const previousBytes =
      current === undefined
        ? undefined
        : await readManagedFile(this.layout.worktreeRoot, targetPath);
    let backupPath =
      previousBytes === undefined
        ? undefined
        : await this.#writeBackup(targetPath, previousBytes);
    let artifactWritten = false;
    let manifestCommitted = false;
    try {
      await atomicWriteJson(
        this.layout.worktreeRoot,
        targetPath,
        artifact,
        options.artifactWrite,
      );
      artifactWritten = true;
      if (
        backupPath === undefined &&
        artifact.artifactType === "repository_snapshot"
      ) {
        backupPath = await this.#writeBackup(
          targetPath,
          await readManagedFile(this.layout.worktreeRoot, targetPath),
        );
      }
      const descriptor = await this.#updateManifestForArtifact(
        artifact,
        options,
      );
      manifestCommitted = true;
      if (idempotency !== undefined) {
        await this.#recordIdempotency(
          idempotencyPath,
          idempotencyIndex ?? { version: 1, records: [] },
          artifact,
          idempotency,
        );
      }
      return {
        artifact,
        descriptor,
        replayed: false,
        ...(backupPath === undefined ? {} : { backupPath }),
      };
    } catch (error) {
      if (isCommittedAtomicWriteError(error, this.layout.manifest)) {
        manifestCommitted = true;
      } else if (
        error instanceof ArtifactStoreError &&
        error.details?.committed === true
      ) {
        artifactWritten = true;
      }
      if (artifactWritten && !manifestCommitted) {
        if (previousBytes !== undefined) {
          await atomicWriteFile(
            this.layout.worktreeRoot,
            targetPath,
            previousBytes,
          );
        } else {
          await this.#quarantinePath(targetPath, "uncommitted");
        }
      }
      throw error;
    }
  }

  #validateIdempotencyOptions(
    options: PersistArtifactOptions,
  ): StoreIdempotencyControl | undefined {
    if (
      (options.idempotencyKey === undefined) !==
      (options.requestDigest === undefined)
    ) {
      throw new TypeError(
        "idempotencyKey and requestDigest must be provided together.",
      );
    }
    if (
      options.idempotencyKey === undefined ||
      options.requestDigest === undefined
    ) {
      return undefined;
    }
    return {
      key: IdempotencyKeySchema.parse(options.idempotencyKey),
      requestDigest: ContentDigestSchema.parse(options.requestDigest),
    };
  }

  #idempotencyPath(taskId: string | undefined): string {
    return taskId === undefined
      ? path.join(this.layout.storeRoot, ".repository-idempotency.json")
      : this.layout.task(taskId).idempotency;
  }

  async #readIdempotencyIndex(
    idempotencyPath: string,
  ): Promise<StoreIdempotencyIndex> {
    try {
      return parseIdempotencyIndex(
        await readManagedJson(this.layout.worktreeRoot, idempotencyPath),
      );
    } catch (error) {
      if (
        error instanceof ArtifactStoreError &&
        error.code === "artifact_not_found"
      ) {
        return { version: 1, records: [] };
      }
      throw error;
    }
  }

  async #recordIdempotency(
    idempotencyPath: string,
    index: StoreIdempotencyIndex,
    artifact: PersistedArtifactV1,
    idempotency: StoreIdempotencyControl,
  ): Promise<void> {
    const identity = storeIdempotencyIdentity(idempotency);
    const records = [
      ...index.records.filter(
        (record) => storeIdempotencyIdentity(record) !== identity,
      ),
      {
        key: idempotency.key,
        requestDigest: idempotency.requestDigest,
        ...(idempotency.scope === undefined
          ? {}
          : {
              scope: idempotency.scope,
              actor: idempotency.actor,
            }),
        artifactType: artifact.artifactType,
        artifactId: artifact.artifactId,
        resultRevision: artifact.revision,
        resultDigest: artifact.contentDigest,
        recordedAt: this.#now(),
      },
    ].slice(-2_000);
    await atomicWriteJson(
      this.layout.worktreeRoot,
      idempotencyPath,
      { version: 1, records } satisfies StoreIdempotencyIndex,
    );
  }

  async #tryReadArtifactPath(
    targetPath: string,
  ): Promise<PersistedArtifactV1 | undefined> {
    try {
      return await this.#readArtifactPath(targetPath);
    } catch (error) {
      if (
        error instanceof ArtifactStoreError &&
        error.code === "artifact_not_found"
      ) {
        return undefined;
      }
      throw error;
    }
  }

  async #requirePublishedDescriptor(
    artifact: PersistedArtifactV1,
    targetPath: string,
    manifestInput?: ArtifactManifestV1,
  ) {
    const manifest = manifestInput ?? (await this.#readManifestRaw());
    const relativePath = repositoryRelativePathFromAbsolute(
      this.layout.worktreeRoot,
      targetPath,
    );
    const descriptor = manifest.artifacts.find(
      (candidate) =>
        candidate.artifactId === artifact.artifactId &&
        candidate.path === relativePath,
    );
    if (
      descriptor === undefined ||
      descriptor.storageFormat !== "enveloped_v1" ||
      descriptor.artifactType !== artifact.artifactType ||
      descriptor.sourceSnapshotId !== artifact.sourceSnapshotId ||
      descriptor.taskId !== artifact.taskId ||
      descriptor.revision !== artifact.revision ||
      descriptor.contentDigest !== artifact.contentDigest ||
      descriptor.state === "corrupt" ||
      descriptor.freshness === "invalid"
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "Artifact bytes are not committed by a matching Manifest descriptor.",
        {
          artifactId: artifact.artifactId,
          path: relativePath,
          descriptor,
        },
      );
    }
    return descriptor;
  }

  async #descriptorForArtifact(
    artifact: PersistedArtifactV1,
    options: PersistArtifactOptions,
  ) {
    const relativePath = repositoryRelativePathFromAbsolute(
      this.layout.worktreeRoot,
      this.#artifactPath(artifact),
    );
    return ArtifactDescriptorV1Schema.parse({
      descriptorVersion: 1,
      artifactId: artifact.artifactId,
      artifactType: artifact.artifactType,
      storageFormat: "enveloped_v1",
      path: relativePath,
      schemaVersion: 1,
      producerVersion: artifact.producerVersion,
      sourceSnapshotId: artifact.sourceSnapshotId,
      ...(artifact.taskId === undefined ? {} : { taskId: artifact.taskId }),
      revision: artifact.revision,
      contentDigest: artifact.contentDigest,
      state: options.state ?? "current",
      freshness: options.freshness ?? "fresh",
      generatedAt: artifact.createdAt,
      dependencies: (options.dependencies ?? []).map((dependency) =>
        ArtifactDependencyV1Schema.parse(dependency),
      ),
    });
  }

  #propagateStaleFreshness(
    descriptors: readonly ReturnType<
      typeof ArtifactDescriptorV1Schema.parse
    >[],
    rootArtifactIds: readonly string[],
  ): ReturnType<typeof ArtifactDescriptorV1Schema.parse>[] {
    const staleArtifactIds = new Set(rootArtifactIds);
    let next = [...descriptors];
    let changed = true;
    while (changed) {
      changed = false;
      next = next.map((descriptor) => {
        if (
          staleArtifactIds.has(descriptor.artifactId) ||
          !descriptor.dependencies.some((dependency) =>
            staleArtifactIds.has(dependency.artifactId),
          )
        ) {
          return descriptor;
        }
        staleArtifactIds.add(descriptor.artifactId);
        changed = true;
        if (
          descriptor.freshness !== "fresh" &&
          descriptor.freshness !== "partial"
        ) {
          return descriptor;
        }
        return ArtifactDescriptorV1Schema.parse({
          ...descriptor,
          freshness: "stale",
        });
      });
    }
    return next;
  }

  async #nextManifestForArtifact(
    currentManifest: ArtifactManifestV1,
    artifact: PersistedArtifactV1,
    options: PersistArtifactOptions,
    pulseHistory?: RepoPulseHistoryPublication,
  ): Promise<{
    descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>;
    manifest: ArtifactManifestV1;
  }> {
    const snapshotDescriptor =
      artifact.artifactType === "repository_snapshot"
        ? undefined
        : await this.#requireUsableSnapshot(
            currentManifest,
            artifact.sourceSnapshotId,
            `Artifact ${artifact.artifactId}`,
          );
    const requestedFreshness = options.freshness ?? "fresh";
    const effectiveFreshness =
      snapshotDescriptor !== undefined &&
      requestedFreshness === "fresh" &&
      !(
        snapshotDescriptor.state === "current" &&
        snapshotDescriptor.freshness === "fresh"
      )
        ? ("partial" as const)
        : requestedFreshness;
    const nextDescriptor = await this.#descriptorForArtifact(
      artifact,
      snapshotDescriptor !== undefined
        ? {
            ...options,
            freshness: effectiveFreshness,
            dependencies: this.#mergeRequiredDependencies(
              [this.#requiredDependency(snapshotDescriptor)],
              options.dependencies,
            ),
          }
        : options,
    );
    const latestSnapshotChanged =
      artifact.artifactType === "repository_snapshot" &&
      currentManifest.latestSnapshotId !== artifact.sourceSnapshotId;
    const normalizedExisting = currentManifest.artifacts
      .filter(
        (candidate) =>
          candidate.artifactId !== nextDescriptor.artifactId &&
          candidate.path !== nextDescriptor.path,
      )
      .map((candidate) => {
        if (
          latestSnapshotChanged &&
          candidate.sourceSnapshotId !== artifact.sourceSnapshotId &&
          candidate.state === "current"
        ) {
          return ArtifactDescriptorV1Schema.parse({
            ...candidate,
            state:
              candidate.artifactType === "repository_snapshot"
                ? "historical"
                : candidate.state,
            freshness:
              candidate.freshness === "fresh"
                ? "stale"
                : candidate.freshness,
          });
        }
        return candidate;
      });
    let artifacts = [
      ...normalizedExisting,
      ...(pulseHistory === undefined
        ? []
        : [pulseHistory.historyDescriptor]),
      nextDescriptor,
    ];
    if (pulseHistory !== undefined) {
      artifacts = this.#propagateStaleFreshness(artifacts, [
        pulseHistory.historyDescriptor.artifactId,
      ]);
    }
    return {
      descriptor: nextDescriptor,
      manifest: ArtifactManifestV1Schema.parse({
        ...currentManifest,
        status:
          artifact.artifactType === "repository_snapshot"
            ? "ready"
            : currentManifest.status,
        ...(artifact.artifactType === "repository_snapshot"
          ? { latestSnapshotId: artifact.sourceSnapshotId }
          : {}),
        producerVersion: this.producerVersion,
        updatedAt: this.#now(),
        reasons:
          artifact.artifactType === "repository_snapshot"
            ? []
            : currentManifest.reasons,
        artifacts,
      }),
    };
  }

  async #updateManifestForArtifact(
    artifact: PersistedArtifactV1,
    options: PersistArtifactOptions,
  ) {
    let descriptor:
      | ReturnType<typeof ArtifactDescriptorV1Schema.parse>
      | undefined;
    const update = async (): Promise<void> => {
      const currentManifest = await this.#readManifestRaw();
      const next = await this.#nextManifestForArtifact(
        currentManifest,
        artifact,
        options,
      );
      descriptor = next.descriptor;
      const previousManifestBytes = await readManagedFile(
        this.layout.worktreeRoot,
        this.layout.manifest,
      );
      await this.#writeBackup(this.layout.manifest, previousManifestBytes);
      try {
        await atomicWriteJson(
          this.layout.worktreeRoot,
          this.layout.manifest,
          next.manifest,
          options.manifestWrite,
        );
      } catch (error) {
        if (isCommittedAtomicWriteError(error, this.layout.manifest)) {
          throw error;
        }
        await atomicWriteFile(
          this.layout.worktreeRoot,
          this.layout.manifest,
          previousManifestBytes,
        );
        throw error;
      }
    };

    if (artifact.taskId === undefined) {
      await update();
    } else {
      await withStoreLock(
        this.layout.worktreeRoot,
        this.layout.repositoryLock,
        async () => update(),
        this.#lockOptions,
      );
    }
    if (descriptor === undefined) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "Artifact descriptor was not produced during Manifest publication.",
        { artifactId: artifact.artifactId },
      );
    }
    return descriptor;
  }

  async #persistRepoPulseHistoryTransaction<
    TArtifact extends PersistedArtifactV1,
  >(
    current: PersistedArtifactV1,
    currentDescriptor: ReturnType<
      typeof ArtifactDescriptorV1Schema.parse
    >,
    artifact: TArtifact,
    options: PersistArtifactOptions,
  ): Promise<{
    descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>;
    backupPath: string;
  }> {
    if (
      current.artifactType !== "repo_pulse" ||
      artifact.artifactType !== "repo_pulse"
    ) {
      throw new TypeError(
        "Repo Pulse history transactions require two Repo Pulse envelopes.",
      );
    }
    const currentManifest = await this.#readManifestRaw();
    const publishedCurrent = await this.#requirePublishedDescriptor(
      current,
      this.layout.repoPulse,
      currentManifest,
    );
    if (
      canonicalizeJson(publishedCurrent) !==
      canonicalizeJson(currentDescriptor)
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "The current Repo Pulse descriptor changed before history publication.",
        { artifactId: current.artifactId },
      );
    }
    const oldPulseBytes = await readManagedFile(
      this.layout.worktreeRoot,
      this.layout.repoPulse,
    );
    const historyDescriptor = this.#repoPulseHistoryDescriptor(
      current,
      currentDescriptor,
    );
    const historyPath = path.join(
      this.layout.worktreeRoot,
      ...historyDescriptor.path.split("/"),
    );
    let historyAlreadyExists = false;
    try {
      const existingHistory = await readManagedFile(
        this.layout.worktreeRoot,
        historyPath,
      );
      if (!existingHistory.equals(oldPulseBytes)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "Repo Pulse history identity resolves conflicting immutable bytes.",
          {
            artifactId: current.artifactId,
            historyPath: historyDescriptor.path,
          },
        );
      }
      historyAlreadyExists = true;
    } catch (error) {
      if (
        !(
          error instanceof ArtifactStoreError &&
          error.code === "artifact_not_found"
        )
      ) {
        throw error;
      }
    }
    const next = await this.#nextManifestForArtifact(
      currentManifest,
      artifact,
      options,
      { historyDescriptor },
    );
    if (
      next.descriptor.artifactId === historyDescriptor.artifactId ||
      next.manifest.artifacts.filter(
        (descriptor) =>
          descriptor.artifactType === "repo_pulse" &&
          descriptor.state === "current",
      ).length !== 1
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "Repo Pulse history publication must retain one historical identity and exactly one current identity.",
        {
          historicalArtifactId: historyDescriptor.artifactId,
          targetArtifactId: next.descriptor.artifactId,
        },
      );
    }
    const previousManifestBytes = await readManagedFile(
      this.layout.worktreeRoot,
      this.layout.manifest,
    );
    await this.#writeBackup(this.layout.manifest, previousManifestBytes);
    const backupPath = await this.#writeBackup(
      this.layout.repoPulse,
      oldPulseBytes,
    );
    const marker: PendingRepoPulseTransactionMarkerV1 = {
      version: 1,
      repositoryId: this.repositoryId,
      worktreeId: this.worktreeId,
      createdAt: this.#now(),
      oldManifest: taskTransactionBytes(previousManifestBytes),
      oldPulse: taskTransactionBytes(oldPulseBytes),
      historyExisted: historyAlreadyExists,
      historyDescriptor,
      targetDescriptor: next.descriptor,
    };
    let markerCreated = false;
    let manifestCommitted = false;
    let manifestCommitAmbiguous = false;
    try {
      try {
        await atomicWriteJson(
          this.layout.worktreeRoot,
          this.layout.repoPulseTransactionMarker,
          marker,
        );
        markerCreated = true;
      } catch (error) {
        if (
          isCommittedAtomicWriteError(
            error,
            this.layout.repoPulseTransactionMarker,
          )
        ) {
          markerCreated = true;
        }
        throw error;
      }
      if (!historyAlreadyExists) {
        await atomicWriteFile(
          this.layout.worktreeRoot,
          historyPath,
          oldPulseBytes,
          options.historyWrite,
        );
      } else {
        await fsyncDirectory(path.dirname(historyPath));
      }
      await atomicWriteJson(
        this.layout.worktreeRoot,
        this.layout.repoPulse,
        artifact,
        options.artifactWrite,
      );
      try {
        await atomicWriteJson(
          this.layout.worktreeRoot,
          this.layout.manifest,
          next.manifest,
          options.manifestWrite,
        );
        manifestCommitted = true;
      } catch (error) {
        if (isCommittedAtomicWriteError(error, this.layout.manifest)) {
          if (
            isDurablyCommittedAtomicWriteError(
              error,
              this.layout.manifest,
            )
          ) {
            manifestCommitted = true;
          } else {
            manifestCommitAmbiguous = true;
          }
        }
        throw error;
      }
      await this.#durablyUnlinkManagedFile(
        this.layout.repoPulseTransactionMarker,
      );
      markerCreated = false;
      return { descriptor: next.descriptor, backupPath };
    } catch (error) {
      if (isCommittedAtomicWriteError(error, this.layout.manifest)) {
        if (
          isDurablyCommittedAtomicWriteError(
            error,
            this.layout.manifest,
          )
        ) {
          manifestCommitted = true;
        } else {
          manifestCommitAmbiguous = true;
        }
      }
      if (markerCreated) {
        if (manifestCommitted) {
          await this.#durablyUnlinkManagedFile(
            this.layout.repoPulseTransactionMarker,
          ).catch(() => undefined);
        } else if (!manifestCommitAmbiguous) {
          try {
            await this.#rollbackPendingRepoPulseTransaction(marker);
            await this.#durablyUnlinkManagedFile(
              this.layout.repoPulseTransactionMarker,
            );
          } catch (rollbackError) {
            throw new ArtifactStoreError(
              "artifact_corrupt",
              "Repo Pulse history publication failed and its durable rollback did not complete.",
              {
                historicalArtifactId: historyDescriptor.artifactId,
                targetArtifactId: next.descriptor.artifactId,
              },
              { cause: rollbackError },
            );
          }
        }
      }
      throw error;
    }
  }

  async #writeBackup(
    targetPath: string,
    bytes: Uint8Array,
  ): Promise<string> {
    const targetRelative = repositoryRelativePathFromAbsolute(
      this.layout.worktreeRoot,
      targetPath,
    );
    const bucket = sha256Bytes(targetRelative).slice("sha256:".length);
    const backupDirectoryRelative =
      `.understand-code/.recovery/backups/${bucket}`;
    const backupDirectory = await ensureManagedDirectory(
      this.layout.worktreeRoot,
      backupDirectoryRelative,
    );
    const sequencePath = path.join(backupDirectory, ".sequence");
    let sequence = 0n;
    try {
      const sequenceText = (
        await readManagedFile(this.layout.worktreeRoot, sequencePath)
      )
        .toString("utf8")
        .trim();
      if (!/^(?:0|[1-9][0-9]*)$/u.test(sequenceText)) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Backup sequence metadata is invalid.",
          { sequencePath },
        );
      }
      sequence = BigInt(sequenceText);
    } catch (error) {
      if (
        !(
          error instanceof ArtifactStoreError &&
          error.code === "artifact_not_found"
        )
      ) {
        throw error;
      }
    }
    sequence += 1n;
    await atomicWriteFile(
      this.layout.worktreeRoot,
      sequencePath,
      `${sequence}\n`,
    );
    const backupPath = path.join(
      backupDirectory,
      `seq-${sequence.toString().padStart(24, "0")}-${
        String(this.#clock().getTime()).padStart(16, "0")
      }-${randomUUID()}.bak`,
    );
    await atomicWriteFile(this.layout.worktreeRoot, backupPath, bytes);
    return backupPath;
  }

  async #backupCandidates(targetPath: string): Promise<string[]> {
    const targetRelative = repositoryRelativePathFromAbsolute(
      this.layout.worktreeRoot,
      targetPath,
    );
    const bucket = sha256Bytes(targetRelative).slice("sha256:".length);
    const backupDirectoryRelative =
      `.understand-code/.recovery/backups/${bucket}`;
    let backupDirectory: string;
    try {
      backupDirectory = await resolveManagedPath(
        this.layout.worktreeRoot,
        backupDirectoryRelative,
      );
    } catch (error) {
      if (
        error instanceof ArtifactStoreError &&
        error.code === "artifact_not_found"
      ) {
        return [];
      }
      throw error;
    }
    const sequenceOf = (entry: string): bigint | undefined => {
      const match = /^seq-([0-9]+)-/u.exec(entry);
      return match?.[1] === undefined ? undefined : BigInt(match[1]);
    };
    return (await readdir(backupDirectory))
      .filter((entry) => entry.endsWith(".bak"))
      .sort((left, right) => {
        const leftSequence = sequenceOf(left);
        const rightSequence = sequenceOf(right);
        if (leftSequence !== undefined && rightSequence !== undefined) {
          if (leftSequence === rightSequence) {
            return right.localeCompare(left);
          }
          return leftSequence > rightSequence ? -1 : 1;
        }
        if (leftSequence !== undefined) return -1;
        if (rightSequence !== undefined) return 1;
        return right.localeCompare(left);
      })
      .map((entry) => path.join(backupDirectory, entry));
  }

  async #quarantinePath(targetPath: string, reason: string): Promise<string> {
    const targetRelative = repositoryRelativePathFromAbsolute(
      this.layout.worktreeRoot,
      targetPath,
    );
    await resolveManagedPath(this.layout.worktreeRoot, targetRelative);
    const quarantineDirectory = await ensureManagedDirectory(
      this.layout.worktreeRoot,
      ".understand-code/.recovery/quarantine/artifacts",
    );
    const quarantinePath = path.join(
      quarantineDirectory,
      `${path.basename(targetPath)}-${reason}-${this.#clock().getTime()}-${randomUUID()}`,
    );
    await rename(targetPath, quarantinePath);
    return quarantinePath;
  }

  async #recoverArtifact(
    artifactType: ArtifactTypeV1,
    identifiers: { taskId?: string; snapshotId?: string },
    targetPath: string,
    originalError: ArtifactStoreError,
  ): Promise<ReadArtifactResult<PersistedArtifactV1>> {
    const taskId = identifiers.taskId;
    const lockPath =
      taskId === undefined
        ? this.layout.repositoryLock
        : this.layout.taskLock(taskId);
    return withStoreLock(
      this.layout.worktreeRoot,
      lockPath,
      async () => {
        if (taskId === undefined) {
          // The callback already owns the repository lock.
          await this.#recoverPendingTaskTransactions();
        } else {
          // Task recovery owns the Task lock first, matching Task transaction
          // lock order, and drains pending repository state before touching
          // canonical Task bytes.
          await withStoreLock(
            this.layout.worktreeRoot,
            this.layout.repositoryLock,
            async () => this.#recoverPendingTaskTransactions(),
            this.#lockOptions,
          );
        }
        let sourceSnapshotFailure: ArtifactStoreError | undefined;
        try {
          const nowReadable = await this.#readArtifactPath(targetPath);
          if (
            nowReadable.artifactType !== artifactType ||
            (identifiers.taskId !== undefined &&
              nowReadable.taskId !== identifiers.taskId) ||
            (identifiers.snapshotId !== undefined &&
              nowReadable.sourceSnapshotId !== identifiers.snapshotId)
          ) {
            throw new ArtifactStoreError(
              "reference_integrity_failed",
              "Artifact identity changed while entering recovery.",
              { artifactType, identifiers },
            );
          }
          const manifest = await this.#readManifestRaw();
          const descriptor = await this.#requirePublishedDescriptor(
            nowReadable,
            targetPath,
            manifest,
          );
          try {
            await this.#requireArtifactSourceSnapshot(
              manifest,
              descriptor,
              nowReadable,
              `Recovered Artifact ${nowReadable.artifactId}`,
            );
          } catch (error) {
            if (
              error instanceof ArtifactStoreError &&
              error.code === "reference_integrity_failed"
            ) {
              sourceSnapshotFailure = error;
            }
            throw error;
          }
          await this.#verifyDescriptorGraph(manifest, [descriptor]);
          await this.#requireStableManifest(manifest);
          return this.#readArtifactResult(
            nowReadable,
            descriptor,
            manifest,
          );
        } catch (error) {
          if (!isArtifactIntegrityFailure(error)) throw error;
          // Continue with bounded backup recovery under the writer lock.
        }
        const targetRelative = repositoryRelativePathFromAbsolute(
          this.layout.worktreeRoot,
          targetPath,
        );
        const recoveryManifest = await this.#readManifestRaw();
        const committedDescriptor = recoveryManifest.artifacts.find(
          (descriptor) =>
            descriptor.path === targetRelative &&
            descriptor.storageFormat === "enveloped_v1" &&
            descriptor.artifactType === artifactType &&
            (identifiers.taskId === undefined ||
              descriptor.taskId === identifiers.taskId) &&
            (identifiers.snapshotId === undefined ||
              descriptor.sourceSnapshotId === identifiers.snapshotId),
        );
        if (committedDescriptor === undefined) {
          await this.#quarantinePath(targetPath, "orphan").catch(
            () => undefined,
          );
          throw new ArtifactStoreError(
            "artifact_corrupt",
            "Artifact recovery requires an existing committed Manifest descriptor.",
            { artifactType, identifiers, path: targetRelative },
            { cause: originalError },
          );
        }
        try {
          await this.#quarantinePath(targetPath, "corrupt");
        } catch (error) {
          if (
            !(
              error instanceof ArtifactStoreError &&
              error.code === "artifact_not_found"
            )
          ) {
            throw error;
          }
        }

        for (const candidate of await this.#backupCandidates(targetPath)) {
          let bytes: Buffer;
          let parsed: PersistedArtifactV1;
          try {
            bytes = await readManagedFile(
              this.layout.worktreeRoot,
              candidate,
            );
          } catch (error) {
            if (
              error instanceof ArtifactStoreError &&
              error.code === "artifact_not_found"
            ) {
              continue;
            }
            throw error;
          }
          let candidateValue: unknown;
          try {
            candidateValue = JSON.parse(bytes.toString("utf8")) as unknown;
          } catch {
            continue;
          }
          try {
            parsed = this.#parseTrustedArtifact(candidateValue);
            if (
              parsed.artifactType !== artifactType ||
              (taskId !== undefined && parsed.taskId !== taskId) ||
              (identifiers.snapshotId !== undefined &&
                parsed.sourceSnapshotId !== identifiers.snapshotId)
            ) {
              continue;
            }
          } catch (error) {
            if (isArtifactIntegrityFailure(error)) {
              // A corrupt backup is skipped; the next older backup is attempted.
              continue;
            }
            throw error;
          }
          try {
            await this.#requireArtifactSourceSnapshot(
              recoveryManifest,
              committedDescriptor,
              parsed,
              `Recovered Artifact ${parsed.artifactId}`,
            );
          } catch (error) {
            if (
              error instanceof ArtifactStoreError &&
              error.code === "reference_integrity_failed"
            ) {
              sourceSnapshotFailure = error;
              continue;
            }
            throw error;
          }
          try {
            await atomicWriteFile(
              this.layout.worktreeRoot,
              targetPath,
              bytes,
            );
            await this.#markDescriptorRecoveryState(
              parsed,
              "read_only_recovery",
              "stale",
            );
            const recoveredManifest = await this.#readManifestRaw();
            const recoveredDescriptor =
              await this.#requirePublishedDescriptor(
                parsed,
                targetPath,
                recoveredManifest,
              );
            await this.#verifyDescriptorGraph(recoveredManifest, [
              recoveredDescriptor,
            ]);
            await this.#requireStableManifest(recoveredManifest);
            return this.#readArtifactResult(
              parsed,
              recoveredDescriptor,
              recoveredManifest,
            );
          } catch (error) {
            if (
              isCommittedAtomicWriteError(
                error,
                this.layout.manifest,
              )
            ) {
              // The Manifest is the recovery commit point. Preserve the
              // candidate bytes it now publishes, but surface the durability
              // ambiguity so the caller can retry and verify that state.
              throw error;
            }
            await this.#quarantinePath(
              targetPath,
              "recovery-rejected",
            ).catch(() => undefined);
            if (
              error instanceof ArtifactStoreError &&
              (error.code === "manifest_inconsistent" ||
                error.code === "reference_integrity_failed")
            ) {
              continue;
            }
            throw error;
          }
        }
        await this.#markDescriptorCorrupt(committedDescriptor);
        if (sourceSnapshotFailure !== undefined) {
          throw sourceSnapshotFailure;
        }
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "No valid Artifact backup was available for recovery.",
          { artifactType, identifiers },
          { cause: originalError },
        );
      },
      this.#lockOptions,
    );
  }

  async #markDescriptorRecoveryState(
    artifact: PersistedArtifactV1,
    state: "read_only_recovery",
    freshness: "stale",
  ): Promise<void> {
    const update = async (): Promise<void> => {
      const manifest = await this.#readManifestRaw();
      const recoveredPath = repositoryRelativePathFromAbsolute(
        this.layout.worktreeRoot,
        this.#artifactPath(artifact),
      );
      const existing = manifest.artifacts.find(
        (descriptor) =>
          descriptor.path === recoveredPath &&
          descriptor.artifactType === artifact.artifactType,
      );
      if (existing === undefined) {
        throw new ArtifactStoreError(
          "manifest_inconsistent",
          "Recovered Artifact has no committed descriptor to replace.",
          { artifactId: artifact.artifactId, path: recoveredPath },
        );
      }
      const historicalIdentity =
        artifact.artifactType === "repo_pulse"
          ? manifest.artifacts.find(
              (descriptor) =>
                descriptor.artifactType === "repo_pulse" &&
                descriptor.artifactId === artifact.artifactId &&
                descriptor.path !== recoveredPath,
            )
          : undefined;
      const recoveredDescriptor = await this.#descriptorForArtifact(artifact, {
        state,
        freshness,
        dependencies:
          historicalIdentity?.dependencies ?? existing.dependencies,
      });
      let recoveredArtifacts;
      if (artifact.artifactType === "repo_pulse") {
        const firstPulseIndex = manifest.artifacts.findIndex(
          (descriptor) => descriptor.artifactType === "repo_pulse",
        );
        recoveredArtifacts = manifest.artifacts.filter(
          (descriptor) =>
            descriptor.path !== recoveredPath &&
            !(
              descriptor.artifactType === "repo_pulse" &&
              descriptor.artifactId === artifact.artifactId
            ),
        );
        recoveredArtifacts.splice(
          Math.min(
            firstPulseIndex < 0
              ? recoveredArtifacts.length
              : firstPulseIndex,
            recoveredArtifacts.length,
          ),
          0,
          recoveredDescriptor,
        );
      } else {
        recoveredArtifacts = manifest.artifacts.map((descriptor) =>
          descriptor.path === recoveredPath
            ? recoveredDescriptor
            : descriptor,
        );
      }
      let next: ArtifactManifestV1;
      try {
        next = ArtifactManifestV1Schema.parse({
          ...manifest,
          ...(artifact.artifactType === "repository_snapshot"
            ? {
                status: "error" as const,
                reasons: [
                  "The latest Repository Snapshot was restored from backup and is read-only.",
                ],
              }
            : {}),
          updatedAt: this.#now(),
          artifacts:
            artifact.artifactType === "repository_snapshot"
              ? recoveredArtifacts.map((descriptor) =>
                  descriptor.artifactId !== artifact.artifactId &&
                  descriptor.sourceSnapshotId === artifact.sourceSnapshotId &&
                  descriptor.freshness !== "invalid"
                    ? {
                        ...descriptor,
                        freshness: "stale" as const,
                      }
                    : descriptor,
                )
              : recoveredArtifacts,
        });
      } catch (error) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "Recovered Artifact conflicts with published dependency pins.",
          { artifactId: artifact.artifactId },
          { cause: error },
        );
      }
      await atomicWriteJson(
        this.layout.worktreeRoot,
        this.layout.manifest,
        next,
      );
    };
    if (artifact.taskId === undefined) {
      await update();
    } else {
      await withStoreLock(
        this.layout.worktreeRoot,
        this.layout.repositoryLock,
        async () => {
          await this.#recoverPendingTaskTransactions();
          await update();
        },
        this.#lockOptions,
      );
    }
  }

  async #markDescriptorCorrupt(
    committedDescriptor: ReturnType<
      typeof ArtifactDescriptorV1Schema.parse
    >,
  ): Promise<void> {
    const update = async (): Promise<void> => {
      const manifest = await this.#readManifestRaw();
      let artifacts = manifest.artifacts.map((descriptor) =>
        descriptor.artifactId === committedDescriptor.artifactId &&
        descriptor.path === committedDescriptor.path &&
        descriptor.artifactType === committedDescriptor.artifactType
          ? {
              ...descriptor,
              state: "corrupt" as const,
              freshness: "invalid" as const,
            }
          : descriptor,
      );
      if (committedDescriptor.artifactType === "repository_snapshot") {
        const invalidSnapshotIds = new Set(
          artifacts
            .filter(
              (descriptor) =>
                descriptor.artifactType === "repository_snapshot" &&
                descriptor.state === "corrupt",
            )
            .map((descriptor) => descriptor.sourceSnapshotId),
        );
        artifacts = artifacts.map((descriptor) =>
          descriptor.artifactType !== "repository_snapshot" &&
          invalidSnapshotIds.has(descriptor.sourceSnapshotId)
            ? {
                ...descriptor,
                freshness: "invalid" as const,
              }
            : descriptor,
        );
      }
      const invalidArtifactIds = new Set(
        artifacts
          .filter((descriptor) => descriptor.state === "corrupt")
          .map((descriptor) => descriptor.artifactId),
      );
      let propagated = true;
      while (propagated) {
        propagated = false;
        artifacts = artifacts.map((descriptor) => {
          if (
            invalidArtifactIds.has(descriptor.artifactId) ||
            !descriptor.dependencies.some((dependency) =>
              invalidArtifactIds.has(dependency.artifactId),
            )
          ) {
            return descriptor;
          }
          invalidArtifactIds.add(descriptor.artifactId);
          propagated = true;
          return {
            ...descriptor,
            freshness: "invalid" as const,
          };
        });
      }
      const hasCorrupt = artifacts.some(
        (descriptor) => descriptor.state === "corrupt",
      );
      const next = ArtifactManifestV1Schema.parse({
        ...manifest,
        status: hasCorrupt ? "error" : manifest.status,
        reasons: hasCorrupt
          ? [
              `${committedDescriptor.artifactType} is corrupt and no valid backup was found.`,
            ]
          : manifest.reasons,
        updatedAt: this.#now(),
        artifacts,
      });
      await atomicWriteJson(
        this.layout.worktreeRoot,
        this.layout.manifest,
        next,
      );
    };
    if (committedDescriptor.taskId === undefined) {
      await update();
    } else {
      await withStoreLock(
        this.layout.worktreeRoot,
        this.layout.repositoryLock,
        async () => {
          await this.#recoverPendingTaskTransactions();
          await update();
        },
        this.#lockOptions,
      );
    }
  }

  async #recoverManifestFromBackup(): Promise<ArtifactManifestV1> {
    let corruptBytes: Buffer | undefined;
    try {
      corruptBytes = await readManagedFile(
        this.layout.worktreeRoot,
        this.layout.manifest,
      );
    } catch (error) {
      if (
        !(
          error instanceof ArtifactStoreError &&
          error.code === "artifact_not_found"
        )
      ) {
        throw error;
      }
    }
    for (const candidate of await this.#backupCandidates(this.layout.manifest)) {
      let bytes: Buffer;
      try {
        bytes = await readManagedFile(
          this.layout.worktreeRoot,
          candidate,
        );
      } catch (error) {
        if (
          error instanceof ArtifactStoreError &&
          error.code === "artifact_not_found"
        ) {
          continue;
        }
        throw error;
      }
      let parsed: ArtifactManifestV1;
      try {
        parsed = ArtifactManifestV1Schema.parse(
          JSON.parse(bytes.toString("utf8")) as unknown,
        );
      } catch {
        continue;
      }
      if (
        parsed.repositoryId !== this.repositoryId ||
        parsed.worktreeId !== this.worktreeId
      ) {
        continue;
      }
      try {
        await this.#verifyManifestArtifacts(parsed);
      } catch (error) {
        if (isArtifactIntegrityFailure(error)) {
          continue;
        }
        throw error;
      }
      try {
        if (corruptBytes !== undefined) {
          await this.#quarantinePath(
            this.layout.manifest,
            "corrupt-manifest",
          );
        }
        await atomicWriteFile(
          this.layout.worktreeRoot,
          this.layout.manifest,
          bytes,
        );
      } catch (error) {
        if (
          error instanceof ArtifactStoreError &&
          error.details?.committed === true &&
          error.details?.targetPath === this.layout.manifest
        ) {
          throw error;
        }
        if (corruptBytes !== undefined) {
          try {
            await atomicWriteFile(
              this.layout.worktreeRoot,
              this.layout.manifest,
              corruptBytes,
            );
          } catch (rollbackError) {
            throw new ArtifactStoreError(
              "artifact_corrupt",
              "Manifest recovery failed and the prior corrupt bytes could not be restored.",
              { backupPath: candidate },
              { cause: rollbackError },
            );
          }
        }
        throw error;
      }
      return parsed;
    }
    throw new ArtifactStoreError(
      "artifact_corrupt",
      "Artifact Manifest is corrupt and has no valid backup.",
    );
  }

  async #verifyManifestArtifacts(
    manifest: ArtifactManifestV1,
  ): Promise<void> {
    const verifiedSourceSnapshots = new Set<string>();
    for (const descriptor of manifest.artifacts) {
      if (
        descriptor.state !== "current" &&
        descriptor.state !== "read_only_recovery"
      ) {
        continue;
      }
      if (descriptor.freshness === "invalid") {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "A current Artifact descriptor is explicitly invalid.",
          { artifactId: descriptor.artifactId },
        );
      }
      const absolutePath = await resolveManagedPath(
        this.layout.worktreeRoot,
        descriptor.path,
      );
      if (descriptor.storageFormat === "enveloped_v1") {
        const artifact = await this.#readArtifactPath(absolutePath);
        const canonicalPath = this.#artifactPath(artifact);
        if (
          canonicalPath !== absolutePath ||
          artifact.artifactId !== descriptor.artifactId ||
          artifact.artifactType !== descriptor.artifactType ||
          artifact.sourceSnapshotId !== descriptor.sourceSnapshotId ||
          artifact.revision !== descriptor.revision ||
          artifact.contentDigest !== descriptor.contentDigest ||
          artifact.taskId !== descriptor.taskId
        ) {
          throw new ArtifactStoreError(
            "manifest_inconsistent",
            "Artifact descriptor does not match the typed persisted Artifact.",
            { artifactId: descriptor.artifactId },
          );
        }
      } else if (descriptor.storageFormat === "jsonl_v1") {
        if (
          descriptor.taskId === undefined ||
          absolutePath !== this.layout.task(descriptor.taskId).events
        ) {
          throw new ArtifactStoreError(
            "manifest_inconsistent",
            "Task event-log descriptor path is not canonical.",
            { artifactId: descriptor.artifactId },
          );
        }
        const parsed = await readTaskEventLog(
          this.layout,
          descriptor.taskId,
        );
        if (
          parsed.truncatedTail !== undefined ||
          parsed.contentDigest !== descriptor.contentDigest ||
          parsed.events.at(-1)?.revision !== descriptor.revision
        ) {
          throw new ArtifactStoreError(
            "manifest_inconsistent",
            "Task event-log descriptor does not match the trusted log.",
            { artifactId: descriptor.artifactId },
          );
        }
      } else {
        const bytes = await readManagedFile(
          this.layout.worktreeRoot,
          absolutePath,
        );
        if (
          descriptor.contentDigest !== undefined &&
          sha256Bytes(bytes) !== descriptor.contentDigest
        ) {
          throw new ArtifactStoreError(
            "manifest_inconsistent",
            "Legacy Artifact digest does not match its descriptor.",
            { artifactId: descriptor.artifactId },
          );
        }
      }
      if (
        descriptor.artifactType !== "repository_snapshot" &&
        descriptor.sourceSnapshotId !== undefined &&
        !this.#isContextlessColdRecovery(manifest, descriptor) &&
        !verifiedSourceSnapshots.has(descriptor.sourceSnapshotId)
      ) {
        await this.#requireReadableSourceSnapshot(
          manifest,
          descriptor.sourceSnapshotId,
          `Artifact ${descriptor.artifactId}`,
        );
        verifiedSourceSnapshots.add(descriptor.sourceSnapshotId);
      }
    }
  }

  async appendTaskEvent(
    taskIdInput: string,
    event: TaskEventV1,
    options: AppendTaskEventOptions = {},
  ): Promise<AppendTaskEventResult> {
    const taskId = TaskIdSchema.parse(taskIdInput);
    if (
      event.repositoryId !== this.repositoryId ||
      event.worktreeId !== this.worktreeId
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Task event belongs to a different repository or worktree.",
        {
          repositoryId: event.repositoryId,
          worktreeId: event.worktreeId,
        },
      );
    }
    const requiredSnapshotId = event.sourceSnapshotId;
    if (requiredSnapshotId === undefined) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "A standalone Task Event must reference a published repository snapshot.",
        { eventId: event.eventId, taskId },
      );
    }
    await ensureManagedDirectory(
      this.layout.worktreeRoot,
      `.understand-code/tasks/${taskId}`,
    );
    return withStoreLock(
      this.layout.worktreeRoot,
      this.layout.taskLock(taskId),
      async (taskLockLease) =>
        withStoreLock(
          this.layout.worktreeRoot,
          this.layout.repositoryLock,
          async () => {
            const manifest = await this.#readManifestRaw();
            const existing = manifest.artifacts.find(
              (descriptor) =>
                descriptor.artifactType === "task_event_log" &&
                descriptor.taskId === taskId,
            );
            const currentLog = await readTaskEventLog(this.layout, taskId);
            const eventsPath = this.layout.task(taskId).events;
            let previousEventBytes: Buffer | undefined;
            try {
              previousEventBytes = await readManagedFile(
                this.layout.worktreeRoot,
                eventsPath,
              );
            } catch (error) {
              if (
                !(
                  error instanceof ArtifactStoreError &&
                  error.code === "artifact_not_found"
                )
              ) {
                throw error;
              }
            }
            const restoreEventBytes = async (): Promise<void> => {
              let currentEventBytes: Buffer | undefined;
              try {
                currentEventBytes = await readManagedFile(
                  this.layout.worktreeRoot,
                  eventsPath,
                );
              } catch (error) {
                if (
                  !(
                    error instanceof ArtifactStoreError &&
                    error.code === "artifact_not_found"
                  )
                ) {
                  throw error;
                }
              }
              if (
                (previousEventBytes === undefined &&
                  currentEventBytes === undefined) ||
                (previousEventBytes !== undefined &&
                  currentEventBytes !== undefined &&
                  previousEventBytes.equals(currentEventBytes))
              ) {
                return;
              }
              if (previousEventBytes === undefined) {
                await this.#quarantinePath(
                  eventsPath,
                  "uncommitted-event",
                );
              } else {
                await atomicWriteFile(
                  this.layout.worktreeRoot,
                  eventsPath,
                  previousEventBytes,
                );
              }
            };
            const exactReplay = currentLog.events.find(
              (candidate) =>
                candidate.eventId === event.eventId &&
                canonicalizeJson(candidate) === canonicalizeJson(event),
            );
            if (exactReplay !== undefined) {
              const lastEvent = currentLog.events.at(-1);
              const expectedPath = repositoryRelativePathFromAbsolute(
                this.layout.worktreeRoot,
                this.layout.task(taskId).events,
              );
              if (
                existing === undefined ||
                existing.storageFormat !== "jsonl_v1" ||
                (existing.state !== "current" &&
                  existing.state !== "read_only_recovery") ||
                existing.path !== expectedPath ||
                existing.revision !== lastEvent?.revision ||
                existing.contentDigest !== currentLog.contentDigest ||
                existing.sourceSnapshotId !== lastEvent?.sourceSnapshotId
              ) {
                throw new ArtifactStoreError(
                  "manifest_inconsistent",
                  "An exact Event retry found bytes that are not fully committed by the Manifest.",
                  {
                    taskId,
                    eventId: event.eventId,
                    descriptorRevision: existing?.revision,
                    eventRevision: lastEvent?.revision,
                  },
                );
              }
              await this.#verifyTaskDescriptorSet(manifest, taskId);
              await this.#requireStableManifest(manifest);
              if (!this.#isContextlessColdRecovery(manifest, existing)) {
                await this.#requireReadableSourceSnapshot(
                  manifest,
                  existing.sourceSnapshotId!,
                  `Task Event replay ${event.eventId}`,
                );
              }
              try {
                const replay = await appendTaskEventFile(
                  this.layout,
                  taskId,
                  event,
                  {
                    ...options,
                    taskLockLease,
                  },
                );
                if (
                  replay.events.at(-1)?.revision !== existing.revision ||
                  replay.contentDigest !== existing.contentDigest
                ) {
                  throw new ArtifactStoreError(
                    "manifest_inconsistent",
                    "Event replay repair did not reproduce the published descriptor.",
                    { taskId, eventId: event.eventId },
                  );
                }
                return replay;
              } catch (error) {
                try {
                  await restoreEventBytes();
                } catch (rollbackError) {
                  throw new ArtifactStoreError(
                    "artifact_corrupt",
                    "Event replay failed and its prior bytes could not be restored.",
                    { taskId, eventId: event.eventId },
                    { cause: rollbackError },
                  );
                }
                throw error;
              }
            }
            throw new ArtifactStoreError(
              "reference_integrity_failed",
              "Standalone Event publication accepts only exact committed replay or truncated-tail repair. Missing Event history must be restored through an explicit trusted migration.",
              {
                taskId,
                eventId: event.eventId,
                requestedRevision: event.revision,
                committedRevision: existing?.revision,
                logRevision: currentLog.events.at(-1)?.revision,
              },
            );
          },
          this.#lockOptions,
        ),
      this.#lockOptions,
    );
  }

  async readTaskEvents(taskIdInput: string): Promise<ReadTaskEventsResult> {
    const taskId = TaskIdSchema.parse(taskIdInput);
    const parsed = await readTaskEventLog(this.layout, taskId);
    const manifest = await this.#readManifestRaw();
    const descriptor = manifest.artifacts.find(
      (candidate) =>
        candidate.artifactType === "task_event_log" &&
        candidate.taskId === taskId,
    );
    const expectedPath = repositoryRelativePathFromAbsolute(
      this.layout.worktreeRoot,
      this.layout.task(taskId).events,
    );
    const lastEvent = parsed.events.at(-1);
    const sourceSnapshotId = descriptor?.sourceSnapshotId;
    if (
      descriptor === undefined ||
      descriptor.storageFormat !== "jsonl_v1" ||
      (descriptor.state !== "current" &&
        descriptor.state !== "read_only_recovery") ||
      descriptor.freshness === "invalid" ||
      descriptor.path !== expectedPath ||
      sourceSnapshotId === undefined ||
      descriptor.revision !== lastEvent?.revision ||
      descriptor.contentDigest !== parsed.contentDigest ||
      parsed.truncatedTail !== undefined ||
      parsed.events.some(
        (event) =>
          event.repositoryId !== this.repositoryId ||
          event.worktreeId !== this.worktreeId ||
          event.taskId !== taskId,
      ) ||
      (lastEvent?.sourceSnapshotId !== undefined &&
        descriptor.sourceSnapshotId !== lastEvent.sourceSnapshotId)
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "Task Event bytes are not committed by a matching Manifest descriptor.",
        {
          taskId,
          descriptor,
          eventRevision: lastEvent?.revision,
          contentDigest: parsed.contentDigest,
          truncatedTail: parsed.truncatedTail !== undefined,
        },
      );
    }
    if (!this.#isContextlessColdRecovery(manifest, descriptor)) {
      await this.#requireReadableSourceSnapshot(
        manifest,
        sourceSnapshotId,
        `Task Event log ${descriptor.artifactId}`,
      );
    }
    await this.#verifyTaskDescriptorSet(manifest, taskId);
    await this.#requireStableManifest(manifest);
    return {
      ...parsed,
      descriptor,
      state: descriptor.state,
      freshness: descriptor.freshness,
      ...(manifest.latestSnapshotId === undefined
        ? {}
        : { latestSnapshotId: manifest.latestSnapshotId }),
    };
  }

  /**
   * Reads one complete Task revision under a stable Manifest.
   *
   * The operation journal is mandatory for this API because callers must never
   * reconstruct idempotency history or historical mutation results from a
   * collection of individually read files.
   */
  async readTaskBundle(taskIdInput: string): Promise<ReadTaskBundleResult> {
    const taskId = TaskIdSchema.parse(taskIdInput);
    const manifest = await this.#readManifestRaw();
    const descriptors = manifest.artifacts.filter(
      (descriptor) => descriptor.taskId === taskId,
    );
    const taskManifestDescriptor = descriptors.find(
      (descriptor) => descriptor.artifactType === "task_manifest",
    );
    const eventDescriptor = descriptors.find(
      (descriptor) => descriptor.artifactType === "task_event_log",
    );
    const journalDescriptor = descriptors.find(
      (descriptor) => descriptor.artifactType === "task_operation_journal",
    );
    if (
      taskManifestDescriptor === undefined ||
      eventDescriptor === undefined ||
      journalDescriptor === undefined
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "A trusted Task bundle read requires Manifest, Event log, and operation journal descriptors.",
        { taskId },
      );
    }

    await this.#verifyTaskDescriptorSet(manifest, taskId);
    const taskArtifactTypes = new Set<ArtifactTypeV1>([
      "task_manifest",
      "task_brief",
      "claim_ledger",
      "evidence_ledger",
      "impact",
      "task_operation_journal",
      "change_check",
      "verification",
    ]);
    const artifacts: PersistedArtifactV1[] = [];
    for (const descriptor of descriptors) {
      const parsedType = ArtifactTypeV1Schema.safeParse(
        descriptor.artifactType,
      );
      if (
        !parsedType.success ||
        !taskArtifactTypes.has(parsedType.data)
      ) {
        continue;
      }
      const targetPath = this.layout.artifact(parsedType.data, { taskId });
      const artifact = await this.#readArtifactPath(targetPath);
      await this.#requirePublishedDescriptor(
        artifact,
        targetPath,
        manifest,
      );
      await this.#requireArtifactSourceSnapshot(
        manifest,
        descriptor,
        artifact,
        `Task bundle ${taskId}`,
      );
      artifacts.push(artifact);
    }

    const journal = artifacts.find(
      (artifact) => artifact.artifactType === "task_operation_journal",
    );
    if (journal?.artifactType !== "task_operation_journal") {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "The published Task operation journal could not be read.",
        { taskId },
      );
    }
    const events = await readTaskEventLog(this.layout, taskId);
    if (
      events.truncatedTail !== undefined ||
      events.contentDigest !== eventDescriptor.contentDigest ||
      events.events.at(-1)?.revision !== eventDescriptor.revision
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "Task Event bytes do not match the stable Task descriptor set.",
        { taskId },
      );
    }
    const prepared = this.#prepareTaskBundle({
      artifacts,
      events: events.events,
      idempotencyRecords: journal.payload.idempotencyRecords,
    });
    await this.#requireStableManifest(manifest);
    return {
      bundle: prepared.bundle,
      artifacts: prepared.artifacts,
      receipts: journal.payload.receipts,
      state: taskManifestDescriptor.state,
      freshness: taskManifestDescriptor.freshness,
      ...(manifest.latestSnapshotId === undefined
        ? {}
        : { latestSnapshotId: manifest.latestSnapshotId }),
      recoveryState:
        taskManifestDescriptor.state === "read_only_recovery"
          ? "read_only_recovery"
          : "current",
    };
  }

  async lookupTaskOperationReceipt(
    taskIdInput: string,
    scope: IdempotencyScopeV1,
    idempotencyKeyInput: string,
  ): Promise<TaskOperationReceiptLookupResult | undefined> {
    const taskId = TaskIdSchema.parse(taskIdInput);
    const idempotencyKey = IdempotencyKeySchema.parse(idempotencyKeyInput);
    const trustedScope = IdempotencyScopeV1Schema.parse(scope);
    const read = await this.readTaskBundle(taskId);
    const record = read.bundle.idempotencyRecords.find((candidate) => {
      if (candidate.idempotencyKey !== idempotencyKey) return false;
      if (candidate.scope.kind !== trustedScope.kind) return false;
      return candidate.scope.kind === "task"
        ? trustedScope.kind === "task" &&
            candidate.scope.taskId === trustedScope.taskId
        : trustedScope.kind === "task_create" &&
            candidate.scope.createScope === trustedScope.createScope;
    });
    if (record === undefined) return undefined;
    const receipt = read.receipts.find(
      (candidate) => candidate.eventId === record.eventId,
    );
    if (receipt === undefined) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "A committed idempotency record has no matching operation receipt.",
        { taskId, eventId: record.eventId },
      );
    }
    return { record, receipt };
  }

  parseTrustedTaskBundle(input: unknown): TaskArtifactBundleV1 {
    return parseTrustedTaskBundle(input);
  }

  #prepareTaskBundle(
    input: PersistTaskBundleInput,
  ): PreparedTaskBundle {
    const artifacts = input.artifacts.map((artifact) =>
      this.#parseTrustedArtifact(artifact),
    );
    const byType = new Map<ArtifactTypeV1, PersistedArtifactV1>();
    for (const artifact of artifacts) {
      if (artifact.taskId === undefined) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "A Task transaction cannot include repository-scoped Artifacts.",
          { artifactType: artifact.artifactType },
        );
      }
      if (byType.has(artifact.artifactType)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Task transaction contains duplicate ${artifact.artifactType} Artifacts.`,
        );
      }
      byType.set(artifact.artifactType, artifact);
    }

    const taskManifestArtifact = byType.get("task_manifest");
    if (taskManifestArtifact === undefined) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Task transaction requires one task_manifest Artifact.",
      );
    }
    if (taskManifestArtifact.artifactType !== "task_manifest") {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Task transaction manifest lookup resolved an invalid Artifact type.",
      );
    }
    const taskId = taskManifestArtifact.taskId;
    if (taskId === undefined) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Task Manifest Artifact requires taskId.",
      );
    }
    const revision = taskManifestArtifact.revision;
    for (const artifact of artifacts) {
      if (
        artifact.taskId !== taskId ||
        artifact.repositoryId !== taskManifestArtifact.repositoryId ||
        artifact.worktreeId !== taskManifestArtifact.worktreeId ||
        artifact.sourceSnapshotId !==
          taskManifestArtifact.payload.latestSnapshotId ||
        artifact.revision !== revision
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "Every Artifact in a Task transaction must share Task identity, latest Snapshot, and revision.",
          { artifactId: artifact.artifactId },
        );
      }
    }

    const contextualRequiredTypes = [
      "task_manifest",
      "task_brief",
      "claim_ledger",
      "evidence_ledger",
      "impact",
    ] as const satisfies readonly ArtifactTypeV1[];
    const contextualAllowedTypes = new Set<ArtifactTypeV1>([
      ...contextualRequiredTypes,
      "task_operation_journal",
      "change_check",
      "verification",
    ]);
    const contextlessAllowedTypes = new Set<ArtifactTypeV1>([
      "task_manifest",
      "task_operation_journal",
    ]);
    const hasContext = byType.has("task_brief");
    if (
      (hasContext &&
        (contextualRequiredTypes.some((type) => !byType.has(type)) ||
          [...byType.keys()].some(
            (type) => !contextualAllowedTypes.has(type),
          ))) ||
      (!hasContext &&
        [...byType.keys()].some(
          (type) => !contextlessAllowedTypes.has(type),
        ))
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        hasContext
          ? "A contextual Task transaction requires Task Manifest, Brief, Claim, Evidence, and Impact Artifacts; Check and Verification remain lifecycle-optional."
          : "A contextless Task transaction may contain only Task Manifest and its optional operation journal.",
      );
    }
    if (byType.has("verification") && !byType.has("change_check")) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "A Verification Artifact requires a Change Check Artifact in the same Task revision.",
      );
    }

    const payload = (type: ArtifactTypeV1): unknown => {
      const artifact = byType.get(type);
      if (artifact === undefined) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Task transaction is missing ${type}.`,
        );
      }
      return artifact.payload;
    };
    const journalArtifact = byType.get("task_operation_journal");
    const journalPayload =
      journalArtifact?.artifactType === "task_operation_journal"
        ? journalArtifact.payload
        : undefined;
    if (
      journalPayload !== undefined &&
      canonicalizeJson(journalPayload.idempotencyRecords) !==
        canonicalizeJson(input.idempotencyRecords)
    ) {
      throw new ArtifactStoreError(
        "idempotency_conflict",
        "The Task operation journal must persist the complete trusted idempotency ledger.",
        { taskId },
      );
    }
    if (journalPayload !== undefined) {
      const eventIds = input.events.map((event) => event.eventId);
      if (
        canonicalizeJson(
          journalPayload.idempotencyRecords.map(
            (record) => record.eventId,
          ),
        ) !== canonicalizeJson(eventIds) ||
        canonicalizeJson(
          journalPayload.receipts.map((receipt) => receipt.eventId),
        ) !== canonicalizeJson(eventIds)
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "Operation Journal Records and Receipts must preserve exact Task Event order.",
          { taskId },
        );
      }
      const events = new Map(
        input.events.map((event) => [event.eventId, event]),
      );
      const records = new Map(
        journalPayload.idempotencyRecords.map((record) => [
          record.eventId,
          record,
        ]),
      );
      for (const receipt of journalPayload.receipts) {
        const integrity = verifyTaskOperationReceiptV1(
          receipt,
          sha256CanonicalJson,
        );
        if (!integrity.valid) {
          throw new ArtifactStoreError(
            "artifact_corrupt",
            "A Task operation receipt result digest is invalid.",
            {
              taskId,
              eventId: receipt.eventId,
              expectedDigest: integrity.expectedDigest,
              actualDigest: integrity.actualDigest,
            },
          );
        }
        const event = events.get(receipt.eventId);
        const record = records.get(receipt.eventId);
        const eventIssue =
          event === undefined
            ? "operation receipt references an Event outside the trusted Task history"
            : taskOperationReceiptEventIssue(receipt, event);
        const recordIssue =
          record === undefined
            ? "operation receipt has no matching idempotency record"
            : event === undefined
              ? undefined
              : taskIdempotencyRecordEventIssue(record, event);
        const expectsCreateScope =
          receipt.operation === "task_created" ||
          receipt.operation === "build_task_brief";
        const scopeIssue =
          record === undefined ||
          (expectsCreateScope
            ? record.scope.kind !== "task_create"
            : record.scope.kind !== "task");
        let taskResultIssue: string | undefined;
        let projectionIssue: string | undefined;
        if (
          receipt.operation === "task_created" ||
          receipt.operation === "build_task_brief" ||
          receipt.operation === "update_task"
        ) {
          const resultTask = receipt.result.task;
          const persistedTask = taskManifestArtifact.payload;
          if (
            resultTask.title !== persistedTask.title ||
            resultTask.originalIntent !== persistedTask.originalIntent ||
            resultTask.createdAt !== persistedTask.createdAt ||
            resultTask.producerVersion !== persistedTask.producerVersion
          ) {
            taskResultIssue =
              "operation receipt changed immutable Task identity fields";
          } else if (
            resultTask.revision === revision &&
            canonicalizeJson(resultTask) !== canonicalizeJson(persistedTask)
          ) {
            taskResultIssue =
              "latest operation receipt Task result must equal the committed Task Manifest";
          }
        }
        // Only the receipt committing this candidate revision can bind the
        // current projection. Older receipts remain immutable Journal facts,
        // while their contextual projections may be evolved or resolved by
        // later authorized Events.
        if (event?.revision === revision) {
          switch (receipt.operation) {
            case "build_task_brief": {
              const briefArtifact = byType.get("task_brief");
              const claimArtifact = byType.get("claim_ledger");
              const evidenceArtifact = byType.get("evidence_ledger");
              if (
                briefArtifact?.artifactType !== "task_brief" ||
                claimArtifact?.artifactType !== "claim_ledger" ||
                evidenceArtifact?.artifactType !== "evidence_ledger" ||
                canonicalizeJson(receipt.result.brief) !==
                  canonicalizeJson(briefArtifact.payload) ||
                canonicalizeJson(receipt.result.claimIds) !==
                  canonicalizeJson(
                    claimArtifact.payload.claims.map((claim) => claim.id),
                  ) ||
                canonicalizeJson(receipt.result.evidenceIds) !==
                  canonicalizeJson(
                    evidenceArtifact.payload.evidence.map(
                      (evidence) => evidence.id,
                    ),
                  )
              ) {
                projectionIssue =
                  "latest build_task_brief receipt must exactly identify the committed Brief, Claims, and Evidence";
              }
              break;
            }
            case "check_change": {
              const checkArtifact = byType.get("change_check");
              if (
                checkArtifact?.artifactType !== "change_check" ||
                canonicalizeJson(receipt.result.changeCheck) !==
                  canonicalizeJson(checkArtifact.payload)
              ) {
                projectionIssue =
                  "latest check_change receipt must equal the committed Change Check";
              }
              break;
            }
            case "record_verification": {
              const verificationArtifact = byType.get("verification");
              if (
                verificationArtifact?.artifactType !== "verification" ||
                !verificationArtifact.payload.records.some(
                  (verification) =>
                    verification.id === receipt.result.verification.id &&
                    canonicalizeJson(verification) ===
                      canonicalizeJson(receipt.result.verification),
                )
              ) {
                projectionIssue =
                  "latest record_verification receipt must equal one complete committed Verification record";
              }
              break;
            }
            case "task_created":
            case "update_task":
              break;
          }
        }
        if (
          eventIssue !== undefined ||
          recordIssue !== undefined ||
          scopeIssue ||
          taskResultIssue !== undefined ||
          projectionIssue !== undefined
        ) {
          throw new ArtifactStoreError(
            "reference_integrity_failed",
            eventIssue ??
              recordIssue ??
              taskResultIssue ??
              projectionIssue ??
              "operation receipt type does not match its idempotency scope",
            {
              taskId,
              eventId: receipt.eventId,
              operation: receipt.operation,
            },
          );
        }
      }
      const historyIssue = taskOperationHistoryIssue(
        journalPayload.receipts,
        input.events,
        taskManifestArtifact.payload,
      );
      if (historyIssue !== undefined) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          historyIssue,
          { taskId },
        );
      }
    }
    const candidate: unknown = hasContext
      ? {
          manifest: payload("task_manifest"),
          brief: payload("task_brief"),
          claims: (payload("claim_ledger") as { claims?: unknown }).claims,
          evidence: (payload("evidence_ledger") as { evidence?: unknown })
            .evidence,
          impactPaths: (payload("impact") as { paths?: unknown }).paths,
          ...((payload("impact") as { conclusion?: unknown }).conclusion === undefined
            ? {}
            : {
                impactConclusion: (payload("impact") as { conclusion: unknown })
                  .conclusion,
              }),
          changeChecks: byType.has("change_check")
            ? [payload("change_check")]
            : [],
          verificationRecords: byType.has("verification")
            ? (payload("verification") as { records?: unknown }).records
            : [],
          events: [...input.events],
          idempotencyRecords: [...input.idempotencyRecords],
        }
      : {
          manifest: payload("task_manifest"),
          events: [...input.events],
          idempotencyRecords: [...input.idempotencyRecords],
        };
    const bundle = this.parseTrustedTaskBundle(candidate);
    return {
      bundle,
      artifacts,
      taskId,
      revision,
      contextual: hasContext,
    };
  }

  async #verifyPublishedTaskBundle(
    prepared: PreparedTaskBundle,
  ): Promise<boolean> {
    try {
      const manifest = await this.#readManifestRaw();
      let taskManifestArtifact: PersistedArtifactV1 | undefined;
      let taskManifestDescriptor:
        | ReturnType<typeof ArtifactDescriptorV1Schema.parse>
        | undefined;
      for (const expected of prepared.artifacts) {
        const actual = await this.#readArtifactPath(
          this.#artifactPath(expected),
        );
        const descriptor = await this.#requirePublishedDescriptor(
          actual,
          this.#artifactPath(expected),
          manifest,
        );
        if (!compareArtifacts(actual, expected)) return false;
        if (actual.artifactType === "task_manifest") {
          taskManifestArtifact = actual;
          taskManifestDescriptor = descriptor;
        }
      }
      const eventLog = await readTaskEventLog(
        this.layout,
        prepared.taskId,
      );
      if (
        eventLog.truncatedTail !== undefined ||
        canonicalizeJson(eventLog.events) !==
          canonicalizeJson(prepared.bundle.events)
      ) {
        return false;
      }
      const eventDescriptor = manifest.artifacts.find(
        (descriptor) =>
          descriptor.artifactType === "task_event_log" &&
          descriptor.taskId === prepared.taskId,
      );
      const published =
        eventDescriptor?.revision === prepared.revision &&
        eventDescriptor.contentDigest === eventLog.contentDigest;
      if (
        !published ||
        taskManifestArtifact === undefined ||
        taskManifestDescriptor === undefined
      ) {
        return false;
      }
      await this.#requireArtifactSourceSnapshot(
        manifest,
        taskManifestDescriptor,
        taskManifestArtifact,
        `Task transaction ${prepared.taskId}`,
      );
      await this.#verifyTaskDescriptorSet(
        manifest,
        prepared.taskId,
      );
      await this.#requireStableManifest(manifest);
      return true;
    } catch (error) {
      if (
        error instanceof ArtifactStoreError &&
        error.code === "reference_integrity_failed"
      ) {
        throw error;
      }
      return false;
    }
  }

  async #nextTaskBundleManifest(
    current: ArtifactManifestV1,
    prepared: PreparedTaskBundle,
    serializedEvents: string,
    options: PersistTaskBundleOptions,
  ): Promise<ArtifactManifestV1> {
    const freshness = await this.#taskBundleFreshness(current, prepared);
    const artifactByType = new Map(
      prepared.artifacts.map((artifact) => [
        artifact.artifactType,
        artifact,
      ]),
    );
    const taskManifestArtifact = artifactByType.get("task_manifest");
    if (taskManifestArtifact === undefined) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Prepared Task bundle lost its Task Manifest.",
      );
    }
    const snapshotDescriptor = current.artifacts.find(
      (descriptor) =>
        descriptor.artifactType === "repository_snapshot" &&
        descriptor.sourceSnapshotId ===
          prepared.bundle.manifest.latestSnapshotId &&
        (descriptor.state === "current" ||
          descriptor.state === "read_only_recovery"),
    );
    const repoPulseDescriptor = current.artifacts.find(
      (descriptor) =>
        descriptor.artifactType === "repo_pulse" &&
        descriptor.sourceSnapshotId ===
          prepared.bundle.manifest.latestSnapshotId &&
        descriptor.state === "current" &&
        (descriptor.freshness === "fresh" ||
          descriptor.freshness === "partial"),
    );
    const requirePrepared = (
      artifactType: ArtifactTypeV1,
    ): ArtifactDependencyV1 => {
      const artifact = artifactByType.get(artifactType);
      if (artifact === undefined) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Task dependency target is missing: ${artifactType}.`,
        );
      }
      return this.#requiredArtifactDependency(artifact);
    };
    const repositoryDependencies: ArtifactDependencyV1[] = [];
    if (snapshotDescriptor !== undefined) {
      repositoryDependencies.push(
        this.#requiredDependency(snapshotDescriptor),
      );
    }
    if (repoPulseDescriptor !== undefined) {
      repositoryDependencies.push(
        this.#requiredDependency(repoPulseDescriptor),
      );
    }
    const canonicalDependencies = (
      artifactType: ArtifactTypeV1,
    ): ArtifactDependencyV1[] => {
      switch (artifactType) {
        case "task_manifest":
          return repositoryDependencies;
        case "claim_ledger":
          return [requirePrepared("task_manifest")];
        case "evidence_ledger":
          return [
            requirePrepared("task_manifest"),
            requirePrepared("claim_ledger"),
          ];
        case "impact":
          return [
            requirePrepared("claim_ledger"),
            requirePrepared("evidence_ledger"),
          ];
        case "task_operation_journal":
          return [requirePrepared("task_manifest")];
        case "task_brief":
          return [
            requirePrepared("task_manifest"),
            requirePrepared("claim_ledger"),
            requirePrepared("evidence_ledger"),
            requirePrepared("impact"),
          ];
        case "change_check":
          return [
            requirePrepared("task_brief"),
            requirePrepared("evidence_ledger"),
            requirePrepared("impact"),
          ];
        case "verification":
          return [
            requirePrepared("change_check"),
            requirePrepared("claim_ledger"),
          ];
        default:
          return [];
      }
    };
    const descriptors = await Promise.all(
      prepared.artifacts.map((artifact) =>
        this.#descriptorForArtifact(artifact, {
          state: "current",
          freshness,
          dependencies: this.#mergeRequiredDependencies(
            canonicalDependencies(artifact.artifactType),
            options.dependenciesByArtifactId?.[artifact.artifactId],
          ),
        }),
      ),
    );
    const existingEventDescriptor = current.artifacts.find(
      (descriptor) =>
        descriptor.artifactType === "task_event_log" &&
        descriptor.taskId === prepared.taskId,
    );
    const eventDescriptor = ArtifactDescriptorV1Schema.parse({
      descriptorVersion: 1,
      artifactId:
        existingEventDescriptor?.artifactId ??
        `artifact:task-events:${prepared.taskId}`,
      artifactType: "task_event_log",
      storageFormat: "jsonl_v1",
      path: repositoryRelativePathFromAbsolute(
        this.layout.worktreeRoot,
        this.layout.task(prepared.taskId).events,
      ),
      schemaVersion: 1,
      producerVersion: this.producerVersion,
      sourceSnapshotId: prepared.bundle.manifest.latestSnapshotId,
      taskId: prepared.taskId,
      revision: prepared.revision,
      contentDigest: sha256Bytes(serializedEvents),
      state: "current",
      freshness,
      generatedAt:
        prepared.bundle.events.at(-1)?.occurredAt ?? this.#now(),
      dependencies: this.#mergeRequiredDependencies(
        [this.#requiredArtifactDependency(taskManifestArtifact)],
        options.dependenciesByArtifactId?.[
          existingEventDescriptor?.artifactId ??
            `artifact:task-events:${prepared.taskId}`
        ],
      ),
    });
    return ArtifactManifestV1Schema.parse({
      ...current,
      updatedAt: this.#now(),
      artifacts: [
        ...current.artifacts.filter(
          (descriptor) => descriptor.taskId !== prepared.taskId,
        ),
        ...descriptors,
        eventDescriptor,
      ],
    });
  }

  /**
   * Persists one semantically complete Task revision.
   *
   * Contracts validates every Claim/Evidence/Finding/Verification backlink and
   * the trusted Event digest chain before any bytes are written. A durable
   * whole-task marker records the previously published bytes before canonical
   * files are replaced. The Manifest switch is the sole commit point, so
   * startup recovery can preserve or roll back the complete descriptor set.
   */
  async persistTaskBundle(
    input: PersistTaskBundleInput,
    options: PersistTaskBundleOptions,
  ): Promise<PersistTaskBundleResult> {
    const prepared = this.#prepareTaskBundle(input);
    const hasOperationJournal = prepared.artifacts.some(
      (artifact) => artifact.artifactType === "task_operation_journal",
    );
    const expectedRevision = options.expectedRevision;
    const validHistoryImport =
      options.historyImport === true &&
      expectedRevision === 0 &&
      prepared.bundle.events.length === prepared.revision &&
      prepared.bundle.events.every(
        (event, index) => event.revision === index + 1,
      );
    if (!hasOperationJournal && !validHistoryImport) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Live Task transactions require a complete operation journal; journal-less bundles are accepted only through a validated legacy history import into an empty Task.",
        { taskId: prepared.taskId },
      );
    }
    if (options.historyImport === true && !validHistoryImport) {
      throw new ArtifactStoreError(
        "revision_conflict",
        "historyImport is valid only for contiguous revision-1..N history with expectedRevision 0.",
        { expectedRevision, bundleRevision: prepared.revision },
      );
    }
    if (
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      (prepared.revision !== expectedRevision + 1 && !validHistoryImport)
    ) {
      throw new ArtifactStoreError(
        "revision_conflict",
        "Task bundle revision must advance exactly once beyond expectedRevision.",
        { expectedRevision, bundleRevision: prepared.revision },
      );
    }
    const requestedIdempotency = {
      key: IdempotencyKeySchema.parse(options.idempotencyKey),
      requestDigest: ContentDigestSchema.parse(options.requestDigest),
    };
    const matchingControlRecord = prepared.bundle.idempotencyRecords.find(
      (record) =>
        record.idempotencyKey === requestedIdempotency.key &&
        record.requestDigest === requestedIdempotency.requestDigest &&
        record.resultRevision === prepared.revision,
    );
    if (matchingControlRecord === undefined) {
      throw new ArtifactStoreError(
        "idempotency_conflict",
        "Task transaction control must match a trusted bundle idempotency record.",
        { idempotencyKey: requestedIdempotency.key },
      );
    }
    const idempotency: StoreIdempotencyControl = {
      ...requestedIdempotency,
      scope: matchingControlRecord.scope,
      actor: matchingControlRecord.actor,
    };

    await ensureManagedDirectory(
      this.layout.worktreeRoot,
      `.understand-code/tasks/${prepared.taskId}`,
    );
    await ensureManagedDirectory(
      this.layout.worktreeRoot,
      ".understand-code/.recovery/task-transactions",
    );
    return withStoreLock(
      this.layout.worktreeRoot,
      this.layout.taskLock(prepared.taskId),
      async () =>
        withStoreLock(
          this.layout.worktreeRoot,
          this.layout.repositoryLock,
          async () => {
        await this.#recoverPendingTaskTransactions();
        const idempotencyPath = this.#idempotencyPath(prepared.taskId);
        const index = await this.#readIdempotencyIndex(idempotencyPath);
        const identity = storeIdempotencyIdentity(idempotency);
        const recorded = index.records.find(
          (record) => storeIdempotencyIdentity(record) === identity,
        );
        if (recorded !== undefined) {
          if (
            recorded.requestDigest !== idempotency.requestDigest ||
            recorded.actor !== idempotency.actor ||
            recorded.resultRevision !== prepared.revision ||
            recorded.resultDigest !==
              prepared.artifacts.find(
                (artifact) => artifact.artifactType === "task_manifest",
              )?.contentDigest
          ) {
            throw new ArtifactStoreError(
              "idempotency_conflict",
              "Task transaction idempotency key was used for another result.",
              { idempotencyKey: idempotency.key },
            );
          }
          if (!(await this.#verifyPublishedTaskBundle(prepared))) {
            throw new ArtifactStoreError(
              "manifest_inconsistent",
              "Recorded Task transaction is not fully published.",
              { taskId: prepared.taskId },
            );
          }
          return {
            bundle: prepared.bundle,
            artifacts: prepared.artifacts,
            replayed: true,
          };
        }

        const currentManifest = await this.#readManifestRaw();
        await this.#taskBundleFreshness(currentManifest, prepared);
        const currentTaskDescriptor = currentManifest.artifacts.find(
          (descriptor) =>
            descriptor.artifactType === "task_manifest" &&
            descriptor.taskId === prepared.taskId,
        );
        const currentRevision = currentTaskDescriptor?.revision ?? 0;
        if (
          currentTaskDescriptor?.state === "read_only_recovery" &&
          options.promoteRecovery !== true
        ) {
          throw new ArtifactStoreError(
            "revision_conflict",
            "Recovered Task state is read-only until explicitly promoted.",
            { taskId: prepared.taskId },
          );
        }

        if (
          currentRevision > 0 &&
          currentRevision === expectedRevision
        ) {
          const currentTaskPath = this.layout.artifact(
            "task_manifest",
            { taskId: prepared.taskId },
          );
          const currentTask = await this.#readArtifactPath(
            currentTaskPath,
          );
          const candidateTask = prepared.artifacts.find(
            (artifact) => artifact.artifactType === "task_manifest",
          );
          const appendedEvent = prepared.bundle.events.at(-1);
          if (
            currentTask.artifactType !== "task_manifest" ||
            candidateTask?.artifactType !== "task_manifest" ||
            appendedEvent === undefined
          ) {
            throw new ArtifactStoreError(
              "manifest_inconsistent",
              "A live Task mutation requires current and candidate Task Manifests plus one appended Event.",
              { taskId: prepared.taskId },
            );
          }
          await this.#requirePublishedDescriptor(
            currentTask,
            currentTaskPath,
            currentManifest,
          );
          const transitionIssue = taskManifestTransitionIssue(
            currentTask.payload,
            candidateTask.payload,
            appendedEvent,
          );
          if (transitionIssue !== undefined) {
            throw new ArtifactStoreError(
              "reference_integrity_failed",
              transitionIssue,
              {
                taskId: prepared.taskId,
                currentRevision,
                action: appendedEvent.action.type,
              },
            );
          }
          await this.#assertTaskPayloadMutationPolicy(
            currentManifest,
            prepared,
            currentTask.payload,
            appendedEvent,
          );
          const currentJournalDescriptor = currentManifest.artifacts.find(
            (descriptor) =>
              descriptor.artifactType === "task_operation_journal" &&
              descriptor.taskId === prepared.taskId,
          );
          const candidateJournal = prepared.artifacts.find(
            (artifact) =>
              artifact.artifactType === "task_operation_journal",
          );
          if (
            currentJournalDescriptor === undefined ||
            candidateJournal?.artifactType !== "task_operation_journal"
          ) {
            throw new ArtifactStoreError(
              "reference_integrity_failed",
              "A live Task mutation requires the previously committed operation Journal and its append-only successor.",
              { taskId: prepared.taskId, currentRevision },
            );
          }
          const currentJournalPath = this.layout.artifact(
            "task_operation_journal",
            { taskId: prepared.taskId },
          );
          const currentJournal = await this.#readArtifactPath(
            currentJournalPath,
          );
          if (currentJournal.artifactType !== "task_operation_journal") {
            throw new ArtifactStoreError(
              "manifest_inconsistent",
              "The current operation Journal path resolved another Artifact type.",
              { taskId: prepared.taskId },
            );
          }
          await this.#requirePublishedDescriptor(
            currentJournal,
            currentJournalPath,
            currentManifest,
          );
          const currentRecords =
            currentJournal.payload.idempotencyRecords;
          const currentReceipts = currentJournal.payload.receipts;
          const candidateRecords =
            candidateJournal.payload.idempotencyRecords;
          const candidateReceipts = candidateJournal.payload.receipts;
          if (
            candidateRecords.length !== currentRecords.length + 1 ||
            candidateReceipts.length !== currentReceipts.length + 1 ||
            canonicalizeJson(
              candidateRecords.slice(0, currentRecords.length),
            ) !== canonicalizeJson(currentRecords) ||
            canonicalizeJson(
              candidateReceipts.slice(0, currentReceipts.length),
            ) !== canonicalizeJson(currentReceipts)
          ) {
            throw new ArtifactStoreError(
              "reference_integrity_failed",
              "A live Task mutation must append exactly one Record and Receipt without rewriting trusted Journal history.",
              { taskId: prepared.taskId, currentRevision },
            );
          }
        }

        if (
          currentRevision === prepared.revision &&
          (await this.#verifyPublishedTaskBundle(prepared))
        ) {
          const taskManifestArtifact = prepared.artifacts.find(
            (artifact) => artifact.artifactType === "task_manifest",
          );
          if (taskManifestArtifact === undefined) {
            throw new ArtifactStoreError(
              "reference_integrity_failed",
              "Prepared Task bundle lost its Task Manifest.",
            );
          }
          await this.#recordIdempotency(
            idempotencyPath,
            index,
            taskManifestArtifact,
            idempotency,
          );
          return {
            bundle: prepared.bundle,
            artifacts: prepared.artifacts,
            replayed: true,
          };
        }
        if (currentRevision !== expectedRevision) {
          throw new ArtifactStoreError(
            "revision_conflict",
            "Task bundle compare-and-swap revision does not match the published Manifest.",
            {
              expectedRevision,
              currentRevision,
              bundleRevision: prepared.revision,
            },
          );
        }

        const desiredEvents = prepared.bundle.events;
        const desiredPrefix = desiredEvents.filter(
          (event) => event.revision <= expectedRevision,
        );
        let currentEvents: ParsedTaskEventLog;
        try {
          currentEvents = await readTaskEventLog(
            this.layout,
            prepared.taskId,
          );
        } catch (error) {
          throw new ArtifactStoreError(
            "artifact_corrupt",
            "Current Task Event log cannot participate in a Task transaction.",
            { taskId: prepared.taskId },
            { cause: error },
          );
        }
        if (currentEvents.truncatedTail !== undefined) {
          throw new ArtifactStoreError(
            "artifact_corrupt",
            "Task Event log has an uncommitted tail; recover it before mutation.",
            { taskId: prepared.taskId },
          );
        }
        const currentMatchesPrefix =
          canonicalizeJson(currentEvents.events) ===
          canonicalizeJson(desiredPrefix);
        const currentMatchesDesired =
          canonicalizeJson(currentEvents.events) ===
          canonicalizeJson(desiredEvents);
        if (
          (expectedRevision === 0 &&
            currentEvents.events.length > 0 &&
            !currentMatchesDesired) ||
          (expectedRevision > 0 &&
            !currentMatchesPrefix &&
            !currentMatchesDesired)
        ) {
          throw new ArtifactStoreError(
            "revision_conflict",
            "Task Event log is not the expected committed prefix or an identical interrupted retry.",
            { taskId: prepared.taskId, expectedRevision },
          );
        }

        const serializedEvents = `${desiredEvents
          .map((event) => canonicalizeJson(event))
          .join("\n")}\n`;
        const writes = [
          ...prepared.artifacts.map((artifact) => ({
            path: this.#artifactPath(artifact),
            content: `${canonicalizeJson(artifact)}\n`,
          })),
          {
            path: this.layout.task(prepared.taskId).events,
            content: serializedEvents,
          },
        ] satisfies TaskBundleWrite[];
        const nextManifest = await this.#nextTaskBundleManifest(
          currentManifest,
          prepared,
          serializedEvents,
          options,
        );
        const targetDescriptors = nextManifest.artifacts.filter(
          (descriptor) => descriptor.taskId === prepared.taskId,
        );
        const writePaths = new Set(
          writes.map((write) =>
            repositoryRelativePathFromAbsolute(
              this.layout.worktreeRoot,
              write.path,
            ),
          ),
        );
        if (
          targetDescriptors.length !== writePaths.size ||
          targetDescriptors.some(
            (descriptor) => !writePaths.has(descriptor.path),
          )
        ) {
          throw new ArtifactStoreError(
            "manifest_inconsistent",
            "Task transaction target descriptors do not match its complete canonical write set.",
            { taskId: prepared.taskId },
          );
        }
        const previousManifestBytes = await readManagedFile(
          this.layout.worktreeRoot,
          this.layout.manifest,
        );
        await this.#writeBackup(
          this.layout.manifest,
          previousManifestBytes,
        );
        const publishedOldPaths = new Set(
          currentManifest.artifacts
            .filter(
              (descriptor) => descriptor.taskId === prepared.taskId,
            )
            .map((descriptor) => descriptor.path),
        );
        const oldFiles: TaskTransactionFileBackupV1[] = [];
        for (const write of writes) {
          const relativePath = repositoryRelativePathFromAbsolute(
            this.layout.worktreeRoot,
            write.path,
          );
          if (publishedOldPaths.has(relativePath)) {
            const previous = await readManagedFile(
              this.layout.worktreeRoot,
              write.path,
            );
            await this.#writeBackup(write.path, previous);
            oldFiles.push({
              relativePath,
              existed: true,
              ...taskTransactionBytes(previous),
            });
          } else {
            oldFiles.push({ relativePath, existed: false });
          }
        }

        const markerPath = this.layout.taskTransactionMarker(
          prepared.taskId,
        );
        const marker: PendingTaskTransactionMarkerV1 = {
          version: 1,
          repositoryId: this.repositoryId,
          worktreeId: this.worktreeId,
          taskId: prepared.taskId,
          expectedRevision,
          targetRevision: prepared.revision,
          createdAt: this.#now(),
          oldManifest: taskTransactionBytes(previousManifestBytes),
          oldFiles,
          targetDescriptors,
        };
        let markerCreated = false;
        let manifestCommitted = false;
        let manifestCommitAmbiguous = false;
        try {
          try {
            await atomicWriteJson(
              this.layout.worktreeRoot,
              markerPath,
              marker,
            );
            markerCreated = true;
          } catch (error) {
            if (isCommittedAtomicWriteError(error, markerPath)) {
              markerCreated = true;
            }
            throw error;
          }
          for (const write of writes) {
            await atomicWriteFile(
              this.layout.worktreeRoot,
              write.path,
              write.content,
              options.artifactWrite,
            );
          }
          try {
            await atomicWriteJson(
              this.layout.worktreeRoot,
              this.layout.manifest,
              nextManifest,
              options.manifestWrite,
            );
            manifestCommitted = true;
          } catch (error) {
            if (isCommittedAtomicWriteError(error, this.layout.manifest)) {
              if (
                isDurablyCommittedAtomicWriteError(
                  error,
                  this.layout.manifest,
                )
              ) {
                manifestCommitted = true;
              } else {
                manifestCommitAmbiguous = true;
              }
            }
            throw error;
          }
          const taskManifestArtifact = prepared.artifacts.find(
            (artifact) => artifact.artifactType === "task_manifest",
          );
          if (taskManifestArtifact === undefined) {
            throw new ArtifactStoreError(
              "reference_integrity_failed",
              "Prepared Task bundle lost its Task Manifest.",
            );
          }
          await this.#recordIdempotency(
            idempotencyPath,
            index,
            taskManifestArtifact,
            idempotency,
          );
          await this.#durablyUnlinkManagedFile(markerPath);
          markerCreated = false;
          return {
            bundle: prepared.bundle,
            artifacts: prepared.artifacts,
            replayed: false,
          };
        } catch (error) {
          if (isCommittedAtomicWriteError(error, this.layout.manifest)) {
            if (
              isDurablyCommittedAtomicWriteError(
                error,
                this.layout.manifest,
              )
            ) {
              manifestCommitted = true;
            } else {
              manifestCommitAmbiguous = true;
            }
          }
          if (markerCreated) {
            if (manifestCommitted) {
              await this.#durablyUnlinkManagedFile(markerPath).catch(
                () => undefined,
              );
            } else if (!manifestCommitAmbiguous) {
              try {
                await this.#rollbackPendingTaskTransaction(marker);
                await this.#durablyUnlinkManagedFile(markerPath);
              } catch (rollbackError) {
                throw new ArtifactStoreError(
                  "artifact_corrupt",
                  "Task transaction failed and its durable whole-task rollback did not complete.",
                  { taskId: prepared.taskId, targetRevision: prepared.revision },
                  { cause: rollbackError },
                );
              }
            }
          }
          throw error;
        }
          },
          this.#lockOptions,
        ),
      this.#lockOptions,
    );
  }

  async migrateJson(
    options: MigrationExecutionOptions,
  ): Promise<MigrationExecutionResult> {
    const targetPath = await resolveManagedPath(
      this.layout.worktreeRoot,
      options.relativePath,
    );
    const targetRelative = repositoryRelativePathFromAbsolute(
      this.layout.worktreeRoot,
      targetPath,
    );
    return withStoreLock(
      this.layout.worktreeRoot,
      this.layout.repositoryLock,
      async () => {
        await this.#recoverPendingTaskTransactions();
        const manifest = await this.#readManifestRaw();
        const publishedDescriptor = manifest.artifacts.find(
          (descriptor) => descriptor.path === targetRelative,
        );
        if (
          targetRelative.startsWith(".understand-code/tasks/") ||
          publishedDescriptor?.taskId !== undefined ||
          publishedDescriptor?.storageFormat === "jsonl_v1"
        ) {
          throw new ArtifactStoreError(
            "migration_failed",
            "Task-scoped Artifacts and Event logs must be migrated as one complete Task transaction.",
            { relativePath: targetRelative },
          );
        }
        if (
          publishedDescriptor === undefined &&
          (!targetRelative.startsWith(".understand-code/legacy/") ||
            !targetRelative.endsWith(".json"))
        ) {
          throw new ArtifactStoreError(
            "migration_failed",
            "Unpublished migrations are restricted to JSON files under .understand-code/legacy/.",
            { relativePath: targetRelative },
          );
        }
        if (publishedDescriptor?.state === "corrupt") {
          throw new ArtifactStoreError(
            "migration_failed",
            "A corrupt published Artifact must be recovered before migration.",
            {
              artifactId: publishedDescriptor.artifactId,
              relativePath: targetRelative,
            },
          );
        }
        if (
          publishedDescriptor?.artifactType === "repository_snapshot"
        ) {
          throw new ArtifactStoreError(
            "migration_failed",
            "Published Repository Snapshots are immutable and cannot be migrated in place.",
            {
              artifactId: publishedDescriptor.artifactId,
              sourceSnapshotId: publishedDescriptor.sourceSnapshotId,
              migrationPolicy: "create_new_snapshot",
            },
          );
        }
        if (publishedDescriptor !== undefined) {
          await this.#verifyManifestArtifacts(manifest);
        }

        const originalBytes = await readManagedFile(
          this.layout.worktreeRoot,
          targetPath,
        );
        const originalManifestBytes =
          publishedDescriptor === undefined
            ? undefined
            : await readManagedFile(
                this.layout.worktreeRoot,
                this.layout.manifest,
              );
        let original: unknown;
        try {
          original = JSON.parse(originalBytes.toString("utf8")) as unknown;
        } catch (error) {
          throw new ArtifactStoreError(
            "migration_failed",
            "Migration input is not valid JSON.",
            undefined,
            { cause: error },
          );
        }
        let originalArtifact: PersistedArtifactV1 | undefined;
        if (publishedDescriptor?.storageFormat === "enveloped_v1") {
          originalArtifact = this.#parseTrustedArtifact(original);
          await this.#requirePublishedDescriptor(
            originalArtifact,
            targetPath,
            manifest,
          );
        } else if (publishedDescriptor?.storageFormat === "legacy_raw") {
          if (
            publishedDescriptor.legacyFormat !== options.format ||
            String(publishedDescriptor.schemaVersion) !== options.toVersion
          ) {
            throw new ArtifactStoreError(
              "migration_failed",
              "Published legacy migration format and target version must match its registered descriptor.",
              {
                artifactId: publishedDescriptor.artifactId,
                expectedFormat: publishedDescriptor.legacyFormat,
                actualFormat: options.format,
                expectedVersion: String(publishedDescriptor.schemaVersion),
                actualVersion: options.toVersion,
              },
            );
          }
        }

        const migration = migrateArtifactValueV1({
          value: original,
          format: options.format,
          fromVersion: options.fromVersion,
          toVersion: options.toVersion,
          steps: options.steps,
        });
        if (!migration.ok) {
          throw new ArtifactStoreError(
            "migration_failed",
            migration.message,
            { migrationCode: migration.code },
          );
        }

        const isolationRelative =
          `.understand-code/.recovery/migrations/${randomUUID()}`;
        const isolationDirectory = await ensureManagedDirectory(
          this.layout.worktreeRoot,
          isolationRelative,
        );
        const candidatePath = path.join(isolationDirectory, "candidate.json");
        let targetSwitched = false;
        let manifestCommitted = false;
        let backupPath: string | undefined;
        try {
          await atomicWriteJson(
            this.layout.worktreeRoot,
            candidatePath,
            migration.value,
          );
          const isolatedBytes = await readManagedFile(
            this.layout.worktreeRoot,
            candidatePath,
          );
          const isolatedValue = JSON.parse(
            isolatedBytes.toString("utf8"),
          ) as unknown;
          await options.validate(isolatedValue);
          if (!migration.migrated) {
            return {
              value: migration.value,
              appliedVersions: migration.appliedVersions,
              migrated: false,
            };
          }

          let nextManifest: ArtifactManifestV1 | undefined;
          if (publishedDescriptor !== undefined) {
            let nextDescriptor:
              | ReturnType<typeof ArtifactDescriptorV1Schema.parse>
              | undefined;
            if (publishedDescriptor.storageFormat === "enveloped_v1") {
              if (originalArtifact === undefined) {
                throw new ArtifactStoreError(
                  "migration_failed",
                  "Published V1 migration lost its trusted source identity.",
                  { artifactId: publishedDescriptor.artifactId },
                );
              }
              const migratedArtifact = this.#parseTrustedArtifact(
                isolatedValue,
              );
              if (
                migratedArtifact.repositoryId !== originalArtifact.repositoryId ||
                migratedArtifact.worktreeId !== originalArtifact.worktreeId ||
                migratedArtifact.artifactId !== originalArtifact.artifactId ||
                migratedArtifact.artifactType !== originalArtifact.artifactType ||
                migratedArtifact.taskId !== originalArtifact.taskId ||
                migratedArtifact.sourceSnapshotId !==
                  originalArtifact.sourceSnapshotId ||
                migratedArtifact.revision !== originalArtifact.revision + 1 ||
                this.#artifactPath(migratedArtifact) !== targetPath
              ) {
                throw new ArtifactStoreError(
                  "migration_failed",
                  "A published V1 migration must preserve canonical identity and advance revision exactly once.",
                  {
                    artifactId: originalArtifact.artifactId,
                    sourceRevision: originalArtifact.revision,
                    migratedRevision: migratedArtifact.revision,
                  },
                );
              }
              nextDescriptor = ArtifactDescriptorV1Schema.parse({
                ...publishedDescriptor,
                schemaVersion: migratedArtifact.schemaVersion,
                producerVersion: migratedArtifact.producerVersion,
                sourceSnapshotId: migratedArtifact.sourceSnapshotId,
                revision: migratedArtifact.revision,
                contentDigest: migratedArtifact.contentDigest,
                generatedAt: migratedArtifact.createdAt,
              });
            } else if (publishedDescriptor.storageFormat === "legacy_raw") {
              nextDescriptor = ArtifactDescriptorV1Schema.parse({
                ...publishedDescriptor,
                producerVersion: this.producerVersion,
                revision: (publishedDescriptor.revision ?? 0) + 1,
                contentDigest: sha256Bytes(isolatedBytes),
                generatedAt: this.#now(),
              });
            } else {
              throw new ArtifactStoreError(
                "migration_failed",
                "The published storage format is not migratable through migrateJson.",
                {
                  artifactId: publishedDescriptor.artifactId,
                  storageFormat: publishedDescriptor.storageFormat,
                },
              );
            }

            const conflictingDependents = manifest.artifacts.filter(
              (descriptor) =>
                descriptor.dependencies.some(
                  (dependency) =>
                    dependency.artifactId ===
                      publishedDescriptor.artifactId &&
                    dependency.requiredDigest !== undefined &&
                    dependency.requiredDigest !==
                      nextDescriptor?.contentDigest,
                ),
            );
            if (conflictingDependents.length > 0) {
              throw new ArtifactStoreError(
                "migration_failed",
                "Published migration would invalidate digest-pinned dependents; migrate the complete dependency transaction instead.",
                {
                  artifactId: publishedDescriptor.artifactId,
                  dependentArtifactIds: conflictingDependents.map(
                    (descriptor) => descriptor.artifactId,
                  ),
                },
              );
            }
            try {
              nextManifest = ArtifactManifestV1Schema.parse({
                ...manifest,
                producerVersion: this.producerVersion,
                updatedAt: this.#now(),
                artifacts: manifest.artifacts.map((descriptor) =>
                  descriptor.artifactId === publishedDescriptor.artifactId
                    ? nextDescriptor
                    : descriptor,
                ),
              });
            } catch (error) {
              throw new ArtifactStoreError(
                "migration_failed",
                "Migrated descriptor would violate Artifact Manifest invariants.",
                { artifactId: publishedDescriptor.artifactId },
                { cause: error },
              );
            }
          }

          backupPath = await this.#writeBackup(targetPath, originalBytes);
          if (originalManifestBytes !== undefined) {
            await this.#writeBackup(
              this.layout.manifest,
              originalManifestBytes,
            );
          }
          await atomicWriteFile(
            this.layout.worktreeRoot,
            targetPath,
            isolatedBytes,
            options.write,
          );
          targetSwitched = true;
          await options.afterSwitch?.();
          const switchedBytes = await readManagedFile(
            this.layout.worktreeRoot,
            targetPath,
          );
          if (!switchedBytes.equals(isolatedBytes)) {
            throw new ArtifactStoreError(
              "migration_failed",
              "Migration target changed before its Manifest commit.",
              { relativePath: targetRelative },
            );
          }
          if (
            nextManifest !== undefined &&
            originalManifestBytes !== undefined
          ) {
            const currentManifestBytes = await readManagedFile(
              this.layout.worktreeRoot,
              this.layout.manifest,
            );
            if (!currentManifestBytes.equals(originalManifestBytes)) {
              throw new ArtifactStoreError(
                "migration_failed",
                "Artifact Manifest changed during migration.",
                {
                  relativePath: targetRelative,
                  artifactId: publishedDescriptor?.artifactId,
                },
              );
            }
            try {
              await atomicWriteJson(
                this.layout.worktreeRoot,
                this.layout.manifest,
                nextManifest,
                options.manifestWrite,
              );
              manifestCommitted = true;
            } catch (error) {
              if (
                error instanceof ArtifactStoreError &&
                error.details?.committed === true
              ) {
                const committedManifest = await this.#readManifestRaw();
                if (
                  canonicalizeJson(committedManifest) ===
                  canonicalizeJson(nextManifest)
                ) {
                  manifestCommitted = true;
                }
              }
              throw error;
            }
          }
          return {
            value: migration.value,
            appliedVersions: migration.appliedVersions,
            migrated: migration.migrated,
            backupPath,
          };
        } catch (error) {
          if (
            error instanceof ArtifactStoreError &&
            error.details?.committed === true &&
            error.details?.targetPath === targetPath
          ) {
            targetSwitched = true;
          }
          let rolledBack = !targetSwitched;
          let rollbackError: unknown;
          if (targetSwitched && !manifestCommitted) {
            try {
              await atomicWriteFile(
                this.layout.worktreeRoot,
                targetPath,
                originalBytes,
              );
              const restored = await readManagedFile(
                this.layout.worktreeRoot,
                targetPath,
              );
              rolledBack = restored.equals(originalBytes);
            } catch (candidateRollbackError) {
              rollbackError = candidateRollbackError;
              try {
                const restored = await readManagedFile(
                  this.layout.worktreeRoot,
                  targetPath,
                );
                rolledBack = restored.equals(originalBytes);
              } catch {
                rolledBack = false;
              }
            }
          }
          if (
            originalManifestBytes !== undefined &&
            !manifestCommitted
          ) {
            try {
              const currentManifestBytes = await readManagedFile(
                this.layout.worktreeRoot,
                this.layout.manifest,
              );
              if (!currentManifestBytes.equals(originalManifestBytes)) {
                await atomicWriteFile(
                  this.layout.worktreeRoot,
                  this.layout.manifest,
                  originalManifestBytes,
                );
              }
            } catch (manifestRollbackError) {
              rollbackError ??= manifestRollbackError;
              rolledBack = false;
            }
          }
          throw new ArtifactStoreError(
            "migration_failed",
            manifestCommitted
              ? "Migration crossed the Manifest commit point, but durability confirmation failed."
              : rolledBack
                ? "Migration failed validation or switching; original Artifact and Manifest bytes were restored."
                : "Migration rollback could not restore the original publication.",
            {
              ...(error instanceof ArtifactStoreError
                ? error.details
                : {}),
              targetSwitched,
              manifestCommitted,
              rolledBack,
              ...(rollbackError instanceof Error
                ? { rollbackError: rollbackError.message }
                : {}),
            },
            { cause: error },
          );
        } finally {
          await unlink(candidatePath).catch(() => undefined);
          await rmdir(isolationDirectory).catch(() => undefined);
        }
      },
      this.#lockOptions,
    );
  }
}
