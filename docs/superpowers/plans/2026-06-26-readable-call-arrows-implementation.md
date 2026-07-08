# Readable Call Arrows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore understand-code-style call arrows in the readable dashboard with focused file-level arrows and a function-level mini-map.

**Architecture:** Add a tested relationship helper under `viewgraph` so UI components receive already-normalized file/function call edges. Keep the readable file-card layout, add an SVG overlay that only renders focused relationships, and add a compact SVG mini-map to the file detail page for the selected function.

**Tech Stack:** React 19, TypeScript, Vitest, Tailwind CSS, existing `KnowledgeGraph` and `ViewGraph` models.

---

## File Structure

- Create `packages/dashboard/src/viewgraph/callRelationships.ts`
  - Builds file-level aggregated call/import edges.
  - Builds one-hop function call neighborhoods.
  - Provides focused file-edge filtering with no relationship cap.
- Create `packages/dashboard/src/viewgraph/__tests__/callRelationships.test.ts`
  - Tests call aggregation, fallback imports, direction, direct focused relationship preservation, and function neighborhoods.
- Create `packages/dashboard/src/components/LayerCallOverlay.tsx`
  - Draws understand-code-style warm-gold SVG arrows between measured file-card anchors.
  - Exports `buildLayerCallPaths` for deterministic geometry tests.
- Create `packages/dashboard/src/components/__tests__/LayerCallOverlay.test.ts`
  - Tests focused path generation, missing-anchor filtering, and stroke-width scaling without relationship filtering.
- Modify `packages/dashboard/src/components/LayerFileHeatmap.tsx`
  - Track selected/focused file, measure card anchors, render `LayerCallOverlay`, and keep an explicit open-functions action.
- Modify `packages/dashboard/src/components/ReadableViewGraphPage.tsx`
  - Build current-layer call edges and wire file-card click to focus while preserving file-detail navigation.
- Create `packages/dashboard/src/components/FunctionCallMiniMap.tsx`
  - Draws selected function, direct incoming callers, direct outgoing callees, and cross-file nodes with the old arrow style.
  - Exports `buildFunctionMiniMapModel` for tests.
- Create `packages/dashboard/src/components/__tests__/FunctionCallMiniMap.test.ts`
  - Tests mini-map model includes every direct incoming/outgoing function and marks external nodes.
- Modify `packages/dashboard/src/components/FunctionDetailPage.tsx`
  - Build the selected function neighborhood and render `FunctionCallMiniMap` near the matrix.

## Task 1: Viewgraph Call Relationship Helper

**Files:**
- Create: `packages/dashboard/src/viewgraph/callRelationships.ts`
- Create: `packages/dashboard/src/viewgraph/__tests__/callRelationships.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/dashboard/src/viewgraph/__tests__/callRelationships.test.ts` with tests equivalent to:

```ts
import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { buildViewGraph } from "../buildViewGraph";
import {
  buildFileCallEdges,
  buildFunctionCallNeighborhood,
  getFocusedFileCallEdges,
} from "../callRelationships";

function graphWithCalls(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: { name: "calls", languages: ["ts"], frameworks: [], description: "", analyzedAt: "2026-06-26T00:00:00.000Z", gitCommitHash: "local" },
    nodes: [
      { id: "file:a", type: "file", name: "a.ts", filePath: "a.ts", summary: "", tags: [], complexity: "moderate" },
      { id: "file:b", type: "file", name: "b.ts", filePath: "b.ts", summary: "", tags: [], complexity: "moderate" },
      { id: "file:c", type: "file", name: "c.ts", filePath: "c.ts", summary: "", tags: [], complexity: "simple" },
      { id: "function:a:one", type: "function", name: "one", filePath: "a.ts", lineRange: [1, 2], summary: "", tags: [], complexity: "simple" },
      { id: "function:a:two", type: "function", name: "two", filePath: "a.ts", lineRange: [3, 4], summary: "", tags: [], complexity: "simple" },
      { id: "function:b:load", type: "function", name: "load", filePath: "b.ts", lineRange: [1, 2], summary: "", tags: [], complexity: "simple" },
      { id: "function:c:save", type: "function", name: "save", filePath: "c.ts", lineRange: [1, 2], summary: "", tags: [], complexity: "simple" },
    ],
    edges: [
      { source: "file:a", target: "function:a:one", type: "contains", direction: "forward", weight: 1 },
      { source: "file:a", target: "function:a:two", type: "contains", direction: "forward", weight: 1 },
      { source: "file:b", target: "function:b:load", type: "contains", direction: "forward", weight: 1 },
      { source: "file:c", target: "function:c:save", type: "contains", direction: "forward", weight: 1 },
      { source: "function:a:one", target: "function:b:load", type: "calls", direction: "forward", weight: 1 },
      { source: "function:a:two", target: "function:b:load", type: "calls", direction: "forward", weight: 1 },
      { source: "function:c:save", target: "function:a:one", type: "calls", direction: "forward", weight: 1 },
    ],
    layers: [{ id: "app", name: "App", description: "", nodeIds: ["file:a", "file:b", "file:c"] }],
    tour: [],
  };
}

describe("callRelationships", () => {
  it("aggregates function calls into directed file arrows", () => {
    const graph = graphWithCalls();
    const viewGraph = buildViewGraph(graph);

    const edges = buildFileCallEdges(graph, viewGraph, { fileIds: ["file:a", "file:b", "file:c"] });

    expect(edges).toMatchObject([
      { sourceFileId: "file:a", targetFileId: "file:b", source: "calls", count: 2 },
      { sourceFileId: "file:c", targetFileId: "file:a", source: "calls", count: 1 },
    ]);
    expect(edges[0].functionEdgeIds).toHaveLength(2);
  });

  it("falls back to imports only when there are no usable call edges in scope", () => {
    const graph = { ...graphWithCalls(), edges: graphWithCalls().edges.filter((edge) => edge.type !== "calls") };
    graph.edges.push({ source: "file:a", target: "file:b", type: "imports", direction: "forward", weight: 1 });
    const viewGraph = buildViewGraph(graph);

    expect(buildFileCallEdges(graph, viewGraph, { fileIds: ["file:a", "file:b"] })).toEqual([
      { sourceFileId: "file:a", targetFileId: "file:b", source: "imports", count: 1, functionEdgeIds: [] },
    ]);
  });

  it("returns every direct focused file relationship without a count cap", () => {
    const focusedEdges = Array.from({ length: 18 }, (_, index) => ({
      sourceFileId: "file:a",
      targetFileId: `file:${index}`,
      source: "calls" as const,
      count: 1,
      functionEdgeIds: [`edge:${index}`],
    }));

    expect(getFocusedFileCallEdges(focusedEdges, "file:a")).toHaveLength(18);
  });

  it("builds one-hop incoming and outgoing function neighborhoods", () => {
    const graph = graphWithCalls();
    const viewGraph = buildViewGraph(graph);

    const neighborhood = buildFunctionCallNeighborhood(graph, viewGraph, "function:a:one");

    expect(neighborhood.outgoing.map((edge) => edge.targetFunctionId)).toEqual(["function:b:load"]);
    expect(neighborhood.incoming.map((edge) => edge.sourceFunctionId)).toEqual(["function:c:save"]);
    expect(neighborhood.externalFileIds).toEqual(["file:b", "file:c"]);
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
pnpm --filter @understand-code/dashboard test -- src/viewgraph/__tests__/callRelationships.test.ts
```

Expected: FAIL because `../callRelationships` does not exist.

- [ ] **Step 3: Implement the helper**

Create `callRelationships.ts` with these public exports:

```ts
export type CallRelationshipSource = "calls" | "imports";

export interface FileCallEdge {
  sourceFileId: string;
  targetFileId: string;
  source: CallRelationshipSource;
  count: number;
  functionEdgeIds: string[];
}

export interface FunctionCallEdge {
  sourceFunctionId: string;
  targetFunctionId: string;
  sourceFileId: string | null;
  targetFileId: string | null;
  source: "calls";
}

export interface FunctionCallNeighborhood {
  selectedFunctionId: string;
  incoming: FunctionCallEdge[];
  outgoing: FunctionCallEdge[];
  intraFile: FunctionCallEdge[];
  externalFileIds: string[];
}
```

Implement:

- `buildFileCallEdges(graph, viewGraph, options?: { fileIds?: Iterable<string> })`
- `getFocusedFileCallEdges(edges, focusedFileId)`
- `buildFunctionCallEdges(graph, viewGraph, fileId)`
- `buildFunctionCallNeighborhood(graph, viewGraph, functionId)`

Sort returned edges by `sourceFileId`, then `targetFileId`. Skip same-file file-level arrows. Use imports only when no usable call edges exist for the current file scope.

- [ ] **Step 4: Run the helper tests and verify GREEN**

Run:

```bash
pnpm --filter @understand-code/dashboard test -- src/viewgraph/__tests__/callRelationships.test.ts
```

Expected: PASS for `callRelationships.test.ts`.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/dashboard/src/viewgraph/callRelationships.ts packages/dashboard/src/viewgraph/__tests__/callRelationships.test.ts
git commit -m "Add readable call relationship helpers"
```

## Task 2: File-Level Arrow Overlay Geometry And Component

**Files:**
- Create: `packages/dashboard/src/components/LayerCallOverlay.tsx`
- Create: `packages/dashboard/src/components/__tests__/LayerCallOverlay.test.ts`

- [ ] **Step 1: Write the failing geometry tests**

Create `LayerCallOverlay.test.ts` with tests equivalent to:

```ts
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

    expect(paths.map((path) => path.edge.targetFileId)).toEqual(["file:b", "file:a", "file:d"]);
    expect(paths.every((path) => path.d.startsWith("M "))).toBe(true);
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
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
pnpm --filter @understand-code/dashboard test -- src/components/__tests__/LayerCallOverlay.test.ts
```

Expected: FAIL because `LayerCallOverlay` does not exist.

- [ ] **Step 3: Implement `LayerCallOverlay`**

Implement:

- `FileCardAnchor` type with `{ id, x, y, width, height }`.
- `buildLayerCallPaths({ edges, anchors, focusedFileId })`.
- `LayerCallOverlay` React component that renders an absolutely positioned SVG.
- SVG marker arrowheads and warm-gold edge styles matching old `GraphView.tsx`.
- Dashed style for `source === "imports"`.
- Labels showing `count`, using muted gold.

- [ ] **Step 4: Run the overlay tests and verify GREEN**

Run:

```bash
pnpm --filter @understand-code/dashboard test -- src/components/__tests__/LayerCallOverlay.test.ts
```

Expected: PASS for `LayerCallOverlay.test.ts`.

- [ ] **Step 5: Commit Task 2**

```bash
git add packages/dashboard/src/components/LayerCallOverlay.tsx packages/dashboard/src/components/__tests__/LayerCallOverlay.test.ts
git commit -m "Add readable layer call overlay"
```

## Task 3: Integrate Focused File Arrows Into The Layer Heatmap

**Files:**
- Modify: `packages/dashboard/src/components/LayerFileHeatmap.tsx`
- Modify: `packages/dashboard/src/components/ReadableViewGraphPage.tsx`

- [ ] **Step 1: Update `ReadableViewGraphPage` wiring**

Use `buildFileCallEdges(graph, viewGraph, { fileIds: files.map((file) => file.id) })` in a memo. Read `selectNode` from `useDashboardStore`. Pass:

- `callEdges`
- `selectedFileId={selectedNodeId}`
- `onFocusFile={selectNode}`
- `onOpenFile={openFileDetail}`

- [ ] **Step 2: Update `LayerFileHeatmap` interaction**

Change card click behavior:

- Clicking the card focuses the file and reveals all direct incoming/outgoing arrows.
- A small action inside the card calls `onOpenFile(file.id)` and stops propagation.
- The existing selected outline applies to the focused file.
- A compact `functionDetail.callsImpact` toggle shows/hides arrows.

- [ ] **Step 3: Add card measurement**

Inside `LayerFileHeatmap`:

- Add `contentRef`.
- Add a `Map<string, HTMLElement>` ref for file cards.
- Measure anchors relative to the content wrapper using `getBoundingClientRect`.
- Re-measure on files, selected file, window resize, and `ResizeObserver` updates.

- [ ] **Step 4: Render overlay and relationship list**

Render `LayerCallOverlay` inside the relative content wrapper. Render a compact focused relationship list from `getFocusedFileCallEdges(callEdges, selectedFileId)` without slicing, using a scrollable container if dense.

- [ ] **Step 5: Run dashboard tests**

Run:

```bash
pnpm --filter @understand-code/dashboard test
```

Expected: all dashboard tests pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add packages/dashboard/src/components/LayerFileHeatmap.tsx packages/dashboard/src/components/ReadableViewGraphPage.tsx
git commit -m "Wire focused call arrows into readable layer view"
```

## Task 4: Function Call Mini-Map Model And Component

**Files:**
- Create: `packages/dashboard/src/components/FunctionCallMiniMap.tsx`
- Create: `packages/dashboard/src/components/__tests__/FunctionCallMiniMap.test.ts`

- [ ] **Step 1: Write the failing mini-map model tests**

Create `FunctionCallMiniMap.test.ts` with tests equivalent to:

```ts
import { describe, expect, it } from "vitest";
import type { GraphNode } from "@understand-code/core/types";
import type { FunctionCallNeighborhood } from "../../viewgraph/callRelationships";
import { buildFunctionMiniMapModel } from "../FunctionCallMiniMap";

const nodesById = new Map<string, GraphNode>([
  ["function:a:selected", { id: "function:a:selected", type: "function", name: "selected", filePath: "a.ts", lineRange: [1, 2], summary: "", tags: [], complexity: "moderate" }],
  ["function:a:caller", { id: "function:a:caller", type: "function", name: "caller", filePath: "a.ts", lineRange: [3, 4], summary: "", tags: [], complexity: "simple" }],
  ["function:b:callee", { id: "function:b:callee", type: "function", name: "callee", filePath: "b.ts", lineRange: [5, 6], summary: "", tags: [], complexity: "complex" }],
]);

const neighborhood: FunctionCallNeighborhood = {
  selectedFunctionId: "function:a:selected",
  incoming: [{ sourceFunctionId: "function:a:caller", targetFunctionId: "function:a:selected", sourceFileId: "file:a", targetFileId: "file:a", source: "calls" }],
  outgoing: [{ sourceFunctionId: "function:a:selected", targetFunctionId: "function:b:callee", sourceFileId: "file:a", targetFileId: "file:b", source: "calls" }],
  intraFile: [{ sourceFunctionId: "function:a:caller", targetFunctionId: "function:a:selected", sourceFileId: "file:a", targetFileId: "file:a", source: "calls" }],
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
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
pnpm --filter @understand-code/dashboard test -- src/components/__tests__/FunctionCallMiniMap.test.ts
```

Expected: FAIL because `FunctionCallMiniMap` does not exist.

- [ ] **Step 3: Implement `FunctionCallMiniMap`**

Implement:

- `buildFunctionMiniMapModel(neighborhood, nodesById)`.
- Three-column layout: incoming left, selected center, outgoing right.
- Responsive SVG height based on the larger of incoming/outgoing counts.
- Warm-gold curved arrow paths, arrowheads, and labels matching old graph styling.
- External functions with dashed borders and file-path detail.

- [ ] **Step 4: Run the mini-map tests and verify GREEN**

Run:

```bash
pnpm --filter @understand-code/dashboard test -- src/components/__tests__/FunctionCallMiniMap.test.ts
```

Expected: PASS for `FunctionCallMiniMap.test.ts`.

- [ ] **Step 5: Commit Task 4**

```bash
git add packages/dashboard/src/components/FunctionCallMiniMap.tsx packages/dashboard/src/components/__tests__/FunctionCallMiniMap.test.ts
git commit -m "Add function call mini map"
```

## Task 5: Integrate Function Mini-Map And Verify

**Files:**
- Modify: `packages/dashboard/src/components/FunctionDetailPage.tsx`

- [ ] **Step 1: Render mini-map from selected function**

In `FunctionDetailPage`, compute:

```ts
const neighborhood = useMemo(
  () => (graph && viewGraph && selectedDot ? buildFunctionCallNeighborhood(graph, viewGraph, selectedDot.nodeId) : null),
  [graph, viewGraph, selectedDot],
);
```

Render `FunctionCallMiniMap` near the matrix, using `graph.nodes` to build `nodesById`.

- [ ] **Step 2: Run all dashboard tests**

Run:

```bash
pnpm --filter @understand-code/dashboard test
```

Expected: all dashboard tests pass.

- [ ] **Step 3: Run dashboard build**

Run:

```bash
pnpm --filter @understand-code/dashboard build
```

Expected: TypeScript and Vite build complete with exit code 0.

- [ ] **Step 4: Browser verification**

Run the dashboard if needed:

```bash
pnpm --filter @understand-code/dashboard dev -- --host 127.0.0.1
```

Verify in browser:

- Layer detail initially shows cards without global arrows.
- Clicking a file card reveals all direct incoming/outgoing arrows for that file.
- Arrows visually match the old understand-code ReactFlow warm-gold style.
- The call-arrow toggle hides and restores the focused arrows.
- The card open action still reaches the file detail page.
- File detail shows a selected-function mini-map with direct incoming/outgoing arrows.

- [ ] **Step 5: Commit Task 5**

```bash
git add packages/dashboard/src/components/FunctionDetailPage.tsx
git commit -m "Show function call mini map in file detail"
```

## Final Verification

- [ ] Run `pnpm --filter @understand-code/dashboard test`.
- [ ] Run `pnpm --filter @understand-code/dashboard build`.
- [ ] Inspect `git status --short` and ensure only intentional files were committed.
- [ ] Summarize commit hashes and any remaining unrelated local changes.
