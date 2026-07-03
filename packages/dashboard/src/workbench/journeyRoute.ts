import type { GraphNode, KnowledgeGraph } from "@understand-anything/core/types";
import type { ViewFileSummary, ViewGraph } from "../viewgraph/types";

export const journeySectionLabels = [
  "Start Here",
  "Product Flow",
  "Key Files",
  "Data Models",
  "Strategy / Logic",
  "Tests",
  "Configuration",
  "Risk & Operations",
  "Unmapped",
] as const;

export type JourneySectionLabel = (typeof journeySectionLabels)[number];
export type JourneyStepKind = GraphNode["type"] | "project";

export interface JourneyStep {
  id: string;
  section: JourneySectionLabel;
  targetId: string;
  title: string;
  subtitle: string;
  reason: string;
  score: number;
  parentId?: string;
  path?: string;
  kind?: JourneyStepKind;
}

export interface JourneyRoute {
  projectName: string;
  sections: JourneySectionLabel[];
  steps: JourneyStep[];
}

export interface BuildJourneyRouteInput {
  graph: KnowledgeGraph | null;
  viewGraph: ViewGraph | null;
  layerMatchCounts: Map<string, number>;
  fileMatchCounts: Map<string, number>;
  nodeMatchCounts?: Map<string, number>;
  maxStepsPerSection?: number;
}

interface Candidate {
  step: JourneyStep;
  sectionIndex: number;
  sortPath: string;
}

const routeableDirectNodeTypes = new Set<GraphNode["type"]>([
  "config",
  "document",
  "service",
  "table",
  "endpoint",
  "pipeline",
  "schema",
  "resource",
]);

const sectionReasons: Record<JourneySectionLabel, string> = {
  "Start Here": "Entry points are the fastest way to orient in the product journey.",
  "Product Flow": "Flow and service files show how product behavior moves through the system.",
  "Key Files": "This file is a useful supporting stop in the codebase.",
  "Data Models": "Data model and schema nodes explain the product concepts being moved around.",
  "Strategy / Logic": "Strategy and ranking logic usually encode the product decisions.",
  "Tests": "Tests show the expected behavior and edge cases.",
  "Configuration": "Configuration controls runtime behavior and environment choices.",
  "Risk & Operations": "Operations files affect deployment, reliability, or production risk.",
  "Unmapped": "This node does not fit a stronger journey section yet.",
};

function compareString(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function complexityWeight(value: string | undefined): number {
  if (value === "complex") return 30;
  if (value === "moderate") return 12;
  return 0;
}

function relationshipScores(graph: KnowledgeGraph): Map<string, number> {
  const scores = new Map<string, number>();
  for (const edge of graph.edges) {
    const weight = edge.weight ?? 1;
    scores.set(edge.source, (scores.get(edge.source) ?? 0) + weight);
    scores.set(edge.target, (scores.get(edge.target) ?? 0) + weight);
  }
  return scores;
}

function fallbackRoute(projectName = "Project"): JourneyRoute {
  return {
    projectName,
    sections: [...journeySectionLabels],
    steps: [
      {
        id: "fallback:select-node",
        section: "Start Here",
        targetId: "selection",
        title: "Select a node",
        subtitle: "Pick a graph node to see where it sits in the product journey.",
        reason: "No node is currently selected.",
        score: 0,
        kind: "project",
      },
    ],
  };
}

function textForNode(node: Pick<GraphNode, "filePath" | "name" | "summary" | "tags">): string {
  return [node.filePath, node.name, node.summary, ...node.tags].filter(Boolean).join(" ").toLowerCase();
}

function sectionForFile(file: ViewFileSummary): JourneySectionLabel {
  const path = file.filePath.toLowerCase();
  const text = textForNode(file.node);

  if (/(^|\/|\.)(test|spec)\.[tj]sx?$/.test(path) || path.includes("__tests__") || text.includes(" test")) {
    return "Tests";
  }
  if (
    path.startsWith("config/") ||
    path.includes("/config/") ||
    /\.(json|ya?ml|toml|env)$/.test(path) ||
    text.includes("config")
  ) {
    return "Configuration";
  }
  if (
    path.startsWith("scripts/") ||
    text.includes("deploy") ||
    text.includes("operation") ||
    text.includes("infra") ||
    text.includes("migration") ||
    text.includes("monitor")
  ) {
    return "Risk & Operations";
  }
  if (/(^|\/)(main|index|bootstrap)\.[tj]sx?$/.test(path) || text.includes("entry")) {
    return "Start Here";
  }
  if (text.includes("model") || text.includes("schema") || text.includes("entity") || text.includes("table")) {
    return "Data Models";
  }
  if (
    text.includes("rank") ||
    text.includes("strategy") ||
    text.includes("logic") ||
    text.includes("filter") ||
    text.includes("score")
  ) {
    return "Strategy / Logic";
  }
  if (
    text.includes("flow") ||
    text.includes("service") ||
    text.includes("handler") ||
    text.includes("controller") ||
    text.includes("endpoint") ||
    text.includes("api")
  ) {
    return "Product Flow";
  }

  return path.startsWith("src/") ? "Key Files" : "Unmapped";
}

function sectionForDirectNode(node: GraphNode): JourneySectionLabel {
  if (node.type === "config") return "Configuration";
  if (node.type === "document") return "Unmapped";
  if (node.type === "service" || node.type === "endpoint" || node.type === "pipeline") return "Product Flow";
  if (node.type === "schema" || node.type === "table") return "Data Models";
  if (node.type === "resource") return "Risk & Operations";
  return "Unmapped";
}

function fileScore(file: ViewFileSummary, fileMatchCounts: Map<string, number>): number {
  return (
    file.functionCount * 6 +
    file.classCount * 4 +
    file.importInCount * 3 +
    file.importOutCount * 3 +
    complexityWeight(file.node.complexity) +
    (fileMatchCounts.get(file.id) ?? 0) * 35
  );
}

function directNodeScore(
  node: GraphNode,
  nodeMatchCounts: Map<string, number>,
  relationshipScoreById: Map<string, number>,
): number {
  if (!routeableDirectNodeTypes.has(node.type)) return 0;

  const matches = nodeMatchCounts.get(node.id) ?? 0;
  const relationships = relationshipScoreById.get(node.id) ?? 0;
  if (matches === 0 && relationships === 0) return 0;

  return matches * 35 + relationships * 8;
}

function fileCandidate(file: ViewFileSummary, fileMatchCounts: Map<string, number>): Candidate | null {
  const section = sectionForFile(file);
  const score = fileScore(file, fileMatchCounts);

  if (section === "Unmapped" && score === 0) return null;

  return {
    sectionIndex: journeySectionLabels.indexOf(section),
    sortPath: file.filePath,
    step: {
      id: `file:${file.id}`,
      section,
      targetId: file.id,
      title: file.name,
      subtitle: file.filePath,
      reason: sectionReasons[section],
      score,
      path: file.filePath,
      kind: "file",
    },
  };
}

function directNodeCandidate(
  node: GraphNode,
  layerId: string,
  layerName: string,
  nodeMatchCounts: Map<string, number>,
  relationshipScoreById: Map<string, number>,
): Candidate | null {
  const score = directNodeScore(node, nodeMatchCounts, relationshipScoreById);
  if (score === 0) return null;

  const section = sectionForDirectNode(node);
  const path = node.filePath ?? node.name;

  return {
    sectionIndex: journeySectionLabels.indexOf(section),
    sortPath: path,
    step: {
      id: `node:${node.id}`,
      section,
      targetId: node.id,
      title: node.name,
      subtitle: node.summary || layerName,
      reason: sectionReasons[section],
      score,
      parentId: `layer:${layerId}`,
      path: node.filePath,
      kind: node.type,
    },
  };
}

function bySectionScorePath(a: Candidate, b: Candidate): number {
  if (a.sectionIndex !== b.sectionIndex) return a.sectionIndex - b.sectionIndex;
  if (b.step.score !== a.step.score) return b.step.score - a.step.score;
  const pathOrder = compareString(a.sortPath, b.sortPath);
  if (pathOrder !== 0) return pathOrder;
  return compareString(a.step.targetId, b.step.targetId);
}

export function buildJourneyRoute({
  graph,
  viewGraph,
  fileMatchCounts,
  nodeMatchCounts = new Map(),
  maxStepsPerSection = 2,
}: BuildJourneyRouteInput): JourneyRoute {
  if (!graph || !viewGraph) {
    return fallbackRoute();
  }

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const relationshipScoreById = relationshipScores(graph);
  const candidates: Candidate[] = [];

  for (const file of viewGraph.filesById.values()) {
    const candidate = fileCandidate(file, fileMatchCounts);
    if (candidate) candidates.push(candidate);
  }

  for (const layer of graph.layers) {
    for (const nodeId of layer.nodeIds) {
      const node = nodesById.get(nodeId);
      if (!node || node.type === "file") continue;
      const candidate = directNodeCandidate(
        node,
        layer.id,
        layer.name,
        nodeMatchCounts,
        relationshipScoreById,
      );
      if (candidate) candidates.push(candidate);
    }
  }

  const sectionCounts = new Map<JourneySectionLabel, number>();
  const steps = candidates
    .sort(bySectionScorePath)
    .filter((candidate) => {
      const count = sectionCounts.get(candidate.step.section) ?? 0;
      if (count >= maxStepsPerSection) return false;
      sectionCounts.set(candidate.step.section, count + 1);
      return true;
    })
    .map((candidate) => candidate.step);

  if (steps.length === 0) {
    return fallbackRoute(graph.project.name || "Project");
  }

  return {
    projectName: graph.project.name || "Project",
    sections: [...journeySectionLabels],
    steps,
  };
}
