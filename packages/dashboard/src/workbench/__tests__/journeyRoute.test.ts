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
      { id: "function:src/api.ts:handleRequest", type: "function", name: "handleRequest", filePath: "src/api.ts", lineRange: [1, 20], summary: "Handles requests", tags: [], complexity: "complex", isExported: true },
      { id: "file:src/model.ts", type: "file", name: "model.ts", filePath: "src/model.ts", summary: "Model helpers", tags: [], complexity: "moderate" },
      { id: "function:src/model.ts:buildModel", type: "function", name: "buildModel", filePath: "src/model.ts", lineRange: [2, 10], summary: "Builds model", tags: [], complexity: "moderate", isExported: true },
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
});
