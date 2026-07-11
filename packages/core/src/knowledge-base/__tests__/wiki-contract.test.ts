import { describe, expect, it } from "vitest";
import {
  contextPagesForNode,
  directPagesForNode,
  evidenceForNode,
  parseWikiIndexV2,
  primaryDestinationForNode,
  type WikiIndexV2,
} from "../wiki-contract.js";

function validIndex(): WikiIndexV2 {
  return {
    version: 2,
    generatedAt: "2026-07-11T00:00:00.000Z",
    projectName: "demo",
    source: {
      outputLanguage: "zh-CN",
      generationMode: "writer",
      graphDigest: "abc",
      sourceRootIdentity: "/workspace/demo",
    },
    mainReadiness: { status: "ready", reasons: [], routePageIds: ["page:overview"] },
    referenceCoverage: {
      status: "complete",
      files: { covered: 1, total: 1, missingIds: [] },
      functions: { covered: 1, total: 1, missingIds: [] },
      types: { covered: 0, total: 0, missingIds: [] },
    },
    pages: [{
      id: "page:overview",
      title: "项目总览",
      summary: "解释项目目标、运行流程和源码入口。",
      markdownPath: "knowledge-base/项目总览.md",
      role: "featured",
      category: "overview",
      quality: "generated",
      generationStatus: "complete",
      directNodeIds: ["function:src/a.ts:run"],
      contextNodeIds: ["file:src/a.ts"],
      evidenceIds: ["evidence:run"],
      searchTerms: ["运行入口"],
      route: { order: 0, stage: "purpose" },
    }],
    nodeDocumentation: [{
      nodeId: "function:src/a.ts:run",
      relation: "direct",
      quality: "generated",
      evidenceHealth: "source-linked",
      generationStatus: "complete",
      referenceCoverage: "anchored",
      directPageIds: ["page:overview"],
      contextPageIds: [],
      evidenceIds: ["evidence:run"],
      primaryPageId: "page:overview",
      anchor: "run",
    }, {
      nodeId: "file:src/a.ts",
      relation: "context",
      quality: "needs-review",
      evidenceHealth: "missing",
      generationStatus: "partial",
      referenceCoverage: "unanchored",
      directPageIds: [],
      contextPageIds: ["page:overview"],
      evidenceIds: [],
    }],
    evidence: [{
      id: "evidence:run",
      nodeIds: ["function:src/a.ts:run"],
      filePath: "src/a.ts",
      lineRange: [1, 3],
      excerpt: "export function run() {}",
      evidenceType: "production",
    }],
  };
}

describe("Wiki V2 contract", () => {
  it("accepts a consistent index and keeps direct, context, and evidence separate", () => {
    const parsed = parseWikiIndexV2(validIndex());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
    expect(directPagesForNode(parsed.value, "function:src/a.ts:run").map((page) => page.id)).toEqual(["page:overview"]);
    expect(contextPagesForNode(parsed.value, "file:src/a.ts").map((page) => page.id)).toEqual(["page:overview"]);
    expect(primaryDestinationForNode(parsed.value, "function:src/a.ts:run")).toEqual({ pageId: "page:overview", anchor: "run" });
    expect(evidenceForNode(parsed.value, "function:src/a.ts:run").map((item) => item.id)).toEqual(["evidence:run"]);
  });

  it("rejects overlapping page links, fake verification, invalid ranges, and misattributed evidence", () => {
    const payload = validIndex();
    payload.pages[0] = {
      ...payload.pages[0],
      quality: "verified",
      contextNodeIds: ["function:src/a.ts:run"],
    };
    payload.evidence[0] = { ...payload.evidence[0], nodeIds: ["file:src/a.ts"], lineRange: [3, 1] };
    const parsed = parseWikiIndexV2(payload);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error("expected invalid payload");
    expect(parsed.errors.join("\n")).toContain("directNodeIds and contextNodeIds overlap");
    expect(parsed.errors.join("\n")).toContain("verified page requires verification");
    expect(parsed.errors.join("\n")).toContain("lineRange end must be greater than or equal to start");
    expect(parsed.errors.join("\n")).toContain("evidence does not contain node");
  });

  it("rejects duplicate ids, missing route pages, and a primary page that is not direct", () => {
    const payload = validIndex();
    payload.pages.push({ ...payload.pages[0] });
    payload.mainReadiness.routePageIds = ["page:missing"];
    payload.nodeDocumentation[0].primaryPageId = "page:missing";
    const parsed = parseWikiIndexV2(payload);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error("expected invalid payload");
    expect(parsed.errors.join("\n")).toContain("duplicate page id");
    expect(parsed.errors.join("\n")).toContain("missing route page");
    expect(parsed.errors.join("\n")).toContain("primaryPageId must reference a direct page");
  });

  it("reports structural contract errors in Simplified Chinese", () => {
    const payload = validIndex();
    const parsed = parseWikiIndexV2({
      ...payload,
      source: { ...payload.source, outputLanguage: 42 },
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error("expected invalid payload");
    expect(parsed.errors.join("\n")).toContain("字段类型不正确");
  });
});
