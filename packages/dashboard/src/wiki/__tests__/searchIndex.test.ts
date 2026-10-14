import type { WikiSearchRecordV2 } from "@understand-code/core/knowledge-base";
import { describe, expect, it } from "vitest";
import { buildWikiRuntimeIndex } from "../wikiIndex";
import {
  buildFallbackSearchRecords,
  buildWikiSearchRuntime,
  searchWiki,
} from "../searchIndex";
import { searchFixture, wikiV2Fixture } from "./fixtures/wikiV2Fixtures";

function fullRuntime(records: readonly WikiSearchRecordV2[] = searchFixture()) {
  return buildWikiSearchRuntime(records, buildWikiRuntimeIndex(wikiV2Fixture()), "full");
}

describe("Wiki global search runtime", () => {
  it("groups all matches in product order and retains full group counts", () => {
    const results = searchWiki(fullRuntime(), "表单校验", 1, 20);

    expect(results.groups.map((group) => group.kind)).toEqual([
      "direct",
      "capability-flow",
      "module-file",
      "symbol",
      "context",
    ]);
    expect(results.groups.find((group) => group.kind === "symbol")?.items[0]).toMatchObject({
      pageId: "page:file-a",
      anchor: "run",
      nodeId: "function:src/a.ts:run",
    });
    expect(results.totalByKind).toEqual({
      direct: 1,
      "capability-flow": 1,
      "module-file": 1,
      symbol: 1,
      context: 1,
    });
    expect(results.total).toBe(5);
  });

  it("ranks an exact symbol name above a term-only symbol and searches full page prose", () => {
    const competing: WikiSearchRecordV2 = {
      ...searchFixture().find((record) => record.id === "search:run")!,
      id: "search:helper",
      title: "helper",
      anchor: "helper",
      nodeId: "function:src/a.ts:helper",
      terms: ["run"],
    };
    const bodyOnly: WikiSearchRecordV2 = {
      ...searchFixture()[0]!,
      id: "search:body-only",
      title: "正文检索页",
      pageId: "page:run",
      summary: "摘要没有目标词。",
      terms: [],
      businessTerms: [],
      content: "只有正文包含跨域熔断视窗。",
    };

    const runtime = fullRuntime([...searchFixture(), competing, bodyOnly]);
    expect(searchWiki(runtime, "run", 1, 20).groups
      .find((group) => group.kind === "symbol")?.items.map((item) => item.id))
      .toEqual(["search:run", "search:helper"]);
    expect(searchWiki(runtime, "跨域熔断视窗", 1, 20).groups[0]?.items[0]?.id)
      .toBe("search:body-only");
  });

  it("normalizes NFKC and case while requiring every query token", () => {
    const normalized: WikiSearchRecordV2 = {
      ...searchFixture()[0]!,
      id: "search:normalized",
      title: "ＲＵＮ 控制器",
      pageId: "page:run",
      summary: "入口位于 SRC/A.TS",
      terms: [],
      businessTerms: [],
    };
    const runtime = fullRuntime([normalized]);

    expect(searchWiki(runtime, "run src/a.ts", 1, 20).total).toBe(1);
    expect(searchWiki(runtime, "run 不存在", 1, 20).total).toBe(0);
  });

  it("uses Chinese numeric title order and ID as stable tie breakers", () => {
    const base = { ...searchFixture()[0]!, pageId: "page:overview", businessTerms: [], terms: [] };
    const runtime = fullRuntime([
      { ...base, id: "z", title: "文件 10" },
      { ...base, id: "b", title: "文件 2" },
      { ...base, id: "a", title: "文件 2" },
    ]);

    expect(searchWiki(runtime, "文件", 1, 20).groups[0]?.items.map((item) => item.id))
      .toEqual(["a", "b", "z"]);
  });

  it("returns deterministic empty and validation results", () => {
    expect(searchWiki(fullRuntime(), "  ", 1, 20)).toMatchObject({
      groups: [],
      total: 0,
      hasNextPage: false,
      totalByKind: {
        direct: 0,
        "capability-flow": 0,
        "module-file": 0,
        symbol: 0,
        context: 0,
      },
    });
    expect(() => searchWiki(fullRuntime(), "run", 0, 20)).toThrow(RangeError);
    expect(() => searchWiki(fullRuntime(), "run", 1, 0)).toThrow(RangeError);
  });

  it("paginates globally without duplicates and keeps pre-page totals", () => {
    const first = searchWiki(fullRuntime(), "表单校验", 1, 2);
    const second = searchWiki(fullRuntime(), "表单校验", 2, 2);
    const firstIds = first.groups.flatMap((group) => group.items.map((item) => item.id));
    const secondIds = second.groups.flatMap((group) => group.items.map((item) => item.id));

    expect(firstIds).toHaveLength(2);
    expect(secondIds).toHaveLength(2);
    expect(firstIds.filter((id) => secondIds.includes(id))).toEqual([]);
    expect(first.totalByKind).toEqual(second.totalByKind);
    expect(first.total).toBe(5);
    expect(first.hasNextPage).toBe(true);
  });

  it("derives fallback owner paths for file, config, schema, and document records", () => {
    const payload = wikiV2Fixture();
    const basePage = payload.pages.find((page) => page.id === "page:file-a")!;
    const ownerCases = [
      ["file", "file:\\src\\a.ts\\", "src/a.ts"],
      ["config", "config:/config/app.yaml/", "config/app.yaml"],
      ["schema", "schema:\\schemas\\event.json", "schemas/event.json"],
      ["document", "document:/docs/run.md", "docs/run.md"],
    ] as const;
    payload.pages = ownerCases.map(([name, owner]) => ({
      ...basePage,
      id: `page:${name}`,
      title: name,
      directNodeIds: [owner],
    }));
    payload.nodeDocumentation = [];

    const records = buildFallbackSearchRecords(buildWikiRuntimeIndex(payload));
    for (const [name, , expectedPath] of ownerCases) {
      expect(records.find((record) => record.pageId === `page:${name}`)?.filePath)
        .toBe(expectedPath);
    }

    for (const [name, owner] of [
      ["traversal", "document:docs/../secret.md"],
      ["nul", "file:src/\0secret.ts"],
    ] as const) {
      payload.pages = [{
        ...basePage,
        id: `page:unsafe-${name}`,
        directNodeIds: [owner],
      }];
      const unsafe = buildFallbackSearchRecords(buildWikiRuntimeIndex(payload));
      expect(unsafe[0], name).not.toHaveProperty("filePath");
    }
  });

  it("omits fallback symbols without an anchor or owning page", () => {
    const payload = wikiV2Fixture();
    payload.nodeDocumentation.push(
      {
        ...payload.nodeDocumentation[0]!,
        nodeId: "function:src/a.ts:no-anchor",
        anchor: undefined,
      },
      {
        ...payload.nodeDocumentation[0]!,
        nodeId: "function:src/a.ts:missing-page",
        primaryPageId: "page:missing",
        anchor: "missing-page",
      },
    );

    const symbols = buildFallbackSearchRecords(buildWikiRuntimeIndex(payload))
      .filter((record) => record.kind === "symbol");
    expect(symbols.map((record) => record.nodeId)).toEqual(["function:src/a.ts:run"]);
  });

  it("filters stale full records and keeps the first stable duplicate ID", () => {
    const records = searchFixture();
    const duplicate = { ...records[0]!, title: "后来的重复项" };
    const stale = { ...records[0]!, id: "search:stale", pageId: "page:missing" };
    const runtime = fullRuntime([records[0]!, duplicate, stale]);

    expect(runtime.records).toHaveLength(1);
    expect(runtime.records[0]?.title).toBe(records[0]?.title);
  });

  it("defensively filters symbols that copy page content or global business terms", () => {
    const clean = searchFixture().find((record) => record.kind === "symbol")!;
    const withContent: WikiSearchRecordV2 = {
      ...clean,
      id: "search:symbol-content",
      content: "不应进入符号的页面正文",
    };
    const withBusinessTerms: WikiSearchRecordV2 = {
      ...clean,
      id: "search:symbol-business",
      businessTerms: ["全局业务词"],
    };

    const runtime = fullRuntime([clean, withContent, withBusinessTerms]);
    expect(runtime.records.map((record) => record.id)).toEqual([clean.id]);
    expect(searchWiki(runtime, "页面正文", 1, 20).total).toBe(0);
    expect(searchWiki(runtime, "全局业务词", 1, 20).total).toBe(0);
  });

  it("prepares full page prose once and never rereads it while searching", () => {
    let contentReads = 0;
    const tracked = { ...searchFixture()[0]!, id: "search:tracked-content" };
    Object.defineProperty(tracked, "content", {
      enumerable: true,
      get() {
        contentReads += 1;
        return "正文唯一性能回归词";
      },
    });

    const runtime = fullRuntime([tracked]);
    const readsAfterBuild = contentReads;
    expect(searchWiki(runtime, "性能回归词", 1, 20).total).toBe(1);
    expect(searchWiki(runtime, "正文唯一", 1, 20).total).toBe(1);
    expect(searchWiki(runtime, "不存在", 1, 20).total).toBe(0);
    expect(readsAfterBuild).toBe(1);
    expect(contentReads).toBe(readsAfterBuild);
  });

  it("keeps stable paging over a moderately large prepared prose index", () => {
    const base = searchFixture()[0]!;
    const records: WikiSearchRecordV2[] = Array.from({ length: 120 }, (_, index) => ({
      ...base,
      id: `search:large-${index}`,
      title: `批量文档 ${index + 1}`,
      businessTerms: [],
      terms: [],
      content: `${"较长正文".repeat(500)} 稳定分页关键词`,
    }));
    const runtime = fullRuntime(records);
    const first = searchWiki(runtime, "稳定分页关键词", 1, 25);
    const second = searchWiki(runtime, "稳定分页关键词", 2, 25);
    const firstIds = first.groups.flatMap((group) => group.items.map((item) => item.id));
    const secondIds = second.groups.flatMap((group) => group.items.map((item) => item.id));

    expect(first.total).toBe(120);
    expect(second.totalByKind).toEqual(first.totalByKind);
    expect(firstIds).toHaveLength(25);
    expect(secondIds).toHaveLength(25);
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
  });
});
