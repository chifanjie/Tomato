import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ArtifactManifestV1Schema,
} from "@understand-code/contracts";
import {
  evaluateArtifactFreshnessDag,
  inspectArtifactFreshness,
} from "../src/freshness.js";
import { getRepositorySnapshot } from "../src/snapshot.js";
import {
  cleanupTemporaryDirectories,
  initializeRepository,
} from "./helpers.js";

afterEach(cleanupTemporaryDirectories);

const fixturesRoot = new URL(
  "../../contracts/fixtures/v1/",
  import.meta.url,
);

function fixture<T>(path: string): T {
  return JSON.parse(
    readFileSync(new URL(path, fixturesRoot), "utf8"),
  ) as T;
}

function writeJson(root: string, path: string, value: unknown): void {
  const absolute = join(root, ...path.split("/"));
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeFreshLegacySet(root: string) {
  const snapshot = await getRepositorySnapshot(root);
  const head = snapshot.headCommit!;
  const graph = fixture<Record<string, any>>("legacy/graph-v1.json");
  graph.project.gitCommitHash = head;
  const graphDigest = createHash("sha256")
    .update(JSON.stringify(graph))
    .digest("hex");
  const meta = fixture<Record<string, any>>("legacy/meta-v1.json");
  meta.gitCommitHash = head;
  const fingerprints = fixture<Record<string, any>>(
    "legacy/fingerprints-v1.json",
  );
  fingerprints.gitCommitHash = head;
  const wiki = fixture<Record<string, any>>("legacy/wiki-index-v2.json");
  wiki.source.gitCommitHash = head;
  wiki.source.graphDigest = graphDigest;
  const search = fixture<Record<string, any>>("legacy/wiki-search-v2.json");
  const traces = fixture<Record<string, any>>(
    "legacy/wiki-document-traces-v2.json",
  );
  const report = fixture<Record<string, any>>(
    "legacy/wiki-generation-report-v2.json",
  );
  report.source.gitCommitHash = head;
  report.source.graphDigest = graphDigest;
  const diff = fixture<Record<string, any>>("legacy/diff-overlay-v1.json");
  diff.baseCommit = snapshot.baseCommit;
  diff.targetCommit = head;

  writeJson(root, ".understand-code/knowledge-graph.json", graph);
  writeJson(root, ".understand-code/meta.json", meta);
  writeJson(root, ".understand-code/fingerprints.json", fingerprints);
  writeJson(root, ".understand-code/knowledge-base/wiki-index.json", wiki);
  writeJson(root, ".understand-code/knowledge-base/search-index.json", search);
  writeJson(
    root,
    ".understand-code/knowledge-base/.trace/document-traces.json",
    traces,
  );
  writeJson(
    root,
    ".understand-code/knowledge-base/.trace/generation-report.json",
    report,
  );
  writeJson(root, ".understand-code/diff-overlay.json", diff);
  return { snapshot, graph, wiki, report };
}

describe("artifact freshness DAG", () => {
  it("propagates partial, stale, error, dangling and cycle states", () => {
    const evaluation = evaluateArtifactFreshnessDag(
      [
        { id: "partial", intrinsicStatus: "partial" },
        {
          id: "derived",
          intrinsicStatus: "fresh",
          dependencies: ["partial"],
        },
        {
          id: "dangling",
          intrinsicStatus: "fresh",
          dependencies: ["missing-node"],
        },
        {
          id: "cycle-a",
          intrinsicStatus: "fresh",
          dependencies: ["cycle-b"],
        },
        {
          id: "cycle-b",
          intrinsicStatus: "fresh",
          dependencies: ["cycle-a"],
        },
        { id: "duplicate", intrinsicStatus: "fresh" },
        { id: "duplicate", intrinsicStatus: "fresh" },
        {
          id: "depends-on-duplicate",
          intrinsicStatus: "fresh",
          dependencies: ["duplicate"],
        },
      ],
      { currentSnapshotId: "snapshot:current" },
    );
    const states = Object.fromEntries(
      evaluation.nodes.map((node) => [node.id, node.status]),
    );
    expect(states).toMatchObject({
      partial: "partial",
      derived: "partial",
      dangling: "partial",
      "cycle-a": "error",
      "cycle-b": "error",
      duplicate: "error",
      "depends-on-duplicate": "error",
    });
    expect(evaluation.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "dependency_degraded",
        "dangling_dependency",
        "dependency_cycle",
        "duplicate_node",
      ]),
    );
  });

  it("marks an otherwise fresh node stale on snapshot mismatch", () => {
    const evaluation = evaluateArtifactFreshnessDag(
      [
        {
          id: "task",
          intrinsicStatus: "fresh",
          sourceSnapshotId: "snapshot:old",
        },
      ],
      { currentSnapshotId: "snapshot:current" },
    );
    expect(evaluation.nodes[0]?.status).toBe("stale");
    expect(evaluation.issues[0]?.code).toBe("snapshot_mismatch");
  });

  it("does not let partial hide a source snapshot mismatch", () => {
    const evaluation = evaluateArtifactFreshnessDag(
      [
        {
          id: "partial-task",
          intrinsicStatus: "partial",
          sourceSnapshotId: "snapshot:old",
        },
      ],
      { currentSnapshotId: "snapshot:current" },
    );
    expect(evaluation.nodes[0]?.status).toBe("stale");
    expect(evaluation.issues[0]?.code).toBe("snapshot_mismatch");
  });
});

describe("legacy artifact mismatch inspection", () => {
  it("recognizes a real V2 Wiki set with the generator's bare JSON digest", async () => {
    const root = initializeRepository();
    const { snapshot } = await writeFreshLegacySet(root);
    const report = await inspectArtifactFreshness(root, snapshot);

    expect(report.artifactFreshness).toEqual({
      graph: "fresh",
      wiki: "fresh",
      evidence: "missing",
      diff: "fresh",
      task: "missing",
    });
  });

  it("marks a mixed-generation Wiki V2 support set stale", async () => {
    const root = initializeRepository();
    const { snapshot } = await writeFreshLegacySet(root);
    const search = fixture<Record<string, any>>("legacy/wiki-search-v2.json");
    search.generatedAt = "2026-07-28T09:00:00Z";
    writeJson(
      root,
      ".understand-code/knowledge-base/search-index.json",
      search,
    );

    const result = await inspectArtifactFreshness(root, snapshot);
    expect(result.artifactFreshness.wiki).toBe("stale");
    expect(result.reasonsByFamily.wiki.join(" ")).toContain(
      "different generations",
    );
  });

  it("accepts the equivalent sha256-prefixed Wiki graph digest", async () => {
    const root = initializeRepository();
    const { snapshot, wiki, report } = await writeFreshLegacySet(root);
    wiki.source.graphDigest = `sha256:${wiki.source.graphDigest}`;
    report.source.graphDigest = `sha256:${report.source.graphDigest}`;
    writeJson(root, ".understand-code/knowledge-base/wiki-index.json", wiki);
    writeJson(
      root,
      ".understand-code/knowledge-base/.trace/generation-report.json",
      report,
    );

    const result = await inspectArtifactFreshness(root, snapshot);
    expect(result.artifactFreshness.wiki).toBe("fresh");
  });

  it("recognizes the registered Wiki V1 format without V2 support files", async () => {
    const root = initializeRepository();
    const { snapshot, graph } = await writeFreshLegacySet(root);
    const wikiV1 = fixture<Record<string, any>>("legacy/wiki-index-v1.json");
    wikiV1.source.gitCommitHash = snapshot.headCommit;
    wikiV1.source.graphDigest = createHash("sha256")
      .update(JSON.stringify(graph))
      .digest("hex");
    writeJson(
      root,
      ".understand-code/knowledge-base/wiki-index.json",
      wikiV1,
    );
    rmSync(
      join(root, ".understand-code/knowledge-base/search-index.json"),
      { force: true },
    );
    rmSync(join(root, ".understand-code/knowledge-base/.trace"), {
      recursive: true,
      force: true,
    });

    const result = await inspectArtifactFreshness(root, snapshot);
    expect(result.artifactFreshness.wiki).toBe("fresh");
  });

  it("marks a real Wiki V2 format stale when its graph digest mismatches", async () => {
    const root = initializeRepository();
    const { snapshot, wiki, report } = await writeFreshLegacySet(root);
    const wrong = "0".repeat(64);
    wiki.source.graphDigest = wrong;
    report.source.graphDigest = wrong;
    writeJson(root, ".understand-code/knowledge-base/wiki-index.json", wiki);
    writeJson(
      root,
      ".understand-code/knowledge-base/.trace/generation-report.json",
      report,
    );

    const result = await inspectArtifactFreshness(root, snapshot);
    expect(result.artifactFreshness.wiki).toBe("stale");
    expect(result.reasonsByFamily.wiki.join(" ")).toContain(
      "legacy:wiki-index is stale",
    );
  });

  it("does not call a missing or malformed Wiki graph binding fresh", async () => {
    const root = initializeRepository();
    const { snapshot, wiki, report } = await writeFreshLegacySet(root);
    delete wiki.source.graphDigest;
    report.source.graphDigest = "not-a-digest";
    writeJson(root, ".understand-code/knowledge-base/wiki-index.json", wiki);
    writeJson(
      root,
      ".understand-code/knowledge-base/.trace/generation-report.json",
      report,
    );

    const result = await inspectArtifactFreshness(root, snapshot);
    expect(result.artifactFreshness.wiki).toBe("error");
  });

  it("propagates old Graph/Meta/Fingerprint state into Wiki", async () => {
    const root = initializeRepository();
    const { snapshot, graph } = await writeFreshLegacySet(root);
    graph.project.gitCommitHash = "a".repeat(40);
    writeJson(root, ".understand-code/knowledge-graph.json", graph);

    const result = await inspectArtifactFreshness(root, snapshot);
    expect(result.artifactFreshness.graph).toBe("stale");
    expect(result.artifactFreshness.wiki).toBe("stale");
  });

  it.each([
    [".understand-code/meta.json", "legacy/meta-v1.json"],
    [".understand-code/fingerprints.json", "legacy/fingerprints-v1.json"],
  ] as const)(
    "marks Graph stale when %s targets an old commit",
    async (path, fixturePath) => {
      const root = initializeRepository();
      const { snapshot } = await writeFreshLegacySet(root);
      const artifact = fixture<Record<string, any>>(fixturePath);
      artifact.gitCommitHash = "d".repeat(40);
      writeJson(root, path, artifact);

      const result = await inspectArtifactFreshness(root, snapshot);
      expect(result.artifactFreshness.graph).toBe("stale");
    },
  );

  it("rejects a JSON object that is not a typed legacy Graph shape", async () => {
    const root = initializeRepository();
    const { snapshot } = await writeFreshLegacySet(root);
    writeJson(root, ".understand-code/knowledge-graph.json", {
      version: "1.0.0",
      project: { gitCommitHash: snapshot.headCommit },
    });

    const result = await inspectArtifactFreshness(root, snapshot);
    expect(result.artifactFreshness.graph).toBe("error");
    expect(
      result.evaluation.nodes
        .find((node) => node.id === "legacy:graph")
        ?.reasons.join(" "),
    ).toContain("structural verifier");
  });

  it("calls a host typed verifier and fails closed when it rejects", async () => {
    const root = initializeRepository();
    const { snapshot } = await writeFreshLegacySet(root);
    let calls = 0;
    const result = await inspectArtifactFreshness(root, snapshot, {
      legacyVerifiers: {
        graph: () => {
          calls += 1;
          return { valid: false, reasons: ["Core schema rejected fixture"] };
        },
      },
    });

    expect(calls).toBe(1);
    expect(result.artifactFreshness.graph).toBe("error");
    expect(
      result.evaluation.nodes
        .find((node) => node.id === "legacy:graph")
        ?.reasons.join(" "),
    ).toContain("Core schema rejected fixture");
  });

  it("marks an old Knowledge Base stale", async () => {
    const root = initializeRepository();
    const { snapshot, wiki, report } = await writeFreshLegacySet(root);
    wiki.source.gitCommitHash = "b".repeat(40);
    report.source.gitCommitHash = "b".repeat(40);
    writeJson(root, ".understand-code/knowledge-base/wiki-index.json", wiki);
    writeJson(
      root,
      ".understand-code/knowledge-base/.trace/generation-report.json",
      report,
    );

    const result = await inspectArtifactFreshness(root, snapshot);
    expect(result.artifactFreshness.wiki).toBe("stale");
  });

  it("marks an old Diff Overlay stale", async () => {
    const root = initializeRepository();
    const { snapshot } = await writeFreshLegacySet(root);
    const diff = fixture<Record<string, any>>("legacy/diff-overlay-v1.json");
    diff.baseCommit = snapshot.baseCommit;
    diff.targetCommit = "c".repeat(40);
    writeJson(root, ".understand-code/diff-overlay.json", diff);

    const result = await inspectArtifactFreshness(root, snapshot);
    expect(result.artifactFreshness.diff).toBe("stale");
  });

  it("marks the historical baseBranch-only Diff Overlay format stale", async () => {
    const root = initializeRepository();
    const { snapshot } = await writeFreshLegacySet(root);
    writeJson(root, ".understand-code/diff-overlay.json", {
      version: "1.0.0",
      baseBranch: snapshot.baseCommit,
      generatedAt: "2026-07-28T08:00:00Z",
      changedFiles: ["src/main.ts"],
      changedNodeIds: [],
      affectedNodeIds: [],
    });

    const result = await inspectArtifactFreshness(root, snapshot);
    expect(result.artifactFreshness.diff).toBe("stale");
  });

  it("marks legacy commit-based Graph and Wiki stale when Worktree changes", async () => {
    const root = initializeRepository();
    await writeFreshLegacySet(root);
    writeFileSync(join(root, "src/main.ts"), "export const value = 9;\n");
    const changedSnapshot = await getRepositorySnapshot(root);

    const result = await inspectArtifactFreshness(root, changedSnapshot);
    expect(result.artifactFreshness.graph).toBe("stale");
    expect(result.artifactFreshness.wiki).toBe("stale");
    expect(result.artifactFreshness.diff).toBe("stale");
  });

  it("does not let historical descriptors degrade a current artifact family", async () => {
    const root = initializeRepository();
    const snapshot = await getRepositorySnapshot(root);
    const manifest = fixture<Record<string, any>>(
      "reference/artifact-manifest.json",
    );
    manifest.repositoryId = snapshot.repositoryId;
    manifest.worktreeId = snapshot.worktreeId;
    manifest.latestSnapshotId = snapshot.snapshotId;
    for (const descriptor of manifest.artifacts as any[]) {
      if (descriptor.sourceSnapshotId !== undefined) {
        descriptor.sourceSnapshotId = snapshot.snapshotId;
      }
      for (const dependency of descriptor.dependencies as any[]) {
        if (dependency.requiredSnapshotId !== undefined) {
          dependency.requiredSnapshotId = snapshot.snapshotId;
        }
      }
    }
    const currentTaskBrief = (manifest.artifacts as any[]).find(
      (descriptor) => descriptor.artifactType === "task_brief",
    );
    manifest.artifacts.push({
      ...currentTaskBrief,
      artifactId: "artifact:task-brief-history",
      path: ".understand-code/tasks/task-001/task-brief-history.json",
      state: "historical",
      freshness: "stale",
    });
    expect(ArtifactManifestV1Schema.safeParse(manifest).success).toBe(true);

    const result = await inspectArtifactFreshness(root, snapshot, { manifest });
    expect(result.artifactFreshness.task).toBe("fresh");
  });

  it("fails closed when Manifest requiredDigest/dangling semantics are invalid", async () => {
    const root = initializeRepository();
    const snapshot = await getRepositorySnapshot(root);
    const manifest = fixture<Record<string, any>>(
      "reference/artifact-manifest.json",
    );
    manifest.repositoryId = snapshot.repositoryId;
    manifest.worktreeId = snapshot.worktreeId;
    manifest.latestSnapshotId = snapshot.snapshotId;
    for (const descriptor of manifest.artifacts as any[]) {
      if (descriptor.sourceSnapshotId !== undefined) {
        descriptor.sourceSnapshotId = snapshot.snapshotId;
      }
      for (const dependency of descriptor.dependencies as any[]) {
        if (dependency.requiredSnapshotId !== undefined) {
          dependency.requiredSnapshotId = snapshot.snapshotId;
        }
      }
    }
    expect(ArtifactManifestV1Schema.safeParse(manifest).success).toBe(true);

    const evidence = (manifest.artifacts as any[]).find(
      (descriptor) => descriptor.artifactType === "evidence_ledger",
    );
    evidence.dependencies[0].requiredDigest = `sha256:${"f".repeat(64)}`;
    evidence.dependencies.push({
      artifactId: "artifact:missing",
      relation: "requires",
    });
    expect(ArtifactManifestV1Schema.safeParse(manifest).success).toBe(false);

    const result = await inspectArtifactFreshness(root, snapshot, { manifest });
    expect(result.artifactFreshness).toEqual({
      graph: "error",
      wiki: "error",
      evidence: "error",
      diff: "error",
      task: "error",
    });
    expect(result.reasonsByFamily.evidence.join(" ")).toContain(
      "Artifact Manifest failed Contracts validation",
    );
  });
});
