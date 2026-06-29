#!/usr/bin/env node
/**
 * generate-knowledge-base.mjs
 *
 * 从 .understand-anything/knowledge-graph.json 生成 Markdown 知识库。
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
  const outputRoot = join(projectRoot, '.understand-anything', 'knowledge-base');
  const intermediateRoot = join(outputRoot, '.intermediate');
  return {
    graphPath: join(projectRoot, '.understand-anything', 'knowledge-graph.json'),
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
  execFileSync('pnpm', ['--filter', '@understand-anything/core', 'build'], {
    cwd: pluginRoot,
    stdio: 'inherit',
  });
}

async function loadCore() {
  ensureCoreBuilt();
  try {
    return await import(pathToFileURL(require.resolve('@understand-anything/core')).href);
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

function sourceFilesForGraph(projectRoot, graph, maxSourceBytes) {
  const sourceFiles = {};
  const omittedFiles = [];
  let readBytes = 0;
  for (const node of graph.nodes) {
    if (node.type !== 'file' || !node.filePath) continue;
    const absolute = join(projectRoot, node.filePath);
    if (!existsSync(absolute)) continue;
    const text = readFileSync(absolute, 'utf-8');
    const bytes = Buffer.byteLength(text, 'utf-8');
    if (readBytes + bytes > maxSourceBytes) {
      omittedFiles.push(node.filePath);
      continue;
    }
    sourceFiles[node.filePath] = text;
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

function serializableProfile(kb) {
  return {
    project: kb.profile.graph.project,
    nodeCounts: kb.coverageReport.nodeCounts,
    edgeCounts: kb.coverageReport.edgeCounts,
    layerProfiles: kb.profile.layerProfiles,
    entryCandidates: kb.profile.entryCandidates,
    topicCandidates: kb.plan.topicCandidates,
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

function writeKnowledgeBase(outputRoot, kb, keepIntermediate = true) {
  cleanOutputDocuments(outputRoot);
  for (const doc of kb.documents) writeDocument(outputRoot, doc);
  writeJson(join(outputRoot, 'knowledge-base-profile.json'), serializableProfile(kb));
  if (!keepIntermediate) rmSync(join(outputRoot, '.intermediate'), { recursive: true, force: true });
}

function deterministicGenerate(core, projectRoot, keepIntermediate, args) {
  const graph = loadGraph(core, projectRoot);
  assertDeterministicAllowed(graph, args);
  const { sourceFiles, stats } = sourceFilesForGraph(projectRoot, graph, args.maxSourceBytes);
  printGraphStats(graph, stats);
  const kb = core.generateKnowledgeBase(graph, { sourceFiles });
  const { outputRoot } = pathsFor(projectRoot);
  rmSync(outputRoot, { recursive: true, force: true });
  mkdirSync(outputRoot, { recursive: true });
  writeKnowledgeBase(outputRoot, kb, keepIntermediate);
  printCoverage(kb, outputRoot);
}

function prepareFileDocs(core, projectRoot, maxSourceBytes) {
  const graph = loadGraph(core, projectRoot);
  const { sourceFiles, stats } = sourceFilesForGraph(projectRoot, graph, maxSourceBytes);
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
  const { sourceFiles, stats } = sourceFilesForGraph(projectRoot, graph, maxSourceBytes);
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
  for (const doc of merged.fileDocuments) writeDocument(outputRoot, doc);

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

  const validation = {
    ok: merged.validation.ok,
    errors: merged.validation.errors,
    warnings: [...new Set([...merged.validation.warnings, ...topicPlan.warnings])].sort(),
  };
  const businessCapabilityProfile = core.buildBusinessCapabilityProfile(profile, fileDocPlan);
  const plan = core.buildDocumentPlan(profile);
  const supportDocuments = core.renderKnowledgeBaseDocuments(profile, plan, fileDocPlan, topicPlan, merged);
  const businessDocuments = core.renderBusinessCapabilityDocuments(profile, businessCapabilityProfile);
  const preliminaryDocuments = [...supportDocuments, ...businessDocuments, ...merged.fileDocuments, ...merged.topicDocuments];
  const coverageReport = core.buildCoverageReport(profile, fileDocPlan, topicPlan, preliminaryDocuments, validation, merged.retryPlan, businessCapabilityProfile);
  const finalSupportDocuments = core.renderKnowledgeBaseDocuments(profile, plan, fileDocPlan, topicPlan, merged, coverageReport, validation);
  const documents = [...finalSupportDocuments, ...businessDocuments, ...merged.fileDocuments, ...merged.topicDocuments]
    .sort((a, b) => a.path.localeCompare(b.path) || a.title.localeCompare(b.title));
  const kb = {
    profile,
    businessCapabilityProfile,
    plan,
    fileDocPlan,
    topicPlan,
    documents,
    validation,
    coverageReport,
    retryPlan: merged.retryPlan,
  };

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
