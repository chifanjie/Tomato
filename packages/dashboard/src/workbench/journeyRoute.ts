import type { GraphNode, KnowledgeGraph } from "@understand-anything/core/types";
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
  nodeMatchCounts?: Map<string, number>;
  maxLayers?: number;
  maxFilesPerLayer?: number;
  maxFunctionsPerFile?: number;
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

function directNodeRelationshipScores(graph: KnowledgeGraph): Map<string, number> {
  const scores = new Map<string, number>();
  for (const edge of graph.edges) {
    const weight = edge.weight ?? 1;
    scores.set(edge.source, (scores.get(edge.source) ?? 0) + weight);
    scores.set(edge.target, (scores.get(edge.target) ?? 0) + weight);
  }
  return scores;
}

function directNodeScore(
  node: GraphNode,
  nodeMatchCounts: Map<string, number>,
  relationshipScores: Map<string, number>,
): number {
  if (!routeableDirectNodeTypes.has(node.type)) return 0;

  const complexity = complexityWeight(node.complexity);
  const matches = nodeMatchCounts.get(node.id) ?? 0;
  const relationships = relationshipScores.get(node.id) ?? 0;
  if (complexity === 0 && matches === 0 && relationships === 0) return 0;

  return complexity + matches * 35 + relationships * 8;
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

function compareString(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function byScoreThenTitle<T extends { id: string; score: number; title: string; path?: string }>(a: T, b: T): number {
  if (b.score !== a.score) return b.score - a.score;
  const titleOrder = compareString(a.title, b.title);
  if (titleOrder !== 0) return titleOrder;
  const pathOrder = compareString(a.path ?? "", b.path ?? "");
  if (pathOrder !== 0) return pathOrder;
  return compareString(a.id, b.id);
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
      const nameOrder = compareString(a.name, b.name);
      if (nameOrder !== 0) return nameOrder;
      return compareString(a.nodeId, b.nodeId);
    })
    .slice(0, maxFunctions);
}

function layerHasRouteableSignal(
  layer: ViewLayerSummary,
  files: ViewFileSummary[],
  directNodes: GraphNode[],
  layerMatchCounts: Map<string, number>,
  fileMatchCounts: Map<string, number>,
  nodeMatchCounts: Map<string, number>,
  directRelationshipScores: Map<string, number>,
): boolean {
  if ((layerMatchCounts.get(layer.id) ?? 0) > 0) return true;
  if (layer.functionCount > 0 || layer.classCount > 0) return true;
  if (directNodes.some((node) => directNodeScore(node, nodeMatchCounts, directRelationshipScores) > 0)) {
    return true;
  }

  return files.some(
    (file) => (fileMatchCounts.get(file.id) ?? 0) > 0 || complexityWeight(file.node.complexity) > 0,
  );
}

function rawLayerDirectNodes(graph: KnowledgeGraph, layerId: string, nodesById: Map<string, GraphNode>): GraphNode[] {
  const rawLayer = graph.layers.find((layer) => layer.id === layerId);
  if (!rawLayer) return [];

  return rawLayer.nodeIds
    .map((id) => nodesById.get(id))
    .filter((node): node is GraphNode => node !== undefined && node.type !== "file");
}

export function buildJourneyRoute({
  graph,
  viewGraph,
  layerMatchCounts,
  fileMatchCounts,
  nodeMatchCounts = new Map(),
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
  const directRelationshipScores = directNodeRelationshipScores(graph);
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));

  const selectedLayers = viewGraph.layers
    .map((layer) => {
      const directNodes = rawLayerDirectNodes(graph, layer.id, nodesById);
      return {
        layer,
        files: [...viewGraph.filesById.values()].filter((file) => file.layerId === layer.id),
        directNodes,
        score: layerScore(layer, layerMatchCounts) +
          directNodes.reduce(
            (sum, node) => sum + directNodeScore(node, nodeMatchCounts, directRelationshipScores),
            0,
          ),
        id: layer.id,
        title: layer.name,
      };
    })
    .filter(({ layer, files, directNodes }) =>
      layerHasRouteableSignal(
        layer,
        files,
        directNodes,
        layerMatchCounts,
        fileMatchCounts,
        nodeMatchCounts,
        directRelationshipScores,
      ),
    )
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
