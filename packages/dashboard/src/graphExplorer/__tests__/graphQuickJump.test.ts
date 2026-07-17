import type { GraphEdge, GraphNode, KnowledgeGraph } from "@understand-code/core/types";
import { describe, expect, it } from "vitest";
import { graphNodePlacementClass } from "../hierarchicalGraph.js";
import {
  boundaryNodeId,
  buildGraphHierarchyIndex,
  scopeNodeId,
  type GraphHierarchyIndex,
} from "../hierarchicalGraph.js";
import {
  buildGraphQuickJumpItems,
  resolveGraphNavigationIntent,
  searchGraphQuickJump,
} from "../graphQuickJump.js";
import { workspaceHierarchyFixture } from "./graphFixtures.js";

function twoScopeGraph(direction: GraphEdge["direction"] = "forward"): KnowledgeGraph {
  const nodes: GraphNode[] = [
    {
      id: "file:packages/app/src/index.ts",
      type: "file",
      name: "index.ts",
      filePath: "packages/app/src/index.ts",
      summary: "应用入口。",
      tags: [],
      complexity: "simple",
    },
    {
      id: "file:packages/lib/src/id.ts",
      type: "file",
      name: "id.ts",
      filePath: "packages/lib/src/id.ts",
      summary: "标识工具。",
      tags: [],
      complexity: "simple",
    },
  ];
  return {
    version: "1.0.0",
    project: {
      name: "two-scope",
      languages: ["typescript"],
      frameworks: [],
      description: "双范围夹具。",
      analyzedAt: "2026-07-17T00:00:00.000Z",
      gitCommitHash: "fixture",
    },
    nodes,
    edges: [{
      source: nodes[0]!.id,
      target: nodes[1]!.id,
      type: "calls",
      direction,
      weight: 1,
    }],
    layers: [
      { id: "app", name: "应用", description: "应用层。", nodeIds: [nodes[0]!.id] },
      { id: "lib", name: "库", description: "库层。", nodeIds: [nodes[1]!.id] },
    ],
    tour: [],
  };
}

function resolve(
  objectId: string,
  graph: KnowledgeGraph,
  hierarchyIndex = buildGraphHierarchyIndex(graph),
) {
  return resolveGraphNavigationIntent({
    objectId,
    source: "wiki-focus",
    graph,
    hierarchyIndex,
  });
}

function rejectLinearMembershipReads<T>(values: readonly T[]): readonly T[] {
  return new Proxy([...values], {
    get(target, property, receiver) {
      if (property === "includes" || property === "some" || property === "find") {
        throw new Error(`unexpected per-item hierarchy scan through ${String(property)}`);
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

describe("graph Quick Jump model", () => {
  it("indexes domain, flow, and step architecture objects with semantic kinds at scope level", () => {
    const graph: KnowledgeGraph = {
      version: "1.0.0",
      project: {
        name: "domain-flow",
        languages: ["typescript"],
        frameworks: [],
        description: "业务流程夹具。",
        analyzedAt: "2026-07-17T00:00:00.000Z",
        gitCommitHash: "fixture",
      },
      nodes: [
        { id: "domain:orders", type: "domain", name: "订单域", summary: "订单能力。", tags: [], complexity: "simple" },
        { id: "flow:checkout", type: "flow", name: "结算流程", summary: "结算。", tags: [], complexity: "simple" },
        { id: "step:charge", type: "step", name: "扣款步骤", summary: "扣款。", tags: [], complexity: "simple" },
      ],
      edges: [{ source: "flow:checkout", target: "step:charge", type: "flow_step", direction: "forward", weight: 1 }],
      layers: [{
        id: "commerce",
        name: "交易",
        description: "交易架构。",
        nodeIds: ["domain:orders", "flow:checkout", "step:charge"],
      }],
      tour: [],
    };
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const items = buildGraphQuickJumpItems({ graph, hierarchyIndex });

    expect(items.find((item) => item.id === "domain:orders")?.kind).toBe("capability");
    expect(items.find((item) => item.id === "flow:checkout")?.kind).toBe("flow");
    expect(items.find((item) => item.id === "step:charge")?.kind).toBe("flow");
    for (const id of ["domain:orders", "flow:checkout", "step:charge"]) {
      expect(resolve(id, graph, hierarchyIndex)?.navigation).toEqual({ level: "scope", scopeId: "layer:commerce" });
    }
  });

  it("maps every hierarchy level and raw placement to its exact parent view", () => {
    const graph = workspaceHierarchyFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const scope = hierarchyIndex.scopes[0]!;
    const cluster = hierarchyIndex.clusterById.get(scope.clusterIds[0]!)!;
    const fileId = cluster.fileIds[0]!;
    const symbolId = "function:packages/api/src/routes/user.ts:loadUser";
    const symbolLocation = hierarchyIndex.symbolLocationById.get(symbolId)!;
    const pathfulRawId = "config:pathful-without-file";
    const pathfulLocation = hierarchyIndex.nodeLocationById.get(pathfulRawId)!;
    const architectureId = "service:gateway";
    const architectureLocation = hierarchyIndex.nodeLocationById.get(architectureId)!;
    const lowLevelRawId = "function:detached";
    const lowLevelLocation = hierarchyIndex.nodeLocationById.get(lowLevelRawId)!;

    expect(resolve(scopeNodeId(scope.id), graph, hierarchyIndex)).toEqual({
      source: "wiki-focus",
      navigation: { level: "overview" },
      materializedNodeId: scopeNodeId(scope.id),
      selectionId: scopeNodeId(scope.id),
    });
    expect(resolve(cluster.id, graph, hierarchyIndex)).toEqual({
      source: "wiki-focus",
      navigation: { level: "scope", scopeId: cluster.scopeId },
      materializedNodeId: cluster.id,
      selectionId: cluster.id,
    });
    expect(resolve(fileId, graph, hierarchyIndex)).toEqual({
      source: "wiki-focus",
      navigation: {
        level: "cluster",
        scopeId: cluster.scopeId,
        clusterId: cluster.id,
      },
      materializedNodeId: fileId,
      selectionId: fileId,
    });
    expect(resolve(symbolId, graph, hierarchyIndex)).toEqual({
      source: "wiki-focus",
      navigation: { level: "file", ...symbolLocation },
      materializedNodeId: symbolId,
      selectionId: symbolId,
    });
    expect(resolve(pathfulRawId, graph, hierarchyIndex)).toEqual({
      source: "wiki-focus",
      navigation: {
        level: "cluster",
        scopeId: pathfulLocation.scopeId,
        clusterId: pathfulLocation.clusterId,
      },
      materializedNodeId: pathfulRawId,
      selectionId: pathfulRawId,
    });
    expect(resolve(architectureId, graph, hierarchyIndex)).toEqual({
      source: "wiki-focus",
      navigation: { level: "scope", scopeId: architectureLocation.scopeId },
      materializedNodeId: architectureId,
      selectionId: architectureId,
    });
    expect(graphNodePlacementClass(hierarchyIndex.nodeById.get(lowLevelRawId)!.type)).toBe("file-leaf");
    expect(lowLevelLocation.fileId).toBeUndefined();
    expect(resolve(lowLevelRawId, graph, hierarchyIndex)).toEqual({
      source: "wiki-focus",
      navigation: {
        level: "cluster",
        scopeId: lowLevelLocation.scopeId,
        clusterId: lowLevelLocation.clusterId,
      },
      materializedNodeId: lowLevelRawId,
      selectionId: lowLevelRawId,
    });
  });

  it.each(["forward", "backward", "bidirectional"] as const)(
    "derives both ordered boundary portals from a %s raw cross-scope edge",
    (direction) => {
      const graph = twoScopeGraph(direction);
      const hierarchyIndex = buildGraphHierarchyIndex(graph);
      const left = hierarchyIndex.nodeLocationById.get(graph.edges[0]!.source)!.scopeId;
      const right = hierarchyIndex.nodeLocationById.get(graph.edges[0]!.target)!.scopeId;
      const ids = [boundaryNodeId(left, right), boundaryNodeId(right, left)];
      const items = buildGraphQuickJumpItems({ graph, hierarchyIndex });

      expect(items.filter((item) => item.kind === "boundary").map((item) => item.id).sort())
        .toEqual([...ids].sort());
      for (const [currentScopeId, targetScopeId] of [[left, right], [right, left]] as const) {
        const id = boundaryNodeId(currentScopeId, targetScopeId);
        expect(resolve(id, graph, hierarchyIndex)).toEqual({
          source: "wiki-focus",
          navigation: { level: "scope", scopeId: currentScopeId },
          materializedNodeId: id,
          selectionId: id,
        });
      }
    },
  );

  it("rejects missing objects and stale ancestor chains instead of inventing routes", () => {
    const graph = workspaceHierarchyFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const scope = hierarchyIndex.scopes[0]!;
    const cluster = hierarchyIndex.clusterById.get(scope.clusterIds[0]!)!;
    const fileId = cluster.fileIds[0]!;
    const symbolId = "function:packages/api/src/routes/user.ts:loadUser";
    const symbolFileId = hierarchyIndex.symbolLocationById.get(symbolId)!.fileId!;

    expect(resolve("missing:id", graph, hierarchyIndex)).toBeNull();

    const withoutScope: GraphHierarchyIndex = {
      ...hierarchyIndex,
      scopeById: new Map([...hierarchyIndex.scopeById].filter(([id]) => id !== cluster.scopeId)),
    };
    expect(resolve(cluster.id, graph, withoutScope)).toBeNull();

    const wrongCluster = hierarchyIndex.clusterById.get(
      scope.clusterIds.find((id) => id !== cluster.id)!,
    )!;
    const staleFileLocation = new Map(hierarchyIndex.fileLocationById);
    staleFileLocation.set(fileId, {
      scopeId: wrongCluster.scopeId,
      clusterId: wrongCluster.id,
      fileId,
    });
    expect(resolve(fileId, graph, { ...hierarchyIndex, fileLocationById: staleFileLocation })).toBeNull();

    const withoutCanonicalFile: KnowledgeGraph = {
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== symbolFileId),
      edges: graph.edges.filter((edge) => edge.source !== symbolFileId && edge.target !== symbolFileId),
    };
    expect(resolve(symbolId, withoutCanonicalFile, hierarchyIndex)).toBeNull();
  });

  it("builds a unique Chinese-stable index and searches exact, prefix, token, and slash variants deterministically", () => {
    const graph = workspaceHierarchyFixture();
    const hierarchyIndex = buildGraphHierarchyIndex(graph);
    const items = buildGraphQuickJumpItems({ graph, hierarchyIndex });
    const reversed = [...items].reverse();
    const stableIds = [...items]
      .sort((left, right) => left.label.localeCompare(right.label, "zh-CN") || left.id.localeCompare(right.id))
      .map((item) => item.id);

    expect(items.map((item) => item.id)).toEqual(stableIds);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    expect(searchGraphQuickJump(items, "user route")[0]?.path).toContain("packages/api/src/routes/user.ts");
    expect(searchGraphQuickJump(items, "  packages\\api   ").map((item) => item.id))
      .toEqual(searchGraphQuickJump(reversed, "packages/api").map((item) => item.id));
    expect(searchGraphQuickJump(items, "function:detached")[0]?.id).toBe("function:detached");
    expect(searchGraphQuickJump(items, "definitely-no-result")).toEqual([]);
    expect(searchGraphQuickJump(reversed, "").map((item) => item.id))
      .toEqual(items.slice(0, 30).map((item) => item.id));
  });

  it("resolves all items from preindexed hierarchy membership without per-item array scans", () => {
    const graph = workspaceHierarchyFixture();
    const original = buildGraphHierarchyIndex(graph);
    const scopes = original.scopes.map((scope) => ({
      ...scope,
      clusterIds: rejectLinearMembershipReads(scope.clusterIds),
      nodeIds: rejectLinearMembershipReads(scope.nodeIds),
    }));
    const clusters = [...original.clusterById.values()].map((cluster) => ({
      ...cluster,
      fileIds: rejectLinearMembershipReads(cluster.fileIds),
      nodeIds: rejectLinearMembershipReads(cluster.nodeIds),
    }));
    const hierarchyIndex: GraphHierarchyIndex = {
      ...original,
      scopes: rejectLinearMembershipReads(scopes),
      scopeById: new Map(scopes.map((scope) => [scope.id, scope])),
      clusterById: new Map(clusters.map((cluster) => [cluster.id, cluster])),
    };

    expect(() => buildGraphQuickJumpItems({ graph, hierarchyIndex })).not.toThrow();
  });
});
