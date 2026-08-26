import { describe, expect, it } from "vitest";

import {
  ActualChangeV1Schema,
  ContextGenerationInputV1Schema,
  PathSafeRepositorySnapshotIdV1Schema,
  TaskManifestV1Schema,
} from "../src/index.js";

const digest = (digit: string): string => `sha256:${digit.repeat(64)}`;
const targetSnapshotId = PathSafeRepositorySnapshotIdV1Schema.parse(
  `snapshot-${"a".repeat(64)}`,
);
const baselineSnapshotId = PathSafeRepositorySnapshotIdV1Schema.parse(
  `snapshot-${"b".repeat(64)}`,
);
const contextBuildSpecDigest = digest("1");

const validGenerationInput = {
  version: "context-generation-input-v1" as const,
  taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  resultingRevision: 2,
  baselineSnapshotId,
  targetSnapshotId,
  contextBuildSpecDigest,
  upstreamDependencyPins: [
    {
      pinKind: "artifact" as const,
      role: "graph" as const,
      artifactId: "artifact:graph:current",
      contentDigest: digest("2"),
      sourceSnapshotId: targetSnapshotId,
    },
    {
      pinKind: "artifact" as const,
      role: "repo_pulse" as const,
      artifactId: "artifact:repo-pulse:current",
      contentDigest: digest("3"),
      sourceSnapshotId: targetSnapshotId,
    },
    {
      pinKind: "artifact" as const,
      role: "repository_snapshot" as const,
      artifactId: targetSnapshotId,
      contentDigest: digest("4"),
      sourceSnapshotId: targetSnapshotId,
    },
    {
      pinKind: "artifact_absence" as const,
      role: "source_evidence" as const,
      reasonCode: "policy_excluded" as const,
    },
    {
      pinKind: "artifact_absence" as const,
      role: "wiki" as const,
      reasonCode: "not_generated" as const,
    },
    {
      pinKind: "policy" as const,
      role: "policy" as const,
      policyKind: "context_build" as const,
      contentDigest: contextBuildSpecDigest,
    },
    {
      pinKind: "policy" as const,
      role: "policy" as const,
      policyKind: "repository" as const,
      contentDigest: digest("5"),
    },
    {
      pinKind: "policy" as const,
      role: "policy" as const,
      policyKind: "safe_git_execution" as const,
      contentDigest: digest("6"),
    },
    {
      pinKind: "policy" as const,
      role: "policy" as const,
      policyKind: "scanner" as const,
      contentDigest: digest("7"),
    },
  ],
};

const validActual = {
  id: `actual-change:${"1".repeat(22)}`,
  repositoryPathDeltaId: `repository-path-delta:${"2".repeat(22)}`,
  effectiveChangeId: `repository-effective-change:${"3".repeat(22)}`,
  path: "src/a.ts",
  kind: "added" as const,
  sourceLayers: ["staged" as const],
  granularity: "file" as const,
  oldSymbolRefs: [],
  newSymbolRefs: [],
  pairingStatus: "file_only" as const,
  semanticFacets: ["TOPOLOGY" as const],
  diffEvidenceIds: [],
  boundaryEvidenceIds: [],
  analysisStatus: "complete" as const,
};

describe("strong Change Intelligence conditional contracts", () => {
  it("requires the exact Context Generation dependency cardinality, pins, and order", () => {
    expect(ContextGenerationInputV1Schema.safeParse(validGenerationInput).success)
      .toBe(true);
    expect(ContextGenerationInputV1Schema.safeParse({
      ...validGenerationInput,
      upstreamDependencyPins:
        validGenerationInput.upstreamDependencyPins.filter(
          (pin) => !(pin.pinKind === "policy" && pin.policyKind === "scanner"),
        ),
    }).success).toBe(false);
    expect(ContextGenerationInputV1Schema.safeParse({
      ...validGenerationInput,
      upstreamDependencyPins: [
        validGenerationInput.upstreamDependencyPins[1],
        validGenerationInput.upstreamDependencyPins[0],
        ...validGenerationInput.upstreamDependencyPins.slice(2),
      ],
    }).success).toBe(false);
    expect(ContextGenerationInputV1Schema.safeParse({
      ...validGenerationInput,
      upstreamDependencyPins: validGenerationInput.upstreamDependencyPins.map(
        (pin) => pin.pinKind === "artifact" && pin.role === "repo_pulse"
          ? { ...pin, sourceSnapshotId: baselineSnapshotId }
          : pin,
      ),
    }).success).toBe(false);
  });

  it("enforces Actual kind, pairing, granularity, source order, and completeness", () => {
    expect(ActualChangeV1Schema.safeParse(validActual).success).toBe(true);
    expect(ActualChangeV1Schema.safeParse({
      ...validActual,
      pairingStatus: "old_only",
    }).success).toBe(false);
    expect(ActualChangeV1Schema.safeParse({
      ...validActual,
      sourceLayers: ["unstaged", "staged"],
    }).success).toBe(false);
    expect(ActualChangeV1Schema.safeParse({
      ...validActual,
      semanticFacets: ["UNKNOWN"],
    }).success).toBe(false);
    expect(ActualChangeV1Schema.safeParse({
      ...validActual,
      newSymbolRefs: [{ id: "caller-supplied" }],
    }).success).toBe(false);
  });

  it("requires baseline/spec/generation together for contextual strong Tasks", () => {
    const manifest = {
      schemaVersion: 1,
      taskId: validGenerationInput.taskId,
      title: "Strong task",
      originalIntent: "Build the strong slice",
      status: "context_ready",
      repositoryId: `repo-hmac-${"1".repeat(64)}`,
      worktreeId: `worktree-hmac-${"2".repeat(64)}`,
      baselineSnapshotId,
      latestSnapshotId: targetSnapshotId,
      taskProfile: "agent_task_v1",
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:01.000Z",
      producerVersion: "1.0.0",
      revision: 2,
    };
    expect(TaskManifestV1Schema.safeParse(manifest).success).toBe(false);
    expect(TaskManifestV1Schema.safeParse({
      ...manifest,
      taskBaselineArtifactId: `task-baseline:${"3".repeat(22)}`,
      contextBuildSpec: {
        version: "context-build-spec-v1",
        scope: [],
        tokenBudget: 8_000,
        maxCandidates: 20,
        maxImpactDepth: 4,
      },
    }).success).toBe(false);
    expect(TaskManifestV1Schema.safeParse({
      ...manifest,
      taskBaselineArtifactId: `task-baseline:${"3".repeat(22)}`,
      contextBuildSpec: {
        version: "context-build-spec-v1",
        scope: [],
        tokenBudget: 8_000,
        maxCandidates: 20,
        maxImpactDepth: 4,
      },
      contextGenerationId: `context-generation:${"4".repeat(22)}`,
    }).success).toBe(true);
  });
});
