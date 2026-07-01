import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-anything/core/types";
import { buildViewGraph } from "../buildViewGraph";
import { buildFileRelationships } from "../fileRelationships";

function graphWithCalls(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "sample",
      languages: ["go"],
      frameworks: [],
      description: "",
      analyzedAt: "2026-07-01T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes: [
      { id: "file:a", type: "file", name: "a.go", filePath: "src/a.go", summary: "", tags: [], complexity: "simple" },
      { id: "file:b", type: "file", name: "b.go", filePath: "src/b.go", summary: "", tags: [], complexity: "moderate" },
      { id: "file:c", type: "file", name: "c.go", filePath: "src/c.go", summary: "", tags: [], complexity: "complex" },
      { id: "fn:a:one", type: "function", name: "One", filePath: "src/a.go", summary: "", tags: [], complexity: "simple" },
      { id: "fn:a:two", type: "function", name: "Two", filePath: "src/a.go", summary: "", tags: [], complexity: "simple" },
      { id: "fn:b:one", type: "function", name: "One", filePath: "src/b.go", summary: "", tags: [], complexity: "simple" },
      { id: "fn:c:one", type: "function", name: "One", filePath: "src/c.go", summary: "", tags: [], complexity: "simple" },
    ],
    edges: [
      { source: "file:a", target: "fn:a:one", type: "contains", direction: "forward", weight: 1 },
      { source: "file:a", target: "fn:a:two", type: "contains", direction: "forward", weight: 1 },
      { source: "file:b", target: "fn:b:one", type: "contains", direction: "forward", weight: 1 },
      { source: "file:c", target: "fn:c:one", type: "contains", direction: "forward", weight: 1 },
      { source: "fn:a:one", target: "fn:b:one", type: "calls", direction: "forward", weight: 1 },
      { source: "fn:a:two", target: "fn:b:one", type: "calls", direction: "forward", weight: 1 },
      { source: "fn:b:one", target: "fn:c:one", type: "calls", direction: "forward", weight: 1 },
      { source: "fn:a:one", target: "fn:a:two", type: "calls", direction: "forward", weight: 1 },
      { source: "file:c", target: "file:a", type: "imports", direction: "forward", weight: 0.7 },
    ],
    layers: [
      { id: "core", name: "Core", description: "Core", nodeIds: ["file:a", "file:b", "file:c"] },
    ],
    tour: [],
  };
}

function graphWithImportsOnly(): KnowledgeGraph {
  const graph = graphWithCalls();
  return {
    ...graph,
    edges: graph.edges.filter((edge) => edge.type !== "calls"),
  };
}

describe("buildFileRelationships", () => {
  it("aggregates function calls into directed file relationships", () => {
    const graph = graphWithCalls();
    const viewGraph = buildViewGraph(graph);
    const relationships = buildFileRelationships(graph, viewGraph, new Set(["file:a", "file:b", "file:c"]));

    expect(relationships).toEqual([
      {
        id: "calls:file:a->file:b",
        sourceFileId: "file:a",
        targetFileId: "file:b",
        source: "calls",
        count: 2,
        functionEdgeIds: ["fn:a:one->fn:b:one", "fn:a:two->fn:b:one"],
      },
      {
        id: "calls:file:b->file:c",
        sourceFileId: "file:b",
        targetFileId: "file:c",
        source: "calls",
        count: 1,
        functionEdgeIds: ["fn:b:one->fn:c:one"],
      },
    ]);
  });

  it("does not create file-level edges for same-file calls", () => {
    const graph = graphWithCalls();
    const viewGraph = buildViewGraph(graph);
    const relationships = buildFileRelationships(graph, viewGraph, new Set(["file:a"]));

    expect(relationships).toEqual([]);
  });

  it("falls back to imports when no usable call relationships exist", () => {
    const graph = graphWithImportsOnly();
    const viewGraph = buildViewGraph(graph);
    const relationships = buildFileRelationships(graph, viewGraph, new Set(["file:a", "file:c"]));

    expect(relationships).toEqual([
      {
        id: "imports:file:c->file:a",
        sourceFileId: "file:c",
        targetFileId: "file:a",
        source: "imports",
        count: 1,
        functionEdgeIds: [],
      },
    ]);
  });

  it("does not fall back to imports when calls are usable", () => {
    const graph = graphWithCalls();
    const viewGraph = buildViewGraph(graph);
    const relationships = buildFileRelationships(graph, viewGraph, new Set(["file:a", "file:b", "file:c"]));

    expect(relationships.map((relationship) => relationship.source)).toEqual(["calls", "calls"]);
  });
});
