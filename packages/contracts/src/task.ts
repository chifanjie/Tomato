import { z } from "zod";

import { createArtifactEnvelopeV1Schema } from "./artifact-envelope.js";
import { canonicalizeJson } from "./canonical-json.js";
import {
  ActorSchema,
  ArtifactIdSchema,
  ClaimIdSchema,
  ContentDigestSchema,
  EventIdSchema,
  EvidenceIdSchema,
  FindingIdSchema,
  IdempotencyKeySchema,
  ImpactPathIdSchema,
  IsoTimestampSchema,
  NonEmptyStringSchema,
  OpaqueIdentifierSchema,
  PlannedChangeIdSchema,
  ProducerVersionSchema,
  RepositoryIdSchema,
  RepositoryRelativePathSchema,
  RevisionSchema,
  SchemaVersionV1Schema,
  SnapshotIdSchema,
  TaskIdSchema,
  VerificationRecordIdSchema,
  WorktreeIdSchema,
  type ContentDigest,
} from "./primitives.js";

const uniqueValues = (
  values: readonly string[],
  context: z.RefinementCtx,
  path: PropertyKey[],
  label: string,
): void => {
  if (new Set(values).size !== values.length) {
    context.addIssue({
      code: "custom",
      message: `${label} must not contain duplicate identifiers`,
      path,
    });
  }
};

const chronological = (
  earlier: string,
  later: string,
  context: z.RefinementCtx,
  path: PropertyKey[],
): void => {
  if (Date.parse(later) < Date.parse(earlier)) {
    context.addIssue({
      code: "custom",
      message: "timestamp must not precede the related creation timestamp",
      path,
    });
  }
};

export const TaskNormalStatusV1Schema = z.enum([
  "created",
  "context_ready",
  "planned",
  "in_progress",
  "check_required",
  "verification_required",
]);

export type TaskNormalStatusV1 = z.infer<typeof TaskNormalStatusV1Schema>;

export const TaskStatusV1Schema = z.enum([
  ...TaskNormalStatusV1Schema.options,
  "verified",
  "blocked",
  "stale",
  "superseded",
]);

export type TaskStatusV1 = z.infer<typeof TaskStatusV1Schema>;

export const TaskTransitionTargetV1Schema = z.enum([
  "context_ready",
  "planned",
  "in_progress",
  "check_required",
  "verification_required",
  "verified",
]);

export type TaskTransitionTargetV1 = z.infer<typeof TaskTransitionTargetV1Schema>;

export const TASK_ORDINARY_TRANSITIONS_V1 = Object.freeze({
  created: Object.freeze(["context_ready"] as const),
  context_ready: Object.freeze(["planned"] as const),
  planned: Object.freeze(["in_progress"] as const),
  in_progress: Object.freeze(["check_required"] as const),
  check_required: Object.freeze([
    "in_progress",
    "verification_required",
  ] as const),
  verification_required: Object.freeze([
    "in_progress",
    "check_required",
    "verified",
  ] as const),
  verified: Object.freeze([] as const),
  blocked: Object.freeze([] as const),
  stale: Object.freeze([] as const),
  superseded: Object.freeze([] as const),
} satisfies Readonly<Record<TaskStatusV1, readonly TaskStatusV1[]>>);

export function isTaskOrdinaryTransitionV1(
  from: TaskStatusV1,
  to: TaskStatusV1,
): boolean {
  return (TASK_ORDINARY_TRANSITIONS_V1[from] as readonly TaskStatusV1[])
    .includes(to);
}

export const TaskOrdinaryTransitionV1Schema = z.strictObject({
  from: TaskStatusV1Schema,
  to: TaskStatusV1Schema,
}).superRefine((transition, context) => {
  if (!isTaskOrdinaryTransitionV1(transition.from, transition.to)) {
    context.addIssue({
      code: "custom",
      message:
        "transition is not an ordinary Lifecycle V1 transition; use the dedicated exceptional action when applicable",
      path: ["to"],
    });
  }
});

export type TaskOrdinaryTransitionV1 = z.infer<
  typeof TaskOrdinaryTransitionV1Schema
>;

export const BlockedTaskStateV1Schema = z.strictObject({
  resumeStatus: TaskNormalStatusV1Schema,
  reasonCode: NonEmptyStringSchema,
  message: NonEmptyStringSchema,
  actor: ActorSchema,
  blockedAt: IsoTimestampSchema,
});

export type BlockedTaskStateV1 = z.infer<typeof BlockedTaskStateV1Schema>;

export const StaleTaskStateV1Schema = z.strictObject({
  staleFromStatus: z.union([TaskNormalStatusV1Schema, z.literal("blocked")]),
  reasonCodes: z.array(NonEmptyStringSchema).min(1),
  detectedAtSnapshotId: SnapshotIdSchema,
  detectedAt: IsoTimestampSchema,
}).superRefine((state, context) => {
  uniqueValues(state.reasonCodes, context, ["reasonCodes"], "reasonCodes");
});

export type StaleTaskStateV1 = z.infer<typeof StaleTaskStateV1Schema>;

export const TaskSupersessionV1Schema = z.strictObject({
  supersededFromStatus: z.union([
    TaskNormalStatusV1Schema,
    z.literal("blocked"),
    z.literal("stale"),
  ]),
  reason: NonEmptyStringSchema,
  replacementTaskId: TaskIdSchema.optional(),
  actor: ActorSchema,
  supersededAt: IsoTimestampSchema,
});

export type TaskSupersessionV1 = z.infer<typeof TaskSupersessionV1Schema>;

export const TaskManifestV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  taskId: TaskIdSchema,
  title: NonEmptyStringSchema,
  originalIntent: NonEmptyStringSchema,
  status: TaskStatusV1Schema,
  parentTaskId: TaskIdSchema.optional(),
  repositoryId: RepositoryIdSchema,
  worktreeId: WorktreeIdSchema,
  baselineSnapshotId: SnapshotIdSchema,
  latestSnapshotId: SnapshotIdSchema,
  currentChangeCheckId: OpaqueIdentifierSchema.optional(),
  currentChangeCheckRevision: RevisionSchema.optional(),
  blockedState: BlockedTaskStateV1Schema.optional(),
  staleState: StaleTaskStateV1Schema.optional(),
  supersession: TaskSupersessionV1Schema.optional(),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
  producerVersion: ProducerVersionSchema,
  revision: RevisionSchema,
}).superRefine((task, context) => {
  if (task.parentTaskId === task.taskId) {
    context.addIssue({
      code: "custom",
      message: "parentTaskId must not reference the task itself",
      path: ["parentTaskId"],
    });
  }
  if (task.supersession?.replacementTaskId === task.taskId) {
    context.addIssue({
      code: "custom",
      message: "replacementTaskId must not reference the task itself",
      path: ["supersession", "replacementTaskId"],
    });
  }
  if (
    (task.currentChangeCheckId === undefined) !==
    (task.currentChangeCheckRevision === undefined)
  ) {
    context.addIssue({
      code: "custom",
      message:
        "currentChangeCheckId and currentChangeCheckRevision must be present together",
      path: ["currentChangeCheckId"],
    });
  }
  const requiresCurrentCheck =
    task.status === "verification_required" || task.status === "verified";
  if (requiresCurrentCheck && task.currentChangeCheckId === undefined) {
    context.addIssue({
      code: "custom",
      message: `${task.status} Tasks require a canonical current Change Check`,
      path: ["currentChangeCheckId"],
    });
  }
  if (!requiresCurrentCheck && task.currentChangeCheckId !== undefined) {
    context.addIssue({
      code: "custom",
      message:
        "only verification_required or verified Tasks may retain a canonical current Change Check",
      path: ["currentChangeCheckId"],
    });
  }
  if (task.revision === 0) {
    context.addIssue({
      code: "custom",
      message: "a persisted Task Manifest must start at revision 1",
      path: ["revision"],
    });
  }

  const exceptionalFields = [
    ["blockedState", task.blockedState, task.status === "blocked"],
    ["staleState", task.staleState, task.status === "stale"],
    ["supersession", task.supersession, task.status === "superseded"],
  ] as const;
  for (const [field, value, required] of exceptionalFields) {
    if (required && value === undefined) {
      context.addIssue({
        code: "custom",
        message: `${field} is required when status is ${task.status}`,
        path: [field],
      });
    }
    if (!required && value !== undefined) {
      context.addIssue({
        code: "custom",
        message: `${field} is only allowed for its matching exceptional status`,
        path: [field],
      });
    }
  }
  if (
    task.blockedState !== undefined &&
    Date.parse(task.blockedState.blockedAt) > Date.parse(task.updatedAt)
  ) {
    context.addIssue({
      code: "custom",
      message: "blockedAt must not follow Task updatedAt",
      path: ["blockedState", "blockedAt"],
    });
  }
  if (
    task.staleState !== undefined &&
    Date.parse(task.staleState.detectedAt) > Date.parse(task.updatedAt)
  ) {
    context.addIssue({
      code: "custom",
      message: "stale detectedAt must not follow Task updatedAt",
      path: ["staleState", "detectedAt"],
    });
  }
  if (
    task.supersession !== undefined &&
    Date.parse(task.supersession.supersededAt) > Date.parse(task.updatedAt)
  ) {
    context.addIssue({
      code: "custom",
      message: "supersededAt must not follow Task updatedAt",
      path: ["supersession", "supersededAt"],
    });
  }

  chronological(task.createdAt, task.updatedAt, context, ["updatedAt"]);
});

export type TaskManifestV1 = z.infer<typeof TaskManifestV1Schema>;

export const TaskManifestArtifactV1Schema = createArtifactEnvelopeV1Schema(
  "task_manifest",
  TaskManifestV1Schema,
).superRefine((artifact, context) => {
  const equalityChecks = [
    ["taskId", artifact.taskId, artifact.payload.taskId],
    ["repositoryId", artifact.repositoryId, artifact.payload.repositoryId],
    ["worktreeId", artifact.worktreeId, artifact.payload.worktreeId],
    [
      "sourceSnapshotId",
      artifact.sourceSnapshotId,
      artifact.payload.latestSnapshotId,
    ],
    ["revision", artifact.revision, artifact.payload.revision],
    [
      "producerVersion",
      artifact.producerVersion,
      artifact.payload.producerVersion,
    ],
  ] as const;
  for (const [field, envelopeValue, payloadValue] of equalityChecks) {
    if (envelopeValue !== payloadValue) {
      context.addIssue({
        code: "custom",
        message: `${field} must match between Task Manifest envelope and payload`,
        path: [field],
      });
    }
  }
});

export type TaskManifestArtifactV1 = z.infer<
  typeof TaskManifestArtifactV1Schema
>;

export const CandidateLevelV1Schema = z.enum([
  "must_inspect",
  "likely_change",
  "possible_change",
  "test_or_verify",
  "context_only",
]);

export type CandidateLevelV1 = z.infer<typeof CandidateLevelV1Schema>;

export const ReadingPathEntryV1Schema = z.strictObject({
  id: OpaqueIdentifierSchema,
  order: z.number().int().nonnegative(),
  kind: z.enum(["file", "symbol", "impact_path"]),
  filePath: RepositoryRelativePathSchema.optional(),
  symbolId: OpaqueIdentifierSchema.optional(),
  impactPathId: ImpactPathIdSchema.optional(),
  claimIds: z.array(ClaimIdSchema).min(1),
  evidenceIds: z.array(EvidenceIdSchema),
}).superRefine((entry, context) => {
  const hasFile = entry.filePath !== undefined;
  const hasSymbol = entry.symbolId !== undefined;
  const hasImpactPath = entry.impactPathId !== undefined;

  if (entry.kind === "file" && (!hasFile || hasSymbol || hasImpactPath)) {
    context.addIssue({
      code: "custom",
      message: "file reading entries require only filePath",
      path: ["kind"],
    });
  }
  if (entry.kind === "symbol" && (!hasFile || !hasSymbol || hasImpactPath)) {
    context.addIssue({
      code: "custom",
      message: "symbol reading entries require filePath and symbolId",
      path: ["kind"],
    });
  }
  if (
    entry.kind === "impact_path" &&
    (!hasImpactPath || hasFile || hasSymbol)
  ) {
    context.addIssue({
      code: "custom",
      message: "impact_path reading entries require only impactPathId",
      path: ["impactPathId"],
    });
  }
  uniqueValues(entry.claimIds, context, ["claimIds"], "claimIds");
  uniqueValues(entry.evidenceIds, context, ["evidenceIds"], "evidenceIds");
});

export type ReadingPathEntryV1 = z.infer<typeof ReadingPathEntryV1Schema>;

export const PlannedChangeV1Schema = z.strictObject({
  id: PlannedChangeIdSchema,
  candidateLevel: CandidateLevelV1Schema,
  filePath: RepositoryRelativePathSchema,
  symbolId: OpaqueIdentifierSchema.optional(),
  intent: NonEmptyStringSchema,
  claimIds: z.array(ClaimIdSchema).min(1),
  impactPathIds: z.array(ImpactPathIdSchema),
}).superRefine((change, context) => {
  uniqueValues(change.claimIds, context, ["claimIds"], "claimIds");
  uniqueValues(change.impactPathIds, context, ["impactPathIds"], "impactPathIds");
});

export type PlannedChangeV1 = z.infer<typeof PlannedChangeV1Schema>;

export const VerificationMethodV1Schema = z.enum([
  "test",
  "build",
  "lint",
  "manual",
  "runtime",
]);

export type VerificationMethodV1 = z.infer<typeof VerificationMethodV1Schema>;

export const VerificationPlanEntryV1Schema = z.strictObject({
  id: OpaqueIdentifierSchema,
  acceptanceClaimIds: z.array(ClaimIdSchema).min(1),
  method: VerificationMethodV1Schema,
  description: NonEmptyStringSchema,
  required: z.boolean().default(true),
}).superRefine((entry, context) => {
  uniqueValues(
    entry.acceptanceClaimIds,
    context,
    ["acceptanceClaimIds"],
    "acceptanceClaimIds",
  );
});

export type VerificationPlanEntryV1 = z.infer<typeof VerificationPlanEntryV1Schema>;

export const TaskBriefV1Schema = z.strictObject({
  originalIntent: NonEmptyStringSchema,
  goalClaimId: ClaimIdSchema,
  nonGoalClaimIds: z.array(ClaimIdSchema),
  acceptanceClaimIds: z.array(ClaimIdSchema).min(1),
  readingPath: z.array(ReadingPathEntryV1Schema),
  plannedChanges: z.array(PlannedChangeV1Schema),
  assumptionClaimIds: z.array(ClaimIdSchema),
  riskClaimIds: z.array(ClaimIdSchema),
  unknownClaimIds: z.array(ClaimIdSchema),
  verificationPlan: z.array(VerificationPlanEntryV1Schema),
}).superRefine((brief, context) => {
  const identifierCollections: Array<[string, readonly string[]]> = [
    ["nonGoalClaimIds", brief.nonGoalClaimIds],
    ["acceptanceClaimIds", brief.acceptanceClaimIds],
    ["assumptionClaimIds", brief.assumptionClaimIds],
    ["riskClaimIds", brief.riskClaimIds],
    ["unknownClaimIds", brief.unknownClaimIds],
  ];
  for (const [field, values] of identifierCollections) {
    uniqueValues(values, context, [field], field);
  }
  uniqueValues(
    brief.readingPath.map((entry) => entry.id),
    context,
    ["readingPath"],
    "readingPath ids",
  );
  uniqueValues(
    brief.readingPath.map((entry) => String(entry.order)),
    context,
    ["readingPath"],
    "readingPath order",
  );
  uniqueValues(
    brief.plannedChanges.map((change) => change.id),
    context,
    ["plannedChanges"],
    "planned change ids",
  );
  uniqueValues(
    brief.verificationPlan.map((entry) => entry.id),
    context,
    ["verificationPlan"],
    "verification plan ids",
  );
});

export type TaskBriefV1 = z.infer<typeof TaskBriefV1Schema>;

export const TaskBriefArtifactV1Schema = createArtifactEnvelopeV1Schema(
  "task_brief",
  TaskBriefV1Schema,
);

export type TaskBriefArtifactV1 = z.infer<typeof TaskBriefArtifactV1Schema>;

export const MutationControlV1Schema = z.strictObject({
  expectedRevision: RevisionSchema,
  idempotencyKey: IdempotencyKeySchema,
  actor: ActorSchema,
});

export type MutationControlV1 = z.infer<typeof MutationControlV1Schema>;

export const OperationControlV1Schema = z.strictObject({
  expectedSourceSnapshotId: SnapshotIdSchema.optional(),
  idempotencyKey: IdempotencyKeySchema,
  actor: ActorSchema,
});

export type OperationControlV1 = z.infer<typeof OperationControlV1Schema>;

const ConfirmGoalActionV1Schema = z.strictObject({
  type: z.literal("confirm_goal"),
  claimId: ClaimIdSchema,
});

const ConfirmAcceptanceCriteriaActionV1Schema = z.strictObject({
  type: z.literal("confirm_acceptance_criteria"),
  claimIds: z.array(ClaimIdSchema).min(1),
});

const ConfirmPlanActionV1Schema = z.strictObject({
  type: z.literal("confirm_plan"),
  plannedChangeIds: z.array(PlannedChangeIdSchema).min(1),
});

const RecordAssumptionActionV1Schema = z.strictObject({
  type: z.literal("record_assumption"),
  claimId: ClaimIdSchema,
});

const ConfirmUnknownActionV1Schema = z.strictObject({
  type: z.literal("confirm_unknown"),
  claimId: ClaimIdSchema,
});

const TransitionStatusActionV1Schema = z.strictObject({
  type: z.literal("transition_status"),
  to: TaskTransitionTargetV1Schema,
});

const AcceptFindingActionV1Schema = z.strictObject({
  type: z.literal("accept_finding"),
  findingId: FindingIdSchema,
  reason: NonEmptyStringSchema,
});

const BlockTaskActionV1Schema = z.strictObject({
  type: z.literal("block_task"),
  reasonCode: NonEmptyStringSchema,
  message: NonEmptyStringSchema,
});

const ResumeTaskActionV1Schema = z.strictObject({
  type: z.literal("resume_task"),
});

const RefreshTaskContextActionV1Schema = z.strictObject({
  type: z.literal("refresh_task_context"),
  targetSnapshotId: SnapshotIdSchema,
});

const RebaseTaskActionV1Schema = z.strictObject({
  type: z.literal("rebase_task"),
  newBaselineSnapshotId: SnapshotIdSchema,
  reason: NonEmptyStringSchema,
});

const SupersedeTaskActionV1Schema = z.strictObject({
  type: z.literal("supersede_task"),
  reason: NonEmptyStringSchema,
  replacementTaskId: TaskIdSchema.optional(),
});

const AcceptVerificationSkipActionV1Schema = z.strictObject({
  type: z.literal("accept_verification_skip"),
  verificationRecordId: VerificationRecordIdSchema,
  reason: NonEmptyStringSchema,
});

export const UpdateTaskActionV1Schema = z.discriminatedUnion("type", [
  ConfirmGoalActionV1Schema,
  ConfirmAcceptanceCriteriaActionV1Schema,
  ConfirmPlanActionV1Schema,
  RecordAssumptionActionV1Schema,
  ConfirmUnknownActionV1Schema,
  TransitionStatusActionV1Schema,
  AcceptFindingActionV1Schema,
  BlockTaskActionV1Schema,
  ResumeTaskActionV1Schema,
  RefreshTaskContextActionV1Schema,
  RebaseTaskActionV1Schema,
  SupersedeTaskActionV1Schema,
  AcceptVerificationSkipActionV1Schema,
]);

export type UpdateTaskActionV1 = z.infer<typeof UpdateTaskActionV1Schema>;

export const UpdateTaskInputV1Schema = z.strictObject({
  taskId: TaskIdSchema,
  action: UpdateTaskActionV1Schema,
  expectedRevision: RevisionSchema,
  idempotencyKey: IdempotencyKeySchema,
  actor: ActorSchema,
}).superRefine((input, context) => {
  if (
    input.action.type === "supersede_task" &&
    input.action.replacementTaskId === input.taskId
  ) {
    context.addIssue({
      code: "custom",
      message: "replacementTaskId must not reference the Task being superseded",
      path: ["action", "replacementTaskId"],
    });
  }
});

export type UpdateTaskInputV1 = z.infer<typeof UpdateTaskInputV1Schema>;

export const MutationResultV1Schema = z.strictObject({
  taskId: TaskIdSchema,
  revision: RevisionSchema,
  eventId: EventIdSchema,
  artifactIds: z.array(ArtifactIdSchema),
  idempotentReplay: z.boolean(),
});

export type MutationResultV1 = z.infer<typeof MutationResultV1Schema>;

const TaskCreatedEventActionV1Schema = z.strictObject({
  type: z.literal("task_created"),
});

const ChangeCheckedEventActionV1Schema = z.strictObject({
  type: z.literal("change_checked"),
  changeCheckArtifactId: ArtifactIdSchema,
  changeCheckId: OpaqueIdentifierSchema,
});

const VerificationRecordedEventActionV1Schema = z.strictObject({
  type: z.literal("verification_recorded"),
  verificationRecordId: VerificationRecordIdSchema,
});

const TaskContextStaledEventActionV1Schema = z.strictObject({
  type: z.literal("task_context_staled"),
  reasonCodes: z.array(NonEmptyStringSchema).min(1),
  detectedAtSnapshotId: SnapshotIdSchema,
});

export const TaskEventActionV1Schema = z.discriminatedUnion("type", [
  ...UpdateTaskActionV1Schema.options,
  TaskCreatedEventActionV1Schema,
  ChangeCheckedEventActionV1Schema,
  VerificationRecordedEventActionV1Schema,
  TaskContextStaledEventActionV1Schema,
]);

export type TaskEventActionV1 = z.infer<typeof TaskEventActionV1Schema>;

export const TaskEventV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  eventId: EventIdSchema,
  repositoryId: RepositoryIdSchema,
  worktreeId: WorktreeIdSchema,
  taskId: TaskIdSchema,
  previousRevision: RevisionSchema,
  revision: RevisionSchema,
  actor: ActorSchema,
  idempotencyKey: IdempotencyKeySchema,
  requestDigest: ContentDigestSchema,
  sourceSnapshotId: SnapshotIdSchema.optional(),
  occurredAt: IsoTimestampSchema,
  previousStatus: TaskStatusV1Schema.optional(),
  resultingStatus: TaskStatusV1Schema,
  action: TaskEventActionV1Schema,
  previousEventDigest: ContentDigestSchema.optional(),
  eventDigest: ContentDigestSchema,
}).superRefine((event, context) => {
  if (event.revision !== event.previousRevision + 1) {
    context.addIssue({
      code: "custom",
      message: "a committed event must increment revision exactly once",
      path: ["revision"],
    });
  }
  if (event.previousRevision === 0 && event.previousEventDigest !== undefined) {
    context.addIssue({
      code: "custom",
      message: "the first event must not declare a previous event digest",
      path: ["previousEventDigest"],
    });
  }
  if (event.previousRevision > 0 && event.previousEventDigest === undefined) {
    context.addIssue({
      code: "custom",
      message: "non-initial events require previousEventDigest",
      path: ["previousEventDigest"],
    });
  }
  if (
    (event.action.type === "task_created") !==
    (event.previousRevision === 0)
  ) {
    context.addIssue({
      code: "custom",
      message: "task_created must be the unique first task event",
      path: ["action", "type"],
    });
  }
  if (event.previousRevision === 0) {
    if (
      event.previousStatus !== undefined ||
      event.resultingStatus !== "created"
    ) {
      context.addIssue({
        code: "custom",
        message:
          "task_created must start without previousStatus and result in created",
        path: ["resultingStatus"],
      });
    }
    return;
  }
  if (event.previousStatus === undefined) {
    context.addIssue({
      code: "custom",
      message: "non-initial events require previousStatus",
      path: ["previousStatus"],
    });
    return;
  }
  if (
    event.previousStatus === "verified" ||
    event.previousStatus === "superseded"
  ) {
    context.addIssue({
      code: "custom",
      message: "terminal Tasks cannot accept another Event",
      path: ["previousStatus"],
    });
  }

  const action = event.action;
  const unchangedActions = new Set([
    "confirm_goal",
    "confirm_acceptance_criteria",
    "confirm_plan",
    "record_assumption",
    "confirm_unknown",
    "accept_finding",
    "accept_verification_skip",
    "change_checked",
    "verification_recorded",
  ]);
  if (
    unchangedActions.has(action.type) &&
    event.resultingStatus !== event.previousStatus
  ) {
    context.addIssue({
      code: "custom",
      message: `${action.type} must not change Task status`,
      path: ["resultingStatus"],
    });
  }
  if (
    action.type === "change_checked" &&
    event.previousStatus !== "check_required"
  ) {
    context.addIssue({
      code: "custom",
      message:
        "change_checked requires a check_required Task and must preserve that status",
      path: ["previousStatus"],
    });
  }
  if (
    action.type === "verification_recorded" &&
    event.previousStatus !== "verification_required"
  ) {
    context.addIssue({
      code: "custom",
      message:
        "verification_recorded requires a verification_required Task and must preserve that status",
      path: ["previousStatus"],
    });
  }
  if (
    action.type === "transition_status" &&
    (event.resultingStatus !== action.to ||
      !isTaskOrdinaryTransitionV1(event.previousStatus, action.to))
  ) {
    context.addIssue({
      code: "custom",
      message: "transition_status must follow the ordinary Lifecycle V1 table",
      path: ["resultingStatus"],
    });
  }
  if (
    action.type === "block_task" &&
    (!TaskNormalStatusV1Schema.safeParse(event.previousStatus).success ||
      event.resultingStatus !== "blocked")
  ) {
    context.addIssue({
      code: "custom",
      message: "block_task must move a normal active Task to blocked",
      path: ["resultingStatus"],
    });
  }
  if (
    action.type === "resume_task" &&
    (event.previousStatus !== "blocked" ||
      !TaskNormalStatusV1Schema.safeParse(event.resultingStatus).success)
  ) {
    context.addIssue({
      code: "custom",
      message: "resume_task must restore blocked to a normal status",
      path: ["resultingStatus"],
    });
  }
  if (
    (action.type === "refresh_task_context" ||
      action.type === "rebase_task") &&
    (event.previousStatus !== "stale" ||
      event.resultingStatus !== "context_ready")
  ) {
    context.addIssue({
      code: "custom",
      message: `${action.type} must move stale to context_ready`,
      path: ["resultingStatus"],
    });
  }
  if (
    action.type === "supersede_task" &&
    event.resultingStatus !== "superseded"
  ) {
    context.addIssue({
      code: "custom",
      message: "supersede_task must result in superseded",
      path: ["resultingStatus"],
    });
  }
  if (
    action.type === "task_context_staled" &&
    (event.resultingStatus !== "stale" ||
      event.previousStatus === "stale" ||
      event.previousStatus === "superseded" ||
      event.previousStatus === "verified")
  ) {
    context.addIssue({
      code: "custom",
      message:
        "task_context_staled must move a non-terminal, non-stale Task to stale",
      path: ["resultingStatus"],
    });
  }
});

export type TaskEventV1 = z.infer<typeof TaskEventV1Schema>;

/**
 * Returns the portable canonical digest input for one Task Event.
 *
 * The stored eventDigest is excluded; previousEventDigest remains part of the
 * signed input so each digest commits to the preceding Event.
 */
export function canonicalTaskEventDigestJsonV1(event: TaskEventV1): string {
  const digestInput: Record<string, unknown> = { ...event };
  delete digestInput.eventDigest;
  return canonicalizeJson(digestInput);
}

export type TaskEventLogIntegrityIssueV1 =
  | {
      code: "event_digest_mismatch";
      eventIndex: number;
      eventId: string;
      storedDigest: ContentDigest;
      computedDigest: ContentDigest;
      message: string;
    }
  | {
      code: "previous_event_digest_mismatch";
      eventIndex: number;
      eventId: string;
      expectedPreviousDigest?: ContentDigest;
      actualPreviousDigest?: ContentDigest;
      message: string;
    };

export interface TaskEventLogIntegrityResultV1 {
  valid: boolean;
  issues: TaskEventLogIntegrityIssueV1[];
}

/**
 * Recomputes every Event digest and verifies the stored previous-digest chain.
 * SHA-256 is supplied by the host so Contracts remains portable.
 */
export function verifyTaskEventLogIntegrityV1(
  events: readonly TaskEventV1[],
  digestCanonicalJson: (canonicalEventJson: string) => string,
): TaskEventLogIntegrityResultV1 {
  const issues: TaskEventLogIntegrityIssueV1[] = [];

  events.forEach((event, eventIndex) => {
    const computedDigest = ContentDigestSchema.parse(
      digestCanonicalJson(canonicalTaskEventDigestJsonV1(event)),
    );
    if (event.eventDigest !== computedDigest) {
      issues.push({
        code: "event_digest_mismatch",
        eventIndex,
        eventId: event.eventId,
        storedDigest: event.eventDigest,
        computedDigest,
        message: `Task Event ${event.eventId} digest does not match its canonical content`,
      });
    }

    const expectedPreviousDigest = events[eventIndex - 1]?.eventDigest;
    if (event.previousEventDigest !== expectedPreviousDigest) {
      issues.push({
        code: "previous_event_digest_mismatch",
        eventIndex,
        eventId: event.eventId,
        ...(expectedPreviousDigest === undefined
          ? {}
          : { expectedPreviousDigest }),
        ...(event.previousEventDigest === undefined
          ? {}
          : { actualPreviousDigest: event.previousEventDigest }),
        message: `Task Event ${event.eventId} previousEventDigest does not match the preceding Event`,
      });
    }
  });

  return { valid: issues.length === 0, issues };
}

export const IdempotencyScopeV1Schema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("task_create"),
    createScope: NonEmptyStringSchema,
  }),
  z.strictObject({
    kind: z.literal("task"),
    taskId: TaskIdSchema,
  }),
]);

export type IdempotencyScopeV1 = z.infer<typeof IdempotencyScopeV1Schema>;

export const IdempotencyRecordV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  worktreeId: WorktreeIdSchema,
  scope: IdempotencyScopeV1Schema,
  idempotencyKey: IdempotencyKeySchema,
  actor: ActorSchema,
  requestDigest: ContentDigestSchema,
  taskId: TaskIdSchema,
  resultRevision: RevisionSchema,
  eventId: EventIdSchema,
  resultDigest: ContentDigestSchema,
  createdAt: IsoTimestampSchema,
});

export type IdempotencyRecordV1 = z.infer<typeof IdempotencyRecordV1Schema>;
