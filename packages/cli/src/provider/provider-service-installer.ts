import { createPrivateKey, type KeyObject } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import {
  provisionProviderServiceHandoffV1,
  ProviderServiceHandoffErrorV1,
  verifyProviderServiceHandoffConfigV1,
  type ProviderServiceProvisionResultV1,
} from "@understand-code/durable-object-provider-runtime";

const MAX_PATH_BYTES_V1 = 4_096;
const MAX_PRIVATE_KEY_BYTES_V1 = 16 * 1024;

export type ProviderServiceInstallerErrorCodeV1 =
  | "invalid_root"
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
  /** Existing signed handoff JSON. */
  readonly serviceConfig: string;
  /** Ed25519 PKCS#8 DER private key used to provision the service. */
  readonly serviceKey: string;
  /** Optional absolute descriptor path, primarily for package/test fixtures. */
  readonly serviceDescriptor?: string;
}

export type ProviderServiceInstallResultV1 = Readonly<{
  readonly ok: true;
  readonly status: "provisioned";
  readonly providerService: true;
  readonly authority: "read_only";
  readonly strongWrites: "locked";
  readonly platform: ProviderServiceProvisionResultV1["platform"];
  readonly root: string;
  readonly configPath: string;
  readonly descriptorPath: string;
  readonly descriptorDigest: ProviderServiceProvisionResultV1["descriptorDigest"];
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

/**
 * Reject symlink traversal in the root path while still allowing the final
 * runtime directory to be created by the privileged runtime handoff API.
 */
async function assertRootPathV1(root: string): Promise<void> {
  let current = root;
  while (true) {
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink()) {
        throw new ProviderServiceInstallerErrorV1(
          "invalid_root",
          "provider service root must not traverse a symlink",
        );
      }
      if (current === root && !metadata.isDirectory()) {
        throw new ProviderServiceInstallerErrorV1(
          "invalid_root",
          "provider service root must be a directory",
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
  let metadata: Awaited<ReturnType<typeof lstat>>;
  let raw: string;
  try {
    metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new ProviderServiceInstallerErrorV1(
        "invalid_config",
        "provider service config must be a regular file",
      );
    }
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof ProviderServiceInstallerErrorV1) throw error;
    throw new ProviderServiceInstallerErrorV1(
      isMissingPathErrorV1(error) ? "config_unavailable" : "io_error",
      "unable to read provider service config",
      { cause: error },
    );
  }
  try {
    return verifyProviderServiceHandoffConfigV1(JSON.parse(raw));
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
  let metadata: Awaited<ReturnType<typeof lstat>>;
  let bytes: Buffer;
  try {
    metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new ProviderServiceInstallerErrorV1(
        "invalid_private_key",
        "provider service key must be a regular file",
      );
    }
    if ((metadata.mode & 0o077) !== 0) {
      throw new ProviderServiceInstallerErrorV1(
        "invalid_private_key",
        "provider service key must be owner-only",
      );
    }
    bytes = await readFile(path);
  } catch (error) {
    if (error instanceof ProviderServiceInstallerErrorV1) throw error;
    throw new ProviderServiceInstallerErrorV1(
      "invalid_private_key",
      "unable to read provider service key",
      { cause: error },
    );
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PRIVATE_KEY_BYTES_V1) {
    bytes.fill(0);
    throw new ProviderServiceInstallerErrorV1(
      "invalid_private_key",
      "provider service key size is invalid",
    );
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
  const root = safeAbsolutePathV1(options.root, "root");
  const configPath = safeAbsolutePathV1(options.serviceConfig, "serviceConfig");
  const keyPath = safeAbsolutePathV1(options.serviceKey, "serviceKey");
  const descriptorPath =
    options.serviceDescriptor === undefined
      ? undefined
      : safeAbsolutePathV1(options.serviceDescriptor, "serviceDescriptor");

  await assertRootPathV1(root);
  const config = await readSignedConfigV1(configPath);
  if (config.payload.runtimeRoot !== root) {
    throw new ProviderServiceHandoffErrorV1(
      "identity_mismatch",
      "provider service root does not match signed handoff runtimeRoot",
    );
  }
  if (config.payload.configPath !== configPath) {
    throw new ProviderServiceHandoffErrorV1(
      "identity_mismatch",
      "provider service config path does not match signed handoff configPath",
    );
  }

  const privateKey = await readPrivateSigningKeyV1(keyPath);
  const provisioned = await provisionProviderServiceHandoffV1({
    config,
    privateKey,
    ...(descriptorPath === undefined ? {} : { descriptorPath }),
    configPath,
  });
  return {
    ok: true,
    status: provisioned.status,
    providerService: true,
    authority: provisioned.authority,
    strongWrites: provisioned.strongWrites,
    platform: provisioned.platform,
    root,
    configPath: provisioned.configPath,
    descriptorPath: provisioned.descriptorPath,
    descriptorDigest: provisioned.descriptorDigest,
  };
}
