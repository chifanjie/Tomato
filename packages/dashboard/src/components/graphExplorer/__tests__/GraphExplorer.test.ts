// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement, StrictMode, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  graphFixture,
  graphWithDenseSelection,
  wikiRuntimeFixture,
  workspaceHierarchyFixture,
} from "../../../graphExplorer/__tests__/graphFixtures";
import { buildGraphHierarchyIndex } from "../../../graphExplorer/hierarchicalGraph";
import type { GraphNavigationIntent } from "../../../graphExplorer/graphQuickJump";
import { useDashboardStore } from "../../../store";
import { quantizeGraphViewport } from "../../../utils/layoutAlgorithm.js";
import { emptyWikiRuntimeIndex } from "../../../wiki/wikiIndex";
import {
  buildCanvasViewKey,
  consumeGraphFocusRevision,
  isGraphNavigationIntentValid,
  nearestValidNavigation,
  nextPendingNavigationRequest,
  resolveWikiFocusIntent,
  resolveWikiFocusIntentFromIndex,
  selectionIsNaturalInBase,
  shouldClearVisibleSelectionProvenance,
  default as GraphExplorer,
} from "../GraphExplorer";

const graphExplorerHarness = vi.hoisted(() => ({
  semanticGraphs: [] as unknown[],
  canvasProps: [] as Array<Record<string, unknown>>,
  omitMaterializedNode: false,
}));

vi.mock("../GraphQuickJump", async () => {
  const React = await import("react");
  return {
    GraphQuickJump: ({ items, onSelect }: {
      items: Array<{ id: string; intent: GraphNavigationIntent }>;
      onSelect: (intent: GraphNavigationIntent) => void;
    }) => {
      const [open, setOpen] = React.useState(false);
      return React.createElement(
        "div",
        { "data-testid": "quick-jump", className: "uc-graph-quick-jump" },
        React.createElement("button", {
          type: "button",
          "data-quick-open": "true",
          onClick: () => setOpen(true),
        }, "快速定位"),
        ...(open ? [React.createElement("input", {
          key: "quick-input",
          "aria-label": "搜索图谱对象",
          onKeyDown: (event: ReactKeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          },
        })] : []),
        ...items.map((item) => React.createElement("button", {
          key: item.id,
          type: "button",
          "data-jump-id": item.id,
          onClick: () => onSelect(item.intent),
        }, item.id)),
      );
    },
  };
});

vi.mock("../SemanticGraphCanvas", async () => {
  const React = await import("react");
  return {
    default: (props: {
      baseGraph: { presentation: { level: string }; nodes: Array<{ id: string }> };
      semanticGraph: { presentation: { level: string }; nodes: Array<{ id: string }> };
      graphRevision: string;
      navigation: Record<string, unknown>;
      explicitFocusRequest: { requestId: number; materializedNodeId: string } | null;
      onBaseLayoutReady: (ready: { requestId: number; structureKey: string; materializedNodeId: string }) => void;
      onSelectNode?: (id: string | null) => void;
      onClearSelection?: () => void;
      onFrameWidthChange?: (width: number) => void;
      onSelectedScreenBoundsChange?: (bounds: {
        left: number;
        right: number;
        top: number;
        bottom: number;
      } | null) => void;
    }) => {
      const {
        baseGraph,
        semanticGraph,
        graphRevision,
        navigation,
        explicitFocusRequest,
        onSelectNode,
        onClearSelection,
      } = props;
      graphExplorerHarness.canvasProps.push(props);
      graphExplorerHarness.semanticGraphs.push(semanticGraph);
      return React.createElement(
        "div",
        {
          "data-testid": "semantic-canvas",
          "data-level": semanticGraph.presentation.level,
          "data-view-key": JSON.stringify([
            graphRevision,
            navigation,
            baseGraph.nodes.map((node) => node.id).sort(),
            explicitFocusRequest?.materializedNodeId ?? "",
          ]),
          "data-canvas-width": "960",
          "data-canvas-height": "650",
          className: "uc-semantic-canvas",
          style: { width: "100%", height: "100%" },
        },
        ...semanticGraph.nodes.map((node) => React.createElement("button", {
          key: node.id,
          type: "button",
          "data-canvas-node": node.id,
          "data-graph-node-id": node.id,
          onClick: () => onSelectNode?.(node.id),
        }, node.id)),
        React.createElement("button", {
          type: "button",
          "data-pane-clear": "true",
          onClick: () => onClearSelection?.(),
        }, "clear"),
      );
    },
  };
});

vi.mock("../graphExplorerModel", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../graphExplorerModel")>();
  return {
    ...actual,
    buildGraphExplorerView: (input: Parameters<typeof actual.buildGraphExplorerView>[0]) => {
      const view = actual.buildGraphExplorerView(input);
      if (!graphExplorerHarness.omitMaterializedNode || !input.materializedNodeId) return view;
      const semanticGraph = {
        ...view.semanticGraph,
        nodes: view.semanticGraph.nodes.filter((node) => node.id !== input.materializedNodeId),
        edges: view.semanticGraph.edges.filter((edge) =>
          edge.source !== input.materializedNodeId && edge.target !== input.materializedNodeId),
      };
      return {
        ...view,
        semanticGraph,
        selection: null,
      };
    },
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("GraphExplorer progressive navigation helpers", () => {
  it("validates the full scope, cluster, and file ancestor chain", () => {
    const graph = workspaceHierarchyFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const location = hierarchyIndex.fileLocationById.get("file:packages/api/src/index.ts")!;

    expect(nearestValidNavigation(hierarchyIndex, {
      level: "file",
      scopeId: location.scopeId,
      clusterId: location.clusterId,
      fileId: location.fileId,
    })).toEqual({
      level: "file",
      scopeId: location.scopeId,
      clusterId: location.clusterId,
      fileId: location.fileId,
    });
    expect(nearestValidNavigation(hierarchyIndex, {
      level: "file",
      scopeId: location.scopeId,
      clusterId: "cluster:wrong",
      fileId: location.fileId,
    })).toEqual({ level: "scope", scopeId: location.scopeId });
  });

  it("falls back file to cluster when a sibling preserves the exact cluster", () => {
    const graph = workspaceHierarchyFixture();
    const before = buildGraphHierarchyIndex(graph);
    const location = before.fileLocationById.get("file:packages/api/src/index.ts")!;
    const refreshed = {
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== location.fileId),
      edges: graph.edges.filter((edge) => edge.source !== location.fileId && edge.target !== location.fileId),
      layers: graph.layers.map((layer) => ({
        ...layer,
        nodeIds: layer.nodeIds.filter((id) => id !== location.fileId),
      })),
    };

    expect(nearestValidNavigation(buildGraphHierarchyIndex(refreshed), {
      level: "file",
      scopeId: location.scopeId,
      clusterId: location.clusterId,
      fileId: location.fileId,
    })).toEqual({
      level: "cluster",
      scopeId: location.scopeId,
      clusterId: location.clusterId,
    });
  });

  it("does not trust stale hierarchy maps without master-list and membership truth", () => {
    const graph = workspaceHierarchyFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const location = hierarchyIndex.fileLocationById.get("file:packages/api/src/index.ts")!;
    const navigation = { level: "file" as const, ...location };
    const staleScopeIndex = { ...hierarchyIndex, scopes: [] };
    expect(nearestValidNavigation(staleScopeIndex, navigation)).toEqual({ level: "overview" });

    const cluster = hierarchyIndex.clusterById.get(location.clusterId)!;
    const staleClusterIndex = {
      ...hierarchyIndex,
      clusterById: new Map(hierarchyIndex.clusterById).set(cluster.id, {
        ...cluster,
        nodeIds: cluster.nodeIds.filter((id) => id !== location.fileId),
      }),
    };
    expect(nearestValidNavigation(staleClusterIndex, navigation)).toEqual({
      level: "cluster",
      scopeId: location.scopeId,
      clusterId: location.clusterId,
    });

    const removedClusterIndex = {
      ...hierarchyIndex,
      clusterById: new Map([...hierarchyIndex.clusterById]
        .filter(([clusterId]) => clusterId !== location.clusterId)),
    };
    expect(nearestValidNavigation(removedClusterIndex, navigation)).toEqual({
      level: "scope",
      scopeId: location.scopeId,
    });
  });

  it("retains a selection only when the unmaterialized destination base contains it", () => {
    const graph = graphFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const location = hierarchyIndex.fileLocationById.get("file:src/a.ts")!;
    const common = {
      graph,
      hierarchyIndex,
      wikiIndex: wikiRuntimeFixture(),
      mode: "architecture" as const,
      selectedNodeId: "function:src/a.ts:run",
    };

    expect(selectionIsNaturalInBase({ ...common, navigation: { level: "overview" } })).toBe(false);
    expect(selectionIsNaturalInBase({
      ...common,
      navigation: { level: "file", ...location },
    })).toBe(true);
  });

  it("rejects a pending intent whose exact materialized target or ancestor chain is stale", () => {
    const graph = graphFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const location = hierarchyIndex.fileLocationById.get("file:src/a.ts")!;
    const valid: GraphNavigationIntent = {
      source: "quick-jump",
      navigation: {
        level: "file",
        scopeId: location.scopeId,
        clusterId: location.clusterId,
        fileId: location.fileId,
      },
      materializedNodeId: "function:src/a.ts:run",
      selectionId: "function:src/a.ts:run",
    };

    expect(isGraphNavigationIntentValid({ graph, hierarchyIndex, intent: valid })).toBe(true);
    expect(isGraphNavigationIntentValid({
      graph,
      hierarchyIndex,
      intent: { ...valid, navigation: { ...valid.navigation, clusterId: "cluster:wrong" } },
    })).toBe(false);
    expect(isGraphNavigationIntentValid({
      graph,
      hierarchyIndex,
      intent: { ...valid, materializedNodeId: "function:missing", selectionId: "function:missing" },
    })).toBe(false);
  });

  it("allocates monotonic requests only when an intent is applied", () => {
    const graph = graphFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const location = hierarchyIndex.fileLocationById.get("file:src/a.ts")!;
    const intent: GraphNavigationIntent = {
      source: "quick-jump",
      navigation: { level: "cluster", scopeId: location.scopeId, clusterId: location.clusterId },
      materializedNodeId: location.fileId,
      selectionId: location.fileId,
    };

    expect(nextPendingNavigationRequest(0, intent)).toEqual({ requestId: 1, intent });
    expect(nextPendingNavigationRequest(1, intent)).toEqual({ requestId: 2, intent });
  });

  it("consumes a Wiki focus revision before writes and never reapplies the same revision", () => {
    expect(consumeGraphFocusRevision(0, 1, "page:run")).toEqual({
      nextConsumedRevision: 1,
      shouldApply: true,
    });
    expect(consumeGraphFocusRevision(1, 1, "page:run")).toEqual({
      nextConsumedRevision: 1,
      shouldApply: false,
    });
    expect(consumeGraphFocusRevision(1, 2, null)).toEqual({
      nextConsumedRevision: 2,
      shouldApply: false,
    });
  });

  it("resolves the first valid Wiki id and returns one exact missing-target fallback", () => {
    const graph = graphFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    expect(resolveWikiFocusIntent({
      graph,
      hierarchyIndex,
      nodeIds: ["function:missing", "function:src/a.ts:run"],
    })).toMatchObject({
      intent: { source: "wiki-focus", selectionId: "function:src/a.ts:run" },
      notice: null,
    });
    expect(resolveWikiFocusIntent({ graph, hierarchyIndex, nodeIds: ["function:missing"] })).toEqual({
      intent: null,
      notice: "未找到可定位的图谱对象，已保留最近层级。",
    });
  });

  it("resolves Wiki focus from the memoized Quick Jump intent index without rescanning", () => {
    const indexed = new Map<string, GraphNavigationIntent>([["valid", {
      source: "quick-jump",
      navigation: { level: "overview" },
      materializedNodeId: "valid",
      selectionId: "valid",
    }]]);
    expect(resolveWikiFocusIntentFromIndex(["missing", "valid"], indexed)).toEqual({
      intent: {
        source: "wiki-focus",
        navigation: { level: "overview" },
        materializedNodeId: "valid",
        selectionId: "valid",
      },
      notice: null,
    });
  });

  it("keys base layout by cluster and materialization but not selection or request", () => {
    const graph = graphFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const location = hierarchyIndex.fileLocationById.get("file:src/a.ts")!;
    const key = buildCanvasViewKey({
      graphInstanceToken: "graph-1",
      layoutRevision: "layout-1",
      mode: "architecture",
      navigation: { level: "cluster", scopeId: location.scopeId, clusterId: location.clusterId },
      materializedNodeId: location.fileId,
    });

    expect(key).toContain(location.clusterId);
    expect(key).toContain(location.fileId);
    expect(key).not.toContain("selected");
    expect(key).not.toContain("request");
  });

  it("keeps post-clear visible provenance and clears only a genuinely stale context", () => {
    expect(shouldClearVisibleSelectionProvenance(null, "next")).toBe(false);
    expect(shouldClearVisibleSelectionProvenance("next", "next")).toBe(false);
    expect(shouldClearVisibleSelectionProvenance("previous", "next")).toBe(true);
  });

  it("uses the permanent base/render graph Canvas API inside one owned overlay frame", () => {
    const source = readFileSync(resolve(
      process.cwd(),
      "src/components/graphExplorer/GraphExplorer.tsx",
    ), "utf8");
    const modelSource = readFileSync(resolve(
      process.cwd(),
      "src/components/graphExplorer/graphExplorerModel.ts",
    ), "utf8");

    expect(source).toContain("buildGraphHierarchyIndex(graph)");
    expect(source).toContain("GraphQuickJump");
    expect(source).toContain("pendingNavigationRequest");
    expect(source).toContain("materializedNodeId");
    expect(source).toContain("graphFocusRevision");
    expect(source).toContain("baseGraph={view.baseGraph}");
    expect(source).toContain("semanticGraph={view.semanticGraph}");
    expect(source).toContain("frameRef={frameRef}");
    expect(source).toContain("graphRevision={layoutRevision}");
    expect(source).toContain("navigation={safeNavigation}");
    expect(source).toContain("explicitFocusRequest=");
    expect(source).toContain("onBaseLayoutReady={handleBaseLayoutReady}");
    expect(source).toContain("onClearSelection={clearSelection}");
    expect(source).toContain("onSelectedScreenBoundsChange={setSelectedScreenBounds}");
    expect(source.match(/className="uc-graph-frame/g)).toHaveLength(1);
    expect(modelSource).not.toContain("focusNodeIds?:");
    expect(modelSource).not.toContain("hierarchyIndex?:");
    expect(modelSource).not.toContain("materializedNodeId?:");
    const componentSource = source.slice(source.indexOf("export default function GraphExplorer"));
    expect(componentSource).toContain("navigationIntentById");
    expect(componentSource).not.toContain("resolveGraphNavigationIntent({");
  });

  it("keeps the graph frame as the flex remainder without responsive aspect-ratio fallbacks", () => {
    const source = readFileSync(resolve(
      process.cwd(),
      "src/components/graphExplorer/GraphExplorer.tsx",
    ), "utf8");
    const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
    const componentSource = source.slice(source.indexOf("export default function GraphExplorer"));
    expect(componentSource).toContain("uc-graph-explorer");
    expect(componentSource).toContain("uc-graph-toolbar");
    expect(css).toMatch(/\.uc-graph-explorer\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*min-height:\s*0;[^}]*height:\s*100%;/s);
    expect(css).toMatch(/\.uc-graph-toolbar\s*\{[^}]*flex:\s*0 0 auto;/s);
    expect(css).toMatch(/\.uc-graph-frame\s*\{[^}]*position:\s*relative;[^}]*flex:\s*1;[^}]*min-height:\s*0;/s);
    expect(css).not.toMatch(/\.uc-graph-frame\s*\{[^}]*aspect-ratio:/s);
    expect(`${componentSource}\n${css}`).not.toMatch(/min-h-\[(?:420|480|540)px\]/);
  });
});

describe("GraphExplorer progressive navigation integration", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(16);
      return 1;
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    container = document.createElement("div");
    document.body.replaceChildren(container);
    root = createRoot(container);
    graphExplorerHarness.semanticGraphs.length = 0;
    graphExplorerHarness.canvasProps.length = 0;
    graphExplorerHarness.omitMaterializedNode = false;
    useDashboardStore.setState({
      graphFocusRevision: 0,
      graphFocusNodeIds: [],
      graphFocusPageId: null,
      selectedNodeId: null,
      graphExplorerMode: "architecture",
    });
    const state = useDashboardStore.getState();
    state.setConsoleGraph(graphFixture());
    state.setWikiIndex(wikiRuntimeFixture());
    state.setDashboardSurface("graph");
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    graphExplorerHarness.omitMaterializedNode = false;
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  async function renderExplorer(strict = false): Promise<void> {
    await act(async () => {
      const explorer = createElement(GraphExplorer, {
        onSelectWikiTarget: vi.fn(),
        onRequestGlobalSearch: vi.fn(),
      });
      root.render(strict ? createElement(StrictMode, null, explorer) : explorer);
      await Promise.resolve();
    });
  }

  function latestCanvasProps(): {
    baseGraph: { nodes: Array<{ id: string }> };
    semanticGraph: { nodes: Array<{ id: string }> };
    explicitFocusRequest: { requestId: number; materializedNodeId: string } | null;
    onBaseLayoutReady: (ready: { requestId: number; structureKey: string; materializedNodeId: string }) => void;
    onFrameWidthChange?: (width: number) => void;
    onSelectedScreenBoundsChange?: (bounds: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    } | null) => void;
    showMinimap?: boolean;
  } {
    const props = graphExplorerHarness.canvasProps.at(-1);
    if (!props) throw new Error("缺少 Canvas props");
    return props as ReturnType<typeof latestCanvasProps>;
  }

  it("applies file and symbol Quick Jump intents without selecting before layout readiness", async () => {
    await renderExplorer();
    const fileJump = container.querySelector<HTMLButtonElement>('[data-jump-id="file:src/a.ts"]');
    if (!fileJump) throw new Error("缺少文件快速定位项");
    await act(async () => fileJump.click());

    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("cluster");
    expect(container.querySelector('[data-canvas-node="file:src/a.ts"]')).not.toBeNull();
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();

    const symbolJump = container.querySelector<HTMLButtonElement>(
      '[data-jump-id="function:src/a.ts:run"]',
    );
    if (!symbolJump) throw new Error("缺少符号快速定位项");
    await act(async () => symbolJump.click());
    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("file");
    expect(container.querySelector('[data-canvas-node="function:src/a.ts:run"]')).not.toBeNull();
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();

    const semanticGraphBeforeUnrelatedRerender = graphExplorerHarness.semanticGraphs.at(-1);
    await renderExplorer();
    expect(graphExplorerHarness.semanticGraphs.at(-1)).toBe(semanticGraphBeforeUnrelatedRerender);

    const visibleSymbol = container.querySelector<HTMLButtonElement>(
      '[data-canvas-node="function:src/a.ts:run"]',
    );
    await act(async () => visibleSymbol?.click());
    expect(useDashboardStore.getState().selectedNodeId).toBe("function:src/a.ts:run");
    const materializedKey = container.querySelector('[data-testid="semantic-canvas"]')
      ?.getAttribute("data-view-key") ?? "";
    expect(materializedKey).toContain("function:src/a.ts:run");

    const paneClear = container.querySelector<HTMLButtonElement>('[data-pane-clear="true"]');
    await act(async () => paneClear?.click());
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();
    await act(async () => useDashboardStore.getState().setWikiIndex(wikiRuntimeFixture()));
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();
    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-view-key"))
      .toBe(materializedKey);

    const breadcrumbButtons = container.querySelectorAll<HTMLButtonElement>('nav[aria-label="图谱层级"] button');
    for (const breadcrumb of breadcrumbButtons) {
      expect(breadcrumb.className).toContain("min-h-11");
      expect(breadcrumb.className).toContain("min-w-11");
    }
    await act(async () => breadcrumbButtons.item(breadcrumbButtons.length - 1).click());
    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("cluster");
    const clearedKey = container.querySelector('[data-testid="semantic-canvas"]')
      ?.getAttribute("data-view-key") ?? "[]";
    expect(JSON.parse(clearedKey).at(-1)).toBe("");
  });

  it("commits only the latest matching layout-ready request exactly once", async () => {
    const selectedTransitions: Array<string | null> = [];
    const unsubscribe = useDashboardStore.subscribe((state, previous) => {
      if (state.selectedNodeId !== previous.selectedNodeId) selectedTransitions.push(state.selectedNodeId);
    });
    await renderExplorer(true);

    const fileJump = container.querySelector<HTMLButtonElement>('[data-jump-id="file:src/a.ts"]');
    await act(async () => fileJump?.click());
    const request1 = latestCanvasProps();
    expect(request1.explicitFocusRequest).toEqual({
      requestId: 1,
      materializedNodeId: "file:src/a.ts",
    });

    const symbolJump = container.querySelector<HTMLButtonElement>(
      '[data-jump-id="function:src/a.ts:run"]',
    );
    await act(async () => symbolJump?.click());
    const request2 = latestCanvasProps();
    expect(request2.explicitFocusRequest).toEqual({
      requestId: 2,
      materializedNodeId: "function:src/a.ts:run",
    });

    await act(async () => request1.onBaseLayoutReady({
      requestId: 1,
      structureKey: "stale-structure",
      materializedNodeId: "file:src/a.ts",
    }));
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();

    await act(async () => request2.onBaseLayoutReady({
      requestId: 2,
      structureKey: "current-structure",
      materializedNodeId: "file:src/a.ts",
    }));
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();
    expect(latestCanvasProps().explicitFocusRequest).toEqual({
      requestId: 2,
      materializedNodeId: "function:src/a.ts:run",
    });

    const ready2 = {
      requestId: 2,
      structureKey: "current-structure",
      materializedNodeId: "function:src/a.ts:run",
    };
    await act(async () => request2.onBaseLayoutReady(ready2));
    expect(useDashboardStore.getState().selectedNodeId).toBe("function:src/a.ts:run");
    expect(latestCanvasProps().explicitFocusRequest).toBeNull();

    await act(async () => request2.onBaseLayoutReady(ready2));
    expect(selectedTransitions).toEqual(["function:src/a.ts:run"]);
    unsubscribe();
  });

  it("clears one failed materialization request, preserves its ancestor, and never retries it", async () => {
    await renderExplorer(true);
    graphExplorerHarness.omitMaterializedNode = true;
    const fileJump = container.querySelector<HTMLButtonElement>('[data-jump-id="file:src/a.ts"]');
    await act(async () => {
      fileJump?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("cluster");
    expect(latestCanvasProps().explicitFocusRequest).toBeNull();
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();
    expect([...container.querySelectorAll('[role="status"]')]
      .filter((node) => node.textContent === "未找到可定位的图谱对象，已保留最近层级。"))
      .toHaveLength(1);

    const propsCount = graphExplorerHarness.canvasProps.length;
    await act(async () => useDashboardStore.getState().setWikiIndex(wikiRuntimeFixture()));
    expect(latestCanvasProps().explicitFocusRequest).toBeNull();
    expect(graphExplorerHarness.canvasProps.length).toBeGreaterThanOrEqual(propsCount);
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();
  });

  it("handles a pending target removed by graph refresh once and retains its nearest ancestor", async () => {
    const graph = workspaceHierarchyFixture();
    useDashboardStore.getState().setConsoleGraph(graph);
    await renderExplorer(true);
    const symbolId = "function:packages/api/src/routes/user.ts:loadUser";
    const symbolJump = container.querySelector<HTMLButtonElement>(`[data-jump-id="${symbolId}"]`);
    if (!symbolJump) throw new Error("缺少工作区符号快速定位项");
    await act(async () => symbolJump.click());
    const pendingProps = latestCanvasProps();
    expect(pendingProps.explicitFocusRequest).toEqual({
      requestId: 1,
      materializedNodeId: symbolId,
    });
    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("file");

    const refreshed = {
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== symbolId),
      edges: graph.edges.filter((edge) => edge.source !== symbolId && edge.target !== symbolId),
      layers: graph.layers.map((layer) => ({
        ...layer,
        nodeIds: layer.nodeIds.filter((id) => id !== symbolId),
      })),
    };
    await act(async () => useDashboardStore.getState().setConsoleGraph(refreshed));

    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("file");
    expect(latestCanvasProps().explicitFocusRequest).toBeNull();
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();
    expect([...container.querySelectorAll('[role="status"]')]
      .filter((node) => node.textContent === "未找到可定位的图谱对象，已保留最近层级。"))
      .toHaveLength(1);

    await act(async () => pendingProps.onBaseLayoutReady({
      requestId: 1,
      structureKey: "removed-target",
      materializedNodeId: symbolId,
    }));
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();

    const breadcrumbButtons = container.querySelectorAll<HTMLButtonElement>(
      'nav[aria-label="图谱层级"] button',
    );
    await act(async () => breadcrumbButtons.item(breadcrumbButtons.length - 1).click());
    expect(container.textContent).not.toContain("未找到可定位的图谱对象，已保留最近层级。");
    await act(async () => useDashboardStore.getState().setWikiIndex(wikiRuntimeFixture()));
    expect(container.textContent).not.toContain("未找到可定位的图谱对象，已保留最近层级。");
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();
  });

  it("owns exactly one graph frame around the fill-sized Canvas", async () => {
    await renderExplorer();
    expect(container.querySelectorAll(".uc-graph-frame")).toHaveLength(1);
    const frame = container.querySelector(".uc-graph-frame");
    expect(frame?.querySelector(":scope > .uc-semantic-canvas")).not.toBeNull();
  });

  it("dismisses and reopens the overlay inspector without disturbing selection or Canvas geometry", async () => {
    await renderExplorer();
    const node = container.querySelector<HTMLButtonElement>("[data-canvas-node]");
    if (!node?.dataset.canvasNode) throw new Error("缺少可选择图谱节点");
    const nodeId = node.dataset.canvasNode;
    const canvas = container.querySelector<HTMLElement>('[data-testid="semantic-canvas"]')!;
    const frame = container.querySelector<HTMLElement>(".uc-graph-frame")!;
    const viewKey = canvas.dataset.viewKey;
    const dimensions = [canvas.dataset.canvasWidth, canvas.dataset.canvasHeight];

    await act(async () => node.click());
    expect(useDashboardStore.getState().selectedNodeId).toBe(nodeId);
    expect(frame.querySelector(':scope > aside[aria-label="图谱详情"]')).not.toBeNull();

    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })));
    expect(frame.querySelector(':scope > aside[aria-label="图谱详情"]')).toBeNull();
    expect(useDashboardStore.getState().selectedNodeId).toBe(nodeId);
    expect(document.activeElement).toBe(node);
    expect(container.querySelector('[data-testid="semantic-canvas"]')).toBe(canvas);
    expect(canvas.dataset.viewKey).toBe(viewKey);
    expect([canvas.dataset.canvasWidth, canvas.dataset.canvasHeight]).toEqual(dimensions);

    await act(async () => node.click());
    expect(frame.querySelector(':scope > aside[aria-label="图谱详情"]')).not.toBeNull();

    await act(async () => container.querySelector<HTMLButtonElement>('[data-quick-open="true"]')?.click());
    const quickInput = container.querySelector<HTMLInputElement>('[aria-label="搜索图谱对象"]');
    if (!quickInput) throw new Error("快速定位未打开");
    await act(async () => quickInput.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })));
    expect(container.querySelector('[aria-label="搜索图谱对象"]')).toBeNull();
    expect(frame.querySelector(':scope > aside[aria-label="图谱详情"]')).not.toBeNull();

    const closeInspector = container.querySelector<HTMLButtonElement>('[aria-label="关闭图谱详情"]');
    if (!closeInspector) throw new Error("图谱详情缺少关闭按钮");
    closeInspector.focus();
    expect(document.activeElement).toBe(closeInspector);
    await act(async () => closeInspector.click());
    expect(frame.querySelector(':scope > aside[aria-label="图谱详情"]')).toBeNull();
    expect(useDashboardStore.getState().selectedNodeId).toBe(nodeId);
    expect(document.activeElement).toBe(node);
    expect(canvas.dataset.viewKey).toBe(viewKey);

    await act(async () => node.click());
    expect(frame.querySelector(':scope > aside[aria-label="图谱详情"]')).not.toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[data-pane-clear="true"]')?.click());
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();
    expect(frame.querySelector(':scope > aside[aria-label="图谱详情"]')).toBeNull();
    expect(canvas.dataset.viewKey).toBe(viewKey);
  });

  it("switches inspector side from raw same-bucket frame width without changing Canvas inputs", async () => {
    await renderExplorer();
    const node = container.querySelector<HTMLButtonElement>("[data-canvas-node]");
    if (!node) throw new Error("缺少可选择图谱节点");
    await act(async () => node.click());

    const initialProps = latestCanvasProps();
    expect(initialProps.onFrameWidthChange).toEqual(expect.any(Function));
    expect(initialProps.onSelectedScreenBoundsChange).toEqual(expect.any(Function));
    await act(async () => {
      initialProps.onSelectedScreenBoundsChange?.({ left: 510, right: 626, top: 80, bottom: 180 });
      initialProps.onFrameWidthChange?.(1_030);
    });
    const inspector = container.querySelector<HTMLElement>('aside[aria-label="图谱详情"]');
    expect(inspector?.dataset.side).toBe("right");

    const initialBaseGraph = initialProps.baseGraph;
    const initialSemanticGraph = initialProps.semanticGraph;
    expect(quantizeGraphViewport(1_030, 650)).toEqual(quantizeGraphViewport(990, 650));
    await act(async () => initialProps.onFrameWidthChange?.(990));

    expect(inspector?.dataset.side).toBe("left");
    const resizedProps = latestCanvasProps();
    expect(resizedProps.baseGraph).toBe(initialBaseGraph);
    expect(resizedProps.semanticGraph).toBe(initialSemanticGraph);
    expect(resizedProps.explicitFocusRequest).toBe(initialProps.explicitFocusRequest);
  });

  it("keeps the tablet tools disclosure and MiniMap toggle visible and operable", async () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === "(max-width: 1279px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList));
    await renderExplorer();

    const tools = container.querySelector<HTMLDetailsElement>(".uc-graph-tools");
    if (!tools) throw new Error("1024–1279px 未显示更多图谱工具");
    await act(async () => {
      tools.open = true;
      tools.dispatchEvent(new Event("toggle"));
    });
    const toggle = [...tools.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "显示缩略图");
    if (!toggle) throw new Error("更多图谱工具内缺少缩略图开关");
    expect(latestCanvasProps().showMinimap).toBe(false);

    await act(async () => toggle.click());
    expect(latestCanvasProps().showMinimap).toBe(true);
    expect(tools.textContent).toContain("隐藏缩略图");
  });

  it("keeps an expansion-only ordinary selection across the post-pending effect rerender", async () => {
    useDashboardStore.getState().setConsoleGraph(graphWithDenseSelection(110));
    useDashboardStore.getState().setGraphExplorerMode("call");
    await renderExplorer();
    const selectedId = "function:dense:selected";
    const jump = container.querySelector<HTMLButtonElement>(`[data-jump-id="${selectedId}"]`);
    if (!jump) throw new Error("缺少高密度选择定位项");
    await act(async () => jump.click());

    const selectedButton = container.querySelector<HTMLButtonElement>(`[data-canvas-node="${selectedId}"]`);
    if (!selectedButton) throw new Error("物化节点未进入画布");
    await act(async () => selectedButton.click());
    const expansionOnlyId = "function:dense:n-99";
    const expansionButton = container.querySelector<HTMLButtonElement>(
      `[data-canvas-node="${expansionOnlyId}"]`,
    );
    if (!expansionButton) throw new Error("选择扩展未显示高位邻居");
    await act(async () => expansionButton.click());
    expect(useDashboardStore.getState().selectedNodeId).toBe(expansionOnlyId);

    await act(async () => useDashboardStore.getState().setWikiIndex(wikiRuntimeFixture()));
    expect(useDashboardStore.getState().selectedNodeId).toBe(expansionOnlyId);
    expect(container.querySelector(`[data-canvas-node="${expansionOnlyId}"]`)).not.toBeNull();
  });

  it("clears materialization when an unavailable stored mode normalizes", async () => {
    useDashboardStore.getState().setGraphExplorerMode("coverage");
    await renderExplorer();
    const symbolJump = container.querySelector<HTMLButtonElement>(
      '[data-jump-id="function:src/a.ts:run"]',
    );
    await act(async () => symbolJump?.click());
    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-view-key"))
      .toContain("function:src/a.ts:run");

    await act(async () => useDashboardStore.getState().setWikiIndex(emptyWikiRuntimeIndex()));
    expect(useDashboardStore.getState().graphExplorerMode).toBe("architecture");
    const normalizedKey = container.querySelector('[data-testid="semantic-canvas"]')
      ?.getAttribute("data-view-key") ?? "[]";
    expect(JSON.parse(normalizedKey).at(-1)).toBe("");
  });

  it("consumes each Wiki focus revision once under StrictMode and keeps selection pending", async () => {
    await renderExplorer(true);
    await act(async () => useDashboardStore.getState().openGraphForWikiPage("page:run"));

    expect(useDashboardStore.getState().graphFocusRevision).toBe(1);
    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("cluster");
    expect(container.querySelector('[data-canvas-node="file:src/a.ts"]')).not.toBeNull();
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();

    await act(async () => useDashboardStore.getState().openGraphForWikiPage("page:run"));
    expect(useDashboardStore.getState().graphFocusRevision).toBe(2);
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();
  });

  it("lets a simultaneous architecture-mode Wiki focus win over the prior mode transition", async () => {
    const original = graphFixture();
    useDashboardStore.getState().setConsoleGraph({
      ...original,
      edges: [...original.edges, {
        source: "function:src/a.ts:run",
        target: "file:context-only.ts",
        type: "calls",
        direction: "forward",
        weight: 1,
      }],
    });
    useDashboardStore.getState().setGraphExplorerMode("call");
    await renderExplorer();
    await act(async () => container.querySelector<HTMLButtonElement>(
      '[data-jump-id="function:src/a.ts:run"]',
    )?.click());

    await act(async () => useDashboardStore.getState().openGraphForWikiPage("page:run"));
    expect(useDashboardStore.getState().graphExplorerMode).toBe("architecture");
    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("cluster");
    expect(container.querySelector('[data-canvas-node="file:src/a.ts"]')).not.toBeNull();
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();
  });

  it("keeps the exact missing-Wiki notice when mode normalization happens in the same update", async () => {
    const original = graphFixture();
    useDashboardStore.getState().setConsoleGraph({
      ...original,
      edges: [...original.edges, {
        source: "function:src/a.ts:run",
        target: "file:context-only.ts",
        type: "calls",
        direction: "forward",
        weight: 1,
      }],
    });
    useDashboardStore.getState().setGraphExplorerMode("call");
    await renderExplorer();
    await act(async () => container.querySelector<HTMLButtonElement>(
      '[data-jump-id="function:src/a.ts:run"]',
    )?.click());

    await act(async () => useDashboardStore.setState({
      graphExplorerMode: "architecture",
      graphFocusPageId: "page:run",
      graphFocusNodeIds: ["function:missing"],
      graphFocusRevision: 1,
    }));
    expect([...container.querySelectorAll('[role="status"]')]
      .filter((node) => node.textContent === "未找到可定位的图谱对象，已保留最近层级。"))
      .toHaveLength(1);
  });

  it("shows one exact missing-Wiki notice and does not ghost-select an object", async () => {
    useDashboardStore.setState({
      graphFocusPageId: "page:run",
      graphFocusNodeIds: ["function:missing"],
      graphFocusRevision: 1,
    });
    await renderExplorer(true);

    const notices = [...container.querySelectorAll('[role="status"]')]
      .filter((node) => node.textContent === "未找到可定位的图谱对象，已保留最近层级。");
    expect(notices).toHaveLength(1);
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();

    await act(async () => useDashboardStore.getState().clearGraphFocus());
    expect(container.textContent).not.toContain("未找到可定位的图谱对象，已保留最近层级。");
  });

  it("consumes a revision with no live Wiki page and never ghost-replays it later", async () => {
    useDashboardStore.setState({
      graphFocusPageId: null,
      graphFocusNodeIds: ["file:src/a.ts"],
      graphFocusRevision: 1,
    });
    await renderExplorer(true);
    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("overview");

    const fileJump = container.querySelector<HTMLButtonElement>('[data-jump-id="file:src/a.ts"]');
    await act(async () => fileJump?.click());
    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("cluster");
    await act(async () => useDashboardStore.setState({ graphFocusRevision: 2 }));
    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("cluster");

    await act(async () => useDashboardStore.setState({ graphFocusPageId: "page:run" }));
    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("cluster");

    await act(async () => useDashboardStore.getState().openGraphForWikiPage("page:run"));
    expect(useDashboardStore.getState().graphFocusRevision).toBe(3);
    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("cluster");
  });

  it("skips missing Wiki ids before the first valid object, then handles all-missing once", async () => {
    useDashboardStore.setState({
      graphFocusPageId: "page:run",
      graphFocusNodeIds: ["function:missing", "file:src/a.ts"],
      graphFocusRevision: 1,
    });
    await renderExplorer(true);
    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("cluster");
    expect(container.querySelector('[data-canvas-node="file:src/a.ts"]')).not.toBeNull();

    await act(async () => useDashboardStore.setState({
      graphFocusNodeIds: ["function:missing"],
      graphFocusRevision: 2,
    }));
    expect([...container.querySelectorAll('[role="status"]')]
      .filter((node) => node.textContent === "未找到可定位的图谱对象，已保留最近层级。"))
      .toHaveLength(1);
  });

  it("falls back from file to its surviving cluster immediately after graph refresh", async () => {
    const graph = workspaceHierarchyFixture();
    useDashboardStore.getState().setConsoleGraph(graph);
    await renderExplorer();
    const symbolId = "function:packages/api/src/routes/user.ts:loadUser";
    const symbolJump = container.querySelector<HTMLButtonElement>(`[data-jump-id="${symbolId}"]`);
    if (!symbolJump) throw new Error("缺少工作区符号快速定位项");
    await act(async () => symbolJump.click());
    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("file");

    const removedIds = new Set([
      "file:packages/api/src/routes/user.ts",
      symbolId,
      "function:contained-without-path",
    ]);
    const refreshed = {
      ...graph,
      nodes: graph.nodes.filter((node) => !removedIds.has(node.id)),
      edges: graph.edges.filter((edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target)),
      layers: graph.layers.map((layer) => ({
        ...layer,
        nodeIds: layer.nodeIds.filter((id) => !removedIds.has(id)),
      })),
    };
    await act(async () => useDashboardStore.getState().setConsoleGraph(refreshed));

    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("cluster");
    expect(container.querySelector(`[data-canvas-node="${symbolId}"]`)).toBeNull();

    const refreshedIndex = buildGraphHierarchyIndex(refreshed);
    const clusterId = refreshedIndex.fileLocationById
      .get("file:packages/api/src/index.ts")!.clusterId;
    const withoutCluster = {
      ...refreshed,
      nodes: refreshed.nodes.filter((node) =>
        refreshedIndex.nodeLocationById.get(node.id)?.clusterId !== clusterId),
      edges: refreshed.edges.filter((edge) =>
        refreshedIndex.nodeLocationById.get(edge.source)?.clusterId !== clusterId
          && refreshedIndex.nodeLocationById.get(edge.target)?.clusterId !== clusterId),
      layers: refreshed.layers.map((layer) => ({
        ...layer,
        nodeIds: layer.nodeIds.filter((id) =>
          refreshedIndex.nodeLocationById.get(id)?.clusterId !== clusterId),
      })),
    };
    await act(async () => useDashboardStore.getState().setConsoleGraph(withoutCluster));
    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("scope");

    await act(async () => useDashboardStore.getState().setConsoleGraph({
      ...withoutCluster,
      layers: [],
    }));
    expect(container.querySelector('[data-testid="semantic-canvas"]')?.getAttribute("data-level"))
      .toBe("overview");
  });

  it("invalidates visible-selection provenance on the first equal-structure clone render", async () => {
    const graph = workspaceHierarchyFixture();
    useDashboardStore.getState().setConsoleGraph(graph);
    await renderExplorer();
    const gateway = container.querySelector<HTMLButtonElement>('[data-canvas-node="service:gateway"]');
    if (!gateway) throw new Error("缺少架构入口节点");
    await act(async () => gateway.click());
    const expandedFileId = "file:packages/api/src/index.ts";
    const expandedFile = container.querySelector<HTMLButtonElement>(
      `[data-canvas-node="${expandedFileId}"]`,
    );
    if (!expandedFile) throw new Error("架构入口未展开精确一跳文件");
    await act(async () => expandedFile.click());
    expect(container.querySelector(`[data-canvas-node="${expandedFileId}"]`)).not.toBeNull();

    const clone = {
      ...graph,
      project: { ...graph.project },
      nodes: graph.nodes.map((node) => ({ ...node })),
      edges: graph.edges.map((edge) => ({ ...edge })),
      layers: graph.layers.map((layer) => ({ ...layer, nodeIds: [...layer.nodeIds] })),
    };
    await act(async () => useDashboardStore.getState().setConsoleGraph(clone));
    expect(container.querySelector(`[data-canvas-node="${expandedFileId}"]`)).toBeNull();
  });

  it("clears a still-existing selection when graph refresh changes its exact ancestor chain", async () => {
    const graph = graphFixture();
    await renderExplorer();
    const symbolId = "function:src/a.ts:run";
    const jump = container.querySelector<HTMLButtonElement>(`[data-jump-id="${symbolId}"]`);
    await act(async () => jump?.click());
    const symbol = container.querySelector<HTMLButtonElement>(`[data-canvas-node="${symbolId}"]`);
    await act(async () => symbol?.click());
    expect(useDashboardStore.getState().selectedNodeId).toBe(symbolId);

    const moved = {
      ...graph,
      nodes: graph.nodes.map((node) => node.filePath === "src/a.ts"
        ? { ...node, filePath: "moved/a.ts" }
        : node),
    };
    await act(async () => useDashboardStore.getState().setConsoleGraph(moved));
    expect(useDashboardStore.getState().selectedNodeId).toBeNull();
  });
});
