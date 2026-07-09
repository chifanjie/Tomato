import { describe, expect, it } from "vitest";
import {
  buildWikiIndex,
  emptyWikiIndex,
  pagesForNode,
  primaryPageForNode,
  coverageForNode,
  evidenceForPage,
  pageTree,
  type WikiIndexPayload,
} from "../wikiIndex";

function payload(): WikiIndexPayload {
  return {
    version: 1,
    generatedAt: "2026-07-09T00:00:00.000Z",
    projectName: "exampleRepository-helper",
    pages: [
      {
        id: "wiki:overview",
        title: "Project Overview",
        category: "overview",
        summary: "Project summary.",
        markdownPath: "knowledge-base/README.md",
        explainedNodeIds: ["module:productline"],
        relatedNodeIds: ["file:productline/service.go"],
        evidenceIds: ["evidence:overview"],
        coverage: "complete",
        quality: "verified",
      },
      {
        id: "wiki:recognise",
        title: "Recognition Flow",
        category: "flow",
        summary: "Flow summary.",
        markdownPath: "knowledge-base/业务流程/Recognition.md",
        explainedNodeIds: ["function:productline/service.go:Recognise"],
        relatedNodeIds: ["file:shared/rate_limit.go"],
        evidenceIds: ["evidence:recognise"],
        coverage: "partial",
        quality: "generated",
      },
    ],
    evidence: [
      {
        id: "evidence:overview",
        label: "Module overview",
        filePath: "productline/service.go",
        lineRange: [1, 8],
        nodeIds: ["module:productline"],
      },
      {
        id: "evidence:recognise",
        label: "Recognise function",
        filePath: "productline/service.go",
        lineRange: [12, 44],
        nodeIds: ["function:productline/service.go:Recognise"],
      },
    ],
    gaps: [
      {
        id: "gap:rate-limit-doc",
        nodeId: "file:shared/rate_limit.go",
        reason: "Rate limit helper is not explained.",
        severity: "medium",
      },
    ],
  };
}

describe("wikiIndex", () => {
  it("builds page, node, evidence, and gap lookup maps", () => {
    const index = buildWikiIndex(payload());

    expect(index.pageCount).toBe(2);
    expect(index.pagesById.get("wiki:recognise")?.title).toBe("Recognition Flow");
    expect(pagesForNode(index, "function:productline/service.go:Recognise").map((page) => page.id)).toEqual([
      "wiki:recognise",
    ]);
    expect(primaryPageForNode(index, "module:productline")?.id).toBe("wiki:overview");
    expect(evidenceForPage(index, "wiki:recognise").map((item) => item.id)).toEqual([
      "evidence:recognise",
    ]);
  });

  it("reports complete, partial, gap, and unknown node coverage", () => {
    const index = buildWikiIndex(payload());

    expect(coverageForNode(index, "module:productline").status).toBe("complete");
    expect(coverageForNode(index, "function:productline/service.go:Recognise").status).toBe("partial");
    expect(coverageForNode(index, "file:shared/rate_limit.go").status).toBe("gap");
    expect(coverageForNode(index, "file:missing.go").status).toBe("unknown");
  });

  it("groups pages into a stable navigation tree", () => {
    const input = payload();
    input.pages = [...input.pages].reverse();
    const index = buildWikiIndex(input);

    expect(pageTree(index).map((section) => [section.category, section.pages.map((page) => page.id)])).toEqual([
      ["overview", ["wiki:overview"]],
      ["flow", ["wiki:recognise"]],
    ]);
  });

  it("returns safe empty indexes when no wiki metadata exists", () => {
    const index = emptyWikiIndex();

    expect(index.pageCount).toBe(0);
    expect(pagesForNode(index, "node:a")).toEqual([]);
    expect(coverageForNode(index, "node:a").status).toBe("unknown");
  });
});
