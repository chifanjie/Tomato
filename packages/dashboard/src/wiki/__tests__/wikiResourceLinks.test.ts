import { describe, expect, it } from "vitest";
import type { WikiEvidenceV2 } from "@understand-code/core/knowledge-base";
import { inferWikiRepositoryRoot, resolveWikiResourceLink } from "../wikiResourceLinks";

const evidence: WikiEvidenceV2[] = [
  { id: "file", nodeIds: [], filePath: "server/src/index.ts", lineRange: [1, 100], excerpt: "file", evidenceType: "production" },
  { id: "function", nodeIds: [], filePath: "server/src/index.ts", lineRange: [38, 48], excerpt: "function", evidenceType: "production" },
];
const context = {
  currentMarkdownPath: "knowledge-base/目录.md",
  pageIdByMarkdownPath: new Map([["knowledge-base/项目总览.md", "overview"]]),
  repositoryRoot: "/Users/example/Spring_Breeze",
  evidence,
};

describe("wiki resource links", () => {
  it("resolves indexed wiki links before classifying source files", () => {
    expect(resolveWikiResourceLink("项目总览.md#入口", context)).toEqual({ kind: "wiki", target: { pageId: "overview", anchor: "入口" } });
    expect(resolveWikiResourceLink("/Users/example/Spring_Breeze/docs/wiki/%E9%A1%B9%E7%9B%AE%E6%80%BB%E8%A7%88.md", context))
      .toEqual({ kind: "wiki", target: { pageId: "overview" } });
  });

  it("matches a repository path and picks the smallest evidence range covering the line", () => {
    expect(resolveWikiResourceLink("/Users/example/Spring_Breeze/server/src/index.ts:42", context))
      .toMatchObject({ kind: "source", filePath: "server/src/index.ts", line: 42, evidence: { id: "function" } });
    expect(resolveWikiResourceLink("server/src/index.ts#L60", context))
      .toMatchObject({ kind: "source", line: 60, evidence: { id: "file" } });
    expect(resolveWikiResourceLink("./server/src/index.ts:42", context))
      .toMatchObject({ kind: "source", line: 42, evidence: { id: "function" } });
    expect(resolveWikiResourceLink("README.md:2", { ...context, evidence: [
      { ...evidence[0]!, id: "readme", filePath: "README.md" },
    ] })).toMatchObject({ kind: "source", line: 2, evidence: { id: "readme" } });
  });

  it("does not guess files from matching basenames or outside repository paths", () => {
    for (const href of ["index.ts:42", "/other/server/src/index.ts:42", "/Users/example/Spring_Breeze-copy/server/src/index.ts:42", "../../server/src/index.ts:42", "server/src/index.ts:999"])
      expect(resolveWikiResourceLink(href, context).kind, href).toBe("unavailable");
  });

  it("keeps unsupported local resources and dangerous schemes inside the reader", () => {
    for (const href of ["/Users/example/Spring_Breeze/docs/wiki/项目图谱.md", "/Users/example/Spring_Breeze/docs/wiki/项目图谱.drawio", "javascript:alert(1)", "data:text/html,test", "%E0%A4%A", undefined])
      expect(resolveWikiResourceLink(href, context).kind, href).toBe("unavailable");
  });

  it("preserves external and email link semantics", () => {
    expect(resolveWikiResourceLink("https://example.com/page.md", context)).toEqual({ kind: "external", href: "https://example.com/page.md", newTab: true });
    expect(resolveWikiResourceLink("mailto:team@example.com", context)).toEqual({ kind: "external", href: "mailto:team@example.com", newTab: false });
  });

  it("infers only explicit repository metadata outside code fences", () => {
    expect(inferWikiRepositoryRoot("代码根目录：`/Users/example/Spring_Breeze`  \n知识库目录：/Users/example/Spring_Breeze/docs/wiki"))
      .toBe("/Users/example/Spring_Breeze");
    expect(inferWikiRepositoryRoot("```\n代码根目录：/wrong\n```\n普通文本 /some/path" )).toBeUndefined();
  });

  it("derives an authored root from the source-location declaration and one exact bound file", () => {
    const markdown = "## 源码位置\n[查看源文件](/Users/example/Spring_Breeze/client/src/App.tsx:1)。下方是完整源码。";
    expect(inferWikiRepositoryRoot(markdown, ["client/src/App.tsx", "client/src/App.tsx"]))
      .toBe("/Users/example/Spring_Breeze");
    expect(inferWikiRepositoryRoot("## 源码位置\n[查看源文件](/Users/example/Spring_Breeze/README.md:1)", ["README.md"]))
      .toBe("/Users/example/Spring_Breeze");
  });

  it("does not infer a root from arbitrary links, code examples, or ambiguous page evidence", () => {
    const source = "## 源码位置\n[查看源文件](/repo/client/src/App.tsx:1)";
    expect(inferWikiRepositoryRoot(source, ["server/src/App.tsx"])).toBeUndefined();
    expect(inferWikiRepositoryRoot(source, ["client/src/App.tsx", "server/src/App.tsx"])).toBeUndefined();
    expect(inferWikiRepositoryRoot("## 其他资料\n[查看源文件](/repo/client/src/App.tsx:1)", ["client/src/App.tsx"])).toBeUndefined();
    expect(inferWikiRepositoryRoot("````md\n" + source + "\n````", ["client/src/App.tsx"])).toBeUndefined();
  });
});
