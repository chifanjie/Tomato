import { describe, expect, it } from "vitest";
import type {
  FileDocTask,
  FileWriterBatchOutput,
  FileWriterDocument,
  TopicPlan,
  TopicWriterBatchOutput,
  TopicWriterDocument,
} from "../index.js";
import type { KnowledgeGraph } from "../../types.js";
import {
  buildFileDocPlan,
  buildKnowledgeBaseProfile,
  mergeKnowledgeBaseWriterOutputs,
} from "../index.js";

function graph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    kind: "codebase",
    project: {
      name: "merge-fixture",
      languages: ["typescript"],
      frameworks: [],
      description: "Fixture for merge coverage",
      analyzedAt: "2026-06-26T00:00:00Z",
      gitCommitHash: "abc123",
    },
    nodes: [
      {
        id: "file:src/service/feed.ts",
        type: "file",
        name: "feed.ts",
        filePath: "src/service/feed.ts",
        summary: "Feed service",
        tags: ["service"],
        complexity: "moderate",
      },
      {
        id: "function:src/service/feed.ts:BuildFeed",
        type: "function",
        name: "BuildFeed",
        filePath: "src/service/feed.ts",
        lineRange: [1, 8],
        summary: "Builds a feed",
        tags: ["feed"],
        complexity: "moderate",
      },
      {
        id: "class:src/service/feed.ts:FeedBuilder",
        type: "class",
        name: "FeedBuilder",
        filePath: "src/service/feed.ts",
        lineRange: [10, 20],
        summary: "Coordinates feed building",
        tags: ["feed"],
        complexity: "moderate",
      },
      {
        id: "file:src/missing.ts",
        type: "file",
        name: "missing.ts",
        filePath: "src/missing.ts",
        summary: "Missing source",
        tags: ["stale"],
        complexity: "simple",
      },
      {
        id: "function:src/missing.ts:DeletedHelper",
        type: "function",
        name: "DeletedHelper",
        filePath: "src/missing.ts",
        lineRange: [1, 2],
        summary: "Deleted helper",
        tags: ["stale"],
        complexity: "simple",
      },
    ],
    edges: [
      {
        source: "file:src/service/feed.ts",
        target: "function:src/service/feed.ts:BuildFeed",
        type: "contains",
        direction: "forward",
        weight: 1,
      },
      {
        source: "file:src/service/feed.ts",
        target: "class:src/service/feed.ts:FeedBuilder",
        type: "contains",
        direction: "forward",
        weight: 1,
      },
      {
        source: "file:src/missing.ts",
        target: "function:src/missing.ts:DeletedHelper",
        type: "contains",
        direction: "forward",
        weight: 1,
      },
    ],
    layers: [],
    tour: [],
  };
}

function fixture() {
  const profile = buildKnowledgeBaseProfile(graph());
  const fileDocPlan = buildFileDocPlan(profile, {
    sourceFiles: {
      "src/service/feed.ts": "export function BuildFeed() {\n  return new FeedBuilder();\n}\nclass FeedBuilder {}\n",
    },
  });

  return { profile, fileDocPlan };
}

function existingTask(): FileDocTask {
  const task = fixture().fileDocPlan.tasks.find((item) => item.fileNodeId === "file:src/service/feed.ts");
  if (!task) throw new Error("expected existing task");
  return task;
}

function missingTask(): FileDocTask {
  const task = fixture().fileDocPlan.tasks.find((item) => item.fileNodeId === "file:src/missing.ts");
  if (!task) throw new Error("expected missing task");
  return task;
}

function markdownFor(task: FileDocTask): string {
  const anchors = [...task.functionNodeIds, ...task.classNodeIds].map((nodeId) => {
    const anchor = nodeId.split(":").at(-1) ?? nodeId;
    return `<a id="${anchor}"></a>\n- 节点 ID: \`${nodeId}\`，该符号实现当前文件可核对的入口或组装职责。`;
  });
  const specializedSections = {
    configuration: ["配置目的与作用域", "配置项、类型与默认值", "读取位置与生效顺序", "缺失、非法值与降级", "测试与改动风险", "源码证据"],
    schema: ["数据模型与边界", "字段、类型与约束", "读写方与生命周期", "校验、迁移与兼容性", "测试与改动风险", "源码证据"],
    documentation: ["文档目的与读者", "关键结论", "链接与外部依赖", "与代码的对应关系", "过期风险与维护入口", "源码证据"],
    test: ["被测行为与范围", "用例、输入与断言", "Fixture、Mock 与外部依赖", "失败分支与回归风险", "尚未覆盖的行为", "与生产代码的对应关系", "源码证据"],
  } as const;
  if (task.referenceKind !== "code") {
    return [
      `# ${task.filePath}`,
      "",
      ...specializedSections[task.referenceKind].flatMap((section) => [
        `## ${section}`,
        section === "源码证据"
          ? `\`${task.filePath}:1-1\` 的原文支持本页对文件作用、边界和改动风险的结论。`
          : `${section}：源码明确记录当前文件的结构、读取关系和失败边界，修改前应核对调用位置与对应测试。`,
        "",
      ]),
    ].join("\n");
  }
  return [
    `# ${task.filePath}`,
    "",
    `文件节点: \`${task.fileNodeId}\``,
    "## 函数卡片",
    ...task.functionNodeIds.map((nodeId) => `- 节点 ID: \`${nodeId}\``),
    "## 类卡片",
    ...task.classNodeIds.map((nodeId) => `- 节点 ID: \`${nodeId}\``),
    "## 文件职责",
    "该文件读取 Feed 请求和候选集合，按明确顺序调用排序并构造包含项目和元数据的响应。",
    "## 输入、输出与关键字段",
    "输入用户请求、候选列表和分数字段，输出稳定排序的 Feed 项以及用于定位问题的元数据。",
    "## 规则、分支与状态变化",
    "候选为空时返回空列表；候选存在时按分数排序，状态从召回顺序变为最终展示顺序。",
    "## 配置、依赖与副作用",
    "依赖候选加载和响应构建对象，不写持久化存储，但排序结果会改变客户端观察到的展示顺序。",
    "## 异常、测试与改动风险",
    "需要覆盖空候选、同分候选和构建失败；修改比较规则会影响排序断言以及下游展示结果。",
    "## 函数与类型",
    ...anchors,
    "## 源码证据",
    `\`${task.filePath}:1-${Math.max(1, task.sourceSnapshot.totalLines)}\` 展示入口函数、组装类型和返回路径。`,
  ].join("\n");
}

function fileDocument(task: FileDocTask, overrides: Partial<FileWriterDocument> = {}): FileWriterDocument {
  const sourceLines = task.sourceSnapshot.text.split(/\r?\n/);
  return {
    fileNodeId: task.fileNodeId,
    filePath: task.filePath,
    documentPath: task.documentPath,
    referenceKind: task.referenceKind,
    title: `${task.filePath} 文件知识文档`,
    coveredFunctionNodeIds: [...task.functionNodeIds],
    coveredClassNodeIds: [...task.classNodeIds],
    representedEdgeIds: [...task.incomingEdgeIds, ...task.outgoingEdgeIds],
    sourceEvidence: [task.fileNodeId, ...task.functionNodeIds, ...task.classNodeIds].map((nodeId, index) => {
      const nodeName = nodeId.split(":").at(-1) ?? nodeId;
      const matchingLine = index === 0 ? -1 : sourceLines.findIndex((line) => line.includes(nodeName));
      const lineRange: [number, number] = index === 0
        ? [1, Math.max(1, task.sourceSnapshot.totalLines)]
        : [Math.max(1, matchingLine + 1), Math.max(1, matchingLine + 1)];
      return {
        filePath: task.filePath,
        nodeId,
        lineRange,
        excerpt: task.sourceSnapshot.text.split(/\r?\n/).slice(lineRange[0] - 1, lineRange[1]).join("\n"),
        claim: index === 0 ? "该文件提供 Feed 请求处理与响应组装入口。" : `该符号实现文件中的可核对处理步骤：${nodeId}。`,
      };
    }),
    importantNodeIds: [task.fileNodeId, ...task.functionNodeIds, ...task.classNodeIds],
    markdown: markdownFor(task),
    ...overrides,
  };
}

function fileOutput(batchIndex: number, documents: FileWriterDocument[]): FileWriterBatchOutput {
  return { batchIndex, documents, warnings: [] };
}

function topicDocument(overrides: Partial<TopicWriterDocument> = {}): TopicWriterDocument {
  return {
    topicNodeId: "function:src/service/feed.ts:BuildFeed",
    sourceFileNodeId: "file:src/service/feed.ts",
    documentPath: "专题/BuildFeed.md",
    title: "BuildFeed 业务专题",
    coveredNodeIds: ["function:src/service/feed.ts:BuildFeed"],
    linkedFileDocumentPath: "文件文档/src-service-feed.ts.md",
    evidence: [
      { filePath: "src/service/feed.ts", lineRange: [1, 3], nodeId: "function:src/service/feed.ts:BuildFeed", excerpt: "export function BuildFeed() {\n  return new FeedBuilder();\n}", claim: "BuildFeed 是排序主题的直接入口。" },
      { filePath: "src/service/feed.ts", lineRange: [4, 4], nodeId: "class:src/service/feed.ts:FeedBuilder", excerpt: "class FeedBuilder {}", claim: "FeedBuilder 负责组装主题流程的输出。" },
      { filePath: "src/service/feed.ts", lineRange: [2, 2], nodeId: "function:src/service/feed.ts:BuildFeed", excerpt: "  return new FeedBuilder();", claim: "入口函数把执行结果交给构建对象。" },
    ],
    markdown: [
      "# BuildFeed",
      "",
      "## 为什么关键",
      "该主题连接 Feed 请求入口、候选处理与响应构建，决定调用方最终拿到的项目顺序和排查元数据。",
      "## 完整条件与跳过规则",
      "请求完成解析后进入处理；候选为空时跳过排序比较，但仍构造结构完整的空响应。",
      "## 输入输出与状态变化",
      "输入请求上下文和候选集合，输出 Feed 项；状态从原始候选转换为可返回的展示结果。",
      "## 算法、分支与降级",
      "入口按固定顺序加载、处理并构建结果，缺少候选时降级为空集合而不是抛出无关错误。",
      "## 依赖、测试与可观测性",
      "依赖 FeedBuilder；测试应覆盖正常和空候选，并通过返回元数据定位构建阶段异常。",
      "## 源码证据",
      "`src/service/feed.ts:1-3` 展示入口、构建对象和返回关系。",
    ].join("\n"),
    ...overrides,
  };
}

function topicOutput(batchIndex: number, topics: TopicWriterDocument[]): TopicWriterBatchOutput {
  return { batchIndex, topics, warnings: [] };
}

function topicPlanFor(topics: TopicWriterDocument[], tier: "required" | "extended" = "required"): TopicPlan {
  return {
    topics: topics.map((topic, index) => ({
      batchIndex: index + 1,
      topicNodeId: topic.topicNodeId,
      sourceFileNodeId: topic.sourceFileNodeId,
      documentPath: topic.documentPath,
      title: topic.title,
      reasons: ["merge fixture"],
      coveredNodeIds: [...topic.coveredNodeIds],
      linkedFileDocumentPath: topic.linkedFileDocumentPath,
      tier,
    })),
    batches: [],
    warnings: [],
  };
}

describe("knowledge base writer output merge", () => {
  it("accepts complete file and topic documents", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const topic = topicDocument();

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[0], tasks: [task] }] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [fileDocument(task)])],
      topicPlan: topicPlanFor([topic]),
      topicWriterOutputs: [topicOutput(7, [topic])],
    });

    expect(result.validation.ok).toBe(true);
    expect(result.validation.errors).toEqual([]);
    expect(result.retryPlan).toEqual({
      fileBatchIndexes: [],
      topicBatchIndexes: [],
      fileTerminalBatchIndexes: [],
      topicTerminalBatchIndexes: [],
      reasons: [],
    });
    expect(result.acceptedFileWriterDocuments).toHaveLength(1);
    expect(result.acceptedTopicWriterDocuments).toEqual([topic]);
    expect(result).not.toHaveProperty("fileDocuments");
    expect(result).not.toHaveProperty("topicDocuments");
  });

  it("rejects a file writer document whose reference kind differs from its task", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const document = fileDocument(task, { referenceKind: "schema" });

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [document])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toContain(
      `file writer referenceKind must match planned task: ${task.fileNodeId} expected ${task.referenceKind} received schema`,
    );
    expect(result.acceptedFileWriterDocuments).toEqual([]);
  });

  it("rejects source nodes whose normalized path differs from the task path", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const invalidTask = {
      ...task,
      sourceNodeIds: [...task.sourceNodeIds, "file:src/missing.ts"],
    };

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [invalidTask], batches: [] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [fileDocument(invalidTask)])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toContain(
      `file task sourceNodeId path mismatch: file:src/missing.ts expected ${task.filePath} received src/missing.ts`,
    );
    expect(result.acceptedFileWriterDocuments).toEqual([]);
  });

  it("accepts configuration, schema, and documentation task owners", () => {
    const sourceGraph = graph();
    sourceGraph.nodes.push(
      { id: "config:config/app.yaml", type: "config", name: "app.yaml", filePath: "config/app.yaml", summary: "应用配置", tags: ["config"], complexity: "simple" },
      { id: "schema:schemas/feed.proto", type: "schema", name: "feed.proto", filePath: "schemas/feed.proto", summary: "Feed schema", tags: ["schema"], complexity: "simple" },
      { id: "document:docs/feed.md", type: "document", name: "feed.md", filePath: "docs/feed.md", summary: "Feed documentation", tags: ["docs"], complexity: "simple" },
    );
    const profile = buildKnowledgeBaseProfile(sourceGraph);
    const planned = buildFileDocPlan(profile, { sourceFiles: {
      "config/app.yaml": "enabled: true\n",
      "schemas/feed.proto": "message Feed {}\n",
      "docs/feed.md": "# Feed\n",
    } });
    const tasks = planned.tasks.filter((task) => ["config", "schema", "document"].includes(profile.indexes.nodesById.get(task.fileNodeId)?.type ?? ""));

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...planned, tasks, batches: [] },
      fileWriterOutputs: tasks.map((task) => fileOutput(task.batchIndex, [fileDocument(task)])),
    });

    expect(result.validation.ok).toBe(true);
    expect(result.acceptedFileWriterDocuments.map((document) => document.fileNodeId).sort()).toEqual([
      "config:config/app.yaml",
      "document:docs/feed.md",
      "schema:schemas/feed.proto",
    ]);
  });

  it("fails and retries the batch when a function card is missing", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const doc = fileDocument(task, { coveredFunctionNodeIds: [], markdown: markdownFor(task).replace(task.functionNodeIds[0], "") });

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[0], tasks: [task] }] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [doc])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining(`function card missing coveredFunctionNodeIds entry: ${task.functionNodeIds[0]}`),
    ]));
    expect(result.retryPlan.fileBatchIndexes).toEqual([task.batchIndex]);
    expect(result.acceptedFileWriterDocuments).toEqual([]);
  });

  it("surfaces retry reasons without claiming accepted fallback success", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const broken = fileDocument(task, {
      coveredFunctionNodeIds: [],
      markdown: markdownFor(task).replace(task.functionNodeIds[0], ""),
    });

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[0], tasks: [task] }] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [broken])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining(`function card missing coveredFunctionNodeIds entry: ${task.functionNodeIds[0]}`),
    ]));
    expect(result.acceptedFileWriterDocuments).toEqual([]);
    expect(result.retryPlan.fileBatchIndexes).toEqual([task.batchIndex]);
    expect(result.retryPlan.fileTerminalBatchIndexes).toEqual([]);
    expect(result.retryPlan.reasons).toEqual(expect.arrayContaining([
      expect.stringContaining(`function card missing coveredFunctionNodeIds entry: ${task.functionNodeIds[0]}`),
    ]));
  });

  it("fails and retries the batch when a class card is missing", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const doc = fileDocument(task, { coveredClassNodeIds: [], markdown: markdownFor(task).replace(task.classNodeIds[0], "") });

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[0], tasks: [task] }] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [doc])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining(`class card missing coveredClassNodeIds entry: ${task.classNodeIds[0]}`),
    ]));
    expect(result.retryPlan.fileBatchIndexes).toEqual([task.batchIndex]);
    expect(result.acceptedFileWriterDocuments).toEqual([]);
  });

  it("fails when prose lacks the new required sections and planned anchors", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const misplacedMarkdown = [
      `# ${task.filePath}`,
      "",
      "## 函数卡片",
      "- BuildFeed without node id",
      "## 类卡片",
      "- FeedBuilder without node id",
      "## AI 检索词",
      ...task.functionNodeIds.map((nodeId) => `- ${nodeId}`),
      ...task.classNodeIds.map((nodeId) => `- ${nodeId}`),
    ].join("\n");

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[0], tasks: [task] }] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [fileDocument(task, { markdown: misplacedMarkdown })])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("正文缺少必需章节：文件职责"),
      expect.stringContaining(`文件正文缺少唯一符号锚点：${task.functionNodeIds[0]}`),
      expect.stringContaining(`文件正文缺少唯一符号锚点：${task.classNodeIds[0]}`),
    ]));
    expect(result.retryPlan.fileBatchIndexes).toEqual([task.batchIndex]);
    expect(result.acceptedFileWriterDocuments).toEqual([]);
  });

  it("fails when required new code-template sections are missing", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const markdown = [
      `# ${task.filePath}`,
      "",
      ...task.functionNodeIds.map((nodeId) => `function elsewhere: ${nodeId}`),
      ...task.classNodeIds.map((nodeId) => `class elsewhere: ${nodeId}`),
    ].join("\n");

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[0], tasks: [task] }] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [fileDocument(task, { markdown })])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("正文缺少必需章节：函数与类型"),
      expect.stringContaining("正文缺少必需章节：源码证据"),
    ]));
    expect(result.retryPlan.fileBatchIndexes).toEqual([task.batchIndex]);
    expect(result.acceptedFileWriterDocuments).toEqual([]);
  });

  it("fails duplicate file documents and duplicate document paths", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const duplicate = fileDocument(task, { title: "duplicate" });

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[0], tasks: [task] }] },
      fileWriterOutputs: [
        fileOutput(5, [fileDocument(task)]),
        fileOutput(3, [duplicate]),
      ],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining(`duplicate file writer document for fileNodeId: ${task.fileNodeId}`),
      expect.stringContaining(`duplicate file writer documentPath: ${task.documentPath}`),
    ]));
    expect(result.retryPlan.fileBatchIndexes).toEqual([3, 5]);
    expect(result.acceptedFileWriterDocuments).toEqual([]);
  });

  it("fails and retries a planned task with no file writer document", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[0], tasks: [task] }] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining(`missing file writer document for planned task: ${task.fileNodeId}`),
    ]));
    expect(result.retryPlan.fileBatchIndexes).toEqual([task.batchIndex]);
    expect(result.acceptedFileWriterDocuments).toEqual([]);
  });

  it("fails and retries missing source tasks even when a writer returns a document", () => {
    const { profile, fileDocPlan } = fixture();
    const task = missingTask();

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[1], tasks: [task] }] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [fileDocument(task)])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining(`source file missing for task: ${task.fileNodeId}`),
    ]));
    expect(result.retryPlan.fileBatchIndexes).toEqual([task.batchIndex]);
    expect(result.acceptedFileWriterDocuments).toEqual([]);
  });

  it("fails duplicate topic node ids and duplicate topic document paths", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const topic = topicDocument();
    const duplicate = topicDocument({ title: "duplicate" });

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[0], tasks: [task] }] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [fileDocument(task)])],
      topicPlan: topicPlanFor([topic]),
      topicWriterOutputs: [
        topicOutput(8, [topic]),
        topicOutput(4, [duplicate]),
      ],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining(`duplicate topic writer document for topicNodeId: ${topic.topicNodeId}`),
      expect.stringContaining(`duplicate topic writer documentPath: ${topic.documentPath}`),
    ]));
    expect(result.retryPlan.topicBatchIndexes).toEqual([4, 8]);
    expect(result.acceptedTopicWriterDocuments).toEqual([]);
  });

  it("fails topic documents that cover unknown graph nodes", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const topic = topicDocument({ coveredNodeIds: ["function:src/service/feed.ts:BuildFeed", "function:missing:Unknown"] });

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[0], tasks: [task] }] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [fileDocument(task)])],
      topicPlan: topicPlanFor([topic]),
      topicWriterOutputs: [topicOutput(6, [topic])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("topic coveredNodeIds contains unknown graph node: function:missing:Unknown"),
    ]));
    expect(result.retryPlan.topicBatchIndexes).toEqual([6]);
    expect(result.acceptedTopicWriterDocuments).toEqual([]);
  });

  it("fails topic documents with unknown topic or source file nodes", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const topic = topicDocument({
      topicNodeId: "function:missing:UnknownTopic",
      sourceFileNodeId: "file:missing-source.ts",
      coveredNodeIds: ["function:src/service/feed.ts:BuildFeed"],
    });

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[0], tasks: [task] }] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [fileDocument(task)])],
      topicPlan: topicPlanFor([topic]),
      topicWriterOutputs: [topicOutput(6, [topic])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("topicNodeId does not exist in graph: function:missing:UnknownTopic"),
      expect.stringContaining("topic sourceFileNodeId does not exist in graph: file:missing-source.ts"),
    ]));
    expect(result.retryPlan.topicBatchIndexes).toEqual([6]);
    expect(result.acceptedTopicWriterDocuments).toEqual([]);
  });

  it("fails when a topic uses a file node as topicNodeId", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const topic = topicDocument({
      topicNodeId: "file:src/service/feed.ts",
      coveredNodeIds: ["file:src/service/feed.ts"],
    });

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[0], tasks: [task] }] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [fileDocument(task)])],
      topicPlan: topicPlanFor([topic]),
      topicWriterOutputs: [topicOutput(6, [topic])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("topicNodeId must not be a file node: file:src/service/feed.ts"),
    ]));
    expect(result.retryPlan.topicBatchIndexes).toEqual([6]);
    expect(result.acceptedTopicWriterDocuments).toEqual([]);
  });

  it("fails when sourceFileNodeId is not a file node", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const topic = topicDocument({
      sourceFileNodeId: "function:src/service/feed.ts:BuildFeed",
    });

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[0], tasks: [task] }] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [fileDocument(task)])],
      topicPlan: topicPlanFor([topic]),
      topicWriterOutputs: [topicOutput(6, [topic])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("topic sourceFileNodeId must refer to a file node: function:src/service/feed.ts:BuildFeed"),
    ]));
    expect(result.retryPlan.topicBatchIndexes).toEqual([6]);
    expect(result.acceptedTopicWriterDocuments).toEqual([]);
  });

  it("sorts accepted topic writer documents by path", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const later = topicDocument({
      topicNodeId: "function:src/service/feed.ts:BuildFeed",
      documentPath: "专题/z-later.md",
    });
    const earlier = topicDocument({
      topicNodeId: "class:src/service/feed.ts:FeedBuilder",
      documentPath: "专题/a-earlier.md",
      coveredNodeIds: ["class:src/service/feed.ts:FeedBuilder"],
    });

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[0], tasks: [task] }] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [fileDocument(task)])],
      topicPlan: topicPlanFor([later, earlier]),
      topicWriterOutputs: [topicOutput(2, [later, earlier])],
    });

    expect(result.validation.ok).toBe(true);
    expect(result.acceptedTopicWriterDocuments.map((topic) => topic.documentPath)).toEqual([
      "专题/a-earlier.md",
      "专题/z-later.md",
    ]);
  });

  it("fails and retries when a topic source file has no accepted file document", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const topic = topicDocument({ sourceFileNodeId: "file:src/missing.ts" });

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[0], tasks: [task] }] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [fileDocument(task)])],
      topicPlan: topicPlanFor([topic]),
      topicWriterOutputs: [topicOutput(2, [topic])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("topic source file document was not accepted: file:src/missing.ts"),
    ]));
    expect(result.retryPlan.topicBatchIndexes).toEqual([2]);
    expect(result.acceptedTopicWriterDocuments).toEqual([]);
  });

  it("requires topic plan context before accepting a topic writer document", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const topic = topicDocument();

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [fileDocument(task)])],
      topicWriterOutputs: [topicOutput(9, [topic])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toContain(`topic writer document has no planned topic: ${topic.topicNodeId}`);
    expect(result.retryPlan.topicBatchIndexes).toEqual([9]);
    expect(result.acceptedTopicWriterDocuments).toEqual([]);
  });

  it("retries and excludes a structurally valid file document that fails publication quality", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const document = fileDocument(task, {
      markdown: markdownFor(task).replace(
        "该文件读取 Feed 请求和候选集合，按明确顺序调用排序并构造包含项目和元数据的响应。",
        "承担核心逻辑。",
      ),
    });

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [document])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toContain(
      `file writer document failed publication quality: ${task.documentPath}: 正文包含空泛模板语句`,
    );
    expect(result.retryPlan.fileBatchIndexes).toEqual([task.batchIndex]);
    expect(result.acceptedFileWriterDocuments).toEqual([]);
  });

  it("retries and excludes a file document without its unique planned symbol anchor", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const missingAnchor = task.functionNodeIds[0].split(":").at(-1) ?? task.functionNodeIds[0];
    const document = fileDocument(task, {
      markdown: markdownFor(task).replace(`<a id="${missingAnchor}"></a>`, ""),
    });

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [document])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toContain(
      `file writer document failed publication quality: ${task.documentPath}: 文件正文缺少唯一符号锚点：${task.functionNodeIds[0]}`,
    );
    expect(result.acceptedFileWriterDocuments).toEqual([]);
  });

  it("accepts the new code template without legacy function-card and class-card sections", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const markdown = markdownFor(task).replace(
      /## 函数卡片[\s\S]*?(?=## 文件职责)/,
      "",
    );
    const document = fileDocument(task, { markdown });

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [document])],
    });

    expect(result.validation.ok).toBe(true);
    expect(result.acceptedFileWriterDocuments).toEqual([document]);
  });

  it("rejects file evidence whose excerpt does not match the planned source snapshot", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const document = fileDocument(task);
    document.sourceEvidence[0].excerpt = "invented source excerpt";

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [document])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toContain(
      `file writer evidence excerpt does not match source snapshot: ${task.fileNodeId}`,
    );
    expect(result.acceptedFileWriterDocuments).toEqual([]);
  });

  it("rejects topic evidence whose range or excerpt cannot be verified in a source snapshot", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const topic = topicDocument();
    topic.evidence[0] = { ...topic.evidence[0], lineRange: [99, 100], excerpt: "invented" };

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [fileDocument(task)])],
      topicPlan: topicPlanFor([topic]),
      topicWriterOutputs: [topicOutput(11, [topic])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toContain(
      `topic writer evidence range is outside source snapshot: ${topic.topicNodeId}`,
    );
    expect(result.acceptedTopicWriterDocuments).toEqual([]);
  });
});
