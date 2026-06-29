import { describe, expect, it } from "vitest";
import type {
  FileDocTask,
  FileWriterBatchOutput,
  FileWriterDocument,
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
      "src/service/feed.ts": "export function BuildFeed() { return new FeedBuilder(); }\nclass FeedBuilder {}\n",
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
  return [
    `# ${task.filePath}`,
    "",
    `文件节点: \`${task.fileNodeId}\``,
    "## 函数卡片",
    ...task.functionNodeIds.map((nodeId) => `- 节点 ID: \`${nodeId}\``),
    "## 类卡片",
    ...task.classNodeIds.map((nodeId) => `- 节点 ID: \`${nodeId}\``),
  ].join("\n");
}

function fileDocument(task: FileDocTask, overrides: Partial<FileWriterDocument> = {}): FileWriterDocument {
  return {
    fileNodeId: task.fileNodeId,
    filePath: task.filePath,
    documentPath: task.documentPath,
    title: `${task.filePath} 文件知识文档`,
    coveredFunctionNodeIds: [...task.functionNodeIds],
    coveredClassNodeIds: [...task.classNodeIds],
    representedEdgeIds: [...task.incomingEdgeIds, ...task.outgoingEdgeIds],
    sourceEvidence: [{ filePath: task.filePath, nodeId: task.fileNodeId }],
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
    evidence: [{ filePath: "src/service/feed.ts", nodeId: "function:src/service/feed.ts:BuildFeed" }],
    markdown: "# BuildFeed\n\n节点 ID: `function:src/service/feed.ts:BuildFeed`",
    ...overrides,
  };
}

function topicOutput(batchIndex: number, topics: TopicWriterDocument[]): TopicWriterBatchOutput {
  return { batchIndex, topics, warnings: [] };
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
    expect(result.fileDocuments).toEqual([
      expect.objectContaining({
        path: task.documentPath,
        title: `${task.filePath} 文件知识文档`,
        category: "file",
        coveredNodeIds: [task.fileNodeId, ...task.functionNodeIds, ...task.classNodeIds],
        content: markdownFor(task),
      }),
    ]);
    expect(result.topicDocuments).toEqual([
      expect.objectContaining({
        path: topic.documentPath,
        title: topic.title,
        category: "topic",
        coveredNodeIds: topic.coveredNodeIds,
        content: topic.markdown,
      }),
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
      expect.stringContaining(`function card missing markdown node id: ${task.functionNodeIds[0]}`),
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
      expect.stringContaining(`function card missing markdown node id: ${task.functionNodeIds[0]}`),
    ]));
    expect(result.acceptedFileWriterDocuments).toEqual([]);
    expect(result.retryPlan.fileBatchIndexes).toEqual([task.batchIndex]);
    expect(result.retryPlan.fileTerminalBatchIndexes).toEqual([]);
    expect(result.retryPlan.reasons).toEqual(expect.arrayContaining([
      expect.stringContaining(`function card missing coveredFunctionNodeIds entry: ${task.functionNodeIds[0]}`),
      expect.stringContaining(`function card missing markdown node id: ${task.functionNodeIds[0]}`),
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
      expect.stringContaining(`class card missing markdown node id: ${task.classNodeIds[0]}`),
    ]));
    expect(result.retryPlan.fileBatchIndexes).toEqual([task.batchIndex]);
    expect(result.acceptedFileWriterDocuments).toEqual([]);
  });

  it("fails when node ids appear outside their required card sections", () => {
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
      expect.stringContaining(`function card missing markdown node id in ## 函数卡片 section: ${task.functionNodeIds[0]}`),
      expect.stringContaining(`class card missing markdown node id in ## 类卡片 section: ${task.classNodeIds[0]}`),
    ]));
    expect(result.retryPlan.fileBatchIndexes).toEqual([task.batchIndex]);
    expect(result.acceptedFileWriterDocuments).toEqual([]);
  });

  it("fails when required function or class card sections are missing", () => {
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
      expect.stringContaining(`file writer document missing required section: ## 函数卡片`),
      expect.stringContaining(`file writer document missing required section: ## 类卡片`),
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
    expect(result.topicDocuments).toEqual([]);
  });

  it("fails topic documents that cover unknown graph nodes", () => {
    const { profile, fileDocPlan } = fixture();
    const task = existingTask();
    const topic = topicDocument({ coveredNodeIds: ["function:src/service/feed.ts:BuildFeed", "function:missing:Unknown"] });

    const result = mergeKnowledgeBaseWriterOutputs({
      profile,
      fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[0], tasks: [task] }] },
      fileWriterOutputs: [fileOutput(task.batchIndex, [fileDocument(task)])],
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
      topicWriterOutputs: [topicOutput(6, [topic])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("topicNodeId must not be a file node: file:src/service/feed.ts"),
    ]));
    expect(result.retryPlan.topicBatchIndexes).toEqual([6]);
    expect(result.acceptedTopicWriterDocuments).toEqual([]);
    expect(result.topicDocuments).toEqual([]);
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
      topicWriterOutputs: [topicOutput(6, [topic])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("topic sourceFileNodeId must refer to a file node: function:src/service/feed.ts:BuildFeed"),
    ]));
    expect(result.retryPlan.topicBatchIndexes).toEqual([6]);
    expect(result.acceptedTopicWriterDocuments).toEqual([]);
    expect(result.topicDocuments).toEqual([]);
  });

  it("sorts accepted topic writer documents and generated topic documents by path", () => {
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
      topicWriterOutputs: [topicOutput(2, [later, earlier])],
    });

    expect(result.validation.ok).toBe(true);
    expect(result.acceptedTopicWriterDocuments.map((topic) => topic.documentPath)).toEqual([
      "专题/a-earlier.md",
      "专题/z-later.md",
    ]);
    expect(result.topicDocuments.map((topic) => topic.path)).toEqual([
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
      topicWriterOutputs: [topicOutput(2, [topic])],
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("topic source file document was not accepted: file:src/missing.ts"),
    ]));
    expect(result.retryPlan.topicBatchIndexes).toEqual([2]);
    expect(result.acceptedTopicWriterDocuments).toEqual([]);
    expect(result.topicDocuments).toEqual([]);
  });
});
