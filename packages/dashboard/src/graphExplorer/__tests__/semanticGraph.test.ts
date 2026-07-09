import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { buildWikiIndex } from "../../wiki/wikiIndex";
import {
  buildSemanticGraph,
  semanticGroupForNode,
  type GraphExplorerMode,
} from "../semanticGraph";

function graph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "sample",
      languages: ["go"],
      frameworks: [],
      description: "",
      analyzedAt: "2026-07-09T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes: [
      { id: "module:productline", type: "module", name: "productline", summary: "Module.", tags: [], complexity: "moderate" },
      { id: "file:productline/service.go", type: "file", name: "service.go", filePath: "productline/service.go", summary: "File.", tags: [], complexity: "moderate" },
      { id: "function:productline/service.go:Recognise", type: "function", name: "Recognise", filePath: "productline/service.go", lineRange: [10, 20], summary: "Function.", tags: [], complexity: "complex" },
      { id: "file:shared/rate_limit.go", type: "file", name: "rate_limit.go", filePath: "shared/rate_limit.go", summary: "File.", tags: [], complexity: "simple" },
    ],
    edges: [
      { source: "module:productline", target: "file:productline/service.go", type: "contains", direction: "forward", weight: 1 },
      { source: "file:productline/service.go", target: "function:productline/service.go:Recognise", type: "contains", direction: "forward", weight: 1 },
      { source: "function:productline/service.go:Recognise", target: "file:shared/rate_limit.go", type: "calls", direction: "forward", weight: 0.7 },
    ],
    layers: [
      { id: "productline", name: "Product Line", description: "Layer.", nodeIds: ["module:productline", "file:productline/service.go"] },
      { id: "shared", name: "Shared", description: "Layer.", nodeIds: ["file:shared/rate_limit.go"] },
    ],
    tour: [],
  };
}

const wikiIndex = buildWikiIndex({
  version: 1,
  generatedAt: "2026-07-09T00:00:00.000Z",
  projectName: "sample",
  pages: [
    {
      id: "wiki:recognise",
      title: "Recognition",
      category: "flow",
      summary: "Recognition docs.",
      markdownPath: "knowledge-base/flow.md",
      explainedNodeIds: ["function:productline/service.go:Recognise"],
      relatedNodeIds: ["file:productline/service.go"],
      evidenceIds: [],
      coverage: "partial",
      quality: "generated",
    },
  ],
  evidence: [],
  gaps: [
    {
      id: "gap:rate-limit",
      nodeId: "file:shared/rate_limit.go",
      reason: "Missing docs.",
      severity: "medium",
    },
  ],
});

describe("semanticGraph", () => {
  it("groups nodes by readable semantic level", () => {
    expect(semanticGroupForNode(graph().nodes[0])).toBe("module");
    expect(semanticGroupForNode(graph().nodes[1])).toBe("file");
    expect(semanticGroupForNode(graph().nodes[2])).toBe("symbol");
  });

  it.each<GraphExplorerMode>(["global", "semantic", "architecture", "call", "coverage", "evidence"])(
    "builds readable nodes and bundled edges for %s mode",
    (mode) => {
      const semantic = buildSemanticGraph({
        graph: graph(),
        wikiIndex,
        mode,
        focusNodeIds: [],
      });

      expect(semantic.nodes.length).toBeGreaterThan(0);
      expect(semantic.edges.length).toBeGreaterThan(0);
      expect(semantic.nodes.some((node) => node.coverage.status === "gap")).toBe(true);
    },
  );

  it("keeps only focused node neighborhoods when focus ids are provided", () => {
    const semantic = buildSemanticGraph({
      graph: graph(),
      wikiIndex,
      mode: "semantic",
      focusNodeIds: ["function:productline/service.go:Recognise"],
    });

    expect(semantic.nodes.map((node) => node.id).sort()).toEqual([
      "file:productline/service.go",
      "file:shared/rate_limit.go",
      "function:productline/service.go:Recognise",
    ]);
  });
});
