import { describe, expect, it, vi } from "vitest";
import {
  buildWikiMarkdownPageLookup,
  extractExplicitAnchors,
  loadWikiMarkdown,
  markdownWithoutExplicitAnchors,
  markdownWithoutDuplicateTitle,
  normalizeWikiVirtualPath,
  resolveRelativeMarkdownPath,
  resolveWikiMarkdownPageId,
  resolveWikiMarkdownTarget,
  wikiTargetFromHash,
  wikiTargetHash,
  wikiPageHash,
  wikiPageIdFromHash,
  wikiMarkdownUrl,
} from "../wikiContent";

describe("wikiContent", () => {
  it("builds an encoded knowledge-base URL and carries the dashboard token", () => {
    expect(wikiMarkdownUrl("knowledge-base/业务流程/订单识别.md", {
      baseUrl: "/dashboard/",
      search: "",
      storedToken: "local token",
    })).toBe(
      "/dashboard/knowledge-base/%E4%B8%9A%E5%8A%A1%E6%B5%81%E7%A8%8B/%E8%AE%A2%E5%8D%95%E8%AF%86%E5%88%AB.md?token=local%20token",
    );
  });

  it("accepts a path relative to the knowledge-base root", () => {
    expect(wikiMarkdownUrl("README.md", {
      baseUrl: "/",
      search: "?token=query-token",
      storedToken: "stored-token",
    })).toBe("/knowledge-base/README.md?token=query-token");
  });

  it("rejects path traversal", () => {
    expect(() => wikiMarkdownUrl("../secrets.md", { baseUrl: "/", search: "" }))
      .toThrow("知识库文档路径无效");
  });

  it("loads Markdown text from the resolved endpoint", async () => {
    const fetcher = vi.fn(async () => new Response("# 项目概览\n\n正文", { status: 200 }));

    await expect(loadWikiMarkdown("knowledge-base/README.md", {
      fetcher,
      baseUrl: "/",
      search: "?token=abc",
    })).resolves.toContain("正文");

    expect(fetcher).toHaveBeenCalledWith(
      "/knowledge-base/README.md?token=abc",
      expect.objectContaining({ headers: { Accept: "text/markdown, text/plain;q=0.9" } }),
    );
  });

  it("returns actionable Chinese errors for missing and empty documents", async () => {
    const missing = vi.fn(async () => new Response("not found", { status: 404 }));
    const empty = vi.fn(async () => new Response("  \n", { status: 200 }));

    await expect(loadWikiMarkdown("missing.md", { fetcher: missing, baseUrl: "/", search: "" }))
      .rejects.toThrow("找不到这篇 Markdown 文档");
    await expect(loadWikiMarkdown("empty.md", { fetcher: empty, baseUrl: "/", search: "" }))
      .rejects.toThrow("没有正文内容");
  });

  it("removes a duplicate leading title but preserves a different heading", () => {
    expect(markdownWithoutDuplicateTitle("# 项目概览\n\n正文", "项目概览")).toBe("正文");
    expect(markdownWithoutDuplicateTitle("# 架构说明\n\n正文", "项目概览"))
      .toBe("# 架构说明\n\n正文");
  });

  it("resolves relative Markdown links back to indexed wiki pages", () => {
    const pages = [
      { id: "overview", markdownPath: "knowledge-base/项目总览.md" },
      { id: "flow", markdownPath: "knowledge-base/业务流程/订单识别.md" },
    ];
    const lookup = buildWikiMarkdownPageLookup(pages);

    expect(resolveWikiMarkdownPageId(
      "knowledge-base/目录.md",
      "项目总览.md",
      lookup,
    )).toBe("overview");
    expect(resolveWikiMarkdownPageId(
      "knowledge-base/业务流程/订单识别.md",
      "../项目总览.md#入口",
      lookup,
    )).toBe("overview");
    expect(resolveWikiMarkdownPageId(
      "knowledge-base/目录.md",
      "%E4%B8%9A%E5%8A%A1%E6%B5%81%E7%A8%8B/%E8%AE%A2%E5%8D%95%E8%AF%86%E5%88%AB.md",
      lookup,
    )).toBe("flow");
    expect(resolveWikiMarkdownPageId(
      "knowledge-base/目录.md",
      "https://example.com/readme.md",
      lookup,
    )).toBeNull();
  });

  it("preserves decoded fragments for relative, bare, root-relative, encoded, and hash-only links", () => {
    const lookup = buildWikiMarkdownPageLookup([
      { id: "overview", markdownPath: "knowledge-base/项目总览.md" },
      { id: "flow", markdownPath: "knowledge-base/业务流程/订单识别.md" },
    ]);

    expect(resolveWikiMarkdownTarget(
      "knowledge-base/业务流程/订单识别.md",
      "../项目总览.md#%E5%85%A5%E5%8F%A3",
      lookup,
    )).toEqual({ pageId: "overview", anchor: "入口" });
    expect(resolveWikiMarkdownTarget(
      "knowledge-base/项目总览.md",
      "业务流程/订单识别.md#run",
      lookup,
    )).toEqual({ pageId: "flow", anchor: "run" });
    expect(resolveWikiMarkdownTarget(
      "knowledge-base/项目总览.md",
      "/knowledge-base/业务流程/订单识别.md",
      lookup,
    )).toEqual({ pageId: "flow" });
    expect(resolveWikiMarkdownTarget(
      "knowledge-base/项目总览.md",
      "knowledge-base/%E4%B8%9A%E5%8A%A1%E6%B5%81%E7%A8%8B/%E8%AE%A2%E5%8D%95%E8%AF%86%E5%88%AB.md#run",
      lookup,
    )).toEqual({ pageId: "flow", anchor: "run" });
    expect(resolveWikiMarkdownTarget(
      "knowledge-base/业务流程/订单识别.md",
      "#run",
      lookup,
    )).toEqual({ pageId: "flow", anchor: "run" });
  });

  it("canonicalizes Wiki virtual paths and rejects traversal outside the knowledge-base root", () => {
    expect(normalizeWikiVirtualPath("README.md")).toBe("knowledge-base/README.md");
    expect(normalizeWikiVirtualPath("/.understand-code/knowledge-base/业务流程/订单.md"))
      .toBe("knowledge-base/业务流程/订单.md");
    expect(resolveRelativeMarkdownPath(
      "knowledge-base/业务流程/订单.md",
      "../../secrets.md",
    )).toBeNull();
    expect(resolveRelativeMarkdownPath(
      "knowledge-base/业务流程/订单.md",
      "../项目总览.md",
    )).toBe("knowledge-base/项目总览.md");
  });

  it("rejects external, protocol-relative, non-Markdown, and malformed fragment targets", () => {
    const lookup = buildWikiMarkdownPageLookup([
      { id: "overview", markdownPath: "knowledge-base/项目总览.md" },
    ]);
    for (const href of [
      "https://example.com/readme.md",
      "//example.com/readme.md",
      "mailto:team@example.com",
      "项目总览.txt#入口",
      "项目总览.md#%E0%A4%A",
      "../../../项目总览.md#入口",
    ]) {
      expect(resolveWikiMarkdownTarget("knowledge-base/目录/索引.md", href, lookup), href)
        .toBeNull();
    }
  });

  it("maps exact Unicode anchor markers to following H2/H3/H4 headings outside both fence styles", () => {
    const markdown = [
      '<a id="入口-一"></a>',
      "",
      "## 二级标题",
      '<a id="run"></a>',
      "### run",
      '<a id="类型_A"></a>',
      "#### 类型",
      "```html",
      '<a id="fenced"></a>',
      "## fenced",
      "```",
      "~~~html",
      '<a id="tilde"></a>',
      "## tilde",
      "~~~",
    ].join("\n");

    expect([...extractExplicitAnchors(markdown).entries()]).toEqual([
      [3, "入口-一"],
      [5, "run"],
      [7, "类型_A"],
    ]);
  });

  it("cancels a pending marker on nonblank prose and removes only safe marker lines", () => {
    const markdown = [
      '<a id="lost"></a>',
      "这段文字会取消绑定。",
      "## 不应绑定",
      '<a id="safe"></a>',
      "",
      "### 应绑定",
      '<a id="unsafe" class="extra"></a>',
      "<script>alert(1)</script>",
    ].join("\n");

    expect([...extractExplicitAnchors(markdown).entries()]).toEqual([[6, "safe"]]);
    const stripped = markdownWithoutExplicitAnchors(markdown);
    expect(stripped.split("\n")).toHaveLength(markdown.split("\n").length);
    expect(stripped).not.toContain('<a id="lost"></a>');
    expect(stripped).not.toContain('<a id="safe"></a>');
    expect(stripped).toContain('<a id="unsafe" class="extra"></a>');
    expect(stripped).toContain("<script>alert(1)</script>");
  });

  it("round-trips wiki page ids through a shareable hash", () => {
    expect(wikiPageIdFromHash(wikiPageHash("wiki:业务流程/订单")))
      .toBe("wiki:业务流程/订单");
    expect(wikiPageIdFromHash("#section-1")).toBeNull();
  });

  it("round-trips canonical full targets, page-only targets, and legacy page hashes", () => {
    const target = { pageId: "page:file-a", anchor: "入口-一" };
    expect(wikiTargetFromHash(wikiTargetHash(target))).toEqual(target);
    expect(wikiTargetFromHash(wikiTargetHash({ pageId: "page:overview" })))
      .toEqual({ pageId: "page:overview" });
    expect(wikiTargetFromHash("#wiki-page=page%3Aoverview"))
      .toEqual({ pageId: "page:overview" });
    expect(wikiTargetFromHash("#wiki=page%3Aoverview&anchor=%E0%A4%A")).toBeNull();
  });
});
