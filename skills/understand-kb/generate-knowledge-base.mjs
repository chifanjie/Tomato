#!/usr/bin/env node
/**
 * generate-knowledge-base.mjs
 *
 * Generate a Markdown knowledge base from .understand-anything/knowledge-graph.json.
 *
 * Usage:
 *   node generate-knowledge-base.mjs [project-root] [--deterministic-only]
 *   node generate-knowledge-base.mjs [project-root] --prepare-file-docs
 *   node generate-knowledge-base.mjs [project-root] --merge-file-docs
 *   node generate-knowledge-base.mjs [project-root] --prepare-topics
 *   node generate-knowledge-base.mjs [project-root] --finalize
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
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--prepare-file-docs') args.phase = 'prepare-file-docs';
    else if (arg === '--merge-file-docs') args.phase = 'merge-file-docs';
    else if (arg === '--prepare-topics') args.phase = 'prepare-topics';
    else if (arg === '--finalize') args.phase = 'finalize';
    else if (arg === '--retry') args.phase = 'retry';
    else if (arg === '--deterministic-only') args.deterministicOnly = true;
    else if (arg === '--clean-intermediate') args.keepIntermediate = false;
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

function ensureCoreBuilt() {
  const distPath = resolve(pluginRoot, 'packages/core/dist/index.js');
  if (existsSync(distPath)) return;
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

function sourceFilesForGraph(projectRoot, graph) {
  const result = {};
  for (const node of graph.nodes) {
    if (node.type !== 'file' || !node.filePath) continue;
    const absolute = join(projectRoot, node.filePath);
    if (!existsSync(absolute)) continue;
    result[node.filePath] = readFileSync(absolute, 'utf-8');
  }
  return result;
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

function printCoverage(kb, outputRoot) {
  console.log(`Knowledge base generated at ${outputRoot}`);
  console.log(`Generated Markdown documents: ${kb.coverageReport.totalDocuments}`);
  console.log(`Coverage status: ${kb.coverageReport.status}`);
  console.log(`File document coverage: ${kb.coverageReport.fileDocumentCoverage.covered} / ${kb.coverageReport.fileDocumentCoverage.total}`);
  console.log(`Function card coverage: ${kb.coverageReport.functionCardCoverage.covered} / ${kb.coverageReport.functionCardCoverage.total}`);
  console.log(`Class card coverage: ${kb.coverageReport.classCardCoverage.covered} / ${kb.coverageReport.classCardCoverage.total}`);
  if (kb.validation.warnings.length > 0) console.log(`Warnings: ${kb.validation.warnings.length}`);
}

function loadGraph(core, projectRoot) {
  const { graphPath } = pathsFor(projectRoot);
  if (!existsSync(graphPath)) {
    console.error(`No knowledge graph found at ${graphPath}`);
    console.error('Run /understand first, then re-run /understand-kb.');
    process.exit(1);
  }

  const raw = readJson(graphPath);
  const validation = core.validateGraph(raw);
  if (!validation.success) {
    console.error('knowledge-graph.json failed validation:');
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

function deterministicGenerate(core, projectRoot, keepIntermediate) {
  const graph = loadGraph(core, projectRoot);
  const sourceFiles = sourceFilesForGraph(projectRoot, graph);
  const kb = core.generateKnowledgeBase(graph, { sourceFiles });
  const { outputRoot } = pathsFor(projectRoot);
  rmSync(outputRoot, { recursive: true, force: true });
  mkdirSync(outputRoot, { recursive: true });
  writeKnowledgeBase(outputRoot, kb, keepIntermediate);
  printCoverage(kb, outputRoot);
}

function prepareFileDocs(core, projectRoot) {
  const graph = loadGraph(core, projectRoot);
  const sourceFiles = sourceFilesForGraph(projectRoot, graph);
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

  console.log(`Prepared file document batches: ${fileDocPlan.batches.length}`);
  console.log(`File document tasks: ${fileDocPlan.tasks.length}`);
  console.log(`Missing source files: ${fileDocPlan.tasks.filter((task) => !task.sourceSnapshot.exists).length}`);
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
      console.error(`${entry} failed contract validation:`);
      for (const error of parsed.errors) console.error(`- ${error}`);
      process.exit(1);
    }
    outputs.push(parsed.value);
  }
  return outputs.sort((a, b) => a.batchIndex - b.batchIndex);
}

function loadProfileAndFilePlan(core, projectRoot) {
  const graph = loadGraph(core, projectRoot);
  const sourceFiles = sourceFilesForGraph(projectRoot, graph);
  const profile = core.buildKnowledgeBaseProfile(graph);
  const fileDocPlan = core.buildFileDocPlan(profile, { sourceFiles });
  return { graph, profile, fileDocPlan };
}

function mergeFileDocs(core, projectRoot) {
  const { profile, fileDocPlan } = loadProfileAndFilePlan(core, projectRoot);
  const { outputRoot, intermediateRoot } = pathsFor(projectRoot);
  const fileWriterOutputs = readBatchOutputs(intermediateRoot, 'file-doc-batch', core.parseFileWriterBatchOutput);
  const merged = core.mergeKnowledgeBaseWriterOutputs({ profile, fileDocPlan, fileWriterOutputs });

  mkdirSync(intermediateRoot, { recursive: true });
  writeJson(join(intermediateRoot, 'validation-report.json'), merged.validation);
  writeJson(join(intermediateRoot, 'accepted-file-documents.json'), merged.acceptedFileWriterDocuments);
  writeJson(join(intermediateRoot, 'file-writer-outputs.json'), fileWriterOutputs);
  if (merged.retryPlan.fileBatchIndexes.length > 0) {
    writeJson(join(intermediateRoot, 'file-doc-retry-plan.json'), merged.retryPlan);
  }
  for (const doc of merged.fileDocuments) writeDocument(outputRoot, doc);

  console.log(`Accepted file documents: ${merged.acceptedFileWriterDocuments.length}`);
  console.log(`File writer batches requiring retry: ${merged.retryPlan.fileBatchIndexes.length}`);
}

function prepareTopics(core, projectRoot) {
  const { profile, fileDocPlan } = loadProfileAndFilePlan(core, projectRoot);
  const { intermediateRoot } = pathsFor(projectRoot);
  const acceptedPath = join(intermediateRoot, 'accepted-file-documents.json');
  if (!existsSync(acceptedPath)) {
    console.error('No accepted file documents found. Run --merge-file-docs first.');
    process.exit(1);
  }
  const acceptedFileDocs = readJson(acceptedPath);
  const topicPlan = core.buildTopicPlan(profile, fileDocPlan, acceptedFileDocs);
  writeJson(join(intermediateRoot, 'topic-plan.json'), topicPlan);
  writeJson(join(intermediateRoot, 'topic-batches.json'), topicPlan.batches);

  console.log(`Prepared topic batches: ${topicPlan.batches.length}`);
  console.log(`Topic documents planned: ${topicPlan.topics.length}`);
}

function finalizeKnowledgeBase(core, projectRoot, keepIntermediate) {
  const { graph, profile, fileDocPlan } = loadProfileAndFilePlan(core, projectRoot);
  const { outputRoot, intermediateRoot } = pathsFor(projectRoot);
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
  const validation = {
    ok: merged.validation.ok,
    errors: merged.validation.errors,
    warnings: [...new Set([...merged.validation.warnings, ...topicPlan.warnings])].sort(),
  };
  const plan = core.buildDocumentPlan(profile);
  const supportDocuments = core.renderKnowledgeBaseDocuments(profile, plan, fileDocPlan, topicPlan, merged);
  const preliminaryDocuments = [...supportDocuments, ...merged.fileDocuments, ...merged.topicDocuments];
  const coverageReport = core.buildCoverageReport(profile, fileDocPlan, topicPlan, preliminaryDocuments, validation, merged.retryPlan);
  const finalSupportDocuments = core.renderKnowledgeBaseDocuments(profile, plan, fileDocPlan, topicPlan, merged, coverageReport, validation);
  const documents = [...finalSupportDocuments, ...merged.fileDocuments, ...merged.topicDocuments]
    .sort((a, b) => a.path.localeCompare(b.path) || a.title.localeCompare(b.title));
  const kb = {
    profile,
    plan,
    fileDocPlan,
    topicPlan,
    documents,
    validation,
    coverageReport,
    retryPlan: merged.retryPlan,
  };

  if (graph.project.gitCommitHash !== profile.graph.project.gitCommitHash) {
    console.warn('Warning: graph metadata changed while finalizing.');
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
    console.log('No retry plan found.');
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
    deterministicGenerate(core, args.projectRoot, args.keepIntermediate);
  } else if (args.phase === 'prepare-file-docs') {
    prepareFileDocs(core, args.projectRoot);
  } else if (args.phase === 'merge-file-docs') {
    mergeFileDocs(core, args.projectRoot);
  } else if (args.phase === 'prepare-topics') {
    prepareTopics(core, args.projectRoot);
  } else if (args.phase === 'finalize') {
    finalizeKnowledgeBase(core, args.projectRoot, args.keepIntermediate);
  } else if (args.phase === 'retry') {
    printRetryPlan(args.projectRoot);
  } else {
    console.error(`Unknown phase: ${args.phase}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
