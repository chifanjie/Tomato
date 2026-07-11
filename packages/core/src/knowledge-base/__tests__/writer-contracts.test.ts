import { describe, expect, it } from "vitest";
import {
  FILE_WRITER_REQUIRED_SECTIONS,
  containsPlaceholderProse,
  parseFileWriterBatchOutput,
  parseTopicWriterBatchOutput,
  summarizeMarkdownQuality,
  TOPIC_WRITER_REQUIRED_SECTIONS,
  validateMarkdownQuality,
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
    "## 入口条件与处理顺序",
    "- 入口条件: `HandleFeedRequest` 已解析用户标识和请求上下文后调用 `BuildFeed`。",
    "- 处理顺序: `BuildFeed` 先调用 `LoadCandidates`，再调用 `rankCandidates`，最后由 `FeedBuilder.build` 生成响应；该顺序来自源码调用证据。",
    "",
    "## 字段读写与状态变化",
    "- 读取: request.userId、请求上下文和候选对象的 score 字段。",
    "- 写入: `FeedBuilder` 写入 items 与 metadata；当前没有数据库 writes_to 关系。",
    "- 状态变化: candidates 从未排序列表转换为稳定排序后的 Feed items，空候选保持为空列表。",
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
    "## 证据分级",
    "- 本地代码事实: 函数节点、类节点、源码行号和 calls 边可直接核对。",
    "- 代码推断: 排序变化会影响曝光顺序由函数职责和返回对象归纳。",
    "- 外部待核验: 线上 score 配置、流量比例和业务指标需要配置平台确认。",
    "",
    "## 待核验清单",
    "- [ ] 核对 score 缺失时的默认值和同分稳定排序行为。",
    "- [ ] 核对空候选响应状态码以及线上排序配置。",
    "",
    "## 代码证据",
    "- `function:src/service/feed.ts:BuildFeed` 位于 `src/service/feed.ts:30-90`，覆盖读取候选、排序和响应构建。",
    "- `function:src/service/feed.ts:rankCandidates` 位于 `src/service/feed.ts:92-120`，覆盖排序规则。",
    "- `class:src/service/feed.ts:FeedBuilder` 位于 `src/service/feed.ts:122-180`，覆盖响应对象组装。",
    "",
    "## AI 检索索引",
    "| 检索意图 | 关键词 | 定位 |",
    "|---|---|---|",
    "| 理解 Feed 组装 | BuildFeed, FeedBuilder, src/service/feed.ts | 文件职责、函数卡片 |",
    "| 核对排序状态 | rankCandidates, score, candidates | 字段读写与状态变化、代码证据 |",
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
    "## 入口条件与处理顺序",
    "- 入口条件: 请求入口完成用户身份和上下文解析后调用 `BuildFeed`。",
    "- 处理顺序: `BuildFeed` 读取候选、调用 `rankCandidates`，再构建响应；严格先后由源码调用和同步返回证据支持。",
    "",
    "## 字段读写与状态变化",
    "- 读取: request.userId、candidate.score 和候选原始顺序。",
    "- 写入: Feed items 与排序 metadata；当前没有持久化 writes_to 关系。",
    "- 状态变化: candidates 从召回顺序转换为按 score 排序的结果，同分项保持原始相对顺序。",
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
    "## 证据分级",
    "- 本地代码事实: BuildFeed、rankCandidates、源码行号和 calls 关系可直接核对。",
    "- 代码推断: 排序结果影响曝光由返回 Feed items 的使用方式归纳。",
    "- 外部待核验: score 生产口径、线上权重和指标影响需配置与数据平台确认。",
    "",
    "## 待核验清单",
    "- [ ] 核对 score 缺失、同分和空候选分支的测试结果。",
    "- [ ] 核对线上排序权重与源码默认值是否一致。",
    "",
    "## 代码证据",
    "- `function:src/service/feed.ts:BuildFeed` 位于 `src/service/feed.ts:30-120`，覆盖候选加载、排序和响应输出。",
    "- `function:src/service/feed.ts:rankCandidates` 位于 `src/service/feed.ts:92-120`，覆盖排序规则。",
    "",
    "## AI 检索索引",
    "| 检索意图 | 关键词 | 定位 |",
    "|---|---|---|",
    "| 追踪排序入口 | BuildFeed, HandleFeedRequest | 入口条件与处理顺序 |",
    "| 核对排序字段 | rankCandidates, candidate.score | 字段读写与状态变化、代码证据 |",
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
        referenceKind: "code",
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

  it("rejects file documents that keep the headings but omit structured verification and retrieval fields", () => {
    const output = completeFileOutput();
    output.documents[0].markdown = output.documents[0].markdown
      .replace(/- \[ \]/g, "- [x]")
      .replace("| 检索意图 | 关键词 | 定位 |", "| 关键词 | 说明 |");

    const result = parseFileWriterBatchOutput(output);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "documents[0].markdown section ## 待核验清单 must contain at least one unchecked verification item",
    );
    expect(result.errors).toContain(
      "documents[0].markdown section ## AI 检索索引 missing required column: 检索意图",
    );
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

  it("rejects missing or unknown file reference kinds", () => {
    const missing = completeFileOutput() as { documents: Array<Record<string, unknown>> };
    delete missing.documents[0].referenceKind;
    const unknown = completeFileOutput();
    unknown.documents[0].referenceKind = "unknown";

    expect(parseFileWriterBatchOutput(missing).errors).toContain(
      "documents[0].referenceKind must be one of: code, configuration, schema, documentation, test",
    );
    expect(parseFileWriterBatchOutput(unknown).errors).toContain(
      "documents[0].referenceKind must be one of: code, configuration, schema, documentation, test",
    );
  });

  it("ignores placeholder tokens in code while keeping prose and headings invalid", () => {
    expect(containsPlaceholderProse("## 代码证据\n\n- 行内：`TODO`\n\n```ts\nconst FIXME = true;\n```"))
      .toBe(false);
    expect(containsPlaceholderProse("## TODO\n\n这里是正文说明。"))
      .toBe(true);
    expect(containsPlaceholderProse("## 待核验\n\nTODO：补充真实业务结论。"))
      .toBe(true);
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

  it("rejects blank required section bodies", () => {
    const output = completeFileOutput();
    output.documents[0].markdown = output.documents[0].markdown.replace(
      "## 文件职责\n`src/service/feed.ts` 承接 Feed 请求的核心组装逻辑：先读取候选内容，再调用排序函数，最后由 `FeedBuilder` 汇总为响应对象。",
      "## 文件职责\n",
    );

    const result = parseFileWriterBatchOutput(output);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("documents[0].markdown section has too little detail: ## 文件职责");
  });

  it("rejects repeated low-variety generic filler", () => {
    const output = completeFileOutput();
    output.documents[0].markdown = [
      "# src/service/feed.ts",
      "",
      ...FILE_WRITER_REQUIRED_SECTIONS.flatMap((section) => [
        section,
        "承担核心逻辑，处理相关能力。承担核心逻辑，处理相关能力。承担核心逻辑，处理相关能力。",
        "",
      ]),
    ].join("\n");

    const result = parseFileWriterBatchOutput(output);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("documents[0].markdown has too much generic filler text");
  });

  it("accepts file-path-only source evidence explanations", () => {
    const output = completeFileOutput();
    output.documents[0].markdown = output.documents[0].markdown.replace(
      "- `function:src/service/feed.ts:BuildFeed` 位于 `src/service/feed.ts:30-90`，覆盖读取候选、排序和响应构建。",
      "- `src/service/feed.ts` 覆盖读取候选、排序和响应构建。",
    );

    const result = parseFileWriterBatchOutput(output);

    expect(result).toEqual({
      ok: true,
      value: output,
      errors: [],
    });
  });

  it("accepts backticked file path with line evidence explanations", () => {
    const output = completeFileOutput();
    output.documents[0].markdown = output.documents[0].markdown.replace(
      "- `function:src/service/feed.ts:BuildFeed` 位于 `src/service/feed.ts:30-90`，覆盖读取候选、排序和响应构建。",
      "- `src/service/feed.ts`:30-90 覆盖读取候选、排序和响应构建。",
    );

    const result = parseFileWriterBatchOutput(output);

    expect(result).toEqual({
      ok: true,
      value: output,
      errors: [],
    });
  });

  it("rejects source evidence sections that only name a file without explanation", () => {
    const output = completeFileOutput();
    output.documents[0].markdown = output.documents[0].markdown.replace(
      /## 代码证据\n[\s\S]*?\n\n## AI 检索索引/,
      "## 代码证据\n- `src/service/feed.ts`\n\n## AI 检索索引",
    );

    const result = parseFileWriterBatchOutput(output);

    expect(result.ok).toBe(false);
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

  it("rejects topic documents without explicit read/write/state and evidence-grade fields", () => {
    const output = completeTopicOutput();
    output.topics[0].markdown = output.topics[0].markdown
      .replace("- 写入: Feed items 与排序 metadata；当前没有持久化 writes_to 关系。", "- 变更结果对象。")
      .replace("- 外部待核验: score 生产口径、线上权重和指标影响需配置与数据平台确认。", "- 线上信息需确认。");

    const result = parseTopicWriterBatchOutput(output);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "topics[0].markdown section ## 字段读写与状态变化 missing required field: 写入",
    );
    expect(result.errors).toContain(
      "topics[0].markdown section ## 证据分级 missing required field: 外部待核验",
    );
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

  it("summarizes generated document quality from content fields", () => {
    const summary = summarizeMarkdownQuality([
      {
        path: "主题文档/feed-ranking.md",
        content: completeTopicMarkdown(),
        sections: TOPIC_WRITER_REQUIRED_SECTIONS,
        sourceEvidenceRefs: ["src/service/feed.ts"],
      },
      {
        path: "主题文档/thin.md",
        content: [
          "# Thin topic",
          "",
          ...TOPIC_WRITER_REQUIRED_SECTIONS.flatMap((section) => [
            section,
            section === "## 代码证据" ? "`src/service/feed.ts`" : "承担核心逻辑，处理相关能力。",
            "",
          ]),
        ].join("\n"),
        sections: TOPIC_WRITER_REQUIRED_SECTIONS,
        sourceEvidenceRefs: ["src/service/feed.ts"],
      },
    ]);

    expect(summary.checked).toBe(2);
    expect(summary.failed).toEqual(["主题文档/thin.md"]);
    expect(summary.warnings).toContain("document has generic filler text: 主题文档/thin.md");
    expect(summary.warnings).toContain("document failed quality validation: 主题文档/thin.md");
  });

  it("summarizes generated document quality by inferring markdown sections", () => {
    const summary = summarizeMarkdownQuality([
      {
        path: "generated/thin.md",
        content: [
          "# Generated thin document",
          "",
          "## 非技术同学速读",
          "这段内容足够说明给非技术同学阅读的重点。",
          "",
          "## 空章节",
          "",
          "## 代码证据",
          "`src/service/feed.ts` 覆盖排序流程和候选响应构建。",
        ].join("\n"),
        sourceEvidenceRefs: ["src/service/feed.ts"],
      },
    ]);

    expect(summary.checked).toBe(1);
    expect(summary.failed).toEqual(["generated/thin.md"]);
    expect(summary.warnings).toContain("document failed quality validation: generated/thin.md");
  });

  it("summarizes empty and title-only generated documents as failed quality validation", () => {
    const summary = summarizeMarkdownQuality([
      { path: "generated/empty.md", content: "" },
      { path: "generated/title-only.md", content: "# Title only" },
    ]);

    expect(summary.checked).toBe(2);
    expect(summary.failed).toEqual(["generated/empty.md", "generated/title-only.md"]);
    expect(summary.warnings).toContain("document failed quality validation: generated/empty.md");
    expect(summary.warnings).toContain("document failed quality validation: generated/title-only.md");
  });

  it("rejects observed template prose even when every section is non-empty", () => {
    const errors = validateMarkdownQuality(
      [
        "# 模板专题",
        "",
        "## 说明",
        "该函数承担该文件中的一段核心逻辑，接收上游传入的业务上下文。",
        "它与同文件内的协作单元配合，主要把处理结果返回给调用方。",
        "候选数据为空、配置缺失时，需要重点检查条件分支、排序或过滤规则。",
      ].join("\n"),
      { path: "generated/template.md", sections: ["## 说明"] },
    );

    expect(errors).toContain("generated/template.md has too much generic filler text");
  });

  it("rejects section bodies that only barely clear the former minimum length", () => {
    const errors = validateMarkdownQuality(
      `# 过短页面\n\n## 说明\n${"说明".repeat(7)}`,
      { path: "generated/short.md", sections: ["## 说明"] },
    );

    expect(errors).toContain("generated/short.md section has too little detail: ## 说明");
  });

  it("allows required evidence labels when they accompany concrete facts", () => {
    const errors = validateMarkdownQuality(
      [
        "# 证据分级页面",
        "",
        "## 说明",
        "本地代码事实：`src/handler.ts:18` 先校验 request.userId，再调用 loadProfile。",
        "代码推断：缓存命中会减少下游读取；根据代码推断，需线上配置确认缓存 TTL。",
      ].join("\n"),
      { path: "generated/evidence-labels.md", sections: ["## 说明"] },
    );

    expect(errors).toEqual([]);
  });

  it("flags documents that repeat several long boilerplate lines across the corpus", () => {
    const sharedLines = [
      "这一段在大量页面中完全重复，只说明需要检查输入输出和上下游关系是否仍然成立。",
      "这一段同样没有结合当前对象，只笼统提醒关注配置、默认值、异常路径和发布风险。",
      "这一段仍然属于通用建议，没有给出当前页面独有的规则、关键数据、实际副作用或证据。",
    ];
    const documents = Array.from({ length: 6 }, (_, index) => ({
      path: `generated/repeated-${index + 1}.md`,
      content: [
        `# 重复页面 ${index + 1}`,
        "",
        "## 说明",
        ...sharedLines,
        `- 页面独有标记：对象 ${index + 1}。`,
      ].join("\n"),
    }));

    const summary = summarizeMarkdownQuality(documents);

    expect(summary.failed).toEqual(documents.map((document) => document.path));
    expect(summary.warnings).toContain(
      "document repeats 3 boilerplate lines across corpus: generated/repeated-1.md",
    );
  });
});
