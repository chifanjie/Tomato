import {
  EvidenceBackedChangeCheckV1Schema,
  PathSafeRepositorySnapshotIdV1Schema,
  StrongChangeCheckCommitRequestV1Schema,
  TaskBriefV1Schema,
  TaskManifestV1Schema,
} from "@understand-code/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  ArtifactStore,
  ArtifactStoreStrongChangeAuthorityV1,
  type StrongChangeProviderAuthorityV1,
} from "../src/index.js";

const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const baselineSnapshotId = PathSafeRepositorySnapshotIdV1Schema.parse(
  `snapshot-${"a".repeat(64)}`,
);
const actualSnapshotId = PathSafeRepositorySnapshotIdV1Schema.parse(
  `snapshot-${"b".repeat(64)}`,
);
const foreignSnapshotId = PathSafeRepositorySnapshotIdV1Schema.parse(
  `snapshot-${"c".repeat(64)}`,
);
const contentDigest = (digit: string): string =>
  `sha256:${digit.repeat(64)}`;

function taskRead(revision = 5) {
  const contextGenerationId = `context-generation:${"1".repeat(22)}`;
  const manifest = TaskManifestV1Schema.parse({
    schemaVersion: 1,
    taskId,
    title: "Strong authority fixture",
    originalIntent: "Verify exact authority cuts",
    status: "check_required",
    repositoryId: `repo-hmac-${"1".repeat(64)}`,
    worktreeId: `worktree-hmac-${"2".repeat(64)}`,
    baselineSnapshotId,
    latestSnapshotId: actualSnapshotId,
    taskProfile: "agent_task_v1",
    taskBaselineArtifactId: `task-baseline:${"2".repeat(22)}`,
    contextBuildSpec: {
      version: "context-build-spec-v1",
      scope: [],
      tokenBudget: 8_000,
      maxCandidates: 20,
      maxImpactDepth: 4,
    },
    contextGenerationId,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:05.000Z",
    producerVersion: "1.0.0",
    revision,
  });
  const brief = TaskBriefV1Schema.parse({
    contextGenerationId,
    originalIntent: manifest.originalIntent,
    goalClaimId: "claim:goal",
    nonGoalClaimIds: [],
    acceptanceClaimIds: ["claim:acceptance"],
    readingPath: [],
    plannedChanges: [],
    assumptionClaimIds: [],
    riskClaimIds: [],
    unknownClaimIds: [],
    verificationPlan: [],
  });
  return {
    bundle: {
      manifest,
      brief,
      claims: [],
      evidence: [],
      impactPaths: [],
      changeChecks: [],
      verificationRecords: [],
      events: [],
      idempotencyRecords: [],
    },
    receipts: [],
  };
}

function provider(): StrongChangeProviderAuthorityV1 {
  return {
    async inspectState() {
      return { revision: 0 };
    },
    async readExactObject() {
      throw new Error("not reached");
    },
    async writeExactObject() {
      throw new Error("not reached");
    },
    async compareCommit() {
      throw new Error("not reached");
    },
  };
}

function operation(actual = actualSnapshotId, expectedRevision = 5) {
  return {
    profile: "check_changes_strong_v1" as const,
    taskId,
    actualSnapshotId: actual,
    includeWorktree: true as const,
    expectedRevision,
    idempotencyKey: "strong-check-once",
    actor: "codex",
  };
}

function storeForTask(revision = 5): {
  store: ArtifactStore;
  readArtifact: ReturnType<typeof vi.fn>;
} {
  const readArtifact = vi.fn();
  return {
    store: {
      readTaskBundle: vi.fn(async () => taskRead(revision)),
      readArtifact,
      abortReservedStrongOperationIntent: vi.fn(async () => false),
    } as unknown as ArtifactStore,
    readArtifact,
  };
}

function budget() {
  return {
    version: "change-analysis-budget-v1" as const,
    maxChangedFiles: 1,
    maxBytesPerFile: 1,
    maxTotalBytes: 1,
    maxLinesPerFile: 1,
    maxTotalLines: 1,
    maxEditWorkUnits: 1,
    maxHunksPerFile: 1,
    maxTotalHunks: 1,
    maxParserNodesPerFile: 1,
    maxTotalParserNodes: 1,
    maxMatchingWorkUnits: 1,
    maxImpactNodes: 1,
    maxImpactEdges: 1,
    maxImpactTraversalWorkUnits: 1,
    maxImpactPaths: 1,
    maxExcerptCharsPerEvidence: 1,
    maxTotalExcerptChars: 1,
    maxActualChanges: 1,
    maxEvidenceItems: 1,
    maxSymbolRefs: 1,
    maxSerializedArtifactBytes: 1,
  };
}

function usage() {
  return {
    changedFiles: 0,
    analyzedFiles: 0,
    bytes: 0,
    lines: 0,
    editWorkUnits: 0,
    hunks: 0,
    parserNodes: 0,
    matchingWorkUnits: 0,
    impactNodes: 0,
    impactEdges: 0,
    impactTraversalWorkUnits: 0,
    impactPaths: 0,
    excerptChars: 0 as const,
    actualChanges: 0,
    evidenceItems: 0,
    symbolRefs: 0,
    serializedArtifactBytes: 0,
  };
}

function readSetDriftCommit() {
  const dimensions = [
    "repository_delta",
    "semantic_classification",
    "planned_matching",
    "impact_analysis",
    "verification_coverage",
  ].map((dimension) => ({
    dimension,
    status: "complete",
    units: [],
    boundaryEvidenceIds: [],
  }));
  const repositoryDelta = {
    profile: "final-tree-delta-v1" as const,
    taskId,
    baselineSnapshotId,
    actualSnapshotId,
    paths: [],
    redactedAggregates: [],
    status: "complete" as const,
    boundaryIds: [],
  };
  const check = EvidenceBackedChangeCheckV1Schema.parse({
    schemaVersion: 1,
    id: "change-check:fixture",
    taskId,
    taskRevision: 6,
    baselineSnapshotId,
    actualSnapshotId,
    findings: [],
    analysis: {
      profile: "evidence_backed_v1",
      rulesetVersion: "1.0.0",
      budget: budget(),
      usage: usage(),
      basisRecordId: `repository-basis-record:${"3".repeat(22)}`,
      basisRecordContentDigest: contentDigest("3"),
      repositoryBasisDigest: contentDigest("4"),
      repositoryReadSetDigest: contentDigest("5"),
      graphArtifactId: "artifact:graph-fixture",
      graphContentDigest: contentDigest("d"),
      graphSourceSnapshotId: baselineSnapshotId,
      analysisInputDigest: contentDigest("6"),
      semanticDigest: contentDigest("7"),
      repositoryDelta,
      actualChanges: [],
      completeness: { overall: "complete", dimensions },
    },
    generatedAt: "2026-08-25T00:00:06.000Z",
  });
  return StrongChangeCheckCommitRequestV1Schema.parse({
    profile: "strong_change_check_commit_v1",
    expectedRevision: 5,
    idempotencyKey: "strong-check-once",
    actor: "codex",
    requestDigest: contentDigest("8"),
    authorityToken: `hmac-sha256:${"9".repeat(64)}`,
    changeCheck: check,
    findingClaims: [],
    evidence: [],
    impactConclusion: {
      status: "none_observed",
      impactPathIds: [],
      boundaryEvidenceIds: [],
    },
    commitEvidence: {
      profile: "strong_change_commit_evidence_v1",
      recovery: { markerFirst: true, idempotencyReplaySafe: true },
      security: {
        scannerPolicyDigest: contentDigest("a"),
        safeGitExecutionDigest: contentDigest("b"),
        persistedExcerptChars: 0,
      },
      readSet: {
        basisRecordId: `repository-basis-record:${"3".repeat(22)}`,
        basisDigest: contentDigest("4"),
        readSetDigest: contentDigest("c"),
        finalValidation: "provider_exact_cut_v1",
      },
      provenance: {
        taskBaselineArtifactId: `task-baseline:${"2".repeat(22)}`,
        baselineSnapshotId,
        actualSnapshotId,
        analysisInputDigest: contentDigest("6"),
        semanticDigest: contentDigest("7"),
      },
    },
  });
}

describe("ArtifactStore strong Change authority", () => {
  it("stays fail-closed when no production Provider is installed", async () => {
    const { store } = storeForTask();
    const authority = new ArtifactStoreStrongChangeAuthorityV1(store);
    await expect(authority.prepareCheck(operation())).rejects.toMatchObject({
      code: "strong_write_locked",
    });
  });

  it("rejects a caller Snapshot assertion that is not the exact Task pin", async () => {
    const { store, readArtifact } = storeForTask();
    const authority = new ArtifactStoreStrongChangeAuthorityV1(store, {
      provider: provider(),
    });
    await expect(
      authority.prepareCheck(operation(foreignSnapshotId)),
    ).rejects.toMatchObject({ code: "strong_snapshot_pin_mismatch" });
    expect(readArtifact).not.toHaveBeenCalled();
  });

  it("detects Task CAS conflict before any repository/provider read", async () => {
    const { store, readArtifact } = storeForTask(6);
    const authority = new ArtifactStoreStrongChangeAuthorityV1(store, {
      provider: provider(),
    });
    await expect(authority.prepareCheck(operation(actualSnapshotId, 5)))
      .rejects.toMatchObject({ code: "repository_cas_conflict" });
    expect(readArtifact).not.toHaveBeenCalled();
  });

  it("rejects read-set drift before the Provider compare-append", async () => {
    const candidateProvider = provider();
    const commit = vi.spyOn(
      candidateProvider,
      "compareCommit",
    );
    const { store, readArtifact } = storeForTask();
    const authority = new ArtifactStoreStrongChangeAuthorityV1(store, {
      provider: candidateProvider,
    });
    await expect(authority.commitCheck(readSetDriftCommit())).rejects
      .toMatchObject({ code: "repository_read_set_conflict" });
    expect(readArtifact).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });
});
