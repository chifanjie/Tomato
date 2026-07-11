import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { buildWikiRuntimeIndex } from "../../wiki/wikiIndex";
import { wikiV2Fixture } from "../../wiki/__tests__/fixtures/wikiV2Fixtures";
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
      { source: "function:productline/service.go:Recognise", target: "file:shared/rate_limit.go", type: "calls", direction: "forward", description: "Uses rate limit guard.", weight: 0.7 },
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

const wikiPayload = wikiV2Fixture();
const overviewPage = wikiPayload.pages.find((page) => page.id === "page:overview");
const runPage = wikiPayload.pages.find((page) => page.id === "page:run");
if (!overviewPage || !runPage) throw new Error("missing fixture pages");
wikiPayload.pages = [{
  ...overviewPage,
  id: "wiki:architecture",
  title: "Architecture",
  category: "capability",
  summary: "Architecture docs.",
  markdownPath: "knowledge-base/architecture.md",
  quality: "generated",
  generationStatus: "complete",
  directNodeIds: ["domain:commerce", "service:recognition-api"],
  contextNodeIds: [],
  evidenceIds: ["evidence:architecture"],
  route: undefined,
}, {
  ...runPage,
  id: "wiki:recognise",
  title: "Recognition",
  summary: "Recognition docs.",
  markdownPath: "knowledge-base/flow.md",
  generationStatus: "partial",
  directNodeIds: ["function:productline/service.go:Recognise"],
  contextNodeIds: ["file:productline/service.go"],
  evidenceIds: ["evidence:recognise", "evidence:file-context"],
  route: undefined,
}];
wikiPayload.mainReadiness = { status: "blocked", reasons: ["存在生成失败节点"], routePageIds: [] };
wikiPayload.nodeDocumentation = [
  ...["domain:commerce", "service:recognition-api"].map((nodeId) => ({
    nodeId,
    relation: "direct" as const,
    quality: "generated" as const,
    evidenceHealth: "source-linked" as const,
    generationStatus: "complete" as const,
    referenceCoverage: "anchored" as const,
    directPageIds: ["wiki:architecture"],
    contextPageIds: [],
    evidenceIds: ["evidence:architecture"],
    primaryPageId: "wiki:architecture",
  })),
  {
    nodeId: "function:productline/service.go:Recognise",
    relation: "direct",
    quality: "generated",
    evidenceHealth: "source-linked",
    generationStatus: "partial",
    referenceCoverage: "anchored",
    directPageIds: ["wiki:recognise"],
    contextPageIds: [],
    evidenceIds: ["evidence:recognise"],
    primaryPageId: "wiki:recognise",
  },
  {
    nodeId: "file:shared/rate_limit.go",
    relation: "none",
    quality: "failed",
    evidenceHealth: "missing",
    generationStatus: "failed",
    referenceCoverage: "unanchored",
    directPageIds: [],
    contextPageIds: [],
    evidenceIds: [],
  },
];
wikiPayload.evidence = [{
  id: "evidence:architecture",
  filePath: "docs/architecture.md",
  lineRange: [1, 4],
  nodeIds: ["domain:commerce", "service:recognition-api"],
  excerpt: "Architecture",
  evidenceType: "documentation",
}, {
  id: "evidence:recognise",
  filePath: "productline/service.go",
  lineRange: [10, 20],
  nodeIds: ["function:productline/service.go:Recognise"],
  excerpt: "func Recognise() {}",
  evidenceType: "production",
}, {
  id: "evidence:file-context",
  filePath: "productline/service.go",
  lineRange: [1, 9],
  nodeIds: ["file:productline/service.go"],
  excerpt: "package productline",
  evidenceType: "production",
}];
const wikiIndex = buildWikiRuntimeIndex(wikiPayload);

function nodeIdsFor(mode: GraphExplorerMode, focusNodeIds: string[] = []): string[] {
  return buildSemanticGraph({
    graph: graph(),
    wikiIndex,
    mode,
    focusNodeIds,
  }).nodes.map((node) => node.id);
}

describe("semanticGraph", () => {
  it("exports a semantic graph model builder that works without wiki metadata", async () => {
    const module = await import("../semanticGraph");
    const buildSemanticGraphModel = (module as Record<string, unknown>).buildSemanticGraphModel as typeof buildSemanticGraph;
    const semantic = buildSemanticGraphModel({
      graph: graph(),
      mode: "global",
      focusNodeIds: [],
    });
    const domain = semantic.nodes.find((node) => node.id === "domain:commerce");

    expect(buildSemanticGraphModel).toBe(buildSemanticGraph);
    expect(semantic.nodes.map((node) => node.id)).toEqual(allNodeIds);
    expect(domain?.coverage.status).toBe("unknown");
    expect(domain?.wikiPageIds).toEqual([]);
    expect(domain?.evidenceIds).toEqual([]);
    expect(domain?.docs).toMatchObject({
      coverageStatus: "unknown",
      pageIds: [],
      evidenceIds: [],
      directPageIds: [],
      contextPageIds: [],
    });
  });

  it("groups nodes by readable semantic level", () => {
    expect(semanticGroupForNode(graph().nodes[0])).toBe("capability");
    expect(semanticGroupForNode(graph().nodes[1])).toBe("flow");
    expect(semanticGroupForNode(graph().nodes[5])).toBe("file");
    expect(semanticGroupForNode(graph().nodes[7])).toBe("infra");
    expect(semanticGroupForNode(graph().nodes[10])).toBe("data");
    expect(semanticGroupForNode(graph().nodes[13])).toBe("document");
    expect(semanticGroupForNode(graph().nodes[14])).toBe("symbol");
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
    expect(recognise?.evidenceIds).toEqual(["evidence:recognise"]);
    expect(serviceFile?.wikiPageIds).toEqual(["wiki:recognise"]);
    expect(serviceFile?.evidenceIds).toEqual(["evidence:file-context"]);
    expect(recognise?.docs.directPageIds).toEqual(["wiki:recognise"]);
    expect(recognise?.docs.contextPageIds).toEqual([]);
    expect(serviceFile?.docs.directPageIds).toEqual([]);
    expect(serviceFile?.docs.contextPageIds).toEqual(["wiki:recognise"]);
    expect(domain?.evidenceIds).toEqual(["evidence:architecture"]);
  });

  it("exposes rendering-oriented category, cluster, importance, and docs metadata", () => {
    const semantic = buildSemanticGraph({
      graph: graph(),
      wikiIndex,
      mode: "global",
      focusNodeIds: [],
    });
    const domain = semantic.nodes.find((node) => node.id === "domain:commerce");
    const recognise = semantic.nodes.find((node) => node.id === "function:productline/service.go:Recognise");
    const failed = semantic.nodes.find((node) => node.id === "file:shared/rate_limit.go");

    expect(domain).toMatchObject({
      category: "capability",
      cluster: "capability",
      importance: 1,
      docs: {
        coverageStatus: "complete",
        primaryPageId: "wiki:architecture",
        pageIds: ["wiki:architecture"],
        evidenceIds: ["evidence:architecture"],
        directPageIds: ["wiki:architecture"],
        contextPageIds: [],
      },
    });
    expect(domain?.docs.pages[0]).toMatchObject({
      id: "wiki:architecture",
      title: "Architecture",
      markdownPath: "knowledge-base/architecture.md",
    });
    expect(domain?.docs.evidence[0]).toMatchObject({
      id: "evidence:architecture",
      filePath: "docs/architecture.md",
    });
    expect(recognise).toMatchObject({
      category: "symbol",
      cluster: "productline",
      importance: 0.45,
    });
    expect(failed?.docs).toMatchObject({
      coverageStatus: "failed",
      pageIds: [],
      failureReasons: ["存在生成失败节点"],
    });
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
      graph: graph(),
      wikiIndex,
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
