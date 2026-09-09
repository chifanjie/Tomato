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
    expect(plan.documents.filter((doc) => doc.role === "featured").length).toBeLessThanOrEqual(13);
    expect(plan.warnings).toContain("孤立入口没有至少三个可验证行为阶段，已移入待分析状态");
  });

  it.each(["scripts/audit-active-surface.mjs", "scripts\\audit-active-surface.mjs"])(
    "ranks product flows ahead of repository tooling at %s even when tooling has a stronger entry type", (toolPath) => {
    const productFile = { id: "file:src/product.ts", type: "file" as const, name: "product.ts", filePath: "src/product.ts", summary: "产品入口", tags: [], complexity: "moderate" as const };
    const productEntry = { id: "function:src/product.ts:main", type: "function" as const, name: "main", filePath: "src/product.ts", lineRange: [1, 3] as [number, number], summary: "产品主流程", tags: ["entry"], complexity: "complex" as const };
    const productStep = { id: "function:src/product.ts:serve", type: "function" as const, name: "serve", filePath: "src/product.ts", lineRange: [4, 6] as [number, number], summary: "提供产品服务", tags: [], complexity: "moderate" as const };
    const productConfig = { id: "config:config/product.json", type: "config" as const, name: "product.json", filePath: "config/product.json", summary: "产品配置", tags: [], complexity: "simple" as const };
    const toolFile = { id: "file:scripts/audit-active-surface.mjs", type: "file" as const, name: "audit-active-surface.mjs", filePath: toolPath, summary: "构建工具", tags: [], complexity: "moderate" as const };
    const toolEntry = { id: "function:scripts/audit-active-surface.mjs:runCli", type: "function" as const, name: "runCli", filePath: toolPath, lineRange: [1, 3] as [number, number], summary: "CLI 构建入口", tags: ["entry"], complexity: "complex" as const };
    const toolStep = { id: "function:scripts/audit-active-surface.mjs:parse", type: "function" as const, name: "parse", filePath: toolPath, lineRange: [4, 6] as [number, number], summary: "解析构建结果", tags: [], complexity: "moderate" as const };
    const toolConfig = { id: "config:config/audit.json", type: "config" as const, name: "audit.json", filePath: "config/audit.json", summary: "构建配置", tags: [], complexity: "simple" as const };
    const routingGraph: KnowledgeGraph = {
      ...graph,
      nodes: [...graph.nodes, productFile, productEntry, productStep, productConfig, toolFile, toolEntry, toolStep, toolConfig],
      edges: [...graph.edges,
        { source: productFile.id, target: productEntry.id, type: "contains", direction: "forward", weight: 1 },
        { source: productFile.id, target: productStep.id, type: "contains", direction: "forward", weight: 1 },
        { source: productEntry.id, target: productStep.id, type: "calls", direction: "forward", weight: 1 },
        { source: productStep.id, target: productConfig.id, type: "reads_from", direction: "forward", weight: 1 },
        { source: toolFile.id, target: toolEntry.id, type: "contains", direction: "forward", weight: 1 },
        { source: toolFile.id, target: toolStep.id, type: "contains", direction: "forward", weight: 1 },
        { source: toolEntry.id, target: toolStep.id, type: "calls", direction: "forward", weight: 1 },
        { source: toolStep.id, target: toolConfig.id, type: "reads_from", direction: "forward", weight: 1 },
      ],
    };
    const plan = buildFeaturedPlan({
      profile: buildKnowledgeBaseProfile(routingGraph), businessProfile, fileDocPlan, topicPlan,
      config: { entryNodeIds: [productEntry.id, toolEntry.id] },
    });

    const flowDocuments = plan.documents.filter((document) => document.category === "flow");
    expect(flowDocuments[0]?.directNodeIds).toContain(productEntry.id);
    expect(flowDocuments.find((document) => document.directNodeIds.includes(toolEntry.id))).toBeDefined();
  });

  it("keeps the guided route concise while retaining every required topic as searchable reference", () => {
    const requiredTopics: TopicPlan = {
      topics: ["run", "helper", "apply", "isolated"].map((name, index) => ({
        batchIndex: index + 1,
        topicNodeId: name === "apply" ? "function:src/service.ts:apply" : `function:src/a.ts:${name}`,
        sourceFileNodeId: name === "apply" ? "file:src/service.ts" : "file:src/a.ts",
        documentPath: `关键函数专题/${name}.md`,
        title: `${name} 专题`,
        reasons: name === "run"
          ? ["entry candidate: entry-like name or summary"]
          : name === "helper"
            ? ["complex", "important", "high degree", "business relevant"]
            : ["required"],
        coveredNodeIds: [name === "apply" ? "function:src/service.ts:apply" : `function:src/a.ts:${name}`],
        linkedFileDocumentPath: name === "apply" ? "文件文档/src-service.ts.md" : "文件文档/src-a.ts.md",
        tier: "required" as const,
      })),
      batches: [],
      warnings: [],
    };
    const plan = buildFeaturedPlan({
      profile: buildKnowledgeBaseProfile(graph), businessProfile, fileDocPlan, topicPlan: requiredTopics, config: {},
    });
    const topicDocuments = plan.documents.filter((document) => document.category === "topic");

    expect(topicDocuments).toHaveLength(4);
    expect(topicDocuments.filter((document) => document.role === "featured")).toHaveLength(2);
    expect(topicDocuments.filter((document) => document.role === "reference")).toHaveLength(2);
    expect(topicDocuments.filter((document) => document.role === "reference").every((document) => document.route === undefined)).toBe(true);
    expect(topicDocuments.find((document) => document.title === "run 专题")?.role).toBe("featured");
  });

  it("keeps only production-backed capabilities on the guided route", () => {
    const capability = {
      title: "生产规则",
      keywords: ["规则"],
      factIds: [],
      relatedNodeIds: ["function:src/a.ts:run"],
      evidence: [{ filePath: "src/a.ts", nodeId: "function:src/a.ts:run" }],
      score: 10,
      confidence: "high" as const,
      sourceKindCounts: { "production-logic": 1 },
      primaryFactIds: ["fact:production:1", "fact:production:2"],
      supportingFactIds: [],
      exampleOnlyFactIds: [],
    };
    const mixedBusinessProfile: BusinessCapabilityProfile = {
      facts: [],
      capabilities: [
        { id: "capability:production", ...capability, evidenceRole: "primary" },
        {
          id: "capability:test-only",
          ...capability,
          title: "测试样例能力",
          evidenceRole: "supporting",
          sourceKindCounts: { test: 1 },
        },
        {
          id: "capability:prompt-only",
          ...capability,
          title: "提示词示例能力",
          evidenceRole: "example-only",
          sourceKindCounts: { "prompt-or-tooling-example": 1 },
        },
      ],
      totalFacts: 0,
      sourceBackedFacts: 0,
    };

    const plan = buildFeaturedPlan({
      profile: buildKnowledgeBaseProfile(graph),
      businessProfile: mixedBusinessProfile,
      fileDocPlan,
      topicPlan,
      config: {},
    });

    const capabilityDocuments = plan.documents.filter((document) => document.category === "capability");
    expect(capabilityDocuments.map((document) => document.title)).toEqual(["生产规则"]);
    expect(capabilityDocuments.map((document) => document.title)).not.toContain("测试样例能力");
    expect(capabilityDocuments.map((document) => document.title)).not.toContain("提示词示例能力");
    expect(capabilityDocuments.filter((document) => document.role === "featured").map((document) => document.title))
      .toEqual(["生产规则"]);
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
      primaryFactIds: ["fact:shared:1", "fact:shared:2"],
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

  it("keeps capability, flow, and module page paths globally unique after lossy slug collisions", () => {
    const collisionGraph: KnowledgeGraph = {
      ...graph,
      nodes: [
        ...graph.nodes,
        {
          id: "function:src/a.ts:run-duplicate",
          type: "function",
          name: "run",
          filePath: "src/a.ts",
          lineRange: [15, 19],
          summary: "接收另一类请求并调用同一策略",
          tags: ["entry"],
          complexity: "complex",
        },
      ],
      edges: [
        ...graph.edges,
        { source: "file:src/a.ts", target: "function:src/a.ts:run-duplicate", type: "contains", direction: "forward", weight: 1 },
        { source: "function:src/a.ts:run-duplicate", target: "function:src/service.ts:apply", type: "calls", direction: "forward", weight: 1 },
      ],
      layers: [
        ...graph.layers,
        { id: "layer:api-duplicate", name: "入口层", description: "另一个同名入口层", nodeIds: [] },
      ],
    };
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
      primaryFactIds: ["fact:shared:1", "fact:shared:2"],
      supportingFactIds: [],
      exampleOnlyFactIds: [],
    };
    const collisionProfile: BusinessCapabilityProfile = {
      facts: [],
      capabilities: [
        { id: "capability:0-first", ...shared },
        { id: "capability:a/b", ...shared },
        { id: "capability:a:b", ...shared },
      ],
      totalFacts: 0,
      sourceBackedFacts: 0,
    };

    const plan = buildFeaturedPlan({
      profile: buildKnowledgeBaseProfile(collisionGraph),
      businessProfile: collisionProfile,
      fileDocPlan,
      topicPlan,
      config: {},
    });
    const generatedPages = plan.documents.filter((document) =>
      document.category === "capability" || document.category === "flow" || document.category === "module");

    expect(generatedPages.filter((document) => document.category === "capability")).toHaveLength(3);
    expect(generatedPages.filter((document) => document.category === "flow")).toHaveLength(2);
    expect(generatedPages.filter((document) => document.category === "module")).toHaveLength(3);
    expect(new Set(plan.documents.map((document) => document.path)).size).toBe(plan.documents.length);
    expect(new Set(plan.documents.map((document) => document.id)).size).toBe(plan.documents.length);
  });

  it("prioritizes interface and production layers ahead of tests", () => {
    const layeredGraph: KnowledgeGraph = {
      ...graph,
      layers: [
        { id: "layer:test", name: "测试层", description: "测试", nodeIds: ["file:src/a.ts"] },
        { id: "layer:config", name: "配置层", description: "配置", nodeIds: ["config:config/rule.json"] },
        { id: "layer:ui", name: "界面层", description: "界面", nodeIds: ["file:src/service.ts"] },
        { id: "layer:core", name: "核心层", description: "核心", nodeIds: [] },
      ],
    };
    const layeredFileDocPlan: FileDocPlan = {
      ...fileDocPlan,
      tasks: [
        ...fileDocPlan.tasks,
        {
          ...fileDocPlan.tasks[0],
          batchIndex: 3,
          taskIndex: 2,
          fileNodeId: "config:config/rule.json",
          filePath: "config/rule.json",
          layerId: "layer:config",
          documentPath: "文件文档/config-rule.json.md",
          sourceNodeIds: ["config:config/rule.json"],
          referenceKind: "configuration",
          functionNodeIds: [],
          classNodeIds: [],
          sourceSnapshot: {
            filePath: "config/rule.json",
            exists: true,
            text: "{\"enabled\":true}",
            totalLines: 1,
            nonEmptyLines: 1,
          },
        },
      ],
    };
    const plan = buildFeaturedPlan({
      profile: buildKnowledgeBaseProfile(layeredGraph), businessProfile, fileDocPlan: layeredFileDocPlan, topicPlan, config: {},
    });

    expect(plan.documents.filter((document) => document.category === "module").map((document) => document.title))
      .toEqual(["界面层 模块概览", "核心层 模块概览", "配置层 模块概览"]);
    expect(plan.documents.find((document) => document.title === "配置层 模块概览")?.directNodeIds)
      .toContain("config:config/rule.json");
  });

  it("anchors the overview and small modules to concrete files and symbols when flows are absent", () => {
    const structuralOnlyGraph: KnowledgeGraph = {
      ...graph,
      edges: graph.edges.filter((edge) => edge.type === "contains"),
      layers: [{ id: "layer:ui", name: "界面层", description: "界面", nodeIds: ["file:src/a.ts", "file:src/service.ts"] }],
    };
    const plan = buildFeaturedPlan({
      profile: buildKnowledgeBaseProfile(structuralOnlyGraph), businessProfile, fileDocPlan, topicPlan, config: {},
    });
    const overview = plan.documents.find((document) => document.path === KB_PATHS.projectOverview)!;
    const module = plan.documents.find((document) => document.category === "module")!;

    expect(overview.directNodeIds).toEqual(expect.arrayContaining(["file:src/a.ts", "file:src/service.ts"]));
    expect(module.directNodeIds).toEqual(expect.arrayContaining(["file:src/a.ts", "file:src/service.ts"]));
    expect(module.contextNodeIds).toContain("function:src/a.ts:run");
  });

  it("builds Source entry from every valid entry before pseudo-flow filtering and the flow cap", () => {
    const entryIds = Array.from({ length: 13 }, (_, index) =>
      `function:src/entries.ts:entry-${index.toString().padStart(2, "0")}`);
    const isolatedEntryId = "function:src/entries.ts:zz-isolated";
    const completeEntryGraph: KnowledgeGraph = {
      version: "1.0.0",
      project: graph.project,
      nodes: [
        { id: "file:src/entries.ts", type: "file", name: "entries.ts", filePath: "src/entries.ts", summary: "入口集合", tags: [], complexity: "moderate" },
        ...entryIds.map((id, index) => ({
          id,
          type: "function" as const,
          name: `入口 ${index.toString().padStart(2, "0")}`,
          filePath: "src/entries.ts",
          lineRange: [index * 2 + 1, index * 2 + 2] as [number, number],
          summary: `处理第 ${index + 1} 个入口`,
          tags: ["entry"],
          complexity: "moderate" as const,
        })),
        { id: isolatedEntryId, type: "function", name: "孤立入口", filePath: "src/entries.ts", lineRange: [30, 31], summary: "合法入口但没有下游行为", tags: ["entry"], complexity: "moderate" },
        { id: "function:src/entries.ts:shared", type: "function", name: "共享处理", filePath: "src/entries.ts", lineRange: [33, 35], summary: "共享行为阶段", tags: [], complexity: "moderate" },
        { id: "config:config/entries.json", type: "config", name: "entries.json", filePath: "config/entries.json", summary: "入口配置", tags: [], complexity: "simple" },
      ],
      edges: [
        ...[...entryIds, isolatedEntryId, "function:src/entries.ts:shared"].map((target) => ({
          source: "file:src/entries.ts",
          target,
          type: "contains" as const,
          direction: "forward" as const,
          weight: 1,
        })),
        ...entryIds.map((source) => ({
          source,
          target: "function:src/entries.ts:shared",
          type: "calls" as const,
          direction: "forward" as const,
          weight: 1,
        })),
        { source: "function:src/entries.ts:shared", target: "config:config/entries.json", type: "reads_from", direction: "forward", weight: 1 },
      ],
      layers: [{ id: "layer:entry", name: "入口层", description: "入口集合", nodeIds: ["file:src/entries.ts"] }],
      tour: [],
    };

    const plan = buildFeaturedPlan({
      profile: buildKnowledgeBaseProfile(completeEntryGraph),
      businessProfile,
      fileDocPlan: { tasks: [], batches: [], warnings: [] },
      topicPlan,
      config: {},
    });
    const overview = plan.documents.find((document) => document.path === KB_PATHS.projectOverview)!;
    const sourceEntry = plan.documents.find((document) => document.path === KB_PATHS.sourceEntry)!;

    expect(overview.directNodeIds).toHaveLength(12);
    expect(overview.directNodeIds).not.toContain(entryIds[12]);
    expect(plan.documents.filter((document) => document.category === "flow")).toHaveLength(3);
    expect(sourceEntry.contextNodeIds).toEqual(expect.arrayContaining([...entryIds, isolatedEntryId]));
    expect(sourceEntry.representedEdgeIds).toContain(`contains:file:src/entries.ts->${isolatedEntryId}`);
    expect(sourceEntry.representedEdgeIds).toContain(`calls:${entryIds[12]}->function:src/entries.ts:shared`);
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
