import { readFile } from "node:fs/promises";

import type { ReadTaskBundleResult } from "@understand-code/artifact-store";
import {
  containsAbsoluteFilesystemPathV1,
  RepoPulseV1Schema,
  RepositorySnapshotV1Schema,
  TaskManifestV1Schema,
} from "@understand-code/contracts";
import type { KnowledgeGraph } from "@understand-code/core";
import { describe, expect, it } from "vitest";

import { buildContextDraft } from "../src/context-builder.js";
import { renderTaskBriefMarkdown } from "../src/renderer.js";

const TASK_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

async function repositoryFixtures() {
  const snapshotArtifact = JSON.parse(
    await readFile(
      new URL(
        "../../contracts/fixtures/v1/reference/repository-snapshot.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { payload: unknown };
  const pulseArtifact = JSON.parse(
    await readFile(
      new URL(
        "../../contracts/fixtures/v1/reference/repo-pulse.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { payload: Record<string, unknown> };
  const repositorySnapshot = RepositorySnapshotV1Schema.parse(
    snapshotArtifact.payload,
  );
  const basePulse = pulseArtifact.payload as {
    artifactFreshness: Record<string, string>;
    completeness: {
      parser: Record<string, unknown>;
      callGraph: Record<string, unknown>;
    };
  } & Record<string, unknown>;
  const pulse = RepoPulseV1Schema.parse({
    ...basePulse,
    status: "partial",
    artifactFreshness: {
      ...basePulse.artifactFreshness,
      graph: "fresh",
    },
    completeness: {
      ...basePulse.completeness,
      callGraph: {
        status: "partial",
        coverage: 0.5,
        reasons: ["Dynamic call targets are unresolved."],
      },
    },
    recommendedRefresh: "incremental",
    reasons: ["Call Graph coverage is partial."],
  });
  return { repositorySnapshot, pulse };
}

function isolatedGraph(): KnowledgeGraph {
  return {
    version: "1",
    project: {
      name: "isolated-impact-boundary",
      languages: ["TypeScript"],
      frameworks: [],
      description: "One candidate with an incomplete Call Graph",
      analyzedAt: "2026-07-29T00:00:00Z",
      gitCommitHash: "a".repeat(40),
    },
    nodes: [
      {
        id: "isolated-handler",
        type: "function",
        name: "IsolatedHandler",
        filePath: "src/isolated-handler.ts",
        lineRange: [1, 20],
        summary: "Handles an isolated request path.",
        tags: ["entry"],
        complexity: "simple",
      },
    ],
    edges: [],
    layers: [],
    tour: [],
  };
}

function wideImpactGraph(): KnowledgeGraph {
  const nodes = Array.from({ length: 25 }, (_, index) => {
    const suffix = String(index).padStart(2, "0");
    return {
      id: `wide-handler-${suffix}`,
      type: "function" as const,
      name: `WideHandler ${suffix}`,
      filePath: `src/wide-handler-${suffix}.ts`,
      lineRange: [1, 20] as [number, number],
      summary: "Handles the wide impact benchmark request.",
      tags: ["wide", "handler"],
      complexity: "simple" as const,
    };
  });
  return {
    version: "1",
    project: {
      name: "wide-impact-boundary",
      languages: ["TypeScript"],
      frameworks: [],
      description: "A wide graph that exceeds the path materialization budget",
      analyzedAt: "2026-07-29T00:00:00Z",
      gitCommitHash: "a".repeat(40),
    },
    nodes,
    edges: nodes.slice(1).map((target) => ({
      source: nodes[0]!.id,
      target: target.id,
      type: "calls",
      direction: "forward",
      weight: 1,
    })),
    layers: [],
    tour: [],
  };
}

function obligationMappingGraph(): KnowledgeGraph {
  const sourceNodes = Array.from({ length: 12 }, (_, index) => {
    const suffix = String(index).padStart(2, "0");
    return {
      id: `obligation-handler-${suffix}`,
      type: "function" as const,
      name: `Obligation Mapping Handler ${suffix}`,
      filePath: `src/obligation-handler-${suffix}.ts`,
      lineRange: [1, 20] as [number, number],
      summary: "Handles the obligation mapping request.",
      tags: ["obligation", "mapping", "handler"],
      complexity: "simple" as const,
    };
  });
  const testNode = {
    id: "obligation-handler-test",
    type: "function" as const,
    name: "Obligation Mapping Fixture",
    filePath: "test/obligation-handler.test.ts",
    lineRange: [1, 20] as [number, number],
    summary: "Covers the obligation mapping request.",
    tags: ["obligation", "mapping"],
    complexity: "simple" as const,
  };
  return {
    version: "1",
    project: {
      name: "obligation-mapping",
      languages: ["TypeScript"],
      frameworks: [],
      description: "Deterministic CandidateLevel obligation mapping fixture",
      analyzedAt: "2026-07-29T00:00:00Z",
      gitCommitHash: "a".repeat(40),
    },
    nodes: [...sourceNodes, testNode],
    edges: [],
    layers: [],
    tour: [],
  };
}

describe("Task context impact boundaries", () => {
  it("maps every CandidateLevel to an explicit PlannedChange expectation", async () => {
    const { repositorySnapshot, pulse } = await repositoryFixtures();
    const graph = obligationMappingGraph();
    const draft = buildContextDraft({
      taskId: TASK_ID,
      intent: "Update obligation mapping safely",
      snapshotId: repositorySnapshot.snapshotId,
      createdAt: "2026-07-29T08:00:00.001Z",
      pulse,
      repositorySnapshot,
      context: {
        graph,
        existingFilePaths: graph.nodes.map((node) => node.filePath!),
      },
      maxCandidates: graph.nodes.length,
      tokenBudget: 8_000,
    });

    expect(draft.brief.plannedChanges).toHaveLength(graph.nodes.length);
    const mappings = Object.fromEntries(
      [
        "must_inspect",
        "likely_change",
        "possible_change",
        "test_or_verify",
        "context_only",
      ].map((level) => [
        level,
        [...new Set(
          draft.brief.plannedChanges
            .filter((change) => change.candidateLevel === level)
            .map((change) => change.expectation),
        )],
      ]),
    );
    expect(mappings).toEqual({
      must_inspect: ["inspect_only"],
      likely_change: ["required_change"],
      possible_change: ["optional_change"],
      test_or_verify: ["verification_only"],
      context_only: ["inspect_only"],
    });
    expect(
      draft.brief.verificationPlan.every((entry) => entry.required === true),
    ).toBe(true);
  });

  it("keeps a global incomplete-Call-Graph boundary when traversal returns zero paths", async () => {
    const { repositorySnapshot, pulse } = await repositoryFixtures();
    const createdAt = "2026-07-29T08:00:00.001Z";
    const draft = buildContextDraft({
      taskId: TASK_ID,
      intent: "Update IsolatedHandler safely",
      snapshotId: repositorySnapshot.snapshotId,
      createdAt,
      pulse,
      repositorySnapshot,
      context: {
        graph: isolatedGraph(),
        existingFilePaths: ["src/isolated-handler.ts"],
      },
      maxCandidates: 5,
      maxImpactDepth: 4,
    });

    expect(draft.impactPaths).toEqual([]);
    const impactUnknown = draft.claims.find(
      (claim) =>
        claim.statement ===
        "Impact coverage has an explicit analysis boundary.",
    );
    expect(impactUnknown).toMatchObject({
      kind: "unknown",
      epistemicStatus: "unknown",
      boundaryReason: expect.stringContaining(
        "Dynamic call targets are unresolved.",
      ),
    });
    expect(draft.brief.unknownClaimIds).toContain(impactUnknown!.id);

    const manifest = TaskManifestV1Schema.parse({
      schemaVersion: 1,
      taskId: TASK_ID,
      title: "Update IsolatedHandler safely",
      originalIntent: "Update IsolatedHandler safely",
      status: "context_ready",
      repositoryId: repositorySnapshot.repositoryId,
      worktreeId: repositorySnapshot.worktreeId,
      baselineSnapshotId: pulse.baselineSnapshotId,
      latestSnapshotId: repositorySnapshot.snapshotId,
      createdAt,
      updatedAt: createdAt,
      producerVersion: "3.0.0-alpha.1",
      revision: 2,
    });
    const markdown = renderTaskBriefMarkdown({
      bundle: {
        manifest,
        brief: draft.brief,
        claims: draft.claims,
        evidence: draft.evidence,
        impactPaths: draft.impactPaths,
        changeChecks: [],
        verificationRecords: [],
        events: [],
        idempotencyRecords: [],
      },
      artifacts: [],
      receipts: [],
      state: "current",
      freshness: "partial",
      latestSnapshotId: repositorySnapshot.snapshotId,
      recoveryState: "current",
    } as unknown as ReadTaskBundleResult);
    expect(markdown).toContain("## Impact boundaries");
    expect(markdown).toContain("Dynamic call targets are unresolved.");
    expect(markdown).not.toContain("No impact truncation is recorded.");
  });

  it("excludes files the Host did not verify and records an unknown boundary", async () => {
    const { repositorySnapshot, pulse } = await repositoryFixtures();
    const draft = buildContextDraft({
      taskId: TASK_ID,
      intent: "Update IsolatedHandler safely",
      snapshotId: repositorySnapshot.snapshotId,
      createdAt: "2026-07-29T08:00:00.001Z",
      pulse,
      repositorySnapshot,
      context: {
        graph: isolatedGraph(),
        existingFilePaths: [],
      },
      maxCandidates: 5,
      maxImpactDepth: 4,
    });

    expect(draft.brief.readingPath).toEqual([]);
    expect(draft.brief.plannedChanges).toEqual([]);
    const boundary = draft.claims.find(
      (claim) =>
        claim.statement ===
        "Candidate coverage has an explicit analysis boundary.",
    );
    expect(boundary?.boundaryReason).toContain(
      "file existence was not verified for this Snapshot",
    );
    expect(boundary?.boundaryReason).toContain("isolated-handler");
    expect(draft.brief.unknownClaimIds).toContain(boundary!.id);
  });

  it("applies Host eligibility before rank and budget allocation", async () => {
    const { repositorySnapshot, pulse } = await repositoryFixtures();
    const invalidNodes = Array.from({ length: 10 }, (_, index) => ({
      id: `invalid-priority-${String(index).padStart(2, "0")}`,
      type: "function" as const,
      name: "PriorityHandler",
      filePath: `src/invalid-${String(index).padStart(2, "0")}.ts`,
      lineRange: [1, 20] as [number, number],
      summary: "PriorityHandler owns the requested change.",
      tags: ["priority"],
      complexity: "simple" as const,
    }));
    const validNode = {
      id: "valid-priority",
      type: "function" as const,
      name: "PriorityHandler",
      filePath: "src/valid-priority.ts",
      lineRange: [1, 20] as [number, number],
      summary: "PriorityHandler owns the requested change.",
      tags: ["priority"],
      complexity: "simple" as const,
    };
    const graph: KnowledgeGraph = {
      version: "1",
      project: isolatedGraph().project,
      nodes: [...invalidNodes, validNode],
      edges: [],
      layers: [],
      tour: [],
    };
    const draft = buildContextDraft({
      taskId: TASK_ID,
      intent: "Update PriorityHandler safely",
      snapshotId: repositorySnapshot.snapshotId,
      createdAt: "2026-07-29T08:00:00.001Z",
      pulse,
      repositorySnapshot,
      context: {
        graph,
        existingFilePaths: [validNode.filePath],
      },
      maxCandidates: 1,
      tokenBudget: 8_000,
    });

    expect(draft.brief.readingPath).toMatchObject([
      {
        order: 0,
        filePath: validNode.filePath,
        symbolId: validNode.id,
      },
    ]);
    expect(draft.brief.plannedChanges).toMatchObject([
      {
        filePath: validNode.filePath,
        symbolId: validNode.id,
        candidateLevel: "must_inspect",
      },
    ]);
    const boundary = draft.claims.find(
      (claim) =>
        claim.statement ===
        "Candidate coverage has an explicit analysis boundary.",
    );
    expect(boundary?.boundaryReason).toContain(
      "Host eligibility excluded 10 Graph nodes before ranking",
    );
  });

  it("assigns strong CandidateLevel only to fresh or aligned-partial conclusions", async () => {
    const { repositorySnapshot, pulse } = await repositoryFixtures();
    const baseInput = {
      taskId: TASK_ID,
      intent: "Update IsolatedHandler safely",
      snapshotId: repositorySnapshot.snapshotId,
      createdAt: "2026-07-29T08:00:00.001Z",
      repositorySnapshot,
      context: {
        graph: isolatedGraph(),
        existingFilePaths: ["src/isolated-handler.ts"],
      },
    };
    const alignedPartial = buildContextDraft({
      ...baseInput,
      pulse,
    });
    expect(alignedPartial.brief.plannedChanges[0]?.candidateLevel).toBe(
      "must_inspect",
    );

    const freshPulse = RepoPulseV1Schema.parse({
      ...pulse,
      status: "fresh",
      completeness: {
        ...pulse.completeness,
        callGraph: {
          status: "complete",
          coverage: 1,
          reasons: [],
        },
      },
      recommendedRefresh: "none",
      reasons: [],
    });
    const fresh = buildContextDraft({
      ...baseInput,
      pulse: freshPulse,
    });
    expect(fresh.brief.plannedChanges[0]?.candidateLevel).toBe(
      "must_inspect",
    );

    const stalePulse = RepoPulseV1Schema.parse({
      ...pulse,
      status: "stale",
      artifactFreshness: {
        ...pulse.artifactFreshness,
        graph: "stale",
      },
      recommendedRefresh: "full",
      reasons: ["Graph freshness could not be established."],
    });
    const unknown = buildContextDraft({
      ...baseInput,
      pulse: stalePulse,
    });
    expect(unknown.brief.plannedChanges[0]?.candidateLevel).toBe(
      "context_only",
    );

    const testGraph: KnowledgeGraph = {
      ...isolatedGraph(),
      nodes: [
        {
          ...isolatedGraph().nodes[0]!,
          id: "isolated-handler-test",
          name: "IsolatedHandler test",
          filePath: "test/isolated-handler.test.ts",
        },
      ],
    };
    const unknownTest = buildContextDraft({
      ...baseInput,
      intent: "Update IsolatedHandler test safely",
      pulse: stalePulse,
      context: {
        graph: testGraph,
        existingFilePaths: ["test/isolated-handler.test.ts"],
      },
    });
    expect(unknownTest.brief.plannedChanges[0]?.candidateLevel).toBe(
      "context_only",
    );
  });

  it("redacts POSIX, Windows, UNC, and file URI Host paths everywhere", async () => {
    const { repositorySnapshot, pulse } = await repositoryFixtures();
    const hostIntent = [
      "Update /Users/example/private/task.ts",
      "C:\\Users\\didi\\private\\task.ts",
      "\\\\server\\share\\private\\task.ts",
      "file:///private/tmp/task.ts",
      "while preserving https://example.test/docs",
    ].join(" ");
    const createdAt = "2026-07-29T08:00:00.001Z";
    const draft = buildContextDraft({
      taskId: TASK_ID,
      intent: hostIntent,
      snapshotId: repositorySnapshot.snapshotId,
      createdAt,
      pulse,
      repositorySnapshot,
      context: {
        graph: isolatedGraph(),
        existingFilePaths: ["src/isolated-handler.ts"],
      },
    });
    const manifest = TaskManifestV1Schema.parse({
      schemaVersion: 1,
      taskId: TASK_ID,
      title: hostIntent,
      originalIntent: hostIntent,
      status: "context_ready",
      repositoryId: repositorySnapshot.repositoryId,
      worktreeId: repositorySnapshot.worktreeId,
      baselineSnapshotId: pulse.baselineSnapshotId,
      latestSnapshotId: repositorySnapshot.snapshotId,
      createdAt,
      updatedAt: createdAt,
      producerVersion: "3.0.0-alpha.1",
      revision: 2,
    });
    const markdown = renderTaskBriefMarkdown({
      bundle: {
        manifest,
        brief: draft.brief,
        claims: draft.claims,
        evidence: draft.evidence,
        impactPaths: draft.impactPaths,
        changeChecks: [],
        verificationRecords: [],
        events: [],
        idempotencyRecords: [],
      },
      artifacts: [],
      receipts: [],
      state: "current",
      freshness: "partial",
      latestSnapshotId: repositorySnapshot.snapshotId,
      recoveryState: "current",
    } as unknown as ReadTaskBundleResult);

    expect(containsAbsoluteFilesystemPathV1(markdown)).toBe(false);
    expect(markdown).not.toContain("/Users/example");
    expect(markdown).not.toContain("C:\\Users");
    expect(markdown).not.toContain("\\\\server\\share");
    expect(markdown).not.toContain("file:///private");
    expect(markdown).toContain("[redacted-host-path]");
    expect(markdown).toContain("https://example.test/docs");
  });

  it("does not misreport a maxPaths boundary as a node budget truncation", async () => {
    const { repositorySnapshot, pulse } = await repositoryFixtures();
    const completePulse = RepoPulseV1Schema.parse({
      ...pulse,
      status: "fresh",
      completeness: {
        ...pulse.completeness,
        callGraph: {
          status: "complete",
          coverage: 1,
          reasons: [],
        },
      },
      recommendedRefresh: "none",
      reasons: [],
    });
    const graph = wideImpactGraph();
    const draft = buildContextDraft({
      taskId: TASK_ID,
      intent: "Update WideHandler safely",
      snapshotId: repositorySnapshot.snapshotId,
      createdAt: "2026-07-29T08:00:00.001Z",
      pulse: completePulse,
      repositorySnapshot,
      context: {
        graph,
        existingFilePaths: graph.nodes.flatMap((node) =>
          node.filePath === undefined ? [] : [node.filePath]
        ),
      },
      maxCandidates: 20,
      maxImpactDepth: 4,
    });

    expect(draft.impactPaths).toHaveLength(20);
    expect(draft.impactPaths.every((path) => path.truncatedAt === undefined))
      .toBe(true);
    const impactBoundary = draft.claims.find(
      (claim) =>
        claim.statement ===
        "Impact coverage has an explicit analysis boundary.",
    );
    expect(impactBoundary?.boundaryReason).toContain("maxPaths 20");
    expect(impactBoundary?.boundaryReason).not.toContain("nodeBudget");
  });
});
