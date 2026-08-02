export const RFC8785_JCS_SAFE_INTEGER_PROFILE_V1 =
  "rfc8785-jcs-safe-integer-v1" as const;

export class ProviderCanonicalJsonError extends TypeError {
  readonly code:
    | "invalid_utf8"
    | "non_canonical_bytes"
    | "unsupported_value"
    | "invalid_number"
    | "invalid_unicode"
    | "invalid_object"
    | "cycle";

  constructor(
    code: ProviderCanonicalJsonError["code"],
    message: string,
  ) {
    super(message);
    this.name = "ProviderCanonicalJsonError";
    this.code = code;
  }
}

function fail(
  code: ProviderCanonicalJsonError["code"],
  path: string,
  message: string,
): never {
  throw new ProviderCanonicalJsonError(code, `${path}: ${message}`);
}

function assertUnicodeScalarSequence(value: string, path: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        fail("invalid_unicode", path, "contains an unpaired high surrogate");
      }
      index += 1;
      continue;
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      fail("invalid_unicode", path, "contains an unpaired low surrogate");
    }
  }
}

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function quoteString(value: string, path: string): string {
  assertUnicodeScalarSequence(value, path);
  return JSON.stringify(value);
}

function canonicalizeArray(
  value: unknown[],
  path: string,
  active: Set<object>,
): string {
  if (active.has(value)) fail("cycle", path, "contains a cycle");
  active.add(value);
  try {
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key === "symbol")) {
      fail("unsupported_value", path, "contains a symbol property");
    }
    const expectedKeys = new Set<string>(["length"]);
    for (let index = 0; index < value.length; index += 1) {
      const key = String(index);
      expectedKeys.add(key);
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        fail("invalid_object", `${path}[${index}]`, "is a sparse array slot");
      }
    }
    for (const key of ownKeys) {
      if (typeof key === "string" && !expectedKeys.has(key)) {
        fail("invalid_object", path, `contains non-index array property ${key}`);
      }
    }

    const items: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        fail(
          "invalid_object",
          `${path}[${index}]`,
          "must be an enumerable data property",
        );
      }
      items.push(canonicalizeValue(descriptor.value, `${path}[${index}]`, active));
    }
    return `[${items.join(",")}]`;
  } finally {
    active.delete(value);
  }
}

function canonicalizeObject(
  value: object,
  path: string,
  active: Set<object>,
): string {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail("invalid_object", path, "must be a plain object");
  }
  if (active.has(value)) fail("cycle", path, "contains a cycle");
  active.add(value);
  try {
    const symbolKeys = Object.getOwnPropertySymbols(value);
    if (symbolKeys.length !== 0) {
      fail("unsupported_value", path, "contains a symbol property");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors).sort(compareUtf16);
    const members: string[] = [];
    for (const key of keys) {
      assertUnicodeScalarSequence(key, `${path} member name`);
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        fail(
          "invalid_object",
          `${path}.${key}`,
          "must be an enumerable data property",
        );
      }
      members.push(
        `${quoteString(key, `${path} member name`)}:${canonicalizeValue(
          descriptor.value,
          `${path}.${key}`,
          active,
        )}`,
      );
    }
    return `{${members.join(",")}}`;
  } finally {
    active.delete(value);
  }
}

function canonicalizeValue(
  value: unknown,
  path: string,
  active: Set<object>,
): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "string":
      return quoteString(value, path);
    case "number":
      if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
        fail(
          "invalid_number",
          path,
          "must be a safe integer and must not be negative zero",
        );
      }
      return JSON.stringify(value);
    case "object":
      return Array.isArray(value)
        ? canonicalizeArray(value, path, active)
        : canonicalizeObject(value, path, active);
    default:
      fail("unsupported_value", path, `does not support ${typeof value}`);
  }
}

/**
 * Serializes a previously schema-validated JSON value with the frozen WP5 JCS
 * profile. It deliberately rejects values that JSON.stringify would coerce or
 * silently omit.
 */
export function canonicalizeJcsSafeIntegerV1(value: unknown): string {
  return canonicalizeValue(value, "$", new Set<object>());
}

export function canonicalizeJcsSafeIntegerUtf8V1(
  value: unknown,
): Uint8Array {
  return new TextEncoder().encode(canonicalizeJcsSafeIntegerV1(value));
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

/**
 * Decodes only an exact canonical message. Re-canonicalization makes duplicate
 * members, member reordering, alternate number spellings, BOM, and surrounding
 * whitespace fail closed even though JSON.parse would otherwise accept some of
 * them.
 */
export function parseCanonicalJcsSafeIntegerUtf8V1(
  bytes: Uint8Array,
): unknown {
  if (!(bytes instanceof Uint8Array)) {
    fail("unsupported_value", "$bytes", "must be a Uint8Array");
  }
  if (
    bytes.byteLength >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    fail("non_canonical_bytes", "$bytes", "must not contain a UTF-8 BOM");
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("invalid_utf8", "$bytes", "is not valid UTF-8");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail("non_canonical_bytes", "$bytes", "is not valid JSON");
  }
  const canonical = canonicalizeJcsSafeIntegerUtf8V1(parsed);
  if (!bytesEqual(bytes, canonical)) {
    fail(
      "non_canonical_bytes",
      "$bytes",
      "does not exactly match the frozen canonical encoding",
    );
  }
  return parsed;
}
