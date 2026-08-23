import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  constants,
  type BigIntStats,
} from "node:fs";
import {
  open,
  realpath,
  stat,
  type FileHandle,
} from "node:fs/promises";
import path from "node:path";

import { ArtifactStoreError } from "@understand-code/artifact-store";
import {
  canonicalizeWorktreeRoot,
  resolveRepositoryPath,
} from "@understand-code/artifact-store/path-guard";
import {
  RepositoryRelativePathSchema,
  RepositorySnapshotV1Schema,
  type RepositorySnapshotV1,
} from "@understand-code/contracts";
import {
  KnowledgeGraphSchema,
  validateGraph,
  type GraphNode,
  type KnowledgeGraph,
} from "@understand-code/core";
import {
  parseWikiIndexV2,
  parseWikiSearchIndexV2,
  type WikiIndexV2,
  type WikiSearchIndexV2,
} from "@understand-code/core/knowledge-base";
import { getRepositorySnapshotDetailed } from "@understand-code/repository-state";

import type {
  SourceEvidenceRecord,
  TaskChangeAnalysisBoundary,
  TaskChangeAnalysisInput,
  TaskChangeAnalysisResult,
  TaskChangeHunk,
  TaskDeletedFileObservation,
  TaskContextData,
  TaskContextLoadInput,
  TaskContextProvider,
  TaskContextProviderBinding,
} from "./engine-types.js";
import {
  CHANGE_ANALYSIS_LIMITS,
  compareTaskChangeHunks,
  deterministicLineDiff,
  graphSymbolClustersForRange,
} from "./change-analysis.js";
import { compareUnicodeCodeUnits } from "./stable-order.js";
import type {
  WikiIndexLike,
  WikiRecordLike,
} from "./types.js";

const DEFAULT_GRAPH_PATH = ".understand-code/knowledge-graph.json";
const DEFAULT_WIKI_INDEX_PATH =
  ".understand-code/knowledge-base/wiki-index.json";
const DEFAULT_WIKI_SEARCH_PATH =
  ".understand-code/knowledge-base/search-index.json";
const DEFAULT_MAX_GRAPH_BYTES = 32 * 1024 * 1024;
const DEFAULT_MAX_WIKI_BYTES = 32 * 1024 * 1024;
const DEFAULT_MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_CHANGE_ANALYSIS_SNAPSHOT_BYTES = 64 * 1024 * 1024;
const MAX_CHANGE_ANALYSIS_PATH_BYTES = 4_096;
const MAX_CHANGE_ANALYSIS_TREE_ENTRY_BYTES =
  MAX_CHANGE_ANALYSIS_PATH_BYTES + 256;
const MAX_BOUNDED_CHANGE_PATHS = 16;
const MAX_BOUNDED_SEMANTIC_BYTES = 32 * 1024 * 1024;
const GIT_READ_ARGUMENT_PREFIX = Object.freeze([
  "-c",
  "core.hooksPath=/dev/null",
  "-c",
  "core.fsmonitor=false",
  "-c",
  "core.attributesFile=/dev/null",
  "-c",
  "core.excludesFile=/dev/null",
  "--no-optional-locks",
] as const);

export type RepositoryTaskContextProviderErrorCode =
  | "invalid_root"
  | "invalid_provider_option"
  | "invalid_snapshot"
  | "snapshot_mismatch"
  | "repository_file_unavailable"
  | "repository_file_changed"
  | "repository_file_too_large"
  | "unsafe_repository_path"
  | "invalid_graph";

/**
 * Provider errors deliberately expose repository-relative paths only. The
 * canonical Host root remains private even when callers use the provider
 * directly instead of through TaskEngine's error boundary.
 */
export class RepositoryTaskContextProviderError extends Error {
  readonly code: RepositoryTaskContextProviderErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: RepositoryTaskContextProviderErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "RepositoryTaskContextProviderError";
    this.code = code;
    this.details = details;
  }
}

export interface RepositoryTaskContextProviderOptions {
  /**
   * Explicit absolute repository root. `open` resolves and verifies its
   * canonical directory identity; no process cwd or implicit root is used.
   */
  canonicalRoot: string;
  graphPath?: string;
  wikiIndexPath?: string;
  wikiSearchPath?: string;
  maxGraphBytes?: number;
  maxWikiBytes?: number;
  maxSourceFileBytes?: number;
}

interface NormalizedOptions {
  graphPath: string;
  wikiIndexPath: string;
  wikiSearchPath: string;
  maxGraphBytes: number;
  maxWikiBytes: number;
  maxSourceFileBytes: number;
}

interface VerifiedFile {
  bytes?: Buffer;
}

interface OptionalJson {
  present: boolean;
  value?: unknown;
}

function changeAnalysisBoundary(
  code: TaskChangeAnalysisBoundary["code"],
  reason: string,
  filePath: string | undefined,
  actualChangeIds: readonly string[],
): TaskChangeAnalysisBoundary {
  return {
    code,
    reason,
    ...(filePath === undefined ? {} : { filePath }),
    actualChangeIds: [...actualChangeIds].sort(compareUnicodeCodeUnits),
  };
}

function gitEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.toUpperCase().startsWith("GIT_")) environment[key] = value;
  }
  return {
    ...environment,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_COUNT: "0",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_NO_LAZY_FETCH: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C",
  };
}

function snapshotFenceEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const name of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_COMMON_DIR",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  ]) {
    delete environment[name];
  }
  environment.GIT_OPTIONAL_LOCKS = "0";
  environment.GIT_TERMINAL_PROMPT = "0";
  environment.LC_ALL = "C";
  return environment;
}

function readGitOutput(
  canonicalRoot: string,
  args: readonly string[],
  maxBuffer: number,
  budgetMessage: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      [...GIT_READ_ARGUMENT_PREFIX, ...args],
      {
        cwd: canonicalRoot,
        encoding: "buffer",
        env: gitEnvironment(),
        maxBuffer,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error !== null) {
          reject(
            (error as NodeJS.ErrnoException).code ===
              "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"
              ? new RangeError(budgetMessage)
              : error,
          );
          return;
        }
        resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout));
      },
    );
  });
}

function safeChangeAnalysisPath(relativePath: string): boolean {
  return (
    RepositoryRelativePathSchema.safeParse(relativePath).success &&
    Buffer.byteLength(relativePath, "utf8") <=
      MAX_CHANGE_ANALYSIS_PATH_BYTES &&
    !relativePath.startsWith("-") &&
    !/[:\u0000-\u001f\u007f]/u.test(relativePath)
  );
}

type LiveAnalysisFence =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: TaskChangeAnalysisBoundary["code"];
      readonly reason: string;
    };

async function sampleLiveAnalysisFence(
  canonicalRoot: string,
  expected: RepositorySnapshotV1,
): Promise<LiveAnalysisFence> {
  let capture: Awaited<ReturnType<typeof getRepositorySnapshotDetailed>>;
  try {
    capture = await getRepositorySnapshotDetailed(canonicalRoot, {
      baselineRef: expected.headCommit,
      environment: snapshotFenceEnvironment(),
      maxBufferBytes: MAX_CHANGE_ANALYSIS_SNAPSHOT_BYTES,
    });
  } catch {
    return {
      ok: false,
      code: "unsupported_source",
      reason: "The current repository state could not be captured within the Alpha profile.",
    };
  }
  if (capture.snapshot.captureStatus !== "complete") {
    return {
      ok: false,
      code: capture.diagnostics.some(
        (diagnostic) => diagnostic.code === "git_output_too_large",
      )
        ? "budget_exhausted"
        : "unsupported_source",
      reason: "The current repository state could not be captured completely within the Alpha profile.",
    };
  }
  if (capture.snapshot.headCommit !== expected.headCommit) {
    return {
      ok: false,
      code: "head_mismatch",
      reason: "The current Git HEAD no longer matches the actual Snapshot.",
    };
  }
  if (
    capture.canonicalRoot !== canonicalRoot ||
    capture.snapshot.repositoryId !== expected.repositoryId ||
    capture.snapshot.worktreeId !== expected.worktreeId ||
    capture.snapshot.rootIdentity !== expected.rootIdentity
  ) {
    return {
      ok: false,
      code: "content_changed",
      reason: "The current repository identity no longer matches the actual Snapshot.",
    };
  }
  if (capture.snapshot.indexDigest !== expected.indexDigest) {
    return {
      ok: false,
      code: "content_changed",
      reason: "The current Git Index no longer matches the actual Snapshot.",
    };
  }
  if (
    capture.snapshot.worktreeDigest !== expected.worktreeDigest ||
    capture.snapshot.untrackedDigest !== expected.untrackedDigest ||
    capture.snapshot.ignoreDigest !== expected.ignoreDigest
  ) {
    return {
      ok: false,
      code: "content_changed",
      reason: "The current worktree, untracked, or ignore state no longer matches the actual Snapshot.",
    };
  }
  if (capture.snapshot.snapshotId !== expected.snapshotId) {
    return {
      ok: false,
      code: "content_changed",
      reason: "The current repository state no longer matches the exact actual Snapshot.",
    };
  }
  return { ok: true };
}

function readGitIndexBlob(
  canonicalRoot: string,
  relativePath: string,
): Promise<Buffer> {
  if (!safeChangeAnalysisPath(relativePath)) {
    return Promise.reject(
      providerErrorForPath(
        "unsafe_repository_path",
        "A repository path is ambiguous for exact Git index lookup.",
        relativePath,
      ),
    );
  }
  return readGitOutput(
    canonicalRoot,
    ["cat-file", "blob", `:${relativePath}`],
    CHANGE_ANALYSIS_LIMITS.maxFileBytes + 1,
    "Git index blob exceeds analysis budget",
  ).then((bytes) => {
    if (bytes.byteLength > CHANGE_ANALYSIS_LIMITS.maxFileBytes) {
      throw new RangeError("Git index blob exceeds analysis budget");
    }
    return bytes;
  });
}

async function indexPathIsAbsent(
  canonicalRoot: string,
  relativePath: string,
): Promise<boolean> {
  if (!safeChangeAnalysisPath(relativePath)) {
    throw providerErrorForPath(
      "unsafe_repository_path",
      "A repository path is ambiguous for exact Git index lookup.",
      relativePath,
    );
  }
  const output = await readGitOutput(
    canonicalRoot,
    [
      "--literal-pathspecs",
      "ls-files",
      "--stage",
      "-z",
      "--",
      relativePath,
    ],
    MAX_CHANGE_ANALYSIS_TREE_ENTRY_BYTES * 4,
    "Git index entries exceed analysis budget",
  );
  return output.byteLength === 0;
}

function readGitBlob(
  canonicalRoot: string,
  headCommit: string,
  relativePath: string,
): Promise<Buffer> {
  if (
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(headCommit) ||
    relativePath.startsWith("-") ||
    /[:\0\r\n]/u.test(relativePath)
  ) {
    return Promise.reject(
      providerErrorForPath(
        "unsafe_repository_path",
        "A repository path is ambiguous for exact Git object lookup.",
        relativePath,
      ),
    );
  }
  return readGitOutput(
    canonicalRoot,
    ["cat-file", "blob", `${headCommit}:${relativePath}`],
    CHANGE_ANALYSIS_LIMITS.maxFileBytes + 1,
    "baseline Git blob exceeds analysis budget",
  ).then((bytes) => {
    if (bytes.byteLength > CHANGE_ANALYSIS_LIMITS.maxFileBytes) {
      throw new RangeError("baseline Git blob exceeds analysis budget");
    }
    return bytes;
  });
}

async function baselinePathIsAbsent(
  canonicalRoot: string,
  headCommit: string,
  relativePath: string,
): Promise<boolean> {
  if (
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(headCommit) ||
    !safeChangeAnalysisPath(relativePath)
  ) {
    throw providerErrorForPath(
      "unsafe_repository_path",
      "A repository path is ambiguous for exact Git tree lookup.",
      relativePath,
    );
  }
  const output = await readGitOutput(
    canonicalRoot,
    [
      "--literal-pathspecs",
      "ls-tree",
      "-z",
      "--full-tree",
      headCommit,
      "--",
      relativePath,
    ],
    MAX_CHANGE_ANALYSIS_TREE_ENTRY_BYTES,
    "baseline Git tree entry exceeds analysis budget",
  );
  if (output.byteLength === 0) return true;
  return false;
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function sameIdentity(
  left: BigIntStats,
  right: BigIntStats,
): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function isMissing(error: unknown): boolean {
  return (
    (error instanceof ArtifactStoreError &&
      error.code === "artifact_not_found") ||
    (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT"
  );
}

function positiveSafeInteger(
  value: number | undefined,
  fallback: number,
  option: string,
): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved <= 0) {
    throw new RepositoryTaskContextProviderError(
      "invalid_provider_option",
      `${option} must be a positive safe integer.`,
      { option },
    );
  }
  return resolved;
}

function repositoryPath(value: string, option: string): string {
  const parsed = RepositoryRelativePathSchema.safeParse(value);
  if (!parsed.success) {
    throw new RepositoryTaskContextProviderError(
      "invalid_provider_option",
      `${option} must be a normalized repository-relative path.`,
      { option },
    );
  }
  return parsed.data;
}

function providerErrorForPath(
  code: RepositoryTaskContextProviderErrorCode,
  message: string,
  relativePath: string,
): RepositoryTaskContextProviderError {
  return new RepositoryTaskContextProviderError(code, message, {
    relativePath,
  });
}

async function openVerifiedFile(
  canonicalRoot: string,
  relativePath: string,
  options: {
    allowMissing: boolean;
    readBytes: boolean;
    maxBytes?: number;
  },
): Promise<VerifiedFile | undefined> {
  let resolved: string;
  try {
    resolved = await resolveRepositoryPath(canonicalRoot, relativePath);
  } catch (error) {
    if (options.allowMissing && isMissing(error)) return undefined;
    if (isMissing(error)) {
      throw providerErrorForPath(
        "repository_file_unavailable",
        "A required repository file is unavailable.",
        relativePath,
      );
    }
    throw providerErrorForPath(
      "unsafe_repository_path",
      "A repository path failed containment or symlink validation.",
      relativePath,
    );
  }

  let handle: FileHandle;
  try {
    handle = await open(
      resolved,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
  } catch (error) {
    if (options.allowMissing && isMissing(error)) return undefined;
    throw providerErrorForPath(
      "repository_file_unavailable",
      "A repository file could not be opened safely.",
      relativePath,
    );
  }

  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) {
      throw providerErrorForPath(
        "unsafe_repository_path",
        "A repository path does not identify a regular file.",
        relativePath,
      );
    }
    if (
      options.maxBytes !== undefined &&
      before.size > BigInt(options.maxBytes)
    ) {
      throw providerErrorForPath(
        "repository_file_too_large",
        "A repository file exceeds the configured byte limit.",
        relativePath,
      );
    }

    const bytes = options.readBytes ? await handle.readFile() : undefined;
    const after = await handle.stat({ bigint: true });
    let finalPath: string;
    let finalMetadata: BigIntStats;
    try {
      finalPath = await realpath(resolved);
      finalMetadata = await stat(finalPath, { bigint: true });
    } catch {
      throw providerErrorForPath(
        "repository_file_changed",
        "A repository file changed while it was being verified.",
        relativePath,
      );
    }
    if (
      !isInside(canonicalRoot, finalPath) ||
      !sameIdentity(before, after) ||
      !sameIdentity(after, finalMetadata) ||
      (bytes !== undefined && BigInt(bytes.byteLength) !== after.size)
    ) {
      throw providerErrorForPath(
        "repository_file_changed",
        "A repository file changed while it was being verified.",
        relativePath,
      );
    }
    return { ...(bytes === undefined ? {} : { bytes }) };
  } finally {
    await handle.close();
  }
}

function parseJson(bytes: Buffer, relativePath: string): unknown {
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw providerErrorForPath(
      "invalid_graph",
      "A repository context artifact is not valid JSON.",
      relativePath,
    );
  }
}

async function readRequiredJson(
  root: string,
  relativePath: string,
  maxBytes: number,
): Promise<unknown> {
  const file = await openVerifiedFile(root, relativePath, {
    allowMissing: false,
    readBytes: true,
    maxBytes,
  });
  return parseJson(file!.bytes!, relativePath);
}

async function readOptionalJson(
  root: string,
  relativePath: string,
  maxBytes: number,
): Promise<OptionalJson> {
  const file = await openVerifiedFile(root, relativePath, {
    allowMissing: true,
    readBytes: true,
    maxBytes,
  });
  return file === undefined
    ? { present: false }
    : (() => {
        try {
          return {
            present: true,
            value: JSON.parse(file.bytes!.toString("utf8")) as unknown,
          };
        } catch {
          // An optional Wiki artifact may be absent or invalid without
          // suppressing valid Graph context. `adaptWiki` marks it invalid so
          // ranking emits an explicit boundary and ignores its records.
          return { present: true, value: undefined };
        }
      })();
}

function validateGraphArtifact(
  value: unknown,
  relativePath: string,
): KnowledgeGraph {
  const parsed = KnowledgeGraphSchema.safeParse(value);
  const validation = validateGraph(value);
  if (
    !parsed.success ||
    !validation.success ||
    validation.issues.length > 0
  ) {
    throw providerErrorForPath(
      "invalid_graph",
      "The Core Knowledge Graph failed validation.",
      relativePath,
    );
  }

  const nodeIds = new Set<string>();
  for (const node of parsed.data.nodes) {
    if (nodeIds.has(node.id)) {
      throw providerErrorForPath(
        "invalid_graph",
        "The Core Knowledge Graph contains duplicate node identifiers.",
        relativePath,
      );
    }
    nodeIds.add(node.id);
  }
  for (const layer of parsed.data.layers) {
    if (layer.nodeIds.some((nodeId) => !nodeIds.has(nodeId))) {
      throw providerErrorForPath(
        "invalid_graph",
        "The Core Knowledge Graph contains a dangling layer reference.",
        relativePath,
      );
    }
  }
  for (const step of parsed.data.tour) {
    if (step.nodeIds.some((nodeId) => !nodeIds.has(nodeId))) {
      throw providerErrorForPath(
        "invalid_graph",
        "The Core Knowledge Graph contains a dangling tour reference.",
        relativePath,
      );
    }
  }
  return parsed.data;
}

function inScope(
  filePath: string,
  scope: readonly string[] | undefined,
): boolean {
  return (
    scope === undefined ||
    scope.length === 0 ||
    scope.some(
      (prefix) =>
        filePath === prefix || filePath.startsWith(`${prefix}/`),
    )
  );
}

async function verifiedGraphPaths(
  canonicalRoot: string,
  graph: KnowledgeGraph,
  scope: readonly string[] | undefined,
): Promise<string[]> {
  const parsedScope = scope?.map((value) => {
    const parsed = RepositoryRelativePathSchema.safeParse(value);
    if (!parsed.success) {
      throw new RepositoryTaskContextProviderError(
        "invalid_snapshot",
        "Task scope contains an invalid repository-relative path.",
      );
    }
    return parsed.data;
  });
  const unique = new Set<string>();
  for (const node of graph.nodes) {
    if (node.filePath === undefined) continue;
    const parsed = RepositoryRelativePathSchema.safeParse(node.filePath);
    if (!parsed.success) {
      throw new RepositoryTaskContextProviderError(
        "unsafe_repository_path",
        "The Core Knowledge Graph contains a non-repository-relative path.",
        { source: "knowledge_graph" },
      );
    }
    unique.add(parsed.data);
  }

  const existing: string[] = [];
  for (
    const relativePath of [...unique].sort(compareUnicodeCodeUnits)
  ) {
    if (!inScope(relativePath, parsedScope)) continue;
    const file = await openVerifiedFile(canonicalRoot, relativePath, {
      allowMissing: true,
      readBytes: false,
    });
    if (file !== undefined) existing.push(relativePath);
  }
  return existing;
}

function invalidWiki(): WikiIndexLike {
  return {
    freshness: "error",
    valid: false,
    records: [],
  };
}

function adaptWikiRecord(
  record: WikiSearchIndexV2["records"][number],
  existingPaths: ReadonlySet<string>,
): WikiRecordLike | undefined {
  let verifiedFilePath: string | undefined;
  if (record.filePath !== undefined) {
    const parsed = RepositoryRelativePathSchema.safeParse(record.filePath);
    if (!parsed.success) return undefined;
    if (existingPaths.has(parsed.data)) verifiedFilePath = parsed.data;
  }
  return {
    id: record.id,
    ...(record.nodeId === undefined ? {} : { nodeId: record.nodeId }),
    pageId: record.pageId,
    title: record.title,
    ...(record.summary === undefined ? {} : { summary: record.summary }),
    ...(record.content === undefined ? {} : { content: record.content }),
    ...(verifiedFilePath === undefined
      ? {}
      : { filePath: verifiedFilePath }),
    terms: [...record.terms].sort(compareUnicodeCodeUnits),
    businessTerms: [...record.businessTerms].sort(
      compareUnicodeCodeUnits,
    ),
  };
}

function wikiFreshness(
  index: WikiIndexV2 | undefined,
  search: WikiSearchIndexV2 | undefined,
  graph: KnowledgeGraph,
): "fresh" | "partial" | "stale" {
  if (index === undefined || search === undefined) return "partial";
  const declaredGraphDigest =
    index.source.graphDigest?.replace(/^sha256:/u, "");
  if (
    declaredGraphDigest === undefined ||
    !/^[0-9a-f]{64}$/u.test(declaredGraphDigest)
  ) {
    return "partial";
  }
  const actualGraphDigest = createHash("sha256")
    .update(JSON.stringify(graph), "utf8")
    .digest("hex");
  if (declaredGraphDigest !== actualGraphDigest) return "stale";
  if (
    index.source.gitCommitHash !== undefined &&
    index.source.gitCommitHash !== graph.project.gitCommitHash
  ) {
    return "stale";
  }
  return index.generatedAt === search.generatedAt ? "fresh" : "partial";
}

function adaptWiki(
  wikiIndex: OptionalJson,
  wikiSearch: OptionalJson,
  graph: KnowledgeGraph,
  existingPaths: ReadonlySet<string>,
): WikiIndexLike | undefined {
  if (!wikiIndex.present && !wikiSearch.present) return undefined;

  const parsedIndex = wikiIndex.present
    ? parseWikiIndexV2(wikiIndex.value)
    : undefined;
  const parsedSearch = wikiSearch.present
    ? parseWikiSearchIndexV2(wikiSearch.value)
    : undefined;
  if (
    (parsedIndex !== undefined && !parsedIndex.ok) ||
    (parsedSearch !== undefined && !parsedSearch.ok)
  ) {
    return invalidWiki();
  }

  const index = parsedIndex?.ok === true
    ? parsedIndex.value
    : undefined;
  const search = parsedSearch?.ok === true
    ? parsedSearch.value
    : undefined;
  const records = (search?.records ?? [])
    .map((record) => adaptWikiRecord(record, existingPaths))
    .filter((record): record is WikiRecordLike => record !== undefined)
    .sort((left, right) =>
      compareUnicodeCodeUnits(left.id, right.id)
    );
  return {
    ...(index?.generatedAt === undefined
      ? search?.generatedAt === undefined
        ? {}
        : { generatedAt: search.generatedAt }
      : { generatedAt: index.generatedAt }),
    freshness: wikiFreshness(index, search, graph),
    valid: true,
    records,
  };
}

function sourceKind(
  node: GraphNode,
  filePath: string,
): SourceEvidenceRecord["kind"] {
  if (
    /(?:^|\/)(?:test|tests|__tests__)(?:\/|$)|(?:\.test|_test)\.[^/]+$/iu.test(
      filePath,
    )
  ) {
    return "test";
  }
  if (
    node.type === "config" ||
    /(?:^|\/)(?:package|tsconfig|vite\.config|vitest\.config)\.[^/]+$/iu.test(
      filePath,
    )
  ) {
    return "config";
  }
  if (
    node.type === "document" ||
    /\.(?:md|mdx|rst|txt)$/iu.test(filePath)
  ) {
    return "document";
  }
  return "source";
}

function trustedSnapshotDigests(
  input: TaskContextLoadInput,
): ReadonlyMap<string, string> {
  const candidates = new Map<
    string,
    { digests: Set<string>; unusable: boolean }
  >();
  for (const change of input.repositorySnapshot.changes) {
    const current = candidates.get(change.path) ?? {
      digests: new Set<string>(),
      unusable: false,
    };
    if (change.kind === "deleted" || change.contentDigest === undefined) {
      current.unusable = true;
    } else {
      current.digests.add(change.contentDigest);
    }
    candidates.set(change.path, current);
  }
  const trusted = new Map<string, string>();
  for (const [filePath, candidate] of candidates) {
    if (!candidate.unusable && candidate.digests.size === 1) {
      trusted.set(filePath, [...candidate.digests][0]!);
    }
  }
  return trusted;
}

async function snapshotBoundSourceEvidence(
  canonicalRoot: string,
  graph: KnowledgeGraph,
  existingPaths: ReadonlySet<string>,
  input: TaskContextLoadInput,
  maxSourceFileBytes: number,
): Promise<SourceEvidenceRecord[]> {
  const trustedDigests = trustedSnapshotDigests(input);
  const actualFiles = new Map<
    string,
    { digest: string; bytes: Buffer }
  >();
  for (
    const filePath of [...trustedDigests.keys()].sort(
      compareUnicodeCodeUnits,
    )
  ) {
    if (!existingPaths.has(filePath)) continue;
    let file: VerifiedFile;
    try {
      file = (await openVerifiedFile(canonicalRoot, filePath, {
        allowMissing: false,
        readBytes: true,
        maxBytes: maxSourceFileBytes,
      }))!;
    } catch (error) {
      if (
        error instanceof RepositoryTaskContextProviderError &&
        error.code === "repository_file_too_large"
      ) {
        continue;
      }
      throw error;
    }
    const digest =
      `sha256:${createHash("sha256").update(file.bytes!).digest("hex")}`;
    if (digest === trustedDigests.get(filePath)) {
      actualFiles.set(filePath, { digest, bytes: file.bytes! });
    }
  }

  const result: SourceEvidenceRecord[] = [];
  for (
    const node of [...graph.nodes].sort((left, right) =>
      compareUnicodeCodeUnits(left.id, right.id)
    )
  ) {
    if (node.filePath === undefined) continue;
    const actual = actualFiles.get(node.filePath);
    if (actual === undefined) continue;
    if (!sourceAnchorMatches(node, actual.bytes)) continue;
    result.push({
      nodeId: node.id,
      filePath: node.filePath,
      ...(node.lineRange === undefined
        ? {}
        : { lineRange: [...node.lineRange] }),
      contentHash: actual.digest,
      kind: sourceKind(node, node.filePath),
    });
  }
  return result;
}

/**
 * A matching whole-file digest proves only the bytes, not that an older Graph
 * symbol anchor still identifies those bytes. Symbol Evidence therefore also
 * requires a live line-range/name match. File-level nodes may rely on the
 * whole-file digest because they make no narrower symbol-location claim.
 */
function sourceAnchorMatches(
  node: GraphNode,
  bytes: Buffer,
): boolean {
  if (node.lineRange === undefined) {
    return ["file", "config", "document"].includes(node.type);
  }
  const [start, end] = node.lineRange;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 1 ||
    end < start ||
    node.name.trim().length === 0
  ) {
    return false;
  }
  const source = maskCommentsAndStrings(bytes.toString("utf8"));
  const lines = source.split(/\r?\n/gu);
  if (end > lines.length) return false;
  const name = node.name.trim();
  if (
    !/^[$_\p{ID_Start}][$\u200c\u200d_\p{ID_Continue}]*$/u.test(name)
  ) {
    return false;
  }
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const identifier = new RegExp(
    `(?<![$_\\p{ID_Continue}])${escapedName}(?![$_\\p{ID_Continue}])`,
    "u",
  );
  const anchoredSource = lines
    .slice(start - 1, end)
    .join("\n");
  if (!identifier.test(anchoredSource)) return false;

  // A call-site identifier is not a symbol anchor. Require the declared
  // symbol itself to fall inside the Graph line range, and reject duplicate
  // declarations that the whole-file digest cannot disambiguate.
  const declarations = symbolDeclarationPattern(escapedName);
  const anchoredDeclarations = [
    ...anchoredSource.matchAll(declarations),
  ].length;
  const wholeFileDeclarations = [
    ...source.matchAll(symbolDeclarationPattern(escapedName)),
  ].length;
  return anchoredDeclarations === 1 && wholeFileDeclarations === 1;
}

function symbolDeclarationPattern(escapedName: string): RegExp {
  const boundary = `(?![$_\\p{ID_Continue}])`;
  const namedDeclaration =
    `\\b(?:function|class|interface|type|enum|struct|trait|def|fn)\\s+${escapedName}${boundary}`;
  const goDeclaration =
    `\\bfunc\\s+(?:\\([^\\n)]*\\)\\s*)?${escapedName}${boundary}`;
  const variableDeclaration =
    `\\b(?:const|let|var)\\s+${escapedName}${boundary}`;
  const typedMethodDeclaration =
    `(?:^|\\n)\\s*(?:(?:export|default|public|private|protected|static|async|abstract|override|readonly|get|set)\\s+)*${escapedName}${boundary}\\s*(?:<[^\\n>{}]*>)?\\([^\\n)]*\\)\\s*(?::[^\\n{=]+)?\\s*\\{`;
  return new RegExp(
    `(?:${namedDeclaration}|${goDeclaration}|${variableDeclaration}|${typedMethodDeclaration})`,
    "gmu",
  );
}

/**
 * Masks comments and string/template literals while preserving line breaks.
 * This deliberately favors false negatives over upgrading comment text or a
 * string value into observed Source Evidence.
 */
function maskCommentsAndStrings(source: string): string {
  type State =
    | "code"
    | "line_comment"
    | "block_comment"
    | "single_quote"
    | "double_quote"
    | "template"
    | "regex";
  let state: State = "code";
  let escaped = false;
  let regexCharacterClass = false;
  let result = "";
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    const next = source[index + 1];
    const preserve = character === "\n" || character === "\r";
    if (state === "line_comment") {
      if (preserve) {
        state = "code";
        result += character;
      } else {
        result += " ";
      }
      continue;
    }
    if (state === "block_comment") {
      if (character === "*" && next === "/") {
        result += "  ";
        index += 1;
        state = "code";
      } else {
        result += preserve ? character : " ";
      }
      continue;
    }
    if (state === "regex") {
      result += preserve ? character : " ";
      if (preserve) {
        state = "code";
        escaped = false;
        regexCharacterClass = false;
      } else if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "[") {
        regexCharacterClass = true;
      } else if (character === "]") {
        regexCharacterClass = false;
      } else if (character === "/" && !regexCharacterClass) {
        state = "code";
      }
      continue;
    }
    if (
      state === "single_quote" ||
      state === "double_quote" ||
      state === "template"
    ) {
      const terminator =
        state === "single_quote"
          ? "'"
          : state === "double_quote"
            ? "\""
            : "`";
      result += preserve ? character : " ";
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === terminator) {
        state = "code";
      }
      continue;
    }
    if (character === "/" && next === "/") {
      result += "  ";
      index += 1;
      state = "line_comment";
    } else if (character === "/" && next === "*") {
      result += "  ";
      index += 1;
      state = "block_comment";
    } else if (
      character === "/" &&
      isLikelyRegexLiteralStart(source, index)
    ) {
      result += " ";
      state = "regex";
      escaped = false;
      regexCharacterClass = false;
    } else if (character === "#") {
      result += " ";
      state = "line_comment";
    } else if (character === "'") {
      result += " ";
      state = "single_quote";
    } else if (character === "\"") {
      result += " ";
      state = "double_quote";
    } else if (character === "`") {
      result += " ";
      state = "template";
    } else {
      result += character;
    }
  }
  return result;
}

function isLikelyRegexLiteralStart(
  source: string,
  slashIndex: number,
): boolean {
  let cursor = slashIndex - 1;
  while (cursor >= 0 && /\s/u.test(source[cursor]!)) cursor -= 1;
  if (cursor < 0) return true;
  if (/[=([{,:;!?&|^~<>%*+\-]/u.test(source[cursor]!)) {
    return true;
  }
  const prefix = source.slice(0, slashIndex);
  return /(?:^|[^\p{ID_Continue}])(?:return|case|throw|yield|await|typeof|instanceof|in|of)\s*$/u
    .test(prefix);
}

export class RepositoryTaskContextProvider
implements TaskContextProvider {
  readonly binding: TaskContextProviderBinding;
  readonly #canonicalRoot: string;
  readonly #options: NormalizedOptions;

  private constructor(
    canonicalRoot: string,
    options: NormalizedOptions,
  ) {
    this.#canonicalRoot = canonicalRoot;
    this.binding = Object.freeze({
      schemaVersion: 1,
      kind: "canonical_worktree_root",
      canonicalRoot,
    });
    this.#options = options;
  }

  static async open(
    options: RepositoryTaskContextProviderOptions,
  ): Promise<RepositoryTaskContextProvider> {
    let canonicalRoot: string;
    try {
      canonicalRoot = await canonicalizeWorktreeRoot(
        options.canonicalRoot,
      );
    } catch {
      throw new RepositoryTaskContextProviderError(
        "invalid_root",
        "The explicit repository root could not be canonicalized.",
      );
    }
    return new RepositoryTaskContextProvider(canonicalRoot, {
      graphPath: repositoryPath(
        options.graphPath ?? DEFAULT_GRAPH_PATH,
        "graphPath",
      ),
      wikiIndexPath: repositoryPath(
        options.wikiIndexPath ?? DEFAULT_WIKI_INDEX_PATH,
        "wikiIndexPath",
      ),
      wikiSearchPath: repositoryPath(
        options.wikiSearchPath ?? DEFAULT_WIKI_SEARCH_PATH,
        "wikiSearchPath",
      ),
      maxGraphBytes: positiveSafeInteger(
        options.maxGraphBytes,
        DEFAULT_MAX_GRAPH_BYTES,
        "maxGraphBytes",
      ),
      maxWikiBytes: positiveSafeInteger(
        options.maxWikiBytes,
        DEFAULT_MAX_WIKI_BYTES,
        "maxWikiBytes",
      ),
      maxSourceFileBytes: positiveSafeInteger(
        options.maxSourceFileBytes,
        DEFAULT_MAX_SOURCE_BYTES,
        "maxSourceFileBytes",
      ),
    });
  }

  async analyzeTaskChanges(
    input: TaskChangeAnalysisInput,
  ): Promise<TaskChangeAnalysisResult> {
    const baseline = RepositorySnapshotV1Schema.safeParse(
      input.baselineSnapshot,
    );
    const actual = RepositorySnapshotV1Schema.safeParse(input.actualSnapshot);
    if (!baseline.success || !actual.success) {
      return {
        status: "unknown",
        hunks: [],
        deletedFiles: [],
        boundaries: [
          changeAnalysisBoundary(
            "unsupported_source",
            "Change analysis requires valid persisted Repository Snapshots.",
            undefined,
            [],
          ),
        ],
      };
    }
    const actualChangeIds = actual.data.changes.map((change) => change.id);
    if (
      baseline.data.captureStatus !== "complete" ||
      actual.data.captureStatus !== "complete"
    ) {
      return {
        status: "unknown",
        hunks: [],
        deletedFiles: [],
        boundaries: [
          changeAnalysisBoundary(
            "unsupported_source",
            "Alpha line analysis requires complete baseline and actual Repository Snapshots.",
            undefined,
            actualChangeIds,
          ),
        ],
      };
    }
    if (baseline.data.changes.length !== 0) {
      return {
        status: "unknown",
        hunks: [],
        deletedFiles: [],
        boundaries: [
          changeAnalysisBoundary(
            "baseline_overlay_unavailable",
            "Alpha line analysis requires a globally clean Task baseline; dirty baseline overlays are not reconstructable from Snapshot metadata.",
            undefined,
            actualChangeIds,
          ),
        ],
      };
    }
    if (
      baseline.data.repositoryId !== actual.data.repositoryId ||
      baseline.data.worktreeId !== actual.data.worktreeId ||
      baseline.data.headCommit === undefined ||
      actual.data.headCommit === undefined ||
      baseline.data.headCommit !== actual.data.headCommit
    ) {
      return {
        status: "unknown",
        hunks: [],
        deletedFiles: [],
        boundaries: [
          changeAnalysisBoundary(
            "head_mismatch",
            "Alpha line analysis requires the baseline and actual Snapshot to share one exact HEAD.",
            undefined,
            actualChangeIds,
          ),
        ],
      };
    }

    const includesStagedChange = actual.data.changes.some(
      (change) => change.source === "staged",
    );
    const includesUntrackedChange = actual.data.changes.some(
      (change) => change.source === "untracked",
    );
    const includesIntentToAddChange = actual.data.changes.some(
      (change) =>
        change.source === "unstaged" && change.kind === "added",
    );
    const includesDeletedChange = actual.data.changes.some(
      (change) => change.kind === "deleted",
    );
    const livePaths = new Set(
      actual.data.changes.map((change) => change.path),
    );
    const liveIntentToAddChanges =
      includesIntentToAddChange &&
      !includesStagedChange &&
      actual.data.changes.length >= 1 &&
      actual.data.changes.length <= MAX_BOUNDED_CHANGE_PATHS &&
      livePaths.size === actual.data.changes.length &&
      actual.data.changes.every(
        (change) =>
          ((change.source === "unstaged" &&
            (change.kind === "added" || change.kind === "modified")) ||
            (change.source === "untracked" && change.kind === "added")) &&
          change.contentDigest !== undefined,
      )
        ? [...actual.data.changes].sort((left, right) =>
            compareUnicodeCodeUnits(left.path, right.path),
          )
        : undefined;
    const liveUntrackedChanges =
      includesUntrackedChange &&
      actual.data.changes.length >= 1 &&
      actual.data.changes.length <= MAX_BOUNDED_CHANGE_PATHS &&
      livePaths.size === actual.data.changes.length &&
      actual.data.changes.every(
        (change) =>
          ((change.source === "untracked" && change.kind === "added") ||
            (change.source === "unstaged" && change.kind === "modified")) &&
          change.contentDigest !== undefined,
      )
        ? [...actual.data.changes].sort((left, right) =>
            compareUnicodeCodeUnits(left.path, right.path),
          )
        : undefined;
    const liveDeletedUntrackedChanges =
      includesUntrackedChange &&
      includesDeletedChange &&
      !includesStagedChange &&
      !includesIntentToAddChange &&
      actual.data.changes.length >= 2 &&
      actual.data.changes.length <= MAX_BOUNDED_CHANGE_PATHS &&
      livePaths.size === actual.data.changes.length &&
      actual.data.changes.every(
        (change) =>
          (((change.source === "untracked" && change.kind === "added") ||
              (change.source === "unstaged" &&
                change.kind === "modified")) &&
            change.contentDigest !== undefined) ||
          (change.source === "unstaged" &&
            change.kind === "deleted" &&
            change.contentDigest === undefined),
      )
        ? [...actual.data.changes].sort((left, right) =>
            compareUnicodeCodeUnits(left.path, right.path),
          )
        : undefined;
    if (
      includesUntrackedChange &&
      liveUntrackedChanges === undefined &&
      liveIntentToAddChanges === undefined &&
      liveDeletedUntrackedChanges === undefined
    ) {
      return {
        status: "unknown",
        hunks: [],
        deletedFiles: [],
        boundaries: [
          changeAnalysisBoundary(
            "unsupported_source",
            "Alpha live untracked analysis requires one to sixteen unique untracked added or unstaged modified paths, including at least one untracked path and no other changes.",
            undefined,
            actualChangeIds,
          ),
        ],
      };
    }
    if (
      !includesStagedChange &&
      !includesUntrackedChange &&
      includesIntentToAddChange &&
      liveIntentToAddChanges === undefined
    ) {
      return {
        status: "unknown",
        hunks: [],
        deletedFiles: [],
        boundaries: [
          changeAnalysisBoundary(
            "unsupported_source",
            "Alpha live intent-to-add analysis requires one to sixteen unique unstaged added, unstaged modified, or untracked added paths, including at least one unstaged added path and no other changes.",
            undefined,
            actualChangeIds,
          ),
        ],
      };
    }
    const stagedPaths = new Set(
      actual.data.changes
        .filter((change) => change.source === "staged")
        .map((change) => change.path),
    );
    const stagedChanges =
      includesStagedChange &&
      actual.data.changes.length >= 1 &&
      actual.data.changes.length <= MAX_BOUNDED_CHANGE_PATHS &&
      stagedPaths.size === actual.data.changes.length &&
      actual.data.changes.every(
        (change) =>
          change.source === "staged" &&
          (change.kind === "modified" || change.kind === "added") &&
          change.contentDigest !== undefined,
      )
        ? [...actual.data.changes].sort((left, right) =>
            compareUnicodeCodeUnits(left.path, right.path),
          )
        : undefined;
    const stagedDeletedChanges =
      includesStagedChange &&
      includesDeletedChange &&
      actual.data.changes.length >= 1 &&
      actual.data.changes.length <= MAX_BOUNDED_CHANGE_PATHS &&
      stagedPaths.size === actual.data.changes.length &&
      actual.data.changes.every(
        (change) =>
          change.source === "staged" &&
          (change.kind === "modified" || change.kind === "added"
            ? change.contentDigest !== undefined
            : change.kind === "deleted" &&
              change.contentDigest === undefined),
      )
        ? [...actual.data.changes].sort((left, right) =>
            compareUnicodeCodeUnits(left.path, right.path),
          )
        : undefined;
    if (
      includesStagedChange &&
      stagedChanges === undefined &&
      stagedDeletedChanges === undefined
    ) {
      return {
        status: "unknown",
        hunks: [],
        deletedFiles: [],
        boundaries: [
          changeAnalysisBoundary(
            "unsupported_source",
            "Alpha staged line analysis requires one to sixteen unique staged modified or added paths and no other changes.",
            undefined,
            actualChangeIds,
          ),
        ],
      };
    }
    const liveDeletedChanges =
      includesDeletedChange &&
      !includesStagedChange &&
      !includesUntrackedChange &&
      !includesIntentToAddChange &&
      actual.data.changes.length >= 1 &&
      actual.data.changes.length <= MAX_BOUNDED_CHANGE_PATHS &&
      livePaths.size === actual.data.changes.length &&
      actual.data.changes.every(
        (change) =>
          change.source === "unstaged" &&
          ((change.kind === "modified" && change.contentDigest !== undefined) ||
            (change.kind === "deleted" && change.contentDigest === undefined)),
      )
        ? [...actual.data.changes].sort((left, right) =>
            compareUnicodeCodeUnits(left.path, right.path),
          )
        : undefined;
    if (
      includesDeletedChange &&
      liveDeletedChanges === undefined &&
      stagedDeletedChanges === undefined &&
      liveDeletedUntrackedChanges === undefined
    ) {
      return {
        status: "unknown",
        hunks: [],
        deletedFiles: [],
        boundaries: [
          changeAnalysisBoundary(
            "unsupported_source",
            "Alpha live deletion analysis requires one to sixteen unique unstaged modified or deleted paths, including at least one deleted path and no other changes.",
            undefined,
            actualChangeIds,
          ),
        ],
      };
    }
    if (
      (liveDeletedChanges !== undefined ||
        liveDeletedUntrackedChanges !== undefined) &&
      actual.data.indexDigest !== baseline.data.indexDigest
    ) {
      return {
        status: "unknown",
        hunks: [],
        deletedFiles: [],
        boundaries: [
          changeAnalysisBoundary(
            "content_changed",
            liveDeletedUntrackedChanges !== undefined
              ? "Live deleted and untracked analysis requires the exact clean baseline Index."
              : "Live deletion analysis requires the exact clean baseline Index.",
            undefined,
            actualChangeIds,
          ),
        ],
      };
    }
    const boundedBatchChanges =
      stagedChanges ??
      stagedDeletedChanges ??
      liveUntrackedChanges ??
      liveDeletedUntrackedChanges ??
      liveIntentToAddChanges ??
      liveDeletedChanges;
    const pureUnstagedChanges =
      !includesStagedChange &&
      !includesUntrackedChange &&
      actual.data.changes.length > 0 &&
      livePaths.size === actual.data.changes.length &&
      actual.data.changes.every(
        (change) =>
          change.source === "unstaged" &&
          change.kind === "modified" &&
          change.contentDigest !== undefined,
      );
    const requiresLiveSnapshotFence =
      boundedBatchChanges !== undefined || pureUnstagedChanges;
    if (
      boundedBatchChanges !== undefined &&
      boundedBatchChanges.some(
        (change) => !safeChangeAnalysisPath(change.path),
      )
    ) {
      return {
        status: "unknown",
        hunks: [],
        deletedFiles: [],
        boundaries: [
          changeAnalysisBoundary(
            "unsafe_path",
            stagedChanges !== undefined
              ? "A staged repository path is unsafe for exact Git index lookup."
              : stagedDeletedChanges !== undefined
                ? "A staged deletion repository path is unsafe for exact Git analysis."
              : liveUntrackedChanges !== undefined
                ? "A live untracked repository path is unsafe for exact Git analysis."
                : liveDeletedUntrackedChanges !== undefined
                  ? "A live deleted and untracked repository path is unsafe for exact Git analysis."
                : liveIntentToAddChanges !== undefined
                  ? "A live intent-to-add repository path is unsafe for exact Git analysis."
                  : "A live deleted repository path is unsafe for exact Git analysis.",
            undefined,
            actualChangeIds,
          ),
        ],
      };
    }

    let graph: KnowledgeGraph;
    try {
      graph = validateGraphArtifact(
        await readRequiredJson(
          this.#canonicalRoot,
          this.#options.graphPath,
          this.#options.maxGraphBytes,
        ),
        this.#options.graphPath,
      );
    } catch {
      return {
        status: "unknown",
        hunks: [],
        deletedFiles: [],
        boundaries: [
          changeAnalysisBoundary(
            "symbol_mapping_unknown",
            "The current validated Graph is unavailable for symbol mapping.",
            undefined,
            actualChangeIds,
          ),
        ],
      };
    }

    if (requiresLiveSnapshotFence) {
      const fence = await sampleLiveAnalysisFence(
        this.#canonicalRoot,
        actual.data,
      );
      if (!fence.ok) {
        return {
          status: "unknown",
          hunks: [],
          deletedFiles: [],
          boundaries: [
            changeAnalysisBoundary(
              fence.code,
              fence.reason,
              undefined,
              actualChangeIds,
            ),
          ],
        };
      }
    }

    const changesByPath = new Map<string, typeof actual.data.changes>();
    for (const change of actual.data.changes) {
      const changes = changesByPath.get(change.path) ?? [];
      changes.push(change);
      changesByPath.set(change.path, changes);
    }
    const hunks: TaskChangeHunk[] = [];
    const deletedFiles: TaskDeletedFileObservation[] = [];
    const boundaries: TaskChangeAnalysisBoundary[] = [];
    let boundedSemanticBytes = 0;
    for (const filePath of [...changesByPath.keys()].sort(compareUnicodeCodeUnits)) {
      const changes = changesByPath.get(filePath)!;
      const ids = changes.map((change) => change.id);
      const supported =
        changes.length === 1 &&
        (stagedChanges !== undefined
          ? changes[0]!.source === "staged" &&
            (changes[0]!.kind === "modified" ||
              changes[0]!.kind === "added")
          : stagedDeletedChanges !== undefined
            ? changes[0]!.source === "staged" &&
              (changes[0]!.kind === "modified" ||
                changes[0]!.kind === "added" ||
                changes[0]!.kind === "deleted")
          : liveUntrackedChanges !== undefined
            ? (changes[0]!.source === "untracked" &&
                changes[0]!.kind === "added") ||
              (changes[0]!.source === "unstaged" &&
                changes[0]!.kind === "modified")
            : liveDeletedUntrackedChanges !== undefined
              ? (changes[0]!.source === "untracked" &&
                  changes[0]!.kind === "added") ||
                (changes[0]!.source === "unstaged" &&
                  (changes[0]!.kind === "modified" ||
                    changes[0]!.kind === "deleted"))
            : liveIntentToAddChanges !== undefined
              ? (changes[0]!.source === "untracked" &&
                  changes[0]!.kind === "added") ||
                (changes[0]!.source === "unstaged" &&
                  (changes[0]!.kind === "added" ||
                    changes[0]!.kind === "modified"))
              : liveDeletedChanges !== undefined
                ? changes[0]!.source === "unstaged" &&
                  (changes[0]!.kind === "modified" ||
                    changes[0]!.kind === "deleted")
              : changes[0]!.source === "unstaged" &&
                changes[0]!.kind === "modified") &&
        (changes[0]!.kind === "deleted"
          ? changes[0]!.contentDigest === undefined
          : changes[0]!.contentDigest !== undefined);
      if (!supported) {
        boundaries.push(
          changeAnalysisBoundary(
            "unsupported_source",
            boundedBatchChanges === undefined
              ? "Alpha line analysis only supports one unstaged modified change per path."
              : stagedChanges !== undefined
                ? "Alpha staged line analysis only supports unique staged modified or added paths."
                : stagedDeletedChanges !== undefined
                  ? "Alpha staged deletion analysis only supports unique staged modified, added, or deleted paths."
                : liveUntrackedChanges !== undefined
                  ? "Alpha live untracked analysis only supports unique untracked added or unstaged modified paths."
                  : liveDeletedUntrackedChanges !== undefined
                    ? "Alpha live deleted and untracked analysis only supports unique untracked added, unstaged modified, or unstaged deleted paths."
                  : liveIntentToAddChanges !== undefined
                    ? "Alpha live intent-to-add analysis only supports unique unstaged added, unstaged modified, or untracked added paths."
                    : "Alpha live deletion analysis only supports unique unstaged modified or deleted paths.",
            filePath,
            ids,
          ),
        );
        continue;
      }
      if (changes[0]!.kind === "deleted") {
        let baselineBytes: Buffer;
        let indexBytes: Buffer | undefined;
        try {
          const currentFile = await openVerifiedFile(
            this.#canonicalRoot,
            filePath,
            {
              allowMissing: true,
              readBytes: false,
              maxBytes: CHANGE_ANALYSIS_LIMITS.maxFileBytes,
            },
          );
          if (currentFile !== undefined) {
            boundaries.push(
              changeAnalysisBoundary(
                "content_changed",
                "The deleted worktree path exists after the actual Snapshot capture.",
                filePath,
                ids,
              ),
            );
            continue;
          }
          if (stagedDeletedChanges !== undefined) {
            baselineBytes = await readGitBlob(
              this.#canonicalRoot,
              baseline.data.headCommit,
              filePath,
            );
            if (!(await indexPathIsAbsent(this.#canonicalRoot, filePath))) {
              boundaries.push(
                changeAnalysisBoundary(
                  "content_changed",
                  "The staged deleted path is still present in the current Git Index.",
                  filePath,
                  ids,
                ),
              );
              continue;
            }
          } else {
            [baselineBytes, indexBytes] = await Promise.all([
              readGitBlob(
                this.#canonicalRoot,
                baseline.data.headCommit,
                filePath,
              ),
              readGitIndexBlob(this.#canonicalRoot, filePath),
            ]);
          }
        } catch (error) {
          boundaries.push(
            changeAnalysisBoundary(
              error instanceof RepositoryTaskContextProviderError &&
                error.code === "unsafe_repository_path"
                ? "unsafe_path"
                : error instanceof RangeError
                  ? "budget_exhausted"
                  : "unsupported_source",
              stagedDeletedChanges !== undefined
                ? "The staged deleted path could not be proven absent from the exact Index and worktree against the baseline HEAD."
                : "The deleted path could not be proven against the exact baseline HEAD, Index, and worktree.",
              filePath,
              ids,
            ),
          );
          continue;
        }
        if (
          stagedDeletedChanges === undefined &&
          (indexBytes === undefined || !baselineBytes.equals(indexBytes))
        ) {
          boundaries.push(
            changeAnalysisBoundary(
              "content_changed",
              "The current Index blob no longer matches the exact baseline bytes for the deleted path.",
              filePath,
              ids,
            ),
          );
          continue;
        }
        boundedSemanticBytes += baselineBytes.byteLength;
        if (boundedSemanticBytes > MAX_BOUNDED_SEMANTIC_BYTES) {
          boundaries.push(
            changeAnalysisBoundary(
              "budget_exhausted",
              stagedDeletedChanges !== undefined
                ? "Staged deletion semantic bytes exceeded the fixed aggregate Alpha budget."
                : liveDeletedUntrackedChanges !== undefined
                  ? "Live deleted and untracked semantic bytes exceeded the fixed aggregate Alpha budget."
                : "Live deletion semantic bytes exceeded the fixed aggregate Alpha budget.",
              filePath,
              ids,
            ),
          );
          break;
        }
        const diff = deterministicLineDiff({
          baselineSnapshotId: baseline.data.snapshotId,
          actualSnapshotId: actual.data.snapshotId,
          filePath,
          before: baselineBytes,
          after: Buffer.alloc(0),
        });
        if (!diff.ok) {
          boundaries.push(
            changeAnalysisBoundary(
              diff.code,
              diff.code === "budget_exhausted"
                ? "Deterministic deletion analysis exceeded its fixed budget."
                : "The deleted baseline file is binary or is not valid UTF-8.",
              filePath,
              ids,
            ),
          );
          continue;
        }
        const deletionHunk = diff.hunks[0];
        if (
          diff.hunks.length !== 1 ||
          deletionHunk?.oldLineRange === undefined ||
          deletionHunk.newLineRange !== undefined
        ) {
          boundaries.push(
            changeAnalysisBoundary(
              "unsupported_source",
              "An empty or non-textual deletion has no exact baseline source range in the Alpha profile.",
              filePath,
              ids,
            ),
          );
          continue;
        }
        if (
          hunks.length + deletedFiles.length + 1 >
          CHANGE_ANALYSIS_LIMITS.maxHunks
        ) {
          boundaries.push(
            changeAnalysisBoundary(
              "budget_exhausted",
              stagedDeletedChanges !== undefined
                ? "Staged deletion observations exceeded the fixed aggregate Alpha budget."
                : liveDeletedUntrackedChanges !== undefined
                  ? "Live deleted and untracked observations exceeded the fixed aggregate Alpha budget."
                : "Live deletion observations exceeded the fixed aggregate Alpha budget.",
              filePath,
              ids,
            ),
          );
          break;
        }
        deletedFiles.push({
          id: deletionHunk.id,
          actualChangeIds: [...ids].sort(compareUnicodeCodeUnits),
          filePath,
          oldLineRange: [...deletionHunk.oldLineRange] as [number, number],
          contentHash: `sha256:${createHash("sha256")
            .update(baselineBytes)
            .digest("hex")}`,
        });
        continue;
      }
      let actualFile: VerifiedFile;
      let actualBytes: Buffer;
      let baselineBytes: Buffer;
      try {
        actualFile = (await openVerifiedFile(this.#canonicalRoot, filePath, {
          allowMissing: false,
          readBytes: true,
          maxBytes: CHANGE_ANALYSIS_LIMITS.maxFileBytes,
        }))!;
      } catch (error) {
        const code =
          error instanceof RepositoryTaskContextProviderError &&
          error.code === "repository_file_too_large"
            ? "budget_exhausted"
            : error instanceof RepositoryTaskContextProviderError &&
                error.code === "unsafe_repository_path"
              ? "unsafe_path"
              : "content_changed";
        boundaries.push(
          changeAnalysisBoundary(
            code,
            "The actual worktree file could not be read and verified safely.",
            filePath,
            ids,
          ),
        );
        continue;
      }
      const worktreeDigest =
        `sha256:${createHash("sha256").update(actualFile.bytes!).digest("hex")}`;
      if (
        stagedChanges === undefined &&
        stagedDeletedChanges === undefined
      ) {
        actualBytes = actualFile.bytes!;
      } else {
        let indexBytes: Buffer;
        try {
          indexBytes = await readGitIndexBlob(this.#canonicalRoot, filePath);
        } catch (error) {
          boundaries.push(
            changeAnalysisBoundary(
              error instanceof RepositoryTaskContextProviderError &&
                error.code === "unsafe_repository_path"
                ? "unsafe_path"
                : error instanceof RangeError
                  ? "budget_exhausted"
                  : "unsupported_source",
              "The exact staged Git index blob could not be read within the Alpha profile.",
              filePath,
              ids,
            ),
          );
          continue;
        }
        const indexDigest =
          `sha256:${createHash("sha256").update(indexBytes).digest("hex")}`;
        if (
          indexDigest !== changes[0]!.contentDigest ||
          worktreeDigest !== changes[0]!.contentDigest ||
          !indexBytes.equals(actualFile.bytes!)
        ) {
          boundaries.push(
            changeAnalysisBoundary(
              "content_changed",
              "The staged Index, worktree file, and actual Snapshot do not contain the same exact bytes.",
              filePath,
              ids,
            ),
          );
          continue;
        }
        actualBytes = indexBytes;
      }
      const actualDigest =
        `sha256:${createHash("sha256").update(actualBytes).digest("hex")}`;
      if (actualDigest !== changes[0]!.contentDigest) {
        boundaries.push(
          changeAnalysisBoundary(
            "content_changed",
            "The worktree bytes no longer match the exact actual Snapshot digest.",
            filePath,
            ids,
          ),
        );
        continue;
      }
      if (changes[0]!.kind === "added") {
        try {
          if (
            !(await baselinePathIsAbsent(
              this.#canonicalRoot,
              baseline.data.headCommit,
              filePath,
            ))
          ) {
            boundaries.push(
              changeAnalysisBoundary(
                "unsupported_source",
                "The exact baseline Git tree already contains a path classified as added.",
                filePath,
                ids,
              ),
            );
            continue;
          }
          baselineBytes = Buffer.alloc(0);
        } catch (error) {
          boundaries.push(
            changeAnalysisBoundary(
              error instanceof RepositoryTaskContextProviderError &&
                error.code === "unsafe_repository_path"
                ? "unsafe_path"
                : error instanceof RangeError
                  ? "budget_exhausted"
                  : "unsupported_source",
              "The exact baseline Git tree could not prove that the added path was absent.",
              filePath,
              ids,
            ),
          );
          continue;
        }
      } else {
        try {
          baselineBytes = await readGitBlob(
            this.#canonicalRoot,
            baseline.data.headCommit,
            filePath,
          );
        } catch (error) {
          boundaries.push(
            changeAnalysisBoundary(
              error instanceof RepositoryTaskContextProviderError &&
                error.code === "unsafe_repository_path"
                ? "unsafe_path"
                : error instanceof RangeError
                  ? "budget_exhausted"
                  : "unsupported_source",
              "The exact baseline Git blob could not be read within the Alpha profile.",
              filePath,
              ids,
            ),
          );
          continue;
        }
      }
      if (boundedBatchChanges !== undefined) {
        boundedSemanticBytes +=
          baselineBytes.byteLength + actualBytes.byteLength;
        if (boundedSemanticBytes > MAX_BOUNDED_SEMANTIC_BYTES) {
          boundaries.push(
            changeAnalysisBoundary(
              "budget_exhausted",
              stagedChanges !== undefined
                ? "Staged semantic bytes exceeded the fixed aggregate Alpha budget."
                : stagedDeletedChanges !== undefined
                  ? "Staged deletion batch semantic bytes exceeded the fixed aggregate Alpha budget."
                : liveUntrackedChanges !== undefined
                  ? "Live untracked semantic bytes exceeded the fixed aggregate Alpha budget."
                  : liveDeletedUntrackedChanges !== undefined
                    ? "Live deleted and untracked semantic bytes exceeded the fixed aggregate Alpha budget."
                  : liveIntentToAddChanges !== undefined
                    ? "Live intent-to-add semantic bytes exceeded the fixed aggregate Alpha budget."
                    : "Live deletion semantic bytes exceeded the fixed aggregate Alpha budget.",
              filePath,
              ids,
            ),
          );
          break;
        }
      }
      const diff = deterministicLineDiff({
        baselineSnapshotId: baseline.data.snapshotId,
        actualSnapshotId: actual.data.snapshotId,
        filePath,
        before: baselineBytes,
        after: actualBytes,
      });
      if (!diff.ok) {
        boundaries.push(
          changeAnalysisBoundary(
            diff.code,
            diff.code === "budget_exhausted"
              ? "Deterministic line analysis exceeded its fixed budget."
              : "The changed file is binary or is not valid UTF-8.",
            filePath,
            ids,
          ),
        );
        continue;
      }
      if (diff.hunks.length === 0) {
        boundaries.push(
          changeAnalysisBoundary(
            "unsupported_source",
            "A mode-only or empty textual change has no analyzable line hunk.",
            filePath,
            ids,
          ),
        );
        continue;
      }
      const pathHunks: TaskChangeHunk[] = [];
      let pathBoundary: TaskChangeAnalysisBoundary | undefined;
      for (const hunk of diff.hunks) {
        if (hunk.newLineRange === undefined) {
          pathBoundary = changeAnalysisBoundary(
            "unsupported_source",
            "Deletion-only hunks have no actual source range in the Alpha profile.",
            filePath,
            ids,
          );
          break;
        }
        const clusters = graphSymbolClustersForRange(
          hunk.id,
          graph.nodes,
          filePath,
          hunk.newLineRange,
          (node) => sourceAnchorMatches(node, actualBytes),
        );
        if (clusters === undefined || clusters.length === 0) {
          pathBoundary = changeAnalysisBoundary(
            "symbol_mapping_unknown",
            "A changed line hunk could not be mapped to a current validated Graph symbol.",
            filePath,
            ids,
          );
          break;
        }
        for (const cluster of clusters) {
          pathHunks.push({
            id: cluster.id,
            actualChangeIds: [...ids].sort(compareUnicodeCodeUnits),
            filePath,
            newLineRange: [...cluster.lineRange] as [number, number],
            nodeIds: [...cluster.nodeIds].sort(compareUnicodeCodeUnits),
            contentHash: actualDigest,
          });
        }
      }
      if (pathBoundary !== undefined) {
        boundaries.push(pathBoundary);
      } else {
        if (
          boundedBatchChanges !== undefined &&
          hunks.length + deletedFiles.length + pathHunks.length >
            CHANGE_ANALYSIS_LIMITS.maxHunks
        ) {
          boundaries.push(
            changeAnalysisBoundary(
              "budget_exhausted",
              stagedChanges !== undefined
                ? "Staged line hunks exceeded the fixed aggregate Alpha budget."
                : stagedDeletedChanges !== undefined
                  ? "Staged deletion batch line hunks exceeded the fixed aggregate Alpha budget."
                : liveUntrackedChanges !== undefined
                  ? "Live untracked line hunks exceeded the fixed aggregate Alpha budget."
                  : liveDeletedUntrackedChanges !== undefined
                    ? "Live deleted and untracked line hunks exceeded the fixed aggregate Alpha budget."
                  : liveIntentToAddChanges !== undefined
                    ? "Live intent-to-add line hunks exceeded the fixed aggregate Alpha budget."
                    : "Live deletion line hunks exceeded the fixed aggregate Alpha budget.",
              filePath,
              ids,
            ),
          );
          break;
        }
        hunks.push(...pathHunks);
      }
    }

    if (requiresLiveSnapshotFence) {
      const fence = await sampleLiveAnalysisFence(
        this.#canonicalRoot,
        actual.data,
      );
      if (!fence.ok) {
        return {
          status: "unknown",
          hunks: [],
          deletedFiles: [],
          boundaries: [
            changeAnalysisBoundary(
              fence.code,
              fence.reason,
              undefined,
              actualChangeIds,
            ),
          ],
        };
      }
    }
    if (boundedBatchChanges !== undefined) {
      if (boundaries.length > 0) {
        const orderedBoundaries = [...boundaries].sort((left, right) =>
          compareUnicodeCodeUnits(left.filePath ?? "", right.filePath ?? "") ||
          compareUnicodeCodeUnits(left.code, right.code) ||
          compareUnicodeCodeUnits(left.actualChangeIds.join("\0"), right.actualChangeIds.join("\0")),
        );
        const primary = orderedBoundaries[0]!;
        return {
          status: "unknown",
          hunks: [],
          deletedFiles: [],
          boundaries: [
            changeAnalysisBoundary(
              primary.code,
              primary.reason,
              undefined,
              actualChangeIds,
            ),
          ],
        };
      }
    }

    hunks.sort(compareTaskChangeHunks);
    deletedFiles.sort((left, right) =>
      compareUnicodeCodeUnits(left.filePath, right.filePath) ||
      compareUnicodeCodeUnits(left.id, right.id),
    );
    boundaries.sort((left, right) =>
      compareUnicodeCodeUnits(left.filePath ?? "", right.filePath ?? "") ||
      compareUnicodeCodeUnits(left.code, right.code) ||
      compareUnicodeCodeUnits(left.actualChangeIds.join("\0"), right.actualChangeIds.join("\0")),
    );
    return {
      status:
        boundaries.length === 0
          ? "complete"
          : hunks.length === 0 && deletedFiles.length === 0
            ? "unknown"
            : "partial",
      hunks,
      deletedFiles,
      boundaries,
    };
  }

  async loadTaskContext(
    input: TaskContextLoadInput,
  ): Promise<TaskContextData> {
    const snapshot = RepositorySnapshotV1Schema.safeParse(
      input.repositorySnapshot,
    );
    if (!snapshot.success) {
      throw new RepositoryTaskContextProviderError(
        "invalid_snapshot",
        "The requested Repository Snapshot failed contract validation.",
      );
    }
    if (
      snapshot.data.snapshotId !== input.sourceSnapshotId
    ) {
      throw new RepositoryTaskContextProviderError(
        "snapshot_mismatch",
        "The requested Snapshot identity does not match its payload.",
      );
    }

    const graph = validateGraphArtifact(
      await readRequiredJson(
        this.#canonicalRoot,
        this.#options.graphPath,
        this.#options.maxGraphBytes,
      ),
      this.#options.graphPath,
    );
    const existingFilePaths = await verifiedGraphPaths(
      this.#canonicalRoot,
      graph,
      input.scope,
    );
    const existingPaths = new Set(existingFilePaths);
    const [wikiIndex, wikiSearch] = await Promise.all([
      readOptionalJson(
        this.#canonicalRoot,
        this.#options.wikiIndexPath,
        this.#options.maxWikiBytes,
      ),
      readOptionalJson(
        this.#canonicalRoot,
        this.#options.wikiSearchPath,
        this.#options.maxWikiBytes,
      ),
    ]);
    const wiki = adaptWiki(
      wikiIndex,
      wikiSearch,
      graph,
      existingPaths,
    );
    const sourceEvidence = await snapshotBoundSourceEvidence(
      this.#canonicalRoot,
      graph,
      existingPaths,
      { ...input, repositorySnapshot: snapshot.data },
      this.#options.maxSourceFileBytes,
    );
    return {
      graph,
      existingFilePaths,
      ...(wiki === undefined ? {} : { wiki }),
      ...(sourceEvidence.length === 0 ? {} : { sourceEvidence }),
      repositorySnapshot: snapshot.data,
    };
  }
}
