import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { wikiV2Fixture } from "../../../wiki/__tests__/fixtures/wikiV2Fixtures";
import { buildWikiRuntimeIndex } from "../../../wiki/wikiIndex";
import KnowledgeStatusView from "../KnowledgeStatusView";

it("reports readiness and reference coverage independently in Chinese", () => {
  const payload = wikiV2Fixture();
  payload.referenceCoverage.files = { covered: 2, total: 2, missingIds: [] };
  const html = renderToStaticMarkup(createElement(KnowledgeStatusView, {
    index: buildWikiRuntimeIndex(payload),
    orphanReferencePageIds: [],
    graph: null,
  }));

  expect(html).toContain("主干知识");
  expect(html).toContain("可以阅读");
  expect(html).toContain("全量代码参考");
  expect(html).toContain("参考覆盖完整");
  expect(html).toContain("文件 2/2");
  expect(html).toContain("函数 1/1");
});

it("names the uncovered nodes instead of only counting them", () => {
  const payload = wikiV2Fixture();
  payload.referenceCoverage.status = "partial";
  payload.referenceCoverage.files = {
    covered: 1,
    total: 3,
    missingIds: ["file:src/skipped.ts", "file:src/other.ts"],
  };

  const html = renderToStaticMarkup(createElement(KnowledgeStatusView, {
    index: buildWikiRuntimeIndex(payload),
    orphanReferencePageIds: [],
    graph: null,
  }));

  expect(html).toContain("参考覆盖不完整");
  expect(html).toContain("未覆盖的 2 个文件");
  expect(html).toContain("src/skipped.ts");
  expect(html).toContain("src/other.ts");
});

it("summarizes the remainder rather than listing hundreds of gaps", () => {
  const payload = wikiV2Fixture();
  payload.referenceCoverage.status = "partial";
  payload.referenceCoverage.files = {
    covered: 0,
    total: 30,
    missingIds: Array.from({ length: 30 }, (_, index) => `file:src/f${index}.ts`),
  };

  const html = renderToStaticMarkup(createElement(KnowledgeStatusView, {
    index: buildWikiRuntimeIndex(payload),
    orphanReferencePageIds: [],
    graph: null,
  }));

  expect(html).toContain("未覆盖的 30 个文件");
  expect(html).toContain("另有 18 个未列出");
});
