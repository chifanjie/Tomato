import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "../../types.js";
import { buildKnowledgeArtifacts, type KnowledgeArtifactInput } from "../artifacts.js";
import { validateKnowledgeArtifactSetV2 } from "../artifact-verifier.js";

const generatedAt = "2026-07-13T00:00:00.000Z";
const sourceRootIdentity = "/workspace/demo";
const input: KnowledgeArtifactInput = {
  projectName: "demo",
  generatedAt,
  outputLanguage: "zh-CN",
  generationMode: "writer",
  graphDigest: "digest-1",
  gitCommitHash: "commit-1",
  sourceRootIdentity,
  sourceRead: { covered: 1, total: 1, missingIds: [] },
  requiredRouteStages: ["purpose"],
  businessTerms: ["任务调度"],
  nodes: [
    { id: "file:src/run.ts", type: "file", name: "run.ts", filePath: "src/run.ts" },
    { id: "function:src/run.ts:run", type: "function", name: "run", filePath: "src/run.ts" },
  ],
  referenceFileNodeIds: ["file:src/run.ts"],
  documents: [
    {
      id: "page:overview", path: "项目总览.md", title: "项目总览", summary: "任务调度的入口与执行链路。",
      category: "overview", role: "featured", directNodeIds: ["function:src/run.ts:run"], contextNodeIds: ["file:src/run.ts"],
      symbolAnchors: [], route: { order: 0, stage: "purpose" }, representedEdgeIds: [], reason: "overview",
      content: "", searchTerms: ["任务调度"], quality: "generated", generationStatus: "complete", qualityIssues: [],
      sourceEvidence: [{ filePath: "src/run.ts", lineRange: [1, 8], nodeId: "function:src/run.ts:run", excerpt: "export function run() {}", claim: "run 是任务调度入口。" }],
    },
    {
      id: "page:file", path: "文件文档/src-run.ts.md", title: "src/run.ts", summary: "任务调度入口源码参考。",
      category: "file", role: "reference", directNodeIds: ["file:src/run.ts", "function:src/run.ts:run"], contextNodeIds: [],
      symbolAnchors: [{ nodeId: "function:src/run.ts:run", anchor: "run" }], representedEdgeIds: [], reason: "reference",
      content: "", searchTerms: ["run", "src/run.ts"], quality: "generated", generationStatus: "complete", qualityIssues: [],
      sourceEvidence: [
        { filePath: "src/run.ts", lineRange: [1, 8], nodeId: "file:src/run.ts", excerpt: "export function run() {}", claim: "文件定义任务调度入口。" },
        { filePath: "src/run.ts", lineRange: [1, 8], nodeId: "function:src/run.ts:run", excerpt: "export function run() {}", claim: "run 执行任务调度。" },
      ],
    },
  ],
  warnings: [], errors: [],
};

const graph: KnowledgeGraph = {
  version: "2", project: { name: "demo", languages: ["TypeScript"], frameworks: [], description: "demo", analyzedAt: generatedAt, gitCommitHash: "commit-1" },
  nodes: input.nodes.map((node) => ({ ...node, type: node.type as "file" | "function", summary: node.name, tags: [], complexity: "simple" })),
  edges: [], layers: [], tour: [],
};

function richOverview(): string {
  return `# 项目总览\n\n## 业务目标\n\n任务调度负责接收调用、确认输入、选择执行路径并返回结果。阅读者先从这里理解系统为什么存在，再进入实现细节。本文把业务目的、关键步骤和异常边界放在同一条阅读路径中，避免只看到文件名却不知道职责。它同时说明每个步骤由谁负责、输入从哪里来、结果交给谁，以及失败时应该观察哪些信号，使第一次接触项目的人可以建立完整心智模型。\n\n## 执行链路\n\n入口函数读取请求后完成校验，再交给执行模块处理。成功路径返回结果，失败路径保留可定位的错误信息。源码证据位于 \`src/run.ts\`，其中 \`run\` 是可搜索、可跳转的实现入口。调用者不需要理解所有底层细节，也能沿着页面中的节点关系继续查看依赖、实现与测试。文档和图谱共享同一套标识，所以从业务描述进入代码或从代码返回说明时不会失去上下文。\n\n## 维护提示\n\n修改入口时应同步检查调用方、测试和文档映射，确认图谱中的直接关系仍然成立。新增分支时要补充对应证据和异常说明，删除能力时则应移除失效入口，避免目录继续展示没有实质意义的页面。发布前还要确认搜索可以用业务词、文件名和函数名命中同一内容，并检查主干路线能够在少量操作内到达源码。`;
}

function richReference(): string {
  return `# src/run.ts\n\n## 文件职责\n\n该文件承载任务调度入口，连接外部调用与内部执行流程。\n\n## 源码证据\n\n实现位于 \`src/run.ts\`，函数锚点如下。阅读此处可以直接回到对应源码，而不是依赖抽象描述。\n\n<a id="run"></a>\n\n### run`;
}

function validSet() {
  const artifacts = buildKnowledgeArtifacts(input);
  return {
    graph,
    ...artifacts,
    markdownByPath: new Map([
      ["knowledge-base/项目总览.md", richOverview()],
      ["knowledge-base/文件文档/src-run.ts.md", richReference()],
    ]),
    expected: { outputLanguage: "zh-CN" as const, generationMode: "writer" as const, sourceRootIdentity, graphDigest: "digest-1", gitCommitHash: "commit-1" },
  };
}

describe("validateKnowledgeArtifactSetV2", () => {
  it("accepts a complete writer artifact set with rich Chinese content", () => {
    expect(validateKnowledgeArtifactSetV2(validSet())).toEqual({ ok: true, errors: [] });
  });

  it("ignores placeholder keywords inside fenced source code", () => {
    const set = validSet();
    set.markdownByPath.set(
      "knowledge-base/项目总览.md",
      `${richOverview()}\n\n\`\`\`ts\nconst diagnostic = "TODO 占位";\n\`\`\``,
    );
    expect(validateKnowledgeArtifactSetV2(set)).toEqual({ ok: true, errors: [] });
  });

  it.each([
    ["timestamp", (set: ReturnType<typeof validSet>) => { set.searchIndex.generatedAt = "stale"; }],
    ["search reference", (set: ReturnType<typeof validSet>) => { set.searchIndex.records[0]!.pageId = "missing"; }],
    ["trace claim", (set: ReturnType<typeof validSet>) => { set.documentTraces.traces[0]!.claims = []; }],
    ["thin featured page", (set: ReturnType<typeof validSet>) => { set.markdownByPath.set("knowledge-base/项目总览.md", "# 项目总览\n\n内容很少"); }],
    ["non-writer mode", (set: ReturnType<typeof validSet>) => { set.wikiIndex.source.generationMode = "deterministic"; }],
    ["incomplete coverage", (set: ReturnType<typeof validSet>) => { set.generationReport.referenceCoverage.functions.covered = 0; }],
    ["invented zero totals", (set: ReturnType<typeof validSet>) => {
      set.wikiIndex.referenceCoverage.functions = { covered: 0, total: 0, missingIds: [] };
      set.generationReport.referenceCoverage.functions = { covered: 0, total: 0, missingIds: [] };
    }],
    ["missing node documentation", (set: ReturnType<typeof validSet>) => { set.wikiIndex.nodeDocumentation.pop(); }],
    ["extra trace", (set: ReturnType<typeof validSet>) => { set.documentTraces.traces.push({ ...set.documentTraces.traces[0]!, pageId: "ghost" }); }],
    ["unsafe markdown path", (set: ReturnType<typeof validSet>) => { set.wikiIndex.pages[0]!.markdownPath = "knowledge-base/../secret.md"; }],
    ["empty main route", (set: ReturnType<typeof validSet>) => {
      delete set.wikiIndex.pages.find((page) => page.id === "page:overview")!.route;
      set.wikiIndex.mainReadiness.routePageIds = [];
      set.generationReport.mainReadiness.routePageIds = [];
    }],
    ["unusable route page", (set: ReturnType<typeof validSet>) => {
      set.wikiIndex.pages.find((page) => page.id === "page:overview")!.quality = "needs-review";
      set.documentTraces.traces.find((trace) => trace.pageId === "page:overview")!.quality = "needs-review";
    }],
    ["unrelated claim evidence", (set: ReturnType<typeof validSet>) => {
      set.documentTraces.traces.find((trace) => trace.pageId === "page:overview")!.claims[0]!.nodeIds = ["file:src/run.ts"];
    }],
    ["wrong symbol destination", (set: ReturnType<typeof validSet>) => {
      const symbol = set.searchIndex.records.find((record) => record.kind === "symbol")!;
      symbol.pageId = "page:overview";
      symbol.role = "featured";
      symbol.category = "overview";
    }],
    ["mentioned but missing anchor marker", (set: ReturnType<typeof validSet>) => {
      set.markdownByPath.set("knowledge-base/文件文档/src-run.ts.md", richReference().replace('<a id="run"></a>', "正文提到 run 但没有锚点"));
    }],
  ])("rejects %s drift", (_label, mutate) => {
    const set = validSet();
    mutate(set);
    const result = validateKnowledgeArtifactSetV2(set);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
