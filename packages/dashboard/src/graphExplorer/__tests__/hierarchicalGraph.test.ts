import { describe, expect, it } from "vitest";
import type { GraphEdge, GraphNode, KnowledgeGraph, NodeType } from "@understand-code/core/types";
import {
  aggregateCoverageFixture,
  graphWithDenseSelection,
  graphWithFiftyNodes,
  oneHopIds,
  workspaceHierarchyFixture,
} from "./graphFixtures";
import {
  boundaryNodeId,
  buildGraphHierarchyIndex,
  buildHierarchicalSemanticGraph,
  clusterNodeId,
  graphNodePlacementClass,
  hasDocumentationProblem,
  normalizeGraphFilePath,
  normalizeGraphExplorerMode,
  resolveGraphRelationshipSource,
  scopeNodeId,
  type GraphNodePlacementClass,
} from "../hierarchicalGraph";

function hierarchyNode(
  id: string,
  type: NodeType,
  filePath?: string,
  name = filePath?.split(/[\\/]/).at(-1) ?? id,
): GraphNode {
  return {
    id,
    type,
    name,
    ...(filePath === undefined ? {} : { filePath }),
    summary: `${name} summary.`,
    tags: [],
    complexity: "simple",
  };
}

function hierarchyGraph(
  nodes: GraphNode[],
  edges: GraphEdge[] = [],
  layerNodeIds: string[] = nodes.filter((node) => node.type === "file").map((node) => node.id),
): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "hierarchy-test",
      languages: ["typescript"],
      frameworks: [],
      description: "Hierarchy test graph.",
      analyzedAt: "2026-07-16T00:00:00.000Z",
      gitCommitHash: "fixture",
    },
    nodes,
    edges,
    layers: layerNodeIds.length > 0 ? [{
      id: "workspace",
      name: "工作区",
      description: "Workspace scope.",
      nodeIds: layerNodeIds,
    }] : [],
    tour: [],
  };
}

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
  it("normalizes separators and dot segments without escaping the graph root", () => {
    expect(normalizeGraphFilePath("./packages\\api//src/./index.ts")).toBe("packages/api/src/index.ts");
    expect(normalizeGraphFilePath("../../outside.ts")).toBe("outside.ts");
    expect(normalizeGraphFilePath("/")).toBe("");
  });

  it("protects package roots and gives every object a deterministic location", () => {
    const graph = workspaceHierarchyFixture();
    const index = buildGraphHierarchyIndex(graph);
    const scope = index.scopes.find((item) => item.label === "工作区");
    expect(scope?.protectedRoots.map((root) => [root.kind, root.normalizedPath])).toEqual([
      ["workspace", ""],
      ["package", "packages/api"],
      ["package", "packages/shared"],
    ]);
    expect(scope?.clusterIds.map((id) => {
      const cluster = index.clusterById.get(id)!;
      return [cluster.kind, cluster.normalizedRelativePath];
    })).toEqual([
      ["directory", null],
      ["package", "packages/api"],
      ["package", "packages/shared"],
      ["directory", "scripts"],
      ["unlocated", null],
    ]);
    expect(index.fileLocationById.get("file:packages/api/src/index.ts")?.clusterId)
      .toBe(index.fileLocationById.get("file:packages/api/src/routes/user.ts")?.clusterId);
    expect(index.symbolLocationById.get("function:packages/api/src/routes/user.ts:loadUser"))
      .toEqual(index.fileLocationById.get("file:packages/api/src/routes/user.ts"));
    expect(index.symbolLocationById.get("function:contained-without-path"))
      .toEqual(index.fileLocationById.get("file:packages/api/src/routes/user.ts"));
    expect(index.nodeLocationById.get("config:pathful-without-file")).toMatchObject({
      scopeId: scope?.id,
      clusterId: index.fileLocationById.get("file:packages/api/src/index.ts")?.clusterId,
    });
    expect(index.nodeLocationById.get("config:pathful-without-file")?.fileId).toBeUndefined();
    expect(index.nodeLocationById.get("service:gateway")).toEqual({ scopeId: scope?.id });
    expect(index.nodeLocationById.get("function:detached")).toMatchObject({
      scopeId: scope?.id,
      clusterId: expect.stringContaining("__unlocated__"),
    });
    expect(index.nodeLocationById.size).toBe(graph.nodes.length);
  });

  it("classifies all 21 node types without an implicit default", () => {
    const expected = {
      file: "file",
      function: "file-leaf",
      class: "file-leaf",
      config: "file-leaf",
      module: "architecture-context",
      concept: "architecture-context",
      document: "architecture-context",
      service: "architecture-context",
      table: "architecture-context",
      endpoint: "architecture-context",
      pipeline: "architecture-context",
      schema: "architecture-context",
      resource: "architecture-context",
      domain: "architecture-context",
      flow: "architecture-context",
      step: "architecture-context",
      article: "architecture-context",
      entity: "architecture-context",
      topic: "architecture-context",
      claim: "architecture-context",
      source: "architecture-context",
    } satisfies Record<NodeType, GraphNodePlacementClass>;
    for (const [type, placement] of Object.entries(expected)) {
      expect(graphNodePlacementClass(type as NodeType)).toBe(placement);
    }
  });

  it("deduplicates root evidence and applies package-manifest priority", () => {
    const graph = hierarchyGraph([
      hierarchyNode("file:package.json", "file", "package.json"),
      hierarchyNode("file:workspace", "file", "pnpm-workspace.yaml"),
      hierarchyNode("file:api-go", "file", "packages/api/go.mod"),
      hierarchyNode("file:api-package", "file", "packages/api/package.json"),
      hierarchyNode("file:api-source", "file", "packages/api/src/index.ts"),
    ]);

    const roots = buildGraphHierarchyIndex(graph).scopes[0].protectedRoots;
    expect(roots).toEqual([
      { kind: "workspace", normalizedPath: "", manifestNodeId: "file:workspace" },
      { kind: "package", normalizedPath: "packages/api", manifestNodeId: "file:api-package" },
    ]);
  });

  it("uses exact rendered ids and rejects a pathless package cluster", () => {
    expect(scopeNodeId("layer:API / routes")).toBe("scope:layer%3AAPI%20%2F%20routes");
    expect(clusterNodeId("layer:api", null, "directory")).toBe("cluster:layer%3Aapi:__root__");
    expect(clusterNodeId("layer:api", null, "unlocated")).toBe("cluster:layer%3Aapi:__unlocated__");
    expect(clusterNodeId("layer:api", "packages/api src", "package"))
      .toBe("cluster:layer%3Aapi:packages%2Fapi%20src");
    expect(boundaryNodeId("layer:api", "path:shared lib"))
      .toBe("boundary:layer%3Aapi:path%3Ashared%20lib");
    expect(() => clusterNodeId("layer:api", null, "package")).toThrow(/package/i);
  });

  it("is stable when graph and layer membership input order is reversed", () => {
    const graph = workspaceHierarchyFixture();
    const reversed: KnowledgeGraph = {
      ...graph,
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
      layers: [...graph.layers].reverse().map((layer) => ({
        ...layer,
        nodeIds: [...layer.nodeIds].reverse(),
      })),
    };
    const snapshot = (input: KnowledgeGraph) => {
      const index = buildGraphHierarchyIndex(input);
      return {
        scopes: index.scopes,
        clusters: [...index.clusterById.values()],
        locations: [...index.nodeLocationById.entries()],
        paths: [...index.fileIdByNormalizedPath.entries()],
      };
    };

    expect(snapshot(reversed)).toEqual(snapshot(graph));
  });

  it("keeps same-name files in different path clusters", () => {
    const graph = hierarchyGraph([
      hierarchyNode("file:a/index.ts", "file", "a/index.ts", "index.ts"),
      hierarchyNode("file:b/index.ts", "file", "b/index.ts", "index.ts"),
    ]);
    const index = buildGraphHierarchyIndex(graph);

    expect(index.fileLocationById.get("file:a/index.ts")?.clusterId)
      .not.toBe(index.fileLocationById.get("file:b/index.ts")?.clusterId);
    expect(index.scopes[0].clusterIds.map((id) => index.clusterById.get(id)?.normalizedRelativePath))
      .toEqual(["a", "b"]);
  });

  it("normalizes Windows paths before resolving explicit ownership", () => {
    const graph = hierarchyGraph([
      hierarchyNode("file:windows", "file", "src\\routes\\user.ts"),
      hierarchyNode("function:windows", "function", ".\\src\\routes\\user.ts"),
    ]);
    const index = buildGraphHierarchyIndex(graph);

    expect(index.fileIdByNormalizedPath.get("src/routes/user.ts")).toBe("file:windows");
    expect(index.symbolLocationById.get("function:windows"))
      .toEqual(index.fileLocationById.get("file:windows"));
  });

  it("places root files in the root directory cluster", () => {
    const graph = hierarchyGraph([
      hierarchyNode("file:readme", "file", "README.md"),
      hierarchyNode("file:source", "file", "src/index.ts"),
    ]);
    const index = buildGraphHierarchyIndex(graph);
    const root = index.clusterById.get(clusterNodeId("layer:workspace", null, "directory"));

    expect(index.scopes[0].normalizedRoot).toBe("");
    expect(root?.fileIds).toEqual(["file:readme"]);
  });

  it("uses a single file directory as the scope root", () => {
    const graph = hierarchyGraph([hierarchyNode("file:only", "file", "src/only.ts")]);
    const index = buildGraphHierarchyIndex(graph);
    const scope = index.scopes[0];

    expect(scope.normalizedRoot).toBe("src");
    expect(scope.clusterIds).toEqual([clusterNodeId(scope.id, null, "directory")]);
    expect(index.clusterById.get(scope.clusterIds[0])?.fileIds).toEqual(["file:only"]);
  });

  it("assigns every clustered object to exactly one cluster", () => {
    const graph = workspaceHierarchyFixture();
    const index = buildGraphHierarchyIndex(graph);
    const clusteredIds = [...index.nodeLocationById.entries()]
      .filter(([, location]) => location.clusterId)
      .map(([nodeId]) => nodeId)
      .sort();
    const memberIds = [...index.clusterById.values()].flatMap((cluster) => cluster.nodeIds).sort();

    expect(new Set(memberIds).size).toBe(memberIds.length);
    expect(memberIds).toEqual(clusteredIds);
    for (const [fileId, location] of index.fileLocationById) {
      expect(index.clusterById.get(location.clusterId)?.fileIds).toContain(fileId);
    }
  });

  it("prefers an explicit matching file path over conflicting containment", () => {
    const graph = hierarchyGraph([
      hierarchyNode("file:a", "file", "src/a.ts"),
      hierarchyNode("file:b", "file", "src/b.ts"),
      hierarchyNode("function:target", "function", "src/a.ts"),
    ], [{
      source: "file:b",
      target: "function:target",
      type: "contains",
      direction: "forward",
      weight: 1,
    }]);
    const index = buildGraphHierarchyIndex(graph);

    expect(index.symbolLocationById.get("function:target"))
      .toEqual(index.fileLocationById.get("file:a"));
  });

  it("resolves pathless file leaves through file containment", () => {
    const graph = hierarchyGraph([
      hierarchyNode("file:owner", "file", "src/owner.ts"),
      hierarchyNode("class:target", "class"),
    ], [{
      source: "file:owner",
      target: "class:target",
      type: "contains",
      direction: "forward",
      weight: 1,
    }]);
    const index = buildGraphHierarchyIndex(graph);

    expect(index.symbolLocationById.get("class:target"))
      .toEqual(index.fileLocationById.get("file:owner"));
  });

  it("uses the lexical first file id for malformed multiple containment", () => {
    const graph = hierarchyGraph([
      hierarchyNode("file:z-owner", "file", "src/a.ts"),
      hierarchyNode("file:a-owner", "file", "src/z.ts"),
      hierarchyNode("function:target", "function"),
    ], [
      { source: "file:z-owner", target: "function:target", type: "contains", direction: "forward", weight: 1 },
      { source: "file:a-owner", target: "function:target", type: "contains", direction: "forward", weight: 1 },
    ]);
    const index = buildGraphHierarchyIndex(graph);

    expect(index.symbolLocationById.get("function:target"))
      .toEqual(index.fileLocationById.get("file:a-owner"));
  });

  it("assigns a pathless architecture object to its first containing layer", () => {
    const first = hierarchyNode("file:z-first", "file", "first/index.ts");
    const second = hierarchyNode("file:a-second", "file", "second/index.ts");
    const service = hierarchyNode("service:shared", "service");
    const graph: KnowledgeGraph = {
      ...hierarchyGraph([first, second, service], [
        { source: second.id, target: service.id, type: "contains", direction: "forward", weight: 1 },
        { source: first.id, target: service.id, type: "contains", direction: "forward", weight: 1 },
      ]),
      layers: [
        { id: "first", name: "第一层", description: "First.", nodeIds: [first.id] },
        { id: "second", name: "第二层", description: "Second.", nodeIds: [second.id] },
      ],
    };

    expect(buildGraphHierarchyIndex(graph).nodeLocationById.get(service.id))
      .toEqual({ scopeId: "layer:first" });
  });

  it("indexes one fixture node of every NodeType", () => {
    const types = [
      "file", "function", "class", "module", "concept", "config", "document", "service", "table",
      "endpoint", "pipeline", "schema", "resource", "domain", "flow", "step", "article", "entity",
      "topic", "claim", "source",
    ] as const satisfies readonly NodeType[];
    const file = hierarchyNode("node:file", "file", "src/all-types.ts");
    const others = types.slice(1).map((type) => hierarchyNode(
      `node:${type}`,
      type,
      type === "function" || type === "class" || type === "config" ? "src/all-types.ts" : undefined,
    ));
    const graph = hierarchyGraph([file, ...others], others.map((node): GraphEdge => ({
      source: file.id,
      target: node.id,
      type: "contains",
      direction: "forward",
      weight: 1,
    })));
    const index = buildGraphHierarchyIndex(graph);

    expect(new Set(graph.nodes.map((node) => node.type))).toEqual(new Set(types));
    expect(index.nodeLocationById.size).toBe(types.length);
    expect(index.symbolLocationById.size).toBe(2);
    for (const type of types.filter((item) => graphNodePlacementClass(item) === "architecture-context")) {
      expect(index.nodeLocationById.get(`node:${type}`)).toEqual({ scopeId: "layer:workspace" });
    }
  });

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
