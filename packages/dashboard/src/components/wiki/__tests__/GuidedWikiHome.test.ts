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
  expect(html.match(/class="uc-guided-route-item"/g)).toHaveLength(5);
  const stages = [
    ["项目做什么", "先确认项目边界与核心价值"],
    ["怎样流转", "沿主路径理解请求怎样推进"],
    ["有哪些规则", "识别决定行为的条件与约束"],
    ["代码怎样实现", "进入承担职责的模块与文件"],
    ["怎样核验源码", "回到源码位置核验结论"],
  ] as const;
  let previousIndex = -1;
  for (const [label, summary] of stages) {
    const labelIndex = html.indexOf(label);
    expect(labelIndex).toBeGreaterThan(previousIndex);
    expect(html.indexOf(summary)).toBeGreaterThan(labelIndex);
    previousIndex = labelIndex;
  }
  expect(html).not.toContain("overflow-x-auto");
  expect(html).not.toContain("min-w-[8.75rem]");
  expect(html).not.toContain("a.ts 文件参考");
  expect(html).not.toMatch(/缺口|覆盖率|生成失败/);

  const emptyHtml = renderToStaticMarkup(createElement(GuidedWikiHome, {
    projectName: "示例项目",
    routePages: [],
    onOpenPage: vi.fn(),
    onOpenGraph: vi.fn(),
    onOpenReference: vi.fn(),
  }));
  expect(emptyHtml).toMatch(/<button[^>]*disabled=""[^>]*>开始阅读<\/button>/);
});

it("marks the other stages as missing when only implementation content exists", () => {
  const pages = buildWikiRuntimeIndex(wikiV2Fixture()).routePages.map((page) => ({ ...page, route: { ...page.route!, stage: "implementation" as const } }));
  const html = renderToStaticMarkup(createElement(GuidedWikiHome, { projectName: "fixture", routePages: pages, onOpenPage: vi.fn(), onOpenGraph: vi.fn(), onOpenReference: vi.fn(), onOpenStatus: vi.fn() }));
  expect(html.match(/待补充 · 暂无主干文档/g)).toHaveLength(4);
  expect(html).toContain("当前还有 4 个阶段待补充");
  expect(html).toContain("查看知识库状态");
});
