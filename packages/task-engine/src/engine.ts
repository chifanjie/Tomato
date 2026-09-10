import {
  ArtifactStore,
  ArtifactStoreError,
  type ReadTaskBundleResult,
} from "@understand-code/artifact-store";
import {
  BuildTaskBriefInputV1Schema,
  BuildTaskBriefResultV1Schema,
  CheckChangeInputV1Schema,
  ContextGenerationDependencyPinV1Schema,
  ContextGenerationInputV1Schema,
  GetTaskBriefInputV1Schema,
  GetTaskBriefResultV1Schema,
  IdempotencyRecordV1Schema,
  PathSafeRepositorySnapshotIdV1Schema,
  RecordVerificationInputV1Schema,
  ResolvedContextBuildSpecV1Schema,
  StrongCheckChangesInputV1Schema,
  StrongRecordVerificationInputV1Schema,
  StrongTaskBaselineCaptureInputV1Schema,
  TaskManifestV1Schema,
  TaskOperationReceiptV1Schema,
  UpdateTaskInputV1Schema,
  type BuildTaskBriefInputV1,
  type BuildTaskBriefResultV1,
  type ContextGenerationDependencyPinV1,
  type GetTaskBriefInputV1,
  type IdempotencyRecordV1,
  type RepoPulseV1,
  type RepoPulsePersistedPayloadV1,
  type RepositorySnapshotPersistedPayloadV1,
  type ResolvedContextBuildSpecV1,
  type StrongTaskBaselineCaptureOutcomeV1,
  type StrongChangeIntelligenceAuthorityV1,
  type StrongChangeCheckMutationOutcomeV1,
  type StrongCheckChangesInputV1,
  type StrongRecordVerificationInputV1,
  type StrongVerificationMutationOutcomeV1,
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
import {
  executeStrongChangeCheckV1,
  executeStrongVerificationRecordV1,
} from "./strong-change-intelligence.js";
import { buildContextDraft } from "./context-builder.js";
import type {
  AuthorizationContext,
  TaskBriefPage,
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
import {
  applyTaskUpdate,
  validateTaskVerifiedTransitionInternalV1,
  rebuildTaskContext,
} from "./mutation.js";
import { renderTaskBriefMarkdown } from "./renderer.js";

const DEFAULT_CREATE_SCOPE = "build_task_brief";

const LOCAL_CONTEXT_RECOVERY = Object.freeze({
  available: true,
  reasonCode: "task_context_rebuild_available",
  owner: "task-engine",
} as const);

export const TASK_ENGINE_CAPABILITIES: TaskEngineCapabilities = Object.freeze({
  schemaVersion: 1,
  actions: Object.freeze({
    refresh_task_context: LOCAL_CONTEXT_RECOVERY,
    rebase_task: LOCAL_CONTEXT_RECOVERY,
  }),
});

interface RepositoryContext {
  snapshot: RepositorySnapshotPersistedPayloadV1;
  snapshotArtifactId: string;
  snapshotContentDigest: string;
  pulse?: RepoPulsePersistedPayloadV1;
  pulseArtifactId?: string;
  pulseContentDigest?: string;
}

interface PageCursor {
  version: 1;
  taskId: string;
  revision: number;
  section: GetTaskBriefInputV1["section"];
  offset: number;
}

interface StrongTaskCreationState {
  readonly baselineCapture: StrongTaskBaselineCaptureOutcomeV1;
  readonly contextBuildSpec: ResolvedContextBuildSpecV1;
}

function isStrongRepositorySnapshot(
  snapshot: RepositorySnapshotPersistedPayloadV1,
): snapshot is Extract<
  RepositorySnapshotPersistedPayloadV1,
  { profile: "repository_snapshot_path_safe_v1" }
> {
  return (
    "profile" in snapshot &&
    snapshot.profile === "repository_snapshot_path_safe_v1"
  );
}

function resolvedContextBuildSpec(
  input: BuildTaskBriefInputV1,
): ResolvedContextBuildSpecV1 {
  return ResolvedContextBuildSpecV1Schema.parse({
    version: "context-build-spec-v1",
    scope: [...new Set(input.scope ?? [])].sort((left, right) =>
      Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"))
    ),
    tokenBudget: input.tokenBudget ?? 8_000,
    maxCandidates: input.maxCandidates ?? 20,
    maxImpactDepth: input.maxImpactDepth ?? 4,
    ...(input.baseRef === undefined ? {} : { baseRef: input.baseRef }),
  });
}

interface StrongTaskCreationRecovery {
  readonly snapshotId: string;
  readonly snapshotContentDigest: string;
  readonly contextBuildSpec: ResolvedContextBuildSpecV1;
}

function parseStrongTaskCreationRecovery(
  marker: Readonly<Record<string, unknown>>,
  taskId: string,
  input: BuildTaskBriefInputV1,
  requestDigest: string,
): StrongTaskCreationRecovery {
  if (
    marker.taskId !== taskId ||
    marker.idempotencyKey !== input.idempotencyKey ||
    marker.actor !== input.actor ||
    marker.requestDigest !== requestDigest ||
    typeof marker.snapshotId !== "string" ||
    typeof marker.snapshotContentDigest !== "string"
  ) {
    throw new TaskEngineError(
      "idempotency_conflict",
      "A strong Task creation recovery marker belongs to a different request.",
      {
        taskId,
        idempotencyKey: input.idempotencyKey,
        requestDigest,
      },
    );
  }
  try {
    return {
      snapshotId: PathSafeRepositorySnapshotIdV1Schema.parse(marker.snapshotId),
      snapshotContentDigest: marker.snapshotContentDigest,
      contextBuildSpec: ResolvedContextBuildSpecV1Schema.parse(
        marker.contextBuildSpec,
      ),
    };
  } catch (error) {
    throw new TaskEngineError(
      "context_build_failed",
      "A strong Task creation recovery marker is corrupt or unsupported.",
      {
        taskId,
        stage: "strong_creation_recovery",
        reason: "recovery_marker_invalid",
      },
      { cause: error },
    );
  }
}

function contextDependencyPinKey(
  pin: ContextGenerationDependencyPinV1,
): string {
  switch (pin.pinKind) {
    case "artifact":
      return [
        "0",
        pin.role,
        pin.artifactId,
        pin.contentDigest,
        pin.sourceSnapshotId,
      ].join("\0");
    case "artifact_absence":
      return ["1", pin.role, pin.reasonCode].join("\0");
    case "policy":
      return ["2", pin.role, pin.policyKind, pin.contentDigest].join("\0");
  }
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
  readonly #strongChangeAuthority?: StrongChangeIntelligenceAuthorityV1;

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
    this.#strongChangeAuthority = options.strongChangeAuthority;
  }

  getCapabilities(): TaskEngineCapabilities {
    if (this.#strongChangeAuthority !== undefined) {
      const locked = Object.freeze({ available: false, reasonCode: "strong_context_rebuild_unavailable", owner: "task-engine" } as const);
      return Object.freeze({ schemaVersion: 1, actions: Object.freeze({ refresh_task_context: locked, rebase_task: locked }) });
    }
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
    expectedSnapshotId?: string,
  ): Promise<RepositoryContext> {
    const manifest = await this.#store.readManifest();
    const snapshotId = expectedSnapshotId ?? manifest.latestSnapshotId;
    if (
      expectedSnapshotId !== undefined &&
      manifest.latestSnapshotId !== expectedSnapshotId
    ) {
      throw new TaskEngineError(
        "artifact_unavailable",
        "The published Repository Snapshot advanced while a strong Task creation was recoverable.",
        {
          reason: "snapshot_mismatch",
          expectedSnapshotId,
          actualSnapshotId: manifest.latestSnapshotId,
        },
      );
    }
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
    let pulse: RepoPulsePersistedPayloadV1 | undefined;
    let pulseArtifactId: string | undefined;
    let pulseContentDigest: string | undefined;
    try {
      const pulseRead = await this.#store.readArtifact("repo_pulse");
      if (pulseRead.artifact.artifactType === "repo_pulse") {
        if (pulseRead.artifact.sourceSnapshotId === snapshotId) {
          pulse = pulseRead.artifact.payload;
          pulseArtifactId = pulseRead.artifact.artifactId;
          pulseContentDigest = pulseRead.artifact.contentDigest;
        } else if (requirePulse) {
          throw new TaskEngineError(
            "artifact_unavailable",
            "Repo Pulse is not bound to the immutable Snapshot required for Task recovery.",
            {
              reason: "snapshot_mismatch",
              artifactType: "repo_pulse",
              expectedSnapshotId: snapshotId,
              actualSnapshotId: pulseRead.artifact.sourceSnapshotId,
            },
          );
        }
      }
    } catch (error) {
      if (error instanceof TaskEngineError) throw error;
      if (requirePulse) {
        throw new TaskEngineError(
          "artifact_unavailable",
          "Repo Pulse is required before Task context can be built.",
          { reason: "missing", artifactType: "repo_pulse" },
          { cause: error },
        );
      }
    }
    return {
      snapshot: snapshotRead.artifact.payload,
      snapshotArtifactId: snapshotRead.artifact.artifactId,
      snapshotContentDigest: snapshotRead.artifact.contentDigest,
      ...(pulse === undefined
        ? {}
        : {
            pulse,
            pulseArtifactId,
            pulseContentDigest,
          }),
    };
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
    strongCreation?: StrongTaskCreationState,
  ): Promise<ReadTaskBundleResult> {
    const createdAt = this.#clock().toISOString();
    const baselineSnapshotId = strongCreation === undefined
      ? initial.pulse?.baselineSnapshotId ?? initial.snapshot.snapshotId
      : strongCreation.baselineCapture.baseline.captureSnapshotId;
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
      ...(strongCreation === undefined
        ? { localContextBuildSpec: resolvedContextBuildSpec(input) }
        : {
            taskProfile: "agent_task_v1",
            taskBaselineArtifactId:
              strongCreation.baselineCapture.baseline.artifactId,
            contextBuildSpec: strongCreation.contextBuildSpec,
          }),
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
      // The baseline transaction envelope becomes the durable Provider locator
      // for dirty-overlay baselines.  It must outlive Task creation so later
      // Change checks never reconstruct private baseline bytes from a drifting
      // worktree.
      // The durable creation intent is only cleared after the Task bundle is
      // the commit point.  If this process dies before that point, the next
      // identical request finds the marker and deterministically replays the
      // same baseline cut instead of creating an untracked Provider object.
      await this.#store.completeStrongTaskCreationIntent(taskId).catch(() => {
        // Cleanup is recoverable: a committed Task is authoritative and a
        // later replay/startup can remove a leftover recovery marker.
      });
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
    let strongCreation: StrongTaskCreationState | undefined;
    let current = await this.#readExistingTask(taskId);
    if (current !== undefined) {
      // A crash may have occurred after the Task bundle commit but before
      // recovery-marker cleanup.  Once the bundle exists it is authoritative;
      // remove only that task-scoped marker and continue normal replay.
      await this.#store.completeStrongTaskCreationIntent(taskId).catch(() => {
        // Leave a recoverable marker if its directory is temporarily busy.
      });
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
      const persistedIntent = await this.#store.readStrongTaskCreationIntent(taskId);
      const recovery = persistedIntent === undefined
        ? undefined
        : parseStrongTaskCreationRecovery(
            persistedIntent,
            taskId,
            input,
            requestDigest,
          );
      let initial: RepositoryContext;
      try {
        initial = await this.#repositoryContext(
          false,
          recovery?.snapshotId,
        );
      } catch (error) {
        if (recovery === undefined) throw error;
        throw new TaskEngineError(
          "context_build_failed",
          "A strong Task creation recovery marker exists, but its immutable Snapshot cut is unavailable.",
          {
            taskId,
            stage: "strong_creation_recovery",
            reason: "strong_task_creation_recovery_required",
            snapshotId: recovery.snapshotId,
          },
          { cause: error },
        );
      }
      if (
        recovery !== undefined &&
        initial.snapshotContentDigest !== recovery.snapshotContentDigest
      ) {
        throw new TaskEngineError(
          "context_build_failed",
          "A strong Task creation recovery Snapshot failed its content-digest fence.",
          {
            taskId,
            stage: "strong_creation_recovery",
            reason: "snapshot_content_digest_mismatch",
            snapshotId: recovery.snapshotId,
          },
        );
      }
      if (
        initial.pulse !== undefined &&
        isStrongRepositorySnapshot(initial.snapshot) !==
          ("profile" in initial.pulse &&
            initial.pulse.profile === "repo_pulse_path_safe_v1")
      ) {
        throw new TaskEngineError(
          "artifact_unavailable",
          "Repository Snapshot and Repo Pulse profiles do not form one trusted context cut.",
          { reason: "unsupported_schema", artifactType: "repo_pulse" },
        );
      }
      if (isStrongRepositorySnapshot(initial.snapshot)) {
        if (this.#strongChangeAuthority === undefined) {
          throw new TaskEngineError(
            "capability_unavailable",
            "Strong Task creation requires the Provider baseline authority.",
            { taskId, reason: "strong_change_authority_unavailable" },
          );
        }
        const contextBuildSpec =
          recovery?.contextBuildSpec ?? resolvedContextBuildSpec(input);
        // Reserve a durable creation marker before the baseline authority can
        // create a Git lease or Provider-private object.  The marker binds
        // the request and exact Snapshot bytes; a crash before Task commit is
        // therefore replayable and cannot silently retarget a new Snapshot.
        await this.#store.persistStrongTaskCreationIntent({
          taskId,
          idempotencyKey: input.idempotencyKey,
          actor: input.actor,
          requestDigest,
          snapshotId: initial.snapshot.snapshotId,
          snapshotContentDigest: initial.snapshotContentDigest,
          contextBuildSpec,
        });
        const baselineCapture = await this.#strongChangeAuthority
          .captureTaskBaseline(
            StrongTaskBaselineCaptureInputV1Schema.parse({
              profile: "capture_task_baseline_strong_v1",
              taskId,
              snapshotId: initial.snapshot.snapshotId,
              contextBuildSpec,
              idempotencyKey: stableId("task-baseline-capture", {
                taskId,
                createIdempotencyKey: input.idempotencyKey,
              }),
              actor: input.actor,
            }),
          );
        strongCreation = { baselineCapture, contextBuildSpec };
      }
      current = await this.#commitCreatedStage(
        taskId,
        input,
        requestDigest,
        initial,
        strongCreation,
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

    if (current.bundle.manifest.taskProfile === "agent_task_v1") {
      if (
        this.#strongChangeAuthority === undefined ||
        current.bundle.manifest.contextBuildSpec === undefined
      ) {
        throw new TaskEngineError(
          "capability_unavailable",
          "The strong Task cannot resume without its Provider baseline authority.",
          { taskId, reason: "strong_change_authority_unavailable" },
        );
      }
      if (strongCreation === undefined) {
        strongCreation = {
          contextBuildSpec: current.bundle.manifest.contextBuildSpec,
          baselineCapture: await this.#strongChangeAuthority
            .captureTaskBaseline(
              StrongTaskBaselineCaptureInputV1Schema.parse({
                profile: "capture_task_baseline_strong_v1",
                taskId,
                snapshotId: current.bundle.manifest.baselineSnapshotId,
                contextBuildSpec: current.bundle.manifest.contextBuildSpec,
                idempotencyKey: stableId("task-baseline-capture", {
                  taskId,
                  createIdempotencyKey: input.idempotencyKey,
                }),
                actor: input.actor,
              }),
            ),
        };
      }
    }

    const repository = await this.#repositoryContext(
      true,
      strongCreation?.baselineCapture.snapshot.snapshotId,
    );
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
    if (strongCreation !== undefined) {
      if (
        !isStrongRepositorySnapshot(repository.snapshot) ||
        !("profile" in pulse) ||
        pulse.profile !== "repo_pulse_path_safe_v1" ||
        pulse.evaluatedSnapshotId !== repository.snapshot.snapshotId ||
        pulse.evaluatedSnapshotContentDigest !== repository.snapshotContentDigest
      ) {
        throw new TaskEngineError(
          "task_gate_unsatisfied",
          "Strong Task context requires an exact strong Snapshot and Repo Pulse cut.",
          {
            taskId,
            targetStatus: "context_ready",
            failedGuards: [
              { code: "strong_context_cut_mismatch", resourceId: repository.snapshot.snapshotId },
            ],
          },
        );
      }
    }
    let context: Awaited<
      ReturnType<TaskEngineOptions["contextProvider"]["loadTaskContext"]>
    >;
    try {
      context = await this.#contextProvider.loadTaskContext({
        intent: input.task,
        sourceSnapshotId: repository.snapshot.snapshotId,
        repositorySnapshot: repository.snapshot,
        ...(strongCreation === undefined
          ? input.scope === undefined ? {} : { scope: input.scope }
          : { scope: strongCreation.contextBuildSpec.scope }),
        ...((strongCreation?.contextBuildSpec.baseRef ?? input.baseRef) === undefined
          ? {}
          : { baseRef: strongCreation?.contextBuildSpec.baseRef ?? input.baseRef }),
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
    let contextGenerationId: string | undefined;
    let draftContext = context;
    if (strongCreation !== undefined) {
      const artifactManifest = await this.#store.readManifest();
      const descriptorFor = (artifactType: "graph" | "wiki_index") => {
        const matching = artifactManifest.artifacts.filter(
          (descriptor) =>
            descriptor.artifactType === artifactType &&
            descriptor.state === "current" &&
            descriptor.freshness !== "invalid" &&
            descriptor.sourceSnapshotId === repository.snapshot.snapshotId &&
            descriptor.contentDigest !== undefined,
        );
        return matching.length === 1 ? matching[0] : undefined;
      };
      const graphDescriptor = descriptorFor("graph");
      if (graphDescriptor === undefined && context.graph.nodes.length > 0) {
        throw new TaskEngineError(
          "task_gate_unsatisfied",
          "Strong Task context requires one exact current Graph artifact pin.",
          {
            taskId,
            targetStatus: "context_ready",
            failedGuards: [
              { code: "graph_pin_unavailable", resourceId: repository.snapshot.snapshotId },
            ],
          },
        );
      }
      const wikiDescriptor = descriptorFor("wiki_index");
      if (context.wiki !== undefined && wikiDescriptor === undefined) {
        throw new TaskEngineError(
          "task_gate_unsatisfied",
          "Strong Task context cannot use Wiki data without one exact artifact pin.",
          {
            taskId,
            targetStatus: "context_ready",
            failedGuards: [
              { code: "wiki_pin_unavailable", resourceId: repository.snapshot.snapshotId },
            ],
          },
        );
      }
      const contextBuildSpecDigest = sha256CanonicalJson([
        "context-build-spec-v1",
        strongCreation.contextBuildSpec,
      ]);
      const targetSnapshotId = PathSafeRepositorySnapshotIdV1Schema.parse(
        repository.snapshot.snapshotId,
      );
      const pins = [
        {
          pinKind: "artifact",
          role: "repository_snapshot",
          artifactId: targetSnapshotId,
          contentDigest: repository.snapshotContentDigest,
          sourceSnapshotId: targetSnapshotId,
        },
        {
          pinKind: "artifact",
          role: "repo_pulse",
          artifactId: repository.pulseArtifactId!,
          contentDigest: repository.pulseContentDigest!,
          sourceSnapshotId: targetSnapshotId,
        },
        ...(graphDescriptor === undefined
          ? [{
              pinKind: "artifact_absence" as const,
              role: "graph" as const,
              reasonCode: "not_generated" as const,
            }]
          : [{
              pinKind: "artifact" as const,
              role: "graph" as const,
              artifactId: graphDescriptor.artifactId,
              contentDigest: graphDescriptor.contentDigest!,
              sourceSnapshotId: targetSnapshotId,
            }]),
        ...(wikiDescriptor === undefined
          ? [{
              pinKind: "artifact_absence" as const,
              role: "wiki" as const,
              reasonCode: "not_generated" as const,
            }]
          : [{
              pinKind: "artifact" as const,
              role: "wiki" as const,
              artifactId: wikiDescriptor.artifactId,
              contentDigest: wikiDescriptor.contentDigest!,
              sourceSnapshotId: targetSnapshotId,
            }]),
        {
          pinKind: "artifact_absence",
          role: "source_evidence",
          reasonCode: "policy_excluded",
        },
        {
          pinKind: "policy",
          role: "policy",
          policyKind: "context_build",
          contentDigest: contextBuildSpecDigest,
        },
        {
          pinKind: "policy",
          role: "policy",
          policyKind: "repository",
          contentDigest:
            strongCreation.baselineCapture.baseline.repositoryPolicyDigest,
        },
        {
          pinKind: "policy",
          role: "policy",
          policyKind: "scanner",
          contentDigest:
            strongCreation.baselineCapture.baseline.scannerPolicyDigest,
        },
        {
          pinKind: "policy",
          role: "policy",
          policyKind: "safe_git_execution",
          contentDigest:
            strongCreation.baselineCapture.baseline.safeGitExecutionDigest,
        },
      ].map((pin) => ContextGenerationDependencyPinV1Schema.parse(pin));
      pins.sort((left, right) =>
        Buffer.compare(
          Buffer.from(contextDependencyPinKey(left), "utf8"),
          Buffer.from(contextDependencyPinKey(right), "utf8"),
        )
      );
      const generationInput = ContextGenerationInputV1Schema.parse({
        version: "context-generation-input-v1",
        taskId,
        resultingRevision: contextRevision,
        baselineSnapshotId: current.bundle.manifest.baselineSnapshotId,
        targetSnapshotId: repository.snapshot.snapshotId,
        contextBuildSpecDigest,
        upstreamDependencyPins: pins,
      });
      contextGenerationId = stableId("context-generation", [
        "context-generation-v1",
        { input: generationInput },
      ]);
      const { sourceEvidence: _untrustedSourceEvidence, ...pinnedContext } = context;
      draftContext = pinnedContext;
    }
    let draft: ReturnType<typeof buildContextDraft>;
    try {
      draft = buildContextDraft({
        taskId,
        intent: input.task,
        snapshotId: repository.snapshot.snapshotId,
        createdAt: occurredAt,
        pulse,
        repositorySnapshot: repository.snapshot,
        context: draftContext,
        ...(contextGenerationId === undefined ? {} : { contextGenerationId }),
        ...(strongCreation === undefined
          ? input.scope === undefined ? {} : { scope: input.scope }
          : { scope: strongCreation.contextBuildSpec.scope }),
        ...(strongCreation === undefined
          ? input.tokenBudget === undefined ? {} : { tokenBudget: input.tokenBudget }
          : { tokenBudget: strongCreation.contextBuildSpec.tokenBudget }),
        ...(strongCreation === undefined
          ? input.maxCandidates === undefined ? {} : { maxCandidates: input.maxCandidates }
          : { maxCandidates: strongCreation.contextBuildSpec.maxCandidates }),
        ...(strongCreation === undefined
          ? input.maxImpactDepth === undefined ? {} : { maxImpactDepth: input.maxImpactDepth }
          : { maxImpactDepth: strongCreation.contextBuildSpec.maxImpactDepth }),
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
      ...(contextGenerationId === undefined ? {} : { contextGenerationId }),
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
      case "analysis":
        // Read the ledger so existing Tasks need no migration: older Briefs
        // never stored conclusion IDs. Include analytical kinds from both the
        // initial context and host analysis, preserving their explicit status.
        for (const claim of read.bundle.claims) {
          const role = (["conclusion", "recommendation", "assumption", "risk", "unknown"] as const)
            .find((kind) => kind === claim.kind);
          if (role !== undefined) allItems.push({ kind: "claim_reference", role, claimId: claim.id });
        }
        break;
    }
    const claimsById = new Map(read.bundle.claims.map((claim) => [claim.id, claim]));
    for (const item of allItems) {
      if (item.kind === "claim_reference") {
        item.claim = claimsById.get(item.claimId);
      }
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
    if (
      input.action.type === "refresh_task_context" ||
      input.action.type === "rebase_task"
    ) {
      const capability = this.getCapabilities().actions[input.action.type];
      const recoveryRead = await this.#store.readTaskBundle(input.taskId);
      if (!capability.available || recoveryRead.bundle.manifest.taskProfile === "agent_task_v1") {
        throw new TaskEngineError(
          "capability_unavailable",
          "Task context recovery is not available.",
          {
            taskId: input.taskId,
            capability: input.action.type,
            ...capability,
            available: false,
            reasonCode: "strong_context_rebuild_unavailable",
          },
        );
      }
      const targetSnapshotId = input.action.targetSnapshotId;
      return rebuildTaskContext(
        this.#store,
        input,
        this.#clock,
        async (current, occurredAt) => {
          const repository = await this.#repositoryContext(true);
          if (
            repository.snapshot.snapshotId !== targetSnapshotId
          ) {
            throw new TaskEngineError(
              "task_gate_unsatisfied",
              "The requested refresh Snapshot is not the current published Repository Snapshot.",
              {
                taskId: input.taskId,
                targetStatus: "context_ready",
                failedGuards: [
                  {
                    code: "target_snapshot_not_current",
                    resourceId: targetSnapshotId,
                  },
                ],
              },
            );
          }
          const pulse = repository.pulse!;
          if (pulse.evaluatedSnapshotId !== targetSnapshotId) {
            throw new TaskEngineError(
              "task_gate_unsatisfied",
              "Repo Pulse is not bound to the requested refresh Snapshot.",
              {
                taskId: input.taskId,
                targetStatus: "context_ready",
                failedGuards: [
                  {
                    code: "pulse_snapshot_mismatch",
                    resourceId: pulse.evaluatedSnapshotId,
                  },
                ],
              },
            );
          }
          if (
            ["not_ready", "unknown", "rebuilding", "error"].includes(
              pulse.status,
            )
          ) {
            throw new TaskEngineError(
              "task_gate_unsatisfied",
              "Repo Pulse cannot support a refreshed Task context.",
              {
                taskId: input.taskId,
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
              intent: current.bundle.manifest.originalIntent,
              sourceSnapshotId: repository.snapshot.snapshotId,
              repositorySnapshot: repository.snapshot,
              ...(current.bundle.manifest.localContextBuildSpec === undefined ? {} : {
                scope: current.bundle.manifest.localContextBuildSpec.scope,
                baseRef: current.bundle.manifest.localContextBuildSpec.baseRef,
              }),
            });
          } catch (error) {
            throw new TaskEngineError(
              "context_build_failed",
              "The Task context provider could not rebuild repository context.",
              { taskId: input.taskId, stage: "context_provider" },
              { cause: error },
            );
          }
          let draft: ReturnType<typeof buildContextDraft>;
          try {
            draft = buildContextDraft({
              taskId: input.taskId,
              intent: current.bundle.manifest.originalIntent,
              snapshotId: repository.snapshot.snapshotId,
              createdAt: occurredAt,
              pulse,
              repositorySnapshot: repository.snapshot,
              context,
              ...(current.bundle.manifest.localContextBuildSpec === undefined ? {} : {
                scope: current.bundle.manifest.localContextBuildSpec.scope,
                tokenBudget: current.bundle.manifest.localContextBuildSpec.tokenBudget,
                maxCandidates: current.bundle.manifest.localContextBuildSpec.maxCandidates,
                maxImpactDepth: current.bundle.manifest.localContextBuildSpec.maxImpactDepth,
              }),
            });
          } catch (error) {
            throw new TaskEngineError(
              "context_build_failed",
              "The rebuilt repository context could not produce a Task Brief.",
              { taskId: input.taskId, stage: "context_draft" },
              { cause: error },
            );
          }
          return {
            snapshotId: repository.snapshot.snapshotId,
            brief: draft.brief,
            claims: draft.claims,
            evidence: draft.evidence,
            impactPaths: draft.impactPaths,
          };
        },
      );
    }
    if (input.action.type === "transition_status" && input.action.to === "verified") {
      const current = await this.#store.readTaskBundle(input.taskId);
      if ("impactConclusion" in current.bundle) {
        if (this.#strongChangeAuthority?.commitTaskVerified === undefined) {
          throw new TaskEngineError("capability_unavailable", "strong_write_locked");
        }
        if (current.bundle.manifest.revision === input.expectedRevision) {
          validateTaskVerifiedTransitionInternalV1(current);
        }
        return this.#strongChangeAuthority.commitTaskVerified(input, this.#clock().toISOString());
      }
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
    const analyzer = this.#contextProvider.analyzeTaskChanges;
    return checkTaskChange(
      this.#store,
      input,
      this.#clock,
      analyzer === undefined
        ? undefined
        : (analysisInput) => analyzer.call(this.#contextProvider, analysisInput),
    );
  }

  /**
   * Provider-gated evidence-backed Check. Public input contains only Task and
   * Snapshot assertions; Delta, Hunk, Symbol, Basis and IDs are obtained from
   * and revalidated against the strong authority.
   */
  async checkChanges(
    inputValue: StrongCheckChangesInputV1,
    auth: AuthorizationContext,
  ): Promise<StrongChangeCheckMutationOutcomeV1> {
    const input = StrongCheckChangesInputV1Schema.parse(inputValue);
    this.#authorize(auth, input.actor, "task:update");
    return executeStrongChangeCheckV1(
      this.#strongChangeAuthority,
      input,
      this.#clock,
    );
  }

  /**
   * Record an externally executed Verification result against the current
   * verification plan entry using the same durable Task mutation semantics.
   */
  async recordVerification(
    inputValue: import("@understand-code/contracts").RecordVerificationInputV1,
    auth: AuthorizationContext,
  ): Promise<VerificationMutationOutcome>;
  async recordVerification(
    inputValue: StrongRecordVerificationInputV1,
    auth: AuthorizationContext,
  ): Promise<StrongVerificationMutationOutcomeV1>;
  async recordVerification(
    inputValue:
      | import("@understand-code/contracts").RecordVerificationInputV1
      | StrongRecordVerificationInputV1,
    auth: AuthorizationContext,
  ): Promise<VerificationMutationOutcome | StrongVerificationMutationOutcomeV1> {
    if (
      typeof inputValue === "object" &&
      inputValue !== null &&
      "profile" in inputValue &&
      inputValue.profile === "record_verification_strong_v1"
    ) {
      const input = StrongRecordVerificationInputV1Schema.parse(inputValue);
      this.#authorize(auth, input.actor, "task:update");
      return executeStrongVerificationRecordV1(
        this.#strongChangeAuthority,
        input,
        this.#clock,
      );
    }
    const input = RecordVerificationInputV1Schema.parse(inputValue);
    this.#authorize(auth, input.actor, "task:update");
    return recordTaskVerification(this.#store, input, this.#clock);
  }

  async renderTaskBriefMarkdown(taskId: string): Promise<string> {
    const read = await this.#store.readTaskBundle(taskId);
    return renderTaskBriefMarkdown(read);
  }
}
