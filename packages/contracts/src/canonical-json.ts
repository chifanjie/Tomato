export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export class CanonicalJsonError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalJsonError";
  }
}

function canonicalize(value: unknown, ancestors: Set<object>, path: string): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
    case "string":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) {
        throw new CanonicalJsonError(`${path} contains a non-finite number`);
      }
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    case "undefined":
    case "bigint":
    case "function":
    case "symbol":
      throw new CanonicalJsonError(`${path} is not a JSON value`);
    case "object":
      break;
    default:
      throw new CanonicalJsonError(`${path} is not a JSON value`);
  }

  if (ancestors.has(value)) {
    throw new CanonicalJsonError(`${path} contains a cycle`);
  }
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new CanonicalJsonError(`${path}[${index}] is a sparse array slot`);
        }
      }
      const extraKeys = Object.keys(value).filter((key) => !/^(?:0|[1-9]\d*)$/u.test(key));
      if (extraKeys.length > 0 || Object.getOwnPropertySymbols(value).length > 0) {
        throw new CanonicalJsonError(`${path} has non-JSON array properties`);
      }
      return `[${value
        .map((entry, index) => canonicalize(entry, ancestors, `${path}[${index}]`))
        .join(",")}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CanonicalJsonError(`${path} must be a plain JSON object`);
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new CanonicalJsonError(`${path} has symbol properties`);
    }

    const record = value as Record<string, unknown>;
    const propertyNames = Object.getOwnPropertyNames(record);
    for (const key of propertyNames) {
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (
        descriptor === undefined ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      ) {
        throw new CanonicalJsonError(`${path}.${key} is not a plain enumerable data property`);
      }
    }

    return `{${propertyNames
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalize(record[key], ancestors, `${path}.${key}`)}`,
      )
      .join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Returns deterministic JSON for a JSON-compatible value.
 *
 * Artifact stores hash the UTF-8 bytes of this string. This module intentionally
 * does not calculate the SHA-256 digest so it remains portable across Node and
 * browser consumers.
 */
export function canonicalizeJson(value: unknown): string {
  return canonicalize(value, new Set<object>(), "$");
}

export function cloneCanonicalJson(value: unknown): JsonValue {
  return JSON.parse(canonicalizeJson(value)) as JsonValue;
}
