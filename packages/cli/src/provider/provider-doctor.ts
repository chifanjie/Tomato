import { createHash, randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

import {
  createProviderUnavailableToolErrorV1,
  type ProviderUnavailableToolErrorV1,
} from "@understand-code/durable-object-provider-contracts/provider-error";
import { PROVIDER_RUNTIME_IPC_PROTOCOL_V1 } from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import { createDurableObjectProviderRuntimeClientV1 } from "@understand-code/durable-object-provider-client";
import {
  assertProviderRuntimeTargetContinuityV1,
  inspectProviderServiceHandoffV1,
  probeProviderRuntimeTargetV1,
  ProviderRuntimeTargetInspectionErrorV1,
  runProviderRuntimeRealFilesystemConformanceV1,
  type ProviderRuntimeTargetInspectionV1,
  type ProviderRuntimeTargetPublicProjectionV1,
  type ProviderRuntimeRealFilesystemConformanceCandidateV1,
  type ProviderServiceHandoffInspectionV1,
} from "@understand-code/durable-object-provider-runtime";
import type { ContentDigestV1 } from "@understand-code/durable-object-provider-contracts/primitives";

const PROVIDER_DOCTOR_PROFILE_V1 =
  "understand_code_provider_doctor_v1" as const;
const SOURCE_PROVIDER_ID = "durable-object-provider:doctor-source";
const DESTINATION_PROVIDER_ID = "durable-object-provider:doctor-destination";
const SOURCE_CAPABILITY_DIGEST = digestTextV1(
  "understand-code-provider-doctor-source-capability-v1",
);
const DESTINATION_CAPABILITY_DIGEST = digestTextV1(
  "understand-code-provider-doctor-destination-capability-v1",
);
const DOCTOR_BINARY_DIGEST = digestTextV1(
  "understand-code-provider-doctor-runtime-binary-v1",
);
const DOCTOR_POLICY_DIGEST = digestTextV1(
  "understand-code-provider-doctor-runtime-policy-v1",
);

export interface ProviderRuntimeCommandV1 {
  readonly entrypoint: string;
  readonly argumentPrefix: readonly string[];
}

export interface ProviderDoctorOptionsV1 {
  /** Existing target whose physical filesystem will host the ephemeral probe. */
  readonly targetRoot: string;
  readonly runtimeCommand?: ProviderRuntimeCommandV1;
  readonly readyTimeoutMs?: number;
  /** Optional privileged service handoff files to inspect alongside the probe. */
  readonly serviceConfigPath?: string;
  readonly serviceReadinessPath?: string;
  readonly expectedInstallationIdentityDigest?: ContentDigestV1;
}

type StrongStoreLockV1 = Readonly<{
  available: false;
  authority: "read_only";
  reason: "os_principal_unverified" | "runtime_probe_failed" | "unsupported_platform";
  error: ProviderUnavailableToolErrorV1;
}>;

type PassedTargetProbeV1 = ProviderRuntimeTargetPublicProjectionV1 &
  Readonly<{
    status: "passed";
    continuity: "stable";
    targetFingerprintDigest: `sha256:${string}`;
  }>;

export type ProviderDoctorResultV1 =
  | Readonly<{
      schemaVersion: 1;
      profile: typeof PROVIDER_DOCTOR_PROFILE_V1;
      ok: true;
      status: "durable_candidate";
      evidenceFreshness: "ephemeral_process_probe";
      strongStore: StrongStoreLockV1;
      targetProbe: PassedTargetProbeV1;
      conformance: ProviderRuntimeRealFilesystemConformanceCandidateV1;
      service?: ProviderServiceHandoffInspectionV1;
      runtime: Readonly<{
        isolation: "two_child_processes";
        authenticatedIpc: "passed";
        fixedLocatorObject: "passed";
        compareCommit: "passed";
        restartRecovery: "passed";
        finalJournalRevision: 1;
      }>;
    }>
  | Readonly<{
      schemaVersion: 1;
      profile: typeof PROVIDER_DOCTOR_PROFILE_V1;
      ok: false;
      status: "unavailable";
      evidenceFreshness: "ephemeral_target_probe" | "unavailable";
      strongStore: StrongStoreLockV1;
      targetProbe: PassedTargetProbeV1 | Readonly<{ status: "failed" }>;
      service?: ProviderServiceHandoffInspectionV1;
      runtime: Readonly<{ probe: "failed" }>;
    }>;

interface PreparedRuntimeV1 {
  readonly rootPath: string;
  readonly socketPath: string;
  readonly keyPath: string;
  readonly key: Buffer;
}

interface RunningRuntimeV1 {
  readonly child: ChildProcess;
  readonly socketPath: string;
}

interface ExplicitTargetRootV1 {
  readonly requestedPath: string;
  readonly canonicalRootPath: string;
  readonly device: bigint;
  readonly inode: bigint;
  readonly uid: bigint;
  readonly mode: bigint;
}

type TargetRootMetadataV1 = Readonly<{
  dev: bigint;
  ino: bigint;
  uid: bigint;
  mode: bigint;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}>;

function digestTextV1(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function digestBytesV1(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function validateExplicitTargetMetadataV1(
  metadata: TargetRootMetadataV1,
): void {
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error("provider doctor target must be a non-symlink directory");
  }
  if (
    typeof process.getuid !== "function" ||
    metadata.uid !== BigInt(process.getuid())
  ) {
    throw new Error("provider doctor target must be owned by the current uid");
  }
}

async function readExplicitTargetMetadataV1(
  path: string,
): Promise<TargetRootMetadataV1> {
  return (await lstat(path, { bigint: true })) as unknown as TargetRootMetadataV1;
}

function sameExplicitTargetV1(
  expected: ExplicitTargetRootV1,
  metadata: TargetRootMetadataV1,
): boolean {
  return (
    metadata.dev === expected.device &&
    metadata.ino === expected.inode &&
    metadata.uid === expected.uid &&
    metadata.mode === expected.mode
  );
}

async function canonicalizeExplicitTargetRootV1(
  targetRoot: string,
): Promise<ExplicitTargetRootV1> {
  if (!isAbsolute(targetRoot)) {
    throw new Error("provider doctor target root must be absolute");
  }
  const initial = await readExplicitTargetMetadataV1(targetRoot);
  validateExplicitTargetMetadataV1(initial);
  const canonicalRootPath = await realpath(targetRoot);
  const [requestedAfter, canonical] = await Promise.all([
    readExplicitTargetMetadataV1(targetRoot),
    readExplicitTargetMetadataV1(canonicalRootPath),
  ]);
  validateExplicitTargetMetadataV1(requestedAfter);
  validateExplicitTargetMetadataV1(canonical);
  const identity: ExplicitTargetRootV1 = {
    requestedPath: targetRoot,
    canonicalRootPath,
    device: initial.dev,
    inode: initial.ino,
    uid: initial.uid,
    mode: initial.mode,
  };
  if (
    !sameExplicitTargetV1(identity, requestedAfter) ||
    !sameExplicitTargetV1(identity, canonical)
  ) {
    throw new Error("provider doctor target changed while canonicalizing");
  }
  return identity;
}

async function assertExplicitTargetContinuityV1(
  expected: ExplicitTargetRootV1,
): Promise<void> {
  const resolved = await realpath(expected.requestedPath);
  const [requested, canonical] = await Promise.all([
    readExplicitTargetMetadataV1(expected.requestedPath),
    readExplicitTargetMetadataV1(expected.canonicalRootPath),
  ]);
  validateExplicitTargetMetadataV1(requested);
  validateExplicitTargetMetadataV1(canonical);
  if (
    resolved !== expected.canonicalRootPath ||
    !sameExplicitTargetV1(expected, requested) ||
    !sameExplicitTargetV1(expected, canonical)
  ) {
    throw new Error("provider doctor target continuity changed");
  }
}

function defaultRuntimeCommandV1(): ProviderRuntimeCommandV1 {
  const currentModule = fileURLToPath(import.meta.url);
  if (basename(currentModule) === "understand-code.mjs") {
    return { entrypoint: currentModule, argumentPrefix: ["__provider-runtime"] };
  }
  return {
    entrypoint: fileURLToPath(
      new URL(
        "../../../durable-object-provider-runtime/dist/cli.js",
        import.meta.url,
      ),
    ),
    argumentPrefix: [],
  };
}

async function prepareRuntimeV1(parent: string, name: string): Promise<PreparedRuntimeV1> {
  const rootPath = join(parent, name);
  await mkdir(rootPath, { mode: 0o700 });
  const key = randomBytes(32);
  const keyPath = join(rootPath, "k");
  await writeFile(keyPath, key, { mode: 0o600, flag: "wx" });
  return { rootPath, socketPath: join(rootPath, "s"), keyPath, key };
}

async function startRuntimeV1(input: {
  readonly command: ProviderRuntimeCommandV1;
  readonly prepared: PreparedRuntimeV1;
  readonly providerId: string;
  readonly capabilityDigest: `sha256:${string}`;
  readonly timeoutMs: number;
}): Promise<RunningRuntimeV1> {
  const child = spawn(
    process.execPath,
    [
      input.command.entrypoint,
      ...input.command.argumentPrefix,
      "--root",
      input.prepared.rootPath,
      "--socket",
      input.prepared.socketPath,
      "--auth-key-file",
      input.prepared.keyPath,
      "--provider-id",
      input.providerId,
      "--capability-digest",
      input.capabilityDigest,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stderr?.resume();
  const lines = createInterface({ input: child.stdout!, crlfDelay: Infinity });
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        lines.off("line", onLine);
        child.off("error", onError);
        child.off("exit", onExit);
        if (error === undefined) resolve();
        else reject(error);
      };
      const onLine = (line: string): void => {
        try {
          const ready: unknown = JSON.parse(line);
          if (
            ready === null ||
            typeof ready !== "object" ||
            (ready as { profile?: unknown }).profile !==
              "understand_code_durable_provider_runtime_ready_v1" ||
            (ready as { protocol?: unknown }).protocol !==
              PROVIDER_RUNTIME_IPC_PROTOCOL_V1 ||
            (ready as { socketPath?: unknown }).socketPath !==
              input.prepared.socketPath
          ) {
            finish(new Error("provider runtime emitted an invalid ready record"));
            return;
          }
          finish();
        } catch {
          finish(new Error("provider runtime ready record is invalid"));
        }
      };
      const onError = (): void =>
        finish(new Error("provider runtime process could not start"));
      const onExit = (): void =>
        finish(new Error("provider runtime exited before ready"));
      const timer = setTimeout(
        () => finish(new Error("provider runtime ready timeout")),
        input.timeoutMs,
      );
      lines.on("line", onLine);
      child.once("error", onError);
      child.once("exit", onExit);
    });
    return { child, socketPath: input.prepared.socketPath };
  } catch (error) {
    await stopRuntimeV1(child);
    throw error;
  } finally {
    lines.close();
  }
}

async function stopRuntimeV1(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    child.once("error", () => resolve());
  });
  child.kill("SIGTERM");
  let timeout: NodeJS.Timeout | undefined;
  const timedOut = new Promise<"timeout">((resolve) => {
    timeout = setTimeout(() => resolve("timeout"), 2_000);
  });
  if ((await Promise.race([exited.then(() => "exited" as const), timedOut])) === "timeout") {
    child.kill("SIGKILL");
    await exited;
  }
  if (timeout !== undefined) clearTimeout(timeout);
}

function makeClientV1(input: {
  readonly running: RunningRuntimeV1;
  readonly key: Uint8Array;
  readonly providerId: string;
  readonly capabilityDigest: `sha256:${string}`;
}) {
  return createDurableObjectProviderRuntimeClientV1({
    socketPath: input.running.socketPath,
    sharedSecret: input.key,
    verifiedSelection: {
      verification: "caller_verified_registry_selection_v1",
      providerId: input.providerId,
      capabilityDigest: input.capabilityDigest,
    },
  });
}

function unavailableResultV1(
  reason: "unavailable" | "unsupported_filesystem_profile",
  targetProbe?: PassedTargetProbeV1,
  service?: ProviderServiceHandoffInspectionV1,
): ProviderDoctorResultV1 {
  return {
    schemaVersion: 1,
    profile: PROVIDER_DOCTOR_PROFILE_V1,
    ok: false,
    status: "unavailable",
    evidenceFreshness:
      targetProbe === undefined ? "unavailable" : "ephemeral_target_probe",
    strongStore: {
      available: false,
      authority: "read_only",
      reason:
        reason === "unsupported_filesystem_profile"
          ? "unsupported_platform"
          : "runtime_probe_failed",
      error: createProviderUnavailableToolErrorV1(reason),
    },
    targetProbe: targetProbe ?? { status: "failed" },
    ...(service === undefined ? {} : { service }),
    runtime: { probe: "failed" },
  };
}

function unavailableServiceReadinessV1(
  reason:
    | "service_not_provisioned"
    | "attestation_invalid"
    | "principal_mismatch",
): ProviderServiceHandoffInspectionV1 {
  return {
    status: "unavailable",
    authority: "read_only",
    strongWrites: "locked",
    platform: "unknown",
    reason,
  };
}

async function inspectServiceReadinessV1(
  options: ProviderDoctorOptionsV1,
): Promise<ProviderServiceHandoffInspectionV1 | undefined> {
  const configPath = options.serviceConfigPath;
  const readinessPath = options.serviceReadinessPath;
  if (configPath === undefined && readinessPath === undefined) return undefined;
  if (configPath === undefined || readinessPath === undefined) {
    return unavailableServiceReadinessV1("service_not_provisioned");
  }
  try {
    const configMetadata = await lstat(configPath);
    if (!configMetadata.isFile() || configMetadata.isSymbolicLink()) {
      return unavailableServiceReadinessV1("attestation_invalid");
    }
    const config = JSON.parse(await readFile(configPath, "utf8")) as unknown;
    return await inspectProviderServiceHandoffV1({
      config,
      readinessPath,
      expectedInstallationIdentityDigest:
        options.expectedInstallationIdentityDigest,
    });
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { readonly code?: unknown }).code === "ENOENT"
        ? "service_not_provisioned"
        : "attestation_invalid";
    return unavailableServiceReadinessV1(code);
  }
}

function passedTargetProbeV1(
  inspection: ProviderRuntimeTargetInspectionV1,
): PassedTargetProbeV1 {
  return {
    status: "passed",
    continuity: "stable",
    ...inspection.publicProjection,
    targetFingerprintDigest: inspection.targetFingerprintDigest,
  };
}

/**
 * Runs the no-source Provider Doctor. Passing proves only a same-user durable
 * runtime candidate. It intentionally cannot unlock strong Store authority:
 * an independently verified OS principal and signed runtime/real-FS evidence
 * remain required by the Provider Gate.
 */
export async function runProviderDoctorV1(
  options: ProviderDoctorOptionsV1,
): Promise<ProviderDoctorResultV1> {
  const service = await inspectServiceReadinessV1(options);
  if (process.platform !== "darwin" && process.platform !== "linux") {
    return unavailableResultV1("unsupported_filesystem_profile", undefined, service);
  }
  const command = options.runtimeCommand ?? defaultRuntimeCommandV1();
  const timeoutMs = options.readyTimeoutMs ?? 5_000;
  const children: ChildProcess[] = [];
  let temporaryRoot: string | undefined;
  let source: PreparedRuntimeV1 | undefined;
  let destination: PreparedRuntimeV1 | undefined;
  let explicitTarget: ExplicitTargetRootV1 | undefined;
  let targetBaseline: ProviderRuntimeTargetInspectionV1 | undefined;
  let failureStage: "target" | "runtime" | "continuity" = "target";
  try {
    explicitTarget = await canonicalizeExplicitTargetRootV1(
      options.targetRoot,
    );
    temporaryRoot = await mkdtemp(
      join(
        explicitTarget.canonicalRootPath,
        ".ucpd-",
      ),
    );
    await chmod(temporaryRoot, 0o700);
    targetBaseline = await probeProviderRuntimeTargetV1(temporaryRoot);
    failureStage = "runtime";
    source = await prepareRuntimeV1(temporaryRoot, "a");
    destination = await prepareRuntimeV1(temporaryRoot, "b");
    const sourceRuntime = await startRuntimeV1({
      command,
      prepared: source,
      providerId: SOURCE_PROVIDER_ID,
      capabilityDigest: SOURCE_CAPABILITY_DIGEST,
      timeoutMs,
    });
    children.push(sourceRuntime.child);
    let destinationRuntime = await startRuntimeV1({
      command,
      prepared: destination,
      providerId: DESTINATION_PROVIDER_ID,
      capabilityDigest: DESTINATION_CAPABILITY_DIGEST,
      timeoutMs,
    });
    children.push(destinationRuntime.child);
    const sourceClient = makeClientV1({
      running: sourceRuntime,
      key: source.key,
      providerId: SOURCE_PROVIDER_ID,
      capabilityDigest: SOURCE_CAPABILITY_DIGEST,
    });
    let destinationClient = makeClientV1({
      running: destinationRuntime,
      key: destination.key,
      providerId: DESTINATION_PROVIDER_ID,
      capabilityDigest: DESTINATION_CAPABILITY_DIGEST,
    });
    const [sourceInitial, destinationInitial] = await Promise.all([
      sourceClient.inspectState(),
      destinationClient.inspectState(),
    ]);
    if (
      sourceInitial.state.revision !== 0 ||
      destinationInitial.state.revision !== 0
    ) {
      throw new Error("provider runtime did not start from an empty journal");
    }

    const bytes = Buffer.from("understand-code provider doctor object v1", "utf8");
    const contentDigest = digestBytesV1(bytes);
    const encoded = `base64url:${bytes.toString("base64url")}`;
    const sourceWrite = await sourceClient.writeObject({
      locator: {
        providerId: SOURCE_PROVIDER_ID as never,
        contentDigest: contentDigest as never,
      },
      logicalBytes: bytes.byteLength,
      bytes: encoded,
    });
    const sourceRead = await sourceClient.readObject({
      providerId: SOURCE_PROVIDER_ID as never,
      contentDigest: contentDigest as never,
    });
    const destinationWrite = await destinationClient.writeObject({
      locator: {
        providerId: DESTINATION_PROVIDER_ID as never,
        contentDigest: contentDigest as never,
      },
      logicalBytes: bytes.byteLength,
      bytes: sourceRead.bytes,
    });
    const committed = await destinationClient.compareCommit({
      expectedRevision: 0,
      operationNonce: randomBytes(16).toString("hex"),
      phase: "provider_doctor_probe_completed",
      artifacts: { contentDigest, logicalBytes: bytes.byteLength },
    });
    if (
      sourceWrite.resolution !== "committed" ||
      sourceRead.verifiedContentDigest !== contentDigest ||
      sourceRead.bytes !== encoded ||
      destinationWrite.resolution !== "committed" ||
      committed.resolution !== "committed" ||
      committed.state.revision !== 1
    ) {
      throw new Error("provider runtime fixed-locator or CAS probe failed");
    }

    await stopRuntimeV1(destinationRuntime.child);
    destinationRuntime = await startRuntimeV1({
      command,
      prepared: destination,
      providerId: DESTINATION_PROVIDER_ID,
      capabilityDigest: DESTINATION_CAPABILITY_DIGEST,
      timeoutMs,
    });
    children.push(destinationRuntime.child);
    destinationClient = makeClientV1({
      running: destinationRuntime,
      key: destination.key,
      providerId: DESTINATION_PROVIDER_ID,
      capabilityDigest: DESTINATION_CAPABILITY_DIGEST,
    });
    const [recoveredState, recoveredObject] = await Promise.all([
      destinationClient.inspectState(),
      destinationClient.readObject({
        providerId: DESTINATION_PROVIDER_ID as never,
        contentDigest: contentDigest as never,
      }),
    ]);
    if (
      recoveredState.state.revision !== 1 ||
      recoveredState.state.phase !== "provider_doctor_probe_completed" ||
      recoveredObject.verifiedContentDigest !== contentDigest ||
      recoveredObject.bytes !== encoded
    ) {
      throw new Error("provider runtime restart recovery probe failed");
    }
    failureStage = "continuity";
    await assertExplicitTargetContinuityV1(explicitTarget);
    const currentTarget = await assertProviderRuntimeTargetContinuityV1(
      targetBaseline,
    );
    const conformance = await runProviderRuntimeRealFilesystemConformanceV1({
      targetInspection: currentTarget,
      providerId: DESTINATION_PROVIDER_ID,
      binaryDigest: DOCTOR_BINARY_DIGEST,
      policyDigest: DOCTOR_POLICY_DIGEST,
      capabilityDigest: DESTINATION_CAPABILITY_DIGEST,
    });

    return {
      schemaVersion: 1,
      profile: PROVIDER_DOCTOR_PROFILE_V1,
      ok: true,
      status: "durable_candidate",
      evidenceFreshness: "ephemeral_process_probe",
      strongStore: {
        available: false,
        authority: "read_only",
        reason: "os_principal_unverified",
        error: createProviderUnavailableToolErrorV1("attestation_invalid"),
      },
      targetProbe: passedTargetProbeV1(currentTarget),
      conformance,
      ...(service === undefined ? {} : { service }),
      runtime: {
        isolation: "two_child_processes",
        authenticatedIpc: "passed",
        fixedLocatorObject: "passed",
        compareCommit: "passed",
        restartRecovery: "passed",
        finalJournalRevision: 1,
      },
    };
  } catch (error) {
    const reason =
      error instanceof ProviderRuntimeTargetInspectionErrorV1 &&
      error.code === "unsupported_platform"
        ? "unsupported_filesystem_profile"
        : "unavailable";
    if (
      reason === "unavailable" &&
      failureStage === "runtime" &&
      explicitTarget !== undefined &&
      targetBaseline !== undefined
    ) {
      try {
        await assertExplicitTargetContinuityV1(explicitTarget);
        const currentTarget = await assertProviderRuntimeTargetContinuityV1(
          targetBaseline,
        );
        return unavailableResultV1(
          reason,
          passedTargetProbeV1(currentTarget),
          service,
        );
      } catch {
        // The public projection must fail closed if either target changed.
      }
    }
    return unavailableResultV1(reason, undefined, service);
  } finally {
    await Promise.all(children.map((child) => stopRuntimeV1(child)));
    source?.key.fill(0);
    destination?.key.fill(0);
    if (temporaryRoot !== undefined) {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}
