import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  ArtifactStore,
  type ReadTaskBundleResult,
} from "@understand-code/artifact-store";
import {
  ChangeCheckV1Schema,
  ClaimV1Schema,
  EvidenceV1Schema,
  IdempotencyRecordV1Schema,
  InternalTaskBaselineV1Schema,
  KeyedStateTokenV1Schema,
  PathSafeRepositoryIdV1Schema,
  PathSafeRootIdentityV1Schema,
  PathSafeWorktreeIdV1Schema,
  RepoPulseArtifactV1Schema,
  RepositorySnapshotArtifactV1Schema,
  StrongRepoPulseV1Schema,
  StrongChangeCheckPreparationV1Schema,
  StrongChangeTaskProjectionV1Schema,
  StrongRepositorySnapshotV1Schema,
  StrongTaskBaselineCaptureOutcomeV1Schema,
  StrongVerificationPreparationV1Schema,
  TaskManifestV1Schema,
  TaskOperationReceiptV1Schema,
  VerificationRecordV1Schema,
  VerificationPlanEntryIdV1Schema,
  canonicalizeJson,
  derivePathSafeRepositoryChangeIdV1,
  derivePathSafeRepositorySnapshotIdV1,
  parseTrustedRepositorySnapshotArtifactV1,
  parseTrustedStrongRepoPulseV1,
  parseTrustedStrongRepositorySnapshotV1,
  type PersistedArtifactV1,
  type StrongChangeIntelligenceAuthorityV1,
  type StrongRepositorySnapshotV1,
} from "@understand-code/contracts";
import type {
  GraphEdge,
  GraphNode,
  KnowledgeGraph,
} from "@understand-code/core";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  buildTaskArtifacts,
  buildTaskEvent,
  deterministicTaskId,
  mutationResult,
  sha256CanonicalJson,
  executeStrongChangeCheckV1,
  executeStrongVerificationRecordV1,
  TaskEngine,
  type AuthorizationContext,
  type TaskContextProvider,
} from "../src/index.js";
import * as TaskEnginePackage from "../src/index.js";
import {
  applyTaskUpdate,
  rebuildTaskContext,
} from "../src/mutation.js";

const REPOSITORY_ID = "repository:fixture";
const WORKTREE_ID = "worktree:fixture";
const PRODUCER_VERSION = "3.0.0-alpha.1";
const ACTOR = "codex";
const FIXED_NOW = new Date("2026-07-29T08:00:00.000Z");
const CONCURRENT_BUILD_LOCK_TIMEOUT_MS = 10_000;
const SOURCE_DIGEST =
  "sha256:034be1c7304cd2d721eb758d60ae69c6115f11f1edca7b939e2dd0cebfbe3bc0";
const ALL_CAPABILITIES = [
  "task:create",
  "task:update",
  "task:confirm",
  "task:accept",
  "task:supersede",
] as const;

const STRONG_REPOSITORY_ID = PathSafeRepositoryIdV1Schema.parse(
  `repo-hmac-${"1".repeat(64)}`,
);
const STRONG_WORKTREE_ID = PathSafeWorktreeIdV1Schema.parse(
  `worktree-hmac-${"2".repeat(64)}`,
);
const STRONG_ROOT_IDENTITY = PathSafeRootIdentityV1Schema.parse(
  `root-hmac-${"3".repeat(64)}`,
);
const STRONG_REPOSITORY_STATE_TOKEN = KeyedStateTokenV1Schema.parse(
  `hmac-sha256:${"4".repeat(64)}`,
);
const STRONG_INDEX_TOKEN = KeyedStateTokenV1Schema.parse(
  `hmac-sha256:${"5".repeat(64)}`,
);
const STRONG_WORKTREE_TOKEN = KeyedStateTokenV1Schema.parse(
  `hmac-sha256:${"6".repeat(64)}`,
);
const STRONG_UNTRACKED_TOKEN = KeyedStateTokenV1Schema.parse(
  `hmac-sha256:${"7".repeat(64)}`,
);
const STRONG_IGNORE_TOKEN = KeyedStateTokenV1Schema.parse(
  `hmac-sha256:${"8".repeat(64)}`,
);

const temporaryRoots: string[] = [];

function node(
  id: string,
  name: string,
  filePath: string,
  overrides: Partial<GraphNode> = {},
): GraphNode {
  return {
    id,
    type: "function",
    name,
    filePath,
    lineRange: [1, 24],
    summary: `${name} owns persistent task lifecycle behavior`,
    tags: [],
    complexity: "moderate",
    ...overrides,
  };
}

function edge(
  source: string,
  target: string,
  overrides: Partial<GraphEdge> = {},
): GraphEdge {
  return {
    source,
    target,
    type: "calls",
    direction: "forward",
    weight: 1,
    ...overrides,
  };
}

function graphFixture(): KnowledgeGraph {
  return {
    version: "1",
    project: {
      name: "task-engine-integration",
      languages: ["TypeScript"],
      frameworks: [],
      description: "Persistent Task Engine integration fixture",
      analyzedAt: "2026-07-29T00:00:00Z",
      gitCommitHash: "a".repeat(40),
    },
    nodes: [
      node("task-handler", "TaskHandler", "src/task.ts", {
        type: "class",
        tags: ["entry", "task"],
      }),
      node("task-update", "updateTask", "src/task-update.ts", {
        tags: ["mutation"],
      }),
      node("task-test", "Task lifecycle test", "test/task.test.ts", {
        tags: ["test"],
      }),
    ],
    edges: [
      edge("task-handler", "task-update"),
      edge("task-update", "task-test", { type: "tested_by" }),
    ],
    layers: [],
    tour: [],
  };
}

type ContextLoader = Pick<
  TaskContextProvider,
  "loadTaskContext" | "analyzeTaskChanges"
>;

const contextProvider: ContextLoader = {
  async loadTaskContext() {
    return {
      graph: graphFixture(),
      existingFilePaths: [
        "src/task.ts",
        "src/task-update.ts",
        "test/task.test.ts",
      ],
      sourceEvidence: [
        {
          nodeId: "task-handler",
          filePath: "src/task.ts",
          lineRange: [1, 24],
          contentHash: SOURCE_DIGEST,
          kind: "source",
        },
      ],
    };
  },
};

function bindContextProvider(
  store: ArtifactStore,
  loader: ContextLoader,
): TaskContextProvider {
  const analyzer = loader.analyzeTaskChanges;
  return {
    binding: {
      schemaVersion: 1,
      kind: "canonical_worktree_root",
      canonicalRoot: store.layout.worktreeRoot,
    },
    loadTaskContext(input) {
      return loader.loadTaskContext(input);
    },
    ...(analyzer === undefined
      ? {}
      : {
          analyzeTaskChanges(input) {
            return analyzer.call(loader, input);
          },
        }),
  };
}

function auth(
  capabilities: AuthorizationContext["capabilities"] = ALL_CAPABILITIES,
  actor = ACTOR,
): AuthorizationContext {
  return {
    actor,
    repositoryId: REPOSITORY_ID,
    worktreeId: WORKTREE_ID,
    capabilities,
  };
}

async function loadFixture(
  name: "repository-snapshot.json" | "repo-pulse.json",
): Promise<PersistedArtifactV1> {
  const url = new URL(
    `../../contracts/fixtures/v1/reference/${name}`,
    import.meta.url,
  );
  return JSON.parse(await readFile(url, "utf8")) as PersistedArtifactV1;
}

function digestCanonicalJson(canonicalJson: string): string {
  return `sha256:${createHash("sha256")
    .update(canonicalJson, "utf8")
    .digest("hex")}`;
}

function strongSnapshotFixture(): StrongRepositorySnapshotV1 {
  const changeFields = {
    path: "src/path-safe.ts",
    source: "staged",
    kind: "modified",
    contentDigest: `sha256:${"a".repeat(64)}`,
    previousContentDigest: `sha256:${"b".repeat(64)}`,
  } as const;
  const change = {
    id: derivePathSafeRepositoryChangeIdV1(
      changeFields,
      digestCanonicalJson,
    ),
    ...changeFields,
  };
  const draft = StrongRepositorySnapshotV1Schema.parse({
    schemaVersion: 1,
    profile: "repository_snapshot_path_safe_v1",
    snapshotId: `snapshot-${"0".repeat(64)}`,
    repositoryId: STRONG_REPOSITORY_ID,
    worktreeId: STRONG_WORKTREE_ID,
    rootIdentity: STRONG_ROOT_IDENTITY,
    branchState: { status: "safe", name: "feature/path-safe-contracts" },
    objectFormat: "sha1",
    headState: { kind: "commit", commit: "1".repeat(40) },
    repositoryStateToken: STRONG_REPOSITORY_STATE_TOKEN,
    indexToken: STRONG_INDEX_TOKEN,
    worktreeToken: STRONG_WORKTREE_TOKEN,
    untrackedToken: STRONG_UNTRACKED_TOKEN,
    ignoreToken: STRONG_IGNORE_TOKEN,
    securityScanPolicyDigest: `sha256:${"9".repeat(64)}`,
    safeGitExecutionDigest: `sha256:${"c".repeat(64)}`,
    createdAt: "2026-07-28T08:30:00Z",
    captureStatus: "complete",
    accounting: {
      rawLayerUnitCount: 1,
      candidateUnitCount: 1,
      safeChangeCount: 1,
      redactedKnownChangeCount: 0,
      unknownStateCount: 0,
    },
    changes: [change],
    redactedChanges: [],
    unknownStates: [],
  });
  return parseTrustedStrongRepositorySnapshotV1(
    {
      ...draft,
      snapshotId: derivePathSafeRepositorySnapshotIdV1(
        draft,
        digestCanonicalJson,
      ),
    },
    digestCanonicalJson,
  );
}

function strongPulseFixture(snapshot: StrongRepositorySnapshotV1) {
  const pulse = StrongRepoPulseV1Schema.parse({
    profile: "repo_pulse_path_safe_v1",
    evaluatedSnapshotId: snapshot.snapshotId,
    evaluatedSnapshotContentDigest: digestCanonicalJson(
      canonicalizeJson(snapshot),
    ),
    status: "fresh",
    artifactFreshness: {
      graph: "fresh",
      wiki: "fresh",
      evidence: "fresh",
      diff: "fresh",
      task: "fresh",
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
    changeSummary: {
      total: 1,
      bySource: {
        committed: 0,
        staged: 1,
        unstaged: 0,
        untracked: 0,
        conflict: 0,
      },
      byKind: {
        added: 0,
        modified: 1,
        deleted: 0,
        renamed: 0,
        copied: 0,
        type_changed: 0,
      },
    },
    security: {
      snapshotProfile: "repository_snapshot_path_safe_v1",
      safeChangeCount: 1,
      redactedChangeCount: 0,
      unknownStateCount: 0,
      redactionBoundaryCodes: [],
      uncertaintyCodes: [],
    },
    securityScanPolicyDigest: snapshot.securityScanPolicyDigest,
    safeGitExecutionDigest: snapshot.safeGitExecutionDigest,
    completeness: {
      parser: { status: "complete", coverage: 1, reasonCodes: [] },
      callGraph: { status: "complete", coverage: 1, reasonCodes: [] },
    },
    recommendedRefresh: "none",
    diagnosticCodes: [],
    evaluatedAt: "2026-07-28T08:31:00Z",
  });
  return parseTrustedStrongRepoPulseV1(
    pulse,
    snapshot,
    digestCanonicalJson,
  );
}

function strongSnapshotArtifact(snapshot: StrongRepositorySnapshotV1) {
  return parseTrustedRepositorySnapshotArtifactV1(
    {
      schemaVersion: 1,
      artifactType: "repository_snapshot",
      artifactId: `artifact:repository-snapshot:${snapshot.snapshotId}`,
      repositoryId: snapshot.repositoryId,
      worktreeId: snapshot.worktreeId,
      sourceSnapshotId: snapshot.snapshotId,
      revision: 0,
      producerVersion: PRODUCER_VERSION,
      createdAt: snapshot.createdAt,
      contentDigest: sha256CanonicalJson(snapshot),
      payload: snapshot,
    },
    digestCanonicalJson,
  );
}

function strongPulseArtifact(snapshot: StrongRepositorySnapshotV1) {
  const payload = strongPulseFixture(snapshot);
  return RepoPulseArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "repo_pulse",
    artifactId: "artifact:repo-pulse:path-safe-fixture",
    repositoryId: snapshot.repositoryId,
    worktreeId: snapshot.worktreeId,
    sourceSnapshotId: snapshot.snapshotId,
    revision: 0,
    producerVersion: PRODUCER_VERSION,
    createdAt: payload.evaluatedAt,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

function strongCreationAuthority(
  snapshot: StrongRepositorySnapshotV1,
  onCapture: () => void | Promise<void>,
): StrongChangeIntelligenceAuthorityV1 {
  return {
    async captureTaskBaseline(input) {
      await onCapture();
      const artifactId = `task-baseline:${"a".repeat(22)}`;
      const baseline = InternalTaskBaselineV1Schema.parse({
        profile: "task_baseline_v1",
        artifactId,
        materializationVersion: 1,
        taskId: input.taskId,
        repositoryId: snapshot.repositoryId,
        worktreeId: snapshot.worktreeId,
        captureSnapshotId: snapshot.snapshotId,
        baselineHead: snapshot.headState.kind === "commit"
          ? {
              status: "present",
              commit: snapshot.headState.commit,
              treeObjectId: "2".repeat(40),
              gitLease: {
                status: "pinned",
                leaseId: "lease:strong-task-creation",
                refName:
                  `refs/understand-code/task-baselines/${"a".repeat(22)}-${"b".repeat(32)}`,
                objectId: snapshot.headState.commit,
              },
            }
          : {
              status: "unborn",
              emptyTreeObjectId: snapshot.headState.emptyTreeObjectId,
            },
        repositoryStateToken: snapshot.repositoryStateToken,
        attributesDigest: `sha256:${"1".repeat(64)}`,
        scannerPolicyDigest: snapshot.securityScanPolicyDigest,
        repositoryPolicyDigest: `sha256:${"2".repeat(64)}`,
        safeGitExecutionDigest: snapshot.safeGitExecutionDigest,
        baselineMaterializationBudgetDigest: `sha256:${"3".repeat(64)}`,
        privateStoreQuotaPolicyDigest: `sha256:${"4".repeat(64)}`,
        captureStatus: "complete",
        paths: [],
        redactedUnits: { count: 0, boundaryIds: [] },
        boundaries: [],
      });
      return StrongTaskBaselineCaptureOutcomeV1Schema.parse({
        profile: "task_baseline_capture_outcome_v1",
        baseline,
        baselineSemanticDigest: `sha256:${"5".repeat(64)}`,
        baselineContentDigest: sha256CanonicalJson(baseline),
        snapshot,
        snapshotArtifactId:
          `artifact:repository-snapshot:${snapshot.snapshotId}`,
        snapshotContentDigest: sha256CanonicalJson(snapshot),
        idempotentReplay: false,
      });
    },
    async prepareCheck() {
      throw new Error("not used by strong Task creation");
    },
    async commitCheck() {
      throw new Error("not used by strong Task creation");
    },
    async prepareVerification() {
      throw new Error("not used by strong Task creation");
    },
    async commitVerification() {
      throw new Error("not used by strong Task creation");
    },
  };
}

function strongAnalysisBudgetFixture() {
  return {
    version: "change-analysis-budget-v1" as const,
    maxChangedFiles: 10,
    maxBytesPerFile: 10_000,
    maxTotalBytes: 100_000,
    maxLinesPerFile: 1_000,
    maxTotalLines: 10_000,
    maxEditWorkUnits: 100_000,
    maxHunksPerFile: 100,
    maxTotalHunks: 1_000,
    maxParserNodesPerFile: 10_000,
    maxTotalParserNodes: 100_000,
    maxMatchingWorkUnits: 100_000,
    maxImpactNodes: 1_000,
    maxImpactEdges: 10_000,
    maxImpactTraversalWorkUnits: 100_000,
    maxImpactPaths: 1_000,
    maxExcerptCharsPerEvidence: 1,
    maxTotalExcerptChars: 1,
    maxActualChanges: 1_000,
    maxEvidenceItems: 2_000,
    maxSymbolRefs: 2_000,
    maxSerializedArtifactBytes: 10_000_000,
  };
}

function strongAnalysisUsageFixture() {
  return {
    changedFiles: 0,
    analyzedFiles: 0,
    bytes: 0,
    lines: 0,
    editWorkUnits: 0,
    hunks: 0,
    parserNodes: 0,
    matchingWorkUnits: 0,
    impactNodes: 0,
    impactEdges: 0,
    impactTraversalWorkUnits: 0,
    impactPaths: 0,
    excerptChars: 0 as const,
    actualChanges: 0,
    evidenceItems: 0,
    symbolRefs: 0,
    serializedArtifactBytes: 0,
  };
}

async function openEmptyBoundStore(
  repositoryId: string,
  worktreeId: string,
): Promise<{ root: string; store: ArtifactStore }> {
  const root = await mkdtemp(path.join(tmpdir(), "task-engine-strong-profile-"));
  temporaryRoots.push(root);
  await Promise.all([
    mkdir(path.join(root, "src"), { recursive: true }),
    mkdir(path.join(root, "test"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(
      path.join(root, "src/task.ts"),
      "export class TaskHandler {}\n",
      "utf8",
    ),
    writeFile(
      path.join(root, "src/task-update.ts"),
      "export function updateTask() {}\n",
      "utf8",
    ),
    writeFile(
      path.join(root, "test/task.test.ts"),
      "export const taskLifecycleTest = true;\n",
      "utf8",
    ),
  ]);
  const store = await ArtifactStore.open(root, {
    repositoryId,
    worktreeId,
    producerVersion: PRODUCER_VERSION,
  });
  await store.initialize();
  return { root, store };
}

function authForStore(
  store: ArtifactStore,
  capabilities: AuthorizationContext["capabilities"] = ALL_CAPABILITIES,
): AuthorizationContext {
  return {
    actor: ACTOR,
    repositoryId: store.repositoryId,
    worktreeId: store.worktreeId,
    capabilities,
  };
}

async function legacySnapshotForBoundStore(
  store: ArtifactStore,
  snapshotId: string,
  headCommit = "1".repeat(40),
): Promise<PersistedArtifactV1> {
  const current = RepositorySnapshotArtifactV1Schema.parse(
    await loadFixture("repository-snapshot.json"),
  );
  const payload = {
    ...current.payload,
    snapshotId,
    repositoryId: store.repositoryId,
    worktreeId: store.worktreeId,
    rootIdentity: STRONG_ROOT_IDENTITY,
    branch: "feature/path-safe-contracts",
    headCommit,
  };
  return RepositorySnapshotArtifactV1Schema.parse({
    ...current,
    artifactId: `artifact:repository-snapshot:${snapshotId}`,
    repositoryId: store.repositoryId,
    worktreeId: store.worktreeId,
    sourceSnapshotId: snapshotId,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

async function legacyPulseForBoundStore(
  store: ArtifactStore,
  snapshotId: string,
  headCommit = "1".repeat(40),
): Promise<PersistedArtifactV1> {
  const current = RepoPulseArtifactV1Schema.parse(
    await loadFixture("repo-pulse.json"),
  );
  const payload = {
    ...current.payload,
    evaluatedSnapshotId: snapshotId,
    baselineSnapshotId: snapshotId,
    repositoryState: {
      ...current.payload.repositoryState!,
      rootIdentity: STRONG_ROOT_IDENTITY,
      branch: "feature/path-safe-contracts",
      headCommit,
    },
  };
  return RepoPulseArtifactV1Schema.parse({
    ...current,
    artifactId: "artifact:repo-pulse:path-safe-legacy-fixture",
    repositoryId: store.repositoryId,
    worktreeId: store.worktreeId,
    sourceSnapshotId: snapshotId,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

async function openStore(
  options: {
    publishPulse?: boolean;
    lockTimeoutMs?: number;
  } = {},
): Promise<{ root: string; store: ArtifactStore }> {
  const root = await mkdtemp(path.join(tmpdir(), "task-engine-integration-"));
  temporaryRoots.push(root);
  await Promise.all([
    mkdir(path.join(root, "src"), { recursive: true }),
    mkdir(path.join(root, "test"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(
      path.join(root, "src/task.ts"),
      "export class TaskHandler {}\n",
      "utf8",
    ),
    writeFile(
      path.join(root, "src/task-update.ts"),
      "export function updateTask() {}\n",
      "utf8",
    ),
    writeFile(
      path.join(root, "test/task.test.ts"),
      "export const taskLifecycleTest = true;\n",
      "utf8",
    ),
  ]);
  const store = await ArtifactStore.open(root, {
    repositoryId: REPOSITORY_ID,
    worktreeId: WORKTREE_ID,
    producerVersion: PRODUCER_VERSION,
    lock: {
      timeoutMs: options.lockTimeoutMs ?? 1_000,
      staleAfterMs: 5_000,
      pollMinMs: 1,
      pollMaxMs: 4,
    },
  });
  await store.initialize();
  await store.persistArtifact(
    await repositorySnapshot(
      "snapshot:baseline",
      "2026-07-28T08:11:00.000Z",
      "a".repeat(40),
    ),
  );
  await store.persistArtifact(await loadFixture("repository-snapshot.json"));
  if (options.publishPulse !== false) {
    await store.persistArtifact(await loadFixture("repo-pulse.json"));
  }
  return { root, store };
}

function engine(
  store: ArtifactStore,
  options: {
    contextProvider?: ContextLoader;
    clock?: () => Date;
  } = {},
): TaskEngine {
  return new TaskEngine(store, {
    contextProvider: bindContextProvider(
      store,
      options.contextProvider ?? contextProvider,
    ),
    clock: options.clock ?? (() => FIXED_NOW),
  });
}

function legacyContextRecoveryIntegrityHarness(
  store: ArtifactStore,
  onContextLoad: () => void,
) {
  return {
    async updateTask(
      input: Parameters<TaskEngine["updateTask"]>[0],
      _auth: AuthorizationContext,
    ) {
      return rebuildTaskContext(store, input, () => FIXED_NOW, async (current) => {
        onContextLoad();
        if (!("brief" in current.bundle)) {
          throw new TypeError("Legacy context recovery requires a contextual Task.");
        }
        const snapshotId = input.action.type === "refresh_task_context" ||
            input.action.type === "rebase_task"
          ? input.action.targetSnapshotId
          : current.bundle.manifest.latestSnapshotId;
        return {
          snapshotId,
          brief: current.bundle.brief,
          claims: current.bundle.claims.map((claim) => ClaimV1Schema.parse(claim)).map((claim) => ({
            ...claim,
            freshness: "current" as const,
            sourceSnapshotId: snapshotId,
          })),
          evidence: current.bundle.evidence.map((evidence) => EvidenceV1Schema.parse(evidence)).map((evidence) => ({
            ...evidence,
            freshness: "current" as const,
            observedAtSnapshotId: snapshotId,
          })),
          impactPaths: current.bundle.impactPaths,
        };
      });
    },
  };
}

async function expectStoreLocksReleased(
  store: ArtifactStore,
  taskId: string,
): Promise<void> {
  await Promise.all([
    expect(lstat(store.layout.taskLock(taskId))).rejects.toMatchObject({
      code: "ENOENT",
    }),
    expect(lstat(store.layout.repositoryLock)).rejects.toMatchObject({
      code: "ENOENT",
    }),
  ]);
}

async function reopenStore(root: string): Promise<ArtifactStore> {
  const store = await ArtifactStore.open(root, {
    repositoryId: REPOSITORY_ID,
    worktreeId: WORKTREE_ID,
    producerVersion: PRODUCER_VERSION,
  });
  await store.initialize();
  return store;
}

async function repositorySnapshot(
  snapshotId: string,
  createdAt: string,
  headCommit: string,
): Promise<PersistedArtifactV1> {
  const current = RepositorySnapshotArtifactV1Schema.parse(
    await loadFixture("repository-snapshot.json"),
  );
  const payload = {
    ...current.payload,
    snapshotId,
    headCommit,
    createdAt,
  };
  return RepositorySnapshotArtifactV1Schema.parse({
    ...current,
    artifactId: `artifact:repository-snapshot:${snapshotId}`,
    sourceSnapshotId: snapshotId,
    createdAt: payload.createdAt,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

async function advancedSnapshot(
  snapshotId = "snapshot:advanced-task-lifecycle",
): Promise<PersistedArtifactV1> {
  return repositorySnapshot(
    snapshotId,
    "2026-07-29T09:00:00.000Z",
    "b".repeat(40),
  );
}

async function publishPulseForSnapshot(
  store: ArtifactStore,
  snapshotId: string,
  headCommit: string,
): Promise<void> {
  const current = RepoPulseArtifactV1Schema.parse(
    await loadFixture("repo-pulse.json"),
  );
  const evaluatedAt = "2026-07-29T09:00:01.000Z";
  const payload = {
    ...current.payload,
    evaluatedSnapshotId: snapshotId,
    repositoryState: {
      ...current.payload.repositoryState!,
      headCommit,
    },
    evaluatedAt,
  };
  await store.persistArtifact(
    RepoPulseArtifactV1Schema.parse({
      ...current,
      revision: 1,
      sourceSnapshotId: snapshotId,
      createdAt: evaluatedAt,
      contentDigest: sha256CanonicalJson(payload),
      payload,
    }),
    {
      expectedRevision: 0,
      idempotencyKey: `pulse-for-${snapshotId}`,
      requestDigest: sha256CanonicalJson({
        operation: "publish_test_pulse",
        snapshotId,
      }),
    },
  );
}

function buildInput(idempotencyKey = "build-task-brief-1") {
  return {
    task: "Harden TaskHandler persistent lifecycle and its tests",
    expectedRevision: 0 as const,
    idempotencyKey,
    actor: ACTOR,
    tokenBudget: 8_000,
    maxCandidates: 20,
    maxImpactDepth: 4,
  };
}

async function expectContextReadyBundle(
  store: ArtifactStore,
  taskId: string,
): Promise<ReadTaskBundleResult> {
  const read = await store.readTaskBundle(taskId);
  expect(read.bundle.manifest).toMatchObject({
    taskId,
    status: "context_ready",
    revision: 2,
  });
  expect(read.bundle.events.map((event) => event.revision)).toEqual([1, 2]);
  expect(read.bundle.events.map((event) => event.action.type)).toEqual([
    "task_created",
    "transition_status",
  ]);
  expect(read.receipts.map((receipt) => receipt.operation)).toEqual([
    "task_created",
    "build_task_brief",
  ]);
  expect(read.bundle.idempotencyRecords).toHaveLength(2);
  expect(read.artifacts.map((artifact) => artifact.artifactType)).not.toContain(
    "change_check",
  );
  expect(read.artifacts.map((artifact) => artifact.artifactType)).not.toContain(
    "verification",
  );
  return read;
}

async function appendTrustedChangeCheck(
  store: ArtifactStore,
  taskId: string,
  options: { blocking?: boolean; empty?: boolean } = {},
): Promise<ReadTaskBundleResult> {
  const current = await store.readTaskBundle(taskId);
  if (!("brief" in current.bundle)) {
    throw new TypeError("A contextual Task is required for Change Check.");
  }
  const revision = current.bundle.manifest.revision + 1;
  const occurredAt = new Date(
    Date.parse(current.bundle.manifest.updatedAt) + 1,
  ).toISOString();
  const manifest = TaskManifestV1Schema.parse({
    ...current.bundle.manifest,
    revision,
    updatedAt: occurredAt,
  });
  const supportingEvidence = current.bundle.evidence.find(
    (item) =>
      item.epistemicStatus === "observed" &&
      item.freshness === "current",
  );
  if (supportingEvidence === undefined) {
    throw new TypeError("Observed Evidence is required for a Finding.");
  }
  const findingId = `finding:${taskId}:${revision}`;
  const findingClaim = ClaimV1Schema.parse({
    id: `claim:finding:${taskId}:${revision}`,
    taskId,
    kind: "finding",
    statement: "The trusted fixture captured a snapshot-bound Finding.",
    epistemicStatus: "observed",
    lifecycleStatus: "supported",
    freshness: "current",
    sourceSnapshotId: manifest.latestSnapshotId,
    evidenceIds: [supportingEvidence.id],
    findingIds: [findingId],
    verificationRecordIds: [],
    createdAt: occurredAt,
    updatedAt: occurredAt,
  });
  const changeCheck = ChangeCheckV1Schema.parse({
    schemaVersion: 1,
    id: `change-check:${taskId}:${revision}`,
    taskId,
    taskRevision: revision,
    baselineSnapshotId: manifest.baselineSnapshotId,
    actualSnapshotId: manifest.latestSnapshotId,
    findings: options.empty === true ? [] : [
      {
        id: findingId,
        type: "cannot_determine",
        severity: options.blocking === true ? "error" : "warning",
        blocking: options.blocking === true,
        summary: "The current Snapshot requires an explicit review.",
        claimIds: [findingClaim.id],
        plannedChangeIds: [],
        actualChangeIds: [],
        evidenceIds: [supportingEvidence.id],
        impactPathIds: [],
      },
    ],
    generatedAt: occurredAt,
  });
  const idempotencyKey = "record-trusted-change-check";
  const requestDigest = sha256CanonicalJson({
    operation: "check_change",
    taskId,
    actualSnapshotId: manifest.latestSnapshotId,
  });
  const event = buildTaskEvent({
    manifest,
    previousManifest: current.bundle.manifest,
    previousEvent: current.bundle.events.at(-1),
    action: {
      type: "change_checked",
      changeCheckArtifactId: `artifact:change_check:${taskId}`,
      changeCheckId: changeCheck.id,
    },
    actor: ACTOR,
    idempotencyKey,
    requestDigest,
    occurredAt,
  });
  const mutation = mutationResult(
    manifest,
    event,
    [
      ...current.artifacts.map((artifact) => artifact.artifactId),
      `artifact:change_check:${taskId}`,
    ],
  );
  const receiptResult = { changeCheck, mutation };
  const resultDigest = sha256CanonicalJson(receiptResult);
  const record = IdempotencyRecordV1Schema.parse({
    schemaVersion: 1,
    worktreeId: WORKTREE_ID,
    scope: { kind: "task", taskId },
    idempotencyKey,
    actor: ACTOR,
    requestDigest,
    taskId,
    resultRevision: revision,
    eventId: event.eventId,
    resultDigest,
    createdAt: occurredAt,
  });
  const receipt = TaskOperationReceiptV1Schema.parse({
    schemaVersion: 1,
    operation: "check_change",
    taskId,
    eventId: event.eventId,
    resultDigest,
    result: receiptResult,
  });
  const records = [...current.bundle.idempotencyRecords, record];
  const receipts = [...current.receipts, receipt];
  const evidence = current.bundle.evidence.map((item) =>
    item.id === supportingEvidence.id
      ? {
          ...item,
          claimIds: [...item.claimIds, findingClaim.id],
        }
      : item,
  );
  const artifacts = buildTaskArtifacts({
    manifest,
    brief: current.bundle.brief,
    claims:
      options.empty === true
        ? current.bundle.claims
        : [...current.bundle.claims, findingClaim],
    evidence: options.empty === true ? current.bundle.evidence : evidence,
    impactPaths: current.bundle.impactPaths,
    changeCheck,
    idempotencyRecords: records,
    receipts,
    createdAt: occurredAt,
  });
  await store.persistTaskBundle(
    {
      artifacts,
      events: [...current.bundle.events, event],
      idempotencyRecords: records,
    },
    {
      expectedRevision: current.bundle.manifest.revision,
      idempotencyKey,
      requestDigest,
    },
  );
  return store.readTaskBundle(taskId);
}

async function appendTrustedVerification(
  store: ArtifactStore,
  taskId: string,
  options: { status?: "passed" | "failed" | "skipped" } = {},
): Promise<ReadTaskBundleResult> {
  const current = await store.readTaskBundle(taskId);
  if (
    !("brief" in current.bundle) ||
    current.bundle.changeChecks.length === 0
  ) {
    throw new TypeError(
      "A contextual Task with a Change Check is required for Verification.",
    );
  }
  const planEntry = current.bundle.brief.verificationPlan[0];
  if (planEntry === undefined) {
    throw new TypeError("A Verification Plan entry is required.");
  }
  const verificationClaimId = planEntry.acceptanceClaimIds[0];
  if (
    verificationClaimId === undefined ||
    !current.bundle.claims.some((claim) => claim.id === verificationClaimId)
  ) {
    throw new TypeError("A Verification acceptance Claim is required.");
  }
  const revision = current.bundle.manifest.revision + 1;
  const occurredAt = new Date(
    Date.parse(current.bundle.manifest.updatedAt) + 1,
  ).toISOString();
  const manifest = TaskManifestV1Schema.parse({
    ...current.bundle.manifest,
    revision,
    updatedAt: occurredAt,
  });
  const verification = VerificationRecordV1Schema.parse({
    id: `verification:${taskId}:${revision}`,
    taskId,
    verificationPlanEntryId: planEntry.id,
    attempt: 1,
    kind: planEntry.method,
    status: options.status ?? "passed",
    ...(options.status === "skipped"
      ? {}
      : {
          command: "pnpm test",
          exitCode: options.status === "failed" ? 1 : 0,
        }),
    durationMs: 10,
    summary:
      options.status === "failed"
        ? "Trusted lifecycle fixture verification failed."
        : options.status === "skipped"
          ? "Trusted lifecycle fixture verification was skipped."
          : "Trusted lifecycle fixture verification passed.",
    claimIds: [verificationClaimId],
    snapshotId: manifest.latestSnapshotId,
    recordedAt: occurredAt,
    actor: ACTOR,
  });
  const idempotencyKey = "record-trusted-verification";
  const requestDigest = sha256CanonicalJson({
    operation: "record_verification",
    taskId,
    verificationRecordId: verification.id,
  });
  const event = buildTaskEvent({
    manifest,
    previousManifest: current.bundle.manifest,
    previousEvent: current.bundle.events.at(-1),
    action: {
      type: "verification_recorded",
      verificationRecordId: verification.id,
    },
    actor: ACTOR,
    idempotencyKey,
    requestDigest,
    occurredAt,
  });
  const mutation = mutationResult(
    manifest,
    event,
    [
      ...current.artifacts.map((artifact) => artifact.artifactId),
      `artifact:verification:${taskId}`,
    ],
  );
  const receiptResult = { verification, mutation };
  const resultDigest = sha256CanonicalJson(receiptResult);
  const record = IdempotencyRecordV1Schema.parse({
    schemaVersion: 1,
    worktreeId: WORKTREE_ID,
    scope: { kind: "task", taskId },
    idempotencyKey,
    actor: ACTOR,
    requestDigest,
    taskId,
    resultRevision: revision,
    eventId: event.eventId,
    resultDigest,
    createdAt: occurredAt,
  });
  const receipt = TaskOperationReceiptV1Schema.parse({
    schemaVersion: 1,
    operation: "record_verification",
    taskId,
    eventId: event.eventId,
    resultDigest,
    result: receiptResult,
  });
  const records = [...current.bundle.idempotencyRecords, record];
  const receipts = [...current.receipts, receipt];
  const claims = current.bundle.claims.map((claim) => ClaimV1Schema.parse(claim)).map((claim) =>
    claim.id === verificationClaimId
      ? {
          ...claim,
          verificationRecordIds: [
            ...claim.verificationRecordIds,
            verification.id,
          ],
        }
      : claim,
  );
  const artifacts = buildTaskArtifacts({
    manifest,
    brief: current.bundle.brief,
    claims,
    evidence: current.bundle.evidence,
    impactPaths: current.bundle.impactPaths,
    changeCheck: current.bundle.changeChecks.at(-1),
    verificationRecords: [
      ...current.bundle.verificationRecords,
      verification,
    ],
    idempotencyRecords: records,
    receipts,
    createdAt: occurredAt,
  });
  await store.persistTaskBundle(
    {
      artifacts,
      events: [...current.bundle.events, event],
      idempotencyRecords: records,
    },
    {
      expectedRevision: current.bundle.manifest.revision,
      idempotencyKey,
      requestDigest,
    },
  );
  return store.readTaskBundle(taskId);
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true })
    ),
  );
});

describe("TaskEngine persistent integration", () => {
  it("does not expose the internal mutation kernel from the package root", () => {
    expect(TaskEnginePackage).not.toHaveProperty("applyTaskUpdate");
  });

  it("publishes a real strong Task baseline and Context Generation from the production create path", async () => {
    const snapshot = strongSnapshotFixture();
    const { store } = await openEmptyBoundStore(
      snapshot.repositoryId,
      snapshot.worktreeId,
    );
    await store.persistArtifact(strongSnapshotArtifact(snapshot));
    await store.persistArtifact(strongPulseArtifact(snapshot));
    let captureCount = 0;
    let markerObservedBeforeCapture = false;
    const authority = strongCreationAuthority(snapshot, async () => {
      captureCount += 1;
      const markers = await readdir(path.join(
        store.layout.worktreeRoot,
        ".understand-code/.recovery/task-creation-intents",
      ));
      markerObservedBeforeCapture = markers.length === 1;
    });
    const taskEngine = new TaskEngine(store, {
      contextProvider: bindContextProvider(store, {
        async loadTaskContext() {
          return {
            graph: { ...graphFixture(), nodes: [], edges: [] },
            existingFilePaths: [],
          };
        },
      }),
      strongChangeAuthority: authority,
      clock: () => FIXED_NOW,
    });

    const result = await taskEngine.buildTaskBrief(
      buildInput("strong-production-create-path"),
      authForStore(store, ["task:create"]),
    );

    expect(captureCount).toBe(1);
    expect(markerObservedBeforeCapture).toBe(true);
    expect(result.task).toMatchObject({
      taskProfile: "agent_task_v1",
      taskBaselineArtifactId: `task-baseline:${"a".repeat(22)}`,
      baselineSnapshotId: snapshot.snapshotId,
      latestSnapshotId: snapshot.snapshotId,
      contextBuildSpec: {
        version: "context-build-spec-v1",
        scope: [],
        tokenBudget: 8_000,
        maxCandidates: 20,
        maxImpactDepth: 4,
      },
    });
    expect(result.task.contextGenerationId).toMatch(
      /^context-generation:[0-9a-f]{22}$/u,
    );
    expect(result.brief.contextGenerationId).toBe(
      result.task.contextGenerationId,
    );
    expect(result.brief.verificationPlan[0]?.id).toMatch(
      /^verification-plan:[0-9a-f]{22}$/u,
    );
    const persisted = await store.readTaskBundle(result.task.taskId);
    expect(
      await store.readStrongTaskCreationIntent(result.task.taskId),
    ).toBeUndefined();
    expect(persisted.bundle.events.at(-1)).toMatchObject({
      resultingContextGenerationId: result.task.contextGenerationId,
    });
  });

  it("fails closed when a strong creation marker's Snapshot has drifted", async () => {
    const snapshot = strongSnapshotFixture();
    const { store } = await openEmptyBoundStore(
      snapshot.repositoryId,
      snapshot.worktreeId,
    );
    await store.persistArtifact(strongSnapshotArtifact(snapshot));
    await store.persistArtifact(strongPulseArtifact(snapshot));

    const input = buildInput("strong-recovery-snapshot-drift");
    const taskId = deterministicTaskId({
      worktreeId: store.worktreeId,
      createScope: "build_task_brief",
      idempotencyKey: input.idempotencyKey,
    });
    const contextBuildSpec = {
      version: "context-build-spec-v1" as const,
      scope: [],
      tokenBudget: 8_000,
      maxCandidates: 20,
      maxImpactDepth: 4,
    };
    await store.persistStrongTaskCreationIntent({
      taskId,
      idempotencyKey: input.idempotencyKey,
      actor: input.actor,
      requestDigest: sha256CanonicalJson(input),
      snapshotId: snapshot.snapshotId,
      snapshotContentDigest: sha256CanonicalJson(snapshot),
      contextBuildSpec,
    });

    const driftDraft = StrongRepositorySnapshotV1Schema.parse({
      ...snapshot,
      headState: { kind: "commit", commit: "3".repeat(40) },
      createdAt: "2026-07-29T08:32:00Z",
    });
    const driftSnapshot = parseTrustedStrongRepositorySnapshotV1(
      {
        ...driftDraft,
        snapshotId: derivePathSafeRepositorySnapshotIdV1(
          driftDraft,
          digestCanonicalJson,
        ),
      },
      digestCanonicalJson,
    );
    await store.persistArtifact(strongSnapshotArtifact(driftSnapshot));

    let captureCount = 0;
    const taskEngine = new TaskEngine(store, {
      contextProvider: bindContextProvider(store, {
        async loadTaskContext() {
          return { graph: { ...graphFixture(), nodes: [], edges: [] }, existingFilePaths: [] };
        },
      }),
      strongChangeAuthority: strongCreationAuthority(snapshot, () => {
        captureCount += 1;
      }),
      clock: () => FIXED_NOW,
    });

    await expect(
      taskEngine.buildTaskBrief(input, authForStore(store, ["task:create"])),
    ).rejects.toMatchObject({
      code: "context_build_failed",
      message: expect.stringMatching(/recovery/i),
    });
    expect(captureCount).toBe(0);
    expect(await store.readStrongTaskCreationIntent(taskId)).toBeDefined();
  });

  it("runs the strong TaskBaseline to Delta to Check to Verification vertical", async () => {
    const snapshot = strongSnapshotFixture();
    const creation = strongCreationAuthority(snapshot, () => undefined);
    const contextBuildSpec = {
      version: "context-build-spec-v1" as const,
      scope: [],
      tokenBudget: 8_000,
      maxCandidates: 20,
      maxImpactDepth: 4,
    };
    const captured = await creation.captureTaskBaseline({
      profile: "capture_task_baseline_strong_v1",
      taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      snapshotId: snapshot.snapshotId,
      contextBuildSpec,
      idempotencyKey: "capture-baseline-once",
      actor: ACTOR,
    });
    const contextGenerationId = `context-generation:${"c".repeat(22)}`;
    const verificationPlanEntryId = VerificationPlanEntryIdV1Schema.parse(
      `verification-plan:${"d".repeat(22)}`,
    );
    const checkManifest = TaskManifestV1Schema.parse({
      schemaVersion: 1,
      taskId: captured.baseline.taskId,
      title: "Strong full vertical",
      originalIntent: "Run the full strong Change Intelligence vertical",
      status: "check_required",
      repositoryId: snapshot.repositoryId,
      worktreeId: snapshot.worktreeId,
      baselineSnapshotId: snapshot.snapshotId,
      latestSnapshotId: snapshot.snapshotId,
      taskProfile: "agent_task_v1",
      taskBaselineArtifactId: captured.baseline.artifactId,
      contextBuildSpec,
      contextGenerationId,
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:05.000Z",
      producerVersion: PRODUCER_VERSION,
      revision: 5,
    });
    const planEntry = {
      verificationPlanEntryId,
      acceptanceClaimIds: ["claim:acceptance"],
      method: "test" as const,
      required: true,
    };
    const checkTask = StrongChangeTaskProjectionV1Schema.parse({
      manifest: checkManifest,
      acceptanceClaimIds: ["claim:acceptance"],
      impactPathIds: [],
      confirmedObligations: [],
      verificationPlan: [planEntry],
    });
    const basis = {
      recordId: `repository-basis-record:${"e".repeat(22)}`,
      recordContentDigest: `sha256:${"1".repeat(64)}`,
      basisDigest: `sha256:${"2".repeat(64)}`,
      readSetDigest: `sha256:${"3".repeat(64)}`,
      baselineSnapshotArtifactId:
        `artifact:repository-snapshot:${snapshot.snapshotId}`,
      baselineSnapshotContentDigest: sha256CanonicalJson(snapshot),
      actualSnapshotArtifactId:
        `artifact:repository-snapshot:${snapshot.snapshotId}`,
      actualSnapshotContentDigest: sha256CanonicalJson(snapshot),
      taskBaselineArtifactId: captured.baseline.artifactId,
      taskBaselineContentDigest: captured.baselineContentDigest,
      graphArtifactId: "artifact:graph-fixture",
      graphContentDigest: `sha256:${"d".repeat(64)}`,
      graphSourceSnapshotId: snapshot.snapshotId,
    };
    const checkPreparation = StrongChangeCheckPreparationV1Schema.parse({
      profile: "strong_change_check_preparation_v1",
      task: checkTask,
      baseline: captured.baseline,
      baselineSnapshot: snapshot,
      actualSnapshot: snapshot,
      basis,
      rulesetVersion: PRODUCER_VERSION,
      budget: strongAnalysisBudgetFixture(),
      usage: strongAnalysisUsageFixture(),
      repositoryDelta: {
        profile: "final-tree-delta-v1",
        taskId: checkManifest.taskId,
        baselineSnapshotId: snapshot.snapshotId,
        actualSnapshotId: snapshot.snapshotId,
        paths: [],
        redactedAggregates: [],
        status: "complete",
        boundaryIds: [],
      },
      analyzedHunks: [],
      boundaries: [],
      authorityToken: `hmac-sha256:${"4".repeat(64)}`,
    });
    let committedCheck:
      | Awaited<ReturnType<typeof executeStrongChangeCheckV1>>
      | undefined;
    const authority: StrongChangeIntelligenceAuthorityV1 = {
      captureTaskBaseline: creation.captureTaskBaseline,
      async prepareCheck() {
        return checkPreparation;
      },
      async commitCheck(request) {
        committedCheck = {
          profile: "strong_change_check_outcome_v1",
          changeCheck: request.changeCheck,
          findingClaims: request.findingClaims,
          evidence: request.evidence,
          impactConclusion: request.impactConclusion,
          commitEvidence: request.commitEvidence,
          committedRevision: 6,
          idempotentReplay: false,
        };
        return committedCheck;
      },
      async scanVerificationInput() {
        return {
          sensitiveRequestScanPolicyDigest: sha256CanonicalJson({
            fixture: "sensitive-request-scan-policy",
          }),
          fullInputEqualityTag: KeyedStateTokenV1Schema.parse(
            `hmac-sha256:${"7".repeat(64)}`,
          ),
          ownerOnlyDetailCommitment: KeyedStateTokenV1Schema.parse(
            `hmac-sha256:${"8".repeat(64)}`,
          ),
          ownerOnlyDetail: {
            command: {
              executable: "pnpm",
              arguments: ["test"],
              workingDirectory: "repository_root",
              environmentKeys: [],
            },
          },
          detail: { status: "stored" as const },
          detailFields: ["command" as const],
        };
      },
      async prepareVerification() {
        if (committedCheck === undefined) throw new Error("Check was not committed");
        const verificationManifest = TaskManifestV1Schema.parse({
          ...checkManifest,
          status: "verification_required",
          currentChangeCheckId: committedCheck.changeCheck.id,
          currentChangeCheckRevision: committedCheck.changeCheck.taskRevision,
          updatedAt: "2026-08-25T00:00:06.000Z",
          revision: 6,
        });
        return StrongVerificationPreparationV1Schema.parse({
          profile: "strong_verification_preparation_v1",
          task: {
            ...checkTask,
            manifest: verificationManifest,
          },
          planEntry,
          changeCheckArtifactId:
            `artifact:change-check:${verificationManifest.taskId}`,
          changeCheckContentDigest: sha256CanonicalJson(
            committedCheck.changeCheck,
          ),
          changeCheck: committedCheck.changeCheck,
          priorRecords: [],
          basis,
          sensitiveRequestScanPolicyDigest: sha256CanonicalJson({
            fixture: "sensitive-request-scan-policy",
          }),
          fullInputEqualityTag: `hmac-sha256:${"7".repeat(64)}`,
          ownerOnlyDetailCommitment: `hmac-sha256:${"8".repeat(64)}`,
          ownerOnlyDetail: {
            command: {
              executable: "pnpm",
              arguments: ["test"],
              workingDirectory: "repository_root",
              environmentKeys: [],
            },
          },
          detail: { status: "stored" },
          detailFields: ["command"],
          authorityToken: `hmac-sha256:${"5".repeat(64)}`,
        });
      },
      async commitVerification(request) {
        return {
          profile: "strong_verification_outcome_v1",
          verification: request.verification,
          commitEvidence: request.commitEvidence,
          committedRevision: 7,
          idempotentReplay: false,
        };
      },
    };

    const check = await executeStrongChangeCheckV1(
      authority,
      {
        profile: "check_changes_strong_v1",
        taskId: checkManifest.taskId,
        actualSnapshotId: snapshot.snapshotId,
        includeWorktree: true,
        expectedRevision: 5,
        idempotencyKey: "strong-check-once",
        actor: ACTOR,
      },
      () => new Date("2026-08-25T00:00:06.000Z"),
    );
    expect(check.changeCheck.analysis).toMatchObject({
      profile: "evidence_backed_v1",
      repositoryDelta: { profile: "final-tree-delta-v1" },
      completeness: { overall: "complete" },
    });
    const verification = await executeStrongVerificationRecordV1(
      authority,
      {
        profile: "record_verification_strong_v1",
        taskId: checkManifest.taskId,
        snapshotId: snapshot.snapshotId,
        verificationPlanEntryId,
        method: "test",
        status: "passed",
        claimIds: ["claim:acceptance"],
        command: {
          executable: "pnpm",
          arguments: ["test"],
          workingDirectory: "repository_root",
          environmentKeys: [],
        },
        expectedRevision: 6,
        idempotencyKey: "strong-verification-once",
        actor: ACTOR,
      },
      () => new Date("2026-08-25T00:00:07.000Z"),
    );
    expect(verification.verification).toMatchObject({
      profile: "verification_record_strong_v1",
      contextGenerationId,
      status: "passed",
      publicResultCode: "verification_passed",
    });
    expect(verification.commitEvidence).toMatchObject({
      recovery: { attemptChainValidated: true, idempotencyReplaySafe: true },
      security: { rawExecutionPersisted: false },
      readSet: { finalValidation: "provider_exact_cut_v1" },
      provenance: {
        taskBaselineArtifactId: captured.baseline.artifactId,
        contextGenerationId,
      },
    });
  });

  it("requires Provider baseline authority for a trusted strong Snapshot before loading context or writing a Task", async () => {
    const snapshot = strongSnapshotFixture();
    const { store } = await openEmptyBoundStore(
      snapshot.repositoryId,
      snapshot.worktreeId,
    );
    await store.persistArtifact(strongSnapshotArtifact(snapshot));
    const manifestBefore = await store.readManifest();
    let loadCount = 0;
    const guardedProvider: ContextLoader = {
      async loadTaskContext(input) {
        loadCount += 1;
        return contextProvider.loadTaskContext(input);
      },
    };

    await expect(
      engine(store, { contextProvider: guardedProvider }).buildTaskBrief(
        buildInput("reject-strong-snapshot-before-task-write"),
        authForStore(store, ["task:create"]),
      ),
    ).rejects.toMatchObject({
      code: "capability_unavailable",
      details: {
        reason: "strong_change_authority_unavailable",
      },
    });

    expect(loadCount).toBe(0);
    expect(await store.readManifest()).toEqual(manifestBefore);
    expect(
      manifestBefore.artifacts.some(
        (descriptor) => descriptor.artifactType === "task_manifest",
      ),
    ).toBe(false);
  });

  it("rejects a trusted strong Pulse instead of swallowing it before a Task write", async () => {
    const strongSource = strongSnapshotFixture();
    const { store } = await openEmptyBoundStore(
      strongSource.repositoryId,
      strongSource.worktreeId,
    );
    await store.persistArtifact(
      await legacySnapshotForBoundStore(store, strongSource.snapshotId),
    );
    await store.persistArtifact(strongPulseArtifact(strongSource));
    let loadCount = 0;
    const guardedProvider: ContextLoader = {
      async loadTaskContext(input) {
        loadCount += 1;
        return contextProvider.loadTaskContext(input);
      },
    };
    const taskEngine = engine(store, { contextProvider: guardedProvider });
    const input = buildInput("reject-strong-pulse-before-task-write");
    const manifestBefore = await store.readManifest();

    await expect(
      taskEngine.buildTaskBrief(input, authForStore(store, ["task:create"])),
    ).rejects.toMatchObject({
      code: "artifact_unavailable",
      details: {
        reason: "unsupported_schema",
        artifactType: "repo_pulse",
      },
    });

    expect(loadCount).toBe(0);
    expect(await store.readManifest()).toEqual(manifestBefore);
    expect(
      manifestBefore.artifacts.some(
        (descriptor) => descriptor.artifactType === "task_manifest",
      ),
    ).toBe(false);

    await expect(
      taskEngine.buildTaskBrief(input, authForStore(store, ["task:create"])),
    ).rejects.toMatchObject({
      code: "artifact_unavailable",
      details: {
        reason: "unsupported_schema",
        artifactType: "repo_pulse",
      },
    });
    expect(await store.readManifest()).toEqual(manifestBefore);
  });

  it("rejects a trusted strong actual Snapshot before Change Check analysis or write", async () => {
    const strongActual = strongSnapshotFixture();
    const { store } = await openEmptyBoundStore(
      strongActual.repositoryId,
      strongActual.worktreeId,
    );
    const baselineSnapshotId = "snapshot:legacy-path-safe-task-baseline";
    await store.persistArtifact(
      await legacySnapshotForBoundStore(store, baselineSnapshotId),
    );
    await store.persistArtifact(
      await legacyPulseForBoundStore(store, baselineSnapshotId),
    );
    let analyzeCount = 0;
    const guardedProvider: ContextLoader = {
      loadTaskContext: contextProvider.loadTaskContext,
      async analyzeTaskChanges() {
        analyzeCount += 1;
        throw new Error("strong Snapshot guard must run before analysis");
      },
    };
    const taskEngine = engine(store, { contextProvider: guardedProvider });
    const built = await taskEngine.buildTaskBrief(
      buildInput("reject-strong-change-check-snapshot"),
      authForStore(store),
    );
    const updates = [
      {
        action: {
          type: "confirm_goal" as const,
          claimId: built.brief.goalClaimId,
        },
        key: "strong-check-confirm-goal",
      },
      {
        action: {
          type: "confirm_acceptance_criteria" as const,
          claimIds: built.brief.acceptanceClaimIds,
        },
        key: "strong-check-confirm-acceptance",
      },
      {
        action: {
          type: "confirm_plan" as const,
          plannedChangeIds: built.brief.plannedChanges.map(
            (change) => change.id,
          ),
        },
        key: "strong-check-confirm-plan",
      },
      {
        action: {
          type: "transition_status" as const,
          to: "planned" as const,
        },
        key: "strong-check-transition-planned",
      },
      {
        action: {
          type: "transition_status" as const,
          to: "in_progress" as const,
        },
        key: "strong-check-transition-progress",
      },
    ];
    let revision = built.task.revision;
    for (const update of updates) {
      const result = await taskEngine.updateTask(
        {
          taskId: built.task.taskId,
          action: update.action,
          expectedRevision: revision,
          idempotencyKey: update.key,
          actor: ACTOR,
        },
        authForStore(store),
      );
      revision = result.task.revision;
    }

    await store.persistArtifact(strongSnapshotArtifact(strongActual));
    const captured = await taskEngine.updateTask(
      {
        taskId: built.task.taskId,
        action: { type: "transition_status", to: "check_required" },
        expectedRevision: revision,
        idempotencyKey: "strong-check-capture-actual",
        actor: ACTOR,
      },
      authForStore(store),
    );
    expect(captured.task).toMatchObject({
      status: "check_required",
      latestSnapshotId: strongActual.snapshotId,
    });
    const manifestBefore = await store.readManifest();
    const bundleBefore = await store.readTaskBundle(built.task.taskId);

    await expect(
      taskEngine.checkChange(
        {
          taskId: built.task.taskId,
          actualSnapshotId: strongActual.snapshotId,
          includeWorktree: true,
          expectedRevision: captured.task.revision,
          idempotencyKey: "reject-strong-change-check-analysis",
          actor: ACTOR,
        },
        authForStore(store, ["task:update"]),
      ),
    ).rejects.toMatchObject({
      code: "artifact_unavailable",
      details: {
        reason: "unsupported_schema",
        artifactType: "repository_snapshot",
        snapshotId: strongActual.snapshotId,
      },
    });

    expect(analyzeCount).toBe(0);
    expect(await store.readManifest()).toEqual(manifestBefore);
    expect(await store.readTaskBundle(built.task.taskId)).toEqual(bundleBefore);
  });

  it("fails closed before loading context when the provider belongs to another worktree", async () => {
    const [{ store: firstStore }, { store: secondStore }] = await Promise.all([
      openStore(),
      openStore(),
    ]);
    let loadCount = 0;
    const foreignProvider: TaskContextProvider = {
      binding: {
        schemaVersion: 1,
        kind: "canonical_worktree_root",
        canonicalRoot: secondStore.layout.worktreeRoot,
      },
      async loadTaskContext() {
        loadCount += 1;
        return {
          graph: graphFixture(),
          existingFilePaths: [],
        };
      },
    };

    let failure: unknown;
    try {
      new TaskEngine(firstStore, {
        contextProvider: foreignProvider,
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      code: "context_provider_mismatch",
      details: {
        reason: "canonical_worktree_root_mismatch",
      },
    });
    expect(String(failure)).not.toContain(
      secondStore.layout.worktreeRoot,
    );
    expect(loadCount).toBe(0);
  });

  it("builds created@1 -> context_ready@2, survives restart, and replays the historical result", async () => {
    const { root, store } = await openStore();
    const taskEngine = engine(store);
    const input = buildInput();

    const built = await taskEngine.buildTaskBrief(input, auth(["task:create"]));
    expect(built.task).toMatchObject({
      status: "context_ready",
      revision: 2,
    });
    expect(built.mutation.idempotentReplay).toBe(false);
    expect(built.brief.readingPath.length).toBeGreaterThan(1);
    expect(built.brief.plannedChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: "src/task.ts",
          symbolId: "task-handler",
        }),
      ]),
    );

    const firstRead = await expectContextReadyBundle(
      store,
      built.task.taskId,
    );
    expect(firstRead.freshness).toBe("fresh");

    const reopened = await ArtifactStore.open(root, {
      repositoryId: REPOSITORY_ID,
      worktreeId: WORKTREE_ID,
      producerVersion: PRODUCER_VERSION,
    });
    await reopened.initialize();
    const replay = await engine(reopened).buildTaskBrief(
      input,
      auth(["task:create"]),
    );
    expect(replay).toMatchObject({
      task: { taskId: built.task.taskId, revision: 2 },
      mutation: {
        eventId: built.mutation.eventId,
        idempotentReplay: true,
      },
    });
    const replayedBundle = await reopened.readTaskBundle(built.task.taskId);
    expect(replayedBundle.bundle.events).toHaveLength(2);
    expect(replayedBundle.receipts).toHaveLength(2);
  });

  it("paginates by Task revision and renders an evidence-conscious Agent handoff", async () => {
    const { store } = await openStore();
    const taskEngine = engine(store);
    const built = await taskEngine.buildTaskBrief(
      buildInput("build-pagination"),
      auth(),
    );

    const first = await taskEngine.getTaskBrief({
      taskId: built.task.taskId,
      section: "reading_path",
      pageSize: 1,
    });
    expect(first.result.items).toHaveLength(1);
    expect(first.nextCursor).toBeDefined();
    const second = await taskEngine.getTaskBrief({
      taskId: built.task.taskId,
      section: "reading_path",
      pageSize: 1,
      cursor: first.nextCursor,
    });
    expect(second.result.items).toHaveLength(1);
    expect(second.result.items).not.toEqual(first.result.items);

    const markdown = await taskEngine.renderTaskBriefMarkdown(
      built.task.taskId,
    );
    expect(markdown).toContain("Freshness: `fresh`");
    expect(markdown).toContain("Recovery state: `current`");
    expect(markdown).toContain("`src/task.ts`");
    expect(markdown).not.toMatch(/(?:^|[^\w])\/Users\//u);
    expect(markdown).not.toContain("persistent task lifecycle behavior");
  });

  it("persists the created stage when context is unavailable and resumes it safely", async () => {
    const { root, store } = await openStore({ publishPulse: false });
    const taskEngine = engine(store);
    const input = buildInput("build-after-interruption");

    await expect(
      taskEngine.buildTaskBrief(input, auth()),
    ).rejects.toMatchObject({ code: "artifact_unavailable" });

    const manifest = await store.readManifest();
    const taskDescriptor = manifest.artifacts.find(
      (descriptor) => descriptor.artifactType === "task_manifest",
    );
    expect(taskDescriptor?.revision).toBe(1);
    expect(taskDescriptor?.taskId).toBeDefined();
    const created = await store.readTaskBundle(taskDescriptor!.taskId!);
    expect(created.bundle.manifest).toMatchObject({
      status: "created",
      revision: 1,
    });
    expect(created.bundle.events).toHaveLength(1);
    expect(created.receipts).toHaveLength(1);

    const restartedStore = await reopenStore(root);
    await restartedStore.persistArtifact(await loadFixture("repo-pulse.json"));
    const resumed = await engine(restartedStore).buildTaskBrief(input, auth());
    expect(resumed.task).toMatchObject({
      taskId: created.bundle.manifest.taskId,
      status: "context_ready",
      revision: 2,
    });
    await expectContextReadyBundle(restartedStore, resumed.task.taskId);
  });

  it("wraps provider failure, then resumes Stage 2 with a new Store and Engine", async () => {
    const { root, store } = await openStore();
    const input = buildInput("provider-failure-restart");
    const unavailableProvider: ContextLoader = {
      async loadTaskContext() {
        throw new Error("provider transport failed");
      },
    };

    await expect(
      engine(store, {
        contextProvider: unavailableProvider,
      }).buildTaskBrief(input, auth()),
    ).rejects.toMatchObject({
      code: "context_build_failed",
      details: {
        stage: "context_provider",
      },
    });

    const manifest = await store.readManifest();
    const taskId = manifest.artifacts.find(
      (descriptor) => descriptor.artifactType === "task_manifest",
    )!.taskId!;
    await expect(store.readTaskBundle(taskId)).resolves.toMatchObject({
      bundle: {
        manifest: {
          status: "created",
          revision: 1,
        },
        events: [{ action: { type: "task_created" } }],
      },
    });

    const restartedStore = await reopenStore(root);
    const resumed = await engine(restartedStore).buildTaskBrief(
      input,
      auth(),
    );
    expect(resumed.task).toMatchObject({
      taskId,
      status: "context_ready",
      revision: 2,
    });
    await expectContextReadyBundle(restartedStore, taskId);
  });

  it("wraps context draft failures with the same stable error code", async () => {
    const { store } = await openStore();
    const invalidProvider: ContextLoader = {
      async loadTaskContext() {
        return {
          graph: null as unknown as KnowledgeGraph,
          existingFilePaths: [],
        };
      },
    };

    await expect(
      engine(store, {
        contextProvider: invalidProvider,
      }).buildTaskBrief(buildInput("draft-failure"), auth()),
    ).rejects.toMatchObject({
      code: "context_build_failed",
      details: {
        stage: "context_draft",
      },
    });
  });

  it("continues context creation at current+1 after a legal created-stage block/resume", async () => {
    const { store } = await openStore({ publishPulse: false });
    const taskEngine = engine(store);
    const input = buildInput("build-after-created-block");
    await expect(
      taskEngine.buildTaskBrief(input, auth()),
    ).rejects.toMatchObject({ code: "artifact_unavailable" });
    const taskId = (await store.readManifest()).artifacts.find(
      (descriptor) => descriptor.artifactType === "task_manifest",
    )!.taskId!;

    const blocked = await taskEngine.updateTask(
      {
        taskId,
        action: {
          type: "block_task",
          reasonCode: "context_provider_unavailable",
          message: "Wait for the context provider to recover.",
        },
        expectedRevision: 1,
        idempotencyKey: "block-created-stage",
        actor: ACTOR,
      },
      auth(),
    );
    expect(blocked.task).toMatchObject({
      status: "blocked",
      revision: 2,
      blockedState: { resumeStatus: "created" },
    });
    const resumed = await taskEngine.updateTask(
      {
        taskId,
        action: { type: "resume_task" },
        expectedRevision: 2,
        idempotencyKey: "resume-created-stage",
        actor: ACTOR,
      },
      auth(),
    );
    expect(resumed.task).toMatchObject({ status: "created", revision: 3 });

    await store.persistArtifact(await loadFixture("repo-pulse.json"));
    const built = await taskEngine.buildTaskBrief(input, auth());
    expect(built.task).toMatchObject({
      taskId,
      status: "context_ready",
      revision: 4,
    });
    const read = await store.readTaskBundle(taskId);
    expect(read.bundle.events.map((event) => event.action.type)).toEqual([
      "task_created",
      "block_task",
      "resume_task",
      "transition_status",
    ]);
    expect(read.receipts).toHaveLength(4);
  });

  it("serializes concurrent identical builds to one Task and two committed events", async () => {
    const { store } = await openStore({
      lockTimeoutMs: CONCURRENT_BUILD_LOCK_TIMEOUT_MS,
    });
    const taskEngine = engine(store);
    const input = buildInput("concurrent-build");

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        taskEngine.buildTaskBrief(input, auth())
      ),
    );
    expect(new Set(results.map((result) => result.task.taskId)).size).toBe(1);
    expect(new Set(results.map((result) => result.task.revision))).toEqual(
      new Set([2]),
    );
    const taskId = results[0]!.task.taskId;
    const read = await expectContextReadyBundle(store, taskId);
    expect(read.bundle.events).toHaveLength(2);
    expect(read.receipts).toHaveLength(2);
    expect(
      results.filter((result) => result.mutation.idempotentReplay).length,
    ).toBeGreaterThan(0);
    await expectStoreLocksReleased(store, taskId);
  }, CONCURRENT_BUILD_LOCK_TIMEOUT_MS + 5_000);

  it("builds deterministic Task identities and persisted payload digests across Stores", async () => {
    const first = await openStore();
    const second = await openStore();
    const input = buildInput("deterministic-store-build");

    const firstResult = await engine(first.store).buildTaskBrief(
      input,
      auth(),
    );
    const secondResult = await engine(second.store).buildTaskBrief(
      input,
      auth(),
    );
    expect(secondResult.task.taskId).toBe(firstResult.task.taskId);
    expect(secondResult).toEqual(firstResult);

    const firstRead = await first.store.readTaskBundle(
      firstResult.task.taskId,
    );
    const secondRead = await second.store.readTaskBundle(
      secondResult.task.taskId,
    );
    const payloadDigests = (read: ReadTaskBundleResult) =>
      read.artifacts
        .map((artifact) => ({
          artifactType: artifact.artifactType,
          contentDigest: artifact.contentDigest,
        }))
        .sort((left, right) =>
          left.artifactType.localeCompare(right.artifactType)
        );
    expect(payloadDigests(secondRead)).toEqual(payloadDigests(firstRead));
    expect(secondRead.bundle).toEqual(firstRead.bundle);
    expect(secondRead.receipts).toEqual(firstRead.receipts);
  });

  it("never mixes the created stage of one actor or payload with another concurrent build", async () => {
    const { store } = await openStore();
    const taskEngine = engine(store);
    const first = buildInput("concurrent-conflicting-build");
    const second = {
      ...first,
      task: "A different Task intent competing for the same create key",
      actor: "claude",
    };

    const settled = await Promise.allSettled([
      taskEngine.buildTaskBrief(first, auth()),
      taskEngine.buildTaskBrief(second, {
        actor: "claude",
        repositoryId: REPOSITORY_ID,
        worktreeId: WORKTREE_ID,
        capabilities: ["task:create"],
      }),
    ]);
    const fulfilled = settled.filter(
      (result): result is PromiseFulfilledResult<
        Awaited<ReturnType<TaskEngine["buildTaskBrief"]>>
      > => result.status === "fulfilled",
    );
    const rejected = settled.filter(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({
      code: "idempotency_conflict",
    });

    const read = await store.readTaskBundle(fulfilled[0]!.value.task.taskId);
    expect(read.bundle.manifest.originalIntent).toBe(
      fulfilled[0]!.value.brief.originalIntent,
    );
    expect(read.bundle.events[0]?.actor).toBe(
      read.bundle.events[1]?.actor,
    );
    expect(read.bundle.events).toHaveLength(2);
  });

  it("fails closed on missing or mismatched create/update authorization", async () => {
    const { store } = await openStore();
    const taskEngine = engine(store);
    const input = buildInput("conflict-build");

    await expect(
      taskEngine.buildTaskBrief(input, {
        actor: ACTOR,
        repositoryId: REPOSITORY_ID,
        worktreeId: WORKTREE_ID,
      }),
    ).rejects.toMatchObject({ code: "action_not_authorized" });
    await expect(
      taskEngine.buildTaskBrief(input, {
        ...auth(["task:create"]),
        actor: "another-agent",
      }),
    ).rejects.toMatchObject({ code: "action_not_authorized" });
    await expect(
      taskEngine.buildTaskBrief(input, auth(["task:update"])),
    ).rejects.toMatchObject({ code: "action_not_authorized" });
    await expect(
      taskEngine.buildTaskBrief(input, {
        ...auth(["task:create"]),
        repositoryId: "repository:another",
      }),
    ).rejects.toMatchObject({ code: "action_not_authorized" });
    await expect(
      taskEngine.buildTaskBrief(input, {
        ...auth(["task:create"]),
        worktreeId: "worktree:another",
      }),
    ).rejects.toMatchObject({ code: "action_not_authorized" });
    const built = await taskEngine.buildTaskBrief(
      input,
      auth(["task:create"]),
    );
    await expect(
      taskEngine.buildTaskBrief(
        { ...input, task: `${input.task} with a changed request` },
        auth(["task:create"]),
      ),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });

    const updateInput = {
      taskId: built.task.taskId,
      action: {
        type: "confirm_goal" as const,
        claimId: built.brief.goalClaimId,
      },
      expectedRevision: 2,
      idempotencyKey: "authorization-confirm-goal",
      actor: ACTOR,
    };
    await expect(
      taskEngine.updateTask(updateInput, {
        actor: ACTOR,
        repositoryId: REPOSITORY_ID,
        worktreeId: WORKTREE_ID,
      }),
    ).rejects.toMatchObject({ code: "action_not_authorized" });
    await expect(
      taskEngine.updateTask(updateInput, auth(["task:update"])),
    ).rejects.toMatchObject({ code: "action_not_authorized" });
    for (const mismatched of [
      { ...auth(["task:confirm"]), actor: "another-agent" },
      {
        ...auth(["task:confirm"]),
        repositoryId: "repository:another",
      },
      {
        ...auth(["task:confirm"]),
        worktreeId: "worktree:another",
      },
    ]) {
      await expect(
        taskEngine.updateTask(updateInput, mismatched),
      ).rejects.toMatchObject({ code: "action_not_authorized" });
    }
    expect(
      (await store.readTaskBundle(built.task.taskId)).bundle.manifest.revision,
    ).toBe(2);
  });

  it("commits lifecycle actions one revision at a time and replays an old receipt after later changes", async () => {
    const { store } = await openStore();
    const taskEngine = engine(store);
    const built = await taskEngine.buildTaskBrief(
      buildInput("lifecycle-build"),
      auth(),
    );
    const taskId = built.task.taskId;
    const goalInput = {
      taskId,
      action: {
        type: "confirm_goal" as const,
        claimId: built.brief.goalClaimId,
      },
      expectedRevision: 2,
      idempotencyKey: "confirm-goal",
      actor: ACTOR,
    };
    const goal = await taskEngine.updateTask(goalInput, auth());
    expect(goal.task.revision).toBe(3);

    const acceptance = await taskEngine.updateTask(
      {
        taskId,
        action: {
          type: "confirm_acceptance_criteria",
          claimIds: built.brief.acceptanceClaimIds,
        },
        expectedRevision: 3,
        idempotencyKey: "confirm-acceptance",
        actor: ACTOR,
      },
      auth(),
    );
    expect(acceptance.task.revision).toBe(4);

    const plan = await taskEngine.updateTask(
      {
        taskId,
        action: {
          type: "confirm_plan",
          plannedChangeIds: built.brief.plannedChanges.map(
            (change) => change.id,
          ),
        },
        expectedRevision: 4,
        idempotencyKey: "confirm-plan",
        actor: ACTOR,
      },
      auth(),
    );
    expect(plan.task.revision).toBe(5);

    const planned = await taskEngine.updateTask(
      {
        taskId,
        action: { type: "transition_status", to: "planned" },
        expectedRevision: 5,
        idempotencyKey: "transition-planned",
        actor: ACTOR,
      },
      auth(),
    );
    expect(planned.task).toMatchObject({ revision: 6, status: "planned" });

    const blocked = await taskEngine.updateTask(
      {
        taskId,
        action: {
          type: "block_task",
          reasonCode: "waiting_on_dependency",
          message: "Waiting for an external dependency decision.",
        },
        expectedRevision: 6,
        idempotencyKey: "block-planned-task",
        actor: ACTOR,
      },
      auth(),
    );
    expect(blocked.task).toMatchObject({
      revision: 7,
      status: "blocked",
      blockedState: { resumeStatus: "planned" },
    });

    const resumed = await taskEngine.updateTask(
      {
        taskId,
        action: { type: "resume_task" },
        expectedRevision: 7,
        idempotencyKey: "resume-planned-task",
        actor: ACTOR,
      },
      auth(),
    );
    expect(resumed.task).toMatchObject({ revision: 8, status: "planned" });

    await expect(
      taskEngine.updateTask(
        {
          taskId,
          action: {
            type: "transition_status",
            to: "in_progress",
            verificationRecordId: "verification:unrelated",
          },
          expectedRevision: 8,
          idempotencyKey: "transition-in-progress-unrelated-verification",
          actor: ACTOR,
        },
        auth(),
      ),
    ).rejects.toMatchObject({
      code: "task_transition_rejected",
      details: { guard: "transition_not_allowed" },
    });

    const inProgress = await taskEngine.updateTask(
      {
        taskId,
        action: { type: "transition_status", to: "in_progress" },
        expectedRevision: 8,
        idempotencyKey: "transition-in-progress",
        actor: ACTOR,
      },
      auth(),
    );
    expect(inProgress.task).toMatchObject({
      revision: 9,
      status: "in_progress",
    });

    const oldReplay = await taskEngine.updateTask(goalInput, auth());
    expect(oldReplay).toMatchObject({
      task: { revision: 3, status: "context_ready" },
      mutation: {
        eventId: goal.mutation.eventId,
        idempotentReplay: true,
      },
    });
    const finalRead = await store.readTaskBundle(taskId);
    expect(finalRead.bundle.manifest).toMatchObject({
      revision: 9,
      status: "in_progress",
    });
    expect(finalRead.bundle.events).toHaveLength(9);
    expect(finalRead.receipts).toHaveLength(9);

    await expect(
      taskEngine.updateTask(
        {
          taskId,
          action: { type: "transition_status", to: "in_progress" },
          expectedRevision: 8,
          idempotencyKey: "stale-revision",
          actor: ACTOR,
        },
        auth(),
      ),
    ).rejects.toMatchObject({ code: "revision_conflict" });
  });

  it("captures the latest actual Snapshot when implementation returns to check_required", async () => {
    const { store } = await openStore();
    const taskEngine = engine(store);
    const built = await taskEngine.buildTaskBrief(
      buildInput("capture-latest-actual-snapshot"),
      auth(),
    );
    const taskId = built.task.taskId;
    const updates = [
      {
        action: {
          type: "confirm_goal" as const,
          claimId: built.brief.goalClaimId,
        },
        key: "actual-confirm-goal",
      },
      {
        action: {
          type: "confirm_acceptance_criteria" as const,
          claimIds: built.brief.acceptanceClaimIds,
        },
        key: "actual-confirm-acceptance",
      },
      {
        action: {
          type: "confirm_plan" as const,
          plannedChangeIds: built.brief.plannedChanges.map(
            (change) => change.id,
          ),
        },
        key: "actual-confirm-plan",
      },
      {
        action: { type: "transition_status" as const, to: "planned" as const },
        key: "actual-transition-planned",
      },
      {
        action: {
          type: "transition_status" as const,
          to: "in_progress" as const,
        },
        key: "actual-transition-in-progress",
      },
      {
        action: {
          type: "transition_status" as const,
          to: "check_required" as const,
        },
        key: "actual-transition-first-check",
      },
    ];
    let revision = built.task.revision;
    for (const update of updates) {
      const result = await taskEngine.updateTask(
        {
          taskId,
          action: update.action,
          expectedRevision: revision,
          idempotencyKey: update.key,
          actor: ACTOR,
        },
        auth(),
      );
      revision = result.task.revision;
    }

    const checked = await appendTrustedChangeCheck(store, taskId);
    revision = checked.bundle.manifest.revision;
    const verificationRequired = await taskEngine.updateTask(
      {
        taskId,
        action: {
          type: "transition_status",
          to: "verification_required",
        },
        expectedRevision: revision,
        idempotencyKey: "actual-transition-verification",
        actor: ACTOR,
      },
      auth(),
    );
    const verifiedProjection = await appendTrustedVerification(
      store,
      taskId,
      { status: "failed" },
    );
    if (!("brief" in verifiedProjection.bundle)) {
      throw new TypeError("The verified projection must remain contextual.");
    }
    const previousFindingId =
      verifiedProjection.bundle.changeChecks.at(-1)!.findings[0]!.id;
    const previousVerificationId =
      verifiedProjection.bundle.verificationRecords.at(-1)!.id;
    const resumedImplementation = await taskEngine.updateTask(
      {
        taskId,
        action: {
          type: "transition_status",
          to: "in_progress",
          verificationRecordId: previousVerificationId,
        },
        expectedRevision: verifiedProjection.bundle.manifest.revision,
        idempotencyKey: "actual-resume-after-failed-verification",
        actor: ACTOR,
      },
      auth(),
    );
    expect(resumedImplementation.task).toMatchObject({
      status: "in_progress",
      latestSnapshotId: "snapshot:actual",
    });

    const actualSnapshotId = "snapshot:actual-after-implementation";
    await store.persistArtifact(await advancedSnapshot(actualSnapshotId));
    const staleActualRead = await store.readTaskBundle(taskId);
    expect(staleActualRead).toMatchObject({
      freshness: "stale",
      latestSnapshotId: actualSnapshotId,
      bundle: {
        manifest: {
          status: "in_progress",
          latestSnapshotId: "snapshot:actual",
        },
      },
    });

    const captureInput = {
      taskId,
      action: {
        type: "transition_status" as const,
        to: "check_required" as const,
      },
      expectedRevision: resumedImplementation.task.revision,
      idempotencyKey: "actual-capture-latest-snapshot",
      actor: ACTOR,
    };
    for (const invalidRead of [
      {
        name: "invalid-freshness",
        read: {
          ...staleActualRead,
          freshness: "invalid" as const,
        },
        failedGuard: "task_bundle_freshness_invalid",
      },
      {
        name: "read-only-recovery",
        read: {
          ...staleActualRead,
          state: "read_only_recovery" as const,
          recoveryState: "read_only_recovery" as const,
        },
        failedGuard: "task_bundle_recovery_read_only",
      },
    ]) {
      let persistCount = 0;
      const invalidHarness = {
        worktreeId: store.worktreeId,
        async readTaskBundle() {
          return invalidRead.read;
        },
        async persistTaskBundle() {
          persistCount += 1;
        },
      } as unknown as ArtifactStore;
      await expect(
        applyTaskUpdate(
          invalidHarness,
          {
            ...captureInput,
            idempotencyKey:
              `actual-capture-${invalidRead.name}`,
          },
          () => new Date("2026-07-29T15:00:00.000Z"),
        ),
      ).rejects.toMatchObject({
        code: "task_gate_unsatisfied",
        details: {
          failedGuards: expect.arrayContaining([
            { code: invalidRead.failedGuard },
          ]),
        },
      });
      expect(persistCount).toBe(0);
    }
    const captured = await taskEngine.updateTask(captureInput, auth());
    expect(captured.task).toMatchObject({
      status: "check_required",
      revision: resumedImplementation.task.revision + 1,
      latestSnapshotId: actualSnapshotId,
    });

    const persisted = await store.readTaskBundle(taskId);
    expect(persisted).toMatchObject({
      latestSnapshotId: actualSnapshotId,
      bundle: {
        manifest: {
          status: "check_required",
          latestSnapshotId: actualSnapshotId,
        },
      },
    });
    expect(persisted.bundle.events.at(-1)).toMatchObject({
      previousStatus: "in_progress",
      resultingStatus: "check_required",
      sourceSnapshotId: actualSnapshotId,
      action: {
        type: "transition_status",
        to: "check_required",
      },
    });
    expect(
      persisted.artifacts.map((artifact) => artifact.artifactType),
    ).not.toEqual(expect.arrayContaining(["change_check", "verification"]));
    if (!("brief" in persisted.bundle)) {
      throw new TypeError("The captured Task must retain its context.");
    }
    expect(persisted.bundle.changeChecks).toEqual([]);
    expect(persisted.bundle.verificationRecords).toEqual([]);
    expect(
      persisted.bundle.claims.every(
        (claim) =>
          !(claim.findingIds as readonly string[]).includes(previousFindingId) &&
          (!("verificationRecordIds" in claim) ||
            !(claim.verificationRecordIds as readonly string[]).includes(previousVerificationId)),
      ),
    ).toBe(true);
    expect(
      persisted.receipts.map((receipt) => receipt.operation),
    ).toEqual(expect.arrayContaining(["check_change", "record_verification"]));

    const replay = await taskEngine.updateTask(captureInput, auth());
    expect(replay).toMatchObject({
      task: {
        revision: captured.task.revision,
        latestSnapshotId: actualSnapshotId,
      },
      mutation: { idempotentReplay: true },
    });
    expect(
      (await store.readTaskBundle(taskId)).bundle.events,
    ).toHaveLength(persisted.bundle.events.length);
    expect(verificationRequired.task.status).toBe("verification_required");
  }, 15_000);

  it("records normal lifecycle drift as one replayable task_context_staled Event", async () => {
    const { store } = await openStore();
    const taskEngine = engine(store);
    const cases: Array<{
      status:
        | "created"
        | "context_ready"
        | "planned"
        | "in_progress"
        | "check_required"
        | "verification_required";
      taskId: string;
      revision: number;
    }> = [];

    const taskIdsBeforeCreatedFailure = new Set(
      (await store.readManifest()).artifacts
        .filter((descriptor) => descriptor.artifactType === "task_manifest")
        .map((descriptor) => descriptor.taskId),
    );
    const unavailableProvider: ContextLoader = {
      async loadTaskContext() {
        throw new Error("context unavailable for created drift fixture");
      },
    };
    await expect(
      engine(store, {
        contextProvider: unavailableProvider,
      }).buildTaskBrief(buildInput("normal-drift-created"), auth()),
    ).rejects.toMatchObject({ code: "context_build_failed" });
    const createdTaskId = (await store.readManifest()).artifacts
      .filter(
        (descriptor) =>
          descriptor.artifactType === "task_manifest" &&
          descriptor.taskId !== undefined &&
          !taskIdsBeforeCreatedFailure.has(descriptor.taskId),
      )
      .map((descriptor) => descriptor.taskId!)
      .at(0);
    if (createdTaskId === undefined) {
      throw new TypeError("The created drift fixture was not persisted.");
    }
    cases.push({ status: "created", taskId: createdTaskId, revision: 1 });

    for (
      const target of [
        "context_ready",
        "planned",
        "in_progress",
        "check_required",
        "verification_required",
      ] as const
    ) {
      const built = await taskEngine.buildTaskBrief(
        buildInput(`normal-drift-${target}`),
        auth(),
      );
      let revision = built.task.revision;
      if (target !== "context_ready") {
        for (
          const [action, key] of [
            [
              {
                type: "confirm_goal",
                claimId: built.brief.goalClaimId,
              },
              "goal",
            ],
            [
              {
                type: "confirm_acceptance_criteria",
                claimIds: built.brief.acceptanceClaimIds,
              },
              "acceptance",
            ],
            [
              {
                type: "confirm_plan",
                plannedChangeIds: built.brief.plannedChanges.map(
                  (change) => change.id,
                ),
              },
              "plan",
            ],
          ] as const
        ) {
          const result = await taskEngine.updateTask(
            {
              taskId: built.task.taskId,
              action,
              expectedRevision: revision,
              idempotencyKey: `normal-drift-${target}-${key}`,
              actor: ACTOR,
            },
            auth(),
          );
          revision = result.task.revision;
        }
        const planned = await taskEngine.updateTask(
          {
            taskId: built.task.taskId,
            action: { type: "transition_status", to: "planned" },
            expectedRevision: revision,
            idempotencyKey: `normal-drift-${target}-to-planned`,
            actor: ACTOR,
          },
          auth(),
        );
        revision = planned.task.revision;
      }
      if (
        target === "in_progress" ||
        target === "check_required" ||
        target === "verification_required"
      ) {
        const inProgress = await taskEngine.updateTask(
          {
            taskId: built.task.taskId,
            action: { type: "transition_status", to: "in_progress" },
            expectedRevision: revision,
            idempotencyKey: `normal-drift-${target}-to-in-progress`,
            actor: ACTOR,
          },
          auth(),
        );
        revision = inProgress.task.revision;
      }
      if (target === "check_required" || target === "verification_required") {
        const checkRequired = await taskEngine.updateTask(
          {
            taskId: built.task.taskId,
            action: { type: "transition_status", to: "check_required" },
            expectedRevision: revision,
            idempotencyKey: `normal-drift-${target}-to-check-required`,
            actor: ACTOR,
          },
          auth(),
        );
        revision = checkRequired.task.revision;
      }
      if (target === "verification_required") {
        const checked = await appendTrustedChangeCheck(
          store,
          built.task.taskId,
        );
        revision = checked.bundle.manifest.revision;
        const verificationRequired = await taskEngine.updateTask(
          {
            taskId: built.task.taskId,
            action: {
              type: "transition_status",
              to: "verification_required",
            },
            expectedRevision: revision,
            idempotencyKey:
              "normal-drift-verification-required-transition",
            actor: ACTOR,
          },
          auth(),
        );
        revision = verificationRequired.task.revision;
      }
      cases.push({
        status: target,
        taskId: built.task.taskId,
        revision,
      });
    }

    const advancedSnapshotId = "snapshot:all-normal-statuses-drifted";
    await store.persistArtifact(await advancedSnapshot(advancedSnapshotId));
    for (const item of cases) {
      const staleInput = {
        taskId: item.taskId,
        action: {
          type: "block_task" as const,
          reasonCode: "manual_pause",
          message: "This requested action must yield to detected drift.",
        },
        expectedRevision: item.revision,
        idempotencyKey: `normal-drift-stale-${item.status}`,
        actor: ACTOR,
      };
      const staled = await taskEngine.updateTask(staleInput, auth());
      expect(staled.task).toMatchObject({
        status: "stale",
        revision: item.revision + 1,
        latestSnapshotId: advancedSnapshotId,
        staleState: {
          staleFromStatus: item.status,
          detectedAtSnapshotId: advancedSnapshotId,
          reasonCodes: expect.arrayContaining([
            "repository_snapshot_advanced",
          ]),
        },
      });
      const persisted = await store.readTaskBundle(item.taskId);
      expect(persisted.bundle.events.at(-1)).toMatchObject({
        previousStatus: item.status,
        resultingStatus: "stale",
        sourceSnapshotId: advancedSnapshotId,
        action: {
          type: "task_context_staled",
          detectedAtSnapshotId: advancedSnapshotId,
        },
      });
      expect(
        persisted.artifacts.map((artifact) => artifact.artifactType),
      ).not.toEqual(expect.arrayContaining(["change_check", "verification"]));
      const eventCount = persisted.bundle.events.length;
      const replay = await taskEngine.updateTask(staleInput, auth());
      expect(replay).toMatchObject({
        task: { revision: staled.task.revision, status: "stale" },
        mutation: { idempotentReplay: true },
      });
      expect(
        (await store.readTaskBundle(item.taskId)).bundle.events,
      ).toHaveLength(eventCount);
      expect(await taskEngine.renderTaskBriefMarkdown(item.taskId)).toContain(
        "- Status: `stale`",
      );
    }

    const capabilities = taskEngine.getCapabilities();
    expect(capabilities).toEqual({
      schemaVersion: 1,
      actions: {
        refresh_task_context: {
          available: false,
          reasonCode: "task_context_rebuild_not_implemented",
          owner: "WP5",
        },
        rebase_task: {
          available: false,
          reasonCode: "task_context_rebuild_not_implemented",
          owner: "WP5",
        },
      },
    });
    expect(Object.isFrozen(capabilities)).toBe(true);
    expect(Object.isFrozen(capabilities.actions)).toBe(true);
    const recoveryCase = cases[0]!;
    const beforeRecovery = await store.readTaskBundle(recoveryCase.taskId);
    for (const action of [
      {
        type: "refresh_task_context" as const,
        targetSnapshotId: advancedSnapshotId,
      },
      {
        type: "rebase_task" as const,
        targetSnapshotId: advancedSnapshotId,
        newBaselineSnapshotId: advancedSnapshotId,
        reason: "Capability lock fixture.",
      },
    ]) {
      await expect(
        taskEngine.updateTask(
          {
            taskId: recoveryCase.taskId,
            action,
            expectedRevision: beforeRecovery.bundle.manifest.revision,
            idempotencyKey: `capability-lock-${action.type}`,
            actor: ACTOR,
          },
          auth(),
        ),
      ).rejects.toMatchObject({
        code: "capability_unavailable",
        details: {
          taskId: recoveryCase.taskId,
          capability: action.type,
          available: false,
          reasonCode: "task_context_rebuild_not_implemented",
          owner: "WP5",
        },
      });
    }
    expect(await store.readTaskBundle(recoveryCase.taskId)).toEqual(
      beforeRecovery,
    );
  }, 30_000);

  it("rebuilds one stale Task on the exact current Snapshot and replays without reloading context", async () => {
    const { store } = await openStore();
    let contextLoads = 0;
    const taskEngine = engine(store, {
      contextProvider: {
        async loadTaskContext(input) {
          contextLoads += 1;
          return contextProvider.loadTaskContext(input);
        },
      },
    });
    const recoveryHarness = legacyContextRecoveryIntegrityHarness(
      store,
      () => {
        contextLoads += 1;
      },
    );
    const built = await taskEngine.buildTaskBrief(
      buildInput("refresh-stale-task-context"),
      auth(),
    );
    expect(contextLoads).toBe(1);

    const targetSnapshotId = "snapshot:refresh-task-context";
    const targetHead = "c".repeat(40);
    await store.persistArtifact(
      await repositorySnapshot(
        targetSnapshotId,
        "2026-07-29T09:00:00.000Z",
        targetHead,
      ),
    );
    await publishPulseForSnapshot(store, targetSnapshotId, targetHead);
    const staled = await taskEngine.updateTask(
      {
        taskId: built.task.taskId,
        action: {
          type: "block_task",
          reasonCode: "refresh_fixture",
          message: "Capture repository drift before refreshing context.",
        },
        expectedRevision: built.task.revision,
        idempotencyKey: "capture-refresh-drift",
        actor: ACTOR,
      },
      auth(),
    );
    expect(staled.task).toMatchObject({
      status: "stale",
      revision: 3,
      latestSnapshotId: targetSnapshotId,
    });

    await expect(
      recoveryHarness.updateTask(
        {
          taskId: built.task.taskId,
          action: {
            type: "refresh_task_context",
            targetSnapshotId: "snapshot:not-current",
          },
          expectedRevision: staled.task.revision,
          idempotencyKey: "refresh-wrong-target",
          actor: ACTOR,
        },
        auth(),
      ),
    ).rejects.toMatchObject({
      code: "task_gate_unsatisfied",
      details: {
        targetStatus: "context_ready",
        failedGuards: [
          {
            code: "target_snapshot_mismatch",
            resourceId: "snapshot:not-current",
          },
        ],
      },
    });
    expect(contextLoads).toBe(1);

    const refreshInput = {
      taskId: built.task.taskId,
      action: {
        type: "refresh_task_context" as const,
        targetSnapshotId,
      },
      expectedRevision: staled.task.revision,
      idempotencyKey: "refresh-current-context",
      actor: ACTOR,
    };
    const refreshed = await recoveryHarness.updateTask(refreshInput, auth());
    expect(refreshed).toMatchObject({
      task: {
        status: "context_ready",
        revision: 4,
        latestSnapshotId: targetSnapshotId,
      },
      mutation: { idempotentReplay: false },
    });
    expect(contextLoads).toBe(2);
    const persisted = await store.readTaskBundle(built.task.taskId);
    expect(persisted.bundle.events.map((event) => event.action.type)).toEqual([
      "task_created",
      "transition_status",
      "task_context_staled",
      "refresh_task_context",
    ]);
    expect(persisted.receipts).toHaveLength(4);
    if (!("brief" in persisted.bundle)) {
      throw new TypeError("The refreshed Task must retain a contextual bundle.");
    }
    expect(
      persisted.bundle.claims.every(
        (claim) => claim.sourceSnapshotId === targetSnapshotId,
      ),
    ).toBe(true);
    expect(persisted.bundle.changeChecks).toEqual([]);
    expect(persisted.bundle.verificationRecords).toEqual([]);

    const replay = await recoveryHarness.updateTask(refreshInput, auth());
    expect(replay).toMatchObject({
      task: { revision: 4, status: "context_ready" },
      mutation: { idempotentReplay: true },
    });
    expect(contextLoads).toBe(2);
    expect(
      (await store.readTaskBundle(built.task.taskId)).bundle.events,
    ).toHaveLength(4);
  });

  it("rebases one stale Task only when target and new baseline equal the current Snapshot", async () => {
    const { store } = await openStore();
    let contextLoads = 0;
    const taskEngine = engine(store, {
      contextProvider: {
        async loadTaskContext(input) {
          contextLoads += 1;
          return contextProvider.loadTaskContext(input);
        },
      },
    });
    const recoveryHarness = legacyContextRecoveryIntegrityHarness(
      store,
      () => {
        contextLoads += 1;
      },
    );
    const built = await taskEngine.buildTaskBrief(
      buildInput("rebase-stale-task-context"),
      auth(),
    );
    const previousBaselineSnapshotId = built.task.baselineSnapshotId;
    const targetSnapshotId = "snapshot:rebase-task-context";
    const targetHead = "d".repeat(40);
    await store.persistArtifact(
      await repositorySnapshot(
        targetSnapshotId,
        "2026-07-29T09:00:00.000Z",
        targetHead,
      ),
    );
    await publishPulseForSnapshot(store, targetSnapshotId, targetHead);
    const staled = await taskEngine.updateTask(
      {
        taskId: built.task.taskId,
        action: {
          type: "block_task",
          reasonCode: "rebase_fixture",
          message: "Capture repository drift before rebasing context.",
        },
        expectedRevision: built.task.revision,
        idempotencyKey: "capture-rebase-drift",
        actor: ACTOR,
      },
      auth(),
    );
    expect(staled.task).toMatchObject({
      status: "stale",
      revision: 3,
      baselineSnapshotId: previousBaselineSnapshotId,
      latestSnapshotId: targetSnapshotId,
    });

    await expect(
      recoveryHarness.updateTask(
        {
          taskId: built.task.taskId,
          action: {
            type: "rebase_task",
            targetSnapshotId,
            newBaselineSnapshotId: previousBaselineSnapshotId,
            reason: "Attempt to retain a non-current baseline.",
          },
          expectedRevision: staled.task.revision,
          idempotencyKey: "rebase-wrong-baseline",
          actor: ACTOR,
        },
        auth(),
      ),
    ).rejects.toMatchObject({
      code: "task_gate_unsatisfied",
      details: {
        targetStatus: "context_ready",
        failedGuards: [
          {
            code: "baseline_snapshot_mismatch",
            resourceId: previousBaselineSnapshotId,
          },
        ],
      },
    });
    expect(contextLoads).toBe(1);

    const rebased = await recoveryHarness.updateTask(
      {
        taskId: built.task.taskId,
        action: {
          type: "rebase_task",
          targetSnapshotId,
          newBaselineSnapshotId: targetSnapshotId,
          reason: "Adopt the exact current Snapshot as the new baseline.",
        },
        expectedRevision: staled.task.revision,
        idempotencyKey: "rebase-current-context",
        actor: ACTOR,
      },
      auth(),
    );
    expect(rebased).toMatchObject({
      task: {
        status: "context_ready",
        revision: 4,
        baselineSnapshotId: targetSnapshotId,
        latestSnapshotId: targetSnapshotId,
      },
      mutation: { idempotentReplay: false },
    });
    expect(contextLoads).toBe(2);
    const persisted = await store.readTaskBundle(built.task.taskId);
    expect(persisted.bundle.events.at(-1)).toMatchObject({
      previousStatus: "stale",
      resultingStatus: "context_ready",
      action: {
        type: "rebase_task",
        targetSnapshotId,
        newBaselineSnapshotId: targetSnapshotId,
      },
    });
    if (!("brief" in persisted.bundle)) {
      throw new TypeError("The rebased Task must retain a contextual bundle.");
    }
    expect(
      persisted.bundle.claims.every(
        (claim) => claim.sourceSnapshotId === targetSnapshotId,
      ),
    ).toBe(true);
    expect(persisted.bundle.changeChecks).toEqual([]);
    expect(persisted.bundle.verificationRecords).toEqual([]);
  });

  it("uses host time monotonically and rejects ordinary actions while blocked", async () => {
    const { store } = await openStore();
    let now = new Date(FIXED_NOW);
    const taskEngine = engine(store, { clock: () => now });
    const built = await taskEngine.buildTaskBrief(
      buildInput("monotonic-clock-and-blocked-guard"),
      auth(),
    );

    now = new Date("2026-07-29T12:00:00.000Z");
    const confirmed = await taskEngine.updateTask(
      {
        taskId: built.task.taskId,
        action: {
          type: "confirm_goal",
          claimId: built.brief.goalClaimId,
        },
        expectedRevision: 2,
        idempotencyKey: "clock-confirm-goal",
        actor: ACTOR,
      },
      auth(),
    );
    expect(confirmed.task.updatedAt).toBe("2026-07-29T12:00:00.000Z");

    now = new Date("2026-07-29T07:00:00.000Z");
    const blocked = await taskEngine.updateTask(
      {
        taskId: built.task.taskId,
        action: {
          type: "block_task",
          reasonCode: "manual_pause",
          message: "Pause ordinary mutations.",
        },
        expectedRevision: 3,
        idempotencyKey: "clock-block-task",
        actor: ACTOR,
      },
      auth(),
    );
    expect(blocked.task).toMatchObject({
      status: "blocked",
      revision: 4,
      updatedAt: "2026-07-29T12:00:00.001Z",
    });

    await expect(
      taskEngine.updateTask(
        {
          taskId: built.task.taskId,
          action: {
            type: "confirm_goal",
            claimId: built.brief.goalClaimId,
          },
          expectedRevision: 4,
          idempotencyKey: "blocked-confirm-must-fail",
          actor: ACTOR,
        },
        auth(),
      ),
    ).rejects.toMatchObject({
      code: "task_transition_rejected",
      details: {
        currentStatus: "blocked",
        requestedAction: "confirm_goal",
        guard: "transition_not_allowed",
      },
    });
    expect(
      (await store.readTaskBundle(built.task.taskId)).bundle.manifest.revision,
    ).toBe(4);

    now = new Date("2026-07-29T13:00:00.000Z");
    const superseded = await taskEngine.updateTask(
      {
        taskId: built.task.taskId,
        action: {
          type: "supersede_task",
          reason: "Replace the blocked Task.",
        },
        expectedRevision: 4,
        idempotencyKey: "supersede-blocked-task",
        actor: ACTOR,
      },
      auth(["task:supersede"]),
    );
    expect(superseded.task).toMatchObject({
      status: "superseded",
      revision: 5,
      updatedAt: "2026-07-29T13:00:00.000Z",
      supersession: {
        supersededFromStatus: "blocked",
      },
    });
  });

  it("rejects ordinary stale actions while preserving the three recovery routes", async () => {
    const { store } = await openStore();
    const built = await engine(store).buildTaskBrief(
      buildInput("stale-action-matrix"),
      auth(),
    );
    const current = await store.readTaskBundle(built.task.taskId);
    const staleManifest = TaskManifestV1Schema.parse({
      ...current.bundle.manifest,
      status: "stale",
      staleState: {
        staleFromStatus: "context_ready",
        reasonCodes: ["repository_snapshot_advanced"],
        detectedAtSnapshotId: current.bundle.manifest.latestSnapshotId,
        detectedAt: current.bundle.manifest.updatedAt,
      },
    });
    const staleRead: ReadTaskBundleResult = {
      ...current,
      bundle: {
        ...current.bundle,
        manifest: staleManifest,
      },
    };
    let persistedStatus: string | undefined;
    const staleStore = {
      worktreeId: store.worktreeId,
      async readTaskBundle() {
        return staleRead;
      },
      async persistTaskBundle(input: {
        artifacts: readonly PersistedArtifactV1[];
      }) {
        const taskArtifact = input.artifacts.find(
          (artifact) => artifact.artifactType === "task_manifest",
        );
        persistedStatus =
          taskArtifact?.artifactType === "task_manifest"
            ? taskArtifact.payload.status
            : undefined;
      },
    } as unknown as ArtifactStore;
    const baseInput = {
      taskId: built.task.taskId,
      expectedRevision: staleManifest.revision,
      actor: ACTOR,
    };
    const illegalActions = [
      {
        action: {
          type: "confirm_goal" as const,
          claimId: built.brief.goalClaimId,
        },
        idempotencyKey: "stale-confirm-goal",
      },
      {
        action: { type: "resume_task" as const },
        idempotencyKey: "stale-resume",
      },
      {
        action: {
          type: "block_task" as const,
          reasonCode: "still_stale",
          message: "A stale Task cannot be blocked again.",
        },
        idempotencyKey: "stale-block",
      },
      {
        action: {
          type: "transition_status" as const,
          to: "planned" as const,
        },
        idempotencyKey: "stale-transition",
      },
    ];
    for (const candidate of illegalActions) {
      await expect(
        applyTaskUpdate(
          staleStore,
          { ...baseInput, ...candidate },
          () => new Date("2026-07-29T14:00:00.000Z"),
        ),
      ).rejects.toMatchObject({
        code: "task_transition_rejected",
        details: {
          currentStatus: "stale",
          requestedAction: candidate.action.type,
          guard: "transition_not_allowed",
        },
      });
    }

    for (const action of [
      {
        type: "refresh_task_context" as const,
        targetSnapshotId: staleManifest.latestSnapshotId,
      },
      {
        type: "rebase_task" as const,
        targetSnapshotId: staleManifest.latestSnapshotId,
        newBaselineSnapshotId: staleManifest.latestSnapshotId,
        reason: "Rebuild context on the current baseline.",
      },
    ]) {
      await expect(
        applyTaskUpdate(
          staleStore,
          {
            ...baseInput,
            action,
            idempotencyKey: `stale-${action.type}`,
          },
          () => new Date("2026-07-29T14:00:00.000Z"),
        ),
      ).rejects.toMatchObject({
        code: "task_gate_unsatisfied",
        details: {
          targetStatus: "context_ready",
        },
      });
    }

    const superseded = await applyTaskUpdate(
      staleStore,
      {
        ...baseInput,
        action: {
          type: "supersede_task",
          reason: "Replace stale context with a new Task.",
        },
        idempotencyKey: "stale-supersede",
      },
      () => new Date("2026-07-29T14:00:00.000Z"),
    );
    expect(superseded.task).toMatchObject({
      status: "superseded",
      supersession: {
        supersededFromStatus: "stale",
      },
    });
    expect(persistedStatus).toBe("superseded");
  });

  it("fails closed on missing planning confirmations and terminal Task mutations", async () => {
    const { store } = await openStore();
    const taskEngine = engine(store);
    const built = await taskEngine.buildTaskBrief(
      buildInput("guard-and-terminal"),
      auth(),
    );
    await expect(
      taskEngine.updateTask(
        {
          taskId: built.task.taskId,
          action: { type: "transition_status", to: "planned" },
          expectedRevision: 2,
          idempotencyKey: "planned-without-confirmation",
          actor: ACTOR,
        },
        auth(),
      ),
    ).rejects.toMatchObject({ code: "task_gate_unsatisfied" });
    expect(
      (await store.readTaskBundle(built.task.taskId)).bundle.manifest.revision,
    ).toBe(2);

    const superseded = await taskEngine.updateTask(
      {
        taskId: built.task.taskId,
        action: {
          type: "supersede_task",
          reason: "The requested work moved to another Task.",
        },
        expectedRevision: 2,
        idempotencyKey: "supersede-task",
        actor: ACTOR,
      },
      auth(["task:supersede"]),
    );
    expect(superseded.task).toMatchObject({
      revision: 3,
      status: "superseded",
    });
    await expect(
      taskEngine.updateTask(
        {
          taskId: built.task.taskId,
          action: {
            type: "confirm_goal",
            claimId: built.brief.goalClaimId,
          },
          expectedRevision: 3,
          idempotencyKey: "mutate-terminal-task",
          actor: ACTOR,
        },
        auth(),
      ),
    ).rejects.toMatchObject({ code: "task_transition_rejected" });
    expect(
      (await store.readTaskBundle(built.task.taskId)).bundle.manifest.revision,
    ).toBe(3);
  });

  it("executes the complete guarded lifecycle through accepted findings and verification skips", async () => {
    const { store } = await openStore();
    const boundaryProvider: ContextLoader = {
      async loadTaskContext(input) {
        const context = await contextProvider.loadTaskContext(input);
        return {
          ...context,
          existingFilePaths: ["src/task.ts"],
        };
      },
    };
    const taskEngine = engine(store, { contextProvider: boundaryProvider });
    const built = await taskEngine.buildTaskBrief(
      buildInput("complete-guarded-lifecycle"),
      auth(),
    );
    expect(built.brief.assumptionClaimIds.length).toBeGreaterThan(0);
    expect(built.brief.unknownClaimIds.length).toBeGreaterThan(0);

    let revision = built.task.revision;
    const update = async (
      action: Parameters<TaskEngine["updateTask"]>[0]["action"],
      key: string,
      capabilities: AuthorizationContext["capabilities"] = ALL_CAPABILITIES,
    ) => {
      const outcome = await taskEngine.updateTask(
        {
          taskId: built.task.taskId,
          action,
          expectedRevision: revision,
          idempotencyKey: key,
          actor: ACTOR,
        },
        auth(capabilities),
      );
      revision = outcome.task.revision;
      return outcome;
    };

    await update(
      { type: "confirm_goal", claimId: built.brief.goalClaimId },
      "full-confirm-goal",
    );
    await update(
      {
        type: "confirm_acceptance_criteria",
        claimIds: built.brief.acceptanceClaimIds,
      },
      "full-confirm-acceptance",
    );
    await update(
      {
        type: "record_assumption",
        claimId: built.brief.assumptionClaimIds[0]!,
      },
      "full-record-assumption",
    );
    await update(
      {
        type: "confirm_unknown",
        claimId: built.brief.unknownClaimIds[0]!,
      },
      "full-confirm-unknown",
    );
    await update(
      {
        type: "confirm_plan",
        plannedChangeIds: built.brief.plannedChanges.map(
          (change) => change.id,
        ),
      },
      "full-confirm-plan",
    );
    await update(
      { type: "transition_status", to: "planned" },
      "full-transition-planned",
    );
    await update(
      { type: "transition_status", to: "in_progress" },
      "full-transition-in-progress",
    );
    await update(
      { type: "transition_status", to: "check_required" },
      "full-transition-check-required",
    );

    const checked = await appendTrustedChangeCheck(
      store,
      built.task.taskId,
      { blocking: true },
    );
    if (!("brief" in checked.bundle)) {
      throw new TypeError("The checked lifecycle bundle must be contextual.");
    }
    revision = checked.bundle.manifest.revision;
    const findingId = checked.bundle.changeChecks[0]!.findings[0]!.id;
    await expect(
      update(
        { type: "transition_status", to: "verification_required" },
        "full-blocked-verification-transition",
      ),
    ).rejects.toMatchObject({ code: "task_gate_unsatisfied" });
    expect(revision).toBe(checked.bundle.manifest.revision);

    await update(
      {
        type: "accept_finding",
        findingId,
        reason: "The authorized Agent accepts this bounded uncertainty.",
      },
      "full-accept-finding",
      ["task:accept"],
    );
    await update(
      { type: "transition_status", to: "verification_required" },
      "full-transition-verification-required",
    );

    const verified = await appendTrustedVerification(
      store,
      built.task.taskId,
      { status: "skipped" },
    );
    if (!("brief" in verified.bundle)) {
      throw new TypeError(
        "The verification lifecycle bundle must be contextual.",
      );
    }
    revision = verified.bundle.manifest.revision;
    const verificationRecordId =
      verified.bundle.verificationRecords.at(-1)!.id;
    await expect(
      update(
        { type: "transition_status", to: "verified" },
        "full-unaccepted-skip-transition",
      ),
    ).rejects.toMatchObject({ code: "task_gate_unsatisfied" });
    expect(revision).toBe(verified.bundle.manifest.revision);

    await update(
      {
        type: "accept_verification_skip",
        verificationRecordId,
        reason: "The repository gate was unavailable in this bounded run.",
      },
      "full-accept-verification-skip",
      ["task:accept"],
    );
    const terminal = await update(
      { type: "transition_status", to: "verified" },
      "full-transition-verified",
    );
    expect(terminal.task).toMatchObject({
      status: "verified",
      revision: 16,
    });

    const persisted = await store.readTaskBundle(built.task.taskId);
    if (!("brief" in persisted.bundle)) {
      throw new TypeError("The terminal lifecycle bundle must be contextual.");
    }
    expect(persisted.bundle.manifest.status).toBe("verified");
    expect(
      persisted.bundle.changeChecks[0]!.findings[0]!.resolution,
    ).toMatchObject({ kind: "accepted", actor: ACTOR });
    expect(
      VerificationRecordV1Schema.parse(
        persisted.bundle.verificationRecords.at(-1),
      ).skipAcceptance,
    ).toMatchObject({ actor: ACTOR });
    expect(persisted.bundle.events.map((event) => event.action.type)).toEqual(
      expect.arrayContaining([
        "record_assumption",
        "confirm_unknown",
        "change_checked",
        "accept_finding",
        "verification_recorded",
        "accept_verification_skip",
      ]),
    );
    expect(persisted.bundle.events).toHaveLength(16);
    expect(persisted.receipts).toHaveLength(16);

    await expect(
      taskEngine.updateTask(
        {
          taskId: built.task.taskId,
          action: {
            type: "supersede_task",
            reason: "Terminal Tasks cannot be reopened or replaced in place.",
          },
          expectedRevision: terminal.task.revision,
          idempotencyKey: "full-terminal-mutation",
          actor: ACTOR,
        },
        auth(["task:supersede"]),
      ),
    ).rejects.toMatchObject({ code: "task_transition_rejected" });
    await expectStoreLocksReleased(store, built.task.taskId);
  }, 15_000);

  it("supersedes a stale read on the current Repository Snapshot without a new Pulse", async () => {
    const { store } = await openStore();
    const taskEngine = engine(store);
    const built = await taskEngine.buildTaskBrief(
      buildInput("supersede-after-snapshot-advance"),
      auth(),
    );
    const nextSnapshotId = "snapshot:advanced-task-lifecycle";
    await store.persistArtifact(await advancedSnapshot(nextSnapshotId));

    const staleRead = await store.readTaskBundle(built.task.taskId);
    expect(staleRead).toMatchObject({
      freshness: "stale",
      latestSnapshotId: nextSnapshotId,
      bundle: {
        manifest: {
          latestSnapshotId: "snapshot:actual",
          revision: 2,
        },
      },
    });

    const superseded = await taskEngine.updateTask(
      {
        taskId: built.task.taskId,
        action: {
          type: "supersede_task",
          reason: "The repository advanced and this Task is no longer active.",
        },
        expectedRevision: 2,
        idempotencyKey: "supersede-stale-snapshot",
        actor: ACTOR,
      },
      auth(["task:supersede"]),
    );
    expect(superseded.task).toMatchObject({
      status: "superseded",
      revision: 3,
      latestSnapshotId: nextSnapshotId,
    });

    const persisted = await store.readTaskBundle(built.task.taskId);
    expect(persisted).toMatchObject({
      freshness: "partial",
      latestSnapshotId: nextSnapshotId,
      bundle: {
        manifest: {
          status: "superseded",
          latestSnapshotId: nextSnapshotId,
        },
      },
    });
    expect(persisted.bundle.events.at(-1)).toMatchObject({
      action: { type: "supersede_task" },
      sourceSnapshotId: nextSnapshotId,
    });
  });

  it("lets another authorized Agent continue a Task and records blocked context drift as stale", async () => {
    const { store } = await openStore();
    const taskEngine = engine(store);
    const built = await taskEngine.buildTaskBrief(
      buildInput("cross-agent-blocked-stale"),
      auth(),
    );
    const secondActor = "claude";
    const confirmed = await taskEngine.updateTask(
      {
        taskId: built.task.taskId,
        action: {
          type: "confirm_goal",
          claimId: built.brief.goalClaimId,
        },
        expectedRevision: 2,
        idempotencyKey: "claude-confirm-goal",
        actor: secondActor,
      },
      auth(ALL_CAPABILITIES, secondActor),
    );
    const blocked = await taskEngine.updateTask(
      {
        taskId: built.task.taskId,
        action: {
          type: "block_task",
          reasonCode: "waiting_for_repository_update",
          message: "Resume after the repository update is available.",
        },
        expectedRevision: confirmed.task.revision,
        idempotencyKey: "claude-block-task",
        actor: secondActor,
      },
      auth(ALL_CAPABILITIES, secondActor),
    );
    expect(blocked.task).toMatchObject({
      status: "blocked",
      blockedState: { resumeStatus: "context_ready" },
    });

    const nextSnapshotId = "snapshot:cross-agent-blocked-stale";
    await store.persistArtifact(await advancedSnapshot(nextSnapshotId));
    const staled = await taskEngine.updateTask(
      {
        taskId: built.task.taskId,
        action: { type: "resume_task" },
        expectedRevision: blocked.task.revision,
        idempotencyKey: "codex-resume-after-drift",
        actor: ACTOR,
      },
      auth(),
    );
    expect(staled.task).toMatchObject({
      status: "stale",
      latestSnapshotId: nextSnapshotId,
      staleState: {
        staleFromStatus: "blocked",
        detectedAtSnapshotId: nextSnapshotId,
        reasonCodes: [
          "repository_snapshot_advanced",
          "task_bundle_freshness_stale",
        ],
      },
    });
    expect(staled.task.blockedState).toBeUndefined();

    const persisted = await store.readTaskBundle(built.task.taskId);
    expect(persisted.bundle.events.slice(-3).map((event) => ({
      actor: event.actor,
      action: event.action.type,
    }))).toEqual([
      { actor: secondActor, action: "confirm_goal" },
      { actor: secondActor, action: "block_task" },
      { actor: ACTOR, action: "task_context_staled" },
    ]);

    const historicalReplay = await taskEngine.updateTask(
      {
        taskId: built.task.taskId,
        action: {
          type: "confirm_goal",
          claimId: built.brief.goalClaimId,
        },
        expectedRevision: 2,
        idempotencyKey: "claude-confirm-goal",
        actor: secondActor,
      },
      auth(ALL_CAPABILITIES, secondActor),
    );
    expect(historicalReplay).toMatchObject({
      task: { revision: 3, status: "context_ready" },
      mutation: { revision: 3, idempotentReplay: true },
    });
    expect(
      (await store.readTaskBundle(built.task.taskId)).bundle.manifest.revision,
    ).toBe(staled.task.revision);
  });

  it("drops snapshot-bound Check and Verification projections while preserving their receipts", async () => {
    const { store } = await openStore();
    const taskEngine = engine(store);
    const built = await taskEngine.buildTaskBrief(
      buildInput("supersede-snapshot-bound-projections"),
      auth(),
    );
    const taskId = built.task.taskId;
    await taskEngine.updateTask(
      {
        taskId,
        action: {
          type: "confirm_goal",
          claimId: built.brief.goalClaimId,
        },
        expectedRevision: 2,
        idempotencyKey: "projection-confirm-goal",
        actor: ACTOR,
      },
      auth(),
    );
    await taskEngine.updateTask(
      {
        taskId,
        action: {
          type: "confirm_acceptance_criteria",
          claimIds: built.brief.acceptanceClaimIds,
        },
        expectedRevision: 3,
        idempotencyKey: "projection-confirm-acceptance",
        actor: ACTOR,
      },
      auth(),
    );
    await taskEngine.updateTask(
      {
        taskId,
        action: {
          type: "confirm_plan",
          plannedChangeIds: built.brief.plannedChanges.map(
            (change) => change.id,
          ),
        },
        expectedRevision: 4,
        idempotencyKey: "projection-confirm-plan",
        actor: ACTOR,
      },
      auth(),
    );
    for (const [expectedRevision, to] of [
      [5, "planned"],
      [6, "in_progress"],
      [7, "check_required"],
    ] as const) {
      await taskEngine.updateTask(
        {
          taskId,
          action: { type: "transition_status", to },
          expectedRevision,
          idempotencyKey: `projection-transition-${to}`,
          actor: ACTOR,
        },
        auth(),
      );
    }

    const checked = await appendTrustedChangeCheck(store, taskId);
    expect(checked.bundle.manifest).toMatchObject({
      status: "check_required",
      revision: 9,
    });
    expect(
      checked.artifacts.map((artifact) => artifact.artifactType),
    ).toContain("change_check");
    await taskEngine.updateTask(
      {
        taskId,
        action: {
          type: "transition_status",
          to: "verification_required",
        },
        expectedRevision: 9,
        idempotencyKey: "projection-transition-verification-required",
        actor: ACTOR,
      },
      auth(),
    );
    const verifiedProjection = await appendTrustedVerification(
      store,
      taskId,
    );
    expect(verifiedProjection.bundle.manifest).toMatchObject({
      status: "verification_required",
      revision: 11,
    });
    expect(
      verifiedProjection.artifacts.map(
        (artifact) => artifact.artifactType,
      ),
    ).toEqual(
      expect.arrayContaining(["change_check", "verification"]),
    );
    if (!("brief" in verifiedProjection.bundle)) {
      throw new TypeError("The verified projection must remain contextual.");
    }
    const verificationId =
      verifiedProjection.bundle.verificationRecords[0]!.id;
    const findingId =
      verifiedProjection.bundle.changeChecks[0]!.findings[0]!.id;
    expect(
      verifiedProjection.bundle.claims.some((claim) =>
        "verificationRecordIds" in claim &&
        claim.verificationRecordIds.includes(verificationId)
      ),
    ).toBe(true);
    expect(
      verifiedProjection.bundle.claims.some((claim) =>
        (claim.findingIds as readonly string[]).includes(findingId)
      ),
    ).toBe(true);

    const nextSnapshotId = "snapshot:advanced-with-projections";
    await store.persistArtifact(await advancedSnapshot(nextSnapshotId));
    const staleRead = await store.readTaskBundle(taskId);
    expect(staleRead).toMatchObject({
      freshness: "stale",
      latestSnapshotId: nextSnapshotId,
    });

    let transitionArtifacts: readonly PersistedArtifactV1[] = [];
    const transitionHarness = {
      worktreeId: store.worktreeId,
      async readTaskBundle() {
        return staleRead;
      },
      async persistTaskBundle(input: {
        artifacts: readonly PersistedArtifactV1[];
      }) {
        transitionArtifacts = input.artifacts;
      },
    } as unknown as ArtifactStore;
    const checkRequired = await applyTaskUpdate(
      transitionHarness,
      {
        taskId,
        action: {
          type: "transition_status",
          to: "check_required",
        },
        expectedRevision: 11,
        idempotencyKey: "projection-refresh-check-required",
        actor: ACTOR,
      },
      () => new Date("2026-07-29T15:00:00.000Z"),
    );
    expect(checkRequired.task).toMatchObject({
      status: "check_required",
      latestSnapshotId: nextSnapshotId,
    });
    const transitionArtifactTypes = transitionArtifacts.map(
      (artifact) => artifact.artifactType,
    );
    expect(transitionArtifactTypes).not.toContain("change_check");
    expect(transitionArtifactTypes).not.toContain("verification");
    const transitionClaims = transitionArtifacts.find(
      (artifact) => artifact.artifactType === "claim_ledger",
    );
    if (transitionClaims?.artifactType !== "claim_ledger") {
      throw new TypeError("The transition must retain its Claim Ledger.");
    }
    expect(
      transitionClaims.payload.claims.every(
        (claim) =>
          !(claim.findingIds as readonly string[]).includes(findingId) &&
          (!("verificationRecordIds" in claim) ||
            !claim.verificationRecordIds.includes(verificationId)),
      ),
    ).toBe(true);

    const superseded = await taskEngine.updateTask(
      {
        taskId,
        action: {
          type: "supersede_task",
          reason: "Replace projections bound to the previous Snapshot.",
        },
        expectedRevision: 11,
        idempotencyKey: "projection-supersede",
        actor: ACTOR,
      },
      auth(["task:supersede"]),
    );
    expect(superseded.task).toMatchObject({
      status: "superseded",
      revision: 12,
      latestSnapshotId: nextSnapshotId,
    });

    const persisted = await store.readTaskBundle(taskId);
    const persistedArtifactTypes = persisted.artifacts.map(
      (artifact) => artifact.artifactType,
    );
    expect(persistedArtifactTypes).not.toContain("change_check");
    expect(persistedArtifactTypes).not.toContain("verification");
    if (!("brief" in persisted.bundle)) {
      throw new TypeError("The superseded Task lost its contextual bundle.");
    }
    expect(persisted.bundle.changeChecks).toEqual([]);
    expect(persisted.bundle.verificationRecords).toEqual([]);
    expect(
      persisted.bundle.claims.every(
        (claim) =>
          !("verificationRecordIds" in claim) ||
          !claim.verificationRecordIds.includes(verificationId),
      ),
    ).toBe(true);
    expect(
      persisted.bundle.claims.every(
        (claim) => !(claim.findingIds as readonly string[]).includes(findingId),
      ),
    ).toBe(true);
    expect(persisted.receipts.map((receipt) => receipt.operation)).toEqual(
      expect.arrayContaining(["check_change", "record_verification"]),
    );
    expect(persisted.bundle.events).toHaveLength(12);
    expect(persisted.receipts).toHaveLength(12);
    await expectStoreLocksReleased(store, taskId);
  }, 15_000);

  it("invalidates a page cursor after a Task revision changes", async () => {
    const { store } = await openStore();
    const taskEngine = engine(store);
    const built = await taskEngine.buildTaskBrief(
      buildInput("cursor-revision"),
      auth(),
    );
    const first = await taskEngine.getTaskBrief({
      taskId: built.task.taskId,
      section: "reading_path",
      pageSize: 1,
    });
    expect(first.nextCursor).toBeDefined();
    await taskEngine.updateTask(
      {
        taskId: built.task.taskId,
        action: {
          type: "confirm_goal",
          claimId: built.brief.goalClaimId,
        },
        expectedRevision: 2,
        idempotencyKey: "cursor-confirm-goal",
        actor: ACTOR,
      },
      auth(),
    );
    await expect(
      taskEngine.getTaskBrief({
        taskId: built.task.taskId,
        section: "reading_path",
        pageSize: 1,
        cursor: first.nextCursor,
      }),
    ).rejects.toMatchObject({ code: "invalid_cursor" });
  });

  it("fails closed when the trusted operation Journal bytes are corrupted", async () => {
    const { store } = await openStore();
    const taskEngine = engine(store);
    const built = await taskEngine.buildTaskBrief(
      buildInput("corrupt-journal"),
      auth(),
    );
    await writeFile(
      store.layout.task(built.task.taskId).operationJournal,
      '{"schemaVersion":1,"corrupt":true}\n',
      "utf8",
    );

    await expect(
      store.readTaskBundle(built.task.taskId),
    ).rejects.toMatchObject({
      code: expect.stringMatching(
        /^(?:artifact_corrupt|reference_integrity_failed)$/u,
      ),
    });
    await expect(
      taskEngine.buildTaskBrief(
        buildInput("corrupt-journal"),
        auth(),
      ),
    ).rejects.toMatchObject({
      code: expect.stringMatching(
        /^(?:artifact_corrupt|reference_integrity_failed)$/u,
      ),
    });
  });

  it("fails closed without a trusted change analyzer and records a failed Verification", async () => {
    const { store } = await openStore();
    const taskEngine = engine(store);
    const built = await taskEngine.buildTaskBrief(
      buildInput("change-intelligence-vertical"),
      auth(),
    );
    const taskId = built.task.taskId;
    let revision = built.task.revision;
    const updates = [
      {
        action: { type: "confirm_goal" as const, claimId: built.brief.goalClaimId },
        key: "ci-confirm-goal",
      },
      {
        action: {
          type: "confirm_acceptance_criteria" as const,
          claimIds: built.brief.acceptanceClaimIds,
        },
        key: "ci-confirm-acceptance",
      },
      {
        action: {
          type: "confirm_plan" as const,
          plannedChangeIds: built.brief.plannedChanges.map((change) => change.id),
        },
        key: "ci-confirm-plan",
      },
      {
        action: { type: "transition_status" as const, to: "planned" as const },
        key: "ci-transition-planned",
      },
      {
        action: { type: "transition_status" as const, to: "in_progress" as const },
        key: "ci-transition-progress",
      },
    ];
    for (const update of updates) {
      const result = await taskEngine.updateTask(
        {
          taskId,
          action: update.action,
          expectedRevision: revision,
          idempotencyKey: update.key,
          actor: ACTOR,
        },
        auth(),
      );
      revision = result.task.revision;
    }

    const base = await advancedSnapshot("snapshot:change-intelligence");
    if (base.artifactType !== "repository_snapshot") {
      throw new TypeError("The fixture Snapshot must be a Repository Snapshot.");
    }
    const payload = {
      ...base.payload,
      snapshotId: "snapshot:change-intelligence",
      changes: [
        ...base.payload.changes,
        {
          id: "change:unplanned-ci",
          path: "src/unplanned-ci.ts",
          source: "untracked" as const,
          kind: "added" as const,
        },
      ],
    };
    await store.persistArtifact(
      RepositorySnapshotArtifactV1Schema.parse({
        ...base,
        artifactId: "artifact:repository-snapshot:snapshot:change-intelligence",
        sourceSnapshotId: payload.snapshotId,
        contentDigest: sha256CanonicalJson(payload),
        payload,
      }),
    );
    const pulseBase = await loadFixture("repo-pulse.json");
    if (pulseBase.artifactType !== "repo_pulse") {
      throw new TypeError("The fixture Pulse must be a Repo Pulse.");
    }
    if (pulseBase.payload.changeSummary === undefined) {
      throw new TypeError("The fixture Pulse must include a change summary.");
    }
    const pulsePayload = {
      ...pulseBase.payload,
      evaluatedSnapshotId: "snapshot:change-intelligence",
      changeSummary: {
        ...pulseBase.payload.changeSummary,
        total: 2,
        bySource: {
          ...pulseBase.payload.changeSummary.bySource,
          untracked: 1,
        },
        byKind: {
          ...pulseBase.payload.changeSummary.byKind,
          added: 1,
        },
      },
      evaluatedAt: "2026-07-29T09:00:01.000Z",
    };
    await store.persistArtifact(
      RepoPulseArtifactV1Schema.parse({
        ...pulseBase,
        revision: 1,
        sourceSnapshotId: "snapshot:change-intelligence",
        createdAt: "2026-07-29T09:00:01.000Z",
        contentDigest: sha256CanonicalJson(pulsePayload),
        payload: pulsePayload,
      }),
      {
        expectedRevision: 0,
        idempotencyKey: "ci-pulse-refresh",
        requestDigest: sha256CanonicalJson({
          operation: "ci-pulse-refresh",
          snapshotId: "snapshot:change-intelligence",
        }),
      },
    );
    const captured = await taskEngine.updateTask(
      {
        taskId,
        action: { type: "transition_status", to: "check_required" },
        expectedRevision: revision,
        idempotencyKey: "ci-capture",
        actor: ACTOR,
      },
      auth(),
    );
    revision = captured.task.revision;

    const checked = await taskEngine.checkChange(
      {
        taskId,
        actualSnapshotId: "snapshot:change-intelligence",
        includeWorktree: true,
        expectedRevision: revision,
        idempotencyKey: "ci-check",
        actor: ACTOR,
      },
      auth(["task:update"]),
    );
    expect(checked.changeCheck.findings.length).toBeGreaterThan(0);
    expect(checked.changeCheck.findings.every(
      (finding) => finding.type === "cannot_determine" && finding.blocking,
    )).toBe(true);
    expect(checked.changeCheck.findings.some((finding) =>
      ["planned_completed", "unplanned_change", "possible_omission"].includes(finding.type),
    )).toBe(false);
    revision = checked.mutation.revision;

    for (const finding of checked.changeCheck.findings.filter(
      (candidate) => candidate.blocking,
    )) {
      const accepted = await taskEngine.updateTask(
        {
          taskId,
          action: {
            type: "accept_finding",
            findingId: finding.id,
            reason: "Focused Change Intelligence integration fixture.",
          },
          expectedRevision: revision,
          idempotencyKey: `ci-accept-${finding.id}`,
          actor: ACTOR,
        },
        auth(),
      );
      revision = accepted.task.revision;
    }
    const verificationRequired = await taskEngine.updateTask(
      {
        taskId,
        action: { type: "transition_status", to: "verification_required" },
        expectedRevision: revision,
        idempotencyKey: "ci-transition-verification",
        actor: ACTOR,
      },
      auth(),
    );
    revision = verificationRequired.task.revision;
    const verificationRequiredRead = await store.readTaskBundle(taskId);
    if (!("brief" in verificationRequiredRead.bundle)) {
      throw new TypeError("The verification fixture must remain contextual.");
    }
    const planEntry = built.brief.verificationPlan[0]!;
    const verificationInput = {
      taskId,
      record: {
        verificationPlanEntryId: planEntry.id,
        kind: planEntry.method,
        status: "failed" as const,
        command: "pnpm test",
        exitCode: 1,
        durationMs: 10,
        summary: "Focused verification failure fixture.",
        claimIds: planEntry.acceptanceClaimIds,
        snapshotId: "snapshot:change-intelligence",
      },
      expectedRevision: revision,
      idempotencyKey: "ci-verification-failed",
      actor: ACTOR,
    };
    const recorded = await taskEngine.recordVerification(
      verificationInput,
      auth(["task:update"]),
    );
    expect(recorded.verification.status).toBe("failed");
    expect(recorded.verification.attempt).toBe(1);
    await expect(
      taskEngine.recordVerification(
        { ...verificationInput, expectedRevision: recorded.mutation.revision, idempotencyKey: "ci-verification-duplicate" },
        auth(["task:update"]),
      ),
    ).rejects.toMatchObject({ code: "task_gate_unsatisfied" });

    const passed = await taskEngine.recordVerification(
      {
        ...verificationInput,
        record: {
          ...verificationInput.record,
          supersedesVerificationRecordId: recorded.verification.id,
          status: "passed",
          exitCode: 0,
          summary: "Focused verification recovery passed.",
        },
        expectedRevision: recorded.mutation.revision,
        idempotencyKey: "ci-verification-recovered",
      },
      auth(["task:update"]),
    );
    expect(passed.verification).toMatchObject({
      attempt: 2,
      status: "passed",
      supersedesVerificationRecordId: recorded.verification.id,
    });

    for (const [name, verificationRecordId] of [
      ["missing", undefined],
      ["superseded", recorded.verification.id],
      ["passed", passed.verification.id],
    ] as const) {
      await expect(
        taskEngine.updateTask(
          {
            taskId,
            action: {
              type: "transition_status",
              to: "in_progress",
              ...(verificationRecordId === undefined
                ? {}
                : { verificationRecordId }),
            },
            expectedRevision: passed.mutation.revision,
            idempotencyKey: `ci-verification-recovery-${name}`,
            actor: ACTOR,
          },
          auth(),
        ),
      ).rejects.toMatchObject({ code: "task_gate_unsatisfied" });
    }

    const current = await store.readTaskBundle(taskId);
    if (!("brief" in current.bundle)) {
      throw new TypeError("The recovery fixture must remain contextual.");
    }
    const coveredClaim = current.bundle.claims.find(
      (claim) => claim.id === planEntry.acceptanceClaimIds[0],
    );
    if (coveredClaim === undefined) {
      throw new TypeError("The recovery fixture requires an acceptance Claim.");
    }
    const additionalClaim = ClaimV1Schema.parse({
      ...coveredClaim,
      id: "claim:verification-additional-acceptance",
      statement:
        "The recovered Verification must cover an additional acceptance criterion.",
      verificationRecordIds: [],
    });
    const incompleteCoverageRead: ReadTaskBundleResult = {
      ...current,
      bundle: {
        ...current.bundle,
        brief: {
          ...current.bundle.brief,
          acceptanceClaimIds: [
            ...current.bundle.brief.acceptanceClaimIds,
            additionalClaim.id,
          ],
          verificationPlan: current.bundle.brief.verificationPlan.map((entry) =>
            entry.id === planEntry.id
              ? {
                  ...entry,
                  acceptanceClaimIds: [
                    ...entry.acceptanceClaimIds,
                    additionalClaim.id,
                  ],
                }
              : entry,
          ),
        },
        claims: [...current.bundle.claims, additionalClaim],
      },
    };
    const expectCoverageRejected = async (
      read: ReadTaskBundleResult,
      idempotencyKey: string,
    ): Promise<void> => {
      let persistCount = 0;
      const harness = {
        worktreeId: store.worktreeId,
        async readTaskBundle() {
          return read;
        },
        async persistTaskBundle() {
          persistCount += 1;
        },
      } as unknown as ArtifactStore;
      await expect(
        applyTaskUpdate(
          harness,
          {
            taskId,
            action: { type: "transition_status", to: "verified" },
            expectedRevision: passed.mutation.revision,
            idempotencyKey,
            actor: ACTOR,
          },
          () => new Date("2026-07-29T09:00:02.000Z"),
        ),
      ).rejects.toMatchObject({ code: "task_gate_unsatisfied" });
      expect(persistCount).toBe(0);
    };

    const legacyRequiredVerificationRead: ReadTaskBundleResult = {
      ...current,
      bundle: {
        ...current.bundle,
        brief: {
          ...current.bundle.brief,
          verificationPlan: current.bundle.brief.verificationPlan.map(
            (entry) => {
              const { required: _required, ...legacyEntry } = entry;
              return legacyEntry;
            },
          ),
        },
        verificationRecords: [recorded.verification],
      },
    };
    await expectCoverageRejected(
      legacyRequiredVerificationRead,
      "ci-verification-legacy-required",
    );

    const explicitlyOptionalVerificationRead: ReadTaskBundleResult = {
      ...verificationRequiredRead,
      bundle: {
        ...verificationRequiredRead.bundle,
        brief: {
          ...verificationRequiredRead.bundle.brief,
          verificationPlan: verificationRequiredRead.bundle.brief.verificationPlan.map(
            (entry) => ({ ...entry, required: false }),
          ),
        },
      },
    };
    let optionalPersistCount = 0;
    const optionalHarness = {
      worktreeId: store.worktreeId,
      async readTaskBundle() {
        return explicitlyOptionalVerificationRead;
      },
      async persistTaskBundle() {
        optionalPersistCount += 1;
      },
    } as unknown as ArtifactStore;
    await expect(
      applyTaskUpdate(
        optionalHarness,
        {
          taskId,
          action: { type: "transition_status", to: "verified" },
          expectedRevision: verificationRequired.mutation.revision,
          idempotencyKey: "ci-verification-explicitly-optional",
          actor: ACTOR,
        },
        () => new Date("2026-07-29T09:00:02.000Z"),
      ),
    ).resolves.toMatchObject({ task: { status: "verified" } });
    expect(optionalPersistCount).toBe(1);

    await expectCoverageRejected(
      incompleteCoverageRead,
      "ci-verification-incomplete-coverage",
    );

    const excessCoverageRead: ReadTaskBundleResult = {
      ...current,
      bundle: {
        ...current.bundle,
        verificationRecords: current.bundle.verificationRecords.map((record) =>
          VerificationRecordV1Schema.parse(record)
        ).map((record) =>
          record.id === passed.verification.id
            ? {
                ...record,
                claimIds: [...record.claimIds, built.brief.goalClaimId],
              }
            : record,
        ),
      },
    };
    await expectCoverageRejected(
      excessCoverageRead,
      "ci-verification-excess-coverage",
    );

    const verified = await taskEngine.updateTask(
      {
        taskId,
        action: { type: "transition_status", to: "verified" },
        expectedRevision: passed.mutation.revision,
        idempotencyKey: "ci-verification-recovery-verified",
        actor: ACTOR,
      },
      auth(),
    );
    expect(verified.task.status).toBe("verified");
  }, 10_000);

  it("records an explicit boundary instead of an empty legacy Check and replays without analysis", async () => {
    const { store } = await openStore();
    let analysisCalls = 0;
    const taskEngine = engine(store, {
      contextProvider: {
        async loadTaskContext() {
          return {
            graph: { ...graphFixture(), nodes: [], edges: [] },
            existingFilePaths: [],
            sourceEvidence: [],
          };
        },
        async analyzeTaskChanges() {
          analysisCalls += 1;
          return {
            status: "complete",
            hunks: [],
            deletedFiles: [],
            boundaries: [],
          };
        },
      },
    });
    const built = await taskEngine.buildTaskBrief(
      buildInput("legacy-empty-writer"),
      auth(),
    );
    expect(built.brief.plannedChanges).toEqual([]);
    let revision = built.task.revision;
    for (const [action, key] of [
      [
        { type: "confirm_goal", claimId: built.brief.goalClaimId },
        "legacy-empty-confirm-goal",
      ],
      [
        {
          type: "confirm_acceptance_criteria",
          claimIds: built.brief.acceptanceClaimIds,
        },
        "legacy-empty-confirm-acceptance",
      ],
      [
        { type: "transition_status", to: "planned" },
        "legacy-empty-planned",
      ],
      [
        { type: "transition_status", to: "in_progress" },
        "legacy-empty-progress",
      ],
    ] as const) {
      const updated = await taskEngine.updateTask(
        {
          taskId: built.task.taskId,
          action,
          expectedRevision: revision,
          idempotencyKey: key,
          actor: ACTOR,
        },
        auth(),
      );
      revision = updated.task.revision;
    }

    const snapshot = RepositorySnapshotArtifactV1Schema.parse(
      await repositorySnapshot(
        "snapshot:legacy-empty",
        "2026-07-29T09:00:00.000Z",
        "a".repeat(40),
      ),
    );
    const emptyPayload = { ...snapshot.payload, changes: [] };
    await store.persistArtifact(
      RepositorySnapshotArtifactV1Schema.parse({
        ...snapshot,
        contentDigest: sha256CanonicalJson(emptyPayload),
        payload: emptyPayload,
      }),
    );
    await publishPulseForSnapshot(
      store,
      "snapshot:legacy-empty",
      "a".repeat(40),
    );
    const captured = await taskEngine.updateTask(
      {
        taskId: built.task.taskId,
        action: { type: "transition_status", to: "check_required" },
        expectedRevision: revision,
        idempotencyKey: "legacy-empty-check-required",
        actor: ACTOR,
      },
      auth(),
    );
    const checkInput = {
      taskId: built.task.taskId,
      actualSnapshotId: "snapshot:legacy-empty",
      includeWorktree: true as const,
      expectedRevision: captured.task.revision,
      idempotencyKey: "legacy-empty-check",
      actor: ACTOR,
    };
    const checked = await taskEngine.checkChange(
      checkInput,
      auth(["task:update"]),
    );
    expect(checked.changeCheckClassification).toEqual({
      profile: "legacy_summary",
      emptyFindingsAreClean: false,
    });
    expect(checked.changeCheck.findings).toEqual([
      expect.objectContaining({
        type: "cannot_determine",
        blocking: true,
        actualChangeIds: [],
      }),
    ]);
    const persisted = await store.readTaskBundle(built.task.taskId);
    if (!("brief" in persisted.bundle)) {
      throw new TypeError("The checked Task must remain contextual.");
    }
    const boundary = persisted.bundle.evidence.find((evidence) =>
      checked.changeCheck.findings[0]!.evidenceIds.includes(evidence.id),
    );
    expect(boundary).toMatchObject({
      kind: "analysis_boundary",
      epistemicStatus: "unknown",
      observedAtSnapshotId: "snapshot:legacy-empty",
    });
    expect(analysisCalls).toBe(1);

    const replay = await taskEngine.checkChange(
      checkInput,
      auth(["task:update"]),
    );
    expect(replay).toEqual({
      ...checked,
      mutation: { ...checked.mutation, idempotentReplay: true },
    });
    expect(analysisCalls).toBe(1);
  });

  it("rejects empty legacy Checks at both Verification lifecycle gates", async () => {
    const { store } = await openStore();
    const taskEngine = engine(store);
    const built = await taskEngine.buildTaskBrief(
      buildInput("legacy-empty-lifecycle"),
      auth(),
    );
    let revision = built.task.revision;
    for (const [action, key] of [
      [
        { type: "confirm_goal", claimId: built.brief.goalClaimId },
        "legacy-gate-confirm-goal",
      ],
      [
        {
          type: "confirm_acceptance_criteria",
          claimIds: built.brief.acceptanceClaimIds,
        },
        "legacy-gate-confirm-acceptance",
      ],
      [
        {
          type: "confirm_plan",
          plannedChangeIds: built.brief.plannedChanges.map((change) => change.id),
        },
        "legacy-gate-confirm-plan",
      ],
      [
        { type: "transition_status", to: "planned" },
        "legacy-gate-planned",
      ],
      [
        { type: "transition_status", to: "in_progress" },
        "legacy-gate-progress",
      ],
      [
        { type: "transition_status", to: "check_required" },
        "legacy-gate-check-required",
      ],
    ] as const) {
      const updated = await taskEngine.updateTask(
        {
          taskId: built.task.taskId,
          action,
          expectedRevision: revision,
          idempotencyKey: key,
          actor: ACTOR,
        },
        auth(),
      );
      revision = updated.task.revision;
    }
    const checked = await appendTrustedChangeCheck(
      store,
      built.task.taskId,
      { empty: true },
    );
    const checkedRevision = checked.bundle.manifest.revision;
    await expect(
      taskEngine.updateTask(
        {
          taskId: built.task.taskId,
          action: { type: "transition_status", to: "verification_required" },
          expectedRevision: checkedRevision,
          idempotencyKey: "legacy-empty-enter-verification",
          actor: ACTOR,
        },
        auth(),
      ),
    ).rejects.toMatchObject({
      code: "task_gate_unsatisfied",
      details: {
        failedGuards: expect.arrayContaining([
          expect.objectContaining({ code: "current_check_required" }),
        ]),
      },
    });
    expect(
      (await store.readTaskBundle(built.task.taskId)).bundle.manifest.revision,
    ).toBe(checkedRevision);

    if (!("brief" in checked.bundle)) {
      throw new TypeError("The checked Task must remain contextual.");
    }
    const check = checked.bundle.changeChecks.at(-1)!;
    const entry = checked.bundle.brief.verificationPlan[0]!;
    const verification = VerificationRecordV1Schema.parse({
      id: "verification:legacy-empty-history",
      taskId: built.task.taskId,
      verificationPlanEntryId: entry.id,
      attempt: 1,
      kind: entry.method,
      status: "passed",
      command: "pnpm test",
      exitCode: 0,
      durationMs: 1,
      summary: "Historical verification fixture passed.",
      claimIds: entry.acceptanceClaimIds,
      snapshotId: checked.bundle.manifest.latestSnapshotId,
      recordedAt: checked.bundle.manifest.updatedAt,
      actor: ACTOR,
    });
    const historicalRead: ReadTaskBundleResult = {
      ...checked,
      bundle: {
        ...checked.bundle,
        manifest: TaskManifestV1Schema.parse({
          ...checked.bundle.manifest,
          status: "verification_required",
          currentChangeCheckId: check.id,
          currentChangeCheckRevision: check.taskRevision,
        }),
        verificationRecords: [verification],
      },
    };
    let readCalls = 0;
    let persistCalls = 0;
    const transitionStore = {
      worktreeId: store.worktreeId,
      async readTaskBundle() {
        readCalls += 1;
        return historicalRead;
      },
      async persistTaskBundle() {
        persistCalls += 1;
      },
    } as unknown as ArtifactStore;
    await expect(
      applyTaskUpdate(
        transitionStore,
        {
          taskId: built.task.taskId,
          action: { type: "transition_status", to: "verified" },
          expectedRevision: checkedRevision,
          idempotencyKey: "legacy-empty-historical-verified",
          actor: ACTOR,
        },
        () => FIXED_NOW,
      ),
    ).rejects.toMatchObject({
      code: "task_gate_unsatisfied",
      details: {
        failedGuards: expect.arrayContaining([
          expect.objectContaining({ code: "current_check_required" }),
        ]),
      },
    });
    expect(readCalls).toBe(1);
    expect(persistCalls).toBe(0);
    expect(historicalRead.bundle.manifest.revision).toBe(checkedRevision);
  });

  it("does not consume a same-file hunk for a path-only planned change", async () => {
    const { store } = await openStore();
    const fileGraph: KnowledgeGraph = {
      ...graphFixture(),
      nodes: [
        node("file:task", "TaskHandler", "src/task.ts", {
          type: "file",
          lineRange: [1, 1],
        }),
      ],
      edges: [],
    };
    const taskEngine = engine(store, {
      contextProvider: {
        async loadTaskContext() {
          return {
            graph: fileGraph,
            existingFilePaths: ["src/task.ts"],
            sourceEvidence: [
              {
                nodeId: "file:task",
                filePath: "src/task.ts",
                lineRange: [1, 1] as [number, number],
                contentHash: SOURCE_DIGEST,
                kind: "source" as const,
              },
            ],
          };
        },
        async analyzeTaskChanges() {
          return {
            status: "complete" as const,
            hunks: [
              {
                id: "hunk:path-only-regression",
                actualChangeIds: ["change:implementation"],
                filePath: "src/task.ts",
                newLineRange: [1, 1] as [number, number],
                nodeIds: ["task-handler"],
                contentHash: SOURCE_DIGEST,
              },
            ],
            deletedFiles: [],
            boundaries: [],
          };
        },
      },
    });
    const built = await taskEngine.buildTaskBrief(
      buildInput("path-only-check"),
      auth(),
    );
    const pathOnlyPlan = built.brief.plannedChanges.find(
      (change) => change.filePath === "src/task.ts",
    );
    expect(pathOnlyPlan).toBeDefined();
    expect(pathOnlyPlan).not.toHaveProperty("symbolId");

    let revision = built.task.revision;
    for (const [action, key] of [
      [
        { type: "confirm_goal", claimId: built.brief.goalClaimId },
        "path-only-confirm-goal",
      ],
      [
        {
          type: "confirm_acceptance_criteria",
          claimIds: built.brief.acceptanceClaimIds,
        },
        "path-only-confirm-acceptance",
      ],
      [
        {
          type: "confirm_plan",
          plannedChangeIds: built.brief.plannedChanges.map(
            (change) => change.id,
          ),
        },
        "path-only-confirm-plan",
      ],
      [
        { type: "transition_status", to: "planned" },
        "path-only-transition-planned",
      ],
      [
        { type: "transition_status", to: "in_progress" },
        "path-only-transition-progress",
      ],
      [
        { type: "transition_status", to: "check_required" },
        "path-only-transition-check",
      ],
    ] as const) {
      const result = await taskEngine.updateTask(
        {
          taskId: built.task.taskId,
          action,
          expectedRevision: revision,
          idempotencyKey: key,
          actor: ACTOR,
        },
        auth(),
      );
      revision = result.task.revision;
    }

    const checked = await taskEngine.checkChange(
      {
        taskId: built.task.taskId,
        actualSnapshotId: "snapshot:actual",
        includeWorktree: true,
        expectedRevision: revision,
        idempotencyKey: "path-only-change-check",
        actor: ACTOR,
      },
      auth(["task:update"]),
    );
    expect(checked.changeCheck.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "cannot_determine",
          plannedChangeIds: [pathOnlyPlan!.id],
          blocking: true,
        }),
        expect.objectContaining({
          type: "unplanned_change",
          plannedChangeIds: [],
          actualChangeIds: ["change:implementation"],
          blocking: true,
        }),
      ]),
    );
    expect(checked.changeCheck.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "planned_completed" }),
      ]),
    );
    const unplanned = checked.changeCheck.findings.find(
      (finding) => finding.type === "unplanned_change",
    );
    if (unplanned === undefined) {
      throw new TypeError("The same-file hunk must remain unplanned.");
    }
    const persisted = await store.readTaskBundle(built.task.taskId);
    if (!("brief" in persisted.bundle)) {
      throw new TypeError("The checked Task must remain contextual.");
    }
    const sourceEvidence = persisted.bundle.evidence.find(
      (evidence) => unplanned.evidenceIds.includes(evidence.id),
    );
    expect(sourceEvidence).toMatchObject({
      kind: "source",
      observedAtSnapshotId: "snapshot:actual",
      filePath: "src/task.ts",
      lineRange: [1, 1],
      nodeIds: ["task-handler"],
      contentHash: SOURCE_DIGEST,
    });
  });

  it.each(["unstaged", "staged"] as const)(
    "keeps a same-path %s deletion unplanned and binds its Evidence to baseline bytes",
    async (deletionSource) => {
    const { store } = await openStore();
    const deletedDigest =
      "sha256:bb103bae86db4b319ce6ec4b17e5c4547d061a07a3b4a08e49308579dcaa4864";
    const deletedGraph: KnowledgeGraph = {
      ...graphFixture(),
      nodes: [
        node("removed-handler", "RemovedHandler", "src/removed.ts", {
          lineRange: [1, 1],
        }),
      ],
      edges: [],
    };
    const taskEngine = engine(store, {
      contextProvider: {
        async loadTaskContext() {
          return {
            graph: deletedGraph,
            existingFilePaths: ["src/removed.ts"],
            sourceEvidence: [
              {
                nodeId: "removed-handler",
                filePath: "src/removed.ts",
                lineRange: [1, 1] as [number, number],
                contentHash: deletedDigest,
                commit: "a".repeat(40),
                kind: "source" as const,
              },
            ],
          };
        },
        async analyzeTaskChanges() {
          return {
            status: "complete" as const,
            hunks: [],
            deletedFiles: [
              {
                id: "deleted-file:removed-handler",
                actualChangeIds: ["change:deleted-handler"],
                filePath: "src/removed.ts",
                oldLineRange: [1, 1] as [number, number],
                contentHash: deletedDigest,
              },
            ],
            boundaries: [],
          };
        },
      },
    });
    const built = await taskEngine.buildTaskBrief(
      {
        ...buildInput("deleted-file-check"),
        task: "Remove the RemovedHandler implementation.",
        scope: ["src/removed.ts"],
        maxCandidates: 1,
      },
      auth(),
    );
    const deletedPlan = built.brief.plannedChanges.find(
      (change) => change.filePath === "src/removed.ts",
    );
    expect(deletedPlan).toBeDefined();
    expect(deletedPlan?.symbolId).toBe("removed-handler");

    let revision = built.task.revision;
    for (const [action, key] of [
      [
        { type: "confirm_goal", claimId: built.brief.goalClaimId },
        "deleted-confirm-goal",
      ],
      [
        {
          type: "confirm_acceptance_criteria",
          claimIds: built.brief.acceptanceClaimIds,
        },
        "deleted-confirm-acceptance",
      ],
      [
        {
          type: "confirm_plan",
          plannedChangeIds: built.brief.plannedChanges.map(
            (change) => change.id,
          ),
        },
        "deleted-confirm-plan",
      ],
      [
        { type: "transition_status", to: "planned" },
        "deleted-transition-planned",
      ],
      [
        { type: "transition_status", to: "in_progress" },
        "deleted-transition-progress",
      ],
    ] as const) {
      const result = await taskEngine.updateTask(
        {
          taskId: built.task.taskId,
          action,
          expectedRevision: revision,
          idempotencyKey: key,
          actor: ACTOR,
        },
        auth(),
      );
      revision = result.task.revision;
    }

    const base = RepositorySnapshotArtifactV1Schema.parse(
      await repositorySnapshot(
        "snapshot:deleted-handler",
        "2026-07-29T09:00:00.000Z",
        "a".repeat(40),
      ),
    );
    const deletedPayload = {
      ...base.payload,
      changes: [
        {
          id: "change:deleted-handler",
          path: "src/removed.ts",
          source: deletionSource,
          kind: "deleted" as const,
        },
      ],
    };
    await store.persistArtifact(
      RepositorySnapshotArtifactV1Schema.parse({
        ...base,
        contentDigest: sha256CanonicalJson(deletedPayload),
        payload: deletedPayload,
      }),
    );
    await publishPulseForSnapshot(
      store,
      "snapshot:deleted-handler",
      "a".repeat(40),
    );
    const captured = await taskEngine.updateTask(
      {
        taskId: built.task.taskId,
        action: { type: "transition_status", to: "check_required" },
        expectedRevision: revision,
        idempotencyKey: "deleted-transition-check",
        actor: ACTOR,
      },
      auth(),
    );
    const checked = await taskEngine.checkChange(
      {
        taskId: built.task.taskId,
        actualSnapshotId: "snapshot:deleted-handler",
        includeWorktree: true,
        expectedRevision: captured.task.revision,
        idempotencyKey: "deleted-change-check",
        actor: ACTOR,
      },
      auth(["task:update"]),
    );
    const cannotDetermine = checked.changeCheck.findings.find(
      (finding) =>
        finding.type === "cannot_determine" &&
        finding.plannedChangeIds.includes(deletedPlan!.id),
    );
    const unplannedDeletion = checked.changeCheck.findings.find(
      (finding) =>
        finding.type === "unplanned_change" &&
        finding.actualChangeIds.includes("change:deleted-handler"),
    );
    expect(cannotDetermine).toMatchObject({
      blocking: true,
      plannedChangeIds: [deletedPlan!.id],
      actualChangeIds: ["change:deleted-handler"],
    });
    expect(unplannedDeletion).toMatchObject({
      blocking: true,
      plannedChangeIds: [],
      actualChangeIds: ["change:deleted-handler"],
    });
    expect(
      checked.changeCheck.findings.map((finding) => finding.type).sort(),
    ).toEqual(["cannot_determine", "unplanned_change"]);
    expect(checked.changeCheck.findings).toHaveLength(2);
    expect(checked.changeCheck.findings.some(
      (finding) =>
        finding.type === "planned_completed" ||
        finding.type === "possible_omission",
    )).toBe(false);
    expect(unplannedDeletion?.evidenceIds).toHaveLength(1);

    const persisted = await store.readTaskBundle(built.task.taskId);
    if (!("brief" in persisted.bundle) || unplannedDeletion === undefined) {
      throw new TypeError("The deletion Check must remain contextual.");
    }
    const deletionEvidence = persisted.bundle.evidence.find(
      (evidence) => unplannedDeletion.evidenceIds.includes(evidence.id),
    );
    if (deletionEvidence === undefined) {
      throw new TypeError("The deletion Finding must retain its baseline Evidence.");
    }
    expect(deletionEvidence).toEqual(expect.objectContaining({
      kind: "source",
      epistemicStatus: "observed",
      freshness: "changed",
      freshnessReason:
        "The source existed at the Task baseline and is absent from the exact actual Snapshot.",
      observedAtSnapshotId: built.task.baselineSnapshotId,
      filePath: "src/removed.ts",
      lineRange: [1, 1],
      commit: "a".repeat(40),
      nodeIds: [],
      contentHash: deletedDigest,
    }));
    const deletionFindingClaims = persisted.bundle.claims.filter(
      (claim) =>
        claim.kind === "finding" &&
        unplannedDeletion.claimIds.includes(claim.id) &&
        (claim.findingIds as readonly string[]).includes(unplannedDeletion.id),
    );
    expect(deletionFindingClaims).toHaveLength(1);
    const deletionFindingClaim = deletionFindingClaims[0];
    expect(deletionFindingClaim).toEqual(expect.objectContaining({
      epistemicStatus: "observed",
      lifecycleStatus: "supported",
      freshness: "changed",
      sourceSnapshotId: "snapshot:deleted-handler",
      findingIds: [unplannedDeletion.id],
      evidenceIds: [deletionEvidence.id],
    }));
    },
  );

  it("keeps an all-staged planned modification complete while additions and deletions remain independently unplanned", async () => {
    const { store } = await openStore();
    const addedDigest =
      "sha256:cc103bae86db4b319ce6ec4b17e5c4547d061a07a3b4a08e49308579dcaa4865";
    const deletedDigest =
      "sha256:bb103bae86db4b319ce6ec4b17e5c4547d061a07a3b4a08e49308579dcaa4864";
    const combinedGraph: KnowledgeGraph = {
      ...graphFixture(),
      nodes: [
        ...graphFixture().nodes,
        node("added-handler", "AddedHandler", "src/added.ts", {
          lineRange: [1, 1],
        }),
        node("removed-handler", "RemovedHandler", "src/removed.ts", {
          lineRange: [1, 1],
        }),
      ],
    };
    const taskEngine = engine(store, {
      contextProvider: {
        async loadTaskContext() {
          return {
            graph: combinedGraph,
            existingFilePaths: ["src/task.ts", "src/removed.ts"],
            sourceEvidence: [
              {
                nodeId: "task-handler",
                filePath: "src/task.ts",
                lineRange: [1, 1] as [number, number],
                contentHash: SOURCE_DIGEST,
                commit: "a".repeat(40),
                kind: "source" as const,
              },
            ],
          };
        },
        async analyzeTaskChanges() {
          return {
            status: "complete" as const,
            hunks: [
              {
                id: "hunk:added-handler",
                actualChangeIds: ["change:added-handler"],
                filePath: "src/added.ts",
                newLineRange: [1, 1] as [number, number],
                nodeIds: ["added-handler"],
                contentHash: addedDigest,
              },
              {
                id: "hunk:task-handler",
                actualChangeIds: ["change:task-handler"],
                filePath: "src/task.ts",
                newLineRange: [1, 1] as [number, number],
                nodeIds: ["task-handler"],
                contentHash: SOURCE_DIGEST,
              },
            ],
            deletedFiles: [
              {
                id: "deleted-file:removed-handler",
                actualChangeIds: ["change:removed-handler"],
                filePath: "src/removed.ts",
                oldLineRange: [1, 1] as [number, number],
                contentHash: deletedDigest,
              },
            ],
            boundaries: [],
          };
        },
      },
    });
    const built = await taskEngine.buildTaskBrief(
      {
        ...buildInput("all-staged-add-modify-delete"),
        task: "Update TaskHandler behavior.",
        scope: ["src/task.ts"],
        maxCandidates: 1,
      },
      auth(),
    );
    expect(built.brief.plannedChanges).toHaveLength(1);
    const taskPlan = built.brief.plannedChanges[0]!;
    expect(taskPlan).toMatchObject({
      filePath: "src/task.ts",
      symbolId: "task-handler",
    });

    let revision = built.task.revision;
    for (const [action, key] of [
      [{ type: "confirm_goal", claimId: built.brief.goalClaimId }, "combined-goal"],
      [{
        type: "confirm_acceptance_criteria",
        claimIds: built.brief.acceptanceClaimIds,
      }, "combined-acceptance"],
      [{
        type: "confirm_plan",
        plannedChangeIds: [taskPlan.id] as string[],
      }, "combined-plan"],
      [{ type: "transition_status", to: "planned" }, "combined-planned"],
      [{ type: "transition_status", to: "in_progress" }, "combined-progress"],
    ] as const) {
      const updated = await taskEngine.updateTask({
        taskId: built.task.taskId,
        action,
        expectedRevision: revision,
        idempotencyKey: key,
        actor: ACTOR,
      }, auth());
      revision = updated.task.revision;
    }

    const base = RepositorySnapshotArtifactV1Schema.parse(
      await repositorySnapshot(
        "snapshot:all-staged-combined",
        "2026-07-29T09:00:00.000Z",
        "a".repeat(40),
      ),
    );
    const combinedPayload = {
      ...base.payload,
      changes: [
        {
          id: "change:added-handler",
          path: "src/added.ts",
          source: "staged" as const,
          kind: "added" as const,
          contentDigest: addedDigest,
        },
        {
          id: "change:removed-handler",
          path: "src/removed.ts",
          source: "staged" as const,
          kind: "deleted" as const,
        },
        {
          id: "change:task-handler",
          path: "src/task.ts",
          source: "staged" as const,
          kind: "modified" as const,
          contentDigest: SOURCE_DIGEST,
        },
      ],
    };
    await store.persistArtifact(RepositorySnapshotArtifactV1Schema.parse({
      ...base,
      contentDigest: sha256CanonicalJson(combinedPayload),
      payload: combinedPayload,
    }));
    await publishPulseForSnapshot(
      store,
      "snapshot:all-staged-combined",
      "a".repeat(40),
    );
    const captured = await taskEngine.updateTask({
      taskId: built.task.taskId,
      action: { type: "transition_status", to: "check_required" },
      expectedRevision: revision,
      idempotencyKey: "combined-check-required",
      actor: ACTOR,
    }, auth());
    const checked = await taskEngine.checkChange({
      taskId: built.task.taskId,
      actualSnapshotId: "snapshot:all-staged-combined",
      includeWorktree: true,
      expectedRevision: captured.task.revision,
      idempotencyKey: "combined-check",
      actor: ACTOR,
    }, auth(["task:update"]));
    expect(checked.changeCheck.findings.map((finding) => finding.type).sort())
      .toEqual(["planned_completed", "unplanned_change", "unplanned_change"]);
    expect(checked.changeCheck.findings.some(
      (finding) =>
        finding.type === "cannot_determine" ||
        finding.type === "possible_omission",
    )).toBe(false);
    const completed = checked.changeCheck.findings.find(
      (finding) => finding.type === "planned_completed",
    );
    expect(completed).toMatchObject({
      blocking: false,
      plannedChangeIds: [taskPlan.id],
      actualChangeIds: ["change:task-handler"],
    });
    const addedFinding = checked.changeCheck.findings.find(
      (finding) => finding.actualChangeIds.includes("change:added-handler"),
    );
    const deletedFinding = checked.changeCheck.findings.find(
      (finding) => finding.actualChangeIds.includes("change:removed-handler"),
    );
    for (const [finding, changeId] of [
      [addedFinding, "change:added-handler"],
      [deletedFinding, "change:removed-handler"],
    ] as const) {
      expect(finding).toMatchObject({
        type: "unplanned_change",
        blocking: true,
        plannedChangeIds: [],
        actualChangeIds: [changeId],
      });
      expect(finding?.evidenceIds).toHaveLength(1);
    }
    const persisted = await store.readTaskBundle(built.task.taskId);
    if (!("brief" in persisted.bundle) ||
        addedFinding === undefined || deletedFinding === undefined) {
      throw new TypeError("The all-staged Check must remain contextual.");
    }
    expect(completed?.evidenceIds).toHaveLength(1);
    const completedEvidence = persisted.bundle.evidence.find(
      (evidence) => completed?.evidenceIds.includes(evidence.id) === true,
    );
    expect(completedEvidence).toEqual(expect.objectContaining({
      kind: "source",
      freshness: "current",
      observedAtSnapshotId: "snapshot:all-staged-combined",
      filePath: "src/task.ts",
      lineRange: [1, 1],
      nodeIds: ["task-handler"],
      contentHash: SOURCE_DIGEST,
    }));
    const addedEvidence = persisted.bundle.evidence.find(
      (evidence) => addedFinding.evidenceIds.includes(evidence.id),
    );
    expect(addedEvidence).toEqual(expect.objectContaining({
      kind: "source",
      freshness: "current",
      observedAtSnapshotId: "snapshot:all-staged-combined",
      filePath: "src/added.ts",
      lineRange: [1, 1],
      nodeIds: ["added-handler"],
      contentHash: addedDigest,
    }));
    const deletedEvidence = persisted.bundle.evidence.find(
      (evidence) => deletedFinding.evidenceIds.includes(evidence.id),
    );
    expect(deletedEvidence).toEqual(expect.objectContaining({
      kind: "source",
      freshness: "changed",
      observedAtSnapshotId: built.task.baselineSnapshotId,
      filePath: "src/removed.ts",
      lineRange: [1, 1],
      nodeIds: [],
      contentHash: deletedDigest,
    }));
  });

  it("keeps a live planned modification complete while an untracked addition and unstaged deletion remain independently unplanned", async () => {
    const { store } = await openStore();
    const addedDigest =
      "sha256:dd103bae86db4b319ce6ec4b17e5c4547d061a07a3b4a08e49308579dcaa4866";
    const deletedDigest =
      "sha256:ee103bae86db4b319ce6ec4b17e5c4547d061a07a3b4a08e49308579dcaa4867";
    const liveGraph: KnowledgeGraph = {
      ...graphFixture(),
      nodes: [
        ...graphFixture().nodes,
        node("live-added-handler", "LiveAddedHandler", "src/live-added.ts", {
          lineRange: [1, 1],
        }),
        node("live-removed-handler", "LiveRemovedHandler", "src/live-removed.ts", {
          lineRange: [1, 1],
        }),
      ],
    };
    const taskEngine = engine(store, {
      contextProvider: {
        async loadTaskContext() {
          return {
            graph: liveGraph,
            existingFilePaths: ["src/task.ts", "src/live-removed.ts"],
            sourceEvidence: [
              {
                nodeId: "task-handler",
                filePath: "src/task.ts",
                lineRange: [1, 1] as [number, number],
                contentHash: SOURCE_DIGEST,
                commit: "a".repeat(40),
                kind: "source" as const,
              },
            ],
          };
        },
        async analyzeTaskChanges() {
          return {
            status: "complete" as const,
            hunks: [
              {
                id: "hunk:live-added-handler",
                actualChangeIds: ["change:live-added-handler"],
                filePath: "src/live-added.ts",
                newLineRange: [1, 1] as [number, number],
                nodeIds: ["live-added-handler"],
                contentHash: addedDigest,
              },
              {
                id: "hunk:live-task-handler",
                actualChangeIds: ["change:live-task-handler"],
                filePath: "src/task.ts",
                newLineRange: [1, 1] as [number, number],
                nodeIds: ["task-handler"],
                contentHash: SOURCE_DIGEST,
              },
            ],
            deletedFiles: [
              {
                id: "deleted-file:live-removed-handler",
                actualChangeIds: ["change:live-removed-handler"],
                filePath: "src/live-removed.ts",
                oldLineRange: [1, 1] as [number, number],
                contentHash: deletedDigest,
              },
            ],
            boundaries: [],
          };
        },
      },
    });
    const built = await taskEngine.buildTaskBrief(
      {
        ...buildInput("live-untracked-add-modify-delete"),
        task: "Update TaskHandler behavior.",
        scope: ["src/task.ts"],
        maxCandidates: 1,
      },
      auth(),
    );
    expect(built.brief.plannedChanges).toHaveLength(1);
    const taskPlan = built.brief.plannedChanges[0]!;
    expect(taskPlan).toMatchObject({
      filePath: "src/task.ts",
      symbolId: "task-handler",
    });

    let revision = built.task.revision;
    for (const [action, key] of [
      [{ type: "confirm_goal", claimId: built.brief.goalClaimId }, "live-combined-goal"],
      [{
        type: "confirm_acceptance_criteria",
        claimIds: built.brief.acceptanceClaimIds,
      }, "live-combined-acceptance"],
      [{
        type: "confirm_plan",
        plannedChangeIds: [taskPlan.id] as string[],
      }, "live-combined-plan"],
      [{ type: "transition_status", to: "planned" }, "live-combined-planned"],
      [{ type: "transition_status", to: "in_progress" }, "live-combined-progress"],
    ] as const) {
      const updated = await taskEngine.updateTask({
        taskId: built.task.taskId,
        action,
        expectedRevision: revision,
        idempotencyKey: key,
        actor: ACTOR,
      }, auth());
      revision = updated.task.revision;
    }

    const actualSnapshotId = "snapshot:live-untracked-combined";
    const base = RepositorySnapshotArtifactV1Schema.parse(
      await repositorySnapshot(
        actualSnapshotId,
        "2026-07-29T09:00:00.000Z",
        "a".repeat(40),
      ),
    );
    const livePayload = {
      ...base.payload,
      changes: [
        {
          id: "change:live-added-handler",
          path: "src/live-added.ts",
          source: "untracked" as const,
          kind: "added" as const,
          contentDigest: addedDigest,
        },
        {
          id: "change:live-removed-handler",
          path: "src/live-removed.ts",
          source: "unstaged" as const,
          kind: "deleted" as const,
        },
        {
          id: "change:live-task-handler",
          path: "src/task.ts",
          source: "unstaged" as const,
          kind: "modified" as const,
          contentDigest: SOURCE_DIGEST,
        },
      ],
    };
    await store.persistArtifact(RepositorySnapshotArtifactV1Schema.parse({
      ...base,
      contentDigest: sha256CanonicalJson(livePayload),
      payload: livePayload,
    }));
    await publishPulseForSnapshot(
      store,
      actualSnapshotId,
      "a".repeat(40),
    );
    const captured = await taskEngine.updateTask({
      taskId: built.task.taskId,
      action: { type: "transition_status", to: "check_required" },
      expectedRevision: revision,
      idempotencyKey: "live-combined-check-required",
      actor: ACTOR,
    }, auth());
    const checked = await taskEngine.checkChange({
      taskId: built.task.taskId,
      actualSnapshotId,
      includeWorktree: true,
      expectedRevision: captured.task.revision,
      idempotencyKey: "live-combined-check",
      actor: ACTOR,
    }, auth(["task:update"]));
    expect(checked.changeCheck.findings.map((finding) => finding.type).sort())
      .toEqual(["planned_completed", "unplanned_change", "unplanned_change"]);
    expect(checked.changeCheck.findings.some(
      (finding) =>
        finding.type === "cannot_determine" ||
        finding.type === "possible_omission",
    )).toBe(false);
    const completed = checked.changeCheck.findings.find(
      (finding) => finding.type === "planned_completed",
    );
    expect(completed).toMatchObject({
      blocking: false,
      plannedChangeIds: [taskPlan.id],
      actualChangeIds: ["change:live-task-handler"],
    });
    const addedFinding = checked.changeCheck.findings.find(
      (finding) => finding.actualChangeIds.includes("change:live-added-handler"),
    );
    const deletedFinding = checked.changeCheck.findings.find(
      (finding) => finding.actualChangeIds.includes("change:live-removed-handler"),
    );
    for (const [finding, changeId] of [
      [addedFinding, "change:live-added-handler"],
      [deletedFinding, "change:live-removed-handler"],
    ] as const) {
      expect(finding).toMatchObject({
        type: "unplanned_change",
        blocking: true,
        plannedChangeIds: [],
        actualChangeIds: [changeId],
      });
      expect(finding?.evidenceIds).toHaveLength(1);
    }
    const persisted = await store.readTaskBundle(built.task.taskId);
    if (!('brief' in persisted.bundle) ||
        completed === undefined ||
        addedFinding === undefined ||
        deletedFinding === undefined) {
      throw new TypeError("The live combined Check must remain contextual.");
    }
    const completedEvidence = persisted.bundle.evidence.find(
      (evidence) => completed.evidenceIds.includes(evidence.id),
    );
    expect(completedEvidence).toEqual(expect.objectContaining({
      kind: "source",
      freshness: "current",
      observedAtSnapshotId: actualSnapshotId,
      filePath: "src/task.ts",
      lineRange: [1, 1],
      nodeIds: ["task-handler"],
      contentHash: SOURCE_DIGEST,
    }));
    const addedEvidence = persisted.bundle.evidence.find(
      (evidence) => addedFinding.evidenceIds.includes(evidence.id),
    );
    expect(addedEvidence).toEqual(expect.objectContaining({
      kind: "source",
      freshness: "current",
      observedAtSnapshotId: actualSnapshotId,
      filePath: "src/live-added.ts",
      lineRange: [1, 1],
      nodeIds: ["live-added-handler"],
      contentHash: addedDigest,
    }));
    const deletedEvidence = persisted.bundle.evidence.find(
      (evidence) => deletedFinding.evidenceIds.includes(evidence.id),
    );
    expect(deletedEvidence).toEqual(expect.objectContaining({
      kind: "source",
      freshness: "changed",
      freshnessReason:
        "The source existed at the Task baseline and is absent from the exact actual Snapshot.",
      observedAtSnapshotId: built.task.baselineSnapshotId,
      filePath: "src/live-removed.ts",
      lineRange: [1, 1],
      commit: "a".repeat(40),
      nodeIds: [],
      contentHash: deletedDigest,
    }));
  });

  it("keeps a staged planned modification complete while different live paths remain independently unplanned", async () => {
    const { store } = await openStore();
    const addedDigest = `sha256:${"1".repeat(64)}`;
    const liveDigest = `sha256:${"2".repeat(64)}`;
    const mixedGraph: KnowledgeGraph = {
      ...graphFixture(),
      nodes: [
        ...graphFixture().nodes,
        node("mixed-added-handler", "MixedAddedHandler", "src/mixed-added.ts", {
          lineRange: [1, 1],
        }),
        node("mixed-live-handler", "MixedLiveHandler", "src/mixed-live.ts", {
          lineRange: [1, 1],
        }),
      ],
    };
    const taskEngine = engine(store, {
      contextProvider: {
        async loadTaskContext() {
          return {
            graph: mixedGraph,
            existingFilePaths: ["src/task.ts", "src/mixed-live.ts"],
            sourceEvidence: [{
              nodeId: "task-handler",
              filePath: "src/task.ts",
              lineRange: [1, 1] as [number, number],
              contentHash: SOURCE_DIGEST,
              commit: "a".repeat(40),
              kind: "source" as const,
            }],
          };
        },
        async analyzeTaskChanges() {
          return {
            status: "complete" as const,
            hunks: [
              {
                id: "hunk:mixed-added-handler",
                actualChangeIds: ["change:mixed-added-handler"],
                filePath: "src/mixed-added.ts",
                newLineRange: [1, 1] as [number, number],
                nodeIds: ["mixed-added-handler"],
                contentHash: addedDigest,
              },
              {
                id: "hunk:mixed-live-handler",
                actualChangeIds: ["change:mixed-live-handler"],
                filePath: "src/mixed-live.ts",
                newLineRange: [1, 1] as [number, number],
                nodeIds: ["mixed-live-handler"],
                contentHash: liveDigest,
              },
              {
                id: "hunk:mixed-task-handler",
                actualChangeIds: ["change:mixed-task-handler"],
                filePath: "src/task.ts",
                newLineRange: [1, 1] as [number, number],
                nodeIds: ["task-handler"],
                contentHash: SOURCE_DIGEST,
              },
            ],
            deletedFiles: [],
            boundaries: [],
          };
        },
      },
    });
    const built = await taskEngine.buildTaskBrief({
      ...buildInput("mixed-staged-live"),
      task: "Update TaskHandler behavior.",
      scope: ["src/task.ts"],
      maxCandidates: 1,
    }, auth());
    expect(built.brief.plannedChanges).toHaveLength(1);
    const taskPlan = built.brief.plannedChanges[0]!;
    expect(taskPlan).toMatchObject({
      filePath: "src/task.ts",
      symbolId: "task-handler",
    });

    let revision = built.task.revision;
    for (const [action, key] of [
      [{ type: "confirm_goal", claimId: built.brief.goalClaimId }, "mixed-staged-live-goal"],
      [{
        type: "confirm_acceptance_criteria",
        claimIds: built.brief.acceptanceClaimIds,
      }, "mixed-staged-live-acceptance"],
      [{
        type: "confirm_plan",
        plannedChangeIds: [taskPlan.id] as string[],
      }, "mixed-staged-live-plan"],
      [{ type: "transition_status", to: "planned" }, "mixed-staged-live-planned"],
      [{ type: "transition_status", to: "in_progress" }, "mixed-staged-live-progress"],
    ] as const) {
      const updated = await taskEngine.updateTask({
        taskId: built.task.taskId,
        action,
        expectedRevision: revision,
        idempotencyKey: key,
        actor: ACTOR,
      }, auth());
      revision = updated.task.revision;
    }

    const actualSnapshotId = "snapshot:mixed-staged-live";
    const base = RepositorySnapshotArtifactV1Schema.parse(
      await repositorySnapshot(
        actualSnapshotId,
        "2026-08-23T09:00:00.000Z",
        "a".repeat(40),
      ),
    );
    const mixedPayload = {
      ...base.payload,
      changes: [
        {
          id: "change:mixed-added-handler",
          path: "src/mixed-added.ts",
          source: "untracked" as const,
          kind: "added" as const,
          contentDigest: addedDigest,
        },
        {
          id: "change:mixed-live-handler",
          path: "src/mixed-live.ts",
          source: "unstaged" as const,
          kind: "modified" as const,
          contentDigest: liveDigest,
        },
        {
          id: "change:mixed-task-handler",
          path: "src/task.ts",
          source: "staged" as const,
          kind: "modified" as const,
          contentDigest: SOURCE_DIGEST,
        },
      ],
    };
    await store.persistArtifact(RepositorySnapshotArtifactV1Schema.parse({
      ...base,
      contentDigest: sha256CanonicalJson(mixedPayload),
      payload: mixedPayload,
    }));
    await publishPulseForSnapshot(store, actualSnapshotId, "a".repeat(40));
    const captured = await taskEngine.updateTask({
      taskId: built.task.taskId,
      action: { type: "transition_status", to: "check_required" },
      expectedRevision: revision,
      idempotencyKey: "mixed-staged-live-check-required",
      actor: ACTOR,
    }, auth());
    const checked = await taskEngine.checkChange({
      taskId: built.task.taskId,
      actualSnapshotId,
      includeWorktree: true,
      expectedRevision: captured.task.revision,
      idempotencyKey: "mixed-staged-live-check",
      actor: ACTOR,
    }, auth(["task:update"]));
    expect(checked.changeCheck.findings.map((finding) => finding.type).sort())
      .toEqual(["planned_completed", "unplanned_change", "unplanned_change"]);
    expect(checked.changeCheck.findings.some(
      (finding) =>
        finding.type === "cannot_determine" ||
        finding.type === "possible_omission",
    )).toBe(false);
    const completed = checked.changeCheck.findings.find(
      (finding) => finding.type === "planned_completed",
    );
    const addedFinding = checked.changeCheck.findings.find(
      (finding) => finding.actualChangeIds.includes("change:mixed-added-handler"),
    );
    const liveFinding = checked.changeCheck.findings.find(
      (finding) => finding.actualChangeIds.includes("change:mixed-live-handler"),
    );
    expect(completed).toMatchObject({
      blocking: false,
      plannedChangeIds: [taskPlan.id],
      actualChangeIds: ["change:mixed-task-handler"],
    });
    expect(completed?.evidenceIds).toHaveLength(1);
    for (const [finding, changeId] of [
      [addedFinding, "change:mixed-added-handler"],
      [liveFinding, "change:mixed-live-handler"],
    ] as const) {
      expect(finding).toMatchObject({
        type: "unplanned_change",
        blocking: true,
        plannedChangeIds: [],
        actualChangeIds: [changeId],
      });
      expect(finding?.evidenceIds).toHaveLength(1);
    }
    if (completed === undefined || addedFinding === undefined || liveFinding === undefined) {
      throw new TypeError("The mixed staged/live Check must retain all exact Findings.");
    }
    const persisted = await store.readTaskBundle(built.task.taskId);
    if (!("brief" in persisted.bundle)) {
      throw new TypeError("The mixed staged/live Check must remain contextual.");
    }
    const expectedEvidence = [
      [completed.evidenceIds[0], "src/task.ts", "task-handler", SOURCE_DIGEST],
      [addedFinding.evidenceIds[0], "src/mixed-added.ts", "mixed-added-handler", addedDigest],
      [liveFinding.evidenceIds[0], "src/mixed-live.ts", "mixed-live-handler", liveDigest],
    ] as const;
    for (const [evidenceId, filePath, nodeId, contentHash] of expectedEvidence) {
      const evidence = persisted.bundle.evidence.find((item) => item.id === evidenceId);
      expect(evidence).toEqual(expect.objectContaining({
        kind: "source",
        freshness: "current",
        observedAtSnapshotId: actualSnapshotId,
        filePath,
        lineRange: [1, 1],
        nodeIds: [nodeId],
        contentHash,
      }));
    }
  });
});
