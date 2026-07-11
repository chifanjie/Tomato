import { describe, expect, it } from "vitest";
import { parseWikiIndex } from "../wiki-v1-adapter.js";

const legacy = {
  version: 1,
  generatedAt: "2026-07-11T00:00:00.000Z",
  projectName: "legacy",
  source: { outputLanguage: "zh-Hans", generationMode: "writer" },
  pages: [{
    id: "legacy-page", title: "旧文档", category: "file", summary: "旧版文件说明。",
    markdownPath: "knowledge-base/文件文档/a.md",
    explainedNodeIds: ["file:src/a.ts"],
    relatedNodeIds: ["function:src/a.ts:run"],
    evidenceIds: ["e1"], coverage: "partial", quality: "verified",
    searchTerms: ["a.ts"],
  }],
  evidence: [{ id: "e1", label: "a", filePath: "src/a.ts", lineRange: [1, 2], nodeIds: ["file:src/a.ts"] }],
  gaps: [{ id: "g1", nodeId: "function:src/a.ts:run", reason: "missing", severity: "high" }],
};

describe("V1 Wiki adapter", () => {
  it("maps links without inventing verification, strong evidence, or dedicated-body gaps", () => {
    const parsed = parseWikiIndex(legacy);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
    expect(parsed.sourceVersion).toBe(1);
    expect(parsed.value.pages[0]).toMatchObject({
      role: "reference", directNodeIds: ["file:src/a.ts"],
      contextNodeIds: ["function:src/a.ts:run"], quality: "needs-review",
      generationStatus: "partial",
    });
    expect(parsed.value.pages[0]).not.toHaveProperty("verification");
    expect(parsed.value.nodeDocumentation.find((item) => item.nodeId === "file:src/a.ts")).toMatchObject({
      relation: "direct", quality: "needs-review", evidenceHealth: "weak",
      directPageIds: ["legacy-page"], evidenceIds: ["e1"],
    });
    expect(parsed.value.nodeDocumentation.find((item) => item.nodeId === "function:src/a.ts:run")).toMatchObject({
      relation: "context", directPageIds: [], contextPageIds: ["legacy-page"], evidenceIds: [],
    });
    expect(parsed.value.mainReadiness.status).toBe("blocked");
  });

  it("rejects a malformed V1 record instead of coercing missing fields with String(undefined)", () => {
    const parsed = parseWikiIndex({ ...legacy, pages: [{ id: "broken" }] });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error("expected invalid payload");
    expect(parsed.errors.join("\n")).toContain("pages.0.title");
  });
});
