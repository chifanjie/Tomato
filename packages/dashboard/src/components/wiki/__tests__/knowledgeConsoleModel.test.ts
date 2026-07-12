import { describe, expect, it } from "vitest";
import { buildWikiRuntimeIndex } from "../../../wiki/wikiIndex";
import { wikiV2Fixture } from "../../../wiki/__tests__/fixtures/wikiV2Fixtures";
import { buildKnowledgeConsoleView } from "../knowledgeConsoleModel";

describe("knowledgeConsoleModel", () => {
  it("separates direct graph focus, context, and exact direct evidence", () => {
    const payload = wikiV2Fixture();
    const page = payload.pages.find((item) => item.id === "page:run");
    if (!page) throw new Error("missing fixture page");
    page.directNodeIds = [
      "function:src/a.ts:run",
      "function:src/a.ts:run",
    ];
    page.contextNodeIds = [
      "function:src/a.ts:run",
      "file:src/config.ts",
      "file:src/config.ts",
    ];
    page.evidenceIds = ["evidence:run", "evidence:context", "evidence:page-only"];
    payload.evidence.push({
      id: "evidence:context",
      nodeIds: ["file:src/config.ts"],
      filePath: "src/config.ts",
      lineRange: [1, 2],
      excerpt: "export const timeout = 1000;",
      evidenceType: "configuration",
    });
    payload.evidence.push({
      id: "evidence:page-only",
      nodeIds: ["function:src/a.ts:run"],
      filePath: "src/page-only.ts",
      lineRange: [8, 9],
      excerpt: "export const pageOnly = true;",
      evidenceType: "test",
    });

    const view = buildKnowledgeConsoleView(
      buildWikiRuntimeIndex(payload),
      "page:run",
    );

    expect(view.activePage?.title).toBe("运行流程");
    expect(view.navigation.featured.pages.map((item) => item.id)).toEqual([
      "page:overview",
      "page:run",
    ]);
    expect(view.directGraphNodeIds).toEqual(["function:src/a.ts:run"]);
    expect(view.contextNodeIds).toEqual(["file:src/config.ts"]);
    expect(view.directPages.map((item) => item.id)).toEqual(["page:file-a"]);
    expect(view.contextPages.map((item) => item.id)).toEqual(["page:overview"]);
    expect(view.exactEvidence.map((item) => item.id)).toEqual(["evidence:run"]);
    expect(view.homeVisible).toBe(false);
  });

  it("uses the first page for a missing non-null id without showing home", () => {
    const view = buildKnowledgeConsoleView(
      buildWikiRuntimeIndex(wikiV2Fixture()),
      "page:missing",
    );

    expect(view.activePage?.id).toBe("page:overview");
    expect(view.homeVisible).toBe(false);
  });

  it("keeps the reading home visible only when no page is selected", () => {
    const view = buildKnowledgeConsoleView(buildWikiRuntimeIndex(wikiV2Fixture()), null);

    expect(view.activePage).toBeNull();
    expect(view.navigation.featured.pages).toHaveLength(2);
    expect(view.homeVisible).toBe(true);
  });

  it("returns empty navigation and relationship lanes when no wiki exists", () => {
    const view = buildKnowledgeConsoleView(buildWikiRuntimeIndex(null), null);

    expect(view.activePage).toBeNull();
    expect(view.navigation.featured.pages).toEqual([]);
    expect(view.navigation.reference.totalFiles).toBe(0);
    expect(view.navigation.maintenance.pages).toEqual([]);
    expect(view.directGraphNodeIds).toEqual([]);
    expect(view.contextNodeIds).toEqual([]);
    expect(view.directPages).toEqual([]);
    expect(view.contextPages).toEqual([]);
    expect(view.exactEvidence).toEqual([]);
    expect(view.homeVisible).toBe(true);
  });
});
