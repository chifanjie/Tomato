import {
  CheckChangeInputV1Schema,
  RecordVerificationInputV1Schema,
  UpdateTaskInputV1Schema,
} from "@understand-code/contracts";
import {
  BuildTaskBriefInputV1Schema,
  BuildTaskBriefOutputV1Schema,
  CheckChangeOutputV1Schema,
  GetRepoPulseInputV1Schema,
  GetRepoPulseOutputV1Schema,
  GetTaskBriefInputV1Schema,
  GetTaskBriefOutputV1Schema,
  McpToolErrorResultV1Schema,
  OpenWorkbenchInputV1Schema,
  OpenWorkbenchOutputV1Schema,
  RecordVerificationOutputV1Schema,
  UpdateTaskOutputV1Schema,
} from "@understand-code/contracts/mcp";
import { z } from "zod";

import {
  IMPLEMENTED_TOOL_NAMES,
  type ImplementedToolName,
} from "../handlers/tools.js";

const descriptions: Readonly<Record<ImplementedToolName, string>> = {
  get_repo_pulse:
    "Read the current published repository pulse and its exact snapshot metadata.",
  build_task_brief:
    "Create or idempotently resume a managed Task Brief from published repository context.",
  get_task_brief:
    "Read one paginated section of a managed Task Brief.",
  update_task:
    "Advance a managed Task through confirmations, lifecycle transitions, findings, and recovery actions.",
  check_change:
    "Compare the persisted Task plan with the current Repository Snapshot and append a Change Check.",
  record_verification:
    "Append an externally executed Verification result to the current Task revision.",
  open_workbench:
    "Open or reuse a read-only local Workbench session at an exact Task, Knowledge, or Graph route.",
};

const inputSchemas = {
  get_repo_pulse: GetRepoPulseInputV1Schema,
  build_task_brief: BuildTaskBriefInputV1Schema,
  get_task_brief: GetTaskBriefInputV1Schema,
  update_task: UpdateTaskInputV1Schema,
  check_change: CheckChangeInputV1Schema,
  record_verification: RecordVerificationInputV1Schema,
  open_workbench: OpenWorkbenchInputV1Schema,
} as const;

const outputSchemas = {
  get_repo_pulse: z.union([
    GetRepoPulseOutputV1Schema.shape.structuredContent,
    McpToolErrorResultV1Schema.shape.structuredContent,
  ]),
  build_task_brief: z.union([
    BuildTaskBriefOutputV1Schema.shape.structuredContent,
    McpToolErrorResultV1Schema.shape.structuredContent,
  ]),
  get_task_brief: z.union([
    GetTaskBriefOutputV1Schema.shape.structuredContent,
    McpToolErrorResultV1Schema.shape.structuredContent,
  ]),
  update_task: z.union([
    UpdateTaskOutputV1Schema.shape.structuredContent,
    McpToolErrorResultV1Schema.shape.structuredContent,
  ]),
  check_change: z.union([
    CheckChangeOutputV1Schema.shape.structuredContent,
    McpToolErrorResultV1Schema.shape.structuredContent,
  ]),
  record_verification: z.union([
    RecordVerificationOutputV1Schema.shape.structuredContent,
    McpToolErrorResultV1Schema.shape.structuredContent,
  ]),
  open_workbench: z.union([
    OpenWorkbenchOutputV1Schema.shape.structuredContent,
    McpToolErrorResultV1Schema.shape.structuredContent,
  ]),
} as const;

export const IMPLEMENTED_TOOLS = Object.freeze(
  IMPLEMENTED_TOOL_NAMES.map((name) => ({
    name,
    description: descriptions[name],
    inputSchema: z.toJSONSchema(inputSchemas[name]),
    outputSchema: {
      ...z.toJSONSchema(outputSchemas[name]),
      // MCP requires the Tool output schema root itself to declare object,
      // even when the success/error alternatives are expressed with anyOf.
      type: "object" as const,
    },
  })),
);

const toolNames = new Set<string>(IMPLEMENTED_TOOL_NAMES);

export function isImplementedToolName(value: unknown): value is ImplementedToolName {
  return typeof value === "string" && toolNames.has(value);
}
