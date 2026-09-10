/** Trusted local composition limits; these do not alter Provider defaults. */
export const LOCAL_INDEX_READ_BUDGETS_V1 = Object.freeze({
  graphBytes: 128 * 1024 * 1024,
  wikiBytes: 256 * 1024 * 1024,
  searchBytes: 384 * 1024 * 1024,
  otherBytes: 64 * 1024 * 1024,
});

type Budgets = typeof LOCAL_INDEX_READ_BUDGETS_V1;

export function assertLocalIndexReadSizeV1(relativePath: string, bytes: number, budgets: Budgets = LOCAL_INDEX_READ_BUDGETS_V1): void {
  for (const key of Object.keys(LOCAL_INDEX_READ_BUDGETS_V1) as Array<keyof Budgets>) {
    if (!Number.isSafeInteger(budgets[key]) || budgets[key] <= 0 || budgets[key] > LOCAL_INDEX_READ_BUDGETS_V1[key]) throw new RangeError("invalid local index read budget");
  }
  const limit = relativePath === "knowledge-graph.json" ? budgets.graphBytes
    : relativePath === "knowledge-base/wiki-index.json" ? budgets.wikiBytes
      : relativePath === "knowledge-base/search-index.json" ? budgets.searchBytes : budgets.otherBytes;
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > limit) throw new RangeError("local index artifact exceeds its read budget");
}

export function withLocalIndexReadBudgetsV1<T extends { read(relativePath: string): Promise<Buffer> }>(reader: T, requested: Budgets = LOCAL_INDEX_READ_BUDGETS_V1): T {
  const budgets = { ...requested };
  for (const key of Object.keys(LOCAL_INDEX_READ_BUDGETS_V1) as Array<keyof Budgets>) {
    if (!Number.isSafeInteger(budgets[key]) || budgets[key] <= 0 || budgets[key] > LOCAL_INDEX_READ_BUDGETS_V1[key]) throw new RangeError("invalid local index read budget");
  }
  return { ...reader, async read(relativePath: string) {
    const bytes = await reader.read(relativePath);
    assertLocalIndexReadSizeV1(relativePath, bytes.byteLength, budgets);
    return bytes;
  } };
}
