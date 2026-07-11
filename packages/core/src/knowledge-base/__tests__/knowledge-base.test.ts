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
    expect(kb.documents.filter((document) => document.role === "maintenance").map((document) => document.path)).toEqual([
      "引用覆盖.md",
      "质量状态.md",
    ]);
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

    expect(overview).toContain("## 项目目的与边界");
    expect(overview).toContain("## 生命周期与可发布流程");
    expect(overview).toContain("## 配置、结构与测试边界");
    expect(overview).toContain("## 推荐阅读");
    expect(sourceEntry).toContain("## 配置与测试入口");
    expect(sourceEntry).toContain("config/feed.yaml");
    expect(quality).toMatchObject({ role: "maintenance", category: "quality", directNodeIds: [], contextNodeIds: [] });
    expect(coverage).toMatchObject({ role: "maintenance", category: "coverage", directNodeIds: [], contextNodeIds: [] });
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
    expect(kb.documents.length).toBe(kb.coverageReport.totalDocuments + 2);
    expect(kb.coverageReport.qualityValidation.checked).toBe(kb.coverageReport.totalDocuments);
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
