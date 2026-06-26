import { describe, expect, it } from "vitest";
import type { FileCallEdge } from "../../viewgraph/callRelationships";
import { buildLayerCallPaths } from "../LayerCallOverlay";

const edges: FileCallEdge[] = [
  { sourceFileId: "file:a", targetFileId: "file:b", source: "calls", count: 1, functionEdgeIds: ["ab"] },
  { sourceFileId: "file:c", targetFileId: "file:a", source: "calls", count: 4, functionEdgeIds: ["ca1", "ca2", "ca3", "ca4"] },
  { sourceFileId: "file:a", targetFileId: "file:d", source: "imports", count: 1, functionEdgeIds: [] },
];

const anchors = new Map([
  ["file:a", { id: "file:a", x: 0, y: 0, width: 100, height: 80 }],
  ["file:b", { id: "file:b", x: 220, y: 0, width: 100, height: 80 }],
  ["file:c", { id: "file:c", x: 0, y: 180, width: 100, height: 80 }],
  ["file:d", { id: "file:d", x: 220, y: 180, width: 100, height: 80 }],
]);

describe("LayerCallOverlay geometry", () => {
  it("builds paths only for focused direct relationships", () => {
    const paths = buildLayerCallPaths({ edges, anchors, focusedFileId: "file:a" });

    expect(paths).toHaveLength(3);
    expect(paths.every((path) => path.d.startsWith("M "))).toBe(true);
    expect(paths.map((path) => path.edge.sourceFileId)).toContain("file:c");
    expect(paths.map((path) => path.edge.targetFileId)).toEqual(expect.arrayContaining(["file:a", "file:b", "file:d"]));
  });

  it("keeps all direct relationships and only drops edges without measured anchors", () => {
    const manyEdges = Array.from({ length: 12 }, (_, index) => ({
      sourceFileId: "file:a",
      targetFileId: `file:${index}`,
      source: "calls" as const,
      count: 1,
      functionEdgeIds: [`edge:${index}`],
    }));
    const manyAnchors = new Map(anchors);
    for (let index = 0; index < 12; index += 1) {
      manyAnchors.set(`file:${index}`, { id: `file:${index}`, x: 220, y: index * 96, width: 100, height: 80 });
    }

    expect(buildLayerCallPaths({ edges: manyEdges, anchors: manyAnchors, focusedFileId: "file:a" })).toHaveLength(12);
  });

  it("uses stronger visual weight for aggregated calls", () => {
    const paths = buildLayerCallPaths({ edges, anchors, focusedFileId: "file:a" });
    const aggregated = paths.find((path) => path.edge.sourceFileId === "file:c");

    expect(aggregated?.strokeWidth).toBeGreaterThan(1.5);
  });
});
