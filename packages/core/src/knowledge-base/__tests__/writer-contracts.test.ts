import { describe, expect, it } from "vitest";
import {
  FILE_WRITER_REQUIRED_SECTIONS,
  parseFileWriterBatchOutput,
  parseTopicWriterBatchOutput,
  TOPIC_WRITER_REQUIRED_SECTIONS,
} from "../index.js";

function completeFileMarkdown(): string {
  return [
    "# src/service/feed.ts",
    "",
    "## 文件职责",
    "Builds feed responses from candidate data.",
    "",
    "## 所属位置",
    "Service layer.",
    "",
    "## 文件内结构",
    "Contains feed construction functions and helper classes.",
    "",
    "## 函数卡片",
    "- `BuildFeed`: loads and ranks candidates.",
    "",
    "## 类卡片",
    "- `FeedBuilder`: coordinates feed assembly.",
    "",
    "## 调用关系",
    "- `BuildFeed` calls `LoadCandidates` and `rankCandidates`.",
    "",
    "## 风险点与待确认项",
    "- Ranking inputs are sensitive to missing candidate data.",
    "",
    "## AI 检索词",
    "- feed, ranking, service",
  ].join("\n");
}

function completeTopicMarkdown(): string {
  return [
    "# Feed ranking flow",
    "",
    "## 为什么关键",
    "This flow determines response ordering.",
    "",
    "## 在业务流程中的位置",
    "It runs after candidate loading and before response rendering.",
    "",
    "## 主要输入、输出、副作用",
    "Inputs are candidates and request context; output is an ordered feed.",
    "",
    "## 关键分支和算法",
    "The ranking branch applies local score adjustments.",
    "",
    "## 配置和外部依赖",
    "Uses ranking configuration and candidate storage.",
    "",
    "## 上游调用者",
    "- `HandleFeedRequest`",
    "",
    "## 下游调用对象",
    "- `LoadCandidates`",
    "",
    "## 修改风险",
    "- Score changes affect feed ordering.",
    "",
    "## 测试证据",
    "- Covered by feed ranking tests.",
    "",
    "## 代码证据",
    "- `src/service/feed.ts:30-90`",
    "",
    "## AI 检索词",
    "- feed, ranking, candidate",
  ].join("\n");
}

function completeFileOutput() {
  return {
    batchIndex: 1,
    documents: [
      {
        fileNodeId: "file:src/service/feed.ts",
        filePath: "src/service/feed.ts",
        documentPath: "文件文档/src-service-feed.ts.md",
        title: "src/service/feed.ts",
        coveredFunctionNodeIds: [
          "function:src/service/feed.ts:BuildFeed",
          "function:src/service/feed.ts:rankCandidates",
        ],
        coveredClassNodeIds: ["class:src/service/feed.ts:FeedBuilder"],
        representedEdgeIds: [
          "calls:function:src/service/feed.ts:BuildFeed->function:src/data/store.ts:LoadCandidates",
        ],
        sourceEvidence: [
          {
            filePath: "src/service/feed.ts",
            lineRange: [30, 90],
            nodeId: "function:src/service/feed.ts:BuildFeed",
          },
        ],
        importantNodeIds: ["function:src/service/feed.ts:BuildFeed"],
        markdown: completeFileMarkdown(),
      },
    ],
    warnings: [],
  };
}

function completeTopicOutput() {
  return {
    batchIndex: 2,
    topics: [
      {
        topicNodeId: "topic:feed-ranking",
        sourceFileNodeId: "file:src/service/feed.ts",
        documentPath: "主题文档/feed-ranking.md",
        title: "Feed ranking flow",
        coveredNodeIds: [
          "function:src/service/feed.ts:BuildFeed",
          "function:src/service/feed.ts:rankCandidates",
        ],
        linkedFileDocumentPath: "文件文档/src-service-feed.ts.md",
        evidence: [
          {
            filePath: "src/service/feed.ts",
            lineRange: [30, 120],
          },
        ],
        markdown: completeTopicMarkdown(),
      },
    ],
    warnings: [],
  };
}

describe("writer contracts", () => {
  it("accepts a complete file-writer batch output", () => {
    const result = parseFileWriterBatchOutput(completeFileOutput());

    expect(result).toEqual({
      ok: true,
      value: completeFileOutput(),
      errors: [],
    });
  });

  it.each(FILE_WRITER_REQUIRED_SECTIONS)("rejects missing required file document section %s", (section) => {
    const output = completeFileOutput();
    output.documents[0].markdown = output.documents[0].markdown.replace(section, `### ${section.slice(3)}`);

    const result = parseFileWriterBatchOutput(output);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(`documents[0].markdown missing required section: ${section}`);
  });

  it("rejects placeholder text in file-writer output", () => {
    const output = completeFileOutput();
    output.documents[0].markdown += "\nTODO";

    const result = parseFileWriterBatchOutput(output);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("documents[0].markdown contains placeholder text");
  });

  it("does not reject placeholder-like text in file paths or ids", () => {
    const output = completeFileOutput();
    output.documents[0].fileNodeId = "file:src/flags/FIXME_FLAG.ts";
    output.documents[0].filePath = "docs/TODO.md";
    output.documents[0].documentPath = "文件文档/TODO.md";

    const result = parseFileWriterBatchOutput(output);

    expect(result).toEqual({
      ok: true,
      value: output,
      errors: [],
    });
  });

  it("rejects invalid file-writer array fields", () => {
    const output = completeFileOutput() as Record<string, unknown>;
    output.warnings = "none";

    const result = parseFileWriterBatchOutput(output);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("warnings must be an array of strings");
  });

  it("rejects empty file-writer document arrays", () => {
    const output = completeFileOutput();
    output.documents = [];

    const result = parseFileWriterBatchOutput(output);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("documents must contain at least one document");
  });

  it("rejects non-object file source evidence items", () => {
    const output = completeFileOutput() as { documents: Array<Record<string, unknown>> };
    output.documents[0].sourceEvidence = [null];

    const result = parseFileWriterBatchOutput(output);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("documents[0].sourceEvidence[0] must be an object");
  });

  it("rejects invalid file source evidence line ranges", () => {
    const output = completeFileOutput() as { documents: Array<Record<string, unknown>> };
    output.documents[0].sourceEvidence = [{ filePath: "x", lineRange: ["bad"] }];

    const result = parseFileWriterBatchOutput(output);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("documents[0].sourceEvidence[0].lineRange must be a tuple of two finite numbers");
  });

  it("accepts a complete topic-writer batch output", () => {
    const result = parseTopicWriterBatchOutput(completeTopicOutput());

    expect(result).toEqual({
      ok: true,
      value: completeTopicOutput(),
      errors: [],
    });
  });

  it.each(TOPIC_WRITER_REQUIRED_SECTIONS)("rejects missing required topic document section %s", (section) => {
    const output = completeTopicOutput();
    output.topics[0].markdown = output.topics[0].markdown.replace(section, `### ${section.slice(3)}`);

    const result = parseTopicWriterBatchOutput(output);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(`topics[0].markdown missing required section: ${section}`);
  });

  it("rejects topic-writer outputs without evidence arrays", () => {
    const output = completeTopicOutput() as { topics: Array<Record<string, unknown>> };
    delete output.topics[0].evidence;

    const result = parseTopicWriterBatchOutput(output);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("topics[0].evidence must be an array");
  });

  it("rejects empty topic-writer topic arrays", () => {
    const output = completeTopicOutput();
    output.topics = [];

    const result = parseTopicWriterBatchOutput(output);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("topics must contain at least one topic");
  });

  it("rejects topic evidence with missing file paths", () => {
    const output = completeTopicOutput() as { topics: Array<Record<string, unknown>> };
    output.topics[0].evidence = [{}];

    const result = parseTopicWriterBatchOutput(output);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("topics[0].evidence[0].filePath must be a string");
  });

  it("rejects topic evidence with non-string file paths", () => {
    const output = completeTopicOutput() as { topics: Array<Record<string, unknown>> };
    output.topics[0].evidence = [{ filePath: 123 }];

    const result = parseTopicWriterBatchOutput(output);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("topics[0].evidence[0].filePath must be a string");
  });
});
