import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-anything/core/types";
import type { SearchResult } from "@understand-anything/core/search";
import { buildViewGraph } from "../../viewgraph/buildViewGraph";
import { buildReadingAssistantModel } from "../readingAssistantModel";

function sampleGraph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "sample",
      languages: ["go"],
      frameworks: [],
      description: "Sample project",
      analyzedAt: "2026-06-26T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes: [
      { id: "file:src/a.go", type: "file", name: "a.go", filePath: "src/a.go", summary: "", tags: [], complexity: "complex" },
      { id: "file:src/b.go", type: "file", name: "b.go", filePath: "src/b.go", summary: "", tags: [], complexity: "simple" },
      { id: "function:src/a.go:Build", type: "function", name: "Build", filePath: "src/a.go", lineRange: [1, 5], summary: "", tags: [], complexity: "complex" },
      { id: "function:src/a.go:Filter", type: "function", name: "Filter", filePath: "src/a.go", lineRange: [7, 9], summary: "", tags: [], complexity: "moderate" },
      { id: "function:src/b.go:Load", type: "function", name: "Load", filePath: "src/b.go", lineRange: [2, 3], summary: "", tags: [], complexity: "simple" },
    ],
    edges: [
      { source: "file:src/a.go", target: "function:src/a.go:Build", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/a.go", target: "function:src/a.go:Filter", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/b.go", target: "function:src/b.go:Load", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/a.go", target: "file:src/b.go", type: "imports", direction: "forward", weight: 0.7 },
    ],
    layers: [
      { id: "core", name: "Core", description: "Core layer", nodeIds: ["file:src/a.go"] },
      { id: "data", name: "Data", description: "Data layer", nodeIds: ["file:src/b.go"] },
    ],
    tour: [],
  };
}

describe("buildReadingAssistantModel", () => {
  it("builds an overview model from the readable graph", () => {
    const graph = sampleGraph();
    const viewGraph = buildViewGraph(graph);

    const model = buildReadingAssistantModel({
      graph,
      viewGraph,
      navigationLevel: "overview",
      activeLayerId: null,
      searchQuery: "",
      searchResults: [],
    });

    expect(model.kind).toBe("overview");
    expect(model.title).toBe("Project reading map");
    expect(model.metrics.map((metric) => [metric.label, metric.value])).toEqual([
      ["Layers", 2],
      ["Files", 2],
      ["Functions", 3],
    ]);
    expect(model.primaryItems.map((item) => item.label)).toEqual(["Core", "Data"]);
  });

  it("builds a layer model with top files", () => {
    const graph = sampleGraph();
    const viewGraph = buildViewGraph(graph);

    const model = buildReadingAssistantModel({
      graph,
      viewGraph,
      navigationLevel: "layer-detail",
      activeLayerId: "core",
      searchQuery: "",
      searchResults: [],
    });

    expect(model.kind).toBe("layer");
    expect(model.title).toBe("Core");
    expect(model.metrics.map((metric) => [metric.label, metric.value])).toContainEqual(["Functions", 2]);
    expect(model.primaryItems.map((item) => item.label)).toEqual(["a.go"]);
  });

  it("summarizes readable search matches", () => {
    const graph = sampleGraph();
    const viewGraph = buildViewGraph(graph);
    const searchResults: SearchResult[] = [
      { nodeId: "function:src/a.go:Build", score: 0.05 },
      { nodeId: "file:src/b.go", score: 0.1 },
    ];

    const model = buildReadingAssistantModel({
      graph,
      viewGraph,
      navigationLevel: "overview",
      activeLayerId: null,
      searchQuery: "build",
      searchResults,
    });

    expect(model.searchSummary).toEqual({
      query: "build",
      fileMatches: 2,
      layerMatches: 2,
    });
  });
});
