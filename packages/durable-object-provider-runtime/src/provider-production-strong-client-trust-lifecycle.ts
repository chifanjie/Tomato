import {
  createHash,
  createPublicKey,
  sign,
  type KeyObject,
} from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  chmod,
  chown,
  link,
  lstat,
  mkdir,
  open,
  rename,
  rmdir,
  unlink,
} from "node:fs/promises";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  ContentDigestV1Schema,
  type ContentDigestV1,
} from "@understand-code/durable-object-provider-contracts/primitives";

import {
  verifyProviderServiceHandoffConfigV1,
  type ProviderServiceHandoffConfigV1,
} from "./service-handoff.js";

export const PROVIDER_PRODUCTION_STRONG_CLIENT_TRUST_FILE_V1 =
  "provider-production-strong-client-trust-v1.json" as const;
export const PROVIDER_PRODUCTION_STRONG_CLIENT_TRUST_ROLLBACK_FILE_V1 =
  ".provider-production-strong-client-trust-rollback-v1.json" as const;
export const PROVIDER_PRODUCTION_STRONG_CLIENT_DESCRIPTOR_SUFFIX_V1 =
  ".provider-production-strong-client-v1.json" as const;
export const PROVIDER_PRODUCTION_STRONG_OBJECT_GATEWAY_SOCKET_FILE_V1 =
  "provider-production-strong-object-gateway-v1.sock" as const;

export const PROVIDER_PRODUCTION_STRONG_CLIENT_TRUST_PROFILE_V1 =
  "provider_production_strong_client_trust_snapshot_v1" as const;
export const PROVIDER_PRODUCTION_STRONG_CLIENT_DESCRIPTOR_PROFILE_V1 =
  "provider_production_strong_client_descriptor_v1" as const;
const ROLLBACK_PROFILE_V1 =
  "provider_production_strong_client_trust_rollback_v1" as const;
const TRANSACTION_PROFILE_V1 =
  "provider_production_strong_client_trust_transaction_v1" as const;
const TRANSACTION_FILE_V1 =
  ".provider-production-strong-client-trust-transaction-v1.json" as const;
const MAX_FILE_BYTES_V1 = 16 * 1024 * 1024;
const MAX_TRANSACTION_BYTES_V1 = 64 * 1024 * 1024;
const O_CLOEXEC_V1 =
  (fsConstants as Readonly<Record<string, number>>)["O_CLOEXEC"] ?? 0;

export interface ProviderProductionStrongClientCallerPrincipalV1 {
  readonly uid: number;
  readonly gid: number;
}

export interface ProviderProductionStrongClientTrustMaterialV1 {
  readonly canonicalTargetRoot: string;
  readonly targetProfileId: string;
  readonly targetFingerprintDigest: string;
  readonly acceptanceHistory: readonly unknown[];
  readonly currentAcceptance: unknown;
  readonly registryHistory: unknown;
  readonly grantKeyPath: string;
  readonly callerPrincipal: ProviderProductionStrongClientCallerPrincipalV1;
}

export interface InstallProviderProductionStrongClientTrustV1Input {
  readonly canonicalInstallationRoot: string;
  readonly serviceConfig: ProviderServiceHandoffConfigV1;
  readonly servicePrivateKey: KeyObject;
  readonly trust: ProviderProductionStrongClientTrustMaterialV1;
}

export interface ProviderProductionStrongClientTrustLifecycleResultV1 {
  readonly status: "installed" | "rotated" | "rolled_back" | "uninstalled";
  readonly snapshotPath: string;
  readonly descriptorPath: string;
  readonly gatewaySocketPath: string;
}

interface GeneratedFilesV1 {
  readonly snapshotPath: string;
  readonly descriptorPath: string;
  readonly rollbackPath: string;
  readonly gatewaySocketPath: string;
  readonly gatewayDirectoryPath: string;
  readonly servicePrincipal: Readonly<{ readonly uid: number; readonly gid: number }>;
  readonly callerPrincipal: Readonly<{ readonly uid: number; readonly gid: number }>;
  readonly snapshotBytes: Buffer;
  readonly descriptorBytes: Buffer;
}

type TransactionOperationV1 = "install" | "rotate" | "rollback" | "uninstall";

interface TransactionPayloadV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof TRANSACTION_PROFILE_V1;
  readonly operation: TransactionOperationV1;
  readonly phase: string;
  readonly installationRoot: string;
  readonly snapshotPath: string;
  readonly descriptorPath: string;
  readonly rollbackPath: string;
  readonly gatewayDirectoryPath: string;
  readonly gatewaySocketPath: string;
  readonly serviceUid: number;
  readonly callerGid: number;
  readonly snapshotBytes: `base64url:${string}` | null;
  readonly descriptorBytes: `base64url:${string}` | null;
  readonly rollbackBytes: `base64url:${string}` | null;
}

function failV1(message: string): never {
  throw new TypeError(message);
}

function exactPathV1(value: unknown, label: string): string {
  if (
    typeof value !== "string" || value.includes("\0") ||
    !isAbsolute(value) || resolve(value) !== value || value === "/"
  ) return failV1(`${label} is invalid`);
  return value;
}

function kernelIdV1(value: unknown, label: string): number {
  if (
    !Number.isSafeInteger(value) || (value as number) < 0 ||
    (value as number) > 0xffff_ffff
  ) return failV1(`${label} is invalid`);
  return value as number;
}

function sha256V1(bytes: Uint8Array): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  );
}

function canonicalBytesV1(value: unknown): Buffer {
  return Buffer.from(canonicalizeJcsSafeIntegerV1(value), "utf8");
}

export function providerProductionStrongClientDescriptorPathV1(
  canonicalInstallationRoot: string,
): string {
  const root = exactPathV1(
    canonicalInstallationRoot,
    "production strong client installation root",
  );
  return exactPathV1(
    `${root}${PROVIDER_PRODUCTION_STRONG_CLIENT_DESCRIPTOR_SUFFIX_V1}`,
    "production strong client descriptor path",
  );
}

export function providerProductionStrongClientGatewayDirectoryPathV1(
  canonicalInstallationRoot: string,
): string {
  const root = exactPathV1(
    canonicalInstallationRoot,
    "production strong client installation root",
  );
  const selector = createHash("sha256").update(root, "utf8").digest("hex").slice(0, 32);
  return `/run/understand-code-provider-strong-client-${selector}`;
}

export function providerProductionStrongClientGatewaySocketPathV1(
  canonicalInstallationRoot: string,
): string {
  return join(
    providerProductionStrongClientGatewayDirectoryPathV1(canonicalInstallationRoot),
    PROVIDER_PRODUCTION_STRONG_OBJECT_GATEWAY_SOCKET_FILE_V1,
  );
}

async function assertRootInstallationV1(root: string): Promise<void> {
  if (typeof process.geteuid !== "function" || process.geteuid() !== 0) {
    failV1("production strong client trust lifecycle requires root");
  }
  const metadata = await lstat(root, { bigint: true });
  if (
    !metadata.isDirectory() || metadata.isSymbolicLink() ||
    metadata.uid !== 0n || (metadata.mode & 0o777n) !== 0o700n
  ) failV1("production strong client installation root is invalid");
}

const TRANSACTION_LOCK_FILE_V1 =
  ".provider-production-strong-client-trust-lifecycle.lock" as const;

async function ensureLifecycleLockFileV1(path: string): Promise<void> {
  try {
    const metadata = await lstat(path, { bigint: true });
    if (
      !metadata.isFile() || metadata.isSymbolicLink() || metadata.uid !== 0n ||
      metadata.nlink !== 1n || (metadata.mode & 0o777n) !== 0o600n
    ) failV1("production strong client lifecycle lock is invalid");
  } catch (error) {
    if (
      !(typeof error === "object" && error !== null && "code" in error &&
        (error as { readonly code?: unknown }).code === "ENOENT")
    ) throw error;
    const handle = await open(
      path,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL |
        fsConstants.O_NOFOLLOW | O_CLOEXEC_V1,
      0o600,
    );
    try {
      await handle.chown(0, 0);
      await handle.chmod(0o600);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fsyncDirectoryV1(dirname(path));
  }
}

async function withInstallationGlobalLifecycleMutexV1<T>(
  root: string,
  operation: () => Promise<T>,
): Promise<T> {
  const canonicalRoot = exactPathV1(
    root,
    "production strong client installation root",
  );
  await assertRootInstallationV1(canonicalRoot);
  const lockPath = join(canonicalRoot, TRANSACTION_LOCK_FILE_V1);
  await ensureLifecycleLockFileV1(lockPath);
  const child: ChildProcessWithoutNullStreams = spawn(
    "/usr/bin/flock",
    ["-n", lockPath, "-c", "printf ready; cat"],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  let ready = false;
  let readyBuffer = Buffer.alloc(0);
  let spawnError: Error | undefined;
  child.stdout.on("data", (chunk: Buffer) => {
    readyBuffer = Buffer.concat([readyBuffer, chunk]);
    if (readyBuffer.subarray(0, 5).toString("utf8") === "ready") ready = true;
  });
  child.once("error", (error) => {
    spawnError = error;
  });
  await new Promise<void>((resolvePromise) => {
    const timer = setTimeout(() => resolvePromise(), 2_000);
    const check = (): void => {
      if (ready || spawnError !== undefined || child.exitCode !== null) {
        clearTimeout(timer);
        resolvePromise();
      } else setImmediate(check);
    };
    check();
  });
  readyBuffer.fill(0);
  if (!ready) {
    child.kill();
    await new Promise<void>((resolvePromise) => child.once("close", () => resolvePromise()));
    return failV1(
      spawnError === undefined
        ? "production strong client trust lifecycle is busy"
        : "production strong client lifecycle lock is unavailable",
    );
  }
  try {
    return await operation();
  } finally {
    child.stdin.end();
    await new Promise<void>((resolvePromise) => {
      if (child.exitCode !== null) resolvePromise();
      else child.once("close", () => resolvePromise());
    });
  }
}

async function readExactRootFileV1(
  path: string,
  maximumBytes = MAX_FILE_BYTES_V1,
): Promise<Buffer> {
  const handle = await open(
    path,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | O_CLOEXEC_V1,
  );
  try {
    const before = await handle.stat({ bigint: true });
    if (
      !before.isFile() || before.uid !== 0n || before.nlink !== 1n ||
      (before.mode & 0o022n) !== 0n || before.size < 1n ||
      before.size > BigInt(maximumBytes)
    ) failV1("production strong client lifecycle file is invalid");
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    const projected = await lstat(path, { bigint: true });
    if (
      after.dev !== before.dev || after.ino !== before.ino ||
      after.mode !== before.mode || after.uid !== before.uid ||
      after.gid !== before.gid || after.nlink !== before.nlink ||
      after.size !== before.size || after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs || projected.dev !== before.dev ||
      projected.ino !== before.ino || projected.isSymbolicLink() ||
      bytes.byteLength !== Number(before.size)
    ) failV1("production strong client lifecycle file changed during read");
    return bytes;
  } finally {
    await handle.close();
  }
}

async function fsyncDirectoryV1(path: string): Promise<void> {
  const handle = await open(
    path,
    fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | O_CLOEXEC_V1,
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function atomicWriteRootFileV1(
  path: string,
  bytes: Uint8Array,
  mode: number,
  replace: boolean,
  maximumBytes = MAX_FILE_BYTES_V1,
): Promise<void> {
  if (bytes.byteLength < 1 || bytes.byteLength > maximumBytes) {
    failV1("production strong client lifecycle bytes are invalid");
  }
  const parent = dirname(path);
  await mkdir(parent, { recursive: true, mode: 0o755 });
  const temporary = `${path}.provider-production-strong-client-stage-v1`;
  let published = false;
  try {
    try {
      const staged = await lstat(temporary);
      if (
        !staged.isFile() || staged.isSymbolicLink() || staged.uid !== 0 ||
        staged.nlink < 1 || staged.nlink > 2
      ) failV1("production strong client lifecycle stage is invalid");
      try {
        const target = await lstat(path);
        if (target.dev === staged.dev && target.ino === staged.ino) {
          await unlink(temporary);
          await fsyncDirectoryV1(parent);
        } else {
          await unlink(temporary);
        }
      } catch (error) {
        if (
          typeof error === "object" && error !== null && "code" in error &&
          (error as { readonly code?: unknown }).code === "ENOENT"
        ) await unlink(temporary);
        else throw error;
      }
    } catch (error) {
      if (
        !(typeof error === "object" && error !== null && "code" in error &&
          (error as { readonly code?: unknown }).code === "ENOENT")
      ) throw error;
    }
    if (!replace) {
      try {
        const existing = await readExactRootFileV1(path);
        try {
          const metadata = await lstat(path);
          if (
            !existing.equals(bytes) || (metadata.mode & 0o777) !== mode
          ) failV1("production strong client lifecycle target already exists");
          return;
        } finally {
          existing.fill(0);
        }
      } catch (error) {
        if (
          !(typeof error === "object" && error !== null && "code" in error &&
            (error as { readonly code?: unknown }).code === "ENOENT")
        ) throw error;
      }
    }
    const handle = await open(
      temporary,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL |
        fsConstants.O_NOFOLLOW | O_CLOEXEC_V1,
      mode,
    );
    try {
      await handle.writeFile(bytes);
      await handle.sync();
      await handle.chown(0, 0);
      await handle.chmod(mode);
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (replace) {
      await rename(temporary, path);
      published = true;
    } else {
      try {
        await link(temporary, path);
      } catch (error) {
        if (
          !(typeof error === "object" && error !== null && "code" in error &&
            (error as { readonly code?: unknown }).code === "EEXIST")
        ) throw error;
        const existing = await readExactRootFileV1(path);
        try {
          if (!existing.equals(bytes)) {
            failV1("production strong client lifecycle target already exists");
          }
        } finally {
          existing.fill(0);
        }
      }
      await fsyncDirectoryV1(parent);
      await unlink(temporary);
      published = true;
    }
    await fsyncDirectoryV1(parent);
  } finally {
    if (!published) await unlink(temporary).catch(() => undefined);
  }
}

function assertServicePrivateKeyV1(
  config: ProviderServiceHandoffConfigV1,
  key: KeyObject,
): void {
  if (
    key.type !== "private" || key.asymmetricKeyType !== "ed25519" ||
    `base64url:${createPublicKey(key)
      .export({ format: "der", type: "spki" }).toString("base64url")}` !==
      config.publicKey
  ) failV1("production strong client service key is invalid");
}

function generateFilesV1(
  input: InstallProviderProductionStrongClientTrustV1Input,
): GeneratedFilesV1 {
  const root = exactPathV1(
    input.canonicalInstallationRoot,
    "production strong client installation root",
  );
  const config = verifyProviderServiceHandoffConfigV1(input.serviceConfig);
  if (process.platform !== "linux" || config.payload.platform !== "linux") {
    failV1("production strong client platform is unavailable");
  }
  assertServicePrivateKeyV1(config, input.servicePrivateKey);
  const callerPrincipal = Object.freeze({
    uid: kernelIdV1(input.trust.callerPrincipal.uid, "caller uid"),
    gid: kernelIdV1(input.trust.callerPrincipal.gid, "caller gid"),
  });
  if (
    callerPrincipal.uid === 0 ||
    callerPrincipal.gid === 0 ||
    config.payload.principal.gid === 0 ||
    callerPrincipal.uid === config.payload.principal.uid
  ) failV1("production strong client caller principal is not isolated");
  const payload = Object.freeze({
    serviceConfig: config,
    canonicalTargetRoot: exactPathV1(
      input.trust.canonicalTargetRoot,
      "production strong client target root",
    ),
    targetProfileId: input.trust.targetProfileId,
    targetFingerprintDigest: input.trust.targetFingerprintDigest,
    acceptanceHistory: input.trust.acceptanceHistory,
    currentAcceptance: input.trust.currentAcceptance,
    registryHistory: input.trust.registryHistory,
    grantKeyPath: exactPathV1(
      input.trust.grantKeyPath,
      "production strong client grant key path",
    ),
    callerPrincipal,
  });
  const payloadBytes = canonicalBytesV1(payload);
  const snapshot = Object.freeze({
    schemaVersion: 1 as const,
    profile: PROVIDER_PRODUCTION_STRONG_CLIENT_TRUST_PROFILE_V1,
    payload,
    payloadDigest: sha256V1(payloadBytes),
    signature: `base64url:${sign(null, payloadBytes, input.servicePrivateKey)
      .toString("base64url")}`,
  });
  payloadBytes.fill(0);
  const snapshotBytes = canonicalBytesV1(snapshot);
  const snapshotPath = exactPathV1(
    join(root, PROVIDER_PRODUCTION_STRONG_CLIENT_TRUST_FILE_V1),
    "production strong client trust path",
  );
  const descriptorPath = providerProductionStrongClientDescriptorPathV1(root);
  const gatewayDirectoryPath = providerProductionStrongClientGatewayDirectoryPathV1(root);
  const gatewaySocketPath = providerProductionStrongClientGatewaySocketPathV1(root);
  const descriptorPayload = Object.freeze({
    schemaVersion: 1 as const,
    profile: PROVIDER_PRODUCTION_STRONG_CLIENT_DESCRIPTOR_PROFILE_V1,
    canonicalInstallationRoot: root,
    providerId: config.payload.providerId,
    serviceConfigPayloadDigest: config.payloadDigest,
    // The descriptor carries the narrow peer-identity projection consumed by
    // the gateway.  Keep handoff-only `kind` out of this exact-key payload;
    // retaining it would make the reader reject every production descriptor.
    servicePrincipal: Object.freeze({
      name: config.payload.principal.name,
      uid: config.payload.principal.uid,
      gid: config.payload.principal.gid,
    }),
    callerPrincipal,
    gatewaySocketPath,
    trustSnapshotDigest: sha256V1(snapshotBytes),
  });
  const descriptorBytes = canonicalBytesV1(Object.freeze({
    payload: descriptorPayload,
    contentDigest: sha256V1(canonicalBytesV1([
      "provider-production-strong-client-descriptor-v1",
      descriptorPayload,
    ])),
  }));
  return Object.freeze({
    snapshotPath,
    descriptorPath,
    rollbackPath: exactPathV1(
      join(root, PROVIDER_PRODUCTION_STRONG_CLIENT_TRUST_ROLLBACK_FILE_V1),
      "production strong client rollback path",
    ),
    gatewaySocketPath,
    gatewayDirectoryPath,
    servicePrincipal: Object.freeze({
      uid: config.payload.principal.uid,
      gid: config.payload.principal.gid,
    }),
    callerPrincipal,
    snapshotBytes,
    descriptorBytes,
  });
}

function resultV1(
  status: ProviderProductionStrongClientTrustLifecycleResultV1["status"],
  files: Pick<GeneratedFilesV1, "snapshotPath" | "descriptorPath" | "gatewaySocketPath">,
): ProviderProductionStrongClientTrustLifecycleResultV1 {
  return Object.freeze({ status, ...files });
}

function transactionPathV1(root: string): string {
  return join(root, TRANSACTION_FILE_V1);
}

function encodedBytesV1(bytes: Uint8Array | null): `base64url:${string}` | null {
  return bytes === null ? null : `base64url:${Buffer.from(bytes).toString("base64url")}`;
}

function decodedBytesV1(
  value: unknown,
  label: string,
): Buffer | null {
  if (value === null) return null;
  if (typeof value !== "string" || !value.startsWith("base64url:")) {
    return failV1(`${label} is invalid`);
  }
  const bytes = Buffer.from(value.slice("base64url:".length), "base64url");
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_FILE_BYTES_V1) {
    bytes.fill(0);
    return failV1(`${label} is invalid`);
  }
  return bytes;
}

function transactionEnvelopeBytesV1(payload: TransactionPayloadV1): Buffer {
  return canonicalBytesV1(Object.freeze({
    payload,
    contentDigest: sha256V1(canonicalBytesV1([
      TRANSACTION_PROFILE_V1,
      payload,
    ])),
  }));
}

async function observeTransactionPhaseForTestV1(phase: string): Promise<void> {
  if (
    process.env.NODE_ENV === "test" &&
    process.env.PROVIDER_STRONG_CLIENT_LIFECYCLE_CRASH_PHASE_V1 === phase
  ) {
    process.kill(process.pid, "SIGKILL");
    await new Promise<never>(() => undefined);
  }
}

async function persistTransactionV1(
  payload: TransactionPayloadV1,
  replace: boolean,
): Promise<void> {
  const bytes = transactionEnvelopeBytesV1(payload);
  try {
    await atomicWriteRootFileV1(
      transactionPathV1(payload.installationRoot),
      bytes,
      0o600,
      replace,
      MAX_TRANSACTION_BYTES_V1,
    );
  } finally {
    bytes.fill(0);
  }
  await observeTransactionPhaseForTestV1(payload.phase);
}

async function advanceTransactionV1(
  payload: TransactionPayloadV1,
  phase: string,
): Promise<TransactionPayloadV1> {
  const next = Object.freeze({ ...payload, phase });
  await persistTransactionV1(next, true);
  return next;
}

function transactionPayloadV1(input: {
  readonly operation: TransactionOperationV1;
  readonly files: Pick<
    GeneratedFilesV1,
    | "snapshotPath"
    | "descriptorPath"
    | "rollbackPath"
    | "gatewayDirectoryPath"
    | "gatewaySocketPath"
    | "servicePrincipal"
    | "callerPrincipal"
  >;
  readonly root: string;
  readonly snapshotBytes: Uint8Array | null;
  readonly descriptorBytes: Uint8Array | null;
  readonly rollbackBytes: Uint8Array | null;
}): TransactionPayloadV1 {
  return Object.freeze({
    schemaVersion: 1 as const,
    profile: TRANSACTION_PROFILE_V1,
    operation: input.operation,
    phase: "prepared",
    installationRoot: input.root,
    snapshotPath: input.files.snapshotPath,
    descriptorPath: input.files.descriptorPath,
    rollbackPath: input.files.rollbackPath,
    gatewayDirectoryPath: input.files.gatewayDirectoryPath,
    gatewaySocketPath: input.files.gatewaySocketPath,
    serviceUid: input.files.servicePrincipal.uid,
    callerGid: input.files.callerPrincipal.gid,
    snapshotBytes: encodedBytesV1(input.snapshotBytes),
    descriptorBytes: encodedBytesV1(input.descriptorBytes),
    rollbackBytes: encodedBytesV1(input.rollbackBytes),
  });
}

function parseTransactionPayloadV1(
  root: string,
  value: unknown,
): TransactionPayloadV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return failV1("production strong client transaction is invalid");
  }
  const envelope = value as Record<string, unknown>;
  if (
    Object.keys(envelope).sort().join("\0") !==
      ["payload", "contentDigest"].sort().join("\0") ||
    typeof envelope.payload !== "object" || envelope.payload === null ||
    Array.isArray(envelope.payload)
  ) return failV1("production strong client transaction is invalid");
  const payload = envelope.payload as Record<string, unknown>;
  const keys = [
    "schemaVersion", "profile", "operation", "phase", "installationRoot",
    "snapshotPath", "descriptorPath", "rollbackPath", "gatewayDirectoryPath",
    "gatewaySocketPath", "serviceUid", "callerGid", "snapshotBytes",
    "descriptorBytes", "rollbackBytes",
  ].sort();
  if (
    Object.keys(payload).sort().join("\0") !== keys.join("\0") ||
    payload.schemaVersion !== 1 || payload.profile !== TRANSACTION_PROFILE_V1 ||
    !["install", "rotate", "rollback", "uninstall"].includes(
      payload.operation as string,
    ) || typeof payload.phase !== "string" ||
    payload.installationRoot !== root ||
    payload.snapshotPath !== join(root, PROVIDER_PRODUCTION_STRONG_CLIENT_TRUST_FILE_V1) ||
    payload.descriptorPath !== providerProductionStrongClientDescriptorPathV1(root) ||
    payload.rollbackPath !== join(root, PROVIDER_PRODUCTION_STRONG_CLIENT_TRUST_ROLLBACK_FILE_V1) ||
    payload.gatewayDirectoryPath !== providerProductionStrongClientGatewayDirectoryPathV1(root) ||
    payload.gatewaySocketPath !== providerProductionStrongClientGatewaySocketPathV1(root) ||
    envelope.contentDigest !== sha256V1(canonicalBytesV1([
      TRANSACTION_PROFILE_V1,
      payload,
    ]))
  ) return failV1("production strong client transaction is invalid");
  kernelIdV1(payload.serviceUid, "transaction service uid");
  kernelIdV1(payload.callerGid, "transaction caller gid");
  decodedBytesV1(payload.snapshotBytes, "transaction snapshot")?.fill(0);
  decodedBytesV1(payload.descriptorBytes, "transaction descriptor")?.fill(0);
  decodedBytesV1(payload.rollbackBytes, "transaction rollback")?.fill(0);
  return payload as unknown as TransactionPayloadV1;
}

async function readTransactionV1(root: string): Promise<TransactionPayloadV1 | undefined> {
  let bytes: Buffer;
  try {
    bytes = await readExactRootFileV1(
      transactionPathV1(root),
      MAX_TRANSACTION_BYTES_V1,
    );
  } catch (error) {
    if (
      typeof error === "object" && error !== null && "code" in error &&
      (error as { readonly code?: unknown }).code === "ENOENT"
    ) return undefined;
    throw error;
  }
  try {
    return parseTransactionPayloadV1(
      root,
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
  } finally {
    bytes.fill(0);
  }
}

async function ensureGatewayDirectoryV1(payload: TransactionPayloadV1): Promise<void> {
  let created = false;
  try {
    await mkdir(payload.gatewayDirectoryPath, { mode: 0o710 });
    created = true;
  } catch (error) {
    if (
      !(typeof error === "object" && error !== null && "code" in error &&
        (error as { readonly code?: unknown }).code === "EEXIST")
    ) throw error;
  }
  const before = await lstat(payload.gatewayDirectoryPath);
  if (
    !before.isDirectory() || before.isSymbolicLink() ||
    (!created && (
      before.uid !== payload.serviceUid || before.gid !== payload.callerGid ||
      (before.mode & 0o777) !== 0o710
    ))
  ) {
    failV1("production strong client gateway directory is invalid");
  }
  if (created) {
    await chown(payload.gatewayDirectoryPath, payload.serviceUid, payload.callerGid);
    await chmod(payload.gatewayDirectoryPath, 0o710);
  }
  const after = await lstat(payload.gatewayDirectoryPath);
  if (
    !after.isDirectory() || after.isSymbolicLink() ||
    after.dev !== before.dev || after.ino !== before.ino ||
    after.uid !== payload.serviceUid || after.gid !== payload.callerGid ||
    (after.mode & 0o777) !== 0o710
  ) failV1("production strong client gateway directory is invalid");
  await fsyncDirectoryV1(dirname(payload.gatewayDirectoryPath));
}

async function unlinkExactRootFileIfPresentV1(path: string): Promise<void> {
  try {
    await unlinkExactRootFileV1(path);
  } catch (error) {
    if (
      typeof error === "object" && error !== null && "code" in error &&
      (error as { readonly code?: unknown }).code === "ENOENT"
    ) return;
    throw error;
  }
}

async function convergeTransactionV1(
  initial: TransactionPayloadV1,
): Promise<TransactionPayloadV1> {
  let payload = initial;
  const snapshot = decodedBytesV1(payload.snapshotBytes, "transaction snapshot");
  const descriptor = decodedBytesV1(payload.descriptorBytes, "transaction descriptor");
  const rollback = decodedBytesV1(payload.rollbackBytes, "transaction rollback");
  try {
    if (payload.operation !== "uninstall") {
      if (snapshot === null || descriptor === null) {
        return failV1("production strong client transaction is invalid");
      }
      await ensureGatewayDirectoryV1(payload);
      payload = await advanceTransactionV1(payload, "gateway_directory_durable");
    }
    if (payload.operation === "rotate") {
      if (rollback === null) return failV1("production strong client transaction is invalid");
      await atomicWriteRootFileV1(payload.rollbackPath, rollback, 0o600, true);
      payload = await advanceTransactionV1(payload, "rollback_durable");
    }
    if (payload.operation === "install") {
      await atomicWriteRootFileV1(payload.snapshotPath, snapshot!, 0o600, false);
      payload = await advanceTransactionV1(payload, "snapshot_durable");
      await atomicWriteRootFileV1(payload.descriptorPath, descriptor!, 0o644, false);
      payload = await advanceTransactionV1(payload, "descriptor_durable");
    } else if (payload.operation === "rotate" || payload.operation === "rollback") {
      await atomicWriteRootFileV1(payload.snapshotPath, snapshot!, 0o600, true);
      payload = await advanceTransactionV1(payload, "snapshot_durable");
      await atomicWriteRootFileV1(payload.descriptorPath, descriptor!, 0o644, true);
      payload = await advanceTransactionV1(payload, "descriptor_durable");
    } else {
      await unlinkExactRootFileIfPresentV1(payload.descriptorPath);
      payload = await advanceTransactionV1(payload, "descriptor_removed");
      await unlinkExactRootFileIfPresentV1(payload.rollbackPath);
      payload = await advanceTransactionV1(payload, "rollback_removed");
      await unlinkExactRootFileIfPresentV1(payload.snapshotPath);
      payload = await advanceTransactionV1(payload, "snapshot_removed");
      try {
        const socket = await lstat(payload.gatewaySocketPath);
        if (socket.isSocket()) {
          failV1("production strong client gateway must be stopped before uninstall");
        }
        failV1("production strong client gateway path is invalid");
      } catch (error) {
        if (
          !(typeof error === "object" && error !== null && "code" in error &&
            (error as { readonly code?: unknown }).code === "ENOENT")
        ) throw error;
      }
      try {
        const gatewayDirectory = await lstat(payload.gatewayDirectoryPath);
        if (
          !gatewayDirectory.isDirectory() || gatewayDirectory.isSymbolicLink() ||
          gatewayDirectory.uid !== payload.serviceUid ||
          gatewayDirectory.gid !== payload.callerGid ||
          (gatewayDirectory.mode & 0o777) !== 0o710
        ) failV1("production strong client gateway directory is invalid");
        await rmdir(payload.gatewayDirectoryPath);
        await fsyncDirectoryV1(dirname(payload.gatewayDirectoryPath));
      } catch (error) {
        if (
          !(typeof error === "object" && error !== null && "code" in error &&
            (error as { readonly code?: unknown }).code === "ENOENT")
        ) throw error;
      }
      payload = await advanceTransactionV1(payload, "gateway_directory_removed");
    }
    payload = await advanceTransactionV1(payload, "completed");
    await unlinkExactRootFileV1(transactionPathV1(payload.installationRoot));
    return payload;
  } finally {
    snapshot?.fill(0);
    descriptor?.fill(0);
    rollback?.fill(0);
  }
}

async function recoverTransactionV1(root: string): Promise<TransactionPayloadV1 | undefined> {
  const pending = await readTransactionV1(root);
  return pending === undefined ? undefined : convergeTransactionV1(pending);
}

async function exactFileEqualsV1(path: string, expected: Uint8Array): Promise<boolean> {
  try {
    const bytes = await readExactRootFileV1(path);
    try {
      return bytes.equals(expected);
    } finally {
      bytes.fill(0);
    }
  } catch (error) {
    if (
      typeof error === "object" && error !== null && "code" in error &&
      (error as { readonly code?: unknown }).code === "ENOENT"
    ) return false;
    throw error;
  }
}

async function exactRootFileExistsV1(path: string): Promise<boolean> {
  try {
    const bytes = await readExactRootFileV1(path);
    bytes.fill(0);
    return true;
  } catch (error) {
    if (
      typeof error === "object" && error !== null && "code" in error &&
      (error as { readonly code?: unknown }).code === "ENOENT"
    ) return false;
    throw error;
  }
}

function descriptorLifecycleBindingV1(bytes: Uint8Array): Readonly<{
  readonly gatewaySocketPath: string;
  readonly serviceUid: number;
  readonly callerGid: number;
}> {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return failV1("production strong client descriptor is invalid");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return failV1("production strong client descriptor is invalid");
  }
  const payload = (value as { readonly payload?: unknown }).payload;
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return failV1("production strong client descriptor is invalid");
  }
  const record = payload as Record<string, unknown>;
  const service = record.servicePrincipal;
  const caller = record.callerPrincipal;
  if (
    typeof service !== "object" || service === null || Array.isArray(service) ||
    typeof caller !== "object" || caller === null || Array.isArray(caller)
  ) return failV1("production strong client descriptor is invalid");
  return Object.freeze({
    gatewaySocketPath: exactPathV1(
      record.gatewaySocketPath,
      "production strong client gateway socket path",
    ),
    serviceUid: kernelIdV1(
      (service as Record<string, unknown>).uid,
      "production strong client service uid",
    ),
    callerGid: kernelIdV1(
      (caller as Record<string, unknown>).gid,
      "production strong client caller gid",
    ),
  });
}

async function installProviderProductionStrongClientTrustUnlockedV1(
  input: InstallProviderProductionStrongClientTrustV1Input,
): Promise<ProviderProductionStrongClientTrustLifecycleResultV1> {
  const root = exactPathV1(
    input.canonicalInstallationRoot,
    "production strong client installation root",
  );
  await assertRootInstallationV1(root);
  await recoverTransactionV1(root);
  const files = generateFilesV1(input);
  try {
    if (
      await exactFileEqualsV1(files.snapshotPath, files.snapshotBytes) &&
      await exactFileEqualsV1(files.descriptorPath, files.descriptorBytes)
    ) {
      return resultV1("installed", files);
    }
    const transaction = transactionPayloadV1({
      operation: "install",
      files,
      root,
      snapshotBytes: files.snapshotBytes,
      descriptorBytes: files.descriptorBytes,
      rollbackBytes: null,
    });
    await persistTransactionV1(transaction, false);
    await convergeTransactionV1(transaction);
    return resultV1("installed", files);
  } finally {
    files.snapshotBytes.fill(0);
    files.descriptorBytes.fill(0);
  }
}

async function rotateProviderProductionStrongClientTrustUnlockedV1(
  input: InstallProviderProductionStrongClientTrustV1Input,
): Promise<ProviderProductionStrongClientTrustLifecycleResultV1> {
  const root = exactPathV1(
    input.canonicalInstallationRoot,
    "production strong client installation root",
  );
  await assertRootInstallationV1(root);
  await recoverTransactionV1(root);
  const files = generateFilesV1(input);
  let currentSnapshot: Buffer | undefined;
  let currentDescriptor: Buffer | undefined;
  let rollbackBytes: Buffer | undefined;
  try {
    if (
      await exactFileEqualsV1(files.snapshotPath, files.snapshotBytes) &&
      await exactFileEqualsV1(files.descriptorPath, files.descriptorBytes)
    ) return resultV1("rotated", files);
    currentSnapshot = await readExactRootFileV1(files.snapshotPath);
    currentDescriptor = await readExactRootFileV1(files.descriptorPath);
    rollbackBytes = canonicalBytesV1(Object.freeze({
      schemaVersion: 1 as const,
      profile: ROLLBACK_PROFILE_V1,
      snapshot: `base64url:${currentSnapshot.toString("base64url")}`,
      descriptor: `base64url:${currentDescriptor.toString("base64url")}`,
      contentDigest: sha256V1(canonicalBytesV1([
        ROLLBACK_PROFILE_V1,
        sha256V1(currentSnapshot),
        sha256V1(currentDescriptor),
      ])),
    }));
    const transaction = transactionPayloadV1({
      operation: "rotate",
      files,
      root,
      snapshotBytes: files.snapshotBytes,
      descriptorBytes: files.descriptorBytes,
      rollbackBytes,
    });
    await persistTransactionV1(transaction, false);
    await convergeTransactionV1(transaction);
    return resultV1("rotated", files);
  } finally {
    currentSnapshot?.fill(0);
    currentDescriptor?.fill(0);
    rollbackBytes?.fill(0);
    files.snapshotBytes.fill(0);
    files.descriptorBytes.fill(0);
  }
}

function decodeRollbackV1(bytes: Buffer): {
  readonly snapshot: Buffer;
  readonly descriptor: Buffer;
} {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return failV1("production strong client rollback is invalid");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return failV1("production strong client rollback is invalid");
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join("\0") !==
      ["contentDigest", "descriptor", "profile", "schemaVersion", "snapshot"]
        .sort().join("\0") ||
    record.schemaVersion !== 1 || record.profile !== ROLLBACK_PROFILE_V1 ||
    typeof record.snapshot !== "string" ||
    !record.snapshot.startsWith("base64url:") ||
    typeof record.descriptor !== "string" ||
    !record.descriptor.startsWith("base64url:")
  ) return failV1("production strong client rollback is invalid");
  const snapshot = Buffer.from(record.snapshot.slice(10), "base64url");
  const descriptor = Buffer.from(record.descriptor.slice(10), "base64url");
  if (
    snapshot.byteLength < 1 || snapshot.byteLength > MAX_FILE_BYTES_V1 ||
    descriptor.byteLength < 1 || descriptor.byteLength > MAX_FILE_BYTES_V1 ||
    record.contentDigest !== sha256V1(canonicalBytesV1([
      ROLLBACK_PROFILE_V1,
      sha256V1(snapshot),
      sha256V1(descriptor),
    ]))
  ) {
    snapshot.fill(0);
    descriptor.fill(0);
    return failV1("production strong client rollback is invalid");
  }
  return { snapshot, descriptor };
}

async function rollbackProviderProductionStrongClientTrustUnlockedV1(
  canonicalInstallationRoot: string,
): Promise<ProviderProductionStrongClientTrustLifecycleResultV1> {
  const root = exactPathV1(canonicalInstallationRoot, "production strong client installation root");
  await assertRootInstallationV1(root);
  await recoverTransactionV1(root);
  const snapshotPath = join(root, PROVIDER_PRODUCTION_STRONG_CLIENT_TRUST_FILE_V1);
  const descriptorPath = providerProductionStrongClientDescriptorPathV1(root);
  const rollbackPath = join(root, PROVIDER_PRODUCTION_STRONG_CLIENT_TRUST_ROLLBACK_FILE_V1);
  const rollbackBytes = await readExactRootFileV1(rollbackPath);
  const previous = decodeRollbackV1(rollbackBytes);
  const binding = descriptorLifecycleBindingV1(previous.descriptor);
  const gatewayDirectoryPath = providerProductionStrongClientGatewayDirectoryPathV1(root);
  const gatewaySocketPath = providerProductionStrongClientGatewaySocketPathV1(root);
  if (binding.gatewaySocketPath !== gatewaySocketPath) {
    rollbackBytes.fill(0);
    previous.snapshot.fill(0);
    previous.descriptor.fill(0);
    return failV1("production strong client rollback is invalid");
  }
  try {
    const transaction = transactionPayloadV1({
      operation: "rollback",
      root,
      files: {
        snapshotPath,
        descriptorPath,
        rollbackPath,
        gatewayDirectoryPath,
        gatewaySocketPath,
        servicePrincipal: { uid: binding.serviceUid, gid: 0 },
        callerPrincipal: { uid: 0, gid: binding.callerGid },
      },
      snapshotBytes: previous.snapshot,
      descriptorBytes: previous.descriptor,
      rollbackBytes: null,
    });
    await persistTransactionV1(transaction, false);
    await convergeTransactionV1(transaction);
  } finally {
    rollbackBytes.fill(0);
    previous.snapshot.fill(0);
    previous.descriptor.fill(0);
  }
  return resultV1("rolled_back", { snapshotPath, descriptorPath, gatewaySocketPath });
}

async function unlinkExactRootFileV1(path: string): Promise<void> {
  const handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | O_CLOEXEC_V1);
  try {
    const opened = await handle.stat({ bigint: true });
    const projected = await lstat(path, { bigint: true });
    if (
      !opened.isFile() || opened.uid !== 0n || opened.nlink !== 1n ||
      opened.dev !== projected.dev || opened.ino !== projected.ino ||
      projected.isSymbolicLink()
    ) failV1("production strong client lifecycle removal target is invalid");
    await unlink(path);
    await fsyncDirectoryV1(dirname(path));
  } finally {
    await handle.close();
  }
}

async function uninstallProviderProductionStrongClientTrustUnlockedV1(
  canonicalInstallationRoot: string,
): Promise<ProviderProductionStrongClientTrustLifecycleResultV1> {
  const root = exactPathV1(canonicalInstallationRoot, "production strong client installation root");
  await assertRootInstallationV1(root);
  await recoverTransactionV1(root);
  const snapshotPath = join(root, PROVIDER_PRODUCTION_STRONG_CLIENT_TRUST_FILE_V1);
  const descriptorPath = providerProductionStrongClientDescriptorPathV1(root);
  const rollbackPath = join(root, PROVIDER_PRODUCTION_STRONG_CLIENT_TRUST_ROLLBACK_FILE_V1);
  const gatewayDirectoryPath = providerProductionStrongClientGatewayDirectoryPathV1(root);
  const gatewaySocketPath = providerProductionStrongClientGatewaySocketPathV1(root);
  let descriptorBytes: Buffer;
  try {
    descriptorBytes = await readExactRootFileV1(descriptorPath);
  } catch (error) {
    if (
      typeof error === "object" && error !== null && "code" in error &&
      (error as { readonly code?: unknown }).code === "ENOENT" &&
      !(await exactRootFileExistsV1(snapshotPath)) &&
      !(await exactRootFileExistsV1(rollbackPath))
    ) {
      try {
        await rmdir(gatewayDirectoryPath);
      } catch (directoryError) {
        if (
          !(typeof directoryError === "object" && directoryError !== null &&
            "code" in directoryError &&
            (directoryError as { readonly code?: unknown }).code === "ENOENT")
        ) throw directoryError;
      }
      return resultV1("uninstalled", { snapshotPath, descriptorPath, gatewaySocketPath });
    }
    throw error;
  }
  try {
    const binding = descriptorLifecycleBindingV1(descriptorBytes);
    if (binding.gatewaySocketPath !== gatewaySocketPath) {
      return failV1("production strong client descriptor is invalid");
    }
    const transaction = transactionPayloadV1({
      operation: "uninstall",
      root,
      files: {
        snapshotPath,
        descriptorPath,
        rollbackPath,
        gatewayDirectoryPath,
        gatewaySocketPath,
        servicePrincipal: { uid: binding.serviceUid, gid: 0 },
        callerPrincipal: { uid: 0, gid: binding.callerGid },
      },
      snapshotBytes: null,
      descriptorBytes: null,
      rollbackBytes: null,
    });
    await persistTransactionV1(transaction, false);
    await convergeTransactionV1(transaction);
  } finally {
    descriptorBytes.fill(0);
  }
  return resultV1("uninstalled", { snapshotPath, descriptorPath, gatewaySocketPath });
}

export function installProviderProductionStrongClientTrustV1(
  input: InstallProviderProductionStrongClientTrustV1Input,
): Promise<ProviderProductionStrongClientTrustLifecycleResultV1> {
  return withInstallationGlobalLifecycleMutexV1(
    input.canonicalInstallationRoot,
    () => installProviderProductionStrongClientTrustUnlockedV1(input),
  );
}

export function rotateProviderProductionStrongClientTrustV1(
  input: InstallProviderProductionStrongClientTrustV1Input,
): Promise<ProviderProductionStrongClientTrustLifecycleResultV1> {
  return withInstallationGlobalLifecycleMutexV1(
    input.canonicalInstallationRoot,
    () => rotateProviderProductionStrongClientTrustUnlockedV1(input),
  );
}

export function rollbackProviderProductionStrongClientTrustV1(
  canonicalInstallationRoot: string,
): Promise<ProviderProductionStrongClientTrustLifecycleResultV1> {
  return withInstallationGlobalLifecycleMutexV1(
    canonicalInstallationRoot,
    () => rollbackProviderProductionStrongClientTrustUnlockedV1(
      canonicalInstallationRoot,
    ),
  );
}

export function uninstallProviderProductionStrongClientTrustV1(
  canonicalInstallationRoot: string,
): Promise<ProviderProductionStrongClientTrustLifecycleResultV1> {
  return withInstallationGlobalLifecycleMutexV1(
    canonicalInstallationRoot,
    () => uninstallProviderProductionStrongClientTrustUnlockedV1(
      canonicalInstallationRoot,
    ),
  );
}
