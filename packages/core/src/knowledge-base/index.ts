import type { FileDocPlan, KnowledgeBaseOptions, ProjectProfile } from "./types.js";

export * from "./types.js";
export * from "./profile.js";
export * from "./planner.js";
export * from "./paths.js";
export {
  buildCoverageReport,
  renderKnowledgeBaseDocuments,
  validateKnowledgeBaseCoverage,
} from "./markdown.js";
export { generateKnowledgeBase } from "./generate.js";

export function buildFileDocPlan(
  _profile: ProjectProfile,
  _options: KnowledgeBaseOptions = {},
): FileDocPlan {
  throw new Error("buildFileDocPlan is not implemented yet");
}
