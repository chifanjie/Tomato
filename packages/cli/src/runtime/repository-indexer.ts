import { createHash, randomBytes } from "node:crypto";
import { constants as fsConstants, promises as fs } from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

import {
  GraphBuilder,
  PluginRegistry,
  buildKnowledgeArtifacts,
  contentHash,
  createIgnoreFilter,
  extractFileFingerprint,
  generateKnowledgeBase,
  resolveCalls,
  type CallResolverFile,
  type FingerprintStore,
  type GeneratedDocument,
  type KnowledgeGraph,
} from "@understand-code/core";
import {
  ContentDigestSchema,
  OpaqueIdentifierSchema,
  RevisionSchema,
  SnapshotIdSchema,
  TaskIdSchema,
  type RepositorySnapshotPersistedPayloadV1,
} from "@understand-code/contracts";
import {
  isSensitiveRepositoryPath,
  readStableRepositoryFile,
} from "@understand-code/repository-state";
import { repositoryParserRegistryV1 } from "./repository-parser.js";
import { createRepositoryImportResolverV1 } from "./repository-imports.js";

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const SKIP_DIRECTORIES = new Set([
  ".git",
  ".understand-code",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".cache",
  ".turbo",
  "target",
  "vendor",
  "venv",
  ".venv",
  "__pycache__",
]);
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2",
  ".ttf", ".eot", ".mp3", ".mp4", ".pdf", ".zip", ".tar", ".gz",
]);
const INDEX_STAGING_DIRECTORY = ".refresh-index-staging-v1";
const INDEX_STAGE_MANIFEST = "stage-manifest.json";
const INDEX_OPERATION_ID = /^[0-9a-f]{32}$/u;
const INDEX_GENERATION_ID = /^generation-[0-9a-f]{64}$/u;
const INDEX_GENERATIONS_DIRECTORY = "index-generations-v1";
const INDEX_ACTIVE_MANIFEST = "index-active-v1.json";
const INDEX_GENERATION_MANIFEST = "generation-manifest.json";
const INDEX_PUBLISH_LOCK = ".index-publish-v1.lock";
const INDEX_PENDING_DIRECTORY = "index-pending-v1";
const INDEX_PENDING_LOCK = ".index-pending-v1.lock";
const KNOWLEDGE_LINEAGE_PATH = "knowledge-base/.trace/task-lineage.json";
const MAX_PENDING_GENERATIONS = 32;
const REFRESH_PUBLICATION_HEAD = "refresh-publication-head-v1.json";
const MAX_RETAINED_GENERATIONS = 32;
const GENERATION_GC_AGE_MS = 24 * 60 * 60 * 1_000;
const MAX_RETAINED_STAGING_OPERATIONS = 32;
const STAGING_GC_AGE_MS = 24 * 60 * 60 * 1_000;
const O_NOFOLLOW =
  (fsConstants as Readonly<Record<string, number>>)["O_NOFOLLOW"] ?? 0;
const INDEX_ROOT_FILES = new Set([
  "fingerprints.json",
  "knowledge-graph.json",
  "meta.json",
]);

export class RepositoryIndexError extends Error {
  readonly code = "repository_index_failed" as const;
  readonly existingRequestDigest?: `sha256:${string}`;

  constructor(message: string, options?: ErrorOptions & { readonly existingRequestDigest?: `sha256:${string}` }) {
    super(message, options);
    this.name = "RepositoryIndexError";
    if (options?.existingRequestDigest !== undefined) this.existingRequestDigest = options.existingRequestDigest;
  }
}

interface SourceFile {
  readonly relativePath: string;
  readonly content: string;
}

export interface BuildRepositoryIndexInput {
  readonly canonicalRoot: string;
  readonly canonicalInstallationRoot: string;
  readonly operationId: string;
  readonly snapshot: RepositorySnapshotPersistedPayloadV1;
  /** Bound by the read-only full-corpus preflight before Provider commit. */
  readonly expectedSourceInventoryDigest?: `sha256:${string}`;
  readonly knowledgeLineage?: RepositoryIndexKnowledgeLineageV1;
}

interface RepositoryIndexKnowledgeLineageBaseV1 {
  readonly schemaVersion: 1;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly sourceSnapshotId: string;
  readonly requestDigest: `sha256:${string}`;
  readonly idempotencyKeyDigest: `sha256:${string}`;
  readonly predecessorGenerationId?: string;
}

export type RepositoryIndexKnowledgeLineageV1 = RepositoryIndexKnowledgeLineageBaseV1 & (
  | { readonly status: "pending" }
  | {
      readonly status: "published";
      readonly candidateGenerationId: string;
      readonly currentCheckId: string;
      readonly verificationIds: readonly string[];
    }
);

export interface RepositoryIndexKnowledgePublicationV1 {
  readonly generation: RepositoryIndexGenerationBindingV1;
  readonly publication: RepositoryIndexPublicationBundleV1;
  readonly knowledgeLineage: RepositoryIndexKnowledgeLineageV1;
}

export interface PendingRepositoryIndexV1 extends RepositoryIndexKnowledgePublicationV1 {
  readonly knowledgeLineage: Extract<RepositoryIndexKnowledgeLineageV1, { status: "pending" }>;
}

export interface StagedRepositoryIndexInput {
  readonly canonicalRoot: string;
  readonly canonicalInstallationRoot: string;
  readonly operationId: string;
}

export interface RepositoryIndexPreflightResult {
  readonly sourceInventoryDigest: `sha256:${string}`;
  readonly sourceFileCount: number;
}

export interface RepositoryIndexGenerationBindingV1 {
  readonly generationId: string;
  readonly generationManifestDigest: `sha256:${string}`;
  readonly sourceInventoryDigest: `sha256:${string}`;
}

export interface RepositoryIndexAuthorityV1 {
  readonly sourceSnapshotId: string;
  readonly finalizedProviderRevision: number;
}

export interface BuildRepositoryIndexResult {
  readonly graph: KnowledgeGraph;
  readonly graphDigest: `sha256:${string}`;
  readonly analyzedFiles: number;
  readonly generatedAt: string;
  readonly generation: RepositoryIndexGenerationBindingV1;
  readonly publication: RepositoryIndexPublicationBundleV1;
}

export interface RepositoryIndexPublicationBundleV1 {
  readonly manifestBytes: Buffer;
  readonly files: readonly StagedIndexFile[];
}

function digest(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function digestBytes(value: Buffer): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function knowledgeLineageV1(value: unknown): RepositoryIndexKnowledgeLineageV1 {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(value).some((key) => typeof key !== "string" ||
      !descriptors[key]?.enumerable || !("value" in descriptors[key]!))) throw new Error();
    const record = value as Record<string, unknown>;
    const keys = ["schemaVersion", "status", "taskId", "taskRevision", "sourceSnapshotId", "requestDigest", "idempotencyKeyDigest"];
    if (Object.hasOwn(record, "predecessorGenerationId")) keys.push("predecessorGenerationId");
    if (record.status === "published") keys.push("candidateGenerationId", "currentCheckId", "verificationIds");
    if (record.schemaVersion !== 1 || !["pending", "published"].includes(record.status as string) ||
      Object.keys(record).sort().join("\0") !== keys.sort().join("\0")) throw new Error();
    if (Object.hasOwn(record, "predecessorGenerationId") &&
      (typeof record.predecessorGenerationId !== "string" || !INDEX_GENERATION_ID.test(record.predecessorGenerationId))) throw new Error();
    const base: RepositoryIndexKnowledgeLineageBaseV1 = {
      schemaVersion: 1,
      taskId: TaskIdSchema.parse(record.taskId),
      taskRevision: RevisionSchema.parse(record.taskRevision),
      sourceSnapshotId: SnapshotIdSchema.parse(record.sourceSnapshotId),
      requestDigest: ContentDigestSchema.parse(record.requestDigest) as `sha256:${string}`,
      idempotencyKeyDigest: ContentDigestSchema.parse(record.idempotencyKeyDigest) as `sha256:${string}`,
      ...(record.predecessorGenerationId === undefined ? {} : { predecessorGenerationId: record.predecessorGenerationId as string }),
    };
    if (record.status === "pending") return Object.freeze({ ...base, status: "pending" });
    if (typeof record.candidateGenerationId !== "string" || !INDEX_GENERATION_ID.test(record.candidateGenerationId) ||
      !Array.isArray(record.verificationIds)) throw new Error();
    const verificationIds = Array.from(record.verificationIds, (id) => OpaqueIdentifierSchema.parse(id));
    if (verificationIds.some((id, index) => index > 0 && verificationIds[index - 1]! >= id)) throw new Error();
    return Object.freeze({
      ...base,
      status: "published",
      candidateGenerationId: record.candidateGenerationId,
      currentCheckId: OpaqueIdentifierSchema.parse(record.currentCheckId),
      verificationIds: Object.freeze(verificationIds),
    });
  } catch {
    throw new RepositoryIndexError("knowledge lineage is invalid");
  }
}

function knowledgeLineageBytesV1(lineage: RepositoryIndexKnowledgeLineageV1): Buffer {
  return Buffer.from(`${JSON.stringify(lineage, null, 2)}\n`, "utf8");
}

function readKnowledgeLineageBytesV1(bytes: Buffer): RepositoryIndexKnowledgeLineageV1 {
  try {
    const lineage = knowledgeLineageV1(JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)));
    if (!knowledgeLineageBytesV1(lineage).equals(bytes)) throw new Error();
    return lineage;
  } catch {
    throw new RepositoryIndexError("knowledge lineage bytes are invalid");
  }
}

function createIndexPublicationV1(
  files: readonly StagedIndexFile[],
  sourceInventoryDigest: `sha256:${string}`,
): Pick<RepositoryIndexKnowledgePublicationV1, "generation" | "publication"> {
  const detachedFiles = files.map((file) => ({ ...file, bytes: Buffer.from(file.bytes) }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const seed = {
    schemaVersion: 1,
    sourceInventoryDigest,
    files: detachedFiles.map(({ relativePath, contentDigest }) => ({ path: relativePath, contentDigest })),
  };
  const generationId = `generation-${digest(JSON.stringify(seed)).slice(7)}`;
  const manifestBytes = Buffer.from(`${JSON.stringify({ ...seed, generationId }, null, 2)}\n`, "utf8");
  return {
    generation: Object.freeze({ generationId, generationManifestDigest: digestBytes(manifestBytes), sourceInventoryDigest }),
    publication: Object.freeze({ manifestBytes, files: Object.freeze(detachedFiles.map((file) => Object.freeze(file))) }),
  };
}

function verifiedIndexPublicationV1(input: Readonly<{
  generation: RepositoryIndexGenerationBindingV1;
  publication: RepositoryIndexPublicationBundleV1;
}>): Pick<RepositoryIndexKnowledgePublicationV1, "generation" | "publication"> {
  const manifestBytes = Buffer.from(input.publication.manifestBytes);
  const manifest = parseGenerationManifestV1(JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(manifestBytes)));
  if (manifest.generationId !== input.generation.generationId ||
    manifest.sourceInventoryDigest !== input.generation.sourceInventoryDigest ||
    digestBytes(manifestBytes) !== input.generation.generationManifestDigest) {
    throw new RepositoryIndexError("repository index publication manifest is not exact");
  }
  const files = input.publication.files.map((file) => {
    const bytes = Buffer.from(file.bytes);
    if (!safeIndexArtifactPath(file.relativePath) || digestBytes(bytes) !== file.contentDigest) {
      throw new RepositoryIndexError("repository index publication bytes are not exact");
    }
    return Object.freeze({ relativePath: file.relativePath, contentDigest: file.contentDigest, bytes });
  });
  if (JSON.stringify(files.map((file) => ({ path: file.relativePath, contentDigest: file.contentDigest }))) !== JSON.stringify(manifest.files)) {
    throw new RepositoryIndexError("repository index publication inventory is not exact");
  }
  return {
    generation: Object.freeze({ generationId: manifest.generationId, sourceInventoryDigest: manifest.sourceInventoryDigest, generationManifestDigest: digestBytes(manifestBytes) }),
    publication: Object.freeze({ manifestBytes, files: Object.freeze(files) }),
  };
}

/** Changes only the lineage file. The caller must independently authorize Task promotion. */
export function withRepositoryIndexKnowledgeLineageV1(input: Readonly<{
  generation: RepositoryIndexGenerationBindingV1;
  publication: RepositoryIndexPublicationBundleV1;
  knowledgeLineage: RepositoryIndexKnowledgeLineageV1;
}>): RepositoryIndexKnowledgePublicationV1 {
  const original = verifiedIndexPublicationV1(input);
  const lineage = knowledgeLineageV1(input.knowledgeLineage);
  if (lineage.status === "published") {
    const priorBytes = original.publication.files.find((file) => file.relativePath === KNOWLEDGE_LINEAGE_PATH)?.bytes;
    const prior = priorBytes === undefined ? undefined : readKnowledgeLineageBytesV1(priorBytes);
    if (prior?.status !== "pending" || lineage.candidateGenerationId !== original.generation.generationId ||
      lineage.taskId !== prior.taskId || lineage.taskRevision < prior.taskRevision ||
      lineage.sourceSnapshotId !== prior.sourceSnapshotId || lineage.predecessorGenerationId !== prior.predecessorGenerationId ||
      lineage.requestDigest !== prior.requestDigest || lineage.idempotencyKeyDigest !== prior.idempotencyKeyDigest) {
      throw new RepositoryIndexError("published knowledge lineage does not match its pending candidate");
    }
  }
  const bytes = knowledgeLineageBytesV1(lineage);
  const files = original.publication.files.filter((file) => file.relativePath !== KNOWLEDGE_LINEAGE_PATH);
  files.push({ relativePath: KNOWLEDGE_LINEAGE_PATH, contentDigest: digestBytes(bytes), bytes });
  return {
    ...createIndexPublicationV1(files, original.generation.sourceInventoryDigest),
    knowledgeLineage: lineage,
  };
}

function stagedIndexRoot(input: StagedRepositoryIndexInput): string {
  if (
    !path.isAbsolute(input.canonicalInstallationRoot) ||
    path.resolve(input.canonicalInstallationRoot) !==
      input.canonicalInstallationRoot ||
    !INDEX_OPERATION_ID.test(input.operationId)
  ) {
    throw new RepositoryIndexError("repository index staging scope is invalid");
  }
  return path.join(
    input.canonicalInstallationRoot,
    INDEX_STAGING_DIRECTORY,
    input.operationId,
  );
}

function safeIndexArtifactPath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll("\\", "/");
  if (
    normalized !== relativePath ||
    normalized.startsWith("/") ||
    normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    return false;
  }
  return INDEX_ROOT_FILES.has(normalized) ||
    normalized.startsWith("knowledge-base/");
}

interface StagedIndexFile {
  readonly relativePath: string;
  readonly contentDigest: `sha256:${string}`;
  readonly bytes: Buffer;
}

async function collectStagedIndexFiles(
  root: string,
  manifestName = INDEX_STAGE_MANIFEST,
): Promise<StagedIndexFile[]> {
  const rootBefore = await fs.lstat(root);
  if (!rootBefore.isDirectory() || rootBefore.isSymbolicLink()) {
    throw new RepositoryIndexError("staged repository index root is invalid");
  }
  const files: StagedIndexFile[] = [];
  const visit = async (directory: string, relativeDirectory: string): Promise<void> => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = relativeDirectory === ""
        ? entry.name
        : `${relativeDirectory}/${entry.name}`;
      if (entry.isSymbolicLink()) {
        throw new RepositoryIndexError(`staged repository index contains a symlink: ${relativePath}`);
      }
      if (relativePath === manifestName) {
        if (!entry.isFile()) {
          throw new RepositoryIndexError("staged repository index manifest is invalid");
        }
        continue;
      }
      if (entry.isDirectory()) {
        if (relativePath !== "knowledge-base" && !relativePath.startsWith("knowledge-base/")) {
          throw new RepositoryIndexError(`staged repository index directory is invalid: ${relativePath}`);
        }
        await visit(path.join(directory, entry.name), relativePath);
        continue;
      }
      if (!entry.isFile() || !safeIndexArtifactPath(relativePath)) {
        throw new RepositoryIndexError(`staged repository index artifact is invalid: ${relativePath}`);
      }
      const filePath = path.join(directory, entry.name);
      const before = await fs.lstat(filePath);
      if (
        !before.isFile() ||
        before.isSymbolicLink() ||
        (before.mode & 0o777) !== 0o600
      ) {
        throw new RepositoryIndexError(`staged repository index artifact changed kind: ${relativePath}`);
      }
      const bytes = await readStableNoFollowFile(filePath);
      const after = await fs.lstat(filePath);
      if (
        !after.isFile() ||
        after.isSymbolicLink() ||
        before.dev !== after.dev ||
        before.ino !== after.ino ||
        before.size !== after.size ||
        before.mtimeMs !== after.mtimeMs ||
        (after.mode & 0o777) !== 0o600 ||
        bytes.byteLength !== after.size
      ) {
        throw new RepositoryIndexError(`staged repository index artifact changed during read: ${relativePath}`);
      }
      files.push({
        relativePath,
        contentDigest: digestBytes(bytes),
        bytes,
      });
    }
  };
  await visit(root, "");
  const rootAfter = await fs.lstat(root);
  if (
    !rootAfter.isDirectory() ||
    rootAfter.isSymbolicLink() ||
    rootBefore.dev !== rootAfter.dev ||
    rootBefore.ino !== rootAfter.ino
  ) {
    throw new RepositoryIndexError(
      "staged repository index root changed during inspection",
    );
  }
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function readStableNoFollowFile(filePath: string): Promise<Buffer> {
  const parent = path.dirname(filePath);
  const parentBefore = await fs.lstat(parent);
  if (!parentBefore.isDirectory() || parentBefore.isSymbolicLink()) {
    throw new RepositoryIndexError("repository index file parent is invalid");
  }
  const handle = await fs.open(
    filePath,
    fsConstants.O_RDONLY | O_NOFOLLOW,
  );
  try {
    const before = await handle.stat();
    if (!before.isFile() || (before.mode & 0o777) !== 0o600) {
      throw new RepositoryIndexError("repository index path is not a file");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const parentAfter = await fs.lstat(parent);
    if (
      !after.isFile() ||
      bytes.byteLength !== after.size ||
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      !parentAfter.isDirectory() ||
      parentAfter.isSymbolicLink() ||
      parentBefore.dev !== parentAfter.dev ||
      parentBefore.ino !== parentAfter.ino
    ) {
      throw new RepositoryIndexError(
        "repository index file changed during read",
      );
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

interface GenerationManifestV1 {
  readonly schemaVersion: 1;
  readonly generationId: string;
  readonly sourceInventoryDigest: `sha256:${string}`;
  readonly files: readonly Readonly<{
    readonly path: string;
    readonly contentDigest: `sha256:${string}`;
  }>[];
}

function parseGenerationManifestV1(value: unknown): GenerationManifestV1 {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join("\u0000") !==
      ["files", "generationId", "schemaVersion", "sourceInventoryDigest"]
        .sort().join("\u0000")
  ) {
    throw new RepositoryIndexError("repository index generation manifest is invalid");
  }
  const record = value as Record<string, unknown>;
  if (
    record["schemaVersion"] !== 1 ||
    typeof record["generationId"] !== "string" ||
    !INDEX_GENERATION_ID.test(record["generationId"]) ||
    typeof record["sourceInventoryDigest"] !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(record["sourceInventoryDigest"]) ||
    !Array.isArray(record["files"])
  ) {
    throw new RepositoryIndexError("repository index generation manifest is invalid");
  }
  let previous = "";
  const files = record["files"].map((entry) => {
    if (
      entry === null ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      Object.keys(entry).sort().join("\u0000") !==
        ["contentDigest", "path"].sort().join("\u0000")
    ) {
      throw new RepositoryIndexError("repository index generation file is invalid");
    }
    const file = entry as Record<string, unknown>;
    if (
      typeof file["path"] !== "string" ||
      !safeIndexArtifactPath(file["path"]) ||
      file["path"] <= previous ||
      typeof file["contentDigest"] !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(file["contentDigest"])
    ) {
      throw new RepositoryIndexError("repository index generation file is invalid");
    }
    previous = file["path"];
    return {
      path: file["path"],
      contentDigest: file["contentDigest"] as `sha256:${string}`,
    };
  });
  const expectedGenerationId = `generation-${digest(JSON.stringify({
    schemaVersion: 1,
    sourceInventoryDigest: record["sourceInventoryDigest"],
    files,
  })).slice(7)}`;
  if (record["generationId"] !== expectedGenerationId) {
    throw new RepositoryIndexError(
      "repository index generation identity is invalid",
    );
  }
  return {
    schemaVersion: 1,
    generationId: record["generationId"],
    sourceInventoryDigest:
      record["sourceInventoryDigest"] as `sha256:${string}`,
    files,
  };
}

const FATAL_UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

function containsHighConfidenceSecret(content: string): boolean {
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/=\r\n]{80,}-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u
    .test(content) ||
    /\bAKIA[0-9A-Z]{16}\b/u.test(content) ||
    /\bgh[pousr]_[A-Za-z0-9]{36,}\b/u.test(content);
}

function sourceInventoryDigest(sourceFiles: readonly SourceFile[]): `sha256:${string}` {
  return digest(JSON.stringify(sourceFiles.map((source) => ({
    path: source.relativePath,
    contentDigest: digest(source.content),
  }))));
}

function snapshotHeadCommit(
  snapshot: RepositorySnapshotPersistedPayloadV1,
): string | undefined {
  return "profile" in snapshot
    ? snapshot.headState.kind === "commit"
      ? snapshot.headState.commit
      : undefined
    : snapshot.headCommit;
}

async function collectSourceFiles(root: string): Promise<SourceFile[]> {
  const ignore = createIgnoreFilter(root);
  const files: SourceFile[] = [];
  const visit = async (directory: string, relativeDirectory: string): Promise<void> => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = relativeDirectory === ""
        ? entry.name
        : `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name) || ignore.isIgnored(`${relativePath}/`)) continue;
        if (isSensitiveRepositoryPath(relativePath)) {
          throw new RepositoryIndexError(`sensitive repository source is not analyzable: ${relativePath}`);
        }
        await visit(path.join(directory, entry.name), relativePath);
        continue;
      }
      if (entry.isSymbolicLink()) {
        // Do not follow links during analysis. A link can change between lstat
        // and read and would turn the indexer into an arbitrary file reader.
        throw new RepositoryIndexError(`symlink repository paths are not analyzable: ${relativePath}`);
      }
      if (isSensitiveRepositoryPath(relativePath)) {
        throw new RepositoryIndexError(`sensitive repository source is not analyzable: ${relativePath}`);
      }
      if (ignore.isIgnored(relativePath) || ignore.isIgnored(`${relativePath}/`)) continue;
      if (!entry.isFile()) {
        throw new RepositoryIndexError(`special repository paths are not analyzable: ${relativePath}`);
      }
      const extension = path.extname(entry.name).toLowerCase();
      if (BINARY_EXTENSIONS.has(extension)) continue;
      const absolutePath = path.join(root, relativePath);
      const stat = await fs.lstat(absolutePath);
      if (!stat.isFile()) {
        throw new RepositoryIndexError(`repository source changed kind before read: ${relativePath}`);
      }
      if (stat.size > MAX_SOURCE_BYTES) {
        throw new RepositoryIndexError(`repository source exceeds the analysis limit: ${relativePath}`);
      }
      let bytes: Buffer;
      try {
        bytes = await readStableRepositoryFile(
          root,
          relativePath,
          MAX_SOURCE_BYTES,
        );
      } catch (error) {
        throw new RepositoryIndexError(
          `repository source changed or escaped during read: ${relativePath}`,
          { cause: error },
        );
      }
      let content: string;
      try {
        content = FATAL_UTF8_DECODER.decode(bytes);
      } catch (error) {
        throw new RepositoryIndexError(
          `repository source is not valid UTF-8: ${relativePath}`,
          { cause: error },
        );
      }
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(content)) {
        throw new RepositoryIndexError(`repository source contains unsafe control bytes: ${relativePath}`);
      }
      if (containsHighConfidenceSecret(content)) {
        throw new RepositoryIndexError(`repository source contains secret-like content: ${relativePath}`);
      }
      files.push({ relativePath, content });
    }
  };
  await visit(root, "");
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

/** Read-only, full-corpus admission check. It never creates managed output. */
export async function preflightRepositoryIndex(
  canonicalRoot: string,
): Promise<RepositoryIndexPreflightResult> {
  const sourceFiles = await collectSourceFiles(canonicalRoot);
  return {
    sourceInventoryDigest: sourceInventoryDigest(sourceFiles),
    sourceFileCount: sourceFiles.length,
  };
}

function lineRange(content: string): [number, number] {
  return [1, Math.max(1, content.split(/\r?\n/u).length)];
}

function sourceExcerpt(content: string): string {
  return content.length <= 800 ? content : `${content.slice(0, 800)}\n…`;
}


function fallbackDocument(
  existing: GeneratedDocument | undefined,
  input: { readonly id: string; readonly path: string; readonly title: string; readonly stage: "purpose" | "evidence"; readonly routeOrder: number; readonly nodeId: string; readonly filePath: string; readonly excerpt: string; readonly lineRange: [number, number] },
): GeneratedDocument {
  return {
    ...(existing ?? {
      representedEdgeIds: [],
      reason: "repository-indexer-fallback",
      symbolAnchors: [],
      searchTerms: [input.title, input.filePath],
      category: "overview" as const,
      role: "featured" as const,
      directNodeIds: [input.nodeId],
      contextNodeIds: [],
    }),
    id: input.id,
    path: input.path,
    title: input.title,
    summary: `${input.title}（由本地源码索引生成）`,
    category: input.stage === "purpose" ? "overview" : "module",
    role: "featured",
    directNodeIds: [input.nodeId],
    contextNodeIds: [],
    route: { order: input.routeOrder, stage: input.stage },
    content: input.stage === "purpose"
      ? `# ${input.title}\n\n## 项目边界\n\n本页由本地源码扫描生成，描述当前绑定仓库中的真实文件与可追踪入口。\n\n## 入口证据\n\n${input.filePath} 是当前索引发现的入口文件；后续页面和搜索结果均绑定同一源码快照。\n\n## 维护提示\n\n源码变化后重新运行 refresh_index mode=full，以重新生成图谱和知识索引。`
      : `# ${input.title}\n\n## 文件职责\n\n${input.filePath} 已纳入本次源码图谱。\n\n## 源码证据\n\n\`${input.filePath}\` 的实际内容已被安全读取并绑定到当前快照。`,
    sourceEvidence: [{
      filePath: input.filePath,
      lineRange: input.lineRange,
      nodeId: input.nodeId,
      excerpt: input.excerpt,
      claim: `${input.filePath} 是当前仓库中的真实源码节点。`,
    }],
    quality: "generated",
    generationStatus: "complete",
    qualityIssues: [],
  };
}

function ensureRouteDocuments(
  documents: GeneratedDocument[],
  graph: KnowledgeGraph,
  sourceFiles: readonly SourceFile[],
): GeneratedDocument[] {
  const firstFile = graph.nodes.find((node) => node.type === "file" && node.filePath !== undefined);
  if (firstFile?.filePath === undefined) {
    throw new RepositoryIndexError("repository contains no analyzable source files");
  }
  const source = sourceFiles.find((file) => file.relativePath === firstFile.filePath);
  if (source === undefined) throw new RepositoryIndexError(`indexed source disappeared: ${firstFile.filePath}`);
  const anchor = graph.nodes.find((node) => node.filePath === firstFile.filePath && node.type !== "file") ?? firstFile;
  const byPath = new Map(documents.map((document) => [document.path, document]));
  const usedRouteOrders = new Set(
    documents.flatMap((document) => document.route === undefined ? [] : [document.route.order]),
  );
  const allocateRouteOrder = (preferred: number): number => {
    let order = preferred;
    while (usedRouteOrders.has(order)) order += 1;
    usedRouteOrders.add(order);
    return order;
  };
  const overview = byPath.get("项目总览.md");
  const entry = byPath.get("源码入口.md");
  const usableRouteDocument = (document: GeneratedDocument | undefined): boolean =>
    document !== undefined
    && document.generationStatus === "complete"
    && document.quality !== "failed"
    && document.route !== undefined
    && document.directNodeIds.length > 0
    && document.sourceEvidence.length > 0;
  if (!usableRouteDocument(overview)) {
    byPath.set("项目总览.md", fallbackDocument(overview, {
      id: overview?.id ?? "page:%E9%A1%B9%E7%9B%AE%E6%80%BB%E8%A7%88.md",
      path: "项目总览.md",
      title: "项目总览",
      stage: "purpose",
      routeOrder: allocateRouteOrder(0),
      nodeId: anchor.id,
      filePath: firstFile.filePath,
      excerpt: sourceExcerpt(source.content),
      lineRange: lineRange(source.content),
    }));
  }
  if (!usableRouteDocument(entry)) {
    byPath.set("源码入口.md", fallbackDocument(entry, {
      id: entry?.id ?? "page:%E6%BA%90%E7%A0%81%E5%85%A5%E5%8F%A3.md",
      path: "源码入口.md",
      title: "源码入口",
      stage: "evidence",
      routeOrder: allocateRouteOrder(1),
      nodeId: firstFile.id,
      filePath: firstFile.filePath,
      excerpt: sourceExcerpt(source.content),
      lineRange: lineRange(source.content),
    }));
  }
  return [...byPath.values()];
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await atomicWriteBytes(
    filePath,
    Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"),
  );
}

async function atomicWriteBytes(filePath: string, value: Buffer): Promise<void> {
  const parent = path.dirname(filePath);
  const before = await fs.lstat(parent);
  if (!before.isDirectory() || before.isSymbolicLink()) {
    throw new RepositoryIndexError("repository index parent is not a directory");
  }
  const temporary = path.join(
    parent,
    `.${path.basename(filePath)}.tmp-${randomBytes(16).toString("hex")}`,
  );
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    handle = await fs.open(
      temporary,
      fsConstants.O_WRONLY |
        fsConstants.O_CREAT |
        fsConstants.O_EXCL |
        O_NOFOLLOW,
      0o600,
    );
    await handle.writeFile(value);
    await handle.sync();
    await handle.close();
    handle = undefined;
    const after = await fs.lstat(parent);
    if (
      !after.isDirectory() ||
      after.isSymbolicLink() ||
      before.dev !== after.dev ||
      before.ino !== after.ino
    ) {
      throw new RepositoryIndexError(
        "repository index parent changed during atomic write",
      );
    }
    await fs.rename(temporary, filePath);
    const directory = await fs.open(parent, fsConstants.O_RDONLY);
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await fs.unlink(temporary).catch(() => undefined);
    throw error;
  }
}

async function ensureDirectoryChain(root: string, directory: string): Promise<void> {
  const relative = path.relative(root, directory);
  if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new RepositoryIndexError(`generated artifact path escapes managed root: ${directory}`);
  }
  let current = root;
  for (const segment of relative === "" ? [] : relative.split(path.sep)) {
    current = path.join(current, segment);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new RepositoryIndexError(`managed artifact parent is not a directory: ${current}`);
      }
    } catch (error) {
      if (error instanceof RepositoryIndexError) throw error;
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await fs.mkdir(current, { mode: 0o700 });
    }
  }
}

async function atomicWriteText(filePath: string, value: string): Promise<void> {
  await atomicWriteBytes(
    filePath,
    Buffer.from(value.endsWith("\n") ? value : `${value}\n`, "utf8"),
  );
}

export async function buildRepositoryIndex(
  input: BuildRepositoryIndexInput,
): Promise<BuildRepositoryIndexResult> {
  const lineage = input.knowledgeLineage === undefined ? undefined : knowledgeLineageV1(input.knowledgeLineage);
  if (lineage !== undefined && lineage.sourceSnapshotId !== input.snapshot.snapshotId) {
    throw new RepositoryIndexError("knowledge lineage does not match the index Snapshot");
  }
  const { canonicalRoot, snapshot } = input;
  const sourceFiles = await collectSourceFiles(canonicalRoot);
  const inventoryDigest = sourceInventoryDigest(sourceFiles);
  if (
    input.expectedSourceInventoryDigest !== undefined &&
    inventoryDigest !== input.expectedSourceInventoryDigest
  ) {
    throw new RepositoryIndexError(
      "repository source inventory changed after index preflight",
    );
  }
  // This parser profile is fixed in the installed CLI's authenticated bytes.
  // Initialization failure aborts indexing; no ambient toggle or regex fallback
  // may silently generate a different candidate for the same Snapshot.
  const registry = await repositoryParserRegistryV1();
  const projectName = path.basename(canonicalRoot) || "repository";
  const generatedAt = snapshot.createdAt;
  const headCommit = snapshotHeadCommit(snapshot);
  const builder = new GraphBuilder(projectName, headCommit ?? "unknown");
  const analyses = new Map<string, ReturnType<PluginRegistry["analyzeFile"]>>();
  for (const source of sourceFiles) {
    const analysis = registry.analyzeFile(source.relativePath, source.content);
    analyses.set(source.relativePath, analysis);
    const summary = `${source.relativePath} 的源码节点（${source.content.split(/\r?\n/u).length} 行）`;
    if (analysis !== null) {
      const summaries = Object.fromEntries([
        ...analysis.functions.map((fn) => [fn.name, `${fn.name} 的本地实现`]),
        ...analysis.classes.map((cls) => [cls.name, `${cls.name} 的本地类型`]),
      ]);
      builder.addFileWithAnalysis(source.relativePath, analysis, {
        summary,
        tags: [path.extname(source.relativePath).slice(1) || "source"],
        complexity: "simple",
        summaries,
        fileSummary: summary,
      });
    } else {
      builder.addFile(source.relativePath, {
        summary,
        tags: [path.extname(source.relativePath).slice(1) || "source"],
        complexity: "simple",
      });
    }
  }
  const resolveImport = createRepositoryImportResolverV1(sourceFiles);
  const callFiles: CallResolverFile[] = [];
  for (const source of sourceFiles) {
    const analysis = analyses.get(source.relativePath);
    if (!analysis) continue;
    const imports = analysis.imports.map((imported) => {
      const resolvedPaths = resolveImport(source.relativePath, imported.source);
      for (const target of resolvedPaths) builder.addImportEdge(source.relativePath, target);
      return { ...imported, resolvedPaths };
    });
    callFiles.push({
      path: source.relativePath,
      imports,
      functions: analysis.functions.map((fn) => ({
        name: fn.name, startLine: fn.lineRange[0], endLine: fn.lineRange[1],
      })),
      callableExports: analysis.callableExports,
      exportNames: analysis.exports
        .filter((item) => item.isTypeOnly !== true)
        .map((item) => item.isDefault ? "default" : item.name),
      reExports: analysis.reExports?.map((item) => ({
        ...item, resolvedPaths: resolveImport(source.relativePath, item.source),
      })),
      ...(source.relativePath.endsWith(".go") && analysis.packageName ? {
        packageName: analysis.packageName,
        packageScope: `${path.posix.dirname(source.relativePath)}\0${analysis.packageName}`,
        callableFunctions: analysis.callableFunctions,
      } : {}),
      callGraph: registry.extractCallGraph(source.relativePath, source.content) ?? [],
    });
  }
  for (const call of resolveCalls(callFiles).calls) {
    builder.addCallEdge(call.callerFile, call.callerFunc, call.calleeFile, call.calleeFunc, {
      filePath: call.callerFile, lineNumber: call.lineNumber,
      confidence: call.confidence, source: "static-analysis",
    });
  }
  const graph = builder.build();
  graph.project.analyzedAt = generatedAt;
  const graphDigest = digest(JSON.stringify(graph));
  const sourceMap = Object.fromEntries(sourceFiles.map((source) => [source.relativePath, source.content]));
  const knowledge = generateKnowledgeBase(graph, {
    projectRoot: canonicalRoot,
    sourceFiles: sourceMap,
    currentGitCommitHash: headCommit,
    outputLanguage: "zh-CN",
    generationMode: "writer",
    deterministicOnly: false,
  });
  const documents = ensureRouteDocuments(knowledge.documents, graph, sourceFiles);
  const graphNodes = graph.nodes.map((node) => ({ id: node.id, type: node.type, name: node.name, ...(node.filePath === undefined ? {} : { filePath: node.filePath }) }));
  const artifacts = buildKnowledgeArtifacts({
    projectName,
    generatedAt,
    outputLanguage: "zh-CN",
    generationMode: "writer",
    graphDigest,
    gitCommitHash: headCommit,
    sourceRootIdentity: snapshot.rootIdentity,
    sourceRead: {
      covered: sourceFiles.length,
      total: sourceFiles.length,
      missingIds: [],
    },
    requiredRouteStages: ["purpose", "evidence"],
    businessTerms: [],
    nodes: graphNodes,
    referenceFileNodeIds: graph.nodes
      .filter((node) => ["file", "config", "schema", "document"].includes(node.type) && node.filePath !== undefined)
      .map((node) => node.id),
    documents,
    warnings: [],
    errors: [],
  });
  if (artifacts.wikiIndex.mainReadiness.status !== "ready") {
    throw new RepositoryIndexError(`knowledge index is not ready: ${artifacts.wikiIndex.mainReadiness.reasons.join("; ")}`);
  }
  const fingerprintFiles: FingerprintStore["files"] = {};
  for (const source of sourceFiles) {
    const analysis = analyses.get(source.relativePath);
    fingerprintFiles[source.relativePath] = analysis === null || analysis === undefined
      ? {
          filePath: source.relativePath,
          contentHash: contentHash(source.content),
          functions: [],
          classes: [],
          imports: [],
          exports: [],
          totalLines: source.content.split("\n").length,
          hasStructuralAnalysis: false,
        }
      : extractFileFingerprint(source.relativePath, source.content, analysis);
  }
  const fingerprints: FingerprintStore = {
    version: "1.0.0",
    gitCommitHash: headCommit ?? "unknown",
    generatedAt,
    files: fingerprintFiles,
  };
  const installationStat = await fs.lstat(input.canonicalInstallationRoot);
  if (!installationStat.isDirectory() || installationStat.isSymbolicLink() ||
    (installationStat.mode & 0o777) !== 0o700 ||
    await fs.realpath(input.canonicalInstallationRoot) !== input.canonicalInstallationRoot) {
    throw new RepositoryIndexError(
      "repository index installation root must be a canonical directory",
    );
  }
  const stagingRoot = stagedIndexRoot(input);
  const stagingParent = path.dirname(stagingRoot);
  await ensureDirectoryChain(input.canonicalInstallationRoot, stagingParent);
  await garbageCollectStagingOperationsV1(
    stagingParent,
    input.operationId,
  );
  try {
    const existing = await fs.lstat(stagingRoot);
    if (
      !existing.isDirectory() ||
      existing.isSymbolicLink() ||
      (existing.mode & 0o777) !== 0o700
    ) {
      throw new RepositoryIndexError(
        "repository index staging root is not an owned directory",
      );
    }
    await fs.rm(stagingRoot, { recursive: true });
  } catch (error) {
    if (
      error instanceof RepositoryIndexError ||
      !(error instanceof Error) ||
      !("code" in error) ||
      (error as NodeJS.ErrnoException).code !== "ENOENT"
    ) {
      throw error;
    }
  }
  await ensureDirectoryChain(stagingParent, stagingRoot);
  const managedRoot = stagingRoot;
  const knowledgeBaseRoot = path.join(managedRoot, "knowledge-base");
  const traceRoot = path.join(knowledgeBaseRoot, ".trace");
  await ensureDirectoryChain(managedRoot, knowledgeBaseRoot);
  await ensureDirectoryChain(knowledgeBaseRoot, traceRoot);
  await atomicWriteJson(path.join(managedRoot, "knowledge-graph.json"), graph);
  await atomicWriteJson(path.join(managedRoot, "meta.json"), {
    lastAnalyzedAt: generatedAt,
    gitCommitHash: headCommit ?? "unknown",
    version: graph.version,
    analyzedFiles: sourceFiles.length,
  });
  await atomicWriteJson(path.join(managedRoot, "fingerprints.json"), fingerprints);
  for (const document of documents) {
    const relativeDocument = document.path.replaceAll("\\", "/");
    if (relativeDocument.startsWith("/") || relativeDocument.split("/").some((segment) => segment === ".." || segment === "")) {
      throw new RepositoryIndexError(`generated document path is unsafe: ${relativeDocument}`);
    }
    const documentPath = path.join(knowledgeBaseRoot, relativeDocument);
    await ensureDirectoryChain(knowledgeBaseRoot, path.dirname(documentPath));
    await atomicWriteText(documentPath, document.content);
  }
  await atomicWriteJson(path.join(knowledgeBaseRoot, "wiki-index.json"), artifacts.wikiIndex);
  await atomicWriteJson(path.join(knowledgeBaseRoot, "search-index.json"), artifacts.searchIndex);
  await atomicWriteJson(path.join(traceRoot, "document-traces.json"), artifacts.documentTraces);
  await atomicWriteJson(path.join(traceRoot, "generation-report.json"), artifacts.generationReport);
  if (lineage !== undefined) await atomicWriteJson(path.join(managedRoot, KNOWLEDGE_LINEAGE_PATH), lineage);
  const stagedFiles = await collectStagedIndexFiles(stagingRoot);
  const generationSeed = {
    schemaVersion: 1,
    sourceInventoryDigest: inventoryDigest,
    files: stagedFiles.map(({ relativePath, contentDigest }) => ({
      path: relativePath,
      contentDigest,
    })),
  };
  const generationId = `generation-${digest(JSON.stringify(generationSeed)).slice(7)}`;
  const generationManifest = {
    ...generationSeed,
    generationId,
  };
  const generationManifestBytes = Buffer.from(
    `${JSON.stringify(generationManifest, null, 2)}\n`,
    "utf8",
  );
  await atomicWriteBytes(
    path.join(stagingRoot, INDEX_STAGE_MANIFEST),
    generationManifestBytes,
  );
  const installationAfter = await fs.lstat(input.canonicalInstallationRoot);
  if (!installationAfter.isDirectory() || installationAfter.isSymbolicLink() ||
    installationAfter.dev !== installationStat.dev ||
    installationAfter.ino !== installationStat.ino) {
    throw new RepositoryIndexError("repository index Host installation changed during staging");
  }
  return {
    graph,
    graphDigest,
    analyzedFiles: sourceFiles.length,
    generatedAt,
    generation: {
      generationId,
      generationManifestDigest: digestBytes(generationManifestBytes),
      sourceInventoryDigest: inventoryDigest,
    },
    publication: Object.freeze({
      manifestBytes: Buffer.from(generationManifestBytes),
      files: Object.freeze(stagedFiles.map((file) => Object.freeze({
        ...file,
        bytes: Buffer.from(file.bytes),
      }))),
    }),
  };
}

function parseActiveGenerationV1(
  value: unknown,
): Readonly<{ schemaVersion: 1 }> & RepositoryIndexGenerationBindingV1 & RepositoryIndexAuthorityV1 {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join("\u0000") !== [
      "generationId",
      "generationManifestDigest",
      "schemaVersion",
      "sourceInventoryDigest",
      "sourceSnapshotId",
      "finalizedProviderRevision",
    ].sort().join("\u0000")
  ) {
    throw new RepositoryIndexError("active repository index manifest is invalid");
  }
  const record = value as Record<string, unknown>;
  if (
    record["schemaVersion"] !== 1 ||
    typeof record["generationId"] !== "string" ||
    !INDEX_GENERATION_ID.test(record["generationId"]) ||
    typeof record["generationManifestDigest"] !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(record["generationManifestDigest"]) ||
    typeof record["sourceInventoryDigest"] !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(record["sourceInventoryDigest"])
    || typeof record["sourceSnapshotId"] !== "string"
    || record["sourceSnapshotId"].length === 0
    || typeof record["finalizedProviderRevision"] !== "number"
    || !Number.isSafeInteger(record["finalizedProviderRevision"])
    || record["finalizedProviderRevision"] < 1
  ) {
    throw new RepositoryIndexError("active repository index manifest is invalid");
  }
  return {
    schemaVersion: 1,
    generationId: record["generationId"],
    generationManifestDigest:
      record["generationManifestDigest"] as `sha256:${string}`,
    sourceInventoryDigest:
      record["sourceInventoryDigest"] as `sha256:${string}`,
    sourceSnapshotId: record["sourceSnapshotId"],
    finalizedProviderRevision: record["finalizedProviderRevision"],
  };
}

function parseRefreshPublicationHeadV1(value: unknown): { providerRevision: number; sourceSnapshotId: string } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new RepositoryIndexError("refresh publication head is invalid");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join("\u0000") !== "providerRevision\u0000schemaVersion\u0000sourceSnapshotId" ||
    record.schemaVersion !== 1 || typeof record.providerRevision !== "number" ||
    !Number.isSafeInteger(record.providerRevision) || record.providerRevision < 1 ||
    typeof record.sourceSnapshotId !== "string" || record.sourceSnapshotId.length === 0) {
    throw new RepositoryIndexError("refresh publication head is invalid");
  }
  return { providerRevision: record.providerRevision, sourceSnapshotId: record.sourceSnapshotId };
}

async function collectAndCleanGenerationsV1(
  generationsRoot: string,
  retained: ReadonlySet<string>,
): Promise<void> {
  if (retained.size > MAX_RETAINED_GENERATIONS) {
    throw new RepositoryIndexError("repository index generation retention is invalid");
  }
  let liveGenerations = 0;
  const removable: Array<{ path: string; mtimeMs: number }> = [];
  const entries = await fs.readdir(generationsRoot, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(generationsRoot, entry.name);
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      throw new RepositoryIndexError(
        `repository index generation entry is invalid: ${entry.name}`,
      );
    }
    const entryStat = await fs.lstat(entryPath);
    if ((entryStat.mode & 0o777) !== 0o700) {
      throw new RepositoryIndexError(
        `repository index generation permissions are invalid: ${entry.name}`,
      );
    }
    if (/^\.tmp-generation-[0-9a-f]{64}-[0-9a-f]{32}$/u.test(entry.name)) {
      if (Date.now() - entryStat.mtimeMs >= GENERATION_GC_AGE_MS) {
        await fs.rm(entryPath, { recursive: true });
      } else {
        liveGenerations += 1;
      }
      continue;
    }
    if (!INDEX_GENERATION_ID.test(entry.name)) {
      throw new RepositoryIndexError(
        `repository index generation entry is invalid: ${entry.name}`,
      );
    }
    if (
      !retained.has(entry.name) &&
      Date.now() - entryStat.mtimeMs >= GENERATION_GC_AGE_MS
    ) {
      await fs.rm(entryPath, { recursive: true });
    } else {
      liveGenerations += 1;
      if (!retained.has(entry.name)) removable.push({ path: entryPath, mtimeMs: entryStat.mtimeMs });
    }
  }
  removable.sort((left, right) => left.mtimeMs - right.mtimeMs);
  while (liveGenerations > MAX_RETAINED_GENERATIONS && removable.length > 0) {
    const candidate = removable.shift()!;
    await fs.rm(candidate.path, { recursive: true });
    liveGenerations -= 1;
  }
  if (liveGenerations > MAX_RETAINED_GENERATIONS) {
    throw new RepositoryIndexError(
      "repository index generation retention exceeded its bound",
    );
  }
}

async function garbageCollectStagingOperationsV1(
  stagingParent: string,
  currentOperationId: string,
): Promise<void> {
  const parentBefore = await fs.lstat(stagingParent);
  if (
    !parentBefore.isDirectory() ||
    parentBefore.isSymbolicLink() ||
    (parentBefore.mode & 0o777) !== 0o700
  ) {
    throw new RepositoryIndexError("repository index staging parent is invalid");
  }
  let retained = 0;
  const removable: Array<{ path: string; mtimeMs: number }> = [];
  const entries = await fs.readdir(stagingParent, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.isSymbolicLink() ||
      !entry.isDirectory() ||
      !INDEX_OPERATION_ID.test(entry.name)
    ) {
      throw new RepositoryIndexError(
        `repository index staging entry is invalid: ${entry.name}`,
      );
    }
    if (entry.name === currentOperationId) continue;
    const entryPath = path.join(stagingParent, entry.name);
    const stat = await fs.lstat(entryPath);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (stat.mode & 0o777) !== 0o700
    ) {
      throw new RepositoryIndexError(
        `repository index staging entry is invalid: ${entry.name}`,
      );
    }
    if (Date.now() - stat.mtimeMs >= STAGING_GC_AGE_MS) {
      await fs.rm(entryPath, { recursive: true });
    } else {
      retained += 1;
      removable.push({ path: entryPath, mtimeMs: stat.mtimeMs });
    }
  }
  removable.sort((left, right) => left.mtimeMs - right.mtimeMs);
  while (retained > MAX_RETAINED_STAGING_OPERATIONS && removable.length > 0) {
    await fs.rm(removable.shift()!.path, { recursive: true });
    retained -= 1;
  }
  if (retained > MAX_RETAINED_STAGING_OPERATIONS) {
    throw new RepositoryIndexError(
      "repository index staging retention exceeded its bound",
    );
  }
  const parentAfter = await fs.lstat(stagingParent);
  if (
    !parentAfter.isDirectory() ||
    parentAfter.isSymbolicLink() ||
    parentBefore.dev !== parentAfter.dev ||
    parentBefore.ino !== parentAfter.ino
  ) {
    throw new RepositoryIndexError(
      "repository index staging parent changed during garbage collection",
    );
  }
}

export interface ActiveRepositoryIndexReaderV1 {
  readonly generation: RepositoryIndexGenerationBindingV1;
  readonly authority: RepositoryIndexAuthorityV1;
  readonly knowledgeLineage?: RepositoryIndexKnowledgeLineageV1;
  read(relativePath: string): Promise<Buffer>;
}

export async function openActiveRepositoryIndexV1(
  canonicalRoot: string,
): Promise<ActiveRepositoryIndexReaderV1> {
  const managedRoot = path.join(canonicalRoot, ".understand-code");
  const active = parseActiveGenerationV1(JSON.parse(
    (await readStableNoFollowFile(
      path.join(managedRoot, INDEX_ACTIVE_MANIFEST),
    )).toString("utf8"),
  ));
  const generationRoot = path.join(
    managedRoot,
    INDEX_GENERATIONS_DIRECTORY,
    active.generationId,
  );
  const rootIdentity = await fs.lstat(generationRoot);
  if (
    !rootIdentity.isDirectory() ||
    rootIdentity.isSymbolicLink() ||
    (rootIdentity.mode & 0o777) !== 0o700
  ) {
    throw new RepositoryIndexError("active repository index generation is invalid");
  }
  const manifestBytes = await readStableNoFollowFile(
    path.join(generationRoot, INDEX_GENERATION_MANIFEST),
  );
  if (digestBytes(manifestBytes) !== active.generationManifestDigest) {
    throw new RepositoryIndexError(
      "active repository index generation manifest is not exact",
    );
  }
  const manifest = parseGenerationManifestV1(JSON.parse(
    manifestBytes.toString("utf8"),
  ));
  if (
    manifest.generationId !== active.generationId ||
    manifest.sourceInventoryDigest !== active.sourceInventoryDigest
  ) {
    throw new RepositoryIndexError(
      "active repository index generation binding is invalid",
    );
  }
  const files = await collectStagedIndexFiles(
    generationRoot,
    INDEX_GENERATION_MANIFEST,
  );
  if (JSON.stringify(files.map(({ relativePath, contentDigest }) => ({
    path: relativePath,
    contentDigest,
  }))) !== JSON.stringify(manifest.files)) {
    throw new RepositoryIndexError(
      "active repository index generation content is not exact",
    );
  }
  const byPath = new Map(manifest.files.map((file) => [file.path, file]));
  const lineageFile = files.find((file) => file.relativePath === KNOWLEDGE_LINEAGE_PATH);
  const knowledgeLineage = lineageFile === undefined ? undefined : readKnowledgeLineageBytesV1(lineageFile.bytes);
  return Object.freeze({
    generation: Object.freeze({
      generationId: active.generationId,
      generationManifestDigest: active.generationManifestDigest,
      sourceInventoryDigest: active.sourceInventoryDigest,
    }),
    authority: Object.freeze({
      sourceSnapshotId: active.sourceSnapshotId,
      finalizedProviderRevision: active.finalizedProviderRevision,
    }),
    ...(knowledgeLineage === undefined ? {} : { knowledgeLineage }),
    async read(relativePath: string) {
      if (!safeIndexArtifactPath(relativePath)) {
        throw new RepositoryIndexError("repository index read path is invalid");
      }
      const expected = byPath.get(relativePath);
      if (expected === undefined) {
        throw new RepositoryIndexError("repository index artifact is unavailable");
      }
      const currentRoot = await fs.lstat(generationRoot);
      if (
        !currentRoot.isDirectory() ||
        currentRoot.isSymbolicLink() ||
        currentRoot.dev !== rootIdentity.dev ||
        currentRoot.ino !== rootIdentity.ino
      ) {
        throw new RepositoryIndexError(
          "active repository index generation changed during read",
        );
      }
      const bytes = await readStableNoFollowFile(
        path.join(generationRoot, relativePath),
      );
      if (digestBytes(bytes) !== expected.contentDigest) {
        throw new RepositoryIndexError(
          "active repository index artifact digest is invalid",
        );
      }
      return bytes;
    },
  });
}

export async function publishStagedRepositoryIndex(
  input: StagedRepositoryIndexInput & Readonly<{
    generation: RepositoryIndexGenerationBindingV1;
    authority: RepositoryIndexAuthorityV1;
    publication: RepositoryIndexPublicationBundleV1;
    publishStoreCut: () => Promise<void>;
  }>,
): Promise<void> {
  const manifestBytes = Buffer.from(input.publication.manifestBytes);
  if (digestBytes(manifestBytes) !== input.generation.generationManifestDigest) {
    throw new RepositoryIndexError(
      "staged repository index manifest digest is not authoritative",
    );
  }
  let manifestValue: unknown;
  try {
    manifestValue = JSON.parse(manifestBytes.toString("utf8")) as unknown;
  } catch (error) {
    throw new RepositoryIndexError(
      "staged repository index manifest is invalid",
      { cause: error },
    );
  }
  const manifest = parseGenerationManifestV1(manifestValue);
  if (
    manifest.generationId !== input.generation.generationId ||
    manifest.sourceInventoryDigest !== input.generation.sourceInventoryDigest
  ) {
    throw new RepositoryIndexError(
      "staged repository index generation is not authoritative",
    );
  }
  const files = input.publication.files.map((file) => ({
    ...file,
    bytes: Buffer.from(file.bytes),
  }));
  const actualFiles = files.map(({ relativePath, contentDigest }) => ({
    path: relativePath,
    contentDigest,
  }));
  if (JSON.stringify(manifest.files) !== JSON.stringify(actualFiles)) {
    throw new RepositoryIndexError("staged repository index content is not exact");
  }

  const canonicalStat = await fs.lstat(input.canonicalRoot);
  if (!canonicalStat.isDirectory() || canonicalStat.isSymbolicLink()) {
    throw new RepositoryIndexError(
      "repository index canonical root must be a canonical directory",
    );
  }
  const managedRoot = path.join(input.canonicalRoot, ".understand-code");
  try {
    const managedStat = await fs.lstat(managedRoot);
    if (!managedStat.isDirectory() || managedStat.isSymbolicLink()) {
      throw new RepositoryIndexError(
        "managed artifact directory must be a canonical directory",
      );
    }
  } catch (error) {
    if (
      error instanceof RepositoryIndexError ||
      !(error instanceof Error) ||
      !("code" in error) ||
      (error as NodeJS.ErrnoException).code !== "ENOENT"
    ) {
      throw error;
    }
  }
  await ensureDirectoryChain(input.canonicalRoot, managedRoot);
  const lockPath = path.join(managedRoot, INDEX_PUBLISH_LOCK);
  const lockToken = `${process.pid}:${randomBytes(16).toString("hex")}\n`;
  let lock: fs.FileHandle | undefined;
  let lockIdentity: Awaited<ReturnType<fs.FileHandle["stat"]>> | undefined;
  try {
    try {
      lock = await fs.open(
        lockPath,
        fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | O_NOFOLLOW,
        0o600,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      throw new RepositoryIndexError("repository index publication is locked");
    }
    await lock.writeFile(lockToken, "utf8");
    await lock.sync();
    lockIdentity = await lock.stat();
  const generationsRoot = path.join(managedRoot, INDEX_GENERATIONS_DIRECTORY);
  await ensureDirectoryChain(managedRoot, generationsRoot);
  const generationRoot = path.join(
    generationsRoot,
    input.generation.generationId,
  );
  let generationExists = false;
  try {
    const stat = await fs.lstat(generationRoot);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (stat.mode & 0o777) !== 0o700
    ) {
      throw new RepositoryIndexError(
        "repository index generation root is invalid",
      );
    }
    generationExists = true;
  } catch (error) {
    if (
      error instanceof RepositoryIndexError ||
      !(error instanceof Error) ||
      !("code" in error) ||
      (error as NodeJS.ErrnoException).code !== "ENOENT"
    ) {
      throw error;
    }
  }
  if (!generationExists) {
    const temporaryRoot = path.join(
      generationsRoot,
      `.tmp-${input.generation.generationId}-${randomBytes(16).toString("hex")}`,
    );
    await ensureDirectoryChain(generationsRoot, temporaryRoot);
    try {
      for (const file of files) {
        const target = path.join(temporaryRoot, file.relativePath);
        await ensureDirectoryChain(temporaryRoot, path.dirname(target));
        await atomicWriteBytes(target, file.bytes);
      }
      await atomicWriteBytes(
        path.join(temporaryRoot, INDEX_GENERATION_MANIFEST),
        manifestBytes,
      );
      await fs.rename(temporaryRoot, generationRoot);
      const generationsDirectory = await fs.open(
        generationsRoot,
        fsConstants.O_RDONLY,
      );
      try {
        await generationsDirectory.sync();
      } finally {
        await generationsDirectory.close();
      }
    } catch (error) {
      await fs.rm(temporaryRoot, { recursive: true, force: true })
        .catch(() => undefined);
      if (
        error !== null &&
        typeof error === "object" &&
        ((error as NodeJS.ErrnoException).code === "EEXIST" ||
          (error as NodeJS.ErrnoException).code === "ENOTEMPTY")
      ) {
        // A concurrent publisher won the immutable generation rename. The
        // exact manifest/content verification below decides whether it is the
        // same generation.
      } else {
        throw error;
      }
    }
  }

  const publishedManifestBytes = await readStableNoFollowFile(
    path.join(generationRoot, INDEX_GENERATION_MANIFEST),
  );
  const publishedFiles = await collectStagedIndexFiles(
    generationRoot,
    INDEX_GENERATION_MANIFEST,
  );
  if (
    digestBytes(publishedManifestBytes) !==
      input.generation.generationManifestDigest ||
    JSON.stringify(publishedFiles.map(({ relativePath, contentDigest }) => ({
      path: relativePath,
      contentDigest,
    }))) !== JSON.stringify(manifest.files)
  ) {
    throw new RepositoryIndexError(
      "immutable repository index generation is not exact",
    );
  }

  let previousGenerationId: string | undefined;
  let previousActive: ReturnType<typeof parseActiveGenerationV1> | undefined;
  let publicationHead: ReturnType<typeof parseRefreshPublicationHeadV1> | undefined;
  try {
    publicationHead = parseRefreshPublicationHeadV1(JSON.parse(
      (await readStableNoFollowFile(path.join(managedRoot, REFRESH_PUBLICATION_HEAD))).toString("utf8"),
    ));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  try {
    const active = parseActiveGenerationV1(JSON.parse(
      (await readStableNoFollowFile(
        path.join(managedRoot, INDEX_ACTIVE_MANIFEST),
      )).toString("utf8"),
    ));
    previousGenerationId = active.generationId;
    previousActive = active;
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      (error as NodeJS.ErrnoException).code !== "ENOENT"
    ) {
      throw error;
    }
  }
  await collectAndCleanGenerationsV1(
    generationsRoot,
    new Set([
      input.generation.generationId,
      ...(previousGenerationId === undefined ? [] : [previousGenerationId]),
    ]),
  );
  const activeManifest = {
    schemaVersion: 1,
    ...input.generation,
    ...input.authority,
  };
  if (publicationHead !== undefined &&
    (publicationHead.providerRevision > input.authority.finalizedProviderRevision ||
      (publicationHead.providerRevision === input.authority.finalizedProviderRevision &&
        publicationHead.sourceSnapshotId !== input.authority.sourceSnapshotId))) {
    throw new RepositoryIndexError("refresh publication revision cannot move backward or fork");
  }
  if (previousActive !== undefined) {
    if (previousActive.finalizedProviderRevision > input.authority.finalizedProviderRevision) {
      throw new RepositoryIndexError("active repository index Provider revision cannot move backward");
    }
    if (previousActive.finalizedProviderRevision === input.authority.finalizedProviderRevision) {
      if (JSON.stringify(previousActive) !== JSON.stringify(activeManifest)) {
        throw new RepositoryIndexError("same Provider revision cannot select a different index generation");
      }
      await input.publishStoreCut();
      return;
    }
  }
  await input.publishStoreCut();
  await atomicWriteJson(path.join(managedRoot, REFRESH_PUBLICATION_HEAD), {
    schemaVersion: 1,
    providerRevision: input.authority.finalizedProviderRevision,
    sourceSnapshotId: input.authority.sourceSnapshotId,
  });
  await atomicWriteJson(
    path.join(managedRoot, INDEX_ACTIVE_MANIFEST),
    activeManifest,
  );
  const verifiedActive = parseActiveGenerationV1(JSON.parse(
    (await readStableNoFollowFile(
      path.join(managedRoot, INDEX_ACTIVE_MANIFEST),
    )).toString("utf8"),
  ));
  if (JSON.stringify(verifiedActive) !== JSON.stringify(activeManifest)) {
    throw new RepositoryIndexError(
      "active repository index generation did not publish exactly",
    );
  }
  } finally {
    await lock?.close().catch(() => undefined);
    if (lock !== undefined) {
      try {
        if ((await readStableNoFollowFile(lockPath)).toString("utf8") === lockToken) {
          const current = await fs.lstat(lockPath);
          if (lockIdentity !== undefined && current.dev === lockIdentity.dev && current.ino === lockIdentity.ino) {
            await fs.unlink(lockPath);
          }
        }
      } catch {
        // Never unlink an unverified replacement lock.
      }
    }
  }
}

export async function discardStagedRepositoryIndex(
  input: StagedRepositoryIndexInput,
): Promise<void> {
  const stagingRoot = stagedIndexRoot(input);
  try {
    const stat = await fs.lstat(stagingRoot);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new RepositoryIndexError(
        "repository index staging root is not an owned directory",
      );
    }
    await fs.rm(stagingRoot, { recursive: true });
  } catch (error) {
    if (
      error instanceof RepositoryIndexError ||
      !(error instanceof Error) ||
      !("code" in error) ||
      (error as NodeJS.ErrnoException).code !== "ENOENT"
    ) {
      throw error;
    }
  }
}

async function pendingDirectoryV1(directory: string): Promise<Awaited<ReturnType<typeof fs.lstat>>> {
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o700 ||
    (process.geteuid !== undefined && stat.uid !== process.geteuid()) || await fs.realpath(directory) !== directory) {
    throw new RepositoryIndexError("pending repository index directory is invalid");
  }
  return stat;
}

async function pendingRootV1(canonicalRoot: string, create: boolean): Promise<string> {
  if (!path.isAbsolute(canonicalRoot) || path.resolve(canonicalRoot) !== canonicalRoot) {
    throw new RepositoryIndexError("pending repository index root is not canonical");
  }
  const before = await fs.lstat(canonicalRoot);
  if (!before.isDirectory() || before.isSymbolicLink() || await fs.realpath(canonicalRoot) !== canonicalRoot) {
    throw new RepositoryIndexError("pending repository index root is not canonical");
  }
  const managedRoot = path.join(canonicalRoot, ".understand-code");
  const directory = path.join(managedRoot, INDEX_PENDING_DIRECTORY);
  if (create) await ensureDirectoryChain(canonicalRoot, directory);
  await pendingDirectoryV1(managedRoot);
  await pendingDirectoryV1(directory);
  const after = await fs.lstat(canonicalRoot);
  if (before.dev !== after.dev || before.ino !== after.ino) {
    throw new RepositoryIndexError("pending repository index root changed");
  }
  return directory;
}

async function pendingFileBytesV1(filePath: string): Promise<Buffer> {
  await pendingDirectoryV1(path.dirname(filePath));
  const stat = await fs.lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 ||
    (process.geteuid !== undefined && stat.uid !== process.geteuid())) {
    throw new RepositoryIndexError("pending repository index file is invalid");
  }
  return readStableNoFollowFile(filePath);
}

async function pendingMetadataV1(directory: string, generationId: string): Promise<{
  generation: RepositoryIndexGenerationBindingV1;
  knowledgeLineage: PendingRepositoryIndexV1["knowledgeLineage"];
  manifestBytes: Buffer;
}> {
  await pendingDirectoryV1(directory);
  const manifestBytes = await pendingFileBytesV1(path.join(directory, INDEX_GENERATION_MANIFEST));
  const manifest = parseGenerationManifestV1(JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(manifestBytes)));
  const descriptor = manifest.files.find((file) => file.path === KNOWLEDGE_LINEAGE_PATH);
  if (manifest.generationId !== generationId || descriptor === undefined) {
    throw new RepositoryIndexError("pending repository index manifest is invalid");
  }
  await pendingDirectoryV1(path.join(directory, "knowledge-base"));
  const bytes = await pendingFileBytesV1(path.join(directory, KNOWLEDGE_LINEAGE_PATH));
  if (digestBytes(bytes) !== descriptor.contentDigest) {
    throw new RepositoryIndexError("pending knowledge lineage digest is not exact");
  }
  const knowledgeLineage = readKnowledgeLineageBytesV1(bytes);
  if (knowledgeLineage.status !== "pending") throw new RepositoryIndexError("knowledge candidate is not pending");
  return {
    generation: Object.freeze({ generationId, generationManifestDigest: digestBytes(manifestBytes), sourceInventoryDigest: manifest.sourceInventoryDigest }),
    knowledgeLineage,
    manifestBytes,
  };
}

/** Reads a candidate, not a Provider-authorized published generation. */
export async function readPendingRepositoryIndexV1(input: Readonly<{
  canonicalRoot: string;
  generationId: string;
}>): Promise<PendingRepositoryIndexV1> {
  const canonicalRoot = input.canonicalRoot;
  const generationId = input.generationId;
  if (!INDEX_GENERATION_ID.test(generationId)) throw new RepositoryIndexError("pending generation ID is invalid");
  const root = await pendingRootV1(canonicalRoot, false);
  const rootBefore = await pendingDirectoryV1(root);
  const directory = path.join(root, generationId);
  const before = await pendingDirectoryV1(directory);
  const metadata = await pendingMetadataV1(directory, generationId);
  const files = await collectStagedIndexFiles(directory, INDEX_GENERATION_MANIFEST);
  for (const file of files) {
    if (!(await pendingFileBytesV1(path.join(directory, file.relativePath))).equals(file.bytes)) {
      throw new RepositoryIndexError("pending repository index bytes changed");
    }
  }
  const verified = verifiedIndexPublicationV1({ generation: metadata.generation, publication: { manifestBytes: metadata.manifestBytes, files } });
  const after = await pendingDirectoryV1(directory);
  const rootAfter = await pendingDirectoryV1(await pendingRootV1(canonicalRoot, false));
  if (before.dev !== after.dev || before.ino !== after.ino || rootBefore.dev !== rootAfter.dev || rootBefore.ino !== rootAfter.ino ||
    !(await pendingFileBytesV1(path.join(directory, INDEX_GENERATION_MANIFEST))).equals(metadata.manifestBytes)) {
    throw new RepositoryIndexError("pending repository index changed during read");
  }
  return { ...verified, knowledgeLineage: metadata.knowledgeLineage };
}

/** Lists bounded, fully checked local candidates; this does not attest their source or publish them. */
export async function listPendingRepositoryIndexesV1(input: Readonly<{
  canonicalRoot: string;
  taskId: string;
}>): Promise<readonly Pick<PendingRepositoryIndexV1, "generation" | "knowledgeLineage">[]> {
  const { canonicalRoot } = input;
  const taskId = TaskIdSchema.parse(input.taskId);
  const repository = await fs.lstat(canonicalRoot);
  if (!path.isAbsolute(canonicalRoot) || path.resolve(canonicalRoot) !== canonicalRoot ||
    !repository.isDirectory() || repository.isSymbolicLink() || await fs.realpath(canonicalRoot) !== canonicalRoot) {
    throw new RepositoryIndexError("pending repository index root is not canonical");
  }
  let root: string;
  try { root = await pendingRootV1(canonicalRoot, false); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return Object.freeze([]);
    throw error;
  }
  const before = await pendingDirectoryV1(root);
  const entries = await fs.readdir(root, { withFileTypes: true });
  if (entries.length > MAX_PENDING_GENERATIONS) throw new RepositoryIndexError("pending repository index capacity exceeded");
  entries.sort((left, right) => left.name.localeCompare(right.name));
  const candidates: Pick<PendingRepositoryIndexV1, "generation" | "knowledgeLineage">[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink() ||
      (!INDEX_GENERATION_ID.test(entry.name) && !/^\.tmp-generation-[0-9a-f]{64}-[0-9a-f]{32}$/u.test(entry.name))) {
      throw new RepositoryIndexError("pending repository index entry is invalid");
    }
    await pendingDirectoryV1(path.join(root, entry.name));
    if (entry.name.startsWith(".tmp-")) continue;
    const candidate = await readPendingRepositoryIndexV1({ canonicalRoot, generationId: entry.name });
    if (candidate.knowledgeLineage.taskId === taskId) {
      candidates.push(Object.freeze({ generation: candidate.generation, knowledgeLineage: candidate.knowledgeLineage }));
    }
  }
  const after = await pendingDirectoryV1(await pendingRootV1(canonicalRoot, false));
  const namesAfter = (await fs.readdir(root)).sort((left, right) => left.localeCompare(right));
  if (before.dev !== after.dev || before.ino !== after.ino ||
    JSON.stringify(entries.map((entry) => entry.name)) !== JSON.stringify(namesAfter)) {
    throw new RepositoryIndexError("pending repository index changed during listing");
  }
  return Object.freeze(candidates);
}

async function acquirePendingLockV1(lockPath: string): Promise<fs.FileHandle> {
  const create = () => fs.open(lockPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | O_NOFOLLOW, 0o600);
  try {
    return await create();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  // Like ArtifactStore's private recovery claim, serialize breakers so one
  // cannot unlink another's newly acquired lock. A crashed breaker or an
  // incomplete owner token remains fail-closed; never guess its owner.
  const parent = path.dirname(lockPath);
  await pendingDirectoryV1(parent);
  const recoveryPath = `${lockPath}.stale-recovery`;
  const recovery = await fs.open(recoveryPath,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | O_NOFOLLOW, 0o600);
  const recoveryIdentity = await recovery.stat();
  try {
    await recovery.writeFile(`${process.pid}:${randomBytes(16).toString("hex")}\n`, "utf8");
    await recovery.sync();
    const before = await fs.lstat(lockPath);
    if (process.geteuid === undefined || O_NOFOLLOW === 0 || !before.isFile() || before.isSymbolicLink() ||
      before.uid !== process.geteuid() || before.nlink !== 1 || (before.mode & 0o777) !== 0o600 ||
      before.size < 35 || before.size > 44) {
      throw new RepositoryIndexError("pending lock owner cannot be established");
    }
    const token = (await pendingFileBytesV1(lockPath)).toString("utf8");
    const owner = /^([1-9][0-9]{0,9}):([0-9a-f]{32})\n$/u.exec(token);
    const pid = Number(owner?.[1]);
    if (owner?.[0] !== token || !Number.isSafeInteger(pid) || pid <= 0 || pid > 2_147_483_647) {
      throw new RepositoryIndexError("pending lock owner cannot be established");
    }
    let absent = false;
    try { process.kill(pid, 0); } catch (error) {
      absent = (error as NodeJS.ErrnoException).code === "ESRCH";
    }
    if (!absent) throw new RepositoryIndexError("pending lock holder is live or cannot be inspected");
    const currentToken = (await pendingFileBytesV1(lockPath)).toString("utf8");
    const current = await fs.lstat(lockPath);
    if (current.dev !== before.dev || current.ino !== before.ino || current.uid !== before.uid ||
      current.isSymbolicLink() || !current.isFile() || current.nlink !== 1 ||
      (current.mode & 0o777) !== 0o600 || currentToken !== token) {
      throw new RepositoryIndexError("pending lock changed during recovery");
    }
    await pendingDirectoryV1(parent);
    await fs.unlink(lockPath);
    return await create();
  } finally {
    await recovery.close();
    const current = await fs.lstat(recoveryPath).catch(() => undefined);
    if (current !== undefined && !current.isSymbolicLink() && current.dev === recoveryIdentity.dev && current.ino === recoveryIdentity.ino) {
      await fs.unlink(recoveryPath);
    }
  }
}

/** Durable draft storage only: never changes Store, Pulse, active index, or Provider authority. */
export async function savePendingRepositoryIndexV1(input: Readonly<{
  canonicalRoot: string;
  generation: RepositoryIndexGenerationBindingV1;
  publication: RepositoryIndexPublicationBundleV1;
}>): Promise<PendingRepositoryIndexV1> {
  const canonicalRoot = input.canonicalRoot;
  const candidate = verifiedIndexPublicationV1(input);
  const lineageFile = candidate.publication.files.find((file) => file.relativePath === KNOWLEDGE_LINEAGE_PATH);
  if (lineageFile === undefined) throw new RepositoryIndexError("pending knowledge lineage is required");
  const lineage = readKnowledgeLineageBytesV1(lineageFile.bytes);
  if (lineage.status !== "pending") throw new RepositoryIndexError("only pending knowledge can be saved as a candidate");
  const root = await pendingRootV1(canonicalRoot, true);
  const rootIdentity = await pendingDirectoryV1(root);
  const existing = await fs.lstat(path.join(root, candidate.generation.generationId)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  });
  if (existing !== undefined) {
    const replay = await readPendingRepositoryIndexV1({ canonicalRoot, generationId: candidate.generation.generationId });
    if (replay.generation.generationManifestDigest !== candidate.generation.generationManifestDigest) {
      throw new RepositoryIndexError("pending knowledge replay is not exact");
    }
    return replay;
  }
  const lockPath = path.join(path.dirname(root), INDEX_PENDING_LOCK);
  const token = `${process.pid}:${randomBytes(16).toString("hex")}\n`;
  const lock = await acquirePendingLockV1(lockPath);
  const lockIdentity = await lock.stat();
  let temporaryRoot: string | undefined;
  try {
    await lock.writeFile(token, "utf8");
    await lock.sync();
    const entries = await fs.readdir(root, { withFileTypes: true });
    if (entries.length > MAX_PENDING_GENERATIONS) throw new RepositoryIndexError("pending repository index capacity exceeded");
    let replay = false;
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() ||
        (!INDEX_GENERATION_ID.test(entry.name) && !/^\.tmp-generation-[0-9a-f]{64}-[0-9a-f]{32}$/u.test(entry.name))) {
        throw new RepositoryIndexError("pending repository index entry is invalid");
      }
      await pendingDirectoryV1(path.join(root, entry.name));
      // An interrupted temporary write occupies capacity; never evict drafts.
      if (entry.name.startsWith(".tmp-")) continue;
      const prior = await pendingMetadataV1(path.join(root, entry.name), entry.name);
      if (prior.knowledgeLineage.idempotencyKeyDigest === lineage.idempotencyKeyDigest) {
        if (prior.knowledgeLineage.requestDigest !== lineage.requestDigest) {
          throw new RepositoryIndexError("pending knowledge idempotency conflict", {
            existingRequestDigest: prior.knowledgeLineage.requestDigest,
          });
        }
        if (entry.name !== candidate.generation.generationId) {
          throw new RepositoryIndexError("pending knowledge idempotency replay bytes are not exact");
        }
      }
      if (entry.name === candidate.generation.generationId) {
        if (prior.generation.generationManifestDigest !== candidate.generation.generationManifestDigest) {
          throw new RepositoryIndexError("pending knowledge replay is not exact");
        }
        replay = true;
      }
    }
    if (replay) return await readPendingRepositoryIndexV1({ canonicalRoot, generationId: candidate.generation.generationId });
    if (entries.length === MAX_PENDING_GENERATIONS) throw new RepositoryIndexError("pending repository index capacity exceeded");
    temporaryRoot = path.join(root, `.tmp-${candidate.generation.generationId}-${randomBytes(16).toString("hex")}`);
    await fs.mkdir(temporaryRoot, { mode: 0o700 });
    for (const file of candidate.publication.files) {
      const target = path.join(temporaryRoot, file.relativePath);
      await ensureDirectoryChain(temporaryRoot, path.dirname(target));
      await atomicWriteBytes(target, file.bytes);
    }
    await atomicWriteBytes(path.join(temporaryRoot, INDEX_GENERATION_MANIFEST), candidate.publication.manifestBytes);
    const rootAfter = await pendingDirectoryV1(await pendingRootV1(canonicalRoot, false));
    if (rootIdentity.dev !== rootAfter.dev || rootIdentity.ino !== rootAfter.ino) {
      throw new RepositoryIndexError("pending repository index root changed before commit");
    }
    await fs.rename(temporaryRoot, path.join(root, candidate.generation.generationId));
    temporaryRoot = undefined;
    const rootHandle = await fs.open(root, fsConstants.O_RDONLY | O_NOFOLLOW);
    try { await rootHandle.sync(); } finally { await rootHandle.close(); }
    return await readPendingRepositoryIndexV1({ canonicalRoot, generationId: candidate.generation.generationId });
  } finally {
    try {
      await lock.close();
      if (temporaryRoot !== undefined) await fs.rm(temporaryRoot, { recursive: true, force: true });
    } finally {
      const current = await fs.lstat(lockPath).catch(() => undefined);
      if (current !== undefined && !current.isSymbolicLink() && current.dev === lockIdentity.dev && current.ino === lockIdentity.ino) {
        await fs.unlink(lockPath);
      }
    }
  }
}

export async function publishIncrementalStrongCutV1(input: Readonly<{
  canonicalRoot: string;
  providerRevision: number;
  sourceSnapshotId: string;
  publishStoreCut: () => Promise<void>;
}>): Promise<void> {
  const managedRoot = path.join(input.canonicalRoot, ".understand-code");
  await ensureDirectoryChain(input.canonicalRoot, managedRoot);
  const lockPath = path.join(managedRoot, INDEX_PUBLISH_LOCK);
  const token = `${process.pid}:${randomBytes(16).toString("hex")}\n`;
  let lock: fs.FileHandle | undefined;
  let identity: Awaited<ReturnType<fs.FileHandle["stat"]>> | undefined;
  try {
    lock = await fs.open(lockPath,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | O_NOFOLLOW,
      0o600);
    await lock.writeFile(token, "utf8");
    await lock.sync();
    identity = await lock.stat();
    let head: ReturnType<typeof parseRefreshPublicationHeadV1> | undefined;
    try {
      head = parseRefreshPublicationHeadV1(JSON.parse(
        (await readStableNoFollowFile(path.join(managedRoot, REFRESH_PUBLICATION_HEAD))).toString("utf8"),
      ));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (head !== undefined && (head.providerRevision > input.providerRevision ||
      (head.providerRevision === input.providerRevision && head.sourceSnapshotId !== input.sourceSnapshotId))) {
      throw new RepositoryIndexError("refresh publication revision cannot move backward or fork");
    }
    await input.publishStoreCut();
    await atomicWriteJson(path.join(managedRoot, REFRESH_PUBLICATION_HEAD), {
      schemaVersion: 1,
      providerRevision: input.providerRevision,
      sourceSnapshotId: input.sourceSnapshotId,
    });
  } finally {
    await lock?.close().catch(() => undefined);
    if (identity !== undefined) {
      try {
        const current = await fs.lstat(lockPath);
        if (current.dev === identity.dev && current.ino === identity.ino &&
          (await readStableNoFollowFile(lockPath)).toString("utf8") === token) {
          await fs.unlink(lockPath);
        }
      } catch { /* never remove an unverified lock */ }
    }
  }
}
