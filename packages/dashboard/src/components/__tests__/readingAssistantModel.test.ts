import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-code/core/types";
import type { SearchResult } from "@understand-code/core/search";
import { buildViewGraph } from "../../viewgraph/buildViewGraph";
import { buildReadingAssistantModel } from "../readingAssistantModel";
import type { ReadingAssistantCopy } from "../readingAssistantModel";

function sampleGraph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "sample",
      languages: ["go"],
      frameworks: [],
      description: "Sample project",
      analyzedAt: "2026-06-26T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes: [
      { id: "file:src/a.go", type: "file", name: "a.go", filePath: "src/a.go", summary: "", tags: [], complexity: "complex" },
      { id: "file:src/b.go", type: "file", name: "b.go", filePath: "src/b.go", summary: "", tags: [], complexity: "simple" },
      { id: "function:src/a.go:Build", type: "function", name: "Build", filePath: "src/a.go", lineRange: [1, 5], summary: "", tags: [], complexity: "complex" },
      { id: "function:src/a.go:Filter", type: "function", name: "Filter", filePath: "src/a.go", lineRange: [7, 9], summary: "", tags: [], complexity: "moderate" },
      { id: "function:src/b.go:Load", type: "function", name: "Load", filePath: "src/b.go", lineRange: [2, 3], summary: "", tags: [], complexity: "simple" },
    ],
    edges: [
      { source: "file:src/a.go", target: "function:src/a.go:Build", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/a.go", target: "function:src/a.go:Filter", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/b.go", target: "function:src/b.go:Load", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/a.go", target: "file:src/b.go", type: "imports", direction: "forward", weight: 0.7 },
    ],
    layers: [
      { id: "core", name: "Core", description: "Core layer", nodeIds: ["file:src/a.go"] },
      { id: "data", name: "Data", description: "Data layer", nodeIds: ["file:src/b.go"] },
    ],
    tour: [],
  };
}

describe("buildReadingAssistantModel", () => {
  it("builds an overview model from the readable graph", () => {
    const graph = sampleGraph();
    const viewGraph = buildViewGraph(graph);

    const model = buildReadingAssistantModel({
      graph,
      viewGraph,
      navigationLevel: "overview",
      activeLayerId: null,
      searchQuery: "",
      searchResults: [],
    });

    expect(model.kind).toBe("overview");
    expect(model.title).toBe("Project reading map");
    expect(model.metrics.map((metric) => [metric.label, metric.value])).toEqual([
      ["Layers", 2],
      ["Files", 2],
      ["Functions", 3],
    ]);
    expect(model.primaryItems.map((item) => item.label)).toEqual(["Core", "Data"]);
  });

  it("builds a layer model with top files", () => {
    const graph = sampleGraph();
    const viewGraph = buildViewGraph(graph);

    const model = buildReadingAssistantModel({
      graph,
      viewGraph,
      navigationLevel: "layer-detail",
      activeLayerId: "core",
      searchQuery: "",
      searchResults: [],
    });

    expect(model.kind).toBe("layer");
    expect(model.title).toBe("Core");
    expect(model.metrics.map((metric) => [metric.label, metric.value])).toContainEqual(["Functions", 2]);
    expect(model.primaryItems.map((item) => item.label)).toEqual(["a.go"]);
  });

  it("summarizes readable search matches", () => {
    const graph = sampleGraph();
    const viewGraph = buildViewGraph(graph);
    const searchResults: SearchResult[] = [
      { nodeId: "function:src/a.go:Build", score: 0.05 },
      { nodeId: "file:src/b.go", score: 0.1 },
    ];

    const model = buildReadingAssistantModel({
      graph,
      viewGraph,
      navigationLevel: "overview",
      activeLayerId: null,
      searchQuery: "build",
      searchResults,
    });

    expect(model.searchSummary).toEqual({
      query: "build",
      fileMatches: 2,
      layerMatches: 2,
    });
  });

  it("uses custom copy for model-provided text", () => {
    const graph = {
      ...sampleGraph(),
      project: {
        ...sampleGraph().project,
        description: "",
      },
    };
    const viewGraph = buildViewGraph(graph);
    const copy: ReadingAssistantCopy = {
      projectReadingMap: "Mapa de lectura",
      overviewFallbackSubtitle: "Elige una capa y luego abre archivos.",
      noLayerSelectedTitle: "Sin capa",
      noLayerSelectedSubtitle: "Vuelve al resumen.",
      noGraphLoadedTitle: "Sin grafo",
      noGraphLoadedSubtitle: "Carga un grafo.",
      overviewRouteSteps: ["Paso uno", "Paso dos", "Paso tres"],
      layerRouteSteps: ["Archivo uno", "Archivo dos", "Archivo tres"],
      metrics: {
        layers: "Capas",
        files: "Archivos",
        functions: "Funciones",
        classes: "Clases",
        modules: "Modulos",
      },
    };

    const overview = buildReadingAssistantModel({
      graph,
      viewGraph,
      navigationLevel: "overview",
      activeLayerId: null,
      searchQuery: "",
      searchResults: [],
      copy,
    });
    const layer = buildReadingAssistantModel({
      graph,
      viewGraph,
      navigationLevel: "layer-detail",
      activeLayerId: "core",
      searchQuery: "",
      searchResults: [],
      copy,
    });
    const empty = buildReadingAssistantModel({
      graph: null,
      viewGraph: null,
      navigationLevel: "overview",
      activeLayerId: null,
      searchQuery: "",
      searchResults: [],
      copy,
    });

    expect(overview.title).toBe("Mapa de lectura");
    expect(overview.subtitle).toBe("Elige una capa y luego abre archivos.");
    expect(overview.routeSteps).toEqual(["Paso uno", "Paso dos", "Paso tres"]);
    expect(overview.metrics.map((metric) => metric.label)).toEqual([
      "Capas",
      "Archivos",
      "Funciones",
    ]);
    expect(layer.routeSteps).toEqual(["Archivo uno", "Archivo dos", "Archivo tres"]);
    expect(layer.metrics.map((metric) => metric.label)).toEqual([
      "Archivos",
      "Funciones",
      "Clases",
      "Modulos",
    ]);
    expect(empty.title).toBe("Sin grafo");
    expect(empty.subtitle).toBe("Carga un grafo.");
  });
});
