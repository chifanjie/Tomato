// @vitest-environment happy-dom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { extractWikiOutline, scrollWikiAnchor, WikiMarkdownDocument } from "../WikiPageView";

function render(markdown: string) {
  const root = document.createElement("article");
  root.innerHTML = renderToStaticMarkup(createElement(WikiMarkdownDocument, {
    markdown, currentMarkdownPath: "knowledge-base/目录.md",
    pageIdByMarkdownPath: new Map(), headings: extractWikiOutline(markdown), onSelectTarget() {},
  }));
  return root;
}

describe("Wiki reading fidelity", () => {
  it("distinguishes real file paths from prose, URLs, API routes and code samples", () => {
    const root = render("代码根目录：/Users/example/Spring_Breeze\n\n参见 server/src/index.ts:42 和 `client/src/App.tsx`。\n\nGET /api/hotspots；https://example.com/a/b；输入/输出\n\n```sh\ncat /Users/example/file.ts\n```");
    expect([...root.querySelectorAll(".uc-wiki-file-path")].map(x => x.textContent)).toEqual([
      "/Users/example/Spring_Breeze", "server/src/index.ts:42", "client/src/App.tsx",
    ]);
    expect(root.querySelectorAll('button[aria-label^="复制路径"]')).toHaveLength(3);
    expect(root.querySelector("pre")?.textContent).toBe("cat /Users/example/file.ts\n");
  });

  it("renders unlabelled fences as block code and retains ordered list start and table alignment", () => {
    const root = render("```\na < b\n  next\n```\n\n3. 第三步\n4. 第四步\n\n| 名称 | 数量 |\n| :-- | --: |\n| 示例 | 12 |");
    expect(root.querySelector("pre code")?.classList.contains("uc-prose-code-block")).toBe(true);
    expect(root.querySelector("pre code")?.textContent).toBe("a < b\n  next\n");
    expect(root.querySelector("ol")?.start).toBe(3);
    expect((root.querySelectorAll("th")[1] as HTMLElement).style.textAlign).toBe("right");
    expect(root.querySelector(".uc-prose-table-wrap")?.getAttribute("tabindex")).toBe("0");
  });

  it("preserves literal underscores and link labels in heading anchors", () => {
    const root = render("## DATABASE_URL\n\n### search_bing\n\n## [接口文档](guide.md)");
    const names = [...root.querySelectorAll("h2,h3")].map(x => (x as HTMLElement).dataset.wikiAnchor);
    expect(names).toEqual(["database_url", "search_bing", "接口文档"]);
  });

  it("keeps task-list styling hooks so checkbox lists do not gain extra bullets", () => {
    const root = render("- [ ] 待处理\n- [x] 已完成");
    expect(root.querySelector("ul")?.classList.contains("contains-task-list")).toBe(true);
    expect(root.querySelector("li")?.classList.contains("task-list-item")).toBe(true);
  });

  it("locates natural Chinese heading anchors while retaining existing outline ids", () => {
    const root = render("## 主流程\n\n正文\n\n## 主流程\n\n### 输入与 `输出`");
    const headings = root.querySelectorAll("h2,h3");
    const calls: string[] = [];
    headings.forEach(el => { (el as HTMLElement).scrollIntoView = () => calls.push(el.id); });
    expect(headings[0]?.id).toBe("wiki-heading-1");
    expect(scrollWikiAnchor(root, "主流程")).toBe(true);
    expect(scrollWikiAnchor(root, "主流程-1")).toBe(true);
    expect(scrollWikiAnchor(root, "输入与-输出")).toBe(true);
    expect(calls).toEqual(["wiki-heading-1", "wiki-heading-5", "wiki-heading-7"]);
  });
});
