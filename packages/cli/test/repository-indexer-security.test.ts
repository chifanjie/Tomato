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
