import type { KnowledgeGraph } from "../types.js";
import { buildKnowledgeBaseProfile } from "./profile.js";
import { buildDocumentPlan } from "./planner.js";
import {
  buildCoverageReport,
  renderKnowledgeBaseDocuments,
  validateKnowledgeBaseCoverage,
} from "./markdown.js";
import type { GeneratedKnowledgeBase, KnowledgeBaseOptions } from "./types.js";

export function generateKnowledgeBase(
  graph: KnowledgeGraph,
  _options: KnowledgeBaseOptions = {},
): GeneratedKnowledgeBase {
  const profile = buildKnowledgeBaseProfile(graph);
  const plan = buildDocumentPlan(profile);
  const preliminaryDocuments = renderKnowledgeBaseDocuments(profile, plan);
  const validation = validateKnowledgeBaseCoverage(profile, plan, preliminaryDocuments);
  const coverageReport = buildCoverageReport(profile, plan, preliminaryDocuments, validation);
  const documents = renderKnowledgeBaseDocuments(profile, plan, coverageReport, validation);

  return {
    profile,
    plan,
    // Task 3/7 replace these placeholders with real plans.
    fileDocPlan: { tasks: [], batches: [], warnings: [] },
    topicPlan: { topics: [], batches: [], warnings: [] },
    documents,
    validation,
    coverageReport,
    retryPlan: { fileBatchIndexes: [], topicBatchIndexes: [], reasons: [] },
  };
}
