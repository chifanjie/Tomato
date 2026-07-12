import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { buildWikiRuntimeIndex } from "../../wiki/wikiIndex";
import {
  graphFixture,
  wikiRuntimeFixture,
} from "./graphFixtures";
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

function richGraph(): KnowledgeGraph {
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
      { source: "function:productline/service.go:Recognise", target: "file:shared/rate_limit.go", type: "calls", direction: "forward", description: "Uses rate limit guard.", weight: 0.7 },
      { source: "function:productline/service.go:Recognise", target: "file:shared/rate_limit.go", type: "depends_on", direction: "forward", weight: 0.5 },
      { source: "function:productline/service.go:Recognise", target: "file:shared/rate_limit.go", type: "reads_from", direction: "backward", weight: 0.3 },
    ],
    layers: [
      { id: "productline", name: "Product Line", description: "Layer.", nodeIds: ["file:productline/service.go"] },
      { id: "shared", name: "Shared", description: "Layer.", nodeIds: ["file:shared/rate_limit.go"] },
    ],
    tour: [],
  };
}

function nodeIdsFor(mode: GraphExplorerMode, focusNodeIds: string[] = []): string[] {
  return buildSemanticGraph({
    graph: richGraph(),
    wikiIndex: wikiRuntimeFixture(),
    mode,
    focusNodeIds,
  }).nodes.map((node) => node.id);
}

describe("semanticGraph", () => {
  it("exports explicit V2 defaults when a node-documentation record is absent", async () => {
    const module = await import("../semanticGraph");
    const buildSemanticGraphModel = (module as Record<string, unknown>).buildSemanticGraphModel as typeof buildSemanticGraph;
    const semantic = buildSemanticGraphModel({ graph: graphFixture(), mode: "global", focusNodeIds: [] });
    const run = semantic.nodes.find((node) => node.id === "function:src/a.ts:run");

    expect(buildSemanticGraphModel).toBe(buildSemanticGraph);
    expect(run?.docs).toEqual({
      relation: "none",
      quality: "needs-review",
      evidenceHealth: "missing",
      generationStatus: "partial",
      referenceCoverage: "unanchored",
      directPageIds: [],
      contextPageIds: [],
      directPages: [],
      contextPages: [],
      evidenceIds: [],
      evidence: [],
    });
    expect(run).not.toHaveProperty("coverage");
    expect(run).not.toHaveProperty("wikiPageIds");
    expect(run).not.toHaveProperty("evidenceIds");
    expect(run?.docs).not.toHaveProperty("coverageStatus");
    expect(run?.docs).not.toHaveProperty("failureReasons");
  });

  it("derives precise metadata only from the V2 node record", () => {
    const semantic = buildSemanticGraph({
      graph: graphFixture(),
      wikiIndex: wikiRuntimeFixture(),
      mode: "global",
      focusNodeIds: [],
    });
    const run = semantic.nodes.find((node) => node.id === "function:src/a.ts:run");
    const contextOnly = semantic.nodes.find((node) => node.id === "file:context-only.ts");

    expect(run?.docs).toMatchObject({
      relation: "direct",
      quality: "generated",
      evidenceHealth: "source-linked",
      generationStatus: "complete",
      referenceCoverage: "anchored",
      primaryPageId: "page:run",
      anchor: "run",
      directPageIds: ["page:run"],
      contextPageIds: ["page:overview"],
    });
    expect(run?.docs.evidence.map((item) => item.id)).toEqual(["evidence:run"]);
    expect(run?.docs.contextPages.map((page) => page.id)).toEqual(["page:overview"]);
    expect(contextOnly?.docs).toMatchObject({
      relation: "context",
      directPageIds: [],
      contextPageIds: ["page:overview"],
      evidenceIds: [],
    });
    expect(contextOnly?.docs).not.toHaveProperty("primaryPageId");
    expect(run).not.toHaveProperty("coverage");
    expect(run).not.toHaveProperty("wikiPageIds");
  });

  it("preserves record page order and excludes same-node evidence not allowed by the record", () => {
    const base = wikiRuntimeFixture().payload;
    if (!base) throw new Error("missing Task 0 runtime payload");
    const wikiIndex = buildWikiRuntimeIndex({
      ...base,
      nodeDocumentation: base.nodeDocumentation.map((record) => record.nodeId === "file:src/a.ts"
        ? { ...record, directPageIds: ["page:run", "page:overview"] }
        : record),
      evidence: [...base.evidence, {
        id: "evidence:run-unlisted",
        nodeIds: ["function:src/a.ts:run"],
        filePath: "src/a.ts",
        lineRange: [10, 14],
        excerpt: "unlisted exact evidence",
        evidenceType: "production",
      }],
    });
    const semantic = buildSemanticGraph({ graph: graphFixture(), wikiIndex, mode: "global", focusNodeIds: [] });
    const file = semantic.nodes.find((node) => node.id === "file:src/a.ts");
    const run = semantic.nodes.find((node) => node.id === "function:src/a.ts:run");

    expect(file?.docs.directPageIds).toEqual(["page:run", "page:overview"]);
    expect(file?.docs.directPages.map((page) => page.id)).toEqual(["page:run", "page:overview"]);
    expect(run?.docs.evidenceIds).toEqual(["evidence:run"]);
    expect(run?.docs.evidence.map((item) => item.id)).toEqual(["evidence:run"]);
  });

  it("groups nodes by readable semantic level", () => {
    const nodes = richGraph().nodes;
    expect(semanticGroupForNode(nodes[0])).toBe("capability");
    expect(semanticGroupForNode(nodes[1])).toBe("flow");
    expect(semanticGroupForNode(nodes[5])).toBe("file");
    expect(semanticGroupForNode(nodes[7])).toBe("infra");
    expect(semanticGroupForNode(nodes[10])).toBe("data");
    expect(semanticGroupForNode(nodes[13])).toBe("document");
    expect(semanticGroupForNode(nodes[14])).toBe("symbol");
    expect(semanticGroupForNode({ id: "entity:user", type: "entity", name: "User", summary: "", tags: [], complexity: "simple" })).toBe("document");
    expect(semanticGroupForNode({ id: "topic:search", type: "topic", name: "Search", summary: "", tags: [], complexity: "simple" })).toBe("document");
  });

  it("keeps exact global, semantic, architecture, call, coverage, and evidence node sets", () => {
    expect(nodeIdsFor("global")).toEqual(allNodeIds);
    expect(nodeIdsFor("focus")).toEqual(allNodeIds);
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
    expect(nodeIdsFor("coverage")).toEqual(allNodeIds);
    expect(nodeIdsFor("evidence")).toEqual(allNodeIds);
  });

  it("hides low-level symbols in semantic mode while global keeps them", () => {
    expect(nodeIdsFor("global")).toContain("function:productline/service.go:Recognise");
    expect(nodeIdsFor("global")).toContain("class:productline/service.go:Recognizer");
    expect(nodeIdsFor("semantic")).not.toContain("function:productline/service.go:Recognise");
    expect(nodeIdsFor("semantic")).not.toContain("class:productline/service.go:Recognizer");
  });

  it("keeps core architecture and structural node types in architecture mode", () => {
    const semantic = buildSemanticGraph({
      graph: richGraph(),
      wikiIndex: wikiRuntimeFixture(),
      mode: "architecture",
      focusNodeIds: [],
    });
    expect(new Set(semantic.nodes.map((node) => node.rawType))).toEqual(new Set([
      "config", "domain", "endpoint", "file", "flow", "module",
      "pipeline", "resource", "schema", "service", "table",
    ]));
  });

  it("bundles multiple edge types between the same pair and preserves directions", () => {
    const semantic = buildSemanticGraph({
      graph: richGraph(),
      wikiIndex: wikiRuntimeFixture(),
      mode: "global",
      focusNodeIds: [],
    });
    const bundled = semantic.edges.find((edge) =>
      edge.source === "function:productline/service.go:Recognise"
      && edge.target === "file:shared/rate_limit.go");

    expect(bundled).toMatchObject({
      id: "function:productline/service.go:Recognise->file:shared/rate_limit.go",
      bundledCount: 3,
      weight: 0.7,
      edgeTypes: ["calls", "depends_on", "reads_from"],
      directions: ["forward", "backward"],
    });
    expect(bundled?.members).toEqual([
      {
        id: expect.any(String),
        source: "function:productline/service.go:Recognise",
        target: "file:shared/rate_limit.go",
        type: "calls",
        direction: "forward",
        weight: 0.7,
        description: "Uses rate limit guard.",
      },
      {
        id: expect.any(String),
        source: "function:productline/service.go:Recognise",
        target: "file:shared/rate_limit.go",
        type: "depends_on",
        direction: "forward",
        weight: 0.5,
      },
      {
        id: expect.any(String),
        source: "function:productline/service.go:Recognise",
        target: "file:shared/rate_limit.go",
        type: "reads_from",
        direction: "backward",
        weight: 0.3,
      },
    ]);
  });

  it("focus mode keeps focused nodes and directly connected neighbors", () => {
    expect(nodeIdsFor("focus", ["function:productline/service.go:Recognise"])).toEqual([
      "file:productline/service.go",
      "document:runbook",
      "function:productline/service.go:Recognise",
      "file:shared/rate_limit.go",
    ]);
    const semantic = buildSemanticGraph({
      graph: richGraph(),
      wikiIndex: wikiRuntimeFixture(),
      mode: "focus",
      focusNodeIds: ["function:productline/service.go:Recognise"],
    });
    expect(semantic.edges.map((edge) => edge.id)).toEqual([
      "file:productline/service.go->function:productline/service.go:Recognise",
      "document:runbook->function:productline/service.go:Recognise",
      "function:productline/service.go:Recognise->file:shared/rate_limit.go",
    ]);
  });

  it("falls back to the selected mode when every focus id is stale", () => {
    expect(nodeIdsFor("semantic", ["missing:node"])).toEqual(nodeIdsFor("semantic"));
    expect(nodeIdsFor("architecture", ["missing:node"])).toEqual(nodeIdsFor("architecture"));
    expect(nodeIdsFor("focus", ["missing:node"])).toEqual(allNodeIds);
  });

  it("ignores stale focus ids when at least one focus id is valid", () => {
    const validFocusNeighborhood = [
      "file:productline/service.go",
      "document:runbook",
      "function:productline/service.go:Recognise",
      "file:shared/rate_limit.go",
    ];
    expect(nodeIdsFor("focus", ["missing:node", "function:productline/service.go:Recognise"])).toEqual(
      validFocusNeighborhood,
    );
    expect(nodeIdsFor("architecture", ["missing:node", "function:productline/service.go:Recognise"])).toEqual([
      "file:productline/service.go",
      "function:productline/service.go:Recognise",
      "file:shared/rate_limit.go",
    ]);
  });

  it("keeps focused nodes even when the current mode would normally filter them out", () => {
    expect(nodeIdsFor("architecture", ["function:productline/service.go:Recognise"])).toEqual([
      "file:productline/service.go",
      "function:productline/service.go:Recognise",
      "file:shared/rate_limit.go",
    ]);
  });
});
