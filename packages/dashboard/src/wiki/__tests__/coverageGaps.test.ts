import type { KnowledgeGraph } from "@understand-code/core/types";
import { describe, expect, it } from "vitest";
import { describeCoverageGaps } from "../coverageGaps";

function graphWith(nodes: KnowledgeGraph["nodes"]): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "fixture",
      languages: ["typescript"],
      frameworks: [],
      description: "",
      analyzedAt: "2026-07-28T08:00:00Z",
      gitCommitHash: "local",
    },
    nodes,
    edges: [],
    layers: [],
    tour: [],
  } as unknown as KnowledgeGraph;
}

const node = (id: string, name: string, filePath?: string) => ({
  id,
  type: "function",
  name,
  filePath,
  summary: "",
  tags: [],
  complexity: "simple",
}) as unknown as KnowledgeGraph["nodes"][number];

describe("describeCoverageGaps", () => {
  it("names missing nodes from the graph so a count becomes a list", () => {
    const summary = { covered: 1, total: 3, missingIds: ["function:src/a.ts:run", "file:src/b.ts"] };
    const graph = graphWith([
      node("function:src/a.ts:run", "run", "src/a.ts"),
      node("file:src/b.ts", "src/b.ts", "src/b.ts"),
    ]);

    const gaps = describeCoverageGaps(summary, graph);

    expect(gaps.entries).toEqual([
      { nodeId: "function:src/a.ts:run", label: "run", location: "src/a.ts" },
      { nodeId: "file:src/b.ts", label: "src/b.ts", location: null },
    ]);
    expect(gaps.total).toBe(2);
    expect(gaps.remaining).toBe(0);
  });

  it("falls back to the node id when the graph has not loaded", () => {
    const summary = { covered: 0, total: 2, missingIds: ["function:src/a.ts:run", "file:src/b.ts"] };

    const gaps = describeCoverageGaps(summary, null);

    expect(gaps.entries).toEqual([
      { nodeId: "function:src/a.ts:run", label: "run", location: "src/a.ts" },
      { nodeId: "file:src/b.ts", label: "src/b.ts", location: null },
    ]);
  });

  it("shows an unrecognized id verbatim rather than nothing", () => {
    const gaps = describeCoverageGaps({ covered: 0, total: 1, missingIds: ["opaque"] }, null);

    expect(gaps.entries).toEqual([{ nodeId: "opaque", label: "opaque", location: null }]);
  });

  it("caps the list and counts the remainder instead of dropping it", () => {
    const missingIds = Array.from({ length: 30 }, (_, index) => `file:src/f${index}.ts`);

    const gaps = describeCoverageGaps({ covered: 0, total: 30, missingIds }, null, 12);

    expect(gaps.entries).toHaveLength(12);
    expect(gaps.total).toBe(30);
    expect(gaps.remaining).toBe(18);
  });

  it("reports no gaps when coverage is unavailable", () => {
    const gaps = describeCoverageGaps(undefined, null);

    expect(gaps.entries).toEqual([]);
    expect(gaps.total).toBe(0);
    expect(gaps.remaining).toBe(0);
  });
});
