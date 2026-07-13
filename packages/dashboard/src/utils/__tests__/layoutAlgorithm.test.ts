import { describe, expect, it } from "vitest";
import { computeLayout, type LayoutMessage } from "../layoutAlgorithm.js";

const nodes: LayoutMessage["nodes"] = [
  { id: "a", width: 248, height: 124 },
  { id: "b", width: 248, height: 124 },
  { id: "c", width: 248, height: 124 },
];

describe("semantic layout algorithm", () => {
  it("produces deterministic positions after sorting nodes and edges", () => {
    const first = computeLayout({
      requestId: 7,
      nodes: [nodes[2]!, nodes[0]!, nodes[1]!],
      edges: [
        { source: "b", target: "c" },
        { source: "a", target: "b" },
      ],
      direction: "LR",
    });
    const second = computeLayout({
      requestId: 7,
      nodes,
      edges: [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
      ],
      direction: "LR",
    });

    expect(first).toEqual(second);
    expect(Object.keys(first.positions)).toEqual(["a", "b", "c"]);
  });

  it("drops orphan edges instead of letting Dagre create phantom endpoints", () => {
    const clean = computeLayout({
      requestId: 8,
      nodes,
      edges: [{ source: "a", target: "b" }],
      direction: "LR",
    });
    const withOrphans = computeLayout({
      requestId: 8,
      nodes,
      edges: [
        { source: "missing", target: "a" },
        { source: "a", target: "b" },
        { source: "c", target: "also-missing" },
      ],
      direction: "LR",
    });

    expect(withOrphans).toEqual(clean);
    expect(Object.keys(withOrphans.positions)).toEqual(["a", "b", "c"]);
  });
});
