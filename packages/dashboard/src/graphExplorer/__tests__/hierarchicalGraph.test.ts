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

  it("applies package manifest evidence across layer boundaries", () => {
    const workspace = hierarchyNode("file:workspace-manifest", "file", "pnpm-workspace.yaml");
    const manifest = hierarchyNode("file:api-manifest", "file", "packages/api/package.json");
    const entry = hierarchyNode("file:api-entry", "file", "packages/api/src/index.ts");
    const route = hierarchyNode("file:api-route", "file", "packages/api/src/routes/user.ts");
    const graph: KnowledgeGraph = {
      ...hierarchyGraph([workspace, manifest, entry, route]),
      layers: [
        { id: "manifests", name: "清单", description: "Manifests.", nodeIds: [workspace.id, manifest.id] },
        { id: "api", name: "API", description: "API sources.", nodeIds: [entry.id, route.id] },
      ],
    };
    const index = buildGraphHierarchyIndex(graph);
    const api = index.scopeById.get("layer:api")!;
    const packageCluster = index.clusterById.get(clusterNodeId(api.id, "packages/api", "package"));

    expect(api.protectedRoots).toEqual([
      { kind: "workspace", normalizedPath: "", manifestNodeId: workspace.id },
      { kind: "package", normalizedPath: "packages/api", manifestNodeId: manifest.id },
    ]);
    expect(api.normalizedRoot).toBe("packages");
    expect(packageCluster).toMatchObject({
      kind: "package",
      normalizedRelativePath: "packages/api",
      fileIds: [entry.id, route.id],
    });
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

  it("uses file containment when pathful symbols have no canonical file", () => {
    const graph = hierarchyGraph([
      hierarchyNode("file:owner", "file", "src/owner.ts"),
      hierarchyNode("function:stale", "function", "legacy/run.ts"),
      hierarchyNode("class:stale", "class", "removed/model.ts"),
    ], [
      { source: "file:owner", target: "function:stale", type: "contains", direction: "forward", weight: 1 },
      { source: "file:owner", target: "class:stale", type: "contains", direction: "forward", weight: 1 },
    ]);
    const index = buildGraphHierarchyIndex(graph);
    const owner = index.fileLocationById.get("file:owner");

    expect(index.nodeLocationById.get("function:stale")).toEqual(owner);
    expect(index.nodeLocationById.get("class:stale")).toEqual(owner);
    expect(index.symbolLocationById.get("function:stale")).toEqual(owner);
    expect(index.symbolLocationById.get("class:stale")).toEqual(owner);
  });

  it("uses file containment when a pathful architecture object has no canonical file", () => {
    const graph = hierarchyGraph([
      hierarchyNode("file:owner", "file", "src/owner.ts"),
      hierarchyNode("service:stale", "service", "legacy/gateway.ts"),
    ], [{
      source: "file:owner",
      target: "service:stale",
      type: "contains",
      direction: "forward",
      weight: 1,
    }]);
    const index = buildGraphHierarchyIndex(graph);
    const owner = index.fileLocationById.get("file:owner");

    expect(index.nodeLocationById.get("service:stale")).toEqual(owner);
    expect(index.symbolLocationById.has("service:stale")).toBe(false);
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

  it("preserves explicit layer ownership for a pathful orphan", () => {
    const app = hierarchyNode("file:app", "file", "app/index.ts");
    const shared = hierarchyNode("file:shared", "file", "packages/shared/index.ts");
    const orphan = hierarchyNode("function:orphan", "function", "packages/shared/missing.ts");
    const graph: KnowledgeGraph = {
      ...hierarchyGraph([app, shared, orphan]),
      layers: [
        { id: "app", name: "应用", description: "App.", nodeIds: [app.id, orphan.id] },
        { id: "shared", name: "共享", description: "Shared.", nodeIds: [shared.id] },
      ],
    };
    const index = buildGraphHierarchyIndex(graph);

    expect(index.nodeLocationById.get(orphan.id)?.scopeId).toBe("layer:app");
    expect(index.scopeById.get("layer:app")?.nodeIds).toContain(orphan.id);
    expect(index.scopeById.get("layer:shared")?.nodeIds).not.toContain(orphan.id);
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

  it("builds overview, scope, cluster, and file levels from one hierarchy index", () => {
    const graph = workspaceHierarchyFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const scope = hierarchyIndex.scopes[0]!;
    const cluster = hierarchyIndex.clusterById.get(scope.clusterIds[0]!)!;
    const fileId = cluster.fileIds[0]!;
    const base = { graph, hierarchyIndex, mode: "architecture" as const, materializedNodeId: null };

    const overview = buildHierarchicalSemanticGraph({
      ...base,
      navigation: { level: "overview" },
    });
    const scopeView = buildHierarchicalSemanticGraph({
      ...base,
      navigation: { level: "scope", scopeId: scope.id },
    });
    const clusterView = buildHierarchicalSemanticGraph({
      ...base,
      navigation: { level: "cluster", scopeId: scope.id, clusterId: cluster.id },
    });
    const fileView = buildHierarchicalSemanticGraph({
      ...base,
      navigation: { level: "file", scopeId: scope.id, clusterId: cluster.id, fileId },
    });

    expect(overview.presentation.level).toBe("overview");
    expect(scopeView.nodes.filter((node) => node.kind === "cluster").map((node) => node.clusterId))
      .toEqual(scope.clusterIds);
    expect(clusterView.nodes.filter((node) => node.rawType === "file").map((node) => node.id))
      .toEqual(cluster.fileIds.slice(0, 30));
    expect(fileView.presentation.level).toBe("file");
    expect(scopeView.presentation.breadcrumbs.map((item) => item.level)).toEqual(["overview", "scope"]);
    expect(clusterView.presentation.breadcrumbs.map((item) => item.level)).toEqual(["overview", "scope", "cluster"]);
    expect(fileView.presentation.breadcrumbs.map((item) => item.level)).toEqual(["overview", "scope", "cluster", "file"]);
    expect(overview.nodes.some((node) => node.id === "service:gateway")).toBe(true);
  });

  it("keeps aggregate edge identity distinct by mapped endpoints, type, and direction", () => {
    const left = hierarchyNode("file:left", "file", "left/a.ts");
    const right = hierarchyNode("file:right", "file", "right/b.ts");
    const graph = hierarchyGraph([left, right], [
      { source: left.id, target: right.id, type: "calls", direction: "forward", weight: 0.2 },
      { source: left.id, target: right.id, type: "imports", direction: "forward", weight: 0.4 },
      { source: left.id, target: right.id, type: "imports", direction: "backward", weight: 0.8 },
    ]);
    graph.layers = [
      { id: "left", name: "Left", description: "Left.", nodeIds: [left.id] },
      { id: "right", name: "Right", description: "Right.", nodeIds: [right.id] },
    ];
    const hierarchyIndex = buildGraphHierarchyIndex(graph);

    const view = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "coverage",
      navigation: { level: "overview" },
      materializedNodeId: null,
    });

    expect(view.edges).toHaveLength(3);
    expect(new Set(view.edges.map((edge) => edge.id)).size).toBe(3);
    expect(view.edges.map((edge) => [edge.type, edge.direction]).sort()).toEqual([
      ["calls", "forward"],
      ["imports", "backward"],
      ["imports", "forward"],
    ]);
  });

  it("bundles equal projected relationships without changing any raw member", () => {
    const graph = hierarchyGraph([
      hierarchyNode("file:a", "file", "src/a.ts"),
      hierarchyNode("file:c", "file", "src/c.ts"),
      hierarchyNode("file:b", "file", "lib/b.ts"),
      hierarchyNode("file:d", "file", "lib/d.ts"),
    ], [
      { source: "file:a", target: "file:b", type: "imports", direction: "forward", weight: 0.4 },
      { source: "file:c", target: "file:d", type: "imports", direction: "forward", weight: 0.8 },
    ]);
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const scope = hierarchyIndex.scopes[0]!;

    const view = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation: { level: "scope", scopeId: scope.id },
      materializedNodeId: null,
    });
    const edge = view.edges.find((candidate) => candidate.type === "imports")!;
    const tuples = edge.members.map(({ source, target, type, direction, weight }) => ({
      source,
      target,
      type,
      direction,
      weight,
    })).sort((leftMember, rightMember) => leftMember.source.localeCompare(rightMember.source)
      || leftMember.target.localeCompare(rightMember.target)
      || leftMember.type.localeCompare(rightMember.type)
      || leftMember.direction.localeCompare(rightMember.direction)
      || leftMember.weight - rightMember.weight);

    expect(edge.bundledCount).toBe(2);
    expect(edge.members).toHaveLength(2);
    expect(tuples).toEqual([
      { source: "file:a", target: "file:b", type: "imports", direction: "forward", weight: 0.4 },
      { source: "file:c", target: "file:d", type: "imports", direction: "forward", weight: 0.8 },
    ]);
  });

  it("annotates contextual boundary edges while preserving raw endpoints", () => {
    const graph = importOnlyGraph();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const app = hierarchyIndex.scopeById.get("layer:app")!;
    const cluster = hierarchyIndex.clusterById.get(app.clusterIds[0]!)!;
    const expectedMember = graph.edges.find((edge) => edge.type === "imports")!;

    for (const navigation of [
      { level: "scope" as const, scopeId: app.id },
      { level: "cluster" as const, scopeId: app.id, clusterId: cluster.id },
    ]) {
      const view = buildHierarchicalSemanticGraph({
        graph,
        hierarchyIndex,
        mode: "call",
        navigation,
        materializedNodeId: null,
      });
      const edge = view.edges.find((candidate) => candidate.boundaryContext)!;
      expect(edge.boundaryContext).toEqual({ currentScopeId: "layer:app", targetScopeId: "layer:lib" });
      expect(edge.members.map(({ source, target, type, direction, weight }) => ({
        source,
        target,
        type,
        direction,
        weight,
      }))).toContainEqual({
        source: expectedMember.source,
        target: expectedMember.target,
        type: expectedMember.type,
        direction: expectedMember.direction,
        weight: expectedMember.weight,
      });
    }
  });

  it("applies independent caps and materializes hidden architecture, file, fileless, and symbol objects", () => {
    const files = Array.from({ length: 35 }, (_, index) =>
      hierarchyNode(`file:${index}`, "file", `src/file-${String(index).padStart(2, "0")}.ts`));
    const fileless = Array.from({ length: 15 }, (_, index) =>
      hierarchyNode(`config:${index}`, "config", `src/config-${String(index).padStart(2, "0")}.json`));
    const architecture = Array.from({ length: 27 }, (_, index) =>
      hierarchyNode(`service:${index}`, "service"));
    const symbols = Array.from({ length: 45 }, (_, index) =>
      hierarchyNode(`function:${index}`, "function", files[0]!.filePath));
    const graph = hierarchyGraph(
      [...files, ...fileless, ...architecture, ...symbols],
      symbols.map((symbol) => ({
        source: files[0]!.id,
        target: symbol.id,
        type: "contains" as const,
        direction: "forward" as const,
        weight: 1,
      })),
      [...files, ...architecture].map((node) => node.id),
    );
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const scope = hierarchyIndex.scopes[0]!;
    const cluster = hierarchyIndex.clusterById.get(scope.clusterIds.find((id) =>
      hierarchyIndex.clusterById.get(id)?.fileIds.includes(files[0]!.id))!)!;
    const build = (navigation: Parameters<typeof buildHierarchicalSemanticGraph>[0]["navigation"], materializedNodeId: string | null) =>
      buildHierarchicalSemanticGraph({ graph, hierarchyIndex, mode: "coverage", navigation, materializedNodeId });

    const overview = build({ level: "overview" }, null);
    const overviewMaterialized = build({ level: "overview" }, architecture.at(-1)!.id);
    const clusterView = build({ level: "cluster", scopeId: scope.id, clusterId: cluster.id }, null);
    const clusterMaterializedFile = build(
      { level: "cluster", scopeId: scope.id, clusterId: cluster.id },
      files.at(-1)!.id,
    );
    const clusterMaterializedLeaf = build(
      { level: "cluster", scopeId: scope.id, clusterId: cluster.id },
      fileless.at(-1)!.id,
    );
    const fileView = build(
      { level: "file", scopeId: scope.id, clusterId: cluster.id, fileId: files[0]!.id },
      symbols.at(-1)!.id,
    );

    expect(overview.nodes.filter((node) => node.kind === "node"
      && graphNodePlacementClass(node.rawType) === "architecture-context"))
      .toHaveLength(24);
    expect(overviewMaterialized.nodes.map((node) => node.id)).toContain(architecture.at(-1)!.id);
    expect(clusterView.nodes.filter((node) => node.rawType === "file")).toHaveLength(30);
    expect(clusterView.nodes.filter((node) => node.rawType === "config")).toHaveLength(12);
    expect(clusterMaterializedFile.nodes.map((node) => node.id)).toContain(files.at(-1)!.id);
    expect(clusterMaterializedLeaf.nodes.map((node) => node.id)).toContain(fileless.at(-1)!.id);
    expect(fileView.nodes).toHaveLength(38);
    expect(fileView.nodes.map((node) => node.id)).toContain(symbols.at(-1)!.id);
  });

  it("materializes encoded scope, cluster, and contextual boundary ids without exceeding their caps", () => {
    const scopesGraph = manyScopesGraph();
    const scopesIndex = buildGraphHierarchyIndex(scopesGraph);
    const lastScope = scopesIndex.scopes.at(-1)!;
    const scopesView = buildHierarchicalSemanticGraph({
      graph: scopesGraph,
      hierarchyIndex: scopesIndex,
      mode: "architecture",
      navigation: { level: "overview" },
      materializedNodeId: scopeNodeId(lastScope.id),
    });
    expect(scopesView.nodes.filter((node) => node.kind === "scope")).toHaveLength(16);
    expect(scopesView.nodes.map((node) => node.id)).toContain(scopeNodeId(lastScope.id));

    const clusterFiles = Array.from({ length: 26 }, (_, index) =>
      hierarchyNode(`file:cluster-${index}`, "file", `dir-${String(index).padStart(2, "0")}/index.ts`));
    const clustersGraph = hierarchyGraph(clusterFiles, [], clusterFiles.map((node) => node.id));
    const clustersIndex = buildGraphHierarchyIndex(clustersGraph);
    const clusterScope = clustersIndex.scopes[0]!;
    const lastClusterId = clusterScope.clusterIds.at(-1)!;
    const clustersView = buildHierarchicalSemanticGraph({
      graph: clustersGraph,
      hierarchyIndex: clustersIndex,
      mode: "architecture",
      navigation: { level: "scope", scopeId: clusterScope.id },
      materializedNodeId: lastClusterId,
    });
    expect(clustersView.nodes.filter((node) => node.kind === "cluster")).toHaveLength(24);
    expect(clustersView.nodes.map((node) => node.id)).toContain(lastClusterId);

    const boundariesGraph = manyBoundariesGraph();
    const boundariesIndex = buildGraphHierarchyIndex(boundariesGraph);
    const currentScopeId = "layer:center";
    const targetScopeId = "layer:external-08";
    const contextualBoundaryId = boundaryNodeId(currentScopeId, targetScopeId);
    const boundariesView = buildHierarchicalSemanticGraph({
      graph: boundariesGraph,
      hierarchyIndex: boundariesIndex,
      mode: "call",
      navigation: { level: "scope", scopeId: currentScopeId },
      materializedNodeId: contextualBoundaryId,
    });
    expect(boundariesView.nodes.filter((node) => node.kind === "boundary")).toHaveLength(8);
    expect(boundariesView.nodes.map((node) => node.id)).toContain(contextualBoundaryId);
    expect(boundariesView.edges.find((edge) => edge.source === contextualBoundaryId
      || edge.target === contextualBoundaryId)?.boundaryContext).toEqual({ currentScopeId, targetScopeId });
  });

  it("renders contextual cross-scope boundaries at overview", () => {
    const graph = importOnlyGraph();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const boundaryId = boundaryNodeId("layer:app", "layer:lib");
    const overview = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation: { level: "overview" },
      materializedNodeId: null,
    });

    expect(overview.nodes.map((node) => node.id)).toContain(boundaryId);
    expect(overview.edges.find((edge) => edge.source === scopeNodeId("layer:app")
      && edge.target === boundaryId)).toMatchObject({
      type: "imports",
      boundaryContext: { currentScopeId: "layer:app", targetScopeId: "layer:lib" },
    });
  });

  it("does not apply the overview architecture cap inside a scope", () => {
    const file = hierarchyNode("file:scope-architecture", "file", "src/index.ts");
    const architecture = Array.from({ length: 27 }, (_, index) =>
      hierarchyNode(`service:scope-${String(index).padStart(2, "0")}`, "service"));
    const graph = hierarchyGraph([file, ...architecture], [], [file.id, ...architecture.map((node) => node.id)]);
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const scope = hierarchyIndex.scopes[0]!;
    const scopeView = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation: { level: "scope", scopeId: scope.id },
      materializedNodeId: null,
    });

    expect(scopeView.nodes.filter((node) => node.kind === "node"
      && graphNodePlacementClass(node.rawType) === "architecture-context")).toHaveLength(27);
  });

  it("keeps a pathful architecture object at scope level when it is materialized", () => {
    const files = Array.from({ length: 25 }, (_, index) =>
      hierarchyNode(`file:path-${index}`, "file", `dir-${String(index).padStart(2, "0")}/index.ts`));
    const architecture = hierarchyNode("service:pathful", "service", "dir-24/service.ts");
    const graph = hierarchyGraph([...files, architecture], [], [...files, architecture].map((node) => node.id));
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const scope = hierarchyIndex.scopes[0]!;
    const expectedBaseClusterIds = scope.clusterIds.slice(0, 24);
    const scopeView = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation: { level: "scope", scopeId: scope.id },
      materializedNodeId: architecture.id,
    });

    expect(scopeView.nodes.filter((node) => node.kind === "cluster").map((node) => node.id))
      .toEqual(expectedBaseClusterIds);
    expect(scopeView.nodes.map((node) => node.id)).toContain(architecture.id);
  });

  it("materializes a boundary and its connecting cluster from uncapped raw members", () => {
    const localFiles = Array.from({ length: 25 }, (_, index) =>
      hierarchyNode(`file:local-${index}`, "file", `local-${String(index).padStart(2, "0")}/index.ts`));
    const external = hierarchyNode("file:external", "file", "external/index.ts");
    const graph = hierarchyGraph([...localFiles, external], [{
      source: localFiles.at(-1)!.id,
      target: external.id,
      type: "imports",
      direction: "forward",
      weight: 1,
    }]);
    graph.layers = [
      { id: "local", name: "Local", description: "Local.", nodeIds: localFiles.map((node) => node.id) },
      { id: "external", name: "External", description: "External.", nodeIds: [external.id] },
    ];
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const localScope = hierarchyIndex.scopeById.get("layer:local")!;
    const hiddenClusterId = hierarchyIndex.fileLocationById.get(localFiles.at(-1)!.id)!.clusterId;
    const portalId = boundaryNodeId(localScope.id, "layer:external");
    const scopeView = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "call",
      navigation: { level: "scope", scopeId: localScope.id },
      materializedNodeId: portalId,
    });

    expect(scopeView.nodes.map((node) => node.id)).toContain(portalId);
    expect(scopeView.nodes.map((node) => node.id)).toContain(hiddenClusterId);
    expect(scopeView.edges.find((edge) => edge.target === portalId)?.boundaryContext)
      .toEqual({ currentScopeId: localScope.id, targetScopeId: "layer:external" });
  });

  it("falls back to the owning scope when file navigation supplies an alien file", () => {
    const graph = importOnlyGraph();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const app = hierarchyIndex.scopeById.get("layer:app")!;
    const appCluster = hierarchyIndex.clusterById.get(app.clusterIds[0]!)!;
    const view = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation: {
        level: "file",
        scopeId: app.id,
        clusterId: appCluster.id,
        fileId: "file:lib/b.ts",
      },
      materializedNodeId: null,
    });

    expect(view.presentation.level).toBe("scope");
    expect(view.nodes.map((node) => node.id)).not.toContain("file:lib/b.ts");
  });

  it("keeps overview containment and documentation relations auditable", () => {
    const file = hierarchyNode("file:relations", "file", "src/index.ts");
    const document = hierarchyNode("document:guide", "document");
    const service = hierarchyNode("service:relations", "service");
    const graph = hierarchyGraph([file, document, service], [
      { source: file.id, target: document.id, type: "documents", direction: "forward", weight: 0.6 },
      { source: file.id, target: service.id, type: "contains", direction: "forward", weight: 1 },
    ], [file.id, document.id, service.id]);
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const overview = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation: { level: "overview" },
      materializedNodeId: null,
    });

    expect(overview.edges.map((edge) => edge.type).sort()).toEqual(["contains", "documents"]);
    expect(overview.edges.flatMap((edge) => edge.members).map(({ source, target, type }) => ({ source, target, type })))
      .toEqual(expect.arrayContaining([
        { source: file.id, target: document.id, type: "documents" },
        { source: file.id, target: service.id, type: "contains" },
      ]));
  });

  it("shows every architecture-context type at overview and scope levels", () => {
    const architectureTypes = [
      "module", "concept", "document", "service", "table", "endpoint", "pipeline", "schema",
      "resource", "domain", "flow", "step", "article", "entity", "topic", "claim", "source",
    ] as const satisfies readonly NodeType[];
    const file = hierarchyNode("file:architecture", "file", "src/architecture.ts");
    const architectureNodes = architectureTypes.map((type) => hierarchyNode(`architecture:${type}`, type));
    const graph = hierarchyGraph([file, ...architectureNodes], [], [file.id, ...architectureNodes.map((node) => node.id)]);
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const scope = hierarchyIndex.scopes[0]!;
    const input = { graph, hierarchyIndex, mode: "coverage" as const, materializedNodeId: null };
    const overview = buildHierarchicalSemanticGraph({ ...input, navigation: { level: "overview" } });
    const scopeView = buildHierarchicalSemanticGraph({
      ...input,
      navigation: { level: "scope", scopeId: scope.id },
    });
    const ids = architectureNodes.map((node) => node.id).sort();

    expect(overview.nodes.filter((node) => node.kind === "node"
      && graphNodePlacementClass(node.rawType) === "architecture-context")
      .map((node) => node.id).sort()).toEqual(ids);
    expect(scopeView.nodes.filter((node) => node.kind === "node"
      && graphNodePlacementClass(node.rawType) === "architecture-context")
      .map((node) => node.id).sort()).toEqual(ids);
  });

  it("returns explicit Chinese empty-state notices for empty overview, scope, cluster, and symbol-free file", () => {
    const emptyGraph = hierarchyGraph([], [], []);
    const emptyIndex = buildGraphHierarchyIndex(emptyGraph);
    const emptyOverview = buildHierarchicalSemanticGraph({
      graph: emptyGraph,
      hierarchyIndex: emptyIndex,
      mode: "architecture",
      navigation: { level: "overview" },
      materializedNodeId: null,
    });
    const graph = hierarchyGraph([hierarchyNode("file:empty", "file", "src/empty.ts")]);
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const scope = hierarchyIndex.scopes[0]!;
    const cluster = hierarchyIndex.clusterById.get(scope.clusterIds[0]!)!;
    const syntheticScope = { ...scope, id: "scope:empty", clusterIds: [], nodeIds: [] };
    const scopeIndex = {
      ...hierarchyIndex,
      scopes: [syntheticScope],
      scopeById: new Map([[syntheticScope.id, syntheticScope]]),
    };
    const emptyScope = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex: scopeIndex,
      mode: "architecture",
      navigation: { level: "scope", scopeId: syntheticScope.id },
      materializedNodeId: null,
    });
    const clusterIndex = {
      ...hierarchyIndex,
      clusterById: new Map(hierarchyIndex.clusterById).set(cluster.id, { ...cluster, fileIds: [], nodeIds: [] }),
    };
    const emptyCluster = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex: clusterIndex,
      mode: "architecture",
      navigation: { level: "cluster", scopeId: scope.id, clusterId: cluster.id },
      materializedNodeId: null,
    });
    const emptyFile = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation: { level: "file", scopeId: scope.id, clusterId: cluster.id, fileId: "file:empty" },
      materializedNodeId: null,
    });

    expect(emptyOverview).toMatchObject({ nodes: [], edges: [], presentation: { notice: "当前图谱没有可展示的范围或架构对象。" } });
    expect(emptyScope).toMatchObject({ nodes: [], edges: [], presentation: { notice: "当前范围没有可展示的聚类或架构对象。" } });
    expect(emptyCluster).toMatchObject({ nodes: [], edges: [], presentation: { notice: "当前聚类没有可展示的文件或结构对象。" } });
    expect(emptyFile.presentation.notice).toBe("当前文件没有可展示的符号。");
  });
});
