// @vitest-environment happy-dom

import type { WikiSearchRecordV2 } from "@understand-code/core/knowledge-base";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement, createRef, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWikiRuntimeIndex } from "../../../wiki/wikiIndex";
import { buildWikiSearchRuntime, searchWiki, type WikiSearchResults } from "../../../wiki/searchIndex";
import { searchFixture, wikiV2Fixture } from "../../../wiki/__tests__/fixtures/wikiV2Fixtures";
import GlobalWikiSearch, {
  buildGlobalWikiSearchView,
  globalWikiSearchStatusMessage,
  searchRelationLabel,
} from "../GlobalWikiSearch";

const CSS = readFileSync(join(process.cwd(), "src/index.css"), "utf8");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function runtime(mode: "full" | "fallback" = "full", records = searchFixture()) {
  return buildWikiSearchRuntime(records, buildWikiRuntimeIndex(wikiV2Fixture()), mode);
}

describe("GlobalWikiSearch", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("renders nothing while closed", () => {
    const html = renderToStaticMarkup(createElement(GlobalWikiSearch, {
      open: false,
      loadStatus: "idle",
      runtime: runtime(),
      returnFocusRef: createRef<HTMLButtonElement>(),
      onClose: vi.fn(),
      onSelectTarget: vi.fn(),
    }));
    expect(html).toBe("");
  });

  it("builds all five Chinese groups in order with pre-page totals and a symbol target", () => {
    const view = buildGlobalWikiSearchView(runtime(), "表单校验", 20);
    expect(view.groups.map((group) => [group.kind, group.label, group.total])).toEqual([
      ["direct", "最佳结果", 1],
      ["capability-flow", "能力与流程", 1],
      ["module-file", "模块与文件", 1],
      ["symbol", "函数与类型", 1],
      ["context", "相关资料", 1],
    ]);
    expect(view.groups.find((group) => group.kind === "symbol")?.items[0]).toMatchObject({
      target: { pageId: "page:file-a", anchor: "run" },
      href: "#wiki=page%3Afile-a&anchor=run",
    });
  });

  it("labels relation:none as a content match instead of direct coverage", () => {
    expect(searchRelationLabel({ relation: "none", kind: "page" })).toBe("按内容匹配");
    expect(searchRelationLabel({ relation: "direct", kind: "page" })).toBe("直接文档");
  });

  it("shows a fallback warning only for fallback mode", () => {
    const render = (mode: "full" | "fallback") => renderToStaticMarkup(createElement(GlobalWikiSearch, {
      open: true,
      loadStatus: mode === "fallback" ? "fallback" : "ready",
      runtime: runtime(mode),
      returnFocusRef: createRef<HTMLButtonElement>(),
      onClose: vi.fn(),
      onSelectTarget: vi.fn(),
    }));
    expect(render("fallback")).toContain("搜索索引不可用，当前仅搜索标题、路径和符号");
    expect(render("full")).not.toContain("搜索索引不可用");
  });

  it("uses deterministic Chinese loading, no-query, and no-result messages", () => {
    expect(globalWikiSearchStatusMessage("loading", "", 0)).toBe("输入文档、流程、文件或函数名称开始搜索。");
    expect(globalWikiSearchStatusMessage("loading", "不存在", 0)).toContain("全文索引仍在加载");
    expect(globalWikiSearchStatusMessage("ready", "", 0)).toBe("输入文档、流程、文件或函数名称开始搜索。");
    expect(globalWikiSearchStatusMessage("ready", "不存在", 0)).toBe("没有找到匹配内容，请尝试其他关键词。");
    expect(globalWikiSearchStatusMessage("ready", "run", 1)).toBeNull();
  });

  it("uses quiet publication chrome without decorative glyphs or heavy blur", () => {
    const html = renderToStaticMarkup(createElement(GlobalWikiSearch, {
      open: true,
      loadStatus: "ready",
      runtime: runtime(),
      returnFocusRef: createRef<HTMLButtonElement>(),
      onClose: vi.fn(),
      onSelectTarget: vi.fn(),
    }));
    expect(html).toContain("uc-global-search-dialog");
    expect(html).toContain("uc-global-search-results");
    expect(html).not.toContain("⌕");
    expect(html).not.toContain("backdrop-blur");
    expect(html).not.toContain("shadow-2xl");
    expect(html).toContain('<label for="global-wiki-search-input"');
    expect(html).toContain('id="global-wiki-search-input"');
    expect(html).toContain('aria-label="关闭搜索"');
    expect(html).toContain("关闭</button>");
    expect(html).not.toContain("×</button>");

    const emptyHtml = renderToStaticMarkup(createElement(GlobalWikiSearch, {
      open: true,
      loadStatus: "ready",
      runtime: runtime(),
      returnFocusRef: createRef<HTMLButtonElement>(),
      onClose: vi.fn(),
      onSelectTarget: vi.fn(),
    }));
    expect(emptyHtml).toContain("输入文档、流程、文件或函数名称开始搜索。");
    expect(emptyHtml).not.toContain("本组暂无匹配");
  });

  it("keeps search results touchable and metadata readable", () => {
    expect(CSS).toMatch(/\.uc-global-search-results a\s*\{[^}]*min-height:\s*44px;/s);
    expect(CSS).toMatch(/\.uc-global-search-more\s*\{[^}]*min-height:\s*44px;/s);
    expect(CSS).toMatch(/\.uc-global-search-hint\s*\{[^}]*font-size:\s*12px;/s);
    expect(CSS).toMatch(/\.uc-global-search-relation\s*\{[^}]*font-size:\s*12px;/s);
    expect(CSS).toMatch(/\.uc-global-search-metadata\s*\{[^}]*font-size:\s*13px;/s);
  });

  it("expands the visible prefix without duplicate IDs", () => {
    const base = searchFixture()[0]!;
    const records: WikiSearchRecordV2[] = Array.from({ length: 45 }, (_, index) => ({
      ...base,
      id: `search:page-${index}`,
      title: `表单校验 ${index + 1}`,
    }));
    const first = buildGlobalWikiSearchView(runtime("full", records), "表单校验", 20);
    const expanded = buildGlobalWikiSearchView(runtime("full", records), "表单校验", 40);
    const firstIds = first.groups.flatMap((group) => group.items.map((item) => item.record.id));
    const expandedIds = expanded.groups.flatMap((group) => group.items.map((item) => item.record.id));

    expect(firstIds).toHaveLength(20);
    expect(expandedIds).toHaveLength(40);
    expect(expandedIds.slice(0, 20)).toEqual(firstIds);
    expect(new Set(expandedIds).size).toBe(40);
    expect(expanded.hasNextPage).toBe(true);
  });

  it("focuses after pointer activation, traps Tab both ways, and restores the trigger on Escape", async () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 1;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const frame = nextFrame;
      nextFrame += 1;
      frames.set(frame, callback);
      return frame;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frame) => {
      frames.delete(frame);
    });

    let rerenderParent: (() => void) | null = null;
    function Harness() {
      const [open, setOpen] = useState(false);
      const [, setRevision] = useState(0);
      const triggerRef = useRef<HTMLButtonElement>(null);
      rerenderParent = () => setRevision((value) => value + 1);
      return createElement(
        "div",
        null,
        createElement("button", {
          ref: triggerRef,
          type: "button",
          onClick: () => queueMicrotask(() => setOpen(true)),
        }, "搜索知识库"),
        createElement(GlobalWikiSearch, {
          open,
          loadStatus: "fallback",
          runtime: runtime("fallback"),
          returnFocusRef: triggerRef,
          onClose: () => setOpen(false),
          onSelectTarget: vi.fn(),
        }),
      );
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(createElement(Harness)));
    const trigger = container.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      trigger.click();
      await Promise.resolve();
    });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const containmentFrame = [...frames.entries()][0];
    if (!containmentFrame) throw new Error("missing scheduled search containment frame");
    frames.delete(containmentFrame[0]);
    await act(async () => containmentFrame[1](16));
    const input = container.querySelector("input") as HTMLInputElement;
    const closeButton = container.querySelector('[aria-label="关闭搜索"]') as HTMLButtonElement;
    expect(document.activeElement).toBe(input);

    await act(async () => input.blur());
    expect(document.activeElement).toBe(document.body);
    const recoveryFrame = [...frames.entries()][0];
    if (!recoveryFrame) throw new Error("missing search focus-containment frame");
    frames.delete(recoveryFrame[0]);
    await act(async () => recoveryFrame[1](48));
    expect(document.activeElement).toBe(input);

    const reverseTab = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => document.dispatchEvent(reverseTab));
    expect(reverseTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeButton);

    const forwardTab = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    await act(async () => document.dispatchEvent(forwardTab));
    expect(forwardTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);

    closeButton.focus();
    await act(async () => rerenderParent?.());
    expect(frames.size).toBe(0);
    expect(document.activeElement).toBe(closeButton);

    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })));
    expect(container.querySelector('[aria-label="全局搜索知识库"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
  });

  it("searches fallback content while loading and preserves query and focus when full results arrive", async () => {
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    const props = { open: true, returnFocusRef: createRef<HTMLButtonElement>(), onClose: vi.fn(), onSelectTarget: vi.fn() };
    try {
      await act(async () => root.render(createElement(GlobalWikiSearch, { ...props, loadStatus: "loading", runtime: runtime("fallback") })));
      const input = container.querySelector("input")!;
      expect(input.disabled).toBe(false);
      expect(document.activeElement).toBe(input);
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "运行");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(container.textContent).toContain("正在补充全文索引");
      expect(container.querySelector("a[href]")?.textContent).toContain("运行流程");
      await act(async () => root.render(createElement(GlobalWikiSearch, { ...props, loadStatus: "ready", runtime: runtime() })));
      expect(input.value).toBe("运行");
      expect(document.activeElement).toBe(input);
      expect(container.textContent).not.toContain("正在补充全文索引");
    } finally { await act(async () => root.unmount()); }
  });

  it("keeps input and fallback usable while a worker query runs and ignores an older result", async () => {
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    const pending = new Map<string, (result: WikiSearchResults) => void>();
    const full = runtime();
    const remote = { ...runtime("full", []), fallbackRuntime: runtime("fallback"),
      searchAsync: vi.fn((query: string) => new Promise<WikiSearchResults>((resolve) => pending.set(query, resolve))) };
    const props = { open: true, loadStatus: "ready" as const, runtime: remote,
      returnFocusRef: createRef<HTMLButtonElement>(), onClose: vi.fn(), onSelectTarget: vi.fn() };
    try {
      await act(async () => root.render(createElement(GlobalWikiSearch, props)));
      const input = container.querySelector("input")!;
      const type = async (value: string) => act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await type("运行");
      expect(input.disabled).toBe(false);
      expect(document.activeElement).toBe(input);
      expect(container.textContent).toContain("正在搜索全文");
      expect(container.querySelector("a[href]")?.textContent).toContain("运行流程");
      await type("没有此关键词");
      await act(async () => pending.get("没有此关键词")!(searchWiki(full, "没有此关键词", 1, 20)));
      expect(container.textContent).toContain("没有找到匹配内容");
      await act(async () => pending.get("运行")!(searchWiki(full, "运行", 1, 20)));
      expect(input.value).toBe("没有此关键词");
      expect(container.querySelector("a[href]")).toBeNull();
      expect(document.activeElement).toBe(input);
    } finally { await act(async () => root.unmount()); }
  });

  it("offers a retry for a failed worker without turning old generation results into current results", async () => {
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    let finishOld!: (result: WikiSearchResults) => void;
    const oldRuntime = { ...runtime("full", []), searchAsync: () => new Promise<WikiSearchResults>((resolve) => { finishOld = resolve; }) };
    const currentRuntime = { ...runtime("full", []), searchAsync: async () => { throw new Error("worker stopped"); } };
    const retry = vi.fn();
    const props = { open: true, loadStatus: "ready" as const, returnFocusRef: createRef<HTMLButtonElement>(),
      onClose: vi.fn(), onSelectTarget: vi.fn(), onRetry: retry };
    try {
      await act(async () => root.render(createElement(GlobalWikiSearch, { ...props, runtime: oldRuntime })));
      const input = container.querySelector("input")!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "运行");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => root.render(createElement(GlobalWikiSearch, { ...props, runtime: currentRuntime })));
      await act(async () => finishOld(searchWiki(runtime(), "运行", 1, 20)));
      expect(container.querySelector("a[href]")).toBeNull();
      expect(container.textContent).toContain("全文搜索暂不可用");
      const button = [...container.querySelectorAll("button")].find((item) => item.textContent === "重试完整搜索")!;
      await act(async () => button.click());
      expect(retry).toHaveBeenCalledOnce();
    } finally { await act(async () => root.unmount()); }
  });

  it("distinguishes a later group's matches from a truly empty group on the first page", async () => {
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    const source = searchFixture();
    const first = source.find((record) => record.kind === "page" && record.category === "overview")!;
    const symbol = source.find((record) => record.kind === "symbol")!;
    const records = [...Array.from({ length: 25 }, (_, i) => ({ ...first, id: `bulk:${i}`, title: `批量 ${i}` })), { ...symbol, title: "批量函数" }];
    try {
      await act(async () => root.render(createElement(GlobalWikiSearch, { open: true, loadStatus: "ready", runtime: runtime("full", records),
        returnFocusRef: createRef<HTMLButtonElement>(), onClose: vi.fn(), onSelectTarget: vi.fn() })));
      const input = container.querySelector("input")!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "批量");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(container.querySelector('[aria-label="函数与类型"]')?.textContent).toContain("本组还有匹配结果，继续显示可查看");
      expect(container.querySelector('[aria-label="能力与流程"]')?.textContent).toContain("本组暂无匹配");
    } finally { await act(async () => root.unmount()); }
  });

  it("does not steal focus from another internal result while ready focus is pending", async () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 1;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const frame = nextFrame;
      nextFrame += 1;
      frames.set(frame, callback);
      return frame;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frame) => {
      frames.delete(frame);
    });
    const flushFrames = async () => {
      const currentFrames = [...frames.entries()];
      frames.clear();
      for (const [, callback] of currentFrames) {
        await act(async () => callback(16));
      }
    };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const props = {
      open: true,
      runtime: runtime(),
      returnFocusRef: createRef<HTMLButtonElement>(),
      onClose: vi.fn(),
      onSelectTarget: vi.fn(),
    };

    await act(async () => root.render(createElement(GlobalWikiSearch, {
      ...props,
      loadStatus: "ready",
    })));
    while (frames.size > 0) await flushFrames();
    const input = container.querySelector("input") as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    if (!valueSetter) throw new Error("missing input value setter");
    await act(async () => {
      valueSetter.call(input, "表单校验");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });
    expect(container.querySelector("a[href]")).not.toBeNull();

    await act(async () => root.render(createElement(GlobalWikiSearch, {
      ...props,
      loadStatus: "loading",
    })));
    const closeButton = container.querySelector('[aria-label="关闭搜索"]') as HTMLButtonElement;
    closeButton.focus();
    await act(async () => root.render(createElement(GlobalWikiSearch, {
      ...props,
      loadStatus: "ready",
    })));
    const result = container.querySelector("a[href]") as HTMLAnchorElement;
    result.focus();
    await flushFrames();

    expect(document.activeElement).toBe(result);

    await act(async () => root.unmount());
  });

  it("cancels a pending focus frame when search closes after its activation frame", async () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 1;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const frame = nextFrame;
      nextFrame += 1;
      frames.set(frame, callback);
      return frame;
    });
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frame) => {
      frames.delete(frame);
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const props = {
      loadStatus: "ready" as const,
      runtime: runtime(),
      returnFocusRef: createRef<HTMLButtonElement>(),
      onClose: vi.fn(),
      onSelectTarget: vi.fn(),
    };

    await act(async () => root.render(createElement(GlobalWikiSearch, { ...props, open: true })));
    const activationFrame = [...frames.entries()][0];
    if (!activationFrame) throw new Error("missing search activation frame");
    frames.delete(activationFrame[0]);
    await act(async () => activationFrame[1](16));
    const pendingFocusFrame = [...frames.keys()][0];
    if (!pendingFocusFrame) throw new Error("missing pending search focus frame");

    await act(async () => root.render(createElement(GlobalWikiSearch, { ...props, open: false })));
    expect(cancelFrame).toHaveBeenCalledWith(pendingFocusFrame);
    expect([...frames.keys()]).toEqual([]);

    await act(async () => root.unmount());
  });
});
