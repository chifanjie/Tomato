import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { parseWikiIndexV2 } from "@understand-code/core/knowledge-base";
import { useDashboardStore } from "../store";
import {
  graphFixture,
  wikiRuntimeFixture,
} from "../graphExplorer/__tests__/graphFixtures";
import { wikiV2Fixture } from "../wiki/__tests__/fixtures/wikiV2Fixtures";
import {
  buildWikiRuntimeIndex,
  emptyWikiRuntimeIndex,
} from "../wiki/wikiIndex";

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

describe("dashboard wiki and graph surface state", () => {
  beforeEach(() => {
    const state = useDashboardStore.getState();
    state.setConsoleGraph(graphFixture());
    state.setWikiIndex(wikiRuntimeFixture());
    state.setDashboardSurface("wiki");
    state.selectWikiPage(null);
    state.clearGraphFocus();
    state.selectNode(null);
    state.setGraphExplorerMode("architecture");
  });

  it("starts with the two active surfaces and architecture graph mode", () => {
    expect(useDashboardStore.getInitialState()).toMatchObject({
      dashboardSurface: "wiki",
      graphExplorerMode: "architecture",
      activeWikiPageId: null,
    });
  });

  it("selects and clears raw, scope, and boundary graph objects through one value", () => {
    useDashboardStore.getState().selectNode("scope:layer:core");
    expect(useDashboardStore.getState().selectedNodeId).toBe("scope:layer:core");

    useDashboardStore.getState().selectNode("boundary:layer:external");
    expect(useDashboardStore.getState().selectedNodeId).toBe("boundary:layer:external");

    useDashboardStore.getState().selectNode(null);
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();
  });

  it("keeps the guided home selected after Wiki metadata loads", () => {
    useDashboardStore.getState().setWikiIndex(buildWikiRuntimeIndex(wikiV2Fixture()));

    expect(useDashboardStore.getState()).toMatchObject({
      dashboardSurface: "wiki",
      activeWikiPageId: null,
      graphFocusNodeIds: [],
    });
  });

  it("focuses direct graph nodes in architecture mode and opens the exact primary Wiki target", () => {
    useDashboardStore.getState().setWikiIndex(preciseWikiIndex());
    useDashboardStore.getState().openGraphForWikiPage("page:run");

    expect(useDashboardStore.getState()).toMatchObject({
      dashboardSurface: "graph",
      graphExplorerMode: "architecture",
      graphFocusPageId: "page:run",
      graphFocusNodeIds: ["function:src/a.ts:run"],
    });

    const destination = useDashboardStore.getState().openWikiForGraphNode("function:src/a.ts:run");
    expect(destination).toEqual({ pageId: "page:file-a", anchor: "run" });
    expect(useDashboardStore.getState()).toMatchObject({
      dashboardSurface: "wiki",
      activeWikiPageId: "page:file-a",
      pendingWikiAnchor: "run",
      selectedNodeId: "function:src/a.ts:run",
      graphWikiNotice: null,
    });
  });

  it("keeps a context-only node on the graph and explains that no dedicated body exists", () => {
    useDashboardStore.getState().setWikiIndex(preciseWikiIndex());
    useDashboardStore.getState().setDashboardSurface("graph");

    expect(useDashboardStore.getState().openWikiForGraphNode("file:src/context-only.ts")).toBeNull();
    expect(useDashboardStore.getState()).toMatchObject({
      dashboardSurface: "graph",
      selectedNodeId: "file:src/context-only.ts",
      graphWikiNotice: "暂无专门正文",
    });

    useDashboardStore.getState().selectNode("function:src/a.ts:run");
    expect(useDashboardStore.getState().graphWikiNotice).toBeNull();
  });

  it("clears Wiki-directed graph focus when the graph home is opened", () => {
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

  it("treats an invalid Wiki-to-Graph page as a complete no-op", () => {
    useDashboardStore.getState().openGraphForWikiPage("page:run");
    const before = useDashboardStore.getState();

    useDashboardStore.getState().openGraphForWikiPage("missing");

    expect(useDashboardStore.getState()).toMatchObject({
      dashboardSurface: before.dashboardSurface,
      activeWikiPageId: before.activeWikiPageId,
      graphFocusPageId: before.graphFocusPageId,
      graphFocusNodeIds: before.graphFocusNodeIds,
      graphExplorerMode: before.graphExplorerMode,
    });
  });

  it("refreshes surviving graph focus and clears it when Wiki metadata removes the page", () => {
    const index = preciseWikiIndex();
    useDashboardStore.getState().setWikiIndex(index);
    useDashboardStore.getState().openGraphForWikiPage("page:run");
    useDashboardStore.getState().selectWikiPage(null);

    useDashboardStore.getState().setWikiIndex(index);
    expect(useDashboardStore.getState()).toMatchObject({
      dashboardSurface: "graph",
      activeWikiPageId: null,
      graphFocusPageId: "page:run",
      graphFocusNodeIds: ["function:src/a.ts:run"],
    });

    useDashboardStore.getState().setWikiIndex(emptyWikiRuntimeIndex());
    expect(useDashboardStore.getState()).toMatchObject({
      dashboardSurface: "graph",
      activeWikiPageId: null,
      graphFocusPageId: null,
      graphFocusNodeIds: [],
    });
  });

  it("opens valid Wiki targets, clears stale anchors, and ignores unknown pages", () => {
    useDashboardStore.getState().setWikiIndex(preciseWikiIndex());
    useDashboardStore.getState().openWikiTarget({ pageId: "page:file-a", anchor: "run" });
    expect(useDashboardStore.getState()).toMatchObject({
      activeWikiPageId: "page:file-a",
      pendingWikiAnchor: "run",
    });

    useDashboardStore.getState().openWikiTarget({ pageId: "page:run" });
    expect(useDashboardStore.getState()).toMatchObject({
      activeWikiPageId: "page:run",
      pendingWikiAnchor: null,
    });

    useDashboardStore.getState().openWikiTarget({ pageId: "page:missing", anchor: "ghost" });
    expect(useDashboardStore.getState()).toMatchObject({
      activeWikiPageId: "page:run",
      pendingWikiAnchor: null,
    });
  });

  it("consumes only the exact pending Wiki anchor", () => {
    useDashboardStore.getState().setWikiIndex(preciseWikiIndex());
    useDashboardStore.getState().openWikiTarget({ pageId: "page:file-a", anchor: "run" });
    useDashboardStore.getState().consumePendingWikiAnchor("other");
    expect(useDashboardStore.getState().pendingWikiAnchor).toBe("run");

    useDashboardStore.getState().consumePendingWikiAnchor("run");
    expect(useDashboardStore.getState().pendingWikiAnchor).toBeNull();
  });

  it("replaces only the graph payload when new graph data arrives", () => {
    useDashboardStore.getState().selectNode("function:src/a.ts:run");
    useDashboardStore.setState({ graphWikiNotice: "暂无专门正文" });

    useDashboardStore.getState().setConsoleGraph(graphFixture());

    expect(useDashboardStore.getState()).toMatchObject({
      selectedNodeId: "function:src/a.ts:run",
      graphWikiNotice: "暂无专门正文",
    });
  });

});

describe("active dashboard store source", () => {
  it("does not retain state for removed controls", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../store.ts"),
      "utf8",
    );
    for (const removed of [
      "viewGraph", "nodesById", "searchQuery", "searchResults", "searchEngine", "searchMode",
      "navigationLevel", "activeLayerId", "activeFileId", "focusNodeId", "nodeHistory",
      "persona", "diffMode", "filterPanelOpen", "exportMenuOpen", "pathFinderOpen",
      "reactFlowInstance", "viewMode", "domainGraph", "tourActive", "codeViewerOpen",
      "detailLevel", "nodeTypeFilters", "expandedContainers", "containerLayoutCache",
      "layoutIssues", "appendLayoutIssues", "clearLayoutIssues",
    ]) {
      expect(source).not.toMatch(new RegExp(`\\b${removed}\\b`));
    }
    expect(source).toContain("setConsoleGraph");

    const appSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../App.tsx"),
      "utf8",
    );
    for (const removed of ["layoutIssues", "appendLayoutIssues", "clearLayoutIssues"]) {
      expect(appSource).not.toMatch(new RegExp(`\\b${removed}\\b`));
    }
  });
});
