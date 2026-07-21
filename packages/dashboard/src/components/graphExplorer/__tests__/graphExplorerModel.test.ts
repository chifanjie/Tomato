import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  buildGraphHierarchyIndex,
  buildHierarchicalSemanticGraph,
  mergeHierarchySelectionExpansion,
  scopeNodeId,
} from "../../../graphExplorer/hierarchicalGraph";
import {
  aggregateCoverageFixture,
  graphFixture,
  graphWithDenseSelection,
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
      layers: graph.layers.map((layer) => ({ ...layer, nodeIds: [...layer.nodeIds].reverse() })),
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

  it("versions every structural graph fact while excluding prose-only metadata", () => {
    const graph = graphFixture();
    const revision = graphLayoutRevision(graph);
    const proseOnly = {
      ...graph,
      nodes: graph.nodes.map((node) => ({
        ...node,
        name: `renamed ${node.id}`,
        summary: `rewritten ${node.id}`,
      })),
      layers: graph.layers.map((layer) => ({
        ...layer,
        name: `renamed ${layer.id}`,
        description: `rewritten ${layer.id}`,
      })),
    };
    expect(graphLayoutRevision(proseOnly)).toBe(revision);

    const structuralVariants = [
      { ...graph, version: `${graph.version}:next` },
      { ...graph, kind: "knowledge" as const },
      { ...graph, nodes: graph.nodes.map((node, index) => index === 0 ? { ...node, id: `${node.id}:next` } : node) },
      { ...graph, nodes: graph.nodes.map((node, index) => index === 0 ? { ...node, type: "config" as const } : node) },
      { ...graph, nodes: graph.nodes.map((node, index) => index === 0 ? { ...node, filePath: "changed/path.ts" } : node) },
      { ...graph, edges: graph.edges.map((edge, index) => index === 0 ? { ...edge, source: graph.nodes.at(-1)!.id } : edge) },
      { ...graph, edges: graph.edges.map((edge, index) => index === 0 ? { ...edge, target: graph.nodes[0]!.id } : edge) },
      { ...graph, edges: graph.edges.map((edge, index) => index === 0 ? { ...edge, type: "calls" as const } : edge) },
      { ...graph, edges: graph.edges.map((edge, index) => index === 0 ? { ...edge, direction: "backward" as const } : edge) },
      { ...graph, edges: graph.edges.map((edge, index) => index === 0 ? { ...edge, weight: 0.25 } : edge) },
      { ...graph, layers: graph.layers.map((layer, index) => index === 0
        ? { ...layer, id: `${layer.id}:next` }
        : layer) },
      { ...graph, layers: graph.layers.map((layer, index) => index === 0
        ? { ...layer, nodeIds: layer.nodeIds.slice(1) }
        : layer) },
    ];
    for (const variant of structuralVariants) {
      expect(graphLayoutRevision(variant)).not.toBe(revision);
    }

    const orderedLayers = {
      ...graph,
      layers: [{
        id: "first",
        name: "第一层",
        description: "第一层",
        nodeIds: [graph.nodes[0]!.id],
      }, {
        id: "second",
        name: "第二层",
        description: "第二层",
        nodeIds: [graph.nodes[1]!.id],
      }],
    };
    expect(graphLayoutRevision({ ...orderedLayers, layers: [...orderedLayers.layers].reverse() }))
      .not.toBe(graphLayoutRevision(orderedLayers));
  });

  it("builds aggregate details without requiring a raw graph node", () => {
    const fixture = aggregateCoverageFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(fixture.graph);
    const semanticGraph = buildHierarchicalSemanticGraph({
      graph: fixture.graph,
      hierarchyIndex,
      wikiIndex: fixture.wikiIndex,
      mode: "architecture",
      navigation: { level: "overview" },
      materializedNodeId: null,
    });

    const selectedScopeId = scopeNodeId("layer:core");
    expect(buildGraphSelectionDetails({
      graph: fixture.graph,
      semanticGraph,
      selectedObjectId: selectedScopeId,
    })).toMatchObject({
      kind: "aggregate",
      id: selectedScopeId,
      responsibility: expect.stringContaining("核心"),
      documentationCounts: { direct: 8, context: 1, none: 1, problem: 0, total: 10 },
      primaryDirectPageId: "page:coverage:0",
      drillTarget: { kind: "scope", scopeId: "layer:core" },
    });
  });

  it("returns exact scope, cluster, file, and symbol drill targets", () => {
    const graph = graphFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const location = hierarchyIndex.fileLocationById.get("file:src/a.ts")!;
    const cluster = hierarchyIndex.clusterById.get(location.clusterId)!;
    const build = (
      navigation: Parameters<typeof buildHierarchicalSemanticGraph>[0]["navigation"],
      selectedObjectId: string,
    ) => buildGraphSelectionDetails({
      graph,
      semanticGraph: buildHierarchicalSemanticGraph({
        graph,
        hierarchyIndex,
        wikiIndex: wikiRuntimeFixture(),
        mode: "architecture",
        navigation,
        materializedNodeId: selectedObjectId,
      }),
      selectedObjectId,
    });

    expect(build({ level: "overview" }, scopeNodeId(location.scopeId))?.drillTarget).toEqual({
      kind: "scope",
      scopeId: location.scopeId,
    });
    expect(build({ level: "scope", scopeId: location.scopeId }, cluster.id)?.drillTarget).toEqual({
      kind: "cluster",
      scopeId: location.scopeId,
      clusterId: cluster.id,
    });
    expect(build({
      level: "cluster",
      scopeId: location.scopeId,
      clusterId: cluster.id,
    }, "file:src/a.ts")?.drillTarget).toEqual({
      kind: "file",
      scopeId: location.scopeId,
      clusterId: cluster.id,
      fileId: "file:src/a.ts",
    });
    expect(build({
      level: "file",
      scopeId: location.scopeId,
      clusterId: cluster.id,
      fileId: "file:src/a.ts",
    }, "function:src/a.ts:run")?.drillTarget).toBeNull();
  });

  it("keeps exact direct pages, context pages, and evidence for a raw selection", () => {
    const graph = graphFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const wikiIndex = wikiRuntimeFixture();
    const location = hierarchyIndex.fileLocationById.get("file:src/a.ts")!;
    const semanticGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      wikiIndex,
      mode: "coverage",
      navigation: { level: "file", ...location },
      materializedNodeId: null,
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
    const graph = graphFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const view = buildGraphExplorerView({
      graph,
      hierarchyIndex,
      wikiIndex: wikiRuntimeFixture(),
      mode: "architecture",
      selectedNodeId: "function:src/a.ts:run",
      navigation: { level: "overview" },
      materializedNodeId: null,
    });

    expect(view.selection).toBeNull();
    expect(view.hiddenSelectedNode?.id).toBe("function:src/a.ts:run");
    expect(view.semanticGraph.nodes.map((node) => node.id)).toEqual([scopeNodeId("layer:core")]);
  });

  it("builds selection details from the merged dense neighborhood without changing the base", () => {
    const graph = graphWithDenseSelection(110);
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const location = hierarchyIndex.fileLocationById.get("file:src/dense.ts")!;
    const view = buildGraphExplorerView({
      graph,
      hierarchyIndex,
      wikiIndex: buildWikiRuntimeIndex(null),
      mode: "call",
      selectedNodeId: "function:dense:selected",
      navigation: { level: "file", ...location },
      materializedNodeId: null,
    });

    expect(view.baseGraph.nodes.map((node) => node.id)).not.toContain("function:dense:selected");
    expect(view.semanticGraph).toEqual(mergeHierarchySelectionExpansion(
      view.baseGraph,
      view.selectionExpansion,
    ));
    expect(view.semanticGraph.presentation).toBe(view.baseGraph.presentation);
    expect(view.selection?.id).toBe("function:dense:selected");
    expect(view.selection?.upstream.map((node) => node.id)).toEqual(["file:src/dense.ts"]);
    expect(view.selection?.downstream).toHaveLength(110);
    expect(view.hiddenSelectedNode).toBeNull();
  });

  it("preserves wiki metadata for a synthesized capped node and does not conflate materialization", () => {
    const original = graphFixture();
    const padding = Array.from({ length: 45 }, (_, index) => ({
      id: `function:000-padding-${String(index).padStart(2, "0")}`,
      type: "function" as const,
      name: `padding${index}`,
      filePath: "src/a.ts",
      lineRange: [100 + index, 100 + index] as [number, number],
      summary: "Padding symbol.",
      tags: [],
      complexity: "simple" as const,
    }));
    const graph = {
      ...original,
      nodes: [...original.nodes, ...padding],
      edges: [
        ...original.edges,
        ...padding.map((node) => ({
          source: "file:src/a.ts",
          target: node.id,
          type: "contains" as const,
          direction: "forward" as const,
          weight: 1,
        })),
      ],
    };
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const location = hierarchyIndex.fileLocationById.get("file:src/a.ts")!;
    const wikiIndex = wikiRuntimeFixture();
    const selectedView = buildGraphExplorerView({
      graph,
      hierarchyIndex,
      wikiIndex,
      mode: "coverage",
      selectedNodeId: "function:src/a.ts:run",
      navigation: { level: "file", ...location },
      materializedNodeId: null,
    });
    const materializedOnly = buildGraphExplorerView({
      graph,
      hierarchyIndex,
      wikiIndex,
      mode: "coverage",
      selectedNodeId: null,
      navigation: { level: "file", ...location },
      materializedNodeId: "function:src/a.ts:run",
    });

    expect(selectedView.baseGraph.nodes.map((node) => node.id)).not.toContain("function:src/a.ts:run");
    expect(selectedView.selectionExpansion.nodes.find((node) => node.id === "function:src/a.ts:run")?.docs)
      .toMatchObject({ relation: "direct", directPageIds: ["page:run"] });
    expect(selectedView.selection?.primaryDirectPageId).toBe("page:run");
    expect(selectedView.hiddenSelectedNode).toBeNull();
    expect(materializedOnly.baseGraph.nodes.map((node) => node.id)).toContain("function:src/a.ts:run");
    expect(materializedOnly.selectionExpansion).toEqual({ nodes: [], edges: [] });
    expect(materializedOnly.selection).toBeNull();
  });

  it("returns no details when nothing is selected", () => {
    const graph = graphFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const semanticGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      wikiIndex: wikiRuntimeFixture(),
      mode: "coverage",
      navigation: { level: "overview" },
      materializedNodeId: null,
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

  it("normalizes an unavailable stored mode and preserves base fallback notices", () => {
    const graph = importsOnlyGraphFixture();
    const wikiIndex = buildWikiRuntimeIndex(null);
    const options = availableGraphModes(graph, wikiIndex);

    expect(normalizeGraphModeForOptions("coverage", options)).toBe("architecture");
    expect(normalizeGraphModeForOptions("call", options)).toBe("call");
    expect(buildGraphExplorerView({
      graph,
      hierarchyIndex: buildGraphHierarchyIndex(graph),
      wikiIndex,
      mode: "call",
      selectedNodeId: null,
      navigation: { level: "overview" },
      materializedNodeId: null,
    }).semanticGraph.presentation.notice).toContain("自动降级为文件导入关系");
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
    expect(toolbar).toContain("min-h-11");
    expect(toolbar).not.toContain("Global");
    expect(toolbar).not.toContain("Coverage");
    expect(legend).toContain("有专门正文");
    expect(legend).toContain("仅相关资料");
    expect(legend).toContain("待补正文");
    expect(legend).toContain("生成或证据异常");
    expect(legend).toContain("--color-graph-status-direct");
    expect(legend).toContain("--color-graph-status-context");
    expect(legend).toContain("--color-graph-status-missing");
    expect(legend).toContain("--color-graph-status-problem");
    expect(legend).not.toContain("--color-node-");
  });

  it("describes raw and aggregate documentation with compact truthful badges", () => {
    const aggregateFixture = aggregateCoverageFixture();
    const aggregateHierarchy = buildGraphHierarchyIndex(aggregateFixture.graph);
    const aggregateGraph = buildHierarchicalSemanticGraph({
      graph: aggregateFixture.graph,
      hierarchyIndex: aggregateHierarchy,
      wikiIndex: aggregateFixture.wikiIndex,
      mode: "architecture",
      navigation: { level: "overview" },
      materializedNodeId: null,
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
