// @vitest-environment happy-dom

import { act, createElement, Fragment, StrictMode, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GraphExplorerNavigation,
  HierarchicalSemanticGraph,
} from "../../../graphExplorer/hierarchicalGraph";
import type { SemanticLayoutResult } from "../../../graphExplorer/layoutClient.js";
import { useDashboardStore } from "../../../store";
import type { LayoutMessage } from "../../../utils/layoutAlgorithm.js";

const testHarness = vi.hoisted(() => ({
  flowProps: [] as Array<Record<string, unknown>>,
  flowInstanceSequence: 0,
  activeFlowInstanceId: null as number | null,
  deferNextFlowInit: false,
  pendingFlowInits: [] as Array<() => void>,
  flowInstanceViewportWrites: [] as Array<{
    instanceId: number;
    active: boolean;
    viewport: { x: number; y: number; zoom: number };
  }>,
  requestLayout: vi.fn(),
  setViewport: vi.fn(async (_viewport: { x: number; y: number; zoom: number }) => true),
  getViewport: vi.fn(() => ({ x: 12, y: 18, zoom: 0.8 })),
  flowToScreenPosition: vi.fn((position: { x: number; y: number }) => ({
    x: position.x + 100,
    y: position.y + 200,
  })),
}));

vi.mock("../../../graphExplorer/layoutClient.js", () => ({
  requestSemanticLayout: testHarness.requestLayout,
}));

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  const React = await import("react");
  return {
    ...actual,
    Background: () => null,
    BackgroundVariant: { Dots: "dots" },
    ControlButton: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement("button", props, children as React.ReactNode),
    Controls: ({ children, position }: { children?: React.ReactNode; position?: string }) =>
      React.createElement("div", {
        "data-testid": "controls",
        "data-position": position,
      }, children),
    Handle: () => null,
    MiniMap: () => null,
    Position: { Bottom: "bottom", Left: "left", Right: "right", Top: "top" },
    ReactFlow: (props: Record<string, unknown>) => {
      const [instanceId] = React.useState(() => ++testHarness.flowInstanceSequence);
      useEffect(() => {
        const onInit = props.onInit as ((instance: unknown) => void) | undefined;
        testHarness.activeFlowInstanceId = instanceId;
        const initialize = () => {
          onInit?.({
            setViewport: (viewport: { x: number; y: number; zoom: number }) => {
              testHarness.flowInstanceViewportWrites.push({
                instanceId,
                active: testHarness.activeFlowInstanceId === instanceId,
                viewport,
              });
              return testHarness.setViewport(viewport);
            },
            getViewport: testHarness.getViewport,
            flowToScreenPosition: testHarness.flowToScreenPosition,
          });
        };
        if (testHarness.deferNextFlowInit) {
          testHarness.deferNextFlowInit = false;
          testHarness.pendingFlowInits.push(initialize);
        } else {
          initialize();
        }
        return () => {
          if (testHarness.activeFlowInstanceId === instanceId) {
            testHarness.activeFlowInstanceId = null;
          }
        };
      }, [instanceId, props.onInit]);
      testHarness.flowProps.push(props);
      return React.createElement("div", { "data-testid": "react-flow" }, props.children as React.ReactNode);
    },
  };
});

import SemanticGraphCanvas from "../SemanticGraphCanvas";
import { resolveGraphInspectorSide } from "../GraphDetailsRail";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const EMPTY_DOCS = {
  relation: "none" as const,
  quality: "needs-review" as const,
  evidenceHealth: "missing" as const,
  generationStatus: "partial" as const,
  referenceCoverage: "unanchored" as const,
  directPageIds: [],
  contextPageIds: [],
  directPages: [],
  contextPages: [],
  evidenceIds: [],
  evidence: [],
};

function graphNode(id: string) {
  return {
    id,
    label: id,
    group: "file" as const,
    category: "file" as const,
    cluster: "src",
    importance: 1,
    rawType: "file" as const,
    summary: `${id} summary`,
    kind: "node" as const,
    scopeId: "scope:core",
    docs: EMPTY_DOCS,
  };
}

function graphEdge(source: string, target: string) {
  return {
    id: `${source}->${target}`,
    source,
    target,
    type: "imports" as const,
    direction: "forward" as const,
    edgeTypes: ["imports" as const],
    directions: ["forward" as const],
    weight: 1,
    bundledCount: 1,
    members: [{
      id: `member:${source}->${target}`,
      source,
      target,
      type: "imports" as const,
      direction: "forward" as const,
      weight: 1,
    }],
  };
}

function semanticGraph(
  level: "overview" | "scope" | "cluster" | "file",
  nodeIds: string[],
): HierarchicalSemanticGraph {
  return {
    nodes: nodeIds.map(graphNode),
    edges: nodeIds.slice(1).map((id, index) => graphEdge(nodeIds[index]!, id)),
    presentation: {
      displayMode: "architecture",
      level,
      relationshipSource: "imports",
      scopeId: level === "overview" ? null : "scope:core",
      clusterId: level === "cluster" || level === "file" ? "cluster:src" : null,
      fileId: level === "file" ? nodeIds[0] ?? null : null,
      scopeOptions: [],
      breadcrumbs: [],
      totalNodeCount: nodeIds.length,
      hiddenNodeCount: 0,
      focusApplied: false,
      notice: null,
    },
  };
}

function layoutResult(input: LayoutMessage, degraded = false): SemanticLayoutResult {
  const positions = Object.fromEntries(input.nodes.map((node, index) => [
    node.id,
    { x: 48 + index * 320, y: 48 + (index % 2) * 180 },
  ]));
  return {
    requestId: input.requestId,
    positions,
    bounds: { x: 0, y: 0, width: Math.max(480, input.nodes.length * 320 + 96), height: 420 },
    execution: degraded ? "grid" : "worker",
    degraded,
  };
}

class TestResizeObserver {
  static latest: TestResizeObserver | null = null;
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    TestResizeObserver.latest = this;
  }

  observe(): void {}
  disconnect(): void {}
  unobserve(): void {}

  emit(width: number, height: number): void {
    this.callback([{
      contentRect: { width, height } as DOMRectReadOnly,
    } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

describe("SemanticGraphCanvas layout lifecycle", () => {
  let frame: HTMLDivElement;
  let root: Root;
  let rafSequence: number;
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let ready: ReturnType<typeof vi.fn>;
  let selectedBoundsChanged: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    frame = document.createElement("div");
    frame.className = "uc-graph-frame";
    document.body.replaceChildren(frame);
    root = createRoot(frame);
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue({
      left: 10,
      top: 20,
      right: 970,
      bottom: 670,
      width: 960,
      height: 650,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    });
    rafSequence = 0;
    rafCallbacks = new Map();
    ready = vi.fn();
    selectedBoundsChanged = vi.fn();
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      const id = ++rafSequence;
      rafCallbacks.set(id, callback);
      return id;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => {
      rafCallbacks.delete(id);
    }));
    testHarness.flowProps.length = 0;
    testHarness.flowInstanceSequence = 0;
    testHarness.activeFlowInstanceId = null;
    testHarness.deferNextFlowInit = false;
    testHarness.pendingFlowInits.length = 0;
    testHarness.flowInstanceViewportWrites.length = 0;
    testHarness.requestLayout.mockReset();
    testHarness.requestLayout.mockImplementation(async (input: LayoutMessage) => layoutResult(input));
    testHarness.setViewport.mockReset();
    testHarness.setViewport.mockResolvedValue(true);
    testHarness.getViewport.mockReset();
    testHarness.getViewport.mockReturnValue({ x: 12, y: 18, zoom: 0.8 });
    testHarness.flowToScreenPosition.mockClear();
    useDashboardStore.setState({ selectedNodeId: null });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    document.body.replaceChildren();
    TestResizeObserver.latest = null;
  });

  function navigation(level: HierarchicalSemanticGraph["presentation"]["level"]): GraphExplorerNavigation {
    if (level === "overview") return { level };
    if (level === "scope") return { level, scopeId: "scope:core" };
    if (level === "cluster") return { level, scopeId: "scope:core", clusterId: "cluster:src" };
    return {
      level,
      scopeId: "scope:core",
      clusterId: "cluster:src",
      fileId: "a",
    };
  }

  function canvas(input: {
    baseGraph?: HierarchicalSemanticGraph;
    semanticGraph?: HierarchicalSemanticGraph;
    explicitFocusRequest?: { requestId: number; materializedNodeId: string } | null;
    graphRevision?: string;
    inspectorOpen?: boolean;
    narrowViewport?: boolean;
    showMinimap?: boolean;
    fitViewportInsets?: { top?: number; right?: number; bottom?: number; left?: number };
    onSelectedScreenBoundsChange?: (bounds: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    } | null) => void;
  } = {}) {
    const baseGraph = input.baseGraph ?? semanticGraph("scope", ["a", "b"]);
    return createElement(Fragment, null,
      createElement(SemanticGraphCanvas, {
        frameRef: { current: frame },
        baseGraph,
        semanticGraph: input.semanticGraph ?? baseGraph,
        graphRevision: input.graphRevision ?? "revision:1",
        navigation: navigation(baseGraph.presentation.level),
        displayMode: "architecture",
        explicitFocusRequest: input.explicitFocusRequest ?? null,
        onBaseLayoutReady: ready,
        onSelectedScreenBoundsChange:
          input.onSelectedScreenBoundsChange ?? selectedBoundsChanged,
        emptyNotice: null,
        onOpenScope: vi.fn(),
        onOpenCluster: vi.fn(),
        onOpenFile: vi.fn(),
        narrowViewport: input.narrowViewport ?? false,
        ...(input.showMinimap === undefined ? {} : { showMinimap: input.showMinimap }),
        ...(input.fitViewportInsets ? { fitViewportInsets: input.fitViewportInsets } : {}),
      }),
      input.inspectorOpen
        ? createElement("aside", { "data-testid": "inspector-sibling" })
        : null,
    );
  }

  async function render(input: Parameters<typeof canvas>[0] = {}, strict = false): Promise<void> {
    await act(async () => {
      const element = canvas(input);
      root.render(strict ? createElement(StrictMode, null, element) : element);
      await Promise.resolve();
    });
  }

  async function emitResize(width: number, height: number): Promise<void> {
    await act(async () => {
      TestResizeObserver.latest?.emit(width, height);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  async function flushRaf(): Promise<void> {
    const callbacks = [...rafCallbacks.values()];
    rafCallbacks.clear();
    await act(async () => {
      callbacks.forEach((callback) => callback(performance.now()));
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  async function flushFlowInit(): Promise<void> {
    const pending = testHarness.pendingFlowInits.splice(0);
    await act(async () => {
      pending.forEach((initialize) => initialize());
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("ignores zero and same-bucket observations, adopts the first bucket immediately, and stabilizes later buckets over two RAFs", async () => {
    await render({}, true);
    await emitResize(0, 0);
    expect(testHarness.requestLayout).not.toHaveBeenCalled();

    await emitResize(960, 650);
    expect(testHarness.requestLayout).toHaveBeenCalledTimes(1);
    expect(testHarness.requestLayout.mock.calls[0]![0].viewport).toEqual({
      width: 960,
      height: 640,
      widthBucket: 6,
      heightBucket: 4,
      aspectBucket: "landscape",
    });

    await emitResize(1_000, 680);
    expect(testHarness.requestLayout).toHaveBeenCalledTimes(1);
    await emitResize(0, 0);
    expect(testHarness.requestLayout).toHaveBeenCalledTimes(1);
    expect(frame.querySelector('[data-testid="react-flow"]')).not.toBeNull();

    await emitResize(1_360, 780);
    expect(testHarness.requestLayout).toHaveBeenCalledTimes(1);
    await flushRaf();
    expect(testHarness.requestLayout).toHaveBeenCalledTimes(1);
    await flushRaf();
    expect(testHarness.requestLayout).toHaveBeenCalledTimes(2);
    expect(testHarness.requestLayout.mock.calls[1]![0].viewport.aspectBucket).toBe("landscape");
  });

  it("cancels a pending candidate when a newer measurement returns to the current bucket", async () => {
    await render();
    await emitResize(960, 650);
    await emitResize(1_360, 780);
    await emitResize(1_000, 680);
    await flushRaf();
    await flushRaf();
    expect(testHarness.requestLayout).toHaveBeenCalledTimes(1);
  });

  it("runs overview through the versioned layout worker and never nests the graph frame", async () => {
    const graph = semanticGraph("overview", ["a", "b", "c"]);
    await render({ baseGraph: graph, semanticGraph: graph });
    await emitResize(960, 650);

    expect(testHarness.requestLayout).toHaveBeenCalledTimes(1);
    const request = testHarness.requestLayout.mock.calls[0]![0] as LayoutMessage;
    expect(request).toMatchObject({ level: "overview" });
    expect(request.nodes.every((node) => node.importance === 1)).toBe(true);
    expect(request.edges.every((edge) => edge.role === "backbone")).toBe(true);
    expect(document.querySelectorAll(".uc-graph-frame")).toHaveLength(1);
    expect(frame.querySelector(":scope > .uc-semantic-canvas")).not.toBeNull();
    expect(frame.querySelector(".uc-semantic-canvas .uc-graph-frame")).toBeNull();
  });

  it("keeps base layout, positions, and viewport untouched across ordinary selection expansion", async () => {
    const base = semanticGraph("scope", ["a", "b"]);
    await render({ baseGraph: base });
    await emitResize(960, 650);
    const initialProps = testHarness.flowProps.at(-1)!;
    const initialNodes = initialProps.nodes as Array<{ id: string; position: { x: number; y: number } }>;
    expect(testHarness.setViewport).toHaveBeenCalledTimes(1);

    const expanded: HierarchicalSemanticGraph = {
      ...base,
      nodes: [...base.nodes, graphNode("selected")],
      edges: [...base.edges, graphEdge("b", "selected")],
    };
    await act(async () => useDashboardStore.getState().selectNode("selected"));
    await render({ baseGraph: base, semanticGraph: expanded });
    const expandedProps = testHarness.flowProps.at(-1)!;
    const expandedNodes = expandedProps.nodes as Array<{ id: string; position: { x: number; y: number } }>;

    expect(testHarness.requestLayout).toHaveBeenCalledTimes(1);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(1);
    expect(expandedProps.fitView).toBeUndefined();
    expect(expandedProps.fitViewOptions).toBeUndefined();
    expect(expandedNodes.find((node) => node.id === "a")?.position)
      .toEqual(initialNodes.find((node) => node.id === "a")?.position);
    expect(expandedNodes.find((node) => node.id === "b")?.position)
      .toEqual(initialNodes.find((node) => node.id === "b")?.position);
    expect(expandedNodes.find((node) => node.id === "selected")?.position).toBeDefined();
    expect(testHarness.getViewport()).toEqual({ x: 12, y: 18, zoom: 0.8 });
  });

  it("anchors narrow automatic framing to the base graph while manual fit includes temporary nodes", async () => {
    const base = semanticGraph("overview", Array.from({ length: 19 }, (_, index) => `base-${index}`));
    const expanded: HierarchicalSemanticGraph = {
      ...base,
      nodes: [...base.nodes, graphNode("selection-expansion")],
      edges: [...base.edges, graphEdge("base-18", "selection-expansion")],
    };
    testHarness.requestLayout.mockImplementation(async (input: LayoutMessage) => ({
      ...layoutResult(input),
      positions: Object.fromEntries(input.nodes.map((node, index) => [
        node.id,
        index === 0
          ? { x: 48, y: 48 }
          : index < 10
            ? { x: 450 + index * 220, y: 48 }
            : { x: 48, y: 450 + (index - 9) * 170 },
      ])),
      bounds: { x: 0, y: 0, width: 2_700, height: 2_200 },
    }));

    await render({ baseGraph: base, semanticGraph: expanded, narrowViewport: true });
    await emitResize(390, 613);

    const automaticTarget = testHarness.setViewport.mock.calls[0]![0] as {
      x: number;
      y: number;
      zoom: number;
    };
    const flowNodes = testHarness.flowProps.at(-1)!.nodes as Array<{
      id: string;
      position: { x: number; y: number };
      style: { width: number; height: number };
    }>;
    const anchor = flowNodes.find((node) => node.id === base.nodes[0]!.id)!;
    const anchorScreenBounds = {
      left: automaticTarget.x + anchor.position.x * automaticTarget.zoom,
      right: automaticTarget.x + (anchor.position.x + anchor.style.width) * automaticTarget.zoom,
      top: automaticTarget.y + anchor.position.y * automaticTarget.zoom,
      bottom: automaticTarget.y + (anchor.position.y + anchor.style.height) * automaticTarget.zoom,
    };
    expect(automaticTarget.zoom).toBe(0.54);
    expect(anchorScreenBounds.left).toBeGreaterThanOrEqual(0);
    expect(anchorScreenBounds.right).toBeLessThanOrEqual(320);
    expect(anchorScreenBounds.top).toBeCloseTo(40, 8);
    expect(anchorScreenBounds.bottom).toBeLessThanOrEqual(640);

    const fitButton = frame.querySelector<HTMLButtonElement>('button[aria-label="适应视图"]');
    await act(async () => fitButton?.click());
    const manualTarget = testHarness.setViewport.mock.calls[1]![0] as typeof automaticTarget;
    expect(manualTarget.zoom).toBeGreaterThanOrEqual(0.08);
    expect(manualTarget).not.toEqual(automaticTarget);
    const expansion = flowNodes.find((node) => node.id === "selection-expansion")!;
    const expansionScreenBounds = {
      left: manualTarget.x + expansion.position.x * manualTarget.zoom,
      right: manualTarget.x + (expansion.position.x + expansion.style.width) * manualTarget.zoom,
      top: manualTarget.y + expansion.position.y * manualTarget.zoom,
      bottom: manualTarget.y + (expansion.position.y + expansion.style.height) * manualTarget.zoom,
    };
    expect(expansionScreenBounds.left).toBeGreaterThanOrEqual(0);
    expect(expansionScreenBounds.right).toBeLessThanOrEqual(320);
    expect(expansionScreenBounds.top).toBeGreaterThanOrEqual(0);
    expect(expansionScreenBounds.bottom).toBeLessThanOrEqual(640);

    await act(async () => useDashboardStore.getState().selectNode("selection-expansion"));
    await act(async () => useDashboardStore.getState().selectNode(null));
    expect(testHarness.setViewport).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["desktop", 1_440, { x: 278.28, y: 41.36, zoom: 0.54 }],
    ["tablet", 820, { x: -41.72, y: 41.36, zoom: 0.54 }],
  ])("keeps real overview floor framing on %s when full fit misses the floor by padding", async (
    _label,
    width,
    expectedTarget,
  ) => {
    const raw = semanticGraph("overview", Array.from({ length: 19 }, (_, index) => `scope-${index}`));
    const base: HierarchicalSemanticGraph = {
      ...raw,
      nodes: raw.nodes.map((node) => ({
        ...node,
        kind: "scope" as const,
        rawType: "module" as const,
        group: "module" as const,
        category: "module" as const,
        scopeId: node.id,
        canDrillDown: true,
      })),
    };
    testHarness.requestLayout.mockImplementation(async (input: LayoutMessage) => ({
      ...layoutResult(input),
      positions: Object.fromEntries(input.nodes.map((node, index) => [
        node.id,
        index === 0
          ? { x: 48, y: 48 }
          : { x: 48 + (index % 5) * 320, y: 48 + Math.floor(index / 5) * 240 },
      ])),
      bounds: { x: 0, y: 0, width: 1_636, height: 1_032 },
    }));

    await render({ baseGraph: base, narrowViewport: false });
    await emitResize(width, 640);

    const automaticTarget = testHarness.setViewport.mock.calls[0]![0] as {
      x: number;
      y: number;
      zoom: number;
    };
    expect(automaticTarget.x).toBeCloseTo(expectedTarget.x, 8);
    expect(automaticTarget.y).toBeCloseTo(expectedTarget.y, 8);
    expect(automaticTarget.zoom).toBe(expectedTarget.zoom);
    const fitButton = frame.querySelector<HTMLButtonElement>('button[aria-label="适应视图"]');
    await act(async () => fitButton?.click());
    const manualTarget = testHarness.setViewport.mock.calls[1]![0] as typeof automaticTarget;
    expect(manualTarget.zoom).toBeGreaterThanOrEqual(0.08);
    expect(manualTarget).not.toEqual(automaticTarget);
  });

  it.each([
    [
      "phone to tablet",
      760,
      true,
      { x: 302.8, y: 14.08, zoom: 0.54 },
      820,
      false,
      { x: -41.72, y: 41.36, zoom: 0.54 },
    ],
    [
      "tablet to phone",
      820,
      false,
      { x: -41.72, y: 41.36, zoom: 0.54 },
      760,
      true,
      { x: 302.8, y: 14.08, zoom: 0.54 },
    ],
  ])("switches %s framing once inside the shared 800px layout bucket", async (
    _label,
    initialWidth,
    initialNarrowViewport,
    initialTarget,
    nextWidth,
    nextNarrowViewport,
    nextTarget,
  ) => {
    const raw = semanticGraph("overview", Array.from({ length: 19 }, (_, index) => `scope-${index}`));
    const base: HierarchicalSemanticGraph = {
      ...raw,
      nodes: raw.nodes.map((node) => ({
        ...node,
        kind: "scope" as const,
        rawType: "module" as const,
        group: "module" as const,
        category: "module" as const,
        scopeId: node.id,
        canDrillDown: true,
      })),
    };
    testHarness.requestLayout.mockImplementation(async (input: LayoutMessage) => ({
      ...layoutResult(input),
      positions: Object.fromEntries(input.nodes.map((node, index) => [
        node.id,
        index === 0
          ? { x: 48, y: 48 }
          : { x: 48 + (index % 5) * 320, y: 48 + Math.floor(index / 5) * 240 },
      ])),
      bounds: { x: 0, y: 0, width: 1_636, height: 1_032 },
    }));

    await render({ baseGraph: base, narrowViewport: initialNarrowViewport });
    await emitResize(initialWidth, 640);
    expect(testHarness.requestLayout.mock.calls[0]![0].viewport.width).toBe(800);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(1);
    const initialViewport = testHarness.setViewport.mock.calls[0]![0] as {
      x: number;
      y: number;
      zoom: number;
    };
    expect(initialViewport.x).toBeCloseTo(initialTarget.x, 8);
    expect(initialViewport.y).toBeCloseTo(initialTarget.y, 8);
    expect(initialViewport.zoom).toBe(initialTarget.zoom);
    const layoutRequests = testHarness.requestLayout.mock.calls.length;

    await render({ baseGraph: base, narrowViewport: nextNarrowViewport });
    await emitResize(nextWidth, 640);

    expect(testHarness.requestLayout).toHaveBeenCalledTimes(layoutRequests);
    expect(testHarness.requestLayout.mock.calls[0]![0].viewport.width).toBe(800);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(2);
    const switchedViewport = testHarness.setViewport.mock.calls[1]![0] as {
      x: number;
      y: number;
      zoom: number;
    };
    expect(switchedViewport.x).toBeCloseTo(nextTarget.x, 8);
    expect(switchedViewport.y).toBeCloseTo(nextTarget.y, 8);
    expect(switchedViewport.zoom).toBe(nextTarget.zoom);
  });

  it("keeps layout, base positions, and viewport invariant while the inspector sibling opens and closes", async () => {
    const base = semanticGraph("scope", ["a", "b"]);
    await render({ baseGraph: base, inspectorOpen: false });
    await emitResize(960, 650);
    const initialCanvas = frame.querySelector<HTMLElement>(".uc-semantic-canvas")!;
    const initialStructureKey = initialCanvas.dataset.graphStructureKey;
    const initialProps = testHarness.flowProps.at(-1)!;
    const initialNodes = initialProps.nodes as Array<{
      id: string;
      position: { x: number; y: number };
    }>;
    const initialPositions = new Map(initialNodes.map((node) => [node.id, node.position]));
    const initialViewport = testHarness.getViewport();
    expect(testHarness.requestLayout).toHaveBeenCalledTimes(1);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(1);

    await render({ baseGraph: base, inspectorOpen: true });
    expect(frame.querySelector('[data-testid="inspector-sibling"]')).not.toBeNull();
    let currentProps = testHarness.flowProps.at(-1)!;
    let currentNodes = currentProps.nodes as typeof initialNodes;
    expect(testHarness.requestLayout).toHaveBeenCalledTimes(1);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(1);
    expect(frame.querySelector<HTMLElement>(".uc-semantic-canvas")?.dataset.graphStructureKey)
      .toBe(initialStructureKey);
    expect(currentNodes.find((node) => node.id === "a")?.position).toBe(initialPositions.get("a"));
    expect(currentNodes.find((node) => node.id === "b")?.position).toBe(initialPositions.get("b"));
    expect(testHarness.getViewport()).toEqual(initialViewport);

    await render({ baseGraph: base, inspectorOpen: false });
    currentProps = testHarness.flowProps.at(-1)!;
    currentNodes = currentProps.nodes as typeof initialNodes;
    expect(testHarness.requestLayout).toHaveBeenCalledTimes(1);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(1);
    expect(frame.querySelector<HTMLElement>(".uc-semantic-canvas")?.dataset.graphStructureKey)
      .toBe(initialStructureKey);
    expect(currentNodes.find((node) => node.id === "a")?.position).toBe(initialPositions.get("a"));
    expect(currentNodes.find((node) => node.id === "b")?.position).toBe(initialPositions.get("b"));
    expect(testHarness.getViewport()).toEqual(initialViewport);
  });

  it("keeps manual fit outside a left inspector and the bottom-right MiniMap safe areas", async () => {
    const base = semanticGraph("scope", ["a", "b"]);
    await render({
      baseGraph: base,
      showMinimap: true,
      fitViewportInsets: { left: 384 },
    });
    await emitResize(1_440, 650);
    const automaticTarget = testHarness.setViewport.mock.calls[0]![0] as {
      x: number;
      y: number;
      zoom: number;
    };
    const fitButton = frame.querySelector<HTMLButtonElement>('button[aria-label="适应视图"]');
    await act(async () => fitButton?.click());
    const manualTarget = testHarness.setViewport.mock.calls[1]![0] as typeof automaticTarget;
    const flowNodes = testHarness.flowProps.at(-1)!.nodes as Array<{
      position: { x: number; y: number };
      style: { width: number; height: number };
    }>;
    const screenBounds = flowNodes.map((node) => ({
      left: manualTarget.x + node.position.x * manualTarget.zoom,
      right: manualTarget.x + (node.position.x + node.style.width) * manualTarget.zoom,
    }));

    expect(manualTarget).not.toEqual(automaticTarget);
    expect(frame.querySelector('[data-testid="controls"]')?.getAttribute("data-position"))
      .toBe("top-right");
    expect(Math.min(...screenBounds.map((bounds) => bounds.left))).toBeGreaterThanOrEqual(384);
    expect(Math.max(...screenBounds.map((bounds) => bounds.right))).toBeLessThanOrEqual(1_440 - 224);
    expect(testHarness.requestLayout).toHaveBeenCalledTimes(1);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(2);
  });

  it("uses the raw frame dimensions for manual fit inside a wider quantized bucket", async () => {
    const base = semanticGraph("scope", ["a", "b"]);
    testHarness.requestLayout.mockImplementation(async (input: LayoutMessage) => ({
      ...layoutResult(input),
      positions: {
        a: { x: 48, y: 48 },
        b: { x: 2_548, y: 48 },
      },
      bounds: { x: 0, y: 0, width: 2_860, height: 420 },
    }));
    await render({ baseGraph: base, showMinimap: false });
    await emitResize(400, 600);
    const fitButton = frame.querySelector<HTMLButtonElement>('button[aria-label="适应视图"]');
    await act(async () => fitButton?.click());
    const manualTarget = testHarness.setViewport.mock.calls[1]![0] as {
      x: number;
      y: number;
      zoom: number;
    };
    const flowNodes = testHarness.flowProps.at(-1)!.nodes as Array<{
      position: { x: number; y: number };
      style: { width: number; height: number };
    }>;
    const rightEdge = Math.max(...flowNodes.map((node) => (
      manualTarget.x + (node.position.x + node.style.width) * manualTarget.zoom
    )));

    expect(testHarness.requestLayout.mock.calls[0]![0].viewport.width).toBe(480);
    expect(rightEdge).toBeLessThanOrEqual(400);
  });

  it("switches inspector side on a raw same-bucket resize without changing layout or viewport", async () => {
    const base = semanticGraph("scope", ["a", "b"]);
    const responsiveFrameRef = { current: frame };
    useDashboardStore.getState().selectNode("a");

    function ResponsiveInspectorHarness() {
      const [frameWidth, setFrameWidth] = useState(0);
      const side = resolveGraphInspectorSide({
        selectedScreenBounds: { left: 510, right: 626, top: 80, bottom: 180 },
        frameWidth,
        inspectorWidth: 360,
        gap: 12,
        compact: false,
      });
      return createElement(Fragment, null,
        createElement(SemanticGraphCanvas, {
          frameRef: responsiveFrameRef,
          baseGraph: base,
          semanticGraph: base,
          graphRevision: "revision:1",
          navigation: navigation("scope"),
          displayMode: "architecture",
          explicitFocusRequest: null,
          onBaseLayoutReady: ready,
          onFrameWidthChange: setFrameWidth,
          onSelectedScreenBoundsChange: selectedBoundsChanged,
          emptyNotice: null,
          onOpenScope: vi.fn(),
          onOpenCluster: vi.fn(),
          onOpenFile: vi.fn(),
        }),
        createElement("aside", { "data-testid": "responsive-inspector", "data-side": side }),
      );
    }

    await act(async () => {
      root.render(createElement(ResponsiveInspectorHarness));
      await Promise.resolve();
    });
    await emitResize(1_030, 650);
    const inspector = frame.querySelector<HTMLElement>('[data-testid="responsive-inspector"]')!;
    expect(inspector.dataset.side).toBe("right");
    const initialCanvas = frame.querySelector<HTMLElement>(".uc-semantic-canvas")!;
    const initialStructureKey = initialCanvas.dataset.graphStructureKey;
    const initialProps = testHarness.flowProps.at(-1)!;
    const initialNodes = initialProps.nodes as Array<{
      id: string;
      position: { x: number; y: number };
    }>;
    const initialPositions = new Map(initialNodes.map((node) => [node.id, node.position]));
    const initialViewport = testHarness.getViewport();
    const initialTransform = testHarness.setViewport.mock.calls.at(-1)?.[0];
    const layoutRequests = testHarness.requestLayout.mock.calls.length;
    const viewportWrites = testHarness.setViewport.mock.calls.length;

    await emitResize(990, 650);

    expect(inspector.dataset.side).toBe("left");
    expect(testHarness.requestLayout).toHaveBeenCalledTimes(layoutRequests);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(viewportWrites);
    expect(testHarness.setViewport.mock.calls.at(-1)?.[0]).toEqual(initialTransform);
    expect(testHarness.getViewport()).toEqual(initialViewport);
    expect(frame.querySelector<HTMLElement>(".uc-semantic-canvas")?.dataset.graphStructureKey)
      .toBe(initialStructureKey);
    const resizedProps = testHarness.flowProps.at(-1)!;
    const resizedNodes = resizedProps.nodes as typeof initialNodes;
    expect(resizedNodes.find((node) => node.id === "a")?.position).toBe(initialPositions.get("a"));
    expect(resizedNodes.find((node) => node.id === "b")?.position).toBe(initialPositions.get("b"));
    expect(resizedProps.fitView).toBeUndefined();
    expect(resizedProps.fitViewOptions).toBeUndefined();
  });

  it("recomputes selected screen bounds at every geometry boundary without moving the viewport", async () => {
    const base = semanticGraph("scope", ["a", "b"]);
    const pendingLayout = deferred<SemanticLayoutResult>();
    testHarness.requestLayout.mockReturnValueOnce(pendingLayout.promise);
    await render({ baseGraph: base });
    await emitResize(960, 650);
    await act(async () => useDashboardStore.getState().selectNode("a"));
    expect(testHarness.flowToScreenPosition).not.toHaveBeenCalled();

    const layoutInput = testHarness.requestLayout.mock.calls[0]![0] as LayoutMessage;
    await act(async () => {
      pendingLayout.resolve(layoutResult(layoutInput));
      await pendingLayout.promise;
      await Promise.resolve();
    });
    expect(testHarness.flowToScreenPosition.mock.calls.slice(-2)).toEqual([
      [{ x: 48, y: 48 }],
      [{ x: 276, y: 140 }],
    ]);
    expect(selectedBoundsChanged).toHaveBeenLastCalledWith({
      left: 138,
      right: 366,
      top: 228,
      bottom: 320,
    });
    const automaticViewportCalls = testHarness.setViewport.mock.calls.length;
    expect(automaticViewportCalls).toBe(1);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(automaticViewportCalls);

    let props = testHarness.flowProps.at(-1)!;
    const beforeMoveProjectionCalls = testHarness.flowToScreenPosition.mock.calls.length;
    const emittedBoundsCount = selectedBoundsChanged.mock.calls.length;
    await act(async () => (props.onMoveEnd as Function)(null, { x: 12, y: 18, zoom: 0.8 }));
    expect(testHarness.flowToScreenPosition.mock.calls.length).toBe(beforeMoveProjectionCalls + 2);
    expect(selectedBoundsChanged).toHaveBeenCalledTimes(emittedBoundsCount);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(automaticViewportCalls);

    const beforeInitProjectionCalls = testHarness.flowToScreenPosition.mock.calls.length;
    await act(async () => (props.onInit as Function)({
      setViewport: testHarness.setViewport,
      getViewport: testHarness.getViewport,
      flowToScreenPosition: testHarness.flowToScreenPosition,
    }));
    expect(testHarness.flowToScreenPosition.mock.calls.length).toBe(beforeInitProjectionCalls + 2);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(automaticViewportCalls);

    await emitResize(1_360, 780);
    await flushRaf();
    await flushRaf();
    expect(testHarness.requestLayout).toHaveBeenCalledTimes(2);
    expect(testHarness.flowToScreenPosition.mock.calls.length).toBeGreaterThan(beforeInitProjectionCalls + 2);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(automaticViewportCalls + 1);
    props = testHarness.flowProps.at(-1)!;
    expect(props.fitView).toBeUndefined();
    expect(props.fitViewOptions).toBeUndefined();
    expect(testHarness.getViewport()).toEqual({ x: 12, y: 18, zoom: 0.8 });
  });

  it("guards stale explicit requests, repositions cached structures once per request, and never repositions the selection commit", async () => {
    const firstViewport = deferred<boolean>();
    const secondViewport = deferred<boolean>();
    testHarness.setViewport
      .mockReturnValueOnce(firstViewport.promise)
      .mockReturnValueOnce(secondViewport.promise)
      .mockResolvedValue(true);
    const base = semanticGraph("scope", ["a", "b"]);
    await render({ baseGraph: base, explicitFocusRequest: { requestId: 1, materializedNodeId: "a" } });
    await emitResize(960, 650);
    expect(testHarness.requestLayout).toHaveBeenCalledTimes(1);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(1);

    await render({ baseGraph: base, explicitFocusRequest: { requestId: 2, materializedNodeId: "a" } });
    expect(testHarness.setViewport).toHaveBeenCalledTimes(2);

    await act(async () => {
      firstViewport.resolve(true);
      await firstViewport.promise;
    });
    expect(ready).not.toHaveBeenCalled();

    await act(async () => {
      secondViewport.resolve(true);
      await secondViewport.promise;
    });
    expect(ready).toHaveBeenCalledTimes(1);
    expect(ready).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 2,
      materializedNodeId: "a",
      structureKey: expect.any(String),
    }));

    await act(async () => useDashboardStore.getState().selectNode("a"));
    await render({ baseGraph: base, explicitFocusRequest: null });
    expect(testHarness.requestLayout).toHaveBeenCalledTimes(1);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(2);

    await render({ baseGraph: base, explicitFocusRequest: { requestId: 3, materializedNodeId: "a" } });
    expect(testHarness.requestLayout).toHaveBeenCalledTimes(1);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(3);
    expect(ready).toHaveBeenCalledWith(expect.objectContaining({ requestId: 3 }));
  });

  it("replays the latest focus transform when an older setViewport resolves last", async () => {
    const firstViewport = deferred<boolean>();
    const secondViewport = deferred<boolean>();
    testHarness.requestLayout.mockImplementation(async (input: LayoutMessage) => ({
      ...layoutResult(input),
      bounds: { x: 0, y: 0, width: 4_000, height: 800 },
    }));
    testHarness.setViewport
      .mockReturnValueOnce(firstViewport.promise)
      .mockReturnValueOnce(secondViewport.promise)
      .mockResolvedValue(true);
    const base = semanticGraph("scope", ["a", "b"]);

    await render({ baseGraph: base, explicitFocusRequest: { requestId: 1, materializedNodeId: "a" } });
    await emitResize(960, 650);
    const firstTarget = testHarness.setViewport.mock.calls[0]![0];
    await render({ baseGraph: base, explicitFocusRequest: { requestId: 2, materializedNodeId: "b" } });
    const secondTarget = testHarness.setViewport.mock.calls[1]![0];
    expect(secondTarget).not.toEqual(firstTarget);

    await act(async () => {
      secondViewport.resolve(true);
      await secondViewport.promise;
    });
    expect(ready).toHaveBeenCalledTimes(1);
    expect(ready).toHaveBeenLastCalledWith(expect.objectContaining({
      requestId: 2,
      materializedNodeId: "b",
    }));

    await act(async () => {
      firstViewport.resolve(true);
      await firstViewport.promise;
      await Promise.resolve();
    });
    expect(testHarness.setViewport).toHaveBeenCalledTimes(3);
    expect(testHarness.setViewport.mock.calls[2]![0]).toEqual(secondTarget);
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it("does not replay an older completion when both requests target the same transform", async () => {
    const firstViewport = deferred<boolean>();
    const secondViewport = deferred<boolean>();
    testHarness.setViewport
      .mockReturnValueOnce(firstViewport.promise)
      .mockReturnValueOnce(secondViewport.promise)
      .mockResolvedValue(true);
    const base = semanticGraph("scope", ["a", "b"]);

    await render({ baseGraph: base, explicitFocusRequest: { requestId: 1, materializedNodeId: "a" } });
    await emitResize(960, 650);
    await render({ baseGraph: base, explicitFocusRequest: { requestId: 2, materializedNodeId: "a" } });
    expect(testHarness.setViewport.mock.calls[1]![0])
      .toEqual(testHarness.setViewport.mock.calls[0]![0]);

    await act(async () => {
      secondViewport.resolve(true);
      await secondViewport.promise;
      firstViewport.resolve(true);
      await firstViewport.promise;
      await Promise.resolve();
    });
    expect(testHarness.setViewport).toHaveBeenCalledTimes(2);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(ready).toHaveBeenLastCalledWith(expect.objectContaining({ requestId: 2 }));
  });

  it("keeps a manual fit authoritative when an older normal auto-fit resolves last", async () => {
    const automaticViewport = deferred<boolean>();
    const manualViewport = deferred<boolean>();
    testHarness.requestLayout.mockImplementation(async (input: LayoutMessage) => ({
      ...layoutResult(input),
      bounds: { x: 0, y: 0, width: 4_000, height: 800 },
    }));
    testHarness.setViewport
      .mockReturnValueOnce(automaticViewport.promise)
      .mockReturnValueOnce(manualViewport.promise)
      .mockResolvedValue(true);
    const base = semanticGraph("scope", ["a", "b"]);
    useDashboardStore.getState().selectNode("b");

    await render({ baseGraph: base });
    await emitResize(960, 650);
    const automaticTarget = testHarness.setViewport.mock.calls[0]![0];
    const fitButton = frame.querySelector<HTMLButtonElement>('button[aria-label="适应视图"]');
    await act(async () => fitButton?.click());
    const manualTarget = testHarness.setViewport.mock.calls[1]![0];
    expect(manualTarget).not.toEqual(automaticTarget);

    await act(async () => {
      manualViewport.resolve(true);
      await manualViewport.promise;
      automaticViewport.resolve(true);
      await automaticViewport.promise;
      await Promise.resolve();
    });
    expect(testHarness.setViewport).toHaveBeenCalledTimes(3);
    expect(testHarness.setViewport.mock.calls[2]![0]).toEqual(manualTarget);
  });

  it("still emits explicit layout readiness when manual fit supersedes its transform", async () => {
    const explicitViewport = deferred<boolean>();
    const manualViewport = deferred<boolean>();
    testHarness.setViewport
      .mockReturnValueOnce(explicitViewport.promise)
      .mockReturnValueOnce(manualViewport.promise)
      .mockResolvedValue(true);
    const base = semanticGraph("scope", ["a", "b"]);

    await render({ baseGraph: base, explicitFocusRequest: { requestId: 7, materializedNodeId: "a" } });
    await emitResize(960, 650);
    const fitButton = frame.querySelector<HTMLButtonElement>('button[aria-label="适应视图"]');
    await act(async () => fitButton?.click());

    await act(async () => {
      manualViewport.resolve(true);
      await manualViewport.promise;
      explicitViewport.resolve(true);
      await explicitViewport.promise;
      await Promise.resolve();
    });
    expect(ready).toHaveBeenCalledTimes(1);
    expect(ready).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 7,
      materializedNodeId: "a",
    }));
  });

  it("repositions A after A to B to A navigation instead of permanently suppressing the key", async () => {
    const graphA = semanticGraph("scope", ["a", "b"]);
    const graphB = semanticGraph("scope", ["a", "c"]);
    await render({ baseGraph: graphA, graphRevision: "revision:a" });
    await emitResize(960, 650);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(1);

    await render({ baseGraph: graphB, graphRevision: "revision:b" });
    expect(testHarness.setViewport).toHaveBeenCalledTimes(2);

    await render({ baseGraph: graphA, graphRevision: "revision:a" });
    expect(testHarness.setViewport).toHaveBeenCalledTimes(3);
  });

  it("applies a post-navigation automatic viewport to the newly initialized React Flow instance", async () => {
    const graphA = semanticGraph("overview", ["a", "b", "c"]);
    const graphB = semanticGraph("cluster", Array.from({ length: 15 }, (_, index) => `cluster-${index}`));
    await render({ baseGraph: graphA, graphRevision: "revision:a" });
    await emitResize(960, 650);
    const initialInstanceId = testHarness.activeFlowInstanceId;
    expect(testHarness.flowInstanceViewportWrites.at(-1)).toMatchObject({
      instanceId: initialInstanceId,
      active: true,
    });

    const pendingLayout = deferred<SemanticLayoutResult>();
    testHarness.requestLayout.mockReturnValueOnce(pendingLayout.promise);
    testHarness.deferNextFlowInit = true;
    await render({ baseGraph: graphB, graphRevision: "revision:b" });
    const layoutInput = testHarness.requestLayout.mock.calls[1]![0] as LayoutMessage;
    await act(async () => {
      pendingLayout.resolve(layoutResult(layoutInput));
      await pendingLayout.promise;
      await Promise.resolve();
    });
    const navigatedInstanceId = testHarness.activeFlowInstanceId;
    expect(navigatedInstanceId).not.toBe(initialInstanceId);

    await flushFlowInit();
    expect(testHarness.flowInstanceViewportWrites.at(-1)).toMatchObject({
      instanceId: navigatedInstanceId,
      active: true,
    });
  });

  it("reapplies A on its replacement mount when B initialization is still pending", async () => {
    const graphA = semanticGraph("overview", ["a", "b", "c"]);
    const graphB = semanticGraph("cluster", Array.from({ length: 15 }, (_, index) => `cluster-${index}`));
    await render({ baseGraph: graphA, graphRevision: "revision:a" });
    await emitResize(960, 650);
    const initialAInstanceId = testHarness.activeFlowInstanceId;
    expect(testHarness.flowInstanceViewportWrites).toHaveLength(1);

    const pendingBLayout = deferred<SemanticLayoutResult>();
    testHarness.requestLayout.mockReturnValueOnce(pendingBLayout.promise);
    testHarness.deferNextFlowInit = true;
    await render({ baseGraph: graphB, graphRevision: "revision:b" });
    const layoutInput = testHarness.requestLayout.mock.calls[1]![0] as LayoutMessage;
    await act(async () => {
      pendingBLayout.resolve(layoutResult(layoutInput));
      await pendingBLayout.promise;
      await Promise.resolve();
    });
    expect(testHarness.pendingFlowInits).toHaveLength(1);
    expect(testHarness.flowInstanceViewportWrites).toHaveLength(1);

    const writesBeforeReturningToA = testHarness.flowInstanceViewportWrites.length;
    await render({ baseGraph: graphA, graphRevision: "revision:a" });
    const replacementAInstanceId = testHarness.activeFlowInstanceId;
    expect(replacementAInstanceId).not.toBe(initialAInstanceId);
    expect(testHarness.flowInstanceViewportWrites.slice(writesBeforeReturningToA)).toEqual([
      expect.objectContaining({
        instanceId: replacementAInstanceId,
        active: true,
      }),
    ]);

    await flushFlowInit();
    expect(testHarness.flowInstanceViewportWrites.slice(writesBeforeReturningToA))
      .toHaveLength(1);
    const writesAfterStaleBInit = testHarness.flowInstanceViewportWrites.length;
    await render({
      baseGraph: graphA,
      graphRevision: "revision:a",
      explicitFocusRequest: { requestId: 17, materializedNodeId: "a" },
    });
    expect(testHarness.flowInstanceViewportWrites.slice(writesAfterStaleBInit)).toEqual([
      expect.objectContaining({
        instanceId: replacementAInstanceId,
        active: true,
      }),
    ]);
    expect(testHarness.flowInstanceViewportWrites.slice(writesBeforeReturningToA))
      .not.toContainEqual(expect.objectContaining({ active: false }));
  });

  it("does not replay or complete B through its inactive instance after C finishes", async () => {
    const pendingBViewport = deferred<boolean>();
    testHarness.setViewport
      .mockReturnValueOnce(pendingBViewport.promise)
      .mockResolvedValue(true);
    const graphB = semanticGraph("overview", ["b-a", "b-b", "b-c"]);
    const graphC = semanticGraph("cluster", Array.from({ length: 15 }, (_, index) => `c-${index}`));

    await render({ baseGraph: graphB, graphRevision: "revision:b" });
    await emitResize(960, 650);
    const bInstanceId = testHarness.activeFlowInstanceId;
    const bTarget = testHarness.setViewport.mock.calls[0]![0];

    await render({ baseGraph: graphC, graphRevision: "revision:c" });
    const cInstanceId = testHarness.activeFlowInstanceId;
    const cTarget = testHarness.setViewport.mock.calls[1]![0];
    expect(cInstanceId).not.toBe(bInstanceId);
    expect(cTarget).not.toEqual(bTarget);
    expect(testHarness.flowInstanceViewportWrites.at(-1)).toMatchObject({
      instanceId: cInstanceId,
      active: true,
      viewport: cTarget,
    });

    const writesAfterCCompleted = testHarness.flowInstanceViewportWrites.length;
    await act(async () => {
      pendingBViewport.resolve(true);
      await pendingBViewport.promise;
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(testHarness.flowInstanceViewportWrites).toHaveLength(writesAfterCCompleted);
    expect(testHarness.flowInstanceViewportWrites)
      .not.toContainEqual(expect.objectContaining({ instanceId: bInstanceId, active: false }));

    const writesBeforeReturningToB = testHarness.flowInstanceViewportWrites.length;
    await render({ baseGraph: graphB, graphRevision: "revision:b" });
    const replacementBInstanceId = testHarness.activeFlowInstanceId;
    expect(replacementBInstanceId).not.toBe(bInstanceId);
    expect(testHarness.flowInstanceViewportWrites.slice(writesBeforeReturningToB)).toEqual([
      expect.objectContaining({
        instanceId: replacementBInstanceId,
        active: true,
        viewport: bTarget,
      }),
    ]);
  });

  it("rejects a late layout result after a newer structure has committed", async () => {
    const firstLayout = deferred<SemanticLayoutResult>();
    const secondLayout = deferred<SemanticLayoutResult>();
    testHarness.requestLayout
      .mockReturnValueOnce(firstLayout.promise)
      .mockReturnValueOnce(secondLayout.promise);
    const graphA = semanticGraph("scope", ["a", "b"]);
    const graphB = semanticGraph("scope", ["a", "c"]);

    await render({ baseGraph: graphA, graphRevision: "revision:a" });
    await emitResize(960, 650);
    const requestA = testHarness.requestLayout.mock.calls[0]![0] as LayoutMessage;
    await render({ baseGraph: graphB, graphRevision: "revision:b" });
    const requestB = testHarness.requestLayout.mock.calls[1]![0] as LayoutMessage;

    await act(async () => {
      secondLayout.resolve(layoutResult(requestB));
      await secondLayout.promise;
      await Promise.resolve();
    });
    const committed = testHarness.flowProps.at(-1)!.nodes as Array<{
      id: string;
      position: { x: number; y: number };
    }>;
    expect(committed.map((node) => node.id)).toEqual(["a", "c"]);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstLayout.resolve(layoutResult(requestA, true));
      await firstLayout.promise;
      await Promise.resolve();
    });
    const afterLateResult = testHarness.flowProps.at(-1)!.nodes as Array<{
      id: string;
      position: { x: number; y: number };
    }>;
    expect(afterLateResult.map((node) => node.id)).toEqual(["a", "c"]);
    expect(testHarness.setViewport).toHaveBeenCalledTimes(1);
    expect(frame.textContent).not.toContain("图谱布局已降级为稳定网格");
  });

  it("renders degraded layout as a non-blocking overlay without replacing the canvas", async () => {
    testHarness.requestLayout.mockImplementation(async (input: LayoutMessage) => layoutResult(input, true));
    await render();
    await emitResize(960, 650);

    expect(frame.querySelector('[data-testid="react-flow"]')).not.toBeNull();
    expect(frame.querySelector('[role="status"]')?.textContent).toBe("图谱布局已降级为稳定网格");
    expect(frame.querySelector('[role="status"]')?.className).toContain("uc-graph-layout-status");
  });

  it("shows edge labels only while an edge is hovered or connected to selection", async () => {
    await render();
    await emitResize(960, 650);
    let props = testHarness.flowProps.at(-1)!;
    let edges = props.edges as Array<{ id: string; data: { showLabel: boolean } }>;
    expect(edges[0]!.data.showLabel).toBe(false);

    await act(async () => (props.onEdgeMouseEnter as Function)({}, { id: edges[0]!.id }));
    props = testHarness.flowProps.at(-1)!;
    edges = props.edges as typeof edges;
    expect(edges[0]!.data.showLabel).toBe(true);

    await act(async () => (props.onEdgeMouseLeave as Function)({}, { id: edges[0]!.id }));
    expect((testHarness.flowProps.at(-1)!.edges as typeof edges)[0]!.data.showLabel).toBe(false);

    await act(async () => useDashboardStore.getState().selectNode("a"));
    expect((testHarness.flowProps.at(-1)!.edges as typeof edges)[0]!.data.showLabel).toBe(true);

    const dense = semanticGraph("scope", ["a", "b", "c"]);
    await render({ baseGraph: dense, semanticGraph: dense });
    props = testHarness.flowProps.at(-1)!;
    edges = props.edges as typeof edges;
    await act(async () => (props.onEdgeMouseEnter as Function)({}, { id: edges[1]!.id }));
    const hoveredUnrelated = (testHarness.flowProps.at(-1)!.edges as Array<{
      id: string;
      data: { showLabel: boolean; labelOpacity: number; opacity: number };
    }>)[1]!;
    expect(hoveredUnrelated.data).toMatchObject({ showLabel: true, opacity: 0.1 });
    expect(hoveredUnrelated.data.labelOpacity).toBeGreaterThanOrEqual(0.9);
  });
});
