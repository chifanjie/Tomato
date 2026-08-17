import Ajv2020 from "ajv/dist/2020.js";
import {
  BuildTaskBriefOutputV1Schema,
  CheckChangeOutputV1Schema,
  GetEvidenceOutputV1Schema,
  GetRepoPulseOutputV1Schema,
  GetTaskBriefOutputV1Schema,
  McpToolErrorResultV1Schema,
  OpenWorkbenchOutputV1Schema,
  RecordVerificationOutputV1Schema,
  RefreshIndexOutputV1Schema,
  SearchContextOutputV1Schema,
  TraceImpactOutputV1Schema,
  UpdateTaskOutputV1Schema,
} from "@understand-code/contracts/mcp";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  IMPLEMENTED_TOOLS,
  normalizeToolJsonSchema,
} from "../src/mcp/tool-registry.js";

function toolOutputSchema(schema: z.ZodType) {
  return {
    ...normalizeToolJsonSchema(z.toJSONSchema(schema)),
    type: "object" as const,
  };
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
  update_task: toolOutputSchema(
    z.union([
      UpdateTaskOutputV1Schema.shape.structuredContent,
      McpToolErrorResultV1Schema.shape.structuredContent,
    ]),
  ),
  check_change: toolOutputSchema(
    z.union([
      CheckChangeOutputV1Schema.shape.structuredContent,
      McpToolErrorResultV1Schema.shape.structuredContent,
    ]),
  ),
  record_verification: toolOutputSchema(
    z.union([
      RecordVerificationOutputV1Schema.shape.structuredContent,
      McpToolErrorResultV1Schema.shape.structuredContent,
    ]),
  ),
  open_workbench: toolOutputSchema(
    z.union([
      OpenWorkbenchOutputV1Schema.shape.structuredContent,
      McpToolErrorResultV1Schema.shape.structuredContent,
    ]),
  ),
  get_evidence: toolOutputSchema(
    z.union([
      GetEvidenceOutputV1Schema.shape.structuredContent,
      McpToolErrorResultV1Schema.shape.structuredContent,
    ]),
  ),
  search_context: toolOutputSchema(
    z.union([
      SearchContextOutputV1Schema.shape.structuredContent,
      McpToolErrorResultV1Schema.shape.structuredContent,
    ]),
  ),
  trace_impact: toolOutputSchema(
    z.union([
      TraceImpactOutputV1Schema.shape.structuredContent,
      McpToolErrorResultV1Schema.shape.structuredContent,
    ]),
  ),
  refresh_index: toolOutputSchema(
    z.union([
      RefreshIndexOutputV1Schema.shape.structuredContent,
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
      "update_task",
      "check_change",
      "record_verification",
      "open_workbench",
      "get_evidence",
      "search_context",
      "trace_impact",
      "refresh_index",
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
