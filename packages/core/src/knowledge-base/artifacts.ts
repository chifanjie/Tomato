import type { GeneratedDocument, SourceEvidence } from "./types.js";
import {
  parseWikiIndexV2,
  type CountSummaryV2,
  type DocumentationRelation,
  type EvidenceHealth,
  type MainReadinessSummaryV2,
  type ReferenceCoverage,
  type ReferenceCoverageSummaryV2,
  type RouteStage,
  type WikiClaimTraceV2,
  type WikiDocumentTraceRecordV2,
  type WikiDocumentTracesV2,
  type WikiEvidenceV2,
  type WikiGenerationReportV2,
  type WikiIndexV2,
  type WikiNodeDocumentationV2,
  type WikiPageV2,
  type WikiSearchIndexV2,
  type WikiSearchRecordV2,
} from "./wiki-contract.js";

export interface KnowledgeArtifactNode {
  id: string;
  type: string;
  name: string;
  filePath?: string;
}

export interface KnowledgeArtifactInput {
  projectName: string;
  generatedAt: string;
  outputLanguage: string;
  generationMode: "writer" | "deterministic";
  graphDigest?: string;
  gitCommitHash?: string;
  sourceRootIdentity: string;
  sourceRead: CountSummaryV2;
  requiredRouteStages: RouteStage[];
  businessTerms: string[];
  nodes: KnowledgeArtifactNode[];
  referenceFileNodeIds: string[];
  documents: GeneratedDocument[];
  warnings: string[];
  errors: string[];
}

export interface KnowledgeArtifactsV2 {
  wikiIndex: WikiIndexV2;
  searchIndex: WikiSearchIndexV2;
  documentTraces: WikiDocumentTracesV2;
  generationReport: WikiGenerationReportV2;
}

export class WikiArtifactBuildError extends Error {
  readonly errors: string[];

  constructor(errors: string | string[]) {
    const errorList = typeof errors === "string" ? [errors] : [...errors];
    super(`Wiki V2 产物构建失败：\n${errorList.join("\n")}`);
    this.name = "WikiArtifactBuildError";
    this.errors = errorList;
  }
}

type EvidenceType = WikiEvidenceV2["evidenceType"];

interface ResolvedEvidence {
  nodeId: string;
  filePath: string;
  lineRange: [number, number];
  excerpt?: string;
  evidenceType: EvidenceType;
}

interface BuiltDocument {
  document: GeneratedDocument;
  page: WikiPageV2;
  trace: WikiDocumentTraceRecordV2;
}

const ROUTE_STAGE_ORDER: RouteStage[] = ["purpose", "flow", "rule", "implementation", "evidence"];
const CATEGORY_PRIORITY = new Map<WikiPageV2["category"], number>([
  ["topic", 0],
  ["file", 1],
  ["flow", 2],
  ["module", 3],
]);
const ROLE_PRIORITY = new Map<WikiPageV2["role"], number>([
  ["featured", 0],
  ["reference", 1],
  ["maintenance", 2],
]);

function compareStable(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareStable);
}

function evidenceId(evidence: ResolvedEvidence): string {
  const [start, end] = evidence.lineRange;
  return `evidence:${encodeURIComponent(evidence.nodeId)}:${encodeURIComponent(evidence.filePath)}:${start}-${end}`;
}

function normalizedPath(filePath: string): string {
  return filePath.replaceAll("\\", "/").toLowerCase();
}

function inferEvidenceType(
  evidence: Pick<ResolvedEvidence, "nodeId" | "filePath">,
  nodesById: ReadonlyMap<string, KnowledgeArtifactNode>,
): EvidenceType {
  const path = normalizedPath(evidence.filePath);
  const segments = path.split("/").filter((segment) => segment.length > 0);
  const baseName = segments.at(-1) ?? path;
  const nodeType = nodesById.get(evidence.nodeId)?.type.toLowerCase();

  if (
    segments.some((segment) => ["test", "tests", "__tests__", "spec", "specs"].includes(segment))
    || /(?:^|[._-])(test|spec)(?:[._-]|$)/u.test(baseName)
    || /_test\.[^.]+$/u.test(baseName)
  ) {
    return "test";
  }

  if (
    nodeType === "config"
    || nodeType === "configuration"
    || segments.some((segment) => ["config", "configs", "configuration", "env"].includes(segment))
    || /(?:^|\.)env(?:\.|$)/u.test(baseName)
    || /(?:^|[._-])config(?:[._-]|$)/u.test(baseName)
    || /\.(?:ya?ml|json|toml)$/u.test(baseName)
  ) {
    return "configuration";
  }

  if (
    segments.some((segment) => ["doc", "docs", "documentation"].includes(segment))
    || /\.(?:md|markdown)$/u.test(baseName)
  ) {
    return "documentation";
  }

  return "production";
}

function resolveEvidence(
  evidence: SourceEvidence,
  documentId: string,
  evidenceIndex: number,
  nodesById: ReadonlyMap<string, KnowledgeArtifactNode>,
): ResolvedEvidence {
  if (evidence.nodeId === undefined || evidence.nodeId.trim().length === 0) {
    throw new WikiArtifactBuildError(`文档 ${documentId} 的第 ${evidenceIndex} 条证据缺少节点 ID`);
  }
  if (!nodesById.has(evidence.nodeId)) {
    throw new WikiArtifactBuildError(
      `文档 ${documentId} 的第 ${evidenceIndex} 条证据引用了输入图中不存在的节点：${evidence.nodeId}`,
    );
  }
  if (evidence.lineRange === undefined) {
    throw new WikiArtifactBuildError(`文档 ${documentId} 的第 ${evidenceIndex} 条证据缺少行号范围`);
  }

  const [start, end] = evidence.lineRange;
  const resolved: ResolvedEvidence = {
    nodeId: evidence.nodeId,
    filePath: evidence.filePath,
    lineRange: [start, end],
    evidenceType: inferEvidenceType({ nodeId: evidence.nodeId, filePath: evidence.filePath }, nodesById),
    ...(evidence.excerpt === undefined ? {} : { excerpt: evidence.excerpt }),
  };
  return resolved;
}

function registerEvidence(
  resolved: ResolvedEvidence,
  evidenceById: Map<string, WikiEvidenceV2>,
): string {
  const id = evidenceId(resolved);
  const candidate: WikiEvidenceV2 = {
    id,
    nodeIds: [resolved.nodeId],
    filePath: resolved.filePath,
    lineRange: resolved.lineRange,
    evidenceType: resolved.evidenceType,
    ...(resolved.excerpt === undefined ? {} : { excerpt: resolved.excerpt }),
  };
  const existing = evidenceById.get(id);
  if (
    existing !== undefined
    && (existing.excerpt !== candidate.excerpt || existing.evidenceType !== candidate.evidenceType)
  ) {
    throw new WikiArtifactBuildError(`证据 ID ${id} 对应了不同的摘录或证据类型，已拒绝构建`);
  }
  if (existing === undefined) evidenceById.set(id, candidate);
  return id;
}

function markdownPath(documentPath: string): string {
  return documentPath.startsWith("knowledge-base/")
    ? documentPath
    : `knowledge-base/${documentPath}`;
}

function buildDocuments(
  input: KnowledgeArtifactInput,
  nodesById: ReadonlyMap<string, KnowledgeArtifactNode>,
  evidenceById: Map<string, WikiEvidenceV2>,
): BuiltDocument[] {
  return input.documents.map((document) => {
    const pageEvidenceIds: string[] = [];
    const claims: WikiClaimTraceV2[] = [];

    document.sourceEvidence.forEach((evidence, sourceIndex) => {
      const resolved = resolveEvidence(evidence, document.id, sourceIndex, nodesById);
      const id = registerEvidence(resolved, evidenceById);
      pageEvidenceIds.push(id);
      if (evidence.claim !== undefined && evidence.claim.trim().length > 0) {
        claims.push({
          id: `claim:${encodeURIComponent(document.id)}:${sourceIndex}`,
          text: evidence.claim,
          nodeIds: [resolved.nodeId],
          evidenceIds: [id],
        });
      }
    });

    if (
      (document.quality === "generated" || document.quality === "verified")
      && document.directNodeIds.length > 0
      && claims.length === 0
    ) {
      throw new WikiArtifactBuildError(`文档 ${document.id} 包含直接节点，但没有可追踪的非空声明`);
    }

    const page: WikiPageV2 = {
      id: document.id,
      title: document.title,
      summary: document.summary,
      markdownPath: markdownPath(document.path),
      role: document.role,
      category: document.category,
      quality: document.quality,
      generationStatus: document.generationStatus,
      directNodeIds: [...document.directNodeIds],
      contextNodeIds: [...document.contextNodeIds],
      evidenceIds: uniqueSorted(pageEvidenceIds),
      searchTerms: [...document.searchTerms],
      ...(document.verification === undefined ? {} : { verification: { ...document.verification } }),
      ...(document.route === undefined ? {} : { route: { ...document.route } }),
    };

    return {
      document,
      page,
      trace: {
        pageId: document.id,
        directNodeIds: [...document.directNodeIds],
        contextNodeIds: [...document.contextNodeIds],
        evidenceIds: [...page.evidenceIds],
        quality: document.quality,
        generationStatus: document.generationStatus,
        issues: [...document.qualityIssues],
        claims,
      },
    };
  });
}

function validateInputReferences(
  input: KnowledgeArtifactInput,
  nodesById: ReadonlyMap<string, KnowledgeArtifactNode>,
): void {
  input.referenceFileNodeIds.forEach((nodeId) => {
    if (!nodesById.has(nodeId)) {
      throw new WikiArtifactBuildError(`引用文件列表引用了输入图中不存在的节点：${nodeId}`);
    }
  });

  input.documents.forEach((document) => {
    [...document.directNodeIds, ...document.contextNodeIds].forEach((nodeId) => {
      if (!nodesById.has(nodeId)) {
        throw new WikiArtifactBuildError(`文档 ${document.id} 引用了输入图中不存在的节点：${nodeId}`);
      }
    });
    document.symbolAnchors.forEach((symbolAnchor) => {
      if (!nodesById.has(symbolAnchor.nodeId)) {
        throw new WikiArtifactBuildError(
          `文档 ${document.id} 的 symbol anchor 引用了输入图中不存在的节点：${symbolAnchor.nodeId}`,
        );
      }
      if (symbolAnchor.anchor.trim().length === 0) {
        throw new WikiArtifactBuildError(`文档 ${document.id} 的 symbol anchor 不能为空`);
      }
    });
  });
}

function pagePriority(left: WikiPageV2, right: WikiPageV2): number {
  const categoryDifference = (CATEGORY_PRIORITY.get(left.category) ?? 4)
    - (CATEGORY_PRIORITY.get(right.category) ?? 4);
  if (categoryDifference !== 0) return categoryDifference;
  const roleDifference = (ROLE_PRIORITY.get(left.role) ?? 3) - (ROLE_PRIORITY.get(right.role) ?? 3);
  return roleDifference !== 0 ? roleDifference : compareStable(left.id, right.id);
}

function pageHasExactEvidence(
  page: WikiPageV2,
  nodeId: string,
  evidenceById: ReadonlyMap<string, WikiEvidenceV2>,
): boolean {
  return page.evidenceIds.some((id) => evidenceById.get(id)?.nodeIds.includes(nodeId) === true);
}

function isUsableDirectPage(
  page: WikiPageV2,
  evidenceById: ReadonlyMap<string, WikiEvidenceV2>,
): boolean {
  return page.directNodeIds.length > 0
    && (page.quality === "generated" || page.quality === "verified")
    && page.generationStatus === "complete"
    && page.directNodeIds.every((nodeId) => pageHasExactEvidence(page, nodeId, evidenceById));
}

function isCompleteGeneratedPage(page: WikiPageV2): boolean {
  return (page.quality === "generated" || page.quality === "verified")
    && page.generationStatus === "complete";
}

function countCoverage(ids: readonly string[], coveredIds: ReadonlySet<string>): CountSummaryV2 {
  const applicableIds = uniqueSorted(ids);
  const missingIds = applicableIds.filter((id) => !coveredIds.has(id));
  return {
    covered: applicableIds.length - missingIds.length,
    total: applicableIds.length,
    missingIds,
  };
}

function buildReferenceCoverage(
  input: KnowledgeArtifactInput,
  builtDocuments: readonly BuiltDocument[],
): {
  summary: ReferenceCoverageSummaryV2;
  files: ReadonlySet<string>;
  functions: ReadonlySet<string>;
  types: ReadonlySet<string>;
} {
  const completeFileDocuments = builtDocuments.filter(({ page }) =>
    page.category === "file" && isCompleteGeneratedPage(page));
  const referenceFileIds = uniqueSorted(input.referenceFileNodeIds);
  const functionIds = uniqueSorted(input.nodes
    .filter((node) => node.type.toLowerCase() === "function")
    .map((node) => node.id));
  const typeIds = uniqueSorted(input.nodes
    .filter((node) => node.type.toLowerCase() === "class")
    .map((node) => node.id));

  const coveredFiles = new Set(referenceFileIds.filter((nodeId) =>
    completeFileDocuments.some(({ page }) => page.directNodeIds.includes(nodeId))));
  const coveredFunctions = new Set(functionIds.filter((nodeId) =>
    completeFileDocuments.some(({ document, page }) =>
      page.directNodeIds.includes(nodeId)
      && document.symbolAnchors.some((anchor) => anchor.nodeId === nodeId))));
  const coveredTypes = new Set(typeIds.filter((nodeId) =>
    completeFileDocuments.some(({ document, page }) =>
      page.directNodeIds.includes(nodeId)
      && document.symbolAnchors.some((anchor) => anchor.nodeId === nodeId))));

  const files = countCoverage(referenceFileIds, coveredFiles);
  const functions = countCoverage(functionIds, coveredFunctions);
  const types = countCoverage(typeIds, coveredTypes);
  return {
    summary: {
      status: files.missingIds.length === 0 && functions.missingIds.length === 0 && types.missingIds.length === 0
        ? "complete"
        : "partial",
      files,
      functions,
      types,
    },
    files: coveredFiles,
    functions: coveredFunctions,
    types: coveredTypes,
  };
}

function compareRoute(left: BuiltDocument, right: BuiltDocument): number {
  const leftOrder = left.page.route?.order ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.page.route?.order ?? Number.MAX_SAFE_INTEGER;
  return leftOrder - rightOrder || compareStable(left.page.id, right.page.id);
}

function buildMainReadiness(
  input: KnowledgeArtifactInput,
  builtDocuments: readonly BuiltDocument[],
  evidenceById: ReadonlyMap<string, WikiEvidenceV2>,
): MainReadinessSummaryV2 {
  const routeDocuments = builtDocuments.filter(({ page }) => page.route !== undefined).sort(compareRoute);
  const routeStages = new Set(routeDocuments.flatMap(({ page }) =>
    page.route === undefined ? [] : [page.route.stage]));
  const requiredStages = [...new Set(input.requiredRouteStages)].sort((left, right) =>
    ROUTE_STAGE_ORDER.indexOf(left) - ROUTE_STAGE_ORDER.indexOf(right));
  const reasons: string[] = [];
  let blocked = false;

  if (input.sourceRead.covered === 0) {
    reasons.push("未读取到任何源码文件");
    blocked = true;
  }
  if (input.generationMode === "deterministic") {
    reasons.push("确定性诊断稿不能作为正式主干知识发布");
    blocked = true;
  }
  requiredStages.forEach((stage) => {
    if (!routeStages.has(stage)) {
      reasons.push(`缺少必需路由阶段：${stage}`);
      blocked = true;
    }
  });
  if (!builtDocuments.some(({ page }) => page.category === "overview")) {
    reasons.push("缺少项目总览页面");
    blocked = true;
  }
  routeDocuments.forEach(({ page }) => {
    if (!isUsableDirectPage(page, evidenceById)) {
      reasons.push(`路由页面不可用：${page.id}`);
      blocked = true;
    }
  });

  const failedOptionalPageIds = builtDocuments
    .filter(({ page }) =>
      page.route === undefined && (page.quality === "failed" || page.generationStatus === "failed"))
    .map(({ page }) => page.id)
    .sort(compareStable);
  failedOptionalPageIds.forEach((pageId) => reasons.push(`可选文档生成失败：${pageId}`));

  return {
    status: blocked ? "blocked" : failedOptionalPageIds.length > 0 ? "degraded" : "ready",
    reasons,
    routePageIds: routeDocuments.map(({ page }) => page.id),
  };
}

function evidenceHealthForNode(
  evidenceIds: readonly string[],
  evidenceById: ReadonlyMap<string, WikiEvidenceV2>,
): EvidenceHealth {
  if (evidenceIds.length === 0) return "missing";
  const sourceLinked = evidenceIds.some((id) => {
    const evidence = evidenceById.get(id);
    if (evidence === undefined) return false;
    const [start, end] = evidence.lineRange;
    return end >= start && evidence.excerpt !== undefined && evidence.excerpt.trim().length > 0;
  });
  return sourceLinked ? "source-linked" : "weak";
}

function referenceCoverageForNode(
  node: KnowledgeArtifactNode,
  referenceFileIds: ReadonlySet<string>,
  coveredFiles: ReadonlySet<string>,
  coveredFunctions: ReadonlySet<string>,
  coveredTypes: ReadonlySet<string>,
): ReferenceCoverage {
  const nodeType = node.type.toLowerCase();
  const applicable = referenceFileIds.has(node.id) || nodeType === "function" || nodeType === "class";
  if (!applicable) return "not-applicable";
  const covered = coveredFiles.has(node.id) || coveredFunctions.has(node.id) || coveredTypes.has(node.id);
  return covered ? "anchored" : "unanchored";
}

function buildNodeDocumentation(
  input: KnowledgeArtifactInput,
  pages: readonly WikiPageV2[],
  builtDocuments: readonly BuiltDocument[],
  evidenceById: ReadonlyMap<string, WikiEvidenceV2>,
  coverage: ReturnType<typeof buildReferenceCoverage>,
): WikiNodeDocumentationV2[] {
  const documentByPage = new Map(builtDocuments.map((item) => [item.page, item.document]));
  const referenceFileIds = new Set(input.referenceFileNodeIds);

  return input.nodes.map((node) => {
    const directPages = pages.filter((page) => page.directNodeIds.includes(node.id)).sort(pagePriority);
    const contextPageIds = pages
      .filter((page) => page.contextNodeIds.includes(node.id))
      .map((page) => page.id)
      .sort(compareStable);
    const directPageIds = directPages.map((page) => page.id).sort(compareStable);
    const evidenceIds = [...evidenceById.values()]
      .filter((evidence) => evidence.nodeIds.includes(node.id))
      .map((evidence) => evidence.id)
      .sort(compareStable);
    const primaryPage = directPages.filter((page) => isUsableDirectPage(page, evidenceById))[0];
    const statePage = primaryPage ?? directPages[0];
    const relation: DocumentationRelation = directPageIds.length > 0
      ? "direct"
      : contextPageIds.length > 0
        ? "context"
        : "none";
    const anchor = primaryPage?.category === "file"
      ? documentByPage.get(primaryPage)?.symbolAnchors
        .filter((item) => item.nodeId === node.id)
        .map((item) => item.anchor)
        .sort(compareStable)[0]
      : undefined;

    return {
      nodeId: node.id,
      relation,
      quality: statePage?.quality ?? "needs-review",
      evidenceHealth: evidenceHealthForNode(evidenceIds, evidenceById),
      generationStatus: statePage?.generationStatus ?? "partial",
      referenceCoverage: referenceCoverageForNode(
        node,
        referenceFileIds,
        coverage.files,
        coverage.functions,
        coverage.types,
      ),
      directPageIds,
      contextPageIds,
      evidenceIds,
      ...(primaryPage === undefined ? {} : { primaryPageId: primaryPage.id }),
      ...(anchor === undefined ? {} : { anchor }),
    };
  }).sort((left, right) => compareStable(left.nodeId, right.nodeId));
}

function pageRelation(page: WikiPageV2): DocumentationRelation {
  return page.directNodeIds.length > 0 ? "direct" : page.contextNodeIds.length > 0 ? "context" : "none";
}

function symbolRelation(page: WikiPageV2, nodeId: string): DocumentationRelation {
  return page.directNodeIds.includes(nodeId)
    ? "direct"
    : page.contextNodeIds.includes(nodeId)
      ? "context"
      : "none";
}

function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN").trim();
}

function businessTermsForPage(
  businessTerms: readonly string[],
  document: GeneratedDocument,
  page: WikiPageV2,
): string[] {
  if (page.category === "overview") return [...businessTerms];
  const searchableText = normalizeSearchText([
    page.title,
    page.summary,
    document.content,
    ...page.searchTerms,
  ].join("\n"));
  return businessTerms.filter((term) => {
    const normalizedTerm = normalizeSearchText(term);
    return normalizedTerm.length > 0 && searchableText.includes(normalizedTerm);
  });
}

function buildSearchIndex(
  input: KnowledgeArtifactInput,
  builtDocuments: readonly BuiltDocument[],
  nodesById: ReadonlyMap<string, KnowledgeArtifactNode>,
): WikiSearchIndexV2 {
  const businessTerms = uniqueSorted(
    input.businessTerms.filter((term) => normalizeSearchText(term).length > 0),
  );
  const records = new Map<string, WikiSearchRecordV2>();

  builtDocuments.forEach(({ document, page }) => {
    const pageRecord: WikiSearchRecordV2 = {
      id: `page:${encodeURIComponent(page.id)}`,
      kind: "page",
      title: page.title,
      summary: page.summary,
      content: document.content,
      pageId: page.id,
      role: page.role,
      category: page.category,
      relation: pageRelation(page),
      terms: uniqueSorted(page.searchTerms),
      businessTerms: businessTermsForPage(businessTerms, document, page),
    };
    records.set(pageRecord.id, pageRecord);

    if (page.category !== "file") return;
    document.symbolAnchors.forEach((symbolAnchor) => {
      const node = nodesById.get(symbolAnchor.nodeId);
      const id = `symbol:${encodeURIComponent(page.id)}:${encodeURIComponent(symbolAnchor.nodeId)}:${encodeURIComponent(symbolAnchor.anchor)}`;
      const symbolRecord: WikiSearchRecordV2 = {
        id,
        kind: "symbol",
        title: node?.name ?? symbolAnchor.nodeId,
        summary: page.summary,
        pageId: page.id,
        anchor: symbolAnchor.anchor,
        nodeId: symbolAnchor.nodeId,
        role: page.role,
        category: page.category,
        relation: symbolRelation(page, symbolAnchor.nodeId),
        terms: uniqueSorted([...(page.searchTerms), node?.name ?? symbolAnchor.nodeId, symbolAnchor.anchor]),
        businessTerms: [],
        ...(node?.filePath === undefined ? {} : { filePath: node.filePath }),
      };
      records.set(id, symbolRecord);
    });
  });

  return {
    version: 2,
    generatedAt: input.generatedAt,
    records: [...records.values()].sort((left, right) => compareStable(left.id, right.id)),
  };
}

function buildGenerationReport(
  input: KnowledgeArtifactInput,
  mainReadiness: MainReadinessSummaryV2,
  referenceCoverage: ReferenceCoverageSummaryV2,
): WikiGenerationReportV2 {
  return {
    version: 2,
    generatedAt: input.generatedAt,
    generationMode: input.generationMode,
    source: {
      outputLanguage: input.outputLanguage,
      sourceRootIdentity: input.sourceRootIdentity,
      ...(input.graphDigest === undefined ? {} : { graphDigest: input.graphDigest }),
      ...(input.gitCommitHash === undefined ? {} : { gitCommitHash: input.gitCommitHash }),
    },
    sourceRead: { ...input.sourceRead, missingIds: [...input.sourceRead.missingIds] },
    mainReadiness,
    referenceCoverage,
    warnings: [...input.warnings],
    errors: [...input.errors],
  };
}

export function buildKnowledgeArtifacts(input: KnowledgeArtifactInput): KnowledgeArtifactsV2 {
  const nodesById = new Map(input.nodes.map((node) => [node.id, node]));
  validateInputReferences(input, nodesById);
  const evidenceById = new Map<string, WikiEvidenceV2>();
  const builtDocuments = buildDocuments(input, nodesById, evidenceById);
  const pages = builtDocuments.map(({ page }) => page).sort((left, right) => compareStable(left.id, right.id));
  const evidence = [...evidenceById.values()].sort((left, right) => compareStable(left.id, right.id));
  const coverage = buildReferenceCoverage(input, builtDocuments);
  const mainReadiness = buildMainReadiness(input, builtDocuments, evidenceById);
  const nodeDocumentation = buildNodeDocumentation(
    input,
    pages,
    builtDocuments,
    evidenceById,
    coverage,
  );
  const wikiIndex: WikiIndexV2 = {
    version: 2,
    generatedAt: input.generatedAt,
    projectName: input.projectName,
    source: {
      outputLanguage: input.outputLanguage,
      generationMode: input.generationMode,
      sourceRootIdentity: input.sourceRootIdentity,
      ...(input.graphDigest === undefined ? {} : { graphDigest: input.graphDigest }),
      ...(input.gitCommitHash === undefined ? {} : { gitCommitHash: input.gitCommitHash }),
    },
    mainReadiness,
    referenceCoverage: coverage.summary,
    pages,
    nodeDocumentation,
    evidence,
  };
  const parsedWikiIndex = parseWikiIndexV2(wikiIndex);
  if (!parsedWikiIndex.ok) {
    throw new WikiArtifactBuildError(parsedWikiIndex.errors);
  }

  return {
    wikiIndex: parsedWikiIndex.value,
    searchIndex: buildSearchIndex(input, builtDocuments, nodesById),
    documentTraces: {
      version: 2,
      generatedAt: input.generatedAt,
      traces: builtDocuments
        .map(({ trace }) => trace)
        .sort((left, right) => compareStable(left.pageId, right.pageId)),
    },
    generationReport: buildGenerationReport(input, mainReadiness, coverage.summary),
  };
}
