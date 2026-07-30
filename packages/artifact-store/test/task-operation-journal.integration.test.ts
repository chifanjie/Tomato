import { readFile, readdir, writeFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  ClaimLedgerArtifactV1Schema,
  EvidenceLedgerArtifactV1Schema,
  ImpactArtifactV1Schema,
  TaskBriefArtifactV1Schema,
  TaskEventV1Schema,
  TaskManifestArtifactV1Schema,
  TaskOperationJournalArtifactV1Schema,
  TaskOperationReceiptV1Schema,
  canonicalTaskEventDigestJsonV1,
  type IdempotencyRecordV1,
  type PersistedArtifactV1,
  type TaskEventV1,
  type TaskManifestArtifactV1,
  type TaskOperationReceiptV1,
} from "@understand-code/contracts";

import {
  ArtifactStore,
  sha256Bytes,
  sha256CanonicalJson,
} from "../src/index.js";
import {
  cleanupTemporaryWorktrees,
  createTemporaryWorktree,
  FIXTURE_PRODUCER_VERSION,
  FIXTURE_REPOSITORY_ID,
  FIXTURE_TASK_ID,
  FIXTURE_WORKTREE_ID,
  loadContractFixture,
  loadReferenceEvents,
  loadRepoPulse,
  loadRepositorySnapshot,
  openFixtureStore,
} from "./helpers.js";

afterEach(cleanupTemporaryWorktrees);

const SNAPSHOT_ID = "snapshot:actual";
const CREATED_AT = "2026-07-28T08:00:00Z";
const CONTEXT_AT = "2026-07-28T08:01:00Z";
const PLANNED_AT = "2026-07-28T08:02:00Z";
const BLOCKED_AT = "2026-07-28T08:03:00Z";
const OTHER_TASK_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAW";

interface CompactIdempotencyIndexForTest {
  version: 1;
  records: Array<{
    key: string;
    requestDigest: string;
    scope?:
      | { kind: "task_create"; createScope: string }
      | { kind: "task"; taskId: string };
    actor?: string;
    artifactType: string;
    artifactId: string;
    resultRevision: number;
    resultDigest: string;
    recordedAt: string;
  }>;
}

async function readCompactIdempotencyIndex(
  targetPath: string,
): Promise<CompactIdempotencyIndexForTest> {
  return JSON.parse(
    await readFile(targetPath, "utf8"),
  ) as CompactIdempotencyIndexForTest;
}

async function writeCompactIdempotencyIndex(
  targetPath: string,
  value: CompactIdempotencyIndexForTest,
): Promise<void> {
  await writeFile(targetPath, `${JSON.stringify(value)}\n`, "utf8");
}

function taskManifestArtifact(
  reference: TaskManifestArtifactV1,
  revision: number,
  status: "created" | "context_ready" | "planned" | "blocked",
  updatedAt: string,
): TaskManifestArtifactV1 {
  const {
    currentChangeCheckId: _currentChangeCheckId,
    currentChangeCheckRevision: _currentChangeCheckRevision,
    blockedState: _blockedState,
    staleState: _staleState,
    supersession: _supersession,
    ...base
  } = reference.payload;
  const payload = {
    ...base,
    status,
    revision,
    updatedAt,
    ...(status === "blocked"
      ? {
          blockedState: {
            resumeStatus: "planned",
            reasonCode: "journal_fault_injection",
            message: "Exercise operation Journal rollback.",
            actor: "developer",
            blockedAt: updatedAt,
          },
        }
      : {}),
  };
  return TaskManifestArtifactV1Schema.parse({
    ...reference,
    revision,
    createdAt: updatedAt,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

function mutationResult(
  revision: number,
  eventId: string,
  artifactIds: string[],
) {
  return {
    taskId: FIXTURE_TASK_ID,
    revision,
    eventId,
    artifactIds,
    idempotentReplay: false,
  };
}

function receiptRecord(
  base: IdempotencyRecordV1,
  receipt: TaskOperationReceiptV1,
): IdempotencyRecordV1 {
  return {
    ...base,
    resultDigest: receipt.resultDigest,
  };
}

function journalArtifact(
  revision: number,
  createdAt: string,
  records: IdempotencyRecordV1[],
  receipts: TaskOperationReceiptV1[],
) {
  const payload = {
    idempotencyRecords: records,
    receipts,
  };
  return TaskOperationJournalArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "task_operation_journal",
    artifactId: "artifact:task-operation-journal",
    repositoryId: FIXTURE_REPOSITORY_ID,
    worktreeId: FIXTURE_WORKTREE_ID,
    sourceSnapshotId: SNAPSHOT_ID,
    taskId: FIXTURE_TASK_ID,
    revision,
    producerVersion: FIXTURE_PRODUCER_VERSION,
    createdAt,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

function contextualArtifacts(
  manifest: TaskManifestArtifactV1,
  revision: number,
  createdAt: string,
  journal: ReturnType<typeof journalArtifact>,
): PersistedArtifactV1[] {
  const briefPayload = {
    originalIntent: manifest.payload.originalIntent,
    goalClaimId: "claim:goal",
    nonGoalClaimIds: [],
    acceptanceClaimIds: ["claim:acceptance"],
    readingPath: [
      {
        id: "reading:task",
        order: 0,
        kind: "symbol" as const,
        filePath: "src/task.ts",
        symbolId: "symbol:task-handler",
        claimIds: ["claim:recommendation"],
        evidenceIds: ["evidence:source"],
      },
    ],
    plannedChanges: [
      {
        id: "planned-change:task",
        candidateLevel: "likely_change" as const,
        filePath: "src/task.ts",
        symbolId: "symbol:task-handler",
        intent: "Keep historical Task mutation results replayable.",
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
        method: "test" as const,
        description: "Run the contract suite.",
        required: true,
      },
    ],
  };
  const claimsPayload = {
    claims: [
      {
        id: "claim:goal",
        taskId: FIXTURE_TASK_ID,
        kind: "goal" as const,
        statement: "Task mutation history remains durable.",
        epistemicStatus: "unknown" as const,
        lifecycleStatus: "draft" as const,
        freshness: "current" as const,
        sourceSnapshotId: SNAPSHOT_ID,
        evidenceIds: [],
        findingIds: [],
        verificationRecordIds: [],
        boundaryReason: "Awaiting explicit owner confirmation.",
        createdAt: CREATED_AT,
        updatedAt: CONTEXT_AT,
      },
      {
        id: "claim:acceptance",
        taskId: FIXTURE_TASK_ID,
        kind: "acceptance" as const,
        statement: "Every committed idempotency key replays its result.",
        epistemicStatus: "unknown" as const,
        lifecycleStatus: "draft" as const,
        freshness: "current" as const,
        sourceSnapshotId: SNAPSHOT_ID,
        evidenceIds: [],
        findingIds: [],
        verificationRecordIds: [],
        boundaryReason: "Verification has not run yet.",
        createdAt: CREATED_AT,
        updatedAt: CONTEXT_AT,
      },
      {
        id: "claim:recommendation",
        taskId: FIXTURE_TASK_ID,
        kind: "recommendation" as const,
        statement: "Persist a complete operation journal with the Task.",
        epistemicStatus: "observed" as const,
        lifecycleStatus: "supported" as const,
        freshness: "current" as const,
        sourceSnapshotId: SNAPSHOT_ID,
        evidenceIds: ["evidence:source"],
        findingIds: [],
        verificationRecordIds: [],
        createdAt: CREATED_AT,
        updatedAt: CONTEXT_AT,
      },
    ],
  };
  const evidencePayload = {
    evidence: [
      {
        id: "evidence:source",
        kind: "source" as const,
        epistemicStatus: "observed" as const,
        freshness: "current" as const,
        claimIds: ["claim:recommendation"],
        nodeIds: ["symbol:task-handler"],
        producedBy: "core",
        createdAt: CREATED_AT,
        observedAtSnapshotId: SNAPSHOT_ID,
        filePath: "src/task.ts",
        lineRange: [10, 24] as [number, number],
        contentHash: sha256Bytes("task handler"),
      },
    ],
  };
  const impactPayload = {
    paths: [
      {
        id: "impact:task-to-consumer",
        sourceNodeId: "symbol:task-handler",
        targetNodeId: "symbol:agent-consumer",
        classification: "observed" as const,
        claimIds: ["claim:recommendation"],
        steps: [
          {
            source: "symbol:task-handler",
            edgeType: "calls",
            target: "symbol:agent-consumer",
            direction: "downstream" as const,
            evidenceId: "evidence:source",
            confidence: "exact" as const,
          },
        ],
      },
    ],
  };
  const envelope = {
    schemaVersion: 1 as const,
    repositoryId: FIXTURE_REPOSITORY_ID,
    worktreeId: FIXTURE_WORKTREE_ID,
    sourceSnapshotId: SNAPSHOT_ID,
    taskId: FIXTURE_TASK_ID,
    revision,
    producerVersion: FIXTURE_PRODUCER_VERSION,
    createdAt,
  };
  return [
    manifest,
    TaskBriefArtifactV1Schema.parse({
      ...envelope,
      artifactType: "task_brief",
      artifactId: "artifact:task-brief",
      contentDigest: sha256CanonicalJson(briefPayload),
      payload: briefPayload,
    }),
    ClaimLedgerArtifactV1Schema.parse({
      ...envelope,
      artifactType: "claim_ledger",
      artifactId: "artifact:claim-ledger",
      contentDigest: sha256CanonicalJson(claimsPayload),
      payload: claimsPayload,
    }),
    EvidenceLedgerArtifactV1Schema.parse({
      ...envelope,
      artifactType: "evidence_ledger",
      artifactId: "artifact:evidence-ledger",
      contentDigest: sha256CanonicalJson(evidencePayload),
      payload: evidencePayload,
    }),
    ImpactArtifactV1Schema.parse({
      ...envelope,
      artifactType: "impact",
      artifactId: "artifact:impact",
      contentDigest: sha256CanonicalJson(impactPayload),
      payload: impactPayload,
    }),
    journal,
  ];
}

function appendPlannedEvent(previous: TaskEventV1): TaskEventV1 {
  const event = TaskEventV1Schema.parse({
    schemaVersion: 1,
    eventId: "event:journal-integration-3",
    repositoryId: FIXTURE_REPOSITORY_ID,
    worktreeId: FIXTURE_WORKTREE_ID,
    taskId: FIXTURE_TASK_ID,
    previousRevision: 2,
    revision: 3,
    actor: "developer",
    // Deliberately reuse the preceding task_create key in the independent
    // task scope. The trusted Journal, Event log, and compact cache must all
    // distinguish the two operation scopes.
    idempotencyKey: previous.idempotencyKey,
    requestDigest: sha256CanonicalJson({ operation: "plan-task" }),
    sourceSnapshotId: SNAPSHOT_ID,
    occurredAt: PLANNED_AT,
    previousStatus: "context_ready",
    resultingStatus: "planned",
    action: { type: "transition_status", to: "planned" },
    previousEventDigest: previous.eventDigest,
    eventDigest: sha256Bytes("placeholder"),
  });
  return TaskEventV1Schema.parse({
    ...event,
    eventDigest: sha256Bytes(canonicalTaskEventDigestJsonV1(event)),
  });
}

function appendBlockedEvent(previous: TaskEventV1): TaskEventV1 {
  const event = TaskEventV1Schema.parse({
    schemaVersion: 1,
    eventId: "event:journal-integration-4",
    repositoryId: FIXTURE_REPOSITORY_ID,
    worktreeId: FIXTURE_WORKTREE_ID,
    taskId: FIXTURE_TASK_ID,
    previousRevision: 3,
    revision: 4,
    actor: "developer",
    idempotencyKey: "journal-integration-request-4",
    requestDigest: sha256CanonicalJson({ operation: "block-task" }),
    sourceSnapshotId: SNAPSHOT_ID,
    occurredAt: BLOCKED_AT,
    previousStatus: "planned",
    resultingStatus: "blocked",
    action: {
      type: "block_task",
      reasonCode: "journal_fault_injection",
      message: "Exercise operation Journal rollback.",
    },
    previousEventDigest: previous.eventDigest,
    eventDigest: sha256Bytes("placeholder"),
  });
  return TaskEventV1Schema.parse({
    ...event,
    eventDigest: sha256Bytes(canonicalTaskEventDigestJsonV1(event)),
  });
}

function appendConfirmPlanEvent(previous: TaskEventV1): TaskEventV1 {
  const event = TaskEventV1Schema.parse({
    schemaVersion: 1,
    eventId: "event:journal-integration-confirm-plan-4",
    repositoryId: FIXTURE_REPOSITORY_ID,
    worktreeId: FIXTURE_WORKTREE_ID,
    taskId: FIXTURE_TASK_ID,
    previousRevision: 3,
    revision: 4,
    actor: "developer",
    idempotencyKey: "journal-integration-confirm-plan-request-4",
    requestDigest: sha256CanonicalJson({
      operation: "confirm-plan",
    }),
    sourceSnapshotId: SNAPSHOT_ID,
    occurredAt: BLOCKED_AT,
    previousStatus: "planned",
    resultingStatus: "planned",
    action: {
      type: "confirm_plan",
      plannedChangeIds: ["planned-change:task"],
    },
    previousEventDigest: previous.eventDigest,
    eventDigest: sha256Bytes("placeholder"),
  });
  return TaskEventV1Schema.parse({
    ...event,
    eventDigest: sha256Bytes(canonicalTaskEventDigestJsonV1(event)),
  });
}

function appendMismatchedStaleEvent(
  previous: TaskEventV1,
): TaskEventV1 {
  const event = TaskEventV1Schema.parse({
    schemaVersion: 1,
    eventId: "event:journal-integration-stale-4",
    repositoryId: FIXTURE_REPOSITORY_ID,
    worktreeId: FIXTURE_WORKTREE_ID,
    taskId: FIXTURE_TASK_ID,
    previousRevision: 3,
    revision: 4,
    actor: "developer",
    idempotencyKey: "journal-integration-stale-request-4",
    requestDigest: sha256CanonicalJson({
      operation: "stale-task-with-mismatched-snapshot",
    }),
    sourceSnapshotId: SNAPSHOT_ID,
    occurredAt: BLOCKED_AT,
    previousStatus: "planned",
    resultingStatus: "stale",
    action: {
      type: "task_context_staled",
      reasonCodes: ["repository_snapshot_advanced"],
      detectedAtSnapshotId: "snapshot:contradictory",
    },
    previousEventDigest: previous.eventDigest,
    eventDigest: sha256Bytes("placeholder"),
  });
  return TaskEventV1Schema.parse({
    ...event,
    eventDigest: sha256Bytes(canonicalTaskEventDigestJsonV1(event)),
  });
}

function appendConfirmGoalEvent(previous: TaskEventV1): TaskEventV1 {
  const event = TaskEventV1Schema.parse({
    schemaVersion: 1,
    eventId: "event:journal-integration-confirm-goal-4",
    repositoryId: FIXTURE_REPOSITORY_ID,
    worktreeId: FIXTURE_WORKTREE_ID,
    taskId: FIXTURE_TASK_ID,
    previousRevision: 3,
    revision: 4,
    actor: "developer",
    idempotencyKey: "journal-integration-confirm-goal-request-4",
    requestDigest: sha256CanonicalJson({
      operation: "confirm-goal-with-unrelated-rewrite",
    }),
    sourceSnapshotId: SNAPSHOT_ID,
    occurredAt: BLOCKED_AT,
    previousStatus: "planned",
    resultingStatus: "planned",
    action: {
      type: "confirm_goal",
      claimId: "claim:goal",
    },
    previousEventDigest: previous.eventDigest,
    eventDigest: sha256Bytes("placeholder"),
  });
  return TaskEventV1Schema.parse({
    ...event,
    eventDigest: sha256Bytes(canonicalTaskEventDigestJsonV1(event)),
  });
}

describe("trusted Task operation journal integration", () => {
  it("publishes created@1 with a journal, then context_ready@2 without Check or Verification", async () => {
    const root = await createTemporaryWorktree(
      "artifact-store-operation-journal-",
    );
    const store = await openFixtureStore(root);
    const reference =
      await loadContractFixture<TaskManifestArtifactV1>(
        "reference/task.json",
      );
    const referenceRecords =
      await loadContractFixture<{
        idempotencyRecords: IdempotencyRecordV1[];
      }>("reference/task-bundle.json");
    const [createdEvent, contextEvent] = await loadReferenceEvents();
    expect(createdEvent).toBeDefined();
    expect(contextEvent).toBeDefined();

    const createdManifest = taskManifestArtifact(
      reference,
      1,
      "created",
      CREATED_AT,
    );
    const createdResult = {
      task: createdManifest.payload,
      mutation: mutationResult(1, createdEvent!.eventId, [
        createdManifest.artifactId,
        "artifact:task-operation-journal",
      ]),
    };
    const createdReceipt = {
      schemaVersion: 1 as const,
      operation: "task_created" as const,
      taskId: FIXTURE_TASK_ID,
      eventId: createdEvent!.eventId,
      resultDigest: sha256CanonicalJson(createdResult),
      result: createdResult,
    } satisfies TaskOperationReceiptV1;
    const createdRecord = receiptRecord(
      referenceRecords.idempotencyRecords[0]!,
      createdReceipt,
    );
    const createdJournal = journalArtifact(
      1,
      CREATED_AT,
      [createdRecord],
      [createdReceipt],
    );

    await expect(
      store.persistTaskBundle(
        {
          artifacts: [createdManifest, createdJournal],
          events: [createdEvent!],
          idempotencyRecords: [createdRecord],
        },
        {
          expectedRevision: 0,
          idempotencyKey: createdRecord.idempotencyKey,
          requestDigest: createdRecord.requestDigest,
        },
      ),
    ).resolves.toMatchObject({
      replayed: false,
      bundle: { manifest: { revision: 1, status: "created" } },
    });

    const coldManifest = await store.readManifest();
    expect(coldManifest.status).toBe("cold");
    expect(
      coldManifest.artifacts
        .filter((descriptor) => descriptor.taskId === FIXTURE_TASK_ID)
        .map((descriptor) => descriptor.artifactType)
        .sort(),
    ).toEqual([
      "task_event_log",
      "task_manifest",
      "task_operation_journal",
    ]);

    await store.persistArtifact(await loadRepositorySnapshot());
    await store.persistArtifact(await loadRepoPulse());

    const contextManifest = taskManifestArtifact(
      reference,
      2,
      "context_ready",
      CONTEXT_AT,
    );
    const contextResult = {
      task: contextManifest.payload,
      mutation: mutationResult(2, contextEvent!.eventId, [
        "artifact:task-manifest",
        "artifact:task-brief",
        "artifact:claim-ledger",
        "artifact:evidence-ledger",
        "artifact:impact",
        "artifact:task-operation-journal",
      ]),
      brief: contextualArtifacts(
        contextManifest,
        2,
        CONTEXT_AT,
        createdJournal,
      ).find((artifact) => artifact.artifactType === "task_brief")!.payload,
      claimIds: ["claim:goal", "claim:acceptance", "claim:recommendation"],
      evidenceIds: ["evidence:source"],
    };
    const contextReceipt = {
      schemaVersion: 1 as const,
      operation: "build_task_brief" as const,
      taskId: FIXTURE_TASK_ID,
      eventId: contextEvent!.eventId,
      resultDigest: sha256CanonicalJson(contextResult),
      result: contextResult,
    } satisfies TaskOperationReceiptV1;
    const contextRecord: IdempotencyRecordV1 = {
      ...receiptRecord(
        referenceRecords.idempotencyRecords[1]!,
        contextReceipt,
      ),
      scope: {
        kind: "task_create",
        createScope: "build_task_brief",
      },
    };
    const contextJournal = journalArtifact(
      2,
      CONTEXT_AT,
      [createdRecord, contextRecord],
      [createdReceipt, contextReceipt],
    );
    const revisionTwoArtifacts = contextualArtifacts(
      contextManifest,
      2,
      CONTEXT_AT,
      contextJournal,
    );

    const poisonedBuildResults = [
      {
        ...contextResult,
        brief: {
          ...contextResult.brief,
          originalIntent: "A forged Brief returned only by the receipt.",
        },
      },
      {
        ...contextResult,
        claimIds: contextResult.claimIds.slice(0, -1),
      },
      {
        ...contextResult,
        evidenceIds: [],
      },
    ];
    for (const poisonedResult of poisonedBuildResults) {
      const poisonedReceipt = TaskOperationReceiptV1Schema.parse({
        ...contextReceipt,
        resultDigest: sha256CanonicalJson(poisonedResult),
        result: poisonedResult,
      });
      const poisonedRecord = {
        ...contextRecord,
        resultDigest: poisonedReceipt.resultDigest,
      };
      const poisonedJournal = journalArtifact(
        2,
        CONTEXT_AT,
        [createdRecord, poisonedRecord],
        [createdReceipt, poisonedReceipt],
      );
      await expect(
        store.persistTaskBundle(
          {
            artifacts: contextualArtifacts(
              contextManifest,
              2,
              CONTEXT_AT,
              poisonedJournal,
            ),
            events: [createdEvent!, contextEvent!],
            idempotencyRecords: [createdRecord, poisonedRecord],
          },
          {
            expectedRevision: 1,
            idempotencyKey: poisonedRecord.idempotencyKey,
            requestDigest: poisonedRecord.requestDigest,
          },
        ),
      ).rejects.toMatchObject({
        code: "reference_integrity_failed",
        message: expect.stringContaining(
          "committed Brief, Claims, and Evidence",
        ),
      });
    }

    await expect(
      store.persistTaskBundle(
        {
          artifacts: revisionTwoArtifacts,
          events: [createdEvent!, contextEvent!],
          idempotencyRecords: [createdRecord, contextRecord],
        },
        {
          expectedRevision: 1,
          idempotencyKey: contextRecord.idempotencyKey,
          requestDigest: contextRecord.requestDigest,
        },
      ),
    ).resolves.toMatchObject({
      replayed: false,
      bundle: {
        manifest: { revision: 2, status: "context_ready" },
        changeChecks: [],
        verificationRecords: [],
      },
    });

    const reopened = await ArtifactStore.open(root, {
      repositoryId: FIXTURE_REPOSITORY_ID,
      worktreeId: FIXTURE_WORKTREE_ID,
      producerVersion: FIXTURE_PRODUCER_VERSION,
    });
    const trustedRevisionTwo = await reopened.readTaskBundle(FIXTURE_TASK_ID);
    expect(trustedRevisionTwo.bundle).toMatchObject({
      manifest: { revision: 2, status: "context_ready" },
      changeChecks: [],
      verificationRecords: [],
    });
    expect(trustedRevisionTwo.receipts).toEqual([
      createdReceipt,
      contextReceipt,
    ]);
    expect(
      trustedRevisionTwo.artifacts.map((artifact) => artifact.artifactType),
    ).not.toContain("change_check");
    expect(
      trustedRevisionTwo.artifacts.map((artifact) => artifact.artifactType),
    ).not.toContain("verification");

    const plannedEvent = appendPlannedEvent(contextEvent!);
    const plannedManifest = taskManifestArtifact(
      reference,
      3,
      "planned",
      PLANNED_AT,
    );
    const plannedResult = {
      task: plannedManifest.payload,
      mutation: mutationResult(3, plannedEvent.eventId, [
        "artifact:task-manifest",
        "artifact:task-brief",
        "artifact:claim-ledger",
        "artifact:evidence-ledger",
        "artifact:impact",
        "artifact:task-operation-journal",
      ]),
    };
    const plannedReceipt = {
      schemaVersion: 1 as const,
      operation: "update_task" as const,
      taskId: FIXTURE_TASK_ID,
      eventId: plannedEvent.eventId,
      resultDigest: sha256CanonicalJson(plannedResult),
      result: plannedResult,
    } satisfies TaskOperationReceiptV1;
    const plannedRecord: IdempotencyRecordV1 = {
      schemaVersion: 1,
      worktreeId: FIXTURE_WORKTREE_ID,
      scope: { kind: "task", taskId: FIXTURE_TASK_ID },
      idempotencyKey: plannedEvent.idempotencyKey,
      actor: plannedEvent.actor,
      requestDigest: plannedEvent.requestDigest,
      taskId: FIXTURE_TASK_ID,
      resultRevision: 3,
      eventId: plannedEvent.eventId,
      resultDigest: plannedReceipt.resultDigest,
      createdAt: plannedEvent.occurredAt,
    };
    const plannedJournal = journalArtifact(
      3,
      PLANNED_AT,
      [createdRecord, contextRecord, plannedRecord],
      [createdReceipt, contextReceipt, plannedReceipt],
    );
    const compactIndexPath =
      reopened.layout.task(FIXTURE_TASK_ID).idempotency;
    const revisionTwoCompactIndex =
      await readCompactIdempotencyIndex(compactIndexPath);
    expect(
      revisionTwoCompactIndex.records.every(
        (record) => record.scope !== undefined && record.actor !== undefined,
      ),
    ).toBe(true);
    const mixedLegacyRevisionTwoRecords:
      CompactIdempotencyIndexForTest["records"] =
      revisionTwoCompactIndex.records.map(
        (record) => {
          if (record.key === plannedRecord.idempotencyKey) return record;
          const { scope: _scope, actor: _actor, ...legacy } = record;
          return legacy;
        },
      );
    await writeCompactIdempotencyIndex(compactIndexPath, {
      version: 1,
      records: mixedLegacyRevisionTwoRecords,
    });
    await reopened.persistTaskBundle(
      {
        artifacts: contextualArtifacts(
          plannedManifest,
          3,
          PLANNED_AT,
          plannedJournal,
        ),
        events: [createdEvent!, contextEvent!, plannedEvent],
        idempotencyRecords: [
          createdRecord,
          contextRecord,
          plannedRecord,
        ],
      },
      {
        expectedRevision: 2,
        idempotencyKey: plannedRecord.idempotencyKey,
        requestDigest: plannedRecord.requestDigest,
      },
    );
    const revisionThreeCompactIndex =
      await readCompactIdempotencyIndex(compactIndexPath);
    expect(
      revisionThreeCompactIndex.records.filter(
        (record) => record.key === plannedRecord.idempotencyKey,
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: {
            kind: "task_create",
            createScope: "build_task_brief",
          },
        }),
        expect.objectContaining({
          scope: { kind: "task", taskId: FIXTURE_TASK_ID },
          actor: plannedRecord.actor,
          requestDigest: plannedRecord.requestDigest,
          resultRevision: 3,
        }),
      ]),
    );
    expect(
      revisionThreeCompactIndex.records.filter(
        (record) => record.scope === undefined,
      ),
    ).toHaveLength(
      mixedLegacyRevisionTwoRecords.filter(
        (record) => record.scope === undefined,
      ).length,
    );

    const historical = await reopened.lookupTaskOperationReceipt(
      FIXTURE_TASK_ID,
      createdRecord.scope,
      createdRecord.idempotencyKey,
    );
    expect(historical).toEqual({
      record: createdRecord,
      receipt: createdReceipt,
    });
    expect(historical!.receipt.result.mutation.revision).toBe(1);

    const latest = await reopened.readTaskBundle(FIXTURE_TASK_ID);
    expect(latest.bundle.manifest.revision).toBe(3);
    expect(latest.receipts).toHaveLength(3);

    const blockedEvent = appendBlockedEvent(plannedEvent);
    const blockedManifest = taskManifestArtifact(
      reference,
      4,
      "blocked",
      BLOCKED_AT,
    );
    const blockedResult = {
      task: blockedManifest.payload,
      mutation: mutationResult(4, blockedEvent.eventId, [
        "artifact:task-manifest",
        "artifact:task-brief",
        "artifact:claim-ledger",
        "artifact:evidence-ledger",
        "artifact:impact",
        "artifact:task-operation-journal",
      ]),
    };
    const blockedReceipt = {
      schemaVersion: 1 as const,
      operation: "update_task" as const,
      taskId: FIXTURE_TASK_ID,
      eventId: blockedEvent.eventId,
      resultDigest: sha256CanonicalJson(blockedResult),
      result: blockedResult,
    } satisfies TaskOperationReceiptV1;
    const blockedRecord: IdempotencyRecordV1 = {
      schemaVersion: 1,
      worktreeId: FIXTURE_WORKTREE_ID,
      scope: { kind: "task", taskId: FIXTURE_TASK_ID },
      idempotencyKey: blockedEvent.idempotencyKey,
      actor: blockedEvent.actor,
      requestDigest: blockedEvent.requestDigest,
      taskId: FIXTURE_TASK_ID,
      resultRevision: 4,
      eventId: blockedEvent.eventId,
      resultDigest: blockedReceipt.resultDigest,
      createdAt: blockedEvent.occurredAt,
    };
    const blockedRecords = [
      createdRecord,
      contextRecord,
      plannedRecord,
      blockedRecord,
    ];
    const blockedReceipts = [
      createdReceipt,
      contextReceipt,
      plannedReceipt,
      blockedReceipt,
    ];
    const blockedJournal = journalArtifact(
      4,
      BLOCKED_AT,
      blockedRecords,
      blockedReceipts,
    );
    const blockedInput = {
      artifacts: contextualArtifacts(
        blockedManifest,
        4,
        BLOCKED_AT,
        blockedJournal,
      ),
      events: [
        createdEvent!,
        contextEvent!,
        plannedEvent,
        blockedEvent,
      ],
      idempotencyRecords: blockedRecords,
    };
    const blockedControl = {
      expectedRevision: 3,
      idempotencyKey: blockedRecord.idempotencyKey,
      requestDigest: blockedRecord.requestDigest,
    };

    const mistimedBlockedRecord: IdempotencyRecordV1 = {
      ...blockedRecord,
      createdAt: PLANNED_AT,
    };
    const mistimedRecords = [
      createdRecord,
      contextRecord,
      plannedRecord,
      mistimedBlockedRecord,
    ];
    const mistimedJournal = journalArtifact(
      4,
      BLOCKED_AT,
      mistimedRecords,
      blockedReceipts,
    );
    await expect(
      reopened.persistTaskBundle(
        {
          artifacts: contextualArtifacts(
            blockedManifest,
            4,
            BLOCKED_AT,
            mistimedJournal,
          ),
          events: blockedInput.events,
          idempotencyRecords: mistimedRecords,
        },
        blockedControl,
      ),
    ).rejects.toMatchObject({
      code: "reference_integrity_failed",
      message: expect.stringContaining("audit time"),
    });

    const poisonedBriefInput = {
      ...blockedInput,
      artifacts: blockedInput.artifacts.map((artifact) => {
        if (artifact.artifactType !== "task_brief") return artifact;
        const payload = {
          ...artifact.payload,
          plannedChanges: artifact.payload.plannedChanges.map(
            (change, index) =>
              index === 0
                ? {
                    ...change,
                    intent:
                      "Silently replace context during an unrelated block action.",
                  }
                : change,
          ),
        };
        return TaskBriefArtifactV1Schema.parse({
          ...artifact,
          contentDigest: sha256CanonicalJson(payload),
          payload,
        });
      }),
    };
    await expect(
      reopened.persistTaskBundle(poisonedBriefInput, blockedControl),
    ).rejects.toMatchObject({
      code: "reference_integrity_failed",
      message: expect.stringContaining(
        "block_task cannot mutate task_brief",
      ),
    });

    const confirmPlanEvent = appendConfirmPlanEvent(plannedEvent);
    const confirmPlanManifest = taskManifestArtifact(
      reference,
      4,
      "planned",
      BLOCKED_AT,
    );
    const confirmPlanResult = {
      task: confirmPlanManifest.payload,
      mutation: mutationResult(4, confirmPlanEvent.eventId, [
        "artifact:task-manifest",
        "artifact:task-brief",
        "artifact:claim-ledger",
        "artifact:evidence-ledger",
        "artifact:impact",
        "artifact:task-operation-journal",
      ]),
    };
    const confirmPlanReceipt = {
      schemaVersion: 1 as const,
      operation: "update_task" as const,
      taskId: FIXTURE_TASK_ID,
      eventId: confirmPlanEvent.eventId,
      resultDigest: sha256CanonicalJson(confirmPlanResult),
      result: confirmPlanResult,
    } satisfies TaskOperationReceiptV1;
    const confirmPlanRecord: IdempotencyRecordV1 = {
      schemaVersion: 1,
      worktreeId: FIXTURE_WORKTREE_ID,
      scope: { kind: "task", taskId: FIXTURE_TASK_ID },
      idempotencyKey: confirmPlanEvent.idempotencyKey,
      actor: confirmPlanEvent.actor,
      requestDigest: confirmPlanEvent.requestDigest,
      taskId: FIXTURE_TASK_ID,
      resultRevision: 4,
      eventId: confirmPlanEvent.eventId,
      resultDigest: confirmPlanReceipt.resultDigest,
      createdAt: confirmPlanEvent.occurredAt,
    };
    const confirmPlanRecords = [
      createdRecord,
      contextRecord,
      plannedRecord,
      confirmPlanRecord,
    ];
    const confirmPlanJournal = journalArtifact(
      4,
      BLOCKED_AT,
      confirmPlanRecords,
      [
        createdReceipt,
        contextReceipt,
        plannedReceipt,
        confirmPlanReceipt,
      ],
    );
    const poisonedConfirmPlanArtifacts = contextualArtifacts(
      confirmPlanManifest,
      4,
      BLOCKED_AT,
      confirmPlanJournal,
    ).map((artifact) => {
      if (artifact.artifactType !== "task_brief") return artifact;
      const payload = {
        ...artifact.payload,
        plannedChanges: artifact.payload.plannedChanges.map(
          (change, index) =>
            index === 0
              ? {
                  ...change,
                  intent:
                    "Silently replace context during plan confirmation.",
                }
              : change,
        ),
      };
      return TaskBriefArtifactV1Schema.parse({
        ...artifact,
        contentDigest: sha256CanonicalJson(payload),
        payload,
      });
    });
    await expect(
      reopened.persistTaskBundle(
        {
          artifacts: poisonedConfirmPlanArtifacts,
          events: [
            createdEvent!,
            contextEvent!,
            plannedEvent,
            confirmPlanEvent,
          ],
          idempotencyRecords: confirmPlanRecords,
        },
        {
          expectedRevision: 3,
          idempotencyKey: confirmPlanRecord.idempotencyKey,
          requestDigest: confirmPlanRecord.requestDigest,
        },
      ),
    ).rejects.toMatchObject({
      code: "reference_integrity_failed",
      message: expect.stringContaining(
        "confirm_plan cannot mutate task_brief",
      ),
    });

    const confirmGoalEvent = appendConfirmGoalEvent(plannedEvent);
    const confirmGoalManifest = taskManifestArtifact(
      reference,
      4,
      "planned",
      BLOCKED_AT,
    );
    const confirmGoalResult = {
      task: confirmGoalManifest.payload,
      mutation: mutationResult(4, confirmGoalEvent.eventId, [
        "artifact:task-manifest",
        "artifact:task-brief",
        "artifact:claim-ledger",
        "artifact:evidence-ledger",
        "artifact:impact",
        "artifact:task-operation-journal",
      ]),
    };
    const confirmGoalReceipt = {
      schemaVersion: 1 as const,
      operation: "update_task" as const,
      taskId: FIXTURE_TASK_ID,
      eventId: confirmGoalEvent.eventId,
      resultDigest: sha256CanonicalJson(confirmGoalResult),
      result: confirmGoalResult,
    } satisfies TaskOperationReceiptV1;
    const confirmGoalRecord: IdempotencyRecordV1 = {
      schemaVersion: 1,
      worktreeId: FIXTURE_WORKTREE_ID,
      scope: { kind: "task", taskId: FIXTURE_TASK_ID },
      idempotencyKey: confirmGoalEvent.idempotencyKey,
      actor: confirmGoalEvent.actor,
      requestDigest: confirmGoalEvent.requestDigest,
      taskId: FIXTURE_TASK_ID,
      resultRevision: 4,
      eventId: confirmGoalEvent.eventId,
      resultDigest: confirmGoalReceipt.resultDigest,
      createdAt: confirmGoalEvent.occurredAt,
    };
    const confirmGoalRecords = [
      createdRecord,
      contextRecord,
      plannedRecord,
      confirmGoalRecord,
    ];
    const confirmGoalJournal = journalArtifact(
      4,
      BLOCKED_AT,
      confirmGoalRecords,
      [
        createdReceipt,
        contextReceipt,
        plannedReceipt,
        confirmGoalReceipt,
      ],
    );
    const humanEvidenceId = "evidence:human:goal-confirmation";
    const maliciousConfirmGoalArtifacts = contextualArtifacts(
      confirmGoalManifest,
      4,
      BLOCKED_AT,
      confirmGoalJournal,
    ).map((artifact) => {
      if (artifact.artifactType === "claim_ledger") {
        const payload = {
          claims: artifact.payload.claims.map((claim) => {
            if (claim.id === "claim:goal") {
              const {
                boundaryReason: _boundaryReason,
                derivationPath: _derivationPath,
                ...base
              } = claim;
              return {
                ...base,
                epistemicStatus: "human_confirmed" as const,
                lifecycleStatus: "supported" as const,
                freshness: "current" as const,
                evidenceIds: [humanEvidenceId],
                confirmationEventId: confirmGoalEvent.eventId,
                updatedAt: confirmGoalEvent.occurredAt,
              };
            }
            return claim.id === "claim:acceptance"
              ? {
                  ...claim,
                  statement:
                    "Maliciously rewrite an unrelated acceptance Claim.",
                }
              : claim;
          }),
        };
        return ClaimLedgerArtifactV1Schema.parse({
          ...artifact,
          contentDigest: sha256CanonicalJson(payload),
          payload,
        });
      }
      if (artifact.artifactType === "evidence_ledger") {
        const payload = {
          evidence: [
            ...artifact.payload.evidence,
            {
              id: humanEvidenceId,
              kind: "human" as const,
              epistemicStatus: "human_confirmed" as const,
              freshness: "current" as const,
              claimIds: ["claim:goal"],
              nodeIds: [],
              producedBy: "task-engine",
              createdAt: confirmGoalEvent.occurredAt,
              observedAtSnapshotId: SNAPSHOT_ID,
              confirmation: {
                actor: confirmGoalEvent.actor,
                input: "Task mutation history remains durable.",
                confirmedAt: confirmGoalEvent.occurredAt,
              },
            },
          ],
        };
        return EvidenceLedgerArtifactV1Schema.parse({
          ...artifact,
          contentDigest: sha256CanonicalJson(payload),
          payload,
        });
      }
      return artifact;
    });
    await expect(
      reopened.persistTaskBundle(
        {
          artifacts: maliciousConfirmGoalArtifacts,
          events: [
            createdEvent!,
            contextEvent!,
            plannedEvent,
            confirmGoalEvent,
          ],
          idempotencyRecords: confirmGoalRecords,
        },
        {
          expectedRevision: 3,
          idempotencyKey: confirmGoalRecord.idempotencyKey,
          requestDigest: confirmGoalRecord.requestDigest,
        },
      ),
    ).rejects.toMatchObject({
      code: "reference_integrity_failed",
      message: expect.stringContaining("non-target Claim"),
    });

    const staleEvent = appendMismatchedStaleEvent(plannedEvent);
    const stalePayload = {
      ...plannedManifest.payload,
      status: "stale" as const,
      revision: 4,
      updatedAt: BLOCKED_AT,
      staleState: {
        staleFromStatus: "planned" as const,
        reasonCodes: ["repository_snapshot_advanced"],
        detectedAtSnapshotId: "snapshot:contradictory",
        detectedAt: BLOCKED_AT,
      },
    };
    const staleManifest = TaskManifestArtifactV1Schema.parse({
      ...plannedManifest,
      revision: 4,
      createdAt: BLOCKED_AT,
      contentDigest: sha256CanonicalJson(stalePayload),
      payload: stalePayload,
    });
    const staleResult = {
      task: staleManifest.payload,
      mutation: mutationResult(4, staleEvent.eventId, [
        "artifact:task-manifest",
        "artifact:task-brief",
        "artifact:claim-ledger",
        "artifact:evidence-ledger",
        "artifact:impact",
        "artifact:task-operation-journal",
      ]),
    };
    const staleReceipt = {
      schemaVersion: 1 as const,
      operation: "update_task" as const,
      taskId: FIXTURE_TASK_ID,
      eventId: staleEvent.eventId,
      resultDigest: sha256CanonicalJson(staleResult),
      result: staleResult,
    } satisfies TaskOperationReceiptV1;
    const staleRecord: IdempotencyRecordV1 = {
      schemaVersion: 1,
      worktreeId: FIXTURE_WORKTREE_ID,
      scope: { kind: "task", taskId: FIXTURE_TASK_ID },
      idempotencyKey: staleEvent.idempotencyKey,
      actor: staleEvent.actor,
      requestDigest: staleEvent.requestDigest,
      taskId: FIXTURE_TASK_ID,
      resultRevision: 4,
      eventId: staleEvent.eventId,
      resultDigest: staleReceipt.resultDigest,
      createdAt: staleEvent.occurredAt,
    };
    const staleRecords = [
      createdRecord,
      contextRecord,
      plannedRecord,
      staleRecord,
    ];
    const staleJournal = journalArtifact(
      4,
      BLOCKED_AT,
      staleRecords,
      [
        createdReceipt,
        contextReceipt,
        plannedReceipt,
        staleReceipt,
      ],
    );
    await expect(
      reopened.persistTaskBundle(
        {
          artifacts: contextualArtifacts(
            staleManifest,
            4,
            BLOCKED_AT,
            staleJournal,
          ),
          events: [
            createdEvent!,
            contextEvent!,
            plannedEvent,
            staleEvent,
          ],
          idempotencyRecords: staleRecords,
        },
        {
          expectedRevision: 3,
          idempotencyKey: staleRecord.idempotencyKey,
          requestDigest: staleRecord.requestDigest,
        },
      ),
    ).rejects.toMatchObject({
      code: "reference_integrity_failed",
      message: expect.stringContaining("exact stale state"),
    });

    const rewrittenCreatedResult = {
      ...createdReceipt.result,
      task: {
        ...createdReceipt.result.task,
        parentTaskId: OTHER_TASK_ID,
      },
    };
    const rewrittenCreatedReceipt = {
      ...createdReceipt,
      resultDigest: sha256CanonicalJson(rewrittenCreatedResult),
      result: rewrittenCreatedResult,
    } satisfies TaskOperationReceiptV1;
    const rewrittenCreatedRecord = receiptRecord(
      createdRecord,
      rewrittenCreatedReceipt,
    );
    const rewrittenHistoryRecords = [
      rewrittenCreatedRecord,
      contextRecord,
      plannedRecord,
      blockedRecord,
    ];
    const rewrittenHistoryReceipts = [
      rewrittenCreatedReceipt,
      contextReceipt,
      plannedReceipt,
      blockedReceipt,
    ];
    const rewrittenHistoryJournal = journalArtifact(
      4,
      BLOCKED_AT,
      rewrittenHistoryRecords,
      rewrittenHistoryReceipts,
    );
    await expect(
      reopened.persistTaskBundle(
        {
          artifacts: contextualArtifacts(
            blockedManifest,
            4,
            BLOCKED_AT,
            rewrittenHistoryJournal,
          ),
          events: [
            createdEvent!,
            contextEvent!,
            plannedEvent,
            blockedEvent,
          ],
          idempotencyRecords: rewrittenHistoryRecords,
        },
        blockedControl,
      ),
    ).rejects.toMatchObject({
      code: "reference_integrity_failed",
      message: expect.stringContaining("historical Task result"),
    });

    const illegalBaselinePayload = {
      ...blockedManifest.payload,
      baselineSnapshotId: "snapshot:illegally-rebased",
    };
    const illegalBaselineManifest = TaskManifestArtifactV1Schema.parse({
      ...blockedManifest,
      contentDigest: sha256CanonicalJson(illegalBaselinePayload),
      payload: illegalBaselinePayload,
    });
    const illegalBaselineResult = {
      ...blockedReceipt.result,
      task: illegalBaselineManifest.payload,
    };
    const illegalBaselineReceipt = {
      ...blockedReceipt,
      resultDigest: sha256CanonicalJson(illegalBaselineResult),
      result: illegalBaselineResult,
    } satisfies TaskOperationReceiptV1;
    const illegalBaselineRecord = receiptRecord(
      blockedRecord,
      illegalBaselineReceipt,
    );
    const illegalBaselineRecords = [
      createdRecord,
      contextRecord,
      plannedRecord,
      illegalBaselineRecord,
    ];
    const illegalBaselineJournal = journalArtifact(
      4,
      BLOCKED_AT,
      illegalBaselineRecords,
      [
        createdReceipt,
        contextReceipt,
        plannedReceipt,
        illegalBaselineReceipt,
      ],
    );
    await expect(
      reopened.persistTaskBundle(
        {
          artifacts: contextualArtifacts(
            illegalBaselineManifest,
            4,
            BLOCKED_AT,
            illegalBaselineJournal,
          ),
          events: [
            createdEvent!,
            contextEvent!,
            plannedEvent,
            blockedEvent,
          ],
          idempotencyRecords: illegalBaselineRecords,
        },
        blockedControl,
      ),
    ).rejects.toMatchObject({
      code: "reference_integrity_failed",
      message: expect.stringContaining(
        "baselineSnapshotId may change only through rebase_task",
      ),
    });

    await expect(
      reopened.persistTaskBundle(
        {
          ...blockedInput,
          artifacts: blockedInput.artifacts.filter(
            (artifact) =>
              artifact.artifactType !== "task_operation_journal",
          ),
        },
        {
          ...blockedControl,
          historyImport: true,
        },
      ),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });

    const cacheBeforeSameScopeConflict =
      await readCompactIdempotencyIndex(compactIndexPath);
    await writeCompactIdempotencyIndex(compactIndexPath, {
      version: 1,
      records: [
        ...cacheBeforeSameScopeConflict.records,
        {
          key: blockedRecord.idempotencyKey,
          requestDigest: blockedRecord.requestDigest,
          scope: { kind: "task", taskId: FIXTURE_TASK_ID },
          actor: "reviewer",
          artifactType: "task_manifest",
          artifactId: plannedManifest.artifactId,
          resultRevision: 3,
          resultDigest: plannedManifest.contentDigest,
          recordedAt: PLANNED_AT,
        },
      ],
    });
    await expect(
      reopened.persistTaskBundle(blockedInput, blockedControl),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    await writeCompactIdempotencyIndex(
      compactIndexPath,
      cacheBeforeSameScopeConflict,
    );

    await expect(
      reopened.persistTaskBundle(blockedInput, {
        ...blockedControl,
        artifactWrite: {
          faultInjector({ stage, targetPath }) {
            if (
              stage === "before_rename" &&
              targetPath.endsWith("operation-journal.json")
            ) {
              throw new Error("journal write interrupted");
            }
          },
        },
      }),
    ).rejects.toMatchObject({ code: "artifact_corrupt" });
    await expect(
      reopened.readTaskBundle(FIXTURE_TASK_ID),
    ).resolves.toMatchObject({
      bundle: { manifest: { revision: 3, status: "planned" } },
      receipts: { length: 3 },
    });
    expect(
      (await readdir(reopened.layout.taskTransactions)).filter(
        (entry) => entry.endsWith(".json"),
      ),
    ).toEqual([]);
    await expect(
      reopened.persistTaskBundle(blockedInput, blockedControl),
    ).resolves.toMatchObject({
      replayed: false,
      bundle: { manifest: { revision: 4, status: "blocked" } },
    });
    expect(
      (await readdir(reopened.layout.taskTransactions)).filter(
        (entry) => entry.endsWith(".json"),
      ),
    ).toEqual([]);
  });

  it("rejects a Task baseline not declared by the trusted Repo Pulse", async () => {
    const root = await createTemporaryWorktree(
      "artifact-store-missing-task-baseline-",
    );
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    await store.persistArtifact(await loadRepoPulse());
    const reference =
      await loadContractFixture<TaskManifestArtifactV1>(
        "reference/task.json",
      );
    const referenceRecords =
      await loadContractFixture<{
        idempotencyRecords: IdempotencyRecordV1[];
      }>("reference/task-bundle.json");
    const [createdEvent] = await loadReferenceEvents();
    const created = taskManifestArtifact(
      reference,
      1,
      "created",
      CREATED_AT,
    );
    const payload = {
      ...created.payload,
      baselineSnapshotId: "snapshot:never-published",
    };
    const manifest = TaskManifestArtifactV1Schema.parse({
      ...created,
      contentDigest: sha256CanonicalJson(payload),
      payload,
    });
    const result = {
      task: manifest.payload,
      mutation: mutationResult(1, createdEvent!.eventId, [
        manifest.artifactId,
        "artifact:task-operation-journal",
      ]),
    };
    const receipt = {
      schemaVersion: 1 as const,
      operation: "task_created" as const,
      taskId: FIXTURE_TASK_ID,
      eventId: createdEvent!.eventId,
      resultDigest: sha256CanonicalJson(result),
      result,
    } satisfies TaskOperationReceiptV1;
    const record = receiptRecord(
      referenceRecords.idempotencyRecords[0]!,
      receipt,
    );
    const journal = journalArtifact(
      1,
      CREATED_AT,
      [record],
      [receipt],
    );

    await expect(
      store.persistTaskBundle(
        {
          artifacts: [manifest, journal],
          events: [createdEvent!],
          idempotencyRecords: [record],
        },
        {
          expectedRevision: 0,
          idempotencyKey: record.idempotencyKey,
          requestDigest: record.requestDigest,
        },
      ),
    ).rejects.toMatchObject({
      code: "reference_integrity_failed",
      details: {
        baselineSnapshotId: "snapshot:never-published",
        pulseBaselineSnapshotId: "snapshot:baseline",
      },
    });
  });
});
