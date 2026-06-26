import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-anything/core/types";
import { buildViewGraph } from "../buildViewGraph";

function sampleGraph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "sample-repository",
      languages: ["go"],
      frameworks: [],
      description: "",
      analyzedAt: "2026-06-25T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes: [
      { id: "file:src/a.go", type: "file", name: "a.go", filePath: "src/a.go", summary: "file", tags: [], complexity: "complex" },
      { id: "function:src/a.go:BuildData", type: "function", name: "BuildData", filePath: "src/a.go", lineRange: [10, 20], summary: "", tags: [], complexity: "complex" },
      { id: "function:src/a.go:FilterItem", type: "function", name: "FilterItem", filePath: "src/a.go", lineRange: [22, 30], summary: "", tags: [], complexity: "moderate" },
      { id: "function:src/a.go:RenderModel", type: "function", name: "RenderModel", filePath: "src/a.go", lineRange: [35, 42], summary: "", tags: [], complexity: "simple" },
      { id: "file:src/b.go", type: "file", name: "b.go", filePath: "src/b.go", summary: "file", tags: [], complexity: "moderate" },
    ],
    edges: [
      { source: "file:src/a.go", target: "function:src/a.go:BuildData", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/a.go", target: "function:src/a.go:FilterItem", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/a.go", target: "function:src/a.go:RenderModel", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/a.go", target: "file:src/b.go", type: "imports", direction: "forward", weight: 0.7 },
    ],
    layers: [
      { id: "core", name: "Core", description: "Core layer", nodeIds: ["file:src/a.go", "file:src/b.go"] },
    ],
    tour: [],
  };
}

describe("buildViewGraph", () => {
  it("keeps one equal-size dot per real function in a file", () => {
    const viewGraph = buildViewGraph(sampleGraph());
    const file = viewGraph.filesById.get("file:src/a.go");

    expect(file).toBeDefined();
    expect(file?.functionCount).toBe(3);
    expect(file?.functionDots).toHaveLength(3);
    expect(file?.functionDots.map((dot) => dot.size)).toEqual([1, 1, 1]);
    expect(file?.functionDots.map((dot) => dot.nodeId)).toEqual([
      "function:src/a.go:BuildData",
      "function:src/a.go:FilterItem",
      "function:src/a.go:RenderModel",
    ]);
  });

  it("groups function dots into entry, filter, data, model, and other buckets", () => {
    const viewGraph = buildViewGraph(sampleGraph());
    const file = viewGraph.filesById.get("file:src/a.go");

    expect(file?.functionGroups.map((group) => [group.kind, group.count])).toEqual([
      ["data", 1],
      ["filter", 1],
      ["model", 1],
    ]);
  });
});
