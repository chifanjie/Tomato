import {
  ArtifactStore,
  type ReadTaskBundleResult,
} from "@understand-code/artifact-store";
import {
  ChangeCheckV1Schema,
  CheckChangeInputV1Schema,
  ClaimV1Schema,
  EvidenceV1Schema,
  IdempotencyRecordV1Schema,
  RecordVerificationInputV1Schema,
  TaskManifestV1Schema,
  TaskOperationReceiptV1Schema,
  VerificationRecordV1Schema,
  classifyChangeCheckV1,
  type ChangeCheckV1,
  type ChangeCheckReadClassificationV1,
  type ChangeFindingV1,
  type CheckChangeInputV1,
  type ClaimV1,
  type EvidenceV1,
  type IdempotencyRecordV1,
  type MutationResultV1,
  type RecordVerificationInputV1,
  type RepositorySnapshotV1,
  type TaskArtifactBundleV1,
  type TaskManifestV1,
  type TaskOperationReceiptV1,
  type VerificationRecordV1,
} from "@understand-code/contracts";

import {
  buildTaskArtifacts,
  buildTaskEvent,
  mutationResult,
} from "./artifacts.js";
import { TaskEngineError } from "./errors.js";
import type {
  TaskChangeAnalysisInput,
  TaskChangeAnalysisResult,
  TaskChangeHunk,
  TaskDeletedFileObservation,
} from "./engine-types.js";
import { sha256CanonicalJson, stableId } from "./ids.js";
import { compareUnicodeCodeUnits } from "./stable-order.js";

export interface ChangeCheckMutationOutcome {
  readonly changeCheck: ChangeCheckV1;
  readonly changeCheckClassification: ChangeCheckReadClassificationV1;
  readonly mutation: MutationResultV1;
}

export interface VerificationMutationOutcome {
  readonly verification: VerificationRecordV1;
  readonly mutation: MutationResultV1;
}

interface FullTaskData {
  manifest: TaskManifestV1;
  brief: Extract<TaskArtifactBundleV1, { brief: unknown }>["brief"];
  claims: ClaimV1[];
  evidence: EvidenceV1[];
  impactPaths: Extract<TaskArtifactBundleV1, { impactPaths: unknown }>["impactPaths"];
  changeChecks: ChangeCheckV1[];
  verificationRecords: VerificationRecordV1[];
}

function fullTaskData(read: ReadTaskBundleResult): FullTaskData {
  if (!("brief" in read.bundle)) {
    throw new TaskEngineError(
      "artifact_unavailable",
      "A contextual Task Brief is required for Change Intelligence actions.",
      { taskId: read.bundle.manifest.taskId, artifactType: "task_brief" },
    );
  }
  return {
    manifest: structuredClone(read.bundle.manifest),
    brief: structuredClone(read.bundle.brief),
    claims: structuredClone(read.bundle.claims),
    evidence: structuredClone(read.bundle.evidence),
    impactPaths: structuredClone(read.bundle.impactPaths),
    changeChecks: structuredClone(read.bundle.changeChecks),
    verificationRecords: structuredClone(read.bundle.verificationRecords),
  };
}

function requireMutableRead(
  read: ReadTaskBundleResult,
  task: TaskManifestV1,
): void {
  const failedGuards: Array<{ code: string; resourceId?: string }> = [];
  if (read.recoveryState !== "current") {
    failedGuards.push({ code: "task_bundle_recovery_read_only" });
  }
  if (read.state !== "current") {
    failedGuards.push({
      code: "task_bundle_state_not_current",
      resourceId: read.state,
    });
  }
  if (read.freshness === "invalid") {
    failedGuards.push({ code: "task_bundle_freshness_invalid" });
  }
  if (failedGuards.length > 0) {
    throw new TaskEngineError(
      "task_gate_unsatisfied",
      "Task state is not writable for this action.",
      {
        taskId: task.taskId,
        targetStatus: task.status,
        failedGuards,
      },
    );
  }
}

function gate(
  task: TaskManifestV1,
  targetStatus: TaskManifestV1["status"],
  code: string,
  resourceId?: string,
): never {
  throw new TaskEngineError(
    "task_gate_unsatisfied",
    `Task cannot perform Change Intelligence action while ${task.status}.`,
    {
      taskId: task.taskId,
      targetStatus,
      failedGuards: [{ code, ...(resourceId === undefined ? {} : { resourceId }) }],
    },
  );
}

function nextTimestamp(previous: string, clock: () => Date): string {
  const minimum = Date.parse(previous) + 1;
  const now = clock().getTime();
  return new Date(Math.max(minimum, Number.isFinite(now) ? now : minimum)).toISOString();
}

function taskReplay(
  read: ReadTaskBundleResult,
  taskId: string,
  actor: string,
  idempotencyKey: string,
  requestDigest: string,
  operation: "check_change",
): ChangeCheckMutationOutcome | undefined;
function taskReplay(
  read: ReadTaskBundleResult,
  taskId: string,
  actor: string,
  idempotencyKey: string,
  requestDigest: string,
  operation: "record_verification",
): VerificationMutationOutcome | undefined;
function taskReplay(
  read: ReadTaskBundleResult,
  taskId: string,
  actor: string,
  idempotencyKey: string,
  requestDigest: string,
  operation: "check_change" | "record_verification",
): ChangeCheckMutationOutcome | VerificationMutationOutcome | undefined {
  const record = read.bundle.idempotencyRecords.find(
    (candidate) =>
      candidate.scope.kind === "task" &&
      candidate.scope.taskId === taskId &&
      candidate.idempotencyKey === idempotencyKey,
  );
  if (record === undefined) return undefined;
  if (record.actor !== actor || record.requestDigest !== requestDigest) {
    throw new TaskEngineError(
      "idempotency_conflict",
      "The Task idempotency key was already used by another request or actor.",
      {
        idempotencyKey,
        requestDigest,
        existingRequestDigest: record.requestDigest,
      },
    );
  }
  const receipt = read.receipts.find(
    (candidate) => candidate.eventId === record.eventId,
  );
  if (receipt === undefined) {
    throw new TaskEngineError(
      "idempotency_conflict",
      "The committed idempotency record has no historical operation receipt.",
      { taskId, eventId: record.eventId },
    );
  }
  if (receipt.operation !== operation) {
    throw new TaskEngineError(
      "idempotency_conflict",
      "The idempotency key belongs to another Task operation.",
      { taskId, operation: receipt.operation },
    );
  }
  if (operation === "check_change") {
    const result = (
      receipt as Extract<TaskOperationReceiptV1, { operation: "check_change" }>
    ).result;
    return {
      changeCheck: result.changeCheck,
      changeCheckClassification: classifyChangeCheckV1(result.changeCheck),
      mutation: { ...result.mutation, idempotentReplay: true },
    };
  }
  const result = (
    receipt as Extract<
      TaskOperationReceiptV1,
      { operation: "record_verification" }
    >
  ).result;
  return {
    verification: result.verification,
    mutation: { ...result.mutation, idempotentReplay: true },
  };
}

async function snapshotFor(
  store: ArtifactStore,
  snapshotId: string,
): Promise<RepositorySnapshotV1> {
  const read = await store.readArtifact("repository_snapshot", { snapshotId });
  if (read.artifact.artifactType !== "repository_snapshot") {
    throw new TaskEngineError(
      "artifact_unavailable",
      "The requested Repository Snapshot has an invalid type.",
      { artifactType: "repository_snapshot", snapshotId },
    );
  }
  return read.artifact.payload;
}

function claimForPlannedChange(
  data: FullTaskData,
  plannedIds: readonly string[],
): string {
  for (const plannedId of plannedIds) {
    const planned = data.brief.plannedChanges.find((item) => item.id === plannedId);
    const claimId = planned?.claimIds[0];
    if (claimId !== undefined && data.claims.some((claim) => claim.id === claimId)) {
      return claimId;
    }
  }
  if (data.claims.some((claim) => claim.id === data.brief.goalClaimId)) {
    return data.brief.goalClaimId;
  }
  const fallback = data.claims[0]?.id;
  if (fallback === undefined) {
    throw new TaskEngineError(
      "artifact_unavailable",
      "A Task Claim ledger is required to persist Change Findings.",
      { taskId: data.manifest.taskId, artifactType: "claim_ledger" },
    );
  }
  return fallback;
}

function buildFindingEvidence(
  taskId: string,
  baselineSnapshot: RepositorySnapshotV1,
  actualSnapshot: RepositorySnapshotV1,
  findingId: string,
  occurredAt: string,
  input:
    | { readonly kind: "source"; readonly hunk: TaskChangeHunk }
    | {
        readonly kind: "deleted_source";
        readonly deletedFile: TaskDeletedFileObservation;
      }
    | { readonly kind: "boundary"; readonly reason: string },
): EvidenceV1 {
  const anchor =
    input.kind === "source"
      ? input.hunk.id
      : input.kind === "deleted_source"
        ? input.deletedFile.id
        : input.reason;
  const id = stableId("evidence:change-check", {
    taskId,
    actualSnapshotId: actualSnapshot.snapshotId,
    findingId,
    anchor,
  });
  if (input.kind === "boundary") {
    return EvidenceV1Schema.parse({
      id,
      kind: "analysis_boundary",
      epistemicStatus: "unknown",
      freshness: "current",
      claimIds: [],
      nodeIds: [],
      producedBy: "task-engine",
      createdAt: occurredAt,
      observedAtSnapshotId: actualSnapshot.snapshotId,
      boundaryReason: input.reason,
      relationPath: [],
    });
  }
  if (input.kind === "deleted_source") {
    return EvidenceV1Schema.parse({
      id,
      kind: "source",
      epistemicStatus: "observed",
      freshness: "changed",
      freshnessReason:
        "The source existed at the Task baseline and is absent from the exact actual Snapshot.",
      claimIds: [],
      nodeIds: [],
      producedBy: "task-engine",
      createdAt: occurredAt,
      observedAtSnapshotId: baselineSnapshot.snapshotId,
      filePath: input.deletedFile.filePath,
      lineRange: [...input.deletedFile.oldLineRange],
      commit: baselineSnapshot.headCommit,
      contentHash: input.deletedFile.contentHash,
    });
  }
  return EvidenceV1Schema.parse({
    id,
    kind: "source",
    epistemicStatus: "observed",
    freshness: "current",
    claimIds: [],
    nodeIds: [...input.hunk.nodeIds],
    producedBy: "task-engine",
    createdAt: occurredAt,
    observedAtSnapshotId: actualSnapshot.snapshotId,
    filePath: input.hunk.filePath,
    lineRange: [...input.hunk.newLineRange],
    contentHash: input.hunk.contentHash,
  });
}

function analysisIsConsistent(
  analysis: TaskChangeAnalysisResult,
  baseline: RepositorySnapshotV1,
  actual: RepositorySnapshotV1,
): boolean {
  const deletedFiles = analysis.deletedFiles ?? [];
  if (
    (analysis.status === "complete") !== (analysis.boundaries.length === 0) ||
    (analysis.status === "unknown" &&
      (analysis.hunks.length !== 0 || deletedFiles.length !== 0)) ||
    (analysis.status === "partial" &&
      (analysis.hunks.length + deletedFiles.length === 0 ||
        analysis.boundaries.length === 0))
  ) {
    return false;
  }
  const actualById = new Map(actual.changes.map((change) => [change.id, change]));
  const coveredIds = new Set<string>();
  const hunkIds = new Set<string>();
  for (const hunk of analysis.hunks) {
    if (
      hunkIds.has(hunk.id) ||
      hunk.actualChangeIds.length === 0 ||
      hunk.nodeIds.length === 0 ||
      new Set(hunk.actualChangeIds).size !== hunk.actualChangeIds.length ||
      new Set(hunk.nodeIds).size !== hunk.nodeIds.length ||
      hunk.newLineRange[0] < 1 ||
      hunk.newLineRange[1] < hunk.newLineRange[0] ||
      !/^sha256:[0-9a-f]{64}$/u.test(hunk.contentHash)
    ) {
      return false;
    }
    hunkIds.add(hunk.id);
    for (const actualChangeId of hunk.actualChangeIds) {
      const change = actualById.get(actualChangeId);
      if (
        change === undefined ||
        change.path !== hunk.filePath ||
        change.contentDigest !== hunk.contentHash
      ) {
        return false;
      }
      coveredIds.add(actualChangeId);
    }
  }
  for (const deletedFile of deletedFiles) {
    if (
      hunkIds.has(deletedFile.id) ||
      deletedFile.actualChangeIds.length === 0 ||
      new Set(deletedFile.actualChangeIds).size !==
        deletedFile.actualChangeIds.length ||
      deletedFile.oldLineRange[0] < 1 ||
      deletedFile.oldLineRange[1] < deletedFile.oldLineRange[0] ||
      !/^sha256:[0-9a-f]{64}$/u.test(deletedFile.contentHash) ||
      baseline.headCommit === undefined
    ) {
      return false;
    }
    hunkIds.add(deletedFile.id);
    for (const actualChangeId of deletedFile.actualChangeIds) {
      const change = actualById.get(actualChangeId);
      if (
        change === undefined ||
        change.path !== deletedFile.filePath ||
        change.source !== "unstaged" ||
        change.kind !== "deleted" ||
        change.contentDigest !== undefined
      ) {
        return false;
      }
      coveredIds.add(actualChangeId);
    }
  }
  for (const boundary of analysis.boundaries) {
    for (const actualChangeId of boundary.actualChangeIds) {
      if (!actualById.has(actualChangeId)) return false;
      coveredIds.add(actualChangeId);
    }
  }
  return actual.changes.every((change) => coveredIds.has(change.id));
}

function makeFindings(
  data: FullTaskData,
  baseline: RepositorySnapshotV1,
  actual: RepositorySnapshotV1,
  analysis: TaskChangeAnalysisResult,
  occurredAt: string,
): {
  findings: ChangeFindingV1[];
  findingClaims: ClaimV1[];
  findingEvidence: EvidenceV1[];
  baseFindingLinks: ReadonlyMap<string, readonly string[]>;
} {
  const deletedFiles = analysis.deletedFiles ?? [];
  const draftFindings: Array<{
    type: ChangeFindingV1["type"];
    severity: ChangeFindingV1["severity"];
    blocking: boolean;
    summary: string;
    plannedChangeIds: string[];
    actualChangeIds: string[];
    baseClaimIds: string[];
    hunks: TaskChangeHunk[];
    deletedFiles: TaskDeletedFileObservation[];
    boundaryReason?: string;
  }> = [];

  const orderedPlans = [...data.brief.plannedChanges].sort((left, right) =>
    compareUnicodeCodeUnits(left.filePath, right.filePath) ||
    compareUnicodeCodeUnits(left.id, right.id),
  );
  const globalBoundaries = analysis.boundaries.filter(
    (boundary) => boundary.filePath === undefined,
  );
  const boundariesByPath = new Map<string, typeof analysis.boundaries>();
  for (const boundary of analysis.boundaries) {
    if (boundary.filePath === undefined) continue;
    const current = boundariesByPath.get(boundary.filePath) ?? [];
    boundariesByPath.set(boundary.filePath, [...current, boundary]);
  }
  const matchedHunkIds = new Set<string>();
  for (const planned of orderedPlans) {
    const relevantBoundaries = [
      ...globalBoundaries,
      ...(boundariesByPath.get(planned.filePath) ?? []),
    ];
    const samePathHunks = analysis.hunks.filter(
      (hunk) => hunk.filePath === planned.filePath,
    );
    const samePathDeletedFiles = deletedFiles.filter(
      (deletedFile) => deletedFile.filePath === planned.filePath,
    );
    const matchingHunks = samePathHunks.filter(
      (hunk) =>
        planned.symbolId !== undefined &&
        hunk.nodeIds.includes(planned.symbolId),
    );
    if (relevantBoundaries.length > 0) {
      draftFindings.push({
        type: "cannot_determine",
        severity: "error",
        blocking: true,
        summary: `Change Intelligence cannot determine whether planned change ${planned.id} was completed at ${planned.filePath}.`,
        plannedChangeIds: [planned.id],
        actualChangeIds: [...new Set(relevantBoundaries.flatMap((item) => item.actualChangeIds))]
          .sort(compareUnicodeCodeUnits),
        baseClaimIds: [claimForPlannedChange(data, [planned.id])],
        hunks: [],
        deletedFiles: [],
        boundaryReason: relevantBoundaries.map((item) => item.reason).join("; "),
      });
      continue;
    }
    if (matchingHunks.length > 0) {
      for (const hunk of matchingHunks) matchedHunkIds.add(hunk.id);
      draftFindings.push({
        type: "planned_completed",
        severity: "info",
        blocking: false,
        summary: `Planned change ${planned.id} is anchored to the actual changed lines in ${planned.filePath}.`,
        plannedChangeIds: [planned.id],
        actualChangeIds: [...new Set(matchingHunks.flatMap((hunk) => hunk.actualChangeIds))]
          .sort(compareUnicodeCodeUnits),
        baseClaimIds: [claimForPlannedChange(data, [planned.id])],
        hunks: matchingHunks,
        deletedFiles: [],
      });
    } else {
      draftFindings.push({
        type: "cannot_determine",
        severity: "error",
        blocking: true,
        summary: `Change Intelligence cannot prove whether unmatched legacy planned change ${planned.id} was required at ${planned.filePath}.`,
        plannedChangeIds: [planned.id],
        actualChangeIds: [...new Set([
          ...samePathHunks.flatMap((hunk) => hunk.actualChangeIds),
          ...samePathDeletedFiles.flatMap(
            (deletedFile) => deletedFile.actualChangeIds,
          ),
        ])]
          .sort(compareUnicodeCodeUnits),
        baseClaimIds: [claimForPlannedChange(data, [planned.id])],
        hunks: [],
        deletedFiles: [],
        boundaryReason:
          "Legacy PlannedChange has no confirmed required-change expectation, and no changed-line hunk mapped to its stable symbol.",
      });
    }
  }
  for (const hunk of analysis.hunks) {
    if (matchedHunkIds.has(hunk.id)) continue;
    draftFindings.push({
      type: "unplanned_change",
      severity: "warning",
      blocking: true,
      summary: `Changed lines ${hunk.newLineRange[0]}-${hunk.newLineRange[1]} at ${hunk.filePath} were not present in the persisted Task plan.`,
      plannedChangeIds: [],
      actualChangeIds: [...hunk.actualChangeIds],
      baseClaimIds: [claimForPlannedChange(data, [])],
      hunks: [hunk],
      deletedFiles: [],
    });
  }
  for (const deletedFile of deletedFiles) {
    draftFindings.push({
      type: "unplanned_change",
      severity: "warning",
      blocking: true,
      summary: `Deleting baseline lines ${deletedFile.oldLineRange[0]}-${deletedFile.oldLineRange[1]} at ${deletedFile.filePath} was not proven as an authorized planned deletion.`,
      plannedChangeIds: [],
      actualChangeIds: [...deletedFile.actualChangeIds],
      baseClaimIds: [claimForPlannedChange(data, [])],
      hunks: [],
      deletedFiles: [deletedFile],
    });
  }
  for (const boundary of analysis.boundaries) {
    if (
      boundary.filePath !== undefined &&
      orderedPlans.some((planned) => planned.filePath === boundary.filePath)
    ) {
      continue;
    }
    draftFindings.push({
      type: "cannot_determine",
      severity: "error",
      blocking: true,
      summary:
        boundary.filePath === undefined
          ? "Change Intelligence could not complete trusted repository analysis."
          : `Change Intelligence could not analyze the repository change at ${boundary.filePath}.`,
      plannedChangeIds: [],
      actualChangeIds: [...boundary.actualChangeIds],
      baseClaimIds: [claimForPlannedChange(data, [])],
      hunks: [],
      deletedFiles: [],
      boundaryReason: boundary.reason,
    });
  }
  if (actual.captureStatus === "error" || baseline.captureStatus === "error") {
    draftFindings.push({
      type: "cannot_determine",
      severity: "error",
      blocking: true,
      summary: "Change comparison could not be completed because Snapshot capture reported an error.",
      plannedChangeIds: [],
      actualChangeIds: [],
      baseClaimIds: [claimForPlannedChange(data, [])],
      hunks: [],
      deletedFiles: [],
      boundaryReason: "Repository Snapshot capture reported an error.",
    });
  }
  if (draftFindings.length === 0) {
    draftFindings.push({
      type: "cannot_determine",
      severity: "error",
      blocking: true,
      summary:
        "The legacy Change Check cannot establish clean evidence from an empty finding set.",
      plannedChangeIds: [],
      actualChangeIds: actual.changes
        .map((change) => change.id)
        .sort(compareUnicodeCodeUnits),
      baseClaimIds: [claimForPlannedChange(data, [])],
      hunks: [],
      deletedFiles: [],
      boundaryReason:
        "Legacy Change Check summaries do not include the five evidence-backed completeness dimensions.",
    });
  }
  const findings: ChangeFindingV1[] = [];
  const findingClaims: ClaimV1[] = [];
  const findingEvidenceItems: EvidenceV1[] = [];
  const baseFindingLinks = new Map<string, string[]>();
  for (const [index, draft] of draftFindings.entries()) {
    const findingId = stableId("finding", {
      taskId: data.manifest.taskId,
      revision: data.manifest.revision + 1,
      index,
      type: draft.type,
      plannedChangeIds: draft.plannedChangeIds,
      actualChangeIds: draft.actualChangeIds,
      hunkIds: draft.hunks.map((hunk) => hunk.id),
      ...(draft.deletedFiles.length === 0
        ? {}
        : {
            deletedFileIds: draft.deletedFiles.map(
              (deletedFile) => deletedFile.id,
            ),
          }),
    });
    const evidences =
      draft.hunks.length > 0 && actual.captureStatus === "complete"
        ? draft.hunks.map((hunk) =>
            buildFindingEvidence(
              data.manifest.taskId,
              baseline,
              actual,
              findingId,
              occurredAt,
              { kind: "source", hunk },
            ),
          )
        : draft.deletedFiles.length > 0 &&
            baseline.captureStatus === "complete" &&
            actual.captureStatus === "complete"
          ? draft.deletedFiles.map((deletedFile) =>
              buildFindingEvidence(
                data.manifest.taskId,
                baseline,
                actual,
                findingId,
                occurredAt,
                { kind: "deleted_source", deletedFile },
              ),
            )
        : [
            buildFindingEvidence(
              data.manifest.taskId,
              baseline,
              actual,
              findingId,
              occurredAt,
              {
                kind: "boundary",
                reason:
                  draft.boundaryReason ??
                  actual.limitations[0] ??
                  "Change Intelligence does not have complete byte-level proof for this finding.",
              },
            ),
          ];
    const claimId = stableId("claim:finding", {
      taskId: data.manifest.taskId,
      revision: data.manifest.revision + 1,
      findingId,
    });
    const epistemicStatus = evidences.every(
      (evidence) => evidence.epistemicStatus === "observed",
    )
      ? "observed"
      : "unknown";
    const findingClaim = ClaimV1Schema.parse({
      id: claimId,
      taskId: data.manifest.taskId,
      kind: "finding",
      statement: draft.summary,
      epistemicStatus,
      lifecycleStatus: epistemicStatus === "observed" ? "supported" : "draft",
      freshness: draft.deletedFiles.length > 0 ? "changed" : "current",
      sourceSnapshotId: actual.snapshotId,
      evidenceIds: evidences.map((evidence) => evidence.id),
      findingIds: [findingId],
      verificationRecordIds: [],
      ...(epistemicStatus === "unknown"
        ? { boundaryReason: "Change Intelligence does not have complete byte-level proof for this finding." }
        : {}),
      createdAt: occurredAt,
      updatedAt: occurredAt,
    });
    const claimIds = [...new Set([...draft.baseClaimIds, claimId])];
    const finding = ChangeCheckV1Schema.shape.findings.element.parse({
      id: findingId,
      type: draft.type,
      severity: draft.severity,
      blocking: draft.blocking,
      summary: draft.summary,
      claimIds,
      plannedChangeIds: draft.plannedChangeIds,
      actualChangeIds: draft.actualChangeIds,
      evidenceIds: evidences.map((evidence) => evidence.id),
      impactPathIds: [],
    });
    findings.push(finding);
    findingClaims.push(findingClaim);
    findingEvidenceItems.push(
      ...evidences.map((evidence) =>
        EvidenceV1Schema.parse({ ...evidence, claimIds: [claimId] }),
      ),
    );
    for (const baseClaimId of draft.baseClaimIds) {
      const links = baseFindingLinks.get(baseClaimId) ?? [];
      links.push(findingId);
      baseFindingLinks.set(baseClaimId, links);
    }
  }
  return {
    findings,
    findingClaims,
    findingEvidence: findingEvidenceItems,
    baseFindingLinks,
  };
}

function appendFindingLinks(
  claims: readonly ClaimV1[],
  links: ReadonlyMap<string, readonly string[]>,
): ClaimV1[] {
  return claims.map((claim) => {
    const findingIds = links.get(claim.id);
    if (findingIds === undefined || findingIds.length === 0) return claim;
    return ClaimV1Schema.parse({
      ...claim,
      findingIds: [...claim.findingIds, ...findingIds],
    });
  });
}

function artifactIds(read: ReadTaskBundleResult, taskId: string, type: "change_check" | "verification"): string[] {
  return [
    ...read.artifacts.map((artifact) => artifact.artifactId),
    `artifact:${type}:${taskId}`,
  ];
}

function appendRecord(
  current: ReadTaskBundleResult,
  manifest: TaskManifestV1,
  event: ReturnType<typeof buildTaskEvent>,
  result: { changeCheck: ChangeCheckV1; mutation: MutationResultV1 } | { verification: VerificationRecordV1; mutation: MutationResultV1 },
  operation: "check_change" | "record_verification",
  actor: string,
  idempotencyKey: string,
  requestDigest: string,
  occurredAt: string,
): { records: IdempotencyRecordV1[]; receipts: TaskOperationReceiptV1[] } {
  const resultDigest = sha256CanonicalJson(result);
  const record = IdempotencyRecordV1Schema.parse({
    schemaVersion: 1,
    worktreeId: manifest.worktreeId,
    scope: { kind: "task", taskId: manifest.taskId },
    idempotencyKey,
    actor,
    requestDigest,
    taskId: manifest.taskId,
    resultRevision: manifest.revision,
    eventId: event.eventId,
    resultDigest,
    createdAt: occurredAt,
  });
  const receipt = TaskOperationReceiptV1Schema.parse({
    schemaVersion: 1,
    operation,
    taskId: manifest.taskId,
    eventId: event.eventId,
    resultDigest,
    result,
  });
  return {
    records: [...current.bundle.idempotencyRecords, record],
    receipts: [...current.receipts, receipt],
  };
}

export async function checkTaskChange(
  store: ArtifactStore,
  inputValue: CheckChangeInputV1,
  clock: () => Date,
  analyzeTaskChanges?: (
    input: TaskChangeAnalysisInput,
  ) => Promise<TaskChangeAnalysisResult>,
): Promise<ChangeCheckMutationOutcome> {
  const input = CheckChangeInputV1Schema.parse(inputValue);
  const requestDigest = sha256CanonicalJson(input);
  let current = await store.readTaskBundle(input.taskId);
  const replay = taskReplay(
    current,
    input.taskId,
    input.actor,
    input.idempotencyKey,
    requestDigest,
    "check_change",
  );
  if (replay !== undefined) return replay as ChangeCheckMutationOutcome;
  if (current.bundle.manifest.revision !== input.expectedRevision) {
    throw new TaskEngineError(
      "revision_conflict",
      "Task revision does not match expectedRevision.",
      {
        taskId: input.taskId,
        expectedRevision: input.expectedRevision,
        currentRevision: current.bundle.manifest.revision,
      },
    );
  }
  const data = fullTaskData(current);
  requireMutableRead(current, data.manifest);
  if (data.manifest.status !== "check_required") {
    gate(data.manifest, "check_required", "current_check_required");
  }
  const actualSnapshotId = input.actualSnapshotId;
  if (actualSnapshotId !== data.manifest.latestSnapshotId) {
    gate(data.manifest, "check_required", "snapshot_not_current", actualSnapshotId);
  }
  const [baseline, actual] = await Promise.all([
    snapshotFor(store, data.manifest.baselineSnapshotId),
    snapshotFor(store, actualSnapshotId),
  ]);
  let repositoryAnalysis: TaskChangeAnalysisResult;
  if (analyzeTaskChanges === undefined) {
    repositoryAnalysis = {
      status: "unknown",
      hunks: [],
      deletedFiles: [],
      boundaries: [
        {
          code: "unsupported_source",
          actualChangeIds: actual.changes
            .map((change) => change.id)
            .sort(compareUnicodeCodeUnits),
          reason:
            "The bound Task context provider does not implement trusted post-change analysis.",
        },
      ],
    };
  } else {
    try {
      repositoryAnalysis = await analyzeTaskChanges({
        taskId: data.manifest.taskId,
        baselineSnapshot: baseline,
        actualSnapshot: actual,
      });
    } catch {
      repositoryAnalysis = {
        status: "unknown",
        hunks: [],
        deletedFiles: [],
        boundaries: [
          {
            code: "unsupported_source",
            actualChangeIds: actual.changes
              .map((change) => change.id)
              .sort(compareUnicodeCodeUnits),
            reason:
              "The bound Task context provider could not complete trusted post-change analysis.",
          },
        ],
      };
    }
  }
  if (!analysisIsConsistent(repositoryAnalysis, baseline, actual)) {
    repositoryAnalysis = {
      status: "unknown",
      hunks: [],
      deletedFiles: [],
      boundaries: [
        {
          code: "unsupported_source",
          actualChangeIds: actual.changes
            .map((change) => change.id)
            .sort(compareUnicodeCodeUnits),
          reason:
            "The trusted post-change analyzer returned an inconsistent coverage result.",
        },
      ],
    };
  }
  const occurredAt = nextTimestamp(data.manifest.updatedAt, clock);
  const revision = data.manifest.revision + 1;
  const analysis = makeFindings(
    data,
    baseline,
    actual,
    repositoryAnalysis,
    occurredAt,
  );
  const changeCheck = ChangeCheckV1Schema.parse({
    schemaVersion: 1,
    id: stableId("change-check", {
      taskId: data.manifest.taskId,
      revision,
      baselineSnapshotId: baseline.snapshotId,
      actualSnapshotId: actual.snapshotId,
    }),
    taskId: data.manifest.taskId,
    taskRevision: revision,
    baselineSnapshotId: baseline.snapshotId,
    actualSnapshotId: actual.snapshotId,
    findings: analysis.findings,
    generatedAt: occurredAt,
  });
  const manifest = TaskManifestV1Schema.parse({
    ...data.manifest,
    revision,
    updatedAt: occurredAt,
  });
  const event = buildTaskEvent({
    manifest,
    previousManifest: current.bundle.manifest,
    previousEvent: current.bundle.events.at(-1),
    action: {
      type: "change_checked",
      changeCheckArtifactId: `artifact:change_check:${data.manifest.taskId}`,
      changeCheckId: changeCheck.id,
    },
    actor: input.actor,
    idempotencyKey: input.idempotencyKey,
    requestDigest,
    occurredAt,
  });
  const mutation = mutationResult(
    manifest,
    event,
    artifactIds(current, data.manifest.taskId, "change_check"),
  );
  const receiptResult = { changeCheck, mutation };
  const result: ChangeCheckMutationOutcome = {
    ...receiptResult,
    changeCheckClassification: classifyChangeCheckV1(changeCheck),
  };
  const journal = appendRecord(
    current,
    manifest,
    event,
    receiptResult,
    "check_change",
    input.actor,
    input.idempotencyKey,
    requestDigest,
    occurredAt,
  );
  const claims = [
    ...appendFindingLinks(data.claims, analysis.baseFindingLinks),
    ...analysis.findingClaims,
  ];
  const evidence = [...data.evidence, ...analysis.findingEvidence];
  const artifacts = buildTaskArtifacts({
    manifest,
    brief: data.brief,
    claims,
    evidence,
    impactPaths: data.impactPaths,
    changeCheck,
    ...(data.verificationRecords.length > 0 ||
    current.artifacts.some((artifact) => artifact.artifactType === "verification")
      ? { verificationRecords: data.verificationRecords }
      : {}),
    idempotencyRecords: journal.records,
    receipts: journal.receipts,
    createdAt: occurredAt,
  });
  try {
    await store.persistTaskBundle(
      {
        artifacts,
        events: [...current.bundle.events, event],
        idempotencyRecords: journal.records,
      },
      {
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        requestDigest,
      },
    );
  } catch (error) {
    current = await store.readTaskBundle(input.taskId).catch(() => current);
    const raced = taskReplay(
      current,
      input.taskId,
      input.actor,
      input.idempotencyKey,
      requestDigest,
      "check_change",
    );
    if (raced !== undefined) return raced as ChangeCheckMutationOutcome;
    throw error;
  }
  return result;
}

export async function recordTaskVerification(
  store: ArtifactStore,
  inputValue: RecordVerificationInputV1,
  clock: () => Date,
): Promise<VerificationMutationOutcome> {
  const input = RecordVerificationInputV1Schema.parse(inputValue);
  const requestDigest = sha256CanonicalJson(input);
  let current = await store.readTaskBundle(input.taskId);
  const replay = taskReplay(
    current,
    input.taskId,
    input.actor,
    input.idempotencyKey,
    requestDigest,
    "record_verification",
  );
  if (replay !== undefined) return replay as VerificationMutationOutcome;
  if (current.bundle.manifest.revision !== input.expectedRevision) {
    throw new TaskEngineError(
      "revision_conflict",
      "Task revision does not match expectedRevision.",
      {
        taskId: input.taskId,
        expectedRevision: input.expectedRevision,
        currentRevision: current.bundle.manifest.revision,
      },
    );
  }
  const data = fullTaskData(current);
  requireMutableRead(current, data.manifest);
  if (data.manifest.status !== "verification_required") {
    gate(data.manifest, "verification_required", "verification_required");
  }
  const currentCheck = data.changeChecks.find(
    (check) => check.id === data.manifest.currentChangeCheckId,
  );
  if (
    currentCheck === undefined ||
    currentCheck.actualSnapshotId !== data.manifest.latestSnapshotId
  ) {
    gate(data.manifest, "verification_required", "current_check_required");
  }
  const planEntry = data.brief.verificationPlan.find(
    (entry) => entry.id === input.record.verificationPlanEntryId,
  );
  if (planEntry === undefined) {
    gate(data.manifest, "verification_required", "verification_required", input.record.verificationPlanEntryId);
  }
  if (planEntry.method !== input.record.kind) {
    gate(data.manifest, "verification_required", "verification_required", planEntry.id);
  }
  if (input.record.snapshotId !== data.manifest.latestSnapshotId) {
    gate(data.manifest, "verification_required", "snapshot_not_current", input.record.snapshotId);
  }
  const acceptanceIds = new Set(planEntry.acceptanceClaimIds);
  if (
    input.record.claimIds.length === 0 ||
    input.record.claimIds.some(
      (claimId) =>
        !acceptanceIds.has(claimId) ||
        !data.claims.some((claim) => claim.id === claimId),
    )
  ) {
    gate(data.manifest, "verification_required", "verification_required", planEntry.id);
  }
  const previousId = input.record.supersedesVerificationRecordId;
  const previous = previousId === undefined
    ? undefined
    : data.verificationRecords.find((record) => record.id === previousId);
  if (previousId !== undefined) {
    if (
      previous === undefined ||
      previous.verificationPlanEntryId !== planEntry.id ||
      previous.snapshotId !== data.manifest.latestSnapshotId ||
      data.verificationRecords.some(
        (record) =>
          record.verificationPlanEntryId === planEntry.id &&
          record.snapshotId === data.manifest.latestSnapshotId &&
          record.attempt > previous.attempt,
      )
    ) {
      gate(data.manifest, "verification_required", "verification_required", previousId);
    }
  } else if (
    data.verificationRecords.some(
      (record) =>
        record.verificationPlanEntryId === planEntry.id &&
        record.snapshotId === data.manifest.latestSnapshotId,
    )
  ) {
    gate(data.manifest, "verification_required", "verification_required", planEntry.id);
  }
  const attempt = previous === undefined ? 1 : previous.attempt + 1;
  const occurredAt = nextTimestamp(data.manifest.updatedAt, clock);
  const revision = data.manifest.revision + 1;
  const verification = VerificationRecordV1Schema.parse({
    ...input.record,
    id: stableId("verification", {
      taskId: data.manifest.taskId,
      verificationPlanEntryId: planEntry.id,
      snapshotId: data.manifest.latestSnapshotId,
      attempt,
      idempotencyKey: input.idempotencyKey,
    }),
    taskId: data.manifest.taskId,
    attempt,
    recordedAt: occurredAt,
    actor: input.actor,
  });
  const manifest = TaskManifestV1Schema.parse({
    ...data.manifest,
    revision,
    updatedAt: occurredAt,
  });
  const event = buildTaskEvent({
    manifest,
    previousManifest: current.bundle.manifest,
    previousEvent: current.bundle.events.at(-1),
    action: {
      type: "verification_recorded",
      verificationRecordId: verification.id,
    },
    actor: input.actor,
    idempotencyKey: input.idempotencyKey,
    requestDigest,
    occurredAt,
  });
  const mutation = mutationResult(
    manifest,
    event,
    artifactIds(current, data.manifest.taskId, "verification"),
  );
  const result: VerificationMutationOutcome = { verification, mutation };
  const journal = appendRecord(
    current,
    manifest,
    event,
    result,
    "record_verification",
    input.actor,
    input.idempotencyKey,
    requestDigest,
    occurredAt,
  );
  const claims = data.claims.map((claim) =>
    verification.claimIds.includes(claim.id)
      ? ClaimV1Schema.parse({
          ...claim,
          verificationRecordIds: [
            ...claim.verificationRecordIds,
            verification.id,
          ],
        })
      : claim,
  );
  const artifacts = buildTaskArtifacts({
    manifest,
    brief: data.brief,
    claims,
    evidence: data.evidence,
    impactPaths: data.impactPaths,
    changeCheck: currentCheck,
    verificationRecords: [...data.verificationRecords, verification],
    idempotencyRecords: journal.records,
    receipts: journal.receipts,
    createdAt: occurredAt,
  });
  try {
    await store.persistTaskBundle(
      {
        artifacts,
        events: [...current.bundle.events, event],
        idempotencyRecords: journal.records,
      },
      {
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        requestDigest,
      },
    );
  } catch (error) {
    current = await store.readTaskBundle(input.taskId).catch(() => current);
    const raced = taskReplay(
      current,
      input.taskId,
      input.actor,
      input.idempotencyKey,
      requestDigest,
      "record_verification",
    );
    if (raced !== undefined) return raced as VerificationMutationOutcome;
    throw error;
  }
  return result;
}
