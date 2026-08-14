export const RFC8785_JCS_SAFE_INTEGER_PROFILE_V1 =
  "rfc8785-jcs-safe-integer-v1" as const;

const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedArrayPrototypeJoinV1 = Array.prototype.join;
const CapturedArrayPrototypePushV1 = Array.prototype.push;
const CapturedArrayPrototypeSomeV1 = Array.prototype.some;
const CapturedArrayPrototypeSortV1 = Array.prototype.sort;
const CapturedJsonParseV1 = JSON.parse;
const CapturedJsonStringifyV1 = JSON.stringify;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetOwnPropertyDescriptorsV1 =
  Object.getOwnPropertyDescriptors;
const CapturedObjectGetOwnPropertySymbolsV1 = Object.getOwnPropertySymbols;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectIsV1 = Object.is;
const CapturedObjectKeysV1 = Object.keys;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedObjectPrototypeHasOwnPropertyV1 =
  Object.prototype.hasOwnProperty;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const CapturedSetV1 = Set;
const CapturedSetPrototypeAddV1 = Set.prototype.add;
const CapturedSetPrototypeDeleteV1 = Set.prototype.delete;
const CapturedSetPrototypeHasV1 = Set.prototype.has;
const CapturedStringV1 = String;
const CapturedStringPrototypeCharCodeAtV1 = String.prototype.charCodeAt;
const CapturedTextDecoderV1 = TextDecoder;
const CapturedTextDecoderPrototypeDecodeV1 = TextDecoder.prototype.decode;
const CapturedTextEncoderV1 = TextEncoder;
const CapturedTextEncoderPrototypeEncodeV1 = TextEncoder.prototype.encode;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedTypedArrayPrototypeV1 = CapturedObjectGetPrototypeOfV1(
  CapturedUint8ArrayV1.prototype,
);
const CapturedTypedArrayByteLengthGetterCandidateV1 =
  CapturedObjectGetOwnPropertyDescriptorV1(
    CapturedTypedArrayPrototypeV1,
    "byteLength",
  )?.get;

if (CapturedTypedArrayByteLengthGetterCandidateV1 === undefined) {
  throw new CapturedTypeErrorV1(
    "Uint8Array byteLength primordial unavailable",
  );
}
const CapturedTypedArrayByteLengthGetterV1 =
  CapturedTypedArrayByteLengthGetterCandidateV1;
// TextDecoder mutates internal BOM state during decode in Node. The instance is
// module-private and the method is captured, so freezing it would only break
// valid decoding without adding an authority boundary.
const CapturedUtf8DecoderV1 = new CapturedTextDecoderV1("utf-8", {
  fatal: true,
});
const CapturedUtf8EncoderV1 = Object.freeze(new CapturedTextEncoderV1());

function arrayJoinV1(array: readonly string[], separator: string): string {
  return CapturedReflectApplyV1(CapturedArrayPrototypeJoinV1, array, [
    separator,
  ]) as string;
}

function arrayPushV1<T>(array: T[], value: T): number {
  return CapturedReflectApplyV1(CapturedArrayPrototypePushV1, array, [
    value,
  ]) as number;
}

function arraySomeV1<T>(
  array: readonly T[],
  callback: (value: T, index: number, source: readonly T[]) => unknown,
): boolean {
  return CapturedReflectApplyV1(CapturedArrayPrototypeSomeV1, array, [
    callback,
  ]) as boolean;
}

function arraySortV1<T>(
  array: T[],
  compare: (left: T, right: T) => number,
): T[] {
  return CapturedReflectApplyV1(CapturedArrayPrototypeSortV1, array, [
    compare,
  ]) as T[];
}

function hasOwnPropertyV1(value: object, key: PropertyKey): boolean {
  return CapturedReflectApplyV1(
    CapturedObjectPrototypeHasOwnPropertyV1,
    value,
    [key],
  ) as boolean;
}

function setAddV1<T>(set: Set<T>, value: T): void {
  CapturedReflectApplyV1(CapturedSetPrototypeAddV1, set, [value]);
}

function setDeleteV1<T>(set: Set<T>, value: T): void {
  CapturedReflectApplyV1(CapturedSetPrototypeDeleteV1, set, [value]);
}

function setHasV1<T>(set: ReadonlySet<T>, value: T): boolean {
  return CapturedReflectApplyV1(CapturedSetPrototypeHasV1, set, [
    value,
  ]) as boolean;
}

function setFromValuesV1<T>(values: readonly T[]): Set<T> {
  const set = new CapturedSetV1<T>();
  for (let index = 0; index < values.length; index += 1) {
    setAddV1(set, values[index]!);
  }
  return set;
}

function stringCharCodeAtV1(value: string, index: number): number {
  return CapturedReflectApplyV1(CapturedStringPrototypeCharCodeAtV1, value, [
    index,
  ]) as number;
}

function typedArrayByteLengthV1(value: Uint8Array): number {
  return CapturedReflectApplyV1(
    CapturedTypedArrayByteLengthGetterV1,
    value,
    [],
  ) as number;
}

function decodeUtf8V1(value: Uint8Array): string {
  return CapturedReflectApplyV1(
    CapturedTextDecoderPrototypeDecodeV1,
    CapturedUtf8DecoderV1,
    [value],
  ) as string;
}

function encodeUtf8V1(value: string): Uint8Array {
  return CapturedReflectApplyV1(
    CapturedTextEncoderPrototypeEncodeV1,
    CapturedUtf8EncoderV1,
    [value],
  ) as Uint8Array;
}

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
    const codeUnit = stringCharCodeAtV1(value, index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = stringCharCodeAtV1(value, index + 1);
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
  return CapturedJsonStringifyV1(value) as string;
}

function canonicalizeArray(
  value: unknown[],
  path: string,
  active: Set<object>,
): string {
  if (setHasV1(active, value)) fail("cycle", path, "contains a cycle");
  setAddV1(active, value);
  try {
    const ownKeys = CapturedReflectOwnKeysV1(value);
    if (arraySomeV1(ownKeys, (key) => typeof key === "symbol")) {
      fail("unsupported_value", path, "contains a symbol property");
    }
    const expectedKeys = setFromValuesV1(["length"]);
    for (let index = 0; index < value.length; index += 1) {
      const key = CapturedStringV1(index);
      setAddV1(expectedKeys, key);
      if (!hasOwnPropertyV1(value, key)) {
        fail("invalid_object", `${path}[${index}]`, "is a sparse array slot");
      }
    }
    for (let index = 0; index < ownKeys.length; index += 1) {
      const key = ownKeys[index]!;
      if (typeof key === "string" && !setHasV1(expectedKeys, key)) {
        fail("invalid_object", path, `contains non-index array property ${key}`);
      }
    }

    const items: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
        value,
        CapturedStringV1(index),
      );
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
      arrayPushV1(
        items,
        canonicalizeValue(descriptor.value, `${path}[${index}]`, active),
      );
    }
    return `[${arrayJoinV1(items, ",")}]`;
  } finally {
    setDeleteV1(active, value);
  }
}

function canonicalizeObject(
  value: object,
  path: string,
  active: Set<object>,
): string {
  const prototype = CapturedObjectGetPrototypeOfV1(value);
  if (prototype !== CapturedObjectPrototypeV1 && prototype !== null) {
    fail("invalid_object", path, "must be a plain object");
  }
  if (setHasV1(active, value)) fail("cycle", path, "contains a cycle");
  setAddV1(active, value);
  try {
    const symbolKeys = CapturedObjectGetOwnPropertySymbolsV1(value);
    if (symbolKeys.length !== 0) {
      fail("unsupported_value", path, "contains a symbol property");
    }
    const descriptors = CapturedObjectGetOwnPropertyDescriptorsV1(value);
    const keys = arraySortV1(CapturedObjectKeysV1(descriptors), compareUtf16);
    const members: string[] = [];
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]!;
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
      arrayPushV1(
        members,
        `${quoteString(key, `${path} member name`)}:${canonicalizeValue(
          descriptor.value,
          `${path}.${key}`,
          active,
        )}`,
      );
    }
    return `{${arrayJoinV1(members, ",")}}`;
  } finally {
    setDeleteV1(active, value);
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
      if (!CapturedNumberIsSafeIntegerV1(value) || CapturedObjectIsV1(value, -0)) {
        fail(
          "invalid_number",
          path,
          "must be a safe integer and must not be negative zero",
        );
      }
      return CapturedJsonStringifyV1(value);
    case "object":
      return CapturedArrayIsArrayV1(value)
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
  return canonicalizeValue(value, "$", new CapturedSetV1<object>());
}

export function canonicalizeJcsSafeIntegerUtf8V1(
  value: unknown,
): Uint8Array {
  return encodeUtf8V1(canonicalizeJcsSafeIntegerV1(value));
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  const leftByteLength = typedArrayByteLengthV1(left);
  if (leftByteLength !== typedArrayByteLengthV1(right)) return false;
  let difference = 0;
  for (let index = 0; index < leftByteLength; index += 1) {
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
  if (!(bytes instanceof CapturedUint8ArrayV1)) {
    fail("unsupported_value", "$bytes", "must be a Uint8Array");
  }
  if (
    typedArrayByteLengthV1(bytes) >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    fail("non_canonical_bytes", "$bytes", "must not contain a UTF-8 BOM");
  }

  let text: string;
  try {
    text = decodeUtf8V1(bytes);
  } catch {
    fail("invalid_utf8", "$bytes", "is not valid UTF-8");
  }

  let parsed: unknown;
  try {
    parsed = CapturedJsonParseV1(text);
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
