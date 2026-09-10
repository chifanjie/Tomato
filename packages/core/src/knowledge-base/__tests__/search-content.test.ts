import { describe, expect, it } from "vitest";
import { createWikiSearchContentMatcher } from "../search-content.js";
import { parseWikiSearchIndexV2, type WikiSearchRecordV2 } from "../wiki-contract.js";

const record: WikiSearchRecordV2 = {
  id: "page:a", kind: "page", title: "a", pageId: "a", role: "reference", category: "file",
  relation: "direct", terms: [], businessTerms: [],
};

describe("lossless shared search content", () => {
  it("preserves every substring and phrase across repeated, empty, Unicode and punctuation lines", () => {
    const dictionary = ["Ａlpha_Beta", "", "中文 café", "x", "y", "z", " $foo() "];
    const ids = [0, 1, 2, 3, 4, 5, 6, 0, 1];
    const normalizeLine = (line: string) => line.normalize("NFKC").toLocaleLowerCase("zh-CN");
    const matcher = createWikiSearchContentMatcher(dictionary, { normalizeLine, separator: "\n" });
    const body = ids.map((id) => dictionary[id]).join("\n");
    const shared = { contentLineIds: ids };
    expect([...matcher.lines(shared)].join("\n")).toBe(body);
    const normalized = normalizeLine(body);
    const queries = new Set(["not present", "beta\n\n中文", "x\ny\nz", "中文 café", " $foo() "]);
    for (let start = 0; start < normalized.length; start += 1) {
      for (let end = start; end <= normalized.length; end += 1) queries.add(normalized.slice(start, end));
    }
    for (const query of queries) {
      expect(matcher.includes(shared, query), query).toBe(normalized.includes(query));
      expect(matcher.includes({ content: body }, query), query).toBe(normalized.includes(query));
    }
  });

  it("supports whitespace-normalized task phrases and exact token boundaries without trimming queries", () => {
    const dictionary = ["AlphaBeta", "", "  中文，策略 ", "alphabet"];
    const normalizeLine = (line: string) => line.normalize("NFKC").replace(/([\p{Ll}\d])([\p{Lu}])/gu, "$1 $2")
      .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/gu, " ");
    const shared = { contentLineIds: [0, 1, 2, 3] };
    const matcher = createWikiSearchContentMatcher(dictionary, { normalizeLine, separator: " ", skipEmptyLines: true });
    const body = normalizeLine(dictionary.join("\n"));
    for (const query of ["alpha beta", "beta 中文", "中文 策略 alphabet", "pha", "beta alphabet"]) {
      expect(matcher.includes(shared, query)).toBe(body.includes(query));
    }
    const exact = createWikiSearchContentMatcher(dictionary, { normalizeLine: (line) => ` ${normalizeLine(line)} `, separator: " " });
    expect(exact.includes(shared, " alpha ")).toBe(true);
    expect(exact.includes(shared, " pha ")).toBe(false);
    expect(exact.includes(shared, " alphabet ")).toBe(true);
  });

  it("normalizes a shared line only once across records and bounded query-cache eviction", () => {
    let normalizations = 0;
    const matcher = createWikiSearchContentMatcher(["shared line"], { normalizeLine: (line) => { normalizations += 1; return line; }, separator: "\n" });
    for (let query = 0; query < 140; query += 1) matcher.includes({ contentLineIds: [0, 0, 0] }, String(query));
    expect(normalizations).toBe(1);
    expect(matcher.includes({ contentLineIds: [0] }, "line")).toBe(true);
  });

  it("accepts legacy inline bodies and rejects ambiguous or dangling shared references", () => {
    const index = { version: 2, generatedAt: "2026-09-10", records: [{ ...record, content: "body" }] };
    expect(parseWikiSearchIndexV2(index).ok).toBe(true);
    expect(parseWikiSearchIndexV2({ ...index, contentLines: ["body"], records: [{ ...record, contentLineIds: [0, 0] }] }).ok).toBe(true);
    for (const invalid of [
      { ...index, records: [{ ...record, contentLineIds: [] }] },
      { ...index, contentLines: ["body"], records: [{ ...record, contentLineIds: [1] }] },
      { ...index, contentLines: ["body"], records: [{ ...record, contentLineIds: [-1] }] },
      { ...index, contentLines: ["body"], records: [{ ...record, content: "body", contentLineIds: [0] }] },
      { ...index, contentLines: ["body"], records: [{ ...record, kind: "symbol", contentLineIds: [0] }] },
    ]) expect(parseWikiSearchIndexV2(invalid).ok).toBe(false);
  });
});
