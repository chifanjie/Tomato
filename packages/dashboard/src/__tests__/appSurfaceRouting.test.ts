import { beforeEach, describe, expect, it } from "vitest";
import { parseWikiIndexV2 } from "@understand-code/core/knowledge-base";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { useDashboardStore } from "../store";
import { buildWikiRuntimeIndex } from "../wiki/wikiIndex";
import { wikiV2Fixture } from "../wiki/__tests__/fixtures/wikiV2Fixtures";

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
    const payload = wikiV2Fixture();
    const overview = payload.pages[0];
    if (!overview) throw new Error("missing fixture overview");
    payload.pages = [{
      ...overview,
      id: "wiki:overview",
      title: "Project Overview",
      markdownPath: "knowledge-base/README.md",
      directNodeIds: ["file:src/a.go"],
      contextNodeIds: [],
      evidenceIds: [],
      route: undefined,
    }];
    payload.mainReadiness = { status: "blocked", reasons: ["测试夹具"], routePageIds: [] };
    payload.nodeDocumentation = [{
      nodeId: "file:src/a.go",
      relation: "direct",
      quality: "needs-review",
      evidenceHealth: "missing",
      generationStatus: "partial",
      referenceCoverage: "unanchored",
      directPageIds: ["wiki:overview"],
      contextPageIds: [],
      evidenceIds: [],
      primaryPageId: "wiki:overview",
    }];
    payload.evidence = [];
    const parsed = parseWikiIndexV2(payload);
    if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
    useDashboardStore.getState().setGraph(graph());
    useDashboardStore.getState().setDashboardSurface("wiki");
    useDashboardStore.getState().setWikiIndex(
      buildWikiRuntimeIndex(parsed.value),
    );
  });

  it("declares wiki as the initial peer surface and keeps the guided home selected", () => {
    expect(useDashboardStore.getInitialState().dashboardSurface).toBe("wiki");
    expect(useDashboardStore.getInitialState().graphExplorerMode).toBe("semantic");
    expect(useDashboardStore.getState().dashboardSurface).toBe("wiki");
    expect(useDashboardStore.getState().activeWikiPageId).toBeNull();
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
