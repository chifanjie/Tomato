import { describe, expect, it } from "vitest";
import { buildWikiIndex } from "../../../wiki/wikiIndex";
import { buildKnowledgeConsoleView } from "../knowledgeConsoleModel";

describe("knowledgeConsoleModel", () => {
  it("builds navigation, active page, evidence, and graph node ids", () => {
    const index = buildWikiIndex({
      version: 1,
      generatedAt: "2026-07-09T00:00:00.000Z",
      projectName: "sample",
      pages: [
        {
          id: "wiki:overview",
          title: "Project Overview",
          category: "overview",
          summary: "Repository overview.",
          markdownPath: "knowledge-base/README.md",
          explainedNodeIds: ["file:src/a.go"],
          relatedNodeIds: ["function:src/a.go:Build"],
          evidenceIds: ["evidence:build"],
          coverage: "complete",
          quality: "verified",
        },
      ],
      evidence: [
        {
          id: "evidence:build",
          label: "Build implementation",
          filePath: "src/a.go",
          lineRange: [10, 20],
          nodeIds: ["function:src/a.go:Build"],
        },
      ],
      gaps: [],
    });

    const view = buildKnowledgeConsoleView(index, "wiki:overview");

    expect(view.activePage?.title).toBe("Project Overview");
    expect(view.sections.map((section) => section.category)).toEqual(["overview"]);
    expect(view.evidence.map((item) => item.label)).toEqual(["Build implementation"]);
    expect(view.graphNodeIds).toEqual(["file:src/a.go", "function:src/a.go:Build"]);
    expect(view.emptyReason).toBeNull();
  });

  it("uses the first page when the active page id is missing", () => {
    const index = buildWikiIndex({
      version: 1,
      generatedAt: "2026-07-09T00:00:00.000Z",
      projectName: "sample",
      pages: [
        {
          id: "wiki:first",
          title: "First",
          category: "overview",
          summary: "First page.",
          markdownPath: "knowledge-base/README.md",
          explainedNodeIds: [],
          relatedNodeIds: [],
          evidenceIds: [],
          coverage: "complete",
          quality: "verified",
        },
      ],
      evidence: [],
      gaps: [],
    });

    const view = buildKnowledgeConsoleView(index, "wiki:missing");

    expect(view.activePage?.id).toBe("wiki:first");
  });

  it("returns an empty-state view when no wiki pages exist", () => {
    const view = buildKnowledgeConsoleView(buildWikiIndex(null), null);

    expect(view.activePage).toBeNull();
    expect(view.sections).toEqual([]);
    expect(view.evidence).toEqual([]);
    expect(view.graphNodeIds).toEqual([]);
    expect(view.emptyReason).toBe("No generated wiki metadata is available yet.");
  });
});
