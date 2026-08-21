import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  ChangeCheckArtifactV1Schema,
  ChangeCheckV1Schema,
  ChangeFindingV1Schema,
  CheckChangeInputV1Schema,
  ImpactArtifactV1Schema,
  ImpactPathV1Schema,
  RecordVerificationInputV1Schema,
  VerificationArtifactV1Schema,
  VerificationRecordV1Schema,
} from "../src/change.js";
import {
  ClaimLedgerArtifactV1Schema,
  ClaimV1Schema,
  EvidenceLedgerArtifactV1Schema,
  EvidenceV1Schema,
} from "../src/evidence.js";
import {
  TaskArtifactBundleIntegrityErrorV1,
  TaskArtifactBundleV1Schema,
  parseTrustedTaskArtifactBundleV1,
  verifyTaskArtifactBundleIntegrityV1,
} from "../src/invariants.js";
import {
  canonicalTaskEventDigestJsonV1,
  TaskBriefArtifactV1Schema,
  TaskEventV1Schema,
  TaskManifestArtifactV1Schema,
  TaskManifestV1Schema,
  TaskOrdinaryTransitionV1Schema,
  UpdateTaskActionV1Schema,
  isTaskOrdinaryTransitionV1,
} from "../src/task.js";

const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const replacementTaskId = "01ARZ3NDEKTSV4RRFFQ69G5FAW";
const timestamp = "2026-07-28T08:00:00Z";
const laterTimestamp = "2026-07-28T08:01:00Z";
const digest = (character: string): string =>
  `sha256:${character.repeat(64)}`;
const digestCanonicalJson = (canonicalJson: string): string =>
  `sha256:${createHash("sha256").update(canonicalJson, "utf8").digest("hex")}`;

const baseManifest = {
  schemaVersion: 1,
  taskId,
  title: "Protect task evidence",
  originalIntent: "Preserve task evidence across agents",
  status: "planned",
  repositoryId: "repo-1",
  worktreeId: "worktree-1",
  baselineSnapshotId: "snapshot-1",
  latestSnapshotId: "snapshot-1",
  createdAt: timestamp,
  updatedAt: laterTimestamp,
  producerVersion: "3.0.0-alpha.1",
  revision: 6,
} as const;

const humanEvidence = (
  id: string,
  claimId: string,
  input: string,
) => ({
  id,
  kind: "human",
  epistemicStatus: "human_confirmed",
  freshness: "current",
  claimIds: [claimId],
  nodeIds: [],
  producedBy: "codex",
  createdAt: timestamp,
  observedAtSnapshotId: "snapshot-1",
  confirmation: {
    actor: "user",
    input,
    confirmedAt: timestamp,
  },
});

const sourceEvidence = {
  id: "evidence-source",
  kind: "source",
  epistemicStatus: "observed",
  freshness: "current",
  claimIds: ["claim-recommendation", "claim-risk"],
  nodeIds: ["node-a"],
  producedBy: "core",
  createdAt: timestamp,
  observedAtSnapshotId: "snapshot-1",
  filePath: "src/a.ts",
  lineRange: [1, 3],
  contentHash: digest("a"),
} as const;

const boundaryEvidence = {
  id: "evidence-boundary",
  kind: "analysis_boundary",
  epistemicStatus: "unknown",
  freshness: "current",
  claimIds: ["claim-assumption", "claim-unknown"],
  nodeIds: [],
  producedBy: "core",
  createdAt: timestamp,
  observedAtSnapshotId: "snapshot-1",
  boundaryReason: "Dynamic dispatch cannot be resolved statically.",
  relationPath: [],
} as const;

const claims = [
  {
    id: "claim-goal",
    taskId,
    kind: "goal",
    statement: "Preserve task evidence.",
    epistemicStatus: "human_confirmed",
    lifecycleStatus: "supported",
    freshness: "current",
    sourceSnapshotId: "snapshot-1",
    evidenceIds: ["evidence-goal"],
    findingIds: [],
    verificationRecordIds: [],
    confirmationEventId: "event-2",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: "claim-acceptance",
    taskId,
    kind: "acceptance",
    statement: "Every recommendation remains traceable.",
    epistemicStatus: "human_confirmed",
    lifecycleStatus: "supported",
    freshness: "current",
    sourceSnapshotId: "snapshot-1",
    evidenceIds: ["evidence-acceptance"],
    findingIds: [],
    verificationRecordIds: [],
    confirmationEventId: "event-3",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: "claim-recommendation",
    taskId,
    kind: "recommendation",
    statement: "Inspect src/a.ts.",
    epistemicStatus: "observed",
    lifecycleStatus: "supported",
    freshness: "current",
    sourceSnapshotId: "snapshot-1",
    evidenceIds: ["evidence-source"],
    findingIds: [],
    verificationRecordIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: "claim-risk",
    taskId,
    kind: "risk",
    statement: "The caller may also require a change.",
    epistemicStatus: "inferred",
    lifecycleStatus: "supported",
    freshness: "current",
    sourceSnapshotId: "snapshot-1",
    evidenceIds: ["evidence-source"],
    findingIds: [],
    verificationRecordIds: [],
    derivationPath: [
      {
        kind: "evidence",
        evidenceId: "evidence-source",
        description: "The caller relation is derived from source evidence.",
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: "claim-assumption",
    taskId,
    kind: "assumption",
    statement: "Dynamic calls are outside the static boundary.",
    epistemicStatus: "unknown",
    lifecycleStatus: "draft",
    freshness: "current",
    sourceSnapshotId: "snapshot-1",
    evidenceIds: ["evidence-boundary"],
    findingIds: [],
    verificationRecordIds: [],
    boundaryReason: "Dynamic calls are not statically resolvable.",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: "claim-unknown",
    taskId,
    kind: "unknown",
    statement: "A runtime-only consumer may exist.",
    epistemicStatus: "unknown",
    lifecycleStatus: "draft",
    freshness: "current",
    sourceSnapshotId: "snapshot-1",
    evidenceIds: ["evidence-boundary"],
    findingIds: [],
    verificationRecordIds: [],
    boundaryReason: "No runtime trace is available.",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
] as const;

const impactPath = {
  id: "impact-1",
  sourceNodeId: "node-a",
  targetNodeId: "node-b",
  classification: "observed",
  claimIds: ["claim-recommendation"],
  steps: [
    {
      source: "node-a",
      edgeType: "calls",
      target: "node-b",
      direction: "downstream",
      evidenceId: "evidence-source",
      confidence: "exact",
    },
  ],
} as const;

const brief = {
  originalIntent: baseManifest.originalIntent,
  goalClaimId: "claim-goal",
  nonGoalClaimIds: [],
  acceptanceClaimIds: ["claim-acceptance"],
  readingPath: [
    {
      id: "reading-1",
      order: 0,
      kind: "file",
      filePath: "src/a.ts",
      claimIds: ["claim-recommendation"],
      evidenceIds: ["evidence-source"],
    },
  ],
  plannedChanges: [
    {
      id: "plan-1",
      candidateLevel: "likely_change",
      filePath: "src/a.ts",
      intent: "Preserve stable evidence references.",
      claimIds: ["claim-recommendation"],
      impactPathIds: ["impact-1"],
    },
  ],
  assumptionClaimIds: ["claim-assumption"],
  riskClaimIds: ["claim-risk"],
  unknownClaimIds: ["claim-unknown"],
  verificationPlan: [
    {
      id: "verification-plan-1",
      acceptanceClaimIds: ["claim-acceptance"],
      method: "test",
      description: "Run contract tests.",
      required: true,
    },
  ],
} as const;

const event = (
  revision: number,
  action: Record<string, unknown>,
  character: string,
  previousStatus: string | undefined,
  resultingStatus: string,
) => ({
  schemaVersion: 1,
  eventId: `event-${revision}`,
  repositoryId: "repo-1",
  worktreeId: "worktree-1",
  taskId,
  previousRevision: revision - 1,
  revision,
  actor: revision === 1 ? "codex" : "user",
  idempotencyKey: `key-${revision}`,
  requestDigest: digest(character),
  sourceSnapshotId: "snapshot-1",
  occurredAt: timestamp,
  ...(previousStatus === undefined ? {} : { previousStatus }),
  resultingStatus,
  action,
  ...(revision === 1
    ? {}
    : { previousEventDigest: digest(((revision - 1) % 16).toString(16)) }),
  eventDigest: digest((revision % 16).toString(16)),
});

const events = [
  event(1, { type: "task_created" }, "a", undefined, "created"),
  event(
    2,
    { type: "confirm_goal", claimId: "claim-goal" },
    "b",
    "created",
    "created",
  ),
  event(
    3,
    {
      type: "confirm_acceptance_criteria",
      claimIds: ["claim-acceptance"],
    },
    "c",
    "created",
    "created",
  ),
  event(
    4,
    { type: "transition_status", to: "context_ready" },
    "d",
    "created",
    "context_ready",
  ),
  event(
    5,
    { type: "transition_status", to: "planned" },
    "e",
    "context_ready",
    "planned",
  ),
  event(
    6,
    { type: "confirm_plan", plannedChangeIds: ["plan-1"] },
    "f",
    "planned",
    "planned",
  ),
] as const;

const withTrustedEventDigests = (
  taskEvents: readonly ReturnType<typeof event>[],
) => {
  let previousEventDigest: string | undefined;
  return taskEvents.map((taskEvent, eventIndex) => {
    const candidate = { ...taskEvent } as Record<string, unknown>;
    delete candidate.eventDigest;
    delete candidate.previousEventDigest;
    if (eventIndex > 0) {
      candidate.previousEventDigest = previousEventDigest;
    }
    candidate.eventDigest = digest("0");
    const parsedCandidate = TaskEventV1Schema.parse(candidate);
    const eventDigest = digestCanonicalJson(
      canonicalTaskEventDigestJsonV1(parsedCandidate),
    );
    previousEventDigest = eventDigest;
    return { ...parsedCandidate, eventDigest };
  });
};

const idempotencyRecordsFor = (
  taskEvents: readonly ReturnType<typeof event>[],
) =>
  taskEvents.map((taskEvent, index) => ({
    schemaVersion: 1,
    worktreeId: "worktree-1",
    scope:
      index === 0
        ? { kind: "task_create", createScope: "build-task-brief" }
        : { kind: "task", taskId },
    idempotencyKey: taskEvent.idempotencyKey,
    actor: taskEvent.actor,
    requestDigest: taskEvent.requestDigest,
    taskId,
    resultRevision: taskEvent.revision,
    eventId: taskEvent.eventId,
    resultDigest: digest("f"),
    createdAt: timestamp,
  }));

const idempotencyRecords = idempotencyRecordsFor(events);

const validBundle = () => ({
  manifest: { ...baseManifest },
  brief,
  claims: [...claims],
  evidence: [
    humanEvidence("evidence-goal", "claim-goal", "This is the goal."),
    humanEvidence(
      "evidence-acceptance",
      "claim-acceptance",
      "This is the acceptance criterion.",
    ),
    sourceEvidence,
    boundaryEvidence,
  ],
  impactPaths: [impactPath],
  changeChecks: [],
  verificationRecords: [],
  events: [...events],
  idempotencyRecords,
});

const trustedBundle = () => {
  const bundle = structuredClone(validBundle());
  bundle.events = withTrustedEventDigests(bundle.events);
  return bundle;
};

const artifactEnvelope = (
  artifactType: string,
  artifactId: string,
  payload: unknown,
) => ({
  schemaVersion: 1,
  artifactType,
  artifactId,
  repositoryId: "repo-1",
  worktreeId: "worktree-1",
  sourceSnapshotId: "snapshot-1",
  taskId,
  revision: baseManifest.revision,
  producerVersion: "3.0.0-alpha.1",
  createdAt: timestamp,
  contentDigest: digest("0"),
  payload,
});

const verifiedBundle = (acceptedSkip: boolean) => {
  const extendedEvents = [
    ...events,
    event(
      7,
      { type: "transition_status", to: "in_progress" },
      "7",
      "planned",
      "in_progress",
    ),
    event(
      8,
      { type: "transition_status", to: "check_required" },
      "8",
      "in_progress",
      "check_required",
    ),
    event(
      9,
      {
        type: "change_checked",
        changeCheckArtifactId: "change-check-artifact-1",
        changeCheckId: "change-check-1",
      },
      "9",
      "check_required",
      "check_required",
    ),
    event(
      10,
      { type: "transition_status", to: "verification_required" },
      "0",
      "check_required",
      "verification_required",
    ),
    event(
      11,
      {
        type: "verification_recorded",
        verificationRecordId: "verification-1",
      },
      "1",
      "verification_required",
      "verification_required",
    ),
    event(
      12,
      {
        type: "accept_verification_skip",
        verificationRecordId: "verification-1",
        reason: "Authorized manual review covers the check.",
      },
      "2",
      "verification_required",
      "verification_required",
    ),
    event(
      13,
      { type: "transition_status", to: "verified" },
      "3",
      "verification_required",
      "verified",
    ),
  ];
  const bundle = structuredClone(validBundle());
  bundle.manifest = {
    ...bundle.manifest,
    status: "verified",
    revision: 13,
    currentChangeCheckId: "change-check-1",
    currentChangeCheckRevision: 9,
  } as never;
  bundle.changeChecks = [
    {
      schemaVersion: 1,
      id: "change-check-1",
      taskId,
      taskRevision: 9,
      baselineSnapshotId: "snapshot-1",
      actualSnapshotId: "snapshot-1",
      findings: [],
      generatedAt: timestamp,
    },
  ];
  bundle.verificationRecords = [
    {
      id: "verification-1",
      taskId,
      verificationPlanEntryId: "verification-plan-1",
      attempt: 1,
      kind: "manual",
      status: "skipped",
      summary: "Covered by an authorized manual review.",
      claimIds: ["claim-acceptance"],
      snapshotId: "snapshot-1",
      recordedAt: timestamp,
      actor: "user",
      ...(acceptedSkip
        ? {
            skipAcceptance: {
              actor: "user",
              reason: "Authorized manual review covers the check.",
              acceptedAt: timestamp,
              eventId: "event-12",
            },
          }
        : {}),
    },
  ];
  bundle.claims[1] = {
    ...bundle.claims[1],
    verificationRecordIds: ["verification-1"],
  };
  bundle.events = extendedEvents;
  bundle.idempotencyRecords = idempotencyRecordsFor(extendedEvents);
  return bundle;
};

const verifiedRetryBundle = () => {
  const bundle = structuredClone(verifiedBundle(true));
  const retryEvents = [
    ...events,
    event(
      7,
      { type: "transition_status", to: "in_progress" },
      "7",
      "planned",
      "in_progress",
    ),
    event(
      8,
      { type: "transition_status", to: "check_required" },
      "8",
      "in_progress",
      "check_required",
    ),
    event(
      9,
      {
        type: "change_checked",
        changeCheckArtifactId: "change-check-artifact-1",
        changeCheckId: "change-check-1",
      },
      "9",
      "check_required",
      "check_required",
    ),
    event(
      10,
      { type: "transition_status", to: "verification_required" },
      "0",
      "check_required",
      "verification_required",
    ),
    event(
      11,
      {
        type: "verification_recorded",
        verificationRecordId: "verification-failed",
      },
      "1",
      "verification_required",
      "verification_required",
    ),
    event(
      12,
      {
        type: "verification_recorded",
        verificationRecordId: "verification-passed",
      },
      "2",
      "verification_required",
      "verification_required",
    ),
    event(
      13,
      { type: "transition_status", to: "verified" },
      "3",
      "verification_required",
      "verified",
    ),
  ];
  bundle.verificationRecords = [
    {
      id: "verification-failed",
      taskId,
      verificationPlanEntryId: "verification-plan-1",
      attempt: 1,
      kind: "test",
      status: "failed",
      command: "pnpm test",
      exitCode: 1,
      summary: "The first attempt failed.",
      claimIds: ["claim-acceptance"],
      snapshotId: "snapshot-1",
      recordedAt: timestamp,
      actor: "user",
    },
    {
      id: "verification-passed",
      taskId,
      verificationPlanEntryId: "verification-plan-1",
      attempt: 2,
      supersedesVerificationRecordId: "verification-failed",
      kind: "test",
      status: "passed",
      command: "pnpm test",
      exitCode: 0,
      summary: "The retry passed.",
      claimIds: ["claim-acceptance"],
      snapshotId: "snapshot-1",
      recordedAt: timestamp,
      actor: "user",
    },
  ];
  bundle.claims[1] = {
    ...bundle.claims[1],
    verificationRecordIds: ["verification-failed", "verification-passed"],
  };
  bundle.events = retryEvents;
  bundle.idempotencyRecords = idempotencyRecordsFor(retryEvents);
  return bundle;
};

describe("Task V1 contracts", () => {
  it("enforces conditional exceptional state fields", () => {
    expect(
      TaskManifestV1Schema.safeParse({
        ...baseManifest,
        status: "blocked",
        blockedState: {
          resumeStatus: "planned",
          reasonCode: "dependency",
          message: "Waiting for an upstream contract.",
          actor: "user",
          blockedAt: timestamp,
        },
      }).success,
    ).toBe(true);

    expect(
      TaskManifestV1Schema.safeParse({
        ...baseManifest,
        status: "blocked",
      }).success,
    ).toBe(false);
    expect(
      TaskManifestV1Schema.safeParse({
        ...baseManifest,
        revision: 0,
      }).success,
    ).toBe(false);
    expect(
      TaskManifestV1Schema.safeParse({
        ...baseManifest,
        blockedState: {
          resumeStatus: "planned",
          reasonCode: "dependency",
          message: "Stale exceptional state.",
          actor: "user",
          blockedAt: timestamp,
        },
      }).success,
    ).toBe(false);
    expect(
      TaskManifestV1Schema.safeParse({
        ...baseManifest,
        status: "superseded",
        supersession: {
          reason: "Replaced.",
          replacementTaskId: taskId,
          actor: "user",
          supersededAt: timestamp,
        },
      }).success,
    ).toBe(false);
  });

  it("accepts only strong typed lifecycle actions and rejects unknown fields", () => {
    const validActions = [
      { type: "transition_status", to: "in_progress" },
      {
        type: "transition_status",
        to: "in_progress",
        verificationRecordId: "verification-1",
      },
      { type: "block_task", reasonCode: "dependency", message: "Waiting." },
      { type: "resume_task" },
      { type: "refresh_task_context", targetSnapshotId: "snapshot-2" },
      {
        type: "rebase_task",
        targetSnapshotId: "snapshot-2",
        newBaselineSnapshotId: "snapshot-2",
        reason: "The baseline changed.",
      },
      {
        type: "supersede_task",
        reason: "Replaced.",
        replacementTaskId,
      },
      {
        type: "accept_verification_skip",
        verificationRecordId: "verification-1",
        reason: "Manual review covers this check.",
      },
    ];
    validActions.forEach((action) => {
      expect(UpdateTaskActionV1Schema.safeParse(action).success).toBe(true);
    });

    expect(
      UpdateTaskActionV1Schema.safeParse({
        type: "resume_task",
        patch: [{ op: "replace", path: "/status", value: "verified" }],
      }).success,
    ).toBe(false);
    expect(
      UpdateTaskActionV1Schema.safeParse({
        type: "transition_status",
        to: "blocked",
      }).success,
    ).toBe(false);
    expect(
      UpdateTaskActionV1Schema.safeParse({
        type: "transition_status",
        to: "created",
      }).success,
    ).toBe(false);
    expect(
      UpdateTaskActionV1Schema.safeParse({
        type: "transition_status",
        to: "verified",
        verificationRecordId: "verification-1",
      }).success,
    ).toBe(false);
  });

  it("freezes ordinary lifecycle transitions and excludes exceptional paths", () => {
    const allowed = [
      ["created", "context_ready"],
      ["context_ready", "planned"],
      ["planned", "in_progress"],
      ["in_progress", "check_required"],
      ["check_required", "in_progress"],
      ["check_required", "verification_required"],
      ["verification_required", "in_progress"],
      ["verification_required", "check_required"],
      ["verification_required", "verified"],
    ] as const;
    allowed.forEach(([from, to]) => {
      expect(isTaskOrdinaryTransitionV1(from, to)).toBe(true);
      expect(
        TaskOrdinaryTransitionV1Schema.safeParse({ from, to }).success,
      ).toBe(true);
    });

    expect(isTaskOrdinaryTransitionV1("created", "verified")).toBe(false);
    expect(isTaskOrdinaryTransitionV1("verified", "in_progress")).toBe(false);
    expect(isTaskOrdinaryTransitionV1("superseded", "created")).toBe(false);
    expect(isTaskOrdinaryTransitionV1("blocked", "planned")).toBe(false);
    expect(isTaskOrdinaryTransitionV1("stale", "context_ready")).toBe(false);
    expect(
      TaskOrdinaryTransitionV1Schema.safeParse({
        from: "created",
        to: "verified",
      }).success,
    ).toBe(false);
  });

  it("requires structured reading paths", () => {
    expect(TaskArtifactBundleV1Schema.safeParse(validBundle()).success).toBe(
      true,
    );
    const malformed = structuredClone(validBundle());
    malformed.brief.readingPath[0] = {
      ...malformed.brief.readingPath[0],
      kind: "symbol",
    } as never;
    expect(TaskArtifactBundleV1Schema.safeParse(malformed).success).toBe(false);
  });

  it("accepts a legal contextless created Task recovery bundle", () => {
    const createdEvents = [events[0]];
    expect(
      TaskArtifactBundleV1Schema.safeParse({
        manifest: {
          ...baseManifest,
          status: "created",
          revision: 1,
        },
        events: createdEvents,
        idempotencyRecords: idempotencyRecordsFor(createdEvents),
      }).success,
    ).toBe(true);
  });

  it("binds Task Manifest envelope identity and revision to its payload", () => {
    const artifact = artifactEnvelope(
      "task_manifest",
      "task-manifest-1",
      baseManifest,
    );
    expect(TaskManifestArtifactV1Schema.safeParse(artifact).success).toBe(true);
    expect(
      TaskManifestArtifactV1Schema.safeParse({
        ...artifact,
        revision: 5,
      }).success,
    ).toBe(false);
    expect(
      TaskBriefArtifactV1Schema.safeParse(
        artifactEnvelope("task_brief", "task-brief-1", brief),
      ).success,
    ).toBe(true);
  });
});

describe("Claim and Evidence V1 contracts", () => {
  it("requires evidence for observed claims and boundaries for unknown claims", () => {
    expect(ClaimV1Schema.safeParse(claims[2]).success).toBe(true);
    expect(ClaimV1Schema.safeParse(claims[3]).success).toBe(true);
    expect(ClaimV1Schema.safeParse(claims[4]).success).toBe(true);
    expect(
      ClaimV1Schema.safeParse({
        ...claims[2],
        evidenceIds: [],
      }).success,
    ).toBe(false);
    expect(
      ClaimV1Schema.safeParse({
        ...claims[3],
        derivationPath: undefined,
      }).success,
    ).toBe(false);
    expect(
      ClaimV1Schema.safeParse({
        ...claims[5],
        boundaryReason: undefined,
      }).success,
    ).toBe(false);
  });

  it("does not let invalid Evidence support a current Claim", () => {
    const malformed = structuredClone(validBundle());
    const sourceIndex = malformed.evidence.findIndex(
      (item) => item.id === "evidence-source",
    );
    const invalidEvidence = {
      ...malformed.evidence[sourceIndex],
      freshness: "invalid",
      invalidatedAt: laterTimestamp,
      invalidationReason: "The observed content hash no longer matches.",
    };
    expect(EvidenceV1Schema.safeParse(invalidEvidence).success).toBe(true);
    malformed.evidence[sourceIndex] = invalidEvidence as never;

    const result = TaskArtifactBundleV1Schema.safeParse(malformed);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes("non-invalid, epistemically compatible"),
        ),
      ).toBe(true);
    }
  });

  it("uses discriminated Evidence shapes for files, humans, and boundaries", () => {
    expect(EvidenceV1Schema.safeParse(sourceEvidence).success).toBe(true);
    expect(
      EvidenceV1Schema.safeParse({
        ...sourceEvidence,
        lineRange: undefined,
      }).success,
    ).toBe(true);
    expect(
      EvidenceV1Schema.safeParse({
        ...sourceEvidence,
        lineRange: undefined,
        excerpt: "An excerpt must remain line anchored.",
      }).success,
    ).toBe(false);
    expect(
      EvidenceV1Schema.safeParse({
        ...sourceEvidence,
        filePath: "/private/repo/src/a.ts",
      }).success,
    ).toBe(false);
    expect(
      EvidenceV1Schema.safeParse(
        humanEvidence("evidence-human", "claim-goal", "Confirmed."),
      ).success,
    ).toBe(true);
    expect(
      EvidenceV1Schema.safeParse({
        ...boundaryEvidence,
        epistemicStatus: "observed",
      }).success,
    ).toBe(false);
  });

  it("rejects asymmetric Claim/Evidence references across the bundle", () => {
    const malformed = structuredClone(validBundle());
    malformed.evidence[2].claimIds = ["claim-recommendation"];
    const result = TaskArtifactBundleV1Schema.safeParse(malformed);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes("not symmetric"),
        ),
      ).toBe(true);
    }
  });

  it("provides concrete Claim and Evidence ledger envelope contracts", () => {
    const claimArtifact = artifactEnvelope("claim_ledger", "claims-1", {
      claims,
    });
    const evidenceArtifact = artifactEnvelope("evidence_ledger", "evidence-1", {
      evidence: [
        humanEvidence("evidence-goal", "claim-goal", "This is the goal."),
        sourceEvidence,
      ],
    });
    expect(
      ClaimLedgerArtifactV1Schema.safeParse(claimArtifact).success,
    ).toBe(true);
    expect(
      EvidenceLedgerArtifactV1Schema.safeParse(evidenceArtifact).success,
    ).toBe(true);
    expect(
      ClaimLedgerArtifactV1Schema.safeParse({
        ...claimArtifact,
        taskId: replacementTaskId,
      }).success,
    ).toBe(false);
  });
});

describe("Impact, Change Check, and Verification V1 contracts", () => {
  it("requires continuous observed paths with evidence", () => {
    expect(ImpactPathV1Schema.safeParse(impactPath).success).toBe(true);
    expect(
      ImpactPathV1Schema.safeParse({
        ...impactPath,
        targetNodeId: "node-c",
        steps: [
          ...impactPath.steps,
          {
            source: "disconnected",
            edgeType: "calls",
            target: "node-c",
            direction: "downstream",
            evidenceId: "evidence-source",
            confidence: "exact",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      ImpactPathV1Schema.safeParse({
        ...impactPath,
        steps: [{ ...impactPath.steps[0], evidenceId: undefined }],
      }).success,
    ).toBe(false);
  });

  it("rejects inferred or stale Evidence on an observed Impact path", () => {
    const evidenceVariants = [
      {
        ...sourceEvidence,
        epistemicStatus: "inferred",
        derivationPath: [
          {
            kind: "rule",
            ruleId: "graph-edge-inference",
            description: "The edge was inferred rather than observed.",
          },
        ],
      },
      {
        ...sourceEvidence,
        freshness: "stale",
        freshnessReason: "The source file changed after observation.",
      },
    ] as const;

    for (const evidenceVariant of evidenceVariants) {
      expect(EvidenceV1Schema.safeParse(evidenceVariant).success).toBe(true);
      const malformed = structuredClone(validBundle());
      const sourceIndex = malformed.evidence.findIndex(
        (item) => item.id === "evidence-source",
      );
      malformed.evidence[sourceIndex] = evidenceVariant as never;
      const result = TaskArtifactBundleV1Schema.safeParse(malformed);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) =>
            issue.message.includes(
              "observed Impact steps require current observed Evidence",
            ),
          ),
        ).toBe(true);
      }
    }
  });

  it("validates Finding type-specific references and Change Check IDs", () => {
    const finding = {
      id: "finding-1",
      type: "unplanned_change",
      severity: "warning",
      blocking: false,
      summary: "An unplanned file changed.",
      claimIds: ["claim-finding"],
      plannedChangeIds: [],
      actualChangeIds: ["change-1"],
      evidenceIds: [],
      impactPathIds: [],
    } as const;
    expect(ChangeFindingV1Schema.safeParse(finding).success).toBe(true);
    expect(
      ChangeFindingV1Schema.safeParse({
        ...finding,
        claimIds: [],
      }).success,
    ).toBe(false);
    expect(
      ChangeFindingV1Schema.safeParse({
        ...finding,
        resolution: {
          kind: "fixed",
          resolvedAt: laterTimestamp,
          snapshotId: "snapshot-2",
          evidenceIds: ["evidence-source"],
        },
      }).success,
    ).toBe(true);
    expect(
      ChangeFindingV1Schema.safeParse({
        ...finding,
        actualChangeIds: [],
      }).success,
    ).toBe(false);
    expect(
      ChangeCheckV1Schema.safeParse({
        schemaVersion: 1,
        id: "change-check-1",
        taskId,
        taskRevision: baseManifest.revision,
        baselineSnapshotId: "snapshot-1",
        actualSnapshotId: "snapshot-2",
        findings: [finding, finding],
        generatedAt: timestamp,
      }).success,
    ).toBe(false);
  });

  it("makes Worktree inclusion mandatory for P0 Change Check", () => {
    const input = {
      taskId,
      actualSnapshotId: "snapshot-2",
      includeWorktree: true,
      expectedRevision: 4,
      idempotencyKey: "check-1",
      actor: "codex",
    } as const;
    expect(CheckChangeInputV1Schema.safeParse(input).success).toBe(true);
    expect(
      CheckChangeInputV1Schema.safeParse({
        ...input,
        includeWorktree: false,
      }).success,
    ).toBe(false);
    const { actualSnapshotId: _actualSnapshotId, ...withoutActualSnapshot } =
      input;
    expect(
      CheckChangeInputV1Schema.safeParse(withoutActualSnapshot).success,
    ).toBe(false);
    expect(
      CheckChangeInputV1Schema.safeParse({
        ...input,
        verificationRecordIds: ["verification-legacy-caller-proof"],
      }).success,
    ).toBe(false);
  });

  it("provides concrete Impact, Change Check, and Verification envelopes", () => {
    const verificationRecord = {
      id: "verification-manual-1",
      taskId,
      verificationPlanEntryId: "verification-plan-1",
      attempt: 1,
      kind: "manual",
      status: "passed",
      summary: "A reviewer confirmed the condition.",
      claimIds: ["claim-acceptance"],
      snapshotId: "snapshot-1",
      recordedAt: timestamp,
      actor: "user",
    } as const;
    const impactArtifact = artifactEnvelope("impact", "impact-artifact-1", {
      paths: [impactPath],
    });
    const changeCheckArtifact = artifactEnvelope(
      "change_check",
      "change-check-artifact-1",
      {
        schemaVersion: 1,
        id: "change-check-1",
        taskId,
        taskRevision: baseManifest.revision,
        baselineSnapshotId: "snapshot-1",
        actualSnapshotId: "snapshot-1",
        findings: [],
        generatedAt: timestamp,
      },
    );
    const verificationArtifact = artifactEnvelope(
      "verification",
      "verification-artifact-1",
      { records: [verificationRecord] },
    );
    expect(ImpactArtifactV1Schema.safeParse(impactArtifact).success).toBe(true);
    expect(
      ChangeCheckArtifactV1Schema.safeParse(changeCheckArtifact).success,
    ).toBe(true);
    expect(
      VerificationArtifactV1Schema.safeParse(verificationArtifact).success,
    ).toBe(true);
    expect(
      ChangeCheckArtifactV1Schema.safeParse({
        ...changeCheckArtifact,
        sourceSnapshotId: "snapshot-2",
      }).success,
    ).toBe(false);
    expect(
      VerificationArtifactV1Schema.safeParse({
        ...verificationArtifact,
        payload: {
          records: [
            { ...verificationRecord, taskId: replacementTaskId },
          ],
        },
      }).success,
    ).toBe(false);
  });

  it("records skip acceptance separately from the initial skipped result", () => {
    const skipped = {
      id: "verification-1",
      taskId,
      verificationPlanEntryId: "verification-plan-1",
      attempt: 1,
      kind: "manual",
      status: "skipped",
      summary: "Covered by an authorized manual review.",
      claimIds: ["claim-acceptance"],
      snapshotId: "snapshot-1",
      recordedAt: timestamp,
      actor: "codex",
      skipAcceptance: {
        actor: "user",
        reason: "The manual review is authoritative.",
        acceptedAt: timestamp,
        eventId: "event-5",
      },
    } as const;
    expect(VerificationRecordV1Schema.safeParse(skipped).success).toBe(true);
    expect(
      VerificationRecordV1Schema.safeParse({
        ...skipped,
        skipAcceptance: undefined,
      }).success,
    ).toBe(true);
    expect(
      VerificationRecordV1Schema.safeParse({
        ...skipped,
        status: "passed",
      }).success,
    ).toBe(false);
  });

  it("rejects pre-populated skip acceptance in a record draft", () => {
    const input = {
      taskId,
      record: {
        verificationPlanEntryId: "verification-plan-1",
        kind: "manual",
        status: "skipped",
        summary: "Manual verification was not run.",
        claimIds: ["claim-acceptance"],
        snapshotId: "snapshot-1",
      },
      expectedRevision: baseManifest.revision,
      idempotencyKey: "record-verification-1",
      actor: "codex",
    } as const;
    expect(RecordVerificationInputV1Schema.safeParse(input).success).toBe(true);
    expect(
      RecordVerificationInputV1Schema.safeParse({
        ...input,
        record: {
          ...input.record,
          skipAcceptance: {
            actor: "user",
            reason: "This must be accepted by a later Task action.",
            acceptedAt: timestamp,
            eventId: "event-forged",
          },
        },
      }).success,
    ).toBe(false);
  });

  it("requires accepted skip only when closing a Task as verified", () => {
    expect(
      TaskArtifactBundleV1Schema.safeParse(verifiedBundle(true)).success,
    ).toBe(true);
    const result = TaskArtifactBundleV1Schema.safeParse(
      verifiedBundle(false),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes("latest final-snapshot attempt"),
        ),
      ).toBe(true);
    }
  });

  it("blocks verification on an unresolved blocking Finding", () => {
    const malformed = structuredClone(verifiedBundle(true));
    const findingId = "finding-blocking-1";
    const findingClaimId = "claim-finding-1";
    const sourceIndex = malformed.evidence.findIndex(
      (item) => item.id === "evidence-source",
    );
    malformed.evidence[sourceIndex] = {
      ...malformed.evidence[sourceIndex],
      claimIds: [
        ...malformed.evidence[sourceIndex].claimIds,
        findingClaimId,
      ],
    } as never;
    malformed.claims.push({
      id: findingClaimId,
      taskId,
      kind: "finding",
      statement: "A required verification remains unresolved.",
      epistemicStatus: "observed",
      lifecycleStatus: "supported",
      freshness: "current",
      sourceSnapshotId: "snapshot-1",
      evidenceIds: ["evidence-source"],
      findingIds: [findingId],
      verificationRecordIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    } as never);
    malformed.changeChecks[0].findings = [
      {
        id: findingId,
        type: "verification_gap",
        severity: "error",
        blocking: true,
        summary: "A required verification remains unresolved.",
        claimIds: [findingClaimId],
        plannedChangeIds: [],
        actualChangeIds: [],
        evidenceIds: ["evidence-source"],
        impactPathIds: [],
      },
    ];

    const result = TaskArtifactBundleV1Schema.safeParse(malformed);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes("blocking Finding"),
        ),
      ).toBe(true);
    }

    malformed.changeChecks[0].findings[0] = {
      ...malformed.changeChecks[0].findings[0],
      resolution: {
        kind: "fixed",
        resolvedAt: laterTimestamp,
        snapshotId: "snapshot-1",
        evidenceIds: ["evidence-source"],
      },
    };
    expect(TaskArtifactBundleV1Schema.safeParse(malformed).success).toBe(true);
  });

  it("accepts a higher passed attempt after a same-snapshot failure", () => {
    expect(
      TaskArtifactBundleV1Schema.safeParse(verifiedRetryBundle()).success,
    ).toBe(true);
  });
});

describe("Task Event and idempotency invariants", () => {
  it("requires one-revision Event increments and an integrity chain", () => {
    expect(TaskEventV1Schema.safeParse(events[0]).success).toBe(true);
    expect(
      TaskEventV1Schema.safeParse({
        ...events[1],
        revision: 3,
      }).success,
    ).toBe(false);
    expect(
      TaskEventV1Schema.safeParse({
        ...events[1],
        previousEventDigest: undefined,
      }).success,
    ).toBe(false);
  });

  it("requires one canonical genesis Event in full and contextless histories", () => {
    const truncatedFull = structuredClone(validBundle());
    truncatedFull.events = truncatedFull.events.slice(1);
    truncatedFull.idempotencyRecords =
      truncatedFull.idempotencyRecords.slice(1);
    expect(
      TaskArtifactBundleV1Schema.safeParse(truncatedFull).success,
    ).toBe(false);

    const contextlessEvents = [
      events[0],
      event(
        2,
        {
          type: "block_task",
          reasonCode: "dependency",
          message: "Waiting for repository context.",
        },
        "b",
        "created",
        "blocked",
      ),
    ];
    const contextless = {
      manifest: {
        ...baseManifest,
        status: "blocked",
        revision: 2,
        blockedState: {
          resumeStatus: "created",
          reasonCode: "dependency",
          message: "Waiting for repository context.",
          actor: "user",
          blockedAt: timestamp,
        },
      },
      events: contextlessEvents,
      idempotencyRecords: idempotencyRecordsFor(contextlessEvents),
    };
    expect(TaskArtifactBundleV1Schema.safeParse(contextless).success).toBe(
      true,
    );
    expect(
      TaskArtifactBundleV1Schema.safeParse({
        ...contextless,
        events: contextless.events.slice(1),
        idempotencyRecords: contextless.idempotencyRecords.slice(1),
      }).success,
    ).toBe(false);
  });

  it("keeps structural parsing distinct from trusted Event digest parsing", () => {
    const trusted = trustedBundle();
    expect(
      verifyTaskArtifactBundleIntegrityV1(
        TaskArtifactBundleV1Schema.parse(trusted),
        digestCanonicalJson,
      ),
    ).toEqual({ valid: true, issues: [] });
    expect(
      parseTrustedTaskArtifactBundleV1(trusted, digestCanonicalJson),
    ).toEqual(trusted);

    const tampered = structuredClone(trusted);
    tampered.events[4].actor = "attacker";
    tampered.idempotencyRecords[4].actor = "attacker";
    expect(TaskArtifactBundleV1Schema.safeParse(tampered).success).toBe(true);

    const integrity = verifyTaskArtifactBundleIntegrityV1(
      TaskArtifactBundleV1Schema.parse(tampered),
      digestCanonicalJson,
    );
    expect(integrity.valid).toBe(false);
    expect(integrity.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "event_digest_mismatch",
          eventIndex: 4,
        }),
      ]),
    );
    expect(() =>
      parseTrustedTaskArtifactBundleV1(tampered, digestCanonicalJson),
    ).toThrow(TaskArtifactBundleIntegrityErrorV1);
  });

  it("binds verification_recorded Event actor to the Verification record", () => {
    const malformed = structuredClone(verifiedBundle(true));
    const eventIndex = malformed.events.findIndex(
      (taskEvent) =>
        taskEvent.action.type === "verification_recorded" &&
        taskEvent.action.verificationRecordId === "verification-1",
    );
    malformed.events[eventIndex].actor = "another-agent";
    malformed.idempotencyRecords[eventIndex].actor = "another-agent";

    const result = TaskArtifactBundleV1Schema.safeParse(malformed);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes("snapshot, time, and actor"),
        ),
      ).toBe(true);
    }
  });

  it.each([
    [
      "change_checked",
      {
        type: "change_checked",
        changeCheckArtifactId: "change-check-artifact-1",
        changeCheckId: "change-check-1",
      },
      "context_ready",
      "check_required",
    ],
    [
      "verification_recorded",
      {
        type: "verification_recorded",
        verificationRecordId: "verification-1",
      },
      "check_required",
      "verification_required",
    ],
  ] as const)(
    "requires the frozen lifecycle source for %s",
    (actionType, action, invalidStatus, validStatus) => {
      const invalid = TaskEventV1Schema.safeParse(
        event(9, action, "9", invalidStatus, invalidStatus),
      );
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(
          invalid.error.issues.some((issue) =>
            issue.message.includes(`${actionType} requires`),
          ),
        ).toBe(true);
      }
      expect(
        TaskEventV1Schema.safeParse(
          event(9, action, "9", validStatus, validStatus),
        ).success,
      ).toBe(true);
    },
  );

  it.each([
    "2026-07-28T07:59:59Z",
    "2026-07-28T08:00:01Z",
  ])(
    "requires Verification recordedAt to equal its Event time (%s)",
    (recordedAt) => {
      const malformed = structuredClone(verifiedBundle(true));
      malformed.verificationRecords[0]!.recordedAt = recordedAt;
      const result = TaskArtifactBundleV1Schema.safeParse(malformed);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) =>
            issue.message.includes("snapshot, time, and actor"),
          ),
        ).toBe(true);
      }
    },
  );

  it("rejects a created-to-verified Event jump during lifecycle replay", () => {
    const jump = event(
      2,
      { type: "transition_status", to: "verified" },
      "b",
      "created",
      "verified",
    );
    const eventResult = TaskEventV1Schema.safeParse(jump);
    expect(eventResult.success).toBe(false);
    if (!eventResult.success) {
      expect(
        eventResult.error.issues.some((issue) =>
          issue.message.includes("ordinary Lifecycle V1 table"),
        ),
      ).toBe(true);
    }

    const malformed = structuredClone(validBundle());
    malformed.events[1] = jump as never;
    expect(TaskArtifactBundleV1Schema.safeParse(malformed).success).toBe(false);
  });

  it("binds idempotency records to their exact Event result", () => {
    expect(TaskArtifactBundleV1Schema.safeParse(validBundle()).success).toBe(
      true,
    );
    const malformed = structuredClone(validBundle());
    malformed.idempotencyRecords[1].requestDigest = digest("9");
    const result = TaskArtifactBundleV1Schema.safeParse(malformed);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes("must match its committed Event"),
        ),
      ).toBe(true);
    }
  });
});
