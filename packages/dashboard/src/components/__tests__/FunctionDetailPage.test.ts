import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { buildViewGraph } from "../../viewgraph/buildViewGraph";
import { selectInitialFunctionId } from "../FunctionDetailPage";

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
      { id: "function:src/a.go:Alpha", type: "function", name: "Alpha", filePath: "src/a.go", lineRange: [1, 2], summary: "", tags: [], complexity: "simple" },
      { id: "function:src/a.go:Build", type: "function", name: "Build", filePath: "src/a.go", lineRange: [3, 4], summary: "", tags: [], complexity: "complex" },
    ],
    edges: [
      { source: "file:src/a.go", target: "function:src/a.go:Alpha", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/a.go", target: "function:src/a.go:Build", type: "contains", direction: "forward", weight: 1 },
    ],
    layers: [
      { id: "core", name: "Core", description: "Core layer", nodeIds: ["file:src/a.go"] },
    ],
    tour: [],
  };
}

describe("FunctionDetailPage selection", () => {
  it("uses the searched function when it belongs to the active file", () => {
    const viewGraph = buildViewGraph(sampleGraph());
    const file = viewGraph.filesById.get("file:src/a.go") ?? null;

    expect(selectInitialFunctionId(file, "function:src/a.go:Build")).toBe("function:src/a.go:Build");
  });

  it("falls back to the first function when selected node is not in the file", () => {
    const viewGraph = buildViewGraph(sampleGraph());
    const file = viewGraph.filesById.get("file:src/a.go") ?? null;

    expect(selectInitialFunctionId(file, "function:src/other.go:Build")).toBe("function:src/a.go:Alpha");
  });
});
