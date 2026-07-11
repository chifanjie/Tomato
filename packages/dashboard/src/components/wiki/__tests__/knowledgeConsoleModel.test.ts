import { describe, expect, it } from "vitest";
import { buildWikiRuntimeIndex } from "../../../wiki/wikiIndex";
import { wikiV2Fixture } from "../../../wiki/__tests__/fixtures/wikiV2Fixtures";
import { buildKnowledgeConsoleView } from "../knowledgeConsoleModel";

describe("knowledgeConsoleModel", () => {
  it("builds navigation, active page, evidence, and graph node ids from V2", () => {
    const index = buildWikiRuntimeIndex(wikiV2Fixture());

    const view = buildKnowledgeConsoleView(index, "page:run");

    expect(view.activePage?.title).toBe("运行流程");
    expect(view.sections.map((section) => section.category)).toEqual([
      "overview",
      "flow",
      "file",
    ]);
    expect(view.evidence.map((item) => item.filePath)).toEqual(["src/a.ts"]);
    expect(view.graphNodeIds).toEqual(["function:src/a.ts:run"]);
    expect(view.emptyReason).toBeNull();
  });

  it("uses the first page when the active page id is missing", () => {
    const view = buildKnowledgeConsoleView(
      buildWikiRuntimeIndex(wikiV2Fixture()),
      "page:missing",
    );

    expect(view.activePage?.id).toBe("page:overview");
  });

  it("keeps graph focus limited to direct page links", () => {
    const payload = wikiV2Fixture();
    const filePage = payload.pages.find((page) => page.id === "page:file-a");
    if (!filePage) throw new Error("missing fixture page");
    filePage.contextNodeIds = ["file:src/a.ts"];
    const view = buildKnowledgeConsoleView(
      buildWikiRuntimeIndex(payload),
      "page:file-a",
    );

    expect(view.graphNodeIds).toEqual([
      "function:src/a.ts:run",
    ]);
  });

  it("returns an empty-state view when no wiki pages exist", () => {
    const view = buildKnowledgeConsoleView(buildWikiRuntimeIndex(null), null);

    expect(view.activePage).toBeNull();
    expect(view.sections).toEqual([]);
    expect(view.evidence).toEqual([]);
    expect(view.graphNodeIds).toEqual([]);
    expect(view.emptyReason).toBe("还没有生成可阅读的知识库内容。");
  });
});
