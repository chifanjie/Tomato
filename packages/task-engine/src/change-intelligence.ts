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
  canonicalizeJson,
  type ChangeCheckV1,
  type ChangeFindingV1,
  type CheckChangeInputV1,
  type ClaimV1,
  type EvidenceV1,
  type IdempotencyRecordV1,
  type MutationResultV1,
  type RecordVerificationInputV1,
  type RepositoryChangeV1,
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
import { sha256CanonicalJson, stableId } from "./ids.js";

export interface ChangeCheckMutationOutcome {
  readonly changeCheck: ChangeCheckV1;
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

function changeShape(change: RepositoryChangeV1): string {
  return canonicalizeJson({
    path: change.path,
    ...(change.oldPath === undefined ? {} : { oldPath: change.oldPath }),
    source: change.source,
    kind: change.kind,
    ...(change.contentDigest === undefined
      ? {}
      : { contentDigest: change.contentDigest }),
    ...(change.previousContentDigest === undefined
      ? {}
      : { previousContentDigest: change.previousContentDigest }),
  });
}

interface SnapshotDelta {
  readonly path: string;
  readonly actual: readonly RepositoryChangeV1[];
  readonly baseline: readonly RepositoryChangeV1[];
}

function snapshotDelta(
  baseline: RepositorySnapshotV1,
  actual: RepositorySnapshotV1,
): SnapshotDelta[] {
  const baselineByPath = new Map<string, RepositoryChangeV1[]>();
  const actualByPath = new Map<string, RepositoryChangeV1[]>();
  for (const change of baseline.changes) {
    const list = baselineByPath.get(change.path) ?? [];
    list.push(change);
    baselineByPath.set(change.path, list);
  }
  for (const change of actual.changes) {
    const list = actualByPath.get(change.path) ?? [];
    list.push(change);
    actualByPath.set(change.path, list);
  }
  const paths = new Set([...baselineByPath.keys(), ...actualByPath.keys()]);
  return [...paths]
    .sort((left, right) => left.localeCompare(right, "en"))
    .flatMap((path) => {
      const before = [...(baselineByPath.get(path) ?? [])].sort((a, b) =>
        changeShape(a).localeCompare(changeShape(b), "en"),
      );
      const after = [...(actualByPath.get(path) ?? [])].sort((a, b) =>
        changeShape(a).localeCompare(changeShape(b), "en"),
      );
      if (canonicalizeJson(after.map(changeShape)) === canonicalizeJson(before.map(changeShape))) {
        return [];
      }
      return [{ path, actual: after, baseline: before }];
    });
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
  actualSnapshot: RepositorySnapshotV1,
  findingId: string,
  occurredAt: string,
  unknown: boolean,
): EvidenceV1 {
  const id = stableId("evidence:change-check", {
    taskId,
    actualSnapshotId: actualSnapshot.snapshotId,
    findingId,
  });
  if (unknown || actualSnapshot.headCommit === undefined) {
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
      boundaryReason:
        actualSnapshot.limitations[0] ??
        "Repository Snapshot capture was incomplete for Change Intelligence.",
      relationPath: [],
    });
  }
  return EvidenceV1Schema.parse({
    id,
    kind: "git",
    epistemicStatus: "observed",
    freshness: "current",
    claimIds: [],
    nodeIds: [],
    producedBy: "task-engine",
    createdAt: occurredAt,
    observedAtSnapshotId: actualSnapshot.snapshotId,
    commit: actualSnapshot.headCommit,
  });
}

function makeFindings(
  data: FullTaskData,
  baseline: RepositorySnapshotV1,
  actual: RepositorySnapshotV1,
  occurredAt: string,
  requestedVerificationIds: readonly string[] | undefined,
): {
  findings: ChangeFindingV1[];
  findingClaims: ClaimV1[];
  findingEvidence: EvidenceV1[];
  baseFindingLinks: ReadonlyMap<string, readonly string[]>;
} {
  const deltas = snapshotDelta(baseline, actual);
  const plannedByPath = new Map<string, typeof data.brief.plannedChanges>();
  for (const planned of data.brief.plannedChanges) {
    const list = plannedByPath.get(planned.filePath) ?? [];
    list.push(planned);
    plannedByPath.set(planned.filePath, list);
  }
  const matched = new Set<string>();
  const draftFindings: Array<{
    type: ChangeFindingV1["type"];
    severity: ChangeFindingV1["severity"];
    blocking: boolean;
    summary: string;
    plannedChangeIds: string[];
    actualChangeIds: string[];
    baseClaimIds: string[];
    unknown?: boolean;
  }> = [];
  for (const delta of deltas) {
    const planned = plannedByPath.get(delta.path) ?? [];
    if (planned.length === 0) {
      draftFindings.push({
        type: "unplanned_change",
        severity: "warning",
        blocking: true,
        summary: `Repository change at ${delta.path} was not present in the persisted Task plan.`,
        plannedChangeIds: [],
        actualChangeIds: (delta.actual.length > 0 ? delta.actual : delta.baseline).map((change) => change.id),
        baseClaimIds: [claimForPlannedChange(data, [])],
      });
      continue;
    }
    for (const change of planned) matched.add(change.id);
    const plannedIds = planned.map((change) => change.id);
    const baseClaimIds = [...new Set(planned.flatMap((change) => change.claimIds))].filter((id) =>
      data.claims.some((claim) => claim.id === id),
    );
    draftFindings.push({
      type: planned.length === 1 ? "planned_completed" : "planned_partial",
      severity: "info",
      blocking: false,
      summary:
        planned.length === 1
          ? `Planned change at ${delta.path} is present in the actual Snapshot.`
          : `Actual change at ${delta.path} covers only part of the planned change set.`,
      plannedChangeIds: plannedIds,
      actualChangeIds: (delta.actual.length > 0 ? delta.actual : delta.baseline).map((change) => change.id),
      baseClaimIds: baseClaimIds.length > 0 ? baseClaimIds : [claimForPlannedChange(data, plannedIds)],
    });
  }
  for (const planned of data.brief.plannedChanges) {
    if (matched.has(planned.id)) continue;
    const evidenceRequired = planned.impactPathIds.length > 0 || planned.claimIds.length > 0;
    draftFindings.push({
      type: "possible_omission",
      severity: "warning",
      blocking: true,
      summary: `Planned change ${planned.filePath} was not observed in the actual Snapshot.`,
      plannedChangeIds: [planned.id],
      actualChangeIds: [],
      baseClaimIds: [claimForPlannedChange(data, [planned.id])],
      unknown: !evidenceRequired,
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
      unknown: true,
    });
  }
  for (const verificationId of requestedVerificationIds ?? []) {
    const record = data.verificationRecords.find((candidate) => candidate.id === verificationId);
    if (record === undefined) {
      draftFindings.push({
        type: "verification_gap",
        severity: "warning",
        blocking: true,
        summary: `Verification record ${verificationId} was not found in the persisted Task history.`,
        plannedChangeIds: [],
        actualChangeIds: [],
        baseClaimIds: [claimForPlannedChange(data, [])],
        unknown: true,
      });
    }
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
    });
    const evidence = buildFindingEvidence(
      data.manifest.taskId,
      actual,
      findingId,
      occurredAt,
      draft.unknown === true || actual.captureStatus !== "complete",
    );
    const claimId = stableId("claim:finding", {
      taskId: data.manifest.taskId,
      revision: data.manifest.revision + 1,
      findingId,
    });
    const epistemicStatus = evidence.epistemicStatus === "observed" ? "observed" : "unknown";
    const findingClaim = ClaimV1Schema.parse({
      id: claimId,
      taskId: data.manifest.taskId,
      kind: "finding",
      statement: draft.summary,
      epistemicStatus,
      lifecycleStatus: evidence.epistemicStatus === "observed" ? "supported" : "draft",
      freshness: "current",
      sourceSnapshotId: actual.snapshotId,
      evidenceIds: [evidence.id],
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
      evidenceIds: [evidence.id],
      impactPathIds: [],
    });
    findings.push(finding);
    findingClaims.push(findingClaim);
    findingEvidenceItems.push(
      EvidenceV1Schema.parse({ ...evidence, claimIds: [claimId] }),
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
  const actualSnapshotId = input.actualSnapshotId ?? data.manifest.latestSnapshotId;
  if (actualSnapshotId !== data.manifest.latestSnapshotId) {
    gate(data.manifest, "check_required", "snapshot_not_current", actualSnapshotId);
  }
  const [baseline, actual] = await Promise.all([
    snapshotFor(store, data.manifest.baselineSnapshotId),
    snapshotFor(store, actualSnapshotId),
  ]);
  const occurredAt = nextTimestamp(data.manifest.updatedAt, clock);
  const revision = data.manifest.revision + 1;
  const analysis = makeFindings(
    data,
    baseline,
    actual,
    occurredAt,
    input.verificationRecordIds,
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
  const result: ChangeCheckMutationOutcome = { changeCheck, mutation };
  const journal = appendRecord(
    current,
    manifest,
    event,
    result,
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
