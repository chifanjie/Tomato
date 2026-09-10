import {
  CheckChangeInputV1Schema,
  RecordVerificationInputV1Schema,
  StrongCheckChangesInputV1Schema,
  StrongRecordVerificationInputV1Schema,
  UpdateTaskInputV1Schema,
} from "@understand-code/contracts";
import {
  BuildTaskBriefInputV1Schema,
  BuildTaskBriefOutputV1Schema,
  CheckChangeOutputV1Schema,
  GetEvidenceInputV1Schema,
  GetEvidenceOutputV1Schema,
  GetRepoPulseInputV1Schema,
  GetRepoPulseOutputV1Schema,
  GetTaskBriefInputV1Schema,
  GetTaskBriefOutputV1Schema,
  McpToolErrorResultV1Schema,
  OpenWorkbenchInputV1Schema,
  OpenWorkbenchOutputV1Schema,
  RecordVerificationOutputV1Schema,
  RefreshIndexInputV1Schema,
  RefreshIndexOutputV1Schema,
  SearchContextInputV1Schema,
  SearchContextOutputV1Schema,
  StrongCheckChangeOutputV1Schema,
  StrongRecordVerificationOutputV1Schema,
  TraceImpactInputV1Schema,
  TraceImpactOutputV1Schema,
  UpdateTaskOutputV1Schema,
} from "@understand-code/contracts/mcp";
import { z } from "zod";

import {
  IMPLEMENTED_TOOL_NAMES,
  type ImplementedToolName,
} from "../handlers/tools.js";

export type McpToolSurfaceProfileV1 =
  | "full"
  | "preview_three_tool_v1";

declare const __UNDERSTAND_CODE_MCP_TOOL_SURFACE_PROFILE__:
  | McpToolSurfaceProfileV1
  | undefined;

export const PREVIEW_THREE_TOOL_NAMES_V1 = Object.freeze([
  "get_repo_pulse",
  "build_task_brief",
  "get_task_brief",
] as const satisfies readonly ImplementedToolName[]);

export function implementedToolNamesForSurfaceProfileV1(
  profile: McpToolSurfaceProfileV1,
): readonly ImplementedToolName[] {
  return profile === "preview_three_tool_v1"
    ? PREVIEW_THREE_TOOL_NAMES_V1
    : IMPLEMENTED_TOOL_NAMES;
}

const compiledToolSurfaceProfileV1: McpToolSurfaceProfileV1 =
  typeof __UNDERSTAND_CODE_MCP_TOOL_SURFACE_PROFILE__ === "undefined"
    ? "full"
    : __UNDERSTAND_CODE_MCP_TOOL_SURFACE_PROFILE__;

const activeImplementedToolNamesV1 =
  implementedToolNamesForSurfaceProfileV1(compiledToolSurfaceProfileV1);

/**
 * Zod emits tuple schemas with `prefixItems`.  Ajv strict mode requires the
 * tuple cardinality and a closed `items` schema to be explicit, so normalize
 * generated MCP schemas without changing the contracts package ABI.
 */
export function normalizeToolJsonSchema<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeToolJsonSchema(item)) as T;
  }
  if (value === null || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(source)) {
    result[key] = normalizeToolJsonSchema(child);
  }
  const allOf = result.allOf;
  if (
    Array.isArray(allOf) &&
    allOf.length === 2 &&
    allOf[0] !== null &&
    typeof allOf[0] === "object" &&
    (allOf[0] as Record<string, unknown>).type === "object" &&
    Object.keys(
      ((allOf[0] as Record<string, unknown>).properties ?? {}) as Record<
        string,
        unknown
      >,
    ).length === 0 &&
    (allOf[0] as Record<string, unknown>).additionalProperties === false &&
    allOf[1] !== null &&
    typeof allOf[1] === "object"
  ) {
    const second = allOf[1] as Record<string, unknown>;
    const mergedProperties: Record<string, unknown> = {};
    const alternatives = second.anyOf;
    if (Array.isArray(alternatives)) {
      for (const alternative of alternatives) {
        if (alternative !== null && typeof alternative === "object") {
          const properties = (alternative as Record<string, unknown>).properties;
          if (properties !== null && typeof properties === "object") {
            Object.assign(mergedProperties, properties);
          }
        }
      }
    }
    const schema = result.$schema;
    for (const key of Object.keys(result)) delete result[key];
    if (schema !== undefined) result.$schema = schema;
    Object.assign(result, second, {
      type: "object",
      properties: mergedProperties,
      additionalProperties: false,
    });
  }
  const prefixItems = result.prefixItems;
  if (Array.isArray(prefixItems)) {
    // Zod can emit an inconsistent `minItems: 1` for an empty tuple.  The
    // tuple cardinality is authoritative and must win before Ajv 2020-12
    // validation (an empty prefixItems array cannot require one item).
    result.minItems = prefixItems.length;
    result.maxItems = prefixItems.length;
    if (prefixItems.length === 0) delete result.prefixItems;
    result.items ??= false;
  }
  return result as T;
}

const descriptions: Readonly<Record<ImplementedToolName, string>> = {
  get_repo_pulse:
    "Read the current repository pulse through its strict redacted public Surface.",
  build_task_brief:
    "Create or replay a durable local Task Brief, initializing a source index if needed. Analyze returned source evidence in the host before recording conclusions with update_task record_analysis.",
  get_task_brief:
    "Read a paged section of a persisted Task Brief. Use analysis to recover full persisted conclusions and other analysis Claims, including reasoning, evidence IDs and snapshot scope.",
  update_task:
    "Apply an optimistic, idempotent lifecycle action. record_analysis stores source-grounded host conclusions; refresh_task_context/rebase_task recover a stale local Task.",
  check_change:
    "Compare a Task plan with an exact actual Snapshot and commit an evidence-backed Change Check.",
  record_verification:
    "Record a caller-executed Verification result without executing its command on the server.",
  open_workbench:
    "Mint a one-time deep link to the Task-first Evidence Workbench.",
  get_evidence:
    "Read a bounded, paged projection of evidence attached to a managed Task.",
  search_context:
    "Search the bounded Graph and Wiki context pinned to a managed Task.",
  trace_impact:
    "Read bounded, paged impact paths from a managed Task and its pinned Graph.",
  refresh_index:
    "Capture a path-safe Repository Snapshot and Repo Pulse. Full Task knowledge uses knowledge.action=stage to save a pending candidate without replacing Graph/Wiki, then knowledge.action=publish after update_task transitions that same Task to verified. Both require exact Task revision and Snapshot pins; this tool never modifies Task state.",
};

const inputSchemas = {
  get_repo_pulse: GetRepoPulseInputV1Schema,
  build_task_brief: BuildTaskBriefInputV1Schema,
  get_task_brief: GetTaskBriefInputV1Schema,
  update_task: UpdateTaskInputV1Schema,
  check_change: z.intersection(
    z.strictObject({}),
    z.union([CheckChangeInputV1Schema, StrongCheckChangesInputV1Schema]),
  ),
  record_verification: z.intersection(
    z.strictObject({}),
    z.union([
      RecordVerificationInputV1Schema,
      StrongRecordVerificationInputV1Schema,
    ]),
  ),
  open_workbench: OpenWorkbenchInputV1Schema,
  get_evidence: GetEvidenceInputV1Schema,
  search_context: SearchContextInputV1Schema,
  trace_impact: TraceImpactInputV1Schema,
  refresh_index: RefreshIndexInputV1Schema,
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
    StrongCheckChangeOutputV1Schema.shape.structuredContent,
    McpToolErrorResultV1Schema.shape.structuredContent,
  ]),
  record_verification: z.union([
    RecordVerificationOutputV1Schema.shape.structuredContent,
    StrongRecordVerificationOutputV1Schema.shape.structuredContent,
    McpToolErrorResultV1Schema.shape.structuredContent,
  ]),
  open_workbench: z.union([
    OpenWorkbenchOutputV1Schema.shape.structuredContent,
    McpToolErrorResultV1Schema.shape.structuredContent,
  ]),
  get_evidence: z.union([
    GetEvidenceOutputV1Schema.shape.structuredContent,
    McpToolErrorResultV1Schema.shape.structuredContent,
  ]),
  search_context: z.union([
    SearchContextOutputV1Schema.shape.structuredContent,
    McpToolErrorResultV1Schema.shape.structuredContent,
  ]),
  trace_impact: z.union([
    TraceImpactOutputV1Schema.shape.structuredContent,
    McpToolErrorResultV1Schema.shape.structuredContent,
  ]),
  refresh_index: z.union([
    RefreshIndexOutputV1Schema.shape.structuredContent,
    McpToolErrorResultV1Schema.shape.structuredContent,
  ]),
} as const;

export const IMPLEMENTED_TOOLS = Object.freeze(
  activeImplementedToolNamesV1.map((name) => ({
    name,
    description: descriptions[name],
    inputSchema: normalizeToolJsonSchema(z.toJSONSchema(inputSchemas[name])),
    outputSchema: {
      ...normalizeToolJsonSchema(z.toJSONSchema(outputSchemas[name])),
      // MCP requires the Tool output schema root itself to declare object,
      // even when the success/error alternatives are expressed with anyOf.
      type: "object" as const,
    },
  })),
);

const toolNames = new Set<string>(activeImplementedToolNamesV1);

export function isImplementedToolName(value: unknown): value is ImplementedToolName {
  return typeof value === "string" && toolNames.has(value);
}
