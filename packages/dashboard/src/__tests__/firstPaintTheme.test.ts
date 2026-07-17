// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InitialThemeGate } from "../themes/InitialThemeGate";
import type { ThemeConfig } from "../themes/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: new Window().localStorage,
});

const INDEX_HTML = readFileSync(join(process.cwd(), "index.html"), "utf8");
const APP_SOURCE = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
const GATE_SOURCE = readFileSync(join(process.cwd(), "src/themes/InitialThemeGate.tsx"), "utf8");
const BOOTSTRAP = INDEX_HTML.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];

function executeBootstrap(raw: string | null): { preset: string | undefined; scheme: string | undefined } {
  localStorage.clear();
  document.documentElement.dataset.themePreset = "technical-document";
  document.documentElement.dataset.themeScheme = "light";
  document.documentElement.dataset.theme = "light";
  document.documentElement.style.colorScheme = "light";
  if (raw !== null) localStorage.setItem("uc-theme", raw);
  if (!BOOTSTRAP) throw new Error("missing theme bootstrap");
  Function(BOOTSTRAP)();
  return {
    preset: document.documentElement.dataset.themePreset,
    scheme: document.documentElement.dataset.themeScheme,
  };
}

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("first paint theme contract", () => {
  it("declares Chinese and executes the v2/v3 bootstrap matrix", () => {
    expect(INDEX_HTML).toContain('lang="zh-CN"');
    expect(INDEX_HTML).toContain('data-theme-preset="technical-document"');
    expect(executeBootstrap(JSON.stringify({ version: 2, presetId: "engineering-workbench" })))
      .toEqual({ preset: "night-ink", scheme: "dark" });
    expect(executeBootstrap(JSON.stringify({ version: 3, presetId: "sage-paper" })))
      .toEqual({ preset: "sage-paper", scheme: "light" });
    expect(executeBootstrap(JSON.stringify({ version: 99, presetId: "night-ink" })))
      .toEqual({ preset: "technical-document", scheme: "light" });
    expect(executeBootstrap(JSON.stringify({ version: 3, presetId: "unknown" })))
      .toEqual({ preset: "technical-document", scheme: "light" });
  });

  it("contains bootstrap storage failures without blocking startup", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(executeBootstrap(null)).toEqual({
      preset: "technical-document",
      scheme: "light",
    });
  });

  it("publishes no themed content until deferred meta resolves", async () => {
    let resolveMeta!: (config: ThemeConfig) => void;
    const loadMetaTheme = vi.fn(() => new Promise<ThemeConfig>((resolve) => {
      resolveMeta = resolve;
    }));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(createElement(InitialThemeGate, {
      metaUrl: "/meta.json",
      readStoredTheme: () => null,
      loadMetaTheme,
      children: (config) => createElement(
        "div",
        { "data-content-preset": config.presetId },
        "知识库主内容",
      ),
    })));

    expect(container.textContent).toBe("正在准备阅读界面");
    expect(container.textContent).not.toContain("知识库主内容");
    await act(async () => {
      resolveMeta({ presetId: "sage-paper" });
      await Promise.resolve();
    });
    expect(container.querySelector('[data-content-preset="sage-paper"]')).not.toBeNull();
    expect(document.documentElement.dataset.themePreset).toBe("sage-paper");
    await act(async () => root.unmount());
  });

  it("keeps App wired through the tested gate", () => {
    expect(GATE_SOURCE).toContain("正在准备阅读界面");
    expect(APP_SOURCE).toContain("<InitialThemeGate");
    expect(APP_SOURCE).not.toContain("metaTheme");
  });
});
