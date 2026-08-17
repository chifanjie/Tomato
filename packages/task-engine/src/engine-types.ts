import type {
  BuildTaskBriefInputV1,
  BuildTaskBriefResultV1,
  ChangeCheckV1,
  ClaimV1,
  EvidenceV1,
  GetTaskBriefInputV1,
  GetTaskBriefResultV1Schema,
  IdempotencyRecordV1,
  ImpactPathV1,
  MutationResultV1,
  RepoPulseV1,
  RepositorySnapshotV1,
  TaskArtifactBundleV1,
  TaskBriefV1,
  TaskManifestV1,
  TaskOperationReceiptV1,
  UpdateTaskInputV1,
  VerificationRecordV1,
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
  repositorySnapshot: RepositorySnapshotV1;
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
}

export interface TaskEngineOptions {
  contextProvider: TaskContextProvider;
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
  RepositorySnapshotV1,
  UpdateTaskInputV1,
};
