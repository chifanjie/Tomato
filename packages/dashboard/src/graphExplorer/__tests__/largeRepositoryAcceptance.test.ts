import { parseWikiIndexV2 } from "@understand-code/core";
import { describe, expect, it } from "vitest";
import { buildGraphExplorerView } from "../../components/graphExplorer/graphExplorerModel.js";
import { buildWikiNavigation } from "../../wiki/navigationModel.js";
import { buildWikiSearchRuntime, searchWiki } from "../../wiki/searchIndex.js";
import { buildWikiRuntimeIndex } from "../../wiki/wikiIndex.js";
import { largeRepositoryFixture } from "./largeRepositoryFixture.js";

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

  it("keeps selected and one-hop nodes after scope caps", () => {
    const fixture = largeRepositoryFixture();
    const runtime = buildWikiRuntimeIndex(fixture.wiki);
    const cappedView = buildGraphExplorerView({
      graph: fixture.graph,
      wikiIndex: runtime,
      mode: "call",
      focusNodeIds: [],
      selectedNodeId: null,
      navigation: { level: "scope", scopeId: "layer:scope:src" },
    });
    const cappedIds = new Set(cappedView.semanticGraph.nodes.map((node) => node.id));
    expect(cappedIds.has(fixture.selectedId)).toBe(false);
    expect(cappedIds.has(fixture.neighborId)).toBe(false);
    expect(cappedView.semanticGraph.presentation.hiddenNodeCount).toBeGreaterThan(0);

    const view = buildGraphExplorerView({
      graph: fixture.graph,
      wikiIndex: runtime,
      mode: "call",
      focusNodeIds: [],
      selectedNodeId: fixture.selectedId,
      navigation: { level: "scope", scopeId: "layer:scope:src" },
    });

    const ids = new Set(view.semanticGraph.nodes.map((node) => node.id));
    expect(ids.has(fixture.selectedId)).toBe(true);
    expect(ids.has(fixture.neighborId)).toBe(true);
    expect(view.semanticGraph.nodes.length).toBeLessThan(100);
  });
});
