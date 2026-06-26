import type { SearchResult } from "@understand-anything/core/search";
import type { KnowledgeGraph } from "@understand-anything/core/types";
import type { NavigationLevel } from "../store";
import { buildReadableSearchMatches } from "../viewgraph/readableSelectors";
import type { ViewGraph } from "../viewgraph/types";

export interface ReadingAssistantMetric {
  label: string;
  value: number;
}

export interface ReadingAssistantItem {
  id: string;
  label: string;
  detail: string;
  value?: number;
}

export interface ReadingAssistantSearchSummary {
  query: string;
  fileMatches: number;
  layerMatches: number;
}

export interface ReadingAssistantModel {
  kind: "overview" | "layer" | "empty";
  title: string;
  subtitle: string;
  routeSteps: string[];
  metrics: ReadingAssistantMetric[];
  primaryItems: ReadingAssistantItem[];
  searchSummary: ReadingAssistantSearchSummary | null;
}

export interface ReadingAssistantModelInput {
  graph: KnowledgeGraph | null;
  viewGraph: ViewGraph | null;
  navigationLevel: NavigationLevel;
  activeLayerId: string | null;
  searchQuery: string;
  searchResults: SearchResult[];
}

const ROUTE_STEPS = [
  "Start with a layer to choose the part of the system you want to read.",
  "Open the layer and scan files by function density and imports.",
  "Open a file to read its function matrix and impact panel.",
];

function overviewModel(graph: KnowledgeGraph, viewGraph: ViewGraph): ReadingAssistantModel {
  const files = [...viewGraph.filesById.values()];
  const functionTotal = files.reduce((sum, file) => sum + file.functionCount, 0);
  const topLayers = [...viewGraph.layers]
    .sort((a, b) => b.functionCount - a.functionCount)
    .slice(0, 5)
    .map((layer) => ({
      id: layer.id,
      label: layer.name,
      detail: layer.description,
      value: layer.functionCount,
    }));

  return {
    kind: "overview",
    title: "Project reading map",
    subtitle: graph.project.description || "Choose a layer, then drill into files and functions.",
    routeSteps: ROUTE_STEPS,
    metrics: [
      { label: "Layers", value: viewGraph.layers.length },
      { label: "Files", value: files.length },
      { label: "Functions", value: functionTotal },
    ],
    primaryItems: topLayers,
    searchSummary: null,
  };
}

function layerModel(viewGraph: ViewGraph, activeLayerId: string | null): ReadingAssistantModel {
  const layer = activeLayerId ? viewGraph.layersById.get(activeLayerId) ?? null : null;
  if (!layer) {
    return {
      kind: "empty",
      title: "No layer selected",
      subtitle: "Return to the project overview and open a layer.",
      routeSteps: ROUTE_STEPS,
      metrics: [],
      primaryItems: [],
      searchSummary: null,
    };
  }

  return {
    kind: "layer",
    title: layer.name,
    subtitle: layer.description,
    routeSteps: [
      "Scan the top files first.",
      "Use function count and imports to spot dense code.",
      "Open a file to inspect its function matrix.",
    ],
    metrics: [
      { label: "Files", value: layer.fileCount },
      { label: "Functions", value: layer.functionCount },
      { label: "Classes", value: layer.classCount },
      { label: "Modules", value: layer.moduleCount },
    ],
    primaryItems: layer.topFiles.slice(0, 6).map((file) => ({
      id: file.id,
      label: file.name,
      detail: file.filePath,
      value: file.functionCount,
    })),
    searchSummary: null,
  };
}

export function buildReadingAssistantModel({
  graph,
  viewGraph,
  navigationLevel,
  activeLayerId,
  searchQuery,
  searchResults,
}: ReadingAssistantModelInput): ReadingAssistantModel {
  if (!graph || !viewGraph) {
    return {
      kind: "empty",
      title: "No graph loaded",
      subtitle: "Load a knowledge graph to start reading.",
      routeSteps: [],
      metrics: [],
      primaryItems: [],
      searchSummary: null,
    };
  }

  const base =
    navigationLevel === "layer-detail"
      ? layerModel(viewGraph, activeLayerId)
      : overviewModel(graph, viewGraph);

  if (searchQuery.trim()) {
    const matches = buildReadableSearchMatches(graph, viewGraph, searchResults);
    base.searchSummary = {
      query: searchQuery.trim(),
      fileMatches: matches.matchedFileIds.size,
      layerMatches: matches.layerMatchCounts.size,
    };
  }

  return base;
}
