import type { KnowledgeGraph } from "../types.js";
import { buildKnowledgeBaseProfile } from "./profile.js";
import { buildDocumentPlan, buildTopicPlan } from "./planner.js";
import { buildFileDocPlan } from "./file-doc-planner.js";
import { mergeKnowledgeBaseWriterOutputs } from "./merge.js";
import {
  buildCoverageReport,
  renderDeterministicFileWriterDocument,
  renderKnowledgeBaseDocuments,
} from "./markdown.js";
import type { GeneratedKnowledgeBase, KnowledgeBaseOptions } from "./types.js";

export function generateKnowledgeBase(
  graph: KnowledgeGraph,
  options: KnowledgeBaseOptions = {},
): GeneratedKnowledgeBase {
  const profile = buildKnowledgeBaseProfile(graph);
  const plan = buildDocumentPlan(profile);
  const fileDocPlan = buildFileDocPlan(profile, options);
  const deterministicFileOutputs = fileDocPlan.batches.map((batch) => ({
    batchIndex: batch.batchIndex,
    documents: batch.tasks.map((task) => renderDeterministicFileWriterDocument(profile, task)),
    warnings: [],
  }));
  const merged = mergeKnowledgeBaseWriterOutputs({
    profile,
    fileDocPlan,
    fileWriterOutputs: deterministicFileOutputs,
  });
  const topicPlan = buildTopicPlan(profile, fileDocPlan, merged.acceptedFileWriterDocuments);
  const supportDocuments = renderKnowledgeBaseDocuments(profile, plan, fileDocPlan, topicPlan, merged);
  const preliminaryDocuments = [...supportDocuments, ...merged.fileDocuments, ...merged.topicDocuments];
  const coverageReport = buildCoverageReport(
    profile,
    fileDocPlan,
    topicPlan,
    preliminaryDocuments,
    merged.validation,
    merged.retryPlan,
  );
  const finalSupportDocuments = renderKnowledgeBaseDocuments(
    profile,
    plan,
    fileDocPlan,
    topicPlan,
    merged,
    coverageReport,
    merged.validation,
  );
  const documents = [...finalSupportDocuments, ...merged.fileDocuments, ...merged.topicDocuments]
    .sort((a, b) => a.path.localeCompare(b.path) || a.title.localeCompare(b.title));

  return {
    profile,
    plan,
    fileDocPlan,
    topicPlan,
    documents,
    validation: merged.validation,
    coverageReport,
    retryPlan: merged.retryPlan,
  };
}
