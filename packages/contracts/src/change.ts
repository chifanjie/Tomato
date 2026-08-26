import { z } from "zod";

import { createArtifactEnvelopeV1Schema } from "./artifact-envelope.js";
import {
  ActorSchema,
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
  RevisionSchema,
  SchemaVersionV1Schema,
  SnapshotIdSchema,
  TaskIdSchema,
  VerificationRecordIdSchema,
} from "./primitives.js";
import { VerificationMethodV1Schema } from "./task.js";
import {
  EvidenceBackedChangeCheckV1Schema,
  StrongImpactConclusionV1Schema,
  StrongVerificationRecordV1Schema,
} from "./strong-change-intelligence.js";

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

export const ImpactConfidenceV1Schema = z.enum([
  "exact",
  "same-file",
  "imported-package",
  "heuristic",
]);

export type ImpactConfidenceV1 = z.infer<typeof ImpactConfidenceV1Schema>;

export const ImpactStepV1Schema = z.strictObject({
  source: OpaqueIdentifierSchema,
  edgeType: NonEmptyStringSchema,
  target: OpaqueIdentifierSchema,
  direction: z.enum(["upstream", "downstream"]),
  evidenceId: EvidenceIdSchema.optional(),
  confidence: ImpactConfidenceV1Schema.optional(),
});

export type ImpactStepV1 = z.infer<typeof ImpactStepV1Schema>;

export const ImpactTruncationV1Schema = z.strictObject({
  reason: z.enum(["depth", "node_budget", "unsupported_dynamic_edge"]),
  hiddenCount: z.number().int().nonnegative().optional(),
});

export type ImpactTruncationV1 = z.infer<typeof ImpactTruncationV1Schema>;

export const ImpactPathV1Schema = z.strictObject({
  id: ImpactPathIdSchema,
  sourceNodeId: OpaqueIdentifierSchema,
  targetNodeId: OpaqueIdentifierSchema,
  classification: z.enum(["observed", "inferred", "unknown_boundary"]),
  claimIds: z.array(ClaimIdSchema).min(1),
  steps: z.array(ImpactStepV1Schema).min(1),
  boundaryReason: NonEmptyStringSchema.optional(),
  truncatedAt: ImpactTruncationV1Schema.optional(),
}).superRefine((path, context) => {
  uniqueValues(path.claimIds, context, ["claimIds"], "claimIds");

  if (path.steps[0]?.source !== path.sourceNodeId) {
    context.addIssue({
      code: "custom",
      message: "the first step must start at sourceNodeId",
      path: ["steps", 0, "source"],
    });
  }
  if (path.steps.at(-1)?.target !== path.targetNodeId) {
    context.addIssue({
      code: "custom",
      message: "the final step must end at targetNodeId",
      path: ["steps", path.steps.length - 1, "target"],
    });
  }
  for (let index = 1; index < path.steps.length; index += 1) {
    if (path.steps[index - 1]?.target !== path.steps[index]?.source) {
      context.addIssue({
        code: "custom",
        message: "impact path steps must form a continuous chain",
        path: ["steps", index, "source"],
      });
    }
  }

  const directedEdges = path.steps.map(
    (step) => `${step.source}\u0000${step.edgeType}\u0000${step.target}`,
  );
  uniqueValues(
    directedEdges,
    context,
    ["steps"],
    "directed impact path edges",
  );

  if (
    path.classification === "observed" &&
    path.steps.some((step) => step.evidenceId === undefined)
  ) {
    context.addIssue({
      code: "custom",
      message: "every observed impact step requires evidence",
      path: ["steps"],
    });
  }
  if (
    path.classification === "unknown_boundary" &&
    path.boundaryReason === undefined
  ) {
    context.addIssue({
      code: "custom",
      message: "unknown boundaries require a boundary reason",
      path: ["boundaryReason"],
    });
  }
  if (
    path.classification !== "unknown_boundary" &&
    path.boundaryReason !== undefined
  ) {
    context.addIssue({
      code: "custom",
      message: "boundaryReason is only valid for unknown boundaries",
      path: ["boundaryReason"],
    });
  }
});

export type ImpactPathV1 = z.infer<typeof ImpactPathV1Schema>;

export const ImpactPayloadV1Schema = z.strictObject({
  paths: z.array(ImpactPathV1Schema),
  conclusion: StrongImpactConclusionV1Schema.optional(),
}).superRefine((payload, context) => {
  uniqueValues(
    payload.paths.map((path) => path.id),
    context,
    ["paths"],
    "impact path ids",
  );
  if (
    payload.conclusion?.status === "paths_observed" &&
    JSON.stringify([...payload.conclusion.impactPathIds].sort()) !==
      JSON.stringify(payload.paths.map((path) => path.id).sort())
  ) {
    context.addIssue({
      code: "custom",
      message: "strong paths_observed conclusion must exact-cover the Impact payload",
      path: ["conclusion", "impactPathIds"],
    });
  }
});

export type ImpactPayloadV1 = z.infer<typeof ImpactPayloadV1Schema>;

export const ImpactArtifactV1Schema = createArtifactEnvelopeV1Schema(
  "impact",
  ImpactPayloadV1Schema,
);

export type ImpactArtifactV1 = z.infer<typeof ImpactArtifactV1Schema>;

export const ChangeFindingTypeV1Schema = z.enum([
  "planned_completed",
  "planned_partial",
  "unplanned_change",
  "possible_omission",
  "verification_gap",
  "cannot_determine",
]);

export type ChangeFindingTypeV1 = z.infer<
  typeof ChangeFindingTypeV1Schema
>;

export const FindingAcceptanceV1Schema = z.strictObject({
  actor: ActorSchema,
  reason: NonEmptyStringSchema,
  at: IsoTimestampSchema,
  eventId: EventIdSchema,
});

export type FindingAcceptanceV1 = z.infer<typeof FindingAcceptanceV1Schema>;

export const ChangeFindingSeverityV1Schema = z.enum([
  "info",
  "warning",
  "error",
  "critical",
]);

export type ChangeFindingSeverityV1 = z.infer<
  typeof ChangeFindingSeverityV1Schema
>;

const FixedFindingResolutionV1Schema = z.strictObject({
  kind: z.literal("fixed"),
  resolvedAt: IsoTimestampSchema,
  snapshotId: SnapshotIdSchema,
  evidenceIds: z.array(EvidenceIdSchema).min(1),
});

const AcceptedFindingResolutionV1Schema = FindingAcceptanceV1Schema.extend({
  kind: z.literal("accepted"),
});

export const ChangeFindingResolutionV1Schema = z.discriminatedUnion("kind", [
  FixedFindingResolutionV1Schema,
  AcceptedFindingResolutionV1Schema,
]);

export type ChangeFindingResolutionV1 = z.infer<
  typeof ChangeFindingResolutionV1Schema
>;

export const ChangeFindingV1Schema = z.strictObject({
  id: FindingIdSchema,
  type: ChangeFindingTypeV1Schema,
  severity: ChangeFindingSeverityV1Schema,
  blocking: z.boolean(),
  summary: NonEmptyStringSchema,
  claimIds: z.array(ClaimIdSchema).min(1),
  plannedChangeIds: z.array(PlannedChangeIdSchema),
  actualChangeIds: z.array(OpaqueIdentifierSchema),
  evidenceIds: z.array(EvidenceIdSchema),
  impactPathIds: z.array(ImpactPathIdSchema),
  resolution: ChangeFindingResolutionV1Schema.optional(),
}).superRefine((finding, context) => {
  const collections: Array<[string, readonly string[]]> = [
    ["claimIds", finding.claimIds],
    ["plannedChangeIds", finding.plannedChangeIds],
    ["actualChangeIds", finding.actualChangeIds],
    ["evidenceIds", finding.evidenceIds],
    ["impactPathIds", finding.impactPathIds],
  ];
  for (const [field, values] of collections) {
    uniqueValues(values, context, [field], field);
  }
  if (finding.severity === "critical" && !finding.blocking) {
    context.addIssue({
      code: "custom",
      message: "critical findings must be blocking",
      path: ["blocking"],
    });
  }
  if (finding.resolution?.kind === "fixed") {
    uniqueValues(
      finding.resolution.evidenceIds,
      context,
      ["resolution", "evidenceIds"],
      "fixed finding evidenceIds",
    );
  }

  if (
    (finding.type === "planned_completed" ||
      finding.type === "planned_partial") &&
    (finding.plannedChangeIds.length === 0 ||
      finding.actualChangeIds.length === 0)
  ) {
    context.addIssue({
      code: "custom",
      message:
        "planned completion findings require planned and actual change references",
      path: ["plannedChangeIds"],
    });
  }
  if (
    finding.type === "unplanned_change" &&
    finding.actualChangeIds.length === 0
  ) {
    context.addIssue({
      code: "custom",
      message: "unplanned changes require an actual change reference",
      path: ["actualChangeIds"],
    });
  }
  if (
    finding.type === "possible_omission" &&
    (finding.plannedChangeIds.length === 0 ||
      (finding.evidenceIds.length === 0 &&
        finding.impactPathIds.length === 0))
  ) {
    context.addIssue({
      code: "custom",
      message:
        "possible omissions require a planned change and evidence or an impact path",
      path: ["plannedChangeIds"],
    });
  }
  if (
    (finding.type === "verification_gap" ||
      finding.type === "cannot_determine") &&
    finding.claimIds.length === 0
  ) {
    context.addIssue({
      code: "custom",
      message: `${finding.type} findings require a claim reference`,
      path: ["claimIds"],
    });
  }
});

export type ChangeFindingV1 = z.infer<typeof ChangeFindingV1Schema>;

export const ChangeCheckV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  id: OpaqueIdentifierSchema,
  taskId: TaskIdSchema,
  taskRevision: RevisionSchema,
  baselineSnapshotId: SnapshotIdSchema,
  actualSnapshotId: SnapshotIdSchema,
  findings: z.array(ChangeFindingV1Schema),
  generatedAt: IsoTimestampSchema,
}).superRefine((check, context) => {
  uniqueValues(
    check.findings.map((finding) => finding.id),
    context,
    ["findings"],
    "finding ids",
  );
});

export type ChangeCheckV1 = z.infer<typeof ChangeCheckV1Schema>;

/**
 * Ephemeral reader classification for the compatible legacy Change Check.
 * This value must never be injected into the persisted payload because doing
 * so would rewrite historical bytes and their content digest.
 */
export const ChangeCheckReadClassificationV1Schema = z.strictObject({
  profile: z.literal("legacy_summary"),
  emptyFindingsAreClean: z.literal(false),
});

export type ChangeCheckReadClassificationV1 = z.infer<
  typeof ChangeCheckReadClassificationV1Schema
>;

export function classifyChangeCheckV1(
  _check: ChangeCheckV1,
): ChangeCheckReadClassificationV1 {
  return {
    profile: "legacy_summary",
    emptyFindingsAreClean: false,
  };
}

export const ChangeCheckPersistedPayloadV1Schema = z.union([
  ChangeCheckV1Schema,
  EvidenceBackedChangeCheckV1Schema,
]);

export const ChangeCheckArtifactV1Schema = createArtifactEnvelopeV1Schema(
  "change_check",
  ChangeCheckPersistedPayloadV1Schema,
).superRefine((artifact, context) => {
  if (artifact.taskId !== artifact.payload.taskId) {
    context.addIssue({
      code: "custom",
      message: "Change Check envelope and payload taskId must match",
      path: ["taskId"],
    });
  }
  if (artifact.sourceSnapshotId !== artifact.payload.actualSnapshotId) {
    context.addIssue({
      code: "custom",
      message:
        "Change Check envelope sourceSnapshotId must equal actualSnapshotId",
      path: ["sourceSnapshotId"],
    });
  }
});

export type ChangeCheckArtifactV1 = z.infer<
  typeof ChangeCheckArtifactV1Schema
>;

export const CheckChangeInputV1Schema = z.strictObject({
  taskId: TaskIdSchema,
  actualSnapshotId: SnapshotIdSchema,
  includeWorktree: z.literal(true),
  expectedRevision: RevisionSchema,
  idempotencyKey: IdempotencyKeySchema,
  actor: ActorSchema,
});

export type CheckChangeInputV1 = z.infer<typeof CheckChangeInputV1Schema>;

export const VerificationStatusV1Schema = z.enum([
  "passed",
  "failed",
  "skipped",
  "blocked",
  "flaky",
]);

export type VerificationStatusV1 = z.infer<typeof VerificationStatusV1Schema>;

export const VerificationSkipAcceptanceV1Schema = z.strictObject({
  actor: ActorSchema,
  reason: NonEmptyStringSchema,
  acceptedAt: IsoTimestampSchema,
  eventId: EventIdSchema,
});

export type VerificationSkipAcceptanceV1 = z.infer<
  typeof VerificationSkipAcceptanceV1Schema
>;

const verificationExecutionShape = {
  kind: VerificationMethodV1Schema,
  status: VerificationStatusV1Schema,
  command: z.string().trim().min(1).max(8192).optional(),
  exitCode: z.number().int().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  outputDigest: ContentDigestSchema.optional(),
  summary: NonEmptyStringSchema,
  claimIds: z.array(ClaimIdSchema),
  snapshotId: SnapshotIdSchema,
};

type VerificationExecution = z.infer<
  z.ZodObject<typeof verificationExecutionShape>
> & {
  skipAcceptance?: z.infer<typeof VerificationSkipAcceptanceV1Schema>;
};

const refineVerification = (
  record: VerificationExecution,
  context: z.RefinementCtx,
): void => {
  uniqueValues(record.claimIds, context, ["claimIds"], "claimIds");

  if (record.kind === "manual") {
    if (record.command !== undefined || record.exitCode !== undefined) {
      context.addIssue({
        code: "custom",
        message: "manual verification must not claim command execution",
        path: ["command"],
      });
    }
  } else if (
    (record.status === "passed" ||
      record.status === "failed" ||
      record.status === "flaky") &&
    record.command === undefined
  ) {
    context.addIssue({
      code: "custom",
      message: "executed verification requires a command descriptor",
      path: ["command"],
    });
  }

  if (record.status === "passed" && record.exitCode !== undefined) {
    if (record.exitCode !== 0) {
      context.addIssue({
        code: "custom",
        message: "passed verification cannot have a non-zero exit code",
        path: ["exitCode"],
      });
    }
  }
  if (record.status === "failed" && record.exitCode !== undefined) {
    if (record.exitCode === 0) {
      context.addIssue({
        code: "custom",
        message: "failed verification cannot have a zero exit code",
        path: ["exitCode"],
      });
    }
  }

  if (
    record.status !== "skipped" &&
    record.skipAcceptance !== undefined
  ) {
    context.addIssue({
      code: "custom",
      message: "skipAcceptance is only valid for skipped verification",
      path: ["skipAcceptance"],
    });
  }
};

export const VerificationRecordV1Schema = z.strictObject({
  id: VerificationRecordIdSchema,
  taskId: TaskIdSchema,
  verificationPlanEntryId: OpaqueIdentifierSchema,
  attempt: z.number().int().positive(),
  supersedesVerificationRecordId: VerificationRecordIdSchema.optional(),
  ...verificationExecutionShape,
  skipAcceptance: VerificationSkipAcceptanceV1Schema.optional(),
  recordedAt: IsoTimestampSchema,
  actor: ActorSchema,
}).superRefine((record, context) => {
  refineVerification(record, context);
  if (
    (record.attempt === 1) !==
    (record.supersedesVerificationRecordId === undefined)
  ) {
    context.addIssue({
      code: "custom",
      message:
        "attempt 1 must not supersede another record; later attempts must identify the immediately preceding record",
      path: ["supersedesVerificationRecordId"],
    });
  }
  if (record.supersedesVerificationRecordId === record.id) {
    context.addIssue({
      code: "custom",
      message: "a verification record must not supersede itself",
      path: ["supersedesVerificationRecordId"],
    });
  }
});

export type VerificationRecordV1 = z.infer<typeof VerificationRecordV1Schema>;

export const LegacyVerificationPayloadV1Schema = z.strictObject({
  records: z.array(VerificationRecordV1Schema),
}).superRefine((payload, context) => {
  uniqueValues(
    payload.records.map((record) => record.id),
    context,
    ["records"],
    "verification record ids",
  );
});

export const StrongVerificationPayloadV1Schema = z.strictObject({
  profile: z.literal("verification_ledger_strong_v1"),
  records: z.array(StrongVerificationRecordV1Schema),
  skipAcceptances: z.tuple([]),
}).superRefine((payload, context) => {
  uniqueValues(payload.records.map((record) => record.id), context, ["records"], "strong verification record ids");
});

export const VerificationPayloadV1Schema = z.union([
  LegacyVerificationPayloadV1Schema,
  StrongVerificationPayloadV1Schema,
]);

export type VerificationPayloadV1 = z.infer<
  typeof VerificationPayloadV1Schema
>;

export const VerificationArtifactV1Schema = createArtifactEnvelopeV1Schema(
  "verification",
  VerificationPayloadV1Schema,
).superRefine((artifact, context) => {
  artifact.payload.records.forEach((record, index) => {
    if (record.taskId !== artifact.taskId) {
      context.addIssue({
        code: "custom",
        message: "every Verification record must match the envelope taskId",
        path: ["payload", "records", index, "taskId"],
      });
    }
  });
});

export type VerificationArtifactV1 = z.infer<
  typeof VerificationArtifactV1Schema
>;

export const VerificationRecordDraftV1Schema = z.strictObject({
  verificationPlanEntryId: OpaqueIdentifierSchema,
  supersedesVerificationRecordId: VerificationRecordIdSchema.optional(),
  ...verificationExecutionShape,
}).superRefine(refineVerification);

export type VerificationRecordDraftV1 = z.infer<
  typeof VerificationRecordDraftV1Schema
>;

export const RecordVerificationInputV1Schema = z.strictObject({
  taskId: TaskIdSchema,
  record: VerificationRecordDraftV1Schema,
  expectedRevision: RevisionSchema,
  idempotencyKey: IdempotencyKeySchema,
  actor: ActorSchema,
});

export type RecordVerificationInputV1 = z.infer<
  typeof RecordVerificationInputV1Schema
>;
