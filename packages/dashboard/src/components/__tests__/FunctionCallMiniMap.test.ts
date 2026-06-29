import { describe, expect, it } from "vitest";
import type { GraphNode } from "@understand-anything/core/types";
import type { FunctionCallNeighborhood } from "../../viewgraph/callRelationships";
import { buildFunctionMiniMapModel } from "../FunctionCallMiniMap";

const nodesById = new Map<string, GraphNode>([
  ["function:a:selected", { id: "function:a:selected", type: "function", name: "selected", filePath: "a.ts", lineRange: [1, 2], summary: "", tags: [], complexity: "moderate" }],
  ["function:a:caller", { id: "function:a:caller", type: "function", name: "caller", filePath: "a.ts", lineRange: [3, 4], summary: "", tags: [], complexity: "simple" }],
  ["function:b:callee", { id: "function:b:callee", type: "function", name: "callee", filePath: "b.ts", lineRange: [5, 6], summary: "", tags: [], complexity: "complex" }],
]);

const neighborhood: FunctionCallNeighborhood = {
  selectedFunctionId: "function:a:selected",
  incoming: [
    {
      sourceFunctionId: "function:a:caller",
      targetFunctionId: "function:a:selected",
      sourceFileId: "file:a",
      targetFileId: "file:a",
      source: "calls",
    },
  ],
  outgoing: [
    {
      sourceFunctionId: "function:a:selected",
      targetFunctionId: "function:b:callee",
      sourceFileId: "file:a",
      targetFileId: "file:b",
      source: "calls",
    },
  ],
  intraFile: [
    {
      sourceFunctionId: "function:a:caller",
      targetFunctionId: "function:a:selected",
      sourceFileId: "file:a",
      targetFileId: "file:a",
      source: "calls",
    },
  ],
  externalFileIds: ["file:b"],
};

describe("FunctionCallMiniMap model", () => {
  it("keeps every direct incoming and outgoing function", () => {
    const model = buildFunctionMiniMapModel(neighborhood, nodesById);

    expect(model.nodes.map((node) => node.id).sort()).toEqual([
      "function:a:caller",
      "function:a:selected",
      "function:b:callee",
    ]);
    expect(model.edges).toHaveLength(2);
  });

  it("marks cross-file nodes as external", () => {
    const model = buildFunctionMiniMapModel(neighborhood, nodesById);

    expect(model.nodes.find((node) => node.id === "function:b:callee")?.isExternal).toBe(true);
    expect(model.nodes.find((node) => node.id === "function:a:caller")?.isExternal).toBe(false);
  });
});
