import { z } from "zod";

import {
  ActorSchema,
  ActualChangeIdV1Schema,
  AnalysisBoundaryEvidenceIdV1Schema,
  AnalysisBoundaryIdV1Schema,
  ArtifactIdSchema,
  ClaimIdSchema,
  ContentDigestSchema,
  ContextGenerationIdV1Schema,
  DiffHunkEvidenceIdV1Schema,
  DiffHunkIdV1Schema,
  EffectiveRepositoryChangeIdV1Schema,
  EventIdSchema,
  IdempotencyKeySchema,
  ImpactPathIdSchema,
  IsoTimestampSchema,
  KeyedStateTokenV1Schema,
  NonEmptyStringSchema,
  OpaqueIdentifierSchema,
  PathSafeRepositoryIdV1Schema,
  PathSafeRepositoryRedactionIdV1Schema,
  PathSafeRepositoryRelativePathV1Schema,
  PathSafeRepositorySnapshotIdV1Schema,
  PathSafeWorktreeIdV1Schema,
  ProducerVersionSchema,
  RepositoryBasisRecordIdV1Schema,
  RepositoryDeltaSegmentIdV1Schema,
  RepositoryPathDeltaIdV1Schema,
  RevisionSchema,
  SourceSymbolRefIdV1Schema,
  StrongFindingIdV1Schema,
  StrongPlannedChangeIdV1Schema,
  StrongVerificationRecordIdV1Schema,
  TaskBaselineArtifactIdV1Schema,
  TaskIdSchema,
  VerificationPlanEntryIdV1Schema,
} from "./primitives.js";
import {
  StrongRepositorySnapshotV1Schema,
  type StrongRepositorySnapshotV1,
} from "./repository.js";
import {
  PlannedChangeExpectationV1Schema,
  ResolvedContextBuildSpecV1Schema,
  TaskManifestV1Schema,
  VerificationMethodV1Schema,
} from "./task.js";

const nonnegativeSafeInteger = z.number().int().nonnegative().safe();
const positiveSafeInteger = z.number().int().positive().safe();

function unique(
  values: readonly string[],
  context: z.RefinementCtx,
  path: PropertyKey[],
  label: string,
): void {
  if (new Set(values).size !== values.length) {
    context.addIssue({
      code: "custom",
      path,
      message: `${label} must be unique`,
    });
  }
}

function strictlySorted(
  values: readonly string[],
  context: z.RefinementCtx,
  path: PropertyKey[],
  label: string,
): void {
  unique(values, context, path, label);
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1]! >= values[index]!) {
      context.addIssue({
        code: "custom",
        path: [...path, index],
        message: `${label} must be strictly sorted`,
      });
      return;
    }
  }
}

export const AnalysisStatusV1Schema = z.enum([
  "complete",
  "partial",
  "unknown",
]);

export const RepositoryDeltaSourceV1Schema = z.enum([
  "baseline_reconciliation",
  "committed",
  "staged",
  "unstaged",
  "untracked",
  "conflict",
]);

const SOURCE_ORDER = new Map(
  RepositoryDeltaSourceV1Schema.options.map((source, index) => [source, index]),
);

export const DiffLineSpanV1Schema = z.strictObject({
  startLine: nonnegativeSafeInteger,
  lineCount: nonnegativeSafeInteger,
}).superRefine((span, context) => {
  if (span.lineCount > 0 && span.startLine < 1) {
    context.addIssue({
      code: "custom",
      path: ["startLine"],
      message: "a non-empty line span starts at a 1-based line",
    });
  }
});

export const SourcePointV1Schema = z.strictObject({
  line: positiveSafeInteger,
  column: nonnegativeSafeInteger,
  byteOffset: nonnegativeSafeInteger,
});

export const SourceSpanV1Schema = z.strictObject({
  start: SourcePointV1Schema,
  endExclusive: SourcePointV1Schema,
}).superRefine((span, context) => {
  if (span.endExclusive.byteOffset < span.start.byteOffset) {
    context.addIssue({
      code: "custom",
      path: ["endExclusive", "byteOffset"],
      message: "source span end must not precede its start",
    });
  }
});

export const AnalysisBoundaryStageV1Schema = z.enum([
  "baseline_capture",
  "repository_delta",
  "content_domain",
  "diff",
  "parse",
  "symbol_mapping",
  "planned_matching",
  "impact_analysis",
  "verification_coverage",
  "security_policy",
  "integrity",
]);

export const AnalysisBoundaryCodeV1Schema = z.enum([
  "sensitive_path",
  "secret_detected",
  "binary_content",
  "invalid_utf8",
  "invalid_repository_metadata",
  "unsafe_git_ref",
  "unrepresentable_path",
  "security_scan_unit_oversized",
  "security_scan_capture_limit",
  "unsupported_transform",
  "sparse_checkout",
  "conflict_without_final_bytes",
  "special_file",
  "symlink_boundary",
  "unavailable_content",
  "unstable_read",
  "missing_git_object",
  "unpinned_git_object",
  "budget_exhausted",
  "baseline_blob_budget_exhausted",
  "private_store_blob_quota_exhausted",
  "parser_unsupported",
  "parser_error",
  "ambiguous_symbol",
  "ambiguous_lineage",
  "graph_incomplete",
  "dynamic_dependency",
  "unsupported_verification_method",
  "ambiguous_verification_coverage",
  "policy_error",
  "artifact_integrity_error",
]);

export const AnalysisBoundaryScopeV1Schema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("repository") }),
  z.strictObject({
    kind: z.literal("path"),
    path: PathSafeRepositoryRelativePathV1Schema,
  }),
  z.strictObject({
    kind: z.literal("redacted_path_set"),
    count: positiveSafeInteger,
  }),
  z.strictObject({ kind: z.literal("hunk"), hunkId: DiffHunkIdV1Schema }),
  z.strictObject({
    kind: z.literal("symbol"),
    symbolRefId: SourceSymbolRefIdV1Schema,
  }),
  z.strictObject({ kind: z.literal("claim"), claimId: ClaimIdSchema }),
  z.strictObject({
    kind: z.literal("verification_plan_entry"),
    verificationPlanEntryId: VerificationPlanEntryIdV1Schema,
  }),
]);

export const AnalysisBoundaryV1Schema = z.strictObject({
  id: AnalysisBoundaryIdV1Schema,
  stage: AnalysisBoundaryStageV1Schema,
  code: AnalysisBoundaryCodeV1Schema,
  scope: AnalysisBoundaryScopeV1Schema,
  recovery: z.enum([
    "retry_after_refresh",
    "manual_inspection",
    "restore_artifact",
    "use_supported_repository_configuration",
    "reduce_scope",
    "increase_deterministic_budget",
    "increase_store_quota_or_cleanup",
    "supersede_task",
    "none",
  ]),
});

export const ChangeAnalysisBudgetV1Schema = z.strictObject({
  version: z.literal("change-analysis-budget-v1"),
  maxChangedFiles: positiveSafeInteger,
  maxBytesPerFile: positiveSafeInteger,
  maxTotalBytes: positiveSafeInteger,
  maxLinesPerFile: positiveSafeInteger,
  maxTotalLines: positiveSafeInteger,
  maxEditWorkUnits: positiveSafeInteger,
  maxHunksPerFile: positiveSafeInteger,
  maxTotalHunks: positiveSafeInteger,
  maxParserNodesPerFile: positiveSafeInteger,
  maxTotalParserNodes: positiveSafeInteger,
  maxMatchingWorkUnits: positiveSafeInteger,
  maxImpactNodes: positiveSafeInteger,
  maxImpactEdges: positiveSafeInteger,
  maxImpactTraversalWorkUnits: positiveSafeInteger,
  maxImpactPaths: positiveSafeInteger,
  maxExcerptCharsPerEvidence: positiveSafeInteger,
  maxTotalExcerptChars: positiveSafeInteger,
  maxActualChanges: positiveSafeInteger,
  maxEvidenceItems: positiveSafeInteger,
  maxSymbolRefs: positiveSafeInteger,
  maxSerializedArtifactBytes: positiveSafeInteger,
});

export const ChangeAnalysisUsageV1Schema = z.strictObject({
  changedFiles: nonnegativeSafeInteger,
  analyzedFiles: nonnegativeSafeInteger,
  bytes: nonnegativeSafeInteger,
  lines: nonnegativeSafeInteger,
  editWorkUnits: nonnegativeSafeInteger,
  hunks: nonnegativeSafeInteger,
  parserNodes: nonnegativeSafeInteger,
  matchingWorkUnits: nonnegativeSafeInteger,
  impactNodes: nonnegativeSafeInteger,
  impactEdges: nonnegativeSafeInteger,
  impactTraversalWorkUnits: nonnegativeSafeInteger,
  impactPaths: nonnegativeSafeInteger,
  excerptChars: z.literal(0),
  actualChanges: nonnegativeSafeInteger,
  evidenceItems: nonnegativeSafeInteger,
  symbolRefs: nonnegativeSafeInteger,
  serializedArtifactBytes: nonnegativeSafeInteger,
});

const CHANGE_ANALYSIS_USAGE_LIMIT_V1 = {
  changedFiles: "maxChangedFiles",
  analyzedFiles: "maxChangedFiles",
  bytes: "maxTotalBytes",
  lines: "maxTotalLines",
  editWorkUnits: "maxEditWorkUnits",
  hunks: "maxTotalHunks",
  parserNodes: "maxTotalParserNodes",
  matchingWorkUnits: "maxMatchingWorkUnits",
  impactNodes: "maxImpactNodes",
  impactEdges: "maxImpactEdges",
  impactTraversalWorkUnits: "maxImpactTraversalWorkUnits",
  impactPaths: "maxImpactPaths",
  excerptChars: "maxTotalExcerptChars",
  actualChanges: "maxActualChanges",
  evidenceItems: "maxEvidenceItems",
  symbolRefs: "maxSymbolRefs",
  serializedArtifactBytes: "maxSerializedArtifactBytes",
} as const;

function validateChangeAnalysisUsageWithinBudgetV1(
  usage: z.infer<typeof ChangeAnalysisUsageV1Schema>,
  budget: z.infer<typeof ChangeAnalysisBudgetV1Schema>,
  context: z.RefinementCtx,
  path: PropertyKey[],
): void {
  for (const [usageField, budgetField] of Object.entries(
    CHANGE_ANALYSIS_USAGE_LIMIT_V1,
  ) as Array<[
    keyof typeof CHANGE_ANALYSIS_USAGE_LIMIT_V1,
    (typeof CHANGE_ANALYSIS_USAGE_LIMIT_V1)[keyof typeof CHANGE_ANALYSIS_USAGE_LIMIT_V1],
  ]>) {
    if (usage[usageField] > budget[budgetField]) {
      context.addIssue({
        code: "custom",
        path: [...path, usageField],
        message: `${usageField} must not exceed ${budgetField}`,
      });
    }
  }
}

const GitObjectIdV1Schema = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u);
const GitModeV1Schema = z.enum(["040000", "100644", "100755", "120000", "160000"]);

export const RepositoryContentStateV1Schema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("absent"),
    path: PathSafeRepositoryRelativePathV1Schema,
  }),
  z.strictObject({
    status: z.literal("content"),
    path: PathSafeRepositoryRelativePathV1Schema,
    domain: z.enum([
      "git_object",
      "index_blob",
      "worktree_raw",
      "baseline_private_blob",
    ]),
    objectId: GitObjectIdV1Schema.optional(),
    contentDigest: ContentDigestSchema,
    mode: GitModeV1Schema,
    size: nonnegativeSafeInteger,
  }).superRefine((state, context) => {
    const requiresObject = state.domain === "git_object" || state.domain === "index_blob";
    if (requiresObject !== (state.objectId !== undefined)) {
      context.addIssue({
        code: "custom",
        path: ["objectId"],
        message: "only Git object and index content states carry an object ID",
      });
    }
  }),
  z.strictObject({
    status: z.literal("metadata_only"),
    path: PathSafeRepositoryRelativePathV1Schema,
    kind: z.enum(["binary", "special", "unavailable"]),
    mode: GitModeV1Schema.optional(),
    size: nonnegativeSafeInteger.optional(),
    boundaryIds: z.array(AnalysisBoundaryIdV1Schema).min(1),
  }),
  z.strictObject({
    status: z.literal("conflict"),
    path: PathSafeRepositoryRelativePathV1Schema,
    stages: z.array(z.strictObject({
      stage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      objectId: GitObjectIdV1Schema,
      mode: GitModeV1Schema,
    })).min(1),
    boundaryIds: z.array(AnalysisBoundaryIdV1Schema).min(1),
  }),
]);

export const RepositoryDeltaSegmentV1Schema = z.strictObject({
  id: RepositoryDeltaSegmentIdV1Schema,
  source: RepositoryDeltaSourceV1Schema,
  before: RepositoryContentStateV1Schema,
  after: RepositoryContentStateV1Schema,
  status: AnalysisStatusV1Schema,
  boundaryIds: z.array(AnalysisBoundaryIdV1Schema),
}).superRefine((segment, context) => {
  unique(segment.boundaryIds, context, ["boundaryIds"], "segment boundary IDs");
  if ((segment.status === "complete") !== (segment.boundaryIds.length === 0)) {
    context.addIssue({
      code: "custom",
      path: ["status"],
      message: "complete segments are boundary-free; partial/unknown segments name a boundary",
    });
  }
});

export const EffectiveRepositoryChangeV1Schema = z.strictObject({
  id: EffectiveRepositoryChangeIdV1Schema,
  kind: z.enum(["added", "modified", "deleted", "renamed", "copied", "type_changed"]),
  before: RepositoryContentStateV1Schema,
  after: RepositoryContentStateV1Schema,
  sourceSegmentIds: z.array(RepositoryDeltaSegmentIdV1Schema).min(1),
  status: AnalysisStatusV1Schema,
  boundaryIds: z.array(AnalysisBoundaryIdV1Schema),
}).superRefine((change, context) => {
  unique(change.sourceSegmentIds, context, ["sourceSegmentIds"], "effective source segment IDs");
  unique(change.boundaryIds, context, ["boundaryIds"], "effective boundary IDs");
  if ((change.status === "complete") !== (change.boundaryIds.length === 0)) {
    context.addIssue({
      code: "custom",
      path: ["status"],
      message: "complete effective changes are boundary-free; partial/unknown changes name a boundary",
    });
  }
});

export const RepositoryPathDeltaV1Schema = z.strictObject({
  id: RepositoryPathDeltaIdV1Schema,
  path: PathSafeRepositoryRelativePathV1Schema,
  oldPath: PathSafeRepositoryRelativePathV1Schema.optional(),
  segments: z.array(RepositoryDeltaSegmentV1Schema).min(1),
  effectiveChange: EffectiveRepositoryChangeV1Schema.optional(),
}).superRefine((delta, context) => {
  unique(delta.segments.map((segment) => segment.id), context, ["segments"], "segment IDs");
  const first = delta.segments[0]!;
  const last = delta.segments.at(-1)!;
  if (first.before.path !== (delta.oldPath ?? delta.path)) {
    context.addIssue({ code: "custom", path: ["segments", 0, "before", "path"], message: "the first segment must start at the enclosing path lineage" });
  }
  if (last.after.path !== delta.path) {
    context.addIssue({ code: "custom", path: ["segments", delta.segments.length - 1, "after", "path"], message: "the last segment must end at the target path" });
  }
  for (let index = 1; index < delta.segments.length; index += 1) {
    const previous = delta.segments[index - 1]!;
    const current = delta.segments[index]!;
    if ((SOURCE_ORDER.get(previous.source) ?? 99) >= (SOURCE_ORDER.get(current.source) ?? 99)) {
      context.addIssue({ code: "custom", path: ["segments", index, "source"], message: "segments must use frozen source order" });
    }
    if (JSON.stringify(previous.after) !== JSON.stringify(current.before)) {
      context.addIssue({ code: "custom", path: ["segments", index, "before"], message: "delta segment states must form a continuous chain" });
    }
  }
  const effective = delta.effectiveChange;
  if (effective !== undefined) {
    const segmentIds = new Set(delta.segments.map((segment) => segment.id));
    if (effective.sourceSegmentIds.some((id) => !segmentIds.has(id))) {
      context.addIssue({ code: "custom", path: ["effectiveChange", "sourceSegmentIds"], message: "effective lineage must resolve to this path delta" });
    }
    if (effective.before.path !== (delta.oldPath ?? delta.path) || effective.after.path !== delta.path) {
      context.addIssue({ code: "custom", path: ["effectiveChange"], message: "effective before/after paths must match path lineage" });
    }
    if (JSON.stringify(effective.before) !== JSON.stringify(first.before) || JSON.stringify(effective.after) !== JSON.stringify(last.after)) {
      context.addIssue({ code: "custom", path: ["effectiveChange"], message: "effective states must equal the first before and final after states" });
    }
    const lineagePositions = effective.sourceSegmentIds.map((id) =>
      delta.segments.findIndex((segment) => segment.id === id)
    );
    for (let index = 1; index < lineagePositions.length; index += 1) {
      if (lineagePositions[index - 1]! >= lineagePositions[index]!) {
        context.addIssue({ code: "custom", path: ["effectiveChange", "sourceSegmentIds", index], message: "effective lineage must preserve frozen segment order" });
        break;
      }
    }
    const renamed = effective.kind === "renamed" || effective.kind === "copied";
    if (renamed !== (delta.oldPath !== undefined)) {
      context.addIssue({ code: "custom", path: ["oldPath"], message: "only renamed/copied path deltas carry oldPath" });
    }
    if (delta.oldPath === delta.path) {
      context.addIssue({ code: "custom", path: ["oldPath"], message: "oldPath must differ from path" });
    }
    const beforeAbsent = effective.before.status === "absent";
    const afterAbsent = effective.after.status === "absent";
    if (
      (effective.kind === "added" && (!beforeAbsent || afterAbsent)) ||
      (effective.kind === "deleted" && (beforeAbsent || !afterAbsent)) ||
      (["modified", "type_changed", "renamed", "copied"].includes(effective.kind) && (beforeAbsent || afterAbsent))
    ) {
      context.addIssue({ code: "custom", path: ["effectiveChange", "kind"], message: "effective kind must match before/after presence" });
    }
  } else {
    if (delta.oldPath !== undefined || JSON.stringify(first.before) !== JSON.stringify(last.after)) {
      context.addIssue({ code: "custom", path: ["effectiveChange"], message: "a path without an effective change must be a canonical no-op" });
    }
  }
});

export const RedactedRepositoryDeltaAggregateV1Schema = z.strictObject({
  sourceSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
  snapshotRedactionId: PathSafeRepositoryRedactionIdV1Schema,
  source: z.enum(["committed", "staged", "unstaged", "untracked", "conflict"]),
  kind: z.enum(["added", "modified", "deleted", "renamed", "copied", "type_changed", "unknown"]),
  count: positiveSafeInteger,
  boundaryId: AnalysisBoundaryIdV1Schema,
});

export const RepositoryDeltaV1Schema = z.strictObject({
  profile: z.literal("final-tree-delta-v1"),
  taskId: TaskIdSchema,
  baselineSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
  actualSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
  paths: z.array(RepositoryPathDeltaV1Schema),
  redactedAggregates: z.array(RedactedRepositoryDeltaAggregateV1Schema),
  status: AnalysisStatusV1Schema,
  boundaryIds: z.array(AnalysisBoundaryIdV1Schema),
}).superRefine((delta, context) => {
  unique(delta.paths.map((path) => path.id), context, ["paths"], "path delta IDs");
  unique(delta.redactedAggregates.map((entry) => entry.snapshotRedactionId), context, ["redactedAggregates"], "redaction IDs");
  if ((delta.status === "complete") !== (delta.boundaryIds.length === 0)) {
    context.addIssue({ code: "custom", path: ["status"], message: "complete Delta is boundary-free; partial/unknown Delta has a boundary" });
  }
});

export const DiffOperationV1Schema = z.strictObject({
  op: z.enum(["equal", "delete", "insert"]),
  lineDigest: ContentDigestSchema,
});

const DiffContentIdentityV1Schema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("absent") }),
  z.strictObject({ status: z.literal("content"), contentDigest: ContentDigestSchema }),
]);

export const DiffHunkV1Schema = z.strictObject({
  id: DiffHunkIdV1Schema,
  algorithm: z.literal("diff-lines-v1"),
  baselineSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
  actualSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
  path: PathSafeRepositoryRelativePathV1Schema,
  oldPath: PathSafeRepositoryRelativePathV1Schema.optional(),
  beforeContent: DiffContentIdentityV1Schema,
  afterContent: DiffContentIdentityV1Schema,
  oldSpan: DiffLineSpanV1Schema,
  newSpan: DiffLineSpanV1Schema,
  sourceLayers: z.array(RepositoryDeltaSourceV1Schema).min(1),
  operations: z.array(DiffOperationV1Schema).min(1),
  operationsDigest: ContentDigestSchema,
  patchDigest: ContentDigestSchema,
}).superRefine((hunk, context) => {
  unique(hunk.sourceLayers, context, ["sourceLayers"], "hunk source layers");
  if (hunk.sourceLayers.includes("conflict")) {
    context.addIssue({ code: "custom", path: ["sourceLayers"], message: "text Diff Hunks cannot claim unresolved conflict bytes" });
  }
  for (let index = 1; index < hunk.sourceLayers.length; index += 1) {
    if ((SOURCE_ORDER.get(hunk.sourceLayers[index - 1]!) ?? 99) >= (SOURCE_ORDER.get(hunk.sourceLayers[index]!) ?? 99)) {
      context.addIssue({ code: "custom", path: ["sourceLayers", index], message: "hunk source layers must use frozen source order" });
      break;
    }
  }
  if (!hunk.operations.some((operation) => operation.op !== "equal")) {
    context.addIssue({ code: "custom", path: ["operations"], message: "a Diff Hunk requires a canonical edit" });
  }
  const oldCount = hunk.operations.filter((operation) => operation.op !== "insert").length;
  const newCount = hunk.operations.filter((operation) => operation.op !== "delete").length;
  if (hunk.oldSpan.lineCount !== oldCount || hunk.newSpan.lineCount !== newCount) {
    context.addIssue({ code: "custom", path: ["operations"], message: "operation counts must equal old/new spans" });
  }
  if (hunk.beforeContent.status === "absent") {
    if (hunk.oldSpan.startLine !== 0 || hunk.oldSpan.lineCount !== 0 || hunk.operations.some((operation) => operation.op !== "insert")) {
      context.addIssue({ code: "custom", path: ["beforeContent"], message: "an absent before side requires a zero span and insert-only operations" });
    }
  }
  if (hunk.afterContent.status === "absent") {
    if (hunk.newSpan.startLine !== 0 || hunk.newSpan.lineCount !== 0 || hunk.operations.some((operation) => operation.op !== "delete")) {
      context.addIssue({ code: "custom", path: ["afterContent"], message: "an absent after side requires a zero span and delete-only operations" });
    }
  }
  if (hunk.beforeContent.status === "absent" && hunk.afterContent.status === "absent") {
    context.addIssue({ code: "custom", path: ["afterContent"], message: "a Diff Hunk cannot have two absent sides" });
  }
});

export const SourceSymbolRefV1Schema = z.strictObject({
  id: SourceSymbolRefIdV1Schema,
  snapshotId: PathSafeRepositorySnapshotIdV1Schema,
  path: PathSafeRepositoryRelativePathV1Schema,
  language: NonEmptyStringSchema,
  parserVersion: NonEmptyStringSchema,
  kind: z.enum(["function", "method", "class", "constructor", "module", "type"]),
  qualifiedName: NonEmptyStringSchema,
  parentId: SourceSymbolRefIdV1Schema.optional(),
  fullSpan: SourceSpanV1Schema,
  signatureSpan: SourceSpanV1Schema,
  bodySpan: SourceSpanV1Schema.optional(),
  declarationDigest: ContentDigestSchema,
  graphNodeId: OpaqueIdentifierSchema.optional(),
}).superRefine((symbol, context) => {
  for (const [field, span] of [
    ["signatureSpan", symbol.signatureSpan],
    ...(symbol.bodySpan === undefined
      ? []
      : [["bodySpan", symbol.bodySpan] as const]),
  ] as const) {
    if (
      span.start.byteOffset < symbol.fullSpan.start.byteOffset ||
      span.endExclusive.byteOffset > symbol.fullSpan.endExclusive.byteOffset
    ) {
      context.addIssue({ code: "custom", path: [field], message: `${field} must be contained by fullSpan` });
    }
  }
});

export const SemanticFacetV1Schema = z.enum([
  "BODY_LOGIC",
  "SIGNATURE",
  "DEPENDENCY",
  "TOPOLOGY",
  "TEST",
  "CONFIG",
  "SCHEMA",
  "DOCUMENTATION",
  "FORMATTING_OR_COMMENT",
  "UNKNOWN",
]);

export const StrongAnalyzedHunkV1Schema = z.strictObject({
  hunk: DiffHunkV1Schema,
  oldSymbolRefs: z.array(SourceSymbolRefV1Schema),
  newSymbolRefs: z.array(SourceSymbolRefV1Schema),
  pairingStatus: z.enum(["exact", "renamed", "old_only", "new_only", "ambiguous", "file_only"]),
  semanticFacets: z.array(SemanticFacetV1Schema).min(1),
  status: AnalysisStatusV1Schema,
  boundaryIds: z.array(AnalysisBoundaryIdV1Schema),
}).superRefine((analysis, context) => {
  unique(analysis.oldSymbolRefs.map((symbol) => symbol.id), context, ["oldSymbolRefs"], "old symbol refs");
  unique(analysis.newSymbolRefs.map((symbol) => symbol.id), context, ["newSymbolRefs"], "new symbol refs");
  unique(analysis.semanticFacets, context, ["semanticFacets"], "semantic facets");
  if ((analysis.status === "complete") !== (analysis.boundaryIds.length === 0)) {
    context.addIssue({ code: "custom", path: ["status"], message: "complete hunk analysis is boundary-free" });
  }
  const oldCount = analysis.oldSymbolRefs.length;
  const newCount = analysis.newSymbolRefs.length;
  const pairingValid =
    ((analysis.pairingStatus === "exact" || analysis.pairingStatus === "renamed") && oldCount > 0 && newCount > 0) ||
    (analysis.pairingStatus === "old_only" && oldCount > 0 && newCount === 0) ||
    (analysis.pairingStatus === "new_only" && oldCount === 0 && newCount > 0) ||
    (analysis.pairingStatus === "file_only" && oldCount === 0 && newCount === 0) ||
    (analysis.pairingStatus === "ambiguous" && oldCount + newCount > 0 && analysis.boundaryIds.length > 0);
  if (!pairingValid) {
    context.addIssue({ code: "custom", path: ["pairingStatus"], message: "pairingStatus must exactly describe old/new Symbol Ref presence" });
  }
});

export const ActualChangeV1Schema = z.strictObject({
  id: ActualChangeIdV1Schema,
  repositoryPathDeltaId: RepositoryPathDeltaIdV1Schema,
  effectiveChangeId: EffectiveRepositoryChangeIdV1Schema,
  path: PathSafeRepositoryRelativePathV1Schema,
  oldPath: PathSafeRepositoryRelativePathV1Schema.optional(),
  kind: z.enum(["added", "modified", "deleted", "renamed", "copied", "type_changed"]),
  sourceLayers: z.array(RepositoryDeltaSourceV1Schema).min(1),
  granularity: z.enum(["symbol", "hunk", "file"]),
  oldSymbolRefs: z.array(SourceSymbolRefV1Schema),
  newSymbolRefs: z.array(SourceSymbolRefV1Schema),
  pairingStatus: z.enum(["exact", "renamed", "old_only", "new_only", "ambiguous", "file_only"]),
  semanticFacets: z.array(SemanticFacetV1Schema).min(1),
  diffEvidenceIds: z.array(DiffHunkEvidenceIdV1Schema),
  boundaryEvidenceIds: z.array(AnalysisBoundaryEvidenceIdV1Schema),
  analysisStatus: AnalysisStatusV1Schema,
}).superRefine((actual, context) => {
  unique(actual.sourceLayers, context, ["sourceLayers"], "actual source layers");
  unique(actual.semanticFacets, context, ["semanticFacets"], "actual facets");
  for (let index = 1; index < actual.sourceLayers.length; index += 1) {
    if ((SOURCE_ORDER.get(actual.sourceLayers[index - 1]!) ?? 99) >= (SOURCE_ORDER.get(actual.sourceLayers[index]!) ?? 99)) {
      context.addIssue({ code: "custom", path: ["sourceLayers", index], message: "Actual source layers must use frozen source order" });
      break;
    }
  }
  if (actual.granularity === "symbol" && actual.oldSymbolRefs.length + actual.newSymbolRefs.length === 0) {
    context.addIssue({ code: "custom", path: ["granularity"], message: "symbol granularity requires a mapped symbol" });
  }
  if (actual.granularity === "hunk" && actual.diffEvidenceIds.length === 0) {
    context.addIssue({ code: "custom", path: ["granularity"], message: "hunk granularity requires Diff Evidence" });
  }
  if (actual.granularity === "file" && actual.oldSymbolRefs.length + actual.newSymbolRefs.length !== 0) {
    context.addIssue({ code: "custom", path: ["granularity"], message: "file granularity cannot carry Symbol Refs" });
  }
  const oldPathRequired = actual.kind === "renamed" || actual.kind === "copied";
  if (oldPathRequired !== (actual.oldPath !== undefined) || actual.oldPath === actual.path) {
    context.addIssue({ code: "custom", path: ["oldPath"], message: "only renamed/copied Actual Changes carry a distinct oldPath" });
  }
  const allowedPairing = actual.kind === "added"
    ? new Set(["new_only", "file_only"])
    : actual.kind === "deleted"
      ? new Set(["old_only", "file_only"])
      : new Set(["exact", "renamed", "old_only", "new_only", "ambiguous", "file_only"]);
  if (!allowedPairing.has(actual.pairingStatus)) {
    context.addIssue({ code: "custom", path: ["pairingStatus"], message: `pairingStatus is invalid for ${actual.kind}` });
  }
  if ((actual.analysisStatus === "complete") !== (actual.boundaryEvidenceIds.length === 0)) {
    context.addIssue({ code: "custom", path: ["analysisStatus"], message: "complete Actual Change is boundary-free" });
  }
  if (actual.analysisStatus === "complete" && actual.semanticFacets.includes("UNKNOWN")) {
    context.addIssue({ code: "custom", path: ["semanticFacets"], message: "complete Actual Changes cannot retain UNKNOWN semantics" });
  }
});

export const CompletenessDimensionNameV1Schema = z.enum([
  "repository_delta",
  "semantic_classification",
  "planned_matching",
  "impact_analysis",
  "verification_coverage",
]);

export const CompletenessUnitV1Schema = z.strictObject({
  unitKind: z.enum([
    "repository_path_delta",
    "redacted_repository_aggregate",
    "actual_change",
    "required_planned_change",
    "acceptance_claim",
  ]),
  unitId: NonEmptyStringSchema,
  status: AnalysisStatusV1Schema,
  boundaryEvidenceIds: z.array(AnalysisBoundaryEvidenceIdV1Schema),
}).superRefine((unit, context) => {
  if ((unit.status === "complete") !== (unit.boundaryEvidenceIds.length === 0)) {
    context.addIssue({ code: "custom", path: ["status"], message: "complete units are boundary-free" });
  }
});

export const CompletenessDimensionV1Schema = z.strictObject({
  dimension: CompletenessDimensionNameV1Schema,
  status: AnalysisStatusV1Schema,
  units: z.array(CompletenessUnitV1Schema),
  boundaryEvidenceIds: z.array(AnalysisBoundaryEvidenceIdV1Schema),
}).superRefine((dimension, context) => {
  unique(dimension.units.map((unit) => `${unit.unitKind}\0${unit.unitId}`), context, ["units"], "completeness units");
  unique(dimension.boundaryEvidenceIds, context, ["boundaryEvidenceIds"], "dimension Boundary Evidence IDs");
  const rank = { complete: 0, partial: 1, unknown: 2 } as const;
  const expected = [...dimension.units.map((unit) => unit.status),
    ...(dimension.boundaryEvidenceIds.length === 0 ? [] : ["unknown" as const])]
    .reduce<AnalysisStatusV1>((worst, status) => rank[status] > rank[worst] ? status : worst, "complete");
  if (dimension.status !== expected) {
    context.addIssue({ code: "custom", path: ["status"], message: "dimension status must be the exact worst unit/boundary status" });
  }
});

export const StrongImpactConclusionV1Schema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("paths_observed"),
    impactPathIds: z.array(ImpactPathIdSchema).min(1),
    boundaryEvidenceIds: z.tuple([]),
  }),
  z.strictObject({
    status: z.literal("none_observed"),
    impactPathIds: z.tuple([]),
    boundaryEvidenceIds: z.tuple([]),
  }),
  z.strictObject({
    status: z.literal("partial"),
    impactPathIds: z.array(ImpactPathIdSchema),
    boundaryEvidenceIds: z.array(AnalysisBoundaryEvidenceIdV1Schema).min(1),
  }),
  z.strictObject({
    status: z.literal("unknown"),
    impactPathIds: z.tuple([]),
    boundaryEvidenceIds: z.array(AnalysisBoundaryEvidenceIdV1Schema).min(1),
  }),
]).superRefine((conclusion, context) => {
  unique(conclusion.impactPathIds, context, ["impactPathIds"], "Impact Path IDs");
  unique(conclusion.boundaryEvidenceIds, context, ["boundaryEvidenceIds"], "Impact Boundary Evidence IDs");
});

export const VerificationGapV1Schema = z.discriminatedUnion("subtype", [
  z.strictObject({
    subtype: z.literal("missing_plan_entry"),
    uncoveredClaimIds: z.array(ClaimIdSchema).min(1),
    verificationPlanEntryIds: z.tuple([]),
    boundaryEvidenceIds: z.tuple([]),
  }),
  z.strictObject({
    subtype: z.literal("insufficient_coverage"),
    uncoveredClaimIds: z.array(ClaimIdSchema).min(1),
    verificationPlanEntryIds: z.array(VerificationPlanEntryIdV1Schema).min(1),
    boundaryEvidenceIds: z.tuple([]),
  }),
  z.strictObject({
    subtype: z.enum(["unsupported_method", "ambiguous_coverage"]),
    uncoveredClaimIds: z.array(ClaimIdSchema).min(1),
    verificationPlanEntryIds: z.array(VerificationPlanEntryIdV1Schema).min(1),
    boundaryEvidenceIds: z.array(AnalysisBoundaryEvidenceIdV1Schema).min(1),
  }),
]);

export const StrongChangeFindingV1Schema = z.strictObject({
  profile: z.literal("evidence_backed_v1"),
  id: StrongFindingIdV1Schema,
  type: z.enum(["planned_completed", "planned_partial", "unplanned_change", "possible_omission", "verification_gap", "cannot_determine"]),
  severity: z.enum(["info", "warning", "error", "critical"]),
  blocking: z.boolean(),
  summary: NonEmptyStringSchema,
  claimIds: z.array(ClaimIdSchema).min(1),
  plannedChangeIds: z.array(StrongPlannedChangeIdV1Schema),
  actualChangeIds: z.array(ActualChangeIdV1Schema),
  evidenceIds: z.array(z.union([
    DiffHunkEvidenceIdV1Schema,
    AnalysisBoundaryEvidenceIdV1Schema,
    OpaqueIdentifierSchema,
  ])),
  impactPathIds: z.array(ImpactPathIdSchema),
  verificationGap: VerificationGapV1Schema.optional(),
  resolution: z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("fixed"),
      resolvedAt: IsoTimestampSchema,
      snapshotId: PathSafeRepositorySnapshotIdV1Schema,
      evidenceIds: z.array(z.union([DiffHunkEvidenceIdV1Schema, AnalysisBoundaryEvidenceIdV1Schema])).min(1),
    }),
    z.strictObject({
      kind: z.literal("accepted"),
      actor: ActorSchema,
      reason: NonEmptyStringSchema,
      at: IsoTimestampSchema,
      eventId: EventIdSchema,
    }),
  ]).optional(),
}).superRefine((finding, context) => {
  for (const [field, values] of [
    ["claimIds", finding.claimIds],
    ["plannedChangeIds", finding.plannedChangeIds],
    ["actualChangeIds", finding.actualChangeIds],
    ["evidenceIds", finding.evidenceIds],
    ["impactPathIds", finding.impactPathIds],
  ] as const) unique(values, context, [field], field);
  if ((finding.type === "verification_gap") !== (finding.verificationGap !== undefined)) {
    context.addIssue({ code: "custom", path: ["verificationGap"], message: "only verification_gap carries its typed gap" });
  }
  if (
    (finding.type === "planned_completed" || finding.type === "planned_partial") &&
    (finding.plannedChangeIds.length === 0 || finding.actualChangeIds.length === 0)
  ) {
    context.addIssue({ code: "custom", path: ["plannedChangeIds"], message: "planned findings require nonempty Planned and Actual references" });
  }
  if (finding.type === "unplanned_change" && (finding.plannedChangeIds.length !== 0 || finding.actualChangeIds.length === 0)) {
    context.addIssue({ code: "custom", path: ["actualChangeIds"], message: "unplanned findings have Actual Changes and no Planned Change" });
  }
  if (finding.type === "possible_omission" && (finding.plannedChangeIds.length === 0 || finding.actualChangeIds.length !== 0)) {
    context.addIssue({ code: "custom", path: ["plannedChangeIds"], message: "omission findings have required Planned Changes and no Actual Change" });
  }
  if (
    finding.type === "cannot_determine" &&
    (finding.plannedChangeIds.length + finding.actualChangeIds.length === 0 ||
      !finding.evidenceIds.some((id) => id.startsWith("boundary-evidence:")))
  ) {
    context.addIssue({ code: "custom", path: ["evidenceIds"], message: "cannot_determine requires a Planned/Actual unit and structured Boundary Evidence" });
  }
  if (
    finding.type === "verification_gap" &&
    (finding.plannedChangeIds.length !== 0 || finding.actualChangeIds.length !== 0)
  ) {
    context.addIssue({ code: "custom", path: ["actualChangeIds"], message: "verification_gap is secondary and cannot carry Planned or Actual references" });
  }
  if (finding.verificationGap !== undefined) {
    if (finding.verificationGap.uncoveredClaimIds.some((id) => !finding.claimIds.includes(id))) {
      context.addIssue({ code: "custom", path: ["verificationGap", "uncoveredClaimIds"], message: "uncovered Claims must be a subset of top-level claimIds" });
    }
    if (finding.verificationGap.boundaryEvidenceIds.some((id) => !finding.evidenceIds.includes(id))) {
      context.addIssue({ code: "custom", path: ["verificationGap", "boundaryEvidenceIds"], message: "gap Boundaries must be a subset of top-level evidenceIds" });
    }
  }
});

export const DiffHunkEvidenceV1Schema = z.strictObject({
  id: DiffHunkEvidenceIdV1Schema,
  profile: z.literal("evidence_backed_v1"),
  kind: z.literal("diff_hunk"),
  epistemicStatus: z.literal("observed"),
  freshness: z.literal("current"),
  claimIds: z.array(ClaimIdSchema),
  nodeIds: z.array(OpaqueIdentifierSchema),
  producedBy: NonEmptyStringSchema,
  createdAt: IsoTimestampSchema,
  observedAtSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
  filePath: PathSafeRepositoryRelativePathV1Schema,
  hunk: DiffHunkV1Schema,
});

export const StructuredAnalysisBoundaryEvidenceV1Schema = z.strictObject({
  id: AnalysisBoundaryEvidenceIdV1Schema,
  profile: z.literal("evidence_backed_v1"),
  kind: z.literal("analysis_boundary"),
  epistemicStatus: z.literal("unknown"),
  freshness: z.literal("current"),
  claimIds: z.array(ClaimIdSchema),
  nodeIds: z.array(OpaqueIdentifierSchema),
  producedBy: NonEmptyStringSchema,
  createdAt: IsoTimestampSchema,
  observedAtSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
  boundary: AnalysisBoundaryV1Schema,
});

export const StrongFindingClaimV1Schema = z.strictObject({
  id: ClaimIdSchema,
  taskId: TaskIdSchema,
  kind: z.literal("finding"),
  statement: NonEmptyStringSchema,
  epistemicStatus: z.enum(["observed", "unknown"]),
  lifecycleStatus: z.enum(["supported", "draft"]),
  freshness: z.literal("current"),
  sourceSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
  evidenceIds: z.array(z.union([DiffHunkEvidenceIdV1Schema, AnalysisBoundaryEvidenceIdV1Schema])),
  findingIds: z.array(StrongFindingIdV1Schema).length(1),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});

export const ConfirmedObligationProjectionV1Schema = z.strictObject({
  plannedChangeId: StrongPlannedChangeIdV1Schema,
  contextGenerationId: ContextGenerationIdV1Schema,
  expectation: PlannedChangeExpectationV1Schema,
  filePath: PathSafeRepositoryRelativePathV1Schema,
  symbolId: OpaqueIdentifierSchema.optional(),
  intentDigest: ContentDigestSchema,
  claimIds: z.array(ClaimIdSchema).min(1),
  impactPathIds: z.array(ImpactPathIdSchema),
  confirmationEventId: EventIdSchema,
});

export const VerificationPlanProjectionV1Schema = z.strictObject({
  verificationPlanEntryId: VerificationPlanEntryIdV1Schema,
  acceptanceClaimIds: z.array(ClaimIdSchema).min(1),
  method: VerificationMethodV1Schema,
  required: z.boolean(),
});

const BaselinePathCaptureV1Schema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("absent") }),
  z.strictObject({ status: z.literal("git_object"), objectId: GitObjectIdV1Schema, mode: GitModeV1Schema, size: nonnegativeSafeInteger, contentDigest: ContentDigestSchema }),
  z.strictObject({ status: z.literal("private_blob"), privateBlobId: NonEmptyStringSchema, privateContentDigest: ContentDigestSchema, mode: GitModeV1Schema, size: nonnegativeSafeInteger }),
  z.strictObject({ status: z.enum(["binary", "oversized", "unreadable", "special"]), mode: GitModeV1Schema.optional(), size: nonnegativeSafeInteger.optional(), boundaryIds: z.array(AnalysisBoundaryIdV1Schema).min(1) }),
  z.strictObject({
    status: z.literal("conflict"),
    stages: z.array(z.strictObject({
      stage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      objectId: GitObjectIdV1Schema,
      mode: GitModeV1Schema,
    })).min(1),
    boundaryIds: z.array(AnalysisBoundaryIdV1Schema).min(1),
  }),
]);

export const InternalTaskBaselineV1Schema = z.strictObject({
  profile: z.literal("task_baseline_v1"),
  artifactId: TaskBaselineArtifactIdV1Schema,
  materializationVersion: positiveSafeInteger,
  taskId: TaskIdSchema,
  repositoryId: PathSafeRepositoryIdV1Schema,
  worktreeId: PathSafeWorktreeIdV1Schema,
  captureSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
  baselineHead: z.discriminatedUnion("status", [
    z.strictObject({
      status: z.literal("present"),
      commit: GitObjectIdV1Schema,
      treeObjectId: GitObjectIdV1Schema,
      gitLease: z.discriminatedUnion("status", [
        z.strictObject({
          status: z.literal("pinned"),
          leaseId: NonEmptyStringSchema,
          refName: z.string().regex(/^refs\/understand-code\/task-baselines\/[0-9a-f]{22}-[0-9a-f]{32}$/u),
          objectId: GitObjectIdV1Schema,
        }),
        z.strictObject({
          status: z.literal("unpinned"),
          boundaryId: AnalysisBoundaryIdV1Schema,
        }),
      ]),
    }),
    z.strictObject({
      status: z.literal("unborn"),
      emptyTreeObjectId: GitObjectIdV1Schema,
    }),
  ]),
  repositoryStateToken: KeyedStateTokenV1Schema,
  attributesDigest: ContentDigestSchema,
  scannerPolicyDigest: ContentDigestSchema,
  repositoryPolicyDigest: ContentDigestSchema,
  safeGitExecutionDigest: ContentDigestSchema,
  baselineMaterializationBudgetDigest: ContentDigestSchema,
  privateStoreQuotaPolicyDigest: ContentDigestSchema,
  captureStatus: z.enum(["complete", "partial"]),
  paths: z.array(z.strictObject({
    path: PathSafeRepositoryRelativePathV1Schema,
    finalKind: z.enum(["file", "directory", "symlink", "gitlink", "absent", "unknown"]),
    capture: BaselinePathCaptureV1Schema,
  })),
  redactedUnits: z.strictObject({ count: nonnegativeSafeInteger, boundaryIds: z.array(AnalysisBoundaryIdV1Schema) }),
  boundaries: z.array(AnalysisBoundaryV1Schema),
}).superRefine((baseline, context) => {
  strictlySorted(baseline.paths.map((entry) => entry.path), context, ["paths"], "baseline paths");
  if ((baseline.captureStatus === "complete") !== (baseline.boundaries.length === 0 && baseline.redactedUnits.count === 0)) {
    context.addIssue({ code: "custom", path: ["captureStatus"], message: "complete baseline cannot hide redacted or boundary units" });
  }
});

export const RepositoryBasisProofV1Schema = z.strictObject({
  recordId: RepositoryBasisRecordIdV1Schema,
  recordContentDigest: ContentDigestSchema,
  basisDigest: ContentDigestSchema,
  readSetDigest: ContentDigestSchema,
  baselineSnapshotArtifactId: ArtifactIdSchema,
  baselineSnapshotContentDigest: ContentDigestSchema,
  actualSnapshotArtifactId: ArtifactIdSchema,
  actualSnapshotContentDigest: ContentDigestSchema,
  graphArtifactId: ArtifactIdSchema,
  graphContentDigest: ContentDigestSchema,
  graphSourceSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
  taskBaselineArtifactId: TaskBaselineArtifactIdV1Schema,
  taskBaselineContentDigest: ContentDigestSchema,
});

export const StrongChangeTaskProjectionV1Schema = z.strictObject({
  manifest: TaskManifestV1Schema,
  acceptanceClaimIds: z.array(ClaimIdSchema),
  impactPathIds: z.array(ImpactPathIdSchema),
  confirmedObligations: z.array(ConfirmedObligationProjectionV1Schema),
  verificationPlan: z.array(VerificationPlanProjectionV1Schema),
}).superRefine((task, context) => {
  if (task.manifest.taskProfile !== "agent_task_v1") {
    context.addIssue({ code: "custom", path: ["manifest", "taskProfile"], message: "strong Change Intelligence requires a strong Task" });
  }
  strictlySorted(task.acceptanceClaimIds, context, ["acceptanceClaimIds"], "acceptance Claim IDs");
  strictlySorted(task.impactPathIds, context, ["impactPathIds"], "Impact Path IDs");
  unique(task.confirmedObligations.map((entry) => entry.plannedChangeId), context, ["confirmedObligations"], "confirmed obligations");
  unique(task.verificationPlan.map((entry) => entry.verificationPlanEntryId), context, ["verificationPlan"], "verification plan entries");
  const impactIds = new Set(task.impactPathIds);
  task.confirmedObligations.forEach((obligation, index) => {
    obligation.impactPathIds.forEach((id, referenceIndex) => {
      if (!impactIds.has(id)) {
        context.addIssue({ code: "custom", path: ["confirmedObligations", index, "impactPathIds", referenceIndex], message: "obligation Impact refs must resolve in the current Task projection" });
      }
    });
  });
});

export const StrongChangeCheckPreparationV1Schema = z.strictObject({
  profile: z.literal("strong_change_check_preparation_v1"),
  task: StrongChangeTaskProjectionV1Schema,
  baseline: InternalTaskBaselineV1Schema,
  baselineSnapshot: StrongRepositorySnapshotV1Schema,
  actualSnapshot: StrongRepositorySnapshotV1Schema,
  basis: RepositoryBasisProofV1Schema,
  rulesetVersion: ProducerVersionSchema,
  budget: ChangeAnalysisBudgetV1Schema,
  usage: ChangeAnalysisUsageV1Schema,
  repositoryDelta: RepositoryDeltaV1Schema,
  analyzedHunks: z.array(StrongAnalyzedHunkV1Schema),
  boundaries: z.array(AnalysisBoundaryV1Schema),
  authorityToken: KeyedStateTokenV1Schema,
}).superRefine((preparation, context) => {
  const manifest = preparation.task.manifest;
  const expected = {
    taskId: manifest.taskId,
    baselineSnapshotId: manifest.baselineSnapshotId,
    actualSnapshotId: manifest.latestSnapshotId,
  };
  if (preparation.baseline.taskId !== expected.taskId || preparation.repositoryDelta.taskId !== expected.taskId) {
    context.addIssue({ code: "custom", path: ["task"], message: "Task, baseline, and Delta identities must match" });
  }
  if (preparation.baseline.captureSnapshotId !== expected.baselineSnapshotId || preparation.baselineSnapshot.snapshotId !== expected.baselineSnapshotId || preparation.repositoryDelta.baselineSnapshotId !== expected.baselineSnapshotId) {
    context.addIssue({ code: "custom", path: ["baselineSnapshot"], message: "all baseline authority pins must be exact" });
  }
  if (preparation.actualSnapshot.snapshotId !== expected.actualSnapshotId || preparation.repositoryDelta.actualSnapshotId !== expected.actualSnapshotId) {
    context.addIssue({ code: "custom", path: ["actualSnapshot"], message: "all actual Snapshot authority pins must be exact" });
  }
  if (preparation.baseline.artifactId !== manifest.taskBaselineArtifactId || preparation.basis.taskBaselineArtifactId !== manifest.taskBaselineArtifactId) {
    context.addIssue({ code: "custom", path: ["baseline", "artifactId"], message: "Task Baseline authority must equal the Manifest pin" });
  }
  unique(preparation.analyzedHunks.map((entry) => entry.hunk.id), context, ["analyzedHunks"], "Hunk IDs");
  unique(preparation.boundaries.map((entry) => entry.id), context, ["boundaries"], "Boundary IDs");
  validateChangeAnalysisUsageWithinBudgetV1(
    preparation.usage,
    preparation.budget,
    context,
    ["usage"],
  );
  const changedFiles = preparation.repositoryDelta.paths.length +
    preparation.repositoryDelta.redactedAggregates.reduce((total, entry) => total + entry.count, 0);
  if (preparation.usage.changedFiles !== changedFiles) {
    context.addIssue({ code: "custom", path: ["usage", "changedFiles"], message: "changedFiles must equal the exact safe/redacted Delta universe" });
  }
  if (preparation.usage.hunks !== preparation.analyzedHunks.length) {
    context.addIssue({ code: "custom", path: ["usage", "hunks"], message: "hunks must equal the exact analyzed Hunk count" });
  }
  for (const [pathIndex, pathDelta] of preparation.repositoryDelta.paths.entries()) {
    const pathHunks = preparation.analyzedHunks.filter((entry) => entry.hunk.path === pathDelta.path);
    if (pathHunks.length > preparation.budget.maxHunksPerFile) {
      context.addIssue({ code: "custom", path: ["analyzedHunks"], message: `path ${pathIndex} exceeds maxHunksPerFile` });
    }
    for (const state of pathDelta.segments.flatMap((segment) => [segment.before, segment.after])) {
      if (state.status === "content" && state.size > preparation.budget.maxBytesPerFile) {
        context.addIssue({ code: "custom", path: ["repositoryDelta", "paths", pathIndex], message: "content state exceeds maxBytesPerFile without a budget Boundary" });
      }
    }
  }
});

export const StrongCheckChangesInputV1Schema = z.strictObject({
  profile: z.literal("check_changes_strong_v1"),
  taskId: TaskIdSchema,
  actualSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
  includeWorktree: z.literal(true),
  expectedRevision: RevisionSchema,
  idempotencyKey: IdempotencyKeySchema,
  actor: ActorSchema,
});

export const StrongTaskBaselineCaptureInputV1Schema = z.strictObject({
  profile: z.literal("capture_task_baseline_strong_v1"),
  taskId: TaskIdSchema,
  snapshotId: PathSafeRepositorySnapshotIdV1Schema,
  contextBuildSpec: ResolvedContextBuildSpecV1Schema,
  idempotencyKey: IdempotencyKeySchema,
  actor: ActorSchema,
});

export const StrongTaskBaselineCaptureOutcomeV1Schema = z.strictObject({
  profile: z.literal("task_baseline_capture_outcome_v1"),
  baseline: InternalTaskBaselineV1Schema,
  baselineSemanticDigest: ContentDigestSchema,
  baselineContentDigest: ContentDigestSchema,
  snapshot: StrongRepositorySnapshotV1Schema,
  snapshotArtifactId: ArtifactIdSchema,
  snapshotContentDigest: ContentDigestSchema,
  idempotentReplay: z.boolean(),
});

export const ChangeCheckAnalysisV1Schema = z.strictObject({
  profile: z.literal("evidence_backed_v1"),
  rulesetVersion: ProducerVersionSchema,
  budget: ChangeAnalysisBudgetV1Schema,
  usage: ChangeAnalysisUsageV1Schema,
  basisRecordId: RepositoryBasisRecordIdV1Schema,
  basisRecordContentDigest: ContentDigestSchema,
  repositoryBasisDigest: ContentDigestSchema,
  repositoryReadSetDigest: ContentDigestSchema,
  graphArtifactId: ArtifactIdSchema,
  graphContentDigest: ContentDigestSchema,
  graphSourceSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
  analysisInputDigest: ContentDigestSchema,
  semanticDigest: ContentDigestSchema,
  repositoryDelta: RepositoryDeltaV1Schema,
  actualChanges: z.array(ActualChangeV1Schema),
  completeness: z.strictObject({
    overall: AnalysisStatusV1Schema,
    dimensions: z.tuple([
      CompletenessDimensionV1Schema,
      CompletenessDimensionV1Schema,
      CompletenessDimensionV1Schema,
      CompletenessDimensionV1Schema,
      CompletenessDimensionV1Schema,
    ]),
  }),
}).superRefine((analysis, context) => {
  const expectedDimensions = CompletenessDimensionNameV1Schema.options;
  analysis.completeness.dimensions.forEach((dimension, index) => {
    if (dimension.dimension !== expectedDimensions[index]) {
      context.addIssue({ code: "custom", path: ["completeness", "dimensions", index, "dimension"], message: "completeness dimensions must use frozen order and exact cover" });
    }
  });
  validateChangeAnalysisUsageWithinBudgetV1(
    analysis.usage,
    analysis.budget,
    context,
    ["usage"],
  );
  const rank = { complete: 0, partial: 1, unknown: 2 } as const;
  const expectedOverall = analysis.completeness.dimensions
    .map((dimension) => dimension.status)
    .reduce<AnalysisStatusV1>((worst, status) => rank[status] > rank[worst] ? status : worst, "complete");
  if (analysis.completeness.overall !== expectedOverall) {
    context.addIssue({ code: "custom", path: ["completeness", "overall"], message: "overall completeness must be the exact worst dimension status" });
  }
  if (analysis.usage.actualChanges !== analysis.actualChanges.length) {
    context.addIssue({ code: "custom", path: ["usage", "actualChanges"], message: "Actual usage must equal the final unique Actual array" });
  }
  const symbolIds = new Set(analysis.actualChanges.flatMap((actual) => [
    ...actual.oldSymbolRefs.map((symbol) => symbol.id),
    ...actual.newSymbolRefs.map((symbol) => symbol.id),
  ]));
  if (analysis.usage.symbolRefs !== symbolIds.size) {
    context.addIssue({ code: "custom", path: ["usage", "symbolRefs"], message: "Symbol usage must equal the final unique Symbol Ref set" });
  }
  const dimensions = new Map(analysis.completeness.dimensions.map((dimension) => [dimension.dimension, dimension]));
  const exactUnits = (
    dimension: z.infer<typeof CompletenessDimensionV1Schema> | undefined,
    expected: readonly string[],
    label: string,
  ) => {
    const actual = (dimension?.units ?? []).map((unit) => `${unit.unitKind}\0${unit.unitId}`).sort();
    const wanted = [...expected].sort();
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
      context.addIssue({ code: "custom", path: ["completeness", "dimensions"], message: `${label} units must exact-cover their trusted universe` });
    }
  };
  exactUnits(
    dimensions.get("repository_delta"),
    [
      ...analysis.repositoryDelta.paths.map((path) => `repository_path_delta\0${path.id}`),
      ...analysis.repositoryDelta.redactedAggregates.map((aggregate) => `redacted_repository_aggregate\0${aggregate.snapshotRedactionId}`),
    ],
    "repository_delta",
  );
  exactUnits(
    dimensions.get("semantic_classification"),
    [
      ...analysis.actualChanges.map((actual) => `actual_change\0${actual.id}`),
      ...analysis.repositoryDelta.redactedAggregates.map((aggregate) => `redacted_repository_aggregate\0${aggregate.boundaryId}`),
    ],
    "semantic_classification",
  );
  for (const name of ["planned_matching", "impact_analysis"] as const) {
    const dimension = dimensions.get(name);
    for (const actual of analysis.actualChanges) {
      if (dimension?.units.filter((unit) => unit.unitKind === "actual_change" && unit.unitId === actual.id).length !== 1) {
        context.addIssue({ code: "custom", path: ["completeness", "dimensions"], message: `${name} must cover every Actual Change exactly once` });
      }
    }
  }
  if (dimensions.get("repository_delta")?.status !== analysis.repositoryDelta.status) {
    context.addIssue({ code: "custom", path: ["completeness", "dimensions", 0, "status"], message: "repository_delta status must equal Repository Delta status" });
  }
});

export const EvidenceBackedChangeCheckV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  id: OpaqueIdentifierSchema,
  taskId: TaskIdSchema,
  taskRevision: RevisionSchema,
  baselineSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
  actualSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
  findings: z.array(StrongChangeFindingV1Schema),
  analysis: ChangeCheckAnalysisV1Schema,
  generatedAt: IsoTimestampSchema,
}).superRefine((check, context) => {
  unique(check.findings.map((finding) => finding.id), context, ["findings"], "Finding IDs");
  if (check.analysis.repositoryDelta.taskId !== check.taskId || check.analysis.repositoryDelta.baselineSnapshotId !== check.baselineSnapshotId || check.analysis.repositoryDelta.actualSnapshotId !== check.actualSnapshotId) {
    context.addIssue({ code: "custom", path: ["analysis", "repositoryDelta"], message: "strong Check and Delta authority pins must match" });
  }
  if (check.findings.length === 0 && check.analysis.completeness.overall !== "complete") {
    context.addIssue({ code: "custom", path: ["findings"], message: "an incomplete analysis cannot claim a clean empty Finding set" });
  }
});

export const StrongChangeCheckCommitEvidenceV1Schema = z.strictObject({
  profile: z.literal("strong_change_commit_evidence_v1"),
  recovery: z.strictObject({
    markerFirst: z.literal(true),
    idempotencyReplaySafe: z.literal(true),
  }),
  security: z.strictObject({
    scannerPolicyDigest: ContentDigestSchema,
    safeGitExecutionDigest: ContentDigestSchema,
    persistedExcerptChars: z.literal(0),
  }),
  readSet: z.strictObject({
    basisRecordId: RepositoryBasisRecordIdV1Schema,
    basisDigest: ContentDigestSchema,
    readSetDigest: ContentDigestSchema,
    finalValidation: z.literal("provider_exact_cut_v1"),
  }),
  provenance: z.strictObject({
    taskBaselineArtifactId: TaskBaselineArtifactIdV1Schema,
    baselineSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
    actualSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
    analysisInputDigest: ContentDigestSchema,
    semanticDigest: ContentDigestSchema,
  }),
});

export const StrongChangeCheckCommitRequestV1Schema = z.strictObject({
  profile: z.literal("strong_change_check_commit_v1"),
  expectedRevision: RevisionSchema,
  idempotencyKey: IdempotencyKeySchema,
  actor: ActorSchema,
  requestDigest: ContentDigestSchema,
  authorityToken: KeyedStateTokenV1Schema,
  changeCheck: EvidenceBackedChangeCheckV1Schema,
  findingClaims: z.array(StrongFindingClaimV1Schema),
  evidence: z.array(z.union([DiffHunkEvidenceV1Schema, StructuredAnalysisBoundaryEvidenceV1Schema])),
  impactConclusion: StrongImpactConclusionV1Schema,
  commitEvidence: StrongChangeCheckCommitEvidenceV1Schema,
});

export const StrongChangeCheckMutationOutcomeV1Schema = z.strictObject({
  profile: z.literal("strong_change_check_outcome_v1"),
  changeCheck: EvidenceBackedChangeCheckV1Schema,
  findingClaims: z.array(StrongFindingClaimV1Schema),
  evidence: z.array(z.union([DiffHunkEvidenceV1Schema, StructuredAnalysisBoundaryEvidenceV1Schema])),
  impactConclusion: StrongImpactConclusionV1Schema,
  commitEvidence: StrongChangeCheckCommitEvidenceV1Schema,
  committedRevision: RevisionSchema,
  idempotentReplay: z.boolean(),
});

export const StrongVerificationDetailStateV1Schema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("none") }),
  z.strictObject({ status: z.literal("stored") }),
  z.strictObject({ status: z.literal("redacted"), redactionCodes: z.array(z.enum(["secret_detected", "host_path_detected", "control_character", "invalid_utf8"])).min(1) }),
]);

export const VerificationDetailInputFieldV1Schema = z.enum([
  "command",
  "exit_code",
  "duration_ms",
  "summary",
  "raw_output",
]);

export const VerificationCommandInputV1Schema = z.strictObject({
  executable: NonEmptyStringSchema.max(8_192),
  arguments: z.array(NonEmptyStringSchema.max(8_192)).max(256),
  workingDirectory: z.literal("repository_root"),
  environmentKeys: z.array(NonEmptyStringSchema.max(256)).max(256),
}).superRefine((command, context) => {
  unique(command.environmentKeys, context, ["environmentKeys"], "command environment keys");
  strictlySorted(command.environmentKeys, context, ["environmentKeys"], "command environment keys");
});

/** Provider-owner-only payload. It is never a Task artifact or public outcome. */
export const StrongVerificationOwnerOnlyDetailV1Schema = z.strictObject({
  command: VerificationCommandInputV1Schema.optional(),
  exitCode: z.number().int().safe().optional(),
  durationMs: nonnegativeSafeInteger.optional(),
  outputDigest: ContentDigestSchema.optional(),
}).superRefine((detail, context) => {
  if (Object.keys(detail).length === 0) {
    context.addIssue({ code: "custom", message: "stored owner-only detail cannot be empty" });
  }
});

export const StrongVerificationRecordV1Schema = z.strictObject({
  profile: z.literal("verification_record_strong_v1"),
  id: StrongVerificationRecordIdV1Schema,
  taskId: TaskIdSchema,
  verificationPlanEntryId: VerificationPlanEntryIdV1Schema,
  contextGenerationId: ContextGenerationIdV1Schema,
  attempt: positiveSafeInteger,
  supersedesVerificationRecordId: StrongVerificationRecordIdV1Schema.optional(),
  method: VerificationMethodV1Schema,
  status: z.enum(["passed", "failed", "skipped", "blocked", "flaky"]),
  publicResultCode: z.enum(["verification_passed", "verification_failed", "verification_blocked", "verification_flaky", "verification_skipped"]),
  claimIds: z.array(ClaimIdSchema),
  snapshotId: PathSafeRepositorySnapshotIdV1Schema,
  changeCheckArtifactId: ArtifactIdSchema,
  changeCheckContentDigest: ContentDigestSchema,
  detail: StrongVerificationDetailStateV1Schema,
  recordedAt: IsoTimestampSchema,
}).superRefine((record, context) => {
  if ((record.attempt === 1) !== (record.supersedesVerificationRecordId === undefined)) {
    context.addIssue({ code: "custom", path: ["supersedesVerificationRecordId"], message: "attempt chain must name the immediately previous record" });
  }
  const expectedCode = {
    passed: "verification_passed",
    failed: "verification_failed",
    blocked: "verification_blocked",
    flaky: "verification_flaky",
    skipped: "verification_skipped",
  }[record.status];
  if (record.publicResultCode !== expectedCode) {
    context.addIssue({ code: "custom", path: ["publicResultCode"], message: "public result code must be derived from status" });
  }
});

export const StrongRecordVerificationInputV1Schema = z.strictObject({
  profile: z.literal("record_verification_strong_v1"),
  taskId: TaskIdSchema,
  snapshotId: PathSafeRepositorySnapshotIdV1Schema,
  verificationPlanEntryId: VerificationPlanEntryIdV1Schema,
  method: VerificationMethodV1Schema,
  status: z.enum(["passed", "failed", "skipped", "blocked", "flaky"]),
  claimIds: z.array(ClaimIdSchema).min(1).max(4_096),
  command: VerificationCommandInputV1Schema.optional(),
  exitCode: z.number().int().safe().optional(),
  durationMs: nonnegativeSafeInteger.optional(),
  summary: NonEmptyStringSchema.max(65_536).optional(),
  rawOutputBase64url: z.string().regex(/^base64url:[A-Za-z0-9_-]*$/u).max(11_184_822).optional(),
  supersedesVerificationRecordId: StrongVerificationRecordIdV1Schema.optional(),
  expectedRevision: RevisionSchema,
  idempotencyKey: IdempotencyKeySchema,
  actor: ActorSchema,
}).superRefine((input, context) => {
  unique(input.claimIds, context, ["claimIds"], "verification Claim IDs");
  strictlySorted(input.claimIds, context, ["claimIds"], "verification Claim IDs");
  if (input.method === "manual" && (input.command !== undefined || input.exitCode !== undefined || input.rawOutputBase64url !== undefined)) {
    context.addIssue({ code: "custom", path: ["command"], message: "manual verification forbids command, exitCode, and raw output" });
  }
  if (
    input.method !== "manual" &&
    (input.status === "passed" || input.status === "failed" || input.status === "flaky") &&
    input.command === undefined
  ) {
    context.addIssue({ code: "custom", path: ["command"], message: "executed verification requires a normalized command" });
  }
  if (input.status === "passed" && input.exitCode !== undefined && input.exitCode !== 0) {
    context.addIssue({ code: "custom", path: ["exitCode"], message: "passed verification cannot have a non-zero exitCode" });
  }
  if (input.status === "failed" && input.exitCode !== undefined && input.exitCode === 0) {
    context.addIssue({ code: "custom", path: ["exitCode"], message: "failed verification cannot have a zero exitCode" });
  }
});

export const StrongVerificationPreparationV1Schema = z.strictObject({
  profile: z.literal("strong_verification_preparation_v1"),
  task: StrongChangeTaskProjectionV1Schema,
  planEntry: VerificationPlanProjectionV1Schema,
  changeCheckArtifactId: ArtifactIdSchema,
  changeCheckContentDigest: ContentDigestSchema,
  changeCheck: EvidenceBackedChangeCheckV1Schema,
  priorRecords: z.array(StrongVerificationRecordV1Schema),
  basis: RepositoryBasisProofV1Schema,
  sensitiveRequestScanPolicyDigest: ContentDigestSchema,
  fullInputEqualityTag: KeyedStateTokenV1Schema,
  ownerOnlyDetailCommitment: KeyedStateTokenV1Schema.optional(),
  ownerOnlyDetail: StrongVerificationOwnerOnlyDetailV1Schema.optional(),
  detail: StrongVerificationDetailStateV1Schema,
  detailFields: z.array(VerificationDetailInputFieldV1Schema),
  authorityToken: KeyedStateTokenV1Schema,
}).superRefine((preparation, context) => {
  if (
    (preparation.detail.status === "stored") !== (preparation.ownerOnlyDetailCommitment !== undefined) ||
    (preparation.detail.status === "stored") !== (preparation.ownerOnlyDetail !== undefined)
  ) {
    context.addIssue({ code: "custom", path: ["ownerOnlyDetailCommitment"], message: "owner-only detail commitment is private and required exactly for stored detail" });
  }
  unique(preparation.detailFields, context, ["detailFields"], "verification detail fields");
  const order = new Map(VerificationDetailInputFieldV1Schema.options.map((field, index) => [field, index]));
  for (let index = 1; index < preparation.detailFields.length; index += 1) {
    if ((order.get(preparation.detailFields[index - 1]!) ?? 99) >= (order.get(preparation.detailFields[index]!) ?? 99)) {
      context.addIssue({ code: "custom", path: ["detailFields", index], message: "detail fields must use frozen enum order" });
      break;
    }
  }
});

export const StrongVerificationCommitEvidenceV1Schema = z.strictObject({
  profile: z.literal("strong_verification_commit_evidence_v1"),
  recovery: z.strictObject({ attemptChainValidated: z.literal(true), idempotencyReplaySafe: z.literal(true) }),
  security: z.strictObject({ detailPolicy: z.literal("scanned_or_keyed_commitment_v1"), rawExecutionPersisted: z.literal(false) }),
  readSet: z.strictObject({ basisRecordId: RepositoryBasisRecordIdV1Schema, basisDigest: ContentDigestSchema, readSetDigest: ContentDigestSchema, finalValidation: z.literal("provider_exact_cut_v1") }),
  provenance: z.strictObject({ taskBaselineArtifactId: TaskBaselineArtifactIdV1Schema, contextGenerationId: ContextGenerationIdV1Schema, snapshotId: PathSafeRepositorySnapshotIdV1Schema, changeCheckArtifactId: ArtifactIdSchema, changeCheckContentDigest: ContentDigestSchema }),
});

export const StrongVerificationCommitRequestV1Schema = z.strictObject({
  profile: z.literal("strong_verification_commit_v1"),
  expectedRevision: RevisionSchema,
  idempotencyKey: IdempotencyKeySchema,
  actor: ActorSchema,
  requestDigest: ContentDigestSchema,
  fullInputEqualityTag: KeyedStateTokenV1Schema,
  ownerOnlyDetailCommitment: KeyedStateTokenV1Schema.optional(),
  ownerOnlyDetail: StrongVerificationOwnerOnlyDetailV1Schema.optional(),
  authorityToken: KeyedStateTokenV1Schema,
  verification: StrongVerificationRecordV1Schema,
  commitEvidence: StrongVerificationCommitEvidenceV1Schema,
}).superRefine((request, context) => {
  if (
    (request.verification.detail.status === "stored") !== (request.ownerOnlyDetailCommitment !== undefined) ||
    (request.verification.detail.status === "stored") !== (request.ownerOnlyDetail !== undefined)
  ) {
    context.addIssue({ code: "custom", path: ["ownerOnlyDetailCommitment"], message: "owner-only detail commitment is required exactly for stored detail" });
  }
});

export const StrongVerificationMutationOutcomeV1Schema = z.strictObject({
  profile: z.literal("strong_verification_outcome_v1"),
  verification: StrongVerificationRecordV1Schema,
  commitEvidence: StrongVerificationCommitEvidenceV1Schema,
  committedRevision: RevisionSchema,
  idempotentReplay: z.boolean(),
});

export type StrongVerificationSecurityProjectionV1 = Pick<
  z.infer<typeof StrongVerificationPreparationV1Schema>,
  | "sensitiveRequestScanPolicyDigest"
  | "fullInputEqualityTag"
  | "ownerOnlyDetailCommitment"
  | "ownerOnlyDetail"
  | "detail"
  | "detailFields"
>;

export interface StrongChangeIntelligenceAuthorityV1 {
  reserveOperationTime?(
    input: Readonly<{
      taskId: string;
      expectedRevision: number;
      operation: "check_change" | "record_verification";
      idempotencyKey: string;
      actor: string;
      requestDigest?: z.infer<typeof ContentDigestSchema>;
      fullInputEqualityTag?: z.infer<typeof KeyedStateTokenV1Schema>;
    }>,
    proposedAt: string,
  ): Promise<string>;
  /** Durable preflight used before reading a now-advanced Task revision. */
  replayCheck?(
    input: StrongCheckChangesInputV1,
    requestDigest: z.infer<typeof ContentDigestSchema>,
  ): Promise<StrongChangeCheckMutationOutcomeV1 | undefined>;
  /** Includes Provider-private full-input equality validation. */
  replayVerification?(
    input: StrongRecordVerificationInputV1,
    requestDigest: z.infer<typeof ContentDigestSchema>,
    security: StrongVerificationSecurityProjectionV1,
  ): Promise<StrongVerificationMutationOutcomeV1 | undefined>;
  scanVerificationInput?(
    input: StrongRecordVerificationInputV1,
  ): Promise<StrongVerificationSecurityProjectionV1>;
  captureTaskBaseline(
    input: StrongTaskBaselineCaptureInputV1,
  ): Promise<StrongTaskBaselineCaptureOutcomeV1>;
  prepareCheck(input: StrongCheckChangesInputV1): Promise<StrongChangeCheckPreparationV1>;
  commitCheck(input: StrongChangeCheckCommitRequestV1): Promise<StrongChangeCheckMutationOutcomeV1>;
  prepareVerification(
    input: StrongRecordVerificationInputV1,
    security?: StrongVerificationSecurityProjectionV1,
  ): Promise<StrongVerificationPreparationV1>;
  commitVerification(input: StrongVerificationCommitRequestV1): Promise<StrongVerificationMutationOutcomeV1>;
}

export type AnalysisBoundaryV1 = z.infer<typeof AnalysisBoundaryV1Schema>;
export type AnalysisStatusV1 = z.infer<typeof AnalysisStatusV1Schema>;
export type ChangeAnalysisBudgetV1 = z.infer<typeof ChangeAnalysisBudgetV1Schema>;
export type ChangeAnalysisUsageV1 = z.infer<typeof ChangeAnalysisUsageV1Schema>;
export type RepositoryDeltaV1 = z.infer<typeof RepositoryDeltaV1Schema>;
export type DiffHunkV1 = z.infer<typeof DiffHunkV1Schema>;
export type SourceSymbolRefV1 = z.infer<typeof SourceSymbolRefV1Schema>;
export type StrongAnalyzedHunkV1 = z.infer<typeof StrongAnalyzedHunkV1Schema>;
export type ActualChangeV1 = z.infer<typeof ActualChangeV1Schema>;
export type StrongImpactConclusionV1 = z.infer<typeof StrongImpactConclusionV1Schema>;
export type StrongChangeFindingV1 = z.infer<typeof StrongChangeFindingV1Schema>;
export type DiffHunkEvidenceV1 = z.infer<typeof DiffHunkEvidenceV1Schema>;
export type StructuredAnalysisBoundaryEvidenceV1 = z.infer<typeof StructuredAnalysisBoundaryEvidenceV1Schema>;
export type StrongFindingClaimV1 = z.infer<typeof StrongFindingClaimV1Schema>;
export type ConfirmedObligationProjectionV1 = z.infer<typeof ConfirmedObligationProjectionV1Schema>;
export type VerificationPlanProjectionV1 = z.infer<typeof VerificationPlanProjectionV1Schema>;
export type InternalTaskBaselineV1 = z.infer<typeof InternalTaskBaselineV1Schema>;
export type RepositoryBasisProofV1 = z.infer<typeof RepositoryBasisProofV1Schema>;
export type StrongChangeTaskProjectionV1 = z.infer<typeof StrongChangeTaskProjectionV1Schema>;
export type StrongChangeCheckPreparationV1 = z.infer<typeof StrongChangeCheckPreparationV1Schema>;
export type StrongCheckChangesInputV1 = z.infer<typeof StrongCheckChangesInputV1Schema>;
export type StrongTaskBaselineCaptureInputV1 = z.infer<
  typeof StrongTaskBaselineCaptureInputV1Schema
>;
export type StrongTaskBaselineCaptureOutcomeV1 = z.infer<
  typeof StrongTaskBaselineCaptureOutcomeV1Schema
>;
export type EvidenceBackedChangeCheckV1 = z.infer<typeof EvidenceBackedChangeCheckV1Schema>;
export type StrongChangeCheckCommitEvidenceV1 = z.infer<typeof StrongChangeCheckCommitEvidenceV1Schema>;
export type StrongChangeCheckCommitRequestV1 = z.infer<typeof StrongChangeCheckCommitRequestV1Schema>;
export type StrongChangeCheckMutationOutcomeV1 = z.infer<typeof StrongChangeCheckMutationOutcomeV1Schema>;
export type StrongVerificationRecordV1 = z.infer<typeof StrongVerificationRecordV1Schema>;
export type StrongRecordVerificationInputV1 = z.infer<typeof StrongRecordVerificationInputV1Schema>;
export type StrongVerificationPreparationV1 = z.infer<typeof StrongVerificationPreparationV1Schema>;
export type StrongVerificationCommitEvidenceV1 = z.infer<typeof StrongVerificationCommitEvidenceV1Schema>;
export type StrongVerificationCommitRequestV1 = z.infer<typeof StrongVerificationCommitRequestV1Schema>;
export type StrongVerificationMutationOutcomeV1 = z.infer<typeof StrongVerificationMutationOutcomeV1Schema>;

export type StrongSnapshotAuthorityPairV1 = Readonly<{
  baseline: StrongRepositorySnapshotV1;
  actual: StrongRepositorySnapshotV1;
}>;
