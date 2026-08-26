import type {
  BuildTaskBriefInputV1,
  BuildTaskBriefResultV1,
  ContentDigest,
  ChangeCheckV1,
  ClaimV1,
  EvidenceV1,
  GetTaskBriefInputV1,
  GetTaskBriefResultV1Schema,
  IdempotencyRecordV1,
  ImpactPathV1,
  MutationResultV1,
  RepoPulseV1,
  RepoPulsePersistedPayloadV1,
  RepositorySnapshotV1,
  RepositorySnapshotPersistedPayloadV1,
  TaskArtifactBundleV1,
  TaskBriefV1,
  TaskManifestV1,
  TaskOperationReceiptV1,
  UpdateTaskInputV1,
  VerificationRecordV1,
  StrongChangeIntelligenceAuthorityV1,
  StrongRepositorySnapshotV1,
} from "@understand-code/contracts";
import type {
  KnowledgeGraph,
} from "@understand-code/core";

import type {
  RepositorySnapshotLike,
  WikiIndexLike,
} from "./types.js";

export interface AuthorizationContext {
  actor: string;
  repositoryId: string;
  worktreeId: string;
  capabilities?: readonly (
    | "task:create"
    | "task:update"
    | "task:confirm"
    | "task:accept"
    | "task:supersede"
  )[];
}

export interface SourceEvidenceRecord {
  nodeId: string;
  filePath: string;
  lineRange?: readonly [number, number];
  excerpt?: string;
  contentHash: string;
  commit?: string;
  kind?: "source" | "config" | "test" | "document";
}

export interface TaskContextLoadInput {
  intent: string;
  sourceSnapshotId: string;
  /**
   * The exact validated Snapshot selected by the Task Engine. Providers must
   * bind any byte-level Source Evidence to this value instead of inferring
   * freshness from the live worktree alone.
   */
  repositorySnapshot: RepositorySnapshotPersistedPayloadV1;
  scope?: readonly string[];
  baseRef?: string;
}

export interface TaskContextData {
  graph: KnowledgeGraph;
  /**
   * Repository-relative paths whose existence the Host verified against the
   * requested Snapshot before returning this context. The Task Engine treats
   * every Graph path outside this allowlist as an unknown boundary.
   */
  existingFilePaths: readonly string[];
  wiki?: WikiIndexLike;
  sourceEvidence?: readonly SourceEvidenceRecord[];
  repositorySnapshot?: RepositorySnapshotLike;
}

/**
 * Explicit Host binding for a context provider.
 *
 * `canonicalRoot` must be the exact canonical worktree root owned by the
 * Artifact Store used to construct the Task Engine. Keeping this binding on
 * the provider makes accidental cross-worktree composition fail closed before
 * any repository context can be loaded or persisted.
 */
export interface TaskContextProviderBinding {
  readonly schemaVersion: 1;
  readonly kind: "canonical_worktree_root";
  readonly canonicalRoot: string;
}

export interface TaskContextProvider {
  readonly binding: TaskContextProviderBinding;
  loadTaskContext(input: TaskContextLoadInput): Promise<TaskContextData>;
  /**
   * Optional trusted, worktree-bound post-change analyzer. Public Check input
   * never carries diff or symbol assertions; providers derive them from the
   * exact persisted Snapshots and repository bytes instead.
   */
  analyzeTaskChanges?(
    input: TaskChangeAnalysisInput,
  ): Promise<TaskChangeAnalysisResult>;
}

export interface StrongRepositoryContentMaterialV1 {
  readonly status: "absent" | "content";
  readonly path: string;
  readonly domain?: "git_object" | "index_blob" | "worktree_raw" | "baseline_private_blob";
  readonly objectId?: string;
  readonly mode?: "100644" | "100755";
  readonly bytes?: Buffer;
  readonly contentDigest?: string;
}

export interface StrongRepositoryChangeMaterialV1 {
  readonly change: Omit<StrongRepositorySnapshotV1["changes"][number], "source"> & {
    readonly source:
      | "baseline_reconciliation"
      | "committed"
      | "staged"
      | "unstaged"
      | "untracked"
      | "conflict";
  };
  readonly before: StrongRepositoryContentMaterialV1;
  readonly after: StrongRepositoryContentMaterialV1;
}

export interface StrongRepositoryAnalysisMaterialV1 {
  readonly baselineTreeObjectId: string;
  readonly graphPin: StrongRepositoryGraphPinV1;
  readonly graph: KnowledgeGraph;
  readonly changes: readonly StrongRepositoryChangeMaterialV1[];
}

export interface StrongRepositoryGraphPinV1 {
  readonly artifactId: string;
  readonly contentDigest: ContentDigest;
  readonly sourceSnapshotId: string;
}

export interface TaskChangeAnalysisInput {
  readonly taskId: string;
  readonly baselineSnapshot: RepositorySnapshotV1;
  readonly actualSnapshot: RepositorySnapshotV1;
}

export type TaskChangeAnalysisBoundaryCode =
  | "unsupported_source"
  | "baseline_overlay_unavailable"
  | "head_mismatch"
  | "unsafe_path"
  | "content_changed"
  | "binary_or_invalid_utf8"
  | "budget_exhausted"
  | "symbol_mapping_unknown";

export interface TaskChangeAnalysisBoundary {
  readonly code: TaskChangeAnalysisBoundaryCode;
  readonly filePath?: string;
  readonly actualChangeIds: readonly string[];
  readonly reason: string;
}

export interface TaskChangeHunk {
  readonly id: string;
  readonly actualChangeIds: readonly string[];
  readonly filePath: string;
  readonly oldLineRange?: readonly [number, number];
  readonly newLineRange: readonly [number, number];
  readonly nodeIds: readonly string[];
  readonly contentHash: string;
}

/**
 * A trusted observation of a whole file that existed at the Task baseline and
 * is absent from the exact live actual Snapshot. It is deliberately separate
 * from an actual-side hunk because a deletion has no current source range or
 * current Graph symbol anchor.
 */
export interface TaskDeletedFileObservation {
  readonly id: string;
  readonly actualChangeIds: readonly string[];
  readonly filePath: string;
  readonly oldLineRange: readonly [number, number];
  readonly contentHash: string;
}

export interface TaskChangeAnalysisResult {
  readonly status: "complete" | "partial" | "unknown";
  readonly hunks: readonly TaskChangeHunk[];
  readonly deletedFiles?: readonly TaskDeletedFileObservation[];
  readonly boundaries: readonly TaskChangeAnalysisBoundary[];
}

export interface TaskEngineOptions {
  contextProvider: TaskContextProvider;
  /**
   * Provider-gated strong writer. Omission intentionally leaves strong Check
   * and Verification fail-closed while preserving legacy read compatibility.
   */
  strongChangeAuthority?: StrongChangeIntelligenceAuthorityV1;
  clock?: () => Date;
  createScope?: string;
}

export type TaskContextRecoveryCapability =
  | "refresh_task_context"
  | "rebase_task";

export type TaskEngineCapabilityState =
  | {
      readonly available: true;
      readonly reasonCode: "task_context_rebuild_available";
      readonly owner: "task-engine";
    }
  | {
      readonly available: false;
      readonly reasonCode: "task_context_rebuild_not_implemented";
      readonly owner: "WP5";
    };

export interface TaskEngineCapabilities {
  readonly schemaVersion: 1;
  readonly actions: Readonly<
    Record<TaskContextRecoveryCapability, TaskEngineCapabilityState>
  >;
}

export interface PersistableTaskState {
  manifest: TaskManifestV1;
  brief?: TaskBriefV1;
  claims: ClaimV1[];
  evidence: EvidenceV1[];
  impactPaths: ImpactPathV1[];
  changeChecks: ChangeCheckV1[];
  verificationRecords: VerificationRecordV1[];
  events: TaskArtifactBundleV1["events"];
  idempotencyRecords: IdempotencyRecordV1[];
  receipts: TaskOperationReceiptV1[];
}

export interface TaskBriefPage {
  result: GetTaskBriefResultV1;
  nextCursor?: string;
  total: number;
}

export type GetTaskBriefResultV1 = ReturnType<
  typeof GetTaskBriefResultV1Schema.parse
>;

export interface TaskMutationOutcome {
  task: TaskManifestV1;
  mutation: MutationResultV1;
}

export interface BuiltTaskContext {
  brief: TaskBriefV1;
  claims: ClaimV1[];
  evidence: EvidenceV1[];
  impactPaths: ImpactPathV1[];
}

export type {
  BuildTaskBriefInputV1,
  BuildTaskBriefResultV1,
  GetTaskBriefInputV1,
  RepoPulseV1,
  RepoPulsePersistedPayloadV1,
  RepositorySnapshotV1,
  RepositorySnapshotPersistedPayloadV1,
  UpdateTaskInputV1,
};
