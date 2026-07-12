// @vitest-environment happy-dom

import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WikiResponsiveShell, {
  GLOBAL_WIKI_SEARCH_REQUEST_EVENT,
  reduceDrawerState,
  type WikiResponsiveShellProps,
} from "../WikiResponsiveShell";
import WikiEvidenceRail from "../WikiEvidenceRail";
import { wikiV2Fixture } from "../../../wiki/__tests__/fixtures/wikiV2Fixtures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface MediaController {
  setMatches: (matches: boolean) => void;
}

function installMatchMedia(initialMatches: boolean): MediaController {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = "(max-width: 1023px)";
  const query: MediaQueryList = {
    get matches() {
      return matches;
    },
    media,
    onchange: null,
    addEventListener: ((_type: string, listener: EventListenerOrEventListenerObject) =>
      listeners.add(listener as (event: MediaQueryListEvent) => void)) as MediaQueryList["addEventListener"],
    removeEventListener: ((_type: string, listener: EventListenerOrEventListenerObject) =>
      listeners.delete(listener as (event: MediaQueryListEvent) => void)) as MediaQueryList["removeEventListener"],
    addListener: (() => undefined) as MediaQueryList["addListener"],
    removeListener: (() => undefined) as MediaQueryList["removeListener"],
    dispatchEvent: () => true,
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => query),
  });
  return {
    setMatches(nextMatches) {
      matches = nextMatches;
      const event = { matches, media } as MediaQueryListEvent;
      for (const listener of listeners) listener(event);
    },
  };
}

function shellProps(withEvidence = true): {
  navigation: ReactNode;
  article: ReactNode;
  evidence?: ReactNode;
} {
  return {
    navigation: createElement(
      "nav",
      { "aria-label": "知识库目录" },
      createElement("button", { type: "button" }, "第一个目录项"),
    ),
    article: createElement(
      "article",
      { "data-testid": "article" },
      createElement("button", { type: "button" }, "正文操作"),
    ),
    ...(withEvidence
      ? {
          evidence: createElement(
            "aside",
            { "aria-label": "源码证据" },
            createElement("button", { type: "button" }, "证据操作"),
          ),
        }
      : {}),
  };
}

async function mountShell(
  withEvidence = true,
  overrides: Partial<WikiResponsiveShellProps> = {},
): Promise<{
  container: HTMLDivElement;
  root: Root;
}> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(WikiResponsiveShell, {
      ...shellProps(withEvidence),
      ...overrides,
    }));
  });
  return { container, root };
}

async function click(element: Element | null): Promise<void> {
  if (!(element instanceof HTMLElement)) throw new Error("missing clickable element");
  await act(async () => {
    element.click();
    await Promise.resolve();
  });
}

async function flushAnimationFrames(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
  });
}

async function keydown(key: string, shiftKey = false): Promise<void> {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key,
      shiftKey,
      bubbles: true,
      cancelable: true,
    }));
    await Promise.resolve();
  });
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

beforeEach(() => {
  installMatchMedia(false);
});

describe("WikiResponsiveShell", () => {
  it("keeps drawer state mutually exclusive and closes on every close action", () => {
    expect(reduceDrawerState("closed", { type: "open-navigation" })).toBe("navigation");
    expect(reduceDrawerState("navigation", { type: "open-evidence" })).toBe("evidence");
    expect(reduceDrawerState("evidence", { type: "close" })).toBe("closed");
    expect(reduceDrawerState("navigation", { type: "escape" })).toBe("closed");
  });

  it("renders one content copy, labelled triggers, and no empty evidence column", () => {
    const withEvidence = renderToStaticMarkup(createElement(WikiResponsiveShell, shellProps()));
    expect(withEvidence.match(/data-testid="article"/g)).toHaveLength(1);
    expect(withEvidence.match(/aria-label="知识库目录"/g)).toHaveLength(1);
    expect(withEvidence.match(/aria-label="源码证据"/g)).toHaveLength(1);
    expect(withEvidence).toContain('aria-label="打开知识目录"');
    expect(withEvidence).toContain('aria-label="打开源码证据"');
    expect(withEvidence).toContain('aria-controls="wiki-navigation-drawer"');
    expect(withEvidence).toContain('aria-controls="wiki-evidence-drawer"');

    const withoutEvidence = renderToStaticMarkup(createElement(WikiResponsiveShell, shellProps(false)));
    expect(withoutEvidence).not.toContain("打开源码证据");
    expect(withoutEvidence).not.toContain("wiki-evidence-drawer");
    expect(withoutEvidence).toContain('data-has-evidence="false"');

    const withNullEvidence = renderToStaticMarkup(createElement(WikiResponsiveShell, {
      ...shellProps(false),
      evidence: null,
    }));
    expect(withNullEvidence).not.toContain("打开源码证据");
    expect(withNullEvidence).not.toContain("wiki-evidence-drawer");
  });

  it("isolates a narrow navigation dialog, enters it, and traps focus both ways", async () => {
    installMatchMedia(true);
    const { container, root } = await mountShell();
    const navigationTrigger = container.querySelector('[aria-label="打开知识目录"]');
    await click(navigationTrigger);
    await flushAnimationFrames();

    const navigationDrawer = container.querySelector("#wiki-navigation-drawer");
    const evidenceDrawer = container.querySelector("#wiki-evidence-drawer");
    const article = container.querySelector(".uc-wiki-article");
    expect(navigationDrawer?.getAttribute("role")).toBe("dialog");
    expect(navigationDrawer?.getAttribute("aria-modal")).toBe("true");
    expect(navigationDrawer?.hasAttribute("inert")).toBe(false);
    expect(evidenceDrawer?.hasAttribute("inert")).toBe(true);
    expect(evidenceDrawer?.getAttribute("aria-hidden")).toBe("true");
    expect(article?.hasAttribute("inert")).toBe(true);
    expect(article?.getAttribute("aria-hidden")).toBe("true");

    const closeButton = container.querySelector('[aria-label="关闭知识目录"]');
    const directoryButton = [...container.querySelectorAll("button")]
      .find((button) => button.textContent === "第一个目录项") ?? null;
    expect(document.activeElement).toBe(closeButton);

    await keydown("Tab", true);
    expect(document.activeElement).toBe(directoryButton);
    await keydown("Tab");
    expect(document.activeElement).toBe(closeButton);

    await act(async () => root.unmount());
  });

  it("moves initial drawer focus after pointer activation and cancels the scheduled frame", async () => {
    installMatchMedia(true);
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
    const { container, root } = await mountShell();
    const trigger = container.querySelector('[aria-label="打开知识目录"]') as HTMLElement;

    await click(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const activationFrame = [...frames.entries()][0];
    if (!activationFrame) throw new Error("missing scheduled drawer activation frame");
    frames.delete(activationFrame[0]);
    await act(async () => activationFrame[1](16));
    expect(document.activeElement).toBe(trigger);

    const focusFrame = [...frames.entries()][0];
    if (!focusFrame) throw new Error("missing scheduled drawer focus frame");
    frames.delete(focusFrame[0]);
    await act(async () => focusFrame[1](32));
    expect(document.activeElement).toBe(container.querySelector('[aria-label="关闭知识目录"]'));

    await act(async () => root.unmount());
    expect(cancelFrame).toHaveBeenCalledWith(focusFrame[0]);
  });

  it("switches drawers and restores the correct trigger for Escape, close, and backdrop", async () => {
    installMatchMedia(true);
    const { container, root } = await mountShell();
    const navigationTrigger = container.querySelector('[aria-label="打开知识目录"]') as HTMLElement;
    const evidenceTrigger = container.querySelector('[aria-label="打开源码证据"]') as HTMLElement;

    await click(navigationTrigger);
    await click(evidenceTrigger);
    await flushAnimationFrames();
    expect(container.querySelector("#wiki-navigation-drawer")?.hasAttribute("inert")).toBe(true);
    expect(container.querySelector("#wiki-evidence-drawer")?.getAttribute("role")).toBe("dialog");
    expect(document.activeElement).toBe(container.querySelector('[aria-label="关闭源码证据"]'));

    await keydown("Escape");
    expect(document.activeElement).toBe(evidenceTrigger);
    expect(container.querySelector('[aria-label="关闭抽屉遮罩"]')).toBeNull();

    await click(evidenceTrigger);
    await click(container.querySelector('[aria-label="关闭源码证据"]'));
    expect(document.activeElement).toBe(evidenceTrigger);

    await click(navigationTrigger);
    await click(container.querySelector('[aria-label="关闭抽屉遮罩"]'));
    expect(document.activeElement).toBe(navigationTrigger);

    await act(async () => root.unmount());
  });

  it("includes real source-evidence summaries in the evidence drawer focus loop", async () => {
    installMatchMedia(true);
    const fixture = wikiV2Fixture();
    const page = fixture.pages.find((candidate) => candidate.id === "page:run");
    if (!page) throw new Error("missing fixture page");
    const evidenceRail = createElement(WikiEvidenceRail, {
      page,
      directPages: [],
      contextPages: [],
      evidence: fixture.evidence,
      directGraphNodeIds: [],
      headings: [],
      onOpenPage: vi.fn(),
      onOpenGraph: vi.fn(),
    });
    const { container, root } = await mountShell(true, { evidence: evidenceRail });

    await click(container.querySelector('[aria-label="打开源码证据"]'));
    await flushAnimationFrames();
    const closeButton = container.querySelector('[aria-label="关闭源码证据"]');
    const summary = container.querySelector(".uc-wiki-evidence summary");
    expect(document.activeElement).toBe(closeButton);

    await keydown("Tab", true);
    expect(document.activeElement).toBe(summary);
    await keydown("Tab");
    expect(document.activeElement).toBe(closeButton);

    await act(async () => root.unmount());
  });

  it("excludes CSS-hidden outline buttons from a sparse evidence focus loop", async () => {
    installMatchMedia(true);
    const fixture = wikiV2Fixture();
    const page = fixture.pages.find((candidate) => candidate.id === "page:run");
    if (!page) throw new Error("missing fixture page");
    const evidenceRail = createElement(WikiEvidenceRail, {
      page,
      directPages: [],
      contextPages: [],
      evidence: [],
      directGraphNodeIds: [],
      headings: [{ id: "hidden-outline", text: "隐藏目录项", level: 2 }],
      onOpenPage: vi.fn(),
      onOpenGraph: vi.fn(),
    });
    const { container, root } = await mountShell(true, { evidence: evidenceRail });
    const hiddenOutline = container.querySelector<HTMLElement>(".uc-wiki-outline");
    if (!hiddenOutline) throw new Error("missing Wiki outline");
    hiddenOutline.style.display = "none";

    await click(container.querySelector('[aria-label="打开源码证据"]'));
    await flushAnimationFrames();
    const closeButton = container.querySelector('[aria-label="关闭源码证据"]');
    expect(document.activeElement).toBe(closeButton);

    const tabEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    await act(async () => document.dispatchEvent(tabEvent));
    expect(tabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeButton);

    await act(async () => root.unmount());
  });

  it("reports drawer ownership and yields it before global search opens", async () => {
    installMatchMedia(true);
    const onDrawerOpenChange = vi.fn();
    const { container, root } = await mountShell(true, { onDrawerOpenChange });

    await click(container.querySelector('[aria-label="打开知识目录"]'));
    expect(onDrawerOpenChange).toHaveBeenLastCalledWith(true);

    await act(async () => {
      window.dispatchEvent(new Event(GLOBAL_WIKI_SEARCH_REQUEST_EVENT));
      await Promise.resolve();
    });
    expect(container.querySelector("#wiki-navigation-drawer")?.hasAttribute("role")).toBe(false);
    expect(onDrawerOpenChange).toHaveBeenLastCalledWith(false);

    await act(async () => root.unmount());
  });

  it("removes modal and inert semantics on desktop and does not revive a drawer", async () => {
    const media = installMatchMedia(true);
    const { container, root } = await mountShell();
    await click(container.querySelector('[aria-label="打开知识目录"]'));
    expect(container.querySelector("#wiki-navigation-drawer")?.getAttribute("role")).toBe("dialog");

    await act(async () => media.setMatches(false));
    expect(container.querySelector("#wiki-navigation-drawer")?.hasAttribute("role")).toBe(false);
    expect(container.querySelector("#wiki-navigation-drawer")?.hasAttribute("aria-modal")).toBe(false);
    expect(container.querySelector("#wiki-navigation-drawer")?.hasAttribute("inert")).toBe(false);
    expect(container.querySelector("#wiki-evidence-drawer")?.hasAttribute("inert")).toBe(false);
    expect(container.querySelector(".uc-wiki-article")?.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(container.querySelector("#wiki-navigation-drawer"));

    await act(async () => media.setMatches(true));
    expect(container.querySelector("#wiki-navigation-drawer")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("#wiki-navigation-drawer")?.getAttribute("data-open")).toBe("false");

    await act(async () => root.unmount());
  });

  it("moves focus to the surviving navigation trigger when evidence disappears", async () => {
    installMatchMedia(true);
    const { container, root } = await mountShell();
    await click(container.querySelector('[aria-label="打开源码证据"]'));
    await flushAnimationFrames();
    expect(document.activeElement).toBe(container.querySelector('[aria-label="关闭源码证据"]'));

    await act(async () => {
      root.render(createElement(WikiResponsiveShell, shellProps(false)));
      await Promise.resolve();
    });

    expect(container.querySelector("#wiki-evidence-drawer")).toBeNull();
    expect(document.activeElement).toBe(container.querySelector('[aria-label="打开知识目录"]'));

    await act(async () => root.unmount());
  });

  it("owns the desktop grid, narrow drawers, header offset, and reduced motion contract", () => {
    const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
    expect(css).toMatch(/\.uc-wiki-shell\s*\{[^}]*display:\s*grid/s);
    expect(css).toContain("grid-template-columns: minmax(240px, 292px) minmax(0, 1fr) minmax(268px, 320px)");
    expect(css).toContain("width: min(88vw, 360px)");
    expect(css).toContain("var(--uc-global-header-height)");
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.uc-wiki-navigation[\s\S]*transition:\s*none/);
  });
});
