import { execFile } from "node:child_process";
import { TextDecoder } from "node:util";
import {
  SafeGitReadCommandShapeErrorV1,
  classifySafeGitReadCommandV1,
  type SafeGitReadExecutorV1,
} from "./safe-git-read-command.js";

const FATAL_UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

export interface AmbientGitExecutionOptions {
  gitBinary: string;
  cwd: string;
  maxBufferBytes: number;
  /** Explicit child environment; omitted preserves the ambient process behavior. */
  environment?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}

export interface SafeGitExecutionOptions {
  readonly safeGitExecutor: SafeGitReadExecutorV1;
  readonly maxBufferBytes: number;
  readonly signal?: AbortSignal;
  readonly gitBinary?: never;
  readonly cwd?: never;
  readonly environment?: never;
}

export type GitExecutionOptions =
  | AmbientGitExecutionOptions
  | SafeGitExecutionOptions;

export interface GitCommandResult {
  stdout: Buffer;
  stderr: Buffer;
  exitCode: number;
}

export type GitFailureCode =
  | "git_unavailable"
  | "git_command_failed"
  | "git_command_aborted"
  | "git_output_too_large"
  | "git_output_invalid_utf8";

export class GitOutputDecodingError extends Error {
  readonly failureCode = "git_output_invalid_utf8" as const;

  constructor(cause: unknown) {
    super("Git output contains a path that is not valid UTF-8", { cause });
    this.name = "GitOutputDecodingError";
  }
}

export class GitCommandError extends Error {
  readonly failureCode: GitFailureCode;
  readonly gitArguments: readonly string[];
  readonly exitCode: number | undefined;

  constructor(
    message: string,
    options: {
      failureCode: GitFailureCode;
      gitArguments: readonly string[];
      exitCode?: number;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "GitCommandError";
    this.failureCode = options.failureCode;
    this.gitArguments = [...options.gitArguments];
    this.exitCode = options.exitCode;
  }
}

function classifyExecutionFailure(error: NodeJS.ErrnoException): GitFailureCode {
  if (error.code === "ENOENT") return "git_unavailable";
  if (error.code === "ABORT_ERR") return "git_command_aborted";
  if (error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
    return "git_output_too_large";
  }
  return "git_command_failed";
}

/**
 * Executes Git without a shell. Arguments are always passed as an argv array,
 * so repository names, refs and paths cannot become shell syntax.
 */
export function executeGit(
  args: readonly string[],
  options: GitExecutionOptions,
  acceptedExitCodes: readonly number[] = [0],
): Promise<GitCommandResult> {
  if ("safeGitExecutor" in options) {
    let command;
    try {
      command = classifySafeGitReadCommandV1(args, acceptedExitCodes);
    } catch (error) {
      return Promise.reject(
        new GitCommandError("Git command is outside the SafeGit profile", {
          failureCode: "git_command_failed",
          gitArguments: [],
          cause: error,
        }),
      );
    }
    if (options.maxBufferBytes <= 0) {
      return Promise.reject(
        new GitCommandError("Git output limit is invalid", {
          failureCode: "git_output_too_large",
          gitArguments: [],
        }),
      );
    }
    return options.safeGitExecutor
      .execute(command, {
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      })
      .then((result) => {
        const stdout = Buffer.from(result.stdout);
        const stderr = Buffer.from(result.stderr);
        const stdoutLimit = Math.min(
          options.maxBufferBytes,
          command.stdoutLimitBytes,
        );
        const stderrLimit = Math.min(
          options.maxBufferBytes,
          command.stderrLimitBytes,
        );
        if (stdout.length > stdoutLimit || stderr.length > stderrLimit) {
          throw new GitCommandError("Git output exceeded the fixed limit", {
            failureCode: "git_output_too_large",
            gitArguments: [],
            exitCode: result.exitCode,
          });
        }
        if (!command.acceptedExitCodes.includes(result.exitCode)) {
          throw new GitCommandError("SafeGit command failed", {
            failureCode: "git_command_failed",
            gitArguments: [],
            exitCode: result.exitCode,
          });
        }
        return { stdout, stderr, exitCode: result.exitCode };
      })
      .catch((error: unknown) => {
        if (error instanceof GitCommandError) throw error;
        throw new GitCommandError("SafeGit command failed", {
          failureCode:
            options.signal?.aborted === true
              ? "git_command_aborted"
              : "git_command_failed",
          gitArguments: [],
          cause: error,
        });
      });
  }
  return new Promise((resolve, reject) => {
    execFile(
      options.gitBinary,
      [...args],
      {
        cwd: options.cwd,
        encoding: "buffer",
        env: {
          ...(options.environment ?? process.env),
          GIT_TERMINAL_PROMPT: "0",
          LC_ALL: "C",
        },
        maxBuffer: options.maxBufferBytes,
        windowsHide: true,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      },
      (error, stdout, stderr) => {
        const stdoutBuffer = Buffer.isBuffer(stdout)
          ? stdout
          : Buffer.from(stdout ?? "");
        const stderrBuffer = Buffer.isBuffer(stderr)
          ? stderr
          : Buffer.from(stderr ?? "");

        if (error === null) {
          resolve({ stdout: stdoutBuffer, stderr: stderrBuffer, exitCode: 0 });
          return;
        }

        const executionError = error as NodeJS.ErrnoException & {
          code?: string | number;
        };
        const numericExitCode =
          typeof executionError.code === "number"
            ? executionError.code
            : undefined;
        if (
          numericExitCode !== undefined &&
          acceptedExitCodes.includes(numericExitCode)
        ) {
          resolve({
            stdout: stdoutBuffer,
            stderr: stderrBuffer,
            exitCode: numericExitCode,
          });
          return;
        }

        const failureCode = classifyExecutionFailure(executionError);
        reject(
          new GitCommandError(
            failureCode === "git_unavailable"
              ? "Git executable is unavailable"
              : `Git command failed (${failureCode})`,
            {
              failureCode,
              gitArguments: args,
              ...(numericExitCode === undefined
                ? {}
                : { exitCode: numericExitCode }),
              cause: error,
            },
          ),
        );
      },
    );
  });
}

export { SafeGitReadCommandShapeErrorV1 };

export function decodeGitText(output: Buffer): string {
  try {
    return FATAL_UTF8_DECODER.decode(output).replace(/\r?\n$/u, "");
  } catch (error) {
    throw new GitOutputDecodingError(error);
  }
}

export function splitNul(output: Buffer): string[] {
  if (output.length === 0) return [];
  let decoded: string;
  try {
    decoded = FATAL_UTF8_DECODER.decode(output);
  } catch (error) {
    throw new GitOutputDecodingError(error);
  }
  const fields = decoded.split("\0");
  if (fields.at(-1) === "") fields.pop();
  return fields;
}
