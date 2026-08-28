import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";

import {
  PathSafeRepositoryRelativePathV1Schema,
  type RepositoryChangeKindV1,
  type RepositoryChangeSourceV1,
} from "@understand-code/contracts";

import {
  classifySafeGitReadCommandV1,
  type SafeGitReadCommandV1,
  type SafeGitReadExecutorV1,
} from "./safe-git-read-command.js";

const OID_V1 = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const MAX_CONTENT_BYTES_V1 = 64 * 1_024 * 1_024;
const MAX_METADATA_BYTES_V1 = 64 * 1_024 * 1_024;
const MAX_COMMIT_BYTES_V1 = 1 * 1_024 * 1_024;
const MAX_PATH_BYTES_V1 = 4_096;
const MAX_PATH_COMPONENTS_V1 = 256;
const MAX_COMMANDS_V1 = 16_384;
const FATAL_UTF8_DECODER_V1 = new TextDecoder("utf-8", { fatal: true });
const CONTENT_DIGEST_V1 = /^sha256:[0-9a-f]{64}$/u;

const CHANGE_SOURCES_V1 = new Set<RepositoryChangeSourceV1>([
  "committed",
  "staged",
  "unstaged",
  "untracked",
  "conflict",
]);
const CHANGE_KINDS_V1 = new Set<RepositoryChangeKindV1>([
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "type_changed",
]);

export interface SafeGitLayeredRepositoryChangeInputV1 {
  readonly path: string;
  readonly oldPath?: string;
  readonly source: RepositoryChangeSourceV1;
  readonly kind: RepositoryChangeKindV1;
}

export interface SafeGitLayeredContentReadOptionsV1 {
  readonly maxBytes: number;
  readonly signal?: AbortSignal;
  readonly expectedContentDigest?: `sha256:${string}`;
  readonly session?: SafeGitLayeredContentReadSessionV1;
}

export interface SafeGitLayeredContentReadSessionLimitsV1 {
  readonly maxMetadataBytes: number;
  readonly maxBlobBytes: number;
  readonly maxCommands: number;
}

export interface SafeGitLayeredContentReadSessionV1 {
  readonly profile: "safe_git_layered_content_read_session_v1";
}

export type SafeGitLayeredRepositoryContentV1 =
  | Readonly<{
      readonly status: "content";
      readonly path: string;
      readonly source: "committed" | "staged";
      readonly layer: "head_tree" | "index";
      readonly mode: "100644" | "100755";
      readonly objectId: string;
      readonly bytes: Buffer;
    }>
  | Readonly<{
      readonly status: "absent";
      readonly path: string;
      readonly source: "committed" | "staged";
      readonly layer: "head_tree" | "index";
    }>
  | Readonly<{
      readonly status: "not_applicable";
      readonly path: string;
      readonly source: "unstaged" | "untracked" | "conflict";
    }>;

export type SafeGitLayeredContentReadErrorCodeV1 =
  | "invalid_argument"
  | "unsafe_path"
  | "read_failed"
  | "budget_exceeded"
  | "invalid_git_output"
  | "unsupported_entry_type"
  | "change_mismatch";

const ERROR_MESSAGES_V1: Readonly<
  Record<SafeGitLayeredContentReadErrorCodeV1, string>
> = Object.freeze({
  invalid_argument: "The layered SafeGit content request is invalid.",
  unsafe_path: "The repository path is unsafe for exact layered content lookup.",
  read_failed: "The descriptor-bound SafeGit content read failed.",
  budget_exceeded: "The descriptor-bound SafeGit content read exceeded its byte budget.",
  invalid_git_output: "The descriptor-bound SafeGit content read returned invalid output.",
  unsupported_entry_type: "The repository entry type is unsupported for source content analysis.",
  change_mismatch: "The requested repository change does not match its exact Git layer.",
});

/** Path-redacted failure for the exact descriptor-bound content boundary. */
export class SafeGitLayeredContentReadErrorV1 extends Error {
  readonly code: SafeGitLayeredContentReadErrorCodeV1;

  constructor(code: SafeGitLayeredContentReadErrorCodeV1, cause?: unknown) {
    super(ERROR_MESSAGES_V1[code], cause === undefined ? {} : { cause });
    this.name = "SafeGitLayeredContentReadErrorV1";
    this.code = code;
  }
}

interface GitEntryV1 {
  readonly kind: "blob";
  readonly mode: "100644" | "100755";
  readonly objectId: string;
}

interface TreeEntryV1 {
  readonly kind: "blob" | "tree" | "unsupported";
  readonly mode: "040000" | "100644" | "100755" | "120000" | "160000";
  readonly objectId: string;
}

type IndexEntryV1 = GitEntryV1 | Readonly<{
  readonly kind: "unsupported";
  readonly mode: "120000" | "160000";
  readonly objectId: string;
}>;

interface SafeGitLayeredContentReadSessionStateV1 {
  readonly executor: SafeGitReadExecutorV1;
  metadataBytesRemaining: number;
  blobBytesRemaining: number;
  commandsRemaining: number;
  readonly objectTypes: Map<string, Promise<"blob" | "tree" | "commit">>;
  readonly commitTreeObjectIds: Map<string, Promise<string>>;
  readonly trees: Map<string, Promise<ReadonlyMap<string, TreeEntryV1>>>;
  index: Promise<ReadonlyMap<string, IndexEntryV1>> | undefined;
  readonly blobs: Map<string, Promise<Buffer>>;
}

const SESSION_STATES_V1 = new WeakMap<
  SafeGitLayeredContentReadSessionV1,
  SafeGitLayeredContentReadSessionStateV1
>();

function failV1(
  code: SafeGitLayeredContentReadErrorCodeV1,
  cause?: unknown,
): never {
  throw new SafeGitLayeredContentReadErrorV1(code, cause);
}

function positiveLimitV1(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) failV1("invalid_argument");
  return value;
}

export function createSafeGitLayeredContentReadSessionV1(
  executor: SafeGitReadExecutorV1,
  limits: Partial<SafeGitLayeredContentReadSessionLimitsV1> = {},
): SafeGitLayeredContentReadSessionV1 {
  if (typeof executor !== "object" || executor === null) {
    failV1("invalid_argument");
  }
  const session = Object.freeze({
    profile: "safe_git_layered_content_read_session_v1" as const,
  });
  SESSION_STATES_V1.set(session, {
    executor,
    metadataBytesRemaining: positiveLimitV1(
      limits.maxMetadataBytes ?? MAX_METADATA_BYTES_V1,
    ),
    blobBytesRemaining: positiveLimitV1(
      limits.maxBlobBytes ?? MAX_CONTENT_BYTES_V1,
    ),
    commandsRemaining: positiveLimitV1(
      limits.maxCommands ?? MAX_COMMANDS_V1,
    ),
    objectTypes: new Map(),
    commitTreeObjectIds: new Map(),
    trees: new Map(),
    index: undefined,
    blobs: new Map(),
  });
  return session;
}

function sessionStateV1(
  executor: SafeGitReadExecutorV1,
  session?: SafeGitLayeredContentReadSessionV1,
): SafeGitLayeredContentReadSessionStateV1 {
  const selected = session ?? createSafeGitLayeredContentReadSessionV1(executor);
  const state = SESSION_STATES_V1.get(selected);
  if (state === undefined || state.executor !== executor) {
    failV1("invalid_argument");
  }
  return state;
}

function isSafePathV1(value: string): boolean {
  return (
    PathSafeRepositoryRelativePathV1Schema.safeParse(value).success &&
    Buffer.byteLength(value, "utf8") <= MAX_PATH_BYTES_V1 &&
    value.split("/").length <= MAX_PATH_COMPONENTS_V1 &&
    !value.startsWith("-") &&
    !/[":\u0000-\u001f\u007f]/u.test(value)
  );
}

function validateInputV1(
  headCommit: string,
  change: SafeGitLayeredRepositoryChangeInputV1,
  options: SafeGitLayeredContentReadOptionsV1,
): void {
  if (
    !OID_V1.test(headCommit) ||
    typeof change !== "object" ||
    change === null ||
    typeof change.path !== "string" ||
    !CHANGE_SOURCES_V1.has(change.source) ||
    !CHANGE_KINDS_V1.has(change.kind) ||
    typeof options !== "object" ||
    options === null ||
    !Number.isSafeInteger(options.maxBytes) ||
    options.maxBytes <= 0 ||
    options.maxBytes > MAX_CONTENT_BYTES_V1
  ) {
    failV1("invalid_argument");
  }
  if (
    !isSafePathV1(change.path) ||
    (change.oldPath !== undefined && !isSafePathV1(change.oldPath))
  ) {
    failV1("unsafe_path");
  }
  const carriesOldPath = change.kind === "renamed" || change.kind === "copied";
  if (
    carriesOldPath !== (change.oldPath !== undefined) ||
    change.oldPath === change.path
  ) {
    failV1("invalid_argument");
  }
  if (
    change.source === "staged" &&
    change.kind !== "deleted" &&
    (
      options.expectedContentDigest === undefined ||
      !CONTENT_DIGEST_V1.test(options.expectedContentDigest)
    )
  ) {
    failV1("invalid_argument");
  }
  if (
    options.expectedContentDigest !== undefined &&
    !CONTENT_DIGEST_V1.test(options.expectedContentDigest)
  ) {
    failV1("invalid_argument");
  }
}

function commandWithLimitV1(
  args: readonly string[],
  maxBytes: number,
): SafeGitReadCommandV1 {
  const command = classifySafeGitReadCommandV1(args);
  return Object.freeze({
    ...command,
    stdoutLimitBytes: Math.min(command.stdoutLimitBytes, maxBytes),
  });
}

async function executeV1(
  session: SafeGitLayeredContentReadSessionStateV1,
  args: readonly string[],
  maxBytes: number,
  budget: "metadata" | "blob",
  signal?: AbortSignal,
): Promise<Buffer> {
  const remaining = budget === "metadata"
    ? session.metadataBytesRemaining
    : session.blobBytesRemaining;
  if (session.commandsRemaining <= 0 || remaining <= 0) {
    failV1("budget_exceeded");
  }
  const limit = Math.min(maxBytes, remaining);
  session.commandsRemaining -= 1;
  if (budget === "metadata") {
    session.metadataBytesRemaining -= limit;
  } else {
    session.blobBytesRemaining -= limit;
  }
  let result;
  try {
    result = await session.executor.execute(commandWithLimitV1(args, limit), {
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    failV1("read_failed", error);
  }
  if (
    !(result.stdout instanceof Uint8Array) ||
    !(result.stderr instanceof Uint8Array) ||
    result.exitCode !== 0 ||
    result.stderr.byteLength !== 0
  ) {
    failV1("read_failed");
  }
  if (result.stdout.byteLength > limit) failV1("budget_exceeded");
  if (budget === "metadata") {
    session.metadataBytesRemaining += limit - result.stdout.byteLength;
  } else {
    session.blobBytesRemaining += limit - result.stdout.byteLength;
  }
  return Buffer.from(result.stdout);
}

function decodeUtf8V1(bytes: Buffer): string {
  try {
    return FATAL_UTF8_DECODER_V1.decode(bytes);
  } catch (error) {
    failV1("invalid_git_output", error);
  }
}

async function requireObjectTypeV1(
  session: SafeGitLayeredContentReadSessionStateV1,
  objectId: string,
  expectedType: "blob" | "tree" | "commit",
  signal?: AbortSignal,
): Promise<void> {
  if (!OID_V1.test(objectId)) failV1("invalid_git_output");
  let pending = session.objectTypes.get(objectId);
  if (pending === undefined) {
    pending = (async () => {
      const output = await executeV1(
        session,
        ["cat-file", "-t", "--", objectId],
        128,
        "metadata",
        signal,
      );
      const text = decodeUtf8V1(output);
      const type = text === "blob\n"
        ? "blob"
        : text === "tree\n"
          ? "tree"
          : text === "commit\n"
            ? "commit"
            : undefined;
      if (type === undefined) {
        failV1("unsupported_entry_type");
      }
      return type;
    })();
    session.objectTypes.set(objectId, pending);
  }
  if (await pending !== expectedType) {
    failV1("unsupported_entry_type");
  }
}

async function readObjectV1(
  session: SafeGitLayeredContentReadSessionStateV1,
  objectId: string,
  expectedType: "blob" | "tree" | "commit",
  maxBytes: number,
  signal?: AbortSignal,
): Promise<Buffer> {
  await requireObjectTypeV1(session, objectId, expectedType, signal);
  return executeV1(
    session,
    ["cat-file", "-p", objectId],
    maxBytes,
    expectedType === "blob" ? "blob" : "metadata",
    signal,
  );
}

async function readCommitTreeObjectIdV1(
  session: SafeGitLayeredContentReadSessionStateV1,
  commit: string,
  signal?: AbortSignal,
): Promise<string> {
  let pending = session.commitTreeObjectIds.get(commit);
  if (pending === undefined) {
    pending = (async () => {
      const object = await readObjectV1(
        session,
        commit,
        "commit",
        MAX_COMMIT_BYTES_V1,
        signal,
      );
      const lineEnd = object.indexOf(0x0a);
      if (lineEnd < 0) failV1("invalid_git_output");
      const match = /^tree ([0-9a-f]{40}|[0-9a-f]{64})$/u.exec(
        object.subarray(0, lineEnd).toString("ascii"),
      );
      if (match === null) failV1("invalid_git_output");
      return match[1]!;
    })();
    session.commitTreeObjectIds.set(commit, pending);
  }
  return pending;
}

function safeTreeComponentV1(component: string): boolean {
  return (
    component.length > 0 &&
    component !== "." &&
    component !== ".." &&
    !component.includes("/") &&
    !/["\\\u0000-\u001f\u007f]/u.test(component) &&
    Buffer.byteLength(component, "utf8") <= MAX_PATH_BYTES_V1
  );
}

function parseTreeV1(bytes: Buffer): ReadonlyMap<string, TreeEntryV1> {
  const entries = new Map<string, TreeEntryV1>();
  const foldedNames = new Set<string>();
  for (const line of decodeUtf8V1(bytes).split("\n")) {
    if (line.length === 0) continue;
    const match = /^(\d{6}) (blob|tree|commit) ([0-9a-f]{40}|[0-9a-f]{64})\t(.+)$/u.exec(
      line,
    );
    if (match === null) failV1("invalid_git_output");
    const mode = match[1]!;
    const kind = match[2]!;
    const name = match[4]!;
    if (!safeTreeComponentV1(name)) failV1("unsafe_path");
    const supportedPair =
      (mode === "040000" && kind === "tree") ||
      ((mode === "100644" || mode === "100755") && kind === "blob");
    const unsupportedPair =
      (mode === "120000" && kind === "blob") ||
      (mode === "160000" && kind === "commit");
    if (!supportedPair && !unsupportedPair) failV1("invalid_git_output");
    const foldedName = name.normalize("NFC").toLowerCase();
    if (entries.has(name) || foldedNames.has(foldedName)) {
      failV1("invalid_git_output");
    }
    foldedNames.add(foldedName);
    entries.set(name, {
      mode: mode as TreeEntryV1["mode"],
      kind: unsupportedPair
        ? "unsupported"
        : kind as "blob" | "tree",
      objectId: match[3]!,
    });
  }
  return entries;
}

async function readHeadTreeEntryV1(
  session: SafeGitLayeredContentReadSessionStateV1,
  headCommit: string,
  repositoryPath: string,
  signal?: AbortSignal,
): Promise<GitEntryV1 | undefined> {
  let treeObjectId = await readCommitTreeObjectIdV1(
    session,
    headCommit,
    signal,
  );
  const components = repositoryPath.split("/");
  for (const [index, component] of components.entries()) {
    let pending = session.trees.get(treeObjectId);
    if (pending === undefined) {
      const currentTreeObjectId = treeObjectId;
      pending = readObjectV1(
        session,
        currentTreeObjectId,
        "tree",
        MAX_METADATA_BYTES_V1,
        signal,
      ).then(parseTreeV1);
      session.trees.set(currentTreeObjectId, pending);
    }
    const entry = (await pending).get(component!);
    if (entry === undefined) return undefined;
    const final = index === components.length - 1;
    if (!final) {
      if (entry.kind === "unsupported") failV1("unsupported_entry_type");
      if (entry.kind !== "tree") return undefined;
      treeObjectId = entry.objectId;
      continue;
    }
    if (entry.kind === "unsupported") {
      failV1("unsupported_entry_type");
    }
    if (entry.kind !== "blob") return undefined;
    if (entry.mode !== "100644" && entry.mode !== "100755") {
      failV1("invalid_git_output");
    }
    return { kind: "blob", mode: entry.mode, objectId: entry.objectId };
  }
  return undefined;
}

function parseIndexV1(bytes: Buffer): ReadonlyMap<string, IndexEntryV1> {
  if (bytes.length !== 0 && bytes.at(-1) !== 0) {
    failV1("invalid_git_output");
  }
  const entries = new Map<string, IndexEntryV1>();
  const foldedPaths = new Set<string>();
  const text = decodeUtf8V1(bytes);
  const records = text.length === 0 ? [] : text.slice(0, -1).split("\0");
  for (const record of records) {
    const match = /^(\d{6}) ([0-9a-f]{40}|[0-9a-f]{64}) (\d+)\t(.+)$/u.exec(
      record,
    );
    if (match === null) failV1("invalid_git_output");
    const mode = match[1]!;
    const stage = match[3]!;
    const path = match[4]!;
    if (!isSafePathV1(path)) failV1("unsafe_path");
    if (stage !== "0") failV1("unsupported_entry_type");
    const supportedMode = mode === "100644" || mode === "100755";
    const unsupportedMode = mode === "120000" || mode === "160000";
    if (!supportedMode && !unsupportedMode) failV1("invalid_git_output");
    const foldedPath = path.normalize("NFC").toLowerCase();
    if (entries.has(path) || foldedPaths.has(foldedPath)) {
      failV1("invalid_git_output");
    }
    foldedPaths.add(foldedPath);
    entries.set(path, supportedMode
      ? { kind: "blob", mode, objectId: match[2]! }
      : {
          kind: "unsupported",
          mode: mode as "120000" | "160000",
          objectId: match[2]!,
        });
  }
  return entries;
}

async function readIndexEntryV1(
  session: SafeGitLayeredContentReadSessionStateV1,
  repositoryPath: string,
  signal?: AbortSignal,
): Promise<GitEntryV1 | undefined> {
  let pending = session.index;
  if (pending === undefined) {
    pending = executeV1(
      session,
      ["ls-files", "--stage", "-z"],
      MAX_METADATA_BYTES_V1,
      "metadata",
      signal,
    ).then(parseIndexV1);
    session.index = pending;
  }
  const entry = (await pending).get(repositoryPath);
  if (entry?.kind === "unsupported") failV1("unsupported_entry_type");
  return entry;
}

/**
 * Reads the exact post-change bytes from the layer named by a Repository
 * change. Committed bytes come only from the caller-pinned HEAD commit;
 * staged bytes come only from the descriptor-bound Index. Worktree layers are
 * deliberately returned as not-applicable so their stable-file reader remains
 * a separate authority.
 */
export async function readSafeGitLayeredRepositoryChangeContentV1(
  executor: SafeGitReadExecutorV1,
  headCommit: string,
  change: SafeGitLayeredRepositoryChangeInputV1,
  options: SafeGitLayeredContentReadOptionsV1,
): Promise<SafeGitLayeredRepositoryContentV1> {
  validateInputV1(headCommit, change, options);
  if (
    change.source === "unstaged" ||
    change.source === "untracked" ||
    change.source === "conflict"
  ) {
    return Object.freeze({
      status: "not_applicable" as const,
      path: change.path,
      source: change.source,
    });
  }

  const session = sessionStateV1(executor, options.session);

  const layer = change.source === "committed" ? "head_tree" : "index";
  const entry = change.source === "committed"
    ? await readHeadTreeEntryV1(
        session,
        headCommit,
        change.path,
        options.signal,
      )
    : await readIndexEntryV1(session, change.path, options.signal);

  if (change.kind === "deleted") {
    if (entry !== undefined) failV1("change_mismatch");
    return Object.freeze({
      status: "absent" as const,
      path: change.path,
      source: change.source,
      layer,
    });
  }
  if (entry === undefined) failV1("change_mismatch");
  let pending = session.blobs.get(entry.objectId);
  if (pending === undefined) {
    pending = readObjectV1(
      session,
      entry.objectId,
      "blob",
      options.maxBytes,
      options.signal,
    );
    session.blobs.set(entry.objectId, pending);
  }
  const bytes = await pending;
  if (bytes.byteLength > options.maxBytes) failV1("budget_exceeded");
  if (
    options.expectedContentDigest !== undefined &&
    `sha256:${createHash("sha256").update(bytes).digest("hex")}` !==
      options.expectedContentDigest
  ) {
    failV1("change_mismatch");
  }
  return Object.freeze({
    status: "content" as const,
    path: change.path,
    source: change.source,
    layer,
    mode: entry.mode,
    objectId: entry.objectId,
    bytes,
  });
}
