import { createHash, randomUUID } from "node:crypto";
import {
  constants,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rmdir,
  unlink,
} from "node:fs/promises";
import { hostname } from "node:os";
import path from "node:path";

import {
  buildHostMcpServerConfigV1,
  isHostAdapterId,
  isHostMcpServerConfigV1,
  type HostAdapterId,
} from "@understand-code/host-adapters";

/** The on-disk format is intentionally small and independent of MCP schemas. */
export const INSTALLATION_SCHEMA_VERSION =
  "understand-code-installation-v1" as const;
export const INSTALLATION_MARKER = "understand-code-owned-v1" as const;
export const INSTALLATION_MANIFEST_FILE = "installation-manifest.json" as const;
export const INSTALLATION_OWNER_FILE = ".understand-code-owner" as const;
export const INSTALLATION_WRAPPER_FILE = "bin/understand-code" as const;
export const INSTALLATION_CLI_BUNDLE_FILE =
  "lib/understand-code.mjs" as const;
export const INSTALLATION_NATIVE_KERNEL_PEER_FILE =
  `lib/native/${process.platform}-${process.arch}/provider_kernel_peer.node` as const;
export const INSTALLATION_CONFIG_FILE = "config/mcp.json" as const;
export const INSTALLATION_WORKBENCH_UI =
  "legacy_embedded_read_only_v1" as const;
export const INSTALLATION_REACT_WORKBENCH_UI = "react_dashboard_v1" as const;
export const INSTALLATION_DASHBOARD_MANIFEST_FILE =
  "lib/dashboard-manifest.json" as const;
export const INSTALLATION_DASHBOARD_ROOT = "lib/dashboard" as const;
/** Durable, single-level snapshot used by an explicit upgrade/rollback pair. */
export const INSTALLATION_ROLLBACK_FILE = "installation-rollback.json" as const;
/** Root-scoped lock directory used to serialize installation mutations. */
export const INSTALLATION_LIFECYCLE_LOCK_FILE =
  ".understand-code-installation.lock" as const;
export const DEFAULT_INSTALLATION_VERSION = "0.1.0" as const;

const MAX_PATH_BYTES = 4_096;
const MAX_CLI_BUNDLE_BYTES = 64 * 1024 * 1024;
const MAX_RELEASE_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_NATIVE_KERNEL_PEER_BYTES = 32 * 1024 * 1024;
const MAX_ROLLBACK_BYTES = 160 * 1024 * 1024;
const MAX_DASHBOARD_FILES = 4_096;
const MAX_DASHBOARD_FILE_BYTES = 32 * 1024 * 1024;
const MAX_DASHBOARD_TOTAL_BYTES = 96 * 1024 * 1024;
const DASHBOARD_BUNDLE_SCHEMA_VERSION =
  "understand-code-dashboard-bundle-v1" as const;
const RELEASE_MANIFEST_FILE = "release-manifest.json" as const;
const RELEASE_MANIFEST_SCHEMA_VERSION = "understand-code-alpha-release-v1" as const;
const EMBEDDED_RELEASE_IDENTITY_PATTERN =
  /^\/\* understand-code-release-v1 product=understand-code version=(?<version>[^\s*]+) \*\/$/u;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const LEGACY_OWNED_RELATIVE_FILES = Object.freeze([
  INSTALLATION_OWNER_FILE,
  INSTALLATION_WRAPPER_FILE,
  INSTALLATION_CLI_BUNDLE_FILE,
  INSTALLATION_CONFIG_FILE,
] as const);
const OWNED_RELATIVE_FILES = Object.freeze([
  INSTALLATION_OWNER_FILE,
  INSTALLATION_WRAPPER_FILE,
  INSTALLATION_CLI_BUNDLE_FILE,
  INSTALLATION_NATIVE_KERNEL_PEER_FILE,
  INSTALLATION_CONFIG_FILE,
] as const);

function ownedFileMode(
  filePath: string,
): number {
  if (
    filePath === INSTALLATION_WRAPPER_FILE ||
    filePath === INSTALLATION_CLI_BUNDLE_FILE
  ) {
    return 0o755;
  }
  return filePath === INSTALLATION_NATIVE_KERNEL_PEER_FILE ? 0o644 : 0o600;
}

export type InstallationTargetInputV1 = Readonly<{
  /** Exact installation directory. `root` and `home` are aliases. */
  root?: string;
  home?: string;
  env?: Readonly<Record<string, string | undefined>>;
}>;

export type InstallationOptionsV1 = InstallationTargetInputV1 &
  Readonly<{
    version?: string;
    /** Absolute path to the self-contained CLI file copied into the install. */
    cliBundlePath?: string;
    cliCommand?: string;
    /** Select a host-specific MCP config; omitted preserves legacy behavior. */
    host?: HostAdapterId;
    /** Explicit Provider Service installation selected for strong Host tools. */
    providerInstallationRoot?: string;
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
  path: string;
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
  /** Absent on legacy installations that used the direct CLI config. */
  host?: HostAdapterId;
  /** Absent keeps the installed Host on the read-only capability profile. */
  providerInstallationRoot?: string;
  providerInstallationIdentity?: Readonly<{ dev: string; ino: string }>;
  /** Explicitly identifies the UI inventory owned by this installation. */
  workbenchUi?:
    | typeof INSTALLATION_WORKBENCH_UI
    | typeof INSTALLATION_REACT_WORKBENCH_UI;
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
  /** Effective runtime profile of a healthy managed installation. */
  capabilityProfile?: "provider_bound" | "read_only";
  /** Whether Task/Check/Verification operations have a configured selector. */
  taskWorkflow?: "requires_provider_check" | "unavailable";
  /** Stable remediation for a Host installed without a Provider selector. */
  remediation?: "bind_provider_installation";
  /** Human-readable next step without exposing any local path or credential. */
  remediationHint?: string;
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

/**
 * Result returned by an explicit installation downgrade.
 *
 * The wire shape intentionally matches `UpgradeResultV1`: callers can use
 * the same status/rollback handling while the operation itself is exposed as
 * a distinct, direction-checked API.
 */
export type DowngradeResultV1 = UpgradeResultV1;

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
  path: string;
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

const INSTALLATION_LIFECYCLE_LOCK_OWNER_FILE = "owner.json" as const;
const INSTALLATION_LIFECYCLE_LOCK_RECOVERY_FILE =
  `${INSTALLATION_LIFECYCLE_LOCK_FILE}.recovery` as const;
const INSTALLATION_LIFECYCLE_LOCK_SCHEMA_VERSION = 1 as const;
const MAX_INSTALLATION_LIFECYCLE_LOCK_BYTES = 16 * 1024;

type InstallationLifecycleLockOwnerV1 = Readonly<{
  schemaVersion: typeof INSTALLATION_LIFECYCLE_LOCK_SCHEMA_VERSION;
  nonce: string;
  pid: number;
  hostname: string;
  acquiredAt: string;
}>;

/**
 * Identity of the canonical installation root held by a lifecycle lease.
 * Keeping this alongside the lock identity prevents a caller from resolving
 * an alias again after the lock was acquired and accidentally mutating a
 * different directory.
 */
type InstallationLifecycleRootIdentityV1 = Readonly<{
  dev: number;
  ino: number;
}>;

type InstallationLifecycleLockInspectionV1 = Readonly<{
  state: "held";
  lockPath: string;
  directoryDev: number;
  directoryIno: number;
  ownerDev: number;
  ownerIno: number;
  owner: InstallationLifecycleLockOwnerV1;
}>;

type InstallationLifecycleLockLeaseV1 = Readonly<{
  lockPath: string;
  nonce: string;
  rootDev: number;
  rootIno: number;
  directoryDev: number;
  directoryIno: number;
  ownerDev: number;
  ownerIno: number;
  release: () => Promise<void>;
}>;

type InstallationLifecycleLockAcquireResultV1 =
  | Readonly<{ status: "acquired"; lease: InstallationLifecycleLockLeaseV1 }>
  | Readonly<{ status: "busy" }>
  | Readonly<{ status: "missing" }>;

type InstallationLifecycleRecoveryClaimV1 = Readonly<{
  path: string;
  nonce: string;
  dev: number;
  ino: number;
  observedLockNonce: string;
  observedLockDev: number;
  observedLockIno: number;
}>;

function lifecycleLockPathV1(root: string): string {
  return path.join(root, INSTALLATION_LIFECYCLE_LOCK_FILE);
}

function lifecycleLockRecoveryPathV1(root: string): string {
  return path.join(root, INSTALLATION_LIFECYCLE_LOCK_RECOVERY_FILE);
}

function lifecycleLockOwnerPathV1(lockPath: string): string {
  return path.join(lockPath, INSTALLATION_LIFECYCLE_LOCK_OWNER_FILE);
}

function processDefinitelyExitedForLifecycleLockV1(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { readonly code?: unknown }).code === "ESRCH"
    );
  }
}

function isLifecycleLockOwnerV1(value: unknown): value is InstallationLifecycleLockOwnerV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (
    Object.keys(candidate).sort().join(",") !==
      "acquiredAt,hostname,nonce,pid,schemaVersion" ||
    candidate.schemaVersion !== INSTALLATION_LIFECYCLE_LOCK_SCHEMA_VERSION ||
    !isSafeText(candidate.nonce) ||
    !/^[0-9a-f-]{16,128}$/u.test(candidate.nonce) ||
    !Number.isSafeInteger(candidate.pid) ||
    (candidate.pid as number) < 1 ||
    (candidate.pid as number) > 0x7fffffff ||
    !isSafeText(candidate.hostname) ||
    !isSafeText(candidate.acquiredAt) ||
    !Number.isFinite(Date.parse(candidate.acquiredAt))
  ) {
    return false;
  }
  return true;
}

async function lifecycleLockPathExistsV1(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    // Any inaccessible or racing path is treated as present.  Callers must
    // fail closed instead of creating a lock around an unknown object.
    return true;
  }
}

async function inspectInstallationLifecycleLockV1(
  root: string,
): Promise<InstallationLifecycleLockInspectionV1 | undefined> {
  const lockPath = lifecycleLockPathV1(root);
  let directory;
  try {
    directory = await lstat(lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    return undefined;
  }
  if (
    directory.isSymbolicLink() ||
    !directory.isDirectory() ||
    // A group/world-writable lock directory would let another principal
    // replace the owner record.  Read/execute bits are harmless, but writes
    // outside the owner are not.
    (directory.mode & 0o022) !== 0
  ) {
    return undefined;
  }
  let entries: string[];
  try {
    entries = await readdir(lockPath);
  } catch {
    return undefined;
  }
  if (
    entries.length !== 1 ||
    entries[0] !== INSTALLATION_LIFECYCLE_LOCK_OWNER_FILE
  ) {
    return undefined;
  }
  const ownerPath = lifecycleLockOwnerPathV1(lockPath);
  let ownerMetadata;
  try {
    ownerMetadata = await lstat(ownerPath);
  } catch {
    return undefined;
  }
  if (
    ownerMetadata.isSymbolicLink() ||
    !ownerMetadata.isFile() ||
    (ownerMetadata.mode & 0o077) !== 0 ||
    ownerMetadata.size <= 0 ||
    ownerMetadata.size > MAX_INSTALLATION_LIFECYCLE_LOCK_BYTES
  ) {
    return undefined;
  }
  let bytes: Buffer;
  try {
    bytes = await readFile(ownerPath);
  } catch {
    return undefined;
  }
  let owner: InstallationLifecycleLockOwnerV1;
  try {
    const parsed = JSON.parse(bytes.toString("utf8")) as unknown;
    if (!isLifecycleLockOwnerV1(parsed)) return undefined;
    owner = parsed;
  } catch {
    return undefined;
  }
  // Revalidate both names after reading.  A changed inode/size means the
  // owner view is ambiguous and must never be used for recovery or release.
  let latestDirectory;
  let latestOwner;
  try {
    [latestDirectory, latestOwner] = await Promise.all([
      lstat(lockPath),
      lstat(ownerPath),
    ]);
  } catch {
    return undefined;
  }
  if (
    latestDirectory.isSymbolicLink() ||
    !latestDirectory.isDirectory() ||
    latestDirectory.dev !== directory.dev ||
    latestDirectory.ino !== directory.ino ||
    latestOwner.isSymbolicLink() ||
    !latestOwner.isFile() ||
    latestOwner.dev !== ownerMetadata.dev ||
    latestOwner.ino !== ownerMetadata.ino ||
    latestOwner.size !== ownerMetadata.size
  ) {
    return undefined;
  }
  return Object.freeze({
    state: "held" as const,
    lockPath,
    directoryDev: directory.dev,
    directoryIno: directory.ino,
    ownerDev: ownerMetadata.dev,
    ownerIno: ownerMetadata.ino,
    owner,
  });
}

async function writeInstallationLifecycleLockOwnerV1(
  lockPath: string,
  owner: InstallationLifecycleLockOwnerV1,
): Promise<void> {
  const ownerPath = lifecycleLockOwnerPathV1(lockPath);
  const noFollow =
    typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  const handle = await open(
    ownerPath,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | noFollow,
    0o600,
  );
  try {
    await handle.writeFile(canonicalJson(owner));
    await handle.chmod(0o600);
    await handle.sync();
  } finally {
    await handle.close().catch(() => undefined);
  }
}

async function assertInstallationLifecycleRootV1(
  root: string,
): Promise<InstallationLifecycleRootIdentityV1 | undefined> {
  let metadata;
  try {
    metadata = await lstat(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new InstallationLifecycleError(
      "io_error",
      "Unable to inspect installation root for lifecycle lock.",
      { root },
    );
  }
  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(root);
  } catch {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "Installation root changed while acquiring lifecycle lock.",
      { root },
    );
  }
  if (
    metadata.isSymbolicLink() ||
    !metadata.isDirectory() ||
    canonicalRoot !== root
  ) {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "Installation root changed while acquiring lifecycle lock.",
      { root },
    );
  }
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
  });
}

async function createInstallationLifecycleRecoveryClaimV1(
  root: string,
  inspected: InstallationLifecycleLockInspectionV1,
): Promise<InstallationLifecycleRecoveryClaimV1 | undefined> {
  const claimPath = lifecycleLockRecoveryPathV1(root);
  const claimNonce = randomUUID();
  const payload = {
    schemaVersion: INSTALLATION_LIFECYCLE_LOCK_SCHEMA_VERSION,
    nonce: claimNonce,
    pid: process.pid,
    hostname: hostname(),
    observedLockNonce: inspected.owner.nonce,
    observedLockDev: inspected.directoryDev,
    observedLockIno: inspected.directoryIno,
  };
  const noFollow =
    typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  let handle;
  try {
    handle = await open(
      claimPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | noFollow,
      0o600,
    );
    await handle.writeFile(canonicalJson(payload));
    await handle.chmod(0o600);
    await handle.sync();
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return undefined;
    throw new InstallationLifecycleError(
      "io_error",
      "Unable to create installation lifecycle recovery claim.",
      { root },
    );
  }
  await handle!.close().catch(() => undefined);
  try {
    const metadata = await lstat(claimPath);
    if (
      metadata.isSymbolicLink() ||
      !metadata.isFile() ||
      (metadata.mode & 0o077) !== 0
    ) {
      throw new Error("recovery_claim_invalid");
    }
    return Object.freeze({
      path: claimPath,
      nonce: claimNonce,
      dev: metadata.dev,
      ino: metadata.ino,
      observedLockNonce: inspected.owner.nonce,
      observedLockDev: inspected.directoryDev,
      observedLockIno: inspected.directoryIno,
    });
  } catch (error) {
    await unlink(claimPath).catch(() => undefined);
    if (error instanceof InstallationLifecycleError) throw error;
    throw new InstallationLifecycleError(
      "io_error",
      "Installation lifecycle recovery claim could not be verified.",
      { root },
    );
  }
}

async function releaseInstallationLifecycleRecoveryClaimV1(
  claim: InstallationLifecycleRecoveryClaimV1,
): Promise<void> {
  let metadata;
  try {
    metadata = await lstat(claim.path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw new InstallationLifecycleError(
      "installation_tampered",
      "Installation lifecycle recovery claim disappeared unexpectedly.",
    );
  }
  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    metadata.dev !== claim.dev ||
    metadata.ino !== claim.ino
  ) {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "Installation lifecycle recovery claim ownership changed.",
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(await readFile(claim.path, "utf8"));
  } catch {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "Installation lifecycle recovery claim is invalid.",
    );
  }
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value as Record<string, unknown>).sort().join(",") !==
      "hostname,nonce,observedLockDev,observedLockIno,observedLockNonce,pid,schemaVersion"
  ) {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "Installation lifecycle recovery claim is invalid.",
    );
  }
  const claimValue = value as Record<string, unknown>;
  if (
    claimValue.schemaVersion !== INSTALLATION_LIFECYCLE_LOCK_SCHEMA_VERSION ||
    claimValue.nonce !== claim.nonce ||
    claimValue.observedLockNonce !== claim.observedLockNonce ||
    claimValue.observedLockDev !== claim.observedLockDev ||
    claimValue.observedLockIno !== claim.observedLockIno
  ) {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "Installation lifecycle recovery claim changed while held.",
    );
  }
  await unlink(claim.path);
}

async function recoverDeadInstallationLifecycleLockV1(
  root: string,
  inspected: InstallationLifecycleLockInspectionV1,
): Promise<boolean> {
  if (
    inspected.owner.hostname !== hostname() ||
    !processDefinitelyExitedForLifecycleLockV1(inspected.owner.pid)
  ) {
    return false;
  }
  const claim = await createInstallationLifecycleRecoveryClaimV1(root, inspected);
  if (claim === undefined) return false;
  let releaseClaim = true;
  try {
    const latest = await inspectInstallationLifecycleLockV1(root);
    if (
      latest === undefined ||
      latest.directoryDev !== inspected.directoryDev ||
      latest.directoryIno !== inspected.directoryIno ||
      latest.ownerIno !== inspected.ownerIno ||
      latest.owner.nonce !== inspected.owner.nonce ||
      latest.owner.hostname !== hostname() ||
      !processDefinitelyExitedForLifecycleLockV1(latest.owner.pid)
    ) {
      return false;
    }
    const quarantinePath = `${inspected.lockPath}.stale-${claim.nonce}`;
    try {
      await rename(inspected.lockPath, quarantinePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      releaseClaim = false;
      return false;
    }
    let quarantineMetadata;
    try {
      quarantineMetadata = await lstat(quarantinePath);
      if (
        quarantineMetadata.isSymbolicLink() ||
        !quarantineMetadata.isDirectory() ||
        quarantineMetadata.dev !== inspected.directoryDev ||
        quarantineMetadata.ino !== inspected.directoryIno
      ) {
        releaseClaim = false;
        return false;
      }
      const entries = await readdir(quarantinePath);
      if (
        entries.length !== 1 ||
        entries[0] !== INSTALLATION_LIFECYCLE_LOCK_OWNER_FILE
      ) {
        releaseClaim = false;
        return false;
      }
      const ownerPath = lifecycleLockOwnerPathV1(quarantinePath);
      const ownerMetadata = await lstat(ownerPath);
      if (
        ownerMetadata.isSymbolicLink() ||
        !ownerMetadata.isFile() ||
        ownerMetadata.dev !== inspected.ownerDev ||
        ownerMetadata.ino !== inspected.ownerIno
      ) {
        releaseClaim = false;
        return false;
      }
      const owner = JSON.parse(await readFile(ownerPath, "utf8")) as unknown;
      if (!isLifecycleLockOwnerV1(owner) || owner.nonce !== inspected.owner.nonce) {
        releaseClaim = false;
        return false;
      }
      await unlink(ownerPath);
      await rmdir(quarantinePath);
      return true;
    } catch {
      releaseClaim = false;
      return false;
    }
  } finally {
    if (releaseClaim) {
      await releaseInstallationLifecycleRecoveryClaimV1(claim).catch(() => {
        // A failed claim cleanup is intentionally left as a durable busy
        // marker.  Future mutations must not guess whether recovery finished.
      });
    }
  }
}

async function abandonCreatedInstallationLifecycleLockV1(
  lockPath: string,
  directoryDev: number,
  directoryIno: number,
  ownerNonce: string,
  ownerPublished: boolean,
): Promise<void> {
  try {
    const directory = await lstat(lockPath);
    if (
      directory.isSymbolicLink() ||
      !directory.isDirectory() ||
      directory.dev !== directoryDev ||
      directory.ino !== directoryIno
    ) {
      return;
    }
    const entries = await readdir(lockPath);
    let removedOwner = false;
    if (
      entries.length === 1 &&
      entries[0] === INSTALLATION_LIFECYCLE_LOCK_OWNER_FILE
    ) {
      const ownerPath = lifecycleLockOwnerPathV1(lockPath);
      const ownerMetadata = await lstat(ownerPath);
      const owner = JSON.parse(await readFile(ownerPath, "utf8")) as unknown;
      if (
        ownerMetadata.isFile() &&
        !ownerMetadata.isSymbolicLink() &&
        isLifecycleLockOwnerV1(owner) &&
        owner.nonce === ownerNonce
      ) {
        await unlink(ownerPath);
        removedOwner = true;
      }
    }
    // An empty directory is safe to remove only if owner publication never
    // completed.  Once an owner was published, an empty directory is an
    // ambiguous/tampered state and must remain for Doctor to report.
    if (removedOwner || (!ownerPublished && entries.length === 0)) {
      await rmdir(lockPath);
    }
  } catch {
    // Leave any ambiguous object in place; it is safer for Doctor to report a
    // busy installation than for a failed initializer to delete another
    // process's lock.
  }
}

async function releaseInstallationLifecycleLockV1(
  lease: InstallationLifecycleLockLeaseV1,
): Promise<void> {
  const root = path.dirname(lease.lockPath);
  const rootIdentity = await assertInstallationLifecycleRootV1(root);
  if (
    rootIdentity === undefined ||
    rootIdentity.dev !== lease.rootDev ||
    rootIdentity.ino !== lease.rootIno
  ) {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "Installation root changed while releasing lifecycle lock.",
      { root },
    );
  }
  const inspected = await inspectInstallationLifecycleLockV1(
    root,
  );
  if (
    inspected === undefined ||
    inspected.directoryDev !== lease.directoryDev ||
    inspected.directoryIno !== lease.directoryIno ||
    inspected.ownerDev !== lease.ownerDev ||
    inspected.ownerIno !== lease.ownerIno ||
    inspected.owner.nonce !== lease.nonce
  ) {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "Installation lifecycle lock ownership changed while held.",
    );
  }
  if (await lifecycleLockPathExistsV1(lifecycleLockRecoveryPathV1(root))) {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "Installation lifecycle lock is under recovery.",
    );
  }
  const entries = await readdir(lease.lockPath);
  if (
    entries.length !== 1 ||
    entries[0] !== INSTALLATION_LIFECYCLE_LOCK_OWNER_FILE
  ) {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "Installation lifecycle lock contains unknown entries.",
    );
  }
  const ownerPath = lifecycleLockOwnerPathV1(lease.lockPath);
  const ownerMetadata = await lstat(ownerPath);
  if (
    ownerMetadata.isSymbolicLink() ||
    !ownerMetadata.isFile() ||
    ownerMetadata.dev !== lease.ownerDev ||
    ownerMetadata.ino !== lease.ownerIno
  ) {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "Installation lifecycle lock owner changed while releasing.",
    );
  }
  await unlink(ownerPath);
  try {
    await rmdir(lease.lockPath);
  } catch (error) {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "Installation lifecycle lock could not be released safely.",
      { root },
    );
  }
}

async function acquireInstallationLifecycleLockV1(
  root: string,
  recoveryAttempts = 0,
): Promise<InstallationLifecycleLockAcquireResultV1> {
  const rootIdentity = await assertInstallationLifecycleRootV1(root);
  if (rootIdentity === undefined) return Object.freeze({ status: "missing" as const });
  const lockPath = lifecycleLockPathV1(root);
  const recoveryPath = lifecycleLockRecoveryPathV1(root);
  // A recovery claim is itself an exclusive, owner-only gate.  Its presence
  // is always busy, including malformed/partial records left by a crash.
  if (await lifecycleLockPathExistsV1(recoveryPath)) {
    return Object.freeze({ status: "busy" as const });
  }
  try {
    await mkdir(lockPath, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw new InstallationLifecycleError(
        "io_error",
        "Unable to create installation lifecycle lock.",
        { root },
      );
    }
    const existing = await inspectInstallationLifecycleLockV1(root);
    if (
      existing !== undefined &&
      existing.owner.hostname === hostname() &&
      processDefinitelyExitedForLifecycleLockV1(existing.owner.pid) &&
      recoveryAttempts < 2 &&
      (await recoverDeadInstallationLifecycleLockV1(root, existing))
    ) {
      return acquireInstallationLifecycleLockV1(root, recoveryAttempts + 1);
    }
    return Object.freeze({ status: "busy" as const });
  }

  let directoryMetadata;
  let ownerPublished = false;
  const owner = Object.freeze({
    schemaVersion: INSTALLATION_LIFECYCLE_LOCK_SCHEMA_VERSION,
    nonce: randomUUID(),
    pid: process.pid,
    hostname: hostname(),
    acquiredAt: new Date().toISOString(),
  });
  try {
    const currentRootIdentity = await assertInstallationLifecycleRootV1(root);
    if (
      currentRootIdentity === undefined ||
      currentRootIdentity.dev !== rootIdentity.dev ||
      currentRootIdentity.ino !== rootIdentity.ino
    ) {
      throw new InstallationLifecycleError(
        "installation_tampered",
        "Installation root changed while acquiring lifecycle lock.",
        { root },
      );
    }
    directoryMetadata = await lstat(lockPath);
    if (
      directoryMetadata.isSymbolicLink() ||
      !directoryMetadata.isDirectory() ||
      (directoryMetadata.mode & 0o022) !== 0
    ) {
      throw new Error("lifecycle_lock_directory_invalid");
    }
    await writeInstallationLifecycleLockOwnerV1(lockPath, owner);
    ownerPublished = true;
    const inspected = await inspectInstallationLifecycleLockV1(root);
    if (
      inspected === undefined ||
      inspected.directoryDev !== directoryMetadata.dev ||
      inspected.directoryIno !== directoryMetadata.ino ||
      inspected.owner.nonce !== owner.nonce
    ) {
      throw new Error("lifecycle_lock_owner_not_established");
    }
    let released = false;
    const lease: InstallationLifecycleLockLeaseV1 = {
      lockPath,
      nonce: owner.nonce,
      rootDev: rootIdentity.dev,
      rootIno: rootIdentity.ino,
      directoryDev: inspected.directoryDev,
      directoryIno: inspected.directoryIno,
      ownerDev: inspected.ownerDev,
      ownerIno: inspected.ownerIno,
      release: async () => {
        if (released) return;
        await releaseInstallationLifecycleLockV1(lease);
        released = true;
      },
    };
    return Object.freeze({ status: "acquired" as const, lease });
  } catch (error) {
    if (directoryMetadata !== undefined) {
      await abandonCreatedInstallationLifecycleLockV1(
        lockPath,
        directoryMetadata.dev,
        directoryMetadata.ino,
        owner.nonce,
        ownerPublished,
      );
    }
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return Object.freeze({ status: "busy" as const });
    }
    // Any failure after the directory became visible is intentionally mapped
    // to a conservative busy result if cleanup could not prove ownership.
    if (error instanceof Error && error.message.startsWith("lifecycle_lock_")) {
      return Object.freeze({ status: "busy" as const });
    }
    throw new InstallationLifecycleError(
      "io_error",
      "Unable to initialize installation lifecycle lock.",
      { root },
    );
  }
}

/**
 * Run one mutation while retaining the original operation error if cleanup
 * itself encounters a tamper/race.  A successful operation still surfaces a
 * release failure, so callers never mistake an uncleared lock for success.
 */
async function withInstallationLifecycleLockV1<T>(
  lease: InstallationLifecycleLockLeaseV1,
  operation: () => Promise<T>,
): Promise<T> {
  let operationError: unknown;
  try {
    const root = path.dirname(lease.lockPath);
    const rootIdentity = await assertInstallationLifecycleRootV1(root);
    if (
      rootIdentity === undefined ||
      rootIdentity.dev !== lease.rootDev ||
      rootIdentity.ino !== lease.rootIno
    ) {
      throw new InstallationLifecycleError(
        "installation_tampered",
        "Installation root changed while lifecycle lock was held.",
        { root },
      );
    }
    return await operation();
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    try {
      await lease.release();
    } catch (releaseError) {
      if (operationError === undefined) throw releaseError;
      if (operationError instanceof Error && !("cause" in operationError)) {
        Object.defineProperty(operationError, "cause", {
          configurable: true,
          enumerable: false,
          value: releaseError,
          writable: false,
        });
      }
    }
  }
}

type ComparableInstallationVersionV1 = Readonly<{
  major: string;
  minor: string;
  patch: string;
  prerelease: readonly string[] | undefined;
}>;

const INSTALLATION_SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

/**
 * Parse only the release-version form used by published installation
 * artifacts.  A downgrade must never guess ordering for legacy/free-form
 * version labels, so unknown forms return `undefined` and are refused.
 */
function comparableInstallationVersion(
  value: string,
): ComparableInstallationVersionV1 | undefined {
  const match = INSTALLATION_SEMVER_PATTERN.exec(value);
  if (match === null) return undefined;
  const prerelease = match[4] === undefined ? undefined : match[4].split(".");
  if (
    prerelease?.some(
      (identifier) =>
        identifier.length === 0 ||
        (/^\d+$/u.test(identifier) && identifier.length > 1 && identifier.startsWith("0")),
    )
  ) {
    return undefined;
  }
  return {
    major: match[1]!,
    minor: match[2]!,
    patch: match[3]!,
    prerelease,
  };
}

function compareNumericVersionIdentifier(left: string, right: string): number {
  // Core identifiers do not have leading zeroes; stripping them here also
  // keeps comparison safe for very large (but otherwise valid) identifiers.
  const normalizedLeft = left.replace(/^0+(?=\d)/u, "");
  const normalizedRight = right.replace(/^0+(?=\d)/u, "");
  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length < normalizedRight.length ? -1 : 1;
  }
  if (normalizedLeft === normalizedRight) return 0;
  return normalizedLeft < normalizedRight ? -1 : 1;
}

function compareInstallationVersions(
  left: string,
  right: string,
): number | undefined {
  const parsedLeft = comparableInstallationVersion(left);
  const parsedRight = comparableInstallationVersion(right);
  if (parsedLeft === undefined || parsedRight === undefined) return undefined;
  for (const component of ["major", "minor", "patch"] as const) {
    const comparison = compareNumericVersionIdentifier(
      parsedLeft[component],
      parsedRight[component],
    );
    if (comparison !== 0) return comparison;
  }
  const leftPrerelease = parsedLeft.prerelease;
  const rightPrerelease = parsedRight.prerelease;
  if (leftPrerelease === undefined && rightPrerelease === undefined) return 0;
  // A release without a prerelease suffix has higher precedence.
  if (leftPrerelease === undefined) return 1;
  if (rightPrerelease === undefined) return -1;
  const length = Math.max(leftPrerelease.length, rightPrerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = leftPrerelease[index];
    const rightIdentifier = rightPrerelease[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    if (leftIdentifier === rightIdentifier) continue;
    const leftNumeric = /^\d+$/u.test(leftIdentifier);
    const rightNumeric = /^\d+$/u.test(rightIdentifier);
    if (leftNumeric && rightNumeric) {
      return compareNumericVersionIdentifier(leftIdentifier, rightIdentifier);
    }
    // Numeric prerelease identifiers have lower precedence than non-numeric
    // identifiers; otherwise compare ASCII identifiers deterministically.
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftIdentifier < rightIdentifier ? -1 : 1;
  }
  return 0;
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

async function resolveProviderInstallationRootV1(
  value: string,
): Promise<string> {
  const normalized = normalizedCandidate(value);
  if (normalized === undefined) {
    throw new InstallationLifecycleError(
      "invalid_target",
      "Provider installation root must be an absolute, non-root path without control characters.",
    );
  }
  try {
    const metadata = await lstat(normalized);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new InstallationLifecycleError(
        "invalid_target",
        "Provider installation root must be a real directory, not a symlink or file.",
      );
    }
    return await realCanonicalPath(normalized);
  } catch (error) {
    if (error instanceof InstallationLifecycleError) throw error;
    throw new InstallationLifecycleError(
      "invalid_target",
      "Provider installation root is unavailable.",
    );
  }
}

async function realCanonicalPath(value: string): Promise<string> {
  return realpath(value);
}

function digest(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

type CliInstallationAssetsV1 = Readonly<{
  cliBundle: Buffer;
  nativeKernelPeer: Buffer;
  workbenchUi:
    | typeof INSTALLATION_WORKBENCH_UI
    | typeof INSTALLATION_REACT_WORKBENCH_UI;
  dashboardFiles: ReadonlyMap<string, Buffer>;
}>;

function nativeKernelPeerBinaryIsValid(bytes: Uint8Array): boolean {
  if (
    bytes.byteLength < 64 ||
    bytes.byteLength > MAX_NATIVE_KERNEL_PEER_BYTES ||
    (process.arch !== "arm64" && process.arch !== "x64")
  ) {
    return false;
  }
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (process.platform === "darwin") {
    const expectedCpu = process.arch === "arm64" ? 0x0100000c : 0x01000007;
    return (
      view.subarray(0, 4).equals(Buffer.from([0xcf, 0xfa, 0xed, 0xfe])) &&
      view.readUInt32LE(4) === expectedCpu
    );
  }
  if (process.platform === "linux") {
    const expectedMachine = process.arch === "arm64" ? 183 : 62;
    return (
      view.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) &&
      view[4] === 2 &&
      view[5] === 1 &&
      view.readUInt16LE(18) === expectedMachine
    );
  }
  return false;
}

async function readNativeKernelPeerAsset(
  canonicalCliBundlePath: string,
): Promise<Buffer> {
  if (
    (process.platform !== "darwin" && process.platform !== "linux") ||
    (process.arch !== "arm64" && process.arch !== "x64")
  ) {
    throw new InstallationLifecycleError(
      "invalid_target",
      "The provider kernel-peer native asset does not support this platform tuple.",
    );
  }
  const tuple = `${process.platform}-${process.arch}`;
  const nativeRoot = path.join(path.dirname(canonicalCliBundlePath), "native");
  const tupleRoot = path.join(nativeRoot, tuple);
  const sourcePath = path.join(tupleRoot, "provider_kernel_peer.node");
  try {
    for (const directory of [nativeRoot, tupleRoot]) {
      const metadata = await lstat(directory);
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw new InstallationLifecycleError(
          "invalid_target",
          "The provider kernel-peer native source inventory is unsafe.",
        );
      }
      if ((await realpath(directory)) !== directory) {
        throw new InstallationLifecycleError(
          "invalid_target",
          "The provider kernel-peer native source inventory is non-canonical.",
        );
      }
    }
    const tuples = await readdir(nativeRoot);
    const files = await readdir(tupleRoot);
    if (
      tuples.length !== 1 ||
      tuples[0] !== tuple ||
      files.length !== 1 ||
      files[0] !== "provider_kernel_peer.node"
    ) {
      throw new InstallationLifecycleError(
        "invalid_target",
        "The provider kernel-peer native source must contain exactly the current platform tuple.",
      );
    }
    const sourceMetadata = await lstat(sourcePath);
    if (sourceMetadata.isSymbolicLink() || !sourceMetadata.isFile()) {
      throw new InstallationLifecycleError(
        "invalid_target",
        "The provider kernel-peer native source must be a regular non-symlink file.",
      );
    }
    const handle = await open(
      sourcePath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const metadata = await handle.stat();
      if (
        !metadata.isFile() ||
        metadata.size < 64 ||
        metadata.size > MAX_NATIVE_KERNEL_PEER_BYTES
      ) {
        throw new InstallationLifecycleError(
          "invalid_target",
          "The provider kernel-peer native source must be a bounded regular file.",
        );
      }
      const bytes = await handle.readFile();
      if (!nativeKernelPeerBinaryIsValid(bytes)) {
        throw new InstallationLifecycleError(
          "invalid_target",
          "The provider kernel-peer native source does not match the current platform tuple.",
        );
      }
      return bytes;
    } finally {
      await handle.close().catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof InstallationLifecycleError) throw error;
    throw new InstallationLifecycleError(
      "invalid_target",
      "The provider kernel-peer native source is unavailable.",
    );
  }
}

type DashboardInventoryEntryV1 = Readonly<{
  path: string;
  sha256: string;
  bytes: number;
}>;

type DashboardBundleManifestV1 = Readonly<{
  schemaVersion: typeof DASHBOARD_BUNDLE_SCHEMA_VERSION;
  productVersion: string;
  root: "dashboard";
  fileCount: number;
  inventorySha256: string;
}>;

function parseDashboardBundleManifest(
  value: unknown,
  productVersion: string,
): DashboardBundleManifestV1 | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (
    Object.keys(candidate).sort().join(",") !==
      "fileCount,inventorySha256,productVersion,root,schemaVersion" ||
    candidate.schemaVersion !== DASHBOARD_BUNDLE_SCHEMA_VERSION ||
    candidate.productVersion !== productVersion ||
    candidate.root !== "dashboard" ||
    typeof candidate.fileCount !== "number" ||
    !Number.isSafeInteger(candidate.fileCount) ||
    candidate.fileCount < 1 ||
    candidate.fileCount > MAX_DASHBOARD_FILES ||
    typeof candidate.inventorySha256 !== "string" ||
    !HASH_PATTERN.test(candidate.inventorySha256)
  ) {
    return undefined;
  }
  return {
    schemaVersion: DASHBOARD_BUNDLE_SCHEMA_VERSION,
    productVersion,
    root: "dashboard",
    fileCount: candidate.fileCount,
    inventorySha256: candidate.inventorySha256,
  };
}

function safeDashboardRelativePath(value: string): boolean {
  return (
    isSafeText(value) &&
    !path.isAbsolute(value) &&
    !value.includes("\\") &&
    value.split("/").every(
      (segment) => segment !== "" && segment !== "." && segment !== "..",
    )
  );
}

async function optionalPathMetadata(
  filePath: string,
): Promise<Awaited<ReturnType<typeof lstat>> | undefined> {
  try {
    return await lstat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function readDashboardAssets(
  canonicalCliBundlePath: string,
  productVersion: string,
): Promise<Readonly<{
  workbenchUi:
    | typeof INSTALLATION_WORKBENCH_UI
    | typeof INSTALLATION_REACT_WORKBENCH_UI;
  files: ReadonlyMap<string, Buffer>;
}>> {
  const sourceRoot = path.dirname(canonicalCliBundlePath);
  const dashboardRoot = path.join(sourceRoot, "dashboard");
  const dashboardManifestPath = path.join(
    sourceRoot,
    "dashboard-manifest.json",
  );
  const [rootMetadata, manifestMetadata] = await Promise.all([
    optionalPathMetadata(dashboardRoot),
    optionalPathMetadata(dashboardManifestPath),
  ]);
  if (rootMetadata === undefined && manifestMetadata === undefined) {
    return {
      workbenchUi: INSTALLATION_WORKBENCH_UI,
      files: new Map(),
    };
  }
  if (
    rootMetadata === undefined ||
    manifestMetadata === undefined ||
    rootMetadata.isSymbolicLink() ||
    !rootMetadata.isDirectory() ||
    manifestMetadata.isSymbolicLink() ||
    !manifestMetadata.isFile() ||
    (await realpath(dashboardRoot)) !== dashboardRoot ||
    (await realpath(dashboardManifestPath)) !== dashboardManifestPath
  ) {
    throw new InstallationLifecycleError(
      "invalid_target",
      "The React Dashboard source inventory is incomplete or unsafe.",
    );
  }

  let manifestBytes: Buffer;
  let manifest: DashboardBundleManifestV1 | undefined;
  try {
    const handle = await open(
      dashboardManifestPath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile() || metadata.size <= 0 || metadata.size > 64 * 1024) {
        throw new Error("dashboard_manifest_size_invalid");
      }
      manifestBytes = await handle.readFile();
    } finally {
      await handle.close().catch(() => undefined);
    }
    manifest = parseDashboardBundleManifest(
      JSON.parse(manifestBytes.toString("utf8")),
      productVersion,
    );
  } catch {
    manifest = undefined;
    manifestBytes = Buffer.alloc(0);
  }
  if (manifest === undefined) {
    throw new InstallationLifecycleError(
      "invalid_target",
      "The React Dashboard source manifest is invalid.",
    );
  }

  const inventory: DashboardInventoryEntryV1[] = [];
  const files = new Map<string, Buffer>();
  let totalBytes = 0;
  const walk = async (
    directory: string,
    relativeDirectory: string,
  ): Promise<void> => {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const child of children) {
      const relativePath =
        relativeDirectory === ""
          ? child.name
          : `${relativeDirectory}/${child.name}`;
      if (!safeDashboardRelativePath(relativePath)) {
        throw new Error("dashboard_path_invalid");
      }
      const absolutePath = path.join(directory, child.name);
      const metadata = await lstat(absolutePath);
      if (metadata.isSymbolicLink()) throw new Error("dashboard_symlink");
      if (metadata.isDirectory()) {
        if ((await realpath(absolutePath)) !== absolutePath) {
          throw new Error("dashboard_directory_noncanonical");
        }
        await walk(absolutePath, relativePath);
        continue;
      }
      if (
        !metadata.isFile() ||
        metadata.size > MAX_DASHBOARD_FILE_BYTES ||
        inventory.length >= MAX_DASHBOARD_FILES
      ) {
        throw new Error("dashboard_file_invalid");
      }
      const handle = await open(
        absolutePath,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      let bytes: Buffer;
      try {
        const openedMetadata = await handle.stat();
        if (
          !openedMetadata.isFile() ||
          openedMetadata.size > MAX_DASHBOARD_FILE_BYTES
        ) {
          throw new Error("dashboard_file_invalid");
        }
        bytes = await handle.readFile();
      } finally {
        await handle.close().catch(() => undefined);
      }
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_DASHBOARD_TOTAL_BYTES) {
        throw new Error("dashboard_too_large");
      }
      inventory.push({
        path: relativePath,
        sha256: digest(bytes),
        bytes: bytes.byteLength,
      });
      files.set(`${INSTALLATION_DASHBOARD_ROOT}/${relativePath}`, bytes);
    }
  };
  try {
    await walk(dashboardRoot, "");
  } catch (error) {
    if (error instanceof InstallationLifecycleError) throw error;
    throw new InstallationLifecycleError(
      "invalid_target",
      "The React Dashboard source inventory is invalid.",
    );
  }
  inventory.sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
  if (
    inventory.length !== manifest.fileCount ||
    !files.has(`${INSTALLATION_DASHBOARD_ROOT}/index.html`) ||
    digest(Buffer.from(JSON.stringify(inventory), "utf8")) !==
      manifest.inventorySha256
  ) {
    throw new InstallationLifecycleError(
      "invalid_target",
      "The React Dashboard source inventory does not match its manifest.",
    );
  }
  files.set(INSTALLATION_DASHBOARD_MANIFEST_FILE, manifestBytes);
  return {
    workbenchUi: INSTALLATION_REACT_WORKBENCH_UI,
    files,
  };
}

/**
 * Read the release identity emitted by the bundle builder.  The identity is
 * deliberately a short, deterministic header rather than an attempt to
 * execute an untrusted candidate just to discover its version.  `undefined`
 * means a legacy fixture/bundle with no identity header; `null` means an
 * identity-looking header was present but malformed.
 */
function embeddedReleaseVersion(
  bytes: Uint8Array,
): string | null | undefined {
  const prefix = Buffer.from(bytes.subarray(0, 4_096)).toString("utf8");
  const identityLine = prefix
    .split(/\r?\n/u)
    .slice(0, 8)
    .find((line) => line.startsWith("/* understand-code-release-v1"));
  if (identityLine === undefined) return undefined;
  const match = EMBEDDED_RELEASE_IDENTITY_PATTERN.exec(identityLine);
  const version = match?.groups?.version;
  if (version === undefined || !INSTALLATION_SEMVER_PATTERN.test(version)) {
    return null;
  }
  return version;
}

/**
 * A Preview distribution places its release manifest beside the CLI bundle.
 * Validate it when present so a caller cannot accidentally pair a bundle from
 * one release with the version/native assets from another.  Older test and
 * embedders may omit the sidecar; downgrade still requires the embedded
 * identity header below, while ordinary legacy installs remain compatible.
 */
async function validateAdjacentReleaseManifest(
  canonicalCliBundlePath: string,
  productVersion: string,
  cliBundle: Uint8Array,
  nativeKernelPeer: Uint8Array,
): Promise<void> {
  const manifestPath = path.join(
    path.dirname(canonicalCliBundlePath),
    RELEASE_MANIFEST_FILE,
  );
  let metadata;
  try {
    metadata = await lstat(manifestPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw new InstallationLifecycleError(
      "invalid_target",
      "The adjacent release manifest is unavailable.",
    );
  }
  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    metadata.size <= 0 ||
    metadata.size > MAX_RELEASE_MANIFEST_BYTES
  ) {
    throw new InstallationLifecycleError(
      "invalid_target",
      "The adjacent release manifest is invalid.",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  } catch {
    throw new InstallationLifecycleError(
      "invalid_target",
      "The adjacent release manifest is invalid.",
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new InstallationLifecycleError(
      "invalid_target",
      "The adjacent release manifest is invalid.",
    );
  }
  const candidate = parsed as Record<string, unknown>;
  const packageValue = candidate.package;
  const cliValue = candidate.cli;
  const nativeValue = candidate.native;
  const packageRecord =
    packageValue !== null &&
    typeof packageValue === "object" &&
    !Array.isArray(packageValue)
      ? (packageValue as Record<string, unknown>)
      : undefined;
  const cliRecord =
    cliValue !== null &&
    typeof cliValue === "object" &&
    !Array.isArray(cliValue)
      ? (cliValue as Record<string, unknown>)
      : undefined;
  const nativeRecord =
    nativeValue !== null &&
    typeof nativeValue === "object" &&
    !Array.isArray(nativeValue)
      ? (nativeValue as Record<string, unknown>)
      : undefined;
  const expectedNativeTuple = `${process.platform}-${process.arch}`;
  if (
    candidate.schemaVersion !== RELEASE_MANIFEST_SCHEMA_VERSION ||
    candidate.product !== "understand-code" ||
    packageRecord?.version !== productVersion ||
    typeof cliRecord?.sha256 !== "string" ||
    cliRecord.sha256 !== digest(cliBundle) ||
    nativeRecord?.tuple !== expectedNativeTuple ||
    typeof nativeRecord.sha256 !== "string" ||
    nativeRecord.sha256 !== digest(nativeKernelPeer)
  ) {
    throw new InstallationLifecycleError(
      "invalid_target",
      "The release manifest does not match the requested CLI bundle.",
    );
  }
}

async function readCliBundle(
  sourcePath: string | undefined,
  productVersion: string,
  options: Readonly<{ requireReleaseIdentity?: boolean }> = {},
): Promise<CliInstallationAssetsV1> {
  const candidate = sourcePath ?? process.argv[1];
  const normalized = normalizedCandidate(candidate);
  if (normalized === undefined) {
    throw new InstallationLifecycleError(
      "invalid_target",
      "A self-contained CLI bundle path is required for installation.",
    );
  }
  let canonical: string;
  try {
    canonical = await realpath(normalized);
  } catch {
    throw new InstallationLifecycleError(
      "invalid_target",
      "The self-contained CLI bundle is unavailable.",
    );
  }
  let handle;
  try {
    handle = await open(
      canonical,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    const metadata = await handle.stat();
    if (
      !metadata.isFile() ||
      metadata.size <= 0 ||
      metadata.size > MAX_CLI_BUNDLE_BYTES
    ) {
      throw new InstallationLifecycleError(
        "invalid_target",
        "The self-contained CLI bundle must be a bounded regular file.",
      );
    }
    const bytes = await handle.readFile();
    if (
      !bytes.subarray(0, 20).toString("utf8").startsWith("#!/usr/bin/env node") ||
      !bytes.includes(INSTALLATION_MARKER)
    ) {
      throw new InstallationLifecycleError(
        "invalid_target",
        "The self-contained CLI bundle identity is invalid.",
      );
    }
    const embeddedVersion = embeddedReleaseVersion(bytes);
    if (
      embeddedVersion === null ||
      (embeddedVersion !== undefined && embeddedVersion !== productVersion) ||
      (options.requireReleaseIdentity === true && embeddedVersion === undefined)
    ) {
      throw new InstallationLifecycleError(
        "invalid_target",
        "The self-contained CLI bundle release identity does not match the requested version.",
      );
    }
    const nativeKernelPeer = await readNativeKernelPeerAsset(canonical);
    await validateAdjacentReleaseManifest(
      canonical,
      productVersion,
      bytes,
      nativeKernelPeer,
    );
    const dashboard = await readDashboardAssets(canonical, productVersion);
    return {
      cliBundle: bytes,
      nativeKernelPeer,
      workbenchUi: dashboard.workbenchUi,
      dashboardFiles: dashboard.files,
    };
  } catch (error) {
    if (error instanceof InstallationLifecycleError) throw error;
    throw new InstallationLifecycleError(
      "io_error",
      "Unable to read the self-contained CLI bundle.",
    );
  } finally {
    await handle?.close().catch(() => undefined);
  }
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
    ((OWNED_RELATIVE_FILES as readonly string[]).includes(normalized) ||
      normalized === INSTALLATION_DASHBOARD_MANIFEST_FILE ||
      (normalized.startsWith(`${INSTALLATION_DASHBOARD_ROOT}/`) &&
        safeDashboardRelativePath(
          normalized.slice(INSTALLATION_DASHBOARD_ROOT.length + 1),
        )))
  );
}

function hasExactOwnedPathSet(
  paths: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    paths.length === expected.length &&
    new Set(paths).size === expected.length &&
    expected.every((filePath) => paths.includes(filePath))
  );
}

function isLegacyManifest(
  manifest: InstallationManifestV1,
): boolean {
  return hasExactOwnedPathSet(
    manifest.files.map((file) => file.path),
    LEGACY_OWNED_RELATIVE_FILES,
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

function wrapperContent(
  installationId: string,
  host: HostAdapterId | undefined,
  providerInstallationRoot: string | undefined,
): string {
  const lines = [
    "#!/bin/sh",
    `# ${INSTALLATION_MARKER}`,
    `# installation-id: ${installationId}`,
    "set -eu",
    'install_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)',
    `cli="$install_root/${INSTALLATION_CLI_BUNDLE_FILE}"`,
  ];
  if (host === undefined) {
    lines.push('exec "$cli" "$@"');
  } else {
    // Host configs call this owned wrapper with the adapter's two-argument
    // contract.  The wrapper supplies the stdio MCP verb so the installed
    // artifact is runnable without a separately installed host-adapter bin.
    lines.push(
      'if [ "$#" -ne 2 ] || [ "$1" != "--root" ] || [ -z "$2" ]; then',
      '  echo workspace_root_required >&2',
      "  exit 2",
      "fi",
      'case "$2" in',
      "  /*) ;;",
      "  *) echo workspace_root_required >&2; exit 2 ;;",
      "esac",
    );
    if (providerInstallationRoot === undefined) {
      lines.push('exec "$cli" mcp --stdio --root "$2"');
    } else {
      lines.push(
        'exec "$cli" mcp --stdio --root "$2" --installation-root "$install_root"',
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}

function configContent(
  root: string,
  installationId: string,
  command: string,
  host: HostAdapterId | undefined,
  providerInstallationRoot: string | undefined,
  providerInstallationIdentity?: Readonly<{ dev: string; ino: string }>,
): string {
  const hostProjection =
    host === undefined
      ? undefined
      : buildHostMcpServerConfigV1(host, command);
  if (
    hostProjection !== undefined &&
    host !== undefined &&
    !isHostMcpServerConfigV1(hostProjection, host, command)
  ) {
    throw new InstallationLifecycleError(
      "manifest_invalid",
      "Host adapter produced an invalid MCP configuration.",
      { host },
    );
  }
  return canonicalJson({
    schemaVersion: INSTALLATION_SCHEMA_VERSION,
    marker: INSTALLATION_MARKER,
    installationId,
    ...(providerInstallationRoot === undefined
      ? {}
      : { providerInstallationRoot }),
    ...(providerInstallationIdentity === undefined ? {} : { providerInstallationIdentity }),
    ...(hostProjection === undefined
      ? {
          mcpServers: {
              "understand-code": {
              command,
              args: ["mcp", "--stdio", "--root", "${WORKSPACE_ROOT}"],
            },
          },
        }
      : hostProjection),
    installationRoot: root,
  });
}

function manifestFor(
  root: string,
  version: string,
  installationId: string,
  fileBytes: ReadonlyMap<string, Uint8Array>,
  workbenchUi:
    | typeof INSTALLATION_WORKBENCH_UI
    | typeof INSTALLATION_REACT_WORKBENCH_UI,
  host?: HostAdapterId,
  providerInstallationRoot?: string,
  providerInstallationIdentity?: Readonly<{ dev: string; ino: string }>,
  rollback?: InstallationRollbackDescriptorV1,
): InstallationManifestV1 {
  const dashboardPaths = [...fileBytes.keys()]
    .filter(
      (filePath) =>
        filePath === INSTALLATION_DASHBOARD_MANIFEST_FILE ||
        filePath.startsWith(`${INSTALLATION_DASHBOARD_ROOT}/`),
    )
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  const ownedPaths = [...OWNED_RELATIVE_FILES, ...dashboardPaths];
  return {
    schemaVersion: INSTALLATION_SCHEMA_VERSION,
    product: "understand-code",
    version,
    root,
    installationId,
    marker: INSTALLATION_MARKER,
    ...(host === undefined ? {} : { host }),
    ...(providerInstallationRoot === undefined
      ? {}
      : { providerInstallationRoot }),
    ...(providerInstallationIdentity === undefined ? {} : { providerInstallationIdentity }),
    workbenchUi,
    files: ownedPaths.map((filePath) => ({
      path: filePath,
      sha256: digest(fileBytes.get(filePath)!),
      mode: ownedFileMode(filePath),
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
    candidate.files.length < LEGACY_OWNED_RELATIVE_FILES.length ||
    candidate.files.length >
      OWNED_RELATIVE_FILES.length + MAX_DASHBOARD_FILES + 1
  ) {
    return undefined;
  }
  const rollbackValue = candidate.rollback;
  const rollback =
    rollbackValue === undefined
      ? undefined
      : parseRollbackDescriptor(rollbackValue);
  if (rollbackValue !== undefined && rollback === undefined) return undefined;
  const hostValue = candidate.host;
  const parsedHost =
    hostValue === undefined
      ? undefined
      : isHostAdapterId(hostValue)
        ? hostValue
        : undefined;
  if (hostValue !== undefined && parsedHost === undefined) return undefined;
  const providerInstallationRootValue = candidate.providerInstallationRoot;
  const parsedProviderInstallationRoot =
    providerInstallationRootValue === undefined
      ? undefined
      : normalizedCandidate(providerInstallationRootValue);
  const providerIdentityValue = candidate.providerInstallationIdentity;
  const parsedProviderInstallationIdentity =
    providerIdentityValue !== null && typeof providerIdentityValue === "object" &&
    !Array.isArray(providerIdentityValue) &&
    Object.keys(providerIdentityValue).sort().join("\u0000") === "dev\u0000ino" &&
    typeof (providerIdentityValue as Record<string, unknown>).dev === "string" &&
    /^\d+$/u.test((providerIdentityValue as Record<string, unknown>).dev as string) &&
    typeof (providerIdentityValue as Record<string, unknown>).ino === "string" &&
    /^\d+$/u.test((providerIdentityValue as Record<string, unknown>).ino as string)
      ? { dev: (providerIdentityValue as Record<string, string>).dev!, ino: (providerIdentityValue as Record<string, string>).ino! }
      : undefined;
  if (
    (providerInstallationRootValue !== undefined &&
      (parsedProviderInstallationRoot === undefined ||
        parsedProviderInstallationRoot !== providerInstallationRootValue)) ||
    (parsedProviderInstallationRoot !== undefined && parsedHost === undefined) ||
    (parsedProviderInstallationRoot !== undefined && parsedProviderInstallationIdentity === undefined) ||
    (parsedProviderInstallationRoot === undefined && providerIdentityValue !== undefined)
  ) {
    return undefined;
  }
  const workbenchUiValue = candidate.workbenchUi;
  if (
    workbenchUiValue !== undefined &&
    workbenchUiValue !== INSTALLATION_WORKBENCH_UI &&
    workbenchUiValue !== INSTALLATION_REACT_WORKBENCH_UI
  ) return undefined;
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
      path: file.path,
      sha256: file.sha256,
      mode: file.mode,
      owner: INSTALLATION_MARKER,
    });
  }
  const paths = files.map((file) => file.path);
  const legacyShape =
    hasExactOwnedPathSet(paths, LEGACY_OWNED_RELATIVE_FILES) ||
    hasExactOwnedPathSet(paths, OWNED_RELATIVE_FILES);
  const dashboardPaths = paths.filter((filePath) =>
    filePath.startsWith(`${INSTALLATION_DASHBOARD_ROOT}/`),
  );
  const reactShape =
    workbenchUiValue === INSTALLATION_REACT_WORKBENCH_UI &&
    dashboardPaths.length >= 1 &&
    dashboardPaths.length <= MAX_DASHBOARD_FILES &&
    paths.length === OWNED_RELATIVE_FILES.length + dashboardPaths.length + 1 &&
    new Set(paths).size === paths.length &&
    OWNED_RELATIVE_FILES.every((filePath) => paths.includes(filePath)) &&
    paths.includes(INSTALLATION_DASHBOARD_MANIFEST_FILE) &&
    dashboardPaths.includes(`${INSTALLATION_DASHBOARD_ROOT}/index.html`);
  if (
    (!legacyShape && !reactShape) ||
    (legacyShape && workbenchUiValue === INSTALLATION_REACT_WORKBENCH_UI) ||
    (reactShape && workbenchUiValue !== INSTALLATION_REACT_WORKBENCH_UI)
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
    ...(parsedHost === undefined ? {} : { host: parsedHost }),
    ...(parsedProviderInstallationRoot === undefined
      ? {}
      : { providerInstallationRoot: parsedProviderInstallationRoot }),
    ...(parsedProviderInstallationIdentity === undefined ? {} : {
      providerInstallationIdentity: parsedProviderInstallationIdentity,
    }),
    ...(workbenchUiValue === INSTALLATION_WORKBENCH_UI
      ? { workbenchUi: INSTALLATION_WORKBENCH_UI }
      : workbenchUiValue === INSTALLATION_REACT_WORKBENCH_UI
        ? { workbenchUi: INSTALLATION_REACT_WORKBENCH_UI }
        : {}),
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
  if (
    typeof value !== "string" ||
    value.length % 4 !== 0 ||
    value.length > MAX_ROLLBACK_BYTES * 2
  ) {
    return false;
  }
  if (value.length === 0) return true;
  // Avoid a repeated-group RegExp here: a real self-contained CLI produces a
  // multi-megabyte snapshot field that can exhaust the JavaScript RegExp stack.
  let payloadLength = value.length;
  if (value.endsWith("=")) payloadLength -= 1;
  if (value.endsWith("==")) payloadLength -= 1;
  if (payloadLength < 2 || value.length - payloadLength > 2) return false;
  for (let index = 0; index < payloadLength; index += 1) {
    const code = value.charCodeAt(index);
    const allowed =
      (code >= 0x41 && code <= 0x5a) ||
      (code >= 0x61 && code <= 0x7a) ||
      (code >= 0x30 && code <= 0x39) ||
      code === 0x2b ||
      code === 0x2f;
    if (!allowed) return false;
  }
  for (let index = payloadLength; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 0x3d) return false;
  }
  return true;
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
    candidate.files.length !== manifest.files.length
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
      path: file.path,
      sha256: file.sha256,
      mode: file.mode,
      owner: INSTALLATION_MARKER,
      base64: file.base64,
    });
  }
  const paths = files.map((file) => file.path);
  const expectedPaths = manifest.files.map((file) => file.path);
  if (!hasExactOwnedPathSet(paths, expectedPaths)) {
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
  fileBytes: Readonly<Record<string, ExistingFile>>,
): RollbackSnapshotV1 {
  const baseManifest = manifestWithoutRollback(manifest);
  return {
    schemaVersion: ROLLBACK_SCHEMA_VERSION,
    marker: INSTALLATION_MARKER,
    root,
    installationId: manifest.installationId,
    fromVersion: manifest.version,
    manifest: baseManifest,
    files: manifest.files.map(({ path: filePath }) => ({
      path: filePath,
      sha256: digest(fileBytes[filePath]!.bytes),
      mode: fileBytes[filePath]!.mode,
      owner: INSTALLATION_MARKER,
      base64: fileBytes[filePath]!.bytes.toString("base64"),
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

async function pruneOwnedDirectories(
  root: string,
  relativeFilePaths: readonly string[],
): Promise<void> {
  const directories = new Set<string>();
  for (const relativeFilePath of relativeFilePaths) {
    if (!safeRelativePath(relativeFilePath)) continue;
    let relativeDirectory = path.posix.dirname(relativeFilePath);
    while (relativeDirectory !== ".") {
      directories.add(relativeDirectory);
      relativeDirectory = path.posix.dirname(relativeDirectory);
    }
  }
  const ordered = [...directories].sort((left, right) => {
    const depth = right.split("/").length - left.split("/").length;
    return depth !== 0 ? depth : right.localeCompare(left, "en");
  });
  for (const relativeDirectory of ordered) {
    const directory = path.join(root, ...relativeDirectory.split("/"));
    try {
      await rmdir(directory);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTEMPTY" && code !== "EEXIST") {
        throw error;
      }
    }
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

async function hostConfigIsValid(
  root: string,
  manifest: InstallationManifestV1,
): Promise<boolean> {
  if (manifest.host === undefined) return true;
  const configPath = ownedAbsolutePath(root, INSTALLATION_CONFIG_FILE);
  try {
    const parsed = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
    return (
      parsed.schemaVersion === INSTALLATION_SCHEMA_VERSION &&
      parsed.marker === INSTALLATION_MARKER &&
      parsed.installationId === manifest.installationId &&
      parsed.installationRoot === root &&
      parsed.providerInstallationRoot ===
        manifest.providerInstallationRoot &&
      JSON.stringify(parsed.providerInstallationIdentity) ===
        JSON.stringify(manifest.providerInstallationIdentity) &&
      isHostMcpServerConfigV1(
        parsed,
        manifest.host,
        path.join(root, INSTALLATION_WRAPPER_FILE),
      )
    );
  } catch {
    return false;
  }
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
  options: Readonly<{ allowLegacy?: boolean }> = {},
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
  const legacyNativeUpgradeRequired =
    isLegacyManifest(manifest) && options.allowLegacy !== true;
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
    const embeddedVersion =
      file.path === INSTALLATION_CLI_BUNDLE_FILE
        ? embeddedReleaseVersion(bytes)
        : undefined;
    const hasOwnedIdentity =
      file.path === INSTALLATION_NATIVE_KERNEL_PEER_FILE
        ? nativeKernelPeerBinaryIsValid(bytes)
        : (OWNED_RELATIVE_FILES as readonly string[]).includes(file.path)
          ? bytes.toString("utf8").includes(INSTALLATION_MARKER) &&
            (file.path !== INSTALLATION_CLI_BUNDLE_FILE ||
              (embeddedVersion !== null &&
                (embeddedVersion === undefined || embeddedVersion === manifest.version)))
          : true;
    checks.push({
      path: file.path,
      state:
        actualSha256 === file.sha256 && hasOwnedIdentity ? "ok" : "modified",
      expectedSha256: file.sha256,
      actualSha256,
    });
  }
  if (legacyNativeUpgradeRequired) {
    checks.push({
      path: INSTALLATION_NATIVE_KERNEL_PEER_FILE,
      state: "missing",
      expectedSha256: `sha256:${"0".repeat(64)}`,
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
  if (manifest.host !== undefined) {
    const configCheck = checks.find((check) => check.path === INSTALLATION_CONFIG_FILE);
    if (configCheck?.state === "ok" && !(await hostConfigIsValid(root, manifest))) {
      const index = checks.findIndex((check) => check.path === INSTALLATION_CONFIG_FILE);
      checks[index] = {
        ...checks[index]!,
        state: "modified",
      };
    }
  }
  if (manifest.providerInstallationRoot !== undefined) {
    const configCheck = checks.find(
      (check) => check.path === INSTALLATION_CONFIG_FILE,
    );
    let providerRootMatches = false;
    try {
      const canonicalProviderRoot = await resolveProviderInstallationRootV1(
        manifest.providerInstallationRoot,
      );
      if (canonicalProviderRoot === manifest.providerInstallationRoot) {
        const providerMetadata = await lstat(canonicalProviderRoot);
        providerRootMatches =
          manifest.providerInstallationIdentity !== undefined &&
          String(providerMetadata.dev) === manifest.providerInstallationIdentity.dev &&
          String(providerMetadata.ino) === manifest.providerInstallationIdentity.ino;
      }
    } catch {
      providerRootMatches = false;
    }
    if (configCheck?.state === "ok" && !providerRootMatches) {
      const index = checks.findIndex(
        (check) => check.path === INSTALLATION_CONFIG_FILE,
      );
      checks[index] = { ...checks[index]!, state: "modified" };
    }
  }
  if (manifest.workbenchUi === INSTALLATION_REACT_WORKBENCH_UI) {
    let dashboardInventoryMatches = false;
    try {
      const installed = await readDashboardAssets(
        ownedAbsolutePath(root, INSTALLATION_CLI_BUNDLE_FILE),
        manifest.version,
      );
      const expected = manifest.files
        .filter(
          (file) =>
            file.path === INSTALLATION_DASHBOARD_MANIFEST_FILE ||
            file.path.startsWith(`${INSTALLATION_DASHBOARD_ROOT}/`),
        )
        .map((file) => file.path)
        .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
      const actual = [...installed.files.keys()].sort((left, right) =>
        left < right ? -1 : left > right ? 1 : 0,
      );
      dashboardInventoryMatches =
        installed.workbenchUi === INSTALLATION_REACT_WORKBENCH_UI &&
        hasExactOwnedPathSet(actual, expected) &&
        expected.every((filePath) => {
          const manifestFile = manifest.files.find(
            (file) => file.path === filePath,
          );
          const bytes = installed.files.get(filePath);
          return (
            manifestFile !== undefined &&
            bytes !== undefined &&
            manifestFile.sha256 === digest(bytes)
          );
        });
    } catch {
      dashboardInventoryMatches = false;
    }
    if (!dashboardInventoryMatches) {
      const index = checks.findIndex(
        (check) => check.path === INSTALLATION_DASHBOARD_MANIFEST_FILE,
      );
      if (index >= 0) {
        checks[index] = { ...checks[index]!, state: "modified" };
      }
    }
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
  const hasModified =
    legacyNativeUpgradeRequired ||
    !rollbackValid ||
    checks.some((check) => check.state !== "ok");
  const legacyOnlyMissingNative =
    legacyNativeUpgradeRequired &&
    checks.every(
      (check) =>
        check.path === INSTALLATION_NATIVE_KERNEL_PEER_FILE
          ? check.state === "missing"
          : check.state === "ok",
    );
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
            ? legacyOnlyMissingNative
              ? "native_asset_upgrade_required"
              : "owned_file_check_failed"
            : manifest.rollback === undefined
              ? "orphaned_rollback_snapshot"
              : "rollback_snapshot_invalid",
        }
      : {}),
    ...(manifest.host !== undefined &&
      manifest.providerInstallationRoot === undefined &&
      !hasModified
      ? {
          capabilityProfile: "read_only" as const,
          taskWorkflow: "unavailable" as const,
          remediation: "bind_provider_installation" as const,
          remediationHint:
            "Install or validate the Provider service, then run understand-code install --host codex|claude --root <install-root> --provider-installation-root <provider-installation-root>.",
        }
      : manifest.host !== undefined &&
          manifest.providerInstallationRoot !== undefined &&
          !hasModified
        ? {
            capabilityProfile: "provider_bound" as const,
            taskWorkflow: "requires_provider_check" as const,
          }
        : {}),
  };
}

/** Install or refresh the owned wrapper/config set without taking the lock. */
async function installInstallationNoLockV1(
  options: InstallationOptionsV1,
  resolvedRoot?: string,
): Promise<InstallResultV1> {
  const root =
    resolvedRoot ?? (await resolveInstallationTargetV1(options, { create: true }));
  const manifestPath = path.join(root, INSTALLATION_MANIFEST_FILE);
  const existingManifest = await readManifestAt(root);
  let installationId = existingManifest?.installationId ?? randomUUID();
  if (existingManifest !== undefined) {
    const before = await inspectInstallation(root, { allowLegacy: true });
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
  if (options.host !== undefined && !isHostAdapterId(options.host)) {
    throw new InstallationLifecycleError("invalid_target", "Host adapter is invalid.");
  }
  const host = options.host ?? existingManifest?.host;
  const providerInstallationRoot =
    options.providerInstallationRoot === undefined
      ? existingManifest?.providerInstallationRoot
      : await resolveProviderInstallationRootV1(
          options.providerInstallationRoot,
        );
  const providerInstallationIdentity = providerInstallationRoot === undefined
    ? undefined
    : await lstat(providerInstallationRoot).then((metadata) => ({
        dev: String(metadata.dev),
        ino: String(metadata.ino),
      }));
  if (providerInstallationRoot !== undefined && host === undefined) {
    throw new InstallationLifecycleError(
      "invalid_target",
      "A Provider installation root requires a selected Host adapter.",
    );
  }
  const cliCommand = options.cliCommand;
  if (host !== undefined && options.cliCommand !== undefined) {
    throw new InstallationLifecycleError(
      "invalid_target",
      "Host installations use the selected adapter command.",
      { host },
    );
  }
  const configCommand =
    host === undefined && cliCommand !== undefined
      ? cliCommand
      : path.join(root, INSTALLATION_WRAPPER_FILE);
  if (
    cliCommand !== undefined &&
    (!isSafeText(cliCommand) || cliCommand.includes("\n"))
  ) {
    throw new InstallationLifecycleError("invalid_target", "CLI command is invalid.");
  }
  const cliAssets = await readCliBundle(options.cliBundlePath, version);
  const bytes = new Map<string, Uint8Array>([
    [INSTALLATION_OWNER_FILE, Buffer.from(markerContent(installationId), "utf8")],
    [
      INSTALLATION_WRAPPER_FILE,
      Buffer.from(
        wrapperContent(installationId, host, providerInstallationRoot),
        "utf8",
      ),
    ],
    [INSTALLATION_CLI_BUNDLE_FILE, cliAssets.cliBundle],
    [INSTALLATION_NATIVE_KERNEL_PEER_FILE, cliAssets.nativeKernelPeer],
    [
      INSTALLATION_CONFIG_FILE,
      Buffer.from(
        configContent(
          root,
          installationId,
          configCommand,
          host,
          providerInstallationRoot,
          providerInstallationIdentity,
        ),
        "utf8",
      ),
    ],
    ...cliAssets.dashboardFiles.entries(),
  ]);
  const manifest = manifestFor(
    root,
    version,
    installationId,
    bytes,
    cliAssets.workbenchUi,
    host,
    providerInstallationRoot,
    providerInstallationIdentity,
  );
  if (
    existingManifest === undefined &&
    cliAssets.workbenchUi === INSTALLATION_REACT_WORKBENCH_UI
  ) {
    const [dashboardRootState, dashboardManifestState] = await Promise.all([
      optionalPathMetadata(path.join(root, INSTALLATION_DASHBOARD_ROOT)),
      optionalPathMetadata(
        path.join(root, INSTALLATION_DASHBOARD_MANIFEST_FILE),
      ),
    ]);
    if (dashboardRootState !== undefined || dashboardManifestState !== undefined) {
      return { status: "refused", root, manifestPath, reason: "path_conflict" };
    }
  }
  if (existingManifest !== undefined) {
    const before = await inspectInstallation(root, { allowLegacy: true });
    if (before.status === "healthy" && existingManifest.version === version) {
      const filesMatch =
        existingManifest.workbenchUi === manifest.workbenchUi &&
        existingManifest.files.length === manifest.files.length &&
        existingManifest.files.every(
          (file) =>
            file.sha256 ===
            manifest.files.find((next) => next.path === file.path)?.sha256,
        );
      if (!filesMatch) {
        const upgraded = await applyInstallationVersionChangeV1(
          options,
          undefined,
          root,
        );
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
      const upgraded = await applyInstallationVersionChangeV1(
        options,
        undefined,
        root,
      );
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
    for (const { path: relativePath } of manifest.files) {
      const filePath = ownedAbsolutePath(root, relativePath);
      previous.set(filePath, await readExistingFile(filePath));
      await atomicWriteFile(
        root,
        filePath,
        bytes.get(relativePath)!,
        ownedFileMode(relativePath),
      );
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
    await pruneOwnedDirectories(
      root,
      manifest.files
        .map((file) => file.path)
        .filter((filePath) =>
          filePath.startsWith(`${INSTALLATION_DASHBOARD_ROOT}/`),
        ),
    ).catch(() => undefined);
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

/** Install or refresh the owned wrapper/config set under the root lock. */
export async function installInstallationV1(
  options: InstallationOptionsV1,
): Promise<InstallResultV1> {
  const root = await resolveInstallationTargetV1(options, { create: true });
  const attempt = await acquireInstallationLifecycleLockV1(root);
  if (attempt.status === "busy") {
    return {
      status: "refused",
      root,
      manifestPath: path.join(root, INSTALLATION_MANIFEST_FILE),
      reason: "installation_busy",
    };
  }
  if (attempt.status === "missing") {
    // `create: true` above normally makes this impossible.  Keep the branch
    // explicit so a root disappearing in the narrow hand-off window remains a
    // no-write, fail-closed refusal rather than an unguarded mutation.
    return {
      status: "refused",
      root,
      manifestPath: path.join(root, INSTALLATION_MANIFEST_FILE),
      reason: "installation_busy",
    };
  }
  return withInstallationLifecycleLockV1(attempt.lease, () =>
    installInstallationNoLockV1(options, root),
  );
}

/**
 * Apply a versioned installation replacement while retaining a durable,
 * integrity-bound snapshot of the previous owned set.  The snapshot is
 * single-level: a later replacement replaces it, and rollback always returns
 * to the immediately prior healthy version.
 *
 * `expectedManifest` is used only by the explicit downgrade wrapper. It gives
 * that wrapper a second, immediately-before-write observation of the
 * canonical manifest bytes, installation identity, and version so a
 * concurrent lifecycle operation cannot silently replace a different
 * same-version installation.
 */
async function applyInstallationVersionChangeV1(
  options: InstallationOptionsV1,
  expectedManifest?: Readonly<{ version: string; installationId: string; digest: string }>,
  resolvedRoot?: string,
): Promise<UpgradeResultV1> {
  const root =
    resolvedRoot ?? (await resolveInstallationTargetV1(options, { create: false }));
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
  if (
    expectedManifest !== undefined &&
    (existingManifest.version !== expectedManifest.version ||
      existingManifest.installationId !== expectedManifest.installationId ||
      digest(Buffer.from(canonicalJson(existingManifest), "utf8")) !==
        expectedManifest.digest)
  ) {
    const doctor = await inspectInstallation(root, { allowLegacy: true });
    return {
      status: "refused",
      root,
      manifestPath,
      installationId: existingManifest.installationId,
      fromVersion: existingManifest.version,
      version: options.version ?? DEFAULT_INSTALLATION_VERSION,
      reason: "installation_changed_during_downgrade",
      doctor,
    };
  }
  const before = await inspectInstallation(root, { allowLegacy: true });
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
  if (options.host !== undefined && !isHostAdapterId(options.host)) {
    throw new InstallationLifecycleError("invalid_target", "Host adapter is invalid.");
  }
  const host = options.host ?? existingManifest.host;
  const providerInstallationRoot =
    options.providerInstallationRoot === undefined
      ? existingManifest.providerInstallationRoot
      : await resolveProviderInstallationRootV1(
          options.providerInstallationRoot,
        );
  const providerInstallationIdentity = providerInstallationRoot === undefined
    ? undefined
    : options.providerInstallationRoot === undefined
      ? existingManifest.providerInstallationIdentity
      : await lstat(providerInstallationRoot).then((metadata) => ({
          dev: String(metadata.dev),
          ino: String(metadata.ino),
        }));
  if (providerInstallationRoot !== undefined && host === undefined) {
    throw new InstallationLifecycleError(
      "invalid_target",
      "A Provider installation root requires a selected Host adapter.",
    );
  }
  const cliCommand = options.cliCommand;
  if (host !== undefined && options.cliCommand !== undefined) {
    throw new InstallationLifecycleError(
      "invalid_target",
      "Host installations use the selected adapter command.",
      { host },
    );
  }
  const configCommand =
    host === undefined && cliCommand !== undefined
      ? cliCommand
      : path.join(root, INSTALLATION_WRAPPER_FILE);
  if (
    cliCommand !== undefined &&
    (!isSafeText(cliCommand) || cliCommand.includes("\n"))
  ) {
    throw new InstallationLifecycleError("invalid_target", "CLI command is invalid.");
  }
  const cliAssets = await readCliBundle(options.cliBundlePath, version, {
    requireReleaseIdentity: expectedManifest !== undefined,
  });
  const installationId = existingManifest.installationId;
  const bytes = new Map<string, Uint8Array>([
    [INSTALLATION_OWNER_FILE, Buffer.from(markerContent(installationId), "utf8")],
    [
      INSTALLATION_WRAPPER_FILE,
      Buffer.from(
        wrapperContent(installationId, host, providerInstallationRoot),
        "utf8",
      ),
    ],
    [INSTALLATION_CLI_BUNDLE_FILE, cliAssets.cliBundle],
    [INSTALLATION_NATIVE_KERNEL_PEER_FILE, cliAssets.nativeKernelPeer],
    [
      INSTALLATION_CONFIG_FILE,
      Buffer.from(
        configContent(
          root,
          installationId,
          configCommand,
          host,
          providerInstallationRoot,
          providerInstallationIdentity,
        ),
        "utf8",
      ),
    ],
    ...cliAssets.dashboardFiles.entries(),
  ]);
  const desiredManifest = manifestFor(
    root,
    version,
    installationId,
    bytes,
    cliAssets.workbenchUi,
    host,
    providerInstallationRoot,
    providerInstallationIdentity,
  );
  const currentMatches =
    existingManifest.version === version &&
    existingManifest.workbenchUi === desiredManifest.workbenchUi &&
    existingManifest.files.length === desiredManifest.files.length &&
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
  const latest = await inspectInstallation(root, { allowLegacy: true });
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
  if (expectedManifest !== undefined) {
    const latestManifest = await readManifestAt(root);
    if (
      latestManifest === undefined ||
      latestManifest.version !== expectedManifest.version ||
      latestManifest.installationId !== expectedManifest.installationId ||
      digest(Buffer.from(canonicalJson(latestManifest), "utf8")) !==
        expectedManifest.digest
    ) {
      return {
        status: "refused",
        root,
        manifestPath,
        installationId,
        fromVersion: existingManifest.version,
        version,
        reason: "installation_changed_during_downgrade",
        doctor: latest,
      };
    }
  }
  if (
    existingManifest.workbenchUi !== INSTALLATION_REACT_WORKBENCH_UI &&
    desiredManifest.workbenchUi === INSTALLATION_REACT_WORKBENCH_UI
  ) {
    const [dashboardRootState, dashboardManifestState] = await Promise.all([
      optionalPathMetadata(path.join(root, INSTALLATION_DASHBOARD_ROOT)),
      optionalPathMetadata(
        path.join(root, INSTALLATION_DASHBOARD_MANIFEST_FILE),
      ),
    ]);
    if (dashboardRootState !== undefined || dashboardManifestState !== undefined) {
      return {
        status: "refused",
        root,
        manifestPath,
        installationId,
        fromVersion: existingManifest.version,
        version,
        reason: "path_conflict",
        doctor: await inspectInstallation(root, { allowLegacy: true }),
      };
    }
  }
  const existingPaths = new Set(
    existingManifest.files.map((file) => file.path),
  );
  for (const { path: relativePath } of desiredManifest.files) {
    if (existingPaths.has(relativePath)) continue;
    if (
      (await optionalPathMetadata(ownedAbsolutePath(root, relativePath))) !==
      undefined
    ) {
      return {
        status: "refused",
        root,
        manifestPath,
        installationId,
        fromVersion: existingManifest.version,
        version,
        reason: "path_conflict",
        doctor: await inspectInstallation(root, { allowLegacy: true }),
      };
    }
  }
  const currentFiles: Record<string, ExistingFile> = {};
  for (const { path: relativePath } of existingManifest.files) {
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
  const nextManifest = manifestFor(
    root,
    version,
    installationId,
    bytes,
    cliAssets.workbenchUi,
    host,
    providerInstallationRoot,
    providerInstallationIdentity,
    rollback,
  );
  const written: string[] = [];
  const removedStale: string[] = [];
  const desiredPaths = new Set(
    desiredManifest.files.map((file) => file.path),
  );
  const staleFiles = existingManifest.files.filter(
    (file) => !desiredPaths.has(file.path),
  );
  try {
    // Commit the snapshot before publishing its descriptor.  A failed write
    // therefore leaves the old manifest as the only authoritative state.
    await atomicWriteFile(root, rollbackPath, snapshotBytes, 0o600);
    for (const { path: relativePath } of desiredManifest.files) {
      const filePath = ownedAbsolutePath(root, relativePath);
      await atomicWriteFile(
        root,
        filePath,
        bytes.get(relativePath)!,
        ownedFileMode(relativePath),
      );
      written.push(filePath);
    }
    for (const { path: relativePath } of staleFiles) {
      await unlink(ownedAbsolutePath(root, relativePath));
      removedStale.push(relativePath);
    }
    await pruneOwnedDirectories(root, removedStale);
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
      const relativePath = path.relative(root, filePath).split(path.sep).join("/");
      const previous = currentFiles[relativePath];
      if (previous === undefined) {
        await unlink(filePath).catch(() => undefined);
      } else {
        await atomicWriteFile(root, filePath, previous.bytes, previous.mode).catch(
          () => undefined,
        );
      }
    }
    for (const relativePath of removedStale) {
      const previous = currentFiles[relativePath];
      if (previous !== undefined) {
        await atomicWriteFile(
          root,
          ownedAbsolutePath(root, relativePath),
          previous.bytes,
          previous.mode,
        ).catch(() => undefined);
      }
    }
    const newPaths = desiredManifest.files
      .map((file) => file.path)
      .filter((relativePath) => !existingPaths.has(relativePath));
    await pruneOwnedDirectories(root, newPaths).catch(() => undefined);
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

/** Upgrade an existing installation to the requested release artifact. */
export async function upgradeInstallationV1(
  options: InstallationOptionsV1,
): Promise<UpgradeResultV1> {
  const root = await resolveInstallationTargetV1(options, { create: false });
  const attempt = await acquireInstallationLifecycleLockV1(root);
  if (attempt.status === "busy") {
    return {
      status: "refused",
      root,
      manifestPath: path.join(root, INSTALLATION_MANIFEST_FILE),
      version: options.version ?? DEFAULT_INSTALLATION_VERSION,
      reason: "installation_busy",
    };
  }
  if (attempt.status === "missing") {
    return applyInstallationVersionChangeV1(options, undefined, root);
  }
  return withInstallationLifecycleLockV1(attempt.lease, () =>
    applyInstallationVersionChangeV1(options, undefined, root),
  );
}

/**
 * Downgrade an existing installation to a strictly lower release version.
 *
 * Downgrade intentionally shares the upgrade writer, snapshot format, and
 * rollback recovery path.  Only strict SemVer release versions are ordered;
 * legacy/free-form labels are refused rather than guessed.  This local
 * installation operation preserves the immutable installation identity; the
 * Provider acceptance/high-water guard remains owned by the Provider service.
 */
async function downgradeInstallationNoLockV1(
  options: InstallationOptionsV1,
  resolvedRoot?: string,
): Promise<DowngradeResultV1> {
  const root =
    resolvedRoot ?? (await resolveInstallationTargetV1(options, { create: false }));
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

  // Refuse tampered installations before considering version direction.  This
  // keeps downgrade fail-closed and avoids using a forged manifest as an
  // ordering authority.
  const before = await inspectInstallation(root, { allowLegacy: true });
  if (before.status !== "healthy") {
    return {
      status: "refused",
      root,
      manifestPath,
      installationId: existingManifest.installationId,
      fromVersion: existingManifest.version,
      version: options.version ?? DEFAULT_INSTALLATION_VERSION,
      reason: before.reason ?? "installation_tampered",
      doctor: before,
    };
  }

  const version = options.version ?? DEFAULT_INSTALLATION_VERSION;
  if (!isSafeText(version)) {
    throw new InstallationLifecycleError(
      "invalid_target",
      "Installation version is invalid.",
    );
  }
  const comparison = compareInstallationVersions(
    version,
    existingManifest.version,
  );
  if (comparison === undefined) {
    return {
      status: "refused",
      root,
      manifestPath,
      installationId: existingManifest.installationId,
      fromVersion: existingManifest.version,
      version,
      reason: "downgrade_version_order_unknown",
      doctor: before,
    };
  }
  if (comparison >= 0) {
    return {
      status: "refused",
      root,
      manifestPath,
      installationId: existingManifest.installationId,
      fromVersion: existingManifest.version,
      version,
      reason:
        comparison === 0
          ? "downgrade_target_is_current"
          : "downgrade_target_is_newer",
      doctor: before,
    };
  }

  return applyInstallationVersionChangeV1(
    options,
    {
      version: existingManifest.version,
      installationId: existingManifest.installationId,
      digest: digest(Buffer.from(canonicalJson(existingManifest), "utf8")),
    },
    root,
  );
}

/** Downgrade an existing installation under the root lifecycle lock. */
export async function downgradeInstallationV1(
  options: InstallationOptionsV1,
): Promise<DowngradeResultV1> {
  const root = await resolveInstallationTargetV1(options, { create: false });
  const attempt = await acquireInstallationLifecycleLockV1(root);
  if (attempt.status === "busy") {
    return {
      status: "refused",
      root,
      manifestPath: path.join(root, INSTALLATION_MANIFEST_FILE),
      version: options.version ?? DEFAULT_INSTALLATION_VERSION,
      reason: "installation_busy",
    };
  }
  if (attempt.status === "missing") {
    return downgradeInstallationNoLockV1(options, root);
  }
  return withInstallationLifecycleLockV1(attempt.lease, () =>
    downgradeInstallationNoLockV1(options, root),
  );
}

/** Restore the immediately preceding healthy installation snapshot. */
async function rollbackInstallationNoLockV1(
  input: InstallationTargetInputV1,
  resolvedRoot?: string,
): Promise<RollbackResultV1> {
  const root =
    resolvedRoot ?? (await resolveInstallationTargetV1(input, { create: false }));
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
  const restoredPaths = new Set(restoredFiles.map((file) => file.path));
  const extraCurrentFiles = manifest.files.filter(
    (file) => !restoredPaths.has(file.path),
  );
  const removedPaths: string[] = [];
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
    for (const file of extraCurrentFiles) {
      await unlink(ownedAbsolutePath(root, file.path));
      removedPaths.push(file.path);
    }
    await pruneOwnedDirectories(
      root,
      extraCurrentFiles.map((file) => file.path),
    );
    await atomicWriteFile(
      root,
      manifestPath,
      Buffer.from(canonicalJson(snapshot.manifest), "utf8"),
      0o600,
    );
    await unlink(rollbackPath);
    removedPaths.push(INSTALLATION_ROLLBACK_FILE);
  } catch {
    return {
      status: "partial",
      root,
      manifestPath,
      installationId: manifest.installationId,
      version: snapshot.manifest.version,
      removedPaths,
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
    removedPaths,
    refusedPaths: [],
  };
}

/** Restore the immediately preceding healthy snapshot under the root lock. */
export async function rollbackInstallationV1(
  input: InstallationTargetInputV1,
): Promise<RollbackResultV1> {
  const root = await resolveInstallationTargetV1(input, { create: false });
  const attempt = await acquireInstallationLifecycleLockV1(root);
  if (attempt.status === "busy") {
    return {
      status: "refused",
      root,
      manifestPath: path.join(root, INSTALLATION_MANIFEST_FILE),
      removedPaths: [],
      refusedPaths: [],
      reason: "installation_busy",
    };
  }
  if (attempt.status === "missing") {
    return rollbackInstallationNoLockV1(input, root);
  }
  return withInstallationLifecycleLockV1(attempt.lease, () =>
    rollbackInstallationNoLockV1(input, root),
  );
}

/** Verify an installation without changing any files. */
export async function doctorInstallationV1(
  input: InstallationTargetInputV1,
): Promise<DoctorResultV1> {
  const root = await resolveInstallationTargetV1(input, { create: false });
  // Doctor is intentionally read-only: it never attempts stale-lock
  // recovery.  Any canonical lock, malformed lock, or recovery claim makes
  // the result non-healthy until an owner (or an operator) resolves it.
  const lifecycleLock = await inspectInstallationLifecycleLockV1(root);
  const recoveryClaim = await lifecycleLockPathExistsV1(
    lifecycleLockRecoveryPathV1(root),
  );
  if (lifecycleLock !== undefined || recoveryClaim) {
    const inspected = await inspectInstallation(root);
    return {
      ...inspected,
      ok: false,
      status: "tampered",
      reason: "installation_busy",
    };
  }
  // A lock path that exists but cannot be parsed is also busy.  The helper
  // returns `undefined` for both absent and malformed paths, so distinguish
  // those states with a read-only existence check before trusting the result.
  if (await lifecycleLockPathExistsV1(lifecycleLockPathV1(root))) {
    const inspected = await inspectInstallation(root);
    return {
      ...inspected,
      ok: false,
      status: "tampered",
      reason: "installation_busy",
    };
  }
  return inspectInstallation(root);
}

/**
 * Resolve the Provider selector only through one healthy, installer-owned Host
 * installation. This is the runtime trust boundary used by strong wrappers.
 */
export async function resolveTrustedProviderInstallationRootV1(
  input: InstallationTargetInputV1,
): Promise<string> {
  return (await resolveTrustedProductionInstallationSelectionV1(input))
    .canonicalProviderInstallationRoot;
}

export async function resolveTrustedProductionInstallationSelectionV1(
  input: InstallationTargetInputV1,
): Promise<Readonly<{
  canonicalHostInstallationRoot: string;
  canonicalProviderInstallationRoot: string;
}>> {
  const root = await resolveInstallationTargetV1(input, { create: false });
  const hostRootBefore = await lstat(root);
  if (!hostRootBefore.isDirectory() || hostRootBefore.isSymbolicLink() ||
    await realpath(root) !== root) {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "The Host installation root is unsafe.",
    );
  }
  const before = await readManifestAt(root);
  if (
    before?.host === undefined ||
    before.providerInstallationRoot === undefined
  ) {
    throw new InstallationLifecycleError(
      "manifest_invalid",
      "The Host installation does not select a Provider installation.",
    );
  }
  const doctor = await inspectInstallation(root);
  if (!doctor.ok || doctor.status !== "healthy") {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "The Host installation cannot provide a trusted Provider selector.",
    );
  }
  const after = await readManifestAt(root);
  if (
    after?.installationId !== before.installationId ||
    after.version !== before.version ||
    after.host !== before.host ||
    after.providerInstallationRoot !== before.providerInstallationRoot
    || JSON.stringify(after.providerInstallationIdentity) !==
      JSON.stringify(before.providerInstallationIdentity)
  ) {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "The Host installation changed while resolving its Provider selector.",
    );
  }
  const canonicalProviderRoot = await resolveProviderInstallationRootV1(
    after.providerInstallationRoot,
  );
  if (canonicalProviderRoot !== after.providerInstallationRoot) {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "The configured Provider installation root is no longer canonical.",
    );
  }
  const providerMetadata = await lstat(canonicalProviderRoot);
  if (
    after.providerInstallationIdentity === undefined ||
    String(providerMetadata.dev) !== after.providerInstallationIdentity.dev ||
    String(providerMetadata.ino) !== after.providerInstallationIdentity.ino
  ) {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "The configured Provider installation identity changed.",
    );
  }
  const hostRootAfter = await lstat(root);
  if (!hostRootAfter.isDirectory() || hostRootAfter.isSymbolicLink() ||
    hostRootAfter.dev !== hostRootBefore.dev ||
    hostRootAfter.ino !== hostRootBefore.ino || await realpath(root) !== root) {
    throw new InstallationLifecycleError(
      "installation_tampered",
      "The Host installation root changed while resolving production authority.",
    );
  }
  return {
    canonicalHostInstallationRoot: root,
    canonicalProviderInstallationRoot: canonicalProviderRoot,
  };
}

/**
 * Prove that an executing CLI bundle is the exact, healthy managed bundle
 * whose manifest explicitly opts into the limited embedded Workbench UI.
 * Legacy manifests remain valid installations, but do not gain this opt-in.
 */
export async function managedLegacyWorkbenchUiAllowedV1(
  modulePath: string,
): Promise<boolean> {
  const normalizedModulePath = normalizedCandidate(modulePath);
  if (normalizedModulePath === undefined) return false;

  try {
    const [moduleMetadata, canonicalModulePath] = await Promise.all([
      lstat(normalizedModulePath),
      realpath(normalizedModulePath),
    ]);
    if (moduleMetadata.isSymbolicLink() || !moduleMetadata.isFile()) return false;
    const root = path.dirname(path.dirname(canonicalModulePath));
    if (
      normalizedCandidate(root) === undefined ||
      canonicalModulePath !== path.join(root, INSTALLATION_CLI_BUNDLE_FILE)
    ) {
      return false;
    }
    const [rootMetadata, canonicalRoot] = await Promise.all([
      lstat(root),
      realpath(root),
    ]);
    if (
      rootMetadata.isSymbolicLink() ||
      !rootMetadata.isDirectory() ||
      canonicalRoot !== root
    ) {
      return false;
    }

    const before = await readManifestAt(root);
    if (before?.workbenchUi !== INSTALLATION_WORKBENCH_UI) return false;
    const doctor = await inspectInstallation(root);
    if (!doctor.ok || doctor.status !== "healthy") return false;
    const after = await readManifestAt(root);
    return (
      after?.workbenchUi === INSTALLATION_WORKBENCH_UI &&
      after.installationId === before.installationId &&
      after.version === before.version
    );
  } catch {
    return false;
  }
}

/**
 * Remove only files that still match the owned manifest.  Any modified,
 * replaced, or malformed owned entry stops the operation before deletion.
 */
async function uninstallInstallationNoLockV1(
  input: InstallationTargetInputV1,
  resolvedRoot?: string,
): Promise<UninstallResultV1> {
  const root =
    resolvedRoot ?? (await resolveInstallationTargetV1(input, { create: false }));
  const manifestPath = path.join(root, INSTALLATION_MANIFEST_FILE);
  const doctor = await inspectInstallation(root, { allowLegacy: true });
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
  const latest = await inspectInstallation(root, { allowLegacy: true });
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
    await pruneOwnedDirectories(
      root,
      manifest.files.map((file) => file.path),
    );
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
  return {
    status: "removed",
    root,
    manifestPath,
    removedPaths: [...removedPaths, INSTALLATION_MANIFEST_FILE],
    refusedPaths: [],
  };
}

/** Remove an untouched installation under the root lifecycle lock. */
export async function uninstallInstallationV1(
  input: InstallationTargetInputV1,
): Promise<UninstallResultV1> {
  const root = await resolveInstallationTargetV1(input, { create: false });
  const attempt = await acquireInstallationLifecycleLockV1(root);
  if (attempt.status === "busy") {
    return {
      status: "refused",
      root,
      manifestPath: path.join(root, INSTALLATION_MANIFEST_FILE),
      removedPaths: [],
      refusedPaths: [],
      reason: "installation_busy",
    };
  }
  if (attempt.status === "missing") {
    return uninstallInstallationNoLockV1(input, root);
  }
  return withInstallationLifecycleLockV1(attempt.lease, () =>
    uninstallInstallationNoLockV1(input, root),
  );
}
