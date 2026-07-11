import { describe, expect, it } from "vitest";
import { wikiV2Fixture } from "./fixtures/wikiV2Fixtures";
import {
  buildWikiRuntimeIndex,
  categorySections,
  emptyWikiRuntimeIndex,
  evidenceForPage,
} from "../wikiIndex";

describe("Wiki V2 runtime index", () => {
  it("keeps direct, context, evidence, and route maps independent", () => {
    const index = buildWikiRuntimeIndex(wikiV2Fixture());

    expect(index.directPagesByNodeId.get("function:src/a.ts:run")?.map((page) => page.id)).toEqual([
      "page:run",
      "page:file-a",
    ]);
    expect(index.contextPagesByNodeId.get("function:src/a.ts:run")?.map((page) => page.id)).toEqual([
      "page:overview",
    ]);
    expect(index.evidenceByNodeId.get("function:src/a.ts:run")?.map((item) => item.id)).toEqual([
      "evidence:run",
    ]);
    expect(index.routePages.map((page) => page.id)).toEqual(["page:overview", "page:run"]);
  });

  it("uses routePageIds exclusively and keeps page order in node maps", () => {
    const payload = wikiV2Fixture();
    payload.mainReadiness.routePageIds = ["page:run", "page:file-a", "page:overview"];
    const index = buildWikiRuntimeIndex(payload);

    expect(index.routePages.map((page) => page.id)).toEqual(["page:run", "page:overview"]);
    expect(index.directPagesByNodeId.get("function:src/a.ts:run")?.map((page) => page.id)).toEqual([
      "page:run",
      "page:file-a",
    ]);
  });

  it("resolves page evidence without combining node relations", () => {
    const index = buildWikiRuntimeIndex(wikiV2Fixture());

    expect(evidenceForPage(index, "page:run").map((item) => item.id)).toEqual(["evidence:run"]);
    expect(evidenceForPage(index, "page:overview")).toEqual([]);
  });

  it("builds safe empty and temporary category indexes", () => {
    const empty = emptyWikiRuntimeIndex();
    const index = buildWikiRuntimeIndex(wikiV2Fixture());

    expect(empty.pageCount).toBe(0);
    expect(empty.payload).toBeNull();
    expect(categorySections(index).map((section) => section.category)).toEqual([
      "overview",
      "flow",
      "file",
    ]);
  });
});
