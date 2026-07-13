import { describe, expect, it } from "vitest";
import {
  buildKnowledgeArtifacts,
  WikiArtifactBuildError,
  type KnowledgeArtifactInput,
} from "../artifacts.js";

const input: KnowledgeArtifactInput = {
  projectName: "demo",
  generatedAt: "2026-07-11T00:00:00.000Z",
  outputLanguage: "zh-CN",
  generationMode: "writer",
  graphDigest: "abc",
  sourceRootIdentity: "/workspace/demo",
  sourceRead: { covered: 1, total: 1, missingIds: [] },
  requiredRouteStages: ["purpose"],
  businessTerms: ["策略执行"],
  nodes: [
    { id: "file:src/a.ts", type: "file", name: "a.ts", filePath: "src/a.ts" },
    { id: "function:src/a.ts:run", type: "function", name: "run", filePath: "src/a.ts" },
  ],
  referenceFileNodeIds: ["file:src/a.ts"],
  documents: [{
    id: "page:overview", path: "项目总览.md", title: "项目总览", summary: "解释策略执行入口。",
    category: "overview", role: "featured", directNodeIds: ["function:src/a.ts:run"], contextNodeIds: ["file:src/a.ts"],
    symbolAnchors: [], route: { order: 0, stage: "purpose" }, representedEdgeIds: [], reason: "overview",
    content: "# 项目总览", searchTerms: ["策略执行"], quality: "generated", generationStatus: "complete", qualityIssues: [],
    sourceEvidence: [{ filePath: "src/a.ts", lineRange: [1, 3], nodeId: "function:src/a.ts:run", excerpt: "export function run() {}", claim: "run 是项目运行入口。" }],
  }, {
    id: "page:file-a", path: "文件文档/src-a.ts.md", title: "src/a.ts", summary: "入口文件参考。",
    category: "file", role: "reference", directNodeIds: ["file:src/a.ts", "function:src/a.ts:run"], contextNodeIds: [],
    symbolAnchors: [{ nodeId: "function:src/a.ts:run", anchor: "run" }], representedEdgeIds: [], reason: "file reference",
    content: "# src/a.ts", searchTerms: ["src/a.ts", "run"], quality: "generated", generationStatus: "complete", qualityIssues: [],
    sourceEvidence: [
      { filePath: "src/a.ts", lineRange: [1, 3], nodeId: "file:src/a.ts", excerpt: "export function run() {}", claim: "该文件导出运行入口。" },
      { filePath: "src/a.ts", lineRange: [1, 3], nodeId: "function:src/a.ts:run", excerpt: "export function run() {}", claim: "run 提供运行入口。" },
    ],
  }],
  warnings: [], errors: [],
};

describe("knowledge artifacts", () => {
  it("builds a valid index, searchable symbol anchor, exact traces, and independent coverage", () => {
    const artifacts = buildKnowledgeArtifacts(input);
    expect(artifacts.wikiIndex.version).toBe(2);
    expect(artifacts.wikiIndex.mainReadiness.status).toBe("ready");
    expect(artifacts.wikiIndex.referenceCoverage.functions).toEqual({ covered: 1, total: 1, missingIds: [] });
    expect(artifacts.searchIndex.records).toContainEqual(expect.objectContaining({ kind: "symbol", pageId: "page:file-a", anchor: "run", relation: "direct" }));
    expect(artifacts.documentTraces.traces.every((trace) => trace.evidenceIds.length > 0 && trace.claims.length > 0)).toBe(true);
    expect(artifacts.generationReport.sourceRead).toEqual({ covered: 1, total: 1, missingIds: [] });
    expect(artifacts.generationReport.source).toMatchObject({ outputLanguage: "zh-CN", sourceRootIdentity: "/workspace/demo", graphDigest: "abc" });
  });

  it("blocks deterministic and zero-source runs without destroying reference counts", () => {
    const artifacts = buildKnowledgeArtifacts({ ...input, generationMode: "deterministic", sourceRead: { covered: 0, total: 1, missingIds: ["file:src/a.ts"] } });
    expect(artifacts.wikiIndex.mainReadiness.status).toBe("blocked");
    expect(artifacts.wikiIndex.mainReadiness.reasons).toEqual(expect.arrayContaining(["未读取到任何源码文件", "确定性诊断稿不能作为正式主干知识发布"]));
    expect(artifacts.wikiIndex.referenceCoverage.functions.total).toBe(1);
  });

  it("classifies an env-suffixed evidence path as configuration", () => {
    const artifacts = buildKnowledgeArtifacts({
      ...input,
      documents: input.documents.map((document) => ({
        ...document,
        sourceEvidence: document.sourceEvidence.map((evidence) =>
          evidence.nodeId === "function:src/a.ts:run"
            ? { ...evidence, filePath: "src/runtime.env" }
            : evidence),
      })),
    });
    expect(artifacts.wikiIndex.evidence.find((evidence) =>
      evidence.filePath === "src/runtime.env")?.evidenceType).toBe("configuration");
  });

  it("classifies a conventional config-suffixed source path as configuration", () => {
    const artifacts = buildKnowledgeArtifacts({
      ...input,
      documents: input.documents.map((document) => ({
        ...document,
        sourceEvidence: document.sourceEvidence.map((evidence) =>
          evidence.nodeId === "function:src/a.ts:run"
            ? { ...evidence, filePath: "build/vite.config.ts" }
            : evidence),
      })),
    });
    expect(artifacts.wikiIndex.evidence.find((evidence) =>
      evidence.filePath === "build/vite.config.ts")?.evidenceType).toBe("configuration");
  });

  it("deduplicates byte-identical evidence while retaining exact claim traces", () => {
    const artifacts = buildKnowledgeArtifacts(input);
    const functionEvidence = artifacts.wikiIndex.evidence.filter((evidence) =>
      evidence.nodeIds.includes("function:src/a.ts:run"));
    expect(functionEvidence).toHaveLength(1);
    expect(functionEvidence[0]?.id).toBe("evidence:function%3Asrc%2Fa.ts%3Arun:src%2Fa.ts:1-3");
    expect(artifacts.documentTraces.traces.flatMap((trace) => trace.claims)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "claim:page%3Aoverview:0",
        text: "run 是项目运行入口。",
        nodeIds: ["function:src/a.ts:run"],
        evidenceIds: ["evidence:function%3Asrc%2Fa.ts%3Arun:src%2Fa.ts:1-3"],
      }),
      expect.objectContaining({
        id: "claim:page%3Afile-a:1",
        text: "run 提供运行入口。",
        nodeIds: ["function:src/a.ts:run"],
        evidenceIds: ["evidence:function%3Asrc%2Fa.ts%3Arun:src%2Fa.ts:1-3"],
      }),
    ]));
  });

  it("adds evidence-only nodes to page context so every claim remains navigable", () => {
    const artifacts = buildKnowledgeArtifacts({
      ...input,
      documents: input.documents.map((document) => document.id === "page:overview"
        ? {
            ...document,
            contextNodeIds: [],
            sourceEvidence: [
              {
                filePath: "src/a.ts",
                lineRange: [1, 3] as [number, number],
                nodeId: "function:src/a.ts:run",
                excerpt: "export function run() {}",
                claim: "run 是项目运行入口。",
              },
              {
                filePath: "src/a.ts",
                lineRange: [1, 3] as [number, number],
                nodeId: "file:src/a.ts",
                excerpt: "export function run() {}",
                claim: "入口文件承载运行函数。",
              },
            ],
          }
        : document),
    });
    const page = artifacts.wikiIndex.pages.find((candidate) => candidate.id === "page:overview")!;
    const trace = artifacts.documentTraces.traces.find((candidate) => candidate.pageId === "page:overview")!;

    expect(page.contextNodeIds).toContain("file:src/a.ts");
    expect(trace.contextNodeIds).toEqual(page.contextNodeIds);
  });

  it("rejects conflicting evidence instead of choosing an excerpt", () => {
    const conflictingDocuments = input.documents.map((document) => document.id !== "page:file-a"
      ? document
      : {
          ...document,
          sourceEvidence: document.sourceEvidence.map((evidence) =>
            evidence.nodeId === "function:src/a.ts:run"
              ? { ...evidence, excerpt: "冲突的源码摘录" }
              : evidence),
        });
    expect(() => buildKnowledgeArtifacts({ ...input, documents: conflictingDocuments }))
      .toThrowError(WikiArtifactBuildError);
    expect(() => buildKnowledgeArtifacts({ ...input, documents: conflictingDocuments }))
      .toThrow("对应了不同的摘录或证据类型");
  });

  it("selects a usable direct page by category before role and id", () => {
    const artifacts = buildKnowledgeArtifacts({
      ...input,
      documents: [...input.documents, {
        id: "page:topic", path: "专题/run.md", title: "run 专题", summary: "解释 run。",
        category: "topic", role: "maintenance", directNodeIds: ["function:src/a.ts:run"], contextNodeIds: [],
        symbolAnchors: [], representedEdgeIds: [], reason: "topic",
        content: "# run", searchTerms: ["run"], quality: "generated", generationStatus: "complete", qualityIssues: [],
        sourceEvidence: [{
          filePath: "src/a.ts", lineRange: [1, 3], nodeId: "function:src/a.ts:run",
          excerpt: "export function run() {}", claim: "run 提供运行入口。",
        }],
      }],
    });
    expect(artifacts.wikiIndex.nodeDocumentation.find((record) =>
      record.nodeId === "function:src/a.ts:run")).toMatchObject({
      primaryPageId: "page:topic",
      quality: "generated",
      generationStatus: "complete",
    });
    expect(artifacts.wikiIndex.nodeDocumentation.find((record) =>
      record.nodeId === "function:src/a.ts:run")).not.toHaveProperty("anchor");
  });

  it("retains a failed direct mapping and state without inventing a primary page", () => {
    const failedNodeId = "variable:src/a.ts:value";
    const artifacts = buildKnowledgeArtifacts({
      ...input,
      nodes: [...input.nodes, { id: failedNodeId, type: "variable", name: "value", filePath: "src/a.ts" }],
      documents: [...input.documents, {
        id: "page:failed", path: "失败文档.md", title: "失败文档", summary: "生成失败。",
        category: "topic", role: "maintenance", directNodeIds: [failedNodeId], contextNodeIds: [],
        symbolAnchors: [], representedEdgeIds: [], reason: "failed",
        content: "", searchTerms: [], quality: "failed", generationStatus: "failed", qualityIssues: ["生成失败"],
        sourceEvidence: [],
      }],
    });
    const record = artifacts.wikiIndex.nodeDocumentation.find((item) => item.nodeId === failedNodeId);
    expect(record).toMatchObject({
      relation: "direct",
      quality: "failed",
      generationStatus: "failed",
      directPageIds: ["page:failed"],
      evidenceHealth: "missing",
    });
    expect(record).not.toHaveProperty("primaryPageId");
  });

  it("computes weak evidence health independently from primary-page usability", () => {
    const artifacts = buildKnowledgeArtifacts({
      ...input,
      documents: input.documents.map((document) => ({
        ...document,
        sourceEvidence: document.sourceEvidence.map((evidence) =>
          evidence.nodeId === "function:src/a.ts:run"
            ? { ...evidence, excerpt: "   " }
            : evidence),
      })),
    });
    expect(artifacts.wikiIndex.nodeDocumentation.find((record) =>
      record.nodeId === "function:src/a.ts:run")).toMatchObject({
      evidenceHealth: "weak",
      primaryPageId: "page:file-a",
      anchor: "run",
    });
  });

  it("requires file-page anchors for function and class reference coverage", () => {
    const classNodeId = "class:src/a.ts:Runner";
    const artifacts = buildKnowledgeArtifacts({
      ...input,
      nodes: [...input.nodes, { id: classNodeId, type: "class", name: "Runner", filePath: "src/a.ts" }],
      documents: input.documents.map((document) => document.id !== "page:file-a"
        ? document
        : {
            ...document,
            directNodeIds: [...document.directNodeIds, classNodeId],
            symbolAnchors: [{ nodeId: classNodeId, anchor: "runner" }],
            sourceEvidence: [...document.sourceEvidence, {
              filePath: "src/a.ts", lineRange: [5, 8] as [number, number], nodeId: classNodeId,
              excerpt: "export class Runner {}", claim: "Runner 执行任务。",
            }],
          }),
    });
    expect(artifacts.wikiIndex.referenceCoverage.functions).toEqual({
      covered: 0,
      total: 1,
      missingIds: ["function:src/a.ts:run"],
    });
    expect(artifacts.wikiIndex.referenceCoverage.types).toEqual({ covered: 1, total: 1, missingIds: [] });
    expect(artifacts.wikiIndex.nodeDocumentation.find((record) => record.nodeId === classNodeId))
      .toMatchObject({ referenceCoverage: "anchored", primaryPageId: "page:file-a", anchor: "runner" });
  });

  it("counts explicitly listed configuration owners as reference files", () => {
    const configNodeId = "config:config/app.yaml";
    const artifacts = buildKnowledgeArtifacts({
      ...input,
      nodes: [...input.nodes, { id: configNodeId, type: "config", name: "app.yaml", filePath: "config/app.yaml" }],
      referenceFileNodeIds: [...input.referenceFileNodeIds, configNodeId],
      documents: input.documents.map((document) => document.id !== "page:file-a"
        ? document
        : {
            ...document,
            directNodeIds: [...document.directNodeIds, configNodeId],
            sourceEvidence: [...document.sourceEvidence, {
              filePath: "config/app.yaml", lineRange: [1, 2] as [number, number], nodeId: configNodeId,
              excerpt: "enabled: true", claim: "配置启用执行。",
            }],
          }),
    });
    expect(artifacts.wikiIndex.referenceCoverage.files).toEqual({ covered: 2, total: 2, missingIds: [] });
    expect(artifacts.wikiIndex.nodeDocumentation.find((record) => record.nodeId === configNodeId))
      .toMatchObject({ referenceCoverage: "anchored" });
    expect(artifacts.wikiIndex.evidence.find((evidence) => evidence.nodeIds.includes(configNodeId)))
      .toMatchObject({ evidenceType: "configuration" });
  });

  it("accumulates deterministic zero-source, missing-stage, and missing-overview reasons in stable order", () => {
    const artifacts = buildKnowledgeArtifacts({
      ...input,
      generationMode: "deterministic",
      sourceRead: { covered: 0, total: 1, missingIds: ["file:src/a.ts"] },
      requiredRouteStages: ["flow", "purpose", "flow"],
      documents: input.documents.filter((document) => document.id === "page:file-a"),
    });
    expect(artifacts.wikiIndex.mainReadiness).toEqual({
      status: "blocked",
      reasons: [
        "未读取到任何源码文件",
        "确定性诊断稿不能作为正式主干知识发布",
        "缺少必需路由阶段：purpose",
        "缺少必需路由阶段：flow",
        "缺少项目总览页面",
      ],
      routePageIds: [],
    });
  });

  it("blocks an unusable route page and degrades only for failed optional pages", () => {
    const routeBlocked = buildKnowledgeArtifacts({
      ...input,
      documents: input.documents.map((document) => document.id !== "page:overview"
        ? document
        : { ...document, quality: "needs-review", generationStatus: "partial" }),
    });
    expect(routeBlocked.wikiIndex.mainReadiness).toMatchObject({
      status: "blocked",
      reasons: ["路由页面不可用：page:overview"],
    });

    const degraded = buildKnowledgeArtifacts({
      ...input,
      documents: [...input.documents, {
        id: "page:optional-failed", path: "可选失败.md", title: "可选失败", summary: "可选内容失败。",
        category: "quality", role: "maintenance", directNodeIds: [], contextNodeIds: [], symbolAnchors: [],
        representedEdgeIds: [], reason: "optional", content: "", searchTerms: [], quality: "failed",
        generationStatus: "failed", qualityIssues: ["失败"], sourceEvidence: [],
      }],
    });
    expect(degraded.wikiIndex.mainReadiness).toMatchObject({
      status: "degraded",
      reasons: ["可选文档生成失败：page:optional-failed"],
    });
  });

  it("blocks a route page with no direct node instead of accepting vacuous evidence", () => {
    const artifacts = buildKnowledgeArtifacts({
      ...input,
      documents: input.documents.map((document) => document.id !== "page:overview"
        ? document
        : { ...document, directNodeIds: [], sourceEvidence: [] }),
    });
    expect(artifacts.wikiIndex.mainReadiness).toMatchObject({
      status: "blocked",
      reasons: ["路由页面不可用：page:overview"],
    });
  });

  it("emits symbol search records only from owning file pages", () => {
    const artifacts = buildKnowledgeArtifacts({
      ...input,
      documents: input.documents.map((document) => document.id !== "page:overview"
        ? document
        : { ...document, symbolAnchors: [{ nodeId: "function:src/a.ts:run", anchor: "overview-run" }] }),
    });
    const symbolRecords = artifacts.searchIndex.records.filter((record) => record.kind === "symbol");
    expect(symbolRecords).toHaveLength(1);
    expect(symbolRecords[0]).toMatchObject({
      pageId: "page:file-a",
      anchor: "run",
      nodeId: "function:src/a.ts:run",
      relation: "direct",
    });
  });

  it("includes the complete Markdown body in page search records without copying it to symbols", () => {
    const uniqueBodyPhrase = "跨域熔断视窗只出现在正文";
    const artifacts = buildKnowledgeArtifacts({
      ...input,
      documents: input.documents.map((document) => document.id !== "page:file-a"
        ? document
        : { ...document, content: `# src/a.ts\n\n${uniqueBodyPhrase}` }),
    });

    expect(artifacts.searchIndex.records.find((record) => record.id === "page:page%3Afile-a"))
      .toMatchObject({ kind: "page", content: expect.stringContaining(uniqueBodyPhrase) });
    expect(artifacts.searchIndex.records.find((record) => record.kind === "symbol"))
      .not.toHaveProperty("content");
  });

  it("assigns business terms only to matching pages, with overview fallback, and never to symbols", () => {
    const artifacts = buildKnowledgeArtifacts({
      ...input,
      businessTerms: ["策略执行", "运行内幕词", "全局孤立词", "   "],
      documents: [
        ...input.documents.map((document) => document.id !== "page:file-a"
          ? document
          : { ...document, content: `${document.content}\n\n运行内幕词` }),
        {
          id: "page:maintenance", path: "维护说明.md", title: "维护说明", summary: "普通维护信息。",
          category: "quality", role: "maintenance", directNodeIds: [], contextNodeIds: [], symbolAnchors: [],
          representedEdgeIds: [], reason: "maintenance", content: "# 维护说明", searchTerms: ["维护"],
          quality: "generated", generationStatus: "complete", qualityIssues: [], sourceEvidence: [],
        },
      ],
    });

    const recordByPage = new Map(artifacts.searchIndex.records
      .filter((record) => record.kind === "page")
      .map((record) => [record.pageId, record]));
    expect(recordByPage.get("page:overview")?.businessTerms)
      .toEqual(["全局孤立词", "策略执行", "运行内幕词"]);
    expect(recordByPage.get("page:file-a")?.businessTerms).toEqual(["运行内幕词"]);
    expect(recordByPage.get("page:maintenance")?.businessTerms).toEqual([]);
    expect(artifacts.searchIndex.records.filter((record) => record.kind === "symbol")
      .every((record) => record.businessTerms.length === 0)).toBe(true);
  });

  it("rejects an empty symbol anchor instead of reporting false anchored coverage", () => {
    const documentsWithEmptyAnchor = input.documents.map((document) => document.id !== "page:file-a"
      ? document
      : {
          ...document,
          symbolAnchors: [{ nodeId: "function:src/a.ts:run", anchor: "   " }],
        });
    expect(() => buildKnowledgeArtifacts({ ...input, documents: documentsWithEmptyAnchor }))
      .toThrow("symbol anchor 不能为空");
  });

  it("rejects document evidence for a node outside the single graph input boundary", () => {
    const ghostNodeId = "function:src/ghost.ts:run";
    const documentsWithGhost = input.documents.map((document) => document.id !== "page:overview"
      ? document
      : {
          ...document,
          directNodeIds: [...document.directNodeIds, ghostNodeId],
          sourceEvidence: [...document.sourceEvidence, {
            filePath: "src/ghost.ts", lineRange: [1, 2] as [number, number], nodeId: ghostNodeId,
            excerpt: "export function run() {}", claim: "ghost run 是入口。",
          }],
        });
    expect(() => buildKnowledgeArtifacts({ ...input, documents: documentsWithGhost }))
      .toThrow("引用了输入图中不存在的节点");
  });

  it("rejects a generated direct page without a claim trace", () => {
    const documentsWithoutClaims = input.documents.map((document) => ({
      ...document,
      sourceEvidence: document.sourceEvidence.map((evidence) => ({ ...evidence, claim: "" })),
    }));
    expect(() => buildKnowledgeArtifacts({ ...input, documents: documentsWithoutClaims }))
      .toThrow("包含直接节点，但没有可追踪的非空声明");
  });

  it("sorts every top-level artifact collection by stable id", () => {
    const expected = buildKnowledgeArtifacts(input);
    const reordered = buildKnowledgeArtifacts({
      ...input,
      nodes: [...input.nodes].reverse(),
      documents: [...input.documents].reverse(),
    });
    expect(reordered.wikiIndex.pages.map((page) => page.id))
      .toEqual(expected.wikiIndex.pages.map((page) => page.id));
    expect(reordered.wikiIndex.nodeDocumentation.map((record) => record.nodeId))
      .toEqual(expected.wikiIndex.nodeDocumentation.map((record) => record.nodeId));
    expect(reordered.wikiIndex.evidence.map((evidence) => evidence.id))
      .toEqual(expected.wikiIndex.evidence.map((evidence) => evidence.id));
    expect(reordered.searchIndex.records.map((record) => record.id))
      .toEqual(expected.searchIndex.records.map((record) => record.id));
    expect(reordered.documentTraces.traces.map((trace) => trace.pageId))
      .toEqual(expected.documentTraces.traces.map((trace) => trace.pageId));
  });

  it("fails closed with every final Wiki contract error", () => {
    const overlappingDocuments = input.documents.map((document) => document.id !== "page:overview"
      ? document
      : {
          ...document,
          role: "reference" as const,
          contextNodeIds: [...document.contextNodeIds, "function:src/a.ts:run"],
        });
    try {
      buildKnowledgeArtifacts({ ...input, documents: overlappingDocuments });
      throw new Error("预期构建失败");
    } catch (error) {
      expect(error).toBeInstanceOf(WikiArtifactBuildError);
      if (!(error instanceof WikiArtifactBuildError)) throw error;
      expect(error.errors.join("\n")).toContain("directNodeIds 与 contextNodeIds 存在重叠");
      expect(error.errors.join("\n")).toContain("只有 featured 页面可以配置 route");
    }
  });
});
