import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import type { KnowledgeGraph } from "@understand-anything/core/types";
import { buildViewGraph } from "../../../viewgraph/buildViewGraph";
import { buildKnowledgeContextIndex } from "../../../workbench/knowledgeContext";
import VisualGuidedWorkbench from "../VisualGuidedWorkbench";

vi.mock("../../ReadableViewGraphPage", async () => {
  const React = await import("react");
  return {
    default: () => React.createElement("section", null, "Mock readable graph workbench"),
  };
});

vi.mock("../../FunctionDetailPage", async () => {
  const React = await import("react");
  return {
    default: () => React.createElement("section", null, "Mock function detail workbench"),
  };
});

function tinyWorkbenchGraph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "workbench-smoke",
      languages: ["ts"],
      frameworks: ["react"],
      description: "Small graph for workbench shell smoke rendering",
      analyzedAt: "2026-07-03T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes: [
      {
        id: "file:src/app.tsx",
        type: "file",
        name: "app.tsx",
        filePath: "src/app.tsx",
        summary: "Application entry point",
        tags: ["entry"],
        complexity: "simple",
      },
      {
        id: "function:src/app.tsx:App",
        type: "function",
        name: "App",
        filePath: "src/app.tsx",
        lineRange: [1, 12],
        summary: "Renders the application shell",
        tags: [],
        complexity: "simple",
      },
    ],
    edges: [
      {
        source: "file:src/app.tsx",
        target: "function:src/app.tsx:App",
        type: "contains",
        direction: "forward",
        weight: 1,
      },
    ],
    layers: [
      {
        id: "entry",
        name: "Entry",
        description: "Entry layer",
        nodeIds: ["file:src/app.tsx"],
      },
    ],
    tour: [],
  };
}

describe("VisualGuidedWorkbench", () => {
  it("renders the workbench shell with graph-derived context and mocked graph content", () => {
    const graph = tinyWorkbenchGraph();
    const viewGraph = buildViewGraph(graph);
    const knowledgeContextIndex = buildKnowledgeContextIndex({ traces: [], documents: [] });

    const output = renderToString(
      React.createElement(VisualGuidedWorkbench, {
        graph,
        viewGraph,
        knowledgeContextIndex,
      }),
    );

    expect(output).toContain("Guided route");
    expect(output).toContain("Context");
    expect(output).toContain("Engineer handoff");
    expect(output).toContain("No generated knowledge document is linked yet. Showing graph-derived context.");
    expect(output).toContain("Mock readable graph workbench");
  });
});
