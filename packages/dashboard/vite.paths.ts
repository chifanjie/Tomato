import path from "node:path";

export interface DashboardPathEnvironment {
  GRAPH_DIR?: string;
  KNOWLEDGE_BASE_DIR?: string;
}

export function graphFileCandidates(
  fileName: string,
  environment: DashboardPathEnvironment = process.env,
  cwd = process.cwd(),
): string[] {
  return [
    ...(environment.GRAPH_DIR ? [path.resolve(environment.GRAPH_DIR, `.understand-code/${fileName}`)] : []),
    path.resolve(cwd, `.understand-code/${fileName}`),
    path.resolve(cwd, `../../../.understand-code/${fileName}`),
  ];
}

export function knowledgeBaseRootCandidates(
  environment: DashboardPathEnvironment = process.env,
  cwd = process.cwd(),
): string[] {
  if (environment.KNOWLEDGE_BASE_DIR) return [path.resolve(environment.KNOWLEDGE_BASE_DIR)];
  return [
    ...(environment.GRAPH_DIR ? [path.resolve(environment.GRAPH_DIR, ".understand-code", "knowledge-base")] : []),
    path.resolve(cwd, ".understand-code", "knowledge-base"),
    path.resolve(cwd, "../../../.understand-code/knowledge-base"),
  ];
}
