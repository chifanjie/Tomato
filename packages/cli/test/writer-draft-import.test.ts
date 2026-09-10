import { createHash } from "node:crypto";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildKnowledgeArtifacts, validateGraph, withSourceReferenceDocuments, type GeneratedDocument } from "@understand-code/core";
import { buildRepositoryIndex, withRepositoryIndexWriterDraftV1, withRepositoryIndexKnowledgeLineageV1,
  assertRepositoryKnowledgeWriterReadyV1 } from "../src/runtime/repository-indexer.js";
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

describe("official writer draft import", () => {
  it("accepts source-bound writer evidence and rejects an invented source excerpt", async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), "uc-writer-import-")));
    roots.push(root);
    const installation = path.join(root, ".understand-code");
    await mkdir(installation, { mode: 0o700 });
    await mkdir(path.join(root, "src"));
    const source = "export function run(value: number) {\n  if (value <= 0) return 0;\n  return value * 2;\n}\n";
    await writeFile(path.join(root, "src/run.ts"), source);
    const snapshot = { schemaVersion: 1, snapshotId: "snapshot:writer", repositoryId: "repository:writer", worktreeId: "worktree:writer", rootIdentity: root, headCommit: "a".repeat(40), createdAt: "2026-09-10T00:00:00.000Z" } as any;
    const index = await buildRepositoryIndex({ canonicalRoot: root, canonicalInstallationRoot: installation, operationId: "c".repeat(32), snapshot });
    const graph = validateGraph(index.graph).data!;
    const references = withSourceReferenceDocuments(graph, { "src/run.ts": source }, []);
    const fnEvidence = references[0].sourceEvidence.find((item) => item.nodeId === "function:src/run.ts:run")!;
    const overview: GeneratedDocument = {
      id: "page:overview", path: "项目总览.md", title: "项目总览", summary: "输入数值的分支规则与返回值。", category: "overview", role: "featured",
      directNodeIds: [fnEvidence.nodeId!], contextNodeIds: [], symbolAnchors: [], representedEdgeIds: [], reason: "host-writer", route: { order: 0, stage: "purpose" },
      searchTerms: ["返回值"], sourceEvidence: [fnEvidence], quality: "generated", generationStatus: "complete", qualityIssues: [],
      content: `# 项目总览\n\n## 输入和边界\n\n源码证据位于 src/run.ts，函数 run 接收一个带有数值类型标记的输入。实现首先比较输入和零的大小，当输入小于或等于零时立即返回零，因此这条分支不会执行后续乘法。这一点可以直接从条件判断和提前返回语句核对。类型标记本身不能证明调用者总会传入合法数值，源码也没有额外校验输入，所以调用方约束仍需结合实际使用位置确认。\n\n## 正常返回\n\n当提前返回条件不成立时，函数执行乘以二的运算并返回计算结果。两条返回路径对应不同条件，阅读时应把判断顺序和返回表达式一起检查。该实现没有声明额外业务状态，也没有读取配置或访问其他服务；这些观察只适用于当前展示的函数源码，不能推广到整个应用的其他执行路径。函数名不是业务语义的充分证据。\n\n## 证据和未知项\n\n本页的结论绑定本次读取的文件及行号，可以通过参考页面查看完整源码。尚未确认的内容包括调用者传参约束和异常数值的业务处理约定，因此不能仅凭此实现描述上层产品策略。修改边界条件时需要分别检查小于零、等于零和正数的返回值，并由宿主记录实际执行结果。这里提供源码解释，不伪造测试已经通过的结论。`,
    };
    const artifacts = buildKnowledgeArtifacts({ projectName: graph.project.name, generatedAt: snapshot.createdAt, outputLanguage: "zh-CN", generationMode: "writer",
      graphDigest: hash(JSON.stringify(graph)), gitCommitHash: graph.project.gitCommitHash, sourceRootIdentity: root,
      sourceRead: { covered: 1, total: 1, missingIds: [] }, nodes: graph.nodes, referenceFileNodeIds: ["file:src/run.ts"],
      documents: [overview, ...references], requiredRouteStages: ["purpose"], businessTerms: [], warnings: [], errors: [] });
    const draft = path.join(installation, "knowledge-drafts/01ARZ3NDEKTSV4RRFFQ69G5FAV");
    const save = async (relative: string, value: string) => { await mkdir(path.dirname(path.join(draft, relative)), { recursive: true }); await writeFile(path.join(draft, relative), value); };
    await save(".intermediate/source-binding.json", JSON.stringify({ schemaVersion: 1, graphDigest: hash(JSON.stringify(graph)), sourceInventoryDigest: hash(JSON.stringify([["src/run.ts", hash(source)]])) }));
    for (const [name, value] of Object.entries({ "wiki-index.json": artifacts.wikiIndex, "search-index.json": artifacts.searchIndex,
      ".trace/document-traces.json": artifacts.documentTraces, ".trace/generation-report.json": artifacts.generationReport })) await save(name, JSON.stringify(value));
    for (const doc of [overview, ...references]) await save(doc.path, doc.content);
    const writer = await withRepositoryIndexWriterDraftV1({ canonicalRoot: root, taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", index });
    const candidate = withRepositoryIndexKnowledgeLineageV1({ ...writer, knowledgeLineage: { schemaVersion: 1, status: "pending", taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", taskRevision: 1,
      sourceSnapshotId: snapshot.snapshotId, requestDigest: `sha256:${"1".repeat(64)}`, idempotencyKeyDigest: `sha256:${"2".repeat(64)}` } });
    expect(() => assertRepositoryKnowledgeWriterReadyV1(candidate)).not.toThrow();
    artifacts.wikiIndex.evidence[0].excerpt = "invented return value";
    await save("wiki-index.json", JSON.stringify(artifacts.wikiIndex));
    await expect(withRepositoryIndexWriterDraftV1({ canonicalRoot: root, taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", index })).rejects.toThrow(/excerpt does not match source/u);
  }, 60_000);
});
