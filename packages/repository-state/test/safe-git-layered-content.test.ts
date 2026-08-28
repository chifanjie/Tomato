import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSafeGitLayeredContentReadSessionV1,
  readSafeGitLayeredRepositoryChangeContentV1,
  type SafeGitLayeredRepositoryChangeInputV1,
} from "../src/safe-git-layered-content.js";
import type {
  SafeGitReadCommandV1,
  SafeGitReadExecutorV1,
  SafeGitReadRequestV1,
} from "../src/safe-git-read-command.js";
import {
  cleanupTemporaryDirectories,
  commitAll,
  git,
  initializeRepository,
  writeRepositoryFile,
} from "./helpers.js";

const MAX_TEST_GIT_BYTES = 128 * 1_024 * 1_024;

function contentDigestV1(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

afterEach(() => {
  cleanupTemporaryDirectories();
});

function gitArgumentsV1(request: SafeGitReadRequestV1): readonly string[] {
  switch (request.profile) {
    case "ls_files_stage_v1":
      return ["ls-files", "--stage", "-z"];
    case "cat_file_object_v1":
      return ["cat-file", "-p", request.objectId];
    case "cat_file_type_v1":
      return ["cat-file", "-t", "--", request.objectId];
    default:
      throw new Error(`unexpected test profile: ${request.profile}`);
  }
}

function repositoryExecutorV1(
  root: string,
  seen: SafeGitReadCommandV1[] = [],
): SafeGitReadExecutorV1 {
  return {
    async execute(command) {
      seen.push(command);
      const result = spawnSync("git", [...gitArgumentsV1(command.request)], {
        cwd: root,
        encoding: "buffer",
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
          LC_ALL: "C",
        },
        maxBuffer: MAX_TEST_GIT_BYTES,
      });
      if (result.error !== undefined) throw result.error;
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.status ?? -1,
      };
    },
  };
}

function changeV1(
  source: SafeGitLayeredRepositoryChangeInputV1["source"],
  kind: SafeGitLayeredRepositoryChangeInputV1["kind"] = "modified",
  path = "src/layer.ts",
): SafeGitLayeredRepositoryChangeInputV1 {
  return { path, source, kind };
}

describe("descriptor-bound layered SafeGit content", () => {
  it("keeps committed, Index, and worktree bytes separate for one path", async () => {
    const root = initializeRepository({ "src/layer.ts": "head\n" });
    const head = git(root, ["rev-parse", "HEAD"]);
    writeRepositoryFile(root, "src/layer.ts", "index\n");
    git(root, ["add", "src/layer.ts"]);
    writeRepositoryFile(root, "src/layer.ts", "worktree\n");

    const committedSeen: SafeGitReadCommandV1[] = [];
    const committed = await readSafeGitLayeredRepositoryChangeContentV1(
      repositoryExecutorV1(root, committedSeen),
      head,
      changeV1("committed"),
      { maxBytes: 1_024 },
    );
    expect(committed).toMatchObject({
      status: "content",
      layer: "head_tree",
      mode: "100644",
      source: "committed",
    });
    expect(committed.status === "content" ? committed.bytes.toString("utf8") : "")
      .toBe("head\n");
    expect(committedSeen.map((command) => command.request.profile))
      .not.toContain("ls_files_stage_v1");

    const stagedSeen: SafeGitReadCommandV1[] = [];
    const staged = await readSafeGitLayeredRepositoryChangeContentV1(
      repositoryExecutorV1(root, stagedSeen),
      head,
      changeV1("staged"),
      {
        maxBytes: 1_024,
        expectedContentDigest: contentDigestV1("index\n"),
      },
    );
    expect(staged).toMatchObject({
      status: "content",
      layer: "index",
      mode: "100644",
      source: "staged",
    });
    expect(staged.status === "content" ? staged.bytes.toString("utf8") : "")
      .toBe("index\n");
    expect(stagedSeen.map((command) => command.request.profile)).toEqual([
      "ls_files_stage_v1",
      "cat_file_type_v1",
      "cat_file_object_v1",
    ]);
  });

  it("returns exact-layer absence for deletes and never reads worktree layers", async () => {
    const root = initializeRepository({ "src/layer.ts": "before\n" });
    git(root, ["rm", "src/layer.ts"]);
    const head = commitAll(root, "delete layer");
    const executor = repositoryExecutorV1(root);

    await expect(
      readSafeGitLayeredRepositoryChangeContentV1(
        executor,
        head,
        changeV1("committed", "deleted"),
        { maxBytes: 1_024 },
      ),
    ).resolves.toMatchObject({
      status: "absent",
      layer: "head_tree",
      source: "committed",
    });
    await expect(
      readSafeGitLayeredRepositoryChangeContentV1(
        executor,
        head,
        changeV1("staged", "deleted"),
        { maxBytes: 1_024 },
      ),
    ).resolves.toMatchObject({
      status: "absent",
      layer: "index",
      source: "staged",
    });

    const noRead = { execute: vi.fn() } as unknown as SafeGitReadExecutorV1;
    await expect(
      readSafeGitLayeredRepositoryChangeContentV1(
        noRead,
        head,
        changeV1("unstaged"),
        { maxBytes: 1_024 },
      ),
    ).resolves.toEqual({
      status: "not_applicable",
      path: "src/layer.ts",
      source: "unstaged",
    });
    expect(noRead.execute).not.toHaveBeenCalled();
  });

  it("fails closed on symlink and gitlink entries", async () => {
    const symlinkRoot = initializeRepository({ "target.txt": "target\n" });
    symlinkSync("target.txt", join(symlinkRoot, "link.txt"));
    const symlinkHead = commitAll(symlinkRoot, "add symlink");
    await expect(
      readSafeGitLayeredRepositoryChangeContentV1(
        repositoryExecutorV1(symlinkRoot),
        symlinkHead,
        changeV1("committed", "added", "link.txt"),
        { maxBytes: 1_024 },
      ),
    ).rejects.toMatchObject({ code: "unsupported_entry_type" });

    const gitlinkRoot = initializeRepository();
    const gitlinkHead = git(gitlinkRoot, ["rev-parse", "HEAD"]);
    git(gitlinkRoot, [
      "update-index",
      "--add",
      "--cacheinfo",
      `160000,${gitlinkHead},vendor`,
    ]);
    await expect(
      readSafeGitLayeredRepositoryChangeContentV1(
        repositoryExecutorV1(gitlinkRoot),
        gitlinkHead,
        changeV1("staged", "added", "vendor"),
        {
          maxBytes: 1_024,
          expectedContentDigest: contentDigestV1(""),
        },
      ),
    ).rejects.toMatchObject({ code: "unsupported_entry_type" });
  });

  it("rejects unsafe input and non-UTF-8 Index paths before material use", async () => {
    const head = "a".repeat(40);
    const noRead = { execute: vi.fn() } as unknown as SafeGitReadExecutorV1;
    await expect(
      readSafeGitLayeredRepositoryChangeContentV1(
        noRead,
        head,
        changeV1("staged", "modified", "../secret"),
        { maxBytes: 1_024 },
      ),
    ).rejects.toMatchObject({ code: "unsafe_path" });
    expect(noRead.execute).not.toHaveBeenCalled();

    const invalidPath = Buffer.concat([
      Buffer.from(`100644 ${"b".repeat(40)} 0\tsrc/`, "ascii"),
      Buffer.from([0xff, 0x00]),
    ]);
    const invalidUtf8Executor: SafeGitReadExecutorV1 = {
      async execute() {
        return { stdout: invalidPath, stderr: Buffer.alloc(0), exitCode: 0 };
      },
    };
    await expect(
      readSafeGitLayeredRepositoryChangeContentV1(
        invalidUtf8Executor,
        head,
        changeV1("staged"),
        {
          maxBytes: 1_024,
          expectedContentDigest: contentDigestV1("unreachable"),
        },
      ),
    ).rejects.toMatchObject({ code: "invalid_git_output" });
  });

  it("passes the caller byte ceiling into the blob read and rejects overflow", async () => {
    const root = initializeRepository({ "src/layer.ts": "head\n" });
    const head = git(root, ["rev-parse", "HEAD"]);
    writeRepositoryFile(root, "src/layer.ts", "index-content\n");
    git(root, ["add", "src/layer.ts"]);
    const seen: SafeGitReadCommandV1[] = [];

    await expect(
      readSafeGitLayeredRepositoryChangeContentV1(
        repositoryExecutorV1(root, seen),
        head,
        changeV1("staged"),
        {
          maxBytes: 4,
          expectedContentDigest: contentDigestV1("index-content\n"),
        },
      ),
    ).rejects.toMatchObject({ code: "budget_exceeded" });
    expect(
      seen.find(
        (command) => command.request.profile === "cat_file_object_v1",
      )?.stdoutLimitBytes,
    ).toBe(4);
  });

  it("binds staged bytes to the captured content digest and rejects Index ABA", async () => {
    const root = initializeRepository({ "src/layer.ts": "head\n" });
    const head = git(root, ["rev-parse", "HEAD"]);
    writeRepositoryFile(root, "src/layer.ts", "captured-secret\n");
    git(root, ["add", "src/layer.ts"]);
    const capturedDigest = contentDigestV1("captured-secret\n");

    writeRepositoryFile(root, "src/layer.ts", "benign-swap\n");
    git(root, ["add", "src/layer.ts"]);

    await expect(
      readSafeGitLayeredRepositoryChangeContentV1(
        repositoryExecutorV1(root),
        head,
        changeV1("staged"),
        { maxBytes: 1_024, expectedContentDigest: capturedDigest },
      ),
    ).rejects.toMatchObject({ code: "change_mismatch" });
    await expect(
      readSafeGitLayeredRepositoryChangeContentV1(
        repositoryExecutorV1(root),
        head,
        changeV1("staged"),
        { maxBytes: 1_024 },
      ),
    ).rejects.toMatchObject({ code: "invalid_argument" });
  });

  it("shares commit, tree, Index, and blob caches only within an explicit session", async () => {
    const root = initializeRepository({
      "src/first.ts": "same\n",
      "src/second.ts": "same\n",
    });
    const head = git(root, ["rev-parse", "HEAD"]);
    const seen: SafeGitReadCommandV1[] = [];
    const executor = repositoryExecutorV1(root, seen);
    const session = createSafeGitLayeredContentReadSessionV1(executor);

    for (const path of ["src/first.ts", "src/second.ts"]) {
      await readSafeGitLayeredRepositoryChangeContentV1(
        executor,
        head,
        changeV1("committed", "modified", path),
        { maxBytes: 1_024, session },
      );
    }
    for (const path of ["src/first.ts", "src/second.ts"]) {
      await readSafeGitLayeredRepositoryChangeContentV1(
        executor,
        head,
        changeV1("staged", "modified", path),
        {
          maxBytes: 1_024,
          expectedContentDigest: contentDigestV1("same\n"),
          session,
        },
      );
    }

    expect(seen.filter(
      (command) => command.request.profile === "ls_files_stage_v1",
    )).toHaveLength(1);
    expect(seen.filter(
      (command) =>
        "objectId" in command.request && command.request.objectId === head,
    )).toHaveLength(2);
    const blobReads = seen.filter(
      (command) => command.request.profile === "cat_file_object_v1" &&
        command.request.objectId !== head,
    );
    expect(blobReads).toHaveLength(3);
  });

  it("uses a fresh Index snapshot when no explicit session is supplied", async () => {
    const root = initializeRepository({ "src/seed.ts": "head\n" });
    const head = git(root, ["rev-parse", "HEAD"]);
    writeRepositoryFile(root, "src/seed.ts", "staged\n");
    git(root, ["add", "src/seed.ts"]);
    const executor = repositoryExecutorV1(root);

    await readSafeGitLayeredRepositoryChangeContentV1(
      executor,
      head,
      changeV1("staged", "modified", "src/seed.ts"),
      {
        maxBytes: 1_024,
        expectedContentDigest: contentDigestV1("staged\n"),
      },
    );

    writeRepositoryFile(root, "src/later.ts", "later\n");
    git(root, ["add", "src/later.ts"]);
    await expect(readSafeGitLayeredRepositoryChangeContentV1(
      executor,
      head,
      changeV1("staged", "deleted", "src/later.ts"),
      { maxBytes: 1_024 },
    )).rejects.toMatchObject({ code: "change_mismatch" });
  });

  it("ignores unsupported sibling entries but rejects the requested entry", async () => {
    const root = initializeRepository({ "src/layer.ts": "head\n" });
    symlinkSync("src/layer.ts", join(root, "sibling-link"));
    const head = commitAll(root, "add sibling symlink");

    await expect(readSafeGitLayeredRepositoryChangeContentV1(
      repositoryExecutorV1(root),
      head,
      changeV1("committed"),
      { maxBytes: 1_024 },
    )).resolves.toMatchObject({ status: "content", path: "src/layer.ts" });

    writeRepositoryFile(root, "src/layer.ts", "index\n");
    git(root, ["add", "src/layer.ts"]);
    await expect(readSafeGitLayeredRepositoryChangeContentV1(
      repositoryExecutorV1(root),
      head,
      changeV1("staged"),
      {
        maxBytes: 1_024,
        expectedContentDigest: contentDigestV1("index\n"),
      },
    )).resolves.toMatchObject({ status: "content", path: "src/layer.ts" });

    await expect(readSafeGitLayeredRepositoryChangeContentV1(
      repositoryExecutorV1(root),
      head,
      changeV1("committed", "added", "sibling-link"),
      { maxBytes: 1_024 },
    )).rejects.toMatchObject({ code: "unsupported_entry_type" });
  });

  it("enforces shared metadata, blob, and command budgets", async () => {
    const root = initializeRepository({ "src/layer.ts": "head-content\n" });
    const head = git(root, ["rev-parse", "HEAD"]);
    const commandExecutor = repositoryExecutorV1(root);
    const commandSession = createSafeGitLayeredContentReadSessionV1(
      commandExecutor,
      { maxMetadataBytes: 1_024 * 1_024, maxBlobBytes: 1_024, maxCommands: 2 },
    );
    await expect(readSafeGitLayeredRepositoryChangeContentV1(
      commandExecutor,
      head,
      changeV1("committed"),
      { maxBytes: 1_024, session: commandSession },
    )).rejects.toMatchObject({ code: "budget_exceeded" });

    const metadataExecutor = repositoryExecutorV1(root);
    const metadataSession = createSafeGitLayeredContentReadSessionV1(
      metadataExecutor,
      { maxMetadataBytes: 8, maxBlobBytes: 1_024, maxCommands: 20 },
    );
    await expect(readSafeGitLayeredRepositoryChangeContentV1(
      metadataExecutor,
      head,
      changeV1("committed"),
      { maxBytes: 1_024, session: metadataSession },
    )).rejects.toMatchObject({ code: "budget_exceeded" });

    const blobExecutor = repositoryExecutorV1(root);
    const blobSession = createSafeGitLayeredContentReadSessionV1(
      blobExecutor,
      {
        maxMetadataBytes: 1_024 * 1_024,
        maxBlobBytes: 4,
        maxCommands: 20,
      },
    );
    await expect(readSafeGitLayeredRepositoryChangeContentV1(
      blobExecutor,
      head,
      changeV1("committed"),
      { maxBytes: 1_024, session: blobSession },
    )).rejects.toMatchObject({ code: "budget_exceeded" });
  });
});
