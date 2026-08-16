import { createHash, randomUUID } from "node:crypto";
import {
  constants,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rmdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";

/** The on-disk format is intentionally small and independent of MCP schemas. */
export const INSTALLATION_SCHEMA_VERSION =
  "understand-code-installation-v1" as const;
export const INSTALLATION_MARKER = "understand-code-owned-v1" as const;
export const INSTALLATION_MANIFEST_FILE = "installation-manifest.json" as const;
export const INSTALLATION_OWNER_FILE = ".understand-code-owner" as const;
export const INSTALLATION_WRAPPER_FILE = "bin/understand-code" as const;
export const INSTALLATION_CONFIG_FILE = "config/mcp.json" as const;
/** Durable, single-level snapshot used by an explicit upgrade/rollback pair. */
export const INSTALLATION_ROLLBACK_FILE = "installation-rollback.json" as const;
export const DEFAULT_INSTALLATION_VERSION = "0.1.0" as const;

const MAX_PATH_BYTES = 4_096;
const MAX_ROLLBACK_BYTES = 2 * 1024 * 1024;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const OWNED_RELATIVE_FILES = Object.freeze([
  INSTALLATION_OWNER_FILE,
  INSTALLATION_WRAPPER_FILE,
  INSTALLATION_CONFIG_FILE,
] as const);

export type InstallationTargetInputV1 = Readonly<{
  /** Exact installation directory. `root` and `home` are aliases. */
  root?: string;
  home?: string;
  env?: Readonly<Record<string, string | undefined>>;
}>;

export type InstallationOptionsV1 = InstallationTargetInputV1 &
  Readonly<{
    version?: string;
    cliCommand?: string;
  }>;

export type InstallationLifecycleErrorCodeV1 =
  | "target_missing"
  | "target_conflict"
  | "invalid_target"
  | "manifest_invalid"
  | "installation_tampered"
  | "path_conflict"
  | "unsafe_path"
  | "io_error";

export class InstallationLifecycleError extends Error {
  readonly code: InstallationLifecycleErrorCodeV1;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: InstallationLifecycleErrorCodeV1,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "InstallationLifecycleError";
    this.code = code;
    this.details = details;
  }
}

export type OwnedInstallationFileV1 = Readonly<{
  path: (typeof OWNED_RELATIVE_FILES)[number];
  sha256: string;
  mode: number;
  owner: typeof INSTALLATION_MARKER;
}>;

export type InstallationManifestV1 = Readonly<{
  schemaVersion: typeof INSTALLATION_SCHEMA_VERSION;
  product: "understand-code";
  version: string;
  root: string;
  installationId: string;
  marker: typeof INSTALLATION_MARKER;
  files: readonly OwnedInstallationFileV1[];
  /** Present only while a newer installation can be rolled back safely. */
  rollback?: InstallationRollbackDescriptorV1;
}>;

export type InstallationRollbackDescriptorV1 = Readonly<{
  path: typeof INSTALLATION_ROLLBACK_FILE;
  sha256: string;
  fromVersion: string;
  owner: typeof INSTALLATION_MARKER;
}>;

export type InstallationFileStateV1 =
  | "ok"
  | "missing"
  | "modified"
  | "symlink"
  | "wrong_type";

export type InstallationFileCheckV1 = Readonly<{
  path: string;
  state: InstallationFileStateV1;
  expectedSha256: string;
  actualSha256?: string;
}>;

export type DoctorStatusV1 =
  | "healthy"
  | "not_installed"
  | "invalid_manifest"
  | "tampered";

export type DoctorResultV1 = Readonly<{
  ok: boolean;
  status: DoctorStatusV1;
  root: string;
  manifestPath: string;
  installationId?: string;
  version?: string;
  files: readonly InstallationFileCheckV1[];
  reason?: string;
}>;

export type InstallStatusV1 =
  | "installed"
  | "already_installed"
  | "updated"
  | "refused";

export type InstallResultV1 = Readonly<{
  status: InstallStatusV1;
  root: string;
  manifestPath: string;
  installationId?: string;
  version?: string;
  reason?: string;
  doctor?: DoctorResultV1;
}>;

export type UpgradeStatusV1 =
  | "updated"
  | "already_current"
  | "not_installed"
  | "refused";

export type UpgradeResultV1 = Readonly<{
  status: UpgradeStatusV1;
  root: string;
  manifestPath: string;
  installationId?: string;
  fromVersion?: string;
  version?: string;
  rollbackAvailable?: boolean;
  reason?: string;
  doctor?: DoctorResultV1;
}>;

export type RollbackStatusV1 =
  | "rolled_back"
  | "not_available"
  | "not_installed"
  | "refused"
  | "partial";

export type RollbackResultV1 = Readonly<{
  status: RollbackStatusV1;
  root: string;
  manifestPath: string;
  installationId?: string;
  version?: string;
  removedPaths: readonly string[];
  refusedPaths: readonly string[];
  reason?: string;
}>;

export type UninstallStatusV1 =
  | "removed"
  | "not_installed"
  | "refused"
  | "partial";

export type UninstallResultV1 = Readonly<{
  status: UninstallStatusV1;
  root: string;
  manifestPath: string;
  removedPaths: readonly string[];
  refusedPaths: readonly string[];
  reason?: string;
}>;

type ExistingFile = Readonly<{
  bytes: Buffer;
  mode: number;
}>;

type RollbackSnapshotFileV1 = Readonly<{
  path: (typeof OWNED_RELATIVE_FILES)[number];
  sha256: string;
  mode: number;
  owner: typeof INSTALLATION_MARKER;
  base64: string;
}>;

type RollbackSnapshotV1 = Readonly<{
  schemaVersion: "understand-code-installation-rollback-v1";
  marker: typeof INSTALLATION_MARKER;
  root: string;
  installationId: string;
  fromVersion: string;
  manifest: InstallationManifestV1;
  files: readonly RollbackSnapshotFileV1[];
}>;

const ROLLBACK_SCHEMA_VERSION =
  "understand-code-installation-rollback-v1" as const;

function isSafeText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Buffer.byteLength(value, "utf8") <= MAX_PATH_BYTES &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function normalizedCandidate(value: unknown): string | undefined {
  if (!isSafeText(value) || !path.isAbsolute(value)) return undefined;
  const normalized = path.resolve(value);
  if (normalized === path.parse(normalized).root) return undefined;
  return normalized;
}

function candidateValues(input: InstallationTargetInputV1): readonly string[] {
  const explicit = [input.root, input.home].filter(
    (value): value is string => value !== undefined,
  );
  if (explicit.length > 0) return explicit;
  const environment = input.env ?? process.env;
  const fromEnvironment =
    environment.UNDERSTAND_CODE_INSTALL_ROOT ?? environment.UNDERSTAND_CODE_HOME;
  return fromEnvironment === undefined || fromEnvironment === ""
    ? []
    : [fromEnvironment];
}

/**
 * Resolve and validate the explicit installation directory.  This function is
 * intentionally async so callers can use one canonical root for all lifecycle
 * operations without trusting a textual path supplied by a host.
 */
export async function resolveInstallationTargetV1(
  input: InstallationTargetInputV1,
  options: Readonly<{ create?: boolean }> = {},
): Promise<string> {
  const candidates = candidateValues(input);
  if (candidates.length === 0) {
    throw new InstallationLifecycleError(
      "target_missing",
      "An explicit installation root/home or installation environment variable is required.",
    );
  }
  const normalized = candidates.map(normalizedCandidate);
  if (normalized.some((value) => value === undefined)) {
    throw new InstallationLifecycleError(
      "invalid_target",
      "Installation root must be an absolute, non-root path without control characters.",
    );
  }
  const distinct = new Set(normalized as string[]);
  if (distinct.size !== 1) {
    throw new InstallationLifecycleError(
      "target_conflict",
      "Installation root and home resolve to different directories.",
      { candidates },
    );
  }
  const requested = normalized[0]!;
  let metadata;
  try {
    metadata = await lstat(requested);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new InstallationLifecycleError("io_error", "Unable to inspect installation root.", {
        root: requested,
      });
    }
    if (options.create !== true) return requested;
    try {
      await mkdir(requested, { recursive: true, mode: 0o700 });
      metadata = await lstat(requested);
    } catch {
      throw new InstallationLifecycleError("io_error", "Unable to create installation root.", {
        root: requested,
      });
    }
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new InstallationLifecycleError(
      "invalid_target",
      "Installation root must be a real directory, not a symlink or file.",
      { root: requested },
    );
  }
  try {
    return await realCanonicalPath(requested);
  } catch {
    throw new InstallationLifecycleError("io_error", "Unable to canonicalize installation root.", {
      root: requested,
    });
  }
}

async function realCanonicalPath(value: string): Promise<string> {
  return realpath(value);
}

function digest(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function safeRelativePath(value: unknown): value is string {
  if (!isSafeText(value) || path.isAbsolute(value)) return false;
  const normalized = value.split(path.sep).join("/");
  return (
    normalized === value &&
    !normalized.split("/").some((segment) => segment === ".." || segment === "") &&
    (OWNED_RELATIVE_FILES as readonly string[]).includes(normalized)
  );
}

function ownedAbsolutePath(root: string, relativePath: string): string {
  if (!safeRelativePath(relativePath)) {
    throw new InstallationLifecycleError(
      "unsafe_path",
      "Installation manifest contains a path outside the owned file set.",
      { relativePath },
    );
  }
  const absolute = path.join(root, ...relativePath.split("/"));
  const relative = path.relative(root, absolute);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new InstallationLifecycleError("unsafe_path", "Owned path escaped installation root.", {
      relativePath,
    });
  }
  return absolute;
}

type ParentStateV1 = "ok" | "missing" | "unsafe";

/** Check every directory component, not just the leaf file. */
async function ownedParentState(
  root: string,
  relativePath: string,
  create: boolean,
): Promise<ParentStateV1> {
  const parentSegments = relativePath.split("/").slice(0, -1);
  let current = root;
  for (const segment of parentSegments) {
    current = path.join(current, segment);
    const relative = path.relative(root, current);
    if (
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      return "unsafe";
    }
    let metadata;
    try {
      metadata = await lstat(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return "unsafe";
      if (!create) return "missing";
      try {
        await mkdir(current, { mode: 0o700 });
        metadata = await lstat(current);
      } catch {
        return "unsafe";
      }
    }
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) return "unsafe";
    try {
      const canonical = await realpath(current);
      if (canonical !== current) return "unsafe";
    } catch {
      return "unsafe";
    }
  }
  return "ok";
}

function markerContent(installationId: string): string {
  return `${INSTALLATION_MARKER}\nproduct=understand-code\ninstallationId=${installationId}\n`;
}

function wrapperContent(installationId: string): string {
  return [
    "#!/bin/sh",
    `# ${INSTALLATION_MARKER}`,
    `# installation-id: ${installationId}`,
    "set -eu",
    'cli="${UNDERSTAND_CODE_CLI:-understand-code}"',
    'exec "$cli" "$@"',
    "",
  ].join("\n");
}

function configContent(root: string, installationId: string, cliCommand: string): string {
  return canonicalJson({
    schemaVersion: INSTALLATION_SCHEMA_VERSION,
    marker: INSTALLATION_MARKER,
    installationId,
    mcpServers: {
      "understand-code": {
        command: cliCommand,
        args: ["mcp", "--stdio", "--root", "${WORKSPACE_ROOT}"],
      },
    },
    installationRoot: root,
  });
}

function manifestFor(
  root: string,
  version: string,
  installationId: string,
  fileBytes: Readonly<Record<(typeof OWNED_RELATIVE_FILES)[number], Uint8Array>>,
  rollback?: InstallationRollbackDescriptorV1,
): InstallationManifestV1 {
  const modes: Readonly<Record<(typeof OWNED_RELATIVE_FILES)[number], number>> = {
    [INSTALLATION_OWNER_FILE]: 0o600,
    [INSTALLATION_WRAPPER_FILE]: 0o755,
    [INSTALLATION_CONFIG_FILE]: 0o600,
  };
  return {
    schemaVersion: INSTALLATION_SCHEMA_VERSION,
    product: "understand-code",
    version,
    root,
    installationId,
    marker: INSTALLATION_MARKER,
    files: OWNED_RELATIVE_FILES.map((filePath) => ({
      path: filePath,
      sha256: digest(fileBytes[filePath]),
      mode: modes[filePath],
      owner: INSTALLATION_MARKER,
    })),
    ...(rollback === undefined ? {} : { rollback }),
  };
}

function parseRollbackDescriptor(
  value: unknown,
): InstallationRollbackDescriptorV1 | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.path !== INSTALLATION_ROLLBACK_FILE ||
    !isSafeText(candidate.sha256) ||
    !HASH_PATTERN.test(candidate.sha256) ||
    !isSafeText(candidate.fromVersion) ||
    candidate.owner !== INSTALLATION_MARKER
  ) {
    return undefined;
  }
  return {
    path: INSTALLATION_ROLLBACK_FILE,
    sha256: candidate.sha256,
    fromVersion: candidate.fromVersion,
    owner: INSTALLATION_MARKER,
  };
}

function parseManifest(value: unknown): InstallationManifestV1 | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.schemaVersion !== INSTALLATION_SCHEMA_VERSION ||
    candidate.product !== "understand-code" ||
    !isSafeText(candidate.version) ||
    !isSafeText(candidate.root) ||
    !isSafeText(candidate.installationId) ||
    candidate.marker !== INSTALLATION_MARKER ||
    !Array.isArray(candidate.files) ||
    candidate.files.length !== OWNED_RELATIVE_FILES.length
  ) {
    return undefined;
  }
  const rollbackValue = candidate.rollback;
  const rollback =
    rollbackValue === undefined
      ? undefined
      : parseRollbackDescriptor(rollbackValue);
  if (rollbackValue !== undefined && rollback === undefined) return undefined;
  const files: OwnedInstallationFileV1[] = [];
  for (const rawFile of candidate.files) {
    if (rawFile === null || typeof rawFile !== "object" || Array.isArray(rawFile)) {
      return undefined;
    }
    const file = rawFile as Record<string, unknown>;
    if (
      !safeRelativePath(file.path) ||
      !isSafeText(file.sha256) ||
      !HASH_PATTERN.test(file.sha256) ||
      typeof file.mode !== "number" ||
      !Number.isInteger(file.mode) ||
      file.mode < 0 ||
      file.mode > 0o777 ||
      file.owner !== INSTALLATION_MARKER
    ) {
      return undefined;
    }
    files.push({
      path: file.path as (typeof OWNED_RELATIVE_FILES)[number],
      sha256: file.sha256,
      mode: file.mode,
      owner: INSTALLATION_MARKER,
    });
  }
  const paths = files.map((file) => file.path);
  if (
    new Set(paths).size !== OWNED_RELATIVE_FILES.length ||
    OWNED_RELATIVE_FILES.some((filePath) => !paths.includes(filePath))
  ) {
    return undefined;
  }
  return {
    schemaVersion: INSTALLATION_SCHEMA_VERSION,
    product: "understand-code",
    version: candidate.version,
    root: candidate.root,
    installationId: candidate.installationId,
    marker: INSTALLATION_MARKER,
    files: Object.freeze(files),
    ...(rollback === undefined ? {} : { rollback }),
  };
}

function manifestWithoutRollback(
  manifest: InstallationManifestV1,
): InstallationManifestV1 {
  const { rollback: _rollback, ...withoutRollback } = manifest;
  return withoutRollback;
}

function isStrictBase64(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length % 4 === 0 &&
    value.length <= MAX_ROLLBACK_BYTES * 2 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(
      value,
    )
  );
}

function parseRollbackSnapshot(value: unknown): RollbackSnapshotV1 | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.schemaVersion !== ROLLBACK_SCHEMA_VERSION ||
    candidate.marker !== INSTALLATION_MARKER ||
    !isSafeText(candidate.root) ||
    !isSafeText(candidate.installationId) ||
    !isSafeText(candidate.fromVersion) ||
    !Array.isArray(candidate.files)
  ) {
    return undefined;
  }
  const manifest = parseManifest(candidate.manifest);
  if (
    manifest === undefined ||
    manifest.rollback !== undefined ||
    manifest.root !== candidate.root ||
    manifest.installationId !== candidate.installationId ||
    manifest.version !== candidate.fromVersion ||
    candidate.files.length !== OWNED_RELATIVE_FILES.length
  ) {
    return undefined;
  }
  const files: RollbackSnapshotFileV1[] = [];
  for (const rawFile of candidate.files) {
    if (rawFile === null || typeof rawFile !== "object" || Array.isArray(rawFile)) {
      return undefined;
    }
    const file = rawFile as Record<string, unknown>;
    if (
      !safeRelativePath(file.path) ||
      !isSafeText(file.sha256) ||
      !HASH_PATTERN.test(file.sha256) ||
      typeof file.mode !== "number" ||
      !Number.isInteger(file.mode) ||
      file.mode < 0 ||
      file.mode > 0o777 ||
      file.owner !== INSTALLATION_MARKER ||
      !isStrictBase64(file.base64)
    ) {
      return undefined;
    }
    const bytes = Buffer.from(file.base64, "base64");
    if (bytes.length > MAX_ROLLBACK_BYTES || digest(bytes) !== file.sha256) {
      return undefined;
    }
    files.push({
      path: file.path as (typeof OWNED_RELATIVE_FILES)[number],
      sha256: file.sha256,
      mode: file.mode,
      owner: INSTALLATION_MARKER,
      base64: file.base64,
    });
  }
  const paths = files.map((file) => file.path);
  if (
    new Set(paths).size !== OWNED_RELATIVE_FILES.length ||
    OWNED_RELATIVE_FILES.some((filePath) => !paths.includes(filePath))
  ) {
    return undefined;
  }
  // The snapshot carries the manifest's expected file digests as a second
  // integrity boundary.  This prevents a forged snapshot from restoring a
  // different byte set under an otherwise valid installation marker.
  for (const file of files) {
    const expected = manifest.files.find((entry) => entry.path === file.path);
    if (
      expected === undefined ||
      expected.sha256 !== file.sha256 ||
      expected.mode !== file.mode
    ) {
      return undefined;
    }
  }
  return {
    schemaVersion: ROLLBACK_SCHEMA_VERSION,
    marker: INSTALLATION_MARKER,
    root: candidate.root,
    installationId: candidate.installationId,
    fromVersion: candidate.fromVersion,
    manifest,
    files: Object.freeze(files),
  };
}

function rollbackSnapshotFor(
  root: string,
  manifest: InstallationManifestV1,
  fileBytes: Readonly<Record<(typeof OWNED_RELATIVE_FILES)[number], ExistingFile>>,
): RollbackSnapshotV1 {
  const baseManifest = manifestWithoutRollback(manifest);
  return {
    schemaVersion: ROLLBACK_SCHEMA_VERSION,
    marker: INSTALLATION_MARKER,
    root,
    installationId: manifest.installationId,
    fromVersion: manifest.version,
    manifest: baseManifest,
    files: OWNED_RELATIVE_FILES.map((filePath) => ({
      path: filePath,
      sha256: digest(fileBytes[filePath].bytes),
      mode: fileBytes[filePath].mode,
      owner: INSTALLATION_MARKER,
      base64: fileBytes[filePath].bytes.toString("base64"),
    })),
  };
}

async function readExistingFile(filePath: string): Promise<ExistingFile | undefined> {
  try {
    const metadata = await lstat(filePath);
    if (!metadata.isFile()) return undefined;
    return { bytes: await readFile(filePath), mode: metadata.mode & 0o777 };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function atomicWriteFile(
  root: string,
  filePath: string,
  bytes: Uint8Array,
  mode: number,
): Promise<void> {
  const directory = path.dirname(filePath);
  const relativePath = path.relative(root, filePath).split(path.sep).join("/");
  const parentState = await ownedParentState(root, relativePath, true);
  if (parentState !== "ok") {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "Refusing to write through an unsafe installation parent.",
      { filePath },
    );
  }
  try {
    const metadata = await lstat(filePath);
    if (metadata.isSymbolicLink()) {
      throw new InstallationLifecycleError(
        "installation_tampered",
        "Refusing to replace an owned symlink.",
        { filePath },
      );
    }
  } catch (error) {
    if (error instanceof InstallationLifecycleError) throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.tmp-${process.pid}-${randomUUID()}`,
  );
  let handle;
  let temporaryExists = false;
  try {
    handle = await open(
      temporaryPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      mode,
    );
    temporaryExists = true;
    await handle.writeFile(bytes);
    // open(2) applies the process umask; explicitly restore the owned mode so
    // Doctor has a deterministic permission contract across host processes.
    await handle.chmod(mode);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, filePath);
    temporaryExists = false;
    const directoryHandle = await open(directory, constants.O_RDONLY);
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  } catch (error) {
    if (handle !== undefined) await handle.close().catch(() => undefined);
    if (temporaryExists) await unlink(temporaryPath).catch(() => undefined);
    if (error instanceof InstallationLifecycleError) throw error;
    throw new InstallationLifecycleError("io_error", "Atomic installation write failed.", {
      filePath,
    });
  }
}

async function readManifestAt(
  root: string,
): Promise<InstallationManifestV1 | undefined> {
  const manifestPath = path.join(root, INSTALLATION_MANIFEST_FILE);
  let metadata;
  try {
    metadata = await lstat(manifestPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new InstallationLifecycleError("io_error", "Unable to inspect installation manifest.", {
      manifestPath,
    });
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) return undefined;
  try {
    return parseManifest(JSON.parse(await readFile(manifestPath, "utf8")));
  } catch {
    return undefined;
  }
}

async function readRollbackSnapshotAt(
  root: string,
  descriptor: InstallationRollbackDescriptorV1,
  expectedManifest: InstallationManifestV1,
): Promise<RollbackSnapshotV1 | undefined> {
  if (descriptor.path !== INSTALLATION_ROLLBACK_FILE) return undefined;
  const rollbackPath = path.join(root, INSTALLATION_ROLLBACK_FILE);
  const relative = path.relative(root, rollbackPath);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return undefined;
  }
  const parentState = await ownedParentState(root, INSTALLATION_ROLLBACK_FILE, false);
  if (parentState !== "ok") return undefined;
  let metadata;
  try {
    metadata = await lstat(rollbackPath);
  } catch {
    return undefined;
  }
  if (metadata.isSymbolicLink() || !metadata.isFile() || metadata.size > MAX_ROLLBACK_BYTES) {
    return undefined;
  }
  let bytes: Buffer;
  try {
    bytes = await readFile(rollbackPath);
  } catch {
    return undefined;
  }
  if (digest(bytes) !== descriptor.sha256) return undefined;
  let snapshot: RollbackSnapshotV1 | undefined;
  try {
    snapshot = parseRollbackSnapshot(JSON.parse(bytes.toString("utf8")));
  } catch {
    snapshot = undefined;
  }
  if (
    snapshot === undefined ||
    snapshot.root !== root ||
    snapshot.installationId !== expectedManifest.installationId ||
    snapshot.fromVersion !== descriptor.fromVersion
  ) {
    return undefined;
  }
  return snapshot;
}

async function rollbackPathState(root: string): Promise<"missing" | "present" | "unsafe"> {
  const rollbackPath = path.join(root, INSTALLATION_ROLLBACK_FILE);
  const relative = path.relative(root, rollbackPath);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return "unsafe";
  }
  try {
    const metadata = await lstat(rollbackPath);
    if (metadata.isSymbolicLink() || !metadata.isFile()) return "unsafe";
    return "present";
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT"
      ? "missing"
      : "unsafe";
  }
}

async function inspectInstallation(
  root: string,
): Promise<DoctorResultV1> {
  const manifestPath = path.join(root, INSTALLATION_MANIFEST_FILE);
  let manifestMetadata;
  try {
    manifestMetadata = await lstat(manifestPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const rollbackState = await rollbackPathState(root);
      if (rollbackState !== "missing") {
        return {
          ok: false,
          status: "tampered",
          root,
          manifestPath,
          files: [
            {
              path: INSTALLATION_ROLLBACK_FILE,
              state: rollbackState === "present" ? "modified" : "symlink",
              expectedSha256: `sha256:${"0".repeat(64)}`,
            },
          ],
          reason: "orphaned_rollback_snapshot",
        };
      }
      return { ok: false, status: "not_installed", root, manifestPath, files: [] };
    }
    return {
      ok: false,
      status: "invalid_manifest",
      root,
      manifestPath,
      files: [],
      reason: "manifest_unreadable",
    };
  }
  if (manifestMetadata.isSymbolicLink() || !manifestMetadata.isFile()) {
    return {
      ok: false,
      status: "tampered",
      root,
      manifestPath,
      files: [],
      reason: "manifest_not_regular_file",
    };
  }
  let manifest: InstallationManifestV1 | undefined;
  try {
    manifest = parseManifest(JSON.parse(await readFile(manifestPath, "utf8")));
  } catch {
    manifest = undefined;
  }
  if (manifest === undefined) {
    return {
      ok: false,
      status: "invalid_manifest",
      root,
      manifestPath,
      files: [],
      reason: "manifest_schema_invalid",
    };
  }
  if (manifest.root !== root) {
    return {
      ok: false,
      status: "tampered",
      root,
      manifestPath,
      installationId: manifest.installationId,
      version: manifest.version,
      files: [],
      reason: "manifest_root_mismatch",
    };
  }
  const checks: InstallationFileCheckV1[] = [];
  for (const file of manifest.files) {
    const filePath = ownedAbsolutePath(root, file.path);
    const parentState = await ownedParentState(root, file.path, false);
    if (parentState === "missing") {
      checks.push({ path: file.path, state: "missing", expectedSha256: file.sha256 });
      continue;
    }
    if (parentState === "unsafe") {
      checks.push({ path: file.path, state: "symlink", expectedSha256: file.sha256 });
      continue;
    }
    let metadata;
    try {
      metadata = await lstat(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        checks.push({ path: file.path, state: "missing", expectedSha256: file.sha256 });
        continue;
      }
      checks.push({ path: file.path, state: "modified", expectedSha256: file.sha256 });
      continue;
    }
    if (metadata.isSymbolicLink()) {
      checks.push({ path: file.path, state: "symlink", expectedSha256: file.sha256 });
      continue;
    }
    if (!metadata.isFile()) {
      checks.push({ path: file.path, state: "wrong_type", expectedSha256: file.sha256 });
      continue;
    }
    if ((metadata.mode & 0o777) !== file.mode) {
      checks.push({
        path: file.path,
        state: "modified",
        expectedSha256: file.sha256,
      });
      continue;
    }
    let bytes: Buffer;
    try {
      bytes = await readFile(filePath);
    } catch {
      checks.push({ path: file.path, state: "modified", expectedSha256: file.sha256 });
      continue;
    }
    const actualSha256 = digest(bytes);
    const hasMarker = bytes.toString("utf8").includes(INSTALLATION_MARKER);
    checks.push({
      path: file.path,
      state: actualSha256 === file.sha256 && hasMarker ? "ok" : "modified",
      expectedSha256: file.sha256,
      actualSha256,
    });
  }
  const markerCheck = checks.find((check) => check.path === INSTALLATION_OWNER_FILE);
  let markerIdentityMatches = false;
  try {
    const marker = await readFile(ownedAbsolutePath(root, INSTALLATION_OWNER_FILE), "utf8");
    markerIdentityMatches =
      marker.includes(`installationId=${manifest.installationId}\n`) &&
      marker.startsWith(`${INSTALLATION_MARKER}\n`);
  } catch {
    markerIdentityMatches = false;
  }
  if (markerCheck?.state === "ok" && !markerIdentityMatches) {
    const index = checks.findIndex((check) => check.path === INSTALLATION_OWNER_FILE);
    checks[index] = {
      ...checks[index]!,
      state: "modified",
    };
  }
  let rollbackValid = true;
  const rollbackState = await rollbackPathState(root);
  if (manifest.rollback !== undefined) {
    if (rollbackState !== "present") {
      rollbackValid = false;
      checks.push({
        path: INSTALLATION_ROLLBACK_FILE,
        state: rollbackState === "missing" ? "missing" : "symlink",
        expectedSha256: manifest.rollback.sha256,
      });
    } else {
      const snapshot = await readRollbackSnapshotAt(root, manifest.rollback, manifest);
      if (snapshot === undefined) {
        rollbackValid = false;
        checks.push({
          path: INSTALLATION_ROLLBACK_FILE,
          state: "modified",
          expectedSha256: manifest.rollback.sha256,
        });
      } else {
        checks.push({
          path: INSTALLATION_ROLLBACK_FILE,
          state: "ok",
          expectedSha256: manifest.rollback.sha256,
          actualSha256: manifest.rollback.sha256,
        });
      }
    }
  } else if (rollbackState !== "missing") {
    rollbackValid = false;
    checks.push({
      path: INSTALLATION_ROLLBACK_FILE,
      state: rollbackState === "present" ? "modified" : "symlink",
      expectedSha256: `sha256:${"0".repeat(64)}`,
    });
  }
  const hasModified = !rollbackValid || checks.some((check) => check.state !== "ok");
  return {
    ok: !hasModified,
    status: hasModified ? "tampered" : "healthy",
    root,
    manifestPath,
    installationId: manifest.installationId,
    version: manifest.version,
    files: Object.freeze(checks),
    ...(hasModified
      ? {
          reason: rollbackValid
            ? "owned_file_check_failed"
            : manifest.rollback === undefined
              ? "orphaned_rollback_snapshot"
              : "rollback_snapshot_invalid",
        }
      : {}),
  };
}

/** Install or refresh the owned wrapper/config set. */
export async function installInstallationV1(
  options: InstallationOptionsV1,
): Promise<InstallResultV1> {
  const root = await resolveInstallationTargetV1(options, { create: true });
  const manifestPath = path.join(root, INSTALLATION_MANIFEST_FILE);
  const existingManifest = await readManifestAt(root);
  let installationId = existingManifest?.installationId ?? randomUUID();
  if (existingManifest !== undefined) {
    const before = await inspectInstallation(root);
    if (before.status !== "healthy") {
      return {
        status: "refused",
        root,
        manifestPath,
        installationId: existingManifest.installationId,
        version: existingManifest.version,
        reason: before.reason ?? "installation_tampered",
        doctor: before,
      };
    }
  } else {
    // Never claim ownership of pre-existing files when there is no manifest.
    try {
      const manifestMetadata = await lstat(manifestPath);
      if (manifestMetadata.isSymbolicLink() || !manifestMetadata.isFile()) {
        return { status: "refused", root, manifestPath, reason: "manifest_invalid" };
      }
      // A regular but malformed manifest is still an ownership signal; do not
      // overwrite it and accidentally claim a partially managed installation.
      return { status: "refused", root, manifestPath, reason: "manifest_invalid" };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    for (const relativePath of OWNED_RELATIVE_FILES) {
      const existing = await readExistingFile(ownedAbsolutePath(root, relativePath));
      if (existing !== undefined) {
        return {
          status: "refused",
          root,
          manifestPath,
          reason: "path_conflict",
        };
      }
      try {
        const metadata = await lstat(ownedAbsolutePath(root, relativePath));
        if (metadata.isSymbolicLink() || !metadata.isFile()) {
          return { status: "refused", root, manifestPath, reason: "path_conflict" };
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    if ((await rollbackPathState(root)) !== "missing") {
      return { status: "refused", root, manifestPath, reason: "path_conflict" };
    }
  }
  const version = options.version ?? DEFAULT_INSTALLATION_VERSION;
  if (!isSafeText(version)) {
    throw new InstallationLifecycleError("invalid_target", "Installation version is invalid.");
  }
  const cliCommand = options.cliCommand ?? "understand-code";
  if (!isSafeText(cliCommand) || cliCommand.includes("\n")) {
    throw new InstallationLifecycleError("invalid_target", "CLI command is invalid.");
  }
  const bytes: Readonly<Record<(typeof OWNED_RELATIVE_FILES)[number], Uint8Array>> = {
    [INSTALLATION_OWNER_FILE]: Buffer.from(markerContent(installationId), "utf8"),
    [INSTALLATION_WRAPPER_FILE]: Buffer.from(wrapperContent(installationId), "utf8"),
    [INSTALLATION_CONFIG_FILE]: Buffer.from(
      configContent(root, installationId, cliCommand),
      "utf8",
    ),
  };
  const manifest = manifestFor(root, version, installationId, bytes);
  if (existingManifest !== undefined) {
    const before = await inspectInstallation(root);
    if (before.status === "healthy" && existingManifest.version === version) {
      const filesMatch = existingManifest.files.every(
        (file) => file.sha256 === manifest.files.find((next) => next.path === file.path)?.sha256,
      );
      if (!filesMatch) {
        const upgraded = await upgradeInstallationV1(options);
        return {
          status:
            upgraded.status === "updated"
              ? "updated"
              : upgraded.status === "already_current"
                ? "already_installed"
                : "refused",
          root: upgraded.root,
          manifestPath: upgraded.manifestPath,
          ...(upgraded.installationId === undefined
            ? {}
            : { installationId: upgraded.installationId }),
          ...(upgraded.version === undefined ? {} : { version: upgraded.version }),
          ...(upgraded.reason === undefined ? {} : { reason: upgraded.reason }),
          ...(upgraded.doctor === undefined ? {} : { doctor: upgraded.doctor }),
        };
      }
      return {
        status: "already_installed",
        root,
        manifestPath,
        installationId,
        version,
        doctor: before,
      };
    }
    if (before.status === "healthy" && existingManifest.version !== version) {
      const upgraded = await upgradeInstallationV1(options);
      return {
        status:
          upgraded.status === "updated"
            ? "updated"
            : upgraded.status === "already_current"
              ? "already_installed"
              : "refused",
        root: upgraded.root,
        manifestPath: upgraded.manifestPath,
        ...(upgraded.installationId === undefined
          ? {}
          : { installationId: upgraded.installationId }),
        ...(upgraded.version === undefined ? {} : { version: upgraded.version }),
        ...(upgraded.reason === undefined ? {} : { reason: upgraded.reason }),
        ...(upgraded.doctor === undefined ? {} : { doctor: upgraded.doctor }),
      };
    }
  }
  const previous = new Map<string, ExistingFile | undefined>();
  const written: string[] = [];
  try {
    for (const relativePath of OWNED_RELATIVE_FILES) {
      const filePath = ownedAbsolutePath(root, relativePath);
      previous.set(filePath, await readExistingFile(filePath));
      await atomicWriteFile(root, filePath, bytes[relativePath], relativePath === INSTALLATION_WRAPPER_FILE ? 0o755 : 0o600);
      written.push(filePath);
    }
      await atomicWriteFile(
      root,
      manifestPath,
      Buffer.from(canonicalJson(manifest), "utf8"),
      0o600,
    );
  } catch (error) {
    // Restore the previous owned set.  If this recovery itself fails, leave
    // the manifest untouched where possible and fail closed for Doctor.
    for (const filePath of written.reverse()) {
      const old = previous.get(filePath);
      if (old === undefined) await unlink(filePath).catch(() => undefined);
      else await atomicWriteFile(root, filePath, old.bytes, old.mode).catch(() => undefined);
    }
    if (error instanceof InstallationLifecycleError) throw error;
    throw new InstallationLifecycleError("io_error", "Installation failed before manifest commit.", {
      root,
    });
  }
  return {
    status: existingManifest === undefined ? "installed" : "updated",
    root,
    manifestPath,
    installationId,
    version,
  };
}

/**
 * Upgrade an existing installation while retaining a durable, integrity-bound
 * snapshot of the previous owned set.  The snapshot is single-level: a later
 * upgrade replaces it, and rollback always returns to the immediately prior
 * healthy version.
 */
export async function upgradeInstallationV1(
  options: InstallationOptionsV1,
): Promise<UpgradeResultV1> {
  const root = await resolveInstallationTargetV1(options, { create: false });
  const manifestPath = path.join(root, INSTALLATION_MANIFEST_FILE);
  const existingManifest = await readManifestAt(root);
  if (existingManifest === undefined) {
    const doctor = await inspectInstallation(root);
    return {
      status: doctor.status === "not_installed" ? "not_installed" : "refused",
      root,
      manifestPath,
      reason:
        doctor.status === "not_installed"
          ? "installation_not_found"
          : doctor.reason ?? "manifest_invalid",
      ...(doctor.status === "not_installed" ? {} : { doctor }),
    };
  }
  const before = await inspectInstallation(root);
  if (before.status !== "healthy") {
    return {
      status: "refused",
      root,
      manifestPath,
      installationId: existingManifest.installationId,
      fromVersion: existingManifest.version,
      version: existingManifest.version,
      reason: before.reason ?? "installation_tampered",
      doctor: before,
    };
  }
  const version = options.version ?? DEFAULT_INSTALLATION_VERSION;
  if (!isSafeText(version)) {
    throw new InstallationLifecycleError("invalid_target", "Installation version is invalid.");
  }
  const cliCommand = options.cliCommand ?? "understand-code";
  if (!isSafeText(cliCommand) || cliCommand.includes("\n")) {
    throw new InstallationLifecycleError("invalid_target", "CLI command is invalid.");
  }
  const installationId = existingManifest.installationId;
  const bytes: Readonly<Record<(typeof OWNED_RELATIVE_FILES)[number], Uint8Array>> = {
    [INSTALLATION_OWNER_FILE]: Buffer.from(markerContent(installationId), "utf8"),
    [INSTALLATION_WRAPPER_FILE]: Buffer.from(wrapperContent(installationId), "utf8"),
    [INSTALLATION_CONFIG_FILE]: Buffer.from(
      configContent(root, installationId, cliCommand),
      "utf8",
    ),
  };
  const desiredManifest = manifestFor(root, version, installationId, bytes);
  const currentMatches =
    existingManifest.version === version &&
    existingManifest.files.every(
      (file) =>
        file.sha256 ===
        desiredManifest.files.find((next) => next.path === file.path)?.sha256,
    );
  if (currentMatches) {
    return {
      status: "already_current",
      root,
      manifestPath,
      installationId,
      fromVersion: existingManifest.version,
      version,
      rollbackAvailable: existingManifest.rollback !== undefined,
      doctor: before,
    };
  }

  // Re-check immediately before snapshotting.  This closes the common race
  // where a host edits a file between the initial Doctor pass and upgrade.
  const latest = await inspectInstallation(root);
  if (latest.status !== "healthy") {
    return {
      status: "refused",
      root,
      manifestPath,
      installationId,
      fromVersion: existingManifest.version,
      version,
      reason: "owned_file_changed_during_upgrade",
      doctor: latest,
    };
  }
  const currentFiles = {} as Record<
    (typeof OWNED_RELATIVE_FILES)[number],
    ExistingFile
  >;
  for (const relativePath of OWNED_RELATIVE_FILES) {
    const filePath = ownedAbsolutePath(root, relativePath);
    const current = await readExistingFile(filePath);
    if (current === undefined) {
      return {
        status: "refused",
        root,
        manifestPath,
        installationId,
        fromVersion: existingManifest.version,
        version,
        reason: "owned_file_changed_during_upgrade",
        doctor: await inspectInstallation(root),
      };
    }
    currentFiles[relativePath] = current;
  }
  const oldManifestBytes = await readFile(manifestPath);
  const rollbackPath = path.join(root, INSTALLATION_ROLLBACK_FILE);
  const previousRollback = await readExistingFile(rollbackPath);
  const snapshot = rollbackSnapshotFor(root, existingManifest, currentFiles);
  const snapshotBytes = Buffer.from(canonicalJson(snapshot), "utf8");
  const rollback: InstallationRollbackDescriptorV1 = {
    path: INSTALLATION_ROLLBACK_FILE,
    sha256: digest(snapshotBytes),
    fromVersion: existingManifest.version,
    owner: INSTALLATION_MARKER,
  };
  const nextManifest = manifestFor(root, version, installationId, bytes, rollback);
  const written: string[] = [];
  try {
    // Commit the snapshot before publishing its descriptor.  A failed write
    // therefore leaves the old manifest as the only authoritative state.
    await atomicWriteFile(root, rollbackPath, snapshotBytes, 0o600);
    for (const relativePath of OWNED_RELATIVE_FILES) {
      const filePath = ownedAbsolutePath(root, relativePath);
      await atomicWriteFile(
        root,
        filePath,
        bytes[relativePath],
        relativePath === INSTALLATION_WRAPPER_FILE ? 0o755 : 0o600,
      );
      written.push(filePath);
    }
    await atomicWriteFile(
      root,
      manifestPath,
      Buffer.from(canonicalJson(nextManifest), "utf8"),
      0o600,
    );
  } catch (error) {
    // Best-effort in-process recovery.  The durable snapshot remains available
    // for a later explicit rollback if recovery itself is interrupted.
    for (const filePath of written.reverse()) {
      const relativePath = path.relative(root, filePath).split(path.sep).join("/") as (typeof OWNED_RELATIVE_FILES)[number];
      const previous = currentFiles[relativePath];
      await atomicWriteFile(root, filePath, previous.bytes, previous.mode).catch(
        () => undefined,
      );
    }
    await atomicWriteFile(root, manifestPath, oldManifestBytes, 0o600).catch(
      () => undefined,
    );
    if (previousRollback === undefined) {
      await unlink(rollbackPath).catch(() => undefined);
    } else {
      await atomicWriteFile(root, rollbackPath, previousRollback.bytes, previousRollback.mode).catch(
        () => undefined,
      );
    }
    if (error instanceof InstallationLifecycleError) throw error;
    throw new InstallationLifecycleError("io_error", "Upgrade failed before manifest commit.", {
      root,
    });
  }
  return {
    status: "updated",
    root,
    manifestPath,
    installationId,
    fromVersion: existingManifest.version,
    version,
    rollbackAvailable: true,
  };
}

/** Restore the immediately preceding healthy installation snapshot. */
export async function rollbackInstallationV1(
  input: InstallationTargetInputV1,
): Promise<RollbackResultV1> {
  const root = await resolveInstallationTargetV1(input, { create: false });
  const manifestPath = path.join(root, INSTALLATION_MANIFEST_FILE);
  const manifest = await readManifestAt(root);
  if (manifest === undefined) {
    const doctor = await inspectInstallation(root);
    return {
      status: doctor.status === "not_installed" ? "not_installed" : "refused",
      root,
      manifestPath,
      removedPaths: [],
      refusedPaths: doctor.files.map((file) => file.path),
      reason:
        doctor.status === "not_installed"
          ? "installation_not_found"
          : doctor.reason ?? "manifest_invalid",
    };
  }
  if (manifest.rollback === undefined) {
    const doctor = await inspectInstallation(root);
    return {
      status: doctor.status === "healthy" ? "not_available" : "refused",
      root,
      manifestPath,
      installationId: manifest.installationId,
      version: manifest.version,
      removedPaths: [],
      refusedPaths: doctor.status === "healthy" ? [] : doctor.files.map((file) => file.path),
      reason:
        doctor.status === "healthy"
          ? "rollback_snapshot_not_available"
          : doctor.reason ?? "installation_tampered",
    };
  }
  const doctor = await inspectInstallation(root);
  if (doctor.status !== "healthy") {
    return {
      status: "refused",
      root,
      manifestPath,
      installationId: manifest.installationId,
      version: manifest.version,
      removedPaths: [],
      refusedPaths: doctor.files
        .filter((file) => file.state !== "missing")
        .map((file) => file.path),
      reason: doctor.reason ?? "installation_tampered",
    };
  }
  const snapshot = await readRollbackSnapshotAt(root, manifest.rollback, manifest);
  if (snapshot === undefined) {
    return {
      status: "refused",
      root,
      manifestPath,
      installationId: manifest.installationId,
      version: manifest.version,
      removedPaths: [],
      refusedPaths: [INSTALLATION_ROLLBACK_FILE],
      reason: "rollback_snapshot_invalid",
    };
  }
  const rollbackPath = path.join(root, INSTALLATION_ROLLBACK_FILE);
  const restoredFiles = snapshot.files;
  try {
    for (const file of restoredFiles) {
      const filePath = ownedAbsolutePath(root, file.path);
      await atomicWriteFile(
        root,
        filePath,
        Buffer.from(file.base64, "base64"),
        file.mode,
      );
    }
    await atomicWriteFile(
      root,
      manifestPath,
      Buffer.from(canonicalJson(snapshot.manifest), "utf8"),
      0o600,
    );
    await unlink(rollbackPath);
  } catch {
    return {
      status: "partial",
      root,
      manifestPath,
      installationId: manifest.installationId,
      version: snapshot.manifest.version,
      removedPaths: [],
      refusedPaths: [INSTALLATION_ROLLBACK_FILE],
      reason: "io_error_during_rollback",
    };
  }
  return {
    status: "rolled_back",
    root,
    manifestPath,
    installationId: snapshot.manifest.installationId,
    version: snapshot.manifest.version,
    removedPaths: [INSTALLATION_ROLLBACK_FILE],
    refusedPaths: [],
  };
}

/** Verify an installation without changing any files. */
export async function doctorInstallationV1(
  input: InstallationTargetInputV1,
): Promise<DoctorResultV1> {
  const root = await resolveInstallationTargetV1(input, { create: false });
  return inspectInstallation(root);
}

/**
 * Remove only files that still match the owned manifest.  Any modified,
 * replaced, or malformed owned entry stops the operation before deletion.
 */
export async function uninstallInstallationV1(
  input: InstallationTargetInputV1,
): Promise<UninstallResultV1> {
  const root = await resolveInstallationTargetV1(input, { create: false });
  const manifestPath = path.join(root, INSTALLATION_MANIFEST_FILE);
  const doctor = await inspectInstallation(root);
  if (doctor.status === "not_installed") {
    return { status: "not_installed", root, manifestPath, removedPaths: [], refusedPaths: [] };
  }
  if (doctor.status !== "healthy") {
    const refusedPaths = doctor.files
      .filter((file) => file.state !== "missing")
      .map((file) => file.path);
    return {
      status: "refused",
      root,
      manifestPath,
      removedPaths: [],
      refusedPaths,
      reason: doctor.reason ?? "installation_tampered",
    };
  }
  // Re-check immediately before unlinking so a simple concurrent edit cannot
  // turn a safe uninstall into deletion of user-modified content.
  const latest = await inspectInstallation(root);
  if (latest.status !== "healthy") {
    return {
      status: "refused",
      root,
      manifestPath,
      removedPaths: [],
      refusedPaths: latest.files
        .filter((file) => file.state !== "missing")
        .map((file) => file.path),
      reason: "owned_file_changed_during_uninstall",
    };
  }
  const manifest = await readManifestAt(root);
  if (manifest === undefined) {
    return {
      status: "refused",
      root,
      manifestPath,
      removedPaths: [],
      refusedPaths: [INSTALLATION_MANIFEST_FILE],
      reason: "manifest_schema_invalid",
    };
  }
  const removedPaths: string[] = [];
  try {
    for (const file of manifest.files) {
      const filePath = ownedAbsolutePath(root, file.path);
      await unlink(filePath);
      removedPaths.push(file.path);
    }
    if (manifest.rollback !== undefined) {
      await unlink(path.join(root, INSTALLATION_ROLLBACK_FILE));
      removedPaths.push(INSTALLATION_ROLLBACK_FILE);
    }
    await unlink(manifestPath);
  } catch {
    return {
      status: "partial",
      root,
      manifestPath,
      removedPaths,
      refusedPaths: [INSTALLATION_MANIFEST_FILE],
      reason: "io_error_during_uninstall",
    };
  }
  for (const directory of [path.join(root, "bin"), path.join(root, "config")]) {
    await rmdir(directory).catch(() => undefined);
  }
  return {
    status: "removed",
    root,
    manifestPath,
    removedPaths: [...removedPaths, INSTALLATION_MANIFEST_FILE],
    refusedPaths: [],
  };
}
