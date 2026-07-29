export type ArtifactStoreErrorCode =
  | "invalid_root"
  | "unsafe_path"
  | "sensitive_path"
  | "symlink_rejected"
  | "lock_timeout"
  | "lock_ownership_lost"
  | "revision_conflict"
  | "idempotency_conflict"
  | "artifact_corrupt"
  | "artifact_not_found"
  | "manifest_inconsistent"
  | "migration_failed"
  | "reference_integrity_failed";

export class ArtifactStoreError extends Error {
  readonly code: ArtifactStoreErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: ArtifactStoreErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ArtifactStoreError";
    this.code = code;
    this.details = details;
  }
}
