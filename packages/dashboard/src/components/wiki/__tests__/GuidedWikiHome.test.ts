import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { wikiV2Fixture } from "../../../wiki/__tests__/fixtures/wikiV2Fixtures";
import { buildWikiRuntimeIndex } from "../../../wiki/wikiIndex";
import GuidedWikiHome from "../GuidedWikiHome";

it("renders the guided route without maintenance metrics", () => {
  const index = buildWikiRuntimeIndex(wikiV2Fixture());
  const html = renderToStaticMarkup(createElement(GuidedWikiHome, {
    projectName: "示例项目",
    routePages: index.routePages,
    onOpenPage: vi.fn(),
    onOpenGraph: vi.fn(),
    onOpenReference: vi.fn(),
  }));

  expect(html).toContain('class="uc-guided-route"');
  expect(html).toContain('class="uc-guided-route-item"');
  expect(html).toContain("先理解项目，再进入代码");
  expect(html).toContain("开始阅读");
  expect(html).toContain("查看关系图谱");
  expect(html).toContain("查找文件或符号");
  expect(html).toContain("项目总览");
  expect(html).toContain("运行流程");
  expect(html).not.toContain("overflow-x-auto");
  expect(html).not.toContain("min-w-[8.75rem]");
  expect(html).not.toContain("a.ts 文件参考");
  expect(html).not.toMatch(/缺口|覆盖率|生成失败/);
});
