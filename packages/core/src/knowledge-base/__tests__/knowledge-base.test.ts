import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "../../types.js";
import {
  buildBusinessCapabilityProfile,
  buildFileDocPlan,
  buildKnowledgeBaseProfile,
  FILE_WRITER_REQUIRED_SECTIONS,
  generateKnowledgeBase,
  renderDeterministicFileWriterDocument,
  selectTopicCandidates,
  sectionBody,
  TOPIC_WRITER_REQUIRED_SECTIONS,
  validateMarkdownQuality,
} from "../index.js";
import { buildCoverageReport } from "../markdown.js";
import { materializeKnowledgeBase } from "../generate.js";

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
  it("keeps indexed incident-edge coverage identical to a full graph scan", () => {
    const graph = sampleGraph();
    graph.edges.reverse();
    const profile = buildKnowledgeBaseProfile(graph);
    const plan = buildFileDocPlan(profile, { sourceFiles: {} });
    for (const task of plan.tasks) {
      const local = new Set([...task.sourceNodeIds, ...task.functionNodeIds, ...task.classNodeIds]);
      const scanned = graph.edges.filter((edge) => local.has(edge.source) || local.has(edge.target));
      const expected = [...new Set(scanned.map((edge) => `${edge.type}:${edge.source}->${edge.target}`))].sort();
      const document = renderDeterministicFileWriterDocument(profile, task);
      expect(document.representedEdgeIds).toEqual(expected);
      const nodeLabels: Record<string, string> = { file: "文件", function: "函数", class: "类", config: "配置" };
      const edgeLabels: Record<string, string> = { contains: "包含", imports: "导入", calls: "调用", reads_from: "读取", writes_to: "写入", configures: "配置" };
      const label = (nodeId: string) => {
        const node = profile.indexes.nodesById.get(nodeId);
        return node ? `${node.name} (${nodeLabels[node.type]})` : nodeId;
      };
      const outgoing = scanned.filter((edge) => local.has(edge.source)).slice(0, 12);
      if (outgoing.length > 0) {
        expect(document.markdown.split("\n").find((line) => line.startsWith("- 处理顺序:"))).toBe(`- 处理顺序: ${outgoing.map((edge) => `${label(edge.source)} --[${edgeLabels[edge.type] ?? edge.type}]--> ${label(edge.target)}`).join("；")}`);
      }
    }
  });
  it("materializes non-status pages once and never substitutes prose for missing writers", () => {
    const profile = buildKnowledgeBaseProfile(sampleGraph());
    const fileDocPlan = buildFileDocPlan(profile, { sourceFiles: {
      "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
      "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\n",
      "src/data/store.ts": "export class CandidateStore {}\n",
      "config/feed.yaml": "ranking: enabled\n",
    } });
    const businessCapabilityProfile = buildBusinessCapabilityProfile(profile, fileDocPlan);
    const kb = materializeKnowledgeBase({
      profile,
      fileDocPlan,
      businessCapabilityProfile,
      topicPlan: { topics: [], batches: [], warnings: [] },
      merged: {
        validation: { ok: true, errors: [], warnings: [] },
        retryPlan: { fileBatchIndexes: [], topicBatchIndexes: [], fileTerminalBatchIndexes: [], topicTerminalBatchIndexes: [], reasons: [] },
        acceptedFileWriterDocuments: [],
        acceptedTopicWriterDocuments: [],
      },
      options: { generationMode: "writer" },
    });

    expect(kb.validation.errors).toContain("计划文件缺少已接受写作者输出：文件文档/src-api-routes.ts.md");
    expect(kb.documents.some((document) => document.path === "文件文档/src-api-routes.ts.md")).toBe(false);
    expect(kb.documents.filter((document) => document.role === "maintenance").map((document) => document.path)).toEqual(
      expect.arrayContaining(["引用覆盖.md", "质量状态.md"]),
    );
    expect(kb.validation.errors).toContain("计划主干页面缺少有效写作者输出：项目总览.md");
    expect(kb.documents.some((document) => document.path === "项目总览.md")).toBe(false);
    expect(kb.coverageReport.totalDocuments).toBe(kb.documents.filter((document) => document.role !== "maintenance").length);
  });

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
    const baseGraph = sampleGraph();
    const expandedGraph = sampleGraph(true);
    const baseCandidates = selectTopicCandidates(buildKnowledgeBaseProfile(baseGraph));
    const expandedCandidates = selectTopicCandidates(buildKnowledgeBaseProfile(expandedGraph));
    const sourceFiles = {
      "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
      "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
      "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
      "config/feed.yaml": "ranking: enabled\n",
    };
    const basePlan = generateKnowledgeBase(baseGraph, { sourceFiles }).plan;
    const expandedPlan = generateKnowledgeBase(expandedGraph, { sourceFiles }).plan;
    const baseTopicCount = basePlan.documents.filter((document) => document.category === "topic").length;
    const expandedTopicCount = expandedPlan.documents.filter((document) => document.category === "topic").length;

    expect(baseCandidates.map((candidate) => candidate.nodeId)).toContain(
      "function:src/api/routes.ts:HandleFeedRequest",
    );
    expect(basePlan.documents.some((doc) => doc.path === "业务流程/HandleFeedRequest.md")).toBe(true);
    expect(expandedCandidates.map((candidate) => candidate.nodeId)).toContain(
      "function:src/api/routes.ts:HandleAdminFeedRequest",
    );
    expect(expandedTopicCount).toBeGreaterThan(baseTopicCount);
    expect(basePlan.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "源码入口.md", role: "featured" }),
        expect.objectContaining({ path: "文件文档/config-feed.yaml.md", referenceKind: "configuration" }),
      ]),
    );
  });

  it("renders reading, coverage, evidence, dependency, verification, and AI guidance in fixed entry documents", () => {
    const kb = generateKnowledgeBase(sampleGraph(), {
      sourceFiles: {
        "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
        "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
        "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
        "config/feed.yaml": "ranking: enabled\n",
      },
    });
    const overview = kb.documents.find((document) => document.path === "项目总览.md")?.content ?? "";
    const sourceEntry = kb.documents.find((document) => document.path === "源码入口.md")?.content ?? "";
    const quality = kb.documents.find((document) => document.path === "质量状态.md");
    const coverage = kb.documents.find((document) => document.path === "引用覆盖.md");

    expect(overview).toContain("## 项目目标与边界");
    expect(overview).toContain("## 完整生命周期");
    expect(overview).toContain("## 配置、依赖与测试");
    expect(overview).toContain("## 推荐阅读路线");
    expect(sourceEntry).toContain("## 配置、依赖与测试");
    expect(sourceEntry).toContain("config/feed.yaml");
    expect(overview).not.toContain("## 项目目的与边界");
    expect(overview).not.toContain("## 生命周期与可发布流程");
    expect(sourceEntry).not.toContain("## 入口文件与函数");
    expect(sourceEntry).not.toContain("## 配置与测试入口");
    for (const document of kb.documents.filter((candidate) => candidate.category === "module")) {
      expect(document.content).not.toContain("## 责任与非责任");
      expect(document.content).not.toContain("## 核心文件（按关系度，最多十五个）");
    }
    for (const document of kb.documents.filter((candidate) => candidate.category === "capability")) {
      expect(document.content).not.toContain("## 非技术同学速读");
      expect(document.content).not.toContain("## 主证据事实");
    }
    for (const document of kb.documents.filter((candidate) => candidate.role === "featured")) {
      const headings = [...document.content.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1]);
      expect(new Set(headings).size, `${document.path} 不应包含重复章节`).toBe(headings.length);
    }
    expect(quality).toMatchObject({ role: "maintenance", category: "quality", directNodeIds: [], contextNodeIds: [] });
    expect(coverage).toMatchObject({ role: "maintenance", category: "coverage", directNodeIds: [], contextNodeIds: [] });
  });

  it("keeps long source snapshots in trace evidence without expanding them into Wiki prose", () => {
    const longSourceMarker = `LONG_SOURCE_${"x".repeat(900)}`;
    const kb = generateKnowledgeBase(sampleGraph(), {
      sourceFiles: {
        "src/api/routes.ts": `export function HandleFeedRequest() { ${longSourceMarker}; return BuildFeed(); }\n`,
        "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
        "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
        "config/feed.yaml": "ranking: enabled\n",
      },
    });
    const overview = kb.documents.find((document) => document.path === "项目总览.md")!;
    const originalEvidence = overview.sourceEvidence.find((evidence) => evidence.excerpt?.includes("LONG_SOURCE_"));

    expect(originalEvidence?.excerpt).toContain(longSourceMarker);
    expect(overview.content).toContain("LONG_SOURCE_");
    expect(overview.content).not.toContain(longSourceMarker);
    expect(overview.content).toContain("…");
  });

  it("renders flow graph reachability as a typed relationship path rather than strict execution order", () => {
    const kb = generateKnowledgeBase(sampleGraph(), {
      sourceFiles: {
        "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
        "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
        "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
        "config/feed.yaml": "ranking: enabled\n",
      },
    });
    const flow = kb.documents.find((document) => document.path === "业务流程/HandleFeedRequest.md");

    expect(flow?.content).toContain("## 关系路径（非严格执行顺序）");
    expect(flow?.content).toContain("--[调用 / calls]-->");
    expect(flow?.content).toContain("## 分支证据");
    expect(flow?.content).toContain("不把广度优先遍历得到的列表宣称为严格执行顺序");
    expect(flow?.content).not.toContain("## 执行顺序");
    expect(flow?.representedEdgeIds).toEqual(
      expect.arrayContaining([
        "calls:function:src/api/routes.ts:HandleFeedRequest->function:src/service/feed.ts:BuildFeed",
        "calls:function:src/service/feed.ts:BuildFeed->function:src/data/store.ts:LoadCandidates",
      ]),
    );
  });

  it("does not use unrelated graph nodes to satisfy a flow evidence floor", () => {
    const nodes: KnowledgeGraph["nodes"] = [
      {
        id: "file:src/workflow.ts",
        type: "file",
        name: "workflow.ts",
        filePath: "src/workflow.ts",
        summary: "Task workflow source",
        tags: ["workflow"],
        complexity: "moderate",
      },
      ...[
        ["HandleTask", 1, "HTTP entry handler for a task"],
        ["ValidateTask", 2, "Validates a task before persistence"],
        ["SaveTask", 3, "Persists the validated task"],
      ].map(([name, line, summary]) => ({
        id: `function:src/workflow.ts:${name}`,
        type: "function" as const,
        name: String(name),
        filePath: "src/workflow.ts",
        lineRange: [Number(line), Number(line)] as [number, number],
        summary: String(summary),
        tags: name === "HandleTask" ? ["entry"] : ["workflow"],
        complexity: "moderate" as const,
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `file:src/unrelated-${index}.ts`,
        type: "file" as const,
        name: `unrelated-${index}.ts`,
        filePath: `src/unrelated-${index}.ts`,
        summary: `Unrelated utility ${index}`,
        tags: ["unrelated"],
        complexity: "simple" as const,
      })),
    ];
    const graph: KnowledgeGraph = {
      version: "1.0.0",
      kind: "codebase",
      project: {
        name: "workflow-service",
        languages: ["typescript"],
        frameworks: [],
        description: "Runs a three-stage task workflow",
        analyzedAt: "2026-07-11T00:00:00Z",
        gitCommitHash: "flow123",
      },
      nodes,
      edges: [
        ...["HandleTask", "ValidateTask", "SaveTask"].map((name) => ({
          source: "file:src/workflow.ts",
          target: `function:src/workflow.ts:${name}`,
          type: "contains" as const,
          direction: "forward" as const,
          weight: 1,
        })),
        {
          source: "function:src/workflow.ts:HandleTask",
          target: "function:src/workflow.ts:ValidateTask",
          type: "calls",
          direction: "forward",
          weight: 1,
        },
        {
          source: "function:src/workflow.ts:ValidateTask",
          target: "function:src/workflow.ts:SaveTask",
          type: "validates",
          direction: "forward",
          weight: 1,
        },
      ],
      layers: [
        {
          id: "layer:workflow",
          name: "Workflow Layer",
          description: "Task workflow",
          nodeIds: nodes.slice(0, 4).map((node) => node.id),
        },
        {
          id: "layer:unrelated",
          name: "Unrelated Layer",
          description: "Unrelated utilities",
          nodeIds: nodes.slice(4).map((node) => node.id),
        },
      ],
      tour: [],
    };
    const sourceFiles = {
      "src/workflow.ts": [
        "export function HandleTask() { return ValidateTask(); }",
        "function ValidateTask() { return SaveTask(); }",
        "function SaveTask() { return true; }",
      ].join("\n"),
      ...Object.fromEntries(Array.from({ length: 6 }, (_, index) => [
        `src/unrelated-${index}.ts`,
        `export const unrelated${index} = ${index};\n`,
      ])),
    };

    const kb = generateKnowledgeBase(graph, { sourceFiles });
    const flow = kb.documents.find((document) => document.path === "业务流程/HandleTask.md");

    expect(flow).toEqual(expect.objectContaining({
      role: "maintenance",
      quality: "failed",
      qualityIssues: expect.arrayContaining(["源码证据数量不足：至少需要 5 组"]),
    }));
    expect(flow?.sourceEvidence).toHaveLength(4);
    expect(flow?.sourceEvidence.every((evidence) => !evidence.nodeId?.startsWith("file:src/unrelated-"))).toBe(true);
    expect(flow).not.toHaveProperty("route");
  });

  it("keeps six fact-rich deterministic file pages out of repetition quarantine", () => {
    const fileFacts = [
      ["account", "核对账户状态并返回准入结果", "读取账户标记并返回是否允许继续处理"],
      ["inventory", "核对库存水位并返回可售数量", "读取库存快照并返回当前可售数量"],
      ["pricing", "计算订单价格并返回优惠后金额", "读取价格规则并返回优惠后的订单金额"],
      ["delivery", "选择配送方案并返回预计到达时间", "读取地址范围并返回可用配送方案"],
      ["payment", "校验支付状态并返回扣款结果", "读取支付凭证并返回本次扣款状态"],
      ["notification", "组装通知内容并返回发送结果", "读取通知模板并返回消息发送结果"],
    ] as const;
    const nodes: KnowledgeGraph["nodes"] = fileFacts.flatMap(([key, fileSummary, functionSummary]) => [
      {
        id: `file:src/${key}.ts`,
        type: "file" as const,
        name: `${key}.ts`,
        filePath: `src/${key}.ts`,
        summary: fileSummary,
        tags: [key],
        complexity: "moderate" as const,
      },
      {
        id: `function:src/${key}.ts:process${key}`,
        type: "function" as const,
        name: `process${key}`,
        filePath: `src/${key}.ts`,
        lineRange: [1, 1] as [number, number],
        summary: functionSummary,
        tags: [key],
        complexity: "simple" as const,
      },
    ]);
    const graph: KnowledgeGraph = {
      version: "1.0.0",
      kind: "codebase",
      project: {
        name: "fact-rich-files",
        languages: ["typescript"],
        frameworks: [],
        description: "由六个职责不同的业务文件组成的知识库",
        analyzedAt: "2026-07-11T00:00:00Z",
        gitCommitHash: "facts123",
      },
      nodes,
      edges: fileFacts.map(([key]) => ({
        source: `file:src/${key}.ts`,
        target: `function:src/${key}.ts:process${key}`,
        type: "contains" as const,
        direction: "forward" as const,
        weight: 1,
      })),
      layers: [{
        id: "layer:business",
        name: "业务文件层",
        description: "包含职责不同且均有中文事实摘要的业务文件",
        nodeIds: nodes.map((node) => node.id),
      }],
      tour: [],
    };
    const sourceFiles = Object.fromEntries(fileFacts.map(([key]) => [
      `src/${key}.ts`,
      `export function process${key}() { return "${key}-result"; }\n`,
    ]));

    const kb = generateKnowledgeBase(graph, { sourceFiles });
    const fileDocuments = kb.documents.filter((document) => document.category === "file");

    expect(fileDocuments).toHaveLength(6);
    expect(fileDocuments.some((document) =>
      document.qualityIssues.includes("正文包含跨文档重复模板语句"))).toBe(false);
    expect(fileDocuments.every((document) => document.role === "reference")).toBe(true);
    expect(fileDocuments.every((document) => document.quality === "generated")).toBe(true);
  });

  it("keeps six fact-rich zero-symbol file pages out of repetition quarantine", () => {
    const fileFacts = [
      ["account-policy", "记录账户准入策略的静态配置内容"],
      ["inventory-policy", "记录库存售卖策略的静态配置内容"],
      ["pricing-policy", "记录订单计价策略的静态配置内容"],
      ["delivery-policy", "记录配送范围策略的静态配置内容"],
      ["payment-policy", "记录支付渠道策略的静态配置内容"],
      ["notification-policy", "记录通知模板策略的静态配置内容"],
    ] as const;
    const nodes: KnowledgeGraph["nodes"] = fileFacts.map(([key, summary]) => ({
      id: `file:src/${key}.ts`,
      type: "file",
      name: `${key}.ts`,
      filePath: `src/${key}.ts`,
      summary,
      tags: [key],
      complexity: "simple",
    }));
    const graph: KnowledgeGraph = {
      version: "1.0.0",
      kind: "codebase",
      project: {
        name: "fact-rich-zero-symbol-files",
        languages: ["typescript"],
        frameworks: [],
        description: "由六个没有符号节点但具备真实事实的文件组成",
        analyzedAt: "2026-07-11T00:00:00Z",
        gitCommitHash: "zero123",
      },
      nodes,
      edges: [],
      layers: [{
        id: "layer:policy",
        name: "策略文件层",
        description: "包含六个职责不同的静态策略文件",
        nodeIds: nodes.map((node) => node.id),
      }],
      tour: [],
    };
    const sourceFiles = Object.fromEntries(fileFacts.map(([key]) => [
      `src/${key}.ts`,
      `export const policyKey = "${key}";\n`,
    ]));

    const kb = generateKnowledgeBase(graph, { sourceFiles });
    const fileDocuments = kb.documents.filter((document) => document.category === "file");

    expect(fileDocuments).toHaveLength(6);
    expect(fileDocuments.some((document) =>
      document.qualityIssues.includes("正文包含跨文档重复模板语句"))).toBe(false);
    expect(fileDocuments.every((document) => document.role === "reference")).toBe(true);
    expect(fileDocuments.every((document) => document.quality === "generated")).toBe(true);
  });

  it("keeps test, dependency, transform, and validation relations in topic coverage", () => {
    const graph = sampleGraph();
    graph.nodes.push(
      {
        id: "file:tests/feed.test.ts",
        type: "file",
        name: "feed.test.ts",
        filePath: "tests/feed.test.ts",
        summary: "BuildFeed regression tests",
        tags: ["test"],
        complexity: "moderate",
      },
      {
        id: "service:candidate-api",
        type: "service",
        name: "candidate-api",
        summary: "Candidate service dependency",
        tags: ["external"],
        complexity: "moderate",
      },
      {
        id: "schema:feed-request",
        type: "schema",
        name: "FeedRequest",
        summary: "Validated feed request schema",
        tags: ["schema"],
        complexity: "simple",
      },
      {
        id: "schema:feed-result",
        type: "schema",
        name: "FeedResult",
        summary: "Transformed feed result schema",
        tags: ["schema"],
        complexity: "simple",
      },
    );
    graph.edges.push(
      {
        source: "function:src/service/feed.ts:BuildFeed",
        target: "file:tests/feed.test.ts",
        type: "tested_by",
        direction: "forward",
        weight: 0.9,
      },
      {
        source: "function:src/service/feed.ts:BuildFeed",
        target: "service:candidate-api",
        type: "depends_on",
        direction: "forward",
        weight: 0.8,
      },
      {
        source: "function:src/service/feed.ts:BuildFeed",
        target: "schema:feed-request",
        type: "validates",
        direction: "forward",
        weight: 0.8,
      },
      {
        source: "function:src/service/feed.ts:BuildFeed",
        target: "schema:feed-result",
        type: "transforms",
        direction: "forward",
        weight: 0.8,
      },
    );
    const kb = generateKnowledgeBase(graph, {
      sourceFiles: {
        "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
        "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
        "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
        "tests/feed.test.ts": "test('BuildFeed', () => expect(true).toBe(true));\n",
        "config/feed.yaml": "ranking: enabled\n",
      },
    });
    const topicPlan = kb.topicPlan.topics.find((topic) => topic.topicNodeId === "function:src/service/feed.ts:BuildFeed");
    const topicDocument = kb.documents.find((document) => document.title === "BuildFeed 关键函数专题");

    expect(topicPlan?.coveredNodeIds).toEqual(
      expect.arrayContaining([
        "file:tests/feed.test.ts",
        "service:candidate-api",
        "schema:feed-request",
        "schema:feed-result",
      ]),
    );
    expect(topicDocument?.content).toContain("--[被测试覆盖]-->");
    expect(topicDocument?.content).toContain("--[依赖]-->");
    expect(topicDocument?.content).toContain("--[转换]-->");
    expect(topicDocument?.content).toContain("--[校验]-->");
  });

  it("keeps entry flow document paths unique when entry functions share a name", () => {
    const graph = sampleGraph();
    for (const name of ["alpha", "beta"]) {
      const filePath = `src/cmd/${name}/main.ts`;
      graph.nodes.push(
        {
          id: `file:${filePath}`,
          type: "file",
          name: "main.ts",
          filePath,
          summary: `${name} command entrypoint`,
          tags: ["cli"],
          complexity: "moderate",
        },
        {
          id: `function:${filePath}:main`,
          type: "function",
          name: "main",
          filePath,
          lineRange: [1, 12],
          summary: `${name} command main entrypoint`,
          tags: ["entry"],
          complexity: "moderate",
        },
      );
      graph.edges.push({
        source: `file:${filePath}`,
        target: `function:${filePath}:main`,
        type: "contains",
        direction: "forward",
        weight: 1,
      });
      graph.edges.push({
        source: `function:${filePath}:main`,
        target: "function:src/service/feed.ts:BuildFeed",
        type: "calls",
        direction: "forward",
        weight: 1,
      });
    }

    const sourceFiles = Object.fromEntries(graph.nodes
      .filter((node) => ["file", "config", "schema", "document"].includes(node.type) && node.filePath)
      .map((node) => [node.filePath!, "export function main() { return true; }\n"]));
    const kb = generateKnowledgeBase(graph, { sourceFiles });
    const flowPaths = kb.plan.documents
      .filter((doc) => doc.category === "flow")
      .map((doc) => doc.path);

    expect(flowPaths.filter((path) => path.includes("main"))).toHaveLength(2);
    expect(new Set(flowPaths).size).toBe(flowPaths.length);

    const generatedPaths = kb.documents.map((doc) => doc.path);
    expect(new Set(generatedPaths).size).toBe(generatedPaths.length);
    expect(kb.coverageReport.totalDocuments).toBe(kb.documents.filter((document) => document.role !== "maintenance").length);
  });

  it("selects topic documents from project signals without a fixed count", () => {
    const graph = sampleGraph(true);
    for (let index = 0; index < 25; index += 1) {
      const filePath = `src/service/important-${index}.ts`;
      graph.nodes.push(
        {
          id: `file:${filePath}`,
          type: "file",
          name: `important-${index}.ts`,
          filePath,
          summary: `Important business file ${index}`,
          tags: ["business"],
          complexity: "complex",
        },
        {
          id: `function:${filePath}:ImportantFlow${index}`,
          type: "function",
          name: `ImportantFlow${index}`,
          filePath,
          lineRange: [1, 30],
          summary: `Important business flow ${index}`,
          tags: ["business", "flow"],
          complexity: "complex",
        },
      );
      graph.edges.push({
        source: `file:${filePath}`,
        target: `function:${filePath}:ImportantFlow${index}`,
        type: "contains",
        direction: "forward",
        weight: 1,
      });
    }
    const sourceFiles = Object.fromEntries(
      graph.nodes
        .filter((node) => ["file", "config", "schema", "document"].includes(node.type) && node.filePath)
        .map((node) => [node.filePath!, "export function placeholder() { return true; }\n"]),
    );

    const kb = generateKnowledgeBase(graph, { sourceFiles });

    expect(kb.topicPlan.topics.length).toBeGreaterThan(25);
    expect(kb.topicPlan.batches).toHaveLength(kb.topicPlan.topics.length);
    const topicDoc = kb.documents.find((doc) => doc.category === "topic");
    for (const section of TOPIC_WRITER_REQUIRED_SECTIONS) {
      expect(topicDoc?.content).toContain(section);
    }
    expect(sectionBody(topicDoc?.content ?? "", "## 非技术同学速读")).toContain("业务作用");
  });

  it("generates complete file documents and cards for every graph file/function/class", () => {
    const graph = sampleGraph();
    const kb = generateKnowledgeBase(graph, {
      sourceFiles: {
        "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
        "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
        "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
        "config/feed.yaml": "ranking: enabled\n",
      },
    });

    expect(kb.coverageReport.fileDocumentCoverage.covered).toBe(kb.coverageReport.fileDocumentCoverage.total);
    expect(kb.coverageReport.functionCardCoverage.covered).toBe(kb.coverageReport.functionCardCoverage.total);
    expect(kb.coverageReport.classCardCoverage.covered).toBe(kb.coverageReport.classCardCoverage.total);

    for (const node of graph.nodes.filter((item) => item.type === "file")) {
      const doc = kb.documents.find((item) => item.path.startsWith("文件文档/") && item.directNodeIds.includes(node.id));
      expect(doc?.content).toContain(`# ${node.filePath} 文件知识文档`);
      for (const section of FILE_WRITER_REQUIRED_SECTIONS) {
        expect(doc?.content).toContain(section);
      }
      expect(sectionBody(doc?.content ?? "", "## 非技术同学速读")).toContain("快速理解");
      expect(sectionBody(doc?.content ?? "", "## 业务问题与影响对象")).toContain(node.filePath ?? node.id);
      expect(sectionBody(doc?.content ?? "", "## 关键规则、输入输出与兜底")).toContain("输入");
      expect(sectionBody(doc?.content ?? "", "## 代码证据")).toContain(node.filePath ?? node.id);
    }
    for (const node of graph.nodes.filter((item) => item.type === "function")) {
      const parentDoc = kb.documents.find((item) => item.path.startsWith("文件文档/") && item.symbolAnchors.some((anchor) => anchor.nodeId === node.id));
      expect(parentDoc?.content).toContain("## 函数卡片");
      expect(parentDoc?.content).toContain(`### ${node.name}`);
      expect(parentDoc?.content).toContain(`节点 ID: \`${node.id}\``);
      if (node.lineRange) {
        expect(parentDoc?.content).toContain(node.lineRange.join("-"));
      }
    }
    for (const node of graph.nodes.filter((item) => item.type === "class")) {
      const parentDoc = kb.documents.find((item) => item.path.startsWith("文件文档/") && item.symbolAnchors.some((anchor) => anchor.nodeId === node.id));
      expect(parentDoc?.content).toContain("## 类卡片");
      expect(parentDoc?.content).toContain(`### ${node.name}`);
      expect(parentDoc?.content).toContain(`节点 ID: \`${node.id}\``);
      if (node.lineRange) {
        expect(parentDoc?.content).toContain(node.lineRange.join("-"));
      }
    }
  });

  it("renders deterministic file documents that pass shared quality validation", () => {
    const profile = buildKnowledgeBaseProfile(sampleGraph());
    const filePlan = buildFileDocPlan(profile, {
      sourceFiles: {
        "src/service/feed.ts": [
          "export function BuildFeed() { return rankCandidates([]); }",
          "function rankCandidates(items) { return items; }",
        ].join("\n"),
      },
    });
    const task = filePlan.tasks.find((item) => item.filePath === "src/service/feed.ts");
    expect(task).toBeDefined();

    const document = renderDeterministicFileWriterDocument(profile, task!);
    const errors = validateMarkdownQuality(document.markdown, {
      path: "documents[0].markdown",
      sections: FILE_WRITER_REQUIRED_SECTIONS,
      sourceEvidenceRefs: [task!.filePath],
      coveredFunctionNodeIds: task!.functionNodeIds,
      coveredClassNodeIds: task!.classNodeIds,
    });

    expect(task!.functionNodeIds.length).toBeGreaterThan(1);
    expect(task!.classNodeIds).toHaveLength(0);
    expect(errors).toEqual([]);
    const buildFeedEvidence = document.sourceEvidence.find((item) =>
      item.nodeId === "function:src/service/feed.ts:BuildFeed");
    expect(buildFeedEvidence?.claim).toContain("函数“BuildFeed”");
    expect(buildFeedEvidence?.claim).toContain("src/service/feed.ts:1-1");
    expect(buildFeedEvidence?.claim).toContain("图谱记录了 BuildFeed 节点");
    expect(buildFeedEvidence?.claim).not.toMatch(/本页|本文|页面|结论|说明/);
  });

  it("renders stable suffixed anchors for colliding symbol names", () => {
    const graph: KnowledgeGraph = {
      version: "1.0.0",
      kind: "codebase",
      project: {
        name: "colliding-symbols",
        languages: ["typescript"],
        frameworks: [],
        description: "验证同名符号锚点",
        analyzedAt: "2026-07-11T00:00:00Z",
        gitCommitHash: "anchors123",
      },
      nodes: [
        {
          id: "file:src/colliding.ts",
          type: "file",
          name: "colliding.ts",
          filePath: "src/colliding.ts",
          summary: "定义两个作用域中的同名运行函数",
          tags: ["anchors"],
          complexity: "moderate",
        },
        {
          id: "function:src/colliding.ts:Alpha.run",
          type: "function",
          name: "run",
          filePath: "src/colliding.ts",
          lineRange: [1, 1],
          summary: "运行甲类的处理逻辑并返回甲结果",
          tags: ["alpha"],
          complexity: "simple",
        },
        {
          id: "class:src/colliding.ts:Beta.run",
          type: "class",
          name: "run",
          filePath: "src/colliding.ts",
          lineRange: [2, 2],
          summary: "运行乙类的处理逻辑并返回乙结果",
          tags: ["beta"],
          complexity: "simple",
        },
      ],
      edges: [
        {
          source: "file:src/colliding.ts",
          target: "function:src/colliding.ts:Alpha.run",
          type: "contains",
          direction: "forward",
          weight: 1,
        },
        {
          source: "file:src/colliding.ts",
          target: "class:src/colliding.ts:Beta.run",
          type: "contains",
          direction: "forward",
          weight: 1,
        },
      ],
      layers: [{
        id: "layer:source",
        name: "源码层",
        description: "同名符号验证层",
        nodeIds: [
          "file:src/colliding.ts",
          "function:src/colliding.ts:Alpha.run",
          "class:src/colliding.ts:Beta.run",
        ],
      }],
      tour: [],
    };
    const profile = buildKnowledgeBaseProfile(graph);
    const filePlan = buildFileDocPlan(profile, { sourceFiles: {
      "src/colliding.ts": [
        "class Alpha { run() { return 'alpha'; } }",
        "class Beta { run() { return 'beta'; } }",
      ].join("\n"),
    } });
    const task = filePlan.tasks.find((item) => item.filePath === "src/colliding.ts");
    expect(task).toBeDefined();

    const document = renderDeterministicFileWriterDocument(profile, task!);
    const anchorCount = (anchor: string): number =>
      document.markdown.match(new RegExp(`<a id="${anchor}"></a>`, "g"))?.length ?? 0;

    expect(anchorCount("run")).toBe(1);
    expect(anchorCount("run-2")).toBe(1);
  });

  it("reports actual document counts and coverage status", () => {
    const kb = generateKnowledgeBase(sampleGraph(), {
      sourceFiles: {
        "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
        "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
        "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
        "config/feed.yaml": "ranking: enabled\n",
      },
    });
    const report = kb.documents.find((item) => item.path === "引用覆盖.md");
    const nonStatusDocuments = kb.documents.filter((document) => document.role !== "maintenance");

    expect(report).toBeDefined();
    expect(report).toMatchObject({ role: "maintenance", category: "coverage" });
    expect(kb.coverageReport.totalDocuments).toBe(nonStatusDocuments.length);
    expect(kb.documents.length).toBe(
      kb.coverageReport.totalDocuments
      + kb.documents.filter((document) => document.role === "maintenance").length,
    );
    expect(kb.coverageReport.qualityValidation.checked).toBe(
      kb.documents.filter((document) => document.category !== "quality" && document.category !== "coverage").length,
    );
    expect(kb.coverageReport.qualityValidation.failed).not.toContain("引用覆盖.md");
    expect(kb.coverageReport.documentCounts.file).toBe(4);
    expect(kb.plan.documents.filter((document) => document.role === "featured").length).toBeGreaterThan(0);
    expect(kb.plan.documents.filter((document) => document.role === "reference")).toHaveLength(4);
    expect(kb.plan.documents.filter((document) => document.role === "maintenance")).toHaveLength(2);
    expect(kb.coverageReport.fileDocumentCoverage).toEqual({ covered: 3, total: 3, missing: [] });
    expect(kb.coverageReport.functionCardCoverage).toEqual({ covered: 4, total: 4, missing: [] });
    expect(kb.coverageReport.classCardCoverage).toEqual({ covered: 1, total: 1, missing: [] });

    expect(report?.content).toContain("## 文件与符号覆盖");
    expect(report?.content).toContain("文件：3 / 3");
    expect(report?.content).toContain("函数锚点：4 / 4");
    expect(report?.content).toContain("类型锚点：1 / 1");
  });

  it("reports actual relationship coverage from generated file documents", () => {
    const kb = generateKnowledgeBase(sampleGraph(), {
      sourceFiles: {
        "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
        "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
        "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
        "config/feed.yaml": "ranking: enabled\n",
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
    const missingDocument = kb.documents.find((document) =>
      document.directNodeIds.includes("file:src/missing.ts"));
    expect(missingDocument).toEqual(expect.objectContaining({
      role: "maintenance",
      quality: "failed",
      generationStatus: "partial",
      qualityIssues: expect.arrayContaining(["源码快照缺失，无法生成可发布的精确证据"]),
    }));
    expect(missingDocument).not.toHaveProperty("route");
    expect(kb.coverageReport.fileDocumentCoverage.missing).toContain("file:src/missing.ts");
  });

  it("splits topic planning into required and extended tiers", () => {
    const graph = sampleGraph(true);
    const rankCandidatesNode = graph.nodes.find(
      (node) => node.id === "function:src/service/feed.ts:rankCandidates",
    );
    expect(rankCandidatesNode).toBeDefined();
    if (rankCandidatesNode) {
      rankCandidatesNode.summary = "Ranks candidates with a lightweight local scoring helper";
      rankCandidatesNode.tags = ["helper"];
    }
    graph.nodes.push(
      {
        id: "function:src/service/feed.ts:prepareHomeFeedScores",
        type: "function",
        name: "prepareHomeFeedScores",
        filePath: "src/service/feed.ts",
        lineRange: [122, 130],
        summary: "Helper that shapes home-feed inputs before ranking",
        tags: ["helper"],
        complexity: "simple",
      },
      {
        id: "function:src/service/feed.ts:prepareFreshFeedScores",
        type: "function",
        name: "prepareFreshFeedScores",
        filePath: "src/service/feed.ts",
        lineRange: [132, 140],
        summary: "Helper that shapes fresh-feed inputs before ranking",
        tags: ["helper"],
        complexity: "simple",
      },
      {
        id: "function:src/service/feed.ts:prepareFallbackFeedScores",
        type: "function",
        name: "prepareFallbackFeedScores",
        filePath: "src/service/feed.ts",
        lineRange: [142, 150],
        summary: "Helper that shapes fallback-feed inputs before ranking",
        tags: ["helper"],
        complexity: "simple",
      },
    );
    graph.edges.push(
      {
        source: "file:src/service/feed.ts",
        target: "function:src/service/feed.ts:prepareHomeFeedScores",
        type: "contains",
        direction: "forward",
        weight: 1,
      },
      {
        source: "file:src/service/feed.ts",
        target: "function:src/service/feed.ts:prepareFreshFeedScores",
        type: "contains",
        direction: "forward",
        weight: 1,
      },
      {
        source: "file:src/service/feed.ts",
        target: "function:src/service/feed.ts:prepareFallbackFeedScores",
        type: "contains",
        direction: "forward",
        weight: 1,
      },
      {
        source: "function:src/service/feed.ts:prepareHomeFeedScores",
        target: "function:src/service/feed.ts:rankCandidates",
        type: "calls",
        direction: "forward",
        weight: 0.4,
      },
      {
        source: "function:src/service/feed.ts:prepareFreshFeedScores",
        target: "function:src/service/feed.ts:rankCandidates",
        type: "calls",
        direction: "forward",
        weight: 0.4,
      },
      {
        source: "function:src/service/feed.ts:prepareFallbackFeedScores",
        target: "function:src/service/feed.ts:rankCandidates",
        type: "calls",
        direction: "forward",
        weight: 0.4,
      },
    );

    const plannerPreview = selectTopicCandidates(buildKnowledgeBaseProfile(graph));
    expect(plannerPreview.some((candidate) => candidate.nodeId.includes("rankCandidates"))).toBe(true);

    const kb = generateKnowledgeBase(graph, {
      sourceFiles: {
        "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\nexport function HandleAdminFeedRequest() { return BuildFeed(); }\n",
        "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\nfunction prepareHomeFeedScores(items) { return rankCandidates(items); }\nfunction prepareFreshFeedScores(items) { return rankCandidates(items); }\nfunction prepareFallbackFeedScores(items) { return rankCandidates(items); }\n",
        "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
        "config/feed.yaml": "ranking: enabled\n",
      },
    });

    const required = kb.topicPlan.topics.filter((topic) => topic.tier === "required");
    const extended = kb.topicPlan.topics.filter((topic) => topic.tier === "extended");
    const requiredIds = new Set(required.map((topic) => topic.topicNodeId));
    const extendedIds = new Set(extended.map((topic) => topic.topicNodeId));
    const handleFeedRequiredTopic = required.find((topic) => topic.topicNodeId.includes("HandleFeedRequest"));
    const handleFeedRequiredBatch = kb.topicPlan.batches.find(
      (batch) => batch.batchIndex === handleFeedRequiredTopic?.batchIndex,
    );
    const rankCandidatesExtendedTopic = extended.find((topic) => topic.topicNodeId.includes("rankCandidates"));
    const rankCandidatesExtendedBatch = kb.topicPlan.batches.find(
      (batch) => batch.batchIndex === rankCandidatesExtendedTopic?.batchIndex,
    );

    expect(required.some((topic) => topic.topicNodeId.includes("HandleFeedRequest"))).toBe(true);
    expect(required.some((topic) => topic.topicNodeId.includes("HandleAdminFeedRequest"))).toBe(true);
    expect(required.some((topic) => topic.topicNodeId.includes("BuildFeed"))).toBe(true);
    expect(required.some((topic) => topic.topicNodeId.includes("rankCandidates"))).toBe(false);
    expect(extended.some((topic) => topic.topicNodeId.includes("rankCandidates"))).toBe(true);
    expect(extended.some((topic) => topic.topicNodeId.includes("HandleFeedRequest"))).toBe(false);
    expect(extended.some((topic) => topic.topicNodeId.includes("HandleAdminFeedRequest"))).toBe(false);
    expect(extended.some((topic) => topic.topicNodeId.includes("BuildFeed"))).toBe(false);
    expect([...requiredIds].every((topicNodeId) => !extendedIds.has(topicNodeId))).toBe(true);
    expect(kb.topicPlan.batches.some((batch) => batch.tier === "required")).toBe(true);
    expect(kb.topicPlan.batches.some((batch) => batch.tier === "extended")).toBe(true);
    expect(handleFeedRequiredBatch?.tier).toBe("required");
    expect(handleFeedRequiredBatch?.reason).toBe("required topic for default high-quality run");
    expect(rankCandidatesExtendedBatch?.tier).toBe("extended");
    expect(rankCandidatesExtendedBatch?.reason).toBe("extended topic for optional continuation");
    expect(kb.coverageReport.topicCoverage.total).toBe(kb.topicPlan.topics.length);
    expect(kb.coverageReport.topicCoverage.covered).toBe(required.length);
    expect(kb.coverageReport.requiredTopicCoverage.total).toBe(required.length);
    expect(kb.coverageReport.requiredTopicCoverage.covered).toBe(required.length);
    expect(kb.coverageReport.extendedTopicCoverage.total).toBe(extended.length);
    expect(kb.coverageReport.extendedTopicCoverage.covered).toBe(0);

    const firstRequired = required[0]!;
    const documentsWithoutItsDirectCoverage = kb.documents
      .filter((document) => document.role !== "maintenance")
      .map((document) => document.category === "topic" && document.directNodeIds.includes(firstRequired.topicNodeId)
        ? { ...document, directNodeIds: document.directNodeIds.filter((nodeId) => nodeId !== firstRequired.topicNodeId) }
        : document);
    const recalculated = buildCoverageReport(
      kb.profile,
      kb.fileDocPlan,
      kb.topicPlan,
      kb.plan,
      documentsWithoutItsDirectCoverage,
      kb.validation,
      kb.retryPlan,
      kb.businessCapabilityProfile,
    );
    expect(recalculated.requiredTopicCoverage.missing).toContain(firstRequired.topicNodeId);
  });
});
