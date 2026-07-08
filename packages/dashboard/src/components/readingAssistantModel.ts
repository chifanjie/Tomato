import type { SearchResult } from "@understand-code/core/search";
import type { KnowledgeGraph } from "@understand-code/core/types";
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
  copy?: ReadingAssistantCopy;
}

export interface ReadingAssistantCopy {
  projectReadingMap: string;
  overviewFallbackSubtitle: string;
  noLayerSelectedTitle: string;
  noLayerSelectedSubtitle: string;
  noGraphLoadedTitle: string;
  noGraphLoadedSubtitle: string;
  overviewRouteSteps: string[];
  layerRouteSteps: string[];
  metrics: {
    layers: string;
    files: string;
    functions: string;
    classes: string;
    modules: string;
  };
}

export const DEFAULT_READING_ASSISTANT_COPY: ReadingAssistantCopy = {
  projectReadingMap: "Project reading map",
  overviewFallbackSubtitle: "Choose a layer, then drill into files and functions.",
  noLayerSelectedTitle: "No layer selected",
  noLayerSelectedSubtitle: "Return to the project overview and open a layer.",
  noGraphLoadedTitle: "No graph loaded",
  noGraphLoadedSubtitle: "Load a knowledge graph to start reading.",
  overviewRouteSteps: [
    "Start with a layer to choose the part of the system you want to read.",
    "Open the layer and scan files by function density and imports.",
    "Open a file to read its function matrix and impact panel.",
  ],
  layerRouteSteps: [
    "Scan the top files first.",
    "Use function count and imports to spot dense code.",
    "Open a file to inspect its function matrix.",
  ],
  metrics: {
    layers: "Layers",
    files: "Files",
    functions: "Functions",
    classes: "Classes",
    modules: "Modules",
  },
};

function overviewModel(
  graph: KnowledgeGraph,
  viewGraph: ViewGraph,
  copy: ReadingAssistantCopy,
): ReadingAssistantModel {
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
    title: copy.projectReadingMap,
    subtitle: graph.project.description || copy.overviewFallbackSubtitle,
    routeSteps: copy.overviewRouteSteps,
    metrics: [
      { label: copy.metrics.layers, value: viewGraph.layers.length },
      { label: copy.metrics.files, value: files.length },
      { label: copy.metrics.functions, value: functionTotal },
    ],
    primaryItems: topLayers,
    searchSummary: null,
  };
}

function layerModel(
  viewGraph: ViewGraph,
  activeLayerId: string | null,
  copy: ReadingAssistantCopy,
): ReadingAssistantModel {
  const layer = activeLayerId ? viewGraph.layersById.get(activeLayerId) ?? null : null;
  if (!layer) {
    return {
      kind: "empty",
      title: copy.noLayerSelectedTitle,
      subtitle: copy.noLayerSelectedSubtitle,
      routeSteps: copy.overviewRouteSteps,
      metrics: [],
      primaryItems: [],
      searchSummary: null,
    };
  }

  return {
    kind: "layer",
    title: layer.name,
    subtitle: layer.description,
    routeSteps: copy.layerRouteSteps,
    metrics: [
      { label: copy.metrics.files, value: layer.fileCount },
      { label: copy.metrics.functions, value: layer.functionCount },
      { label: copy.metrics.classes, value: layer.classCount },
      { label: copy.metrics.modules, value: layer.moduleCount },
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
  copy = DEFAULT_READING_ASSISTANT_COPY,
}: ReadingAssistantModelInput): ReadingAssistantModel {
  if (!graph || !viewGraph) {
    return {
      kind: "empty",
      title: copy.noGraphLoadedTitle,
      subtitle: copy.noGraphLoadedSubtitle,
      routeSteps: [],
      metrics: [],
      primaryItems: [],
      searchSummary: null,
    };
  }

  const base =
    navigationLevel === "layer-detail"
      ? layerModel(viewGraph, activeLayerId, copy)
      : overviewModel(graph, viewGraph, copy);

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
