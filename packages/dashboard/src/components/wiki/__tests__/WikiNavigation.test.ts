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

function renderNavigation(
  referenceExpanded: boolean,
  activeAuxView: "home" | "status" | null = "home",
  activePageId: string | null = null,
): string {
  return renderToString(createElement(WikiNavigation, {
    model,
    activePageId,
    activeAuxView,
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
    expect(markup.match(/aria-expanded="false"/g)).toHaveLength(1);
    expect(markup).not.toContain('aria-expanded="true"');
    expect(markup).not.toContain(">src<");
  });

  it("uses a flat publication index without nested dashboard cards", () => {
    const markup = renderNavigation(false);

    expect(markup).toContain("uc-wiki-nav-section");
    expect(markup).not.toContain("bg-root/20");
    expect(markup).not.toContain("rounded-lg border");
    expect(markup.match(/aria-expanded="false"/g)).toHaveLength(1);
  });

  it("marks Home, Status, or a page as the only current destination", () => {
    const pageId = model.featured.pages[0]?.id;
    if (!pageId) throw new Error("missing featured fixture page");
    const home = renderNavigation(false, "home", null);
    const status = renderNavigation(false, "status", null);
    const page = renderNavigation(false, null, pageId);

    expect(home.match(/aria-current="page"/g)).toHaveLength(1);
    expect(status.match(/aria-current="page"/g)).toHaveLength(1);
    expect(page.match(/aria-current="page"/g)).toHaveLength(1);
    expect(status.indexOf('aria-current="page"')).toBeGreaterThan(status.indexOf("代码参考"));
    expect(home.indexOf('aria-current="page"')).toBeLessThan(home.indexOf("主干阅读"));
  });

  it("materializes only module roots when controlled reference is opened", () => {
    const markup = renderNavigation(true);

    expect(markup).toContain(">src<");
    expect(markup).toContain("277");
    expect(markup).not.toContain("module-0");
    expect(markup).not.toContain("symbol0");
  });
});
