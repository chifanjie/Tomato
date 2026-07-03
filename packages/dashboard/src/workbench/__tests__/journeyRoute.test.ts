import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-anything/core/types";
import { buildViewGraph } from "../../viewgraph/buildViewGraph";
import { buildJourneyRoute } from "../journeyRoute";

function graph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "handoff-app",
      languages: ["ts"],
      frameworks: ["react"],
      description: "Dashboard handoff sample",
      analyzedAt: "2026-07-03T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes: [
      { id: "file:src/api.ts", type: "file", name: "api.ts", filePath: "src/api.ts", summary: "API entry", tags: [], complexity: "complex" },
      { id: "function:src/api.ts:handleRequest", type: "function", name: "handleRequest", filePath: "src/api.ts", lineRange: [1, 20], summary: "Handles requests", tags: [], complexity: "complex" },
      { id: "file:src/model.ts", type: "file", name: "model.ts", filePath: "src/model.ts", summary: "Model helpers", tags: [], complexity: "moderate" },
      { id: "function:src/model.ts:buildModel", type: "function", name: "buildModel", filePath: "src/model.ts", lineRange: [2, 10], summary: "Builds model", tags: [], complexity: "moderate" },
      { id: "file:src/ui.tsx", type: "file", name: "ui.tsx", filePath: "src/ui.tsx", summary: "UI", tags: [], complexity: "simple" },
    ],
    edges: [
      { source: "file:src/api.ts", target: "function:src/api.ts:handleRequest", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/model.ts", target: "function:src/model.ts:buildModel", type: "contains", direction: "forward", weight: 1 },
      { source: "function:src/api.ts:handleRequest", target: "function:src/model.ts:buildModel", type: "calls", direction: "forward", weight: 1 },
      { source: "file:src/api.ts", target: "file:src/model.ts", type: "imports", direction: "forward", weight: 1 },
    ],
    layers: [
      { id: "api", name: "API", description: "Request entry layer", nodeIds: ["file:src/api.ts"] },
      { id: "model", name: "Model", description: "Business model layer", nodeIds: ["file:src/model.ts"] },
      { id: "ui", name: "UI", description: "Interface layer", nodeIds: ["file:src/ui.tsx"] },
    ],
    tour: [],
  };
}

describe("buildJourneyRoute", () => {
  it("builds a compact deterministic route from project to layer, file, and function", () => {
    const raw = graph();
    const viewGraph = buildViewGraph(raw);
    const route = buildJourneyRoute({
      graph: raw,
      viewGraph,
      layerMatchCounts: new Map([["model", 3]]),
      fileMatchCounts: new Map([["file:src/model.ts", 2]]),
    });

    expect(route.projectName).toBe("handoff-app");
    expect(route.steps.map((step) => [step.kind, step.targetId])).toEqual([
      ["project", "project"],
      ["layer", "model"],
      ["file", "file:src/model.ts"],
      ["function", "function:src/model.ts:buildModel"],
      ["layer", "api"],
      ["file", "file:src/api.ts"],
      ["function", "function:src/api.ts:handleRequest"],
    ]);
    expect(route.steps[1].score).toBeGreaterThan(route.steps[4].score);
  });

  it("returns a project-only route when no view graph exists", () => {
    const route = buildJourneyRoute({
      graph: null,
      viewGraph: null,
      layerMatchCounts: new Map(),
      fileMatchCounts: new Map(),
    });

    expect(route.projectName).toBe("Project");
    expect(route.steps).toEqual([
      {
        id: "project",
        kind: "project",
        targetId: "project",
        title: "Project overview",
        subtitle: "Load a graph to build the guided route.",
        score: 0,
      },
    ]);
  });

  it("ranks same-file functions by call connectivity from graph edges", () => {
    const raw: KnowledgeGraph = {
      ...graph(),
      nodes: [
        { id: "file:src/service.ts", type: "file", name: "service.ts", filePath: "src/service.ts", summary: "Service", tags: [], complexity: "simple" },
        { id: "function:src/service.ts:buildA", type: "function", name: "buildA", filePath: "src/service.ts", lineRange: [1, 5], summary: "", tags: [], complexity: "simple" },
        { id: "function:src/service.ts:buildZ", type: "function", name: "buildZ", filePath: "src/service.ts", lineRange: [7, 12], summary: "", tags: [], complexity: "simple" },
        { id: "file:src/deps.ts", type: "file", name: "deps.ts", filePath: "src/deps.ts", summary: "Deps", tags: [], complexity: "simple" },
        { id: "function:src/deps.ts:one", type: "function", name: "one", filePath: "src/deps.ts", lineRange: [1, 2], summary: "", tags: [], complexity: "simple" },
        { id: "function:src/deps.ts:two", type: "function", name: "two", filePath: "src/deps.ts", lineRange: [3, 4], summary: "", tags: [], complexity: "simple" },
      ],
      edges: [
        { source: "file:src/service.ts", target: "function:src/service.ts:buildA", type: "contains", direction: "forward", weight: 1 },
        { source: "file:src/service.ts", target: "function:src/service.ts:buildZ", type: "contains", direction: "forward", weight: 1 },
        { source: "file:src/deps.ts", target: "function:src/deps.ts:one", type: "contains", direction: "forward", weight: 1 },
        { source: "file:src/deps.ts", target: "function:src/deps.ts:two", type: "contains", direction: "forward", weight: 1 },
        { source: "function:src/service.ts:buildZ", target: "function:src/deps.ts:one", type: "calls", direction: "forward", weight: 1 },
        { source: "function:src/deps.ts:two", target: "function:src/service.ts:buildZ", type: "calls", direction: "forward", weight: 1 },
      ],
      layers: [
        { id: "service", name: "Service", description: "Service layer", nodeIds: ["file:src/service.ts"] },
        { id: "deps", name: "Deps", description: "Dependency layer", nodeIds: ["file:src/deps.ts"] },
      ],
    };

    const route = buildJourneyRoute({
      graph: raw,
      viewGraph: buildViewGraph(raw),
      layerMatchCounts: new Map([["service", 1]]),
      fileMatchCounts: new Map([["file:src/service.ts", 1]]),
      maxLayers: 1,
      maxFilesPerLayer: 1,
      maxFunctionsPerFile: 1,
    });

    expect(route.steps.find((step) => step.kind === "function")?.targetId).toBe("function:src/service.ts:buildZ");
  });

  it("includes class-only complex-file layers while excluding low-signal file-only layers", () => {
    const raw: KnowledgeGraph = {
      ...graph(),
      nodes: [
        { id: "file:src/app.ts", type: "file", name: "app.ts", filePath: "src/app.ts", summary: "App", tags: [], complexity: "simple" },
        { id: "function:src/app.ts:start", type: "function", name: "start", filePath: "src/app.ts", lineRange: [1, 4], summary: "", tags: [], complexity: "simple" },
        { id: "file:src/schema.ts", type: "file", name: "schema.ts", filePath: "src/schema.ts", summary: "Schema", tags: [], complexity: "complex" },
        { id: "class:src/schema.ts:SchemaModel", type: "class", name: "SchemaModel", filePath: "src/schema.ts", lineRange: [1, 25], summary: "", tags: [], complexity: "complex" },
        { id: "file:src/readme.md", type: "file", name: "readme.md", filePath: "src/readme.md", summary: "Docs", tags: [], complexity: "simple" },
      ],
      edges: [
        { source: "file:src/app.ts", target: "function:src/app.ts:start", type: "contains", direction: "forward", weight: 1 },
        { source: "file:src/schema.ts", target: "class:src/schema.ts:SchemaModel", type: "contains", direction: "forward", weight: 1 },
      ],
      layers: [
        { id: "app", name: "App", description: "App layer", nodeIds: ["file:src/app.ts"] },
        { id: "schema", name: "Schema", description: "Schema layer", nodeIds: ["file:src/schema.ts"] },
        { id: "docs", name: "Docs", description: "Docs layer", nodeIds: ["file:src/readme.md"] },
      ],
    };

    const route = buildJourneyRoute({
      graph: raw,
      viewGraph: buildViewGraph(raw),
      layerMatchCounts: new Map(),
      fileMatchCounts: new Map(),
      maxLayers: 4,
    });

    expect(route.steps.map((step) => [step.kind, step.targetId])).toContainEqual(["layer", "schema"]);
    expect(route.steps.map((step) => [step.kind, step.targetId])).toContainEqual(["file", "file:src/schema.ts"]);
    expect(route.steps.map((step) => [step.kind, step.targetId])).not.toContainEqual(["layer", "docs"]);
  });

  it("uses stable ids and paths when scores and titles tie", () => {
    const raw: KnowledgeGraph = {
      ...graph(),
      nodes: [
        { id: "file:src/beta.ts", type: "file", name: "same.ts", filePath: "src/beta.ts", summary: "Beta", tags: [], complexity: "simple" },
        { id: "function:src/beta.ts:runZ", type: "function", name: "run", filePath: "src/beta.ts", lineRange: [1, 4], summary: "", tags: [], complexity: "simple" },
        { id: "function:src/beta.ts:runA", type: "function", name: "run", filePath: "src/beta.ts", lineRange: [1, 4], summary: "", tags: [], complexity: "simple" },
        { id: "file:src/alpha.ts", type: "file", name: "same.ts", filePath: "src/alpha.ts", summary: "Alpha", tags: [], complexity: "simple" },
        { id: "function:src/alpha.ts:runZ", type: "function", name: "run", filePath: "src/alpha.ts", lineRange: [1, 4], summary: "", tags: [], complexity: "simple" },
        { id: "function:src/alpha.ts:runA", type: "function", name: "run", filePath: "src/alpha.ts", lineRange: [1, 4], summary: "", tags: [], complexity: "simple" },
      ],
      edges: [
        { source: "file:src/beta.ts", target: "function:src/beta.ts:runZ", type: "contains", direction: "forward", weight: 1 },
        { source: "file:src/beta.ts", target: "function:src/beta.ts:runA", type: "contains", direction: "forward", weight: 1 },
        { source: "file:src/alpha.ts", target: "function:src/alpha.ts:runZ", type: "contains", direction: "forward", weight: 1 },
        { source: "file:src/alpha.ts", target: "function:src/alpha.ts:runA", type: "contains", direction: "forward", weight: 1 },
      ],
      layers: [
        { id: "z-layer", name: "Same", description: "Z layer", nodeIds: ["file:src/beta.ts"] },
        { id: "a-layer", name: "Same", description: "A layer", nodeIds: ["file:src/alpha.ts"] },
      ],
    };

    const route = buildJourneyRoute({
      graph: raw,
      viewGraph: buildViewGraph(raw),
      layerMatchCounts: new Map(),
      fileMatchCounts: new Map(),
      maxLayers: 2,
      maxFilesPerLayer: 1,
      maxFunctionsPerFile: 2,
    });

    expect(route.steps.map((step) => [step.kind, step.targetId])).toEqual([
      ["project", "project"],
      ["layer", "a-layer"],
      ["file", "file:src/alpha.ts"],
      ["function", "function:src/alpha.ts:runA"],
      ["function", "function:src/alpha.ts:runZ"],
      ["layer", "z-layer"],
      ["file", "file:src/beta.ts"],
      ["function", "function:src/beta.ts:runA"],
      ["function", "function:src/beta.ts:runZ"],
    ]);
  });
});
