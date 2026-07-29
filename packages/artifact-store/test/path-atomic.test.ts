import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rmdir,
  symlink,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ArtifactStore,
} from "../src/index.js";
import {
  atomicWriteFile,
  type AtomicWriteStage,
} from "../src/atomic.js";
import { ArtifactStoreError } from "../src/errors.js";
import { createArtifactStoreLayout } from "../src/layout.js";
import {
  ensureManagedDirectory,
  repositoryRelativePathFromAbsolute,
  resolveRepositoryPath,
} from "../src/path-guard.js";
import {
  cleanupTemporaryWorktrees,
  createTemporaryWorktree,
  FIXTURE_PRODUCER_VERSION,
  FIXTURE_REPOSITORY_ID,
  FIXTURE_WORKTREE_ID,
  openFixtureStore,
} from "./helpers.js";

const finalRealpathGate = vi.hoisted(() => ({
  enabled: false,
  targetPath: undefined as string | undefined,
  entered: undefined as (() => void) | undefined,
  releasePromise: undefined as Promise<void> | undefined,
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...original,
    async realpath(...args: Parameters<typeof original.realpath>) {
      if (
        finalRealpathGate.enabled &&
        String(args[0]) === finalRealpathGate.targetPath
      ) {
        finalRealpathGate.enabled = false;
        finalRealpathGate.entered?.();
        await finalRealpathGate.releasePromise;
      }
      return original.realpath(...args);
    },
  };
});

afterEach(async () => {
  finalRealpathGate.enabled = false;
  finalRealpathGate.targetPath = undefined;
  finalRealpathGate.entered = undefined;
  finalRealpathGate.releasePromise = undefined;
  await cleanupTemporaryWorktrees();
});

describe("managed path guard", () => {
  it("supports spaces and Chinese while rejecting traversal, absolute, sensitive, and prefix-collision paths", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const target = path.join(store.layout.storeRoot, "目录 with space.json");
    await atomicWriteFile(store.layout.worktreeRoot, target, "ok");
    await expect(readFile(target, "utf8")).resolves.toBe("ok");

    await expect(
      resolveRepositoryPath(store.layout.worktreeRoot, "../escape", {
        allowMissing: true,
      }),
    ).rejects.toMatchObject({ code: "unsafe_path" });
    await expect(
      resolveRepositoryPath(store.layout.worktreeRoot, "/absolute", {
        allowMissing: true,
      }),
    ).rejects.toMatchObject({ code: "unsafe_path" });
    await expect(
      resolveRepositoryPath(store.layout.worktreeRoot, ".env", {
        allowMissing: true,
      }),
    ).rejects.toMatchObject({ code: "sensitive_path" });
    expect(() =>
      repositoryRelativePathFromAbsolute(
        store.layout.worktreeRoot,
        `${store.layout.worktreeRoot}-collision/file.json`,
      ),
    ).toThrowError(ArtifactStoreError);
  });

  it("rejects .understand-code when it is an outside or broken symlink", async () => {
    for (const broken of [false, true]) {
      const root = await createTemporaryWorktree(
        `artifact-store-symlink-${broken}-`,
      );
      const outside = await createTemporaryWorktree("artifact-store-outside-");
      const target = broken
        ? path.join(outside, "missing")
        : outside;
      await symlink(target, path.join(root, ".understand-code"));
      const store = await ArtifactStore.open(root, {
        repositoryId: FIXTURE_REPOSITORY_ID,
        worktreeId: FIXTURE_WORKTREE_ID,
        producerVersion: FIXTURE_PRODUCER_VERSION,
      });
      await expect(store.initialize()).rejects.toMatchObject({
        code: "symlink_rejected",
      });
    }
  });

  it("rejects source and managed symlinks that escape the canonical root", async () => {
    const root = await createTemporaryWorktree();
    const outside = await createTemporaryWorktree("artifact-store-outside-");
    await mkdir(path.join(root, ".understand-code"));
    await symlink(
      path.join(outside, "secret.txt"),
      path.join(root, "linked-secret"),
    );
    await expect(
      resolveRepositoryPath(root, "linked-secret"),
    ).rejects.toMatchObject({ code: "symlink_rejected" });

    await symlink(
      outside,
      path.join(root, ".understand-code", "escaped"),
    );
    await expect(
      resolveRepositoryPath(root, ".understand-code/escaped/file.json", {
        allowMissing: true,
      }),
    ).rejects.toMatchObject({ code: "symlink_rejected" });
  });

  it("handles a leaf removed between lstat and final realpath according to allowMissing", async () => {
    for (const allowMissing of [true, false]) {
      const root = await createTemporaryWorktree(
        `artifact-store-realpath-race-${allowMissing}-`,
      );
      const store = await openFixtureStore(root);
      await ensureManagedDirectory(
        store.layout.worktreeRoot,
        ".understand-code/.locks",
      );
      const relativePath =
        `.understand-code/.locks/realpath-race-${allowMissing}.lock`;
      const targetPath = path.join(
        store.layout.worktreeRoot,
        ...relativePath.split("/"),
      );
      await mkdir(targetPath);

      let markEntered!: () => void;
      const entered = new Promise<void>((resolve) => {
        markEntered = resolve;
      });
      let releaseRealpath!: () => void;
      finalRealpathGate.releasePromise = new Promise<void>((resolve) => {
        releaseRealpath = resolve;
      });
      finalRealpathGate.targetPath = targetPath;
      finalRealpathGate.entered = markEntered;
      finalRealpathGate.enabled = true;

      const resolving = resolveRepositoryPath(
        store.layout.worktreeRoot,
        relativePath,
        { allowMissing },
      );
      await entered;
      await rmdir(targetPath);
      releaseRealpath();

      if (allowMissing) {
        await expect(resolving).resolves.toBe(targetPath);
      } else {
        await expect(resolving).rejects.toMatchObject({
          code: "artifact_not_found",
          details: { relativePath },
        });
      }
    }
  });
});

describe("atomic persistence", () => {
  it("reports an ArtifactStoreError injected after rename as committed", async () => {
    const root = await createTemporaryWorktree();
    const layout = await createArtifactStoreLayout(root);
    await ensureManagedDirectory(layout.worktreeRoot, ".understand-code");
    const target = path.join(layout.storeRoot, "committed-error.json");
    await atomicWriteFile(layout.worktreeRoot, target, "old");

    await expect(
      atomicWriteFile(layout.worktreeRoot, target, "new", {
        faultInjector({ stage }) {
          if (stage === "after_rename") {
            throw new ArtifactStoreError(
              "unsafe_path",
              "injected managed-path failure",
              { injected: true },
            );
          }
        },
      }),
    ).rejects.toMatchObject({
      code: "unsafe_path",
      details: {
        injected: true,
        targetPath: target,
        committed: true,
      },
    });
    await expect(readFile(target, "utf8")).resolves.toBe("new");
  });

  it("leaves the old or the complete new value at every injected crash stage and cleans same-directory temp files", async () => {
    const root = await createTemporaryWorktree();
    const layout = await createArtifactStoreLayout(root);
    await ensureManagedDirectory(layout.worktreeRoot, ".understand-code");
    const target = path.join(layout.storeRoot, "atomic.json");
    const stages: AtomicWriteStage[] = [
      "before_open",
      "after_open",
      "after_write",
      "after_file_fsync",
      "before_rename",
      "after_rename",
      "after_directory_fsync",
    ];
    for (const stage of stages) {
      await atomicWriteFile(layout.worktreeRoot, target, "old");
      await expect(
        atomicWriteFile(layout.worktreeRoot, target, "new", {
          faultInjector(context) {
            if (context.stage === stage) throw new Error(`crash:${stage}`);
          },
        }),
      ).rejects.toBeInstanceOf(ArtifactStoreError);
      const expected =
        stage === "after_rename" || stage === "after_directory_fsync"
          ? "new"
          : "old";
      await expect(readFile(target, "utf8")).resolves.toBe(expected);
      expect(
        (await readdir(layout.storeRoot)).filter((entry) =>
          entry.includes(".tmp-"),
        ),
      ).toEqual([]);
    }
  });

  it("revalidates the managed parent before rename and does not follow a TOCTOU symlink swap", async () => {
    const root = await createTemporaryWorktree();
    const outside = await createTemporaryWorktree("artifact-store-outside-");
    const layout = await createArtifactStoreLayout(root);
    await ensureManagedDirectory(layout.worktreeRoot, ".understand-code");
    const target = path.join(layout.storeRoot, "toctou.json");
    await atomicWriteFile(layout.worktreeRoot, target, "old");
    const heldStore = path.join(
      layout.worktreeRoot,
      ".understand-code-held",
    );
    let swapped = false;

    await expect(
      atomicWriteFile(layout.worktreeRoot, target, "new", {
        async faultInjector({ stage }) {
          if (stage !== "after_file_fsync" || swapped) return;
          await rename(layout.storeRoot, heldStore);
          await symlink(outside, layout.storeRoot);
          swapped = true;
        },
      }),
    ).rejects.toMatchObject({ code: "symlink_rejected" });

    expect(swapped).toBe(true);
    await expect(lstat(layout.storeRoot)).resolves.toMatchObject({});
    await unlink(layout.storeRoot);
    await rename(heldStore, layout.storeRoot);
    await expect(readFile(target, "utf8")).resolves.toBe("old");
    await expect(
      readFile(path.join(outside, "toctou.json"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
