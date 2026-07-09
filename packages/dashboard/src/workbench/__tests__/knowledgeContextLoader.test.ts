import { describe, expect, it } from "vitest";
import {
  loadDashboardKnowledge,
  type DashboardKnowledge,
} from "../knowledgeContextLoader";

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("dashboard knowledge loader", () => {
  it("loads wiki-index.json as the primary wiki/graph linkage source", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string) => {
      calls.push(url);
      if (url.includes("knowledge-base/wiki-index.json")) {
        return jsonResponse({
          version: 1,
          generatedAt: "2026-07-09T00:00:00.000Z",
          projectName: "exampleRepository-helper",
          pages: [
            {
              id: "wiki:overview",
              title: "Project Overview",
              category: "overview",
              summary: "Overview.",
              markdownPath: "knowledge-base/README.md",
              explainedNodeIds: ["module:productline"],
              relatedNodeIds: [],
              evidenceIds: [],
              coverage: "complete",
              quality: "verified",
            },
          ],
          evidence: [],
          gaps: [],
        });
      }
      return new Response("missing", { status: 404 });
    };

    const result: DashboardKnowledge = await loadDashboardKnowledge("local-token", fetcher as typeof fetch);

    expect(calls[0]).toContain("knowledge-base/wiki-index.json");
    expect(result.wikiIndex.pageCount).toBe(1);
    expect(result.contextIndex.documentCount).toBeGreaterThanOrEqual(1);
  });

  it("falls back to trace and markdown indexes when wiki-index.json is missing", async () => {
    const fetcher = async (url: string) => {
      if (url.includes("document-traces.json")) {
        return jsonResponse({
          documents: [
            {
              documentPath: "knowledge-base/业务能力/ProductLine.md",
              coveredNodeIds: ["function:productline/service.go:Recognise"],
              coveredFilePaths: ["productline/service.go"],
              summary: "Product line docs.",
            },
          ],
        });
      }
      if (url.includes("%E4%B8%9A%E5%8A%A1%E8%83%BD%E5%8A%9B") || url.includes("业务能力")) {
        return new Response("- [ProductLine](knowledge-base/业务能力/ProductLine.md)", { status: 200 });
      }
      if (url.includes("%E4%B8%9A%E5%8A%A1%E6%B5%81%E7%A8%8B") || url.includes("业务流程")) {
        return new Response("", { status: 200 });
      }
      return new Response("missing", { status: 404 });
    };

    const result = await loadDashboardKnowledge("local-token", fetcher as typeof fetch);

    expect(result.wikiIndex.pageCount).toBe(0);
    expect(result.contextIndex.traceCount).toBe(2);
  });
});
