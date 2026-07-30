import type {
  GraphEdge,
  GraphNode,
  KnowledgeGraph,
} from "@understand-code/core";
import { describe, expect, it } from "vitest";
import { traceImpact } from "../src/impact.js";
import type {
  EdgeEvidenceLike,
  RepoPulseLike,
} from "../src/types.js";

function node(id: string): GraphNode {
  return {
    id,
    type: "function",
    name: id,
    filePath: `src/${id}.ts`,
    lineRange: [1, 2],
    summary: `${id} fixture node`,
    tags: [],
    complexity: "simple",
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
  ids: string[],
  edges: GraphEdge[],
): KnowledgeGraph {
  return {
    version: "1",
    project: {
      name: "impact",
      languages: ["TypeScript"],
      frameworks: [],
      description: "impact fixture",
      analyzedAt: "2026-07-29T00:00:00Z",
      gitCommitHash: "b".repeat(40),
    },
    nodes: ids.map(node),
    edges,
    layers: [],
    tour: [],
  };
}

function pulse(
  callGraphStatus: "complete" | "partial" | "unknown" | "unsupported" =
    "complete",
): RepoPulseLike {
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
      callGraph: {
        status: callGraphStatus,
        reasons:
          callGraphStatus === "complete"
            ? []
            : ["dynamic dispatch is unresolved"],
      },
    },
  };
}

function observedEvidence(
  source: string,
  target: string,
  evidenceId: string,
): EdgeEvidenceLike {
  return {
    source,
    target,
    edgeType: "calls",
    evidenceId,
    classification: "observed",
    freshness: "fresh",
  };
}

const chainGraph = graph(
  ["a", "b", "c", "d"],
  [
    edge("a", "b"),
    edge("b", "c"),
    edge("d", "c", { direction: "backward" }),
  ],
);

describe("traceImpact", () => {
  it("follows declared edge direction with deterministic BFS paths and evidence", () => {
    const result = traceImpact({
      graph: chainGraph,
      startNodeIds: ["a"],
      repoPulse: pulse(),
      edgeEvidence: [
        observedEvidence("a", "b", "evidence:a-b"),
        observedEvidence("b", "c", "evidence:b-c"),
      ],
      options: {
        direction: "downstream",
        maxDepth: 8,
        nodeBudget: 20,
        maxPaths: 20,
      },
    });

    expect(result.visitedNodeIds).toEqual(["a", "b", "c", "d"]);
    expect(result.paths.map((path) => path.nodeIds)).toEqual([
      ["a", "b"],
      ["a", "b", "c"],
      ["a", "b", "c", "d"],
    ]);
    expect(result.paths[0]).toMatchObject({
      endNodeId: "b",
      classification: "observed",
      evidenceIds: ["evidence:a-b"],
    });
    expect(result.paths[1]).toMatchObject({
      endNodeId: "c",
      classification: "observed",
      evidenceIds: ["evidence:a-b", "evidence:b-c"],
    });
    expect(result.paths[2]?.steps[2]).toMatchObject({
      fromNodeId: "c",
      toNodeId: "d",
      edgeSourceId: "d",
      edgeTargetId: "c",
      direction: "downstream",
      classification: "inferred",
      reason: "Graph relation has no fresh observed Evidence record",
    });
    expect(result.classification).toBe("inferred");
    expect(result.completeness).toBe("complete");
    expect(result.truncation).toEqual({
      truncated: false,
      reasons: [],
      hiddenCount: 0,
      hiddenCountIsLowerBound: false,
    });
  });

  it("distinguishes upstream, downstream, and both traversal", () => {
    const forward = graph(
      ["a", "b", "c"],
      [edge("a", "b"), edge("b", "c")],
    );
    const upstream = traceImpact({
      graph: forward,
      startNodeIds: ["c"],
      repoPulse: pulse(),
      options: { direction: "upstream" },
    });
    expect(upstream.paths.map((path) => path.nodeIds)).toEqual([
      ["c", "b"],
      ["c", "b", "a"],
    ]);
    expect(
      upstream.paths.flatMap((path) =>
        path.steps.map((step) => step.direction)
      ),
    ).toEqual(["upstream", "upstream", "upstream"]);

    const downstream = traceImpact({
      graph: forward,
      startNodeIds: ["c"],
      repoPulse: pulse(),
      options: { direction: "downstream" },
    });
    expect(downstream.paths).toEqual([]);

    const both = traceImpact({
      graph: forward,
      startNodeIds: ["b"],
      repoPulse: pulse(),
      options: { direction: "both" },
    });
    expect(both.paths.map((path) => path.nodeIds)).toEqual([
      ["b", "a"],
      ["b", "c"],
    ]);
    expect(both.paths.map((path) => path.steps[0]?.direction)).toEqual([
      "upstream",
      "downstream",
    ]);
  });

  it("uses locale-independent UTF-16 code-unit order for non-ASCII impact payloads", () => {
    const targetIds = ["😀", "中", "ä", "z"];
    const fixture = graph(
      ["root", ...targetIds],
      targetIds.map((target) => edge("root", target)).reverse(),
    );
    const first = traceImpact({
      graph: fixture,
      startNodeIds: ["root"],
      repoPulse: pulse(),
      edgeEvidence: [
        observedEvidence("root", "z", "evidence:ä"),
        observedEvidence("root", "z", "evidence:z"),
      ],
      options: {
        direction: "downstream",
        maxDepth: 1,
        nodeBudget: 20,
        maxPaths: 20,
      },
    });
    const reordered = traceImpact({
      graph: graph(
        [...targetIds].reverse().concat("root"),
        targetIds.map((target) => edge("root", target)),
      ),
      startNodeIds: ["root"],
      repoPulse: pulse(),
      edgeEvidence: [
        observedEvidence("root", "z", "evidence:z"),
        observedEvidence("root", "z", "evidence:ä"),
      ],
      options: {
        direction: "downstream",
        maxDepth: 1,
        nodeBudget: 20,
        maxPaths: 20,
      },
    });

    expect(first.paths.map((path) => path.endNodeId)).toEqual([
      "z",
      "ä",
      "中",
      "😀",
    ]);
    expect(first.paths[0]?.evidenceIds).toEqual(["evidence:z"]);
    expect(reordered).toEqual(first);
  });

  it("retains a shortest path per start when roots share downstream nodes", () => {
    const converged = graph(
      ["a", "b", "shared", "leaf"],
      [
        edge("a", "shared"),
        edge("b", "shared"),
        edge("shared", "leaf"),
      ],
    );
    const result = traceImpact({
      graph: converged,
      startNodeIds: ["b", "a"],
      repoPulse: pulse(),
      options: {
        direction: "downstream",
        maxDepth: 4,
        nodeBudget: 4,
        maxPaths: 20,
      },
    });

    expect(result.startNodeIds).toEqual(["a", "b"]);
    expect(result.visitedNodeIds).toEqual(["a", "b", "shared", "leaf"]);
    expect(result.paths.map((path) => path.nodeIds)).toEqual([
      ["a", "shared"],
      ["b", "shared"],
      ["a", "shared", "leaf"],
      ["b", "shared", "leaf"],
    ]);
    expect(result.truncation.truncated).toBe(false);

    const limited = traceImpact({
      graph: converged,
      startNodeIds: ["a", "b"],
      repoPulse: pulse(),
      options: {
        direction: "downstream",
        maxDepth: 4,
        nodeBudget: 3,
        maxPaths: 20,
      },
    });
    expect(limited.visitedNodeIds).toEqual(["a", "b", "shared"]);
    expect(limited.paths.map((path) => path.nodeIds)).toEqual([
      ["a", "shared"],
      ["b", "shared"],
    ]);
    expect(limited.truncation).toMatchObject({
      truncated: true,
      reasons: ["node_budget"],
      hiddenCount: 1,
    });
  });

  it("reports maxDepth and nodeBudget boundaries with hidden counts", () => {
    const depthLimited = traceImpact({
      graph: chainGraph,
      startNodeIds: ["a"],
      repoPulse: pulse(),
      options: {
        direction: "downstream",
        maxDepth: 1,
        nodeBudget: 20,
        maxPaths: 20,
      },
    });
    expect(depthLimited.paths.map((path) => path.endNodeId)).toEqual(["b"]);
    expect(depthLimited.truncation).toMatchObject({
      truncated: true,
      reasons: ["max_depth"],
      hiddenCount: 1,
      hiddenCountIsLowerBound: true,
    });
    expect(depthLimited.boundaries).toEqual([
      expect.objectContaining({ reason: "max_depth", nodeId: "b" }),
    ]);

    const branched = graph(
      ["a", "b", "c", "d"],
      [edge("a", "b"), edge("a", "c"), edge("b", "d")],
    );
    const budgetLimited = traceImpact({
      graph: branched,
      startNodeIds: ["a"],
      repoPulse: pulse(),
      options: {
        direction: "downstream",
        maxDepth: 8,
        nodeBudget: 2,
        maxPaths: 20,
      },
    });
    expect(budgetLimited.visitedNodeIds).toEqual(["a", "b"]);
    expect(budgetLimited.paths.map((path) => path.endNodeId)).toEqual(["b"]);
    expect(budgetLimited.truncation.reasons).toEqual(["node_budget"]);
    expect(budgetLimited.truncation.hiddenCount).toBe(2);
    expect(budgetLimited.completeness).toBe("partial");
  });

  it("enforces maxPaths during traversal and reports an unknown lower bound", () => {
    const branched = graph(
      ["a", "b", "c", "d"],
      [edge("a", "b"), edge("a", "c"), edge("a", "d")],
    );
    const result = traceImpact({
      graph: branched,
      startNodeIds: ["a"],
      repoPulse: pulse(),
      options: {
        direction: "downstream",
        maxDepth: 8,
        nodeBudget: 20,
        maxPaths: 1,
      },
    });

    expect(result.paths.map((path) => path.endNodeId)).toEqual(["b"]);
    expect(result.visitedNodeIds).toEqual(["a", "b"]);
    expect(result.truncation).toEqual({
      truncated: true,
      reasons: ["max_paths"],
      hiddenCount: 1,
      hiddenCountIsLowerBound: true,
    });
    expect(result.classification).toBe("unknown_boundary");
    expect(result.completeness).toBe("partial");
    expect(result.boundaries).toEqual([
      expect.objectContaining({
        reason: "max_paths",
        nodeId: "a",
      }),
    ]);
  });

  it("hard-bounds deterministic materialization for wide multi-start graphs", () => {
    const startIds = ["start-a", "start-b", "start-c", "start-d"];
    const targetIds = Array.from(
      { length: 40 },
      (_, index) => `target-${String(index).padStart(2, "0")}`,
    );
    const wide = graph(
      [...startIds, ...targetIds],
      startIds.flatMap((start) =>
        targetIds.map((target) => edge(start, target))
      ),
    );
    const options = {
      direction: "downstream" as const,
      maxDepth: 8,
      nodeBudget: 100,
      maxPaths: 5,
    };
    const first = traceImpact({
      graph: wide,
      startNodeIds: [...startIds].reverse(),
      repoPulse: pulse(),
      options,
    });
    const second = traceImpact({
      graph: wide,
      startNodeIds: startIds,
      repoPulse: pulse(),
      options,
    });

    expect(second).toEqual(first);
    expect(first.paths).toHaveLength(options.maxPaths);
    expect(first.paths.map((path) => path.nodeIds)).toEqual([
      ["start-a", "target-00"],
      ["start-a", "target-01"],
      ["start-a", "target-02"],
      ["start-a", "target-03"],
      ["start-a", "target-04"],
    ]);
    expect(first.visitedNodeIds).toHaveLength(
      startIds.length + options.maxPaths,
    );
    expect(first.truncation).toMatchObject({
      truncated: true,
      reasons: ["max_paths"],
      hiddenCount: 1,
      hiddenCountIsLowerBound: true,
    });
    expect(first.classification).toBe("unknown_boundary");
  });

  it("never claims completeness when Call Graph coverage is incomplete", () => {
    const result = traceImpact({
      graph: graph(["a"], []),
      startNodeIds: ["a"],
      repoPulse: pulse("partial"),
      options: { direction: "both" },
    });

    expect(result.paths).toEqual([]);
    expect(result.classification).toBe("unknown_boundary");
    expect(result.completeness).toBe("partial");
    expect(result.truncation).toMatchObject({
      truncated: true,
      reasons: ["call_graph_incomplete"],
      hiddenCount: 0,
      hiddenCountIsLowerBound: true,
    });
    expect(result.boundaries[0]).toMatchObject({
      reason: "call_graph_incomplete",
    });
    expect(result.diagnostics.map((item) => item.code)).toContain(
      "call_graph_incomplete",
    );
  });

  it("downgrades stale Graph or stale edge evidence to unknown boundaries", () => {
    const staleGraph = traceImpact({
      graph: graph(["a", "b"], [edge("a", "b")]),
      startNodeIds: ["a"],
      repoPulse: {
        ...pulse(),
        status: "stale",
        artifactFreshness: {
          ...pulse().artifactFreshness,
          graph: "stale",
        },
      },
      options: { direction: "downstream" },
    });
    expect(staleGraph.paths[0]?.classification).toBe("unknown_boundary");
    expect(staleGraph.classification).toBe("unknown_boundary");
    expect(staleGraph.completeness).toBe("unknown");
    expect(staleGraph.truncation.reasons).toContain("graph_not_fresh");

    const staleEvidence = traceImpact({
      graph: graph(["a", "b"], [edge("a", "b")]),
      startNodeIds: ["a"],
      repoPulse: pulse(),
      edgeEvidence: [
        {
          ...observedEvidence("a", "b", "evidence:stale"),
          freshness: "stale",
        },
      ],
      options: { direction: "downstream" },
    });
    expect(staleEvidence.paths[0]).toMatchObject({
      classification: "unknown_boundary",
      evidenceIds: ["evidence:stale"],
      reasons: ["Edge Evidence evidence:stale is stale"],
    });
    expect(staleEvidence.classification).toBe("unknown_boundary");
    expect(staleEvidence.completeness).toBe("complete");
    expect(staleEvidence.diagnostics.map((item) => item.code)).toContain(
      "edge_evidence_not_fresh",
    );
  });

  it("excludes dangling edges, handles cycles, and validates traversal budgets", () => {
    const cyclic = graph(
      ["a", "b", "c"],
      [
        edge("a", "b"),
        edge("b", "a"),
        edge("b", "c"),
        edge("c", "missing"),
      ],
    );
    const first = traceImpact({
      graph: cyclic,
      startNodeIds: ["a"],
      repoPulse: pulse(),
      options: { direction: "downstream" },
    });
    const second = traceImpact({
      graph: cyclic,
      startNodeIds: ["a"],
      repoPulse: pulse(),
      options: { direction: "downstream" },
    });
    expect(first).toEqual(second);
    expect(first.visitedNodeIds).toEqual(["a", "b", "c"]);
    expect(first.classification).toBe("unknown_boundary");
    expect(first.truncation.reasons).toContain("invalid_graph");
    expect(first.diagnostics.map((item) => item.code)).toContain(
      "dangling_graph_edge",
    );

    expect(() =>
      traceImpact({
        graph: cyclic,
        startNodeIds: ["missing"],
        repoPulse: pulse(),
      })
    ).toThrow(RangeError);
    expect(() =>
      traceImpact({
        graph: cyclic,
        startNodeIds: ["a", "b"],
        repoPulse: pulse(),
        options: { nodeBudget: 1 },
      })
    ).toThrow(RangeError);
    expect(() =>
      traceImpact({
        graph: cyclic,
        startNodeIds: ["a"],
        repoPulse: pulse(),
        options: { maxDepth: -1 },
      })
    ).toThrow(RangeError);
  });
});
