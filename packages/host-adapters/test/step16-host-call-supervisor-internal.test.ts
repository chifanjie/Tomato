import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const execution = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("../src/real-host-executor.js", () => ({ runStep16RealHostJsonlSessionWithSupervisorInternalV1: execution.run }));

import type { RunStep16RealHostJsonlSessionV1Input, RunStep16RealHostJsonlSessionWithSupervisorInternalV1Options, Step16RealHostJsonlSessionResultV1 } from "../src/real-host-executor.js";
import { canonicalRealHostJsonInternalV1, digestRealHostJsonInternalV1 } from "../src/real-host-receipt-primitives-internal.js";
import { deriveStep16ExpectedHostEventPlanDigestV1, type RealHostReceiptHostV1 } from "../src/real-host-receipts.js";
import {
  createStep16HostCallSupervisorInternalV1,
  type Step16HostCallSupervisorInternalV1,
  type Step16HostCallSupervisorPlanInternalV1,
  type Step16HostCallSupervisorWitnessClientInternalV1,
} from "../src/step16-host-call-supervisor-internal.js";

const CHILD = { childIdentity: { uid: 1025, gid: 1025 } };
const supervisors: Step16HostCallSupervisorInternalV1[] = [];
const sha = (character: string): `sha256:${string}` => `sha256:${character.repeat(64)}`;

function plan(hosts: readonly RealHostReceiptHostV1[] = ["codex"], callsPerHost = 1): Step16HostCallSupervisorPlanInternalV1 {
  const calls = hosts.flatMap((host) => Array.from({ length: callsPerHost }, (_value, index) => ({ host, tool: "update_task", argumentsDigest: digestRealHostJsonInternalV1({ step: index + 1 }) }))).map((call, index) => ({ callOrdinal: index + 1, eventOrdinal: index + 1, ...call }));
  return withDigest(calls);
}

function withDigest(calls: Step16HostCallSupervisorPlanInternalV1["calls"]): Step16HostCallSupervisorPlanInternalV1 {
  const runNonce = "a".repeat(64);
  const closingPlanDigest = `sha256:${createHash("sha256").update(canonicalRealHostJsonInternalV1(["understand-code-step16-host-call-closing-plan-v1", { runNonce, calls }])).digest("hex")}`;
  return { runNonce, closingPlanDigest, calls };
}

function input(host: RealHostReceiptHostV1 = "codex", count = 1): RunStep16RealHostJsonlSessionV1Input {
  const events = Array.from({ length: count }, (_value, index) => ({ kind: "mcp_tool_call" as const, ordinal: index + 1, server: "understand-code" as const, tool: "update_task" as const }));
  return { host, executable: "/root/controlled-host", expectedExecutableDigest: sha("e"), cwd: "/root/repository", prompt: "root-owned prompt", env: {}, expectedEventPlan: { events, expectedEventPlanDigest: deriveStep16ExpectedHostEventPlanDigestV1(events) }, expectedHostActionInputs: [] };
}

function fixture(closingPlan = plan(), operationWaitMs = 100) {
  const external = new AbortController();
  let operationCount = 0;
  const client = {
    arm: vi.fn<Step16HostCallSupervisorWitnessClientInternalV1["arm"]>(async (ordinal) => { operationCount = 0; return `step16-window-v1:${String(ordinal).repeat(64)}`; }),
    observe: vi.fn<Step16HostCallSupervisorWitnessClientInternalV1["observe"]>(async () => { operationCount += 1; }),
    complete: vi.fn<Step16HostCallSupervisorWitnessClientInternalV1["complete"]>(async () => ({ status: "completed", receiptBundleDigests: Array.from({ length: operationCount }, (_value, index) => sha(String(index + 1))) })),
    finalize: vi.fn<Step16HostCallSupervisorWitnessClientInternalV1["finalize"]>(async () => ({ opaqueFinalResult: true })),
    close: vi.fn<Step16HostCallSupervisorWitnessClientInternalV1["close"]>(async () => undefined),
  };
  const supervisor = createStep16HostCallSupervisorInternalV1({ closingPlan, witnessClient: client, signal: external.signal, operationWaitMs });
  supervisors.push(supervisor);
  let sequence = 0;
  const observe = () => {
    sequence += 1;
    return supervisor.observeProviderOperation({ operation: "write_object", operationNonce: sequence.toString(16).padStart(32, "0"), requestDigest: sha("b") }, { operationSequence: sequence, signal: external.signal });
  };
  return { supervisor, client, external, observe };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

/** The module's executor import is mocked; its actual stream observer is not. */
async function drive(
  value: RunStep16RealHostJsonlSessionV1Input,
  options: RunStep16RealHostJsonlSessionWithSupervisorInternalV1Options,
  hooks: Readonly<{
    beforeStart?: (ordinal: number) => void | Promise<void>;
    operation?: (ordinal: number) => void | Promise<void>;
    afterComplete?: (ordinal: number) => void | Promise<void>;
    beforeReturn?: () => void | Promise<void>;
    wrongArguments?: boolean;
  }> = {},
): Promise<Step16RealHostJsonlSessionResultV1> {
  const session = `private-${value.host}-${value.env.TEST_SESSION_SALT ?? "session"}`;
  const signal = options.signal!;
  const feed = async (raw: unknown) => {
    const event = options.streamObserver.feed(JSON.stringify(raw));
    if (event !== undefined) await options.onObservedCall(event, signal);
  };
  if (value.host === "codex") {
    await feed({ type: "thread.started", thread_id: session });
    await feed({ type: "turn.started" });
  } else await feed({ type: "system", subtype: "init", session_id: session });
  for (const expected of value.expectedEventPlan.events) {
    if (expected.kind !== "mcp_tool_call") throw new Error("test only supplies MCP calls");
    const id = `private-${value.host}-call-${expected.ordinal}`;
    const args = { step: hooks.wrongArguments ? 999 : expected.ordinal };
    await hooks.beforeStart?.(expected.ordinal);
    if (value.host === "codex") {
      await feed({ type: "item.started", item: { id, type: "mcp_tool_call", server: "understand-code", tool: expected.tool, arguments: args, status: "in_progress", result: null, error: null } });
    } else await feed({ type: "assistant", session_id: session, parent_tool_use_id: null, message: { role: "assistant", content: [{ type: "tool_use", id, name: `mcp__understand-code__${expected.tool}`, input: args }] } });
    await hooks.operation?.(expected.ordinal);
    if (value.host === "codex") {
      await feed({ type: "item.completed", item: { id, type: "mcp_tool_call", server: "understand-code", tool: expected.tool, arguments: args, status: "completed", result: { content: [{ type: "text", text: "private result" }], structured_content: { ok: true } }, error: null } });
    } else await feed({ type: "user", session_id: session, parent_tool_use_id: null, message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: "private result" }] }, tool_use_result: { ok: true } });
    await hooks.afterComplete?.(expected.ordinal);
  }
  if (value.host === "codex") await feed({ type: "turn.completed" });
  else await feed({ type: "result", subtype: "success", session_id: session, is_error: false, permission_denials: [] });
  await hooks.beforeReturn?.();
  return { receipt: options.streamObserver.finish(), rawTranscriptDigest: sha("c"), stderrDigest: sha("d"), executableDigest: sha("e"), exit: { code: 0, signal: null } };
}

async function rejected(work: Promise<unknown>): Promise<void> { await expect(work).rejects.toMatchObject({ code: "host_call_supervision_failed" }); }

afterEach(async () => {
  await Promise.all(supervisors.splice(0).map((supervisor) => supervisor.close()));
  execution.run.mockReset();
});

describe("root-owned Host call supervision", () => {
  it("runs the owned executor, arms actual stream starts, and finalizes only after its successful return", async () => {
    const test = fixture();
    execution.run.mockImplementation((value, options) => drive(value, options, { operation: test.observe }));
    const result = await test.supervisor.run(input(), CHILD);
    const options = execution.run.mock.calls[0]![1];
    expect(options.onObservedCall).toBe(test.supervisor.onObservedCall);
    expect(options.signal).toBe(test.supervisor.signal);
    expect(options.childIdentity).toEqual(CHILD.childIdentity);
    expect(test.client.arm).toHaveBeenCalledWith(1, result.receipt.sessionIdDigest, result.receipt.events[0]?.kind === "mcp_tool_call" ? result.receipt.events[0].callIdDigest : undefined, test.supervisor.signal);
    expect(test.client.observe).toHaveBeenCalledOnce();
    expect(test.client.complete).toHaveBeenCalledOnce();
    expect(test.client.finalize).not.toHaveBeenCalled();
    expect(await test.supervisor.finalize()).toEqual({ opaqueFinalResult: true });
  });

  it("maps session-local ordinals from two sequential Hosts to one global closing plan", async () => {
    const test = fixture(plan(["codex", "claude"]));
    execution.run.mockImplementation((value, options) => drive(value, options, { operation: test.observe }));
    await test.supervisor.run(input("codex"), CHILD);
    await test.supervisor.run(input("claude"), CHILD);
    await test.supervisor.finalize();
    expect(test.client.arm.mock.calls.map((call) => call[0])).toEqual([1, 2]);
    expect(test.client.finalize).toHaveBeenCalledOnce();
  });

  it("keeps same-Host call IDs scoped to their real sessions while advancing global ordinals", async () => {
    const test = fixture(plan(["codex", "codex"]));
    execution.run.mockImplementation((value, options) => drive(value, options, { operation: test.observe }));
    await test.supervisor.run({ ...input(), env: { TEST_SESSION_SALT: "one" } }, CHILD);
    await test.supervisor.run({ ...input(), env: { TEST_SESSION_SALT: "two" } }, CHILD);
    await test.supervisor.finalize();
    expect(test.client.arm.mock.calls.map((call) => call[0])).toEqual([1, 2]);
    expect(test.client.arm.mock.calls[0]![1]).not.toBe(test.client.arm.mock.calls[1]![1]);
    expect(test.client.arm.mock.calls[0]![2]).toBe(test.client.arm.mock.calls[1]![2]);
  });

  it("advances the global offset by all successful session events, not only strong calls", async () => {
    const base = plan(["codex", "claude"]);
    const test = fixture(withDigest([
      { ...base.calls[0]!, eventOrdinal: 2, argumentsDigest: digestRealHostJsonInternalV1({ step: 2 }) },
      { ...base.calls[1]!, eventOrdinal: 3 },
    ]));
    const first = input("codex", 2);
    const events = [
      { kind: "mcp_tool_call" as const, ordinal: 1, server: "understand-code" as const, tool: "get_repo_pulse" as const },
      first.expectedEventPlan.events[1]!,
    ];
    execution.run.mockImplementation((value, options) => drive(value, options, { operation: (ordinal) => value.host === "codex" && ordinal === 1 ? undefined : test.observe() }));
    await test.supervisor.run({ ...first, expectedEventPlan: { events, expectedEventPlanDigest: deriveStep16ExpectedHostEventPlanDigestV1(events) } }, CHILD);
    await test.supervisor.run(input("claude"), CHILD);
    await test.supervisor.finalize();
    expect(test.client.arm.mock.calls.map((call) => call[0])).toEqual([1, 2]);
  });

  it("holds a first operation until the actual start and arm ACK have both arrived", async () => {
    const test = fixture();
    const arm = deferred<string>();
    test.client.arm.mockImplementation(() => arm.promise);
    execution.run.mockImplementation((value, options) => {
      const firstOperation = test.observe();
      expect(test.client.observe).not.toHaveBeenCalled();
      return drive(value, options, { operation: () => firstOperation });
    });
    const running = test.supervisor.run(input(), CHILD);
    await vi.waitFor(() => expect(test.client.arm).toHaveBeenCalledOnce());
    expect(test.client.observe).not.toHaveBeenCalled();
    arm.resolve(`step16-window-v1:${"1".repeat(64)}`);
    await running;
    expect(test.client.observe).toHaveBeenCalledOnce();
  });

  it("allows multiple sequential Provider operations inside one captured call", async () => {
    const test = fixture();
    execution.run.mockImplementation((value, options) => drive(value, options, { operation: async () => { await test.observe(); await test.observe(); } }));
    await test.supervisor.run(input(), CHILD);
    expect(test.client.observe).toHaveBeenCalledTimes(2);
    expect(test.client.complete).toHaveBeenCalledOnce();
  });

  it("never moves a between-calls late operation into the next window", async () => {
    const test = fixture(plan(["codex"], 2));
    execution.run.mockImplementation((value, options) => drive(value, options, { operation: test.observe, afterComplete: async (ordinal) => { if (ordinal === 1) await test.observe(); } }));
    await rejected(test.supervisor.run(input("codex", 2), CHILD));
    expect(test.client.arm).toHaveBeenCalledOnce();
    expect(test.client.observe).toHaveBeenCalledOnce();
    expect(test.supervisor.signal.aborted).toBe(true);
  });

  it("rejects duplicate operation nonces rather than binding a replay to a new call", async () => {
    const test = fixture(plan(["codex"], 2));
    let sequence = 0;
    execution.run.mockImplementation((value, options) => drive(value, options, { operation: () => test.supervisor.observeProviderOperation({ operation: "write_object", operationNonce: "1".repeat(32), requestDigest: sha("b") }, { operationSequence: ++sequence, signal: test.external.signal }) }));
    await rejected(test.supervisor.run(input("codex", 2), CHILD));
    expect(test.client.observe).toHaveBeenCalledOnce();
  });

  it("rejects a strong complete without an observed Provider operation", async () => {
    const test = fixture();
    execution.run.mockImplementation((value, options) => drive(value, options));
    await rejected(test.supervisor.run(input(), CHILD));
    expect(test.client.complete).not.toHaveBeenCalled();
  });

  it("rejects a real start whose arguments do not match the fixed closing plan", async () => {
    const test = fixture();
    execution.run.mockImplementation((value, options) => drive(value, options, { wrongArguments: true }));
    await rejected(test.supervisor.run(input(), CHILD));
    expect(test.client.arm).not.toHaveBeenCalled();
  });

  it("does not accept external observations or a hand-delivered success proof outside run", async () => {
    const test = fixture();
    await rejected(test.supervisor.finalize());
    expect(test.client.finalize).not.toHaveBeenCalled();
    expect(execution.run).not.toHaveBeenCalled();
    expect(test.supervisor).not.toHaveProperty("finalizeAfterExecution");
  });

  it("refuses finalization while the executor still owns the session even after every call completed", async () => {
    const test = fixture();
    const eof = deferred<void>();
    const reached = deferred<void>();
    execution.run.mockImplementation((value, options) => drive(value, options, { operation: test.observe, beforeReturn: () => { reached.resolve(); return eof.promise; } }));
    const running = rejected(test.supervisor.run(input(), CHILD));
    await reached.promise;
    await rejected(test.supervisor.finalize());
    await running;
    eof.resolve();
    expect(test.client.finalize).not.toHaveBeenCalled();
  });

  it("invalidates successful-looking executor output if the paired receipt changed", async () => {
    const test = fixture();
    execution.run.mockImplementation(async (value, options) => {
      const result = await drive(value, options, { operation: test.observe });
      return { ...result, receipt: { ...result.receipt, sessionIdDigest: sha("9") } };
    });
    await rejected(test.supervisor.run(input(), CHILD));
    expect(test.client.finalize).not.toHaveBeenCalled();
  });

  it("cannot finalize a partial closing plan after one successful Host", async () => {
    const test = fixture(plan(["codex", "claude"]));
    execution.run.mockImplementation((value, options) => drive(value, options, { operation: test.observe }));
    await test.supervisor.run(input(), CHILD);
    await rejected(test.supervisor.finalize());
    expect(test.client.finalize).not.toHaveBeenCalled();
  });

  it("times out a first operation that never receives a real start", async () => {
    const test = fixture(plan(), 20);
    execution.run.mockImplementation(async () => { await test.observe(); return new Promise(() => undefined); });
    await rejected(test.supervisor.run(input(), CHILD));
    expect(test.client.arm).not.toHaveBeenCalled();
    expect(test.client.observe).not.toHaveBeenCalled();
  });

  it.each(["arm", "observe", "complete"] as const)("aborts the whole Host run when witness %s rejects", async (method) => {
    const test = fixture();
    test.client[method].mockRejectedValue(new Error("private witness details"));
    execution.run.mockImplementation((value, options) => drive(value, options, { operation: test.observe }));
    await rejected(test.supervisor.run(input(), CHILD));
    expect(test.supervisor.signal.aborted).toBe(true);
    await test.supervisor.close();
    expect(test.client.close).toHaveBeenCalledOnce();
  });

  it("ignores an arm ACK arriving after cancellation and never observes the waiting operation", async () => {
    const test = fixture();
    const arm = deferred<string>();
    test.client.arm.mockImplementation(() => arm.promise);
    execution.run.mockImplementation((value, options) => drive(value, options, { operation: test.observe }));
    const running = rejected(test.supervisor.run(input(), CHILD));
    await vi.waitFor(() => expect(test.client.arm).toHaveBeenCalledOnce());
    test.external.abort();
    await running;
    arm.resolve(`step16-window-v1:${"1".repeat(64)}`);
    await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
    expect(test.client.observe).not.toHaveBeenCalled();
    expect(test.client.complete).not.toHaveBeenCalled();
  });

  it("closes a silent hung executor within the configured bound and handles its late rejection", async () => {
    const test = fixture(plan(), 20);
    const hung = deferred<Step16RealHostJsonlSessionResultV1>();
    execution.run.mockImplementation(() => hung.promise);
    const running = rejected(test.supervisor.run(input(), CHILD));
    const started = Date.now();
    await test.supervisor.close();
    expect(Date.now() - started).toBeLessThan(200);
    await running;
    expect(execution.run.mock.calls[0]![1].signal.aborted).toBe(true);
    hung.reject(new Error("late executor failure"));
    await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
  });

  it.each(["onObservedCall", "eventOffset"])("rejects caller-supplied %s before spawning", async (key) => {
    const test = fixture();
    await rejected(test.supervisor.run(input(), { ...CHILD, [key]: () => undefined } as typeof CHILD));
    expect(execution.run).not.toHaveBeenCalled();
  });

  it("refuses a changed closing-plan digest before accepting root capabilities", () => {
    const test = fixture();
    expect(() => createStep16HostCallSupervisorInternalV1({ closingPlan: { ...plan(), closingPlanDigest: sha("0") }, witnessClient: test.client, signal: test.external.signal })).toThrow();
  });

  it("rejects a reset closing-plan ordinal even when its digest is consistent", () => {
    const test = fixture();
    const base = plan(["codex", "claude"]);
    const reset = withDigest([base.calls[0]!, { ...base.calls[1]!, eventOrdinal: 1 }]);
    expect(() => createStep16HostCallSupervisorInternalV1({ closingPlan: reset, witnessClient: test.client, signal: test.external.signal })).toThrow();
  });
});
