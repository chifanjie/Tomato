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
  getRepositorySnapshotDetailedWithSafeGitCapabilityV1,
  isSensitiveRepositoryPath,
  readStableRepositoryFile,
  type RepositorySnapshotCapture,
  type SafeGitRepositoryIdentityInspectionV1,
} from "@understand-code/repository-state";

import { PRODUCT_VERSION } from "../constants.js";
import {
  ToolFailure,
  artifactUnavailableFailure,
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
  type RepositoryIndexGenerationBindingV1,
} from "../runtime/repository-indexer.js";

const PRODUCTION_SAFE_GIT_EXECUTABLE_V1 = "/opt/understand-code/bin/git";
const MAX_CHANGED_SOURCE_BYTES_V1 = 64 * 1024 * 1024;
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
  readonly indexGeneration?: RepositoryIndexGenerationBindingV1;
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

async function preflightChangedSourcesV1(
  canonicalRoot: string,
  capture: RepositorySnapshotCapture,
): Promise<void> {
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
    if (
      change.source === "committed" ||
      change.source === "staged" ||
      change.source === "conflict"
    ) {
      denySourceV1("redacted");
    }
    if (change.kind === "deleted") continue;

    let bytes: Buffer;
    try {
      bytes = await readStableRepositoryFile(
        canonicalRoot,
        change.path,
        MAX_CHANGED_SOURCE_BYTES_V1,
      );
    } catch (error) {
      const code = isRecordV1(error) ? error["code"] : undefined;
      if (code === "too_large") denySourceV1("too_large");
      denySourceV1("symlink_escape");
    }
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
  const securityScanPolicyDigest = sha256CanonicalJson({
    profile: "repository-source-security-scan-v1",
    maxChangedSourceBytes: MAX_CHANGED_SOURCE_BYTES_V1,
    pathPolicy: "repository-sensitive-path-v1",
    textPolicy: "fatal-utf8-no-control-v1",
    secretPolicy: "high-confidence-secret-signatures-v1",
  });
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

async function probeRecoveredProviderCutV1(
  provider: ProviderProductionStrongObjectClientV1,
  requestDigest: string,
  idempotencyKeyDigest: string,
  semanticDigest: string,
): Promise<RecoveredProviderCutV1 | undefined> {
  const inspected = await provider.inspectBusinessHead();
  const artifacts = inspected.artifacts;
  if (
    inspected.phase !== REFRESH_PROVIDER_PHASE_V1 ||
    artifacts["schemaVersion"] !== 1 ||
    artifacts["operation"] !== "refresh_index" ||
    artifacts["requestDigest"] !== requestDigest ||
    artifacts["idempotencyKeyDigest"] !== idempotencyKeyDigest ||
    artifacts["semanticDigest"] !== semanticDigest
  ) {
    return undefined;
  }
  const mode = artifacts["mode"];
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
  const cut = await readProviderCutObjectV1(provider, artifacts["cutObject"]);
  if (
    sha256CanonicalJson(snapshotSemanticV1(cut.snapshotArtifact.payload)) !==
      semanticDigest ||
    cut.pulseArtifact.sourceSnapshotId !== cut.snapshotArtifact.sourceSnapshotId
  ) {
    throw new TypeError("Provider refresh recovery cut is semantically invalid");
  }
  return {
    ...cut,
    revision: inspected.revision,
    operationNonce: inspected.operationNonce,
    artifacts,
    ...(indexGeneration === undefined ? {} : { indexGeneration }),
  };
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

async function commitProviderCutV1(
  provider: ProviderProductionStrongObjectClientV1,
  cut: StrongRefreshCutV1,
  requestDigest: string,
  idempotencyKeyDigest: string,
  semanticDigest: string,
  mode: "incremental" | "full",
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
  const inspected = await provider.inspectBusinessHead();
  const operationNonce = operationNonceV1({
    domain: mode === "full"
      ? "strong-refresh-index-prepare-v1"
      : "strong-refresh-index-commit-v1",
    expectedRevision: inspected.revision,
    idempotencyKeyDigest,
    requestDigest,
    semanticDigest,
    cutContentDigest: cutObject.contentDigest,
  });
  const committed = await provider.compareCommit({
    expectedRevision: inspected.revision,
    operationNonce,
    phase: REFRESH_PROVIDER_PHASE_V1,
    artifacts,
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
  const inspected = await provider.inspectBusinessHead();
  if (
    inspected.revision !== prepared.preparedRevision ||
    inspected.operationNonce !== prepared.preparedOperationNonce ||
    inspected.phase !== REFRESH_PROVIDER_PHASE_V1 ||
    !exactCanonicalEqualV1(
      inspected.artifacts,
      prepared.preparedArtifacts,
    )
  ) {
    throw new TypeError(
      "Provider refresh prepared head changed before full finalization",
    );
  }
  const operationNonce = operationNonceV1({
    domain: "strong-refresh-index-finalize-v1",
    expectedPreparedRevision: prepared.preparedRevision,
    idempotencyKeyDigest,
    requestDigest,
    semanticDigest,
    cutContentDigest: cutObject.contentDigest,
  });
  const finalized = await provider.compareCommitIndexPublication({
    expectedRevision: prepared.preparedRevision,
    operationNonce,
    phase: REFRESH_PROVIDER_PHASE_V1,
    artifacts,
    authority: {
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
  if (publicationAuthority === undefined ||
    publicationAuthority.finalizedProviderRevision !== finalized.state.revision ||
    publicationAuthority.generationId !== indexGeneration.generationId ||
    publicationAuthority.generationManifestDigest !== indexGeneration.generationManifestDigest ||
    publicationAuthority.sourceInventoryDigest !== indexGeneration.sourceInventoryDigest ||
    publicationAuthority.sourceSnapshotId !== cut.snapshotArtifact.payload.snapshotId) {
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
    const candidate = await bootstrapSafeGitDescriptorBoundCandidateV1(
      canonicalRoot,
    );
    let identity: SafeGitRepositoryIdentityInspectionV1;
    let capture: RepositorySnapshotCapture;
    let safeGitInspection: unknown;
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
      const before =
        await getRepositorySnapshotDetailedWithSafeGitCapabilityV1(
          canonicalRoot,
          candidate.capability,
        );
      if (
        before.canonicalRoot !== canonicalRoot ||
        before.snapshot.captureStatus !== "complete" ||
        before.snapshot.limitations.length !== 0
      ) {
        failCaptureV1(before);
      }
      await preflightChangedSourcesV1(canonicalRoot, before);
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
        );
      assertStableCompleteCaptureV1(canonicalRoot, before, after);
      safeGitInspection = await candidate.capability.revalidate();
      capture = before;
    } finally {
      await candidate.capability.close();
    }

    const store = await ArtifactStore.open(canonicalRoot, {
      repositoryId: identity.repositoryId,
      worktreeId: identity.worktreeId,
      producerVersion: PRODUCT_VERSION,
    });
    let previousManifest = await readManifestV1(store);
    if (
      input.expectedSourceSnapshotId !== undefined &&
      previousManifest?.latestSnapshotId !== input.expectedSourceSnapshotId
    ) {
      throw new ToolFailure(
        artifactUnavailableFailure("stale", "repository_snapshot"),
      );
    }

    const provisionalSnapshot = await buildStrongSnapshotV1(
      provider,
      identity,
      safeGitInspection,
      capture,
      capture.snapshot.createdAt,
    );
    const semanticDigest = sha256CanonicalJson(
      snapshotSemanticV1(provisionalSnapshot),
    );
    const requestDigest = sha256CanonicalJson({
      operation: "refresh_index",
      mode: input.mode,
      expectedSourceSnapshotId: input.expectedSourceSnapshotId ?? null,
      actor: input.actor,
    });
    const idempotencyKeyDigest = sha256CanonicalJson({
      domain: "refresh-index-idempotency-key-v1",
      key: input.idempotencyKey,
    });
    const currentSnapshot = await readStrongSnapshotV1(
      store,
      previousManifest?.latestSnapshotId,
    );
    const currentPulse = await readStrongPulseV1(store);
    const recovered = await probeRecoveredProviderCutV1(
      provider,
      requestDigest,
      idempotencyKeyDigest,
      semanticDigest,
    );

    let cut: StrongRefreshCutV1;
    if (recovered !== undefined) {
      const compatiblePulseRevision = currentPulse === undefined
        ? recovered.pulseArtifact.revision === 0
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
      let pulseArtifact: StrongPulseArtifactV1;
      if (
        currentPulse !== undefined &&
        currentPulse.sourceSnapshotId === snapshot.snapshotId &&
        (input.mode === "incremental" ||
          (currentPulse.payload.artifactFreshness.graph === "fresh" &&
            currentPulse.payload.artifactFreshness.wiki === "fresh"))
      ) {
        parseTrustedStrongRepoPulseV1(
          currentPulse.payload,
          snapshot,
          digestCanonicalJsonV1,
        );
        pulseArtifact = currentPulse;
      } else {
        const baselineSnapshotId =
          previousManifest?.latestSnapshotId === undefined ||
            previousManifest.latestSnapshotId === snapshot.snapshotId
            ? undefined
            : previousManifest.latestSnapshotId;
        const pulse = buildStrongPulseV1(
          snapshot,
          input.mode,
          baselineSnapshotId,
          snapshot.createdAt,
        );
        pulseArtifact = strongPulseArtifactV1(
          pulse,
          snapshot,
          currentPulse === undefined ? 0 : currentPulse.revision + 1,
        );
      }
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
      const pulseResult = await store.persistArtifact(cut.pulseArtifact, {
        ...(currentPulse === undefined ? {} : { expectedRevision: currentPulse.revision }),
        idempotencyKey: input.idempotencyKey,
        requestDigest,
      });
      const publishedSnapshot = await readStrongSnapshotV1(store, cut.snapshotArtifact.sourceSnapshotId);
      const publishedPulse = await readStrongPulseV1(store);
      const publishedManifest = await store.readManifest();
      if (publishedSnapshot === undefined || publishedPulse === undefined ||
        publishedManifest.latestSnapshotId !== cut.snapshotArtifact.sourceSnapshotId ||
        !exactCanonicalEqualV1(publishedSnapshot, cut.snapshotArtifact) ||
        !exactCanonicalEqualV1(publishedPulse, cut.pulseArtifact)) {
        throw new TypeError("Published strong refresh cut does not match Provider authority");
      }
      parseTrustedStrongRepoPulseV1(publishedPulse.payload, publishedSnapshot.payload, digestCanonicalJsonV1);
      storePublication = {
        snapshotReplayed: snapshotResult.replayed,
        pulseReplayed: pulseResult.replayed,
        publishedSnapshot,
        publishedPulse,
      };
    };

    let providerResolution: "committed" | "replayed";
    let publishedProviderRevision: number | undefined;
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
      let finalizedProviderRevision = recovered?.revision;
      try {
        const built = await buildRepositoryIndex({
          ...stagedIndex,
          snapshot: cut.snapshotArtifact.payload,
          expectedSourceInventoryDigest:
            indexPreflight!.sourceInventoryDigest,
        });
        const indexGeneration = built.generation;
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
            prepared,
          );
          finalizedProviderRevision = finalized.finalizedProviderRevision;
          publishedProviderRevision = finalized.finalizedProviderRevision;
          providerResolution = prepared.resolution;
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
      } catch (error) {
        primaryFailure = error;
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
      );
      providerResolution = committedIncremental.resolution;
      publishedProviderRevision = committedIncremental.preparedRevision;
    } else {
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
        text: input.mode === "full"
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
