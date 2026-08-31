import { describe, expect, it, vi } from "vitest";

import type {
  ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1,
  ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1,
} from "../src/provider-production-strong-authority-service.js";
import {
  createStep16HostCallWitnessServerCoreInternalV1,
  deriveStep16HostCallWitnessClosingPlanDigestInternalV1,
  openStep16HostCallWitnessCapabilityInternalV1,
  Step16HostCallWitnessProtocolErrorInternalV1,
  type Step16HostCallWitnessAuthorityCallbacksInternalV1,
  type Step16HostCallWitnessClosingPlanCallInternalV1,
  type Step16HostCallWitnessClosingPlanInternalV1,
  type Step16HostCallWitnessResolveArgumentsInternalV1,
} from "../src/step16-host-call-witness-server-internal.js";

const digestV1 = (character: string): string =>
  `sha256:${character.repeat(64)}`;
const RUN_NONCE_V1 = "a".repeat(64);
const SESSION_DIGEST_V1 = digestV1("1");
const CALL_DIGEST_V1 = digestV1("2");
const RECEIPT_DIGEST_V1 = digestV1("3");

function planCallsV1(
  count = 1,
): readonly Step16HostCallWitnessClosingPlanCallInternalV1[] {
  return Object.freeze(Array.from({ length: count }, (_, index) => {
    const callOrdinal = index + 1;
    return Object.freeze({
      callOrdinal,
      eventOrdinal: callOrdinal * 2 + 1,
      host: "codex" as const,
      tool: "update_task",
      argumentsDigest: digestV1(index === 0 ? "4" : "7"),
    });
  }));
}

function operationV1(index = 0) {
  return Object.freeze({
    operation: "write_object" as const,
    operationNonce: ["b", "c", "d", "e"][index]!.repeat(32),
    requestDigest: digestV1(["5", "6", "7", "8"][index]!),
  });
}

function indexedOperationV1(index: number) {
  return Object.freeze({
    operation: "write_object" as const,
    operationNonce: index.toString(16).padStart(32, "0"),
    requestDigest: `sha256:${index.toString(16).padStart(64, "0")}`,
  });
}

function indexedBindingV1(index: number) {
  return bindingV1(`sha256:${index.toString(16).padStart(64, "0")}`);
}

function closingPlanV1(
  calls: readonly Step16HostCallWitnessClosingPlanCallInternalV1[] =
    planCallsV1(),
): Step16HostCallWitnessClosingPlanInternalV1 {
  return Object.freeze({
    closingPlanDigest:
      deriveStep16HostCallWitnessClosingPlanDigestInternalV1({
        runNonce: RUN_NONCE_V1,
        calls,
      }),
    runNonce: RUN_NONCE_V1,
    calls,
  });
}

function bindingV1(
  receiptBundleDigest = RECEIPT_DIGEST_V1,
  extra: Readonly<Record<string, unknown>> = {},
): ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1 {
  return {
    ...extra,
    receiptLedger: { receiptBundleDigest },
  } as unknown as
    ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1;
}

function fixtureV1(input: Readonly<{
  readonly leaseHeld?: boolean;
  readonly calls?: readonly Step16HostCallWitnessClosingPlanCallInternalV1[];
  readonly appendExpectedOperation?:
    Step16HostCallWitnessAuthorityCallbacksInternalV1["appendExpectedOperation"];
  readonly complete?: Step16HostCallWitnessAuthorityCallbacksInternalV1["complete"];
  readonly finalizeRun?: NonNullable<Step16HostCallWitnessAuthorityCallbacksInternalV1["finalizeRun"]>;
  readonly resolveArgumentsDigest?: Step16HostCallWitnessResolveArgumentsInternalV1;
}> = {}) {
  let leaseHeld = input.leaseHeld ?? true;
  const authorityWindow = Object.freeze(Object.create(null)) as
    ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1;
  const begin = vi.fn<
    Step16HostCallWitnessAuthorityCallbacksInternalV1["beginCollecting"]
  >(
    async () => authorityWindow,
  );
  const appendExpectedOperation = vi.fn<
    Step16HostCallWitnessAuthorityCallbacksInternalV1["appendExpectedOperation"]
  >(input.appendExpectedOperation ?? (async () => undefined));
  const abort = vi.fn<Step16HostCallWitnessAuthorityCallbacksInternalV1["abort"]>(
    async () => undefined,
  );
  const complete = vi.fn<
    Step16HostCallWitnessAuthorityCallbacksInternalV1["complete"]
  >(input.complete ?? (async (_window, witness) => {
    const opened = openStep16HostCallWitnessCapabilityInternalV1(witness);
    if (opened === undefined) throw new Error("missing witness");
    return Object.freeze(opened.expectedProviderOperations.map((_, index) =>
      bindingV1(digestV1(["3", "4", "5", "6"][index]!))
    ));
  }));
  const plan = closingPlanV1(input.calls);
  const server = createStep16HostCallWitnessServerCoreInternalV1({
    directSupervisorPid: 777,
    supervisorLease: { held: () => leaseHeld },
    closingPlan: plan,
    ...(input.resolveArgumentsDigest === undefined ? {} :
      { resolveArgumentsDigest: input.resolveArgumentsDigest }),
    authority: {
      beginCollecting: begin,
      appendExpectedOperation,
      complete,
      abort,
      ...(input.finalizeRun === undefined ? {} : { finalizeRun: input.finalizeRun }),
    },
  });
  return {
    server,
    plan,
    begin,
    appendExpectedOperation,
    complete,
    abort,
    loseLease: () => {
      leaseHeld = false;
    },
  };
}

async function helloV1(
  fixture: ReturnType<typeof fixtureV1>,
) {
  const connection = fixture.server.accept({ uid: 0, pid: 777 });
  await expect(connection.hello({
    kind: "hello",
    sequence: 1,
    closingPlanDigest: fixture.plan.closingPlanDigest,
    runNonce: fixture.plan.runNonce,
  })).resolves.toEqual({ status: "ready" });
  return connection;
}

async function armV1(
  fixture: ReturnType<typeof fixtureV1>,
) {
  const connection = await helloV1(fixture);
  const token = await connection.arm({
    kind: "arm",
    sequence: 2,
    callOrdinal: 1,
    sessionIdDigest: SESSION_DIGEST_V1,
    callIdDigest: CALL_DIGEST_V1,
  });
  return { connection, token };
}

async function observeV1(
  connection: Awaited<ReturnType<typeof helloV1>>,
  token: string,
  sequence: number,
  operationIndex = 0,
) {
  const operation = operationV1(operationIndex);
  await expect(connection.observeProviderOperation({
    kind: "observe_provider_operation",
    sequence,
    token,
    ...operation,
  })).resolves.toEqual({
    status: "observed",
    operationOrdinal: operationIndex + 1,
  });
  return operation;
}

function expectCodeV1(code: string) {
  return expect.objectContaining({
    name: "Step16HostCallWitnessProtocolErrorInternalV1",
    code,
    message: code,
  });
}

describe("Step16 root-only Host-call witness control core", () => {
  it("requires an explicit root resolver for deferred arguments", () => {
    expect(() => fixtureV1({ calls: [{ ...planCallsV1()[0]!, argumentsDigest: null }] }))
      .toThrow(expectCodeV1("invalid_closing_plan"));
  });

  it("resolves a later call only after the preceding call completes, in the same run", async () => {
    let committed = false;
    const resolveArgumentsDigest = vi.fn(async (call) => {
      expect(committed).toBe(true);
      expect(Object.isFrozen(call)).toBe(true);
      expect(call).toEqual({ ...planCallsV1(2)[1], argumentsDigest: null });
      return digestV1("9");
    });
    const finalizeRun = vi.fn(async () => undefined);
    const fixture = fixtureV1({
      calls: [planCallsV1()[0]!, { ...planCallsV1(2)[1]!, argumentsDigest: null }],
      resolveArgumentsDigest,
      finalizeRun,
    });
    const { connection, token } = await armV1(fixture);
    await observeV1(connection, token, 3);
    await connection.complete({ kind: "complete", sequence: 4, token, sessionIdDigest: SESSION_DIGEST_V1, callIdDigest: CALL_DIGEST_V1 });
    expect(resolveArgumentsDigest).not.toHaveBeenCalled();
    expect(finalizeRun).not.toHaveBeenCalled();
    committed = true;
    const second = await connection.arm({
      kind: "arm_derived", sequence: 5, callOrdinal: 2,
      sessionIdDigest: SESSION_DIGEST_V1, callIdDigest: digestV1("a"), argumentsDigest: digestV1("9"),
    });
    await observeV1(connection, second, 6);
    await connection.complete({ kind: "complete", sequence: 7, token: second, sessionIdDigest: SESSION_DIGEST_V1, callIdDigest: digestV1("a") });
    expect(resolveArgumentsDigest).toHaveBeenCalledTimes(1);
    expect(resolveArgumentsDigest.mock.calls[0]).toHaveLength(1);
    expect(fixture.begin.mock.calls.map(([call]) => ({ runNonce: call.runNonce, closingPlanDigest: call.closingPlanDigest, callOrdinal: call.callOrdinal, argumentsDigest: call.argumentsDigest }))).toEqual([
      { runNonce: RUN_NONCE_V1, closingPlanDigest: fixture.plan.closingPlanDigest, callOrdinal: 1, argumentsDigest: digestV1("4") },
      { runNonce: RUN_NONCE_V1, closingPlanDigest: fixture.plan.closingPlanDigest, callOrdinal: 2, argumentsDigest: digestV1("9") },
    ]);
    await fixture.server.close();
    expect(finalizeRun).toHaveBeenCalledOnce();
  });

  it.each(["mismatch", "invalid_digest", "read_failed"])("rejects %s from root derivation before opening a Provider window", async (failure) => {
    const fixture = fixtureV1({
      calls: [{ ...planCallsV1()[0]!, argumentsDigest: null }],
      resolveArgumentsDigest: async () => {
        if (failure === "read_failed") throw new Error("private runtime failure");
        return failure === "invalid_digest" ? "not-a-digest" : digestV1("8");
      },
    });
    const connection = await helloV1(fixture);
    await expect(connection.arm({ kind: "arm_derived", sequence: 2, callOrdinal: 1, sessionIdDigest: SESSION_DIGEST_V1, callIdDigest: CALL_DIGEST_V1, argumentsDigest: digestV1("9") })).rejects.toEqual(expectCodeV1(failure === "read_failed" ? "authority_failed" : "unexpected_call"));
    expect(fixture.begin).not.toHaveBeenCalled();
    await expect(connection.arm({})).rejects.toEqual(expectCodeV1("connection_closed"));
  });

  it("does not arm after a lease is lost during a root Provider read", async () => {
    let release!: (value: string) => void;
    const pending = new Promise<string>((resolve) => { release = resolve; });
    const fixture = fixtureV1({ calls: [{ ...planCallsV1()[0]!, argumentsDigest: null }], resolveArgumentsDigest: () => pending });
    const connection = await helloV1(fixture);
    const arming = connection.arm({ kind: "arm_derived", sequence: 2, callOrdinal: 1, sessionIdDigest: SESSION_DIGEST_V1, callIdDigest: CALL_DIGEST_V1, argumentsDigest: digestV1("9") });
    fixture.loseLease();
    release(digestV1("9"));
    await expect(arming).rejects.toEqual(expectCodeV1("lease_lost"));
    expect(fixture.begin).not.toHaveBeenCalled();
  });

  it("snapshots observed arguments and identity before awaiting root derivation", async () => {
    let release!: (value: string) => void;
    const pending = new Promise<string>((resolve) => { release = resolve; });
    const fixture = fixtureV1({ calls: [{ ...planCallsV1()[0]!, argumentsDigest: null }], resolveArgumentsDigest: () => pending });
    const connection = await helloV1(fixture);
    const frame = { kind: "arm_derived", sequence: 2, callOrdinal: 1, sessionIdDigest: SESSION_DIGEST_V1, callIdDigest: CALL_DIGEST_V1, argumentsDigest: digestV1("9") };
    const arming = connection.arm(frame);
    frame.sessionIdDigest = digestV1("e");
    frame.callIdDigest = digestV1("f");
    frame.argumentsDigest = digestV1("0");
    release(digestV1("9"));
    const token = await arming;
    expect(fixture.begin.mock.calls[0]?.[0]).toMatchObject({ sessionIdDigest: SESSION_DIGEST_V1, callIdDigest: CALL_DIGEST_V1, argumentsDigest: digestV1("9") });
    await connection.abort({ kind: "abort", sequence: 3, token });
  });

  it("does not permit a derived frame to replace a fixed argument commitment", async () => {
    const resolver = vi.fn(async () => digestV1("9"));
    const fixture = fixtureV1({ resolveArgumentsDigest: resolver });
    const connection = await helloV1(fixture);
    await expect(connection.arm({ kind: "arm_derived", sequence: 2, callOrdinal: 1, sessionIdDigest: SESSION_DIGEST_V1, callIdDigest: CALL_DIGEST_V1, argumentsDigest: digestV1("9") })).rejects.toEqual(expectCodeV1("invalid_frame"));
    expect(resolver).not.toHaveBeenCalled();
    expect(fixture.begin).not.toHaveBeenCalled();
  });

  it("binds the injected closing plan and projects only safe receipt digests", async () => {
    const privateSecret = "raw-private-provider-signature";
    let openedAgain: unknown;
    const complete = vi.fn<
      Step16HostCallWitnessAuthorityCallbacksInternalV1["complete"]
    >(async (_window, witness) => {
      expect(Object.keys(witness)).toEqual([]);
      expect(JSON.stringify(witness)).toBe("{}");
      const opened = openStep16HostCallWitnessCapabilityInternalV1(witness);
      expect(opened).toEqual({
        host: "codex",
        sessionIdDigest: SESSION_DIGEST_V1,
        callIdDigest: CALL_DIGEST_V1,
        expectedProviderOperations: [{
          operation: "write_object",
          operationNonce: "b".repeat(32),
          requestDigest: digestV1("5"),
        }],
      });
      openedAgain = openStep16HostCallWitnessCapabilityInternalV1(witness);
      return Object.freeze([
        bindingV1(RECEIPT_DIGEST_V1, { privateSecret }),
      ]);
    });
    const fixture = fixtureV1({ complete });
    const { connection, token } = await armV1(fixture);
    const operation = await observeV1(connection, token, 3);

    expect(token).toMatch(/^step16-window-v1:[0-9a-f]{64}$/u);
    expect(token).not.toContain(privateSecret);
    expect(fixture.begin).toHaveBeenCalledWith({
      host: "codex",
      runNonce: RUN_NONCE_V1,
      closingPlanDigest: fixture.plan.closingPlanDigest,
      callOrdinal: 1,
      eventOrdinal: 3,
      tool: "update_task",
      argumentsDigest: digestV1("4"),
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    });
    expect(Object.isFrozen(fixture.begin.mock.calls[0]![0])).toBe(true);
    expect(fixture.appendExpectedOperation).toHaveBeenCalledWith(
      expect.any(Object),
      operation,
    );
    const result = await connection.complete({
      kind: "complete",
      sequence: 4,
      token,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    });

    expect(result).toEqual({
      status: "completed",
      receiptBundleDigests: [RECEIPT_DIGEST_V1],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.receiptBundleDigests)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(privateSecret);
    expect(openedAgain).toBeUndefined();
    expect(fixture.abort).not.toHaveBeenCalled();
  });

  it.each(["sessionIdDigest", "callIdDigest"] as const)(
    "requires a valid arm %s before opening authority",
    async (field) => {
      for (const value of [undefined, "not-a-digest"]) {
        const fixture = fixtureV1();
        const connection = await helloV1(fixture);
        const frame: Record<string, unknown> = {
          kind: "arm",
          sequence: 2,
          callOrdinal: 1,
          sessionIdDigest: SESSION_DIGEST_V1,
          callIdDigest: CALL_DIGEST_V1,
        };
        if (value === undefined) delete frame[field];
        else frame[field] = value;
        await expect(connection.arm(frame)).rejects.toEqual(
          expectCodeV1("invalid_frame"),
        );
        expect(fixture.begin).not.toHaveBeenCalled();
      }
    },
  );

  it.each(["sessionIdDigest", "callIdDigest"] as const)(
    "rejects completion replacing the armed %s before authority complete",
    async (field) => {
      const fixture = fixtureV1();
      const { connection, token } = await armV1(fixture);
      await observeV1(connection, token, 3);
      const frame = {
        kind: "complete",
        sequence: 4,
        token,
        sessionIdDigest: SESSION_DIGEST_V1,
        callIdDigest: CALL_DIGEST_V1,
        [field]: digestV1("a"),
      };
      await expect(connection.complete(frame)).rejects.toEqual(
        expectCodeV1("invalid_frame"),
      );
      expect(fixture.complete).not.toHaveBeenCalled();
      expect(fixture.abort).toHaveBeenCalledTimes(1);
      await expect(connection.complete({ ...frame, sequence: 5 })).rejects
        .toEqual(expectCodeV1("connection_closed"));
    },
  );

  it("snapshots arm identity before awaiting the authority begin", async () => {
    let resolveBegin!: (
      value:
        ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1,
    ) => void;
    const begun = new Promise<
      ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1
    >((resolve) => {
      resolveBegin = resolve;
    });
    const fixture = fixtureV1();
    fixture.begin.mockImplementationOnce(async () => begun);
    const connection = await helloV1(fixture);
    const frame = {
      kind: "arm",
      sequence: 2,
      callOrdinal: 1,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    };
    const arming = connection.arm(frame);
    frame.sessionIdDigest = digestV1("a");
    frame.callIdDigest = digestV1("b");
    resolveBegin(Object.freeze(Object.create(null)) as
      ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1);
    const token = await arming;
    await observeV1(connection, token, 3);
    await expect(connection.complete({
      kind: "complete",
      sequence: 4,
      token,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    })).resolves.toMatchObject({ status: "completed" });
    expect(fixture.begin.mock.calls[0]![0]).toMatchObject({
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    });
  });

  it("aggregates three Provider operations in exact observed order", async () => {
    const fixture = fixtureV1();
    const { connection, token } = await armV1(fixture);
    const operations = [
      await observeV1(connection, token, 3, 0),
      await observeV1(connection, token, 4, 1),
      await observeV1(connection, token, 5, 2),
    ];

    const result = await connection.complete({
      kind: "complete",
      sequence: 6,
      token,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    });

    expect(result).toEqual({
      status: "completed",
      receiptBundleDigests: [
        RECEIPT_DIGEST_V1,
        digestV1("4"),
        digestV1("5"),
      ],
    });
    expect(fixture.appendExpectedOperation.mock.calls.map((call) => call[1]))
      .toEqual(operations);
  });

  it("caps all Provider operations across the closing plan before append 4097", async () => {
    const complete = vi.fn<
      Step16HostCallWitnessAuthorityCallbacksInternalV1["complete"]
    >(async (_window, witness) => {
      const opened = openStep16HostCallWitnessCapabilityInternalV1(witness);
      if (opened === undefined) throw new Error("missing witness");
      return Object.freeze(opened.expectedProviderOperations.map((_, index) =>
        indexedBindingV1(index + 1)
      ));
    });
    const fixture = fixtureV1({ calls: planCallsV1(3), complete });
    const connection = await helloV1(fixture);
    let sequence = 2;

    for (let callOrdinal = 1; callOrdinal <= 2; callOrdinal += 1) {
      const token = await connection.arm({
        kind: "arm",
        sequence: sequence++,
        callOrdinal,
        sessionIdDigest: SESSION_DIGEST_V1,
        callIdDigest: digestV1(callOrdinal === 1 ? "2" : "9"),
      });
      let lastObserved: Awaited<
        ReturnType<typeof connection.observeProviderOperation>
      > | undefined;
      for (let index = 0; index < 2_048; index += 1) {
        lastObserved = await connection.observeProviderOperation({
          kind: "observe_provider_operation",
          sequence: sequence++,
          token,
          ...indexedOperationV1(index),
        });
      }
      expect(lastObserved).toEqual({
        status: "observed",
        operationOrdinal: 2_048,
      });
      await connection.complete({
        kind: "complete",
        sequence: sequence++,
        token,
        sessionIdDigest: SESSION_DIGEST_V1,
        callIdDigest: digestV1(callOrdinal === 1 ? "2" : "9"),
      });
    }

    const thirdToken = await connection.arm({
      kind: "arm",
      sequence: sequence++,
      callOrdinal: 3,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: digestV1("a"),
    });
    await expect(connection.observeProviderOperation({
      kind: "observe_provider_operation",
      sequence,
      token: thirdToken,
      ...indexedOperationV1(2_048),
    })).rejects.toEqual(expectCodeV1("invalid_frame"));

    expect(fixture.appendExpectedOperation).toHaveBeenCalledTimes(4_096);
    expect(fixture.complete).toHaveBeenCalledTimes(2);
    expect(fixture.abort).toHaveBeenCalledTimes(1);
    await expect(fixture.server.close()).rejects.toEqual(
      expectCodeV1("connection_failed"),
    );
  });

  it("rejects zero-operation completion and aborts the aggregate", async () => {
    const fixture = fixtureV1();
    const { connection, token } = await armV1(fixture);

    await expect(connection.complete({
      kind: "complete",
      sequence: 3,
      token,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    })).rejects.toEqual(expectCodeV1("incomplete_plan"));
    expect(fixture.abort).toHaveBeenCalledTimes(1);
    expect(fixture.complete).not.toHaveBeenCalled();
  });

  it("rejects a duplicate operation nonce before a second append", async () => {
    const fixture = fixtureV1();
    const { connection, token } = await armV1(fixture);
    const operation = await observeV1(connection, token, 3);

    await expect(connection.observeProviderOperation({
      kind: "observe_provider_operation",
      sequence: 4,
      token,
      ...operation,
    })).rejects.toEqual(expectCodeV1("invalid_frame"));
    expect(fixture.appendExpectedOperation).toHaveBeenCalledTimes(1);
    expect(fixture.abort).toHaveBeenCalledTimes(1);
  });

  it("aborts the aggregate on a wrong observe token", async () => {
    const fixture = fixtureV1();
    const { connection } = await armV1(fixture);

    await expect(connection.observeProviderOperation({
      kind: "observe_provider_operation",
      sequence: 3,
      token: `step16-window-v1:${"f".repeat(64)}`,
      ...operationV1(),
    })).rejects.toEqual(expectCodeV1("replayed_token"));
    expect(fixture.appendExpectedOperation).not.toHaveBeenCalled();
    expect(fixture.abort).toHaveBeenCalledTimes(1);
  });

  it("burns the token when authority append rejects", async () => {
    const fixture = fixtureV1({
      appendExpectedOperation: async () => {
        throw new Error("append rejected");
      },
    });
    const { connection, token } = await armV1(fixture);

    await expect(connection.observeProviderOperation({
      kind: "observe_provider_operation",
      sequence: 3,
      token,
      ...operationV1(),
    })).rejects.toEqual(expectCodeV1("authority_failed"));
    expect(fixture.abort).toHaveBeenCalledTimes(1);
    await expect(connection.complete({
      kind: "complete",
      sequence: 4,
      token,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    })).rejects.toEqual(expectCodeV1("connection_closed"));
  });

  it("fails both sides of concurrent append and complete", async () => {
    let resolveAppend!: () => void;
    const pendingAppend = new Promise<void>((resolve) => {
      resolveAppend = resolve;
    });
    const fixture = fixtureV1({
      appendExpectedOperation: async () => pendingAppend,
    });
    const { connection, token } = await armV1(fixture);
    const observing = connection.observeProviderOperation({
      kind: "observe_provider_operation",
      sequence: 3,
      token,
      ...operationV1(),
    });

    await expect(connection.complete({
      kind: "complete",
      sequence: 4,
      token,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    })).rejects.toEqual(expectCodeV1("connection_busy"));
    resolveAppend();
    await expect(observing).rejects.toEqual(
      expectCodeV1("connection_closed"),
    );
    expect(fixture.abort).toHaveBeenCalledTimes(1);
  });

  it("rejects legacy expected operations inside the root closing plan", () => {
    const call = planCallsV1()[0]!;
    const forgedCalls = Object.freeze([Object.freeze({
      ...call,
      expectedProviderOperations: [operationV1()],
    })]) as unknown as
      readonly Step16HostCallWitnessClosingPlanCallInternalV1[];

    expect(() => fixtureV1({ calls: forgedCalls })).toThrow(
      expectCodeV1("invalid_closing_plan"),
    );
  });

  it("rejects non-root, wrong direct-supervisor PID, and an unheld lease", () => {
    expect(() => fixtureV1().server.accept({ uid: 501, pid: 777 }))
      .toThrow(expectCodeV1("invalid_peer"));
    expect(() => fixtureV1().server.accept({ uid: 0, pid: 778 }))
      .toThrow(expectCodeV1("invalid_peer"));
    expect(() => fixtureV1({ leaseHeld: false }).server.accept({
      uid: 0,
      pid: 777,
    })).toThrow(expectCodeV1("invalid_peer"));
  });

  it("rechecks the supervisor lease and aborts an armed authority window", async () => {
    const fixture = fixtureV1();
    const { connection, token } = await armV1(fixture);
    fixture.loseLease();

    await expect(connection.complete({
      kind: "complete",
      sequence: 3,
      token,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    })).rejects.toEqual(expectCodeV1("lease_lost"));
    await vi.waitFor(() => expect(fixture.abort).toHaveBeenCalledTimes(1));
    expect(fixture.complete).not.toHaveBeenCalled();
  });

  it("burns a completed token before a replay can be parsed", async () => {
    const fixture = fixtureV1();
    const { connection, token } = await armV1(fixture);
    await observeV1(connection, token, 3);
    await connection.complete({
      kind: "complete",
      sequence: 4,
      token,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    });

    await expect(connection.complete({
      kind: "complete",
      sequence: 5,
      token,
      sessionIdDigest: "not-a-digest",
      callIdDigest: "not-a-digest",
    })).rejects.toEqual(expectCodeV1("replayed_token"));
    expect(fixture.complete).toHaveBeenCalledTimes(1);
  });

  it("aborts the real active window when a different token is supplied", async () => {
    const fixture = fixtureV1();
    const { connection } = await armV1(fixture);

    await expect(connection.complete({
      kind: "complete",
      sequence: 3,
      token: `step16-window-v1:${"f".repeat(64)}`,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    })).rejects.toEqual(expectCodeV1("replayed_token"));
    expect(fixture.abort).toHaveBeenCalledTimes(1);
    expect(fixture.complete).not.toHaveBeenCalled();
  });

  it("fails the connection on an out-of-order frame", async () => {
    const fixture = fixtureV1();
    const connection = await helloV1(fixture);

    await expect(connection.arm({
      kind: "arm",
      sequence: 4,
      callOrdinal: 1,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    })).rejects.toEqual(expectCodeV1("out_of_order"));
    expect(fixture.begin).not.toHaveBeenCalled();
    await expect(connection.arm({
      kind: "arm",
      sequence: 2,
      callOrdinal: 1,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    })).rejects.toEqual(expectCodeV1("connection_closed"));
  });

  it("aborts an active aggregate on an out-of-order observation", async () => {
    const fixture = fixtureV1();
    const { connection, token } = await armV1(fixture);

    await expect(connection.observeProviderOperation({
      kind: "observe_provider_operation",
      sequence: 4,
      token,
      ...operationV1(),
    })).rejects.toEqual(expectCodeV1("out_of_order"));
    await vi.waitFor(() => expect(fixture.abort).toHaveBeenCalledTimes(1));
    expect(fixture.appendExpectedOperation).not.toHaveBeenCalled();
  });

  it.each(["disconnect", "timeout"] as const)(
    "%s aborts the active window and closes the connection",
    async (action) => {
      const fixture = fixtureV1();
      const { connection, token } = await armV1(fixture);
      await connection[action]();

      expect(fixture.abort).toHaveBeenCalledTimes(1);
      await expect(connection.complete({
        kind: "complete",
        sequence: 3,
        token,
        sessionIdDigest: SESSION_DIGEST_V1,
        callIdDigest: CALL_DIGEST_V1,
      })).rejects.toEqual(expectCodeV1("connection_closed"));
      await expect(fixture.server.close()).rejects.toEqual(
        expectCodeV1("connection_failed"),
      );
    },
  );

  it("burns the token and witness when authority completion fails", async () => {
    let capturedWitness: Parameters<
      Step16HostCallWitnessAuthorityCallbacksInternalV1["complete"]
    >[1] | undefined;
    const fixture = fixtureV1({
      complete: async (_window, witness) => {
        capturedWitness = witness;
        throw new Error("sensitive authority failure");
      },
    });
    const { connection, token } = await armV1(fixture);
    await observeV1(connection, token, 3);

    await expect(connection.complete({
      kind: "complete",
      sequence: 4,
      token,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    })).rejects.toEqual(expectCodeV1("authority_failed"));
    expect(fixture.abort).toHaveBeenCalledTimes(1);
    expect(capturedWitness).toBeDefined();
    expect(openStep16HostCallWitnessCapabilityInternalV1(capturedWitness!))
      .toBeUndefined();
    await expect(connection.complete({
      kind: "complete",
      sequence: 5,
      token,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    })).rejects.toEqual(expectCodeV1("connection_closed"));
    expect(fixture.complete).toHaveBeenCalledTimes(1);
    await expect(fixture.server.close()).rejects.toEqual(
      expectCodeV1("connection_failed"),
    );
  });

  it("fails close with a pending window and prevents another connection", async () => {
    const fixture = fixtureV1();
    await armV1(fixture);

    await expect(fixture.server.close()).rejects.toEqual(
      expectCodeV1("pending_window"),
    );
    expect(fixture.abort).toHaveBeenCalledTimes(1);
    expect(() => fixture.server.accept({ uid: 0, pid: 777 }))
      .toThrow(expectCodeV1("invalid_peer"));
  });

  it("rejects close without a connection or before any planned call completes", async () => {
    const noConnection = fixtureV1();
    await expect(noConnection.server.close()).rejects.toEqual(
      expectCodeV1("incomplete_plan"),
    );

    const zeroOfOne = fixtureV1();
    await helloV1(zeroOfOne);
    await expect(zeroOfOne.server.close()).rejects.toEqual(
      expectCodeV1("incomplete_plan"),
    );
  });

  it("rejects close after only a strict prefix of a multi-call plan", async () => {
    const finalizeRun = vi.fn(async () => undefined);
    const fixture = fixtureV1({ calls: planCallsV1(2), finalizeRun });
    const { connection, token } = await armV1(fixture);
    await observeV1(connection, token, 3);
    await connection.complete({
      kind: "complete",
      sequence: 4,
      token,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    });

    await expect(fixture.server.close()).rejects.toEqual(
      expectCodeV1("incomplete_plan"),
    );
    expect(finalizeRun).not.toHaveBeenCalled();
  });

  it("closes only after every planned call completed successfully", async () => {
    const finalizeRun = vi.fn(async () => undefined);
    const fixture = fixtureV1({ calls: planCallsV1(2), finalizeRun });
    const { connection, token: firstToken } = await armV1(fixture);
    await observeV1(connection, firstToken, 3);
    await connection.complete({
      kind: "complete",
      sequence: 4,
      token: firstToken,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    });
    const secondToken = await connection.arm({
      kind: "arm",
      sequence: 5,
      callOrdinal: 2,
      sessionIdDigest: digestV1("8"),
      callIdDigest: digestV1("9"),
    });
    await observeV1(connection, secondToken, 6);
    await connection.complete({
      kind: "complete",
      sequence: 7,
      token: secondToken,
      sessionIdDigest: digestV1("8"),
      callIdDigest: digestV1("9"),
    });

    await expect(fixture.server.close()).resolves.toBeUndefined();
    await expect(fixture.server.close()).resolves.toBeUndefined();
    expect(fixture.complete).toHaveBeenCalledTimes(2);
    expect(finalizeRun).toHaveBeenCalledExactlyOnceWith({
      runNonce: RUN_NONCE_V1,
      closingPlanDigest: fixture.plan.closingPlanDigest,
      callCount: 2,
    });
  });

  it("fails closed if durable run finalization rejects and does not retry it", async () => {
    const finalizeRun = vi.fn(async () => { throw new Error("durable finalization failed"); });
    const fixture = fixtureV1({ finalizeRun });
    const { connection, token } = await armV1(fixture);
    await observeV1(connection, token, 3);
    await connection.complete({ kind: "complete", sequence: 4, token,
      sessionIdDigest: SESSION_DIGEST_V1, callIdDigest: CALL_DIGEST_V1 });
    await expect(fixture.server.close()).rejects.toEqual(expectCodeV1("authority_failed"));
    await expect(fixture.server.close()).rejects.toEqual(expectCodeV1("authority_failed"));
    expect(finalizeRun).toHaveBeenCalledTimes(1);
  });

  it("awaits durable run finalization and rejects lease loss while it is pending", async () => {
    let finish!: () => void;
    const finalizeRun = vi.fn(async () => new Promise<void>((resolve) => { finish = resolve; }));
    const fixture = fixtureV1({ finalizeRun });
    const { connection, token } = await armV1(fixture);
    await observeV1(connection, token, 3);
    await connection.complete({ kind: "complete", sequence: 4, token,
      sessionIdDigest: SESSION_DIGEST_V1, callIdDigest: CALL_DIGEST_V1 });
    const closing = fixture.server.close();
    const settled = vi.fn();
    void closing.then(settled, settled);
    await Promise.resolve();
    expect(finalizeRun).toHaveBeenCalledTimes(1);
    expect(settled).not.toHaveBeenCalled();
    fixture.loseLease();
    finish();
    await expect(closing).rejects.toEqual(expectCodeV1("connection_closed"));
  });

  it("fails closed when authority rejects an extra pending operation", async () => {
    const fixture = fixtureV1({
      complete: async (_window, witness) => {
        expect(openStep16HostCallWitnessCapabilityInternalV1(witness))
          .toBeDefined();
        throw new Error("authority observed a pending operation");
      },
    });
    const { connection, token } = await armV1(fixture);
    await observeV1(connection, token, 3);

    await expect(connection.complete({
      kind: "complete",
      sequence: 4,
      token,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    })).rejects.toEqual(expectCodeV1("authority_failed"));
  });

  it("fails both concurrent windows and aborts a late begin result", async () => {
    let resolveBegin!: (
      value:
        ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1,
    ) => void;
    const begun = new Promise<
      ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1
    >((resolve) => {
      resolveBegin = resolve;
    });
    const fixture = fixtureV1();
    fixture.begin.mockImplementationOnce(async () => begun);
    const connection = await helloV1(fixture);
    const first = connection.arm({
      kind: "arm",
      sequence: 2,
      callOrdinal: 1,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    });

    await expect(connection.arm({
      kind: "arm",
      sequence: 3,
      callOrdinal: 1,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    })).rejects.toEqual(expectCodeV1("connection_busy"));
    resolveBegin(Object.freeze(Object.create(null)) as
      ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1);
    await expect(first).rejects.toEqual(expectCodeV1("connection_closed"));
    expect(fixture.abort).toHaveBeenCalledTimes(1);
  });

  it("rejects caller-supplied trusted identity or operation data", async () => {
    const fixture = fixtureV1();
    const connection = await helloV1(fixture);

    await expect(connection.arm({
      kind: "arm",
      sequence: 2,
      callOrdinal: 1,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
      uid: 0,
      host: "codex",
      expectedProviderOperations: [operationV1()],
    })).rejects.toEqual(expectCodeV1("invalid_frame"));
    expect(fixture.begin).not.toHaveBeenCalled();
  });

  it("explicit abort burns the token and closes the connection", async () => {
    const fixture = fixtureV1();
    const { connection, token } = await armV1(fixture);

    await expect(connection.abort({
      kind: "abort",
      sequence: 3,
      token,
    })).resolves.toEqual({ status: "aborted" });
    expect(fixture.abort).toHaveBeenCalledTimes(1);
    await expect(connection.complete({
      kind: "complete",
      sequence: 4,
      token,
      sessionIdDigest: SESSION_DIGEST_V1,
      callIdDigest: CALL_DIGEST_V1,
    })).rejects.toEqual(expectCodeV1("connection_closed"));
    await expect(fixture.server.close()).rejects.toEqual(
      expectCodeV1("connection_failed"),
    );
  });

  it("does not permit a second connection after a protocol failure", async () => {
    const fixture = fixtureV1();
    const connection = fixture.server.accept({ uid: 0, pid: 777 });
    await expect(connection.hello({
      kind: "hello",
      sequence: 1,
      closingPlanDigest: digestV1("f"),
      runNonce: fixture.plan.runNonce,
    })).rejects.toBeInstanceOf(Step16HostCallWitnessProtocolErrorInternalV1);
    expect(() => fixture.server.accept({ uid: 0, pid: 777 }))
      .toThrow(expectCodeV1("invalid_peer"));
  });
});
