import { createHash } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { chmod, lstat, open, unlink } from "node:fs/promises";
import { createConnection, createServer, type Server, type Socket } from "node:net";
import { dirname, isAbsolute, resolve } from "node:path";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  ContentDigestV1Schema,
  KeyedStateTokenV1Schema,
  type DurableObjectIdentityProviderIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  ProviderRuntimeIpcCompareCommitResultV1Schema,
  ProviderRuntimeIpcFixedObjectLocatorV1Schema,
  ProviderRuntimeIpcJournalStateV1Schema,
  ProviderRuntimeIpcReadObjectResultV1Schema,
  ProviderRuntimeIpcWriteObjectResultV1Schema,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  PROVIDER_PRODUCTION_STRONG_CLIENT_DESCRIPTOR_PROFILE_V1,
  providerProductionStrongClientDescriptorPathV1,
  providerProductionStrongClientLifecycleLockPathV1,
} from "@understand-code/durable-object-provider-runtime/provider-production-strong-client-trust-lifecycle";
import { readProviderRuntimeNativeKernelPeerCredentialsV1 } from "@understand-code/native-kernel-bridge";

import {
  openProviderProductionStrongObjectHostCoreInternalV1,
  providerProductionStrongIndexPublicationAuthorityInternalV1,
  providerProductionStrongIndexPublicationCompareInputInternalV1,
  providerProductionStrongRefreshAuthorityInternalV1,
  providerProductionStrongRefreshAuthoritySelectorInternalV1,
  providerProductionStrongRefreshPublicationCompareInputInternalV1,
  snapshotProviderProductionStrongObjectOperationPlanObserverInternalV1,
  type OpenProviderProductionStrongObjectHostCoreInternalV1Input,
  type OpenProviderProductionStrongObjectClientV1Input,
  type ProviderProductionStrongCompareCommitIndexPublicationV1Input,
  type ProviderProductionStrongCompareCommitRefreshPublicationV1Input,
  type ProviderProductionStrongCompareCommitV1Input,
  type ProviderProductionStrongRefreshAuthorityInspectionV1,
  type ProviderProductionStrongObjectClientV1,
  type ProviderProductionStrongObjectHostInternalV1,
  type ProviderProductionStrongObjectOperationPlanObserverInternalV1,
  type ProviderProductionStrongWriteExactObjectV1Input,
} from "./provider-production-strong-object-client.js";

const GATEWAY_WIRE_PROFILE_V1 =
  "provider_production_strong_object_gateway_uds_v1" as const;
const MAX_GATEWAY_FRAME_BYTES_V1 = 32 * 1024 * 1024;
const MAX_DESCRIPTOR_BYTES_V1 = 1024 * 1024;
const GATEWAY_TIMEOUT_MS_V1 = 10_000;
const O_CLOEXEC_V1 =
  (fsConstants as Readonly<Record<string, number>>)["O_CLOEXEC"] ?? 0;

interface GatewayDescriptorV1 {
  readonly canonicalInstallationRoot: string;
  readonly providerId: DurableObjectIdentityProviderIdV1;
  readonly servicePrincipal: Readonly<{ readonly uid: number; readonly gid: number }>;
  readonly callerPrincipal: Readonly<{ readonly uid: number; readonly gid: number }>;
  readonly gatewaySocketPath: string;
  readonly serviceConfigPayloadDigest: string;
  readonly trustSnapshotDigest: string;
}

interface GatewayClientStateV1 {
  readonly descriptor: GatewayDescriptorV1;
}

interface GatewayLifecycleLeaseV1 {
  readonly lost: Promise<void>;
  held(): boolean;
  close(): Promise<void>;
}

interface GatewayServiceResourceClosersInternalV1 {
  closeServer(): Promise<void>;
  closeHost(): void;
  closeLifecycleLease(): Promise<void>;
}

const gatewayClientStatesV1 = new WeakMap<object, GatewayClientStateV1>();

/**
 * Shared production/test close coordinator. Every resource is attempted in
 * dependency order even when an earlier close fails, so an unlink/fsync error
 * can never strand the root lifecycle lease.
 */
export async function closeProviderProductionStrongObjectGatewayResourcesInternalV1(
  closers: GatewayServiceResourceClosersInternalV1,
): Promise<void> {
  const errors: unknown[] = [];
  try {
    await closers.closeServer();
  } catch (error) {
    errors.push(error);
  }
  try {
    closers.closeHost();
  } catch (error) {
    errors.push(error);
  }
  try {
    await closers.closeLifecycleLease();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      "production strong object gateway resource close failed",
    );
  }
}

function sameGatewayDescriptorV1(
  left: GatewayDescriptorV1,
  right: GatewayDescriptorV1,
): boolean {
  return left.canonicalInstallationRoot === right.canonicalInstallationRoot &&
    left.providerId === right.providerId &&
    left.servicePrincipal.uid === right.servicePrincipal.uid &&
    left.servicePrincipal.gid === right.servicePrincipal.gid &&
    left.callerPrincipal.uid === right.callerPrincipal.uid &&
    left.callerPrincipal.gid === right.callerPrincipal.gid &&
    left.gatewaySocketPath === right.gatewaySocketPath &&
    left.serviceConfigPayloadDigest === right.serviceConfigPayloadDigest &&
    left.trustSnapshotDigest === right.trustSnapshotDigest;
}

async function syncDirectoryV1(path: string): Promise<void> {
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

async function acquireGatewayLifecycleLeaseV1(
  descriptor: GatewayDescriptorV1,
): Promise<GatewayLifecycleLeaseV1> {
  const lockPath = providerProductionStrongClientLifecycleLockPathV1(
    descriptor.canonicalInstallationRoot,
  );
  const handle = await open(
    lockPath,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | O_CLOEXEC_V1,
  );
  let child: ChildProcessWithoutNullStreams | undefined;
  try {
    const before = await handle.stat({ bigint: true });
    const projected = await lstat(lockPath, { bigint: true });
    if (
      !before.isFile() || before.uid !== 0n || before.nlink !== 1n ||
      (before.mode & 0o777n) !== 0o600n || projected.isSymbolicLink() ||
      projected.dev !== before.dev || projected.ino !== before.ino
    ) return unavailableV1();
    child = spawn(
      "/usr/bin/setpriv",
      [
        `--reuid=${descriptor.servicePrincipal.uid}`,
        `--regid=${descriptor.servicePrincipal.gid}`,
        "--clear-groups",
        "/bin/sh",
        "-c",
        "/usr/bin/flock -x -w 2 3 || exit 1; printf ready; exec /usr/bin/cat",
      ],
      { stdio: ["pipe", "pipe", "pipe", handle.fd] },
    ) as ChildProcessWithoutNullStreams;
    let ready = false;
    let output = Buffer.alloc(0);
    let spawnError: Error | undefined;
    let lostState = false;
    let closedState = false;
    let resolveLost!: () => void;
    let resolveClosed!: () => void;
    const lost = new Promise<void>((resolvePromise) => {
      resolveLost = resolvePromise;
    });
    const closed = new Promise<void>((resolvePromise) => {
      resolveClosed = resolvePromise;
    });
    const markLost = (): void => {
      if (lostState) return;
      lostState = true;
      resolveLost();
    };
    const markClosed = (): void => {
      markLost();
      if (closedState) return;
      closedState = true;
      resolveClosed();
    };
    const held = (): boolean =>
      !lostState && child!.exitCode === null && child!.signalCode === null;
    const endInput = (): void => {
      if (!child!.stdin.destroyed && !child!.stdin.writableEnded) {
        child!.stdin.end();
      }
    };
    child.once("exit", markLost);
    child.once("close", markClosed);
    child.once("error", (error) => {
      spawnError = error;
      markLost();
    });
    child.stdout.on("data", (chunk: Buffer) => {
      output = Buffer.concat([output, chunk]);
      if (output.subarray(0, 5).toString("utf8") === "ready") ready = true;
    });
    await new Promise<void>((resolvePromise) => {
      const timer = setTimeout(resolvePromise, 3_000);
      const check = (): void => {
        if (ready || spawnError !== undefined || !held()) {
          clearTimeout(timer);
          resolvePromise();
        } else setImmediate(check);
      };
      check();
    });
    output.fill(0);
    if (!ready || !held()) {
      endInput();
      if (held()) child.kill("SIGKILL");
      await closed;
      return unavailableV1();
    }
    return Object.freeze({
      lost,
      held,
      async close(): Promise<void> {
        // Always drive EOF. If flock was signalled, its command may still own
        // the inherited pipe even though the lease itself is already lost.
        endInput();
        await closed;
      },
    });
  } finally {
    await handle.close();
  }
}

async function gatewaySocketIsLiveV1(path: string): Promise<boolean> {
  return new Promise<boolean>((resolvePromise, rejectPromise) => {
    const socket = createConnection(path);
    const timer = setTimeout(() => {
      socket.destroy();
      rejectPromise(new TypeError("production strong object gateway is unavailable"));
    }, 1_000);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolvePromise(true);
    });
    socket.once("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      socket.destroy();
      if (error.code === "ECONNREFUSED") resolvePromise(false);
      else rejectPromise(error);
    });
  });
}

async function reclaimExactStaleGatewaySocketV1(
  descriptor: GatewayDescriptorV1,
): Promise<void> {
  let stale;
  try {
    stale = await lstat(descriptor.gatewaySocketPath);
  } catch (error) {
    if (
      typeof error === "object" && error !== null && "code" in error &&
      (error as { readonly code?: unknown }).code === "ENOENT"
    ) return;
    throw error;
  }
  if (
    !stale.isSocket() || stale.isSymbolicLink() ||
    stale.uid !== descriptor.servicePrincipal.uid ||
    stale.gid !== descriptor.callerPrincipal.gid ||
    (stale.mode & 0o777) !== 0o660 ||
    await gatewaySocketIsLiveV1(descriptor.gatewaySocketPath)
  ) return unavailableV1();
  const projected = await lstat(descriptor.gatewaySocketPath);
  if (
    !projected.isSocket() || projected.isSymbolicLink() ||
    projected.dev !== stale.dev || projected.ino !== stale.ino ||
    projected.uid !== stale.uid || projected.gid !== stale.gid ||
    projected.mode !== stale.mode
  ) return unavailableV1();
  await unlink(descriptor.gatewaySocketPath);
  await syncDirectoryV1(dirname(descriptor.gatewaySocketPath));
}

export function providerProductionStrongObjectPrivilegeDropIsExactInternalV1(
  input: Readonly<{
    readonly actualUid: number | undefined;
    readonly actualGid: number | undefined;
    readonly supplementaryGroups: readonly number[];
    readonly expectedUid: number;
    readonly expectedGid: number;
  }>,
): boolean {
  return input.expectedUid > 0 && input.expectedGid > 0 &&
    input.actualUid === input.expectedUid &&
    input.actualGid === input.expectedGid &&
    !input.supplementaryGroups.includes(0) &&
    input.supplementaryGroups.every((gid) => gid === input.expectedGid);
}

export const PROVIDER_PRODUCTION_STRONG_OBJECT_UNAVAILABLE_CODE_V1 =
  "provider_production_strong_object_unavailable_v1" as const;

export class ProviderProductionStrongObjectUnavailableErrorV1 extends TypeError {
  readonly code = PROVIDER_PRODUCTION_STRONG_OBJECT_UNAVAILABLE_CODE_V1;

  constructor(options?: ErrorOptions) {
    super("production strong object gateway is unavailable", options);
    this.name = "ProviderProductionStrongObjectUnavailableErrorV1";
  }
}

export function isProviderProductionStrongObjectUnavailableErrorV1(
  error: unknown,
): error is ProviderProductionStrongObjectUnavailableErrorV1 {
  return error instanceof ProviderProductionStrongObjectUnavailableErrorV1 ||
    (
      typeof error === "object" && error !== null &&
      "name" in error &&
      error.name === "ProviderProductionStrongObjectUnavailableErrorV1" &&
      "code" in error &&
      error.code === PROVIDER_PRODUCTION_STRONG_OBJECT_UNAVAILABLE_CODE_V1
    );
}

export async function providerProductionStrongObjectUnavailableBoundaryInternalV1<
  T,
>(operation: () => T | Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isProviderProductionStrongObjectUnavailableErrorV1(error)) throw error;
    throw new ProviderProductionStrongObjectUnavailableErrorV1({ cause: error });
  }
}

function unavailableV1(): never {
  throw new ProviderProductionStrongObjectUnavailableErrorV1();
}

function recordV1(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function exactKeysV1(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

/** Internal focused-test seam for the revision-only public projection. */
export function providerProductionStrongObjectRevisionProjectionInternalV1(
  value: unknown,
): Readonly<{ revision: number }> {
  const inspected = recordV1(value);
  if (
    inspected === undefined || !exactKeysV1(inspected, ["revision"]) ||
    !Number.isSafeInteger(inspected.revision) ||
    (inspected.revision as number) < 0
  ) return unavailableV1();
  return Object.freeze({ revision: inspected.revision as number });
}

export function providerProductionStrongIndexPublicationGatewayRequestInternalV1(
  value: unknown,
): ProviderProductionStrongCompareCommitIndexPublicationV1Input {
  return providerProductionStrongIndexPublicationCompareInputInternalV1(value);
}

export function providerProductionStrongIndexPublicationGatewayResponseInternalV1(
  value: unknown,
) {
  return value === null
    ? undefined
    : providerProductionStrongIndexPublicationAuthorityInternalV1(value);
}

export function providerProductionStrongRefreshAuthorityGatewaySelectorInternalV1(
  value: unknown,
) {
  return providerProductionStrongRefreshAuthoritySelectorInternalV1(value);
}

export function providerProductionStrongRefreshPublicationGatewayRequestInternalV1(
  value: unknown,
): ProviderProductionStrongCompareCommitRefreshPublicationV1Input {
  return providerProductionStrongRefreshPublicationCompareInputInternalV1(
    value,
  );
}

export function providerProductionStrongRefreshAuthorityGatewayResponseInternalV1(
  value: unknown,
): ProviderProductionStrongRefreshAuthorityInspectionV1 {
  const inspected = recordV1(value);
  if (
    inspected === undefined ||
    !exactKeysV1(inspected, ["authority", "observedProviderRevision"]) ||
    !Number.isSafeInteger(inspected.observedProviderRevision) ||
    (inspected.observedProviderRevision as number) < 0
  ) return unavailableV1();
  const authority = inspected.authority === null
    ? undefined
    : providerProductionStrongRefreshAuthorityInternalV1(
        inspected.authority,
      );
  if (
    authority !== undefined &&
    authority.finalizedProviderRevision >
      (inspected.observedProviderRevision as number)
  ) return unavailableV1();
  return Object.freeze({
    authority,
    observedProviderRevision: inspected.observedProviderRevision as number,
  });
}

function exactPathV1(value: unknown): string {
  if (
    typeof value !== "string" || value.includes("\0") ||
    !isAbsolute(value) || resolve(value) !== value || value === "/"
  ) return unavailableV1();
  return value;
}

function kernelIdV1(value: unknown): number {
  if (
    !Number.isSafeInteger(value) || (value as number) < 0 ||
    (value as number) > 0xffff_ffff
  ) return unavailableV1();
  return value as number;
}

async function readRootDescriptorV1(
  canonicalInstallationRootInput: string,
): Promise<GatewayDescriptorV1> {
  const canonicalInstallationRoot = exactPathV1(canonicalInstallationRootInput);
  const descriptorPath = providerProductionStrongClientDescriptorPathV1(
    canonicalInstallationRoot,
  );
  const handle = await open(
    descriptorPath,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | O_CLOEXEC_V1,
  );
  let bytes: Buffer;
  try {
    const before = await handle.stat({ bigint: true });
    if (
      !before.isFile() || before.uid !== 0n || before.nlink !== 1n ||
      (before.mode & 0o777n) !== 0o644n || before.size < 1n ||
      before.size > BigInt(MAX_DESCRIPTOR_BYTES_V1)
    ) return unavailableV1();
    bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    const projected = await lstat(descriptorPath, { bigint: true });
    if (
      after.dev !== before.dev || after.ino !== before.ino ||
      after.mode !== before.mode || after.uid !== before.uid ||
      after.gid !== before.gid || after.nlink !== before.nlink ||
      after.size !== before.size || after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs || projected.dev !== before.dev ||
      projected.ino !== before.ino || projected.isSymbolicLink() ||
      bytes.byteLength !== Number(before.size)
    ) return unavailableV1();
  } finally {
    await handle.close();
  }
  try {
    const envelope = recordV1(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
    if (envelope === undefined || !exactKeysV1(envelope, ["payload", "contentDigest"])) {
      return unavailableV1();
    }
    const payload = recordV1(envelope.payload);
    if (
      payload === undefined || !exactKeysV1(payload, [
        "schemaVersion",
        "profile",
        "canonicalInstallationRoot",
        "providerId",
        "serviceConfigPayloadDigest",
        "servicePrincipal",
        "callerPrincipal",
        "gatewaySocketPath",
        "trustSnapshotDigest",
      ]) || payload.schemaVersion !== 1 ||
      payload.profile !== PROVIDER_PRODUCTION_STRONG_CLIENT_DESCRIPTOR_PROFILE_V1 ||
      payload.canonicalInstallationRoot !== canonicalInstallationRoot
    ) return unavailableV1();
    const digest = `sha256:${createHash("sha256").update(Buffer.from(
      canonicalizeJcsSafeIntegerV1([
        "provider-production-strong-client-descriptor-v1",
        payload,
      ]),
      "utf8",
    )).digest("hex")}`;
    if (envelope.contentDigest !== ContentDigestV1Schema.parse(digest)) {
      return unavailableV1();
    }
    ContentDigestV1Schema.parse(payload.serviceConfigPayloadDigest);
    ContentDigestV1Schema.parse(payload.trustSnapshotDigest);
    if (typeof payload.providerId !== "string" || payload.providerId.length < 1) {
      return unavailableV1();
    }
    const service = recordV1(payload.servicePrincipal);
    const caller = recordV1(payload.callerPrincipal);
    if (
      service === undefined || caller === undefined ||
      !exactKeysV1(service, ["name", "uid", "gid"]) ||
      !exactKeysV1(caller, ["uid", "gid"])
    ) return unavailableV1();
    const descriptor = Object.freeze({
      canonicalInstallationRoot,
      providerId: payload.providerId as DurableObjectIdentityProviderIdV1,
      servicePrincipal: Object.freeze({
        uid: kernelIdV1(service.uid),
        gid: kernelIdV1(service.gid),
      }),
      callerPrincipal: Object.freeze({
        uid: kernelIdV1(caller.uid),
        gid: kernelIdV1(caller.gid),
      }),
      gatewaySocketPath: exactPathV1(payload.gatewaySocketPath),
      serviceConfigPayloadDigest: ContentDigestV1Schema.parse(
        payload.serviceConfigPayloadDigest,
      ),
      trustSnapshotDigest: ContentDigestV1Schema.parse(
        payload.trustSnapshotDigest,
      ),
    });
    if (
      descriptor.servicePrincipal.uid === 0 ||
      descriptor.servicePrincipal.gid === 0 ||
      descriptor.callerPrincipal.uid === 0 ||
      descriptor.callerPrincipal.gid === 0 ||
      descriptor.servicePrincipal.uid === descriptor.callerPrincipal.uid
    ) return unavailableV1();
    return descriptor;
  } catch {
    return unavailableV1();
  } finally {
    bytes.fill(0);
  }
}

async function readFrameV1(socket: Socket): Promise<unknown> {
  return new Promise<unknown>((resolvePromise, rejectPromise) => {
    let buffered = Buffer.alloc(0);
    const cleanup = (): void => {
      socket.off("data", onData);
      socket.off("error", fail);
      socket.off("close", fail);
    };
    const fail = (): void => {
      cleanup();
      rejectPromise(new Error("production strong object gateway unavailable"));
    };
    const onData = (chunk: Buffer): void => {
      buffered = Buffer.concat([buffered, chunk]);
      if (buffered.byteLength > MAX_GATEWAY_FRAME_BYTES_V1) return fail();
      const newline = buffered.indexOf(0x0a);
      if (newline < 0) return;
      if (newline !== buffered.byteLength - 1) return fail();
      cleanup();
      try {
        resolvePromise(JSON.parse(buffered.subarray(0, newline).toString("utf8")));
      } catch {
        fail();
      }
    };
    socket.on("data", onData);
    socket.once("error", fail);
    socket.once("close", fail);
  });
}

async function writeFrameV1(socket: Socket, value: unknown): Promise<void> {
  const bytes = Buffer.from(`${canonicalizeJcsSafeIntegerV1(value)}\n`, "utf8");
  if (bytes.byteLength > MAX_GATEWAY_FRAME_BYTES_V1) unavailableV1();
  await new Promise<void>((resolvePromise, rejectPromise) => {
    socket.write(bytes, (error) => error === null || error === undefined
      ? resolvePromise()
      : rejectPromise(new Error("production strong object gateway unavailable")));
  });
}

async function connectAuthenticatedV1(descriptor: GatewayDescriptorV1): Promise<Socket> {
  const metadata = await lstat(descriptor.gatewaySocketPath);
  if (
    !metadata.isSocket() || metadata.isSymbolicLink() ||
    metadata.uid !== descriptor.servicePrincipal.uid ||
    metadata.gid !== descriptor.callerPrincipal.gid ||
    (metadata.mode & 0o777) !== 0o660
  ) return unavailableV1();
  const socket = createConnection(descriptor.gatewaySocketPath);
  socket.setTimeout(GATEWAY_TIMEOUT_MS_V1, () => socket.destroy());
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const fail = (): void => {
      socket.destroy();
      rejectPromise(new Error("production strong object gateway unavailable"));
    };
    socket.once("error", fail);
    socket.once("connect", () => {
      socket.off("error", fail);
      resolvePromise();
    });
  });
  const peer = readProviderRuntimeNativeKernelPeerCredentialsV1(socket);
  if (
    peer.uid !== descriptor.servicePrincipal.uid ||
    peer.gid !== descriptor.servicePrincipal.gid || peer.pid < 1
  ) {
    socket.destroy();
    return unavailableV1();
  }
  return socket;
}

async function exchangeV1(
  descriptor: GatewayDescriptorV1,
  operation: string,
  payload: unknown,
): Promise<unknown> {
  const socket = await connectAuthenticatedV1(descriptor);
  try {
    await writeFrameV1(socket, {
      profile: GATEWAY_WIRE_PROFILE_V1,
      operation,
      payload,
    });
    const response = recordV1(await readFrameV1(socket));
    if (
      response?.profile !== GATEWAY_WIRE_PROFILE_V1 ||
      typeof response.ok !== "boolean"
    ) return unavailableV1();
    if (response.ok !== true) return unavailableV1();
    return response.payload;
  } finally {
    socket.destroy();
  }
}

function stateV1(client: ProviderProductionStrongObjectClientV1): GatewayClientStateV1 {
  const state = gatewayClientStatesV1.get(client as object);
  if (state === undefined) return unavailableV1();
  return state;
}

export async function openProviderProductionStrongObjectClientV1(
  input: OpenProviderProductionStrongObjectClientV1Input,
): Promise<ProviderProductionStrongObjectClientV1> {
  if (!exactKeysV1(input as unknown as Record<string, unknown>, ["canonicalInstallationRoot"])) {
    return unavailableV1();
  }
  const { descriptor, inspected } =
    await providerProductionStrongObjectUnavailableBoundaryInternalV1(
      async () => {
        const verifiedDescriptor = await readRootDescriptorV1(
          input.canonicalInstallationRoot,
        );
        return {
          descriptor: verifiedDescriptor,
          inspected: recordV1(
            await exchangeV1(verifiedDescriptor, "inspect", {}),
          ),
        };
      },
    );
  if (
    inspected === undefined || !exactKeysV1(inspected, ["providerId"]) ||
    inspected.providerId !== descriptor.providerId
  ) return unavailableV1();
  const client = Object.freeze({
    verifiedProviderId: descriptor.providerId,
    async inspectState() {
      const current = stateV1(client).descriptor;
      return providerProductionStrongObjectUnavailableBoundaryInternalV1(
        async () => providerProductionStrongObjectRevisionProjectionInternalV1(
          await exchangeV1(current, "inspect_state", {}),
        ),
      );
    },
    async inspectBusinessHead() {
      const current = stateV1(client).descriptor;
      return providerProductionStrongObjectUnavailableBoundaryInternalV1(
        async () => ProviderRuntimeIpcJournalStateV1Schema.parse(
          await exchangeV1(current, "inspect_business_head", {}),
        ),
      );
    },
    async inspectIndexPublicationAuthority() {
      const current = stateV1(client).descriptor;
      return providerProductionStrongObjectUnavailableBoundaryInternalV1(
        async () => {
          const authority = await exchangeV1(
            current,
            "inspect_index_publication_authority",
            {},
          );
          return providerProductionStrongIndexPublicationGatewayResponseInternalV1(
            authority,
          );
        },
      );
    },
    async inspectStrongRefreshAuthority(
      repositoryIdInput: string,
      worktreeIdInput: string,
    ) {
      const current = stateV1(client).descriptor;
      const selector =
        providerProductionStrongRefreshAuthorityGatewaySelectorInternalV1({
          repositoryId: repositoryIdInput,
          worktreeId: worktreeIdInput,
        });
      return providerProductionStrongObjectUnavailableBoundaryInternalV1(
        async () => {
          const inspected =
            providerProductionStrongRefreshAuthorityGatewayResponseInternalV1(
            await exchangeV1(
              current,
              "inspect_strong_refresh_authority",
              selector,
            ),
            );
          if (
            inspected.authority !== undefined &&
            (
              inspected.authority.repositoryId !== selector.repositoryId ||
              inspected.authority.worktreeId !== selector.worktreeId
            )
          ) return unavailableV1();
          return inspected;
        },
      );
    },
    async readExactObject(locatorInput: Parameters<ProviderProductionStrongObjectClientV1["readExactObject"]>[0]) {
      const current = stateV1(client).descriptor;
      const locator = ProviderRuntimeIpcFixedObjectLocatorV1Schema.parse(locatorInput);
      if (locator.providerId !== current.providerId) return unavailableV1();
      return providerProductionStrongObjectUnavailableBoundaryInternalV1(
        async () => ProviderRuntimeIpcReadObjectResultV1Schema.parse(
          await exchangeV1(current, "read", { locator }),
        ),
      );
    },
    async writeExactObject(inputValue: ProviderProductionStrongWriteExactObjectV1Input) {
      const current = stateV1(client).descriptor;
      return providerProductionStrongObjectUnavailableBoundaryInternalV1(
        async () => ProviderRuntimeIpcWriteObjectResultV1Schema.parse(
          await exchangeV1(current, "write", inputValue),
        ),
      );
    },
    async compareCommit(inputValue: ProviderProductionStrongCompareCommitV1Input) {
      const current = stateV1(client).descriptor;
      return providerProductionStrongObjectUnavailableBoundaryInternalV1(
        async () => ProviderRuntimeIpcCompareCommitResultV1Schema.parse(
          await exchangeV1(current, "compare", inputValue),
        ),
      );
    },
    async compareCommitIndexPublication(
      inputValue: ProviderProductionStrongCompareCommitIndexPublicationV1Input,
    ) {
      const current = stateV1(client).descriptor;
      const input =
        providerProductionStrongIndexPublicationGatewayRequestInternalV1(
          inputValue,
        );
      return providerProductionStrongObjectUnavailableBoundaryInternalV1(
        async () => ProviderRuntimeIpcCompareCommitResultV1Schema.parse(
          await exchangeV1(current, "compare_index_publication", input),
        ),
      );
    },
    async compareCommitRefreshPublication(
      inputValue: ProviderProductionStrongCompareCommitRefreshPublicationV1Input,
    ) {
      const current = stateV1(client).descriptor;
      const input =
        providerProductionStrongRefreshPublicationGatewayRequestInternalV1(
          inputValue,
        );
      return providerProductionStrongObjectUnavailableBoundaryInternalV1(
        async () => ProviderRuntimeIpcCompareCommitResultV1Schema.parse(
          await exchangeV1(current, "compare_refresh_publication", input),
        ),
      );
    },
    async commitOwnerOnlyState(domain: Parameters<ProviderProductionStrongObjectClientV1["commitOwnerOnlyState"]>[0], canonicalValue: string) {
      const current = stateV1(client).descriptor;
      return providerProductionStrongObjectUnavailableBoundaryInternalV1(
        async () => KeyedStateTokenV1Schema.parse(
          await exchangeV1(current, "commit_owner", { domain, canonicalValue }),
        ),
      );
    },
    close(): void {
      gatewayClientStatesV1.delete(client);
    },
  }) as ProviderProductionStrongObjectClientV1;
  gatewayClientStatesV1.set(client, Object.freeze({ descriptor }));
  return client;
}

export interface ProviderProductionStrongObjectGatewayServiceV1 {
  readonly profile: "provider_production_strong_object_gateway_service_v1";
  readonly verifiedProviderId: DurableObjectIdentityProviderIdV1;
  close(): Promise<void>;
}

export interface StartProviderProductionStrongObjectGatewayServiceCoreInternalV1Input {
  readonly publicInput: OpenProviderProductionStrongObjectClientV1Input;
  readonly observeProviderOperationPlan?:
    ProviderProductionStrongObjectOperationPlanObserverInternalV1;
}

export function providerProductionStrongObjectGatewayPublicCoreInputInternalV1(
  input: OpenProviderProductionStrongObjectClientV1Input,
): StartProviderProductionStrongObjectGatewayServiceCoreInternalV1Input {
  return Object.freeze(Object.assign(
    Object.create(null) as
      StartProviderProductionStrongObjectGatewayServiceCoreInternalV1Input,
    { publicInput: input },
  ));
}

export function providerProductionStrongObjectGatewayHostCoreInputInternalV1(
  input: StartProviderProductionStrongObjectGatewayServiceCoreInternalV1Input,
): OpenProviderProductionStrongObjectHostCoreInternalV1Input {
  if (input === null || typeof input !== "object") return unavailableV1();
  let publicInputDescriptor: PropertyDescriptor | undefined;
  try {
    publicInputDescriptor = Object.hasOwn(input, "publicInput")
      ? Object.getOwnPropertyDescriptor(input, "publicInput")
      : undefined;
  } catch {
    return unavailableV1();
  }
  const observerSnapshot =
    snapshotProviderProductionStrongObjectOperationPlanObserverInternalV1(
      input,
    );
  if (
    publicInputDescriptor === undefined ||
    !Object.hasOwn(publicInputDescriptor, "value") ||
    publicInputDescriptor.value === null ||
    typeof publicInputDescriptor.value !== "object" ||
    observerSnapshot.status !== "valid"
  ) return unavailableV1();
  const publicInputValue = publicInputDescriptor.value as
    OpenProviderProductionStrongObjectClientV1Input;
  let installationRootDescriptor: PropertyDescriptor | undefined;
  try {
    installationRootDescriptor = Object.hasOwn(
      publicInputValue,
      "canonicalInstallationRoot",
    )
      ? Object.getOwnPropertyDescriptor(
        publicInputValue,
        "canonicalInstallationRoot",
      )
      : undefined;
  } catch {
    return unavailableV1();
  }
  if (
    installationRootDescriptor === undefined ||
    !Object.hasOwn(installationRootDescriptor, "value") ||
    typeof installationRootDescriptor.value !== "string"
  ) return unavailableV1();
  const publicInput = Object.freeze(Object.assign(
    Object.create(null) as OpenProviderProductionStrongObjectClientV1Input,
    {
      canonicalInstallationRoot: installationRootDescriptor.value,
    },
  ));
  return Object.freeze(Object.assign(
    Object.create(null) as
      OpenProviderProductionStrongObjectHostCoreInternalV1Input,
    {
      publicInput,
      observeProviderOperationPlan:
        observerSnapshot.observeProviderOperationPlan,
    },
  ));
}

class GatewayServerInternalV1 {
  readonly #host: ProviderProductionStrongObjectHostInternalV1;
  readonly #lifecycleLeaseHeld: () => boolean;
  readonly #connections = new Set<Socket>();
  readonly #active = new Set<Promise<void>>();
  #server: Server | undefined;
  #identity: { readonly dev: number; readonly ino: number } | undefined;
  #servicePrincipalActive = false;

  constructor(
    host: ProviderProductionStrongObjectHostInternalV1,
    lifecycleLeaseHeld: () => boolean,
  ) {
    this.#host = host;
    this.#lifecycleLeaseHeld = lifecycleLeaseHeld;
  }

  async start(): Promise<void> {
    if (
      process.geteuid?.() !== this.#host.servicePrincipal.uid ||
      process.getegid?.() !== this.#host.servicePrincipal.gid ||
      !this.#lifecycleLeaseHeld()
    ) return unavailableV1();
    const directory = await lstat(dirname(this.#host.gatewaySocketPath));
    if (
      !directory.isDirectory() || directory.isSymbolicLink() ||
      directory.uid !== this.#host.servicePrincipal.uid ||
      directory.gid !== this.#host.callerPrincipal.gid ||
      (directory.mode & 0o777) !== 0o710 ||
      (directory.mode & 0o2000) === 0
    ) return unavailableV1();
    try {
      await lstat(this.#host.gatewaySocketPath);
      return unavailableV1();
    } catch (error) {
      if (
        !(typeof error === "object" && error !== null && "code" in error &&
          (error as { readonly code?: unknown }).code === "ENOENT")
      ) throw error;
    }
    const server = createServer((socket) => {
      if (!this.#servicePrincipalActive || !this.#lifecycleLeaseHeld()) {
        socket.destroy();
        return;
      }
      this.#connections.add(socket);
      socket.once("close", () => this.#connections.delete(socket));
      const active = this.#serve(socket);
      this.#active.add(active);
      void active.finally(() => this.#active.delete(active));
    });
    this.#server = server;
    try {
      // start() is called only after the exact service drop. Mark the handler
      // live before listen() so a caller cannot win the tiny accept/return
      // race and receive a spurious closed connection.
      this.#servicePrincipalActive = true;
      await new Promise<void>((resolvePromise, rejectPromise) => {
        const fail = (error: Error): void => rejectPromise(error);
        server.once("error", fail);
        server.listen(this.#host.gatewaySocketPath, () => {
          server.off("error", fail);
          resolvePromise();
        });
      });
      const created = await lstat(this.#host.gatewaySocketPath);
      if (
        !created.isSocket() || created.isSymbolicLink() ||
        created.uid !== this.#host.servicePrincipal.uid ||
        created.gid !== this.#host.callerPrincipal.gid
      ) return unavailableV1();
      this.#identity = { dev: created.dev, ino: created.ino };
      await chmod(this.#host.gatewaySocketPath, 0o660);
      const projected = await lstat(this.#host.gatewaySocketPath);
      if (
        projected.dev !== created.dev || projected.ino !== created.ino ||
        projected.uid !== this.#host.servicePrincipal.uid ||
        projected.gid !== this.#host.callerPrincipal.gid ||
        (projected.mode & 0o777) !== 0o660 ||
        !this.#lifecycleLeaseHeld()
      ) return unavailableV1();
    } catch (error) {
      await this.close().catch(() => undefined);
      throw error;
    }
  }

  async close(): Promise<void> {
    this.#servicePrincipalActive = false;
    const server = this.#server;
    this.#server = undefined;
    const closed = server === undefined || !server.listening
      ? Promise.resolve()
      : new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    for (const connection of this.#connections) connection.destroy();
    await Promise.allSettled([...this.#active]);
    await closed;
    const identity = this.#identity;
    this.#identity = undefined;
    if (identity === undefined) return;
    try {
      const projected = await lstat(this.#host.gatewaySocketPath);
      if (
        projected.isSocket() && projected.dev === identity.dev &&
        projected.ino === identity.ino
      ) {
        await unlink(this.#host.gatewaySocketPath);
        await syncDirectoryV1(dirname(this.#host.gatewaySocketPath));
      }
    } catch (error) {
      if (
        !(typeof error === "object" && error !== null && "code" in error &&
          (error as { readonly code?: unknown }).code === "ENOENT")
      ) throw error;
    }
  }

  activateServicePrincipal(): void {
    if (
      this.#server === undefined || !this.#server.listening ||
      !this.#lifecycleLeaseHeld()
    ) unavailableV1();
    this.#servicePrincipalActive = true;
  }

  async #serve(socket: Socket): Promise<void> {
    socket.setTimeout(GATEWAY_TIMEOUT_MS_V1, () => socket.destroy());
    try {
      // The listener is created only after the exact service drop. This keeps
      // Linux SO_PEERCRED bound to the service principal rather than root.
      if (!this.#servicePrincipalActive || !this.#lifecycleLeaseHeld()) return;
      const peer = readProviderRuntimeNativeKernelPeerCredentialsV1(socket);
      if (
        peer.uid !== this.#host.callerPrincipal.uid ||
        peer.gid !== this.#host.callerPrincipal.gid || peer.pid < 1
      ) return;
      const request = recordV1(await readFrameV1(socket));
      if (
        request?.profile !== GATEWAY_WIRE_PROFILE_V1 ||
        typeof request.operation !== "string"
      ) return;
      const payload = recordV1(request.payload);
      let result: unknown;
      switch (request.operation) {
        case "inspect":
          if (payload === undefined || !exactKeysV1(payload, [])) return;
          result = { providerId: this.#host.verifiedProviderId };
          break;
        case "inspect_state":
          if (payload === undefined || !exactKeysV1(payload, [])) return;
          result = await this.#host.inspectState();
          break;
        case "inspect_business_head":
          if (payload === undefined || !exactKeysV1(payload, [])) return;
          result = await this.#host.inspectBusinessHead();
          break;
        case "inspect_index_publication_authority":
          if (payload === undefined || !exactKeysV1(payload, [])) return;
          result = (await this.#host.inspectIndexPublicationAuthority()) ?? null;
          break;
        case "inspect_strong_refresh_authority": {
          const selector =
            providerProductionStrongRefreshAuthorityGatewaySelectorInternalV1(
              payload,
            );
          const inspected = await this.#host.inspectStrongRefreshAuthority(
            selector.repositoryId,
            selector.worktreeId,
          );
          result = {
            authority: inspected.authority ?? null,
            observedProviderRevision: inspected.observedProviderRevision,
          };
          break;
        }
        case "read": {
          if (payload === undefined || !exactKeysV1(payload, ["locator"])) return;
          result = await this.#host.readExactObject(
            ProviderRuntimeIpcFixedObjectLocatorV1Schema.parse(payload.locator),
          );
          break;
        }
        case "write":
          result = await this.#host.writeExactObject(
            payload as unknown as ProviderProductionStrongWriteExactObjectV1Input,
          );
          break;
        case "compare":
          result = await this.#host.compareCommit(
            payload as unknown as ProviderProductionStrongCompareCommitV1Input,
          );
          break;
        case "compare_index_publication":
          // The UDS admits only the configured mutation caller principal. This
          // explicit operation is that principal's sole authority-lane surface;
          // ordinary `compare` still rejects the reserved artifact key.
          result = await this.#host.compareCommitIndexPublication(
            providerProductionStrongIndexPublicationGatewayRequestInternalV1(
              payload,
            ),
          );
          break;
        case "compare_refresh_publication":
          // One compare-commit advances the latest-refresh authority and, for
          // full finalization, the index-publication authority atomically.
          result = await this.#host.compareCommitRefreshPublication(
            providerProductionStrongRefreshPublicationGatewayRequestInternalV1(
              payload,
            ),
          );
          break;
        case "commit_owner":
          if (
            payload === undefined ||
            !exactKeysV1(payload, ["domain", "canonicalValue"]) ||
            typeof payload.domain !== "string" ||
            typeof payload.canonicalValue !== "string"
          ) return;
          result = this.#host.commitOwnerOnlyState(
            payload.domain as Parameters<ProviderProductionStrongObjectHostInternalV1["commitOwnerOnlyState"]>[0],
            payload.canonicalValue,
          );
          break;
        default:
          return;
      }
      if (!this.#lifecycleLeaseHeld()) return;
      await writeFrameV1(socket, {
        profile: GATEWAY_WIRE_PROFILE_V1,
        ok: true,
        payload: result,
      });
    } catch {
      if (this.#lifecycleLeaseHeld() && !socket.destroyed) {
        await writeFrameV1(socket, {
          profile: GATEWAY_WIRE_PROFILE_V1,
          ok: false,
          payload: null,
        }).catch(() => undefined);
      }
    } finally {
      socket.end();
    }
  }
}

/**
 * Root-only tracked composition. It verifies and retains the complete signed
 * closure, irreversibly drops to the signed dedicated service principal, and
 * creates the peer-authenticated gateway under that principal before returning.
 */
export async function startProviderProductionStrongObjectGatewayServiceCoreInternalV1(
  coreInput: StartProviderProductionStrongObjectGatewayServiceCoreInternalV1Input,
): Promise<ProviderProductionStrongObjectGatewayServiceV1> {
  const hostCoreInput =
    providerProductionStrongObjectGatewayHostCoreInputInternalV1(coreInput);
  const input = hostCoreInput.publicInput;
  if (process.platform !== "linux" || process.geteuid?.() !== 0) unavailableV1();
  const observedDescriptor = await readRootDescriptorV1(
    input.canonicalInstallationRoot,
  );
  const lifecycleLease = await acquireGatewayLifecycleLeaseV1(
    observedDescriptor,
  );
  let host: ProviderProductionStrongObjectHostInternalV1 | undefined;
  let server: GatewayServerInternalV1 | undefined;
  try {
    const descriptor = await readRootDescriptorV1(
      input.canonicalInstallationRoot,
    );
    if (!sameGatewayDescriptorV1(observedDescriptor, descriptor)) {
      return unavailableV1();
    }
    await reclaimExactStaleGatewaySocketV1(descriptor);
    host = await openProviderProductionStrongObjectHostCoreInternalV1(
      hostCoreInput,
    );
    if (
      host.verifiedInstallationRoot !== descriptor.canonicalInstallationRoot ||
      host.verifiedProviderId !== descriptor.providerId ||
      host.gatewaySocketPath !== descriptor.gatewaySocketPath ||
      host.serviceConfigPayloadDigest !== descriptor.serviceConfigPayloadDigest ||
      host.trustSnapshotDigest !== descriptor.trustSnapshotDigest ||
      host.servicePrincipal.uid !== descriptor.servicePrincipal.uid ||
      host.servicePrincipal.gid !== descriptor.servicePrincipal.gid ||
      host.callerPrincipal.uid !== descriptor.callerPrincipal.uid ||
      host.callerPrincipal.gid !== descriptor.callerPrincipal.gid
    ) return unavailableV1();
    server = new GatewayServerInternalV1(host, lifecycleLease.held);
    if (
      typeof process.setgroups !== "function" ||
      typeof process.getgroups !== "function" ||
      typeof process.setgid !== "function" ||
      typeof process.setuid !== "function" ||
      host.servicePrincipal.uid === 0 || host.servicePrincipal.gid === 0
    ) return unavailableV1();
    if (!lifecycleLease.held()) return unavailableV1();
    process.setgroups([host.servicePrincipal.gid]);
    process.setgid(host.servicePrincipal.gid);
    process.setuid(host.servicePrincipal.uid);
    const supplementaryGroups = process.getgroups();
    if (!providerProductionStrongObjectPrivilegeDropIsExactInternalV1({
      actualUid: process.geteuid?.(),
      actualGid: process.getegid?.(),
      supplementaryGroups,
      expectedUid: host.servicePrincipal.uid,
      expectedGid: host.servicePrincipal.gid,
    })) return unavailableV1();
    await server.start();
    if (!lifecycleLease.held()) return unavailableV1();
    server.activateServicePrincipal();
  } catch (error) {
    await closeProviderProductionStrongObjectGatewayResourcesInternalV1({
      closeServer: async () => server?.close(),
      closeHost: () => host?.close(),
      closeLifecycleLease: () => lifecycleLease.close(),
    }).catch(() => undefined);
    throw error;
  }
  let closePromise: Promise<void> | undefined;
  const closeAll = (): Promise<void> => {
    closePromise ??=
      closeProviderProductionStrongObjectGatewayResourcesInternalV1({
        closeServer: () => server!.close(),
        closeHost: () => host!.close(),
        closeLifecycleLease: () => lifecycleLease.close(),
      });
    return closePromise;
  };
  void lifecycleLease.lost.then(() => {
    if (closePromise === undefined) void closeAll().catch(() => undefined);
  });
  return Object.freeze({
    profile: "provider_production_strong_object_gateway_service_v1" as const,
    verifiedProviderId: host.verifiedProviderId,
    close: closeAll,
  });
}

export async function startProviderProductionStrongObjectGatewayServiceV1(
  input: OpenProviderProductionStrongObjectClientV1Input,
): Promise<ProviderProductionStrongObjectGatewayServiceV1> {
  return startProviderProductionStrongObjectGatewayServiceCoreInternalV1(
    providerProductionStrongObjectGatewayPublicCoreInputInternalV1(input),
  );
}
