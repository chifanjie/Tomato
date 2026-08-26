#!/usr/bin/env node

import {
  createPrivateKey,
  createPublicKey,
  randomBytes,
  type KeyObject,
} from "node:crypto";
import { constants as fsConstants, realpathSync } from "node:fs";
import {
  chmod,
  lstat,
  open,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PROVIDER_RUNTIME_IPC_PROTOCOL_V1 } from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import { ContentDigestV1Schema } from "@understand-code/durable-object-provider-contracts/primitives";
import {
  mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1,
  type ProviderServiceInstallationIdentityVerificationCapabilityInternalV1,
} from "@understand-code/durable-object-provider-contracts/provider-service-installation-identity-custody-internal";

import { DurableObjectProviderRuntimeServerV1 } from "./server.js";
import {
  createProviderServiceReadinessReceiptV1,
  verifyProviderServiceHandoffConfigV1,
  type ProviderServiceHandoffConfigV1,
} from "./service-handoff.js";
import { probeProviderRuntimeTargetV1 } from "./target-inspection.js";
import {
  createProviderRuntimeStrongMutationBrokerVerifierInternalV1,
  PROVIDER_RUNTIME_STRONG_MUTATION_BROKER_SOCKET_BASENAME_INTERNAL_V1,
} from "./strong-mutation-broker-client-internal.js";

interface RuntimeCliOptionsV1 {
  readonly rootPath: string;
  readonly socketPath: string;
  readonly authKeyFile: string;
  readonly providerId: string;
  readonly authorizedCapabilityDigest: string;
}

interface ServiceConfigCliOptionsV1 {
  readonly serviceConfigPath: string;
}

export interface ResolvedServiceRuntimeV1 {
  readonly options: RuntimeCliOptionsV1;
  readonly config: ProviderServiceHandoffConfigV1;
  readonly acceptanceIdentityVerificationCapability?:
    ProviderServiceInstallationIdentityVerificationCapabilityInternalV1;
  readonly authorityPrincipal: Readonly<{
    readonly uid: number;
    readonly gid: number;
  }>;
}

function isServiceConfigCliOptionsV1(
  value: RuntimeCliOptionsV1 | ServiceConfigCliOptionsV1,
): value is ServiceConfigCliOptionsV1 {
  return "serviceConfigPath" in value;
}

function usageV1(): string {
  return [
    "Usage: understand-code-durable-provider-runtime \\",
    "  --root <private-directory> \\",
    "  [--socket <unix-socket-path>] \\",
    "  --auth-key-file <0600-raw-32-byte-key> \\",
    "  --provider-id <durable-object-provider:id> \\",
    "  --capability-digest <sha256:hex64>",
    "  or --service-config <signed-service-handoff.json>",
  ].join("\n");
}

function parseArgumentsV1(
  argv: readonly string[],
): RuntimeCliOptionsV1 | ServiceConfigCliOptionsV1 {
  if (argv.length === 2 && argv[0] === "--service-config" && argv[1] !== undefined) {
    return { serviceConfigPath: resolve(argv[1]) };
  }
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (
      name === undefined ||
      value === undefined ||
      ![
        "--root",
        "--socket",
        "--auth-key-file",
        "--provider-id",
        "--capability-digest",
      ].includes(name) ||
      values.has(name)
    ) {
      throw new Error(usageV1());
    }
    values.set(name, value);
  }
  const rootValue = values.get("--root");
  const authKeyFileValue = values.get("--auth-key-file");
  const capabilityDigest = values.get("--capability-digest");
  const providerId = values.get("--provider-id");
  if (
    rootValue === undefined ||
    authKeyFileValue === undefined ||
    capabilityDigest === undefined ||
    providerId === undefined
  ) {
    throw new Error(usageV1());
  }
  const rootPath = resolve(rootValue);
  return {
    rootPath,
    socketPath: resolve(values.get("--socket") ?? join(rootPath, "runtime.sock")),
    authKeyFile: resolve(authKeyFileValue),
    providerId,
    authorizedCapabilityDigest: capabilityDigest,
  };
}

async function readServiceConfigV1(
  options: ServiceConfigCliOptionsV1,
): Promise<ResolvedServiceRuntimeV1> {
  const metadata = await lstat(options.serviceConfigPath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("service config must be a regular file");
  }
  if (typeof process.getuid !== "function" || metadata.uid !== 0) {
    throw new Error("service config must be owned by the system installer");
  }
  if ((metadata.mode & 0o022) !== 0) {
    throw new Error("service config must not be group/world writable");
  }
  const raw = await readFile(options.serviceConfigPath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("service config is not valid JSON");
  }
  let config: ProviderServiceHandoffConfigV1;
  try {
    config = verifyProviderServiceHandoffConfigV1(parsed);
  } catch (error) {
    throw new Error(
      `service config is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (resolve(options.serviceConfigPath) !== config.payload.configPath) {
    throw new Error("service config path does not match the signed payload");
  }
  if (config.payload.platform !== process.platform) {
    throw new Error("service config platform does not match the current platform");
  }
  if (
    typeof process.getuid !== "function" ||
    process.getuid() !== config.payload.principal.uid ||
    (typeof process.getgid === "function" &&
      process.getgid() !== config.payload.principal.gid)
  ) {
    throw new Error("service runtime is not running as the configured principal");
  }
  const acceptanceIdentityVerificationCapability =
    await readProviderServiceInstallationIdentityCustodyV1(config);
  return {
    config,
    authorityPrincipal: Object.freeze({ uid: metadata.uid, gid: metadata.gid }),
    ...(acceptanceIdentityVerificationCapability === undefined
      ? {}
      : { acceptanceIdentityVerificationCapability }),
    options: {
      rootPath: config.payload.runtimeRoot,
      socketPath: config.payload.socketPath,
      authKeyFile: config.payload.authKeyPath,
      providerId: config.payload.providerId,
      authorizedCapabilityDigest: config.payload.capabilityDigest,
    },
  };
}

/**
 * Recover only the opaque Acceptance verification capability from the
 * principal-owned key named by the already verified signed handoff.
 */
export async function readProviderServiceInstallationIdentityCustodyV1(
  config: ProviderServiceHandoffConfigV1,
): Promise<
  ProviderServiceInstallationIdentityVerificationCapabilityInternalV1 | undefined
> {
  const custody = config.payload.installationIdentityCustody;
  if (custody === undefined) return undefined;
  if (
    typeof process.getuid !== "function" ||
    typeof process.getgid !== "function" ||
    process.getuid() !== config.payload.principal.uid ||
    process.getgid() !== config.payload.principal.gid
  ) {
    throw new Error(
      "Installation Identity custody requires the configured principal",
    );
  }
  const currentUid = process.getuid();
  const currentGid = process.getgid();
  const handle = await open(
    custody.keyPath,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile()) {
      throw new Error("Installation Identity custody key must be a regular file");
    }
    if (
      metadata.uid !== currentUid ||
      metadata.gid !== currentGid ||
      (metadata.mode & 0o777) !== 0o600
    ) {
      throw new Error(
        "Installation Identity custody key owner or mode is invalid",
      );
    }
    if (metadata.size !== 32) {
      throw new Error(
        "Installation Identity custody key must contain exactly 32 raw bytes",
      );
    }
    const installationIdentityKey = await handle.readFile();
    try {
      const stableMetadata = await handle.stat();
      if (
        stableMetadata.dev !== metadata.dev ||
        stableMetadata.ino !== metadata.ino ||
        stableMetadata.size !== metadata.size ||
        stableMetadata.mtimeMs !== metadata.mtimeMs ||
        stableMetadata.ctimeMs !== metadata.ctimeMs ||
        installationIdentityKey.byteLength !== 32
      ) {
        throw new Error(
          "Installation Identity custody key changed while it was read",
        );
      }
      try {
        return await mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1({
          installationIdentityKey,
          initializationNonce: custody.initializationNonce,
          installationIdentityGenerationId:
            custody.installationIdentityGenerationId,
          keyCheckToken: custody.keyCheckToken,
        });
      } catch {
        throw new Error(
          "Installation Identity custody tuple does not match its key",
        );
      }
    } finally {
      installationIdentityKey.fill(0);
    }
  } finally {
    await handle.close();
  }
}

async function readServiceSigningKeyV1(
  config: ProviderServiceHandoffConfigV1,
): Promise<KeyObject> {
  const metadata = await lstat(config.payload.signingKeyPath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("service signing key must be a regular file");
  }
  if (
    typeof process.getuid !== "function" ||
    metadata.uid !== process.getuid() ||
    (typeof process.getgid === "function" &&
      metadata.gid !== config.payload.principal.gid) ||
    (metadata.mode & 0o777) !== 0o600
  ) {
    throw new Error("service signing key owner or mode is invalid");
  }
  const bytes = await readFile(config.payload.signingKeyPath);
  let key: KeyObject;
  try {
    key = createPrivateKey({ key: bytes, format: "der", type: "pkcs8" });
  } catch {
    throw new Error("service signing key is not valid PKCS8");
  }
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("service signing key must be Ed25519");
  }
  const publicKey = createPublicKey(key).export({ format: "der", type: "spki" });
  const encodedPublicKey = `base64url:${Buffer.from(publicKey).toString("base64url")}`;
  if (encodedPublicKey !== config.publicKey) {
    throw new Error("service signing key does not match the signed config");
  }
  return key;
}

async function publishServiceReadinessV1(
  config: ProviderServiceHandoffConfigV1,
  privateKey: KeyObject,
): Promise<() => Promise<void>> {
  if (typeof process.getuid !== "function" || typeof process.getgid !== "function") {
    throw new Error("service readiness requires a uid-aware platform");
  }
  const target = await probeProviderRuntimeTargetV1(config.payload.runtimeRoot);
  const receipt = createProviderServiceReadinessReceiptV1({
    config,
    observedUid: process.getuid(),
    observedGid: process.getgid(),
    targetFingerprintDigest: ContentDigestV1Schema.parse(
      target.targetFingerprintDigest,
    ),
    nonce: randomBytes(24),
    privateKey,
  });
  const serialized = `${JSON.stringify(receipt)}\n`;
  const temporary = `${config.payload.readinessPath}.tmp-${process.pid}-${Date.now().toString(36)}`;
  await writeFile(temporary, serialized, { mode: 0o600, flag: "wx" });
  try {
    await chmod(temporary, 0o600);
    await rename(temporary, config.payload.readinessPath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return async () => {
    try {
      const current = await readFile(config.payload.readinessPath, "utf8");
      if (current === serialized) await unlink(config.payload.readinessPath);
    } catch (error) {
      if (
        !(
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { readonly code?: unknown }).code === "ENOENT"
        )
      ) {
        throw error;
      }
    }
  };
}

async function readPrivateAuthKeyV1(
  path: string,
  expectedGid?: number,
): Promise<Uint8Array> {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("runtime auth key path must be a regular file");
  }
  if (typeof process.getuid === "function" && metadata.uid !== process.getuid()) {
    throw new Error("runtime auth key file must be owned by the current user");
  }
  if (expectedGid !== undefined && metadata.gid !== expectedGid) {
    throw new Error("runtime auth key file must match the configured principal");
  }
  if ((metadata.mode & 0o777) !== 0o600) {
    throw new Error("runtime auth key file mode must be exactly 0600");
  }
  const key = await readFile(path);
  if (key.byteLength !== 32) {
    throw new Error("runtime auth key file must contain exactly 32 raw bytes");
  }
  return key;
}

export async function runDurableObjectProviderRuntimeCliV1(
  argv: readonly string[],
): Promise<void> {
  const parsed = parseArgumentsV1(argv);
  let service: ResolvedServiceRuntimeV1 | undefined;
  let options: RuntimeCliOptionsV1;
  if (isServiceConfigCliOptionsV1(parsed)) {
    service = await readServiceConfigV1(parsed);
    options = service.options;
  } else {
    options = parsed as RuntimeCliOptionsV1;
  }
  const authKey = await readPrivateAuthKeyV1(
    options.authKeyFile,
    service?.config.payload.principal.gid,
  );
  const serviceSigningKey =
    service === undefined ? undefined : await readServiceSigningKeyV1(service.config);
  const strongMutationAuthorityVerifier =
    service === undefined || service.config.payload.platform !== "linux"
    ? undefined
    : createProviderRuntimeStrongMutationBrokerVerifierInternalV1({
      socketPath: join(
        service.config.payload.runtimeRoot,
        PROVIDER_RUNTIME_STRONG_MUTATION_BROKER_SOCKET_BASENAME_INTERNAL_V1,
      ),
      expectedAuthorityUid: service.authorityPrincipal.uid,
      expectedAuthorityGid: service.authorityPrincipal.gid,
      expectedSocketGid: service.config.payload.principal.gid,
    });
  const server = new DurableObjectProviderRuntimeServerV1({
    rootPath: options.rootPath,
    socketPath: options.socketPath,
    providerId: options.providerId,
    authKey,
    authorizedCapabilityDigest: options.authorizedCapabilityDigest,
    ...(strongMutationAuthorityVerifier === undefined
      ? {}
      : { strongMutationAuthorityVerifier }),
    ...(service === undefined
      ? {}
      : {
          mutationPolicy:
            "acceptance_authority_session_required" as const,
        }),
    ...(service?.acceptanceIdentityVerificationCapability === undefined
      ? {}
      : {
          acceptanceIdentityVerificationCapability:
            service.acceptanceIdentityVerificationCapability,
        }),
    ...(service === undefined || serviceSigningKey === undefined
      ? {}
      : {
          principalAttestation: {
            privateKey: serviceSigningKey,
            handoffPayloadDigest: service.config.payloadDigest,
            publicKey: service.config.publicKey,
          },
        }),
  });

  let resolveStop!: () => void;
  const stopRequested = new Promise<void>((resolvePromise) => {
    resolveStop = resolvePromise;
  });
  const stopForSignal = (): void => resolveStop();
  let removeReadiness: (() => Promise<void>) | undefined;
  process.once("SIGINT", stopForSignal);
  process.once("SIGTERM", stopForSignal);
  try {
    const address = await server.start();
    if (service !== undefined && serviceSigningKey !== undefined) {
      removeReadiness = await publishServiceReadinessV1(
        service.config,
        serviceSigningKey,
      );
    }
    process.stdout.write(
      `${JSON.stringify({
        profile: "understand_code_durable_provider_runtime_ready_v1",
        protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
        socketPath: address.socketPath,
        pid: process.pid,
      })}\n`,
    );
    await stopRequested;
  } finally {
    process.off("SIGINT", stopForSignal);
    process.off("SIGTERM", stopForSignal);
    if (removeReadiness !== undefined) await removeReadiness();
    await server.close();
    authKey.fill(0);
  }
}

function isDirectRuntimeCliInvocationV1(invokedPath: string | undefined): boolean {
  const modulePath = fileURLToPath(import.meta.url);
  if (invokedPath === undefined || basename(modulePath) !== "cli.js") return false;
  try {
    return realpathSync(invokedPath) === realpathSync(modulePath);
  } catch {
    return false;
  }
}

if (isDirectRuntimeCliInvocationV1(process.argv[1])) {
  runDurableObjectProviderRuntimeCliV1(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
