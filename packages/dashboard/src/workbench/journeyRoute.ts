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

function functionConnectivityScores(graph: KnowledgeGraph): Map<string, number> {
  const scores = new Map<string, number>();
  for (const edge of graph.edges) {
    if (edge.type !== "calls") continue;

    const weight = edge.weight ?? 1;
    scores.set(edge.source, (scores.get(edge.source) ?? 0) + weight);
    scores.set(edge.target, (scores.get(edge.target) ?? 0) + weight);
  }
  return scores;
}

function functionScore(dot: FunctionDot, connectivityScores: Map<string, number>): number {
  return (
    (connectivityScores.get(dot.nodeId) ?? 0) +
    dot.impactScore +
    complexityWeight(dot.complexity) +
    (dot.isExported ? 20 : 0)
  );
}

function byScoreThenTitle<T extends { id: string; score: number; title: string; path?: string }>(a: T, b: T): number {
  if (b.score !== a.score) return b.score - a.score;
  const titleOrder = a.title.localeCompare(b.title);
  if (titleOrder !== 0) return titleOrder;
  const pathOrder = (a.path ?? "").localeCompare(b.path ?? "");
  if (pathOrder !== 0) return pathOrder;
  return a.id.localeCompare(b.id);
}

function topFunctions(
  file: ViewFileSummary,
  maxFunctions: number,
  connectivityScores: Map<string, number>,
): FunctionDot[] {
  return [...file.functionDots]
    .sort((a, b) => {
      const delta = functionScore(b, connectivityScores) - functionScore(a, connectivityScores);
      if (delta !== 0) return delta;
      const nameOrder = a.name.localeCompare(b.name);
      if (nameOrder !== 0) return nameOrder;
      return a.nodeId.localeCompare(b.nodeId);
    })
    .slice(0, maxFunctions);
}

function layerHasRouteableSignal(
  layer: ViewLayerSummary,
  files: ViewFileSummary[],
  layerMatchCounts: Map<string, number>,
  fileMatchCounts: Map<string, number>,
): boolean {
  if ((layerMatchCounts.get(layer.id) ?? 0) > 0) return true;
  if (layer.functionCount > 0 || layer.classCount > 0) return true;

  return files.some(
    (file) => (fileMatchCounts.get(file.id) ?? 0) > 0 || complexityWeight(file.node.complexity) > 0,
  );
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

  const connectivityScores = functionConnectivityScores(graph);

  const selectedLayers = viewGraph.layers
    .map((layer) => ({
      layer,
      files: [...viewGraph.filesById.values()].filter((file) => file.layerId === layer.id),
      score: layerScore(layer, layerMatchCounts),
      id: layer.id,
      title: layer.name,
    }))
    .filter(({ layer, files }) => layerHasRouteableSignal(layer, files, layerMatchCounts, fileMatchCounts))
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
        id: file.id,
        path: file.filePath,
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

      for (const dot of topFunctions(file, maxFunctionsPerFile, connectivityScores)) {
        steps.push({
          id: `function:${dot.nodeId}`,
          kind: "function",
          targetId: dot.nodeId,
          title: dot.name,
          subtitle: dot.lineRange ? `L${dot.lineRange[0]}-${dot.lineRange[1]}` : file.filePath,
          score: functionScore(dot, connectivityScores),
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
