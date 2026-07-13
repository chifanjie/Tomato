import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildHierarchicalSemanticGraph } from "../../../graphExplorer/hierarchicalGraph";
import {
  aggregateCoverageFixture,
  graphFixture,
  graphWithFiftyNodes,
  graphWithStructuralOnly,
  importsOnlyGraphFixture,
  wikiRuntimeFixture,
} from "../../../graphExplorer/__tests__/graphFixtures";
import { buildSemanticGraphModel } from "../../../graphExplorer/semanticGraph";
import { buildWikiRuntimeIndex } from "../../../wiki/wikiIndex";
import {
  availableGraphModes,
  buildGraphExplorerView,
  buildGraphSelectionDetails,
  coverageBadgeForNode,
  directionalEndpointPairs,
  graphLayoutRevision,
  normalizeGraphModeForOptions,
} from "../graphExplorerModel";
import GraphCoverageLegend from "../GraphCoverageLegend";
import GraphModeToolbar from "../GraphModeToolbar";

describe("graphExplorerModel", () => {
  it("derives a deterministic layout revision from the graph structure", () => {
    const graph = graphFixture();
    const reordered = {
      ...graph,
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
      layers: graph.layers.map((layer) => ({ ...layer, nodeIds: [...layer.nodeIds].reverse() })).reverse(),
    };
    expect(graphLayoutRevision(reordered)).toBe(graphLayoutRevision(graph));

    const changed = {
      ...graph,
      edges: [...graph.edges, {
        source: graph.nodes[0]!.id,
        target: graph.nodes.at(-1)!.id,
        type: "depends_on" as const,
        direction: "forward" as const,
        weight: 1,
      }],
    };
    expect(graphLayoutRevision(changed)).not.toBe(graphLayoutRevision(graph));
  });

  it("builds aggregate details without requiring a raw graph node", () => {
    const fixture = aggregateCoverageFixture();
    const semanticGraph = buildHierarchicalSemanticGraph({
      graph: fixture.graph,
      wikiIndex: fixture.wikiIndex,
      mode: "architecture",
      focusNodeIds: [],
      selectedNodeId: "scope:layer:core",
      navigation: { level: "overview" },
    });

    expect(buildGraphSelectionDetails({
      graph: fixture.graph,
      semanticGraph,
      selectedObjectId: "scope:layer:core",
    })).toMatchObject({
      kind: "aggregate",
      id: "scope:layer:core",
      responsibility: expect.stringContaining("核心"),
      documentationCounts: { direct: 8, context: 1, none: 1, problem: 0, total: 10 },
      primaryDirectPageId: "page:coverage:0",
      drillTarget: { kind: "scope", scopeId: "layer:core" },
    });
  });

  it("keeps exact direct pages, context pages, and evidence for a raw selection", () => {
    const graph = graphFixture();
    const wikiIndex = wikiRuntimeFixture();
    const semanticGraph = buildHierarchicalSemanticGraph({
      graph,
      wikiIndex,
      mode: "coverage",
      focusNodeIds: [],
      selectedNodeId: "function:src/a.ts:run",
      navigation: { level: "scope", scopeId: "layer:core" },
    });

    const details = buildGraphSelectionDetails({
      graph,
      semanticGraph,
      selectedObjectId: "function:src/a.ts:run",
    });

    expect(details).toMatchObject({
      kind: "raw",
      id: "function:src/a.ts:run",
      primaryDirectPageId: "page:run",
      drillTarget: null,
    });
    expect(details?.directPages.map((page) => page.id)).toEqual(["page:run"]);
    expect(details?.contextPages.map((page) => page.id)).toEqual(["page:overview"]);
    expect(details?.evidence.map((item) => item.id)).toEqual(["evidence:run"]);
    expect(details?.upstream.map((node) => node.id)).toEqual(["file:src/a.ts"]);
    expect(details?.downstream).toEqual([]);
  });

  it("preserves a hidden raw selection while exposing no stale details", () => {
    const view = buildGraphExplorerView({
      graph: graphFixture(),
      wikiIndex: wikiRuntimeFixture(),
      mode: "architecture",
      focusNodeIds: [],
      selectedNodeId: "function:src/a.ts:run",
      navigation: { level: "overview" },
    });

    expect(view.selection).toBeNull();
    expect(view.hiddenSelectedNode?.id).toBe("function:src/a.ts:run");
    expect(view.semanticGraph.nodes.map((node) => node.id)).toEqual(["scope:layer:core"]);
  });

  it("returns no details when nothing is selected", () => {
    const graph = graphFixture();
    const semanticGraph = buildHierarchicalSemanticGraph({
      graph,
      wikiIndex: wikiRuntimeFixture(),
      mode: "coverage",
      focusNodeIds: [],
      selectedNodeId: null,
      navigation: { level: "overview" },
    });

    expect(buildGraphSelectionDetails({ graph, semanticGraph, selectedObjectId: null })).toBeNull();
  });

  it("derives truthful graph modes from observed edges and V2 documentation", () => {
    const wikiIndex = wikiRuntimeFixture();

    expect(availableGraphModes(importsOnlyGraphFixture(), wikiIndex)).toEqual([
      { id: "architecture", label: "架构总览", relationshipSource: null },
      { id: "call", label: "文件依赖", relationshipSource: "imports" },
      { id: "coverage", label: "文档覆盖", relationshipSource: null },
    ]);
    expect(availableGraphModes(graphWithStructuralOnly(), wikiIndex)).toEqual([
      { id: "architecture", label: "架构总览", relationshipSource: null },
      { id: "coverage", label: "文档覆盖", relationshipSource: null },
    ]);
    expect(availableGraphModes(graphWithStructuralOnly(), buildWikiRuntimeIndex(null)).map(({ id }) => id)).toEqual([
      "architecture",
    ]);
    expect(availableGraphModes(graphWithFiftyNodes(), buildWikiRuntimeIndex(null))).toEqual([
      { id: "architecture", label: "架构总览", relationshipSource: null },
      { id: "call", label: "调用关系", relationshipSource: "calls" },
    ]);
  });

  it("normalizes an unavailable stored mode and removes fallback notices", () => {
    const graph = importsOnlyGraphFixture();
    const wikiIndex = buildWikiRuntimeIndex(null);
    const options = availableGraphModes(graph, wikiIndex);

    expect(normalizeGraphModeForOptions("coverage", options)).toBe("architecture");
    expect(normalizeGraphModeForOptions("call", options)).toBe("call");
    expect(buildGraphExplorerView({
      graph,
      wikiIndex,
      mode: "call",
      focusNodeIds: [],
      selectedNodeId: null,
      navigation: { level: "overview" },
    }).semanticGraph.presentation.notice).toBeNull();
  });

  it("renders only the supplied Chinese mode labels and the V2 coverage legend", () => {
    const toolbar = renderToStaticMarkup(createElement(GraphModeToolbar, {
      mode: "call",
      options: [
        { id: "architecture", label: "架构总览", relationshipSource: null },
        { id: "call", label: "文件依赖", relationshipSource: "imports" },
      ],
      onChangeMode: vi.fn(),
    }));
    const legend = renderToStaticMarkup(createElement(GraphCoverageLegend));

    expect(toolbar).toContain("架构总览");
    expect(toolbar).toContain("文件依赖");
    expect(toolbar).not.toContain("Global");
    expect(toolbar).not.toContain("Coverage");
    expect(legend).toContain("有专门正文");
    expect(legend).toContain("仅相关资料");
    expect(legend).toContain("待补正文");
    expect(legend).toContain("生成或证据异常");
  });

  it("describes raw and aggregate documentation with compact truthful badges", () => {
    const aggregateFixture = aggregateCoverageFixture();
    const aggregateGraph = buildHierarchicalSemanticGraph({
      graph: aggregateFixture.graph,
      wikiIndex: aggregateFixture.wikiIndex,
      mode: "architecture",
      focusNodeIds: [],
      selectedNodeId: null,
      navigation: { level: "overview" },
    });
    const rawGraph = buildSemanticGraphModel({
      graph: graphFixture(),
      wikiIndex: wikiRuntimeFixture(),
      mode: "global",
      focusNodeIds: [],
    });

    expect(coverageBadgeForNode(aggregateGraph.nodes[0])).toEqual({
      label: "8/10 有正文",
      relation: "direct",
      problem: false,
    });
    expect(coverageBadgeForNode(rawGraph.nodes.find((node) => node.id === "function:src/a.ts:run")!)).toEqual({
      label: "有专门正文",
      relation: "direct",
      problem: false,
    });
    expect(coverageBadgeForNode(rawGraph.nodes.find((node) => node.id === "file:context-only.ts")!)).toEqual({
      label: "仅相关资料",
      relation: "context",
      problem: false,
    });
  });

  it("normalizes backwards and bidirectional edge endpoints", () => {
    expect(directionalEndpointPairs({ source: "a", target: "b", directions: ["backward"] })).toEqual([
      { source: "b", target: "a" },
    ]);
    expect(directionalEndpointPairs({ source: "a", target: "b", directions: ["bidirectional"] })).toEqual([
      { source: "a", target: "b" },
      { source: "b", target: "a" },
    ]);
    expect(directionalEndpointPairs({ source: "a", target: "b", directions: ["forward", "backward"] })).toEqual([
      { source: "a", target: "b" },
      { source: "b", target: "a" },
    ]);
  });
});
