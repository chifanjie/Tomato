import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  CONTRACT_JSON_SCHEMA_SOURCES_V1,
  generateContractJsonSchemasV1,
} from "../src/json-schema.js";
import { P0_MCP_TOOL_NAMES_V1 } from "../src/mcp.js";

const schemaRoot = fileURLToPath(new URL("../schemas/v1", import.meta.url));

type JsonSchema = Record<string, unknown>;

const PATTERN_SAMPLES = new Map<string, string>([
  [
    "^(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$",
    "3.0.0-alpha.1",
  ],
  ["^[0-9A-HJKMNP-TV-Z]{26}$", "01ARZ3NDEKTSV4RRFFQ69G5FAV"],
  ["^sha256:[0-9a-f]{64}$", `sha256:${"0".repeat(64)}`],
  ["^hmac-sha256:[0-9a-f]{64}$", `hmac-sha256:${"0".repeat(64)}`],
  ["^repo-hmac-[0-9a-f]{64}$", `repo-hmac-${"0".repeat(64)}`],
  ["^worktree-hmac-[0-9a-f]{64}$", `worktree-hmac-${"0".repeat(64)}`],
  ["^root-hmac-[0-9a-f]{64}$", `root-hmac-${"0".repeat(64)}`],
  ["^snapshot-[0-9a-f]{64}$", `snapshot-${"0".repeat(64)}`],
  ["^change-[0-9a-f]{64}$", `change-${"0".repeat(64)}`],
  [
    "^snapshot-redaction-[0-9a-f]{64}$",
    `snapshot-redaction-${"0".repeat(64)}`,
  ],
  [
    "^snapshot-unknown-state-[0-9a-f]{64}$",
    `snapshot-unknown-state-${"0".repeat(64)}`,
  ],
  [
    "^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,9})?Z$",
    "2026-07-28T08:00:00Z",
  ],
  ["^(?:[0-9a-f]{40}|[0-9a-f]{64})$", "a".repeat(40)],
  [
    "^http:\\/\\/127\\.0\\.0\\.1:([1-9]\\d{0,4})\\/[^#\\s]*#[^\\s]+$",
    "http://127.0.0.1:3000/tasks#launch-token",
  ],
]);

function asSchema(value: unknown, context: string): JsonSchema {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${context} is not a JSON Schema object`);
  }
  return value as JsonSchema;
}

function schemaArray(
  schema: JsonSchema,
  keyword: "oneOf" | "anyOf" | "prefixItems",
): JsonSchema[] | undefined {
  const value = schema[keyword];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new TypeError(`${keyword} must be an array`);
  }
  return value.map((entry, index) =>
    asSchema(entry, `${keyword}[${index}]`),
  );
}

/**
 * Builds one transport-structural example directly from generated JSON Schema.
 * It intentionally does not try to satisfy Zod superRefine rules, which are
 * outside the documented JSON Schema boundary.
 */
function structuralExample(schema: JsonSchema): unknown {
  if ("const" in schema) return schema.const;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];

  const oneOf = schemaArray(schema, "oneOf");
  if (oneOf !== undefined) return structuralExample(oneOf[0]!);
  const anyOf = schemaArray(schema, "anyOf");
  if (anyOf !== undefined) return structuralExample(anyOf[0]!);

  switch (schema.type) {
    case "object": {
      const properties =
        schema.properties === undefined
          ? {}
          : asSchema(schema.properties, "properties");
      const required = Array.isArray(schema.required)
        ? schema.required
        : [];
      const result: Record<string, unknown> = {};
      for (const propertyName of required) {
        if (typeof propertyName !== "string") {
          throw new TypeError("required entries must be strings");
        }
        result[propertyName] = structuralExample(
          asSchema(properties[propertyName], `properties.${propertyName}`),
        );
      }
      return result;
    }
    case "array": {
      const prefixItems = schemaArray(schema, "prefixItems");
      if (prefixItems !== undefined) {
        return prefixItems.map((itemSchema) => structuralExample(itemSchema));
      }
      const minimumItems =
        typeof schema.minItems === "number" ? schema.minItems : 0;
      if (minimumItems === 0) return [];
      const itemSchema = asSchema(schema.items, "items");
      return Array.from({ length: minimumItems }, () =>
        structuralExample(itemSchema),
      );
    }
    case "integer":
    case "number": {
      if (typeof schema.minimum === "number") return schema.minimum;
      if (typeof schema.exclusiveMinimum === "number") {
        return schema.exclusiveMinimum + 1;
      }
      return 0;
    }
    case "boolean":
      return false;
    case "string": {
      if (typeof schema.pattern === "string") {
        const sample = PATTERN_SAMPLES.get(schema.pattern);
        if (sample === undefined) {
          throw new Error(`No structural sample registered for ${schema.pattern}`);
        }
        return sample;
      }
      const minimumLength =
        typeof schema.minLength === "number" ? schema.minLength : 0;
      return "x".repeat(minimumLength);
    }
    default:
      // z.unknown() is emitted as an unconstrained schema.
      if (Object.keys(schema).length === 0) return null;
      throw new Error(
        `Unsupported generated JSON Schema shape: ${JSON.stringify(schema)}`,
      );
  }
}

describe("generated JSON Schema distribution", () => {
  it("tracks one current draft-2020-12 document for every registered contract", () => {
    for (const [name, schema] of Object.entries(
      CONTRACT_JSON_SCHEMA_SOURCES_V1,
    )) {
      expect(schema, `${name} must resolve to a runtime Zod schema`).toBeDefined();
    }
    const generated = generateContractJsonSchemasV1();
    const expectedCount =
      Object.keys(CONTRACT_JSON_SCHEMA_SOURCES_V1).length +
      P0_MCP_TOOL_NAMES_V1.length * 2;
    const fileNames = readdirSync(schemaRoot)
      .filter((name) => name.endsWith(".schema.json"))
      .sort();

    expect(Object.keys(generated)).toHaveLength(expectedCount);
    expect(fileNames).toHaveLength(expectedCount);

    for (const [name, schema] of Object.entries(generated)) {
      const tracked = JSON.parse(
        readFileSync(join(schemaRoot, `${name}.schema.json`), "utf8"),
      ) as Record<string, unknown>;
      expect(tracked).toEqual(schema);
      expect(tracked.$schema).toBe(
        "https://json-schema.org/draft/2020-12/schema",
      );
      expect(tracked.$id).toBe(`urn:understand-code:schema:v1:${name}`);
    }
  });

  it("compiles every tracked schema with an independent draft-2020 validator", () => {
    const ajv = new Ajv2020({
      allErrors: true,
      strict: false,
      validateFormats: false,
    });

    for (const fileName of readdirSync(schemaRoot).filter((name) =>
      name.endsWith(".schema.json"),
    )) {
      const schema = JSON.parse(
        readFileSync(join(schemaRoot, fileName), "utf8"),
      );
      expect(() => ajv.compile(schema), fileName).not.toThrow();
    }
  });

  it("accepts a generated structural example and rejects unknown fields for every public schema", () => {
    const ajv = new Ajv2020({
      allErrors: true,
      strict: false,
      validateFormats: false,
    });

    for (const fileName of readdirSync(schemaRoot).filter((name) =>
      name.endsWith(".schema.json"),
    )) {
      const schema = JSON.parse(
        readFileSync(join(schemaRoot, fileName), "utf8"),
      ) as JsonSchema;
      const validate = ajv.compile(schema);
      const validExample = structuralExample(schema);
      expect(
        validate(validExample),
        `${fileName} generated example: ${JSON.stringify(validate.errors)}`,
      ).toBe(true);

      expect(
        validExample !== null &&
          typeof validExample === "object" &&
          !Array.isArray(validExample),
        `${fileName} must expose a strict object transport root`,
      ).toBe(true);
      const structurallyInvalid = {
        ...(validExample as Record<string, unknown>),
        __unexpectedContractField: true,
      };
      expect(
        validate(structurallyInvalid),
        `${fileName} accepted an unknown transport field`,
      ).toBe(false);
    }
  });
});
