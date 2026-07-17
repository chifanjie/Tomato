import { describe, expect, it } from "vitest";
import type {
  GraphExplorerNavigation,
  HierarchicalGraphSelectionExpansion,
  HierarchicalSemanticGraph,
  HierarchicalSemanticGraphNode,
} from "../../../graphExplorer/hierarchicalGraph.js";
import { quantizeGraphViewport } from "../../../utils/layoutAlgorithm.js";
import {
  READABLE_ZOOM_BY_LEVEL,
  buildGraphStructureKey,
  computeReadableViewport,
  graphNodeContentHeight,
  graphNodeSize,
  graphSemanticZoomBand,
  placeSelectionExpansion,
} from "../semanticGraphCanvasModel.js";

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

function graphNode(
  id: string,
  kind: NonNullable<HierarchicalSemanticGraphNode["kind"]> = "node",
  rawType: HierarchicalSemanticGraphNode["rawType"] = "file",
): HierarchicalSemanticGraphNode {
  return {
    id,
    label: `label ${id}`,
    group: rawType === "function" ? "symbol" : "file",
    category: rawType === "function" ? "symbol" : "file",
    cluster: "src",
    importance: 1,
    rawType,
    summary: `summary ${id}`,
    kind,
    docs: EMPTY_DOCS,
  };
}

function graphEdge(source: string, target: string, id = `${source}->${target}`) {
  return {
    id,
    source,
    target,
    type: "imports" as const,
    direction: "forward" as const,
    edgeTypes: ["imports" as const],
    directions: ["forward" as const],
    weight: 0.8,
    bundledCount: 1,
    members: [{
      id: `member:${id}`,
      source,
      target,
      type: "imports" as const,
      direction: "forward" as const,
      weight: 0.8,
    }],
  };
}

function baseGraph(): HierarchicalSemanticGraph {
  return {
    nodes: [graphNode("base:a", "cluster"), graphNode("base:b", "node")],
    edges: [graphEdge("base:a", "base:b")],
    presentation: {
      displayMode: "architecture",
      level: "scope",
      relationshipSource: "imports",
      scopeId: "scope:core",
      clusterId: null,
      fileId: null,
      scopeOptions: [],
      breadcrumbs: [],
      totalNodeCount: 2,
      hiddenNodeCount: 0,
      focusApplied: false,
      notice: null,
    },
  };
}

function structureKey(overrides: Partial<Parameters<typeof buildGraphStructureKey>[0]> = {}): string {
  const graph = baseGraph();
  const viewport = quantizeGraphViewport(960, 650);
  return buildGraphStructureKey({
    graphRevision: "revision:1",
    displayMode: "architecture",
    navigation: { level: "scope", scopeId: "scope:core" },
    viewport,
    baseGraph: graph,
    nodeSizeById: new Map(graph.nodes.map((node) => [node.id, graphNodeSize("scope", node)])),
    algorithmVersion: 2,
    densityVersion: 1,
    ...overrides,
  });
}

describe("graph structure key", () => {
  it("changes for every structural layout input", () => {
    const graph = baseGraph();
    const baseViewport = quantizeGraphViewport(960, 650);
    const navigation: GraphExplorerNavigation = { level: "scope", scopeId: "scope:core" };
    const variants = [
      structureKey({ graphRevision: "revision:2" }),
      structureKey({ displayMode: "call" }),
      structureKey({ navigation: { level: "cluster", scopeId: "scope:core", clusterId: "cluster:src" } }),
      structureKey({ viewport: { ...baseViewport, width: baseViewport.width + 160 } }),
      structureKey({ viewport: { ...baseViewport, height: baseViewport.height + 160 } }),
      structureKey({ viewport: { ...baseViewport, widthBucket: baseViewport.widthBucket + 1 } }),
      structureKey({ viewport: { ...baseViewport, heightBucket: baseViewport.heightBucket + 1 } }),
      structureKey({ viewport: { ...baseViewport, aspectBucket: "wide" } }),
      structureKey({ algorithmVersion: 3 }),
      structureKey({ densityVersion: 2 }),
      structureKey({ baseGraph: { ...graph, nodes: [{ ...graph.nodes[0]!, id: "base:changed" }, graph.nodes[1]!] } }),
      structureKey({ baseGraph: { ...graph, nodes: [{ ...graph.nodes[0]!, kind: "scope" }, graph.nodes[1]!] } }),
      structureKey({ nodeSizeById: new Map([
        ["base:a", { ...graphNodeSize("scope", graph.nodes[0]!), width: 999 }],
        ["base:b", graphNodeSize("scope", graph.nodes[1]!)],
      ]) }),
      structureKey({ baseGraph: { ...graph, edges: [{ ...graph.edges[0]!, source: "base:b", target: "base:a" }] } }),
      structureKey({ baseGraph: { ...graph, edges: [{ ...graph.edges[0]!, edgeTypes: ["calls"], type: "calls" }] } }),
      structureKey({ baseGraph: { ...graph, edges: [{ ...graph.edges[0]!, directions: ["backward"], direction: "backward" }] } }),
      structureKey({ baseGraph: { ...graph, edges: [{ ...graph.edges[0]!, bundledCount: 2 }] } }),
      structureKey({ baseGraph: { ...graph, edges: [{ ...graph.edges[0]!, weight: 0.4 }] } }),
    ];

    expect(new Set([structureKey({ navigation }), ...variants]).size).toBe(variants.length + 1);
  });

  it("ignores labels, summaries, documentation badges, selection, reduced motion, and expansion", () => {
    const graph = baseGraph();
    const changedPresentationOnly: HierarchicalSemanticGraph = {
      ...graph,
      nodes: graph.nodes.map((node) => ({
        ...node,
        label: `renamed ${node.id}`,
        summary: "changed summary",
        docs: { ...node.docs, relation: "direct", directPageIds: ["page:1"] },
        documentationCounts: { direct: 1, context: 0, none: 0, problem: 0, total: 1 },
      })),
    };

    expect(structureKey({ baseGraph: changedPresentationOnly })).toBe(structureKey());
    // selected id, reduced-motion state, and selectionExpansion are deliberately absent from the API.
    expect(structureKey()).toBe(structureKey());
  });
});

describe("local selection placement", () => {
  it("preserves base position objects and deterministically rings missing selection nodes around an anchor", () => {
    const graph = baseGraph();
    const expansion: HierarchicalGraphSelectionExpansion = {
      nodes: [graphNode("selected", "node", "function"), graphNode("neighbor", "node", "function")],
      edges: [graphEdge("base:b", "selected"), graphEdge("selected", "neighbor")],
    };
    const a = { x: 40, y: 60 };
    const b = { x: 420, y: 60 };
    const basePositions = new Map([["base:a", a], ["base:b", b]]);
    const allNodes = [...graph.nodes, ...expansion.nodes];
    const sizes = new Map(allNodes.map((node) => [node.id, graphNodeSize("scope", node)]));
    const viewport = quantizeGraphViewport(960, 650);
    const first = placeSelectionExpansion({
      baseGraph: graph,
      expansion,
      basePositions,
      selectedNodeId: "selected",
      nodeSizeById: sizes,
      viewport,
    });
    const second = placeSelectionExpansion({
      baseGraph: graph,
      expansion: { nodes: [...expansion.nodes].reverse(), edges: [...expansion.edges].reverse() },
      basePositions,
      selectedNodeId: "selected",
      nodeSizeById: sizes,
      viewport,
    });

    expect(first.get("base:a")).toBe(a);
    expect(first.get("base:b")).toBe(b);
    expect(second).toEqual(first);
    for (const id of ["selected", "neighbor"]) {
      expect(Number.isFinite(first.get(id)!.x)).toBe(true);
      expect(Number.isFinite(first.get(id)!.y)).toBe(true);
    }
    const anchorSize = sizes.get("base:b")!;
    const selectedSize = sizes.get("selected")!;
    const selected = first.get("selected")!;
    const overlapsAnchor = selected.x < b.x + anchorSize.width
      && selected.x + selectedSize.width > b.x
      && selected.y < b.y + anchorSize.height
      && selected.y + selectedSize.height > b.y;
    expect(overlapsAnchor).toBe(false);
  });

  it("stays finite with no positioned base anchor", () => {
    const expansion: HierarchicalGraphSelectionExpansion = {
      nodes: [graphNode("selected", "node", "function")],
      edges: [],
    };
    const result = placeSelectionExpansion({
      baseGraph: { ...baseGraph(), nodes: [], edges: [] },
      expansion,
      basePositions: new Map(),
      selectedNodeId: "selected",
      nodeSizeById: new Map([["selected", graphNodeSize("file", expansion.nodes[0]!)]]),
      viewport: quantizeGraphViewport(390, 740),
    });
    expect(result.get("selected")).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect(Number.isFinite(result.get("selected")!.x)).toBe(true);
    expect(Number.isFinite(result.get("selected")!.y)).toBe(true);
  });
});

describe("readable graph viewport", () => {
  it("locks the semantic zoom floors and zoom-band thresholds", () => {
    expect(READABLE_ZOOM_BY_LEVEL).toEqual({ overview: 0.54, scope: 0.62, cluster: 0.70, file: 0.78 });
    expect(graphSemanticZoomBand(0.85)).toBe("full");
    expect(graphSemanticZoomBand(0.849)).toBe("compact");
    expect(graphSemanticZoomBand(0.62)).toBe("compact");
    expect(graphSemanticZoomBand(0.619)).toBe("minimal");
  });

  it.each(Object.entries(READABLE_ZOOM_BY_LEVEL) as Array<[
    keyof typeof READABLE_ZOOM_BY_LEVEL,
    number,
  ]>)("uses the %s readable floor when the full graph would be illegible", (level, floor) => {
    const result = computeReadableViewport({
      level,
      bounds: { x: 0, y: 0, width: 10_000, height: 6_000 },
      focusBounds: { x: 4_000, y: 2_000, width: 240, height: 120 },
      viewport: quantizeGraphViewport(960, 650),
      padding: 0.12,
      maxZoom: 1.7,
    });
    expect(result.fullyFits).toBe(false);
    expect(result.viewport.zoom).toBe(floor);
    expect(result.viewport.x).not.toBe(0);
    expect(result.viewport.y).not.toBe(0);
  });

  it("fits complete small bounds without exceeding maxZoom", () => {
    const input = {
      level: "scope",
      bounds: { x: 20, y: 20, width: 600, height: 320 },
      viewport: quantizeGraphViewport(960, 650),
      padding: 0.12,
      maxZoom: 0.96,
    } as const;
    const result = computeReadableViewport(input);
    const anchoredResult = computeReadableViewport({
      ...input,
      focusBounds: { x: 8_000, y: 4_000, width: 228, height: 119 },
    });
    expect(result.fullyFits).toBe(true);
    expect(result.viewport.zoom).toBeLessThanOrEqual(0.96);
    expect(result.viewport.zoom).toBeGreaterThanOrEqual(READABLE_ZOOM_BY_LEVEL.scope);
    expect(anchoredResult).toEqual(result);
  });

  it("keeps the real desktop overview centered at the floor when padding narrowly misses readability", () => {
    const input = {
      level: "overview" as const,
      bounds: { x: 0, y: 0, width: 1_636, height: 1_032 },
      viewport: quantizeGraphViewport(1_440, 640),
      padding: 0.16,
      maxZoom: 1.12,
    };
    const centered = computeReadableViewport(input);
    const anchored = computeReadableViewport({
      ...input,
      focusBounds: { x: 48, y: 48, width: 264, height: 147 },
    });

    expect(centered.fullyFits).toBe(false);
    expect(centered.viewport.x).toBeCloseTo(278.28, 8);
    expect(centered.viewport.y).toBeCloseTo(41.36, 8);
    expect(centered.viewport.zoom).toBe(0.54);
    expect(anchored.fullyFits).toBe(false);
    expect(anchored.viewport.x).toBeCloseTo(622.8, 8);
    expect(anchored.viewport.y).toBeCloseTo(254.39, 8);
    expect(anchored.viewport.zoom).toBe(0.54);
  });
});

describe("graph node silhouettes", () => {
  it("keeps restrained distinct sizes and 44px minimum targets", () => {
    const scope = graphNodeSize("overview", graphNode("scope", "scope"));
    const cluster = graphNodeSize("scope", graphNode("cluster", "cluster"));
    const file = graphNodeSize("cluster", graphNode("file", "node", "file"));
    const symbol = graphNodeSize("file", graphNode("symbol", "node", "function"));
    expect(new Set([scope.width, cluster.width, file.width, symbol.width]).size).toBeGreaterThan(2);
    for (const size of [scope, cluster, file, symbol]) {
      expect(size.width).toBeGreaterThanOrEqual(44);
      expect(size.height).toBeGreaterThanOrEqual(44);
    }
  });

  it("budgets enough fixed node height for worst-case full and compact content", () => {
    for (const [kind, rawType] of [
      ["scope", "module"],
      ["boundary", "service"],
      ["cluster", "module"],
      ["node", "file"],
      ["node", "function"],
    ] as const) {
      const worstCase = {
        ...graphNode(`worst:${kind}:${rawType}`, kind, rawType),
        summary: "一段需要完整显示两行的节点摘要，用于验证最坏内容预算。",
        filePath: "packages/dashboard/src/components/graphExplorer/SemanticGraphCanvas.tsx",
        canDrillDown: true,
      };
      const fullBudget = graphNodeContentHeight(worstCase, "full");
      const compactBudget = graphNodeContentHeight(worstCase, "compact");
      const size = graphNodeSize("file", worstCase);

      expect(fullBudget).toBe(172);
      expect(compactBudget).toBe(130);
      expect(fullBudget).toBeGreaterThan(compactBudget);
      expect(size.height).toBeGreaterThanOrEqual(fullBudget);
      expect(size.height).toBeGreaterThanOrEqual(compactBudget);
    }
  });
});
