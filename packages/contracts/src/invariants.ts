import { z } from "zod";

import {
  ChangeCheckArtifactV1Schema,
  ChangeCheckV1Schema,
  ImpactArtifactV1Schema,
  ImpactPathV1Schema,
  VerificationArtifactV1Schema,
  VerificationRecordV1Schema,
} from "./change.js";
import {
  ClaimLedgerArtifactV1Schema,
  ClaimV1Schema,
  EvidenceLedgerArtifactV1Schema,
  EvidenceV1Schema,
} from "./evidence.js";
import {
  RepoPulseArtifactV1Schema,
  RepositorySnapshotArtifactV1Schema,
} from "./repository.js";
import {
  IdempotencyRecordV1Schema,
  TaskBriefArtifactV1Schema,
  TaskBriefV1Schema,
  TaskEventV1Schema,
  TaskManifestArtifactV1Schema,
  TaskManifestV1Schema,
  verifyTaskEventLogIntegrityV1,
  type TaskEventLogIntegrityResultV1,
  type TaskEventV1,
} from "./task.js";

type IssuePath = PropertyKey[];

const addIssue = (
  context: z.RefinementCtx,
  path: IssuePath,
  message: string,
): void => {
  context.addIssue({ code: "custom", path, message });
};

const indexUnique = <T>(
  values: readonly T[],
  idOf: (value: T) => string,
  context: z.RefinementCtx,
  path: IssuePath,
  label: string,
): Map<string, T> => {
  const indexed = new Map<string, T>();
  values.forEach((value, index) => {
    const id = idOf(value);
    if (indexed.has(id)) {
      addIssue(context, [...path, index], `duplicate ${label}: ${id}`);
    } else {
      indexed.set(id, value);
    }
  });
  return indexed;
};

const requireReference = <T>(
  indexed: ReadonlyMap<string, T>,
  id: string,
  context: z.RefinementCtx,
  path: IssuePath,
  label: string,
): T | undefined => {
  const referenced = indexed.get(id);
  if (referenced === undefined) {
    addIssue(context, path, `dangling ${label} reference: ${id}`);
  }
  return referenced;
};

const validateTaskEventGenesisV1 = (
  events: readonly TaskEventV1[],
  context: z.RefinementCtx,
): void => {
  const first = events[0];
  if (
    first === undefined ||
    first.revision !== 1 ||
    first.previousRevision !== 0 ||
    first.action.type !== "task_created" ||
    first.previousEventDigest !== undefined ||
    first.previousStatus !== undefined ||
    first.resultingStatus !== "created"
  ) {
    addIssue(
      context,
      ["events", 0],
      "Task Event history must begin with the canonical revision-1 task_created genesis Event",
    );
  }

  const genesisCount = events.filter(
    (event) => event.action.type === "task_created",
  ).length;
  if (genesisCount !== 1) {
    addIssue(
      context,
      ["events"],
      "Task Event history must contain exactly one task_created genesis Event",
    );
  }
};

const FullTaskArtifactBundleV1Schema = z.strictObject({
  manifest: TaskManifestV1Schema,
  brief: TaskBriefV1Schema,
  claims: z.array(ClaimV1Schema),
  evidence: z.array(EvidenceV1Schema),
  impactPaths: z.array(ImpactPathV1Schema),
  changeChecks: z.array(ChangeCheckV1Schema),
  verificationRecords: z.array(VerificationRecordV1Schema),
  events: z.array(TaskEventV1Schema).min(1),
  idempotencyRecords: z.array(IdempotencyRecordV1Schema).min(1),
}).superRefine((bundle, context) => {
  validateTaskEventGenesisV1(bundle.events, context);
  const lacksSuccessfulContext =
    bundle.manifest.status === "created" ||
    (bundle.manifest.status === "blocked" &&
      bundle.manifest.blockedState?.resumeStatus === "created") ||
    (bundle.manifest.status === "stale" &&
      bundle.manifest.staleState?.staleFromStatus === "created") ||
    (bundle.manifest.status === "superseded" &&
      bundle.manifest.supersession?.supersededFromStatus === "created");
  if (lacksSuccessfulContext) {
    addIssue(
      context,
      ["manifest", "status"],
      "Tasks without successful context must use the contextless recovery bundle",
    );
  }
  const claims = indexUnique(
    bundle.claims,
    (claim) => claim.id,
    context,
    ["claims"],
    "claim ID",
  );
  const evidence = indexUnique(
    bundle.evidence,
    (item) => item.id,
    context,
    ["evidence"],
    "evidence ID",
  );
  const impactPaths = indexUnique(
    bundle.impactPaths,
    (path) => path.id,
    context,
    ["impactPaths"],
    "impact path ID",
  );
  const plannedChanges = indexUnique(
    bundle.brief.plannedChanges,
    (change) => change.id,
    context,
    ["brief", "plannedChanges"],
    "planned change ID",
  );
  const verificationPlanEntries = indexUnique(
    bundle.brief.verificationPlan,
    (entry) => entry.id,
    context,
    ["brief", "verificationPlan"],
    "verification plan entry ID",
  );
  const findings = indexUnique(
    bundle.changeChecks.flatMap((check) => check.findings),
    (finding) => finding.id,
    context,
    ["changeChecks"],
    "finding ID",
  );
  const verificationRecords = indexUnique(
    bundle.verificationRecords,
    (record) => record.id,
    context,
    ["verificationRecords"],
    "verification record ID",
  );
  const events = indexUnique(
    bundle.events,
    (event) => event.eventId,
    context,
    ["events"],
    "event ID",
  );

  if (bundle.brief.originalIntent !== bundle.manifest.originalIntent) {
    addIssue(
      context,
      ["brief", "originalIntent"],
      "Task Brief originalIntent must match Task Manifest",
    );
  }

  const requireClaimKind = (
    id: string,
    expectedKind: string,
    path: IssuePath,
  ): void => {
    const claim = requireReference(claims, id, context, path, "claim");
    if (claim !== undefined && claim.kind !== expectedKind) {
      addIssue(
        context,
        path,
        `claim ${id} must have kind ${expectedKind}, received ${claim.kind}`,
      );
    }
  };

  requireClaimKind(
    bundle.brief.goalClaimId,
    "goal",
    ["brief", "goalClaimId"],
  );
  bundle.brief.nonGoalClaimIds.forEach((id, index) => {
    requireClaimKind(id, "non_goal", ["brief", "nonGoalClaimIds", index]);
  });
  bundle.brief.acceptanceClaimIds.forEach((id, index) => {
    requireClaimKind(id, "acceptance", [
      "brief",
      "acceptanceClaimIds",
      index,
    ]);
  });
  bundle.brief.assumptionClaimIds.forEach((id, index) => {
    requireClaimKind(id, "assumption", [
      "brief",
      "assumptionClaimIds",
      index,
    ]);
  });
  bundle.brief.riskClaimIds.forEach((id, index) => {
    requireClaimKind(id, "risk", ["brief", "riskClaimIds", index]);
  });
  bundle.brief.unknownClaimIds.forEach((id, index) => {
    requireClaimKind(id, "unknown", ["brief", "unknownClaimIds", index]);
  });

  bundle.brief.readingPath.forEach((entry, entryIndex) => {
    entry.claimIds.forEach((id, referenceIndex) => {
      requireReference(
        claims,
        id,
        context,
        ["brief", "readingPath", entryIndex, "claimIds", referenceIndex],
        "claim",
      );
    });
    entry.evidenceIds.forEach((id, referenceIndex) => {
      requireReference(
        evidence,
        id,
        context,
        ["brief", "readingPath", entryIndex, "evidenceIds", referenceIndex],
        "evidence",
      );
    });
    if (entry.impactPathId !== undefined) {
      requireReference(
        impactPaths,
        entry.impactPathId,
        context,
        ["brief", "readingPath", entryIndex, "impactPathId"],
        "impact path",
      );
    }
  });

  bundle.brief.plannedChanges.forEach((change, changeIndex) => {
    change.claimIds.forEach((id, referenceIndex) => {
      requireReference(
        claims,
        id,
        context,
        [
          "brief",
          "plannedChanges",
          changeIndex,
          "claimIds",
          referenceIndex,
        ],
        "claim",
      );
    });
    change.impactPathIds.forEach((id, referenceIndex) => {
      requireReference(
        impactPaths,
        id,
        context,
        [
          "brief",
          "plannedChanges",
          changeIndex,
          "impactPathIds",
          referenceIndex,
        ],
        "impact path",
      );
    });
  });
  bundle.brief.verificationPlan.forEach((entry, entryIndex) => {
    entry.acceptanceClaimIds.forEach((id, referenceIndex) => {
      requireClaimKind(id, "acceptance", [
        "brief",
        "verificationPlan",
        entryIndex,
        "acceptanceClaimIds",
        referenceIndex,
      ]);
    });
  });

  bundle.claims.forEach((claim, claimIndex) => {
    if (claim.taskId !== bundle.manifest.taskId) {
      addIssue(
        context,
        ["claims", claimIndex, "taskId"],
        "every Claim must belong to the bundle Task",
      );
    }
    claim.evidenceIds.forEach((evidenceId, referenceIndex) => {
      const linkedEvidence = requireReference(
        evidence,
        evidenceId,
        context,
        ["claims", claimIndex, "evidenceIds", referenceIndex],
        "evidence",
      );
      if (
        linkedEvidence !== undefined &&
        !linkedEvidence.claimIds.includes(claim.id)
      ) {
        addIssue(
          context,
          ["claims", claimIndex, "evidenceIds", referenceIndex],
          `Claim/Evidence link is not symmetric for ${claim.id}/${evidenceId}`,
        );
      }
    });
    if (
      claim.epistemicStatus === "observed" ||
      claim.epistemicStatus === "inferred"
    ) {
      const hasCompatibleEvidence = claim.evidenceIds.some((evidenceId) => {
        const linked = evidence.get(evidenceId);
        if (linked === undefined || linked.freshness === "invalid") return false;
        if (claim.freshness === "current" && linked.freshness !== "current") {
          return false;
        }
        if (
          claim.epistemicStatus === "observed" &&
          linked.epistemicStatus !== "observed"
        ) {
          return false;
        }
        return (
          linked.epistemicStatus === "observed" ||
          linked.epistemicStatus === "inferred"
        );
      });
      if (!hasCompatibleEvidence) {
        addIssue(
          context,
          ["claims", claimIndex, "evidenceIds"],
          `${claim.epistemicStatus} Claim requires non-invalid, epistemically compatible Evidence; current Claims require current Evidence`,
        );
      }
    }
    claim.derivationPath?.forEach((step, stepIndex) => {
      if (step.kind === "evidence") {
        requireReference(
          evidence,
          step.evidenceId,
          context,
          ["claims", claimIndex, "derivationPath", stepIndex, "evidenceId"],
          "derivation Evidence",
        );
      }
      if (step.kind === "assumption") {
        const assumption = requireReference(
          claims,
          step.claimId,
          context,
          ["claims", claimIndex, "derivationPath", stepIndex, "claimId"],
          "derivation assumption Claim",
        );
        if (assumption !== undefined && assumption.kind !== "assumption") {
          addIssue(
            context,
            ["claims", claimIndex, "derivationPath", stepIndex, "claimId"],
            "derivation assumption steps must reference an assumption Claim",
          );
        }
      }
    });
    claim.findingIds.forEach((findingId, referenceIndex) => {
      const finding = requireReference(
        findings,
        findingId,
        context,
        ["claims", claimIndex, "findingIds", referenceIndex],
        "finding",
      );
      if (finding !== undefined && !finding.claimIds.includes(claim.id)) {
        addIssue(
          context,
          ["claims", claimIndex, "findingIds", referenceIndex],
          `Claim/Finding link is not symmetric for ${claim.id}/${findingId}`,
        );
      }
    });
    claim.verificationRecordIds.forEach((recordId, referenceIndex) => {
      const record = requireReference(
        verificationRecords,
        recordId,
        context,
        ["claims", claimIndex, "verificationRecordIds", referenceIndex],
        "verification record",
      );
      if (record !== undefined && !record.claimIds.includes(claim.id)) {
        addIssue(
          context,
          ["claims", claimIndex, "verificationRecordIds", referenceIndex],
          `Claim/Verification link is not symmetric for ${claim.id}/${recordId}`,
        );
      }
    });
    if (
      claim.confirmationEventId !== undefined &&
      !events.has(claim.confirmationEventId)
    ) {
      addIssue(
        context,
        ["claims", claimIndex, "confirmationEventId"],
        `dangling confirmation event: ${claim.confirmationEventId}`,
      );
    }
    if (claim.epistemicStatus === "human_confirmed") {
      const humanEvidence = claim.evidenceIds
        .map((evidenceId) => evidence.get(evidenceId))
        .find((item) => item?.kind === "human");
      if (humanEvidence === undefined) {
        addIssue(
          context,
          ["claims", claimIndex, "evidenceIds"],
          "human-confirmed claims require linked human Evidence",
        );
      }
      const confirmationEvent =
        claim.confirmationEventId === undefined
          ? undefined
          : events.get(claim.confirmationEventId);
      if (confirmationEvent !== undefined) {
        const action = confirmationEvent.action;
        const actionConfirmsClaim =
          (action.type === "confirm_goal" && action.claimId === claim.id) ||
          (action.type === "confirm_acceptance_criteria" &&
            action.claimIds.includes(claim.id)) ||
          (action.type === "record_assumption" &&
            action.claimId === claim.id) ||
          (action.type === "confirm_unknown" && action.claimId === claim.id);
        if (!actionConfirmsClaim) {
          addIssue(
            context,
            ["claims", claimIndex, "confirmationEventId"],
            "confirmation Event action must reference the human-confirmed Claim",
          );
        }
        if (
          humanEvidence?.kind === "human" &&
          humanEvidence.confirmation.actor !== confirmationEvent.actor
        ) {
          addIssue(
            context,
            ["claims", claimIndex, "confirmationEventId"],
            "human Evidence and confirmation Event actor must match",
          );
        }
        if (Date.parse(confirmationEvent.occurredAt) < Date.parse(claim.createdAt)) {
          addIssue(
            context,
            ["claims", claimIndex, "confirmationEventId"],
            "confirmation Event cannot precede Claim creation",
          );
        }
      }
    }
    if (claim.supersedesClaimId !== undefined) {
      requireReference(
        claims,
        claim.supersedesClaimId,
        context,
        ["claims", claimIndex, "supersedesClaimId"],
        "superseded claim",
      );
    }
  });

  bundle.evidence.forEach((item, evidenceIndex) => {
    item.claimIds.forEach((claimId, referenceIndex) => {
      const linkedClaim = requireReference(
        claims,
        claimId,
        context,
        ["evidence", evidenceIndex, "claimIds", referenceIndex],
        "claim",
      );
      if (
        linkedClaim !== undefined &&
        !linkedClaim.evidenceIds.includes(item.id)
      ) {
        addIssue(
          context,
          ["evidence", evidenceIndex, "claimIds", referenceIndex],
          `Evidence/Claim link is not symmetric for ${item.id}/${claimId}`,
        );
      }
    });
    item.derivationPath?.forEach((step, stepIndex) => {
      if (step.kind === "evidence") {
        if (step.evidenceId === item.id) {
          addIssue(
            context,
            ["evidence", evidenceIndex, "derivationPath", stepIndex, "evidenceId"],
            "Evidence derivation must not reference itself",
          );
        } else {
          requireReference(
            evidence,
            step.evidenceId,
            context,
            ["evidence", evidenceIndex, "derivationPath", stepIndex, "evidenceId"],
            "derivation Evidence",
          );
        }
      }
      if (step.kind === "assumption") {
        const assumption = requireReference(
          claims,
          step.claimId,
          context,
          ["evidence", evidenceIndex, "derivationPath", stepIndex, "claimId"],
          "derivation assumption Claim",
        );
        if (assumption !== undefined && assumption.kind !== "assumption") {
          addIssue(
            context,
            ["evidence", evidenceIndex, "derivationPath", stepIndex, "claimId"],
            "Evidence derivation assumptions must reference assumption Claims",
          );
        }
      }
    });
  });

  bundle.impactPaths.forEach((path, pathIndex) => {
    path.claimIds.forEach((claimId, referenceIndex) => {
      requireReference(
        claims,
        claimId,
        context,
        ["impactPaths", pathIndex, "claimIds", referenceIndex],
        "claim",
      );
    });
    path.steps.forEach((step, stepIndex) => {
      if (step.evidenceId !== undefined) {
        const linkedEvidence = requireReference(
          evidence,
          step.evidenceId,
          context,
          ["impactPaths", pathIndex, "steps", stepIndex, "evidenceId"],
          "evidence",
        );
        if (
          path.classification === "observed" &&
          linkedEvidence !== undefined &&
          (linkedEvidence.epistemicStatus !== "observed" ||
            linkedEvidence.freshness !== "current")
        ) {
          addIssue(
            context,
            ["impactPaths", pathIndex, "steps", stepIndex, "evidenceId"],
            "observed Impact steps require current observed Evidence",
          );
        }
      }
    });
  });

  bundle.changeChecks.forEach((check, checkIndex) => {
    if (check.taskId !== bundle.manifest.taskId) {
      addIssue(
        context,
        ["changeChecks", checkIndex, "taskId"],
        "every Change Check must belong to the bundle Task",
      );
    }
    if (check.baselineSnapshotId !== bundle.manifest.baselineSnapshotId) {
      addIssue(
        context,
        ["changeChecks", checkIndex, "baselineSnapshotId"],
        "Change Check baseline must match the Task baseline",
      );
    }
    const checkEvent = bundle.events.find(
      (event) =>
        event.action.type === "change_checked" &&
        event.action.changeCheckId === check.id,
    );
    if (checkEvent === undefined) {
      addIssue(
        context,
        ["changeChecks", checkIndex, "id"],
        "every Change Check requires its typed change_checked Event",
      );
    } else if (
      checkEvent.revision !== check.taskRevision ||
      checkEvent.sourceSnapshotId !== check.actualSnapshotId
    ) {
      addIssue(
        context,
        ["changeChecks", checkIndex, "taskRevision"],
        "Change Check taskRevision and snapshot must match its change_checked Event",
      );
    }
    check.findings.forEach((finding, findingIndex) => {
      const findingClaims = finding.claimIds
        .map((claimId) => claims.get(claimId))
        .filter((claim) => claim !== undefined);
      if (!findingClaims.some((claim) => claim.kind === "finding")) {
        addIssue(
          context,
          ["changeChecks", checkIndex, "findings", findingIndex, "claimIds"],
          "every Finding requires a linked Claim with kind finding",
        );
      }
      finding.claimIds.forEach((claimId, referenceIndex) => {
        const claim = requireReference(
          claims,
          claimId,
          context,
          [
            "changeChecks",
            checkIndex,
            "findings",
            findingIndex,
            "claimIds",
            referenceIndex,
          ],
          "claim",
        );
        if (claim !== undefined && !claim.findingIds.includes(finding.id)) {
          addIssue(
            context,
            [
              "changeChecks",
              checkIndex,
              "findings",
              findingIndex,
              "claimIds",
              referenceIndex,
            ],
            `Finding/Claim link is not symmetric for ${finding.id}/${claimId}`,
          );
        }
      });
      finding.plannedChangeIds.forEach((changeId, referenceIndex) => {
        requireReference(
          plannedChanges,
          changeId,
          context,
          [
            "changeChecks",
            checkIndex,
            "findings",
            findingIndex,
            "plannedChangeIds",
            referenceIndex,
          ],
          "planned change",
        );
      });
      finding.evidenceIds.forEach((evidenceId, referenceIndex) => {
        requireReference(
          evidence,
          evidenceId,
          context,
          [
            "changeChecks",
            checkIndex,
            "findings",
            findingIndex,
            "evidenceIds",
            referenceIndex,
          ],
          "evidence",
        );
      });
      if (finding.resolution?.kind === "fixed") {
        finding.resolution.evidenceIds.forEach((evidenceId, referenceIndex) => {
          const linked = requireReference(
            evidence,
            evidenceId,
            context,
            [
              "changeChecks",
              checkIndex,
              "findings",
              findingIndex,
              "resolution",
              "evidenceIds",
              referenceIndex,
            ],
            "fixed Finding evidence",
          );
          if (linked !== undefined && linked.freshness !== "current") {
            addIssue(
              context,
              [
                "changeChecks",
                checkIndex,
                "findings",
                findingIndex,
                "resolution",
                "evidenceIds",
                referenceIndex,
              ],
              "fixed Finding resolution requires current Evidence",
            );
          }
        });
      }
      finding.impactPathIds.forEach((pathId, referenceIndex) => {
        requireReference(
          impactPaths,
          pathId,
          context,
          [
            "changeChecks",
            checkIndex,
            "findings",
            findingIndex,
            "impactPathIds",
            referenceIndex,
          ],
          "impact path",
        );
      });
      const acceptedResolution =
        finding.resolution?.kind === "accepted"
          ? finding.resolution
          : undefined;
      if (
        acceptedResolution !== undefined &&
        !events.has(acceptedResolution.eventId)
      ) {
        addIssue(
          context,
          [
            "changeChecks",
            checkIndex,
            "findings",
            findingIndex,
            "resolution",
            "eventId",
          ],
          `dangling finding acceptance event: ${acceptedResolution.eventId}`,
        );
      } else if (acceptedResolution !== undefined) {
        const acceptanceEvent = events.get(acceptedResolution.eventId);
        if (
          acceptanceEvent?.action.type !== "accept_finding" ||
          acceptanceEvent.action.findingId !== finding.id ||
          acceptanceEvent.actor !== acceptedResolution.actor ||
          acceptanceEvent.action.reason !== acceptedResolution.reason ||
          (checkEvent !== undefined &&
            bundle.events.indexOf(acceptanceEvent) <=
              bundle.events.indexOf(checkEvent))
        ) {
          addIssue(
            context,
            [
              "changeChecks",
              checkIndex,
              "findings",
              findingIndex,
              "resolution",
              "eventId",
            ],
            "Finding acceptance must match a later strong typed Event",
          );
        }
      }
    });
  });

  bundle.verificationRecords.forEach((record, recordIndex) => {
    if (record.taskId !== bundle.manifest.taskId) {
      addIssue(
        context,
        ["verificationRecords", recordIndex, "taskId"],
        "every Verification record must belong to the bundle Task",
      );
    }
    const planEntry = requireReference(
      verificationPlanEntries,
      record.verificationPlanEntryId,
      context,
      ["verificationRecords", recordIndex, "verificationPlanEntryId"],
      "verification plan entry",
    );
    if (
      planEntry !== undefined &&
      !record.claimIds.every((claimId) =>
        planEntry.acceptanceClaimIds.includes(claimId),
      )
    ) {
      addIssue(
        context,
        ["verificationRecords", recordIndex, "claimIds"],
        "Verification claims must belong to the referenced plan entry",
      );
    }
    const recordedEvent = bundle.events.find(
      (event) =>
        event.action.type === "verification_recorded" &&
        event.action.verificationRecordId === record.id,
    );
    if (recordedEvent === undefined) {
      addIssue(
        context,
        ["verificationRecords", recordIndex, "id"],
        "every Verification record requires its typed verification_recorded Event",
      );
    } else if (
      recordedEvent.sourceSnapshotId !== record.snapshotId ||
      Date.parse(recordedEvent.occurredAt) < Date.parse(record.recordedAt) ||
      recordedEvent.actor !== record.actor
    ) {
      addIssue(
        context,
        ["verificationRecords", recordIndex],
        "Verification record snapshot, time, and actor must match its recording Event",
      );
    }
    if (record.supersedesVerificationRecordId !== undefined) {
      const previousRecord = requireReference(
        verificationRecords,
        record.supersedesVerificationRecordId,
        context,
        [
          "verificationRecords",
          recordIndex,
          "supersedesVerificationRecordId",
        ],
        "superseded verification record",
      );
      if (
        previousRecord !== undefined &&
        (previousRecord.taskId !== record.taskId ||
          previousRecord.verificationPlanEntryId !==
            record.verificationPlanEntryId ||
          previousRecord.snapshotId !== record.snapshotId ||
          previousRecord.attempt + 1 !== record.attempt ||
          Date.parse(previousRecord.recordedAt) > Date.parse(record.recordedAt))
      ) {
        addIssue(
          context,
          [
            "verificationRecords",
            recordIndex,
            "supersedesVerificationRecordId",
          ],
          "Verification retry must supersede the immediately preceding attempt for the same plan entry and snapshot",
        );
      }
    }
    record.claimIds.forEach((claimId, referenceIndex) => {
      const claim = requireReference(
        claims,
        claimId,
        context,
        ["verificationRecords", recordIndex, "claimIds", referenceIndex],
        "claim",
      );
      if (
        claim !== undefined &&
        !claim.verificationRecordIds.includes(record.id)
      ) {
        addIssue(
          context,
          ["verificationRecords", recordIndex, "claimIds", referenceIndex],
          `Verification/Claim link is not symmetric for ${record.id}/${claimId}`,
        );
      }
    });
    if (
      record.skipAcceptance !== undefined &&
      !events.has(record.skipAcceptance.eventId)
    ) {
      addIssue(
        context,
        ["verificationRecords", recordIndex, "skipAcceptance", "eventId"],
        `dangling skip acceptance event: ${record.skipAcceptance.eventId}`,
      );
    } else if (record.skipAcceptance !== undefined) {
      const acceptanceEvent = events.get(record.skipAcceptance.eventId);
      if (
        acceptanceEvent?.action.type !== "accept_verification_skip" ||
        acceptanceEvent.action.verificationRecordId !== record.id ||
        acceptanceEvent.actor !== record.skipAcceptance.actor ||
        acceptanceEvent.action.reason !== record.skipAcceptance.reason ||
        (recordedEvent !== undefined &&
          acceptanceEvent !== undefined &&
          bundle.events.indexOf(acceptanceEvent) <=
            bundle.events.indexOf(recordedEvent))
      ) {
        addIssue(
          context,
          ["verificationRecords", recordIndex, "skipAcceptance", "eventId"],
          "Verification skip acceptance must match a later strong typed Event",
        );
      }
    }
  });
  const verificationAttempts = new Set<string>();
  bundle.verificationRecords.forEach((record, recordIndex) => {
    const key = `${record.verificationPlanEntryId}\u0000${record.snapshotId}\u0000${record.attempt}`;
    if (verificationAttempts.has(key)) {
      addIssue(
        context,
        ["verificationRecords", recordIndex, "attempt"],
        "verification attempt numbers must be unique per plan entry and snapshot",
      );
    }
    verificationAttempts.add(key);
  });

  bundle.events.forEach((event, eventIndex) => {
    if (
      event.taskId !== bundle.manifest.taskId ||
      event.repositoryId !== bundle.manifest.repositoryId ||
      event.worktreeId !== bundle.manifest.worktreeId
    ) {
      addIssue(
        context,
        ["events", eventIndex],
        "every Event must use the Task repository/worktree/task identity",
      );
    }
    if (eventIndex > 0) {
      const previous = bundle.events[eventIndex - 1];
      if (previous !== undefined) {
        if (event.previousRevision !== previous.revision) {
          addIssue(
            context,
            ["events", eventIndex, "previousRevision"],
            "Event revisions must be contiguous in JSONL order",
          );
        }
        if (event.previousEventDigest !== previous.eventDigest) {
          addIssue(
            context,
            ["events", eventIndex, "previousEventDigest"],
            "Event digest chain does not match the preceding Event",
          );
        }
        if (event.previousStatus !== previous.resultingStatus) {
          addIssue(
            context,
            ["events", eventIndex, "previousStatus"],
            "Event status replay must start from the preceding resultingStatus",
          );
        }
        if (Date.parse(event.occurredAt) < Date.parse(previous.occurredAt)) {
          addIssue(
            context,
            ["events", eventIndex, "occurredAt"],
            "Event timestamps must be chronological in JSONL order",
          );
        }
      }
    }
  });
  const finalEvent = bundle.events.at(-1);
  if (finalEvent !== undefined && finalEvent.revision !== bundle.manifest.revision) {
    addIssue(
      context,
      ["manifest", "revision"],
      "Task Manifest revision must equal the final Event revision",
    );
  }
  if (
    finalEvent !== undefined &&
    finalEvent.resultingStatus !== bundle.manifest.status
  ) {
    addIssue(
      context,
      ["manifest", "status"],
      "Task Manifest status must equal the replayed final Event status",
    );
  }
  const mostRecentBlock = [...bundle.events].reverse().find(
    (event) => event.action.type === "block_task",
  );
  if (
    bundle.manifest.status === "blocked" &&
    bundle.manifest.blockedState !== undefined &&
    mostRecentBlock?.previousStatus !== bundle.manifest.blockedState.resumeStatus
  ) {
    addIssue(
      context,
      ["manifest", "blockedState", "resumeStatus"],
      "blockedState.resumeStatus must match the block_task source status",
    );
  }
  const supersedeEvent = [...bundle.events].reverse().find(
    (event) => event.action.type === "supersede_task",
  );
  if (
    bundle.manifest.status === "superseded" &&
    bundle.manifest.supersession !== undefined &&
    supersedeEvent?.previousStatus !==
      bundle.manifest.supersession.supersededFromStatus
  ) {
    addIssue(
      context,
      ["manifest", "supersession", "supersededFromStatus"],
      "supersession source status must match the supersede_task Event",
    );
  }

  const idempotencyKeys = new Set<string>();
  const idempotencyEventIds = new Set<string>();
  bundle.idempotencyRecords.forEach((record, recordIndex) => {
    const scopeKey =
      record.scope.kind === "task"
        ? `task:${record.scope.taskId}`
        : `create:${record.scope.createScope}`;
    const composite = `${record.worktreeId}\u0000${scopeKey}\u0000${record.idempotencyKey}`;
    if (idempotencyKeys.has(composite)) {
      addIssue(
        context,
        ["idempotencyRecords", recordIndex],
        "duplicate worktree/scope/idempotency key",
      );
    }
    idempotencyKeys.add(composite);
    if (idempotencyEventIds.has(record.eventId)) {
      addIssue(
        context,
        ["idempotencyRecords", recordIndex, "eventId"],
        "a committed Event must map to exactly one idempotency record",
      );
    }
    idempotencyEventIds.add(record.eventId);

    if (
      record.worktreeId !== bundle.manifest.worktreeId ||
      record.taskId !== bundle.manifest.taskId ||
      (record.scope.kind === "task" &&
        record.scope.taskId !== bundle.manifest.taskId)
    ) {
      addIssue(
        context,
        ["idempotencyRecords", recordIndex],
        "Idempotency record identity must match the bundle Task",
      );
    }

    const event = events.get(record.eventId);
    if (event === undefined) {
      addIssue(
        context,
        ["idempotencyRecords", recordIndex, "eventId"],
        `dangling idempotency Event reference: ${record.eventId}`,
      );
    } else if (
      event.idempotencyKey !== record.idempotencyKey ||
      event.actor !== record.actor ||
      event.requestDigest !== record.requestDigest ||
      event.revision !== record.resultRevision
    ) {
      addIssue(
        context,
        ["idempotencyRecords", recordIndex],
        "Idempotency record must match its committed Event result",
      );
    }
  });
  bundle.events.forEach((event, eventIndex) => {
    if (!idempotencyEventIds.has(event.eventId)) {
      addIssue(
        context,
        ["events", eventIndex, "eventId"],
        "every successful Task Event requires an idempotency record",
      );
    }
  });

  const supersededBy = new Map(
    bundle.claims
      .filter((claim) => claim.supersedesClaimId !== undefined)
      .map((claim) => [claim.id, claim.supersedesClaimId as string]),
  );
  for (const start of supersededBy.keys()) {
    const visited = new Set<string>();
    let current: string | undefined = start;
    while (current !== undefined) {
      if (visited.has(current)) {
        addIssue(
          context,
          ["claims"],
          `claim supersession cycle detected at ${current}`,
        );
        break;
      }
      visited.add(current);
      current = supersededBy.get(current);
    }
  }

  const requiresCurrentCheck =
    bundle.manifest.status === "verification_required" ||
    bundle.manifest.status === "verified";
  const currentCheck =
    bundle.manifest.currentChangeCheckId === undefined
      ? undefined
      : bundle.changeChecks.find(
          (check) =>
            check.id === bundle.manifest.currentChangeCheckId &&
            check.taskRevision === bundle.manifest.currentChangeCheckRevision,
        );
  if (requiresCurrentCheck) {
    if (currentCheck === undefined) {
      addIssue(
        context,
        ["manifest", "currentChangeCheckId"],
        `${bundle.manifest.status} Tasks require the exact canonical current Change Check`,
      );
    } else {
      if (
        currentCheck.actualSnapshotId !== bundle.manifest.latestSnapshotId ||
        currentCheck.baselineSnapshotId !== bundle.manifest.baselineSnapshotId
      ) {
        addIssue(
          context,
          ["manifest", "currentChangeCheckId"],
          "canonical current Change Check must bind the Task baseline and latest Snapshot",
        );
      }
      const unresolvedBlockingFinding = currentCheck.findings.find(
        (finding) => finding.blocking && finding.resolution === undefined,
      );
      if (unresolvedBlockingFinding !== undefined) {
        addIssue(
          context,
          ["manifest", "currentChangeCheckId"],
          `blocking Finding ${unresolvedBlockingFinding.id} is unresolved`,
        );
      }
      for (const finding of currentCheck.findings) {
        if (
          finding.resolution?.kind === "fixed" &&
          finding.resolution.snapshotId !== bundle.manifest.latestSnapshotId
        ) {
          addIssue(
            context,
            ["manifest", "currentChangeCheckId"],
            `fixed Finding ${finding.id} must be resolved on the latest Snapshot`,
          );
        }
      }
    }
  }

  if (bundle.manifest.status === "verified") {
    bundle.brief.verificationPlan
      .filter((entry) => entry.required)
      .forEach((entry, planIndex) => {
        const latestAttempt = bundle.verificationRecords
          .filter(
            (record) =>
              record.verificationPlanEntryId === entry.id &&
              record.snapshotId === bundle.manifest.latestSnapshotId,
          )
          .sort((left, right) => right.attempt - left.attempt)
          .at(0);
        const satisfied =
          latestAttempt !== undefined &&
          entry.acceptanceClaimIds.every((claimId) =>
            latestAttempt.claimIds.includes(claimId),
          ) &&
          (latestAttempt.status === "passed" ||
            (latestAttempt.status === "skipped" &&
              latestAttempt.skipAcceptance !== undefined));
        if (!satisfied) {
          addIssue(
            context,
            ["brief", "verificationPlan", planIndex],
            "verified Tasks require the latest final-snapshot attempt for every required verification plan entry to pass or have an accepted skip",
          );
        }
      });

    const latestAttempts = new Map<string, (typeof bundle.verificationRecords)[number]>();
    for (const record of bundle.verificationRecords) {
      if (record.snapshotId !== bundle.manifest.latestSnapshotId) continue;
      const current = latestAttempts.get(record.verificationPlanEntryId);
      if (current === undefined || current.attempt < record.attempt) {
        latestAttempts.set(record.verificationPlanEntryId, record);
      }
    }
    const unresolvedVerification = [...latestAttempts.values()].some(
      (record) =>
        record.status === "failed" ||
        record.status === "blocked" ||
        record.status === "flaky",
    );
    if (unresolvedVerification) {
      addIssue(
        context,
        ["manifest", "status"],
        "verified Tasks cannot have an unresolved latest verification attempt",
      );
    }
  }
});

const ContextlessTaskArtifactBundleV1Schema = z.strictObject({
  manifest: TaskManifestV1Schema,
  events: z.array(TaskEventV1Schema).min(1),
  idempotencyRecords: z.array(IdempotencyRecordV1Schema).min(1),
}).superRefine((bundle, context) => {
  validateTaskEventGenesisV1(bundle.events, context);
  const contextlessStatus =
    bundle.manifest.status === "created" ||
    (bundle.manifest.status === "blocked" &&
      bundle.manifest.blockedState?.resumeStatus === "created") ||
    (bundle.manifest.status === "stale" &&
      bundle.manifest.staleState?.staleFromStatus === "created") ||
    (bundle.manifest.status === "superseded" &&
      bundle.manifest.supersession?.supersededFromStatus === "created");
  if (!contextlessStatus) {
    addIssue(
      context,
      ["manifest", "status"],
      "a contextless recovery bundle is only valid before context_ready",
    );
  }

  const events = indexUnique(
    bundle.events,
    (event) => event.eventId,
    context,
    ["events"],
    "event ID",
  );
  const allowedActions = new Set([
    "task_created",
    "block_task",
    "resume_task",
    "task_context_staled",
    "supersede_task",
  ]);
  bundle.events.forEach((event, eventIndex) => {
    if (
      event.taskId !== bundle.manifest.taskId ||
      event.repositoryId !== bundle.manifest.repositoryId ||
      event.worktreeId !== bundle.manifest.worktreeId
    ) {
      addIssue(
        context,
        ["events", eventIndex],
        "contextless Event identity must match the Task Manifest",
      );
    }
    if (!allowedActions.has(event.action.type)) {
      addIssue(
        context,
        ["events", eventIndex, "action", "type"],
        "contextless recovery history cannot contain context-dependent actions",
      );
    }
    const previous = bundle.events[eventIndex - 1];
    if (
      previous !== undefined &&
      (event.previousRevision !== previous.revision ||
        event.previousEventDigest !== previous.eventDigest ||
        event.previousStatus !== previous.resultingStatus ||
        Date.parse(event.occurredAt) < Date.parse(previous.occurredAt))
    ) {
      addIssue(
        context,
        ["events", eventIndex],
        "contextless Event history must be contiguous and replayable",
      );
    }
  });
  const finalEvent = bundle.events.at(-1);
  if (
    finalEvent === undefined ||
    finalEvent.revision !== bundle.manifest.revision ||
    finalEvent.resultingStatus !== bundle.manifest.status
  ) {
    addIssue(
      context,
      ["manifest"],
      "contextless Manifest must match the replayed final Event",
    );
  }

  const idempotencyKeys = new Set<string>();
  const idempotencyEventIds = new Set<string>();
  bundle.idempotencyRecords.forEach((record, recordIndex) => {
    const scopeKey =
      record.scope.kind === "task"
        ? `task:${record.scope.taskId}`
        : `create:${record.scope.createScope}`;
    const key = `${record.worktreeId}\u0000${scopeKey}\u0000${record.idempotencyKey}`;
    if (idempotencyKeys.has(key) || idempotencyEventIds.has(record.eventId)) {
      addIssue(
        context,
        ["idempotencyRecords", recordIndex],
        "contextless idempotency records must be unique",
      );
    }
    idempotencyKeys.add(key);
    idempotencyEventIds.add(record.eventId);
    const event = events.get(record.eventId);
    if (
      record.worktreeId !== bundle.manifest.worktreeId ||
      record.taskId !== bundle.manifest.taskId ||
      (record.scope.kind === "task" &&
        record.scope.taskId !== bundle.manifest.taskId) ||
      event === undefined ||
      event.idempotencyKey !== record.idempotencyKey ||
      event.actor !== record.actor ||
      event.requestDigest !== record.requestDigest ||
      event.revision !== record.resultRevision
    ) {
      addIssue(
        context,
        ["idempotencyRecords", recordIndex],
        "contextless idempotency record must match its Task Event",
      );
    }
  });
  bundle.events.forEach((event, eventIndex) => {
    if (!idempotencyEventIds.has(event.eventId)) {
      addIssue(
        context,
        ["events", eventIndex, "eventId"],
        "every contextless Task Event requires an idempotency record",
      );
    }
  });
});

export const TaskArtifactBundleV1Schema = z.union([
  FullTaskArtifactBundleV1Schema,
  ContextlessTaskArtifactBundleV1Schema,
]);

export const PersistedArtifactV1Schema = z.union([
  RepositorySnapshotArtifactV1Schema,
  RepoPulseArtifactV1Schema,
  TaskManifestArtifactV1Schema,
  TaskBriefArtifactV1Schema,
  ClaimLedgerArtifactV1Schema,
  EvidenceLedgerArtifactV1Schema,
  ImpactArtifactV1Schema,
  ChangeCheckArtifactV1Schema,
  VerificationArtifactV1Schema,
]);

export type PersistedArtifactV1 = z.infer<typeof PersistedArtifactV1Schema>;

export function parsePersistedArtifactV1(input: unknown): PersistedArtifactV1 {
  return PersistedArtifactV1Schema.parse(input);
}

export type TaskArtifactBundleV1 = z.infer<
  typeof TaskArtifactBundleV1Schema
>;

export function validateTaskArtifactBundleV1(
  input: unknown,
): TaskArtifactBundleV1 {
  return TaskArtifactBundleV1Schema.parse(input);
}

export function verifyTaskArtifactBundleIntegrityV1(
  bundle: TaskArtifactBundleV1,
  digestCanonicalJson: (canonicalEventJson: string) => string,
): TaskEventLogIntegrityResultV1 {
  return verifyTaskEventLogIntegrityV1(bundle.events, digestCanonicalJson);
}

export class TaskArtifactBundleIntegrityErrorV1 extends Error {
  readonly result: TaskEventLogIntegrityResultV1;

  constructor(result: TaskEventLogIntegrityResultV1) {
    const firstIssue = result.issues[0];
    super(
      firstIssue === undefined
        ? "Task Artifact Bundle integrity verification failed"
        : firstIssue.message,
    );
    this.name = "TaskArtifactBundleIntegrityErrorV1";
    this.result = result;
  }
}

/**
 * Parses all structural and semantic invariants, then verifies Event content
 * digests with a host-provided SHA-256 callback.
 */
export function parseTrustedTaskArtifactBundleV1(
  input: unknown,
  digestCanonicalJson: (canonicalEventJson: string) => string,
): TaskArtifactBundleV1 {
  const bundle = TaskArtifactBundleV1Schema.parse(input);
  const integrity = verifyTaskArtifactBundleIntegrityV1(
    bundle,
    digestCanonicalJson,
  );
  if (!integrity.valid) {
    throw new TaskArtifactBundleIntegrityErrorV1(integrity);
  }
  return bundle;
}
