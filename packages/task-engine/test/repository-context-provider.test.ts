import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  RepositorySnapshotV1Schema,
  type RepositorySnapshotV1,
} from "@understand-code/contracts";
import type { KnowledgeGraph } from "@understand-code/core";
import { getRepositorySnapshotDetailed } from "@understand-code/repository-state";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  RepositoryTaskContextProvider,
  RepositoryTaskContextProviderError,
} from "../src/repository-context-provider.js";

const roots: string[] = [];
const HEAD_COMMIT = "a".repeat(40);

function digest(value: string | Buffer): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function graphFixture(
  filePath = "src/task.ts",
): KnowledgeGraph {
  return {
    version: "1",
    project: {
      name: "provider-fixture",
      languages: ["TypeScript"],
      frameworks: [],
      description: "Repository context provider fixture",
      analyzedAt: "2026-07-29T00:00:00.000Z",
      gitCommitHash: HEAD_COMMIT,
    },
    nodes: [
      {
        id: "function:task",
        type: "function",
        name: "task",
        filePath,
        lineRange: [1, 1],
        summary: "Builds a Task.",
        tags: ["task"],
        complexity: "simple",
      },
      {
        id: "function:missing",
        type: "function",
        name: "missing",
        filePath: "src/missing.ts",
        lineRange: [1, 1],
        summary: "Represents a file removed after Graph generation.",
        tags: [],
        complexity: "simple",
      },
    ],
    edges: [],
    layers: [],
    tour: [],
  };
}

function snapshot(
  contentDigest: string,
  snapshotId = "snapshot:provider-fixture",
  options: {
    headCommit?: string;
    indexDigest?: string;
    changes?: RepositorySnapshotV1["changes"];
  } = {},
): RepositorySnapshotV1 {
  return RepositorySnapshotV1Schema.parse({
    schemaVersion: 1,
    snapshotId,
    repositoryId: "repository:provider-fixture",
    worktreeId: "worktree:provider-fixture",
    rootIdentity: "root:provider-fixture",
    headCommit: options.headCommit ?? HEAD_COMMIT,
    indexDigest: options.indexDigest ?? digest("index"),
    worktreeDigest: digest("worktree"),
    untrackedDigest: digest("untracked"),
    ignoreDigest: digest("ignore"),
    createdAt: "2026-07-29T00:00:00.000Z",
    captureStatus: "complete",
    limitations: [],
    changes: options.changes ?? [
      {
        id: "change:task",
        path: "src/task.ts",
        source: "unstaged",
        kind: "modified",
        contentDigest,
      },
    ],
  });
}

function git(
  root: string,
  arguments_: readonly string[],
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      [...arguments_],
      { cwd: root, encoding: "utf8" },
      (error, stdout) => {
        if (error !== null) reject(error);
        else resolve(stdout.trim());
      },
    );
  });
}

function gitBytes(
  root: string,
  arguments_: readonly string[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      [...arguments_],
      { cwd: root, encoding: "buffer" },
      (error, stdout) => {
        if (error !== null) reject(error);
        else resolve(stdout);
      },
    );
  });
}

async function currentIndexDigest(root: string): Promise<`sha256:${string}`> {
  return digest(await gitBytes(root, ["ls-files", "--stage", "-z"]));
}

function mirroredSnapshotFenceEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const name of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_COMMON_DIR",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  ]) {
    delete environment[name];
  }
  environment.GIT_OPTIONAL_LOCKS = "0";
  environment.GIT_TERMINAL_PROMPT = "0";
  environment.LC_ALL = "C";
  return environment;
}

async function captureFencedSnapshot(
  root: string,
  baselineRef?: string,
): Promise<RepositorySnapshotV1> {
  const capture = await getRepositorySnapshotDetailed(root, {
    ...(baselineRef === undefined ? {} : { baselineRef }),
    environment: mirroredSnapshotFenceEnvironment(),
    now: () => new Date("2026-08-22T00:00:00.000Z"),
  });
  expect(capture.snapshot.captureStatus).toBe("complete");
  expect(capture.snapshot.limitations).toEqual([]);
  return capture.snapshot;
}

async function fixtureRoot(
  graph: KnowledgeGraph = graphFixture(),
  source = "export function task() { return true; }\n",
): Promise<{ root: string; source: string }> {
  const root = await mkdtemp(
    path.join(tmpdir(), "repository-context-provider-"),
  );
  roots.push(root);
  await Promise.all([
    mkdir(path.join(root, ".understand-code/knowledge-base"), {
      recursive: true,
    }),
    mkdir(path.join(root, "src"), { recursive: true }),
  ]);
  const [wikiIndexText, wikiSearch] = await Promise.all([
    readFile(
      new URL(
        "../../contracts/fixtures/v1/legacy/wiki-index-v2.json",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../contracts/fixtures/v1/legacy/wiki-search-v2.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  const wikiIndex = JSON.parse(wikiIndexText) as {
    source: { graphDigest?: string };
  };
  wikiIndex.source.graphDigest = digest(JSON.stringify(graph));
  await Promise.all([
    writeFile(
      path.join(root, ".understand-code/knowledge-graph.json"),
      JSON.stringify(graph),
      "utf8",
    ),
    writeFile(path.join(root, "src/task.ts"), source, "utf8"),
    writeFile(
      path.join(
        root,
        ".understand-code/knowledge-base/wiki-index.json",
      ),
      JSON.stringify(wikiIndex),
      "utf8",
    ),
    writeFile(
      path.join(
        root,
        ".understand-code/knowledge-base/search-index.json",
      ),
      wikiSearch,
      "utf8",
    ),
  ]);
  return { root, source };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true })
    ),
  );
});

describe("RepositoryTaskContextProvider", () => {
  it("derives deterministic changed-line hunks and current Graph symbol IDs from exact unstaged bytes", async () => {
    const baselineSource = [
      "export function foo() { return 'old foo'; }",
      "export function bar() { return 'old bar'; }",
    ].join("\n");
    const actualSource = baselineSource
      .replace("old foo", "new foo")
      .replace("old bar", "new bar");
    const unrelatedSource = "export const unrelated = 'baseline';\n";
    const graph = graphFixture();
    graph.nodes = [
      {
        id: "function:foo",
        type: "function",
        name: "foo",
        filePath: "src/task.ts",
        lineRange: [1, 1],
        summary: "Returns foo.",
        tags: [],
        complexity: "simple",
      },
      {
        id: "function:bar",
        type: "function",
        name: "bar",
        filePath: "src/task.ts",
        lineRange: [2, 2],
        summary: "Returns bar.",
        tags: [],
        complexity: "simple",
      },
    ];
    const { root } = await fixtureRoot(graph, baselineSource);
    await writeFile(
      path.join(root, "src/unrelated.ts"),
      unrelatedSource,
      "utf8",
    );
    await git(root, ["init", "--quiet"]);
    await git(root, ["add", "src/task.ts", "src/unrelated.ts"]);
    await git(root, [
      "-c",
      "user.name=Understand Code Test",
      "-c",
      "user.email=test@understand-code.invalid",
      "commit",
      "--quiet",
      "-m",
      "baseline",
    ]);
    const headCommit = await git(root, ["rev-parse", "HEAD"]);
    const baselineSnapshot = await captureFencedSnapshot(root, headCommit);
    expect(baselineSnapshot.changes).toEqual([]);
    await writeFile(path.join(root, "src/task.ts"), actualSource, "utf8");
    const actualSnapshot = await captureFencedSnapshot(root, headCommit);
    expect(actualSnapshot.changes).toHaveLength(1);
    const taskChange = actualSnapshot.changes[0]!;
    expect(taskChange).toMatchObject({
      path: "src/task.ts",
      source: "unstaged",
      kind: "modified",
      contentDigest: digest(actualSource),
    });
    const taskChangeId = taskChange.id;
    const provider = await RepositoryTaskContextProvider.open({
      canonicalRoot: root,
    });

    const first = await provider.analyzeTaskChanges({
      taskId: "task:analysis",
      baselineSnapshot,
      actualSnapshot,
    });
    const second = await provider.analyzeTaskChanges({
      taskId: "task:analysis",
      baselineSnapshot,
      actualSnapshot,
    });

    expect(second).toEqual(first);
    expect(first).toMatchObject({ status: "complete", boundaries: [] });
    expect(first.hunks).toEqual([
      expect.objectContaining({
        actualChangeIds: [taskChangeId],
        filePath: "src/task.ts",
        newLineRange: [1, 1],
        nodeIds: ["function:foo"],
        contentHash: digest(actualSource),
      }),
      expect.objectContaining({
        actualChangeIds: [taskChangeId],
        filePath: "src/task.ts",
        newLineRange: [2, 2],
        nodeIds: ["function:bar"],
        contentHash: digest(actualSource),
      }),
    ]);

    await Promise.all([
      writeFile(
        path.join(root, "src/unrelated.ts"),
        "export const unrelated = 'drifted';\n",
        "utf8",
      ),
      writeFile(
        path.join(root, "src/untracked-drift.ts"),
        "export const untrackedDrift = true;\n",
        "utf8",
      ),
    ]);
    expect(await readFile(path.join(root, "src/task.ts"), "utf8")).toBe(
      actualSource,
    );
    const unrelatedLiveDrift = await provider.analyzeTaskChanges({
      taskId: "task:analysis",
      baselineSnapshot,
      actualSnapshot,
    });
    expect(unrelatedLiveDrift).toEqual({
      status: "unknown",
      hunks: [],
      deletedFiles: [],
      boundaries: [
        {
          code: "content_changed",
          reason:
            "The current worktree, untracked, or ignore state no longer matches the actual Snapshot.",
          actualChangeIds: [taskChangeId],
        },
      ],
    });
  });

  it("derives multi-path staged hunks from exact Index bytes and fails closed across live drift", async () => {
    const baselineSource = [
      "export function foo() { return 'old foo'; }",
      "export function bar() { return 'old bar'; }",
    ].join("\n");
    const baselineExtraSource =
      "export function extra() { return 'old extra'; }\n";
    const stagedSource = baselineSource.replace("old foo", "new foo");
    const stagedExtraSource = baselineExtraSource.replace(
      "old extra",
      "new extra",
    );
    const indexDriftSource = baselineSource.replace("old foo", "newer foo");
    const worktreeDriftSource = stagedSource.replace("old bar", "worktree bar");
    const graph = graphFixture();
    graph.nodes = [
      {
        id: "function:foo",
        type: "function",
        name: "foo",
        filePath: "src/task.ts",
        lineRange: [1, 1],
        summary: "Returns foo.",
        tags: [],
        complexity: "simple",
      },
      {
        id: "function:extra",
        type: "function",
        name: "extra",
        filePath: "src/extra.ts",
        lineRange: [1, 1],
        summary: "Returns extra.",
        tags: [],
        complexity: "simple",
      },
    ];
    const { root } = await fixtureRoot(graph, baselineSource);
    await writeFile(
      path.join(root, "src/extra.ts"),
      baselineExtraSource,
      "utf8",
    );
    await git(root, ["init", "--quiet"]);
    await git(root, ["add", "src/extra.ts", "src/task.ts"]);
    await git(root, [
      "-c",
      "user.name=Understand Code Test",
      "-c",
      "user.email=test@understand-code.invalid",
      "commit",
      "--quiet",
      "-m",
      "baseline",
    ]);
    const headCommit = await git(root, ["rev-parse", "HEAD"]);
    const baselineSnapshot = await captureFencedSnapshot(root, headCommit);
    expect(baselineSnapshot.changes).toEqual([]);
    await Promise.all([
      writeFile(path.join(root, "src/task.ts"), stagedSource, "utf8"),
      writeFile(
        path.join(root, "src/extra.ts"),
        stagedExtraSource,
        "utf8",
      ),
    ]);
    await git(root, ["add", "--", "src/extra.ts", "src/task.ts"]);
    const actualSnapshot = await captureFencedSnapshot(root, headCommit);
    expect(actualSnapshot.changes).toHaveLength(2);
    const stagedExtraChange = actualSnapshot.changes.find(
      (change) => change.path === "src/extra.ts",
    );
    const stagedTaskChange = actualSnapshot.changes.find(
      (change) => change.path === "src/task.ts",
    );
    expect(stagedExtraChange).toMatchObject({
      source: "staged",
      kind: "modified",
      contentDigest: digest(stagedExtraSource),
    });
    expect(stagedTaskChange).toMatchObject({
      source: "staged",
      kind: "modified",
      contentDigest: digest(stagedSource),
    });
    const stagedExtraChangeId = stagedExtraChange!.id;
    const stagedTaskChangeId = stagedTaskChange!.id;
    const stagedChangeIds = actualSnapshot.changes
      .map((change) => change.id)
      .sort();
    const provider = await RepositoryTaskContextProvider.open({
      canonicalRoot: root,
    });

    const first = await provider.analyzeTaskChanges({
      taskId: "task:staged-analysis",
      baselineSnapshot,
      actualSnapshot,
    });
    const second = await provider.analyzeTaskChanges({
      taskId: "task:staged-analysis",
      baselineSnapshot,
      actualSnapshot,
    });
    expect(second).toEqual(first);
    expect(first).toMatchObject({ status: "complete", boundaries: [] });
    expect(first.hunks).toEqual([
      expect.objectContaining({
        actualChangeIds: [stagedExtraChangeId],
        filePath: "src/extra.ts",
        newLineRange: [1, 1],
        nodeIds: ["function:extra"],
        contentHash: digest(stagedExtraSource),
      }),
      expect.objectContaining({
        actualChangeIds: [stagedTaskChangeId],
        filePath: "src/task.ts",
        newLineRange: [1, 1],
        nodeIds: ["function:foo"],
        contentHash: digest(stagedSource),
      }),
    ]);

    await writeFile(path.join(root, "src/task.ts"), worktreeDriftSource, "utf8");
    const worktreeDrift = await provider.analyzeTaskChanges({
      taskId: "task:staged-analysis",
      baselineSnapshot,
      actualSnapshot,
    });
    expect(worktreeDrift).toMatchObject({
      status: "unknown",
      hunks: [],
      boundaries: [expect.objectContaining({
        code: "content_changed",
        actualChangeIds: stagedChangeIds,
      })],
    });

    await writeFile(path.join(root, "src/task.ts"), indexDriftSource, "utf8");
    await git(root, ["add", "--", "src/task.ts"]);
    await writeFile(path.join(root, "src/task.ts"), stagedSource, "utf8");
    const indexDrift = await provider.analyzeTaskChanges({
      taskId: "task:staged-analysis",
      baselineSnapshot,
      actualSnapshot,
    });
    expect(indexDrift).toMatchObject({
      status: "unknown",
      hunks: [],
      boundaries: [expect.objectContaining({
        code: "content_changed",
        actualChangeIds: stagedChangeIds,
      })],
    });

    await git(root, ["add", "--", "src/extra.ts", "src/task.ts"]);
    await git(root, [
      "-c",
      "user.name=Understand Code Test",
      "-c",
      "user.email=test@understand-code.invalid",
      "commit",
      "--quiet",
      "-m",
      "advance head",
    ]);
    const headDrift = await provider.analyzeTaskChanges({
      taskId: "task:staged-analysis",
      baselineSnapshot,
      actualSnapshot,
    });
    expect(headDrift).toMatchObject({
      status: "unknown",
      hunks: [],
      boundaries: [expect.objectContaining({
        code: "head_mismatch",
        actualChangeIds: stagedChangeIds,
      })],
    });

    const mixedHeadCommit = await git(root, ["rev-parse", "HEAD"]);
    const mixedBaselineSnapshot = snapshot(
      digest(stagedSource),
      "snapshot:mixed-baseline",
      { headCommit: mixedHeadCommit, changes: [] },
    );
    await writeFile(path.join(root, "src/task.ts"), indexDriftSource, "utf8");
    await git(root, ["add", "--", "src/task.ts"]);
    await writeFile(path.join(root, "src/task.ts"), worktreeDriftSource, "utf8");
    const mixedActualSnapshot = snapshot(
      digest(worktreeDriftSource),
      "snapshot:mixed-actual",
      {
        headCommit: mixedHeadCommit,
        indexDigest: await currentIndexDigest(root),
        changes: [
          {
            id: "change:mixed-staged",
            path: "src/task.ts",
            source: "staged",
            kind: "modified",
            contentDigest: digest(indexDriftSource),
            previousContentDigest: digest(stagedSource),
          },
          {
            id: "change:mixed-unstaged",
            path: "src/task.ts",
            source: "unstaged",
            kind: "modified",
            contentDigest: digest(worktreeDriftSource),
            previousContentDigest: digest(indexDriftSource),
          },
        ],
      },
    );
    const mixed = await provider.analyzeTaskChanges({
      taskId: "task:mixed-analysis",
      baselineSnapshot: mixedBaselineSnapshot,
      actualSnapshot: mixedActualSnapshot,
    });
    expect(mixed).toMatchObject({
      status: "unknown",
      hunks: [],
      boundaries: [expect.objectContaining({
        code: "unsupported_source",
        actualChangeIds: ["change:mixed-staged", "change:mixed-unstaged"],
      })],
    });

    const tooManyChangeIds = Array.from(
      { length: 17 },
      (_, index) => `change:staged-${String(index).padStart(2, "0")}`,
    );
    const tooMany = await provider.analyzeTaskChanges({
      taskId: "task:too-many-staged-analysis",
      baselineSnapshot: mixedBaselineSnapshot,
      actualSnapshot: snapshot(
        digest("unused"),
        "snapshot:too-many-staged",
        {
          headCommit: mixedHeadCommit,
          indexDigest: await currentIndexDigest(root),
          changes: tooManyChangeIds.map((id, index) => ({
            id,
            path: `src/synthetic-${String(index).padStart(2, "0")}.ts`,
            source: "staged" as const,
            kind: "modified" as const,
            contentDigest: digest(`synthetic-${index}`),
            previousContentDigest: digest(`baseline-${index}`),
          })),
        },
      ),
    });
    expect(tooMany).toMatchObject({
      status: "unknown",
      hunks: [],
      boundaries: [expect.objectContaining({
        code: "unsupported_source",
        actualChangeIds: tooManyChangeIds,
      })],
    });
  });

  it("derives an exact baseline-bound staged deletion beside a staged hunk and rejects live authority drift", async () => {
    const baselineTaskSource =
      "export function task() { return 'staged-before'; }\n";
    const actualTaskSource =
      "export function task() { return 'staged-after'; }\n";
    const deletedSource =
      "export function removed() { return 'staged-baseline-only'; }\n";
    const graph = graphFixture();
    graph.nodes = [
      {
        id: "function:task",
        type: "function",
        name: "task",
        filePath: "src/task.ts",
        lineRange: [1, 1],
        summary: "Returns the staged Task value.",
        tags: [],
        complexity: "simple",
      },
      {
        id: "function:removed",
        type: "function",
        name: "removed",
        filePath: "src/removed.ts",
        lineRange: [1, 1],
        summary: "Returns the staged baseline-only value.",
        tags: [],
        complexity: "simple",
      },
      {
        id: "function:added",
        type: "function",
        name: "added",
        filePath: "src/added.ts",
        lineRange: [1, 1],
        summary: "Returns the newly staged value.",
        tags: [],
        complexity: "simple",
      },
    ];
    const { root } = await fixtureRoot(graph, baselineTaskSource);
    const taskPath = path.join(root, "src/task.ts");
    const deletedPath = path.join(root, "src/removed.ts");
    await writeFile(deletedPath, deletedSource, "utf8");
    await git(root, ["init", "--quiet"]);
    await git(root, ["add", "src/task.ts", "src/removed.ts"]);
    await git(root, [
      "-c",
      "user.name=Understand Code Test",
      "-c",
      "user.email=test@understand-code.invalid",
      "commit",
      "--quiet",
      "-m",
      "baseline",
    ]);
    const headCommit = await git(root, ["rev-parse", "HEAD"]);
    const baselineSnapshot = await captureFencedSnapshot(root, headCommit);
    expect(baselineSnapshot.changes).toEqual([]);
    await Promise.all([
      writeFile(taskPath, actualTaskSource, "utf8"),
      rm(deletedPath),
    ]);
    await git(root, ["add", "--", "src/task.ts", "src/removed.ts"]);
    expect(await git(root, ["ls-files", "--stage", "--", "src/removed.ts"]))
      .toBe("");
    await expect(readFile(deletedPath)).rejects.toMatchObject({ code: "ENOENT" });
    const actualSnapshot = await captureFencedSnapshot(root, headCommit);
    expect(actualSnapshot.changes).toHaveLength(2);
    const deletedChange = actualSnapshot.changes.find(
      (change) => change.path === "src/removed.ts",
    );
    const modifiedChange = actualSnapshot.changes.find(
      (change) => change.path === "src/task.ts",
    );
    expect(deletedChange).toEqual({
      id: deletedChange?.id,
      path: "src/removed.ts",
      source: "staged",
      kind: "deleted",
    });
    expect(modifiedChange).toEqual({
      id: modifiedChange?.id,
      path: "src/task.ts",
      source: "staged",
      kind: "modified",
      contentDigest: digest(actualTaskSource),
    });
    const actualChangeIds = actualSnapshot.changes
      .map((change) => change.id)
      .sort();
    const provider = await RepositoryTaskContextProvider.open({
      canonicalRoot: root,
    });
    const input = {
      taskId: "task:staged-deleted-analysis",
      baselineSnapshot,
      actualSnapshot,
    };

    const complete = await provider.analyzeTaskChanges(input);
    expect(await provider.analyzeTaskChanges(input)).toEqual(complete);
    expect(complete).toMatchObject({ status: "complete", boundaries: [] });
    expect(complete.hunks).toEqual([
      expect.objectContaining({
        actualChangeIds: [modifiedChange!.id],
        filePath: "src/task.ts",
        newLineRange: [1, 1],
        nodeIds: ["function:task"],
        contentHash: digest(actualTaskSource),
      }),
    ]);
    expect(complete.deletedFiles ?? []).toEqual([
      expect.objectContaining({
        actualChangeIds: [deletedChange!.id],
        filePath: "src/removed.ts",
        oldLineRange: [1, 1],
        contentHash: digest(deletedSource),
      }),
    ]);

    await writeFile(deletedPath, deletedSource, "utf8");
    expect(await git(root, [
      "ls-files",
      "--others",
      "--exclude-standard",
      "--",
      "src/removed.ts",
    ])).toBe("src/removed.ts");
    const worktreeDrift = await provider.analyzeTaskChanges(input);
    expect(worktreeDrift).toMatchObject({
      status: "unknown",
      hunks: [],
      deletedFiles: [],
      boundaries: [expect.objectContaining({
        code: "content_changed",
        actualChangeIds,
      })],
    });
    const replacementSnapshot = await captureFencedSnapshot(root, headCommit);
    expect(replacementSnapshot.changes).toHaveLength(3);
    const replacementDeletedChange = replacementSnapshot.changes.find(
      (change) =>
        change.path === "src/removed.ts" && change.source === "staged",
    );
    const replacementAddedChange = replacementSnapshot.changes.find(
      (change) =>
        change.path === "src/removed.ts" && change.source === "untracked",
    );
    const replacementModifiedChange = replacementSnapshot.changes.find(
      (change) => change.path === "src/task.ts",
    );
    expect(replacementDeletedChange).toEqual({
      id: replacementDeletedChange?.id,
      path: "src/removed.ts",
      source: "staged",
      kind: "deleted",
    });
    expect(replacementAddedChange).toEqual({
      id: replacementAddedChange?.id,
      path: "src/removed.ts",
      source: "untracked",
      kind: "added",
      contentDigest: digest(deletedSource),
    });
    expect(replacementModifiedChange).toEqual({
      id: replacementModifiedChange?.id,
      path: "src/task.ts",
      source: "staged",
      kind: "modified",
      contentDigest: digest(actualTaskSource),
    });
    const replacementChangeIds = replacementSnapshot.changes
      .map((change) => change.id)
      .sort();
    const replacement = await provider.analyzeTaskChanges({
      taskId: "task:staged-deleted-replacement-analysis",
      baselineSnapshot,
      actualSnapshot: replacementSnapshot,
    });
    expect(replacement).toMatchObject({
      status: "unknown",
      hunks: [],
      deletedFiles: [],
    });
    expect(replacement.boundaries).toEqual([
      expect.objectContaining({
        code: "unsupported_source",
        actualChangeIds: replacementChangeIds,
      }),
    ]);

    await rm(deletedPath);
    await git(root, ["restore", "--staged", "--", "src/removed.ts"]);
    const indexDrift = await provider.analyzeTaskChanges(input);
    expect(indexDrift).toMatchObject({
      status: "unknown",
      hunks: [],
      deletedFiles: [],
      boundaries: [expect.objectContaining({
        code: "content_changed",
        actualChangeIds,
      })],
    });

    await git(root, ["add", "--", "src/removed.ts"]);
    const unrelatedLiveDriftPath = path.join(
      root,
      "src/unrelated-live-drift.ts",
    );
    await writeFile(
      unrelatedLiveDriftPath,
      "export const unrelatedLiveDrift = true;\n",
      "utf8",
    );
    const liveDrift = await provider.analyzeTaskChanges(input);
    expect(liveDrift).toMatchObject({
      status: "unknown",
      hunks: [],
      deletedFiles: [],
      boundaries: [expect.objectContaining({
        code: "content_changed",
        actualChangeIds,
      })],
    });
    await rm(unrelatedLiveDriftPath);

    const unsupportedSnapshot = RepositorySnapshotV1Schema.parse({
      ...actualSnapshot,
      changes: [
        ...actualSnapshot.changes,
        {
          id: "change:unsupported-live-modification",
          path: "src/unsupported.ts",
          source: "unstaged",
          kind: "modified",
          contentDigest: digest("unsupported"),
        },
      ],
    });
    const unsupportedChangeIds = unsupportedSnapshot.changes
      .map((change) => change.id)
      .sort();
    const unsupported = await provider.analyzeTaskChanges({
      taskId: input.taskId,
      baselineSnapshot,
      actualSnapshot: unsupportedSnapshot,
    });
    expect(unsupported).toMatchObject({
      status: "unknown",
      hunks: [],
      deletedFiles: [],
      boundaries: [expect.objectContaining({
        code: "unsupported_source",
        actualChangeIds: unsupportedChangeIds,
      })],
    });

    const addedSource =
      "export function added() { return 'staged-with-deletion'; }\n";
    await writeFile(path.join(root, "src/added.ts"), addedSource, "utf8");
    await git(root, ["add", "--", "src/added.ts"]);
    const addedDeletionSnapshot = await captureFencedSnapshot(root, headCommit);
    expect(addedDeletionSnapshot.changes).toHaveLength(3);
    const addedChange = addedDeletionSnapshot.changes.find(
      (change) => change.path === "src/added.ts",
    );
    const addedModifiedChange = addedDeletionSnapshot.changes.find(
      (change) => change.path === "src/task.ts",
    );
    const addedDeletedChange = addedDeletionSnapshot.changes.find(
      (change) => change.path === "src/removed.ts",
    );
    expect(addedChange).toEqual({
      id: addedChange?.id,
      path: "src/added.ts",
      source: "staged",
      kind: "added",
      contentDigest: digest(addedSource),
    });
    expect(addedModifiedChange).toEqual({
      id: addedModifiedChange?.id,
      path: "src/task.ts",
      source: "staged",
      kind: "modified",
      contentDigest: digest(actualTaskSource),
    });
    expect(addedDeletedChange).toEqual({
      id: addedDeletedChange?.id,
      path: "src/removed.ts",
      source: "staged",
      kind: "deleted",
    });
    const addedDeletionChangeIds = addedDeletionSnapshot.changes
      .map((change) => change.id)
      .sort();
    const addedDeletion = await provider.analyzeTaskChanges({
      taskId: "task:staged-added-deleted-analysis",
      baselineSnapshot,
      actualSnapshot: addedDeletionSnapshot,
    });
    expect(await provider.analyzeTaskChanges({
      taskId: "task:staged-added-deleted-analysis",
      baselineSnapshot,
      actualSnapshot: addedDeletionSnapshot,
    })).toEqual(addedDeletion);
    expect(addedDeletion).toMatchObject({ status: "complete", boundaries: [] });
    expect(addedDeletion.hunks).toEqual([
      expect.objectContaining({
        actualChangeIds: [addedChange!.id],
        filePath: "src/added.ts",
        newLineRange: [1, 1],
        nodeIds: ["function:added"],
        contentHash: digest(addedSource),
      }),
      expect.objectContaining({
        actualChangeIds: [addedModifiedChange!.id],
        filePath: "src/task.ts",
        newLineRange: [1, 1],
        nodeIds: ["function:task"],
        contentHash: digest(actualTaskSource),
      }),
    ]);
    expect(addedDeletion.deletedFiles ?? []).toEqual([
      expect.objectContaining({
        actualChangeIds: [addedDeletedChange!.id],
        filePath: "src/removed.ts",
        oldLineRange: [1, 1],
        contentHash: digest(deletedSource),
      }),
    ]);

    await writeFile(
      path.join(root, "src/added.ts"),
      `${addedSource}// deterministic worktree drift\n`,
      "utf8",
    );
    const addedDeletionDrift = await provider.analyzeTaskChanges({
      taskId: "task:staged-added-deleted-analysis",
      baselineSnapshot,
      actualSnapshot: addedDeletionSnapshot,
    });
    expect(addedDeletionDrift).toMatchObject({
      status: "unknown",
      hunks: [],
      deletedFiles: [],
      boundaries: [expect.objectContaining({
        code: "content_changed",
        actualChangeIds: addedDeletionChangeIds,
      })],
    });
  });

  it("derives an exact staged-added hunk only when the baseline path is absent and live bytes remain unchanged", async () => {
    const baselineSource = "export function task() { return true; }\n";
    const addedSource = "export function added() { return 'added'; }\n";
    const graph = graphFixture();
    graph.nodes = [
      {
        id: "function:added",
        type: "function",
        name: "added",
        filePath: "src/added.ts",
        lineRange: [1, 1],
        summary: "Returns the added value.",
        tags: [],
        complexity: "simple",
      },
    ];
    const { root } = await fixtureRoot(graph, baselineSource);
    await git(root, ["init", "--quiet"]);
    await git(root, ["add", "src/task.ts"]);
    await git(root, [
      "-c",
      "user.name=Understand Code Test",
      "-c",
      "user.email=test@understand-code.invalid",
      "commit",
      "--quiet",
      "-m",
      "baseline",
    ]);
    const headCommit = await git(root, ["rev-parse", "HEAD"]);
    const baselineSnapshot = await captureFencedSnapshot(root, headCommit);
    expect(baselineSnapshot.changes).toEqual([]);
    await writeFile(path.join(root, "src/added.ts"), addedSource, "utf8");
    await git(root, ["add", "--", "src/added.ts"]);
    const actualSnapshot = await captureFencedSnapshot(root, headCommit);
    expect(actualSnapshot.changes).toHaveLength(1);
    const stagedAddedChange = actualSnapshot.changes[0]!;
    expect(stagedAddedChange).toMatchObject({
      path: "src/added.ts",
      source: "staged",
      kind: "added",
      contentDigest: digest(addedSource),
    });
    const stagedAddedChangeId = stagedAddedChange.id;
    const provider = await RepositoryTaskContextProvider.open({
      canonicalRoot: root,
    });

    const complete = await provider.analyzeTaskChanges({
      taskId: "task:staged-add",
      baselineSnapshot,
      actualSnapshot,
    });
    expect(complete).toMatchObject({ status: "complete", boundaries: [] });
    expect(complete.hunks).toEqual([
      expect.objectContaining({
        actualChangeIds: [stagedAddedChangeId],
        filePath: "src/added.ts",
        newLineRange: [1, 1],
        nodeIds: ["function:added"],
        contentHash: digest(addedSource),
      }),
    ]);

    await writeFile(
      path.join(root, "src/added.ts"),
      `${addedSource}// worktree drift\n`,
      "utf8",
    );
    const drifted = await provider.analyzeTaskChanges({
      taskId: "task:staged-add",
      baselineSnapshot,
      actualSnapshot,
    });
    expect(drifted).toMatchObject({
      status: "unknown",
      hunks: [],
      boundaries: [expect.objectContaining({
        code: "content_changed",
        actualChangeIds: [stagedAddedChangeId],
      })],
    });

    await writeFile(path.join(root, "src/added.ts"), addedSource, "utf8");
    await git(root, ["reset", "--quiet", "HEAD", "--", "src/added.ts"]);
    await rm(path.join(root, "src/added.ts"));
    const misclassifiedSource = baselineSource.replace("true", "false");
    await writeFile(path.join(root, "src/task.ts"), misclassifiedSource, "utf8");
    await git(root, ["add", "--", "src/task.ts"]);
    const realModifiedSnapshot = await captureFencedSnapshot(root, headCommit);
    expect(realModifiedSnapshot.changes).toHaveLength(1);
    const realModifiedChange = realModifiedSnapshot.changes[0]!;
    expect(realModifiedChange).toMatchObject({
      path: "src/task.ts",
      source: "staged",
      kind: "modified",
      contentDigest: digest(misclassifiedSource),
    });
    const misclassifiedSnapshot = RepositorySnapshotV1Schema.parse({
      ...realModifiedSnapshot,
      changes: [
        {
          ...realModifiedChange,
          id: "change:misclassified-add",
          kind: "added",
        },
      ],
    });
    const baselineExists = await provider.analyzeTaskChanges({
      taskId: "task:staged-add",
      baselineSnapshot,
      actualSnapshot: misclassifiedSnapshot,
    });
    expect(baselineExists).toMatchObject({
      status: "unknown",
      hunks: [],
      boundaries: [expect.objectContaining({
        code: "unsupported_source",
        actualChangeIds: ["change:misclassified-add"],
      })],
    });
  });

  it("derives path-sorted unstaged and untracked hunks only while the live repository state matches the Snapshot", async () => {
    const baselineFooSource =
      "export function foo() { return 'foo-before'; }\n";
    const actualFooSource =
      "export function foo() { return 'foo-after'; }\n";
    const untrackedSource =
      "export function newlyAdded() { return 'new-file'; }\n";
    const graph = graphFixture();
    graph.nodes = [
      {
        id: "function:foo",
        type: "function",
        name: "foo",
        filePath: "src/task.ts",
        lineRange: [1, 1],
        summary: "Returns the changed foo value.",
        tags: [],
        complexity: "simple",
      },
      {
        id: "function:newly-added",
        type: "function",
        name: "newlyAdded",
        filePath: "src/new.ts",
        lineRange: [1, 1],
        summary: "Returns the new file value.",
        tags: [],
        complexity: "simple",
      },
    ];
    const { root } = await fixtureRoot(graph, baselineFooSource);
    await git(root, ["init", "--quiet"]);
    await git(root, ["add", "src/task.ts"]);
    await git(root, [
      "-c",
      "user.name=Understand Code Test",
      "-c",
      "user.email=test@understand-code.invalid",
      "commit",
      "--quiet",
      "-m",
      "baseline",
    ]);
    const headCommit = await git(root, ["rev-parse", "HEAD"]);
    const baselineSnapshot = await captureFencedSnapshot(root, headCommit);
    expect(baselineSnapshot.changes).toEqual([]);
    await Promise.all([
      writeFile(path.join(root, "src/task.ts"), actualFooSource, "utf8"),
      writeFile(path.join(root, "src/new.ts"), untrackedSource, "utf8"),
    ]);
    const actualSnapshot = await captureFencedSnapshot(root, headCommit);
    expect(actualSnapshot.changes).toHaveLength(2);
    const untrackedNewChange = actualSnapshot.changes.find(
      (change) => change.path === "src/new.ts",
    );
    const unstagedFooChange = actualSnapshot.changes.find(
      (change) => change.path === "src/task.ts",
    );
    expect(untrackedNewChange).toMatchObject({
      source: "untracked",
      kind: "added",
      contentDigest: digest(untrackedSource),
    });
    expect(unstagedFooChange).toMatchObject({
      source: "unstaged",
      kind: "modified",
      contentDigest: digest(actualFooSource),
    });
    const untrackedNewChangeId = untrackedNewChange!.id;
    const unstagedFooChangeId = unstagedFooChange!.id;
    const actualChangeIds = actualSnapshot.changes
      .map((change) => change.id)
      .sort();
    const provider = await RepositoryTaskContextProvider.open({
      canonicalRoot: root,
    });

    const complete = await provider.analyzeTaskChanges({
      taskId: "task:untracked-analysis",
      baselineSnapshot,
      actualSnapshot,
    });
    expect(complete).toMatchObject({ status: "complete", boundaries: [] });
    expect(complete.hunks).toEqual([
      expect.objectContaining({
        actualChangeIds: [untrackedNewChangeId],
        filePath: "src/new.ts",
        newLineRange: [1, 1],
        nodeIds: ["function:newly-added"],
        contentHash: digest(untrackedSource),
      }),
      expect.objectContaining({
        actualChangeIds: [unstagedFooChangeId],
        filePath: "src/task.ts",
        newLineRange: [1, 1],
        nodeIds: ["function:foo"],
        contentHash: digest(actualFooSource),
      }),
    ]);

    await git(root, ["add", "--", "src/new.ts"]);
    const liveIndexDrift = await provider.analyzeTaskChanges({
      taskId: "task:untracked-analysis",
      baselineSnapshot,
      actualSnapshot,
    });
    expect(liveIndexDrift).toMatchObject({
      status: "unknown",
      hunks: [],
      boundaries: [expect.objectContaining({
        code: "content_changed",
        actualChangeIds,
      })],
    });
  });

  it("derives path-sorted unstaged, intent-to-add, and untracked hunks and rejects a reset intent", async () => {
    const baselineFooSource =
      "export function foo() { return 'foo-before'; }\n";
    const actualFooSource =
      "export function foo() { return 'foo-after'; }\n";
    const untrackedSource =
      "export function newlyAdded() { return 'new-file'; }\n";
    const intentToAddSource =
      "export function intentToAdd() { return 'intent-ready'; }\n";
    const graph = graphFixture();
    graph.nodes = [
      {
        id: "function:foo",
        type: "function",
        name: "foo",
        filePath: "src/task.ts",
        lineRange: [1, 1],
        summary: "Returns the changed foo value.",
        tags: [],
        complexity: "simple",
      },
      {
        id: "function:intent-to-add",
        type: "function",
        name: "intentToAdd",
        filePath: "src/intent.ts",
        lineRange: [1, 1],
        summary: "Returns the intent-to-add value.",
        tags: [],
        complexity: "simple",
      },
      {
        id: "function:newly-added",
        type: "function",
        name: "newlyAdded",
        filePath: "src/new.ts",
        lineRange: [1, 1],
        summary: "Returns the new file value.",
        tags: [],
        complexity: "simple",
      },
    ];
    const { root } = await fixtureRoot(graph, baselineFooSource);
    await git(root, ["init", "--quiet"]);
    await git(root, ["add", "src/task.ts"]);
    await git(root, [
      "-c",
      "user.name=Understand Code Test",
      "-c",
      "user.email=test@understand-code.invalid",
      "commit",
      "--quiet",
      "-m",
      "baseline",
    ]);
    const headCommit = await git(root, ["rev-parse", "HEAD"]);
    const baselineSnapshot = await captureFencedSnapshot(root, headCommit);
    expect(baselineSnapshot.changes).toEqual([]);
    await Promise.all([
      writeFile(path.join(root, "src/task.ts"), actualFooSource, "utf8"),
      writeFile(path.join(root, "src/intent.ts"), intentToAddSource, "utf8"),
      writeFile(path.join(root, "src/new.ts"), untrackedSource, "utf8"),
    ]);
    await git(root, ["add", "-N", "--", "src/intent.ts"]);
    expect(
      await git(root, [
        "diff",
        "--cached",
        "--name-only",
        "--",
        "src/intent.ts",
      ]),
    ).toBe("");
    const actualSnapshot = await captureFencedSnapshot(root, headCommit);
    expect(actualSnapshot.changes).toHaveLength(3);
    const intentToAddChange = actualSnapshot.changes.find(
      (change) => change.path === "src/intent.ts",
    );
    const untrackedNewChange = actualSnapshot.changes.find(
      (change) => change.path === "src/new.ts",
    );
    const unstagedFooChange = actualSnapshot.changes.find(
      (change) => change.path === "src/task.ts",
    );
    expect(untrackedNewChange).toMatchObject({
      source: "untracked",
      kind: "added",
      contentDigest: digest(untrackedSource),
    });
    expect(intentToAddChange).toMatchObject({
      source: "unstaged",
      kind: "added",
      contentDigest: digest(intentToAddSource),
    });
    expect(
      actualSnapshot.changes.filter((change) => change.path === "src/intent.ts"),
    ).toHaveLength(1);
    expect(
      actualSnapshot.changes.some(
        (change) => change.path === "src/intent.ts" && change.source === "staged",
      ),
    ).toBe(false);
    expect(unstagedFooChange).toMatchObject({
      source: "unstaged",
      kind: "modified",
      contentDigest: digest(actualFooSource),
    });
    const untrackedNewChangeId = untrackedNewChange!.id;
    const intentToAddChangeId = intentToAddChange!.id;
    const unstagedFooChangeId = unstagedFooChange!.id;
    const actualChangeIds = actualSnapshot.changes
      .map((change) => change.id)
      .sort();
    const provider = await RepositoryTaskContextProvider.open({
      canonicalRoot: root,
    });

    const complete = await provider.analyzeTaskChanges({
      taskId: "task:untracked-analysis",
      baselineSnapshot,
      actualSnapshot,
    });
    expect(complete).toMatchObject({ status: "complete", boundaries: [] });
    expect(complete.hunks).toEqual([
      expect.objectContaining({
        actualChangeIds: [intentToAddChangeId],
        filePath: "src/intent.ts",
        newLineRange: [1, 1],
        nodeIds: ["function:intent-to-add"],
        contentHash: digest(intentToAddSource),
      }),
      expect.objectContaining({
        actualChangeIds: [untrackedNewChangeId],
        filePath: "src/new.ts",
        newLineRange: [1, 1],
        nodeIds: ["function:newly-added"],
        contentHash: digest(untrackedSource),
      }),
      expect.objectContaining({
        actualChangeIds: [unstagedFooChangeId],
        filePath: "src/task.ts",
        newLineRange: [1, 1],
        nodeIds: ["function:foo"],
        contentHash: digest(actualFooSource),
      }),
    ]);

    await git(root, ["reset", "--quiet", "--", "src/intent.ts"]);
    const liveIndexDrift = await provider.analyzeTaskChanges({
      taskId: "task:untracked-analysis",
      baselineSnapshot,
      actualSnapshot,
    });
    expect(liveIndexDrift).toMatchObject({
      status: "unknown",
      hunks: [],
      boundaries: [expect.objectContaining({
        code: "content_changed",
        actualChangeIds,
      })],
    });
  });

  it("derives an exact baseline-bound deletion observation beside an unstaged hunk and rejects live drift", async () => {
    const baselineTaskSource =
      "export function task() { return 'task-before'; }\n";
    const actualTaskSource =
      "export function task() { return 'task-after'; }\n";
    const deletedSource =
      "export function removed() { return 'baseline-only'; }\n";
    const graph = graphFixture();
    graph.nodes = [
      {
        id: "function:task",
        type: "function",
        name: "task",
        filePath: "src/task.ts",
        lineRange: [1, 1],
        summary: "Returns the changed Task value.",
        tags: [],
        complexity: "simple",
      },
      {
        id: "function:removed",
        type: "function",
        name: "removed",
        filePath: "src/removed.ts",
        lineRange: [1, 1],
        summary: "Returns the baseline-only value.",
        tags: [],
        complexity: "simple",
      },
    ];
    const { root } = await fixtureRoot(graph, baselineTaskSource);
    const deletedPath = path.join(root, "src/removed.ts");
    await writeFile(deletedPath, deletedSource, "utf8");
    await git(root, ["init", "--quiet"]);
    await git(root, ["add", "src/task.ts", "src/removed.ts"]);
    await git(root, [
      "-c",
      "user.name=Understand Code Test",
      "-c",
      "user.email=test@understand-code.invalid",
      "commit",
      "--quiet",
      "-m",
      "baseline",
    ]);
    const headCommit = await git(root, ["rev-parse", "HEAD"]);
    const baselineSnapshot = await captureFencedSnapshot(root, headCommit);
    expect(baselineSnapshot.changes).toEqual([]);
    await Promise.all([
      writeFile(path.join(root, "src/task.ts"), actualTaskSource, "utf8"),
      rm(deletedPath),
    ]);
    const actualSnapshot = await captureFencedSnapshot(root, headCommit);
    expect(actualSnapshot.changes).toHaveLength(2);
    const deletedChange = actualSnapshot.changes.find(
      (change) => change.path === "src/removed.ts",
    );
    const modifiedChange = actualSnapshot.changes.find(
      (change) => change.path === "src/task.ts",
    );
    expect(deletedChange).toEqual({
      id: deletedChange?.id,
      path: "src/removed.ts",
      source: "unstaged",
      kind: "deleted",
    });
    expect(modifiedChange).toEqual({
      id: modifiedChange?.id,
      path: "src/task.ts",
      source: "unstaged",
      kind: "modified",
      contentDigest: digest(actualTaskSource),
    });
    const actualChangeIds = actualSnapshot.changes
      .map((change) => change.id)
      .sort();
    const provider = await RepositoryTaskContextProvider.open({
      canonicalRoot: root,
    });

    const complete = await provider.analyzeTaskChanges({
      taskId: "task:deleted-analysis",
      baselineSnapshot,
      actualSnapshot,
    });
    expect(complete).toMatchObject({ status: "complete", boundaries: [] });
    expect(complete.hunks).toEqual([
      expect.objectContaining({
        actualChangeIds: [modifiedChange!.id],
        filePath: "src/task.ts",
        newLineRange: [1, 1],
        nodeIds: ["function:task"],
        contentHash: digest(actualTaskSource),
      }),
    ]);
    const deletedFiles = complete.deletedFiles ?? [];
    expect(deletedFiles).toHaveLength(1);
    const deletedFile = deletedFiles[0]!;
    expect(deletedFile).toEqual({
      id: deletedFile.id,
      actualChangeIds: [deletedChange!.id],
      filePath: "src/removed.ts",
      oldLineRange: [1, 1],
      contentHash: digest(deletedSource),
    });

    const mixedUnsupportedSnapshot = RepositorySnapshotV1Schema.parse({
      ...actualSnapshot,
      changes: [
        modifiedChange!,
        {
          id: "change:committed-deletion",
          path: "src/committed.ts",
          source: "committed",
          kind: "deleted",
        },
        {
          id: "change:conflict-deletion",
          path: "src/conflict.ts",
          source: "conflict",
          kind: "deleted",
        },
      ],
    });
    const mixedUnsupportedChangeIds = mixedUnsupportedSnapshot.changes
      .map((change) => change.id)
      .sort();
    const mixedUnsupported = await provider.analyzeTaskChanges({
      taskId: "task:deleted-analysis",
      baselineSnapshot,
      actualSnapshot: mixedUnsupportedSnapshot,
    });
    expect(mixedUnsupported).toMatchObject({
      status: "unknown",
      hunks: [],
      deletedFiles: [],
      boundaries: [expect.objectContaining({
        code: "unsupported_source",
        actualChangeIds: mixedUnsupportedChangeIds,
      })],
    });

    const mismatchedBaselineIndex = RepositorySnapshotV1Schema.parse({
      ...baselineSnapshot,
      indexDigest: digest("mismatched-baseline-index"),
    });
    const baselineIndexMismatch = await provider.analyzeTaskChanges({
      taskId: "task:deleted-analysis",
      baselineSnapshot: mismatchedBaselineIndex,
      actualSnapshot,
    });
    expect(baselineIndexMismatch).toMatchObject({
      status: "unknown",
      hunks: [],
      deletedFiles: [],
      boundaries: [expect.objectContaining({
        code: "content_changed",
        actualChangeIds,
      })],
    });

    await writeFile(deletedPath, deletedSource, "utf8");
    const drifted = await provider.analyzeTaskChanges({
      taskId: "task:deleted-analysis",
      baselineSnapshot,
      actualSnapshot,
    });
    expect(drifted).toMatchObject({
      status: "unknown",
      hunks: [],
      deletedFiles: [],
      boundaries: [expect.objectContaining({
        code: "content_changed",
        actualChangeIds,
      })],
    });
  });

  it("loads a validated real Graph, adapts Wiki, and emits only digest-bound Source Evidence", async () => {
    const { root, source } = await fixtureRoot();
    const repositorySnapshot = snapshot(digest(source));
    const provider = await RepositoryTaskContextProvider.open({
      canonicalRoot: root,
    });

    const first = await provider.loadTaskContext({
      intent: "Update task",
      sourceSnapshotId: repositorySnapshot.snapshotId,
      repositorySnapshot,
    });
    const second = await provider.loadTaskContext({
      intent: "Update task",
      sourceSnapshotId: repositorySnapshot.snapshotId,
      repositorySnapshot,
    });

    expect(second).toEqual(first);
    expect(first.graph.project.name).toBe("provider-fixture");
    expect(first.existingFilePaths).toEqual(["src/task.ts"]);
    expect(first.wiki).toMatchObject({
      valid: true,
      freshness: "fresh",
      records: [
        {
          id: "page:page%3Aoverview",
          title: "项目总览",
        },
      ],
    });
    expect(first.sourceEvidence).toEqual([
      {
        nodeId: "function:task",
        filePath: "src/task.ts",
        lineRange: [1, 1],
        contentHash: digest(source),
        kind: "source",
      },
    ]);
    expect(first.repositorySnapshot).toEqual(repositorySnapshot);

    await writeFile(
      path.join(root, "src/task.ts"),
      `${source}// changed after Snapshot\n`,
      "utf8",
    );
    const changed = await provider.loadTaskContext({
      intent: "Update task",
      sourceSnapshotId: repositorySnapshot.snapshotId,
      repositorySnapshot,
    });
    expect(changed.existingFilePaths).toEqual(["src/task.ts"]);
    expect(changed.sourceEvidence).toBeUndefined();
  });

  it("keeps valid Graph context while marking malformed optional Wiki invalid", async () => {
    const { root, source } = await fixtureRoot();
    await writeFile(
      path.join(
        root,
        ".understand-code/knowledge-base/search-index.json",
      ),
      "{not-json",
      "utf8",
    );
    const repositorySnapshot = snapshot(digest(source));
    const provider = await RepositoryTaskContextProvider.open({
      canonicalRoot: root,
    });

    const context = await provider.loadTaskContext({
      intent: "Update task",
      sourceSnapshotId: repositorySnapshot.snapshotId,
      repositorySnapshot,
    });

    expect(context.wiki).toEqual({
      freshness: "error",
      valid: false,
      records: [],
    });
    expect(context.existingFilePaths).toEqual(["src/task.ts"]);
  });

  it("omits observed symbol Evidence when a stale Graph line anchor no longer locates the symbol", async () => {
    for (const staleLineRange of [
      [2, 2],
      [100, 101],
    ] as const) {
      const graph = graphFixture();
      graph.nodes[0]!.lineRange = [...staleLineRange];
      const { root, source } = await fixtureRoot(graph);
      const repositorySnapshot = snapshot(digest(source));
      const provider = await RepositoryTaskContextProvider.open({
        canonicalRoot: root,
      });

      const context = await provider.loadTaskContext({
        intent: "Update task",
        sourceSnapshotId: repositorySnapshot.snapshotId,
        repositorySnapshot,
      });

      expect(context.existingFilePaths).toEqual(["src/task.ts"]);
      expect(context.sourceEvidence).toBeUndefined();
    }
  });

  it("does not upgrade comment, substring, or duplicate-declaration collisions to observed Evidence", async () => {
    const cases = [
      {
        name: "identifier substring",
        source: "export const multitask = true;\n",
        lineRange: [1, 1] as [number, number],
      },
      {
        name: "comment text",
        source: "// export function task() { return true; }\n",
        lineRange: [1, 1] as [number, number],
      },
      {
        name: "string text",
        source: "export const message = \"call task later\";\n",
        lineRange: [1, 1] as [number, number],
      },
      {
        name: "regular-expression declaration text",
        source: "export const marker = /function task() {/;\n",
        lineRange: [1, 1] as [number, number],
      },
      {
        name: "duplicate declaration",
        source: [
          "export function task() { return true; }",
          "export function task() { return false; }",
          "",
        ].join("\n"),
        lineRange: [2, 2] as [number, number],
      },
      {
        name: "call-site collision",
        source: [
          "export function task() { return true; }",
          "task();",
          "",
        ].join("\n"),
        lineRange: [2, 2] as [number, number],
      },
    ];
    for (const fixture of cases) {
      const graph = graphFixture();
      graph.nodes[0]!.lineRange = fixture.lineRange;
      const { root, source } = await fixtureRoot(graph, fixture.source);
      const repositorySnapshot = snapshot(digest(source));
      const provider = await RepositoryTaskContextProvider.open({
        canonicalRoot: root,
      });

      const context = await provider.loadTaskContext({
        intent: `Reject ${fixture.name}`,
        sourceSnapshotId: repositorySnapshot.snapshotId,
        repositorySnapshot,
      });

      expect(context.sourceEvidence, fixture.name).toBeUndefined();
    }
  });

  it("rejects traversal and absolute Graph paths before filesystem access", async () => {
    for (const unsafePath of [
      "../outside.ts",
      "/private/outside.ts",
      "src/../../outside.ts",
    ]) {
      const { root, source } = await fixtureRoot(
        graphFixture(unsafePath),
      );
      const repositorySnapshot = snapshot(digest(source));
      const provider = await RepositoryTaskContextProvider.open({
        canonicalRoot: root,
      });

      await expect(
        provider.loadTaskContext({
          intent: "Update task",
          sourceSnapshotId: repositorySnapshot.snapshotId,
          repositorySnapshot,
        }),
      ).rejects.toMatchObject({
        code: "unsafe_repository_path",
      });
    }
  });

  it("rejects a Graph file path that escapes through a symlink", async () => {
    const { root, source } = await fixtureRoot(
      graphFixture("src/linked.ts"),
    );
    const outside = await mkdtemp(
      path.join(tmpdir(), "repository-context-outside-"),
    );
    roots.push(outside);
    await writeFile(
      path.join(outside, "secret.ts"),
      "export const secret = true;\n",
      "utf8",
    );
    await symlink(
      path.join(outside, "secret.ts"),
      path.join(root, "src/linked.ts"),
    );
    const repositorySnapshot = snapshot(digest(source));
    const provider = await RepositoryTaskContextProvider.open({
      canonicalRoot: root,
    });

    await expect(
      provider.loadTaskContext({
        intent: "Update task",
        sourceSnapshotId: repositorySnapshot.snapshotId,
        repositorySnapshot,
      }),
    ).rejects.toMatchObject({
      code: "unsafe_repository_path",
    });
  });

  it("requires an explicit absolute root and exact Snapshot identity without leaking the root", async () => {
    await expect(
      RepositoryTaskContextProvider.open({
        canonicalRoot: "relative/repository",
      }),
    ).rejects.toMatchObject({
      code: "invalid_root",
    });

    const { root, source } = await fixtureRoot();
    const repositorySnapshot = snapshot(digest(source));
    const provider = await RepositoryTaskContextProvider.open({
      canonicalRoot: root,
    });
    let error: unknown;
    try {
      await provider.loadTaskContext({
        intent: "Update task",
        sourceSnapshotId: "snapshot:other",
        repositorySnapshot,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(
      RepositoryTaskContextProviderError,
    );
    expect(error).toMatchObject({ code: "snapshot_mismatch" });
    expect(String(error)).not.toContain(root);
  });
});
