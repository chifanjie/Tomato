import {
  ArtifactStore,
  ArtifactStoreError,
  type ReadTaskBundleResult,
} from "@understand-code/artifact-store";
import {
  BuildTaskBriefInputV1Schema,
  BuildTaskBriefResultV1Schema,
  CheckChangeInputV1Schema,
  GetTaskBriefInputV1Schema,
  GetTaskBriefResultV1Schema,
  IdempotencyRecordV1Schema,
  RecordVerificationInputV1Schema,
  TaskManifestV1Schema,
  TaskOperationReceiptV1Schema,
  UpdateTaskInputV1Schema,
  type BuildTaskBriefInputV1,
  type BuildTaskBriefResultV1,
  type GetTaskBriefInputV1,
  type IdempotencyRecordV1,
  type RepoPulseV1,
  type RepositorySnapshotV1,
  type TaskBriefPageItemV1,
  type TaskManifestV1,
  type TaskOperationReceiptV1,
  type UpdateTaskInputV1,
} from "@understand-code/contracts";

import {
  buildTaskArtifacts,
  buildTaskEvent,
  mutationResult,
} from "./artifacts.js";
import {
  checkTaskChange,
  recordTaskVerification,
  type ChangeCheckMutationOutcome,
  type VerificationMutationOutcome,
} from "./change-intelligence.js";
import { buildContextDraft } from "./context-builder.js";
import type {
  AuthorizationContext,
  TaskBriefPage,
  TaskContextRecoveryCapability,
  TaskEngineCapabilities,
  TaskEngineOptions,
  TaskMutationOutcome,
} from "./engine-types.js";
import { TaskEngineError } from "./errors.js";
import {
  deterministicTaskId,
  sha256CanonicalJson,
  stableId,
} from "./ids.js";
import { applyTaskUpdate } from "./mutation.js";
import { renderTaskBriefMarkdown } from "./renderer.js";

const DEFAULT_CREATE_SCOPE = "build_task_brief";

const LOCKED_CONTEXT_RECOVERY = Object.freeze({
  available: false,
  reasonCode: "task_context_rebuild_not_implemented",
  owner: "WP5",
} as const);

export const TASK_ENGINE_CAPABILITIES: TaskEngineCapabilities = Object.freeze({
  schemaVersion: 1,
  actions: Object.freeze({
    refresh_task_context: LOCKED_CONTEXT_RECOVERY,
    rebase_task: LOCKED_CONTEXT_RECOVERY,
  }),
});

interface RepositoryContext {
  snapshot: RepositorySnapshotV1;
  pulse?: RepoPulseV1;
}

interface PageCursor {
  version: 1;
  taskId: string;
  revision: number;
  section: GetTaskBriefInputV1["section"];
  offset: number;
}

function nextClockTimestamp(previous: string, clock: () => Date): string {
  const minimum = Date.parse(previous) + 1;
  const clockTime = clock().getTime();
  return new Date(
    Math.max(minimum, Number.isFinite(clockTime) ? clockTime : minimum),
  ).toISOString();
}

function artifactIds(taskId: string, contextual: boolean): string[] {
  return (
    contextual
      ? [
          "task_manifest",
          "task_brief",
          "claim_ledger",
          "evidence_ledger",
          "impact",
          "task_operation_journal",
        ]
      : ["task_manifest", "task_operation_journal"]
  ).map((type) => `artifact:${type}:${taskId}`);
}

function encodeCursor(cursor: PageCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(
  cursor: string,
  expected: Omit<PageCursor, "offset">,
): number {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as Partial<PageCursor>;
    if (
      decoded.version !== expected.version ||
      decoded.taskId !== expected.taskId ||
      decoded.revision !== expected.revision ||
      decoded.section !== expected.section ||
      !Number.isSafeInteger(decoded.offset) ||
      (decoded.offset ?? -1) < 0
    ) {
      throw new Error("cursor identity mismatch");
    }
    return decoded.offset!;
  } catch (error) {
    throw new TaskEngineError(
      "invalid_cursor",
      "Task Brief cursor is invalid for this Task revision and section.",
      { taskId: expected.taskId, section: expected.section },
      { cause: error },
    );
  }
}

export class TaskEngine {
  readonly #store: ArtifactStore;
  readonly #contextProvider: TaskEngineOptions["contextProvider"];
  readonly #clock: () => Date;
  readonly #createScope: string;

  constructor(store: ArtifactStore, options: TaskEngineOptions) {
    if (
      options.contextProvider.binding?.schemaVersion !== 1 ||
      options.contextProvider.binding.kind !==
        "canonical_worktree_root" ||
      options.contextProvider.binding.canonicalRoot !==
        store.layout.worktreeRoot
    ) {
      throw new TaskEngineError(
        "context_provider_mismatch",
        "The Task context provider is not bound to this Artifact Store worktree.",
        { reason: "canonical_worktree_root_mismatch" },
      );
    }
    this.#store = store;
    this.#contextProvider = options.contextProvider;
    this.#clock = options.clock ?? (() => new Date());
    this.#createScope = options.createScope ?? DEFAULT_CREATE_SCOPE;
  }

  getCapabilities(): TaskEngineCapabilities {
    return TASK_ENGINE_CAPABILITIES;
  }

  #authorize(
    auth: AuthorizationContext,
    requestedActor: string,
    capability: NonNullable<AuthorizationContext["capabilities"]>[number],
  ): void {
    if (
      auth.repositoryId !== this.#store.repositoryId ||
      auth.worktreeId !== this.#store.worktreeId ||
      auth.actor !== requestedActor ||
      auth.capabilities === undefined ||
      !auth.capabilities.includes(capability)
    ) {
      throw new TaskEngineError(
        "action_not_authorized",
        "The authenticated Agent context does not authorize this Task action.",
        {
          action: capability,
          actor: auth.actor,
          repositoryId: auth.repositoryId,
          worktreeId: auth.worktreeId,
        },
      );
    }
  }

  async #repositoryContext(
    requirePulse: boolean,
  ): Promise<RepositoryContext> {
    const manifest = await this.#store.readManifest();
    const snapshotId = manifest.latestSnapshotId;
    if (snapshotId === undefined) {
      throw new TaskEngineError(
        "artifact_unavailable",
        "A Repository Snapshot must be published before creating a Task.",
        { reason: "missing", artifactType: "repository_snapshot" },
      );
    }
    const snapshotRead = await this.#store.readArtifact(
      "repository_snapshot",
      { snapshotId },
    );
    if (snapshotRead.artifact.artifactType !== "repository_snapshot") {
      throw new TaskEngineError(
        "artifact_unavailable",
        "The current Repository Snapshot has an invalid type.",
        { reason: "corrupt", artifactType: "repository_snapshot" },
      );
    }
    let pulse: RepoPulseV1 | undefined;
    try {
      const pulseRead = await this.#store.readArtifact("repo_pulse");
      if (pulseRead.artifact.artifactType === "repo_pulse") {
        pulse = pulseRead.artifact.payload;
      }
    } catch (error) {
      if (requirePulse) {
        throw new TaskEngineError(
          "artifact_unavailable",
          "Repo Pulse is required before Task context can be built.",
          { reason: "missing", artifactType: "repo_pulse" },
          { cause: error },
        );
      }
    }
    return { snapshot: snapshotRead.artifact.payload, ...(pulse === undefined ? {} : { pulse }) };
  }

  async #readExistingTask(
    taskId: string,
  ): Promise<ReadTaskBundleResult | undefined> {
    const manifest = await this.#store.readManifest();
    if (
      !manifest.artifacts.some(
        (descriptor) =>
          descriptor.taskId === taskId &&
          descriptor.artifactType === "task_manifest",
      )
    ) {
      return undefined;
    }
    return this.#store.readTaskBundle(taskId);
  }

  #matchingReceipt(
    read: ReadTaskBundleResult,
    createScope: string,
    key: string,
    actor: string,
    requestDigest: string,
  ): TaskOperationReceiptV1 | undefined {
    const record = read.bundle.idempotencyRecords.find(
      (candidate) =>
        candidate.scope.kind === "task_create" &&
        candidate.scope.createScope === createScope &&
        candidate.idempotencyKey === key,
    );
    if (record === undefined) return undefined;
    if (
      record.actor !== actor ||
      record.requestDigest !== requestDigest
    ) {
      throw new TaskEngineError(
        "idempotency_conflict",
        "The create-scope idempotency key was already used by another request or actor.",
        {
          idempotencyKey: key,
          requestDigest,
          existingRequestDigest: record.requestDigest,
        },
      );
    }
    const receipt = read.receipts.find(
      (candidate) => candidate.eventId === record.eventId,
    );
    if (receipt === undefined) {
      throw new TaskEngineError(
        "context_build_failed",
        "The persisted idempotency record has no operation receipt.",
        { taskId: read.bundle.manifest.taskId, eventId: record.eventId },
      );
    }
    return receipt;
  }

  #replayedBuildResult(
    receipt: TaskOperationReceiptV1,
  ): BuildTaskBriefResultV1 {
    if (receipt.operation !== "build_task_brief") {
      throw new TaskEngineError(
        "idempotency_conflict",
        "The idempotency key belongs to another Task operation.",
        { eventId: receipt.eventId, operation: receipt.operation },
      );
    }
    return BuildTaskBriefResultV1Schema.parse({
      ...receipt.result,
      mutation: {
        ...receipt.result.mutation,
        idempotentReplay: true,
      },
    });
  }

  #requireCreatedReceipt(
    read: ReadTaskBundleResult,
    input: BuildTaskBriefInputV1,
    requestDigest: string,
  ): TaskOperationReceiptV1 {
    const internalKey = stableId("idempotency:task-created", {
      worktreeId: this.#store.worktreeId,
      createScope: this.#createScope,
      idempotencyKey: input.idempotencyKey,
    });
    const internalDigest = sha256CanonicalJson({
      phase: "task_created",
      requestDigest,
    });
    const receipt = this.#matchingReceipt(
      read,
      `${this.#createScope}:created`,
      internalKey,
      input.actor,
      internalDigest,
    );
    if (receipt === undefined || receipt.operation !== "task_created") {
      throw new TaskEngineError(
        "context_build_failed",
        "The persisted created stage has no matching trusted operation receipt.",
        {
          taskId: read.bundle.manifest.taskId,
          idempotencyKey: input.idempotencyKey,
        },
      );
    }
    return receipt;
  }

  async #commitCreatedStage(
    taskId: string,
    input: BuildTaskBriefInputV1,
    requestDigest: string,
    initial: RepositoryContext,
  ): Promise<ReadTaskBundleResult> {
    const createdAt = this.#clock().toISOString();
    const baselineSnapshotId =
      initial.pulse?.baselineSnapshotId ?? initial.snapshot.snapshotId;
    const task = TaskManifestV1Schema.parse({
      schemaVersion: 1,
      taskId,
      title: input.task.trim().replace(/\s+/gu, " ").slice(0, 160),
      originalIntent: input.task,
      status: "created",
      repositoryId: this.#store.repositoryId,
      worktreeId: this.#store.worktreeId,
      baselineSnapshotId,
      latestSnapshotId: initial.snapshot.snapshotId,
      createdAt,
      updatedAt: createdAt,
      producerVersion: this.#store.producerVersion,
      revision: 1,
    });
    const internalKey = stableId("idempotency:task-created", {
      worktreeId: this.#store.worktreeId,
      createScope: this.#createScope,
      idempotencyKey: input.idempotencyKey,
    });
    const internalDigest = sha256CanonicalJson({
      phase: "task_created",
      requestDigest,
    });
    const event = buildTaskEvent({
      manifest: task,
      action: { type: "task_created" },
      actor: input.actor,
      idempotencyKey: internalKey,
      requestDigest: internalDigest,
      occurredAt: createdAt,
    });
    const mutation = mutationResult(
      task,
      event,
      artifactIds(taskId, false),
    );
    const receiptResult = { task, mutation };
    const resultDigest = sha256CanonicalJson(receiptResult);
    const record = IdempotencyRecordV1Schema.parse({
      schemaVersion: 1,
      worktreeId: this.#store.worktreeId,
      scope: {
        kind: "task_create",
        createScope: `${this.#createScope}:created`,
      },
      idempotencyKey: internalKey,
      actor: input.actor,
      requestDigest: internalDigest,
      taskId,
      resultRevision: 1,
      eventId: event.eventId,
      resultDigest,
      createdAt,
    });
    const receipt = TaskOperationReceiptV1Schema.parse({
      schemaVersion: 1,
      operation: "task_created",
      taskId,
      eventId: event.eventId,
      resultDigest,
      result: receiptResult,
    });
    const artifacts = buildTaskArtifacts({
      manifest: task,
      idempotencyRecords: [record],
      receipts: [receipt],
      createdAt,
    });
    try {
      await this.#store.persistTaskBundle(
        {
          artifacts,
          events: [event],
          idempotencyRecords: [record],
        },
        {
          expectedRevision: 0,
          idempotencyKey: internalKey,
          requestDigest: internalDigest,
        },
      );
    } catch (error) {
      const raced = await this.#readExistingTask(taskId).catch(() => undefined);
      if (raced !== undefined) return raced;
      throw error;
    }
    return this.#store.readTaskBundle(taskId);
  }

  async buildTaskBrief(
    inputValue: BuildTaskBriefInputV1,
    auth: AuthorizationContext,
  ): Promise<BuildTaskBriefResultV1> {
    const input = BuildTaskBriefInputV1Schema.parse(inputValue);
    this.#authorize(auth, input.actor, "task:create");
    const requestDigest = sha256CanonicalJson(input);
    const taskId = deterministicTaskId({
      worktreeId: this.#store.worktreeId,
      createScope: this.#createScope,
      idempotencyKey: input.idempotencyKey,
    });
    let current = await this.#readExistingTask(taskId);
    if (current !== undefined) {
      const completed = this.#matchingReceipt(
        current,
        this.#createScope,
        input.idempotencyKey,
        input.actor,
        requestDigest,
      );
      if (completed !== undefined) {
        return this.#replayedBuildResult(completed);
      }
    } else {
      const initial = await this.#repositoryContext(false);
      current = await this.#commitCreatedStage(
        taskId,
        input,
        requestDigest,
        initial,
      );
    }
    this.#requireCreatedReceipt(current, input, requestDigest);
    if (current.bundle.manifest.status !== "created") {
      const completed = this.#matchingReceipt(
        current,
        this.#createScope,
        input.idempotencyKey,
        input.actor,
        requestDigest,
      );
      if (completed !== undefined) {
        return this.#replayedBuildResult(completed);
      }
      throw new TaskEngineError(
        "idempotency_conflict",
        "The stable build key resolved to a Task that cannot resume context creation.",
        {
          taskId,
          status: current.bundle.manifest.status,
        },
      );
    }

    const repository = await this.#repositoryContext(true);
    const pulse = repository.pulse!;
    if (
      ["not_ready", "unknown", "rebuilding", "error"].includes(
        pulse.status,
      )
    ) {
      throw new TaskEngineError(
        "task_gate_unsatisfied",
        "Task intent was saved, but Repo Pulse cannot support context_ready.",
        {
          taskId,
          targetStatus: "context_ready",
          failedGuards: [
            { code: "context_not_ready", resourceId: pulse.status },
          ],
        },
      );
    }
    let context: Awaited<
      ReturnType<TaskEngineOptions["contextProvider"]["loadTaskContext"]>
    >;
    try {
      context = await this.#contextProvider.loadTaskContext({
        intent: input.task,
        sourceSnapshotId: repository.snapshot.snapshotId,
        repositorySnapshot: repository.snapshot,
        ...(input.scope === undefined ? {} : { scope: input.scope }),
        ...(input.baseRef === undefined ? {} : { baseRef: input.baseRef }),
      });
    } catch (error) {
      throw new TaskEngineError(
        "context_build_failed",
        "The Task context provider could not load repository context.",
        { taskId, stage: "context_provider" },
        { cause: error },
      );
    }
    const occurredAt = nextClockTimestamp(
      current.bundle.manifest.updatedAt,
      this.#clock,
    );
    const contextRevision = current.bundle.manifest.revision + 1;
    let draft: ReturnType<typeof buildContextDraft>;
    try {
      draft = buildContextDraft({
        taskId,
        intent: input.task,
        snapshotId: repository.snapshot.snapshotId,
        createdAt: occurredAt,
        pulse,
        repositorySnapshot: repository.snapshot,
        context,
        ...(input.scope === undefined ? {} : { scope: input.scope }),
        ...(input.tokenBudget === undefined
          ? {}
          : { tokenBudget: input.tokenBudget }),
        ...(input.maxCandidates === undefined
          ? {}
          : { maxCandidates: input.maxCandidates }),
        ...(input.maxImpactDepth === undefined
          ? {}
          : { maxImpactDepth: input.maxImpactDepth }),
      });
    } catch (error) {
      throw new TaskEngineError(
        "context_build_failed",
        "The loaded repository context could not produce a Task Brief.",
        { taskId, stage: "context_draft" },
        { cause: error },
      );
    }
    const task = TaskManifestV1Schema.parse({
      ...current.bundle.manifest,
      status: "context_ready",
      latestSnapshotId: repository.snapshot.snapshotId,
      updatedAt: occurredAt,
      revision: contextRevision,
    });
    const event = buildTaskEvent({
      manifest: task,
      previousManifest: current.bundle.manifest,
      previousEvent: current.bundle.events.at(-1),
      action: { type: "transition_status", to: "context_ready" },
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      requestDigest,
      occurredAt,
    });
    const mutation = mutationResult(
      task,
      event,
      artifactIds(taskId, true),
    );
    const result = BuildTaskBriefResultV1Schema.parse({
      task,
      brief: draft.brief,
      mutation,
      claimIds: draft.claims.map((claim) => claim.id),
      evidenceIds: draft.evidence.map((item) => item.id),
    });
    const resultDigest = sha256CanonicalJson(result);
    const record = IdempotencyRecordV1Schema.parse({
      schemaVersion: 1,
      worktreeId: this.#store.worktreeId,
      scope: { kind: "task_create", createScope: this.#createScope },
      idempotencyKey: input.idempotencyKey,
      actor: input.actor,
      requestDigest,
      taskId,
      resultRevision: task.revision,
      eventId: event.eventId,
      resultDigest,
      createdAt: occurredAt,
    });
    const receipt = TaskOperationReceiptV1Schema.parse({
      schemaVersion: 1,
      operation: "build_task_brief",
      taskId,
      eventId: event.eventId,
      resultDigest,
      result,
    });
    const records = [...current.bundle.idempotencyRecords, record];
    const receipts = [...current.receipts, receipt];
    const artifacts = buildTaskArtifacts({
      manifest: task,
      brief: draft.brief,
      claims: draft.claims,
      evidence: draft.evidence,
      impactPaths: draft.impactPaths,
      idempotencyRecords: records,
      receipts,
      createdAt: occurredAt,
    });
    try {
      await this.#store.persistTaskBundle(
        {
          artifacts,
          events: [...current.bundle.events, event],
          idempotencyRecords: records,
        },
        {
          expectedRevision: current.bundle.manifest.revision,
          idempotencyKey: input.idempotencyKey,
          requestDigest,
        },
      );
    } catch (error) {
      const raced = await this.#readExistingTask(taskId).catch(() => undefined);
      if (raced !== undefined) {
        const replay = this.#matchingReceipt(
          raced,
          this.#createScope,
          input.idempotencyKey,
          input.actor,
          requestDigest,
        );
        if (replay !== undefined) return this.#replayedBuildResult(replay);
      }
      throw error;
    }
    return result;
  }

  async getTaskBrief(
    inputValue: GetTaskBriefInputV1,
  ): Promise<TaskBriefPage> {
    const input = GetTaskBriefInputV1Schema.parse(inputValue);
    const read = await this.#store.readTaskBundle(input.taskId);
    if (!("brief" in read.bundle)) {
      throw new TaskEngineError(
        "artifact_unavailable",
        "Task context has not been built yet.",
        { taskId: input.taskId, reason: "missing", artifactType: "task_brief" },
      );
    }
    const brief = read.bundle.brief;
    const allItems: TaskBriefPageItemV1[] = [];
    switch (input.section) {
      case "summary":
        allItems.push({
          kind: "summary",
          originalIntent: brief.originalIntent,
          goalClaimId: brief.goalClaimId,
          acceptanceClaimCount: brief.acceptanceClaimIds.length,
          plannedChangeCount: brief.plannedChanges.length,
        });
        break;
      case "goals":
        allItems.push(
          {
            kind: "claim_reference",
            role: "goal",
            claimId: brief.goalClaimId,
          },
          ...brief.nonGoalClaimIds.map((claimId) => ({
            kind: "claim_reference" as const,
            role: "non_goal" as const,
            claimId,
          })),
          ...brief.acceptanceClaimIds.map((claimId) => ({
            kind: "claim_reference" as const,
            role: "acceptance" as const,
            claimId,
          })),
        );
        break;
      case "reading_path":
        allItems.push(
          ...brief.readingPath.map((entry) => ({
            kind: "reading_path" as const,
            entry,
          })),
        );
        break;
      case "planned_changes":
        allItems.push(
          ...brief.plannedChanges.map((change) => ({
            kind: "planned_change" as const,
            change,
          })),
        );
        break;
      case "assumptions":
        allItems.push(
          ...brief.assumptionClaimIds.map((claimId) => ({
            kind: "claim_reference" as const,
            role: "assumption" as const,
            claimId,
          })),
        );
        break;
      case "risks":
        allItems.push(
          ...brief.riskClaimIds.map((claimId) => ({
            kind: "claim_reference" as const,
            role: "risk" as const,
            claimId,
          })),
        );
        break;
      case "unknowns":
        allItems.push(
          ...brief.unknownClaimIds.map((claimId) => ({
            kind: "claim_reference" as const,
            role: "unknown" as const,
            claimId,
          })),
        );
        break;
      case "verification_plan":
        allItems.push(
          ...brief.verificationPlan.map((entry) => ({
            kind: "verification_plan" as const,
            entry,
          })),
        );
        break;
    }
    const cursorIdentity = {
      version: 1 as const,
      taskId: input.taskId,
      revision: read.bundle.manifest.revision,
      section: input.section,
    };
    const offset =
      input.cursor === undefined
        ? 0
        : decodeCursor(input.cursor, cursorIdentity);
    if (offset > allItems.length) {
      throw new TaskEngineError(
        "invalid_cursor",
        "Task Brief cursor offset is outside the current section.",
        { taskId: input.taskId, section: input.section },
      );
    }
    const pageSize = input.pageSize ?? 50;
    const items = allItems.slice(offset, offset + pageSize);
    const nextOffset = offset + items.length;
    const result = GetTaskBriefResultV1Schema.parse({
      task: read.bundle.manifest,
      section: input.section,
      items,
    });
    return {
      result,
      ...(nextOffset < allItems.length
        ? {
            nextCursor: encodeCursor({
              ...cursorIdentity,
              offset: nextOffset,
            }),
          }
        : {}),
      total: allItems.length,
    };
  }

  async updateTask(
    inputValue: UpdateTaskInputV1,
    auth: AuthorizationContext,
  ): Promise<TaskMutationOutcome> {
    const input = UpdateTaskInputV1Schema.parse(inputValue);
    this.#authorize(
      auth,
      input.actor,
      input.action.type === "supersede_task"
        ? "task:supersede"
        : input.action.type.startsWith("confirm_") ||
            input.action.type === "record_assumption"
          ? "task:confirm"
          : input.action.type.startsWith("accept_")
            ? "task:accept"
          : "task:update",
    );
    const recoveryCapability: TaskContextRecoveryCapability | undefined =
      input.action.type === "refresh_task_context" ||
        input.action.type === "rebase_task"
        ? input.action.type
        : undefined;
    if (recoveryCapability !== undefined) {
      const capability =
        TASK_ENGINE_CAPABILITIES.actions[recoveryCapability];
      throw new TaskEngineError(
        "capability_unavailable",
        `${recoveryCapability} is capability-locked until Task context rebuilding is implemented.`,
        {
          taskId: input.taskId,
          capability: recoveryCapability,
          available: capability.available,
          reasonCode: capability.reasonCode,
          owner: capability.owner,
        },
      );
    }
    return applyTaskUpdate(this.#store, input, this.#clock);
  }

  /**
   * Compare the persisted Task Brief against the selected current Repository
   * Snapshot and append one durable Change Check revision.
   *
   * Change Intelligence is deliberately exposed through the Engine so the
   * CLI/MCP surface cannot bypass Task authorization, CAS, or the Artifact
   * Store's append-only payload policy.
   */
  async checkChange(
    inputValue: import("@understand-code/contracts").CheckChangeInputV1,
    auth: AuthorizationContext,
  ): Promise<ChangeCheckMutationOutcome> {
    const input = CheckChangeInputV1Schema.parse(inputValue);
    this.#authorize(auth, input.actor, "task:update");
    return checkTaskChange(this.#store, input, this.#clock);
  }

  /**
   * Record an externally executed Verification result against the current
   * verification plan entry using the same durable Task mutation semantics.
   */
  async recordVerification(
    inputValue: import("@understand-code/contracts").RecordVerificationInputV1,
    auth: AuthorizationContext,
  ): Promise<VerificationMutationOutcome> {
    const input = RecordVerificationInputV1Schema.parse(inputValue);
    this.#authorize(auth, input.actor, "task:update");
    return recordTaskVerification(this.#store, input, this.#clock);
  }

  async renderTaskBriefMarkdown(taskId: string): Promise<string> {
    const read = await this.#store.readTaskBundle(taskId);
    return renderTaskBriefMarkdown(read);
  }
}
