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
    "## 非技术同学速读",
    "这个文件负责把候选内容整理成最终的信息流响应。业务同学需要关注排序顺序、候选缺失时的兜底表现，以及结果是否会影响首页 Feed 的曝光。",
    "",
    "## 文件职责",
    "`src/service/feed.ts` 承接 Feed 请求的核心组装逻辑：先读取候选内容，再调用排序函数，最后由 `FeedBuilder` 汇总为响应对象。",
    "",
    "## 业务问题与影响对象",
    "- 业务问题: 候选内容很多时如何稳定输出可展示的 Feed 顺序。",
    "- 影响对象: 首页 Feed 用户、排序策略配置、候选内容召回结果和响应渲染链路。",
    "",
    "## 所属位置",
    "- 所在层级: service 层。",
    "- 上游入口: `HandleFeedRequest` 在收到请求后调用 `BuildFeed`。",
    "- 下游依赖: `LoadCandidates` 提供候选集合，`rankCandidates` 调整展示顺序。",
    "",
    "## 文件内结构",
    "- `BuildFeed` 是对外主函数，负责读取候选、排序并返回响应。",
    "- `rankCandidates` 是内部排序函数，负责按分数和请求上下文重排候选。",
    "- `FeedBuilder` 保存组装过程中的候选列表和响应元数据。",
    "",
    "## 关键规则、输入输出与兜底",
    "- 输入: 请求上下文、用户标识、候选内容集合。",
    "- 输出: 已排序的 Feed 响应和用于排查的排序元数据。",
    "- 兜底: 当候选为空时返回空列表但保留请求元数据，避免上游接口失败。",
    "",
    "## 函数卡片",
    "- `function:src/service/feed.ts:BuildFeed` - `BuildFeed` 读取候选内容，调用排序逻辑，并把排序后的候选交给 `FeedBuilder`。",
    "- `function:src/service/feed.ts:rankCandidates` - `rankCandidates` 按候选分数和请求上下文重排列表，是影响曝光顺序的关键函数。",
    "",
    "## 类卡片",
    "- `class:src/service/feed.ts:FeedBuilder` - `FeedBuilder` 负责保存组装状态，并输出包含 items 与 metadata 的响应对象。",
    "",
    "## 调用关系",
    "- `BuildFeed` -> `LoadCandidates`: 读取候选内容。",
    "- `BuildFeed` -> `rankCandidates`: 对候选进行排序。",
    "- `BuildFeed` -> `FeedBuilder.build`: 生成最终响应。",
    "",
    "## 风险点与待确认项",
    "- 排序字段缺失会改变 Feed 顺序，需要确认缺失分数时的默认值。",
    "- 候选为空时接口仍应返回成功响应，需要用调用方契约确认状态码。",
    "",
    "## 代码证据",
    "- `function:src/service/feed.ts:BuildFeed` 位于 `src/service/feed.ts:30-90`，覆盖读取候选、排序和响应构建。",
    "- `function:src/service/feed.ts:rankCandidates` 位于 `src/service/feed.ts:92-120`，覆盖排序规则。",
    "- `class:src/service/feed.ts:FeedBuilder` 位于 `src/service/feed.ts:122-180`，覆盖响应对象组装。",
    "",
    "## AI 检索词",
    "- Feed 排序, 候选内容, BuildFeed, rankCandidates, FeedBuilder, src/service/feed.ts",
  ].join("\n");
}

function completeTopicMarkdown(): string {
  return [
    "# Feed ranking flow",
    "",
    "## 非技术同学速读",
    "这个主题说明 Feed 排序链路如何把候选内容变成用户看到的顺序。业务侧最需要关注排序规则变化会直接影响内容曝光、点击率和问题排查口径。",
    "",
    "## 为什么关键",
    "Feed 排序链路决定候选内容最终展示顺序，是首页体验和内容分发效果的关键路径。",
    "",
    "## 在业务流程中的位置",
    "- 上游: 请求入口完成身份和上下文解析后进入候选加载。",
    "- 当前位置: `BuildFeed` 调用 `rankCandidates` 对候选进行排序。",
    "- 下游: 排序结果交给响应渲染层返回给客户端。",
    "",
    "## 主要输入、输出、副作用",
    "- 输入: 用户请求上下文、候选内容列表、候选分数。",
    "- 输出: 已排序的 Feed items 和排序元数据。",
    "- 副作用: 排序结果会影响曝光顺序，但不直接写入存储。",
    "",
    "## 关键分支和算法",
    "`rankCandidates` 优先使用候选分数排序；当分数相同，会保留原始候选顺序，降低结果抖动。",
    "",
    "## 配置和外部依赖",
    "- 候选数据来自 `LoadCandidates`。",
    "- 排序字段依赖候选对象中的 score，需要确认召回层是否始终提供该字段。",
    "",
    "## 上游调用者",
    "- `HandleFeedRequest` 在完成请求解析后调用 `BuildFeed`。",
    "",
    "## 下游调用对象",
    "- `LoadCandidates` 提供候选集合。",
    "- `FeedBuilder.build` 输出最终响应。",
    "",
    "## 修改风险",
    "- 修改分数比较方式会改变曝光顺序，需要同时检查业务指标和排序回归用例。",
    "- 修改空候选兜底会影响客户端空态展示。",
    "",
    "## 测试证据",
    "- 建议覆盖 `BuildFeed` 正常候选、空候选和同分候选三类用例。",
    "- 建议为 `rankCandidates` 增加稳定排序断言。",
    "",
    "## 代码证据",
    "- `function:src/service/feed.ts:BuildFeed` 位于 `src/service/feed.ts:30-120`，覆盖候选加载、排序和响应输出。",
    "- `function:src/service/feed.ts:rankCandidates` 位于 `src/service/feed.ts:92-120`，覆盖排序规则。",
    "",
    "## AI 检索词",
    "- Feed ranking, BuildFeed, rankCandidates, candidate score, src/service/feed.ts",
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

  it("rejects file documents that have headings but generic filler", () => {
    const output = completeFileOutput();
    output.documents[0].markdown = [
      "# src/service/feed.ts",
      "",
      ...FILE_WRITER_REQUIRED_SECTIONS.flatMap((section) => [
        section,
        "承担核心逻辑，处理相关能力。本地代码事实需要补充，未在图谱中识别。根据代码推断，需线上配置确认。",
        "",
      ]),
    ].join("\n");

    const result = parseFileWriterBatchOutput(output);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("documents[0].markdown has too much generic filler text");
    expect(result.errors).toContain("documents[0].markdown does not explain enough source evidence");
  });

  it("rejects file documents that omit covered function ids from function cards", () => {
    const output = completeFileOutput();
    output.documents[0].markdown = output.documents[0].markdown.replace(
      "`function:src/service/feed.ts:BuildFeed` - `BuildFeed`",
      "`BuildFeed`",
    );

    const result = parseFileWriterBatchOutput(output);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "documents[0].markdown missing covered function id: function:src/service/feed.ts:BuildFeed",
    );
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
