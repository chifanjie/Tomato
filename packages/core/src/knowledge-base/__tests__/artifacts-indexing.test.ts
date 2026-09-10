import { describe, expect, it } from "vitest";
import { buildKnowledgeArtifacts, type KnowledgeArtifactInput } from "../artifacts.js";
import type { GeneratedDocument } from "../types.js";
import type { WikiIndexV2, WikiPageV2 } from "../wiki-contract.js";

const stable = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const sortedUnique = (ids: readonly string[]) => [...new Set(ids)].sort(stable);
const complete = (page: WikiPageV2) => ["generated", "verified"].includes(page.quality) && page.generationStatus === "complete";

// Deliberately retain the former full scans as an independent equivalence
// oracle. Production must not pay this node × page/evidence cost.
function scanReference(input: KnowledgeArtifactInput, index: WikiIndexV2) {
  const documents = new Map(input.documents.map((document) => [document.id, document]));
  const evidenceById = new Map(index.evidence.map((evidence) => [evidence.id, evidence]));
  const filePages = index.pages.filter((page) => page.category === "file" && complete(page));
  const files = sortedUnique(input.referenceFileNodeIds);
  const functions = sortedUnique(input.nodes.filter((node) => node.type.toLowerCase() === "function").map((node) => node.id));
  const types = sortedUnique(input.nodes.filter((node) => node.type.toLowerCase() === "class").map((node) => node.id));
  const coveredFiles = new Set(files.filter((id) => filePages.some((page) => page.directNodeIds.includes(id))));
  const anchored = (id: string) => filePages.some((page) => page.directNodeIds.includes(id)
    && documents.get(page.id)!.symbolAnchors.some((anchor) => anchor.nodeId === id));
  const coveredFunctions = new Set(functions.filter(anchored));
  const coveredTypes = new Set(types.filter(anchored));
  const count = (ids: string[], covered: Set<string>) => ({ covered: covered.size, total: ids.length, missingIds: ids.filter((id) => !covered.has(id)) });
  const categories = ["topic", "file", "flow", "module"];
  const roles = ["featured", "reference", "maintenance"];
  const priority = (page: WikiPageV2) => categories.includes(page.category) ? categories.indexOf(page.category) : 4;
  const pagePriority = (a: WikiPageV2, b: WikiPageV2) => priority(a) - priority(b)
    || roles.indexOf(a.role) - roles.indexOf(b.role) || stable(a.id, b.id);
  const nodeDocumentation = input.nodes.map((node) => {
    const direct = index.pages.filter((page) => page.directNodeIds.includes(node.id)).sort(pagePriority);
    const contextPageIds = index.pages.filter((page) => page.contextNodeIds.includes(node.id)).map((page) => page.id).sort(stable);
    const directPageIds = direct.map((page) => page.id).sort(stable);
    const evidenceIds = index.evidence.filter((evidence) => evidence.nodeIds.includes(node.id)).map((evidence) => evidence.id).sort(stable);
    const primary = direct.filter((page) => page.directNodeIds.length > 0 && complete(page)
      && page.directNodeIds.every((id) => page.evidenceIds.some((evidenceId) => evidenceById.get(evidenceId)?.nodeIds.includes(id))))[0];
    const state = primary ?? direct[0];
    const anchor = primary?.category === "file" ? documents.get(primary.id)!.symbolAnchors
      .filter((item) => item.nodeId === node.id).map((item) => item.anchor).sort(stable)[0] : undefined;
    const sourceLinked = evidenceIds.some((id) => {
      const evidence = evidenceById.get(id)!;
      return evidence.lineRange[1] >= evidence.lineRange[0] && evidence.excerpt !== undefined && evidence.excerpt.trim().length > 0;
    });
    const applicable = files.includes(node.id) || ["function", "class"].includes(node.type.toLowerCase());
    return {
      nodeId: node.id, relation: directPageIds.length ? "direct" : contextPageIds.length ? "context" : "none",
      quality: state?.quality ?? "needs-review", generationStatus: state?.generationStatus ?? "partial",
      evidenceHealth: evidenceIds.length === 0 ? "missing" : sourceLinked ? "source-linked" : "weak",
      referenceCoverage: !applicable ? "not-applicable" : coveredFiles.has(node.id) || coveredFunctions.has(node.id) || coveredTypes.has(node.id) ? "anchored" : "unanchored",
      directPageIds, contextPageIds, evidenceIds,
      ...(primary === undefined ? {} : { primaryPageId: primary.id }), ...(anchor === undefined ? {} : { anchor }),
    };
  }).sort((a, b) => stable(a.nodeId, b.nodeId));
  return { nodeDocumentation, referenceCoverage: {
    scope: { basis: "full-graph", totalGraphNodes: input.nodes.length, generationNodes: input.generationNodeCount,
      documentedNodes: new Set(index.pages.filter(complete).flatMap((page) => page.directNodeIds)).size },
    status: coveredFiles.size === files.length && coveredFunctions.size === functions.length && coveredTypes.size === types.length ? "complete" : "partial",
    files: count(files, coveredFiles), functions: count(functions, coveredFunctions), types: count(types, coveredTypes),
  } };
}

function fixture(withUsableTopic: boolean): KnowledgeArtifactInput {
  const nodes = [
    { id: "file:a", type: "file", name: "a", filePath: "a.ts" },
    { id: "file:b", type: "file", name: "b", filePath: "b.ts" },
    { id: "function:a:f", type: "function", name: "f", filePath: "a.ts" },
    { id: "class:a:T", type: "class", name: "T", filePath: "a.ts" },
    { id: "function:orphan", type: "function", name: "orphan" },
    { id: "module:context", type: "module", name: "context" },
  ];
  function document(id: string, category: GeneratedDocument["category"], direct: string[], context: string[] = [], partial = false,
    anchors: GeneratedDocument["symbolAnchors"] = []): GeneratedDocument {
    return { id, path: `${id}.md`, title: id, summary: id, category, role: "reference", directNodeIds: direct, contextNodeIds: context,
      symbolAnchors: anchors, representedEdgeIds: [], reason: "equivalence", content: `# ${id}`, searchTerms: [],
      quality: partial ? "needs-review" : "generated", generationStatus: partial ? "partial" : "complete", qualityIssues: [],
      sourceEvidence: sortedUnique(direct).map((nodeId) => ({ nodeId, filePath: nodes.find((node) => node.id === nodeId)?.filePath ?? "a.ts",
        lineRange: [1, 1], excerpt: nodeId === "class:a:T" ? "" : `// ${nodeId}`, claim: `${nodeId} is present.` })),
    };
  }
  const documents = [
    document("overview", "overview", ["file:a"]),
    document("file-a", "file", ["file:a", "function:a:f", "function:a:f", "class:a:T"], [], false,
      [{ nodeId: "function:a:f", anchor: "z-anchor" }, { nodeId: "function:a:f", anchor: "a-anchor" }]),
    // The class's anchor in a different page must not count as direct coverage.
    document("file-b", "file", ["file:b"], ["class:a:T", "module:context", "module:context"], false,
      [{ nodeId: "class:a:T", anchor: "context-only" }]),
    document("topic-partial", "topic", ["function:a:f"], ["file:b"], true),
  ];
  if (withUsableTopic) documents.push(document("topic-complete", "topic", ["function:a:f"]));
  return { projectName: "equivalence", generatedAt: "2026-09-10T00:00:00Z", outputLanguage: "zh-CN", generationMode: "deterministic",
    sourceRootIdentity: "fixture", sourceRead: { covered: 2, total: 2, missingIds: [] }, requiredRouteStages: [], businessTerms: [],
    nodes: nodes.reverse(), generationNodeCount: 2, referenceFileNodeIds: ["file:b", "file:a", "file:a"], documents: documents.reverse(), warnings: [], errors: [] };
}

describe("knowledge artifact membership indexes", () => {
  it.each([false, true])("matches the former full scans with usable topic=%s", (withUsableTopic) => {
    const input = fixture(withUsableTopic);
    const { wikiIndex } = buildKnowledgeArtifacts(input);
    const expected = scanReference(input, wikiIndex);
    expect(wikiIndex.nodeDocumentation).toEqual(expected.nodeDocumentation);
    expect(wikiIndex.referenceCoverage).toEqual(expected.referenceCoverage);
    expect(wikiIndex.nodeDocumentation.find((node) => node.nodeId === "function:a:f")?.anchor).toBe(withUsableTopic ? undefined : "a-anchor");
    expect(wikiIndex.referenceCoverage.types).toEqual({ covered: 0, total: 1, missingIds: ["class:a:T"] });
  });
});
