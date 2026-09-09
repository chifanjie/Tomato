import { describe, expect, it } from "vitest";

import { classifyKnowledgeBaseAt } from "../../knowledgeBaseState";

describe("classifyKnowledgeBaseAt", () => {
  const exists = (roots: string[]) => (candidate: string) => roots.includes(candidate);

  it("reports absent when no knowledge-base directory exists", () => {
    expect(classifyKnowledgeBaseAt(["/a/kb", "/b/kb"], exists([]), () => true)).toBe("absent");
  });

  it("reports legacy when a directory exists and holds documents", () => {
    // 797 markdown documents on disk, but no wiki-index.json: a pre-V2 layout.
    expect(
      classifyKnowledgeBaseAt(["/a/kb"], exists(["/a/kb"]), () => true),
    ).toBe("legacy");
  });

  it("reports absent for an empty knowledge-base directory", () => {
    expect(
      classifyKnowledgeBaseAt(["/a/kb"], exists(["/a/kb"]), () => false),
    ).toBe("absent");
  });

  it("checks every candidate root before giving up", () => {
    expect(
      classifyKnowledgeBaseAt(["/a/kb", "/b/kb"], exists(["/b/kb"]), (c) => c === "/b/kb"),
    ).toBe("legacy");
  });
});
