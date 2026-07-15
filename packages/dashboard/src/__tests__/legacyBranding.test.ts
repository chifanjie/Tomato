import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-code/core/types";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import {
  normalizeLegacyBrandText,
  normalizeLegacyGraphBranding,
  normalizeLegacyMarkdownBranding,
  normalizeLegacySearchRecordsBranding,
  normalizeLegacyWikiIndexBranding,
} from "../legacyBranding";
import {
  searchFixture,
  wikiV2Fixture,
} from "../wiki/__tests__/fixtures/wikiV2Fixtures";
import {
  buildFallbackSearchRecords,
  buildWikiSearchRuntime,
  searchWiki,
} from "../wiki/searchIndex";
import { buildWikiRuntimeIndex } from "../wiki/wikiIndex";

interface ParsedMarkdownNode {
  type: string;
  identifier?: string;
  url?: string;
  children?: ParsedMarkdownNode[];
}

function parsedMarkdownNodes(markdown: string): ParsedMarkdownNode[] {
  const root = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(markdown) as ParsedMarkdownNode;
  const nodes: ParsedMarkdownNode[] = [];
  const visit = (node: ParsedMarkdownNode) => {
    nodes.push(node);
    node.children?.forEach(visit);
  };
  visit(root);
  return nodes;
}

function graphFixture(name = "understand-anything"): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name,
      languages: ["typescript"],
      frameworks: ["React"],
      description: "understand-anything 的历史项目说明",
      analyzedAt: "2026-07-15T00:00:00.000Z",
      gitCommitHash: "fixture",
    },
    nodes: [{
      id: "file:understand-anything/config.ts",
      type: "file",
      name: "understand-anything.config.ts",
      filePath: "understand-anything/config.ts",
      summary: "源码实体名称必须保留",
      tags: [],
      complexity: "simple",
    }],
    edges: [],
    layers: [],
    tour: [],
  };
}

describe("legacy brand compatibility", () => {
  it("replaces only the exact legacy brand text", () => {
    expect(normalizeLegacyBrandText("使用 understand-anything 构建"))
      .toBe("使用 Understand Code 构建");
    expect(normalizeLegacyBrandText("Understand Anything 与 exampleRepository-helper"))
      .toBe("Understand Anything 与 exampleRepository-helper");
  });

  it("patches Markdown prose without changing code or destinations", () => {
    const markdown = [
      "# understand-anything",
      "",
      "使用 **understand-anything** 阅读代码。",
      "",
      "`understand-anything`",
      "",
      "```sh",
      "understand-anything --help",
      "```",
      "",
      "[understand-anything](https://example.com/understand-anything)",
      "<https://example.com/understand-anything>",
      "<a href=\"https://example.com/understand-anything\">产品主页</a>",
    ].join("\r\n");

    expect(normalizeLegacyMarkdownBranding(markdown)).toBe([
      "# Understand Code",
      "",
      "使用 **Understand Code** 阅读代码。",
      "",
      "`understand-anything`",
      "",
      "```sh",
      "understand-anything --help",
      "```",
      "",
      "[Understand Code](https://example.com/understand-anything)",
      "<https://example.com/understand-anything>",
      "<a href=\"https://example.com/understand-anything\">产品主页</a>",
    ].join("\r\n"));
  });

  it("patches image alt and titles without changing destinations", () => {
    const markdown = [
      "![understand\\-anything](assets/understand-anything.png \"understand-anything\")",
      "",
      "[主页](https://example.com/understand-anything \"understand-anything\")",
      "",
      "[brand]: https://example.com/understand-anything \"understand-anything\"",
      "",
      "[引用][brand]",
    ].join("\r\n");

    expect(normalizeLegacyMarkdownBranding(markdown)).toBe([
      "![Understand Code](assets/understand-anything.png \"Understand Code\")",
      "",
      "[主页](https://example.com/understand-anything \"Understand Code\")",
      "",
      "[brand]: https://example.com/understand-anything \"Understand Code\"",
      "",
      "[引用][brand]",
    ].join("\r\n"));
  });

  it("patches an escaped image alt when no raw legacy literal exists", () => {
    expect(normalizeLegacyMarkdownBranding(
      "![understand\\-anything](logo.png)",
    )).toBe("![Understand Code](logo.png)");
  });

  it("preserves protected Markdown inside image alt text", () => {
    const markdown = [
      "![`understand-anything`](image.png)",
      "![<https://example.com/understand-anything>](image.png)",
      "![<span title=\"understand-anything\">x</span>](image.png)",
    ].join("\r\n");

    expect(normalizeLegacyMarkdownBranding(markdown)).toBe(markdown);
  });

  it("keeps shortcut and collapsed references linked after normalizing their labels", () => {
    const markdown = [
      "[understand-anything]",
      "[understand-anything][]",
      "![understand-anything]",
      "![understand-anything][]",
      "",
      "[understand-anything]: https://example.com/understand-anything",
    ].join("\n");

    const normalized = normalizeLegacyMarkdownBranding(markdown);
    expect(normalized).toBe([
      "[Understand Code][understand-anything]",
      "[Understand Code][understand-anything]",
      "![Understand Code][understand-anything]",
      "![Understand Code][understand-anything]",
      "",
      "[understand-anything]: https://example.com/understand-anything",
    ].join("\n"));

    const nodes = parsedMarkdownNodes(normalized);
    expect(nodes.filter((node) => node.type === "linkReference").map((node) => node.identifier))
      .toEqual(["understand-anything", "understand-anything"]);
    expect(nodes.filter((node) => node.type === "imageReference").map((node) => node.identifier))
      .toEqual(["understand-anything", "understand-anything"]);
    expect(nodes.find((node) => node.type === "definition")).toMatchObject({
      identifier: "understand-anything",
      url: "https://example.com/understand-anything",
    });
  });

  it("normalizes prose occurrences without rewriting embedded technical tokens", () => {
    const markdown = [
      "检查 docs/understand-anything.md:12、src/understand-anything/config.ts 和 www.example.com/understand-anything；产品 understand-anything 仍可阅读。",
      "",
      "[www.example.com/understand-anything](https://www.example.com/understand-anything)",
      "[understand-anything@example.com](mailto:understand-anything@example.com)",
      "<understand-anything@example.com>",
    ].join("\n");

    expect(normalizeLegacyMarkdownBranding(markdown)).toBe([
      "检查 docs/understand-anything.md:12、src/understand-anything/config.ts 和 www.example.com/understand-anything；产品 Understand Code 仍可阅读。",
      "",
      "[www.example.com/understand-anything](https://www.example.com/understand-anything)",
      "[understand-anything@example.com](mailto:understand-anything@example.com)",
      "<understand-anything@example.com>",
    ].join("\n"));
  });

  it("normalizes rendered hyphen references while preserving encoded technical tokens", () => {
    const markdown = [
      "使用 understand&#45;anything 与 understand&#x2D;anything。",
      "",
      "![understand&#45;anything](assets/understand-anything.png \"understand&#x2d;anything\")",
      "",
      "路径 src/understand&#45;anything/config.ts 保持不变，产品 understand&#45;anything 继续可见。",
    ].join("\n");

    expect(normalizeLegacyMarkdownBranding(markdown)).toBe([
      "使用 Understand Code 与 Understand Code。",
      "",
      "![Understand Code](assets/understand-anything.png \"Understand Code\")",
      "",
      "路径 src/understand&#45;anything/config.ts 保持不变，产品 Understand Code 继续可见。",
    ].join("\n"));
  });

  it("normalizes only graph project display metadata", () => {
    const graph = graphFixture();
    const normalized = normalizeLegacyGraphBranding(graph);

    expect(normalized.project.name).toBe("Understand Code");
    expect(normalized.project.description).toBe("Understand Code 的历史项目说明");
    expect(normalized.nodes).toBe(graph.nodes);
    expect(normalized.nodes[0]?.id).toBe("file:understand-anything/config.ts");
    expect(normalized.nodes[0]?.filePath).toBe("understand-anything/config.ts");
    expect(graph.project.name).toBe("understand-anything");

    const other = graphFixture("exampleRepository-helper");
    other.project.description = "另一个真实项目";
    expect(normalizeLegacyGraphBranding(other)).toBe(other);
  });

  it("normalizes Wiki and search display fields without changing identity fields", () => {
    const wiki = wikiV2Fixture();
    wiki.projectName = "understand-anything";
    wiki.pages[0] = {
      ...wiki.pages[0]!,
      title: "understand-anything 总览",
      summary: "理解 understand-anything",
      searchTerms: ["understand-anything", "docs/understand-anything.md", "入口"],
    };
    const normalizedWiki = normalizeLegacyWikiIndexBranding(wiki);
    expect(normalizedWiki.projectName).toBe("Understand Code");
    expect(normalizedWiki.pages[0]).toMatchObject({
      id: "page:overview",
      title: "Understand Code 总览",
      summary: "理解 Understand Code",
      markdownPath: "knowledge-base/项目总览.md",
      searchTerms: [
        "understand-anything",
        "docs/understand-anything.md",
        "入口",
        "Understand Code",
      ],
    });
    expect(normalizedWiki.evidence).toBe(wiki.evidence);

    const records = searchFixture();
    records[0] = {
      ...records[0]!,
      title: "understand-anything 总览",
      summary: "理解 understand-anything",
      content: "正文介绍 understand-anything，代码为 `understand-anything`。",
      terms: ["understand-anything", "docs/understand-anything.md"],
      businessTerms: ["understand-anything"],
    };
    const normalizedRecords = normalizeLegacySearchRecordsBranding(records);
    expect(normalizedRecords[0]).toMatchObject({
      id: "search:overview",
      pageId: "page:overview",
      title: "Understand Code 总览",
      summary: "理解 Understand Code",
      content: "正文介绍 Understand Code，代码为 `understand-anything`。",
      terms: [
        "understand-anything",
        "docs/understand-anything.md",
        "Understand Code",
      ],
      businessTerms: ["Understand Code"],
    });
  });

  it("preserves source symbol records exactly", () => {
    const symbol = {
      ...searchFixture().find((record) => record.kind === "symbol")!,
      id: "symbol:understand-anything",
      title: "understand-anything",
      summary: "understand-anything source symbol",
      content: "understand-anything implementation",
      pageId: "page:understand-anything",
      anchor: "understand-anything",
      nodeId: "function:src/understand-anything.ts:understand-anything",
      terms: [
        "understand-anything",
        "src/understand-anything.ts",
        "function:src/understand-anything.ts:understand-anything",
      ],
      filePath: "src/understand-anything.ts",
    };

    expect(normalizeLegacySearchRecordsBranding([symbol])).toEqual([symbol]);
  });

  it("keeps fallback search technical symbols and adds the current brand page alias", () => {
    const wiki = wikiV2Fixture();
    wiki.pages[0] = {
      ...wiki.pages[0]!,
      searchTerms: ["understand-anything", "入口"],
    };
    wiki.nodeDocumentation[0] = {
      ...wiki.nodeDocumentation[0]!,
      nodeId: "function:src/understand-anything.ts:understand-anything",
      primaryPageId: "page:file-a",
      anchor: "understand-anything",
    };

    const runtimeIndex = buildWikiRuntimeIndex(normalizeLegacyWikiIndexBranding(wiki));
    const records = buildFallbackSearchRecords(runtimeIndex);
    expect(records.find((record) => record.id === "fallback:page:page:overview")?.terms)
      .toEqual([
        "understand-anything",
        "入口",
        "Understand Code",
        "knowledge-base/项目总览.md",
      ]);
    expect(records.find((record) => record.kind === "symbol")).toMatchObject({
      title: "understand-anything",
      nodeId: "function:src/understand-anything.ts:understand-anything",
      anchor: "understand-anything",
      filePath: "src/understand-anything.ts",
      terms: [
        "function:src/understand-anything.ts:understand-anything",
        "understand-anything",
        "src/understand-anything.ts",
      ],
    });

    const searchRuntime = buildWikiSearchRuntime([], runtimeIndex, "fallback");
    expect(searchWiki(searchRuntime, "Understand Code", 1, 10).groups
      .flatMap((group) => group.items)
      .map((record) => record.id))
      .toContain("fallback:page:page:overview");
  });
});
