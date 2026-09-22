import { PRODUCT_NAME } from "../constants.js";

export type DiagnosticCode =
  | "configuration_error"
  | "transport_error"
  | "internal_error";

export function writeDiagnostic(code: DiagnosticCode): void {
  process.stderr.write(`${PRODUCT_NAME}: ${code}\n`);
}

const phases = new Set<string>(["cli", "build_task_brief", "refresh_index", "get_repo_pulse",
  "get_task_brief", "update_task", "check_change", "record_verification", "get_evidence",
  "search_context", "trace_impact", "open_workbench"]);

/** Never log exception messages, stacks, paths, arguments, or arbitrary error codes. */
export function writeErrorDiagnostic(errorId: string, error: unknown, phase: string = "unknown"): string {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  const category = code === "ENOSPC" ? "disk_full"
    : code === "EACCES" || code === "EPERM" ? "permission_denied"
    : code === "ENOENT" ? "missing_file"
    : code === "repository_index_failed" || error instanceof SyntaxError ? "invalid_artifact"
    : "internal_error";
  const nextStep = category === "disk_full" ? "Free disk space, run understand-code doctor, then retry the same request."
    : category === "permission_denied" ? "Check repository and installation permissions, then run understand-code doctor."
    : category === "missing_file" ? "Run understand-code doctor in the target repository and restore any missing installation files."
    : category === "invalid_artifact" ? "Run understand-code doctor in the target repository; ask the host to refresh the index or regenerate the writer draft before retrying."
    : "Run understand-code doctor in the target repository; retain this error ID and the matching MCP stderr diagnostic when reporting the failure.";
  process.stderr.write(`${PRODUCT_NAME}: ${JSON.stringify({ errorId, category,
    phase: phases.has(phase) ? phase : "unknown", nextStep })}\n`);
  return nextStep;
}
