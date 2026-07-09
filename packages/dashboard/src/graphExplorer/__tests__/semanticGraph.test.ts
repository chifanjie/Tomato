import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { buildWikiIndex } from "../../wiki/wikiIndex";
import {
  buildSemanticGraph,
  semanticGroupForNode,
  type GraphExplorerMode,
} from "../semanticGraph";

const allNodeIds = [
  "domain:commerce",
  "flow:recognition",
  "step:recognition:validate",
  "module:productline",
  "concept:scoring",
  "file:productline/service.go",
  "config:productline/config.yaml",
  "service:recognition-api",
  "endpoint:GET /recognise",
  "pipeline:recognition-events",
  "table:recognition_events",
  "schema:recognition_event",
  "resource:kafka:recognition-events",
  "document:runbook",
  "function:productline/service.go:Recognise",
  "class:productline/service.go:Recognizer",
  "file:shared/rate_limit.go",
];

function graph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "sample",
      languages: ["go"],
      frameworks: [],
      description: "",
      analyzedAt: "2026-07-09T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes: [
      { id: "domain:commerce", type: "domain", name: "Commerce", summary: "Domain.", tags: [], complexity: "moderate" },
      { id: "flow:recognition", type: "flow", name: "Recognition", summary: "Flow.", tags: [], complexity: "moderate" },
      { id: "step:recognition:validate", type: "step", name: "Validate", summary: "Step.", tags: [], complexity: "simple" },
      { id: "module:productline", type: "module", name: "productline", summary: "Module.", tags: [], complexity: "moderate" },
      { id: "concept:scoring", type: "concept", name: "Scoring", summary: "Concept.", tags: [], complexity: "moderate" },
      { id: "file:productline/service.go", type: "file", name: "service.go", filePath: "productline/service.go", summary: "File.", tags: [], complexity: "moderate" },
      { id: "config:productline/config.yaml", type: "config", name: "config.yaml", filePath: "productline/config.yaml", summary: "Config.", tags: [], complexity: "simple" },
      { id: "service:recognition-api", type: "service", name: "Recognition API", summary: "Service.", tags: [], complexity: "moderate" },
      { id: "endpoint:GET /recognise", type: "endpoint", name: "GET /recognise", summary: "Endpoint.", tags: [], complexity: "simple" },
      { id: "pipeline:recognition-events", type: "pipeline", name: "Recognition Events", summary: "Pipeline.", tags: [], complexity: "moderate" },
      { id: "table:recognition_events", type: "table", name: "recognition_events", summary: "Table.", tags: [], complexity: "moderate" },
      { id: "schema:recognition_event", type: "schema", name: "recognition_event", summary: "Schema.", tags: [], complexity: "simple" },
      { id: "resource:kafka:recognition-events", type: "resource", name: "recognition-events", summary: "Resource.", tags: [], complexity: "simple" },
      { id: "document:runbook", type: "document", name: "Runbook", summary: "Document.", tags: [], complexity: "simple" },
      { id: "function:productline/service.go:Recognise", type: "function", name: "Recognise", filePath: "productline/service.go", lineRange: [10, 20], summary: "Function.", tags: [], complexity: "complex" },
      { id: "class:productline/service.go:Recognizer", type: "class", name: "Recognizer", filePath: "productline/service.go", lineRange: [22, 50], summary: "Class.", tags: [], complexity: "complex" },
      { id: "file:shared/rate_limit.go", type: "file", name: "rate_limit.go", filePath: "shared/rate_limit.go", summary: "File.", tags: [], complexity: "simple" },
    ],
    edges: [
      { source: "domain:commerce", target: "flow:recognition", type: "contains_flow", direction: "forward", weight: 1 },
      { source: "flow:recognition", target: "step:recognition:validate", type: "flow_step", direction: "forward", weight: 1 },
      { source: "domain:commerce", target: "service:recognition-api", type: "serves", direction: "forward", weight: 0.8 },
      { source: "service:recognition-api", target: "endpoint:GET /recognise", type: "routes", direction: "bidirectional", weight: 0.7 },
      { source: "module:productline", target: "file:productline/service.go", type: "contains", direction: "forward", weight: 1 },
      { source: "file:productline/service.go", target: "function:productline/service.go:Recognise", type: "contains", direction: "forward", weight: 1 },
      { source: "file:productline/service.go", target: "class:productline/service.go:Recognizer", type: "contains", direction: "forward", weight: 1 },
      { source: "config:productline/config.yaml", target: "service:recognition-api", type: "configures", direction: "forward", weight: 0.6 },
      { source: "pipeline:recognition-events", target: "table:recognition_events", type: "writes_to", direction: "forward", weight: 0.9 },
      { source: "schema:recognition_event", target: "table:recognition_events", type: "defines_schema", direction: "forward", weight: 0.9 },
      { source: "pipeline:recognition-events", target: "resource:kafka:recognition-events", type: "publishes", direction: "forward", weight: 0.7 },
      { source: "document:runbook", target: "function:productline/service.go:Recognise", type: "documents", direction: "forward", weight: 0.4 },
      { source: "function:productline/service.go:Recognise", target: "file:shared/rate_limit.go", type: "calls", direction: "forward", weight: 0.7 },
      { source: "function:productline/service.go:Recognise", target: "file:shared/rate_limit.go", type: "depends_on", direction: "forward", weight: 0.5 },
      { source: "function:productline/service.go:Recognise", target: "file:shared/rate_limit.go", type: "reads_from", direction: "backward", weight: 0.3 },
    ],
    layers: [
      { id: "productline", name: "Product Line", description: "Layer.", nodeIds: ["module:productline", "file:productline/service.go"] },
      { id: "shared", name: "Shared", description: "Layer.", nodeIds: ["file:shared/rate_limit.go"] },
    ],
    tour: [],
  };
}

const wikiIndex = buildWikiIndex({
  version: 1,
  generatedAt: "2026-07-09T00:00:00.000Z",
  projectName: "sample",
  pages: [
    {
      id: "wiki:architecture",
      title: "Architecture",
      category: "capability",
      summary: "Architecture docs.",
      markdownPath: "knowledge-base/architecture.md",
      explainedNodeIds: ["domain:commerce", "service:recognition-api"],
      relatedNodeIds: [],
      evidenceIds: ["evidence:architecture"],
      coverage: "complete",
      quality: "verified",
    },
    {
      id: "wiki:recognise",
      title: "Recognition",
      category: "flow",
      summary: "Recognition docs.",
      markdownPath: "knowledge-base/flow.md",
      explainedNodeIds: ["function:productline/service.go:Recognise"],
      relatedNodeIds: ["file:productline/service.go"],
      evidenceIds: ["evidence:recognise", "evidence:file-context"],
      coverage: "partial",
      quality: "generated",
    },
  ],
  evidence: [
    {
      id: "evidence:architecture",
      label: "Architecture evidence",
      filePath: "docs/architecture.md",
      nodeIds: ["domain:commerce", "service:recognition-api"],
    },
    {
      id: "evidence:recognise",
      label: "Recognise function",
      filePath: "productline/service.go",
      lineRange: [10, 20],
      nodeIds: ["function:productline/service.go:Recognise"],
    },
    {
      id: "evidence:file-context",
      label: "Service file context",
      filePath: "productline/service.go",
      nodeIds: ["file:productline/service.go"],
    },
  ],
  gaps: [
    {
      id: "gap:rate-limit",
      nodeId: "file:shared/rate_limit.go",
      reason: "Missing docs.",
      severity: "medium",
    },
  ],
});

function nodeIdsFor(mode: GraphExplorerMode, focusNodeIds: string[] = []): string[] {
  return buildSemanticGraph({
    graph: graph(),
    wikiIndex,
    mode,
    focusNodeIds,
  }).nodes.map((node) => node.id);
}

describe("semanticGraph", () => {
  it("groups nodes by readable semantic level", () => {
    expect(semanticGroupForNode(graph().nodes[0])).toBe("capability");
    expect(semanticGroupForNode(graph().nodes[1])).toBe("flow");
    expect(semanticGroupForNode(graph().nodes[5])).toBe("file");
    expect(semanticGroupForNode(graph().nodes[7])).toBe("infra");
    expect(semanticGroupForNode(graph().nodes[10])).toBe("data");
    expect(semanticGroupForNode(graph().nodes[13])).toBe("document");
    expect(semanticGroupForNode(graph().nodes[14])).toBe("symbol");
  });

  it("keeps exact global, semantic, architecture, call, coverage, and evidence node sets", () => {
    expect(nodeIdsFor("global")).toEqual(allNodeIds);
    expect(nodeIdsFor("semantic")).toEqual([
      "domain:commerce",
      "flow:recognition",
      "step:recognition:validate",
      "module:productline",
      "concept:scoring",
      "file:productline/service.go",
      "config:productline/config.yaml",
      "service:recognition-api",
      "endpoint:GET /recognise",
      "pipeline:recognition-events",
      "table:recognition_events",
      "schema:recognition_event",
      "resource:kafka:recognition-events",
      "document:runbook",
      "file:shared/rate_limit.go",
    ]);
    expect(nodeIdsFor("architecture")).toEqual([
      "domain:commerce",
      "flow:recognition",
      "module:productline",
      "file:productline/service.go",
      "config:productline/config.yaml",
      "service:recognition-api",
      "endpoint:GET /recognise",
      "pipeline:recognition-events",
      "table:recognition_events",
      "schema:recognition_event",
      "resource:kafka:recognition-events",
      "file:shared/rate_limit.go",
    ]);
    expect(nodeIdsFor("call")).toEqual([
      "file:productline/service.go",
      "function:productline/service.go:Recognise",
      "class:productline/service.go:Recognizer",
      "file:shared/rate_limit.go",
    ]);
    expect(nodeIdsFor("coverage")).toEqual([
      "domain:commerce",
      "service:recognition-api",
      "function:productline/service.go:Recognise",
      "file:shared/rate_limit.go",
    ]);
    expect(nodeIdsFor("evidence")).toEqual([
      "domain:commerce",
      "file:productline/service.go",
      "service:recognition-api",
      "function:productline/service.go:Recognise",
      "file:shared/rate_limit.go",
    ]);
  });

  it("hides low-level symbols in semantic mode while global keeps them", () => {
    expect(nodeIdsFor("global")).toContain("function:productline/service.go:Recognise");
    expect(nodeIdsFor("global")).toContain("class:productline/service.go:Recognizer");
    expect(nodeIdsFor("semantic")).not.toContain("function:productline/service.go:Recognise");
    expect(nodeIdsFor("semantic")).not.toContain("class:productline/service.go:Recognizer");
  });

  it("keeps core architecture and structural node types in architecture mode", () => {
    const semantic = buildSemanticGraph({
      graph: graph(),
      wikiIndex,
      mode: "architecture",
      focusNodeIds: [],
    });
    const keptTypes = new Set(semantic.nodes.map((node) => node.rawType));

    expect(keptTypes).toEqual(new Set([
      "config",
      "domain",
      "endpoint",
      "file",
      "flow",
      "module",
      "pipeline",
      "resource",
      "schema",
      "service",
      "table",
    ]));
  });

  it("exposes wiki page and evidence ids on semantic nodes", () => {
    const semantic = buildSemanticGraph({
      graph: graph(),
      wikiIndex,
      mode: "evidence",
      focusNodeIds: [],
    });
    const recognise = semantic.nodes.find((node) => node.id === "function:productline/service.go:Recognise");
    const serviceFile = semantic.nodes.find((node) => node.id === "file:productline/service.go");
    const domain = semantic.nodes.find((node) => node.id === "domain:commerce");

    expect(recognise?.wikiPageIds).toEqual(["wiki:recognise"]);
    expect(recognise?.evidenceIds).toEqual(["evidence:recognise", "evidence:file-context"]);
    expect(serviceFile?.wikiPageIds).toEqual(["wiki:recognise"]);
    expect(serviceFile?.evidenceIds).toEqual(["evidence:recognise", "evidence:file-context"]);
    expect(domain?.evidenceIds).toEqual(["evidence:architecture"]);
  });

  it("bundles multiple edge types between the same pair and preserves directions", () => {
    const semantic = buildSemanticGraph({
      graph: graph(),
      wikiIndex,
      mode: "global",
      focusNodeIds: [],
    });
    const bundled = semantic.edges.find(
      (edge) => edge.source === "function:productline/service.go:Recognise" && edge.target === "file:shared/rate_limit.go",
    );

    expect(bundled).toMatchObject({
      id: "function:productline/service.go:Recognise->file:shared/rate_limit.go",
      bundledCount: 3,
      weight: 0.7,
      edgeTypes: ["calls", "depends_on", "reads_from"],
      directions: ["forward", "backward"],
    });
  });

  it("keeps focused nodes even when the current mode would normally filter them out", () => {
    expect(nodeIdsFor("architecture", ["function:productline/service.go:Recognise"])).toEqual([
      "file:productline/service.go",
      "function:productline/service.go:Recognise",
      "file:shared/rate_limit.go",
    ]);
  });
});
