// @vitest-environment happy-dom

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
  onSelectWikiTarget: (target: WikiTarget) => unknown,
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
  return renderToStaticMarkup(createElement(GraphDetailsRailModule.default, {
    view,
    onSelectWikiTarget: vi.fn(),
  }));
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
  vi.restoreAllMocks();
});

describe("GraphDetailsRail Wiki navigation", () => {
  it("delegates a direct destination to the App owner without writing browser history", () => {
    expect(openLinkedWikiForNode).toBeTypeOf("function");
    if (!openLinkedWikiForNode) return;
    const pushState = vi.spyOn(window.history, "pushState");
    const openWikiForGraphNode = vi.fn(() => ({ pageId: "page:file-a", anchor: "run" }));
    const onSelectWikiTarget = vi.fn();

    const destination = openLinkedWikiForNode(
      directNode.id,
      openWikiForGraphNode,
      onSelectWikiTarget,
    );

    expect(openWikiForGraphNode).toHaveBeenCalledWith(directNode.id);
    expect(destination).toEqual({ pageId: "page:file-a", anchor: "run" });
    expect(onSelectWikiTarget).toHaveBeenCalledWith({ pageId: "page:file-a", anchor: "run" });
    expect(pushState).not.toHaveBeenCalled();
  });

  it("does not call the App owner or browser history when no direct destination exists", () => {
    expect(openLinkedWikiForNode).toBeTypeOf("function");
    if (!openLinkedWikiForNode) return;
    const pushState = vi.spyOn(window.history, "pushState");
    const openWikiForGraphNode = vi.fn(() => null);
    const onSelectWikiTarget = vi.fn();

    const destination = openLinkedWikiForNode(
      contextNode.id,
      openWikiForGraphNode,
      onSelectWikiTarget,
    );

    expect(openWikiForGraphNode).toHaveBeenCalledWith(contextNode.id);
    expect(destination).toBeNull();
    expect(onSelectWikiTarget).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
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
