import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-code/core/types";
import {
  aggregateCoverageFixture,
  graphWithDenseSelection,
  graphWithFiftyNodes,
  oneHopIds,
} from "./graphFixtures";
import {
  buildHierarchicalSemanticGraph,
  hasDocumentationProblem,
  normalizeGraphExplorerMode,
  resolveGraphRelationshipSource,
} from "../hierarchicalGraph";

function importOnlyGraph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "sample",
      languages: ["typescript"],
      frameworks: [],
      description: "",
      analyzedAt: "2026-07-10T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes: [
      { id: "file:src/a.ts", type: "file", name: "a.ts", filePath: "src/a.ts", summary: "Entry.", tags: [], complexity: "simple" },
      { id: "function:src/a.ts:start", type: "function", name: "start", filePath: "src/a.ts", lineRange: [1, 8], summary: "Starts.", tags: [], complexity: "simple" },
      { id: "file:lib/b.ts", type: "file", name: "b.ts", filePath: "lib/b.ts", summary: "Library.", tags: [], complexity: "simple" },
      { id: "function:lib/b.ts:load", type: "function", name: "load", filePath: "lib/b.ts", lineRange: [1, 10], summary: "Loads.", tags: [], complexity: "simple" },
    ],
    edges: [
      { source: "file:src/a.ts", target: "function:src/a.ts:start", type: "contains", direction: "forward", weight: 1 },
      { source: "file:lib/b.ts", target: "function:lib/b.ts:load", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/a.ts", target: "file:lib/b.ts", type: "imports", direction: "forward", weight: 0.8 },
    ],
    layers: [
      { id: "app", name: "应用层", description: "入口代码", nodeIds: ["file:src/a.ts"] },
      { id: "lib", name: "基础库", description: "公共能力", nodeIds: ["file:lib/b.ts"] },
    ],
    tour: [],
  };
}

function manyScopesGraph(scopeCount = 17): KnowledgeGraph {
  const nodes = Array.from({ length: scopeCount }, (_, index) => ({
    id: `file:scope-${String(index).padStart(2, "0")}.ts`,
    type: "file" as const,
    name: `scope-${String(index).padStart(2, "0")}.ts`,
    filePath: `scope-${String(index).padStart(2, "0")}.ts`,
    summary: "Scope file.",
    tags: [],
    complexity: "simple" as const,
  }));
  return {
    version: "1.0.0",
    project: {
      name: "many-scopes",
      languages: ["typescript"],
      frameworks: [],
      description: "",
      analyzedAt: "2026-07-10T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes,
    edges: [],
    layers: nodes.map((node, index) => ({
      id: `scope-${String(index).padStart(2, "0")}`,
      name: `Scope ${String(index).padStart(2, "0")}`,
      description: "Scope.",
      nodeIds: [node.id],
    })),
    tour: [],
  };
}

function manyBoundariesGraph(boundaryCount = 9): KnowledgeGraph {
  const center = {
    id: "file:center.ts",
    type: "file" as const,
    name: "center.ts",
    filePath: "center.ts",
    summary: "Center.",
    tags: [],
    complexity: "simple" as const,
  };
  const external = Array.from({ length: boundaryCount }, (_, index) => ({
    id: `file:external-${String(index).padStart(2, "0")}.ts`,
    type: "file" as const,
    name: `external-${String(index).padStart(2, "0")}.ts`,
    filePath: `external-${String(index).padStart(2, "0")}.ts`,
    summary: "External.",
    tags: [],
    complexity: "simple" as const,
  }));
  return {
    version: "1.0.0",
    project: {
      name: "many-boundaries",
      languages: ["typescript"],
      frameworks: [],
      description: "",
      analyzedAt: "2026-07-10T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes: [center, ...external],
    edges: external.map((node) => ({
      source: center.id,
      target: node.id,
      type: "imports" as const,
      direction: "forward" as const,
      weight: 1,
    })),
    layers: [
      { id: "center", name: "Center", description: "Center.", nodeIds: [center.id] },
      ...external.map((node, index) => ({
        id: `external-${String(index).padStart(2, "0")}`,
        name: `External ${String(index).padStart(2, "0")}`,
        description: "External.",
        nodeIds: [node.id],
      })),
    ],
    tour: [],
  };
}

describe("hierarchicalGraph", () => {
  it("normalizes legacy modes into three meaningful graph modes", () => {
    expect(normalizeGraphExplorerMode("global")).toBe("architecture");
    expect(normalizeGraphExplorerMode("semantic")).toBe("architecture");
    expect(normalizeGraphExplorerMode("focus")).toBe("architecture");
    expect(normalizeGraphExplorerMode("evidence")).toBe("coverage");
    expect(normalizeGraphExplorerMode("call")).toBe("call");
  });

  it("starts from aggregated scopes instead of a full node card wall", () => {
    const semantic = buildHierarchicalSemanticGraph({
      graph: importOnlyGraph(),
      mode: "architecture",
      focusNodeIds: [],
      selectedNodeId: null,
      navigation: { level: "overview" },
    });

    expect(semantic.nodes.map((node) => node.id).sort()).toEqual(["scope:layer:app", "scope:layer:lib"]);
    expect(semantic.nodes.every((node) => node.kind === "scope" && node.canDrillDown)).toBe(true);
    expect(semantic.presentation.level).toBe("overview");
    expect(semantic.presentation.scopeOptions).toHaveLength(2);
    expect(semantic.presentation.breadcrumbs.map((item) => item.label)).toEqual(["全局概览"]);
  });

  it("drills into a scope and aggregates external dependencies as boundary portals", () => {
    const semantic = buildHierarchicalSemanticGraph({
      graph: importOnlyGraph(),
      mode: "call",
      focusNodeIds: [],
      selectedNodeId: null,
      navigation: { level: "scope", scopeId: "layer:app" },
    });

    expect(semantic.nodes.map((node) => node.id)).toEqual([
      "file:src/a.ts",
      "boundary:layer:lib",
    ]);
    expect(semantic.edges).toHaveLength(1);
    expect(semantic.edges[0]).toMatchObject({
      source: "file:src/a.ts",
      target: "boundary:layer:lib",
      edgeTypes: ["imports"],
    });
    expect(semantic.presentation.breadcrumbs.map((item) => item.label)).toEqual(["全局概览", "应用层"]);
  });

  it("drills from a file to its local and external relationships", () => {
    const semantic = buildHierarchicalSemanticGraph({
      graph: importOnlyGraph(),
      mode: "call",
      focusNodeIds: [],
      selectedNodeId: null,
      navigation: { level: "file", scopeId: "layer:app", fileId: "file:src/a.ts" },
    });

    expect(semantic.nodes.map((node) => node.id).sort()).toEqual([
      "file:src/a.ts",
      "file:lib/b.ts",
      "function:src/a.ts:start",
    ].sort());
    expect(semantic.edges.map((edge) => edge.edgeTypes)).toEqual([["contains"], ["imports"]]);
    expect(semantic.presentation.level).toBe("file");
    expect(semantic.presentation.breadcrumbs.map((item) => item.label)).toEqual([
      "全局概览",
      "应用层",
      "a.ts",
    ]);
  });

  it("falls back from missing call edges to imports with an explicit explanation", () => {
    const graph = importOnlyGraph();
    expect(resolveGraphRelationshipSource(graph)).toBe("imports");
    const semantic = buildHierarchicalSemanticGraph({
      graph,
      mode: "call",
      focusNodeIds: [],
      selectedNodeId: null,
      navigation: { level: "overview" },
    });

    expect(semantic.presentation.relationshipSource).toBe("imports");
    expect(semantic.presentation.notice).toContain("自动降级为文件导入关系");
    expect(semantic.edges[0]?.edgeTypes).toEqual(["imports"]);
  });

  it("keeps wiki focus as a temporary scope rather than a standalone mode", () => {
    const semantic = buildHierarchicalSemanticGraph({
      graph: importOnlyGraph(),
      mode: "focus",
      focusNodeIds: ["function:src/a.ts:start"],
      selectedNodeId: null,
      navigation: { level: "overview" },
    });

    expect(semantic.presentation.displayMode).toBe("architecture");
    expect(semantic.presentation.focusApplied).toBe(true);
    expect(semantic.presentation.scopeOptions.map((scope) => scope.id)).toContain("layer:app");
  });

  it("aggregates independent coverage counts without a one-child gap veto", () => {
    const coverage = aggregateCoverageFixture();
    const overview = buildHierarchicalSemanticGraph({
      graph: coverage.graph,
      wikiIndex: coverage.wikiIndex,
      mode: "architecture",
      focusNodeIds: [],
      selectedNodeId: null,
      navigation: { level: "overview" },
    });
    const aggregate = overview.nodes[0];

    expect(aggregate.documentationCounts).toEqual({ direct: 8, context: 1, none: 1, problem: 0, total: 10 });
    expect(aggregate.docs.relation).toBe("direct");
    expect(aggregate.docs.quality).toBe("needs-review");
    expect(aggregate.docs.directPageIds).toHaveLength(9);
    expect(aggregate.docs.contextPageIds).toEqual([]);
    expect(aggregate.docs.evidenceIds).toHaveLength(8);
    expect(overview.presentation.scopeOptions[0].documentationCounts).toEqual(aggregate.documentationCounts);
  });

  it("counts key architecture objects but every node in coverage mode", () => {
    const graph = graphWithFiftyNodes();
    const architecture = buildHierarchicalSemanticGraph({
      graph,
      mode: "architecture",
      focusNodeIds: [],
      selectedNodeId: null,
      navigation: { level: "overview" },
    });
    const coverage = buildHierarchicalSemanticGraph({
      graph,
      mode: "coverage",
      focusNodeIds: [],
      selectedNodeId: null,
      navigation: { level: "overview" },
    });

    expect(architecture.nodes[0].documentationCounts?.total).toBe(1);
    expect(coverage.nodes[0].documentationCounts).toEqual({ direct: 0, context: 0, none: 50, problem: 0, total: 50 });
  });

  it("treats missing evidence as a problem only for a published documentation claim", () => {
    const coverage = aggregateCoverageFixture();
    const semantic = buildHierarchicalSemanticGraph({
      graph: coverage.graph,
      wikiIndex: coverage.wikiIndex,
      mode: "coverage",
      focusNodeIds: [],
      selectedNodeId: null,
      navigation: { level: "scope", scopeId: "layer:core" },
    });
    const direct = semantic.nodes.find((node) => node.docs.relation === "direct");
    const context = semantic.nodes.find((node) => node.docs.relation === "context");
    const none = semantic.nodes.find((node) => node.docs.relation === "none");

    expect(direct && hasDocumentationProblem(direct.docs)).toBe(false);
    expect(context && hasDocumentationProblem(context.docs)).toBe(false);
    expect(none && hasDocumentationProblem(none.docs)).toBe(false);
    expect(none).toBeDefined();
  });

  it("pins a selected scope node and every visible one-hop neighbor beyond the scope cap", () => {
    const selected = "function:src/large.ts:selected";
    const graph = graphWithFiftyNodes(selected);
    const detail = buildHierarchicalSemanticGraph({
      graph,
      mode: "call",
      focusNodeIds: [],
      selectedNodeId: selected,
      navigation: { level: "scope", scopeId: "layer:core" },
    });
    const ids = new Set(detail.nodes.map((node) => node.id));

    expect(ids.has(selected)).toBe(true);
    for (const neighbor of oneHopIds(graph, selected)) expect(ids.has(neighbor)).toBe(true);
    for (const edge of detail.edges.filter((edge) => edge.source === selected || edge.target === selected)) {
      expect(ids.has(edge.source) && ids.has(edge.target)).toBe(true);
    }
    expect(detail.presentation.hiddenNodeCount).toBe(graph.nodes.length - detail.nodes.length);
  });

  it("pins selected context beyond the file cap", () => {
    const selected = "function:src/large.ts:selected";
    const graph = graphWithFiftyNodes(selected);
    const detail = buildHierarchicalSemanticGraph({
      graph,
      mode: "call",
      focusNodeIds: [],
      selectedNodeId: selected,
      navigation: { level: "file", scopeId: "layer:core", fileId: "file:src/large.ts" },
    });
    const ids = new Set(detail.nodes.map((node) => node.id));

    expect(ids.has(selected)).toBe(true);
    for (const neighbor of oneHopIds(graph, selected)) expect(ids.has(neighbor)).toBe(true);
    expect(detail.presentation.hiddenNodeCount).toBe(graph.nodes.length - detail.nodes.length);
  });

  it("lets selected incident nodes and bundles exceed ordinary caps", () => {
    const graph = graphWithDenseSelection(110);
    const selectedNodeId = "function:dense:selected";
    const dense = buildHierarchicalSemanticGraph({
      graph,
      mode: "call",
      focusNodeIds: [],
      selectedNodeId,
      navigation: { level: "scope", scopeId: "path:src" },
    });

    expect(dense.nodes).toHaveLength(111);
    expect(dense.edges).toHaveLength(110);
    expect(dense.edges.every((edge) => edge.source === selectedNodeId || edge.target === selectedNodeId)).toBe(true);
    expect(dense.presentation.hiddenNodeCount).toBe(0);
  });

  it("retains selected aggregate scopes and boundaries beyond their caps", () => {
    const overview = buildHierarchicalSemanticGraph({
      graph: manyScopesGraph(),
      mode: "architecture",
      focusNodeIds: [],
      selectedNodeId: "scope:layer:scope-16",
      navigation: { level: "overview" },
    });
    const detail = buildHierarchicalSemanticGraph({
      graph: manyBoundariesGraph(),
      mode: "call",
      focusNodeIds: [],
      selectedNodeId: "boundary:layer:external-08",
      navigation: { level: "scope", scopeId: "layer:center" },
    });

    expect(overview.nodes).toHaveLength(17);
    expect(overview.nodes.map((node) => node.id)).toContain("scope:layer:scope-16");
    expect(overview.presentation.hiddenNodeCount).toBe(0);
    expect(detail.nodes.map((node) => node.id)).toContain("boundary:layer:external-08");
    expect(detail.edges).toHaveLength(9);
  });

  it("retains every cross-scope one-hop boundary for a selected raw node", () => {
    const selectedNodeId = "file:center.ts";
    const detail = buildHierarchicalSemanticGraph({
      graph: manyBoundariesGraph(),
      mode: "call",
      focusNodeIds: [],
      selectedNodeId,
      navigation: { level: "scope", scopeId: "layer:center" },
    });

    expect(detail.nodes.filter((node) => node.kind === "boundary")).toHaveLength(9);
    expect(detail.edges.filter((edge) => edge.source === selectedNodeId || edge.target === selectedNodeId)).toHaveLength(9);
    expect(detail.presentation.hiddenNodeCount).toBe(0);
  });
});
