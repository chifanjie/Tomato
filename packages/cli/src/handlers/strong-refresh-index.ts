import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { TextDecoder } from "node:util";

import {
  ArtifactStore,
  ArtifactStoreError,
  sha256CanonicalJson,
} from "@understand-code/artifact-store";
import {
  PathSafeRepositoryRelativePathV1Schema,
  RefreshIndexInputV1Schema,
  RefreshIndexOutputV1Schema,
  RepoPulseArtifactV1Schema,
  RepositoryBranchStateV1Schema,
  RepositorySnapshotArtifactV1Schema,
  StrongRepositorySnapshotV1Schema,
  canonicalizeJson,
  derivePathSafeRepositoryChangeIdV1,
  derivePathSafeRepositorySnapshotIdV1,
  parseTrustedRepositorySnapshotArtifactV1,
  parseTrustedStrongRepoPulseV1,
  parseTrustedStrongRepositorySnapshotV1,
  type RepoPulseArtifactV1,
  type RepositorySnapshotArtifactV1,
  type StrongRepoPulseV1,
  type StrongRepositorySnapshotV1,
} from "@understand-code/contracts";
import {
  isProviderProductionStrongObjectUnavailableErrorV1,
  openProviderProductionStrongObjectClientV1,
  type ProviderProductionOwnerCommitmentDomainV1,
  type ProviderProductionStrongCompareCommitV1Input,
  type ProviderProductionStrongObjectClientV1,
  type ProviderProductionStrongIndexPublicationAuthorityInputV1,
  type ProviderProductionStrongRefreshAuthorityInputV1,
  type ProviderProductionStrongRefreshAuthorityV1,
} from "@understand-code/durable-object-provider-client";
import {
  canonicalizeJcsSafeIntegerV1,
  parseCanonicalJcsSafeIntegerUtf8V1,
} from "@understand-code/durable-object-provider-contracts";
import {
  ProviderRuntimeIpcFixedObjectLocatorV1Schema,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  bootstrapSafeGitDescriptorBoundCandidateV1,
  createSafeGitLayeredContentReadSessionV1,
  getRepositorySnapshotDetailedWithSafeGitCapabilityV1,
  isSensitiveRepositoryPath,
  readSafeGitLayeredRepositoryChangeContentV1,
  readStableRepositoryFile,
  type RepositorySnapshotCapture,
  type SafeGitReadExecutorV1,
  type SafeGitRepositoryIdentityInspectionV1,
} from "@understand-code/repository-state";

import { PRODUCT_VERSION } from "../constants.js";
import {
  ToolFailure,
  artifactUnavailableFailure,
  idempotencyConflictFailure,
  repositoryNotReadyFailure,
  sourceAccessDeniedFailure,
  strongStoreUnavailableFailure,
} from "../errors/tool-errors.js";
import {
  RepositoryIndexError,
  buildRepositoryIndex,
  discardStagedRepositoryIndex,
  preflightRepositoryIndex,
  publishStagedRepositoryIndex,
  publishIncrementalStrongCutV1,
  savePendingRepositoryIndexV1,
  openActiveRepositoryIndexV1,
  type RepositoryIndexGenerationBindingV1,
} from "../runtime/repository-indexer.js";
import { prepareTaskKnowledgeV1 } from "./knowledge-publication.js";

const PRODUCTION_SAFE_GIT_EXECUTABLE_V1 = "/opt/understand-code/bin/git";
const MAX_CHANGED_SOURCE_BYTES_V1 = 64 * 1024 * 1024;
const MAX_CHANGED_SOURCE_PATHS_V1 = 4_096;
const MAX_CHANGED_SOURCE_METADATA_BYTES_V1 = 64 * 1024 * 1024;
const MAX_CHANGED_SOURCE_BLOB_BYTES_V1 = MAX_CHANGED_SOURCE_BYTES_V1;
const MAX_CHANGED_SOURCE_COMMANDS_V1 = 16_384;
const FATAL_UTF8_DECODER_V1 = new TextDecoder("utf-8", { fatal: true });
const REFRESH_PROVIDER_PHASE_V1 = "strong_refresh_index_v1";

type ContentDigestV1 = ReturnType<typeof sha256CanonicalJson>;
type StrongRefreshInputV1 = ReturnType<typeof RefreshIndexInputV1Schema.parse>;
type StrongSnapshotArtifactV1 = RepositorySnapshotArtifactV1 & Readonly<{
  payload: StrongRepositorySnapshotV1;
}>;
type StrongPulseArtifactV1 = RepoPulseArtifactV1 & Readonly<{
  payload: StrongRepoPulseV1;
}>;
type ProviderArtifactsV1 =
  ProviderProductionStrongCompareCommitV1Input["artifacts"];

interface StrongRefreshCutV1 {
  readonly snapshotArtifact: StrongSnapshotArtifactV1;
  readonly pulseArtifact: StrongPulseArtifactV1;
}

interface RecoveredProviderCutV1 extends StrongRefreshCutV1 {
  readonly revision: number;
  readonly operationNonce: string;
  readonly artifacts: ProviderArtifactsV1;
  readonly publicationStatus: "prepared" | "finalized";
  readonly indexGeneration?: RepositoryIndexGenerationBindingV1;
}

interface ObservedProviderRefreshAuthorityV1 {
  readonly observedProviderRevision: number;
  readonly authority: ProviderProductionStrongRefreshAuthorityV1 | undefined;
  readonly cut: StrongRefreshCutV1 | undefined;
}

function digestBytesV1(value: string | Buffer): ContentDigestV1 {
  return ("sha256:" + createHash("sha256").update(value).digest("hex")) as
    ContentDigestV1;
}

function digestCanonicalJsonV1(canonicalJson: string): ContentDigestV1 {
  return digestBytesV1(Buffer.from(canonicalJson, "utf8"));
}

function operationNonceV1(value: unknown): string {
  return sha256CanonicalJson(value).slice(7, 39);
}

function isRecordV1(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeysV1(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join("\u0000") ===
    [...keys].sort().join("\u0000");
}

function exactCanonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) ===
    canonicalizeJcsSafeIntegerV1(right);
}

function optionalExactCanonicalEqualV1(
  left: unknown | undefined,
  right: unknown | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return exactCanonicalEqualV1(left, right);
}

function pulseArtifactSemanticV1(pulse: StrongPulseArtifactV1): unknown {
  const { revision: _revision, ...semantic } = pulse;
  return semantic;
}

function pulseArtifactSemanticEqualV1(
  left: StrongPulseArtifactV1,
  right: StrongPulseArtifactV1,
): boolean {
  return exactCanonicalEqualV1(
    pulseArtifactSemanticV1(left),
    pulseArtifactSemanticV1(right),
  );
}

function withLocalPulseRevisionV1(
  pulse: StrongPulseArtifactV1,
  revision: number,
): StrongPulseArtifactV1 {
  return RepoPulseArtifactV1Schema.parse({
    ...pulse,
    revision,
  }) as StrongPulseArtifactV1;
}

function artifactNotFoundV1(error: unknown): boolean {
  return error instanceof ArtifactStoreError && error.code === "artifact_not_found";
}

function denySourceV1(
  reason: "symlink_escape" | "binary" | "too_large" | "redacted",
): never {
  throw new ToolFailure(sourceAccessDeniedFailure(reason));
}

function failCaptureV1(capture: RepositorySnapshotCapture): never {
  if (capture.snapshot.captureStatus === "partial") denySourceV1("redacted");
  throw new ToolFailure(repositoryNotReadyFailure(
    "unknown",
    ["repository_snapshot"],
    "repair_environment",
  ));
}

function containsHighConfidenceSecretV1(content: string): boolean {
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/=\r\n]{80,}-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u
    .test(content) ||
    /\bAKIA[0-9A-Z]{16}\b/u.test(content) ||
    /\bgh[pousr]_[A-Za-z0-9]{36,}\b/u.test(content);
}

function securityScanPolicyDigestV1(): ContentDigestV1 {
  return sha256CanonicalJson({
    profile: "repository-source-security-scan-v1",
    maxChangedSourceBytesTotal: MAX_CHANGED_SOURCE_BYTES_V1,
    maxChangedSourcePaths: MAX_CHANGED_SOURCE_PATHS_V1,
    maxLayeredMetadataBytes: MAX_CHANGED_SOURCE_METADATA_BYTES_V1,
    maxLayeredBlobBytes: MAX_CHANGED_SOURCE_BLOB_BYTES_V1,
    maxLayeredCommands: MAX_CHANGED_SOURCE_COMMANDS_V1,
    pathPolicy: "repository-sensitive-path-v1",
    textPolicy: "fatal-utf8-no-control-v1",
    secretPolicy: "high-confidence-secret-signatures-v1",
  });
}

async function preflightChangedSourcesV1(
  canonicalRoot: string,
  capture: RepositorySnapshotCapture,
  executor: SafeGitReadExecutorV1,
): Promise<void> {
  const layeredSession = createSafeGitLayeredContentReadSessionV1(executor, {
    maxMetadataBytes: MAX_CHANGED_SOURCE_METADATA_BYTES_V1,
    maxBlobBytes: MAX_CHANGED_SOURCE_BLOB_BYTES_V1,
    maxCommands: MAX_CHANGED_SOURCE_COMMANDS_V1,
  });
  const sourcesByPath = new Map<string, Set<string>>();
  const changedPaths = new Set<string>();
  for (const change of capture.snapshot.changes) {
    const sources = sourcesByPath.get(change.path) ?? new Set<string>();
    sources.add(change.source);
    sourcesByPath.set(change.path, sources);
    changedPaths.add(change.path);
    if (change.oldPath !== undefined) changedPaths.add(change.oldPath);
    if (changedPaths.size > MAX_CHANGED_SOURCE_PATHS_V1) {
      denySourceV1("too_large");
    }
  }
  const headCommit = capture.snapshot.headCommit;
  if (headCommit === undefined) failCaptureV1(capture);
  let scannedBytes = 0;
  for (const change of capture.snapshot.changes) {
    const pathResult = PathSafeRepositoryRelativePathV1Schema.safeParse(change.path);
    const oldPathResult = change.oldPath === undefined
      ? undefined
      : PathSafeRepositoryRelativePathV1Schema.safeParse(change.oldPath);
    if (!pathResult.success || oldPathResult?.success === false) {
      denySourceV1("redacted");
    }
    if (
      isSensitiveRepositoryPath(change.path) ||
      (change.oldPath !== undefined && isSensitiveRepositoryPath(change.oldPath))
    ) {
      denySourceV1("redacted");
    }
    if (change.source === "conflict") {
      denySourceV1("redacted");
    }
    if (
      change.source === "staged" &&
      change.kind !== "deleted" &&
      change.contentDigest === undefined
    ) {
      denySourceV1("redacted");
    }
    const pathSources = sourcesByPath.get(change.path)!;
    if (
      (change.source === "committed" &&
        [...pathSources].some((source) => source !== "committed")) ||
      (change.source === "staged" &&
        [...pathSources].some((source) =>
          source === "unstaged" || source === "untracked" || source === "conflict"
        ))
    ) denySourceV1("redacted");

    let bytes: Buffer;
    if (change.source === "committed" || change.source === "staged") {
      const remainingBytes = MAX_CHANGED_SOURCE_BYTES_V1 - scannedBytes;
      if (remainingBytes <= 0) denySourceV1("too_large");
      try {
        const exact = await readSafeGitLayeredRepositoryChangeContentV1(
          executor,
          headCommit,
          change,
          {
            maxBytes: remainingBytes,
            session: layeredSession,
            ...(change.source === "staged" && change.kind !== "deleted"
              ? {
                  expectedContentDigest:
                    change.contentDigest as `sha256:${string}`,
                }
              : {}),
          },
        );
        if (exact.status === "absent") continue;
        if (exact.status !== "content") denySourceV1("redacted");
        bytes = exact.bytes;
      } catch (error) {
        const code = isRecordV1(error) ? error["code"] : undefined;
        if (code === "budget_exceeded") denySourceV1("too_large");
        denySourceV1("redacted");
      }
    } else {
      if (change.kind === "deleted") continue;
      const remainingBytes = MAX_CHANGED_SOURCE_BYTES_V1 - scannedBytes;
      if (remainingBytes <= 0) denySourceV1("too_large");
      try {
        bytes = await readStableRepositoryFile(
          canonicalRoot,
          change.path,
          remainingBytes,
        );
      } catch (error) {
        const code = isRecordV1(error) ? error["code"] : undefined;
        if (code === "too_large") denySourceV1("too_large");
        denySourceV1("symlink_escape");
      }
    }
    scannedBytes += bytes.byteLength;
    if (scannedBytes > MAX_CHANGED_SOURCE_BYTES_V1) denySourceV1("too_large");
    if (
      change.contentDigest !== undefined &&
      digestBytesV1(bytes) !== change.contentDigest
    ) {
      denySourceV1("redacted");
    }
    let content: string;
    try {
      content = FATAL_UTF8_DECODER_V1.decode(bytes);
    } catch {
      denySourceV1("binary");
    }
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(content)) {
      denySourceV1("binary");
    }
    if (containsHighConfidenceSecretV1(content)) denySourceV1("redacted");
  }
}

function captureSemanticV1(capture: RepositorySnapshotCapture): unknown {
  const snapshot = capture.snapshot;
  return {
    canonicalRoot: capture.canonicalRoot,
    branch: snapshot.branch ?? null,
    headCommit: snapshot.headCommit ?? null,
    baseCommit: snapshot.baseCommit ?? null,
    mergeBase: snapshot.mergeBase ?? null,
    indexDigest: snapshot.indexDigest,
    worktreeDigest: snapshot.worktreeDigest,
    untrackedDigest: snapshot.untrackedDigest,
    ignoreDigest: snapshot.ignoreDigest,
    captureStatus: snapshot.captureStatus,
    limitations: snapshot.limitations,
    changes: snapshot.changes.map(({ id: _id, ...change }) => change),
    git: capture.git,
  };
}

function assertStableCompleteCaptureV1(
  canonicalRoot: string,
  before: RepositorySnapshotCapture,
  after: RepositorySnapshotCapture,
): void {
  if (
    before.canonicalRoot !== canonicalRoot ||
    after.canonicalRoot !== canonicalRoot ||
    before.snapshot.captureStatus !== "complete" ||
    after.snapshot.captureStatus !== "complete" ||
    before.snapshot.limitations.length !== 0 ||
    after.snapshot.limitations.length !== 0
  ) {
    failCaptureV1(before.snapshot.captureStatus === "complete" ? after : before);
  }
  if (
    canonicalizeJson(captureSemanticV1(before)) !==
    canonicalizeJson(captureSemanticV1(after))
  ) {
    denySourceV1("redacted");
  }
}

function strongChangeOrderV1(
  left: StrongRepositorySnapshotV1["changes"][number],
  right: StrongRepositorySnapshotV1["changes"][number],
): number {
  const sourceOrder = {
    committed: 0,
    staged: 1,
    unstaged: 2,
    untracked: 3,
    conflict: 4,
  };
  const kindOrder = {
    added: 0,
    modified: 1,
    deleted: 2,
    renamed: 3,
    copied: 4,
    type_changed: 5,
  };
  return sourceOrder[left.source] - sourceOrder[right.source] ||
    (left.path < right.path ? -1 : left.path > right.path ? 1 : 0) ||
    ((left.oldPath ?? "") < (right.oldPath ?? "")
      ? -1
      : (left.oldPath ?? "") > (right.oldPath ?? "") ? 1 : 0) ||
    kindOrder[left.kind] - kindOrder[right.kind] ||
    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

async function ownerCommitmentV1(
  provider: ProviderProductionStrongObjectClientV1,
  domain: ProviderProductionOwnerCommitmentDomainV1,
  value: unknown,
) {
  return await provider.commitOwnerOnlyState(
    domain,
    canonicalizeJcsSafeIntegerV1([domain, value]),
  );
}

async function assertProviderAuthenticatedSnapshotV1(
  provider: ProviderProductionStrongObjectClientV1,
  identity: SafeGitRepositoryIdentityInspectionV1,
  snapshot: StrongRepositorySnapshotV1,
): Promise<void> {
  if (
    snapshot.repositoryId !== identity.repositoryId ||
    snapshot.worktreeId !== identity.worktreeId ||
    snapshot.rootIdentity !== identity.rootIdentity ||
    snapshot.objectFormat !== identity.objectFormat ||
    snapshot.headState.kind !== "commit" ||
    snapshot.captureStatus !== "complete" ||
    snapshot.redactedChanges.length !== 0 ||
    snapshot.unknownStates.length !== 0 ||
    snapshot.securityScanPolicyDigest !== securityScanPolicyDigestV1()
  ) {
    throw new TypeError("Published refresh baseline identity is invalid");
  }
  const expectedRepositoryStateToken = await ownerCommitmentV1(
    provider,
    "repository-state-semantic-v1",
    {
      repositoryId: snapshot.repositoryId,
      worktreeId: snapshot.worktreeId,
      rootIdentity: snapshot.rootIdentity,
      branchState: snapshot.branchState,
      objectFormat: snapshot.objectFormat,
      headCommit: snapshot.headState.commit,
      baseCommit: snapshot.baseCommit ?? null,
      mergeBase: snapshot.mergeBase ?? null,
      indexToken: snapshot.indexToken,
      worktreeToken: snapshot.worktreeToken,
      untrackedToken: snapshot.untrackedToken,
      ignoreToken: snapshot.ignoreToken,
      securityScanPolicyDigest: snapshot.securityScanPolicyDigest,
      safeGitExecutionDigest: snapshot.safeGitExecutionDigest,
    },
  );
  if (expectedRepositoryStateToken !== snapshot.repositoryStateToken) {
    throw new TypeError("Published refresh baseline Provider commitment is invalid");
  }
}

async function buildStrongSnapshotV1(
  provider: ProviderProductionStrongObjectClientV1,
  identity: SafeGitRepositoryIdentityInspectionV1,
  safeGitInspection: unknown,
  capture: RepositorySnapshotCapture,
  createdAt: string,
): Promise<StrongRepositorySnapshotV1> {
  const branchStateInput = capture.git.detached
    ? { status: "detached" as const }
    : capture.snapshot.branch === undefined
      ? undefined
      : { status: "safe" as const, name: capture.snapshot.branch };
  const branchState = RepositoryBranchStateV1Schema.safeParse(branchStateInput);
  if (!branchState.success) denySourceV1("redacted");
  const headCommit = capture.snapshot.headCommit;
  if (headCommit === undefined) failCaptureV1(capture);

  const [indexToken, worktreeToken, untrackedToken, ignoreToken] =
    await Promise.all([
      ownerCommitmentV1(provider, "repository-index-state-v1", {
        repositoryId: identity.repositoryId,
        worktreeId: identity.worktreeId,
        digest: capture.snapshot.indexDigest,
      }),
      ownerCommitmentV1(provider, "repository-worktree-state-v1", {
        repositoryId: identity.repositoryId,
        worktreeId: identity.worktreeId,
        digest: capture.snapshot.worktreeDigest,
      }),
      ownerCommitmentV1(provider, "repository-untracked-state-v1", {
        repositoryId: identity.repositoryId,
        worktreeId: identity.worktreeId,
        digest: capture.snapshot.untrackedDigest,
      }),
      ownerCommitmentV1(provider, "repository-ignore-state-v1", {
        repositoryId: identity.repositoryId,
        worktreeId: identity.worktreeId,
        digest: capture.snapshot.ignoreDigest,
      }),
    ]);
  const securityScanPolicyDigest = securityScanPolicyDigestV1();
  const safeGitExecutionDigest = sha256CanonicalJson({
    profile: "descriptor-bound-safe-git-execution-v1",
    inspection: safeGitInspection,
  });
  const repositoryStateToken = await ownerCommitmentV1(
    provider,
    "repository-state-semantic-v1",
    {
      repositoryId: identity.repositoryId,
      worktreeId: identity.worktreeId,
      rootIdentity: identity.rootIdentity,
      branchState: branchState.data,
      objectFormat: identity.objectFormat,
      headCommit,
      baseCommit: capture.snapshot.baseCommit ?? null,
      mergeBase: capture.snapshot.mergeBase ?? null,
      indexToken,
      worktreeToken,
      untrackedToken,
      ignoreToken,
      securityScanPolicyDigest,
      safeGitExecutionDigest,
    },
  );
  const changes = capture.snapshot.changes.map(({ id: _id, ...change }) => ({
    id: derivePathSafeRepositoryChangeIdV1(change, digestCanonicalJsonV1),
    ...change,
  })).sort(strongChangeOrderV1);
  const draft = StrongRepositorySnapshotV1Schema.parse({
    schemaVersion: 1,
    profile: "repository_snapshot_path_safe_v1",
    snapshotId: "snapshot-" + "0".repeat(64),
    repositoryId: identity.repositoryId,
    worktreeId: identity.worktreeId,
    rootIdentity: identity.rootIdentity,
    branchState: branchState.data,
    objectFormat: identity.objectFormat,
    headState: { kind: "commit", commit: headCommit },
    ...(capture.snapshot.baseCommit === undefined
      ? {}
      : { baseCommit: capture.snapshot.baseCommit }),
    ...(capture.snapshot.mergeBase === undefined
      ? {}
      : { mergeBase: capture.snapshot.mergeBase }),
    repositoryStateToken,
    indexToken,
    worktreeToken,
    untrackedToken,
    ignoreToken,
    securityScanPolicyDigest,
    safeGitExecutionDigest,
    createdAt,
    captureStatus: "complete",
    accounting: {
      rawLayerUnitCount: capture.snapshot.changes.length,
      candidateUnitCount: changes.length,
      safeChangeCount: changes.length,
      redactedKnownChangeCount: 0,
      unknownStateCount: 0,
    },
    changes,
    redactedChanges: [],
    unknownStates: [],
  });
  return parseTrustedStrongRepositorySnapshotV1({
    ...draft,
    snapshotId: derivePathSafeRepositorySnapshotIdV1(
      draft,
      digestCanonicalJsonV1,
    ),
  }, digestCanonicalJsonV1);
}

function snapshotSemanticV1(snapshot: StrongRepositorySnapshotV1): unknown {
  const { snapshotId: _snapshotId, createdAt: _createdAt, ...semantic } = snapshot;
  return semantic;
}

function assertRecoveredSnapshotMatchesCurrentAbsoluteStateV1(
  recovered: StrongRepositorySnapshotV1,
  current: StrongRepositorySnapshotV1,
): void {
  if (
    recovered.repositoryId !== current.repositoryId ||
    recovered.worktreeId !== current.worktreeId ||
    recovered.rootIdentity !== current.rootIdentity ||
    !exactCanonicalEqualV1(recovered.branchState, current.branchState) ||
    recovered.objectFormat !== current.objectFormat ||
    !exactCanonicalEqualV1(recovered.headState, current.headState) ||
    recovered.indexToken !== current.indexToken ||
    recovered.worktreeToken !== current.worktreeToken ||
    recovered.untrackedToken !== current.untrackedToken ||
    recovered.ignoreToken !== current.ignoreToken ||
    recovered.securityScanPolicyDigest !== current.securityScanPolicyDigest ||
    recovered.safeGitExecutionDigest !== current.safeGitExecutionDigest
  ) {
    throw new TypeError(
      "Recovered Provider refresh cut no longer matches repository state",
    );
  }
}

function changeSummaryV1(snapshot: StrongRepositorySnapshotV1) {
  const bySource = {
    committed: 0,
    staged: 0,
    unstaged: 0,
    untracked: 0,
    conflict: 0,
  };
  const byKind = {
    added: 0,
    modified: 0,
    deleted: 0,
    renamed: 0,
    copied: 0,
    type_changed: 0,
  };
  for (const change of snapshot.changes) {
    bySource[change.source] += 1;
    byKind[change.kind] += 1;
  }
  return { total: snapshot.changes.length, bySource, byKind };
}

function buildStrongPulseV1(
  snapshot: StrongRepositorySnapshotV1,
  mode: "incremental" | "full",
  baselineSnapshotId: string | undefined,
  evaluatedAt: string,
): StrongRepoPulseV1 {
  const full = mode === "full";
  const diagnosticCodes = [
    "artifact_missing" as const,
    "call_graph_partial" as const,
    "parser_partial" as const,
    ...(full ? [] : ["strong_refresh_required" as const]),
  ].sort();
  return parseTrustedStrongRepoPulseV1({
    profile: "repo_pulse_path_safe_v1",
    evaluatedSnapshotId: snapshot.snapshotId,
    evaluatedSnapshotContentDigest: sha256CanonicalJson(snapshot),
    ...(baselineSnapshotId === undefined ? {} : { baselineSnapshotId }),
    status: full ? "partial" : "not_ready",
    artifactFreshness: {
      graph: full ? "fresh" : "missing",
      wiki: full ? "fresh" : "missing",
      evidence: "missing",
      diff: "missing",
      task: "missing",
    },
    repositoryState: {
      repositoryId: snapshot.repositoryId,
      worktreeId: snapshot.worktreeId,
      rootIdentity: snapshot.rootIdentity,
      branchState: snapshot.branchState,
      objectFormat: snapshot.objectFormat,
      headState: snapshot.headState,
      repositoryStateToken: snapshot.repositoryStateToken,
      captureStatus: snapshot.captureStatus,
    },
    changeSummary: changeSummaryV1(snapshot),
    security: {
      snapshotProfile: "repository_snapshot_path_safe_v1",
      safeChangeCount: snapshot.accounting.safeChangeCount,
      redactedChangeCount: 0,
      unknownStateCount: 0,
      redactionBoundaryCodes: [],
      uncertaintyCodes: [],
    },
    securityScanPolicyDigest: snapshot.securityScanPolicyDigest,
    safeGitExecutionDigest: snapshot.safeGitExecutionDigest,
    completeness: {
      parser: { status: "partial", reasonCodes: ["parser_partial"] },
      callGraph: { status: "partial", reasonCodes: ["call_graph_partial"] },
    },
    recommendedRefresh: full ? "none" : "full",
    diagnosticCodes,
    evaluatedAt,
  }, snapshot, digestCanonicalJsonV1);
}

function strongSnapshotArtifactV1(
  snapshot: StrongRepositorySnapshotV1,
): StrongSnapshotArtifactV1 {
  return RepositorySnapshotArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "repository_snapshot",
    artifactId: "artifact:repository-snapshot:" + snapshot.snapshotId,
    repositoryId: snapshot.repositoryId,
    worktreeId: snapshot.worktreeId,
    sourceSnapshotId: snapshot.snapshotId,
    revision: 0,
    producerVersion: PRODUCT_VERSION,
    createdAt: snapshot.createdAt,
    contentDigest: sha256CanonicalJson(snapshot),
    payload: snapshot,
  }) as StrongSnapshotArtifactV1;
}

function strongPulseArtifactV1(
  pulse: StrongRepoPulseV1,
  snapshot: StrongRepositorySnapshotV1,
  revision: number,
): StrongPulseArtifactV1 {
  const contentDigest = sha256CanonicalJson(pulse);
  return RepoPulseArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "repo_pulse",
    artifactId: "artifact:repo-pulse:" + snapshot.snapshotId + ":" +
      contentDigest.slice(-16),
    repositoryId: snapshot.repositoryId,
    worktreeId: snapshot.worktreeId,
    sourceSnapshotId: snapshot.snapshotId,
    revision,
    producerVersion: PRODUCT_VERSION,
    createdAt: pulse.evaluatedAt,
    contentDigest,
    payload: pulse,
  }) as StrongPulseArtifactV1;
}

function parseStrongCutV1(value: unknown): StrongRefreshCutV1 {
  if (
    !isRecordV1(value) ||
    !exactKeysV1(value, [
      "schemaVersion",
      "snapshotArtifact",
      "pulseArtifact",
    ]) ||
    value["schemaVersion"] !== 1
  ) {
    throw new TypeError("Provider refresh cut is invalid");
  }
  const snapshotArtifact = parseTrustedRepositorySnapshotArtifactV1(
    value["snapshotArtifact"],
    digestCanonicalJsonV1,
  );
  if (
    !("profile" in snapshotArtifact.payload) ||
    snapshotArtifact.payload.profile !== "repository_snapshot_path_safe_v1"
  ) {
    throw new TypeError("Provider refresh Snapshot is not strong");
  }
  const pulseArtifact = RepoPulseArtifactV1Schema.parse(value["pulseArtifact"]);
  if (
    !("profile" in pulseArtifact.payload) ||
    pulseArtifact.payload.profile !== "repo_pulse_path_safe_v1"
  ) {
    throw new TypeError("Provider refresh Pulse is not strong");
  }
  if (pulseArtifact.contentDigest !== sha256CanonicalJson(pulseArtifact.payload)) {
    throw new TypeError("Provider refresh Pulse digest is invalid");
  }
  parseTrustedStrongRepoPulseV1(
    pulseArtifact.payload,
    snapshotArtifact.payload,
    digestCanonicalJsonV1,
  );
  return {
    snapshotArtifact: snapshotArtifact as StrongSnapshotArtifactV1,
    pulseArtifact: pulseArtifact as StrongPulseArtifactV1,
  };
}

async function readProviderCutObjectV1(
  provider: ProviderProductionStrongObjectClientV1,
  locatorInput: unknown,
): Promise<StrongRefreshCutV1> {
  const locator = ProviderRuntimeIpcFixedObjectLocatorV1Schema.parse(locatorInput);
  const read = await provider.readExactObject(locator);
  if (
    read.locator.contentDigest !== locator.contentDigest ||
    read.verifiedContentDigest !== locator.contentDigest ||
    !read.bytes.startsWith("base64url:")
  ) {
    throw new TypeError("Provider refresh cut object binding is invalid");
  }
  const bytes = Buffer.from(read.bytes.slice("base64url:".length), "base64url");
  if (
    bytes.byteLength !== read.logicalBytes ||
    digestBytesV1(bytes) !== locator.contentDigest
  ) {
    throw new TypeError("Provider refresh cut object bytes are invalid");
  }
  return parseStrongCutV1(parseCanonicalJcsSafeIntegerUtf8V1(bytes));
}

async function observeProviderRefreshAuthorityV1(
  provider: ProviderProductionStrongObjectClientV1,
  identity: SafeGitRepositoryIdentityInspectionV1,
): Promise<ObservedProviderRefreshAuthorityV1> {
  const inspected = await provider.inspectStrongRefreshAuthority(
    identity.repositoryId,
    identity.worktreeId,
  );
  if (inspected.authority === undefined) {
    return {
      observedProviderRevision: inspected.observedProviderRevision,
      authority: undefined,
      cut: undefined,
    };
  }
  const authority = inspected.authority;
  const cut = await readProviderCutObjectV1(provider, authority.cutObject);
  if (
    authority.repositoryId !== identity.repositoryId ||
    authority.worktreeId !== identity.worktreeId ||
    authority.finalizedProviderRevision > inspected.observedProviderRevision ||
    authority.snapshotId !== cut.snapshotArtifact.payload.snapshotId ||
    authority.snapshotContentDigest !== cut.snapshotArtifact.contentDigest ||
    authority.pulseContentDigest !== cut.pulseArtifact.contentDigest ||
    cut.pulseArtifact.sourceSnapshotId !== authority.snapshotId
  ) {
    throw new TypeError("Provider latest refresh authority is not bound to its exact cut");
  }
  await assertProviderAuthenticatedSnapshotV1(
    provider,
    identity,
    cut.snapshotArtifact.payload,
  );
  return {
    observedProviderRevision: inspected.observedProviderRevision,
    authority,
    cut,
  };
}

function previousRefreshAuthorityV1(
  authority: ProviderProductionStrongRefreshAuthorityV1 | undefined,
): ProviderProductionStrongRefreshAuthorityInputV1["previous"] {
  return authority === undefined
    ? null
    : {
        snapshotId: authority.snapshotId,
        finalizedProviderRevision: authority.finalizedProviderRevision,
      };
}

async function probeRecoveredProviderCutV1(
  provider: ProviderProductionStrongObjectClientV1,
  requestDigest: string,
  idempotencyKeyDigest: string,
  semanticDigest: string | undefined,
  observation?: ObservedProviderRefreshAuthorityV1,
): Promise<RecoveredProviderCutV1 | undefined> {
  const inspected = await provider.inspectBusinessHead();
  const artifacts = inspected.artifacts;
  const operation = artifacts["operation"];
  if (
    inspected.phase !== REFRESH_PROVIDER_PHASE_V1 ||
    artifacts["schemaVersion"] !== 1 ||
    (operation !== "refresh_index" &&
      operation !== "refresh_index_prepared") ||
    artifacts["requestDigest"] !== requestDigest ||
    artifacts["idempotencyKeyDigest"] !== idempotencyKeyDigest ||
    typeof artifacts["semanticDigest"] !== "string" ||
    (semanticDigest !== undefined &&
      artifacts["semanticDigest"] !== semanticDigest)
  ) {
    if (
      observation?.authority !== undefined &&
      observation.authority.finalizedProviderRevision === inspected.revision &&
      exactCanonicalEqualV1(
        observation.authority.cutObject,
        artifacts["cutObject"],
      )
    ) return undefined;
    return await probeRecoveredProviderAuthorityCutV1(
      provider,
      requestDigest,
      idempotencyKeyDigest,
      semanticDigest,
      observation,
    );
  }
  const mode = artifacts["mode"];
  if (operation === "refresh_index_prepared" && mode !== "full") {
    throw new TypeError("Provider prepared refresh recovery mode is invalid");
  }
  let indexGeneration: RepositoryIndexGenerationBindingV1 | undefined;
  if (mode === "full") {
    const generationId = artifacts["indexGenerationId"];
    const generationManifestDigest =
      artifacts["indexGenerationManifestDigest"];
    const sourceInventoryDigest = artifacts["indexSourceInventoryDigest"];
    if (
      typeof generationId !== "string" ||
      !/^generation-[0-9a-f]{64}$/u.test(generationId) ||
      typeof generationManifestDigest !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(generationManifestDigest) ||
      typeof sourceInventoryDigest !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(sourceInventoryDigest)
    ) {
      throw new TypeError("Provider refresh index generation binding is invalid");
    }
    indexGeneration = {
      generationId,
      generationManifestDigest:
        generationManifestDigest as `sha256:${string}`,
      sourceInventoryDigest: sourceInventoryDigest as `sha256:${string}`,
    };
  }
  const cut =
    observation?.authority !== undefined &&
      observation.cut !== undefined &&
      exactCanonicalEqualV1(
        observation.authority.cutObject,
        artifacts["cutObject"],
      )
      ? observation.cut
      : await readProviderCutObjectV1(provider, artifacts["cutObject"]);
  if (
    sha256CanonicalJson(snapshotSemanticV1(cut.snapshotArtifact.payload)) !==
      artifacts["semanticDigest"] ||
    cut.pulseArtifact.sourceSnapshotId !== cut.snapshotArtifact.sourceSnapshotId ||
    artifacts["snapshotId"] !== cut.snapshotArtifact.sourceSnapshotId ||
    artifacts["snapshotContentDigest"] !== cut.snapshotArtifact.contentDigest ||
    artifacts["pulseContentDigest"] !== cut.pulseArtifact.contentDigest
  ) {
    throw new TypeError("Provider refresh recovery cut is semantically invalid");
  }
  return {
    ...cut,
    revision: inspected.revision,
    operationNonce: inspected.operationNonce,
    artifacts,
    publicationStatus: operation === "refresh_index"
      ? "finalized"
      : "prepared",
    ...(indexGeneration === undefined ? {} : { indexGeneration }),
  };
}

async function probeRecoveredProviderAuthorityCutV1(
  provider: ProviderProductionStrongObjectClientV1,
  requestDigest: string,
  idempotencyKeyDigest: string,
  semanticDigestInput: string | undefined,
  observation?: ObservedProviderRefreshAuthorityV1,
): Promise<RecoveredProviderCutV1 | undefined> {
  const authority = observation?.authority;
  const cut = observation?.cut;
  if (authority === undefined || cut === undefined) return undefined;
  const semanticDigest = sha256CanonicalJson(
    snapshotSemanticV1(cut.snapshotArtifact.payload),
  );
  if (
    semanticDigestInput !== undefined &&
    semanticDigestInput !== semanticDigest
  ) return undefined;

  let indexGeneration: RepositoryIndexGenerationBindingV1 | undefined;
  if (authority.mode === "full") {
    const indexAuthority = await provider.inspectIndexPublicationAuthority();
    if (
      indexAuthority === undefined ||
      indexAuthority.finalizedProviderRevision !==
        authority.finalizedProviderRevision ||
      indexAuthority.sourceSnapshotId !== authority.snapshotId
    ) return undefined;
    indexGeneration = {
      generationId: indexAuthority.generationId,
      generationManifestDigest:
        indexAuthority.generationManifestDigest as `sha256:${string}`,
      sourceInventoryDigest:
        indexAuthority.sourceInventoryDigest as `sha256:${string}`,
    };
  }
  const artifacts = providerArtifactsV1(
    "refresh_index",
    requestDigest,
    idempotencyKeyDigest,
    semanticDigest,
    authority.mode,
    authority.cutObject,
    cut,
    indexGeneration,
  );
  const operationNonce = operationNonceV1({
    domain: authority.mode === "full"
      ? "strong-refresh-index-finalize-v1"
      : "strong-refresh-index-commit-v1",
    ...(authority.mode === "full"
      ? {
          expectedPreparedRevision:
            authority.finalizedProviderRevision - 1,
        }
      : {
          expectedRevision: authority.finalizedProviderRevision - 1,
        }),
    idempotencyKeyDigest,
    requestDigest,
    semanticDigest,
    cutContentDigest: authority.cutObject.contentDigest,
  });
  const recovered: RecoveredProviderCutV1 = {
    ...cut,
    revision: authority.finalizedProviderRevision,
    operationNonce,
    artifacts,
    publicationStatus: "finalized",
    ...(indexGeneration === undefined ? {} : { indexGeneration }),
  };
  const replay = await provider.compareCommit({
    expectedRevision: recovered.revision - 1,
    operationNonce: recovered.operationNonce,
    phase: REFRESH_PROVIDER_PHASE_V1,
    artifacts: recovered.artifacts,
  });
  if (replay.resolution === "stale") return undefined;
  if (
    replay.resolution !== "replayed" ||
    replay.state.revision !== recovered.revision ||
    !exactCanonicalEqualV1(replay.state.artifacts, recovered.artifacts)
  ) {
    throw new TypeError("Provider refresh authority recovery was not exact");
  }
  return recovered;
}

async function readManifestV1(store: ArtifactStore) {
  try {
    return await store.readManifest({ verifyArtifacts: false });
  } catch (error) {
    if (artifactNotFoundV1(error)) return undefined;
    throw error;
  }
}

async function readStrongSnapshotV1(
  store: ArtifactStore,
  snapshotId: string | undefined,
): Promise<StrongSnapshotArtifactV1 | undefined> {
  if (snapshotId === undefined) return undefined;
  try {
    const read = await store.readArtifact("repository_snapshot", { snapshotId });
    const artifact = parseTrustedRepositorySnapshotArtifactV1(
      read.artifact,
      digestCanonicalJsonV1,
    );
    return "profile" in artifact.payload &&
        artifact.payload.profile === "repository_snapshot_path_safe_v1"
      ? artifact as StrongSnapshotArtifactV1
      : undefined;
  } catch (error) {
    if (artifactNotFoundV1(error)) return undefined;
    throw error;
  }
}

async function readStrongPulseV1(
  store: ArtifactStore,
): Promise<StrongPulseArtifactV1 | undefined> {
  try {
    const read = await store.readArtifact("repo_pulse");
    const artifact = RepoPulseArtifactV1Schema.parse(read.artifact);
    if (
      !("profile" in artifact.payload) ||
      artifact.payload.profile !== "repo_pulse_path_safe_v1"
    ) {
      return undefined;
    }
    if (artifact.contentDigest !== sha256CanonicalJson(artifact.payload)) {
      throw new TypeError("Published strong Pulse digest is invalid");
    }
    return artifact as StrongPulseArtifactV1;
  } catch (error) {
    if (artifactNotFoundV1(error)) return undefined;
    throw error;
  }
}

function providerArtifactsV1(
  operation: "refresh_index_prepared" | "refresh_index",
  requestDigest: string,
  idempotencyKeyDigest: string,
  semanticDigest: string,
  mode: "incremental" | "full",
  cutObject: ReturnType<typeof ProviderRuntimeIpcFixedObjectLocatorV1Schema.parse>,
  cut: StrongRefreshCutV1,
  indexGeneration?: RepositoryIndexGenerationBindingV1,
): ProviderArtifactsV1 {
  return {
    schemaVersion: 1,
    operation,
    requestDigest,
    idempotencyKeyDigest,
    semanticDigest,
    mode,
    cutObject,
    snapshotId: cut.snapshotArtifact.sourceSnapshotId,
    snapshotContentDigest: cut.snapshotArtifact.contentDigest,
    pulseContentDigest: cut.pulseArtifact.contentDigest,
    ...(indexGeneration === undefined
      ? {}
      : {
          indexGenerationId: indexGeneration.generationId,
          indexGenerationManifestDigest:
            indexGeneration.generationManifestDigest,
          indexSourceInventoryDigest:
            indexGeneration.sourceInventoryDigest,
        }),
  };
}

function refreshAuthorityInputV1(
  cut: StrongRefreshCutV1,
  mode: "incremental" | "full",
  cutObject: ReturnType<typeof ProviderRuntimeIpcFixedObjectLocatorV1Schema.parse>,
  previous: ProviderProductionStrongRefreshAuthorityInputV1["previous"],
): ProviderProductionStrongRefreshAuthorityInputV1 {
  return {
    profile: "provider_production_strong_refresh_authority_v1",
    repositoryId: cut.snapshotArtifact.payload.repositoryId,
    worktreeId: cut.snapshotArtifact.payload.worktreeId,
    mode,
    snapshotId: cut.snapshotArtifact.payload.snapshotId,
    snapshotContentDigest: cut.snapshotArtifact.contentDigest,
    pulseContentDigest: cut.pulseArtifact.contentDigest,
    cutObject,
    previous,
  } as unknown as ProviderProductionStrongRefreshAuthorityInputV1;
}

async function commitProviderCutV1(
  provider: ProviderProductionStrongObjectClientV1,
  cut: StrongRefreshCutV1,
  requestDigest: string,
  idempotencyKeyDigest: string,
  semanticDigest: string,
  mode: "incremental" | "full",
  observation: ObservedProviderRefreshAuthorityV1,
  indexGeneration?: RepositoryIndexGenerationBindingV1,
) {
  const cutValue = {
    schemaVersion: 1,
    snapshotArtifact: cut.snapshotArtifact,
    pulseArtifact: cut.pulseArtifact,
  };
  const cutBytes = Buffer.from(canonicalizeJcsSafeIntegerV1(cutValue), "utf8");
  const cutObject = ProviderRuntimeIpcFixedObjectLocatorV1Schema.parse({
    providerId: provider.verifiedProviderId,
    contentDigest: digestBytesV1(cutBytes),
  });
  const write = await provider.writeExactObject({
    locator: cutObject,
    logicalBytes: cutBytes.byteLength,
    bytes: "base64url:" + cutBytes.toString("base64url"),
    operationNonce: operationNonceV1({
      domain: "strong-refresh-index-object-v1",
      contentDigest: cutObject.contentDigest,
    }),
  });
  if (
    write.verifiedContentDigest !== cutObject.contentDigest ||
    !exactCanonicalEqualV1(write.locator, cutObject)
  ) {
    throw new TypeError("Provider refresh object write was not exact");
  }
  const artifacts = providerArtifactsV1(
    mode === "full" ? "refresh_index_prepared" : "refresh_index",
    requestDigest,
    idempotencyKeyDigest,
    semanticDigest,
    mode,
    cutObject,
    cut,
    indexGeneration,
  );
  const operationNonce = operationNonceV1({
    domain: mode === "full"
      ? "strong-refresh-index-prepare-v1"
      : "strong-refresh-index-commit-v1",
    expectedRevision: observation.observedProviderRevision,
    idempotencyKeyDigest,
    requestDigest,
    semanticDigest,
    cutContentDigest: cutObject.contentDigest,
  });
  const compareInput = {
    expectedRevision: observation.observedProviderRevision,
    operationNonce,
    phase: REFRESH_PROVIDER_PHASE_V1,
    artifacts,
  };
  const committed = mode === "full"
    ? await provider.compareCommit(compareInput)
    : await provider.compareCommitRefreshPublication({
        ...compareInput,
        refreshAuthority: refreshAuthorityInputV1(
          cut,
          mode,
          cutObject,
          previousRefreshAuthorityV1(observation.authority),
        ),
      });
  if (
    committed.resolution === "stale" ||
    committed.state.operationNonce !== operationNonce ||
    committed.state.phase !== REFRESH_PROVIDER_PHASE_V1 ||
    !exactCanonicalEqualV1(committed.state.artifacts, artifacts)
  ) {
    throw new TypeError(
      "Provider refresh compare-commit did not publish the exact cut",
    );
  }
  if (mode === "incremental") {
    const refreshAuthority = refreshAuthorityInputV1(
      cut,
      mode,
      cutObject,
      previousRefreshAuthorityV1(observation.authority),
    );
    const inspectedRefresh = await provider.inspectStrongRefreshAuthority(
      cut.snapshotArtifact.payload.repositoryId,
      cut.snapshotArtifact.payload.worktreeId,
    );
    if (
      inspectedRefresh.authority === undefined ||
      inspectedRefresh.observedProviderRevision < committed.state.revision ||
      !exactCanonicalEqualV1(inspectedRefresh.authority, {
        ...refreshAuthority,
        finalizedProviderRevision: committed.state.revision,
      })
    ) {
      throw new TypeError("Provider refresh authority did not finalize exactly");
    }
  }
  return {
    resolution: committed.resolution,
    cutObject,
    preparedRevision: committed.state.revision,
    preparedOperationNonce: committed.state.operationNonce,
    preparedArtifacts: committed.state.artifacts,
  };
}

async function finalizeFullProviderCutV1(
  provider: ProviderProductionStrongObjectClientV1,
  cut: StrongRefreshCutV1,
  cutObject: ReturnType<typeof ProviderRuntimeIpcFixedObjectLocatorV1Schema.parse>,
  requestDigest: string,
  idempotencyKeyDigest: string,
  semanticDigest: string,
  indexGeneration: RepositoryIndexGenerationBindingV1,
  previousAuthority: ProviderProductionStrongRefreshAuthorityV1 | undefined,
  prepared: Readonly<{
    preparedRevision: number;
    preparedOperationNonce: string;
    preparedArtifacts: ProviderArtifactsV1;
  }>,
) {
  const artifacts = providerArtifactsV1(
    "refresh_index",
    requestDigest,
    idempotencyKeyDigest,
    semanticDigest,
    "full",
    cutObject,
    cut,
    indexGeneration,
  );
  const operationNonce = operationNonceV1({
    domain: "strong-refresh-index-finalize-v1",
    expectedPreparedRevision: prepared.preparedRevision,
    idempotencyKeyDigest,
    requestDigest,
    semanticDigest,
    cutContentDigest: cutObject.contentDigest,
  });
  const refreshAuthority = refreshAuthorityInputV1(
    cut,
    "full",
    cutObject,
    previousRefreshAuthorityV1(previousAuthority),
  );
  const finalized = await provider.compareCommitRefreshPublication({
    expectedRevision: prepared.preparedRevision,
    operationNonce,
    phase: REFRESH_PROVIDER_PHASE_V1,
    artifacts,
    refreshAuthority,
    indexPublicationAuthority: {
      profile: "provider_production_strong_index_publication_authority_v1",
      generationId: indexGeneration.generationId,
      generationManifestDigest: indexGeneration.generationManifestDigest,
      sourceInventoryDigest: indexGeneration.sourceInventoryDigest,
      sourceSnapshotId: cut.snapshotArtifact.payload.snapshotId,
    } as unknown as ProviderProductionStrongIndexPublicationAuthorityInputV1,
  });
  if (
    finalized.resolution === "stale" ||
    finalized.state.operationNonce !== operationNonce ||
    finalized.state.phase !== REFRESH_PROVIDER_PHASE_V1 ||
    !exactCanonicalEqualV1(finalized.state.artifacts, artifacts)
  ) {
    throw new TypeError(
      "Provider refresh finalization did not publish the exact full cut",
    );
  }
  const publicationAuthority = await provider.inspectIndexPublicationAuthority();
  const inspectedRefresh = await provider.inspectStrongRefreshAuthority(
    cut.snapshotArtifact.payload.repositoryId,
    cut.snapshotArtifact.payload.worktreeId,
  );
  if (publicationAuthority === undefined ||
    publicationAuthority.finalizedProviderRevision !== finalized.state.revision ||
    publicationAuthority.generationId !== indexGeneration.generationId ||
    publicationAuthority.generationManifestDigest !== indexGeneration.generationManifestDigest ||
    publicationAuthority.sourceInventoryDigest !== indexGeneration.sourceInventoryDigest ||
    publicationAuthority.sourceSnapshotId !== cut.snapshotArtifact.payload.snapshotId ||
    inspectedRefresh.authority === undefined ||
    inspectedRefresh.observedProviderRevision < finalized.state.revision ||
    !exactCanonicalEqualV1(inspectedRefresh.authority, {
      ...refreshAuthority,
      finalizedProviderRevision: finalized.state.revision,
    })) {
    throw new TypeError("Provider refresh index authority did not finalize exactly");
  }
  return {
    resolution: finalized.resolution,
    finalizedProviderRevision: finalized.state.revision,
  };
}

async function replayRecoveredProviderCutV1(
  provider: ProviderProductionStrongObjectClientV1,
  recovered: RecoveredProviderCutV1,
) {
  if (recovered.revision < 1) {
    throw new TypeError("Provider refresh recovery revision is invalid");
  }
  const replay = await provider.compareCommit({
    expectedRevision: recovered.revision - 1,
    operationNonce: recovered.operationNonce,
    phase: REFRESH_PROVIDER_PHASE_V1,
    artifacts: recovered.artifacts,
  });
  if (
    replay.resolution !== "replayed" ||
    replay.state.revision !== recovered.revision ||
    !exactCanonicalEqualV1(replay.state.artifacts, recovered.artifacts)
  ) {
    throw new TypeError("Provider refresh recovery replay was not exact");
  }
  return replay.resolution;
}

async function assertLatestProviderRefreshCutV1(
  provider: ProviderProductionStrongObjectClientV1,
  identity: SafeGitRepositoryIdentityInspectionV1,
  cut: StrongRefreshCutV1,
  finalizedProviderRevision: number,
): Promise<void> {
  const latest = await provider.inspectStrongRefreshAuthority(
    identity.repositoryId,
    identity.worktreeId,
  );
  const authority = latest.authority;
  if (
    authority === undefined ||
    latest.observedProviderRevision < finalizedProviderRevision ||
    authority.finalizedProviderRevision !== finalizedProviderRevision ||
    authority.snapshotId !== cut.snapshotArtifact.payload.snapshotId ||
    authority.snapshotContentDigest !== cut.snapshotArtifact.contentDigest ||
    authority.pulseContentDigest !== cut.pulseArtifact.contentDigest
  ) {
    throw new TypeError(
      "Provider refresh authority changed before local publication",
    );
  }
}

function mapIndexFailureV1(error: RepositoryIndexError): never {
  if (/symlink|symbolic link|escaped/u.test(error.message)) {
    denySourceV1("symlink_escape");
  }
  if (/exceeds/u.test(error.message)) denySourceV1("too_large");
  if (/UTF|control|secret|sensitive|special|changed kind|changed/u.test(
    error.message,
  )) {
    denySourceV1("redacted");
  }
  throw new ToolFailure(repositoryNotReadyFailure(
    "error",
    ["knowledge_graph", "wiki_index"],
    "repair_environment",
  ));
}

export async function strongRefreshIndexV1(
  input: StrongRefreshInputV1,
  canonicalRoot: string,
  canonicalInstallationRoot: string,
  canonicalHostInstallationRoot: string,
): Promise<unknown> {
  const startedAt = performance.now();
  const startedIso = new Date().toISOString();
  let provider: ProviderProductionStrongObjectClientV1;
  try {
    provider = await openProviderProductionStrongObjectClientV1({
      canonicalInstallationRoot,
    });
  } catch (error) {
    if (isProviderProductionStrongObjectUnavailableErrorV1(error)) {
      throw new ToolFailure(strongStoreUnavailableFailure());
    }
    throw error;
  }
  try {
    const requestDigest = sha256CanonicalJson({
      operation: "refresh_index",
      mode: input.mode,
      expectedSourceSnapshotId: input.expectedSourceSnapshotId ?? null,
      actor: input.actor,
      ...(input.knowledge === undefined ? {} : { knowledge: input.knowledge }),
    });
    const idempotencyKeyDigest = sha256CanonicalJson({
      domain: "refresh-index-idempotency-key-v1",
      key: input.idempotencyKey,
    });
    const candidate = await bootstrapSafeGitDescriptorBoundCandidateV1(
      canonicalRoot,
    );
    let identity: SafeGitRepositoryIdentityInspectionV1;
    let capture: RepositorySnapshotCapture | undefined;
    let safeGitInspection: unknown;
    let store: ArtifactStore;
    let previousManifest: Awaited<ReturnType<typeof readManifestV1>>;
    let localSnapshot: StrongSnapshotArtifactV1 | undefined;
    let currentSnapshot: StrongSnapshotArtifactV1 | undefined;
    let localPulse: StrongPulseArtifactV1 | undefined;
    let currentPulse: StrongPulseArtifactV1 | undefined;
    let providerRefreshObservation: ObservedProviderRefreshAuthorityV1;
    let recovered: RecoveredProviderCutV1 | undefined;
    let requiresRecoveredColdBaseline = false;
    let indexPreflight:
      | Awaited<ReturnType<typeof preflightRepositoryIndex>>
      | undefined;
    try {
      await candidate.capability.bindRepositoryControl();
      identity = await candidate.capability.bindRepositoryIdentity();
      await candidate.capability.bindEmptyHooksDirectory();
      await candidate.capability.bindGitExecutable(
        PRODUCTION_SAFE_GIT_EXECUTABLE_V1,
      );
      await candidate.capability.executeGitVersion();
      providerRefreshObservation = await observeProviderRefreshAuthorityV1(
        provider,
        identity,
      );
      currentSnapshot = providerRefreshObservation.cut?.snapshotArtifact;
      currentPulse = providerRefreshObservation.cut?.pulseArtifact;
      recovered = input.knowledge?.action === "stage" ? undefined : await probeRecoveredProviderCutV1(
        provider,
        requestDigest,
        idempotencyKeyDigest,
        undefined,
        providerRefreshObservation,
      );
      if (recovered !== undefined) {
        await assertProviderAuthenticatedSnapshotV1(
          provider,
          identity,
          recovered.snapshotArtifact.payload,
        );
      }
      store = await ArtifactStore.open(canonicalRoot, {
        repositoryId: identity.repositoryId,
        worktreeId: identity.worktreeId,
        producerVersion: PRODUCT_VERSION,
      });
      previousManifest = await readManifestV1(store);
      localSnapshot = await readStrongSnapshotV1(
        store,
        previousManifest?.latestSnapshotId,
      );
      if (
        previousManifest?.latestSnapshotId !== undefined &&
        localSnapshot === undefined
      ) {
        throw new TypeError("Published refresh baseline Snapshot is unavailable or not strong");
      }
      localPulse = await readStrongPulseV1(store);
      if (
        localPulse !== undefined &&
        localPulse.sourceSnapshotId !== localSnapshot?.payload.snapshotId
      ) {
        const authenticatedRepairCut = recovered ??
          providerRefreshObservation.cut;
        const recoverableSnapshotOnlyCommit =
          authenticatedRepairCut !== undefined &&
          localSnapshot !== undefined &&
          exactCanonicalEqualV1(
            localSnapshot,
            authenticatedRepairCut.snapshotArtifact,
          ) &&
          authenticatedRepairCut.pulseArtifact.payload.baselineSnapshotId ===
            localPulse.sourceSnapshotId;
        if (!recoverableSnapshotOnlyCommit) {
          throw new TypeError(
            "Published local refresh Pulse does not match its Snapshot",
          );
        }
      }
      if (currentSnapshot === undefined) {
        const providerHead = await provider.inspectBusinessHead();
        if (
          providerHead.revision !== 0 ||
          providerHead.phase !== "strong_business_uninitialized_v1" ||
          Object.keys(providerHead.artifacts).length !== 0
        ) {
          requiresRecoveredColdBaseline = true;
        }
      } else {
        if (
          localSnapshot?.payload.snapshotId === currentSnapshot.payload.snapshotId &&
          !exactCanonicalEqualV1(localSnapshot, currentSnapshot)
        ) {
          throw new TypeError("Local refresh Snapshot conflicts with Provider authority");
        }
      }
      if (currentSnapshot === undefined && localSnapshot !== undefined) {
        throw new TypeError(
          "A local strong Snapshot has no latest Provider refresh authority",
        );
      }
      if (
        recovered === undefined &&
        input.expectedSourceSnapshotId !== undefined &&
        currentSnapshot?.payload.snapshotId !== input.expectedSourceSnapshotId
      ) {
        throw new ToolFailure(
          artifactUnavailableFailure("stale", "repository_snapshot"),
        );
      }
      {
        const baselineRef = currentSnapshot?.payload.headState.kind === "commit"
          ? currentSnapshot.payload.headState.commit
          : undefined;
        const snapshotOptions = baselineRef === undefined ? {} : { baselineRef };
        const before =
          await getRepositorySnapshotDetailedWithSafeGitCapabilityV1(
            canonicalRoot,
            candidate.capability,
            snapshotOptions,
          );
        if (
          before.canonicalRoot !== canonicalRoot ||
          before.snapshot.captureStatus !== "complete" ||
          before.snapshot.limitations.length !== 0
        ) {
          failCaptureV1(before);
        }
        await preflightChangedSourcesV1(
          canonicalRoot,
          before,
          candidate.capability.createReadExecutor(),
        );
        if (input.mode === "full") {
          try {
            indexPreflight = await preflightRepositoryIndex(canonicalRoot);
          } catch (error) {
            if (error instanceof RepositoryIndexError) mapIndexFailureV1(error);
            throw error;
          }
        }
        const after =
          await getRepositorySnapshotDetailedWithSafeGitCapabilityV1(
            canonicalRoot,
            candidate.capability,
            snapshotOptions,
          );
        assertStableCompleteCaptureV1(canonicalRoot, before, after);
        const manifestAfterCapture = await readManifestV1(store);
        const localSnapshotAfterCapture = await readStrongSnapshotV1(
          store,
          manifestAfterCapture?.latestSnapshotId,
        );
        const pulseAfterCapture = await readStrongPulseV1(store);
        if (
          previousManifest?.latestSnapshotId !==
            manifestAfterCapture?.latestSnapshotId ||
          !optionalExactCanonicalEqualV1(
            localSnapshot,
            localSnapshotAfterCapture,
          ) ||
          !optionalExactCanonicalEqualV1(localPulse, pulseAfterCapture)
        ) {
          throw new ToolFailure(
            artifactUnavailableFailure("stale", "repository_snapshot"),
          );
        }
        safeGitInspection = await candidate.capability.revalidate();
        capture = before;
      }
    } finally {
      await candidate.capability.close();
    }

    const capturedSnapshot = await buildStrongSnapshotV1(
      provider,
      identity,
      safeGitInspection,
      capture!,
      capture!.snapshot.createdAt,
    );
    if (recovered !== undefined) {
      assertRecoveredSnapshotMatchesCurrentAbsoluteStateV1(
        recovered.snapshotArtifact.payload,
        capturedSnapshot,
      );
    }
    const provisionalSnapshot = recovered?.snapshotArtifact.payload ??
      capturedSnapshot;
    const semanticDigest = sha256CanonicalJson(
      snapshotSemanticV1(provisionalSnapshot),
    );
    if (recovered?.publicationStatus === "finalized") {
      const authority = providerRefreshObservation.authority;
      if (
        authority === undefined ||
        authority.finalizedProviderRevision !== recovered.revision ||
        authority.snapshotId !== recovered.snapshotArtifact.payload.snapshotId ||
        authority.snapshotContentDigest !== recovered.snapshotArtifact.contentDigest ||
        authority.pulseContentDigest !== recovered.pulseArtifact.contentDigest ||
        !exactCanonicalEqualV1(authority.cutObject, recovered.artifacts["cutObject"])
      ) {
        throw new TypeError(
          "Recovered Provider refresh head is not the latest refresh authority",
        );
      }
    }
    if (requiresRecoveredColdBaseline && recovered === undefined) {
      throw new TypeError(
        "A cold local Store has no matching authenticated Provider recovery cut",
      );
    }

    let cut: StrongRefreshCutV1;
    if (recovered !== undefined) {
      const compatiblePulseRevision = currentPulse === undefined
        ? true
        : exactCanonicalEqualV1(currentPulse, recovered.pulseArtifact) ||
          recovered.pulseArtifact.revision === currentPulse.revision + 1;
      if (!compatiblePulseRevision) {
        throw new TypeError(
          "Provider refresh recovery conflicts with the local Pulse revision",
        );
      }
      cut = recovered;
    } else {
      const snapshot = currentSnapshot !== undefined &&
          sha256CanonicalJson(snapshotSemanticV1(currentSnapshot.payload)) ===
            semanticDigest
        ? currentSnapshot.payload
        : provisionalSnapshot;
      const snapshotArtifact = currentSnapshot !== undefined &&
          currentSnapshot.payload.snapshotId === snapshot.snapshotId
        ? currentSnapshot
        : strongSnapshotArtifactV1(snapshot);
      const baselineSnapshotId =
        currentSnapshot?.payload.snapshotId === undefined ||
          currentSnapshot.payload.snapshotId === snapshot.snapshotId
          ? undefined
          : currentSnapshot.payload.snapshotId;
      const pulse = buildStrongPulseV1(
        snapshot,
        input.mode,
        baselineSnapshotId,
        snapshot.createdAt,
      );
      const pulseArtifact = strongPulseArtifactV1(
        pulse,
        snapshot,
        currentPulse === undefined ? 0 : currentPulse.revision + 1,
      );
      cut = { snapshotArtifact, pulseArtifact };
    }

    let storePublication: Readonly<{
      snapshotReplayed: boolean;
      pulseReplayed: boolean;
      publishedSnapshot: StrongSnapshotArtifactV1;
      publishedPulse: StrongPulseArtifactV1;
    }> | undefined;
    const publishStoreCut = async (): Promise<void> => {
      if (previousManifest === undefined) previousManifest = await store.initialize();
      const snapshotResult = await store.persistArtifact(cut.snapshotArtifact);
      let pulseReplayed = false;
      if (
        localPulse !== undefined &&
        pulseArtifactSemanticEqualV1(localPulse, cut.pulseArtifact)
      ) {
        pulseReplayed = true;
      } else {
        // Provider revision is the semantic Pulse chain. Local revision is
        // only the ArtifactStore CAS sequence and may lag or start cold.
        const localPulseArtifact = withLocalPulseRevisionV1(
          cut.pulseArtifact,
          localPulse === undefined ? 0 : localPulse.revision + 1,
        );
        const pulseResult = await store.persistArtifact(localPulseArtifact, {
          ...(localPulse === undefined
            ? {}
            : { expectedRevision: localPulse.revision }),
          idempotencyKey: input.idempotencyKey,
          requestDigest,
        });
        pulseReplayed = pulseResult.replayed;
      }
      const publishedSnapshot = await readStrongSnapshotV1(store, cut.snapshotArtifact.sourceSnapshotId);
      const publishedPulse = await readStrongPulseV1(store);
      const publishedManifest = await store.readManifest();
      if (publishedSnapshot === undefined || publishedPulse === undefined ||
        publishedManifest.latestSnapshotId !== cut.snapshotArtifact.sourceSnapshotId ||
        !exactCanonicalEqualV1(publishedSnapshot, cut.snapshotArtifact) ||
        !pulseArtifactSemanticEqualV1(publishedPulse, cut.pulseArtifact)) {
        throw new TypeError("Published strong refresh cut does not match Provider authority");
      }
      parseTrustedStrongRepoPulseV1(publishedPulse.payload, publishedSnapshot.payload, digestCanonicalJsonV1);
      storePublication = {
        snapshotReplayed: snapshotResult.replayed,
        pulseReplayed,
        publishedSnapshot,
        publishedPulse,
      };
    };

    let providerResolution: "committed" | "replayed";
    let publishedProviderRevision: number | undefined;
    let knowledgeResult: ReturnType<typeof RefreshIndexOutputV1Schema.parse>["structuredContent"]["result"]["knowledge"];
    if (input.mode === "full") {
      const indexOperationId = operationNonceV1({
        domain: "strong-refresh-index-staging-v1",
        requestDigest,
        idempotencyKeyDigest,
        semanticDigest,
        snapshotContentDigest: cut.snapshotArtifact.contentDigest,
        pulseContentDigest: cut.pulseArtifact.contentDigest,
      });
      const stagedIndex = {
        canonicalRoot,
        canonicalInstallationRoot: canonicalHostInstallationRoot,
        operationId: indexOperationId,
      };
      let primaryFailure: unknown;
      let finalizedProviderRevision =
        recovered?.publicationStatus === "finalized"
          ? recovered.revision
          : undefined;
      try {
        if (input.knowledge === undefined && recovered === undefined) {
          const publishedAuthority = await provider.inspectIndexPublicationAuthority();
          if (publishedAuthority !== undefined) {
            const active = await openActiveRepositoryIndexV1(canonicalRoot);
            if (!exactCanonicalEqualV1({ ...active.generation, ...active.authority }, publishedAuthority)) {
              throw new ToolFailure(artifactUnavailableFailure("stale", "task_knowledge"));
            }
            if (active.knowledgeLineage?.status === "published") {
              throw new ToolFailure(artifactUnavailableFailure("stale", "task_knowledge"));
            }
          }
        }
        if (input.knowledge !== undefined &&
          (currentSnapshot === undefined || currentPulse === undefined ||
            cut.snapshotArtifact.sourceSnapshotId !== currentSnapshot.sourceSnapshotId ||
            input.expectedSourceSnapshotId !== currentSnapshot.sourceSnapshotId)) {
          throw new ToolFailure(artifactUnavailableFailure("stale", "task_knowledge"));
        }
        const knowledge = input.knowledge === undefined ? undefined : await prepareTaskKnowledgeV1({
          knowledge: input.knowledge, store, provider, canonicalRoot,
          snapshot: cut.snapshotArtifact.payload,
          sourceInventoryDigest: indexPreflight!.sourceInventoryDigest,
          requestDigest: requestDigest as `sha256:${string}`,
          idempotencyKeyDigest: idempotencyKeyDigest as `sha256:${string}`,
          observedProviderRevision: providerRefreshObservation.observedProviderRevision,
          ...(recovered?.indexGeneration === undefined ? {} : {
            recoveredGenerationId: recovered.indexGeneration.generationId,
          }),
        });
        const reconstructed = await buildRepositoryIndex({
          ...stagedIndex,
          snapshot: cut.snapshotArtifact.payload,
          expectedSourceInventoryDigest: indexPreflight!.sourceInventoryDigest,
          ...(knowledge === undefined ? {} : {
            knowledgeLineage: knowledge.action === "stage" ? knowledge.knowledgeLineage : knowledge.candidate.knowledgeLineage,
          }),
        });
        if (knowledge?.action === "publish" &&
          !exactCanonicalEqualV1(reconstructed.generation, knowledge.candidate.generation)) {
          // A candidate's self-digest is not source authority. Reconstruct the
          // deterministic generation from the captured source, then promote
          // only the original candidate bytes if the complete binding matches.
          throw new ToolFailure(artifactUnavailableFailure("corrupt", "task_knowledge"));
        }
        const built = knowledge?.action === "publish" ? knowledge : reconstructed;
        const indexGeneration = built.generation;
        if (knowledge?.action === "stage") {
          // Staging is deliberately before any Provider prepare/finalize or
          // Store publication. The previously published cut remains readable.
          await savePendingRepositoryIndexV1({ canonicalRoot, ...built });
          storePublication = {
            snapshotReplayed: true, pulseReplayed: true,
            publishedSnapshot: currentSnapshot!, publishedPulse: currentPulse!,
          };
          providerResolution = "replayed";
          knowledgeResult = {
            status: "pending", candidateGenerationId: indexGeneration.generationId,
            generationId: indexGeneration.generationId,
            taskId: knowledge.knowledgeLineage.taskId,
            taskRevision: knowledge.knowledgeLineage.taskRevision,
            sourceSnapshotId: currentSnapshot!.sourceSnapshotId,
          };
        } else {
          if (
            recovered?.indexGeneration !== undefined &&
            !exactCanonicalEqualV1(
              recovered.indexGeneration,
              indexGeneration,
            )
          ) {
            throw new TypeError(
              "Recovered Provider cut binds a different index generation",
            );
          }
          if (recovered === undefined) {
            const prepared = await commitProviderCutV1(
              provider,
              cut,
              requestDigest,
              idempotencyKeyDigest,
              semanticDigest,
              "full",
              providerRefreshObservation,
              indexGeneration,
            );
            const finalized = await finalizeFullProviderCutV1(
              provider,
              cut,
              prepared.cutObject,
              requestDigest,
              idempotencyKeyDigest,
              semanticDigest,
              indexGeneration,
              providerRefreshObservation.authority,
              prepared,
            );
            finalizedProviderRevision = finalized.finalizedProviderRevision;
            publishedProviderRevision = finalized.finalizedProviderRevision;
            providerResolution = prepared.resolution;
          } else if (recovered.publicationStatus === "prepared") {
            if (recovered.indexGeneration === undefined) {
              throw new TypeError(
                "Recovered prepared Provider cut has no index generation binding",
              );
            }
            const recoveredCutObject =
              ProviderRuntimeIpcFixedObjectLocatorV1Schema.parse(
                recovered.artifacts["cutObject"],
              );
            const finalized = await finalizeFullProviderCutV1(
              provider,
              cut,
              recoveredCutObject,
              requestDigest,
              idempotencyKeyDigest,
              semanticDigest,
              indexGeneration,
              providerRefreshObservation.authority,
              {
                preparedRevision: recovered.revision,
                preparedOperationNonce: recovered.operationNonce,
                preparedArtifacts: recovered.artifacts,
              },
            );
            finalizedProviderRevision = finalized.finalizedProviderRevision;
            publishedProviderRevision = finalized.finalizedProviderRevision;
            providerResolution = finalized.resolution;
          } else {
            if (recovered.indexGeneration === undefined) {
              throw new TypeError(
                "Recovered full Provider cut has no index generation binding",
              );
            }
            providerResolution = await replayRecoveredProviderCutV1(
              provider,
              recovered,
            );
            const recoveredAuthority = await provider.inspectIndexPublicationAuthority();
            if (recoveredAuthority === undefined ||
              recoveredAuthority.generationId !== indexGeneration.generationId ||
              recoveredAuthority.generationManifestDigest !== indexGeneration.generationManifestDigest ||
              recoveredAuthority.sourceInventoryDigest !== indexGeneration.sourceInventoryDigest ||
              recoveredAuthority.sourceSnapshotId !== cut.snapshotArtifact.payload.snapshotId ||
              recoveredAuthority.finalizedProviderRevision !== recovered.revision) {
              throw new TypeError("Recovered Provider cut has no exact index authority");
            }
            finalizedProviderRevision = recoveredAuthority.finalizedProviderRevision;
            publishedProviderRevision = recoveredAuthority.finalizedProviderRevision;
          }
          if (finalizedProviderRevision === undefined) {
            throw new TypeError("Full Provider cut has no finalized revision");
          }
          await assertLatestProviderRefreshCutV1(
            provider,
            identity,
            cut,
            finalizedProviderRevision,
          );
          await publishStagedRepositoryIndex({
            ...stagedIndex,
            generation: indexGeneration,
            publication: built.publication,
            authority: {
              sourceSnapshotId: cut.snapshotArtifact.payload.snapshotId,
              finalizedProviderRevision,
            },
            publishStoreCut,
          });
          if (knowledge?.action === "publish") {
            knowledgeResult = {
              status: "published", candidateGenerationId: knowledge.candidate.generation.generationId,
              generationId: indexGeneration.generationId,
              taskId: knowledge.knowledgeLineage.taskId,
              taskRevision: knowledge.knowledgeLineage.taskRevision,
              sourceSnapshotId: cut.snapshotArtifact.sourceSnapshotId,
            };
          }
        }
      } catch (error) {
        primaryFailure = error;
        if (error instanceof RepositoryIndexError && error.existingRequestDigest !== undefined) {
          throw new ToolFailure(idempotencyConflictFailure(
            input.idempotencyKey, requestDigest, error.existingRequestDigest,
          ));
        }
        if (error instanceof RepositoryIndexError) mapIndexFailureV1(error);
        throw error;
      } finally {
        try {
          await discardStagedRepositoryIndex(stagedIndex);
        } catch (cleanupError) {
          if (primaryFailure === undefined) throw cleanupError;
        }
      }
    } else if (recovered === undefined) {
      const committedIncremental = await commitProviderCutV1(
        provider,
        cut,
        requestDigest,
        idempotencyKeyDigest,
        semanticDigest,
        "incremental",
        providerRefreshObservation,
      );
      providerResolution = committedIncremental.resolution;
      publishedProviderRevision = committedIncremental.preparedRevision;
    } else {
      if (recovered.publicationStatus !== "finalized") {
        throw new TypeError("Incremental refresh cannot recover a prepared cut");
      }
      providerResolution = await replayRecoveredProviderCutV1(
        provider,
        recovered,
      );
      publishedProviderRevision = recovered.revision;
    }

    if (storePublication === undefined) {
      if (publishedProviderRevision === undefined) {
        throw new TypeError("Provider refresh has no publication revision");
      }
      await assertLatestProviderRefreshCutV1(
        provider,
        identity,
        cut,
        publishedProviderRevision,
      );
      await publishIncrementalStrongCutV1({
        canonicalRoot,
        providerRevision: publishedProviderRevision,
        sourceSnapshotId: cut.snapshotArtifact.payload.snapshotId,
        publishStoreCut,
      });
    }
    const completedStorePublication = storePublication;
    if (completedStorePublication === undefined || previousManifest === undefined) {
      throw new TypeError("Strong refresh Store publication did not complete");
    }
    const { snapshotReplayed, pulseReplayed, publishedSnapshot, publishedPulse } = completedStorePublication;

    const completedIso = new Date().toISOString();
    const operationId = "operation:refresh:" + operationNonceV1({
      requestDigest,
      snapshotId: publishedSnapshot.sourceSnapshotId,
    });
    const previousSnapshotId = previousManifest.latestSnapshotId;
    const snapshot = publishedSnapshot.payload;
    const pulse = publishedPulse.payload;
    return RefreshIndexOutputV1Schema.parse({
      isError: false,
      content: [{
        type: "text",
        text: knowledgeResult?.status === "pending"
          ? "Pending Task knowledge saved. Published Graph, Wiki, Snapshot, and Pulse are unchanged."
          : input.mode === "full"
          ? "Strong Repository Snapshot, Pulse, and compatible indexes published."
          : "Strong Repository Snapshot and Pulse published.",
      }],
      structuredContent: {
        schemaVersion: 1,
        meta: {
          repositoryId: snapshot.repositoryId,
          worktreeId: snapshot.worktreeId,
          sourceSnapshotId: snapshot.snapshotId,
          headCommit: snapshot.headState.kind === "commit"
            ? snapshot.headState.commit
            : null,
          worktreeFingerprint: digestBytesV1(snapshot.repositoryStateToken),
          freshness: pulse.status,
          durationMs: Math.max(0, performance.now() - startedAt),
          cacheHit: input.mode !== "full" &&
            providerResolution === "replayed" &&
            snapshotReplayed &&
            pulseReplayed,
          truncated: false,
          truncatedCategories: [],
        },
        result: {
          ...(knowledgeResult === undefined ? {} : { knowledge: knowledgeResult }),
          operation: {
            operationId,
            mode: input.mode,
            status: "completed",
            ...(previousSnapshotId === undefined ||
              previousSnapshotId === snapshot.snapshotId
              ? {}
              : { sourceSnapshotId: previousSnapshotId }),
            finalSnapshotId: snapshot.snapshotId,
            startedAt: startedIso,
            completedAt: completedIso,
            previousSnapshotPreservedUntilCommit: true,
            cancellation: {
              mechanism: "mcp_request_cancellation",
              notificationMethod: "notifications/cancelled",
              effect: "cooperative_stop_preserve_last_snapshot",
            },
          },
        },
      },
    });
  } finally {
    await provider.close();
  }
}
