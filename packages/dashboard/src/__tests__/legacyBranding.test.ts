import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-code/core/types";
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
      searchTerms: ["Understand Code", "docs/understand-anything.md", "入口"],
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
      terms: ["Understand Code", "docs/understand-anything.md"],
      businessTerms: ["Understand Code"],
    });
  });
});
