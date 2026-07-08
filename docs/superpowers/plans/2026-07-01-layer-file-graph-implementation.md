# Layer File Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the readable layer detail heatmap with a theme-aware file-level ReactFlow graph whose edges have no arrowheads, animate on focus, and connect to file node borders.

**Architecture:** Add a pure relationship helper that maps raw graph edges to aggregated file relationships, then add a pure flow-model helper that converts files and relationships into ReactFlow nodes/edges. A new `LayerFileGraph` component renders the model with ReactFlow and ELK layout, while `ReadableViewGraphPage` swaps it into the existing layer-detail route.

**Tech Stack:** React 19, TypeScript, Zustand store, `@xyflow/react`, existing ELK layout helper, Vitest.

---

## File Structure

- Create `packages/dashboard/src/viewgraph/fileRelationships.ts`
  - Pure data helper. Builds file-level relationships from `calls`, with `imports` fallback only when calls are unavailable.
- Create `packages/dashboard/src/viewgraph/__tests__/fileRelationships.test.ts`
  - Unit tests for direction, aggregation, same-file exclusion, and fallback behavior.
- Create `packages/dashboard/src/viewgraph/layerFileGraphModel.ts`
  - Pure ReactFlow model builder. Applies edge caps, focus expansion, no canvas labels, no `markerEnd`, border handles, and edge styles.
- Create `packages/dashboard/src/viewgraph/__tests__/layerFileGraphModel.test.ts`
  - Unit tests for edge cap behavior, focused relationship inclusion, handle assignment, and canvas-label exclusion.
- Create `packages/dashboard/src/components/LayerFileGraphNode.tsx`
  - Theme-aware file node with left/right/top/bottom ReactFlow handles on the border.
- Create `packages/dashboard/src/components/LayerFileGraph.tsx`
  - Layer detail graph renderer with ReactFlowProvider, ELK layout, selection state, side relationship panel, and file open action.
- Modify `packages/dashboard/src/components/ReadableViewGraphPage.tsx`
  - Replace `LayerFileHeatmap` with `LayerFileGraph` in `navigationLevel === "layer-detail"`.
- Modify `packages/dashboard/src/locales/en.ts`, `zh.ts`, `zh-TW.ts`, `ja.ts`, `ko.ts`, `ru.ts`
  - Add graph relationship panel copy.
- Keep `packages/dashboard/src/components/LayerFileHeatmap.tsx`
  - Leave in place for now; it is no longer the default route.

---

### Task 1: File Relationship Helper

**Files:**
- Create: `packages/dashboard/src/viewgraph/fileRelationships.ts`
- Create: `packages/dashboard/src/viewgraph/__tests__/fileRelationships.test.ts`

- [ ] **Step 1: Write failing tests for relationship aggregation**

Create `packages/dashboard/src/viewgraph/__tests__/fileRelationships.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { buildViewGraph } from "../buildViewGraph";
import { buildFileRelationships } from "../fileRelationships";

function graphWithCalls(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "sample",
      languages: ["go"],
      frameworks: [],
      description: "",
      analyzedAt: "2026-07-01T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes: [
      { id: "file:a", type: "file", name: "a.go", filePath: "src/a.go", summary: "", tags: [], complexity: "simple" },
      { id: "file:b", type: "file", name: "b.go", filePath: "src/b.go", summary: "", tags: [], complexity: "moderate" },
      { id: "file:c", type: "file", name: "c.go", filePath: "src/c.go", summary: "", tags: [], complexity: "complex" },
      { id: "fn:a:one", type: "function", name: "One", filePath: "src/a.go", summary: "", tags: [], complexity: "simple" },
      { id: "fn:a:two", type: "function", name: "Two", filePath: "src/a.go", summary: "", tags: [], complexity: "simple" },
      { id: "fn:b:one", type: "function", name: "One", filePath: "src/b.go", summary: "", tags: [], complexity: "simple" },
      { id: "fn:c:one", type: "function", name: "One", filePath: "src/c.go", summary: "", tags: [], complexity: "simple" },
    ],
    edges: [
      { source: "file:a", target: "fn:a:one", type: "contains", direction: "forward", weight: 1 },
      { source: "file:a", target: "fn:a:two", type: "contains", direction: "forward", weight: 1 },
      { source: "file:b", target: "fn:b:one", type: "contains", direction: "forward", weight: 1 },
      { source: "file:c", target: "fn:c:one", type: "contains", direction: "forward", weight: 1 },
      { source: "fn:a:one", target: "fn:b:one", type: "calls", direction: "forward", weight: 1 },
      { source: "fn:a:two", target: "fn:b:one", type: "calls", direction: "forward", weight: 1 },
      { source: "fn:b:one", target: "fn:c:one", type: "calls", direction: "forward", weight: 1 },
      { source: "fn:a:one", target: "fn:a:two", type: "calls", direction: "forward", weight: 1 },
      { source: "file:c", target: "file:a", type: "imports", direction: "forward", weight: 0.7 },
    ],
    layers: [
      { id: "core", name: "Core", description: "Core", nodeIds: ["file:a", "file:b", "file:c"] },
    ],
    tour: [],
  };
}

function graphWithImportsOnly(): KnowledgeGraph {
  const graph = graphWithCalls();
  return {
    ...graph,
    edges: graph.edges.filter((edge) => edge.type !== "calls"),
  };
}

describe("buildFileRelationships", () => {
  it("aggregates function calls into directed file relationships", () => {
    const graph = graphWithCalls();
    const viewGraph = buildViewGraph(graph);
    const relationships = buildFileRelationships(graph, viewGraph, new Set(["file:a", "file:b", "file:c"]));

    expect(relationships).toEqual([
      {
        id: "calls:file:a->file:b",
        sourceFileId: "file:a",
        targetFileId: "file:b",
        source: "calls",
        count: 2,
        functionEdgeIds: ["fn:a:one->fn:b:one", "fn:a:two->fn:b:one"],
      },
      {
        id: "calls:file:b->file:c",
        sourceFileId: "file:b",
        targetFileId: "file:c",
        source: "calls",
        count: 1,
        functionEdgeIds: ["fn:b:one->fn:c:one"],
      },
    ]);
  });

  it("does not create file-level edges for same-file calls", () => {
    const graph = graphWithCalls();
    const viewGraph = buildViewGraph(graph);
    const relationships = buildFileRelationships(graph, viewGraph, new Set(["file:a"]));

    expect(relationships).toEqual([]);
  });

  it("falls back to imports when no usable call relationships exist", () => {
    const graph = graphWithImportsOnly();
    const viewGraph = buildViewGraph(graph);
    const relationships = buildFileRelationships(graph, viewGraph, new Set(["file:a", "file:c"]));

    expect(relationships).toEqual([
      {
        id: "imports:file:c->file:a",
        sourceFileId: "file:c",
        targetFileId: "file:a",
        source: "imports",
        count: 1,
        functionEdgeIds: [],
      },
    ]);
  });

  it("does not fall back to imports when calls are usable", () => {
    const graph = graphWithCalls();
    const viewGraph = buildViewGraph(graph);
    const relationships = buildFileRelationships(graph, viewGraph, new Set(["file:a", "file:b", "file:c"]));

    expect(relationships.map((relationship) => relationship.source)).toEqual(["calls", "calls"]);
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run:

```bash
pnpm --dir packages/dashboard test src/viewgraph/__tests__/fileRelationships.test.ts
```

Expected: FAIL with an import error because `../fileRelationships` does not exist.

- [ ] **Step 3: Implement the relationship helper**

Create `packages/dashboard/src/viewgraph/fileRelationships.ts`:

```ts
import type { KnowledgeGraph } from "@understand-code/core/types";
import type { ViewGraph } from "./types";

export type FileRelationshipSource = "calls" | "imports";

export interface FileRelationship {
  id: string;
  sourceFileId: string;
  targetFileId: string;
  source: FileRelationshipSource;
  count: number;
  functionEdgeIds: string[];
}

function relationshipKey(source: FileRelationshipSource, sourceFileId: string, targetFileId: string): string {
  return `${source}:${sourceFileId}->${targetFileId}`;
}

function pushRelationship(
  relationshipsByKey: Map<string, FileRelationship>,
  source: FileRelationshipSource,
  sourceFileId: string,
  targetFileId: string,
  functionEdgeId: string | null,
): void {
  if (sourceFileId === targetFileId) return;
  const key = relationshipKey(source, sourceFileId, targetFileId);
  const existing = relationshipsByKey.get(key);
  if (existing) {
    existing.count += 1;
    if (functionEdgeId) existing.functionEdgeIds.push(functionEdgeId);
    return;
  }
  relationshipsByKey.set(key, {
    id: key,
    sourceFileId,
    targetFileId,
    source,
    count: 1,
    functionEdgeIds: functionEdgeId ? [functionEdgeId] : [],
  });
}

function sortedRelationships(relationshipsByKey: Map<string, FileRelationship>): FileRelationship[] {
  return [...relationshipsByKey.values()].sort((a, b) => {
    if (a.sourceFileId !== b.sourceFileId) return a.sourceFileId.localeCompare(b.sourceFileId);
    if (a.targetFileId !== b.targetFileId) return a.targetFileId.localeCompare(b.targetFileId);
    return a.source.localeCompare(b.source);
  });
}

export function buildFileRelationships(
  graph: KnowledgeGraph,
  viewGraph: ViewGraph,
  layerFileIds: Set<string>,
): FileRelationship[] {
  const callRelationships = new Map<string, FileRelationship>();

  for (const edge of graph.edges) {
    if (edge.type !== "calls") continue;
    const sourceFileId = viewGraph.functionToFileId.get(edge.source);
    const targetFileId = viewGraph.functionToFileId.get(edge.target);
    if (!sourceFileId || !targetFileId) continue;
    if (!layerFileIds.has(sourceFileId) || !layerFileIds.has(targetFileId)) continue;
    pushRelationship(callRelationships, "calls", sourceFileId, targetFileId, `${edge.source}->${edge.target}`);
  }

  if (callRelationships.size > 0) {
    return sortedRelationships(callRelationships);
  }

  const importRelationships = new Map<string, FileRelationship>();
  for (const edge of graph.edges) {
    if (edge.type !== "imports") continue;
    if (!layerFileIds.has(edge.source) || !layerFileIds.has(edge.target)) continue;
    pushRelationship(importRelationships, "imports", edge.source, edge.target, null);
  }

  return sortedRelationships(importRelationships);
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run:

```bash
pnpm --dir packages/dashboard test src/viewgraph/__tests__/fileRelationships.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/dashboard/src/viewgraph/fileRelationships.ts packages/dashboard/src/viewgraph/__tests__/fileRelationships.test.ts
git commit -m "feat: derive file relationships"
```

---

### Task 2: Layer File Graph Model

**Files:**
- Create: `packages/dashboard/src/viewgraph/layerFileGraphModel.ts`
- Create: `packages/dashboard/src/viewgraph/__tests__/layerFileGraphModel.test.ts`

- [ ] **Step 1: Write failing tests for graph model rules**

Create `packages/dashboard/src/viewgraph/__tests__/layerFileGraphModel.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests and confirm they fail**

Run:

```bash
pnpm --dir packages/dashboard test src/viewgraph/__tests__/layerFileGraphModel.test.ts
```

Expected: FAIL with an import error because `../layerFileGraphModel` does not exist.

- [ ] **Step 3: Implement the model builder**

Create `packages/dashboard/src/viewgraph/layerFileGraphModel.ts`:

```ts
import type { Edge, Node } from "@xyflow/react";
import type { FileRelationship } from "./fileRelationships";
import type { ViewFileSummary } from "./types";

export interface LayerFileFlowModelInput {
  files: ViewFileSummary[];
  relationships: FileRelationship[];
  selectedFileId: string | null;
  fileMatchCounts: Map<string, number>;
  maxDefaultEdges: number;
}

export interface SelectedFileRelationshipDetails {
  file: ViewFileSummary;
  incoming: FileRelationship[];
  outgoing: FileRelationship[];
}

export interface LayerFileGraphNodeData extends Record<string, unknown> {
  file: ViewFileSummary;
  isSelected: boolean;
  isDimmed: boolean;
  searchMatchCount: number;
}

export interface LayerFileFlowModel {
  nodes: Node<LayerFileGraphNodeData, "layer-file">[];
  edges: Edge[];
  selectedDetails: SelectedFileRelationshipDetails | null;
}

function strongestRelationships(relationships: FileRelationship[], maxDefaultEdges: number): FileRelationship[] {
  if (relationships.length <= maxDefaultEdges) return relationships;
  return [...relationships]
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.id.localeCompare(b.id);
    })
    .slice(0, maxDefaultEdges);
}

function visibleRelationships(
  relationships: FileRelationship[],
  selectedFileId: string | null,
  maxDefaultEdges: number,
): FileRelationship[] {
  const visible = new Map<string, FileRelationship>();
  for (const relationship of strongestRelationships(relationships, maxDefaultEdges)) {
    visible.set(relationship.id, relationship);
  }
  if (selectedFileId) {
    for (const relationship of relationships) {
      if (relationship.sourceFileId === selectedFileId || relationship.targetFileId === selectedFileId) {
        visible.set(relationship.id, relationship);
      }
    }
  }
  return [...visible.values()];
}

function edgeStyle(relationship: FileRelationship, selectedFileId: string | null): Edge {
  const focused = selectedFileId === relationship.sourceFileId || selectedFileId === relationship.targetFileId;
  const faded = Boolean(selectedFileId) && !focused;
  const fallback = relationship.source === "imports";
  const stroke = focused
    ? "var(--color-accent-bright)"
    : faded
      ? "var(--color-edge-dim)"
      : "var(--color-edge)";
  return {
    id: relationship.id,
    source: relationship.sourceFileId,
    target: relationship.targetFileId,
    sourceHandle: "right",
    targetHandle: "left",
    animated: focused,
    style: {
      stroke,
      strokeWidth: focused ? 2.8 : Math.min(1.2 + Math.log2(relationship.count + 1), 3.8),
      ...(fallback ? { strokeDasharray: "5 5" } : {}),
    },
  };
}

export function buildLayerFileFlowModel({
  files,
  relationships,
  selectedFileId,
  fileMatchCounts,
  maxDefaultEdges,
}: LayerFileFlowModelInput): LayerFileFlowModel {
  const relationshipList = visibleRelationships(relationships, selectedFileId, maxDefaultEdges);
  const selectedFile = selectedFileId ? files.find((file) => file.id === selectedFileId) ?? null : null;
  const relatedToSelected = new Set<string>();
  if (selectedFileId) {
    relatedToSelected.add(selectedFileId);
    for (const relationship of relationships) {
      if (relationship.sourceFileId === selectedFileId) relatedToSelected.add(relationship.targetFileId);
      if (relationship.targetFileId === selectedFileId) relatedToSelected.add(relationship.sourceFileId);
    }
  }

  const nodes: Node<LayerFileGraphNodeData, "layer-file">[] = files.map((file) => ({
    id: file.id,
    type: "layer-file",
    position: { x: 0, y: 0 },
    data: {
      file,
      isSelected: file.id === selectedFileId,
      isDimmed: Boolean(selectedFileId) && !relatedToSelected.has(file.id),
      searchMatchCount: fileMatchCounts.get(file.id) ?? 0,
    },
  }));

  const edges = relationshipList.map((relationship) => edgeStyle(relationship, selectedFileId));

  return {
    nodes,
    edges,
    selectedDetails: selectedFile
      ? {
          file: selectedFile,
          incoming: relationships.filter((relationship) => relationship.targetFileId === selectedFile.id),
          outgoing: relationships.filter((relationship) => relationship.sourceFileId === selectedFile.id),
        }
      : null,
  };
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run:

```bash
pnpm --dir packages/dashboard test src/viewgraph/__tests__/layerFileGraphModel.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add packages/dashboard/src/viewgraph/layerFileGraphModel.ts packages/dashboard/src/viewgraph/__tests__/layerFileGraphModel.test.ts
git commit -m "feat: build layer file graph model"
```

---

### Task 3: File Graph Components And Route Wiring

**Files:**
- Create: `packages/dashboard/src/components/LayerFileGraphNode.tsx`
- Create: `packages/dashboard/src/components/LayerFileGraph.tsx`
- Modify: `packages/dashboard/src/components/ReadableViewGraphPage.tsx`
- Modify: `packages/dashboard/src/locales/en.ts`
- Modify: `packages/dashboard/src/locales/zh.ts`
- Modify: `packages/dashboard/src/locales/zh-TW.ts`
- Modify: `packages/dashboard/src/locales/ja.ts`
- Modify: `packages/dashboard/src/locales/ko.ts`
- Modify: `packages/dashboard/src/locales/ru.ts`

- [ ] **Step 1: Add localized relationship-panel copy**

In every locale file, add these keys inside `readableViewGraph`.

`packages/dashboard/src/locales/en.ts`:

```ts
    selectFileForRelationships: "Select a file to inspect direct relationships",
    noRelationships: "No direct file relationships",
```

`packages/dashboard/src/locales/zh.ts`:

```ts
    selectFileForRelationships: "选择文件以查看直接关系",
    noRelationships: "没有直接文件关系",
```

`packages/dashboard/src/locales/zh-TW.ts`:

```ts
    selectFileForRelationships: "選擇檔案以查看直接關係",
    noRelationships: "沒有直接檔案關係",
```

`packages/dashboard/src/locales/ja.ts`:

```ts
    selectFileForRelationships: "ファイルを選択して直接の関係を確認",
    noRelationships: "直接のファイル関係はありません",
```

`packages/dashboard/src/locales/ko.ts`:

```ts
    selectFileForRelationships: "파일을 선택해 직접 관계를 확인",
    noRelationships: "직접 파일 관계가 없습니다",
```

`packages/dashboard/src/locales/ru.ts`:

```ts
    selectFileForRelationships: "Выберите файл, чтобы посмотреть прямые связи",
    noRelationships: "Нет прямых связей между файлами",
```

- [ ] **Step 2: Create the file node component**

Create `packages/dashboard/src/components/LayerFileGraphNode.tsx`:

```tsx
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import type { ViewFileSummary } from "../viewgraph/types";
import type { LayerFileGraphNodeData } from "../viewgraph/layerFileGraphModel";

export type LayerFileGraphFlowNode = Node<LayerFileGraphNodeData, "layer-file">;

function complexityClass(complexity: ViewFileSummary["node"]["complexity"]): string {
  if (complexity === "complex") return "border-complexity-complex/65";
  if (complexity === "moderate") return "border-accent-dim/55";
  return "border-node-file/55";
}

function LayerFileGraphNode({ data }: NodeProps<LayerFileGraphFlowNode>) {
  const { file, isSelected, isDimmed, searchMatchCount } = data;

  return (
    <div
      className={`relative w-[220px] rounded-lg border bg-elevated px-3 py-3 text-left shadow-sm transition-[opacity,box-shadow,border-color] ${
        complexityClass(file.node.complexity)
      } ${isSelected ? "ring-2 ring-accent-bright node-glow" : ""} ${
        isDimmed ? "opacity-25" : "opacity-100"
      }`}
    >
      <Handle id="left" type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border !border-accent !bg-root" />
      <Handle id="right" type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border !border-accent !bg-root" />
      <Handle id="top" type="target" position={Position.Top} className="!h-2 !w-2 !border !border-accent-dim !bg-root" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="!h-2 !w-2 !border !border-accent-dim !bg-root" />

      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text-primary" title={file.filePath}>
            {file.name}
          </div>
          <div className="mt-1 truncate font-mono text-[10px] text-text-muted" title={file.filePath}>
            {file.filePath}
          </div>
        </div>
        {searchMatchCount > 0 && (
          <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
            {searchMatchCount}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-text-secondary">
        <span><b className="text-text-primary">{file.functionCount}</b> fn</span>
        <span><b className="text-text-primary">{file.classCount}</b> cls</span>
        <span><b className="text-text-primary">{file.importInCount + file.importOutCount}</b> deps</span>
      </div>
    </div>
  );
}

export default memo(LayerFileGraphNode);
```

- [ ] **Step 3: Create the graph component**

Create `packages/dashboard/src/components/LayerFileGraph.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { buildFileRelationships } from "../viewgraph/fileRelationships";
import { buildLayerFileFlowModel } from "../viewgraph/layerFileGraphModel";
import type { SelectedFileRelationshipDetails } from "../viewgraph/layerFileGraphModel";
import type { ViewFileSummary, ViewGraph, ViewLayerSummary } from "../viewgraph/types";
import { nodesToElkInput, mergeElkPositions } from "../utils/layout";
import { applyElkLayout } from "../utils/elk-layout";
import { useI18n } from "../contexts/I18nContext";
import LayerFileGraphNode from "./LayerFileGraphNode";

const NODE_TYPES = {
  "layer-file": LayerFileGraphNode,
};

const FILE_NODE_SIZE = { width: 220, height: 104 };
const MAX_DEFAULT_EDGES = 120;

interface LayerFileGraphProps {
  graph: KnowledgeGraph;
  viewGraph: ViewGraph;
  layer: ViewLayerSummary | null;
  files: ViewFileSummary[];
  fileMatchCounts: Map<string, number>;
  selectedFileId: string | null;
  onSelectFile: (fileId: string | null) => void;
  onOpenFile: (fileId: string) => void;
}

function RelationshipPanel({
  details,
  filesById,
  onOpenFile,
}: {
  details: SelectedFileRelationshipDetails | null;
  filesById: Map<string, ViewFileSummary>;
  onOpenFile: (fileId: string) => void;
}) {
  const { t } = useI18n();

  if (!details) {
    return (
      <aside className="w-[300px] shrink-0 border-l border-border-subtle bg-surface px-4 py-4 text-sm text-text-muted">
        {t.readableViewGraph.selectFileForRelationships}
      </aside>
    );
  }

  const renderRelationship = (fileId: string, count: number) => {
    const file = filesById.get(fileId);
    return (
      <button
        key={fileId}
        type="button"
        onClick={() => onOpenFile(fileId)}
        className="w-full rounded-md border border-border-subtle bg-elevated/70 px-3 py-2 text-left hover:border-accent/50"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-xs font-semibold text-text-primary">{file?.name ?? fileId}</span>
          <span className="font-mono text-[10px] text-accent">{count}</span>
        </div>
        <div className="mt-1 truncate font-mono text-[10px] text-text-muted">{file?.filePath ?? fileId}</div>
      </button>
    );
  };

  return (
    <aside className="w-[320px] shrink-0 overflow-auto border-l border-border-subtle bg-surface px-4 py-4">
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-wider text-text-muted">{t.common.file}</div>
        <h3 className="mt-1 truncate text-base font-semibold text-text-primary" title={details.file.filePath}>
          {details.file.name}
        </h3>
        <p className="mt-1 truncate font-mono text-[10px] text-text-muted" title={details.file.filePath}>
          {details.file.filePath}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md border border-border-subtle bg-elevated/60 p-2">
          <div className="text-base font-semibold text-accent">{details.file.functionCount}</div>
          <div className="text-[10px] text-text-muted">{t.readableViewGraph.functions}</div>
        </div>
        <div className="rounded-md border border-border-subtle bg-elevated/60 p-2">
          <div className="text-base font-semibold text-accent">{details.incoming.length}</div>
          <div className="text-[10px] text-text-muted">{t.functionDetail.upstream}</div>
        </div>
        <div className="rounded-md border border-border-subtle bg-elevated/60 p-2">
          <div className="text-base font-semibold text-accent">{details.outgoing.length}</div>
          <div className="text-[10px] text-text-muted">{t.functionDetail.downstream}</div>
        </div>
      </div>

      <section className="mt-5 space-y-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{t.functionDetail.downstream}</h4>
        {details.outgoing.length === 0 ? (
          <p className="text-xs text-text-muted">{t.readableViewGraph.noRelationships}</p>
        ) : (
          details.outgoing.map((edge) => renderRelationship(edge.targetFileId, edge.count))
        )}
      </section>

      <section className="mt-5 space-y-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{t.functionDetail.upstream}</h4>
        {details.incoming.length === 0 ? (
          <p className="text-xs text-text-muted">{t.readableViewGraph.noRelationships}</p>
        ) : (
          details.incoming.map((edge) => renderRelationship(edge.sourceFileId, edge.count))
        )}
      </section>
    </aside>
  );
}

function LayerFileGraphCanvas(props: LayerFileGraphProps) {
  const { fitView } = useReactFlow();
  const [selectedFileId, setSelectedFileId] = useState<string | null>(props.selectedFileId);

  const filesById = useMemo(() => new Map(props.files.map((file) => [file.id, file])), [props.files]);
  const relationships = useMemo(
    () => buildFileRelationships(props.graph, props.viewGraph, new Set(props.files.map((file) => file.id))),
    [props.graph, props.viewGraph, props.files],
  );
  const model = useMemo(
    () => buildLayerFileFlowModel({
      files: props.files,
      relationships,
      selectedFileId,
      fileMatchCounts: props.fileMatchCounts,
      maxDefaultEdges: MAX_DEFAULT_EDGES,
    }),
    [props.files, relationships, selectedFileId, props.fileMatchCounts],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(model.nodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(model.edges as Edge[]);

  useEffect(() => {
    let cancelled = false;
    const dims = new Map(model.nodes.map((node) => [node.id, FILE_NODE_SIZE]));
    const input = nodesToElkInput(model.nodes as Node[], model.edges, dims, {
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "SPLINES",
      "elk.spacing.nodeNode": "70",
      "elk.layered.spacing.nodeNodeBetweenLayers": "110",
    });
    applyElkLayout(input, { strict: import.meta.env.DEV }).then(({ positioned, issues }) => {
      if (cancelled) return;
      if (issues.length > 0) {
        console.warn("[LayerFileGraph] layout issues", issues);
      }
      setNodes(mergeElkPositions(model.nodes as Node[], positioned));
      setEdges(model.edges);
      requestAnimationFrame(() => fitView({ duration: 350, padding: 0.18 }));
    });
    return () => {
      cancelled = true;
    };
  }, [model.nodes, model.edges, setNodes, setEdges, fitView]);

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    setSelectedFileId(node.id);
    props.onSelectFile(node.id);
  };

  const handleNodeDoubleClick = (_event: React.MouseEvent, node: Node) => {
    props.onOpenFile(node.id);
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onPaneClick={() => {
            setSelectedFileId(null);
            props.onSelectFile(null);
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          edgesReconnectable={false}
          fitView
          minZoom={0.05}
          maxZoom={1.8}
        >
          <Background variant={BackgroundVariant.Dots} color="var(--color-edge-dot)" gap={20} size={1} />
          <Controls />
          <MiniMap nodeColor="var(--color-elevated)" maskColor="var(--glass-bg)" className="!bg-surface !border !border-border-subtle" />
        </ReactFlow>
      </div>
      <RelationshipPanel details={model.selectedDetails} filesById={filesById} onOpenFile={props.onOpenFile} />
    </div>
  );
}

export default function LayerFileGraph(props: LayerFileGraphProps) {
  const { t } = useI18n();

  if (props.files.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-root text-sm text-text-muted">
        {t.readableViewGraph.noFiles}
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <LayerFileGraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 4: Wire the graph into the layer-detail route**

Modify `packages/dashboard/src/components/ReadableViewGraphPage.tsx`:

```tsx
import { useMemo } from "react";
import { useDashboardStore } from "../store";
import { useI18n } from "../contexts/I18nContext";
import {
  buildReadableSearchMatches,
  getAllFiles,
  getFilesForLayer,
} from "../viewgraph/readableSelectors";
import LayerOverviewPanel from "./LayerOverviewPanel";
import LayerFileGraph from "./LayerFileGraph";
import ViewGraphBreadcrumb from "./ViewGraphBreadcrumb";

export default function ReadableViewGraphPage() {
  const graph = useDashboardStore((s) => s.graph);
  const viewGraph = useDashboardStore((s) => s.viewGraph);
  const navigationLevel = useDashboardStore((s) => s.navigationLevel);
  const activeLayerId = useDashboardStore((s) => s.activeLayerId);
  const selectedNodeId = useDashboardStore((s) => s.selectedNodeId);
  const searchResults = useDashboardStore((s) => s.searchResults);
  const drillIntoLayer = useDashboardStore((s) => s.drillIntoLayer);
  const openFileDetail = useDashboardStore((s) => s.openFileDetail);
  const selectNode = useDashboardStore((s) => s.selectNode);
  const { t } = useI18n();

  const matches = useMemo(
    () => buildReadableSearchMatches(graph, viewGraph, searchResults),
    [graph, viewGraph, searchResults],
  );
  if (!graph || !viewGraph) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-root text-sm text-text-muted">
        {t.readableViewGraph.noGraph}
      </div>
    );
  }

  if (navigationLevel === "layer-detail") {
    const layer = activeLayerId ? viewGraph.layersById.get(activeLayerId) ?? null : null;
    const files = activeLayerId ? getFilesForLayer(viewGraph, activeLayerId) : getAllFiles(viewGraph);

    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className="shrink-0 border-b border-border-subtle bg-surface px-5 py-3">
          <ViewGraphBreadcrumb />
        </div>
        <div className="min-h-0 flex-1">
          <LayerFileGraph
            graph={graph}
            viewGraph={viewGraph}
            layer={layer}
            files={files}
            fileMatchCounts={matches.fileMatchCounts}
            selectedFileId={selectedNodeId}
            onSelectFile={selectNode}
            onOpenFile={openFileDetail}
          />
        </div>
      </div>
    );
  }

  return (
    <LayerOverviewPanel
      layers={viewGraph.layers}
      layerMatchCounts={matches.layerMatchCounts}
      onOpenLayer={drillIntoLayer}
    />
  );
}
```

- [ ] **Step 5: Run TypeScript build and fix compile errors**

Run:

```bash
pnpm --dir packages/dashboard build
```

Expected: PASS. If TypeScript reports a missing import or a `Node` generic mismatch, adjust the exact file reported by the compiler and rerun the command until it passes.

- [ ] **Step 6: Commit Task 3**

```bash
git add packages/dashboard/src/components/LayerFileGraphNode.tsx packages/dashboard/src/components/LayerFileGraph.tsx packages/dashboard/src/components/ReadableViewGraphPage.tsx packages/dashboard/src/locales/en.ts packages/dashboard/src/locales/zh.ts packages/dashboard/src/locales/zh-TW.ts packages/dashboard/src/locales/ja.ts packages/dashboard/src/locales/ko.ts packages/dashboard/src/locales/ru.ts
git commit -m "feat: render layer file graph"
```

---

### Task 4: Verification And Theme QA

**Files:**
- Modify only the file named by a failed verification command:
  - `packages/dashboard/src/components/LayerFileGraph.tsx`
  - `packages/dashboard/src/components/LayerFileGraphNode.tsx`
  - `packages/dashboard/src/viewgraph/layerFileGraphModel.ts`

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm --dir packages/dashboard test src/viewgraph/__tests__/fileRelationships.test.ts src/viewgraph/__tests__/layerFileGraphModel.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run dashboard build**

Run:

```bash
pnpm --dir packages/dashboard build
```

Expected: PASS.

- [ ] **Step 3: Start the dashboard dev server**

Run:

```bash
pnpm --dir packages/dashboard dev
```

Expected: Vite prints a localhost URL. Keep the server running for browser verification.

- [ ] **Step 4: Verify the layer graph manually in the browser**

Open the Vite URL with its token. Verify:

- Clicking a layer opens the file graph, not the old heatmap.
- File nodes render with visible border handles.
- There are no large arrowheads.
- There is no text rendered beside edges on the canvas.
- Selecting a file animates directly related edges.
- Unrelated nodes and edges dim.
- The side panel shows upstream/downstream relationship counts.
- Double-clicking a file opens the existing function matrix page.

- [ ] **Step 5: Verify both theme presets**

Use the existing theme picker to switch presets. Verify:

- `Engineering Workbench` uses dark surfaces and teal edge tokens.
- `Technical Document` uses light surfaces and the same clean edge geometry.
- Edge color follows `--color-edge`, `--color-edge-dim`, and `--color-accent-bright`.

- [ ] **Step 6: Commit verification fixes**

Only run this commit if Step 4 or Step 5 required fixes:

```bash
git add packages/dashboard/src/components/LayerFileGraph.tsx packages/dashboard/src/components/LayerFileGraphNode.tsx packages/dashboard/src/viewgraph/layerFileGraphModel.ts
git commit -m "fix: polish layer file graph"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review Checklist

- Spec coverage:
  - File-level graph replaces `LayerFileHeatmap` in layer-detail route: Task 3.
  - Calls-first and imports fallback relationship logic: Task 1.
  - No large arrowheads, no canvas edge labels, border handles: Task 2 and Task 3.
  - Selected-file complete one-hop relationships beyond default cap: Task 2.
  - Side panel relationship details: Task 3.
  - Theme preset compatibility: Task 4.
- Placeholder scan:
  - The plan contains no unfinished sections and no unspecified test commands.
- Type consistency:
  - `FileRelationship`, `LayerFileGraphNodeData`, and `SelectedFileRelationshipDetails` are introduced before use.
  - `sourceHandle` and `targetHandle` values match the `Handle id` values in `LayerFileGraphNode`.
