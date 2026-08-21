import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";

import {
  CursorV1Schema,
  GetTaskBriefInputV1Schema,
  GetTaskBriefResultV1Schema,
  OpenWorkbenchInputV1Schema,
  OpenWorkbenchOutputV1Schema,
  TaskBriefSectionV1Schema,
  ToolSuccessMetaV1Schema,
  WorkbenchRouteV1Schema,
  type GetTaskBriefInputV1,
  type OpenWorkbenchInputV1,
  type OpenWorkbenchOutputV1,
  type TaskBriefSectionV1,
  type ToolSuccessMetaV1,
  type WorkbenchRouteV1,
} from "@understand-code/contracts/mcp";
import {
  ContentDigestSchema,
  EvidenceIdSchema,
  GitObjectIdSchema,
  IsoTimestampSchema,
  LineRangeSchema,
  ProducerVersionSchema,
  RepositoryIdSchema,
  RepositoryRelativePathSchema,
  SnapshotIdSchema,
  TaskIdSchema,
  WorktreeIdSchema,
} from "@understand-code/contracts/primitives";

const DEFAULT_LAUNCH_TTL_MS = 60_000;
const MAX_LAUNCH_TTL_MS = 60_000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1_000;
const SESSION_IDLE_TTL_MS = 30 * 60 * 1_000;
const LOOPBACK_HOST = "127.0.0.1" as const;

export interface WorkbenchRuntimeBindingV1 {
  /** The already-bound canonical root. It must be absolute and realpath-stable. */
  readonly canonicalRoot: string;
  readonly productVersion: string;
  readonly repositoryId: string;
  readonly worktreeId: string;
  readonly sourceSnapshotId: string;
  readonly headCommit: string | null;
  readonly worktreeFingerprint: `sha256:${string}`;
  readonly freshness: ToolSuccessMetaV1["freshness"];
}

/**
 * The result type is intentionally derived from the frozen MCP contract.  The
 * runtime does not accept arbitrary JSON from a host callback: it parses this
 * result before exposing it over the loopback HTTP endpoint.
 */
export type WorkbenchTaskBriefResultV1 = ReturnType<
  typeof GetTaskBriefResultV1Schema.parse
>;

export interface WorkbenchTaskBriefPageV1 {
  readonly result: WorkbenchTaskBriefResultV1;
  readonly total: number;
  readonly nextCursor?: string;
}

export type WorkbenchTaskBriefReaderV1 = (
  input: GetTaskBriefInputV1,
) => Promise<WorkbenchTaskBriefPageV1 | WorkbenchTaskBriefResultV1 | undefined>;

/**
 * Read-only repository context surfaces exposed by the local Workbench.
 *
 * The browser never receives the source artifact itself through this channel.
 * Hosts project the published Graph/Wiki files into these small, fixed-shape
 * summaries.  Keeping the projection here makes the loopback endpoint useful
 * to the UI while preserving the artifact store as the source of truth.
 */
export type WorkbenchContextSurfaceV1 = "graph" | "knowledge";
export type WorkbenchContextUnavailableReasonV1 =
  | "not_published"
  | "invalid_artifact"
  | "read_failed";

export interface WorkbenchContextRequestV1 {
  readonly surface: WorkbenchContextSurfaceV1;
  readonly taskId: string;
  readonly repositoryId: string;
  readonly worktreeId: string;
}

export interface WorkbenchGraphContextArtifactV1 {
  readonly artifactPath: ".understand-code/knowledge-graph.json";
  readonly metadata: {
    readonly version: string;
    readonly projectName: string;
    readonly analyzedAt: string;
    readonly gitCommitHash: string;
  };
  readonly counts: {
    readonly nodes: number;
    readonly edges: number;
    readonly layers: number;
    readonly tour: number;
  };
}

export interface WorkbenchKnowledgeContextArtifactV1 {
  readonly artifactPath: ".understand-code/knowledge-base/wiki-index.json";
  readonly metadata: {
    readonly version: number;
    readonly projectName: string;
    readonly generatedAt: string;
    readonly readiness: "ready" | "degraded" | "blocked";
  };
  readonly counts: {
    readonly pages: number;
    readonly nodeDocumentation: number;
    readonly evidence: number;
  };
}

export interface WorkbenchContextReadyV1<TSurface extends WorkbenchContextSurfaceV1 = WorkbenchContextSurfaceV1> {
  readonly schemaVersion: 1;
  readonly surface: TSurface;
  readonly taskId: string;
  readonly repositoryId: string;
  readonly worktreeId: string;
  readonly status: "ready";
  readonly artifact: TSurface extends "graph"
    ? WorkbenchGraphContextArtifactV1
    : WorkbenchKnowledgeContextArtifactV1;
}

export interface WorkbenchContextUnavailableV1 {
  readonly schemaVersion: 1;
  readonly surface: WorkbenchContextSurfaceV1;
  readonly taskId: string;
  readonly repositoryId: string;
  readonly worktreeId: string;
  readonly status: "unavailable";
  readonly reason: WorkbenchContextUnavailableReasonV1;
}

export type WorkbenchContextResultV1 =
  | WorkbenchContextReadyV1<"graph">
  | WorkbenchContextReadyV1<"knowledge">
  | WorkbenchContextUnavailableV1;

export type WorkbenchContextReaderV1 = (
  input: WorkbenchContextRequestV1,
) => Promise<WorkbenchContextResultV1 | undefined>;

/**
 * Read-only Change Check/Verification projection for the local Workbench.
 *
 * This is deliberately an internal Workbench DTO rather than a new MCP
 * contract.  Verification detail (command, output, exit code, duration and
 * summary) is never exposed here; the `externally_reported` disposition tells
 * the user that the host recorded a result and that this runtime did not run
 * the command.
 */
export interface WorkbenchTraceRequestV1 {
  readonly surface: "trace";
  readonly taskId: string;
  readonly repositoryId: string;
  readonly worktreeId: string;
  /** Snapshot pinned by the authenticated Workbench session. */
  readonly snapshotId: string;
}

export type WorkbenchTraceStatusV1 =
  | "ready"
  | "empty"
  | "stale"
  | "unavailable";

export type WorkbenchTraceUnavailableReasonV1 =
  | "not_published"
  | "invalid_projection"
  | "read_failed";

export interface WorkbenchTraceFindingV1 {
  readonly id: string;
  readonly type:
    | "planned_completed"
    | "planned_partial"
    | "unplanned_change"
    | "possible_omission"
    | "verification_gap"
    | "cannot_determine";
  readonly severity: "info" | "warning" | "error" | "critical";
  readonly blocking: boolean;
  /** No finding text/path is returned over the Workbench projection. */
  readonly resolution: "unresolved" | "fixed" | "accepted";
}

export interface WorkbenchTraceChangeCheckV1 {
  readonly sourceArtifactId: string;
  readonly id: string;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly baselineSnapshotId: string;
  readonly actualSnapshotId: string;
  readonly generatedAt: string;
  readonly findings: readonly WorkbenchTraceFindingV1[];
  readonly counts: {
    readonly total: number;
    readonly blocking: number;
    readonly openBlocking: number;
  };
}

/** Public legacy-safe Verification shape; transient execution detail is redacted. */
export interface WorkbenchTraceVerificationRecordV1 {
  readonly sourceArtifactId: string;
  readonly sourceRecordId: string;
  readonly taskId: string;
  readonly verificationPlanEntryId: string;
  readonly attempt: number;
  readonly supersedesVerificationRecordId?: string;
  readonly method: "test" | "build" | "lint" | "manual" | "runtime";
  readonly status: "passed" | "failed" | "skipped" | "blocked" | "flaky";
  readonly claimIds: readonly string[];
  readonly snapshotId: string;
  readonly recordedAt: string;
  readonly detailStatus: "legacy_redacted";
  readonly disposition: "externally_reported";
}

export interface WorkbenchTraceResultV1 {
  readonly schemaVersion: 1;
  readonly surface: "trace";
  readonly taskId: string;
  readonly repositoryId: string;
  readonly worktreeId: string;
  /** Always equals the session-pinned snapshotId, including stale results. */
  readonly snapshotId: string;
  readonly status: WorkbenchTraceStatusV1;
  readonly reason?: WorkbenchTraceUnavailableReasonV1;
  /** Present only when the Task bundle is newer than the session snapshot. */
  readonly observedSnapshotId?: string;
  readonly changeCheck?: WorkbenchTraceChangeCheckV1;
  readonly verification: {
    readonly disposition: "externally_reported";
    readonly records: readonly WorkbenchTraceVerificationRecordV1[];
    readonly requiredCount: number;
    readonly passedCount: number;
    readonly failedCount: number;
    readonly pendingCount: number;
  };
}

export type WorkbenchTraceReaderV1 = (
  input: WorkbenchTraceRequestV1,
) => Promise<WorkbenchTraceResultV1 | undefined>;

/**
 * Task Evidence -> Source is an intentionally internal, read-only Workbench
 * projection.  Callers provide only the Task and Evidence identifiers; the
 * runtime supplies the repository/worktree/snapshot/head binding from the
 * redeemed browser session before invoking the host reader.
 */
export interface WorkbenchEvidenceRequestV1 {
  readonly taskId: string;
  readonly evidenceId: string;
  readonly repositoryId: string;
  readonly worktreeId: string;
  readonly snapshotId: string;
  readonly headCommit: string | null;
}

export type WorkbenchEvidenceStatusV1 =
  | "ready"
  | "stale"
  | "invalid"
  | "unavailable"
  | "redacted";

export type WorkbenchEvidenceUnavailableReasonV1 =
  | "not_published"
  | "not_found"
  | "snapshot_mismatch"
  | "evidence_stale"
  | "evidence_invalid"
  | "source_unanchored"
  | "source_missing"
  | "content_changed"
  | "sensitive"
  | "binary"
  | "too_large"
  | "read_failed"
  | "redacted";

export interface WorkbenchEvidenceRecordV1 {
  readonly id: string;
  readonly kind: "source" | "config" | "test" | "document";
  readonly epistemicStatus: "observed" | "inferred";
  readonly freshness: "current" | "changed" | "stale" | "invalid";
  /** Repository-relative only; never an absolute path. */
  readonly filePath: string;
  readonly lineRange: readonly [number, number];
  readonly contentHash: `sha256:${string}`;
  readonly observedAtSnapshotId: string;
}

export interface WorkbenchSourceProjectionV1 {
  readonly filePath: string;
  readonly lineRange: readonly [number, number];
  readonly content: string;
  readonly sizeBytes: number;
  readonly lineCount: number;
  readonly truncated: false;
}

interface WorkbenchEvidenceResultBaseV1 {
  readonly schemaVersion: 1;
  readonly surface: "evidence";
  readonly taskId: string;
  readonly evidenceId: string;
  readonly repositoryId: string;
  readonly worktreeId: string;
  readonly snapshotId: string;
  readonly headCommit: string | null;
}

export interface WorkbenchEvidenceReadyV1 extends WorkbenchEvidenceResultBaseV1 {
  readonly status: "ready";
  readonly evidence: WorkbenchEvidenceRecordV1;
  readonly source: WorkbenchSourceProjectionV1;
}

export interface WorkbenchEvidenceNotReadyV1 extends WorkbenchEvidenceResultBaseV1 {
  readonly status: Exclude<WorkbenchEvidenceStatusV1, "ready">;
  readonly reason: WorkbenchEvidenceUnavailableReasonV1;
  readonly observedSnapshotId?: string;
  /** Metadata may be retained for stale/invalid states, but never source text. */
  readonly evidence?: WorkbenchEvidenceRecordV1;
}

export type WorkbenchEvidenceResultV1 =
  | WorkbenchEvidenceReadyV1
  | WorkbenchEvidenceNotReadyV1;

export type WorkbenchEvidenceReaderV1 = (
  input: WorkbenchEvidenceRequestV1,
) => Promise<WorkbenchEvidenceResultV1 | undefined>;

export interface OpenWorkbenchSessionOptionsV1 extends WorkbenchRuntimeBindingV1 {
  /** Defaults to the frozen 60 second launch-token TTL. */
  readonly launchTokenTtlMs?: number;
  /** Injected clock is intentionally kept local/test-only and never serialized. */
  readonly now?: () => number;
  /** Defaults to an ephemeral loopback port. Non-loopback hosts are rejected. */
  readonly host?: typeof LOOPBACK_HOST;
  readonly port?: number;
  /** Read-only callback bound by the Host to its persisted Task Engine. */
  readonly taskBriefReader?: WorkbenchTaskBriefReaderV1;
  /** Optional read-only callback for the published Graph projection. */
  readonly graphReader?: WorkbenchContextReaderV1;
  /** Optional read-only callback for the published Wiki projection. */
  readonly knowledgeReader?: WorkbenchContextReaderV1;
  /** Optional read-only callback for the Task-bound Check/Verification trace. */
  readonly traceReader?: WorkbenchTraceReaderV1;
  /** Optional read-only callback for Task Evidence and its guarded Source preview. */
  readonly evidenceReader?: WorkbenchEvidenceReaderV1;
}

export interface WorkbenchLaunchGrantV1 {
  readonly sessionId: string;
  readonly sessionToken: string;
  readonly route: WorkbenchRouteV1;
  readonly identity: { readonly productVersion: string; readonly worktreeId: string };
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface WorkbenchSessionV1 {
  readonly output: OpenWorkbenchOutputV1;
  readonly canonicalRoot: string;
  readonly identity: { readonly productVersion: string; readonly worktreeId: string };
  readonly port: number;
  readonly server: Server;
  /** Redeem a launch token exactly once and create a short-lived browser session. */
  readonly redeemLaunchToken: (token: string) => WorkbenchLaunchGrantV1;
  /** Read-only projection used by the HTTP task route. */
  readonly readTaskRoute: (sessionToken: string, taskId: string) => WorkbenchRouteV1;
  /** Read one contract-validated Task Brief page for an authenticated session. */
  readonly readTaskBrief: (
    sessionToken: string,
    input: GetTaskBriefInputV1,
  ) => Promise<WorkbenchTaskBriefPageV1>;
  /** Read one authenticated, Task-bound Graph/Wiki projection. */
  readonly readWorkbenchContext: (
    sessionToken: string,
    input: WorkbenchContextRequestV1,
  ) => Promise<WorkbenchContextResultV1>;
  /** Read one authenticated, Task- and Snapshot-bound trace projection. */
  readonly readWorkbenchTrace: (
    sessionToken: string,
    input: WorkbenchTraceRequestV1,
  ) => Promise<WorkbenchTraceResultV1>;
  /** Read one authenticated, Task- and Snapshot-bound Evidence/Source projection. */
  readonly readWorkbenchEvidence: (
    sessionToken: string,
    input: WorkbenchEvidenceRequestV1,
  ) => Promise<WorkbenchEvidenceResultV1>;
  readonly close: () => Promise<void>;
}

export class WorkbenchSessionError extends Error {
  readonly code:
    | "invalid_root"
    | "invalid_input"
    | "invalid_identity"
    | "launch_token_invalid"
    | "launch_token_expired"
    | "launch_token_replayed"
    | "session_invalid"
    | "session_expired"
    | "server_error";

  constructor(
    code: WorkbenchSessionError["code"],
    message: string = code,
  ) {
    super(message);
    this.name = "WorkbenchSessionError";
    this.code = code;
  }
}

interface PendingLaunchV1 {
  readonly token: string;
  readonly route: WorkbenchRouteV1;
  /** Immutable repository generation captured by the open that minted this token. */
  readonly binding: WorkbenchLaunchBindingV1;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  redeemed: boolean;
}

interface BrowserSessionV1 {
  readonly sessionId: string;
  readonly sessionToken: string;
  readonly route: WorkbenchRouteV1;
  readonly identity: { readonly productVersion: string; readonly worktreeId: string };
  /** Preserves the redeemed launch generation even when the runtime is reused. */
  readonly binding: WorkbenchLaunchBindingV1;
  readonly issuedAtMs: number;
  lastSeenAtMs: number;
  readonly expiresAtMs: number;
}

type WorkbenchLaunchBindingV1 = Readonly<
  Pick<
    WorkbenchRuntimeBindingV1,
    | "productVersion"
    | "repositoryId"
    | "worktreeId"
    | "sourceSnapshotId"
    | "headCommit"
    | "worktreeFingerprint"
    | "freshness"
  >
>;

interface StoredSessionV1 {
  readonly session: WorkbenchSessionV1;
  readonly launches: Map<string, PendingLaunchV1>;
  readonly now: () => number;
  taskBriefReader?: WorkbenchTaskBriefReaderV1;
  graphReader?: WorkbenchContextReaderV1;
  knowledgeReader?: WorkbenchContextReaderV1;
  traceReader?: WorkbenchTraceReaderV1;
  evidenceReader?: WorkbenchEvidenceReaderV1;
}

const sessionsByIdentity = new Map<string, StoredSessionV1>();

function identityKey(binding: WorkbenchRuntimeBindingV1, canonicalRoot: string): string {
  return `${canonicalRoot}\u0000${binding.productVersion}\u0000${binding.worktreeId}`;
}

function launchBinding(binding: WorkbenchRuntimeBindingV1): WorkbenchLaunchBindingV1 {
  return Object.freeze({
    productVersion: binding.productVersion,
    repositoryId: binding.repositoryId,
    worktreeId: binding.worktreeId,
    sourceSnapshotId: binding.sourceSnapshotId,
    headCommit: binding.headCommit,
    worktreeFingerprint: binding.worktreeFingerprint,
    freshness: binding.freshness,
  });
}

function runtimeIdentity(binding: WorkbenchLaunchBindingV1): BrowserSessionV1["identity"] {
  return Object.freeze({
    productVersion: binding.productVersion,
    worktreeId: binding.worktreeId,
  });
}

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

function timestamp(ms: number): string {
  return IsoTimestampSchema.parse(new Date(ms).toISOString());
}

function assertSafeToken(token: string): void {
  if (
    typeof token !== "string" ||
    token.length < 32 ||
    token.length > 256 ||
    !/^[A-Za-z0-9_-]+$/u.test(token)
  ) {
    throw new WorkbenchSessionError("launch_token_invalid", "unknown launch token");
  }
}

async function canonicalizeRoot(root: string): Promise<string> {
  if (typeof root !== "string" || !path.isAbsolute(root)) {
    throw new WorkbenchSessionError("invalid_root", "canonical root must be absolute");
  }
  let canonical: string;
  try {
    const metadata = await stat(root);
    if (!metadata.isDirectory()) {
      throw new WorkbenchSessionError("invalid_root", "canonical root must be a directory");
    }
    canonical = await realpath(root);
  } catch (error) {
    if (error instanceof WorkbenchSessionError) throw error;
    throw new WorkbenchSessionError("invalid_root", "canonical root is unavailable");
  }
  return canonical;
}

function validateBinding(binding: WorkbenchRuntimeBindingV1): void {
  const parsed = ToolSuccessMetaV1Schema.safeParse({
    repositoryId: binding.repositoryId,
    worktreeId: binding.worktreeId,
    sourceSnapshotId: binding.sourceSnapshotId,
    headCommit: binding.headCommit,
    worktreeFingerprint: binding.worktreeFingerprint,
    freshness: binding.freshness,
    durationMs: 0,
    cacheHit: true,
    truncated: false,
    truncatedCategories: [],
  });
  if (!parsed.success || !ProducerVersionSchema.safeParse(binding.productVersion).success) {
    throw new WorkbenchSessionError("invalid_identity", "runtime identity is invalid");
  }
}

const GRAPH_ARTIFACT_PATH = ".understand-code/knowledge-graph.json" as const;
const KNOWLEDGE_ARTIFACT_PATH = ".understand-code/knowledge-base/wiki-index.json" as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = new Set(keys);
  return Object.keys(value).length === expected.size &&
    Object.keys(value).every((key) => expected.has(key));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isContextSurface(value: unknown): value is WorkbenchContextSurfaceV1 {
  return value === "graph" || value === "knowledge";
}

function isUnavailableReason(value: unknown): value is WorkbenchContextUnavailableReasonV1 {
  return value === "not_published" || value === "invalid_artifact" || value === "read_failed";
}

function unavailableContext(
  input: WorkbenchContextRequestV1,
  reason: WorkbenchContextUnavailableReasonV1,
): WorkbenchContextUnavailableV1 {
  return {
    schemaVersion: 1,
    surface: input.surface,
    taskId: input.taskId,
    repositoryId: input.repositoryId,
    worktreeId: input.worktreeId,
    status: "unavailable",
    reason,
  };
}

/**
 * Parse a host callback result without allowing arbitrary JSON to cross the
 * capability boundary.  The endpoint intentionally accepts only the fixed
 * metadata/count projections declared above.
 */
function parseContextResult(
  value: unknown,
  input: WorkbenchContextRequestV1,
): WorkbenchContextResultV1 {
  if (value === undefined) return unavailableContext(input, "not_published");
  if (!isRecord(value) || !hasExactKeys(value, [
    "schemaVersion",
    "surface",
    "taskId",
    "repositoryId",
    "worktreeId",
    "status",
    ...(value.status === "ready" ? ["artifact"] : ["reason"]),
  ])) {
    throw new WorkbenchSessionError("session_invalid", "context projection is invalid");
  }
  if (
    value.schemaVersion !== 1 ||
    value.surface !== input.surface ||
    value.taskId !== input.taskId ||
    value.repositoryId !== input.repositoryId ||
    value.worktreeId !== input.worktreeId
  ) {
    throw new WorkbenchSessionError("session_invalid", "context projection identity does not match session");
  }
  if (value.status === "unavailable") {
    if (!isUnavailableReason(value.reason)) {
      throw new WorkbenchSessionError("session_invalid", "context unavailable reason is invalid");
    }
    return value as unknown as WorkbenchContextUnavailableV1;
  }
  if (value.status !== "ready" || !isRecord(value.artifact) || !hasExactKeys(value.artifact, [
    "artifactPath",
    "metadata",
    "counts",
  ])) {
    throw new WorkbenchSessionError("session_invalid", "context projection is invalid");
  }
  const artifact = value.artifact;
  if (!isRecord(artifact.metadata) || !isRecord(artifact.counts)) {
    throw new WorkbenchSessionError("session_invalid", "context metadata is invalid");
  }
  if (input.surface === "graph") {
    if (
      artifact.artifactPath !== GRAPH_ARTIFACT_PATH ||
      !hasExactKeys(artifact.metadata, ["version", "projectName", "analyzedAt", "gitCommitHash"]) ||
      typeof artifact.metadata.version !== "string" ||
      typeof artifact.metadata.projectName !== "string" ||
      typeof artifact.metadata.analyzedAt !== "string" ||
      typeof artifact.metadata.gitCommitHash !== "string" ||
      !hasExactKeys(artifact.counts, ["nodes", "edges", "layers", "tour"]) ||
      !isNonNegativeInteger(artifact.counts.nodes) ||
      !isNonNegativeInteger(artifact.counts.edges) ||
      !isNonNegativeInteger(artifact.counts.layers) ||
      !isNonNegativeInteger(artifact.counts.tour)
    ) {
      throw new WorkbenchSessionError("session_invalid", "Graph projection is invalid");
    }
  } else {
    if (
      artifact.artifactPath !== KNOWLEDGE_ARTIFACT_PATH ||
      !hasExactKeys(artifact.metadata, ["version", "projectName", "generatedAt", "readiness"]) ||
      artifact.metadata.version !== 2 ||
      typeof artifact.metadata.projectName !== "string" ||
      typeof artifact.metadata.generatedAt !== "string" ||
      (artifact.metadata.readiness !== "ready" &&
        artifact.metadata.readiness !== "degraded" &&
        artifact.metadata.readiness !== "blocked") ||
      !hasExactKeys(artifact.counts, ["pages", "nodeDocumentation", "evidence"]) ||
      !isNonNegativeInteger(artifact.counts.pages) ||
      !isNonNegativeInteger(artifact.counts.nodeDocumentation) ||
      !isNonNegativeInteger(artifact.counts.evidence)
    ) {
      throw new WorkbenchSessionError("session_invalid", "Knowledge projection is invalid");
    }
  }
  return value as unknown as WorkbenchContextResultV1;
}

const MAX_EVIDENCE_SOURCE_BYTES = 256 * 1024;
const EVIDENCE_KINDS = new Set(["source", "config", "test", "document"]);
const EVIDENCE_EPISTEMIC_STATUSES = new Set(["observed", "inferred"]);
const EVIDENCE_FRESHNESS = new Set(["current", "changed", "stale", "invalid"]);
const EVIDENCE_STATUSES = new Set(["ready", "stale", "invalid", "unavailable", "redacted"]);
const EVIDENCE_REASONS = new Set([
  "not_published",
  "not_found",
  "snapshot_mismatch",
  "evidence_stale",
  "evidence_invalid",
  "source_unanchored",
  "source_missing",
  "content_changed",
  "sensitive",
  "binary",
  "too_large",
  "read_failed",
  "redacted",
]);

/** Deliberately conservative path screening for source previews. */
const SENSITIVE_PATH_COMPONENTS = new Set([
  ".aws", ".git-credentials", ".gnupg", ".kube", ".netrc", ".npmrc", ".pypirc", ".ssh",
  "application_default_credentials.json", "auth.json", "credential", "credentials",
  "credentials.json", "id_dsa", "id_ecdsa", "id_ed25519", "id_rsa", "secret", "secrets",
  "secrets.json",
]);

function isSensitiveEvidencePath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const components = lower.split("/");
  if (components.some((component) => SENSITIVE_PATH_COMPONENTS.has(component))) return true;
  const basename = components[components.length - 1] ?? "";
  return basename === ".env" || basename.startsWith(".env.") && !basename.endsWith(".example") &&
    !basename.endsWith(".sample") && !basename.endsWith(".template") ||
    /(?:^|[-_.])(secret|token|password|credential|private[-_]?key)(?:[-_.]|$)/u.test(basename) ||
    /\.(?:pem|key|p12|pfx)$/u.test(basename) || /^id_[a-z0-9]+$/u.test(basename) ||
    /^service-account(?:[-_.].*)?\.json$/u.test(basename);
}

function evidenceBase(input: WorkbenchEvidenceRequestV1): WorkbenchEvidenceResultBaseV1 {
  return {
    schemaVersion: 1,
    surface: "evidence",
    taskId: input.taskId,
    evidenceId: input.evidenceId,
    repositoryId: input.repositoryId,
    worktreeId: input.worktreeId,
    snapshotId: input.snapshotId,
    headCommit: input.headCommit,
  };
}

function unavailableEvidence(
  input: WorkbenchEvidenceRequestV1,
  status: Exclude<WorkbenchEvidenceStatusV1, "ready">,
  reason: WorkbenchEvidenceUnavailableReasonV1,
  extras: { readonly observedSnapshotId?: string; readonly evidence?: WorkbenchEvidenceRecordV1 } = {},
): WorkbenchEvidenceNotReadyV1 {
  return {
    ...evidenceBase(input),
    status,
    reason,
    ...(extras.observedSnapshotId === undefined ? {} : { observedSnapshotId: extras.observedSnapshotId }),
    ...(extras.evidence === undefined ? {} : { evidence: extras.evidence }),
  };
}

function evidenceIdentityIsValid(input: WorkbenchEvidenceRequestV1): boolean {
  return TaskIdSchema.safeParse(input.taskId).success &&
    EvidenceIdSchema.safeParse(input.evidenceId).success &&
    RepositoryIdSchema.safeParse(input.repositoryId).success &&
    WorktreeIdSchema.safeParse(input.worktreeId).success &&
    SnapshotIdSchema.safeParse(input.snapshotId).success &&
    (input.headCommit === null || GitObjectIdSchema.safeParse(input.headCommit).success);
}

function parseEvidenceRecord(value: unknown): WorkbenchEvidenceRecordV1 | undefined {
  if (!isRecord(value) || !hasExactKeys(value, [
    "id", "kind", "epistemicStatus", "freshness", "filePath", "lineRange",
    "contentHash", "observedAtSnapshotId",
  ])) return undefined;
  const pathResult = RepositoryRelativePathSchema.safeParse(value.filePath);
  const rangeResult = LineRangeSchema.safeParse(value.lineRange);
  const hashResult = ContentDigestSchema.safeParse(value.contentHash);
  const snapshotResult = SnapshotIdSchema.safeParse(value.observedAtSnapshotId);
  const idResult = EvidenceIdSchema.safeParse(value.id);
  if (
    !idResult.success ||
    typeof value.kind !== "string" || !EVIDENCE_KINDS.has(value.kind) ||
    typeof value.epistemicStatus !== "string" || !EVIDENCE_EPISTEMIC_STATUSES.has(value.epistemicStatus) ||
    typeof value.freshness !== "string" || !EVIDENCE_FRESHNESS.has(value.freshness) ||
    !pathResult.success || !rangeResult.success || !hashResult.success || !snapshotResult.success
  ) return undefined;
  return {
    id: idResult.data,
    kind: value.kind as WorkbenchEvidenceRecordV1["kind"],
    epistemicStatus: value.epistemicStatus as WorkbenchEvidenceRecordV1["epistemicStatus"],
    freshness: value.freshness as WorkbenchEvidenceRecordV1["freshness"],
    filePath: pathResult.data,
    lineRange: rangeResult.data,
    contentHash: hashResult.data as `sha256:${string}`,
    observedAtSnapshotId: snapshotResult.data,
  };
}

function parseSourceProjection(value: unknown): WorkbenchSourceProjectionV1 | undefined {
  if (!isRecord(value) || !hasExactKeys(value, [
    "filePath", "lineRange", "content", "sizeBytes", "lineCount", "truncated",
  ])) return undefined;
  const pathResult = RepositoryRelativePathSchema.safeParse(value.filePath);
  const rangeResult = LineRangeSchema.safeParse(value.lineRange);
  if (
    !pathResult.success || !rangeResult.success || typeof value.content !== "string" ||
    !Number.isSafeInteger(value.sizeBytes) || (value.sizeBytes as number) < 0 ||
    !Number.isSafeInteger(value.lineCount) || (value.lineCount as number) < 0 ||
    value.truncated !== false || value.content.includes("\u0000")
  ) return undefined;
  const sizeBytes = Buffer.byteLength(value.content, "utf8");
  if (sizeBytes !== value.sizeBytes || sizeBytes > MAX_EVIDENCE_SOURCE_BYTES) return undefined;
  const lineCount = value.content === "" ? 0 : value.content.split("\n").length;
  if (lineCount !== value.lineCount) return undefined;
  return {
    filePath: pathResult.data,
    lineRange: rangeResult.data,
    content: value.content,
    sizeBytes,
    lineCount,
    truncated: false,
  };
}

function parseEvidenceResult(
  value: unknown,
  input: WorkbenchEvidenceRequestV1,
): WorkbenchEvidenceResultV1 {
  if (!evidenceIdentityIsValid(input)) {
    throw new WorkbenchSessionError("invalid_input", "evidence request identity is invalid");
  }
  if (value === undefined) return unavailableEvidence(input, "unavailable", "not_published");
  if (!isRecord(value) || value.schemaVersion !== 1 || value.surface !== "evidence" ||
      value.taskId !== input.taskId || value.evidenceId !== input.evidenceId ||
      value.repositoryId !== input.repositoryId || value.worktreeId !== input.worktreeId ||
      value.snapshotId !== input.snapshotId || value.headCommit !== input.headCommit ||
      typeof value.status !== "string" || !EVIDENCE_STATUSES.has(value.status)) {
    throw new WorkbenchSessionError("session_invalid", "evidence projection identity is invalid");
  }
  const status = value.status as WorkbenchEvidenceStatusV1;
  if (status === "ready") {
    if (!hasExactKeys(value, ["schemaVersion", "surface", "taskId", "evidenceId", "repositoryId", "worktreeId", "snapshotId", "headCommit", "status", "evidence", "source"])) {
      throw new WorkbenchSessionError("session_invalid", "evidence ready projection is invalid");
    }
    const evidence = parseEvidenceRecord(value.evidence);
    const source = parseSourceProjection(value.source);
    if (evidence === undefined || source === undefined || evidence.id !== input.evidenceId ||
        evidence.freshness !== "current" || evidence.observedAtSnapshotId !== input.snapshotId ||
        evidence.filePath !== source.filePath || evidence.lineRange[0] !== source.lineRange[0] ||
        evidence.lineRange[1] !== source.lineRange[1]) {
      throw new WorkbenchSessionError("session_invalid", "evidence ready projection is invalid");
    }
    if (isSensitiveEvidencePath(evidence.filePath) || isSensitiveEvidencePath(source.filePath)) {
      return unavailableEvidence(input, "redacted", "sensitive");
    }
    return { ...evidenceBase(input), status: "ready", evidence, source };
  }
  if (!hasOnlyKeys(value, ["schemaVersion", "surface", "taskId", "evidenceId", "repositoryId", "worktreeId", "snapshotId", "headCommit", "status", "reason", "observedSnapshotId", "evidence"]) ||
      typeof value.reason !== "string" || !EVIDENCE_REASONS.has(value.reason)) {
    throw new WorkbenchSessionError("session_invalid", "evidence unavailable projection is invalid");
  }
  const reason = value.reason as WorkbenchEvidenceUnavailableReasonV1;
  const evidence = value.evidence === undefined ? undefined : parseEvidenceRecord(value.evidence);
  if (value.evidence !== undefined && evidence === undefined) {
    throw new WorkbenchSessionError("session_invalid", "evidence metadata is invalid");
  }
  if (evidence !== undefined && (evidence.id !== input.evidenceId || isSensitiveEvidencePath(evidence.filePath))) {
    return unavailableEvidence(input, "redacted", "sensitive");
  }
  const observedSnapshotResult = value.observedSnapshotId === undefined
    ? undefined
    : SnapshotIdSchema.safeParse(value.observedSnapshotId);
  const observedSnapshotId = observedSnapshotResult?.success === true ? observedSnapshotResult.data : value.observedSnapshotId;
  if (value.observedSnapshotId !== undefined && (observedSnapshotResult?.success !== true || observedSnapshotId === input.snapshotId)) {
    throw new WorkbenchSessionError("session_invalid", "evidence observed snapshot is invalid");
  }
  if (status !== "stale" && observedSnapshotId !== undefined) {
    throw new WorkbenchSessionError("session_invalid", "only stale evidence may expose an observed snapshot");
  }
  return unavailableEvidence(input, status, reason, {
    ...(observedSnapshotResult?.success === true ? { observedSnapshotId: observedSnapshotResult.data } : {}),
    ...(evidence === undefined ? {} : { evidence }),
  });
}

function routePath(route: WorkbenchRouteV1): string {
  const params = new URLSearchParams({ view: route.view });
  if (route.taskId !== undefined) params.set("taskId", route.taskId);
  if (route.section !== undefined) params.set("section", route.section);
  if (route.findingId !== undefined) params.set("findingId", route.findingId);
  if (route.evidenceId !== undefined) params.set("evidenceId", route.evidenceId);
  if (route.impactPathId !== undefined) params.set("impactPathId", route.impactPathId);
  if (route.focus !== undefined) params.set("focus", route.focus);
  return `/workbench?${params.toString()}`;
}

function launchUrl(port: number, route: WorkbenchRouteV1, token: string): string {
  return `http://${LOOPBACK_HOST}:${port}${routePath(route)}#${token}`;
}

function readCookie(request: IncomingMessage, name: string): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (cookieHeader === undefined) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function writeJson(response: ServerResponse, status: number, value: unknown, headers?: Record<string, string>): void {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(body);
}

function unauthorized(response: ServerResponse): void {
  writeJson(response, 401, { error: "workbench_session_required" });
}

const BOOTSTRAP_SCRIPT = `const token=location.hash.slice(1);if(token){fetch('/__workbench/launch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})}).then(r=>{if(!r.ok)throw new Error('launch failed');return r.json()}).then(()=>{history.replaceState(null,'',location.pathname+location.search);location.reload()}).catch(()=>location.hash='');}`;

const WORKBENCH_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'";

const WORKBENCH_CSS = String.raw`:root {
  --color-root: #0f1117;
  --color-surface: #171a23;
  --color-surface-raised: #202532;
  --color-text-primary: #f4f6fb;
  --color-text-secondary: #b4bdcf;
  --color-text-muted: #7f8aa2;
  --color-accent: #7dd3fc;
  --color-accent-strong: #38bdf8;
  --color-border-subtle: #2a3140;
  --color-border-medium: #3a4559;
  --radius-panel: 14px;
  --radius-control: 9px;
  --font-body: Inter, ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
}
* { box-sizing: border-box; }
html, body { min-height: 100%; margin: 0; }
body { background: var(--color-root); color: var(--color-text-primary); font: 14px/1.5 var(--font-body); }
button, a { font: inherit; }
a { color: inherit; text-decoration: none; }
.wb-shell { min-height: 100vh; display: grid; grid-template-rows: auto 1fr; }
.wb-header { display: flex; align-items: center; justify-content: space-between; gap: 18px; min-height: 64px; padding: 12px 24px; border-bottom: 1px solid var(--color-border-subtle); background: var(--color-surface); }
.wb-brand { min-width: 0; }
.wb-kicker { color: var(--color-accent); font: 600 11px/1.2 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; }
.wb-title { margin: 3px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 16px; font-weight: 650; }
.wb-status { display: inline-flex; align-items: center; gap: 7px; color: var(--color-text-secondary); font-size: 12px; white-space: nowrap; }
.wb-status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-accent); }
.wb-status[data-state="stale"] .wb-status-dot { background: #f6c453; }
.wb-status[data-state="error"] .wb-status-dot { background: #f07f7f; }
.wb-layout { width: min(1440px, 100%); margin: 0 auto; padding: 24px; display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 24px; }
.wb-sidebar { display: flex; flex-direction: column; gap: 18px; }
.wb-nav, .wb-surfaces { display: grid; gap: 6px; }
.wb-nav-title { padding: 0 10px 4px; color: var(--color-text-muted); font: 600 11px/1.2 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; }
.wb-nav button, .wb-surface { width: 100%; min-height: 40px; padding: 9px 11px; border: 1px solid transparent; border-radius: var(--radius-control); background: transparent; color: var(--color-text-secondary); text-align: left; cursor: pointer; }
.wb-nav button:hover, .wb-surface:hover { background: var(--color-surface); color: var(--color-text-primary); }
.wb-nav button[aria-current="page"], .wb-surface[aria-current="page"] { border-color: var(--color-border-medium); background: var(--color-surface-raised); color: var(--color-text-primary); }
.wb-surface { display: flex; align-items: center; justify-content: space-between; }
.wb-unavailable { color: var(--color-text-muted); font-size: 11px; }
.wb-main { min-width: 0; }
.uc-panel { border: 1px solid var(--color-border-subtle); border-radius: var(--radius-panel); background: var(--color-surface); }
.wb-panel { min-height: 360px; padding: clamp(18px, 3vw, 32px); }
.wb-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.wb-panel-title { margin: 0; font-size: clamp(20px, 2.5vw, 30px); line-height: 1.15; }
.wb-panel-subtitle { margin: 6px 0 0; color: var(--color-text-secondary); }
.wb-state { display: grid; place-items: center; min-height: 220px; padding: 28px; border: 1px dashed var(--color-border-medium); border-radius: var(--radius-control); color: var(--color-text-secondary); text-align: center; }
.wb-state strong { display: block; margin-bottom: 6px; color: var(--color-text-primary); }
.wb-banner { margin-bottom: 18px; padding: 10px 12px; border: 1px solid #806b31; border-radius: var(--radius-control); background: #312a18; color: #f6d889; }
.wb-items { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.wb-item { padding: 13px 14px; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-control); background: var(--color-surface-raised); }
.wb-item-label { color: var(--color-text-muted); font: 600 11px/1.3 var(--font-mono); text-transform: uppercase; letter-spacing: .05em; }
.wb-item-value { margin-top: 4px; overflow-wrap: anywhere; }
.wb-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; }
.wb-button { min-height: 36px; padding: 7px 11px; border: 1px solid var(--color-border-medium); border-radius: var(--radius-control); background: var(--color-surface-raised); color: var(--color-text-primary); cursor: pointer; }
.wb-button:hover, .wb-button:focus-visible { border-color: var(--color-accent-strong); outline: 2px solid transparent; }
.wb-source { margin: 12px 0 0; padding: 14px; overflow: auto; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-control); background: #0b0d12; color: var(--color-text-primary); font: 12px/1.55 var(--font-mono); white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 900px) { .wb-layout { grid-template-columns: 1fr; gap: 16px; } .wb-sidebar { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } .wb-nav { display: flex; overflow-x: auto; } .wb-nav-title { display: none; } .wb-nav button { min-width: max-content; } }
@media (max-width: 560px) { .wb-header { align-items: flex-start; flex-direction: column; padding: 16px; } .wb-layout { padding: 16px; } .wb-sidebar { display: block; } .wb-surfaces { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 16px; } .wb-surface { min-width: 128px; } .wb-panel { min-height: 300px; padding: 18px; } }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; transition: none !important; } }
`;

const WORKBENCH_APP_SCRIPT = String.raw`(() => {
  const body = document.body;
  const taskId = body.dataset.taskId || '';
  const view = body.dataset.view || 'tasks';
  const initialSection = body.dataset.section || 'summary';
  let activeEvidenceId = body.dataset.evidenceId || '';
  const sections = [
    ['summary', 'Summary'],
    ['goals', 'Goals'],
    ['reading_path', 'Reading'],
    ['planned_changes', 'Changes'],
    ['verification_plan', 'Verification'],
    ['trace', 'Trace']
  ];
  const aliases = { reading: 'reading_path', changes: 'planned_changes', verification: 'verification_plan', trace: 'trace' };
  const state = document.getElementById('wb-state');
  const items = document.getElementById('wb-items');
  const title = document.getElementById('wb-panel-title');
  const subtitle = document.getElementById('wb-panel-subtitle');
  const status = document.getElementById('wb-status');
  const banner = document.getElementById('wb-banner');
  const actions = document.getElementById('wb-actions');
  const nav = [...document.querySelectorAll('[data-section]')];
  const surfaces = [...document.querySelectorAll('[data-surface]')];
  const text = (value) => value == null ? '' : String(value);
  const setStatus = (label, kind) => { status.dataset.state = kind || 'ready'; status.querySelector('.wb-status-label').textContent = label; };
  const setState = (heading, message) => { state.hidden = false; state.innerHTML = ''; const strong = document.createElement('strong'); strong.textContent = heading; const p = document.createElement('p'); p.textContent = message; state.append(strong, p); items.hidden = true; };
  const appendItem = (rows, evidenceId) => { const li = document.createElement('li'); li.className = 'wb-item'; rows.forEach(([label, value]) => { const row = document.createElement('div'); const key = document.createElement('div'); key.className = 'wb-item-label'; key.textContent = text(label); const val = document.createElement('div'); val.className = 'wb-item-value'; val.textContent = text(value); row.append(key, val); li.appendChild(row); }); if (evidenceId) { const button = document.createElement('button'); button.type = 'button'; button.className = 'wb-button'; button.textContent = 'Open evidence'; button.setAttribute('aria-label', 'Open evidence ' + text(evidenceId)); button.addEventListener('click', () => { const evidenceButton = surfaces.find((item) => item.dataset.surface === 'evidence'); void loadEvidence(evidenceId, evidenceButton); }); li.appendChild(button); } items.appendChild(li); };
  const valueForItem = (item) => {
    if (item.kind === 'summary') return [['Intent', item.originalIntent], ['Acceptance claims', item.acceptanceClaimCount], ['Planned changes', item.plannedChangeCount]];
    if (item.kind === 'claim_reference') return [['Claim', item.claimId], ['Role', item.role]];
    if (item.kind === 'reading_path') return [['Path', item.entry.filePath || item.entry.symbolId || item.entry.impactPathId || 'Reading entry'], ['Kind', item.entry.kind || '']];
    if (item.kind === 'planned_change') return [['Change', item.change.filePath || item.change.intent || item.change.id || 'Planned change'], ['Candidate', item.change.candidateLevel || '']];
    if (item.kind === 'verification_plan') return [['Check', item.entry.description || item.entry.method || item.entry.id || 'Verification'], ['Required', item.entry.required === false ? 'No' : 'Yes']];
    return [['Item', item.kind]];
  };
  const renderItems = (result) => {
    items.innerHTML = '';
    if (!result.items || result.items.length === 0) { setState('Nothing recorded yet', 'This Task section is empty.'); return; }
    state.hidden = true; items.hidden = false;
    result.items.forEach((item) => appendItem(valueForItem(item), item.kind === 'reading_path' ? item.entry.evidenceIds?.[0] : undefined));
  };
  const surfaceReason = (reason) => ({ not_published: 'The published artifact is not available for this repository.', invalid_artifact: 'The published artifact failed structural validation.', read_failed: 'The published artifact could not be read safely.' }[reason] || 'The published artifact is unavailable.');
  const renderContext = (payload, label) => {
    items.innerHTML = '';
    if (!payload || payload.status === 'unavailable') { setState(label + ' unavailable', surfaceReason(payload && payload.reason)); return; }
    if (payload.status !== 'ready' || !payload.artifact) throw new Error('invalid_context');
    const artifact = payload.artifact;
    const rows = [];
    Object.entries(artifact.metadata || {}).forEach(([key, value]) => rows.push([key, value]));
    Object.entries(artifact.counts || {}).forEach(([key, value]) => rows.push([key, value]));
    if (rows.length === 0) { setState(label + ' unavailable', 'The published projection is empty.'); return; }
    state.hidden = true; items.hidden = false;
    rows.forEach(([key, value]) => { const li = document.createElement('li'); li.className = 'wb-item'; const name = document.createElement('div'); name.className = 'wb-item-label'; name.textContent = text(key); const val = document.createElement('div'); val.className = 'wb-item-value'; val.textContent = text(value); li.append(name, val); items.appendChild(li); });
  };
  const renderTrace = (payload) => {
    items.innerHTML = '';
    if (!payload || payload.status === 'unavailable') {
      setState('Trace unavailable', surfaceReason(payload && payload.reason));
      return;
    }
    if (payload.status !== 'ready' && payload.status !== 'empty' && payload.status !== 'stale') throw new Error('invalid_trace');
    state.hidden = true; items.hidden = false;
    const summaryRows = [
      ['Task', payload.taskId],
      ['Repository', payload.repositoryId],
      ['Worktree', payload.worktreeId],
      ['Snapshot', payload.snapshotId],
      ['Status', payload.status],
      ['Verification', payload.verification.disposition]
    ];
    if (payload.status === 'stale' && payload.observedSnapshotId) summaryRows.push(['Observed snapshot', payload.observedSnapshotId]);
    appendItem(summaryRows);
    if (payload.changeCheck) {
      appendItem([
        ['Change Check', payload.changeCheck.id],
        ['Baseline snapshot', payload.changeCheck.baselineSnapshotId],
        ['Actual snapshot', payload.changeCheck.actualSnapshotId],
        ['Generated at', payload.changeCheck.generatedAt],
        ['Findings', payload.changeCheck.counts.total],
        ['Blocking', payload.changeCheck.counts.blocking],
        ['Open blocking', payload.changeCheck.counts.openBlocking]
      ]);
      payload.changeCheck.findings.forEach((finding) => appendItem([
        ['Finding', finding.id],
        ['Type', finding.type],
        ['Severity', finding.severity],
        ['Blocking', finding.blocking ? 'Yes' : 'No'],
        ['Resolution', finding.resolution]
      ]));
    }
    appendItem([
      ['Required checks', payload.verification.requiredCount],
      ['Passed', payload.verification.passedCount],
      ['Failed', payload.verification.failedCount],
      ['Pending', payload.verification.pendingCount]
    ]);
    payload.verification.records.forEach((record) => appendItem([
      ['Verification record', record.sourceRecordId],
      ['Plan entry', record.verificationPlanEntryId],
      ['Attempt', record.attempt],
      ['Method', record.method],
      ['Status', record.status],
      ['Claims', record.claimIds.length],
      ['Snapshot', record.snapshotId]
    ]));
    if ((!payload.changeCheck || payload.changeCheck.findings.length === 0) && payload.verification.records.length === 0) {
      appendItem([['Details', 'No published Change Check or Verification records are available yet.']]);
    }
    if (payload.status === 'stale') {
      banner.hidden = false;
      banner.textContent = 'This trace is backed by a stale repository snapshot.';
      setStatus('Trace stale', 'stale');
    } else {
      setStatus(payload.status === 'empty' ? 'Trace empty' : 'Trace ready', 'ready');
    }
    subtitle.textContent = 'Task-bound Change Check and Verification trace. Execution detail is redacted.';
  };
  const clearActions = () => { if (actions) { actions.hidden = true; actions.innerHTML = ''; } };
  const addAction = (label, handler) => { if (!actions) return; const button = document.createElement('button'); button.type = 'button'; button.className = 'wb-button'; button.textContent = label; button.addEventListener('click', handler); actions.appendChild(button); actions.hidden = false; };
  const renderEvidence = (payload) => {
    items.innerHTML = '';
    clearActions();
    addAction('Back to Task', () => { activeEvidenceId = ''; const next = new URL(location.href); next.searchParams.delete('evidenceId'); history.replaceState(null, '', next.pathname + next.search); void load(initialSection); });
    addAction('Open Graph', () => { const graphButton = surfaces.find((item) => item.dataset.surface === 'graph'); if (graphButton) void loadSurface('graph', graphButton); });
    if (!payload || payload.status !== 'ready') {
      const reason = payload && payload.reason ? text(payload.reason).replaceAll('_', ' ') : 'not published';
      if (payload && payload.status === 'stale') { banner.hidden = false; banner.textContent = 'This evidence is backed by a stale repository snapshot.'; setStatus('Evidence stale', 'stale'); }
      else { banner.hidden = true; setStatus('Evidence unavailable', 'error'); }
      setState('Evidence ' + (payload && payload.status ? text(payload.status) : 'unavailable'), 'Source preview is fail-closed: ' + reason + '.');
      subtitle.textContent = 'Task-bound Evidence and guarded Source preview.';
      return;
    }
    state.hidden = true; items.hidden = false; banner.hidden = true;
    appendItem([
      ['Evidence', payload.evidence.id],
      ['Kind', payload.evidence.kind],
      ['Freshness', payload.evidence.freshness],
      ['File', payload.evidence.filePath],
      ['Lines', payload.evidence.lineRange.join('–')],
      ['Snapshot', payload.evidence.observedAtSnapshotId],
      ['Content hash', payload.evidence.contentHash]
    ]);
    const sourceItem = document.createElement('li'); sourceItem.className = 'wb-item';
    const sourceLabel = document.createElement('div'); sourceLabel.className = 'wb-item-label'; sourceLabel.textContent = 'Source preview';
    const sourceMeta = document.createElement('div'); sourceMeta.className = 'wb-item-value'; sourceMeta.textContent = text(payload.source.sizeBytes) + ' bytes · ' + text(payload.source.lineCount) + ' lines';
    const pre = document.createElement('pre'); pre.className = 'wb-source'; pre.setAttribute('aria-label', 'Source preview for ' + text(payload.source.filePath)); pre.textContent = text(payload.source.content);
    sourceItem.append(sourceLabel, sourceMeta, pre); items.appendChild(sourceItem);
    subtitle.textContent = 'Task-bound Evidence and guarded Source preview.';
    setStatus('Evidence ready', 'ready');
  };
  const loadEvidence = async (evidenceId, button) => {
    activeEvidenceId = text(evidenceId);
    nav.forEach((item) => item.setAttribute('aria-current', 'false'));
    surfaces.forEach((item) => item.setAttribute('aria-current', item === button ? 'page' : 'false'));
    title.textContent = 'Evidence / Source'; subtitle.textContent = 'Loading task evidence…'; banner.hidden = true;
    setStatus('Loading Evidence', 'loading'); setState('Loading Evidence', 'Reading the guarded source projection…');
    const next = new URL(location.href); next.searchParams.set('evidenceId', activeEvidenceId); history.replaceState(null, '', next.pathname + next.search);
    if (view !== 'tasks' || !taskId || !activeEvidenceId) { setStatus('Unavailable', 'error'); setState('Evidence unavailable', 'Open a Task reading path with a published evidence identifier.'); return; }
    try {
      const params = new URLSearchParams({ taskId, evidenceId: activeEvidenceId });
      const response = await fetch('/__workbench/evidence?' + params.toString(), { credentials: 'same-origin', headers: { accept: 'application/json' } });
      if (response.status === 401) { setStatus('Session expired', 'error'); setState('Session required', 'Reload the Workbench launch link to establish a new local session.'); return; }
      if (response.status === 409) { setStatus('Invalid evidence route', 'error'); setState('Evidence route rejected', 'The evidence identifier is not valid for this Task session.'); return; }
      if (!response.ok) throw new Error('request_failed');
      renderEvidence(await response.json());
    } catch { setStatus('Error', 'error'); setState('Evidence error', 'Retry the evidence request or relaunch the local Workbench.'); }
  };
  const setSurfaceBadge = (button, value) => { const badge = button.querySelector('.wb-unavailable'); if (badge) badge.textContent = value; };
  const loadSurface = async (surface, button) => {
    if (surface === 'evidence') { await loadEvidence(activeEvidenceId, button); return; }
    const label = surface === 'graph' ? 'Graph' : surface === 'trace' ? 'Trace' : 'Knowledge';
    title.textContent = label;
    subtitle.textContent = 'Task-bound published context is read-only.';
    banner.hidden = true;
    surfaces.forEach((item) => setSurfaceBadge(item, item === button ? 'loading' : 'unavailable'));
    setStatus('Loading ' + label, 'loading'); setState('Loading ' + label, 'Reading the published projection…');
    if (view !== 'tasks' || !taskId) { surfaces.forEach((item) => setSurfaceBadge(item, 'unavailable')); setStatus('Unavailable', 'error'); setState(label + ' unavailable', 'Open a Task deep link to load Task-bound context.'); return; }
    try {
      const params = new URLSearchParams({ surface, taskId });
      const endpoint = surface === 'trace' ? '/__workbench/trace?' : '/__workbench/context?';
      const response = await fetch(endpoint + params.toString(), { credentials: 'same-origin', headers: { accept: 'application/json' } });
      if (response.status === 401) { setSurfaceBadge(button, 'error'); setStatus('Session expired', 'error'); setState('Session required', 'Reload the Workbench launch link to establish a new local session.'); return; }
      if (response.status === 409) { setSurfaceBadge(button, 'stale'); setStatus('Stale route', 'stale'); setState('Route no longer matches', 'This context request is not bound to the current Task.'); return; }
      if (!response.ok) throw new Error('request_failed');
      const payload = await response.json();
      if (surface === 'trace') {
        renderTrace(payload);
        setSurfaceBadge(button, payload.status === 'stale' ? 'stale' : payload.status === 'ready' || payload.status === 'empty' ? 'ready' : 'unavailable');
      } else {
        renderContext(payload, label);
        if (payload.status === 'ready') { setStatus(label + ' ready', 'ready'); setSurfaceBadge(button, 'ready'); }
        else { setStatus(label + ' unavailable', 'error'); setSurfaceBadge(button, 'unavailable'); }
      }
    } catch { setStatus('Error', 'error'); setSurfaceBadge(button, 'error'); setState(label + ' error', 'Retry the context request or relaunch the local Workbench.'); }
  };
  const load = async (requested) => {
    activeEvidenceId = '';
    clearActions();
    surfaces.forEach((item) => item.setAttribute('aria-current', 'false'));
    const section = aliases[requested] || requested;
    nav.forEach((button) => button.setAttribute('aria-current', button.dataset.section === section ? 'page' : 'false'));
    title.textContent = sections.find(([key]) => key === section)?.[1] || 'Task Brief';
    banner.hidden = true;
    if (view !== 'tasks' || !taskId) { setStatus('Unavailable', 'error'); setState('Task view unavailable', 'Open a Task deep link to load persisted Task Brief data.'); return; }
    setStatus('Loading', 'loading'); setState('Loading Task Brief', 'Reading the persisted section…');
    try {
      const params = new URLSearchParams({ section });
      const response = await fetch('/__workbench/task-brief?' + params.toString(), { credentials: 'same-origin', headers: { accept: 'application/json' } });
      if (response.status === 401) { setStatus('Session expired', 'error'); setState('Session required', 'Reload the Workbench launch link to establish a new local session.'); return; }
      if (response.status === 404) { setStatus('Unavailable', 'error'); setState('Task Brief unavailable', 'This Task or its persisted Brief could not be found.'); return; }
      if (response.status === 409) { setStatus('Stale route', 'stale'); setState('Route no longer matches', 'The requested section is not available for this Workbench session.'); return; }
      if (!response.ok) throw new Error('request_failed');
      const payload = await response.json();
      renderItems(payload.result);
      const freshness = payload.freshness || 'fresh';
      if (freshness === 'stale' || freshness === 'partial' || freshness === 'rebuilding') { banner.hidden = false; banner.textContent = 'This view is backed by a ' + freshness + ' repository snapshot.'; setStatus('Task ' + text(payload.result.task.status) + ' · stale', 'stale'); } else setStatus('Task ' + text(payload.result.task.status), 'ready');
      subtitle.textContent = 'Section data is read from the persisted Task; this view is read-only.';
      const next = new URL(location.href); next.searchParams.set('section', section); history.replaceState(null, '', next.pathname + next.search);
    } catch { setStatus('Error', 'error'); setState('Unable to load', 'Retry the section or relaunch the local Workbench.'); }
  };
  nav.forEach((button) => button.addEventListener('click', () => { const next = new URL(location.href); next.searchParams.delete('evidenceId'); history.replaceState(null, '', next.pathname + next.search); void load(button.dataset.section || 'summary'); }));
  surfaces.forEach((button) => button.addEventListener('click', () => {
    nav.forEach((item) => item.setAttribute('aria-current', 'false'));
    surfaces.forEach((item) => item.setAttribute('aria-current', item === button ? 'page' : 'false'));
    void loadSurface(button.dataset.surface || 'knowledge', button);
  }));
  if (activeEvidenceId) {
    const evidenceButton = surfaces.find((item) => item.dataset.surface === 'evidence');
    void loadEvidence(activeEvidenceId, evidenceButton);
  } else {
    void load(initialSection);
  }
})();`;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function workbenchHtml(route: WorkbenchRouteV1, identity: WorkbenchSessionV1["identity"]): string {
  const taskId = route.taskId ?? "";
  const section = route.section ?? "summary";
  const taskTitle = taskId === "" ? "Task-first view" : `Task ${taskId}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(taskTitle)} · Workbench</title><link rel="stylesheet" href="/__workbench/app.css"></head><body data-view="${escapeHtml(route.view)}" data-task-id="${escapeHtml(taskId)}" data-section="${escapeHtml(section)}" data-evidence-id="${escapeHtml(route.evidenceId ?? "")}"><div class="wb-shell"><header class="wb-header"><div class="wb-brand"><div class="wb-kicker">Understand Code · Workbench</div><h1 class="wb-title">${escapeHtml(taskTitle)}</h1></div><div id="wb-status" class="wb-status" data-state="loading"><span class="wb-status-dot" aria-hidden="true"></span><span class="wb-status-label">Loading</span><span aria-hidden="true">·</span><span>${escapeHtml(identity.worktreeId)}</span></div></header><div class="wb-layout"><aside class="wb-sidebar"><nav class="wb-nav" aria-label="Task sections"><div class="wb-nav-title">Task Brief</div><button type="button" data-section="summary" aria-current="false">Summary</button><button type="button" data-section="goals" aria-current="false">Goals</button><button type="button" data-section="reading_path" aria-current="false">Reading</button><button type="button" data-section="planned_changes" aria-current="false">Changes</button><button type="button" data-section="verification_plan" aria-current="false">Verification</button></nav><nav class="wb-surfaces" aria-label="Workbench surfaces"><button type="button" class="wb-surface" data-surface="knowledge" aria-current="false">Knowledge <span class="wb-unavailable">unavailable</span></button><button type="button" class="wb-surface" data-surface="graph" aria-current="false">Graph <span class="wb-unavailable">unavailable</span></button><button type="button" class="wb-surface" data-surface="evidence" aria-current="false">Evidence / Source <span class="wb-unavailable">unavailable</span></button><button type="button" class="wb-surface" data-surface="trace" aria-current="false">Trace <span class="wb-unavailable">unavailable</span></button></nav></aside><main class="wb-main"><section class="uc-panel wb-panel" aria-live="polite"><div class="wb-panel-head"><div><h2 id="wb-panel-title" class="wb-panel-title">Task Brief</h2><p id="wb-panel-subtitle" class="wb-panel-subtitle">Loading persisted Task data…</p></div></div><div id="wb-actions" class="wb-actions" hidden></div><div id="wb-banner" class="wb-banner" hidden></div><div id="wb-state" class="wb-state"><div><strong>Loading Task Brief</strong><p>Reading the persisted section…</p></div></div><ul id="wb-items" class="wb-items" hidden></ul><noscript><div class="wb-state"><strong>JavaScript is required</strong><p>Enable JavaScript to read the local Task Brief.</p></div></noscript></section></main></div></div><script src="/__workbench/app.js" defer></script></body></html>`;
}

function routeFromQuery(query: URLSearchParams): WorkbenchRouteV1 | undefined {
  const candidate: Record<string, string> = {};
  for (const key of ["view", "taskId", "section", "findingId", "evidenceId", "impactPathId", "focus"] as const) {
    const value = query.get(key);
    if (value !== null) candidate[key] = value;
  }
  const parsed = WorkbenchRouteV1Schema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

const TASK_BRIEF_SECTION_ALIASES: Readonly<Record<string, TaskBriefSectionV1>> = {
  summary: "summary",
  goals: "goals",
  reading: "reading_path",
  reading_path: "reading_path",
  changes: "planned_changes",
  planned_changes: "planned_changes",
  verification: "verification_plan",
  verification_plan: "verification_plan",
};

function normalizeTaskBriefSection(value: string | undefined): TaskBriefSectionV1 | undefined {
  if (value === undefined) return "summary";
  const aliased = TASK_BRIEF_SECTION_ALIASES[value];
  if (aliased !== undefined) return aliased;
  const parsed = TaskBriefSectionV1Schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function routeCompatible(requested: WorkbenchRouteV1, granted: WorkbenchRouteV1): boolean {
  // Section navigation is intentionally allowed to move within the same Task;
  // an Evidence id selected from the Task reading path is also allowed to be
  // persisted in the browser URL.  The actual Evidence reader still resolves
  // the id against the authenticated Task bundle, so this does not authorize
  // an arbitrary repository path or cross-Task object. Other deep-link targets
  // remain capability-bound to the launch grant.
  const taskEvidenceRoute =
    granted.evidenceId === undefined &&
    requested.evidenceId !== undefined &&
    requested.findingId === undefined &&
    requested.impactPathId === undefined;
  return requested.view === granted.view &&
    requested.taskId === granted.taskId &&
    requested.findingId === granted.findingId &&
    (requested.evidenceId === granted.evidenceId || taskEvidenceRoute) &&
    requested.impactPathId === granted.impactPathId &&
    requested.focus === granted.focus;
}

async function readTaskBriefForSession(
  stored: StoredSessionV1,
  sessionToken: string,
  input: GetTaskBriefInputV1,
): Promise<WorkbenchTaskBriefPageV1> {
  const browser = getBrowserSession(stored.session, sessionToken, stored.now);
  if (browser.route.view !== "tasks" || browser.route.taskId === undefined) {
    throw new WorkbenchSessionError("session_invalid", "Task Brief requires a Task route");
  }
  if (input.taskId !== browser.route.taskId) {
    throw new WorkbenchSessionError("session_invalid", "Task Brief route does not belong to this session");
  }
  const reader = stored.taskBriefReader;
  if (reader === undefined) {
    throw new WorkbenchSessionError("server_error", "Task Brief reader is unavailable");
  }
  let page: WorkbenchTaskBriefPageV1 | undefined;
  try {
    const read = await reader(input);
    if (read !== undefined && "result" in read && "total" in read) {
      page = read;
    } else if (read !== undefined) {
      page = { result: read, total: read.items.length };
    }
  } catch {
    // Do not expose Task Engine or filesystem error details through this local
    // capability endpoint. The caller only learns that the Task Brief is not
    // currently available.
    throw new WorkbenchSessionError("server_error", "Task Brief is unavailable");
  }
  if (page === undefined) {
    throw new WorkbenchSessionError("server_error", "Task Brief is unavailable");
  }
  const parsedResult = GetTaskBriefResultV1Schema.safeParse(page.result);
  if (!parsedResult.success ||
      parsedResult.data.task.taskId !== browser.route.taskId ||
      parsedResult.data.section !== input.section ||
      parsedResult.data.task.repositoryId !== browser.binding.repositoryId ||
      parsedResult.data.task.worktreeId !== browser.binding.worktreeId ||
      parsedResult.data.task.latestSnapshotId !== browser.binding.sourceSnapshotId) {
    throw new WorkbenchSessionError("session_invalid", "Task Brief identity does not match this session");
  }
  if (!Number.isInteger(page.total) || page.total < 0) {
    throw new WorkbenchSessionError("session_invalid", "Task Brief page metadata is invalid");
  }
  if (page.nextCursor !== undefined && !CursorV1Schema.safeParse(page.nextCursor).success) {
    throw new WorkbenchSessionError("session_invalid", "Task Brief cursor is invalid");
  }
  return {
    result: parsedResult.data,
    total: page.total,
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
  };
}

async function readWorkbenchContextForSession(
  stored: StoredSessionV1,
  sessionToken: string,
  input: WorkbenchContextRequestV1,
): Promise<WorkbenchContextResultV1> {
  const browser = getBrowserSession(stored.session, sessionToken, stored.now);
  if (browser.route.view !== "tasks" || browser.route.taskId === undefined) {
    throw new WorkbenchSessionError("session_invalid", "context requires a Task route");
  }
  if (
    input.taskId !== browser.route.taskId ||
    input.repositoryId !== browser.binding.repositoryId ||
    input.worktreeId !== browser.binding.worktreeId
  ) {
    throw new WorkbenchSessionError("session_invalid", "context route does not belong to this session");
  }
  const reader = input.surface === "graph" ? stored.graphReader : stored.knowledgeReader;
  if (reader === undefined) return unavailableContext(input, "not_published");
  let value: WorkbenchContextResultV1 | undefined;
  try {
    value = await reader(input);
  } catch {
    throw new WorkbenchSessionError("server_error", "context projection is unavailable");
  }
  return parseContextResult(value, input);
}

const TRACE_FINDING_TYPES = new Set([
  "planned_completed",
  "planned_partial",
  "unplanned_change",
  "possible_omission",
  "verification_gap",
  "cannot_determine",
]);
const TRACE_SEVERITIES = new Set(["info", "warning", "error", "critical"]);
const TRACE_RESOLUTIONS = new Set(["unresolved", "fixed", "accepted"]);
const TRACE_METHODS = new Set(["test", "build", "lint", "manual", "runtime"]);
const TRACE_STATUSES = new Set(["passed", "failed", "skipped", "blocked", "flaky"]);

function isBoundedString(value: unknown, max = 512): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

function isBoundedIdentifier(value: unknown): value is string {
  return isBoundedString(value, 512);
}

function isSafeTimestamp(value: unknown): value is string {
  return typeof value === "string" && IsoTimestampSchema.safeParse(value).success;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = new Set(keys);
  return Object.keys(value).every((key) => expected.has(key));
}

function parseTraceFinding(value: unknown): WorkbenchTraceFindingV1 | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ["id", "type", "severity", "blocking", "resolution"])) {
    return undefined;
  }
  if (
    !isBoundedIdentifier(value.id) ||
    typeof value.type !== "string" || !TRACE_FINDING_TYPES.has(value.type) ||
    typeof value.severity !== "string" || !TRACE_SEVERITIES.has(value.severity) ||
    typeof value.blocking !== "boolean" ||
    typeof value.resolution !== "string" || !TRACE_RESOLUTIONS.has(value.resolution)
  ) {
    return undefined;
  }
  return value as unknown as WorkbenchTraceFindingV1;
}

function parseTraceChangeCheck(value: unknown): WorkbenchTraceChangeCheckV1 | undefined {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "sourceArtifactId",
      "id",
      "taskId",
      "taskRevision",
      "baselineSnapshotId",
      "actualSnapshotId",
      "generatedAt",
      "findings",
      "counts",
    ]) ||
    !isBoundedIdentifier(value.sourceArtifactId) ||
    !isBoundedIdentifier(value.id) ||
    !isBoundedIdentifier(value.taskId) ||
    !Number.isSafeInteger(value.taskRevision) || (value.taskRevision as number) < 1 ||
    !isBoundedIdentifier(value.baselineSnapshotId) ||
    !isBoundedIdentifier(value.actualSnapshotId) ||
    !isSafeTimestamp(value.generatedAt) ||
    !Array.isArray(value.findings) ||
    !isRecord(value.counts) ||
    !hasOnlyKeys(value.counts, ["total", "blocking", "openBlocking"]) ||
    !isNonNegativeInteger(value.counts.total) ||
    !isNonNegativeInteger(value.counts.blocking) ||
    !isNonNegativeInteger(value.counts.openBlocking)
  ) {
    return undefined;
  }
  const findings = value.findings.map(parseTraceFinding);
  if (findings.some((finding) => finding === undefined)) return undefined;
  if (
    value.counts.total !== findings.length ||
    value.counts.blocking !== findings.filter((finding) => finding!.blocking).length ||
    value.counts.openBlocking !== findings.filter((finding) => finding!.blocking && finding!.resolution === "unresolved").length
  ) {
    return undefined;
  }
  return {
    ...(value as unknown as WorkbenchTraceChangeCheckV1),
    findings: findings as WorkbenchTraceFindingV1[],
  };
}

function parseTraceVerificationRecord(
  value: unknown,
): WorkbenchTraceVerificationRecordV1 | undefined {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "sourceArtifactId",
      "sourceRecordId",
      "taskId",
      "verificationPlanEntryId",
      "attempt",
      "supersedesVerificationRecordId",
      "method",
      "status",
      "claimIds",
      "snapshotId",
      "recordedAt",
      "detailStatus",
      "disposition",
    ]) ||
    !isBoundedIdentifier(value.sourceArtifactId) ||
    !isBoundedIdentifier(value.sourceRecordId) ||
    !isBoundedIdentifier(value.taskId) ||
    !isBoundedIdentifier(value.verificationPlanEntryId) ||
    !Number.isSafeInteger(value.attempt) || (value.attempt as number) < 1 ||
    (value.supersedesVerificationRecordId !== undefined && !isBoundedIdentifier(value.supersedesVerificationRecordId)) ||
    typeof value.method !== "string" || !TRACE_METHODS.has(value.method) ||
    typeof value.status !== "string" || !TRACE_STATUSES.has(value.status) ||
    !Array.isArray(value.claimIds) || value.claimIds.some((id) => !isBoundedIdentifier(id)) ||
    !isBoundedIdentifier(value.snapshotId) ||
    !isSafeTimestamp(value.recordedAt) ||
    value.detailStatus !== "legacy_redacted" ||
    value.disposition !== "externally_reported"
  ) {
    return undefined;
  }
  return value as unknown as WorkbenchTraceVerificationRecordV1;
}

function parseTraceResult(
  value: unknown,
  input: WorkbenchTraceRequestV1,
): WorkbenchTraceResultV1 {
  if (value === undefined) {
    return {
      schemaVersion: 1,
      surface: "trace",
      taskId: input.taskId,
      repositoryId: input.repositoryId,
      worktreeId: input.worktreeId,
      snapshotId: input.snapshotId,
      status: "unavailable",
      reason: "not_published",
      verification: {
        disposition: "externally_reported",
        records: [],
        requiredCount: 0,
        passedCount: 0,
        failedCount: 0,
        pendingCount: 0,
      },
    };
  }
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "schemaVersion",
      "surface",
      "taskId",
      "repositoryId",
      "worktreeId",
      "snapshotId",
      "status",
      "reason",
      "observedSnapshotId",
      "changeCheck",
      "verification",
    ]) ||
    value.schemaVersion !== 1 ||
    value.surface !== "trace" ||
    value.taskId !== input.taskId ||
    value.repositoryId !== input.repositoryId ||
    value.worktreeId !== input.worktreeId ||
    value.snapshotId !== input.snapshotId ||
    typeof value.status !== "string" ||
    !new Set(["ready", "empty", "stale", "unavailable"]).has(value.status) ||
    !isRecord(value.verification) ||
    !hasOnlyKeys(value.verification, [
      "disposition",
      "records",
      "requiredCount",
      "passedCount",
      "failedCount",
      "pendingCount",
    ]) ||
    value.verification.disposition !== "externally_reported" ||
    !Array.isArray(value.verification.records) ||
    !isNonNegativeInteger(value.verification.requiredCount) ||
    !isNonNegativeInteger(value.verification.passedCount) ||
    !isNonNegativeInteger(value.verification.failedCount) ||
    !isNonNegativeInteger(value.verification.pendingCount)
  ) {
    throw new WorkbenchSessionError("session_invalid", "trace projection is invalid");
  }
  const status = value.status as WorkbenchTraceStatusV1;
  const reason = value.reason;
  if (
    status === "unavailable" &&
    (reason !== "not_published" && reason !== "invalid_projection" && reason !== "read_failed")
  ) {
    throw new WorkbenchSessionError("session_invalid", "trace unavailable reason is invalid");
  }
  if (status !== "unavailable" && reason !== undefined) {
    throw new WorkbenchSessionError("session_invalid", "trace reason is invalid");
  }
  if (status === "stale" &&
      (!isBoundedIdentifier(value.observedSnapshotId) || value.observedSnapshotId === input.snapshotId)) {
    throw new WorkbenchSessionError("session_invalid", "stale trace snapshot is invalid");
  }
  if (status !== "stale" && value.observedSnapshotId !== undefined) {
    throw new WorkbenchSessionError("session_invalid", "trace observed snapshot is invalid");
  }
  const records = value.verification.records.map(parseTraceVerificationRecord);
  if (records.some((record) => record === undefined)) {
    throw new WorkbenchSessionError("session_invalid", "verification trace record is invalid");
  }
  const check = value.changeCheck === undefined ? undefined : parseTraceChangeCheck(value.changeCheck);
  if (value.changeCheck !== undefined && check === undefined) {
    throw new WorkbenchSessionError("session_invalid", "change check trace is invalid");
  }
  if (status === "empty" && (check !== undefined || records.length > 0)) {
    throw new WorkbenchSessionError("session_invalid", "empty trace cannot contain records");
  }
  if (status === "stale" && (check !== undefined || records.length > 0)) {
    throw new WorkbenchSessionError("session_invalid", "stale trace cannot expose foreign snapshot records");
  }
  if (check !== undefined) {
    if (
      check.taskId !== input.taskId ||
      check.actualSnapshotId !== input.snapshotId ||
      check.baselineSnapshotId.length === 0
    ) {
      throw new WorkbenchSessionError("session_invalid", "change check identity does not match trace snapshot");
    }
  }
  for (const record of records) {
    if (record!.taskId !== input.taskId || record!.snapshotId !== input.snapshotId) {
      throw new WorkbenchSessionError("session_invalid", "verification identity does not match trace snapshot");
    }
  }
  if (
    value.verification.passedCount > records.length ||
    value.verification.failedCount > records.length ||
    value.verification.pendingCount > value.verification.requiredCount ||
    value.verification.passedCount + value.verification.failedCount > records.length
  ) {
    throw new WorkbenchSessionError("session_invalid", "verification trace counts are invalid");
  }
  return {
    ...(value as unknown as WorkbenchTraceResultV1),
    ...(check === undefined ? {} : { changeCheck: check }),
    verification: {
      disposition: "externally_reported",
      records: records as WorkbenchTraceVerificationRecordV1[],
      requiredCount: value.verification.requiredCount,
      passedCount: value.verification.passedCount,
      failedCount: value.verification.failedCount,
      pendingCount: value.verification.pendingCount,
    },
  };
}

async function readWorkbenchTraceForSession(
  stored: StoredSessionV1,
  sessionToken: string,
  input: WorkbenchTraceRequestV1,
): Promise<WorkbenchTraceResultV1> {
  const browser = getBrowserSession(stored.session, sessionToken, stored.now);
  if (browser.route.view !== "tasks" || browser.route.taskId === undefined) {
    throw new WorkbenchSessionError("session_invalid", "trace requires a Task route");
  }
  if (
    input.surface !== "trace" ||
    input.taskId !== browser.route.taskId ||
    input.repositoryId !== browser.binding.repositoryId ||
    input.worktreeId !== browser.binding.worktreeId ||
    input.snapshotId !== browser.binding.sourceSnapshotId
  ) {
    throw new WorkbenchSessionError("session_invalid", "trace route does not belong to this session");
  }
  const reader = stored.traceReader;
  if (reader === undefined) return parseTraceResult(undefined, input);
  let value: WorkbenchTraceResultV1 | undefined;
  try {
    value = await reader(input);
  } catch {
    throw new WorkbenchSessionError("server_error", "trace projection is unavailable");
  }
  return parseTraceResult(value, input);
}

async function readWorkbenchEvidenceForSession(
  stored: StoredSessionV1,
  sessionToken: string,
  input: WorkbenchEvidenceRequestV1,
): Promise<WorkbenchEvidenceResultV1> {
  const browser = getBrowserSession(stored.session, sessionToken, stored.now);
  if (browser.route.view !== "tasks" || browser.route.taskId === undefined) {
    throw new WorkbenchSessionError("session_invalid", "evidence requires a Task route");
  }
  if (
    input.taskId !== browser.route.taskId ||
    input.repositoryId !== browser.binding.repositoryId ||
    input.worktreeId !== browser.binding.worktreeId ||
    input.snapshotId !== browser.binding.sourceSnapshotId ||
    input.headCommit !== browser.binding.headCommit
  ) {
    throw new WorkbenchSessionError("session_invalid", "evidence route does not belong to this session");
  }
  const reader = stored.evidenceReader;
  if (reader === undefined) return parseEvidenceResult(undefined, input);
  let value: WorkbenchEvidenceResultV1 | undefined;
  try {
    value = await reader(input);
  } catch {
    throw new WorkbenchSessionError("server_error", "evidence projection is unavailable");
  }
  return parseEvidenceResult(value, input);
}

function createHttpHandler(stored: StoredSessionV1): (request: IncomingMessage, response: ServerResponse) => void {
  return (request, response) => {
    if (request.method !== "GET") {
      if (request.method !== "POST") response.setHeader("allow", "GET, POST");
      if (request.method === "POST") {
        let parsedUrl: URL;
        try { parsedUrl = new URL(request.url ?? "/", `http://${LOOPBACK_HOST}`); } catch { writeJson(response, 400, { error: "invalid_request" }); return; }
        if (parsedUrl.pathname === "/__workbench/launch") {
          let body = "";
          request.setEncoding("utf8");
          request.on("data", (chunk) => { body += chunk; });
          request.on("end", () => {
            try {
              const token = JSON.parse(body).token;
              const grant = stored.session.redeemLaunchToken(token);
              writeJson(response, 200, grant, { "set-cookie": `workbench_session=${encodeURIComponent(grant.sessionToken)}; HttpOnly; SameSite=Strict; Path=/` });
            } catch { writeJson(response, 401, { error: "launch_token_invalid" }); }
          });
          return;
        }
      }
      writeJson(response, 405, { error: "method_not_allowed" });
      return;
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(request.url ?? "/", `http://${LOOPBACK_HOST}`);
    } catch {
      writeJson(response, 400, { error: "invalid_request" });
      return;
    }

    if (parsedUrl.pathname === "/healthz") {
      writeJson(response, 200, {
        ok: true,
        runtime: stored.session.identity,
        port: stored.session.port,
      });
      return;
    }

    if (parsedUrl.pathname === "/__workbench/bootstrap.js") {
      response.writeHead(200, {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy": WORKBENCH_CSP,
        "x-content-type-options": "nosniff",
      });
      response.end(BOOTSTRAP_SCRIPT);
      return;
    }

    if (parsedUrl.pathname === "/__workbench/app.css") {
      response.writeHead(200, {
        "content-type": "text/css; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy": WORKBENCH_CSP,
        "x-content-type-options": "nosniff",
      });
      response.end(WORKBENCH_CSS);
      return;
    }

    if (parsedUrl.pathname === "/__workbench/app.js") {
      response.writeHead(200, {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy": WORKBENCH_CSP,
        "x-content-type-options": "nosniff",
      });
      response.end(WORKBENCH_APP_SCRIPT);
      return;
    }

    if (parsedUrl.pathname === "/workbench" && readCookie(request, "workbench_session") === undefined) {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy": WORKBENCH_CSP,
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
      });
      response.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Workbench launch</title></head><body><p>Establishing the local Workbench session…</p><script src="/__workbench/bootstrap.js" defer></script></body></html>');
      return;
    }

    const sessionToken = readCookie(request, "workbench_session");
    if (sessionToken === undefined) {
      unauthorized(response);
      return;
    }
    if (parsedUrl.pathname === "/workbench") {
      try {
        const grant = getBrowserSession(stored.session, sessionToken, stored.now);
        const requested = routeFromQuery(parsedUrl.searchParams);
        if (requested !== undefined && !routeCompatible(requested, grant.route)) {
          writeJson(response, 409, { error: "route_mismatch" });
          return;
        }
        if (request.headers.accept?.includes("application/json") === true) {
          writeJson(response, 200, { route: requested ?? grant.route, runtime: grant.identity });
          return;
        }
        response.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "content-security-policy": WORKBENCH_CSP,
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer",
        });
        response.end(workbenchHtml(requested ?? grant.route, grant.identity));
      } catch {
        unauthorized(response);
      }
      return;
    }

    if (parsedUrl.pathname === "/__workbench/task-brief") {
      const browser = (() => {
        try { return getBrowserSession(stored.session, sessionToken, stored.now); } catch { return undefined; }
      })();
      if (browser === undefined) {
        unauthorized(response);
        return;
      }
      if (browser.route.view !== "tasks" || browser.route.taskId === undefined) {
        writeJson(response, 409, { error: "task_route_required" });
        return;
      }
      const requestedTaskId = parsedUrl.searchParams.get("taskId");
      if (requestedTaskId !== null && requestedTaskId !== browser.route.taskId) {
        writeJson(response, 409, { error: "task_route_mismatch" });
        return;
      }
      const section = normalizeTaskBriefSection(parsedUrl.searchParams.get("section") ?? browser.route.section);
      if (section === undefined) {
        writeJson(response, 409, { error: "section_invalid" });
        return;
      }
      const cursorValue = parsedUrl.searchParams.get("cursor") ?? undefined;
      const parsedInput = GetTaskBriefInputV1Schema.safeParse({
        taskId: browser.route.taskId,
        section,
        ...(cursorValue === undefined ? {} : { cursor: cursorValue }),
      });
      if (!parsedInput.success) {
        writeJson(response, 409, { error: "cursor_invalid" });
        return;
      }
      void readTaskBriefForSession(stored, sessionToken, parsedInput.data)
        .then((page) => {
          writeJson(response, 200, {
            result: page.result,
            page: {
              pageSize: page.result.items.length,
              returned: page.result.items.length,
              total: page.total,
              hasMore: page.nextCursor !== undefined,
              ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
            },
            freshness: browser.binding.freshness,
          });
        })
        .catch((error: unknown) => {
          if (error instanceof WorkbenchSessionError && error.code === "session_invalid") {
            writeJson(response, 409, { error: "task_brief_route_mismatch" });
            return;
          }
          // Reader failures are deliberately indistinguishable from a missing
          // persisted Brief to avoid turning this endpoint into an oracle.
          writeJson(response, 404, { error: "task_brief_not_found" });
        });
      return;
    }

    if (parsedUrl.pathname === "/__workbench/context") {
      const browser = (() => {
        try { return getBrowserSession(stored.session, sessionToken, stored.now); } catch { return undefined; }
      })();
      if (browser === undefined) {
        unauthorized(response);
        return;
      }
      if (browser.route.view !== "tasks" || browser.route.taskId === undefined) {
        writeJson(response, 409, { error: "task_route_required" });
        return;
      }
      const requestedTaskId = parsedUrl.searchParams.get("taskId");
      if (requestedTaskId !== null && requestedTaskId !== browser.route.taskId) {
        writeJson(response, 409, { error: "task_route_mismatch" });
        return;
      }
      const surfaceValue = parsedUrl.searchParams.get("surface");
      if (!isContextSurface(surfaceValue)) {
        writeJson(response, 409, { error: "context_surface_invalid" });
        return;
      }
      const input: WorkbenchContextRequestV1 = {
        surface: surfaceValue,
        taskId: browser.route.taskId,
        repositoryId: browser.binding.repositoryId,
        worktreeId: browser.binding.worktreeId,
      };
      void readWorkbenchContextForSession(stored, sessionToken, input)
        .then((result) => writeJson(response, 200, result))
        .catch((error: unknown) => {
          if (error instanceof WorkbenchSessionError && error.code === "session_invalid") {
            writeJson(response, 409, { error: "context_route_mismatch" });
            return;
          }
          writeJson(response, 500, { error: "context_unavailable" });
        });
      return;
    }

    if (parsedUrl.pathname === "/__workbench/evidence") {
      const browser = (() => {
        try { return getBrowserSession(stored.session, sessionToken, stored.now); } catch { return undefined; }
      })();
      if (browser === undefined) {
        unauthorized(response);
        return;
      }
      if (browser.route.view !== "tasks" || browser.route.taskId === undefined) {
        writeJson(response, 409, { error: "task_route_required" });
        return;
      }
      // The browser may submit exactly two public identifiers. Repository,
      // snapshot, head and root values are session-bound and never accepted
      // from query parameters.
      const allowed = new Set(["taskId", "evidenceId"]);
      let queryShapeValid = true;
      for (const [key] of parsedUrl.searchParams) {
        if (!allowed.has(key) || parsedUrl.searchParams.getAll(key).length !== 1) {
          queryShapeValid = false;
          break;
        }
      }
      const requestedTaskId = parsedUrl.searchParams.get("taskId");
      const requestedEvidenceId = parsedUrl.searchParams.get("evidenceId");
      const parsedTaskId = requestedTaskId === null ? undefined : TaskIdSchema.safeParse(requestedTaskId);
      const parsedEvidenceId = requestedEvidenceId === null ? undefined : EvidenceIdSchema.safeParse(requestedEvidenceId);
      if (!queryShapeValid || requestedTaskId === null || requestedEvidenceId === null ||
          parsedTaskId?.success !== true || parsedEvidenceId?.success !== true) {
        writeJson(response, 409, { error: "evidence_input_invalid" });
        return;
      }
      if (parsedTaskId.data !== browser.route.taskId) {
        writeJson(response, 409, { error: "evidence_route_mismatch" });
        return;
      }
      const input: WorkbenchEvidenceRequestV1 = {
        taskId: parsedTaskId.data,
        evidenceId: parsedEvidenceId.data,
        repositoryId: browser.binding.repositoryId,
        worktreeId: browser.binding.worktreeId,
        snapshotId: browser.binding.sourceSnapshotId,
        headCommit: browser.binding.headCommit,
      };
      void readWorkbenchEvidenceForSession(stored, sessionToken, input)
        .then((result) => writeJson(response, 200, result))
        .catch((error: unknown) => {
          if (error instanceof WorkbenchSessionError && error.code === "session_invalid") {
            writeJson(response, 409, { error: "evidence_route_mismatch" });
            return;
          }
          if (error instanceof WorkbenchSessionError && error.code === "invalid_input") {
            writeJson(response, 409, { error: "evidence_input_invalid" });
            return;
          }
          writeJson(response, 500, { error: "evidence_unavailable" });
        });
      return;
    }

    if (parsedUrl.pathname === "/__workbench/trace") {
      const browser = (() => {
        try { return getBrowserSession(stored.session, sessionToken, stored.now); } catch { return undefined; }
      })();
      if (browser === undefined) {
        unauthorized(response);
        return;
      }
      if (browser.route.view !== "tasks" || browser.route.taskId === undefined) {
        writeJson(response, 409, { error: "task_route_required" });
        return;
      }
      const requestedTaskId = parsedUrl.searchParams.get("taskId");
      if (requestedTaskId !== null && requestedTaskId !== browser.route.taskId) {
        writeJson(response, 409, { error: "task_route_mismatch" });
        return;
      }
      const input: WorkbenchTraceRequestV1 = {
        surface: "trace",
        taskId: browser.route.taskId,
        repositoryId: browser.binding.repositoryId,
        worktreeId: browser.binding.worktreeId,
        snapshotId: browser.binding.sourceSnapshotId,
      };
      void readWorkbenchTraceForSession(stored, sessionToken, input)
        .then((result) => writeJson(response, 200, result))
        .catch((error: unknown) => {
          if (error instanceof WorkbenchSessionError && error.code === "session_invalid") {
            writeJson(response, 409, { error: "trace_route_mismatch" });
            return;
          }
          writeJson(response, 500, { error: "trace_unavailable" });
        });
      return;
    }

    const taskMatch = /^\/tasks\/([^/]+)$/u.exec(parsedUrl.pathname);
    if (taskMatch !== null) {
      try {
        const grant = getBrowserSession(stored.session, sessionToken, stored.now);
        const taskId = decodeURIComponent(taskMatch[1] ?? "");
        if (grant.route.view !== "tasks" || grant.route.taskId !== taskId) {
          writeJson(response, 404, { error: "task_route_not_found" });
          return;
        }
        writeJson(response, 200, { route: grant.route, runtime: grant.identity });
      } catch {
        unauthorized(response);
      }
      return;
    }
    writeJson(response, 404, { error: "not_found" });
  };
}

function getBrowserSession(
  session: WorkbenchSessionV1,
  token: string,
  now: () => number = Date.now,
): BrowserSessionV1 {
  const state = browserSessions.get(session);
  const browser = state?.get(token);
  if (browser === undefined) throw new WorkbenchSessionError("session_invalid");
  const current = now();
  if (current >= browser.expiresAtMs || current - browser.lastSeenAtMs >= SESSION_IDLE_TTL_MS) {
    state?.delete(token);
    throw new WorkbenchSessionError("session_expired");
  }
  browser.lastSeenAtMs = current;
  return browser;
}

const browserSessions = new WeakMap<WorkbenchSessionV1, Map<string, BrowserSessionV1>>();

function redeem(stored: StoredSessionV1, token: string, now: () => number): WorkbenchLaunchGrantV1 {
  assertSafeToken(token);
  const pending = stored.launches.get(token);
  if (pending === undefined) {
    throw new WorkbenchSessionError("launch_token_invalid", "unknown launch token");
  }
  const current = now();
  if (current >= pending.expiresAtMs) {
    pending.redeemed = true;
    stored.launches.delete(token);
    throw new WorkbenchSessionError("launch_token_expired", "launch token expired");
  }
  if (pending.redeemed) {
    throw new WorkbenchSessionError("launch_token_replayed", "launch token already redeemed");
  }
  pending.redeemed = true;
  stored.launches.delete(token);
  const sessionToken = randomToken();
  const sessionId = `wb-${randomUUID()}`;
  const identity = runtimeIdentity(pending.binding);
  const browser: BrowserSessionV1 = {
    sessionId,
    sessionToken,
    route: pending.route,
    identity,
    binding: pending.binding,
    issuedAtMs: current,
    lastSeenAtMs: current,
    expiresAtMs: current + SESSION_TTL_MS,
  };
  let sessions = browserSessions.get(stored.session);
  if (sessions === undefined) {
    sessions = new Map();
    browserSessions.set(stored.session, sessions);
  }
  sessions.set(sessionToken, browser);
  return {
    sessionId,
    sessionToken,
    route: pending.route,
    identity,
    issuedAt: timestamp(current),
    expiresAt: timestamp(browser.expiresAtMs),
  };
}

/**
 * Open (or reuse) a read-only local Workbench runtime. The function is kept
 * intentionally local to this package: it binds only an already-canonical
 * root and caller-supplied published metadata; it never executes commands or
 * opens a Task artifact writer.
 */
export async function openWorkbenchSessionV1(
  input: OpenWorkbenchInputV1,
  options: OpenWorkbenchSessionOptionsV1,
): Promise<WorkbenchSessionV1> {
  const parsedInput = OpenWorkbenchInputV1Schema.safeParse(input);
  if (!parsedInput.success) throw new WorkbenchSessionError("invalid_input", "invalid open_workbench input");
  validateBinding(options);
  const canonicalRoot = await canonicalizeRoot(options.canonicalRoot);
  const host = options.host ?? LOOPBACK_HOST;
  if (host !== LOOPBACK_HOST) throw new WorkbenchSessionError("server_error", "Workbench binds only to loopback");
  const requestedTtl = options.launchTokenTtlMs ?? DEFAULT_LAUNCH_TTL_MS;
  if (!Number.isInteger(requestedTtl) || requestedTtl <= 0 || requestedTtl > MAX_LAUNCH_TTL_MS) {
    throw new WorkbenchSessionError("invalid_input", "launch token TTL is invalid");
  }
  const now = options.now ?? Date.now;
  const key = identityKey(options, canonicalRoot);
  const currentBinding = launchBinding(options);
  const existing = sessionsByIdentity.get(key);
  if (existing !== undefined) {
    if (options.taskBriefReader !== undefined) {
      existing.taskBriefReader = options.taskBriefReader;
    }
    if (options.graphReader !== undefined) {
      existing.graphReader = options.graphReader;
    }
    if (options.knowledgeReader !== undefined) {
      existing.knowledgeReader = options.knowledgeReader;
    }
    if (options.traceReader !== undefined) {
      existing.traceReader = options.traceReader;
    }
    if (options.evidenceReader !== undefined) {
      existing.evidenceReader = options.evidenceReader;
    }
    const token = randomToken();
    const issuedAtMs = now();
    existing.launches.set(token, {
      token,
      route: parsedInput.data.route,
      binding: currentBinding,
      issuedAtMs,
      expiresAtMs: issuedAtMs + requestedTtl,
      redeemed: false,
    });
    const output = makeOutput(currentBinding, existing.session.port, parsedInput.data.route, token, "reused", issuedAtMs, issuedAtMs + requestedTtl);
    return { ...existing.session, output, redeemLaunchToken: (candidate) => redeem(existing, candidate, now) };
  }

  const launches = new Map<string, PendingLaunchV1>();
  const server = createServer();
  const provisional = {} as WorkbenchSessionV1;
  const stored = {
    session: provisional,
    launches,
    now,
    ...(options.taskBriefReader === undefined ? {} : { taskBriefReader: options.taskBriefReader }),
    ...(options.graphReader === undefined ? {} : { graphReader: options.graphReader }),
    ...(options.knowledgeReader === undefined ? {} : { knowledgeReader: options.knowledgeReader }),
    ...(options.traceReader === undefined ? {} : { traceReader: options.traceReader }),
    ...(options.evidenceReader === undefined ? {} : { evidenceReader: options.evidenceReader }),
  } as StoredSessionV1;
  const handler = createHttpHandler(stored);
  server.on("request", handler);
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(new WorkbenchSessionError("server_error", error.message));
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(options.port ?? 0, LOOPBACK_HOST);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new WorkbenchSessionError("server_error", "loopback server did not expose a port");
  }
  const port = address.port;
  const token = randomToken();
  const issuedAtMs = now();
  launches.set(token, {
    token,
    route: parsedInput.data.route,
    binding: currentBinding,
    issuedAtMs,
    expiresAtMs: issuedAtMs + requestedTtl,
    redeemed: false,
  });

  const identity = runtimeIdentity(currentBinding);
  const session: WorkbenchSessionV1 = {
    output: makeOutput(currentBinding, port, parsedInput.data.route, token, "started", issuedAtMs, issuedAtMs + requestedTtl),
    canonicalRoot,
    identity,
    port,
    server,
    redeemLaunchToken: (candidate) => redeem(stored, candidate, now),
    readTaskRoute: (sessionToken, taskId) => {
      const browser = getBrowserSession(session, sessionToken, now);
      if (browser.route.view !== "tasks" || browser.route.taskId !== taskId) {
        throw new WorkbenchSessionError("session_invalid", "task route does not belong to session");
      }
      return browser.route;
    },
    readTaskBrief: (sessionToken, input) => readTaskBriefForSession(stored, sessionToken, input),
    readWorkbenchContext: (sessionToken, input) =>
      readWorkbenchContextForSession(stored, sessionToken, input),
    readWorkbenchTrace: (sessionToken, input) =>
      readWorkbenchTraceForSession(stored, sessionToken, input),
    readWorkbenchEvidence: (sessionToken, input) =>
      readWorkbenchEvidenceForSession(stored, sessionToken, input),
    close: async () => {
      sessionsByIdentity.delete(key);
      launches.clear();
      browserSessions.delete(session);
      if (server.listening) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  };
  // The handler and redeem closure need the final session object, not the
  // provisional reference used while wiring the server listeners.
  (stored as { session: WorkbenchSessionV1 }).session = session;
  // Keep the exact object captured by the HTTP handler. Reuse updates its
  // readers in place, so the singleton never serves callbacks from a copied,
  // stale registry entry.
  sessionsByIdentity.set(key, stored);
  return session;
}

function makeOutput(
  options: WorkbenchLaunchBindingV1,
  port: number,
  route: WorkbenchRouteV1,
  token: string,
  disposition: "started" | "reused",
  issuedAtMs: number,
  expiresAtMs: number,
): OpenWorkbenchOutputV1 {
  const output = {
    content: [{ type: "text", text: "Workbench is ready." }],
    structuredContent: {
      schemaVersion: 1,
      meta: {
        repositoryId: options.repositoryId,
        worktreeId: options.worktreeId,
        sourceSnapshotId: options.sourceSnapshotId,
        headCommit: options.headCommit,
        worktreeFingerprint: options.worktreeFingerprint,
        freshness: options.freshness,
        durationMs: 0,
        cacheHit: disposition === "reused",
        truncated: false,
        truncatedCategories: [],
      },
      result: {
        route,
        deepLink: launchUrl(port, route, token),
        launchTokenExpiresAt: timestamp(expiresAtMs),
        runtime: {
          identity: {
            productVersion: options.productVersion,
            worktreeId: options.worktreeId,
          },
          disposition,
        },
      },
    },
  };
  return OpenWorkbenchOutputV1Schema.parse(output);
}

export const WORKBENCH_SESSION_DEFAULTS_V1 = Object.freeze({
  launchTokenTtlMs: DEFAULT_LAUNCH_TTL_MS,
  sessionTtlMs: SESSION_TTL_MS,
  sessionIdleTtlMs: SESSION_IDLE_TTL_MS,
  host: LOOPBACK_HOST,
});

/** Close every open runtime, primarily for process shutdown and test cleanup. */
export async function closeAllWorkbenchSessionsV1(): Promise<void> {
  const active = [...sessionsByIdentity.values()];
  await Promise.all(active.map(({ session }) => session.close()));
}
