import { createHash } from "node:crypto";

import {
  runStep16RealHostJsonlSessionWithSupervisorInternalV1,
  type RunStep16RealHostJsonlSessionV1Input,
  type Step16RealHostJsonlSessionResultV1,
} from "./real-host-executor.js";
import { canonicalRealHostJsonInternalV1 } from "./real-host-receipt-primitives-internal.js";
import {
  type RealHostReceiptHostV1,
  type Sha256DigestV1,
} from "./real-host-receipts.js";
import {
  createStep16RealHostStreamObserverInternalV1,
  type Step16RealHostCallCompleteInternalV1,
  type Step16RealHostCallStartInternalV1,
  type Step16RealHostObservedCallInternalV1,
} from "./step16-real-host-stream-observer-internal.js";

export interface Step16HostCallSupervisorPlanInternalV1 {
  readonly runNonce: string;
  readonly closingPlanDigest: string;
  readonly calls: readonly Readonly<{
    readonly callOrdinal: number;
    readonly eventOrdinal: number;
    readonly host: RealHostReceiptHostV1;
    readonly tool: string;
    readonly argumentsDigest: string;
  }>[];
}

export interface Step16HostCallSupervisorOperationInternalV1 {
  readonly operation: "write_object" | "compare_commit";
  readonly operationNonce: string;
  readonly requestDigest: string;
}

/** Structural private interface: no dependency on the authority package API. */
export interface Step16HostCallSupervisorWitnessClientInternalV1 {
  arm(callOrdinal: number, sessionIdDigest: string, callIdDigest: string, signal?: AbortSignal): Promise<string>;
  observe(token: string, operation: Step16HostCallSupervisorOperationInternalV1, signal?: AbortSignal): Promise<void>;
  complete(token: string, sessionIdDigest: string, callIdDigest: string, signal?: AbortSignal): Promise<Readonly<{ status: "completed"; receiptBundleDigests: readonly string[] }>>;
  finalize(signal?: AbortSignal): Promise<unknown>;
  close(): Promise<void>;
}

export interface CreateStep16HostCallSupervisorInternalV1Options {
  /** Must be the same root-pinned plan used to connect the witness client. */
  readonly closingPlan: Step16HostCallSupervisorPlanInternalV1;
  readonly witnessClient: Step16HostCallSupervisorWitnessClientInternalV1;
  readonly signal: AbortSignal;
  readonly operationWaitMs?: number;
}

export interface Step16HostCallSupervisorInternalV1 {
  readonly signal: AbortSignal;
  readonly onObservedCall: (event: Step16RealHostObservedCallInternalV1, signal: AbortSignal) => Promise<void>;
  readonly observeProviderOperation: (
    operation: Step16HostCallSupervisorOperationInternalV1,
    context: Readonly<{ readonly operationSequence: number; readonly signal: AbortSignal }>,
  ) => Promise<void>;
  run(input: RunStep16RealHostJsonlSessionV1Input, options: Readonly<{ readonly childIdentity: Readonly<{ readonly uid: number; readonly gid: number }> }>): Promise<Step16RealHostJsonlSessionResultV1>;
  /** Only internally awaited successful executor runs can authorize finalization. */
  finalize(): Promise<unknown>;
  close(): Promise<void>;
}

export class Step16HostCallSupervisionErrorInternalV1 extends Error {
  readonly code = "host_call_supervision_failed" as const;
  constructor() { super("step16 Host call supervision failed"); this.name = "Step16HostCallSupervisionErrorInternalV1"; }
}

type PlannedCall = Step16HostCallSupervisorPlanInternalV1["calls"][number];
interface Window {
  readonly plan: PlannedCall;
  readonly start: Step16RealHostCallStartInternalV1;
  readonly armed: Promise<string>;
  token?: string;
  operations: number;
  closing: boolean;
}
interface RunContext {
  readonly host: RealHostReceiptHostV1;
  readonly eventOffset: number;
  readonly endCursor: number;
  readonly calls: readonly PlannedCall[];
  readonly completed: Step16RealHostCallCompleteInternalV1[];
  sessionIdDigest?: Sha256DigestV1;
}

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const TOKEN = /^step16-window-v1:[0-9a-f]{64}$/u;
const PLAN_DOMAIN = "understand-code-step16-host-call-closing-plan-v1";

function failure(): Step16HostCallSupervisionErrorInternalV1 { return new Step16HostCallSupervisionErrorInternalV1(); }

function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
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

function positiveInteger(value: unknown, maximum = 4096): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= maximum;
}

function digest(value: unknown): Sha256DigestV1 {
  if (typeof value !== "string" || !DIGEST.test(value)) throw failure();
  return value as Sha256DigestV1;
}

function parsePlan(value: Step16HostCallSupervisorPlanInternalV1): Step16HostCallSupervisorPlanInternalV1 {
  const input = record(value, ["runNonce", "closingPlanDigest", "calls"]);
  if (typeof input.runNonce !== "string" || !/^[0-9a-f]{64}$/u.test(input.runNonce) || !Array.isArray(input.calls) || input.calls.length < 1 || input.calls.length > 256) throw failure();
  let previousOrdinal = 0;
  const calls = input.calls.map((value: unknown, index: number) => {
    const call = record(value, ["callOrdinal", "eventOrdinal", "host", "tool", "argumentsDigest"]);
    if (call.callOrdinal !== index + 1 || !positiveInteger(call.eventOrdinal, Number.MAX_SAFE_INTEGER) || call.eventOrdinal <= previousOrdinal || (call.host !== "codex" && call.host !== "claude") || typeof call.tool !== "string" || !/^[a-z][a-z0-9_]{0,127}$/u.test(call.tool)) throw failure();
    previousOrdinal = call.eventOrdinal;
    return Object.freeze({ callOrdinal: index + 1, eventOrdinal: call.eventOrdinal, host: call.host, tool: call.tool, argumentsDigest: digest(call.argumentsDigest) });
  });
  const closingPlanDigest = digest(input.closingPlanDigest);
  const canonical = canonicalRealHostJsonInternalV1([PLAN_DOMAIN, { runNonce: input.runNonce, calls }]);
  if (`sha256:${createHash("sha256").update(canonical).digest("hex")}` !== closingPlanDigest) throw failure();
  return Object.freeze({ runNonce: input.runNonce, closingPlanDigest, calls: Object.freeze(calls) });
}

function snapshotClient(value: Step16HostCallSupervisorWitnessClientInternalV1): Step16HostCallSupervisorWitnessClientInternalV1 {
  if (value === null || typeof value !== "object") throw failure();
  const methods: Record<string, unknown> = Object.create(null);
  for (const name of ["arm", "observe", "complete", "finalize", "close"] as const) {
    let current: object | null = value;
    let descriptor: PropertyDescriptor | undefined;
    while (current !== null && current !== Object.prototype) {
      descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor !== undefined) break;
      current = Object.getPrototypeOf(current) as object | null;
    }
    if (descriptor === undefined || !("value" in descriptor) || typeof descriptor.value !== "function") throw failure();
    methods[name] = descriptor.value.bind(value);
  }
  return Object.freeze(methods) as unknown as Step16HostCallSupervisorWitnessClientInternalV1;
}

function parseEvent(value: Step16RealHostObservedCallInternalV1): Step16RealHostObservedCallInternalV1 {
  const complete = Object.hasOwn(value, "success");
  const event = record(value, ["host", "sessionIdDigest", "callIdDigest", "ordinal", "tool", "argumentsDigest", ...(complete ? ["success", "resultDigest"] : [])]);
  if ((event.host !== "codex" && event.host !== "claude") || !positiveInteger(event.ordinal, 256) || typeof event.tool !== "string" || (complete && event.success !== true)) throw failure();
  const start: Step16RealHostCallStartInternalV1 = { host: event.host, sessionIdDigest: digest(event.sessionIdDigest), callIdDigest: digest(event.callIdDigest), ordinal: event.ordinal, tool: event.tool as Step16RealHostCallStartInternalV1["tool"], argumentsDigest: digest(event.argumentsDigest) };
  return Object.freeze(complete ? { ...start, success: true as const, resultDigest: digest(event.resultDigest) } : start);
}

class Supervisor implements Step16HostCallSupervisorInternalV1 {
  readonly #controller = new AbortController();
  readonly signal = this.#controller.signal;
  readonly #plan: Step16HostCallSupervisorPlanInternalV1;
  readonly #client: Step16HostCallSupervisorWitnessClientInternalV1;
  readonly #waitMs: number;
  readonly #linkedSignals = new Map<AbortSignal, () => void>();
  readonly #seenNonces = new Set<string>();
  readonly #seenCalls = new Set<string>();
  readonly #seenSessions = new Set<string>();
  #error: Step16HostCallSupervisionErrorInternalV1 | undefined;
  #context: RunContext | undefined;
  #window: Window | undefined;
  #cursor = 0;
  #eventOffset = 0;
  #verifiedCursor = 0;
  #nextOperationSequence = 1;
  #hostEventBusy = false;
  #operationBusy = false;
  #execution: Promise<unknown> | undefined;
  #clientClosing: Promise<void> | undefined;
  #finalizing = false;
  #finalized = false;
  #closePromise: Promise<void> | undefined;
  #resolveFirstStart: ((window: Window) => void) | undefined;
  readonly #firstStart = new Promise<Window>((resolvePromise) => { this.#resolveFirstStart = resolvePromise; });

  constructor(plan: Step16HostCallSupervisorPlanInternalV1, client: Step16HostCallSupervisorWitnessClientInternalV1, signal: AbortSignal, waitMs: number) {
    this.#plan = plan;
    this.#client = client;
    this.#waitMs = waitMs;
    this.#link(signal);
  }

  #live(): void { if (this.#error !== undefined || this.signal.aborted || this.#finalized) throw this.#error ?? failure(); }

  #link(signal: AbortSignal): void {
    if (!(signal instanceof AbortSignal) || signal.aborted) throw failure();
    if (signal === this.signal || this.#linkedSignals.has(signal)) return;
    const listener = (): void => this.#fail();
    this.#linkedSignals.set(signal, listener);
    signal.addEventListener("abort", listener, { once: true });
    if (signal.aborted) { this.#fail(); throw failure(); }
  }

  #unlink(): void {
    for (const [signal, listener] of this.#linkedSignals) signal.removeEventListener("abort", listener);
    this.#linkedSignals.clear();
  }

  #fail(): void {
    this.#error ??= failure();
    if (!this.signal.aborted) this.#controller.abort(this.#error);
    this.#unlink();
    this.#clientClosing ??= Promise.resolve().then(() => this.#client.close()).catch(() => undefined);
  }

  #wait<T>(work: Promise<T>, deadline = true): Promise<T> {
    return new Promise<T>((resolvePromise, rejectPromise) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const cleanup = (): void => { clearTimeout(timer); this.signal.removeEventListener("abort", onAbort); };
      const onAbort = (): void => { cleanup(); rejectPromise(this.#error ?? failure()); };
      this.signal.addEventListener("abort", onAbort, { once: true });
      if (deadline) timer = setTimeout(() => this.#fail(), this.#waitMs);
      // Keep handlers on detached late work, including a rejection after close.
      void work.then((value) => { cleanup(); if (this.signal.aborted) rejectPromise(this.#error ?? failure()); else resolvePromise(value); }, () => { cleanup(); this.#fail(); rejectPromise(this.#error); });
      if (this.signal.aborted) onAbort();
    });
  }

  readonly onObservedCall = async (value: Step16RealHostObservedCallInternalV1, signal: AbortSignal): Promise<void> => {
    try {
      this.#live();
      this.#link(signal);
      const context = this.#context;
      if (context === undefined || this.#hostEventBusy) throw failure();
      this.#hostEventBusy = true;
      const event = parseEvent(value);
      if (event.host !== context.host || (context.sessionIdDigest !== undefined && event.sessionIdDigest !== context.sessionIdDigest)) throw failure();
      context.sessionIdDigest ??= event.sessionIdDigest;
      const planned = context.calls.find((call) => call.eventOrdinal === context.eventOffset + event.ordinal);
      if (planned === undefined) {
        if (this.#window !== undefined) throw failure();
        return;
      }
      if (event.tool !== planned.tool || event.argumentsDigest !== planned.argumentsDigest || planned.callOrdinal !== this.#cursor + 1) throw failure();
      if (!Object.hasOwn(event, "success")) {
        const callKey = `${event.host}:${event.sessionIdDigest}:${event.callIdDigest}`;
        if (this.#window !== undefined || this.#seenCalls.has(callKey)) throw failure();
        this.#seenCalls.add(callKey);
        const armed = Promise.resolve().then(() => {
          this.#live();
          return this.#client.arm(planned.callOrdinal, event.sessionIdDigest, event.callIdDigest, this.signal);
        });
        const window: Window = { plan: planned, start: event, armed, operations: 0, closing: false };
        this.#window = window;
        if (planned.callOrdinal === 1) this.#resolveFirstStart?.(window);
        const token = await this.#wait(armed);
        if (!TOKEN.test(token) || this.#window !== window) throw failure();
        window.token = token;
      } else {
        const complete = event as Step16RealHostCallCompleteInternalV1;
        const window = this.#window;
        if (window === undefined || window.token === undefined || window.closing || this.#operationBusy || window.operations < 1 || complete.callIdDigest !== window.start.callIdDigest || complete.sessionIdDigest !== window.start.sessionIdDigest) throw failure();
        window.closing = true;
        const result = await this.#wait(this.#client.complete(window.token, complete.sessionIdDigest, complete.callIdDigest, this.signal));
        if (result.status !== "completed" || result.receiptBundleDigests.length !== window.operations || result.receiptBundleDigests.some((value) => !DIGEST.test(value)) || this.#window !== window) throw failure();
        context.completed.push(complete);
        this.#window = undefined;
        this.#cursor += 1;
      }
    } catch { this.#fail(); throw this.#error; }
    finally { this.#hostEventBusy = false; }
  };

  readonly observeProviderOperation = async (
    value: Step16HostCallSupervisorOperationInternalV1,
    context: Readonly<{ readonly operationSequence: number; readonly signal: AbortSignal }>,
  ): Promise<void> => {
    try {
      this.#live();
      const input = record(context, ["operationSequence", "signal"]);
      this.#link(input.signal as AbortSignal);
      if (this.#context === undefined || this.#operationBusy || input.operationSequence !== this.#nextOperationSequence) throw failure();
      this.#operationBusy = true;
      const operation = record(value, ["operation", "operationNonce", "requestDigest"]);
      if ((operation.operation !== "write_object" && operation.operation !== "compare_commit") || typeof operation.operationNonce !== "string" || !/^[0-9a-f]{32}$/u.test(operation.operationNonce) || this.#seenNonces.has(operation.operationNonce)) throw failure();
      const observed = Object.freeze({ operation: operation.operation, operationNonce: operation.operationNonce, requestDigest: digest(operation.requestDigest) });
      this.#seenNonces.add(observed.operationNonce);
      this.#nextOperationSequence += 1;
      let window = this.#window;
      if (window === undefined) {
        // Only the first call has no earlier generation to confuse with a late
        // operation. Never queue a between-calls operation into the next call.
        if (this.#cursor !== 0 || this.#seenCalls.size !== 0) throw failure();
        window = await this.#wait(this.#firstStart);
      }
      if (window.closing) throw failure();
      const captured = window;
      const token = await this.#wait(captured.armed);
      if (this.#window !== captured || captured.closing || captured.token !== token) throw failure();
      await this.#wait(this.#client.observe(token, observed, this.signal));
      if (this.#window !== captured || captured.closing) throw failure();
      captured.operations += 1;
    } catch { this.#fail(); throw this.#error; }
    finally { this.#operationBusy = false; }
  };

  async run(input: RunStep16RealHostJsonlSessionV1Input, options: Readonly<{ readonly childIdentity: Readonly<{ readonly uid: number; readonly gid: number }> }>): Promise<Step16RealHostJsonlSessionResultV1> {
    try {
      this.#live();
      if (this.#context !== undefined || this.#window !== undefined || this.#operationBusy || this.#finalizing) throw failure();
      const runOptions = record(options, ["childIdentity"]);
      const childIdentity = record(runOptions.childIdentity, ["uid", "gid"]);
      if (!positiveInteger(childIdentity.uid, 0x7fff_ffff) || !positiveInteger(childIdentity.gid, 0x7fff_ffff)) throw failure();
      const eventCount = input.expectedEventPlan.events.length;
      const endOffset = this.#eventOffset + eventCount;
      if (!positiveInteger(eventCount, 256) || !Number.isSafeInteger(endOffset)) throw failure();
      let endCursor = this.#cursor;
      while (endCursor < this.#plan.calls.length && this.#plan.calls[endCursor]!.eventOrdinal <= endOffset) endCursor += 1;
      const calls = this.#plan.calls.slice(this.#cursor, endCursor);
      for (const call of calls) {
        const expected = input.expectedEventPlan.events.find((event) => event.ordinal === call.eventOrdinal - this.#eventOffset);
        if (call.eventOrdinal <= this.#eventOffset || call.host !== input.host || expected?.kind !== "mcp_tool_call" || expected.server !== "understand-code" || expected.tool !== call.tool) throw failure();
      }
      const context: RunContext = { host: input.host, eventOffset: this.#eventOffset, endCursor, calls, completed: [] };
      this.#context = context;
      const executionOptions = {
        childIdentity: Object.freeze({ uid: childIdentity.uid, gid: childIdentity.gid }),
        signal: this.signal,
        streamObserver: createStep16RealHostStreamObserverInternalV1(input.host, input.expectedEventPlan),
        onObservedCall: this.onObservedCall,
      };
      const execution = runStep16RealHostJsonlSessionWithSupervisorInternalV1(input, executionOptions);
      this.#execution = execution;
      const result = await this.#wait(execution, false);
      if (context.sessionIdDigest === undefined && context.calls.length === 0) context.sessionIdDigest = digest(result.receipt.sessionIdDigest);
      if (result.exit.code !== 0 || result.exit.signal !== null || result.receipt.schemaVersion !== 1 || result.receipt.host !== context.host || result.receipt.sessionIdDigest !== context.sessionIdDigest || this.#window !== undefined || this.#operationBusy || this.#cursor !== context.endCursor || context.completed.length !== context.calls.length) throw failure();
      for (const complete of context.completed) {
        const receipt = result.receipt.events.find((event) => event.ordinal === complete.ordinal);
        if (receipt?.kind !== "mcp_tool_call" || receipt.server !== "understand-code" || receipt.tool !== complete.tool || receipt.callIdDigest !== complete.callIdDigest || receipt.argumentsDigest !== complete.argumentsDigest || receipt.resultDigest !== complete.resultDigest || receipt.success !== true) throw failure();
      }
      const sessionKey = `${context.host}:${context.sessionIdDigest}`;
      if (this.#seenSessions.has(sessionKey)) throw failure();
      this.#seenSessions.add(sessionKey);
      this.#verifiedCursor = this.#cursor;
      // Host receipt ordinals remain session-local. Only this successful owned
      // execution advances the root plan's global ordinal offset.
      this.#eventOffset = endOffset;
      this.#context = undefined;
      return result;
    } catch { this.#fail(); throw this.#error; }
  }

  async finalize(): Promise<unknown> {
    try {
      this.#live();
      if (this.#context !== undefined || this.#window !== undefined || this.#operationBusy || this.#hostEventBusy || this.#finalizing || this.#cursor !== this.#plan.calls.length || this.#verifiedCursor !== this.#cursor) throw failure();
      this.#finalizing = true;
      const result = await this.#wait(this.#client.finalize(this.signal));
      this.#finalized = true;
      this.#unlink();
      return result;
    } catch { this.#fail(); throw this.#error; }
  }

  close(): Promise<void> {
    this.#closePromise ??= (async () => {
      if (!this.#finalized) this.#fail();
      else this.#clientClosing ??= Promise.resolve().then(() => this.#client.close()).catch(() => undefined);
      const work = Promise.allSettled([this.#execution, this.#clientClosing]);
      await new Promise<void>((resolvePromise) => {
        const timer = setTimeout(resolvePromise, this.#waitMs);
        void work.then(() => { clearTimeout(timer); resolvePromise(); });
      });
    })();
    return this.#closePromise;
  }
}

/**
 * Root-only composition: events come directly from the executor's owned stdout.
 * Binding also relies on the gateway awaiting observer -> operation -> MCP
 * completion. The existing operation wire cannot identify an old operation
 * first arriving after a new call start; this module alone is not Gold proof.
 */
export function createStep16HostCallSupervisorInternalV1(options: CreateStep16HostCallSupervisorInternalV1Options): Step16HostCallSupervisorInternalV1 {
  try {
    const input = record(options, ["closingPlan", "witnessClient", "signal", ...(Object.hasOwn(options, "operationWaitMs") ? ["operationWaitMs"] : [])]);
    const waitMs = input.operationWaitMs ?? 5000;
    if (!positiveInteger(waitMs, 60_000) || !(input.signal instanceof AbortSignal) || input.signal.aborted) throw failure();
    return new Supervisor(parsePlan(input.closingPlan as Step16HostCallSupervisorPlanInternalV1), snapshotClient(input.witnessClient as Step16HostCallSupervisorWitnessClientInternalV1), input.signal, waitMs);
  } catch { throw failure(); }
}
