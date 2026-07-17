import { parseWikiIndexV2 } from "@understand-code/core";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { describe, expect, it } from "vitest";
import { buildGraphExplorerView } from "../../components/graphExplorer/graphExplorerModel.js";
import { buildWikiNavigation } from "../../wiki/navigationModel.js";
import { buildWikiSearchRuntime, searchWiki } from "../../wiki/searchIndex.js";
import { buildWikiRuntimeIndex } from "../../wiki/wikiIndex.js";
import { largeRepositoryFixture } from "./largeRepositoryFixture.js";
import {
  boundaryNodeId,
  buildGraphHierarchyIndex,
  buildHierarchicalSemanticGraph,
  buildHierarchySelectionExpansion,
  graphNodePlacementClass,
  mergeHierarchySelectionExpansion,
  scopeNodeId,
  type HierarchicalSemanticGraph,
} from "../hierarchicalGraph.js";
import {
  buildGraphQuickJumpItems,
  resolveGraphNavigationIntent,
} from "../graphQuickJump.js";

describe("large repository acceptance", () => {
  it("keeps the main route bounded and every file or symbol reference reachable", () => {
    const fixture = largeRepositoryFixture();
    const parsed = parseWikiIndexV2(fixture.wiki);
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("\n")).toBe(true);

    const runtime = buildWikiRuntimeIndex(fixture.wiki);
    const navigation = buildWikiNavigation(runtime);
    const searchRuntime = buildWikiSearchRuntime([], runtime, "fallback");

    expect(fixture.graph.nodes.filter((node) => node.type === "file")).toHaveLength(277);
    expect(fixture.graph.nodes.filter((node) => node.type === "function")).toHaveLength(479);
    expect(navigation.featured.pages.length).toBeLessThanOrEqual(40);
    expect(navigation.reference.totalFiles).toBe(277);
    expect(runtime.nodeDocumentationById.size).toBe(756);

    for (const node of fixture.graph.nodes) {
      const documentation = runtime.nodeDocumentationById.get(node.id);
      expect(documentation, `missing documentation for ${node.id}`).toBeDefined();
      expect(documentation?.relation).toBe("direct");
      expect(documentation?.primaryPageId).toMatch(/^page:file-/);
      expect(navigation.reference.nodesById.get(
        `reference:file:${encodeURIComponent(node.filePath ?? "")}`,
      )?.pageId).toBe(documentation?.primaryPageId);
    }

    for (let index = 0; index < 277; index += 1) {
      const result = searchWiki(searchRuntime, `src/module-${index}.ts`, 1, 20);
      expect(
        result.groups
          .flatMap((group) => group.items)
          .some((record) => record.pageId === `page:file-${index}`),
        `reference page ${index} is not searchable by path`,
      ).toBe(true);
    }
  });

  it("keeps page-to-node documentation relations symmetric", () => {
    const fixture = largeRepositoryFixture();
    const runtime = buildWikiRuntimeIndex(fixture.wiki);

    for (const page of fixture.wiki.pages) {
      for (const nodeId of page.directNodeIds) {
        expect(
          runtime.nodeDocumentationById.get(nodeId)?.directPageIds,
          `${page.id} is missing from ${nodeId}.directPageIds`,
        ).toContain(page.id);
      }
      for (const nodeId of page.contextNodeIds) {
        expect(
          runtime.nodeDocumentationById.get(nodeId)?.contextPageIds,
          `${page.id} is missing from ${nodeId}.contextPageIds`,
        ).toContain(page.id);
      }
    }
  });

  it("keeps every ready route page directly usable", () => {
    const fixture = largeRepositoryFixture();
    const runtime = buildWikiRuntimeIndex(fixture.wiki);

    expect(fixture.wiki.mainReadiness.status).toBe("ready");
    for (const pageId of fixture.wiki.mainReadiness.routePageIds) {
      const page = runtime.pagesById.get(pageId);
      expect(page, `missing route page ${pageId}`).toBeDefined();
      expect(page?.role).toBe("featured");
      expect(page?.route).toBeDefined();
      expect(page?.directNodeIds.length, `${pageId} must explain at least one node directly`).toBeGreaterThan(0);
      expect(page?.generationStatus).toBe("complete");
      expect(["generated", "verified"]).toContain(page?.quality);
    }
  });

  it("keeps every symbol anchored to a reference destination and searchable", () => {
    const fixture = largeRepositoryFixture();
    const runtime = buildWikiRuntimeIndex(fixture.wiki);
    const navigation = buildWikiNavigation(runtime);
    const searchRuntime = buildWikiSearchRuntime([], runtime, "fallback");
    const symbols = fixture.graph.nodes.filter((node) => node.type === "function");

    expect(symbols).toHaveLength(479);
    for (const symbol of symbols) {
      const documentation = runtime.nodeDocumentationById.get(symbol.id);
      if (!documentation) throw new Error(`missing documentation for ${symbol.id}`);
      expect(documentation.primaryPageId).toMatch(/^page:file-/);
      expect(documentation.anchor).toBe(symbol.name);
      expect(navigation.reference.nodesById.get(
        `reference:file:${encodeURIComponent(symbol.filePath ?? "")}`,
      )?.pageId).toBe(documentation.primaryPageId);

      const result = searchWiki(searchRuntime, symbol.id, 1, 20);
      const record = result.groups
        .flatMap((group) => group.items)
        .find((item) => item.kind === "symbol" && item.nodeId === symbol.id);
      expect(record, `${symbol.id} is not searchable by its unique node id`).toMatchObject({
        kind: "symbol",
        nodeId: symbol.id,
        pageId: documentation.primaryPageId,
        anchor: symbol.name,
      });
    }
  });

  it("keeps a selected file and its exact neighborhood outside cluster caps without changing the base", () => {
    const fixture = largeRepositoryFixture();
    const runtime = buildWikiRuntimeIndex(fixture.wiki);
    const hierarchyIndex = buildGraphHierarchyIndex(fixture.graph);
    const scope = hierarchyIndex.scopes[0]!;
    const cluster = hierarchyIndex.clusterById.get(scope.clusterIds[0]!)!;
    const navigation = { level: "cluster" as const, scopeId: scope.id, clusterId: cluster.id };
    const cappedView = buildGraphExplorerView({
      graph: fixture.graph,
      hierarchyIndex,
      wikiIndex: runtime,
      mode: "call",
      selectedNodeId: null,
      navigation,
      materializedNodeId: null,
    });
    const cappedIds = new Set(cappedView.baseGraph.nodes.map((node) => node.id));
    const selectedId = cluster.fileIds.find((fileId) => !cappedIds.has(fileId))!;
    const oneHopIds = fixture.graph.edges.flatMap((edge) =>
      edge.source === selectedId ? [edge.target] : edge.target === selectedId ? [edge.source] : []);
    expect(selectedId).toBeDefined();
    expect(cappedView.baseGraph.presentation.hiddenNodeCount).toBeGreaterThan(0);

    const view = buildGraphExplorerView({
      graph: fixture.graph,
      hierarchyIndex,
      wikiIndex: runtime,
      mode: "call",
      selectedNodeId: selectedId,
      navigation,
      materializedNodeId: null,
    });

    const ids = new Set(view.semanticGraph.nodes.map((node) => node.id));
    expect(view.baseGraph.nodes.map((node) => node.id)).toEqual(cappedView.baseGraph.nodes.map((node) => node.id));
    expect(ids.has(selectedId)).toBe(true);
    for (const oneHopId of oneHopIds) expect(ids.has(oneHopId)).toBe(true);
    expect(view.semanticGraph.nodes.length).toBeGreaterThan(view.baseGraph.nodes.length);
    expect(view.semanticGraph.presentation).toBe(view.baseGraph.presentation);
    expect(view.selection?.primaryDirectPageId).toMatch(/^page:file-/);
    expect(view.hiddenSelectedNode).toBeNull();
  });

  it("keeps the complete repository reachable through capped progressive graph levels", () => {
    const fixture = largeRepositoryFixture();
    const runtime = buildWikiRuntimeIndex(fixture.wiki);
    const hierarchyIndex = buildGraphHierarchyIndex(fixture.graph);
    const reachable = new Set<string>();
    const memberKeys = new Set<string>();
    const fileClusterVisits = new Map<string, Set<string>>();
    const memberKey = (member: {
      source: string;
      target: string;
      type: string;
      direction: string;
      weight: number;
    }) => JSON.stringify([member.source, member.target, member.type, member.direction, member.weight]);
    const observe = (view: HierarchicalSemanticGraph): void => {
      for (const node of view.nodes) reachable.add(node.id);
      for (const edge of view.edges) {
        expect(edge.bundledCount).toBe(edge.members.length);
        for (const member of edge.members) memberKeys.add(memberKey(member));
      }
      expect(view.edges.length).toBeLessThanOrEqual(100);
    };

    for (const mode of ["architecture", "call"] as const) {
      const overview = buildHierarchicalSemanticGraph({
        graph: fixture.graph,
        hierarchyIndex,
        wikiIndex: runtime,
        mode,
        navigation: { level: "overview" },
        materializedNodeId: null,
      });
      observe(overview);
      expect(overview.nodes.filter((node) => node.kind === "scope").length).toBeLessThanOrEqual(16);
      expect(overview.nodes.filter((node) => graphNodePlacementClass(node.rawType) === "architecture-context").length)
        .toBeLessThanOrEqual(24);

      for (const scope of hierarchyIndex.scopes) {
        const scopeView = buildHierarchicalSemanticGraph({
          graph: fixture.graph,
          hierarchyIndex,
          wikiIndex: runtime,
          mode,
          navigation: { level: "scope", scopeId: scope.id },
          materializedNodeId: null,
        });
        observe(scopeView);
        expect(scopeView.nodes.filter((node) => node.kind === "cluster").length).toBeLessThanOrEqual(24);
        expect(scopeView.nodes.filter((node) => node.kind === "boundary").length).toBeLessThanOrEqual(8);

        for (const clusterId of scope.clusterIds) {
          const cluster = hierarchyIndex.clusterById.get(clusterId)!;
          const navigation = { level: "cluster" as const, scopeId: scope.id, clusterId };
          const clusterView = buildHierarchicalSemanticGraph({
            graph: fixture.graph,
            hierarchyIndex,
            wikiIndex: runtime,
            mode,
            navigation,
            materializedNodeId: null,
          });
          observe(clusterView);
          expect(clusterView.nodes.filter((node) => node.rawType === "file").length).toBeLessThanOrEqual(30);
          expect(clusterView.nodes.filter((node) => node.kind === "boundary").length).toBeLessThanOrEqual(8);
          expect(clusterView.nodes.filter((node) =>
            graphNodePlacementClass(node.rawType) === "file-leaf"
              && !hierarchyIndex.nodeLocationById.get(node.id)?.fileId).length).toBeLessThanOrEqual(12);

          for (const fileId of cluster.fileIds) {
            let parentView = clusterView;
            if (!parentView.nodes.some((node) => node.id === fileId)) {
              parentView = buildHierarchicalSemanticGraph({
                graph: fixture.graph,
                hierarchyIndex,
                wikiIndex: runtime,
                mode,
                navigation,
                materializedNodeId: fileId,
              });
              observe(parentView);
            }
            expect(parentView.nodes.map((node) => node.id)).toContain(fileId);
            const visitedClusters = fileClusterVisits.get(fileId) ?? new Set<string>();
            visitedClusters.add(clusterId);
            fileClusterVisits.set(fileId, visitedClusters);

            const fileNavigation = { level: "file" as const, scopeId: scope.id, clusterId, fileId };
            const ownedSymbols = fixture.graph.nodes.filter((node) =>
              hierarchyIndex.symbolLocationById.get(node.id)?.fileId === fileId);
            const fileView = buildHierarchicalSemanticGraph({
              graph: fixture.graph,
              hierarchyIndex,
              wikiIndex: runtime,
              mode,
              navigation: fileNavigation,
              materializedNodeId: null,
            });
            observe(fileView);
            expect(fileView.nodes.length).toBeLessThanOrEqual(38);
            for (const symbol of ownedSymbols) {
              let symbolView = fileView;
              if (!symbolView.nodes.some((node) => node.id === symbol.id)) {
                symbolView = buildHierarchicalSemanticGraph({
                  graph: fixture.graph,
                  hierarchyIndex,
                  wikiIndex: runtime,
                  mode,
                  navigation: fileNavigation,
                  materializedNodeId: symbol.id,
                });
                observe(symbolView);
              }
              expect(symbolView.nodes.map((node) => node.id)).toContain(symbol.id);
            }
          }

          for (const nodeId of cluster.nodeIds) {
            const node = hierarchyIndex.nodeById.get(nodeId)!;
            const location = hierarchyIndex.nodeLocationById.get(nodeId)!;
            if (node.type === "file" || location.fileId || graphNodePlacementClass(node.type) !== "file-leaf") continue;
            if (clusterView.nodes.some((candidate) => candidate.id === nodeId)) continue;
            const materialized = buildHierarchicalSemanticGraph({
              graph: fixture.graph,
              hierarchyIndex,
              wikiIndex: runtime,
              mode,
              navigation,
              materializedNodeId: nodeId,
            });
            observe(materialized);
            expect(materialized.nodes.map((candidate) => candidate.id)).toContain(nodeId);
          }
        }
      }

      for (const node of fixture.graph.nodes.filter((candidate) =>
        graphNodePlacementClass(candidate.type) === "architecture-context")) {
        if (reachable.has(node.id)) continue;
        const location = hierarchyIndex.nodeLocationById.get(node.id)!;
        const materialized = buildHierarchicalSemanticGraph({
          graph: fixture.graph,
          hierarchyIndex,
          wikiIndex: runtime,
          mode,
          navigation: location.scopeId
            ? { level: "scope", scopeId: location.scopeId }
            : { level: "overview" },
          materializedNodeId: node.id,
        });
        observe(materialized);
        expect(materialized.nodes.map((candidate) => candidate.id)).toContain(node.id);
      }
    }

    const expectedReachable = new Set<string>([
      ...hierarchyIndex.scopes.map((scope) => scopeNodeId(scope.id)),
      ...hierarchyIndex.clusterById.keys(),
      ...fixture.graph.nodes.map((node) => node.id),
    ]);
    for (const edge of fixture.graph.edges) {
      const sourceScope = hierarchyIndex.nodeLocationById.get(edge.source)?.scopeId;
      const targetScope = hierarchyIndex.nodeLocationById.get(edge.target)?.scopeId;
      if (sourceScope && targetScope && sourceScope !== targetScope) {
        expectedReachable.add(boundaryNodeId(sourceScope, targetScope));
        expectedReachable.add(boundaryNodeId(targetScope, sourceScope));
      }
      expect(memberKeys, `missing raw edge ${memberKey(edge)}`).toContain(memberKey(edge));
    }
    expect([...reachable].sort()).toEqual([...expectedReachable].sort());
    expect([...fileClusterVisits.entries()].every(([, clusters]) => clusters.size === 1)).toBe(true);
    expect(fileClusterVisits.size).toBe(277);
  });

  it("makes every hierarchy object reachable through a deterministic Quick Jump intent", () => {
    const { graph } = largeRepositoryFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const quickItems = buildGraphQuickJumpItems({ graph, hierarchyIndex });
    const reachableIds = new Set(quickItems.map((item) => item.id));
    const expectedBoundaryIds = new Set<string>();
    for (const edge of graph.edges) {
      const sourceScope = hierarchyIndex.nodeLocationById.get(edge.source)?.scopeId;
      const targetScope = hierarchyIndex.nodeLocationById.get(edge.target)?.scopeId;
      if (!sourceScope || !targetScope || sourceScope === targetScope) continue;
      expectedBoundaryIds.add(boundaryNodeId(sourceScope, targetScope));
      expectedBoundaryIds.add(boundaryNodeId(targetScope, sourceScope));
    }
    expect(new Set(
      quickItems.filter((item) => item.kind === "boundary").map((item) => item.id),
    )).toEqual(expectedBoundaryIds);
    expect([...hierarchyIndex.scopeById.keys()].every((id) => reachableIds.has(scopeNodeId(id)))).toBe(true);
    expect([...hierarchyIndex.clusterById.keys()].every((id) => reachableIds.has(id))).toBe(true);
    expect(graph.nodes.every((node) => reachableIds.has(node.id))).toBe(true);
    for (const item of quickItems) {
      const intent = resolveGraphNavigationIntent({
        objectId: item.id,
        source: "quick-jump",
        graph,
        hierarchyIndex,
      });
      expect(intent).toEqual(item.intent);
      if (!intent) throw new Error(`missing intent for ${item.id}`);
      const baseGraph = buildHierarchicalSemanticGraph({
        graph,
        hierarchyIndex,
        mode: "architecture",
        navigation: intent.navigation,
        materializedNodeId: intent.materializedNodeId,
      });
      expect(baseGraph.nodes.some((node) => node.id === intent.materializedNodeId)).toBe(true);
      const expansion = buildHierarchySelectionExpansion({
        graph,
        hierarchyIndex,
        baseGraph,
        mode: "architecture",
        selectedNodeId: intent.selectionId,
      });
      const rendered = mergeHierarchySelectionExpansion(baseGraph, expansion);
      expect(rendered.nodes.some((node) => node.id === intent.selectionId)).toBe(true);
      expect(rendered.presentation.breadcrumbs.map((item) => item.level) as string[])
        .not.toContain("symbol");
    }
  });

  it("materializes a call-only boundary before selection without leaking a calls edge in architecture mode", () => {
    const graph: KnowledgeGraph = {
      version: "1.0.0",
      project: {
        name: "boundary-quick-jump",
        languages: ["typescript"],
        frameworks: [],
        description: "边界快速定位夹具。",
        analyzedAt: "2026-07-17T00:00:00.000Z",
        gitCommitHash: "fixture",
      },
      nodes: [
        {
          id: "file:app.ts", type: "file", name: "app.ts", filePath: "app.ts",
          summary: "应用。", tags: [], complexity: "simple",
        },
        {
          id: "file:lib.ts", type: "file", name: "lib.ts", filePath: "lib.ts",
          summary: "库。", tags: [], complexity: "simple",
        },
      ],
      edges: [{
        source: "file:app.ts", target: "file:lib.ts", type: "calls",
        direction: "backward", weight: 1,
      }],
      layers: [
        { id: "app", name: "应用", description: "应用。", nodeIds: ["file:app.ts"] },
        { id: "lib", name: "库", description: "库。", nodeIds: ["file:lib.ts"] },
      ],
      tour: [],
    };
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const appScopeId = hierarchyIndex.nodeLocationById.get("file:app.ts")!.scopeId;
    const libScopeId = hierarchyIndex.nodeLocationById.get("file:lib.ts")!.scopeId;
    for (const [currentScopeId, targetScopeId] of [[appScopeId, libScopeId], [libScopeId, appScopeId]] as const) {
      const portalId = boundaryNodeId(currentScopeId, targetScopeId);
      const intent = resolveGraphNavigationIntent({
        objectId: portalId,
        source: "quick-jump",
        graph,
        hierarchyIndex,
      });
      expect(intent).not.toBeNull();
      if (!intent) throw new Error("missing boundary intent");

      const baseGraph = buildHierarchicalSemanticGraph({
        graph,
        hierarchyIndex,
        mode: "architecture",
        navigation: intent.navigation,
        materializedNodeId: intent.materializedNodeId,
      });
      const boundary = baseGraph.nodes.find((node) => node.id === intent.materializedNodeId);
      expect(boundary?.relationCount).toBe(1);
      expect(baseGraph.edges.flatMap((edge) => edge.members).some((member) => member.type === "calls")).toBe(false);

      const expansion = buildHierarchySelectionExpansion({
        graph,
        hierarchyIndex,
        baseGraph,
        mode: "architecture",
        selectedNodeId: intent.selectionId,
      });
      const rendered = mergeHierarchySelectionExpansion(baseGraph, expansion);
      expect(rendered.nodes.some((node) => node.id === portalId)).toBe(true);
      expect(rendered.nodes.find((node) => node.id === portalId)?.relationCount).toBe(1);
      expect(rendered.edges.flatMap((edge) => edge.members).some((member) => member.type === "calls")).toBe(false);
    }
  });
});
