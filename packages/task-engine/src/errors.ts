export type TaskEngineErrorCode =
  | "action_not_authorized"
  | "artifact_unavailable"
  | "idempotency_conflict"
  | "revision_conflict"
  | "task_gate_unsatisfied"
  | "task_not_found"
  | "task_transition_rejected"
  | "invalid_cursor"
  | "context_provider_mismatch"
  | "capability_unavailable"
  | "context_build_failed";

export class TaskEngineError extends Error {
  readonly code: TaskEngineErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: TaskEngineErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "TaskEngineError";
    this.code = code;
    this.details = details;
  }
}
