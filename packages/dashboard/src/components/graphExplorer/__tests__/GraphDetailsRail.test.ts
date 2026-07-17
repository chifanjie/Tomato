// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  graphFixture,
  importsOnlyGraphFixture,
  wikiRuntimeFixture,
} from "../../../graphExplorer/__tests__/graphFixtures";
import {
  boundaryNodeId,
  buildGraphHierarchyIndex,
  scopeNodeId,
} from "../../../graphExplorer/hierarchicalGraph";
import type { WikiTarget } from "../../../wiki/wikiContent";
import GraphDetailsRail from "../GraphDetailsRail";
import { buildGraphExplorerView, type GraphExplorerView } from "../graphExplorerModel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function buttonWithText(container: HTMLElement, text: string): HTMLButtonElement | null {
  return [...container.querySelectorAll<HTMLButtonElement>("button")]
    .find((button) => button.textContent?.includes(text)) ?? null;
}

describe("GraphDetailsRail", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onSelectObject: ReturnType<typeof vi.fn<(nodeId: string) => void>>;
  let onOpenScope: ReturnType<typeof vi.fn<(scopeId: string) => void>>;
  let onOpenFile: ReturnType<typeof vi.fn<(scopeId: string, fileId: string) => void>>;
  let onSelectWikiTarget: ReturnType<typeof vi.fn<(target: WikiTarget) => unknown>>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.replaceChildren(container);
    root = createRoot(container);
    onSelectObject = vi.fn();
    onOpenScope = vi.fn();
    onOpenFile = vi.fn();
    onSelectWikiTarget = vi.fn();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  async function renderRail(view: GraphExplorerView): Promise<void> {
    await act(async () => {
      root.render(createElement(GraphDetailsRail, {
        view,
        onSelectObject,
        onOpenScope,
        onOpenFile,
        onSelectWikiTarget,
        onRequestGlobalSearch: vi.fn(),
      }));
    });
  }

  it("opens only the exact direct page through the required App callback", async () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const graph = graphFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const location = hierarchyIndex.fileLocationById.get("file:src/a.ts")!;
    const view = buildGraphExplorerView({
      graph,
      hierarchyIndex,
      wikiIndex: wikiRuntimeFixture(),
      mode: "coverage",
      selectedNodeId: "function:src/a.ts:run",
      navigation: { level: "file", ...location },
      materializedNodeId: null,
    });
    await renderRail(view);

    expect(container.textContent).toContain("专门正文");
    expect(container.textContent).toContain("运行流程");
    expect(container.textContent).toContain("生产代码");
    expect(container.textContent).toContain("src/a.ts:10-14");
    expect(container.textContent).toContain("类型函数");
    expect(container.textContent).not.toContain("类型function");

    await act(async () => buttonWithText(container, "阅读正文")?.click());

    expect(onSelectWikiTarget).toHaveBeenCalledTimes(1);
    expect(onSelectWikiTarget).toHaveBeenCalledWith({ pageId: "page:run" });
    expect(pushState).not.toHaveBeenCalled();
  });

  it("shows context pages as related material without enabling the primary reading action", async () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const graph = graphFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const location = hierarchyIndex.fileLocationById.get("file:context-only.ts")!;
    const view = buildGraphExplorerView({
      graph,
      hierarchyIndex,
      wikiIndex: wikiRuntimeFixture(),
      mode: "coverage",
      selectedNodeId: "file:context-only.ts",
      navigation: { level: "cluster", scopeId: location.scopeId, clusterId: location.clusterId },
      materializedNodeId: null,
    });
    await renderRail(view);

    expect(container.textContent).toContain("相关资料");
    expect(container.textContent).toContain("项目总览");
    expect(buttonWithText(container, "阅读正文")).toBeNull();
    expect(onSelectWikiTarget).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
  });

  it("lets aggregate neighbors and the selected aggregate open their real scopes", async () => {
    const graph = importsOnlyGraphFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const view = buildGraphExplorerView({
      graph,
      hierarchyIndex,
      wikiIndex: wikiRuntimeFixture(),
      mode: "call",
      selectedNodeId: scopeNodeId("layer:app"),
      navigation: { level: "overview" },
      materializedNodeId: null,
    });
    await renderRail(view);

    expect(container.textContent).toContain("范围概览");
    const related = buttonWithText(container, "库");
    expect(related).not.toBeNull();
    await act(async () => related?.click());
    expect(onSelectObject).toHaveBeenCalledWith(boundaryNodeId("layer:app", "layer:lib"));

    await act(async () => buttonWithText(container, "查看范围")?.click());
    expect(onOpenScope).toHaveBeenCalledWith("layer:app");
  });

  it("explains a hidden selection in Chinese without stale Wiki actions", async () => {
    const graph = graphFixture();
    const view = buildGraphExplorerView({
      graph,
      hierarchyIndex: buildGraphHierarchyIndex(graph),
      wikiIndex: wikiRuntimeFixture(),
      mode: "architecture",
      selectedNodeId: "function:src/a.ts:run",
      navigation: { level: "overview" },
      materializedNodeId: null,
    });
    await renderRail(view);

    expect(container.textContent).toContain("当前层级未显示所选节点");
    expect(container.textContent).toContain("run");
    expect(buttonWithText(container, "阅读正文")).toBeNull();
    expect(onSelectWikiTarget).not.toHaveBeenCalled();
  });

  it("keeps aggregate totals truthful while limiting long page and evidence previews", async () => {
    const graph = graphFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const location = hierarchyIndex.fileLocationById.get("file:src/a.ts")!;
    const base = buildGraphExplorerView({
      graph,
      hierarchyIndex,
      wikiIndex: wikiRuntimeFixture(),
      mode: "coverage",
      selectedNodeId: "function:src/a.ts:run",
      navigation: { level: "file", ...location },
      materializedNodeId: null,
    });
    if (!base.selection) throw new Error("missing selection fixture");
    const directSeed = base.selection.directPages[0];
    const contextSeed = base.selection.contextPages[0] ?? directSeed;
    const evidenceSeed = base.selection.evidence[0];
    if (!directSeed || !contextSeed || !evidenceSeed) throw new Error("missing documentation fixture");
    const view: GraphExplorerView = {
      ...base,
      selection: {
        ...base.selection,
        directPages: Array.from({ length: 12 }, (_, index) => ({
          ...directSeed,
          id: `page:direct-${index + 1}`,
          title: `专门正文 ${index + 1}`,
        })),
        contextPages: Array.from({ length: 11 }, (_, index) => ({
          ...contextSeed,
          id: `page:context-${index + 1}`,
          title: `相关资料 ${index + 1}`,
        })),
        evidence: Array.from({ length: 13 }, (_, index) => ({
          ...evidenceSeed,
          id: `evidence:${index + 1}`,
          filePath: `src/evidence-${index + 1}.ts`,
        })),
      },
    };
    const requestSearch = vi.fn();
    await act(async () => {
      root.render(createElement(GraphDetailsRail, {
        view,
        onSelectObject,
        onOpenScope,
        onOpenFile,
        onSelectWikiTarget,
        onRequestGlobalSearch: requestSearch,
      }));
    });

    expect(container.textContent).toContain("专门正文（共 12 篇）");
    expect(container.textContent).toContain("相关资料（共 11 篇）");
    expect(container.textContent).toContain("源码证据（共 13 项）");
    expect(container.textContent).toContain("专门正文 8");
    expect(container.textContent).not.toContain("专门正文 9");
    expect(container.textContent).toContain("src/evidence-10.ts");
    expect(container.textContent).not.toContain("src/evidence-11.ts");
    expect(container.textContent).toContain("另有 4 篇");
    expect(container.textContent).toContain("另有 3 项");

    await act(async () => buttonWithText(container, "用全局搜索继续查找")?.click());
    expect(requestSearch).toHaveBeenCalledOnce();
  });
});
