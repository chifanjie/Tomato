import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  PROVIDER_CONTRACT_JSON_SCHEMA_SOURCES_V1,
  generateProviderContractJsonSchemasV1,
} from "../src/json-schema.js";

const schemaRoot = fileURLToPath(new URL("../schemas/v1", import.meta.url));

describe("provider contract JSON Schema distribution", () => {
  it("tracks one current document for every registered schema", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const fileNames = readdirSync(schemaRoot)
      .filter((name) => name.endsWith(".schema.json"))
      .sort();
    expect(fileNames).toHaveLength(
      Object.keys(PROVIDER_CONTRACT_JSON_SCHEMA_SOURCES_V1).length,
    );
    for (const [name, document] of Object.entries(generated)) {
      expect(
        JSON.parse(readFileSync(join(schemaRoot, `${name}.schema.json`), "utf8")),
      ).toEqual(document);
      expect(document.$schema).toBe(
        "https://json-schema.org/draft/2020-12/schema",
      );
      expect(document.$id).toBe(
        `urn:understand-code:provider-contract:schema:v1:${name}`,
      );
    }
  });

  it("carries canonical base64 trailing-bit validation into JSON Schema", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const pattern = generated["canonical-byte-string"].pattern;
    expect(typeof pattern).toBe("string");
    const expression = new RegExp(pattern as string, "u");
    for (const value of ["base64url:", "base64url:AA", "base64url:__8", "base64url:AAAA"]) {
      expect(expression.test(value), value).toBe(true);
    }
    for (const value of ["base64url:A", "base64url:AB", "base64url:AAF", "base64url:AA="]) {
      expect(expression.test(value), value).toBe(false);
    }
  });

  it("keeps domain field objects closed to unknown keys", () => {
    const generated = generateProviderContractJsonSchemasV1();
    for (const name of [
      "installation-identity-generation-fields",
      "installation-identity-key-check-fields",
      "provider-registry-root-key-id-fields",
    ] as const) {
      expect(generated[name].additionalProperties).toBe(false);
    }
  });

  it("publishes the ordered provider reason and strict minimal error schemas", () => {
    const generated = generateProviderContractJsonSchemasV1();
    expect(generated["provider-capability-failure-reason"].enum).toEqual([
      "unavailable",
      "unsupported_filesystem_profile",
      "attestation_invalid",
      "revoked",
      "migration_required",
      "initialization_not_terminalized",
    ]);
    expect(generated["provider-unavailable-tool-error"].required).toEqual([
      "schemaVersion",
      "code",
      "details",
    ]);
    expect(
      generated["provider-unavailable-tool-error"].additionalProperties,
    ).toBe(false);
    const details = (
      generated["provider-unavailable-tool-error"].properties as Record<
        string,
        Record<string, unknown>
      >
    ).details;
    expect(details?.additionalProperties).toBe(false);
    expect(details?.required).toEqual(["reason"]);
  });
});
