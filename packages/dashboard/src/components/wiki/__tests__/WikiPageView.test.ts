import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildWikiMarkdownPageLookup, markdownWithoutExplicitAnchors } from "../../../wiki/wikiContent";
import {
  extractWikiOutline,
  findWikiAnchorTarget,
  resolveWikiPageViewLinkTarget,
  scrollWikiAnchor,
  WikiMarkdownDocument,
} from "../WikiPageView";
import WikiPageView from "../WikiPageView";

describe("WikiPageView Markdown and anchors", () => {
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
