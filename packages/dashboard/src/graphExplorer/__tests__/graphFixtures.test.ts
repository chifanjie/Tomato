import { describe, expect, it } from "vitest";
import {
  parseWikiIndexV2,
  type CountSummaryV2,
  type RouteStage,
} from "@understand-code/core/knowledge-base";
import { validateGraph } from "@understand-code/core/schema";
import type { KnowledgeGraph } from "@understand-code/core/types";
import type { WikiRuntimeIndex } from "../../wiki/wikiIndex";
import {
  aggregateCoverageFixture,
  graphFixture,
  graphWithDenseSelection,
  graphWithFiftyNodes,
  graphWithStructuralOnly,
  importsOnlyGraphFixture,
  oneHopIds,
  wikiRuntimeFixture,
} from "./graphFixtures";

type ApplicableKind = "file" | "function" | "class";

function edgeIdentity(graph: KnowledgeGraph, index: number): string {
  const edge = graph.edges[index];
  return `${edge.source}\u0000${edge.type}\u0000${edge.target}\u0000${edge.direction}`;
}

function expectUnique(values: readonly string[]): void {
  expect(new Set(values).size).toBe(values.length);
}

function expectValidGraph(graph: KnowledgeGraph): void {
  const result = validateGraph(graph);
  expect(result.success, result.fatal ?? result.issues.map((issue) => issue.message).join("\n")).toBe(true);
  expect(result.fatal).toBeUndefined();
  expect(result.issues).toEqual([]);

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  expectUnique(graph.nodes.map((node) => node.id));
  expectUnique(graph.layers.map((layer) => layer.id));
  expectUnique(graph.edges.map((_, index) => edgeIdentity(graph, index)));

  const layerByNodeId = new Map<string, string>();
  for (const layer of graph.layers) {
    expectUnique(layer.nodeIds);
    for (const nodeId of layer.nodeIds) {
      expect(nodesById.get(nodeId)?.type).toBe("file");
      expect(layerByNodeId.has(nodeId)).toBe(false);
      layerByNodeId.set(nodeId, layer.id);
    }
  }
  for (const edge of graph.edges) {
    expect(nodesById.has(edge.source)).toBe(true);
    expect(nodesById.has(edge.target)).toBe(true);
  }
}

function applicableIds(graph: KnowledgeGraph, kind: ApplicableKind): string[] {
  return graph.nodes
    .filter((node) => node.type === kind)
    .map((node) => node.id)
    .sort();
}

function expectCoverageSummary(
  graph: KnowledgeGraph,
  index: WikiRuntimeIndex,
  kind: ApplicableKind,
  summary: CountSummaryV2,
): void {
  const applicable = applicableIds(graph, kind);
  const anchored = applicable.filter((nodeId) =>
    index.nodeDocumentationById.get(nodeId)?.referenceCoverage === "anchored");
  const missing = applicable.filter((nodeId) => !anchored.includes(nodeId));

  expect(summary).toEqual({ covered: anchored.length, total: applicable.length, missingIds: missing });
  expect(summary.missingIds.every((nodeId) => applicable.includes(nodeId))).toBe(true);
}

function expectReadyRuntime(
  graph: KnowledgeGraph,
  index: WikiRuntimeIndex,
  requiredStages: readonly RouteStage[],
): void {
  const payload = index.payload;
  expect(payload).not.toBeNull();
  if (!payload) throw new Error("fixture runtime 缺少 Wiki V2 payload");

  const parsed = parseWikiIndexV2(payload);
  expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("\n")).toBe(true);
  expect(payload.source.generationMode).toBe("writer");
  expect(payload.mainReadiness).toMatchObject({ status: "ready", reasons: [] });

  const routePages = payload.pages
    .filter((page) => page.route)
    .sort((left, right) => left.route!.order - right.route!.order || left.id.localeCompare(right.id));
  expect(payload.mainReadiness.routePageIds).toEqual(routePages.map((page) => page.id));
  expectUnique(payload.mainReadiness.routePageIds);
  expect(new Set(routePages.map((page) => page.route!.stage))).toEqual(new Set(requiredStages));

  const evidenceById = new Map(payload.evidence.map((evidence) => [evidence.id, evidence]));
  for (const page of routePages) {
    expect(page.role).toBe("featured");
    expect(page.directNodeIds.length).toBeGreaterThan(0);
    expect(["generated", "verified"]).toContain(page.quality);
    expect(page.generationStatus).toBe("complete");
    for (const nodeId of page.directNodeIds) {
      expect(page.evidenceIds.some((evidenceId) =>
        evidenceById.get(evidenceId)?.nodeIds.includes(nodeId))).toBe(true);
    }
  }

  for (const page of payload.pages) {
    for (const nodeId of page.directNodeIds) {
      expect(payload.nodeDocumentation.find((record) => record.nodeId === nodeId)?.directPageIds).toContain(page.id);
    }
    for (const nodeId of page.contextNodeIds) {
      expect(payload.nodeDocumentation.find((record) => record.nodeId === nodeId)?.contextPageIds).toContain(page.id);
    }
  }

  expectCoverageSummary(graph, index, "file", payload.referenceCoverage.files);
  expectCoverageSummary(graph, index, "function", payload.referenceCoverage.functions);
  expectCoverageSummary(graph, index, "class", payload.referenceCoverage.types);
}

describe("deterministic V2 graph fixtures", () => {
  it("builds graph and Wiki fixtures that satisfy the live contracts", () => {
    const graph = graphFixture();
    const wiki = wikiRuntimeFixture();
    const aggregate = aggregateCoverageFixture();
    const large = graphWithFiftyNodes();
    const dense = graphWithDenseSelection();
    const imports = importsOnlyGraphFixture();
    const structural = graphWithStructuralOnly();

    for (const candidate of [graph, aggregate.graph, large, dense, imports, structural]) {
      expectValidGraph(candidate);
    }
    expectReadyRuntime(graph, wiki, ["purpose", "implementation"]);
    expectReadyRuntime(aggregate.graph, aggregate.wikiIndex, ["purpose"]);

    expect(aggregate.wikiIndex.payload?.referenceCoverage.files).toEqual({
      covered: 8,
      total: 10,
      missingIds: ["file:coverage/8.ts", "file:coverage/9.ts"],
    });
    expect(aggregate.wikiIndex.payload?.nodeDocumentation.map((record) => record.relation)).toEqual([
      "direct", "direct", "direct", "direct", "direct",
      "direct", "direct", "direct", "context", "none",
    ]);
    expect(large.nodes).toHaveLength(50);
    expect(oneHopIds(large, "function:src/large.ts:selected")).toEqual([
      "file:src/large.ts",
      "function:src/large.ts:fn-46",
      "function:src/large.ts:fn-47",
      "function:src/large.ts:fn-48",
    ]);
    expect(dense.nodes).toHaveLength(111);
    expect(dense.edges).toHaveLength(110);
    expect(dense.layers).toEqual([]);
    expect(dense.nodes.every((node) => node.filePath === "src/dense.ts")).toBe(true);
  });

  it("is byte-for-byte deterministic across repeated factory calls", () => {
    expect(graphFixture()).toEqual(graphFixture());
    expect(wikiRuntimeFixture().payload).toEqual(wikiRuntimeFixture().payload);
    expect(aggregateCoverageFixture()).toEqual(aggregateCoverageFixture());
    expect(graphWithFiftyNodes()).toEqual(graphWithFiftyNodes());
    expect(graphWithDenseSelection()).toEqual(graphWithDenseSelection());
    expect(importsOnlyGraphFixture()).toEqual(importsOnlyGraphFixture());
    expect(graphWithStructuralOnly()).toEqual(graphWithStructuralOnly());
  });

  it("fails fast for selected-node collisions and invalid dense counts", () => {
    expect(() => graphWithFiftyNodes("file:src/large.ts")).toThrow(/节点 ID 冲突/);
    expect(() => graphWithFiftyNodes("function:src/large.ts:fn-01")).toThrow(/节点 ID 冲突/);
    for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => graphWithDenseSelection(invalid)).toThrow(/正安全整数/);
    }
  });
});
