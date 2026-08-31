import { createConnection, type Socket } from "node:net";
import { isAbsolute, resolve } from "node:path";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  ContentDigestV1Schema,
  LowerHex32V1Schema,
  LowerHex64V1Schema,
  type ContentDigestV1,
  type LowerHex64V1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import { readProviderRuntimeNativeKernelPeerCredentialsV1 } from "@understand-code/native-kernel-bridge";

import type { ProviderRuntimeStrongMutationOperationPlanInternalV1 } from "./provider-runtime-strong-mutation-transport-internal.js";

const WIRE_PROFILE_V1 = "step16_provider_operation_plan_v1" as const;
const DEFAULT_TIMEOUT_MS_V1 = 5_000;
const MAX_TIMEOUT_MS_V1 = 60_000;
const MAX_FRAME_BYTES_V1 = 16 * 1024;
const MAX_PATH_BYTES_V1 = 4_096;

export class ProviderOperationPlanRejectedInternalV1 extends Error {
  readonly code = "operation_plan_rejected" as const;

  constructor() {
    super("provider operation plan was rejected");
    this.name = "ProviderOperationPlanRejectedInternalV1";
  }
}

export interface CreateProviderOperationPlanSupervisorObserverInternalV1Input {
  readonly socketPath: string;
  readonly expectedSupervisorPid: number;
  readonly runNonce: LowerHex64V1;
  readonly closingPlanDigest: ContentDigestV1;
  readonly timeoutMs?: number;
}

export type ProviderOperationPlanSupervisorObserverInternalV1 = (
  observed: ProviderRuntimeStrongMutationOperationPlanInternalV1,
) => Promise<void>;

interface CompiledInputV1 {
  readonly socketPath: string;
  readonly expectedSupervisorPid: number;
  readonly runNonce: LowerHex64V1;
  readonly closingPlanDigest: ContentDigestV1;
  readonly timeoutMs: number;
}

type JsonRecordV1 = Record<string, unknown>;

function rejectedV1(): never {
  throw new ProviderOperationPlanRejectedInternalV1();
}

function recordV1(value: unknown): JsonRecordV1 | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null
    ? value as JsonRecordV1
    : undefined;
}

function exactKeysV1(value: JsonRecordV1, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function ownDataValueV1(value: JsonRecordV1, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !("value" in descriptor)) rejectedV1();
  return descriptor.value;
}

function canonicalAbsolutePathV1(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_PATH_BYTES_V1 &&
    Buffer.byteLength(value, "utf8") <= MAX_PATH_BYTES_V1 &&
    !value.includes("\0") &&
    isAbsolute(value) &&
    resolve(value) === value;
}

function positiveIntegerV1(value: unknown, maximum: number): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= maximum;
}

function compileInputV1(value: unknown): CompiledInputV1 {
  try {
    const input = recordV1(value);
    if (
      input === undefined ||
      !exactKeysV1(
        input,
        Object.hasOwn(input, "timeoutMs")
          ? [
            "closingPlanDigest",
            "expectedSupervisorPid",
            "runNonce",
            "socketPath",
            "timeoutMs",
          ]
          : [
            "closingPlanDigest",
            "expectedSupervisorPid",
            "runNonce",
            "socketPath",
          ],
      )
    ) return rejectedV1();
    const socketPath = ownDataValueV1(input, "socketPath");
    const expectedSupervisorPid = ownDataValueV1(
      input,
      "expectedSupervisorPid",
    );
    const runNonce = ownDataValueV1(input, "runNonce");
    const closingPlanDigest = ownDataValueV1(input, "closingPlanDigest");
    const timeoutValue = Object.hasOwn(input, "timeoutMs")
      ? ownDataValueV1(input, "timeoutMs")
      : DEFAULT_TIMEOUT_MS_V1;
    if (
      !canonicalAbsolutePathV1(socketPath) ||
      !positiveIntegerV1(expectedSupervisorPid, 0x7fff_ffff) ||
      !positiveIntegerV1(timeoutValue, MAX_TIMEOUT_MS_V1)
    ) return rejectedV1();
    return Object.freeze({
      socketPath,
      expectedSupervisorPid,
      runNonce: LowerHex64V1Schema.parse(runNonce),
      closingPlanDigest: ContentDigestV1Schema.parse(closingPlanDigest),
      timeoutMs: timeoutValue,
    });
  } catch (error) {
    if (error instanceof ProviderOperationPlanRejectedInternalV1) throw error;
    return rejectedV1();
  }
}

function compileObservedV1(
  value: unknown,
): ProviderRuntimeStrongMutationOperationPlanInternalV1 {
  try {
    const observed = recordV1(value);
    if (
      observed === undefined ||
      !exactKeysV1(observed, [
        "operation",
        "operationNonce",
        "requestDigest",
      ])
    ) return rejectedV1();
    const operation = ownDataValueV1(observed, "operation");
    if (operation !== "write_object" && operation !== "compare_commit") {
      return rejectedV1();
    }
    return Object.freeze({
      operation,
      operationNonce: LowerHex32V1Schema.parse(
        ownDataValueV1(observed, "operationNonce"),
      ),
      requestDigest: ContentDigestV1Schema.parse(
        ownDataValueV1(observed, "requestDigest"),
      ),
    });
  } catch (error) {
    if (error instanceof ProviderOperationPlanRejectedInternalV1) throw error;
    return rejectedV1();
  }
}

async function connectV1(
  input: CompiledInputV1,
  observeSocket: (socket: Socket) => void,
): Promise<Socket> {
  let socket: Socket;
  try {
    socket = createConnection({ path: input.socketPath });
  } catch {
    return rejectedV1();
  }
  // Keep the socket owned throughout connect/write/read, including the short
  // gaps between phase-specific listeners and concurrent cancellation.
  socket.on("error", () => undefined);
  observeSocket(socket);
  socket.setTimeout(input.timeoutMs, () => socket.destroy());
  try {
    await new Promise<void>((resolvePromise, rejectPromise) => {
      const fail = (): void => rejectPromise(new Error("connect failed"));
      socket.once("error", fail);
      socket.once("close", fail);
      socket.once("connect", () => {
        socket.off("error", fail);
        socket.off("close", fail);
        resolvePromise();
      });
    });
    const peer = readProviderRuntimeNativeKernelPeerCredentialsV1(socket);
    if (
      peer.uid !== 0 ||
      peer.gid !== 0 ||
      peer.pid !== input.expectedSupervisorPid
    ) return rejectedV1();
    return socket;
  } catch {
    socket.destroy();
    return rejectedV1();
  }
}

async function writeRequestV1(socket: Socket, request: unknown): Promise<void> {
  const bytes = Buffer.from(`${canonicalizeJcsSafeIntegerV1(request)}\n`, "utf8");
  if (bytes.byteLength > MAX_FRAME_BYTES_V1) return rejectedV1();
  await new Promise<void>((resolvePromise, rejectPromise) => {
    socket.write(bytes, (error) => error === null || error === undefined
      ? resolvePromise()
      : rejectPromise(new Error("write failed")));
  }).catch(() => rejectedV1());
}

async function readResponseV1(socket: Socket): Promise<unknown> {
  if (socket.destroyed || socket.readableEnded) return rejectedV1();
  return new Promise<unknown>((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    let ended = false;
    const cleanup = (): void => {
      socket.off("data", onData);
      socket.off("end", onEnd);
      socket.off("error", fail);
      socket.off("close", onClose);
    };
    const fail = (): void => {
      cleanup();
      rejectPromise(new ProviderOperationPlanRejectedInternalV1());
    };
    const onData = (value: Buffer): void => {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      bytes += chunk.byteLength;
      if (bytes > MAX_FRAME_BYTES_V1) return fail();
      chunks.push(chunk);
    };
    const onEnd = (): void => {
      ended = true;
      cleanup();
      const frame = Buffer.concat(chunks, bytes);
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
          .decode(frame);
      } catch {
        return fail();
      }
      if (
        !text.endsWith("\n") ||
        text.includes("\r") ||
        text.slice(0, -1).includes("\n") ||
        text.length === 1
      ) return fail();
      try {
        resolvePromise(JSON.parse(text.slice(0, -1)) as unknown);
      } catch {
        fail();
      }
    };
    const onClose = (): void => {
      if (!ended) fail();
    };
    socket.on("data", onData);
    socket.once("end", onEnd);
    socket.once("error", fail);
    socket.once("close", onClose);
  });
}

function validateAckV1(
  value: unknown,
  input: CompiledInputV1,
  operationSequence: number,
  requestDigest: ContentDigestV1,
): void {
  try {
    const ack = recordV1(value);
    if (
      ack === undefined ||
      !exactKeysV1(ack, [
        "closingPlanDigest",
        "operationSequence",
        "profile",
        "requestDigest",
        "runNonce",
        "status",
      ]) ||
      ownDataValueV1(ack, "profile") !== WIRE_PROFILE_V1 ||
      ownDataValueV1(ack, "status") !== "observed" ||
      ownDataValueV1(ack, "runNonce") !== input.runNonce ||
      ownDataValueV1(ack, "closingPlanDigest") !== input.closingPlanDigest ||
      ownDataValueV1(ack, "operationSequence") !== operationSequence ||
      ownDataValueV1(ack, "requestDigest") !== requestDigest
    ) return rejectedV1();
  } catch (error) {
    if (error instanceof ProviderOperationPlanRejectedInternalV1) throw error;
    return rejectedV1();
  }
}

export function createProviderOperationPlanSupervisorObserverInternalV1(
  value: CreateProviderOperationPlanSupervisorObserverInternalV1Input,
): ProviderOperationPlanSupervisorObserverInternalV1 {
  const input = compileInputV1(value);
  let operationSequence = 0;
  let activeSocket: Socket | undefined;
  let inFlight = false;
  let terminalError: ProviderOperationPlanRejectedInternalV1 | undefined;

  const terminalV1 = (): never => {
    terminalError ??= new ProviderOperationPlanRejectedInternalV1();
    activeSocket?.destroy();
    throw terminalError;
  };

  return async (value: ProviderRuntimeStrongMutationOperationPlanInternalV1) => {
    if (terminalError !== undefined || inFlight) return terminalV1();
    inFlight = true;
    operationSequence += 1;
    const sequence = operationSequence;
    const deadline = setTimeout(() => {
      terminalError ??= new ProviderOperationPlanRejectedInternalV1();
      activeSocket?.destroy();
    }, input.timeoutMs);
    let observed: ProviderRuntimeStrongMutationOperationPlanInternalV1;
    try {
      observed = compileObservedV1(value);
      const request = Object.freeze({
        profile: WIRE_PROFILE_V1,
        runNonce: input.runNonce,
        closingPlanDigest: input.closingPlanDigest,
        operationSequence: sequence,
        observed,
      });
      const socket = await connectV1(input, (connected) => {
        activeSocket = connected;
      });
      if (terminalError !== undefined) return terminalV1();
      await writeRequestV1(socket, request);
      if (terminalError !== undefined) return terminalV1();
      const response = await readResponseV1(socket);
      if (terminalError !== undefined) return terminalV1();
      validateAckV1(
        response,
        input,
        sequence,
        observed.requestDigest,
      );
    } catch {
      return terminalV1();
    } finally {
      clearTimeout(deadline);
      activeSocket?.destroy();
      activeSocket = undefined;
      inFlight = false;
    }
  };
}
