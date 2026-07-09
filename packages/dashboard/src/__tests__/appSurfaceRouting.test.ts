import { beforeEach, describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { useDashboardStore } from "../store";
import { buildWikiIndex } from "../wiki/wikiIndex";

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
    ],
    edges: [],
    layers: [{ id: "core", name: "Core", description: "Core layer", nodeIds: ["file:src/a.go"] }],
    tour: [],
  };
}

describe("app surface routing", () => {
  beforeEach(() => {
    useDashboardStore.getState().setGraph(graph());
    useDashboardStore.getState().setDashboardSurface("wiki");
    useDashboardStore.getState().setWikiIndex(
      buildWikiIndex({
        version: 1,
        generatedAt: "2026-07-09T00:00:00.000Z",
        projectName: "sample",
        pages: [
          {
            id: "wiki:overview",
            title: "Project Overview",
            category: "overview",
            summary: "Overview.",
            markdownPath: "knowledge-base/README.md",
            explainedNodeIds: ["file:src/a.go"],
            relatedNodeIds: [],
            evidenceIds: [],
            coverage: "complete",
            quality: "verified",
          },
        ],
        evidence: [],
        gaps: [],
      }),
    );
  });

  it("declares wiki as the initial peer surface and selects the first loaded page", () => {
    expect(useDashboardStore.getInitialState().dashboardSurface).toBe("wiki");
    expect(useDashboardStore.getInitialState().graphExplorerMode).toBe("semantic");
    expect(useDashboardStore.getState().dashboardSurface).toBe("wiki");
    expect(useDashboardStore.getState().activeWikiPageId).toBe("wiki:overview");
  });

  it("switches to graph through wiki page focus", () => {
    useDashboardStore.getState().openGraphForWikiPage("wiki:overview");

    expect(useDashboardStore.getState().dashboardSurface).toBe("graph");
    expect(useDashboardStore.getState().graphFocusNodeIds).toEqual(["file:src/a.go"]);
  });

  it("switches from graph node back to related wiki page", () => {
    useDashboardStore.getState().setDashboardSurface("graph");
    useDashboardStore.getState().openWikiForGraphNode("file:src/a.go");

    expect(useDashboardStore.getState().dashboardSurface).toBe("wiki");
    expect(useDashboardStore.getState().activeWikiPageId).toBe("wiki:overview");
  });
});
