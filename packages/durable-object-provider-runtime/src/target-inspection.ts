import { createHash } from "node:crypto";
import { lstat, realpath, statfs } from "node:fs/promises";
import { resolve } from "node:path";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";

const TARGET_INSPECTION_PROFILE_V1 =
  "understand_code_provider_runtime_target_inspection_v1" as const;
const TARGET_FINGERPRINT_DOMAIN_V1 =
  "understand-code-provider-runtime-public-target-v1" as const;

/**
 * This is deliberately a filesystem-bound candidate, not a Provider Gate
 * authority.  A same-UID private directory does not isolate a provider from
 * its caller; callers must keep strong writes locked until an independently
 * verified OS principal/kernel boundary is available.
 */
export const PROVIDER_RUNTIME_TARGET_ISOLATION_V1 =
  "same_uid_private_directory" as const;

export type ProviderRuntimeTargetIsolationV1 =
  typeof PROVIDER_RUNTIME_TARGET_ISOLATION_V1;

export type ProviderRuntimeTargetErrorCodeV1 =
  | "invalid_root"
  | "unsupported_platform"
  | "root_not_found"
  | "root_symlink"
  | "root_not_directory"
  | "root_owner_mismatch"
  | "root_mode_invalid"
  | "statfs_failed"
  | "target_continuity_changed";

export class ProviderRuntimeTargetInspectionErrorV1 extends Error {
  readonly code: ProviderRuntimeTargetErrorCodeV1;

  constructor(code: ProviderRuntimeTargetErrorCodeV1, message: string) {
    super(message);
    this.name = "ProviderRuntimeTargetInspectionErrorV1";
    this.code = code;
  }
}

/** Fields safe to expose in a public Provider Gate/Doctor projection. */
export interface ProviderRuntimeTargetPublicProjectionV1 {
  readonly platform: NodeJS.Platform;
  readonly architecture: NodeJS.Architecture;
  /** A canonical statfs type code; it contains no path or volume identity. */
  readonly filesystemTypeCode: string;
  /** The mode conclusion is intentionally less revealing than raw metadata. */
  readonly rootMode: "owner_only_0700";
  readonly isolation: ProviderRuntimeTargetIsolationV1;
}

interface ProviderRuntimeTargetPrivateContinuityV1 {
  readonly rootDevice: string;
  readonly rootInode: string;
  readonly rootUid: string;
  readonly rootModeBits: string;
  readonly filesystemTypeCode: string;
}

/**
 * Runtime target observation.  `canonicalRootPath` and `continuity` are
 * private operational evidence; never serialize them in public output.
 */
export interface ProviderRuntimeTargetInspectionV1 {
  readonly profile: typeof TARGET_INSPECTION_PROFILE_V1;
  readonly canonicalRootPath: string;
  readonly publicProjection: ProviderRuntimeTargetPublicProjectionV1;
  readonly targetFingerprintDigest: `sha256:${string}`;
  readonly continuity: ProviderRuntimeTargetPrivateContinuityV1;
}

type BigIntStatsV1 = {
  readonly dev: bigint;
  readonly ino: bigint;
  readonly uid: bigint;
  readonly mode: bigint;
  readonly isDirectory: () => boolean;
  readonly isSymbolicLink: () => boolean;
};

type BigIntStatFsV1 = { readonly type: bigint };

function isSupportedPlatformV1(): boolean {
  return process.platform === "darwin" || process.platform === "linux";
}

function errorFromFsV1(
  error: unknown,
  fallbackCode: ProviderRuntimeTargetErrorCodeV1,
  operation: string,
): ProviderRuntimeTargetInspectionErrorV1 {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "ENOENT"
      ? "root_not_found"
      : fallbackCode;
  return new ProviderRuntimeTargetInspectionErrorV1(
    code,
    `${operation} failed: ${String(error)}`,
  );
}

function privateModeBitsV1(mode: bigint): bigint {
  return mode & 0o777n;
}

function modeStringV1(mode: bigint): string {
  return mode.toString(8);
}

function statfsTypeCodeV1(type: bigint): string {
  // Keep the code deterministic without exposing a mount path or physical
  // volume identifier.  `statfs.type` is an opaque platform-defined value.
  const sign = type < 0n ? "neg-" : "";
  const absolute = type < 0n ? -type : type;
  return `statfs:0x${sign}${absolute.toString(16).padStart(2, "0")}`;
}

function fingerprintV1(
  publicProjection: ProviderRuntimeTargetPublicProjectionV1,
): `sha256:${string}` {
  const preimage = canonicalizeJcsSafeIntegerV1({
    domain: TARGET_FINGERPRINT_DOMAIN_V1,
    publicProjection,
  });
  return `sha256:${createHash("sha256").update(preimage, "utf8").digest("hex")}`;
}

function samePrivateIdentityV1(
  left: ProviderRuntimeTargetInspectionV1,
  right: ProviderRuntimeTargetInspectionV1,
): boolean {
  return (
    left.canonicalRootPath === right.canonicalRootPath &&
    left.continuity.rootDevice === right.continuity.rootDevice &&
    left.continuity.rootInode === right.continuity.rootInode &&
    left.continuity.rootUid === right.continuity.rootUid &&
    left.continuity.rootModeBits === right.continuity.rootModeBits &&
    left.continuity.filesystemTypeCode === right.continuity.filesystemTypeCode
  );
}

async function readRootMetadataV1(path: string): Promise<BigIntStatsV1> {
  try {
    return (await lstat(path, { bigint: true })) as unknown as BigIntStatsV1;
  } catch (error) {
    throw errorFromFsV1(error, "root_not_found", "runtime target lstat");
  }
}

function validateRootMetadataV1(metadata: BigIntStatsV1): void {
  if (metadata.isSymbolicLink()) {
    throw new ProviderRuntimeTargetInspectionErrorV1(
      "root_symlink",
      "provider runtime target root must not be a symbolic link",
    );
  }
  if (!metadata.isDirectory()) {
    throw new ProviderRuntimeTargetInspectionErrorV1(
      "root_not_directory",
      "provider runtime target root must be a directory",
    );
  }
  if (typeof process.getuid !== "function") {
    throw new ProviderRuntimeTargetInspectionErrorV1(
      "unsupported_platform",
      "provider runtime target requires a uid-aware platform",
    );
  }
  if (metadata.uid !== BigInt(process.getuid())) {
    throw new ProviderRuntimeTargetInspectionErrorV1(
      "root_owner_mismatch",
      "provider runtime target root is not owned by the current uid",
    );
  }
  // Exact 0700 keeps the private-directory candidate unambiguous.  This is
  // not an OS-principal isolation claim.
  if (privateModeBitsV1(metadata.mode) !== 0o700n) {
    throw new ProviderRuntimeTargetInspectionErrorV1(
      "root_mode_invalid",
      "provider runtime target root must have exact owner-only 0700 mode",
    );
  }
}

async function readStatFsV1(path: string): Promise<BigIntStatFsV1> {
  try {
    return (await statfs(path, { bigint: true })) as unknown as BigIntStatFsV1;
  } catch (error) {
    throw errorFromFsV1(error, "statfs_failed", "runtime target statfs");
  }
}

/**
 * Probe a real runtime root and return both a redacted public projection and
 * private continuity evidence.  The root itself must be a non-symlink 0700
 * directory owned by the current uid.
 */
export async function probeProviderRuntimeTargetV1(
  rootPath: string,
): Promise<ProviderRuntimeTargetInspectionV1> {
  if (!isSupportedPlatformV1()) {
    throw new ProviderRuntimeTargetInspectionErrorV1(
      "unsupported_platform",
      `provider runtime target is unsupported on ${process.platform}`,
    );
  }
  if (typeof rootPath !== "string" || rootPath.trim().length === 0) {
    throw new ProviderRuntimeTargetInspectionErrorV1(
      "invalid_root",
      "provider runtime target root must be a non-empty path",
    );
  }

  const requestedPath = resolve(rootPath);
  const initial = await readRootMetadataV1(requestedPath);
  validateRootMetadataV1(initial);

  let canonicalRootPath: string;
  try {
    canonicalRootPath = await realpath(requestedPath);
  } catch (error) {
    throw errorFromFsV1(error, "root_not_found", "runtime target realpath");
  }
  // Re-check the caller-visible path after realpath.  Without this second
  // lstat a concurrent replacement with a symlink to the same directory could
  // pass the first check while changing the path boundary underneath us.
  const requestedAfter = await readRootMetadataV1(requestedPath);
  validateRootMetadataV1(requestedAfter);
  // `lstat` on the canonical path catches replacement races and ensures the
  // realpath result is still a directory before statfs is consulted.
  const canonicalBefore = await readRootMetadataV1(canonicalRootPath);
  validateRootMetadataV1(canonicalBefore);
  if (
    canonicalBefore.dev !== initial.dev ||
    canonicalBefore.ino !== initial.ino ||
    canonicalBefore.uid !== initial.uid ||
    privateModeBitsV1(canonicalBefore.mode) !== privateModeBitsV1(initial.mode) ||
    requestedAfter.dev !== initial.dev ||
    requestedAfter.ino !== initial.ino ||
    requestedAfter.uid !== initial.uid ||
    requestedAfter.mode !== initial.mode
  ) {
    throw new ProviderRuntimeTargetInspectionErrorV1(
      "target_continuity_changed",
      "provider runtime target changed while resolving its canonical root",
    );
  }

  const filesystem = await readStatFsV1(canonicalRootPath);
  const filesystemTypeCode = statfsTypeCodeV1(filesystem.type);
  const requestedFinal = await readRootMetadataV1(requestedPath);
  validateRootMetadataV1(requestedFinal);
  const canonicalAfter = await readRootMetadataV1(canonicalRootPath);
  validateRootMetadataV1(canonicalAfter);
  if (
    canonicalAfter.dev !== canonicalBefore.dev ||
    canonicalAfter.ino !== canonicalBefore.ino ||
    canonicalAfter.uid !== canonicalBefore.uid ||
    canonicalAfter.mode !== canonicalBefore.mode ||
    requestedFinal.dev !== initial.dev ||
    requestedFinal.ino !== initial.ino ||
    requestedFinal.uid !== initial.uid ||
    requestedFinal.mode !== initial.mode
  ) {
    throw new ProviderRuntimeTargetInspectionErrorV1(
      "target_continuity_changed",
      "provider runtime target metadata changed during inspection",
    );
  }

  const publicProjection: ProviderRuntimeTargetPublicProjectionV1 = {
    platform: process.platform,
    architecture: process.arch,
    filesystemTypeCode,
    rootMode: "owner_only_0700",
    isolation: PROVIDER_RUNTIME_TARGET_ISOLATION_V1,
  };
  return {
    profile: TARGET_INSPECTION_PROFILE_V1,
    canonicalRootPath,
    publicProjection,
    targetFingerprintDigest: fingerprintV1(publicProjection),
    continuity: {
      rootDevice: canonicalAfter.dev.toString(10),
      rootInode: canonicalAfter.ino.toString(10),
      rootUid: canonicalAfter.uid.toString(10),
      rootModeBits: modeStringV1(privateModeBitsV1(canonicalAfter.mode)),
      filesystemTypeCode,
    },
  };
}

/**
 * Re-probe the same canonical root and reject replacement/reparenting or
 * metadata changes.  The returned observation is fresh private evidence.
 */
export async function assertProviderRuntimeTargetContinuityV1(
  baseline: ProviderRuntimeTargetInspectionV1,
): Promise<ProviderRuntimeTargetInspectionV1> {
  if (baseline.profile !== TARGET_INSPECTION_PROFILE_V1) {
    throw new ProviderRuntimeTargetInspectionErrorV1(
      "invalid_root",
      "provider runtime target baseline profile is invalid",
    );
  }
  let current: ProviderRuntimeTargetInspectionV1;
  try {
    current = await probeProviderRuntimeTargetV1(baseline.canonicalRootPath);
  } catch (error) {
    if (error instanceof ProviderRuntimeTargetInspectionErrorV1) throw error;
    throw new ProviderRuntimeTargetInspectionErrorV1(
      "target_continuity_changed",
      `provider runtime target continuity probe failed: ${String(error)}`,
    );
  }
  if (!samePrivateIdentityV1(baseline, current)) {
    throw new ProviderRuntimeTargetInspectionErrorV1(
      "target_continuity_changed",
      "provider runtime target continuity no longer matches the baseline",
    );
  }
  return current;
}
