import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-anything/core/types";
import { buildViewGraph } from "../buildViewGraph";
import {
  buildFileCallEdges,
  buildFunctionCallNeighborhood,
  getFocusedFileCallEdges,
} from "../callRelationships";

function graphWithCalls(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "calls",
      languages: ["ts"],
      frameworks: [],
      description: "",
      analyzedAt: "2026-06-26T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes: [
      { id: "file:a", type: "file", name: "a.ts", filePath: "a.ts", summary: "", tags: [], complexity: "moderate" },
      { id: "file:b", type: "file", name: "b.ts", filePath: "b.ts", summary: "", tags: [], complexity: "moderate" },
      { id: "file:c", type: "file", name: "c.ts", filePath: "c.ts", summary: "", tags: [], complexity: "simple" },
      { id: "function:a:one", type: "function", name: "one", filePath: "a.ts", lineRange: [1, 2], summary: "", tags: [], complexity: "simple" },
      { id: "function:a:two", type: "function", name: "two", filePath: "a.ts", lineRange: [3, 4], summary: "", tags: [], complexity: "simple" },
      { id: "function:b:load", type: "function", name: "load", filePath: "b.ts", lineRange: [1, 2], summary: "", tags: [], complexity: "simple" },
      { id: "function:c:save", type: "function", name: "save", filePath: "c.ts", lineRange: [1, 2], summary: "", tags: [], complexity: "simple" },
    ],
    edges: [
      { source: "file:a", target: "function:a:one", type: "contains", direction: "forward", weight: 1 },
      { source: "file:a", target: "function:a:two", type: "contains", direction: "forward", weight: 1 },
      { source: "file:b", target: "function:b:load", type: "contains", direction: "forward", weight: 1 },
      { source: "file:c", target: "function:c:save", type: "contains", direction: "forward", weight: 1 },
      { source: "function:a:one", target: "function:b:load", type: "calls", direction: "forward", weight: 1 },
      { source: "function:a:two", target: "function:b:load", type: "calls", direction: "forward", weight: 1 },
      { source: "function:c:save", target: "function:a:one", type: "calls", direction: "forward", weight: 1 },
    ],
    layers: [{ id: "app", name: "App", description: "", nodeIds: ["file:a", "file:b", "file:c"] }],
    tour: [],
  };
}

describe("callRelationships", () => {
  it("aggregates function calls into directed file arrows", () => {
    const graph = graphWithCalls();
    const viewGraph = buildViewGraph(graph);

    const edges = buildFileCallEdges(graph, viewGraph, { fileIds: ["file:a", "file:b", "file:c"] });

    expect(edges).toMatchObject([
      { sourceFileId: "file:a", targetFileId: "file:b", source: "calls", count: 2 },
      { sourceFileId: "file:c", targetFileId: "file:a", source: "calls", count: 1 },
    ]);
    expect(edges[0].functionEdgeIds).toHaveLength(2);
  });

  it("falls back to imports only when there are no usable call edges in scope", () => {
    const base = graphWithCalls();
    const graph: KnowledgeGraph = {
      ...base,
      edges: [
        ...base.edges.filter((edge) => edge.type !== "calls"),
        { source: "file:a", target: "file:b", type: "imports", direction: "forward", weight: 1 },
      ],
    };
    const viewGraph = buildViewGraph(graph);

    expect(buildFileCallEdges(graph, viewGraph, { fileIds: ["file:a", "file:b"] })).toEqual([
      { sourceFileId: "file:a", targetFileId: "file:b", source: "imports", count: 1, functionEdgeIds: [] },
    ]);
  });

  it("expands module import fallback edges into contained file arrows", () => {
    const base = graphWithCalls();
    const graph: KnowledgeGraph = {
      ...base,
      nodes: [
        ...base.nodes,
        { id: "module:shared", type: "module", name: "shared", filePath: "shared", summary: "", tags: [], complexity: "simple" },
        { id: "file:shared/index.ts", type: "file", name: "index.ts", filePath: "shared/index.ts", summary: "", tags: [], complexity: "simple" },
      ],
      edges: [
        ...base.edges.filter((edge) => edge.type !== "calls"),
        { source: "module:shared", target: "file:shared/index.ts", type: "contains", direction: "forward", weight: 1 },
        { source: "file:a", target: "module:shared", type: "imports", direction: "forward", weight: 1 },
      ],
      layers: [{ id: "app", name: "App", description: "", nodeIds: ["file:a", "file:b", "file:c", "file:shared/index.ts"] }],
    };
    const viewGraph = buildViewGraph(graph);

    expect(buildFileCallEdges(graph, viewGraph, { fileIds: ["file:a", "file:shared/index.ts"] })).toEqual([
      { sourceFileId: "file:a", targetFileId: "file:shared/index.ts", source: "imports", count: 1, functionEdgeIds: [] },
    ]);
  });

  it("returns every direct focused file relationship without a count cap", () => {
    const focusedEdges = Array.from({ length: 18 }, (_, index) => ({
      sourceFileId: "file:a",
      targetFileId: `file:${index}`,
      source: "calls" as const,
      count: 1,
      functionEdgeIds: [`edge:${index}`],
    }));

    expect(getFocusedFileCallEdges(focusedEdges, "file:a")).toHaveLength(18);
  });

  it("builds one-hop incoming and outgoing function neighborhoods", () => {
    const graph = graphWithCalls();
    const viewGraph = buildViewGraph(graph);

    const neighborhood = buildFunctionCallNeighborhood(graph, viewGraph, "function:a:one");

    expect(neighborhood.outgoing.map((edge) => edge.targetFunctionId)).toEqual(["function:b:load"]);
    expect(neighborhood.incoming.map((edge) => edge.sourceFunctionId)).toEqual(["function:c:save"]);
    expect(neighborhood.externalFileIds).toEqual(["file:b", "file:c"]);
  });
});
