// @vitest-environment happy-dom

import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HierarchicalSemanticGraph } from "../../../graphExplorer/hierarchicalGraph";
import type { SemanticLayoutResult } from "../../../graphExplorer/layoutClient.js";
import { useDashboardStore } from "../../../store";

const testHarness = vi.hoisted(() => ({
  flowProps: [] as Array<{ nodes: Array<{ id: string; position: { x: number; y: number } }> }>,
  requestLayout: vi.fn(),
}));

vi.mock("../../../graphExplorer/layoutClient.js", () => ({
  requestSemanticLayout: testHarness.requestLayout,
}));

vi.mock("@xyflow/react", async () => {
  const { createElement } = await import("react");
  return {
    Background: () => null,
    BackgroundVariant: { Dots: "dots" },
    Controls: () => null,
    Handle: () => null,
    MiniMap: () => null,
    Position: { Bottom: "bottom", Left: "left", Right: "right", Top: "top" },
    ReactFlow: (props: {
      children?: unknown;
      nodes: Array<{ id: string; position: { x: number; y: number } }>;
    }) => {
      testHarness.flowProps.push(props);
      return createElement("div", { "data-testid": "react-flow" }, props.children as never);
    },
  };
});

import SemanticGraphCanvas from "../SemanticGraphCanvas";

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
    docs: {
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
    },
  };
}

function semanticGraph(
  level: "overview" | "scope" | "file",
  nodeIds: string[],
): HierarchicalSemanticGraph {
  return {
    nodes: nodeIds.map(graphNode),
    edges: nodeIds.slice(1).map((id, index) => ({
      id: `${nodeIds[index]}->${id}`,
      source: nodeIds[index]!,
      target: id,
      type: "imports" as const,
      direction: "forward" as const,
      edgeTypes: ["imports" as const],
      directions: ["forward" as const],
      weight: 1,
      bundledCount: 1,
      members: [{
        id: `member:${index}`,
        source: nodeIds[index]!,
        target: id,
        type: "imports" as const,
        direction: "forward" as const,
        weight: 1,
      }],
    })),
    presentation: {
      displayMode: "architecture",
      level,
      relationshipSource: "imports",
      scopeId: level === "overview" ? null : "scope:core",
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

function result(
  requestId: number,
  positions: Record<string, { x: number; y: number }>,
): SemanticLayoutResult {
  return { requestId, positions, execution: "worker" };
}

describe("SemanticGraphCanvas layout lifecycle", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.replaceChildren(container);
    root = createRoot(container);
    testHarness.flowProps.length = 0;
    testHarness.requestLayout.mockReset();
    useDashboardStore.setState({ selectedNodeId: null });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  function canvas(graph: HierarchicalSemanticGraph, viewKey: string) {
    return createElement(SemanticGraphCanvas, {
      semanticGraph: graph,
      displayMode: "architecture",
      viewKey,
      onOpenScope: vi.fn(),
      onOpenFile: vi.fn(),
    });
  }

  it("keeps overview compact and makes zero worker requests", async () => {
    await act(async () => {
      root.render(canvas(semanticGraph("overview", ["a", "b"]), "overview"));
      await Promise.resolve();
    });

    expect(testHarness.requestLayout).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="react-flow"]')).not.toBeNull();
  });

  it("requests scope layout once under StrictMode and mounts React Flow only after completion", async () => {
    const pending = deferred<SemanticLayoutResult>();
    testHarness.requestLayout.mockReturnValue(pending.promise);

    await act(async () => {
      root.render(createElement(StrictMode, null, canvas(
        semanticGraph("scope", ["a", "b"]),
        "scope:core",
      )));
      await Promise.resolve();
    });

    expect(testHarness.requestLayout).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("正在计算图谱布局");
    expect(container.querySelector('[data-testid="react-flow"]')).toBeNull();

    const requestId = testHarness.requestLayout.mock.calls[0]![0].requestId as number;
    await act(async () => {
      pending.resolve(result(requestId, { a: { x: 10, y: 20 }, b: { x: 403, y: 20 } }));
      await pending.promise;
    });

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[data-testid="react-flow"]')).not.toBeNull();
  });

  it("does not request again or move existing nodes when selection pins an extra node", async () => {
    testHarness.requestLayout.mockImplementation(async (input: { requestId: number }) => result(input.requestId, {
      beta: { x: 17, y: 29 },
      charlie: { x: 410, y: 29 },
    }));

    await act(async () => {
      root.render(canvas(semanticGraph("scope", ["beta", "charlie"]), "scope:core"));
      await Promise.resolve();
      await Promise.resolve();
    });
    const initial = testHarness.flowProps.at(-1)!.nodes;

    await act(async () => {
      useDashboardStore.getState().selectNode("alpha");
      root.render(canvas(semanticGraph("scope", ["alpha", "beta", "charlie"]), "scope:core"));
      await Promise.resolve();
    });
    const expanded = testHarness.flowProps.at(-1)!.nodes;

    expect(testHarness.requestLayout).toHaveBeenCalledTimes(1);
    expect(expanded.find((node) => node.id === "beta")?.position)
      .toEqual(initial.find((node) => node.id === "beta")?.position);
    expect(expanded.find((node) => node.id === "charlie")?.position)
      .toEqual(initial.find((node) => node.id === "charlie")?.position);
    expect(new Set(expanded.map((node) => `${node.position.x}:${node.position.y}`)).size).toBe(3);
  });

  it("does not invent a second scope layout when the shared algorithm rejects", async () => {
    testHarness.requestLayout.mockRejectedValue(new Error("dagre failed"));

    await act(async () => {
      root.render(canvas(semanticGraph("scope", ["a"]), "scope:failure"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain("图谱布局计算失败");
    expect(container.querySelector('[data-testid="react-flow"]')).toBeNull();
  });

  it("aborts the old view and rejects its stale completion during rapid navigation", async () => {
    const requests = [deferred<SemanticLayoutResult>(), deferred<SemanticLayoutResult>()];
    testHarness.requestLayout
      .mockReturnValueOnce(requests[0]!.promise)
      .mockReturnValueOnce(requests[1]!.promise);

    await act(async () => {
      root.render(canvas(semanticGraph("scope", ["a"]), "scope:a"));
      await Promise.resolve();
    });
    const firstOptions = testHarness.requestLayout.mock.calls[0]![1] as { signal: AbortSignal };
    const firstRequestId = testHarness.requestLayout.mock.calls[0]![0].requestId as number;

    await act(async () => {
      root.render(canvas(semanticGraph("scope", ["a"]), "scope:b"));
      await Promise.resolve();
    });
    const secondRequestId = testHarness.requestLayout.mock.calls[1]![0].requestId as number;

    expect(firstOptions.signal.aborted).toBe(true);
    await act(async () => {
      requests[1]!.resolve(result(secondRequestId, { a: { x: 900, y: 50 } }));
      await requests[1]!.promise;
    });
    await act(async () => {
      requests[0]!.resolve(result(firstRequestId, { a: { x: 1, y: 2 } }));
      await requests[0]!.promise;
    });

    expect(testHarness.requestLayout).toHaveBeenCalledTimes(2);
    expect(testHarness.flowProps.at(-1)!.nodes[0]!.position).toEqual({ x: 900, y: 50 });
  });
});
