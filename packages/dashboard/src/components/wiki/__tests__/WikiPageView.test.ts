// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWikiMarkdownPageLookup, markdownWithoutExplicitAnchors } from "../../../wiki/wikiContent";
import { wikiV2Fixture } from "../../../wiki/__tests__/fixtures/wikiV2Fixtures";
import {
  extractWikiOutline,
  findWikiAnchorTarget,
  resolveWikiPageViewLinkTarget,
  scrollWikiAnchor,
  WikiMarkdownDocument,
} from "../WikiPageView";
import WikiPageView from "../WikiPageView";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PAGE_SOURCE = readFileSync(join(process.cwd(), "src/components/wiki/WikiPageView.tsx"), "utf8");
const CSS = readFileSync(join(process.cwd(), "src/index.css"), "utf8");

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("WikiPageView Markdown and anchors", () => {
  it("uses a publication article shell with a stable accessible name", () => {
    const payload = wikiV2Fixture();
    const page = payload.pages[0];
    if (!page) throw new Error("缺少 Wiki 测试页面");
    const html = renderToStaticMarkup(createElement(WikiPageView, {
      page,
      pages: payload.pages,
    }));

    expect(html).toContain("uc-article-page");
    expect(html).toContain("uc-article-header");
    expect(html).toContain('<article aria-label="文档正文"');
    expect(html).not.toContain("max-w-4xl");
  });

  it("shows a fixed Chinese recovery message instead of the raw Markdown transport error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi.fn().mockRejectedValue(new Error("Failed to fetch private detail"));
    vi.stubGlobal("fetch", fetcher);
    const payload = wikiV2Fixture();
    const page = payload.pages[0];
    if (!page) throw new Error("缺少 Wiki 测试页面");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(WikiPageView, { page, pages: payload.pages }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("文档加载失败，请检查网络后重试。");
    expect(container.textContent).not.toContain("Failed to fetch");
    expect(container.textContent).not.toContain("private detail");
    expect(warn).toHaveBeenCalledWith("知识库文档加载失败", expect.any(Error));
    const recovery = container.querySelector('[role="alert"][data-severity="problem"]');
    expect(recovery?.classList.contains("uc-wiki-recovery")).toBe(true);

    await act(async () => root.unmount());
  });

  it("uses preset status tokens for both Wiki recovery states", () => {
    expect(PAGE_SOURCE).not.toMatch(/(?:border|bg)-(?:amber|red)-/);
    expect(PAGE_SOURCE.match(/uc-wiki-recovery/g)).toHaveLength(2);
    expect(PAGE_SOURCE).toContain('data-severity="context"');
    expect(PAGE_SOURCE).toContain('data-severity="problem"');
    expect(CSS).toMatch(
      /\.uc-wiki-recovery\s*\{[^}]*--uc-status-color:\s*var\(--color-graph-status-context\)[^}]*border:[^}]*var\(--uc-status-color\)[^}]*background:[^}]*var\(--uc-status-color\)/s,
    );
    expect(CSS).toMatch(
      /\.uc-wiki-recovery\[data-severity="problem"\]\s*\{[^}]*--uc-status-color:\s*var\(--color-graph-status-problem\)/s,
    );
  });

  it("keeps the committed null-page boundary compatible while Markdown props stay optional", () => {
    const html = renderToStaticMarkup(createElement(WikiPageView, {
      page: null,
      emptyReason: "请选择页面",
    }));
    expect(html).toContain("尚未选择知识库页面");
    expect(html).toContain("请选择页面");
  });

  it("uses the same explicit H2/H3/H4 IDs in the outline and rendered headings", () => {
    const markdown = [
      '<a id="入口-一"></a>',
      "## 主流程",
      '<a id="run"></a>',
      "### 入口条件",
      '<a id="类型_A"></a>',
      "#### 类型细节",
      "## 风险与核验",
      "~~~md",
      '<a id="ignored"></a>',
      "### 代码块里的假标题",
      "~~~",
    ].join("\n");
    const headings = extractWikiOutline(markdown);

    expect(headings).toEqual([
      { id: "入口-一", text: "主流程", level: 2 },
      { id: "run", text: "入口条件", level: 3 },
      { id: "类型_A", text: "类型细节", level: 4 },
      { id: "wiki-heading-7", text: "风险与核验", level: 2 },
    ]);

    const html = renderToStaticMarkup(createElement(WikiMarkdownDocument, {
      markdown: markdownWithoutExplicitAnchors(markdown),
      currentMarkdownPath: "knowledge-base/项目总览.md",
      pageIdByMarkdownPath: new Map(),
      headings,
      onSelectTarget: vi.fn(),
    }));
    for (const heading of headings) expect(html).toContain(`id="${heading.id}"`);
  });

  it("excludes headings until a valid CommonMark closing fence", () => {
    const lines = [
      "```ts",
      "```not-a-close",
      "## 反引号后缀伪关闭",
      "``",
      "### 反引号短伪关闭",
      "    ```",
      "#### 反引号缩进伪关闭",
      "```",
      "## 反引号围栏后",
      "~~~md",
      "~~~~not-a-close",
      "## 波浪后缀伪关闭",
      "~~",
      "### 波浪短伪关闭",
      "    ~~~~",
      "#### 波浪缩进伪关闭",
      "~~~~",
      "### 波浪围栏后",
      "    ```",
      "#### 四空格伪开启后",
      "```unclosed",
      "## 未闭合围栏内",
    ];

    expect(extractWikiOutline(lines.join("\n"))).toEqual([
      {
        id: `wiki-heading-${lines.indexOf("## 反引号围栏后") + 1}`,
        text: "反引号围栏后",
        level: 2,
      },
      {
        id: `wiki-heading-${lines.indexOf("### 波浪围栏后") + 1}`,
        text: "波浪围栏后",
        level: 3,
      },
      {
        id: `wiki-heading-${lines.indexOf("#### 四空格伪开启后") + 1}`,
        text: "四空格伪开启后",
        level: 4,
      },
    ]);
  });

  it("keeps GFM rendering while raw script HTML never becomes executable markup", () => {
    const markdown = [
      "| 名称 | 说明 |",
      "| --- | --- |",
      "| run | 入口 |",
      "",
      "<script>alert(1)</script>",
    ].join("\n");
    const html = renderToStaticMarkup(createElement(WikiMarkdownDocument, {
      markdown,
      currentMarkdownPath: "knowledge-base/项目总览.md",
      pageIdByMarkdownPath: new Map(),
      headings: [],
      onSelectTarget: vi.fn(),
    }));

    expect(html).toContain("<table");
    expect(html).not.toContain("<script");
  });

  it("resolves a relative Markdown link to a full target and canonical href", () => {
    const lookup = buildWikiMarkdownPageLookup([
      { id: "page:overview", markdownPath: "knowledge-base/项目总览.md" },
      { id: "page:file-a", markdownPath: "knowledge-base/文件文档/src-a.ts.md" },
    ]);
    expect(resolveWikiPageViewLinkTarget(
      "knowledge-base/业务流程/运行流程.md",
      "../文件文档/src-a.ts.md#run",
      lookup,
    )).toEqual({ pageId: "page:file-a", anchor: "run" });
    expect(resolveWikiPageViewLinkTarget(
      "knowledge-base/业务流程/运行流程.md",
      "../项目总览.md",
      lookup,
    )).toEqual({ pageId: "page:overview" });

    const html = renderToStaticMarkup(createElement(WikiMarkdownDocument, {
      markdown: "[查看 run](../文件文档/src-a.ts.md#run)",
      currentMarkdownPath: "knowledge-base/业务流程/运行流程.md",
      pageIdByMarkdownPath: lookup,
      headings: [],
      onSelectTarget: vi.fn(),
    }));
    expect(html).toContain("#wiki=page%3Afile-a&amp;anchor=run");

    const pageOnlyHtml = renderToStaticMarkup(createElement(WikiMarkdownDocument, {
      markdown: "[返回总览](../项目总览.md)",
      currentMarkdownPath: "knowledge-base/业务流程/运行流程.md",
      pageIdByMarkdownPath: lookup,
      headings: [],
      onSelectTarget: vi.fn(),
    }));
    expect(pageOnlyHtml).toContain("#wiki=page%3Aoverview");
  });

  it("scopes anchor lookup to the active article and keeps a missing target retryable", () => {
    const outsideScroll = vi.fn();
    const insideScroll = vi.fn();
    const outside = { id: "run", scrollIntoView: outsideScroll } as unknown as HTMLElement;
    const inside = { id: "run", scrollIntoView: insideScroll } as unknown as HTMLElement;
    let descendants: HTMLElement[] = [];
    const article = {
      querySelectorAll: () => descendants,
    } as unknown as Pick<HTMLElement, "querySelectorAll">;

    expect(findWikiAnchorTarget(article, "run")).toBeNull();
    expect(scrollWikiAnchor(article, "run")).toBe(false);
    expect(outsideScroll).not.toHaveBeenCalled();

    descendants = [inside];
    expect(findWikiAnchorTarget(article, "run")).toBe(inside);
    expect(scrollWikiAnchor(article, "run")).toBe(true);
    expect(insideScroll).toHaveBeenCalledWith({ block: "start" });
    expect(outside).not.toBe(inside);
    expect(outsideScroll).not.toHaveBeenCalled();
  });
});
