import { describe, expect, it } from "vitest";
import { withSourceReferenceDocuments, referenceFileNodeIdsForGraph } from "../source-references.js";
import { buildKnowledgeArtifacts } from "../artifacts.js";
import type { KnowledgeGraph } from "../../types.js";

const graph: KnowledgeGraph = {
  version: "1.0.0", project: { name: "source", languages: ["typescript"], frameworks: [], description: "", analyzedAt: "2026-09-10", gitCommitHash: "abc" },
  nodes: [
    { id: "file:a.ts", name: "a.ts", type: "file", filePath: "a.ts", summary: "", tags: [], complexity: "simple" },
    { id: "function:a.ts:run", name: "run", type: "function", filePath: "a.ts", lineRange: [1, 3], summary: "unverified old business summary", tags: [], complexity: "simple" },
    { id: "function:a.ts:unknown", name: "unknown", type: "function", filePath: "a.ts", summary: "", tags: [], complexity: "simple" },
    { id: "class:a.ts:Rules", name: "Rules", type: "class", filePath: "a.ts", lineRange: [4, 4], summary: "", tags: [], complexity: "simple" },
    { id: "file:missing.ts", name: "missing.ts", type: "file", filePath: "missing.ts", summary: "", tags: [], complexity: "simple" },
  ], edges: [], layers: [], tour: [],
};
const source = "export function run(value) {\n  if (value < 0) return false;\n}\nclass Rules {}";

describe("full graph source references", () => {
  it("indexes every symbol independently of a limited semantic projection and exposes missing source positions", () => {
    const documents = withSourceReferenceDocuments(graph, { "a.ts": source }, []);
    const artifacts = buildKnowledgeArtifacts({
      projectName: "source", generatedAt: "2026-09-10", outputLanguage: "zh-CN", generationMode: "deterministic",
      sourceRootIdentity: "root:source", sourceRead: { covered: 1, total: 2, missingIds: ["file:missing.ts"] },
      nodes: graph.nodes, generationNodeCount: 1, referenceFileNodeIds: referenceFileNodeIdsForGraph(graph),
      documents, requiredRouteStages: [], businessTerms: [], warnings: [], errors: [],
    });
    expect(artifacts.wikiIndex.referenceCoverage.functions).toEqual({ covered: 1, total: 2, missingIds: ["function:a.ts:unknown"] });
    expect(artifacts.wikiIndex.referenceCoverage.files).toEqual({ covered: 1, total: 2, missingIds: ["file:missing.ts"] });
    expect(artifacts.wikiIndex.referenceCoverage.scope).toEqual({ basis: "full-graph", totalGraphNodes: 5, generationNodes: 1, documentedNodes: 3 });
    expect(artifacts.wikiIndex.mainReadiness.status).toBe("blocked");
    expect(artifacts.searchIndex.records.filter((record) => record.kind === "symbol").map((record) => record.nodeId))
      .toEqual(expect.arrayContaining(["function:a.ts:run", "function:a.ts:unknown", "class:a.ts:Rules"]));
    const evidence = artifacts.wikiIndex.evidence.find((item) => item.nodeIds.includes("function:a.ts:run"))!;
    expect(evidence.lineRange).toEqual([1, 3]);
    expect(evidence.excerpt).toBe(source.split("\n").slice(0, 3).join("\n"));
    expect(documents[0].content).toContain("if (value < 0) return false;");
    expect(documents[0].content).not.toContain("unverified old business summary");
  });

  it("counts one physical file even when schema nodes share its path", () => {
    expect(referenceFileNodeIdsForGraph({ ...graph, nodes: [...graph.nodes,
      { ...graph.nodes[0], id: "schema:a.ts:Rules", type: "schema" },
    ] })).toEqual(["file:a.ts", "file:missing.ts"]);
  });
});
