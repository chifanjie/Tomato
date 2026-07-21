// @vitest-environment happy-dom

import { act, createElement, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDashboardStore } from "../../../store";
import {
  largeWikiFixture,
  wikiV2Fixture,
} from "../../../wiki/__tests__/fixtures/wikiV2Fixtures";
import { buildWikiRuntimeIndex, emptyWikiRuntimeIndex } from "../../../wiki/wikiIndex";
import { buildWikiSearchRuntime } from "../../../wiki/searchIndex";
import KnowledgeConsole, { type KnowledgeConsoleProps } from "../KnowledgeConsole";
import GlobalWikiSearch from "../GlobalWikiSearch";
import { GLOBAL_WIKI_SEARCH_REQUEST_EVENT } from "../WikiResponsiveShell";

function buttonWithText(text: string): HTMLButtonElement {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")]
    .find((candidate) => candidate.textContent?.includes(text));
  if (!button) throw new Error(`missing button: ${text}`);
  return button;
}

function buttonWithExactText(text: string): HTMLButtonElement {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")]
    .find((candidate) => candidate.textContent?.trim() === text);
  if (!button) throw new Error(`missing exact button: ${text}`);
  return button;
}

function linkWithText(text: string): HTMLAnchorElement {
  const link = [...document.querySelectorAll<HTMLAnchorElement>("a")]
    .find((candidate) => candidate.textContent?.includes(text));
  if (!link) throw new Error(`missing link: ${text}`);
  return link;
}

function currentDestinations(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('button[aria-current="page"]')];
}

function CoordinatedSearchHarness() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const runtime = buildWikiSearchRuntime(
    [],
    useDashboardStore.getState().wikiIndex,
    "fallback",
  );

  const requestSearch = () => {
    setHelpOpen(false);
    window.dispatchEvent(new Event(GLOBAL_WIKI_SEARCH_REQUEST_EVENT));
    queueMicrotask(() => setSearchOpen(true));
  };
  const requestHelp = () => {
    window.dispatchEvent(new Event(GLOBAL_WIKI_SEARCH_REQUEST_EVENT));
    queueMicrotask(() => setHelpOpen(true));
  };
  const closeHelp = () => {
    setHelpOpen(false);
    queueMicrotask(() => helpButtonRef.current?.focus());
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        requestSearch();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!helpOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeHelp();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [helpOpen]);

  return createElement(
    "div",
    null,
    createElement("button", { ref: searchButtonRef, type: "button", onClick: requestSearch }, "搜索知识库"),
    createElement("button", { ref: helpButtonRef, type: "button", onClick: requestHelp }, "快捷键帮助"),
    createElement<KnowledgeConsoleProps>(KnowledgeConsole, {
      externalModalOpen: searchOpen || helpOpen,
    }),
    createElement(GlobalWikiSearch, {
      open: searchOpen,
      loadStatus: "fallback",
      runtime,
      returnFocusRef: searchButtonRef,
      onClose: () => setSearchOpen(false),
      onSelectTarget: vi.fn(),
    }),
    helpOpen
      ? createElement(
          "section",
          { role: "dialog", "aria-modal": "true", "aria-label": "快捷键帮助" },
          createElement("button", { type: "button", onClick: closeHelp }, "关闭帮助"),
        )
      : null,
  );
}

describe("KnowledgeConsole interactions", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState(null, "", "/?token=test");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        media: "(max-width: 1023px)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })),
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      "# 项目总览\n\n<a id=\"run\"></a>\n## 运行规则\n\n正文内容。\n\n[打开运行流程](核心流程/运行流程.md#run)",
      { status: 200, headers: { "Content-Type": "text/markdown" } },
    )));

    useDashboardStore.getState().setDashboardSurface("wiki");
    useDashboardStore.getState().setWikiIndex(buildWikiRuntimeIndex(wikiV2Fixture()));
    useDashboardStore.getState().selectWikiPage(null);
    container = document.createElement("div");
    document.body.replaceChildren(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(KnowledgeConsole));
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("switches Status and Home with one truthful current destination and no evidence drawer", async () => {
    expect(currentDestinations().map((item) => item.textContent)).toEqual(["阅读首页"]);

    await act(async () => buttonWithText("知识库状态").click());
    expect(document.querySelector("main h1")?.textContent).toBe("知识库状态");
    expect(currentDestinations().map((item) => item.textContent)).toEqual([
      expect.stringContaining("知识库状态"),
    ]);
    expect(document.querySelector('button[aria-label="打开源码证据"]')).toBeNull();
    expect(document.body.textContent).not.toContain("知识库与图谱关联");

    await act(async () => buttonWithText("阅读首页").click());
    expect(document.querySelector("main h1")?.textContent).toBe("先理解项目，再进入代码");
    expect(currentDestinations().map((item) => item.textContent)).toEqual(["阅读首页"]);
  });

  it("opens Reference with focus and routes the graph shortcut to #graph", async () => {
    await act(async () => buttonWithText("查找文件或符号").click());
    const reference = buttonWithText("代码参考");
    expect(reference.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(reference);
    expect(document.querySelector('#wiki-navigation-drawer[role="dialog"]')).toBeNull();

    await act(async () => buttonWithText("查看关系图谱").click());
    expect(useDashboardStore.getState().dashboardSurface).toBe("graph");
    expect(window.location.hash).toBe("#graph");
  });

  it("opens the narrow navigation drawer at Reference and returns focus to the Home CTA", async () => {
    await act(async () => root.unmount());
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        media: "(max-width: 1023px)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })),
    });
    root = createRoot(container);
    await act(async () => root.render(createElement(KnowledgeConsole)));

    const cta = buttonWithText("查找文件或符号");
    await act(async () => cta.click());
    const reference = buttonWithText("代码参考");
    expect(reference.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector('#wiki-navigation-drawer[role="dialog"]')).not.toBeNull();
    expect(document.querySelector("#wiki-navigation-drawer")?.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(reference);

    await act(async () => buttonWithText("关闭知识目录").click());
    expect(document.querySelector('#wiki-navigation-drawer[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(cta);
  });

  it("opens a route page, clears auxiliary current state, and mounts evidence only for the page", async () => {
    await act(async () => buttonWithText("项目总览").click());

    expect(document.querySelector("article h1")?.textContent).toBe("项目总览");
    expect(currentDestinations()).toHaveLength(1);
    expect(currentDestinations()[0]?.textContent).toContain("项目总览");
    expect(document.querySelector('button[aria-label="打开源码证据"]')).not.toBeNull();
    expect(document.body.textContent).toContain("知识库与图谱关联");
  });

  it("starts reading from the first recommended route page", async () => {
    await act(async () => buttonWithText("开始阅读").click());

    expect(document.querySelector("article h1")?.textContent).toBe("项目总览");
    expect(useDashboardStore.getState().activeWikiPageId).toBe("page:overview");
  });

  it("resets the real article scroller when a narrow reader changes pages", async () => {
    const scrollTo = vi.fn();
    const scrollIntoView = vi.fn();
    const scrollToDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
    const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollIntoView",
    );
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        media: "(max-width: 1023px)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })),
    });

    try {
      await act(async () => buttonWithText("项目总览").click());
      const firstScroller = document.querySelector<HTMLElement>(".uc-doc-surface");
      expect(firstScroller?.scrollTo).toBe(scrollTo);
      scrollTo.mockClear();
      scrollIntoView.mockClear();
      await act(async () => buttonWithExactText("运行流程").click());

      expect(document.querySelector("article h1")?.textContent).toBe("运行流程");
      expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      if (scrollToDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "scrollTo", scrollToDescriptor);
      } else {
        delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
      }
      if (scrollIntoViewDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollIntoViewDescriptor);
      } else {
        delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
      }
    }
  });

  it("resets and then anchors the same page for each App-owned navigation revision", async () => {
    const scrollTo = vi.fn();
    const scrollIntoView = vi.fn();
    const scrollToDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
    const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollIntoView",
    );
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    try {
      await act(async () => buttonWithText("项目总览").click());
      await vi.waitFor(() => expect(document.body.textContent).toContain("正文内容"));
      const pageId = useDashboardStore.getState().activeWikiPageId;
      if (!pageId) throw new Error("missing active Wiki page");
      scrollTo.mockClear();
      scrollIntoView.mockClear();

      await act(async () => {
        useDashboardStore.getState().openWikiTarget({ pageId, anchor: "run" });
        root.render(createElement<KnowledgeConsoleProps>(KnowledgeConsole, {
          wikiNavigationRevision: 1,
        }));
      });
      expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });

      scrollTo.mockClear();
      scrollIntoView.mockClear();
      await act(async () => {
        useDashboardStore.getState().openWikiTarget({ pageId });
        root.render(createElement<KnowledgeConsoleProps>(KnowledgeConsole, {
          wikiNavigationRevision: 2,
        }));
      });
      expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      if (scrollToDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "scrollTo", scrollToDescriptor);
      } else {
        delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
      }
      if (scrollIntoViewDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollIntoViewDescriptor);
      } else {
        delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
      }
    }
  });

  it("falls back to a current Home destination when the active page disappears", async () => {
    await act(async () => buttonWithText("项目总览").click());
    expect(currentDestinations()[0]?.textContent).toContain("项目总览");

    await act(async () => useDashboardStore.getState().setWikiIndex(emptyWikiRuntimeIndex()));

    expect(document.querySelector("main h1")?.textContent).toBe("先理解项目，再进入代码");
    expect(currentDestinations().map((item) => item.textContent)).toEqual(["阅读首页"]);
  });

  it("reveals an externally selected reference page as the only current destination", async () => {
    const scrollIntoView = vi.fn();
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    try {
      await act(async () => {
        useDashboardStore.getState().setWikiIndex(buildWikiRuntimeIndex(largeWikiFixture({
          files: 277,
          symbols: 479,
          featured: 18,
        })));
        useDashboardStore.getState().openWikiTarget({ pageId: "page:file-276" });
      });

      expect(buttonWithText("代码参考").getAttribute("aria-expanded")).toBe("true");
      expect(currentDestinations()).toHaveLength(1);
      expect(currentDestinations()[0]?.textContent).toContain("file-276.ts");
      expect(document.querySelector("article h1")?.textContent).toBe("file-276.ts");
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    } finally {
      if (descriptor) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", descriptor);
      } else {
        delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
      }
    }
  });

  it("delegates page and graph routing to the App controller when provided", async () => {
    const onSelectWikiPage = vi.fn((pageId: string | null) => {
      useDashboardStore.getState().selectWikiPage(pageId);
    });
    const onOpenGraphHome = vi.fn();
    const onOpenGraphForPage = vi.fn();
    await act(async () => {
      root.render(createElement<KnowledgeConsoleProps>(KnowledgeConsole, {
        onSelectWikiPage,
        onOpenGraphHome,
        onOpenGraphForPage,
      }));
    });

    await act(async () => buttonWithText("运行流程").click());
    expect(onSelectWikiPage).toHaveBeenLastCalledWith("page:run");
    await act(async () => buttonWithText("在图谱中查看本文节点").click());
    expect(onOpenGraphForPage).toHaveBeenCalledWith("page:run");

    await act(async () => buttonWithText("阅读首页").click());
    expect(onSelectWikiPage).toHaveBeenLastCalledWith(null);
    await act(async () => buttonWithText("查看关系图谱").click());
    expect(onOpenGraphHome).toHaveBeenCalledOnce();
  });

  it("delegates Markdown page-and-anchor targets to the App controller", async () => {
    const onSelectWikiPage = vi.fn((pageId: string | null) => {
      useDashboardStore.getState().selectWikiPage(pageId);
    });
    const onSelectWikiTarget = vi.fn((target: { pageId: string; anchor?: string }) => {
      useDashboardStore.getState().openWikiTarget(target);
    });
    await act(async () => {
      root.render(createElement<KnowledgeConsoleProps>(KnowledgeConsole, {
        onSelectWikiPage,
        onSelectWikiTarget,
      }));
    });

    await act(async () => buttonWithText("项目总览").click());
    await vi.waitFor(() => expect(document.body.textContent).toContain("打开运行流程"));
    await act(async () => linkWithText("打开运行流程").click());

    expect(onSelectWikiTarget).toHaveBeenCalledWith({
      pageId: "page:run",
      anchor: "run",
    });
  });

  it("closes a Wiki drawer before Cmd+K opens search and leaves one keyboard owner", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        media: "(max-width: 1023px)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })),
    });
    await act(async () => root.render(createElement(CoordinatedSearchHarness)));
    await act(async () => buttonWithText("知识目录").click());
    expect(document.querySelector("#wiki-navigation-drawer")?.getAttribute("role")).toBe("dialog");

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const searchDialog = document.querySelector('[aria-label="全局搜索知识库"]');
    expect(searchDialog?.getAttribute("role")).toBe("dialog");
    expect(document.querySelector("#wiki-navigation-drawer")?.hasAttribute("role")).toBe(false);
    expect(document.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);
    expect(document.activeElement?.tagName).toBe("INPUT");

    const tabEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    await act(async () => document.dispatchEvent(tabEvent));
    expect(tabEvent.defaultPrevented).toBe(false);
    expect(document.activeElement?.tagName).toBe("INPUT");

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }));
      await Promise.resolve();
    });
    expect(document.querySelector('[aria-label="全局搜索知识库"]')).toBeNull();
    expect(document.querySelector("#wiki-navigation-drawer")?.hasAttribute("role")).toBe(false);
    expect(document.activeElement).toBe(buttonWithText("搜索知识库"));
  });

  it("yields a tablet drawer to keyboard help and gives Escape one close owner", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        media: "(max-width: 1023px)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })),
    });
    await act(async () => root.render(createElement(CoordinatedSearchHarness)));
    await act(async () => buttonWithText("知识目录").click());
    await act(async () => buttonWithText("快捷键帮助").click());
    await act(async () => Promise.resolve());

    expect(document.querySelector('[aria-label="快捷键帮助"]')?.getAttribute("role")).toBe("dialog");
    expect(document.querySelector("#wiki-navigation-drawer")?.hasAttribute("role")).toBe(false);
    expect(document.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }));
      await Promise.resolve();
    });
    expect(document.querySelector('[aria-label="快捷键帮助"]')).toBeNull();
    expect(document.querySelector("#wiki-navigation-drawer")?.hasAttribute("role")).toBe(false);
    expect(document.activeElement).toBe(buttonWithText("快捷键帮助"));

    await act(async () => buttonWithText("快捷键帮助").click());
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(document.querySelector('[aria-label="快捷键帮助"]')).toBeNull();
    expect(document.querySelector('[aria-label="全局搜索知识库"]')).not.toBeNull();
    expect(document.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);
  });
});
