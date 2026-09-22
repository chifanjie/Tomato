import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "../../types.js";
import { generateKnowledgeBase, materializeKnowledgeBase, parseFeaturedWriterOutput } from "../index.js";
import type { FeaturedWriterOutput } from "../types.js";

const fileId = "file:task.ts";
const functionId = "function:task.ts:task";
const source = "export function task(value: number) {\n  if (value <= 0) return 0;\n  return value * 2;\n}\n";
const graph: KnowledgeGraph = {
  version: "1.0.0", kind: "codebase",
  project: { name: "numeric-task", languages: ["typescript"], frameworks: [], description: "数值计算", analyzedAt: "2026-09-21T00:00:00Z", gitCommitHash: "fixture" },
  nodes: [
    { id: fileId, type: "file", name: "task.ts", filePath: "task.ts", lineRange: [1, 4], summary: "数值函数实现", tags: [], complexity: "simple" },
    { id: functionId, type: "function", name: "task", filePath: "task.ts", lineRange: [1, 4], summary: "计算输入的二倍或返回零", tags: [], complexity: "simple" },
  ], edges: [], layers: [], tour: [],
};
function fixture() {
  const kb = generateKnowledgeBase(graph, { sourceFiles: { "task.ts": source } });
  const featuredWriterOutput: FeaturedWriterOutput = { warnings: [], documents: kb.plan.documents
    .filter((document) => document.role !== "maintenance" && !["file", "topic"].includes(document.category))
    .map((document) => ({ documentId: document.id, documentPath: document.path, markdown: "# 源码计算说明\n\n输入非正数时提前返回零，否则计算输入值的二倍。", evidence: [
      { nodeId: fileId, filePath: "task.ts", lineRange: [1, 4], excerpt: source.trimEnd(), claim: "函数接收数值并按条件返回零或二倍结果。" },
    ] })) };
  return { kb, featuredWriterOutput, input: {
    profile: kb.profile, fileDocPlan: kb.fileDocPlan, topicPlan: kb.topicPlan, businessCapabilityProfile: kb.businessCapabilityProfile,
    options: { generationMode: "writer" as const },
    merged: { validation: { ok: true, errors: [], warnings: [] }, retryPlan: { fileBatchIndexes: [], topicBatchIndexes: [], fileTerminalBatchIndexes: [], topicTerminalBatchIndexes: [], reasons: [] }, acceptedFileWriterDocuments: [], acceptedTopicWriterDocuments: [] },
  } };
}

describe("planned featured writers", () => {
  it("anchors mandatory reading pages to real files without inferred layers or entry points", () => {
    const { kb } = fixture();
    expect(kb.profile.entryCandidates).toEqual([]);
    expect(kb.plan.documents.filter((page) => page.category === "overview").map((page) => page.directNodeIds)).toEqual([[fileId], [fileId]]);
  });
  it("requires a shaped output and never substitutes templates in writer mode", () => {
    const { input, featuredWriterOutput } = fixture();
    expect(parseFeaturedWriterOutput(featuredWriterOutput).ok).toBe(true);
    expect(parseFeaturedWriterOutput({ ...featuredWriterOutput, documents: [{}] }).ok).toBe(false);
    const result = materializeKnowledgeBase(input);
    expect(result.validation.errors).toContain("计划主干页面缺少有效写作者输出：项目总览.md");
    expect(result.documents.some((page) => page.category === "overview")).toBe(false);
  });
  it.each([
    ["excerpt", (output: FeaturedWriterOutput) => { output.documents[0].evidence[0].excerpt = "fabricated source"; }, "excerpt does not match"],
    ["range", (output: FeaturedWriterOutput) => { output.documents[0].evidence[0].lineRange = [1, 99]; }, "range is outside"],
    ["path", (output: FeaturedWriterOutput) => { output.documents[0].evidence[0].filePath = "unrelated.ts"; }, "path does not match"],
    ["identity", (output: FeaturedWriterOutput) => { output.documents[0].documentPath = "unplanned.md"; }, "identity does not uniquely match"],
    ["duplicate", (output: FeaturedWriterOutput) => { output.documents.push(structuredClone(output.documents[0])); }, "identity does not uniquely match"],
    ["direct coverage", (output: FeaturedWriterOutput) => { output.documents[0].evidence[0].nodeId = functionId; }, "missing direct node"],
  ] as const)("rejects invalid %s before creating the main page", (_label, mutate, expected) => {
    const { input, featuredWriterOutput } = fixture();
    const pageId = featuredWriterOutput.documents[0].documentId;
    mutate(featuredWriterOutput);
    const result = materializeKnowledgeBase({ ...input, featuredWriterOutput });
    expect(result.validation.errors.join("\n")).toContain(expected);
    expect(result.documents.some((page) => page.id === pageId)).toBe(false);
  });
});
