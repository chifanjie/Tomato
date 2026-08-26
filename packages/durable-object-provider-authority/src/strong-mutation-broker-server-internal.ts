import { randomBytes } from "node:crypto";
import { chmod, chown, lstat, unlink } from "node:fs/promises";
import { createServer, type Server, type Socket } from "node:net";
import { dirname, isAbsolute, resolve } from "node:path";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import { readProviderRuntimeNativeKernelPeerCredentialsV1 } from "@understand-code/native-kernel-bridge";

import {
  createProviderStrongMutationProductionSessionCallbacksInternalV1,
  type ProviderStrongMutationProductionGrantContextInternalV1,
  type ProviderStrongMutationProductionGrantResolutionInternalV1,
} from "./strong-mutation-production-session-internal.js";
import type { ProviderStrongMutationBrokerStoreInternalV1 } from "./strong-mutation-broker-core-internal.js";

const BROKER_WIRE_PROFILE_V1 =
  "provider_strong_mutation_broker_uds_v1" as const;
const MAX_BROKER_FRAME_BYTES_V1 = 10 * 1024 * 1024;
const BROKER_TIMEOUT_MS_V1 = 5_000;

export interface ProviderStrongMutationBrokerServerOptionsInternalV1 {
  readonly socketPath: string;
  readonly expectedRuntimeUid: number;
  readonly expectedRuntimeGid: number;
  readonly broker: ProviderStrongMutationBrokerStoreInternalV1;
}

function kernelIdV1(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new TypeError("strong mutation broker principal is invalid");
  }
  return value;
}

function recordV1(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
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
      rejectPromise(new Error("strong mutation broker protocol failed"));
    };
    const onData = (chunk: Buffer): void => {
      buffered = Buffer.concat([buffered, chunk]);
      if (buffered.byteLength > MAX_BROKER_FRAME_BYTES_V1) return fail();
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
  if (bytes.byteLength > MAX_BROKER_FRAME_BYTES_V1) {
    throw new Error("strong mutation broker protocol failed");
  }
  await new Promise<void>((resolvePromise, rejectPromise) => {
    socket.write(bytes, (error) => error === null || error === undefined
      ? resolvePromise()
      : rejectPromise(new Error("strong mutation broker protocol failed")));
  });
}

export class ProviderStrongMutationBrokerServerInternalV1 {
  readonly #socketPath: string;
  readonly #expectedRuntimeUid: number;
  readonly #expectedRuntimeGid: number;
  readonly #session: ReturnType<
    typeof createProviderStrongMutationProductionSessionCallbacksInternalV1
  >;
  readonly #connections = new Set<Socket>();
  readonly #active = new Set<Promise<void>>();
  #server: Server | undefined;
  #socketIdentity: { readonly dev: number; readonly ino: number } | undefined;

  constructor(options: ProviderStrongMutationBrokerServerOptionsInternalV1) {
    const socketPath = resolve(options.socketPath);
    if (
      process.platform !== "linux" ||
      !isAbsolute(options.socketPath) ||
      socketPath !== options.socketPath ||
      dirname(socketPath) === socketPath
    ) throw new TypeError("strong mutation broker server is unavailable");
    this.#socketPath = socketPath;
    this.#expectedRuntimeUid = kernelIdV1(options.expectedRuntimeUid);
    this.#expectedRuntimeGid = kernelIdV1(options.expectedRuntimeGid);
    this.#session =
      createProviderStrongMutationProductionSessionCallbacksInternalV1(
        options.broker,
      );
  }

  async start(): Promise<void> {
    if (this.#server !== undefined) {
      throw new TypeError("strong mutation broker server already started");
    }
    try {
      await lstat(this.#socketPath);
      throw new TypeError("strong mutation broker socket already exists");
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
        server.listen(this.#socketPath, () => {
          server.off("error", fail);
          resolvePromise();
        });
      });
      const created = await lstat(this.#socketPath);
      if (!created.isSocket() || created.isSymbolicLink()) {
        throw new TypeError("strong mutation broker socket is invalid");
      }
      // Capture the exact created inode before any fallible ownership/mode
      // projection so close() can remove only this socket after partial start.
      this.#socketIdentity = { dev: created.dev, ino: created.ino };
      await chown(
        this.#socketPath,
        typeof process.geteuid === "function" ? process.geteuid() : process.getuid!(),
        this.#expectedRuntimeGid,
      );
      await chmod(this.#socketPath, 0o660);
      const metadata = await lstat(this.#socketPath);
      if (
        !metadata.isSocket() || metadata.isSymbolicLink() ||
        metadata.dev !== created.dev || metadata.ino !== created.ino
      ) {
        throw new TypeError("strong mutation broker socket is invalid");
      }
    } catch (error) {
      await this.close().catch(() => undefined);
      throw error;
    }
  }

  async close(): Promise<void> {
    const server = this.#server;
    this.#server = undefined;
    const closed = server === undefined || !server.listening
      ? Promise.resolve()
      : new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    for (const connection of this.#connections) connection.destroy();
    await Promise.allSettled([...this.#active]);
    await closed;
    const identity = this.#socketIdentity;
    this.#socketIdentity = undefined;
    if (identity === undefined) return;
    try {
      const metadata = await lstat(this.#socketPath);
      if (
        metadata.isSocket() &&
        metadata.dev === identity.dev &&
        metadata.ino === identity.ino
      ) await unlink(this.#socketPath);
    } catch (error) {
      if (
        !(typeof error === "object" && error !== null && "code" in error &&
          (error as { readonly code?: unknown }).code === "ENOENT")
      ) throw error;
    }
  }

  async #serve(socket: Socket): Promise<void> {
    socket.setTimeout(BROKER_TIMEOUT_MS_V1, () => socket.destroy());
    try {
      const peer = readProviderRuntimeNativeKernelPeerCredentialsV1(socket);
      if (
        peer.uid !== this.#expectedRuntimeUid ||
        peer.gid !== this.#expectedRuntimeGid ||
        !Number.isSafeInteger(peer.pid) ||
        peer.pid < 1
      ) return;
      const first = recordV1(await readFrameV1(socket));
      if (first?.profile !== BROKER_WIRE_PROFILE_V1) return;
      if (first.kind === "resolve") {
        const resolved = await this.#session.resolveGrant(
          first.resolution as
            ProviderStrongMutationProductionGrantResolutionInternalV1,
        );
        await writeFrameV1(socket, {
          profile: BROKER_WIRE_PROFILE_V1,
          kind: "resolve_result",
          resolved,
        });
        return;
      }
      if (first.kind !== "begin") return;
      const decision = await this.#session.consumeGrant(
        first.context as ProviderStrongMutationProductionGrantContextInternalV1,
      );
      if (decision === false) {
        await writeFrameV1(socket, {
          profile: BROKER_WIRE_PROFILE_V1,
          kind: "begin_result",
          disposition: "rejected",
        });
        return;
      }
      if (decision.disposition === "resolved") {
        await writeFrameV1(socket, {
          profile: BROKER_WIRE_PROFILE_V1,
          kind: "begin_result",
          disposition: "resolved",
          response: decision.response,
        });
        return;
      }
      const leaseNonce = randomBytes(32).toString("hex");
      await writeFrameV1(socket, {
        profile: BROKER_WIRE_PROFILE_V1,
        kind: "begin_result",
        disposition: decision.disposition,
        leaseNonce,
      });
      const activation = recordV1(await readFrameV1(socket));
      const activated = activation?.profile === BROKER_WIRE_PROFILE_V1 &&
        activation.kind === "activate" &&
        activation.leaseNonce === leaseNonce &&
        await decision.activateExecutionAuthorization();
      await writeFrameV1(socket, {
        profile: BROKER_WIRE_PROFILE_V1,
        kind: "activate_result",
        activated,
      });
    } catch {
      // The peer receives only a closed channel; no path, PID, or broker error.
    } finally {
      if (!socket.destroyed) socket.end();
    }
  }
}
