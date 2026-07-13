import { describe, expect, it } from "vitest";
import { graphFileCandidates, knowledgeBaseRootCandidates } from "../../vite.paths";

describe("dashboard artifact paths", () => {
  it("uses KNOWLEDGE_BASE_DIR as an exclusive knowledge source", () => {
    expect(knowledgeBaseRootCandidates({ KNOWLEDGE_BASE_DIR: "/tmp/final-kb", GRAPH_DIR: "/tmp/old" }, "/repo/packages/dashboard"))
      .toEqual(["/tmp/final-kb"]);
  });

  it("retains graph and repository fallbacks when no explicit knowledge root is supplied", () => {
    expect(knowledgeBaseRootCandidates({ GRAPH_DIR: "/repo" }, "/repo/packages/dashboard"))
      .toEqual(["/repo/.understand-code/knowledge-base", "/repo/packages/dashboard/.understand-code/knowledge-base", "/.understand-code/knowledge-base"]);
    expect(graphFileCandidates("knowledge-graph.json", { GRAPH_DIR: "/repo" }, "/repo/packages/dashboard")[0])
      .toBe("/repo/.understand-code/knowledge-graph.json");
  });
});
