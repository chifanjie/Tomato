import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "../../types.js";
import { buildKnowledgeBaseProfile } from "../profile.js";
import { buildFeaturedPlan, pageId } from "../featured-planner.js";
import { KB_PATHS } from "../paths.js";
import type { BusinessCapabilityProfile, FileDocPlan, TopicPlan } from "../types.js";

const graph: KnowledgeGraph = {
  version: "1.0.0",
  project: { name: "demo", languages: ["typescript"], frameworks: [], description: "演示服务", analyzedAt: "2026-07-11T00:00:00.000Z", gitCommitHash: "abc" },
  nodes: [
    { id: "file:src/a.ts", type: "file", name: "a.ts", filePath: "src/a.ts", summary: "请求入口文件", tags: ["entry"], complexity: "moderate" },
    { id: "function:src/a.ts:run", type: "function", name: "run", filePath: "src/a.ts", lineRange: [1, 5], summary: "接收请求并调用策略", tags: ["entry"], complexity: "complex" },
    { id: "function:src/a.ts:helper", type: "function", name: "helper", filePath: "src/a.ts", lineRange: [7, 9], summary: "格式化辅助函数", tags: ["helper"], complexity: "simple" },
    { id: "function:src/a.ts:isolated", type: "function", name: "孤立入口", filePath: "src/a.ts", lineRange: [11, 13], summary: "没有下游行为关系", tags: ["entry"], complexity: "moderate" },
    { id: "file:src/service.ts", type: "file", name: "service.ts", filePath: "src/service.ts", summary: "策略服务", tags: ["service"], complexity: "moderate" },
    { id: "function:src/service.ts:apply", type: "function", name: "apply", filePath: "src/service.ts", lineRange: [1, 8], summary: "应用策略并读取配置", tags: ["strategy"], complexity: "complex" },
    { id: "config:config/rule.json", type: "config", name: "rule.json", filePath: "config/rule.json", lineRange: [1, 4], summary: "策略配置", tags: ["config"], complexity: "simple" },
  ],
  edges: [
    { source: "file:src/a.ts", target: "function:src/a.ts:run", type: "contains", direction: "forward", weight: 1 },
    { source: "file:src/a.ts", target: "function:src/a.ts:helper", type: "contains", direction: "forward", weight: 1 },
    { source: "file:src/a.ts", target: "function:src/a.ts:isolated", type: "contains", direction: "forward", weight: 1 },
    { source: "file:src/service.ts", target: "function:src/service.ts:apply", type: "contains", direction: "forward", weight: 1 },
    { source: "function:src/a.ts:run", target: "function:src/service.ts:apply", type: "calls", direction: "forward", weight: 1 },
    { source: "function:src/service.ts:apply", target: "config:config/rule.json", type: "reads_from", direction: "forward", weight: 1 },
  ],
  layers: [{ id: "layer:api", name: "入口层", description: "请求入口", nodeIds: ["file:src/a.ts"] }, { id: "layer:service", name: "服务层", description: "策略实现", nodeIds: ["file:src/service.ts"] }],
  tour: [],
};

const businessProfile: BusinessCapabilityProfile = { facts: [], capabilities: [], totalFacts: 0, sourceBackedFacts: 0 };
const fileDocPlan: FileDocPlan = {
  tasks: [{
    batchIndex: 1, taskIndex: 0, fileNodeId: "file:src/a.ts", filePath: "src/a.ts", layerId: "layer:api",
    documentPath: "文件文档/src-a.ts.md", sourceNodeIds: ["file:src/a.ts"], referenceKind: "code",
    functionNodeIds: ["function:src/a.ts:run", "function:src/a.ts:helper", "function:src/a.ts:isolated"],
    classNodeIds: [], incomingEdgeIds: [], outgoingEdgeIds: [], neighborNodeIds: [],
    sourceSnapshot: { filePath: "src/a.ts", exists: true, text: "export function run() {}\nexport function helper() {}\nexport function isolated() {}", totalLines: 3, nonEmptyLines: 3 },
    sourceReadMode: "full", batchingReason: "test",
  }, {
    batchIndex: 2, taskIndex: 1, fileNodeId: "file:src/service.ts", filePath: "src/service.ts", layerId: "layer:service",
    documentPath: "文件文档/src-service.ts.md", sourceNodeIds: ["file:src/service.ts"], referenceKind: "code",
    functionNodeIds: ["function:src/service.ts:apply"], classNodeIds: [],
    incomingEdgeIds: [], outgoingEdgeIds: [], neighborNodeIds: [],
    sourceSnapshot: { filePath: "src/service.ts", exists: true, text: "export function apply() {}", totalLines: 1, nonEmptyLines: 1 },
    sourceReadMode: "full", batchingReason: "test",
  }],
  batches: [], warnings: [],
};
const topicPlan: TopicPlan = { topics: [], batches: [], warnings: [] };

describe("featured planning", () => {
  it("omits pseudo-flows, keeps helpers in file anchors, and avoids module bulk direct coverage", () => {
    const plan = buildFeaturedPlan({
      profile: buildKnowledgeBaseProfile(graph), businessProfile, fileDocPlan, topicPlan,
      config: { entryNodeIds: ["function:src/a.ts:run", "function:src/a.ts:isolated"] },
    });
    expect(plan.documents.find((doc) => doc.title.includes("孤立入口") && doc.category === "flow")).toBeUndefined();
    expect(plan.documents.find((doc) => doc.category === "module")?.directNodeIds).not.toContain("function:src/a.ts:helper");
    expect(plan.documents.find((doc) => doc.path === "文件文档/src-a.ts.md")?.symbolAnchors).toContainEqual({ nodeId: "function:src/a.ts:helper", anchor: "helper" });
    expect(plan.documents.filter((doc) => doc.role === "featured").length).toBeLessThanOrEqual(40);
    expect(plan.warnings).toContain("孤立入口没有至少三个可验证行为阶段，已移入待分析状态");
  });

  it("disambiguates stable page ids when capabilities share a title", () => {
    const shared = {
      title: "重复能力",
      keywords: ["重复"],
      factIds: [],
      relatedNodeIds: ["function:src/a.ts:run"],
      evidence: [{ filePath: "src/a.ts", nodeId: "function:src/a.ts:run" }],
      score: 10,
      evidenceRole: "primary" as const,
      confidence: "high" as const,
      sourceKindCounts: { "production-logic": 1 },
      primaryFactIds: [],
      supportingFactIds: [],
      exampleOnlyFactIds: [],
    };
    const profile: BusinessCapabilityProfile = {
      facts: [],
      capabilities: [
        { id: "capability:first", ...shared },
        { id: "capability:second", ...shared },
      ],
      totalFacts: 0,
      sourceBackedFacts: 0,
    };

    const plan = buildFeaturedPlan({
      profile: buildKnowledgeBaseProfile(graph),
      businessProfile: profile,
      fileDocPlan,
      topicPlan,
      config: { entryNodeIds: ["function:src/a.ts:run"] },
    });
    const capabilityPages = plan.documents.filter((document) => document.category === "capability");

    expect(capabilityPages).toHaveLength(2);
    expect(new Set(capabilityPages.map((document) => document.path)).size).toBe(2);
    expect(new Set(capabilityPages.map((document) => document.id)).size).toBe(2);
  });

  it("keeps status pages in maintenance even when route config pins them", () => {
    const plan = buildFeaturedPlan({
      profile: buildKnowledgeBaseProfile(graph),
      businessProfile,
      fileDocPlan,
      topicPlan,
      config: { route: { pin: [pageId(KB_PATHS.qualityStatus), pageId(KB_PATHS.referenceCoverage)] } },
    });

    const statusPages = plan.documents.filter((document) =>
      document.path === KB_PATHS.qualityStatus || document.path === KB_PATHS.referenceCoverage);
    expect(statusPages).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: KB_PATHS.qualityStatus, role: "maintenance" }),
      expect.objectContaining({ path: KB_PATHS.referenceCoverage, role: "maintenance" }),
    ]));
    expect(statusPages.every((document) => !("route" in document))).toBe(true);
  });

  it("keeps the final featured set capped when route config pins references", () => {
    const tasks = Array.from({ length: 45 }, (_, index) => ({
      ...fileDocPlan.tasks[0],
      taskIndex: index,
      filePath: `references/reference-${index}.ts`,
      documentPath: `文件文档/reference-${index}.md`,
      sourceSnapshot: { ...fileDocPlan.tasks[0].sourceSnapshot, filePath: `references/reference-${index}.ts` },
    }));
    const plan = buildFeaturedPlan({
      profile: buildKnowledgeBaseProfile(graph),
      businessProfile,
      fileDocPlan: { tasks, batches: [], warnings: [] },
      topicPlan,
      config: { route: { pin: tasks.map((task) => pageId(task.documentPath)) } },
    });

    expect(plan.documents.filter((document) => document.role === "featured")).toHaveLength(40);
    expect(plan.documents.filter((document) => document.role === "reference").length).toBeGreaterThan(0);
  });

  it("preserves configured route order after enforcing the featured cap", () => {
    const sourceEntryId = pageId(KB_PATHS.sourceEntry);
    const projectOverviewId = pageId(KB_PATHS.projectOverview);
    const plan = buildFeaturedPlan({
      profile: buildKnowledgeBaseProfile(graph),
      businessProfile,
      fileDocPlan,
      topicPlan,
      config: { route: { order: [sourceEntryId, projectOverviewId] } },
    });

    expect(plan.documents
      .filter((document) => document.role === "featured")
      .map((document) => [document.id, document.route?.order]))
      .toEqual(expect.arrayContaining([
        [sourceEntryId, 0],
        [projectOverviewId, 1],
      ]));
  });
});
