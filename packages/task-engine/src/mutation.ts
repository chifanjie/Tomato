import {
  type ArtifactStore,
  type ReadTaskBundleResult,
} from "@understand-code/artifact-store";
import {
  ClaimV1Schema,
  EvidenceV1Schema,
  IdempotencyRecordV1Schema,
  TaskManifestV1Schema,
  TaskNormalStatusV1Schema,
  TaskOperationReceiptV1Schema,
  classifyChangeCheckV1,
  isTaskOrdinaryTransitionV1,
  taskVerificationRequirementGuardsV1,
  type ChangeCheckV1,
  type ClaimV1,
  type EvidenceBackedChangeCheckV1,
  type EvidenceV1,
  type ImpactPathV1,
  type TaskArtifactBundleV1,
  type TaskBriefV1,
  type TaskManifestV1,
  type TaskOperationReceiptV1,
  type TaskTransitionTargetV1,
  type UpdateTaskInputV1,
  type PersistedClaimV1,
  type PersistedEvidenceV1,
  type StrongVerificationRecordV1,
  type StrongImpactConclusionV1,
  type VerificationRecordV1,
} from "@understand-code/contracts";

import {
  buildTaskArtifacts,
  buildTaskEvent,
  mutationResult,
} from "./artifacts.js";
import type { TaskMutationOutcome } from "./engine-types.js";
import { TaskEngineError } from "./errors.js";
import {
  sha256CanonicalJson,
  stableId,
} from "./ids.js";

interface MutableTaskData {
  manifest: TaskManifestV1;
  brief?: Extract<TaskArtifactBundleV1, { brief: unknown }>["brief"];
  claims: PersistedClaimV1[];
  evidence: PersistedEvidenceV1[];
  impactPaths: Extract<TaskArtifactBundleV1, { impactPaths: unknown }>["impactPaths"];
  impactConclusion?: StrongImpactConclusionV1;
  changeChecks: Array<ChangeCheckV1 | EvidenceBackedChangeCheckV1>;
  verificationRecords: Array<VerificationRecordV1 | StrongVerificationRecordV1>;
}

export interface RebuiltTaskContextV1 {
  snapshotId: TaskManifestV1["latestSnapshotId"];
  brief: TaskBriefV1;
  claims: readonly ClaimV1[];
  evidence: readonly EvidenceV1[];
  impactPaths: readonly ImpactPathV1[];
}

type RebuildContextLoader = (
  current: ReadTaskBundleResult,
  occurredAt: string,
) => Promise<RebuiltTaskContextV1>;

function fullBundle(
  read: ReadTaskBundleResult,
): Extract<TaskArtifactBundleV1, { brief: unknown }> | undefined {
  return "brief" in read.bundle ? read.bundle : undefined;
}

function dataFromRead(read: ReadTaskBundleResult): MutableTaskData {
  const full = fullBundle(read);
  return {
    manifest: structuredClone(read.bundle.manifest),
    ...(full === undefined ? {} : { brief: structuredClone(full.brief) }),
    claims: full === undefined ? [] : structuredClone(full.claims),
    evidence: full === undefined ? [] : structuredClone(full.evidence),
    impactPaths:
      full === undefined ? [] : structuredClone(full.impactPaths),
    ...(full !== undefined && "impactConclusion" in full
      ? { impactConclusion: structuredClone(full.impactConclusion) }
      : {}),
    changeChecks:
      full === undefined ? [] : structuredClone(full.changeChecks),
    verificationRecords:
      full === undefined
        ? []
        : structuredClone(full.verificationRecords),
  };
}

function clearSnapshotBoundProjections(data: MutableTaskData): void {
  const removedFindingIds = new Set(
    data.changeChecks.flatMap((check) =>
      check.findings.map((finding) => finding.id),
    ),
  );
  const removedVerificationIds = new Set(
    data.verificationRecords.map((record) => record.id),
  );
  data.claims = data.claims
    .filter((claim) => "verificationRecordIds" in claim)
    .map((claim) => ClaimV1Schema.parse({
      ...claim,
      findingIds: claim.findingIds.filter(
        (findingId) => !removedFindingIds.has(findingId),
      ),
      verificationRecordIds: claim.verificationRecordIds.filter(
        (recordId) => !removedVerificationIds.has(recordId),
      ),
    }));
  data.changeChecks = [];
  data.verificationRecords = [];
}

function alignToSnapshot(
  data: MutableTaskData,
  snapshotId: TaskManifestV1["latestSnapshotId"],
): void {
  if (data.manifest.latestSnapshotId === snapshotId) return;
  data.manifest = {
    ...data.manifest,
    latestSnapshotId: snapshotId,
  };
  clearSnapshotBoundProjections(data);
}

function staleTaskContext(
  data: MutableTaskData,
  read: ReadTaskBundleResult,
  occurredAt: string,
): {
  type: "task_context_staled";
  reasonCodes: string[];
  detectedAtSnapshotId: string;
} | undefined {
  const normalStatus = TaskNormalStatusV1Schema.safeParse(
    data.manifest.status,
  );
  const staleFromStatus =
    data.manifest.status === "blocked"
      ? "blocked"
      : normalStatus.success
        ? normalStatus.data
        : undefined;
  if (staleFromStatus === undefined) return undefined;
  const latestSnapshotId =
    read.latestSnapshotId ?? data.manifest.latestSnapshotId;
  const snapshotAdvanced =
    latestSnapshotId !== data.manifest.latestSnapshotId;
  const freshnessInvalid =
    read.freshness !== "fresh" && read.freshness !== "partial";
  if (!snapshotAdvanced && !freshnessInvalid) return undefined;

  const reasonCodes = [
    ...(snapshotAdvanced ? ["repository_snapshot_advanced"] : []),
    ...(freshnessInvalid
      ? [`task_bundle_freshness_${read.freshness}`]
      : []),
  ];
  if (snapshotAdvanced) {
    alignToSnapshot(data, latestSnapshotId);
  } else {
    clearSnapshotBoundProjections(data);
  }
  const {
    blockedState: _blockedState,
    currentChangeCheckId: _currentChangeCheckId,
    currentChangeCheckRevision: _currentChangeCheckRevision,
    ...withoutBlockedState
  } = data.manifest;
  data.manifest = {
    ...withoutBlockedState,
    status: "stale",
    staleState: {
      staleFromStatus,
      reasonCodes,
      detectedAtSnapshotId: latestSnapshotId,
      detectedAt: occurredAt,
    },
  };
  return {
    type: "task_context_staled",
    reasonCodes,
    detectedAtSnapshotId: latestSnapshotId,
  };
}

function isExpectedActualSnapshotCapture(
  data: MutableTaskData,
  read: ReadTaskBundleResult,
  input: UpdateTaskInputV1,
): boolean {
  return (
    input.action.type === "transition_status" &&
    input.action.to === "check_required" &&
    (data.manifest.status === "in_progress" ||
      data.manifest.status === "verification_required") &&
    read.state === "current" &&
    read.recoveryState === "current" &&
    (read.freshness === "stale" || read.freshness === "partial") &&
    read.latestSnapshotId !== undefined &&
    read.latestSnapshotId !== data.manifest.latestSnapshotId
  );
}

function requireMutableTaskRead(
  data: MutableTaskData,
  read: ReadTaskBundleResult,
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
    gateUnsatisfied(
      data.manifest,
      data.manifest.status,
      failedGuards,
    );
  }
}

function transitionRejected(
  task: TaskManifestV1,
  action: string,
  guard: "transition_not_allowed" | "terminal_state",
): never {
  throw new TaskEngineError(
    "task_transition_rejected",
    `Task action ${action} is not allowed from ${task.status}.`,
    {
      taskId: task.taskId,
      currentStatus: task.status,
      requestedAction: action,
      guard,
    },
  );
}

function gateUnsatisfied(
  task: TaskManifestV1,
  targetStatus: string,
  failedGuards: ReadonlyArray<{
    code: string;
    resourceId?: string;
  }>,
): never {
  throw new TaskEngineError(
    "task_gate_unsatisfied",
    `Task cannot enter ${targetStatus} until its factual guards are satisfied.`,
    { taskId: task.taskId, targetStatus, failedGuards },
  );
}

function requireClaim(
  data: MutableTaskData,
  claimId: string,
  kind: ClaimV1["kind"],
): ClaimV1 {
  const target = data.claims.find((claim) => claim.id === claimId);
  if (target === undefined || target.kind !== kind || !("verificationRecordIds" in target)) {
    gateUnsatisfied(data.manifest, data.manifest.status, [
      { code: `${kind}_claim_required`, resourceId: claimId },
    ]);
  }
  return ClaimV1Schema.parse(target);
}

function humanConfirmClaims(
  data: MutableTaskData,
  claimIds: readonly string[],
  eventId: string,
  actor: string,
  occurredAt: string,
): void {
  const selected = new Set(claimIds);
  data.claims = data.claims.map((candidate) => {
    if (!selected.has(candidate.id)) return candidate;
    if (!("verificationRecordIds" in candidate)) {
      gateUnsatisfied(data.manifest, data.manifest.status, [
        { code: "context_claim_required", resourceId: candidate.id },
      ]);
    }
    const evidenceId = stableId("evidence:human", {
      taskId: data.manifest.taskId,
      eventId,
      claimId: candidate.id,
    });
    const humanEvidence = EvidenceV1Schema.parse({
      id: evidenceId,
      kind: "human",
      epistemicStatus: "human_confirmed",
      freshness: "current",
      claimIds: [candidate.id],
      nodeIds: [],
      producedBy: "task-engine",
      createdAt: occurredAt,
      observedAtSnapshotId: data.manifest.latestSnapshotId,
      confirmation: {
        actor,
        input: candidate.statement,
        confirmedAt: occurredAt,
      },
    });
    data.evidence = [
      ...data.evidence.filter((item) => item.id !== evidenceId),
      humanEvidence,
    ];
    const {
      boundaryReason: _boundaryReason,
      derivationPath: _derivationPath,
      ...base
    } = candidate;
    return ClaimV1Schema.parse({
      ...base,
      epistemicStatus: "human_confirmed",
      lifecycleStatus: "supported",
      freshness: "current",
      evidenceIds: [...new Set([...candidate.evidenceIds, evidenceId])],
      confirmationEventId: eventId,
      ...(candidate.kind === "unknown" &&
      candidate.boundaryReason !== undefined
        ? { boundaryReason: candidate.boundaryReason }
        : {}),
      updatedAt: occurredAt,
    });
  });
}

function latestCheck(data: MutableTaskData): ChangeCheckV1 | EvidenceBackedChangeCheckV1 | undefined {
  return [...data.changeChecks].sort(
    (left, right) => right.taskRevision - left.taskRevision,
  )[0];
}

function isLegacyEmptyChangeCheck(
  check: ChangeCheckV1 | EvidenceBackedChangeCheckV1 | undefined,
): boolean {
  return (
    check !== undefined &&
    !("profile" in check) &&
    classifyChangeCheckV1(check).profile === "legacy_summary" &&
    check.findings.length === 0
  );
}

function latestVerification(
  records: readonly (VerificationRecordV1 | StrongVerificationRecordV1)[],
  planEntryId: string,
  snapshotId: string,
): VerificationRecordV1 | StrongVerificationRecordV1 | undefined {
  return records
    .filter(
      (record) =>
        record.verificationPlanEntryId === planEntryId &&
        record.snapshotId === snapshotId,
    )
    .sort((left, right) => right.attempt - left.attempt)[0];
}

function applyTransition(
  data: MutableTaskData,
  to: TaskTransitionTargetV1,
  read: ReadTaskBundleResult,
  verificationRecordId?: string,
): void {
  const from = data.manifest.status;
  if (
    verificationRecordId !== undefined &&
    !(from === "verification_required" && to === "in_progress")
  ) {
    transitionRejected(
      data.manifest,
      `transition_status:${to}`,
      "transition_not_allowed",
    );
  }
  if (
    ![
      "context_ready",
      "planned",
      "in_progress",
      "check_required",
      "verification_required",
      "verified",
    ].includes(to) ||
    !isTaskOrdinaryTransitionV1(
      from,
      to as Parameters<typeof isTaskOrdinaryTransitionV1>[1],
    )
  ) {
    transitionRejected(
      data.manifest,
      `transition_status:${to}`,
      from === "verified" || from === "superseded"
        ? "terminal_state"
        : "transition_not_allowed",
    );
  }
  if (from === "created" && to === "context_ready") {
    gateUnsatisfied(data.manifest, to, [
      { code: "context_not_ready", resourceId: "build_task_brief" },
    ]);
  }
  if (from === "context_ready" && to === "planned") {
    if (data.brief === undefined) {
      gateUnsatisfied(data.manifest, to, [{ code: "context_not_ready" }]);
    }
    const goal = data.claims.find(
      (claim) => claim.id === data.brief!.goalClaimId,
    );
    const acceptances = data.brief.acceptanceClaimIds.map((claimId) =>
      data.claims.find((claim) => claim.id === claimId),
    );
    const confirmedPlanIds = new Set(
      read.bundle.events
        .filter((event) => event.action.type === "confirm_plan")
        .flatMap((event) =>
          event.action.type === "confirm_plan"
            ? event.action.plannedChangeIds
            : [],
        ),
    );
    const guards: Array<{ code: string; resourceId?: string }> = [];
    if (goal?.epistemicStatus !== "human_confirmed") {
      guards.push({
        code: "goal_not_confirmed",
        resourceId: data.brief.goalClaimId,
      });
    }
    for (const acceptance of acceptances) {
      if (acceptance?.epistemicStatus !== "human_confirmed") {
        guards.push({
          code: "acceptance_not_confirmed",
          ...(acceptance === undefined ? {} : { resourceId: acceptance.id }),
        });
      }
    }
    for (const change of data.brief.plannedChanges) {
      if (!confirmedPlanIds.has(change.id)) {
        guards.push({ code: "plan_not_confirmed", resourceId: change.id });
      }
    }
    if (guards.length > 0) gateUnsatisfied(data.manifest, to, guards);
  }
  if (from === "planned" && to === "in_progress") {
    if (
      (read.freshness !== "fresh" && read.freshness !== "partial") ||
      (read.latestSnapshotId !== undefined &&
        data.manifest.latestSnapshotId !== read.latestSnapshotId)
    ) {
      gateUnsatisfied(data.manifest, to, [
        { code: "worktree_binding_invalid" },
      ]);
    }
  }
  if (from === "in_progress" && to === "check_required") {
    if (read.latestSnapshotId === undefined) {
      gateUnsatisfied(data.manifest, to, [
        { code: "actual_snapshot_required" },
      ]);
    }
    if (read.latestSnapshotId !== data.manifest.latestSnapshotId) {
      alignToSnapshot(data, read.latestSnapshotId);
    } else if (
      read.freshness !== "fresh" &&
      read.freshness !== "partial"
    ) {
      gateUnsatisfied(data.manifest, to, [
        { code: "snapshot_not_current" },
      ]);
    }
  }
  if (from === "check_required" && to === "in_progress") {
    const check = latestCheck(data);
    if (
      check === undefined ||
      !check.findings.some((finding) =>
        [
          "planned_partial",
          "unplanned_change",
          "possible_omission",
          "verification_gap",
          "cannot_determine",
        ].includes(finding.type),
      )
    ) {
      gateUnsatisfied(data.manifest, to, [
        { code: "current_check_required" },
      ]);
    }
  }
  if (from === "check_required" && to === "verification_required") {
    const check = latestCheck(data);
    const legacyEmptyCheck = isLegacyEmptyChangeCheck(check);
    const unresolved = check?.findings.find(
      (finding) => finding.blocking && finding.resolution === undefined,
    );
    if (
      check === undefined ||
      check.actualSnapshotId !== data.manifest.latestSnapshotId ||
      legacyEmptyCheck ||
      unresolved !== undefined
    ) {
      gateUnsatisfied(data.manifest, to, [
        ...(check === undefined ||
        check.actualSnapshotId !== data.manifest.latestSnapshotId ||
        legacyEmptyCheck
          ? [{ code: "current_check_required" }]
          : []),
        ...(unresolved === undefined
          ? []
          : [{ code: "blocking_finding", resourceId: unresolved.id }]),
      ]);
    }
    data.manifest = {
      ...data.manifest,
      currentChangeCheckId: check.id,
      currentChangeCheckRevision: check.taskRevision,
    };
  }
  if (
    from === "verification_required" &&
    (to === "in_progress" || to === "check_required")
  ) {
    if (to === "in_progress") {
      const record = data.verificationRecords.find(
        (candidate) => candidate.id === verificationRecordId,
      );
      const planEntry = data.brief?.verificationPlan.find(
        (candidate) => candidate.id === record?.verificationPlanEntryId,
      );
      const latest =
        record === undefined
          ? undefined
          : latestVerification(
              data.verificationRecords,
              record.verificationPlanEntryId,
              data.manifest.latestSnapshotId,
            );
      if (
        verificationRecordId === undefined ||
        record === undefined ||
        planEntry === undefined ||
        record.snapshotId !== data.manifest.latestSnapshotId ||
        latest?.id !== record.id ||
        !["failed", "blocked", "flaky"].includes(record.status)
      ) {
        gateUnsatisfied(data.manifest, to, [
          {
            code: "verification_required",
            ...(verificationRecordId === undefined
              ? {}
              : { resourceId: verificationRecordId }),
          },
        ]);
      }
    } else if (
      read.latestSnapshotId === undefined ||
      read.latestSnapshotId === data.manifest.latestSnapshotId
    ) {
      gateUnsatisfied(data.manifest, to, [
        { code: "snapshot_not_current" },
      ]);
    } else {
      alignToSnapshot(data, read.latestSnapshotId);
    }
    const {
      currentChangeCheckId: _currentChangeCheckId,
      currentChangeCheckRevision: _currentChangeCheckRevision,
      ...withoutCheck
    } = data.manifest;
    data.manifest = withoutCheck;
  }
  if (from === "verification_required" && to === "verified") {
    if (data.brief === undefined) {
      gateUnsatisfied(data.manifest, to, [{ code: "context_not_ready" }]);
    }
    const check = latestCheck(data);
    const guards: Array<{ code: string; resourceId?: string }> = [];
    if (
      check === undefined ||
      data.manifest.currentChangeCheckId !== check.id ||
      check.actualSnapshotId !== data.manifest.latestSnapshotId ||
      isLegacyEmptyChangeCheck(check)
    ) {
      guards.push({ code: "current_check_required" });
    }
    guards.push(...taskVerificationRequirementGuardsV1(
      data.brief.verificationPlan, data.verificationRecords, data.manifest.latestSnapshotId,
    ));
    if (guards.length > 0) gateUnsatisfied(data.manifest, to, guards);
  }
  data.manifest = { ...data.manifest, status: to as TaskManifestV1["status"] };
}

function applyAction(
  data: MutableTaskData,
  read: ReadTaskBundleResult,
  input: UpdateTaskInputV1,
  eventId: string,
  occurredAt: string,
): void {
  const action = input.action;
  if (
    data.manifest.status === "verified" ||
    data.manifest.status === "superseded"
  ) {
    transitionRejected(
      data.manifest,
      action.type,
      "terminal_state",
    );
  }
  if (
    data.manifest.status === "blocked" &&
    action.type !== "resume_task" &&
    action.type !== "supersede_task"
  ) {
    transitionRejected(
      data.manifest,
      action.type,
      "transition_not_allowed",
    );
  }
  if (
    data.manifest.status === "stale" &&
    action.type !== "refresh_task_context" &&
    action.type !== "rebase_task" &&
    action.type !== "supersede_task"
  ) {
    transitionRejected(
      data.manifest,
      action.type,
      "transition_not_allowed",
    );
  }
  switch (action.type) {
    case "confirm_goal":
      requireClaim(data, action.claimId, "goal");
      humanConfirmClaims(
        data,
        [action.claimId],
        eventId,
        input.actor,
        occurredAt,
      );
      return;
    case "confirm_acceptance_criteria":
      for (const claimId of action.claimIds) {
        requireClaim(data, claimId, "acceptance");
      }
      humanConfirmClaims(
        data,
        action.claimIds,
        eventId,
        input.actor,
        occurredAt,
      );
      return;
    case "confirm_plan": {
      if (data.brief === undefined) {
        gateUnsatisfied(data.manifest, data.manifest.status, [
          { code: "context_not_ready" },
        ]);
      }
      const planned = new Map(
        data.brief.plannedChanges.map((change) => [change.id, change]),
      );
      const changes = action.plannedChangeIds.map((id) => planned.get(id));
      if (changes.some((change) => change === undefined)) {
        gateUnsatisfied(data.manifest, data.manifest.status, [
          { code: "plan_not_confirmed" },
        ]);
      }
      return;
    }
    case "record_assumption":
      requireClaim(data, action.claimId, "assumption");
      humanConfirmClaims(
        data,
        [action.claimId],
        eventId,
        input.actor,
        occurredAt,
      );
      return;
    case "confirm_unknown":
      requireClaim(data, action.claimId, "unknown");
      humanConfirmClaims(
        data,
        [action.claimId],
        eventId,
        input.actor,
        occurredAt,
      );
      return;
    case "transition_status":
      applyTransition(
        data,
        action.to,
        read,
        action.verificationRecordId,
      );
      return;
    case "accept_finding": {
      const check = latestCheck(data);
      const finding = check?.findings.find(
        (candidate) => candidate.id === action.findingId,
      );
      if (
        check === undefined ||
        finding === undefined ||
        finding.resolution !== undefined ||
        check.actualSnapshotId !== data.manifest.latestSnapshotId
      ) {
        gateUnsatisfied(data.manifest, data.manifest.status, [
          { code: "current_check_required", resourceId: action.findingId },
        ]);
      }
      finding.resolution = {
        kind: "accepted",
        actor: input.actor,
        reason: action.reason,
        at: occurredAt,
        eventId,
      };
      return;
    }
    case "block_task": {
      if (!TaskNormalStatusV1Schema.safeParse(data.manifest.status).success) {
        transitionRejected(
          data.manifest,
          action.type,
          "transition_not_allowed",
        );
      }
      const resumeStatus = data.manifest.status as NonNullable<
        TaskManifestV1["blockedState"]
      >["resumeStatus"];
      const {
        currentChangeCheckId: _currentChangeCheckId,
        currentChangeCheckRevision: _currentChangeCheckRevision,
        ...withoutCheck
      } = data.manifest;
      data.manifest = {
        ...withoutCheck,
        status: "blocked",
        blockedState: {
          resumeStatus,
          reasonCode: action.reasonCode,
          message: action.message,
          actor: input.actor,
          blockedAt: occurredAt,
        },
      };
      return;
    }
    case "resume_task": {
      if (
        data.manifest.status !== "blocked" ||
        data.manifest.blockedState === undefined
      ) {
        transitionRejected(
          data.manifest,
          action.type,
          "transition_not_allowed",
        );
      }
      if (read.freshness !== "fresh" && read.freshness !== "partial") {
        gateUnsatisfied(
          data.manifest,
          data.manifest.blockedState.resumeStatus,
          [{ code: "freshness_invalid" }],
        );
      }
      const resumeStatus = data.manifest.blockedState.resumeStatus;
      const { blockedState: _blockedState, ...unblocked } = data.manifest;
      data.manifest = { ...unblocked, status: resumeStatus };
      if (
        resumeStatus === "verification_required" &&
        latestCheck(data) !== undefined
      ) {
        const check = latestCheck(data)!;
        data.manifest = {
          ...data.manifest,
          currentChangeCheckId: check.id,
          currentChangeCheckRevision: check.taskRevision,
        };
      }
      return;
    }
    case "refresh_task_context":
    case "rebase_task":
      if (data.manifest.status !== "stale") {
        transitionRejected(
          data.manifest,
          action.type,
          "transition_not_allowed",
        );
      }
      gateUnsatisfied(data.manifest, "context_ready", [
        { code: "context_not_ready", resourceId: action.type },
      ]);
    case "supersede_task": {
      const supersededFromStatus = data.manifest.status;
      const {
        blockedState: _blockedState,
        staleState: _staleState,
        currentChangeCheckId: _currentChangeCheckId,
        currentChangeCheckRevision: _currentChangeCheckRevision,
        ...active
      } = data.manifest;
      data.manifest = {
        ...active,
        status: "superseded",
        supersession: {
          supersededFromStatus:
            supersededFromStatus as NonNullable<
              TaskManifestV1["supersession"]
            >["supersededFromStatus"],
          reason: action.reason,
          ...(action.replacementTaskId === undefined
            ? {}
            : { replacementTaskId: action.replacementTaskId }),
          actor: input.actor,
          supersededAt: occurredAt,
        },
      };
      return;
    }
    case "accept_verification_skip": {
      const record = data.verificationRecords.find(
        (candidate) => candidate.id === action.verificationRecordId,
      );
      if (
        record === undefined ||
        record.status !== "skipped" ||
        "profile" in record ||
        record.skipAcceptance !== undefined ||
        record.snapshotId !== data.manifest.latestSnapshotId
      ) {
        gateUnsatisfied(data.manifest, data.manifest.status, [
          {
            code: "verification_required",
            resourceId: action.verificationRecordId,
          },
        ]);
      }
      record.skipAcceptance = {
        actor: input.actor,
        reason: action.reason,
        acceptedAt: occurredAt,
        eventId,
      };
      return;
    }
  }
}

function replayOutcome(receipt: TaskOperationReceiptV1): TaskMutationOutcome {
  if (
    receipt.operation !== "update_task" &&
    receipt.operation !== "task_created"
  ) {
    throw new TaskEngineError(
      "idempotency_conflict",
      "The idempotency key belongs to another Task operation.",
      { operation: receipt.operation, eventId: receipt.eventId },
    );
  }
  return {
    task: receipt.result.task,
    mutation: {
      ...receipt.result.mutation,
      idempotentReplay: true,
    },
  };
}

function existingReceipt(
  read: ReadTaskBundleResult,
  input: UpdateTaskInputV1,
  requestDigest: string,
): TaskMutationOutcome | undefined {
  const record = read.bundle.idempotencyRecords.find(
    (candidate) =>
      candidate.scope.kind === "task" &&
      candidate.scope.taskId === input.taskId &&
      candidate.idempotencyKey === input.idempotencyKey,
  );
  if (record === undefined) return undefined;
  if (
    record.actor !== input.actor ||
    record.requestDigest !== requestDigest
  ) {
    throw new TaskEngineError(
      "idempotency_conflict",
      "The Task idempotency key was already used by another payload or actor.",
      {
        idempotencyKey: input.idempotencyKey,
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
      { taskId: input.taskId, eventId: record.eventId },
    );
  }
  return replayOutcome(receipt);
}

export function validateTaskVerifiedTransitionInternalV1(current: ReadTaskBundleResult): void {
  const data = dataFromRead(current);
  requireMutableTaskRead(data, current);
  applyTransition(data, "verified", current);
}

export async function applyTaskUpdate(
  store: ArtifactStore,
  input: UpdateTaskInputV1,
  clock: () => Date,
): Promise<TaskMutationOutcome> {
  const requestDigest = sha256CanonicalJson(input);
  const current = await store.readTaskBundle(input.taskId);
  const replay = existingReceipt(current, input, requestDigest);
  if (replay !== undefined) return replay;
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

  const data = dataFromRead(current);
  requireMutableTaskRead(data, current);
  if (
    input.action.type === "supersede_task" &&
    current.latestSnapshotId !== undefined
  ) {
    alignToSnapshot(data, current.latestSnapshotId);
  }
  const revision = data.manifest.revision + 1;
  const minimumOccurredAt = Date.parse(data.manifest.updatedAt) + 1;
  const clockTime = clock().getTime();
  const occurredAt = new Date(
    Math.max(
      minimumOccurredAt,
      Number.isFinite(clockTime) ? clockTime : minimumOccurredAt,
    ),
  ).toISOString();
  const eventId = `event:${input.taskId}:${revision}`;
  const staledAction =
    input.action.type === "supersede_task" ||
      isExpectedActualSnapshotCapture(data, current, input)
      ? undefined
      : staleTaskContext(data, current, occurredAt);
  if (staledAction === undefined) {
    applyAction(data, current, input, eventId, occurredAt);
  }
  data.manifest = TaskManifestV1Schema.parse({
    ...data.manifest,
    updatedAt: occurredAt,
    revision,
  });
  const event = buildTaskEvent({
    manifest: data.manifest,
    previousManifest: current.bundle.manifest,
    previousEvent: current.bundle.events.at(-1),
    action: staledAction ?? input.action,
    actor: input.actor,
    idempotencyKey: input.idempotencyKey,
    requestDigest,
    occurredAt,
  });
  const currentArtifactIds = current.artifacts.map(
    (artifact) => artifact.artifactId,
  );
  const mutation = mutationResult(
    data.manifest,
    event,
    currentArtifactIds,
  );
  const result = { task: data.manifest, mutation };
  const resultDigest = sha256CanonicalJson(result);
  const record = IdempotencyRecordV1Schema.parse({
    schemaVersion: 1,
    worktreeId: store.worktreeId,
    scope: { kind: "task", taskId: input.taskId },
    idempotencyKey: input.idempotencyKey,
    actor: input.actor,
    requestDigest,
    taskId: input.taskId,
    resultRevision: revision,
    eventId: event.eventId,
    resultDigest,
    createdAt: occurredAt,
  });
  const receipt = TaskOperationReceiptV1Schema.parse({
    schemaVersion: 1,
    operation: "update_task",
    taskId: input.taskId,
    eventId: event.eventId,
    resultDigest,
    result,
  });
  const records = [...current.bundle.idempotencyRecords, record];
  const receipts = [...current.receipts, receipt];
  const check = latestCheck(data);
  const artifacts = buildTaskArtifacts({
    manifest: data.manifest,
    ...(data.brief === undefined ? {} : { brief: data.brief }),
    claims: data.claims,
    evidence: data.evidence,
    impactPaths: data.impactPaths,
    ...(data.impactConclusion === undefined
      ? {}
      : { impactConclusion: data.impactConclusion }),
    ...(check === undefined ? {} : { changeCheck: check }),
    ...(check === undefined || data.verificationRecords.length === 0
      ? {}
      : { verificationRecords: data.verificationRecords }),
    idempotencyRecords: records,
    receipts,
    createdAt: occurredAt,
  });
  try {
    await store.persistTaskBundle(
      {
        artifacts,
        events: [...current.bundle.events, event],
        idempotencyRecords: records,
      },
      {
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        requestDigest,
      },
    );
  } catch (error) {
    const raced = await store.readTaskBundle(input.taskId).catch(
      () => undefined,
    );
    if (raced !== undefined) {
      const racedReplay = existingReceipt(raced, input, requestDigest);
      if (racedReplay !== undefined) return racedReplay;
    }
    throw error;
  }
  return result;
}

/**
 * Rebuild the context of a stale Task against one exact, already-published
 * Repository Snapshot.  The loader is invoked only after replay, revision,
 * lifecycle, and target-snapshot checks have passed; it therefore cannot
 * turn an idempotent retry into a new context read or bypass the Task CAS.
 */
export async function rebuildTaskContext(
  store: ArtifactStore,
  input: UpdateTaskInputV1,
  clock: () => Date,
  loadContext: RebuildContextLoader,
): Promise<TaskMutationOutcome> {
  if (
    input.action.type !== "refresh_task_context" &&
    input.action.type !== "rebase_task"
  ) {
    throw new TaskEngineError(
      "context_build_failed",
      "rebuildTaskContext requires a context recovery action.",
      { taskId: input.taskId },
    );
  }
  const targetSnapshotId = input.action.targetSnapshotId;
  const requestDigest = sha256CanonicalJson(input);
  const current = await store.readTaskBundle(input.taskId);
  const replay = existingReceipt(current, input, requestDigest);
  if (replay !== undefined) return replay;
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
  const data = dataFromRead(current);
  requireMutableTaskRead(data, current);
  if (data.manifest.status !== "stale") {
    transitionRejected(
      data.manifest,
      input.action.type,
      "transition_not_allowed",
    );
  }
  if (data.manifest.latestSnapshotId !== targetSnapshotId) {
    gateUnsatisfied(data.manifest, "context_ready", [
      {
        code: "target_snapshot_mismatch",
        resourceId: targetSnapshotId,
      },
    ]);
  }
  if (
    input.action.type === "rebase_task" &&
    input.action.newBaselineSnapshotId !== targetSnapshotId
  ) {
    gateUnsatisfied(data.manifest, "context_ready", [
      {
        code: "baseline_snapshot_mismatch",
        resourceId: input.action.newBaselineSnapshotId,
      },
    ]);
  }
  const minimumOccurredAt = Date.parse(data.manifest.updatedAt) + 1;
  const clockTime = clock().getTime();
  const occurredAt = new Date(
    Math.max(
      minimumOccurredAt,
      Number.isFinite(clockTime) ? clockTime : minimumOccurredAt,
    ),
  ).toISOString();
  const refreshed = await loadContext(current, occurredAt);
  if (refreshed.snapshotId !== targetSnapshotId) {
    throw new TaskEngineError(
      "context_build_failed",
      "The rebuilt Task context is bound to a different Repository Snapshot.",
      {
        taskId: input.taskId,
        expectedSnapshotId: targetSnapshotId,
        actualSnapshotId: refreshed.snapshotId,
      },
    );
  }
  const revision = data.manifest.revision + 1;
  const {
    staleState: _staleState,
    blockedState: _blockedState,
    currentChangeCheckId: _currentChangeCheckId,
    currentChangeCheckRevision: _currentChangeCheckRevision,
    ...activeManifest
  } = data.manifest;
  data.manifest = TaskManifestV1Schema.parse({
    ...activeManifest,
    status: "context_ready",
    latestSnapshotId: refreshed.snapshotId,
    baselineSnapshotId:
      input.action.type === "rebase_task"
        ? input.action.newBaselineSnapshotId
        : activeManifest.baselineSnapshotId,
    updatedAt: occurredAt,
    revision,
  });
  data.brief = refreshed.brief;
  data.claims = [...refreshed.claims];
  data.evidence = [...refreshed.evidence];
  data.impactPaths = [...refreshed.impactPaths];
  // Change Checks and Verification records are snapshot-bound.  They are
  // retained in the event/receipt history but must not be presented as
  // current after a context rebuild.
  data.changeChecks = [];
  data.verificationRecords = [];
  const eventId = `event:${input.taskId}:${revision}`;
  const event = buildTaskEvent({
    manifest: data.manifest,
    previousManifest: current.bundle.manifest,
    previousEvent: current.bundle.events.at(-1),
    action: input.action,
    actor: input.actor,
    idempotencyKey: input.idempotencyKey,
    requestDigest,
    occurredAt,
  });
  // Keep this assertion adjacent to event construction: event IDs are part
  // of the durable receipt identity and must remain contiguous.
  if (event.eventId !== eventId) {
    throw new TaskEngineError(
      "context_build_failed",
      "The rebuilt Task event identity was not contiguous.",
      { taskId: input.taskId, expectedEventId: eventId, actualEventId: event.eventId },
    );
  }
  const mutation = mutationResult(
    data.manifest,
    event,
    current.artifacts
      .filter(
        (artifact) =>
          artifact.artifactType !== "change_check" &&
          artifact.artifactType !== "verification",
      )
      .map((artifact) => artifact.artifactId),
  );
  const result = { task: data.manifest, mutation };
  const resultDigest = sha256CanonicalJson(result);
  const record = IdempotencyRecordV1Schema.parse({
    schemaVersion: 1,
    worktreeId: store.worktreeId,
    scope: { kind: "task", taskId: input.taskId },
    idempotencyKey: input.idempotencyKey,
    actor: input.actor,
    requestDigest,
    taskId: input.taskId,
    resultRevision: revision,
    eventId: event.eventId,
    resultDigest,
    createdAt: occurredAt,
  });
  const receipt = TaskOperationReceiptV1Schema.parse({
    schemaVersion: 1,
    operation: "update_task",
    taskId: input.taskId,
    eventId: event.eventId,
    resultDigest,
    result,
  });
  const records = [...current.bundle.idempotencyRecords, record];
  const receipts = [...current.receipts, receipt];
  const artifacts = buildTaskArtifacts({
    manifest: data.manifest,
    brief: data.brief,
    claims: data.claims,
    evidence: data.evidence,
    impactPaths: data.impactPaths,
    idempotencyRecords: records,
    receipts,
    createdAt: occurredAt,
  });
  try {
    await store.persistTaskBundle(
      {
        artifacts,
        events: [...current.bundle.events, event],
        idempotencyRecords: records,
      },
      {
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        requestDigest,
      },
    );
  } catch (error) {
    const raced = await store.readTaskBundle(input.taskId).catch(
      () => undefined,
    );
    if (raced !== undefined) {
      const racedReplay = existingReceipt(raced, input, requestDigest);
      if (racedReplay !== undefined) return racedReplay;
    }
    throw error;
  }
  return result;
}
