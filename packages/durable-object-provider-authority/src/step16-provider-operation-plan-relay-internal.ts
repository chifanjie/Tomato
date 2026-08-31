import {
  chmodSync,
  chownSync,
  closeSync,
  constants as fsConstants,
  fsyncSync,
  lstatSync,
  openSync,
  realpathSync,
  type Stats,
  unlinkSync,
} from "node:fs";
import { createServer, type Server, type Socket } from "node:net";
import { dirname, isAbsolute, resolve } from "node:path";
import { TextDecoder } from "node:util";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  readProviderRuntimeNativeKernelPeerCredentialsV1,
  type ProviderRuntimeNativeKernelPeerCredentialsV1,
} from "@understand-code/native-kernel-bridge";

export const STEP16_PROVIDER_OPERATION_PLAN_RELAY_PROFILE_INTERNAL_V1 =
  "step16_provider_operation_plan_v1" as const;

export const STEP16_PROVIDER_OPERATION_PLAN_RELAY_LIMITS_INTERNAL_V1 =
  Object.freeze({ maxFrameBytes: 16 * 1024, defaultTimeoutMs: 5000, maxTimeoutMs: 60_000 });

export interface Step16ProviderOperationPlanObservedInternalV1 {
  readonly operation: "write_object" | "compare_commit";
  readonly operationNonce: string;
  readonly requestDigest: string;
}

export interface StartStep16ProviderOperationPlanRelayInternalV1Options {
  readonly socketPath: string;
  readonly expectedGatewayPeer: ProviderRuntimeNativeKernelPeerCredentialsV1;
  readonly runNonce: string;
  readonly closingPlanDigest: string;
  /** Must stop any not-yet-applied work when signal aborts; late settlement is ignored. */
  readonly observeProviderOperation: (
    observed: Step16ProviderOperationPlanObservedInternalV1,
    context: Readonly<{ readonly operationSequence: number; readonly signal: AbortSignal }>,
  ) => Promise<void>;
  readonly timeoutMs?: number;
}

export interface Step16ProviderOperationPlanRelayInternalV1 {
  readonly profile: typeof STEP16_PROVIDER_OPERATION_PLAN_RELAY_PROFILE_INTERNAL_V1;
  readonly socketPath: string;
  /** Cancels observations and drains transport work without awaiting a hung callback. */
  close(): Promise<void>;
}

/** Non-index test seam. Production always uses root and the native kernel reader. */
export interface Step16ProviderOperationPlanRelayDependenciesInternalV1 {
  readonly filesystemOwnerUid: number;
  readonly readPeerCredentials: (
    socket: Socket,
  ) => ProviderRuntimeNativeKernelPeerCredentialsV1;
}

export class Step16ProviderOperationPlanRelayErrorInternalV1 extends Error {
  readonly code = "operation_plan_rejected" as const;

  constructor() {
    super("step16 provider operation plan relay unavailable");
    this.name = "Step16ProviderOperationPlanRelayErrorInternalV1";
  }
}

interface CompiledOptions extends StartStep16ProviderOperationPlanRelayInternalV1Options {
  readonly timeoutMs: number;
}

interface FileIdentity {
  readonly dev: number;
  readonly ino: number;
}

interface ActiveOperation {
  readonly socket: Socket;
  readonly controller: AbortController;
  acknowledged: boolean;
}

const PROFILE = STEP16_PROVIDER_OPERATION_PLAN_RELAY_PROFILE_INTERNAL_V1;
const LIMITS = STEP16_PROVIDER_OPERATION_PLAN_RELAY_LIMITS_INTERNAL_V1;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;

function failure(): Step16ProviderOperationPlanRelayErrorInternalV1 {
  return new Step16ProviderOperationPlanRelayErrorInternalV1();
}

function exactRecord(value: unknown, required: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw failure();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw failure();
  const keys = Reflect.ownKeys(value);
  if (keys.length !== required.length || keys.some((key) =>
    typeof key !== "string" || !required.includes(key))) throw failure();
  const result = Object.create(null) as Record<string, unknown>;
  for (const key of required) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) throw failure();
    result[key] = descriptor.value;
  }
  return result;
}

function positiveInteger(value: unknown, maximum = 0x7fff_ffff): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= maximum;
}

function compileOptions(value: StartStep16ProviderOperationPlanRelayInternalV1Options): CompiledOptions {
  try {
    const input = exactRecord(value, [
      "socketPath", "expectedGatewayPeer", "runNonce", "closingPlanDigest", "observeProviderOperation",
      ...(Object.hasOwn(value, "timeoutMs") ? ["timeoutMs"] : []),
    ]);
    const peer = exactRecord(input.expectedGatewayPeer, ["uid", "gid", "pid"]);
    const timeoutMs = input.timeoutMs ?? LIMITS.defaultTimeoutMs;
    if (
      typeof input.socketPath !== "string" || input.socketPath.includes("\0") ||
      Buffer.byteLength(input.socketPath, "utf8") > 4096 || !isAbsolute(input.socketPath) ||
      resolve(input.socketPath) !== input.socketPath || dirname(input.socketPath) === input.socketPath ||
      !positiveInteger(peer.uid) || !positiveInteger(peer.gid) || !positiveInteger(peer.pid) ||
      typeof input.runNonce !== "string" || !/^[0-9a-f]{64}$/u.test(input.runNonce) ||
      typeof input.closingPlanDigest !== "string" || !DIGEST.test(input.closingPlanDigest) ||
      typeof input.observeProviderOperation !== "function" || !positiveInteger(timeoutMs, LIMITS.maxTimeoutMs)
    ) throw failure();
    return Object.freeze({
      socketPath: input.socketPath,
      expectedGatewayPeer: Object.freeze({ uid: peer.uid, gid: peer.gid, pid: peer.pid }),
      runNonce: input.runNonce,
      closingPlanDigest: input.closingPlanDigest,
      observeProviderOperation: input.observeProviderOperation as CompiledOptions["observeProviderOperation"],
      timeoutMs,
    });
  } catch {
    throw failure();
  }
}

function identity(stats: Stats): FileIdentity {
  return Object.freeze({ dev: stats.dev, ino: stats.ino });
}

function requireOwnedPath(
  path: string,
  kind: "parent" | "socket",
  ownerUid: number,
  ownerGid: number,
  expected?: FileIdentity,
): FileIdentity {
  const stats = lstatSync(path);
  if (
    stats.isSymbolicLink() || (kind === "parent" ? !stats.isDirectory() : !stats.isSocket()) ||
    stats.uid !== ownerUid || stats.gid !== ownerGid ||
    (stats.mode & 0o7777) !== (kind === "parent" ? 0o710 : 0o620) ||
    (expected !== undefined && (stats.dev !== expected.dev || stats.ino !== expected.ino))
  ) throw failure();
  return identity(stats);
}

function requireMissingSocket(path: string): void {
  try {
    lstatSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw failure();
  }
  throw failure();
}

function syncDirectory(path: string): void {
  const descriptor = openSync(path, fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW);
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function requireRootAncestors(parent: string): void {
  if (realpathSync(parent) !== parent) throw failure();
  for (let current = dirname(parent); ; current = dirname(current)) {
    const stats = lstatSync(current);
    if (!stats.isDirectory() || stats.isSymbolicLink() || stats.uid !== 0 || (stats.mode & 0o022) !== 0) {
      throw failure();
    }
    if (dirname(current) === current) break;
  }
}

function parseRequest(bytes: Buffer, options: CompiledOptions, nextSequence: number): Readonly<{
  operationSequence: number;
  observed: Step16ProviderOperationPlanObservedInternalV1;
}> {
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  if (!text.endsWith("\n") || text.includes("\r") || text.slice(0, -1).includes("\n")) throw failure();
  const source = text.slice(0, -1);
  const parsed: unknown = JSON.parse(source);
  // The client emits JCS. Requiring that exact representation also rejects duplicate keys.
  if (canonicalizeJcsSafeIntegerV1(parsed) !== source) throw failure();
  const request = exactRecord(parsed, ["profile", "runNonce", "closingPlanDigest", "operationSequence", "observed"]);
  const observed = exactRecord(request.observed, ["operation", "operationNonce", "requestDigest"]);
  if (
    request.profile !== PROFILE || request.runNonce !== options.runNonce ||
    request.closingPlanDigest !== options.closingPlanDigest ||
    !positiveInteger(request.operationSequence, Number.MAX_SAFE_INTEGER) || request.operationSequence !== nextSequence ||
    (observed.operation !== "write_object" && observed.operation !== "compare_commit") ||
    typeof observed.operationNonce !== "string" || !/^[0-9a-f]{32}$/u.test(observed.operationNonce) ||
    typeof observed.requestDigest !== "string" || !DIGEST.test(observed.requestDigest)
  ) throw failure();
  return Object.freeze({
    operationSequence: request.operationSequence,
    observed: Object.freeze({ operation: observed.operation, operationNonce: observed.operationNonce, requestDigest: observed.requestDigest }),
  });
}

function whileLive<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolvePromise, rejectPromise) => {
    const onAbort = (): void => rejectPromise(failure());
    signal.addEventListener("abort", onAbort, { once: true });
    // Both handlers stay attached after cancellation, including to a late rejection.
    void work.then((value) => {
      signal.removeEventListener("abort", onAbort);
      if (!signal.aborted) resolvePromise(value);
    }, () => {
      signal.removeEventListener("abort", onAbort);
      rejectPromise(failure());
    });
    if (signal.aborted) onAbort();
  });
}

class Relay implements Step16ProviderOperationPlanRelayInternalV1 {
  readonly profile = PROFILE;
  readonly socketPath: string;
  readonly #options: CompiledOptions;
  readonly #dependencies: Step16ProviderOperationPlanRelayDependenciesInternalV1;
  readonly #parentIdentity: FileIdentity;
  readonly #server: Server;
  readonly #tasks = new Set<Promise<void>>();
  #socketIdentity: FileIdentity | undefined;
  #active: ActiveOperation | undefined;
  #started = false;
  #closing = false;
  #nextSequence = 1;
  #terminalError: Step16ProviderOperationPlanRelayErrorInternalV1 | undefined;
  #closePromise: Promise<void> | undefined;

  constructor(options: CompiledOptions, dependencies: Step16ProviderOperationPlanRelayDependenciesInternalV1) {
    this.#options = options;
    this.#dependencies = dependencies;
    this.socketPath = options.socketPath;
    this.#parentIdentity = requireOwnedPath(dirname(this.socketPath), "parent", dependencies.filesystemOwnerUid, options.expectedGatewayPeer.gid);
    requireMissingSocket(this.socketPath);
    this.#server = createServer((socket) => this.#accept(socket));
    this.#server.on("error", () => { if (this.#started) this.#fail(); });
  }

  async start(): Promise<void> {
    try {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        const fail = (): void => rejectPromise(failure());
        this.#server.once("error", fail);
        this.#server.listen(this.socketPath, () => {
          this.#server.off("error", fail);
          resolvePromise();
        });
      });
      const stats = lstatSync(this.socketPath);
      if (!stats.isSocket() || stats.uid !== this.#dependencies.filesystemOwnerUid) throw failure();
      this.#socketIdentity = identity(stats);
      chownSync(this.socketPath, this.#dependencies.filesystemOwnerUid, this.#options.expectedGatewayPeer.gid);
      chmodSync(this.socketPath, 0o620);
      this.#attestPaths();
      syncDirectory(dirname(this.socketPath));
      this.#started = true;
    } catch {
      this.#fail();
      await this.close().catch(() => undefined);
      throw failure();
    }
  }

  #attestPaths(): void {
    const { filesystemOwnerUid } = this.#dependencies;
    const { gid } = this.#options.expectedGatewayPeer;
    requireOwnedPath(dirname(this.socketPath), "parent", filesystemOwnerUid, gid, this.#parentIdentity);
    requireOwnedPath(this.socketPath, "socket", filesystemOwnerUid, gid, this.#socketIdentity);
  }

  #fail(): void {
    this.#terminalError ??= failure();
    this.#active?.controller.abort();
    this.#active?.socket.destroy();
  }

  #accept(socket: Socket): void {
    socket.on("error", () => undefined);
    if (!this.#started || this.#closing || this.#terminalError !== undefined) { socket.destroy(); return; }
    try {
      const peer = this.#dependencies.readPeerCredentials(socket);
      const expected = this.#options.expectedGatewayPeer;
      if (peer.uid !== expected.uid || peer.gid !== expected.gid || peer.pid !== expected.pid) {
        socket.destroy();
        return;
      }
    } catch {
      socket.destroy();
      return;
    }
    try { this.#attestPaths(); } catch { this.#fail(); socket.destroy(); return; }
    if (this.#active !== undefined) { this.#fail(); socket.destroy(); return; }
    const active: ActiveOperation = { socket, controller: new AbortController(), acknowledged: false };
    this.#active = active;
    const task = this.#serve(active);
    this.#tasks.add(task);
    void task.finally(() => { this.#tasks.delete(task); if (this.#active === active) this.#active = undefined; });
  }

  async #serve(active: ActiveOperation): Promise<void> {
    const { socket, controller } = active;
    let buffered = Buffer.alloc(0);
    let received = false;
    let rejectRead: ((error: Error) => void) | undefined;
    const abort = (): void => { this.#fail(); rejectRead?.(failure()); };
    const onClose = (): void => { if (!active.acknowledged) abort(); };
    const onAbort = (): void => rejectRead?.(failure());
    const deadline = setTimeout(abort, this.#options.timeoutMs);
    socket.once("close", onClose);
    socket.once("end", onClose);
    controller.signal.addEventListener("abort", onAbort, { once: true });
    let onData: (chunk: Buffer) => void = () => undefined;
    try {
      const bytes = await new Promise<Buffer>((resolvePromise, rejectPromise) => {
        rejectRead = rejectPromise;
        onData = (value: Buffer): void => {
          const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
          if (received || buffered.length + chunk.length > LIMITS.maxFrameBytes) { abort(); return; }
          buffered = Buffer.concat([buffered, chunk]);
          const newline = buffered.indexOf(0x0a);
          if (newline < 0) return;
          if (newline !== buffered.length - 1) { abort(); return; }
          received = true;
          resolvePromise(buffered);
        };
        socket.on("data", onData);
        if (controller.signal.aborted || socket.destroyed) rejectPromise(failure());
      });
      const request = parseRequest(bytes, this.#options, this.#nextSequence);
      this.#nextSequence += 1;
      await whileLive(Promise.resolve().then(() => {
        if (controller.signal.aborted) throw failure();
        return this.#options.observeProviderOperation(request.observed, Object.freeze({
          operationSequence: request.operationSequence,
          signal: controller.signal,
        }));
      }), controller.signal);
      if (controller.signal.aborted || socket.destroyed || this.#closing || this.#terminalError !== undefined) throw failure();
      this.#attestPaths();
      const ack = `${canonicalizeJcsSafeIntegerV1({
        profile: PROFILE, status: "observed", runNonce: this.#options.runNonce,
        closingPlanDigest: this.#options.closingPlanDigest,
        operationSequence: request.operationSequence, requestDigest: request.observed.requestDigest,
      })}\n`;
      await whileLive(new Promise<void>((resolvePromise, rejectPromise) => {
        socket.end(ack, "utf8", () => {
          if (controller.signal.aborted || socket.destroyed || this.#closing) { rejectPromise(failure()); return; }
          active.acknowledged = true;
          resolvePromise();
        });
      }), controller.signal);
      socket.destroySoon();
    } catch {
      this.#fail();
    } finally {
      clearTimeout(deadline);
      controller.signal.removeEventListener("abort", onAbort);
      socket.off("data", onData);
      socket.off("close", onClose);
      socket.off("end", onClose);
      if (!active.acknowledged) socket.destroy();
    }
  }

  close(): Promise<void> {
    this.#closePromise ??= this.#closeOnce();
    return this.#closePromise;
  }

  async #closeOnce(): Promise<void> {
    this.#closing = true;
    const listenerClosing = new Promise<void>((resolvePromise) => {
      if (!this.#server.listening) { resolvePromise(); return; }
      this.#server.close(() => resolvePromise());
    });
    if (this.#active !== undefined) this.#fail();
    await Promise.all([...this.#tasks]);
    await listenerClosing;
    try {
      if (this.#socketIdentity !== undefined) {
        try {
          this.#attestPaths();
          unlinkSync(this.socketPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        syncDirectory(dirname(this.socketPath));
      }
    } catch { this.#terminalError ??= failure(); }
    if (this.#terminalError !== undefined) throw this.#terminalError;
  }
}

export async function startStep16ProviderOperationPlanRelayCoreInternalV1(
  options: StartStep16ProviderOperationPlanRelayInternalV1Options,
  dependencies: Step16ProviderOperationPlanRelayDependenciesInternalV1,
): Promise<Step16ProviderOperationPlanRelayInternalV1> {
  try {
    const parsedDependencies = exactRecord(dependencies, ["filesystemOwnerUid", "readPeerCredentials"]);
    if (
      typeof parsedDependencies.filesystemOwnerUid !== "number" ||
      !Number.isSafeInteger(parsedDependencies.filesystemOwnerUid) ||
      parsedDependencies.filesystemOwnerUid < 0 ||
      typeof parsedDependencies.readPeerCredentials !== "function"
    ) throw failure();
    const server = new Relay(compileOptions(options), Object.freeze({
      filesystemOwnerUid: parsedDependencies.filesystemOwnerUid,
      readPeerCredentials: parsedDependencies.readPeerCredentials as Step16ProviderOperationPlanRelayDependenciesInternalV1["readPeerCredentials"],
    }));
    await server.start();
    return server;
  } catch { throw failure(); }
}

export async function startStep16ProviderOperationPlanRelayInternalV1(
  options: StartStep16ProviderOperationPlanRelayInternalV1Options,
): Promise<Step16ProviderOperationPlanRelayInternalV1> {
  try {
    if (process.platform !== "linux" || process.geteuid?.() !== 0 || process.getegid?.() !== 0) throw failure();
    const compiled = compileOptions(options);
    requireRootAncestors(dirname(compiled.socketPath));
    return await startStep16ProviderOperationPlanRelayCoreInternalV1(compiled, {
      filesystemOwnerUid: 0,
      readPeerCredentials: readProviderRuntimeNativeKernelPeerCredentialsV1,
    });
  } catch { throw failure(); }
}
