import { describe, expect, it, vi } from "vitest";
import type { WikiSearchRecordV2 } from "@understand-code/core/knowledge-base";
import { normalizeLegacyMarkdownBranding } from "../../legacyBranding";
import { buildWikiRuntimeIndex } from "../wikiIndex";
import { buildWikiSearchRuntime, searchWiki, type WikiSearchResults } from "../searchIndex";
import { loadSearchArtifact } from "../wikiArtifacts";
import { searchFixture, wikiV2Fixture } from "./fixtures/wikiV2Fixtures";

function shared(records: readonly WikiSearchRecordV2[]) {
  const contentLines: string[] = [];
  const dictionary = new Map<string, number>();
  return { records: records.map((record) => {
    if (record.content === undefined) return record;
    const { content, ...metadata } = record;
    return { ...metadata, contentLineIds: content.split("\n").map((line) => {
      let id = dictionary.get(line);
      if (id === undefined) { id = contentLines.length; dictionary.set(line, id); contentLines.push(line); }
      return id;
    }) };
  }), contentLines };
}

const snapshot = (result: WikiSearchResults) => ({ ...result, groups: result.groups.map((group) => ({
  kind: group.kind, ids: group.items.map((record) => record.id),
})) });
const page = searchFixture().find((record) => record.kind === "page")!;
const fixtureIndex = () => buildWikiRuntimeIndex(wikiV2Fixture());

describe("shared Wiki search content", () => {
  it("preserves inline recall, phrase ranking, stable order and pagination without expanded body copies", () => {
    const bodies = [
      "  ＲＵＮ Café e\u0301\n跨行\n短语\nalpha\n\nomega\n重复\n重复\nC++ a.b [x]  ",
      "RUN\n跨行\n\n短语\nalpha omega\n重复\n不同\n重复\nspace  keep\nprefix\n\n\nsuffix",
      "跨行 短语\nalpha\n\nomega\nC++ a.b [x]\nspace keep\nΣς",
    ];
    const records = bodies.map((content, index) => ({ ...page, id: `body:${index}`, title: "相同标题", summary: "相同摘要", terms: [], businessTerms: [], content }));
    // A body phrase earns +30 and must sort before the otherwise tied record.
    records.push({ ...records[0]!, id: "body:0-before", content: "alpha and omega" });
    const compressed = shared(records);
    const inline = buildWikiSearchRuntime(records, fixtureIndex(), "full");
    const compact = buildWikiSearchRuntime(compressed.records, fixtureIndex(), "full", compressed.contentLines);
    const queries = ["run", "ＣＡＦÉ", "é", "跨行\n短语", "alpha\n\nomega", "alpha omega", "重复\n重复", "c++ a.b [x]", "space  keep", "prefix\n\n\nsuffix", "σς", "missing"];
    for (const query of queries) for (const pageNumber of [1, 2, 3]) {
      expect(snapshot(searchWiki(compact, query, pageNumber, 2)), `${query} page ${pageNumber}`)
        .toEqual(snapshot(searchWiki(inline, query, pageNumber, 2)));
    }
    expect(searchWiki(compact, "alpha\n\nomega", 1, 20).groups[0]?.items[0]?.id).toBe("body:0");
    expect(compact.preparedRecords.every((record) => record.content === "" && !record.haystack.includes("跨行"))).toBe(true);
    expect(compact.records.every((record) => record.content === undefined)).toBe(true);
    expect(compressed.contentLines.length).toBeLessThan(bodies.join("\n").split("\n").length);
  });

  it("keeps all symbol records searchable by their own names and paths", () => {
    const source = searchFixture().find((record) => record.kind === "symbol")!;
    const symbols = Array.from({ length: 256 }, (_, index) => ({ ...source, id: `symbol:${index}`, nodeId: `function:src/file.ts:handler${index}`,
      title: `handler${index}`, anchor: `handler${index}`, filePath: "src/file.ts", terms: [`handler${index}`], businessTerms: [] }));
    const compact = shared([{ ...page, content: "shared source navigation" }, ...symbols]);
    const runtime = buildWikiSearchRuntime(compact.records, fixtureIndex(), "full", compact.contentLines);
    for (const symbol of symbols) expect(searchWiki(runtime, `${symbol.title} src/file.ts`, 1, 300).groups
      .flatMap((group) => group.items).some((record) => record.id === symbol.id)).toBe(true);
    expect(runtime.records.filter((record) => record.kind === "symbol")).toHaveLength(symbols.length);
  });

  it("rejects invalid shared references and page bodies on symbol records in both loader and runtime", async () => {
    const { content: _content, ...base } = page;
    const symbol = searchFixture().find((record) => record.kind === "symbol")!;
    const cases = [
      { records: [{ ...base, contentLineIds: [0] }] },
      { contentLines: ["body"], records: [{ ...base, contentLineIds: [-1] }] },
      { contentLines: ["body"], records: [{ ...base, contentLineIds: [1] }] },
      { contentLines: ["body"], records: [{ ...base, contentLineIds: [0.5] }] },
      { contentLines: ["body"], records: [{ ...base, contentLineIds: ["0"] }] },
      { contentLines: ["body"], records: [{ ...base, content: "body", contentLineIds: [0] }] },
      { contentLines: ["body"], records: [{ ...symbol, contentLineIds: [0] }] },
    ];
    for (const payload of cases) {
      const loaded = await loadSearchArtifact("test", vi.fn(async () => new Response(JSON.stringify({ version: 2, ...payload }))) as typeof fetch);
      expect(loaded).toEqual({ status: "invalid", records: [] });
      const runtime = buildWikiSearchRuntime(payload.records as WikiSearchRecordV2[], fixtureIndex(), "full", payload.contentLines);
      expect(runtime.records).toHaveLength(0);
    }
    expect(await loadSearchArtifact("test", vi.fn(async () => new Response(JSON.stringify({ version: 2, contentLines: [42], records: [] }))) as typeof fetch))
      .toEqual({ status: "invalid", records: [] });
  });

  it("preserves dictionary references through loading and rewrites historical prose with page Markdown context", async () => {
    const bodies = ["# understand-anything\n```\nunderstand-anything\n```", "understand-anything", "No historical prose\nRepeated\nRepeated"];
    const inline = bodies.map((content, index) => ({ ...page, id: `legacy:${index}`, title: "understand-anything", content }));
    const compressed = shared(inline);
    const originalLines = [...compressed.contentLines];
    const response = { ok: true, status: 200, json: async () => ({ version: 2, ...compressed }) } as Response;
    const loaded = await loadSearchArtifact("test", vi.fn(async () => response) as typeof fetch);
    expect(loaded.status).toBe("ready");
    if (loaded.status !== "ready") return;
    expect(loaded.contentLines).toBeDefined();
    expect(compressed.contentLines).toEqual(originalLines);
    loaded.records.forEach((record, index) => {
      expect(record.content).toBeUndefined();
      expect(record.contentLineIds!.map((id) => loaded.contentLines![id]).join("\n")).toBe(normalizeLegacyMarkdownBranding(bodies[index]!));
    });
    expect(loaded.records[0]?.contentLineIds?.map((id) => loaded.contentLines![id])).toContain("understand-anything");
    const runtime = buildWikiSearchRuntime(loaded.records, fixtureIndex(), "full", loaded.contentLines);
    expect(searchWiki(runtime, "Understand Code", 1, 20).total).toBe(3);
  });

  it("retains the same dictionary object when no legacy Markdown needs rewriting", async () => {
    const compressed = shared([{ ...page, content: "Original body\nOriginal body" }]);
    const loaded = await loadSearchArtifact("test", vi.fn(async () => ({ status: 200, ok: true,
      json: async () => ({ version: 2, ...compressed }) }) as Response) as typeof fetch);
    expect(loaded.status).toBe("ready");
    if (loaded.status === "ready") {
      expect(loaded.contentLines).toBe(compressed.contentLines);
      expect(loaded.records[0]?.contentLineIds).toBe(compressed.records[0]?.contentLineIds);
    }
  });
});
