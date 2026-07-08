import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { buildViewGraph } from "../../viewgraph/buildViewGraph";
import { buildJourneyRoute } from "../journeyRoute";

function journeyGraph(): KnowledgeGraph {
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
      { id: "file:src/main.ts", type: "file", name: "main.ts", filePath: "src/main.ts", summary: "Application entry point", tags: ["entry"], complexity: "simple" },
      { id: "function:src/main.ts:bootstrap", type: "function", name: "bootstrap", filePath: "src/main.ts", lineRange: [1, 12], summary: "Bootstraps the app", tags: [], complexity: "simple" },
      { id: "file:src/flow.ts", type: "file", name: "flow.ts", filePath: "src/flow.ts", summary: "Product request flow", tags: ["flow"], complexity: "moderate" },
      { id: "function:src/flow.ts:buildFlow", type: "function", name: "buildFlow", filePath: "src/flow.ts", lineRange: [2, 20], summary: "Builds the product flow", tags: [], complexity: "moderate" },
      { id: "file:src/service.ts", type: "file", name: "service.ts", filePath: "src/service.ts", summary: "Coordinates product service calls", tags: ["service"], complexity: "moderate" },
      { id: "function:src/service.ts:serveProduct", type: "function", name: "serveProduct", filePath: "src/service.ts", lineRange: [4, 34], summary: "Serves product requests", tags: [], complexity: "moderate" },
      { id: "file:src/model.ts", type: "file", name: "model.ts", filePath: "src/model.ts", summary: "Product data model", tags: ["model"], complexity: "moderate" },
      { id: "class:src/model.ts:ProductModel", type: "class", name: "ProductModel", filePath: "src/model.ts", lineRange: [1, 30], summary: "Product model", tags: [], complexity: "moderate" },
      { id: "file:src/ranker.ts", type: "file", name: "ranker.ts", filePath: "src/ranker.ts", summary: "Ranking strategy logic", tags: ["strategy"], complexity: "complex" },
      { id: "function:src/ranker.ts:rankProducts", type: "function", name: "rankProducts", filePath: "src/ranker.ts", lineRange: [3, 44], summary: "Ranks products", tags: [], complexity: "complex" },
      { id: "file:src/service.test.ts", type: "file", name: "service.test.ts", filePath: "src/service.test.ts", summary: "Service tests", tags: ["test"], complexity: "simple" },
      { id: "function:src/service.test.ts:tests", type: "function", name: "tests", filePath: "src/service.test.ts", lineRange: [1, 18], summary: "Tests service behavior", tags: [], complexity: "simple" },
      { id: "file:config/app.json", type: "file", name: "app.json", filePath: "config/app.json", summary: "App configuration", tags: ["config"], complexity: "simple" },
      { id: "file:scripts/deploy.ts", type: "file", name: "deploy.ts", filePath: "scripts/deploy.ts", summary: "Deploy operations script", tags: ["deploy"], complexity: "moderate" },
      { id: "function:scripts/deploy.ts:deploy", type: "function", name: "deploy", filePath: "scripts/deploy.ts", lineRange: [1, 24], summary: "Deploys the app", tags: [], complexity: "moderate" },
    ],
    edges: [
      { source: "file:src/main.ts", target: "function:src/main.ts:bootstrap", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/flow.ts", target: "function:src/flow.ts:buildFlow", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/service.ts", target: "function:src/service.ts:serveProduct", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/model.ts", target: "class:src/model.ts:ProductModel", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/ranker.ts", target: "function:src/ranker.ts:rankProducts", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/service.test.ts", target: "function:src/service.test.ts:tests", type: "contains", direction: "forward", weight: 1 },
      { source: "file:scripts/deploy.ts", target: "function:scripts/deploy.ts:deploy", type: "contains", direction: "forward", weight: 1 },
      { source: "function:src/main.ts:bootstrap", target: "function:src/flow.ts:buildFlow", type: "calls", direction: "forward", weight: 1 },
      { source: "function:src/flow.ts:buildFlow", target: "function:src/service.ts:serveProduct", type: "calls", direction: "forward", weight: 1 },
      { source: "function:src/service.ts:serveProduct", target: "function:src/ranker.ts:rankProducts", type: "calls", direction: "forward", weight: 1 },
    ],
    layers: [
      { id: "entry", name: "Entry", description: "Entry layer", nodeIds: ["file:src/main.ts"] },
      { id: "flow", name: "Flow", description: "Product flow layer", nodeIds: ["file:src/flow.ts", "file:src/service.ts"] },
      { id: "model", name: "Model", description: "Data model layer", nodeIds: ["file:src/model.ts"] },
      { id: "logic", name: "Logic", description: "Strategy logic layer", nodeIds: ["file:src/ranker.ts"] },
      { id: "tests", name: "Tests", description: "Test layer", nodeIds: ["file:src/service.test.ts"] },
      { id: "config", name: "Config", description: "Configuration layer", nodeIds: ["file:config/app.json"] },
      { id: "ops", name: "Operations", description: "Operations layer", nodeIds: ["file:scripts/deploy.ts"] },
    ],
    tour: [],
  };
}

function rawNodeGraph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "raw-node-app",
      languages: ["ts"],
      frameworks: [],
      description: "Raw node sample",
      analyzedAt: "2026-07-03T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes: [
      { id: "file:src/main.ts", type: "file", name: "main.ts", filePath: "src/main.ts", summary: "Entry", tags: [], complexity: "simple" },
      { id: "function:src/main.ts:start", type: "function", name: "start", filePath: "src/main.ts", lineRange: [1, 6], summary: "Starts app", tags: [], complexity: "simple" },
      { id: "schema:matched-user", type: "schema", name: "MatchedUser", summary: "Matched user schema", tags: [], complexity: "simple" },
      { id: "schema:related-order", type: "schema", name: "RelatedOrder", summary: "Related order schema", tags: [], complexity: "simple" },
      { id: "document:notes", type: "document", name: "Notes", summary: "Scratch notes", tags: [], complexity: "simple" },
    ],
    edges: [
      { source: "file:src/main.ts", target: "function:src/main.ts:start", type: "contains", direction: "forward", weight: 1 },
      { source: "schema:related-order", target: "function:src/main.ts:start", type: "defines_schema", direction: "forward", weight: 1 },
    ],
    layers: [
      { id: "entry", name: "Entry", description: "Entry layer", nodeIds: ["file:src/main.ts"] },
      { id: "matched-schema", name: "Matched Schema", description: "Matched schema layer", nodeIds: ["schema:matched-user"] },
      { id: "related-schema", name: "Related Schema", description: "Related schema layer", nodeIds: ["schema:related-order"] },
      { id: "notes", name: "Notes", description: "Notes layer", nodeIds: ["document:notes"] },
    ],
    tour: [],
  };
}

describe("buildJourneyRoute", () => {
  it("builds a deterministic section-priority route for the product journey", () => {
    const raw = journeyGraph();
    const route = buildJourneyRoute({
      graph: raw,
      viewGraph: buildViewGraph(raw),
      layerMatchCounts: new Map(),
      fileMatchCounts: new Map(),
    });

    expect(route.projectName).toBe("handoff-app");
    expect(route.sections).toEqual([
      "Start Here",
      "Product Flow",
      "Key Files",
      "Data Models",
      "Strategy / Logic",
      "Tests",
      "Configuration",
      "Risk & Operations",
      "Unmapped",
    ]);
    expect(route.steps.map((step) => [step.section, step.path])).toEqual([
      ["Start Here", "src/main.ts"],
      ["Product Flow", "src/flow.ts"],
      ["Product Flow", "src/service.ts"],
      ["Data Models", "src/model.ts"],
      ["Strategy / Logic", "src/ranker.ts"],
      ["Tests", "src/service.test.ts"],
      ["Configuration", "config/app.json"],
      ["Risk & Operations", "scripts/deploy.ts"],
    ]);
    for (const step of route.steps) {
      expect(step.id).toBeTruthy();
      expect(step.targetId).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.subtitle).toBeTruthy();
      expect(step.reason).toBeTruthy();
      expect(typeof step.score).toBe("number");
    }
  });

  it.each([
    ["missing graph", null, buildViewGraph(journeyGraph())],
    ["missing view graph", journeyGraph(), null],
  ] as const)("returns the exact select-node fallback when %s", (_label, graph, viewGraph) => {
    const route = buildJourneyRoute({
      graph,
      viewGraph,
      layerMatchCounts: new Map(),
      fileMatchCounts: new Map(),
    });

    expect(route.steps).toEqual([
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
    ]);
  });

  it("uses nodeMatchCounts and raw relationships for direct raw nodes, while excluding isolated raw nodes", () => {
    const raw = rawNodeGraph();
    const route = buildJourneyRoute({
      graph: raw,
      viewGraph: buildViewGraph(raw),
      layerMatchCounts: new Map(),
      fileMatchCounts: new Map([["schema:matched-user", 10]]),
      nodeMatchCounts: new Map([["schema:matched-user", 2]]),
    });

    expect(route.steps.map((step) => [step.section, step.targetId])).toContainEqual([
      "Data Models",
      "schema:matched-user",
    ]);
    expect(route.steps.map((step) => [step.section, step.targetId])).toContainEqual([
      "Data Models",
      "schema:related-order",
    ]);
    expect(route.steps.map((step) => [step.section, step.targetId])).not.toContainEqual([
      "Unmapped",
      "document:notes",
    ]);
  });

  it("does not treat fileMatchCounts as direct raw node search signal", () => {
    const raw = rawNodeGraph();
    const route = buildJourneyRoute({
      graph: raw,
      viewGraph: buildViewGraph(raw),
      layerMatchCounts: new Map(),
      fileMatchCounts: new Map([["schema:matched-user", 10]]),
    });

    expect(route.steps.map((step) => [step.section, step.targetId])).not.toContainEqual([
      "Data Models",
      "schema:matched-user",
    ]);
  });

  it("does not include isolated raw nodes from layer match counts alone", () => {
    const raw = rawNodeGraph();
    const route = buildJourneyRoute({
      graph: raw,
      viewGraph: buildViewGraph(raw),
      layerMatchCounts: new Map([["matched-schema", 4], ["notes", 4]]),
      fileMatchCounts: new Map(),
    });

    expect(route.steps.map((step) => [step.section, step.targetId])).not.toContainEqual([
      "Data Models",
      "schema:matched-user",
    ]);
    expect(route.steps.map((step) => [step.section, step.targetId])).not.toContainEqual([
      "Unmapped",
      "document:notes",
    ]);
  });
});
