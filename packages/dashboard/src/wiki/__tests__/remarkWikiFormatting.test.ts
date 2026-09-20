import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { remarkWikiFormatting } from "../remarkWikiFormatting";

function render(markdown: string) {
  return renderToStaticMarkup(createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm, remarkWikiFormatting],
    children: markdown,
  }));
}

describe("remarkWikiFormatting", () => {
  it("renders plain HTML breaks in paragraphs and GFM table cells without enabling arbitrary HTML", () => {
    const html = render("第一行<br>第二行<BR />第三行\n\n| 字段 | 说明 |\n|---|---|\n| a | 第一行<br/>第二行 |\n\n<script>alert(1)</script>");
    expect(html.match(/<br\/>/g)).toHaveLength(3);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("keeps code, escaped markup, generic types, entities and HTML with attributes literal", () => {
    const html = render("`<br>`\n\n```html\n<br>\n```\n\n\\<br> &amp; Promise<void>\n\n<br onclick=\"alert(1)\">");
    expect(html).not.toContain("<br/>");
    expect(html).toContain("<code>&lt;br&gt;</code>");
    expect(html).toContain("&amp; Promise&lt;void&gt;");
    expect(html).not.toContain('<br onclick=');
  });

  it("renders generated Chinese labels as strong text when punctuation prevents CommonMark delimiter matching", () => {
    const html = render("**本地代码事实：**主界面是一个 App。**代码推断结论：**runtime 需要验证。\n\n- **范围：**入口与数据\n\n| 类型 | 说明 |\n|---|---|\n| 证据 | **已核验：**实际源码 | ");
    expect(html).toContain("<strong>本地代码事实：</strong>主界面是一个 App。");
    expect(html).toContain("<strong>代码推断结论：</strong>runtime 需要验证。");
    expect(html).toContain("<strong>范围：</strong>入口与数据");
    expect(html).toContain("<strong>已核验：</strong>实际源码");
    expect(html).not.toContain("**");
  });

  it("does not reinterpret escaped markers, entities or code literals as Chinese label formatting", () => {
    const html = render("\\*\\*本地代码事实：\\*\\*主界面\n\n&#42;&#42;代码推断结论：&#42;&#42;runtime\n\n`**范围：**入口`\n\n```md\n**已核验：**实际源码\n```\n\n普通 **标记**文本");
    expect(html).toContain("<p>**本地代码事实：**主界面</p>");
    expect(html).toContain("<p>**代码推断结论：**runtime</p>");
    expect(html).toContain("<code>**范围：**入口</code>");
    expect(html).toContain('class="language-md">**已核验：**实际源码');
    expect(html).not.toContain("<strong>本地代码事实");
    expect(html).not.toContain("<strong>代码推断结论");
    expect(html).toContain("<strong>标记</strong>文本");
  });
});
