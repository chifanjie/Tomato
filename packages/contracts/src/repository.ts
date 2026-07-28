import { z } from "zod";
import { createArtifactEnvelopeV1Schema } from "./artifact-envelope.js";
import {
  ContentDigestSchema,
  GitObjectIdSchema,
  IsoTimestampSchema,
  OpaqueIdentifierSchema,
  RepositoryIdSchema,
  RepositoryRelativePathSchema,
  RootIdentitySchema,
  SchemaVersionV1Schema,
  SnapshotIdSchema,
  WorktreeIdSchema,
} from "./primitives.js";

export const RepositoryChangeSourceV1Schema = z.enum([
  "committed",
  "staged",
  "unstaged",
  "untracked",
  "conflict",
]);

export const RepositoryChangeKindV1Schema = z.enum([
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "type_changed",
]);

export const RepositoryChangeV1Schema = z
  .strictObject({
    id: OpaqueIdentifierSchema,
    path: RepositoryRelativePathSchema,
    oldPath: RepositoryRelativePathSchema.optional(),
    source: RepositoryChangeSourceV1Schema,
    kind: RepositoryChangeKindV1Schema,
    contentDigest: ContentDigestSchema.optional(),
    previousContentDigest: ContentDigestSchema.optional(),
  })
  .superRefine((change, context) => {
    const carriesOldPath = change.kind === "renamed" || change.kind === "copied";
    if (carriesOldPath && change.oldPath === undefined) {
      context.addIssue({
        code: "custom",
        path: ["oldPath"],
        message: `${change.kind} changes require oldPath; path is the new path`,
      });
    }
    if (!carriesOldPath && change.oldPath !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["oldPath"],
        message: `${change.kind} changes must not include oldPath`,
      });
    }
    if (change.oldPath === change.path) {
      context.addIssue({
        code: "custom",
        path: ["oldPath"],
        message: "oldPath must differ from path",
      });
    }
  });

export const RepositoryCaptureStatusV1Schema = z.enum(["complete", "partial", "error"]);

export const RepositorySnapshotV1Schema = z
  .strictObject({
    schemaVersion: SchemaVersionV1Schema,
    snapshotId: SnapshotIdSchema,
    repositoryId: RepositoryIdSchema,
    worktreeId: WorktreeIdSchema,
    rootIdentity: RootIdentitySchema,
    branch: z.string().min(1).max(1_024).optional(),
    headCommit: GitObjectIdSchema.optional(),
    baseCommit: GitObjectIdSchema.optional(),
    mergeBase: GitObjectIdSchema.optional(),
    indexDigest: ContentDigestSchema,
    worktreeDigest: ContentDigestSchema,
    untrackedDigest: ContentDigestSchema,
    ignoreDigest: ContentDigestSchema,
    createdAt: IsoTimestampSchema,
    captureStatus: RepositoryCaptureStatusV1Schema,
    limitations: z.array(z.string().min(1).max(4_096)),
    changes: z.array(RepositoryChangeV1Schema),
  })
  .superRefine((snapshot, context) => {
    if (
      (snapshot.captureStatus === "complete" ||
        snapshot.captureStatus === "partial") &&
      snapshot.headCommit === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["headCommit"],
        message: `${snapshot.captureStatus} captures require headCommit`,
      });
    }
    if (
      snapshot.headCommit === undefined &&
      (snapshot.baseCommit !== undefined || snapshot.mergeBase !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["headCommit"],
        message: "baseCommit and mergeBase require headCommit",
      });
    }
    if (snapshot.captureStatus !== "complete" && snapshot.limitations.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["limitations"],
        message: `${snapshot.captureStatus} captures require at least one limitation`,
      });
    }
    const changeIds = new Set<string>();
    snapshot.changes.forEach((change, index) => {
      if (changeIds.has(change.id)) {
        context.addIssue({
          code: "custom",
          path: ["changes", index, "id"],
          message: `duplicate repository change ID: ${change.id}`,
        });
      }
      changeIds.add(change.id);
    });
  });

export const ArtifactFreshnessV1Schema = z.enum([
  "fresh",
  "partial",
  "stale",
  "missing",
  "error",
]);

export const RepoPulseStatusV1Schema = z.enum([
  "not_ready",
  "fresh",
  "partial",
  "stale",
  "unknown",
  "rebuilding",
  "error",
]);

export const REPO_PULSE_REQUIRED_ARTIFACT_KEYS_V1 = Object.freeze([
  "graph",
  "wiki",
  "evidence",
  "diff",
  "task",
] as const);

const RepoPulseCountV1Schema = z.number().int().nonnegative();

export const RepoPulseRepositoryStateV1Schema = z
  .strictObject({
    rootIdentity: RootIdentitySchema,
    branch: z.string().min(1).max(1_024).optional(),
    baselineCommit: GitObjectIdSchema.optional(),
    headCommit: GitObjectIdSchema.optional(),
    mergeBase: GitObjectIdSchema.optional(),
    ahead: RepoPulseCountV1Schema.optional(),
    behind: RepoPulseCountV1Schema.optional(),
    captureStatus: RepositoryCaptureStatusV1Schema,
    limitations: z.array(z.string().min(1).max(4_096)),
  })
  .superRefine((state, context) => {
    if ((state.ahead === undefined) !== (state.behind === undefined)) {
      context.addIssue({
        code: "custom",
        path: [state.ahead === undefined ? "ahead" : "behind"],
        message: "ahead and behind must either both be present or both be absent",
      });
    }
    if (
      (state.ahead !== undefined ||
        state.behind !== undefined ||
        state.mergeBase !== undefined) &&
      (state.baselineCommit === undefined || state.headCommit === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["baselineCommit"],
        message:
          "ahead, behind, and mergeBase require both baselineCommit and headCommit",
      });
    }
    if (
      (state.captureStatus === "complete" ||
        state.captureStatus === "partial") &&
      state.headCommit === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["headCommit"],
        message: `${state.captureStatus} repository pulse state requires headCommit`,
      });
    }
    if (
      state.captureStatus !== "complete" &&
      state.limitations.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["limitations"],
        message: `${state.captureStatus} repository pulse state requires at least one limitation`,
      });
    }
  });

export const RepoPulseChangeSummaryV1Schema = z
  .strictObject({
    total: RepoPulseCountV1Schema,
    bySource: z.strictObject({
      committed: RepoPulseCountV1Schema,
      staged: RepoPulseCountV1Schema,
      unstaged: RepoPulseCountV1Schema,
      untracked: RepoPulseCountV1Schema,
      conflict: RepoPulseCountV1Schema,
    }),
    byKind: z.strictObject({
      added: RepoPulseCountV1Schema,
      modified: RepoPulseCountV1Schema,
      deleted: RepoPulseCountV1Schema,
      renamed: RepoPulseCountV1Schema,
      copied: RepoPulseCountV1Schema,
      type_changed: RepoPulseCountV1Schema,
    }),
  })
  .superRefine((summary, context) => {
    const sourceTotal = Object.values(summary.bySource).reduce(
      (total, count) => total + count,
      0,
    );
    const kindTotal = Object.values(summary.byKind).reduce(
      (total, count) => total + count,
      0,
    );
    if (sourceTotal !== summary.total) {
      context.addIssue({
        code: "custom",
        path: ["bySource"],
        message: "change source counts must add up to total",
      });
    }
    if (kindTotal !== summary.total) {
      context.addIssue({
        code: "custom",
        path: ["byKind"],
        message: "change kind counts must add up to total",
      });
    }
  });

export const RepoPulseCompletenessStatusV1Schema = z.enum([
  "complete",
  "partial",
  "unknown",
  "unsupported",
]);

export const RepoPulseCompletenessComponentV1Schema = z
  .strictObject({
    status: RepoPulseCompletenessStatusV1Schema,
    coverage: z.number().min(0).max(1).optional(),
    reasons: z.array(z.string().min(1).max(4_096)),
  })
  .superRefine((component, context) => {
    if (component.status !== "complete" && component.reasons.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["reasons"],
        message: `${component.status} completeness requires at least one reason`,
      });
    }
    if (
      component.status === "complete" &&
      component.coverage !== undefined &&
      component.coverage !== 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["coverage"],
        message: "complete coverage, when reported, must equal 1",
      });
    }
  });

export const RepoPulseCompletenessV1Schema = z.strictObject({
  parser: RepoPulseCompletenessComponentV1Schema,
  callGraph: RepoPulseCompletenessComponentV1Schema,
});

export const RepoPulseRecommendedRefreshV1Schema = z.enum([
  "none",
  "incremental",
  "full",
]);

export const RepoPulseDiagnosticV1Schema = z.strictObject({
  code: OpaqueIdentifierSchema,
  scope: z.enum([
    "repository",
    "git",
    "artifact",
    "parser",
    "call_graph",
    "refresh",
  ]),
  message: z.string().min(1).max(4_096),
});

export const RepoPulseV1Schema = z
  .strictObject({
    evaluatedSnapshotId: SnapshotIdSchema,
    baselineSnapshotId: SnapshotIdSchema.optional(),
    status: RepoPulseStatusV1Schema,
    artifactFreshness: z
      .record(z.string().min(1), ArtifactFreshnessV1Schema)
      .refine(
        (freshness) => Object.keys(freshness).length > 0,
        "artifactFreshness must report at least one artifact",
      ),
    repositoryState: RepoPulseRepositoryStateV1Schema.optional(),
    changeSummary: RepoPulseChangeSummaryV1Schema.optional(),
    completeness: RepoPulseCompletenessV1Schema.optional(),
    recommendedRefresh: RepoPulseRecommendedRefreshV1Schema.optional(),
    errors: z.array(RepoPulseDiagnosticV1Schema).optional(),
    unknowns: z.array(RepoPulseDiagnosticV1Schema).optional(),
    reasons: z.array(z.string().min(1).max(4_096)),
    evaluatedAt: IsoTimestampSchema,
  })
  .superRefine((pulse, context) => {
    if (pulse.status === "fresh") {
      for (const field of [
        "repositoryState",
        "changeSummary",
        "completeness",
        "recommendedRefresh",
        "errors",
        "unknowns",
      ] as const) {
        if (pulse[field] === undefined) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: `fresh repository pulse requires ${field}`,
          });
        }
      }
      for (const artifactKey of REPO_PULSE_REQUIRED_ARTIFACT_KEYS_V1) {
        if (pulse.artifactFreshness[artifactKey] === undefined) {
          context.addIssue({
            code: "custom",
            path: ["artifactFreshness", artifactKey],
            message: `fresh repository pulse must report ${artifactKey} freshness`,
          });
        }
      }
    }
    if (pulse.status !== "fresh" && pulse.reasons.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["reasons"],
        message: `${pulse.status} repository pulse requires at least one reason`,
      });
    }
    if (pulse.status === "fresh" && pulse.reasons.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["reasons"],
        message: "fresh repository pulse must not include degradation reasons",
      });
    }

    if (
      pulse.status === "fresh" &&
      Object.values(pulse.artifactFreshness).some(
        (freshness) => freshness !== "fresh",
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["artifactFreshness"],
        message: "fresh repository pulse requires every artifact to be fresh",
      });
    }
    if (
      pulse.status === "fresh" &&
      pulse.repositoryState !== undefined &&
      pulse.repositoryState.captureStatus !== "complete"
    ) {
      context.addIssue({
        code: "custom",
        path: ["repositoryState", "captureStatus"],
        message: "fresh repository pulse requires a complete repository capture",
      });
    }
    if (
      pulse.status === "fresh" &&
      pulse.completeness !== undefined &&
      (pulse.completeness.parser.status !== "complete" ||
        pulse.completeness.callGraph.status !== "complete")
    ) {
      context.addIssue({
        code: "custom",
        path: ["completeness"],
        message:
          "fresh repository pulse requires complete parser and call graph coverage",
      });
    }
    if (
      pulse.status === "fresh" &&
      ((pulse.errors?.length ?? 0) > 0 ||
        (pulse.unknowns?.length ?? 0) > 0)
    ) {
      context.addIssue({
        code: "custom",
        path: [(pulse.errors?.length ?? 0) > 0 ? "errors" : "unknowns"],
        message: "fresh repository pulse must not contain errors or unknowns",
      });
    }
    if (
      pulse.status === "fresh" &&
      pulse.recommendedRefresh !== undefined &&
      pulse.recommendedRefresh !== "none"
    ) {
      context.addIssue({
        code: "custom",
        path: ["recommendedRefresh"],
        message: "fresh repository pulse cannot recommend an index refresh",
      });
    }
  });

export const RepositorySnapshotArtifactV1Schema = createArtifactEnvelopeV1Schema(
  "repository_snapshot",
  RepositorySnapshotV1Schema,
).superRefine((artifact, context) => {
  if (artifact.sourceSnapshotId !== artifact.payload.snapshotId) {
    context.addIssue({
      code: "custom",
      path: ["sourceSnapshotId"],
      message: "repository snapshot envelope sourceSnapshotId must equal payload.snapshotId",
    });
  }
  if (artifact.repositoryId !== artifact.payload.repositoryId) {
    context.addIssue({
      code: "custom",
      path: ["repositoryId"],
      message: "repository snapshot envelope and payload repositoryId must match",
    });
  }
  if (artifact.worktreeId !== artifact.payload.worktreeId) {
    context.addIssue({
      code: "custom",
      path: ["worktreeId"],
      message: "repository snapshot envelope and payload worktreeId must match",
    });
  }
});

export const RepoPulseArtifactV1Schema = createArtifactEnvelopeV1Schema(
  "repo_pulse",
  RepoPulseV1Schema,
).superRefine((artifact, context) => {
  if (artifact.sourceSnapshotId !== artifact.payload.evaluatedSnapshotId) {
    context.addIssue({
      code: "custom",
      path: ["sourceSnapshotId"],
      message: "repo pulse envelope sourceSnapshotId must equal payload.evaluatedSnapshotId",
    });
  }
});

export type RepositoryChangeSourceV1 = z.infer<typeof RepositoryChangeSourceV1Schema>;
export type RepositoryChangeKindV1 = z.infer<typeof RepositoryChangeKindV1Schema>;
export type RepositoryChangeV1 = z.infer<typeof RepositoryChangeV1Schema>;
export type RepositoryCaptureStatusV1 = z.infer<typeof RepositoryCaptureStatusV1Schema>;
export type RepositorySnapshotV1 = z.infer<typeof RepositorySnapshotV1Schema>;
export type ArtifactFreshnessV1 = z.infer<typeof ArtifactFreshnessV1Schema>;
export type RepoPulseStatusV1 = z.infer<typeof RepoPulseStatusV1Schema>;
export type RepoPulseRepositoryStateV1 = z.infer<
  typeof RepoPulseRepositoryStateV1Schema
>;
export type RepoPulseChangeSummaryV1 = z.infer<
  typeof RepoPulseChangeSummaryV1Schema
>;
export type RepoPulseCompletenessStatusV1 = z.infer<
  typeof RepoPulseCompletenessStatusV1Schema
>;
export type RepoPulseCompletenessComponentV1 = z.infer<
  typeof RepoPulseCompletenessComponentV1Schema
>;
export type RepoPulseCompletenessV1 = z.infer<
  typeof RepoPulseCompletenessV1Schema
>;
export type RepoPulseRecommendedRefreshV1 = z.infer<
  typeof RepoPulseRecommendedRefreshV1Schema
>;
export type RepoPulseDiagnosticV1 = z.infer<
  typeof RepoPulseDiagnosticV1Schema
>;
export type RepoPulseV1 = z.infer<typeof RepoPulseV1Schema>;
export type RepositorySnapshotArtifactV1 = z.infer<typeof RepositorySnapshotArtifactV1Schema>;
export type RepoPulseArtifactV1 = z.infer<typeof RepoPulseArtifactV1Schema>;
