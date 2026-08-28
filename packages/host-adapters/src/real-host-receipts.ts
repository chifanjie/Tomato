import { createHash } from "node:crypto";

export const REAL_HOST_RECEIPT_SCHEMA_VERSION = 1 as const;
export const REAL_HOST_ACTION_INPUT_DIGEST_DOMAIN_V1 =
  "understand-code-real-host-action-input-v1" as const;
export const STEP16_EXPECTED_HOST_EVENT_PLAN_DIGEST_DOMAIN_V1 =
  "understand-code-step16-expected-host-event-plan-v1" as const;

export const UNDERSTAND_CODE_REAL_HOST_TOOL_NAMES_V1 = Object.freeze([
  "get_repo_pulse",
  "build_task_brief",
  "get_task_brief",
  "update_task",
  "check_change",
  "record_verification",
  "open_workbench",
  "get_evidence",
  "search_context",
  "trace_impact",
  "refresh_index",
] as const);

export type RealHostReceiptHostV1 = "codex" | "claude";
export type UnderstandCodeRealHostToolV1 =
  (typeof UNDERSTAND_CODE_REAL_HOST_TOOL_NAMES_V1)[number];
export type RealHostActionV1 = "source_mutation" | "verification";
export type RealHostActionMechanismV1 = "file_change" | "command_execution";
export type Sha256DigestV1 = `sha256:${string}`;

export interface RealHostMcpToolCallReceiptV1 {
  readonly kind: "mcp_tool_call";
  readonly server: "understand-code";
  readonly tool: UnderstandCodeRealHostToolV1;
  readonly ordinal: number;
  readonly callIdDigest: Sha256DigestV1;
  readonly argumentsDigest: Sha256DigestV1;
  readonly resultDigest: Sha256DigestV1;
  readonly success: true;
}

export type RealHostToolCallReceiptV1 = RealHostMcpToolCallReceiptV1;

export interface RealHostActionReceiptV1 {
  readonly kind: "host_action";
  readonly action: RealHostActionV1;
  readonly mechanism: RealHostActionMechanismV1;
  readonly ordinal: number;
  readonly actionIdDigest: Sha256DigestV1;
  readonly inputDigest: Sha256DigestV1;
  readonly resultDigest: Sha256DigestV1;
  readonly success: true;
}

export type RealHostEventReceiptV1 =
  | RealHostMcpToolCallReceiptV1
  | RealHostActionReceiptV1;

export interface RealHostTranscriptReceiptV1 {
  readonly schemaVersion: typeof REAL_HOST_RECEIPT_SCHEMA_VERSION;
  readonly host: RealHostReceiptHostV1;
  readonly sessionIdDigest: Sha256DigestV1;
  readonly events: readonly RealHostEventReceiptV1[];
}

export interface Step16ExpectedHostMcpToolCallV1 {
  readonly kind: "mcp_tool_call";
  readonly ordinal: number;
  readonly server: "understand-code";
  readonly tool: UnderstandCodeRealHostToolV1;
}

export interface Step16ExpectedHostActionV1 {
  readonly kind: "host_action";
  readonly ordinal: number;
  readonly action: RealHostActionV1;
  readonly mechanism: RealHostActionMechanismV1;
  readonly inputDigest: Sha256DigestV1;
}

export type Step16ExpectedHostEventV1 =
  | Step16ExpectedHostMcpToolCallV1
  | Step16ExpectedHostActionV1;

export interface Step16ExpectedHostEventPlanV1 {
  readonly expectedEventPlanDigest: Sha256DigestV1;
  readonly events: readonly Step16ExpectedHostEventV1[];
}

export type RealHostReceiptNormalizationErrorCode =
  | "invalid_transcript"
  | "invalid_expected_event_plan"
  | "mixed_session"
  | "unexpected_event"
  | "unexpected_tool_call"
  | "call_pair_mismatch"
  | "tool_call_failed"
  | "host_action_failed"
  | "incomplete_transcript";

export class RealHostReceiptNormalizationError extends Error {
  readonly code: RealHostReceiptNormalizationErrorCode;

  constructor(code: RealHostReceiptNormalizationErrorCode) {
    super(`Real Host transcript rejected: ${code}.`);
    this.name = "RealHostReceiptNormalizationError";
    this.code = code;
  }
}

type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

type JsonRecord = Record<string, JsonValue>;

const SERVER_NAME = "understand-code" as const;
const CLAUDE_TOOL_PREFIX = `mcp__${SERVER_NAME}__`;
const RECEIPT_DIGEST_DOMAIN = "understand-code-real-host-events-v1";
const MAX_TRANSCRIPT_BYTES = 32 * 1024 * 1024;
const MAX_TRANSCRIPT_EVENTS = 50_000;
const MAX_PUBLIC_EVENTS = 256;
const MAX_IDENTIFIER_BYTES = 4_096;
const MAX_JSON_DEPTH = 128;
const PUBLISHED_TOOL_NAMES = new Set<string>(UNDERSTAND_CODE_REAL_HOST_TOOL_NAMES_V1);
const ACTIONS = new Set<string>(["source_mutation", "verification"]);
const ACTION_MECHANISMS = new Set<string>(["file_change", "command_execution"]);

function actionMatchesMechanism(
  action: unknown,
  mechanism: unknown,
): action is RealHostActionV1 {
  return (
    (action === "source_mutation" && mechanism === "file_change") ||
    (action === "verification" && mechanism === "command_execution")
  );
}

function reject(code: RealHostReceiptNormalizationErrorCode): never {
  throw new RealHostReceiptNormalizationError(code);
}

function isRecord(value: unknown): value is JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: JsonRecord, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function isUnicodeScalarString(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function safeIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Buffer.byteLength(value, "utf8") <= MAX_IDENTIFIER_BYTES &&
    isUnicodeScalarString(value) &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function canonicalJson(value: JsonValue, depth = 0): string {
  if (depth > MAX_JSON_DEPTH) reject("invalid_transcript");
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) reject("invalid_transcript");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry, depth + 1)).join(",")}]`;
  }
  if (!isRecord(value)) reject("invalid_transcript");
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson(value[key] as JsonValue, depth + 1)}`,
    )
    .join(",")}}`;
}

function sha256(bytes: string): Sha256DigestV1 {
  return `sha256:${createHash("sha256").update(bytes, "utf8").digest("hex")}`;
}

function digestJson(value: JsonValue): Sha256DigestV1 {
  return sha256(canonicalJson(value));
}

/**
 * Bind a trusted Host action input using recursively key-sorted canonical JSON.
 * Arrays retain order; finite JSON numbers use JSON.stringify formatting.
 */
export function deriveStep16RealHostActionInputDigestV1(
  input: unknown,
): Sha256DigestV1 {
  return sha256(
    `${REAL_HOST_ACTION_INPUT_DIGEST_DOMAIN_V1}\u0000${canonicalJson(input as JsonValue)}`,
  );
}

/** Synchronously bind the canonical expected event sequence for Node Host execution. */
export function deriveStep16ExpectedHostEventPlanDigestV1(
  events: readonly Step16ExpectedHostEventV1[],
): Sha256DigestV1 {
  return sha256(
    `${STEP16_EXPECTED_HOST_EVENT_PLAN_DIGEST_DOMAIN_V1}\u0000${canonicalJson(events as unknown as JsonValue)}`,
  );
}

function fixedTraversalDigestEqual(
  left: Sha256DigestV1,
  right: Sha256DigestV1,
): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length, 71);
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function digestIdentifier(
  host: RealHostReceiptHostV1,
  kind: "session" | "event",
  value: unknown,
): Sha256DigestV1 {
  if (!safeIdentifier(value)) reject("invalid_transcript");
  return sha256(`${RECEIPT_DIGEST_DOMAIN}\u0000${host}\u0000${kind}\u0000${value}`);
}

function isDigest(value: unknown): value is Sha256DigestV1 {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
}

function parseJsonl(transcript: string): readonly JsonRecord[] {
  if (
    typeof transcript !== "string" ||
    transcript.length === 0 ||
    Buffer.byteLength(transcript, "utf8") > MAX_TRANSCRIPT_BYTES ||
    transcript.includes("\r")
  ) {
    reject("invalid_transcript");
  }
  const lines = transcript.split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (
    lines.length === 0 ||
    lines.length > MAX_TRANSCRIPT_EVENTS ||
    lines.some((line) => line.trim().length === 0)
  ) {
    reject("invalid_transcript");
  }
  return lines.map((line) => {
    let value: unknown;
    try {
      value = JSON.parse(line) as unknown;
    } catch {
      reject("invalid_transcript");
    }
    if (!isRecord(value)) reject("invalid_transcript");
    canonicalJson(value);
    return value;
  });
}

/** Validate and freeze the externally trusted event plan before Host execution. */
export function compileStep16ExpectedHostEventPlanV1(
  value: unknown,
): Step16ExpectedHostEventPlanV1 {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["expectedEventPlanDigest", "events"]) ||
    !isDigest(value.expectedEventPlanDigest) ||
    !Array.isArray(value.events) ||
    value.events.length < 1 ||
    value.events.length > MAX_PUBLIC_EVENTS
  ) {
    reject("invalid_expected_event_plan");
  }
  const events = value.events.map((event, index): Step16ExpectedHostEventV1 => {
    if (!isRecord(event) || event.ordinal !== index + 1) {
      reject("invalid_expected_event_plan");
    }
    if (event.kind === "mcp_tool_call") {
      if (
        !hasExactKeys(event, ["kind", "ordinal", "server", "tool"]) ||
        event.server !== SERVER_NAME ||
        typeof event.tool !== "string" ||
        !PUBLISHED_TOOL_NAMES.has(event.tool)
      ) {
        reject("invalid_expected_event_plan");
      }
      return Object.freeze({
        kind: "mcp_tool_call",
        ordinal: event.ordinal as number,
        server: SERVER_NAME,
        tool: event.tool as UnderstandCodeRealHostToolV1,
      });
    }
    if (
      event.kind !== "host_action" ||
      !hasExactKeys(event, [
        "kind",
        "ordinal",
        "action",
        "mechanism",
        "inputDigest",
      ]) ||
      typeof event.action !== "string" ||
      !ACTIONS.has(event.action) ||
      typeof event.mechanism !== "string" ||
      !ACTION_MECHANISMS.has(event.mechanism) ||
      !actionMatchesMechanism(event.action, event.mechanism) ||
      !isDigest(event.inputDigest)
    ) {
      reject("invalid_expected_event_plan");
    }
    return Object.freeze({
      kind: "host_action",
      ordinal: event.ordinal as number,
      action: event.action as RealHostActionV1,
      mechanism: event.mechanism as RealHostActionMechanismV1,
      inputDigest: event.inputDigest as Sha256DigestV1,
    });
  });
  const expectedEventPlanDigest = value.expectedEventPlanDigest as Sha256DigestV1;
  const derivedEventPlanDigest = deriveStep16ExpectedHostEventPlanDigestV1(events);
  if (!fixedTraversalDigestEqual(expectedEventPlanDigest, derivedEventPlanDigest)) {
    reject("invalid_expected_event_plan");
  }
  return Object.freeze({
    expectedEventPlanDigest: derivedEventPlanDigest,
    events: Object.freeze(events),
  });
}

function nextExpectedEvent(
  expectedEvents: readonly Step16ExpectedHostEventV1[],
  receipts: readonly RealHostEventReceiptV1[],
): Step16ExpectedHostEventV1 {
  const event = expectedEvents[receipts.length];
  if (event === undefined) reject("unexpected_event");
  return event;
}

function freezeReceipt(
  host: RealHostReceiptHostV1,
  sessionId: string,
  events: readonly RealHostEventReceiptV1[],
  expectedCount: number,
): RealHostTranscriptReceiptV1 {
  if (events.length !== expectedCount) reject("incomplete_transcript");
  return Object.freeze({
    schemaVersion: REAL_HOST_RECEIPT_SCHEMA_VERSION,
    host,
    sessionIdDigest: digestIdentifier(host, "session", sessionId),
    events: Object.freeze(events.map((event) => Object.freeze(event))),
  });
}

interface PendingMcpCall {
  readonly kind: "mcp_tool_call";
  readonly id: string;
  readonly expected: Step16ExpectedHostMcpToolCallV1;
  readonly arguments: JsonRecord;
  readonly argumentsDigest: Sha256DigestV1;
}

interface PendingHostAction {
  readonly kind: "host_action";
  readonly id: string;
  readonly expected: Step16ExpectedHostActionV1;
  readonly input: JsonRecord;
  readonly inputDigest: Sha256DigestV1;
}

type PendingEvent = PendingMcpCall | PendingHostAction;

function reserveEventId(seenIds: Set<string>, value: unknown): string {
  if (!safeIdentifier(value) || seenIds.has(value)) reject("call_pair_mismatch");
  seenIds.add(value);
  return value;
}

function expectedMcp(
  event: Step16ExpectedHostEventV1,
  tool: unknown,
): Step16ExpectedHostMcpToolCallV1 {
  if (
    event.kind !== "mcp_tool_call" ||
    event.server !== SERVER_NAME ||
    event.tool !== tool
  ) {
    reject("unexpected_tool_call");
  }
  return event;
}

function expectedAction(
  event: Step16ExpectedHostEventV1,
  mechanism: RealHostActionMechanismV1,
): Step16ExpectedHostActionV1 {
  if (event.kind !== "host_action" || event.mechanism !== mechanism) {
    reject("unexpected_tool_call");
  }
  return event;
}

function bindExpectedActionInput(
  expected: Step16ExpectedHostActionV1,
  input: JsonRecord,
): Sha256DigestV1 {
  const inputDigest = deriveStep16RealHostActionInputDigestV1(input);
  if (inputDigest !== expected.inputDigest) reject("unexpected_tool_call");
  return inputDigest;
}

function codexChanges(value: unknown): readonly JsonRecord[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.some(
      (change) =>
        !isRecord(change) ||
        !hasExactKeys(change, ["kind", "path"]) ||
        !nonEmptyString(change.path) ||
        (change.kind !== "add" && change.kind !== "update" && change.kind !== "delete"),
    )
  ) {
    reject("invalid_transcript");
  }
  return value as readonly JsonRecord[];
}

function codexMcpResult(value: unknown): JsonRecord {
  if (
    !isRecord(value) ||
    !Array.isArray(value.content) ||
    Object.keys(value).some(
      (key) => key !== "content" && key !== "_meta" && key !== "structured_content",
    )
  ) {
    reject("call_pair_mismatch");
  }
  return value;
}

function pushCodexFileChangeReceipt(
  receipts: RealHostEventReceiptV1[],
  pending: PendingHostAction,
  item: JsonRecord,
  changes: readonly JsonRecord[],
): void {
  if (
    pending.expected.mechanism !== "file_change" ||
    item.id !== pending.id ||
    item.status !== "completed" ||
    canonicalJson(changes) !== canonicalJson(pending.input.changes as JsonValue) ||
    (item.error !== null && item.error !== undefined)
  ) {
    reject("host_action_failed");
  }
  receipts.push({
    kind: "host_action",
    action: pending.expected.action,
    mechanism: "file_change",
    ordinal: pending.expected.ordinal,
    actionIdDigest: digestIdentifier("codex", "event", pending.id),
    inputDigest: pending.inputDigest,
    resultDigest: digestJson({ changes, status: item.status }),
    success: true,
  });
}

function normalizeCodex(
  rawEvents: readonly JsonRecord[],
  expectedEvents: readonly Step16ExpectedHostEventV1[],
): RealHostTranscriptReceiptV1 {
  let sessionId: string | undefined;
  let turnStarted = false;
  let turnCompleted = false;
  let pending: PendingEvent | undefined;
  const seenIds = new Set<string>();
  const receipts: RealHostEventReceiptV1[] = [];

  for (let index = 0; index < rawEvents.length; index += 1) {
    const event = rawEvents[index] as JsonRecord;
    if (event.type === "thread.started") {
      if (index !== 0 || sessionId !== undefined || !safeIdentifier(event.thread_id)) {
        reject(sessionId === undefined ? "invalid_transcript" : "mixed_session");
      }
      sessionId = event.thread_id;
      continue;
    }
    if (sessionId === undefined) reject("invalid_transcript");
    if (Object.hasOwn(event, "thread_id") && event.thread_id !== sessionId) {
      reject("mixed_session");
    }
    if (event.type === "turn.started") {
      if (turnStarted || turnCompleted) reject("unexpected_event");
      turnStarted = true;
      continue;
    }
    if (event.type === "turn.completed") {
      if (
        !turnStarted ||
        turnCompleted ||
        pending !== undefined ||
        receipts.length !== expectedEvents.length
      ) {
        reject("incomplete_transcript");
      }
      turnCompleted = true;
      continue;
    }
    if (event.type === "turn.failed" || event.type === "error") {
      reject("tool_call_failed");
    }
    if (event.type !== "item.started" && event.type !== "item.completed") {
      reject("unexpected_event");
    }
    const item = event.item;
    if (!isRecord(item) || typeof item.type !== "string") {
      reject("invalid_transcript");
    }
    if (item.type === "agent_message" || item.type === "reasoning") continue;
    if (!turnStarted || turnCompleted) reject("unexpected_event");

    if (item.type === "mcp_tool_call") {
      if (
        item.server !== SERVER_NAME ||
        typeof item.tool !== "string" ||
        !isRecord(item.arguments)
      ) {
        reject("unexpected_tool_call");
      }
      if (event.type === "item.started") {
        if (
          pending !== undefined ||
          item.status !== "in_progress" ||
          (item.result !== null && item.result !== undefined) ||
          (item.error !== null && item.error !== undefined)
        ) {
          reject("call_pair_mismatch");
        }
        const expected = expectedMcp(
          nextExpectedEvent(expectedEvents, receipts),
          item.tool,
        );
        pending = {
          kind: "mcp_tool_call",
          id: reserveEventId(seenIds, item.id),
          expected,
          arguments: item.arguments,
          argumentsDigest: digestJson(item.arguments),
        };
        continue;
      }
      if (
        item.status === "failed" ||
        (item.error !== null && item.error !== undefined)
      ) {
        reject("tool_call_failed");
      }
      const result = codexMcpResult(item.result);
      if (
        pending?.kind !== "mcp_tool_call" ||
        item.id !== pending.id ||
        item.tool !== pending.expected.tool ||
        item.status !== "completed" ||
        canonicalJson(item.arguments) !== canonicalJson(pending.arguments)
      ) {
        reject("call_pair_mismatch");
      }
      receipts.push({
        kind: "mcp_tool_call",
        server: SERVER_NAME,
        tool: pending.expected.tool,
        ordinal: pending.expected.ordinal,
        callIdDigest: digestIdentifier("codex", "event", pending.id),
        argumentsDigest: pending.argumentsDigest,
        resultDigest: digestJson(result),
        success: true,
      });
      pending = undefined;
      continue;
    }

    if (item.type === "command_execution") {
      if (!nonEmptyString(item.command)) reject("invalid_transcript");
      if (event.type === "item.started") {
        if (
          pending !== undefined ||
          item.status !== "in_progress" ||
          (item.exit_code !== null && item.exit_code !== undefined) ||
          (item.aggregated_output !== undefined && item.aggregated_output !== "") ||
          (item.error !== null && item.error !== undefined)
        ) {
          reject("call_pair_mismatch");
        }
        const expected = expectedAction(
          nextExpectedEvent(expectedEvents, receipts),
          "command_execution",
        );
        const input: JsonRecord = { command: item.command };
        const inputDigest = bindExpectedActionInput(expected, input);
        pending = {
          kind: "host_action",
          id: reserveEventId(seenIds, item.id),
          expected,
          input,
          inputDigest,
        };
        continue;
      }
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
        reject("host_action_failed");
      }
      receipts.push({
        kind: "host_action",
        action: pending.expected.action,
        mechanism: "command_execution",
        ordinal: pending.expected.ordinal,
        actionIdDigest: digestIdentifier("codex", "event", pending.id),
        inputDigest: pending.inputDigest,
        resultDigest: digestJson({
          aggregatedOutput: item.aggregated_output ?? "",
          exitCode: item.exit_code,
          status: item.status,
        }),
        success: true,
      });
      pending = undefined;
      continue;
    }

    if (item.type === "file_change") {
      const changes = codexChanges(item.changes);
      if (event.type === "item.started") {
        if (
          pending !== undefined ||
          item.status !== "in_progress" ||
          (item.error !== null && item.error !== undefined)
        ) {
          reject("call_pair_mismatch");
        }
        const expected = expectedAction(
          nextExpectedEvent(expectedEvents, receipts),
          "file_change",
        );
        const input: JsonRecord = { changes };
        const inputDigest = bindExpectedActionInput(expected, input);
        pending = {
          kind: "host_action",
          id: reserveEventId(seenIds, item.id),
          expected,
          input,
          inputDigest,
        };
        continue;
      }
      if (pending === undefined) {
        const expected = expectedAction(
          nextExpectedEvent(expectedEvents, receipts),
          "file_change",
        );
        const input: JsonRecord = { changes };
        const inputDigest = bindExpectedActionInput(expected, input);
        const directPending: PendingHostAction = {
          kind: "host_action",
          id: reserveEventId(seenIds, item.id),
          expected,
          input,
          inputDigest,
        };
        pushCodexFileChangeReceipt(receipts, directPending, item, changes);
        continue;
      }
      if (pending.kind !== "host_action") reject("call_pair_mismatch");
      pushCodexFileChangeReceipt(receipts, pending, item, changes);
      pending = undefined;
      continue;
    }

    reject("unexpected_tool_call");
  }

  if (sessionId === undefined || !turnStarted || !turnCompleted || pending !== undefined) {
    reject("incomplete_transcript");
  }
  return freezeReceipt("codex", sessionId, receipts, expectedEvents.length);
}

function claudeSessionId(event: JsonRecord, expected?: string): string {
  if (!safeIdentifier(event.session_id)) reject("invalid_transcript");
  if (expected !== undefined && event.session_id !== expected) reject("mixed_session");
  return event.session_id;
}

function validateClaudeActionInput(
  toolName: "Edit" | "Write" | "Bash",
  input: JsonRecord,
): RealHostActionMechanismV1 {
  if (toolName === "Edit") {
    if (
      !nonEmptyString(input.file_path) ||
      typeof input.old_string !== "string" ||
      typeof input.new_string !== "string"
    ) {
      reject("invalid_transcript");
    }
    return "file_change";
  }
  if (toolName === "Write") {
    if (!nonEmptyString(input.file_path) || typeof input.content !== "string") {
      reject("invalid_transcript");
    }
    return "file_change";
  }
  if (!nonEmptyString(input.command) || input.run_in_background === true) {
    reject("invalid_transcript");
  }
  return "command_execution";
}

function normalizeClaude(
  rawEvents: readonly JsonRecord[],
  expectedEvents: readonly Step16ExpectedHostEventV1[],
): RealHostTranscriptReceiptV1 {
  let sessionId: string | undefined;
  let resultObserved = false;
  let pending: PendingEvent | undefined;
  const seenIds = new Set<string>();
  const receipts: RealHostEventReceiptV1[] = [];

  for (let index = 0; index < rawEvents.length; index += 1) {
    const event = rawEvents[index] as JsonRecord;
    const currentSessionId = claudeSessionId(event, sessionId);
    if (event.type === "system") {
      if (index !== 0 || sessionId !== undefined || event.subtype !== "init") {
        reject(sessionId === undefined ? "invalid_transcript" : "unexpected_event");
      }
      sessionId = currentSessionId;
      continue;
    }
    if (sessionId === undefined || resultObserved) reject("unexpected_event");

    if (event.type === "assistant") {
      if (event.parent_tool_use_id !== null || !isRecord(event.message)) {
        reject("mixed_session");
      }
      const content = event.message.content;
      if (event.message.role !== "assistant" || !Array.isArray(content)) {
        reject("invalid_transcript");
      }
      for (const block of content) {
        if (!isRecord(block) || typeof block.type !== "string") {
          reject("invalid_transcript");
        }
        if (block.type === "text" || block.type === "thinking" || block.type === "redacted_thinking") {
          continue;
        }
        if (
          block.type !== "tool_use" ||
          pending !== undefined ||
          !safeIdentifier(block.id) ||
          !nonEmptyString(block.name) ||
          !isRecord(block.input)
        ) {
          reject("unexpected_tool_call");
        }
        const expected = nextExpectedEvent(expectedEvents, receipts);
        const id = reserveEventId(seenIds, block.id);
        if (block.name.startsWith(CLAUDE_TOOL_PREFIX)) {
          const tool = block.name.slice(CLAUDE_TOOL_PREFIX.length);
          const expectedCall = expectedMcp(expected, tool);
          pending = {
            kind: "mcp_tool_call",
            id,
            expected: expectedCall,
            arguments: block.input,
            argumentsDigest: digestJson(block.input),
          };
          continue;
        }
        if (block.name !== "Edit" && block.name !== "Write" && block.name !== "Bash") {
          reject("unexpected_tool_call");
        }
        const mechanism = validateClaudeActionInput(block.name, block.input);
        const expectedHostAction = expectedAction(expected, mechanism);
        const inputDigest = bindExpectedActionInput(expectedHostAction, block.input);
        pending = {
          kind: "host_action",
          id,
          expected: expectedHostAction,
          input: block.input,
          inputDigest,
        };
      }
      continue;
    }

    if (event.type === "user") {
      if (
        event.parent_tool_use_id !== null ||
        pending === undefined ||
        !isRecord(event.message) ||
        event.message.role !== "user" ||
        !Array.isArray(event.message.content) ||
        event.message.content.length !== 1 ||
        !Object.hasOwn(event, "tool_use_result")
      ) {
        reject("call_pair_mismatch");
      }
      const block = event.message.content[0];
      if (
        !isRecord(block) ||
        block.type !== "tool_result" ||
        block.tool_use_id !== pending.id ||
        (block.is_error !== undefined && block.is_error !== false) ||
        (block.content !== undefined &&
          typeof block.content !== "string" &&
          !Array.isArray(block.content))
      ) {
        if (pending.kind === "host_action") reject("host_action_failed");
        if (isRecord(block) && block.is_error === true) reject("tool_call_failed");
        reject("call_pair_mismatch");
      }
      const result: JsonRecord = {
        content: (block.content ?? null) as JsonValue,
        toolUseResult: event.tool_use_result as JsonValue,
      };
      canonicalJson(result);
      if (pending.kind === "mcp_tool_call") {
        receipts.push({
          kind: "mcp_tool_call",
          server: SERVER_NAME,
          tool: pending.expected.tool,
          ordinal: pending.expected.ordinal,
          callIdDigest: digestIdentifier("claude", "event", pending.id),
          argumentsDigest: pending.argumentsDigest,
          resultDigest: digestJson(result),
          success: true,
        });
      } else {
        receipts.push({
          kind: "host_action",
          action: pending.expected.action,
          mechanism: pending.expected.mechanism,
          ordinal: pending.expected.ordinal,
          actionIdDigest: digestIdentifier("claude", "event", pending.id),
          inputDigest: pending.inputDigest,
          resultDigest: digestJson(result),
          success: true,
        });
      }
      pending = undefined;
      continue;
    }

    if (event.type === "result") {
      const denials = event.permission_denials;
      if (
        index !== rawEvents.length - 1 ||
        event.subtype !== "success" ||
        event.is_error !== false ||
        pending !== undefined ||
        receipts.length !== expectedEvents.length ||
        (denials !== undefined && (!Array.isArray(denials) || denials.length !== 0))
      ) {
        reject("tool_call_failed");
      }
      resultObserved = true;
      continue;
    }

    reject("unexpected_event");
  }

  if (sessionId === undefined || !resultObserved || pending !== undefined) {
    reject("incomplete_transcript");
  }
  return freezeReceipt("claude", sessionId, receipts, expectedEvents.length);
}

/**
 * Reduce a real non-interactive Host JSONL stream to a path-safe receipt.
 * The external plan alone declares the expected action taxonomy and order.
 * Parsing transport evidence never makes a Gold claim.
 */
export function normalizeStep16RealHostJsonlTranscriptV1(
  host: RealHostReceiptHostV1,
  transcript: string,
  expectedEventPlan: Step16ExpectedHostEventPlanV1,
): RealHostTranscriptReceiptV1 {
  const expectedEvents = compileStep16ExpectedHostEventPlanV1(expectedEventPlan).events;
  const rawEvents = parseJsonl(transcript);
  if (host === "codex") return normalizeCodex(rawEvents, expectedEvents);
  if (host === "claude") return normalizeClaude(rawEvents, expectedEvents);
  reject("invalid_transcript");
}
