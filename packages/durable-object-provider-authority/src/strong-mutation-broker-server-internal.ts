import { randomBytes } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { chmod, chown, lstat, open, unlink } from "node:fs/promises";
import { createConnection, createServer, type Server, type Socket } from "node:net";
import { dirname, isAbsolute, resolve } from "node:path";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import type {
  ProviderAcceptanceGenerationPinV1,
  ProviderAcceptanceStateEnvelopeV1,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import { readProviderRuntimeNativeKernelPeerCredentialsV1 } from "@understand-code/native-kernel-bridge";

import {
  createProviderStrongMutationProductionSessionCallbacksInternalV1,
  type ProviderStrongMutationProductionGrantContextInternalV1,
  type ProviderStrongMutationProductionGrantResolutionInternalV1,
  type ProviderStrongMutationProductionSessionCallbacksInternalV1,
} from "./strong-mutation-production-session-internal.js";
import type { ProviderStrongMutationBrokerStoreInternalV1 } from "./strong-mutation-broker-core-internal.js";

const BROKER_WIRE_PROFILE_V1 =
  "provider_strong_mutation_broker_uds_v1" as const;
const MAX_BROKER_FRAME_BYTES_V1 = 10 * 1024 * 1024;
const BROKER_TIMEOUT_MS_V1 = 5_000;
const O_CLOEXEC_V1 =
  (fsConstants as Readonly<Record<string, number>>)["O_CLOEXEC"] ?? 0;

export interface ProviderStrongMutationBrokerServerOptionsInternalV1 {
  readonly socketPath: string;
  readonly leasePath: string;
  readonly expectedRuntimeUid: number;
  readonly expectedRuntimeGid: number;
  readonly broker: ProviderStrongMutationBrokerStoreInternalV1;
  /** Root-owned lazy current view; never derived from the runtime request. */
  readonly readCurrentFormalAcceptance?: () =>
    | Readonly<{
        readonly envelope: ProviderAcceptanceStateEnvelopeV1;
        readonly pin: ProviderAcceptanceGenerationPinV1;
      }>
    | false
    | Promise<Readonly<{
        readonly envelope: ProviderAcceptanceStateEnvelopeV1;
        readonly pin: ProviderAcceptanceGenerationPinV1;
      }> | false>;
}

interface BrokerLeaseV1 {
  readonly lost: Promise<void>;
  held(): boolean;
  close(): Promise<void>;
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

async function ensureRootLeaseFileV1(path: string): Promise<void> {
  const parent = await lstat(dirname(path), { bigint: true });
  if (
    !parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== 0n ||
    (parent.mode & 0o777n) !== 0o700n
  ) throw new TypeError("strong mutation broker lease root is invalid");
  try {
    const metadata = await lstat(path, { bigint: true });
    if (
      !metadata.isFile() || metadata.isSymbolicLink() || metadata.uid !== 0n ||
      metadata.nlink !== 1n || (metadata.mode & 0o777n) !== 0o600n
    ) throw new TypeError("strong mutation broker lease is invalid");
    return;
  } catch (error) {
    if (
      !(typeof error === "object" && error !== null && "code" in error &&
        (error as { readonly code?: unknown }).code === "ENOENT")
    ) throw error;
  }
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
  await syncDirectoryV1(dirname(path));
}

async function acquireBrokerLeaseV1(
  path: string,
): Promise<BrokerLeaseV1> {
  await ensureRootLeaseFileV1(path);
  const handle = await open(
    path,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | O_CLOEXEC_V1,
  );
  try {
    const before = await handle.stat({ bigint: true });
    const projected = await lstat(path, { bigint: true });
    if (
      !before.isFile() || before.uid !== 0n || before.nlink !== 1n ||
      (before.mode & 0o777n) !== 0o600n || projected.isSymbolicLink() ||
      projected.dev !== before.dev || projected.ino !== before.ino
    ) throw new TypeError("strong mutation broker lease is invalid");
    const child = spawn(
      "/bin/sh",
      [
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
      !lostState && child.exitCode === null && child.signalCode === null;
    const endInput = (): void => {
      if (!child.stdin.destroyed && !child.stdin.writableEnded) child.stdin.end();
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
      throw new TypeError("strong mutation broker lease is unavailable");
    }
    return Object.freeze({
      lost,
      held,
      async close(): Promise<void> {
        // The flock process may have been signalled while its command still
        // inherits stdin and the locked descriptor. Always drive EOF so that
        // child exits too; the pre-registered promise cannot miss its close.
        endInput();
        await closed;
      },
    });
  } finally {
    await handle.close();
  }
}

async function socketIsLiveV1(path: string): Promise<boolean> {
  return new Promise<boolean>((resolvePromise, rejectPromise) => {
    const socket = createConnection(path);
    const timer = setTimeout(() => {
      socket.destroy();
      rejectPromise(new TypeError("strong mutation broker socket is indeterminate"));
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
  readonly #leasePath: string;
  readonly #expectedRuntimeUid: number;
  readonly #expectedRuntimeGid: number;
  readonly #session: ReturnType<
    typeof createProviderStrongMutationProductionSessionCallbacksInternalV1
  >;
  readonly #readCurrentFormalAcceptance:
    ProviderStrongMutationBrokerServerOptionsInternalV1["readCurrentFormalAcceptance"];
  readonly #connections = new Set<Socket>();
  readonly #active = new Set<Promise<void>>();
  #server: Server | undefined;
  #socketIdentity: { readonly dev: number; readonly ino: number } | undefined;
  #lease: BrokerLeaseV1 | undefined;
  #closePromise: Promise<void> | undefined;

  constructor(options: ProviderStrongMutationBrokerServerOptionsInternalV1) {
    const socketPath = resolve(options.socketPath);
    const leasePath = resolve(options.leasePath);
    if (
      process.platform !== "linux" ||
      !isAbsolute(options.socketPath) ||
      socketPath !== options.socketPath ||
      dirname(socketPath) === socketPath ||
      !isAbsolute(options.leasePath) || leasePath !== options.leasePath ||
      dirname(leasePath) === leasePath
    ) throw new TypeError("strong mutation broker server is unavailable");
    this.#socketPath = socketPath;
    this.#leasePath = leasePath;
    this.#expectedRuntimeUid = kernelIdV1(options.expectedRuntimeUid);
    this.#expectedRuntimeGid = kernelIdV1(options.expectedRuntimeGid);
    if (
      options.readCurrentFormalAcceptance !== undefined &&
      typeof options.readCurrentFormalAcceptance !== "function"
    ) throw new TypeError("strong mutation broker Acceptance reader is invalid");
    this.#readCurrentFormalAcceptance = options.readCurrentFormalAcceptance;
    this.#session =
      createProviderStrongMutationProductionSessionCallbacksInternalV1(
        options.broker,
      );
  }

  async start(): Promise<void> {
    if (this.#server !== undefined) {
      throw new TypeError("strong mutation broker server already started");
    }
    const lease = await acquireBrokerLeaseV1(this.#leasePath);
    this.#lease = lease;
    void lease.lost.then(() => {
      if (this.#lease !== lease) return;
      void this.close().catch(() => undefined);
    });
    try {
      const stale = await lstat(this.#socketPath);
      if (
        !stale.isSocket() || stale.isSymbolicLink() || stale.uid !== 0 ||
        stale.gid !== this.#expectedRuntimeGid ||
        (stale.mode & 0o777) !== 0o660 || await socketIsLiveV1(this.#socketPath)
      ) throw new TypeError("strong mutation broker socket already exists");
      const projected = await lstat(this.#socketPath);
      if (
        !projected.isSocket() || projected.isSymbolicLink() ||
        projected.dev !== stale.dev || projected.ino !== stale.ino ||
        projected.uid !== stale.uid || projected.gid !== stale.gid ||
        projected.mode !== stale.mode
      ) throw new TypeError("strong mutation broker socket changed during reclaim");
      await unlink(this.#socketPath);
      await syncDirectoryV1(dirname(this.#socketPath));
    } catch (error) {
      if (
        !(typeof error === "object" && error !== null && "code" in error &&
          (error as { readonly code?: unknown }).code === "ENOENT")
      ) {
        await this.close().catch(() => undefined);
        throw error;
      }
    }
    if (this.#lease !== lease || !lease.held()) {
      await this.close().catch(() => undefined);
      throw new TypeError("strong mutation broker lease is unavailable");
    }
    const server = createServer((socket) => {
      if (this.#lease !== lease || !lease.held()) {
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
        metadata.dev !== created.dev || metadata.ino !== created.ino ||
        metadata.uid !==
          (typeof process.geteuid === "function"
            ? process.geteuid()
            : process.getuid!()) ||
        metadata.gid !== this.#expectedRuntimeGid ||
        (metadata.mode & 0o777) !== 0o660 ||
        this.#lease !== lease || !lease.held()
      ) {
        throw new TypeError("strong mutation broker socket is invalid");
      }
    } catch (error) {
      await this.close().catch(() => undefined);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.#closePromise !== undefined) return this.#closePromise;
    const closing = this.#closeOnceV1();
    this.#closePromise = closing;
    try {
      await closing;
    } finally {
      if (this.#closePromise === closing) this.#closePromise = undefined;
    }
  }

  async #closeOnceV1(): Promise<void> {
    const errors: unknown[] = [];
    const server = this.#server;
    this.#server = undefined;
    const closed = server === undefined || !server.listening
      ? Promise.resolve()
      : new Promise<void>((resolvePromise, rejectPromise) => {
        server.close((error) => error === undefined
          ? resolvePromise()
          : rejectPromise(error));
      });
    for (const connection of this.#connections) connection.destroy();
    await Promise.allSettled([...this.#active]);
    try {
      await closed;
    } catch (error) {
      errors.push(error);
    }
    const identity = this.#socketIdentity;
    this.#socketIdentity = undefined;
    if (identity !== undefined) {
      try {
        const metadata = await lstat(this.#socketPath);
        if (
          metadata.isSocket() &&
          metadata.dev === identity.dev &&
          metadata.ino === identity.ino
        ) {
          await unlink(this.#socketPath);
          await syncDirectoryV1(dirname(this.#socketPath));
        }
      } catch (error) {
        if (
          !(typeof error === "object" && error !== null && "code" in error &&
            (error as { readonly code?: unknown }).code === "ENOENT")
        ) errors.push(error);
      }
    }
    const lease = this.#lease;
    this.#lease = undefined;
    try {
      await lease?.close();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw new AggregateError(
        errors,
        "strong mutation broker resource close failed",
      );
    }
  }

  async #serve(socket: Socket): Promise<void> {
    socket.setTimeout(BROKER_TIMEOUT_MS_V1, () => socket.destroy());
    try {
      if (this.#lease?.held() !== true) return;
      const peer = readProviderRuntimeNativeKernelPeerCredentialsV1(socket);
      if (
        peer.uid !== this.#expectedRuntimeUid ||
        peer.gid !== this.#expectedRuntimeGid ||
        !Number.isSafeInteger(peer.pid) ||
        peer.pid < 1
      ) return;
      const first = recordV1(await readFrameV1(socket));
      if (
        this.#lease?.held() !== true ||
        first?.profile !== BROKER_WIRE_PROFILE_V1
      ) return;
      if (first.kind === "read_current_formal_acceptance") {
        const current = await this.#readCurrentFormalAcceptance?.();
        if (this.#lease?.held() !== true) return;
        await writeFrameV1(socket, {
          profile: BROKER_WIRE_PROFILE_V1,
          kind: "read_current_formal_acceptance_result",
          ...(current === undefined || current === false
            ? { available: false }
            : {
                available: true,
                envelope: current.envelope,
                pin: current.pin,
              }),
        });
        return;
      }
      if (first.kind === "inspect_legacy_outcome_authority") {
        const authority = await this.#session.inspectLegacyOutcomeAuthority(
          first.inspection as Parameters<
            ProviderStrongMutationProductionSessionCallbacksInternalV1[
              "inspectLegacyOutcomeAuthority"
            ]
          >[0],
        );
        if (this.#lease?.held() !== true) return;
        await writeFrameV1(socket, {
          profile: BROKER_WIRE_PROFILE_V1,
          kind: "inspect_legacy_outcome_authority_result",
          ...(authority === false
            ? { approved: false }
            : { approved: true, authority }),
        });
        return;
      }
      if (first.kind === "resolve") {
        const resolved = await this.#session.resolveGrant(
          first.resolution as
            ProviderStrongMutationProductionGrantResolutionInternalV1,
        );
        if (this.#lease?.held() !== true) return;
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
      if (this.#lease?.held() !== true) return;
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
        this.#lease?.held() === true &&
        await decision.activateExecutionAuthorization() &&
        this.#lease?.held() === true;
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
