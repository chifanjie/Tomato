import { createHash } from "node:crypto";

import {
  IdempotencyRecordV1Schema,
  TaskEventV1Schema,
  TaskManifestV1Schema,
  TaskOperationReceiptV1Schema,
  UpdateTaskInputV1Schema,
  taskVerificationRequirementGuardsV1,
  canonicalTaskEventDigestJsonV1,
  parsePersistedArtifactV1,
  validateTaskArtifactBundleV1,
  ContextGenerationIdV1Schema,
  DiffHunkEvidenceV1Schema,
  EvidenceBackedChangeCheckV1Schema,
  InternalTaskBaselineV1Schema,
  PathSafeRepositorySnapshotIdV1Schema,
  StrongChangeCheckCommitRequestV1Schema,
  StrongChangeCheckMutationOutcomeV1Schema,
  StrongChangeCheckPreparationV1Schema,
  StrongChangeTaskProjectionV1Schema,
  StrongCheckChangesInputV1Schema,
  StrongPlannedChangeIdV1Schema,
  StrongRecordVerificationInputV1Schema,
  StrongTaskBaselineCaptureInputV1Schema,
  StrongTaskBaselineCaptureOutcomeV1Schema,
  StrongVerificationCommitRequestV1Schema,
  StrongVerificationMutationOutcomeV1Schema,
  StrongVerificationPreparationV1Schema,
  VerificationPlanEntryIdV1Schema,
  canonicalizeJson,
  parseTrustedStrongRepositorySnapshotV1,
  type ContentDigest,
  type InternalTaskBaselineV1,
  type PersistedArtifactV1,
  type TaskEventV1,
  type TaskManifestV1,
  type TaskOperationReceiptV1,
  type StrongChangeCheckCommitRequestV1,
  type StrongChangeCheckMutationOutcomeV1,
  type StrongChangeCheckPreparationV1,
  type StrongChangeIntelligenceAuthorityV1,
  type StrongChangeTaskProjectionV1,
  type StrongCheckChangesInputV1,
  type StrongRecordVerificationInputV1,
  type StrongTaskBaselineCaptureInputV1,
  type StrongTaskBaselineCaptureOutcomeV1,
  type StrongRepositorySnapshotV1,
  type StrongVerificationCommitRequestV1,
  type StrongVerificationMutationOutcomeV1,
  type StrongVerificationPreparationV1,
  type StrongVerificationSecurityProjectionV1,
  type UpdateTaskInputV1,
} from "@understand-code/contracts";

import {
  ArtifactStore,
  type ReadTaskBundleResult,
  type StrongOperationProviderObjectBindingV1,
} from "./store.js";
import { digestCanonicalJson } from "./digest.js";
import {
  parseStrongCanonicalTaskProjectionInternalV1,
  type StrongCanonicalTaskProjectionV1,
  type VerifiedTaskMutationOutcomeInternalV1,
} from "./strong-canonical-task-projection-internal.js";
import { readCommittedStrongTaskProjectionInternalV1 } from "./committed-strong-task-projection-reader-internal.js";

type StrongTaskPhaseV1 = "strong_change_check_v1" | "strong_verification_v1" | "strong_task_verified_v1";

function digest(value: unknown): ContentDigest {
  return `sha256:${createHash("sha256")
    .update(canonicalizeJson(value), "utf8")
    .digest("hex")}`;
}

function canonicalEqual(left: unknown, right: unknown): boolean {
  return canonicalizeJson(left) === canonicalizeJson(right);
}

function operationNonce(domain: string, requestDigest: ContentDigest): string {
  return createHash("sha256")
    .update(domain, "utf8")
    .update("\0", "utf8")
    .update(requestDigest, "utf8")
    .digest("hex")
    .slice(0, 32);
}

function compareOperationNonce(
  phase: StrongTaskPhaseV1,
  taskCutDigest: ContentDigest,
  providerExpectedRevision: number,
): string {
  return createHash("sha256")
    .update(canonicalizeJson([
      "strong-provider-compare-nonce-v1",
      { phase, taskCutDigest, providerExpectedRevision },
    ]), "utf8")
    .digest("hex")
    .slice(0, 32);
}

function artifactId(
  artifactType: PersistedArtifactV1["artifactType"],
  taskId: string,
): string {
  return `artifact:${artifactType}:${taskId}`;
}

function verificationRecordId(
  record: StrongVerificationCommitRequestV1["verification"],
  ownerOnlyDetailCommitment: string | undefined,
): string {
  return `verification-record:${digest([
    "verification-record-v1",
    {
      taskId: record.taskId,
      contextGenerationId: record.contextGenerationId,
      snapshotId: record.snapshotId,
      changeCheckContentDigest: record.changeCheckContentDigest,
      verificationPlanEntryId: record.verificationPlanEntryId,
      attempt: record.attempt,
      ...(record.supersedesVerificationRecordId === undefined
        ? {}
        : {
            supersedesVerificationRecordId:
              record.supersedesVerificationRecordId,
          }),
      method: record.method,
      status: record.status,
      claimIds: record.claimIds,
      publicResultCode: record.publicResultCode,
      detail: record.detail,
      ...(ownerOnlyDetailCommitment === undefined
        ? {}
        : { ownerOnlyDetailCommitment }),
    },
  ]).slice("sha256:".length, 29)}`;
}

function buildEvent(input: Readonly<{
  manifest: TaskManifestV1;
  previousManifest: TaskManifestV1;
  previousEvent?: TaskEventV1;
  action: TaskEventV1["action"];
  actor: string;
  idempotencyKey: string;
  requestDigest: ContentDigest;
  occurredAt: string;
}>): TaskEventV1 {
  const withoutDigest = {
    schemaVersion: 1 as const,
    eventId: `event:${input.manifest.taskId}:${input.manifest.revision}`,
    repositoryId: input.manifest.repositoryId,
    worktreeId: input.manifest.worktreeId,
    taskId: input.manifest.taskId,
    previousRevision: input.manifest.revision - 1,
    revision: input.manifest.revision,
    actor: input.actor,
    idempotencyKey: input.idempotencyKey,
    requestDigest: input.requestDigest,
    sourceSnapshotId: input.manifest.latestSnapshotId,
    occurredAt: input.occurredAt,
    previousStatus: input.previousManifest.status,
    resultingStatus: input.manifest.status,
    ...(input.previousManifest.contextGenerationId === undefined
      ? {}
      : {
          previousContextGenerationId:
            input.previousManifest.contextGenerationId,
        }),
    ...(input.manifest.contextGenerationId === undefined
      ? {}
      : { resultingContextGenerationId: input.manifest.contextGenerationId }),
    action: input.action,
    ...(input.previousEvent === undefined
      ? {}
      : { previousEventDigest: input.previousEvent.eventDigest }),
  };
  const placeholder = TaskEventV1Schema.parse({
    ...withoutDigest,
    eventDigest: `sha256:${"0".repeat(64)}`,
  });
  return TaskEventV1Schema.parse({
    ...withoutDigest,
    eventDigest: `sha256:${createHash("sha256")
      .update(canonicalTaskEventDigestJsonV1(placeholder), "utf8")
      .digest("hex")}`,
  });
}

function envelope(input: Readonly<{
  manifest: TaskManifestV1;
  artifactType: PersistedArtifactV1["artifactType"];
  payload: unknown;
  createdAt: string;
}>): PersistedArtifactV1 {
  return parsePersistedArtifactV1({
    schemaVersion: 1,
    artifactType: input.artifactType,
    artifactId: artifactId(input.artifactType, input.manifest.taskId),
    repositoryId: input.manifest.repositoryId,
    worktreeId: input.manifest.worktreeId,
    sourceSnapshotId: input.manifest.latestSnapshotId,
    taskId: input.manifest.taskId,
    revision: input.manifest.revision,
    producerVersion: input.manifest.producerVersion,
    createdAt: input.createdAt,
    contentDigest: digest(input.payload),
    payload: input.payload,
  });
}

export type StrongChangeAuthorityErrorCodeV1 =
  | "strong_change_authority_unavailable"
  | "strong_task_required"
  | "strong_task_baseline_unavailable"
  | "strong_snapshot_pin_mismatch"
  | "strong_change_provider_invalid"
  | "repository_read_set_conflict"
  | "repository_cas_conflict"
  | "strong_write_locked";

export class StrongChangeAuthorityErrorV1 extends Error {
  readonly code: StrongChangeAuthorityErrorCodeV1;

  constructor(code: StrongChangeAuthorityErrorCodeV1) {
    super(code);
    this.name = "StrongChangeAuthorityErrorV1";
    this.code = code;
  }
}

export interface ProviderPinnedTaskBaselineAuthorityV1 {
  readonly baseline: InternalTaskBaselineV1;
  readonly baselineContentDigest: ContentDigest;
  readonly snapshot: StrongRepositorySnapshotV1;
  readonly snapshotArtifactId: string;
  readonly snapshotContentDigest: ContentDigest;
}

/** Provider-owned production port. It is deliberately storage-only. */
export interface StrongChangeProviderAuthorityV1 {
  inspectBusinessHead?(): Promise<unknown>;
  inspectState(): Promise<Readonly<{ revision: number }>>;
  readExactObject(input: Readonly<{
    locator: Readonly<{ providerId: string; contentDigest: ContentDigest }>;
  }>): Promise<Readonly<{
    locator: Readonly<{ providerId: string; contentDigest: ContentDigest }>;
    logicalBytes: number;
    bytes: string;
    verifiedContentDigest: ContentDigest;
  }>>;
  writeExactObject(input: Readonly<{
    operationNonce: string;
    locator: Readonly<{ providerId: string; contentDigest: ContentDigest }>;
    logicalBytes: number;
    bytes: string;
  }>): Promise<Readonly<{
    resolution: "committed" | "replayed";
    verifiedContentDigest: ContentDigest;
  }>>;
  compareCommit(input: Readonly<{
    operationNonce: string;
    expectedRevision: number;
    phase: StrongTaskPhaseV1;
    artifacts: Readonly<Record<string, unknown>>;
  }>): Promise<Readonly<{
    resolution: "committed" | "replayed" | "stale";
    committedRevision: number;
    artifacts: Readonly<Record<string, unknown>>;
  }>>;
}

/**
 * Local trusted material source. Production composition supplies the
 * TaskEngine deterministic repository/Graph analyzer and verification
 * scanner here; it is not a Provider capability.
 */
export interface StrongChangeMaterialAuthorityV1 {
  scanVerificationInput(input: StrongRecordVerificationInputV1): Promise<Pick<
    StrongVerificationPreparationV1,
    | "sensitiveRequestScanPolicyDigest"
    | "fullInputEqualityTag"
    | "ownerOnlyDetailCommitment"
    | "ownerOnlyDetail"
    | "detail"
    | "detailFields"
  >>;
  captureTaskBaseline(input: Readonly<{
    operation: StrongTaskBaselineCaptureInputV1;
    snapshot: StrongRepositorySnapshotV1;
    snapshotArtifactId: string;
    snapshotContentDigest: ContentDigest;
  }>): Promise<StrongTaskBaselineCaptureOutcomeV1>;

  readPinnedTaskBaseline(input: Readonly<{
    taskId: string;
    taskBaselineArtifactId: string;
    baselineSnapshotId: string;
  }>): Promise<ProviderPinnedTaskBaselineAuthorityV1>;

  buildCheckPreparation(input: Readonly<{
    task: StrongChangeTaskProjectionV1;
    baseline: ProviderPinnedTaskBaselineAuthorityV1;
    actualSnapshot: StrongRepositorySnapshotV1;
    actualSnapshotArtifactId: string;
    actualSnapshotContentDigest: ContentDigest;
  }>): Promise<StrongChangeCheckPreparationV1>;

  buildVerificationPreparation(input: Readonly<{
    operation: StrongRecordVerificationInputV1;
    task: StrongChangeTaskProjectionV1;
    security?: StrongVerificationSecurityProjectionV1;
  }>): Promise<StrongVerificationPreparationV1>;

}

export interface ArtifactStoreStrongChangeAuthorityOptionsV1 {
  readonly provider?: StrongChangeProviderAuthorityV1;
  readonly materialAuthority?: StrongChangeMaterialAuthorityV1;
  readonly providerId?: string;
}

/**
 * Production adapter between Task Engine and the current Artifact Store plus
 * Provider Gate. It deliberately remains fail-closed while no real Provider
 * strong-write authority is installed.
 */
export class ArtifactStoreStrongChangeAuthorityV1
  implements StrongChangeIntelligenceAuthorityV1
{
  readonly #store: ArtifactStore;
  readonly #provider?: StrongChangeProviderAuthorityV1;
  readonly #materialAuthority?: StrongChangeMaterialAuthorityV1;
  readonly #providerId?: string;

  constructor(
    store: ArtifactStore,
    options: ArtifactStoreStrongChangeAuthorityOptionsV1 = {},
  ) {
    this.#store = store;
    this.#provider = options.provider;
    this.#materialAuthority = options.materialAuthority;
    this.#providerId = options.providerId;
  }

  #requireProvider(): StrongChangeProviderAuthorityV1 {
    if (this.#provider === undefined) {
      throw new StrongChangeAuthorityErrorV1("strong_write_locked");
    }
    return this.#provider;
  }

  #requireMaterialAuthority(): StrongChangeMaterialAuthorityV1 {
    if (this.#materialAuthority === undefined) {
      throw new StrongChangeAuthorityErrorV1("strong_change_authority_unavailable");
    }
    return this.#materialAuthority;
  }

  reserveOperationTime(
    input: Readonly<{
      taskId: string;
      expectedRevision: number;
      operation: StrongCanonicalTaskProjectionV1["operation"];
      idempotencyKey: string;
      actor: string;
      requestDigest?: ContentDigest;
      fullInputEqualityTag?: string;
    }>,
    proposedAt: string,
  ): Promise<string> {
    if (input.requestDigest === undefined) {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
    return this.#store.reserveStrongOperationIntent({
      ...input,
      requestDigest: input.requestDigest,
      proposedAt,
    });
  }

  async abortReservedOperation(input: Readonly<{
    taskId: string;
    expectedRevision: number;
    operation: StrongCanonicalTaskProjectionV1["operation"];
    idempotencyKey: string;
    actor: string;
    requestDigest: ContentDigest;
    fullInputEqualityTag?: string;
  }>): Promise<void> {
    await this.#store.abortReservedStrongOperationIntent(input);
  }

  async #localStrongReplay(input: Readonly<{
    taskId: string;
    expectedRevision: number;
    idempotencyKey: string;
    actor: string;
    operation: StrongCanonicalTaskProjectionV1["operation"];
  }>): Promise<Readonly<{
    projection: StrongCanonicalTaskProjectionV1;
    requestDigest: ContentDigest;
  }> | undefined> {
    const current = await this.#store.readTaskBundle(input.taskId);
    if (current.bundle.manifest.revision === input.expectedRevision) return undefined;
    if (current.bundle.manifest.revision !== input.expectedRevision + 1) {
      throw new StrongChangeAuthorityErrorV1("repository_cas_conflict");
    }
    const keyed = current.bundle.idempotencyRecords.filter(
      (record) =>
        record.scope.kind === "task" &&
        record.scope.taskId === input.taskId &&
        record.idempotencyKey === input.idempotencyKey,
    );
    if (keyed.length !== 1) {
      throw new StrongChangeAuthorityErrorV1("repository_cas_conflict");
    }
    const record = keyed[0]!;
    if (
      record.actor !== input.actor ||
      record.resultRevision !== input.expectedRevision + 1
    ) {
      throw new StrongChangeAuthorityErrorV1("repository_cas_conflict");
    }
    const strongOutcome = input.operation === "check_change"
      ? current.receipts.find(
          (candidate): candidate is Extract<
            TaskOperationReceiptV1,
            { operation: "check_change" }
          > => candidate.operation === "check_change" && candidate.eventId === record.eventId,
        )?.result.strongOutcome
      : input.operation === "update_task" ? current.receipts.find(
          (candidate) => candidate.operation === "update_task" && candidate.eventId === record.eventId,
        )?.result
      : current.receipts.find(
          (candidate): candidate is Extract<
            TaskOperationReceiptV1,
            { operation: "record_verification" }
          > => candidate.operation === "record_verification" && candidate.eventId === record.eventId,
        )?.result.strongOutcome;
    if (strongOutcome === undefined) {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
    const projection = this.#parseCanonicalProjection(
      {
        profile: "strong_canonical_task_projection_v1",
        operation: input.operation,
        requestDigest: record.requestDigest,
        bundle: current.bundle,
        artifacts: current.artifacts,
        receipts: current.receipts,
        outcome: strongOutcome,
      },
      input.operation,
      record.requestDigest,
    );
    return { projection, requestDigest: record.requestDigest };
  }

  async replayCheck(
    inputValue: StrongCheckChangesInputV1,
    requestDigest: ContentDigest,
  ): Promise<StrongChangeCheckMutationOutcomeV1 | undefined> {
    const input = StrongCheckChangesInputV1Schema.parse(inputValue);
    const local = await this.#localStrongReplay({
      taskId: input.taskId,
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      actor: input.actor,
      operation: "check_change",
    });
    if (local === undefined) return undefined;
    if (local.requestDigest !== requestDigest) {
      throw new StrongChangeAuthorityErrorV1("repository_cas_conflict");
    }
    const provider = await this.#commitProviderProjection(
      "strong_change_check_v1",
      input.expectedRevision,
      requestDigest,
      input.idempotencyKey,
      input.actor,
      local.projection,
      { actorDigest: digest(input.actor) },
    );
    if (provider.resolution !== "replayed") {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
    const committed = this.#parseCanonicalProjection(
      provider.projection,
      "check_change",
      requestDigest,
    );
    if (!("profile" in committed.outcome) || committed.outcome.profile !== "strong_change_check_outcome_v1") {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
    return StrongChangeCheckMutationOutcomeV1Schema.parse({
      ...committed.outcome,
      idempotentReplay: true,
    });
  }

  async replayVerification(
    inputValue: StrongRecordVerificationInputV1,
    requestDigest: ContentDigest,
    security: StrongVerificationSecurityProjectionV1,
  ): Promise<StrongVerificationMutationOutcomeV1 | undefined> {
    const input = StrongRecordVerificationInputV1Schema.parse(inputValue);
    const local = await this.#localStrongReplay({
      taskId: input.taskId,
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      actor: input.actor,
      operation: "record_verification",
    });
    if (local === undefined) return undefined;
    if (local.requestDigest !== requestDigest) {
      throw new StrongChangeAuthorityErrorV1("repository_cas_conflict");
    }
    const provider = await this.#commitProviderProjection(
      "strong_verification_v1",
      input.expectedRevision,
      local.requestDigest,
      input.idempotencyKey,
      input.actor,
      local.projection,
      {
        actorDigest: digest(input.actor),
        fullInputEqualityTag: security.fullInputEqualityTag,
        ...(security.ownerOnlyDetailCommitment === undefined
          ? {}
          : { ownerOnlyDetailCommitment: security.ownerOnlyDetailCommitment }),
      },
      security.ownerOnlyDetail,
    );
    if (provider.resolution !== "replayed") {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
    const committed = this.#parseCanonicalProjection(
      provider.projection,
      "record_verification",
      local.requestDigest,
    );
    if (!("profile" in committed.outcome) || committed.outcome.profile !== "strong_verification_outcome_v1") {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
    return StrongVerificationMutationOutcomeV1Schema.parse({
      ...committed.outcome,
      idempotentReplay: true,
    });
  }

  #projectionArtifacts(input: Readonly<{
    manifest: TaskManifestV1;
    brief: unknown;
    claims: readonly unknown[];
    evidence: readonly unknown[];
    impactPaths: readonly unknown[];
    impactConclusion: StrongChangeCheckCommitRequestV1["impactConclusion"];
    changeCheck: StrongChangeCheckCommitRequestV1["changeCheck"];
    verificationRecords: readonly unknown[];
    idempotencyRecords: readonly unknown[];
    receipts: readonly unknown[];
    createdAt: string;
  }>): PersistedArtifactV1[] {
    const values: Array<[
      PersistedArtifactV1["artifactType"],
      unknown,
    ]> = [
      ["task_manifest", input.manifest],
      ["task_brief", input.brief],
      ["claim_ledger", { claims: input.claims }],
      ["evidence_ledger", { evidence: input.evidence }],
      [
        "impact",
        { paths: input.impactPaths, conclusion: input.impactConclusion },
      ],
      [
        "task_operation_journal",
        {
          idempotencyRecords: input.idempotencyRecords,
          receipts: input.receipts,
        },
      ],
      ["change_check", input.changeCheck],
    ];
    if (input.verificationRecords.length !== 0) {
      values.push([
        "verification",
        {
          profile: "verification_ledger_strong_v1",
          records: input.verificationRecords,
          skipAcceptances: [],
        },
      ]);
    }
    return values.map(([artifactType, payload]) =>
      envelope({
        manifest: input.manifest,
        artifactType,
        payload,
        createdAt: input.createdAt,
      })
    );
  }

  #appendJournal(input: Readonly<{
    current: ReadTaskBundleResult;
    manifest: TaskManifestV1;
    event: TaskEventV1;
    operation: StrongCanonicalTaskProjectionV1["operation"];
    result: unknown;
    actor: string;
    idempotencyKey: string;
    requestDigest: ContentDigest;
    occurredAt: string;
  }>): Readonly<{
    records: ReturnType<typeof IdempotencyRecordV1Schema.parse>[];
    receipts: TaskOperationReceiptV1[];
  }> {
    const resultDigest = digest(input.result);
    const record = IdempotencyRecordV1Schema.parse({
      schemaVersion: 1,
      worktreeId: input.manifest.worktreeId,
      scope: { kind: "task", taskId: input.manifest.taskId },
      idempotencyKey: input.idempotencyKey,
      actor: input.actor,
      requestDigest: input.requestDigest,
      taskId: input.manifest.taskId,
      resultRevision: input.manifest.revision,
      eventId: input.event.eventId,
      resultDigest,
      createdAt: input.occurredAt,
    });
    const receipt = TaskOperationReceiptV1Schema.parse({
      schemaVersion: 1,
      operation: input.operation,
      taskId: input.manifest.taskId,
      eventId: input.event.eventId,
      resultDigest,
      result: input.result,
    });
    return {
      records: [...input.current.bundle.idempotencyRecords, record],
      receipts: [...input.current.receipts, receipt],
    };
  }

  #buildCheckProjection(
    current: ReadTaskBundleResult,
    input: StrongChangeCheckCommitRequestV1,
  ): StrongCanonicalTaskProjectionV1 {
    if (!("brief" in current.bundle)) {
      throw new StrongChangeAuthorityErrorV1("strong_task_required");
    }
    const occurredAt = input.changeCheck.generatedAt;
    const manifest = TaskManifestV1Schema.parse({
      ...current.bundle.manifest,
      revision: input.expectedRevision + 1,
      updatedAt: occurredAt,
    });
    const event = buildEvent({
      manifest,
      previousManifest: current.bundle.manifest,
      previousEvent: current.bundle.events.at(-1),
      action: {
        type: "change_checked",
        changeCheckArtifactId: artifactId("change_check", manifest.taskId),
        changeCheckId: input.changeCheck.id,
      },
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      requestDigest: input.requestDigest,
      occurredAt,
    });
    const mutation = {
      taskId: manifest.taskId,
      revision: manifest.revision,
      eventId: event.eventId,
      artifactIds: [
        ...current.artifacts.map((artifact) => artifact.artifactId),
        artifactId("change_check", manifest.taskId),
      ],
      idempotentReplay: false,
    };
    const withFindingClaimBacklinks = <
      T extends Readonly<{ id: string; claimIds: readonly string[] }>,
    >(evidenceItem: T): T => {
      const appendedClaimIds = input.findingClaims
        .filter((claim) =>
          (claim.evidenceIds as readonly string[]).includes(evidenceItem.id) &&
          !evidenceItem.claimIds.includes(claim.id)
        )
        .map((claim) => claim.id);
      return appendedClaimIds.length === 0
        ? evidenceItem
        : {
            ...evidenceItem,
            claimIds: [...evidenceItem.claimIds, ...appendedClaimIds],
          };
    };
    const outcomeEvidence = input.evidence.map(withFindingClaimBacklinks);
    const outcome = StrongChangeCheckMutationOutcomeV1Schema.parse({
      profile: "strong_change_check_outcome_v1",
      changeCheck: input.changeCheck,
      findingClaims: input.findingClaims,
      evidence: outcomeEvidence,
      impactConclusion: input.impactConclusion,
      commitEvidence: input.commitEvidence,
      committedRevision: manifest.revision,
      idempotentReplay: false,
    });
    const receiptResult = {
      changeCheck: input.changeCheck,
      mutation,
      strongOutcome: outcome,
    };
    const journal = this.#appendJournal({
      current,
      manifest,
      event,
      operation: "check_change",
      result: receiptResult,
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      requestDigest: input.requestDigest,
      occurredAt,
    });
    const claims = [
      ...current.bundle.claims.map((claim) => {
        const appendedFindingIds = input.changeCheck.findings
          .filter((finding) =>
            finding.claimIds.includes(claim.id) &&
            !claim.findingIds.includes(finding.id)
          )
          .map((finding) => finding.id);
        return appendedFindingIds.length === 0
          ? claim
          : {
              ...claim,
              findingIds: [...claim.findingIds, ...appendedFindingIds],
            };
      }),
      ...input.findingClaims,
    ];
    const evidence = [
      ...current.bundle.evidence.map(withFindingClaimBacklinks),
      ...outcomeEvidence,
    ];
    const impactPaths = current.bundle.impactPaths.map((impactPath) => {
      const appendedClaimIds = input.findingClaims
        .filter((claim) =>
          input.changeCheck.findings.some((finding) =>
            finding.claimIds.includes(claim.id) &&
            finding.impactPathIds.includes(impactPath.id)
          ) && !impactPath.claimIds.includes(claim.id)
        )
        .map((claim) => claim.id);
      return appendedClaimIds.length === 0
        ? impactPath
        : {
            ...impactPath,
            claimIds: [...impactPath.claimIds, ...appendedClaimIds],
          };
    });
    const verificationRecords = current.bundle.verificationRecords;
    const artifacts = this.#projectionArtifacts({
      manifest,
      brief: current.bundle.brief,
      claims,
      evidence,
      impactPaths,
      impactConclusion: input.impactConclusion,
      changeCheck: input.changeCheck,
      verificationRecords,
      idempotencyRecords: journal.records,
      receipts: journal.receipts,
      createdAt: occurredAt,
    });
    const bundle = validateTaskArtifactBundleV1({
      manifest,
      brief: current.bundle.brief,
      claims,
      evidence,
      impactPaths,
      impactConclusion: input.impactConclusion,
      changeChecks: [input.changeCheck],
      verificationRecords,
      events: [...current.bundle.events, event],
      idempotencyRecords: journal.records,
    });
    return {
      profile: "strong_canonical_task_projection_v1",
      operation: "check_change",
      requestDigest: input.requestDigest,
      bundle,
      artifacts,
      receipts: journal.receipts,
      outcome,
    };
  }

  #buildVerificationProjection(
    current: ReadTaskBundleResult,
    input: StrongVerificationCommitRequestV1,
  ): StrongCanonicalTaskProjectionV1 {
    if (
      !("brief" in current.bundle) ||
      !("impactConclusion" in current.bundle) ||
      current.bundle.changeChecks.length !== 1
    ) {
      throw new StrongChangeAuthorityErrorV1("strong_task_required");
    }
    const occurredAt = input.verification.recordedAt;
    const manifest = TaskManifestV1Schema.parse({
      ...current.bundle.manifest,
      revision: input.expectedRevision + 1,
      updatedAt: occurredAt,
    });
    const event = buildEvent({
      manifest,
      previousManifest: current.bundle.manifest,
      previousEvent: current.bundle.events.at(-1),
      action: {
        type: "verification_recorded",
        verificationRecordId: input.verification.id,
      },
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      requestDigest: input.requestDigest,
      occurredAt,
    });
    const mutation = {
      taskId: manifest.taskId,
      revision: manifest.revision,
      eventId: event.eventId,
      artifactIds: [
        ...current.artifacts.map((artifact) => artifact.artifactId),
        artifactId("verification", manifest.taskId),
      ],
      idempotentReplay: false,
    };
    const outcome = StrongVerificationMutationOutcomeV1Schema.parse({
      profile: "strong_verification_outcome_v1",
      verification: input.verification,
      commitEvidence: input.commitEvidence,
      committedRevision: manifest.revision,
      idempotentReplay: false,
    });
    const receiptResult = {
      verification: input.verification,
      mutation,
      strongOutcome: outcome,
    };
    const journal = this.#appendJournal({
      current,
      manifest,
      event,
      operation: "record_verification",
      result: receiptResult,
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      requestDigest: input.requestDigest,
      occurredAt,
    });
    const claims = current.bundle.claims.map((claim) =>
      input.verification.claimIds.includes(claim.id) &&
        "verificationRecordIds" in claim
        ? {
            ...claim,
            verificationRecordIds: [
              ...claim.verificationRecordIds,
              input.verification.id,
            ],
          }
        : claim
    );
    const verificationRecords = [
      ...current.bundle.verificationRecords,
      input.verification,
    ];
    const changeCheck = current.bundle.changeChecks[0]!;
    const artifacts = this.#projectionArtifacts({
      manifest,
      brief: current.bundle.brief,
      claims,
      evidence: current.bundle.evidence,
      impactPaths: current.bundle.impactPaths,
      impactConclusion: current.bundle.impactConclusion,
      changeCheck,
      verificationRecords,
      idempotencyRecords: journal.records,
      receipts: journal.receipts,
      createdAt: occurredAt,
    });
    const bundle = validateTaskArtifactBundleV1({
      manifest,
      brief: current.bundle.brief,
      claims,
      evidence: current.bundle.evidence,
      impactPaths: current.bundle.impactPaths,
      impactConclusion: current.bundle.impactConclusion,
      changeChecks: current.bundle.changeChecks,
      verificationRecords,
      events: [...current.bundle.events, event],
      idempotencyRecords: journal.records,
    });
    return {
      profile: "strong_canonical_task_projection_v1",
      operation: "record_verification",
      requestDigest: input.requestDigest,
      bundle,
      artifacts,
      receipts: journal.receipts,
      outcome,
    };
  }

  async commitTaskVerified(
    inputValue: UpdateTaskInputV1,
    proposedAt: string,
  ): Promise<VerifiedTaskMutationOutcomeInternalV1> {
    const input = UpdateTaskInputV1Schema.parse(inputValue);
    if (input.action.type !== "transition_status" || input.action.to !== "verified") {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
    const provider = this.#requireProvider();
    if (provider.inspectBusinessHead === undefined) {
      throw new StrongChangeAuthorityErrorV1("strong_write_locked");
    }
    const requestDigest = digest(input);
    const intent = { taskId: input.taskId, expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey, actor: input.actor,
      operation: "update_task" as const, requestDigest };
    const reader = {
      inspectBusinessHead: () => provider.inspectBusinessHead!(),
      readExactObject: async (locator: { providerId: string; contentDigest: ContentDigest }) => ({
        ...await provider.readExactObject({ locator }), operation: "read_object",
      }),
    };
    try {
      const local = await this.#localStrongReplay(intent);
      let candidate: StrongCanonicalTaskProjectionV1;
      let sourceProviderRevision: number | undefined;
      if (local !== undefined) {
        if (local.requestDigest !== requestDigest) {
          throw new StrongChangeAuthorityErrorV1("repository_cas_conflict");
        }
        candidate = local.projection;
      } else {
        const recovery = await this.#store.readActiveStrongOperationBindingInternalV1(intent);
        if (recovery !== undefined) {
          // The intent is only a locator. Original-nonce Provider replay below
          // still has to establish that these exact bytes were committed.
          if (recovery.phase !== "strong_task_verified_v1" || recovery.ownerDetail !== "none") {
            throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
          }
          const locator = { providerId: recovery.projection.providerId, contentDigest: recovery.projection.contentDigest };
          const object = await provider.readExactObject({ locator });
          const bytes = Buffer.from(object.bytes.slice("base64url:".length), "base64url");
          const json = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
          candidate = this.#parseCanonicalProjection(JSON.parse(json), "update_task", requestDigest);
          if (!canonicalEqual(object.locator, locator) || object.verifiedContentDigest !== locator.contentDigest ||
            object.bytes !== `base64url:${bytes.toString("base64url")}` || object.logicalBytes !== bytes.length ||
            bytes.length !== recovery.projection.logicalBytes || digest(candidate) !== locator.contentDigest ||
            canonicalizeJson(candidate) !== json) throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
        } else {
        const head = await provider.inspectBusinessHead();
        if (typeof head === "object" && head !== null && "phase" in head &&
          head.phase === "strong_task_verified_v1") {
          // Provider committed but the process died before local persistence.
          candidate = await readCommittedStrongTaskProjectionInternalV1(reader, {
            taskId: input.taskId, operation: "update_task", requestDigest,
            committedRevision: input.expectedRevision + 1,
          });
        } else {
          const sourceHeadIdentity = canonicalizeJson(head);
          const fromCheck = typeof head === "object" && head !== null && "phase" in head && head.phase === "strong_change_check_v1";
          const source = await readCommittedStrongTaskProjectionInternalV1(reader, {
            taskId: input.taskId, operation: fromCheck ? "check_change" : "record_verification",
          });
          if (canonicalizeJson(await provider.inspectBusinessHead()) !== sourceHeadIdentity ||
            typeof head !== "object" || head === null || !("revision" in head) ||
            !Number.isSafeInteger(head.revision)) {
            throw new StrongChangeAuthorityErrorV1("repository_cas_conflict");
          }
          sourceProviderRevision = head.revision as number;
          const current = await this.#store.readTaskBundle(input.taskId);
          const expected = this.#deriveVerificationStateSuffix(source, current);
          if (!canonicalEqual(current.bundle, expected.bundle) ||
            !canonicalEqual(current.artifacts, expected.artifacts) ||
            !canonicalEqual(current.receipts, expected.receipts) ||
            (current.freshness !== "fresh" && current.freshness !== "partial") ||
            (current.latestSnapshotId !== undefined && current.latestSnapshotId !== source.bundle.manifest.latestSnapshotId)) {
            throw new StrongChangeAuthorityErrorV1("repository_read_set_conflict");
          }
          const occurredAt = await this.reserveOperationTime(intent, new Date(Math.max(
            Date.parse(current.bundle.manifest.updatedAt) + 1, Date.parse(proposedAt),
          )).toISOString());
          candidate = this.#buildTaskVerifiedProjection(current, input, requestDigest, occurredAt);
        }
        }
      }
      const resolution = await this.#commitProviderProjection(
        "strong_task_verified_v1", input.expectedRevision, requestDigest,
        input.idempotencyKey, input.actor, candidate, { actorDigest: digest(input.actor) },
        undefined, sourceProviderRevision,
      );
      if (local !== undefined && resolution.resolution !== "replayed") {
        throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
      }
      const committed = this.#parseCanonicalProjection(resolution.projection, "update_task", requestDigest);
      if (!("task" in committed.outcome)) throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
      const replayed = local !== undefined || await this.#persistProviderProjection(committed, intent);
      return { task: committed.outcome.task, mutation: { ...committed.outcome.mutation,
        idempotentReplay: resolution.resolution === "replayed" || replayed } };
    } catch (error) {
      await this.#store.abortReservedStrongOperationIntent(intent);
      throw error;
    }
  }

  #deriveVerificationStateSuffix(source: StrongCanonicalTaskProjectionV1,
    current: ReadTaskBundleResult): Pick<StrongCanonicalTaskProjectionV1, "bundle" | "artifacts" | "receipts"> {
    const original = source.bundle;
    const fromCheck = source.operation === "check_change";
    if (!("impactConclusion" in original) || original.changeChecks.length !== 1 ||
      original.changeChecks[0]!.actualSnapshotId !== original.manifest.latestSnapshotId ||
      (fromCheck ? original.manifest.status !== "check_required" ||
        original.brief.verificationPlan.some((entry) => entry.required !== false) ||
        original.changeChecks[0]!.findings.some((finding) => finding.blocking && finding.resolution === undefined)
        : source.operation !== "record_verification" || original.manifest.status !== "verification_required")) {
      throw new StrongChangeAuthorityErrorV1("repository_read_set_conflict");
    }
    // Replay only pure state history: balanced block/resume, plus the one
    // no-required transition. No acceptance or semantic artifact delta is trusted.
    let state: Pick<StrongCanonicalTaskProjectionV1, "bundle" | "artifacts" | "receipts"> = source;
    for (const event of current.bundle.events.slice(original.events.length)) {
      const prior = state.bundle;
      if (Date.parse(event.occurredAt) <= Date.parse(prior.manifest.updatedAt)) {
        throw new StrongChangeAuthorityErrorV1("repository_read_set_conflict");
      }
      const action = event.action;
      let next = prior.manifest;
      if (action.type === "block_task" &&
        (next.status === "check_required" || next.status === "verification_required")) {
        const { currentChangeCheckId: _id, currentChangeCheckRevision: _revision, ...withoutCheck } = next;
        next = { ...withoutCheck, status: "blocked", blockedState: { resumeStatus: next.status,
          reasonCode: action.reasonCode, message: action.message, actor: event.actor, blockedAt: event.occurredAt } };
      } else if (action.type === "resume_task" && next.status === "blocked" && next.blockedState !== undefined) {
        const { blockedState, ...unblocked } = next;
        next = { ...unblocked, status: blockedState.resumeStatus,
          ...(blockedState.resumeStatus !== "verification_required" ? {} : {
            currentChangeCheckId: original.changeChecks[0]!.id,
            currentChangeCheckRevision: original.changeChecks[0]!.taskRevision,
          }) };
      } else if (fromCheck && action.type === "transition_status" && action.to === "verification_required" && next.status === "check_required") {
        next = { ...next, status: "verification_required", currentChangeCheckId: original.changeChecks[0]!.id,
          currentChangeCheckRevision: original.changeChecks[0]!.taskRevision };
      } else throw new StrongChangeAuthorityErrorV1("repository_read_set_conflict");
      const input = UpdateTaskInputV1Schema.parse({ taskId: prior.manifest.taskId, expectedRevision: prior.manifest.revision,
        actor: event.actor, idempotencyKey: event.idempotencyKey, action });
      const manifest = TaskManifestV1Schema.parse({ ...next, revision: prior.manifest.revision + 1, updatedAt: event.occurredAt });
      const expectedEvent = buildEvent({ manifest, previousManifest: prior.manifest,
        previousEvent: prior.events.at(-1), action: input.action, actor: input.actor,
        idempotencyKey: input.idempotencyKey, requestDigest: digest(input), occurredAt: event.occurredAt });
      const result = { task: manifest, mutation: { taskId: manifest.taskId, revision: manifest.revision,
        eventId: expectedEvent.eventId, artifactIds: state.artifacts.map((artifact) => artifact.artifactId), idempotentReplay: false } };
      const journal = this.#appendJournal({ current: { ...current, bundle: prior, artifacts: [...state.artifacts], receipts: [...state.receipts] },
        manifest, event: expectedEvent, operation: "update_task", result, actor: input.actor,
        idempotencyKey: input.idempotencyKey, requestDigest: digest(input), occurredAt: event.occurredAt });
      const artifacts = state.artifacts.map((artifact) => {
        const payload = artifact.artifactType === "task_manifest" ? manifest
          : artifact.artifactType === "task_operation_journal" ? { idempotencyRecords: journal.records, receipts: journal.receipts }
          : artifact.payload;
        return parsePersistedArtifactV1({ ...artifact, revision: manifest.revision,
          createdAt: event.occurredAt, contentDigest: digest(payload), payload });
      });
      state = { bundle: validateTaskArtifactBundleV1({ ...prior, manifest,
        events: [...prior.events, expectedEvent], idempotencyRecords: journal.records }), artifacts, receipts: journal.receipts };
    }
    if (state.bundle.manifest.status !== "verification_required") {
      throw new StrongChangeAuthorityErrorV1("repository_read_set_conflict");
    }
    return state;
  }

  #buildTaskVerifiedProjection(current: ReadTaskBundleResult, input: UpdateTaskInputV1,
    requestDigest: ContentDigest, occurredAt: string): StrongCanonicalTaskProjectionV1 {
    const source = current.bundle;
    if (!("impactConclusion" in source) || source.manifest.status !== "verification_required" ||
      source.manifest.revision !== input.expectedRevision || source.changeChecks.length !== 1 ||
      source.changeChecks[0]!.id !== source.manifest.currentChangeCheckId ||
      source.changeChecks[0]!.actualSnapshotId !== source.manifest.latestSnapshotId ||
      taskVerificationRequirementGuardsV1(source.brief.verificationPlan, source.verificationRecords,
        source.manifest.latestSnapshotId).length !== 0) {
      throw new StrongChangeAuthorityErrorV1("strong_task_required");
    }
    const manifest = TaskManifestV1Schema.parse({ ...source.manifest,
      status: "verified", revision: input.expectedRevision + 1, updatedAt: occurredAt });
    const event = buildEvent({ manifest, previousManifest: source.manifest,
      previousEvent: source.events.at(-1), action: input.action, actor: input.actor,
      idempotencyKey: input.idempotencyKey, requestDigest, occurredAt });
    const outcome = { task: manifest, mutation: { taskId: manifest.taskId, revision: manifest.revision,
      eventId: event.eventId, artifactIds: current.artifacts.map((artifact) => artifact.artifactId),
      idempotentReplay: false } };
    const journal = this.#appendJournal({ current, manifest, event, operation: "update_task", result: outcome,
      actor: input.actor, idempotencyKey: input.idempotencyKey, requestDigest, occurredAt });
    const artifacts = this.#projectionArtifacts({ manifest, brief: source.brief, claims: source.claims,
      evidence: source.evidence, impactPaths: source.impactPaths, impactConclusion: source.impactConclusion,
      changeCheck: source.changeChecks[0]!, verificationRecords: source.verificationRecords,
      idempotencyRecords: journal.records, receipts: journal.receipts, createdAt: occurredAt });
    const bundle = validateTaskArtifactBundleV1({ ...source, manifest,
      events: [...source.events, event], idempotencyRecords: journal.records });
    return { profile: "strong_canonical_task_projection_v1", operation: "update_task", requestDigest,
      bundle, artifacts, receipts: journal.receipts, outcome };
  }

  #parseCanonicalProjection(
    value: unknown,
    operation: StrongCanonicalTaskProjectionV1["operation"],
    requestDigest: ContentDigest,
  ): StrongCanonicalTaskProjectionV1 {
    try {
      return parseStrongCanonicalTaskProjectionInternalV1(
        value, operation, requestDigest,
      );
    } catch {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
  }

  async #persistProviderProjection(
    projection: StrongCanonicalTaskProjectionV1,
    input: Readonly<{
      expectedRevision: number;
      idempotencyKey: string;
      requestDigest: ContentDigest;
    }>,
  ): Promise<boolean> {
    const persisted = await this.#store.persistTaskBundle(
      {
        artifacts: projection.artifacts,
        events: projection.bundle.events,
        idempotencyRecords: projection.bundle.idempotencyRecords,
      },
      input,
    );
    const readBack = await this.#store.readTaskBundle(
      projection.bundle.manifest.taskId,
    );
    if (
      !canonicalEqual(readBack.bundle, projection.bundle) ||
      !canonicalEqual(readBack.artifacts, projection.artifacts) ||
      !canonicalEqual(readBack.receipts, projection.receipts)
    ) {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
    return persisted.replayed;
  }

  async #commitProviderProjection(
    phase: StrongTaskPhaseV1,
    expectedRevision: number,
    requestDigest: ContentDigest,
    idempotencyKey: string,
    actor: string,
    projection: unknown,
    privateArtifacts: Readonly<Record<string, string>> = {},
    privateExactObject?: unknown,
    fixedProviderRevision?: number,
  ): Promise<Readonly<{
    resolution: "committed" | "replayed";
    projection: unknown;
  }>> {
    const provider = this.#requireProvider();
    if (this.#providerId === undefined || this.#providerId.length === 0) {
      throw new StrongChangeAuthorityErrorV1("strong_write_locked");
    }
    const candidate = this.#parseCanonicalProjection(
      projection,
      phase === "strong_change_check_v1"
        ? "check_change"
        : phase === "strong_verification_v1" ? "record_verification" : "update_task",
      requestDigest,
    );
    const canonical = canonicalizeJson(candidate);
    const contentDigest = digest(candidate);
    const locator = { providerId: this.#providerId, contentDigest };
    const taskCutDigest = digest({
      taskId: candidate.bundle.manifest.taskId,
      expectedRevision,
      phase,
    });
    const writeOperationNonce = operationNonce(
      `${phase}:exact-object`,
      taskCutDigest,
    );
    const projectionLogicalBytes = Buffer.byteLength(canonical, "utf8");
    const bytes = `base64url:${Buffer.from(canonical, "utf8").toString("base64url")}`;
    const operation = phase === "strong_change_check_v1"
      ? "check_change" as const
      : phase === "strong_verification_v1" ? "record_verification" as const : "update_task" as const;
    const fullInputEqualityTag = privateArtifacts.fullInputEqualityTag;
    const privateCanonical = privateExactObject === undefined
      ? undefined
      : canonicalizeJson(privateExactObject);
    const privateContentDigest = privateExactObject === undefined
      ? undefined
      : digest(privateExactObject);
    const privateLogicalBytes = privateCanonical === undefined
      ? undefined
      : Buffer.byteLength(privateCanonical, "utf8");
    const privateWriteOperationNonce = privateExactObject === undefined
      ? undefined
      : operationNonce(`${phase}:owner-detail-exact-object`, taskCutDigest);
    const privateLocator = privateContentDigest === undefined
      ? undefined
      : { providerId: this.#providerId, contentDigest: privateContentDigest };
    const privateBytes = privateCanonical === undefined
      ? undefined
      : `base64url:${Buffer.from(privateCanonical, "utf8").toString("base64url")}`;
    const privateObjectArtifacts: Readonly<Record<string, string | number>> =
      privateLocator === undefined || privateLogicalBytes === undefined
        ? {}
        : {
            ownerDetailProviderId: privateLocator.providerId,
            ownerDetailContentDigest: privateLocator.contentDigest,
            ownerDetailLogicalBytes: privateLogicalBytes,
          };
    const compareArtifacts = {
      projectionProviderId: this.#providerId,
      projectionContentDigest: contentDigest,
      projectionLogicalBytes,
      requestDigest,
      idempotencyKey,
      taskExpectedRevision: expectedRevision,
      ...privateArtifacts,
      ...privateObjectArtifacts,
    };
    const providerObjectBinding = {
      profile: "strong_operation_provider_object_binding_v1",
      phase,
      projection: {
        role: "projection",
        providerId: locator.providerId,
        contentDigest: locator.contentDigest,
        logicalBytes: projectionLogicalBytes,
        operationNonce: writeOperationNonce,
      },
      ownerDetail: privateLocator === undefined ||
          privateLogicalBytes === undefined ||
          privateWriteOperationNonce === undefined
        ? "none"
        : {
            role: "owner_detail",
            providerId: privateLocator.providerId,
            contentDigest: privateLocator.contentDigest,
            logicalBytes: privateLogicalBytes,
            operationNonce: privateWriteOperationNonce,
          },
      compareArtifacts,
    } as const satisfies StrongOperationProviderObjectBindingV1;
    const inspected = await provider.inspectState();
    if (
      !Number.isSafeInteger(inspected.revision) || inspected.revision < 0
    ) throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    if (fixedProviderRevision !== undefined && inspected.revision !== fixedProviderRevision) {
      throw new StrongChangeAuthorityErrorV1("repository_cas_conflict");
    }
    let providerExpectedRevision: number;
    try {
      providerExpectedRevision =
        await this.#store.resolveStrongOperationProviderRevision({
          taskId: candidate.bundle.manifest.taskId,
          expectedRevision,
          operation,
          idempotencyKey,
          actor,
          requestDigest,
          ...(fullInputEqualityTag === undefined
            ? {}
            : { fullInputEqualityTag }),
          observedProviderRevision: inspected.revision,
          providerObjectBinding,
        });
    } catch (error) {
      await this.#store.abortReservedStrongOperationIntent({
        taskId: candidate.bundle.manifest.taskId,
        expectedRevision,
        operation,
        idempotencyKey,
        actor,
        requestDigest,
        ...(fullInputEqualityTag === undefined
          ? {}
          : { fullInputEqualityTag }),
      });
      throw error;
    }
    if (fixedProviderRevision !== undefined && providerExpectedRevision !== fixedProviderRevision) {
      throw new StrongChangeAuthorityErrorV1("repository_cas_conflict");
    }
    const written = await provider.writeExactObject({
      operationNonce: writeOperationNonce,
      locator,
      logicalBytes: projectionLogicalBytes,
      bytes,
    });
    if (written.verifiedContentDigest !== contentDigest) {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
    const readAndVerify = async (
      expectedLocator: typeof locator,
      expectedBytes?: string,
    ): Promise<unknown> => {
      const read = await provider.readExactObject({ locator: expectedLocator });
      if (
        read.verifiedContentDigest !== expectedLocator.contentDigest ||
        !canonicalEqual(read.locator, expectedLocator) ||
        (expectedBytes !== undefined && read.bytes !== expectedBytes)
      ) {
        throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
      }
      let decoded: Buffer;
      try {
        const encoded = read.bytes.slice("base64url:".length);
        decoded = Buffer.from(encoded, "base64url");
        if (
          !read.bytes.startsWith("base64url:") ||
          decoded.toString("base64url") !== encoded ||
          decoded.byteLength !== read.logicalBytes
        ) {
          throw new Error("non-canonical bytes");
        }
        const parsed = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(decoded),
        ) as unknown;
        if (digest(parsed) !== expectedLocator.contentDigest) {
          throw new Error("projection digest mismatch");
        }
        return parsed;
      } catch {
        throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
      }
    };
    await readAndVerify(locator, bytes);
    if (
      privateLocator !== undefined &&
      privateContentDigest !== undefined &&
      privateLogicalBytes !== undefined &&
      privateWriteOperationNonce !== undefined &&
      privateBytes !== undefined
    ) {
      const privateWrite = await provider.writeExactObject({
        operationNonce: privateWriteOperationNonce,
        locator: privateLocator,
        logicalBytes: privateLogicalBytes,
        bytes: privateBytes,
      });
      if (privateWrite.verifiedContentDigest !== privateContentDigest) {
        throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
      }
      await readAndVerify(privateLocator, privateBytes);
    }
    let committed: Awaited<ReturnType<StrongChangeProviderAuthorityV1["compareCommit"]>> | undefined;
    for (let attempt = 0; attempt <= 8; attempt += 1) {
      const providerArtifacts = {
        ...compareArtifacts,
        providerExpectedRevision,
      };
      committed = await provider.compareCommit({
        operationNonce: compareOperationNonce(
          phase,
          taskCutDigest,
          providerExpectedRevision,
        ),
        expectedRevision: providerExpectedRevision,
        phase,
        artifacts: providerArtifacts,
      });
      if (committed.resolution !== "stale") {
        if (committed.committedRevision !== providerExpectedRevision + 1) {
          throw new StrongChangeAuthorityErrorV1(
            "strong_change_provider_invalid",
          );
        }
        break;
      }
      if (phase === "strong_task_verified_v1" || fixedProviderRevision !== undefined) {
        throw new StrongChangeAuthorityErrorV1("repository_cas_conflict");
      }
      if (attempt === 8) {
        throw new StrongChangeAuthorityErrorV1("repository_cas_conflict");
      }
      providerExpectedRevision =
        await this.#store.advanceStrongOperationProviderRevision({
          taskId: candidate.bundle.manifest.taskId,
          expectedRevision,
          operation,
          idempotencyKey,
          actor,
          requestDigest,
          ...(fullInputEqualityTag === undefined
            ? {}
            : { fullInputEqualityTag }),
          attemptedProviderRevision: providerExpectedRevision,
          observedProviderRevision: committed.committedRevision,
        });
    }
    if (committed === undefined || committed.resolution === "stale") {
      throw new StrongChangeAuthorityErrorV1("repository_cas_conflict");
    }
    const committedContentDigest = committed.artifacts.projectionContentDigest;
    if (
      typeof committedContentDigest !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(committedContentDigest) ||
      committed.artifacts.requestDigest !== requestDigest ||
      committed.artifacts.idempotencyKey !== idempotencyKey ||
      committed.artifacts.projectionProviderId !== this.#providerId ||
      committed.artifacts.taskExpectedRevision !== expectedRevision ||
      committed.artifacts.providerExpectedRevision !==
        providerExpectedRevision ||
      Object.entries({ ...privateArtifacts, ...privateObjectArtifacts }).some(
        ([key, value]) => committed.artifacts[key] !== value,
      ) ||
      !canonicalEqual(committed.artifacts, {
        ...compareArtifacts,
        providerExpectedRevision,
      })
    ) {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
    const committedProjection = await readAndVerify({
      providerId: this.#providerId,
      contentDigest: committedContentDigest as ContentDigest,
    });
    if (privateExactObject !== undefined) {
      const ownerDetailContentDigest = committed.artifacts.ownerDetailContentDigest;
      if (
        typeof ownerDetailContentDigest !== "string" ||
        !/^sha256:[0-9a-f]{64}$/u.test(ownerDetailContentDigest)
      ) {
        throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
      }
      await readAndVerify({
        providerId: this.#providerId,
        contentDigest: ownerDetailContentDigest as ContentDigest,
      });
    }
    if (
      committed.artifacts.projectionLogicalBytes !==
      Buffer.byteLength(canonicalizeJson(committedProjection), "utf8")
    ) {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
    return { resolution: committed.resolution, projection: committedProjection };
  }

  async #taskProjection(
    taskId: string,
    expectedRevision: number,
    expectedStatus: "check_required" | "verification_required",
  ): Promise<StrongChangeTaskProjectionV1> {
    const read = await this.#store.readTaskBundle(taskId);
    const manifest = read.bundle.manifest;
    if (manifest.revision !== expectedRevision) {
      throw new StrongChangeAuthorityErrorV1("repository_cas_conflict");
    }
    if (
      manifest.status !== expectedStatus ||
      manifest.taskProfile !== "agent_task_v1" ||
      manifest.taskBaselineArtifactId === undefined ||
      manifest.contextGenerationId === undefined
    ) {
      throw new StrongChangeAuthorityErrorV1("strong_task_required");
    }
    if (!("brief" in read.bundle)) {
      throw new StrongChangeAuthorityErrorV1("strong_task_required");
    }

    const contextGenerationId = ContextGenerationIdV1Schema.parse(
      manifest.contextGenerationId,
    );
    const confirmedPlanIds = new Map<string, string>();
    for (const event of read.bundle.events) {
      if (
        event.action.type === "confirm_plan" &&
        event.action.contextGenerationId === contextGenerationId
      ) {
        for (const id of event.action.plannedChangeIds) {
          confirmedPlanIds.set(id, event.eventId);
        }
      }
    }
    const confirmedObligations = read.bundle.brief.plannedChanges
      .filter((planned) => confirmedPlanIds.has(planned.id))
      .map((planned) => {
        if (planned.expectation === undefined) {
          throw new StrongChangeAuthorityErrorV1("strong_task_required");
        }
        return {
          plannedChangeId: StrongPlannedChangeIdV1Schema.parse(planned.id),
          contextGenerationId,
          expectation: planned.expectation,
          filePath: planned.filePath,
          ...(planned.symbolId === undefined ? {} : { symbolId: planned.symbolId }),
          intentDigest: digest([
            "planned-change-intent-v1",
            { intent: planned.intent },
          ]),
          claimIds: [...planned.claimIds].sort(),
          impactPathIds: [...planned.impactPathIds].sort(),
          confirmationEventId: confirmedPlanIds.get(planned.id)!,
        };
      });
    const verificationPlan = read.bundle.brief.verificationPlan.map((entry) => {
      if (entry.required === undefined) {
        throw new StrongChangeAuthorityErrorV1("strong_task_required");
      }
      return {
        verificationPlanEntryId: VerificationPlanEntryIdV1Schema.parse(entry.id),
        acceptanceClaimIds: [...entry.acceptanceClaimIds].sort(),
        method: entry.method,
        required: entry.required,
      };
    });
    return StrongChangeTaskProjectionV1Schema.parse({
      manifest,
      acceptanceClaimIds: [...read.bundle.brief.acceptanceClaimIds].sort(),
      impactPathIds: read.bundle.impactPaths.map((path) => path.id).sort(),
      confirmedObligations,
      verificationPlan,
    });
  }

  async #actualSnapshot(snapshotId: string): Promise<{
    snapshot: StrongRepositorySnapshotV1;
    artifactId: string;
    contentDigest: ContentDigest;
  }> {
    const expectedId = PathSafeRepositorySnapshotIdV1Schema.parse(snapshotId);
    const read = await this.#store.readArtifact("repository_snapshot", {
      snapshotId: expectedId,
    });
    if (
      read.state !== "current" ||
      read.freshness === "invalid" ||
      read.artifact.artifactType !== "repository_snapshot" ||
      !("profile" in read.artifact.payload) ||
      read.artifact.payload.profile !== "repository_snapshot_path_safe_v1"
    ) {
      throw new StrongChangeAuthorityErrorV1("strong_snapshot_pin_mismatch");
    }
    let snapshot: StrongRepositorySnapshotV1;
    try {
      snapshot = parseTrustedStrongRepositorySnapshotV1(
        read.artifact.payload,
        digestCanonicalJson,
      );
    } catch {
      throw new StrongChangeAuthorityErrorV1("strong_snapshot_pin_mismatch");
    }
    if (snapshot.snapshotId !== expectedId) {
      throw new StrongChangeAuthorityErrorV1("strong_snapshot_pin_mismatch");
    }
    return {
      snapshot,
      artifactId: read.artifact.artifactId,
      contentDigest: read.artifact.contentDigest,
    };
  }

  async prepareCheck(
    inputValue: StrongCheckChangesInputV1,
  ): Promise<StrongChangeCheckPreparationV1> {
    const input = StrongCheckChangesInputV1Schema.parse(inputValue);
    // Establish the Provider gate and cheap Task/Snapshot pins before asking
    // for the local material authority.  This preserves fail-closed error
    // precedence and avoids invoking repository/Graph work for a stale or
    // malformed caller cut.
    this.#requireProvider();
    const task = await this.#taskProjection(
      input.taskId,
      input.expectedRevision,
      "check_required",
    );
    if (task.manifest.latestSnapshotId !== input.actualSnapshotId) {
      throw new StrongChangeAuthorityErrorV1("strong_snapshot_pin_mismatch");
    }
    const materialAuthority = this.#requireMaterialAuthority();
    const actual = await this.#actualSnapshot(input.actualSnapshotId);
    const baseline = await materialAuthority.readPinnedTaskBaseline({
      taskId: input.taskId,
      taskBaselineArtifactId: task.manifest.taskBaselineArtifactId!,
      baselineSnapshotId: task.manifest.baselineSnapshotId,
    });
    let parsedBaseline: ProviderPinnedTaskBaselineAuthorityV1;
    try {
      parsedBaseline = {
        baseline: InternalTaskBaselineV1Schema.parse(baseline.baseline),
        baselineContentDigest: baseline.baselineContentDigest,
        snapshot: parseTrustedStrongRepositorySnapshotV1(
          baseline.snapshot,
          digestCanonicalJson,
        ),
        snapshotArtifactId: baseline.snapshotArtifactId,
        snapshotContentDigest: baseline.snapshotContentDigest,
      };
    } catch {
      throw new StrongChangeAuthorityErrorV1("strong_task_baseline_unavailable");
    }
    if (
      parsedBaseline.baseline.taskId !== input.taskId ||
      parsedBaseline.baseline.artifactId !== task.manifest.taskBaselineArtifactId ||
      parsedBaseline.baseline.captureSnapshotId !== task.manifest.baselineSnapshotId ||
      parsedBaseline.snapshot.snapshotId !== task.manifest.baselineSnapshotId
    ) {
      throw new StrongChangeAuthorityErrorV1("strong_task_baseline_unavailable");
    }
    let preparation: StrongChangeCheckPreparationV1;
    try {
      preparation = StrongChangeCheckPreparationV1Schema.parse(
        await materialAuthority.buildCheckPreparation({
          task,
          baseline: parsedBaseline,
          actualSnapshot: actual.snapshot,
          actualSnapshotArtifactId: actual.artifactId,
          actualSnapshotContentDigest: actual.contentDigest,
        }),
      );
    } catch {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
    if (
      !canonicalEqual(preparation.task, task) ||
      !canonicalEqual(preparation.baseline, parsedBaseline.baseline) ||
      !canonicalEqual(preparation.baselineSnapshot, parsedBaseline.snapshot) ||
      !canonicalEqual(preparation.actualSnapshot, actual.snapshot) ||
      preparation.basis.baselineSnapshotArtifactId !== parsedBaseline.snapshotArtifactId ||
      preparation.basis.baselineSnapshotContentDigest !== parsedBaseline.snapshotContentDigest ||
      preparation.basis.actualSnapshotArtifactId !== actual.artifactId ||
      preparation.basis.actualSnapshotContentDigest !== actual.contentDigest ||
      preparation.basis.taskBaselineContentDigest !== parsedBaseline.baselineContentDigest
    ) {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
    return preparation;
  }

  async captureTaskBaseline(
    inputValue: StrongTaskBaselineCaptureInputV1,
  ): Promise<StrongTaskBaselineCaptureOutcomeV1> {
    const input = StrongTaskBaselineCaptureInputV1Schema.parse(inputValue);
    const materialAuthority = this.#requireMaterialAuthority();
    const current = await this.#actualSnapshot(input.snapshotId);
    let outcome: StrongTaskBaselineCaptureOutcomeV1;
    try {
      outcome = StrongTaskBaselineCaptureOutcomeV1Schema.parse(
        await materialAuthority.captureTaskBaseline({
          operation: input,
          snapshot: current.snapshot,
          snapshotArtifactId: current.artifactId,
          snapshotContentDigest: current.contentDigest,
        }),
      );
    } catch {
      throw new StrongChangeAuthorityErrorV1(
        "strong_task_baseline_unavailable",
      );
    }
    const baseline = outcome.baseline;
    const baselineHead = baseline.baselineHead.status === "unborn"
      ? baseline.baselineHead
      : {
          status: "present" as const,
          commit: baseline.baselineHead.commit,
          treeObjectId: baseline.baselineHead.treeObjectId,
          gitLease: baseline.baselineHead.gitLease.status === "unpinned"
            ? baseline.baselineHead.gitLease
            : {
                status: "pinned" as const,
                leaseId: baseline.baselineHead.gitLease.leaseId,
                refName: baseline.baselineHead.gitLease.refName,
                objectId: baseline.baselineHead.gitLease.objectId,
              },
        };
    const semanticFields = {
      taskId: baseline.taskId,
      repositoryId: baseline.repositoryId,
      worktreeId: baseline.worktreeId,
      captureSnapshotId: baseline.captureSnapshotId,
      baselineHead,
      repositoryStateToken: baseline.repositoryStateToken,
      attributesDigest: baseline.attributesDigest,
      scannerPolicyDigest: baseline.scannerPolicyDigest,
      repositoryPolicyDigest: baseline.repositoryPolicyDigest,
      safeGitExecutionDigest: baseline.safeGitExecutionDigest,
      baselineMaterializationBudgetDigest:
        baseline.baselineMaterializationBudgetDigest,
      privateStoreQuotaPolicyDigest: baseline.privateStoreQuotaPolicyDigest,
      captureStatus: baseline.captureStatus,
      paths: baseline.paths,
      redactedUnits: baseline.redactedUnits,
      boundaries: baseline.boundaries,
    };
    const semanticDigest = digest([
      "task-baseline-semantic-v1",
      semanticFields,
    ]);
    const expectedId = `task-baseline:${digest([
      "task-baseline-v1",
      {
        taskId: input.taskId,
        captureSnapshotId: input.snapshotId,
        materializationVersion: baseline.materializationVersion,
        baselineSemanticDigest: semanticDigest,
      },
    ]).slice("sha256:".length, 29)}`;
    if (
      baseline.taskId !== input.taskId ||
      baseline.captureSnapshotId !== input.snapshotId ||
      baseline.repositoryId !== current.snapshot.repositoryId ||
      baseline.worktreeId !== current.snapshot.worktreeId ||
      baseline.artifactId !== expectedId ||
      outcome.baselineSemanticDigest !== semanticDigest ||
      outcome.baselineContentDigest !== digest(baseline) ||
      !canonicalEqual(outcome.snapshot, current.snapshot) ||
      outcome.snapshotArtifactId !== current.artifactId ||
      outcome.snapshotContentDigest !== current.contentDigest
    ) {
      throw new StrongChangeAuthorityErrorV1(
        "strong_task_baseline_unavailable",
      );
    }
    return outcome;
  }

  async commitCheck(
    inputValue: StrongChangeCheckCommitRequestV1,
  ): Promise<StrongChangeCheckMutationOutcomeV1> {
    const input = StrongChangeCheckCommitRequestV1Schema.parse(inputValue);
    try {
    const provider = this.#requireProvider();
    const task = await this.#taskProjection(
      input.changeCheck.taskId,
      input.expectedRevision,
      "check_required",
    );
    if (
      input.changeCheck.taskRevision !== input.expectedRevision + 1 ||
      input.changeCheck.baselineSnapshotId !== task.manifest.baselineSnapshotId ||
      input.changeCheck.actualSnapshotId !== task.manifest.latestSnapshotId ||
      input.commitEvidence.readSet.readSetDigest !==
        input.changeCheck.analysis.repositoryReadSetDigest
    ) {
      throw new StrongChangeAuthorityErrorV1("repository_read_set_conflict");
    }
    const materialAuthority = this.#requireMaterialAuthority();
    const actual = await this.#actualSnapshot(input.changeCheck.actualSnapshotId);
    const baseline = await materialAuthority.readPinnedTaskBaseline({
      taskId: input.changeCheck.taskId,
      taskBaselineArtifactId: task.manifest.taskBaselineArtifactId!,
      baselineSnapshotId: task.manifest.baselineSnapshotId,
    });
    const finalPreparation = StrongChangeCheckPreparationV1Schema.parse(
      await materialAuthority.buildCheckPreparation({
        task,
        baseline,
        actualSnapshot: actual.snapshot,
        actualSnapshotArtifactId: actual.artifactId,
        actualSnapshotContentDigest: actual.contentDigest,
      }),
    );
    const expectedAnalysisInputDigest = digest([
      "change-analysis-input-v1",
      {
        basis: finalPreparation.basis,
        rulesetVersion: finalPreparation.rulesetVersion,
        budget: finalPreparation.budget,
        confirmedObligations: finalPreparation.task.confirmedObligations,
        verificationPlan: finalPreparation.task.verificationPlan,
        repositoryDelta: finalPreparation.repositoryDelta,
      },
    ]);
    const committedHunks = input.evidence
      .filter((item) => item.kind === "diff_hunk")
      .map((item) => item.hunk)
      .sort((left, right) => left.id.localeCompare(right.id));
    const revalidatedHunks = finalPreparation.analyzedHunks
      .map((item) => item.hunk)
      .sort((left, right) => left.id.localeCompare(right.id));
    if (
      !canonicalEqual(finalPreparation.task, task) ||
      !canonicalEqual(finalPreparation.basis, {
        recordId: input.changeCheck.analysis.basisRecordId,
        recordContentDigest: input.changeCheck.analysis.basisRecordContentDigest,
        basisDigest: input.changeCheck.analysis.repositoryBasisDigest,
        readSetDigest: input.changeCheck.analysis.repositoryReadSetDigest,
        baselineSnapshotArtifactId: baseline.snapshotArtifactId,
        baselineSnapshotContentDigest: baseline.snapshotContentDigest,
        actualSnapshotArtifactId: actual.artifactId,
        actualSnapshotContentDigest: actual.contentDigest,
        graphArtifactId: input.changeCheck.analysis.graphArtifactId,
        graphContentDigest: input.changeCheck.analysis.graphContentDigest,
        graphSourceSnapshotId: input.changeCheck.analysis.graphSourceSnapshotId,
        taskBaselineArtifactId: baseline.baseline.artifactId,
        taskBaselineContentDigest: baseline.baselineContentDigest,
      }) ||
      !canonicalEqual(
        finalPreparation.repositoryDelta,
        input.changeCheck.analysis.repositoryDelta,
      ) ||
      !canonicalEqual(revalidatedHunks, committedHunks) ||
      finalPreparation.authorityToken !== input.authorityToken ||
      expectedAnalysisInputDigest !== input.changeCheck.analysis.analysisInputDigest ||
      input.commitEvidence.provenance.analysisInputDigest !== expectedAnalysisInputDigest ||
      input.commitEvidence.provenance.semanticDigest !== input.changeCheck.analysis.semanticDigest
    ) {
      throw new StrongChangeAuthorityErrorV1("repository_read_set_conflict");
    }
    void provider;
    const current = await this.#store.readTaskBundle(input.changeCheck.taskId);
    if (current.bundle.manifest.revision !== input.expectedRevision) {
      throw new StrongChangeAuthorityErrorV1("repository_cas_conflict");
    }
    const candidate = this.#buildCheckProjection(current, input);
    const resolution = await this.#commitProviderProjection(
      "strong_change_check_v1",
      input.expectedRevision,
      input.requestDigest,
      input.idempotencyKey,
      input.actor,
      candidate,
      { actorDigest: digest(input.actor) },
    );
    const committed = this.#parseCanonicalProjection(
      resolution.projection,
      "check_change",
      input.requestDigest,
    );
    if (!("profile" in committed.outcome) || committed.outcome.profile !== "strong_change_check_outcome_v1") {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
    const localReplay = await this.#persistProviderProjection(committed, {
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      requestDigest: input.requestDigest,
    });
    return StrongChangeCheckMutationOutcomeV1Schema.parse({
      ...committed.outcome,
      idempotentReplay: resolution.resolution === "replayed" || localReplay,
    });
    } catch (error) {
      await this.#store.abortReservedStrongOperationIntent({
        taskId: input.changeCheck.taskId,
        expectedRevision: input.expectedRevision,
        operation: "check_change",
        idempotencyKey: input.idempotencyKey,
        actor: input.actor,
        requestDigest: input.requestDigest,
      });
      throw error;
    }
  }

  async prepareVerification(
    inputValue: StrongRecordVerificationInputV1,
    security?: StrongVerificationSecurityProjectionV1,
  ): Promise<StrongVerificationPreparationV1> {
    const input = StrongRecordVerificationInputV1Schema.parse(inputValue);
    this.#requireProvider();
    const task = await this.#taskProjection(
      input.taskId,
      input.expectedRevision,
      "verification_required",
    );
    const expectedPlan = task.verificationPlan.find(
      (entry) => entry.verificationPlanEntryId === input.verificationPlanEntryId,
    );
    if (expectedPlan === undefined) {
      throw new StrongChangeAuthorityErrorV1("strong_task_required");
    }
    const materialAuthority = this.#requireMaterialAuthority();
    let preparation: StrongVerificationPreparationV1;
    try {
      preparation = StrongVerificationPreparationV1Schema.parse(
        await materialAuthority.buildVerificationPreparation({
          operation: input,
          task,
          ...(security === undefined ? {} : { security }),
        }),
      );
    } catch {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
    if (
      !canonicalEqual(preparation.task, task) ||
      !canonicalEqual(preparation.planEntry, expectedPlan) ||
      preparation.changeCheck.id !== task.manifest.currentChangeCheckId ||
      preparation.changeCheck.actualSnapshotId !== task.manifest.latestSnapshotId ||
      preparation.changeCheckContentDigest !== digest(preparation.changeCheck)
    ) {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
    const actual = await this.#actualSnapshot(task.manifest.latestSnapshotId);
    const pinnedBaseline = await materialAuthority.readPinnedTaskBaseline({
      taskId: input.taskId,
      taskBaselineArtifactId: task.manifest.taskBaselineArtifactId!,
      baselineSnapshotId: task.manifest.baselineSnapshotId,
    });
    const analysis = preparation.changeCheck.analysis;
    const expectedBasis = {
      recordId: analysis.basisRecordId,
      recordContentDigest: analysis.basisRecordContentDigest,
      basisDigest: analysis.repositoryBasisDigest,
      readSetDigest: analysis.repositoryReadSetDigest,
      baselineSnapshotArtifactId: pinnedBaseline.snapshotArtifactId,
      baselineSnapshotContentDigest: pinnedBaseline.snapshotContentDigest,
      actualSnapshotArtifactId: actual.artifactId,
      actualSnapshotContentDigest: actual.contentDigest,
      graphArtifactId: analysis.graphArtifactId,
      graphContentDigest: analysis.graphContentDigest,
      graphSourceSnapshotId: analysis.graphSourceSnapshotId,
      taskBaselineArtifactId: pinnedBaseline.baseline.artifactId,
      taskBaselineContentDigest: pinnedBaseline.baselineContentDigest,
    };
    if (
      !canonicalEqual(preparation.basis, expectedBasis) ||
      preparation.authorityToken !== actual.snapshot.repositoryStateToken
    ) {
      throw new StrongChangeAuthorityErrorV1("repository_read_set_conflict");
    }
    return preparation;
  }

  scanVerificationInput(
    input: StrongRecordVerificationInputV1,
  ): Promise<StrongVerificationSecurityProjectionV1> {
    return this.#requireMaterialAuthority().scanVerificationInput(input);
  }

  async commitVerification(
    inputValue: StrongVerificationCommitRequestV1,
  ): Promise<StrongVerificationMutationOutcomeV1> {
    const input = StrongVerificationCommitRequestV1Schema.parse(inputValue);
    try {
    const provider = this.#requireProvider();
    const task = await this.#taskProjection(
      input.verification.taskId,
      input.expectedRevision,
      "verification_required",
    );
    const current = await this.#store.readTaskBundle(input.verification.taskId);
    if (
      current.bundle.manifest.revision !== input.expectedRevision ||
      !("changeChecks" in current.bundle)
    ) {
      throw new StrongChangeAuthorityErrorV1("repository_cas_conflict");
    }
    const materialAuthority = this.#requireMaterialAuthority();
    const storedCheckCandidate = current.bundle.changeChecks.find(
      (check) => check.id === task.manifest.currentChangeCheckId,
    );
    const parsedStoredCheck = EvidenceBackedChangeCheckV1Schema.safeParse(
      storedCheckCandidate,
    );
    if (!parsedStoredCheck.success) {
      throw new StrongChangeAuthorityErrorV1("repository_read_set_conflict");
    }
    const storedCheck = parsedStoredCheck.data;
    const actual = await this.#actualSnapshot(input.verification.snapshotId);
    const baseline = await materialAuthority.readPinnedTaskBaseline({
      taskId: input.verification.taskId,
      taskBaselineArtifactId: task.manifest.taskBaselineArtifactId!,
      baselineSnapshotId: task.manifest.baselineSnapshotId,
    });
    const finalPreparation = StrongChangeCheckPreparationV1Schema.parse(
      await materialAuthority.buildCheckPreparation({
        task,
        baseline,
        actualSnapshot: actual.snapshot,
        actualSnapshotArtifactId: actual.artifactId,
        actualSnapshotContentDigest: actual.contentDigest,
      }),
    );
    const expectedBasis = {
      recordId: storedCheck.analysis.basisRecordId,
      recordContentDigest: storedCheck.analysis.basisRecordContentDigest,
      basisDigest: storedCheck.analysis.repositoryBasisDigest,
      readSetDigest: storedCheck.analysis.repositoryReadSetDigest,
      baselineSnapshotArtifactId: baseline.snapshotArtifactId,
      baselineSnapshotContentDigest: baseline.snapshotContentDigest,
      actualSnapshotArtifactId: actual.artifactId,
      actualSnapshotContentDigest: actual.contentDigest,
      graphArtifactId: storedCheck.analysis.graphArtifactId,
      graphContentDigest: storedCheck.analysis.graphContentDigest,
      graphSourceSnapshotId: storedCheck.analysis.graphSourceSnapshotId,
      taskBaselineArtifactId: baseline.baseline.artifactId,
      taskBaselineContentDigest: baseline.baselineContentDigest,
    };
    const committedHunks = current.bundle.evidence
      .flatMap((item) => {
        const parsed = DiffHunkEvidenceV1Schema.safeParse(item);
        return parsed.success ? [parsed.data.hunk] : [];
      })
      .sort((left, right) => left.id.localeCompare(right.id));
    const revalidatedHunks = finalPreparation.analyzedHunks
      .map((item) => item.hunk)
      .sort((left, right) => left.id.localeCompare(right.id));
    if (
      input.verification.contextGenerationId !== task.manifest.contextGenerationId ||
      input.verification.snapshotId !== task.manifest.latestSnapshotId ||
      input.verification.changeCheckArtifactId !==
        `artifact:change_check:${input.verification.taskId}` ||
      input.verification.changeCheckContentDigest !== digest(storedCheck) ||
      input.verification.id !== verificationRecordId(
        input.verification,
        input.ownerOnlyDetailCommitment,
      ) ||
      input.authorityToken !== actual.snapshot.repositoryStateToken ||
      !canonicalEqual(finalPreparation.basis, expectedBasis) ||
      !canonicalEqual(finalPreparation.repositoryDelta, storedCheck.analysis.repositoryDelta) ||
      !canonicalEqual(revalidatedHunks, committedHunks) ||
      input.commitEvidence.readSet.basisRecordId !== expectedBasis.recordId ||
      input.commitEvidence.readSet.basisDigest !== expectedBasis.basisDigest ||
      input.commitEvidence.readSet.readSetDigest !== expectedBasis.readSetDigest ||
      input.commitEvidence.provenance.taskBaselineArtifactId !== expectedBasis.taskBaselineArtifactId ||
      input.commitEvidence.provenance.snapshotId !== actual.snapshot.snapshotId ||
      input.commitEvidence.provenance.changeCheckArtifactId !== input.verification.changeCheckArtifactId ||
      input.commitEvidence.provenance.changeCheckContentDigest !== input.verification.changeCheckContentDigest
    ) {
      throw new StrongChangeAuthorityErrorV1("repository_read_set_conflict");
    }
    void provider;
    const candidate = this.#buildVerificationProjection(current, input);
    const resolution = await this.#commitProviderProjection(
      "strong_verification_v1",
      input.expectedRevision,
      input.requestDigest,
      input.idempotencyKey,
      input.actor,
      candidate,
      {
        actorDigest: digest(input.actor),
        fullInputEqualityTag: input.fullInputEqualityTag,
        ...(input.ownerOnlyDetailCommitment === undefined
          ? {}
          : { ownerOnlyDetailCommitment: input.ownerOnlyDetailCommitment }),
      },
      input.ownerOnlyDetail,
    );
    const committed = this.#parseCanonicalProjection(
      resolution.projection,
      "record_verification",
      input.requestDigest,
    );
    if (!("profile" in committed.outcome) || committed.outcome.profile !== "strong_verification_outcome_v1") {
      throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
    }
    const localReplay = await this.#persistProviderProjection(committed, {
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      requestDigest: input.requestDigest,
    });
    return StrongVerificationMutationOutcomeV1Schema.parse({
      ...committed.outcome,
      idempotentReplay: resolution.resolution === "replayed" || localReplay,
    });
    } catch (error) {
      await this.#store.abortReservedStrongOperationIntent({
        taskId: input.verification.taskId,
        expectedRevision: input.expectedRevision,
        operation: "record_verification",
        idempotencyKey: input.idempotencyKey,
        actor: input.actor,
        requestDigest: input.requestDigest,
        fullInputEqualityTag: input.fullInputEqualityTag,
      });
      throw error;
    }
  }
}

export function isStrongEvidenceBackedChangeCheckV1(
  value: unknown,
): value is ReturnType<typeof EvidenceBackedChangeCheckV1Schema.parse> {
  return EvidenceBackedChangeCheckV1Schema.safeParse(value).success;
}
