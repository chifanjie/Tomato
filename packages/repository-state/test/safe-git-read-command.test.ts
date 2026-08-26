import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { executeGit } from "../src/git.js";
import { getRepositorySnapshotDetailed } from "../src/snapshot.js";
import {
  SafeGitReadCommandShapeErrorV1,
  classifySafeGitReadCommandV1,
  type SafeGitReadCommandV1,
  type SafeGitReadRequestV1,
} from "../src/safe-git-read-command.js";

const BASELINE = "a".repeat(40);
const HEAD = "b".repeat(40);

function testOnlyArgumentsV1(request: SafeGitReadRequestV1): string[] {
  switch (request.profile) {
    case "rev_parse_show_toplevel_v1":
      return ["rev-parse", "--show-toplevel"];
    case "rev_parse_absolute_git_dir_v1":
      return ["rev-parse", "--absolute-git-dir"];
    case "rev_parse_absolute_common_git_dir_v1":
      return ["rev-parse", "--path-format=absolute", "--git-common-dir"];
    case "status_porcelain_v2_v1":
      return [
        "status",
        "--porcelain=v2",
        "--branch",
        "-z",
        "--untracked-files=all",
        "--ignore-submodules=none",
      ];
    case "rev_parse_head_commit_v1":
      return ["rev-parse", "--verify", "HEAD^{commit}"];
    case "symbolic_head_v1":
      return ["symbolic-ref", "--quiet", "--short", "HEAD"];
    case "ls_files_stage_v1":
      return ["ls-files", "--stage", "-z"];
    case "rev_parse_baseline_commit_v1":
      return [
        "rev-parse",
        "--verify",
        "--end-of-options",
        `${request.revision}^{commit}`,
      ];
    case "merge_base_v1":
      return ["merge-base", request.baselineCommit, request.headCommit];
    case "rev_list_ahead_behind_v1":
      return [
        "rev-list",
        "--left-right",
        "--count",
        `${request.baselineCommit}...${request.headCommit}`,
      ];
    case "diff_committed_name_status_v1":
      return [
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--name-status",
        "-z",
        "--no-renames",
        `${request.baselineCommit}..${request.headCommit}`,
        "--",
      ];
    case "diff_staged_name_status_v1":
      return [
        "diff",
        "--cached",
        "--no-ext-diff",
        "--no-textconv",
        "--name-status",
        "-z",
        "--no-renames",
        request.headCommit,
        "--",
      ];
    case "cat_file_object_v1":
      return ["cat-file", "-p", request.objectId];
    case "cat_file_type_v1":
      return ["cat-file", "-t", "--", request.objectId];
    case "ls_ignore_files_v1":
      return [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
        "--",
        ".gitignore",
        ":(glob)**/.gitignore",
      ];
    case "config_global_excludes_file_v1":
      return ["config", "--path", "--get", "core.excludesfile"];
  }
}

describe("fixed SafeGit read command profile", () => {
  it.each([
    [["rev-parse", "--show-toplevel"], [0], "rev_parse_show_toplevel_v1"],
    [["rev-parse", "--absolute-git-dir"], [0], "rev_parse_absolute_git_dir_v1"],
    [
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      [0],
      "rev_parse_absolute_common_git_dir_v1",
    ],
    [
      [
        "status",
        "--porcelain=v2",
        "--branch",
        "-z",
        "--untracked-files=all",
        "--ignore-submodules=none",
      ],
      [0],
      "status_porcelain_v2_v1",
    ],
    [["rev-parse", "--verify", "HEAD^{commit}"], [0], "rev_parse_head_commit_v1"],
    [["symbolic-ref", "--quiet", "--short", "HEAD"], [0, 1], "symbolic_head_v1"],
    [["ls-files", "--stage", "-z"], [0], "ls_files_stage_v1"],
    [
      ["rev-parse", "--verify", "--end-of-options", "main^{commit}"],
      [0],
      "rev_parse_baseline_commit_v1",
    ],
    [["merge-base", BASELINE, HEAD], [0], "merge_base_v1"],
    [
      ["rev-list", "--left-right", "--count", `${BASELINE}...${HEAD}`],
      [0],
      "rev_list_ahead_behind_v1",
    ],
    [
      [
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--name-status",
        "-z",
        "--no-renames",
        `${BASELINE}..${HEAD}`,
        "--",
      ],
      [0],
      "diff_committed_name_status_v1",
    ],
    [
      [
        "diff",
        "--cached",
        "--no-ext-diff",
        "--no-textconv",
        "--name-status",
        "-z",
        "--no-renames",
        HEAD,
        "--",
      ],
      [0],
      "diff_staged_name_status_v1",
    ],
    [["cat-file", "-p", HEAD], [0], "cat_file_object_v1"],
    [["cat-file", "-t", "--", HEAD], [0], "cat_file_type_v1"],
    [
      [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
        "--",
        ".gitignore",
        ":(glob)**/.gitignore",
      ],
      [0],
      "ls_ignore_files_v1",
    ],
    [
      ["config", "--path", "--get", "core.excludesfile"],
      [0, 1],
      "config_global_excludes_file_v1",
    ],
  ] as const)("maps %j to %s", (args, exitCodes, profile) => {
    const command = classifySafeGitReadCommandV1(args, exitCodes);
    expect(command.request.profile).toBe(profile);
    expect(command.stdoutLimitBytes).toBeGreaterThan(0);
    expect(command.stderrLimitBytes).toBe(64 * 1_024);
    expect(Object.isFrozen(command)).toBe(true);
    expect(Object.isFrozen(command.request)).toBe(true);
  });

  it.each([
    [["--version"], [0]],
    [["status", "--porcelain"], [0]],
    [["cat-file", "-p", "HEAD"], [0]],
    [["cat-file", "-p", `${HEAD}\0secret`], [0]],
    [["rev-parse", "--verify", "--end-of-options", "-main^{commit}"], [0]],
    [["symbolic-ref", "--quiet", "--short", "HEAD"], [0]],
    [["config", "--path", "--get", "core.excludesfile"], [0]],
    [["submodule", "status", "--recursive"], [0, 1]],
    [["submodule", "status", "--recursive", "--jobs=8"], [0, 1]],
  ] as const)("rejects argv/exit-code shape %j", (args, exitCodes) => {
    expect(() => classifySafeGitReadCommandV1(args, exitCodes)).toThrow(
      SafeGitReadCommandShapeErrorV1,
    );
  });

  it("routes the frozen DTO to SafeGit without cwd, PATH, environment, or raw argv", async () => {
    const seen: SafeGitReadCommandV1[] = [];
    const executor = {
      execute: vi.fn(async (command: SafeGitReadCommandV1) => {
        seen.push(command);
        return {
          stdout: Buffer.from(`${HEAD}\n`, "utf8"),
          stderr: Buffer.alloc(0),
          exitCode: 0,
        };
      }),
    };

    await expect(
      executeGit(["rev-parse", "--verify", "HEAD^{commit}"], {
        safeGitExecutor: executor,
        maxBufferBytes: 64 * 1_024 * 1_024,
      }),
    ).resolves.toMatchObject({ exitCode: 0, stdout: Buffer.from(`${HEAD}\n`) });
    expect(executor.execute).toHaveBeenCalledOnce();
    expect(seen).toEqual([
      expect.objectContaining({
        request: { profile: "rev_parse_head_commit_v1" },
      }),
    ]);
  });

  it("enforces the smaller of caller and frozen output caps", async () => {
    await expect(
      executeGit(["rev-parse", "--show-toplevel"], {
        safeGitExecutor: {
          execute: async () => ({
            stdout: Buffer.alloc(9),
            stderr: Buffer.alloc(0),
            exitCode: 0,
          }),
        },
        maxBufferBytes: 8,
      }),
    ).rejects.toMatchObject({ failureCode: "git_output_too_large" });
  });

  it("maps the complete snapshot pipeline through DTOs instead of ambient argv", async () => {
    const root = mkdtempSync(join(tmpdir(), "uc-safe-git-read-mapping-"));
    const profiles = new Set<string>();
    try {
      execFileSync("git", ["init", "--quiet", root], { stdio: "pipe" });
      mkdirSync(join(root, "src"));
      writeFileSync(join(root, "src", "base.ts"), "export const base = 1;\n");
      execFileSync("git", ["-C", root, "add", "--", "src/base.ts"], {
        stdio: "pipe",
      });
      execFileSync(
        "git",
        [
          "-C",
          root,
          "-c",
          "user.name=SafeGit Test",
          "-c",
          "user.email=safe-git@example.invalid",
          "commit",
          "--quiet",
          "-m",
          "base",
        ],
        { stdio: "pipe" },
      );
      writeFileSync(join(root, "src", "staged.ts"), "export const staged = 1;\n");
      execFileSync("git", ["-C", root, "add", "--", "src/staged.ts"], {
        stdio: "pipe",
      });
      const gitlinkObject = execFileSync(
        "git",
        ["-C", root, "rev-parse", "--verify", "HEAD^{commit}"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ).trim();
      execFileSync(
        "git",
        [
          "-C",
          root,
          "update-index",
          "--add",
          "--cacheinfo",
          `160000,${gitlinkObject},vendor/nested`,
        ],
        { stdio: "pipe" },
      );

      const capture = await getRepositorySnapshotDetailed(root, {
        safeGitExecutor: {
          execute: async (command) => {
            profiles.add(command.request.profile);
            const result = spawnSync(
              "/usr/bin/git",
              testOnlyArgumentsV1(command.request),
              {
                cwd: root,
                encoding: "buffer",
                env: {
                  GIT_CONFIG_GLOBAL: "/dev/null",
                  GIT_CONFIG_NOSYSTEM: "1",
                  GIT_OPTIONAL_LOCKS: "0",
                  GIT_TERMINAL_PROMPT: "0",
                  HOME: "/",
                  LANG: "C",
                  LC_ALL: "C",
                  PATH: "/usr/bin:/bin",
                },
                maxBuffer: command.stdoutLimitBytes,
              },
            );
            if (result.error !== undefined || result.status === null) {
              throw result.error ?? new Error("test-only Git process failed");
            }
            return {
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.status,
            };
          },
        },
      });

      expect(capture.snapshot.captureStatus).toBe("partial");
      expect(capture.snapshot.limitations).toContain(
        "recursive submodule content is outside the descriptor-bound snapshot boundary",
      );
      expect(capture.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "submodule_recursive_content_unknown",
          scope: "submodule",
        }),
      );
      expect(profiles).toEqual(
        new Set([
          "rev_parse_show_toplevel_v1",
          "rev_parse_absolute_git_dir_v1",
          "rev_parse_absolute_common_git_dir_v1",
          "status_porcelain_v2_v1",
          "rev_parse_head_commit_v1",
          "symbolic_head_v1",
          "ls_files_stage_v1",
          "rev_parse_baseline_commit_v1",
          "merge_base_v1",
          "rev_list_ahead_behind_v1",
          "diff_committed_name_status_v1",
          "diff_staged_name_status_v1",
          "cat_file_object_v1",
          "ls_ignore_files_v1",
          "config_global_excludes_file_v1",
        ]),
      );
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});
