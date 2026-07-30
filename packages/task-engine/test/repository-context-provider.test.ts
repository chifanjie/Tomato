import { createHash } from "node:crypto";
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
): RepositorySnapshotV1 {
  return RepositorySnapshotV1Schema.parse({
    schemaVersion: 1,
    snapshotId,
    repositoryId: "repository:provider-fixture",
    worktreeId: "worktree:provider-fixture",
    rootIdentity: "root:provider-fixture",
    headCommit: HEAD_COMMIT,
    indexDigest: digest("index"),
    worktreeDigest: digest("worktree"),
    untrackedDigest: digest("untracked"),
    ignoreDigest: digest("ignore"),
    createdAt: "2026-07-29T00:00:00.000Z",
    captureStatus: "complete",
    limitations: [],
    changes: [
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
