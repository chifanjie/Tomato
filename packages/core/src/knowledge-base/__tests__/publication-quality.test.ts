import { describe, expect, it } from "vitest";
import {
  evaluatePublication,
  evaluatePublicationCorpus,
  type PublicationDocument,
  type PublicationEvidence,
} from "../publication-quality.js";

const FILE_SECTIONS = [
  "文件职责",
  "输入、输出与关键字段",
  "规则、分支与状态变化",
  "配置、依赖与副作用",
  "异常、测试与改动风险",
  "函数与类型",
  "源码证据",
];

const TOPIC_SECTIONS = [
  "为什么关键",
  "完整条件与跳过规则",
  "输入输出与状态变化",
  "算法、分支与降级",
  "依赖、测试与可观测性",
  "源码证据",
];

function markdown(title: string, sections: readonly string[], sentence: string): string {
  return [
    `# ${title}`,
    "",
    ...sections.flatMap((section, index) => [
      `## ${section}`,
      `${sentence} 第${index + 1}部分说明实际触发条件、字段变化、异常处理以及对应代码结论。`,
      "",
    ]),
  ].join("\n");
}

function fileDocument(overrides: Partial<PublicationDocument> = {}): PublicationDocument {
  return {
    path: "文件文档/src-a.ts.md",
    title: "src/a.ts",
    category: "file",
    role: "reference",
    referenceKind: "code",
    content: [
      "# src/a.ts",
      "",
      "## 文件职责",
      "接收请求、调用策略并返回结构化结果。",
      "",
      "## 输入、输出与关键字段",
      "读取 `ctx.userId`，输出 `result.items`，并保持请求标识不变。",
      "",
      "## 规则、分支与状态变化",
      "当配置缺失时返回空列表，并记录本次执行进入降级状态。",
      "",
      "## 配置、依赖与副作用",
      "读取 `config/rule.json`，调用策略组件，不写持久化存储。",
      "",
      "## 异常、测试与改动风险",
      "空输入测试覆盖降级分支；修改返回字段会影响入口调用方。",
      "",
      "## 函数与类型",
      '<a id="run"></a>',
      "`run` 执行入口校验、策略调用和结果返回。",
      "",
      "## 源码证据",
      "`src/a.ts:1-5` 对应入口、字段读取和降级返回。",
    ].join("\n"),
    directNodeIds: ["file:src/a.ts", "function:src/a.ts:run"],
    representedEdgeIds: ["calls:function:src/a.ts:run->function:src/b.ts:apply"],
    symbolAnchors: [{ nodeId: "function:src/a.ts:run", anchor: "run" }],
    ...overrides,
  };
}

function evidence(
  nodeId: string,
  filePath: string,
  lineRange: [number, number],
  claim: string,
): PublicationEvidence {
  return {
    nodeId,
    filePath,
    lineRange,
    excerpt: "export function run() { return []; }",
    claim,
  };
}

const FILE_EVIDENCE: PublicationEvidence[] = [
  evidence("file:src/a.ts", "src/a.ts", [1, 5], "该文件提供运行入口并返回结构化结果。"),
  evidence("function:src/a.ts:run", "src/a.ts", [1, 5], "运行函数负责入口校验和降级返回。"),
];

describe("publication quality", () => {
  it("rejects a pseudo-flow with generic prose and no evidence", () => {
    const document: PublicationDocument = {
      path: "业务流程/run.md",
      title: "run 流程",
      category: "flow",
      role: "featured",
      content: "# run\n\n## 目标与触发\n承担核心逻辑。",
      directNodeIds: ["function:src/a.ts:run"],
      representedEdgeIds: [],
      symbolAnchors: [],
    };

    const result = evaluatePublication(document, []);

    expect(result).toEqual({
      quality: "failed",
      publishAsFeatured: false,
      issues: expect.arrayContaining([
        "流程缺少至少三个可验证阶段",
        "正文包含空泛模板语句",
        "正文缺少有效源码证据",
      ]),
    });
  });

  it("accepts a Chinese file reference with exact evidence for the file and every symbol", () => {
    const result = evaluatePublication(fileDocument(), FILE_EVIDENCE);

    expect(result).toEqual({
      quality: "generated",
      publishAsFeatured: false,
      issues: [],
    });
  });

  it("requires every category-specific level-two section", () => {
    const document = fileDocument({
      content: fileDocument().content.replace("## 异常、测试与改动风险", "### 异常、测试与改动风险"),
    });

    expect(evaluatePublication(document, FILE_EVIDENCE).issues).toContain(
      "正文缺少必需章节：异常、测试与改动风险",
    );
  });

  it("requires exact evidence for each directly explained node", () => {
    const result = evaluatePublication(fileDocument(), FILE_EVIDENCE.slice(0, 1));

    expect(result.quality).toBe("failed");
    expect(result.issues).toContain(
      "源码证据未覆盖直接讲解节点：function:src/a.ts:run",
    );
  });

  it("rejects meta-claims while keeping concrete short evidence claims valid", () => {
    const metaClaims = [
      "节点支持页面中与该源码位置相邻的结论。",
      "该源码仅支持本页相关结论。",
      "该摘录支持本页独立结论。",
      "该源码位置只用于支持相关结论。",
      "该源码可仅用于支持本页相关结论。",
      "该代码能仅用于证明本文独立结论。",
      "源码中的“run”支持本页对该符号职责、输入输出和风险的说明。",
      "该源码摘录证明“BuildFeed 关键函数专题”直接讲解的主题入口。",
      "该源码摘录支持“BuildFeed 关键函数专题”中的依赖、输入输出或状态变化结论。",
      "该源码支撑“BuildFeed”页面中的职责说明。",
      "该摘录表明本文关于“BuildFeed”的相关结论。",
      "该代码说明“BuildFeed”直接讲解的主题入口。",
      "该证据佐证“BuildFeed”页面中的风险说明。",
    ];

    for (const claim of metaClaims) {
      const result = evaluatePublication(
        fileDocument(),
        FILE_EVIDENCE.map((item) => ({ ...item, claim })),
      );
      expect(result.quality).toBe("failed");
      expect(result.issues).toEqual(expect.arrayContaining([
        "正文缺少有效源码证据",
        "源码证据未覆盖直接讲解节点：file:src/a.ts",
        "源码证据未覆盖直接讲解节点：function:src/a.ts:run",
      ]));
    }

    const concrete = FILE_EVIDENCE.map((item, index) => ({
      ...item,
      claim: index === 0 ? "源码表明登录页面加载失败时返回重试提示。" : "运行函数在空输入时返回空列表。",
    }));
    expect(evaluatePublication(fileDocument(), concrete).quality).toBe("generated");
  });

  it("requires three distinct evidence groups for a topic", () => {
    const document: PublicationDocument = {
      path: "关键专题/run.md",
      title: "运行规则",
      category: "topic",
      role: "featured",
      content: markdown("运行规则", TOPIC_SECTIONS, "请求满足开关条件后读取候选并执行过滤，失败时保留原始结果。"),
      directNodeIds: ["function:src/a.ts:run"],
      representedEdgeIds: [],
      symbolAnchors: [],
    };
    const repeated = [
      evidence(document.directNodeIds[0], "src/a.ts", [1, 5], "运行函数读取请求并执行过滤。"),
      evidence(document.directNodeIds[0], "src/a.ts", [1, 5], "运行函数在失败时保留原始结果。"),
      evidence(document.directNodeIds[0], "src/a.ts", [1, 5], "运行函数返回处理后的候选集合。"),
    ];

    expect(evaluatePublication(document, repeated).issues).toContain(
      "源码证据数量不足：至少需要 3 组",
    );
  });

  it("requires three stages and two behavior edges for a flow", () => {
    const flowSections = [
      "目标与触发",
      "排除条件",
      "执行阶段",
      "规则、分支与数据变化",
      "异常、回退与可观测性",
      "源码证据",
    ];
    const document: PublicationDocument = {
      path: "业务流程/run.md",
      title: "运行流程",
      category: "flow",
      role: "featured",
      content: markdown("运行流程", flowSections, "请求经过入口校验、候选处理和结果返回三个阶段，并记录失败分支。"),
      directNodeIds: ["step:one", "step:two", "step:three"],
      representedEdgeIds: ["calls:step:one->step:two"],
      symbolAnchors: [],
    };
    const records = document.directNodeIds.map((nodeId, index) =>
      evidence(nodeId, `src/step-${index}.ts`, [1, 5], `第${index + 1}阶段执行实际校验并传递结果。`),
    );

    expect(evaluatePublication(document, records).issues).toContain(
      "流程缺少至少两个可验证行为关系",
    );
  });

  it("requires every file symbol anchor exactly once", () => {
    const duplicate = fileDocument({
      content: `${fileDocument().content}\n<a id="run"></a>`,
    });

    expect(evaluatePublication(duplicate, FILE_EVIDENCE).issues).toContain(
      "文件正文缺少唯一符号锚点：function:src/a.ts:run",
    );
  });

  it("marks only short otherwise-valid references as needs-review", () => {
    const short = fileDocument({
      directNodeIds: [],
      symbolAnchors: [],
      content: ["# 短文档", ...FILE_SECTIONS.flatMap((section) => ["", `## ${section}`, "说明。"])] .join("\n"),
    });

    expect(evaluatePublication(short, FILE_EVIDENCE.slice(0, 1))).toEqual({
      quality: "needs-review",
      publishAsFeatured: false,
      issues: ["正文有效中文内容不足"],
    });
  });

  it("blocks Traditional-only prose outside code", () => {
    const document = fileDocument({
      content: fileDocument().content.replace("接收请求", "接收請求後處理這麼多內容"),
    });

    expect(evaluatePublication(document, FILE_EVIDENCE).issues).toContain(
      "正文包含非简体中文用字",
    );
  });

  it("never upgrades a successful automatic document to verified", () => {
    expect(evaluatePublication(fileDocument(), FILE_EVIDENCE).quality).toBe("generated");
  });

  it("fails repeated long template prose once at corpus level", () => {
    const repeatedLine = "请求进入系统以后依次完成参数校验、策略选择、结果组装、异常记录并输出审计结果。";
    const entries = Array.from({ length: 5 }, (_, index) => ({
      document: fileDocument({
        path: `文件文档/src-${index}.ts.md`,
        title: `src/${index}.ts`,
        content: `${fileDocument().content}\n${repeatedLine}`,
      }),
      evidence: FILE_EVIDENCE,
    }));

    const results = evaluatePublicationCorpus(entries);

    expect(results).toHaveLength(5);
    for (const result of results) {
      expect(result.decision.quality).toBe("failed");
      expect(result.decision.issues.filter((issue) => issue === "正文包含跨文档重复模板语句")).toHaveLength(1);
    }
  });

  it("does not count repeated lines inside multiline inline-code excerpts as prose boilerplate", () => {
    const entries = Array.from({ length: 5 }, (_, index) => ({
      document: {
        path: `文件文档/source-${index}.md`,
        title: `源码页面 ${index}`,
        category: "other" as const,
        role: "reference" as const,
        content: [
          `# 源码页面 ${index}`,
          "",
          "## 说明",
          `页面 ${index} 记录独立的中文结论、边界、输入输出和改动风险，内容足以通过引用页面长度检查。`,
          "",
          "## 摘录",
          "源码摘录：`export function shared() {",
          "  return repeatedImplementationLine;",
          "}`",
        ].join("\n"),
        directNodeIds: [],
        representedEdgeIds: [],
        symbolAnchors: [],
      },
      evidence: [{
        nodeId: `file:src/source-${index}.ts`,
        filePath: `src/source-${index}.ts`,
        lineRange: [1, 3] as [number, number],
        excerpt: "export function shared() {\n  return repeatedImplementationLine;\n}",
        claim: `源码范围“src/source-${index}.ts:1-3”记录 shared 函数返回重复实现标记。`,
      }],
    }));

    const results = evaluatePublicationCorpus(entries);

    expect(results.every((result) => !result.decision.issues.includes("正文包含跨文档重复模板语句"))).toBe(true);
  });
});
