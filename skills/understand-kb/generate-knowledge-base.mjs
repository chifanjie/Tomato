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
import { basename, dirname, isAbsolute, relative, resolve, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, '../..');
const require = createRequire(resolve(pluginRoot, 'package.json'));

let selectedGraphPath;

function parseArgs(argv) {
  const args = {
    projectRoot: process.cwd(),
    sourceRoot: null,
    outputRoot: null,
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
    if (arg === '--regenerate' || arg === '--migrate-legacy') { args.phase = 'deterministic'; args.deterministicOnly = true; }
    else if (arg === '--prepare-file-docs') args.phase = 'prepare-file-docs';
    else if (arg === '--merge-file-docs') args.phase = 'merge-file-docs';
    else if (arg === '--prepare-topics') args.phase = 'prepare-topics';
    else if (arg === '--prepare-featured') args.phase = 'prepare-featured';
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
    else if (arg === '--graph-path') {
      args.graphPath = resolve(argv[index + 1] ?? '');
      index += 1;
    }
    else if (arg === '--source-root') {
      args.sourceRoot = resolve(argv[index + 1] ?? '');
      index += 1;
    }
    else if (arg === '--output-root') {
      args.outputRoot = resolve(argv[index + 1] ?? '');
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
        throw new Error('Knowledge writer phase failed; see diagnostics above.');
      }
      args.maxSourceBytes = Math.floor(value * 1024 * 1024);
      index += 1;
    }
    else if (!arg.startsWith('--')) args.projectRoot = resolve(arg);
  }
  args.sourceRoot = resolve(args.sourceRoot || args.projectRoot);
  args.outputRoot = resolve(args.outputRoot || join(args.sourceRoot, '.understand-code', 'knowledge-base'));
  return args;
}

function pathsFor(sourceRoot, outputRoot) {
  const knowledgeRoot = outputRoot || join(sourceRoot, '.understand-code', 'knowledge-base');
  return {
    graphPath: selectedGraphPath ?? join(sourceRoot, '.understand-code', 'knowledge-graph.json'),
    configPath: join(sourceRoot, '.understand-code', 'config.json'),
    sourceRoot,
    outputRoot: knowledgeRoot,
    intermediateRoot: join(knowledgeRoot, '.intermediate'),
  };
}

function knowledgeBaseOutputLanguage(config) {
  const configured = config.outputLanguage?.trim();
  if (!configured) return 'zh-CN';
  return /^(?:zh|zh-cn|zh-hans)$/i.test(configured) ? 'zh-CN' : configured;
}

function isWithin(parent, child) {
  const relativePath = relative(resolve(parent), resolve(child));
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}

function canonicalPathFromNearestExisting(path) {
  let current = resolve(path);
  const suffix = [];
  while (true) {
    try {
      lstatSync(current);
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
      const parent = dirname(current);
      if (parent === current) throw error;
      suffix.unshift(basename(current));
      current = parent;
      continue;
    }
    return resolve(realpathSync(current), ...suffix);
  }
}

function assertNoSymlinksInsideOutput(outputRoot) {
  const stack = [resolve(outputRoot)];
  while (stack.length > 0) {
    const current = stack.pop();
    let stats;
    try {
      stats = lstatSync(current);
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') continue;
      throw new Error('无法安全检查输出目录。');
    }
    if (stats.isSymbolicLink()) {
      throw new Error('输出目录包含不安全的符号链接。');
    }
    if (!stats.isDirectory()) continue;
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      throw new Error('无法安全检查输出目录。');
    }
    for (const entry of entries) stack.push(join(current, entry));
  }
}

function assertNoSymlinkComponents(trustedRoot, targetPath) {
  const relativePath = relative(resolve(trustedRoot), resolve(targetPath));
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error('输出目录超出可信发布边界。');
  }
  let current = resolve(trustedRoot);
  for (const segment of relativePath.split(/[\\/]+/).filter(Boolean)) {
    current = join(current, segment);
    let stats;
    try {
      stats = lstatSync(current);
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return;
      throw new Error('无法安全检查输出目录。');
    }
    if (stats.isSymbolicLink()) {
      throw new Error('输出目录不能经过符号链接祖先。');
    }
  }
}

function trustedExistingOutputBoundary(outputRoot) {
  let current = resolve(outputRoot);
  while (true) {
    let stats;
    try {
      stats = lstatSync(current);
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') {
        throw new Error('无法安全检查输出目录。');
      }
      const parent = dirname(current);
      if (parent === current) throw new Error('无法确定可信输出边界。');
      current = parent;
      continue;
    }
    if (stats.isSymbolicLink()) {
      throw new Error('输出目录不能经过符号链接祖先。');
    }
    if (!stats.isDirectory()) {
      throw new Error('输出目录不是可安全发布的目录。');
    }
    return current;
  }
}

function assertSafeOutputRoot(sourceRoot, outputRoot) {
  const paths = pathsFor(sourceRoot, outputRoot);
  const defaultKnowledgeRoot = join(paths.sourceRoot, '.understand-code', 'knowledge-base');
  const lexicalOutputContainsProtectedPath = [paths.sourceRoot, paths.graphPath, paths.configPath]
    .some((protectedPath) => isWithin(paths.outputRoot, protectedPath));
  const lexicalOutputInsideSource = isWithin(paths.sourceRoot, paths.outputRoot);
  const lexicalOutputInsideDefaultKnowledgeRoot = isWithin(defaultKnowledgeRoot, paths.outputRoot);
  // The packaged Task writer owns exactly one ULID-named draft directory.
  // Do not permit the drafts parent or arbitrary directories in the source tree.
  const taskDraftRelative = relative(paths.sourceRoot, paths.outputRoot).split(sep).join('/');
  const lexicalTaskDraft = /^\.understand-code\/knowledge-drafts\/[0-9A-HJKMNP-TV-Z]{26}$/u.test(taskDraftRelative);

  let canonicalSourceRoot;
  let canonicalOutputRoot;
  let canonicalDefaultKnowledgeRoot;
  let canonicalGraphPath;
  let canonicalConfigPath;
  try {
    canonicalSourceRoot = canonicalPathFromNearestExisting(paths.sourceRoot);
    canonicalOutputRoot = canonicalPathFromNearestExisting(paths.outputRoot);
    canonicalDefaultKnowledgeRoot = canonicalPathFromNearestExisting(defaultKnowledgeRoot);
    canonicalGraphPath = canonicalPathFromNearestExisting(paths.graphPath);
    canonicalConfigPath = canonicalPathFromNearestExisting(paths.configPath);
  } catch {
    throw new Error('无法安全解析输出目录。');
  }

  const canonicalOutputContainsProtectedPath = [canonicalSourceRoot, canonicalGraphPath, canonicalConfigPath]
    .some((protectedPath) => isWithin(canonicalOutputRoot, protectedPath));
  const canonicalOutputInsideSource = isWithin(canonicalSourceRoot, canonicalOutputRoot);
  const canonicalOutputInsideDefaultKnowledgeRoot = isWithin(
    canonicalDefaultKnowledgeRoot,
    canonicalOutputRoot,
  );
  const crossesSourceBoundary = lexicalOutputInsideSource !== canonicalOutputInsideSource;
  const canonicalTaskDraft = lexicalTaskDraft
    && canonicalOutputRoot === resolve(canonicalSourceRoot, taskDraftRelative);

  if (
    lexicalOutputContainsProtectedPath
    || canonicalOutputContainsProtectedPath
    || crossesSourceBoundary
    || (lexicalOutputInsideSource && !lexicalOutputInsideDefaultKnowledgeRoot && !lexicalTaskDraft)
    || (canonicalOutputInsideSource && !canonicalOutputInsideDefaultKnowledgeRoot && !canonicalTaskDraft)
  ) {
    throw new Error('输出目录不能覆盖源码或图谱目录。');
  }

  if (lexicalOutputInsideSource) {
    assertNoSymlinkComponents(paths.sourceRoot, paths.outputRoot);
  } else {
    const trustedOutputBoundary = trustedExistingOutputBoundary(paths.outputRoot);
    assertNoSymlinkComponents(trustedOutputBoundary, paths.outputRoot);
  }

  if (!lexicalOutputInsideSource && existsSync(paths.outputRoot)) {
    let entries;
    try {
      entries = readdirSync(paths.outputRoot);
    } catch {
      throw new Error('输出目录不是可安全发布的目录。');
    }
    if (
      entries.length > 0
      && !existsSync(join(paths.outputRoot, 'wiki-index.json'))
      && !existsSync(join(paths.outputRoot, '.intermediate'))
    ) {
      throw new Error('非空输出目录缺少知识库标记，已拒绝覆盖。');
    }
  }
  assertNoSymlinksInsideOutput(paths.outputRoot);
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

function writeJsonAtomic(path, value, compact = false) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(value, null, compact ? undefined : 2), 'utf-8');
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
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
    throw new Error('Knowledge writer phase failed; see diagnostics above.');
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

function sourceFilesForGraph(sourceRoot, graph, maxSourceBytes) {
  const sourceFiles = {};
  const omittedFiles = [];
  let readBytes = 0;
  const sourceNodeTypes = new Set(['file', 'config', 'schema', 'document']);
  const sourcePaths = [...new Set(graph.nodes
    .filter((node) => sourceNodeTypes.has(node.type) && node.filePath)
    .map((node) => node.filePath
      .trim()
      .replace(/\\/g, '/')
      .replace(/\/{2,}/g, '/')
      .replace(/^(?:\.\/)+/, '')
      .replace(/\/\.\//g, '/'))
    .filter(Boolean))].sort();
  const root = resolve(sourceRoot);
  const canonicalRoot = canonicalPathFromNearestExisting(root);
  for (const sourcePath of sourcePaths) {
    const absolute = resolve(root, sourcePath);
    const relativePath = relative(root, absolute);
    let canonicalAbsolute;
    try {
      canonicalAbsolute = canonicalPathFromNearestExisting(absolute);
    } catch {
      omittedFiles.push(sourcePath);
      continue;
    }
    const canonicalRelativePath = relative(canonicalRoot, canonicalAbsolute);
    if (
      relativePath.startsWith('..')
      || isAbsolute(relativePath)
      || canonicalRelativePath.startsWith('..')
      || isAbsolute(canonicalRelativePath)
      || !existsSync(absolute)
    ) {
      omittedFiles.push(sourcePath);
      continue;
    }
    let text;
    try {
      text = readFileSync(absolute, 'utf-8');
    } catch {
      omittedFiles.push(sourcePath);
      continue;
    }
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
      console.log(`未读取源码文件数: ${sourceStats.omittedFiles.length}`);
    }
  }
}

function assertDeterministicAllowed(graph, args) {
  if (args.allowLargeDeterministic) return;
  const stats = graphStats(graph);
  if (stats.nodes <= 5000 && stats.fileNodes <= 500) return;
  console.warn('当前图谱较大，deterministic-only 将自动使用文件级安全投影，避免一次性展开符号文档导致内存峰值过高。');
  console.warn(`完整图谱节点: ${stats.nodes}；文件节点: ${stats.fileNodes}`);
}

function isLargeGraph(graph) {
  const stats = graphStats(graph);
  return stats.nodes > 5000 || stats.fileNodes > 500;
}

/**
 * Build the bounded graph used to materialize the deterministic Wiki.
 *
 * The full graph remains the source of truth on disk and is addressed by the
 * digest written into the Wiki artifacts.  The projection contains every
 * source/document/config node and only edges between those nodes.  This keeps
 * the Wiki useful for repository navigation while preventing the artifact
 * builder from duplicating tens of thousands of symbol records in memory.
 */
function projectLargeGraph(graph) {
  const sourceTypes = new Set(['file', 'config', 'schema', 'document']);
  const sourceNodes = graph.nodes.filter((node) => sourceTypes.has(node.type));
  // Keep a bounded set of high-value symbols so the deterministic Wiki can
  // still explain real service entry points without materializing every
  // symbol in a very large repository.
  const symbolPriority = (node) => {
    const path = (node.filePath ?? '').replace(/\\/gu, '/');
    const name = node.name ?? '';
    if (/(^|\/)(?:tests?|__tests__|fixtures?|vendor|thirdparty|generated)(\/|$)/iu.test(path)
      || /(?:_test\.go|\.(?:test|spec)\.[^.]+|ttypes\.go)$/iu.test(path)) return 99;
    if (/(^|\/)(?:main|__main__)\.[^.]+$/iu.test(path)) return 0;
    if (/^(?:main|bootstrap|start|serve|run|init.*server)$/iu.test(name)) return 1;
    if (/(^|\/)(?:server|servers|api|routes?|controllers?|cmd|cli)(\/|$)/iu.test(path)) return 2;
    if (/(?:handler|controller|router|registry|manager)/iu.test(path)
      && /^(?:init|new|get|handle|serve|process|execute|register)/iu.test(name)) return 3;
    if (/(^|\/)(?:logic|strategy|strategies|services?)(\/|$)/iu.test(path)
      && /^(?:init|handle|process|execute|recommend|recall|genresp)/iu.test(name)) return 4;
    return 99;
  };
  const symbolNodes = graph.nodes
    .filter((node) => (node.type === 'function' || node.type === 'class') && symbolPriority(node) < 99)
    .sort((left, right) => symbolPriority(left) - symbolPriority(right) || left.id.localeCompare(right.id))
    .slice(0, 400);
  const nodes = [...sourceNodes, ...symbolNodes];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  const layers = (graph.layers ?? []).map((layer) => ({
    ...layer,
    nodeIds: (layer.nodeIds ?? []).filter((nodeId) => nodeIds.has(nodeId)),
  }));
  const tour = (graph.tour ?? []).map((step) => ({
    ...step,
    nodeIds: (step.nodeIds ?? []).filter((nodeId) => nodeIds.has(nodeId)),
  }));
  return { ...graph, nodes, edges, layers, tour };
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

function loadGraph(core, sourceRoot) {
  const { graphPath } = pathsFor(sourceRoot);
  if (!existsSync(graphPath)) {
    console.error(`未找到知识图谱: ${graphPath}`);
    console.error('请先运行 /understand，再重新运行 /understand-kb。');
    throw new Error('Knowledge writer phase failed; see diagnostics above.');
  }

  const raw = readJson(graphPath);
  const validation = core.validateGraph(raw);
  if (!validation.success) {
    console.error('knowledge-graph.json 校验失败:');
    for (const issue of validation.issues) {
      console.error(`- ${issue.path}: ${issue.message}`);
    }
    throw new Error('Knowledge writer phase failed; see diagnostics above.');
  }
  return validation.data;
}

function buildArtifacts(core, {
  sourceRoot,
  graph,
  graphDigestOverride,
  generationNodeCount,
  config,
  sourceStats,
  generationMode,
  fileDocPlan,
  requiredRouteStages = [],
  documents = [],
  warnings = [],
  errors = [],
}) {
  return core.buildKnowledgeArtifacts({
    projectName: graph.project.name,
    generatedAt: new Date().toISOString(),
    outputLanguage: knowledgeBaseOutputLanguage(config),
    generationMode,
    graphDigest: graphDigestOverride ?? createHash('sha256').update(JSON.stringify(graph)).digest('hex'),
    gitCommitHash: graph.project.gitCommitHash,
    sourceRootIdentity: resolve(sourceRoot),
    sourceRead: {
      covered: sourceStats.readFiles,
      total: fileDocPlan.tasks.length,
      missingIds: fileDocPlan.tasks
        .filter((task) => !task.sourceSnapshot.exists)
        .map((task) => task.fileNodeId)
        .sort(),
    },
    requiredRouteStages,
    businessTerms: config.knowledgeBase?.businessTerms ?? [],
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      name: node.name,
      ...(node.filePath ? { filePath: node.filePath } : {}),
    })),
    referenceFileNodeIds: core.referenceFileNodeIdsForGraph(graph),
    generationNodeCount: generationNodeCount ?? graph.nodes.length,
    documents,
    warnings,
    errors,
  });
}

/**
 * Publishes source excerpts as shards next to the index and returns the index
 * with excerpts removed.
 *
 * Excerpts are the bulk of the index (8.4 MB of 11.7 MB for this repository)
 * and grow with total source size, so keeping them inline makes first paint
 * scale with the repository rather than with the navigation model. The reader
 * fetches only the shards for the page it shows.
 */
function publishExcerptShards(core, outputRoot, wikiIndex) {
  const { descriptor, shards } = core.buildExcerptShards(wikiIndex.evidence);
  const shardDir = join(outputRoot, descriptor.pathPrefix);

  // Drop shards from an earlier run so a shrunken store leaves nothing stale.
  rmSync(shardDir, { recursive: true, force: true });
  mkdirSync(shardDir, { recursive: true });
  shards.forEach((shard, index) => {
    writeJsonAtomic(join(shardDir, core.shardFileName(index)), shard);
  });

  return {
    ...wikiIndex,
    evidence: wikiIndex.evidence.map(({ excerpt: _excerpt, ...rest }) => rest),
    excerptStore: descriptor,
  };
}

function publishZeroSourceReport(outputRoot, artifacts) {
  writeJsonAtomic(join(outputRoot, '.trace/generation-report.json'), artifacts.generationReport);
  console.error('未读取到任何源码，正式知识库未发布。');
  process.exitCode = 1;
}

function publishKnowledgeBase(core, outputRoot, kb, artifacts, keepIntermediate = true) {
  const payloads = [
    artifacts.wikiIndex,
    artifacts.searchIndex,
    artifacts.documentTraces,
    artifacts.generationReport,
  ];
  for (const payload of payloads) JSON.stringify(payload);

  if (artifacts.generationReport.sourceRead.covered === 0) {
    publishZeroSourceReport(outputRoot, artifacts);
    return false;
  }

  let previous;
  try { previous = readJson(join(outputRoot, 'wiki-index.json')); } catch { /* Legacy Markdown may have no index. */ }
  const regeneration = {
    schemaVersion: 1,
    previousFormat: previous?.version ?? (existsSync(outputRoot) && readdirSync(outputRoot).some((name) => name.endsWith('.md')) ? 'legacy-markdown' : 'none'),
    previousGraphDigest: previous?.source?.graphDigest ?? null,
    graphDigest: artifacts.wikiIndex.source.graphDigest,
    sameGraphSnapshot: previous?.source?.graphDigest === artifacts.wikiIndex.source.graphDigest,
    generatedAt: artifacts.wikiIndex.generatedAt,
    mainReadiness: artifacts.wikiIndex.mainReadiness.status,
    note: '格式迁移与同快照重建不会自动认证业务语义；正式主干仍需通过 writer 与源码证据校验。',
  };
  cleanOutputDocuments(outputRoot);
  for (const doc of kb.documents) writeDocument(outputRoot, doc);
  writeJsonAtomic(join(outputRoot, 'wiki-index.json'), publishExcerptShards(core, outputRoot, artifacts.wikiIndex));
  writeJsonAtomic(join(outputRoot, 'search-index.json'), artifacts.searchIndex, true);
  writeJsonAtomic(join(outputRoot, '.trace/document-traces.json'), artifacts.documentTraces);
  writeJsonAtomic(join(outputRoot, '.trace/generation-report.json'), artifacts.generationReport);
  writeJsonAtomic(join(outputRoot, '.trace/regeneration.json'), regeneration);
  if (!keepIntermediate) rmSync(join(outputRoot, '.intermediate'), { recursive: true, force: true });
  return true;
}

function deterministicGenerate(core, sourceRoot, outputRoot, keepIntermediate, args) {
  const fullGraph = loadGraph(core, sourceRoot);
  assertDeterministicAllowed(fullGraph, args);
  const largeGraph = isLargeGraph(fullGraph);
  const graph = largeGraph ? projectLargeGraph(fullGraph) : fullGraph;
  if (largeGraph) {
    const projected = graphStats(graph);
    console.warn(`Wiki 语义规划投影: ${projected.nodes} 个节点；源码引用与覆盖分母使用完整图谱。`);
  }
  const { sourceFiles, stats } = sourceFilesForGraph(sourceRoot, graph, args.maxSourceBytes);
  printGraphStats(graph, stats);
  const config = core.loadConfig(sourceRoot);
  const kb = core.generateKnowledgeBase(graph, {
    sourceFiles,
    outputLanguage: knowledgeBaseOutputLanguage(config),
    knowledgeBaseConfig: config.knowledgeBase ?? {},
    generationMode: 'deterministic',
  });
  kb.documents = core.withSourceReferenceDocuments(fullGraph, sourceFiles, kb.documents);
  const artifacts = buildArtifacts(core, {
    sourceRoot,
    graph: fullGraph,
    generationNodeCount: graph.nodes.length,
    graphDigestOverride: largeGraph
      ? createHash('sha256').update(JSON.stringify(fullGraph)).digest('hex')
      : undefined,
    config,
    sourceStats: stats,
    generationMode: 'deterministic',
    fileDocPlan: kb.fileDocPlan,
    requiredRouteStages: kb.plan.requiredRouteStages,
    documents: kb.documents,
    warnings: [
      ...kb.validation.warnings,
      ...kb.coverageReport.warnings,
      ...(largeGraph ? [
        '大图谱安全模式：主干规划采用有限投影；源码引用、符号搜索与覆盖分母使用完整图谱。',
      ] : []),
    ],
    errors: [...kb.validation.errors, ...kb.coverageReport.errors],
  });
  if (publishKnowledgeBase(core, outputRoot, kb, artifacts, keepIntermediate)) {
    printCoverage(kb, outputRoot);
    console.log(`全图引用覆盖: 文件 ${artifacts.wikiIndex.referenceCoverage.files.covered}/${artifacts.wikiIndex.referenceCoverage.files.total}，函数 ${artifacts.wikiIndex.referenceCoverage.functions.covered}/${artifacts.wikiIndex.referenceCoverage.functions.total}，类型 ${artifacts.wikiIndex.referenceCoverage.types.covered}/${artifacts.wikiIndex.referenceCoverage.types.total}`);
    console.log(`主干质量: ${artifacts.wikiIndex.mainReadiness.status}`);
  }
}

function sourceBinding(graph, sourceFiles) {
  return {
    schemaVersion: 1,
    graphDigest: createHash('sha256').update(JSON.stringify(graph)).digest('hex'),
    sourceInventoryDigest: createHash('sha256').update(JSON.stringify(Object.entries(sourceFiles)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, content]) => [path, createHash('sha256').update(content).digest('hex')]))).digest('hex'),
  };
}

function assertPreparedSourceBinding(outputRoot, graph, sourceFiles) {
  const bindingPath = join(outputRoot, '.intermediate/source-binding.json');
  if (!existsSync(bindingPath) || JSON.stringify(readJson(bindingPath)) !== JSON.stringify(sourceBinding(graph, sourceFiles))) {
    throw new Error('writer 上下文已过期或为旧格式；请运行 --prepare-file-docs 在当前源码快照重新准备，再由宿主生成 writer 输出。');
  }
}

function prepareFileDocs(core, sourceRoot, outputRoot, maxSourceBytes) {
  const graph = loadGraph(core, sourceRoot);
  const { sourceFiles, stats } = sourceFilesForGraph(sourceRoot, graph, maxSourceBytes);
  printGraphStats(graph, stats);
  const config = core.loadConfig(sourceRoot);
  const profile = core.buildKnowledgeBaseProfile(graph);
  const fileDocPlan = core.buildFileDocPlan(profile, {
    sourceFiles,
    outputLanguage: knowledgeBaseOutputLanguage(config),
    knowledgeBaseConfig: config.knowledgeBase ?? {},
    generationMode: 'writer',
  });
  const { intermediateRoot } = pathsFor(sourceRoot, outputRoot);

  if (stats.readFiles === 0) {
    const artifacts = buildArtifacts(core, {
      sourceRoot,
      graph,
      config,
      sourceStats: stats,
      generationMode: 'writer',
      fileDocPlan,
      warnings: fileDocPlan.warnings,
    });
    publishZeroSourceReport(outputRoot, artifacts);
    return;
  }

  rmSync(intermediateRoot, { recursive: true, force: true });
  mkdirSync(intermediateRoot, { recursive: true });
  writeJson(join(intermediateRoot, 'kb-profile.json'), {
    project: profile.graph.project,
    nodeCounts: profile.nodeCounts,
    edgeCounts: profile.edgeCounts,
    layerProfiles: profile.layerProfiles,
    entryCandidates: profile.entryCandidates,
  });
  writeJson(join(intermediateRoot, 'source-binding.json'), sourceBinding(graph, sourceFiles));
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
      throw new Error('Knowledge writer phase failed; see diagnostics above.');
    }
    outputs.push(parsed.value);
  }
  return outputs.sort((a, b) => a.batchIndex - b.batchIndex);
}

function loadProfileAndFilePlan(core, sourceRoot, maxSourceBytes, outputRoot) {
  const graph = loadGraph(core, sourceRoot);
  const { sourceFiles, stats } = sourceFilesForGraph(sourceRoot, graph, maxSourceBytes);
  printGraphStats(graph, stats);
  const config = core.loadConfig(sourceRoot);
  const profile = core.buildKnowledgeBaseProfile(graph);
  const fileDocPlan = core.buildFileDocPlan(profile, {
    sourceFiles,
    outputLanguage: knowledgeBaseOutputLanguage(config),
    knowledgeBaseConfig: config.knowledgeBase ?? {},
    generationMode: 'writer',
  });
  assertPreparedSourceBinding(outputRoot, graph, sourceFiles);
  return { graph, profile, fileDocPlan, sourceFiles, sourceStats: stats, config };
}

function leaseBatch(core, outputRoot, queueFileName, options) {
  const intermediateRoot = join(outputRoot, '.intermediate');
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

function completeBatch(core, outputRoot, queueFileName, args) {
  const intermediateRoot = join(outputRoot, '.intermediate');
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
    throw new Error('Knowledge writer phase failed; see diagnostics above.');
  }

  writeJson(queuePath, nextQueue);
  invalidateQueueDownstreamArtifacts(intermediateRoot, queueFileName);
}

function mergeFileDocs(core, sourceRoot, outputRoot, maxSourceBytes) {
  const { profile, fileDocPlan } = loadProfileAndFilePlan(core, sourceRoot, maxSourceBytes, outputRoot);
  const { intermediateRoot } = pathsFor(sourceRoot, outputRoot);
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

function writeFeaturedPlan(core, profile, fileDocPlan, topicPlan, config, outputRoot) {
  const businessProfile = core.buildBusinessCapabilityProfile(profile, fileDocPlan);
  const plan = core.buildFeaturedPlan({ profile, businessProfile, fileDocPlan, topicPlan, config: config.knowledgeBase ?? {} });
  const documents = plan.documents.filter((document) => document.role !== 'maintenance' && !['file', 'topic'].includes(document.category))
    .map((document) => ({ ...document, requiredSections: core.REQUIRED_SECTIONS[document.category] ?? [] }));
  writeJson(join(outputRoot, '.intermediate', 'featured-plan.json'), { schemaVersion: 1, documents, warnings: plan.warnings });
  console.log(`主干写作计划已准备: ${documents.length} 篇。请按计划和主干指南写入 .intermediate/featured-writer-output.json，再执行 --finalize。`);
}

function prepareFeatured(core, sourceRoot, outputRoot, maxSourceBytes) {
  const { profile, fileDocPlan, config } = loadProfileAndFilePlan(core, sourceRoot, maxSourceBytes, outputRoot);
  const topicPath = join(outputRoot, '.intermediate', 'topic-plan.json');
  if (!existsSync(topicPath)) throw new Error('请先运行 --prepare-topics。');
  writeFeaturedPlan(core, profile, fileDocPlan, readJson(topicPath), config, outputRoot);
}

function prepareTopics(core, sourceRoot, outputRoot, maxSourceBytes, args) {
  const { profile, fileDocPlan, config } = loadProfileAndFilePlan(core, sourceRoot, maxSourceBytes, outputRoot);
  const { intermediateRoot } = pathsFor(sourceRoot, outputRoot);
  const acceptedPath = join(intermediateRoot, 'accepted-file-documents.json');
  if (!existsSync(acceptedPath)) {
    console.error('未找到已接受的文件文档。请先运行 --merge-file-docs。');
    throw new Error('Knowledge writer phase failed; see diagnostics above.');
  }
  const fileQueuePath = join(intermediateRoot, 'file-doc-queue.json');
  const fileQueue = requireQueue(fileQueuePath, '未找到文件阶段队列。请先运行 --prepare-file-docs。');
  const fileQueueSummary = core.summarizeQueue(fileQueue);
  if (unresolvedQueue(fileQueueSummary)) {
    console.error('文件阶段尚未完成，不能进入专题阶段。');
    throw new Error('Knowledge writer phase failed; see diagnostics above.');
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
  writeFeaturedPlan(core, profile, fileDocPlan, topicPlan, config, outputRoot);
}

function finalizeKnowledgeBase(core, sourceRoot, outputRoot, keepIntermediate, maxSourceBytes) {
  const {
    graph,
    profile,
    fileDocPlan,
    sourceFiles,
    sourceStats,
    config,
  } = loadProfileAndFilePlan(core, sourceRoot, maxSourceBytes, outputRoot);
  const { intermediateRoot } = pathsFor(sourceRoot, outputRoot);
  const fileQueuePath = join(intermediateRoot, 'file-doc-queue.json');
  const fileQueue = requireQueue(fileQueuePath, '未找到文件阶段队列。请先运行 --prepare-file-docs。');
  const topicQueuePath = join(intermediateRoot, 'topic-queue.json');
  const topicQueue = requireQueue(topicQueuePath, '未找到专题阶段队列。请先运行 --prepare-topics。');
  const topicQueueSummary = core.summarizeQueue(topicQueue);
  if (unresolvedQueue(topicQueueSummary)) {
    console.error('专题阶段尚未完成，不能进入 finalize 成功态。');
    throw new Error('Knowledge writer phase failed; see diagnostics above.');
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
    topicPlan,
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
    throw new Error('Knowledge writer phase failed; see diagnostics above.');
  }

  const featuredPath = join(intermediateRoot, 'featured-writer-output.json');
  let featured;
  try {
    featured = existsSync(featuredPath) ? core.parseFeaturedWriterOutput(readJson(featuredPath)) : {
      ok: false, errors: ['缺少主干写作输出。运行 --prepare-featured 查看计划，按 --guide 的主干指南写入 .intermediate/featured-writer-output.json。'],
    };
  } catch {
    featured = { ok: false, errors: ['.intermediate/featured-writer-output.json 不是有效 JSON；请修正该文件后重试。'] };
  }
  if (!featured.ok) {
    writeJson(join(intermediateRoot, 'featured-writer-retry-plan.json'), { errors: featured.errors });
    for (const error of featured.errors) console.error(error);
    throw new Error('主干写作输出未通过校验；已有草稿已保留。');
  }
  const businessCapabilityProfile = core.buildBusinessCapabilityProfile(profile, fileDocPlan);
  const kb = core.materializeKnowledgeBase({
    profile,
    fileDocPlan,
    businessCapabilityProfile,
    topicPlan,
    merged,
    featuredWriterOutput: featured.value,
    options: {
      sourceFiles,
      outputLanguage: knowledgeBaseOutputLanguage(config),
      knowledgeBaseConfig: config.knowledgeBase ?? {},
      generationMode: 'writer',
    },
  });

  const writerErrors = [...new Set([
    ...kb.validation.errors, ...kb.coverageReport.errors,
    ...kb.documents.flatMap((document) => (document.qualityIssues ?? []).map((issue) => `${document.path}: ${issue}`)),
  ])];
  if (writerErrors.length > 0) {
    writeJson(join(intermediateRoot, 'featured-writer-retry-plan.json'), { errors: writerErrors });
  } else {
    rmSync(join(intermediateRoot, 'featured-writer-retry-plan.json'), { force: true });
  }

  if (graph.project.gitCommitHash !== profile.graph.project.gitCommitHash) {
    console.warn('警告: 生成最终知识库时图谱元数据发生变化。');
  }
  const artifacts = buildArtifacts(core, {
    sourceRoot,
    graph: kb.profile.graph,
    config,
    sourceStats,
    generationMode: 'writer',
    fileDocPlan: kb.fileDocPlan,
    requiredRouteStages: kb.plan.requiredRouteStages,
    documents: kb.documents,
    warnings: [...kb.validation.warnings, ...kb.coverageReport.warnings],
    errors: [...kb.validation.errors, ...kb.coverageReport.errors],
  });
  if (artifacts.generationReport.mainReadiness.status !== 'ready'
    || artifacts.generationReport.referenceCoverage.status !== 'complete'
    || artifacts.generationReport.errors.length > 0) {
    const errors = [...new Set([...writerErrors, ...artifacts.generationReport.errors,
      ...(artifacts.generationReport.mainReadiness.reasons ?? []),
      `主干状态: ${artifacts.generationReport.mainReadiness.status}；参考覆盖: ${artifacts.generationReport.referenceCoverage.status}`])];
    writeJson(join(intermediateRoot, 'featured-writer-retry-plan.json'), { errors });
    for (const error of errors) console.error(error);
    throw new Error('正式知识质量未通过；草稿已保留，请运行 --retry 修正后重试。');
  }
  if (publishKnowledgeBase(core, outputRoot, kb, artifacts, keepIntermediate)) {
    printCoverage(kb, outputRoot);
  } else {
    throw new Error('最终知识产物未通过校验；草稿已保留。');
  }
}

function printRetryPlan(outputRoot) {
  const intermediateRoot = join(outputRoot, '.intermediate');
  const retryFiles = ['file-doc-retry-plan.json', 'topic-retry-plan.json', 'featured-writer-retry-plan.json']
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

export async function runKnowledgeBaseGenerator(argv = process.argv, suppliedCore) {
  const args = parseArgs(argv);
  selectedGraphPath = args.graphPath;
  assertSafeOutputRoot(args.sourceRoot, args.outputRoot);
  const core = suppliedCore ?? await loadCore();

  if (args.deterministicOnly || args.phase === 'deterministic') {
    deterministicGenerate(core, args.sourceRoot, args.outputRoot, args.keepIntermediate, args);
  } else if (args.phase === 'prepare-file-docs') {
    prepareFileDocs(core, args.sourceRoot, args.outputRoot, args.maxSourceBytes);
  } else if (args.phase === 'merge-file-docs') {
    mergeFileDocs(core, args.sourceRoot, args.outputRoot, args.maxSourceBytes);
  } else if (args.phase === 'prepare-topics') {
    prepareTopics(core, args.sourceRoot, args.outputRoot, args.maxSourceBytes, args);
  } else if (args.phase === 'prepare-featured') {
    prepareFeatured(core, args.sourceRoot, args.outputRoot, args.maxSourceBytes);
  } else if (args.phase === 'lease-file-batch') {
    leaseBatch(core, args.outputRoot, 'file-doc-queue.json', args);
  } else if (args.phase === 'lease-topic-batch') {
    leaseBatch(core, args.outputRoot, 'topic-queue.json', args);
  } else if (args.phase === 'complete-file-batch') {
    completeBatch(core, args.outputRoot, 'file-doc-queue.json', args);
  } else if (args.phase === 'complete-topic-batch') {
    completeBatch(core, args.outputRoot, 'topic-queue.json', args);
  } else if (args.phase === 'finalize') {
    finalizeKnowledgeBase(core, args.sourceRoot, args.outputRoot, args.keepIntermediate, args.maxSourceBytes);
  } else if (args.phase === 'retry') {
    printRetryPlan(args.outputRoot);
  } else {
    console.error(`未知阶段: ${args.phase}`);
    throw new Error('Knowledge writer phase failed; see diagnostics above.');
  }
}

// The installed CLI reuses this writer pipeline with its bundled core. Importing
// it must not run a second CLI or depend on the source checkout at runtime.
if (typeof __UNDERSTAND_CODE_BUNDLED_WRITER__ === 'undefined'
    && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runKnowledgeBaseGenerator().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
