import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

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
const MAX_SOURCE_FILE_BYTES_V1 = 8 * 1024 * 1024;
const MAX_SOURCE_LEAF_BYTES_V1 = 32 * 1024 * 1024;
const MAX_SOURCE_LEAF_FILES_V1 = 256;
const CODEX_SOURCE_PROFILE_V1 = "step16-source-leaf-v1";
const ABORT_SIGNAL_ABORTED_GETTER_V1 =
  Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")!.get!;
const ADD_ABORT_LISTENER_V1 = EventTarget.prototype.addEventListener;
const REMOVE_ABORT_LISTENER_V1 = EventTarget.prototype.removeEventListener;
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
  /** Root filesystem evidence, not synthesized Codex JSONL or a kernel single-file grant. */
  readonly sourceMutation?: Readonly<{
    readonly inputDigest: Sha256DigestV1;
    readonly beforeContentDigest: Sha256DigestV1;
    readonly afterContentDigest: Sha256DigestV1;
    readonly beforeLeafDigest: Sha256DigestV1;
    readonly afterLeafDigest: Sha256DigestV1;
  }>;
}

export interface Step16ExpectedHostActionInputV1 {
  readonly ordinal: number;
  readonly input: Readonly<Record<string, unknown>>;
}

export interface RunStep16RealHostJsonlSessionWithSupervisorInternalV1Options {
  /** Internal Linux root supervisor only; never inherited by the public entry. */
  readonly childIdentity?: Readonly<{ readonly uid: number; readonly gid: number }>;
  readonly signal?: AbortSignal;
  /** Root-selected transport to the actual installed plugin; never a public override. */
  readonly rootMcpServer?: Readonly<{
    readonly command: string;
    readonly args: readonly string[];
    readonly env: Readonly<Record<string, string>>;
  }>;
  /** Linux/root only: one existing regular-file update in a flat non-workspace leaf. */
  readonly codexSourceMutation?: Readonly<{
    readonly beforeContent: string;
    readonly afterContent: string;
    /** Rebuilt in isolated CLI config; user config is ignored but auth is not copied. */
    readonly mcpServer?: Readonly<{
      readonly command: string;
      readonly args: readonly string[];
      readonly env: Readonly<Record<string, string>>;
    }>;
  }>;
  readonly streamObserver: Step16RealHostStreamObserverInternalV1;
  readonly onObservedCall: (
    event: Step16RealHostObservedCallInternalV1,
    signal: AbortSignal,
  ) => void | Promise<void>;
}

interface ChildOutcomeV1 {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
}

interface CompiledSupervisorInternalV1 {
  readonly childIdentity: Readonly<{ readonly uid: number; readonly gid: number }> | undefined;
  readonly signal: AbortSignal | undefined;
  readonly rootMcpServer: RunStep16RealHostJsonlSessionWithSupervisorInternalV1Options["rootMcpServer"];
  readonly codexSourceMutation: RunStep16RealHostJsonlSessionWithSupervisorInternalV1Options["codexSourceMutation"];
  readonly streamObserver: Step16RealHostStreamObserverInternalV1;
  readonly onObservedCall: (
    event: Step16RealHostObservedCallInternalV1,
    signal: AbortSignal,
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

function assertSupervisorIdentityContextV1(
  childIdentity: CompiledSupervisorInternalV1["childIdentity"],
): void {
  const effectiveUid = process.geteuid?.();
  if (childIdentity === undefined) {
    if (effectiveUid === 0) return failV1("invalid_input");
    return;
  }
  if (process.platform !== "linux" || effectiveUid !== 0 ||
    process.getegid?.() !== 0) return failV1("invalid_input");
}

function compileChildIdentityV1(
  options: Record<string, unknown>,
): CompiledSupervisorInternalV1["childIdentity"] {
  const descriptor = Object.getOwnPropertyDescriptor(options, "childIdentity");
  if (descriptor === undefined) {
    assertSupervisorIdentityContextV1(undefined);
    return undefined;
  }
  if (!("value" in descriptor) || descriptor.enumerable !== true ||
    !isRecordV1(descriptor.value)) return failV1("invalid_input");
  const value = descriptor.value;
  const keys = Reflect.ownKeys(value);
  const uid = Object.getOwnPropertyDescriptor(value, "uid");
  const gid = Object.getOwnPropertyDescriptor(value, "gid");
  if (keys.length !== 2 || !keys.every((key) => key === "uid" || key === "gid") ||
    uid === undefined || !("value" in uid) || uid.enumerable !== true ||
    gid === undefined || !("value" in gid) || gid.enumerable !== true ||
    !Number.isSafeInteger(uid.value) || uid.value <= 0 || uid.value > 0x7fff_ffff ||
    !Number.isSafeInteger(gid.value) || gid.value <= 0 || gid.value > 0x7fff_ffff) {
    return failV1("invalid_input");
  }
  const identity = Object.freeze({ uid: uid.value as number, gid: gid.value as number });
  assertSupervisorIdentityContextV1(identity);
  return identity;
}

function compileAbortSignalV1(options: Record<string, unknown>): AbortSignal | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(options, "signal");
  if (descriptor === undefined) return undefined;
  if (!("value" in descriptor) || descriptor.enumerable !== true) return failV1("invalid_input");
  if (descriptor.value === undefined) return undefined;
  // Use the captured native getter as a brand check; never read caller-defined
  // aborted/reason properties or invoke overridden listener methods.
  const aborted = ABORT_SIGNAL_ABORTED_GETTER_V1.call(descriptor.value);
  if (aborted) return failV1("io_failed");
  return descriptor.value as AbortSignal;
}

function ownRecordV1(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!isRecordV1(value) || Reflect.ownKeys(value).length !== keys.length) return failV1("invalid_input");
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) return failV1("invalid_input");
    result[key] = descriptor.value;
  }
  return result;
}

function compileCodexSourceMutationV1(
  options: Record<string, unknown>,
  childIdentity: CompiledSupervisorInternalV1["childIdentity"],
): CompiledSupervisorInternalV1["codexSourceMutation"] {
  const descriptor = Object.getOwnPropertyDescriptor(options, "codexSourceMutation");
  if (descriptor === undefined) return undefined;
  if (!("value" in descriptor) || !descriptor.enumerable || childIdentity === undefined) return failV1("invalid_input");
  assertSupervisorIdentityContextV1(childIdentity);
  const value = descriptor.value;
  const input = ownRecordV1(value, ["beforeContent", "afterContent", ...(isRecordV1(value) && Object.hasOwn(value, "mcpServer") ? ["mcpServer"] : [])]);
  for (const content of [input.beforeContent, input.afterContent]) {
    if (typeof content !== "string" || !isUnicodeScalarStringV1(content) || Buffer.byteLength(content) > MAX_SOURCE_FILE_BYTES_V1) return failV1("invalid_input");
  }
  if (input.beforeContent === input.afterContent) return failV1("invalid_input");
  let mcpServer: NonNullable<CompiledSupervisorInternalV1["codexSourceMutation"]>["mcpServer"];
  if (Object.hasOwn(input, "mcpServer")) {
    const server = ownRecordV1(input.mcpServer, ["command", "args", "env"]);
    if (!canonicalAbsolutePathV1(server.command) || !Array.isArray(server.args) || server.args.length > 256 || server.args.some((arg) => typeof arg !== "string" || arg.includes("\0") || !isUnicodeScalarStringV1(arg))) return failV1("invalid_input");
    mcpServer = Object.freeze({ command: server.command, args: Object.freeze([...server.args] as string[]), env: childEnvironmentV1(server.env, "codex") as Readonly<Record<string, string>> });
  }
  return Object.freeze({ beforeContent: input.beforeContent as string, afterContent: input.afterContent as string, ...(mcpServer === undefined ? {} : { mcpServer }) });
}

function compileRootMcpServerV1(
  options: Record<string, unknown>,
  childIdentity: CompiledSupervisorInternalV1["childIdentity"],
): CompiledSupervisorInternalV1["rootMcpServer"] {
  const descriptor = Object.getOwnPropertyDescriptor(options, "rootMcpServer");
  if (descriptor === undefined) return undefined;
  if (!("value" in descriptor) || !descriptor.enumerable || childIdentity === undefined) return failV1("invalid_input");
  assertSupervisorIdentityContextV1(childIdentity);
  const server = ownRecordV1(descriptor.value, ["command", "args", "env"]);
  if (!canonicalAbsolutePathV1(server.command) || !Array.isArray(server.args) || server.args.length > 256) return failV1("invalid_input");
  const args: string[] = [];
  for (let index = 0; index < server.args.length; index += 1) {
    const argument = Object.getOwnPropertyDescriptor(server.args, String(index));
    if (argument === undefined || !("value" in argument) || typeof argument.value !== "string" || argument.value.includes("\0") || !isUnicodeScalarStringV1(argument.value)) return failV1("invalid_input");
    args.push(argument.value);
  }
  if (!isRecordV1(server.env)) return failV1("invalid_input");
  const keys = Reflect.ownKeys(server.env);
  if (keys.some((key) => typeof key !== "string")) return failV1("invalid_input");
  const env = childEnvironmentV1(ownRecordV1(server.env, keys as string[]), "codex") as Readonly<Record<string, string>>;
  const result = Object.freeze({ command: server.command, args: Object.freeze(args), env });
  if (Buffer.byteLength(JSON.stringify(result)) > 64 * 1024) return failV1("invalid_input");
  return result;
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
      Reflect.ownKeys(value).some((key) =>
        key !== "streamObserver" &&
        key !== "onObservedCall" && key !== "childIdentity" && key !== "signal" && key !== "codexSourceMutation" && key !== "rootMcpServer"
      ) ||
      streamObserverDescriptor === undefined ||
      !("value" in streamObserverDescriptor) ||
      onObservedCallDescriptor === undefined ||
      !("value" in onObservedCallDescriptor) ||
      typeof onObservedCallDescriptor.value !== "function"
    ) return failV1("invalid_input");
    const childIdentity = compileChildIdentityV1(value);
    const signal = compileAbortSignalV1(value);
    const codexSourceMutation = compileCodexSourceMutationV1(value, childIdentity);
    const rootMcpServer = compileRootMcpServerV1(value, childIdentity);
    if (rootMcpServer !== undefined && codexSourceMutation !== undefined) return failV1("invalid_input");
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
      (event, signal) => onObservedCall(event, signal);
    return Object.freeze({
      childIdentity,
      signal,
      codexSourceMutation,
      rootMcpServer,
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
  readonly tool: "Edit" | "Write" | "Bash" | "CodexUpdate";
  readonly permissionRule: string;
  readonly sourcePath?: string;
  readonly inputDigest?: Sha256DigestV1;
}

function compileHostActionAuthorizationsV1(
  host: RealHostReceiptHostV1,
  cwd: string,
  plan: Step16ExpectedHostEventPlanV1,
  value: unknown,
  sourceMutation: CompiledSupervisorInternalV1["codexSourceMutation"],
): readonly CompiledHostActionAuthorizationV1[] {
  if (!Array.isArray(value)) return failV1("invalid_input");
  const expectedActions = plan.events.filter((event) =>
    event.kind === "host_action"
  );
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
      if (host === "codex") {
        if (sourceMutation === undefined || !hasExactKeysV1(entry.input, ["changes"]) || !Array.isArray(entry.input.changes) || entry.input.changes.length !== 1) return failV1("invalid_input");
        const change = ownRecordV1(entry.input.changes[0], ["kind", "path"]);
        if (change.kind !== "update" || typeof change.path !== "string" || !safePermissionValueV1(change.path)) return failV1("invalid_input");
        const sourcePath = resolve(cwd, change.path);
        if (!safePermissionValueV1(sourcePath) || !pathInsideWorkspaceV1(cwd, sourcePath) || dirname(sourcePath) === cwd || (isAbsolute(change.path) ? sourcePath !== change.path : relative(cwd, sourcePath) !== change.path)) return failV1("invalid_input");
        return Object.freeze({ ordinal: expected.ordinal, tool: "CodexUpdate" as const, permissionRule: "", sourcePath, inputDigest });
      }
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
  const codexUpdates = compiled.filter((action) => action.tool === "CodexUpdate");
  if (sourceMutation !== undefined && (host !== "codex" || codexUpdates.length !== 1)) return failV1("invalid_input");
  return Object.freeze(compiled);
}

interface SourceFileSnapshotV1 {
  readonly name: string;
  readonly dev: number;
  readonly ino: number;
  readonly mode: number;
  readonly uid: number;
  readonly gid: number;
  readonly digest: Sha256DigestV1;
}

interface SourceLeafSnapshotV1 {
  readonly path: string;
  readonly dev: number;
  readonly ino: number;
  readonly mode: number;
  readonly uid: number;
  readonly gid: number;
  readonly files: readonly SourceFileSnapshotV1[];
}

function sameFileIdentityV1(left: SourceFileSnapshotV1, right: SourceFileSnapshotV1): boolean {
  return left.name === right.name && left.dev === right.dev && left.ino === right.ino && left.mode === right.mode && left.uid === right.uid && left.gid === right.gid;
}

async function snapshotSourceLeafV1(path: string): Promise<SourceLeafSnapshotV1> {
  const directory = await lstat(path);
  if (!directory.isDirectory() || directory.isSymbolicLink() || await realpath(path) !== path) return failV1("invalid_input");
  const names = (await readdir(path)).sort();
  if (names.length === 0 || names.length > MAX_SOURCE_LEAF_FILES_V1) return failV1("invalid_input");
  let totalBytes = 0;
  const files: SourceFileSnapshotV1[] = [];
  for (const name of names) {
    const file = resolve(path, name);
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = await handle.stat();
      if (!before.isFile() || before.nlink !== 1 || before.size > MAX_SOURCE_FILE_BYTES_V1 || (totalBytes += before.size) > MAX_SOURCE_LEAF_BYTES_V1) return failV1("invalid_input");
      // A file growing concurrently must not turn root verification into an
      // unbounded read. One extra byte detects growth beyond the pinned size.
      const bytes = Buffer.alloc(before.size + 1);
      let bytesRead = 0;
      while (bytesRead < bytes.byteLength) {
        const part = await handle.read(bytes, bytesRead, bytes.byteLength - bytesRead, bytesRead);
        if (part.bytesRead === 0) break;
        bytesRead += part.bytesRead;
      }
      const after = await handle.stat();
      const entry = await lstat(file);
      if (bytesRead !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs || after.mode !== before.mode || after.uid !== before.uid || after.gid !== before.gid || after.nlink !== 1 || entry.dev !== before.dev || entry.ino !== before.ino || !entry.isFile() || entry.isSymbolicLink()) return failV1("invalid_input");
      files.push(Object.freeze({ name, dev: before.dev, ino: before.ino, mode: before.mode, uid: before.uid, gid: before.gid, digest: sha256DigestV1(bytes.subarray(0, bytesRead)) }));
    } finally { await handle.close(); }
  }
  const after = await lstat(path);
  if (after.dev !== directory.dev || after.ino !== directory.ino || after.mode !== directory.mode || after.uid !== directory.uid || after.gid !== directory.gid || JSON.stringify((await readdir(path)).sort()) !== JSON.stringify(names)) return failV1("invalid_input");
  return Object.freeze({ path, dev: directory.dev, ino: directory.ino, mode: directory.mode, uid: directory.uid, gid: directory.gid, files: Object.freeze(files) });
}

function sourceLeafDigestV1(snapshot: SourceLeafSnapshotV1): Sha256DigestV1 {
  return sha256DigestV1(Buffer.from(JSON.stringify(snapshot), "utf8"));
}

function tomlStringMapV1(value: Readonly<Record<string, string>>): string {
  return `{${Object.entries(value).map(([key, entry]) => `${JSON.stringify(key)}=${JSON.stringify(entry)}`).join(",")}}`;
}

function codexSourceArgvV1(
  cwd: string,
  mcpTools: readonly string[],
  source: NonNullable<CompiledSupervisorInternalV1["codexSourceMutation"]>,
  target: string,
  snapshot: SourceLeafSnapshotV1,
): readonly string[] {
  if (mcpTools.length > 0 && source.mcpServer === undefined) return failV1("invalid_input");
  const filesystem: Record<string, string> = { ":root": "read", [snapshot.path]: "write" };
  for (const file of snapshot.files) {
    const path = resolve(snapshot.path, file.name);
    if (!safePermissionValueV1(path)) return failV1("invalid_input");
    if (path !== target) filesystem[path] = "read";
  }
  const permissions = `permissions={${JSON.stringify(CODEX_SOURCE_PROFILE_V1)}={filesystem=${tomlStringMapV1(filesystem)},network={enabled=false}}}`;
  if (Buffer.byteLength(permissions) > 64 * 1024) return failV1("invalid_input");
  const server = source.mcpServer;
  const mcp = server === undefined ? "mcp_servers={}" : `mcp_servers={\"understand-code\"={command=${JSON.stringify(server.command)},args=${JSON.stringify(server.args)},env=${tomlStringMapV1(server.env)},enabled_tools=${JSON.stringify(mcpTools)}}}`;
  return Object.freeze([
    ...CODEX_ARGV_PREFIX_V1.slice(0, -2),
    "--ignore-user-config",
    "-c", `default_permissions=${JSON.stringify(CODEX_SOURCE_PROFILE_V1)}`,
    "-c", permissions,
    "-c", 'approval_policy="never"',
    "-c", `projects.${JSON.stringify(cwd)}.trust_level="untrusted"`,
    "-c", mcp,
    "-C", cwd, "-",
  ]);
}

function uniqueV1<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}

function argvV1(
  host: RealHostReceiptHostV1,
  cwd: string,
  plan: Step16ExpectedHostEventPlanV1,
  actions: readonly CompiledHostActionAuthorizationV1[],
  rootMcpServer: CompiledSupervisorInternalV1["rootMcpServer"],
): readonly string[] {
  const mcpTools = uniqueV1(
    plan.events.flatMap((event) =>
      event.kind === "mcp_tool_call" ? [event.tool] : []
    ),
  );
  if (host === "codex") {
    if (actions.some((action) => action.tool !== "Bash")) return failV1("invalid_input");
    // Verification uses the unchanged read-only sandbox. Its exact command,
    // ordinal, paired completion and exit zero are checked by the normalizer;
    // Claude permission rules below are never used as Codex write authority.
    return Object.freeze([
      ...CODEX_ARGV_PREFIX_V1,
      ...(rootMcpServer === undefined ? [] : [
        "--ignore-user-config",
        "-c", `projects.${JSON.stringify(cwd)}.trust_level="untrusted"`,
        "-c", `mcp_servers={"understand-code"={command=${JSON.stringify(rootMcpServer.command)},args=${JSON.stringify(rootMcpServer.args)},env=${tomlStringMapV1(rootMcpServer.env)},enabled_tools=${JSON.stringify(mcpTools)}}}`,
      ]),
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
      ...(rootMcpServer === undefined ? [] : [
        "--strict-mcp-config", "--mcp-config",
        JSON.stringify({ mcpServers: { "understand-code": rootMcpServer } }),
      ]),
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

interface RootProtectedPathIdentityV1 {
  readonly path: string;
  readonly dev: number;
  readonly ino: number;
  readonly mode: number;
  readonly gid: number;
}

async function rootProtectedExecutablePathV1(
  executable: string,
): Promise<readonly RootProtectedPathIdentityV1[]> {
  const paths = [executable];
  for (let path = dirname(executable); path !== paths[0]; path = dirname(path)) {
    paths.unshift(path);
    if (dirname(path) === path) break;
  }
  const identities: RootProtectedPathIdentityV1[] = [];
  try {
    for (const path of paths) {
      const metadata = await lstat(path);
      const isExecutable = path === executable;
      if (metadata.isSymbolicLink() || metadata.uid !== 0 ||
        (metadata.mode & 0o022) !== 0 ||
        (isExecutable
          ? !metadata.isFile() || metadata.nlink !== 1 ||
            (metadata.mode & 0o111) === 0 || (metadata.mode & 0o6000) !== 0
          : !metadata.isDirectory())) return failV1("invalid_input");
      identities.push(Object.freeze({
        path, dev: metadata.dev, ino: metadata.ino, mode: metadata.mode, gid: metadata.gid,
      }));
    }
    return Object.freeze(identities);
  } catch (error) {
    if (error instanceof Step16RealHostExecutionErrorV1) throw error;
    return failV1("invalid_input");
  }
}

function sameRootProtectedPathV1(
  before: readonly RootProtectedPathIdentityV1[],
  after: readonly RootProtectedPathIdentityV1[],
): boolean {
  return before.length === after.length && before.every((entry, index) => {
    const next = after[index]!;
    return entry.path === next.path && entry.dev === next.dev && entry.ino === next.ino &&
      entry.mode === next.mode && entry.gid === next.gid;
  });
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
  if (typeof input !== "object" || input === null) return failV1("invalid_input");
  // Pin launch primitives before the first await, so a mutable input cannot
  // redirect spawn after the root-owned path and executable digest were checked.
  const executable = input.executable;
  const expectedExecutableDigest = input.expectedExecutableDigest;
  const cwd = input.cwd;
  const host = input.host;
  const prompt = input.prompt;
  if (
    !canonicalAbsolutePathV1(executable) ||
    !canonicalAbsolutePathV1(cwd) ||
    typeof prompt !== "string" || prompt.length === 0 ||
    !isUnicodeScalarStringV1(prompt)
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
    host,
    cwd,
    expectedEventPlan,
    input.expectedHostActionInputs,
    supervisor?.codexSourceMutation,
  );
  const environment = childEnvironmentV1(input.env, host);
  const timeoutMs = timeoutV1(input.timeoutMs);
  const childIdentity = supervisor?.childIdentity;
  const sourceMutation = supervisor?.codexSourceMutation;
  const sourceAction = actionAuthorizations.find((action) => action.tool === "CodexUpdate");
  let sourceBefore: SourceLeafSnapshotV1 | undefined;
  if (sourceMutation !== undefined && sourceAction?.sourcePath !== undefined) {
    try {
      if (await realpath(cwd) !== cwd) return failV1("invalid_input");
      sourceBefore = await snapshotSourceLeafV1(dirname(sourceAction.sourcePath));
      const target = sourceBefore.files.find((file) => resolve(sourceBefore!.path, file.name) === sourceAction.sourcePath);
      if (target?.digest !== sha256DigestV1(Buffer.from(sourceMutation.beforeContent, "utf8"))) return failV1("invalid_input");
    } catch { return failV1("invalid_input"); }
  }
  const args = sourceMutation !== undefined && sourceBefore !== undefined && sourceAction?.sourcePath !== undefined
    ? codexSourceArgvV1(cwd, uniqueV1(expectedEventPlan.events.flatMap((event) => event.kind === "mcp_tool_call" ? [event.tool] : [])), sourceMutation, sourceAction.sourcePath, sourceBefore)
    : argvV1(
    host,
    cwd,
    expectedEventPlan,
    actionAuthorizations,
    supervisor?.rootMcpServer,
  );
  const protectedPath = childIdentity === undefined
    ? undefined : await rootProtectedExecutablePathV1(executable);
  const executableDigest = await attestExecutableV1(
    executable,
    expectedExecutableDigest,
  );
  if (protectedPath !== undefined &&
    !sameRootProtectedPathV1(protectedPath, await rootProtectedExecutablePathV1(executable))) {
    return failV1("invalid_input");
  }
  if (supervisor !== undefined) assertSupervisorIdentityContextV1(childIdentity);
  const externalSignal = supervisor?.signal;
  if (externalSignal !== undefined && ABORT_SIGNAL_ABORTED_GETTER_V1.call(externalSignal)) {
    return failV1("io_failed");
  }

  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(executable, args, {
      cwd,
      env: environment,
      // libuv clears supplementary groups before applying gid/uid in the child.
      // The supervising process retains its identity and owns the raw pipes.
      ...(childIdentity === undefined ? {} : childIdentity),
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
  const supervisorAbortController = supervisor === undefined
    ? undefined
    : new AbortController();
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

  const supervisorWorkAbortedV1 = (): boolean =>
    supervisorAbortController?.signal.aborted ?? false;

  const abortSupervisorWorkV1 = (
    code: Step16RealHostExecutionErrorCodeV1,
  ): void => {
    supervisorAbortController?.abort(
      new Step16RealHostExecutionErrorV1(code),
    );
    resolveFailureObserved?.();
    // A paused stdout can retain unread bytes after the Host exits and prevent
    // ChildProcess.close forever. Failed supervised runs need no more output;
    // release that pipe without feeding or resuming any queued observations.
    if (supervisorAbortController !== undefined) child.stdout.destroy();
  };

  const beginTermination = (
    code: NonNullable<typeof failureCode>,
  ): void => {
    if (failureCode !== undefined) return;
    failureCode = code;
    abortSupervisorWorkV1(code);
    termination = terminateProcessTreeV1(child);
  };

  const failAfterSpawnV1 = (
    code: Step16RealHostExecutionErrorCodeV1,
  ): never => {
    abortSupervisorWorkV1(code);
    return failV1(code);
  };

  const processObservedText = async (text: string, atEof: boolean): Promise<void> => {
    if (
      failureCode !== undefined || supervisor === undefined ||
      supervisorWorkAbortedV1()
    ) return;
    stdoutLineBuffer += text;
    const lines = stdoutLineBuffer.split("\n");
    stdoutLineBuffer = lines.pop() ?? "";
    if (atEof && stdoutLineBuffer.length > 0) {
      lines.push(stdoutLineBuffer);
      stdoutLineBuffer = "";
    }
    for (const line of lines) {
      if (
        failureCode !== undefined ||
        supervisorWorkAbortedV1()
      ) return;
      let observed: Step16RealHostObservedCallInternalV1 | undefined;
      try {
        observed = supervisor.streamObserver.feed(line);
      } catch {
        beginTermination("transcript_rejected");
        return;
      }
      if (observed !== undefined) {
        const signal = supervisorAbortController?.signal;
        if (
          signal === undefined ||
          signal.aborted ||
          failureCode !== undefined
        ) return;
        let callbackResult: void | Promise<void>;
        try {
          callbackResult = supervisor.onObservedCall(observed, signal);
        } catch {
          beginTermination("io_failed");
          return;
        }
        const callbackOutcome = await Promise.race([
          Promise.resolve(callbackResult).then(
            () => "completed" as const,
            () => "rejected" as const,
          ),
          failureObserved.then(() => "aborted" as const),
        ]);
        if (callbackOutcome === "rejected") {
          if (failureCode === undefined) beginTermination("io_failed");
          return;
        }
        if (
          callbackOutcome === "aborted" ||
          signal.aborted ||
          failureCode !== undefined
        ) return;
      }
    }
  };

  const enqueueStdoutWork = (work: () => Promise<void>): void => {
    child.stdout.pause();
    stdoutWork = stdoutWork
      .then(work)
      .catch(() => beginTermination("io_failed"))
      .then(() => {
        if (
          failureCode === undefined &&
          !supervisorWorkAbortedV1()
        ) child.stdout.resume();
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
        if (
          failureCode !== undefined ||
          supervisorWorkAbortedV1()
        ) return;
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
        if (
          failureCode !== undefined ||
          supervisorWorkAbortedV1()
        ) return;
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
    if (supervisor !== undefined) beginTermination("io_failed");
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
  const onExternalAbort = (): void => beginTermination("io_failed");
  let externalListenerAdded = false;
  try {
    if (externalSignal !== undefined) {
      try {
        ADD_ABORT_LISTENER_V1.call(externalSignal, "abort", onExternalAbort, { once: true });
        externalListenerAdded = true;
        if (ABORT_SIGNAL_ABORTED_GETTER_V1.call(externalSignal)) onExternalAbort();
      } catch {
        beginTermination("io_failed");
      }
    }
    try {
      child.stdin.end(prompt, "utf8");
    } catch {
      stdinWriteFailed = true;
      if (supervisor !== undefined) beginTermination("io_failed");
    }

    const outcome = await completion;
    if (supervisor !== undefined) {
      if (spawnFailed) {
        abortSupervisorWorkV1("spawn_failed");
      } else if (outcome.signal !== null) {
        abortSupervisorWorkV1("signaled");
      } else if (outcome.code !== 0) {
        abortSupervisorWorkV1("nonzero_exit");
      } else if (stdinWriteFailed) {
        abortSupervisorWorkV1("stdin_write_failed");
      }
      await Promise.race([stdoutWork, failureObserved]);
    }
    if (sourceMutation === undefined) clearTimeout(timer);
    await termination;
    if (failureCode !== undefined) return failV1(failureCode);
    if (spawnFailed) return failAfterSpawnV1("spawn_failed");
    if (outcome.signal !== null) return failAfterSpawnV1("signaled");
    if (outcome.code !== 0) return failAfterSpawnV1("nonzero_exit");
    if (stdinWriteFailed) return failAfterSpawnV1("stdin_write_failed");
    if (supervisor !== undefined && !stdoutEofObserved) {
      return failAfterSpawnV1("io_failed");
    }

    const stdout = Buffer.concat(stdoutChunks, stdoutBytes);
    const stderr = Buffer.concat(stderrChunks, stderrBytes);
    let transcript: string;
    try {
      transcript = decodeUtf8V1(stdout);
      decodeUtf8V1(stderr);
    } catch (error) {
      supervisorAbortController?.abort(error);
      throw error;
    }
    let receipt: RealHostTranscriptReceiptV1;
    try {
      receipt = normalizeStep16RealHostJsonlTranscriptV1(host, transcript, expectedEventPlan);
    } catch {
      return failAfterSpawnV1("transcript_rejected");
    }
    if (supervisor !== undefined) {
      let observedReceipt: RealHostTranscriptReceiptV1;
      try {
        observedReceipt = supervisor.streamObserver.finish();
      } catch {
        return failAfterSpawnV1("transcript_rejected");
      }
      let receiptsMatch = false;
      try {
        receiptsMatch = JSON.stringify(observedReceipt) === JSON.stringify(receipt);
      } catch {
        return failAfterSpawnV1("transcript_rejected");
      }
      if (!receiptsMatch) return failAfterSpawnV1("transcript_rejected");
    }
    let sourceEvidence: Step16RealHostJsonlSessionResultV1["sourceMutation"];
    if (sourceMutation !== undefined && sourceBefore !== undefined && sourceAction?.sourcePath !== undefined && sourceAction.inputDigest !== undefined) {
      try {
        assertSupervisorIdentityContextV1(childIdentity);
        const after = await snapshotSourceLeafV1(sourceBefore.path);
        if (after.dev !== sourceBefore.dev || after.ino !== sourceBefore.ino || after.mode !== sourceBefore.mode || after.uid !== sourceBefore.uid || after.gid !== sourceBefore.gid || after.files.length !== sourceBefore.files.length) return failAfterSpawnV1("transcript_rejected");
        const expectedAfter = sha256DigestV1(Buffer.from(sourceMutation.afterContent, "utf8"));
        for (let index = 0; index < after.files.length; index += 1) {
          const beforeFile = sourceBefore.files[index]!;
          const afterFile = after.files[index]!;
          const expectedDigest = resolve(after.path, afterFile.name) === sourceAction.sourcePath ? expectedAfter : beforeFile.digest;
          if (!sameFileIdentityV1(beforeFile, afterFile) || afterFile.digest !== expectedDigest) return failAfterSpawnV1("transcript_rejected");
        }
        sourceEvidence = Object.freeze({ inputDigest: sourceAction.inputDigest, beforeContentDigest: sha256DigestV1(Buffer.from(sourceMutation.beforeContent, "utf8")), afterContentDigest: expectedAfter, beforeLeafDigest: sourceLeafDigestV1(sourceBefore), afterLeafDigest: sourceLeafDigestV1(after) });
      } catch { return failAfterSpawnV1("transcript_rejected"); }
    }
    if (failureCode !== undefined) {
      await termination;
      return failV1(failureCode);
    }
    return Object.freeze({
      receipt,
      rawTranscriptDigest: sha256DigestV1(stdout),
      stderrDigest: sha256DigestV1(stderr),
      executableDigest,
      exit: Object.freeze({ code: 0 as const, signal: null }),
      ...(sourceEvidence === undefined ? {} : { sourceMutation: sourceEvidence }),
    });
  } finally {
    clearTimeout(timer);
    if (externalSignal !== undefined && externalListenerAdded) {
      REMOVE_ABORT_LISTENER_V1.call(externalSignal, "abort", onExternalAbort);
    }
  }
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
