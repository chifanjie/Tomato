import { describe, expect, it } from "vitest";
import {
  buildKnowledgeContextIndex,
  resolveKnowledgeContext,
  type KnowledgeDocumentSummary,
  type KnowledgeTraceRecord,
  type WorkbenchSelection,
} from "../knowledgeContext";

const apiSelection: WorkbenchSelection = {
  nodeId: "function:src/api.ts:loadUsers",
  filePath: "src/api.ts",
  title: "loadUsers",
  summary: "Loads users for the dashboard.",
  kind: "function",
};

describe("knowledgeContext", () => {
  it("prefers direct trace matches and formats evidence labels with line ranges", () => {
    const traces: KnowledgeTraceRecord[] = [
      {
        nodeId: apiSelection.nodeId,
        filePath: "src/api.ts",
        title: "API loading trace",
        summary: "Explains how the API request is prepared.",
        businessMeaning: "This is the main user lookup path.",
        changeRisk: "Changing this can alter dashboard loading behavior.",
        anchors: [{ label: "loadUsers", filePath: "src/api.ts", lineRange: [1, 20] }],
      },
    ];
    const documents: KnowledgeDocumentSummary[] = [
      {
        id: "doc-api",
        title: "API module notes",
        summary: "Broader notes for the API module.",
        filePath: "src/api.ts",
      },
    ];

    const context = resolveKnowledgeContext(buildKnowledgeContextIndex({ traces, documents }), apiSelection);

    expect(context.matchKind).toBe("direct-trace");
    expect(context.title).toBe("API loading trace");
    expect(context.businessMeaning).toBe("This is the main user lookup path.");
    expect(context.changeRisk).toBe("Changing this can alter dashboard loading behavior.");
    expect(context.evidence.map((anchor) => anchor.label)).toContain("loadUsers - src/api.ts L1-20");
    expect(context.documents.map((document) => document.id)).toEqual(["doc-api"]);
  });

  it("falls back to filename/path document matching when no direct trace exists", () => {
    const documents: KnowledgeDocumentSummary[] = [
      {
        id: "doc-api",
        title: "API module notes",
        summary: "The API module owns dashboard user loading.",
        filePath: "src/api.ts",
        anchors: [{ label: "API docs", filePath: "docs/api.md" }],
      },
    ];

    const context = resolveKnowledgeContext(buildKnowledgeContextIndex({ traces: [], documents }), apiSelection);

    expect(context.matchKind).toBe("filename-path");
    expect(context.title).toBe("API module notes");
    expect(context.summary).toBe("The API module owns dashboard user loading.");
    expect(context.documents.map((document) => document.id)).toEqual(["doc-api"]);
    expect(context.evidence.map((anchor) => anchor.label)).toEqual(["API docs - docs/api.md"]);
  });

  it("returns graph-only context when no docs or traces exist", () => {
    const context = resolveKnowledgeContext(
      buildKnowledgeContextIndex({ traces: [], documents: [] }),
      {
        nodeId: "class:src/model.ts:UserModel",
        filePath: "src/model.ts",
        title: "UserModel",
        summary: "Normalizes user records.",
        kind: "class",
      },
    );

    expect(context.matchKind).toBe("graph-only");
    expect(context.title).toBe("UserModel");
    expect(context.summary).toBe("Normalizes user records.");
    expect(context.businessMeaning).toContain("No generated knowledge trace");
    expect(context.changeRisk).toContain("Use the graph relationships");
    expect(context.evidence).toEqual([]);
    expect(context.documents).toEqual([]);
  });

  it("matches related documents through relatedPaths after exact path matches miss", () => {
    const documents: KnowledgeDocumentSummary[] = [
      {
        id: "doc-product-flow",
        title: "Product flow notes",
        summary: "Explains API participation in the product flow.",
        filePath: "docs/product-flow.md",
        relatedPaths: ["src/api.ts", "src/controller.ts"],
      },
    ];

    const context = resolveKnowledgeContext(buildKnowledgeContextIndex({ traces: [], documents }), apiSelection);

    expect(context.matchKind).toBe("related-document");
    expect(context.title).toBe("Product flow notes");
    expect(context.documents.map((document) => document.id)).toEqual(["doc-product-flow"]);
  });

  it("returns an empty-state graph-only context when no selection is active", () => {
    const context = resolveKnowledgeContext(buildKnowledgeContextIndex({ traces: [], documents: [] }), null);

    expect(context.matchKind).toBe("graph-only");
    expect(context.title).toBe("Select a node");
    expect(context.summary).toContain("Choose a graph node");
    expect(context.evidence).toEqual([]);
    expect(context.documents).toEqual([]);
  });
});
