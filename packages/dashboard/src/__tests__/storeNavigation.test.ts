import { beforeEach, describe, expect, it } from "vitest";
import {
  parseWikiIndexV2,
  type WikiPageV2,
} from "@understand-code/core/knowledge-base";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { useDashboardStore } from "../store";
import {
  buildWikiRuntimeIndex,
  emptyWikiRuntimeIndex,
} from "../wiki/wikiIndex";
import { wikiV2Fixture } from "../wiki/__tests__/fixtures/wikiV2Fixtures";

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

function wikiIndexWithPage(
  page: Partial<WikiPageV2> & Pick<WikiPageV2, "id" | "title" | "category" | "summary" | "markdownPath">,
) {
  return buildWikiRuntimeIndex({
    version: 2,
    generatedAt: "2026-07-11T00:00:00.000Z",
    projectName: "sample",
    source: { outputLanguage: "zh-CN", generationMode: "test" },
    mainReadiness: { status: "blocked", reasons: ["测试夹具"], routePageIds: [] },
    referenceCoverage: {
      status: "complete",
      files: { covered: 0, total: 0, missingIds: [] },
      functions: { covered: 0, total: 0, missingIds: [] },
      types: { covered: 0, total: 0, missingIds: [] },
    },
    pages: [{
      role: "reference",
      quality: "generated",
      generationStatus: "partial",
      directNodeIds: [],
      contextNodeIds: [],
      evidenceIds: [],
      searchTerms: [],
      ...page,
    }],
    nodeDocumentation: [],
    evidence: [],
  });
}

function preciseWikiIndex() {
  const payload = wikiV2Fixture();
  const runDocumentation = payload.nodeDocumentation.find(
    (item) => item.nodeId === "function:src/a.ts:run",
  );
  const overview = payload.pages.find((page) => page.id === "page:overview");
  if (!runDocumentation || !overview) throw new Error("missing precise-navigation fixture data");

  runDocumentation.primaryPageId = "page:file-a";
  runDocumentation.anchor = "run";
  overview.contextNodeIds.push("file:src/context-only.ts");
  payload.nodeDocumentation.push({
    nodeId: "file:src/context-only.ts",
    relation: "context",
    quality: "needs-review",
    evidenceHealth: "missing",
    generationStatus: "partial",
    referenceCoverage: "unanchored",
    directPageIds: [],
    contextPageIds: ["page:overview"],
    evidenceIds: [],
  });

  const parsed = parseWikiIndexV2(payload);
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  return buildWikiRuntimeIndex(parsed.value);
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
  beforeEach(() => {
    useDashboardStore.getState().setDashboardSurface("wiki");
    useDashboardStore.getState().setWikiIndex(emptyWikiRuntimeIndex());
    useDashboardStore.getState().selectWikiPage(null);
    useDashboardStore.getState().setGraphExplorerMode("global");
    useDashboardStore.setState({
      graphFocusNodeIds: [],
      graphFocusPageId: null,
      graphWikiNotice: null,
      pendingWikiAnchor: null,
      selectedNodeId: null,
    });
  });

  it("keeps the guided home selected after the first Wiki load", () => {
    useDashboardStore.setState({
      activeWikiPageId: null,
      dashboardSurface: "wiki",
      graphFocusNodeIds: [],
    });

    useDashboardStore.getState().setWikiIndex(buildWikiRuntimeIndex(wikiV2Fixture()));

    expect(useDashboardStore.getState()).toMatchObject({
      dashboardSurface: "wiki",
      activeWikiPageId: null,
      graphFocusNodeIds: [],
    });
  });

  it("keeps the guided home on the wiki surface when wiki pages exist", () => {
    useDashboardStore.getState().setGraph(sampleGraph());
    useDashboardStore.getState().setWikiIndex(wikiIndexWithPage({
      id: "wiki:overview",
      title: "Overview",
      category: "overview",
      summary: "Overview.",
      markdownPath: "knowledge-base/README.md",
      directNodeIds: ["file:src/a.go"],
      generationStatus: "complete",
    }));

    expect(useDashboardStore.getState().dashboardSurface).toBe("wiki");
    expect(useDashboardStore.getState().activeWikiPageId).toBeNull();
  });

  it("focuses only direct graph nodes and opens the Core primary Wiki target", () => {
    useDashboardStore.getState().setGraph(sampleGraph());
    useDashboardStore.getState().setWikiIndex(preciseWikiIndex());

    useDashboardStore.getState().openGraphForWikiPage("page:run");

    expect(useDashboardStore.getState().dashboardSurface).toBe("graph");
    expect(useDashboardStore.getState().graphFocusNodeIds).toEqual(["function:src/a.ts:run"]);
    expect(useDashboardStore.getState().graphFocusPageId).toBe("page:run");
    expect(useDashboardStore.getState().graphExplorerMode).toBe("focus");

    const destination = useDashboardStore.getState().openWikiForGraphNode("function:src/a.ts:run");

    expect(destination).toEqual({ pageId: "page:file-a", anchor: "run" });
    expect(useDashboardStore.getState().dashboardSurface).toBe("wiki");
    expect(useDashboardStore.getState().selectedNodeId).toBe("function:src/a.ts:run");
    expect(useDashboardStore.getState().activeWikiPageId).toBe("page:file-a");
    expect(useDashboardStore.getState().pendingWikiAnchor).toBe("run");
    expect(useDashboardStore.getState().graphWikiNotice).toBeNull();
  });

  it("accepts focus graph explorer mode without clearing graph focus ids", () => {
    useDashboardStore.getState().setGraph(sampleGraph());
    useDashboardStore.getState().setWikiIndex(wikiIndexWithPage({
      id: "wiki:function-build",
      title: "Build Function",
      category: "topic",
      summary: "Build docs.",
      markdownPath: "knowledge-base/functions/Build.md",
      directNodeIds: ["function:src/a.go:Build"],
      contextNodeIds: ["file:src/a.go"],
    }));

    useDashboardStore.getState().openGraphForWikiPage("wiki:function-build");
    useDashboardStore.getState().setGraphExplorerMode("focus");

    expect(useDashboardStore.getState().graphExplorerMode).toBe("focus");
    expect(useDashboardStore.getState().graphFocusNodeIds).toEqual(["function:src/a.go:Build"]);
    expect(useDashboardStore.getState().graphFocusPageId).toBe("wiki:function-build");
  });

  it("clears the graph focus source, direct nodes, and stale notice together", () => {
    useDashboardStore.getState().setWikiIndex(preciseWikiIndex());
    useDashboardStore.getState().openGraphForWikiPage("page:run");
    useDashboardStore.setState({ graphWikiNotice: "暂无专门正文" });

    useDashboardStore.getState().clearGraphFocus();

    expect(useDashboardStore.getState()).toMatchObject({
      graphFocusPageId: null,
      graphFocusNodeIds: [],
      graphWikiNotice: null,
    });
  });

  it("returns to graph home without retaining a Wiki-directed focus", () => {
    useDashboardStore.getState().setWikiIndex(preciseWikiIndex());
    useDashboardStore.getState().openGraphForWikiPage("page:run");
    useDashboardStore.setState({ graphWikiNotice: "暂无专门正文" });

    useDashboardStore.getState().setDashboardSurface("graph");

    expect(useDashboardStore.getState()).toMatchObject({
      dashboardSurface: "graph",
      pendingWikiAnchor: null,
      graphFocusPageId: null,
      graphFocusNodeIds: [],
      graphWikiNotice: null,
    });
  });

  it("preserves graph surface when wiki metadata reloads", () => {
    useDashboardStore.getState().setGraph(sampleGraph());
    useDashboardStore.getState().setDashboardSurface("graph");
    useDashboardStore.getState().setWikiIndex(wikiIndexWithPage({
      id: "wiki:overview",
      title: "Overview",
      category: "overview",
      summary: "Overview.",
      markdownPath: "knowledge-base/README.md",
      directNodeIds: ["file:src/a.go"],
      generationStatus: "complete",
    }));

    expect(useDashboardStore.getState().dashboardSurface).toBe("graph");
    expect(useDashboardStore.getState().activeWikiPageId).toBeNull();
  });

  it("treats an invalid Wiki-to-Graph page as a complete no-op", () => {
    useDashboardStore.getState().setGraph(sampleGraph());
    useDashboardStore.getState().setWikiIndex(preciseWikiIndex());
    useDashboardStore.getState().openGraphForWikiPage("page:run");
    useDashboardStore.getState().selectWikiPage("page:overview");
    const before = useDashboardStore.getState();

    useDashboardStore.getState().openGraphForWikiPage("missing");

    expect(useDashboardStore.getState()).toMatchObject({
      dashboardSurface: before.dashboardSurface,
      activeWikiPageId: before.activeWikiPageId,
      pendingWikiAnchor: before.pendingWikiAnchor,
      graphFocusPageId: before.graphFocusPageId,
      graphFocusNodeIds: before.graphFocusNodeIds,
      graphExplorerMode: before.graphExplorerMode,
    });
  });

  it("clears active wiki page when wiki metadata becomes empty", () => {
    useDashboardStore.getState().setGraph(sampleGraph());
    useDashboardStore.getState().setWikiIndex(wikiIndexWithPage({
      id: "wiki:overview",
      title: "Overview",
      category: "overview",
      summary: "Overview.",
      markdownPath: "knowledge-base/README.md",
      directNodeIds: ["file:src/a.go"],
      generationStatus: "complete",
    }));
    useDashboardStore.getState().setDashboardSurface("graph");

    useDashboardStore.getState().setWikiIndex(emptyWikiRuntimeIndex());

    expect(useDashboardStore.getState().dashboardSurface).toBe("graph");
    expect(useDashboardStore.getState().activeWikiPageId).toBeNull();
    expect(useDashboardStore.getState().wikiIndex.pageCount).toBe(0);
  });

  it("clears stale graph focus when wiki metadata removes the focused page", () => {
    useDashboardStore.getState().setGraph(sampleGraph());
    useDashboardStore.getState().setWikiIndex(wikiIndexWithPage({
      id: "wiki:function-build",
      title: "Build Function",
      category: "topic",
      summary: "Build docs.",
      markdownPath: "knowledge-base/functions/Build.md",
      directNodeIds: ["function:src/a.go:Build"],
      contextNodeIds: ["file:src/a.go"],
    }));
    useDashboardStore.getState().openGraphForWikiPage("wiki:function-build");
    expect(useDashboardStore.getState().graphFocusNodeIds).toEqual(["function:src/a.go:Build"]);
    expect(useDashboardStore.getState().graphFocusPageId).toBe("wiki:function-build");

    useDashboardStore.getState().setWikiIndex(emptyWikiRuntimeIndex());

    expect(useDashboardStore.getState().dashboardSurface).toBe("graph");
    expect(useDashboardStore.getState().activeWikiPageId).toBeNull();
    expect(useDashboardStore.getState().activeWikiPageId).not.toBe("wiki:function-build");
    expect(useDashboardStore.getState().graphFocusNodeIds).toEqual([]);
    expect(useDashboardStore.getState().graphFocusPageId).toBeNull();
  });

  it("refreshes graph focus when wiki metadata updates the focused page", () => {
    useDashboardStore.getState().setGraph(sampleGraph());
    useDashboardStore.getState().setWikiIndex(wikiIndexWithPage({
      id: "wiki:function-build",
      title: "Build Function",
      category: "topic",
      summary: "Build docs.",
      markdownPath: "knowledge-base/functions/Build.md",
      directNodeIds: ["function:src/a.go:Build"],
      contextNodeIds: ["file:src/a.go"],
    }));
    useDashboardStore.getState().openGraphForWikiPage("wiki:function-build");
    useDashboardStore.getState().selectWikiPage(null);

    useDashboardStore.getState().setWikiIndex(wikiIndexWithPage({
      id: "wiki:function-build",
      title: "Build Function",
      category: "topic",
      summary: "Updated build docs.",
      markdownPath: "knowledge-base/functions/Build.md",
      directNodeIds: ["file:src/a.go"],
      contextNodeIds: ["class:src/a.go:Worker"],
      generationStatus: "complete",
    }));

    expect(useDashboardStore.getState().dashboardSurface).toBe("graph");
    expect(useDashboardStore.getState().activeWikiPageId).toBeNull();
    expect(useDashboardStore.getState().graphFocusPageId).toBe("wiki:function-build");
    expect(useDashboardStore.getState().graphFocusNodeIds).toEqual([
      "file:src/a.go",
    ]);
  });

  it("keeps a context-only graph node on the graph and reports that it has no dedicated body", () => {
    useDashboardStore.getState().setWikiIndex(preciseWikiIndex());
    useDashboardStore.getState().openWikiTarget({ pageId: "page:file-a", anchor: "run" });
    useDashboardStore.getState().setDashboardSurface("graph");
    const before = useDashboardStore.getState();

    const destination = useDashboardStore.getState().openWikiForGraphNode("file:src/context-only.ts");

    expect(destination).toBeNull();
    expect(useDashboardStore.getState()).toMatchObject({
      dashboardSurface: "graph",
      selectedNodeId: "file:src/context-only.ts",
      activeWikiPageId: before.activeWikiPageId,
      pendingWikiAnchor: before.pendingWikiAnchor,
      graphFocusPageId: before.graphFocusPageId,
      graphFocusNodeIds: before.graphFocusNodeIds,
      graphWikiNotice: "暂无专门正文",
    });
  });

  it("clears a stale graph-to-Wiki notice when selection changes or a graph reloads", () => {
    useDashboardStore.getState().setWikiIndex(preciseWikiIndex());
    useDashboardStore.getState().setDashboardSurface("graph");
    useDashboardStore.getState().openWikiForGraphNode("file:src/context-only.ts");
    expect(useDashboardStore.getState().graphWikiNotice).toBe("暂无专门正文");

    useDashboardStore.getState().selectNode("function:src/a.ts:run");
    expect(useDashboardStore.getState().graphWikiNotice).toBeNull();

    useDashboardStore.getState().openWikiForGraphNode("file:src/context-only.ts");
    useDashboardStore.getState().setGraph(sampleGraph());
    expect(useDashboardStore.getState().graphWikiNotice).toBeNull();
  });

  it.each([
    ["layer navigation", () => useDashboardStore.getState().navigateToNodeInLayer("file:src/a.go")],
    ["history navigation", () => {
      useDashboardStore.setState({ nodeHistory: ["file:src/a.go"] });
      useDashboardStore.getState().navigateToHistoryIndex(0);
    }],
    ["back navigation", () => {
      useDashboardStore.setState({ nodeHistory: ["file:src/a.go"] });
      useDashboardStore.getState().goBackNode();
    }],
    ["layer drill-down", () => useDashboardStore.getState().drillIntoLayer("core")],
    ["overview navigation", () => useDashboardStore.getState().navigateToOverview()],
    ["file detail", () => useDashboardStore.getState().openFileDetail("file:src/a.go")],
    ["node focus", () => useDashboardStore.getState().setFocusNode("file:src/a.go")],
    ["persona overview", () => useDashboardStore.getState().activatePersonaMode("non-technical")],
    ["tour start", () => useDashboardStore.getState().startTour()],
    ["view-mode reset", () => useDashboardStore.getState().setViewMode("structural")],
    ["domain reset", () => useDashboardStore.getState().clearActiveDomain()],
  ])("clears a stale graph-to-Wiki notice through %s", (_label, navigate) => {
    useDashboardStore.getState().setGraph(sampleGraph());
    useDashboardStore.setState({ graphWikiNotice: "暂无专门正文" });

    navigate();

    expect(useDashboardStore.getState().graphWikiNotice).toBeNull();
  });

  it("opens a valid full Wiki target and ignores an unknown page", () => {
    useDashboardStore.getState().setWikiIndex(buildWikiRuntimeIndex(wikiV2Fixture()));
    useDashboardStore.getState().openWikiTarget({ pageId: "page:file-a", anchor: "run" });
    expect(useDashboardStore.getState()).toMatchObject({
      dashboardSurface: "wiki",
      activeWikiPageId: "page:file-a",
      pendingWikiAnchor: "run",
    });

    useDashboardStore.getState().openWikiTarget({ pageId: "page:missing", anchor: "ghost" });
    expect(useDashboardStore.getState()).toMatchObject({
      activeWikiPageId: "page:file-a",
      pendingWikiAnchor: "run",
    });
  });

  it("clears an older anchor for a page-only target, normal page selection, and Wiki home", () => {
    useDashboardStore.getState().setWikiIndex(buildWikiRuntimeIndex(wikiV2Fixture()));
    useDashboardStore.getState().openWikiTarget({ pageId: "page:file-a", anchor: "run" });
    useDashboardStore.getState().openWikiTarget({ pageId: "page:run" });
    expect(useDashboardStore.getState()).toMatchObject({
      activeWikiPageId: "page:run",
      pendingWikiAnchor: null,
    });

    useDashboardStore.getState().openWikiTarget({ pageId: "page:file-a", anchor: "run" });
    useDashboardStore.getState().selectWikiPage("page:overview");
    expect(useDashboardStore.getState()).toMatchObject({
      activeWikiPageId: "page:overview",
      pendingWikiAnchor: null,
    });

    useDashboardStore.getState().openWikiTarget({ pageId: "page:file-a", anchor: "run" });
    useDashboardStore.getState().selectWikiPage(null);
    expect(useDashboardStore.getState()).toMatchObject({
      activeWikiPageId: null,
      pendingWikiAnchor: null,
    });
  });

  it("consumes only the exact pending Wiki anchor", () => {
    useDashboardStore.getState().setWikiIndex(buildWikiRuntimeIndex(wikiV2Fixture()));
    useDashboardStore.getState().openWikiTarget({ pageId: "page:file-a", anchor: "run" });
    useDashboardStore.getState().consumePendingWikiAnchor("other");
    expect(useDashboardStore.getState().pendingWikiAnchor).toBe("run");

    useDashboardStore.getState().consumePendingWikiAnchor("run");
    expect(useDashboardStore.getState().pendingWikiAnchor).toBeNull();
  });

  it("clears a pending target when Wiki metadata removes its selected page", () => {
    useDashboardStore.getState().setWikiIndex(buildWikiRuntimeIndex(wikiV2Fixture()));
    useDashboardStore.getState().openWikiTarget({ pageId: "page:file-a", anchor: "run" });
    useDashboardStore.getState().setWikiIndex(emptyWikiRuntimeIndex());

    expect(useDashboardStore.getState()).toMatchObject({
      activeWikiPageId: null,
      pendingWikiAnchor: null,
    });
  });

  it("preserves a pending anchor while its active page survives a Wiki reload", () => {
    useDashboardStore.getState().setWikiIndex(preciseWikiIndex());
    useDashboardStore.getState().openWikiTarget({ pageId: "page:file-a", anchor: "run" });

    useDashboardStore.getState().setWikiIndex(preciseWikiIndex());

    expect(useDashboardStore.getState()).toMatchObject({
      activeWikiPageId: "page:file-a",
      pendingWikiAnchor: "run",
    });
  });

  it("clears a pending Wiki anchor when crossing to the graph surface", () => {
    useDashboardStore.getState().setWikiIndex(buildWikiRuntimeIndex(wikiV2Fixture()));
    useDashboardStore.getState().openWikiTarget({ pageId: "page:file-a", anchor: "run" });
    useDashboardStore.getState().setDashboardSurface("graph");
    expect(useDashboardStore.getState().pendingWikiAnchor).toBeNull();

    useDashboardStore.getState().openWikiTarget({ pageId: "page:file-a", anchor: "run" });
    useDashboardStore.getState().openGraphForWikiPage("page:file-a");
    expect(useDashboardStore.getState()).toMatchObject({
      dashboardSurface: "graph",
      pendingWikiAnchor: null,
    });
  });
});
