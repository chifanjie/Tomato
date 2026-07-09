import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadDashboardKnowledge,
  shouldRetryKnowledgeContextLoad,
  type DashboardKnowledge,
} from "../knowledgeContextLoader";
import {
  buildKnowledgeContextIndex,
  resolveKnowledgeContext,
  type WorkbenchSelection,
} from "../knowledgeContext";

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
    expect(result.contextIndex.documentCount).toBeGreaterThanOrEqual(1);
  });

  it("makes wiki-index pages reachable by workbench node and file selections", async () => {
    const fetcher = async (url: string) => {
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
    const nodeSelection: WorkbenchSelection = {
      nodeId: "function:productline/service.go:Recognise",
      filePath: "productline/service.go",
      title: "Recognise",
      summary: "Recognises product lines.",
      kind: "function",
    };
    const fileSelection: WorkbenchSelection = {
      nodeId: "file:productline/service.go",
      filePath: "productline/service.go",
      title: "service.go",
      summary: "Product line service.",
      kind: "file",
    };

    const nodeContext = resolveKnowledgeContext(result.contextIndex, nodeSelection);
    const fileContext = resolveKnowledgeContext(result.contextIndex, fileSelection);

    expect(nodeContext.matchKind).toBe("direct-trace");
    expect(nodeContext.title).toBe("Product Line Recognition");
    expect(nodeContext.evidence.map((anchor) => anchor.label)).toContain(
      "Recognise implementation - productline/service.go L10-20",
    );
    expect(fileContext.matchKind).toBe("filename-path");
    expect(fileContext.title).toBe("Product Line Recognition");
  });

  it("falls back safely when wiki-index.json is malformed", async () => {
    const fetcher = async (url: string) => {
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
    expect(result.contextIndex.traceCount).toBe(2);
  });

  it("falls back safely when wiki-index.json contains invalid enum values", async () => {
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
      const fetcher = async (url: string) => {
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
      expect(result.contextIndex.traceCount, field).toBe(2);
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

    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((url) => !url.includes("token="))).toBe(true);
  });

  it("retries knowledge context loading only while no knowledge has loaded", () => {
    expect(shouldRetryKnowledgeContextLoad(buildKnowledgeContextIndex({ traces: [], documents: [] }), 0, 3)).toBe(true);
    expect(shouldRetryKnowledgeContextLoad(buildKnowledgeContextIndex({ traces: [], documents: [] }), 3, 3)).toBe(false);
    expect(
      shouldRetryKnowledgeContextLoad(
        buildKnowledgeContextIndex({
          traces: [
            {
              nodeId: "function:productline/service.go:Recognise",
              title: "Trace",
              summary: "Loaded trace.",
            },
          ],
          documents: [],
        }),
        0,
        3,
      ),
    ).toBe(false);
    expect(
      shouldRetryKnowledgeContextLoad(
        buildKnowledgeContextIndex({
          traces: [],
          documents: [
            {
              id: "doc-productline",
              title: "ProductLine",
              summary: "Loaded doc.",
            },
          ],
        }),
        0,
        3,
      ),
    ).toBe(false);
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
