import { createHash } from "node:crypto";
import {
  promises as fs,
  type Stats,
} from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import {
  RepositoryRelativePathSchema,
  RepositorySnapshotV1Schema,
  canonicalizeJson,
  type ContentDigest,
  type RepositoryChangeKindV1,
  type RepositoryChangeSourceV1,
  type RepositoryChangeV1,
  type RepositorySnapshotV1,
} from "@understand-code/contracts";
import {
  GitCommandError,
  GitOutputDecodingError,
  decodeGitText,
  executeGit,
  splitNul,
  type GitExecutionOptions,
  type GitFailureCode,
} from "./git.js";
import type { SafeGitReadExecutorV1 } from "./safe-git-read-command.js";
import {
  isSafeGitDescriptorBoundCapabilityV1,
  type SafeGitDescriptorBoundCapabilityV1,
} from "./safe-git-bootstrap.js";
import {
  StableFileReadError,
  hashStableAbsoluteFile,
  hashStableRepositoryFile,
  readStableRepositoryFile,
  type StableFileReadHooks,
} from "./safe-file.js";

const DEFAULT_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const SOURCE_ORDER: Readonly<Record<RepositoryChangeSourceV1, number>> = {
  committed: 0,
  staged: 1,
  unstaged: 2,
  untracked: 3,
  conflict: 4,
};

interface RepositorySnapshotCommonOptions {
  /**
   * Commit-ish used for baseline..HEAD committed changes. When omitted, HEAD
   * is the baseline and only Index/Worktree/Untracked changes are reported.
   */
  baselineRef?: string;
  maxBufferBytes?: number;
  signal?: AbortSignal;
  now?: () => Date;
}

export type RepositorySnapshotOptions = RepositorySnapshotCommonOptions &
  (
    | Readonly<{
        /** Descriptor-bound production executor; no cwd/PATH/env crosses it. */
        safeGitExecutor: SafeGitReadExecutorV1;
        gitBinary?: never;
        environment?: never;
      }>
    | Readonly<{
        /** Legacy/test-only host execution path. */
        safeGitExecutor?: never;
        gitBinary?: string;
        /** Explicit environment for legacy/test-only Git children. */
        environment?: NodeJS.ProcessEnv;
      }>
  );

/** Production options intentionally exclude raw executors, binaries and env. */
export type SafeGitProductionSnapshotOptionsV1 = Readonly<
  RepositorySnapshotCommonOptions
>;

export type RepositoryDiagnosticSeverity = "info" | "warning" | "error";

export interface RepositoryDiagnostic {
  code: string;
  severity: RepositoryDiagnosticSeverity;
  scope: "repository" | "git" | "worktree" | "submodule" | "path";
  message: string;
}

export interface RepositoryGitContext {
  branch?: string;
  detached: boolean;
  linkedWorktree: boolean;
  baselineCommit?: string;
  headCommit?: string;
  mergeBase?: string;
  ahead?: number;
  behind?: number;
}

export interface RepositorySnapshotCapture {
  snapshot: RepositorySnapshotV1;
  canonicalRoot: string;
  git: RepositoryGitContext;
  diagnostics: RepositoryDiagnostic[];
}

interface MutableChange {
  path: string;
  oldPath?: string;
  source: RepositoryChangeSourceV1;
  kind: RepositoryChangeKindV1;
  contentDigest?: ContentDigest;
  gitObjectId?: string;
  privateStateDigest?: ContentDigest;
}

interface ParsedWorktreeState {
  changes: MutableChange[];
  unsafeChanges: MutableChange[];
  limitations: string[];
  diagnostics: RepositoryDiagnostic[];
  branchFromStatus?: string;
}

interface CaptureIdentity {
  canonicalRoot: string;
  rootIdentity: string;
  repositoryId: string;
  worktreeId: string;
}

interface SnapshotCaptureTestHooks {
  fileHooksForPath?: (path: string) => StableFileReadHooks | undefined;
  /** Test-only fault injection after the first sample and before final validation. */
  beforeFinalValidation?: () => void | Promise<void>;
}

function sha256(value: string | Buffer): ContentDigest {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function stableDigest(value: unknown): ContentDigest {
  return sha256(canonicalizeJson(value));
}

function digestRelevantIndex(output: Buffer): ContentDigest {
  const hash = createHash("sha256");
  let offset = 0;
  while (offset < output.length) {
    const terminator = output.indexOf(0, offset);
    const end = terminator < 0 ? output.length : terminator;
    const record = output.subarray(offset, end);
    const tab = record.indexOf(0x09);
    const path =
      tab < 0 ? "" : record.subarray(tab + 1).toString("utf8");
    if (!isManagedArtifactPath(path)) {
      hash.update(record);
      hash.update(Buffer.from([0]));
    }
    if (terminator < 0) break;
    offset = terminator + 1;
  }
  return `sha256:${hash.digest("hex")}`;
}

function indexContainsGitlink(output: Buffer): boolean {
  const gitlinkPrefix = Buffer.from("160000 ", "ascii");
  let offset = 0;
  while (offset < output.length) {
    const terminator = output.indexOf(0, offset);
    const end = terminator < 0 ? output.length : terminator;
    if (
      end - offset >= gitlinkPrefix.length &&
      output.subarray(offset, offset + gitlinkPrefix.length).equals(gitlinkPrefix)
    ) {
      return true;
    }
    if (terminator < 0) break;
    offset = terminator + 1;
  }
  return false;
}

function opaqueId(prefix: string, value: unknown): string {
  return `${prefix}-${stableDigest(value).slice("sha256:".length)}`;
}

function normalizeAbsolutePath(path: string): string {
  return process.platform === "win32" ? path.toLowerCase() : path;
}

async function realpathOrResolved(path: string): Promise<string> {
  const absolute = resolve(path);
  try {
    return await fs.realpath(absolute);
  } catch {
    return absolute;
  }
}

function takeSpaceFields(
  value: string,
  count: number,
): { fields: string[]; remainder: string } | null {
  const fields: string[] = [];
  let offset = 0;
  for (let index = 0; index < count; index += 1) {
    const nextSpace = value.indexOf(" ", offset);
    if (nextSpace < 0) return null;
    fields.push(value.slice(offset, nextSpace));
    offset = nextSpace + 1;
  }
  return { fields, remainder: value.slice(offset) };
}

function isSafeRepositoryPath(path: string): boolean {
  return RepositoryRelativePathSchema.safeParse(path).success;
}

function isManagedArtifactPath(path: string): boolean {
  return path === ".understand-code" || path.startsWith(".understand-code/");
}

const SENSITIVE_PATH_COMPONENTS = new Set([
  ".aws",
  ".git",
  ".git-credentials",
  ".gnupg",
  ".kube",
  ".netrc",
  ".npmrc",
  ".pypirc",
  ".ssh",
  "application_default_credentials.json",
  "auth.json",
  "credential",
  "credentials",
  "credentials.json",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "id_rsa",
  "secret",
  "secrets",
  "secrets.json",
]);

const PUBLIC_ENV_TEMPLATE_NAMES = new Set([
  ".env.example",
  ".env.sample",
  ".env.template",
]);

/**
 * Single repository-wide classifier for paths whose content must never enter
 * analysis or Preview surfaces. Callers must pass a decoded path; both POSIX
 * and Windows separators are accepted so persisted cross-platform paths do
 * not bypass the same policy.
 */
export function isSensitiveRepositoryPath(path: string): boolean {
  const segments = path
    .replaceAll("\\", "/")
    .toLowerCase()
    .split("/")
    .filter(Boolean);
  return segments.some(
    (segment, index) =>
      SENSITIVE_PATH_COMPONENTS.has(segment) ||
      ((segment === ".env" || segment.startsWith(".env.")) &&
        !(
          index === segments.length - 1 &&
          PUBLIC_ENV_TEMPLATE_NAMES.has(segment)
        )) ||
      (index === segments.length - 1 &&
        (segment.startsWith("credentials.") ||
          segment.startsWith("secrets.") ||
          segment.endsWith(".pem") ||
          segment.endsWith(".key") ||
          segment.endsWith(".p12") ||
          segment.endsWith(".pfx") ||
          /^id_(?:dsa|ecdsa|ed25519|rsa)(?:\..+)?$/u.test(segment) ||
          /^service-account.*\.json$/u.test(segment))),
  );
}

function unsafePathLimitation(path: string): string {
  return `unsafe repository path omitted (${sha256(Buffer.from(path, "utf8"))})`;
}

function mapStatusKind(status: string): RepositoryChangeKindV1 | null {
  switch (status) {
    case ".":
    case " ":
      return null;
    case "A":
      return "added";
    case "M":
      return "modified";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "T":
      return "type_changed";
    case "U":
      return "modified";
    default:
      return null;
  }
}

function parsePorcelainV2(output: Buffer): ParsedWorktreeState {
  const fields = splitNul(output);
  const changes: MutableChange[] = [];
  const unsafeChanges: MutableChange[] = [];
  const limitations: string[] = [];
  const diagnostics: RepositoryDiagnostic[] = [];
  let branchFromStatus: string | undefined;

  const addPathChange = (
    path: string,
    source: RepositoryChangeSourceV1,
    kind: RepositoryChangeKindV1,
    oldPath?: string,
    gitObjectId?: string,
  ): void => {
    if (
      isManagedArtifactPath(path) ||
      (oldPath !== undefined && isManagedArtifactPath(oldPath))
    ) {
      return;
    }
    if (
      !isSafeRepositoryPath(path) ||
      (oldPath !== undefined && !isSafeRepositoryPath(oldPath))
    ) {
      unsafeChanges.push({
        path,
        source,
        kind,
        ...(oldPath === undefined ? {} : { oldPath }),
        ...(gitObjectId === undefined ? {} : { gitObjectId }),
      });
      limitations.push(unsafePathLimitation(path));
      diagnostics.push({
        code: "unsafe_git_path",
        severity: "warning",
        scope: "path",
        message:
          "A changed path contains characters that cannot be represented by the public V1 contract",
      });
      return;
    }
    changes.push({
      path,
      source,
      kind,
      ...(oldPath === undefined ? {} : { oldPath }),
      ...(gitObjectId === undefined ? {} : { gitObjectId }),
    });
  };

  for (let index = 0; index < fields.length; index += 1) {
    const record = fields[index];
    if (record === undefined || record.length === 0) continue;

    if (record.startsWith("# branch.head ")) {
      const candidate = record.slice("# branch.head ".length);
      if (candidate !== "(detached)" && candidate !== "(initial)") {
        branchFromStatus = candidate;
      }
      continue;
    }
    if (record.startsWith("#")) continue;

    if (record.startsWith("? ")) {
      const untrackedPath = record.slice(2);
      if (untrackedPath.endsWith("/")) {
        const directoryPath = untrackedPath.replace(/\/+$/u, "");
        addPathChange(directoryPath, "untracked", "added");
        limitations.push(
          `untracked directory is summarized at a repository boundary (${sha256(
            Buffer.from(directoryPath, "utf8"),
          )})`,
        );
        diagnostics.push({
          code: "untracked_directory_boundary",
          severity: "warning",
          scope: "repository",
          message:
            "An untracked nested repository or directory is summarized as one boundary change",
        });
      } else {
        addPathChange(untrackedPath, "untracked", "added");
      }
      continue;
    }
    if (record.startsWith("! ")) continue;

    if (record.startsWith("1 ")) {
      const parsed = takeSpaceFields(record.slice(2), 7);
      if (parsed === null || parsed.fields.length !== 7) {
        throw new Error("Malformed Git porcelain v2 ordinary record");
      }
      const [xy, submodule, , , , , indexObjectId] = parsed.fields;
      if (xy === undefined || xy.length !== 2 || submodule === undefined) {
        throw new Error("Malformed Git porcelain v2 ordinary status");
      }
      const stagedKind = mapStatusKind(xy[0] ?? ".");
      const unstagedKind = mapStatusKind(xy[1] ?? ".");
      if (stagedKind !== null) {
        addPathChange(
          parsed.remainder,
          "staged",
          stagedKind,
          undefined,
          indexObjectId,
        );
      }
      if (unstagedKind !== null) {
        addPathChange(parsed.remainder, "unstaged", unstagedKind);
      }
      if (submodule.startsWith("S") && submodule !== "S...") {
        limitations.push(
          "dirty submodule content is summarized at the gitlink boundary",
        );
        diagnostics.push({
          code: "submodule_dirty",
          severity: "warning",
          scope: "submodule",
          message:
            "A submodule has commit, tracked-content, or untracked-content changes",
        });
      }
      continue;
    }

    if (record.startsWith("2 ")) {
      const parsed = takeSpaceFields(record.slice(2), 8);
      const oldPath = fields[index + 1];
      if (
        parsed === null ||
        parsed.fields.length !== 8 ||
        oldPath === undefined
      ) {
        throw new Error("Malformed Git porcelain v2 rename/copy record");
      }
      index += 1;
      const [xy, submodule, , , , , indexObjectId, score] = parsed.fields;
      if (
        xy === undefined ||
        xy.length !== 2 ||
        submodule === undefined ||
        score === undefined
      ) {
        throw new Error("Malformed Git porcelain v2 rename/copy status");
      }
      const scoredKind: RepositoryChangeKindV1 = score.startsWith("C")
        ? "copied"
        : "renamed";
      const stagedKind =
        xy[0] === "R" || xy[0] === "C"
          ? scoredKind
          : mapStatusKind(xy[0] ?? ".");
      const unstagedKind =
        xy[1] === "R" || xy[1] === "C"
          ? scoredKind
          : mapStatusKind(xy[1] ?? ".");
      if (stagedKind !== null) {
        addPathChange(
          parsed.remainder,
          "staged",
          stagedKind,
          stagedKind === "renamed" || stagedKind === "copied"
            ? oldPath
            : undefined,
          indexObjectId,
        );
      }
      if (unstagedKind !== null) {
        addPathChange(
          parsed.remainder,
          "unstaged",
          unstagedKind,
          unstagedKind === "renamed" || unstagedKind === "copied"
            ? oldPath
            : undefined,
        );
      }
      if (submodule.startsWith("S") && submodule !== "S...") {
        limitations.push(
          "dirty submodule content is summarized at the gitlink boundary",
        );
        diagnostics.push({
          code: "submodule_dirty",
          severity: "warning",
          scope: "submodule",
          message:
            "A renamed or copied submodule has nested changes",
        });
      }
      continue;
    }

    if (record.startsWith("u ")) {
      const parsed = takeSpaceFields(record.slice(2), 9);
      if (parsed === null || parsed.fields.length !== 9) {
        throw new Error("Malformed Git porcelain v2 unmerged record");
      }
      addPathChange(parsed.remainder, "conflict", "modified");
      diagnostics.push({
        code: "merge_conflict",
        severity: "warning",
        scope: "worktree",
        message: "The worktree contains an unresolved merge conflict",
      });
      continue;
    }

    throw new Error("Unsupported Git porcelain v2 record");
  }

  return {
    changes,
    unsafeChanges,
    limitations: [...new Set(limitations)].sort(),
    diagnostics,
    ...(branchFromStatus === undefined ? {} : { branchFromStatus }),
  };
}

function parseNameStatus(
  output: Buffer,
  source: "committed" | "staged" = "committed",
): {
  changes: MutableChange[];
  unsafeChanges: MutableChange[];
  limitations: string[];
  diagnostics: RepositoryDiagnostic[];
} {
  const fields = splitNul(output);
  const changes: MutableChange[] = [];
  const unsafeChanges: MutableChange[] = [];
  const limitations: string[] = [];
  const diagnostics: RepositoryDiagnostic[] = [];

  const recordUnsafe = (
    path: string,
    kind: RepositoryChangeKindV1,
    oldPath?: string,
  ): void => {
    unsafeChanges.push({
      path,
      source,
      kind,
      ...(oldPath === undefined ? {} : { oldPath }),
    });
    limitations.push(unsafePathLimitation(path));
    diagnostics.push({
      code: "unsafe_git_path",
      severity: "warning",
      scope: "path",
      message:
        "A committed path contains characters that cannot be represented by the public V1 contract",
    });
  };

  for (let index = 0; index < fields.length; ) {
    const status = fields[index];
    const path = fields[index + 1];
    if (status === undefined || path === undefined) {
      throw new Error("Malformed Git --name-status -z output");
    }
    index += 2;
    const statusCode = status[0];
    if (statusCode === undefined) {
      throw new Error("Empty Git name-status code");
    }
    const kind = mapStatusKind(statusCode);
    if (kind === null) {
      throw new Error(`Unsupported Git name-status code: ${statusCode}`);
    }
    if (kind === "renamed" || kind === "copied") {
      const newPath = fields[index];
      if (newPath === undefined) {
        throw new Error("Rename/copy record is missing its new path");
      }
      index += 1;
      if (
        isManagedArtifactPath(path) ||
        isManagedArtifactPath(newPath)
      ) {
        continue;
      }
      if (!isSafeRepositoryPath(path) || !isSafeRepositoryPath(newPath)) {
        recordUnsafe(newPath, kind, path);
        continue;
      }
      changes.push({
        source,
        kind,
        path: newPath,
        oldPath: path,
      });
      continue;
    }
    if (isManagedArtifactPath(path)) continue;
    if (!isSafeRepositoryPath(path)) {
      recordUnsafe(path, kind);
      continue;
    }
    changes.push({ source, kind, path });
  }

  return {
    changes,
    unsafeChanges,
    limitations: [...new Set(limitations)].sort(),
    diagnostics,
  };
}

async function digestStream(path: string): Promise<ContentDigest> {
  const hash = createHash("sha256");
  await hashStableAbsoluteFile(path, (chunk) => hash.update(chunk));
  return `sha256:${hash.digest("hex")}`;
}

async function assertNoSymlinkParent(
  canonicalRoot: string,
  repositoryPath: string,
): Promise<void> {
  const segments = repositoryPath.split("/");
  let cursor = canonicalRoot;
  for (const segment of segments.slice(0, -1)) {
    cursor = join(cursor, segment);
    const stat = await fs.lstat(cursor);
    if (stat.isSymbolicLink()) {
      throw new Error("repository path traverses a symbolic-link parent");
    }
  }
}

function digestSpecialFile(stat: Stats): ContentDigest {
  return stableDigest({
    type: stat.isDirectory()
      ? "directory"
      : stat.isFIFO()
        ? "fifo"
        : stat.isSocket()
          ? "socket"
          : stat.isCharacterDevice()
            ? "character_device"
            : stat.isBlockDevice()
              ? "block_device"
              : "other",
    mode: stat.mode,
    size: stat.size,
  });
}

async function digestRepositoryPath(
  canonicalRoot: string,
  repositoryPath: string,
  hooks?: StableFileReadHooks,
): Promise<ContentDigest | undefined> {
  await assertNoSymlinkParent(canonicalRoot, repositoryPath);
  const absolutePath = join(canonicalRoot, ...repositoryPath.split("/"));
  const stat = await fs.lstat(absolutePath);
  if (stat.isSymbolicLink()) {
    return sha256(Buffer.from(await fs.readlink(absolutePath), "utf8"));
  }
  if (stat.isFile()) {
    const hash = createHash("sha256");
    await hashStableRepositoryFile(
      canonicalRoot,
      repositoryPath,
      (chunk) => hash.update(chunk),
      hooks,
    );
    return `sha256:${hash.digest("hex")}`;
  }
  if (stat.isDirectory()) return undefined;
  return digestSpecialFile(stat);
}

async function digestRepositoryPathMetadata(
  canonicalRoot: string,
  repositoryPath: string,
): Promise<ContentDigest> {
  await assertNoSymlinkParent(canonicalRoot, repositoryPath);
  const absolutePath = join(canonicalRoot, ...repositoryPath.split("/"));
  const stat = await fs.lstat(absolutePath, { bigint: true });
  return stableDigest({
    device: stat.dev.toString(),
    inode: stat.ino.toString(),
    mode: stat.mode.toString(),
    size: stat.size.toString(),
    mtimeNs: stat.mtimeNs.toString(),
    ctimeNs: stat.ctimeNs.toString(),
    type: stat.isSymbolicLink()
      ? "symlink"
      : stat.isFile()
        ? "file"
        : stat.isDirectory()
          ? "directory"
          : "special",
  });
}

async function mapWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  concurrency: number,
  map: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  const output = new Array<TOutput>(items.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item !== undefined) output[index] = await map(item, index);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), items.length) },
      worker,
    ),
  );
  return output;
}

type SettledValues<T extends readonly unknown[]> = {
  [K in keyof T]: Awaited<T[K]>;
};

/**
 * Waits for every child operation before surfacing the first failure. This
 * prevents a rejected Git batch from returning while sibling child processes
 * are still touching the repository.
 */
async function allSettledOrThrow<const T extends readonly Promise<unknown>[]>(
  promises: T,
): Promise<SettledValues<T>> {
  const results = await Promise.allSettled(promises);
  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (rejected !== undefined) throw rejected.reason;
  return results.map((result) => {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  }) as unknown as SettledValues<T>;
}

async function attachContentDigests(
  canonicalRoot: string,
  changes: MutableChange[],
  execution: GitExecutionOptions,
  hooksForPath?: (path: string) => StableFileReadHooks | undefined,
): Promise<{
  changes: MutableChange[];
  limitations: string[];
  sensitivePathDigests: string[];
  diagnostics: RepositoryDiagnostic[];
}> {
  const limitations: string[] = [];
  const sensitivePathDigests: string[] = [];
  const diagnostics: RepositoryDiagnostic[] = [];
  const cache = new Map<string, Promise<ContentDigest | undefined>>();
  const digestForPath = (path: string): Promise<ContentDigest | undefined> => {
    const existing = cache.get(path);
    if (existing !== undefined) return existing;
    const pending = digestRepositoryPath(
      canonicalRoot,
      path,
      hooksForPath?.(path),
    );
    cache.set(path, pending);
    return pending;
  };

  const enriched = await mapWithConcurrency(
    changes,
    16,
    async (change): Promise<MutableChange> => {
      if (change.kind === "deleted") return change;
      try {
        if (isSensitiveRepositoryPath(change.path)) {
          const pathDigest = sha256(Buffer.from(change.path, "utf8"));
          sensitivePathDigests.push(pathDigest);
          limitations.push(
            `sensitive path excluded from content analysis (${pathDigest})`,
          );
          return {
            ...change,
            privateStateDigest: await digestRepositoryPathMetadata(
              canonicalRoot,
              change.path,
            ),
          };
        }
        if (
          change.source === "staged" &&
          change.gitObjectId !== undefined &&
          !/^0+$/u.test(change.gitObjectId)
        ) {
          const indexContent = await executeGit(
            ["cat-file", "-p", change.gitObjectId],
            execution,
          );
          return { ...change, contentDigest: sha256(indexContent.stdout) };
        }
        if (change.source === "committed" || change.source === "staged") {
          return change;
        }
        const contentDigest = await digestForPath(change.path);
        return contentDigest === undefined ? change : { ...change, contentDigest };
      } catch (error) {
        const pathDigest = sha256(change.path);
        if (
          error instanceof StableFileReadError &&
          error.code === "changed_during_read"
        ) {
          limitations.push(
            `changed content changed during snapshot capture (${pathDigest})`,
          );
          diagnostics.push({
            code: "repository_path_changed_during_capture",
            severity: "warning",
            scope: "path",
            message: "A changed path was modified while its content was read",
          });
        } else {
          limitations.push(
            `changed content could not be read (${pathDigest})`,
          );
        }
        return change;
      }
    },
  );
  return {
    changes: enriched,
    limitations: [...new Set(limitations)].sort(),
    sensitivePathDigests: [...new Set(sensitivePathDigests)].sort(),
    diagnostics,
  };
}

function compareMutableChanges(left: MutableChange, right: MutableChange): number {
  return (
    SOURCE_ORDER[left.source] - SOURCE_ORDER[right.source] ||
    left.path.localeCompare(right.path, "en") ||
    (left.oldPath ?? "").localeCompare(right.oldPath ?? "", "en") ||
    left.kind.localeCompare(right.kind, "en")
  );
}

function finalizeChanges(changes: MutableChange[]): RepositoryChangeV1[] {
  const publicChanges = changes.map(
    ({
      gitObjectId: _gitObjectId,
      privateStateDigest: _privateStateDigest,
      ...change
    }) => change,
  );
  const sorted = [...publicChanges].sort(compareMutableChanges);
  const seen = new Set<string>();
  const unique = sorted.filter((change) => {
    const key = canonicalizeJson(change);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.map((change, index) => ({
    id: opaqueId("change", { ...change, ordinal: index }),
    ...change,
  }));
}

function digestibleChanges(changes: readonly MutableChange[]): unknown[] {
  return changes.map(
    ({ gitObjectId: _gitObjectId, ...change }) => change,
  );
}

function opaqueUnsafeChanges(changes: readonly MutableChange[]): unknown[] {
  return changes
    .map((change) => ({
      source: change.source,
      kind: change.kind,
      pathDigest: sha256(Buffer.from(change.path, "utf8")),
      ...(change.oldPath === undefined
        ? {}
        : { oldPathDigest: sha256(Buffer.from(change.oldPath, "utf8")) }),
      ...(change.contentDigest === undefined
        ? {}
        : { contentDigest: change.contentDigest }),
      ...(change.privateStateDigest === undefined
        ? {}
        : { privateStateDigest: change.privateStateDigest }),
    }))
    .sort((left, right) =>
      canonicalizeJson(left).localeCompare(canonicalizeJson(right), "en"),
    );
}

async function resolveGitDirectory(
  rawPath: string,
  canonicalRoot: string,
): Promise<string> {
  const candidate = isAbsolute(rawPath)
    ? rawPath
    : resolve(canonicalRoot, rawPath);
  return realpathOrResolved(candidate);
}

function assertSafeBaselineRef(baselineRef: string): void {
  if (
    baselineRef.length === 0 ||
    baselineRef.length > 1_024 ||
    baselineRef.startsWith("-") ||
    /[\u0000-\u001f\u007f]/u.test(baselineRef)
  ) {
    throw new Error("baselineRef is not a safe Git revision");
  }
}

async function digestIgnoreConfiguration(
  identity: CaptureIdentity,
  execution: GitExecutionOptions,
  commonGitDirectory: string,
): Promise<{ digest: ContentDigest; limitations: string[] }> {
  const pathsOutput = await executeGit(
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
    execution,
  );
  const repositoryIgnorePaths = splitNul(pathsOutput.stdout)
    .filter(isSafeRepositoryPath)
    .sort();
  const entries: Array<{ identity: string; digest: ContentDigest }> = [];
  const limitations: string[] = [];

  for (const repositoryPath of repositoryIgnorePaths) {
    try {
      const digest = await digestRepositoryPath(
        identity.canonicalRoot,
        repositoryPath,
      );
      if (digest !== undefined) {
        entries.push({ identity: repositoryPath, digest });
      }
    } catch {
      limitations.push(
        `ignore rule file could not be read (${sha256(repositoryPath)})`,
      );
    }
  }

  const localExcludePath = join(commonGitDirectory, "info", "exclude");
  try {
    const localExcludeStat = await fs.lstat(localExcludePath);
    if (localExcludeStat.isFile()) {
      entries.push({
        identity: "git-common-dir/info/exclude",
        digest: await digestStream(localExcludePath),
      });
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      limitations.push("Git info/exclude could not be read");
    }
  }

  const globalExclude = await executeGit(
    ["config", "--path", "--get", "core.excludesfile"],
    execution,
    [0, 1],
  );
  if (globalExclude.exitCode === 0) {
    const configuredPath = decodeGitText(globalExclude.stdout);
    if (configuredPath.length > 0) {
      try {
        entries.push({
          identity: "global-core-excludesfile",
          digest: await digestStream(configuredPath),
        });
      } catch {
        limitations.push("Configured global Git excludes file could not be read");
      }
    }
  }

  return {
    digest: stableDigest(entries.sort((left, right) =>
      left.identity.localeCompare(right.identity, "en"),
    )),
    limitations: [...new Set(limitations)].sort(),
  };
}

function buildIdentity(
  canonicalRoot: string,
  commonGitDirectory?: string,
  gitDirectory?: string,
): CaptureIdentity {
  const rootIdentity = opaqueId("root", {
    canonicalRoot: normalizeAbsolutePath(canonicalRoot),
  });
  const repositoryId = opaqueId("repo", {
    commonGitDirectory: normalizeAbsolutePath(
      commonGitDirectory ?? canonicalRoot,
    ),
  });
  const worktreeId = opaqueId("worktree", {
    repositoryId,
    canonicalRoot: normalizeAbsolutePath(canonicalRoot),
    gitDirectory: normalizeAbsolutePath(gitDirectory ?? canonicalRoot),
  });
  return { canonicalRoot, rootIdentity, repositoryId, worktreeId };
}

function makeSnapshot(
  identity: CaptureIdentity,
  input: Omit<RepositorySnapshotV1, "schemaVersion" | "snapshotId" | "repositoryId" | "worktreeId" | "rootIdentity">,
): RepositorySnapshotV1 {
  const { createdAt: _createdAt, ...stableInput } = input;
  const stableState = {
    repositoryId: identity.repositoryId,
    worktreeId: identity.worktreeId,
    rootIdentity: identity.rootIdentity,
    ...stableInput,
  };
  const snapshot = {
    schemaVersion: 1 as const,
    snapshotId: opaqueId("snapshot", stableState),
    repositoryId: identity.repositoryId,
    worktreeId: identity.worktreeId,
    rootIdentity: identity.rootIdentity,
    ...input,
  };
  return RepositorySnapshotV1Schema.parse(snapshot);
}

function gitFailureDiagnostic(error: unknown): {
  code: GitFailureCode | "repository_capture_failed";
  message: string;
} {
  if (error instanceof GitCommandError) {
    return {
      code: error.failureCode,
      message:
        error.failureCode === "git_unavailable"
          ? "Git is unavailable; repository state is unknown"
          : "A required Git query failed; repository state is unknown",
    };
  }
  if (error instanceof GitOutputDecodingError) {
    return {
      code: error.failureCode,
      message:
        "Git returned a non-UTF-8 path that cannot be represented by the public V1 contract",
    };
  }
  return {
    code: "repository_capture_failed",
    message: "Repository state capture failed before it could prove cleanliness",
  };
}

async function makeErrorCapture(
  root: string,
  error: unknown,
  now: () => Date,
): Promise<RepositorySnapshotCapture> {
  const canonicalRoot = await realpathOrResolved(root);
  const identity = buildIdentity(canonicalRoot);
  const failure = gitFailureDiagnostic(error);
  const limitation = `${failure.code}: ${failure.message}`;
  const snapshot = makeSnapshot(identity, {
    indexDigest: stableDigest({ state: "unknown", scope: "index", code: failure.code }),
    worktreeDigest: stableDigest({
      state: "unknown",
      scope: "worktree",
      code: failure.code,
    }),
    untrackedDigest: stableDigest({
      state: "unknown",
      scope: "untracked",
      code: failure.code,
    }),
    ignoreDigest: stableDigest({
      state: "unknown",
      scope: "ignore",
      code: failure.code,
    }),
    createdAt: now().toISOString(),
    captureStatus: "error",
    limitations: [limitation],
    changes: [],
  });
  return {
    snapshot,
    canonicalRoot,
    git: { detached: false, linkedWorktree: false },
    diagnostics: [
      {
        code: failure.code,
        severity: "error",
        scope: "git",
        message: failure.message,
      },
    ],
  };
}

/**
 * Captures a contract-valid snapshot plus host-only Git diagnostics.
 *
 * The public snapshot never turns a failed Git command into an empty/clean
 * result. Any required command failure produces captureStatus=error.
 */
async function captureRepositorySnapshotDetailed(
  root: string,
  options: RepositorySnapshotOptions = {},
  testHooks: SnapshotCaptureTestHooks = {},
): Promise<RepositorySnapshotCapture> {
  const now = options.now ?? (() => new Date());
  const maxBufferBytes = options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;

  try {
    const canonicalRoot = await fs.realpath(resolve(root));
    const rootStat = await fs.stat(canonicalRoot);
    if (!rootStat.isDirectory()) {
      throw new Error("Repository root is not a directory");
    }
    const execution: GitExecutionOptions =
      options.safeGitExecutor === undefined
        ? {
            gitBinary: options.gitBinary ?? "git",
            cwd: canonicalRoot,
            maxBufferBytes,
            ...(options.environment === undefined
              ? {}
              : { environment: options.environment }),
            ...(options.signal === undefined ? {} : { signal: options.signal }),
          }
        : {
            safeGitExecutor: options.safeGitExecutor,
            maxBufferBytes,
            ...(options.signal === undefined ? {} : { signal: options.signal }),
          };

    const topLevelResult = await executeGit(
      ["rev-parse", "--show-toplevel"],
      execution,
    );
    const topLevel = await realpathOrResolved(decodeGitText(topLevelResult.stdout));
    if (
      normalizeAbsolutePath(topLevel) !== normalizeAbsolutePath(canonicalRoot)
    ) {
      throw new Error("Input root is not the canonical Git worktree root");
    }

    const [gitDirectoryResult, commonGitDirectoryResult] =
      await allSettledOrThrow([
        executeGit(["rev-parse", "--absolute-git-dir"], execution),
        executeGit(
          ["rev-parse", "--path-format=absolute", "--git-common-dir"],
          execution,
        ),
      ]);
    const gitDirectory = await resolveGitDirectory(
      decodeGitText(gitDirectoryResult.stdout),
      canonicalRoot,
    );
    const commonGitDirectory = await resolveGitDirectory(
      decodeGitText(commonGitDirectoryResult.stdout),
      canonicalRoot,
    );
    const identity = buildIdentity(
      canonicalRoot,
      commonGitDirectory,
      gitDirectory,
    );

    const statusArguments = [
      "status",
      "--porcelain=v2",
      "--branch",
      "-z",
      "--untracked-files=all",
      "--ignore-submodules=none",
    ] as const;
    const [statusBeforeResult, headResult, branchResult, indexResult] =
      await allSettledOrThrow([
        executeGit(statusArguments, execution),
        executeGit(["rev-parse", "--verify", "HEAD^{commit}"], execution),
        executeGit(
          ["symbolic-ref", "--quiet", "--short", "HEAD"],
          execution,
          [0, 1],
        ),
        executeGit(["ls-files", "--stage", "-z"], execution),
      ]);
    const headCommit = decodeGitText(headResult.stdout);
    const detached = branchResult.exitCode === 1;
    const symbolicBranch = detached
      ? undefined
      : decodeGitText(branchResult.stdout);
    const parsedWorktree = parsePorcelainV2(statusBeforeResult.stdout);
    const branch = symbolicBranch ?? parsedWorktree.branchFromStatus;

    const baselineRef = options.baselineRef ?? headCommit;
    assertSafeBaselineRef(baselineRef);
    const baselineResult = await executeGit(
      [
        "rev-parse",
        "--verify",
        "--end-of-options",
        `${baselineRef}^{commit}`,
      ],
      execution,
    );
    const baselineCommit = decodeGitText(baselineResult.stdout);
    const [
      mergeBaseResult,
      aheadBehindResult,
      committedResult,
      stagedResult,
    ] =
      await allSettledOrThrow([
        executeGit(["merge-base", baselineCommit, headCommit], execution),
        executeGit(
          ["rev-list", "--left-right", "--count", `${baselineCommit}...${headCommit}`],
          execution,
        ),
        executeGit(
          [
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--name-status",
            "-z",
            "--no-renames",
            `${baselineCommit}..${headCommit}`,
            "--",
          ],
          execution,
        ),
        executeGit(
          [
            "diff",
            "--cached",
            "--no-ext-diff",
            "--no-textconv",
            "--name-status",
            "-z",
            "--no-renames",
            headCommit,
            "--",
          ],
          execution,
        ),
      ]);
    const mergeBase = decodeGitText(mergeBaseResult.stdout);
    const aheadBehindParts = decodeGitText(aheadBehindResult.stdout)
      .trim()
      .split(/\s+/u);
    const behind = Number.parseInt(aheadBehindParts[0] ?? "", 10);
    const ahead = Number.parseInt(aheadBehindParts[1] ?? "", 10);
    if (!Number.isSafeInteger(ahead) || !Number.isSafeInteger(behind)) {
      throw new Error("Git returned invalid ahead/behind counts");
    }

    const committed = parseNameStatus(committedResult.stdout);
    const stagedSemantic = parseNameStatus(stagedResult.stdout, "staged");
    const porcelainStagedByPath = new Map(
      parsedWorktree.changes
        .filter((change) => change.source === "staged")
        .map((change) => [change.path, change]),
    );
    const conflictPaths = new Set(
      parsedWorktree.changes
        .filter((change) => change.source === "conflict")
        .map((change) => change.path),
    );
    const stagedChanges = stagedSemantic.changes
      .filter((change) => !conflictPaths.has(change.path))
      .map((change) => {
        const porcelain = porcelainStagedByPath.get(change.path);
        return porcelain?.gitObjectId === undefined
          ? change
          : { ...change, gitObjectId: porcelain.gitObjectId };
      });
    const porcelainUnsafeStagedByPath = new Map(
      parsedWorktree.unsafeChanges
        .filter((change) => change.source === "staged")
        .map((change) => [change.path, change]),
    );
    const unsafeConflictPaths = new Set(
      parsedWorktree.unsafeChanges
        .filter((change) => change.source === "conflict")
        .map((change) => change.path),
    );
    const unsafeStagedChanges = stagedSemantic.unsafeChanges
      .filter((change) => !unsafeConflictPaths.has(change.path))
      .map((change) => {
        const porcelain = porcelainUnsafeStagedByPath.get(change.path);
        return porcelain?.gitObjectId === undefined
          ? change
          : { ...change, gitObjectId: porcelain.gitObjectId };
      });
    const combinedChanges = [
      ...committed.changes,
      ...stagedChanges,
      ...parsedWorktree.changes.filter(
        (change) => change.source !== "staged",
      ),
    ];
    const combinedUnsafeChanges = [
      ...unsafeStagedChanges,
      ...parsedWorktree.unsafeChanges.filter(
        (change) => change.source !== "staged",
      ),
    ];
    const enriched = await attachContentDigests(
      canonicalRoot,
      combinedChanges,
      execution,
      testHooks.fileHooksForPath,
    );
    const unsafeEnriched = await attachContentDigests(
      canonicalRoot,
      combinedUnsafeChanges,
      execution,
      testHooks.fileHooksForPath,
    );
    const changes = finalizeChanges(enriched.changes);

    const ignore = await digestIgnoreConfiguration(
      identity,
      execution,
      commonGitDirectory,
    );
    await testHooks.beforeFinalValidation?.();
    const [
      statusAfterResult,
      headAfterResult,
      indexAfterResult,
      ignoreAfter,
      enrichedAfter,
      unsafeEnrichedAfter,
      submoduleResult,
    ] = await allSettledOrThrow([
      executeGit(statusArguments, execution),
      executeGit(["rev-parse", "--verify", "HEAD^{commit}"], execution),
      executeGit(["ls-files", "--stage", "-z"], execution),
      digestIgnoreConfiguration(identity, execution, commonGitDirectory),
      attachContentDigests(
        canonicalRoot,
        combinedChanges,
        execution,
        testHooks.fileHooksForPath,
      ),
      attachContentDigests(
        canonicalRoot,
        combinedUnsafeChanges,
        execution,
        testHooks.fileHooksForPath,
      ),
      options.safeGitExecutor === undefined
        ? executeGit(
            ["submodule", "status", "--recursive"],
            execution,
            [0, 1],
          )
        : Promise.resolve(undefined),
    ]);
    const parsedWorktreeAfter = parsePorcelainV2(statusAfterResult.stdout);
    const headCommitAfter = decodeGitText(headAfterResult.stdout);

    const limitations = [
      ...committed.limitations,
      ...stagedSemantic.limitations,
      ...parsedWorktree.limitations,
      ...enriched.limitations,
      ...unsafeEnriched.limitations,
      ...ignore.limitations,
    ];
    const diagnostics = [
      ...committed.diagnostics,
      ...stagedSemantic.diagnostics,
      ...parsedWorktree.diagnostics,
      ...enriched.diagnostics,
      ...unsafeEnriched.diagnostics,
    ];
    for (const _pathDigest of new Set([
      ...enriched.sensitivePathDigests,
      ...unsafeEnriched.sensitivePathDigests,
    ])) {
      diagnostics.push({
        code: "sensitive_path_content_filtered",
        severity: "warning",
        scope: "path",
        message:
          "A changed sensitive path is reported but excluded from content analysis",
      });
    }

    const worktreeStateBefore = stableDigest({
      ...(parsedWorktree.branchFromStatus === undefined
        ? {}
        : { branch: parsedWorktree.branchFromStatus }),
      changes: [...parsedWorktree.changes].sort(compareMutableChanges),
      unsafeChanges: opaqueUnsafeChanges(parsedWorktree.unsafeChanges),
    });
    const worktreeStateAfter = stableDigest({
      ...(parsedWorktreeAfter.branchFromStatus === undefined
        ? {}
        : { branch: parsedWorktreeAfter.branchFromStatus }),
      changes: [...parsedWorktreeAfter.changes].sort(compareMutableChanges),
      unsafeChanges: opaqueUnsafeChanges(parsedWorktreeAfter.unsafeChanges),
    });
    const contentStateBefore = stableDigest({
      changes: digestibleChanges(enriched.changes),
      unsafeChanges: opaqueUnsafeChanges(unsafeEnriched.changes),
    });
    const contentStateAfter = stableDigest({
      changes: digestibleChanges(enrichedAfter.changes),
      unsafeChanges: opaqueUnsafeChanges(unsafeEnrichedAfter.changes),
    });
    const headChanged = headCommit !== headCommitAfter;
    const indexChanged =
      digestRelevantIndex(indexResult.stdout) !==
      digestRelevantIndex(indexAfterResult.stdout);
    const worktreeChanged =
      worktreeStateBefore !== worktreeStateAfter ||
      contentStateBefore !== contentStateAfter ||
      stableDigest(enriched.limitations) !==
        stableDigest(enrichedAfter.limitations) ||
      stableDigest(unsafeEnriched.limitations) !==
        stableDigest(unsafeEnrichedAfter.limitations);
    const ignoreChanged = ignore.digest !== ignoreAfter.digest;
    if (headChanged || indexChanged || worktreeChanged || ignoreChanged) {
      limitations.push("repository state changed while the snapshot was captured");
      diagnostics.push({
        code: "repository_changed_during_capture",
        severity: "warning",
        scope: "repository",
        message:
          "HEAD, Index, Worktree, or Untracked state changed during capture",
      });
    }
    if (headChanged) {
      limitations.push("HEAD changed while the snapshot was captured");
      diagnostics.push({
        code: "repository_head_changed_during_capture",
        severity: "warning",
        scope: "git",
        message: "HEAD changed after the initial repository sample",
      });
    }
    if (indexChanged) {
      limitations.push("Index changed while the snapshot was captured");
      diagnostics.push({
        code: "repository_index_changed_during_capture",
        severity: "warning",
        scope: "git",
        message: "The Git Index changed after the initial repository sample",
      });
    }
    if (worktreeChanged) {
      limitations.push(
        "Worktree or Untracked content changed while the snapshot was captured",
      );
      diagnostics.push({
        code: "repository_worktree_changed_during_capture",
        severity: "warning",
        scope: "worktree",
        message:
          "Worktree or Untracked content changed after its initial repository sample",
      });
    }
    if (ignoreChanged) {
      limitations.push(
        "Git ignore configuration changed while the snapshot was captured",
      );
      diagnostics.push({
        code: "repository_ignore_changed_during_capture",
        severity: "warning",
        scope: "git",
        message: "Git ignore configuration changed after its initial sample",
      });
    }
    if (submoduleResult === undefined) {
      if (indexContainsGitlink(indexResult.stdout)) {
        limitations.push(
          "recursive submodule content is outside the descriptor-bound snapshot boundary",
        );
        diagnostics.push({
          code: "submodule_recursive_content_unknown",
          severity: "warning",
          scope: "submodule",
          message:
            "Gitlink mode and object identity are captured, but nested submodule content remains unknown",
        });
      }
    } else if (submoduleResult.exitCode !== 0) {
      limitations.push("one or more submodules could not be inspected");
      diagnostics.push({
        code: "submodule_inspection_failed",
        severity: "warning",
        scope: "submodule",
        message: "Git could not completely inspect recursive submodule state",
      });
    } else {
      const submoduleLines = decodeGitText(submoduleResult.stdout)
        .split("\n")
        .filter(Boolean);
      if (submoduleLines.some((line) => line.startsWith("-"))) {
        limitations.push("one or more submodules are not initialized");
        diagnostics.push({
          code: "submodule_uninitialized",
          severity: "warning",
          scope: "submodule",
          message: "At least one registered submodule is not initialized",
        });
      }
      if (submoduleLines.some((line) => line.startsWith("U"))) {
        limitations.push("one or more submodules are conflicted");
        diagnostics.push({
          code: "submodule_conflict",
          severity: "warning",
          scope: "submodule",
          message: "At least one registered submodule is conflicted",
        });
      }
    }

    const uniqueLimitations = [...new Set(limitations)].sort();
    const captureStatus =
      uniqueLimitations.length === 0 ? "complete" : "partial";
    const indexDigest = digestRelevantIndex(indexResult.stdout);
    const worktreeDigest = stableDigest(
      {
        changes: changes.filter(
          (change) =>
            change.source === "unstaged" || change.source === "conflict",
        ),
        stateChanges: digestibleChanges(
          enriched.changes.filter(
            (change) =>
              change.source === "unstaged" || change.source === "conflict",
          ),
        ),
        unsafeChanges: opaqueUnsafeChanges(
          unsafeEnriched.changes.filter(
            (change) =>
              change.source === "unstaged" || change.source === "conflict",
          ),
        ),
      },
    );
    const untrackedDigest = stableDigest(
      {
        changes: changes.filter((change) => change.source === "untracked"),
        stateChanges: digestibleChanges(
          enriched.changes.filter(
            (change) => change.source === "untracked",
          ),
        ),
        unsafeChanges: opaqueUnsafeChanges(
          unsafeEnriched.changes.filter(
            (change) => change.source === "untracked",
          ),
        ),
      },
    );
    const snapshot = makeSnapshot(identity, {
      ...(branch === undefined || branch.length === 0 ? {} : { branch }),
      headCommit,
      baseCommit: baselineCommit,
      mergeBase,
      indexDigest,
      worktreeDigest,
      untrackedDigest,
      ignoreDigest: ignore.digest,
      createdAt: now().toISOString(),
      captureStatus,
      limitations: uniqueLimitations,
      changes,
    });

    const linkedWorktree =
      normalizeAbsolutePath(gitDirectory) !==
      normalizeAbsolutePath(commonGitDirectory);
    if (detached) {
      diagnostics.push({
        code: "detached_head",
        severity: "info",
        scope: "worktree",
        message: "The worktree is currently attached to a detached HEAD",
      });
    }
    if (linkedWorktree) {
      diagnostics.push({
        code: "linked_worktree",
        severity: "info",
        scope: "worktree",
        message: "The canonical root is a linked Git worktree",
      });
    }

    return {
      snapshot,
      canonicalRoot,
      git: {
        ...(branch === undefined || branch.length === 0 ? {} : { branch }),
        detached,
        linkedWorktree,
        baselineCommit,
        headCommit,
        mergeBase,
        ahead,
        behind,
      },
      diagnostics,
    };
  } catch (error) {
    return makeErrorCapture(root, error, now);
  }
}

export async function getRepositorySnapshotDetailed(
  root: string,
  options: RepositorySnapshotOptions = {},
): Promise<RepositorySnapshotCapture> {
  return captureRepositorySnapshotDetailed(root, options);
}

export async function getRepositorySnapshot(
  root: string,
  options: RepositorySnapshotOptions = {},
): Promise<RepositorySnapshotV1> {
  return (await getRepositorySnapshotDetailed(root, options)).snapshot;
}

/**
 * Production snapshot composition. The executor can only be minted by the
 * genuine descriptor capability after its contained version probe succeeds.
 */
export async function getRepositorySnapshotDetailedWithSafeGitCapabilityV1(
  root: string,
  capability: SafeGitDescriptorBoundCapabilityV1,
  options: SafeGitProductionSnapshotOptionsV1 = {},
): Promise<RepositorySnapshotCapture> {
  if (!isSafeGitDescriptorBoundCapabilityV1(capability)) {
    throw new Error("SafeGit descriptor capability is unavailable");
  }
  return captureRepositorySnapshotDetailed(root, {
    ...options,
    safeGitExecutor: capability.createReadExecutor(),
  });
}

/** Contract-only form of the production descriptor-capability composition. */
export async function getRepositorySnapshotWithSafeGitCapabilityV1(
  root: string,
  capability: SafeGitDescriptorBoundCapabilityV1,
  options: SafeGitProductionSnapshotOptionsV1 = {},
): Promise<RepositorySnapshotV1> {
  return (
    await getRepositorySnapshotDetailedWithSafeGitCapabilityV1(
      root,
      capability,
      options,
    )
  ).snapshot;
}

export const __testing = {
  parseNameStatus,
  parsePorcelainV2,
  captureWithFileHooks: (
    root: string,
    options: RepositorySnapshotOptions,
    hooksForPath: (path: string) => StableFileReadHooks | undefined,
  ) =>
    captureRepositorySnapshotDetailed(root, options, {
      fileHooksForPath: hooksForPath,
    }),
  captureWithHooks: (
    root: string,
    options: RepositorySnapshotOptions,
    hooks: SnapshotCaptureTestHooks,
  ) => captureRepositorySnapshotDetailed(root, options, hooks),
  hashStableRepositoryFile,
};

export { readStableRepositoryFile };
