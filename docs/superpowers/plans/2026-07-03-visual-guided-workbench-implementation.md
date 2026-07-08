# Visual Guided Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first desktop implementation of the Visual Guided Workbench for structural dashboard mode.

**Architecture:** Add focused workbench model helpers for journey routes and knowledge context, then compose existing graph views inside a new desktop workbench shell. Keep existing graph/navigation behavior intact and make the knowledge base an optional content layer that gracefully falls back to graph facts.

**Tech Stack:** React 19, TypeScript, Zustand, Vite, Vitest, Tailwind CSS v4, existing `@xyflow/react` graph components.

---

## Scope Check

This plan implements one subsystem: the desktop structural workbench experience. It does not redesign the mobile layout, rebuild the knowledge-base generator, install Figma, or replace `LayerFileGraph`/`FunctionMatrixPanel`.

The implementation intentionally starts with:

- deterministic journey route generation
- optional knowledge trace/doc matching
- a new desktop workbench shell
- focused styling and tests

## File Structure

- Create `packages/dashboard/src/workbench/journeyRoute.ts`
  - Pure route builder for project, layer, file, and function steps.
  - Does not import React.

- Create `packages/dashboard/src/workbench/knowledgeContext.ts`
  - Pure knowledge-document index and selection resolver.
  - Does not fetch files.

- Create `packages/dashboard/src/workbench/__tests__/journeyRoute.test.ts`
  - Unit tests for deterministic route ordering and empty-state behavior.

- Create `packages/dashboard/src/workbench/__tests__/knowledgeContext.test.ts`
  - Unit tests for trace matching, file-path matching, and graph-only fallback.

- Create `packages/dashboard/src/components/workbench/ModeRail.tsx`
  - Compact icon-led rail for the first desktop version.

- Create `packages/dashboard/src/components/workbench/JourneyRail.tsx`
  - Route/progress panel with step buttons and related-doc count.

- Create `packages/dashboard/src/components/workbench/KnowledgeContextPanel.tsx`
  - Engineer handoff, business meaning, change risk, and evidence links.

- Create `packages/dashboard/src/components/workbench/VisualStage.tsx`
  - Stage wrapper that provides the visual header and renders existing page content.

- Create `packages/dashboard/src/components/workbench/VisualGuidedWorkbench.tsx`
  - Desktop structural layout shell wiring route, stage, and context.

- Create `packages/dashboard/src/components/workbench/__tests__/VisualGuidedWorkbench.test.tsx`
  - Component-level smoke tests for the shell and graceful missing-knowledge behavior.

- Modify `packages/dashboard/src/App.tsx`
  - Fetch optional knowledge context assets.
  - Render `VisualGuidedWorkbench` for desktop structural code-graph mode.

- Modify `packages/dashboard/src/components/ReadableViewGraphPage.tsx`
  - Accept optional compact presentation props so it can live inside the visual stage.

- Modify `packages/dashboard/src/components/LayerFileGraph.tsx`
  - Accept an optional `presentation="workbench"` prop to reduce duplicate headers when wrapped by `VisualStage`.

## Task 1: Add Journey Route Model

**Files:**
- Create: `packages/dashboard/src/workbench/journeyRoute.ts`
- Create: `packages/dashboard/src/workbench/__tests__/journeyRoute.test.ts`

- [ ] **Step 1: Write the failing journey-route tests**

Create `packages/dashboard/src/workbench/__tests__/journeyRoute.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { buildViewGraph } from "../../viewgraph/buildViewGraph";
import { buildJourneyRoute } from "../journeyRoute";

function graph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "handoff-app",
      languages: ["ts"],
      frameworks: ["react"],
      description: "Dashboard handoff sample",
      analyzedAt: "2026-07-03T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes: [
      { id: "file:src/api.ts", type: "file", name: "api.ts", filePath: "src/api.ts", summary: "API entry", tags: [], complexity: "complex" },
      { id: "function:src/api.ts:handleRequest", type: "function", name: "handleRequest", filePath: "src/api.ts", lineRange: [1, 20], summary: "Handles requests", tags: [], complexity: "complex", isExported: true },
      { id: "file:src/model.ts", type: "file", name: "model.ts", filePath: "src/model.ts", summary: "Model helpers", tags: [], complexity: "moderate" },
      { id: "function:src/model.ts:buildModel", type: "function", name: "buildModel", filePath: "src/model.ts", lineRange: [2, 10], summary: "Builds model", tags: [], complexity: "moderate", isExported: true },
      { id: "file:src/ui.tsx", type: "file", name: "ui.tsx", filePath: "src/ui.tsx", summary: "UI", tags: [], complexity: "simple" },
    ],
    edges: [
      { source: "file:src/api.ts", target: "function:src/api.ts:handleRequest", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/model.ts", target: "function:src/model.ts:buildModel", type: "contains", direction: "forward", weight: 1 },
      { source: "function:src/api.ts:handleRequest", target: "function:src/model.ts:buildModel", type: "calls", direction: "forward", weight: 1 },
      { source: "file:src/api.ts", target: "file:src/model.ts", type: "imports", direction: "forward", weight: 1 },
    ],
    layers: [
      { id: "api", name: "API", description: "Request entry layer", nodeIds: ["file:src/api.ts"] },
      { id: "model", name: "Model", description: "Business model layer", nodeIds: ["file:src/model.ts"] },
      { id: "ui", name: "UI", description: "Interface layer", nodeIds: ["file:src/ui.tsx"] },
    ],
    tour: [],
  };
}

describe("buildJourneyRoute", () => {
  it("builds a compact deterministic route from project to layer, file, and function", () => {
    const raw = graph();
    const viewGraph = buildViewGraph(raw);
    const route = buildJourneyRoute({
      graph: raw,
      viewGraph,
      layerMatchCounts: new Map([["model", 3]]),
      fileMatchCounts: new Map([["file:src/model.ts", 2]]),
    });

    expect(route.projectName).toBe("handoff-app");
    expect(route.steps.map((step) => [step.kind, step.targetId])).toEqual([
      ["project", "project"],
      ["layer", "model"],
      ["file", "file:src/model.ts"],
      ["function", "function:src/model.ts:buildModel"],
      ["layer", "api"],
      ["file", "file:src/api.ts"],
      ["function", "function:src/api.ts:handleRequest"],
    ]);
    expect(route.steps[1].score).toBeGreaterThan(route.steps[4].score);
  });

  it("returns a project-only route when no view graph exists", () => {
    const route = buildJourneyRoute({
      graph: null,
      viewGraph: null,
      layerMatchCounts: new Map(),
      fileMatchCounts: new Map(),
    });

    expect(route.projectName).toBe("Project");
    expect(route.steps).toEqual([
      {
        id: "project",
        kind: "project",
        targetId: "project",
        title: "Project overview",
        subtitle: "Load a graph to build the guided route.",
        score: 0,
      },
    ]);
  });
});
```

- [ ] **Step 2: Run the failing journey-route tests**

Run:

```bash
pnpm --filter @understand-code/dashboard test -- src/workbench/__tests__/journeyRoute.test.ts
```

Expected: fail because `../journeyRoute` does not exist.

- [ ] **Step 3: Implement the journey-route helper**

Create `packages/dashboard/src/workbench/journeyRoute.ts`:

```ts
import type { KnowledgeGraph } from "@understand-code/core/types";
import type { FunctionDot, ViewFileSummary, ViewGraph, ViewLayerSummary } from "../viewgraph/types";

export type JourneyStepKind = "project" | "layer" | "file" | "function";

export interface JourneyStep {
  id: string;
  kind: JourneyStepKind;
  targetId: string;
  title: string;
  subtitle: string;
  score: number;
  parentId?: string;
}

export interface JourneyRoute {
  projectName: string;
  steps: JourneyStep[];
}

export interface BuildJourneyRouteInput {
  graph: KnowledgeGraph | null;
  viewGraph: ViewGraph | null;
  layerMatchCounts: Map<string, number>;
  fileMatchCounts: Map<string, number>;
  maxLayers?: number;
  maxFilesPerLayer?: number;
  maxFunctionsPerFile?: number;
}

function complexityWeight(value: string | undefined): number {
  if (value === "complex") return 30;
  if (value === "moderate") return 12;
  return 0;
}

function layerScore(layer: ViewLayerSummary, layerMatchCounts: Map<string, number>): number {
  return (
    layer.fileCount * 8 +
    layer.functionCount * 2 +
    layer.classCount * 3 +
    (layerMatchCounts.get(layer.id) ?? 0) * 40
  );
}

function fileScore(file: ViewFileSummary, fileMatchCounts: Map<string, number>): number {
  return (
    file.functionCount * 6 +
    file.classCount * 4 +
    file.importInCount * 3 +
    file.importOutCount * 3 +
    complexityWeight(file.node.complexity) +
    (fileMatchCounts.get(file.id) ?? 0) * 35
  );
}

function functionScore(dot: FunctionDot): number {
  return dot.impactScore + complexityWeight(dot.complexity) + (dot.isExported ? 20 : 0);
}

function byScoreThenTitle<T extends { score: number; title: string }>(a: T, b: T): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.title.localeCompare(b.title);
}

function topFunctions(file: ViewFileSummary, maxFunctions: number): FunctionDot[] {
  return [...file.functionDots]
    .sort((a, b) => {
      const delta = functionScore(b) - functionScore(a);
      if (delta !== 0) return delta;
      return a.name.localeCompare(b.name);
    })
    .slice(0, maxFunctions);
}

export function buildJourneyRoute({
  graph,
  viewGraph,
  layerMatchCounts,
  fileMatchCounts,
  maxLayers = 4,
  maxFilesPerLayer = 2,
  maxFunctionsPerFile = 1,
}: BuildJourneyRouteInput): JourneyRoute {
  if (!graph || !viewGraph) {
    return {
      projectName: "Project",
      steps: [
        {
          id: "project",
          kind: "project",
          targetId: "project",
          title: "Project overview",
          subtitle: "Load a graph to build the guided route.",
          score: 0,
        },
      ],
    };
  }

  const steps: JourneyStep[] = [
    {
      id: "project",
      kind: "project",
      targetId: "project",
      title: "Project overview",
      subtitle: `${viewGraph.layers.length} layers · ${viewGraph.filesById.size} files`,
      score: Number.MAX_SAFE_INTEGER,
    },
  ];

  const selectedLayers = viewGraph.layers
    .map((layer) => ({
      layer,
      score: layerScore(layer, layerMatchCounts),
      title: layer.name,
    }))
    .sort(byScoreThenTitle)
    .slice(0, maxLayers);

  for (const { layer, score } of selectedLayers) {
    steps.push({
      id: `layer:${layer.id}`,
      kind: "layer",
      targetId: layer.id,
      title: layer.name,
      subtitle: layer.description || `${layer.fileCount} files · ${layer.functionCount} functions`,
      score,
      parentId: "project",
    });

    const selectedFiles = [...viewGraph.filesById.values()]
      .filter((file) => file.layerId === layer.id)
      .map((file) => ({
        file,
        score: fileScore(file, fileMatchCounts),
        title: file.name,
      }))
      .sort(byScoreThenTitle)
      .slice(0, maxFilesPerLayer);

    for (const { file, score: selectedFileScore } of selectedFiles) {
      steps.push({
        id: `file:${file.id}`,
        kind: "file",
        targetId: file.id,
        title: file.name,
        subtitle: file.filePath,
        score: selectedFileScore,
        parentId: `layer:${layer.id}`,
      });

      for (const dot of topFunctions(file, maxFunctionsPerFile)) {
        steps.push({
          id: `function:${dot.nodeId}`,
          kind: "function",
          targetId: dot.nodeId,
          title: dot.name,
          subtitle: dot.lineRange ? `L${dot.lineRange[0]}-${dot.lineRange[1]}` : file.filePath,
          score: functionScore(dot),
          parentId: `file:${file.id}`,
        });
      }
    }
  }

  return {
    projectName: graph.project.name || "Project",
    steps,
  };
}
```

- [ ] **Step 4: Run the journey-route tests**

Run:

```bash
pnpm --filter @understand-code/dashboard test -- src/workbench/__tests__/journeyRoute.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/dashboard/src/workbench/journeyRoute.ts packages/dashboard/src/workbench/__tests__/journeyRoute.test.ts
git commit -m "feat: build guided workbench route model"
```

## Task 2: Add Knowledge Context Model

**Files:**
- Create: `packages/dashboard/src/workbench/knowledgeContext.ts`
- Create: `packages/dashboard/src/workbench/__tests__/knowledgeContext.test.ts`

- [ ] **Step 1: Write the failing knowledge-context tests**

Create `packages/dashboard/src/workbench/__tests__/knowledgeContext.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildKnowledgeContextIndex, resolveKnowledgeContext } from "../knowledgeContext";

describe("knowledgeContext", () => {
  it("prefers direct trace node matches", () => {
    const index = buildKnowledgeContextIndex({
      traces: [
        {
          documentPath: "关键函数专题/src-api.ts-handleRequest.md",
          title: "Handle request",
          coveredNodeIds: ["function:src/api.ts:handleRequest"],
          coveredFilePaths: ["src/api.ts"],
          sourceAnchors: [{ filePath: "src/api.ts", lineRange: [1, 20], role: "primary" }],
          lowConfidenceClaims: [],
        },
      ],
      documents: [],
    });

    const context = resolveKnowledgeContext(index, {
      kind: "function",
      nodeId: "function:src/api.ts:handleRequest",
      filePath: "src/api.ts",
      title: "handleRequest",
      summary: "Handles requests",
      complexity: "complex",
    });

    expect(context.matchKind).toBe("direct-trace");
    expect(context.documents.map((doc) => doc.path)).toEqual(["关键函数专题/src-api.ts-handleRequest.md"]);
    expect(context.evidenceLinks[0]).toEqual({
      label: "src/api.ts L1-20",
      path: "src/api.ts",
    });
  });

  it("falls back to file-path document matching", () => {
    const index = buildKnowledgeContextIndex({
      traces: [],
      documents: [
        {
          path: "能力文档/src-api-模块能力.md",
          title: "src/api module",
          excerpt: "API module handoff notes",
        },
      ],
    });

    const context = resolveKnowledgeContext(index, {
      kind: "file",
      nodeId: "file:src/api.ts",
      filePath: "src/api.ts",
      title: "api.ts",
      summary: "API entry",
      complexity: "moderate",
    });

    expect(context.matchKind).toBe("filename-path");
    expect(context.documents[0].title).toBe("src/api module");
  });

  it("returns graph-only context when no document matches", () => {
    const index = buildKnowledgeContextIndex({ traces: [], documents: [] });
    const context = resolveKnowledgeContext(index, {
      kind: "layer",
      nodeId: "api",
      title: "API",
      summary: "Request entry layer",
      complexity: "simple",
    });

    expect(context.matchKind).toBe("graph-only");
    expect(context.handoffSummary).toContain("API");
    expect(context.documents).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the failing knowledge-context tests**

Run:

```bash
pnpm --filter @understand-code/dashboard test -- src/workbench/__tests__/knowledgeContext.test.ts
```

Expected: fail because `../knowledgeContext` does not exist.

- [ ] **Step 3: Implement the knowledge-context helper**

Create `packages/dashboard/src/workbench/knowledgeContext.ts`:

```ts
export type KnowledgeMatchKind = "direct-trace" | "filename-path" | "related-document" | "graph-only";

export interface KnowledgeSourceAnchor {
  filePath: string;
  lineRange?: [number, number];
  role?: string;
}

export interface KnowledgeTraceRecord {
  documentPath: string;
  title?: string;
  coveredNodeIds?: string[];
  coveredFilePaths?: string[];
  sourceAnchors?: KnowledgeSourceAnchor[];
  lowConfidenceClaims?: string[];
}

export interface KnowledgeDocumentSummary {
  path: string;
  title: string;
  excerpt?: string;
}

export interface BuildKnowledgeContextIndexInput {
  traces: KnowledgeTraceRecord[];
  documents: KnowledgeDocumentSummary[];
}

export interface KnowledgeContextIndex {
  tracesByNodeId: Map<string, KnowledgeTraceRecord[]>;
  tracesByFilePath: Map<string, KnowledgeTraceRecord[]>;
  documents: KnowledgeDocumentSummary[];
}

export interface WorkbenchSelection {
  kind: "project" | "layer" | "file" | "function" | "class";
  nodeId: string;
  title: string;
  filePath?: string;
  summary?: string;
  complexity?: string;
}

export interface KnowledgeContext {
  matchKind: KnowledgeMatchKind;
  handoffSummary: string;
  businessMeaning: string;
  changeRisks: string[];
  documents: KnowledgeDocumentSummary[];
  evidenceLinks: Array<{ label: string; path: string }>;
  confidenceLabel: string;
}

function pushMapValue<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const current = map.get(key) ?? [];
  current.push(value);
  map.set(key, current);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "");
}

function lineLabel(anchor: KnowledgeSourceAnchor): string {
  return anchor.lineRange ? `${anchor.filePath} L${anchor.lineRange[0]}-${anchor.lineRange[1]}` : anchor.filePath;
}

function traceToDocument(trace: KnowledgeTraceRecord): KnowledgeDocumentSummary {
  return {
    path: trace.documentPath,
    title: trace.title ?? trace.documentPath.split("/").pop() ?? trace.documentPath,
  };
}

export function buildKnowledgeContextIndex({
  traces,
  documents,
}: BuildKnowledgeContextIndexInput): KnowledgeContextIndex {
  const tracesByNodeId = new Map<string, KnowledgeTraceRecord[]>();
  const tracesByFilePath = new Map<string, KnowledgeTraceRecord[]>();

  for (const trace of traces) {
    for (const nodeId of trace.coveredNodeIds ?? []) pushMapValue(tracesByNodeId, nodeId, trace);
    for (const filePath of trace.coveredFilePaths ?? []) pushMapValue(tracesByFilePath, filePath, trace);
  }

  return { tracesByNodeId, tracesByFilePath, documents };
}

function findFilenameDocuments(
  documents: KnowledgeDocumentSummary[],
  selection: WorkbenchSelection,
): KnowledgeDocumentSummary[] {
  const keys = [selection.filePath, selection.title, selection.nodeId]
    .filter((value): value is string => Boolean(value))
    .map(normalize)
    .filter(Boolean);

  return documents.filter((doc) => {
    const normalizedPath = normalize(doc.path);
    return keys.some((key) => normalizedPath.includes(key));
  });
}

function risksFor(selection: WorkbenchSelection, traces: KnowledgeTraceRecord[]): string[] {
  const risks: string[] = [];
  if (selection.complexity === "complex") {
    risks.push("High-complexity code: review callers and downstream behavior before changing it.");
  }
  if (traces.some((trace) => (trace.lowConfidenceClaims ?? []).length > 0)) {
    risks.push("Some linked knowledge claims need confirmation before product or runtime decisions.");
  }
  if (risks.length === 0) {
    risks.push("No specific generated risk was linked. Use upstream and downstream graph relationships for review.");
  }
  return risks;
}

export function resolveKnowledgeContext(
  index: KnowledgeContextIndex,
  selection: WorkbenchSelection,
): KnowledgeContext {
  const directTraces = index.tracesByNodeId.get(selection.nodeId) ?? [];
  const fileTraces = selection.filePath ? index.tracesByFilePath.get(selection.filePath) ?? [] : [];
  const traces = directTraces.length > 0 ? directTraces : fileTraces;

  if (traces.length > 0) {
    const matchKind: KnowledgeMatchKind = directTraces.length > 0 ? "direct-trace" : "filename-path";
    const documents = traces.map(traceToDocument);
    const evidenceLinks = traces.flatMap((trace) =>
      (trace.sourceAnchors ?? []).map((anchor) => ({
        label: lineLabel(anchor),
        path: anchor.filePath,
      })),
    );
    return {
      matchKind,
      handoffSummary: selection.summary || `${selection.title} is linked to generated handoff documentation.`,
      businessMeaning: `Linked knowledge documents explain how ${selection.title} fits into the implementation and business context.`,
      changeRisks: risksFor(selection, traces),
      documents,
      evidenceLinks,
      confidenceLabel: matchKind === "direct-trace" ? "Direct trace match" : "File trace match",
    };
  }

  const filenameDocuments = findFilenameDocuments(index.documents, selection);
  if (filenameDocuments.length > 0) {
    return {
      matchKind: "filename-path",
      handoffSummary: selection.summary || `${selection.title} has related generated documentation.`,
      businessMeaning: filenameDocuments[0].excerpt || `Related documents may explain ${selection.title}.`,
      changeRisks: risksFor(selection, []),
      documents: filenameDocuments,
      evidenceLinks: [],
      confidenceLabel: "Filename/path match",
    };
  }

  return {
    matchKind: "graph-only",
    handoffSummary: selection.summary || `${selection.title} is available from graph-derived context.`,
    businessMeaning: "No generated knowledge document is linked yet. Showing graph-derived context.",
    changeRisks: risksFor(selection, []),
    documents: [],
    evidenceLinks: [],
    confidenceLabel: "Graph-only context",
  };
}
```

- [ ] **Step 4: Run the knowledge-context tests**

Run:

```bash
pnpm --filter @understand-code/dashboard test -- src/workbench/__tests__/knowledgeContext.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 2**

```bash
git add packages/dashboard/src/workbench/knowledgeContext.ts packages/dashboard/src/workbench/__tests__/knowledgeContext.test.ts
git commit -m "feat: resolve workbench knowledge context"
```

## Task 3: Load Optional Knowledge Assets

**Files:**
- Modify: `packages/dashboard/src/App.tsx`

- [ ] **Step 1: Add App-level knowledge asset state and loader test target**

Before editing, inspect the top of `packages/dashboard/src/App.tsx` and keep its existing imports. Add these imports near the other local imports:

```ts
import {
  buildKnowledgeContextIndex,
  type KnowledgeContextIndex,
  type KnowledgeDocumentSummary,
  type KnowledgeTraceRecord,
} from "./workbench/knowledgeContext";
```

- [ ] **Step 2: Add the optional asset URL helper**

In `packages/dashboard/src/App.tsx`, directly below `dataUrl`, add:

```ts
function optionalDataUrl(path: string, token: string | null): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return token ? `${normalizedPath}?token=${encodeURIComponent(token)}` : normalizedPath;
}
```

- [ ] **Step 3: Add loader helpers**

In `packages/dashboard/src/App.tsx`, directly below `optionalDataUrl`, add:

```ts
async function fetchOptionalJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchOptionalText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function documentsFromMarkdownIndex(markdown: string | null): KnowledgeDocumentSummary[] {
  if (!markdown) return [];
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  const documents: KnowledgeDocumentSummary[] = [];
  for (const match of markdown.matchAll(linkPattern)) {
    const [, title, path] = match;
    documents.push({ title, path });
  }
  return documents;
}

function normalizeTracePayload(payload: unknown): KnowledgeTraceRecord[] {
  if (Array.isArray(payload)) return payload as KnowledgeTraceRecord[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { traces?: unknown[] }).traces)) {
    return (payload as { traces: KnowledgeTraceRecord[] }).traces;
  }
  if (payload && typeof payload === "object" && Array.isArray((payload as { documents?: unknown[] }).documents)) {
    return (payload as { documents: KnowledgeTraceRecord[] }).documents;
  }
  return [];
}
```

- [ ] **Step 4: Wire state into `Dashboard`**

Inside `Dashboard`, add state near the existing `metaTheme` and `outputLanguage` state:

```ts
const [knowledgeContextIndex, setKnowledgeContextIndex] = useState<KnowledgeContextIndex>(
  () => buildKnowledgeContextIndex({ traces: [], documents: [] }),
);
```

Then add this `useEffect` after the config/meta loading effect:

```ts
useEffect(() => {
  let cancelled = false;

  async function loadKnowledgeContext(): Promise<void> {
    const [tracePayload, capabilityIndex, flowIndex] = await Promise.all([
      fetchOptionalJson<unknown>(optionalDataUrl("knowledge-base/.trace/document-traces.json", accessToken)),
      fetchOptionalText(optionalDataUrl("knowledge-base/业务能力索引.md", accessToken)),
      fetchOptionalText(optionalDataUrl("knowledge-base/业务流程地图.md", accessToken)),
    ]);

    if (cancelled) return;

    setKnowledgeContextIndex(
      buildKnowledgeContextIndex({
        traces: normalizeTracePayload(tracePayload),
        documents: [
          ...documentsFromMarkdownIndex(capabilityIndex),
          ...documentsFromMarkdownIndex(flowIndex),
        ],
      }),
    );
  }

  void loadKnowledgeContext();

  return () => {
    cancelled = true;
  };
}, [accessToken]);
```

- [ ] **Step 5: Pass knowledge context into `DashboardContent`**

Update `DashboardContent` props in `packages/dashboard/src/App.tsx`:

```tsx
<DashboardContent
  accessToken={accessToken}
  loadError={loadError}
  graphIssues={graphIssues}
  knowledgeContextIndex={knowledgeContextIndex}
/>
```

Update the function signature:

```ts
function DashboardContent({
  accessToken,
  loadError,
  graphIssues,
  knowledgeContextIndex,
}: {
  accessToken: string;
  loadError: string | null;
  graphIssues: GraphIssue[];
  knowledgeContextIndex: KnowledgeContextIndex;
}) {
```

- [ ] **Step 6: Check the partial App change for whitespace errors**

Run:

```bash
git diff --check -- packages/dashboard/src/App.tsx
```

Expected: no output.

- [ ] **Step 7: Leave Task 3 changes for the workbench integration commit**

Do not commit Task 3 by itself. `DashboardContent` receives `knowledgeContextIndex` in this task, and Task 5 is the first task that consumes it. Commit the App loader and workbench integration together in Task 5.

## Task 4: Add Workbench Components

**Files:**
- Create: `packages/dashboard/src/components/workbench/ModeRail.tsx`
- Create: `packages/dashboard/src/components/workbench/JourneyRail.tsx`
- Create: `packages/dashboard/src/components/workbench/KnowledgeContextPanel.tsx`
- Create: `packages/dashboard/src/components/workbench/VisualStage.tsx`
- Create: `packages/dashboard/src/components/workbench/VisualGuidedWorkbench.tsx`

- [ ] **Step 1: Create `ModeRail`**

Create `packages/dashboard/src/components/workbench/ModeRail.tsx`:

```tsx
const ITEMS = [
  { id: "structure", label: "Structure", active: true, path: "M4 7h16M4 12h10M4 17h16" },
  { id: "knowledge", label: "Knowledge", active: false, path: "M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 0-4-4V4z" },
  { id: "risk", label: "Risk", active: false, path: "M12 3l9 16H3L12 3zm0 6v4m0 3h.01" },
  { id: "search", label: "Search", active: false, path: "M10 18a8 8 0 1 1 5.3-14M15 15l5 5" },
  { id: "settings", label: "Settings", active: false, path: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0-5v3m0 12v3M3 12h3m12 0h3" },
];

export default function ModeRail() {
  return (
    <nav className="flex h-full w-[64px] shrink-0 flex-col items-center gap-2 border-r border-border-subtle bg-root px-2 py-3">
      {ITEMS.map((item) => {
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            aria-label={item.label}
            disabled={!item.active}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors ${
              item.active
                ? "border-accent/55 bg-accent/15 text-accent"
                : "border-border-subtle bg-surface text-text-muted opacity-60"
            }`}
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path d={item.path} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Create `JourneyRail`**

Create `packages/dashboard/src/components/workbench/JourneyRail.tsx`:

```tsx
import type { JourneyRoute, JourneyStep } from "../../workbench/journeyRoute";

interface JourneyRailProps {
  route: JourneyRoute;
  activeStepId: string;
  onSelectStep: (step: JourneyStep) => void;
}

function stepLabel(kind: JourneyStep["kind"]): string {
  if (kind === "project") return "Project";
  if (kind === "layer") return "Layer";
  if (kind === "file") return "File";
  return "Function";
}

export default function JourneyRail({ route, activeStepId, onSelectStep }: JourneyRailProps) {
  const activeIndex = Math.max(0, route.steps.findIndex((step) => step.id === activeStepId));
  const progress = route.steps.length <= 1 ? 0 : Math.round((activeIndex / (route.steps.length - 1)) * 100);

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-border-subtle bg-surface">
      <div className="border-b border-border-subtle px-4 py-4">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Journey</div>
        <h2 className="mt-1 truncate text-sm font-semibold text-text-primary" title={route.projectName}>
          {route.projectName}
        </h2>
        <div className="mt-3 h-1.5 overflow-hidden rounded bg-elevated">
          <div className="h-full rounded bg-accent" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-2 text-[10px] font-mono text-text-muted">{progress}% read path</div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        <div className="space-y-2">
          {route.steps.map((step, index) => {
            const active = step.id === activeStepId;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onSelectStep(step)}
                className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-accent/55 bg-accent/10"
                    : "border-border-subtle bg-elevated/55 hover:border-accent/35 hover:bg-accent/5"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    {index + 1}. {stepLabel(step.kind)}
                  </span>
                  {active && <span className="h-2 w-2 rounded-full bg-accent" />}
                </div>
                <div className="mt-1 truncate text-xs font-semibold text-text-primary" title={step.title}>
                  {step.title}
                </div>
                <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-text-muted">
                  {step.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Create `KnowledgeContextPanel`**

Create `packages/dashboard/src/components/workbench/KnowledgeContextPanel.tsx`:

```tsx
import type { KnowledgeContext } from "../../workbench/knowledgeContext";

interface KnowledgeContextPanelProps {
  context: KnowledgeContext;
}

function PanelSection({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "accent" | "risk";
}) {
  const toneClass =
    tone === "accent"
      ? "border-accent/35 bg-accent/5"
      : tone === "risk"
        ? "border-node-module/35 bg-node-module/5"
        : "border-border-subtle bg-elevated/65";
  return (
    <section className={`rounded-md border p-3 ${toneClass}`}>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{title}</h3>
      <div className="mt-2 text-xs leading-relaxed text-text-secondary">{children}</div>
    </section>
  );
}

export default function KnowledgeContextPanel({ context }: KnowledgeContextPanelProps) {
  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col gap-3 overflow-auto border-l border-border-subtle bg-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Context</div>
          <div className="mt-1 text-xs font-semibold text-accent">{context.confidenceLabel}</div>
        </div>
      </div>

      <PanelSection title="Engineer handoff" tone="accent">
        {context.handoffSummary}
      </PanelSection>

      <PanelSection title="Business meaning">
        {context.businessMeaning}
      </PanelSection>

      <PanelSection title="Change risk" tone="risk">
        <ul className="space-y-1">
          {context.changeRisks.map((risk) => (
            <li key={risk}>{risk}</li>
          ))}
        </ul>
      </PanelSection>

      <PanelSection title="Evidence links">
        {context.documents.length === 0 && context.evidenceLinks.length === 0 ? (
          <p>No generated knowledge document is linked yet. Showing graph-derived context.</p>
        ) : (
          <div className="space-y-2">
            {context.documents.map((doc) => (
              <div key={doc.path} className="rounded border border-border-subtle bg-surface px-2 py-2">
                <div className="truncate text-xs font-medium text-text-primary" title={doc.title}>
                  {doc.title}
                </div>
                <div className="mt-1 truncate font-mono text-[10px] text-text-muted" title={doc.path}>
                  {doc.path}
                </div>
              </div>
            ))}
            {context.evidenceLinks.map((link) => (
              <div key={`${link.path}:${link.label}`} className="truncate font-mono text-[10px] text-text-muted">
                {link.label}
              </div>
            ))}
          </div>
        )}
      </PanelSection>
    </aside>
  );
}
```

- [ ] **Step 4: Create `VisualStage`**

Create `packages/dashboard/src/components/workbench/VisualStage.tsx`:

```tsx
import type { ReactNode } from "react";
import type { JourneyStep } from "../../workbench/journeyRoute";

interface VisualStageProps {
  activeStep: JourneyStep;
  children: ReactNode;
}

export default function VisualStage({ activeStep, children }: VisualStageProps) {
  return (
    <main className="flex min-w-0 flex-1 flex-col bg-root">
      <div className="shrink-0 border-b border-border-subtle bg-surface/95 px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Visual stage · {activeStep.kind}
            </div>
            <h1 className="mt-1 truncate text-base font-semibold text-text-primary" title={activeStep.title}>
              {activeStep.title}
            </h1>
          </div>
          <div className="hidden shrink-0 rounded-md border border-border-subtle bg-elevated px-3 py-2 text-[10px] text-text-muted md:block">
            {activeStep.subtitle}
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </main>
  );
}
```

- [ ] **Step 5: Create `VisualGuidedWorkbench`**

Create `packages/dashboard/src/components/workbench/VisualGuidedWorkbench.tsx`:

```tsx
import { useMemo, useState } from "react";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { useDashboardStore } from "../../store";
import { buildReadableSearchMatches } from "../../viewgraph/readableSelectors";
import type { ViewGraph } from "../../viewgraph/types";
import { buildJourneyRoute, type JourneyStep } from "../../workbench/journeyRoute";
import {
  resolveKnowledgeContext,
  type KnowledgeContextIndex,
  type WorkbenchSelection,
} from "../../workbench/knowledgeContext";
import FunctionDetailPage from "../FunctionDetailPage";
import ReadableViewGraphPage from "../ReadableViewGraphPage";
import JourneyRail from "./JourneyRail";
import KnowledgeContextPanel from "./KnowledgeContextPanel";
import ModeRail from "./ModeRail";
import VisualStage from "./VisualStage";

interface VisualGuidedWorkbenchProps {
  graph: KnowledgeGraph;
  viewGraph: ViewGraph;
  knowledgeContextIndex: KnowledgeContextIndex;
}

function selectionFromStep(step: JourneyStep, viewGraph: ViewGraph): WorkbenchSelection {
  if (step.kind === "layer") {
    const layer = viewGraph.layersById.get(step.targetId);
    return {
      kind: "layer",
      nodeId: step.targetId,
      title: layer?.name ?? step.title,
      summary: layer?.description ?? step.subtitle,
      complexity: "simple",
    };
  }

  if (step.kind === "file") {
    const file = viewGraph.filesById.get(step.targetId);
    return {
      kind: "file",
      nodeId: step.targetId,
      title: file?.name ?? step.title,
      filePath: file?.filePath,
      summary: file?.node.summary ?? step.subtitle,
      complexity: file?.node.complexity,
    };
  }

  if (step.kind === "function") {
    const fileId = viewGraph.functionToFileId.get(step.targetId);
    const file = fileId ? viewGraph.filesById.get(fileId) : null;
    const dot = file?.functionDots.find((candidate) => candidate.nodeId === step.targetId);
    return {
      kind: "function",
      nodeId: step.targetId,
      title: dot?.name ?? step.title,
      filePath: file?.filePath,
      summary: step.subtitle,
      complexity: dot?.complexity,
    };
  }

  return {
    kind: "project",
    nodeId: "project",
    title: step.title,
    summary: step.subtitle,
    complexity: "simple",
  };
}

export default function VisualGuidedWorkbench({
  graph,
  viewGraph,
  knowledgeContextIndex,
}: VisualGuidedWorkbenchProps) {
  const searchResults = useDashboardStore((s) => s.searchResults);
  const navigationLevel = useDashboardStore((s) => s.navigationLevel);
  const activeFileId = useDashboardStore((s) => s.activeFileId);
  const drillIntoLayer = useDashboardStore((s) => s.drillIntoLayer);
  const openFileDetail = useDashboardStore((s) => s.openFileDetail);
  const navigateToNodeInLayer = useDashboardStore((s) => s.navigateToNodeInLayer);
  const matches = useMemo(
    () => buildReadableSearchMatches(graph, viewGraph, searchResults),
    [graph, viewGraph, searchResults],
  );
  const route = useMemo(
    () =>
      buildJourneyRoute({
        graph,
        viewGraph,
        layerMatchCounts: matches.layerMatchCounts,
        fileMatchCounts: matches.fileMatchCounts,
      }),
    [graph, viewGraph, matches.layerMatchCounts, matches.fileMatchCounts],
  );
  const [activeStepId, setActiveStepId] = useState(route.steps[0]?.id ?? "project");
  const activeStep = route.steps.find((step) => step.id === activeStepId) ?? route.steps[0];
  const context = resolveKnowledgeContext(
    knowledgeContextIndex,
    selectionFromStep(activeStep, viewGraph),
  );

  function handleSelectStep(step: JourneyStep): void {
    setActiveStepId(step.id);
    if (step.kind === "layer") drillIntoLayer(step.targetId);
    if (step.kind === "file") openFileDetail(step.targetId);
    if (step.kind === "function") navigateToNodeInLayer(step.targetId);
  }

  return (
    <div className="flex h-full min-h-0 bg-root">
      <ModeRail />
      <JourneyRail route={route} activeStepId={activeStep.id} onSelectStep={handleSelectStep} />
      <VisualStage activeStep={activeStep}>
        {navigationLevel === "file-detail" && activeFileId ? (
          <FunctionDetailPage presentation="workbench" />
        ) : (
          <ReadableViewGraphPage presentation="workbench" />
        )}
      </VisualStage>
      <KnowledgeContextPanel context={context} />
    </div>
  );
}
```

- [ ] **Step 6: Run TypeScript to expose missing dependencies**

Run:

```bash
pnpm --filter @understand-code/dashboard build
```

Expected: fail because `ReadableViewGraphPage` and `FunctionDetailPage` do not yet accept `presentation`. Resolve presentation props in Task 5.

- [ ] **Step 7: Commit Task 4 after Task 5 makes build clean**

Commit this task together with Task 5 after the presentation props are added.

## Task 5: Wrap Existing Structural Views in the Workbench

**Files:**
- Modify: `packages/dashboard/src/App.tsx`
- Modify: `packages/dashboard/src/components/ReadableViewGraphPage.tsx`
- Modify: `packages/dashboard/src/components/LayerFileGraph.tsx`
- Modify: `packages/dashboard/src/components/FunctionDetailPage.tsx`

- [ ] **Step 1: Add `presentation` to `ReadableViewGraphPage`**

Modify `packages/dashboard/src/components/ReadableViewGraphPage.tsx` function signature:

```tsx
interface ReadableViewGraphPageProps {
  presentation?: "default" | "workbench";
}

export default function ReadableViewGraphPage({
  presentation = "default",
}: ReadableViewGraphPageProps) {
```

Then update the `LayerFileGraph` usage:

```tsx
<LayerFileGraph
  graph={graph}
  viewGraph={viewGraph}
  layer={layer}
  files={files}
  fileMatchCounts={matches.fileMatchCounts}
  selectedFileId={selectedNodeId}
  onOpenFile={openFileDetail}
  presentation={presentation === "workbench" ? "workbench" : "default"}
/>
```

- [ ] **Step 2: Add `presentation` to `LayerFileGraph` props**

Modify `packages/dashboard/src/components/LayerFileGraph.tsx`:

```ts
interface LayerFileGraphProps {
  graph: KnowledgeGraph;
  viewGraph: ViewGraph;
  layer: ViewLayerSummary | null;
  files: ViewFileSummary[];
  fileMatchCounts: Map<string, number>;
  selectedFileId: string | null;
  onOpenFile: (fileId: string) => void;
  presentation?: "default" | "workbench";
}
```

Update the function parameters:

```tsx
export default function LayerFileGraph({
  graph,
  viewGraph,
  layer,
  files,
  fileMatchCounts,
  selectedFileId,
  onOpenFile,
  presentation = "default",
}: LayerFileGraphProps) {
```

In the normal non-empty render, replace the existing header block condition with:

```tsx
{presentation === "default" && (
  <div className="flex shrink-0 items-end justify-between gap-4 border-b border-border-subtle bg-surface px-5 py-3">
    <div className="min-w-0">
      <h2 className="truncate font-heading text-xl text-text-primary">
        {layer?.name ?? t.readableViewGraph.projectFiles}
      </h2>
      {layer?.description && (
        <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{layer.description}</p>
      )}
    </div>
    <div className="shrink-0 text-right">
      <div className="font-heading text-xl text-accent">{files.length}</div>
      <div className="text-[10px] uppercase text-text-muted">{t.readableViewGraph.files}</div>
    </div>
  </div>
)}
```

Keep the empty-files header unchanged so empty state remains understandable.

- [ ] **Step 3: Add `presentation` to `FunctionDetailPage`**

Modify `packages/dashboard/src/components/FunctionDetailPage.tsx` function signature:

```tsx
interface FunctionDetailPageProps {
  presentation?: "default" | "workbench";
}

export default function FunctionDetailPage({
  presentation = "default",
}: FunctionDetailPageProps) {
```

Wrap the existing top breadcrumb/header block in this condition:

```tsx
{presentation === "default" && (
  <div className="shrink-0 border-b border-border-subtle bg-surface px-5 py-3 flex items-center justify-between gap-4">
    <ViewGraphBreadcrumb />
    <button
      type="button"
      onClick={closeFileDetail}
      className="shrink-0 rounded-md border border-border-subtle bg-elevated px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:border-accent/40 transition-colors"
    >
      {t.functionDetail.backToGraph}
    </button>
  </div>
)}
```

Keep the file/function body unchanged.

- [ ] **Step 4: Render workbench in `DashboardContent`**

In `packages/dashboard/src/App.tsx`, add:

```ts
import VisualGuidedWorkbench from "./components/workbench/VisualGuidedWorkbench";
```

Replace the main content conditional section:

```tsx
{viewMode === "knowledge" ? (
  <KnowledgeGraphView />
) : viewMode === "domain" && domainGraph ? (
  <DomainGraphView />
) : navigationLevel === "file-detail" && activeFileId ? (
  <FunctionDetailPage />
) : (
  <ReadableViewGraphPage />
)}
```

with:

```tsx
{viewMode === "knowledge" ? (
  <KnowledgeGraphView />
) : viewMode === "domain" && domainGraph ? (
  <DomainGraphView />
) : !isKnowledgeGraph && graph && viewGraph ? (
  <VisualGuidedWorkbench
    graph={graph}
    viewGraph={viewGraph}
    knowledgeContextIndex={knowledgeContextIndex}
  />
) : (
  <ReadableViewGraphPage />
)}
```

Add this store selector near the existing `graph` selector at the top of `DashboardContent` before using the conditional:

```ts
const viewGraph = useDashboardStore((s) => s.viewGraph);
```

`VisualGuidedWorkbench` owns file-detail rendering in structural mode, so do not keep a separate `navigationLevel === "file-detail"` branch before it.

- [ ] **Step 5: Hide old right sidebar while workbench owns context**

In `packages/dashboard/src/App.tsx`, change:

```tsx
{navigationLevel !== "file-detail" && (
  <aside className="w-[260px] md:w-[300px] lg:w-[360px] shrink-0 bg-surface border-l border-border-subtle overflow-auto">
    {sidebarContent}
  </aside>
)}
```

to:

```tsx
{(viewMode !== "structural" || isKnowledgeGraph) && navigationLevel !== "file-detail" && (
  <aside className="w-[260px] md:w-[300px] lg:w-[360px] shrink-0 bg-surface border-l border-border-subtle overflow-auto">
    {sidebarContent}
  </aside>
)}
```

- [ ] **Step 6: Run build**

Run:

```bash
pnpm --filter @understand-code/dashboard build
```

Expected: pass after resolving import and prop errors.

- [ ] **Step 7: Commit Tasks 4 and 5**

```bash
git add packages/dashboard/src/components/workbench packages/dashboard/src/App.tsx packages/dashboard/src/components/ReadableViewGraphPage.tsx packages/dashboard/src/components/LayerFileGraph.tsx packages/dashboard/src/components/FunctionDetailPage.tsx
git commit -m "feat: add visual guided workbench shell"
```

## Task 6: Add Component Tests for the Workbench Shell

**Files:**
- Create: `packages/dashboard/src/components/workbench/__tests__/VisualGuidedWorkbench.test.tsx`

- [ ] **Step 1: Write component smoke tests**

Create `packages/dashboard/src/components/workbench/__tests__/VisualGuidedWorkbench.test.tsx`:

```tsx
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { buildViewGraph } from "../../../viewgraph/buildViewGraph";
import { buildKnowledgeContextIndex } from "../../../workbench/knowledgeContext";
import VisualGuidedWorkbench from "../VisualGuidedWorkbench";

vi.mock("../../ReadableViewGraphPage", () => ({
  default: () => <div>Readable view graph mock</div>,
}));

vi.mock("../../FunctionDetailPage", () => ({
  default: () => <div>Function detail mock</div>,
}));

function graph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    project: {
      name: "visual-app",
      languages: ["ts"],
      frameworks: ["react"],
      description: "",
      analyzedAt: "2026-07-03T00:00:00.000Z",
      gitCommitHash: "local",
    },
    nodes: [
      { id: "file:src/app.tsx", type: "file", name: "app.tsx", filePath: "src/app.tsx", summary: "App UI", tags: [], complexity: "complex" },
      { id: "function:src/app.tsx:App", type: "function", name: "App", filePath: "src/app.tsx", lineRange: [1, 30], summary: "Renders app", tags: [], complexity: "complex", isExported: true },
    ],
    edges: [
      { source: "file:src/app.tsx", target: "function:src/app.tsx:App", type: "contains", direction: "forward", weight: 1 },
    ],
    layers: [
      { id: "ui", name: "UI", description: "User interface", nodeIds: ["file:src/app.tsx"] },
    ],
    tour: [],
  };
}

describe("VisualGuidedWorkbench", () => {
  it("renders journey, visual stage, and graph-only context", () => {
    const raw = graph();
    const html = renderToString(
      <VisualGuidedWorkbench
        graph={raw}
        viewGraph={buildViewGraph(raw)}
        knowledgeContextIndex={buildKnowledgeContextIndex({ traces: [], documents: [] })}
      />,
    );

    expect(html).toContain("Journey");
    expect(html).toContain("Visual stage");
    expect(html).toContain("Engineer handoff");
    expect(html).toContain("Graph-only context");
  });
});
```

- [ ] **Step 2: Run the workbench component test**

Run:

```bash
pnpm --filter @understand-code/dashboard test -- src/components/workbench/__tests__/VisualGuidedWorkbench.test.tsx
```

Expected: pass.

- [ ] **Step 3: Run related model and component tests**

Run:

```bash
pnpm --filter @understand-code/dashboard test -- src/workbench/__tests__/journeyRoute.test.ts src/workbench/__tests__/knowledgeContext.test.ts src/components/workbench/__tests__/VisualGuidedWorkbench.test.tsx
```

Expected: pass.

- [ ] **Step 4: Commit Task 6**

```bash
git add packages/dashboard/src/components/workbench/__tests__/VisualGuidedWorkbench.test.tsx
git commit -m "test: cover visual guided workbench shell"
```

## Task 7: Polish Workbench Styling and Accessibility

**Files:**
- Modify: `packages/dashboard/src/components/workbench/ModeRail.tsx`
- Modify: `packages/dashboard/src/components/workbench/JourneyRail.tsx`
- Modify: `packages/dashboard/src/components/workbench/KnowledgeContextPanel.tsx`
- Modify: `packages/dashboard/src/components/workbench/VisualStage.tsx`

- [ ] **Step 1: Check for one-note palette and oversized text**

Run:

```bash
rg -n "purple|violet|from-|to-|text-4xl|text-5xl|tracking-\\[-|rounded-2xl|rounded-3xl" packages/dashboard/src/components/workbench packages/dashboard/src/index.css
```

Expected: no purple/gradient-heavy workbench styling, no viewport-scaled or hero-sized text, no negative tracking. `rounded-2xl` or `rounded-3xl` should not appear in workbench files.

- [ ] **Step 2: Tighten stable dimensions**

Ensure `ModeRail` buttons keep stable dimensions:

```tsx
className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors ${
```

Ensure `JourneyRail` has fixed width:

```tsx
<aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-border-subtle bg-surface">
```

Ensure `KnowledgeContextPanel` has fixed desktop width:

```tsx
<aside className="flex h-full w-[340px] shrink-0 flex-col gap-3 overflow-auto border-l border-border-subtle bg-panel p-4">
```

- [ ] **Step 3: Verify icon buttons have accessible names**

In `ModeRail`, each icon button must include both:

```tsx
title={item.label}
aria-label={item.label}
```

- [ ] **Step 4: Run build and focused tests**

Run:

```bash
pnpm --filter @understand-code/dashboard build
pnpm --filter @understand-code/dashboard test -- src/workbench/__tests__/journeyRoute.test.ts src/workbench/__tests__/knowledgeContext.test.ts src/components/workbench/__tests__/VisualGuidedWorkbench.test.tsx
```

Expected: both commands pass.

- [ ] **Step 5: Commit Task 7**

```bash
git add packages/dashboard/src/components/workbench packages/dashboard/src/index.css
git commit -m "style: polish visual guided workbench"
```

## Task 8: Manual Verification

**Files:**
- Source files stay unchanged during verification. A discovered defect becomes a focused follow-up task before editing.

- [ ] **Step 1: Start the dashboard dev server**

Run:

```bash
pnpm --filter @understand-code/dashboard dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL such as `http://127.0.0.1:5173/`.

- [ ] **Step 2: Open the dashboard**

Open the Vite URL in the in-app browser or regular browser.

Expected:

- Structural desktop mode shows a left mode rail.
- Journey rail is visible.
- Central visual stage is larger than either side panel.
- Right context panel is visible.
- The old right sidebar is not duplicated in structural mode.

- [ ] **Step 3: Exercise route navigation**

Click one layer step, one file step, and one function step in the journey rail.

Expected:

- Layer step opens layer detail.
- File step opens file detail inside the workbench visual stage.
- Function step navigates to the containing file detail and selected function.
- Right context panel updates its title/summary and confidence label.

- [ ] **Step 4: Verify missing knowledge base fallback**

Run with no `knowledge-base` assets in the served public root.

Expected:

- No crash.
- Context panel shows `Graph-only context`.
- Evidence section says no generated knowledge document is linked yet.

- [ ] **Step 5: Verify optional knowledge base match**

Place a minimal served file at `packages/dashboard/public/knowledge-base/.trace/document-traces.json` for local verification:

```json
[
  {
    "documentPath": "关键函数专题/sample.md",
    "title": "Sample handoff",
    "coveredNodeIds": ["file:src/app.tsx"],
    "coveredFilePaths": ["src/app.tsx"],
    "sourceAnchors": [{ "filePath": "src/app.tsx", "lineRange": [1, 10], "role": "primary" }],
    "lowConfidenceClaims": []
  }
]
```

Expected:

- Matching selection shows `Direct trace match` or `File trace match`.
- Evidence links include `src/app.tsx L1-10`.

Delete this verification file before committing.

- [ ] **Step 6: Final verification commands**

Run:

```bash
pnpm --filter @understand-code/dashboard build
pnpm --filter @understand-code/dashboard test -- src/workbench/__tests__/journeyRoute.test.ts src/workbench/__tests__/knowledgeContext.test.ts src/components/workbench/__tests__/VisualGuidedWorkbench.test.tsx
```

Expected: pass.

- [ ] **Step 7: Finish verification**

When manual verification finds a defect, stop and create a focused follow-up task that names the failing behavior, the file to edit, and the verification command. Do not mix unplanned source edits into this verification task.

When manual verification passes, do not create a commit for this task.

## Self-Review

Spec coverage:

- Visual guided workbench shell: Tasks 4, 5, 7, 8.
- Journey rail and deterministic route: Task 1 and Task 4.
- Knowledge context panel and optional knowledge docs: Tasks 2, 3, 4, 8.
- Existing graph as primary navigation: Tasks 4 and 5 reuse `ReadableViewGraphPage`, `LayerFileGraph`, and `FunctionDetailPage`.
- Empty and error states: Tasks 2, 3, and 8 cover graph-only and missing knowledge assets.
- Testing: Tasks 1, 2, 6, 7, and 8.

Placeholder scan:

- No task uses unspecified future work, generic "add tests", or missing helper names.

Type consistency:

- `JourneyStep`, `JourneyRoute`, `KnowledgeContextIndex`, `WorkbenchSelection`, and `KnowledgeContext` are defined before component tasks use them.
- Component props match the helper exports.
