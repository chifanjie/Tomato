# Progressive Graph Semantics and Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a progressive architecture graph with precise Wiki semantics, selectable aggregate nodes, pinned one-hop context, truthful relationship modes, restored flowing-edge interaction, no terminal arrowheads, and useful details at every level.

**Architecture:** Consume the normalized V2 runtime index from Plans 1–2. Keep semantic derivation and hierarchical selection as pure models, then use a small shared selection-presentation helper for node dimming and edge animation. Treat raw nodes, aggregate scopes, and boundary portals as one selectable union while preserving explicit drill-down actions.

**Tech Stack:** React 19, TypeScript 5.7, Zustand 5, @xyflow/react 12, ELK.js 0.9, Vitest 3, existing dashboard theme tokens

## Global Constraints

- Complete Plans 1 and 2 first.
- Graph defaults to progressive architecture: overview → scope/files → file/symbols.
- Full graph completeness means reachable by drill-down/search, not visible at once.
- Node colors describe semantic responsibility; documentation state uses small badges.
- Aggregate documentation uses counts and ratios, never one-child red veto.
- Direct pages, context pages, evidence health, quality, generation, and reference coverage remain separate.
- Single click selects; double click or an explicit button drills down; pane click clears.
- Selected object and one-hop neighbors remain visible beyond ordinary caps.
- Connected edges flow and thicken; unrelated nodes/edges fade; selection never causes layout recomputation.
- Reuse the original `understand-anything` interaction language with the new palette.
- Do not render terminal arrowheads. Reduced motion uses a small inline direction indicator.
- Never label imports or structural dependencies as function calls.
- Work incrementally and stage only task-owned files.
- Design source: `docs/superpowers/specs/2026-07-11-wiki-graph-experience-design.md`.

---

## Planned File Structure

**Create:**
- `packages/dashboard/src/graphExplorer/__tests__/graphFixtures.ts`
- `packages/dashboard/src/graphExplorer/selectionPresentation.ts`
- `packages/dashboard/src/graphExplorer/__tests__/selectionPresentation.test.ts`
- `packages/dashboard/src/hooks/useReducedMotion.ts`
- `packages/dashboard/src/hooks/__tests__/useReducedMotion.test.ts`
- `packages/dashboard/src/components/graphExplorer/FlowingSemanticEdge.tsx`
- `packages/dashboard/src/components/graphExplorer/__tests__/FlowingSemanticEdge.test.ts`
- `packages/dashboard/src/components/graphExplorer/__tests__/SemanticGraphCanvas.test.ts`

**Modify:**
- `packages/dashboard/src/graphExplorer/semanticGraph.ts`
- `packages/dashboard/src/graphExplorer/__tests__/semanticGraph.test.ts`
- `packages/dashboard/src/graphExplorer/hierarchicalGraph.ts`
- `packages/dashboard/src/graphExplorer/__tests__/hierarchicalGraph.test.ts`
- `packages/dashboard/src/components/graphExplorer/graphExplorerModel.ts`
- `packages/dashboard/src/components/graphExplorer/__tests__/graphExplorerModel.test.ts`
- `packages/dashboard/src/components/graphExplorer/SemanticGraphCanvas.tsx`
- `packages/dashboard/src/components/graphExplorer/GraphDetailsRail.tsx`
- `packages/dashboard/src/components/graphExplorer/GraphCoverageLegend.tsx`
- `packages/dashboard/src/components/graphExplorer/GraphModeToolbar.tsx`
- `packages/dashboard/src/components/graphExplorer/GraphExplorer.tsx`
- `packages/dashboard/src/store.ts`
- `packages/dashboard/src/__tests__/storeNavigation.test.ts`
- `packages/dashboard/src/index.css`

---

### Task 0: Create deterministic V2 graph fixtures

**Files:**
- Create: `packages/dashboard/src/graphExplorer/__tests__/graphFixtures.ts`

**Interfaces:**
- Consumes the exact `WikiIndexV2`, `WikiNodeDocumentationV2`, `WikiPageV2`, and `WikiEvidenceV2` contracts delivered by Plan 1.
- Consumes `buildWikiRuntimeIndex` and `WikiRuntimeIndex` delivered by Plan 2.
- Exports every shared fixture/helper referenced by Tasks 1–5; tests must not rely on undeclared `graph`, `wikiIndex`, or helper globals.

- [ ] **Step 1: Create the shared fixture module**

```ts
import type {
  WikiEvidenceV2,
  WikiIndexV2,
  WikiNodeDocumentationV2,
  WikiPageV2,
} from "@understand-code/core";
import type { GraphNode, KnowledgeGraph } from "@understand-code/core/types";
import { buildWikiRuntimeIndex, type WikiRuntimeIndex } from "../../wiki/wikiIndex";

const GENERATED_AT = "2026-07-11T00:00:00.000Z";

function fileNode(id: string, filePath: string): GraphNode {
  return { id, type: "file", name: filePath.split("/").at(-1) ?? filePath, filePath, summary: `${filePath} 的职责说明。`, tags: [], complexity: "simple" };
}

function functionNode(id: string, filePath: string, name: string, line: number): GraphNode {
  return { id, type: "function", name, filePath, lineRange: [line, line + 4], summary: `${name} 的执行说明。`, tags: [], complexity: "simple" };
}

function page(overrides: Partial<WikiPageV2> & Pick<WikiPageV2, "id" | "title" | "markdownPath">): WikiPageV2 {
  return {
    summary: `${overrides.title} 的中文摘要。`,
    role: "featured",
    category: "topic",
    quality: "generated",
    generationStatus: "complete",
    directNodeIds: [],
    contextNodeIds: [],
    evidenceIds: [],
    searchTerms: [],
    ...overrides,
  };
}

function nodeDocumentation(
  nodeId: string,
  overrides: Partial<Omit<WikiNodeDocumentationV2, "nodeId">> = {},
): WikiNodeDocumentationV2 {
  return {
    nodeId,
    relation: "none",
    quality: "needs-review",
    evidenceHealth: "missing",
    generationStatus: "partial",
    referenceCoverage: "unanchored",
    directPageIds: [],
    contextPageIds: [],
    evidenceIds: [],
    ...overrides,
  };
}

function runtimeIndex(input: {
  projectName: string;
  pages: WikiPageV2[];
  nodeDocumentation: WikiNodeDocumentationV2[];
  evidence: WikiEvidenceV2[];
  fileTotal: number;
  functionTotal?: number;
}): WikiRuntimeIndex {
  const fileCovered = input.nodeDocumentation.filter((item) => item.nodeId.startsWith("file:") && item.referenceCoverage === "anchored").length;
  const functionCovered = input.nodeDocumentation.filter((item) => item.nodeId.startsWith("function:") && item.referenceCoverage === "anchored").length;
  const missingIds = (prefix: "file:" | "function:", total: number, covered: number): string[] => {
    const known = input.nodeDocumentation.filter((item) => item.nodeId.startsWith(prefix) && item.referenceCoverage !== "anchored").map((item) => item.nodeId);
    const required = Math.max(0, total - covered);
    return [...known, ...Array.from({ length: Math.max(0, required - known.length) }, (_, index) => `missing:${prefix}${index}`)].slice(0, required);
  };
  const fileMissingIds = missingIds("file:", input.fileTotal, fileCovered);
  const functionMissingIds = missingIds("function:", input.functionTotal ?? 0, functionCovered);
  const payload: WikiIndexV2 = {
    version: 2,
    generatedAt: GENERATED_AT,
    projectName: input.projectName,
    source: { outputLanguage: "zh-CN", generationMode: "fixture" },
    mainReadiness: { status: "ready", reasons: [], routePageIds: input.pages.filter((item) => item.route).map((item) => item.id) },
    referenceCoverage: {
      status: fileCovered === input.fileTotal && functionCovered === (input.functionTotal ?? 0) ? "complete" : "partial",
      files: { covered: fileCovered, total: input.fileTotal, missingIds: fileMissingIds },
      functions: { covered: functionCovered, total: input.functionTotal ?? 0, missingIds: functionMissingIds },
      types: { covered: 0, total: 0, missingIds: [] },
    },
    pages: input.pages,
    nodeDocumentation: input.nodeDocumentation,
    evidence: input.evidence,
  };
  return buildWikiRuntimeIndex(payload);
}

export function graphFixture(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: { name: "fixture", languages: ["typescript"], frameworks: [], description: "图谱夹具。", analyzedAt: GENERATED_AT, gitCommitHash: "fixture" },
    nodes: [
      fileNode("file:src/a.ts", "src/a.ts"),
      functionNode("function:src/a.ts:run", "src/a.ts", "run", 10),
      fileNode("file:context-only.ts", "context-only.ts"),
    ],
    edges: [
      { source: "file:src/a.ts", target: "function:src/a.ts:run", type: "contains", direction: "forward", weight: 1 },
    ],
    layers: [{ id: "core", name: "核心模块", description: "负责核心执行。", nodeIds: ["file:src/a.ts", "file:context-only.ts"] }],
    tour: [],
  };
}

export function wikiRuntimeFixture(): WikiRuntimeIndex {
  const runEvidence: WikiEvidenceV2 = { id: "evidence:run", nodeIds: ["function:src/a.ts:run"], filePath: "src/a.ts", lineRange: [10, 14], excerpt: "export function run() {}", evidenceType: "production" };
  const overviewEvidence: WikiEvidenceV2 = { id: "evidence:overview-only", nodeIds: ["file:src/a.ts"], filePath: "src/a.ts", lineRange: [1, 5], excerpt: "// overview", evidenceType: "documentation" };
  return runtimeIndex({
    projectName: "fixture",
    fileTotal: 2,
    functionTotal: 1,
    pages: [
      page({ id: "page:overview", title: "项目总览", markdownPath: "knowledge-base/README.md", category: "overview", directNodeIds: ["file:src/a.ts"], contextNodeIds: ["function:src/a.ts:run", "file:context-only.ts"], evidenceIds: [overviewEvidence.id], route: { order: 0, stage: "purpose" } }),
      page({ id: "page:run", title: "运行流程", markdownPath: "knowledge-base/topics/run.md", directNodeIds: ["function:src/a.ts:run"], evidenceIds: [runEvidence.id], route: { order: 1, stage: "implementation" } }),
    ],
    nodeDocumentation: [
      nodeDocumentation("file:src/a.ts", { relation: "direct", quality: "generated", evidenceHealth: "source-linked", generationStatus: "complete", referenceCoverage: "anchored", directPageIds: ["page:overview"], evidenceIds: [overviewEvidence.id], primaryPageId: "page:overview", anchor: "a-ts" }),
      nodeDocumentation("function:src/a.ts:run", { relation: "direct", quality: "generated", evidenceHealth: "source-linked", generationStatus: "complete", referenceCoverage: "anchored", directPageIds: ["page:run"], contextPageIds: ["page:overview"], evidenceIds: [runEvidence.id], primaryPageId: "page:run", anchor: "run" }),
      nodeDocumentation("file:context-only.ts", { relation: "context", quality: "generated", evidenceHealth: "weak", generationStatus: "complete", referenceCoverage: "unanchored", contextPageIds: ["page:overview"] }),
    ],
    evidence: [runEvidence, overviewEvidence],
  });
}

export function aggregateCoverageFixture(): { graph: KnowledgeGraph; wikiIndex: WikiRuntimeIndex } {
  const nodes = Array.from({ length: 10 }, (_, index) => fileNode(`file:coverage/${index}.ts`, `coverage/${index}.ts`));
  const directEvidence = nodes.slice(0, 8).map((node, index): WikiEvidenceV2 => ({ id: `evidence:coverage:${index}`, nodeIds: [node.id], filePath: node.filePath!, lineRange: [1, 2], excerpt: `export const value${index} = ${index};`, evidenceType: "production" }));
  const directPages = nodes.slice(0, 8).map((node, index) => page({ id: `page:coverage:${index}`, title: `文件 ${index}`, markdownPath: `knowledge-base/files/${index}.md`, role: "reference", category: "file", directNodeIds: [node.id], evidenceIds: [directEvidence[index].id] }));
  const contextPage = page({ id: "page:coverage:overview", title: "覆盖总览", markdownPath: "knowledge-base/coverage-overview.md", category: "overview", contextNodeIds: [nodes[8].id], route: { order: 0, stage: "purpose" } });
  const documentation = [
    ...nodes.slice(0, 8).map((node, index) => nodeDocumentation(node.id, { relation: "direct", quality: "generated", evidenceHealth: "source-linked", generationStatus: "complete", referenceCoverage: "anchored", directPageIds: [directPages[index].id], evidenceIds: [directEvidence[index].id], primaryPageId: directPages[index].id, anchor: `file-${index}` })),
    nodeDocumentation(nodes[8].id, { relation: "context", quality: "generated", evidenceHealth: "weak", generationStatus: "complete", referenceCoverage: "unanchored", contextPageIds: [contextPage.id] }),
    nodeDocumentation(nodes[9].id, { relation: "none", quality: "needs-review", evidenceHealth: "missing", generationStatus: "partial", referenceCoverage: "unanchored" }),
  ];
  return {
    graph: {
      version: "1.0.0",
      project: { name: "coverage", languages: ["typescript"], frameworks: [], description: "覆盖夹具。", analyzedAt: GENERATED_AT, gitCommitHash: "fixture" },
      nodes,
      edges: [],
      layers: [{ id: "core", name: "核心模块", description: "核心模块包含十个关键文件。", nodeIds: nodes.map((node) => node.id) }],
      tour: [],
    },
    wikiIndex: runtimeIndex({ projectName: "coverage", pages: [...directPages, contextPage], nodeDocumentation: documentation, evidence: directEvidence, fileTotal: 10 }),
  };
}

export function graphWithFiftyNodes(selectedId = "function:src/large.ts:selected"): KnowledgeGraph {
  const file = fileNode("file:src/large.ts", "src/large.ts");
  const symbols = [
    functionNode(selectedId, "src/large.ts", "selected", 10),
    ...Array.from({ length: 48 }, (_, index) => functionNode(`function:src/large.ts:fn-${String(index + 1).padStart(2, "0")}`, "src/large.ts", `fn${index + 1}`, 20 + index * 5)),
  ];
  const [n1, n2, n3] = symbols.slice(-3).map((node) => node.id);
  return {
    version: "1.0.0",
    project: { name: "large", languages: ["typescript"], frameworks: [], description: "大范围夹具。", analyzedAt: GENERATED_AT, gitCommitHash: "fixture" },
    nodes: [file, ...symbols],
    edges: [
      ...symbols.map((node) => ({ source: file.id, target: node.id, type: "contains" as const, direction: "forward" as const, weight: 1 })),
      { source: selectedId, target: n1, type: "calls", direction: "forward", weight: 1 },
      { source: n2, target: selectedId, type: "calls", direction: "forward", weight: 1 },
      { source: selectedId, target: n3, type: "calls", direction: "forward", weight: 1 },
    ],
    layers: [{ id: "core", name: "核心模块", description: "大型作用域。", nodeIds: [file.id] }],
    tour: [],
  };
}

export function graphWithDenseSelection(edgeCount = 110): KnowledgeGraph {
  const selected = functionNode("function:dense:selected", "src/dense.ts", "selected", 1);
  const neighbors = Array.from({ length: edgeCount }, (_, index) => functionNode(`function:dense:n-${index}`, "src/dense.ts", `n${index}`, 10 + index * 5));
  return {
    version: "1.0.0",
    project: { name: "dense", languages: ["typescript"], frameworks: [], description: "密集选中夹具。", analyzedAt: GENERATED_AT, gitCommitHash: "fixture" },
    nodes: [selected, ...neighbors],
    edges: neighbors.map((node) => ({ source: selected.id, target: node.id, type: "calls" as const, direction: "forward" as const, weight: 1 })),
    layers: [{ id: "core", name: "核心模块", description: "密集关系作用域。", nodeIds: [selected.id, ...neighbors.map((node) => node.id)] }],
    tour: [],
  };
}

export function oneHopIds(graph: KnowledgeGraph, selectedId: string): string[] {
  const ids = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.source === selectedId) ids.add(edge.target);
    if (edge.target === selectedId) ids.add(edge.source);
  }
  return [...ids].sort();
}

export function graphWithImportsOnly(): KnowledgeGraph {
  const a = fileNode("file:src/a.ts", "src/a.ts");
  const b = fileNode("file:lib/b.ts", "lib/b.ts");
  return {
    version: "1.0.0",
    project: { name: "imports", languages: ["typescript"], frameworks: [], description: "导入夹具。", analyzedAt: GENERATED_AT, gitCommitHash: "fixture" },
    nodes: [a, b],
    edges: [{ source: a.id, target: b.id, type: "imports", direction: "forward", weight: 1 }],
    layers: [{ id: "app", name: "应用", description: "应用层。", nodeIds: [a.id] }, { id: "lib", name: "库", description: "库层。", nodeIds: [b.id] }],
    tour: [],
  };
}

export function graphWithStructuralOnly(): KnowledgeGraph {
  const file = fileNode("file:src/a.ts", "src/a.ts");
  const run = functionNode("function:src/a.ts:run", "src/a.ts", "run", 10);
  return {
    version: "1.0.0",
    project: { name: "structural", languages: ["typescript"], frameworks: [], description: "结构夹具。", analyzedAt: GENERATED_AT, gitCommitHash: "fixture" },
    nodes: [file, run],
    edges: [{ source: file.id, target: run.id, type: "contains", direction: "forward", weight: 1 }],
    layers: [{ id: "core", name: "核心模块", description: "结构层。", nodeIds: [file.id] }],
    tour: [],
  };
}
```

- [ ] **Step 2: Type-check the shared fixtures and commit**

```bash
pnpm --filter @understand-code/dashboard build
git add packages/dashboard/src/graphExplorer/__tests__/graphFixtures.ts
git commit -m "test(graph): add deterministic v2 fixtures"
```

Expected: PASS after Plans 1–2 are complete. Do not duplicate these fixtures inside later test files.

---

### Task 1: Derive graph documentation only from V2 node records

**Files:**
- Modify: `packages/dashboard/src/graphExplorer/semanticGraph.ts`
- Modify: `packages/dashboard/src/graphExplorer/__tests__/semanticGraph.test.ts`

**Interfaces:**
- Consumes: `WikiRuntimeIndex.nodeDocumentationById`, direct/context page maps, and exact evidence map.
- Produces: `SemanticGraphDocMetadataV2` with independent documentation dimensions.

- [ ] **Step 1: Write failing semantic metadata tests**

```ts
import { graphFixture, wikiRuntimeFixture } from "./graphFixtures";

const graph = buildSemanticGraphModel({ graph: graphFixture(), wikiIndex: wikiRuntimeFixture(), mode: "global", focusNodeIds: [] });
const run = graph.nodes.find((node) => node.id === "function:src/a.ts:run");
expect(run?.docs).toMatchObject({
  relation: "direct",
  quality: "generated",
  evidenceHealth: "source-linked",
  generationStatus: "complete",
  referenceCoverage: "anchored",
  directPageIds: ["page:run"],
  contextPageIds: ["page:overview"],
});
expect(run?.docs.evidence.map((item) => item.id)).toEqual(["evidence:run"]);
expect(run?.docs.contextPages.map((page) => page.id)).toEqual(["page:overview"]);
expect(run).not.toHaveProperty("coverage");
expect(run).not.toHaveProperty("wikiPageIds");
```

`wikiRuntimeFixture()` deliberately makes `page:overview` a context page for `run`, but its `evidence:overview-only` belongs only to `file:src/a.ts`. The final evidence assertion above therefore locks node-exact evidence behavior without another ad-hoc fixture.

Migrate every pre-existing test in `semanticGraph.test.ts` from V1 `buildWikiIndex`/gap expectations to `WikiRuntimeIndex` and the new docs fields in the same edit. Preserve tests for semantic grouping, focus neighborhood, and edge bundling; delete only assertions for fields removed by this task.

- [ ] **Step 2: Run and verify merged V1 semantics fail**

```bash
pnpm --filter @understand-code/dashboard exec vitest run src/graphExplorer/__tests__/semanticGraph.test.ts
```

Expected: FAIL because current `evidenceForNode` walks every related page and current docs merge page kinds.

- [ ] **Step 3: Replace semantic documentation metadata**

```ts
import type { WikiEvidenceV2, WikiPageV2 } from "@understand-code/core";
import type { WikiRuntimeIndex } from "../wiki/wikiIndex";

export interface DocumentationCounts {
  direct: number;
  context: number;
  none: number;
  problem: number;
  total: number;
}

export interface SemanticGraphDocMetadataV2 {
  relation: "direct" | "context" | "none";
  quality: "verified" | "generated" | "needs-review" | "failed";
  evidenceHealth: "source-linked" | "weak" | "unreadable" | "missing";
  generationStatus: "complete" | "partial" | "failed";
  referenceCoverage: "anchored" | "unanchored" | "not-applicable";
  primaryPageId?: string;
  anchor?: string;
  directPageIds: string[];
  contextPageIds: string[];
  directPages: WikiPageV2[];
  contextPages: WikiPageV2[];
  evidenceIds: string[];
  evidence: WikiEvidenceV2[];
}

function docsForNode(index: WikiRuntimeIndex | undefined, nodeId: string): SemanticGraphDocMetadataV2 {
  const record = index?.nodeDocumentationById.get(nodeId);
  const directPages = record
    ? record.directPageIds.map((pageId) => index?.pagesById.get(pageId)).filter((page): page is WikiPageV2 => Boolean(page))
    : [];
  const contextPages = record
    ? record.contextPageIds.map((pageId) => index?.pagesById.get(pageId)).filter((page): page is WikiPageV2 => Boolean(page))
    : [];
  const allowedEvidenceIds = new Set(record?.evidenceIds ?? []);
  const evidence = [...(index?.evidenceByNodeId.get(nodeId) ?? [])]
    .filter((item): item is WikiEvidenceV2 => item.nodeIds.includes(nodeId) && allowedEvidenceIds.has(item.id));
  return {
    relation: record?.relation ?? "none",
    quality: record?.quality ?? "needs-review",
    evidenceHealth: record?.evidenceHealth ?? "missing",
    generationStatus: record?.generationStatus ?? "partial",
    referenceCoverage: record?.referenceCoverage ?? "unanchored",
    ...(record?.primaryPageId ? { primaryPageId: record.primaryPageId } : {}),
    ...(record?.anchor ? { anchor: record.anchor } : {}),
    directPageIds: directPages.map((page) => page.id),
    contextPageIds: contextPages.map((page) => page.id),
    directPages,
    contextPages,
    evidenceIds: evidence.map((item) => item.id),
    evidence,
  };
}
```

Use `record.directPageIds`/`contextPageIds` to preserve the V2 contract order and `pagesById` to resolve records. Do not infer a direct relation from a page map. When no node-documentation record exists, return the explicit defaults shown above and empty page/evidence arrays.

Delete `WikiCoverageResult`, `WikiGapRecord`, `coverageForNode`, `pagesForNode`, `evidenceForPage`, `coverage`, `wikiPageIds`, and gap fields from `semanticGraph.ts`. Replace the current `SemanticGraphNode.docs: SemanticGraphDocMetadata` with `SemanticGraphDocMetadataV2` and add `documentationCounts?: DocumentationCounts`; keep semantic grouping and edge bundling unchanged. Compilation errors in consumers are expected until Tasks 2–3 update them—do not add V1 aliases to silence them.

In `allowedNodeForMode`, make both `coverage` and the temporarily normalized legacy `evidence` mode return `true`. Nodes with no V2 record must remain visible as `relation: "none"`; do not filter coverage by the presence of metadata. Remove the now-unused `wikiIndex` parameter from this helper and its call site. Plan 4 removes the legacy mode name.

- [ ] **Step 4: Run tests and commit**

```bash
pnpm --filter @understand-code/dashboard exec vitest run src/graphExplorer/__tests__/semanticGraph.test.ts
git add packages/dashboard/src/graphExplorer/semanticGraph.ts \
  packages/dashboard/src/graphExplorer/__tests__/semanticGraph.test.ts
git commit -m "feat(graph): consume precise wiki metadata"
```

Expected: PASS.

---

### Task 2: Replace aggregate gap vetoes and pin selection context

**Files:**
- Modify: `packages/dashboard/src/graphExplorer/hierarchicalGraph.ts`
- Modify: `packages/dashboard/src/graphExplorer/__tests__/hierarchicalGraph.test.ts`

**Interfaces:**
- Adds `selectedNodeId: string | null` to `BuildHierarchicalGraphInput`.
- Produces aggregate `documentationCounts` and ratio badges.
- Guarantees selected + one-hop nodes beyond `MAX_SCOPE_NODES`/`MAX_FILE_NODES`.

- [ ] **Step 1: Write failing coverage and large-scope tests**

```ts
import {
  aggregateCoverageFixture,
  graphFixture,
  graphWithFiftyNodes,
  graphWithDenseSelection,
  graphWithFiftyNodes,
  oneHopIds,
} from "./graphFixtures";

const coverage = aggregateCoverageFixture();
const overview = buildHierarchicalSemanticGraph({ graph: coverage.graph, wikiIndex: coverage.wikiIndex, mode: "architecture", focusNodeIds: [], selectedNodeId: null, navigation: { level: "overview" } });
expect(overview.nodes[0].documentationCounts).toEqual({ direct: 8, context: 1, none: 1, problem: 0, total: 10 });
expect(overview.nodes[0].docs.relation).toBe("direct");

const selected = "function:src/large.ts:selected";
const largeGraph = graphWithFiftyNodes(selected);
const largeOverview = buildHierarchicalSemanticGraph({ graph: largeGraph, mode: "architecture", focusNodeIds: [], selectedNodeId: null, navigation: { level: "overview" } });
expect(largeOverview.nodes[0].documentationCounts?.total).toBe(1);
const largeCoverageOverview = buildHierarchicalSemanticGraph({ graph: largeGraph, mode: "coverage", focusNodeIds: [], selectedNodeId: null, navigation: { level: "overview" } });
expect(largeCoverageOverview.nodes[0].documentationCounts?.total).toBe(50);
const detail = buildHierarchicalSemanticGraph({ graph: largeGraph, mode: "call", focusNodeIds: [], selectedNodeId: selected, navigation: { level: "scope", scopeId: "layer:core" } });
const ids = new Set(detail.nodes.map((node) => node.id));
expect(ids.has(selected)).toBe(true);
for (const neighbor of oneHopIds(largeGraph, selected)) expect(ids.has(neighbor)).toBe(true);
for (const edge of detail.edges.filter((edge) => edge.source === selected || edge.target === selected)) {
  expect(ids.has(edge.source) && ids.has(edge.target)).toBe(true);
}
expect(detail.presentation.hiddenNodeCount).toBe(largeGraph.nodes.length - detail.nodes.length);

const denseGraph = graphWithDenseSelection(110);
const dense = buildHierarchicalSemanticGraph({ graph: denseGraph, mode: "call", focusNodeIds: [], selectedNodeId: "function:dense:selected", navigation: { level: "scope", scopeId: "layer:core" } });
expect(dense.nodes).toHaveLength(111);
expect(dense.edges).toHaveLength(110);
expect(dense.edges.every((edge) => edge.source === "function:dense:selected" || edge.target === "function:dense:selected")).toBe(true);
```

- [ ] **Step 2: Run and verify current veto/cap behavior fails**

```bash
pnpm --filter @understand-code/dashboard exec vitest run src/graphExplorer/__tests__/hierarchicalGraph.test.ts
```

Expected: FAIL because `scopeCoverage` returns gap when any child has a gap and ranking ignores selection.

- [ ] **Step 3: Add explicit aggregate counts**

```ts
function documentationSubjects(nodes: SemanticGraphNode[], mode: GraphExplorerDisplayMode): SemanticGraphNode[] {
  if (mode === "coverage") return nodes;
  const keyObjects = nodes.filter((node) => (
    node.group !== "symbol"
    || node.docs.directPages.some((page) => page.role === "featured")
  ));
  return keyObjects.length > 0 ? keyObjects : nodes;
}

export function hasDocumentationProblem(docs: SemanticGraphDocMetadataV2): boolean {
  const documentedWithoutEvidence = docs.relation !== "none" && docs.evidenceHealth === "missing";
  return docs.quality === "failed"
    || docs.generationStatus === "failed"
    || docs.evidenceHealth === "unreadable"
    || documentedWithoutEvidence;
}

function documentationCounts(nodes: SemanticGraphNode[]): DocumentationCounts {
  return nodes.reduce((counts, node) => {
    counts[node.docs.relation] += 1;
    if (hasDocumentationProblem(node.docs)) counts.problem += 1;
    counts.total += 1;
    return counts;
  }, { direct: 0, context: 0, none: 0, problem: 0, total: 0 });
}
```

Call `documentationCounts(documentationSubjects(children, displayMode))` for every scope/boundary aggregate. Architecture and relationship views therefore count files/architecture objects plus symbols promoted by a featured direct page, not every helper function. Coverage mode intentionally counts every child. The fallback to all nodes handles unusual symbol-only layers.

The three relation counts are mutually exclusive. `problem` is an independent overlay: a node with a direct page and unreadable evidence contributes to both `direct` and `problem`. A `relation: "none"` node with `evidenceHealth: "missing"` is only `none`, because it has no published claim that promises evidence.

Import `DocumentationCounts` from `semanticGraph.ts` and add required `documentationCounts` to `GraphScopeOption`. Replace `scopeCoverage` with `aggregateDocumentation` that:

1. unions direct pages, context pages, and exact evidence by ID;
2. sets aggregate `relation` to `direct` when `counts.direct > 0`, otherwise `context` when `counts.context > 0`, otherwise `none`;
3. uses the first child `primaryPageId` whose ID belongs to the unioned direct pages;
4. sets aggregate quality/generation/evidence fields only as summary metadata: `failed`/`unreadable`/`failed` only when every documented child has that state, otherwise `needs-review`/`weak`/`partial`; and
5. returns `documentationCounts` separately. Cards and legends must use the counts, never the aggregate scalar quality as a red-veto status.

Implement those rules literally:

```ts
function aggregateDocumentation(nodes: SemanticGraphNode[], displayMode: GraphExplorerDisplayMode): {
  docs: SemanticGraphDocMetadataV2;
  documentationCounts: DocumentationCounts;
} {
  const subjects = documentationSubjects(nodes, displayMode);
  const counts = documentationCounts(subjects);
  const directPages = uniqueById(subjects.flatMap((node) => node.docs.directPages));
  const directPageIds = new Set(directPages.map((page) => page.id));
  const contextPages = uniqueById(subjects.flatMap((node) => node.docs.contextPages)).filter((page) => !directPageIds.has(page.id));
  const evidence = uniqueById(subjects.flatMap((node) => node.docs.evidence));
  const documented = subjects.filter((node) => node.docs.relation !== "none");
  const primaryPageId = subjects
    .map((node) => node.docs.primaryPageId)
    .find((pageId): pageId is string => Boolean(pageId && directPageIds.has(pageId)));
  const relation = counts.direct > 0 ? "direct" : counts.context > 0 ? "context" : "none";
  return {
    documentationCounts: counts,
    docs: {
      relation,
      quality: documented.length > 0 && documented.every((node) => node.docs.quality === "failed") ? "failed" : "needs-review",
      evidenceHealth: documented.length > 0 && documented.every((node) => node.docs.evidenceHealth === "unreadable")
        ? "unreadable"
        : evidence.length > 0 ? "weak" : "missing",
      generationStatus: documented.length > 0 && documented.every((node) => node.docs.generationStatus === "failed") ? "failed" : "partial",
      referenceCoverage: subjects.length > 0 && subjects.every((node) => node.docs.referenceCoverage === "anchored")
        ? "anchored"
        : subjects.length > 0 && subjects.every((node) => node.docs.referenceCoverage === "not-applicable") ? "not-applicable" : "unanchored",
      ...(primaryPageId ? { primaryPageId } : {}),
      directPageIds: directPages.map((page) => page.id),
      contextPageIds: contextPages.map((page) => page.id),
      directPages,
      contextPages,
      evidenceIds: evidence.map((item) => item.id),
      evidence,
    },
  };
}
```

`uniqueById` is the existing stable first-seen helper. Aggregate docs intentionally do not claim `verified`, `generated`, `source-linked`, or `complete`; those claims belong to individual nodes/pages. The details rail displays the independent counts and child records.

Pass `displayMode` into `scopeOptions` and `scopeNode`, so both the dropdown counts and rendered aggregate use the same subject set. Remove every `coveredCount`, `gapCount`, `WikiCoverageResult`, and `coverage.status` branch from `GraphScopeOption`, `scopeOptions`, `scopeNode`, and `rankedNodes`. Ranking may add `+2` for `docs.relation === "direct"`, `+1` for `context`, and `+0` for `none`; it must not rank a failed page above a valid direct page.

Replace the V1 coverage branch in `nodeAllowed` with `if (mode === "coverage") return true;`. Coverage mode relies on V2 `docs.relation`/problem state for badges and must not filter out `relation: "none"` nodes—the point of that view is to make them inspectable.

- [ ] **Step 4: Pin selection and one-hop context before ordinary ranking**

```ts
function pinnedNodeIds(selectedNodeId: string | null, candidates: SemanticGraphNode[], members: SemanticGraphEdgeMember[]): Set<string> {
  const candidateIds = new Set(candidates.map((node) => node.id));
  const pinned = new Set<string>();
  if (!selectedNodeId || !candidateIds.has(selectedNodeId)) return pinned;
  pinned.add(selectedNodeId);
  for (const member of members) {
    if (member.source === selectedNodeId && candidateIds.has(member.target)) pinned.add(member.target);
    if (member.target === selectedNodeId && candidateIds.has(member.source)) pinned.add(member.source);
  }
  return pinned;
}

function rankedNodes(nodes: SemanticGraphNode[], members: SemanticGraphEdgeMember[], limit: number, selectedNodeId: string | null): SemanticGraphNode[] {
  const pinned = pinnedNodeIds(selectedNodeId, nodes, members);
  const degree = degreeByNode(members);
  const sortByRank = (a: SemanticGraphNode, b: SemanticGraphNode): number => {
    const relationScore = (node: SemanticGraphNode) => node.docs.relation === "direct" ? 2 : node.docs.relation === "context" ? 1 : 0;
    const problemOrder = Number(hasDocumentationProblem(a.docs)) - Number(hasDocumentationProblem(b.docs));
    if (problemOrder !== 0) return problemOrder;
    const aScore = a.importance * 10 + (degree.get(a.id) ?? 0) + relationScore(a);
    const bScore = b.importance * 10 + (degree.get(b.id) ?? 0) + relationScore(b);
    return bScore - aScore || a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
  };
  const selected = nodes.filter((node) => node.id === selectedNodeId);
  const neighbors = nodes.filter((node) => node.id !== selectedNodeId && pinned.has(node.id)).sort(sortByRank);
  const required = [...selected, ...neighbors];
  const remaining = nodes.filter((node) => !pinned.has(node.id)).sort(sortByRank);
  return [...required, ...remaining.slice(0, Math.max(0, limit - required.length))];
}
```

Call this function with the already mode-filtered `allowedMembers`, so “one hop” means one visible relationship in the current mode. If pinned context exceeds the ordinary cap, allow the result to exceed the cap; selection correctness wins. Pass `selectedNodeId` through `buildHierarchicalSemanticGraph` into both `buildScopeDetail` and `buildFileDetail`.

Apply the same retention rule to aggregate caps:

- `buildOverview`: if `selectedNodeId` is `scope:${scope.id}`, include that scope even when it falls after `MAX_OVERVIEW_SCOPES`.
- `buildScopeDetail`: if `selectedNodeId` is `boundary:${scope.id}`, include that boundary even when it falls after `MAX_BOUNDARY_SCOPES`.
- `bundleMembers(members, selectedNodeId)`: sort incident bundles first and include every incident bundle before applying `MAX_VISIBLE_EDGES` to unrelated bundles. If selected bundles alone exceed the cap, return all selected bundles.

Calculate `hiddenNodeCount` as `Math.max(0, totalCandidateCount - visibleRawCandidateCount)`; boundary portals are not hidden raw candidates and must not make the value negative.

- [ ] **Step 5: Test and commit**

```bash
pnpm --filter @understand-code/dashboard exec vitest run src/graphExplorer/__tests__/hierarchicalGraph.test.ts
git add packages/dashboard/src/graphExplorer/hierarchicalGraph.ts \
  packages/dashboard/src/graphExplorer/__tests__/hierarchicalGraph.test.ts
git commit -m "fix(graph): preserve selected context and coverage ratios"
```

---

### Task 3: Support scope/boundary details and truthful modes

**Files:**
- Modify: `packages/dashboard/src/components/graphExplorer/graphExplorerModel.ts`
- Modify: `packages/dashboard/src/components/graphExplorer/__tests__/graphExplorerModel.test.ts`
- Modify: `packages/dashboard/src/components/graphExplorer/GraphDetailsRail.tsx`
- Modify: `packages/dashboard/src/components/graphExplorer/GraphCoverageLegend.tsx`
- Modify: `packages/dashboard/src/components/graphExplorer/GraphModeToolbar.tsx`
- Modify: `packages/dashboard/src/components/graphExplorer/GraphExplorer.tsx`
- Modify: `packages/dashboard/src/components/graphExplorer/SemanticGraphCanvas.tsx`

**Interfaces:**
- Produces discriminated `GraphSelectionDetails = raw | aggregate | boundary`.
- Produces `availableGraphModes(graph, wikiIndex)` from actual calls/imports/V2 metadata; structural dependencies remain part of architecture instead of becoming a duplicate tab.

- [ ] **Step 1: Write failing aggregate-detail and mode tests**

```ts
import {
  aggregateCoverageFixture,
  graphWithImportsOnly,
  graphWithStructuralOnly,
  wikiRuntimeFixture,
} from "../../../graphExplorer/__tests__/graphFixtures";
import { buildSemanticGraphModel } from "../../../graphExplorer/semanticGraph";
import { buildWikiRuntimeIndex } from "../../../wiki/wikiIndex";

const fixture = aggregateCoverageFixture();
const wikiForModes = wikiRuntimeFixture();
const semanticGraph = buildHierarchicalSemanticGraph({ graph: fixture.graph, wikiIndex: fixture.wikiIndex, mode: "architecture", focusNodeIds: [], selectedNodeId: "scope:layer:core", navigation: { level: "overview" } });
expect(buildGraphSelectionDetails({ graph: fixture.graph, semanticGraph, selectedObjectId: "scope:layer:core" })).toMatchObject({
  kind: "aggregate",
  id: "scope:layer:core",
  responsibility: expect.stringContaining("核心"),
  documentationCounts: { direct: 8, context: 1, none: 1, problem: 0, total: 10 },
});

expect(availableGraphModes(graphWithImportsOnly(), wikiForModes).map(({ id, label }) => ({ id, label }))).toEqual([
  { id: "architecture", label: "架构总览" },
  { id: "call", label: "文件依赖" },
  { id: "coverage", label: "文档覆盖" },
]);
expect(availableGraphModes(graphWithStructuralOnly(), wikiForModes).map(({ id, label }) => ({ id, label }))).toEqual([
  { id: "architecture", label: "架构总览" },
  { id: "coverage", label: "文档覆盖" },
]);
expect(availableGraphModes(graphWithStructuralOnly(), buildWikiRuntimeIndex(null)).map(({ id }) => id)).toEqual(["architecture"]);
expect(availableGraphModes(graphWithFiftyNodes(), buildWikiRuntimeIndex(null)).map(({ id, label }) => ({ id, label }))).toEqual([
  { id: "architecture", label: "架构总览" },
  { id: "call", label: "调用关系" },
]);

expect(coverageBadgeForNode(semanticGraph.nodes[0])).toEqual({ label: "8/10 有正文", relation: "direct", problem: false });
const rawSemantic = buildSemanticGraphModel({ graph: graphFixture(), wikiIndex: wikiForModes, mode: "global", focusNodeIds: [] });
expect(coverageBadgeForNode(rawSemantic.nodes.find((node) => node.id === "function:src/a.ts:run")!)).toEqual({ label: "有专门正文", relation: "direct", problem: false });
expect(coverageBadgeForNode(rawSemantic.nodes.find((node) => node.id === "file:context-only.ts")!)).toEqual({ label: "仅相关资料", relation: "context", problem: false });
expect(directionalEndpointPairs({ source: "a", target: "b", directions: ["backward"] })).toEqual([{ source: "b", target: "a" }]);
expect(directionalEndpointPairs({ source: "a", target: "b", directions: ["bidirectional"] })).toEqual([{ source: "a", target: "b" }, { source: "b", target: "a" }]);
```

- [ ] **Step 2: Run and verify raw-only detail behavior fails**

```bash
pnpm --filter @understand-code/dashboard exec vitest run src/components/graphExplorer/__tests__/graphExplorerModel.test.ts
```

Expected: FAIL because current details require both a raw graph node and semantic node.

Migrate the existing raw-node, hidden-selection, and focus tests in `graphExplorerModel.test.ts` to `graphFixture()`/`wikiRuntimeFixture()`. Replace assertions on `selectedCoverage`, merged `selectedPages`, and `canOpenWiki` with assertions on `selection.kind`, `directPages`, `contextPages`, `evidence`, and `primaryDirectPageId`.

- [ ] **Step 3: Implement the discriminated details model**

```ts
export interface SelectionDetailsInput {
  graph: KnowledgeGraph;
  semanticGraph: SemanticGraph;
  selectedObjectId: string | null;
}

export type GraphSelectionDetails =
  | {
      kind: "raw";
      id: string;
      node: GraphNode;
      semantic: SemanticGraphNode;
      upstream: SemanticGraphNode[];
      downstream: SemanticGraphNode[];
      directPages: WikiPageV2[];
      contextPages: WikiPageV2[];
      evidence: WikiEvidenceV2[];
      primaryDirectPageId: string | null;
      drillTarget: { kind: "file"; scopeId: string; fileId: string } | null;
    }
  | {
      kind: "aggregate" | "boundary";
      id: string;
      node: SemanticGraphNode;
      responsibility: string;
      documentationCounts: DocumentationCounts;
      upstream: SemanticGraphNode[];
      downstream: SemanticGraphNode[];
      directPages: WikiPageV2[];
      contextPages: WikiPageV2[];
      evidence: WikiEvidenceV2[];
      primaryDirectPageId: string | null;
      drillTarget: { kind: "scope"; scopeId: string } | null;
    };

export function buildGraphSelectionDetails(input: SelectionDetailsInput): GraphSelectionDetails | null {
  if (!input.selectedObjectId) return null;
  const semantic = input.semanticGraph.nodes.find((node) => node.id === input.selectedObjectId);
  if (!semantic) return null;
  const raw = input.graph.nodes.find((node) => node.id === semantic.id);
  const upstream = adjacentNodes(input.semanticGraph, semantic.id, "incoming");
  const downstream = adjacentNodes(input.semanticGraph, semantic.id, "outgoing");
  const primaryDirectPageId = semantic.docs.primaryPageId && semantic.docs.directPageIds.includes(semantic.docs.primaryPageId)
    ? semantic.docs.primaryPageId
    : semantic.docs.directPageIds[0] ?? null;
  if (raw) return {
    kind: "raw",
    id: raw.id,
    node: raw,
    semantic,
    upstream,
    downstream,
    directPages: semantic.docs.directPages,
    contextPages: semantic.docs.contextPages,
    evidence: semantic.docs.evidence,
    primaryDirectPageId,
    drillTarget: semantic.canDrillDown && semantic.scopeId ? { kind: "file", scopeId: semantic.scopeId, fileId: semantic.id } : null,
  };
  return {
    kind: semantic.kind === "boundary" ? "boundary" : "aggregate",
    id: semantic.id,
    node: semantic,
    responsibility: semantic.summary,
    documentationCounts: semantic.documentationCounts ?? { direct: 0, context: 0, none: 0, problem: 0, total: 0 },
    upstream,
    downstream,
    directPages: semantic.docs.directPages,
    contextPages: semantic.docs.contextPages,
    evidence: semantic.docs.evidence,
    primaryDirectPageId,
    drillTarget: semantic.canDrillDown && semantic.scopeId ? { kind: "scope", scopeId: semantic.scopeId } : null,
  };
}
```

Implement direction-aware adjacency as pure helpers:

```ts
export function directionalEndpointPairs(
  edge: Pick<SemanticGraphEdge, "source" | "target" | "directions">,
): Array<{ source: string; target: string }> {
  const directions = new Set(edge.directions);
  if (directions.has("bidirectional") || (directions.has("forward") && directions.has("backward"))) {
    return [{ source: edge.source, target: edge.target }, { source: edge.target, target: edge.source }];
  }
  return directions.has("backward")
    ? [{ source: edge.target, target: edge.source }]
    : [{ source: edge.source, target: edge.target }];
}

function adjacentNodes(graph: SemanticGraph, id: string, direction: "incoming" | "outgoing"): SemanticGraphNode[] {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const result: SemanticGraphNode[] = [];
  for (const edge of graph.edges) {
    for (const endpoints of directionalEndpointPairs(edge)) {
      const relatedId = direction === "incoming" && endpoints.target === id
        ? endpoints.source
        : direction === "outgoing" && endpoints.source === id ? endpoints.target : null;
      const node = relatedId ? nodesById.get(relatedId) : undefined;
      if (!node || seen.has(node.id)) continue;
      seen.add(node.id);
      result.push(node);
    }
  }
  return result;
}
```

Export the badge model used by `SemanticNodeCard`:

```ts
const RELATION_LABELS = { direct: "有专门正文", context: "仅相关资料", none: "待补正文" } as const;

export function coverageBadgeForNode(node: SemanticGraphNode): { label: string; relation: SemanticGraphDocMetadataV2["relation"]; problem: boolean } {
  return {
    label: node.documentationCounts
      ? `${node.documentationCounts.direct}/${node.documentationCounts.total} 有正文`
      : RELATION_LABELS[node.docs.relation],
    relation: node.docs.relation,
    problem: node.documentationCounts ? node.documentationCounts.problem > 0 : hasDocumentationProblem(node.docs),
  };
}
```

`SemanticGraphCanvas` consumes this model; it must not independently infer badges from page counts, evidence counts, or colors.

Replace `selectedNode`, `selectedCoverage`, `selectedPages`, and `canOpenWiki` in `GraphExplorerView` with `selection: GraphSelectionDetails | null` plus the existing hidden-raw-node fallback. Aggregate and boundary selections must not require a corresponding raw `GraphNode`.

Implement mode derivation exactly:

```ts
export interface GraphModeOption {
  id: GraphExplorerDisplayMode;
  label: string;
  relationshipSource: "calls" | "imports" | null;
}

export function availableGraphModes(graph: KnowledgeGraph, wikiIndex: WikiRuntimeIndex): GraphModeOption[] {
  const options: GraphModeOption[] = [{ id: "architecture", label: "架构总览", relationshipSource: null }];
  if (graph.edges.some((edge) => edge.type === "calls")) {
    options.push({ id: "call", label: "调用关系", relationshipSource: "calls" });
  } else if (graph.edges.some((edge) => edge.type === "imports")) {
    options.push({ id: "call", label: "文件依赖", relationshipSource: "imports" });
  }
  if (graph.nodes.some((node) => wikiIndex.nodeDocumentationById.has(node.id))) {
    options.push({ id: "coverage", label: "文档覆盖", relationshipSource: null });
  }
  return options;
}
```

If the stored mode is absent from `availableGraphModes`, render `architecture` and write that normalized value back once in `GraphExplorer`; do not show a generic “结构依赖” relationship tab. `memberAllowed` may continue using structural edges inside architecture.

Change `GraphModeToolbarProps` to accept `options: readonly GraphModeOption[]` and render only those options; remove its internal hard-coded three-mode array and `callModeLabel`. `GraphExplorer` computes the options once from `graph` and `wikiIndex`, derives `effectiveMode`, passes it to both the hierarchical model and toolbar, and performs the one-time store normalization in an effect keyed by `effectiveMode`/`storedMode`.

- [ ] **Step 4: Render details and mode labels**

`GraphDetailsRail` renders responsibility/summary, upstream/downstream, direct pages, context pages, exact evidence, coverage ratios, and explicit drill/open-Wiki actions for every union member. Do not invent entry/output fields when the graph has no such metadata. Pass `onOpenScope`, `onOpenFile`, and `onOpenWikiPage` callbacks from `GraphExplorer`; invoke them only from `selection.drillTarget` or `selection.primaryDirectPageId`. Implement `onOpenWikiPage(pageId)` by calling Plan 2's `openWikiTarget({ pageId, anchor: null })`, so page navigation retains the shared hash/pending-anchor semantics.

Every upstream/downstream row whose node exists in `semanticGraph.nodes` is selectable, including `scope` and `boundary`; remove the current `related.kind === "node"` gate. A missing endpoint remains non-actionable diagnostic text.

Render V2 evidence from `evidenceType`, `filePath`, `lineRange`, and optional `excerpt`; V2 has no `label` field. Map evidence types to `生产代码`, `配置`, `测试`, and `文档`. Direct pages appear under `专门正文`; context pages appear under `相关资料` and never enable the primary “阅读正文” action.

`GraphCoverageLegend` uses `有专门正文`, `仅相关资料`, `待补正文`, and `生成或证据异常`. `SemanticNodeCard` always keeps semantic group color as its main accent. In architecture/call mode it shows one compact badge: `${direct}/${total} 有正文` for aggregates, otherwise the raw relation label. If `hasDocumentationProblem(node.docs)` is true, add a separate warning dot with accessible text `生成或证据异常`; do not replace the relation badge. In coverage mode it may additionally show context/none/problem counts. Never set full-card background or border from documentation state.

Hide the call/dependency tab when it duplicates architecture. Delete `fallbackNotice` and set `presentation.notice` to `null`; the mode itself is selected from observed edges, so no automatic-fallback banner is necessary. The label `文件依赖` is allowed only when real `imports` edges exist.

- [ ] **Step 5: Test, build, and commit**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/components/graphExplorer/__tests__/graphExplorerModel.test.ts \
  src/graphExplorer/__tests__/hierarchicalGraph.test.ts
pnpm --filter @understand-code/dashboard build
git add packages/dashboard/src/components/graphExplorer/graphExplorerModel.ts \
  packages/dashboard/src/components/graphExplorer/__tests__/graphExplorerModel.test.ts \
  packages/dashboard/src/components/graphExplorer/GraphDetailsRail.tsx \
  packages/dashboard/src/components/graphExplorer/GraphCoverageLegend.tsx \
  packages/dashboard/src/components/graphExplorer/GraphModeToolbar.tsx \
  packages/dashboard/src/components/graphExplorer/GraphExplorer.tsx \
  packages/dashboard/src/components/graphExplorer/SemanticGraphCanvas.tsx
git commit -m "feat(graph): explain every graph level"
```

---

### Task 4: Extract the original selection presentation and flowing edge

**Files:**
- Modify: `packages/dashboard/src/graphExplorer/__tests__/graphFixtures.ts`
- Create: `packages/dashboard/src/graphExplorer/selectionPresentation.ts`
- Create: `packages/dashboard/src/graphExplorer/__tests__/selectionPresentation.test.ts`
- Create: `packages/dashboard/src/hooks/useReducedMotion.ts`
- Create: `packages/dashboard/src/hooks/__tests__/useReducedMotion.test.ts`
- Create: `packages/dashboard/src/components/graphExplorer/FlowingSemanticEdge.tsx`
- Create: `packages/dashboard/src/components/graphExplorer/__tests__/FlowingSemanticEdge.test.ts`
- Modify: `packages/dashboard/src/components/graphExplorer/SemanticGraphCanvas.tsx`
- Modify: `packages/dashboard/src/index.css`

**Interfaces:**
- Produces: `buildSelectionPresentation(graph, selectedId, reducedMotion)` with selected/neighbor/dimmed node state and connected/unrelated edge state.
- Produces: `resolveFlowDirection(edge)` as `forward | reverse | both` from V2 semantic edge directions.
- Produces custom edge type `flowing-semantic` with directional motion or a center direction mark.

- [ ] **Step 1: Extend the shared fixture with a complete semantic selection graph**

Append this fixture to `graphFixtures.ts` after importing `SemanticGraph`, `SemanticGraphDocMetadataV2`, and `SemanticGraphNode` from `../semanticGraph`:

```ts
function emptySemanticDocs(): SemanticGraphDocMetadataV2 {
  return {
    relation: "none",
    quality: "needs-review",
    evidenceHealth: "missing",
    generationStatus: "partial",
    referenceCoverage: "unanchored",
    directPageIds: [],
    contextPageIds: [],
    directPages: [],
    contextPages: [],
    evidenceIds: [],
    evidence: [],
  };
}

function scopeSemanticNode(scopeId: string, label: string): SemanticGraphNode {
  return {
    id: `scope:layer:${scopeId}`,
    kind: "scope",
    label,
    group: "module",
    category: "module",
    cluster: label,
    importance: 0.85,
    rawType: "module",
    summary: `${label}的职责。`,
    docs: emptySemanticDocs(),
    scopeId: `layer:${scopeId}`,
    containedNodeIds: [],
    childCount: 0,
    fileCount: 0,
    relationCount: 1,
    canDrillDown: true,
    documentationCounts: { direct: 0, context: 0, none: 0, problem: 0, total: 0 },
  };
}

export function semanticSelectionFixture(): SemanticGraph {
  const nodes = [
    scopeSemanticNode("core", "核心模块"),
    scopeSemanticNode("api", "接口模块"),
    scopeSemanticNode("data", "数据模块"),
    scopeSemanticNode("unrelated", "无关模块"),
  ];
  const edge = (
    source: string,
    target: string,
    direction: "forward" | "backward" | "bidirectional",
  ): SemanticGraph["edges"][number] => ({
    id: `${source}->${target}`,
    source,
    target,
    type: "depends_on",
    direction,
    edgeTypes: ["depends_on"],
    directions: [direction],
    weight: 1,
    bundledCount: 1,
    members: [{ id: `${source}->${target}:0`, source, target, type: "depends_on", direction, weight: 1 }],
  });
  return {
    nodes,
    edges: [
      edge("scope:layer:api", "scope:layer:core", "forward"),
      edge("scope:layer:core", "scope:layer:data", "backward"),
      edge("scope:layer:unrelated", "scope:layer:data", "bidirectional"),
    ],
  };
}
```

- [ ] **Step 2: Write failing presentation tests**

```ts
import { semanticSelectionFixture } from "./graphFixtures";

const semantic = semanticSelectionFixture();
const selectedId = "scope:layer:core";
const view = buildSelectionPresentation(semantic, selectedId, false);
expect(view.nodesById.get(selectedId)).toEqual({ selected: true, neighbor: false, dimmed: false, opacity: 1 });
expect(view.nodesById.get("scope:layer:api")).toEqual({ selected: false, neighbor: true, dimmed: false, opacity: 1 });
expect(view.nodesById.get("scope:layer:data")).toEqual({ selected: false, neighbor: true, dimmed: false, opacity: 1 });
expect(view.nodesById.get("scope:layer:unrelated")).toEqual({ selected: false, neighbor: false, dimmed: true, opacity: 0.2 });
expect(view.edgesById.get("scope:layer:api->scope:layer:core")).toMatchObject({ connected: true, animated: true, inlineDirection: false, opacity: 0.95, flowDirection: "forward" });
expect(view.edgesById.get("scope:layer:core->scope:layer:data")).toMatchObject({ connected: true, animated: true, flowDirection: "reverse" });
expect(view.edgesById.get("scope:layer:unrelated->scope:layer:data")).toEqual({ connected: false, animated: false, inlineDirection: false, opacity: 0.16, strokeWidth: 1, flowDirection: "both" });

const reduced = buildSelectionPresentation(semantic, selectedId, true);
expect(reduced.edgesById.get("scope:layer:api->scope:layer:core")).toMatchObject({ animated: false, inlineDirection: true, flowDirection: "forward" });
expect(reduced.edgesById.get("scope:layer:core->scope:layer:data")).toMatchObject({ animated: false, inlineDirection: true, flowDirection: "reverse" });
```

- [ ] **Step 3: Run and verify missing helper**

```bash
pnpm --filter @understand-code/dashboard exec vitest run src/graphExplorer/__tests__/selectionPresentation.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement presentation independent of React Flow**

```ts
export type FlowDirection = "forward" | "reverse" | "both";

export interface NodeSelectionPresentation {
  selected: boolean;
  neighbor: boolean;
  dimmed: boolean;
  opacity: number;
}

export interface EdgeSelectionPresentation {
  connected: boolean;
  animated: boolean;
  inlineDirection: boolean;
  opacity: number;
  strokeWidth: number;
  flowDirection: FlowDirection;
}

export interface SelectionPresentation {
  nodesById: ReadonlyMap<string, NodeSelectionPresentation>;
  edgesById: ReadonlyMap<string, EdgeSelectionPresentation>;
}

export function resolveFlowDirection(edge: SemanticGraphEdge): FlowDirection {
  const directions = new Set(edge.directions);
  if (directions.has("bidirectional") || (directions.has("forward") && directions.has("backward"))) return "both";
  return directions.has("backward") ? "reverse" : "forward";
}

export function buildSelectionPresentation(graph: SemanticGraph, selectedId: string | null, reducedMotion: boolean): SelectionPresentation {
  const neighbors = new Set<string>();
  if (selectedId) {
    neighbors.add(selectedId);
    for (const edge of graph.edges) {
      if (edge.source === selectedId) neighbors.add(edge.target);
      if (edge.target === selectedId) neighbors.add(edge.source);
    }
  }
  return {
    nodesById: new Map(graph.nodes.map((node) => [node.id, {
      selected: node.id === selectedId,
      neighbor: Boolean(selectedId) && node.id !== selectedId && neighbors.has(node.id),
      dimmed: Boolean(selectedId) && !neighbors.has(node.id),
      opacity: Boolean(selectedId) && !neighbors.has(node.id) ? 0.2 : 1,
    }])),
    edgesById: new Map(graph.edges.map((edge) => {
      const connected = Boolean(selectedId) && (edge.source === selectedId || edge.target === selectedId);
      const baseWidth = Math.min(1.25 + Math.log2(edge.bundledCount + 1) * 0.55, 4);
      return [edge.id, {
        connected,
        animated: connected && !reducedMotion,
        inlineDirection: connected && reducedMotion,
        opacity: selectedId ? connected ? 0.95 : 0.16 : 0.62,
        strokeWidth: selectedId ? connected ? Math.max(2.8, baseWidth + 0.8) : 1 : baseWidth,
        flowDirection: resolveFlowDirection(edge),
      }];
    })),
  };
}
```

This is the only selection-style algorithm used by the new canvas. Do not copy the old `GraphView` gold constants or maintain a second edge-focus branch inside `SemanticGraphCanvas`.

- [ ] **Step 5: Implement and test reduced-motion subscription**

`useReducedMotion.ts` exports both the hook and an injectable observer:

```ts
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type MatchMediaLike = (query: string) => Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">;

export function observeReducedMotion(matchMedia: MatchMediaLike, notify: (reduced: boolean) => void): () => void {
  const media = matchMedia(REDUCED_MOTION_QUERY);
  const onChange = (event: MediaQueryListEvent) => notify(event.matches);
  notify(media.matches);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    return observeReducedMotion(window.matchMedia.bind(window), setReduced);
  }, []);
  return reduced;
}
```

In `hooks/__tests__/useReducedMotion.test.ts`, create a fake object that captures the `change` listener, begins with `matches: true`, then invokes the listener with `{ matches: false } as MediaQueryListEvent`. Assert notifications are `[true, false]`, the exact query is used, and cleanup removes the same listener. This test runs in the existing Node Vitest environment and does not require a DOM hook library.

- [ ] **Step 6: Implement and test the custom edge**

`FlowingSemanticEdge` uses `getSmoothStepPath`, matching the current canvas routing. Define its data contract explicitly:

```ts
export interface FlowingSemanticEdgeData extends Record<string, unknown> {
  stroke: string;
  opacity: number;
  strokeWidth: number;
  animated: boolean;
  inlineDirection: boolean;
  flowDirection: FlowDirection;
  dashedFallback: boolean;
}

export function directionIndicator(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  direction: FlowDirection,
): { glyph: "›" | "↔"; angle: number } {
  const base = Math.atan2(targetY - sourceY, targetX - sourceX) * 180 / Math.PI;
  if (direction === "both") return { glyph: "↔", angle: base };
  return { glyph: "›", angle: direction === "reverse" ? base + 180 : base };
}
```

Render one non-animated `BaseEdge` as the stable hit/shape path and never pass `markerEnd`. Give that base path `strokeDasharray: "6 5"` only when `data.dashedFallback` is true; otherwise omit the property. When `data.animated` is true, render decorative SVG path overlays with `pointerEvents="none"`:

- `forward`: one `.uc-edge-flow-forward` overlay;
- `reverse`: one `.uc-edge-flow-reverse` overlay;
- `both`: two overlays, one forward and one reverse; set `animationDelay: "-.425s"` on the reverse overlay to phase-shift it by half the `.85s` cycle.

When `data.inlineDirection` is true, render the `directionIndicator` glyph at `labelX, labelY` returned by `getSmoothStepPath` through `EdgeLabelRenderer`; rotate the glyph using the returned angle and mark it `aria-hidden="true"`. If the React Flow `label` prop is present, render its text at `labelX, labelY - 14` so it cannot overlap the direction glyph. The text remains unrotated and uses the existing edge-label theme tokens.

`FlowingSemanticEdge.test.ts` must:

```ts
expect(directionIndicator(0, 0, 10, 0, "forward")).toEqual({ glyph: "›", angle: 0 });
expect(directionIndicator(0, 0, 10, 0, "reverse")).toEqual({ glyph: "›", angle: 180 });
expect(directionIndicator(0, 0, 10, 0, "both")).toEqual({ glyph: "↔", angle: 0 });
const source = readFileSync(new URL("../FlowingSemanticEdge.tsx", import.meta.url), "utf8");
expect(source).not.toContain("markerEnd");
expect(source).toContain("uc-edge-flow-forward");
expect(source).toContain("uc-edge-flow-reverse");
```

Add CSS with opposite offsets and an unconditional reduced-motion guard:

```css
@keyframes uc-edge-flow-forward { to { stroke-dashoffset: -30; } }
@keyframes uc-edge-flow-reverse { to { stroke-dashoffset: 30; } }
.uc-edge-flow-forward,
.uc-edge-flow-reverse { fill: none; stroke-dasharray: 7 8; }
.uc-edge-flow-forward { animation: uc-edge-flow-forward .85s linear infinite; }
.uc-edge-flow-reverse { animation: uc-edge-flow-reverse .85s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .uc-edge-flow-forward,
  .uc-edge-flow-reverse { animation: none !important; stroke-dasharray: none; }
}
```

- [ ] **Step 7: Make canvas consume the pure presentation**

Call `useReducedMotion()` once in `SemanticGraphCanvas`, then memoize `buildSelectionPresentation(semanticGraph, activeId, reducedMotion)`. Set node `isSelected`, `isNeighbor`, `isDimmed`, and opacity only from that result. Register `edgeTypes={{ "flowing-semantic": FlowingSemanticEdge }}` and construct every React Flow edge with `type: "flowing-semantic"` plus `FlowingSemanticEdgeData`; never set `animated` or `markerEnd` on the React Flow edge itself.

Use the existing per-relationship color and imports dashed fallback as `data.stroke`/`data.dashedFallback`. The selection helper controls opacity and width. Preserve `structureKey` as node IDs/kinds plus edge endpoints only; neither `selectedNodeId` nor `reducedMotion` may enter `structureKey` or the ELK effect dependency list. Use `var(--color-accent)`/semantic theme tokens, not old literal gold values.

- [ ] **Step 8: Test, build, and commit**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/graphExplorer/__tests__/selectionPresentation.test.ts \
  src/hooks/__tests__/useReducedMotion.test.ts \
  src/components/graphExplorer/__tests__/FlowingSemanticEdge.test.ts
pnpm --filter @understand-code/dashboard build
git add packages/dashboard/src/graphExplorer/selectionPresentation.ts \
  packages/dashboard/src/graphExplorer/__tests__/graphFixtures.ts \
  packages/dashboard/src/graphExplorer/__tests__/selectionPresentation.test.ts \
  packages/dashboard/src/hooks/useReducedMotion.ts \
  packages/dashboard/src/hooks/__tests__/useReducedMotion.test.ts \
  packages/dashboard/src/components/graphExplorer/FlowingSemanticEdge.tsx \
  packages/dashboard/src/components/graphExplorer/__tests__/FlowingSemanticEdge.test.ts \
  packages/dashboard/src/components/graphExplorer/SemanticGraphCanvas.tsx \
  packages/dashboard/src/index.css
git commit -m "feat(graph): restore flowing selection interaction"
```

---

### Task 5: Wire selection, pane clear, drill-down, and precise Wiki focus

**Files:**
- Modify: `packages/dashboard/src/graphExplorer/selectionPresentation.ts`
- Modify: `packages/dashboard/src/graphExplorer/__tests__/selectionPresentation.test.ts`
- Modify: `packages/dashboard/src/components/graphExplorer/SemanticGraphCanvas.tsx`
- Create: `packages/dashboard/src/components/graphExplorer/__tests__/SemanticGraphCanvas.test.ts`
- Modify: `packages/dashboard/src/components/graphExplorer/GraphExplorer.tsx`
- Modify: `packages/dashboard/src/store.ts`
- Modify: `packages/dashboard/src/__tests__/storeNavigation.test.ts`
- Modify: `packages/dashboard/src/graphExplorer/__tests__/hierarchicalGraph.test.ts`

**Interfaces:**
- Consumes: Plan 2 direct focus and primary destination behavior.
- Produces: one consistent click/select/drill/clear model.

- [ ] **Step 1: Write failing interaction-state tests**

Update the V2 store fixture in `storeNavigation.test.ts` to use `wikiRuntimeFixture()` and `graphFixture()`, then add:

```ts
import { graphFixture, wikiRuntimeFixture } from "../graphExplorer/__tests__/graphFixtures";

// Put this reset/load block in the describe's beforeEach.
useDashboardStore.setState({
  dashboardSurface: "wiki",
  selectedNodeId: null,
  graphFocusNodeIds: [],
  graphFocusPageId: null,
  pendingWikiAnchor: null,
  graphWikiNotice: null,
});
useDashboardStore.getState().setConsoleGraph(graphFixture());
useDashboardStore.getState().setWikiIndex(wikiRuntimeFixture());
useDashboardStore.getState().selectNode("scope:layer:core");
expect(useDashboardStore.getState().selectedNodeId).toBe("scope:layer:core");
useDashboardStore.getState().selectNode(null);
expect(useDashboardStore.getState().selectedNodeId).toBeNull();

useDashboardStore.getState().openGraphForWikiPage("page:run");
expect(useDashboardStore.getState().graphFocusNodeIds).toEqual(["function:src/a.ts:run"]);
expect(useDashboardStore.getState().graphFocusPageId).toBe("page:run");
expect(useDashboardStore.getState().graphWikiNotice).toBeNull();

useDashboardStore.getState().openWikiForGraphNode("function:src/a.ts:run");
expect(useDashboardStore.getState().activeWikiPageId).toBe("page:run");
expect(useDashboardStore.getState().pendingWikiAnchor).toBe("run");

useDashboardStore.getState().setDashboardSurface("graph");
useDashboardStore.getState().openWikiForGraphNode("file:context-only.ts");
expect(useDashboardStore.getState().dashboardSurface).toBe("graph");
expect(useDashboardStore.getState().selectedNodeId).toBe("file:context-only.ts");
expect(useDashboardStore.getState().graphWikiNotice).toBe("暂无专门正文");
```

The shared `graphFixture()`/`wikiRuntimeFixture()` already contains `file:context-only.ts` with `relation: "context"`, no `primaryPageId`, and `page:overview` only as context. The last case proves graph-to-Wiki never silently opens a merely related page.

Create `SemanticGraphCanvas.test.ts` as a Node source-contract test, matching the repository's current non-DOM component-test style:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../SemanticGraphCanvas.tsx", import.meta.url), "utf8");

describe("SemanticGraphCanvas interaction contract", () => {
  it("selects every graph object, clears from the pane, and keeps drilling explicit", () => {
    expect(source).toContain("selectNode(node.id)");
    expect(source).not.toContain('node.data.kind === "node"');
    expect(source).toContain("onPaneClick={onPaneClick}");
    expect(source).toContain("selectNode(null)");
    expect(source).toContain("onNodeDoubleClick={onNodeDoubleClick}");
    expect(source).toContain("node.data.onDrillDown?.()");
    expect(source).toContain("event.stopPropagation()");
    expect(source).toContain("nodesFocusable={false}");
    expect(source).toContain("graphCardKeyAction(event.key");
  });

  it("does not fit or relayout merely because selection changed", () => {
    expect(source).not.toContain("SelectedNodeFocus");
    expect(source).not.toContain("<SelectedNodeFocus");
  });
});
```

Extend `selectionPresentation.test.ts` with the exact keyboard contract:

```ts
expect(graphCardKeyAction("Enter", true)).toBe("drill");
expect(graphCardKeyAction("Enter", false)).toBe("select");
expect(graphCardKeyAction(" ", true)).toBe("select");
expect(graphCardKeyAction("Spacebar", true)).toBe("select");
expect(graphCardKeyAction("Escape", true)).toBeNull();
```

- [ ] **Step 2: Run and verify failure**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/__tests__/storeNavigation.test.ts \
  src/graphExplorer/__tests__/hierarchicalGraph.test.ts \
  src/graphExplorer/__tests__/selectionPresentation.test.ts \
  src/components/graphExplorer/__tests__/SemanticGraphCanvas.test.ts
```

Expected: FAIL because current click logic only selects `kind === "node"` and no pane clear exists.

- [ ] **Step 3: Generalize the existing selection value without duplicating store state**

Keep the existing `selectedNodeId: string | null` and `selectNode(id)` store fields for compatibility until Plan 4. Treat the string as a graph-object ID in the new graph surface; it may contain a raw node, `scope:*`, or `boundary:*` ID. Do not add a second writable selection field, because two sources of truth can diverge.

```ts
selectNode: (nodeId) => set((state) => {
  const rawIds = new Set(state.graph?.nodes.map((node) => node.id) ?? []);
  const shouldRecordRawHistory = Boolean(
    nodeId
    && state.selectedNodeId
    && nodeId !== state.selectedNodeId
    && rawIds.has(nodeId)
    && rawIds.has(state.selectedNodeId),
  );
  return {
    selectedNodeId: nodeId,
    nodeHistory: shouldRecordRawHistory
      ? [...state.nodeHistory, state.selectedNodeId as string].slice(-MAX_HISTORY)
      : state.nodeHistory,
  };
}),
```

Preserve existing history behavior only for raw graph nodes. Before pushing history, check `state.graph?.nodes.some((node) => node.id === nodeId)` for both old and new IDs; aggregate selection must not pollute raw-node navigation history. Pass `selectedNodeId` into `buildHierarchicalSemanticGraph` and `buildGraphSelectionDetails` as `selectedObjectId`.

Do not reimplement the cross-surface actions completed by Plan 2. Reuse its exact `openGraphForWikiPage`, `openWikiForGraphNode`, `primaryDestinationForNode`, `graphFocusPageId`, `pendingWikiAnchor`, and `graphWikiNotice` behavior. This plan only adds aggregate/raw graph selection around those actions. In particular:

- Wiki → graph continues focusing only `page.directNodeIds` and retains `graphFocusPageId`.
- Raw graph node → Wiki continues using `primaryDestinationForNode`, including the exact Plan 1 slug anchor (`run` in this fixture).
- A context-only node stays on the graph, remains selected, and sets `graphWikiNotice: "暂无专门正文"`.
- Aggregate details open an explicit `selection.primaryDirectPageId` through `openWikiTarget({ pageId, anchor: null })`; they never call `openWikiForGraphNode` with a synthetic `scope:*` ID.

When editing `store.ts`, restrict the diff to aggregate-safe `selectNode` history behavior and passing the existing selection through the new graph model. Any change that removes or resets `graphFocusPageId`, `pendingWikiAnchor`, or `graphWikiNotice` is a regression.

- [ ] **Step 4: Wire React Flow events**

```tsx
const onNodeClick = useCallback<NodeMouseHandler<SemanticFlowNode>>((_, node) => selectNode(node.id), [selectNode]);
const onNodeDoubleClick = useCallback<NodeMouseHandler<SemanticFlowNode>>((_, node) => node.data.onDrillDown?.(), []);
const onPaneClick = useCallback(() => selectNode(null), [selectNode]);
```

Pass all three to `ReactFlow`. Delete `SelectedNodeFocus` entirely: ordinary single-click selection never calls `fitView`, `setCenter`, or ELK. Explicit Wiki focus changes the visible graph/view key and is handled by the existing layout fit. This plan does not provide automatic viewport movement when selection changes.

The node-card drill button keeps `event.stopPropagation()` so it drills without first selecting. Double-click may produce the browser's preceding single-click selection; this is acceptable because it does not alter layout, and the second event performs the explicit drill.

- [ ] **Step 5: Add one keyboard owner for each card**

Export this pure key mapping from `selectionPresentation.ts`:

```ts
export type GraphCardKeyAction = "select" | "drill";

export function graphCardKeyAction(key: string, canDrillDown: boolean): GraphCardKeyAction | null {
  if (key === "Enter") return canDrillDown ? "drill" : "select";
  if (key === " " || key === "Spacebar") return "select";
  return null;
}
```

Disable React Flow's wrapper-level node focus with `nodesFocusable={false}` to avoid two tab stops for one card. Make the `SemanticNodeCard` root the sole focus target with `tabIndex={0}`, `role="group"`, `aria-keyshortcuts="Enter Space"`, and this exact accessible label:

```tsx
aria-label={data.canDrillDown
  ? `${data.label}，按 Enter 进入，按空格选择`
  : `${data.label}，按空格选择`}
```

Add `onSelect: () => void` to `SemanticNodeData` and wire it to `selectNode(node.id)` while building nodes.

Handle keys only when `event.target === event.currentTarget`, so the nested native drill button retains its own Enter/Space click behavior:

```tsx
onKeyDown={(event) => {
  if (event.target !== event.currentTarget) return;
  const action = graphCardKeyAction(event.key, data.canDrillDown);
  if (!action) return;
  event.preventDefault();
  if (action === "drill") data.onDrillDown?.();
  else data.onSelect();
}}
```

Therefore Enter drills when a next level exists and otherwise selects; Space only selects and never drills. Add a visible `focus-visible` outline using `var(--color-accent)`. Do not attach a second global `onKeyDown` to `ReactFlow`.

- [ ] **Step 6: Test, build, and commit**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/__tests__/storeNavigation.test.ts \
  src/graphExplorer/__tests__/hierarchicalGraph.test.ts \
  src/graphExplorer/__tests__/selectionPresentation.test.ts \
  src/components/graphExplorer/__tests__/SemanticGraphCanvas.test.ts \
  src/components/graphExplorer/__tests__/graphExplorerModel.test.ts
pnpm --filter @understand-code/dashboard build
git add packages/dashboard/src/components/graphExplorer/SemanticGraphCanvas.tsx \
  packages/dashboard/src/components/graphExplorer/__tests__/SemanticGraphCanvas.test.ts \
  packages/dashboard/src/components/graphExplorer/GraphExplorer.tsx \
  packages/dashboard/src/graphExplorer/selectionPresentation.ts \
  packages/dashboard/src/graphExplorer/__tests__/selectionPresentation.test.ts \
  packages/dashboard/src/store.ts packages/dashboard/src/__tests__/storeNavigation.test.ts \
  packages/dashboard/src/graphExplorer/__tests__/hierarchicalGraph.test.ts
git commit -m "fix(graph): unify selection and drill down"
```

---

### Task 6: Verify Plan 3 independently

**Files:**
- Modify only Task 1–5 files if verification exposes a graph defect.

- [ ] **Step 1: Run focused graph regressions**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/graphExplorer/__tests__/semanticGraph.test.ts \
  src/graphExplorer/__tests__/hierarchicalGraph.test.ts \
  src/graphExplorer/__tests__/selectionPresentation.test.ts \
  src/hooks/__tests__/useReducedMotion.test.ts \
  src/components/graphExplorer/__tests__/graphExplorerModel.test.ts \
  src/components/graphExplorer/__tests__/FlowingSemanticEdge.test.ts \
  src/components/graphExplorer/__tests__/SemanticGraphCanvas.test.ts \
  src/viewgraph/__tests__/layerFileGraphModel.test.ts \
  src/__tests__/storeNavigation.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run all Dashboard tests and build**

```bash
pnpm --filter @understand-code/dashboard test
pnpm --filter @understand-code/dashboard build
```

Expected: PASS.

- [ ] **Step 3: Inspect generated markup for forbidden terminal arrows and red gap cards**

```bash
if rg -n --glob '!**/__tests__/**' \
  "markerEnd|ArrowClosed|ArrowOpen|COVERAGE_COLORS|存在缺口|文档缺口|个缺口|bg-complexity-complex|border-complexity-complex" \
  packages/dashboard/src/components/graphExplorer packages/dashboard/src/graphExplorer; then
  echo "Forbidden graph styling remains" >&2
  exit 1
fi
```

Expected: no terminal-arrow configuration and no full-card red coverage style. Inline reduced-motion direction markup is allowed.

- [ ] **Step 4: Verify selection stability and accessibility contracts**

```bash
rg -n "selectedNodeId|reducedMotion" packages/dashboard/src/components/graphExplorer/SemanticGraphCanvas.tsx
rg -n "ariaLabelConfig|onPaneClick|onNodeDoubleClick" packages/dashboard/src/components/graphExplorer/SemanticGraphCanvas.tsx
```

Manually inspect the first result against the implementation: these values may drive `built` presentation data, but must not appear in `structureKey` or the ELK layout effect dependency array. Confirm the second result includes Chinese React Flow labels, pane clear, and explicit drill-down. Then run the source-contract test again:

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/components/graphExplorer/__tests__/SemanticGraphCanvas.test.ts \
  src/hooks/__tests__/useReducedMotion.test.ts
```

Expected: PASS.

- [ ] **Step 5: Confirm scope**

```bash
git status --short
git diff --check
```

Expected: no unrelated file staged; do not create an empty commit.

---

## Plan 3 Completion Gate

- Default graph is progressive architecture, not a full-node wall.
- Raw, scope, and boundary objects are selectable and explainable.
- Double-click and Enter drill when a next level exists; Space selects without drilling; the nested drill button retains native keyboard behavior.
- Aggregate coverage uses counts/ratios with independent problem state.
- Selected and one-hop nodes survive caps.
- Edge flow, thickness, and dimming match the approved interaction.
- No terminal arrowhead is rendered.
- Reduced-motion direction remains visible.
- Selection does not cause layout recomputation or routine viewport jumps.
- Calls/imports/structural dependencies are labeled truthfully.
- Wiki focus uses direct nodes only and graph-to-Wiki uses a primary direct destination.
- Dashboard graph tests and build pass.
