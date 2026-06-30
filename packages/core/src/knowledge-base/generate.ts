import type { KnowledgeGraph } from "../types.js";
import { buildKnowledgeBaseProfile } from "./profile.js";
import { buildDocumentPlan, buildTopicPlan } from "./planner.js";
import { buildFileDocPlan } from "./file-doc-planner.js";
import { buildBusinessCapabilityProfile } from "./business-facts.js";
import { mergeKnowledgeBaseWriterOutputs } from "./merge.js";
import {
  buildCoverageReport,
  renderBusinessCapabilityDocuments,
  renderDeterministicFileWriterDocument,
  renderDeterministicTopicWriterDocument,
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
  const businessCapabilityProfile = buildBusinessCapabilityProfile(profile, fileDocPlan);
  const deterministicFileOutputs = fileDocPlan.batches.map((batch) => ({
    batchIndex: batch.batchIndex,
    documents: batch.tasks.map((task) => renderDeterministicFileWriterDocument(profile, task)),
    warnings: [],
  }));
  const fileMerged = mergeKnowledgeBaseWriterOutputs({
    profile,
    fileDocPlan,
    fileWriterOutputs: deterministicFileOutputs,
  });
  const topicPlan = buildTopicPlan(profile, fileDocPlan, fileMerged.acceptedFileWriterDocuments);
  const deterministicTopicOutputs = topicPlan.batches.map((batch) => ({
    batchIndex: batch.batchIndex,
    topics: batch.topics.map((topic) => renderDeterministicTopicWriterDocument(profile, topic)),
    warnings: [],
  }));
  const merged = mergeKnowledgeBaseWriterOutputs({
    profile,
    fileDocPlan,
    fileWriterOutputs: deterministicFileOutputs,
    topicWriterOutputs: deterministicTopicOutputs,
  });
  const validation = {
    ok: merged.validation.ok,
    errors: merged.validation.errors,
    warnings: [...new Set([...merged.validation.warnings, ...topicPlan.warnings])].sort(),
  };
  const supportDocuments = renderKnowledgeBaseDocuments(profile, plan, fileDocPlan, topicPlan, merged);
  const businessDocuments = renderBusinessCapabilityDocuments(profile, businessCapabilityProfile);
  const preliminaryDocuments = [...supportDocuments, ...businessDocuments, ...merged.fileDocuments, ...merged.topicDocuments];
  const initialCoverageReport = buildCoverageReport(
    profile,
    fileDocPlan,
    topicPlan,
    preliminaryDocuments,
    validation,
    merged.retryPlan,
    businessCapabilityProfile,
    [],
  );
  const initialFinalSupportDocuments = renderKnowledgeBaseDocuments(
    profile,
    plan,
    fileDocPlan,
    topicPlan,
    merged,
    initialCoverageReport,
    validation,
  );
  const initialFinalDocuments = [...initialFinalSupportDocuments, ...businessDocuments, ...merged.fileDocuments, ...merged.topicDocuments]
    .sort((a, b) => a.path.localeCompare(b.path) || a.title.localeCompare(b.title));
  const coverageReport = buildCoverageReport(
    profile,
    fileDocPlan,
    topicPlan,
    preliminaryDocuments,
    validation,
    merged.retryPlan,
    businessCapabilityProfile,
    initialFinalDocuments,
  );
  const finalSupportDocuments = renderKnowledgeBaseDocuments(
    profile,
    plan,
    fileDocPlan,
    topicPlan,
    merged,
    coverageReport,
    validation,
  );
  const documents = [...finalSupportDocuments, ...businessDocuments, ...merged.fileDocuments, ...merged.topicDocuments]
    .sort((a, b) => a.path.localeCompare(b.path) || a.title.localeCompare(b.title));

  return {
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
}
