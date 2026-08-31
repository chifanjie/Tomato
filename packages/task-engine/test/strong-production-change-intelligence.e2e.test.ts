import { createHash, createHmac } from "node:crypto";
import { execFile } from "node:child_process";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  ArtifactStore,
  ArtifactStoreStrongChangeAuthorityV1,
  type StrongChangeProviderAuthorityV1,
} from "@understand-code/artifact-store";
import { readCommittedStrongTaskProjectionInternalV1 } from
  "@understand-code/artifact-store/committed-strong-task-projection-reader-internal";
import {
  ArtifactManifestV1Schema,
  PathSafeRepositoryIdV1Schema,
  PathSafeRootIdentityV1Schema,
  PathSafeWorktreeIdV1Schema,
  RepoPulseArtifactV1Schema,
  RepositorySnapshotArtifactV1Schema,
  StrongRepoPulseV1Schema,
  StrongRepositorySnapshotV1Schema,
  VerificationPlanEntryIdV1Schema,
  UpdateTaskInputV1Schema,
  canonicalizeJson,
  derivePathSafeRepositoryChangeIdV1,
  derivePathSafeRepositorySnapshotIdV1,
  parseTrustedRepositorySnapshotArtifactV1,
  parseTrustedStrongRepoPulseV1,
  parseTrustedStrongRepositorySnapshotV1,
  type StrongRepositorySnapshotV1,
} from "@understand-code/contracts";
import { DurableObjectProviderRuntimeStoreV1 } from
  "@understand-code/durable-object-provider-runtime/storage";
import {
  createSafeGitTaskBaselineLeaseIntentV1,
  type SafeGitReadCommandV1,
  type SafeGitReadExecutionResultV1,
  type SafeGitTaskBaselineLeaseCreateRequestV1,
} from "@understand-code/repository-state";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RepositoryStrongChangeMaterialAuthorityV1,
  RepositoryTaskContextProvider,
  TaskEngine,
  sha256CanonicalJson,
  type AuthorizationContext,
} from "../src/index.js";

const PRODUCER_VERSION = "3.0.0-alpha.1";
const ACTOR = "codex";
const PROVIDER_ID = "durable-object-provider:step15-task-engine-e2e";
const REPOSITORY_ID = PathSafeRepositoryIdV1Schema.parse(
  `repo-hmac-${"1".repeat(64)}`,
);
const WORKTREE_ID = PathSafeWorktreeIdV1Schema.parse(
  `worktree-hmac-${"2".repeat(64)}`,
);
const ROOT_IDENTITY = PathSafeRootIdentityV1Schema.parse(
  `root-hmac-${"3".repeat(64)}`,
);
const temporaryRoots: string[] = [];

function digestBytes(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function digestCanonicalJson(value: string): string {
  return digestBytes(value);
}

function keyed(label: string): `hmac-sha256:${string}` {
  return `hmac-sha256:${createHmac("sha256", "step15-e2e-key")
    .update(label)
    .digest("hex")}`;
}

function graphFixture(head: string) {
  const functionNode = (id: string, name: string, filePath: string) => ({
    id,
    type: "function" as const,
    name,
    filePath,
    lineRange: [1, 3] as [number, number],
    summary: `${name} participates in the Step 15 change path.`,
    tags: ["step15"],
    complexity: "simple" as const,
  });
  return {
    version: "1",
    project: {
      name: "step15-change-intelligence-e2e",
      languages: ["TypeScript"],
      frameworks: [],
      description: "Real strong Change Intelligence vertical fixture",
      analyzedAt: "2026-08-26T00:00:00.000Z",
      gitCommitHash: head,
    },
    nodes: [
      functionNode("entry-point", "entryPoint", "src/entry.ts"),
      functionNode("planned-target", "plannedTarget", "src/planned.ts"),
      functionNode("omitted-target", "omittedTarget", "src/omitted.ts"),
      functionNode("context-target", "contextTarget", "src/context.ts"),
      {
        id: "ambiguous-service",
        type: "class" as const,
        name: "AmbiguousService",
        filePath: "src/ambiguous.ts",
        lineRange: [1, 5] as [number, number],
        summary: "Owns the ambiguous nested change boundary.",
        tags: ["step15"],
        complexity: "simple" as const,
      },
      {
        id: "ambiguous-method",
        type: "function" as const,
        name: "ambiguousMethod",
        filePath: "src/ambiguous.ts",
        lineRange: [2, 4] as [number, number],
        summary: "Overlaps its owning class for ambiguity coverage.",
        tags: ["step15"],
        complexity: "simple" as const,
      },
    ],
    edges: [
      "planned-target",
      "omitted-target",
      "context-target",
      "ambiguous-service",
      "ambiguous-method",
    ].map((target) => ({
      source: "entry-point",
      target,
      type: "calls" as const,
      direction: "forward" as const,
      weight: 1,
    })),
    layers: [],
    tour: [],
  };
}

function snapshot(
  head: string,
  changes: readonly Readonly<{
    path: string;
    source: "unstaged" | "untracked";
    kind: "modified" | "added";
    contentDigest: `sha256:${string}`;
    previousContentDigest?: `sha256:${string}`;
  }>[],
  label: string,
): StrongRepositorySnapshotV1 {
  const identified = changes.map((change) => ({
    id: derivePathSafeRepositoryChangeIdV1(change, digestCanonicalJson),
    ...change,
  })).sort((left, right) => {
    const sourceOrder = { unstaged: 0, untracked: 1 } as const;
    return sourceOrder[left.source] - sourceOrder[right.source] ||
      left.path.localeCompare(right.path) || left.id.localeCompare(right.id);
  });
  const draft = StrongRepositorySnapshotV1Schema.parse({
    schemaVersion: 1,
    profile: "repository_snapshot_path_safe_v1",
    snapshotId: `snapshot-${"0".repeat(64)}`,
    repositoryId: REPOSITORY_ID,
    worktreeId: WORKTREE_ID,
    rootIdentity: ROOT_IDENTITY,
    branchState: { status: "safe", name: "feature/step15-e2e" },
    objectFormat: "sha1",
    headState: { kind: "commit", commit: head },
    repositoryStateToken: keyed(`repository:${label}`),
    indexToken: keyed("index:baseline"),
    worktreeToken: keyed(`worktree:${label}`),
    untrackedToken: keyed(`untracked:${label}`),
    ignoreToken: keyed("ignore:baseline"),
    securityScanPolicyDigest: digestBytes("step15-security-policy"),
    safeGitExecutionDigest: digestBytes("step15-safe-git-profile"),
    createdAt: label === "baseline"
      ? "2026-08-26T00:00:00.000Z"
      : "2026-08-26T00:10:00.000Z",
    captureStatus: "complete",
    accounting: {
      rawLayerUnitCount: identified.length,
      candidateUnitCount: identified.length,
      safeChangeCount: identified.length,
      redactedKnownChangeCount: 0,
      unknownStateCount: 0,
    },
    changes: identified,
    redactedChanges: [],
    unknownStates: [],
  });
  return parseTrustedStrongRepositorySnapshotV1({
    ...draft,
    snapshotId: derivePathSafeRepositorySnapshotIdV1(
      draft,
      digestCanonicalJson,
    ),
  }, digestCanonicalJson);
}

function snapshotArtifact(value: StrongRepositorySnapshotV1) {
  return parseTrustedRepositorySnapshotArtifactV1({
    schemaVersion: 1,
    artifactType: "repository_snapshot",
    artifactId: `artifact:repository-snapshot:${value.snapshotId}`,
    repositoryId: value.repositoryId,
    worktreeId: value.worktreeId,
    sourceSnapshotId: value.snapshotId,
    revision: 0,
    producerVersion: PRODUCER_VERSION,
    createdAt: value.createdAt,
    contentDigest: sha256CanonicalJson(value),
    payload: value,
  }, digestCanonicalJson);
}

function pulseArtifact(value: StrongRepositorySnapshotV1, revision: number) {
  const bySource = {
    committed: 0,
    staged: 0,
    unstaged: value.changes.filter((item) => item.source === "unstaged").length,
    untracked: value.changes.filter((item) => item.source === "untracked").length,
    conflict: 0,
  };
  const byKind = {
    added: value.changes.filter((item) => item.kind === "added").length,
    modified: value.changes.filter((item) => item.kind === "modified").length,
    deleted: 0,
    renamed: 0,
    copied: 0,
    type_changed: 0,
  };
  const evaluatedAt = revision === 0
    ? "2026-08-26T00:00:01.000Z"
    : "2026-08-26T00:10:01.000Z";
  const pulse = parseTrustedStrongRepoPulseV1(
    StrongRepoPulseV1Schema.parse({
      profile: "repo_pulse_path_safe_v1",
      evaluatedSnapshotId: value.snapshotId,
      evaluatedSnapshotContentDigest: sha256CanonicalJson(value),
      status: "fresh",
      artifactFreshness: {
        graph: "fresh",
        wiki: "fresh",
        evidence: "fresh",
        diff: "fresh",
        task: "fresh",
      },
      repositoryState: {
        repositoryId: value.repositoryId,
        worktreeId: value.worktreeId,
        rootIdentity: value.rootIdentity,
        branchState: value.branchState,
        objectFormat: value.objectFormat,
        headState: value.headState,
        repositoryStateToken: value.repositoryStateToken,
        captureStatus: value.captureStatus,
      },
      changeSummary: { total: value.changes.length, bySource, byKind },
      security: {
        snapshotProfile: "repository_snapshot_path_safe_v1",
        safeChangeCount: value.changes.length,
        redactedChangeCount: 0,
        unknownStateCount: 0,
        redactionBoundaryCodes: [],
        uncertaintyCodes: [],
      },
      securityScanPolicyDigest: value.securityScanPolicyDigest,
      safeGitExecutionDigest: value.safeGitExecutionDigest,
      completeness: {
        parser: { status: "complete", coverage: 1, reasonCodes: [] },
        callGraph: { status: "complete", coverage: 1, reasonCodes: [] },
      },
      recommendedRefresh: "none",
      diagnosticCodes: [],
      evaluatedAt,
    }),
    value,
    digestCanonicalJson,
  );
  return RepoPulseArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "repo_pulse",
    artifactId: "artifact:repo-pulse:step15-e2e",
    repositoryId: value.repositoryId,
    worktreeId: value.worktreeId,
    sourceSnapshotId: value.snapshotId,
    revision,
    producerVersion: PRODUCER_VERSION,
    createdAt: evaluatedAt,
    contentDigest: sha256CanonicalJson(pulse),
    payload: pulse,
  });
}

function gitEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
    GIT_OPTIONAL_LOCKS: "0",
    LC_ALL: "C",
  };
}

function gitRaw(root: string, args: readonly string[]): Promise<{
  stdout: Buffer;
  stderr: Buffer;
  exitCode: number;
}> {
  return new Promise((resolvePromise) => {
    execFile("git", [...args], {
      cwd: root,
      encoding: "buffer",
      env: gitEnvironment(),
      maxBuffer: 64 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      resolvePromise({
        stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout ?? ""),
        stderr: Buffer.isBuffer(stderr) ? stderr : Buffer.from(stderr ?? ""),
        exitCode: error === null
          ? 0
          : typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === "number"
            ? (error as unknown as { code: number }).code
            : 1,
      });
    });
  });
}

async function git(root: string, args: readonly string[]): Promise<Buffer> {
  const result = await gitRaw(root, args);
  if (result.exitCode !== 0) {
    throw new Error(`git ${args[0] ?? ""} failed: ${result.stderr.toString("utf8")}`);
  }
  return result.stdout;
}

function readArgs(command: SafeGitReadCommandV1): readonly string[] {
  switch (command.request.profile) {
    case "cat_file_object_v1":
      return ["cat-file", "-p", command.request.objectId];
    case "cat_file_type_v1":
      return ["cat-file", "-t", "--", command.request.objectId];
    case "diff_committed_name_status_v1":
      return [
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--name-status",
        "-z",
        "--no-renames",
        `${command.request.baselineCommit}..${command.request.headCommit}`,
        "--",
      ];
    case "ls_files_stage_v1":
      return ["ls-files", "--stage", "-z"];
    default:
      throw new TypeError(
        `Unexpected SafeGit fixture request: ${command.request.profile}`,
      );
  }
}

async function publishGraphDescriptor(
  store: ArtifactStore,
  graphBytes: Buffer,
  snapshotId: string,
  revision: number,
): Promise<void> {
  const manifest = await store.readManifest({ verifyArtifacts: false });
  const next = ArtifactManifestV1Schema.parse({
    ...manifest,
    updatedAt: revision === 0
      ? "2026-08-26T00:00:02.000Z"
      : "2026-08-26T00:10:02.000Z",
    artifacts: [
      ...manifest.artifacts.filter((item) => item.artifactType !== "graph"),
      {
        descriptorVersion: 1,
        artifactId: "artifact:graph:step15-e2e",
        artifactType: "graph",
        storageFormat: "legacy_raw",
        path: ".understand-code/knowledge-graph.json",
        schemaVersion: "1.0.0",
        producerVersion: PRODUCER_VERSION,
        sourceSnapshotId: snapshotId,
        revision,
        contentDigest: digestBytes(graphBytes),
        state: "current",
        freshness: "fresh",
        generatedAt: revision === 0
          ? "2026-08-26T00:00:02.000Z"
          : "2026-08-26T00:10:02.000Z",
        legacyFormat: "graph_v1",
        dependencies: [],
      },
    ],
  });
  await writeFile(store.layout.manifest, `${canonicalizeJson(next)}\n`, "utf8");
  await store.readManifest();
}

async function allFileText(root: string): Promise<string> {
  const parts: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile()) parts.push((await readFile(target)).toString("utf8"));
    }
  };
  await visit(root);
  return parts.join("\n");
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryRoots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })
  ));
});

describe("production strong Change Intelligence vertical", () => {
  it.each(["deterministic", "unknown"] as const)(
    "derives a non-empty Provider-backed Delta (%s), survives TOCTOU/crash replay, and never executes or leaks verification input",
    async (classificationMode) => {
    const root = await mkdtemp(path.join(tmpdir(), "task-engine-step15-e2e-"));
    const providerRoot = await mkdtemp(path.join(tmpdir(), "provider-step15-e2e-"));
    temporaryRoots.push(root, providerRoot);
    await mkdir(path.join(root, "src"), { recursive: true });
    const sources: Record<string, string> = {
      "src/entry.ts": "export function entryPoint() {\n  return \"baseline\";\n}\n",
      "src/planned.ts": "export function plannedTarget() {\n  return \"baseline\";\n}\n",
      "src/omitted.ts": "export function omittedTarget() {\n  return \"baseline\";\n}\n",
      "src/context.ts": "export function contextTarget() {\n  return \"baseline\";\n}\n",
      "src/ambiguous.ts": "export class AmbiguousService {\n  ambiguousMethod(): string {\n    return \"baseline\";\n  }\n}\n",
    };
    for (const [relative, bytes] of Object.entries(sources)) {
      await writeFile(path.join(root, relative), bytes, "utf8");
    }
    await symlink("planned.ts", path.join(root, "src/unrelated-link.ts"));
    await writeFile(path.join(root, ".gitignore"), ".understand-code/\n", "utf8");
    await git(root, ["init", "-q", "-b", "feature/step15-e2e"]);
    await git(root, ["add", "."]);
    await git(root, [
      "-c", "user.name=Step15 Fixture",
      "-c", "user.email=step15@example.invalid",
      "commit", "-q", "-m", "baseline",
    ]);
    const head = (await git(root, ["rev-parse", "HEAD"])).toString("ascii").trim();
    const graph = graphFixture(head);
    const graphBytes = Buffer.from(`${JSON.stringify(graph)}\n`, "utf8");
    await mkdir(path.join(root, ".understand-code"), { recursive: true });
    await writeFile(
      path.join(root, ".understand-code/knowledge-graph.json"),
      graphBytes,
    );

    const baseline = snapshot(head, [], "baseline");
    const store = await ArtifactStore.open(root, {
      repositoryId: REPOSITORY_ID,
      worktreeId: WORKTREE_ID,
      producerVersion: PRODUCER_VERSION,
      clock: () => new Date("2026-08-26T00:00:03.000Z"),
    });
    await store.initialize();
    await store.persistArtifact(snapshotArtifact(baseline));
    await store.persistArtifact(pulseArtifact(baseline, 0));
    await publishGraphDescriptor(store, graphBytes, baseline.snapshotId, 0);

    const providerStore = new DurableObjectProviderRuntimeStoreV1({
      rootPath: providerRoot,
      providerId: PROVIDER_ID,
    });
    await providerStore.initialize();
    let tamperProviderReplayArtifacts = false;
    let injectProviderStaleOnce = true;
    const compareOperationNonces: string[] = [];
    const provider: StrongChangeProviderAuthorityV1 = {
      async inspectBusinessHead() {
        return { ...providerStore.inspectState(), profile: "provider_runtime_durable_journal_state_v1" };
      },
      async inspectState() {
        return { revision: providerStore.inspectState().revision };
      },
      readExactObject: ({ locator }) => providerStore.readFixedObject(
        locator as unknown as Parameters<typeof providerStore.readFixedObject>[0],
      ),
      async writeExactObject(input) {
        const locator = input.locator as unknown as Parameters<
          typeof providerStore.writeFixedObject
        >[0];
        const result = await providerStore.writeFixedObject(
          locator,
          input.logicalBytes,
          input.bytes,
        );
        return {
          resolution: result.resolution,
          verifiedContentDigest: result.verifiedContentDigest,
        };
      },
      async compareCommit(input) {
        const compareInput = input as Parameters<
          typeof providerStore.compareCommit
        >[0];
        compareOperationNonces.push(compareInput.operationNonce);
        if (injectProviderStaleOnce) {
          injectProviderStaleOnce = false;
          const forcedAdvanceNonce = compareInput.operationNonce ===
              "0".repeat(32)
            ? "1".repeat(32)
            : "0".repeat(32);
          await providerStore.compareCommit({
            operationNonce: forcedAdvanceNonce,
            expectedRevision: providerStore.inspectState().revision,
            phase: "strong_change_check_v1",
            artifacts: { forcedProviderRevisionAdvance: true },
          });
        }
        const result = await providerStore.compareCommit(compareInput);
        return {
          resolution: result.resolution,
          committedRevision: result.state.revision,
          artifacts:
            tamperProviderReplayArtifacts && result.resolution === "replayed"
              ? { ...result.state.artifacts, unexpectedReplayArtifact: "rejected" }
              : result.state.artifacts,
        };
      },
    };

    let sessionCount = 0;
    let driftAtSession: number | undefined;
    let driftPath: string | undefined;
    let driftBytes: string | undefined;
    let deleteLeaseAtSessionClose: number | undefined;
    let leaseRefToDelete: string | undefined;
    const contextProvider = await RepositoryTaskContextProvider.open({
      canonicalRoot: root,
      openStrongSafeGitReadSession: async () => {
        sessionCount += 1;
        const openedSession = sessionCount;
        if (
          driftAtSession === sessionCount &&
          driftPath !== undefined && driftBytes !== undefined
        ) await writeFile(path.join(root, driftPath), driftBytes, "utf8");
        const executor = {
          async execute(command: SafeGitReadCommandV1): Promise<SafeGitReadExecutionResultV1> {
            const result = await gitRaw(root, readArgs(command));
            return {
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.exitCode,
            };
          },
        };
        const lease = async (
          request: SafeGitTaskBaselineLeaseCreateRequestV1,
          recovery: boolean,
        ) => {
          const intent = createSafeGitTaskBaselineLeaseIntentV1({
            repositoryId: REPOSITORY_ID,
            worktreeId: WORKTREE_ID,
            taskId: request.taskId,
            baselineSnapshotId: request.baselineSnapshotId,
            objectFormat: "sha1",
            commit: request.commit,
            markerNonce: request.markerNonce,
          });
          const existing = await gitRaw(root, [
            "show-ref", "--verify", "--hash", intent.refName,
          ]);
          if (existing.exitCode === 0) {
            if (existing.stdout.toString("ascii").trim() !== request.commit) {
              throw new Error("baseline lease ref conflicts");
            }
            return {
              resolution: "replayed" as const,
              leaseId: intent.leaseId,
              refName: intent.refName,
              objectId: intent.objectId,
            };
          }
          if (recovery) throw new Error("baseline lease disappeared during recovery");
          await git(root, [
            "update-ref", "--create-reflog", intent.refName,
            request.commit, "0".repeat(40),
          ]);
          return {
            resolution: "created" as const,
            leaseId: intent.leaseId,
            refName: intent.refName,
            objectId: intent.objectId,
          };
        };
        return {
          executor,
          async executeGitObjectType(objectId: string) {
            const result = (await git(root, ["cat-file", "-t", "--", objectId]))
              .toString("ascii").trim();
            if (result !== "blob" && result !== "tree" && result !== "commit") {
              throw new Error("unexpected Git object type");
            }
            return result;
          },
          createTaskBaselineLease: (request: SafeGitTaskBaselineLeaseCreateRequestV1) =>
            lease(request, false),
          recoverTaskBaselineLease: (request: SafeGitTaskBaselineLeaseCreateRequestV1) =>
            lease(request, true),
          async close() {
            if (
              deleteLeaseAtSessionClose === openedSession &&
              leaseRefToDelete !== undefined
            ) {
              await git(root, ["update-ref", "-d", leaseRefToDelete]);
            }
          },
        };
      },
    });
    const ownerKeyAuthority = {
      provenance: "provider_installation_owner_v1" as const,
      async commit(domain: "record-verification-full-input-v1" | "verification-detail-semantic-v1", value: string) {
        return `hmac-sha256:${createHmac("sha256", "step15-owner-key")
          .update(domain).update("\0").update(value).digest("hex")}`;
      },
    };
    const materialAuthority = new RepositoryStrongChangeMaterialAuthorityV1({
      store,
      repositoryContextProvider: contextProvider,
      provider,
      providerId: PROVIDER_ID,
      ownerKeyAuthority,
    });
    const strongAuthority = new ArtifactStoreStrongChangeAuthorityV1(store, {
      provider,
      materialAuthority,
      providerId: PROVIDER_ID,
    });
    let engineTime = Date.parse("2026-08-26T00:20:00.000Z");
    const engine = new TaskEngine(store, {
      contextProvider,
      strongChangeAuthority: strongAuthority,
      clock: () => new Date(engineTime++),
    });
    const authorization: AuthorizationContext = {
      actor: ACTOR,
      repositoryId: REPOSITORY_ID,
      worktreeId: WORKTREE_ID,
      capabilities: [
        "task:create",
        "task:update",
        "task:confirm",
        "task:accept",
        "task:supersede",
      ],
    };

    const built = await engine.buildTaskBrief({
      task: "Update planned target, preserve omitted target, and inspect the ambiguous service",
      expectedRevision: 0,
      idempotencyKey: "step15-build",
      actor: ACTOR,
      tokenBudget: 8_000,
      maxCandidates: 20,
      maxImpactDepth: 4,
    }, authorization);
    const ambiguousPlans = built.brief.plannedChanges.filter(
      (item) => item.filePath === "src/ambiguous.ts",
    );
    const omissionPlan = built.brief.plannedChanges.find(
      (item) =>
        item.expectation === "required_change" &&
        item.filePath !== "src/ambiguous.ts",
    );
    const completedPlan = built.brief.plannedChanges.find(
      (item) =>
        item.expectation === "required_change" &&
        item.filePath !== "src/ambiguous.ts" &&
        item.filePath !== omissionPlan?.filePath,
    );
    expect(ambiguousPlans).toHaveLength(2);
    expect(omissionPlan).toBeDefined();
    expect(completedPlan).toBeDefined();

    let revision = built.task.revision;
    const update = async (
      action: Parameters<TaskEngine["updateTask"]>[0]["action"],
      idempotencyKey: string,
    ) => {
      const result = await engine.updateTask({
        taskId: built.task.taskId,
        action,
        expectedRevision: revision,
        idempotencyKey,
        actor: ACTOR,
      }, authorization);
      revision = result.task.revision;
      return result;
    };
    await update({
      type: "confirm_goal",
      claimId: built.brief.goalClaimId,
      contextGenerationId: built.brief.contextGenerationId,
    }, "step15-confirm-goal");
    await update({
      type: "confirm_acceptance_criteria",
      claimIds: built.brief.acceptanceClaimIds,
      contextGenerationId: built.brief.contextGenerationId,
    }, "step15-confirm-acceptance");
    await update({
      type: "confirm_plan",
      plannedChangeIds: built.brief.plannedChanges.map((item) => item.id),
      contextGenerationId: built.brief.contextGenerationId,
    }, "step15-confirm-plan");
    await update({ type: "transition_status", to: "planned" }, "step15-planned");
    await update({ type: "transition_status", to: "in_progress" }, "step15-in-progress");

    const completedPath = completedPlan!.filePath;
    const completedBefore = sources[completedPath]!;
    const completedAfter = completedBefore.replace("baseline", "actual-completed");
    const ambiguousBefore = sources["src/ambiguous.ts"]!;
    const ambiguousAfter = ambiguousBefore.replace("baseline", "actual-ambiguous");
    const omittedBefore = sources["src/omitted.ts"]!;
    const omittedAfter = omittedBefore.replace("baseline", "actual-covered");
    const unplannedPath = "src/unplanned.ts";
    const unplannedAfter = "export const unplanned = \"actual\";\n";
    // Git records a regular file as 100755 when any executable bit is set,
    // not only when the owner-executable bit is present.
    await chmod(path.join(root, completedPath), 0o611);
    await writeFile(path.join(root, completedPath), completedAfter, "utf8");
    if (classificationMode === "unknown") {
      await writeFile(path.join(root, "src/ambiguous.ts"), ambiguousAfter, "utf8");
      await writeFile(path.join(root, "src/omitted.ts"), omittedAfter, "utf8");
    } else {
      await writeFile(path.join(root, unplannedPath), unplannedAfter, "utf8");
    }
    const actualChanges: Parameters<typeof snapshot>[1][number][] = [
      {
        path: completedPath,
        source: "unstaged",
        kind: "modified",
        previousContentDigest: digestBytes(completedBefore),
        contentDigest: digestBytes(completedAfter),
      },
    ];
    if (classificationMode === "unknown") {
      actualChanges.push({
        path: "src/ambiguous.ts",
        source: "unstaged",
        kind: "modified",
        previousContentDigest: digestBytes(ambiguousBefore),
        contentDigest: digestBytes(ambiguousAfter),
      }, {
        path: "src/omitted.ts",
        source: "unstaged",
        kind: "modified",
        previousContentDigest: digestBytes(omittedBefore),
        contentDigest: digestBytes(omittedAfter),
      });
    } else {
      actualChanges.push({
        path: unplannedPath,
        source: "untracked",
        kind: "added",
        contentDigest: digestBytes(unplannedAfter),
      });
    }
    const actual = snapshot(head, actualChanges, `actual-${classificationMode}`);
    await store.persistArtifact(snapshotArtifact(actual));
    await store.persistArtifact(pulseArtifact(actual, 1), {
      expectedRevision: 0,
      idempotencyKey: "step15-actual-pulse",
      requestDigest: sha256CanonicalJson(["step15-actual-pulse", actual.snapshotId]),
    });
    await publishGraphDescriptor(store, graphBytes, actual.snapshotId, 1);
    await update(
      { type: "transition_status", to: "check_required" },
      "step15-check-required",
    );
    const checkInput = {
      profile: "check_changes_strong_v1" as const,
      taskId: built.task.taskId,
      actualSnapshotId: actual.snapshotId,
      includeWorktree: true as const,
      expectedRevision: revision,
      idempotencyKey: "step15-strong-check",
      actor: ACTOR,
    };

    const providerBeforeDrift = providerStore.inspectState().revision;
    const revisionBeforeDrift = revision;
    const leaseRefs = (await git(root, [
      "for-each-ref", "--format=%(refname)",
      "refs/understand-code/task-baselines/",
    ])).toString("utf8").trim().split("\n").filter(Boolean);
    expect(leaseRefs).toHaveLength(1);
    await git(root, ["update-ref", "-d", leaseRefs[0]!]);
    await expect(engine.checkChanges(checkInput, authorization)).rejects
      .toThrow(/baseline lease disappeared/u);
    expect(providerStore.inspectState().revision).toBe(providerBeforeDrift);
    expect((await store.readTaskBundle(built.task.taskId)).bundle.manifest.revision)
      .toBe(revisionBeforeDrift);
    await git(root, [
      "update-ref", "--create-reflog", leaseRefs[0]!, head, "0".repeat(40),
    ]);

    deleteLeaseAtSessionClose = sessionCount + 2;
    leaseRefToDelete = leaseRefs[0]!;
    await expect(engine.checkChanges(checkInput, authorization)).rejects
      .toMatchObject({ code: "strong_change_provider_invalid" });
    expect((await gitRaw(root, [
      "show-ref", "--verify", "--hash", leaseRefs[0]!,
    ])).exitCode).not.toBe(0);
    expect(providerStore.inspectState().revision).toBe(providerBeforeDrift);
    expect((await store.readTaskBundle(built.task.taskId)).bundle.manifest.revision)
      .toBe(revisionBeforeDrift);
    deleteLeaseAtSessionClose = undefined;
    leaseRefToDelete = undefined;
    await git(root, [
      "update-ref", "--create-reflog", leaseRefs[0]!, head, "0".repeat(40),
    ]);

    await git(root, ["add", "--", completedPath]);
    await expect(engine.checkChanges(checkInput, authorization)).rejects.toThrow();
    expect(providerStore.inspectState().revision).toBe(providerBeforeDrift);
    expect((await store.readTaskBundle(built.task.taskId)).bundle.manifest.revision)
      .toBe(revisionBeforeDrift);
    await git(root, ["restore", "--staged", "--", completedPath]);

    driftAtSession = sessionCount + 2;
    driftPath = completedPath;
    driftBytes = `${completedAfter}// TOCTOU drift\n`;
    await expect(engine.checkChanges(checkInput, authorization)).rejects.toThrow();
    expect(providerStore.inspectState().revision).toBe(providerBeforeDrift);
    expect((await store.readTaskBundle(built.task.taskId)).bundle.manifest.revision)
      .toBe(revisionBeforeDrift);
    driftAtSession = undefined;
    await writeFile(path.join(root, completedPath), completedAfter, "utf8");

    const persistCrash = vi.spyOn(store, "persistTaskBundle")
      .mockRejectedValueOnce(new Error("simulated crash after Provider commit"));
    await expect(engine.checkChanges(checkInput, authorization)).rejects
      .toThrow(/simulated crash/u);
    expect(providerStore.inspectState().revision).toBe(providerBeforeDrift + 2);
    expect(compareOperationNonces).toHaveLength(2);
    expect(compareOperationNonces[1]).not.toBe(compareOperationNonces[0]);
    expect((await store.readTaskBundle(built.task.taskId)).bundle.manifest.revision)
      .toBe(revisionBeforeDrift);

    tamperProviderReplayArtifacts = true;
    await expect(engine.checkChanges(checkInput, authorization)).rejects
      .toMatchObject({ code: "strong_change_provider_invalid" });
    expect(providerStore.inspectState().revision).toBe(providerBeforeDrift + 2);
    expect(compareOperationNonces[2]).toBe(compareOperationNonces[1]);
    expect((await store.readTaskBundle(built.task.taskId)).bundle.manifest.revision)
      .toBe(revisionBeforeDrift);
    tamperProviderReplayArtifacts = false;
    const checked = await engine.checkChanges(checkInput, authorization);
    persistCrash.mockRestore();
    expect(checked.idempotentReplay).toBe(true);
    expect(checked.changeCheck.analysis.repositoryDelta.paths.length).toBe(
      classificationMode === "unknown" ? 3 : 2,
    );
    expect(checked.evidence.filter((item) => item.kind === "diff_hunk").length)
      .toBeGreaterThanOrEqual(classificationMode === "unknown" ? 3 : 2);
    const findingTypes = new Set(checked.changeCheck.findings.map((item) => item.type));
    if (classificationMode === "unknown") {
      expect(findingTypes).toContain("cannot_determine");
      expect(checked.changeCheck.analysis.actualChanges.some((item) =>
        item.path === "src/ambiguous.ts" &&
        item.analysisStatus === "unknown" &&
        item.newSymbolRefs.length === 2
      )).toBe(true);
    } else {
      expect(findingTypes).toEqual(new Set([
        "planned_completed",
        "unplanned_change",
        "possible_omission",
      ]));
    }
    expect(checked.changeCheck.analysis.actualChanges.some((item) =>
      item.path === completedPath && item.newSymbolRefs.length > 0
    )).toBe(true);
    expect(
      checked.changeCheck.analysis.repositoryDelta.paths.find(
        (item) => item.path === completedPath,
      )?.effectiveChange?.after,
    ).toMatchObject({ status: "content", mode: "100755" });
    for (const claim of checked.findingClaims) {
      for (const evidenceId of claim.evidenceIds) {
        expect(checked.evidence.find((item) => item.id === evidenceId)?.claimIds)
          .toContain(claim.id);
      }
    }
    const replayedCheck = await engine.checkChanges(checkInput, authorization);
    expect(replayedCheck.idempotentReplay).toBe(true);
    expect(replayedCheck.changeCheck.id).toBe(checked.changeCheck.id);
    expect(providerStore.inspectState().revision).toBe(providerBeforeDrift + 2);
    revision = checked.committedRevision;

    for (const finding of checked.changeCheck.findings.filter((item) => item.blocking)) {
      await update({
        type: "accept_finding",
        findingId: finding.id,
        reason: "Step 15 production vertical explicitly accepts the observed blocking finding.",
      }, `step15-accept-${finding.id}`);
    }
    await update(
      { type: "transition_status", to: "verification_required" },
      "step15-verification-required",
    );
    const planEntry = built.brief.verificationPlan[0]!;
    const secret = "token=Step15SuperSecretValue";
    const sentinel = path.join(root, "verification-command-must-not-run");
    const raw = Buffer.from(`${secret}\n${root}\n`, "utf8");
    const verificationInput = {
      profile: "record_verification_strong_v1" as const,
      taskId: built.task.taskId,
      snapshotId: actual.snapshotId,
      verificationPlanEntryId: VerificationPlanEntryIdV1Schema.parse(
        planEntry.id,
      ),
      method: planEntry.method,
      status: "passed" as const,
      claimIds: [...planEntry.acceptanceClaimIds].sort(),
      command: {
        executable: "sh",
        arguments: ["-c", `touch ${sentinel}; echo ${secret}`],
        workingDirectory: "repository_root" as const,
        environmentKeys: [],
      },
      exitCode: 0,
      durationMs: 1,
      summary: `${secret} observed under ${root}`,
      rawOutputBase64url: `base64url:${raw.toString("base64url")}`,
      expectedRevision: revision,
      idempotencyKey: "step15-strong-verification",
      actor: ACTOR,
    };
    await expect(engine.updateTask(UpdateTaskInputV1Schema.parse({
      taskId: built.task.taskId, expectedRevision: revision, idempotencyKey: "verified-too-early",
      actor: ACTOR, action: { type: "transition_status", to: "verified" },
    }), authorization)).rejects.toMatchObject({ code: "task_gate_unsatisfied" });
    const verified = await engine.recordVerification(
      verificationInput,
      authorization,
    );
    expect(verified.verification.detail).toMatchObject({
      status: "redacted",
      redactionCodes: expect.arrayContaining([
        "secret_detected",
        "host_path_detected",
      ]),
    });
    expect(verified.commitEvidence.security.rawExecutionPersisted).toBe(false);
    const replayedVerification = await engine.recordVerification(
      verificationInput,
      authorization,
    );
    expect(replayedVerification.idempotentReplay).toBe(true);
    expect(replayedVerification.verification.id).toBe(verified.verification.id);
    expect(providerStore.inspectState().revision).toBe(providerBeforeDrift + 3);

    const providerBeforeMismatch = providerStore.inspectState().revision;
    await expect(engine.recordVerification({
      ...verificationInput,
      method: "build",
      expectedRevision: verified.committedRevision,
      idempotencyKey: "step15-method-mismatch",
    }, authorization)).rejects.toThrow();
    expect(providerStore.inspectState().revision).toBe(providerBeforeMismatch);
    expect((await store.readTaskBundle(built.task.taskId)).bundle.manifest.revision)
      .toBe(verified.committedRevision);
    await expect(access(sentinel)).rejects.toMatchObject({ code: "ENOENT" });

    const publicAndProviderBytes = [
      await allFileText(path.join(root, ".understand-code")),
      await allFileText(providerRoot),
      JSON.stringify(checked),
      JSON.stringify(verified),
    ].join("\n");
    expect(publicAndProviderBytes).not.toContain(secret);
    expect(publicAndProviderBytes).not.toContain(root);
    expect(publicAndProviderBytes).not.toContain(sentinel);

    expect((await store.readTaskBundle(built.task.taskId)).bundle.manifest.status).toBe("verification_required");
    revision = verified.committedRevision;
    await update({ type: "block_task", reasonCode: "external_dependency", message: "Await bounded review" }, "verified-block");
    await update({ type: "resume_task" }, "verified-resume");
    const completeInput = UpdateTaskInputV1Schema.parse({
      taskId: built.task.taskId, expectedRevision: revision,
      idempotencyKey: "step16-provider-verified", actor: ACTOR,
      action: { type: "transition_status", to: "verified" },
    });
    await expect(new TaskEngine(store, { contextProvider }).updateTask(completeInput, authorization)).rejects
      .toMatchObject({ code: "capability_unavailable" });
    const beforeComplete = providerStore.inspectState().revision;
    const compareFailure = vi.spyOn(provider, "compareCommit")
      .mockRejectedValueOnce(new Error("verified interrupted before CAS"));
    await expect(engine.updateTask(completeInput, authorization)).rejects.toThrow("verified interrupted before CAS");
    expect(providerStore.inspectState().revision).toBe(beforeComplete);
    compareFailure.mockRestore();
    const verifiedCrash = vi.spyOn(store, "persistTaskBundle")
      .mockRejectedValueOnce(new Error("verified crash after Provider commit"));
    await expect(engine.updateTask(completeInput, authorization)).rejects.toThrow("verified crash after Provider commit");
    expect(providerStore.inspectState().revision).toBe(beforeComplete + 1);
    expect(providerStore.inspectState().phase).toBe("strong_task_verified_v1");
    expect((await store.readTaskBundle(built.task.taskId)).bundle.manifest.status).toBe("verification_required");
    const committedReader = {
      inspectBusinessHead: () => provider.inspectBusinessHead!(),
      readExactObject: async (locator: Parameters<StrongChangeProviderAuthorityV1["readExactObject"]>[0]["locator"]) => ({
        ...await provider.readExactObject({ locator }), operation: "read_object",
      }),
    };
    const committedPins = { taskId: built.task.taskId, operation: "update_task" as const,
      committedRevision: completeInput.expectedRevision + 1, requestDigest: sha256CanonicalJson(completeInput) };
    const committedAtCrash = await readCommittedStrongTaskProjectionInternalV1(committedReader, committedPins);
    // Recovery must replay the original nonce even if another business commit
    // moved the head; that older projection is not exposed as the current head.
    if (classificationMode === "unknown") await providerStore.compareCommit({
      operationNonce: "e".repeat(32), expectedRevision: beforeComplete + 1,
      phase: "another_task_commit", artifacts: { testInterveningCommit: true },
    });
    const finalProviderRevision = beforeComplete + (classificationMode === "unknown" ? 2 : 1);
    await expect(engine.updateTask({ ...completeInput, idempotencyKey: "different-verified-key" }, authorization))
      .rejects.toThrow();
    expect(providerStore.inspectState().revision).toBe(finalProviderRevision);
    const completed = await engine.updateTask(completeInput, authorization);
    verifiedCrash.mockRestore();
    expect(completed.task.status).toBe("verified");
    expect(completed.mutation).toMatchObject({ revision: completeInput.expectedRevision + 1, idempotentReplay: true });
    const replayedComplete = await engine.updateTask(completeInput, authorization);
    expect(replayedComplete).toEqual(completed);
    expect(providerStore.inspectState().revision).toBe(finalProviderRevision);
    const committedTask = classificationMode === "unknown" ? committedAtCrash
      : await readCommittedStrongTaskProjectionInternalV1(committedReader, committedPins);
    expect(committedTask.bundle.manifest).toEqual(completed.task);
    expect(Object.isFrozen(committedTask.bundle.manifest)).toBe(true);
    if (classificationMode === "unknown") await expect(
      readCommittedStrongTaskProjectionInternalV1(committedReader, committedPins),
    ).rejects.toMatchObject({ code: "strong_change_provider_invalid" });
    },
    60_000,
  );

  it(
    "derives the complete A..C committed Delta from the pinned Task baseline when the actual Snapshot change list is empty",
    async () => {
      const root = await mkdtemp(
        path.join(tmpdir(), "task-engine-committed-delta-e2e-"),
      );
      const providerRoot = await mkdtemp(
        path.join(tmpdir(), "provider-committed-delta-e2e-"),
      );
      temporaryRoots.push(root, providerRoot);
      await mkdir(path.join(root, "src"), { recursive: true });
      const sources: Record<string, string> = {
        "src/entry.ts": "export function entryPoint() {\n  return \"baseline\";\n}\n",
        "src/planned.ts": "export function plannedTarget() {\n  return \"baseline\";\n}\n",
        "src/omitted.ts": "export function omittedTarget() {\n  return \"baseline\";\n}\n",
        "src/context.ts": "export function contextTarget() {\n  return \"baseline\";\n}\n",
        "src/ambiguous.ts": "export class AmbiguousService {\n  ambiguousMethod(): string {\n    return \"baseline\";\n  }\n}\n",
      };
      for (const [relative, bytes] of Object.entries(sources)) {
        await writeFile(path.join(root, relative), bytes, "utf8");
      }
      await writeFile(
        path.join(root, ".gitignore"),
        ".understand-code/\n",
        "utf8",
      );
      await git(root, ["init", "-q", "-b", "feature/committed-delta-e2e"]);
      await git(root, ["add", "."]);
      await git(root, [
        "-c", "user.name=Committed Delta Fixture",
        "-c", "user.email=committed-delta@example.invalid",
        "commit", "-q", "-m", "baseline A",
      ]);
      const baselineCommit = (await git(root, ["rev-parse", "HEAD"]))
        .toString("ascii").trim();
      const baselineGraphBytes = Buffer.from(
        `${JSON.stringify(graphFixture(baselineCommit))}\n`,
        "utf8",
      );
      await mkdir(path.join(root, ".understand-code"), { recursive: true });
      await writeFile(
        path.join(root, ".understand-code/knowledge-graph.json"),
        baselineGraphBytes,
      );

      const baseline = snapshot(baselineCommit, [], "baseline");
      const store = await ArtifactStore.open(root, {
        repositoryId: REPOSITORY_ID,
        worktreeId: WORKTREE_ID,
        producerVersion: PRODUCER_VERSION,
        clock: () => new Date("2026-08-26T01:00:03.000Z"),
      });
      await store.initialize();
      await store.persistArtifact(snapshotArtifact(baseline));
      await store.persistArtifact(pulseArtifact(baseline, 0));
      await publishGraphDescriptor(
        store,
        baselineGraphBytes,
        baseline.snapshotId,
        0,
      );

      const providerStore = new DurableObjectProviderRuntimeStoreV1({
        rootPath: providerRoot,
        providerId: PROVIDER_ID,
      });
      await providerStore.initialize();
      const provider: StrongChangeProviderAuthorityV1 = {
        async inspectState() {
          return { revision: providerStore.inspectState().revision };
        },
        readExactObject: ({ locator }) => providerStore.readFixedObject(
          locator as unknown as Parameters<
            typeof providerStore.readFixedObject
          >[0],
        ),
        async writeExactObject(input) {
          const result = await providerStore.writeFixedObject(
            input.locator as unknown as Parameters<
              typeof providerStore.writeFixedObject
            >[0],
            input.logicalBytes,
            input.bytes,
          );
          return {
            resolution: result.resolution,
            verifiedContentDigest: result.verifiedContentDigest,
          };
        },
        async compareCommit(input) {
          const result = await providerStore.compareCommit(
            input as Parameters<typeof providerStore.compareCommit>[0],
          );
          return {
            resolution: result.resolution,
            committedRevision: result.state.revision,
            artifacts: result.state.artifacts,
          };
        },
      };

      let inflateCommitReads = false;
      let inflatedCommitReadCount = 0;
      let observedSessionCount = 0;
      const observedCommands: Array<{
        session: number;
        command: SafeGitReadCommandV1;
      }> = [];
      const contextProvider = await RepositoryTaskContextProvider.open({
        canonicalRoot: root,
        openStrongSafeGitReadSession: async () => {
          observedSessionCount += 1;
          const observedSession = observedSessionCount;
          const executor = {
            async execute(
              command: SafeGitReadCommandV1,
            ): Promise<SafeGitReadExecutionResultV1> {
              observedCommands.push({ session: observedSession, command });
              const result = await gitRaw(root, readArgs(command));
              const inflateThisRead =
                inflateCommitReads &&
                command.request.profile === "cat_file_object_v1" &&
                /^tree [0-9a-f]{40,64}\n/u.test(
                  result.stdout.toString("ascii", 0, 80),
                );
              if (inflateThisRead) inflatedCommitReadCount += 1;
              const stdout = inflateThisRead
                  ? Buffer.concat([
                      result.stdout,
                      Buffer.alloc(34 * 1024 * 1024),
                    ])
                  : result.stdout;
              return {
                stdout,
                stderr: result.stderr,
                exitCode: result.exitCode,
              };
            },
          };
          const lease = async (
            request: SafeGitTaskBaselineLeaseCreateRequestV1,
            recovery: boolean,
          ) => {
            const intent = createSafeGitTaskBaselineLeaseIntentV1({
              repositoryId: REPOSITORY_ID,
              worktreeId: WORKTREE_ID,
              taskId: request.taskId,
              baselineSnapshotId: request.baselineSnapshotId,
              objectFormat: "sha1",
              commit: request.commit,
              markerNonce: request.markerNonce,
            });
            const existing = await gitRaw(root, [
              "show-ref", "--verify", "--hash", intent.refName,
            ]);
            if (existing.exitCode === 0) {
              if (existing.stdout.toString("ascii").trim() !== request.commit) {
                throw new Error("baseline lease ref conflicts");
              }
              return {
                resolution: "replayed" as const,
                leaseId: intent.leaseId,
                refName: intent.refName,
                objectId: intent.objectId,
              };
            }
            if (recovery) {
              throw new Error("baseline lease disappeared during recovery");
            }
            await git(root, [
              "update-ref", "--create-reflog", intent.refName,
              request.commit, "0".repeat(40),
            ]);
            return {
              resolution: "created" as const,
              leaseId: intent.leaseId,
              refName: intent.refName,
              objectId: intent.objectId,
            };
          };
          return {
            executor,
            async executeGitObjectType(objectId: string) {
              const result = (await git(root, [
                "cat-file", "-t", "--", objectId,
              ])).toString("ascii").trim();
              if (
                result !== "blob" &&
                result !== "tree" &&
                result !== "commit"
              ) {
                throw new Error("unexpected Git object type");
              }
              return result;
            },
            createTaskBaselineLease: (
              request: SafeGitTaskBaselineLeaseCreateRequestV1,
            ) => lease(request, false),
            recoverTaskBaselineLease: (
              request: SafeGitTaskBaselineLeaseCreateRequestV1,
            ) => lease(request, true),
            async close() {},
          };
        },
      });
      const ownerKeyAuthority = {
        provenance: "provider_installation_owner_v1" as const,
        async commit(
          domain:
            | "record-verification-full-input-v1"
            | "verification-detail-semantic-v1",
          value: string,
        ) {
          return `hmac-sha256:${createHmac(
            "sha256",
            "committed-delta-owner-key",
          ).update(domain).update("\0").update(value).digest("hex")}`;
        },
      };
      const materialAuthority = new RepositoryStrongChangeMaterialAuthorityV1({
        store,
        repositoryContextProvider: contextProvider,
        provider,
        providerId: PROVIDER_ID,
        ownerKeyAuthority,
      });
      const strongAuthority = new ArtifactStoreStrongChangeAuthorityV1(store, {
        provider,
        materialAuthority,
        providerId: PROVIDER_ID,
      });
      let engineTime = Date.parse("2026-08-26T01:20:00.000Z");
      const engine = new TaskEngine(store, {
        contextProvider,
        strongChangeAuthority: strongAuthority,
        clock: () => new Date(engineTime++),
      });
      const authorization: AuthorizationContext = {
        actor: ACTOR,
        repositoryId: REPOSITORY_ID,
        worktreeId: WORKTREE_ID,
        capabilities: [
          "task:create",
          "task:update",
          "task:confirm",
          "task:accept",
          "task:supersede",
        ],
      };

      const built = await engine.buildTaskBrief({
        task: "Update planned target, preserve omitted target, and inspect the ambiguous service",
        expectedRevision: 0,
        idempotencyKey: "committed-delta-build",
        actor: ACTOR,
        tokenBudget: 8_000,
        maxCandidates: 20,
        maxImpactDepth: 4,
      }, authorization);
      const committedPaths = [...new Set(
        built.brief.plannedChanges
          .filter((item) =>
            item.expectation === "required_change" &&
            sources[item.filePath] !== undefined &&
            item.filePath !== "src/ambiguous.ts"
          )
          .map((item) => item.filePath),
      )].slice(0, 2);
      expect(committedPaths).toHaveLength(2);
      const firstPath = committedPaths[0]!;
      const secondPath = committedPaths[1]!;

      let revision = built.task.revision;
      const update = async (
        action: Parameters<TaskEngine["updateTask"]>[0]["action"],
        idempotencyKey: string,
      ) => {
        const result = await engine.updateTask({
          taskId: built.task.taskId,
          action,
          expectedRevision: revision,
          idempotencyKey,
          actor: ACTOR,
        }, authorization);
        revision = result.task.revision;
      };
      await update({
        type: "confirm_goal",
        claimId: built.brief.goalClaimId,
        contextGenerationId: built.brief.contextGenerationId,
      }, "committed-delta-confirm-goal");
      await update({
        type: "confirm_acceptance_criteria",
        claimIds: built.brief.acceptanceClaimIds,
        contextGenerationId: built.brief.contextGenerationId,
      }, "committed-delta-confirm-acceptance");
      await update({
        type: "confirm_plan",
        plannedChangeIds: built.brief.plannedChanges.map((item) => item.id),
        contextGenerationId: built.brief.contextGenerationId,
      }, "committed-delta-confirm-plan");
      await update(
        { type: "transition_status", to: "planned" },
        "committed-delta-planned",
      );
      await update(
        { type: "transition_status", to: "in_progress" },
        "committed-delta-in-progress",
      );

      const firstBefore = sources[firstPath]!;
      const firstAfter = firstBefore.replace("baseline", "commit-b");
      await writeFile(path.join(root, firstPath), firstAfter, "utf8");
      await git(root, ["add", "--", firstPath]);
      await git(root, [
        "-c", "user.name=Committed Delta Fixture",
        "-c", "user.email=committed-delta@example.invalid",
        "commit", "-q", "-m", "commit B",
      ]);
      const commitB = (await git(root, ["rev-parse", "HEAD"]))
        .toString("ascii").trim();

      const secondBefore = sources[secondPath]!;
      const secondAfter = secondBefore.replace("baseline", "commit-c");
      await writeFile(path.join(root, secondPath), secondAfter, "utf8");
      await git(root, ["add", "--", secondPath]);
      await git(root, [
        "-c", "user.name=Committed Delta Fixture",
        "-c", "user.email=committed-delta@example.invalid",
        "commit", "-q", "-m", "commit C",
      ]);
      const commitC = (await git(root, ["rev-parse", "HEAD"]))
        .toString("ascii").trim();
      expect(new Set([baselineCommit, commitB, commitC])).toHaveLength(3);

      const actualGraphBytes = Buffer.from(
        `${JSON.stringify(graphFixture(commitC))}\n`,
        "utf8",
      );
      await writeFile(
        path.join(root, ".understand-code/knowledge-graph.json"),
        actualGraphBytes,
      );
      expect((await git(root, ["status", "--porcelain"])).byteLength).toBe(0);

      const actual = snapshot(commitC, [], "actual-committed-delta");
      expect(actual.changes).toEqual([]);
      await store.persistArtifact(snapshotArtifact(actual));
      await store.persistArtifact(pulseArtifact(actual, 1), {
        expectedRevision: 0,
        idempotencyKey: "committed-delta-actual-pulse",
        requestDigest: sha256CanonicalJson([
          "committed-delta-actual-pulse",
          actual.snapshotId,
        ]),
      });
      await publishGraphDescriptor(
        store,
        actualGraphBytes,
        actual.snapshotId,
        1,
      );
      await update(
        { type: "transition_status", to: "check_required" },
        "committed-delta-check-required",
      );

      const checkInput = {
        profile: "check_changes_strong_v1",
        taskId: built.task.taskId,
        actualSnapshotId: actual.snapshotId,
        includeWorktree: true,
        expectedRevision: revision,
        idempotencyKey: "committed-delta-check",
        actor: ACTOR,
      } as const;
      const providerRevisionBeforeBudgetFailure =
        providerStore.inspectState().revision;
      inflateCommitReads = true;
      await expect(engine.checkChanges(checkInput, authorization)).rejects
        .toMatchObject({ code: "strong_change_provider_invalid" });
      expect(inflatedCommitReadCount).toBe(2);
      expect(providerStore.inspectState().revision).toBe(
        providerRevisionBeforeBudgetFailure,
      );
      inflateCommitReads = false;
      observedCommands.length = 0;

      const checked = await engine.checkChanges(checkInput, authorization);
      const objectReadsBySession = new Map<number, string[]>();
      for (const { session, command } of observedCommands) {
        if (command.request.profile !== "cat_file_object_v1") continue;
        const ids = objectReadsBySession.get(session) ?? [];
        ids.push(command.request.objectId);
        objectReadsBySession.set(session, ids);
      }
      for (const objectReadIds of objectReadsBySession.values()) {
        expect(new Set(objectReadIds).size).toBe(objectReadIds.length);
      }
      const expectedPaths = [...committedPaths].sort();
      const delta = checked.changeCheck.analysis.repositoryDelta;
      expect(delta.status).toBe("complete");
      expect(delta.boundaryIds).toEqual([]);
      expect(delta.paths.map((item) => item.path).sort()).toEqual(expectedPaths);
      for (const pathDelta of delta.paths) {
        expect(pathDelta.segments).toHaveLength(1);
        expect(pathDelta.segments[0]).toMatchObject({
          source: "committed",
          status: "complete",
          boundaryIds: [],
        });
        expect(pathDelta.effectiveChange?.kind).toBe("modified");
      }
      expect(
        checked.changeCheck.analysis.actualChanges
          .map((item) => item.path)
          .sort(),
      ).toEqual(expectedPaths);
      const diffHunks = checked.evidence.filter(
        (item) => item.kind === "diff_hunk",
      );
      expect(diffHunks.map((item) => item.filePath).sort()).toEqual(
        expectedPaths,
      );
      expect(diffHunks.every((item) =>
        item.hunk.sourceLayers.length === 1 &&
        item.hunk.sourceLayers[0] === "committed"
      )).toBe(true);
    },
    60_000,
  );
});
