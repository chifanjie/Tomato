import type {
  GraphEdge,
  GraphNode,
  KnowledgeGraph,
} from "@understand-code/core";
import { describe, expect, it } from "vitest";
import {
  CandidateCursorError,
  rankCandidates,
} from "../src/ranking.js";
import { compareUnicodeCodeUnits } from "../src/stable-order.js";
import type {
  RankCandidatesInput,
  RepoPulseLike,
} from "../src/types.js";

function node(
  id: string,
  name: string,
  filePath: string,
  overrides: Partial<GraphNode> = {},
): GraphNode {
  return {
    id,
    type: "function",
    name,
    filePath,
    lineRange: [1, 10],
    summary: `${name} handles application behavior`,
    tags: [],
    complexity: "simple",
    ...overrides,
  };
}

function edge(
  source: string,
  target: string,
  overrides: Partial<GraphEdge> = {},
): GraphEdge {
  return {
    source,
    target,
    type: "calls",
    direction: "forward",
    weight: 1,
    ...overrides,
  };
}

function graph(
  nodes: GraphNode[],
  edges: GraphEdge[] = [],
): KnowledgeGraph {
  return {
    version: "1",
    project: {
      name: "fixture",
      languages: ["TypeScript"],
      frameworks: [],
      description: "task-engine fixture",
      analyzedAt: "2026-07-29T00:00:00Z",
      gitCommitHash: "a".repeat(40),
    },
    nodes,
    edges,
    layers: [],
    tour: [],
  };
}

function freshPulse(): RepoPulseLike {
  return {
    evaluatedSnapshotId: "snapshot-1",
    status: "fresh",
    artifactFreshness: {
      graph: "fresh",
      wiki: "fresh",
      evidence: "fresh",
      diff: "fresh",
      task: "fresh",
    },
    completeness: {
      callGraph: { status: "complete", reasons: [] },
    },
  };
}

function authInput(): RankCandidatesInput {
  const nodes = [
    node("auth-controller", "AuthController", "src/http/auth-controller.ts", {
      type: "endpoint",
      tags: ["entry", "http"],
    }),
    node("auth-service", "AuthService", "src/auth/auth-service.ts", {
      type: "class",
      tags: ["authentication"],
    }),
    node("auth-test", "AuthService test", "test/auth-service.test.ts", {
      tags: ["test"],
    }),
    node("billing", "BillingService", "src/billing/service.ts"),
  ];
  return {
    query: "AuthService",
    graph: graph(nodes, [
      edge("auth-controller", "auth-service"),
      edge("auth-service", "auth-test", { type: "tested_by" }),
      edge("billing", "auth-service", { type: "depends_on" }),
    ]),
    repoPulse: freshPulse(),
    options: { maxCandidates: 20, tokenBudget: 20_000 },
  };
}

describe("rankCandidates", () => {
  it("combines exact, lexical, Graph, entry, and test signals without embeddings", () => {
    const input = authInput();
    const result = rankCandidates(input);
    const service = result.candidates.find(
      (candidate) => candidate.nodeId === "auth-service",
    );
    const controller = result.candidates.find(
      (candidate) => candidate.nodeId === "auth-controller",
    );
    const test = result.candidates.find(
      (candidate) => candidate.nodeId === "auth-test",
    );

    expect(result.candidates[0]?.nodeId).toBe("auth-service");
    expect(service?.signals.map((signal) => signal.kind)).toEqual(
      expect.arrayContaining([
        "exact_symbol",
        "lexical",
        "graph_degree",
        "graph_proximity",
      ]),
    );
    expect(controller?.signals.map((signal) => signal.kind)).toContain(
      "entry_point",
    );
    expect(test?.signals.map((signal) => signal.kind)).toContain("test");
    expect(result.freshness.freshConclusionEligible).toBe(true);
    expect(result.candidates.every((candidate) => candidate.freshConclusion))
      .toBe(true);
    expect(rankCandidates(input)).toEqual(result);
  });

  it("uses a stable path/id tie-break and applies all scope constraints", () => {
    const fixture = graph([
      node("z-id", "Cache", "src/z/cache.ts", { type: "class" }),
      node("b-id", "Cache", "src/a/cache.ts", { type: "class" }),
      node("a-id", "Cache", "src/a/cache.ts", { type: "class" }),
      node("test-id", "Cache", "test/cache.ts", { type: "class" }),
    ]);
    const first = rankCandidates({
      query: "Cache",
      graph: fixture,
      repoPulse: freshPulse(),
      options: {
        scope: {
          nodeTypes: ["class"],
          pathPrefixes: ["src"],
          excludePathPrefixes: ["src/z"],
        },
      },
    });

    expect(first.candidates.map((candidate) => candidate.nodeId)).toEqual([
      "a-id",
      "b-id",
    ]);

    const idsOnly = rankCandidates({
      query: "Cache",
      graph: fixture,
      repoPulse: freshPulse(),
      options: {
        scope: {
          nodeIds: ["b-id", "test-id"],
          pathPrefixes: ["src"],
        },
      },
    });
    expect(idsOnly.candidates.map((candidate) => candidate.nodeId)).toEqual([
      "b-id",
    ]);

    const explicitlyEmpty = rankCandidates({
      query: "Cache",
      graph: fixture,
      repoPulse: freshPulse(),
      options: {
        scope: { nodeIds: [] },
      },
    });
    expect(explicitlyEmpty.candidates).toEqual([]);
  });

  it("uses locale-independent UTF-16 code-unit order for non-ASCII candidate payloads", () => {
    const values = ["😀", "中", "ä", "z", "a"];
    expect([...values].sort(compareUnicodeCodeUnits)).toEqual([
      "a",
      "z",
      "ä",
      "中",
      "😀",
    ]);
    expect(compareUnicodeCodeUnits("同", "同")).toBe(0);

    const nodes = [
      node("candidate-emoji", "Handler", "src/😀/handler.ts"),
      node("candidate-han", "Handler", "src/中/handler.ts"),
      node("candidate-diaeresis", "Handler", "src/ä/handler.ts"),
      node("candidate-z", "Handler", "src/z/handler.ts"),
      node("candidate-a", "Handler", "src/a/handler.ts"),
    ];
    const input: RankCandidatesInput = {
      query: "Handler",
      graph: graph(nodes),
      repoPulse: freshPulse(),
      options: {
        maxCandidates: 2,
        tokenBudget: 20_000,
      },
    };
    const first = rankCandidates(input);
    const reordered = rankCandidates({
      ...input,
      graph: graph([...nodes].reverse()),
    });
    const all = rankCandidates({
      ...input,
      options: {
        maxCandidates: 20,
        tokenBudget: 20_000,
      },
    });

    expect(first.candidates.map((candidate) => candidate.nodeId)).toEqual([
      "candidate-a",
      "candidate-z",
    ]);
    expect(all.candidates.map((candidate) => candidate.nodeId)).toEqual([
      "candidate-a",
      "candidate-z",
      "candidate-diaeresis",
      "candidate-han",
      "candidate-emoji",
    ]);
    expect(reordered).toEqual(first);
    expect(first.nextCursor).toBeDefined();
  });

  it("adds only fresh, aligned Wiki and recent-change signals", () => {
    const input = authInput();
    input.repositorySnapshot = {
      snapshotId: "snapshot-1",
      headCommit: "a".repeat(40),
      captureStatus: "complete",
      changes: [
        {
          path: "src/auth/auth-service.ts",
          source: "unstaged",
          kind: "modified",
        },
      ],
    };
    input.wiki = {
      freshness: "fresh",
      records: [
        {
          id: "wiki-auth",
          nodeId: "auth-service",
          title: "AuthService authentication flow",
          summary: "Authentication service behavior",
          evidenceIds: ["evidence:wiki-auth"],
        },
      ],
    };
    const fresh = rankCandidates(input);
    const service = fresh.candidates.find(
      (candidate) => candidate.nodeId === "auth-service",
    );
    expect(service?.signals.map((signal) => signal.kind)).toEqual(
      expect.arrayContaining(["wiki", "recent_change"]),
    );
    expect(service?.evidenceIds).toEqual(["evidence:wiki-auth"]);

    const degraded = rankCandidates({
      ...input,
      repoPulse: {
        ...freshPulse(),
        status: "stale",
        evaluatedSnapshotId: "different-snapshot",
        artifactFreshness: {
          ...freshPulse().artifactFreshness,
          wiki: "stale",
        },
      },
      wiki: {
        ...input.wiki,
        freshness: "stale",
      },
    });
    const degradedService = degraded.candidates.find(
      (candidate) => candidate.nodeId === "auth-service",
    );
    expect(degradedService?.signals.map((signal) => signal.kind)).not.toContain(
      "wiki",
    );
    expect(degradedService?.signals.map((signal) => signal.kind)).not.toContain(
      "recent_change",
    );
    expect(degraded.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "wiki_not_fresh",
        "repository_snapshot_not_fresh",
      ]),
    );
  });

  it("paginates with token/max-candidate budgets and binds opaque cursors to the query", () => {
    const input = authInput();
    const first = rankCandidates({
      ...input,
      options: {
        maxCandidates: 1,
        tokenBudget: 20_000,
      },
    });

    expect(first.candidates).toHaveLength(1);
    expect(first.truncation).toMatchObject({
      truncated: true,
      reason: "max_candidates",
    });
    expect(first.nextCursor).toBeDefined();
    expect(first.nextCursor).not.toContain("AuthService");
    const cursor = first.nextCursor;
    if (cursor === undefined) {
      throw new Error("expected a next cursor");
    }

    const second = rankCandidates({
      ...input,
      options: {
        maxCandidates: 1,
        tokenBudget: 20_000,
        cursor,
      },
    });
    expect(second.candidates).toHaveLength(1);
    expect(second.candidates[0]?.nodeId).not.toBe(
      first.candidates[0]?.nodeId,
    );

    expect(() =>
      rankCandidates({
        ...input,
        query: "BillingService",
        options: {
          maxCandidates: 1,
          tokenBudget: 20_000,
          cursor,
        },
      })
    ).toThrowError(CandidateCursorError);
    try {
      rankCandidates({
        ...input,
        query: "BillingService",
        options: { cursor },
      });
    } catch (error) {
      expect(error).toMatchObject({ code: "cursor_query_mismatch" });
    }
    expect(() =>
      rankCandidates({
        ...input,
        options: {
          cursor,
          proximityDepth: 3,
        },
      })
    ).toThrowError(CandidateCursorError);

    const candidatePayloadChanges: KnowledgeGraph[] = [
      {
        ...input.graph,
        nodes: input.graph.nodes.map((item) =>
          item.id === "auth-service"
            ? { ...item, lineRange: [2, 11] }
            : item
        ),
      },
      {
        ...input.graph,
        nodes: input.graph.nodes.map((item) =>
          item.id === "auth-service"
            ? { ...item, complexity: "complex" }
            : item
        ),
      },
    ];
    for (const changedGraph of candidatePayloadChanges) {
      try {
        rankCandidates({
          ...input,
          graph: changedGraph,
          options: {
            maxCandidates: 1,
            tokenBudget: 20_000,
            cursor,
          },
        });
        expect.fail("a changed candidate payload must invalidate the cursor");
      } catch (error) {
        expect(error).toMatchObject({ code: "cursor_query_mismatch" });
      }
    }

    const starved = rankCandidates({
      ...input,
      options: { maxCandidates: 20, tokenBudget: 1 },
    });
    expect(starved.candidates).toEqual([]);
    expect(starved.nextCursor).toBeUndefined();
    expect(starved.truncation).toMatchObject({
      truncated: true,
      reason: "token_budget",
      hiddenCount: starved.totalCandidates,
    });
  });

  it("marks stale or invalid Graph input as unknown instead of a fresh conclusion", () => {
    const input = authInput();
    const stale = rankCandidates({
      ...input,
      repoPulse: {
        ...freshPulse(),
        status: "stale",
        artifactFreshness: {
          ...freshPulse().artifactFreshness,
          graph: "stale",
        },
      },
    });
    expect(stale.freshness.freshConclusionEligible).toBe(false);
    expect(stale.candidates.every(
      (candidate) =>
        candidate.epistemicStatus === "unknown_boundary" &&
        !candidate.freshConclusion,
    )).toBe(true);
    expect(
      stale.candidates.flatMap((candidate) =>
        candidate.signals.map((signal) => signal.kind)
      ),
    ).not.toContain("graph_degree");

    const invalidGraph = {
      ...input.graph,
      edges: [...input.graph.edges, edge("auth-service", "missing-node")],
    };
    const invalid = rankCandidates({
      ...input,
      graph: invalidGraph,
    });
    expect(invalid.freshness.freshConclusionEligible).toBe(false);
    expect(invalid.diagnostics.map((item) => item.code)).toContain(
      "dangling_graph_edge",
    );
    expect(invalid.candidates.every(
      (candidate) => candidate.epistemicStatus === "unknown_boundary",
    )).toBe(true);

    const invalidNodeType = {
      ...input.graph,
      nodes: [
        ...input.graph.nodes,
        {
          ...node("legacy-method", "LegacyMethod", "src/legacy.ts"),
          type: "method",
        } as unknown as GraphNode,
      ],
    };
    const schemaInvalid = rankCandidates({
      ...input,
      query: "LegacyMethod",
      graph: invalidNodeType,
    });
    expect(schemaInvalid.candidates.map((candidate) => candidate.nodeId))
      .not.toContain("legacy-method");
    expect(schemaInvalid.freshness.freshConclusionEligible).toBe(false);
    expect(schemaInvalid.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "invalid_graph_schema",
        "invalid_graph_node",
      ]),
    );

    const invalidRoot = rankCandidates({
      ...input,
      graph: {
        version: 1,
        project: null,
        nodes: null,
        edges: null,
      } as unknown as KnowledgeGraph,
    });
    expect(invalidRoot.candidates).toEqual([]);
    expect(invalidRoot.freshness.freshConclusionEligible).toBe(false);
    expect(invalidRoot.diagnostics.map((item) => item.code)).toContain(
      "invalid_graph_schema",
    );
  });

  it("downgrades partial Snapshot conclusions when Pulse or Graph identity is misaligned", () => {
    const input = authInput();
    const partialSnapshot = {
      snapshotId: "snapshot-1",
      headCommit: "b".repeat(40),
      captureStatus: "partial" as const,
      limitations: ["untracked file content was unavailable"],
      changes: [],
    };
    const commitMismatch = rankCandidates({
      ...input,
      repositorySnapshot: partialSnapshot,
    });

    expect(commitMismatch.freshness.repositorySnapshot).toBe("partial");
    expect(commitMismatch.freshness.freshConclusionEligible).toBe(false);
    expect(
      commitMismatch.candidates.every(
        (candidate) =>
          candidate.epistemicStatus === "unknown_boundary" &&
          candidate.freshConclusion === false,
      ),
    ).toBe(true);
    expect(commitMismatch.diagnostics.map((item) => item.code)).toContain(
      "graph_snapshot_commit_mismatch",
    );

    const pulseMismatch = rankCandidates({
      ...input,
      graph: {
        ...input.graph,
        project: {
          ...input.graph.project,
          gitCommitHash: partialSnapshot.headCommit,
        },
      },
      repositorySnapshot: {
        ...partialSnapshot,
        snapshotId: "snapshot-2",
      },
    });
    expect(pulseMismatch.freshness.freshConclusionEligible).toBe(false);
    expect(pulseMismatch.diagnostics.map((item) => item.code)).toContain(
      "snapshot_pulse_mismatch",
    );
  });

  it("rejects invalid budgets, empty queries, and malformed cursors", () => {
    const input = authInput();
    expect(() => rankCandidates({ ...input, query: "   " })).toThrow(
      RangeError,
    );
    expect(() =>
      rankCandidates({ ...input, options: { maxCandidates: 0 } })
    ).toThrow(RangeError);
    expect(() =>
      rankCandidates({ ...input, options: { cursor: "not-a-cursor" } })
    ).toThrowError(CandidateCursorError);
  });
});
