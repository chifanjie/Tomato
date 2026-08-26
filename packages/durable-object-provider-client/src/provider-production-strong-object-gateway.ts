import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { chmod, chown, lstat, open, unlink } from "node:fs/promises";
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
  ProviderRuntimeIpcReadObjectResultV1Schema,
  ProviderRuntimeIpcWriteObjectResultV1Schema,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  PROVIDER_PRODUCTION_STRONG_CLIENT_DESCRIPTOR_PROFILE_V1,
  providerProductionStrongClientDescriptorPathV1,
} from "@understand-code/durable-object-provider-runtime/provider-production-strong-client-trust-lifecycle";
import { readProviderRuntimeNativeKernelPeerCredentialsV1 } from "@understand-code/native-kernel-bridge";

import {
  openProviderProductionStrongObjectHostInternalV1,
  type OpenProviderProductionStrongObjectClientV1Input,
  type ProviderProductionStrongCompareCommitV1Input,
  type ProviderProductionStrongObjectClientV1,
  type ProviderProductionStrongObjectHostInternalV1,
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

const gatewayClientStatesV1 = new WeakMap<object, GatewayClientStateV1>();

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

function unavailableV1(): never {
  throw new TypeError("production strong object gateway is unavailable");
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
  const descriptor = await readRootDescriptorV1(input.canonicalInstallationRoot);
  const inspected = recordV1(await exchangeV1(descriptor, "inspect", {}));
  if (
    inspected === undefined || !exactKeysV1(inspected, ["providerId"]) ||
    inspected.providerId !== descriptor.providerId
  ) return unavailableV1();
  const client = Object.freeze({
    verifiedProviderId: descriptor.providerId,
    async readExactObject(locatorInput: Parameters<ProviderProductionStrongObjectClientV1["readExactObject"]>[0]) {
      const current = stateV1(client).descriptor;
      const locator = ProviderRuntimeIpcFixedObjectLocatorV1Schema.parse(locatorInput);
      if (locator.providerId !== current.providerId) return unavailableV1();
      return ProviderRuntimeIpcReadObjectResultV1Schema.parse(
        await exchangeV1(current, "read", { locator }),
      );
    },
    async writeExactObject(inputValue: ProviderProductionStrongWriteExactObjectV1Input) {
      const current = stateV1(client).descriptor;
      return ProviderRuntimeIpcWriteObjectResultV1Schema.parse(
        await exchangeV1(current, "write", inputValue),
      );
    },
    async compareCommit(inputValue: ProviderProductionStrongCompareCommitV1Input) {
      const current = stateV1(client).descriptor;
      return ProviderRuntimeIpcCompareCommitResultV1Schema.parse(
        await exchangeV1(current, "compare", inputValue),
      );
    },
    async commitOwnerOnlyState(domain: Parameters<ProviderProductionStrongObjectClientV1["commitOwnerOnlyState"]>[0], canonicalValue: string) {
      const current = stateV1(client).descriptor;
      return KeyedStateTokenV1Schema.parse(
        await exchangeV1(current, "commit_owner", { domain, canonicalValue }),
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

class GatewayServerInternalV1 {
  readonly #host: ProviderProductionStrongObjectHostInternalV1;
  readonly #connections = new Set<Socket>();
  readonly #active = new Set<Promise<void>>();
  #server: Server | undefined;
  #identity: { readonly dev: number; readonly ino: number } | undefined;
  #servicePrincipalActive = false;

  constructor(host: ProviderProductionStrongObjectHostInternalV1) {
    this.#host = host;
  }

  async start(): Promise<void> {
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
      this.#connections.add(socket);
      socket.once("close", () => this.#connections.delete(socket));
      const active = this.#serve(socket);
      this.#active.add(active);
      void active.finally(() => this.#active.delete(active));
    });
    this.#server = server;
    try {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        const fail = (error: Error): void => rejectPromise(error);
        server.once("error", fail);
        server.listen(this.#host.gatewaySocketPath, () => {
          server.off("error", fail);
          resolvePromise();
        });
      });
      const created = await lstat(this.#host.gatewaySocketPath);
      if (!created.isSocket() || created.isSymbolicLink()) return unavailableV1();
      this.#identity = { dev: created.dev, ino: created.ino };
      await chown(
        this.#host.gatewaySocketPath,
        this.#host.servicePrincipal.uid,
        this.#host.callerPrincipal.gid,
      );
      await chmod(this.#host.gatewaySocketPath, 0o660);
      const projected = await lstat(this.#host.gatewaySocketPath);
      if (
        projected.dev !== created.dev || projected.ino !== created.ino ||
        projected.uid !== this.#host.servicePrincipal.uid ||
        projected.gid !== this.#host.callerPrincipal.gid ||
        (projected.mode & 0o777) !== 0o660
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
      ) await unlink(this.#host.gatewaySocketPath);
    } catch (error) {
      if (
        !(typeof error === "object" && error !== null && "code" in error &&
          (error as { readonly code?: unknown }).code === "ENOENT")
      ) throw error;
    }
  }

  activateServicePrincipal(): void {
    if (this.#server === undefined || !this.#server.listening) unavailableV1();
    this.#servicePrincipalActive = true;
  }

  async #serve(socket: Socket): Promise<void> {
    socket.setTimeout(GATEWAY_TIMEOUT_MS_V1, () => socket.destroy());
    try {
      // Listening begins while privileged only so the exact inode can be
      // projected. No operation may cross that privilege-drop interval.
      if (!this.#servicePrincipalActive) return;
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
      await writeFrameV1(socket, {
        profile: GATEWAY_WIRE_PROFILE_V1,
        ok: true,
        payload: result,
      });
    } catch {
      if (!socket.destroyed) {
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
 * closure, starts the peer-authenticated gateway, then irreversibly drops to
 * the signed dedicated service principal before returning.
 */
export async function startProviderProductionStrongObjectGatewayServiceV1(
  input: OpenProviderProductionStrongObjectClientV1Input,
): Promise<ProviderProductionStrongObjectGatewayServiceV1> {
  if (process.platform !== "linux" || process.geteuid?.() !== 0) unavailableV1();
  const descriptor = await readRootDescriptorV1(input.canonicalInstallationRoot);
  const host = await openProviderProductionStrongObjectHostInternalV1(input);
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
  ) {
    host.close();
    return unavailableV1();
  }
  const server = new GatewayServerInternalV1(host);
  try {
    await server.start();
    if (
      typeof process.setgroups !== "function" ||
      typeof process.getgroups !== "function" ||
      typeof process.setgid !== "function" ||
      typeof process.setuid !== "function" ||
      host.servicePrincipal.uid === 0 || host.servicePrincipal.gid === 0
    ) return unavailableV1();
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
    server.activateServicePrincipal();
  } catch (error) {
    await server.close().catch(() => undefined);
    host.close();
    throw error;
  }
  return Object.freeze({
    profile: "provider_production_strong_object_gateway_service_v1" as const,
    verifiedProviderId: host.verifiedProviderId,
    async close(): Promise<void> {
      await server.close();
      host.close();
    },
  });
}
