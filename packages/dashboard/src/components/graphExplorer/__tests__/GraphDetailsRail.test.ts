import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WikiPageV2 } from "@understand-code/core/knowledge-base";
import type { GraphNode } from "@understand-code/core/types";
import { useDashboardStore } from "../../../store";
import type { WikiTarget } from "../../../wiki/wikiContent";
import * as GraphDetailsRailModule from "../GraphDetailsRail";
import type { GraphExplorerView } from "../graphExplorerModel";

type OpenLinkedWikiForNode = (
  nodeId: string,
  openWikiForGraphNode: (nodeId: string) => WikiTarget | null,
  browser: {
    location: { pathname: string; search: string };
    history: { pushState: (data: unknown, unused: string, url?: string | URL | null) => void };
  } | null,
) => WikiTarget | null;

const openLinkedWikiForNode = (
  GraphDetailsRailModule as unknown as {
    openLinkedWikiForNode?: OpenLinkedWikiForNode;
  }
).openLinkedWikiForNode;

const directNode: GraphNode = {
  id: "function:src/a.ts:run",
  type: "function",
  name: "run",
  filePath: "src/a.ts",
  lineRange: [1, 3],
  summary: "Runs the core flow.",
  tags: [],
  complexity: "moderate",
};

const contextNode: GraphNode = {
  id: "function:src/context.ts:helper",
  type: "function",
  name: "helper",
  filePath: "src/context.ts",
  lineRange: [4, 8],
  summary: "Provides background context.",
  tags: [],
  complexity: "simple",
};

const page: WikiPageV2 = {
  id: "page:file-a",
  title: "a.ts 文件参考",
  summary: "记录 a.ts 中的实现入口。",
  markdownPath: "knowledge-base/参考/文件/src/a.ts.md",
  role: "reference",
  category: "file",
  quality: "generated",
  generationStatus: "complete",
  directNodeIds: [directNode.id],
  contextNodeIds: [contextNode.id],
  evidenceIds: [],
  searchTerms: ["src/a.ts"],
};

function viewFor(node: GraphNode, hidden = false): GraphExplorerView {
  return {
    semanticGraph: { nodes: [], edges: [] },
    selectedNode: hidden ? null : node,
    selectedNodeVisible: !hidden,
    hiddenSelectedNode: hidden ? node : null,
    selectedSemanticNode: null,
    selectedCoverage: hidden ? null : { status: "complete", pages: [page] },
    selectedPages: [page],
    canOpenWiki: true,
  };
}

function renderRail(view: GraphExplorerView): string {
  return renderToStaticMarkup(createElement(GraphDetailsRailModule.default, { view }));
}

function setGraphWikiNotice(notice: string | null): void {
  useDashboardStore.setState({ graphWikiNotice: notice });
  // Zustand intentionally uses getInitialState() as the server snapshot.
  useDashboardStore.getInitialState().graphWikiNotice = notice;
}

beforeEach(() => {
  setGraphWikiNotice(null);
});

afterEach(() => {
  setGraphWikiNotice(null);
});

describe("GraphDetailsRail Wiki navigation", () => {
  it("writes the canonical direct page and anchor only after the store returns a destination", () => {
    expect(openLinkedWikiForNode).toBeTypeOf("function");
    if (!openLinkedWikiForNode) return;
    let currentUrl = "/graph?token=abc#graph";
    const pushState = vi.fn((_data: unknown, _unused: string, url?: string | URL | null) => {
      currentUrl = String(url);
    });
    const openWikiForGraphNode = vi.fn(() => ({ pageId: "page:file-a", anchor: "run" }));

    const destination = openLinkedWikiForNode(
      directNode.id,
      openWikiForGraphNode,
      {
        location: { pathname: "/graph", search: "?token=abc" },
        history: { pushState },
      },
    );

    expect(openWikiForGraphNode).toHaveBeenCalledWith(directNode.id);
    expect(destination).toEqual({ pageId: "page:file-a", anchor: "run" });
    expect(pushState).toHaveBeenCalledOnce();
    expect(currentUrl).toBe("/graph?token=abc#wiki=page%3Afile-a&anchor=run");
  });

  it("leaves the URL untouched when a context-only node has no direct destination", () => {
    expect(openLinkedWikiForNode).toBeTypeOf("function");
    if (!openLinkedWikiForNode) return;
    let currentUrl = "/graph?token=abc#graph";
    const pushState = vi.fn((_data: unknown, _unused: string, url?: string | URL | null) => {
      currentUrl = String(url);
    });
    const openWikiForGraphNode = vi.fn(() => null);

    const destination = openLinkedWikiForNode(
      contextNode.id,
      openWikiForGraphNode,
      {
        location: { pathname: "/graph", search: "?token=abc" },
        history: { pushState },
      },
    );

    expect(openWikiForGraphNode).toHaveBeenCalledWith(contextNode.id);
    expect(destination).toBeNull();
    expect(pushState).not.toHaveBeenCalled();
    expect(currentUrl).toBe("/graph?token=abc#graph");
  });

  it("renders the context-only notice beside the visible selection Wiki control", () => {
    setGraphWikiNotice("暂无专门正文");

    const html = renderRail(viewFor(contextNode));

    expect(html).toContain(`data-wiki-node-id="${contextNode.id}"`);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("暂无专门正文");
  });

  it("uses the same linked-Wiki path and notice for a hidden selection", () => {
    setGraphWikiNotice("暂无专门正文");

    const html = renderRail(viewFor(contextNode, true));

    expect(html).toContain("Selection hidden");
    expect(html).toContain(`data-wiki-node-id="${contextNode.id}"`);
    expect(html).toContain("Open linked wiki");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("暂无专门正文");
  });

  it("does not render a live region when there is no graph-to-Wiki notice", () => {
    const html = renderRail(viewFor(directNode));

    expect(html).toContain(`data-wiki-node-id="${directNode.id}"`);
    expect(html).not.toContain('aria-live="polite"');
    expect(html).not.toContain("暂无专门正文");
  });
});
