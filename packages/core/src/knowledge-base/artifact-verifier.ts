import type { KnowledgeGraph } from "../types.js";
import {
  parseWikiDocumentTracesV2,
  parseWikiGenerationReportV2,
  parseWikiIndexV2,
  parseWikiSearchIndexV2,
  type WikiDocumentTracesV2,
  type WikiGenerationReportV2,
  type WikiIndexV2,
  type WikiSearchIndexV2,
} from "./wiki-contract.js";
import { maskMarkdownCode } from "./publication-quality.js";

export interface KnowledgeArtifactVerificationExpectation {
  outputLanguage: "zh-CN";
  generationMode: "writer";
  sourceRootIdentity: string;
  graphDigest?: string;
  gitCommitHash?: string;
}

export interface KnowledgeArtifactSetV2Input {
  graph: KnowledgeGraph;
  wikiIndex: WikiIndexV2;
  searchIndex: WikiSearchIndexV2;
  documentTraces: WikiDocumentTracesV2;
  generationReport: WikiGenerationReportV2;
  markdownByPath: ReadonlyMap<string, string>;
  expected: KnowledgeArtifactVerificationExpectation;
}

export type KnowledgeArtifactVerificationResult =
  | { ok: true; errors: [] }
  | { ok: false; errors: string[] };

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function add(errors: string[], message: string): void {
  if (!errors.includes(message)) errors.push(message);
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function safeMarkdownPath(markdownPath: string): boolean {
  if (!markdownPath.startsWith("knowledge-base/") || markdownPath.includes("\0")) return false;
  const relative = markdownPath.slice("knowledge-base/".length).replaceAll("\\", "/");
  return relative.length > 0
    && !relative.startsWith("/")
    && !relative.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}

function cjkCount(content: string): number {
  return content.match(/[\p{Script=Han}]/gu)?.length ?? 0;
}

function h2Count(content: string): number {
  return content.match(/^##\s+\S+/gmu)?.length ?? 0;
}

function verifyMetadata(input: KnowledgeArtifactSetV2Input, errors: string[]): void {
  const { wikiIndex, searchIndex, documentTraces, generationReport, expected } = input;
  const timestamps = [wikiIndex.generatedAt, searchIndex.generatedAt, documentTraces.generatedAt, generationReport.generatedAt];
  if (new Set(timestamps).size !== 1) add(errors, "四份 Wiki V2 产物的 generatedAt 不一致");
  if (wikiIndex.source.outputLanguage !== expected.outputLanguage || generationReport.source.outputLanguage !== expected.outputLanguage) {
    add(errors, "输出语言必须为简体中文 zh-CN");
  }
  if (wikiIndex.source.generationMode !== expected.generationMode || generationReport.generationMode !== expected.generationMode) {
    add(errors, "正式知识库必须由 writer 模式生成");
  }
  if (wikiIndex.source.sourceRootIdentity !== expected.sourceRootIdentity || generationReport.source.sourceRootIdentity !== expected.sourceRootIdentity) {
    add(errors, "源码根目录身份与本次验收目标不一致");
  }
  if (wikiIndex.source.graphDigest !== expected.graphDigest || generationReport.source.graphDigest !== expected.graphDigest) {
    add(errors, "图谱摘要在产物之间不一致");
  }
  if (wikiIndex.source.gitCommitHash !== expected.gitCommitHash || generationReport.source.gitCommitHash !== expected.gitCommitHash) {
    add(errors, "Git 提交标识在产物之间不一致");
  }
  if (!same(wikiIndex.mainReadiness, generationReport.mainReadiness)
    || wikiIndex.mainReadiness.status !== "ready" || wikiIndex.mainReadiness.reasons.length > 0) {
    add(errors, "主干阅读路径未达到 ready 状态");
  }
  if (!same(wikiIndex.referenceCoverage, generationReport.referenceCoverage)
    || wikiIndex.referenceCoverage.status !== "complete") {
    add(errors, "源码参考覆盖率未完整对齐");
  }
  for (const [kind, summary] of Object.entries(generationReport.referenceCoverage)) {
    if (kind === "status") continue;
    if (typeof summary === "object" && summary !== null && "covered" in summary
      && (summary.covered !== summary.total || summary.missingIds.length > 0)) {
      add(errors, `源码参考覆盖不完整：${kind}`);
    }
  }
  if (generationReport.sourceRead.covered !== generationReport.sourceRead.total
    || generationReport.sourceRead.missingIds.length > 0 || generationReport.errors.length > 0) {
    add(errors, "源码读取不完整或生成报告包含错误");
  }
  const expectedFiles = new Set(input.graph.nodes
    .filter((node) => ["file", "config", "schema", "document"].includes(node.type) && node.filePath !== undefined)
    .map((node) => node.filePath)).size;
  const expectedFunctions = input.graph.nodes.filter((node) => node.type === "function").length;
  const expectedTypes = input.graph.nodes.filter((node) => node.type === "class").length;
  if (generationReport.referenceCoverage.files.total !== expectedFiles
    || generationReport.referenceCoverage.functions.total !== expectedFunctions
    || generationReport.referenceCoverage.types.total !== expectedTypes) {
    add(errors, "源码参考覆盖总数与图谱节点不一致");
  }
  if (generationReport.sourceRead.total !== expectedFiles) add(errors, "源码读取总数与可文档化文件数不一致");

  const routePages = wikiIndex.pages
    .filter((page) => page.route !== undefined)
    .sort((left, right) => left.route!.order - right.route!.order);
  const routePageIds = routePages.map((page) => page.id);
  const featuredOverviews = wikiIndex.pages.filter((page) => page.role === "featured" && page.category === "overview");
  if (featuredOverviews.length === 0) add(errors, "正式知识库必须包含主干项目总览");
  if (routePages.length === 0 || !same(routePageIds, wikiIndex.mainReadiness.routePageIds)) {
    add(errors, "主干阅读路线必须非空并与页面 route 顺序完全一致");
  }
  if (routePages[0]?.category !== "overview" || routePages[0]?.route?.order !== 0) {
    add(errors, "主干阅读路线必须从 order=0 的项目总览开始");
  }
  if (routePages.some((page) => page.role !== "featured" || page.generationStatus !== "complete"
    || !["generated", "verified"].includes(page.quality))) {
    add(errors, "主干阅读路线包含不可正式阅读的页面");
  }
}

function verifyMappings(input: KnowledgeArtifactSetV2Input, errors: string[]): void {
  const { graph, wikiIndex, searchIndex, documentTraces } = input;
  const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
  const pageById = new Map(wikiIndex.pages.map((page) => [page.id, page]));
  const nodeDocs = new Map(wikiIndex.nodeDocumentation.map((record) => [record.nodeId, record]));
  const evidenceIds = new Set(wikiIndex.evidence.map((evidence) => evidence.id));
  const evidenceById = new Map(wikiIndex.evidence.map((evidence) => [evidence.id, evidence]));

  if (!unique(wikiIndex.pages.map((page) => page.id))) add(errors, "页面 ID 存在重复");
  if (!unique(searchIndex.records.map((record) => record.id))) add(errors, "搜索记录 ID 存在重复");
  if (!unique(documentTraces.traces.map((trace) => trace.pageId))) add(errors, "文档追踪记录不是一页一条");
  if (documentTraces.traces.length !== wikiIndex.pages.length
    || documentTraces.traces.some((trace) => !pageById.has(trace.pageId))) {
    add(errors, "文档追踪记录必须与页面集合完全一致");
  }
  if (wikiIndex.nodeDocumentation.length !== graph.nodes.length
    || graph.nodes.some((node) => !nodeDocs.has(node.id))) {
    add(errors, "节点文档记录必须覆盖图谱中的每一个节点");
  }

  for (const page of wikiIndex.pages) {
    for (const nodeId of page.directNodeIds) {
      if (!graphNodeIds.has(nodeId)) add(errors, `页面 ${page.id} 引用了不存在的图谱节点 ${nodeId}`);
      if (!nodeDocs.get(nodeId)?.directPageIds.includes(page.id)) add(errors, `页面与节点的直接映射不对称：${page.id} ↔ ${nodeId}`);
    }
    for (const nodeId of page.contextNodeIds) {
      if (!graphNodeIds.has(nodeId)) add(errors, `页面 ${page.id} 引用了不存在的图谱节点 ${nodeId}`);
      if (!nodeDocs.get(nodeId)?.contextPageIds.includes(page.id)) add(errors, `页面与节点的上下文映射不对称：${page.id} ↔ ${nodeId}`);
    }
    const trace = documentTraces.traces.find((item) => item.pageId === page.id);
    if (trace === undefined) {
      add(errors, `页面 ${page.id} 缺少文档追踪记录`);
    } else {
      if (!same(trace.directNodeIds, page.directNodeIds) || !same(trace.contextNodeIds, page.contextNodeIds)
        || !same(trace.evidenceIds, page.evidenceIds) || trace.quality !== page.quality
        || trace.generationStatus !== page.generationStatus) {
        add(errors, `页面 ${page.id} 与文档追踪记录不一致`);
      }
      if (page.generationStatus === "complete" && ["generated", "verified"].includes(page.quality)
        && (page.directNodeIds.length > 0 || page.contextNodeIds.length > 0)
        && (trace.claims.length === 0 || !trace.claims.some((claim) => claim.evidenceIds.length > 0))) {
        add(errors, `完整页面 ${page.id} 缺少可回溯声明`);
      }
      for (const claim of trace.claims) {
        const pageNodeIds = new Set([...page.directNodeIds, ...page.contextNodeIds]);
        const traceEvidenceIds = new Set(trace.evidenceIds);
        const claimEvidence = claim.evidenceIds.flatMap((id) => {
          const evidence = evidenceById.get(id);
          return evidence === undefined ? [] : [evidence];
        });
        const evidencedNodeIds = new Set(claimEvidence.flatMap((evidence) => evidence.nodeIds));
        if (claim.text.trim().length === 0 || claim.nodeIds.length === 0
          || claim.nodeIds.some((id) => !graphNodeIds.has(id) || !pageNodeIds.has(id) || !evidencedNodeIds.has(id))
          || claim.evidenceIds.length === 0
          || claim.evidenceIds.some((id) => !evidenceIds.has(id) || !traceEvidenceIds.has(id))) {
          add(errors, `页面 ${page.id} 存在无效声明`);
        }
      }
    }
  }

  for (const record of wikiIndex.nodeDocumentation) {
    if (!graphNodeIds.has(record.nodeId)) add(errors, `节点文档记录引用了不存在的节点 ${record.nodeId}`);
    for (const pageId of record.directPageIds) {
      if (!pageById.get(pageId)?.directNodeIds.includes(record.nodeId)) add(errors, `节点与页面的直接映射不对称：${record.nodeId} ↔ ${pageId}`);
    }
    for (const pageId of record.contextPageIds) {
      if (!pageById.get(pageId)?.contextNodeIds.includes(record.nodeId)) add(errors, `节点与页面的上下文映射不对称：${record.nodeId} ↔ ${pageId}`);
    }
  }

  for (const record of searchIndex.records) {
    const page = pageById.get(record.pageId);
    if (page === undefined) {
      add(errors, `搜索记录 ${record.id} 指向不存在的页面 ${record.pageId}`);
      continue;
    }
    if (record.role !== page.role || record.category !== page.category) add(errors, `搜索记录 ${record.id} 的页面分类不一致`);
    if (record.kind === "page" && record.contentLineIds !== undefined) {
      const markdown = input.markdownByPath.get(page.markdownPath);
      const lines = markdown?.split("\n");
      if (lines === undefined || lines.length !== record.contentLineIds.length
        || record.contentLineIds.some((id, lineIndex) => searchIndex.contentLines?.[id] !== lines[lineIndex])) {
        add(errors, `搜索记录 ${record.id} 的共享正文与 Markdown 不一致`);
      }
    }
    if (record.kind === "symbol") {
      const graphNode = record.nodeId === undefined ? undefined : graph.nodes.find((node) => node.id === record.nodeId);
      const documentation = record.nodeId === undefined ? undefined : nodeDocs.get(record.nodeId);
      if (graphNode === undefined || documentation === undefined || record.anchor === undefined
        || record.relation !== "direct" || page.category !== "file"
        || !documentation.directPageIds.includes(record.pageId)
        || (graphNode.filePath !== undefined && record.filePath !== graphNode.filePath)) {
        add(errors, `符号搜索记录 ${record.id} 与源码节点或文档映射不一致`);
      }
    }
  }
  for (const page of wikiIndex.pages) {
    const pageRecords = searchIndex.records.filter((record) => record.kind === "page" && record.pageId === page.id);
    if (pageRecords.length !== 1) add(errors, `页面 ${page.id} 必须恰好有一条页面搜索记录`);
  }
  for (const record of wikiIndex.nodeDocumentation) {
    if (record.primaryPageId !== undefined && record.anchor !== undefined
      && !searchIndex.records.some((search) => search.kind === "symbol" && search.nodeId === record.nodeId
        && search.pageId === record.primaryPageId && search.anchor === record.anchor)) {
      add(errors, `节点 ${record.nodeId} 缺少精确符号搜索记录`);
    }
  }
  for (const node of graph.nodes.filter((item) => item.type === "function" || item.type === "class")) {
    const symbolRecords = searchIndex.records.filter((record) => record.kind === "symbol" && record.nodeId === node.id);
    if (symbolRecords.length !== 1) add(errors, `源码符号 ${node.id} 必须恰好有一条精确搜索记录`);
  }
}

function verifyMarkdown(input: KnowledgeArtifactSetV2Input, errors: string[]): void {
  const forbidden = /\b(?:TODO|TBD)\b|待补充|暂无内容|占位/iu;
  for (const page of input.wikiIndex.pages) {
    if (!safeMarkdownPath(page.markdownPath)) {
      add(errors, `页面 ${page.id} 的 Markdown 路径不安全`);
      continue;
    }
    const content = input.markdownByPath.get(page.markdownPath);
    if (content === undefined || content.trim().length === 0) {
      add(errors, `页面 ${page.id} 的 Markdown 文件不存在或为空`);
      continue;
    }
    if (forbidden.test(maskMarkdownCode(content))) add(errors, `页面 ${page.id} 包含占位内容`);
    if (page.role === "featured") {
      const requiredCjk = page.category === "overview" ? 250 : 180;
      const requiredH2 = page.category === "overview" ? 3 : 2;
      if (cjkCount(content) < requiredCjk || h2Count(content) < requiredH2) add(errors, `主干页面 ${page.id} 内容过薄`);
      if (!/源码证据|证据/gu.test(content) || !/[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+/u.test(content)) {
        add(errors, `主干页面 ${page.id} 缺少源码证据或文件路径`);
      }
    }
    if (page.role === "reference") {
      if (h2Count(content) < 1 || !/[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+/u.test(content)) add(errors, `参考页面 ${page.id} 缺少结构化源码定位`);
      const symbolRecords = input.searchIndex.records.filter((record) => record.kind === "symbol" && record.pageId === page.id);
      for (const record of symbolRecords) {
        const marker = `<a id="${record.anchor}"></a>`;
        if (content.split(marker).length - 1 !== 1) add(errors, `参考页面 ${page.id} 缺少唯一可导航符号锚点 ${record.anchor}`);
      }
    }
  }
}

export function validateKnowledgeArtifactSetV2(input: KnowledgeArtifactSetV2Input): KnowledgeArtifactVerificationResult {
  const errors: string[] = [];
  const parsed = [
    parseWikiIndexV2(input.wikiIndex),
    parseWikiSearchIndexV2(input.searchIndex),
    parseWikiDocumentTracesV2(input.documentTraces),
    parseWikiGenerationReportV2(input.generationReport),
  ];
  parsed.forEach((result, index) => {
    if (!result.ok) result.errors.forEach((error) => add(errors, `产物 ${index + 1} 契约错误：${error}`));
  });
  verifyMetadata(input, errors);
  verifyMappings(input, errors);
  verifyMarkdown(input, errors);
  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}
