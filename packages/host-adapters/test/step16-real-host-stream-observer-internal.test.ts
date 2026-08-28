import { describe, expect, it } from "vitest";

import {
  createStep16RealHostStreamObserverInternalV1,
  type Step16RealHostObservedCallInternalV1,
} from "../src/step16-real-host-stream-observer-internal.js";
import {
  RealHostReceiptNormalizationError,
  deriveStep16ExpectedHostEventPlanDigestV1,
  deriveStep16RealHostActionInputDigestV1,
  normalizeStep16RealHostJsonlTranscriptV1,
  type RealHostReceiptHostV1,
  type Step16ExpectedHostEventPlanV1,
  type Step16ExpectedHostEventV1,
} from "../src/real-host-receipts.js";

type RawEventV1 = Readonly<Record<string, unknown>>;

const MCP_EVENT_V1 = Object.freeze({
  kind: "mcp_tool_call",
  ordinal: 1,
  server: "understand-code",
  tool: "get_repo_pulse",
} as const);

function planV1(
  events: readonly Step16ExpectedHostEventV1[] = [MCP_EVENT_V1],
): Step16ExpectedHostEventPlanV1 {
  return Object.freeze({
    expectedEventPlanDigest: deriveStep16ExpectedHostEventPlanDigestV1(events),
    events: Object.freeze(events),
  });
}

function linesV1(events: readonly RawEventV1[]): readonly string[] {
  return events.map((event) => JSON.stringify(event));
}

function transcriptV1(events: readonly RawEventV1[]): string {
  return `${linesV1(events).join("\n")}\n`;
}

function codexMcpPairV1(
  id: string,
  tool = "get_repo_pulse",
  args: Readonly<Record<string, unknown>> = { root: "/private/repository" },
): readonly RawEventV1[] {
  return [
    {
      type: "item.started",
      item: {
        id,
        type: "mcp_tool_call",
        server: "understand-code",
        tool,
        arguments: args,
        status: "in_progress",
        result: null,
        error: null,
      },
    },
    {
      type: "item.completed",
      item: {
        id,
        type: "mcp_tool_call",
        server: "understand-code",
        tool,
        arguments: args,
        status: "completed",
        result: {
          content: [{ type: "text", text: "private tool result" }],
          structured_content: { ok: true },
        },
        error: null,
      },
    },
  ];
}

function codexFixtureV1(): readonly RawEventV1[] {
  return [
    { type: "thread.started", thread_id: "private-codex-session" },
    { type: "turn.started" },
    ...codexMcpPairV1("private-codex-call"),
    { type: "turn.completed" },
  ];
}

function claudeToolPairV1(
  id: string,
  name: string,
  input: Readonly<Record<string, unknown>>,
  result: unknown = { ok: true },
): readonly RawEventV1[] {
  return [
    {
      type: "assistant",
      session_id: "private-claude-session",
      parent_tool_use_id: null,
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id, name, input }],
      },
    },
    {
      type: "user",
      session_id: "private-claude-session",
      parent_tool_use_id: null,
      message: {
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: id,
          content: "private result",
        }],
      },
      tool_use_result: result,
    },
  ];
}

function claudeFixtureV1(): readonly RawEventV1[] {
  return [
    {
      type: "system",
      subtype: "init",
      session_id: "private-claude-session",
    },
    ...claudeToolPairV1(
      "private-claude-call",
      "mcp__understand-code__get_repo_pulse",
      { root: "/private/repository" },
    ),
    {
      type: "result",
      subtype: "success",
      session_id: "private-claude-session",
      is_error: false,
      permission_denials: [],
    },
  ];
}

function observeV1(
  host: RealHostReceiptHostV1,
  events: readonly RawEventV1[],
  expectedPlan: Step16ExpectedHostEventPlanV1 = planV1(),
): Readonly<{
  observed: readonly Step16RealHostObservedCallInternalV1[];
  receipt: ReturnType<typeof normalizeStep16RealHostJsonlTranscriptV1>;
}> {
  const observer = createStep16RealHostStreamObserverInternalV1(host, expectedPlan);
  const observed: Step16RealHostObservedCallInternalV1[] = [];
  for (const line of linesV1(events)) {
    const event = observer.feed(line);
    if (event !== undefined) observed.push(event);
  }
  return Object.freeze({ observed: Object.freeze(observed), receipt: observer.finish() });
}

function expectCodeV1(
  operation: () => unknown,
  code: RealHostReceiptNormalizationError["code"],
): void {
  try {
    operation();
    expect.fail("expected stream observation rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(RealHostReceiptNormalizationError);
    expect((error as RealHostReceiptNormalizationError).code).toBe(code);
  }
}

describe("Step16 real Host stream observer (internal)", () => {
  it.each([
    ["codex", codexFixtureV1()],
    ["claude", claudeFixtureV1()],
  ] as const)(
    "emits frozen, path-safe %s call boundaries that exactly match the final receipt",
    (host, events) => {
      const { observed, receipt } = observeV1(host, events);
      const normalized = normalizeStep16RealHostJsonlTranscriptV1(
        host,
        transcriptV1(events),
        planV1(),
      );

      expect(receipt).toEqual(normalized);
      expect(observed).toHaveLength(2);
      expect(Object.isFrozen(observed[0])).toBe(true);
      expect(Object.isFrozen(observed[1])).toBe(true);
      expect(Object.keys(observed[0]!).sort()).toEqual([
        "argumentsDigest",
        "callIdDigest",
        "host",
        "ordinal",
        "sessionIdDigest",
        "tool",
      ]);
      expect(Object.keys(observed[1]!).sort()).toEqual([
        "argumentsDigest",
        "callIdDigest",
        "host",
        "ordinal",
        "resultDigest",
        "sessionIdDigest",
        "success",
        "tool",
      ]);
      const receiptCall = receipt.events[0];
      expect(receiptCall?.kind).toBe("mcp_tool_call");
      if (receiptCall?.kind !== "mcp_tool_call") throw new Error("fixture mismatch");
      expect(observed[0]).toEqual({
        host,
        sessionIdDigest: receipt.sessionIdDigest,
        callIdDigest: receiptCall.callIdDigest,
        ordinal: receiptCall.ordinal,
        tool: receiptCall.tool,
        argumentsDigest: receiptCall.argumentsDigest,
      });
      expect(observed[1]).toEqual({
        ...observed[0],
        resultDigest: receiptCall.resultDigest,
        success: true,
      });
      expect(JSON.stringify(observed)).not.toContain("private");
      expect(JSON.stringify(observed)).not.toContain("/repository");
    },
  );

  it("strictly advances Claude Host actions without exporting them as provider calls", () => {
    const writeInput = {
      file_path: "/private/workspace/source.ts",
      content: "private source contents",
    };
    const bashInput = { command: "pnpm test -- /private/workspace/source.ts" };
    const events: readonly Step16ExpectedHostEventV1[] = [
      MCP_EVENT_V1,
      {
        kind: "host_action",
        ordinal: 2,
        action: "source_mutation",
        mechanism: "file_change",
        inputDigest: deriveStep16RealHostActionInputDigestV1(writeInput),
      },
      {
        kind: "host_action",
        ordinal: 3,
        action: "verification",
        mechanism: "command_execution",
        inputDigest: deriveStep16RealHostActionInputDigestV1(bashInput),
      },
    ];
    const transcript = [
      {
        type: "system",
        subtype: "init",
        session_id: "private-claude-session",
      },
      ...claudeToolPairV1(
        "private-claude-call",
        "mcp__understand-code__get_repo_pulse",
        { root: "/private/repository" },
      ),
      ...claudeToolPairV1("private-write", "Write", writeInput, {
        filePath: writeInput.file_path,
      }),
      ...claudeToolPairV1("private-bash", "Bash", bashInput, {
        stdout: "private output",
        exitCode: 0,
      }),
      {
        type: "result",
        subtype: "success",
        session_id: "private-claude-session",
        is_error: false,
        permission_denials: [],
      },
    ];

    const { observed, receipt } = observeV1("claude", transcript, planV1(events));
    expect(observed).toHaveLength(2);
    expect(receipt.events.map((event) => event.kind)).toEqual([
      "mcp_tool_call",
      "host_action",
      "host_action",
    ]);
  });

  it("advances a completion-only Codex file_change without exporting it", () => {
    const changes = [{ kind: "update", path: "/private/workspace/source.ts" }];
    const command = "pnpm test -- /private/workspace/source.ts";
    const events: readonly Step16ExpectedHostEventV1[] = [
      MCP_EVENT_V1,
      {
        kind: "host_action",
        ordinal: 2,
        action: "source_mutation",
        mechanism: "file_change",
        inputDigest: deriveStep16RealHostActionInputDigestV1({ changes }),
      },
      {
        kind: "host_action",
        ordinal: 3,
        action: "verification",
        mechanism: "command_execution",
        inputDigest: deriveStep16RealHostActionInputDigestV1({ command }),
      },
    ];
    const transcript = [
      { type: "thread.started", thread_id: "private-codex-session" },
      { type: "turn.started" },
      ...codexMcpPairV1("private-codex-call"),
      {
        type: "item.completed",
        item: {
          id: "private-file-change",
          type: "file_change",
          changes,
          status: "completed",
        },
      },
      {
        type: "item.started",
        item: {
          id: "private-command",
          type: "command_execution",
          command,
          status: "in_progress",
        },
      },
      {
        type: "item.completed",
        item: {
          id: "private-command",
          type: "command_execution",
          command,
          status: "completed",
          aggregated_output: "private verification output",
          exit_code: 0,
        },
      },
      { type: "turn.completed" },
    ];

    const { observed, receipt } = observeV1("codex", transcript, planV1(events));
    expect(observed).toHaveLength(2);
    expect(receipt.events.map((event) => event.kind)).toEqual([
      "mcp_tool_call",
      "host_action",
      "host_action",
    ]);
    expect(receipt.events[1]).toMatchObject({
      kind: "host_action",
      mechanism: "file_change",
      ordinal: 2,
      success: true,
    });
  });

  it("requires one complete JSONL record per feed call", () => {
    const observer = createStep16RealHostStreamObserverInternalV1("codex", planV1());
    expectCodeV1(
      () => observer.feed(`${JSON.stringify(codexFixtureV1()[0])}\n`),
      "invalid_transcript",
    );
    expectCodeV1(
      () => observer.feed(JSON.stringify(codexFixtureV1()[0])),
      "invalid_transcript",
    );
  });

  it("rejects a mixed session and remains failed", () => {
    const observer = createStep16RealHostStreamObserverInternalV1("claude", planV1());
    observer.feed(linesV1(claudeFixtureV1())[0]!);
    const mixed = {
      ...claudeFixtureV1()[1],
      session_id: "different-session",
    };
    expectCodeV1(() => observer.feed(JSON.stringify(mixed)), "mixed_session");
    expectCodeV1(() => observer.finish(), "mixed_session");
  });

  it("rejects multiple tool_use blocks in one Claude event", () => {
    const observer = createStep16RealHostStreamObserverInternalV1("claude", planV1());
    observer.feed(linesV1(claudeFixtureV1())[0]!);
    expectCodeV1(
      () => observer.feed(JSON.stringify({
        type: "assistant",
        session_id: "private-claude-session",
        parent_tool_use_id: null,
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "call-1",
              name: "mcp__understand-code__get_repo_pulse",
              input: { root: "/private/one" },
            },
            {
              type: "tool_use",
              id: "call-2",
              name: "mcp__understand-code__get_repo_pulse",
              input: { root: "/private/two" },
            },
          ],
        },
      })),
      "unexpected_tool_call",
    );
  });

  it.each([
    "failed completion",
    "mixed session after start",
    "terminal event while pending",
  ] as const)(
    "keeps %s sticky after emitting a valid start and never emits completion",
    (failureKind) => {
      const host = failureKind === "failed completion" ? "codex" : "claude";
      const observer = createStep16RealHostStreamObserverInternalV1(host, planV1());
      const fixture = host === "codex" ? codexFixtureV1() : claudeFixtureV1();
      const prefix = host === "codex" ? fixture.slice(0, 3) : fixture.slice(0, 2);
      const observed: Step16RealHostObservedCallInternalV1[] = [];
      for (const line of linesV1(prefix)) {
        const event = observer.feed(line);
        if (event !== undefined) observed.push(event);
      }
      expect(observed).toHaveLength(1);
      expect(Object.hasOwn(observed[0]!, "success")).toBe(false);

      let failingEvent: RawEventV1;
      let expectedCode: RealHostReceiptNormalizationError["code"];
      if (failureKind === "failed completion") {
        const completion = structuredClone(codexFixtureV1()[3]) as Record<
          string,
          unknown
        >;
        const item = completion.item as Record<string, unknown>;
        item.status = "failed";
        item.error = { message: "private failure" };
        failingEvent = completion;
        expectedCode = "tool_call_failed";
      } else if (failureKind === "mixed session after start") {
        failingEvent = {
          ...claudeFixtureV1()[2],
          session_id: "different-session",
        };
        expectedCode = "mixed_session";
      } else {
        failingEvent = claudeFixtureV1()[3]!;
        expectedCode = "tool_call_failed";
      }

      expectCodeV1(() => observer.feed(JSON.stringify(failingEvent)), expectedCode);
      expect(observed).toHaveLength(1);
      expect(observed.some((event) => Object.hasOwn(event, "success"))).toBe(false);
      expectCodeV1(() => observer.finish(), expectedCode);
    },
  );

  it("rejects output after Claude terminal before EOF-scoped finish", () => {
    const observer = createStep16RealHostStreamObserverInternalV1("claude", planV1());
    for (const line of linesV1(claudeFixtureV1())) observer.feed(line);

    expectCodeV1(
      () => observer.feed(JSON.stringify({
        type: "assistant",
        session_id: "private-claude-session",
        parent_tool_use_id: null,
        message: {
          role: "assistant",
          content: [{ type: "text", text: "unexpected trailing output" }],
        },
      })),
      "unexpected_event",
    );
    expectCodeV1(() => observer.finish(), "unexpected_event");
  });

  it("rejects mismatched arguments, duplicate IDs, and overbound calls", () => {
    const mismatch = createStep16RealHostStreamObserverInternalV1("codex", planV1());
    const prefix = codexFixtureV1().slice(0, 3);
    for (const line of linesV1(prefix)) mismatch.feed(line);
    const completion = structuredClone(codexFixtureV1()[3]) as Record<string, unknown>;
    const item = completion.item as Record<string, unknown>;
    item.arguments = { root: "/different" };
    expectCodeV1(() => mismatch.feed(JSON.stringify(completion)), "call_pair_mismatch");

    const twoCalls = planV1([
      MCP_EVENT_V1,
      { ...MCP_EVENT_V1, ordinal: 2 },
    ]);
    const duplicate = createStep16RealHostStreamObserverInternalV1("codex", twoCalls);
    const duplicateEvents = [
      { type: "thread.started", thread_id: "private-codex-session" },
      { type: "turn.started" },
      ...codexMcpPairV1("same-id"),
      codexMcpPairV1("same-id")[0]!,
    ];
    for (const line of linesV1(duplicateEvents.slice(0, -1))) duplicate.feed(line);
    expectCodeV1(
      () => duplicate.feed(JSON.stringify(duplicateEvents.at(-1))),
      "call_pair_mismatch",
    );

    const overbound = createStep16RealHostStreamObserverInternalV1("codex", planV1());
    const firstComplete = codexFixtureV1().slice(0, 4);
    for (const line of linesV1(firstComplete)) overbound.feed(line);
    expectCodeV1(
      () => overbound.feed(JSON.stringify(codexMcpPairV1("extra-call")[0])),
      "unexpected_event",
    );
  });

  it("rejects unknown events and an incomplete finish", () => {
    const unknown = createStep16RealHostStreamObserverInternalV1("codex", planV1());
    unknown.feed(JSON.stringify(codexFixtureV1()[0]));
    unknown.feed(JSON.stringify(codexFixtureV1()[1]));
    expectCodeV1(
      () => unknown.feed(JSON.stringify({ type: "future.event" })),
      "unexpected_event",
    );

    const incomplete = createStep16RealHostStreamObserverInternalV1("claude", planV1());
    incomplete.feed(linesV1(claudeFixtureV1())[0]!);
    incomplete.feed(linesV1(claudeFixtureV1())[1]!);
    expectCodeV1(() => incomplete.finish(), "incomplete_transcript");
  });
});
