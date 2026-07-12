/** @vitest-environment happy-dom */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  act,
  createElement,
  type ComponentType,
  type PropsWithChildren,
} from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseWikiIndexV2 } from "@understand-code/core/knowledge-base";
import type { KnowledgeGraph } from "@understand-code/core/types";
import * as AppModule from "../App";
import { useDashboardStore } from "../store";
import {
  buildWikiRuntimeIndex,
  emptyWikiRuntimeIndex,
  type WikiRuntimeIndex,
} from "../wiki/wikiIndex";
import { wikiV2Fixture } from "../wiki/__tests__/fixtures/wikiV2Fixtures";
import type { WikiTarget } from "../wiki/wikiContent";

const lazyGraphProbe = vi.hoisted(() => ({ moduleLoads: 0 }));

vi.mock("../components/graphExplorer/GraphExplorer", () => {
  lazyGraphProbe.moduleLoads += 1;
  return { default: () => null };
});

type WikiAvailabilityStatus = "loading" | "ready" | "empty" | "missing" | "invalid" | "error";
type WikiFailureStatus = Exclude<WikiAvailabilityStatus, "loading" | "ready">;

interface AvailabilityCopy {
  title: string;
  description: string;
}

interface RoutingController {
  applyLocation: () => void;
  selectSurface: (surface: "wiki" | "graph") => void;
  selectWikiTarget: (target: WikiTarget) => boolean;
  selectWikiHome: () => void;
  selectGraphForWikiPage: (pageId: string) => boolean;
  start: () => () => void;
}

interface AppRoutingOptions {
  browser: Window;
  pageExists: (pageId: string) => boolean;
  getActiveWikiPageId: () => string | null;
  setDashboardSurface: (surface: "wiki" | "graph") => void;
  selectWikiPage: (pageId: string | null) => void;
  openWikiTarget: (target: WikiTarget) => void;
  openGraphForWikiPage: (pageId: string) => void;
  recentWikiTargetRef: { current: WikiTarget | null };
  onWikiLocationApplied: (target: WikiTarget | null) => void;
}

const appContracts = AppModule as typeof AppModule & {
  WIKI_AVAILABILITY_COPY?: Record<WikiFailureStatus, AvailabilityCopy>;
  resolveWikiAvailability?: (
    status: "ready" | "missing" | "invalid" | "error",
    pageCount: number,
  ) => WikiAvailabilityStatus;
  WikiAvailabilityView?: ComponentType<{ status: WikiFailureStatus }>;
  applyDashboardKnowledgeResult?: (
    result: {
      wikiIndex: WikiRuntimeIndex;
      wikiStatus: "ready" | "missing" | "invalid" | "forbidden" | "error";
    },
    handlers: {
      setWikiIndex: (index: WikiRuntimeIndex) => void;
      setWikiAvailability: (status: WikiAvailabilityStatus) => void;
      onTokenInvalid: () => void;
    },
  ) => WikiAvailabilityStatus | "forbidden";
  createAppRoutingController?: (options: AppRoutingOptions) => RoutingController;
  GraphChunkErrorBoundary?: ComponentType<PropsWithChildren<{
    onBackToWiki: () => void;
    onReload?: () => void;
  }>>;
};

const APP_SOURCE = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
const APP_CSS = readFileSync(join(process.cwd(), "src/index.css"), "utf8");

function graph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "sample",
      languages: ["go"],
      frameworks: [],
      description: "",
      analyzedAt: "2026-07-09T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes: [
      {
        id: "file:src/a.go",
        type: "file",
        name: "a.go",
        filePath: "src/a.go",
        summary: "File A.",
        tags: [],
        complexity: "moderate",
      },
    ],
    edges: [],
    layers: [{ id: "core", name: "Core", description: "Core layer", nodeIds: ["file:src/a.go"] }],
    tour: [],
  };
}

describe("app surface routing", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/docs?mode=test");
    const payload = wikiV2Fixture();
    const overview = payload.pages[0];
    if (!overview) throw new Error("missing fixture overview");
    payload.pages = [{
      ...overview,
      id: "wiki:overview",
      title: "Project Overview",
      markdownPath: "knowledge-base/README.md",
      directNodeIds: ["file:src/a.go"],
      contextNodeIds: [],
      evidenceIds: [],
      route: undefined,
    }];
    payload.mainReadiness = { status: "blocked", reasons: ["测试夹具"], routePageIds: [] };
    payload.nodeDocumentation = [{
      nodeId: "file:src/a.go",
      relation: "direct",
      quality: "needs-review",
      evidenceHealth: "missing",
      generationStatus: "partial",
      referenceCoverage: "unanchored",
      directPageIds: ["wiki:overview"],
      contextPageIds: [],
      evidenceIds: [],
      primaryPageId: "wiki:overview",
    }];
    payload.evidence = [];
    const parsed = parseWikiIndexV2(payload);
    if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
    useDashboardStore.getState().setGraph(graph());
    useDashboardStore.getState().setDashboardSurface("wiki");
    useDashboardStore.getState().setWikiIndex(
      buildWikiRuntimeIndex(parsed.value),
    );
  });

  it("declares wiki as the initial peer surface and keeps the guided home selected", () => {
    expect(useDashboardStore.getInitialState().dashboardSurface).toBe("wiki");
    expect(useDashboardStore.getInitialState().graphExplorerMode).toBe("semantic");
    expect(useDashboardStore.getState().dashboardSurface).toBe("wiki");
    expect(useDashboardStore.getState().activeWikiPageId).toBeNull();
  });

  it("switches to graph through wiki page focus", () => {
    useDashboardStore.getState().openGraphForWikiPage("wiki:overview");

    expect(useDashboardStore.getState().dashboardSurface).toBe("graph");
    expect(useDashboardStore.getState().graphFocusNodeIds).toEqual(["file:src/a.go"]);
  });

  it("switches from graph node back to related wiki page", () => {
    useDashboardStore.getState().setDashboardSurface("graph");
    useDashboardStore.getState().openWikiForGraphNode("file:src/a.go");

    expect(useDashboardStore.getState().dashboardSurface).toBe("wiki");
    expect(useDashboardStore.getState().activeWikiPageId).toBe("wiki:overview");
  });
});

describe("App Wiki availability", () => {
  it("uses the exact Simplified Chinese cause, effect, and recovery copy", () => {
    expect(appContracts.WIKI_AVAILABILITY_COPY).toEqual({
      empty: {
        title: "知识库还没有正文",
        description: "索引已读取，但没有可发布页面；关系图谱仍可使用。请重新运行知识库生成。",
      },
      missing: {
        title: "尚未生成知识库",
        description: "没有找到 wiki-index.json；关系图谱仍可使用。请运行知识库生成命令后刷新。",
      },
      invalid: {
        title: "知识库索引无效",
        description: "索引无法通过 V2/兼容校验，因此未展示可能错误的映射；关系图谱仍可使用。请重新生成知识库。",
      },
      error: {
        title: "知识库读取失败",
        description: "读取索引时发生网络或本地服务错误；关系图谱仍可使用。请检查服务后重试。",
      },
    });
    expect(Object.prototype.hasOwnProperty.call(appContracts.WIKI_AVAILABILITY_COPY ?? {}, "forbidden"))
      .toBe(false);
  });

  it.each<WikiFailureStatus>(["empty", "missing", "invalid", "error"])(
    "renders the exact %s availability state without protected details",
    (status) => {
      expect(appContracts.WikiAvailabilityView).toBeTypeOf("function");
      if (!appContracts.WikiAvailabilityView || !appContracts.WIKI_AVAILABILITY_COPY) return;

      const html = renderToStaticMarkup(createElement(appContracts.WikiAvailabilityView, { status }));
      const copy = appContracts.WIKI_AVAILABILITY_COPY[status];
      expect(html).toContain(copy.title);
      expect(html).toContain(copy.description);
      expect(html).not.toContain("forbidden");
      expect(html).not.toContain("403");
      expect(html).not.toContain("token");
    },
  );

  it("maps ready-without-pages to empty and keeps transport failures distinct", () => {
    expect(appContracts.resolveWikiAvailability).toBeTypeOf("function");
    if (!appContracts.resolveWikiAvailability) return;

    expect(appContracts.resolveWikiAvailability("ready", 2)).toBe("ready");
    expect(appContracts.resolveWikiAvailability("ready", 0)).toBe("empty");
    expect(appContracts.resolveWikiAvailability("missing", 0)).toBe("missing");
    expect(appContracts.resolveWikiAvailability("invalid", 0)).toBe("invalid");
    expect(appContracts.resolveWikiAvailability("error", 0)).toBe("error");
  });

  it("routes forbidden only to token invalidation without publishing protected state", () => {
    expect(appContracts.applyDashboardKnowledgeResult).toBeTypeOf("function");
    if (!appContracts.applyDashboardKnowledgeResult) return;
    const setWikiIndex = vi.fn();
    const setWikiAvailability = vi.fn();
    const onTokenInvalid = vi.fn();

    const outcome = appContracts.applyDashboardKnowledgeResult(
      {
        wikiIndex: emptyWikiRuntimeIndex(),
        wikiStatus: "forbidden",
      },
      { setWikiIndex, setWikiAvailability, onTokenInvalid },
    );

    expect(outcome).toBe("forbidden");
    expect(onTokenInvalid).toHaveBeenCalledOnce();
    expect(setWikiIndex).not.toHaveBeenCalled();
    expect(setWikiAvailability).not.toHaveBeenCalled();
  });
});

function routingHarness(initialActivePageId: string | null = null) {
  expect(appContracts.createAppRoutingController).toBeTypeOf("function");
  if (!appContracts.createAppRoutingController) throw new Error("missing App routing controller");
  let activePageId = initialActivePageId;
  const surfaces: Array<"wiki" | "graph"> = [];
  const selectedPages: Array<string | null> = [];
  const openedTargets: WikiTarget[] = [];
  const focusedGraphPages: string[] = [];
  const recentWikiTargetRef = { current: null as WikiTarget | null };
  const appliedWikiLocations: Array<WikiTarget | null> = [];
  const pages = new Set(["page:overview", "page:run"]);
  const controller = appContracts.createAppRoutingController({
    browser: window,
    pageExists: (pageId) => pages.has(pageId),
    getActiveWikiPageId: () => activePageId,
    setDashboardSurface: (surface) => surfaces.push(surface),
    selectWikiPage: (pageId) => {
      activePageId = pageId;
      selectedPages.push(pageId);
    },
    openWikiTarget: (target) => {
      activePageId = target.pageId;
      openedTargets.push(target);
    },
    openGraphForWikiPage: (pageId) => focusedGraphPages.push(pageId),
    recentWikiTargetRef,
    onWikiLocationApplied: (target) => appliedWikiLocations.push(target),
  });
  return {
    controller,
    surfaces,
    selectedPages,
    openedTargets,
    focusedGraphPages,
    recentWikiTargetRef,
    appliedWikiLocations,
    getActivePageId: () => activePageId,
  };
}

describe("App global location owner", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/docs?mode=test");
  });

  it("applies canonical and legacy targets on first load, popstate, and hashchange", () => {
    window.history.replaceState(null, "", "/docs?mode=test#wiki=page%3Aoverview&anchor=setup");
    const harness = routingHarness();
    const stop = harness.controller.start();

    expect(harness.surfaces.at(-1)).toBe("wiki");
    expect(harness.openedTargets.at(-1)).toEqual({ pageId: "page:overview", anchor: "setup" });
    expect(harness.recentWikiTargetRef.current).toEqual({ pageId: "page:overview", anchor: "setup" });

    window.history.pushState(null, "", "/docs?mode=test#wiki-page=page%3Arun");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(harness.openedTargets.at(-1)).toEqual({ pageId: "page:run" });

    window.history.pushState(null, "", "/docs?mode=test#graph");
    window.dispatchEvent(new Event("hashchange"));
    expect(harness.surfaces.at(-1)).toBe("graph");

    stop();
  });

  it("keeps an in-document hash fragment instead of clearing the active Wiki page", () => {
    window.history.replaceState(null, "", "/docs?mode=test#implementation");
    const harness = routingHarness("page:overview");
    const stop = harness.controller.start();

    expect(harness.surfaces.at(-1)).toBe("wiki");
    expect(harness.selectedPages).toEqual([]);
    expect(harness.openedTargets.at(-1)).toEqual({
      pageId: "page:overview",
      anchor: "implementation",
    });
    expect(window.location.hash).toBe("#wiki=page%3Aoverview&anchor=implementation");

    stop();
  });

  it("restores the same Wiki page and anchor after Wiki to Graph to Wiki", () => {
    window.history.replaceState(null, "", "/docs?mode=test#wiki=page%3Aoverview&anchor=setup");
    const harness = routingHarness();
    const stop = harness.controller.start();

    harness.controller.selectSurface("graph");
    expect(harness.surfaces.at(-1)).toBe("graph");
    expect(window.location.hash).toBe("#graph");

    harness.controller.selectSurface("wiki");
    expect(harness.surfaces.at(-1)).toBe("wiki");
    expect(harness.openedTargets.at(-1)).toEqual({ pageId: "page:overview", anchor: "setup" });
    expect(window.location.hash).toBe("#wiki=page%3Aoverview&anchor=setup");

    stop();
  });

  it("keeps a Graph-rail Wiki target recent after returning through Graph history", () => {
    window.history.replaceState(null, "", "/docs?mode=test#wiki=page%3Aoverview&anchor=setup");
    const harness = routingHarness();
    const stop = harness.controller.start();

    harness.controller.selectSurface("graph");
    expect(harness.controller.selectWikiTarget({
      pageId: "page:run",
      anchor: "implementation",
    })).toBe(true);
    expect(harness.recentWikiTargetRef.current).toEqual({
      pageId: "page:run",
      anchor: "implementation",
    });

    window.history.replaceState(null, "", "/docs?mode=test#graph");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(harness.surfaces.at(-1)).toBe("graph");

    harness.controller.selectSurface("wiki");
    expect(harness.openedTargets.at(-1)).toEqual({
      pageId: "page:run",
      anchor: "implementation",
    });
    expect(window.location.hash).toBe("#wiki=page%3Arun&anchor=implementation");

    stop();
  });

  it("publishes same-page anchor and root history applications as distinct revisions", () => {
    window.history.replaceState(null, "", "/docs?mode=test#wiki=page%3Aoverview");
    const harness = routingHarness();
    const stop = harness.controller.start();

    harness.controller.selectWikiTarget({ pageId: "page:overview", anchor: "setup" });
    expect(harness.appliedWikiLocations.at(-1)).toEqual({
      pageId: "page:overview",
      anchor: "setup",
    });

    window.history.replaceState(null, "", "/docs?mode=test#wiki=page%3Aoverview");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(harness.appliedWikiLocations.at(-1)).toEqual({ pageId: "page:overview" });
    expect(window.location.hash).toBe("#wiki=page%3Aoverview");

    stop();
  });

  it("keeps the remembered anchor when the active Graph tab is selected again", () => {
    window.history.replaceState(null, "", "/docs?mode=test#wiki=page%3Aoverview&anchor=setup");
    const harness = routingHarness();
    const stop = harness.controller.start();

    harness.controller.selectSurface("graph");
    const historyLength = window.history.length;
    harness.controller.selectSurface("graph");

    expect(harness.recentWikiTargetRef.current).toEqual({
      pageId: "page:overview",
      anchor: "setup",
    });
    expect(window.history.length).toBe(historyLength);

    harness.controller.selectSurface("wiki");
    expect(harness.openedTargets.at(-1)).toEqual({ pageId: "page:overview", anchor: "setup" });

    stop();
  });

  it("refreshes a Wiki target written without a location event before restoring it", () => {
    window.history.replaceState(null, "", "/docs?mode=test#wiki=page%3Aoverview&anchor=setup");
    const harness = routingHarness();
    const stop = harness.controller.start();

    window.history.pushState(
      null,
      "",
      "/docs?mode=test#wiki=page%3Arun&anchor=implementation",
    );
    harness.controller.selectSurface("wiki");

    expect(harness.recentWikiTargetRef.current).toEqual({
      pageId: "page:run",
      anchor: "implementation",
    });
    expect(harness.openedTargets.at(-1)).toEqual({
      pageId: "page:run",
      anchor: "implementation",
    });
    expect(window.location.hash).toBe("#wiki=page%3Arun&anchor=implementation");

    stop();
  });

  it("refreshes and canonicalizes a hash-only target before same-surface Wiki selection", () => {
    window.history.replaceState(null, "", "/docs?mode=test#wiki=page%3Aoverview&anchor=setup");
    const harness = routingHarness();
    const stop = harness.controller.start();

    window.history.pushState(null, "", "/docs?mode=test#implementation");
    harness.controller.selectSurface("wiki");

    expect(harness.recentWikiTargetRef.current).toEqual({
      pageId: "page:overview",
      anchor: "implementation",
    });
    expect(harness.openedTargets.at(-1)).toEqual({
      pageId: "page:overview",
      anchor: "implementation",
    });
    expect(window.location.hash).toBe("#wiki=page%3Aoverview&anchor=implementation");

    stop();
  });

  it("keeps App-owned location while preserving page-specific Wiki-to-Graph focus", () => {
    window.history.replaceState(null, "", "/docs?mode=test#wiki=page%3Aoverview&anchor=setup");
    const harness = routingHarness();
    const stop = harness.controller.start();

    expect(harness.controller.selectGraphForWikiPage("page:overview")).toBe(true);
    expect(harness.focusedGraphPages).toEqual(["page:overview"]);
    expect(window.location.hash).toBe("#graph");

    harness.controller.selectSurface("wiki");
    expect(harness.openedTargets.at(-1)).toEqual({ pageId: "page:overview", anchor: "setup" });
    expect(window.location.hash).toBe("#wiki=page%3Aoverview&anchor=setup");

    stop();
  });

  it("opens Wiki home without resurrecting the previous target", () => {
    window.history.replaceState(null, "", "/docs?mode=test#wiki=page%3Aoverview&anchor=setup");
    const harness = routingHarness();
    const stop = harness.controller.start();

    harness.controller.selectWikiHome();

    expect(harness.surfaces.at(-1)).toBe("wiki");
    expect(harness.selectedPages.at(-1)).toBeNull();
    expect(harness.recentWikiTargetRef.current).toBeNull();
    expect(window.location.hash).toBe("");

    stop();
  });

  it("does not clear a malformed or unknown hash-only fragment", () => {
    window.history.replaceState(null, "", "/docs?mode=test#%E0%A4%A");
    const harness = routingHarness("page:overview");

    harness.controller.applyLocation();

    expect(harness.selectedPages).toEqual([]);
    expect(harness.getActivePageId()).toBe("page:overview");
    expect(window.location.hash).toBe("#%E0%A4%A");
  });

  it("rejects unknown selected targets without publishing an invalid URL", () => {
    const harness = routingHarness();

    expect(harness.controller.selectWikiTarget({ pageId: "page:missing", anchor: "ghost" }))
      .toBe(false);
    expect(harness.openedTargets).toEqual([]);
    expect(window.location.hash).toBe("");
  });
});

describe("App peer shell contracts", () => {
  it("keeps Graph Explorer behind React.lazy", () => {
    expect(lazyGraphProbe.moduleLoads).toBe(0);
    expect(APP_SOURCE).toMatch(
      /<GraphExplorer\s+onSelectWikiTarget=\{\(target\) => routingController\.selectWikiTarget\(target\)\}/,
    );
  });

  it("contains a rejected Graph chunk locally and keeps Wiki recovery usable", async () => {
    expect(appContracts.GraphChunkErrorBoundary).toBeTypeOf("function");
    if (!appContracts.GraphChunkErrorBoundary) return;
    const onBackToWiki = vi.fn();
    const onReload = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const RejectingChunk = () => {
      throw new Error("dynamic import failed");
    };

    await act(async () => {
      root.render(createElement(
        "div",
        null,
        createElement("header", null, "知识库工具栏"),
        createElement(
          appContracts.GraphChunkErrorBoundary!,
          { onBackToWiki, onReload },
          createElement(RejectingChunk),
        ),
      ));
    });

    expect(document.body.textContent).toContain("知识库工具栏");
    expect(document.body.textContent).toContain("关系图谱加载失败");
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("button")];
    await act(async () => buttons.find((button) => button.textContent === "返回知识库")?.click());
    expect(onBackToWiki).toHaveBeenCalledOnce();
    await act(async () => buttons.find((button) => button.textContent === "重新加载页面")?.click());
    expect(onReload).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
    consoleError.mockRestore();
    container.remove();
  });

  it("keeps the global knowledge search trigger outside the Wiki/Graph content branch", () => {
    const triggerIndex = APP_SOURCE.indexOf('aria-label="搜索知识库"');
    const peerContentIndex = APP_SOURCE.indexOf('{dashboardSurface === "wiki" ? (');
    expect(triggerIndex).toBeGreaterThanOrEqual(0);
    expect(peerContentIndex).toBeGreaterThanOrEqual(0);
    expect(triggerIndex).toBeLessThan(peerContentIndex);
    expect(APP_SOURCE).toContain("<GlobalWikiSearch");
  });

  it("keeps mobile Wiki and Graph peers in the App-owned shell", () => {
    expect(APP_SOURCE).toContain("if (isMobile && !isPeerDashboardSurface)");
    expect(APP_SOURCE).not.toContain("if (isMobile) {");
  });

  it("routes Markdown page-and-anchor targets through the App owner", () => {
    expect(APP_SOURCE).toContain(
      "onSelectWikiTarget={(target) => routingController.selectWikiTarget(target)}",
    );
  });

  it("gives an open Wiki drawer exclusive ownership of global shortcuts", () => {
    expect(APP_SOURCE).toMatch(
      /useKeyboardShortcuts\(\s*shortcuts,\s*!wikiDrawerOpen && !searchOpen && !showKeyboardHelp/s,
    );
    expect(APP_SOURCE).toContain("onDrawerOpenChange={setWikiDrawerOpen}");
    expect(APP_SOURCE).toContain("externalModalOpen={searchOpen || showKeyboardHelp}");
    expect(APP_SOURCE).toContain("onClick={requestKeyboardHelp}");
    expect(APP_SOURCE).toContain("onClose={closeKeyboardHelp}");
    expect(APP_SOURCE.match(/setSearchOpen\(true\)/g)).toHaveLength(1);
  });

  it("keeps the 320px peer header compact while project, surface, and search remain reachable", () => {
    expect(APP_SOURCE).toContain('className="uc-global-header');
    expect(APP_SOURCE).toContain('className="uc-global-header-project');
    expect(APP_SOURCE).toContain('className="uc-global-search-trigger');
    expect(APP_SOURCE).toContain("uc-mobile-header-more");
    expect(APP_SOURCE).toContain("更多工具");
    expect(APP_CSS).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*\.uc-global-header\s*\{[\s\S]*height:\s*var\(--uc-global-header-height\)/);
    expect(APP_CSS).toMatch(/\.uc-global-header-project\s*\{[^}]*max-width:/s);
    expect(APP_CSS).toMatch(/\.uc-global-search-trigger\s+kbd\s*\{[^}]*display:\s*none/s);
  });

  it("does not mount the legacy onboarding overlay", () => {
    expect(APP_SOURCE).not.toContain("<OnboardingOverlay");
  });
});
