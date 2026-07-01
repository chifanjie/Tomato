import { describe, expect, it } from "vitest";
import { buildLayerFileFlowModel } from "../layerFileGraphModel";
import type { FileRelationship } from "../fileRelationships";
import type { ViewFileSummary } from "../types";

function file(id: string, functionCount = 1): ViewFileSummary {
  return {
    id,
    name: `${id}.go`,
    filePath: `src/${id}.go`,
    layerId: "core",
    node: { id, type: "file", name: `${id}.go`, filePath: `src/${id}.go`, summary: "", tags: [], complexity: "simple" },
    functionCount,
    classCount: 0,
    importOutCount: 0,
    importInCount: 0,
    functionDots: [],
    functionGroups: [],
  };
}

function relationship(sourceFileId: string, targetFileId: string, count: number): FileRelationship {
  return {
    id: `calls:${sourceFileId}->${targetFileId}`,
    sourceFileId,
    targetFileId,
    source: "calls",
    count,
    functionEdgeIds: [],
  };
}

describe("buildLayerFileFlowModel", () => {
  it("creates file nodes with border handles and canvas edges without labels or markerEnd", () => {
    const model = buildLayerFileFlowModel({
      files: [file("a"), file("b")],
      relationships: [relationship("a", "b", 3)],
      selectedFileId: null,
      fileMatchCounts: new Map(),
      maxDefaultEdges: 120,
    });

    expect(model.nodes.map((node) => [node.id, node.type])).toEqual([
      ["a", "layer-file"],
      ["b", "layer-file"],
    ]);
    expect(model.edges).toHaveLength(1);
    expect(model.edges[0]).toMatchObject({
      source: "a",
      target: "b",
      sourceHandle: "right",
      targetHandle: "left",
      animated: false,
    });
    expect(model.edges[0].label).toBeUndefined();
    expect(model.edges[0].markerEnd).toBeUndefined();
  });

  it("caps dense default edges by strongest count", () => {
    const relationships = Array.from({ length: 130 }, (_, index) =>
      relationship(`f${index}`, `g${index}`, index + 1),
    );
    const files = relationships.flatMap((edge) => [file(edge.sourceFileId), file(edge.targetFileId)]);
    const model = buildLayerFileFlowModel({
      files,
      relationships,
      selectedFileId: null,
      fileMatchCounts: new Map(),
      maxDefaultEdges: 120,
    });

    expect(model.edges).toHaveLength(120);
    expect(model.edges[0].id).toBe("calls:f129->g129");
    expect(model.edges[119].id).toBe("calls:f10->g10");
  });

  it("includes every direct selected-file relationship beyond the default cap", () => {
    const relationships = Array.from({ length: 130 }, (_, index) =>
      relationship(index < 5 ? "selected" : `f${index}`, `g${index}`, index + 1),
    );
    const files = [
      file("selected"),
      ...relationships.flatMap((edge) => [file(edge.sourceFileId), file(edge.targetFileId)]),
    ];
    const model = buildLayerFileFlowModel({
      files,
      relationships,
      selectedFileId: "selected",
      fileMatchCounts: new Map(),
      maxDefaultEdges: 3,
    });

    const selectedEdges = model.edges.filter((edge) => edge.source === "selected" || edge.target === "selected");
    expect(selectedEdges).toHaveLength(5);
    expect(selectedEdges.every((edge) => edge.animated)).toBe(true);
  });

  it("returns relationship details for the side panel", () => {
    const model = buildLayerFileFlowModel({
      files: [file("a"), file("b"), file("c")],
      relationships: [relationship("a", "b", 2), relationship("c", "a", 1)],
      selectedFileId: "a",
      fileMatchCounts: new Map([["a", 4]]),
      maxDefaultEdges: 120,
    });

    expect(model.selectedDetails?.incoming.map((edge) => edge.sourceFileId)).toEqual(["c"]);
    expect(model.selectedDetails?.outgoing.map((edge) => edge.targetFileId)).toEqual(["b"]);
    expect(model.nodes.find((node) => node.id === "a")?.data.searchMatchCount).toBe(4);
  });
});
