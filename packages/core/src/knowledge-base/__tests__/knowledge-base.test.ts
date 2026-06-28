import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "../../types.js";
import {
  buildDocumentPlan,
  buildKnowledgeBaseProfile,
  generateKnowledgeBase,
} from "../index.js";

function sampleGraph(extraEntry = false): KnowledgeGraph {
  const nodes: KnowledgeGraph["nodes"] = [
    {
      id: "file:src/api/routes.ts",
      type: "file",
      name: "routes.ts",
      filePath: "src/api/routes.ts",
      summary: "HTTP entry routes for feed requests",
      tags: ["api", "entry"],
      complexity: "moderate",
    },
    {
      id: "function:src/api/routes.ts:HandleFeedRequest",
      type: "function",
      name: "HandleFeedRequest",
      filePath: "src/api/routes.ts",
      lineRange: [10, 24],
      summary: "Entry handler that receives feed requests and calls the feed service",
      tags: ["handler", "entry", "feed"],
      complexity: "moderate",
    },
    {
      id: "file:src/service/feed.ts",
      type: "file",
      name: "feed.ts",
      filePath: "src/service/feed.ts",
      summary: "Business logic for building personalized feed results",
      tags: ["service", "business", "feed"],
      complexity: "complex",
    },
    {
      id: "function:src/service/feed.ts:BuildFeed",
      type: "function",
      name: "BuildFeed",
      filePath: "src/service/feed.ts",
      lineRange: [30, 90],
      summary: "Builds the personalized feed by loading candidates, applying ranking, and reading runtime config",
      tags: ["business", "feed", "ranking"],
      complexity: "complex",
    },
    {
      id: "function:src/service/feed.ts:rankCandidates",
      type: "function",
      name: "rankCandidates",
      filePath: "src/service/feed.ts",
      lineRange: [92, 120],
      summary: "Ranks feed candidates with a lightweight scoring helper",
      tags: ["helper"],
      complexity: "simple",
    },
    {
      id: "file:src/data/store.ts",
      type: "file",
      name: "store.ts",
      filePath: "src/data/store.ts",
      summary: "Data access for candidate loading",
      tags: ["data", "store"],
      complexity: "moderate",
    },
    {
      id: "class:src/data/store.ts:CandidateStore",
      type: "class",
      name: "CandidateStore",
      filePath: "src/data/store.ts",
      lineRange: [5, 60],
      summary: "Loads feed candidates from persistent storage",
      tags: ["data", "store"],
      complexity: "moderate",
    },
    {
      id: "function:src/data/store.ts:LoadCandidates",
      type: "function",
      name: "LoadCandidates",
      filePath: "src/data/store.ts",
      lineRange: [62, 78],
      summary: "Loads candidate items for a feed request",
      tags: ["data"],
      complexity: "moderate",
    },
    {
      id: "config:config/feed.yaml",
      type: "config",
      name: "feed.yaml",
      filePath: "config/feed.yaml",
      summary: "Runtime configuration for feed ranking behavior",
      tags: ["config", "feed"],
      complexity: "simple",
    },
  ];

  const edges: KnowledgeGraph["edges"] = [
    {
      source: "file:src/api/routes.ts",
      target: "function:src/api/routes.ts:HandleFeedRequest",
      type: "contains",
      direction: "forward",
      weight: 1,
    },
    {
      source: "file:src/service/feed.ts",
      target: "function:src/service/feed.ts:BuildFeed",
      type: "contains",
      direction: "forward",
      weight: 1,
    },
    {
      source: "file:src/service/feed.ts",
      target: "function:src/service/feed.ts:rankCandidates",
      type: "contains",
      direction: "forward",
      weight: 1,
    },
    {
      source: "file:src/data/store.ts",
      target: "class:src/data/store.ts:CandidateStore",
      type: "contains",
      direction: "forward",
      weight: 1,
    },
    {
      source: "file:src/data/store.ts",
      target: "function:src/data/store.ts:LoadCandidates",
      type: "contains",
      direction: "forward",
      weight: 1,
    },
    {
      source: "file:src/api/routes.ts",
      target: "file:src/service/feed.ts",
      type: "imports",
      direction: "forward",
      weight: 0.8,
    },
    {
      source: "function:src/api/routes.ts:HandleFeedRequest",
      target: "function:src/service/feed.ts:BuildFeed",
      type: "calls",
      direction: "forward",
      weight: 0.9,
    },
    {
      source: "function:src/service/feed.ts:BuildFeed",
      target: "function:src/data/store.ts:LoadCandidates",
      type: "calls",
      direction: "forward",
      weight: 0.9,
    },
    {
      source: "function:src/service/feed.ts:BuildFeed",
      target: "function:src/service/feed.ts:rankCandidates",
      type: "calls",
      direction: "forward",
      weight: 0.7,
    },
    {
      source: "function:src/service/feed.ts:BuildFeed",
      target: "config:config/feed.yaml",
      type: "configures",
      direction: "forward",
      weight: 0.6,
    },
  ];

  const apiNodeIds = [
    "file:src/api/routes.ts",
    "function:src/api/routes.ts:HandleFeedRequest",
  ];

  if (extraEntry) {
    nodes.push({
      id: "function:src/api/routes.ts:HandleAdminFeedRequest",
      type: "function",
      name: "HandleAdminFeedRequest",
      filePath: "src/api/routes.ts",
      lineRange: [126, 150],
      summary: "Entry handler that builds an admin feed preview",
      tags: ["handler", "entry", "feed"],
      complexity: "moderate",
    });
    edges.push(
      {
        source: "file:src/api/routes.ts",
        target: "function:src/api/routes.ts:HandleAdminFeedRequest",
        type: "contains",
        direction: "forward",
        weight: 1,
      },
      {
        source: "function:src/api/routes.ts:HandleAdminFeedRequest",
        target: "function:src/service/feed.ts:BuildFeed",
        type: "calls",
        direction: "forward",
        weight: 0.9,
      },
    );
    apiNodeIds.push("function:src/api/routes.ts:HandleAdminFeedRequest");
  }

  return {
    version: "1.0.0",
    kind: "codebase",
    project: {
      name: "feed-service",
      languages: ["typescript"],
      frameworks: ["express"],
      description: "Builds personalized feed responses",
      analyzedAt: "2026-06-26T00:00:00Z",
      gitCommitHash: "abc123",
    },
    nodes,
    edges,
    layers: [
      {
        id: "layer:api",
        name: "API Layer",
        description: "HTTP request entry points",
        nodeIds: apiNodeIds,
      },
      {
        id: "layer:service",
        name: "Service Layer",
        description: "Feed business logic",
        nodeIds: [
          "file:src/service/feed.ts",
          "function:src/service/feed.ts:BuildFeed",
          "function:src/service/feed.ts:rankCandidates",
        ],
      },
      {
        id: "layer:data",
        name: "Data Layer",
        description: "Candidate data access",
        nodeIds: [
          "file:src/data/store.ts",
          "class:src/data/store.ts:CandidateStore",
          "function:src/data/store.ts:LoadCandidates",
        ],
      },
    ],
    tour: [],
  };
}

describe("graph-to-knowledge-base", () => {
  it("builds a project profile from graph facts", () => {
    const profile = buildKnowledgeBaseProfile(sampleGraph());

    expect(profile.nodeCounts.file).toBe(3);
    expect(profile.nodeCounts.function).toBe(4);
    expect(profile.nodeCounts.class).toBe(1);
    expect(profile.edgeCounts.calls).toBe(3);
    expect(profile.layerProfiles).toHaveLength(3);
    expect(profile.entryCandidates.map((entry) => entry.nodeId)).toContain(
      "function:src/api/routes.ts:HandleFeedRequest",
    );
    expect(profile.indexes.functionToFileId.get("function:src/service/feed.ts:BuildFeed")).toBe(
      "file:src/service/feed.ts",
    );
  });

  it("plans topic documents from coverage obligations instead of a fixed count", () => {
    const basePlan = buildDocumentPlan(buildKnowledgeBaseProfile(sampleGraph()));
    const expandedPlan = buildDocumentPlan(buildKnowledgeBaseProfile(sampleGraph(true)));

    const baseTopicCount = basePlan.documents.filter((doc) => doc.category === "topic").length;
    const expandedTopicCount = expandedPlan.documents.filter((doc) => doc.category === "topic").length;

    expect(basePlan.topicCandidates.map((candidate) => candidate.nodeId)).toContain(
      "function:src/api/routes.ts:HandleFeedRequest",
    );
    expect(expandedPlan.topicCandidates.map((candidate) => candidate.nodeId)).toContain(
      "function:src/api/routes.ts:HandleAdminFeedRequest",
    );
    expect(expandedTopicCount).toBeGreaterThan(baseTopicCount);
  });

  it("generates complete file documents and cards for every graph file/function/class", () => {
    const graph = sampleGraph();
    const kb = generateKnowledgeBase(graph, {
      sourceFiles: {
        "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
        "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
        "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
      },
    });

    expect(kb.coverageReport.fileDocumentCoverage.covered).toBe(kb.coverageReport.fileDocumentCoverage.total);
    expect(kb.coverageReport.functionCardCoverage.covered).toBe(kb.coverageReport.functionCardCoverage.total);
    expect(kb.coverageReport.classCardCoverage.covered).toBe(kb.coverageReport.classCardCoverage.total);

    for (const node of graph.nodes.filter((item) => item.type === "file")) {
      const doc = kb.documents.find((item) => item.path.startsWith("文件文档/") && item.coveredNodeIds.includes(node.id));
      expect(doc?.content).toContain(`# ${node.filePath} 文件知识文档`);
    }
    for (const node of graph.nodes.filter((item) => item.type === "function")) {
      const parentDoc = kb.documents.find((item) => item.path.startsWith("文件文档/") && item.coveredNodeIds.includes(node.id));
      expect(parentDoc?.content).toContain("## 函数卡片");
      expect(parentDoc?.content).toContain(`### ${node.name}`);
      expect(parentDoc?.content).toContain(`节点 ID: \`${node.id}\``);
      if (node.lineRange) {
        expect(parentDoc?.content).toContain(node.lineRange.join("-"));
      }
    }
    for (const node of graph.nodes.filter((item) => item.type === "class")) {
      const parentDoc = kb.documents.find((item) => item.path.startsWith("文件文档/") && item.coveredNodeIds.includes(node.id));
      expect(parentDoc?.content).toContain("## 类卡片");
      expect(parentDoc?.content).toContain(`### ${node.name}`);
      expect(parentDoc?.content).toContain(`节点 ID: \`${node.id}\``);
      if (node.lineRange) {
        expect(parentDoc?.content).toContain(node.lineRange.join("-"));
      }
    }
  });

  it("reports actual document counts and coverage status", () => {
    const kb = generateKnowledgeBase(sampleGraph(), {
      sourceFiles: {
        "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
        "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
        "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
      },
    });
    const report = kb.documents.find((item) => item.path === "覆盖报告.md");

    expect(report).toBeDefined();
    expect(kb.coverageReport.totalDocuments).toBe(kb.documents.length);
    expect(kb.coverageReport.fileDocumentCoverage).toEqual({ covered: 3, total: 3, missing: [] });
    expect(kb.coverageReport.functionCardCoverage).toEqual({ covered: 4, total: 4, missing: [] });
    expect(kb.coverageReport.classCardCoverage).toEqual({ covered: 1, total: 1, missing: [] });

    expect(report?.content).toContain(`总文档数: ${kb.documents.length}`);
    expect(report?.content).toContain("File document coverage: 3 / 3");
    expect(report?.content).toContain("Function card coverage: 4 / 4");
    expect(report?.content).toContain("Class card coverage: 1 / 1");

    expect(report?.content).not.toContain("File index coverage:");
    expect(report?.content).not.toContain("Function index coverage:");
    expect(report?.content).not.toContain("Class index coverage:");
    expect(report?.content).toContain("Coverage status: complete");
  });

  it("reports actual relationship coverage from generated file documents", () => {
    const kb = generateKnowledgeBase(sampleGraph(), {
      sourceFiles: {
        "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
        "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
        "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
      },
    });

    expect(kb.coverageReport.relationshipCoverage).toEqual([
      { edgeType: "calls", covered: 3, total: 3, missingEdgeIds: [] },
      { edgeType: "imports", covered: 1, total: 1, missingEdgeIds: [] },
      { edgeType: "contains", covered: 5, total: 5, missingEdgeIds: [] },
    ]);
  });

  it("keeps missing source files incomplete instead of hiding them in indexes", () => {
    const graph = sampleGraph();
    graph.nodes.push({
      id: "file:src/missing.ts",
      type: "file",
      name: "missing.ts",
      filePath: "src/missing.ts",
      summary: "Missing source file",
      tags: ["stale"],
      complexity: "simple",
    });

    const kb = generateKnowledgeBase(graph, { sourceFiles: {} });

    expect(kb.coverageReport.status).toBe("incomplete");
    expect(kb.coverageReport.sourceReadCoverage.missing).toContain("file:src/missing.ts");
    expect(kb.retryPlan.fileBatchIndexes.length).toBeGreaterThan(0);
  });
});
