import { z } from "zod";

import {
  ChangeCheckV1Schema,
  CheckChangeInputV1Schema,
  ImpactPathV1Schema,
  RecordVerificationInputV1Schema,
  VerificationRecordV1Schema,
} from "./change.js";
import { EvidenceV1Schema } from "./evidence.js";
import {
  ActorSchema,
  ClaimIdSchema,
  ContentDigestSchema,
  EvidenceIdSchema,
  FindingIdSchema,
  GitObjectIdSchema,
  IdempotencyKeySchema,
  ImpactPathIdSchema,
  IsoTimestampSchema,
  NonEmptyStringSchema,
  OpaqueIdentifierSchema,
  ProducerVersionSchema,
  RepositoryIdSchema,
  RepositoryRelativePathSchema,
  RevisionSchema,
  SchemaVersionV1Schema,
  SnapshotIdSchema,
  TaskIdSchema,
  VerificationRecordIdSchema,
  WorktreeIdSchema,
} from "./primitives.js";
import {
  RepoPulseStatusV1Schema,
  RepoPulseV1Schema,
} from "./repository.js";
import {
  MutationResultV1Schema,
  PlannedChangeV1Schema,
  ReadingPathEntryV1Schema,
  TaskBriefV1Schema,
  TaskManifestV1Schema,
  TaskTransitionTargetV1Schema,
  UpdateTaskInputV1Schema,
  VerificationPlanEntryV1Schema,
} from "./task.js";

const uniqueValues = (
  values: readonly string[],
  context: z.RefinementCtx,
  path: PropertyKey[],
  label: string,
): void => {
  if (new Set(values).size !== values.length) {
    context.addIssue({
      code: "custom",
      message: `${label} must not contain duplicates`,
      path,
    });
  }
};

export const CursorV1Schema = z
  .string()
  .min(1)
  .max(4_096)
  .refine(
    (value) => !/[\u0000-\u001f\u007f]/u.test(value),
    "cursor must not contain control characters",
  );

export type CursorV1 = z.infer<typeof CursorV1Schema>;

export const PageRequestV1Schema = z.strictObject({
  cursor: CursorV1Schema.optional(),
  pageSize: z.number().int().min(1).max(200).optional(),
});

export type PageRequestV1 = z.infer<typeof PageRequestV1Schema>;

export const PageInfoV1Schema = z
  .strictObject({
    pageSize: z.number().int().min(1).max(200),
    returned: z.number().int().nonnegative(),
    total: z.number().int().nonnegative().optional(),
    nextCursor: CursorV1Schema.optional(),
    hasMore: z.boolean(),
  })
  .superRefine((page, context) => {
    if (page.returned > page.pageSize) {
      context.addIssue({
        code: "custom",
        message: "returned must not exceed pageSize",
        path: ["returned"],
      });
    }
    if (page.total !== undefined && page.returned > page.total) {
      context.addIssue({
        code: "custom",
        message: "returned must not exceed total",
        path: ["returned"],
      });
    }
    if (page.hasMore !== (page.nextCursor !== undefined)) {
      context.addIssue({
        code: "custom",
        message: "hasMore and nextCursor must describe the same continuation state",
        path: ["hasMore"],
      });
    }
  });

export type PageInfoV1 = z.infer<typeof PageInfoV1Schema>;

export const ToolSuccessMetaV1Schema = z
  .strictObject({
    repositoryId: RepositoryIdSchema,
    worktreeId: WorktreeIdSchema,
    sourceSnapshotId: SnapshotIdSchema,
    headCommit: GitObjectIdSchema.nullable(),
    worktreeFingerprint: ContentDigestSchema,
    freshness: RepoPulseStatusV1Schema,
    durationMs: z.number().nonnegative(),
    cacheHit: z.boolean(),
    truncated: z.boolean(),
    truncatedCategories: z.array(NonEmptyStringSchema),
  })
  .superRefine((meta, context) => {
    uniqueValues(
      meta.truncatedCategories,
      context,
      ["truncatedCategories"],
      "truncatedCategories",
    );
    if (meta.truncated !== (meta.truncatedCategories.length > 0)) {
      context.addIssue({
        code: "custom",
        message:
          "truncated must be true exactly when truncatedCategories is non-empty",
        path: ["truncated"],
      });
    }
  });

export type ToolSuccessMetaV1 = z.infer<typeof ToolSuccessMetaV1Schema>;

const ABSOLUTE_FILESYSTEM_PATH_PATTERNS_V1 = Object.freeze([
  // A POSIX path may be surrounded by arbitrary prose punctuation. Excluding
  // '/' immediately before the leading slash plus the (?!/) guard avoids
  // treating the slashes in an ordinary URI such as https://example.test as a
  // local path while still rejecting labels such as path:/private/repository.
  /(?:^|[^A-Za-z0-9/])\/(?!\/)[^\s"'`<>{}\[\]]+/u,
  /(?:^|[^A-Za-z0-9])[A-Za-z]:[\\/][^\s"'`<>{}\[\]]+/u,
  /(?:^|[^\\])\\\\[^\\\s"'`<>{}\[\]]+\\[^\\\s"'`<>{}\[\]]+/u,
  /\bfile:\/\/[^\s"'`<>{}\[\]]+/iu,
]);

export function containsAbsoluteFilesystemPathV1(value: string): boolean {
  return ABSOLUTE_FILESYSTEM_PATH_PATTERNS_V1.some((pattern) =>
    pattern.test(value),
  );
}

export const PublicToolTextV1Schema = NonEmptyStringSchema.max(2_048).refine(
  (value) => !containsAbsoluteFilesystemPathV1(value),
  "tool text must not expose an absolute filesystem path",
);

export type PublicToolTextV1 = z.infer<typeof PublicToolTextV1Schema>;

export const McpTextContentV1Schema = z.strictObject({
  type: z.literal("text"),
  text: PublicToolTextV1Schema,
});

export type McpTextContentV1 = z.infer<typeof McpTextContentV1Schema>;

export const createMcpToolSuccessResultV1Schema = <
  PayloadSchema extends z.ZodType,
>(
  payloadSchema: PayloadSchema,
) =>
  z.strictObject({
    isError: z.literal(false).optional(),
    content: z.array(McpTextContentV1Schema).min(1),
    structuredContent: z.strictObject({
      schemaVersion: SchemaVersionV1Schema,
      meta: ToolSuccessMetaV1Schema,
      result: payloadSchema,
    }),
  });

export const createPagedMcpToolSuccessResultV1Schema = <
  PayloadSchema extends z.ZodType,
>(
  payloadSchema: PayloadSchema,
  itemCount: (payload: z.output<PayloadSchema>) => number,
) =>
  z.strictObject({
    isError: z.literal(false).optional(),
    content: z.array(McpTextContentV1Schema).min(1),
    structuredContent: z.strictObject({
      schemaVersion: SchemaVersionV1Schema,
      meta: ToolSuccessMetaV1Schema,
      page: PageInfoV1Schema,
      result: payloadSchema,
    }),
  }).superRefine((output, context) => {
    const structuredContent = output.structuredContent as {
      page: { returned: number };
      result: z.output<PayloadSchema>;
    };
    const actualCount = itemCount(structuredContent.result);
    if (structuredContent.page.returned !== actualCount) {
      context.addIssue({
        code: "custom",
        message: "page.returned must equal the number of returned result items",
        path: ["structuredContent", "page", "returned"],
      });
    }
  });

export const WorkspaceBindingReasonV1Schema = z.enum([
  "root_conflict",
  "root_missing",
  "root_not_directory",
  "root_unavailable",
  "root_not_allowed",
  "secondary_session_required",
]);

export type WorkspaceBindingReasonV1 = z.infer<
  typeof WorkspaceBindingReasonV1Schema
>;

const WorkspaceBindingRequiredErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("workspace_binding_required"),
  details: z.strictObject({
    reason: WorkspaceBindingReasonV1Schema,
  }),
});

const InvalidArgumentsErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("invalid_arguments"),
  details: z.strictObject({
    issues: z
      .array(
        z.strictObject({
          path: z.array(z.union([z.string(), z.number().int()])),
          code: OpaqueIdentifierSchema,
          message: NonEmptyStringSchema.max(1_024),
        }),
      )
      .min(1),
  }),
});

const RepositoryNotReadyErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("repository_not_ready"),
  details: z.strictObject({
    status: RepoPulseStatusV1Schema,
    missingArtifacts: z.array(OpaqueIdentifierSchema),
    recommendedAction: z.enum([
      "refresh_index",
      "wait_for_refresh",
      "repair_environment",
      "continue_degraded",
    ]),
  }),
});

const ResourceNotFoundErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("resource_not_found"),
  details: z.strictObject({
    resourceKind: z.enum([
      "task",
      "artifact",
      "snapshot",
      "claim",
      "evidence",
      "finding",
      "verification",
      "node",
    ]),
    resourceId: OpaqueIdentifierSchema,
  }),
});

const RevisionConflictErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("revision_conflict"),
  details: z.strictObject({
    taskId: TaskIdSchema,
    expectedRevision: RevisionSchema,
    actualRevision: RevisionSchema,
  }),
});

const IdempotencyConflictErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("idempotency_conflict"),
  details: z.strictObject({
    idempotencyKey: IdempotencyKeySchema,
    requestDigest: ContentDigestSchema,
    existingRequestDigest: ContentDigestSchema,
  }),
});

const ArtifactUnavailableErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("artifact_unavailable"),
  details: z.strictObject({
    artifactId: OpaqueIdentifierSchema.optional(),
    reason: z.enum(["missing", "stale", "corrupt", "unsupported_schema"]),
    lastAvailableSnapshotId: SnapshotIdSchema.optional(),
  }),
});

const SchemaIncompatibleErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("schema_incompatible"),
  details: z.strictObject({
    artifactType: OpaqueIdentifierSchema,
    foundVersion: z.union([
      z.number().int().nonnegative(),
      z.string().min(1).max(64),
    ]),
    supportedVersions: z
      .array(
        z.union([
          z.number().int().nonnegative(),
          z.string().min(1).max(64),
        ]),
      )
      .min(1),
  }),
});

const TaskTransitionRejectedErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("task_transition_rejected"),
  details: z.strictObject({
    taskId: TaskIdSchema,
    currentStatus: z.enum([
      "created",
      "context_ready",
      "planned",
      "in_progress",
      "check_required",
      "verification_required",
      "verified",
      "blocked",
      "stale",
      "superseded",
    ]),
    requestedAction: OpaqueIdentifierSchema,
    guard: z.enum([
      "transition_not_allowed",
      "terminal_state",
    ]),
    allowedActions: z.array(OpaqueIdentifierSchema),
  }),
});

const TaskGateUnsatisfiedErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("task_gate_unsatisfied"),
  details: z.strictObject({
    taskId: TaskIdSchema,
    targetStatus: TaskTransitionTargetV1Schema,
    failedGuards: z
      .array(
        z.strictObject({
          code: z.enum([
            "context_not_ready",
            "goal_not_confirmed",
            "acceptance_not_confirmed",
            "plan_not_confirmed",
            "worktree_binding_invalid",
            "snapshot_not_current",
            "current_check_required",
            "blocking_finding",
            "verification_required",
            "verification_failed",
            "verification_blocked",
            "verification_flaky",
            "freshness_invalid",
            "blocker_unresolved",
          ]),
          resourceId: OpaqueIdentifierSchema.optional(),
        }),
      )
      .min(1),
  }),
});

const ActionNotAuthorizedErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("action_not_authorized"),
  details: z.strictObject({
    taskId: TaskIdSchema.optional(),
    action: OpaqueIdentifierSchema,
    reason: z.enum([
      "actor_not_allowed",
      "capability_required",
      "owner_confirmation_required",
    ]),
  }),
});

const SourceAccessDeniedErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("source_access_denied"),
  details: z.strictObject({
    reason: z.enum([
      "outside_root",
      "hard_denied",
      "symlink_escape",
      "binary",
      "too_large",
      "redacted",
    ]),
  }),
});

const OperationCancelledErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("operation_cancelled"),
  details: z.strictObject({
    operationId: OpaqueIdentifierSchema,
    lastAvailableSnapshotId: SnapshotIdSchema.optional(),
  }),
});

const RefreshFailedErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("refresh_failed"),
  details: z.strictObject({
    operationId: OpaqueIdentifierSchema,
    stage: OpaqueIdentifierSchema,
    errorId: OpaqueIdentifierSchema,
    lastAvailableSnapshotId: SnapshotIdSchema.optional(),
  }),
});

const WorkbenchBusyErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("workbench_busy"),
  details: z.strictObject({
    errorId: OpaqueIdentifierSchema,
  }),
});

const WorkbenchStartTimeoutErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("workbench_start_timeout"),
  details: z.strictObject({
    errorId: OpaqueIdentifierSchema,
  }),
});

const WorkbenchControlUnavailableErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("workbench_control_unavailable"),
  details: z.strictObject({
    errorId: OpaqueIdentifierSchema,
  }),
});

const WorkbenchIdentityMismatchErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("workbench_identity_mismatch"),
  details: z.strictObject({
    errorId: OpaqueIdentifierSchema,
  }),
});

const InternalErrorV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  code: z.literal("internal_error"),
  details: z.strictObject({
    errorId: OpaqueIdentifierSchema,
  }),
});

function validatePublicErrorDetailsV1(
  value: unknown,
  context: z.RefinementCtx,
  path: PropertyKey[] = [],
): void {
  if (typeof value === "string") {
    if (containsAbsoluteFilesystemPathV1(value)) {
      context.addIssue({
        code: "custom",
        message: "tool error details must not expose an absolute filesystem path",
        path,
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      validatePublicErrorDetailsV1(entry, context, [...path, index]),
    );
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      validatePublicErrorDetailsV1(entry, context, [...path, key]);
    }
  }
}

export const ToolErrorEnvelopeV1Schema = z
  .discriminatedUnion("code", [
    WorkspaceBindingRequiredErrorV1Schema,
    InvalidArgumentsErrorV1Schema,
    RepositoryNotReadyErrorV1Schema,
    ResourceNotFoundErrorV1Schema,
    RevisionConflictErrorV1Schema,
    IdempotencyConflictErrorV1Schema,
    TaskTransitionRejectedErrorV1Schema,
    TaskGateUnsatisfiedErrorV1Schema,
    ActionNotAuthorizedErrorV1Schema,
    ArtifactUnavailableErrorV1Schema,
    SchemaIncompatibleErrorV1Schema,
    SourceAccessDeniedErrorV1Schema,
    OperationCancelledErrorV1Schema,
    RefreshFailedErrorV1Schema,
    WorkbenchBusyErrorV1Schema,
    WorkbenchStartTimeoutErrorV1Schema,
    WorkbenchControlUnavailableErrorV1Schema,
    WorkbenchIdentityMismatchErrorV1Schema,
    InternalErrorV1Schema,
  ])
  .superRefine((error, context) => {
    validatePublicErrorDetailsV1(error.details, context, ["details"]);
  });

export type ToolErrorEnvelopeV1 = z.infer<typeof ToolErrorEnvelopeV1Schema>;

export const McpToolErrorResultV1Schema = z.strictObject({
  isError: z.literal(true),
  content: z.array(McpTextContentV1Schema).min(1),
  structuredContent: z.strictObject({
    error: ToolErrorEnvelopeV1Schema,
  }),
});

export type McpToolErrorResultV1 = z.infer<
  typeof McpToolErrorResultV1Schema
>;

export const GetRepoPulseInputV1Schema = z.strictObject({});

export const GetRepoPulseResultV1Schema = z.strictObject({
  pulse: RepoPulseV1Schema,
});

export type GetRepoPulseResultV1 = z.infer<
  typeof GetRepoPulseResultV1Schema
>;

export const GetRepoPulseOutputV1Schema =
  createMcpToolSuccessResultV1Schema(GetRepoPulseResultV1Schema).superRefine(
    (output, context) => {
      if (
        output.structuredContent.meta.sourceSnapshotId !==
        output.structuredContent.result.pulse.evaluatedSnapshotId
      ) {
        context.addIssue({
          code: "custom",
          message: "MCP meta snapshot must match Repo Pulse evaluatedSnapshotId",
          path: ["structuredContent", "meta", "sourceSnapshotId"],
        });
      }
    },
  );

export type GetRepoPulseInputV1 = z.input<
  typeof GetRepoPulseInputV1Schema
>;
export type GetRepoPulseOutputV1 = z.output<
  typeof GetRepoPulseOutputV1Schema
>;

export const BuildTaskBriefInputV1Schema = z.strictObject({
  task: NonEmptyStringSchema.max(32_768),
  expectedRevision: z.literal(0),
  idempotencyKey: IdempotencyKeySchema,
  actor: ActorSchema,
  baseRef: NonEmptyStringSchema.max(1_024).optional(),
  scope: z.array(RepositoryRelativePathSchema).max(200).optional(),
  tokenBudget: z.number().int().min(256).max(100_000).optional(),
  maxCandidates: z.number().int().min(1).max(500).optional(),
  maxImpactDepth: z.number().int().min(1).max(20).optional(),
});

export const BuildTaskBriefResultV1Schema = z.strictObject({
  task: TaskManifestV1Schema,
  brief: TaskBriefV1Schema,
  mutation: MutationResultV1Schema,
  claimIds: z.array(ClaimIdSchema),
  evidenceIds: z.array(EvidenceIdSchema),
});

export type BuildTaskBriefResultV1 = z.infer<
  typeof BuildTaskBriefResultV1Schema
>;

export const BuildTaskBriefOutputV1Schema =
  createMcpToolSuccessResultV1Schema(BuildTaskBriefResultV1Schema).superRefine(
    (output, context) => {
      const { meta, result } = output.structuredContent;
      if (
        result.task.taskId !== result.mutation.taskId ||
        result.task.revision !== result.mutation.revision ||
        result.task.repositoryId !== meta.repositoryId ||
        result.task.worktreeId !== meta.worktreeId ||
        result.task.latestSnapshotId !== meta.sourceSnapshotId
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Task, mutation, and MCP meta identities must match in build_task_brief output",
          path: ["structuredContent", "result"],
        });
      }
    },
  );

export type BuildTaskBriefInputV1 = z.input<
  typeof BuildTaskBriefInputV1Schema
>;
export type BuildTaskBriefOutputV1 = z.output<
  typeof BuildTaskBriefOutputV1Schema
>;

export const TaskBriefSectionV1Schema = z.enum([
  "summary",
  "goals",
  "reading_path",
  "planned_changes",
  "assumptions",
  "risks",
  "unknowns",
  "verification_plan",
]);

export type TaskBriefSectionV1 = z.infer<
  typeof TaskBriefSectionV1Schema
>;

const TaskBriefClaimReferenceV1Schema = z.strictObject({
  kind: z.literal("claim_reference"),
  role: z.enum([
    "goal",
    "non_goal",
    "acceptance",
    "assumption",
    "risk",
    "unknown",
  ]),
  claimId: ClaimIdSchema,
});

const TaskBriefReadingPathItemV1Schema = z.strictObject({
  kind: z.literal("reading_path"),
  entry: ReadingPathEntryV1Schema,
});

const TaskBriefPlannedChangeItemV1Schema = z.strictObject({
  kind: z.literal("planned_change"),
  change: PlannedChangeV1Schema,
});

const TaskBriefVerificationPlanItemV1Schema = z.strictObject({
  kind: z.literal("verification_plan"),
  entry: VerificationPlanEntryV1Schema,
});

const TaskBriefSummaryItemV1Schema = z.strictObject({
  kind: z.literal("summary"),
  originalIntent: NonEmptyStringSchema,
  goalClaimId: ClaimIdSchema,
  acceptanceClaimCount: z.number().int().nonnegative(),
  plannedChangeCount: z.number().int().nonnegative(),
});

export const TaskBriefPageItemV1Schema = z.discriminatedUnion("kind", [
  TaskBriefClaimReferenceV1Schema,
  TaskBriefReadingPathItemV1Schema,
  TaskBriefPlannedChangeItemV1Schema,
  TaskBriefVerificationPlanItemV1Schema,
  TaskBriefSummaryItemV1Schema,
]);

export type TaskBriefPageItemV1 = z.infer<
  typeof TaskBriefPageItemV1Schema
>;

export const GetTaskBriefInputV1Schema = z.strictObject({
  taskId: TaskIdSchema,
  section: TaskBriefSectionV1Schema,
  cursor: CursorV1Schema.optional(),
  pageSize: z.number().int().min(1).max(200).optional(),
});

export const GetTaskBriefResultV1Schema = z.strictObject({
  task: TaskManifestV1Schema,
  section: TaskBriefSectionV1Schema,
  items: z.array(TaskBriefPageItemV1Schema),
}).superRefine((result, context) => {
  const allowedKinds: Record<
    z.infer<typeof TaskBriefSectionV1Schema>,
    readonly z.infer<typeof TaskBriefPageItemV1Schema>["kind"][]
  > = {
    summary: ["summary"],
    goals: ["claim_reference"],
    reading_path: ["reading_path"],
    planned_changes: ["planned_change"],
    assumptions: ["claim_reference"],
    risks: ["claim_reference"],
    unknowns: ["claim_reference"],
    verification_plan: ["verification_plan"],
  };
  result.items.forEach((item, index) => {
    if (!allowedKinds[result.section].includes(item.kind)) {
      context.addIssue({
        code: "custom",
        message: `${item.kind} items do not belong to section ${result.section}`,
        path: ["items", index, "kind"],
      });
    }
    if (item.kind === "claim_reference") {
      const expectedRoles: Partial<
        Record<
          z.infer<typeof TaskBriefSectionV1Schema>,
          readonly z.infer<typeof TaskBriefClaimReferenceV1Schema>["role"][]
        >
      > = {
        goals: ["goal", "non_goal", "acceptance"],
        assumptions: ["assumption"],
        risks: ["risk"],
        unknowns: ["unknown"],
      };
      if (!(expectedRoles[result.section] ?? []).includes(item.role)) {
        context.addIssue({
          code: "custom",
          message: `${item.role} Claim does not belong to section ${result.section}`,
          path: ["items", index, "role"],
        });
      }
    }
  });
});

export const GetTaskBriefOutputV1Schema =
  createPagedMcpToolSuccessResultV1Schema(
    GetTaskBriefResultV1Schema,
    (result) => result.items.length,
  ).superRefine((output, context) => {
    const { meta, result } = output.structuredContent;
    if (
      result.task.repositoryId !== meta.repositoryId ||
      result.task.worktreeId !== meta.worktreeId ||
      result.task.latestSnapshotId !== meta.sourceSnapshotId
    ) {
      context.addIssue({
        code: "custom",
        message: "Task identity must match MCP meta in get_task_brief output",
        path: ["structuredContent", "result", "task"],
      });
    }
  });

export type GetTaskBriefInputV1 = z.input<
  typeof GetTaskBriefInputV1Schema
>;
export type GetTaskBriefOutputV1 = z.output<
  typeof GetTaskBriefOutputV1Schema
>;

export const UpdateTaskOutputV1Schema =
  createMcpToolSuccessResultV1Schema(
    z.strictObject({
      task: TaskManifestV1Schema,
      mutation: MutationResultV1Schema,
    }),
  ).superRefine((output, context) => {
    const { meta, result } = output.structuredContent;
    if (
      result.task.taskId !== result.mutation.taskId ||
      result.task.revision !== result.mutation.revision ||
      result.task.repositoryId !== meta.repositoryId ||
      result.task.worktreeId !== meta.worktreeId ||
      result.task.latestSnapshotId !== meta.sourceSnapshotId
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Task, mutation, and MCP meta identities must match in update_task output",
        path: ["structuredContent", "result"],
      });
    }
  });

export type UpdateTaskToolInputV1 = z.input<typeof UpdateTaskInputV1Schema>;
export type UpdateTaskOutputV1 = z.output<typeof UpdateTaskOutputV1Schema>;

export const SearchContextScopeV1Schema = z.enum([
  "file",
  "symbol",
  "wiki",
  "graph",
]);

export type SearchContextScopeV1 = z.infer<
  typeof SearchContextScopeV1Schema
>;

const SearchResultCommonShape = {
  id: OpaqueIdentifierSchema,
  title: NonEmptyStringSchema,
  summary: NonEmptyStringSchema.max(8_192),
  score: z.number().finite(),
  reasons: z.array(NonEmptyStringSchema).min(1),
  evidenceIds: z.array(EvidenceIdSchema),
};

const FileSearchResultV1Schema = z.strictObject({
  ...SearchResultCommonShape,
  kind: z.literal("file"),
  filePath: RepositoryRelativePathSchema,
});

const SymbolSearchResultV1Schema = z.strictObject({
  ...SearchResultCommonShape,
  kind: z.literal("symbol"),
  symbolId: OpaqueIdentifierSchema,
  filePath: RepositoryRelativePathSchema,
});

const WikiSearchResultV1Schema = z.strictObject({
  ...SearchResultCommonShape,
  kind: z.literal("wiki"),
  documentId: OpaqueIdentifierSchema,
});

const GraphSearchResultV1Schema = z.strictObject({
  ...SearchResultCommonShape,
  kind: z.literal("graph"),
  nodeId: OpaqueIdentifierSchema,
});

export const SearchContextResultItemV1Schema = z.discriminatedUnion("kind", [
  FileSearchResultV1Schema,
  SymbolSearchResultV1Schema,
  WikiSearchResultV1Schema,
  GraphSearchResultV1Schema,
]);

export type SearchContextResultItemV1 = z.infer<
  typeof SearchContextResultItemV1Schema
>;

export const SearchContextInputV1Schema = z
  .strictObject({
    query: NonEmptyStringSchema.max(8_192),
    taskId: TaskIdSchema.optional(),
    scopes: z.array(SearchContextScopeV1Schema).min(1).max(4).optional(),
    pathPrefixes: z.array(RepositoryRelativePathSchema).max(50).optional(),
    tokenBudget: z.number().int().min(128).max(100_000).optional(),
    cursor: CursorV1Schema.optional(),
    pageSize: z.number().int().min(1).max(200).optional(),
  })
  .superRefine((input, context) => {
    if (input.scopes !== undefined) {
      uniqueValues(input.scopes, context, ["scopes"], "scopes");
    }
    if (input.pathPrefixes !== undefined) {
      uniqueValues(
        input.pathPrefixes,
        context,
        ["pathPrefixes"],
        "pathPrefixes",
      );
    }
  });

export const SearchContextOutputV1Schema =
  createPagedMcpToolSuccessResultV1Schema(
    z.strictObject({
      results: z.array(SearchContextResultItemV1Schema),
    }),
    (result) => result.results.length,
  );

export type SearchContextInputV1 = z.input<
  typeof SearchContextInputV1Schema
>;
export type SearchContextOutputV1 = z.output<
  typeof SearchContextOutputV1Schema
>;

export const GetEvidenceInputV1Schema = z
  .strictObject({
    taskId: TaskIdSchema,
    evidenceIds: z.array(EvidenceIdSchema).min(1).max(200),
    maxExcerptChars: z.number().int().min(0).max(8_192).optional(),
    cursor: CursorV1Schema.optional(),
    pageSize: z.number().int().min(1).max(200).optional(),
  })
  .superRefine((input, context) => {
    uniqueValues(
      input.evidenceIds,
      context,
      ["evidenceIds"],
      "evidenceIds",
    );
  });

export const GetEvidenceOutputV1Schema =
  createPagedMcpToolSuccessResultV1Schema(
    z.strictObject({
      evidence: z.array(EvidenceV1Schema),
      missingEvidenceIds: z.array(EvidenceIdSchema),
    }),
    (result) => result.evidence.length + result.missingEvidenceIds.length,
  );

export type GetEvidenceInputV1 = z.input<
  typeof GetEvidenceInputV1Schema
>;
export type GetEvidenceOutputV1 = z.output<
  typeof GetEvidenceOutputV1Schema
>;

export const TraceImpactInputV1Schema = z
  .strictObject({
    taskId: TaskIdSchema.optional(),
    sourceNodeIds: z.array(OpaqueIdentifierSchema).min(1).max(50),
    targetNodeIds: z.array(OpaqueIdentifierSchema).max(50).optional(),
    direction: z.enum(["upstream", "downstream", "both"]),
    maxDepth: z.number().int().min(1).max(20).optional(),
    maxPaths: z.number().int().min(1).max(500).optional(),
    cursor: CursorV1Schema.optional(),
    pageSize: z.number().int().min(1).max(200).optional(),
  })
  .superRefine((input, context) => {
    uniqueValues(
      input.sourceNodeIds,
      context,
      ["sourceNodeIds"],
      "sourceNodeIds",
    );
    if (input.targetNodeIds !== undefined) {
      uniqueValues(
        input.targetNodeIds,
        context,
        ["targetNodeIds"],
        "targetNodeIds",
      );
    }
  });

export const TraceImpactOutputV1Schema =
  createPagedMcpToolSuccessResultV1Schema(
    z.strictObject({
      paths: z.array(ImpactPathV1Schema),
      unresolvedNodeIds: z.array(OpaqueIdentifierSchema),
    }),
    (result) => result.paths.length + result.unresolvedNodeIds.length,
  );

export type TraceImpactInputV1 = z.input<
  typeof TraceImpactInputV1Schema
>;
export type TraceImpactOutputV1 = z.output<
  typeof TraceImpactOutputV1Schema
>;

export const CheckChangeOutputV1Schema =
  createMcpToolSuccessResultV1Schema(
    z.strictObject({
      changeCheck: ChangeCheckV1Schema,
      mutation: MutationResultV1Schema,
    }),
  ).superRefine((output, context) => {
    const { meta, result } = output.structuredContent;
    if (
      result.changeCheck.taskId !== result.mutation.taskId ||
      result.changeCheck.taskRevision !== result.mutation.revision ||
      result.changeCheck.actualSnapshotId !== meta.sourceSnapshotId
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Change Check, mutation, and MCP meta identities must match in check_change output",
        path: ["structuredContent", "result"],
      });
    }
  });

export type CheckChangeToolInputV1 = z.input<
  typeof CheckChangeInputV1Schema
>;
export type CheckChangeOutputV1 = z.output<
  typeof CheckChangeOutputV1Schema
>;

export const RecordVerificationOutputV1Schema =
  createMcpToolSuccessResultV1Schema(
    z.strictObject({
      verification: VerificationRecordV1Schema,
      mutation: MutationResultV1Schema,
    }),
  ).superRefine((output, context) => {
    const { meta, result } = output.structuredContent;
    if (
      result.verification.taskId !== result.mutation.taskId ||
      result.verification.snapshotId !== meta.sourceSnapshotId
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Verification, mutation, and MCP meta identities must match in record_verification output",
        path: ["structuredContent", "result"],
      });
    }
  });

export type RecordVerificationToolInputV1 = z.input<
  typeof RecordVerificationInputV1Schema
>;
export type RecordVerificationOutputV1 = z.output<
  typeof RecordVerificationOutputV1Schema
>;

export const WorkbenchRouteV1Schema = z
  .strictObject({
    view: z.enum(["tasks", "knowledge", "graph"]),
    taskId: TaskIdSchema.optional(),
    section: OpaqueIdentifierSchema.optional(),
    findingId: FindingIdSchema.optional(),
    evidenceId: EvidenceIdSchema.optional(),
    impactPathId: ImpactPathIdSchema.optional(),
    focus: OpaqueIdentifierSchema.optional(),
  })
  .superRefine((route, context) => {
    const hasTaskSpecificTarget =
      route.section !== undefined ||
      route.findingId !== undefined ||
      route.evidenceId !== undefined ||
      route.impactPathId !== undefined;
    if (hasTaskSpecificTarget && route.taskId === undefined) {
      context.addIssue({
        code: "custom",
        message: "task-specific deep-link targets require taskId",
        path: ["taskId"],
      });
    }
    if (
      (route.findingId !== undefined || route.evidenceId !== undefined) &&
      route.view !== "tasks"
    ) {
      context.addIssue({
        code: "custom",
        message: "finding and evidence targets belong to the tasks view",
        path: ["view"],
      });
    }
  });

export type WorkbenchRouteV1 = z.infer<typeof WorkbenchRouteV1Schema>;

const LoopbackWorkbenchUrlV1Schema = z
  .string()
  .max(8_192)
  .regex(
    /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/[^#\s]*#[^\s]+$/u,
    "workbench URL must use 127.0.0.1 and carry its launch token in the fragment",
  )
  .refine((value) => {
    const port = /^http:\/\/127\.0\.0\.1:(\d+)\//u.exec(value)?.[1];
    return port !== undefined && Number(port) <= 65_535;
  }, "workbench URL port must be valid");

export const OpenWorkbenchInputV1Schema = z.strictObject({
  route: WorkbenchRouteV1Schema,
  openBrowser: z.boolean().optional(),
});

export const WorkbenchRuntimeIdentityV1Schema = z.strictObject({
  productVersion: ProducerVersionSchema,
  worktreeId: WorktreeIdSchema,
});

export const OpenWorkbenchOutputV1Schema =
  createMcpToolSuccessResultV1Schema(
    z.strictObject({
      route: WorkbenchRouteV1Schema,
      deepLink: LoopbackWorkbenchUrlV1Schema,
      launchTokenExpiresAt: IsoTimestampSchema,
      runtime: z.strictObject({
        identity: WorkbenchRuntimeIdentityV1Schema,
        disposition: z.enum(["started", "reused"]),
      }),
    }),
  ).superRefine((output, context) => {
    if (
      output.structuredContent.result.runtime.identity.worktreeId !==
      output.structuredContent.meta.worktreeId
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Workbench runtime identity must bind the MCP response worktree",
        path: [
          "structuredContent",
          "result",
          "runtime",
          "identity",
          "worktreeId",
        ],
      });
    }
  });

export type WorkbenchRuntimeIdentityV1 = z.infer<
  typeof WorkbenchRuntimeIdentityV1Schema
>;

export type OpenWorkbenchInputV1 = z.input<
  typeof OpenWorkbenchInputV1Schema
>;
export type OpenWorkbenchOutputV1 = z.output<
  typeof OpenWorkbenchOutputV1Schema
>;

export const JsonRpcRequestIdV1Schema = z.union([
  z.string().min(1).max(256),
  z.number().int(),
]);

export type JsonRpcRequestIdV1 = z.infer<
  typeof JsonRpcRequestIdV1Schema
>;

export const JsonRpcProgressTokenV1Schema = z.union([
  z.string().min(1).max(256),
  z.number().int(),
]);

export type JsonRpcProgressTokenV1 = z.infer<
  typeof JsonRpcProgressTokenV1Schema
>;

export const RefreshIndexModeV1Schema = z.enum(["incremental", "full"]);

export type RefreshIndexModeV1 = z.infer<
  typeof RefreshIndexModeV1Schema
>;

export const RefreshIndexInputV1Schema = z.strictObject({
  mode: RefreshIndexModeV1Schema,
  expectedSourceSnapshotId: SnapshotIdSchema.optional(),
  idempotencyKey: IdempotencyKeySchema,
  actor: ActorSchema,
});

export const McpProgressRequestMetaV1Schema = z.strictObject({
  progressToken: JsonRpcProgressTokenV1Schema,
});

export type McpProgressRequestMetaV1 = z.infer<
  typeof McpProgressRequestMetaV1Schema
>;

export const McpProgressNotificationV1Schema = z.strictObject({
  jsonrpc: z.literal("2.0"),
  method: z.literal("notifications/progress"),
  params: z.strictObject({
    progressToken: JsonRpcProgressTokenV1Schema,
    progress: z.number().nonnegative(),
    total: z.number().positive().optional(),
    message: NonEmptyStringSchema.max(1_024).optional(),
  }),
});

export type McpProgressNotificationV1 = z.infer<
  typeof McpProgressNotificationV1Schema
>;

export const McpCancelledNotificationV1Schema = z.strictObject({
  jsonrpc: z.literal("2.0"),
  method: z.literal("notifications/cancelled"),
  params: z.strictObject({
    requestId: JsonRpcRequestIdV1Schema,
    reason: NonEmptyStringSchema.max(1_024).optional(),
  }),
});

export type McpCancelledNotificationV1 = z.infer<
  typeof McpCancelledNotificationV1Schema
>;

export const RefreshIndexProgressV1Schema = z
  .strictObject({
    schemaVersion: SchemaVersionV1Schema,
    operationId: OpaqueIdentifierSchema,
    stage: z.enum([
      "discovering",
      "parsing",
      "building_graph",
      "building_wiki",
      "writing_artifacts",
      "committing_snapshot",
      "completed",
      "cancelling",
    ]),
    processed: z.number().int().nonnegative(),
    total: z.number().int().positive().optional(),
    message: NonEmptyStringSchema.max(1_024).optional(),
    cancellable: z.boolean(),
    lastAvailableSnapshotId: SnapshotIdSchema.optional(),
  })
  .superRefine((progress, context) => {
    if (progress.total !== undefined && progress.processed > progress.total) {
      context.addIssue({
        code: "custom",
        message: "processed must not exceed total",
        path: ["processed"],
      });
    }
    if (
      (progress.stage === "committing_snapshot" ||
        progress.stage === "completed") &&
      progress.cancellable
    ) {
      context.addIssue({
        code: "custom",
        message:
          "refresh cannot be cancelled once atomic snapshot commit starts",
        path: ["cancellable"],
      });
    }
  });

export type RefreshIndexProgressV1 = z.infer<
  typeof RefreshIndexProgressV1Schema
>;

export const RefreshIndexCancellationV1Schema = z.strictObject({
  mechanism: z.literal("mcp_request_cancellation"),
  notificationMethod: z.literal("notifications/cancelled"),
  effect: z.literal("cooperative_stop_preserve_last_snapshot"),
});

export type RefreshIndexCancellationV1 = z.infer<
  typeof RefreshIndexCancellationV1Schema
>;

export const RefreshIndexCompletedV1Schema = z
  .strictObject({
    operationId: OpaqueIdentifierSchema,
    mode: RefreshIndexModeV1Schema,
    status: z.literal("completed"),
    sourceSnapshotId: SnapshotIdSchema.optional(),
    finalSnapshotId: SnapshotIdSchema,
    startedAt: IsoTimestampSchema,
    completedAt: IsoTimestampSchema,
    previousSnapshotPreservedUntilCommit: z.literal(true),
    cancellation: RefreshIndexCancellationV1Schema,
  })
  .superRefine((operation, context) => {
    if (Date.parse(operation.completedAt) < Date.parse(operation.startedAt)) {
      context.addIssue({
        code: "custom",
        message: "completedAt must not precede startedAt",
        path: ["completedAt"],
      });
    }
  });

export type RefreshIndexCompletedV1 = z.infer<
  typeof RefreshIndexCompletedV1Schema
>;

export const RefreshIndexOutputV1Schema =
  createMcpToolSuccessResultV1Schema(
    z.strictObject({
      operation: RefreshIndexCompletedV1Schema,
    }),
  ).superRefine((output, context) => {
    if (
      output.structuredContent.result.operation.finalSnapshotId !==
      output.structuredContent.meta.sourceSnapshotId
    ) {
      context.addIssue({
        code: "custom",
        message: "refresh_index final Snapshot must match MCP meta",
        path: ["structuredContent", "result", "operation", "finalSnapshotId"],
      });
    }
  });

export type RefreshIndexInputV1 = z.input<
  typeof RefreshIndexInputV1Schema
>;
export type RefreshIndexOutputV1 = z.output<
  typeof RefreshIndexOutputV1Schema
>;

export const P0_MCP_TOOL_NAMES_V1 = [
  "get_repo_pulse",
  "build_task_brief",
  "get_task_brief",
  "update_task",
  "search_context",
  "get_evidence",
  "trace_impact",
  "check_change",
  "record_verification",
  "open_workbench",
  "refresh_index",
] as const;

export const P0McpToolNameV1Schema = z.enum(P0_MCP_TOOL_NAMES_V1);

export type P0McpToolNameV1 = z.infer<typeof P0McpToolNameV1Schema>;

export const P0_MCP_TOOL_CONTRACTS_V1 = {
  get_repo_pulse: {
    input: GetRepoPulseInputV1Schema,
    output: GetRepoPulseOutputV1Schema,
  },
  build_task_brief: {
    input: BuildTaskBriefInputV1Schema,
    output: BuildTaskBriefOutputV1Schema,
  },
  get_task_brief: {
    input: GetTaskBriefInputV1Schema,
    output: GetTaskBriefOutputV1Schema,
  },
  update_task: {
    input: UpdateTaskInputV1Schema,
    output: UpdateTaskOutputV1Schema,
  },
  search_context: {
    input: SearchContextInputV1Schema,
    output: SearchContextOutputV1Schema,
  },
  get_evidence: {
    input: GetEvidenceInputV1Schema,
    output: GetEvidenceOutputV1Schema,
  },
  trace_impact: {
    input: TraceImpactInputV1Schema,
    output: TraceImpactOutputV1Schema,
  },
  check_change: {
    input: CheckChangeInputV1Schema,
    output: CheckChangeOutputV1Schema,
  },
  record_verification: {
    input: RecordVerificationInputV1Schema,
    output: RecordVerificationOutputV1Schema,
  },
  open_workbench: {
    input: OpenWorkbenchInputV1Schema,
    output: OpenWorkbenchOutputV1Schema,
  },
  refresh_index: {
    input: RefreshIndexInputV1Schema,
    output: RefreshIndexOutputV1Schema,
  },
} as const satisfies Record<
  P0McpToolNameV1,
  { readonly input: z.ZodType; readonly output: z.ZodType }
>;
