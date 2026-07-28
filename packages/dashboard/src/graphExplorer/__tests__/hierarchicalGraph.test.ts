import { describe, expect, it, vi } from "vitest";
import type { GraphEdge, GraphNode, KnowledgeGraph, NodeType } from "@understand-code/core/types";
import {
  aggregateCoverageFixture,
  graphWithDenseSelection,
  graphWithFiftyNodes,
  graphWithHighFanoutClusters,
  oneHopIds,
  workspaceHierarchyFixture,
} from "./graphFixtures";
import {
  boundaryNodeId,
  buildGraphHierarchyIndex,
  buildHierarchicalSemanticGraph,
  buildHierarchySelectionExpansion,
  clusterNodeId,
  createHierarchicalGraphProjectionContext,
  graphNodePlacementClass,
  hasDocumentationProblem,
  normalizeGraphFilePath,
  normalizeGraphExplorerMode,
  resolveGraphRelationshipSource,
  mergeHierarchySelectionExpansion,
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

function countLargeSemanticMemberFilterVisits(
  minimumMemberCount: number,
  run: () => void,
): number {
  const originalFilter = Array.prototype.filter;
  let visits = 0;
  const filter = vi.spyOn(Array.prototype, "filter").mockImplementation(function (
    this: unknown[],
    predicate: (value: unknown, index: number, array: unknown[]) => unknown,
    thisArg?: unknown,
  ) {
    const first = this[0];
    const isLargeSemanticMemberArray = this.length >= minimumMemberCount
      && typeof first === "object"
      && first !== null
      && "id" in first
      && "source" in first
      && "target" in first
      && "direction" in first;
    if (!isLargeSemanticMemberArray) {
      return originalFilter.call(this, predicate, thisArg);
    }
    return originalFilter.call(this, (value, index, array) => {
      visits += 1;
      return predicate.call(thisArg, value, index, array);
    });
  });
  try {
    run();
  } finally {
    filter.mockRestore();
  }
  return visits;
}

function countLargeGraphEdgeFilterVisits(
  minimumEdgeCount: number,
  run: () => void,
): number {
  const originalFilter = Array.prototype.filter;
  let visits = 0;
  const filter = vi.spyOn(Array.prototype, "filter").mockImplementation(function (
    this: unknown[],
    predicate: (value: unknown, index: number, array: unknown[]) => unknown,
    thisArg?: unknown,
  ) {
    const first = this[0];
    const isLargeGraphEdgeArray = this.length >= minimumEdgeCount
      && typeof first === "object"
      && first !== null
      && "source" in first
      && "target" in first
      && "type" in first
      && "direction" in first;
    if (!isLargeGraphEdgeArray) {
      return originalFilter.call(this, predicate, thisArg);
    }
    return originalFilter.call(this, (value, index, array) => {
      visits += 1;
      return predicate.call(thisArg, value, index, array);
    });
  });
  try {
    run();
  } finally {
    filter.mockRestore();
  }
  return visits;
}

function countLargeGraphEdgeIterationVisits(
  minimumEdgeCount: number,
  run: () => void,
): number {
  const originalIterator = Array.prototype[Symbol.iterator];
  let visits = 0;
  const iterator = vi.spyOn(Array.prototype, Symbol.iterator).mockImplementation(function (
    this: unknown[],
  ) {
    const delegate = originalIterator.call(this);
    const first = this[0];
    const isLargeGraphEdgeArray = this.length >= minimumEdgeCount
      && typeof first === "object"
      && first !== null
      && "source" in first
      && "target" in first
      && "type" in first
      && "direction" in first;
    if (!isLargeGraphEdgeArray) return delegate;
    return {
      next() {
        const result = delegate.next();
        if (!result.done) visits += 1;
        return result;
      },
      [Symbol.iterator]() {
        return this;
      },
    } as ArrayIterator<unknown>;
  });
  try {
    run();
  } finally {
    iterator.mockRestore();
  }
  return visits;
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

  it("indexes pathless architecture containment within a linear edge-filter budget", () => {
    const architectureCount = 2_000;
    const first = hierarchyNode("file:z-first", "file", "first/index.ts");
    const second = hierarchyNode("file:a-second", "file", "second/index.ts");
    const architectureNodes = Array.from({ length: architectureCount }, (_, index) =>
      hierarchyNode(`service:pathless-${String(index).padStart(4, "0")}`, "service"));
    const graph: KnowledgeGraph = {
      ...hierarchyGraph(
        [first, second, ...architectureNodes],
        architectureNodes.flatMap((node): GraphEdge[] => [
          { source: second.id, target: node.id, type: "contains", direction: "forward", weight: 1 },
          { source: first.id, target: node.id, type: "contains", direction: "forward", weight: 1 },
        ]),
      ),
      layers: [
        { id: "first", name: "第一层", description: "First.", nodeIds: [first.id] },
        { id: "second", name: "第二层", description: "Second.", nodeIds: [second.id] },
      ],
    };
    let hierarchyIndex: ReturnType<typeof buildGraphHierarchyIndex> | null = null;

    const graphEdgeFilterVisits = countLargeGraphEdgeFilterVisits(graph.edges.length, () => {
      hierarchyIndex = buildGraphHierarchyIndex(graph);
    });

    expect(hierarchyIndex!.scopes.map((scope) => scope.id)).toEqual(["layer:first", "layer:second"]);
    expect(architectureNodes.every((node) =>
      hierarchyIndex!.nodeLocationById.get(node.id)?.scopeId === "layer:first")).toBe(true);
    expect(graphEdgeFilterVisits).toBeLessThanOrEqual(graph.edges.length);
  });

  it("propagates a reverse lexical pathless containment chain within a linear edge-visit budget", () => {
    const architectureCount = 2_000;
    const architectureNodes = Array.from({ length: architectureCount }, (_, index) =>
      hierarchyNode(`service:chain-${String(index).padStart(4, "0")}`, "service"));
    const graph: KnowledgeGraph = {
      ...hierarchyGraph(
        architectureNodes,
        architectureNodes.slice(1).map((node, index): GraphEdge => ({
          source: node.id,
          target: architectureNodes[index]!.id,
          type: "contains",
          direction: "forward",
          weight: 1,
        })),
      ),
      layers: [{
        id: "root",
        name: "根层",
        description: "Root.",
        nodeIds: [architectureNodes.at(-1)!.id],
      }],
    };
    let hierarchyIndex: ReturnType<typeof buildGraphHierarchyIndex> | null = null;

    const graphEdgeIterationVisits = countLargeGraphEdgeIterationVisits(graph.edges.length, () => {
      hierarchyIndex = buildGraphHierarchyIndex(graph);
    });

    expect(architectureNodes.every((node) =>
      hierarchyIndex!.nodeLocationById.get(node.id)?.scopeId === "layer:root")).toBe(true);
    expect(graphEdgeIterationVisits).toBeLessThanOrEqual(graph.edges.length * 4);
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

  it("keeps an explicit projection context equivalent to the legacy hierarchy APIs", () => {
    const graph = importOnlyGraph();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const input = {
      graph,
      hierarchyIndex,
      mode: "call" as const,
      navigation: { level: "overview" as const },
      materializedNodeId: null,
    };
    const projectionContext = createHierarchicalGraphProjectionContext({ graph });
    const legacyBase = buildHierarchicalSemanticGraph(input);
    const contextualBase = buildHierarchicalSemanticGraph({ ...input, projectionContext });
    const selectedNodeId = contextualBase.nodes.find((node) => node.kind === "scope")!.id;

    const legacyExpansion = buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph: legacyBase,
      mode: "call",
      selectedNodeId,
    });
    const contextualExpansion = buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph: contextualBase,
      projectionContext,
      mode: "call",
      selectedNodeId,
    });

    expect(contextualBase).toEqual(legacyBase);
    expect(contextualExpansion).toEqual(legacyExpansion);
  });

  it("reuses one projection deterministically without mutating its snapshot", () => {
    const graph = importOnlyGraph();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const projectionContext = createHierarchicalGraphProjectionContext({ graph });
    const projectionSnapshot = structuredClone(projectionContext.projection);
    const build = () => buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      projectionContext,
      mode: "architecture",
      navigation: { level: "scope" as const, scopeId: hierarchyIndex.scopes[0]!.id },
      materializedNodeId: null,
    });

    const first = build();
    const second = build();

    expect(second).toEqual(first);
    expect(projectionContext.projection).toEqual(projectionSnapshot);
  });

  it("rejects projection contexts from a different graph or wiki snapshot", () => {
    const fixture = aggregateCoverageFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(fixture.graph);
    const projectionContext = createHierarchicalGraphProjectionContext({
      graph: fixture.graph,
      wikiIndex: fixture.wikiIndex,
    });
    const input = {
      graph: fixture.graph,
      hierarchyIndex,
      wikiIndex: fixture.wikiIndex,
      projectionContext,
      mode: "coverage" as const,
      navigation: { level: "overview" as const },
      materializedNodeId: null,
    };

    const documented = buildHierarchicalSemanticGraph(input);
    expect(documented.nodes.find((node) => node.kind === "scope")?.documentationCounts?.direct)
      .toBeGreaterThan(0);
    expect(() => buildHierarchicalSemanticGraph({
      ...input,
      graph: { ...fixture.graph },
    })).toThrow("different graph snapshot");
    expect(() => buildHierarchicalSemanticGraph({
      ...input,
      wikiIndex: undefined,
    })).toThrow("different wiki index snapshot");
    expect(() => buildHierarchySelectionExpansion({
      graph: fixture.graph,
      hierarchyIndex,
      baseGraph: documented,
      projectionContext,
      mode: "coverage",
      selectedNodeId: documented.nodes[0]!.id,
    })).toThrow("different wiki index snapshot");
  });

  it("starts from aggregated scopes and drills through scope and file levels", () => {
    const graph = importOnlyGraph();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const app = hierarchyIndex.scopeById.get("layer:app")!;
    const appCluster = hierarchyIndex.clusterById.get(app.clusterIds[0]!)!;
    const overview = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation: { level: "overview" },
      materializedNodeId: null,
    });
    const scopeView = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "call",
      navigation: { level: "scope", scopeId: app.id },
      materializedNodeId: null,
    });
    const fileView = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "call",
      navigation: {
        level: "file",
        scopeId: app.id,
        clusterId: appCluster.id,
        fileId: "file:src/a.ts",
      },
      materializedNodeId: null,
    });

    expect(overview.nodes.filter((node) => node.kind === "scope").map((node) => node.id).sort())
      .toEqual([scopeNodeId("layer:app"), scopeNodeId("layer:lib")].sort());
    expect(overview.presentation.breadcrumbs.map((item) => item.label)).toEqual(["全局概览"]);
    expect(scopeView.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
      appCluster.id,
      boundaryNodeId(app.id, "layer:lib"),
    ]));
    expect(scopeView.edges).toContainEqual(expect.objectContaining({
      source: appCluster.id,
      target: boundaryNodeId(app.id, "layer:lib"),
      type: "imports",
    }));
    expect(fileView.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
      "file:src/a.ts",
      "file:lib/b.ts",
      "function:src/a.ts:start",
    ]));
    expect(fileView.presentation.breadcrumbs.map((item) => item.level))
      .toEqual(["overview", "scope", "cluster", "file"]);
  });

  it("falls back from calls to imports while retaining containment and an explanation", () => {
    const graph = importOnlyGraph();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    expect(resolveGraphRelationshipSource(graph)).toBe("imports");
    const view = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "call",
      navigation: { level: "overview" },
      materializedNodeId: null,
    });

    expect(view.presentation.relationshipSource).toBe("imports");
    expect(view.presentation.notice).toContain("自动降级为文件导入关系");
    expect(view.edges.map((edge) => edge.type)).toContain("imports");
  });

  it("preserves progressive aggregate coverage counts and raw evidence semantics", () => {
    const fixture = aggregateCoverageFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(fixture.graph);
    const scope = hierarchyIndex.scopes[0]!;
    const cluster = hierarchyIndex.clusterById.get(scope.clusterIds[0]!)!;
    const overview = buildHierarchicalSemanticGraph({
      graph: fixture.graph,
      hierarchyIndex,
      wikiIndex: fixture.wikiIndex,
      mode: "coverage",
      navigation: { level: "overview" },
      materializedNodeId: null,
    });
    const clusterView = buildHierarchicalSemanticGraph({
      graph: fixture.graph,
      hierarchyIndex,
      wikiIndex: fixture.wikiIndex,
      mode: "coverage",
      navigation: { level: "cluster", scopeId: scope.id, clusterId: cluster.id },
      materializedNodeId: null,
    });
    const aggregate = overview.nodes.find((node) => node.id === scopeNodeId(scope.id))!;
    const direct = clusterView.nodes.find((node) => node.docs.relation === "direct")!;
    const context = clusterView.nodes.find((node) => node.docs.relation === "context")!;
    const none = clusterView.nodes.find((node) => node.docs.relation === "none")!;

    expect(aggregate.documentationCounts).toEqual({ direct: 8, context: 1, none: 1, problem: 0, total: 10 });
    expect(aggregate.docs.directPageIds).toHaveLength(9);
    expect(aggregate.docs.evidenceIds).toHaveLength(8);
    expect(hasDocumentationProblem(direct.docs)).toBe(false);
    expect(hasDocumentationProblem(context.docs)).toBe(false);
    expect(hasDocumentationProblem(none.docs)).toBe(false);
  });

  it("counts architecture objects in architecture mode and all objects in coverage mode", () => {
    const graph = graphWithFiftyNodes();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const input = { graph, hierarchyIndex, navigation: { level: "overview" as const }, materializedNodeId: null };
    const architecture = buildHierarchicalSemanticGraph({ ...input, mode: "architecture" });
    const coverage = buildHierarchicalSemanticGraph({ ...input, mode: "coverage" });

    expect(architecture.nodes.find((node) => node.kind === "scope")?.documentationCounts?.total).toBe(1);
    expect(coverage.nodes.find((node) => node.kind === "scope")?.documentationCounts)
      .toEqual({ direct: 0, context: 0, none: 50, problem: 0, total: 50 });
  });

  it("caps dense file-level selection expansion to 20 new neighbors without changing the base", () => {
    const graph = graphWithDenseSelection(110);
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const selectedNodeId = "function:dense:selected";
    const location = hierarchyIndex.fileLocationById.get("file:src/dense.ts")!;
    const baseInput = {
      graph,
      hierarchyIndex,
      mode: "call" as const,
      navigation: { level: "file" as const, ...location },
      materializedNodeId: null,
    };
    const baseBefore = buildHierarchicalSemanticGraph(baseInput);
    const presentationBefore = baseBefore.presentation;
    const expansion = buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph: baseBefore,
      mode: "call",
      selectedNodeId,
    });
    const merged = mergeHierarchySelectionExpansion(baseBefore, expansion);
    const baseIds = new Set(baseBefore.nodes.map((node) => node.id));
    const addedNeighborIds = expansion.nodes
      .map((node) => node.id)
      .filter((id) => id !== selectedNodeId && !baseIds.has(id));

    expect(baseBefore.nodes.some((node) => node.id === selectedNodeId)).toBe(true);
    expect(expansion.nodes.map((node) => node.id)).toContain(selectedNodeId);
    expect(addedNeighborIds).toHaveLength(20);
    expect(expansion.hiddenNeighborCount).toBe(54);
    expect(oneHopIds(graph, selectedNodeId)).toEqual(expect.arrayContaining(addedNeighborIds));
    expect(expansion.edges.every((edge) => edge.source === selectedNodeId
      || edge.target === selectedNodeId)).toBe(true);
    expect(merged.nodes.some((node) => node.id === selectedNodeId)).toBe(true);
    expect(baseBefore.nodes.map((node) => node.id)).toEqual(
      buildHierarchicalSemanticGraph(baseInput).nodes.map((node) => node.id),
    );
    expect(baseBefore.presentation).toBe(presentationBefore);
    expect(merged.presentation).toBe(presentationBefore);
    expect(merged.nodes.length).toBeGreaterThan(baseBefore.nodes.length);
    expect(merged.presentation.hiddenNodeCount).toBe(baseBefore.presentation.hiddenNodeCount);
    expect(merged.presentation.totalNodeCount).toBe(baseBefore.presentation.totalNodeCount);
  });

  it("ranks capped selection neighbors by relationship weight, count, and stable id", () => {
    const selectedNodeId = "function:dense:selected";
    const weightedNeighborId = "function:dense:n-21";
    const repeatedNeighborId = "function:dense:n-20";
    const graph = graphWithDenseSelection(22);
    graph.edges = graph.edges.map((edge) => edge.type === "calls"
      ? { ...edge, weight: edge.target === weightedNeighborId ? 0.9 : 0.2 }
      : edge);
    graph.edges.push({
      source: selectedNodeId,
      target: repeatedNeighborId,
      type: "depends_on",
      direction: "forward",
      weight: 0.8,
    });
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const location = hierarchyIndex.fileLocationById.get("file:src/dense.ts")!;
    const builtBase = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "coverage",
      navigation: { level: "file", ...location },
      materializedNodeId: null,
    });
    const selected = builtBase.nodes.find((node) => node.id === selectedNodeId)!;
    const baseGraph = { ...builtBase, nodes: [selected], edges: [] };
    const buildExpansion = () => buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "coverage" as const,
      selectedNodeId,
    });
    const expansion = buildExpansion();
    const neighborIds = expansion.nodes
      .map((node) => node.id)
      .filter((id) => id !== selectedNodeId);

    expect(neighborIds).toHaveLength(20);
    expect(expansion.hiddenNeighborCount).toBe(3);
    expect(neighborIds).toEqual(expect.arrayContaining([weightedNeighborId, repeatedNeighborId]));
    expect(expansion.nodes.map((node) => node.id)).toContain(selectedNodeId);
    expect(buildExpansion()).toEqual(expansion);
  });

  it("reuses visible base nodes by identity and keeps materialization separate from selection", () => {
    const graph = graphWithDenseSelection(5);
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const location = hierarchyIndex.fileLocationById.get("file:src/dense.ts")!;
    const baseGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "call",
      navigation: { level: "file", ...location },
      materializedNodeId: "function:dense:n-4",
    });
    const selectedNodeId = "function:dense:n-0";
    const baseSelected = baseGraph.nodes.find((node) => node.id === selectedNodeId)!;
    const expansion = buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "call",
      selectedNodeId,
    });

    expect(expansion.nodes.find((node) => node.id === selectedNodeId)).toBe(baseSelected);
    expect(baseGraph.nodes.map((node) => node.id)).toContain("function:dense:n-4");
  });

  it("synthesizes a cluster neighbor hidden by the scope cap from uncapped raw members", () => {
    const files = Array.from({ length: 106 }, (_, index) =>
      hierarchyNode(`file:cluster-${index}`, "file", `dir-${String(index).padStart(2, "0")}/index.ts`));
    const calls = files.map((file, index) =>
      hierarchyNode(`function:cluster-${index}`, "function", file.filePath));
    const architecture = hierarchyNode("service:cluster-audit", "service", files[0]!.filePath);
    const graph = hierarchyGraph(
      [...files, ...calls, architecture],
      [
        ...calls.map((node, index): GraphEdge => ({
          source: files[index]!.id,
          target: node.id,
          type: "contains",
          direction: "forward",
          weight: 1,
        })),
        ...calls.slice(1).map((node): GraphEdge => ({
          source: calls[0]!.id,
          target: node.id,
          type: "calls",
          direction: "forward",
          weight: 1,
        })),
        { source: architecture.id, target: calls.at(-1)!.id, type: "calls", direction: "forward", weight: 1 },
      ],
      [...files, architecture].map((node) => node.id),
    );
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const scope = hierarchyIndex.scopes[0]!;
    const selectedClusterId = hierarchyIndex.fileLocationById.get(files[0]!.id)!.clusterId;
    const baseGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "call",
      navigation: { level: "scope", scopeId: scope.id },
      materializedNodeId: null,
    });
    const baseIds = new Set(baseGraph.nodes.map((node) => node.id));
    const hiddenClusterId = scope.clusterIds.find((clusterId) => !baseIds.has(clusterId))!;
    const hiddenCall = calls.find((node) =>
      hierarchyIndex.nodeLocationById.get(node.id)?.clusterId === hiddenClusterId)!;
    const expansion = buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "call",
      selectedNodeId: selectedClusterId,
    });

    expect(baseGraph.nodes.map((node) => node.id)).not.toContain(hiddenClusterId);
    expect(expansion.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
      selectedClusterId,
      hiddenClusterId,
    ]));
    expect(expansion.nodes.filter((node) => node.kind === "cluster" && !baseIds.has(node.id)))
      .toHaveLength(20);
    expect(expansion.edges.length).toBeLessThanOrEqual(
      baseGraph.nodes.filter((node) => node.kind === "cluster").length - 1 + 20,
    );
    const connecting = expansion.edges.find((edge) =>
      edge.source === selectedClusterId && edge.target === hiddenClusterId);
    expect(connecting?.members).toContainEqual(expect.objectContaining({
      source: calls[0]!.id,
      target: hiddenCall.id,
      type: "calls",
      direction: "forward",
    }));
    expect(connecting?.members).not.toContainEqual(expect.objectContaining({ source: architecture.id }));
  });

  it("keeps capped high-fanout cluster synthesis within a linear semantic-member filter budget", () => {
    const clusterCount = 512;
    const graph = graphWithHighFanoutClusters(clusterCount);
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const scope = hierarchyIndex.scopes[0]!;
    const selectedClusterId = hierarchyIndex.fileLocationById.get("file:fanout-000")!.clusterId;
    const baseGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "call",
      navigation: { level: "scope", scopeId: scope.id },
      materializedNodeId: null,
    });
    let expansion: ReturnType<typeof buildHierarchySelectionExpansion> | null = null;
    const semanticMemberFilterVisits = countLargeSemanticMemberFilterVisits(graph.edges.length, () => {
      expansion = buildHierarchySelectionExpansion({
        graph,
        hierarchyIndex,
        baseGraph,
        mode: "call",
        selectedNodeId: selectedClusterId,
      });
    });

    const baseClusterIds = new Set(baseGraph.nodes
      .filter((node) => node.kind === "cluster")
      .map((node) => node.id));
    const expansionClusterIds = expansion!.nodes
      .filter((node) => node.kind === "cluster")
      .map((node) => node.id);
    expect(expansionClusterIds).toContain(selectedClusterId);
    expect(expansionClusterIds.filter((id) => !baseClusterIds.has(id))).toHaveLength(20);
    expect(expansion!.edges).toHaveLength(baseClusterIds.size - 1 + 20);
    expect(new Set(expansion!.edges.flatMap((edge) => [edge.source, edge.target])))
      .toEqual(new Set(expansionClusterIds));
    expect(semanticMemberFilterVisits).toBeLessThanOrEqual(graph.edges.length * 3);
  });

  it("keeps capped high-fanout boundary synthesis within one rendered-scope pass", () => {
    const boundaryCount = 512;
    const graph = manyBoundariesGraph(boundaryCount);
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const baseGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation: { level: "overview" },
      materializedNodeId: null,
    });
    let renderedScopeCandidateVisits = 0;
    const countedScopes = new Proxy(hierarchyIndex.scopes, {
      get(target, property, receiver) {
        if (property !== "find") return Reflect.get(target, property, receiver);
        return (predicate: Parameters<typeof target.find>[0], thisArg?: unknown) =>
          target.find((scope, index, scopes) => {
            renderedScopeCandidateVisits += 1;
            return predicate.call(thisArg, scope, index, scopes);
          });
      },
    });
    const expansion = buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex: { ...hierarchyIndex, scopes: countedScopes },
      baseGraph,
      mode: "architecture",
      selectedNodeId: scopeNodeId("layer:center"),
    });

    const baseBoundaryIds = new Set(baseGraph.nodes
      .filter((node) => node.kind === "boundary")
      .map((node) => node.id));
    const expansionBoundaryIds = expansion.nodes
      .filter((node) => node.kind === "boundary")
      .map((node) => node.id);
    const baseScopeNeighborIds = new Set(baseGraph.nodes
      .filter((node) => node.kind === "scope" && node.id !== scopeNodeId("layer:center"))
      .map((node) => node.id));
    expect(expansionBoundaryIds.filter((id) => !baseBoundaryIds.has(id))).toHaveLength(20);
    expect(expansion.edges).toHaveLength(expansionBoundaryIds.length + baseScopeNeighborIds.size);
    expect(new Set(expansion.edges.map((edge) => edge.target)))
      .toEqual(new Set([...expansionBoundaryIds, ...baseScopeNeighborIds]));
    expect(renderedScopeCandidateVisits).toBeLessThanOrEqual(hierarchyIndex.scopes.length);
  });

  it("synthesizes a cap-hidden scope with the same raw metadata as its materialized base node", () => {
    const graph = manyScopesGraph(17);
    graph.edges = [{
      source: graph.nodes.at(-1)!.id,
      target: graph.nodes[0]!.id,
      type: "calls",
      direction: "forward",
      weight: 1,
    }];
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const selectedScopeId = scopeNodeId(hierarchyIndex.scopes.at(-1)!.id);
    const baseInput = {
      graph,
      hierarchyIndex,
      mode: "architecture" as const,
      navigation: { level: "overview" as const },
    };
    const baseGraph = buildHierarchicalSemanticGraph({ ...baseInput, materializedNodeId: null });
    const materializedBase = buildHierarchicalSemanticGraph({
      ...baseInput,
      materializedNodeId: selectedScopeId,
    });
    const expansion = buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "architecture",
      selectedNodeId: selectedScopeId,
    });
    const synthesized = expansion.nodes.find((node) => node.id === selectedScopeId);
    const materialized = materializedBase.nodes.find((node) => node.id === selectedScopeId);

    expect(baseGraph.nodes.map((node) => node.id)).not.toContain(selectedScopeId);
    expect(materialized?.relationCount).toBe(1);
    expect(synthesized).toMatchObject({
      relationCount: materialized?.relationCount,
      summary: materialized?.summary,
    });
  });

  it("merges colliding edge ids by raw member identity without mutating base edges", () => {
    const graph = importOnlyGraph();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const baseGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "call",
      navigation: { level: "overview" },
      materializedNodeId: null,
    });
    const baseEdge = baseGraph.edges[0]!;
    const extraMember = { ...baseEdge.members[0]!, id: `${baseEdge.members[0]!.id}:extra`, weight: 0.95 };
    const baseMembersBefore = [...baseEdge.members];
    const merged = mergeHierarchySelectionExpansion(baseGraph, {
      nodes: [],
      edges: [{ ...baseEdge, members: [extraMember], bundledCount: 1 }],
      hiddenNeighborCount: 0,
    });
    const mergedEdge = merged.edges.find((edge) => edge.id === baseEdge.id)!;

    expect(mergedEdge.members).toEqual([...baseMembersBefore, extraMember]);
    expect(mergedEdge.bundledCount).toBe(2);
    expect(mergedEdge.boundaryContext).toEqual(baseEdge.boundaryContext);
    expect(baseEdge.members).toEqual(baseMembersBefore);
  });

  it("projects from the actual base presentation after invalid file navigation falls back", () => {
    const graph = importOnlyGraph();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const app = hierarchyIndex.scopeById.get("layer:app")!;
    const appClusterId = hierarchyIndex.fileLocationById.get("file:src/a.ts")!.clusterId;
    const baseGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "call",
      navigation: {
        level: "file",
        scopeId: app.id,
        clusterId: app.clusterIds[0]!,
        fileId: "file:lib/b.ts",
      },
      materializedNodeId: null,
    });
    const expansion = buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "call",
      selectedNodeId: appClusterId,
    });

    expect(baseGraph.presentation.level).toBe("scope");
    expect(expansion.nodes.map((node) => node.id)).toContain(boundaryNodeId(app.id, "layer:lib"));
    expect(expansion.edges).toContainEqual(expect.objectContaining({
      source: appClusterId,
      target: boundaryNodeId(app.id, "layer:lib"),
      type: "imports",
    }));
  });

  it("rejects stale contextual boundaries without a raw cross-scope fact", () => {
    const graph = manyScopesGraph(2);
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const baseGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation: { level: "overview" },
      materializedNodeId: null,
    });
    const staleBoundaryId = boundaryNodeId(hierarchyIndex.scopes[0]!.id, hierarchyIndex.scopes[1]!.id);

    expect(buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "architecture",
      selectedNodeId: staleBoundaryId,
    })).toEqual({ nodes: [], edges: [], hiddenNeighborCount: 0 });
  });

  it("does not expand an unrelated raw node into the current file universe", () => {
    const graph = importOnlyGraph();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const appLocation = hierarchyIndex.fileLocationById.get("file:src/a.ts")!;
    const baseGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "call",
      navigation: { level: "file", ...appLocation },
      materializedNodeId: null,
    });

    expect(buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "call",
      selectedNodeId: "function:lib/b.ts:load",
    })).toEqual({ nodes: [], edges: [], hiddenNeighborCount: 0 });
  });

  it.each([
    { level: "overview" as const },
    { level: "scope" as const },
  ])("keeps a visible service-to-file neighbor selectable across $level rebuilds", (navigation) => {
    const file = hierarchyNode("file:visible-neighbor", "file", "src/visible.ts");
    const service = hierarchyNode("service:visible-neighbor", "service", "src/visible.ts");
    const graph = hierarchyGraph([file, service], [{
      source: service.id,
      target: file.id,
      type: "depends_on",
      direction: "forward",
      weight: 1,
    }], [file.id, service.id]);
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const scope = hierarchyIndex.scopes[0]!;
    const baseGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation: navigation.level === "overview"
        ? navigation
        : { ...navigation, scopeId: scope.id },
      materializedNodeId: null,
    });
    const serviceExpansion = buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "architecture",
      selectedNodeId: service.id,
    });
    const visibleAfterFirstBuild = mergeHierarchySelectionExpansion(baseGraph, serviceExpansion);

    expect(visibleAfterFirstBuild.nodes.map((node) => node.id)).toContain(file.id);

    expect(buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "architecture",
      selectedNodeId: file.id,
    })).toEqual({ nodes: [], edges: [], hiddenNeighborCount: 0 });

    const fileExpansion = buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "architecture",
      selectedNodeId: file.id,
      selectedNodeWasVisible: true,
    });
    expect(fileExpansion.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
      file.id,
      service.id,
    ]));
    expect(fileExpansion.edges).toHaveLength(1);
  });

  it("keeps a visible file-to-symbol neighbor selectable across cluster rebuilds", () => {
    const file = hierarchyNode("file:cluster-neighbor", "file", "src/cluster.ts");
    const symbol = hierarchyNode("function:cluster-neighbor", "function", file.filePath);
    const graph = hierarchyGraph([file, symbol], [{
      source: file.id,
      target: symbol.id,
      type: "contains",
      direction: "forward",
      weight: 1,
    }], [file.id]);
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const scope = hierarchyIndex.scopes[0]!;
    const clusterId = hierarchyIndex.fileLocationById.get(file.id)!.clusterId;
    const baseGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation: { level: "cluster", scopeId: scope.id, clusterId },
      materializedNodeId: null,
    });
    const fileExpansion = buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "architecture",
      selectedNodeId: file.id,
    });
    const visibleAfterFirstBuild = mergeHierarchySelectionExpansion(baseGraph, fileExpansion);

    expect(visibleAfterFirstBuild.nodes.map((node) => node.id)).toContain(symbol.id);

    expect(buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "architecture",
      selectedNodeId: symbol.id,
    })).toEqual({ nodes: [], edges: [], hiddenNeighborCount: 0 });

    const symbolExpansion = buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "architecture",
      selectedNodeId: symbol.id,
      selectedNodeWasVisible: true,
    });
    expect(symbolExpansion.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
      file.id,
      symbol.id,
    ]));
    expect(symbolExpansion.edges).toHaveLength(1);
  });

  it("does not naturally own an isolated pathful architecture object at file level", () => {
    const file = hierarchyNode("file:pathful-service", "file", "src/pathful.ts");
    const symbol = hierarchyNode("function:pathful-service", "function", file.filePath);
    const service = hierarchyNode("service:pathful-service", "service", file.filePath);
    const graph = hierarchyGraph([file, symbol, service], [
      { source: file.id, target: symbol.id, type: "contains", direction: "forward", weight: 1 },
    ], [file.id, service.id]);
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const location = hierarchyIndex.fileLocationById.get(file.id)!;
    const baseGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation: { level: "file", ...location },
      materializedNodeId: null,
    });

    expect(buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "architecture",
      selectedNodeId: service.id,
    })).toEqual({ nodes: [], edges: [], hiddenNeighborCount: 0 });
  });

  it("keeps a mode-allowed pathful architecture neighbor in the file candidate universe", () => {
    const file = hierarchyNode("file:related-service", "file", "src/related.ts");
    const symbol = hierarchyNode("function:related-service", "function", file.filePath);
    const service = hierarchyNode("service:related-service", "service", file.filePath);
    const graph = hierarchyGraph([file, symbol, service], [
      { source: file.id, target: symbol.id, type: "contains", direction: "forward", weight: 1 },
      { source: symbol.id, target: service.id, type: "depends_on", direction: "forward", weight: 1 },
    ], [file.id, service.id]);
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const location = hierarchyIndex.fileLocationById.get(file.id)!;
    const baseGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation: { level: "file", ...location },
      materializedNodeId: null,
    });
    const expansion = buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "architecture",
      selectedNodeId: service.id,
    });
    expect(expansion.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
      symbol.id,
      service.id,
    ]));
  });

  it("projects both evidence-backed overview portal contexts for a cross-scope relation", () => {
    const graph = importOnlyGraph();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const baseGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "call",
      navigation: { level: "overview" },
      materializedNodeId: null,
    });
    const reversePortalId = boundaryNodeId("layer:lib", "layer:app");
    const expansion = buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "call",
      selectedNodeId: reversePortalId,
    });

    expect(expansion.nodes.map((node) => node.id)).toContain(reversePortalId);
    expect(expansion.edges).toContainEqual(expect.objectContaining({
      source: reversePortalId,
      target: scopeNodeId("layer:lib"),
      type: "imports",
      boundaryContext: { currentScopeId: "layer:lib", targetScopeId: "layer:app" },
    }));
  });

  it("rejects a cluster boundary whose facts only touch another cluster", () => {
    const localA = hierarchyNode("file:local-a", "file", "a/index.ts");
    const localB = hierarchyNode("file:local-b", "file", "b/index.ts");
    const external = hierarchyNode("file:external-boundary", "file", "external/index.ts");
    const graph = hierarchyGraph([localA, localB, external], [{
      source: localB.id,
      target: external.id,
      type: "imports",
      direction: "forward",
      weight: 1,
    }]);
    graph.layers = [
      { id: "local", name: "Local", description: "Local.", nodeIds: [localA.id, localB.id] },
      { id: "external", name: "External", description: "External.", nodeIds: [external.id] },
    ];
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const localScope = hierarchyIndex.scopeById.get("layer:local")!;
    const unrelatedClusterId = hierarchyIndex.fileLocationById.get(localA.id)!.clusterId;
    const baseGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "call",
      navigation: { level: "cluster", scopeId: localScope.id, clusterId: unrelatedClusterId },
      materializedNodeId: null,
    });

    expect(buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "call",
      selectedNodeId: boundaryNodeId(localScope.id, "layer:external"),
    })).toEqual({ nodes: [], edges: [], hiddenNeighborCount: 0 });
  });

  it("synthesizes a hidden cluster boundary from only current-cluster raw facts", () => {
    const localA = hierarchyNode("file:boundary-local-a", "file", "a/index.ts");
    const localB = hierarchyNode("file:boundary-local-b", "file", "b/index.ts");
    const external = Array.from({ length: 9 }, (_, index) =>
      hierarchyNode(
        `file:boundary-external-${String(index).padStart(2, "0")}`,
        "file",
        `external-${String(index).padStart(2, "0")}/index.ts`,
      ));
    const target = external.at(-1)!;
    const graph = hierarchyGraph([localA, localB, ...external], [
      ...external.map((node): GraphEdge => ({
        source: localA.id,
        target: node.id,
        type: "imports",
        direction: "forward",
        weight: 1,
      })),
      {
        source: localB.id,
        target: target.id,
        type: "imports",
        direction: "forward",
        weight: 1,
      },
    ]);
    graph.layers = [
      { id: "boundary-local", name: "Local", description: "Local.", nodeIds: [localA.id, localB.id] },
      ...external.map((node, index) => ({
        id: `boundary-external-${String(index).padStart(2, "0")}`,
        name: `External ${index}`,
        description: "External.",
        nodeIds: [node.id],
      })),
    ];
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const currentScopeId = "layer:boundary-local";
    const currentClusterId = hierarchyIndex.fileLocationById.get(localA.id)!.clusterId;
    const targetScopeId = hierarchyIndex.nodeLocationById.get(target.id)!.scopeId;
    const portalId = boundaryNodeId(currentScopeId, targetScopeId);
    const navigation = {
      level: "cluster" as const,
      scopeId: currentScopeId,
      clusterId: currentClusterId,
    };
    const baseGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation,
      materializedNodeId: null,
    });
    const materializedBase = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation,
      materializedNodeId: portalId,
    });
    const expansion = buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "architecture",
      selectedNodeId: portalId,
    });
    const synthesized = expansion.nodes.find((node) => node.id === portalId);
    const materialized = materializedBase.nodes.find((node) => node.id === portalId);

    expect(baseGraph.nodes.map((node) => node.id)).not.toContain(portalId);
    expect(materialized?.relationCount).toBe(1);
    expect(synthesized).toMatchObject({
      relationCount: materialized?.relationCount,
      summary: materialized?.summary,
    });
  });

  it("rejects a cluster portal supported only by a pathful architecture object", () => {
    const localFiles = Array.from({ length: 31 }, (_, index) =>
      hierarchyNode(
        `file:architecture-portal-${String(index).padStart(2, "0")}`,
        "file",
        `local/file-${String(index).padStart(2, "0")}.ts`,
      ));
    const localService = hierarchyNode(
      "service:architecture-portal",
      "service",
      localFiles.at(-1)!.filePath,
    );
    const external = hierarchyNode("file:architecture-portal-external", "file", "external/index.ts");
    const graph = hierarchyGraph([...localFiles, localService, external], [{
      source: localService.id,
      target: external.id,
      type: "imports",
      direction: "forward",
      weight: 1,
    }]);
    graph.layers = [
      {
        id: "architecture-local",
        name: "Local",
        description: "Local.",
        nodeIds: [...localFiles.map((node) => node.id), localService.id],
      },
      { id: "architecture-external", name: "External", description: "External.", nodeIds: [external.id] },
    ];
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const scopeId = "layer:architecture-local";
    const clusterId = hierarchyIndex.fileLocationById.get(localFiles[0]!.id)!.clusterId;
    const portalId = boundaryNodeId(scopeId, "layer:architecture-external");
    const navigation = { level: "cluster" as const, scopeId, clusterId };
    const baseGraph = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation,
      materializedNodeId: null,
    });
    const materializedBase = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation,
      materializedNodeId: portalId,
    });

    expect(materializedBase.nodes.map((node) => node.id)).not.toContain(portalId);
    expect(materializedBase.nodes.map((node) => node.id)).toEqual(baseGraph.nodes.map((node) => node.id));
    expect(buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "architecture",
      selectedNodeId: portalId,
    })).toEqual({ nodes: [], edges: [], hiddenNeighborCount: 0 });
  });

  it("matches synthesized and materialized overview metadata across mixed raw facts", () => {
    const graph = manyBoundariesGraph(9);
    graph.edges.push(...graph.nodes.slice(1).map((node): GraphEdge => ({
      source: graph.nodes[0]!.id,
      target: node.id,
      type: "calls",
      direction: "forward",
      weight: 1,
    })));
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const portalId = boundaryNodeId("layer:center", "layer:external-08");
    const baseInput = {
      graph,
      hierarchyIndex,
      mode: "architecture" as const,
      navigation: { level: "overview" as const },
    };
    const baseGraph = buildHierarchicalSemanticGraph({ ...baseInput, materializedNodeId: null });
    const materializedBase = buildHierarchicalSemanticGraph({
      ...baseInput,
      materializedNodeId: portalId,
    });
    const expansion = buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph,
      mode: "architecture",
      selectedNodeId: portalId,
    });
    const materialized = materializedBase.nodes.find((node) => node.id === portalId);
    const synthesized = expansion.nodes.find((node) => node.id === portalId);

    expect(baseGraph.nodes.map((node) => node.id)).not.toContain(portalId);
    expect(materialized?.relationCount).toBe(2);
    expect(synthesized).toMatchObject({
      relationCount: materialized?.relationCount,
      summary: materialized?.summary,
    });
  });

  it("materializes both ordered overview portal directions from a raw call-only fact", () => {
    const left = hierarchyNode("file:overview-call-left", "file", "left/index.ts");
    const right = hierarchyNode("file:overview-call-right", "file", "right/index.ts");
    const graph = hierarchyGraph([left, right], [{
      source: left.id,
      target: right.id,
      type: "calls",
      direction: "forward",
      weight: 1,
    }]);
    graph.layers = [
      { id: "overview-left", name: "Left", description: "Left.", nodeIds: [left.id] },
      { id: "overview-right", name: "Right", description: "Right.", nodeIds: [right.id] },
    ];
    const hierarchyIndex = buildGraphHierarchyIndex(graph);

    for (const portalId of [
      boundaryNodeId("layer:overview-left", "layer:overview-right"),
      boundaryNodeId("layer:overview-right", "layer:overview-left"),
    ]) {
      const materialized = buildHierarchicalSemanticGraph({
        graph,
        hierarchyIndex,
        mode: "architecture",
        navigation: { level: "overview" },
        materializedNodeId: portalId,
      });
      expect(materialized.nodes.find((node) => node.id === portalId)?.relationCount).toBe(1);
      expect(materialized.edges.flatMap((edge) => edge.members).map((member) => member.type))
        .not.toContain("calls");
    }
  });

  it("materializes a real call-only portal in architecture mode without leaking its call edge", () => {
    const left = hierarchyNode("file:call-only-left", "file", "left/index.ts");
    const right = hierarchyNode("file:call-only-right", "file", "right/index.ts");
    const graph = hierarchyGraph([left, right], [{
      source: left.id,
      target: right.id,
      type: "calls",
      direction: "forward",
      weight: 1,
    }]);
    graph.layers = [
      { id: "left", name: "Left", description: "Left.", nodeIds: [left.id] },
      { id: "right", name: "Right", description: "Right.", nodeIds: [right.id] },
    ];
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const portalId = boundaryNodeId("layer:left", "layer:right");
    const leftScope = hierarchyIndex.scopeById.get("layer:left")!;
    const materializedBase = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation: { level: "scope", scopeId: leftScope.id },
      materializedNodeId: portalId,
    });
    const expansion = buildHierarchySelectionExpansion({
      graph,
      hierarchyIndex,
      baseGraph: materializedBase,
      mode: "architecture",
      selectedNodeId: portalId,
    });

    expect(materializedBase.nodes.map((node) => node.id)).toContain(portalId);
    expect(materializedBase.nodes.find((node) => node.id === portalId)?.relationCount).toBe(1);
    expect(materializedBase.edges.flatMap((edge) => edge.members).map((member) => member.type))
      .not.toContain("calls");
    expect(expansion.nodes.map((node) => node.id)).toContain(portalId);
    expect(expansion.nodes.find((node) => node.id === portalId)?.relationCount).toBe(1);
    expect(expansion.edges).toEqual([]);
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
    expect(new Set(scopeView.nodes.filter((node) => node.kind === "cluster").map((node) => node.clusterId)))
      .toEqual(new Set(scope.clusterIds));
    expect(new Set(clusterView.nodes.filter((node) => node.rawType === "file").map((node) => node.id)))
      .toEqual(new Set(cluster.fileIds.slice(0, 30)));
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
    expect(view.edges.every((edge) => edge.source === scopeNodeId("layer:left")
      && edge.target === scopeNodeId("layer:right")
      && edge.boundaryContext === undefined)).toBe(true);
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

  it("prioritizes relationship-covering objects before every progressive node cap", () => {
    const scopesGraph = manyScopesGraph(17);
    const rankedScopeFile = scopesGraph.nodes.at(-1)!;
    scopesGraph.edges = [{
      source: rankedScopeFile.id,
      target: scopesGraph.nodes[0]!.id,
      type: "imports",
      direction: "forward",
      weight: 1,
    }];
    const scopesIndex = buildGraphHierarchyIndex(scopesGraph);
    const scopesView = buildHierarchicalSemanticGraph({
      graph: scopesGraph,
      hierarchyIndex: scopesIndex,
      mode: "architecture",
      navigation: { level: "overview" },
      materializedNodeId: null,
    });
    expect(scopesView.nodes.map((node) => node.id)).toContain(scopeNodeId(
      scopesIndex.nodeLocationById.get(rankedScopeFile.id)!.scopeId,
    ));

    const architectureFile = hierarchyNode("file:rank-architecture", "file", "src/index.ts");
    const architectureNodes = Array.from({ length: 25 }, (_, index) =>
      hierarchyNode(`service:rank-${String(index).padStart(2, "0")}`, "service"));
    const rankedArchitecture = architectureNodes.at(-1)!;
    const architectureGraph = hierarchyGraph(
      [architectureFile, ...architectureNodes],
      [{
        source: rankedArchitecture.id,
        target: architectureFile.id,
        type: "depends_on",
        direction: "forward",
        weight: 1,
      }],
      [architectureFile.id, ...architectureNodes.map((node) => node.id)],
    );
    const architectureIndex = buildGraphHierarchyIndex(architectureGraph);
    const architectureScope = architectureIndex.scopes[0]!;
    for (const navigation of [
      { level: "overview" as const },
      { level: "scope" as const, scopeId: architectureScope.id },
    ]) {
      const view = buildHierarchicalSemanticGraph({
        graph: architectureGraph,
        hierarchyIndex: architectureIndex,
        mode: "architecture",
        navigation,
        materializedNodeId: null,
      });
      expect(view.nodes.map((node) => node.id)).toContain(rankedArchitecture.id);
    }

    const clusterFiles = Array.from({ length: 25 }, (_, index) =>
      hierarchyNode(
        `file:rank-cluster-${String(index).padStart(2, "0")}`,
        "file",
        `dir-${String(index).padStart(2, "0")}/index.ts`,
      ));
    const rankedClusterFile = clusterFiles.at(-1)!;
    const clustersGraph = hierarchyGraph(clusterFiles, [{
      source: rankedClusterFile.id,
      target: clusterFiles[0]!.id,
      type: "imports",
      direction: "forward",
      weight: 1,
    }]);
    const clustersIndex = buildGraphHierarchyIndex(clustersGraph);
    const clustersScope = clustersIndex.scopes[0]!;
    const clustersView = buildHierarchicalSemanticGraph({
      graph: clustersGraph,
      hierarchyIndex: clustersIndex,
      mode: "architecture",
      navigation: { level: "scope", scopeId: clustersScope.id },
      materializedNodeId: null,
    });
    expect(clustersView.nodes.map((node) => node.id)).toContain(
      clustersIndex.fileLocationById.get(rankedClusterFile.id)!.clusterId,
    );

    const files = Array.from({ length: 31 }, (_, index) =>
      hierarchyNode(`file:rank-file-${String(index).padStart(2, "0")}`, "file", `src/file-${index}.ts`));
    const fileless = Array.from({ length: 13 }, (_, index) =>
      hierarchyNode(`config:rank-${String(index).padStart(2, "0")}`, "config", `src/config-${index}.json`));
    const rankedFile = files.at(-1)!;
    const rankedFileless = fileless.at(-1)!;
    const filesGraph = hierarchyGraph([...files, ...fileless], [
      { source: rankedFile.id, target: files[0]!.id, type: "imports", direction: "forward", weight: 1 },
      { source: rankedFileless.id, target: files[0]!.id, type: "configures", direction: "forward", weight: 1 },
    ]);
    const filesIndex = buildGraphHierarchyIndex(filesGraph);
    const filesScope = filesIndex.scopes[0]!;
    const filesCluster = filesIndex.clusterById.get(filesIndex.fileLocationById.get(files[0]!.id)!.clusterId)!;
    const filesView = buildHierarchicalSemanticGraph({
      graph: filesGraph,
      hierarchyIndex: filesIndex,
      mode: "coverage",
      navigation: { level: "cluster", scopeId: filesScope.id, clusterId: filesCluster.id },
      materializedNodeId: null,
    });
    expect(filesView.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
      rankedFile.id,
      rankedFileless.id,
    ]));

    const symbolFile = hierarchyNode("file:rank-symbol", "file", "src/symbol.ts");
    const symbols = Array.from({ length: 39 }, (_, index) =>
      hierarchyNode(`function:rank-${String(index).padStart(2, "0")}`, "function", symbolFile.filePath));
    const rankedSymbol = symbols.at(-1)!;
    const symbolsGraph = hierarchyGraph([symbolFile, ...symbols], [
      ...symbols.map((symbol): GraphEdge => ({
        source: symbolFile.id,
        target: symbol.id,
        type: "contains",
        direction: "forward",
        weight: 1,
      })),
      { source: rankedSymbol.id, target: symbols[0]!.id, type: "calls", direction: "forward", weight: 1 },
    ]);
    const symbolsIndex = buildGraphHierarchyIndex(symbolsGraph);
    const symbolLocation = symbolsIndex.fileLocationById.get(symbolFile.id)!;
    const symbolsView = buildHierarchicalSemanticGraph({
      graph: symbolsGraph,
      hierarchyIndex: symbolsIndex,
      mode: "call",
      navigation: { level: "file", ...symbolLocation },
      materializedNodeId: null,
    });
    expect(symbolsView.nodes).toHaveLength(38);
    expect(symbolsView.nodes.map((node) => node.id)).toContain(rankedSymbol.id);
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
    const scopeView = build({ level: "scope", scopeId: scope.id }, null);
    const scopeMaterialized = build(
      { level: "scope", scopeId: scope.id },
      architecture.at(-1)!.id,
    );
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
      .toHaveLength(12);
    expect(overviewMaterialized.nodes.filter((node) => node.kind === "node"
      && graphNodePlacementClass(node.rawType) === "architecture-context"))
      .toHaveLength(12);
    expect(overviewMaterialized.nodes.map((node) => node.id)).toContain(architecture.at(-1)!.id);
    expect(scopeView.nodes.filter((node) => node.kind === "node"
      && graphNodePlacementClass(node.rawType) === "architecture-context"))
      .toHaveLength(16);
    expect(scopeMaterialized.nodes.map((node) => node.id)).toContain(architecture.at(-1)!.id);
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

  it("projects cross-scope relations directly when both overview scopes are visible", () => {
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

    expect(overview.nodes.map((node) => node.id)).not.toContain(boundaryId);
    const directEdge = overview.edges.find((edge) => edge.source === scopeNodeId("layer:app")
      && edge.target === scopeNodeId("layer:lib"));
    expect(directEdge).toMatchObject({ type: "imports" });
    expect(directEdge?.boundaryContext).toBeUndefined();
  });

  it("caps scope architecture context at 16 while retaining a materialized target", () => {
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
    const materializedId = architecture.at(-1)!.id;
    const materializedScopeView = buildHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      mode: "architecture",
      navigation: { level: "scope", scopeId: scope.id },
      materializedNodeId: materializedId,
    });

    expect(scopeView.nodes.filter((node) => node.kind === "node"
      && graphNodePlacementClass(node.rawType) === "architecture-context")).toHaveLength(16);
    expect(materializedScopeView.nodes.filter((node) => node.kind === "node"
      && graphNodePlacementClass(node.rawType) === "architecture-context")).toHaveLength(16);
    expect(materializedScopeView.nodes.map((node) => node.id)).toContain(materializedId);
  });

  it("keeps document objects out of the architecture scope wall but makes an exact target reachable", () => {
    const file = hierarchyNode("file:document-wall", "file", "src/index.ts");
    const services = [
      hierarchyNode("service:document-wall-a", "service"),
      hierarchyNode("service:document-wall-b", "service"),
    ];
    const documents = Array.from({ length: 20 }, (_, index) =>
      hierarchyNode(`document:wall-${String(index).padStart(2, "0")}`, "document"));
    const graph = hierarchyGraph(
      [file, ...services, ...documents],
      [],
      [file, ...services, ...documents].map((node) => node.id),
    );
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const scope = hierarchyIndex.scopes[0]!;
    const build = (mode: "architecture" | "call" | "coverage", materializedNodeId: string | null) =>
      buildHierarchicalSemanticGraph({
        graph,
        hierarchyIndex,
        mode,
        navigation: { level: "scope", scopeId: scope.id },
        materializedNodeId,
      });
    const architectureView = build("architecture", null);
    const targetedDocumentId = documents.at(-1)!.id;
    const targetedView = build("architecture", targetedDocumentId);
    const callView = build("call", null);
    const coverageView = build("coverage", null);

    expect(architectureView.nodes.filter((node) => node.kind === "node").map((node) => node.id).sort())
      .toEqual(services.map((node) => node.id).sort());
    expect(targetedView.nodes.map((node) => node.id)).toContain(targetedDocumentId);
    expect(callView.nodes.filter((node) => node.kind === "node").map((node) => node.id).sort())
      .toEqual(services.map((node) => node.id).sort());
    expect(coverageView.nodes.filter((node) => node.kind === "node")).toHaveLength(16);
    expect(coverageView.nodes.map((node) => node.id)).toEqual(expect.arrayContaining(
      services.map((node) => node.id),
    ));
  });

  it("keeps document objects out of the architecture overview wall but preserves coverage and exact targeting", () => {
    const file = hierarchyNode("file:overview-document-wall", "file", "src/index.ts");
    const service = hierarchyNode("service:overview-document-wall", "service");
    const documents = Array.from({ length: 20 }, (_, index) =>
      hierarchyNode(`document:overview-wall-${String(index).padStart(2, "0")}`, "document"));
    const graph = hierarchyGraph(
      [file, service, ...documents],
      [],
      [file, service, ...documents].map((node) => node.id),
    );
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const build = (mode: "architecture" | "call" | "coverage", materializedNodeId: string | null) =>
      buildHierarchicalSemanticGraph({
        graph,
        hierarchyIndex,
        mode,
        navigation: { level: "overview" },
        materializedNodeId,
      });
    const architectureView = build("architecture", null);
    const targetedDocumentId = documents.at(-1)!.id;
    const targetedView = build("architecture", targetedDocumentId);
    const callView = build("call", null);
    const coverageView = build("coverage", null);

    expect(architectureView.nodes.filter((node) => node.kind === "node").map((node) => node.id))
      .toEqual([service.id]);
    expect(targetedView.nodes.map((node) => node.id)).toContain(targetedDocumentId);
    expect(callView.nodes.filter((node) => node.kind === "node").map((node) => node.id))
      .toEqual([service.id]);
    expect(coverageView.nodes.filter((node) => node.kind === "node")).toHaveLength(12);
    expect(architectureView.presentation.hiddenNodeCount).toBe(20);
    expect(callView.presentation.hiddenNodeCount).toBe(20);
    expect(coverageView.presentation.hiddenNodeCount).toBe(9);
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

  it("keeps overview containment and documentation relations auditable in coverage mode", () => {
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
      mode: "coverage",
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

  it("shows every architecture-context type at overview and keeps capped scope types reachable", () => {
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
    const overviewIds = overview.nodes.filter((node) => node.kind === "node"
      && graphNodePlacementClass(node.rawType) === "architecture-context")
      .map((node) => node.id)
      .sort();
    const scopeIds = scopeView.nodes.filter((node) => node.kind === "node"
      && graphNodePlacementClass(node.rawType) === "architecture-context")
      .map((node) => node.id)
      .sort();
    const hiddenId = ids.find((id) => !scopeIds.includes(id))!;
    const hiddenOverviewId = ids.find((id) => !overviewIds.includes(id))!;
    const materializedOverview = buildHierarchicalSemanticGraph({
      ...input,
      navigation: { level: "overview" },
      materializedNodeId: hiddenOverviewId,
    });
    const materializedScope = buildHierarchicalSemanticGraph({
      ...input,
      navigation: { level: "scope", scopeId: scope.id },
      materializedNodeId: hiddenId,
    });

    expect(overviewIds).toHaveLength(12);
    expect(ids).toEqual(expect.arrayContaining(overviewIds));
    expect(materializedOverview.nodes.filter((node) => node.kind === "node"
      && graphNodePlacementClass(node.rawType) === "architecture-context")).toHaveLength(12);
    expect(materializedOverview.nodes.map((node) => node.id)).toContain(hiddenOverviewId);
    expect(scopeIds).toHaveLength(16);
    expect(ids).toEqual(expect.arrayContaining(scopeIds));
    expect(materializedScope.nodes.filter((node) => node.kind === "node"
      && graphNodePlacementClass(node.rawType) === "architecture-context")).toHaveLength(16);
    expect(materializedScope.nodes.map((node) => node.id)).toContain(hiddenId);
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
