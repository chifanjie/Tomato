import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-anything/core/types";
import type { SearchResult } from "@understand-anything/core/search";
import { buildViewGraph } from "../buildViewGraph";
import {
  buildReadableSearchMatches,
  findParentFileId,
  getFilesForLayer,
} from "../readableSelectors";

function sampleGraph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "sample",
      languages: ["go"],
      frameworks: [],
      description: "",
      analyzedAt: "2026-06-25T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes: [
      { id: "file:src/a.go", type: "file", name: "a.go", filePath: "src/a.go", summary: "", tags: [], complexity: "complex" },
      { id: "file:src/b.go", type: "file", name: "b.go", filePath: "src/b.go", summary: "", tags: [], complexity: "simple" },
      { id: "class:src/a.go:Worker", type: "class", name: "Worker", filePath: "src/a.go", lineRange: [1, 8], summary: "", tags: [], complexity: "moderate" },
      { id: "function:src/a.go:Build", type: "function", name: "Build", filePath: "src/a.go", lineRange: [10, 20], summary: "", tags: [], complexity: "complex" },
      { id: "function:src/b.go:Load", type: "function", name: "Load", filePath: "src/b.go", lineRange: [2, 6], summary: "", tags: [], complexity: "simple" },
    ],
    edges: [
      { source: "file:src/a.go", target: "class:src/a.go:Worker", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/a.go", target: "function:src/a.go:Build", type: "contains", direction: "forward", weight: 1 },
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

describe("readableSelectors", () => {
  it("returns files for the requested layer sorted by function count then path", () => {
    const viewGraph = buildViewGraph(sampleGraph());
    const files = getFilesForLayer(viewGraph, "core");

    expect(files.map((file) => file.id)).toEqual(["file:src/a.go"]);
  });

  it("maps function and class nodes back to their parent file", () => {
    const graph = sampleGraph();
    const viewGraph = buildViewGraph(graph);

    expect(findParentFileId(graph, viewGraph, "function:src/a.go:Build")).toBe("file:src/a.go");
    expect(findParentFileId(graph, viewGraph, "class:src/a.go:Worker")).toBe("file:src/a.go");
    expect(findParentFileId(graph, viewGraph, "file:src/b.go")).toBe("file:src/b.go");
  });

  it("aggregates search matches to parent files and layers", () => {
    const graph = sampleGraph();
    const viewGraph = buildViewGraph(graph);
    const searchResults: SearchResult[] = [
      { nodeId: "function:src/a.go:Build", score: 0.05 },
      { nodeId: "class:src/a.go:Worker", score: 0.1 },
      { nodeId: "file:src/b.go", score: 0.2 },
    ];

    const matches = buildReadableSearchMatches(graph, viewGraph, searchResults);

    expect(matches.fileMatchCounts.get("file:src/a.go")).toBe(2);
    expect(matches.fileMatchCounts.get("file:src/b.go")).toBe(1);
    expect(matches.layerMatchCounts.get("core")).toBe(2);
    expect(matches.layerMatchCounts.get("data")).toBe(1);
    expect(matches.matchedFileIds.has("file:src/a.go")).toBe(true);
  });
});
