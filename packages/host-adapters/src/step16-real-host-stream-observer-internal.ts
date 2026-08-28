import {
  RealHostReceiptNormalizationError,
  compileStep16ExpectedHostEventPlanV1,
  deriveStep16RealHostActionInputDigestV1,
  normalizeStep16RealHostJsonlTranscriptV1,
  type RealHostReceiptHostV1,
  type RealHostReceiptNormalizationErrorCode,
  type RealHostTranscriptReceiptV1,
  type Sha256DigestV1,
  type Step16ExpectedHostActionV1,
  type Step16ExpectedHostEventPlanV1,
  type Step16ExpectedHostEventV1,
  type Step16ExpectedHostMcpToolCallV1,
  type UnderstandCodeRealHostToolV1,
} from "./real-host-receipts.js";
import {
  canonicalRealHostJsonInternalV1 as canonicalJsonV1,
  digestRealHostIdentifierInternalV1 as digestIdentifierV1,
  digestRealHostJsonInternalV1 as digestJsonV1,
  isRealHostJsonRecordInternalV1 as isRecordV1,
  isUnicodeScalarStringInternalV1 as isUnicodeScalarStringV1,
  parseRealHostJsonlRecordInternalV1,
  safeRealHostIdentifierInternalV1 as safeIdentifierV1,
  type RealHostJsonRecordInternalV1 as JsonRecordV1,
  type RealHostJsonValueInternalV1 as JsonValueV1,
} from "./real-host-receipt-primitives-internal.js";

const SERVER_NAME_V1 = "understand-code" as const;
const CLAUDE_TOOL_PREFIX_V1 = `mcp__${SERVER_NAME_V1}__`;
const MAX_TRANSCRIPT_BYTES_V1 = 32 * 1024 * 1024;
const MAX_TRANSCRIPT_EVENTS_V1 = 50_000;

export interface Step16RealHostCallStartInternalV1 {
  readonly host: RealHostReceiptHostV1;
  readonly sessionIdDigest: Sha256DigestV1;
  readonly callIdDigest: Sha256DigestV1;
  readonly ordinal: number;
  readonly tool: UnderstandCodeRealHostToolV1;
  readonly argumentsDigest: Sha256DigestV1;
}

export interface Step16RealHostCallCompleteInternalV1
  extends Step16RealHostCallStartInternalV1 {
  readonly resultDigest: Sha256DigestV1;
  readonly success: true;
}

export type Step16RealHostObservedCallInternalV1 =
  | Step16RealHostCallStartInternalV1
  | Step16RealHostCallCompleteInternalV1;

export interface Step16RealHostStreamObserverInternalV1 {
  /** Feed exactly one JSONL record without a CR/LF delimiter. */
  feed(line: string): Step16RealHostObservedCallInternalV1 | undefined;
  /** Call only after successful child exit and stdout EOF. */
  finish(): RealHostTranscriptReceiptV1;
}

interface PendingMcpCallV1 {
  readonly kind: "mcp_tool_call";
  readonly id: string;
  readonly expected: Step16ExpectedHostMcpToolCallV1;
  readonly arguments: JsonRecordV1;
  readonly start: Step16RealHostCallStartInternalV1;
}

interface PendingHostActionV1 {
  readonly kind: "host_action";
  readonly id: string;
  readonly expected: Step16ExpectedHostActionV1;
  readonly input: JsonRecordV1;
}

type PendingEventV1 = PendingMcpCallV1 | PendingHostActionV1;

function hasExactKeysV1(value: JsonRecordV1, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function nonEmptyStringV1(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function parseLineV1(line: unknown): JsonRecordV1 {
  if (
    typeof line !== "string" ||
    !isUnicodeScalarStringV1(line)
  ) {
    throw new RealHostReceiptNormalizationError("invalid_transcript");
  }
  return parseRealHostJsonlRecordInternalV1(line);
}

function codexChangesV1(value: unknown): readonly JsonRecordV1[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.some((change) =>
      !isRecordV1(change) ||
      !hasExactKeysV1(change, ["kind", "path"]) ||
      !nonEmptyStringV1(change.path) ||
      (change.kind !== "add" && change.kind !== "update" && change.kind !== "delete")
    )
  ) {
    throw new RealHostReceiptNormalizationError("invalid_transcript");
  }
  return value as readonly JsonRecordV1[];
}

function codexMcpResultV1(value: unknown): JsonRecordV1 {
  if (
    !isRecordV1(value) ||
    !Array.isArray(value.content) ||
    Object.keys(value).some((key) =>
      key !== "content" && key !== "_meta" && key !== "structured_content"
    )
  ) {
    throw new RealHostReceiptNormalizationError("call_pair_mismatch");
  }
  return value;
}

class RealHostStreamObserverInternalV1
  implements Step16RealHostStreamObserverInternalV1 {
  readonly #host: RealHostReceiptHostV1;
  readonly #expectedEventPlan: Step16ExpectedHostEventPlanV1;
  readonly #expectedEvents: readonly Step16ExpectedHostEventV1[];
  readonly #lines: string[] = [];
  readonly #seenIds = new Set<string>();
  readonly #starts: Step16RealHostCallStartInternalV1[] = [];
  readonly #completions: Step16RealHostCallCompleteInternalV1[] = [];
  #transcriptBytes = 0;
  #cursor = 0;
  #sessionId: string | undefined;
  #pending: PendingEventV1 | undefined;
  #codexTurnStarted = false;
  #terminalObserved = false;
  #failedCode: RealHostReceiptNormalizationErrorCode | undefined;
  #finished = false;

  constructor(
    host: RealHostReceiptHostV1,
    expectedEventPlan: Step16ExpectedHostEventPlanV1,
  ) {
    if (host !== "codex" && host !== "claude") {
      throw new RealHostReceiptNormalizationError("invalid_transcript");
    }
    this.#host = host;
    this.#expectedEventPlan = compileStep16ExpectedHostEventPlanV1(
      expectedEventPlan,
    );
    this.#expectedEvents = this.#expectedEventPlan.events;
  }

  #fail(code: RealHostReceiptNormalizationErrorCode): never {
    this.#failedCode ??= code;
    throw new RealHostReceiptNormalizationError(this.#failedCode);
  }

  #guardActive(): void {
    if (this.#failedCode !== undefined) this.#fail(this.#failedCode);
    if (this.#finished) this.#fail("unexpected_event");
  }

  #expected(): Step16ExpectedHostEventV1 {
    const expected = this.#expectedEvents[this.#cursor];
    if (expected === undefined) this.#fail("unexpected_event");
    return expected;
  }

  #expectedMcp(tool: unknown): Step16ExpectedHostMcpToolCallV1 {
    const expected = this.#expected();
    if (
      expected.kind !== "mcp_tool_call" ||
      expected.server !== SERVER_NAME_V1 ||
      expected.tool !== tool
    ) {
      this.#fail("unexpected_tool_call");
    }
    return expected;
  }

  #expectedAction(
    mechanism: "file_change" | "command_execution",
  ): Step16ExpectedHostActionV1 {
    const expected = this.#expected();
    if (expected.kind !== "host_action" || expected.mechanism !== mechanism) {
      this.#fail("unexpected_tool_call");
    }
    return expected;
  }

  #reserveId(value: unknown): string {
    if (!safeIdentifierV1(value) || this.#seenIds.has(value)) {
      this.#fail("call_pair_mismatch");
    }
    this.#seenIds.add(value);
    return value;
  }

  #sessionDigest(): Sha256DigestV1 {
    if (this.#sessionId === undefined) this.#fail("invalid_transcript");
    return digestIdentifierV1(this.#host, "session", this.#sessionId);
  }

  #startMcp(
    idValue: unknown,
    toolValue: unknown,
    argumentsValue: JsonRecordV1,
  ): Step16RealHostCallStartInternalV1 {
    if (this.#pending !== undefined) this.#fail("call_pair_mismatch");
    const expected = this.#expectedMcp(toolValue);
    const id = this.#reserveId(idValue);
    const argumentsDigest = digestJsonV1(argumentsValue);
    const start = Object.freeze({
      host: this.#host,
      sessionIdDigest: this.#sessionDigest(),
      callIdDigest: digestIdentifierV1(this.#host, "event", id),
      ordinal: expected.ordinal,
      tool: expected.tool,
      argumentsDigest,
    });
    this.#pending = {
      kind: "mcp_tool_call",
      id,
      expected,
      arguments: argumentsValue,
      start,
    };
    this.#starts.push(start);
    return start;
  }

  #completeMcp(result: JsonRecordV1): Step16RealHostCallCompleteInternalV1 {
    const pending = this.#pending;
    if (pending?.kind !== "mcp_tool_call") this.#fail("call_pair_mismatch");
    const completion = Object.freeze({
      ...pending.start,
      resultDigest: digestJsonV1(result),
      success: true as const,
    });
    this.#pending = undefined;
    this.#cursor += 1;
    this.#completions.push(completion);
    return completion;
  }

  #startAction(
    idValue: unknown,
    expected: Step16ExpectedHostActionV1,
    input: JsonRecordV1,
  ): void {
    if (this.#pending !== undefined) this.#fail("call_pair_mismatch");
    let inputDigest: Sha256DigestV1;
    try {
      inputDigest = deriveStep16RealHostActionInputDigestV1(input);
    } catch {
      this.#fail("invalid_transcript");
    }
    if (inputDigest !== expected.inputDigest) this.#fail("unexpected_tool_call");
    this.#pending = {
      kind: "host_action",
      id: this.#reserveId(idValue),
      expected,
      input,
    };
  }

  #finishAction(): void {
    if (this.#pending?.kind !== "host_action") this.#fail("call_pair_mismatch");
    this.#pending = undefined;
    this.#cursor += 1;
  }

  #feedCodex(event: JsonRecordV1): Step16RealHostObservedCallInternalV1 | undefined {
    if (event.type === "thread.started") {
      if (
        this.#lines.length !== 1 ||
        this.#sessionId !== undefined ||
        !safeIdentifierV1(event.thread_id)
      ) {
        this.#fail(this.#sessionId === undefined ? "invalid_transcript" : "mixed_session");
      }
      this.#sessionId = event.thread_id;
      return undefined;
    }
    if (this.#sessionId === undefined) this.#fail("invalid_transcript");
    if (Object.hasOwn(event, "thread_id") && event.thread_id !== this.#sessionId) {
      this.#fail("mixed_session");
    }
    if (event.type === "turn.started") {
      if (this.#codexTurnStarted || this.#terminalObserved) {
        this.#fail("unexpected_event");
      }
      this.#codexTurnStarted = true;
      return undefined;
    }
    if (event.type === "turn.completed") {
      if (
        !this.#codexTurnStarted ||
        this.#terminalObserved ||
        this.#pending !== undefined ||
        this.#cursor !== this.#expectedEvents.length
      ) {
        this.#fail("incomplete_transcript");
      }
      this.#terminalObserved = true;
      return undefined;
    }
    if (event.type === "turn.failed" || event.type === "error") {
      this.#fail("tool_call_failed");
    }
    if (event.type !== "item.started" && event.type !== "item.completed") {
      this.#fail("unexpected_event");
    }
    const item = event.item;
    if (!isRecordV1(item) || typeof item.type !== "string") {
      this.#fail("invalid_transcript");
    }
    if (item.type === "agent_message" || item.type === "reasoning") return undefined;
    if (!this.#codexTurnStarted || this.#terminalObserved) {
      this.#fail("unexpected_event");
    }

    if (item.type === "mcp_tool_call") {
      if (
        item.server !== SERVER_NAME_V1 ||
        typeof item.tool !== "string" ||
        !isRecordV1(item.arguments)
      ) {
        this.#fail("unexpected_tool_call");
      }
      if (event.type === "item.started") {
        if (
          this.#pending !== undefined ||
          item.status !== "in_progress" ||
          (item.result !== null && item.result !== undefined) ||
          (item.error !== null && item.error !== undefined)
        ) {
          this.#fail("call_pair_mismatch");
        }
        return this.#startMcp(item.id, item.tool, item.arguments);
      }
      if (item.status === "failed" || (item.error !== null && item.error !== undefined)) {
        this.#fail("tool_call_failed");
      }
      const pending = this.#pending;
      const result = codexMcpResultV1(item.result);
      if (
        pending?.kind !== "mcp_tool_call" ||
        item.id !== pending.id ||
        item.tool !== pending.expected.tool ||
        item.status !== "completed" ||
        canonicalJsonV1(item.arguments) !== canonicalJsonV1(pending.arguments)
      ) {
        this.#fail("call_pair_mismatch");
      }
      return this.#completeMcp(result);
    }

    if (item.type === "command_execution") {
      if (!nonEmptyStringV1(item.command)) this.#fail("invalid_transcript");
      if (event.type === "item.started") {
        if (
          this.#pending !== undefined ||
          item.status !== "in_progress" ||
          (item.exit_code !== null && item.exit_code !== undefined) ||
          (item.aggregated_output !== undefined && item.aggregated_output !== "") ||
          (item.error !== null && item.error !== undefined)
        ) {
          this.#fail("call_pair_mismatch");
        }
        this.#startAction(
          item.id,
          this.#expectedAction("command_execution"),
          { command: item.command },
        );
        return undefined;
      }
      const pending = this.#pending;
      if (
        pending?.kind !== "host_action" ||
        pending.expected.mechanism !== "command_execution" ||
        item.id !== pending.id ||
        item.command !== pending.input.command ||
        item.status !== "completed" ||
        item.exit_code !== 0 ||
        (item.aggregated_output !== undefined && typeof item.aggregated_output !== "string") ||
        (item.error !== null && item.error !== undefined)
      ) {
        this.#fail("host_action_failed");
      }
      this.#finishAction();
      return undefined;
    }

    if (item.type === "file_change") {
      const changes = codexChangesV1(item.changes);
      if (event.type === "item.started") {
        if (
          this.#pending !== undefined ||
          item.status !== "in_progress" ||
          (item.error !== null && item.error !== undefined)
        ) {
          this.#fail("call_pair_mismatch");
        }
        this.#startAction(
          item.id,
          this.#expectedAction("file_change"),
          { changes },
        );
        return undefined;
      }
      if (this.#pending === undefined) {
        this.#startAction(
          item.id,
          this.#expectedAction("file_change"),
          { changes },
        );
      }
      const pending = this.#pending;
      if (
        pending?.kind !== "host_action" ||
        pending.expected.mechanism !== "file_change" ||
        item.id !== pending.id ||
        item.status !== "completed" ||
        canonicalJsonV1(changes) !== canonicalJsonV1(pending.input.changes as JsonValueV1) ||
        (item.error !== null && item.error !== undefined)
      ) {
        this.#fail("host_action_failed");
      }
      this.#finishAction();
      return undefined;
    }

    this.#fail("unexpected_tool_call");
  }

  #claudeActionMechanism(
    name: "Edit" | "Write" | "Bash",
    input: JsonRecordV1,
  ): "file_change" | "command_execution" {
    if (name === "Edit") {
      if (
        !nonEmptyStringV1(input.file_path) ||
        typeof input.old_string !== "string" ||
        typeof input.new_string !== "string"
      ) {
        this.#fail("invalid_transcript");
      }
      return "file_change";
    }
    if (name === "Write") {
      if (!nonEmptyStringV1(input.file_path) || typeof input.content !== "string") {
        this.#fail("invalid_transcript");
      }
      return "file_change";
    }
    if (!nonEmptyStringV1(input.command) || input.run_in_background === true) {
      this.#fail("invalid_transcript");
    }
    return "command_execution";
  }

  #feedClaude(event: JsonRecordV1): Step16RealHostObservedCallInternalV1 | undefined {
    if (!safeIdentifierV1(event.session_id)) this.#fail("invalid_transcript");
    if (this.#sessionId !== undefined && event.session_id !== this.#sessionId) {
      this.#fail("mixed_session");
    }
    if (event.type === "system") {
      if (
        this.#lines.length !== 1 ||
        this.#sessionId !== undefined ||
        event.subtype !== "init"
      ) {
        this.#fail(this.#sessionId === undefined ? "invalid_transcript" : "unexpected_event");
      }
      this.#sessionId = event.session_id;
      return undefined;
    }
    if (this.#sessionId === undefined || this.#terminalObserved) {
      this.#fail("unexpected_event");
    }

    if (event.type === "assistant") {
      if (event.parent_tool_use_id !== null || !isRecordV1(event.message)) {
        this.#fail("mixed_session");
      }
      const content = event.message.content;
      if (event.message.role !== "assistant" || !Array.isArray(content)) {
        this.#fail("invalid_transcript");
      }
      let observed: Step16RealHostCallStartInternalV1 | undefined;
      for (const block of content) {
        if (!isRecordV1(block) || typeof block.type !== "string") {
          this.#fail("invalid_transcript");
        }
        if (
          block.type === "text" ||
          block.type === "thinking" ||
          block.type === "redacted_thinking"
        ) {
          continue;
        }
        if (
          block.type !== "tool_use" ||
          this.#pending !== undefined ||
          observed !== undefined ||
          !safeIdentifierV1(block.id) ||
          !nonEmptyStringV1(block.name) ||
          !isRecordV1(block.input)
        ) {
          this.#fail("unexpected_tool_call");
        }
        if (block.name.startsWith(CLAUDE_TOOL_PREFIX_V1)) {
          observed = this.#startMcp(
            block.id,
            block.name.slice(CLAUDE_TOOL_PREFIX_V1.length),
            block.input,
          );
          continue;
        }
        if (block.name !== "Edit" && block.name !== "Write" && block.name !== "Bash") {
          this.#fail("unexpected_tool_call");
        }
        const mechanism = this.#claudeActionMechanism(block.name, block.input);
        this.#startAction(block.id, this.#expectedAction(mechanism), block.input);
      }
      return observed;
    }

    if (event.type === "user") {
      const pending = this.#pending;
      if (
        event.parent_tool_use_id !== null ||
        pending === undefined ||
        !isRecordV1(event.message) ||
        event.message.role !== "user" ||
        !Array.isArray(event.message.content) ||
        event.message.content.length !== 1 ||
        !Object.hasOwn(event, "tool_use_result")
      ) {
        this.#fail("call_pair_mismatch");
      }
      const block = event.message.content[0];
      if (
        !isRecordV1(block) ||
        block.type !== "tool_result" ||
        block.tool_use_id !== pending.id ||
        (block.is_error !== undefined && block.is_error !== false) ||
        (block.content !== undefined &&
          typeof block.content !== "string" &&
          !Array.isArray(block.content))
      ) {
        if (pending.kind === "host_action") this.#fail("host_action_failed");
        if (isRecordV1(block) && block.is_error === true) {
          this.#fail("tool_call_failed");
        }
        this.#fail("call_pair_mismatch");
      }
      const result: JsonRecordV1 = {
        content: (block.content ?? null) as JsonValueV1,
        toolUseResult: event.tool_use_result as JsonValueV1,
      };
      canonicalJsonV1(result);
      if (pending.kind === "mcp_tool_call") return this.#completeMcp(result);
      this.#finishAction();
      return undefined;
    }

    if (event.type === "result") {
      const denials = event.permission_denials;
      if (
        event.subtype !== "success" ||
        event.is_error !== false ||
        this.#pending !== undefined ||
        this.#cursor !== this.#expectedEvents.length ||
        (denials !== undefined && (!Array.isArray(denials) || denials.length !== 0))
      ) {
        this.#fail("tool_call_failed");
      }
      this.#terminalObserved = true;
      return undefined;
    }

    this.#fail("unexpected_event");
  }

  feed(line: string): Step16RealHostObservedCallInternalV1 | undefined {
    this.#guardActive();
    try {
      const lineBytes = Buffer.byteLength(line, "utf8") + 1;
      if (
        this.#lines.length >= MAX_TRANSCRIPT_EVENTS_V1 ||
        lineBytes > MAX_TRANSCRIPT_BYTES_V1 ||
        this.#transcriptBytes + lineBytes > MAX_TRANSCRIPT_BYTES_V1
      ) {
        this.#fail("invalid_transcript");
      }
      const event = parseLineV1(line);
      this.#lines.push(line);
      this.#transcriptBytes += lineBytes;
      return this.#host === "codex"
        ? this.#feedCodex(event)
        : this.#feedClaude(event);
    } catch (error) {
      if (error instanceof RealHostReceiptNormalizationError) {
        this.#failedCode ??= error.code;
        throw error;
      }
      this.#fail("invalid_transcript");
    }
  }

  finish(): RealHostTranscriptReceiptV1 {
    this.#guardActive();
    try {
      if (
        !this.#terminalObserved ||
        this.#pending !== undefined ||
        this.#cursor !== this.#expectedEvents.length
      ) {
        this.#fail("incomplete_transcript");
      }
      const receipt = normalizeStep16RealHostJsonlTranscriptV1(
        this.#host,
        `${this.#lines.join("\n")}\n`,
        this.#expectedEventPlan,
      );
      const receiptCalls = receipt.events.filter((event) =>
        event.kind === "mcp_tool_call"
      );
      if (
        receiptCalls.length !== this.#starts.length ||
        receiptCalls.length !== this.#completions.length
      ) {
        this.#fail("invalid_transcript");
      }
      for (let index = 0; index < receiptCalls.length; index += 1) {
        const call = receiptCalls[index];
        const start = this.#starts[index];
        const completion = this.#completions[index];
        if (
          call?.kind !== "mcp_tool_call" ||
          start === undefined ||
          completion === undefined ||
          JSON.stringify(start) !== JSON.stringify({
            host: receipt.host,
            sessionIdDigest: receipt.sessionIdDigest,
            callIdDigest: call.callIdDigest,
            ordinal: call.ordinal,
            tool: call.tool,
            argumentsDigest: call.argumentsDigest,
          }) ||
          JSON.stringify(completion) !== JSON.stringify({
            host: receipt.host,
            sessionIdDigest: receipt.sessionIdDigest,
            callIdDigest: call.callIdDigest,
            ordinal: call.ordinal,
            tool: call.tool,
            argumentsDigest: call.argumentsDigest,
            resultDigest: call.resultDigest,
            success: true,
          })
        ) {
          this.#fail("invalid_transcript");
        }
      }
      this.#finished = true;
      return receipt;
    } catch (error) {
      if (error instanceof RealHostReceiptNormalizationError) {
        this.#failedCode ??= error.code;
        throw error;
      }
      this.#fail("invalid_transcript");
    }
  }
}

export function createStep16RealHostStreamObserverInternalV1(
  host: RealHostReceiptHostV1,
  expectedEventPlan: Step16ExpectedHostEventPlanV1,
): Step16RealHostStreamObserverInternalV1 {
  return new RealHostStreamObserverInternalV1(host, expectedEventPlan);
}
