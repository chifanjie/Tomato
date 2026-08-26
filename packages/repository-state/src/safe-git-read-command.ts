const OID_V1 = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const MAX_REVISION_BYTES_V1 = 1_024;

export type SafeGitReadOutputFramingV1 = "binary" | "nul_records" | "text";

export type SafeGitReadRequestV1 =
  | Readonly<{ readonly profile: "rev_parse_show_toplevel_v1" }>
  | Readonly<{ readonly profile: "rev_parse_absolute_git_dir_v1" }>
  | Readonly<{ readonly profile: "rev_parse_absolute_common_git_dir_v1" }>
  | Readonly<{ readonly profile: "status_porcelain_v2_v1" }>
  | Readonly<{ readonly profile: "rev_parse_head_commit_v1" }>
  | Readonly<{ readonly profile: "symbolic_head_v1" }>
  | Readonly<{ readonly profile: "ls_files_stage_v1" }>
  | Readonly<{
      readonly profile: "rev_parse_baseline_commit_v1";
      readonly revision: string;
    }>
  | Readonly<{
      readonly profile: "merge_base_v1";
      readonly baselineCommit: string;
      readonly headCommit: string;
    }>
  | Readonly<{
      readonly profile: "rev_list_ahead_behind_v1";
      readonly baselineCommit: string;
      readonly headCommit: string;
    }>
  | Readonly<{
      readonly profile: "diff_committed_name_status_v1";
      readonly baselineCommit: string;
      readonly headCommit: string;
    }>
  | Readonly<{
      readonly profile: "diff_staged_name_status_v1";
      readonly headCommit: string;
    }>
  | Readonly<{
      readonly profile: "cat_file_object_v1";
      readonly objectId: string;
    }>
  | Readonly<{
      readonly profile: "cat_file_type_v1";
      readonly objectId: string;
    }>
  | Readonly<{ readonly profile: "ls_ignore_files_v1" }>
  | Readonly<{ readonly profile: "config_global_excludes_file_v1" }>;

export interface SafeGitReadCommandV1 {
  readonly request: SafeGitReadRequestV1;
  readonly acceptedExitCodes: readonly number[];
  readonly stdoutLimitBytes: number;
  readonly stderrLimitBytes: number;
  readonly outputFraming: SafeGitReadOutputFramingV1;
}

export interface SafeGitReadExecutionResultV1 {
  readonly stdout: Uint8Array;
  readonly stderr: Uint8Array;
  readonly exitCode: number;
}

export interface SafeGitReadExecutorV1 {
  execute(
    command: SafeGitReadCommandV1,
    options?: Readonly<{ readonly signal?: AbortSignal }>,
  ): Promise<SafeGitReadExecutionResultV1>;
}

export class SafeGitReadCommandShapeErrorV1 extends Error {
  readonly code = "ERR_REPOSITORY_STATE_SAFE_GIT_COMMAND_SHAPE" as const;

  constructor() {
    super("Git command is outside the fixed SafeGit read profile");
    this.name = "SafeGitReadCommandShapeErrorV1";
  }
}

const TEXT_PATH_LIMIT_V1 = 4 * 1_024;
const TEXT_SCALAR_LIMIT_V1 = 128;
const RECORD_OUTPUT_LIMIT_V1 = 64 * 1_024 * 1_024;
const STDERR_LIMIT_V1 = 64 * 1_024;

function sameArgumentsV1(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function sameExitCodesV1(
  actual: readonly number[],
  expected: readonly number[],
): boolean {
  return sameArgumentsV1(
    actual.map(String),
    expected.map(String),
  );
}

function requireOidV1(value: string | undefined): string {
  if (value === undefined || !OID_V1.test(value)) {
    throw new SafeGitReadCommandShapeErrorV1();
  }
  return value;
}

function requireRevisionV1(value: string | undefined): string {
  if (
    value === undefined ||
    value.length === 0 ||
    Buffer.byteLength(value, "utf8") > MAX_REVISION_BYTES_V1 ||
    value.startsWith("-") ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new SafeGitReadCommandShapeErrorV1();
  }
  return value;
}

function commandV1(
  request: SafeGitReadRequestV1,
  acceptedExitCodes: readonly number[],
  stdoutLimitBytes: number,
  outputFraming: SafeGitReadOutputFramingV1,
): SafeGitReadCommandV1 {
  return Object.freeze({
    request: Object.freeze(request),
    acceptedExitCodes: Object.freeze([...acceptedExitCodes]),
    stdoutLimitBytes,
    stderrLimitBytes: STDERR_LIMIT_V1,
    outputFraming,
  });
}

/**
 * Converts only the snapshot pipeline's frozen argv shapes into a native DTO.
 * Raw argv, cwd, PATH, environment, hooks, aliases, and arbitrary Git config
 * never cross the SafeGit executor boundary.
 */
export function classifySafeGitReadCommandV1(
  args: readonly string[],
  acceptedExitCodes: readonly number[] = [0],
): SafeGitReadCommandV1 {
  let command: SafeGitReadCommandV1 | undefined;

  if (sameArgumentsV1(args, ["rev-parse", "--show-toplevel"])) {
    command = commandV1(
      { profile: "rev_parse_show_toplevel_v1" },
      [0],
      TEXT_PATH_LIMIT_V1,
      "text",
    );
  } else if (sameArgumentsV1(args, ["rev-parse", "--absolute-git-dir"])) {
    command = commandV1(
      { profile: "rev_parse_absolute_git_dir_v1" },
      [0],
      TEXT_PATH_LIMIT_V1,
      "text",
    );
  } else if (
    sameArgumentsV1(args, [
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ])
  ) {
    command = commandV1(
      { profile: "rev_parse_absolute_common_git_dir_v1" },
      [0],
      TEXT_PATH_LIMIT_V1,
      "text",
    );
  } else if (
    sameArgumentsV1(args, [
      "status",
      "--porcelain=v2",
      "--branch",
      "-z",
      "--untracked-files=all",
      "--ignore-submodules=none",
    ])
  ) {
    command = commandV1(
      { profile: "status_porcelain_v2_v1" },
      [0],
      RECORD_OUTPUT_LIMIT_V1,
      "nul_records",
    );
  } else if (
    sameArgumentsV1(args, ["rev-parse", "--verify", "HEAD^{commit}"])
  ) {
    command = commandV1(
      { profile: "rev_parse_head_commit_v1" },
      [0],
      TEXT_SCALAR_LIMIT_V1,
      "text",
    );
  } else if (
    sameArgumentsV1(args, ["symbolic-ref", "--quiet", "--short", "HEAD"])
  ) {
    command = commandV1(
      { profile: "symbolic_head_v1" },
      [0, 1],
      TEXT_PATH_LIMIT_V1,
      "text",
    );
  } else if (
    sameArgumentsV1(args, ["ls-files", "--stage", "-z"])
  ) {
    command = commandV1(
      { profile: "ls_files_stage_v1" },
      [0],
      RECORD_OUTPUT_LIMIT_V1,
      "nul_records",
    );
  } else if (
    args.length === 4 &&
    args[0] === "rev-parse" &&
    args[1] === "--verify" &&
    args[2] === "--end-of-options" &&
    args[3]?.endsWith("^{commit}") === true
  ) {
    command = commandV1(
      {
        profile: "rev_parse_baseline_commit_v1",
        revision: requireRevisionV1(args[3].slice(0, -"^{commit}".length)),
      },
      [0],
      TEXT_SCALAR_LIMIT_V1,
      "text",
    );
  } else if (args.length === 3 && args[0] === "merge-base") {
    command = commandV1(
      {
        profile: "merge_base_v1",
        baselineCommit: requireOidV1(args[1]),
        headCommit: requireOidV1(args[2]),
      },
      [0],
      TEXT_SCALAR_LIMIT_V1,
      "text",
    );
  } else if (
    args.length === 4 &&
    args[0] === "rev-list" &&
    args[1] === "--left-right" &&
    args[2] === "--count"
  ) {
    const range = args[3]?.split("...");
    if (range?.length === 2) {
      command = commandV1(
        {
          profile: "rev_list_ahead_behind_v1",
          baselineCommit: requireOidV1(range[0]),
          headCommit: requireOidV1(range[1]),
        },
        [0],
        TEXT_SCALAR_LIMIT_V1,
        "text",
      );
    }
  } else if (
    args.length === 8 &&
    sameArgumentsV1(args.slice(0, 6), [
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      "--name-status",
      "-z",
      "--no-renames",
    ]) &&
    args[7] === "--"
  ) {
    const range = args[6]?.split("..");
    if (range?.length === 2) {
      command = commandV1(
        {
          profile: "diff_committed_name_status_v1",
          baselineCommit: requireOidV1(range[0]),
          headCommit: requireOidV1(range[1]),
        },
        [0],
        RECORD_OUTPUT_LIMIT_V1,
        "nul_records",
      );
    }
  } else if (
    args.length === 9 &&
    sameArgumentsV1(args.slice(0, 7), [
      "diff",
      "--cached",
      "--no-ext-diff",
      "--no-textconv",
      "--name-status",
      "-z",
      "--no-renames",
    ]) &&
    args[8] === "--"
  ) {
    command = commandV1(
      {
        profile: "diff_staged_name_status_v1",
        headCommit: requireOidV1(args[7]),
      },
      [0],
      RECORD_OUTPUT_LIMIT_V1,
      "nul_records",
    );
  } else if (
    args.length === 3 &&
    args[0] === "cat-file" &&
    args[1] === "-p"
  ) {
    command = commandV1(
      { profile: "cat_file_object_v1", objectId: requireOidV1(args[2]) },
      [0],
      RECORD_OUTPUT_LIMIT_V1,
      "binary",
    );
  } else if (
    args.length === 4 &&
    args[0] === "cat-file" &&
    args[1] === "-t" &&
    args[2] === "--"
  ) {
    command = commandV1(
      { profile: "cat_file_type_v1", objectId: requireOidV1(args[3]) },
      [0],
      128,
      "text",
    );
  } else if (
    sameArgumentsV1(args, [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ".gitignore",
      ":(glob)**/.gitignore",
    ])
  ) {
    command = commandV1(
      { profile: "ls_ignore_files_v1" },
      [0],
      RECORD_OUTPUT_LIMIT_V1,
      "nul_records",
    );
  } else if (
    sameArgumentsV1(args, [
      "config",
      "--path",
      "--get",
      "core.excludesfile",
    ])
  ) {
    command = commandV1(
      { profile: "config_global_excludes_file_v1" },
      [0, 1],
      TEXT_PATH_LIMIT_V1,
      "text",
    );
  }

  if (
    command === undefined ||
    !sameExitCodesV1(acceptedExitCodes, command.acceptedExitCodes)
  ) {
    throw new SafeGitReadCommandShapeErrorV1();
  }
  return command;
}
