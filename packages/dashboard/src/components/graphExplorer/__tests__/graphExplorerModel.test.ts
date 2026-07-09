import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { buildWikiIndex } from "../../../wiki/wikiIndex";
import { buildGraphExplorerView } from "../graphExplorerModel";

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
      {
        id: "file:src/a.go",
        type: "file",
        name: "a.go",
        filePath: "src/a.go",
        summary: "File A.",
        tags: [],
        complexity: "moderate",
      },
      {
        id: "function:src/a.go:Build",
        type: "function",
        name: "Build",
        filePath: "src/a.go",
        lineRange: [10, 20],
        summary: "Builds data.",
        tags: [],
        complexity: "complex",
      },
      {
        id: "file:src/b.go",
        type: "file",
        name: "b.go",
        filePath: "src/b.go",
        summary: "File B.",
        tags: [],
        complexity: "simple",
      },
    ],
    edges: [
      {
        source: "file:src/a.go",
        target: "function:src/a.go:Build",
        type: "contains",
        direction: "forward",
        weight: 1,
      },
    ],
    layers: [
      {
        id: "core",
        name: "Core",
        description: "Core layer",
        nodeIds: ["file:src/a.go", "file:src/b.go"],
      },
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
      id: "wiki:build",
      title: "Build Function",
      category: "symbol",
      summary: "Build docs.",
      markdownPath: "knowledge-base/functions/Build.md",
      explainedNodeIds: ["function:src/a.go:Build"],
      relatedNodeIds: ["file:src/a.go"],
      evidenceIds: ["evidence:build"],
      coverage: "complete",
      quality: "verified",
    },
  ],
  evidence: [
    {
      id: "evidence:build",
      label: "Build implementation",
      filePath: "src/a.go",
      lineRange: [10, 20],
      nodeIds: ["function:src/a.go:Build"],
    },
  ],
  gaps: [
    {
      id: "gap:b",
      nodeId: "file:src/b.go",
      reason: "File B has no wiki page yet.",
      severity: "medium",
    },
  ],
});

describe("graphExplorerModel", () => {
  it("builds full graph explorer view data for a selected node", () => {
    const view = buildGraphExplorerView({
      graph: graph(),
      wikiIndex,
      mode: "global",
      focusNodeIds: [],
      selectedNodeId: "function:src/a.go:Build",
    });

    expect(view.semanticGraph.nodes.map((node) => node.id)).toEqual([
      "file:src/a.go",
      "function:src/a.go:Build",
      "file:src/b.go",
    ]);
    expect(view.selectedNode?.name).toBe("Build");
    expect(view.selectedNodeVisible).toBe(true);
    expect(view.hiddenSelectedNode).toBeNull();
    expect(view.selectedSemanticNode?.group).toBe("symbol");
    expect(view.selectedCoverage?.status).toBe("complete");
    expect(view.selectedPages.map((page) => page.id)).toEqual(["wiki:build"]);
    expect(view.selectedSemanticNode?.docs.evidenceIds).toEqual(["evidence:build"]);
    expect(view.canOpenWiki).toBe(true);
  });

  it("returns empty selected details when no node is selected", () => {
    const view = buildGraphExplorerView({
      graph: graph(),
      wikiIndex,
      mode: "coverage",
      focusNodeIds: [],
      selectedNodeId: null,
    });

    expect(view.selectedNode).toBeNull();
    expect(view.selectedNodeVisible).toBe(false);
    expect(view.hiddenSelectedNode).toBeNull();
    expect(view.selectedSemanticNode).toBeNull();
    expect(view.selectedCoverage).toBeNull();
    expect(view.selectedPages).toEqual([]);
    expect(view.canOpenWiki).toBe(false);
  });

  it("uses unknown coverage when wiki metadata is unavailable", () => {
    const view = buildGraphExplorerView({
      graph: graph(),
      mode: "global",
      focusNodeIds: [],
      selectedNodeId: "function:src/a.go:Build",
    });

    expect(view.selectedNode?.id).toBe("function:src/a.go:Build");
    expect(view.selectedNodeVisible).toBe(true);
    expect(view.hiddenSelectedNode).toBeNull();
    expect(view.selectedCoverage).toMatchObject({ status: "unknown", pages: [], gaps: [] });
    expect(view.selectedPages).toEqual([]);
    expect(view.canOpenWiki).toBe(false);
  });

  it("reports a selected function as hidden when semantic mode filters it out", () => {
    const view = buildGraphExplorerView({
      graph: graph(),
      wikiIndex,
      mode: "semantic",
      focusNodeIds: [],
      selectedNodeId: "function:src/a.go:Build",
    });

    expect(view.semanticGraph.nodes.map((node) => node.id)).toEqual([
      "file:src/a.go",
      "file:src/b.go",
    ]);
    expect(view.selectedNode).toBeNull();
    expect(view.selectedNodeVisible).toBe(false);
    expect(view.selectedSemanticNode).toBeNull();
    expect(view.hiddenSelectedNode?.id).toBe("function:src/a.go:Build");
    expect(view.hiddenSelectedNode?.name).toBe("Build");
    expect(view.selectedCoverage).toBeNull();
    expect(view.selectedPages.map((page) => page.id)).toEqual(["wiki:build"]);
    expect(view.canOpenWiki).toBe(true);
  });

  it("filters the semantic graph by focus node ids", () => {
    const view = buildGraphExplorerView({
      graph: graph(),
      wikiIndex,
      mode: "focus",
      focusNodeIds: ["function:src/a.go:Build"],
      selectedNodeId: "function:src/a.go:Build",
    });

    expect(view.semanticGraph.nodes.map((node) => node.id).sort()).toEqual([
      "file:src/a.go",
      "function:src/a.go:Build",
    ]);
    expect(view.semanticGraph.edges.map((edge) => edge.id)).toEqual([
      "file:src/a.go->function:src/a.go:Build",
    ]);
  });
});
