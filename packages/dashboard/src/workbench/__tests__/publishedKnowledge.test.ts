import { describe, expect, it, vi } from "vitest";
import { createPublishedKnowledgeFetcher, parsePublishedKnowledgeVersion } from "../publishedKnowledge";

const generationId = `generation-${"a".repeat(64)}`;
const version = {
  status: "historical", generationId, sourceSnapshotId: "snapshot:old",
  currentSnapshotId: "snapshot:current", finalizedProviderRevision: 2,
};

describe("published knowledge read transport", () => {
  it("accepts truthful version metadata and freezes a detached copy", () => {
    const parsed = parsePublishedKnowledgeVersion(version);
    expect(parsed).toEqual(version);
    expect(parsed).not.toBe(version);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(parsePublishedKnowledgeVersion({ ...version, status: "current", sourceSnapshotId: version.currentSnapshotId }).status).toBe("current");
  });

  it.each([
    null, {}, { ...version, status: "current" },
    { ...version, sourceSnapshotId: version.currentSnapshotId },
    { ...version, generationId: "../current" },
    { ...version, currentSnapshotId: "" },
    { ...version, finalizedProviderRevision: 0 },
    { ...version, finalizedProviderRevision: 2.5 },
  ])("rejects invalid or misleading metadata: %j", (input) => {
    expect(() => parsePublishedKnowledgeVersion(input)).toThrow();
  });

  it("pins graph, Wiki, search and Markdown to the same generation", async () => {
    const fetcher = vi.fn(async () => new Response("{}"));
    const pinned = createPublishedKnowledgeFetcher(generationId, fetcher);
    const init = { credentials: "same-origin" as const };
    for (const path of ["/knowledge-graph.json", "/meta.json", "/knowledge-base/wiki-index.json", "/knowledge-base/search-index.json", "/knowledge-base/overview.md"]) {
      await pinned(path, init);
      expect(fetcher).toHaveBeenLastCalledWith(`${path}?indexVersion=published&indexGenerationId=${generationId}`, init);
    }
  });

  it.each(["/tasks/task/brief.json", "/config.json", "//other.test/knowledge-graph.json", "https://other.test/knowledge-base/a.md", "/knowledge-base/../tasks/task/brief.json"])("does not retarget non-knowledge requests: %s", async (url) => {
    const fetcher = vi.fn();
    await expect(createPublishedKnowledgeFetcher(generationId, fetcher)(url)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
