import { createConnection, type Socket } from "node:net";
import { isAbsolute, resolve } from "node:path";
import { TextDecoder } from "node:util";

import {
  readProviderRuntimeNativeKernelPeerCredentialsV1,
  type ProviderRuntimeNativeKernelPeerCredentialsV1,
} from "@understand-code/native-kernel-bridge";

import type { ProviderProductionStrongAuthorityStep16ExpectedOperationInternalV1 } from "./provider-production-strong-authority-service.js";
import type { Step16HostCallWitnessConnectionInternalV1 } from "./step16-host-call-witness-server-internal.js";
import {
  STEP16_HOST_CALL_WITNESS_UDS_LIMITS_INTERNAL_V1 as LIMITS,
  STEP16_HOST_CALL_WITNESS_UDS_PROFILE_INTERNAL_V1 as PROFILE,
} from "./step16-host-call-witness-uds-internal.js";

type ObservedOperation = ProviderProductionStrongAuthorityStep16ExpectedOperationInternalV1;
type CompletedCall = Awaited<ReturnType<Step16HostCallWitnessConnectionInternalV1["complete"]>>;

export interface ConnectStep16HostCallWitnessClientInternalV1Options {
  readonly socketPath: string;
  readonly expectedAuthorityPid: number;
  readonly runNonce: string;
  readonly closingPlanDigest: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export interface Step16HostCallWitnessClientInternalV1 {
  arm(callOrdinal: number, sessionIdDigest: string, callIdDigest: string, signal?: AbortSignal): Promise<string>;
  armDerived(callOrdinal: number, sessionIdDigest: string, callIdDigest: string, argumentsDigest: string, signal?: AbortSignal): Promise<string>;
  observe(token: string, operation: ObservedOperation, signal?: AbortSignal): Promise<void>;
  complete(token: string, sessionIdDigest: string, callIdDigest: string, signal?: AbortSignal): Promise<CompletedCall>;
  abort(token: string, signal?: AbortSignal): Promise<void>;
  /** Transport-validated only: the caller must apply the formal receipt schema. */
  finalize(signal?: AbortSignal): Promise<unknown>;
  close(): Promise<void>;
}

/** Non-index seam for real UDS tests; production always uses the native reader. */
export interface Step16HostCallWitnessClientDependenciesInternalV1 {
  readonly readPeerCredentials: (socket: Socket) => ProviderRuntimeNativeKernelPeerCredentialsV1;
}

export class Step16HostCallWitnessClientErrorInternalV1 extends Error {
  readonly code = "witness_transport_rejected" as const;

  constructor() {
    super("step16 witness client transport unavailable");
    this.name = "Step16HostCallWitnessClientErrorInternalV1";
  }
}

interface CompiledOptions extends ConnectStep16HostCallWitnessClientInternalV1Options {
  readonly timeoutMs: number;
}

interface PendingResponse {
  readonly sequence: number;
  readonly terminal: boolean;
  readonly finalized: boolean;
  readonly parse: (value: unknown) => unknown;
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  received: boolean;
  result?: unknown;
}

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const TOKEN = /^step16-window-v1:[0-9a-f]{64}$/u;

function failure(): Step16HostCallWitnessClientErrorInternalV1 {
  return new Step16HostCallWitnessClientErrorInternalV1();
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw failure();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw failure();
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some((key) => typeof key !== "string" || !keys.includes(key))) throw failure();
  const result = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) throw failure();
    result[key] = descriptor.value;
  }
  return result;
}

function positiveInteger(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= maximum;
}

function digest(value: unknown): string {
  if (typeof value !== "string" || !DIGEST.test(value)) throw failure();
  return value;
}

function compileOptions(value: ConnectStep16HostCallWitnessClientInternalV1Options): CompiledOptions {
  const input = exactRecord(value, [
    "socketPath", "expectedAuthorityPid", "runNonce", "closingPlanDigest",
    ...(Object.hasOwn(value, "timeoutMs") ? ["timeoutMs"] : []),
    ...(Object.hasOwn(value, "signal") ? ["signal"] : []),
  ]);
  const timeoutMs = input.timeoutMs ?? LIMITS.defaultTimeoutMs;
  if (
    typeof input.socketPath !== "string" || input.socketPath.includes("\0") ||
    Buffer.byteLength(input.socketPath, "utf8") > 4096 || !isAbsolute(input.socketPath) || resolve(input.socketPath) !== input.socketPath ||
    !positiveInteger(input.expectedAuthorityPid, 0x7fff_ffff) ||
    typeof input.runNonce !== "string" || !/^[0-9a-f]{64}$/u.test(input.runNonce) ||
    !positiveInteger(timeoutMs, LIMITS.maxTimeoutMs) ||
    (input.signal !== undefined && !(input.signal instanceof AbortSignal))
  ) throw failure();
  return Object.freeze({
    socketPath: input.socketPath,
    expectedAuthorityPid: input.expectedAuthorityPid,
    runNonce: input.runNonce,
    closingPlanDigest: digest(input.closingPlanDigest),
    timeoutMs,
    ...(input.signal === undefined ? {} : { signal: input.signal as AbortSignal }),
  });
}

function parseOperation(value: ObservedOperation): ObservedOperation {
  const input = exactRecord(value, ["operation", "operationNonce", "requestDigest"]);
  if (
    (input.operation !== "write_object" && input.operation !== "compare_commit") ||
    typeof input.operationNonce !== "string" || !/^[0-9a-f]{32}$/u.test(input.operationNonce)
  ) throw failure();
  return Object.freeze({ operation: input.operation, operationNonce: input.operationNonce, requestDigest: digest(input.requestDigest) });
}

class WitnessClient implements Step16HostCallWitnessClientInternalV1 {
  readonly #options: CompiledOptions;
  readonly #socket: Socket;
  readonly #signals = new Map<AbortSignal, () => void>();
  #error: Step16HostCallWitnessClientErrorInternalV1 | undefined;
  #pending: PendingResponse | undefined;
  #rejectConnect: ((error: Error) => void) | undefined;
  #buffered = Buffer.alloc(0);
  #responseBytes = 0;
  #requestBytes = 0;
  #sequence = 0;
  #inFlight = false;
  #ended = false;
  #window: Readonly<{ token: string; sessionIdDigest: string; callIdDigest: string }> | undefined;
  #operationOrdinal = 0;
  #nextCallOrdinal = 1;
  readonly #seenTokens = new Set<string>();

  constructor(options: CompiledOptions) {
    this.#options = options;
    if (options.signal?.aborted) throw failure();
    this.#socket = createConnection({ path: options.socketPath });
    this.#socket.on("data", (chunk: Buffer) => this.#read(chunk));
    this.#socket.on("error", () => this.#fail());
    this.#socket.once("end", () => {
      const pending = this.#pending;
      if (pending === undefined || !pending.terminal || !pending.received || this.#buffered.length !== 0) {
        this.#fail();
        return;
      }
      this.#ended = true;
      this.#pending = undefined;
      this.#unlinkSignals();
      pending.resolve(pending.result);
      this.#socket.destroy();
    });
    this.#socket.once("close", () => { if (!this.#ended) this.#fail(); });
    this.#linkSignal(options.signal);
  }

  async start(readPeerCredentials: Step16HostCallWitnessClientDependenciesInternalV1["readPeerCredentials"]): Promise<void> {
    const timer = setTimeout(() => this.#fail(), this.#options.timeoutMs);
    try {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        this.#rejectConnect = rejectPromise;
        this.#socket.once("connect", () => {
          try {
            this.#live();
            const peer = readPeerCredentials(this.#socket);
            if (peer.uid !== 0 || peer.gid !== 0 || peer.pid !== this.#options.expectedAuthorityPid) throw failure();
            resolvePromise();
          } catch { this.#fail(); }
        });
        if (this.#error !== undefined) rejectPromise(this.#error);
      });
    } finally {
      clearTimeout(timer);
      this.#rejectConnect = undefined;
    }
    await this.#request("hello", {
      runNonce: this.#options.runNonce, closingPlanDigest: this.#options.closingPlanDigest,
    }, (value) => {
      if (exactRecord(value, ["status"]).status !== "ready") throw failure();
    });
  }

  #live(): void {
    if (this.#error !== undefined || this.#ended || this.#socket.destroyed) throw this.#error ?? failure();
  }

  #unlinkSignals(): void {
    for (const [signal, listener] of this.#signals) signal.removeEventListener("abort", listener);
    this.#signals.clear();
  }

  #linkSignal(signal: AbortSignal | undefined): void {
    if (signal === undefined) return;
    if (!(signal instanceof AbortSignal)) throw failure();
    if (signal.aborted) { this.#fail(); throw failure(); }
    if (!this.#signals.has(signal)) {
      const listener = (): void => this.#fail();
      this.#signals.set(signal, listener);
      signal.addEventListener("abort", listener, { once: true });
    }
    if (signal.aborted) { this.#fail(); throw failure(); }
  }

  #fail(): void {
    this.#error ??= failure();
    this.#rejectConnect?.(this.#error);
    this.#pending?.reject(this.#error);
    this.#pending = undefined;
    this.#buffered = Buffer.alloc(0);
    this.#unlinkSignals();
    this.#socket.destroy();
  }

  #read(chunk: Buffer): void {
    try {
      this.#live();
      const pending = this.#pending;
      if (pending === undefined || pending.received) throw failure();
      const maximum = pending.finalized ? LIMITS.maxResponseBytes : LIMITS.maxFrameBytes;
      this.#responseBytes += chunk.length;
      if (this.#responseBytes > LIMITS.maxResponseBytes || this.#buffered.length + chunk.length > maximum) throw failure();
      this.#buffered = Buffer.concat([this.#buffered, chunk]);
      const newline = this.#buffered.indexOf(0x0a);
      if (newline < 0) return;
      if (newline !== this.#buffered.length - 1) throw failure();
      const source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(this.#buffered.subarray(0, -1));
      if (source.includes("\r")) throw failure();
      const parsed: unknown = JSON.parse(source);
      // Matches the server's JSON.stringify framing and rejects duplicate keys.
      if (JSON.stringify(parsed) !== source) throw failure();
      const response = exactRecord(parsed, ["profile", "sequence", "status", "result"]);
      if (
        response.profile !== PROFILE || response.sequence !== pending.sequence ||
        response.status !== (pending.finalized ? "finalized" : "ok")
      ) throw failure();
      const result = pending.parse(response.result);
      this.#buffered = Buffer.alloc(0);
      if (pending.terminal) {
        pending.received = true;
        pending.result = result;
      } else {
        this.#pending = undefined;
        pending.resolve(result);
      }
    } catch { this.#fail(); }
  }

  async #request<T>(
    kind: string,
    fields: Readonly<Record<string, unknown>>,
    parse: (value: unknown) => T,
    signal?: AbortSignal,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      this.#live();
      if (this.#inFlight) throw failure();
      this.#inFlight = true;
      // Linked signals remain session-wide: a later Host abort invalidates an
      // already-ACKed arm as well as any currently pending request.
      this.#linkSignal(signal);
      const sequence = ++this.#sequence;
      const bytes = Buffer.from(`${JSON.stringify({ profile: PROFILE, kind, sequence, ...fields })}\n`, "utf8");
      this.#requestBytes += bytes.length;
      if (sequence > LIMITS.maxFrames || bytes.length > LIMITS.maxFrameBytes || this.#requestBytes > LIMITS.maxConnectionBytes) throw failure();
      const result = await new Promise<unknown>((resolvePromise, rejectPromise) => {
        this.#pending = {
          sequence, terminal: kind === "finalize" || kind === "abort", finalized: kind === "finalize",
          parse, resolve: resolvePromise, reject: rejectPromise, received: false,
        };
        timer = setTimeout(() => this.#fail(), this.#options.timeoutMs);
        this.#socket.write(bytes, (error) => { if (error != null) this.#fail(); });
      });
      if (this.#error !== undefined) throw this.#error;
      return result as T;
    } catch {
      this.#fail();
      throw this.#error;
    } finally {
      clearTimeout(timer);
      this.#inFlight = false;
    }
  }

  async arm(callOrdinal: number, sessionIdDigest: string, callIdDigest: string, signal?: AbortSignal): Promise<string> {
    return this.#arm(callOrdinal, sessionIdDigest, callIdDigest, undefined, signal);
  }

  async armDerived(callOrdinal: number, sessionIdDigest: string, callIdDigest: string, argumentsDigest: string, signal?: AbortSignal): Promise<string> {
    return this.#arm(callOrdinal, sessionIdDigest, callIdDigest, argumentsDigest, signal);
  }

  async #arm(callOrdinal: number, sessionIdDigest: string, callIdDigest: string, argumentsDigest: string | undefined, signal?: AbortSignal): Promise<string> {
    try {
      if (this.#window !== undefined || callOrdinal !== this.#nextCallOrdinal) throw failure();
      const session = digest(sessionIdDigest);
      const call = digest(callIdDigest);
      const derived = argumentsDigest === undefined ? {} : { argumentsDigest: digest(argumentsDigest) };
      const token = await this.#request(argumentsDigest === undefined ? "arm" : "arm_derived", { callOrdinal, sessionIdDigest: session, callIdDigest: call, ...derived }, (value) => {
        if (typeof value !== "string" || !TOKEN.test(value) || this.#seenTokens.has(value)) throw failure();
        return value;
      }, signal);
      this.#seenTokens.add(token);
      this.#window = Object.freeze({ token, sessionIdDigest: session, callIdDigest: call });
      this.#operationOrdinal = 0;
      this.#nextCallOrdinal += 1;
      return token;
    } catch { this.#fail(); throw this.#error; }
  }

  #requireWindow(token: string): void {
    if (this.#window === undefined || token !== this.#window.token) throw failure();
  }

  async observe(token: string, operation: ObservedOperation, signal?: AbortSignal): Promise<void> {
    try {
      this.#requireWindow(token);
      const observed = parseOperation(operation);
      const ordinal = this.#operationOrdinal + 1;
      if (ordinal > 4096) throw failure();
      await this.#request("observe_provider_operation", { token, ...observed }, (value) => {
        const result = exactRecord(value, ["status", "operationOrdinal"]);
        if (result.status !== "observed" || result.operationOrdinal !== ordinal) throw failure();
      }, signal);
      this.#operationOrdinal = ordinal;
    } catch { this.#fail(); throw this.#error; }
  }

  async complete(token: string, sessionIdDigest: string, callIdDigest: string, signal?: AbortSignal): Promise<CompletedCall> {
    try {
      this.#requireWindow(token);
      if (sessionIdDigest !== this.#window?.sessionIdDigest || callIdDigest !== this.#window.callIdDigest || this.#operationOrdinal < 1) throw failure();
      const result = await this.#request("complete", { token, sessionIdDigest, callIdDigest }, (value) => {
        const result = exactRecord(value, ["status", "receiptBundleDigests"]);
        if (result.status !== "completed" || !Array.isArray(result.receiptBundleDigests) || result.receiptBundleDigests.length !== this.#operationOrdinal) throw failure();
        const digests = result.receiptBundleDigests.map(digest);
        if (new Set(digests).size !== digests.length) throw failure();
        return Object.freeze({ status: "completed" as const, receiptBundleDigests: Object.freeze(digests) });
      }, signal);
      this.#window = undefined;
      return result;
    } catch { this.#fail(); throw this.#error; }
  }

  async abort(token: string, signal?: AbortSignal): Promise<void> {
    try {
      this.#requireWindow(token);
      await this.#request("abort", { token }, (value) => {
        if (exactRecord(value, ["status"]).status !== "aborted") throw failure();
      }, signal);
      this.#window = undefined;
    } catch { this.#fail(); throw this.#error; }
  }

  async finalize(signal?: AbortSignal): Promise<unknown> {
    try {
      if (this.#window !== undefined) throw failure();
      return await this.#request("finalize", {}, (value) => value, signal);
    } catch { this.#fail(); throw this.#error; }
  }

  close(): Promise<void> {
    if (!this.#ended) this.#fail();
    else this.#socket.destroy();
    return Promise.resolve();
  }
}

export async function connectStep16HostCallWitnessClientCoreInternalV1(
  options: ConnectStep16HostCallWitnessClientInternalV1Options,
  dependencies: Step16HostCallWitnessClientDependenciesInternalV1,
): Promise<Step16HostCallWitnessClientInternalV1> {
  let client: WitnessClient | undefined;
  try {
    const input = compileOptions(options);
    const dependency = exactRecord(dependencies, ["readPeerCredentials"]);
    if (typeof dependency.readPeerCredentials !== "function") throw failure();
    client = new WitnessClient(input);
    await client.start(dependency.readPeerCredentials as Step16HostCallWitnessClientDependenciesInternalV1["readPeerCredentials"]);
    return client;
  } catch {
    await client?.close();
    throw failure();
  }
}

export async function connectStep16HostCallWitnessClientInternalV1(
  options: ConnectStep16HostCallWitnessClientInternalV1Options,
): Promise<Step16HostCallWitnessClientInternalV1> {
  if (process.platform !== "linux" || process.geteuid?.() !== 0 || process.getegid?.() !== 0) throw failure();
  return connectStep16HostCallWitnessClientCoreInternalV1(options, {
    readPeerCredentials: readProviderRuntimeNativeKernelPeerCredentialsV1,
  });
}
