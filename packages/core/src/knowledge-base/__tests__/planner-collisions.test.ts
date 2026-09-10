import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "../../types.js";
import { generateKnowledgeBase } from "../generate.js";

const filePath = "src/domain/snapshot.go";
const fileId = `file:${filePath}`;
const methods = ["Request.Device", "Response.Device", "Request.Unique"];
const graph: KnowledgeGraph = {
  version: "1.0.0", kind: "codebase",
  project: { name: "receivers", languages: ["go"], frameworks: [], description: "Business device strategy", analyzedAt: "2026-09-10T00:00:00.000Z", gitCommitHash: "abc" },
  nodes: [{ id: fileId, type: "file", name: "snapshot.go", filePath, summary: "Business device strategy", tags: ["business"], complexity: "complex" },
    ...methods.map((method, index) => ({ id: `function:${filePath}:${method}`, type: "function" as const, name: method.split(".")[1]!, filePath, lineRange: [index + 1, index + 1] as [number, number], summary: "Business device strategy rule", tags: ["business", "strategy"], complexity: "complex" as const }))],
  edges: methods.map((method) => ({ source: fileId, target: `function:${filePath}:${method}`, type: "contains" as const, direction: "forward" as const, weight: 1 })),
  layers: [{ id: "layer:domain", name: "Domain", description: "Business rules", nodeIds: [fileId] }], tour: [],
};
const sourceFiles = { [filePath]: "func (r Request) Device() string { return r.device }\nfunc (r Response) Device() string { return r.device }\nfunc (r Request) Unique() bool { return true }\n" };

describe("topic source identity", () => {
  it("generates distinct stable topics for same-file Go receiver methods", () => {
    const first = generateKnowledgeBase(graph, { sourceFiles });
    const second = generateKnowledgeBase({ ...graph, nodes: [...graph.nodes].reverse(), edges: [...graph.edges].reverse() }, { sourceFiles });
    const paths = (result: typeof first) => Object.fromEntries(result.topicPlan.topics.map((topic) => [topic.topicNodeId, topic.documentPath]));
    expect(first.topicPlan.topics).toHaveLength(3);
    const deviceTopics = first.topicPlan.topics.filter((topic) => topic.topicNodeId.endsWith(".Device"));
    expect(deviceTopics).toHaveLength(2);
    expect(new Set(deviceTopics.map((topic) => topic.documentPath)).size).toBe(2);
    expect(first.topicPlan.topics.find((topic) => topic.topicNodeId.endsWith(".Unique"))?.documentPath).toBe("关键函数专题/src-domain-snapshot.go-Unique.md");
    expect(paths(second)).toEqual(paths(first));
    expect(new Set(first.plan.documents.map((document) => document.path)).size).toBe(first.plan.documents.length);
    for (const topic of deviceTopics) expect(first.plan.documents.find((document) => document.path === topic.documentPath)?.directNodeIds).toContain(topic.topicNodeId);
  });

  it("keeps same-file case and Unicode-equivalent topic paths distinct on portable filesystems", () => {
    const names = [
      "FilterGuideSceneByAnimation", "filterGuideSceneByAnimation",
      "AssignEtp", "assignETP",
      "CheckFenceInfo", "checkFenceInfo",
      "가이드", "\u1100\u1161이드",
      "Unique",
    ];
    const portableGraph: KnowledgeGraph = {
      ...graph,
      nodes: [graph.nodes[0]!, ...names.map((name, index) => ({
        ...graph.nodes[1]!, id: `function:${filePath}:${name}`, name,
        lineRange: [index + 1, index + 1] as [number, number],
      }))],
      edges: names.map((name) => ({ source: fileId, target: `function:${filePath}:${name}`, type: "contains" as const, direction: "forward" as const, weight: 1 })),
    };
    const portableSources = { [filePath]: names.map((name) => `func ${name}() bool { return true }`).join("\n") + "\n" };
    const first = generateKnowledgeBase(portableGraph, { sourceFiles: portableSources });
    const reversed = generateKnowledgeBase({ ...portableGraph, nodes: [...portableGraph.nodes].reverse(), edges: [...portableGraph.edges].reverse() }, { sourceFiles: portableSources });
    const paths = (result: typeof first) => Object.fromEntries(result.topicPlan.topics.map((topic) => [topic.topicNodeId, topic.documentPath]));
    expect(first.topicPlan.topics).toHaveLength(names.length);
    expect(paths(reversed)).toEqual(paths(first));
    const portablePaths = first.topicPlan.topics.map((topic) => topic.documentPath.normalize("NFC").toLowerCase());
    expect(new Set(portablePaths).size).toBe(names.length);
    for (const name of names.slice(0, -1)) {
      const topic = first.topicPlan.topics.find((item) => item.topicNodeId === `function:${filePath}:${name}`)!;
      expect(topic.documentPath).toMatch(/-[0-9a-f]{8}\.md$/);
      expect(first.plan.documents.find((document) => document.path === topic.documentPath)?.directNodeIds).toContain(topic.topicNodeId);
    }
    expect(paths(first)[`function:${filePath}:Unique`]).toBe("关键函数专题/src-domain-snapshot.go-Unique.md");
  });
});
