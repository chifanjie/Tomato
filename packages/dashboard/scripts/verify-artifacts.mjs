#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { validateGraph } from "../../core/dist/index.js";
import {
  parseWikiDocumentTracesV2,
  parseWikiGenerationReportV2,
  parseWikiIndexV2,
  parseWikiSearchIndexV2,
  validateKnowledgeArtifactSetV2,
} from "../../core/dist/knowledge-base/index.js";

function fail(message) {
  process.stderr.write(`知识库发布验收失败：${message}\n`);
  process.exitCode = 1;
}

function parseArgs(argv) {
  const [root, ...rest] = argv;
  if (!root) throw new Error("用法：verify-artifacts <knowledge-base-root> --graph <knowledge-graph.json> --source-root <source-root>");
  const options = { root: resolve(root) };
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!value || !["--graph", "--source-root"].includes(flag)) throw new Error(`无效参数：${flag ?? "<empty>"}`);
    options[flag === "--graph" ? "graph" : "sourceRoot"] = resolve(value);
  }
  if (!options.graph || !options.sourceRoot) throw new Error("--graph 和 --source-root 都是必填参数");
  return options;
}

function readJson(path, label) {
  if (!existsSync(path)) throw new Error(`${label} 不存在：${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} 不是有效 JSON：${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseContract(value, parser, label) {
  const result = parser(value);
  if (!result.ok) throw new Error(`${label} 不符合 V2 契约：\n${result.errors.join("\n")}`);
  return result.value;
}

function inside(root, candidate) {
  const fromRoot = relative(root, candidate);
  return fromRoot.length > 0 && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot);
}

function loadMarkdown(root, wikiIndex) {
  const realRoot = realpathSync(root);
  const markdownByPath = new Map();
  for (const page of wikiIndex.pages) {
    const relativePath = page.markdownPath.startsWith("knowledge-base/")
      ? page.markdownPath.slice("knowledge-base/".length)
      : page.markdownPath;
    const candidate = resolve(root, relativePath);
    if (!existsSync(candidate) || !lstatSync(candidate).isFile()) throw new Error(`Markdown 文件不存在或不是普通文件：${page.markdownPath}`);
    const realCandidate = realpathSync(candidate);
    if (!inside(realRoot, realCandidate)) throw new Error(`Markdown 文件越过知识库根目录：${page.markdownPath}`);
    const content = readFileSync(realCandidate, "utf8");
    if (!content.trim()) throw new Error(`Markdown 文件为空：${page.markdownPath}`);
    markdownByPath.set(page.markdownPath, content);
  }
  return markdownByPath;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const rawGraph = readJson(options.graph, "知识图谱");
  const graphResult = validateGraph(rawGraph);
  if (!graphResult.success || graphResult.data === undefined) throw new Error(`知识图谱不符合契约：${graphResult.fatal ?? "存在无法修复的问题"}`);

  const wikiIndex = parseContract(readJson(resolve(options.root, "wiki-index.json"), "Wiki 索引"), parseWikiIndexV2, "Wiki 索引");
  const searchIndex = parseContract(readJson(resolve(options.root, "search-index.json"), "搜索索引"), parseWikiSearchIndexV2, "搜索索引");
  const documentTraces = parseContract(readJson(resolve(options.root, ".trace/document-traces.json"), "文档追踪"), parseWikiDocumentTracesV2, "文档追踪");
  const generationReport = parseContract(readJson(resolve(options.root, ".trace/generation-report.json"), "生成报告"), parseWikiGenerationReportV2, "生成报告");
  const sourceRootIdentity = options.sourceRoot;
  const result = validateKnowledgeArtifactSetV2({
    graph: graphResult.data,
    wikiIndex,
    searchIndex,
    documentTraces,
    generationReport,
    markdownByPath: loadMarkdown(options.root, wikiIndex),
    expected: {
      outputLanguage: "zh-CN",
      generationMode: "writer",
      sourceRootIdentity,
      graphDigest: createHash("sha256").update(JSON.stringify(graphResult.data)).digest("hex"),
      gitCommitHash: graphResult.data.project.gitCommitHash,
    },
  });
  if (!result.ok) throw new Error(result.errors.join("\n"));
  process.stdout.write(`知识库发布验收通过：${wikiIndex.pages.length} 篇文档，${graphResult.data.nodes.length} 个图谱节点。\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
