#!/usr/bin/env node
/**
 * generate-knowledge-base.mjs
 *
 * 从 .understand-code/knowledge-graph.json 生成 Markdown 知识库。
 *
 * Usage:
 *   node generate-knowledge-base.mjs [project-root] [--deterministic-only]
 *   node generate-knowledge-base.mjs [project-root] --prepare-file-docs
 *   node generate-knowledge-base.mjs [project-root] --merge-file-docs
 *   node generate-knowledge-base.mjs [project-root] --prepare-topics
 *   node generate-knowledge-base.mjs [project-root] --finalize
 *   node generate-knowledge-base.mjs [project-root] --lease-file-batch --worker-id <id>
 *   node generate-knowledge-base.mjs [project-root] --lease-topic-batch --worker-id <id>
 *   node generate-knowledge-base.mjs [project-root] --complete-file-batch --worker-id <id> --batch-index <n> --result-status <value>
 *   node generate-knowledge-base.mjs [project-root] --complete-topic-batch --worker-id <id> --batch-index <n> --result-status <value>
 *   Optional safety flags: --max-source-mb N, --allow-large-deterministic
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, '../..');
const require = createRequire(resolve(pluginRoot, 'package.json'));

function parseArgs(argv) {
  const args = {
    projectRoot: process.cwd(),
    phase: 'deterministic',
    keepIntermediate: true,
    deterministicOnly: false,
    allowLargeDeterministic: false,
    maxSourceBytes: 64 * 1024 * 1024,
    resume: false,
    includeExtendedTopics: false,
    workerId: '',
    batchIndex: 0,
    resultStatus: '',
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--prepare-file-docs') args.phase = 'prepare-file-docs';
    else if (arg === '--merge-file-docs') args.phase = 'merge-file-docs';
    else if (arg === '--prepare-topics') args.phase = 'prepare-topics';
    else if (arg === '--finalize') args.phase = 'finalize';
    else if (arg === '--lease-file-batch') args.phase = 'lease-file-batch';
    else if (arg === '--lease-topic-batch') args.phase = 'lease-topic-batch';
    else if (arg === '--complete-file-batch') args.phase = 'complete-file-batch';
    else if (arg === '--complete-topic-batch') args.phase = 'complete-topic-batch';
    else if (arg === '--retry') args.phase = 'retry';
    else if (arg === '--deterministic-only') args.deterministicOnly = true;
    else if (arg === '--allow-large-deterministic') args.allowLargeDeterministic = true;
    else if (arg === '--clean-intermediate') args.keepIntermediate = false;
    else if (arg === '--resume') args.resume = true;
    else if (arg === '--include-extended-topics') args.includeExtendedTopics = true;
    else if (arg === '--worker-id') {
      args.workerId = argv[index + 1] ?? '';
      index += 1;
    }
    else if (arg === '--batch-index') {
      args.batchIndex = Number(argv[index + 1] ?? 0);
      index += 1;
    }
    else if (arg === '--result-status') {
      args.resultStatus = argv[index + 1] ?? '';
      index += 1;
    }
    else if (arg === '--max-source-mb') {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        console.error('--max-source-mb must be a positive number');
        process.exit(1);
      }
      args.maxSourceBytes = Math.floor(value * 1024 * 1024);
      index += 1;
    }
    else if (!arg.startsWith('--')) args.projectRoot = resolve(arg);
  }
  return args;
}

function pathsFor(projectRoot) {
  const outputRoot = join(projectRoot, '.understand-code', 'knowledge-base');
  const intermediateRoot = join(outputRoot, '.intermediate');
  return {
    graphPath: join(projectRoot, '.understand-code', 'knowledge-graph.json'),
    outputRoot,
    intermediateRoot,
  };
}

function latestModifiedTimeMs(rootPath) {
  if (!existsSync(rootPath)) return 0;

  const stack = [rootPath];
  let latest = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    const stats = statSync(current);
    latest = Math.max(latest, stats.mtimeMs);
    if (!stats.isDirectory()) continue;
    for (const entry of readdirSync(current)) {
      stack.push(join(current, entry));
    }
  }
  return latest;
}

function ensureCoreBuilt() {
  const distPath = resolve(pluginRoot, 'packages/core/dist/index.js');
  const srcRoot = resolve(pluginRoot, 'packages/core/src');
  const distMtime = existsSync(distPath) ? statSync(distPath).mtimeMs : 0;
  const srcMtime = latestModifiedTimeMs(srcRoot);
  if (distMtime > 0 && distMtime >= srcMtime) return;
  execFileSync('pnpm', ['--filter', '@understand-code/core', 'build'], {
    cwd: pluginRoot,
    stdio: 'inherit',
  });
}

async function loadCore() {
  ensureCoreBuilt();
  try {
    return await import(pathToFileURL(require.resolve('@understand-code/core')).href);
  } catch {
    return await import(pathToFileURL(resolve(pluginRoot, 'packages/core/dist/index.js')).href);
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf-8');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function unresolvedQueue(queueSummary) {
  return queueSummary.pending || queueSummary.leased || queueSummary.needsRetry || queueSummary.failedTerminal;
}

function requireQueue(queuePath, missingMessage) {
  if (!existsSync(queuePath)) {
    console.error(missingMessage);
    process.exit(1);
  }
  return readJson(queuePath);
}

function writeRetryPlan(path, retryPlan, batchIndexes) {
  if (batchIndexes.length > 0) {
    writeJson(path, retryPlan);
  } else {
    rmSync(path, { force: true });
  }
}

function invalidateQueueDownstreamArtifacts(intermediateRoot, queueFileName) {
  const staleArtifacts = queueFileName === 'file-doc-queue.json'
    ? [
      'accepted-file-documents.json',
      'validation-report.json',
      'file-writer-outputs.json',
      'file-doc-retry-plan.json',
      'topic-plan.json',
      'topic-batches.json',
      'topic-queue.json',
      'topic-retry-plan.json',
    ]
    : ['topic-retry-plan.json'];

  for (const name of staleArtifacts) {
    rmSync(join(intermediateRoot, name), { recursive: true, force: true });
  }

  if (queueFileName !== 'file-doc-queue.json' || !existsSync(intermediateRoot)) return;
  for (const entry of readdirSync(intermediateRoot)) {
    if (/^topic-batch-\d+\.json$/.test(entry)) {
      rmSync(join(intermediateRoot, entry), { force: true });
    }
  }
}

function reconcileQueueFromMergeRetries(queue, retryBatchIndexes, options = {}) {
  const retrySet = new Set(retryBatchIndexes);
  if (retrySet.size === 0) return queue;

  const now = options.now ?? new Date().toISOString();
  const matched = new Set();
  const baseReason = options.lastError && options.lastError.trim()
    ? options.lastError.trim()
    : 'writer output did not pass merge validation';

  const nextQueue = queue.map((entry) => {
    if (!retrySet.has(entry.batchIndex)) return entry;
    matched.add(entry.batchIndex);
    return {
      ...entry,
      status: entry.attempts >= 2 ? 'failed_terminal' : 'needs_retry',
      workerId: null,
      leasedAt: null,
      updatedAt: now,
      lastError: `${baseReason} (batch ${entry.batchIndex})`,
    };
  });

  if (matched.size !== retrySet.size) {
    const missing = [...retrySet].filter((batchIndex) => !matched.has(batchIndex));
    throw new Error(`merge retry batches missing from queue: ${missing.join(', ')}`);
  }

  return nextQueue;
}

function graphStats(graph) {
  const fileNodes = graph.nodes.filter((node) => node.type === 'file');
  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    fileNodes: fileNodes.length,
    functionNodes: graph.nodes.filter((node) => node.type === 'function').length,
    classNodes: graph.nodes.filter((node) => node.type === 'class').length,
  };
}

function sourceFilesForGraph(core, projectRoot, graph, maxSourceBytes) {
  const sourceFiles = {};
  const omittedFiles = [];
  let readBytes = 0;
  const sourceNodeTypes = new Set(['file', 'config', 'schema', 'document']);
  const sourcePaths = [...new Set(graph.nodes
    .filter((node) => sourceNodeTypes.has(node.type) && node.filePath)
    .map((node) => core.normalizeKnowledgeSourcePath(node.filePath))
    .filter(Boolean))].sort(compareStrings);
  for (const sourcePath of sourcePaths) {
    const absolute = join(projectRoot, sourcePath);
    if (!existsSync(absolute)) continue;
    const text = readFileSync(absolute, 'utf-8');
    const bytes = Buffer.byteLength(text, 'utf-8');
    if (readBytes + bytes > maxSourceBytes) {
      omittedFiles.push(sourcePath);
      continue;
    }
    sourceFiles[sourcePath] = text;
    readBytes += bytes;
  }
  return {
    sourceFiles,
    stats: {
      readFiles: Object.keys(sourceFiles).length,
      readBytes,
      omittedFiles,
      maxSourceBytes,
    },
  };
}

function printGraphStats(graph, sourceStats) {
  const stats = graphStats(graph);
  console.log(`图谱节点: ${stats.nodes}；边: ${stats.edges}；文件: ${stats.fileNodes}；函数: ${stats.functionNodes}；类: ${stats.classNodes}`);
  if (sourceStats) {
    console.log(`已读取源码文件: ${sourceStats.readFiles}；源码字节: ${sourceStats.readBytes} / ${sourceStats.maxSourceBytes}`);
    if (sourceStats.omittedFiles.length > 0) {
      console.log(`因源码读取上限跳过文件数: ${sourceStats.omittedFiles.length}`);
    }
  }
}

function assertDeterministicAllowed(graph, args) {
  if (args.allowLargeDeterministic) return;
  const stats = graphStats(graph);
  if (stats.nodes <= 5000 && stats.fileNodes <= 500) return;
  console.error('当前图谱较大，已跳过 deterministic-only 全量内存生成以保护本机内存。');
  console.error(`图谱节点: ${stats.nodes}；文件节点: ${stats.fileNodes}`);
  console.error('请使用 phased 模式运行 /understand-kb，或显式传入 --allow-large-deterministic。');
  process.exit(1);
}

function writeDocument(outputRoot, doc) {
  const target = join(outputRoot, doc.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, doc.content, 'utf-8');
}

function cleanOutputDocuments(outputRoot) {
  mkdirSync(outputRoot, { recursive: true });
  for (const entry of readdirSync(outputRoot, { withFileTypes: true })) {
    if (entry.name === '.intermediate') continue;
    rmSync(join(outputRoot, entry.name), { recursive: true, force: true });
  }
}

function wikiId(prefix, value) {
  return `${prefix}:${encodeURIComponent(String(value || 'unknown'))}`;
}

function compareStrings(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function uniqueSortedStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0))]
    .sort(compareStrings);
}

const MAX_RELATED_NODE_IDS = 24;

function markdownPathForDocument(doc) {
  return `knowledge-base/${doc.path.replace(/\\/g, '/').replace(/^\/+/, '')}`;
}

function wikiPageCategoryForDocument(category) {
  if (category === 'overview') return 'overview';
  if (category === 'module') return 'module';
  if (category === 'file') return 'file';
  if (category === 'flow') return 'flow';
  if (category === 'topic') return 'symbol';
  if (category === 'capability') return 'capability';
  if (category === 'quality' || category === 'coverage') return 'quality';
  if (category === 'report') return 'quality';
  if (category === 'top-level' || category === 'index') return 'overview';
  return 'other';
}

function wikiPageCategoryForNode(node) {
  if (node.type === 'domain') return 'capability';
  if (node.type === 'flow' || node.type === 'step') return 'flow';
  if (node.type === 'module') return 'module';
  if (node.type === 'file' || node.type === 'config' || node.type === 'document') return 'file';
  if (node.type === 'function' || node.type === 'class') return 'symbol';
  return 'other';
}

function relatedNodeIdsFor(graph, explainedNodeIds) {
  const explained = new Set(explainedNodeIds);
  const relatedById = new Map();
  for (const edge of graph.edges) {
    const relatedId = explained.has(edge.source) && !explained.has(edge.target)
      ? edge.target
      : explained.has(edge.target) && !explained.has(edge.source)
        ? edge.source
        : null;
    if (!relatedId) continue;
    const current = relatedById.get(relatedId);
    const weight = Number.isFinite(edge.weight) ? edge.weight : 0;
    if (!current || weight > current.weight) {
      relatedById.set(relatedId, { nodeId: relatedId, weight, type: edge.type || '' });
    }
  }
  return [...relatedById.values()]
    .sort((a, b) => b.weight - a.weight || compareStrings(a.type, b.type) || compareStrings(a.nodeId, b.nodeId))
    .slice(0, MAX_RELATED_NODE_IDS)
    .map((item) => item.nodeId);
}

function firstChineseSummaryLine(markdown) {
  for (const rawLine of String(markdown || '').split(/\r?\n/)) {
    const trimmedRawLine = rawLine.trim();
    if (!trimmedRawLine || trimmedRawLine.startsWith('#') || trimmedRawLine.startsWith('|') || trimmedRawLine.startsWith('```')) {
      continue;
    }
    const line = rawLine
      .trim()
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+[.)]\s+/, '')
      .replace(/[`*_>#]/g, '')
      .trim();
    if (line.length < 12 || !/\p{Script=Han}/u.test(line)) continue;
    return line.length > 220 ? `${line.slice(0, 219)}…` : line;
  }
  return '';
}

function summaryForDocument(doc, nodes) {
  const markdownSummary = firstChineseSummaryLine(doc.content);
  if (markdownSummary) return markdownSummary;
  const summarizedNode = nodes.find((node) => /\p{Script=Han}/u.test(node?.summary || ''));
  if (summarizedNode?.summary) return summarizedNode.summary;
  if (doc.directNodeIds.length > 0) {
    return `“${doc.title}”直接说明 ${doc.directNodeIds.length} 个代码对象，并把其余对象作为上下文。`;
  }
  return `“${doc.title}”是自动生成的知识库页面，用于提供项目说明和阅读导航。`;
}

function markdownSearchTerms(markdown) {
  const text = String(markdown || '');
  const headings = [...text.matchAll(/^#{1,3}\s+(.+)$/gm)]
    .map((match) => match[1].replace(/[`*_~#]/g, '').trim());
  const codeTerms = [...text.matchAll(/`([^`\n]{2,120})`/g)]
    .map((match) => match[1].trim());
  const aiSection = text.match(/^##\s+AI\s*检索(?:词|索引)\s*$([\s\S]*?)(?=^##\s|\s*$)/m)?.[1] || '';
  const aiTerms = aiSection
    .split(/[\n,，;；]+/)
    .map((value) => value.replace(/^[-*+]\s+/, '').replace(/[`*_~]/g, '').trim());
  return uniqueSortedStrings([...headings, ...codeTerms, ...aiTerms])
    .filter((value) => value.length <= 160)
    .slice(0, 160);
}

function searchTermsForDocument(doc, nodes) {
  return uniqueSortedStrings([
    doc.title,
    doc.path,
    ...markdownSearchTerms(doc.content),
    ...nodes.flatMap((node) => [node?.name, node?.id, node?.filePath, ...(node?.tags || [])]),
  ]).slice(0, 200);
}

function evidenceForNode(node) {
  const evidence = {
    id: wikiId('evidence', node.id),
    label: node.name || node.id,
    nodeIds: [node.id],
  };
  if (node.filePath) evidence.filePath = node.filePath;
  if (validLineRange(node.lineRange)) evidence.lineRange = node.lineRange;
  return evidence;
}

function validLineRange(lineRange) {
  return (
    Array.isArray(lineRange) &&
    lineRange.length === 2 &&
    Number.isInteger(lineRange[0]) &&
    Number.isInteger(lineRange[1]) &&
    lineRange[0] > 0 &&
    lineRange[1] >= lineRange[0]
  );
}

function gapSeverityForNode(node) {
  if (node.complexity === 'complex') return 'high';
  if (node.complexity === 'moderate') return 'medium';
  return 'low';
}

const PARTIAL_COVERAGE_CATEGORIES = new Set([
  'overview',
  'module',
  'quality',
  'coverage',
  'other',
]);

function pageQualityIssues(kb, doc) {
  const report = kb.coverageReport || {};
  const issues = [];
  if ((report.qualityValidation?.failed || []).includes(doc.path)) issues.push('正文质量校验未通过');
  if ((report.placeholderValidation?.failed || []).includes(doc.path)) issues.push('占位文本校验未通过');
  if ((report.chineseValidation?.failed || []).includes(doc.path)) issues.push('中文内容校验未通过');
  if ((kb.validation?.errors || []).some((error) => String(error).includes(doc.path))) {
    issues.push('文档结构校验未通过');
  }
  return uniqueSortedStrings(issues);
}

function pageQualityFor(doc, issues) {
  if (issues.length > 0) return 'low-confidence';
  if (doc.quality === 'verified') return 'verified';
  return 'generated';
}

function pageCoverageFor(doc, explainedNodeIds, nodes, quality) {
  if (explainedNodeIds.length === 0) return 'partial';
  if (PARTIAL_COVERAGE_CATEGORIES.has(doc.category)) return 'partial';
  if (quality === 'low-confidence') return 'partial';
  if (!nodes.some((node) => typeof node?.filePath === 'string' && node.filePath.length > 0)) return 'partial';
  return 'complete';
}

function graphDigest(graph) {
  return createHash('sha256').update(JSON.stringify(graph)).digest('hex');
}

function fallbackMarkdownPath(kb) {
  const overview = kb.documents.find((doc) => doc.path === '项目总览.md');
  const firstMarkdown = kb.documents.find((doc) => doc.path.endsWith('.md'));
  const fallbackDoc = overview ?? firstMarkdown;
  return fallbackDoc ? markdownPathForDocument(fallbackDoc) : 'knowledge-base/README.md';
}

function buildWikiIndexPayload(kb, options = {}) {
  const graph = kb.profile.graph;
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const evidenceById = new Map();
  const documentExplainedNodeIds = new Set();
  const pages = kb.documents.map((doc) => {
    const explainedNodeIds = uniqueSortedStrings(doc.directNodeIds.filter((nodeId) => nodesById.has(nodeId)));
    const contextualNodeIds = uniqueSortedStrings(doc.contextNodeIds.filter((nodeId) => nodesById.has(nodeId)));
    for (const nodeId of explainedNodeIds) documentExplainedNodeIds.add(nodeId);
    const nodes = explainedNodeIds.map((nodeId) => nodesById.get(nodeId));
    const qualityIssues = pageQualityIssues(kb, doc);
    const quality = pageQualityFor(doc, qualityIssues);
    const evidenceIds = [];
    for (const node of nodes) {
      const evidence = evidenceForNode(node);
      evidenceById.set(evidence.id, evidence);
      evidenceIds.push(evidence.id);
    }
    return {
      id: wikiId('wiki', doc.path),
      title: doc.title,
      category: wikiPageCategoryForDocument(doc.category),
      summary: summaryForDocument(doc, nodes),
      markdownPath: markdownPathForDocument(doc),
      explainedNodeIds,
      relatedNodeIds: contextualNodeIds.slice(0, MAX_RELATED_NODE_IDS),
      evidenceIds: uniqueSortedStrings(evidenceIds),
      coverage: pageCoverageFor(doc, explainedNodeIds, nodes, quality),
      quality,
      qualityIssues,
      searchTerms: searchTermsForDocument(doc, nodes),
    };
  });

  if (documentExplainedNodeIds.size === 0) {
    const markdownPath = fallbackMarkdownPath(kb);
    for (const node of graph.nodes) {
      const evidence = evidenceForNode(node);
      evidenceById.set(evidence.id, evidence);
      pages.push({
        id: wikiId('wiki-node', node.id),
        title: node.name || node.id,
        category: wikiPageCategoryForNode(node),
        summary: /\p{Script=Han}/u.test(node.summary || '')
          ? node.summary
          : `${node.name || node.id} 是 ${graph.project.name} 中尚待补充详细说明的代码对象。`,
        markdownPath,
        explainedNodeIds: [node.id],
        relatedNodeIds: relatedNodeIdsFor(graph, [node.id]),
        evidenceIds: [evidence.id],
        coverage: 'partial',
        quality: 'low-confidence',
        qualityIssues: ['尚无专门的 Wiki 正文'],
        searchTerms: uniqueSortedStrings([
          node.name,
          node.id,
          node.filePath,
          ...(node.tags || []),
        ]),
      });
    }
  }

  const gaps = graph.nodes
    .filter((node) => !documentExplainedNodeIds.has(node.id))
    .map((node) => ({
      id: wikiId('gap', node.id),
      nodeId: node.id,
      reason: '尚未生成能够充分解释该代码对象的 Wiki 页面。',
      severity: gapSeverityForNode(node),
    }));

  const generatedAt = new Date().toISOString();
  const source = {
    outputLanguage: 'zh-Hans',
    graphDigest: graphDigest(graph),
    generationMode: options.generationMode || 'unknown',
    coverageStatus: kb.coverageReport?.status || 'unknown',
  };
  if (graph.project.gitCommitHash) source.gitCommitHash = graph.project.gitCommitHash;
  if (graph.project.analyzedAt) source.graphAnalyzedAt = graph.project.analyzedAt;

  return {
    version: 1,
    generatedAt,
    projectName: graph.project.name,
    source,
    pages,
    evidence: [...evidenceById.values()].sort((a, b) => compareStrings(a.id, b.id)),
    gaps,
  };
}

function serializableProfile(kb) {
  return {
    project: kb.profile.graph.project,
    nodeCounts: kb.coverageReport.nodeCounts,
    edgeCounts: kb.coverageReport.edgeCounts,
    layerProfiles: kb.profile.layerProfiles,
    entryCandidates: kb.profile.entryCandidates,
    topicCandidates: kb.topicPlan.topics.map((topic) => ({
      nodeId: topic.topicNodeId,
      reasons: topic.reasons,
      tier: topic.tier,
    })),
    fileDocPlan: {
      tasks: kb.fileDocPlan.tasks.length,
      batches: kb.fileDocPlan.batches.length,
      warnings: kb.fileDocPlan.warnings,
    },
    topicPlan: {
      topics: kb.topicPlan.topics.length,
      batches: kb.topicPlan.batches.length,
      warnings: kb.topicPlan.warnings,
    },
    businessCapabilityProfile: kb.businessCapabilityProfile ? {
      facts: kb.businessCapabilityProfile.totalFacts,
      sourceBackedFacts: kb.businessCapabilityProfile.sourceBackedFacts,
      capabilities: kb.businessCapabilityProfile.capabilities.length,
    } : undefined,
    documentInventory: kb.documents.map((doc) => ({
      path: doc.path,
      title: doc.title,
      category: doc.category,
    })),
    coverageReport: kb.coverageReport,
    validation: kb.validation,
    retryPlan: kb.retryPlan,
  };
}

function statusLabel(status) {
  if (status === 'complete') return '完整';
  if (status === 'complete-with-warnings') return '完整但有警告';
  if (status === 'incomplete') return '不完整';
  return status;
}

function printCoverage(kb, outputRoot) {
  console.log(`知识库已生成: ${outputRoot}`);
  console.log(`生成 Markdown 文档数: ${kb.coverageReport.totalDocuments}`);
  console.log(`覆盖状态: ${statusLabel(kb.coverageReport.status)}`);
  console.log(`文件文档覆盖: ${kb.coverageReport.fileDocumentCoverage.covered} / ${kb.coverageReport.fileDocumentCoverage.total}`);
  console.log(`函数卡片覆盖: ${kb.coverageReport.functionCardCoverage.covered} / ${kb.coverageReport.functionCardCoverage.total}`);
  console.log(`类卡片覆盖: ${kb.coverageReport.classCardCoverage.covered} / ${kb.coverageReport.classCardCoverage.total}`);
  console.log(`业务事实覆盖: ${kb.coverageReport.businessFactCoverage.covered} / ${kb.coverageReport.businessFactCoverage.total}`);
  console.log(`业务能力文档: ${kb.coverageReport.businessCapabilityCoverage.covered} / ${kb.coverageReport.businessCapabilityCoverage.total}`);
  if (kb.coverageReport.qualityValidation) {
    const passed = kb.coverageReport.qualityValidation.checked - kb.coverageReport.qualityValidation.failed.length;
    console.log(`质量校验: ${passed} / ${kb.coverageReport.qualityValidation.checked}`);
  }
  if (kb.validation.warnings.length > 0) console.log(`警告数: ${kb.validation.warnings.length}`);
}

function loadGraph(core, projectRoot) {
  const { graphPath } = pathsFor(projectRoot);
  if (!existsSync(graphPath)) {
    console.error(`未找到知识图谱: ${graphPath}`);
    console.error('请先运行 /understand，再重新运行 /understand-kb。');
    process.exit(1);
  }

  const raw = readJson(graphPath);
  const validation = core.validateGraph(raw);
  if (!validation.success) {
    console.error('knowledge-graph.json 校验失败:');
    for (const issue of validation.issues) {
      console.error(`- ${issue.path}: ${issue.message}`);
    }
    process.exit(1);
  }
  return validation.data;
}

function loadKnowledgeBaseConfig(core, projectRoot) {
  return core.loadConfig(projectRoot).knowledgeBase ?? {};
}

function writeKnowledgeBase(outputRoot, kb, keepIntermediate = true, generationMode = 'writer-pool') {
  cleanOutputDocuments(outputRoot);
  for (const doc of kb.documents) writeDocument(outputRoot, doc);
  writeJson(join(outputRoot, 'wiki-index.json'), buildWikiIndexPayload(kb, { generationMode }));
  writeJson(join(outputRoot, 'knowledge-base-profile.json'), serializableProfile(kb));
  if (!keepIntermediate) rmSync(join(outputRoot, '.intermediate'), { recursive: true, force: true });
}

function deterministicGenerate(core, projectRoot, keepIntermediate, args) {
  const graph = loadGraph(core, projectRoot);
  assertDeterministicAllowed(graph, args);
  const { sourceFiles, stats } = sourceFilesForGraph(core, projectRoot, graph, args.maxSourceBytes);
  printGraphStats(graph, stats);
  const kb = core.generateKnowledgeBase(graph, {
    sourceFiles,
    knowledgeBaseConfig: loadKnowledgeBaseConfig(core, projectRoot),
  });
  const { outputRoot } = pathsFor(projectRoot);
  rmSync(outputRoot, { recursive: true, force: true });
  mkdirSync(outputRoot, { recursive: true });
  writeKnowledgeBase(outputRoot, kb, keepIntermediate, 'deterministic');
  printCoverage(kb, outputRoot);
}

function prepareFileDocs(core, projectRoot, maxSourceBytes) {
  const graph = loadGraph(core, projectRoot);
  const { sourceFiles, stats } = sourceFilesForGraph(core, projectRoot, graph, maxSourceBytes);
  printGraphStats(graph, stats);
  const profile = core.buildKnowledgeBaseProfile(graph);
  const fileDocPlan = core.buildFileDocPlan(profile, { sourceFiles });
  const { outputRoot, intermediateRoot } = pathsFor(projectRoot);

  rmSync(outputRoot, { recursive: true, force: true });
  mkdirSync(intermediateRoot, { recursive: true });
  writeJson(join(intermediateRoot, 'kb-profile.json'), {
    project: profile.graph.project,
    nodeCounts: profile.nodeCounts,
    edgeCounts: profile.edgeCounts,
    layerProfiles: profile.layerProfiles,
    entryCandidates: profile.entryCandidates,
  });
  writeJson(join(intermediateRoot, 'file-doc-plan.json'), fileDocPlan);
  writeJson(join(intermediateRoot, 'file-doc-batches.json'), fileDocPlan.batches);
  writeJson(join(intermediateRoot, 'file-doc-queue.json'), core.buildFileDocQueue(fileDocPlan, new Date().toISOString()));

  console.log(`已准备文件文档批次: ${fileDocPlan.batches.length}`);
  console.log(`文件文档任务数: ${fileDocPlan.tasks.length}`);
  console.log(`缺失源码文件数: ${fileDocPlan.tasks.filter((task) => !task.sourceSnapshot.exists).length}`);
}

function readBatchOutputs(intermediateRoot, prefix, parser) {
  if (!existsSync(intermediateRoot)) return [];
  const outputs = [];
  const pattern = new RegExp(`^${prefix}-(\\d+)\\.json$`);
  for (const entry of readdirSync(intermediateRoot).sort()) {
    const match = entry.match(pattern);
    if (!match) continue;
    const path = join(intermediateRoot, entry);
    const parsed = parser(readJson(path));
    if (!parsed.ok) {
      console.error(`${entry} 未通过契约校验:`);
      for (const error of parsed.errors) console.error(`- ${error}`);
      process.exit(1);
    }
    outputs.push(parsed.value);
  }
  return outputs.sort((a, b) => a.batchIndex - b.batchIndex);
}

function loadProfileAndFilePlan(core, projectRoot, maxSourceBytes = 64 * 1024 * 1024) {
  const graph = loadGraph(core, projectRoot);
  const { sourceFiles, stats } = sourceFilesForGraph(core, projectRoot, graph, maxSourceBytes);
  printGraphStats(graph, stats);
  const profile = core.buildKnowledgeBaseProfile(graph);
  const fileDocPlan = core.buildFileDocPlan(profile, { sourceFiles });
  return { graph, profile, fileDocPlan };
}

function leaseBatch(core, projectRoot, queueFileName, options) {
  const { intermediateRoot } = pathsFor(projectRoot);
  const queuePath = join(intermediateRoot, queueFileName);
  const queue = requireQueue(queuePath, `未找到队列文件: ${queuePath}`);
  const now = new Date().toISOString();
  const current = options.resume
    ? core.reclaimExpiredLeases(queue, { now, maxLeaseAgeMs: 30 * 60 * 1000 })
    : queue;
  const leased = core.leaseNextQueueEntry(current, {
    workerId: options.workerId,
    now,
  });
  writeJson(queuePath, leased.queue);
  console.log(JSON.stringify(leased.leased ?? null, null, 2));
}

function completeBatch(core, projectRoot, queueFileName, args) {
  const { intermediateRoot } = pathsFor(projectRoot);
  const queuePath = join(intermediateRoot, queueFileName);
  const queue = requireQueue(queuePath, `未找到队列文件: ${queuePath}`);
  const now = new Date().toISOString();
  const nextQueue = args.resultStatus === 'succeeded'
    ? core.markQueueEntrySucceeded(queue, {
      batchIndex: args.batchIndex,
      workerId: args.workerId,
      now,
    })
    : core.markQueueEntryNeedsRetry(queue, {
      batchIndex: args.batchIndex,
      workerId: args.workerId,
      now,
      reason: args.resultStatus || 'writer output did not pass validation',
    });

  if (JSON.stringify(nextQueue) === JSON.stringify(queue)) {
    console.error(`未能更新队列条目: batchIndex=${args.batchIndex}, workerId=${args.workerId}, resultStatus=${args.resultStatus || 'needs_retry'}`);
    process.exit(1);
  }

  writeJson(queuePath, nextQueue);
  invalidateQueueDownstreamArtifacts(intermediateRoot, queueFileName);
}

function mergeFileDocs(core, projectRoot, maxSourceBytes) {
  const { profile, fileDocPlan } = loadProfileAndFilePlan(core, projectRoot, maxSourceBytes);
  const { outputRoot, intermediateRoot } = pathsFor(projectRoot);
  const fileQueuePath = join(intermediateRoot, 'file-doc-queue.json');
  const fileQueue = requireQueue(fileQueuePath, '未找到文件阶段队列。请先运行 --prepare-file-docs。');
  const fileWriterOutputs = readBatchOutputs(intermediateRoot, 'file-doc-batch', core.parseFileWriterBatchOutput);
  const merged = core.mergeKnowledgeBaseWriterOutputs({ profile, fileDocPlan, fileWriterOutputs });
  const reconciledQueue = reconcileQueueFromMergeRetries(fileQueue, merged.retryPlan.fileBatchIndexes, {
    now: new Date().toISOString(),
    lastError: merged.retryPlan.reasons[0] ?? 'file writer output did not pass merge validation',
  });

  mkdirSync(intermediateRoot, { recursive: true });
  writeJson(join(intermediateRoot, 'validation-report.json'), merged.validation);
  writeJson(join(intermediateRoot, 'accepted-file-documents.json'), merged.acceptedFileWriterDocuments);
  writeJson(join(intermediateRoot, 'file-writer-outputs.json'), fileWriterOutputs);
  writeJson(fileQueuePath, reconciledQueue);
  writeRetryPlan(join(intermediateRoot, 'file-doc-retry-plan.json'), merged.retryPlan, merged.retryPlan.fileBatchIndexes);

  console.log(`已接受文件文档数: ${merged.acceptedFileWriterDocuments.length}`);
  console.log(`需要重试的文件写作批次数: ${merged.retryPlan.fileBatchIndexes.length}`);
}

function prepareTopics(core, projectRoot, maxSourceBytes, args) {
  const { profile, fileDocPlan } = loadProfileAndFilePlan(core, projectRoot, maxSourceBytes);
  const { intermediateRoot } = pathsFor(projectRoot);
  const acceptedPath = join(intermediateRoot, 'accepted-file-documents.json');
  if (!existsSync(acceptedPath)) {
    console.error('未找到已接受的文件文档。请先运行 --merge-file-docs。');
    process.exit(1);
  }
  const fileQueuePath = join(intermediateRoot, 'file-doc-queue.json');
  const fileQueue = requireQueue(fileQueuePath, '未找到文件阶段队列。请先运行 --prepare-file-docs。');
  const fileQueueSummary = core.summarizeQueue(fileQueue);
  if (unresolvedQueue(fileQueueSummary)) {
    console.error('文件阶段尚未完成，不能进入专题阶段。');
    process.exit(1);
  }
  const acceptedFileDocs = readJson(acceptedPath);
  const topicPlan = core.buildTopicPlan(profile, fileDocPlan, acceptedFileDocs);
  writeJson(join(intermediateRoot, 'topic-plan.json'), topicPlan);
  writeJson(join(intermediateRoot, 'topic-batches.json'), topicPlan.batches);
  writeJson(
    join(intermediateRoot, 'topic-queue.json'),
    core.buildTopicQueue(topicPlan, {
      includeExtendedTopics: args.includeExtendedTopics,
      now: new Date().toISOString(),
    }),
  );

  console.log(`已准备专题批次: ${topicPlan.batches.length}`);
  console.log(`计划生成专题文档数: ${topicPlan.topics.length}`);
}

function finalizeKnowledgeBase(core, projectRoot, keepIntermediate, maxSourceBytes) {
  const { graph, profile, fileDocPlan } = loadProfileAndFilePlan(core, projectRoot, maxSourceBytes);
  const { outputRoot, intermediateRoot } = pathsFor(projectRoot);
  const fileQueuePath = join(intermediateRoot, 'file-doc-queue.json');
  const fileQueue = requireQueue(fileQueuePath, '未找到文件阶段队列。请先运行 --prepare-file-docs。');
  const topicQueuePath = join(intermediateRoot, 'topic-queue.json');
  const topicQueue = requireQueue(topicQueuePath, '未找到专题阶段队列。请先运行 --prepare-topics。');
  const topicQueueSummary = core.summarizeQueue(topicQueue);
  if (unresolvedQueue(topicQueueSummary)) {
    console.error('专题阶段尚未完成，不能进入 finalize 成功态。');
    process.exit(1);
  }
  const fileWriterOutputs = readBatchOutputs(intermediateRoot, 'file-doc-batch', core.parseFileWriterBatchOutput);
  const fileMerged = core.mergeKnowledgeBaseWriterOutputs({ profile, fileDocPlan, fileWriterOutputs });
  const topicPlanPath = join(intermediateRoot, 'topic-plan.json');
  const topicPlan = existsSync(topicPlanPath)
    ? readJson(topicPlanPath)
    : core.buildTopicPlan(profile, fileDocPlan, fileMerged.acceptedFileWriterDocuments);
  const topicWriterOutputs = readBatchOutputs(intermediateRoot, 'topic-batch', core.parseTopicWriterBatchOutput);
  const merged = core.mergeKnowledgeBaseWriterOutputs({
    profile,
    fileDocPlan,
    fileWriterOutputs,
    topicWriterOutputs,
  });
  const reconciledFileQueue = reconcileQueueFromMergeRetries(fileQueue, fileMerged.retryPlan.fileBatchIndexes, {
    now: new Date().toISOString(),
    lastError: fileMerged.retryPlan.reasons[0] ?? 'file writer output did not pass merge validation',
  });
  const reconciledTopicQueue = reconcileQueueFromMergeRetries(topicQueue, merged.retryPlan.topicBatchIndexes, {
    now: new Date().toISOString(),
    lastError: merged.retryPlan.reasons[0] ?? 'topic writer output did not pass merge validation',
  });
  writeJson(fileQueuePath, reconciledFileQueue);
  writeJson(topicQueuePath, reconciledTopicQueue);
  writeRetryPlan(join(intermediateRoot, 'file-doc-retry-plan.json'), fileMerged.retryPlan, fileMerged.retryPlan.fileBatchIndexes);
  writeRetryPlan(join(intermediateRoot, 'topic-retry-plan.json'), merged.retryPlan, merged.retryPlan.topicBatchIndexes);

  const reconciledFileSummary = core.summarizeQueue(reconciledFileQueue);
  const reconciledTopicSummary = core.summarizeQueue(reconciledTopicQueue);
  if (
    unresolvedQueue(reconciledFileSummary) ||
    unresolvedQueue(reconciledTopicSummary) ||
    fileMerged.retryPlan.fileBatchIndexes.length > 0 ||
    merged.retryPlan.topicBatchIndexes.length > 0
  ) {
    console.error('merge 校验仍存在待重试批次，不能输出最终知识库。');
    process.exit(1);
  }

  const businessCapabilityProfile = core.buildBusinessCapabilityProfile(profile, fileDocPlan);
  const kb = core.materializeKnowledgeBase({
    profile,
    fileDocPlan,
    businessCapabilityProfile,
    topicPlan,
    merged,
    options: {
      generationMode: 'writer',
      knowledgeBaseConfig: loadKnowledgeBaseConfig(core, projectRoot),
    },
  });

  if (graph.project.gitCommitHash !== profile.graph.project.gitCommitHash) {
    console.warn('警告: 生成最终知识库时图谱元数据发生变化。');
  }
  writeKnowledgeBase(outputRoot, kb, keepIntermediate);
  printCoverage(kb, outputRoot);
}

function printRetryPlan(projectRoot) {
  const { intermediateRoot } = pathsFor(projectRoot);
  const retryFiles = ['file-doc-retry-plan.json', 'topic-retry-plan.json']
    .map((name) => join(intermediateRoot, name))
    .filter((path) => existsSync(path));
  if (retryFiles.length === 0) {
    console.log('未找到重试计划。');
    return;
  }
  for (const path of retryFiles) {
    console.log(`${path}:`);
    console.log(readFileSync(path, 'utf-8'));
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const core = await loadCore();

  if (args.deterministicOnly || args.phase === 'deterministic') {
    deterministicGenerate(core, args.projectRoot, args.keepIntermediate, args);
  } else if (args.phase === 'prepare-file-docs') {
    prepareFileDocs(core, args.projectRoot, args.maxSourceBytes);
  } else if (args.phase === 'merge-file-docs') {
    mergeFileDocs(core, args.projectRoot, args.maxSourceBytes);
  } else if (args.phase === 'prepare-topics') {
    prepareTopics(core, args.projectRoot, args.maxSourceBytes, args);
  } else if (args.phase === 'lease-file-batch') {
    leaseBatch(core, args.projectRoot, 'file-doc-queue.json', args);
  } else if (args.phase === 'lease-topic-batch') {
    leaseBatch(core, args.projectRoot, 'topic-queue.json', args);
  } else if (args.phase === 'complete-file-batch') {
    completeBatch(core, args.projectRoot, 'file-doc-queue.json', args);
  } else if (args.phase === 'complete-topic-batch') {
    completeBatch(core, args.projectRoot, 'topic-queue.json', args);
  } else if (args.phase === 'finalize') {
    finalizeKnowledgeBase(core, args.projectRoot, args.keepIntermediate, args.maxSourceBytes);
  } else if (args.phase === 'retry') {
    printRetryPlan(args.projectRoot);
  } else {
    console.error(`未知阶段: ${args.phase}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
