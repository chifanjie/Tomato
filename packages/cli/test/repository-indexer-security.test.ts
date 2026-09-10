import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { traceImpact } from "@understand-code/task-engine";

import {
  buildRepositoryIndex,
  discardStagedRepositoryIndex,
  openActiveRepositoryIndexV1,
  preflightRepositoryIndex,
  publishStagedRepositoryIndex,
} from "../src/runtime/repository-indexer.js";

const roots: string[] = [];

async function repositoryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "uc-index-preflight-"));
  const canonicalRoot = await realpath(root);
  roots.push(canonicalRoot);
  return canonicalRoot;
}

async function expectNoManagedWrite(root: string): Promise<void> {
  await expect(access(path.join(root, ".understand-code"))).rejects
    .toMatchObject({ code: "ENOENT" });
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(
    (root) => rm(root, { force: true, recursive: true }),
  ));
});

describe("repository index strong preflight", () => {
  it("publishes and reloads a canonical manifest for mixed case, punctuation and Unicode paths", async () => {
    const root = await repositoryRoot();
    const installationRoot = await repositoryRoot();
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src/a.go"), "package example\nfunc alpha() {}\nfunc Beta() {}\n");
    await writeFile(path.join(root, "src/a_b.go"), "package example\nfunc Punctuated() {}\n");
    await writeFile(path.join(root, "src/源.go"), "package example\nfunc UnicodePath() {}\n");
    const scope = { canonicalRoot: root, canonicalInstallationRoot: installationRoot, operationId: "a".repeat(32) };
    const built = await buildRepositoryIndex({ ...scope, snapshot: {
      schemaVersion: 1, snapshotId: "snapshot:manifest-order", repositoryId: "repository:fixture",
      worktreeId: "worktree:fixture", rootIdentity: "root:fixture", headCommit: "a".repeat(40),
      createdAt: "2026-09-11T00:00:00.000Z",
    } as any });
    const paths = built.publication.files.map((file) => file.relativePath);
    expect(paths).toEqual([...paths].sort());
    expect(paths).not.toEqual([...paths].sort((left, right) => left.localeCompare(right)));
    const manifest = JSON.parse(built.publication.manifestBytes.toString("utf8"));
    expect(manifest.files.map((file: { path: string }) => file.path)).toEqual(paths);
    let committed = false;
    await publishStagedRepositoryIndex({ ...scope, ...built,
      authority: { sourceSnapshotId: "snapshot:manifest-order", finalizedProviderRevision: 1, runtimeProfile: "local_durable_v1" },
      publishStoreCut: async () => { committed = true; },
    });
    expect(committed).toBe(true);
    const active = await openActiveRepositoryIndexV1(root);
    expect(active.generation).toEqual(built.generation);
    await expect(active.read("knowledge-base/search-index.json")).resolves.toEqual(
      built.publication.files.find((file) => file.relativePath === "knowledge-base/search-index.json")!.bytes,
    );
  });
  it("excludes linked-worktree git metadata files without following their gitdir target", async () => {
    const root = await repositoryRoot();
    await writeFile(path.join(root, ".git"), "gitdir: /unrelated/private/repository/.git/worktrees/linked\n");
    await writeFile(path.join(root, "safe.ts"), "export const safe = true;\n");
    const inventory = await preflightRepositoryIndex(root);
    expect(inventory.sourceFileCount).toBe(1);
    await expectNoManagedWrite(root);
  });

  it("returns a stable inventory without creating managed output", async () => {
    const root = await repositoryRoot();
    await writeFile(path.join(root, "safe.ts"), "export const safe = true;\n");

    const first = await preflightRepositoryIndex(root);
    const second = await preflightRepositoryIndex(root);

    expect(first).toEqual(second);
    expect(first.sourceFileCount).toBe(1);
    expect(first.sourceInventoryDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    await expectNoManagedWrite(root);
  });

  it("excludes nested Finder metadata while still rejecting invalid source bytes", async () => {
    const root = await repositoryRoot();
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src/.DS_Store"), Buffer.from([0xff, 0x00]));
    await writeFile(path.join(root, "src/safe.ts"), "export const safe = true;\n");
    expect((await preflightRepositoryIndex(root)).sourceFileCount).toBe(1);
    await writeFile(path.join(root, "src/invalid.ts"), Buffer.from([0xff, 0x00]));
    await expect(preflightRepositoryIndex(root)).rejects.toThrow(/not valid UTF-8/u);
    await expectNoManagedWrite(root);
  });

  it("excludes native libraries without bypassing the source size limit", async () => {
    const root = await repositoryRoot();
    const largeBinary = Buffer.alloc(2 * 1024 * 1024 + 1, 0xff);
    await writeFile(path.join(root, "libthirdparty.so"), largeBinary);
    await writeFile(path.join(root, "safe.go"), "package example\nfunc Safe() {}\n");
    expect((await preflightRepositoryIndex(root)).sourceFileCount).toBe(1);
    await writeFile(path.join(root, "oversized.go"), largeBinary);
    await expect(preflightRepositoryIndex(root)).rejects.toThrow(/exceeds the analysis limit/u);
    await expectNoManagedWrite(root);
  });

  it.each([
    {
      name: "invalid UTF-8",
      file: "invalid.ts",
      bytes: Buffer.from([0xff]),
    },
    {
      name: "secret content",
      file: "secret.ts",
      bytes: Buffer.from(
        "-----BEGIN PRIVATE KEY-----\n" +
          "A".repeat(96) +
          "\n-----END PRIVATE KEY-----\n",
      ),
    },
    {
      name: "sensitive path",
      file: ".env",
      bytes: Buffer.from("TOKEN=not-published\n"),
    },
  ])("rejects $name before any index write", async ({ file, bytes }) => {
    const root = await repositoryRoot();
    await writeFile(path.join(root, file), bytes);

    await expect(preflightRepositoryIndex(root)).rejects.toBeDefined();
    await expectNoManagedWrite(root);
  });

  it("rejects symbolic links before any index write", async () => {
    const root = await repositoryRoot();
    await writeFile(path.join(root, "target.ts"), "export const target = 1;\n");
    await symlink("target.ts", path.join(root, "link.ts"));

    await expect(preflightRepositoryIndex(root)).rejects.toThrow(/symlink/u);
    await expectNoManagedWrite(root);
  });

  it("stages deterministic TS and Go structure with actual local import edges", async () => {
    const root = await repositoryRoot();
    const installationRoot = await repositoryRoot();
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src/main.ts"),
      'import { twice } from "./helper.js";\nexport function main(value: number): number { return twice(value); }\n');
    await writeFile(path.join(root, "src/helper.ts"),
      'export function twice(value: number): number { return value * 2; }\nconst example = "function fake() {}";\n');
    await writeFile(path.join(root, "go.mod"), 'module example.test/work\ngo 1.24\n');
    await mkdir(path.join(root, "lib"));
    await writeFile(path.join(root, "lib/calc.go"),
      'package mathlib\nfunc Double(value int) int { return value * 2 }\n');
    await writeFile(path.join(root, "src/offset.go"),
      'package worker\nfunc offset(value int) int { return value + 1 }\n');
    await writeFile(path.join(root, "src/worker.go"),
      'package worker\nimport ( "fmt"; calc "example.test/work/lib" )\ntype Config struct { Count int }\nfunc Calculate(value int) int { fmt.Println(value); return offset(calc.Double(value)) }\nfunc (c Config) Run(value int) int { return offset(value) }\n');
    const snapshot = {
      schemaVersion: 1, snapshotId: "snapshot:parser-fixture", repositoryId: "repository:fixture",
      worktreeId: "worktree:fixture", rootIdentity: "root:fixture", headCommit: "a".repeat(40),
      createdAt: "2026-09-05T04:00:00.000Z",
    } as any;
    const input = { canonicalRoot: root, canonicalInstallationRoot: installationRoot, snapshot };
    const first = await buildRepositoryIndex({ ...input, operationId: "4".repeat(32) });
    const second = await buildRepositoryIndex({ ...input, operationId: "5".repeat(32) });
    expect(second.graphDigest).toBe(first.graphDigest);
    expect(second.generation).toEqual(first.generation);
    const routedDocuments = first.publication.files
      .filter((file) => file.relativePath === "knowledge-base/wiki-index.json");
    expect(routedDocuments).toHaveLength(1);
    const wikiIndex = JSON.parse(routedDocuments[0]!.bytes.toString("utf8")) as {
      pages?: Array<{ route?: { order: number } }>;
    };
    const routeOrders = (wikiIndex.pages ?? [])
      .flatMap((page) => page.route === undefined ? [] : [page.route.order]);
    expect(new Set(routeOrders).size).toBe(routeOrders.length);
    expect(first.graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "function", name: "main", filePath: "src/main.ts" }),
      expect.objectContaining({ type: "function", name: "twice", filePath: "src/helper.ts" }),
      expect.objectContaining({ type: "function", name: "Calculate", filePath: "src/worker.go" }),
      expect.objectContaining({ type: "class", name: "Config", filePath: "src/worker.go" }),
    ]));
    expect(first.graph.nodes.some((node) => node.name === "fake")).toBe(false);
    expect(first.graph.edges).toContainEqual(expect.objectContaining({
      type: "imports", source: "file:src/main.ts", target: "file:src/helper.ts",
    }));
    expect(first.graph.edges).toContainEqual(expect.objectContaining({
      type: "calls", source: "function:src/main.ts:main", target: "function:src/helper.ts:twice",
      provenance: [{ filePath: "src/main.ts", lineNumber: 2,
        confidence: "imported-package", source: "static-analysis" }],
    }));
    expect(first.graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "imports", source: "file:src/worker.go", target: "file:lib/calc.go" }),
      expect.objectContaining({ type: "calls", source: "function:src/worker.go:Calculate",
        target: "function:lib/calc.go:Double" }),
      expect.objectContaining({ type: "calls", source: "function:src/worker.go:Calculate",
        target: "function:src/offset.go:offset" }),
      expect.objectContaining({ type: "calls", source: "function:src/worker.go:Config.Run",
        target: "function:src/offset.go:offset" }),
    ]));
    const nodeIds = new Set(first.graph.nodes.map((node) => node.id));
    expect(first.graph.edges.every((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))).toBe(true);
    expect(first.graph.edges.some((edge) => edge.target.includes("Println"))).toBe(false);
    expect(first.graph.callResolution).toMatchObject({ unresolvedCallSites: 1 });
    expect(first.graph.callResolution!.totalCallSites).toBe(first.graph.callResolution!.resolvedCallSites + 1);
    const artifact = (name: string) => JSON.parse(first.publication.files.find((file) => file.relativePath === name)!.bytes.toString("utf8"));
    expect(artifact("knowledge-base/.trace/call-resolution.json")).toMatchObject({
      sourceSnapshotId: snapshot.snapshotId, graphDigest: first.graphDigest,
      unresolved: [{ file: "src/worker.go", caller: "Calculate", callee: "fmt.Println", lineNumber: 4 }],
    });
    expect(artifact("knowledge-base/wiki-index.json")).toMatchObject({
      source: { generationMode: "deterministic" }, mainReadiness: { status: "blocked" },
      referenceCoverage: { scope: { basis: "full-graph", totalGraphNodes: first.graph.nodes.length } },
    });
    expect(artifact("knowledge-base/.trace/host-analysis-context.json")).toMatchObject({
      sourceSnapshotId: snapshot.snapshotId, semanticStatus: "awaiting-host-analysis", graphDigest: first.graphDigest,
    });
    expect(first.graph.nodes.find((node) => node.id === "function:src/main.ts:main")?.summary).toContain("业务语义待宿主分析");
    const impact = traceImpact({
      graph: first.graph, startNodeIds: ["function:src/helper.ts:twice"],
      repoPulse: { status: "fresh", artifactFreshness: { graph: "fresh" },
        completeness: { callGraph: { status: "partial", reasons: ["unsupported dynamic bindings"] } } },
      options: { direction: "upstream" },
    });
    expect(impact.paths).toContainEqual(expect.objectContaining({
      endNodeId: "function:src/main.ts:main", classification: "inferred",
    }));
    expect(impact.diagnostics).toContainEqual(expect.objectContaining({ code: "call_graph_incomplete" }));
    const stagedGraph = JSON.parse(await readFile(path.join(installationRoot,
      ".refresh-index-staging-v1", "4".repeat(32), "knowledge-graph.json"), "utf8"));
    expect(stagedGraph.edges).toEqual(first.graph.edges);
    const fingerprints = JSON.parse((await readFile(path.join(installationRoot,
      ".refresh-index-staging-v1", "4".repeat(32), "fingerprints.json"))).toString("utf8"));
    expect(fingerprints.files["src/worker.go"].hasStructuralAnalysis).toBe(true);
    expect(fingerprints.files["src/worker.go"].imports).not.toHaveLength(0);
    await expectNoManagedWrite(root);
  });

  it("keeps barrel dependencies and traces calls to the actual implementation", async () => {
    const root = await repositoryRoot();
    const installationRoot = await repositoryRoot();
    await writeFile(path.join(root, "impl.ts"), "export function original() { return 2; }\n");
    await writeFile(path.join(root, "exports.ts"), 'export { original as helper } from "./impl.js";\n');
    await writeFile(path.join(root, "index.ts"), 'export * from "./exports.js";\n');
    await writeFile(path.join(root, "main.ts"), 'import { helper } from "./index.js";\nexport function run() { return helper(); }\n');
    const built = await buildRepositoryIndex({
      canonicalRoot: root, canonicalInstallationRoot: installationRoot, operationId: "6".repeat(32),
      snapshot: { schemaVersion: 1, snapshotId: "snapshot:barrel", repositoryId: "repository:fixture",
        worktreeId: "worktree:fixture", rootIdentity: "root:fixture", headCommit: "a".repeat(40),
        createdAt: "2026-09-06T00:00:00.000Z" } as any,
    });
    expect(built.graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "imports", source: "file:main.ts", target: "file:index.ts" }),
      expect.objectContaining({ type: "imports", source: "file:index.ts", target: "file:exports.ts" }),
      expect.objectContaining({ type: "imports", source: "file:exports.ts", target: "file:impl.ts" }),
      expect.objectContaining({ type: "calls", source: "function:main.ts:run", target: "function:impl.ts:original",
        provenance: [{ filePath: "main.ts", lineNumber: 2, confidence: "imported-package", source: "static-analysis" }] }),
    ]));
    const impact = traceImpact({ graph: built.graph, startNodeIds: ["function:impl.ts:original"],
      repoPulse: { status: "fresh", artifactFreshness: { graph: "fresh" } }, options: { direction: "upstream" } });
    expect(impact.paths).toContainEqual(expect.objectContaining({ endNodeId: "function:main.ts:run" }));
    await expectNoManagedWrite(root);
  });

  it("keeps type/value exports distinct and blocks runtime enum shadowing of star exports", async () => {
    const root = await repositoryRoot();
    const installationRoot = await repositoryRoot();
    await writeFile(path.join(root, "impl.ts"), "export function helper() { return 2; }\n");
    await writeFile(path.join(root, "types.ts"), "export type helper = string;\n");
    await writeFile(path.join(root, "type-barrel.ts"),
      'export type { helper } from "./types.js";\nexport * from "./impl.js";\n');
    await writeFile(path.join(root, "type-main.ts"),
      'import { helper } from "./type-barrel.js";\nexport function runType() { return helper(); }\n');
    await writeFile(path.join(root, "enum-barrel.ts"),
      'export enum helper { A }\nexport * from "./impl.js";\n');
    await writeFile(path.join(root, "enum-main.ts"),
      'import { helper } from "./enum-barrel.js";\nexport function runEnum() { return helper(); }\n');
    const built = await buildRepositoryIndex({
      canonicalRoot: root, canonicalInstallationRoot: installationRoot, operationId: "7".repeat(32),
      snapshot: { schemaVersion: 1, snapshotId: "snapshot:type-value-exports", repositoryId: "repository:fixture",
        worktreeId: "worktree:fixture", rootIdentity: "root:fixture", headCommit: "a".repeat(40),
        createdAt: "2026-09-06T00:00:00.000Z" } as any,
    });
    expect(built.graph.edges).toContainEqual(expect.objectContaining({
      type: "calls", source: "function:type-main.ts:runType", target: "function:impl.ts:helper",
    }));
    expect(built.graph.edges).not.toContainEqual(expect.objectContaining({
      type: "calls", source: "function:enum-main.ts:runEnum", target: "function:impl.ts:helper",
    }));
    await expectNoManagedWrite(root);
  });

  it("stages outside the repository and publishes only on an explicit commit", async () => {
    const root = await repositoryRoot();
    const installationRoot = await repositoryRoot();
    const operationId = "1".repeat(32);
    const staleOperation = path.join(
      installationRoot,
      ".refresh-index-staging-v1",
      "3".repeat(32),
    );
    await mkdir(staleOperation, { recursive: true, mode: 0o700 });
    const staleAt = new Date(Date.now() - 25 * 60 * 60 * 1_000);
    await utimes(staleOperation, staleAt, staleAt);
    const managedRoot = path.join(root, ".understand-code");
    const canonicalGraph = path.join(managedRoot, "knowledge-graph.json");
    await mkdir(managedRoot);
    await writeFile(canonicalGraph, "old-authoritative-index\n");
    await writeFile(path.join(root, "safe.ts"), "export const safe = true;\n");
    const preflight = await preflightRepositoryIndex(root);
    const scope = {
      canonicalRoot: root,
      canonicalInstallationRoot: installationRoot,
      operationId,
    };

    const built = await buildRepositoryIndex({
      ...scope,
      expectedSourceInventoryDigest: preflight.sourceInventoryDigest,
      snapshot: {
        schemaVersion: 1,
        snapshotId: "snapshot:fixture",
        repositoryId: "repository:fixture",
        worktreeId: "worktree:fixture",
        rootIdentity: "root:fixture",
        headCommit: "a".repeat(40),
        createdAt: "2026-08-27T08:00:00.000Z",
      } as any,
    });

    await expect(readFile(canonicalGraph, "utf8")).resolves.toBe(
      "old-authoritative-index\n",
    );
    await expect(access(path.join(
      installationRoot,
      ".refresh-index-staging-v1",
      operationId,
      "knowledge-graph.json",
    ))).resolves.toBeUndefined();
    await expect(access(staleOperation)).rejects.toMatchObject({ code: "ENOENT" });

    const generationsRoot = path.join(managedRoot, "index-generations-v1");
    await mkdir(generationsRoot, { mode: 0o700 });
    for (let index = 0; index < 32; index += 1) {
      await mkdir(path.join(
        generationsRoot,
        `generation-${index.toString(16).padStart(64, "0")}`,
      ), { mode: 0o700 });
    }

    await publishStagedRepositoryIndex({
      ...scope,
      generation: built.generation,
      publication: built.publication,
      authority: { sourceSnapshotId: "snapshot:fixture", finalizedProviderRevision: 2 },
      publishStoreCut: async () => undefined,
    });
    await expect(readFile(canonicalGraph, "utf8")).resolves.toBe(
      "old-authoritative-index\n",
    );
    const active = await openActiveRepositoryIndexV1(root);
    await expect(readdir(generationsRoot)).resolves.toHaveLength(32);
    await expect(active.read("knowledge-graph.json")).resolves.not.toEqual(
      Buffer.from("old-authoritative-index\n"),
    );
    await expect(publishStagedRepositoryIndex({
      ...scope,
      generation: built.generation,
      publication: built.publication,
      authority: { sourceSnapshotId: "snapshot:older", finalizedProviderRevision: 1 },
      publishStoreCut: async () => { throw new Error("must_not_publish_store"); },
    })).rejects.toThrow(/cannot move backward/u);
    await expect(publishStagedRepositoryIndex({
      ...scope,
      generation: built.generation,
      publication: built.publication,
      authority: { sourceSnapshotId: "snapshot:mismatch", finalizedProviderRevision: 2 },
      publishStoreCut: async () => { throw new Error("must_not_publish_store"); },
    })).rejects.toThrow(/cannot move backward or fork/u);
    await expect(active.read("knowledge-base/wiki-index.json"))
      .resolves.toBeInstanceOf(Buffer);
    await discardStagedRepositoryIndex(scope);
    await expect(access(path.join(
      installationRoot,
      ".refresh-index-staging-v1",
      operationId,
    ))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("publishes bound in-memory bytes even when the discarded staging manifest is replaced", async () => {
    const root = await repositoryRoot();
    const installationRoot = await repositoryRoot();
    const operationId = "2".repeat(32);
    await writeFile(path.join(root, "safe.ts"), "export const safe = true;\n");
    const preflight = await preflightRepositoryIndex(root);
    const scope = {
      canonicalRoot: root,
      canonicalInstallationRoot: installationRoot,
      operationId,
    };
    const built = await buildRepositoryIndex({
      ...scope,
      expectedSourceInventoryDigest: preflight.sourceInventoryDigest,
      snapshot: {
        schemaVersion: 1,
        snapshotId: "snapshot:fixture",
        repositoryId: "repository:fixture",
        worktreeId: "worktree:fixture",
        rootIdentity: "root:fixture",
        headCommit: "a".repeat(40),
        createdAt: "2026-08-27T08:00:00.000Z",
      } as any,
    });
    const stageManifest = path.join(
      installationRoot,
      ".refresh-index-staging-v1",
      operationId,
      "stage-manifest.json",
    );
    await unlink(stageManifest);
    await symlink(path.join(root, "safe.ts"), stageManifest);

    await expect(publishStagedRepositoryIndex({
      ...scope,
      generation: built.generation,
      publication: built.publication,
      authority: { sourceSnapshotId: "snapshot:fixture", finalizedProviderRevision: 2 },
      publishStoreCut: async () => undefined,
    })).resolves.toBeUndefined();
    await expect(openActiveRepositoryIndexV1(root)).resolves.toBeDefined();
    await discardStagedRepositoryIndex(scope);
  });
});
