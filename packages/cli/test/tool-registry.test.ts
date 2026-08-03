import Ajv2020 from "ajv/dist/2020.js";
import {
  BuildTaskBriefOutputV1Schema,
  GetRepoPulseOutputV1Schema,
  GetTaskBriefOutputV1Schema,
  McpToolErrorResultV1Schema,
} from "@understand-code/contracts/mcp";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { IMPLEMENTED_TOOLS } from "../src/mcp/tool-registry.js";

function toolOutputSchema(schema: z.ZodType) {
  return { ...z.toJSONSchema(schema), type: "object" as const };
}

const expectedOutputSchemas = {
  get_repo_pulse: toolOutputSchema(
    z.union([
      GetRepoPulseOutputV1Schema.shape.structuredContent,
      McpToolErrorResultV1Schema.shape.structuredContent,
    ]),
  ),
  build_task_brief: toolOutputSchema(
    z.union([
      BuildTaskBriefOutputV1Schema.shape.structuredContent,
      McpToolErrorResultV1Schema.shape.structuredContent,
    ]),
  ),
  get_task_brief: toolOutputSchema(
    z.union([
      GetTaskBriefOutputV1Schema.shape.structuredContent,
      McpToolErrorResultV1Schema.shape.structuredContent,
    ]),
  ),
} as const;

describe("advertised tool contracts", () => {
  it("publishes only the implemented allowlist with generated input and structured output schemas", () => {
    expect(IMPLEMENTED_TOOLS.map((tool) => tool.name)).toEqual([
      "get_repo_pulse",
      "build_task_brief",
      "get_task_brief",
    ]);
    for (const tool of IMPLEMENTED_TOOLS) {
      expect(tool.inputSchema).toMatchObject({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
      });
      expect(tool.outputSchema).toEqual(expectedOutputSchemas[tool.name]);
      expect(tool.outputSchema).toMatchObject({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        anyOf: [{ type: "object" }, { type: "object" }],
      });
    }
  });

  it("produces JSON Schemas that a 2020-12 validator can compile", () => {
    const ajv = new Ajv2020({ strict: true });
    for (const tool of IMPLEMENTED_TOOLS) {
      expect(() => ajv.compile(tool.inputSchema)).not.toThrow();
      const validateOutput = ajv.compile(tool.outputSchema);
      const failure = McpToolErrorResultV1Schema.parse({
        isError: true,
        content: [{ type: "text", text: "Workspace binding is required." }],
        structuredContent: {
          error: {
            schemaVersion: 1,
            code: "workspace_binding_required",
            details: { reason: "root_missing" },
          },
        },
      });
      expect(
        validateOutput(failure.structuredContent),
        JSON.stringify(validateOutput.errors),
      ).toBe(true);
    }
  });
});
