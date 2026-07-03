import type { KnowledgeGraph } from "@understand-anything/core/types";
import type { FunctionDot, ViewFileSummary, ViewGraph, ViewLayerSummary } from "../viewgraph/types";

export type JourneyStepKind = "project" | "layer" | "file" | "function";

export interface JourneyStep {
  id: string;
  kind: JourneyStepKind;
  targetId: string;
  title: string;
  subtitle: string;
  score: number;
  parentId?: string;
}

export interface JourneyRoute {
  projectName: string;
  steps: JourneyStep[];
}

export interface BuildJourneyRouteInput {
  graph: KnowledgeGraph | null;
  viewGraph: ViewGraph | null;
  layerMatchCounts: Map<string, number>;
  fileMatchCounts: Map<string, number>;
  maxLayers?: number;
  maxFilesPerLayer?: number;
  maxFunctionsPerFile?: number;
}

function complexityWeight(value: string | undefined): number {
  if (value === "complex") return 30;
  if (value === "moderate") return 12;
  return 0;
}

function layerScore(layer: ViewLayerSummary, layerMatchCounts: Map<string, number>): number {
  return (
    layer.fileCount * 8 +
    layer.functionCount * 2 +
    layer.classCount * 3 +
    (layerMatchCounts.get(layer.id) ?? 0) * 40
  );
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

function functionScore(dot: FunctionDot): number {
  return dot.impactScore + complexityWeight(dot.complexity) + (dot.isExported ? 20 : 0);
}

function byScoreThenTitle<T extends { score: number; title: string }>(a: T, b: T): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.title.localeCompare(b.title);
}

function topFunctions(file: ViewFileSummary, maxFunctions: number): FunctionDot[] {
  return [...file.functionDots]
    .sort((a, b) => {
      const delta = functionScore(b) - functionScore(a);
      if (delta !== 0) return delta;
      return a.name.localeCompare(b.name);
    })
    .slice(0, maxFunctions);
}

export function buildJourneyRoute({
  graph,
  viewGraph,
  layerMatchCounts,
  fileMatchCounts,
  maxLayers = 4,
  maxFilesPerLayer = 2,
  maxFunctionsPerFile = 1,
}: BuildJourneyRouteInput): JourneyRoute {
  if (!graph || !viewGraph) {
    return {
      projectName: "Project",
      steps: [
        {
          id: "project",
          kind: "project",
          targetId: "project",
          title: "Project overview",
          subtitle: "Load a graph to build the guided route.",
          score: 0,
        },
      ],
    };
  }

  const steps: JourneyStep[] = [
    {
      id: "project",
      kind: "project",
      targetId: "project",
      title: "Project overview",
      subtitle: `${viewGraph.layers.length} layers · ${viewGraph.filesById.size} files`,
      score: Number.MAX_SAFE_INTEGER,
    },
  ];

  const selectedLayers = viewGraph.layers
    .filter((layer) => layer.functionCount > 0 || (layerMatchCounts.get(layer.id) ?? 0) > 0)
    .map((layer) => ({
      layer,
      score: layerScore(layer, layerMatchCounts),
      title: layer.name,
    }))
    .sort(byScoreThenTitle)
    .slice(0, maxLayers);

  for (const { layer, score } of selectedLayers) {
    steps.push({
      id: `layer:${layer.id}`,
      kind: "layer",
      targetId: layer.id,
      title: layer.name,
      subtitle: layer.description || `${layer.fileCount} files · ${layer.functionCount} functions`,
      score,
      parentId: "project",
    });

    const selectedFiles = [...viewGraph.filesById.values()]
      .filter((file) => file.layerId === layer.id)
      .map((file) => ({
        file,
        score: fileScore(file, fileMatchCounts),
        title: file.name,
      }))
      .sort(byScoreThenTitle)
      .slice(0, maxFilesPerLayer);

    for (const { file, score: selectedFileScore } of selectedFiles) {
      steps.push({
        id: `file:${file.id}`,
        kind: "file",
        targetId: file.id,
        title: file.name,
        subtitle: file.filePath,
        score: selectedFileScore,
        parentId: `layer:${layer.id}`,
      });

      for (const dot of topFunctions(file, maxFunctionsPerFile)) {
        steps.push({
          id: `function:${dot.nodeId}`,
          kind: "function",
          targetId: dot.nodeId,
          title: dot.name,
          subtitle: dot.lineRange ? `L${dot.lineRange[0]}-${dot.lineRange[1]}` : file.filePath,
          score: functionScore(dot),
          parentId: `file:${file.id}`,
        });
      }
    }
  }

  return {
    projectName: graph.project.name || "Project",
    steps,
  };
}
