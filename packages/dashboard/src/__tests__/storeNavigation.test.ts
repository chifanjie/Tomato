import { beforeEach, describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { useDashboardStore } from "../store";
import { buildWikiIndex } from "../wiki/wikiIndex";

type PersonaModeStore = ReturnType<typeof useDashboardStore.getState> & {
  activatePersonaMode?: (persona: "non-technical" | "junior" | "experienced") => void;
};

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
      { id: "class:src/a.go:Worker", type: "class", name: "Worker", filePath: "src/a.go", lineRange: [1, 8], summary: "", tags: [], complexity: "moderate" },
      { id: "function:src/a.go:Build", type: "function", name: "Build", filePath: "src/a.go", lineRange: [10, 20], summary: "", tags: [], complexity: "complex" },
    ],
    edges: [
      { source: "file:src/a.go", target: "class:src/a.go:Worker", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/a.go", target: "function:src/a.go:Build", type: "contains", direction: "forward", weight: 1 },
    ],
    layers: [
      { id: "core", name: "Core", description: "Core layer", nodeIds: ["file:src/a.go"] },
    ],
    tour: [
      {
        order: 1,
        title: "Read the core",
        description: "Start with the core layer",
        nodeIds: ["file:src/a.go"],
      },
    ],
  };
}

describe("dashboard store readable navigation", () => {
  beforeEach(() => {
    useDashboardStore.getState().setGraph(sampleGraph());
  });

  it("keeps file search results in readable layer detail", () => {
    useDashboardStore.getState().navigateToNodeInLayer("file:src/a.go");

    const state = useDashboardStore.getState();
    expect(state.navigationLevel).toBe("layer-detail");
    expect(state.activeLayerId).toBe("core");
    expect(state.activeFileId).toBeNull();
    expect(state.selectedNodeId).toBe("file:src/a.go");
  });

  it("opens parent file detail for function search results", () => {
    useDashboardStore.getState().navigateToNodeInLayer("function:src/a.go:Build");

    const state = useDashboardStore.getState();
    expect(state.navigationLevel).toBe("file-detail");
    expect(state.activeLayerId).toBe("core");
    expect(state.activeFileId).toBe("file:src/a.go");
    expect(state.selectedNodeId).toBe("function:src/a.go:Build");
  });

  it("opens parent file detail for class search results", () => {
    useDashboardStore.getState().navigateToNodeInLayer("class:src/a.go:Worker");

    const state = useDashboardStore.getState();
    expect(state.navigationLevel).toBe("file-detail");
    expect(state.activeLayerId).toBe("core");
    expect(state.activeFileId).toBe("file:src/a.go");
    expect(state.selectedNodeId).toBe("class:src/a.go:Worker");
  });

  it("activates overview as a real mode by returning to project-level structure", () => {
    const store = useDashboardStore.getState() as PersonaModeStore;

    store.navigateToNodeInLayer("function:src/a.go:Build");
    store.setDetailLevel("class");
    store.activatePersonaMode?.("non-technical");

    const state = useDashboardStore.getState();
    expect(typeof store.activatePersonaMode).toBe("function");
    expect(state.persona).toBe("non-technical");
    expect(state.viewMode).toBe("structural");
    expect(state.navigationLevel).toBe("overview");
    expect(state.activeLayerId).toBeNull();
    expect(state.activeFileId).toBeNull();
    expect(state.selectedNodeId).toBeNull();
    expect(state.detailLevel).toBe("file");
  });

  it("activates learn as a real mode without losing the structural dashboard", () => {
    const store = useDashboardStore.getState() as PersonaModeStore;

    store.setViewMode("domain");
    store.setDetailLevel("class");
    store.activatePersonaMode?.("junior");

    const state = useDashboardStore.getState();
    expect(typeof store.activatePersonaMode).toBe("function");
    expect(state.persona).toBe("junior");
    expect(state.viewMode).toBe("structural");
    expect(state.detailLevel).toBe("file");
    expect(state.tourActive).toBe(false);
  });

  it("activates deep dive as a real mode by exposing code structure", () => {
    const store = useDashboardStore.getState() as PersonaModeStore;

    store.startTour();
    store.activatePersonaMode?.("experienced");

    const state = useDashboardStore.getState();
    expect(typeof store.activatePersonaMode).toBe("function");
    expect(state.persona).toBe("experienced");
    expect(state.viewMode).toBe("structural");
    expect(state.detailLevel).toBe("class");
    expect(state.showFunctionsInClassView).toBe(true);
    expect(state.tourActive).toBe(false);
  });
});

describe("dashboard wiki and graph surface state", () => {
  it("defaults to wiki surface when wiki pages exist", () => {
    useDashboardStore.getState().setGraph(sampleGraph());
    useDashboardStore.getState().setWikiIndex(buildWikiIndex({
      version: 1,
      generatedAt: "2026-07-09T00:00:00.000Z",
      projectName: "sample",
      pages: [
        {
          id: "wiki:overview",
          title: "Overview",
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
    }));

    expect(useDashboardStore.getState().dashboardSurface).toBe("wiki");
    expect(useDashboardStore.getState().activeWikiPageId).toBe("wiki:overview");
  });

  it("focuses graph from wiki page and links graph node back to wiki", () => {
    useDashboardStore.getState().setGraph(sampleGraph());
    useDashboardStore.getState().setWikiIndex(buildWikiIndex({
      version: 1,
      generatedAt: "2026-07-09T00:00:00.000Z",
      projectName: "sample",
      pages: [
        {
          id: "wiki:function-build",
          title: "Build Function",
          category: "symbol",
          summary: "Build docs.",
          markdownPath: "knowledge-base/functions/Build.md",
          explainedNodeIds: ["function:src/a.go:Build"],
          relatedNodeIds: ["file:src/a.go"],
          evidenceIds: [],
          coverage: "partial",
          quality: "generated",
        },
      ],
      evidence: [],
      gaps: [],
    }));

    useDashboardStore.getState().openGraphForWikiPage("wiki:function-build");

    expect(useDashboardStore.getState().dashboardSurface).toBe("graph");
    expect(useDashboardStore.getState().graphFocusNodeIds).toEqual([
      "function:src/a.go:Build",
      "file:src/a.go",
    ]);

    useDashboardStore.getState().openWikiForGraphNode("function:src/a.go:Build");

    expect(useDashboardStore.getState().dashboardSurface).toBe("wiki");
    expect(useDashboardStore.getState().activeWikiPageId).toBe("wiki:function-build");
  });
});
