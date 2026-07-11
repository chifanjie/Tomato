import { createElement, createRef } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { largeWikiFixture } from "../../../wiki/__tests__/fixtures/wikiV2Fixtures";
import { buildWikiNavigation } from "../../../wiki/navigationModel";
import { buildWikiRuntimeIndex } from "../../../wiki/wikiIndex";
import WikiNavigation from "../WikiNavigation";

const model = buildWikiNavigation(
  buildWikiRuntimeIndex(largeWikiFixture({ files: 277, symbols: 479, featured: 18 })),
);

function renderNavigation(referenceExpanded: boolean): string {
  return renderToString(createElement(WikiNavigation, {
    model,
    activePageId: null,
    referenceExpanded,
    referenceTriggerRef: createRef<HTMLButtonElement>(),
    onReferenceExpandedChange: () => undefined,
    onSelectHome: () => undefined,
    onSelectStatus: () => undefined,
    onSelectPage: () => undefined,
  }));
}

describe("WikiNavigation", () => {
  it("renders only the three role-driven entries without local search", () => {
    const markup = renderNavigation(false);

    expect(markup).toContain("主干阅读");
    expect(markup).toContain("代码参考");
    expect(markup).toContain("知识库状态");
    expect(markup).not.toContain('type="search"');
    expect(markup).not.toContain("wiki-page-search");
    expect(markup).not.toContain("显示全部");
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain(">src<");
  });

  it("materializes only module roots when controlled reference is opened", () => {
    const markup = renderNavigation(true);

    expect(markup).toContain(">src<");
    expect(markup).toContain("277");
    expect(markup).not.toContain("module-0");
    expect(markup).not.toContain("symbol0");
  });
});
