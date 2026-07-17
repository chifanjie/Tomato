import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../themes/ThemeContext";
import DashboardHeader from "../DashboardHeader";

const CSS = readFileSync(join(process.cwd(), "src/index.css"), "utf8");

function renderHeader(activeSurface: "wiki" | "graph" = "wiki"): string {
  return renderToStaticMarkup(createElement(
    ThemeProvider,
    { initialConfig: { presetId: "technical-document" } },
    createElement(DashboardHeader, {
      projectName: "一个很长但不应该挤掉全局操作的项目名称",
      activeSurface,
      searchButtonRef: createRef<HTMLButtonElement>(),
      themeInert: false,
      onSelectSurface: vi.fn(),
      onRequestSearch: vi.fn(),
    }),
  ));
}

describe("DashboardHeader", () => {
  it("publishes only the Wiki-first global destinations and tools", () => {
    const html = renderHeader();
    expect(html).toContain('aria-label="主要界面"');
    expect(html).toContain("知识库");
    expect(html).toContain("关系图谱");
    expect(html).toContain("搜索");
    expect(html).toContain("主题");
    expect(html).toContain("更多");
    expect(html).toContain("uc-mobile-header-more-panel");
    expect(html).not.toMatch(/Persona|Domain|Structural|Diff|PathFinder|Tour|Onboarding/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("keeps the full project name available after visual truncation", () => {
    const html = renderHeader("graph");
    expect(html).toContain('title="一个很长但不应该挤掉全局操作的项目名称"');
    expect(html).toContain("uc-global-header-project");
    expect(html).toMatch(/<button[^>]*aria-current="page"[^>]*>关系图谱<\/button>/);
  });

  it("locks the 390px and 320px rows and touch-target floor", () => {
    expect(CSS).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*grid-template-rows:\s*48px 56px/);
    for (const selector of [
      ".uc-surface-switcher button",
      ".uc-mobile-header-more > summary",
      ".uc-global-search-trigger",
      ".uc-theme-trigger",
    ]) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(CSS).toMatch(new RegExp(escaped + "\\s*\\{[^}]*min-width:\\s*44px[^}]*min-height:\\s*44px", "s"));
    }
  });
});
