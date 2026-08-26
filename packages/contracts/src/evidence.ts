import { z } from "zod";

import { createArtifactEnvelopeV1Schema } from "./artifact-envelope.js";
import {
  ActorSchema,
  ClaimIdSchema,
  ContentDigestSchema,
  EventIdSchema,
  EvidenceIdSchema,
  FindingIdSchema,
  IsoTimestampSchema,
  LineRangeSchema,
  NonEmptyStringSchema,
  OpaqueIdentifierSchema,
  RepositoryRelativePathSchema,
  SnapshotIdSchema,
  TaskIdSchema,
  VerificationRecordIdSchema,
} from "./primitives.js";
import {
  DiffHunkEvidenceV1Schema,
  StrongFindingClaimV1Schema,
  StructuredAnalysisBoundaryEvidenceV1Schema,
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

export const EpistemicStatusV1Schema = z.enum([
  "observed",
  "inferred",
  "unknown",
  "human_confirmed",
]);

export type EpistemicStatusV1 = z.infer<typeof EpistemicStatusV1Schema>;

export const EvidenceFreshnessV1Schema = z.enum([
  "current",
  "changed",
  "stale",
  "invalid",
]);

export type EvidenceFreshnessV1 = z.infer<typeof EvidenceFreshnessV1Schema>;

export const ClaimKindV1Schema = z.enum([
  "goal",
  "non_goal",
  "acceptance",
  "assumption",
  "recommendation",
  "risk",
  "unknown",
  "finding",
  "conclusion",
]);

export type ClaimKindV1 = z.infer<typeof ClaimKindV1Schema>;

export const ClaimLifecycleStatusV1Schema = z.enum([
  "draft",
  "supported",
  "contested",
  "invalidated",
]);

export type ClaimLifecycleStatusV1 = z.infer<
  typeof ClaimLifecycleStatusV1Schema
>;

export const DerivationStepV1Schema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("evidence"),
    evidenceId: EvidenceIdSchema,
    description: NonEmptyStringSchema,
  }),
  z.strictObject({
    kind: z.literal("graph_relation"),
    relationId: OpaqueIdentifierSchema,
    description: NonEmptyStringSchema,
  }),
  z.strictObject({
    kind: z.literal("rule"),
    ruleId: OpaqueIdentifierSchema,
    description: NonEmptyStringSchema,
  }),
  z.strictObject({
    kind: z.literal("assumption"),
    claimId: ClaimIdSchema,
    description: NonEmptyStringSchema,
  }),
]);

export type DerivationStepV1 = z.infer<typeof DerivationStepV1Schema>;

export const ClaimV1Schema = z.strictObject({
  id: ClaimIdSchema,
  taskId: TaskIdSchema,
  kind: ClaimKindV1Schema,
  statement: NonEmptyStringSchema,
  epistemicStatus: EpistemicStatusV1Schema,
  lifecycleStatus: ClaimLifecycleStatusV1Schema,
  freshness: EvidenceFreshnessV1Schema,
  sourceSnapshotId: SnapshotIdSchema,
  evidenceIds: z.array(EvidenceIdSchema),
  findingIds: z.array(FindingIdSchema),
  verificationRecordIds: z.array(VerificationRecordIdSchema),
  boundaryReason: NonEmptyStringSchema.optional(),
  derivationPath: z.array(DerivationStepV1Schema).min(1).optional(),
  confirmationEventId: EventIdSchema.optional(),
  supersedesClaimId: ClaimIdSchema.optional(),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
}).superRefine((claim, context) => {
  uniqueValues(claim.evidenceIds, context, ["evidenceIds"], "evidenceIds");
  uniqueValues(claim.findingIds, context, ["findingIds"], "findingIds");
  uniqueValues(
    claim.verificationRecordIds,
    context,
    ["verificationRecordIds"],
    "verificationRecordIds",
  );

  if (
    (claim.epistemicStatus === "observed" ||
      claim.epistemicStatus === "inferred") &&
    claim.evidenceIds.length === 0
  ) {
    context.addIssue({
      code: "custom",
      message: "observed and inferred claims require supporting evidence",
      path: ["evidenceIds"],
    });
  }
  if (
    (claim.epistemicStatus === "inferred") !==
    (claim.derivationPath !== undefined)
  ) {
    context.addIssue({
      code: "custom",
      message:
        "inferred claims require a derivationPath, which is forbidden for non-inferred claims",
      path: ["derivationPath"],
    });
  }
  if (
    (claim.epistemicStatus === "unknown" || claim.kind === "unknown") &&
    claim.boundaryReason === undefined
  ) {
    context.addIssue({
      code: "custom",
      message: "unknown claims require a structured boundary reason",
      path: ["boundaryReason"],
    });
  }
  if (
    claim.epistemicStatus !== "unknown" &&
    claim.kind !== "unknown" &&
    claim.boundaryReason !== undefined
  ) {
    context.addIssue({
      code: "custom",
      message: "boundaryReason is only valid for unknown claims",
      path: ["boundaryReason"],
    });
  }
  if (
    claim.epistemicStatus === "human_confirmed" &&
    claim.confirmationEventId === undefined
  ) {
    context.addIssue({
      code: "custom",
      message: "human-confirmed claims require a confirmation event",
      path: ["confirmationEventId"],
    });
  }
  if (
    claim.lifecycleStatus === "supported" &&
    claim.evidenceIds.length === 0 &&
    claim.confirmationEventId === undefined
  ) {
    context.addIssue({
      code: "custom",
      message: "supported claims require evidence or a confirmation event",
      path: ["lifecycleStatus"],
    });
  }
  if (
    claim.lifecycleStatus === "invalidated" &&
    claim.freshness !== "invalid"
  ) {
    context.addIssue({
      code: "custom",
      message: "invalidated claims must have invalid freshness",
      path: ["freshness"],
    });
  }
  if (claim.supersedesClaimId === claim.id) {
    context.addIssue({
      code: "custom",
      message: "a claim must not supersede itself",
      path: ["supersedesClaimId"],
    });
  }
  if (Date.parse(claim.updatedAt) < Date.parse(claim.createdAt)) {
    context.addIssue({
      code: "custom",
      message: "updatedAt must not precede createdAt",
      path: ["updatedAt"],
    });
  }
});

export type ClaimV1 = z.infer<typeof ClaimV1Schema>;

export const EvidenceKindV1Schema = z.enum([
  "source",
  "config",
  "test",
  "git",
  "graph_path",
  "document",
  "human",
  "analysis_boundary",
]);

export type EvidenceKindV1 = z.infer<typeof EvidenceKindV1Schema>;

export const HumanConfirmationV1Schema = z.strictObject({
  actor: ActorSchema,
  input: z.string().trim().min(1).max(4096),
  confirmedAt: IsoTimestampSchema,
});

export type HumanConfirmationV1 = z.infer<typeof HumanConfirmationV1Schema>;

const evidenceCommonShape = {
  id: EvidenceIdSchema,
  freshness: EvidenceFreshnessV1Schema,
  claimIds: z.array(ClaimIdSchema),
  nodeIds: z.array(OpaqueIdentifierSchema),
  producedBy: NonEmptyStringSchema,
  createdAt: IsoTimestampSchema,
  observedAtSnapshotId: SnapshotIdSchema,
  derivationPath: z.array(DerivationStepV1Schema).min(1).optional(),
  freshnessReason: NonEmptyStringSchema.optional(),
  invalidatedAt: IsoTimestampSchema.optional(),
  invalidationReason: NonEmptyStringSchema.optional(),
};

const FileEvidenceV1Schema = z.strictObject({
  ...evidenceCommonShape,
  kind: z.enum(["source", "config", "test", "document"]),
  epistemicStatus: z.enum(["observed", "inferred"]),
  filePath: RepositoryRelativePathSchema,
  lineRange: LineRangeSchema.optional(),
  excerpt: z.string().max(8192).optional(),
  commit: NonEmptyStringSchema.optional(),
  contentHash: ContentDigestSchema,
});

const GitEvidenceV1Schema = z.strictObject({
  ...evidenceCommonShape,
  kind: z.literal("git"),
  epistemicStatus: z.literal("observed"),
  commit: NonEmptyStringSchema,
  contentHash: ContentDigestSchema.optional(),
});

const GraphPathEvidenceV1Schema = z.strictObject({
  ...evidenceCommonShape,
  kind: z.literal("graph_path"),
  epistemicStatus: z.enum(["observed", "inferred"]),
  relationPath: z.array(OpaqueIdentifierSchema).min(1),
  contentHash: ContentDigestSchema.optional(),
});

const HumanEvidenceV1Schema = z.strictObject({
  ...evidenceCommonShape,
  kind: z.literal("human"),
  epistemicStatus: z.literal("human_confirmed"),
  confirmation: HumanConfirmationV1Schema,
});

const AnalysisBoundaryEvidenceV1Schema = z.strictObject({
  ...evidenceCommonShape,
  kind: z.literal("analysis_boundary"),
  epistemicStatus: z.literal("unknown"),
  boundaryReason: NonEmptyStringSchema,
  relationPath: z.array(OpaqueIdentifierSchema),
});

export const EvidenceV1Schema = z.discriminatedUnion("kind", [
  FileEvidenceV1Schema,
  GitEvidenceV1Schema,
  GraphPathEvidenceV1Schema,
  HumanEvidenceV1Schema,
  AnalysisBoundaryEvidenceV1Schema,
]).superRefine((evidence, context) => {
  uniqueValues(evidence.claimIds, context, ["claimIds"], "claimIds");
  uniqueValues(evidence.nodeIds, context, ["nodeIds"], "nodeIds");
  if (
    (evidence.epistemicStatus === "inferred") !==
    (evidence.derivationPath !== undefined)
  ) {
    context.addIssue({
      code: "custom",
      message:
        "inferred Evidence requires a derivationPath, which is forbidden for non-inferred Evidence",
      path: ["derivationPath"],
    });
  }

  if (
    ["source", "config", "test", "document"].includes(evidence.kind) &&
    "excerpt" in evidence &&
    evidence.excerpt !== undefined &&
    evidence.lineRange === undefined
  ) {
    context.addIssue({
      code: "custom",
      message: "excerpt evidence requires a lineRange anchor",
      path: ["lineRange"],
    });
  }

  if (evidence.freshness === "invalid") {
    if (
      evidence.invalidatedAt === undefined ||
      evidence.invalidationReason === undefined
    ) {
      context.addIssue({
        code: "custom",
        message:
          "invalid evidence requires invalidatedAt and invalidationReason",
        path: ["freshness"],
      });
    }
  } else if (
    evidence.invalidatedAt !== undefined ||
    evidence.invalidationReason !== undefined
  ) {
    context.addIssue({
      code: "custom",
      message: "invalidation metadata is only valid for invalid evidence",
      path: ["invalidatedAt"],
    });
  }

  if (
    (evidence.freshness === "changed" || evidence.freshness === "stale") &&
    evidence.freshnessReason === undefined
  ) {
    context.addIssue({
      code: "custom",
      message: "changed or stale evidence requires a freshness reason",
      path: ["freshnessReason"],
    });
  }
  if (
    evidence.invalidatedAt !== undefined &&
    Date.parse(evidence.invalidatedAt) < Date.parse(evidence.createdAt)
  ) {
    context.addIssue({
      code: "custom",
      message: "invalidatedAt must not precede createdAt",
      path: ["invalidatedAt"],
    });
  }
});

export type EvidenceV1 = z.infer<typeof EvidenceV1Schema>;

export const PersistedClaimV1Schema = z.union([
  ClaimV1Schema,
  StrongFindingClaimV1Schema,
]);

export const PersistedEvidenceV1Schema = z.union([
  EvidenceV1Schema,
  DiffHunkEvidenceV1Schema,
  StructuredAnalysisBoundaryEvidenceV1Schema,
]);
export type PersistedClaimV1 = z.infer<typeof PersistedClaimV1Schema>;
export type PersistedEvidenceV1 = z.infer<typeof PersistedEvidenceV1Schema>;

export const ClaimLedgerPayloadV1Schema = z.strictObject({
  claims: z.array(PersistedClaimV1Schema),
}).superRefine((ledger, context) => {
  uniqueValues(
    ledger.claims.map((claim) => claim.id),
    context,
    ["claims"],
    "claim ids",
  );
});

export type ClaimLedgerPayloadV1 = z.infer<
  typeof ClaimLedgerPayloadV1Schema
>;

export const ClaimLedgerArtifactV1Schema = createArtifactEnvelopeV1Schema(
  "claim_ledger",
  ClaimLedgerPayloadV1Schema,
).superRefine((artifact, context) => {
  artifact.payload.claims.forEach((claim, index) => {
    if (claim.taskId !== artifact.taskId) {
      context.addIssue({
        code: "custom",
        message: "every Claim must match the envelope taskId",
        path: ["payload", "claims", index, "taskId"],
      });
    }
  });
});

export type ClaimLedgerArtifactV1 = z.infer<
  typeof ClaimLedgerArtifactV1Schema
>;

export const EvidenceLedgerPayloadV1Schema = z.strictObject({
  evidence: z.array(PersistedEvidenceV1Schema),
}).superRefine((ledger, context) => {
  uniqueValues(
    ledger.evidence.map((item) => item.id),
    context,
    ["evidence"],
    "evidence ids",
  );
});

export type EvidenceLedgerPayloadV1 = z.infer<
  typeof EvidenceLedgerPayloadV1Schema
>;

export const EvidenceLedgerArtifactV1Schema = createArtifactEnvelopeV1Schema(
  "evidence_ledger",
  EvidenceLedgerPayloadV1Schema,
);

export type EvidenceLedgerArtifactV1 = z.infer<
  typeof EvidenceLedgerArtifactV1Schema
>;
