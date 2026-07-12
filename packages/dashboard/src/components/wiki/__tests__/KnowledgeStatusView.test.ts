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
  }));

  expect(html).toContain("主干知识");
  expect(html).toContain("可以阅读");
  expect(html).toContain("全量代码参考");
  expect(html).toContain("参考覆盖完整");
  expect(html).toContain("文件 2/2");
  expect(html).toContain("函数 1/1");
});
