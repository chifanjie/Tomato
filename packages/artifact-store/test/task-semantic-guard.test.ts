import { afterEach, describe, expect, it } from "vitest";

import {
  ChangeCheckV1Schema,
  ClaimV1Schema,
  TaskEventV1Schema,
  TaskManifestArtifactV1Schema,
  TaskManifestV1Schema,
  TaskOperationReceiptV1Schema,
  VerificationRecordV1Schema,
  canonicalTaskEventDigestJsonV1,
  parsePersistedArtifactV1,
  type ChangeCheckV1,
  type ClaimV1,
  type EvidenceV1,
  type IdempotencyRecordV1,
  type ImpactPathV1,
  type PersistedArtifactV1,
  type TaskArtifactBundleV1,
  type TaskBriefV1,
  type TaskEventActionV1,
  type TaskEventV1,
  type TaskManifestV1,
  type TaskOperationReceiptV1,
  type VerificationRecordV1,
} from "@understand-code/contracts";

import {
  ArtifactStore,
  sha256Bytes,
  sha256CanonicalJson,
  type PersistTaskBundleInput,
  type PersistTaskBundleOptions,
  type ReadTaskBundleResult,
} from "../src/index.js";
import {
  cleanupTemporaryWorktrees,
  createTemporaryWorktree,
  FIXTURE_PRODUCER_VERSION,
  FIXTURE_REPOSITORY_ID,
  FIXTURE_TASK_ID,
  FIXTURE_WORKTREE_ID,
  loadContractFixture,
  loadRepoPulse,
  loadRepositorySnapshot,
  openFixtureStore,
} from "./helpers.js";

afterEach(cleanupTemporaryWorktrees);

const SNAPSHOT_ID = "snapshot:actual";
const NEXT_SNAPSHOT_ID = "snapshot:actual-next";
const CREATED_AT = "2026-07-30T08:00:00Z";
const CONTEXT_AT = "2026-07-30T08:01:00Z";
const ACTOR = "codex";

const ARTIFACT_IDS = {
  task_manifest: "artifact:task-manifest",
  task_brief: "artifact:task-brief",
  claim_ledger: "artifact:claim-ledger",
  evidence_ledger: "artifact:evidence-ledger",
  impact: "artifact:impact",
  task_operation_journal: "artifact:task-operation-journal",
  change_check: "artifact:change-check",
  verification: "artifact:verification",
} as const;

type ContextualBundle = Extract<
  TaskArtifactBundleV1,
  { brief: TaskBriefV1 }
>;

type ContextualRead = Omit<ReadTaskBundleResult, "bundle"> & {
  bundle: ContextualBundle;
};

interface Candidate {
  input: PersistTaskBundleInput;
  options: PersistTaskBundleOptions;
}

interface ArtifactBuildInput {
  manifest: TaskManifestV1;
  brief?: TaskBriefV1;
  claims?: readonly ClaimV1[];
  evidence?: readonly EvidenceV1[];
  impactPaths?: readonly ImpactPathV1[];
  changeCheck?: ChangeCheckV1;
  verificationRecords?: readonly VerificationRecordV1[];
  idempotencyRecords: readonly IdempotencyRecordV1[];
  receipts: readonly TaskOperationReceiptV1[];
  createdAt: string;
}

interface CheckDraft {
  changeCheck: ChangeCheckV1;
  receiptChangeCheck: ChangeCheckV1;
  claims: ClaimV1[];
  evidence: EvidenceV1[];
  impactPaths: ImpactPathV1[];
}

interface VerificationDraft {
  verification: VerificationRecordV1;
  receiptVerification: VerificationRecordV1;
  verificationRecords: VerificationRecordV1[];
  claims: ClaimV1[];
}

function assertContextual(
  read: ReadTaskBundleResult,
): asserts read is ContextualRead {
  if (!("brief" in read.bundle)) {
    throw new TypeError("The semantic guard fixture must be contextual.");
  }
}

function envelope(
  manifest: TaskManifestV1,
  artifactType: keyof typeof ARTIFACT_IDS,
  payload: unknown,
  createdAt: string,
): PersistedArtifactV1 {
  return parsePersistedArtifactV1({
    schemaVersion: 1,
    artifactType,
    artifactId: ARTIFACT_IDS[artifactType],
    repositoryId: manifest.repositoryId,
    worktreeId: manifest.worktreeId,
    sourceSnapshotId: manifest.latestSnapshotId,
    taskId: manifest.taskId,
    revision: manifest.revision,
    producerVersion: manifest.producerVersion,
    createdAt,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

function buildArtifacts(input: ArtifactBuildInput): PersistedArtifactV1[] {
  const artifacts = [
    envelope(
      input.manifest,
      "task_manifest",
      input.manifest,
      input.createdAt,
    ),
  ];
  if (input.brief !== undefined) {
    artifacts.push(
      envelope(
        input.manifest,
        "task_brief",
        input.brief,
        input.createdAt,
      ),
      envelope(
        input.manifest,
        "claim_ledger",
        { claims: [...(input.claims ?? [])] },
        input.createdAt,
      ),
      envelope(
        input.manifest,
        "evidence_ledger",
        { evidence: [...(input.evidence ?? [])] },
        input.createdAt,
      ),
      envelope(
        input.manifest,
        "impact",
        { paths: [...(input.impactPaths ?? [])] },
        input.createdAt,
      ),
    );
  }
  artifacts.push(
    envelope(
      input.manifest,
      "task_operation_journal",
      {
        idempotencyRecords: [...input.idempotencyRecords],
        receipts: [...input.receipts],
      },
      input.createdAt,
    ),
  );
  if (input.changeCheck !== undefined) {
    artifacts.push(
      envelope(
        input.manifest,
        "change_check",
        input.changeCheck,
        input.createdAt,
      ),
    );
  }
  if (input.verificationRecords !== undefined) {
    artifacts.push(
      envelope(
        input.manifest,
        "verification",
        { records: [...input.verificationRecords] },
        input.createdAt,
      ),
    );
  }
  return artifacts;
}

function taskManifest(
  reference: TaskManifestV1,
  revision: number,
  status: "created" | "context_ready",
  updatedAt: string,
): TaskManifestV1 {
  const {
    currentChangeCheckId: _currentChangeCheckId,
    currentChangeCheckRevision: _currentChangeCheckRevision,
    blockedState: _blockedState,
    staleState: _staleState,
    supersession: _supersession,
    ...base
  } = reference;
  return TaskManifestV1Schema.parse({
    ...base,
    status,
    revision,
    updatedAt,
  });
}

function buildEvent(input: {
  manifest: TaskManifestV1;
  previousManifest?: TaskManifestV1;
  previousEvent?: TaskEventV1;
  action: TaskEventActionV1;
  idempotencyKey: string;
  requestDigest: string;
  occurredAt: string;
  sourceSnapshotId?: string;
}): TaskEventV1 {
  const placeholder = TaskEventV1Schema.parse({
    schemaVersion: 1,
    eventId: `event:${FIXTURE_TASK_ID}:${input.manifest.revision}`,
    repositoryId: FIXTURE_REPOSITORY_ID,
    worktreeId: FIXTURE_WORKTREE_ID,
    taskId: FIXTURE_TASK_ID,
    previousRevision: input.manifest.revision - 1,
    revision: input.manifest.revision,
    actor: ACTOR,
    idempotencyKey: input.idempotencyKey,
    requestDigest: input.requestDigest,
    sourceSnapshotId: input.sourceSnapshotId ?? SNAPSHOT_ID,
    occurredAt: input.occurredAt,
    ...(input.previousManifest === undefined
      ? {}
      : { previousStatus: input.previousManifest.status }),
    resultingStatus: input.manifest.status,
    action: input.action,
    ...(input.previousEvent === undefined
      ? {}
      : { previousEventDigest: input.previousEvent.eventDigest }),
    eventDigest: sha256Bytes("semantic-guard-placeholder"),
  });
  return TaskEventV1Schema.parse({
    ...placeholder,
    eventDigest: sha256Bytes(
      canonicalTaskEventDigestJsonV1(placeholder),
    ),
  });
}

function mutationResult(
  manifest: TaskManifestV1,
  event: TaskEventV1,
  artifactIds: readonly string[],
) {
  return {
    taskId: manifest.taskId,
    revision: manifest.revision,
    eventId: event.eventId,
    artifactIds: [...artifactIds],
    idempotentReplay: false,
  };
}

function recordFor(
  event: TaskEventV1,
  resultDigest: string,
  scope:
    | { kind: "task_create"; createScope: string }
    | { kind: "task"; taskId: string },
): IdempotencyRecordV1 {
  return {
    schemaVersion: 1,
    worktreeId: FIXTURE_WORKTREE_ID,
    scope,
    idempotencyKey: event.idempotencyKey,
    actor: event.actor,
    requestDigest: event.requestDigest,
    taskId: event.taskId,
    resultRevision: event.revision,
    eventId: event.eventId,
    resultDigest,
    createdAt: event.occurredAt,
  };
}

function contextualPayload(
  originalIntent: string,
  sourceSnapshotId: string = SNAPSHOT_ID,
) {
  const brief: TaskBriefV1 = {
    originalIntent,
    goalClaimId: "claim:goal",
    nonGoalClaimIds: [],
    acceptanceClaimIds: ["claim:acceptance"],
    readingPath: [
      {
        id: "reading:task",
        order: 0,
        kind: "symbol",
        filePath: "src/task.ts",
        symbolId: "symbol:task-handler",
        claimIds: ["claim:recommendation"],
        evidenceIds: ["evidence:source"],
      },
    ],
    plannedChanges: [
      {
        id: "planned-change:task",
        candidateLevel: "likely_change",
        filePath: "src/task.ts",
        symbolId: "symbol:task-handler",
        intent: "Keep semantic history append-only.",
        claimIds: ["claim:recommendation"],
        impactPathIds: ["impact:task-to-consumer"],
      },
    ],
    assumptionClaimIds: [],
    riskClaimIds: [],
    unknownClaimIds: [],
    verificationPlan: [
      {
        id: "verification-plan:contracts",
        acceptanceClaimIds: ["claim:acceptance"],
        method: "test",
        description: "Run the semantic guard suite.",
        required: true,
      },
    ],
  };
  const claims: ClaimV1[] = [
    {
      id: "claim:goal",
      taskId: FIXTURE_TASK_ID,
      kind: "goal",
      statement: "Task history remains trustworthy.",
      epistemicStatus: "unknown",
      lifecycleStatus: "draft",
      freshness: "current",
      sourceSnapshotId,
      evidenceIds: [],
      findingIds: [],
      verificationRecordIds: [],
      boundaryReason: "Owner confirmation is pending.",
      createdAt: CREATED_AT,
      updatedAt: CONTEXT_AT,
    },
    {
      id: "claim:acceptance",
      taskId: FIXTURE_TASK_ID,
      kind: "acceptance",
      statement: "Semantic rewrites are rejected.",
      epistemicStatus: "unknown",
      lifecycleStatus: "draft",
      freshness: "current",
      sourceSnapshotId,
      evidenceIds: [],
      findingIds: [],
      verificationRecordIds: [],
      boundaryReason: "Verification has not run.",
      createdAt: CREATED_AT,
      updatedAt: CONTEXT_AT,
    },
    {
      id: "claim:recommendation",
      taskId: FIXTURE_TASK_ID,
      kind: "recommendation",
      statement: "Bind semantic transitions to trusted receipts.",
      epistemicStatus: "observed",
      lifecycleStatus: "supported",
      freshness: "current",
      sourceSnapshotId,
      evidenceIds: ["evidence:source"],
      findingIds: [],
      verificationRecordIds: [],
      createdAt: CREATED_AT,
      updatedAt: CONTEXT_AT,
    },
  ];
  const evidence: EvidenceV1[] = [
    {
      id: "evidence:source",
      kind: "source",
      epistemicStatus: "observed",
      freshness: "current",
      claimIds: ["claim:recommendation"],
      nodeIds: ["symbol:task-handler"],
      producedBy: "core",
      createdAt: CREATED_AT,
      observedAtSnapshotId: sourceSnapshotId,
      filePath: "src/task.ts",
      lineRange: [10, 24],
      contentHash: sha256Bytes("semantic task handler"),
    },
  ];
  const impactPaths: ImpactPathV1[] = [
    {
      id: "impact:task-to-consumer",
      sourceNodeId: "symbol:task-handler",
      targetNodeId: "symbol:agent-consumer",
      classification: "observed",
      claimIds: ["claim:recommendation"],
      steps: [
        {
          source: "symbol:task-handler",
          edgeType: "calls",
          target: "symbol:agent-consumer",
          direction: "downstream",
          evidenceId: "evidence:source",
          confidence: "exact",
        },
      ],
    },
  ];
  return { brief, claims, evidence, impactPaths };
}

async function nextRepositorySnapshot(): Promise<PersistedArtifactV1> {
  const current = await loadRepositorySnapshot();
  if (current.artifactType !== "repository_snapshot") {
    throw new TypeError("A Repository Snapshot fixture is required.");
  }
  const createdAt = "2026-07-30T08:01:07Z";
  const payload = {
    ...current.payload,
    snapshotId: NEXT_SNAPSHOT_ID,
    createdAt,
  };
  return parsePersistedArtifactV1({
    ...current,
    artifactId: "artifact:repository-snapshot-next",
    sourceSnapshotId: NEXT_SNAPSHOT_ID,
    createdAt,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

async function nextRepoPulse(
  options: {
    sourceSnapshotId?: string;
    baselineSnapshotId?: string;
    identitySuffix?: string;
  } = {},
): Promise<PersistedArtifactV1> {
  const current = await loadRepoPulse();
  const createdAt = "2026-07-30T08:01:08Z";
  const sourceSnapshotId =
    options.sourceSnapshotId ?? NEXT_SNAPSHOT_ID;
  const baselineSnapshotId =
    options.baselineSnapshotId ??
    current.payload.baselineSnapshotId;
  const identitySuffix =
    options.identitySuffix ??
    sourceSnapshotId.replace(/[^a-z0-9-]+/giu, "-");
  const payload = {
    ...current.payload,
    evaluatedSnapshotId: sourceSnapshotId,
    baselineSnapshotId,
    evaluatedAt: createdAt,
  };
  return parsePersistedArtifactV1({
    ...current,
    artifactId: `artifact:repo-pulse:${identitySuffix}`,
    sourceSnapshotId,
    revision: current.revision + 1,
    createdAt,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

async function setupContextualTask(
  targetStatus: "context_ready" | "check_required" = "check_required",
  contextSnapshotId: string = SNAPSHOT_ID,
): Promise<{
  store: ArtifactStore;
  current: ContextualRead;
}> {
  const root = await createTemporaryWorktree(
    "artifact-store-semantic-guard-",
  );
  const store = await openFixtureStore(root);
  await store.persistArtifact(await loadRepositorySnapshot());
  await store.persistArtifact(await loadRepoPulse());

  const referenceArtifact =
    await loadContractFixture<
      ReturnType<typeof TaskManifestArtifactV1Schema.parse>
    >("reference/task.json");
  const createdManifest = taskManifest(
    referenceArtifact.payload,
    1,
    "created",
    CREATED_AT,
  );
  const createdDigest = sha256CanonicalJson({
    operation: "task_created",
    taskId: FIXTURE_TASK_ID,
  });
  const createdEvent = buildEvent({
    manifest: createdManifest,
    action: { type: "task_created" },
    idempotencyKey: "semantic-guard-create",
    requestDigest: createdDigest,
    occurredAt: CREATED_AT,
  });
  const createdResult = {
    task: createdManifest,
    mutation: mutationResult(createdManifest, createdEvent, [
      ARTIFACT_IDS.task_manifest,
      ARTIFACT_IDS.task_operation_journal,
    ]),
  };
  const createdReceipt = TaskOperationReceiptV1Schema.parse({
    schemaVersion: 1,
    operation: "task_created",
    taskId: FIXTURE_TASK_ID,
    eventId: createdEvent.eventId,
    resultDigest: sha256CanonicalJson(createdResult),
    result: createdResult,
  });
  const createdRecord = recordFor(
    createdEvent,
    createdReceipt.resultDigest,
    { kind: "task_create", createScope: "build_task_brief" },
  );
  await store.persistTaskBundle(
    {
      artifacts: buildArtifacts({
        manifest: createdManifest,
        idempotencyRecords: [createdRecord],
        receipts: [createdReceipt],
        createdAt: CREATED_AT,
      }),
      events: [createdEvent],
      idempotencyRecords: [createdRecord],
    },
    {
      expectedRevision: 0,
      idempotencyKey: createdEvent.idempotencyKey,
      requestDigest: createdEvent.requestDigest,
    },
  );

  if (contextSnapshotId !== SNAPSHOT_ID) {
    await store.persistArtifact(await nextRepositorySnapshot());
    await store.persistArtifact(await nextRepoPulse(), {
      expectedRevision: 0,
    });
  }

  const { brief, claims, evidence, impactPaths } = contextualPayload(
    referenceArtifact.payload.originalIntent,
    contextSnapshotId,
  );
  const contextManifest = TaskManifestV1Schema.parse({
    ...taskManifest(
      referenceArtifact.payload,
      2,
      "context_ready",
      CONTEXT_AT,
    ),
    latestSnapshotId: contextSnapshotId,
  });
  const contextDigest = sha256CanonicalJson({
    operation: "build_task_brief",
    taskId: FIXTURE_TASK_ID,
  });
  const contextEvent = buildEvent({
    manifest: contextManifest,
    previousManifest: createdManifest,
    previousEvent: createdEvent,
    action: { type: "transition_status", to: "context_ready" },
    idempotencyKey: "semantic-guard-context",
    requestDigest: contextDigest,
    occurredAt: CONTEXT_AT,
    sourceSnapshotId: contextSnapshotId,
  });
  const contextResult = {
    task: contextManifest,
    mutation: mutationResult(contextManifest, contextEvent, [
      ARTIFACT_IDS.task_manifest,
      ARTIFACT_IDS.task_brief,
      ARTIFACT_IDS.claim_ledger,
      ARTIFACT_IDS.evidence_ledger,
      ARTIFACT_IDS.impact,
      ARTIFACT_IDS.task_operation_journal,
    ]),
    brief,
    claimIds: claims.map((claim) => claim.id),
    evidenceIds: evidence.map((item) => item.id),
  };
  const contextReceipt = TaskOperationReceiptV1Schema.parse({
    schemaVersion: 1,
    operation: "build_task_brief",
    taskId: FIXTURE_TASK_ID,
    eventId: contextEvent.eventId,
    resultDigest: sha256CanonicalJson(contextResult),
    result: contextResult,
  });
  const contextRecord = recordFor(
    contextEvent,
    contextReceipt.resultDigest,
    { kind: "task_create", createScope: "build_task_brief" },
  );
  const records = [createdRecord, contextRecord];
  const receipts = [createdReceipt, contextReceipt];
  await store.persistTaskBundle(
    {
      artifacts: buildArtifacts({
        manifest: contextManifest,
        brief,
        claims,
        evidence,
        impactPaths,
        idempotencyRecords: records,
        receipts,
        createdAt: CONTEXT_AT,
      }),
      events: [createdEvent, contextEvent],
      idempotencyRecords: records,
    },
    {
      expectedRevision: 1,
      idempotencyKey: contextEvent.idempotencyKey,
      requestDigest: contextEvent.requestDigest,
    },
  );
  let current = await store.readTaskBundle(FIXTURE_TASK_ID);
  assertContextual(current);
  if (targetStatus === "check_required") {
    for (const status of [
      "planned",
      "in_progress",
      "check_required",
    ] as const) {
      await persistCandidate(store, transitionCandidate(current, status));
      current = await store.readTaskBundle(FIXTURE_TASK_ID);
      assertContextual(current);
    }
  }
  return { store, current };
}

function transitionCandidate(
  current: ContextualRead,
  to: "planned" | "in_progress" | "check_required" | "verification_required",
  sourceSnapshotId: string = current.bundle.manifest.latestSnapshotId,
): Candidate {
  const revision = current.bundle.manifest.revision + 1;
  const occurredAt = new Date(
    Date.parse(current.bundle.manifest.updatedAt) + 1_000,
  ).toISOString();
  const currentCheck = current.bundle.changeChecks.at(-1);
  const {
    currentChangeCheckId: _currentChangeCheckId,
    currentChangeCheckRevision: _currentChangeCheckRevision,
    blockedState: _blockedState,
    staleState: _staleState,
    supersession: _supersession,
    ...withoutCurrentCheck
  } = current.bundle.manifest;
  const manifest = TaskManifestV1Schema.parse({
    ...withoutCurrentCheck,
    status: to,
    latestSnapshotId: sourceSnapshotId,
    revision,
    updatedAt: occurredAt,
    ...(to === "verification_required"
      ? {
          currentChangeCheckId: currentCheck?.id,
          currentChangeCheckRevision: currentCheck?.taskRevision,
        }
      : {}),
  });
  const idempotencyKey = `semantic-guard-transition-${to}-${revision}`;
  const requestDigest = sha256CanonicalJson({
    operation: "transition_status",
    taskId: FIXTURE_TASK_ID,
    to,
    sourceSnapshotId,
    revision,
  });
  const event = buildEvent({
    manifest,
    previousManifest: current.bundle.manifest,
    previousEvent: current.bundle.events.at(-1),
    action: { type: "transition_status", to },
    idempotencyKey,
    requestDigest,
    occurredAt,
    sourceSnapshotId,
  });
  const result = {
    task: manifest,
    mutation: mutationResult(
      manifest,
      event,
      current.artifacts.map((artifact) => artifact.artifactId),
    ),
  };
  const receipt = TaskOperationReceiptV1Schema.parse({
    schemaVersion: 1,
    operation: "update_task",
    taskId: FIXTURE_TASK_ID,
    eventId: event.eventId,
    resultDigest: sha256CanonicalJson(result),
    result,
  });
  const record = recordFor(event, receipt.resultDigest, {
    kind: "task",
    taskId: FIXTURE_TASK_ID,
  });
  const records = [...current.bundle.idempotencyRecords, record];
  const receipts = [...current.receipts, receipt];
  return {
    input: {
      artifacts: buildArtifacts({
        manifest,
        brief: current.bundle.brief,
        claims: current.bundle.claims,
        evidence: current.bundle.evidence,
        impactPaths: current.bundle.impactPaths,
        ...(currentCheck === undefined ? {} : { changeCheck: currentCheck }),
        verificationRecords: current.artifacts.some(
          (artifact) => artifact.artifactType === "verification",
        )
          ? current.bundle.verificationRecords
          : undefined,
        idempotencyRecords: records,
        receipts,
        createdAt: occurredAt,
      }),
      events: [...current.bundle.events, event],
      idempotencyRecords: records,
    },
    options: {
      expectedRevision: current.bundle.manifest.revision,
      idempotencyKey,
      requestDigest,
    },
  };
}

async function advanceToVerificationRequired(
  store: ArtifactStore,
  current: ContextualRead,
): Promise<ContextualRead> {
  await persistCandidate(store, checkCandidate(current));
  const checked = await store.readTaskBundle(FIXTURE_TASK_ID);
  assertContextual(checked);
  await persistCandidate(
    store,
    transitionCandidate(checked, "verification_required"),
  );
  const verificationRequired = await store.readTaskBundle(FIXTURE_TASK_ID);
  assertContextual(verificationRequired);
  return verificationRequired;
}

function checkCandidate(
  current: ContextualRead,
  mutate: (draft: CheckDraft) => void = () => undefined,
): Candidate {
  const revision = current.bundle.manifest.revision + 1;
  const occurredAt = new Date(
    Date.parse(current.bundle.manifest.updatedAt) + 1_000,
  ).toISOString();
  const manifest = TaskManifestV1Schema.parse({
    ...current.bundle.manifest,
    revision,
    updatedAt: occurredAt,
  });
  const supportingEvidence = current.bundle.evidence.find(
    (item) =>
      item.epistemicStatus === "observed" &&
      item.freshness === "current",
  );
  if (supportingEvidence === undefined) {
    throw new TypeError("Observed Evidence is required.");
  }
  const findingId = `finding:${FIXTURE_TASK_ID}:${revision}`;
  const findingClaim = ClaimV1Schema.parse({
    id: `claim:finding:${FIXTURE_TASK_ID}:${revision}`,
    taskId: FIXTURE_TASK_ID,
    kind: "finding",
    statement: "The semantic guard captured a snapshot-bound Finding.",
    epistemicStatus: "observed",
    lifecycleStatus: "supported",
    freshness: "current",
    sourceSnapshotId: SNAPSHOT_ID,
    evidenceIds: [supportingEvidence.id],
    findingIds: [findingId],
    verificationRecordIds: [],
    createdAt: occurredAt,
    updatedAt: occurredAt,
  });
  const changeCheck = ChangeCheckV1Schema.parse({
    schemaVersion: 1,
    id: `change-check:${FIXTURE_TASK_ID}:${revision}`,
    taskId: FIXTURE_TASK_ID,
    taskRevision: revision,
    baselineSnapshotId: manifest.baselineSnapshotId,
    actualSnapshotId: manifest.latestSnapshotId,
    findings: [
      {
        id: findingId,
        type: "cannot_determine",
        severity: "warning",
        blocking: false,
        summary: "The current Snapshot requires explicit review.",
        claimIds: [findingClaim.id],
        plannedChangeIds: [],
        actualChangeIds: [],
        evidenceIds: [supportingEvidence.id],
        impactPathIds: [],
      },
    ],
    generatedAt: occurredAt,
  });
  const draft: CheckDraft = {
    changeCheck: structuredClone(changeCheck),
    receiptChangeCheck: structuredClone(changeCheck),
    claims: [...structuredClone(current.bundle.claims), findingClaim],
    evidence: structuredClone(current.bundle.evidence).map((item) =>
      item.id === supportingEvidence.id
        ? {
            ...item,
            claimIds: [...item.claimIds, findingClaim.id],
          }
        : item,
    ),
    impactPaths: structuredClone(current.bundle.impactPaths),
  };
  mutate(draft);
  const parsedCheck = ChangeCheckV1Schema.parse(draft.changeCheck);
  const parsedReceiptCheck = ChangeCheckV1Schema.parse(
    draft.receiptChangeCheck,
  );
  const idempotencyKey = `semantic-guard-check-${revision}`;
  const requestDigest = sha256CanonicalJson({
    operation: "check_change",
    taskId: FIXTURE_TASK_ID,
    revision,
  });
  const event = buildEvent({
    manifest,
    previousManifest: current.bundle.manifest,
    previousEvent: current.bundle.events.at(-1),
    action: {
      type: "change_checked",
      changeCheckArtifactId: ARTIFACT_IDS.change_check,
      changeCheckId: parsedCheck.id,
    },
    idempotencyKey,
    requestDigest,
    occurredAt,
  });
  const result = {
    changeCheck: parsedReceiptCheck,
    mutation: mutationResult(manifest, event, [
      ...current.artifacts.map((artifact) => artifact.artifactId),
      ARTIFACT_IDS.change_check,
    ]),
  };
  const receipt = TaskOperationReceiptV1Schema.parse({
    schemaVersion: 1,
    operation: "check_change",
    taskId: FIXTURE_TASK_ID,
    eventId: event.eventId,
    resultDigest: sha256CanonicalJson(result),
    result,
  });
  const record = recordFor(event, receipt.resultDigest, {
    kind: "task",
    taskId: FIXTURE_TASK_ID,
  });
  const records = [...current.bundle.idempotencyRecords, record];
  const receipts = [...current.receipts, receipt];
  return {
    input: {
      artifacts: buildArtifacts({
        manifest,
        brief: current.bundle.brief,
        claims: draft.claims,
        evidence: draft.evidence,
        impactPaths: draft.impactPaths,
        changeCheck: parsedCheck,
        verificationRecords: current.artifacts.some(
          (artifact) => artifact.artifactType === "verification",
        )
          ? current.bundle.verificationRecords
          : undefined,
        idempotencyRecords: records,
        receipts,
        createdAt: occurredAt,
      }),
      events: [...current.bundle.events, event],
      idempotencyRecords: records,
    },
    options: {
      expectedRevision: current.bundle.manifest.revision,
      idempotencyKey,
      requestDigest,
    },
  };
}

function verificationCandidate(
  current: ContextualRead,
  mutate: (draft: VerificationDraft) => void = () => undefined,
): Candidate {
  const revision = current.bundle.manifest.revision + 1;
  const occurredAt = new Date(
    Date.parse(current.bundle.manifest.updatedAt) + 1_000,
  ).toISOString();
  const manifest = TaskManifestV1Schema.parse({
    ...current.bundle.manifest,
    revision,
    updatedAt: occurredAt,
  });
  const plan = current.bundle.brief.verificationPlan[0];
  const acceptanceClaimId = plan?.acceptanceClaimIds[0];
  if (
    plan === undefined ||
    acceptanceClaimId === undefined ||
    !current.bundle.claims.some((claim) => claim.id === acceptanceClaimId)
  ) {
    throw new TypeError("An acceptance Claim and plan are required.");
  }
  const previous = current.bundle.verificationRecords
    .filter(
      (record) => record.verificationPlanEntryId === plan.id,
    )
    .at(-1);
  const verification = VerificationRecordV1Schema.parse({
    id: `verification:${FIXTURE_TASK_ID}:${revision}`,
    taskId: FIXTURE_TASK_ID,
    verificationPlanEntryId: plan.id,
    attempt: (previous?.attempt ?? 0) + 1,
    ...(previous === undefined
      ? {}
      : { supersedesVerificationRecordId: previous.id }),
    kind: plan.method,
    status: "passed",
    command: "pnpm test",
    exitCode: 0,
    durationMs: 10,
    summary: `Semantic guard verification attempt ${revision} passed.`,
    claimIds: [acceptanceClaimId],
    snapshotId: manifest.latestSnapshotId,
    recordedAt: occurredAt,
    actor: ACTOR,
  });
  const draft: VerificationDraft = {
    verification,
    receiptVerification: structuredClone(verification),
    verificationRecords: [
      ...structuredClone(current.bundle.verificationRecords),
      verification,
    ],
    claims: structuredClone(current.bundle.claims).map((claim) =>
      claim.id === acceptanceClaimId
        ? {
            ...claim,
            verificationRecordIds: [
              ...claim.verificationRecordIds,
              verification.id,
            ],
          }
        : claim,
    ),
  };
  mutate(draft);
  const parsedVerificationRecords = draft.verificationRecords.map(
    (record) => VerificationRecordV1Schema.parse(record),
  );
  const parsedReceiptVerification = VerificationRecordV1Schema.parse(
    draft.receiptVerification,
  );
  const idempotencyKey = `semantic-guard-verification-${revision}`;
  const requestDigest = sha256CanonicalJson({
    operation: "record_verification",
    taskId: FIXTURE_TASK_ID,
    verificationRecordId: draft.verification.id,
  });
  const event = buildEvent({
    manifest,
    previousManifest: current.bundle.manifest,
    previousEvent: current.bundle.events.at(-1),
    action: {
      type: "verification_recorded",
      verificationRecordId: draft.verification.id,
    },
    idempotencyKey,
    requestDigest,
    occurredAt,
  });
  const result = {
    verification: parsedReceiptVerification,
    mutation: mutationResult(manifest, event, [
      ...current.artifacts.map((artifact) => artifact.artifactId),
      ...(current.artifacts.some(
        (artifact) => artifact.artifactType === "verification",
      )
        ? []
        : [ARTIFACT_IDS.verification]),
    ]),
  };
  const receipt = TaskOperationReceiptV1Schema.parse({
    schemaVersion: 1,
    operation: "record_verification",
    taskId: FIXTURE_TASK_ID,
    eventId: event.eventId,
    resultDigest: sha256CanonicalJson(result),
    result,
  });
  const record = recordFor(event, receipt.resultDigest, {
    kind: "task",
    taskId: FIXTURE_TASK_ID,
  });
  const records = [...current.bundle.idempotencyRecords, record];
  const receipts = [...current.receipts, receipt];
  const currentCheck = current.bundle.changeChecks.at(-1);
  if (currentCheck === undefined) {
    throw new TypeError("A Change Check is required.");
  }
  return {
    input: {
      artifacts: buildArtifacts({
        manifest,
        brief: current.bundle.brief,
        claims: draft.claims,
        evidence: current.bundle.evidence,
        impactPaths: current.bundle.impactPaths,
        changeCheck: currentCheck,
        verificationRecords: parsedVerificationRecords,
        idempotencyRecords: records,
        receipts,
        createdAt: occurredAt,
      }),
      events: [...current.bundle.events, event],
      idempotencyRecords: records,
    },
    options: {
      expectedRevision: current.bundle.manifest.revision,
      idempotencyKey,
      requestDigest,
    },
  };
}

function staleCleanupCandidate(
  current: ContextualRead,
  retain: "both" | "check" | "verification" | "none",
  sourceSnapshotId: string = current.bundle.manifest.latestSnapshotId,
): Candidate {
  const revision = current.bundle.manifest.revision + 1;
  const occurredAt = new Date(
    Date.parse(current.bundle.manifest.updatedAt) + 1_000,
  ).toISOString();
  const {
    currentChangeCheckId: _currentChangeCheckId,
    currentChangeCheckRevision: _currentChangeCheckRevision,
    blockedState: _blockedState,
    staleState: _staleState,
    supersession: _supersession,
    ...withoutCurrentCheck
  } = current.bundle.manifest;
  const manifest = TaskManifestV1Schema.parse({
    ...withoutCurrentCheck,
    status: "stale",
    latestSnapshotId: sourceSnapshotId,
    revision,
    updatedAt: occurredAt,
    staleState: {
      staleFromStatus: current.bundle.manifest.status,
      reasonCodes: ["artifact_freshness_invalid"],
      detectedAtSnapshotId: sourceSnapshotId,
      detectedAt: occurredAt,
    },
  });
  const keepCheck = retain === "both" || retain === "check";
  const keepVerification = retain === "both" || retain === "verification";
  const removedFindingIds = keepCheck
    ? new Set<string>()
    : new Set(
        current.bundle.changeChecks.flatMap((check) =>
          check.findings.map((finding) => finding.id),
        ),
      );
  const removedVerificationIds = keepVerification
    ? new Set<string>()
    : new Set(
        current.bundle.verificationRecords.map((record) => record.id),
      );
  const claims = current.bundle.claims.map((claim) => ({
    ...claim,
    findingIds: claim.findingIds.filter(
      (findingId) => !removedFindingIds.has(findingId),
    ),
    verificationRecordIds: claim.verificationRecordIds.filter(
      (recordId) => !removedVerificationIds.has(recordId),
    ),
  }));
  const idempotencyKey = `semantic-guard-stale-${retain}-${revision}`;
  const requestDigest = sha256CanonicalJson({
    operation: "task_context_staled",
    taskId: FIXTURE_TASK_ID,
    revision,
    retain,
  });
  const event = buildEvent({
    manifest,
    previousManifest: current.bundle.manifest,
    previousEvent: current.bundle.events.at(-1),
    action: {
      type: "task_context_staled",
      reasonCodes: ["artifact_freshness_invalid"],
      detectedAtSnapshotId: sourceSnapshotId,
    },
    idempotencyKey,
    requestDigest,
    occurredAt,
    sourceSnapshotId,
  });
  const result = {
    task: manifest,
    mutation: mutationResult(
      manifest,
      event,
      current.artifacts.map((artifact) => artifact.artifactId),
    ),
  };
  const receipt = TaskOperationReceiptV1Schema.parse({
    schemaVersion: 1,
    operation: "update_task",
    taskId: FIXTURE_TASK_ID,
    eventId: event.eventId,
    resultDigest: sha256CanonicalJson(result),
    result,
  });
  const record = recordFor(event, receipt.resultDigest, {
    kind: "task",
    taskId: FIXTURE_TASK_ID,
  });
  const records = [...current.bundle.idempotencyRecords, record];
  const receipts = [...current.receipts, receipt];
  const currentCheck = current.bundle.changeChecks.at(-1);
  return {
    input: {
      artifacts: buildArtifacts({
        manifest,
        brief: current.bundle.brief,
        claims,
        evidence: current.bundle.evidence,
        impactPaths: current.bundle.impactPaths,
        ...(keepCheck && currentCheck !== undefined
          ? { changeCheck: currentCheck }
          : {}),
        ...(keepVerification
          ? { verificationRecords: current.bundle.verificationRecords }
          : {}),
        idempotencyRecords: records,
        receipts,
        createdAt: occurredAt,
      }),
      events: [...current.bundle.events, event],
      idempotencyRecords: records,
    },
    options: {
      expectedRevision: current.bundle.manifest.revision,
      idempotencyKey,
      requestDigest,
    },
  };
}

function snapshotAdvanceCheckCandidate(
  current: ContextualRead,
  retain: "both" | "check" | "verification" | "none",
): Candidate {
  if (
    current.bundle.manifest.status !== "in_progress" &&
    current.bundle.manifest.status !== "verification_required"
  ) {
    throw new TypeError(
      "Snapshot alignment must start from in_progress or verification_required.",
    );
  }
  const revision = current.bundle.manifest.revision + 1;
  const occurredAt = new Date(
    Date.parse(current.bundle.manifest.updatedAt) + 1_000,
  ).toISOString();
  const {
    currentChangeCheckId: _currentChangeCheckId,
    currentChangeCheckRevision: _currentChangeCheckRevision,
    ...withoutCurrentCheck
  } = current.bundle.manifest;
  const manifest = TaskManifestV1Schema.parse({
    ...withoutCurrentCheck,
    status: "check_required",
    latestSnapshotId: NEXT_SNAPSHOT_ID,
    revision,
    updatedAt: occurredAt,
  });
  const keepCheck = retain === "both" || retain === "check";
  const keepVerification = retain === "both" || retain === "verification";
  const removedFindingIds = keepCheck
    ? new Set<string>()
    : new Set(
        current.bundle.changeChecks.flatMap((check) =>
          check.findings.map((finding) => finding.id),
        ),
      );
  const removedVerificationIds = keepVerification
    ? new Set<string>()
    : new Set(
        current.bundle.verificationRecords.map((record) => record.id),
      );
  const claims = current.bundle.claims.map((claim) => ({
    ...claim,
    findingIds: claim.findingIds.filter(
      (findingId) => !removedFindingIds.has(findingId),
    ),
    verificationRecordIds: claim.verificationRecordIds.filter(
      (recordId) => !removedVerificationIds.has(recordId),
    ),
  }));
  const idempotencyKey =
    `semantic-guard-snapshot-check-${retain}-${revision}`;
  const requestDigest = sha256CanonicalJson({
    operation: "transition_status",
    taskId: FIXTURE_TASK_ID,
    to: "check_required",
    snapshotId: NEXT_SNAPSHOT_ID,
    revision,
    retain,
  });
  const event = buildEvent({
    manifest,
    previousManifest: current.bundle.manifest,
    previousEvent: current.bundle.events.at(-1),
    action: { type: "transition_status", to: "check_required" },
    idempotencyKey,
    requestDigest,
    occurredAt,
    sourceSnapshotId: NEXT_SNAPSHOT_ID,
  });
  const result = {
    task: manifest,
    mutation: mutationResult(
      manifest,
      event,
      current.artifacts
        .filter(
          (artifact) =>
            (keepCheck || artifact.artifactType !== "change_check") &&
            (keepVerification ||
              artifact.artifactType !== "verification"),
        )
        .map((artifact) => artifact.artifactId),
    ),
  };
  const receipt = TaskOperationReceiptV1Schema.parse({
    schemaVersion: 1,
    operation: "update_task",
    taskId: FIXTURE_TASK_ID,
    eventId: event.eventId,
    resultDigest: sha256CanonicalJson(result),
    result,
  });
  const record = recordFor(event, receipt.resultDigest, {
    kind: "task",
    taskId: FIXTURE_TASK_ID,
  });
  const records = [...current.bundle.idempotencyRecords, record];
  const receipts = [...current.receipts, receipt];
  const currentCheck = current.bundle.changeChecks.at(-1);
  return {
    input: {
      artifacts: buildArtifacts({
        manifest,
        brief: current.bundle.brief,
        claims,
        evidence: current.bundle.evidence,
        impactPaths: current.bundle.impactPaths,
        ...(keepCheck && currentCheck !== undefined
          ? { changeCheck: currentCheck }
          : {}),
        ...(keepVerification
          ? { verificationRecords: current.bundle.verificationRecords }
          : {}),
        idempotencyRecords: records,
        receipts,
        createdAt: occurredAt,
      }),
      events: [...current.bundle.events, event],
      idempotencyRecords: records,
    },
    options: {
      expectedRevision: current.bundle.manifest.revision,
      idempotencyKey,
      requestDigest,
    },
  };
}

function blockCandidate(current: ContextualRead): Candidate {
  const revision = current.bundle.manifest.revision + 1;
  const occurredAt = new Date(
    Date.parse(current.bundle.manifest.updatedAt) + 1_000,
  ).toISOString();
  const manifest = TaskManifestV1Schema.parse({
    ...current.bundle.manifest,
    status: "blocked",
    revision,
    updatedAt: occurredAt,
    blockedState: {
      resumeStatus: current.bundle.manifest.status,
      reasonCode: "history_import_review",
      message: "Wait for an external dependency.",
      actor: ACTOR,
      blockedAt: occurredAt,
    },
  });
  const idempotencyKey = `semantic-guard-block-${revision}`;
  const requestDigest = sha256CanonicalJson({
    operation: "block_task",
    taskId: FIXTURE_TASK_ID,
    revision,
  });
  const event = buildEvent({
    manifest,
    previousManifest: current.bundle.manifest,
    previousEvent: current.bundle.events.at(-1),
    action: {
      type: "block_task",
      reasonCode: "history_import_review",
      message: "Wait for an external dependency.",
    },
    idempotencyKey,
    requestDigest,
    occurredAt,
  });
  const result = {
    task: manifest,
    mutation: mutationResult(
      manifest,
      event,
      current.artifacts.map((artifact) => artifact.artifactId),
    ),
  };
  const receipt = TaskOperationReceiptV1Schema.parse({
    schemaVersion: 1,
    operation: "update_task",
    taskId: FIXTURE_TASK_ID,
    eventId: event.eventId,
    resultDigest: sha256CanonicalJson(result),
    result,
  });
  const record = recordFor(event, receipt.resultDigest, {
    kind: "task",
    taskId: FIXTURE_TASK_ID,
  });
  const records = [...current.bundle.idempotencyRecords, record];
  const receipts = [...current.receipts, receipt];
  const currentCheck = current.bundle.changeChecks.at(-1);
  return {
    input: {
      artifacts: buildArtifacts({
        manifest,
        brief: current.bundle.brief,
        claims: current.bundle.claims,
        evidence: current.bundle.evidence,
        impactPaths: current.bundle.impactPaths,
        ...(currentCheck === undefined ? {} : { changeCheck: currentCheck }),
        verificationRecords: current.artifacts.some(
          (artifact) => artifact.artifactType === "verification",
        )
          ? current.bundle.verificationRecords
          : undefined,
        idempotencyRecords: records,
        receipts,
        createdAt: occurredAt,
      }),
      events: [...current.bundle.events, event],
      idempotencyRecords: records,
    },
    options: {
      expectedRevision: current.bundle.manifest.revision,
      idempotencyKey,
      requestDigest,
    },
  };
}

function retainedTaskResultCandidate(
  current: ContextualRead,
  manifest: TaskManifestV1,
  action: TaskEventActionV1,
  label: string,
): Candidate {
  const idempotencyKey =
    `semantic-guard-${label}-${manifest.revision}`;
  const requestDigest = sha256CanonicalJson({
    operation: action.type,
    taskId: FIXTURE_TASK_ID,
    revision: manifest.revision,
  });
  const event = buildEvent({
    manifest,
    previousManifest: current.bundle.manifest,
    previousEvent: current.bundle.events.at(-1),
    action,
    idempotencyKey,
    requestDigest,
    occurredAt: manifest.updatedAt,
    sourceSnapshotId: manifest.latestSnapshotId,
  });
  const result = {
    task: manifest,
    mutation: mutationResult(
      manifest,
      event,
      current.artifacts.map((artifact) => artifact.artifactId),
    ),
  };
  const receipt = TaskOperationReceiptV1Schema.parse({
    schemaVersion: 1,
    operation: "update_task",
    taskId: FIXTURE_TASK_ID,
    eventId: event.eventId,
    resultDigest: sha256CanonicalJson(result),
    result,
  });
  const record = recordFor(event, receipt.resultDigest, {
    kind: "task",
    taskId: FIXTURE_TASK_ID,
  });
  const records = [...current.bundle.idempotencyRecords, record];
  const receipts = [...current.receipts, receipt];
  const currentCheck = current.bundle.changeChecks.at(-1);
  return {
    input: {
      artifacts: buildArtifacts({
        manifest,
        brief: current.bundle.brief,
        claims: current.bundle.claims,
        evidence: current.bundle.evidence,
        impactPaths: current.bundle.impactPaths,
        ...(currentCheck === undefined ? {} : { changeCheck: currentCheck }),
        verificationRecords: current.artifacts.some(
          (artifact) => artifact.artifactType === "verification",
        )
          ? current.bundle.verificationRecords
          : undefined,
        idempotencyRecords: records,
        receipts,
        createdAt: manifest.updatedAt,
      }),
      events: [...current.bundle.events, event],
      idempotencyRecords: records,
    },
    options: {
      expectedRevision: current.bundle.manifest.revision,
      idempotencyKey,
      requestDigest,
    },
  };
}

function rebaseCandidate(
  current: ContextualRead,
  sourceSnapshotId: string = current.bundle.manifest.latestSnapshotId,
  newBaselineSnapshotId: string = sourceSnapshotId,
): Candidate {
  if (current.bundle.manifest.status !== "stale") {
    throw new TypeError("Rebase must start from a stale Task.");
  }
  const revision = current.bundle.manifest.revision + 1;
  const occurredAt = new Date(
    Date.parse(current.bundle.manifest.updatedAt) + 1_000,
  ).toISOString();
  const {
    currentChangeCheckId: _currentChangeCheckId,
    currentChangeCheckRevision: _currentChangeCheckRevision,
    blockedState: _blockedState,
    staleState: _staleState,
    supersession: _supersession,
    ...base
  } = current.bundle.manifest;
  const manifest = TaskManifestV1Schema.parse({
    ...base,
    status: "context_ready",
    baselineSnapshotId: newBaselineSnapshotId,
    latestSnapshotId: sourceSnapshotId,
    revision,
    updatedAt: occurredAt,
  });
  return retainedTaskResultCandidate(
    current,
    manifest,
    {
      type: "rebase_task",
      newBaselineSnapshotId,
      reason: "Reconfirm the trusted logical baseline.",
    },
    "rebase",
  );
}

function refreshCandidate(
  current: ContextualRead,
  sourceSnapshotId: string,
): Candidate {
  if (current.bundle.manifest.status !== "stale") {
    throw new TypeError("Refresh must start from a stale Task.");
  }
  const revision = current.bundle.manifest.revision + 1;
  const occurredAt = new Date(
    Date.parse(current.bundle.manifest.updatedAt) + 1_000,
  ).toISOString();
  const {
    currentChangeCheckId: _currentChangeCheckId,
    currentChangeCheckRevision: _currentChangeCheckRevision,
    blockedState: _blockedState,
    staleState: _staleState,
    supersession: _supersession,
    ...base
  } = current.bundle.manifest;
  const manifest = TaskManifestV1Schema.parse({
    ...base,
    status: "context_ready",
    latestSnapshotId: sourceSnapshotId,
    revision,
    updatedAt: occurredAt,
  });
  return retainedTaskResultCandidate(
    current,
    manifest,
    {
      type: "refresh_task_context",
      targetSnapshotId: sourceSnapshotId,
    },
    "refresh",
  );
}

function supersedeCandidate(
  current: ContextualRead,
  sourceSnapshotId: string = current.bundle.manifest.latestSnapshotId,
): Candidate {
  const revision = current.bundle.manifest.revision + 1;
  const occurredAt = new Date(
    Date.parse(current.bundle.manifest.updatedAt) + 1_000,
  ).toISOString();
  const {
    currentChangeCheckId: _currentChangeCheckId,
    currentChangeCheckRevision: _currentChangeCheckRevision,
    blockedState: _blockedState,
    staleState: _staleState,
    supersession: _supersession,
    ...base
  } = current.bundle.manifest;
  const reason = "Replace this Task with a newly scoped follow-up.";
  const manifest = TaskManifestV1Schema.parse({
    ...base,
    status: "superseded",
    latestSnapshotId: sourceSnapshotId,
    revision,
    updatedAt: occurredAt,
    supersession: {
      supersededFromStatus: current.bundle.manifest.status,
      reason,
      actor: ACTOR,
      supersededAt: occurredAt,
    },
  });
  return retainedTaskResultCandidate(
    current,
    manifest,
    { type: "supersede_task", reason },
    "supersede",
  );
}

async function persistCandidate(
  store: ArtifactStore,
  candidate: Candidate,
): Promise<void> {
  await store.persistTaskBundle(candidate.input, candidate.options);
}

async function importCandidateIntoEmptyStore(
  candidate: Candidate,
  prefix: string,
): Promise<void> {
  const root = await createTemporaryWorktree(prefix);
  const target = await openFixtureStore(root);
  await target.persistArtifact(await loadRepositorySnapshot());
  await target.persistArtifact(await loadRepoPulse());
  const control = candidate.input.idempotencyRecords.at(-1)!;
  await target.persistTaskBundle(candidate.input, {
    expectedRevision: 0,
    historyImport: true,
    idempotencyKey: control.idempotencyKey,
    requestDigest: control.requestDigest,
  });
}

function forgedClaim(revision: number): ClaimV1 {
  return ClaimV1Schema.parse({
    id: `claim:forged:${revision}`,
    taskId: FIXTURE_TASK_ID,
    kind: "finding",
    statement: "This Claim is not linked to the committed operation.",
    epistemicStatus: "unknown",
    lifecycleStatus: "draft",
    freshness: "current",
    sourceSnapshotId: SNAPSHOT_ID,
    evidenceIds: [],
    findingIds: [],
    verificationRecordIds: [],
    boundaryReason: "The forged Claim has no trusted source.",
    createdAt: CONTEXT_AT,
    updatedAt: CONTEXT_AT,
  });
}

describe("Task semantic transition guards", () => {
  it("rejects a live ordinary transition that relabels unchanged Context onto a newer Snapshot", async () => {
    const { store, current } =
      await setupContextualTask("context_ready");
    await persistCandidate(store, transitionCandidate(current, "planned"));
    const planned = await store.readTaskBundle(FIXTURE_TASK_ID);
    assertContextual(planned);
    await store.persistArtifact(await nextRepositorySnapshot());
    await store.persistArtifact(await nextRepoPulse(), {
      expectedRevision: 0,
    });

    await expect(
      persistCandidate(
        store,
        transitionCandidate(planned, "in_progress", NEXT_SNAPSHOT_ID),
      ),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
  });

  it("rejects a historyImport whose ordinary transition relabels prior Context onto a newer Snapshot", async () => {
    const { store: source, current } =
      await setupContextualTask("context_ready");
    await persistCandidate(
      source,
      transitionCandidate(current, "planned"),
    );
    const planned = await source.readTaskBundle(FIXTURE_TASK_ID);
    assertContextual(planned);
    const relabeled = transitionCandidate(
      planned,
      "in_progress",
      NEXT_SNAPSHOT_ID,
    );

    const root = await createTemporaryWorktree(
      "artifact-store-snapshot-relabel-import-",
    );
    const target = await openFixtureStore(root);
    await target.persistArtifact(await nextRepositorySnapshot());
    await target.persistArtifact(await nextRepoPulse(), {
      expectedRevision: 0,
    });
    const control = relabeled.input.idempotencyRecords.at(-1)!;
    await expect(
      target.persistTaskBundle(relabeled.input, {
        expectedRevision: 0,
        historyImport: true,
        idempotencyKey: control.idempotencyKey,
        requestDigest: control.requestDigest,
      }),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
  });

  it("allows created to context_ready to bind newly built Context to the current Snapshot", async () => {
    const { current } = await setupContextualTask(
      "context_ready",
      NEXT_SNAPSHOT_ID,
    );
    expect(current.bundle.manifest).toMatchObject({
      revision: 2,
      status: "context_ready",
      latestSnapshotId: NEXT_SNAPSHOT_ID,
    });
  });

  it("allows normal to stale to capture a newer detected Snapshot", async () => {
    const { store, current } =
      await setupContextualTask("context_ready");
    await store.persistArtifact(await nextRepositorySnapshot());
    await expect(
      persistCandidate(
        store,
        staleCleanupCandidate(current, "none", NEXT_SNAPSHOT_ID),
      ),
    ).resolves.toBeUndefined();
    await expect(
      store.readTaskBundle(FIXTURE_TASK_ID),
    ).resolves.toMatchObject({
      bundle: {
        manifest: {
          status: "stale",
          latestSnapshotId: NEXT_SNAPSHOT_ID,
        },
      },
    });
  });

  it.each(["refresh", "rebase"] as const)(
    "allows %s to rebuild stale Context on a newer Snapshot",
    async (operation) => {
      const { store, current } =
        await setupContextualTask("context_ready");
      await persistCandidate(
        store,
        staleCleanupCandidate(current, "none"),
      );
      const stale = await store.readTaskBundle(FIXTURE_TASK_ID);
      assertContextual(stale);
      await store.persistArtifact(await nextRepositorySnapshot());
      await store.persistArtifact(await nextRepoPulse({
        baselineSnapshotId:
          operation === "rebase"
            ? NEXT_SNAPSHOT_ID
            : stale.bundle.manifest.baselineSnapshotId,
        identitySuffix: `next-${operation}`,
      }), {
        expectedRevision: 0,
      });
      await expect(
        persistCandidate(
          store,
          operation === "refresh"
            ? refreshCandidate(stale, NEXT_SNAPSHOT_ID)
            : rebaseCandidate(stale, NEXT_SNAPSHOT_ID),
        ),
      ).resolves.toBeUndefined();
      await expect(
        store.readTaskBundle(FIXTURE_TASK_ID),
      ).resolves.toMatchObject({
        bundle: {
          manifest: {
            status: "context_ready",
            latestSnapshotId: NEXT_SNAPSHOT_ID,
          },
        },
      });
    },
  );

  it("allows supersede_task to capture the current Snapshot", async () => {
    const { store, current } =
      await setupContextualTask("context_ready");
    await store.persistArtifact(await nextRepositorySnapshot());
    await expect(
      persistCandidate(
        store,
        supersedeCandidate(current, NEXT_SNAPSHOT_ID),
      ),
    ).resolves.toBeUndefined();
    await expect(
      store.readTaskBundle(FIXTURE_TASK_ID),
    ).resolves.toMatchObject({
      bundle: {
        manifest: {
          status: "superseded",
          latestSnapshotId: NEXT_SNAPSHOT_ID,
        },
      },
    });
  });

  it("allows verification_required to check_required actual Snapshot alignment", async () => {
    const { store, current } = await setupContextualTask();
    const verificationRequired = await advanceToVerificationRequired(
      store,
      current,
    );
    await store.persistArtifact(await nextRepositorySnapshot());
    await expect(
      persistCandidate(
        store,
        snapshotAdvanceCheckCandidate(verificationRequired, "none"),
      ),
    ).resolves.toBeUndefined();
    await expect(
      store.readTaskBundle(FIXTURE_TASK_ID),
    ).resolves.toMatchObject({
      bundle: {
        manifest: {
          status: "check_required",
          latestSnapshotId: NEXT_SNAPSHOT_ID,
        },
        changeChecks: [],
        verificationRecords: [],
      },
    });
  });

  it("rejects verification_required to check_required when the actual Snapshot did not change", async () => {
    const { store, current } = await setupContextualTask();
    const verificationRequired = await advanceToVerificationRequired(
      store,
      current,
    );
    await expect(
      persistCandidate(
        store,
        transitionCandidate(verificationRequired, "check_required"),
      ),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
  });

  it("rejects a historyImport with verification_required to check_required on the same Snapshot", async () => {
    const { store, current } = await setupContextualTask();
    const verificationRequired = await advanceToVerificationRequired(
      store,
      current,
    );
    await expect(
      importCandidateIntoEmptyStore(
        transitionCandidate(verificationRequired, "check_required"),
        "artifact-store-same-snapshot-check-import-",
      ),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
  });

  it("rejects a live rebase_task that does not update the baseline", async () => {
    const { store, current } =
      await setupContextualTask("context_ready");
    await persistCandidate(
      store,
      staleCleanupCandidate(current, "none"),
    );
    const stale = await store.readTaskBundle(FIXTURE_TASK_ID);
    assertContextual(stale);
    await expect(
      persistCandidate(
        store,
        rebaseCandidate(
          stale,
          stale.bundle.manifest.latestSnapshotId,
          stale.bundle.manifest.baselineSnapshotId,
        ),
      ),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
  });

  it("rejects a historyImport whose rebase_task keeps the old baseline", async () => {
    const { store, current } =
      await setupContextualTask("context_ready");
    await persistCandidate(
      store,
      staleCleanupCandidate(current, "none"),
    );
    const stale = await store.readTaskBundle(FIXTURE_TASK_ID);
    assertContextual(stale);
    await expect(
      importCandidateIntoEmptyStore(
        rebaseCandidate(
          stale,
          stale.bundle.manifest.latestSnapshotId,
          stale.bundle.manifest.baselineSnapshotId,
        ),
        "artifact-store-noop-rebase-import-",
      ),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
  });

  it("rejects a latest check_change receipt whose full ChangeCheck differs from the candidate", async () => {
    const { store, current } = await setupContextualTask();
    const candidate = checkCandidate(current, (draft) => {
      draft.receiptChangeCheck.findings[0]!.summary =
        "The receipt silently reports a different Finding.";
    });
    await expect(
      persistCandidate(store, candidate),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
  });

  it("rejects a latest record_verification receipt whose full record differs from the candidate", async () => {
    const { store, current } = await setupContextualTask();
    const verificationRequired = await advanceToVerificationRequired(
      store,
      current,
    );
    const candidate = verificationCandidate(verificationRequired, (draft) => {
      draft.receiptVerification.summary =
        "The receipt silently reports a different Verification result.";
    });
    await expect(
      persistCandidate(store, candidate),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
  });

  it("allows the exact Finding append but rejects unrelated change_checked rewrites and forged appends", async () => {
    const cases: Array<{
      name: string;
      mutate: (draft: CheckDraft) => void;
    }> = [
      {
        name: "old Claim rewrite",
        mutate(draft) {
          draft.claims[0]!.statement = "An unrelated rewritten goal.";
        },
      },
      {
        name: "old Evidence rewrite",
        mutate(draft) {
          draft.evidence[0]!.producedBy = "forged-producer";
        },
      },
      {
        name: "old Impact rewrite",
        mutate(draft) {
          draft.impactPaths[0]!.steps[0]!.confidence = "heuristic";
        },
      },
      {
        name: "unlinked Claim append",
        mutate(draft) {
          draft.claims.push(forgedClaim(3));
        },
      },
    ];
    for (const testCase of cases) {
      const { store, current } = await setupContextualTask();
      await expect(
        persistCandidate(
          store,
          checkCandidate(current, testCase.mutate),
        ),
        testCase.name,
      ).rejects.toMatchObject({ code: "reference_integrity_failed" });
    }

    const { store, current } = await setupContextualTask();
    await expect(
      persistCandidate(store, checkCandidate(current)),
    ).resolves.toBeUndefined();
    const trusted = await store.readTaskBundle(FIXTURE_TASK_ID);
    assertContextual(trusted);
    const findingClaim = trusted.bundle.claims.find(
      (claim) => claim.kind === "finding",
    );
    expect(findingClaim?.findingIds).toHaveLength(1);
    expect(
      trusted.bundle.evidence.find(
        (item) => item.id === "evidence:source",
      )?.claimIds,
    ).toContain(findingClaim?.id);
  });

  it("allows one exact Verification append but rejects old history rewrites, deletion, and forged Claims", async () => {
    const invalidCases: Array<{
      name: string;
      mutate: (draft: VerificationDraft) => void;
    }> = [
      {
        name: "old Verification rewrite",
        mutate(draft) {
          draft.verificationRecords[0]!.summary =
            "A forged rewrite of the previous Verification.";
        },
      },
      {
        name: "old Verification deletion",
        mutate(draft) {
          draft.verificationRecords.splice(0, 1);
          draft.verification.attempt = 1;
          delete draft.verification.supersedesVerificationRecordId;
          draft.receiptVerification.attempt = 1;
          delete draft.receiptVerification
            .supersedesVerificationRecordId;
          const linked = draft.claims.find(
            (claim) => claim.id === "claim:acceptance",
          )!;
          linked.verificationRecordIds = [draft.verification.id];
        },
      },
      {
        name: "unrelated old Claim rewrite",
        mutate(draft) {
          draft.claims[0]!.statement =
            "Verification cannot rewrite the Task goal.";
        },
      },
      {
        name: "forged Claim append",
        mutate(draft) {
          draft.claims.push(forgedClaim(5));
        },
      },
    ];

    for (const testCase of invalidCases) {
      const { store, current } = await setupContextualTask();
      const verificationRequired = await advanceToVerificationRequired(
        store,
        current,
      );
      await persistCandidate(
        store,
        verificationCandidate(verificationRequired),
      );
      const verified = await store.readTaskBundle(FIXTURE_TASK_ID);
      assertContextual(verified);
      await expect(
        persistCandidate(
          store,
          verificationCandidate(verified, testCase.mutate),
        ),
        testCase.name,
      ).rejects.toMatchObject({ code: "reference_integrity_failed" });
    }

    const { store, current } = await setupContextualTask();
    const verificationRequired = await advanceToVerificationRequired(
      store,
      current,
    );
    await persistCandidate(
      store,
      verificationCandidate(verificationRequired),
    );
    const onceVerified = await store.readTaskBundle(FIXTURE_TASK_ID);
    assertContextual(onceVerified);
    await expect(
      persistCandidate(
        store,
        verificationCandidate(onceVerified),
      ),
    ).resolves.toBeUndefined();
    const trusted = await store.readTaskBundle(FIXTURE_TASK_ID);
    assertContextual(trusted);
    expect(
      trusted.bundle.verificationRecords.map((record) => record.attempt),
    ).toEqual([1, 2]);
    expect(
      trusted.bundle.claims.find(
        (claim) => claim.id === "claim:acceptance",
      )?.verificationRecordIds,
    ).toEqual(
      trusted.bundle.verificationRecords.map((record) => record.id),
    );
  });

  it.each([
    "2026-07-29T00:00:00Z",
    "2026-07-31T00:00:00Z",
  ])(
    "rejects a Verification receipt with a non-Event recordedAt (%s)",
    async (recordedAt) => {
      const { store, current } = await setupContextualTask();
      const verificationRequired = await advanceToVerificationRequired(
        store,
        current,
      );
      const candidate = verificationCandidate(
        verificationRequired,
        (draft) => {
          draft.verification.recordedAt = recordedAt;
          draft.receiptVerification.recordedAt = recordedAt;
        },
      );
      await expect(
        persistCandidate(store, candidate),
      ).rejects.toMatchObject({ code: "reference_integrity_failed" });
    },
  );

  it("requires Snapshot cleanup to remove both Check and Verification projections", async () => {
    const { store, current } = await setupContextualTask();
    const verificationRequired = await advanceToVerificationRequired(
      store,
      current,
    );
    await persistCandidate(
      store,
      verificationCandidate(verificationRequired),
    );
    const withVerification = await store.readTaskBundle(FIXTURE_TASK_ID);
    assertContextual(withVerification);

    for (const retain of ["both", "check", "verification"] as const) {
      await expect(
        persistCandidate(
          store,
          staleCleanupCandidate(withVerification, retain),
        ),
        retain,
      ).rejects.toMatchObject({ code: "reference_integrity_failed" });
    }

    await expect(
      persistCandidate(
        store,
        staleCleanupCandidate(withVerification, "none"),
      ),
    ).resolves.toBeUndefined();
    const cleaned = await store.readTaskBundle(FIXTURE_TASK_ID);
    assertContextual(cleaned);
    expect(cleaned.bundle.manifest.status).toBe("stale");
    expect(cleaned.bundle.changeChecks).toEqual([]);
    expect(cleaned.bundle.verificationRecords).toEqual([]);
    expect(
      cleaned.bundle.claims.every(
        (claim) =>
          claim.findingIds.length === 0 &&
          claim.verificationRecordIds.length === 0,
      ),
    ).toBe(true);
  });

  it("aligns in_progress to the actual Snapshot only with complete projection cleanup", async () => {
    const { store, current } = await setupContextualTask();
    const verificationRequired = await advanceToVerificationRequired(
      store,
      current,
    );
    await persistCandidate(
      store,
      verificationCandidate(verificationRequired, (draft) => {
        for (const record of [
          draft.verification,
          draft.receiptVerification,
        ]) {
          record.status = "failed";
          record.exitCode = 1;
          record.summary = "The semantic guard verification failed.";
        }
      }),
    );
    const failedVerification = await store.readTaskBundle(FIXTURE_TASK_ID);
    assertContextual(failedVerification);
    await persistCandidate(
      store,
      transitionCandidate(failedVerification, "in_progress"),
    );
    const inProgress = await store.readTaskBundle(FIXTURE_TASK_ID);
    assertContextual(inProgress);
    expect(inProgress.bundle.changeChecks).toHaveLength(1);
    expect(inProgress.bundle.verificationRecords).toHaveLength(1);

    await store.persistArtifact(await nextRepositorySnapshot());
    for (const retain of ["both", "check"] as const) {
      expect(
        () => snapshotAdvanceCheckCandidate(inProgress, retain),
        retain,
      ).toThrow();
    }
    await expect(
      persistCandidate(
        store,
        snapshotAdvanceCheckCandidate(inProgress, "verification"),
      ),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
    await expect(
      persistCandidate(
        store,
        snapshotAdvanceCheckCandidate(inProgress, "none"),
      ),
    ).resolves.toBeUndefined();
    const aligned = await store.readTaskBundle(FIXTURE_TASK_ID);
    assertContextual(aligned);
    expect(aligned.bundle.manifest).toMatchObject({
      status: "check_required",
      latestSnapshotId: NEXT_SNAPSHOT_ID,
    });
    expect(aligned.freshness).toBe("partial");
    expect(aligned.bundle.changeChecks).toEqual([]);
    expect(aligned.bundle.verificationRecords).toEqual([]);
    expect(
      aligned.bundle.claims.every(
        (claim) =>
          claim.findingIds.length === 0 &&
          claim.verificationRecordIds.length === 0,
      ),
    ).toBe(true);
  });

  it("replays every journaled historyImport Task result and rejects per-action historical tampering", async () => {
    const { store, current } = await setupContextualTask();
    await persistCandidate(store, blockCandidate(current));
    const blocked = await store.readTaskBundle(FIXTURE_TASK_ID);
    assertContextual(blocked);
    await persistCandidate(
      store,
      staleCleanupCandidate(blocked, "none"),
    );
    const stale = await store.readTaskBundle(FIXTURE_TASK_ID);
    assertContextual(stale);
    await store.persistArtifact(
      await nextRepoPulse({
        sourceSnapshotId: SNAPSHOT_ID,
        baselineSnapshotId: SNAPSHOT_ID,
        identitySuffix: "same-snapshot-rebase",
      }),
      { expectedRevision: 0 },
    );
    await persistCandidate(
      store,
      rebaseCandidate(stale, SNAPSHOT_ID, SNAPSHOT_ID),
    );
    const rebased = await store.readTaskBundle(FIXTURE_TASK_ID);
    assertContextual(rebased);
    await persistCandidate(store, supersedeCandidate(rebased));
    const superseded = await store.readTaskBundle(FIXTURE_TASK_ID);
    assertContextual(superseded);

    const importIntoEmptyStore = async (
      input: PersistTaskBundleInput,
    ): Promise<void> => {
      const root = await createTemporaryWorktree(
        "artifact-store-history-replay-",
      );
      const target = await openFixtureStore(root);
      await target.persistArtifact(await loadRepositorySnapshot());
      await target.persistArtifact(await loadRepoPulse());
      const control = input.idempotencyRecords.at(-1)!;
      await target.persistTaskBundle(input, {
        expectedRevision: 0,
        historyImport: true,
        idempotencyKey: control.idempotencyKey,
        requestDigest: control.requestDigest,
      });
    };
    const trustedInput: PersistTaskBundleInput = {
      artifacts: superseded.artifacts,
      events: superseded.bundle.events,
      idempotencyRecords: superseded.bundle.idempotencyRecords,
    };
    await expect(importIntoEmptyStore(trustedInput)).resolves.toBeUndefined();

    const tamperedInput = (
      kind:
        | "parent"
        | "baseline"
        | "blocked_state"
        | "stale_state"
        | "rebase_state"
        | "supersession",
    ): PersistTaskBundleInput => {
      const artifacts = structuredClone(superseded.artifacts);
      const events = structuredClone(superseded.bundle.events);
      const records = structuredClone(
        superseded.bundle.idempotencyRecords,
      );
      const journalIndex = artifacts.findIndex(
        (artifact) => artifact.artifactType === "task_operation_journal",
      );
      const journal = artifacts[journalIndex];
      if (journal?.artifactType !== "task_operation_journal") {
        throw new TypeError("A Task operation Journal is required.");
      }
      const payload = structuredClone(journal.payload);
      const receiptIndex = (() => {
        switch (kind) {
          case "parent":
            return 0;
          case "baseline":
            return events.findIndex(
              (event) =>
                event.action.type === "transition_status" &&
                event.action.to === "planned",
            );
          case "blocked_state":
            return events.findIndex(
              (event) => event.action.type === "block_task",
            );
          case "stale_state":
            return events.findIndex(
              (event) => event.action.type === "task_context_staled",
            );
          case "rebase_state":
            return events.findIndex(
              (event) => event.action.type === "rebase_task",
            );
          case "supersession":
            return events.findIndex(
              (event) => event.action.type === "supersede_task",
            );
        }
      })();
      const receipt = payload.receipts[receiptIndex];
      if (
        receipt === undefined ||
        (receipt.operation !== "task_created" &&
          receipt.operation !== "build_task_brief" &&
          receipt.operation !== "update_task")
      ) {
        throw new TypeError("The selected history Receipt has no Task result.");
      }
      const task = structuredClone(receipt.result.task);
      if (kind === "parent") {
        task.parentTaskId = "01ARZ3NDEKTSV4RRFFQ69G5FAW";
      } else if (kind === "baseline") {
        task.baselineSnapshotId = "snapshot:forged-baseline";
      } else if (kind === "blocked_state") {
        if (task.blockedState === undefined) {
          throw new TypeError("The selected Task result is not blocked.");
        }
        task.blockedState.message = "A forged historical blocker.";
      } else if (kind === "stale_state") {
        if (task.staleState === undefined) {
          throw new TypeError("The selected Task result is not stale.");
        }
        task.staleState.detectedAtSnapshotId =
          "snapshot:forged-stale-detection";
      } else if (kind === "rebase_state") {
        task.baselineSnapshotId = "snapshot:forged-rebase";
      } else {
        if (task.supersession === undefined) {
          throw new TypeError(
            "The selected Task result is not superseded.",
          );
        }
        task.supersession.reason = "A forged supersession reason.";
        const taskArtifactIndex = artifacts.findIndex(
          (artifact) => artifact.artifactType === "task_manifest",
        );
        const taskArtifact = artifacts[taskArtifactIndex];
        if (taskArtifact?.artifactType !== "task_manifest") {
          throw new TypeError("A Task Manifest Artifact is required.");
        }
        artifacts[taskArtifactIndex] = parsePersistedArtifactV1({
          ...taskArtifact,
          contentDigest: sha256CanonicalJson(task),
          payload: task,
        });
      }
      const result = { ...receipt.result, task };
      const rewrittenReceipt = TaskOperationReceiptV1Schema.parse({
        ...receipt,
        resultDigest: sha256CanonicalJson(result),
        result,
      });
      payload.receipts[receiptIndex] = rewrittenReceipt;
      records[receiptIndex] = {
        ...records[receiptIndex]!,
        resultDigest: rewrittenReceipt.resultDigest,
      };
      payload.idempotencyRecords = records;
      artifacts[journalIndex] = parsePersistedArtifactV1({
        ...journal,
        contentDigest: sha256CanonicalJson(payload),
        payload,
      });
      return { artifacts, events, idempotencyRecords: records };
    };

    for (const kind of [
      "parent",
      "baseline",
      "blocked_state",
      "stale_state",
      "rebase_state",
      "supersession",
    ] as const) {
      await expect(
        importIntoEmptyStore(tamperedInput(kind)),
        kind,
      ).rejects.toMatchObject({ code: "reference_integrity_failed" });
    }
  });
});
