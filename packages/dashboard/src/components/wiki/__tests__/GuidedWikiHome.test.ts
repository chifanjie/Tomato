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

  expect(html).toContain("先理解项目，再进入代码");
  expect(html).toContain("项目做什么");
  expect(html).toContain("怎样流转");
  expect(html).toContain("有哪些规则");
  expect(html).toContain("代码怎样实现");
  expect(html).toContain("怎样核验源码");
  expect(html).toContain("overflow-x-auto");
  expect(html).toContain("min-w-[8.75rem]");
  expect(html).toContain("项目总览");
  expect(html).toContain("运行流程");
  expect(html).not.toContain("a.ts 文件参考");
  expect(html).not.toMatch(/缺口|覆盖率|生成失败/);
});
