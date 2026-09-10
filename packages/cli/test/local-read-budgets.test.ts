import { describe, expect, it } from "vitest";
import { assertLocalIndexReadSizeV1, LOCAL_INDEX_READ_BUDGETS_V1, withLocalIndexReadBudgetsV1 } from "../src/runtime/local-read-budgets.js";

describe("trusted local index read budgets", () => {
  it("allows a larger configured bounded read and rejects the same bytes above a smaller budget", async () => {
    const bytes = Buffer.from('{"ready":true}');
    const reader = { async read(_relativePath: string) { return bytes; } };
    const budgets = { graphBytes: 16, wikiBytes: 16, searchBytes: 16, otherBytes: 16 };
    for (const filePath of ["knowledge-graph.json", "knowledge-base/wiki-index.json", "knowledge-base/search-index.json", "meta.json"]) {
      await expect(withLocalIndexReadBudgetsV1(reader, budgets).read(filePath)).resolves.toEqual(bytes);
      await expect(withLocalIndexReadBudgetsV1(reader, { graphBytes: 4, wikiBytes: 4, searchBytes: 4, otherBytes: 4 }).read(filePath)).rejects.toThrow("exceeds");
    }
  });
  it("keeps explicit finite upper bounds without allocating oversized fixtures", () => {
    expect(LOCAL_INDEX_READ_BUDGETS_V1).toMatchObject({ graphBytes: 128 * 1024 * 1024, wikiBytes: 256 * 1024 * 1024, searchBytes: 384 * 1024 * 1024 });
    expect(() => assertLocalIndexReadSizeV1("knowledge-graph.json", 56_928_623)).not.toThrow();
    expect(() => assertLocalIndexReadSizeV1("knowledge-base/wiki-index.json", 226_113_467)).not.toThrow();
    expect(() => assertLocalIndexReadSizeV1("knowledge-base/search-index.json", 310_000_000)).not.toThrow();
    expect(() => assertLocalIndexReadSizeV1("knowledge-base/wiki-index.json", 310_000_000)).toThrow("exceeds");
    expect(() => assertLocalIndexReadSizeV1("knowledge-graph.json", LOCAL_INDEX_READ_BUDGETS_V1.graphBytes + 1)).toThrow("exceeds");
    expect(() => assertLocalIndexReadSizeV1("knowledge-base/search-index.json", LOCAL_INDEX_READ_BUDGETS_V1.searchBytes + 1)).toThrow("exceeds");
    for (const key of ["graphBytes", "wikiBytes", "searchBytes", "otherBytes"] as const) {
      for (const value of [Infinity, NaN, 0, -1, 1.5, LOCAL_INDEX_READ_BUDGETS_V1[key] + 1]) {
        expect(() => withLocalIndexReadBudgetsV1({ async read() { return Buffer.alloc(0); } }, { ...LOCAL_INDEX_READ_BUDGETS_V1, [key]: value })).toThrow("invalid");
      }
    }
  });
});
