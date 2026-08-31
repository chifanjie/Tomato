import { mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildRepositoryIndex,
  discardStagedRepositoryIndex,
  listPendingRepositoryIndexesV1,
  openActiveRepositoryIndexV1,
  publishStagedRepositoryIndex,
  readPendingRepositoryIndexV1,
  RepositoryIndexError,
  savePendingRepositoryIndexV1,
  withRepositoryIndexKnowledgeLineageV1,
} from "../src/runtime/repository-indexer.js";

const roots: string[] = [];
const holders: { child: ChildProcess; exited: Promise<unknown> }[] = [];
const lineagePath = "knowledge-base/.trace/task-lineage.json";
const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const pendingLineage = {
  schemaVersion: 1 as const,
  status: "pending" as const,
  taskId,
  taskRevision: 4,
  sourceSnapshotId: "snapshot:fixture",
  requestDigest: `sha256:${"c".repeat(64)}` as `sha256:${string}`,
  idempotencyKeyDigest: `sha256:${"d".repeat(64)}` as `sha256:${string}`,
  predecessorGenerationId: `generation-${"a".repeat(64)}`,
};

async function fixture(includeLineage = true) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "uc-pending-index-")));
  roots.push(root);
  const canonicalRoot = path.join(root, "repository");
  const canonicalInstallationRoot = path.join(root, "installation");
  await mkdir(canonicalRoot, { mode: 0o700 });
  await mkdir(canonicalInstallationRoot, { mode: 0o700 });
  await writeFile(path.join(canonicalRoot, "safe.ts"), "export const safe = true;\n");
  const scope = { canonicalRoot, canonicalInstallationRoot, operationId: "1".repeat(32) };
  const snapshot = {
    schemaVersion: 1,
    snapshotId: "snapshot:fixture",
    repositoryId: "repository:fixture",
    worktreeId: "worktree:fixture",
    rootIdentity: "root:fixture",
    headCommit: "a".repeat(40),
    createdAt: "2026-09-01T00:00:00.000Z",
  } as any;
  const built = await buildRepositoryIndex({
    ...scope,
    snapshot,
    ...(includeLineage ? { knowledgeLineage: pendingLineage } : {}),
  });
  return { ...scope, snapshot, built };
}

async function holdPendingLock(lockPath: string) {
  const child = spawn(process.execPath, ["-e", `
    const fs = require("node:fs");
    const fd = fs.openSync(process.argv[1], "wx", 0o600);
    fs.writeSync(fd, process.pid + ":" + "a".repeat(32) + "\\n");
    fs.fsyncSync(fd);
    process.stdout.write("ready\\n");
    process.stdin.on("data", () => process.exit(0));
  `, lockPath], { stdio: ["pipe", "pipe", "pipe"] });
  const exited = once(child, "close");
  const holder = { child, exited };
  holders.push(holder);
  const ready = await Promise.race([
    once(child.stdout!, "data"),
    exited.then(() => { throw new Error("lock holder exited before ready"); }),
  ]);
  expect(ready[0].toString()).toBe("ready\n");
  return holder;
}

afterEach(async () => {
  for (const { child, exited } of holders.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await exited;
  }
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("durable pending knowledge index", () => {
  it("lists only the requested Task after complete candidate validation without writing", async () => {
    const scope = await fixture();
    const input = { canonicalRoot: scope.canonicalRoot, taskId };
    await expect(listPendingRepositoryIndexesV1(input)).resolves.toEqual([]);
    await expect(readdir(path.join(scope.canonicalRoot, ".understand-code"))).rejects.toMatchObject({ code: "ENOENT" });
    await savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...scope.built });
    const other = withRepositoryIndexKnowledgeLineageV1({ ...scope.built, knowledgeLineage: {
      ...pendingLineage, taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
      requestDigest: `sha256:${"1".repeat(64)}`, idempotencyKeyDigest: `sha256:${"2".repeat(64)}`,
    } });
    await savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...other });
    const pendingRoot = path.join(scope.canonicalRoot, ".understand-code/index-pending-v1");
    const interrupted = `.tmp-${scope.built.generation.generationId}-${"f".repeat(32)}`;
    await mkdir(path.join(pendingRoot, interrupted), { mode: 0o700 });
    const before = (await readdir(pendingRoot)).sort();
    expect(await listPendingRepositoryIndexesV1(input)).toEqual([
      { generation: scope.built.generation, knowledgeLineage: pendingLineage },
    ]);
    expect((await readdir(pendingRoot)).sort()).toEqual(before);
  });

  it("refuses listing when any candidate payload is corrupt, including another Task's candidate", async () => {
    const scope = await fixture();
    const saved = await savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...scope.built });
    const graphPath = path.join(scope.canonicalRoot, ".understand-code/index-pending-v1", saved.generation.generationId, "knowledge-graph.json");
    await writeFile(graphPath, "corrupt");
    await expect(listPendingRepositoryIndexesV1({ canonicalRoot: scope.canonicalRoot, taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAW" }))
      .rejects.toThrow(RepositoryIndexError);
  });

  it("bounds listing including interrupted drafts without cleaning any entry", async () => {
    const scope = await fixture();
    const pendingRoot = path.join(scope.canonicalRoot, ".understand-code/index-pending-v1");
    await mkdir(pendingRoot, { recursive: true, mode: 0o700 });
    for (let index = 0; index < 33; index += 1) {
      await mkdir(path.join(pendingRoot, `.tmp-${scope.built.generation.generationId}-${index.toString(16).padStart(32, "0")}`), { mode: 0o700 });
    }
    const before = (await readdir(pendingRoot)).sort();
    await expect(listPendingRepositoryIndexesV1({ canonicalRoot: scope.canonicalRoot, taskId })).rejects.toThrow(/capacity/u);
    expect((await readdir(pendingRoot)).sort()).toEqual(before);
  });

  it.each(["exit", "SIGKILL"] as const)("recovers a pending lock only after its real holder %s", async (termination) => {
    const scope = await fixture();
    const managedRoot = path.join(scope.canonicalRoot, ".understand-code");
    const pendingRoot = path.join(managedRoot, "index-pending-v1");
    await mkdir(pendingRoot, { recursive: true, mode: 0o700 });
    const interrupted = `.tmp-${scope.built.generation.generationId}-${"f".repeat(32)}`;
    await mkdir(path.join(pendingRoot, interrupted), { mode: 0o700 });
    const lockPath = path.join(managedRoot, ".index-pending-v1.lock");
    const { child, exited } = await holdPendingLock(lockPath);
    const token = await readFile(lockPath);
    await expect(savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...scope.built })).rejects.toThrow();
    expect(await readFile(lockPath)).toEqual(token);
    if (termination === "exit") child.stdin!.write("exit\n");
    else child.kill("SIGKILL");
    await exited;
    // The same now-dead PID is insufficient when its token was not fully written.
    for (const incomplete of [Buffer.alloc(0), token.subarray(0, token.length - 1)]) {
      await writeFile(lockPath, incomplete);
      await expect(savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...scope.built })).rejects.toThrow();
      expect(await readFile(lockPath)).toEqual(incomplete);
    }
    await writeFile(lockPath, token);
    await expect(savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...scope.built })).resolves.toBeDefined();
    expect((await readdir(pendingRoot)).sort()).toEqual([interrupted, scope.built.generation.generationId].sort());
    expect(await readdir(managedRoot)).toEqual(["index-pending-v1"]);
  });

  it("rebuilds identical bytes with the same Snapshot, source, and lineage under a new operation", async () => {
    const scope = await fixture();
    const rebuilt = await buildRepositoryIndex({ ...scope, operationId: "2".repeat(32), knowledgeLineage: pendingLineage });
    expect(rebuilt.generation).toEqual(scope.built.generation);
    expect(rebuilt.publication.manifestBytes.equals(scope.built.publication.manifestBytes)).toBe(true);
    expect(rebuilt.publication.files.map(({ relativePath, contentDigest }) => ({ relativePath, contentDigest })))
      .toEqual(scope.built.publication.files.map(({ relativePath, contentDigest }) => ({ relativePath, contentDigest })));
    for (const [index, file] of rebuilt.publication.files.entries()) {
      expect(file.bytes.equals(scope.built.publication.files[index]!.bytes)).toBe(true);
    }
  });

  it("binds lineage into the generation and survives staging cleanup without publishing", async () => {
    const scope = await fixture();
    const managedRoot = path.join(scope.canonicalRoot, ".understand-code");
    await mkdir(managedRoot, { mode: 0o700 });
    const unchanged = ["index-active-v1.json", "refresh-publication-head-v1.json", "artifact-manifest.json", "repo-pulse.json"];
    for (const name of unchanged) await writeFile(path.join(managedRoot, name), "untouched\n");
    expect(JSON.parse(scope.built.publication.files.find((file) => file.relativePath === lineagePath)!.bytes.toString("utf8")))
      .toEqual(pendingLineage);
    const saved = await savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...scope.built });
    await discardStagedRepositoryIndex(scope);
    const read = await readPendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, generationId: saved.generation.generationId });
    expect(read.generation).toEqual(scope.built.generation);
    expect(read.publication).toEqual(scope.built.publication);
    expect(read.knowledgeLineage).toEqual(pendingLineage);
    await expect(savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...read })).resolves.toEqual(read);
    for (const name of unchanged) expect(await readFile(path.join(managedRoot, name), "utf8")).toBe("untouched\n");
    expect(await readdir(managedRoot)).toEqual(expect.arrayContaining([...unchanged, "index-pending-v1"]));
    expect(await readdir(managedRoot)).not.toContain("index-generations-v1");
  });

  it("promotes only lineage while preserving every candidate content byte", async () => {
    const scope = await fixture();
    await writeFile(path.join(scope.canonicalRoot, "safe.ts"), "export const replaced = 'must not be read';\n");
    const promoted = withRepositoryIndexKnowledgeLineageV1({
      ...scope.built,
      knowledgeLineage: {
        ...pendingLineage,
        status: "published",
        taskRevision: 7,
        candidateGenerationId: scope.built.generation.generationId,
        currentCheckId: "check:current",
        verificationIds: ["verification:passed"],
      },
    });
    expect(promoted.generation.generationId).not.toBe(scope.built.generation.generationId);
    expect(promoted.generation.generationManifestDigest).not.toBe(scope.built.generation.generationManifestDigest);
    expect(promoted.generation.sourceInventoryDigest).toBe(scope.built.generation.sourceInventoryDigest);
    expect(promoted.publication.files.filter((file) => file.relativePath !== lineagePath))
      .toEqual(scope.built.publication.files.filter((file) => file.relativePath !== lineagePath));
    await expect(savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...promoted })).rejects.toThrow(/pending/u);
    await publishStagedRepositoryIndex({ ...scope, ...promoted,
      authority: { sourceSnapshotId: "snapshot:fixture", finalizedProviderRevision: 1 }, publishStoreCut: async () => undefined });
    expect((await openActiveRepositoryIndexV1(scope.canonicalRoot)).knowledgeLineage).toEqual(promoted.knowledgeLineage);
  });

  it("preserves the no-lineage first-scan publication profile", async () => {
    const scope = await fixture(false);
    expect(scope.built.publication.files.some((file) => file.relativePath === lineagePath)).toBe(false);
    await publishStagedRepositoryIndex({ ...scope, ...scope.built,
      authority: { sourceSnapshotId: "snapshot:fixture", finalizedProviderRevision: 1 }, publishStoreCut: async () => undefined });
    expect(await openActiveRepositoryIndexV1(scope.canonicalRoot)).not.toHaveProperty("knowledgeLineage");
  });

  it.each([
    { ...pendingLineage, extra: true },
    { ...pendingLineage, taskId: "not-a-task" },
    { ...pendingLineage, taskRevision: -1 },
    { ...pendingLineage, predecessorGenerationId: "../other" },
    { ...pendingLineage, verificationIds: [] },
    { ...pendingLineage, status: "published" },
  ])("rejects malformed lineage without changing publication bytes", async (knowledgeLineage) => {
    const scope = await fixture();
    const before = Buffer.from(scope.built.publication.manifestBytes);
    expect(() => withRepositoryIndexKnowledgeLineageV1({ ...scope.built, knowledgeLineage } as any)).toThrow(RepositoryIndexError);
    expect(scope.built.publication.manifestBytes).toEqual(before);
  });

  it("rejects changed file bytes and forged manifest digests before creating pending storage", async () => {
    const scope = await fixture();
    const publication = {
      manifestBytes: scope.built.publication.manifestBytes,
      files: scope.built.publication.files.map((file, index) => index === 0 ? { ...file, bytes: Buffer.from("tampered") } : file),
    };
    await expect(savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...scope.built, publication })).rejects.toThrow();
    await expect(savePendingRepositoryIndexV1({
      canonicalRoot: scope.canonicalRoot,
      ...scope.built,
      generation: { ...scope.built.generation, generationManifestDigest: `sha256:${"0".repeat(64)}` },
    })).rejects.toThrow();
    await expect(readdir(path.join(scope.canonicalRoot, ".understand-code"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects symlink roots and tampered or symlinked candidate files", async () => {
    const scope = await fixture();
    const alias = path.join(path.dirname(scope.canonicalRoot), "alias");
    await symlink(scope.canonicalRoot, alias);
    await expect(savePendingRepositoryIndexV1({ canonicalRoot: alias, ...scope.built })).rejects.toThrow();
    const saved = await savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...scope.built });
    const input = { canonicalRoot: scope.canonicalRoot, generationId: saved.generation.generationId };
    const file = scope.built.publication.files.find((candidate) => candidate.relativePath === "knowledge-graph.json")!;
    const candidatePath = path.join(scope.canonicalRoot, ".understand-code/index-pending-v1", input.generationId, file.relativePath);
    await writeFile(candidatePath, "tampered");
    await expect(readPendingRepositoryIndexV1(input)).rejects.toThrow();
    await unlink(candidatePath);
    const outside = path.join(path.dirname(scope.canonicalRoot), "outside.json");
    await writeFile(outside, file.bytes, { mode: 0o600 });
    await symlink(outside, candidatePath);
    await expect(readPendingRepositoryIndexV1(input)).rejects.toThrow();
    await expect(readPendingRepositoryIndexV1({ ...input, generationId: "../outside.json" })).rejects.toThrow();
  });

  it("refuses a full pending store without evicting candidates and still permits exact replay", async () => {
    const scope = await fixture();
    for (let taskRevision = 0; taskRevision < 32; taskRevision += 1) {
      const candidate = withRepositoryIndexKnowledgeLineageV1({ ...scope.built, knowledgeLineage: {
        ...pendingLineage,
        taskRevision,
        requestDigest: `sha256:${taskRevision.toString(16).padStart(64, "0")}`,
        idempotencyKeyDigest: `sha256:${taskRevision.toString(16).padStart(64, "0")}`,
      } });
      await savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...candidate });
    }
    const directory = path.join(scope.canonicalRoot, ".understand-code/index-pending-v1");
    const before = (await readdir(directory)).sort();
    const overflow = withRepositoryIndexKnowledgeLineageV1({ ...scope.built, knowledgeLineage: { ...pendingLineage, taskRevision: 33 } });
    await expect(savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...overflow })).rejects.toThrow(/capacity/u);
    expect((await readdir(directory)).sort()).toEqual(before);
    const replay = await readPendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, generationId: before[0]! });
    await expect(savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...replay })).resolves.toBeDefined();
  });

  it("rejects a symlinked managed parent for reads and writes without following it", async () => {
    const scope = await fixture();
    const saved = await savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...scope.built });
    const managedRoot = path.join(scope.canonicalRoot, ".understand-code");
    const moved = path.join(path.dirname(scope.canonicalRoot), "moved-managed");
    await rename(managedRoot, moved);
    await symlink(moved, managedRoot);
    await expect(readPendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot,
      generationId: saved.generation.generationId })).rejects.toThrow(RepositoryIndexError);
    await expect(savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...scope.built }))
      .rejects.toThrow(RepositoryIndexError);
    await expect(listPendingRepositoryIndexesV1({ canonicalRoot: scope.canonicalRoot, taskId }))
      .rejects.toThrow(RepositoryIndexError);
    expect(await readdir(moved)).toEqual(["index-pending-v1"]);
    expect(await readdir(path.join(moved, "index-pending-v1"))).toEqual([saved.generation.generationId]);
  });

  it("rejects reusing a stage idempotency key for a changed request or content", async () => {
    const scope = await fixture();
    await savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...scope.built });
    for (const changes of [{ requestDigest: `sha256:${"e".repeat(64)}` as `sha256:${string}` }, { taskRevision: 5 }]) {
      const conflicting = withRepositoryIndexKnowledgeLineageV1({ ...scope.built, knowledgeLineage: { ...pendingLineage, ...changes } });
      const failure = await savePendingRepositoryIndexV1({ canonicalRoot: scope.canonicalRoot, ...conflicting })
        .then(() => undefined, (error: unknown) => error);
      expect(failure).toBeInstanceOf(RepositoryIndexError);
      expect((failure as RepositoryIndexError).message).toMatch(/idempotency/u);
      expect((failure as RepositoryIndexError).existingRequestDigest)
        .toBe("requestDigest" in changes ? pendingLineage.requestDigest : undefined);
    }
    expect(await readdir(path.join(scope.canonicalRoot, ".understand-code/index-pending-v1")))
      .toEqual([scope.built.generation.generationId]);
  });
});
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
