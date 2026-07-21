// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
import GraphDetailsRail, { resolveGraphInspectorSide } from "../GraphDetailsRail";
import { buildGraphExplorerView, type GraphExplorerView } from "../graphExplorerModel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function buttonWithText(container: HTMLElement, text: string): HTMLButtonElement | null {
  return [...container.querySelectorAll<HTMLButtonElement>("button")]
    .find((button) => button.textContent?.includes(text)) ?? null;
}

describe("GraphDetailsRail", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let onSelectObject: ReturnType<typeof vi.fn<(nodeId: string) => void>>;
  let onOpenScope: ReturnType<typeof vi.fn<(scopeId: string) => void>>;
  let onOpenCluster: ReturnType<typeof vi.fn<(scopeId: string, clusterId: string) => void>>;
  let onOpenFile: ReturnType<typeof vi.fn<(scopeId: string, clusterId: string, fileId: string) => void>>;
  let onSelectWikiTarget: ReturnType<typeof vi.fn<(target: WikiTarget) => unknown>>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.replaceChildren(container);
    root = createRoot(container);
    onClose = vi.fn();
    onSelectObject = vi.fn();
    onOpenScope = vi.fn();
    onOpenCluster = vi.fn();
    onOpenFile = vi.fn();
    onSelectWikiTarget = vi.fn();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        media: "(max-width: 1023px)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  async function renderRail(
    view: GraphExplorerView,
    options: { open?: boolean; side?: "left" | "right" } = {},
  ): Promise<void> {
    await act(async () => {
      root.render(createElement(GraphDetailsRail, {
        view,
        open: options.open ?? true,
        side: options.side ?? "right",
        onClose,
        onSelectObject,
        onOpenScope,
        onOpenCluster,
        onOpenFile,
        onSelectWikiTarget,
        onRequestGlobalSearch: vi.fn(),
      }));
    });
  }

  function setCompactViewport(compact: boolean): void {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: compact,
        media: "(max-width: 1023px)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  }

  it("renders only while open with complementary semantics and the requested side", async () => {
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

    await renderRail(view, { open: false });
    expect(container.querySelector("aside")).toBeNull();

    await renderRail(view, { open: true, side: "left" });
    const inspector = container.querySelector<HTMLElement>('[role="complementary"][aria-label="图谱详情"]');
    expect(inspector?.dataset.side).toBe("left");
    expect(buttonWithText(container, "关闭图谱详情")).not.toBeNull();
    expect(container.textContent).toContain("节点职责");
    expect(container.textContent).toContain("上游");
    expect(container.textContent).toContain("下游");
    expect(container.textContent).toContain("专门正文");
    expect(container.textContent).toContain("相关资料");
    expect(container.textContent).toContain("源码证据");

    await renderRail(view, { side: "right" });
    expect(container.querySelector<HTMLElement>("aside")?.dataset.side).toBe("right");
  });

  it("keeps weak labels at 12px and paths or key metadata at 13px", () => {
    const railSource = readFileSync(resolve(
      process.cwd(),
      "src/components/graphExplorer/GraphDetailsRail.tsx",
    ), "utf8");
    const explorerSource = readFileSync(resolve(
      process.cwd(),
      "src/components/graphExplorer/GraphExplorer.tsx",
    ), "utf8");
    const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

    expect(`${railSource}\n${explorerSource}`).not.toMatch(/text-\[(?:10|11)px\]/);
    expect(css).toMatch(/\.uc-code-ref\s*\{[^}]*font-size:\s*13px/s);
    expect(css).toMatch(/\.uc-graph-quick-jump-type\s*\{[^}]*font-size:\s*12px/s);
    expect(css).toMatch(/\.uc-graph-quick-jump-copy span\s*\{[^}]*font-size:\s*13px/s);
  });

  it("places the desktop inspector away from a selected node and always uses the right sheet on compact screens", () => {
    const common = {
      frameWidth: 1_000,
      inspectorWidth: 360,
      gap: 12,
      compact: false,
    };
    expect(resolveGraphInspectorSide({
      ...common,
      selectedScreenBounds: { left: 700, right: 820, top: 80, bottom: 160 },
    })).toBe("left");
    expect(resolveGraphInspectorSide({
      ...common,
      selectedScreenBounds: { left: 120, right: 260, top: 80, bottom: 160 },
    })).toBe("right");
    expect(resolveGraphInspectorSide({
      ...common,
      selectedScreenBounds: { left: 700, right: 820, top: 80, bottom: 160 },
      compact: true,
    })).toBe("right");
    expect(resolveGraphInspectorSide({ ...common, selectedScreenBounds: null })).toBe("right");
  });

  it("closes without selecting a graph object", async () => {
    const graph = graphFixture();
    const view = buildGraphExplorerView({
      graph,
      hierarchyIndex: buildGraphHierarchyIndex(graph),
      wikiIndex: wikiRuntimeFixture(),
      mode: "architecture",
      selectedNodeId: scopeNodeId("layer:app"),
      navigation: { level: "overview" },
      materializedNodeId: null,
    });
    await renderRail(view);

    await act(async () => buttonWithText(container, "关闭图谱详情")?.click());

    expect(onClose).toHaveBeenCalledOnce();
    expect(onSelectObject).not.toHaveBeenCalled();
  });

  it("toggles compact sheet size and resets to half after reopening", async () => {
    setCompactViewport(true);
    const graph = graphFixture();
    const view = buildGraphExplorerView({
      graph,
      hierarchyIndex: buildGraphHierarchyIndex(graph),
      wikiIndex: wikiRuntimeFixture(),
      mode: "architecture",
      selectedNodeId: scopeNodeId("layer:app"),
      navigation: { level: "overview" },
      materializedNodeId: null,
    });
    await renderRail(view);
    expect(container.querySelector<HTMLElement>("aside")?.dataset.sheetSize).toBe("half");

    await act(async () => buttonWithText(container, "展开全屏图谱详情")?.click());
    expect(container.querySelector<HTMLElement>("aside")?.dataset.sheetSize).toBe("full");
    expect(buttonWithText(container, "收起半屏图谱详情")).not.toBeNull();

    await renderRail(view, { open: false });
    await renderRail(view, { open: true });
    expect(container.querySelector<HTMLElement>("aside")?.dataset.sheetSize).toBe("half");
  });

  it("keeps inspector scrolling, single-column relations, and every action target at least 44px", () => {
    const componentSource = readFileSync(resolve(
      process.cwd(),
      "src/components/graphExplorer/GraphDetailsRail.tsx",
    ), "utf8");
    const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
    const compactCss = css.match(/@media \(max-width: 1023px\) \{[\s\S]*?\.uc-graph-inspector[\s\S]*?\n\}/)?.[0] ?? "";

    expect(componentSource).toContain("uc-graph-inspector__scroll");
    expect(componentSource).not.toContain("sm:grid-cols-2");
    expect(componentSource).not.toContain("max-xl:overflow-visible");
    expect(css).toMatch(/\.uc-graph-inspector__scroll\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);
    expect(compactCss).not.toMatch(/overflow:\s*visible/);
    expect(css).toMatch(/\.uc-graph-inspector button\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s);
    expect(css).toMatch(/\.uc-semantic-canvas \.react-flow__controls-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
  });

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

  it("opens selected clusters through the exact scope and cluster chain", async () => {
    const graph = graphFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const location = hierarchyIndex.fileLocationById.get("file:src/a.ts")!;
    const view = buildGraphExplorerView({
      graph,
      hierarchyIndex,
      wikiIndex: wikiRuntimeFixture(),
      mode: "architecture",
      selectedNodeId: location.clusterId,
      navigation: { level: "scope", scopeId: location.scopeId },
      materializedNodeId: location.clusterId,
    });
    await renderRail(view);

    const drillButton = buttonWithText(container, "查看目录");
    expect(drillButton?.className).toContain("min-h-11");
    await act(async () => drillButton?.click());
    expect(onOpenCluster).toHaveBeenCalledWith(location.scopeId, location.clusterId);
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
        open: true,
        side: "right",
        onClose,
        onSelectObject,
        onOpenScope,
        onOpenCluster,
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
