import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "../../types.js";
import {
  buildFileDocPlan,
  buildKnowledgeBaseProfile,
} from "../index.js";

function fullGraph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    kind: "codebase",
    project: {
      name: "feed-service",
      languages: ["typescript"],
      frameworks: ["express"],
      description: "Generates personalized feed responses",
      analyzedAt: "2026-06-26T00:00:00Z",
      gitCommitHash: "abc123",
    },
    nodes: [
      { id: "file:src/api/routes.ts", type: "file", name: "routes.ts", filePath: "src/api/routes.ts", summary: "Feed HTTP routes", tags: ["api", "entry"], complexity: "moderate" },
      { id: "function:src/api/routes.ts:HandleFeedRequest", type: "function", name: "HandleFeedRequest", filePath: "src/api/routes.ts", lineRange: [10, 24], summary: "Receives feed requests and calls the feed service", tags: ["handler", "entry", "feed"], complexity: "moderate" },
      { id: "file:src/service/feed.ts", type: "file", name: "feed.ts", filePath: "src/service/feed.ts", summary: "Feed business logic", tags: ["service", "business", "feed"], complexity: "complex" },
      { id: "function:src/service/feed.ts:BuildFeed", type: "function", name: "BuildFeed", filePath: "src/service/feed.ts", lineRange: [30, 90], summary: "Builds feed by loading candidates and ranking them", tags: ["business", "feed", "ranking"], complexity: "complex" },
      { id: "function:src/service/feed.ts:rankCandidates", type: "function", name: "rankCandidates", filePath: "src/service/feed.ts", lineRange: [92, 120], summary: "Ranks candidates with a local score", tags: ["helper"], complexity: "simple" },
      { id: "class:src/service/feed.ts:FeedBuilder", type: "class", name: "FeedBuilder", filePath: "src/service/feed.ts", lineRange: [122, 180], summary: "Coordinates feed construction steps", tags: ["business", "feed"], complexity: "moderate" },
      { id: "file:src/data/store.ts", type: "file", name: "store.ts", filePath: "src/data/store.ts", summary: "Candidate data access", tags: ["data"], complexity: "moderate" },
      { id: "class:src/data/store.ts:CandidateStore", type: "class", name: "CandidateStore", filePath: "src/data/store.ts", lineRange: [5, 60], summary: "Loads feed candidates", tags: ["data", "store"], complexity: "moderate" },
      { id: "function:src/data/store.ts:LoadCandidates", type: "function", name: "LoadCandidates", filePath: "src/data/store.ts", lineRange: [62, 78], summary: "Loads candidate rows", tags: ["data"], complexity: "moderate" },
      { id: "file:src/unused/missing.ts", type: "file", name: "missing.ts", filePath: "src/unused/missing.ts", summary: "Graph references a deleted file", tags: ["stale"], complexity: "simple" },
      { id: "function:src/unused/missing.ts:DeletedHelper", type: "function", name: "DeletedHelper", filePath: "src/unused/missing.ts", lineRange: [1, 4], summary: "Deleted helper still present in graph", tags: ["stale"], complexity: "simple" },
    ],
    edges: [
      { source: "file:src/api/routes.ts", target: "function:src/api/routes.ts:HandleFeedRequest", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/service/feed.ts", target: "function:src/service/feed.ts:BuildFeed", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/service/feed.ts", target: "function:src/service/feed.ts:rankCandidates", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/service/feed.ts", target: "class:src/service/feed.ts:FeedBuilder", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/data/store.ts", target: "class:src/data/store.ts:CandidateStore", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/data/store.ts", target: "function:src/data/store.ts:LoadCandidates", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/unused/missing.ts", target: "function:src/unused/missing.ts:DeletedHelper", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/api/routes.ts", target: "file:src/service/feed.ts", type: "imports", direction: "forward", weight: 0.8 },
      { source: "file:src/service/feed.ts", target: "file:src/data/store.ts", type: "imports", direction: "forward", weight: 0.8 },
      { source: "function:src/api/routes.ts:HandleFeedRequest", target: "function:src/service/feed.ts:BuildFeed", type: "calls", direction: "forward", weight: 0.9 },
      { source: "function:src/service/feed.ts:BuildFeed", target: "function:src/data/store.ts:LoadCandidates", type: "calls", direction: "forward", weight: 0.9 },
      { source: "function:src/service/feed.ts:BuildFeed", target: "function:src/service/feed.ts:rankCandidates", type: "calls", direction: "forward", weight: 0.7 },
    ],
    layers: [
      { id: "layer:api", name: "API Layer", description: "HTTP entry points", nodeIds: ["file:src/api/routes.ts", "function:src/api/routes.ts:HandleFeedRequest"] },
      { id: "layer:service", name: "Service Layer", description: "Feed business logic", nodeIds: ["file:src/service/feed.ts", "function:src/service/feed.ts:BuildFeed", "function:src/service/feed.ts:rankCandidates", "class:src/service/feed.ts:FeedBuilder"] },
      { id: "layer:data", name: "Data Layer", description: "Data access", nodeIds: ["file:src/data/store.ts", "class:src/data/store.ts:CandidateStore", "function:src/data/store.ts:LoadCandidates"] },
    ],
    tour: [],
  };
}

function stringArrayFrom(value: unknown, key: string): string[] {
  const record = value as Record<string, unknown>;
  const ids = record[key];
  return Array.isArray(ids) ? [...(ids as string[])].sort() : [];
}

describe("file document planning", () => {
  it("creates exactly one file-doc task per graph file node", () => {
    const profile = buildKnowledgeBaseProfile(fullGraph());
    const plan = buildFileDocPlan(profile, {
      projectRoot: "/repo",
      sourceFiles: {
        "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
        "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
        "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
      },
    });

    expect(plan.tasks.map((task) => task.fileNodeId).sort()).toEqual([
      "file:src/api/routes.ts",
      "file:src/data/store.ts",
      "file:src/service/feed.ts",
      "file:src/unused/missing.ts",
    ]);
    expect(plan.tasks).toHaveLength(4);
    expect(plan.tasks.map((task) => task.documentPath).sort()).toEqual([
      "文件文档/src-api-routes.ts.md",
      "文件文档/src-data-store.ts.md",
      "文件文档/src-service-feed.ts.md",
      "文件文档/src-unused-missing.ts.md",
    ]);
    expect(new Set(plan.tasks.map((task) => task.documentPath)).size).toBe(4);

    const serviceTask = plan.tasks.find((task) => task.filePath === "src/service/feed.ts");
    expect(serviceTask).toBeDefined();
    expect(stringArrayFrom(serviceTask, "functionNodeIds")).toEqual([
      "function:src/service/feed.ts:BuildFeed",
      "function:src/service/feed.ts:rankCandidates",
    ]);
    expect(stringArrayFrom(serviceTask, "classNodeIds")).toEqual(["class:src/service/feed.ts:FeedBuilder"]);
    expect(stringArrayFrom(serviceTask, "incomingEdgeIds")).toEqual([
      "imports:file:src/api/routes.ts->file:src/service/feed.ts",
    ]);
    expect(stringArrayFrom(serviceTask, "outgoingEdgeIds")).toEqual([
      "contains:file:src/service/feed.ts->class:src/service/feed.ts:FeedBuilder",
      "contains:file:src/service/feed.ts->function:src/service/feed.ts:BuildFeed",
      "contains:file:src/service/feed.ts->function:src/service/feed.ts:rankCandidates",
      "imports:file:src/service/feed.ts->file:src/data/store.ts",
    ]);
    expect(stringArrayFrom(serviceTask, "neighborNodeIds")).toEqual(expect.arrayContaining([
      "file:src/api/routes.ts",
      "file:src/data/store.ts",
      "function:src/api/routes.ts:HandleFeedRequest",
      "function:src/data/store.ts:LoadCandidates",
      "function:src/service/feed.ts:rankCandidates",
    ]));
    expect(serviceTask?.sourceReadMode).toBe("full");
    expect(serviceTask?.sourceSnapshot?.exists).toBe(true);

    const dataTask = plan.tasks.find((task) => task.filePath === "src/data/store.ts");
    expect(dataTask).toBeDefined();
    expect(stringArrayFrom(dataTask, "classNodeIds")).toEqual(["class:src/data/store.ts:CandidateStore"]);
    expect(stringArrayFrom(dataTask, "functionNodeIds")).toEqual(["function:src/data/store.ts:LoadCandidates"]);
    expect(dataTask?.sourceReadMode).toBe("full");
    expect(dataTask?.sourceSnapshot?.exists).toBe(true);
    expect(stringArrayFrom(dataTask, "incomingEdgeIds")).toEqual([
      "imports:file:src/service/feed.ts->file:src/data/store.ts",
    ]);
    expect(stringArrayFrom(dataTask, "neighborNodeIds")).toEqual(expect.arrayContaining([
      "file:src/service/feed.ts",
      "function:src/service/feed.ts:BuildFeed",
    ]));

    const missingTask = plan.tasks.find((task) => task.filePath === "src/unused/missing.ts");
    expect(missingTask).toBeDefined();
    expect(missingTask?.sourceReadMode).toBe("missing");
    expect(missingTask?.sourceSnapshot?.exists).toBe(false);
    expect(stringArrayFrom(missingTask, "functionNodeIds")).toEqual(["function:src/unused/missing.ts:DeletedHelper"]);
  });

  it("does not cap file batches for larger graphs", () => {
    const graph = fullGraph();
    for (let index = 0; index < 60; index += 1) {
      const filePath = `src/generated/file-${index}.ts`;
      graph.nodes.push({
        id: `file:${filePath}`,
        type: "file",
        name: `file-${index}.ts`,
        filePath,
        summary: `Generated file ${index}`,
        tags: ["generated"],
        complexity: "simple",
      });
    }
    const plan = buildFileDocPlan(buildKnowledgeBaseProfile(graph), { projectRoot: "/repo", sourceFiles: {} });
    expect(plan.tasks.filter((task) => task.filePath.startsWith("src/generated/"))).toHaveLength(60);
    expect(plan.tasks).toHaveLength(64);
  });

  it("uses one-based batch indexes for batch artifacts and task membership", () => {
    const plan = buildFileDocPlan(buildKnowledgeBaseProfile(fullGraph()), {
      projectRoot: "/repo",
      sourceFiles: {
        "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
        "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
        "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
      },
    });

    for (const [index, batch] of plan.batches.entries()) {
      expect(batch.batchIndex).toBe(index + 1);
      expect(batch.tasks.every((task) => task.batchIndex === batch.batchIndex)).toBe(true);
    }

    const artifactNames = plan.batches.map((batch) => `file-doc-batch-${batch.batchIndex}.json`);
    expect(artifactNames).toEqual(plan.batches.map((_, index) => `file-doc-batch-${index + 1}.json`));
    expect(artifactNames[0]).toBe("file-doc-batch-1.json");
    expect(artifactNames).not.toContain("file-doc-batch-0.json");
  });
});
