import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { ArtifactStore } from "@understand-code/artifact-store";
import {
  resolveRepositoryPath,
} from "@understand-code/artifact-store/path-guard";
import {
  RepoPulseArtifactV1Schema,
  RepoPulseV1Schema,
  RepositoryRelativePathSchema,
  RepositorySnapshotArtifactV1Schema,
  RepositorySnapshotV1Schema,
  type RepoPulseV1,
  type RepositorySnapshotV1,
} from "@understand-code/contracts";
import type {
  GraphNode,
  KnowledgeGraph,
} from "@understand-code/core";
import {
  KnowledgeGraphSchema,
} from "@understand-code/core";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  compareUnicodeCodeUnits,
  rankCandidates,
  RepositoryTaskContextProvider,
  sha256CanonicalJson,
  stableId,
  TaskEngine,
} from "../src/index.js";

interface DeclaredTarget {
  nodeId: string;
  filePath: string;
  symbolName: string;
}

interface SelfHostFixture {
  schemaVersion: 1;
  name: string;
  intent: string;
  createdAt: string;
  createIdentity: {
    createScope: string;
    idempotencyKey: string;
    actor: string;
  };
  declaredTargets: DeclaredTarget[];
  budgets: {
    maxCandidates: number;
    tokenBudget: number;
    maxImpactDepth: number;
  };
  captureLimitations: string[];
}

interface VerifiedTarget extends DeclaredTarget {
  node: GraphNode;
  lineRange: [number, number];
  contentDigest: `sha256:${string}`;
}

interface RealRepositoryCapture {
  repositoryRoot: string;
  graph: KnowledgeGraph;
  headCommit: string;
  branch: string;
  targets: VerifiedTarget[];
  snapshot: RepositorySnapshotV1;
  pulse: RepoPulseV1;
}

const execFileAsync = promisify(execFile);
const REPOSITORY_ID = "repository:self-host-benchmark";
const WORKTREE_ID = "worktree:self-host-benchmark";
const PRODUCER_VERSION = "3.0.0-alpha.1";
const temporaryRoots: string[] = [];

function sha256Bytes(value: string | Buffer): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function git(
  repositoryRoot: string,
  args: readonly string[],
): Promise<string> {
  const result = await execFileAsync("git", [...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return result.stdout;
}

async function fixture(): Promise<SelfHostFixture> {
  const value = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/self-host-persistent-task.v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SelfHostFixture;
  if (
    value.schemaVersion !== 1 ||
    value.declaredTargets.length === 0 ||
    value.captureLimitations.length === 0
  ) {
    throw new TypeError("The self-host benchmark fixture is incomplete.");
  }
  return value;
}

function lineSlice(
  source: string,
  lineRange: readonly [number, number],
): string {
  return source
    .split(/\r?\n/gu)
    .slice(lineRange[0] - 1, lineRange[1])
    .join("\n");
}

async function verifyDeclaredTargets(
  repositoryRoot: string,
  graph: KnowledgeGraph,
  declarations: readonly DeclaredTarget[],
): Promise<VerifiedTarget[]> {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const verified: VerifiedTarget[] = [];
  for (const declaration of declarations) {
    const parsedPath = RepositoryRelativePathSchema.parse(
      declaration.filePath,
    );
    const node = nodes.get(declaration.nodeId);
    if (
      node === undefined ||
      node.filePath !== parsedPath ||
      node.name !== declaration.symbolName ||
      node.lineRange === undefined
    ) {
      throw new TypeError(
        `Declared self-host symbol no longer matches the current Graph: ${declaration.nodeId}`,
      );
    }
    const absolutePath = await resolveRepositoryPath(
      repositoryRoot,
      parsedPath,
    );
    const metadata = await stat(absolutePath);
    if (!metadata.isFile()) {
      throw new TypeError(
        `Declared self-host target is not a regular file: ${parsedPath}`,
      );
    }
    const bytes = await readFile(absolutePath);
    const source = bytes.toString("utf8");
    if (!lineSlice(source, node.lineRange).includes(node.name)) {
      throw new TypeError(
        `Declared symbol is absent from its current Graph line range: ${declaration.nodeId}`,
      );
    }
    verified.push({
      ...declaration,
      node,
      lineRange: [node.lineRange[0], node.lineRange[1]],
      contentDigest: sha256Bytes(bytes),
    });
  }
  return verified;
}

async function captureRealRepository(
  input: SelfHostFixture,
): Promise<RealRepositoryCapture> {
  const repositoryRoot = await realpath(
    fileURLToPath(new URL("../../../", import.meta.url)),
  );
  const graphBytes = await readFile(
    new URL(
      "../fixtures/self-host-knowledge-graph.v1.json",
      import.meta.url,
    ),
  );
  const graph = KnowledgeGraphSchema.parse(
    JSON.parse(graphBytes.toString("utf8")) as unknown,
  );
  const [
    headCommitRaw,
    branchRaw,
    indexProjection,
    worktreeProjection,
    untrackedProjection,
    ignoredProjection,
  ] = await Promise.all([
    git(repositoryRoot, ["rev-parse", "HEAD"]),
    git(repositoryRoot, ["branch", "--show-current"]),
    git(repositoryRoot, [
      "diff",
      "--cached",
      "--raw",
      "-z",
      "--no-abbrev",
    ]),
    git(repositoryRoot, [
      "diff",
      "--raw",
      "-z",
      "--no-abbrev",
    ]),
    git(repositoryRoot, [
      "ls-files",
      "--others",
      "--exclude-standard",
      "-z",
    ]),
    git(repositoryRoot, [
      "ls-files",
      "--others",
      "--ignored",
      "--exclude-standard",
      "-z",
    ]),
  ]);
  const headCommit = headCommitRaw.trim();
  const branch = branchRaw.trim() || "detached";
  const targets = await verifyDeclaredTargets(
    repositoryRoot,
    graph,
    input.declaredTargets,
  );
  const stateIdentity = {
    headCommit,
    branch,
    graphDigest: sha256Bytes(graphBytes),
    targetDigests: targets.map((target) => [
      target.filePath,
      target.contentDigest,
    ]),
    projections: {
      index: sha256Bytes(indexProjection),
      worktree: sha256Bytes(worktreeProjection),
      untracked: sha256Bytes(untrackedProjection),
      ignored: sha256Bytes(ignoredProjection),
    },
  };
  const snapshotId = stableId("snapshot", stateIdentity);
  const rootIdentity = stableId("root", {
    graphDigest: stateIdentity.graphDigest,
    targetPaths: targets.map((target) => target.filePath),
  });
  const snapshot = RepositorySnapshotV1Schema.parse({
    schemaVersion: 1,
    snapshotId,
    repositoryId: REPOSITORY_ID,
    worktreeId: WORKTREE_ID,
    rootIdentity,
    branch,
    headCommit,
    indexDigest: sha256CanonicalJson({
      kind: "git-index-projection",
      value: indexProjection,
    }),
    worktreeDigest: sha256CanonicalJson({
      kind: "git-worktree-projection",
      value: worktreeProjection,
      declaredCorpus: stateIdentity.targetDigests,
    }),
    untrackedDigest: sha256CanonicalJson({
      kind: "git-untracked-projection",
      value: untrackedProjection,
    }),
    ignoreDigest: sha256CanonicalJson({
      kind: "git-ignored-projection",
      value: ignoredProjection,
    }),
    createdAt: input.createdAt,
    captureStatus: "partial",
    limitations: input.captureLimitations,
    // The benchmark does not reinterpret declared corpus files as Git
    // changes. With no complete Git change capture, Source Evidence remains
    // absent instead of being marked falsely fresh.
    changes: [],
  });
  const graphAligned = graph.project.gitCommitHash === headCommit;
  const pulse = RepoPulseV1Schema.parse({
    evaluatedSnapshotId: snapshotId,
    status: "partial",
    artifactFreshness: {
      graph: graphAligned ? "partial" : "stale",
      wiki: "missing",
      evidence: "missing",
      diff: "partial",
      task: "missing",
    },
    repositoryState: {
      rootIdentity,
      branch,
      headCommit,
      captureStatus: "partial",
      limitations: input.captureLimitations,
    },
    completeness: {
      parser: {
        status: "partial",
        reasons: [
          graphAligned
            ? "The checked-in Graph covers its analyzed corpus but the benchmark does not prove repository-wide parser coverage."
            : `The checked-in Graph commit ${graph.project.gitCommitHash} differs from current HEAD.`,
        ],
      },
      callGraph: {
        status: "unknown",
        reasons: [
          "Static analysis cannot prove runtime-only or dynamic call targets.",
        ],
      },
    },
    recommendedRefresh: "incremental",
    errors: [],
    unknowns: [
      {
        code: "self-host-partial-capture",
        scope: "repository",
        message: input.captureLimitations[0]!,
      },
    ],
    reasons: [
      "Self-host benchmark uses an explicitly partial Repository Snapshot.",
      graphAligned
        ? "Repository-wide Graph coverage is not proven."
        : "The checked-in Graph is stale relative to current HEAD.",
      "Call Graph completeness is unknown.",
    ],
    evaluatedAt: input.createdAt,
  });
  return {
    repositoryRoot,
    graph,
    headCommit,
    branch,
    targets,
    snapshot,
    pulse,
  };
}

function snapshotArtifact(capture: RealRepositoryCapture) {
  const payload = capture.snapshot;
  return RepositorySnapshotArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "repository_snapshot",
    artifactId: `artifact:repository-snapshot:${payload.snapshotId}`,
    repositoryId: REPOSITORY_ID,
    worktreeId: WORKTREE_ID,
    sourceSnapshotId: payload.snapshotId,
    revision: 0,
    producerVersion: PRODUCER_VERSION,
    createdAt: payload.createdAt,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

function pulseArtifact(capture: RealRepositoryCapture) {
  const payload = capture.pulse;
  return RepoPulseArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "repo_pulse",
    artifactId: `artifact:repo-pulse:${payload.evaluatedSnapshotId}`,
    repositoryId: REPOSITORY_ID,
    worktreeId: WORKTREE_ID,
    sourceSnapshotId: payload.evaluatedSnapshotId,
    revision: 0,
    producerVersion: PRODUCER_VERSION,
    createdAt: payload.evaluatedAt,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

async function runTaskEngine(
  input: SelfHostFixture,
  capture: RealRepositoryCapture,
) {
  const storeRoot = await mkdtemp(
    path.join(tmpdir(), "self-host-task-engine-"),
  );
  temporaryRoots.push(storeRoot);
  const store = await ArtifactStore.open(storeRoot, {
    repositoryId: REPOSITORY_ID,
    worktreeId: WORKTREE_ID,
    producerVersion: PRODUCER_VERSION,
  });
  await store.initialize();
  await mkdir(
    path.join(storeRoot, ".understand-code"),
    { recursive: true },
  );
  await writeFile(
    path.join(storeRoot, ".understand-code/knowledge-graph.json"),
    `${JSON.stringify(capture.graph)}\n`,
    "utf8",
  );
  for (const target of capture.targets) {
    const destination = path.join(storeRoot, target.filePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(
      path.join(capture.repositoryRoot, target.filePath),
      destination,
    );
  }
  await store.persistArtifact(snapshotArtifact(capture));
  await store.persistArtifact(pulseArtifact(capture));

  const provider = await RepositoryTaskContextProvider.open({
    canonicalRoot: storeRoot,
  });
  const engine = new TaskEngine(store, {
    contextProvider: provider,
    createScope: input.createIdentity.createScope,
    clock: () => new Date(input.createdAt),
  });
  const buildInput = {
    task: input.intent,
    expectedRevision: 0 as const,
    idempotencyKey: input.createIdentity.idempotencyKey,
    actor: input.createIdentity.actor,
    scope: input.declaredTargets.map((target) => target.filePath),
    tokenBudget: input.budgets.tokenBudget,
    maxCandidates: input.budgets.maxCandidates,
    maxImpactDepth: input.budgets.maxImpactDepth,
  };
  const authorization = {
    actor: input.createIdentity.actor,
    repositoryId: REPOSITORY_ID,
    worktreeId: WORKTREE_ID,
    capabilities: ["task:create"] as const,
  };
  const result = await engine.buildTaskBrief(
    buildInput,
    authorization,
  );
  const replay = await engine.buildTaskBrief(
    buildInput,
    authorization,
  );
  const read = await store.readTaskBundle(result.task.taskId);
  if (!("brief" in read.bundle)) {
    throw new TypeError("Self-host Task context was not persisted.");
  }
  const bundle = read.bundle;
  const markdown = await engine.renderTaskBriefMarkdown(
    result.task.taskId,
  );
  const context = await provider.loadTaskContext({
    intent: input.intent,
    sourceSnapshotId: capture.snapshot.snapshotId,
    repositorySnapshot: capture.snapshot,
    scope: buildInput.scope,
  });
  const ranking = rankCandidates({
    query: input.intent,
    graph: context.graph,
    repoPulse: capture.pulse,
    repositorySnapshot: capture.snapshot,
    wiki: context.wiki,
    options: {
      scope: { pathPrefixes: buildInput.scope },
      tokenBudget: input.budgets.tokenBudget,
      maxCandidates: input.budgets.maxCandidates,
    },
  });
  const artifactProjection = [...read.artifacts]
    .sort((left, right) =>
      compareUnicodeCodeUnits(
        `${left.artifactType}\0${left.artifactId}`,
        `${right.artifactType}\0${right.artifactId}`,
      )
    )
    .map((artifact) => ({
      artifactType: artifact.artifactType,
      artifactId: artifact.artifactId,
      revision: artifact.revision,
      sourceSnapshotId: artifact.sourceSnapshotId,
      contentDigest: artifact.contentDigest,
      payload: artifact.payload,
    }));
  const projection = {
    result,
    replay,
    manifest: bundle.manifest,
    brief: bundle.brief,
    claims: bundle.claims,
    evidence: bundle.evidence,
    impactPaths: bundle.impactPaths,
    artifactProjection,
    ranking: {
      queryDigest: ranking.queryDigest,
      candidateNodeIds: ranking.candidates.map(
        (candidate) => candidate.nodeId,
      ),
      consumedTokens: ranking.consumedTokens,
      truncation: ranking.truncation,
      diagnostics: ranking.diagnostics,
    },
    markdown,
    freshness: read.freshness,
    recoveryState: read.recoveryState,
  };
  return {
    providerRoot: storeRoot,
    projection,
    outputDigest: sha256CanonicalJson(projection),
    read,
    bundle,
    context,
    ranking,
    markdown,
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true })
    ),
  );
});

describe("self-host Task benchmark", () => {
  it("uses current repository symbols and keeps real TaskEngine artifacts deterministic within explicit budgets", async () => {
    const input = await fixture();
    const capture = await captureRealRepository(input);

    expect(capture.headCommit).toMatch(/^[0-9a-f]{40}$/u);
    expect(capture.headCommit).not.toMatch(/^([0-9a-f])\1{39}$/u);
    expect(capture.targets.map((target) => ({
      nodeId: target.node.id,
      filePath: target.node.filePath,
      symbolName: target.node.name,
      lineRange: target.lineRange,
    }))).toEqual(
      input.declaredTargets.map((target) => ({
        ...target,
        lineRange: expect.any(Array),
      })),
    );
    expect(
      capture.targets.every(
        (target) =>
          target.lineRange[0] > 0 &&
          target.lineRange[1] >= target.lineRange[0],
      ),
    ).toBe(true);

    const first = await runTaskEngine(input, capture);
    const second = await runTaskEngine(input, capture);

    expect(second.projection).toEqual(first.projection);
    expect(second.outputDigest).toBe(first.outputDigest);
    expect(first.projection.result.task).toMatchObject({
      status: "context_ready",
      revision: 2,
      latestSnapshotId: capture.snapshot.snapshotId,
    });
    expect(first.projection.replay.mutation.idempotentReplay).toBe(true);
    expect(first.bundle.brief.readingPath.length).toBeGreaterThan(0);
    expect(first.bundle.brief.readingPath.length).toBeLessThanOrEqual(
      input.budgets.maxCandidates,
    );
    expect(first.ranking.candidates.length).toBeLessThanOrEqual(
      input.budgets.maxCandidates,
    );
    expect(first.ranking.consumedTokens).toBeLessThanOrEqual(
      input.budgets.tokenBudget,
    );
    expect(
      first.bundle.impactPaths.every(
        (impactPath) =>
          impactPath.steps.length <= input.budgets.maxImpactDepth,
      ),
    ).toBe(true);
    const rankedNodeIds = new Set(
      first.ranking.candidates.map((candidate) => candidate.nodeId),
    );
    const readingNodeIds = new Set(
      first.bundle.brief.readingPath.flatMap((entry) =>
        entry.symbolId === undefined ? [] : [entry.symbolId]
      ),
    );
    const plannedNodeIds = new Set(
      first.bundle.brief.plannedChanges.flatMap((change) =>
        change.symbolId === undefined ? [] : [change.symbolId]
      ),
    );
    for (const target of input.declaredTargets) {
      expect(rankedNodeIds.has(target.nodeId), target.nodeId).toBe(true);
      expect(readingNodeIds.has(target.nodeId), target.nodeId).toBe(true);
      expect(plannedNodeIds.has(target.nodeId), target.nodeId).toBe(true);
    }
    expect(first.ranking.freshness.freshConclusionEligible).toBe(false);
    expect(
      first.ranking.candidates.every(
        (candidate) =>
          candidate.epistemicStatus === "unknown_boundary" &&
          candidate.freshConclusion === false,
      ),
    ).toBe(true);
    expect(
      first.bundle.brief.plannedChanges.every(
        (change) => change.candidateLevel === "context_only",
      ),
    ).toBe(true);

    const unknownClaims = first.bundle.claims.filter((claim) =>
      first.bundle.brief.unknownClaimIds.includes(claim.id)
    );
    expect(unknownClaims.length).toBeGreaterThan(0);
    expect(
      unknownClaims
        .map((claim) =>
          "boundaryReason" in claim ? claim.boundaryReason ?? "" : ""
        )
        .join(" "),
    ).toMatch(/Graph artifact is stale|Call Graph|dynamic call targets/iu);
    expect(first.markdown).toContain("## Unknowns");
    expect(first.markdown).toContain("## Impact boundaries");
    expect(first.context.sourceEvidence).toBeUndefined();
    expect(first.markdown).not.toContain(capture.repositoryRoot);
    expect(first.markdown).not.toContain(first.providerRoot);

    const persistedDigests = [
      capture.snapshot.indexDigest,
      capture.snapshot.worktreeDigest,
      capture.snapshot.untrackedDigest,
      capture.snapshot.ignoreDigest,
      ...first.projection.artifactProjection.map(
        (artifact) => artifact.contentDigest,
      ),
    ];
    expect(
      persistedDigests.every(
        (value) =>
          /^sha256:[0-9a-f]{64}$/u.test(value) &&
          !/^sha256:([0-9a-f])\1{63}$/u.test(value),
      ),
    ).toBe(true);
  });
});
