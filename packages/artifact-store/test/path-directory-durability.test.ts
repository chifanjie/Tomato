import {
  lstat,
  symlink,
} from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ensureManagedDirectory,
  type ManagedDirectoryCreationContext,
} from "../src/path-guard.js";
import { createArtifactStoreLayout } from "../src/layout.js";
import {
  cleanupTemporaryWorktrees,
  createTemporaryWorktree,
} from "./helpers.js";

afterEach(cleanupTemporaryWorktrees);

describe("managed directory durability", () => {
  it("fsyncs each new directory entry through its parent, including the store root", async () => {
    const root = await createTemporaryWorktree();
    const layout = await createArtifactStoreLayout(root);
    const observed: ManagedDirectoryCreationContext[] = [];

    const result = await ensureManagedDirectory(
      layout.worktreeRoot,
      ".understand-code/tasks/task-1",
      {
        faultInjector(context) {
          observed.push(context);
        },
      },
    );

    expect(result).toBe(path.join(layout.storeRoot, "tasks", "task-1"));
    expect(
      observed.map(
        ({
          directoryPath,
          parentDirectoryPath,
          relativeDirectoryPath,
        }) => ({
          directoryPath,
          parentDirectoryPath,
          relativeDirectoryPath,
        }),
      ),
    ).toEqual([
      {
        directoryPath: layout.storeRoot,
        parentDirectoryPath: layout.worktreeRoot,
        relativeDirectoryPath: ".understand-code",
      },
      {
        directoryPath: path.join(layout.storeRoot, "tasks"),
        parentDirectoryPath: layout.storeRoot,
        relativeDirectoryPath: ".understand-code/tasks",
      },
      {
        directoryPath: path.join(layout.storeRoot, "tasks", "task-1"),
        parentDirectoryPath: path.join(layout.storeRoot, "tasks"),
        relativeDirectoryPath: ".understand-code/tasks/task-1",
      },
    ]);

    for (const context of observed) {
      const metadata = await lstat(context.directoryPath);
      expect(metadata.isDirectory()).toBe(true);
      expect(metadata.isSymbolicLink()).toBe(false);
    }

    const repeatedObservations: ManagedDirectoryCreationContext[] = [];
    await ensureManagedDirectory(
      layout.worktreeRoot,
      ".understand-code/tasks/task-1",
      {
        faultInjector(context) {
          repeatedObservations.push(context);
        },
      },
    );
    expect(repeatedObservations).toEqual([]);
  });

  it("rejects a managed symlink before reporting a durable directory creation", async () => {
    const root = await createTemporaryWorktree();
    const outside = await createTemporaryWorktree(
      "artifact-store-directory-outside-",
    );
    const layout = await createArtifactStoreLayout(root);
    await symlink(outside, layout.storeRoot);
    const observed: ManagedDirectoryCreationContext[] = [];

    await expect(
      ensureManagedDirectory(
        layout.worktreeRoot,
        ".understand-code/tasks",
        {
          faultInjector(context) {
            observed.push(context);
          },
        },
      ),
    ).rejects.toMatchObject({ code: "symlink_rejected" });
    expect(observed).toEqual([]);
  });
});
