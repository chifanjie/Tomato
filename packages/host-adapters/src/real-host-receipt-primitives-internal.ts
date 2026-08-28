import { createHash } from "node:crypto";

const RECEIPT_DIGEST_DOMAIN_V1 = "understand-code-real-host-events-v1";
const MAX_IDENTIFIER_BYTES_V1 = 4_096;
const MAX_JSON_DEPTH_V1 = 128;

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

export type RealHostJsonValueInternalV1 =
  | null
  | boolean
  | number
  | string
  | readonly RealHostJsonValueInternalV1[]
  | { readonly [key: string]: RealHostJsonValueInternalV1 };

export type RealHostJsonRecordInternalV1 = Record<
  string,
  RealHostJsonValueInternalV1
>;

export function isRealHostJsonRecordInternalV1(
  value: unknown,
): value is RealHostJsonRecordInternalV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isUnicodeScalarStringInternalV1(value: string): boolean {
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

export function safeRealHostIdentifierInternalV1(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    Buffer.byteLength(value, "utf8") <= MAX_IDENTIFIER_BYTES_V1 &&
    isUnicodeScalarStringInternalV1(value) &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

export function canonicalRealHostJsonInternalV1(
  value: RealHostJsonValueInternalV1,
  depth = 0,
): string {
  if (depth > MAX_JSON_DEPTH_V1) {
    throw new RealHostReceiptNormalizationError("invalid_transcript");
  }
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RealHostReceiptNormalizationError("invalid_transcript");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) =>
      canonicalRealHostJsonInternalV1(entry, depth + 1)
    ).join(",")}]`;
  }
  if (!isRealHostJsonRecordInternalV1(value)) {
    throw new RealHostReceiptNormalizationError("invalid_transcript");
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) =>
      `${JSON.stringify(key)}:${canonicalRealHostJsonInternalV1(
        value[key] as RealHostJsonValueInternalV1,
        depth + 1,
      )}`
    )
    .join(",")}}`;
}

export function sha256RealHostTextInternalV1(
  value: string,
): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function digestRealHostJsonInternalV1(
  value: RealHostJsonValueInternalV1,
): `sha256:${string}` {
  return sha256RealHostTextInternalV1(canonicalRealHostJsonInternalV1(value));
}

export function digestRealHostIdentifierInternalV1(
  host: "codex" | "claude",
  kind: "session" | "event",
  value: unknown,
): `sha256:${string}` {
  if (!safeRealHostIdentifierInternalV1(value)) {
    throw new RealHostReceiptNormalizationError("invalid_transcript");
  }
  return sha256RealHostTextInternalV1(
    `${RECEIPT_DIGEST_DOMAIN_V1}\u0000${host}\u0000${kind}\u0000${value}`,
  );
}

/** Parse exactly one delimiter-free JSONL record using the receipt validator. */
export function parseRealHostJsonlRecordInternalV1(
  line: string,
): RealHostJsonRecordInternalV1 {
  if (
    typeof line !== "string" ||
    line.length === 0 ||
    line.includes("\r") ||
    line.includes("\n") ||
    line.trim().length === 0
  ) {
    throw new RealHostReceiptNormalizationError("invalid_transcript");
  }
  let value: unknown;
  try {
    value = JSON.parse(line) as unknown;
  } catch {
    throw new RealHostReceiptNormalizationError("invalid_transcript");
  }
  if (!isRealHostJsonRecordInternalV1(value)) {
    throw new RealHostReceiptNormalizationError("invalid_transcript");
  }
  canonicalRealHostJsonInternalV1(value);
  return value;
}
