import {
  StrongChangeCheckMutationOutcomeV1Schema,
  StrongVerificationMutationOutcomeV1Schema,
  TaskOperationReceiptV1Schema,
  parsePersistedArtifactV1,
  validateTaskArtifactBundleV1,
  type ContentDigest,
  type PersistedArtifactV1,
  type StrongChangeCheckMutationOutcomeV1,
  type StrongVerificationMutationOutcomeV1,
  type TaskArtifactBundleV1,
  type TaskOperationReceiptV1,
  canonicalizeJson,
} from "@understand-code/contracts";

export type VerifiedTaskMutationOutcomeInternalV1 = Extract<TaskOperationReceiptV1, { operation: "update_task" }>["result"];

/** Internal persisted shape, shared by the writer and the root-only reader. */
export interface StrongCanonicalTaskProjectionV1 {
  readonly profile: "strong_canonical_task_projection_v1";
  readonly operation: "check_change" | "record_verification" | "update_task";
  readonly requestDigest: ContentDigest;
  readonly bundle: TaskArtifactBundleV1;
  readonly artifacts: readonly PersistedArtifactV1[];
  readonly receipts: readonly TaskOperationReceiptV1[];
  readonly outcome:
    | StrongChangeCheckMutationOutcomeV1
    | StrongVerificationMutationOutcomeV1
    | VerifiedTaskMutationOutcomeInternalV1;
}

export function parseStrongCanonicalTaskProjectionInternalV1(
  value: unknown,
  operation: StrongCanonicalTaskProjectionV1["operation"],
  requestDigest: ContentDigest,
): StrongCanonicalTaskProjectionV1 {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("invalid canonical task projection");
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.profile !== "strong_canonical_task_projection_v1" ||
    candidate.operation !== operation ||
    candidate.requestDigest !== requestDigest ||
    !Array.isArray(candidate.artifacts) ||
    !Array.isArray(candidate.receipts)
  ) {
    throw new TypeError("invalid canonical task projection");
  }
  const bundle = validateTaskArtifactBundleV1(candidate.bundle);
  const artifacts = candidate.artifacts.map(parsePersistedArtifactV1);
  const receipts = candidate.receipts.map((receipt) =>
    TaskOperationReceiptV1Schema.parse(receipt)
  );
  const outcome = operation === "check_change"
    ? StrongChangeCheckMutationOutcomeV1Schema.parse(candidate.outcome)
    : operation === "record_verification"
      ? StrongVerificationMutationOutcomeV1Schema.parse(candidate.outcome)
      : TaskOperationReceiptV1Schema.parse({
          schemaVersion: 1, operation: "update_task", taskId: bundle.manifest.taskId,
          eventId: bundle.events.at(-1)?.eventId, resultDigest: requestDigest, result: candidate.outcome,
        }).result as VerifiedTaskMutationOutcomeInternalV1;
  if (
    ("task" in outcome ? outcome.mutation.idempotentReplay ||
      outcome.mutation.revision !== bundle.manifest.revision || outcome.task.status !== "verified" ||
      canonicalizeJson(outcome.task) !== canonicalizeJson(bundle.manifest)
      : outcome.idempotentReplay || outcome.committedRevision !== bundle.manifest.revision) ||
    artifacts.some((artifact) =>
      artifact.taskId !== bundle.manifest.taskId ||
      artifact.revision !== bundle.manifest.revision
    )
  ) {
    throw new TypeError("canonical projection identity mismatch");
  }
  return {
    profile: "strong_canonical_task_projection_v1",
    operation,
    requestDigest,
    bundle,
    artifacts,
    receipts,
    outcome,
  };
}
