import type { KnowledgeGraph } from "../types.js";
import { buildKnowledgeBaseProfile } from "./profile.js";
import { buildTopicPlan } from "./planner.js";
import { buildFileDocPlan } from "./file-doc-planner.js";
import { buildBusinessCapabilityProfile } from "./business-facts.js";
import { mergeKnowledgeBaseWriterOutputs, type MergeKnowledgeBaseWriterOutputsResult } from "./merge.js";
import { buildFeaturedPlan } from "./featured-planner.js";
import {
  buildCoverageReport,
  renderDeterministicFileWriterDocument,
  renderDeterministicTopicWriterDocument,
  materializeKnowledgeBaseDocuments,
  renderKnowledgeBaseStatusDocuments,
} from "./markdown.js";
import { summarizeMarkdownQuality } from "./quality.js";
import type {
  BusinessCapabilityProfile,
  FileDocPlan,
  GeneratedKnowledgeBase,
  KnowledgeBaseOptions,
  ProjectProfile,
  TopicPlan,
} from "./types.js";

export interface MaterializeKnowledgeBaseInput {
  profile: ProjectProfile;
  fileDocPlan: FileDocPlan;
  businessCapabilityProfile: BusinessCapabilityProfile;
  topicPlan: TopicPlan;
  merged: MergeKnowledgeBaseWriterOutputsResult;
  options: KnowledgeBaseOptions;
}

export function materializeKnowledgeBase(input: MaterializeKnowledgeBaseInput): GeneratedKnowledgeBase {
  const { profile, fileDocPlan, businessCapabilityProfile, topicPlan, merged, options } = input;
  const plan = buildFeaturedPlan({
    profile,
    businessProfile: businessCapabilityProfile,
    fileDocPlan,
    topicPlan,
    config: options.knowledgeBaseConfig ?? {},
  });
  const materialized = materializeKnowledgeBaseDocuments({
    profile,
    plan,
    fileDocPlan,
    businessCapabilityProfile,
    topicPlan,
    merged,
  });
  const validationErrors = [...new Set([...merged.validation.errors, ...materialized.errors])];
  const validationWarnings = [...new Set([
    ...merged.validation.warnings,
    ...topicPlan.warnings,
    ...plan.warnings,
  ])].sort();
  const validation = {
    ok: validationErrors.length === 0,
    errors: validationErrors,
    warnings: validationWarnings,
  };

  const qualityEvaluation = summarizeMarkdownQuality(materialized.documents);
  const evaluatedDocuments = materialized.documents;
  const coverageReport = buildCoverageReport(
    profile,
    fileDocPlan,
    topicPlan,
    plan,
    evaluatedDocuments,
    validation,
    merged.retryPlan,
    businessCapabilityProfile,
    qualityEvaluation,
  );
  const statusDocuments = renderKnowledgeBaseStatusDocuments(
    profile,
    plan,
    coverageReport,
    validation,
    merged.retryPlan,
  );

  return {
    profile,
    businessCapabilityProfile,
    plan,
    fileDocPlan,
    topicPlan,
    documents: [...evaluatedDocuments, ...statusDocuments],
    validation,
    coverageReport,
    retryPlan: merged.retryPlan,
  };
}

export function generateKnowledgeBase(
  graph: KnowledgeGraph,
  options: KnowledgeBaseOptions = {},
): GeneratedKnowledgeBase {
  const profile = buildKnowledgeBaseProfile(graph);
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
    topics: batch.topics.map((topic) => renderDeterministicTopicWriterDocument(profile, topic, fileDocPlan)),
    warnings: [],
  }));
  const merged = mergeKnowledgeBaseWriterOutputs({
    profile,
    fileDocPlan,
    fileWriterOutputs: deterministicFileOutputs,
    topicPlan,
    topicWriterOutputs: deterministicTopicOutputs,
  });
  return materializeKnowledgeBase({
    profile,
    fileDocPlan,
    businessCapabilityProfile,
    topicPlan,
    merged,
    options: { ...options, generationMode: options.generationMode ?? "deterministic" },
  });
}
