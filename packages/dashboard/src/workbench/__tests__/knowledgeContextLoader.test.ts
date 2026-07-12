import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadDashboardKnowledge,
  shouldRetryWikiLoad,
  type DashboardKnowledge,
} from "../knowledgeContextLoader";
import { wikiV2Fixture } from "../../wiki/__tests__/fixtures/wikiV2Fixtures";

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function v1WikiPayload(): Record<string, unknown> {
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
  it("contains only the V2 Wiki loader and retry contract", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../knowledgeContextLoader.ts"),
      "utf8",
    );
    expect(source).not.toContain('from "./knowledgeContext"');
    expect(source).not.toContain("loadKnowledgeContextIndex");
    expect(source).not.toContain("shouldRetryKnowledgeContextLoad");
    expect(source).toContain("parseWikiIndexV2");
    expect(source).not.toMatch(/\bparseWikiIndex\(/);
    expect(source).toContain("loadDashboardKnowledge");
    expect(source).toContain("shouldRetryWikiLoad");
  });

  it("rejects a V1 wiki-index instead of adapting it into the active runtime", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string) => {
      calls.push(url);
      if (url.includes("knowledge-base/wiki-index.json")) {
        return jsonResponse(v1WikiPayload());
      }
      return new Response("missing", { status: 404 });
    };

    const result: DashboardKnowledge = await loadDashboardKnowledge("local-token", fetcher as typeof fetch);

    expect(calls[0]).toContain("knowledge-base/wiki-index.json");
    expect(calls[0]).toContain("token=local-token");
    expect(calls.some((url) => url.includes("document-traces.json"))).toBe(false);
    expect(result.wikiIndex.pageCount).toBe(0);
    expect(result.wikiStatus).toBe("invalid");
    expect(result.sourceVersion).toBeNull();
    expect(result).not.toHaveProperty("contextIndex");
    expect(calls).toHaveLength(1);
  });

  it("keeps wiki-index node and evidence linkage in the wiki index without building workbench context", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string) => {
      calls.push(url);
      if (url.includes("knowledge-base/wiki-index.json")) {
        return jsonResponse(wikiV2Fixture());
      }
      return new Response("missing", { status: 404 });
    };

    const result = await loadDashboardKnowledge("local-token", fetcher as typeof fetch);

    expect(calls).toHaveLength(1);
    expect(result).not.toHaveProperty("contextIndex");
    expect(
      result.wikiIndex.directPagesByNodeId.get(
        "function:src/a.ts:run",
      )?.[0]?.id,
    ).toBe("page:run");
    expect(result.wikiIndex.evidenceById.get("evidence:run")?.filePath).toBe(
      "src/a.ts",
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

  it("returns invalid without fallback requests when V2 enum values are invalid", async () => {
    const validPayload = wikiV2Fixture();
    const [validPage] = validPayload.pages;
    if (!validPage) throw new Error("missing V2 page fixture");
    const invalidPayloads = [
      { field: "category", payload: { ...validPayload, pages: [{ ...validPage, category: "unknown-category" }] } },
      { field: "role", payload: { ...validPayload, pages: [{ ...validPage, role: "unknown-role" }] } },
      { field: "quality", payload: { ...validPayload, pages: [{ ...validPage, quality: "unreviewed" }] } },
      { field: "generationStatus", payload: { ...validPayload, pages: [{ ...validPage, generationStatus: "unknown-status" }] } },
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

});
