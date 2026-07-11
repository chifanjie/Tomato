import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadDashboardKnowledge,
  loadKnowledgeContextIndex,
  shouldRetryWikiLoad,
  type DashboardKnowledge,
} from "../knowledgeContextLoader";
import {
  resolveKnowledgeContext,
  type WorkbenchSelection,
} from "../knowledgeContext";
import { wikiV2Fixture } from "../../wiki/__tests__/fixtures/wikiV2Fixtures";

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function validWikiPayload(): Record<string, unknown> {
  return {
    version: 1,
    generatedAt: "2026-07-09T00:00:00.000Z",
    projectName: "exampleRepository-helper",
    pages: [
      {
        id: "wiki:productline",
        title: "Product Line Recognition",
        category: "capability",
        summary: "Explains product line recognition.",
        markdownPath: "knowledge-base/业务能力/ProductLine.md",
        explainedNodeIds: ["function:productline/service.go:Recognise"],
        relatedNodeIds: ["module:productline"],
        evidenceIds: ["ev:recognise"],
        coverage: "complete",
        quality: "verified",
      },
    ],
    evidence: [
      {
        id: "ev:recognise",
        label: "Recognise implementation",
        filePath: "productline/service.go",
        lineRange: [10, 20],
        nodeIds: ["function:productline/service.go:Recognise"],
      },
    ],
    gaps: [
      {
        id: "gap:legacy",
        nodeId: "function:legacy/service.go:Run",
        reason: "Missing legacy docs.",
        severity: "low",
      },
    ],
  };
}

function fallbackTracePayload(): Record<string, unknown> {
  return {
    documents: [
      {
        documentPath: "knowledge-base/业务能力/ProductLine.md",
        coveredNodeIds: ["function:productline/service.go:Recognise"],
        coveredFilePaths: ["productline/service.go"],
        summary: "Product line docs.",
      },
    ],
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

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
    expect(calls[0]).toContain("token=local-token");
    expect(calls.some((url) => url.includes("document-traces.json"))).toBe(false);
    expect(result.wikiIndex.pageCount).toBe(1);
    expect(result.wikiStatus).toBe("ready");
    expect(result.sourceVersion).toBe(1);
    expect(result).not.toHaveProperty("contextIndex");
    expect(calls).toHaveLength(1);
  });

  it("keeps wiki-index node and evidence linkage in the wiki index without building workbench context", async () => {
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
              id: "wiki:productline",
              title: "Product Line Recognition",
              category: "capability",
              summary: "Explains product line recognition.",
              markdownPath: "knowledge-base/业务能力/ProductLine.md",
              explainedNodeIds: ["function:productline/service.go:Recognise"],
              relatedNodeIds: ["module:productline"],
              evidenceIds: ["ev:recognise"],
              coverage: "complete",
              quality: "verified",
            },
          ],
          evidence: [
            {
              id: "ev:recognise",
              label: "Recognise implementation",
              filePath: "productline/service.go",
              lineRange: [10, 20],
              nodeIds: ["function:productline/service.go:Recognise"],
            },
          ],
          gaps: [],
        });
      }
      return new Response("missing", { status: 404 });
    };

    const result = await loadDashboardKnowledge("local-token", fetcher as typeof fetch);

    expect(calls).toHaveLength(1);
    expect(result).not.toHaveProperty("contextIndex");
    expect(
      result.wikiIndex.directPagesByNodeId.get(
        "function:productline/service.go:Recognise",
      )?.[0]?.id,
    ).toBe("wiki:productline");
    expect(result.wikiIndex.evidenceById.get("ev:recognise")?.filePath).toBe(
      "productline/service.go",
    );
  });

  it("loads a Core V2 payload without a Dashboard-local schema", async () => {
    const fetcher = async (url: string) => {
      if (url.includes("knowledge-base/wiki-index.json")) {
        return jsonResponse(wikiV2Fixture());
      }
      return new Response("missing", { status: 404 });
    };

    const result = await loadDashboardKnowledge("local-token", fetcher as typeof fetch);

    expect(result.wikiStatus).toBe("ready");
    expect(result.sourceVersion).toBe(2);
    expect(result.wikiIndex.routePages.map((page) => page.id)).toEqual([
      "page:overview",
      "page:run",
    ]);
  });

  it("returns invalid without loading legacy fallback data when wiki-index.json is malformed", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string) => {
      calls.push(url);
      if (url.includes("knowledge-base/wiki-index.json")) {
        return jsonResponse({});
      }
      if (url.includes("document-traces.json")) {
        return jsonResponse(fallbackTracePayload());
      }
      return new Response("missing", { status: 404 });
    };

    const result = await loadDashboardKnowledge("local-token", fetcher as typeof fetch);

    expect(result.wikiIndex.pageCount).toBe(0);
    expect(result.wikiStatus).toBe("invalid");
    expect(result.sourceVersion).toBeNull();
    expect(result).not.toHaveProperty("contextIndex");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("knowledge-base/wiki-index.json");
  });

  it("returns missing with a null source version for a 404", async () => {
    const result = await loadDashboardKnowledge(
      "local-token",
      (async () => new Response("missing", { status: 404 })) as typeof fetch,
    );

    expect(result.wikiStatus).toBe("missing");
    expect(result.sourceVersion).toBeNull();
    expect(result.wikiIndex.pageCount).toBe(0);
  });

  it("returns invalid when wiki-index.json contains malformed JSON", async () => {
    const result = await loadDashboardKnowledge(
      "local-token",
      (async () => new Response("{", { status: 200 })) as typeof fetch,
    );

    expect(result.wikiStatus).toBe("invalid");
    expect(result.sourceVersion).toBeNull();
    expect(result.wikiIndex.pageCount).toBe(0);
  });

  it("returns forbidden immediately without probing legacy protected files", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string) => {
      calls.push(url);
      return new Response("forbidden", { status: 403 });
    };

    const result = await loadDashboardKnowledge("expired-token", fetcher as typeof fetch);

    expect(result.wikiStatus).toBe("forbidden");
    expect(result.sourceVersion).toBeNull();
    expect(result.wikiIndex.pageCount).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("knowledge-base/wiki-index.json");
  });

  it("returns invalid without legacy requests when wiki-index.json contains invalid enum values", async () => {
    const validPayload = validWikiPayload();
    const [validPage] = validPayload.pages as Record<string, unknown>[];
    const [validGap] = validPayload.gaps as Record<string, unknown>[];
    const invalidPayloads = [
      { field: "category", payload: { ...validPayload, pages: [{ ...validPage, category: "unknown-category" }] } },
      { field: "coverage", payload: { ...validPayload, pages: [{ ...validPage, coverage: "gap" }] } },
      { field: "quality", payload: { ...validPayload, pages: [{ ...validPage, quality: "unreviewed" }] } },
      { field: "severity", payload: { ...validPayload, gaps: [{ ...validGap, severity: "critical" }] } },
    ];

    for (const { field, payload } of invalidPayloads) {
      const calls: string[] = [];
      const fetcher = async (url: string) => {
        calls.push(url);
        if (url.includes("knowledge-base/wiki-index.json")) {
          return jsonResponse(payload);
        }
        if (url.includes("document-traces.json")) {
          return jsonResponse(fallbackTracePayload());
        }
        return new Response("missing", { status: 404 });
      };

      const result = await loadDashboardKnowledge("local-token", fetcher as typeof fetch);

      expect(result.wikiIndex.pageCount, field).toBe(0);
      expect(result.wikiStatus, field).toBe("invalid");
      expect(calls, field).toHaveLength(1);
      expect(calls[0], field).toContain("knowledge-base/wiki-index.json");
    }
  });

  it("does not append access tokens to optional data URLs in demo mode", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    const calls: string[] = [];
    const fetcher = async (url: string) => {
      calls.push(url);
      return new Response("missing", { status: 404 });
    };

    await loadDashboardKnowledge("local-token", fetcher as typeof fetch);

    expect(calls).toHaveLength(1);
    expect(calls.every((url) => !url.includes("token="))).toBe(true);
  });

  it("retries only retryable wiki statuses and respects the attempt limit", () => {
    expect(shouldRetryWikiLoad("missing", 0, 3)).toBe(true);
    expect(shouldRetryWikiLoad("invalid", 0, 3)).toBe(true);
    expect(shouldRetryWikiLoad("error", 0, 3)).toBe(true);
    expect(shouldRetryWikiLoad("missing", 3, 3)).toBe(false);
    expect(shouldRetryWikiLoad("ready", 0, 3)).toBe(false);
    expect(shouldRetryWikiLoad("forbidden", 0, 3)).toBe(false);
  });

  it("keeps the legacy context loader available without invoking it from the wiki-first loader", async () => {
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

    const result = await loadKnowledgeContextIndex("local-token", fetcher as typeof fetch);

    const selection: WorkbenchSelection = {
      nodeId: "function:productline/service.go:Recognise",
      filePath: "productline/service.go",
      title: "Recognise",
      summary: "Recognises product lines.",
      kind: "function",
    };
    const context = resolveKnowledgeContext(result, selection);

    expect(result.traceCount).toBe(2);
    expect(result.documentCount).toBe(1);
    expect(context.matchKind).toBe("direct-trace");
  });
});
