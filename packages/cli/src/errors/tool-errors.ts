import { randomUUID } from "node:crypto";
import { writeErrorDiagnostic } from "../logging/stderr.js";

import {
  McpToolErrorResultV1Schema,
  ToolErrorEnvelopeV1Schema,
  type McpToolErrorResultV1,
  type ToolErrorEnvelopeV1,
  type WorkspaceBindingReasonV1,
} from "@understand-code/contracts/mcp";
import {
  createProviderUnavailableToolErrorV1,
} from "@understand-code/durable-object-provider-contracts/provider-error";
import { z } from "zod";

export class ToolFailure extends Error {
  readonly result: McpToolErrorResultV1;

  constructor(result: McpToolErrorResultV1) {
    super("MCP tool call failed.");
    this.name = "ToolFailure";
    this.result = result;
  }
}

export function toolError(
  error: ToolErrorEnvelopeV1,
  text: string,
): McpToolErrorResultV1 {
  return McpToolErrorResultV1Schema.parse({
    isError: true,
    content: [{ type: "text", text }],
    structuredContent: { error },
  });
}

export function strongStoreUnavailableFailure(): McpToolErrorResultV1 {
  return toolError(
    createProviderUnavailableToolErrorV1("unavailable"),
    "The strong Store is unavailable. Run Doctor for details.",
  );
}

export function workspaceBindingFailure(
  reason: WorkspaceBindingReasonV1,
): McpToolErrorResultV1 {
  return toolError(
    {
      schemaVersion: 1,
      code: "workspace_binding_required",
      details: { reason },
    },
    "Workspace binding is required.",
  );
}

export function invalidArgumentsFailure(
  error: z.ZodError,
): McpToolErrorResultV1 {
  const issues = error.issues.map((issue) => ({
    path: issue.path.map((component) =>
      typeof component === "symbol" ? String(component) : component,
    ),
    code: issue.code,
    message: issue.code === "invalid_type" && "expected" in issue
      ? `Expected ${String(issue.expected)}.`
      : issue.code === "too_small" ? "Value is below the allowed minimum. See this tool's input schema."
      : issue.code === "too_big" ? "Value exceeds the allowed maximum. See this tool's input schema."
      : issue.code === "invalid_value" ? "Use one of the allowed values in this tool's input schema."
      : "Invalid tool argument. Check this field against the tool input schema.",
  }));
  return toolError(
    {
      schemaVersion: 1,
      code: "invalid_arguments",
      details: {
        issues:
          issues.length > 0
            ? issues
            : [{ path: [], code: "invalid_arguments", message: "Invalid tool argument." }],
      },
    },
    "Tool arguments are invalid. Correct the fields listed in details.issues using this tool’s input schema, then retry.",
  );
}

export function invalidArgumentFailure(
  path: readonly (string | number)[],
  code: string,
): McpToolErrorResultV1 {
  return toolError(
    {
      schemaVersion: 1,
      code: "invalid_arguments",
      details: {
        issues: [
          {
            path: [...path],
            code,
            message: "Invalid tool argument.",
          },
        ],
      },
    },
    "Tool arguments are invalid. Correct the fields listed in details.issues using this tool’s input schema, then retry.",
  );
}

export function repositoryNotReadyFailure(
  status: "not_ready" | "fresh" | "partial" | "stale" | "unknown" | "rebuilding" | "error",
  missingArtifacts: readonly string[],
  recommendedAction:
    | "refresh_index"
    | "wait_for_refresh"
    | "repair_environment"
    | "continue_degraded",
): McpToolErrorResultV1 {
  return toolError(
    {
      schemaVersion: 1,
      code: "repository_not_ready",
      details: {
        status,
        missingArtifacts: [...missingArtifacts],
        recommendedAction,
      },
    },
    "Repository context is not ready.",
  );
}

export function resourceNotFoundFailure(
  resourceKind: "task" | "artifact" | "snapshot",
  resourceId: string,
): McpToolErrorResultV1 {
  return toolError(
    {
      schemaVersion: 1,
      code: "resource_not_found",
      details: { resourceKind, resourceId },
    },
    "The requested resource was not found.",
  );
}

export function artifactUnavailableFailure(
  reason: "missing" | "stale" | "corrupt" | "unsupported_schema",
  artifactId?: string,
): McpToolErrorResultV1 {
  return toolError(
    {
      schemaVersion: 1,
      code: "artifact_unavailable",
      details: { ...(artifactId === undefined ? {} : { artifactId }), reason },
    },
    "A required artifact is unavailable.",
  );
}

export function taskGateFailure(
  taskId: string,
  targetStatus:
    | "context_ready"
    | "planned"
    | "in_progress"
    | "check_required"
    | "verification_required"
    | "verified",
  failedGuards: readonly {
    code:
      | "context_not_ready"
      | "goal_not_confirmed"
      | "acceptance_not_confirmed"
      | "plan_not_confirmed"
      | "worktree_binding_invalid"
      | "snapshot_not_current"
      | "current_check_required"
      | "blocking_finding"
      | "verification_required"
      | "verification_failed"
      | "verification_blocked"
      | "verification_flaky"
      | "freshness_invalid"
      | "blocker_unresolved";
    resourceId?: string;
  }[],
): McpToolErrorResultV1 {
  return toolError(
    {
      schemaVersion: 1,
      code: "task_gate_unsatisfied",
      details: { taskId, targetStatus, failedGuards: [...failedGuards] },
    },
    "Task lifecycle gates are not satisfied.",
  );
}

/** Only validated public Task identity and revision numbers may leave the error boundary. */
export function revisionConflictFailure(
  taskId: unknown,
  expectedRevision: unknown,
  actualRevision: unknown,
): McpToolErrorResultV1 | undefined {
  const error = ToolErrorEnvelopeV1Schema.safeParse({
    schemaVersion: 1, code: "revision_conflict",
    details: { taskId, expectedRevision, actualRevision },
  });
  return error.success ? toolError(error.data,
    "Task revision does not match expectedRevision. Read get_task_brief for the current Task and revision, then re-evaluate the action before retrying. Do not increment a revision merely because a prior call was attempted.") : undefined;
}

export function idempotencyConflictFailure(
  idempotencyKey: string,
  requestDigest: string,
  existingRequestDigest: string,
): McpToolErrorResultV1 {
  return toolError(
    {
      schemaVersion: 1,
      code: "idempotency_conflict",
      details: { idempotencyKey, requestDigest, existingRequestDigest },
    },
    "The idempotency key belongs to a different request.",
  );
}

export function sourceAccessDeniedFailure(
  reason: "outside_root" | "hard_denied" | "symlink_escape" | "binary" | "too_large" | "redacted",
): McpToolErrorResultV1 {
  return toolError(
    {
      schemaVersion: 1,
      code: "source_access_denied",
      details: { reason },
    },
    "Source access was denied.",
  );
}

export function internalErrorFailure(error?: unknown, phase?: string): McpToolErrorResultV1 {
  const errorId = `error:${randomUUID()}`;
  const nextStep = writeErrorDiagnostic(errorId, error, phase);
  return toolError(
    {
      schemaVersion: 1,
      code: "internal_error",
      details: { errorId },
    },
    `The tool call could not be completed. ${nextStep} Reference: ${errorId}.`,
  );
}
