import { describe, expect, it } from "vitest";

import {
  RealHostReceiptNormalizationError,
  deriveStep16ExpectedHostEventPlanDigestV1,
  deriveStep16RealHostActionInputDigestV1,
  normalizeStep16RealHostJsonlTranscriptV1,
  type RealHostReceiptHostV1,
  type Step16ExpectedHostEventPlanV1,
  type Step16ExpectedHostEventV1,
  type UnderstandCodeRealHostToolV1,
} from "../src/real-host-receipts.js";

type RawEvent = Record<string, unknown>;

const PRIVATE_CHANGES = [
  { path: "/Users/private/project/src/secret.ts", kind: "update" },
];
const PRIVATE_COMMAND = "pnpm test -- /Users/private/project/src/secret.ts";
const EDIT_INPUT = {
  file_path: "/Users/private/project/src/secret.ts",
  old_string: "old private source",
  new_string: "new private source",
};
const WRITE_INPUT = {
  file_path: "/Users/private/project/src/secret.ts",
  content: "new private source",
};

const EXPECTED_EVENTS = [
  {
    kind: "mcp_tool_call",
    ordinal: 1,
    server: "understand-code",
    tool: "get_repo_pulse",
  },
  {
    kind: "mcp_tool_call",
    ordinal: 2,
    server: "understand-code",
    tool: "update_task",
  },
  {
    kind: "mcp_tool_call",
    ordinal: 3,
    server: "understand-code",
    tool: "update_task",
  },
  {
    kind: "host_action",
    ordinal: 4,
    action: "source_mutation",
    mechanism: "file_change",
    inputDigest: deriveStep16RealHostActionInputDigestV1({
      changes: PRIVATE_CHANGES,
    }),
  },
  {
    kind: "host_action",
    ordinal: 5,
    action: "verification",
    mechanism: "command_execution",
    inputDigest: deriveStep16RealHostActionInputDigestV1({
      command: PRIVATE_COMMAND,
    }),
  },
] as const satisfies readonly Step16ExpectedHostEventV1[];

function expectedPlan(
  events: readonly Step16ExpectedHostEventV1[] = EXPECTED_EVENTS,
): Step16ExpectedHostEventPlanV1 {
  return {
    expectedEventPlanDigest: deriveStep16ExpectedHostEventPlanDigestV1(events),
    events,
  };
}

function claudeExpectedPlan(
  mutationTool: "Edit" | "Write" = "Edit",
): Step16ExpectedHostEventPlanV1 {
  return expectedPlan([
    EXPECTED_EVENTS[0],
    EXPECTED_EVENTS[1],
    EXPECTED_EVENTS[2],
    {
      ...EXPECTED_EVENTS[3],
      inputDigest: deriveStep16RealHostActionInputDigestV1(
        mutationTool === "Edit" ? EDIT_INPUT : WRITE_INPUT,
      ),
    },
    EXPECTED_EVENTS[4],
  ]);
}

function jsonl(events: readonly RawEvent[]): string {
  return `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
}

function codexMcpPair(
  id: string,
  tool: UnderstandCodeRealHostToolV1,
  args: Record<string, unknown>,
): RawEvent[] {
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
          content: [{ type: "text", text: `private result for ${tool}` }],
          structured_content: { ok: true },
          _meta: { internal: "private" },
        },
        error: null,
      },
    },
  ];
}

interface CodexFixtureOptions {
  readonly completionOnlyFileChange?: boolean;
  readonly commandExitCode?: number;
  readonly extraCommand?: boolean;
}

function codexFixture(options: CodexFixtureOptions = {}): RawEvent[] {
  const changes = PRIVATE_CHANGES;
  const command = PRIVATE_COMMAND;
  const events: RawEvent[] = [
    { type: "thread.started", thread_id: "codex-private-session" },
    { type: "turn.started" },
    ...codexMcpPair("call-pulse", "get_repo_pulse", { root: "/private/root" }),
    ...codexMcpPair("call-update-1", "update_task", { status: "working" }),
    ...codexMcpPair("call-update-2", "update_task", { status: "verifying" }),
    {
      type: "item.completed",
      item: {
        id: "model-message",
        type: "agent_message",
        text: "private model narration must disappear",
      },
    },
  ];

  if (!options.completionOnlyFileChange) {
    events.push({
      type: "item.started",
      item: {
        id: "file-action",
        type: "file_change",
        changes,
        status: "in_progress",
      },
    });
  }
  events.push({
    type: "item.completed",
    item: {
      id: "file-action",
      type: "file_change",
      changes,
      status: "completed",
    },
  });
  events.push(
    {
      type: "item.started",
      item: {
        id: "command-action",
        type: "command_execution",
        command,
        status: "in_progress",
      },
    },
    {
      type: "item.completed",
      item: {
        id: "command-action",
        type: "command_execution",
        command,
        status: "completed",
        aggregated_output: "private verification output",
        exit_code: options.commandExitCode ?? 0,
      },
    },
  );
  if (options.extraCommand) {
    events.push(
      {
        type: "item.started",
        item: {
          id: "unplanned-command",
          type: "command_execution",
          command: "cat /private/root/secret",
          status: "in_progress",
        },
      },
      {
        type: "item.completed",
        item: {
          id: "unplanned-command",
          type: "command_execution",
          command: "cat /private/root/secret",
          status: "completed",
          aggregated_output: "secret",
          exit_code: 0,
        },
      },
    );
  }
  events.push({ type: "turn.completed" });
  return events;
}

function claudeToolPair(
  id: string,
  name: string,
  input: Record<string, unknown>,
  toolUseResult: unknown = { ok: true },
): RawEvent[] {
  return [
    {
      type: "assistant",
      session_id: "claude-private-session",
      parent_tool_use_id: null,
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "private model narration must disappear" },
          { type: "tool_use", id, name, input },
        ],
      },
    },
    {
      type: "user",
      session_id: "claude-private-session",
      parent_tool_use_id: null,
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: id,
            content: "private tool output",
          },
        ],
      },
      tool_use_result: toolUseResult,
    },
  ];
}

function claudeFixture(
  mutationTool: "Edit" | "Write" = "Edit",
): RawEvent[] {
  const mutationInput = mutationTool === "Edit" ? EDIT_INPUT : WRITE_INPUT;
  return [
    {
      type: "system",
      subtype: "init",
      session_id: "claude-private-session",
    },
    ...claudeToolPair(
      "call-pulse",
      "mcp__understand-code__get_repo_pulse",
      { root: "/private/root" },
    ),
    ...claudeToolPair(
      "call-update-1",
      "mcp__understand-code__update_task",
      { status: "working" },
    ),
    ...claudeToolPair(
      "call-update-2",
      "mcp__understand-code__update_task",
      { status: "verifying" },
    ),
    ...claudeToolPair("file-action", mutationTool, mutationInput, {
      filePath: "/Users/private/project/src/secret.ts",
    }),
    ...claudeToolPair(
      "command-action",
      "Bash",
      { command: "pnpm test -- /Users/private/project/src/secret.ts" },
      { stdout: "private verification output", exitCode: 0 },
    ),
    {
      type: "result",
      subtype: "success",
      session_id: "claude-private-session",
      is_error: false,
      permission_denials: [],
      result: "private final model text",
    },
  ];
}

function expectRejected(
  host: RealHostReceiptHostV1,
  events: readonly RawEvent[],
  plan?: Step16ExpectedHostEventPlanV1,
  code?: RealHostReceiptNormalizationError["code"],
): void {
  try {
    normalizeStep16RealHostJsonlTranscriptV1(
      host,
      jsonl(events),
      plan ?? (host === "claude" ? claudeExpectedPlan() : expectedPlan()),
    );
    expect.fail("expected transcript rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(RealHostReceiptNormalizationError);
    if (code !== undefined) {
      expect((error as RealHostReceiptNormalizationError).code).toBe(code);
    }
  }
}

function mutableItem(event: RawEvent): Record<string, unknown> {
  const item = event.item;
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw new Error("fixture event does not contain an item");
  }
  return item as Record<string, unknown>;
}

describe("Step16 real Host transcript normalizer", () => {
  it("normalizes paired Codex MCP, mutation, and verification events without leaks", () => {
    const receipt = normalizeStep16RealHostJsonlTranscriptV1(
      "codex",
      jsonl(codexFixture()),
      expectedPlan(),
    );

    expect(receipt.schemaVersion).toBe(1);
    expect(receipt.host).toBe("codex");
    expect(receipt.events.map(({ kind, ordinal }) => ({ kind, ordinal }))).toEqual([
      { kind: "mcp_tool_call", ordinal: 1 },
      { kind: "mcp_tool_call", ordinal: 2 },
      { kind: "mcp_tool_call", ordinal: 3 },
      { kind: "host_action", ordinal: 4 },
      { kind: "host_action", ordinal: 5 },
    ]);
    expect(receipt.events[3]).toMatchObject({
      kind: "host_action",
      action: "source_mutation",
      mechanism: "file_change",
      success: true,
    });
    expect(receipt.events[4]).toMatchObject({
      kind: "host_action",
      action: "verification",
      mechanism: "command_execution",
      success: true,
    });
    const serialized = JSON.stringify(receipt);
    for (const secret of [
      "/Users/private",
      "/private/root",
      "pnpm test",
      "private verification output",
      "private model narration",
      "codex-private-session",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(Object.keys(receipt).sort()).toEqual([
      "events",
      "host",
      "schemaVersion",
      "sessionIdDigest",
    ]);
    for (const event of receipt.events) {
      expect(Object.keys(event).sort()).toEqual(
        event.kind === "mcp_tool_call"
          ? [
              "argumentsDigest",
              "callIdDigest",
              "kind",
              "ordinal",
              "resultDigest",
              "server",
              "success",
              "tool",
            ]
          : [
              "action",
              "actionIdDigest",
              "inputDigest",
              "kind",
              "mechanism",
              "ordinal",
              "resultDigest",
              "success",
            ],
      );
    }
  });

  it("accepts the official completion-only Codex file_change form", () => {
    const receipt = normalizeStep16RealHostJsonlTranscriptV1(
      "codex",
      jsonl(codexFixture({ completionOnlyFileChange: true })),
      expectedPlan(),
    );
    expect(receipt.events[3]).toMatchObject({
      action: "source_mutation",
      mechanism: "file_change",
    });
  });

  it.each(["Edit", "Write"] as const)(
    "normalizes Claude %s plus Bash using only digests",
    (mutationTool) => {
      const receipt = normalizeStep16RealHostJsonlTranscriptV1(
        "claude",
        jsonl(claudeFixture(mutationTool)),
        claudeExpectedPlan(mutationTool),
      );
      expect(receipt.host).toBe("claude");
      expect(receipt.events).toHaveLength(5);
      expect(receipt.events[3]).toMatchObject({
        kind: "host_action",
        action: "source_mutation",
        mechanism: "file_change",
      });
      expect(receipt.events[4]).toMatchObject({
        kind: "host_action",
        action: "verification",
        mechanism: "command_execution",
      });
      expect(JSON.stringify(receipt)).not.toContain("/Users/private");
      expect(JSON.stringify(receipt)).not.toContain("private model narration");
      expect(JSON.stringify(receipt)).not.toContain("pnpm test");
    },
  );

  it("rejects crossed action/mechanism labels in the trusted plan", () => {
    const crossed = EXPECTED_EVENTS.map((event) => ({ ...event })) as unknown as
      Step16ExpectedHostEventV1[];
    crossed[3] = {
      kind: "host_action",
      ordinal: 4,
      action: "source_mutation",
      mechanism: "command_execution",
      inputDigest: EXPECTED_EVENTS[3].inputDigest,
    };
    expectRejected(
      "codex",
      codexFixture(),
      expectedPlan(crossed),
      "invalid_expected_event_plan",
    );
  });

  it("rejects a plan digest that does not bind its canonical events", () => {
    expectRejected(
      "codex",
      codexFixture(),
      {
        ...expectedPlan(),
        expectedEventPlanDigest:
          "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      "invalid_expected_event_plan",
    );
  });

  it("derives canonical action input commitments and rejects input substitution", () => {
    expect(
      deriveStep16RealHostActionInputDigestV1({ nested: { b: 2, a: 1 } }),
    ).toBe(
      deriveStep16RealHostActionInputDigestV1({ nested: { a: 1, b: 2 } }),
    );

    const substitutedInputDigest = deriveStep16RealHostActionInputDigestV1({
      ...EDIT_INPUT,
      new_string: "attacker-selected source",
    });
    const substitutedPlan = expectedPlan(
      claudeExpectedPlan().events.map((event) =>
        event.kind === "host_action" && event.action === "source_mutation"
          ? { ...event, inputDigest: substitutedInputDigest }
          : event,
      ),
    );
    expectRejected(
      "claude",
      claudeFixture(),
      substitutedPlan,
      "unexpected_tool_call",
    );
  });

  it("rejects an extra Codex command even when it succeeds", () => {
    expectRejected("codex", codexFixture({ extraCommand: true }));
  });

  it("rejects a failed Codex verification command", () => {
    expectRejected(
      "codex",
      codexFixture({ commandExitCode: 1 }),
      expectedPlan(),
      "host_action_failed",
    );
  });

  it("rejects missing and changed Codex start/completion pairs", () => {
    const missing = codexFixture();
    missing.splice(missing.length - 2, 1);
    expectRejected("codex", missing);

    const changed = structuredClone(codexFixture());
    const secondPulseEvent = changed.find(
      (event) =>
        event.type === "item.completed" &&
        mutableItem(event).id === "call-pulse",
    );
    if (secondPulseEvent === undefined) throw new Error("missing fixture event");
    mutableItem(secondPulseEvent).arguments = { root: "/different/root" };
    expectRejected("codex", changed, expectedPlan(), "call_pair_mismatch");
  });

  it("rejects duplicate IDs globally across MCP and Host actions", () => {
    const events = structuredClone(codexFixture());
    for (const event of events) {
      const item = event.item;
      if (
        item !== null &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        (item as Record<string, unknown>).id === "file-action"
      ) {
        (item as Record<string, unknown>).id = "call-pulse";
      }
    }
    expectRejected("codex", events, expectedPlan(), "call_pair_mismatch");
  });

  it("rejects failed MCP calls and unknown Codex built-ins", () => {
    const failed = structuredClone(codexFixture());
    const completed = failed.find(
      (event) =>
        event.type === "item.completed" &&
        mutableItem(event).id === "call-pulse",
    );
    if (completed === undefined) throw new Error("missing fixture event");
    Object.assign(mutableItem(completed), {
      status: "failed",
      result: null,
      error: { message: "denied" },
    });
    expectRejected("codex", failed, expectedPlan(), "tool_call_failed");

    const unknown = codexFixture();
    unknown.splice(-1, 0, {
      type: "item.completed",
      item: { id: "web", type: "web_search", query: "secret" },
    });
    expectRejected("codex", unknown);
  });

  it("requires the external plan to cover the exact full sequence and order", () => {
    expectRejected("codex", codexFixture(), expectedPlan(EXPECTED_EVENTS.slice(0, -1)));
    expectRejected(
      "codex",
      codexFixture(),
      expectedPlan([
        ...EXPECTED_EVENTS,
        {
          kind: "mcp_tool_call",
          ordinal: 6,
          server: "understand-code",
          tool: "get_evidence",
        },
      ]),
    );
    const reordered = EXPECTED_EVENTS.map((event) => ({ ...event }));
    [reordered[0], reordered[1]] = [reordered[1]!, reordered[0]!];
    reordered[0]!.ordinal = 1;
    reordered[1]!.ordinal = 2;
    expectRejected(
      "codex",
      codexFixture(),
      expectedPlan(reordered as readonly Step16ExpectedHostEventV1[]),
      "unexpected_tool_call",
    );
  });

  it("rejects mixed Claude sessions and unplanned built-in tools", () => {
    const mixed = structuredClone(claudeFixture());
    mixed[2]!.session_id = "different-session";
    expectRejected("claude", mixed, claudeExpectedPlan(), "mixed_session");

    const unplanned = claudeFixture();
    unplanned.splice(-1, 0, ...claudeToolPair("read-secret", "Read", {
      file_path: "/private/root/secret",
    }));
    expectRejected("claude", unplanned);
  });

  it("rejects an extra Claude Bash and a failed Claude command result", () => {
    const extra = claudeFixture();
    extra.splice(
      -1,
      0,
      ...claudeToolPair("extra-bash", "Bash", { command: "cat /private/root/secret" }),
    );
    expectRejected("claude", extra);

    const failed = structuredClone(claudeFixture());
    const resultEvent = failed.find((event) => {
      if (event.type !== "user") return false;
      const message = event.message;
      if (message === null || typeof message !== "object" || Array.isArray(message)) {
        return false;
      }
      const content = (message as Record<string, unknown>).content;
      return (
        Array.isArray(content) &&
        content.some(
          (block) =>
            block !== null &&
            typeof block === "object" &&
            !Array.isArray(block) &&
            (block as Record<string, unknown>).tool_use_id === "command-action",
        )
      );
    });
    if (resultEvent === undefined) throw new Error("missing fixture event");
    const message = resultEvent.message as Record<string, unknown>;
    const block = (message.content as Record<string, unknown>[])[0]!;
    block.is_error = true;
    resultEvent.tool_use_result = { isError: true, stderr: "failed" };
    expectRejected("claude", failed, claudeExpectedPlan(), "host_action_failed");
  });

  it("rejects malformed, incomplete, or mixed-server transcripts", () => {
    expect(() =>
      normalizeStep16RealHostJsonlTranscriptV1(
        "codex",
        "{not-json}\n",
        expectedPlan(),
      ),
    ).toThrow(RealHostReceiptNormalizationError);

    const incomplete = codexFixture().slice(0, -1);
    expectRejected("codex", incomplete, expectedPlan(), "incomplete_transcript");

    const mixedServer = structuredClone(codexFixture());
    const started = mixedServer.find(
      (event) =>
        event.type === "item.started" &&
        mutableItem(event).id === "call-pulse",
    );
    if (started === undefined) throw new Error("missing fixture event");
    mutableItem(started).server = "attacker-server";
    expectRejected("codex", mixedServer, expectedPlan(), "unexpected_tool_call");
  });
});
