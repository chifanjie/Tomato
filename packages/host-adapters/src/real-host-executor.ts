import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import {
  compileStep16ExpectedHostEventPlanV1,
  deriveStep16RealHostActionInputDigestV1,
  normalizeStep16RealHostJsonlTranscriptV1,
  type RealHostReceiptHostV1,
  type RealHostTranscriptReceiptV1,
  type Sha256DigestV1,
  type Step16ExpectedHostEventPlanV1,
} from "./real-host-receipts.js";
import type {
  Step16RealHostObservedCallInternalV1,
  Step16RealHostStreamObserverInternalV1,
} from "./step16-real-host-stream-observer-internal.js";

const MAX_STDOUT_BYTES_V1 = 32 * 1024 * 1024;
const MAX_STDERR_BYTES_V1 = 4 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS_V1 = 30 * 60 * 1_000;
const MAX_TIMEOUT_MS_V1 = 2_147_483_647;
const TERMINATION_GRACE_MS_V1 = 250;
const MAX_PATH_BYTES_V1 = 4_096;
const INJECTING_ENVIRONMENT_KEYS_V1 = new Set<string>([
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_COMMON_DIR",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_CONFIG",
  "GIT_EXEC_PATH",
  "NODE_OPTIONS",
  "NODE_PATH",
  "BUN_OPTIONS",
  "PYTHONPATH",
  "RUBYOPT",
  "PERL5OPT",
  "BASH_ENV",
  "ENV",
]);
const INJECTING_ENVIRONMENT_PREFIXES_V1 = Object.freeze([
  "LD_",
  "DYLD_",
  "DENO_",
  "GIT_CONFIG_",
] as const);

const CODEX_ARGV_PREFIX_V1 = Object.freeze([
  "exec",
  "--json",
  "--ephemeral",
  "--ignore-rules",
  "--strict-config",
  "--sandbox",
  "read-only",
] as const);

const CLAUDE_ARGV_PREFIX_V1 = Object.freeze([
  "-p",
  "--output-format",
  "stream-json",
  "--verbose",
  "--no-session-persistence",
  "--permission-mode",
  "dontAsk",
] as const);

export type Step16RealHostExecutionErrorCodeV1 =
  | "invalid_input"
  | "spawn_failed"
  | "stdin_write_failed"
  | "io_failed"
  | "timeout"
  | "stdout_limit_exceeded"
  | "stderr_limit_exceeded"
  | "nonzero_exit"
  | "signaled"
  | "invalid_utf8"
  | "transcript_rejected";

export class Step16RealHostExecutionErrorV1 extends Error {
  readonly code: Step16RealHostExecutionErrorCodeV1;

  constructor(code: Step16RealHostExecutionErrorCodeV1) {
    super(`Step16 real Host session failed: ${code}.`);
    this.name = "Step16RealHostExecutionErrorV1";
    this.code = code;
  }
}

export interface RunStep16RealHostJsonlSessionV1Input {
  readonly host: RealHostReceiptHostV1;
  readonly executable: string;
  /** Root-owned closing configuration must pin this; never derive it from the candidate path here. */
  readonly expectedExecutableDigest: Sha256DigestV1;
  readonly cwd: string;
  readonly prompt: string;
  readonly env: Readonly<Record<string, string>>;
  readonly expectedEventPlan: Step16ExpectedHostEventPlanV1;
  readonly expectedHostActionInputs: readonly Step16ExpectedHostActionInputV1[];
  readonly timeoutMs?: number;
}

export interface Step16RealHostJsonlSessionResultV1 {
  readonly receipt: RealHostTranscriptReceiptV1;
  readonly rawTranscriptDigest: Sha256DigestV1;
  readonly stderrDigest: Sha256DigestV1;
  readonly executableDigest: Sha256DigestV1;
  readonly exit: Readonly<{
    readonly code: 0;
    readonly signal: null;
  }>;
}

export interface Step16ExpectedHostActionInputV1 {
  readonly ordinal: number;
  readonly input: Readonly<Record<string, unknown>>;
}

export interface RunStep16RealHostJsonlSessionWithSupervisorInternalV1Options {
  readonly streamObserver: Step16RealHostStreamObserverInternalV1;
  readonly onObservedCall: (
    event: Step16RealHostObservedCallInternalV1,
  ) => void | Promise<void>;
}

interface ChildOutcomeV1 {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
}

interface CompiledSupervisorInternalV1 {
  readonly streamObserver: Step16RealHostStreamObserverInternalV1;
  readonly onObservedCall: (
    event: Step16RealHostObservedCallInternalV1,
  ) => void | Promise<void>;
}

function failV1(code: Step16RealHostExecutionErrorCodeV1): never {
  throw new Step16RealHostExecutionErrorV1(code);
}

function isUnicodeScalarStringV1(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function canonicalAbsolutePathV1(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0") ||
    Buffer.byteLength(value, "utf8") > MAX_PATH_BYTES_V1 ||
    !isUnicodeScalarStringV1(value) ||
    !isAbsolute(value)
  ) return false;
  try {
    return resolve(value) === value;
  } catch {
    return false;
  }
}

function isRecordV1(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeysV1(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function compileSupervisorInternalV1(
  value: unknown,
): CompiledSupervisorInternalV1 {
  try {
    if (!isRecordV1(value)) return failV1("invalid_input");
    const optionDescriptors = Object.getOwnPropertyDescriptors(value);
    const streamObserverDescriptor = optionDescriptors.streamObserver;
    const onObservedCallDescriptor = optionDescriptors.onObservedCall;
    if (
      Object.keys(value).some((key) =>
        key !== "streamObserver" &&
        key !== "onObservedCall"
      ) ||
      streamObserverDescriptor === undefined ||
      !("value" in streamObserverDescriptor) ||
      onObservedCallDescriptor === undefined ||
      !("value" in onObservedCallDescriptor) ||
      typeof onObservedCallDescriptor.value !== "function"
    ) return failV1("invalid_input");
    const streamObserverValue = streamObserverDescriptor.value;
    if (!isRecordV1(streamObserverValue)) return failV1("invalid_input");
    const observerDescriptors = Object.getOwnPropertyDescriptors(streamObserverValue);
    const feedDescriptor = observerDescriptors.feed;
    const finishDescriptor = observerDescriptors.finish;
    if (
      feedDescriptor === undefined ||
      !("value" in feedDescriptor) ||
      typeof feedDescriptor.value !== "function" ||
      finishDescriptor === undefined ||
      !("value" in finishDescriptor) ||
      typeof finishDescriptor.value !== "function"
    ) return failV1("invalid_input");
    const feed = feedDescriptor.value.bind(streamObserverValue) as
      Step16RealHostStreamObserverInternalV1["feed"];
    const finish = finishDescriptor.value.bind(streamObserverValue) as
      Step16RealHostStreamObserverInternalV1["finish"];
    const onObservedCall = onObservedCallDescriptor.value as
      CompiledSupervisorInternalV1["onObservedCall"];
    const compiledObserver: Step16RealHostStreamObserverInternalV1 =
      Object.freeze({
        feed: (line: string) => feed(line),
        finish: () => finish(),
      });
    const compiledCallback: CompiledSupervisorInternalV1["onObservedCall"] =
      (event) => onObservedCall(event);
    return Object.freeze({
      streamObserver: compiledObserver,
      onObservedCall: compiledCallback,
    });
  } catch (error) {
    if (error instanceof Step16RealHostExecutionErrorV1) throw error;
    return failV1("invalid_input");
  }
}

function pathInsideWorkspaceV1(workspace: string, target: string): boolean {
  const child = relative(workspace, target);
  return child.length > 0 && child !== ".." &&
    !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function safePermissionValueV1(value: string): boolean {
  return value.length > 0 &&
    !/[\u0000-\u001f\u007f*?()[\]{}]/u.test(value);
}

function injectingEnvironmentKeyV1(key: string): boolean {
  const normalized = key.toUpperCase();
  return INJECTING_ENVIRONMENT_KEYS_V1.has(normalized) ||
    INJECTING_ENVIRONMENT_PREFIXES_V1.some((prefix) =>
      normalized.startsWith(prefix)
    );
}

function childEnvironmentV1(
  value: unknown,
  host: RealHostReceiptHostV1,
): NodeJS.ProcessEnv {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return failV1("invalid_input");
  }
  const environment = Object.create(null) as Record<string, string>;
  try {
    for (const [key, entry] of Object.entries(value)) {
      if (
        key.length === 0 ||
        key.includes("=") ||
        key.includes("\0") ||
        !isUnicodeScalarStringV1(key) ||
        typeof entry !== "string" ||
        entry.includes("\0") ||
        !isUnicodeScalarStringV1(entry) ||
        injectingEnvironmentKeyV1(key)
      ) return failV1("invalid_input");
      environment[key] = entry;
    }
  } catch {
    return failV1("invalid_input");
  }
  environment.GIT_OPTIONAL_LOCKS = "0";
  if (host === "claude") environment.ENABLE_TOOL_SEARCH = "false";
  return Object.freeze(environment);
}

function timeoutV1(value: unknown): number {
  const timeout = value ?? DEFAULT_TIMEOUT_MS_V1;
  if (
    typeof timeout !== "number" ||
    !Number.isSafeInteger(timeout) ||
    timeout < 1 ||
    timeout > MAX_TIMEOUT_MS_V1
  ) return failV1("invalid_input");
  return timeout;
}

interface CompiledHostActionAuthorizationV1 {
  readonly ordinal: number;
  readonly tool: "Edit" | "Write" | "Bash";
  readonly permissionRule: string;
}

function compileHostActionAuthorizationsV1(
  host: RealHostReceiptHostV1,
  cwd: string,
  plan: Step16ExpectedHostEventPlanV1,
  value: unknown,
): readonly CompiledHostActionAuthorizationV1[] {
  if (!Array.isArray(value)) return failV1("invalid_input");
  const expectedActions = plan.events.filter((event) =>
    event.kind === "host_action"
  );
  if (host === "codex" && expectedActions.length > 0) {
    return failV1("invalid_input");
  }
  if (value.length !== expectedActions.length) return failV1("invalid_input");

  const compiled = expectedActions.map((expected, index) => {
    const entry = value[index];
    if (
      !isRecordV1(entry) ||
      !hasExactKeysV1(entry, ["ordinal", "input"]) ||
      entry.ordinal !== expected.ordinal ||
      !isRecordV1(entry.input)
    ) return failV1("invalid_input");
    let inputDigest: Sha256DigestV1;
    try {
      inputDigest = deriveStep16RealHostActionInputDigestV1(entry.input);
    } catch {
      return failV1("invalid_input");
    }
    if (inputDigest !== expected.inputDigest) return failV1("invalid_input");

    if (expected.action === "source_mutation") {
      const filePath = entry.input.file_path;
      if (
        !canonicalAbsolutePathV1(filePath) ||
        !pathInsideWorkspaceV1(cwd, filePath) ||
        !safePermissionValueV1(filePath)
      ) return failV1("invalid_input");
      if (
        hasExactKeysV1(entry.input, ["content", "file_path"]) &&
        typeof entry.input.content === "string"
      ) {
        // Claude permissions bind Write/Edit only to an exact path; the plan digest binds full content.
        return Object.freeze({
          ordinal: expected.ordinal,
          tool: "Write" as const,
          permissionRule: `Write(${filePath})`,
        });
      }
      const editKeys = Object.hasOwn(entry.input, "replace_all")
        ? ["file_path", "new_string", "old_string", "replace_all"]
        : ["file_path", "new_string", "old_string"];
      if (
        !hasExactKeysV1(entry.input, editKeys) ||
        typeof entry.input.old_string !== "string" ||
        typeof entry.input.new_string !== "string" ||
        (Object.hasOwn(entry.input, "replace_all") &&
          typeof entry.input.replace_all !== "boolean")
      ) return failV1("invalid_input");
      return Object.freeze({
        ordinal: expected.ordinal,
        tool: "Edit" as const,
        permissionRule: `Edit(${filePath})`,
      });
    }

    if (
      !hasExactKeysV1(entry.input, ["command"]) ||
      typeof entry.input.command !== "string" ||
      !safePermissionValueV1(entry.input.command)
    ) return failV1("invalid_input");
    return Object.freeze({
      ordinal: expected.ordinal,
      tool: "Bash" as const,
      permissionRule: `Bash(${entry.input.command})`,
    });
  });
  return Object.freeze(compiled);
}

function uniqueV1<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}

function argvV1(
  host: RealHostReceiptHostV1,
  cwd: string,
  plan: Step16ExpectedHostEventPlanV1,
  actions: readonly CompiledHostActionAuthorizationV1[],
): readonly string[] {
  const mcpTools = uniqueV1(
    plan.events.flatMap((event) =>
      event.kind === "mcp_tool_call" ? [event.tool] : []
    ),
  );
  if (host === "codex") {
    if (actions.length !== 0) return failV1("invalid_input");
    return Object.freeze([
      ...CODEX_ARGV_PREFIX_V1,
      "-c",
      `mcp_servers.understand-code.enabled_tools=${JSON.stringify(mcpTools)}`,
      "-C",
      cwd,
      "-",
    ]);
  }
  if (host === "claude") {
    const builtins = uniqueV1(actions.map((action) => action.tool));
    const allowedTools = uniqueV1([
      ...mcpTools.map((tool) => `mcp__understand-code__${tool}`),
      ...actions.map((action) => action.permissionRule),
    ]);
    return Object.freeze([
      ...CLAUDE_ARGV_PREFIX_V1,
      "--tools",
      builtins.join(","),
      "--allowedTools",
      ...allowedTools,
    ]);
  }
  return failV1("invalid_input");
}

function sha256DigestV1(bytes: Uint8Array): Sha256DigestV1 {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function isSha256DigestV1(value: unknown): value is Sha256DigestV1 {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
}

async function attestExecutableV1(
  executable: string,
  expectedDigest: unknown,
): Promise<Sha256DigestV1> {
  if (!isSha256DigestV1(expectedDigest)) return failV1("invalid_input");
  try {
    const before = await lstat(executable);
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1 ||
      (before.mode & 0o022) !== 0 ||
      (before.mode & 0o111) === 0 ||
      await realpath(executable) !== executable
    ) return failV1("invalid_input");

    const hash = createHash("sha256");
    for await (const chunk of createReadStream(executable, { flags: "r" })) {
      hash.update(chunk as Buffer);
    }
    const after = await lstat(executable);
    if (
      !after.isFile() ||
      after.isSymbolicLink() ||
      after.nlink !== 1 ||
      (after.mode & 0o022) !== 0 ||
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs
    ) return failV1("invalid_input");
    const actualDigest = `sha256:${hash.digest("hex")}` as Sha256DigestV1;
    if (actualDigest !== expectedDigest) return failV1("invalid_input");
    return actualDigest;
  } catch (error) {
    if (error instanceof Step16RealHostExecutionErrorV1) throw error;
    return failV1("invalid_input");
  }
}

function errnoCodeV1(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error &&
      typeof (error as { readonly code?: unknown }).code === "string"
    ? (error as { readonly code: string }).code
    : undefined;
}

function groupProcessIdV1(child: ChildProcessWithoutNullStreams): number | undefined {
  return Number.isSafeInteger(child.pid) && child.pid !== undefined && child.pid > 1
    ? child.pid
    : undefined;
}

function processTreeLiveV1(child: ChildProcessWithoutNullStreams): boolean {
  const pid = groupProcessIdV1(child);
  if (pid === undefined || process.platform === "win32") {
    return child.exitCode === null && child.signalCode === null;
  }
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if (errnoCodeV1(error) === "ESRCH") return false;
    return true;
  }
}

function signalProcessTreeV1(
  child: ChildProcessWithoutNullStreams,
  signal: NodeJS.Signals,
): void {
  const pid = groupProcessIdV1(child);
  if (pid !== undefined && process.platform !== "win32") {
    try {
      process.kill(-pid, signal);
      return;
    } catch (error) {
      if (errnoCodeV1(error) === "ESRCH") return;
    }
  }
  try {
    child.kill(signal);
  } catch {
    // The stable execution error already captures the failure boundary.
  }
}

async function terminateProcessTreeV1(
  child: ChildProcessWithoutNullStreams,
): Promise<void> {
  signalProcessTreeV1(child, "SIGTERM");
  await new Promise<void>((resolveDelay) =>
    setTimeout(resolveDelay, TERMINATION_GRACE_MS_V1)
  );
  if (processTreeLiveV1(child)) signalProcessTreeV1(child, "SIGKILL");
}

function decodeUtf8V1(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
  } catch {
    return failV1("invalid_utf8");
  }
}

async function runStep16RealHostJsonlSessionCoreV1(
  input: RunStep16RealHostJsonlSessionV1Input,
  supervisor: CompiledSupervisorInternalV1 | undefined,
): Promise<Step16RealHostJsonlSessionResultV1> {
  if (
    typeof input !== "object" ||
    input === null ||
    !canonicalAbsolutePathV1(input.executable) ||
    !canonicalAbsolutePathV1(input.cwd) ||
    typeof input.prompt !== "string" ||
    input.prompt.length === 0 ||
    !isUnicodeScalarStringV1(input.prompt)
  ) return failV1("invalid_input");
  let expectedEventPlan: Step16ExpectedHostEventPlanV1;
  try {
    expectedEventPlan = compileStep16ExpectedHostEventPlanV1(
      input.expectedEventPlan,
    );
  } catch {
    return failV1("invalid_input");
  }
  const actionAuthorizations = compileHostActionAuthorizationsV1(
    input.host,
    input.cwd,
    expectedEventPlan,
    input.expectedHostActionInputs,
  );
  const args = argvV1(
    input.host,
    input.cwd,
    expectedEventPlan,
    actionAuthorizations,
  );
  const environment = childEnvironmentV1(input.env, input.host);
  const timeoutMs = timeoutV1(input.timeoutMs);
  const executableDigest = await attestExecutableV1(
    input.executable,
    input.expectedExecutableDigest,
  );

  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(input.executable, args, {
      cwd: input.cwd,
      env: environment,
      detached: process.platform !== "win32",
      shell: false,
      stdio: "pipe",
      windowsHide: true,
    });
  } catch {
    return failV1("spawn_failed");
  }

  let spawnFailed = false;
  let stdinWriteFailed = false;
  let failureCode:
    | "io_failed"
    | "timeout"
    | "stdout_limit_exceeded"
    | "stderr_limit_exceeded"
    | "invalid_utf8"
    | "transcript_rejected"
    | undefined;
  let termination: Promise<void> | undefined;
  let resolveFailureObserved: (() => void) | undefined;
  const failureObserved = new Promise<void>((resolve) => {
    resolveFailureObserved = resolve;
  });
  let stdoutBytes = 0;
  let stderrBytes = 0;
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  const stdoutDecoder = supervisor === undefined
    ? undefined
    : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let stdoutLineBuffer = "";
  let stdoutEofObserved = false;
  let stdoutWork = Promise.resolve();

  const beginTermination = (
    code: NonNullable<typeof failureCode>,
  ): void => {
    if (failureCode !== undefined) return;
    failureCode = code;
    resolveFailureObserved?.();
    termination = terminateProcessTreeV1(child);
  };

  const processObservedText = async (text: string, atEof: boolean): Promise<void> => {
    if (failureCode !== undefined || supervisor === undefined) return;
    stdoutLineBuffer += text;
    const lines = stdoutLineBuffer.split("\n");
    stdoutLineBuffer = lines.pop() ?? "";
    if (atEof && stdoutLineBuffer.length > 0) {
      lines.push(stdoutLineBuffer);
      stdoutLineBuffer = "";
    }
    for (const line of lines) {
      if (failureCode !== undefined) return;
      let observed: Step16RealHostObservedCallInternalV1 | undefined;
      try {
        observed = supervisor.streamObserver.feed(line);
      } catch {
        beginTermination("transcript_rejected");
        return;
      }
      if (observed !== undefined) {
        try {
          await supervisor.onObservedCall(observed);
        } catch {
          beginTermination("io_failed");
          return;
        }
      }
    }
  };

  const enqueueStdoutWork = (work: () => Promise<void>): void => {
    child.stdout.pause();
    stdoutWork = stdoutWork
      .then(work)
      .catch(() => beginTermination("io_failed"))
      .then(() => {
        if (failureCode === undefined) child.stdout.resume();
      });
  };

  child.stdout.on("data", (value: Buffer) => {
    if (failureCode !== undefined) return;
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    stdoutBytes += chunk.byteLength;
    if (stdoutBytes > MAX_STDOUT_BYTES_V1) {
      beginTermination("stdout_limit_exceeded");
      return;
    }
    stdoutChunks.push(chunk);
    if (supervisor !== undefined && stdoutDecoder !== undefined) {
      enqueueStdoutWork(async () => {
        let text: string;
        try {
          text = stdoutDecoder.decode(chunk, { stream: true });
        } catch {
          beginTermination("invalid_utf8");
          return;
        }
        await processObservedText(text, false);
      });
    }
  });
  child.stderr.on("data", (value: Buffer) => {
    if (failureCode !== undefined) return;
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    stderrBytes += chunk.byteLength;
    if (stderrBytes > MAX_STDERR_BYTES_V1) {
      beginTermination("stderr_limit_exceeded");
      return;
    }
    stderrChunks.push(chunk);
  });
  child.stdout.once("error", () => beginTermination("io_failed"));
  child.stdout.once("end", () => {
    stdoutEofObserved = true;
    if (supervisor !== undefined && stdoutDecoder !== undefined) {
      enqueueStdoutWork(async () => {
        let text: string;
        try {
          text = stdoutDecoder.decode();
        } catch {
          beginTermination("invalid_utf8");
          return;
        }
        await processObservedText(text, true);
      });
    }
  });
  child.stderr.once("error", () => beginTermination("io_failed"));
  child.stdin.once("error", () => {
    stdinWriteFailed = true;
  });

  const completion = new Promise<ChildOutcomeV1>((resolveCompletion) => {
    child.once("error", () => {
      spawnFailed = true;
    });
    child.once("close", (code, signal) => {
      resolveCompletion(Object.freeze({ code, signal }));
    });
  });
  const timer = setTimeout(() => beginTermination("timeout"), timeoutMs);
  try {
    child.stdin.end(input.prompt, "utf8");
  } catch {
    stdinWriteFailed = true;
  }

  const outcome = await completion;
  if (supervisor !== undefined) {
    await Promise.race([stdoutWork, failureObserved]);
  }
  clearTimeout(timer);
  await termination;
  if (failureCode !== undefined) return failV1(failureCode);
  if (spawnFailed) return failV1("spawn_failed");
  if (outcome.signal !== null) return failV1("signaled");
  if (outcome.code !== 0) return failV1("nonzero_exit");
  if (stdinWriteFailed) return failV1("stdin_write_failed");
  if (supervisor !== undefined && !stdoutEofObserved) return failV1("io_failed");

  const stdout = Buffer.concat(stdoutChunks, stdoutBytes);
  const stderr = Buffer.concat(stderrChunks, stderrBytes);
  const transcript = decodeUtf8V1(stdout);
  decodeUtf8V1(stderr);
  let receipt: RealHostTranscriptReceiptV1;
  try {
    receipt = normalizeStep16RealHostJsonlTranscriptV1(
      input.host,
      transcript,
      expectedEventPlan,
    );
  } catch {
    return failV1("transcript_rejected");
  }
  if (supervisor !== undefined) {
    let observedReceipt: RealHostTranscriptReceiptV1;
    try {
      observedReceipt = supervisor.streamObserver.finish();
    } catch {
      return failV1("transcript_rejected");
    }
    if (JSON.stringify(observedReceipt) !== JSON.stringify(receipt)) {
      return failV1("transcript_rejected");
    }
  }

  return Object.freeze({
    receipt,
    rawTranscriptDigest: sha256DigestV1(stdout),
    stderrDigest: sha256DigestV1(stderr),
    executableDigest,
    exit: Object.freeze({ code: 0 as const, signal: null }),
  });
}

/**
 * Execute one real non-interactive Host session without exposing its prompt,
 * environment, raw transcript, or stderr across the process boundary.
 */
export async function runStep16RealHostJsonlSessionV1(
  input: RunStep16RealHostJsonlSessionV1Input,
): Promise<Step16RealHostJsonlSessionResultV1> {
  return runStep16RealHostJsonlSessionCoreV1(input, undefined);
}

export async function runStep16RealHostJsonlSessionWithSupervisorInternalV1(
  input: RunStep16RealHostJsonlSessionV1Input,
  options: RunStep16RealHostJsonlSessionWithSupervisorInternalV1Options,
): Promise<Step16RealHostJsonlSessionResultV1> {
  return runStep16RealHostJsonlSessionCoreV1(
    input,
    compileSupervisorInternalV1(options),
  );
}
