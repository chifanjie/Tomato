import { createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

import {
  PROVIDER_SERVICE_INSTALLATION_MANIFEST_FILE_V1,
  doctorProviderServiceInstallationV1 as doctorProviderServiceInstallationRuntimeV1,
  installProviderServiceInstallationV1 as installProviderServiceInstallationRuntimeV1,
  rollbackProviderServiceInstallationV1 as rollbackProviderServiceInstallationRuntimeV1,
  uninstallProviderServiceInstallationV1 as uninstallProviderServiceInstallationRuntimeV1,
  upgradeProviderServiceInstallationV1 as upgradeProviderServiceInstallationRuntimeV1,
  defaultProviderServiceDescriptorPathV1,
  ProviderServiceHandoffErrorV1,
  verifyProviderServiceHandoffConfigV1,
  type ProviderServiceHandoffConfigV1,
  type ProviderServiceInstallationArtifactCheckV1,
  type ProviderServiceInstallationDoctorResultV1,
  type ProviderServiceInstallationInstallResultV1,
  type ProviderServiceInstallationRollbackResultV1,
  type ProviderServiceInstallationUninstallResultV1,
  type ProviderServiceInstallationUpgradeResultV1,
} from "@understand-code/durable-object-provider-runtime";

const MAX_PATH_BYTES_V1 = 4_096;
const MAX_SIGNED_CONFIG_BYTES_V1 = 1024 * 1024;
const MAX_PRIVATE_KEY_BYTES_V1 = 16 * 1024;

export type ProviderServiceInstallerErrorCodeV1 =
  | "invalid_root"
  | "invalid_manifest"
  | "config_unavailable"
  | "invalid_config"
  | "invalid_private_key"
  | "io_error";

/**
 * A CLI-facing error deliberately does not include key material or raw file
 * contents.  The runtime handoff error remains the authority for signature,
 * platform, principal, and root-only provisioning failures.
 */
export class ProviderServiceInstallerErrorV1 extends Error {
  readonly code: ProviderServiceInstallerErrorCodeV1;

  constructor(
    code: ProviderServiceInstallerErrorCodeV1,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "ProviderServiceInstallerErrorV1";
    this.code = code;
  }
}

export interface ProviderServiceInstallOptionsV1 {
  /** Exact runtime root named by the signed handoff payload. */
  readonly root: string;
  /** Fixed-name lifecycle manifest below its authority-owned parent. */
  readonly serviceManifest: string;
  /** Existing signed handoff JSON. */
  readonly serviceConfig: string;
  /** Ed25519 PKCS#8 DER private key used to provision the service. */
  readonly serviceKey: string;
  /** Optional absolute descriptor path, primarily for package/test fixtures. */
  readonly serviceDescriptor?: string;
}

export interface ProviderServiceUpgradeOptionsV1 {
  readonly root: string;
  readonly serviceManifest: string;
  readonly serviceConfig: string;
}

export interface ProviderServiceTargetOptionsV1 {
  readonly root: string;
  readonly serviceManifest: string;
}

type ProviderServiceCliResultBaseV1 = Readonly<{
  readonly providerService: true;
  readonly authority: "read_only";
  readonly strongWrites: "locked";
  readonly root: string;
  readonly installationRoot: string;
  readonly manifestPath: string;
}>;

export type ProviderServiceInstallResultV1 =
  ProviderServiceCliResultBaseV1 &
  Pick<ProviderServiceInstallationInstallResultV1, "status"> &
  Readonly<{ readonly ok: boolean }>;

export type ProviderServiceUpgradeResultV1 =
  ProviderServiceCliResultBaseV1 &
  Pick<
    ProviderServiceInstallationUpgradeResultV1,
    "status" | "rollbackAvailable"
  > &
  Readonly<{ readonly ok: boolean }>;

export type ProviderServiceRollbackResultV1 =
  ProviderServiceCliResultBaseV1 &
  Pick<ProviderServiceInstallationRollbackResultV1, "status"> &
  Readonly<{
    readonly ok: boolean;
    readonly removedArtifactCount: number;
    readonly refusedArtifactCount: number;
  }>;

export type ProviderServiceUninstallResultV1 =
  ProviderServiceCliResultBaseV1 &
  Pick<
    ProviderServiceInstallationUninstallResultV1,
    "status" | "retainedState"
  > &
  Readonly<{
    readonly ok: boolean;
    readonly removedArtifactCount: number;
    readonly refusedArtifactCount: number;
  }>;

export type ProviderServiceDoctorArtifactV1 = Readonly<
  Pick<ProviderServiceInstallationArtifactCheckV1, "kind" | "state">
>;

export type ProviderServiceDoctorResultV1 =
  ProviderServiceCliResultBaseV1 &
  Pick<
    ProviderServiceInstallationDoctorResultV1,
    "ok" | "status" | "manifestGeneration" | "rollbackAvailable"
  > &
  Readonly<{ readonly artifacts: readonly ProviderServiceDoctorArtifactV1[] }>;

type ProviderServiceResolvedTargetV1 = Readonly<{
  readonly expectedRuntimeRoot: string;
  readonly installationRoot: string;
  readonly manifestPath: string;
}>;

function safeAbsolutePathV1(value: string, label: string): string {
  if (
    typeof value !== "string" ||
    Buffer.byteLength(value, "utf8") > MAX_PATH_BYTES_V1 ||
    /[\u0000-\u001f\u007f]/u.test(value) ||
    !isAbsolute(value)
  ) {
    throw new ProviderServiceInstallerErrorV1(
      label === "root"
        ? "invalid_root"
        : label === "serviceKey"
          ? "invalid_private_key"
          : label === "serviceManifest"
            ? "invalid_manifest"
            : "invalid_config",
      `${label} must be an absolute path`,
    );
  }
  return resolve(value);
}

function isMissingPathErrorV1(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "ENOENT"
  );
}

function resolveLifecycleTargetV1(
  options: ProviderServiceTargetOptionsV1,
): ProviderServiceResolvedTargetV1 {
  const expectedRuntimeRoot = safeAbsolutePathV1(options.root, "root");
  const manifestPath = safeAbsolutePathV1(
    options.serviceManifest,
    "serviceManifest",
  );
  if (basename(manifestPath) !== PROVIDER_SERVICE_INSTALLATION_MANIFEST_FILE_V1) {
    throw new ProviderServiceInstallerErrorV1(
      "invalid_manifest",
      "provider service manifest path is invalid",
    );
  }
  const installationRoot = dirname(manifestPath);
  if (
    installationRoot === dirname(installationRoot) ||
    join(installationRoot, PROVIDER_SERVICE_INSTALLATION_MANIFEST_FILE_V1) !==
      manifestPath
  ) {
    throw new ProviderServiceInstallerErrorV1(
      "invalid_manifest",
      "provider service manifest path is invalid",
    );
  }
  return { expectedRuntimeRoot, installationRoot, manifestPath };
}

async function assertLifecycleTargetsV1(
  target: ProviderServiceResolvedTargetV1,
): Promise<void> {
  await assertRootPathV1(target.expectedRuntimeRoot, "invalid_root");
  await assertRootPathV1(target.installationRoot, "invalid_manifest");
}

/**
 * Reject symlink traversal in the root path while still allowing the final
 * runtime directory to be created by the privileged runtime handoff API.
 */
async function assertRootPathV1(
  root: string,
  code: "invalid_root" | "invalid_manifest",
): Promise<void> {
  let current = root;
  while (true) {
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink()) {
        throw new ProviderServiceInstallerErrorV1(
          code,
          "provider service target must not traverse a symlink",
        );
      }
      if (current === root && !metadata.isDirectory()) {
        throw new ProviderServiceInstallerErrorV1(
          code,
          "provider service target must be a directory",
        );
      }
    } catch (error) {
      if (error instanceof ProviderServiceInstallerErrorV1) throw error;
      if (!isMissingPathErrorV1(error)) {
        throw new ProviderServiceInstallerErrorV1(
          "io_error",
          "unable to inspect provider service root",
          { cause: error },
        );
      }
      const parent = dirname(current);
      if (parent === current) return;
      current = parent;
      continue;
    }
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

async function readSignedConfigV1(
  path: string,
): Promise<ReturnType<typeof verifyProviderServiceHandoffConfigV1>> {
  let bytes: Buffer | undefined;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const pathMetadata = await lstat(path);
    if (!pathMetadata.isFile() || pathMetadata.isSymbolicLink()) {
      throw new ProviderServiceInstallerErrorV1(
        "invalid_config",
        "provider service config must be a regular file",
      );
    }
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const metadata = await handle.stat();
    if (
      !metadata.isFile() ||
      metadata.dev !== pathMetadata.dev ||
      metadata.ino !== pathMetadata.ino ||
      metadata.nlink !== 1
    ) {
      throw new ProviderServiceInstallerErrorV1(
        "invalid_config",
        "provider service config file identity is invalid",
      );
    }
    if (metadata.size <= 0 || metadata.size > MAX_SIGNED_CONFIG_BYTES_V1) {
      throw new ProviderServiceInstallerErrorV1(
        "invalid_config",
        "provider service config size is invalid",
      );
    }
    bytes = await handle.readFile();
    const stableMetadata = await handle.stat();
    if (
      stableMetadata.dev !== metadata.dev ||
      stableMetadata.ino !== metadata.ino ||
      stableMetadata.size !== metadata.size ||
      stableMetadata.mtimeMs !== metadata.mtimeMs ||
      stableMetadata.ctimeMs !== metadata.ctimeMs ||
      stableMetadata.nlink !== metadata.nlink ||
      stableMetadata.nlink !== 1 ||
      bytes.byteLength !== metadata.size
    ) {
      throw new ProviderServiceInstallerErrorV1(
        "invalid_config",
        "provider service config changed while it was read",
      );
    }
  } catch (error) {
    if (error instanceof ProviderServiceInstallerErrorV1) throw error;
    throw new ProviderServiceInstallerErrorV1(
      isMissingPathErrorV1(error) ? "config_unavailable" : "io_error",
      "unable to read provider service config",
      { cause: error },
    );
  } finally {
    await handle?.close().catch(() => undefined);
  }
  try {
    return verifyProviderServiceHandoffConfigV1(
      JSON.parse(bytes.toString("utf8")),
    );
  } catch (error) {
    if (error instanceof ProviderServiceHandoffErrorV1) throw error;
    throw new ProviderServiceInstallerErrorV1(
      "invalid_config",
      "provider service config is not valid JSON",
      { cause: error },
    );
  }
}

async function readPrivateSigningKeyV1(path: string): Promise<KeyObject> {
  let bytes: Buffer | undefined;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const pathMetadata = await lstat(path);
    if (!pathMetadata.isFile() || pathMetadata.isSymbolicLink()) {
      throw new ProviderServiceInstallerErrorV1(
        "invalid_private_key",
        "provider service key must be a regular file",
      );
    }
    if (
      typeof process.getuid !== "function" ||
      typeof process.getgid !== "function"
    ) {
      throw new ProviderServiceInstallerErrorV1(
        "invalid_private_key",
        "provider service key owner is invalid",
      );
    }
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const metadata = await handle.stat();
    if (
      !metadata.isFile() ||
      metadata.dev !== pathMetadata.dev ||
      metadata.ino !== pathMetadata.ino ||
      metadata.uid !== process.getuid() ||
      metadata.gid !== process.getgid() ||
      (metadata.mode & 0o777) !== 0o600 ||
      metadata.nlink !== 1
    ) {
      throw new ProviderServiceInstallerErrorV1(
        "invalid_private_key",
        "provider service key owner or mode is invalid",
      );
    }
    if (metadata.size <= 0 || metadata.size > MAX_PRIVATE_KEY_BYTES_V1) {
      throw new ProviderServiceInstallerErrorV1(
        "invalid_private_key",
        "provider service key size is invalid",
      );
    }
    bytes = await handle.readFile();
    const stableMetadata = await handle.stat();
    if (
      stableMetadata.dev !== metadata.dev ||
      stableMetadata.ino !== metadata.ino ||
      stableMetadata.size !== metadata.size ||
      stableMetadata.mtimeMs !== metadata.mtimeMs ||
      stableMetadata.ctimeMs !== metadata.ctimeMs ||
      stableMetadata.uid !== metadata.uid ||
      stableMetadata.gid !== metadata.gid ||
      (stableMetadata.mode & 0o777) !== 0o600 ||
      stableMetadata.nlink !== 1 ||
      bytes.byteLength !== metadata.size
    ) {
      throw new ProviderServiceInstallerErrorV1(
        "invalid_private_key",
        "provider service key changed while it was read",
      );
    }
  } catch (error) {
    bytes?.fill(0);
    if (error instanceof ProviderServiceInstallerErrorV1) throw error;
    throw new ProviderServiceInstallerErrorV1(
      "invalid_private_key",
      "unable to read provider service key",
      { cause: error },
    );
  } finally {
    await handle?.close().catch(() => undefined);
  }
  try {
    return createPrivateKey({ key: bytes, format: "der", type: "pkcs8" });
  } catch (error) {
    throw new ProviderServiceInstallerErrorV1(
      "invalid_private_key",
      "provider service key is not a PKCS#8 private key",
      { cause: error },
    );
  } finally {
    bytes.fill(0);
  }
}

function assertSigningKeyMatchesConfigV1(
  privateKey: KeyObject,
  config: ProviderServiceHandoffConfigV1,
): void {
  try {
    if (privateKey.asymmetricKeyType !== "ed25519") throw new Error();
    const publicKey = createPublicKey(privateKey).export({
      format: "der",
      type: "spki",
    });
    if (`base64url:${Buffer.from(publicKey).toString("base64url")}` !== config.publicKey) {
      throw new Error();
    }
  } catch {
    throw new ProviderServiceInstallerErrorV1(
      "invalid_private_key",
      "provider service key does not match the signed config",
    );
  }
}

function baseResultV1(
  target: ProviderServiceResolvedTargetV1,
): ProviderServiceCliResultBaseV1 {
  return {
    providerService: true,
    authority: "read_only",
    strongWrites: "locked",
    root: target.expectedRuntimeRoot,
    installationRoot: target.installationRoot,
    manifestPath: target.manifestPath,
  };
}

/**
 * Privileged install entrypoint for a signed Provider Service Handoff.
 *
 * The command only installs the signed descriptor/config and principal-owned
 * runtime keys.  The returned authority is intentionally read-only and strong
 * writes remain locked until independent Registry/attestation gates pass.
 */
export async function installProviderServiceV1(
  options: ProviderServiceInstallOptionsV1,
): Promise<ProviderServiceInstallResultV1> {
  const target = resolveLifecycleTargetV1(options);
  const configPath = safeAbsolutePathV1(options.serviceConfig, "serviceConfig");
  const keyPath = safeAbsolutePathV1(options.serviceKey, "serviceKey");
  const descriptorPath =
    options.serviceDescriptor === undefined
      ? undefined
      : safeAbsolutePathV1(options.serviceDescriptor, "serviceDescriptor");

  await assertLifecycleTargetsV1(target);
  const config = await readSignedConfigV1(configPath);
  if (config.payload.runtimeRoot !== target.expectedRuntimeRoot) {
    throw new ProviderServiceHandoffErrorV1(
      "identity_mismatch",
      "provider service root does not match signed handoff runtimeRoot",
    );
  }
  if (
    descriptorPath !== undefined &&
    descriptorPath !==
      resolve(
        defaultProviderServiceDescriptorPathV1(
          config.payload.platform,
          config.payload.serviceLabel,
        ),
      )
  ) {
    throw new ProviderServiceInstallerErrorV1(
      "invalid_config",
      "provider service descriptor path is invalid",
    );
  }
  const privateKey = await readPrivateSigningKeyV1(keyPath);
  assertSigningKeyMatchesConfigV1(privateKey, config);
  const installed = await installProviderServiceInstallationRuntimeV1({
    installationRoot: target.installationRoot,
    expectedRuntimeRoot: target.expectedRuntimeRoot,
    config,
    privateKey,
    ...(descriptorPath === undefined ? {} : { descriptorPath }),
  });
  return {
    ...baseResultV1(target),
    ok: installed.status !== "refused",
    status: installed.status,
  };
}

export async function doctorProviderServiceV1(
  options: ProviderServiceTargetOptionsV1,
): Promise<ProviderServiceDoctorResultV1> {
  const target = resolveLifecycleTargetV1(options);
  await assertLifecycleTargetsV1(target);
  const doctor = await doctorProviderServiceInstallationRuntimeV1({
    installationRoot: target.installationRoot,
    expectedRuntimeRoot: target.expectedRuntimeRoot,
  });
  return {
    ...baseResultV1(target),
    ok: doctor.ok,
    status: doctor.status,
    artifacts: Object.freeze(
      doctor.artifacts.map(({ kind, state }) => Object.freeze({ kind, state })),
    ),
    ...(doctor.manifestGeneration === undefined
      ? {}
      : { manifestGeneration: doctor.manifestGeneration }),
    ...(doctor.rollbackAvailable === undefined
      ? {}
      : { rollbackAvailable: doctor.rollbackAvailable }),
  };
}

export async function upgradeProviderServiceV1(
  options: ProviderServiceUpgradeOptionsV1,
): Promise<ProviderServiceUpgradeResultV1> {
  const target = resolveLifecycleTargetV1(options);
  const configPath = safeAbsolutePathV1(options.serviceConfig, "serviceConfig");
  await assertLifecycleTargetsV1(target);
  const config = await readSignedConfigV1(configPath);
  const upgraded = await upgradeProviderServiceInstallationRuntimeV1({
    installationRoot: target.installationRoot,
    expectedRuntimeRoot: target.expectedRuntimeRoot,
    config,
  });
  return {
    ...baseResultV1(target),
    ok: upgraded.status === "updated" || upgraded.status === "already_current",
    status: upgraded.status,
    ...(upgraded.rollbackAvailable === undefined
      ? {}
      : { rollbackAvailable: upgraded.rollbackAvailable }),
  };
}

export async function rollbackProviderServiceV1(
  options: ProviderServiceTargetOptionsV1,
): Promise<ProviderServiceRollbackResultV1> {
  const target = resolveLifecycleTargetV1(options);
  await assertLifecycleTargetsV1(target);
  const rolledBack = await rollbackProviderServiceInstallationRuntimeV1({
    installationRoot: target.installationRoot,
    expectedRuntimeRoot: target.expectedRuntimeRoot,
  });
  return {
    ...baseResultV1(target),
    ok:
      rolledBack.status === "rolled_back" ||
      rolledBack.status === "not_available",
    status: rolledBack.status,
    removedArtifactCount: rolledBack.removedPaths.length,
    refusedArtifactCount: rolledBack.refusedPaths.length,
  };
}

export async function uninstallProviderServiceV1(
  options: ProviderServiceTargetOptionsV1,
): Promise<ProviderServiceUninstallResultV1> {
  const target = resolveLifecycleTargetV1(options);
  await assertLifecycleTargetsV1(target);
  const uninstalled = await uninstallProviderServiceInstallationRuntimeV1({
    installationRoot: target.installationRoot,
    expectedRuntimeRoot: target.expectedRuntimeRoot,
  });
  return {
    ...baseResultV1(target),
    ok:
      uninstalled.status === "removed_with_retained_state" ||
      uninstalled.status === "not_installed",
    status: uninstalled.status,
    removedArtifactCount: uninstalled.removedPaths.length,
    refusedArtifactCount: uninstalled.refusedPaths.length,
    ...(uninstalled.retainedState === undefined
      ? {}
      : { retainedState: Object.freeze([...uninstalled.retainedState]) }),
  };
}
