// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphQuickJumpItem } from "../../../graphExplorer/graphQuickJump.js";
import { GraphQuickJump } from "../GraphQuickJump.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ITEMS: GraphQuickJumpItem[] = [
  {
    id: "scope:app",
    kind: "scope",
    label: "应用模块",
    path: null,
    typeLabel: "模块",
    intent: {
      source: "quick-jump",
      navigation: { level: "overview" },
      materializedNodeId: "scope:app",
      selectionId: "scope:app",
    },
  },
  {
    id: "file:packages/api/src/routes/user.ts",
    kind: "file",
    label: "user.ts",
    path: "packages/api/src/routes/user.ts",
    typeLabel: "文件",
    intent: {
      source: "quick-jump",
      navigation: { level: "cluster", scopeId: "app", clusterId: "routes" },
      materializedNodeId: "file:packages/api/src/routes/user.ts",
      selectionId: "file:packages/api/src/routes/user.ts",
    },
  },
  {
    id: "function:packages/api/src/routes/user.ts:loadUser",
    kind: "symbol",
    label: "loadUser",
    path: "packages/api/src/routes/user.ts",
    typeLabel: "函数",
    intent: {
      source: "quick-jump",
      navigation: {
        level: "file",
        scopeId: "app",
        clusterId: "routes",
        fileId: "file:packages/api/src/routes/user.ts",
      },
      materializedNodeId: "function:packages/api/src/routes/user.ts:loadUser",
      selectionId: "function:packages/api/src/routes/user.ts:loadUser",
    },
  },
];

describe("GraphQuickJump", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onSelect: ReturnType<typeof vi.fn<(intent: GraphQuickJumpItem["intent"]) => void>>;
  let scrollIntoView: ReturnType<typeof vi.fn>;
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(16);
      return 1;
    });
    container = document.createElement("div");
    document.body.replaceChildren(container);
    root = createRoot(container);
    onSelect = vi.fn();
    scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    if (originalScrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: originalScrollIntoView,
      });
    } else {
      delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
    vi.restoreAllMocks();
  });

  async function renderJump(items: readonly GraphQuickJumpItem[] = ITEMS): Promise<void> {
    await act(async () => root.render(createElement(GraphQuickJump, { items, onSelect })));
  }

  async function click(target: Element | null): Promise<void> {
    if (!(target instanceof HTMLElement)) throw new Error("missing click target");
    await act(async () => target.click());
  }

  async function type(input: HTMLInputElement, value: string): Promise<void> {
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (!valueSetter) throw new Error("missing input value setter");
      valueSetter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });
  }

  async function key(input: HTMLInputElement, value: string): Promise<KeyboardEvent> {
    const event = new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true });
    await act(async () => input.dispatchEvent(event));
    return event;
  }

  it("opens the combobox, keeps input focus, and submits the keyboard-active option", async () => {
    await renderJump();
    const trigger = container.querySelector<HTMLButtonElement>("button");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    await click(trigger);
    const input = container.querySelector<HTMLInputElement>('[role="combobox"][aria-label="搜索图谱对象"]')!;
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    expect(document.activeElement).toBe(input);

    await type(input, "user");
    const options = [...container.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(options).toHaveLength(2);
    expect(options.every((option) => option.getAttribute("tabindex") === "-1")).toBe(true);
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0]!.id);
    await key(input, "ArrowDown");
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute("aria-activedescendant")).toBe(options[1]!.id);
    const bubbled = vi.fn();
    document.addEventListener("keydown", bubbled);
    const enter = await key(input, "Enter");

    expect(enter.defaultPrevented).toBe(true);
    expect(bubbled).not.toHaveBeenCalled();
    document.removeEventListener("keydown", bubbled);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(ITEMS[2]!.intent);
    expect(container.querySelector('[role="combobox"]')).toBeNull();
  });

  it("wraps Arrow keys, clears stale active descendants for no results, and blocks handled shortcuts", async () => {
    await renderJump();
    await click(container.querySelector("button"));
    const input = container.querySelector<HTMLInputElement>('[role="combobox"]')!;
    const options = [...container.querySelectorAll<HTMLElement>('[role="option"]')];

    const up = await key(input, "ArrowUp");
    expect(up.defaultPrevented).toBe(true);
    expect(input.getAttribute("aria-activedescendant")).toBe(options.at(-1)!.id);
    await key(input, "ArrowDown");
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0]!.id);

    await type(input, "no matching graph object");
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(input.getAttribute("aria-activedescendant")).toBeNull();
    const status = container.querySelector<HTMLElement>('[role="status"]');
    expect(status?.getAttribute("aria-live")).toBe("polite");
    await key(input, "Enter");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("scrolls the active option into view while keyboarding through thirty results", async () => {
    const manyItems = Array.from({ length: 30 }, (_, index): GraphQuickJumpItem => ({
      id: `file:src/item-${String(index).padStart(2, "0")}.ts`,
      kind: "file",
      label: `文件 ${String(index).padStart(2, "0")}`,
      path: `src/item-${String(index).padStart(2, "0")}.ts`,
      typeLabel: "文件",
      intent: {
        source: "quick-jump",
        navigation: { level: "cluster", scopeId: "app", clusterId: "src" },
        materializedNodeId: `file:src/item-${String(index).padStart(2, "0")}.ts`,
        selectionId: `file:src/item-${String(index).padStart(2, "0")}.ts`,
      },
    }));
    await renderJump(manyItems);
    await click(container.querySelector("button"));
    const input = container.querySelector<HTMLInputElement>('[role="combobox"]')!;
    scrollIntoView.mockClear();

    for (let index = 0; index < 29; index += 1) await key(input, "ArrowDown");

    const options = [...container.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(input.getAttribute("aria-activedescendant")).toBe(options[29]!.id);
    expect(document.activeElement).toBe(input);
    expect(scrollIntoView).toHaveBeenCalledTimes(29);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest" });
  });

  it.each([
    { label: "Tab", shiftKey: false },
    { label: "Shift+Tab", shiftKey: true },
  ])("closes without blocking or stealing focus when $label leaves the popover", async ({ shiftKey }) => {
    await renderJump();
    const trigger = container.querySelector<HTMLButtonElement>("button")!;
    const outside = document.createElement("button");
    outside.textContent = "外部焦点";
    document.body.append(outside);
    await click(trigger);
    const input = container.querySelector<HTMLInputElement>('[role="combobox"]')!;
    const bubbled = vi.fn();
    document.addEventListener("keydown", bubbled);
    const tab = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey,
      bubbles: true,
      cancelable: true,
    });
    let focusOut: FocusEvent;
    await act(async () => {
      input.dispatchEvent(tab);
      focusOut = new FocusEvent("focusout", {
        bubbles: true,
        cancelable: true,
        relatedTarget: outside,
      });
      input.dispatchEvent(focusOut);
      outside.focus();
    });
    document.removeEventListener("keydown", bubbled);

    expect(tab.defaultPrevented).toBe(false);
    expect(bubbled).toHaveBeenCalledTimes(1);
    expect(focusOut!.defaultPrevented).toBe(false);
    expect(container.querySelector('[role="combobox"]')).toBeNull();
    expect(document.activeElement).toBe(outside);
  });

  it("restores trigger focus on Escape but outside click closes without stealing focus", async () => {
    await renderJump();
    const trigger = container.querySelector<HTMLButtonElement>("button")!;
    await click(trigger);
    const input = container.querySelector<HTMLInputElement>('[role="combobox"]')!;
    const bubbled = vi.fn();
    document.addEventListener("keydown", bubbled);
    const escape = await key(input, "Escape");
    expect(escape.defaultPrevented).toBe(true);
    expect(bubbled).not.toHaveBeenCalled();
    document.removeEventListener("keydown", bubbled);
    expect(container.querySelector('[role="combobox"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    const outside = document.createElement("button");
    outside.textContent = "外部操作";
    document.body.append(outside);
    await click(trigger);
    await act(async () => {
      outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      outside.focus();
    });
    expect(container.querySelector('[role="combobox"]')).toBeNull();
    expect(document.activeElement).toBe(outside);
  });

  it("exposes listbox semantics, visible type labels, paths, and 44px target classes", async () => {
    await renderJump();
    const trigger = container.querySelector<HTMLButtonElement>("button")!;
    expect(trigger.textContent).toContain("快速定位");
    expect(trigger.className).toContain("uc-graph-quick-jump-trigger");
    await click(trigger);
    const input = container.querySelector<HTMLInputElement>('[role="combobox"]')!;
    const listbox = container.querySelector<HTMLElement>('[role="listbox"]')!;
    const option = listbox.querySelector<HTMLElement>('[role="option"]')!;
    expect(input.getAttribute("aria-controls")).toBe(listbox.id);
    expect(input.className).toContain("uc-graph-quick-jump-input");
    expect(option.className).toContain("uc-graph-quick-jump-option");
    expect(listbox.textContent).toContain("文件");
    expect(listbox.textContent).toContain("packages/api/src/routes/user.ts");

    const componentSource = readFileSync(join(process.cwd(), "src/components/graphExplorer/GraphQuickJump.tsx"), "utf8");
    const cssSource = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
    expect(componentSource).not.toContain("<svg");
    expect(cssSource).toContain(".uc-graph-quick-jump-popover");
    expect(cssSource).toMatch(/width:\s*min\(360px,\s*calc\(100vw - 24px\)\)/);
    expect(cssSource).toMatch(/max-height:\s*70dvh/);
    const compactRule = cssSource.slice(cssSource.lastIndexOf("@media (max-width: 1023px)"));
    expect(compactRule).toMatch(/\.uc-graph-quick-jump\s*\{[^}]*width:\s*100%;/s);
    expect(compactRule).toMatch(/left:\s*0;/);
    expect(compactRule).toMatch(/right:\s*auto;/);
    expect(compactRule).toMatch(/width:\s*100%;/);
    expect(compactRule).toMatch(/max-width:\s*360px;/);
  });

  it("right-anchors the 1024–1279 tools panel without changing compact Quick Jump geometry", () => {
    const cssSource = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
    const tabletStart = cssSource.indexOf("@media (min-width: 1024px) and (max-width: 1279px)");
    const compactStart = cssSource.indexOf("@media (max-width: 1023px)", tabletStart);
    expect(tabletStart).toBeGreaterThan(-1);
    expect(compactStart).toBeGreaterThan(tabletStart);

    const tabletRule = cssSource.slice(tabletStart, compactStart);
    expect(tabletRule).toMatch(/\.uc-graph-tools__panel\s*\{[^}]*right:\s*0;[^}]*left:\s*auto;/s);

    const compactRule = cssSource.slice(compactStart);
    expect(compactRule).toMatch(/\.uc-graph-tools__panel\s*\{[^}]*max-width:\s*360px;/s);
    expect(compactRule).toMatch(/\.uc-graph-quick-jump-popover\s*\{[^}]*left:\s*0;[^}]*right:\s*auto;[^}]*width:\s*100%;[^}]*max-width:\s*360px;/s);
  });
});
