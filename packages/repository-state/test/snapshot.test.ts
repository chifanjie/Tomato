import { createHash } from "node:crypto";
import {
  mkdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RepositorySnapshotV1Schema } from "@understand-code/contracts";
import {
  __testing,
  getRepositorySnapshot,
  getRepositorySnapshotDetailed,
  isSensitiveRepositoryPath,
  readStableRepositoryFile,
} from "../src/snapshot.js";
import {
  cleanupTemporaryDirectories,
  commitAll,
  git,
  initializeRepository,
  temporaryDirectory,
  writeRepositoryFile,
} from "./helpers.js";

afterEach(cleanupTemporaryDirectories);

function digest(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

describe("getRepositorySnapshot", () => {
  it.each([
    [".env", true],
    [".ENV.production", true],
    [".env.example", false],
    ["config/credentials.json", true],
    [".git/config", true],
    ["config/application_default_credentials.json", true],
    ["backups/id_rsa.bak", true],
    ["backups/id_ed25519.old", true],
    ["secrets/token.txt", true],
    ["src\\.ssh\\id_ed25519", true],
    ["certificates/private.pem", true],
    ["src/secret-service.ts", false],
    ["src/environment.ts", false],
  ] as const)("classifies sensitive repository path %s", (path, expected) => {
    expect(isSensitiveRepositoryPath(path)).toBe(expected);
  });

  it("returns a contract-valid, deterministic clean snapshot", async () => {
    const root = initializeRepository();
    const first = await getRepositorySnapshot(root, {
      now: () => new Date("2026-07-28T01:00:00Z"),
    });
    const second = await getRepositorySnapshot(root, {
      now: () => new Date("2026-07-28T02:00:00Z"),
    });

    expect(RepositorySnapshotV1Schema.parse(first)).toEqual(first);
    expect(first.captureStatus).toBe("complete");
    expect(first.changes).toEqual([]);
    expect(second.snapshotId).toBe(first.snapshotId);
    expect(second.indexDigest).toBe(first.indexDigest);
    expect(second.worktreeDigest).toBe(first.worktreeDigest);
    expect(second.createdAt).not.toBe(first.createdAt);
  });

  it("captures baseline..HEAD committed changes", async () => {
    const root = initializeRepository();
    const baseline = git(root, ["rev-parse", "HEAD"]);
    writeRepositoryFile(root, "src/main.ts", "export const value = 2;\n");
    commitAll(root, "change value");

    const snapshot = await getRepositorySnapshot(root, {
      baselineRef: baseline,
    });
    expect(snapshot.captureStatus).toBe("complete");
    expect(snapshot.baseCommit).toBe(baseline);
    expect(snapshot.changes).toEqual([
      expect.objectContaining({
        source: "committed",
        kind: "modified",
        path: "src/main.ts",
      }),
    ]);
  });

  it("separates staged Index bytes from later Worktree bytes", async () => {
    const root = initializeRepository({
      "src/state.ts": "export const state = 'base';\n",
    });
    const staged = "export const state = 'staged';\n";
    const worktree = "export const state = 'worktree';\n";
    writeRepositoryFile(root, "src/state.ts", staged);
    git(root, ["add", "--", "src/state.ts"]);
    writeRepositoryFile(root, "src/state.ts", worktree);

    const snapshot = await getRepositorySnapshot(root);
    const stagedChange = snapshot.changes.find(
      (change) => change.source === "staged",
    );
    const unstagedChange = snapshot.changes.find(
      (change) => change.source === "unstaged",
    );
    expect(stagedChange).toMatchObject({
      kind: "modified",
      path: "src/state.ts",
      contentDigest: digest(staged),
    });
    expect(unstagedChange).toMatchObject({
      kind: "modified",
      path: "src/state.ts",
      contentDigest: digest(worktree),
    });
  });

  it("captures unstaged and untracked paths with spaces and Chinese text", async () => {
    const root = initializeRepository();
    writeRepositoryFile(root, "src/main.ts", "export const value = 3;\n");
    writeRepositoryFile(root, "资料/新 文件.ts", "export const 新值 = 1;\n");

    const snapshot = await getRepositorySnapshot(root);
    expect(snapshot.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "unstaged",
          kind: "modified",
          path: "src/main.ts",
        }),
        expect.objectContaining({
          source: "untracked",
          kind: "added",
          path: "资料/新 文件.ts",
        }),
      ]),
    );
  });

  it("parses the second NUL path of a staged rename", async () => {
    const root = initializeRepository({ "src/old name.ts": "export {};\n" });
    git(root, ["mv", "--", "src/old name.ts", "src/新 name.ts"]);

    const snapshot = await getRepositorySnapshot(root);
    expect(snapshot.changes).toEqual([
      expect.objectContaining({
        source: "staged",
        kind: "renamed",
        oldPath: "src/old name.ts",
        path: "src/新 name.ts",
      }),
    ]);
  });

  it("detects a staged copy without misclassifying it as an add", async () => {
    const root = initializeRepository({ "src/source.ts": "export {};\n" });
    writeRepositoryFile(root, "src/copied.ts", "export {};\n");
    git(root, ["add", "--", "src/copied.ts"]);

    const snapshot = await getRepositorySnapshot(root);
    expect(snapshot.changes).toEqual([
      expect.objectContaining({
        source: "staged",
        kind: "copied",
        oldPath: "src/source.ts",
        path: "src/copied.ts",
      }),
    ]);
  });

  it("captures staged deletes", async () => {
    const root = initializeRepository({ "src/remove.ts": "export {};\n" });
    git(root, ["rm", "--", "src/remove.ts"]);

    const snapshot = await getRepositorySnapshot(root);
    expect(snapshot.changes).toEqual([
      expect.objectContaining({
        source: "staged",
        kind: "deleted",
        path: "src/remove.ts",
      }),
    ]);
  });

  it("captures a regular-file to symlink type change", async () => {
    const root = initializeRepository({
      "src/target.ts": "export {};\n",
      "src/link.ts": "regular\n",
    });
    rmSync(join(root, "src/link.ts"));
    symlinkSync("target.ts", join(root, "src/link.ts"));
    git(root, ["add", "--", "src/link.ts"]);

    const snapshot = await getRepositorySnapshot(root);
    expect(snapshot.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "staged",
          kind: "type_changed",
          path: "src/link.ts",
        }),
      ]),
    );
  });

  it("reports unresolved conflicts instead of a clean worktree", async () => {
    const root = initializeRepository({ "conflict.txt": "base\n" });
    git(root, ["checkout", "-q", "-b", "other"]);
    writeRepositoryFile(root, "conflict.txt", "other\n");
    commitAll(root, "other change");
    git(root, ["checkout", "-q", "main"]);
    writeRepositoryFile(root, "conflict.txt", "main\n");
    commitAll(root, "main change");
    git(root, ["merge", "--no-edit", "other"], { allowFailure: true });

    const capture = await getRepositorySnapshotDetailed(root);
    expect(capture.snapshot.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "conflict",
          path: "conflict.txt",
        }),
      ]),
    );
    expect(capture.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "merge_conflict" }),
      ]),
    );
  });

  it("distinguishes detached HEAD", async () => {
    const root = initializeRepository();
    git(root, ["checkout", "-q", "--detach", "HEAD"]);

    const capture = await getRepositorySnapshotDetailed(root);
    expect(capture.snapshot.captureStatus).toBe("complete");
    expect(capture.snapshot.branch).toBeUndefined();
    expect(capture.git.detached).toBe(true);
    expect(capture.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "detached_head" }),
      ]),
    );
  });

  it("uses one repository identity and distinct worktree identities", async () => {
    const root = initializeRepository();
    const linked = join(dirname(root), "linked-worktree");
    git(root, ["worktree", "add", "-q", "--detach", linked, "HEAD"]);

    const primaryCapture = await getRepositorySnapshotDetailed(root);
    const linkedCapture = await getRepositorySnapshotDetailed(linked);
    expect(linkedCapture.git.linkedWorktree).toBe(true);
    expect(linkedCapture.snapshot.repositoryId).toBe(
      primaryCapture.snapshot.repositoryId,
    );
    expect(linkedCapture.snapshot.worktreeId).not.toBe(
      primaryCapture.snapshot.worktreeId,
    );
  });

  it("diagnoses a dirty submodule at the gitlink boundary", async () => {
    const child = initializeRepository({ "child.txt": "base\n" });
    const parent = initializeRepository({ "parent.txt": "base\n" });
    git(parent, [
      "-c",
      "protocol.file.allow=always",
      "submodule",
      "add",
      "-q",
      child,
      "vendor/child",
    ]);
    commitAll(parent, "add submodule");
    writeRepositoryFile(
      join(parent, "vendor/child"),
      "child.txt",
      "dirty\n",
    );

    const capture = await getRepositorySnapshotDetailed(parent);
    expect(capture.snapshot.captureStatus).toBe("partial");
    expect(capture.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "submodule_dirty" }),
      ]),
    );
  });

  it("filters managed .understand-code artifacts from state identity", async () => {
    const root = initializeRepository();
    const before = await getRepositorySnapshot(root);
    writeRepositoryFile(
      root,
      ".understand-code/tasks/task-1/evidence.json",
      "{}\n",
    );
    const after = await getRepositorySnapshot(root);

    expect(after.captureStatus).toBe("complete");
    expect(after.changes).toEqual([]);
    expect(after.snapshotId).toBe(before.snapshotId);
    expect(after.untrackedDigest).toBe(before.untrackedDigest);
  });

  it("reports an untracked embedded repository as a normalized boundary change", async () => {
    const root = initializeRepository();
    const embedded = join(root, "site");
    mkdirSync(embedded);
    git(embedded, ["init", "-q", "-b", "main"]);
    writeFileSync(join(embedded, "index.html"), "<h1>embedded</h1>\n");

    const capture = await getRepositorySnapshotDetailed(root);
    expect(capture.snapshot.captureStatus).toBe("partial");
    expect(capture.snapshot.changes).toEqual([
      expect.objectContaining({
        source: "untracked",
        kind: "added",
        path: "site",
      }),
    ]);
    expect(capture.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "untracked_directory_boundary" }),
      ]),
    );
  });

  it("reports sensitive untracked paths without reading them into content digests", async () => {
    const root = initializeRepository();
    writeRepositoryFile(root, ".env", "TOKEN=top-secret\n");
    writeRepositoryFile(
      root,
      "config/credentials.json",
      '{"password":"top-secret"}\n',
    );
    writeRepositoryFile(root, ".env.example", "TOKEN=replace-me\n");

    const capture = await getRepositorySnapshotDetailed(root);
    const byPath = new Map(
      capture.snapshot.changes.map((change) => [change.path, change]),
    );
    expect(capture.snapshot.captureStatus).toBe("partial");
    expect(byPath.get(".env")?.contentDigest).toBeUndefined();
    expect(
      byPath.get("config/credentials.json")?.contentDigest,
    ).toBeUndefined();
    expect(byPath.get(".env.example")?.contentDigest).toMatch(
      /^sha256:[0-9a-f]{64}$/u,
    );
    expect(
      capture.diagnostics.filter(
        (item) => item.code === "sensitive_path_content_filtered",
      ),
    ).toHaveLength(2);
  });

  it("marks the capture partial when file bytes change without changing porcelain state", async () => {
    const root = initializeRepository();
    const repositoryPath = "race.bin";
    writeFileSync(
      join(root, repositoryPath),
      Buffer.alloc(2 * 1024 * 1024, 0x61),
    );
    let mutated = false;

    const capture = await __testing.captureWithFileHooks(
      root,
      {},
      (path) =>
        path === repositoryPath
          ? {
              afterChunk: (chunkIndex) => {
                if (chunkIndex === 0 && !mutated) {
                  mutated = true;
                  writeFileSync(
                    join(root, repositoryPath),
                    Buffer.alloc(2 * 1024 * 1024, 0x62),
                  );
                }
              },
            }
          : undefined,
    );

    expect(mutated).toBe(true);
    expect(capture.snapshot.captureStatus).toBe("partial");
    expect(capture.snapshot.limitations.join(" ")).toContain(
      "changed during snapshot capture",
    );
    expect(capture.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "repository_path_changed_during_capture",
        }),
      ]),
    );
    expect(
      capture.snapshot.changes.find(
        (change) => change.path === repositoryPath,
      )?.contentDigest,
    ).toBeUndefined();
  });

  it.each([
    ["modified", "src/main.ts"],
    ["untracked", "src/new.ts"],
  ] as const)(
    "marks the capture partial when %s content changes after its stable read",
    async (_label, repositoryPath) => {
      const root = initializeRepository();
      const firstContent = "export const sampled = 1;\n";
      const finalContent = "export const sampled = 2;\n";
      writeRepositoryFile(root, repositoryPath, firstContent);

      const capture = await __testing.captureWithHooks(root, {}, {
        beforeFinalValidation: () => {
          writeRepositoryFile(root, repositoryPath, finalContent);
        },
      });

      expect(capture.snapshot.captureStatus).toBe("partial");
      expect(capture.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "repository_worktree_changed_during_capture",
          }),
        ]),
      );
      expect(
        capture.snapshot.changes.find(
          (change) => change.path === repositoryPath,
        )?.contentDigest,
      ).toBe(digest(firstContent));
    },
  );

  it("marks the capture partial when HEAD changes after the initial sample", async () => {
    const root = initializeRepository();
    const initialHead = git(root, ["rev-parse", "HEAD"]);

    const capture = await __testing.captureWithHooks(root, {}, {
      beforeFinalValidation: () => {
        writeRepositoryFile(root, "src/main.ts", "export const value = 2;\n");
        commitAll(root, "advance head during capture");
      },
    });

    expect(capture.snapshot.headCommit).toBe(initialHead);
    expect(capture.snapshot.captureStatus).toBe("partial");
    expect(capture.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "repository_head_changed_during_capture",
        }),
      ]),
    );
  });

  it("marks the capture partial when the Index changes after the initial sample", async () => {
    const root = initializeRepository();
    writeRepositoryFile(root, "src/main.ts", "export const value = 2;\n");
    git(root, ["add", "--", "src/main.ts"]);

    const capture = await __testing.captureWithHooks(root, {}, {
      beforeFinalValidation: () => {
        writeRepositoryFile(root, "src/main.ts", "export const value = 3;\n");
        git(root, ["add", "--", "src/main.ts"]);
      },
    });

    expect(capture.snapshot.captureStatus).toBe("partial");
    expect(capture.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "repository_index_changed_during_capture",
        }),
      ]),
    );
  });

  it("marks the capture partial when ignore configuration changes after sampling", async () => {
    const root = initializeRepository();
    const excludeRoot = temporaryDirectory("repository-ignore");
    const excludesPath = join(excludeRoot, "global-excludes");
    writeFileSync(excludesPath, "*.first\n");
    git(root, ["config", "core.excludesFile", excludesPath]);

    const capture = await __testing.captureWithHooks(root, {}, {
      beforeFinalValidation: () => {
        writeFileSync(excludesPath, "*.other\n");
      },
    });

    expect(capture.snapshot.captureStatus).toBe("partial");
    expect(capture.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "repository_ignore_changed_during_capture",
        }),
      ]),
    );
  });

  it("does not consume replacement symlink content after resolving a repository file", async () => {
    const root = initializeRepository();
    const outside = temporaryDirectory("outside-content");
    const repositoryPath = "swap.txt";
    const requestedPath = join(root, repositoryPath);
    const outsidePath = join(outside, "outside.txt");
    writeFileSync(requestedPath, "inside\n");
    writeFileSync(outsidePath, "must-not-be-read\n");
    let consumedChunks = 0;

    await expect(
      __testing.hashStableRepositoryFile(
        root,
        repositoryPath,
        () => {
          consumedChunks += 1;
        },
        {
          afterResolve: () => {
            rmSync(requestedPath);
            symlinkSync(outsidePath, requestedPath);
          },
        },
      ),
    ).rejects.toThrow();
    expect(consumedChunks).toBe(0);
  });

  it("rejects an intermediate parent replaced by a symlink before descriptor open", async () => {
    const root = realpathSync(initializeRepository());
    const outside = temporaryDirectory("outside-parent-swap");
    const repositoryPath = "nested/swap.txt";
    const parentPath = join(root, "nested");
    const displacedParentPath = join(root, "nested-original");
    mkdirSync(parentPath);
    writeFileSync(join(parentPath, "swap.txt"), "inside\n");
    writeFileSync(join(outside, "swap.txt"), "must-not-be-returned\n");
    let swapped = false;

    let failure: unknown;
    try {
      await readStableRepositoryFile(root, repositoryPath, 1024, {
        afterResolve: () => {
          rmSync(displacedParentPath, { recursive: true, force: true });
          // Keep the original file available under a different name while the
          // requested parent atomically changes identity and becomes a link.
          renameSync(parentPath, displacedParentPath);
          symlinkSync(outside, parentPath, "dir");
          swapped = true;
        },
      });
    } catch (error) {
      failure = error;
    }
    expect(swapped).toBe(true);
    expect(failure).toMatchObject({
      code: expect.stringMatching(/^(?:changed_during_read|outside_repository)$/u),
    });
  });

  it("makes control-character paths explicit partial limitations without parser desync", async () => {
    const root = initializeRepository();
    writeFileSync(join(root, "tab\tname.ts"), "tab\n");
    writeFileSync(join(root, "line\nname.ts"), "line\n");
    writeRepositoryFile(root, "中文 valid.ts", "valid\n");

    const first = await getRepositorySnapshotDetailed(root);
    expect(first.snapshot.captureStatus).toBe("partial");
    expect(first.snapshot.changes).toEqual([
      expect.objectContaining({
        source: "untracked",
        path: "中文 valid.ts",
      }),
    ]);
    expect(first.snapshot.limitations).toHaveLength(2);
    expect(first.diagnostics.filter((item) => item.code === "unsafe_git_path"))
      .toHaveLength(2);
    expect(RepositorySnapshotV1Schema.safeParse(first.snapshot).success).toBe(
      true,
    );

    writeFileSync(join(root, "line\nname.ts"), "changed line content\n");
    const second = await getRepositorySnapshotDetailed(root);
    expect(second.snapshot.untrackedDigest).not.toBe(
      first.snapshot.untrackedDigest,
    );
    expect(second.snapshot.snapshotId).not.toBe(first.snapshot.snapshotId);
  });

  it.skipIf(process.platform !== "linux")(
    "fails closed for a raw non-UTF-8 Git path",
    async () => {
      const root = initializeRepository();
      const invalidPath = Buffer.concat([
        Buffer.from(`${root}/invalid-`),
        Buffer.from([0xff]),
        Buffer.from(".ts"),
      ]);
      writeFileSync(invalidPath, "invalid byte path\n");

      const capture = await getRepositorySnapshotDetailed(root);
      expect(capture.snapshot.captureStatus).toBe("error");
      expect(capture.snapshot.limitations.join(" ")).toContain(
        "git_output_invalid_utf8",
      );
      expect(capture.diagnostics).toEqual([
        expect.objectContaining({ code: "git_output_invalid_utf8" }),
      ]);
    },
  );

  it("returns error, not clean, when Git is unavailable", async () => {
    const root = initializeRepository();
    const capture = await getRepositorySnapshotDetailed(root, {
      gitBinary: `missing-git-${basename(temporaryDirectory())}`,
    });

    expect(capture.snapshot.captureStatus).toBe("error");
    expect(capture.snapshot.limitations.join(" ")).toContain("git_unavailable");
    expect(capture.diagnostics).toEqual([
      expect.objectContaining({ code: "git_unavailable", severity: "error" }),
    ]);
    expect(RepositorySnapshotV1Schema.safeParse(capture.snapshot).success).toBe(
      true,
    );
  });

  it("returns error, not clean, for a non-repository", async () => {
    const root = temporaryDirectory("not-a-repository");
    const capture = await getRepositorySnapshotDetailed(root);
    expect(capture.snapshot.captureStatus).toBe("error");
    expect(capture.diagnostics[0]?.code).toBe("git_command_failed");
  });

  it("explicitly rejects an initial repository without HEAD", async () => {
    const root = temporaryDirectory("unborn-repository");
    git(root, ["init", "-q", "-b", "main"]);
    const capture = await getRepositorySnapshotDetailed(root);
    expect(capture.snapshot.captureStatus).toBe("error");
    expect(capture.snapshot.headCommit).toBeUndefined();
  });
});
