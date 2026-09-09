/**
 * A missing `wiki-index.json` has two very different causes: no knowledge base
 * at all, or one written in a pre-V2 layout this dashboard cannot read. Telling
 * a reader "尚未生成知识库" for the second sends them to regenerate something
 * that is already on disk, so the dev server reports which case it is.
 */
export function classifyKnowledgeBaseAt(
  roots: readonly string[],
  exists: (candidate: string) => boolean,
  hasContent: (candidate: string) => boolean,
): "absent" | "legacy" {
  for (const root of roots) {
    if (!exists(root)) continue;
    // The directory is there but carries no V2 index — an older generation.
    if (hasContent(root)) return "legacy";
  }
  return "absent";
}
