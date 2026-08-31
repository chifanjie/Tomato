import { randomBytes } from "node:crypto";

import { digestDomainInternalV1 } from "./crypto-internal.js";
import type {
  ProviderProductionStrongAuthorityStep16ExpectedOperationInternalV1,
  ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1,
  ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1,
  ProviderProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1,
  ProviderProductionStrongAuthorityTrustedHostCallWitnessInternalV1,
} from "./provider-production-strong-authority-service.js";

const CLOSING_PLAN_DIGEST_DOMAIN_V1 =
  "understand-code-step16-host-call-closing-plan-v1";
const WINDOW_TOKEN_PATTERN_V1 = /^step16-window-v1:[0-9a-f]{64}$/u;
const SHA256_DIGEST_PATTERN_V1 = /^sha256:[0-9a-f]{64}$/u;
const NONCE_PATTERN_V1 = /^[0-9a-f]{64}$/u;
const OPERATION_NONCE_PATTERN_V1 = /^[0-9a-f]{32}$/u;
const MAX_CALLS_V1 = 256;
const MAX_OPERATIONS_PER_CALL_V1 = 4_096;
const MAX_OPERATIONS_PER_CLOSING_PLAN_V1 = 4_096;

export type Step16HostCallWitnessProtocolErrorCodeInternalV1 =
  | "authority_failed"
  | "connection_busy"
  | "connection_closed"
  | "connection_failed"
  | "incomplete_plan"
  | "invalid_closing_plan"
  | "invalid_frame"
  | "invalid_peer"
  | "lease_lost"
  | "out_of_order"
  | "pending_window"
  | "replayed_token"
  | "unexpected_call";

export class Step16HostCallWitnessProtocolErrorInternalV1 extends Error {
  readonly code: Step16HostCallWitnessProtocolErrorCodeInternalV1;

  constructor(code: Step16HostCallWitnessProtocolErrorCodeInternalV1) {
    super(code);
    this.name = "Step16HostCallWitnessProtocolErrorInternalV1";
    this.code = code;
  }
}

export interface Step16HostCallWitnessClosingPlanCallInternalV1 {
  readonly callOrdinal: number;
  readonly eventOrdinal: number;
  readonly host: "codex" | "claude";
  readonly tool: string;
  /** null is an explicit root-derived slot, never an unchecked argument. */
  readonly argumentsDigest: string | null;
}

/** Installed only by the root authority composition, never by the wire peer. */
export type Step16HostCallWitnessResolveArgumentsInternalV1 = (
  call: Step16HostCallWitnessClosingPlanCallInternalV1,
) => Promise<string>;

export interface Step16HostCallWitnessClosingPlanInternalV1 {
  readonly closingPlanDigest: string;
  readonly runNonce: string;
  readonly calls: readonly Step16HostCallWitnessClosingPlanCallInternalV1[];
}

export interface Step16HostCallWitnessPeerCredentialInternalV1 {
  readonly uid: number;
  readonly pid: number;
}

export interface Step16HostCallWitnessSupervisorLeaseInternalV1 {
  held(): boolean;
}

export interface Step16HostCallWitnessBeginCollectingInputInternalV1 {
  readonly host: "codex" | "claude";
  readonly runNonce: string;
  readonly closingPlanDigest: string;
  readonly callOrdinal: number;
  readonly eventOrdinal: number;
  readonly tool: string;
  readonly argumentsDigest: string;
  readonly sessionIdDigest: string;
  readonly callIdDigest: string;
}

export interface Step16HostCallWitnessFinalizeRunInputInternalV1 {
  readonly runNonce: string;
  readonly closingPlanDigest: string;
  readonly callCount: number;
}

export interface Step16HostCallWitnessAuthorityCallbacksInternalV1 {
  readonly finalizeRun?: (
    input: Step16HostCallWitnessFinalizeRunInputInternalV1,
  ) => Promise<void>;
  readonly beginCollecting: (
    input: Step16HostCallWitnessBeginCollectingInputInternalV1,
  ) => Promise<
    ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1
  >;
  readonly appendExpectedOperation: (
    window:
      ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1,
    operation:
      ProviderProductionStrongAuthorityStep16ExpectedOperationInternalV1,
  ) => Promise<void>;
  readonly complete: (
    window:
      ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1,
    witness:
      ProviderProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1,
  ) => Promise<
    readonly ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1[]
  >;
  readonly abort: (
    window:
      ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1,
  ) => Promise<void>;
}

export interface Step16HostCallWitnessServerCoreOptionsInternalV1 {
  readonly directSupervisorPid: number;
  readonly supervisorLease: Step16HostCallWitnessSupervisorLeaseInternalV1;
  readonly closingPlan: Step16HostCallWitnessClosingPlanInternalV1;
  readonly authority: Step16HostCallWitnessAuthorityCallbacksInternalV1;
  readonly resolveArgumentsDigest?: Step16HostCallWitnessResolveArgumentsInternalV1;
}

export interface Step16HostCallWitnessConnectionInternalV1 {
  hello(frame: unknown): Promise<Readonly<{ readonly status: "ready" }>>;
  arm(frame: unknown): Promise<string>;
  observeProviderOperation(frame: unknown): Promise<Readonly<{
    readonly status: "observed";
    readonly operationOrdinal: number;
  }>>;
  complete(frame: unknown): Promise<Readonly<{
    readonly status: "completed";
    readonly receiptBundleDigests: readonly string[];
  }>>;
  abort(frame: unknown): Promise<Readonly<{ readonly status: "aborted" }>>;
  disconnect(): Promise<void>;
  timeout(): Promise<void>;
}

export interface Step16HostCallWitnessServerCoreInternalV1 {
  accept(
    peer: Step16HostCallWitnessPeerCredentialInternalV1,
  ): Step16HostCallWitnessConnectionInternalV1;
  close(): Promise<void>;
}

interface ActiveWindowInternalV1 {
  readonly token: string;
  readonly call: Step16HostCallWitnessClosingPlanCallInternalV1;
  readonly sessionIdDigest: string;
  readonly callIdDigest: string;
  readonly authorityWindow:
    ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1;
  readonly expectedProviderOperations:
    ProviderProductionStrongAuthorityStep16ExpectedOperationInternalV1[];
}

const trustedHostCallWitnessesV1 = new WeakMap<
  object,
  ProviderProductionStrongAuthorityTrustedHostCallWitnessInternalV1
>();

export function openStep16HostCallWitnessCapabilityInternalV1(
  witness:
    ProviderProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1,
): ProviderProductionStrongAuthorityTrustedHostCallWitnessInternalV1 | undefined {
  if (typeof witness !== "object" || witness === null) return undefined;
  const opened = trustedHostCallWitnessesV1.get(witness as object);
  if (opened !== undefined) trustedHostCallWitnessesV1.delete(witness as object);
  return opened;
}

function exactRecordKeysV1(
  value: unknown,
  expectedKeys: readonly string[],
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function isSafePositiveIntegerV1(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value > 0;
}

function isDigestV1(value: unknown): value is string {
  return typeof value === "string" && SHA256_DIGEST_PATTERN_V1.test(value);
}

function parseProviderOperationV1(
  value: Record<string, unknown>,
): ProviderProductionStrongAuthorityStep16ExpectedOperationInternalV1 {
  if (
    (value.operation !== "write_object" &&
      value.operation !== "compare_commit") ||
    typeof value.operationNonce !== "string" ||
    !OPERATION_NONCE_PATTERN_V1.test(value.operationNonce) ||
    !isDigestV1(value.requestDigest)
  ) {
    throw protocolErrorV1("invalid_frame");
  }
  return Object.freeze({
    operation: value.operation,
    operationNonce: value.operationNonce,
    requestDigest: value.requestDigest,
  });
}

function parseClosingPlanV1(
  value: Step16HostCallWitnessClosingPlanInternalV1,
): Step16HostCallWitnessClosingPlanInternalV1 {
  if (
    !exactRecordKeysV1(value, ["calls", "closingPlanDigest", "runNonce"]) ||
    !isDigestV1(value.closingPlanDigest) ||
    !NONCE_PATTERN_V1.test(value.runNonce) ||
    !Array.isArray(value.calls) || value.calls.length < 1 ||
    value.calls.length > MAX_CALLS_V1
  ) {
    throw new Step16HostCallWitnessProtocolErrorInternalV1(
      "invalid_closing_plan",
    );
  }
  let priorEventOrdinal = 0;
  const calls = value.calls.map((call, index) => {
    if (!exactRecordKeysV1(call, [
      "argumentsDigest",
      "callOrdinal",
      "eventOrdinal",
      "host",
      "tool",
    ])) {
      throw new Step16HostCallWitnessProtocolErrorInternalV1(
        "invalid_closing_plan",
      );
    }
    if (
      call.callOrdinal !== index + 1 ||
      !isSafePositiveIntegerV1(call.eventOrdinal) ||
      call.eventOrdinal <= priorEventOrdinal ||
      (call.host !== "codex" && call.host !== "claude") ||
      typeof call.tool !== "string" || call.tool.length < 1 ||
      call.tool.length > 128 || call.tool.includes("\0") ||
      (call.argumentsDigest !== null && !isDigestV1(call.argumentsDigest))
    ) {
      throw new Step16HostCallWitnessProtocolErrorInternalV1(
        "invalid_closing_plan",
      );
    }
    priorEventOrdinal = call.eventOrdinal;
    return Object.freeze({
      callOrdinal: call.callOrdinal,
      eventOrdinal: call.eventOrdinal,
      host: call.host,
      tool: call.tool,
      argumentsDigest: call.argumentsDigest,
    });
  });
  const parsed = Object.freeze({
    closingPlanDigest: value.closingPlanDigest,
    runNonce: value.runNonce,
    calls: Object.freeze(calls),
  });
  if (
    deriveStep16HostCallWitnessClosingPlanDigestInternalV1({
      runNonce: parsed.runNonce,
      calls: parsed.calls,
    }) !== parsed.closingPlanDigest
  ) {
    throw new Step16HostCallWitnessProtocolErrorInternalV1(
      "invalid_closing_plan",
    );
  }
  return parsed;
}

export function deriveStep16HostCallWitnessClosingPlanDigestInternalV1(
  input: Readonly<{
    readonly runNonce: string;
    readonly calls: readonly Step16HostCallWitnessClosingPlanCallInternalV1[];
  }>,
): string {
  return digestDomainInternalV1(CLOSING_PLAN_DIGEST_DOMAIN_V1, input);
}

function mintWitnessV1(
  call: Step16HostCallWitnessClosingPlanCallInternalV1,
  expectedProviderOperations:
    readonly ProviderProductionStrongAuthorityStep16ExpectedOperationInternalV1[],
  sessionIdDigest: string,
  callIdDigest: string,
): ProviderProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1 {
  const capability = Object.freeze(Object.create(null)) as
    ProviderProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1;
  trustedHostCallWitnessesV1.set(capability, Object.freeze({
    host: call.host,
    sessionIdDigest,
    callIdDigest,
    expectedProviderOperations,
  }));
  return capability;
}

function discardWitnessV1(
  witness:
    ProviderProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1,
): void {
  if (typeof witness === "object" && witness !== null) {
    trustedHostCallWitnessesV1.delete(witness as object);
  }
}

function protocolErrorV1(
  code: Step16HostCallWitnessProtocolErrorCodeInternalV1,
): Step16HostCallWitnessProtocolErrorInternalV1 {
  return new Step16HostCallWitnessProtocolErrorInternalV1(code);
}

class Step16HostCallWitnessConnectionCoreInternalV1
  implements Step16HostCallWitnessConnectionInternalV1 {
  readonly #plan: Step16HostCallWitnessClosingPlanInternalV1;
  readonly #peer: Step16HostCallWitnessPeerCredentialInternalV1;
  readonly #directSupervisorPid: number;
  readonly #lease: Step16HostCallWitnessSupervisorLeaseInternalV1;
  readonly #authority: Step16HostCallWitnessAuthorityCallbacksInternalV1;
  readonly #resolveArgumentsDigest: Step16HostCallWitnessResolveArgumentsInternalV1 | undefined;

  #phase: "awaiting_hello" | "ready" | "failed" | "closed" =
    "awaiting_hello";
  #nextSequence = 1;
  #nextCallIndex = 0;
  #completedCallCount = 0;
  #observedProviderOperationCount = 0;
  #inFlight = false;
  #arming = false;
  #activeWindow: ActiveWindowInternalV1 | undefined;
  readonly #burnedTokens = new Set<string>();

  constructor(
    plan: Step16HostCallWitnessClosingPlanInternalV1,
    peer: Step16HostCallWitnessPeerCredentialInternalV1,
    directSupervisorPid: number,
    lease: Step16HostCallWitnessSupervisorLeaseInternalV1,
    authority: Step16HostCallWitnessAuthorityCallbacksInternalV1,
    resolveArgumentsDigest: Step16HostCallWitnessResolveArgumentsInternalV1 | undefined,
  ) {
    this.#plan = plan;
    this.#peer = peer;
    this.#directSupervisorPid = directSupervisorPid;
    this.#lease = lease;
    this.#authority = authority;
    this.#resolveArgumentsDigest = resolveArgumentsDigest;
  }

  async hello(frame: unknown): Promise<Readonly<{ readonly status: "ready" }>> {
    this.#enterOperationV1();
    try {
      if (
        this.#phase !== "awaiting_hello" ||
        !exactRecordKeysV1(frame, [
          "closingPlanDigest",
          "kind",
          "runNonce",
          "sequence",
        ]) || frame.kind !== "hello" ||
        frame.closingPlanDigest !== this.#plan.closingPlanDigest ||
        frame.runNonce !== this.#plan.runNonce
      ) {
        await this.#failClosedV1("invalid_frame");
        throw protocolErrorV1("invalid_frame");
      }
      this.#consumeSequenceV1(frame.sequence);
      this.#phase = "ready";
      return Object.freeze({ status: "ready" as const });
    } finally {
      this.#inFlight = false;
    }
  }

  async arm(frame: unknown): Promise<string> {
    this.#enterOperationV1();
    this.#arming = true;
    try {
      const plannedCall = this.#plan.calls[this.#nextCallIndex];
      const derived = plannedCall?.argumentsDigest === null;
      if (
        this.#phase !== "ready" || this.#activeWindow !== undefined ||
        !exactRecordKeysV1(frame, [
          "callOrdinal",
          "kind",
          "sequence",
          "sessionIdDigest",
          "callIdDigest",
          ...(derived ? ["argumentsDigest"] : []),
        ]) || frame.kind !== (derived ? "arm_derived" : "arm") ||
        !isDigestV1(frame.sessionIdDigest) || !isDigestV1(frame.callIdDigest) ||
        (derived && !isDigestV1(frame.argumentsDigest))
      ) {
        await this.#failClosedV1("invalid_frame");
        throw protocolErrorV1("invalid_frame");
      }
      this.#consumeSequenceV1(frame.sequence);
      if (plannedCall === undefined || frame.callOrdinal !== plannedCall.callOrdinal) {
        await this.#failClosedV1("unexpected_call");
        throw protocolErrorV1("unexpected_call");
      }
      const sessionIdDigest = frame.sessionIdDigest;
      const callIdDigest = frame.callIdDigest;
      const observedArgumentsDigest = frame.argumentsDigest;
      let argumentsDigest = plannedCall.argumentsDigest;
      if (argumentsDigest === null) {
        try {
          // The resolver receives only the immutable planned slot. In
          // particular it cannot echo the Host's proposed arguments digest.
          argumentsDigest = await this.#resolveArgumentsDigest!(plannedCall);
        } catch {
          await this.#failClosedV1("authority_failed");
          throw protocolErrorV1("authority_failed");
        }
        if (!this.#isLiveV1() || this.#phase !== "ready") {
          await this.#failClosedV1("lease_lost");
          throw protocolErrorV1("lease_lost");
        }
        if (!isDigestV1(argumentsDigest) || argumentsDigest !== observedArgumentsDigest) {
          await this.#failClosedV1("unexpected_call");
          throw protocolErrorV1("unexpected_call");
        }
      }
      const call = Object.freeze({ ...plannedCall, argumentsDigest });
      let authorityWindow:
        ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1;
      const beginInput: Step16HostCallWitnessBeginCollectingInputInternalV1 =
        Object.freeze({
          host: call.host,
          runNonce: this.#plan.runNonce,
          closingPlanDigest: this.#plan.closingPlanDigest,
          callOrdinal: call.callOrdinal,
          eventOrdinal: call.eventOrdinal,
          tool: call.tool,
          argumentsDigest: call.argumentsDigest,
          sessionIdDigest,
          callIdDigest,
        });
      try {
        authorityWindow = await this.#authority.beginCollecting(beginInput);
      } catch {
        await this.#failClosedV1("authority_failed");
        throw protocolErrorV1("authority_failed");
      }
      if (!this.#isLiveV1() || this.#phase !== "ready") {
        await this.#authority.abort(authorityWindow).catch(() => undefined);
        throw protocolErrorV1("connection_closed");
      }
      let token: string;
      do {
        token = `step16-window-v1:${randomBytes(32).toString("hex")}`;
      } while (this.#burnedTokens.has(token));
      this.#activeWindow = Object.freeze({
        token,
        call,
        sessionIdDigest: beginInput.sessionIdDigest,
        callIdDigest: beginInput.callIdDigest,
        authorityWindow,
        expectedProviderOperations: [],
      });
      this.#nextCallIndex += 1;
      return token;
    } finally {
      this.#arming = false;
      this.#inFlight = false;
    }
  }

  async observeProviderOperation(frame: unknown): Promise<Readonly<{
    readonly status: "observed";
    readonly operationOrdinal: number;
  }>> {
    this.#enterOperationV1();
    try {
      if (
        this.#phase !== "ready" ||
        !exactRecordKeysV1(frame, [
          "kind",
          "operation",
          "operationNonce",
          "requestDigest",
          "sequence",
          "token",
        ]) || frame.kind !== "observe_provider_operation"
      ) {
        await this.#failClosedV1("invalid_frame");
        throw protocolErrorV1("invalid_frame");
      }
      this.#consumeSequenceV1(frame.sequence);
      const window = this.#activeWindow;
      if (
        window === undefined || typeof frame.token !== "string" ||
        !WINDOW_TOKEN_PATTERN_V1.test(frame.token) ||
        frame.token !== window.token || this.#burnedTokens.has(frame.token)
      ) {
        await this.#failClosedV1("replayed_token");
        throw protocolErrorV1("replayed_token");
      }
      let operation:
        ProviderProductionStrongAuthorityStep16ExpectedOperationInternalV1;
      try {
        operation = parseProviderOperationV1(frame);
      } catch {
        await this.#failClosedV1("invalid_frame");
        throw protocolErrorV1("invalid_frame");
      }
      if (
        window.expectedProviderOperations.length >=
          MAX_OPERATIONS_PER_CALL_V1 ||
        this.#observedProviderOperationCount >=
          MAX_OPERATIONS_PER_CLOSING_PLAN_V1 ||
        window.expectedProviderOperations.some((expected) =>
          expected.operationNonce === operation.operationNonce
        )
      ) {
        await this.#failClosedV1("invalid_frame");
        throw protocolErrorV1("invalid_frame");
      }
      try {
        await this.#authority.appendExpectedOperation(
          window.authorityWindow,
          operation,
        );
      } catch {
        await this.#failClosedV1("authority_failed");
        throw protocolErrorV1("authority_failed");
      }
      if (!this.#isLiveV1()) {
        await this.#failClosedV1("lease_lost");
        throw protocolErrorV1("lease_lost");
      }
      if (
        this.#phase !== "ready" || this.#activeWindow !== window
      ) {
        throw protocolErrorV1("connection_closed");
      }
      window.expectedProviderOperations.push(operation);
      this.#observedProviderOperationCount += 1;
      return Object.freeze({
        status: "observed" as const,
        operationOrdinal: window.expectedProviderOperations.length,
      });
    } finally {
      this.#inFlight = false;
    }
  }

  async complete(frame: unknown): Promise<Readonly<{
    readonly status: "completed";
    readonly receiptBundleDigests: readonly string[];
  }>> {
    this.#enterOperationV1();
    let window: ActiveWindowInternalV1 | undefined;
    let witness:
      ProviderProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1 |
      undefined;
    try {
      if (
        this.#phase !== "ready" ||
        typeof frame !== "object" || frame === null || Array.isArray(frame) ||
        (frame as Record<string, unknown>).kind !== "complete"
      ) {
        await this.#failClosedV1("invalid_frame");
        throw protocolErrorV1("invalid_frame");
      }
      const candidate = frame as Record<string, unknown>;
      this.#consumeSequenceV1(candidate.sequence);
      const token = candidate.token;
      window = this.#activeWindow;
      this.#activeWindow = undefined;
      if (
        typeof token !== "string" || !WINDOW_TOKEN_PATTERN_V1.test(token) ||
        window === undefined || token !== window.token ||
        this.#burnedTokens.has(token)
      ) {
        if (window !== undefined) {
          this.#burnedTokens.add(window.token);
          await this.#abortWindowV1(window);
        }
        await this.#failClosedV1("replayed_token");
        throw protocolErrorV1("replayed_token");
      }
      this.#burnedTokens.add(token);

      if (
        !exactRecordKeysV1(candidate, [
          "callIdDigest",
          "kind",
          "sequence",
          "sessionIdDigest",
          "token",
        ]) || !isDigestV1(candidate.sessionIdDigest) ||
        !isDigestV1(candidate.callIdDigest) ||
        candidate.sessionIdDigest !== window.sessionIdDigest ||
        candidate.callIdDigest !== window.callIdDigest
      ) {
        await this.#abortWindowV1(window);
        await this.#failClosedV1("invalid_frame");
        throw protocolErrorV1("invalid_frame");
      }
      if (window.expectedProviderOperations.length < 1) {
        await this.#abortWindowV1(window);
        await this.#failClosedV1("incomplete_plan");
        throw protocolErrorV1("incomplete_plan");
      }
      const expectedProviderOperations = Object.freeze([
        ...window.expectedProviderOperations,
      ]);
      witness = mintWitnessV1(
        window.call,
        expectedProviderOperations,
        window.sessionIdDigest,
        window.callIdDigest,
      );
      let completion: Awaited<
        ReturnType<Step16HostCallWitnessAuthorityCallbacksInternalV1["complete"]>
      >;
      try {
        completion = await this.#authority.complete(
          window.authorityWindow,
          witness,
        );
      } catch {
        discardWitnessV1(witness);
        await this.#abortWindowV1(window);
        await this.#failClosedV1("authority_failed");
        throw protocolErrorV1("authority_failed");
      }
      discardWitnessV1(witness);
      if (!this.#isLiveV1() || this.#phase !== "ready") {
        await this.#failClosedV1("connection_closed");
        throw protocolErrorV1("connection_closed");
      }
      if (
        !Array.isArray(completion) || completion.length !==
          expectedProviderOperations.length
      ) {
        await this.#failClosedV1("authority_failed");
        throw protocolErrorV1("authority_failed");
      }
      const receiptBundleDigests = completion.map((binding) => {
        const digest = binding?.receiptLedger?.receiptBundleDigest;
        return isDigestV1(digest) ? digest : undefined;
      });
      if (
        receiptBundleDigests.some((digest) => digest === undefined) ||
        new Set(receiptBundleDigests).size !== receiptBundleDigests.length
      ) {
        await this.#failClosedV1("authority_failed");
        throw protocolErrorV1("authority_failed");
      }
      this.#completedCallCount += 1;
      return Object.freeze({
        status: "completed" as const,
        receiptBundleDigests: Object.freeze(receiptBundleDigests as string[]),
      });
    } catch (error) {
      if (error instanceof Step16HostCallWitnessProtocolErrorInternalV1) {
        throw error;
      }
      if (window !== undefined) await this.#abortWindowV1(window);
      if (witness !== undefined) discardWitnessV1(witness);
      await this.#failClosedV1("authority_failed");
      throw protocolErrorV1("authority_failed");
    } finally {
      this.#inFlight = false;
    }
  }

  async abort(frame: unknown): Promise<Readonly<{ readonly status: "aborted" }>> {
    this.#enterOperationV1();
    try {
      if (
        this.#phase !== "ready" ||
        !exactRecordKeysV1(frame, ["kind", "sequence", "token"]) ||
        frame.kind !== "abort"
      ) {
        await this.#failClosedV1("invalid_frame");
        throw protocolErrorV1("invalid_frame");
      }
      this.#consumeSequenceV1(frame.sequence);
      const window = this.#activeWindow;
      this.#activeWindow = undefined;
      if (
        typeof frame.token !== "string" ||
        !WINDOW_TOKEN_PATTERN_V1.test(frame.token) || window === undefined ||
        frame.token !== window.token || this.#burnedTokens.has(frame.token)
      ) {
        if (window !== undefined) {
          this.#burnedTokens.add(window.token);
          await this.#abortWindowV1(window);
        }
        await this.#failClosedV1("replayed_token");
        throw protocolErrorV1("replayed_token");
      }
      this.#burnedTokens.add(frame.token);
      await this.#abortWindowV1(window);
      await this.#failClosedV1("connection_closed");
      return Object.freeze({ status: "aborted" as const });
    } finally {
      this.#inFlight = false;
    }
  }

  async disconnect(): Promise<void> {
    await this.#failClosedV1("connection_closed");
  }

  async timeout(): Promise<void> {
    await this.#failClosedV1("connection_closed");
  }

  hasPendingWindowInternalV1(): boolean {
    return this.#arming || this.#activeWindow !== undefined || this.#inFlight;
  }

  async closeFromServerInternalV1(): Promise<void> {
    if (this.#phase === "failed" || this.#phase === "closed") {
      throw protocolErrorV1("connection_failed");
    }
    if (!this.#isLiveV1()) {
      await this.#failClosedV1("lease_lost");
      throw protocolErrorV1("lease_lost");
    }
    if (this.hasPendingWindowInternalV1()) {
      await this.#failClosedV1("pending_window");
      throw protocolErrorV1("pending_window");
    }
    if (
      this.#phase !== "ready" ||
      this.#completedCallCount !== this.#plan.calls.length
    ) {
      await this.#failClosedV1("incomplete_plan");
      throw protocolErrorV1("incomplete_plan");
    }
    this.#inFlight = true;
    try {
      if (this.#authority.finalizeRun !== undefined) {
        try {
          await this.#authority.finalizeRun(Object.freeze({
            runNonce: this.#plan.runNonce,
            closingPlanDigest: this.#plan.closingPlanDigest,
            callCount: this.#plan.calls.length,
          }));
        } catch {
          await this.#failClosedV1("authority_failed");
          throw protocolErrorV1("authority_failed");
        }
      }
      if (!this.#isLiveV1() || this.#phase !== "ready") {
        await this.#failClosedV1("connection_closed");
        throw protocolErrorV1("connection_closed");
      }
      this.#phase = "closed";
    } finally {
      this.#inFlight = false;
    }
  }

  #isLiveV1(): boolean {
    try {
      return this.#peer.uid === 0 &&
        this.#peer.pid === this.#directSupervisorPid && this.#lease.held();
    } catch {
      return false;
    }
  }

  #enterOperationV1(): void {
    if (this.#phase === "failed" || this.#phase === "closed") {
      throw protocolErrorV1("connection_closed");
    }
    if (!this.#isLiveV1()) {
      void this.#failClosedV1("lease_lost");
      throw protocolErrorV1("lease_lost");
    }
    if (this.#inFlight) {
      void this.#failClosedV1("connection_busy");
      throw protocolErrorV1("connection_busy");
    }
    this.#inFlight = true;
  }

  #consumeSequenceV1(value: unknown): void {
    if (!isSafePositiveIntegerV1(value) || value !== this.#nextSequence) {
      void this.#failClosedV1("out_of_order");
      throw protocolErrorV1("out_of_order");
    }
    this.#nextSequence += 1;
  }

  async #abortWindowV1(window: ActiveWindowInternalV1): Promise<void> {
    await this.#authority.abort(window.authorityWindow).catch(() => undefined);
  }

  async #failClosedV1(
    _reason: Step16HostCallWitnessProtocolErrorCodeInternalV1,
  ): Promise<void> {
    if (this.#phase === "failed" || this.#phase === "closed") return;
    this.#phase = "failed";
    const window = this.#activeWindow;
    this.#activeWindow = undefined;
    if (window !== undefined) {
      this.#burnedTokens.add(window.token);
      await this.#abortWindowV1(window);
    }
  }
}

class Step16HostCallWitnessServerCoreV1
  implements Step16HostCallWitnessServerCoreInternalV1 {
  readonly #options: Readonly<{
    readonly directSupervisorPid: number;
    readonly supervisorLease: Step16HostCallWitnessSupervisorLeaseInternalV1;
    readonly closingPlan: Step16HostCallWitnessClosingPlanInternalV1;
    readonly authority: Step16HostCallWitnessAuthorityCallbacksInternalV1;
    readonly resolveArgumentsDigest?: Step16HostCallWitnessResolveArgumentsInternalV1;
  }>;
  #closed = false;
  #accepted = false;
  #closePromise: Promise<void> | undefined;
  #connection: Step16HostCallWitnessConnectionCoreInternalV1 | undefined;

  constructor(options: Step16HostCallWitnessServerCoreOptionsInternalV1) {
    if (
      !Number.isSafeInteger(options.directSupervisorPid) ||
      options.directSupervisorPid <= 0 ||
      typeof options.supervisorLease?.held !== "function" ||
      typeof options.authority?.beginCollecting !== "function" ||
      typeof options.authority?.appendExpectedOperation !== "function" ||
      typeof options.authority?.complete !== "function" ||
      typeof options.authority?.abort !== "function" ||
      (options.authority.finalizeRun !== undefined &&
        typeof options.authority.finalizeRun !== "function") ||
      (options.resolveArgumentsDigest !== undefined &&
        typeof options.resolveArgumentsDigest !== "function")
    ) {
      throw protocolErrorV1("invalid_closing_plan");
    }
    const closingPlan = parseClosingPlanV1(options.closingPlan);
    if (closingPlan.calls.some((call) => call.argumentsDigest === null) &&
      options.resolveArgumentsDigest === undefined) {
      throw protocolErrorV1("invalid_closing_plan");
    }
    this.#options = Object.freeze({
      directSupervisorPid: options.directSupervisorPid,
      supervisorLease: options.supervisorLease,
      closingPlan,
      ...(options.resolveArgumentsDigest === undefined ? {} :
        { resolveArgumentsDigest: options.resolveArgumentsDigest }),
      authority: Object.freeze({
        beginCollecting: options.authority.beginCollecting,
        appendExpectedOperation: options.authority.appendExpectedOperation,
        complete: options.authority.complete,
        abort: options.authority.abort,
        ...(options.authority.finalizeRun === undefined ? {} :
          { finalizeRun: options.authority.finalizeRun }),
      }),
    });
  }

  accept(
    peer: Step16HostCallWitnessPeerCredentialInternalV1,
  ): Step16HostCallWitnessConnectionInternalV1 {
    let leaseHeld = false;
    try {
      leaseHeld = this.#options.supervisorLease.held();
    } catch {
      leaseHeld = false;
    }
    if (
      this.#closed || this.#accepted || this.#connection !== undefined ||
      !exactRecordKeysV1(peer, ["pid", "uid"]) || peer.uid !== 0 ||
      peer.pid !== this.#options.directSupervisorPid || !leaseHeld
    ) {
      throw protocolErrorV1("invalid_peer");
    }
    let connection!: Step16HostCallWitnessConnectionCoreInternalV1;
    connection = new Step16HostCallWitnessConnectionCoreInternalV1(
      this.#options.closingPlan,
      Object.freeze({ uid: peer.uid, pid: peer.pid }),
      this.#options.directSupervisorPid,
      this.#options.supervisorLease,
      this.#options.authority,
      this.#options.resolveArgumentsDigest,
    );
    this.#accepted = true;
    this.#connection = connection;
    return connection;
  }

  async close(): Promise<void> {
    if (this.#closePromise !== undefined) return this.#closePromise;
    const closing = this.#closeOnceV1();
    this.#closePromise = closing;
    return closing;
  }

  async #closeOnceV1(): Promise<void> {
    this.#closed = true;
    const connection = this.#connection;
    if (connection === undefined) throw protocolErrorV1("incomplete_plan");
    await connection.closeFromServerInternalV1();
  }
}

export function createStep16HostCallWitnessServerCoreInternalV1(
  options: Step16HostCallWitnessServerCoreOptionsInternalV1,
): Step16HostCallWitnessServerCoreInternalV1 {
  return new Step16HostCallWitnessServerCoreV1(options);
}
