import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { buildFunctionImpact } from "../functionImpact";

const graph: KnowledgeGraph = {
  version: "1.0.0",
  project: { name: "x", languages: ["go"], frameworks: [], description: "", analyzedAt: "2026-06-25T00:00:00.000Z", gitCommitHash: "local" },
  nodes: [
    { id: "file:src/a.go", type: "file", name: "a.go", filePath: "src/a.go", summary: "", tags: [], complexity: "complex" },
    { id: "file:src/b.go", type: "file", name: "b.go", filePath: "src/b.go", summary: "", tags: [], complexity: "moderate" },
    { id: "function:src/a.go:Build", type: "function", name: "Build", filePath: "src/a.go", lineRange: [1, 5], summary: "", tags: [], complexity: "complex" },
    { id: "function:src/b.go:Load", type: "function", name: "Load", filePath: "src/b.go", lineRange: [1, 5], summary: "", tags: [], complexity: "moderate" },
  ],
  edges: [
    { source: "file:src/a.go", target: "function:src/a.go:Build", type: "contains", direction: "forward", weight: 1 },
    { source: "file:src/b.go", target: "function:src/b.go:Load", type: "contains", direction: "forward", weight: 1 },
    { source: "file:src/a.go", target: "file:src/b.go", type: "imports", direction: "forward", weight: 0.7 },
  ],
  layers: [{ id: "core", name: "Core", description: "", nodeIds: ["file:src/a.go", "file:src/b.go"] }],
  tour: [],
};

describe("buildFunctionImpact", () => {
  it("falls back to file imports when calls edges are absent", () => {
    const impact = buildFunctionImpact(graph, "function:src/a.go:Build");
    expect(impact.source).toBe("imports");
    expect(impact.outgoingFileIds).toEqual(["file:src/b.go"]);
    expect(impact.totalDownstream).toBe(1);
  });

  it("uses function calls when calls edges exist", () => {
    const withCalls: KnowledgeGraph = {
      ...graph,
      edges: [
        ...graph.edges,
        { source: "function:src/a.go:Build", target: "function:src/b.go:Load", type: "calls", direction: "forward", weight: 0.8 },
      ],
    };

    const impact = buildFunctionImpact(withCalls, "function:src/a.go:Build");
    expect(impact.source).toBe("calls");
    expect(impact.outgoingFunctionIds).toEqual(["function:src/b.go:Load"]);
    expect(impact.outgoingFileIds).toEqual(["file:src/b.go"]);
    expect(impact.totalDownstream).toBe(2);
  });
});
