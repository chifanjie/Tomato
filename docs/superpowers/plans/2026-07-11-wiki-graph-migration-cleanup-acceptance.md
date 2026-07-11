# Wiki and Graph Migration, Cleanup, Performance, and Acceptance Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove unreachable inherited product surfaces and their state, move semantic graph layout off the main thread with an identical fallback, prove large-repository reachability, and complete browser, accessibility, migration, and real-repository acceptance.

**Architecture:** Treat `src/main.tsx` as the only product entry and enforce its reachable module boundary with a deterministic audit. Delete the old toolbench only after Plan 3 has extracted the selected-neighbor edge interaction. Keep the active Zustand store limited to Wiki, Graph, search, evidence, layout issues, and cross-surface navigation. Reuse the existing Dagre layout worker through a typed client; the worker and synchronous fallback call the same pure layout function. Finish with artifact validation and a browser acceptance run against a source-backed real repository.

**Tech Stack:** React 19, TypeScript 5.7, Zustand 5, Vite 6, Vitest 3, Dagre 2, Node.js ESM, pnpm workspaces, Codex in-app Browser

## Dependency Gate

- Complete `2026-07-11-wiki-v2-knowledge-generation.md`.
- Complete `2026-07-11-wiki-reading-search-reference.md`.
- Complete `2026-07-11-progressive-graph-interaction.md`.
- Confirm Plan 3 tests cover selected-neighbor highlighting, flowing edges, no terminal arrowheads, and reduced motion before deleting `GraphView.tsx`.
- Work on the existing dirty worktree. Never reset or stage unrelated files, especially `docs/review/`.
- Design source: `docs/superpowers/specs/2026-07-11-wiki-graph-experience-design.md`.

## Files Added by This Plan

- `packages/dashboard/scripts/audit-active-surface.mjs`
- `packages/dashboard/scripts/verify-wiki-graph-artifacts.mjs`
- `packages/dashboard/src/__tests__/activeSurfaceBoundary.test.ts`
- `packages/dashboard/src/__tests__/artifactVerifier.test.ts`
- `packages/dashboard/src/graphExplorer/layoutClient.ts`
- `packages/dashboard/src/utils/layoutAlgorithm.ts`
- `packages/dashboard/src/graphExplorer/__tests__/layoutClient.test.ts`
- `packages/dashboard/src/graphExplorer/__tests__/largeRepositoryFixture.ts`
- `packages/dashboard/src/graphExplorer/__tests__/largeRepositoryAcceptance.test.ts`
- `packages/dashboard/src/__tests__/simplifiedChineseSurface.test.ts`

## Files Modified by This Plan

- `packages/dashboard/package.json`
- `packages/dashboard/src/store.ts`
- `packages/dashboard/src/components/ThemePicker.tsx`
- `packages/dashboard/src/__tests__/storeNavigation.test.ts`
- `packages/dashboard/src/utils/layout.worker.ts`
- `packages/dashboard/src/components/graphExplorer/SemanticGraphCanvas.tsx`
- `packages/dashboard/src/components/graphExplorer/__tests__/FlowingSemanticEdge.test.ts`
- `packages/dashboard/src/components/wiki/__tests__/WikiResponsiveShell.test.ts`
- `packages/dashboard/src/__tests__/appSurfaceRouting.test.ts`
- `packages/dashboard/vite.config.ts`

---

### Task 1: Freeze the active product boundary before deleting legacy code

**Files:**
- Create: `packages/dashboard/scripts/audit-active-surface.mjs`
- Create: `packages/dashboard/src/__tests__/activeSurfaceBoundary.test.ts`
- Modify: `packages/dashboard/package.json`

**Interface:** `pnpm --filter @understand-code/dashboard audit:surface` prints the relative files reachable from `src/main.tsx` and exits non-zero when a removed product surface becomes reachable again.

- [ ] **Step 1: Create the failing boundary test**

```ts
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dashboardRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("active dashboard surface", () => {
  it("contains no reachable inherited toolbench", () => {
    const stdout = execFileSync("node", ["scripts/audit-active-surface.mjs", "--json"], {
      cwd: dashboardRoot,
      encoding: "utf8",
    });
    const result = JSON.parse(stdout) as { forbiddenReachable: string[] };
    expect(result.forbiddenReachable).toEqual([]);
  });

  it("does not import a removed shell from the application entry", () => {
    const source = readFileSync(join(dashboardRoot, "src/App.tsx"), "utf8");
    for (const moduleName of ["MobileLayout", "VisualGuidedWorkbench", "GraphView", "DomainGraphView", "KnowledgeGraphView"]) {
      expect(source).not.toMatch(new RegExp(`from ["'][^"']*${moduleName}`));
    }
  });
});
```

- [ ] **Step 2: Run the test and verify the audit script is missing**

```bash
pnpm --filter @understand-code/dashboard exec vitest run src/__tests__/activeSurfaceBoundary.test.ts
```

Expected: FAIL because `scripts/audit-active-surface.mjs` does not exist.

- [ ] **Step 3: Add a deterministic relative-import reachability audit**

Create `packages/dashboard/scripts/audit-active-surface.mjs` with this complete implementation:

```js
#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dashboardRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(dashboardRoot, "src");
const entry = resolve(sourceRoot, "main.tsx");
const extensions = [".ts", ".tsx", ".js", ".jsx"];
const forbidden = new Set([
  "components/MobileLayout.tsx",
  "components/MobileDrawer.tsx",
  "components/MobileBottomNav.tsx",
  "components/workbench/VisualGuidedWorkbench.tsx",
  "components/GraphView.tsx",
  "components/DomainGraphView.tsx",
  "components/KnowledgeGraphView.tsx",
  "components/LayerFileGraph.tsx",
  "components/LayerLegend.tsx",
  "components/PersonaSelector.tsx",
  "components/DiffToggle.tsx",
  "components/FilterPanel.tsx",
  "components/ExportMenu.tsx",
  "components/PathFinderModal.tsx",
  "components/KeyboardShortcutsHelp.tsx",
  "components/OnboardingOverlay.tsx",
  "components/FileExplorer.tsx",
  "components/NodeInfo.tsx",
  "components/CodeViewer.tsx",
  "components/LearnPanel.tsx",
  "components/SearchBar.tsx",
  "components/FunctionDetailPage.tsx",
  "components/ReadableViewGraphPage.tsx",
  "components/ReadingAssistantPanel.tsx",
]);

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [
    base,
    ...extensions.map((extension) => `${base}${extension}`),
    ...extensions.map((extension) => resolve(base, `index${extension}`)),
  ];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

export function collectReachableFiles() {
  const reachable = new Set();
  const queue = [entry];
  const importPattern = /(?:import|export)\s+(?:[^'"()]*?\s+from\s*)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || reachable.has(current)) continue;
    reachable.add(current);
    const source = readFileSync(current, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const imported = resolveImport(current, match[1] ?? match[2]);
      if (imported && !reachable.has(imported)) queue.push(imported);
    }
  }
  return [...reachable].map((file) => relative(sourceRoot, file).replaceAll("\\", "/")).sort();
}

const reachable = collectReachableFiles();
const forbiddenReachable = reachable.filter((file) => forbidden.has(file));
const result = { entry: "src/main.tsx", reachable, forbiddenReachable };
if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(result)}\n`);
else process.stdout.write(`${reachable.join("\n")}\n`);
if (forbiddenReachable.length > 0) {
  process.stderr.write(`Removed surfaces are reachable: ${forbiddenReachable.join(", ")}\n`);
  process.exitCode = 1;
}
```

Add the exact script to `packages/dashboard/package.json`:

```json
"audit:surface": "node scripts/audit-active-surface.mjs"
```

- [ ] **Step 4: Run the boundary and build checks**

```bash
pnpm --filter @understand-code/dashboard audit:surface
pnpm --filter @understand-code/dashboard exec vitest run src/__tests__/activeSurfaceBoundary.test.ts
pnpm --filter @understand-code/dashboard build
```

Expected: all PASS. The audit output includes `components/wiki/KnowledgeConsole.tsx` and `components/graphExplorer/GraphExplorer.tsx`, and includes none of the forbidden modules.

- [ ] **Step 5: Commit the product boundary**

```bash
git add packages/dashboard/scripts/audit-active-surface.mjs \
  packages/dashboard/src/__tests__/activeSurfaceBoundary.test.ts \
  packages/dashboard/package.json
git commit -m "test(dashboard): freeze active wiki graph surface"
```

---

### Task 2: Remove inherited state and unreachable product surfaces

**Files:**
- Modify: `packages/dashboard/src/App.tsx`
- Modify: `packages/dashboard/src/components/ThemePicker.tsx`
- Modify: `packages/dashboard/src/store.ts`
- Modify: `packages/dashboard/src/__tests__/appSurfaceRouting.test.ts`
- Modify: `packages/dashboard/src/__tests__/storeNavigation.test.ts`
- Delete the files listed below under **Deletion Manifest**.

**Deletion Manifest — legacy shells and controls:**

```text
packages/dashboard/src/components/Breadcrumb.tsx
packages/dashboard/src/components/CodeViewer.tsx
packages/dashboard/src/components/ContainerNode.tsx
packages/dashboard/src/components/CustomNode.tsx
packages/dashboard/src/components/DiffToggle.tsx
packages/dashboard/src/components/DomainClusterNode.tsx
packages/dashboard/src/components/DomainGraphView.tsx
packages/dashboard/src/components/ExportMenu.tsx
packages/dashboard/src/components/FileExplorer.tsx
packages/dashboard/src/components/FilterPanel.tsx
packages/dashboard/src/components/FlowNode.tsx
packages/dashboard/src/components/FunctionDetailPage.tsx
packages/dashboard/src/components/FunctionMatrixPanel.tsx
packages/dashboard/src/components/GraphView.tsx
packages/dashboard/src/components/KeyboardShortcutsHelp.tsx
packages/dashboard/src/components/KnowledgeGraphView.tsx
packages/dashboard/src/components/LayerClusterNode.tsx
packages/dashboard/src/components/LayerFileGraph.tsx
packages/dashboard/src/components/LayerFileGraphNode.tsx
packages/dashboard/src/components/LayerFileHeatmap.tsx
packages/dashboard/src/components/LayerLegend.tsx
packages/dashboard/src/components/LayerOverviewPanel.tsx
packages/dashboard/src/components/LearnPanel.tsx
packages/dashboard/src/components/MobileBottomNav.tsx
packages/dashboard/src/components/MobileDrawer.tsx
packages/dashboard/src/components/MobileLayout.tsx
packages/dashboard/src/components/NodeInfo.tsx
packages/dashboard/src/components/NodeTooltip.tsx
packages/dashboard/src/components/OnboardingOverlay.tsx
packages/dashboard/src/components/PathFinderModal.tsx
packages/dashboard/src/components/PersonaSelector.tsx
packages/dashboard/src/components/PortalNode.tsx
packages/dashboard/src/components/ProjectOverview.tsx
packages/dashboard/src/components/ReadableViewGraphPage.tsx
packages/dashboard/src/components/ReadingAssistantPanel.tsx
packages/dashboard/src/components/SearchBar.tsx
packages/dashboard/src/components/StepNode.tsx
packages/dashboard/src/components/ViewGraphBreadcrumb.tsx
packages/dashboard/src/components/nodeDisplayLabels.ts
packages/dashboard/src/components/readingAssistantModel.ts
packages/dashboard/src/components/readingRoute.ts
packages/dashboard/src/components/workbench/JourneyRail.tsx
packages/dashboard/src/components/workbench/KnowledgeContextPanel.tsx
packages/dashboard/src/components/workbench/ModeRail.tsx
packages/dashboard/src/components/workbench/VisualGuidedWorkbench.tsx
packages/dashboard/src/components/workbench/VisualStage.tsx
```

**Deletion Manifest — source helpers that become unreachable after store reduction:**

```text
packages/dashboard/src/viewgraph/buildViewGraph.ts
packages/dashboard/src/viewgraph/fileRelationships.ts
packages/dashboard/src/viewgraph/functionGrouping.ts
packages/dashboard/src/viewgraph/functionImpact.ts
packages/dashboard/src/viewgraph/layerFileGraphModel.ts
packages/dashboard/src/viewgraph/readableSelectors.ts
packages/dashboard/src/viewgraph/types.ts
packages/dashboard/src/workbench/journeyRoute.ts
packages/dashboard/src/workbench/knowledgeContext.ts
packages/dashboard/src/utils/containers.ts
packages/dashboard/src/utils/edgeAggregation.ts
packages/dashboard/src/utils/filters.ts
packages/dashboard/src/utils/layerStats.ts
packages/dashboard/src/utils/louvain.ts
packages/dashboard/src/utils/viewModeControls.ts
```

**Deletion Manifest — inactive multilingual shell:**

```text
packages/dashboard/src/contexts/I18nContext.tsx
packages/dashboard/src/locales/en.ts
packages/dashboard/src/locales/index.ts
packages/dashboard/src/locales/ja.ts
packages/dashboard/src/locales/ko.ts
packages/dashboard/src/locales/ru.ts
packages/dashboard/src/locales/zh-TW.ts
packages/dashboard/src/locales/zh.ts
```

Keep `packages/dashboard/src/workbench/knowledgeContextLoader.ts` and `packages/dashboard/src/utils/layout.worker.ts`. Keep `packages/dashboard/src/utils/layout.ts` and `packages/dashboard/src/utils/elk-layout.ts` only through Task 2 because `SemanticGraphCanvas` still imports them; Task 3 removes them after worker parity is proven.

Delete tests whose only subject is in the manifest:

```text
packages/dashboard/src/components/__tests__/FunctionDetailPage.test.ts
packages/dashboard/src/components/__tests__/MobileLayout.test.ts
packages/dashboard/src/components/__tests__/readingAssistantModel.test.ts
packages/dashboard/src/components/__tests__/readingRoute.test.ts
packages/dashboard/src/utils/__tests__/containers.test.ts
packages/dashboard/src/utils/__tests__/edgeAggregation.test.ts
packages/dashboard/src/utils/__tests__/filters.test.ts
packages/dashboard/src/utils/__tests__/layerStats.test.ts
packages/dashboard/src/utils/__tests__/viewModeControls.test.ts
packages/dashboard/src/viewgraph/__tests__/buildViewGraph.test.ts
packages/dashboard/src/viewgraph/__tests__/fileRelationships.test.ts
packages/dashboard/src/viewgraph/__tests__/functionImpact.test.ts
packages/dashboard/src/viewgraph/__tests__/layerFileGraphModel.test.ts
packages/dashboard/src/viewgraph/__tests__/readableSelectors.test.ts
packages/dashboard/src/workbench/__tests__/journeyRoute.test.ts
packages/dashboard/src/workbench/__tests__/knowledgeContext.test.ts
```

- [ ] **Step 1: Add a failing store-source regression**

Append this test to `storeNavigation.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

it("does not retain state for removed controls", () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../store.ts"), "utf8");
  for (const removed of [
    "viewGraph", "nodesById", "searchQuery", "searchResults", "searchEngine", "searchMode",
    "navigationLevel", "activeLayerId", "activeFileId", "focusNodeId", "nodeHistory",
    "persona", "diffMode", "filterPanelOpen", "exportMenuOpen", "pathFinderOpen",
    "reactFlowInstance", "viewMode", "domainGraph", "tourActive", "codeViewerOpen",
    "detailLevel", "nodeTypeFilters", "expandedContainers", "containerLayoutCache",
  ]) {
    expect(source).not.toMatch(new RegExp(`\\b${removed}\\b`));
  }
});
```

- [ ] **Step 2: Verify the regression fails against the inherited store**

```bash
pnpm --filter @understand-code/dashboard exec vitest run src/__tests__/storeNavigation.test.ts
```

Expected: FAIL and list the retained legacy state names.

- [ ] **Step 3: Reduce `DashboardStore` to the active contract**

Remove the types, initial values, selectors, actions, and imports used only by the deletion manifest. Preserve the exact state used by Plans 2–3:

```ts
interface DashboardStore {
  graph: KnowledgeGraph | null;
  selectedNodeId: string | null;
  dashboardSurface: "wiki" | "graph";
  wikiIndex: WikiRuntimeIndex;
  activeWikiPageId: string | null;
  pendingWikiAnchor: string | null;
  graphExplorerMode: "architecture" | "call" | "coverage";
  graphFocusNodeIds: string[];
  graphFocusPageId: string | null;
  graphWikiNotice: string | null;
  layoutIssues: GraphIssue[];
  setConsoleGraph(graph: KnowledgeGraph): void;
  setDashboardSurface(surface: "wiki" | "graph"): void;
  setWikiIndex(index: WikiRuntimeIndex): void;
  selectWikiPage(pageId: string | null, anchor?: string | null): void;
  openWikiTarget(target: { pageId: string; anchor?: string }): void;
  consumePendingWikiAnchor(anchor: string): void;
  selectNode(nodeId: string | null): void;
  setGraphExplorerMode(mode: "architecture" | "call" | "coverage"): void;
  openGraphForWikiPage(pageId: string): void;
  clearGraphFocus(): void;
  openWikiForGraphNode(nodeId: string): void;
  appendLayoutIssues(issues: GraphIssue[]): void;
  clearLayoutIssues(): void;
}
```

Global-search open/query/result state remains shell-local in `App.tsx` as specified by Plan 2 and must not be added to Zustand. `setConsoleGraph` must only set `graph`; it must not rebuild `ViewGraph`, legacy `SearchEngine`, containers, filters, tour state, or React Flow instances.

Remove `shouldShowOnboarding` and its compatibility comment from `App.tsx`, then delete the corresponding legacy assertions from `appSurfaceRouting.test.ts`. Deep links remain limited to Wiki page hashes, `#graph`, and the token query parameter.

The application is now intentionally Simplified-Chinese-only. Remove `I18nProvider` from `App.tsx` and replace the four remaining `ThemePicker` lookups with exact copy: `切换主题`, `主题`, `主题`, and `强调色`. Then delete the inactive context/locales manifest. Theme preset and accent names are already Simplified Chinese and remain data-driven.

- [ ] **Step 4: Delete the exact manifest and prove no surviving import points at it**

Delete only the manifest paths. Then run:

```bash
rg -n "GraphView|MobileLayout|PersonaSelector|DiffToggle|FilterPanel|ExportMenu|PathFinderModal|viewModeControls|buildViewGraph|useI18n|I18nProvider" packages/dashboard/src packages/dashboard/scripts
```

Expected: only the forbidden-name literals in `activeSurfaceBoundary.test.ts` and `audit-active-surface.mjs`; no import statement refers to a deleted file.

- [ ] **Step 5: Run active tests, audit, and TypeScript build**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/__tests__/activeSurfaceBoundary.test.ts \
  src/__tests__/appSurfaceRouting.test.ts \
  src/__tests__/storeNavigation.test.ts \
  src/components/wiki/__tests__/GlobalWikiSearch.test.ts \
  src/components/graphExplorer/__tests__/FlowingSemanticEdge.test.ts
pnpm --filter @understand-code/dashboard audit:surface
pnpm --filter @understand-code/dashboard test
pnpm --filter @understand-code/dashboard build
```

Expected: all PASS. The build is the reference check that proves no compiled source consumes a deleted module.

- [ ] **Step 6: Commit the cleanup separately**

```bash
git add packages/dashboard/src/App.tsx packages/dashboard/src/store.ts \
  packages/dashboard/src/components/ThemePicker.tsx \
  packages/dashboard/src/__tests__/appSurfaceRouting.test.ts \
  packages/dashboard/src/__tests__/storeNavigation.test.ts
git diff --name-only --diff-filter=D -- packages/dashboard/src/components \
  packages/dashboard/src/viewgraph packages/dashboard/src/workbench packages/dashboard/src/utils \
  packages/dashboard/src/contexts packages/dashboard/src/locales
git diff --name-only --diff-filter=D -z -- packages/dashboard/src/components \
  packages/dashboard/src/viewgraph packages/dashboard/src/workbench packages/dashboard/src/utils \
  packages/dashboard/src/contexts packages/dashboard/src/locales \
  | xargs -0 git add -u --
git status --short
git commit -m "refactor(dashboard): remove inherited toolbench state"
```

Before running the NUL-safe staging pipeline, compare its printed deletion list with the three exact manifests above. Stop if any extra deletion appears. Before committing, verify the staged set contains only the manifests, `App.tsx`, `store.ts`, `appSurfaceRouting.test.ts`, and `storeNavigation.test.ts`.

---

### Task 3: Reuse the layout worker with an identical synchronous fallback

**Files:**
- Modify: `packages/dashboard/src/utils/layout.worker.ts`
- Create: `packages/dashboard/src/utils/layoutAlgorithm.ts`
- Create: `packages/dashboard/src/graphExplorer/layoutClient.ts`
- Create: `packages/dashboard/src/graphExplorer/__tests__/layoutClient.test.ts`
- Modify: `packages/dashboard/src/components/graphExplorer/SemanticGraphCanvas.tsx`
- Modify: `packages/dashboard/package.json`
- Modify: `packages/dashboard/vite.config.ts`
- Modify: `pnpm-lock.yaml`
- Delete: `packages/dashboard/src/utils/layout.ts`
- Delete: `packages/dashboard/src/utils/elk-layout.ts`
- Delete: `packages/dashboard/src/utils/__tests__/elk-layout.test.ts`
- Delete: `packages/dashboard/src/utils/__tests__/smoke.test.ts`

**Interfaces:**
- `computeLayout(message: LayoutMessage): LayoutResult` in `layoutAlgorithm.ts` is the single layout implementation shared by worker and fallback.
- `requestSemanticLayout(input, options): Promise<LayoutResult>` uses a module worker when available and `computeLayout` otherwise.
- Selection changes do not produce a new layout request.

- [ ] **Step 1: Write failing worker/fallback parity tests**

```ts
import { describe, expect, it } from "vitest";
import { requestSemanticLayout } from "../layoutClient.js";
import { computeLayout, type LayoutMessage } from "../../utils/layoutAlgorithm.js";

const input: LayoutMessage = {
  requestId: 7,
  nodes: [
    { id: "a", width: 240, height: 120 },
    { id: "b", width: 240, height: 120 },
    { id: "c", width: 240, height: 120 },
  ],
  edges: [{ source: "a", target: "b" }, { source: "b", target: "c" }],
  direction: "LR",
};

describe("semantic layout client", () => {
  it("uses the same deterministic positions without Worker support", async () => {
    const expected = computeLayout(input);
    const actual = await requestSemanticLayout(input, { createWorker: null });
    expect(actual).toEqual({ ...expected, execution: "synchronous" });
  });

  it("accepts a worker result and terminates the one-shot worker", async () => {
    let terminated = false;
    const actual = await requestSemanticLayout(input, {
      createWorker: () => ({
        postMessage(message: LayoutMessage) {
          queueMicrotask(() => this.onmessage?.({ data: computeLayout(message) } as MessageEvent));
        },
        onmessage: null,
        onerror: null,
        terminate() { terminated = true; },
      }),
    });
    expect(actual.execution).toBe("worker");
    expect(actual.positions).toEqual(computeLayout(input).positions);
    expect(terminated).toBe(true);
  });
});
```

- [ ] **Step 2: Run and verify the client/pure export is missing**

```bash
pnpm --filter @understand-code/dashboard exec vitest run src/graphExplorer/__tests__/layoutClient.test.ts
```

Expected: FAIL because `layoutClient.ts` and `computeLayout` do not exist.

- [ ] **Step 3: Extract one pure layout algorithm and make the existing worker a transport**

Create `layoutAlgorithm.ts` with the existing worker shapes and this complete implementation:

```ts
import dagre from "@dagrejs/dagre";

export interface LayoutMessage {
  requestId: number;
  nodes: Array<{ id: string; width: number; height: number }>;
  edges: Array<{ source: string; target: string }>;
  direction: "TB" | "LR";
}

export interface LayoutResult {
  requestId: number;
  positions: Record<string, { x: number; y: number }>;
}

export function computeLayout({ requestId, nodes, edges, direction }: LayoutMessage): LayoutResult {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: direction, nodesep: 72, ranksep: 145, marginx: 56, marginy: 56 });
  for (const node of nodes) graph.setNode(node.id, { width: node.width, height: node.height });
  for (const edge of edges) graph.setEdge(edge.source, edge.target);
  dagre.layout(graph);
  return {
    requestId,
    positions: Object.fromEntries(nodes.map((node) => {
      const point = graph.node(node.id) as { x: number; y: number } | undefined;
      return [node.id, point
        ? { x: point.x - node.width / 2, y: point.y - node.height / 2 }
        : { x: 0, y: 0 }];
    })),
  };
}

```

Replace `layout.worker.ts` with transport-only code so importing the synchronous fallback in the browser never assigns `window.onmessage`:

```ts
import { computeLayout, type LayoutMessage } from "./layoutAlgorithm.js";

self.onmessage = (event: MessageEvent<LayoutMessage>) => {
  self.postMessage(computeLayout(event.data));
};
```

- [ ] **Step 4: Add the typed one-shot worker client**

Create `layoutClient.ts`:

```ts
import { computeLayout, type LayoutMessage, type LayoutResult } from "../utils/layoutAlgorithm.js";

interface WorkerLike {
  postMessage(message: LayoutMessage): void;
  onmessage: ((event: MessageEvent<LayoutResult>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate(): void;
}

export interface SemanticLayoutResult extends LayoutResult {
  execution: "worker" | "synchronous";
}

type WorkerFactory = (() => WorkerLike) | null;

function defaultWorkerFactory(): WorkerLike | null {
  if (typeof Worker === "undefined") return null;
  return new Worker(new URL("../utils/layout.worker.ts", import.meta.url), { type: "module" });
}

export async function requestSemanticLayout(
  input: LayoutMessage,
  options: { createWorker?: WorkerFactory } = {},
): Promise<SemanticLayoutResult> {
  const worker = options.createWorker === undefined
    ? defaultWorkerFactory()
    : options.createWorker?.() ?? null;
  if (!worker) return { ...computeLayout(input), execution: "synchronous" };
  return await new Promise((resolve) => {
    let settled = false;
    const finish = (result: SemanticLayoutResult) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      worker.terminate();
      resolve(result);
    };
    const fallback = () => finish({ ...computeLayout(input), execution: "synchronous" });
    const timeout = globalThis.setTimeout(fallback, 8_000);
    worker.onmessage = (event) => finish({ ...event.data, execution: "worker" });
    worker.onerror = () => fallback();
    worker.postMessage(input);
  });
}
```

Do not add a second layout algorithm or separate worker-only spacing constants.

- [ ] **Step 5: Replace the main-thread ELK call in `SemanticGraphCanvas`**

Convert the existing nodes and edges to `LayoutMessage`, call `requestSemanticLayout`, and merge `positions` by node ID. Keep compact scope overview positioning unchanged. Set `computing: true` before the request and show the existing Chinese progress state. The effect dependency remains `structureKey`, `compactViewport`, and `viewKey`; `selectedNodeId` must not be added.

Use a monotonically increasing ref and reject stale replies:

```ts
const layoutRequestId = useRef(0);
// inside the structural layout effect
const requestId = ++layoutRequestId.current;
const input: LayoutMessage = {
  requestId,
  direction: "LR",
  nodes: built.nodes.map((node) => ({
    id: node.id,
    width: built.dimensions.get(node.id)?.width ?? NODE_WIDTH,
    height: built.dimensions.get(node.id)?.height ?? NODE_HEIGHT,
  })),
  edges: built.edges.map((edge) => ({ source: String(edge.source), target: String(edge.target) })),
};
void requestSemanticLayout(input).then((result) => {
  if (cancelled || result.requestId !== layoutRequestId.current) return;
  // merge positions below
});
```

The merge is exact:

```ts
const positionedNodes = built.nodes.map((node) => ({
  ...node,
  position: result.positions[node.id] ?? node.position ?? { x: 0, y: 0 },
}));
```

Remove the semantic-canvas imports of `applyElkLayout`, `mergeElkPositions`, and `nodesToElkInput`. Task 2 has already removed every other component that imported these legacy layout modules, so no active product file may retain an ELK import after this step.

After Task 2 has deleted every other ELK/force/graphology consumer, remove the now-unused layout modules and dependencies:

```bash
pnpm --filter @understand-code/dashboard remove \
  d3-force elkjs graphology graphology-communities-louvain graphology-types prism-react-renderer
pnpm --filter @understand-code/dashboard remove --save-dev @types/d3-force
```

Delete the `elk`, `graphology`, and `d3-force` manual-chunk branches from `vite.config.ts`; keep the `@dagrejs` branch because `layout.worker.ts` still uses it. Delete the two obsolete utility tests listed above. Then verify with `rg` that `elkjs`, `d3-force`, `graphology`, and `prism-react-renderer` occur nowhere in Dashboard source, config, or package manifest.

- [ ] **Step 6: Run parity, selection, full tests, and build**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/graphExplorer/__tests__/layoutClient.test.ts \
  src/graphExplorer/__tests__/selectionPresentation.test.ts \
  src/components/graphExplorer/__tests__/FlowingSemanticEdge.test.ts
pnpm --filter @understand-code/dashboard test
pnpm --filter @understand-code/dashboard build
```

Expected: all PASS. `layoutClient.test.ts` proves worker and fallback positions are identical.

- [ ] **Step 7: Commit layout isolation**

```bash
git add packages/dashboard/src/utils/layout.worker.ts \
  packages/dashboard/src/utils/layoutAlgorithm.ts \
  packages/dashboard/src/graphExplorer/layoutClient.ts \
  packages/dashboard/src/graphExplorer/__tests__/layoutClient.test.ts \
  packages/dashboard/src/components/graphExplorer/SemanticGraphCanvas.tsx \
  packages/dashboard/package.json packages/dashboard/vite.config.ts pnpm-lock.yaml
git add -u -- packages/dashboard/src/utils/layout.ts \
  packages/dashboard/src/utils/elk-layout.ts \
  packages/dashboard/src/utils/__tests__/elk-layout.test.ts \
  packages/dashboard/src/utils/__tests__/smoke.test.ts
git commit -m "perf(graph): move semantic layout to worker"
```

---

### Task 4: Prove bounded navigation and complete reachability on a large fixture

**Files:**
- Create: `packages/dashboard/src/graphExplorer/__tests__/largeRepositoryFixture.ts`
- Create: `packages/dashboard/src/graphExplorer/__tests__/largeRepositoryAcceptance.test.ts`

**Interfaces:** The fixture contains exactly 277 files and 479 symbols; its featured route remains at 40 or fewer pages, every file/symbol has a reference destination, and the graph still pins selected one-hop context beyond caps.

- [ ] **Step 1: Create the deterministic large fixture**

```ts
import type { KnowledgeGraph } from "@understand-code/core/types";
import type { WikiIndexV2, WikiPageV2 } from "@understand-code/core";

export function largeRepositoryFixture(): { graph: KnowledgeGraph; wiki: WikiIndexV2; selectedId: string; neighborId: string } {
  const files = Array.from({ length: 277 }, (_, index) => ({
    id: `file:src/module-${index}.ts`,
    type: "file" as const,
    name: `module-${index}.ts`,
    filePath: `src/module-${index}.ts`,
    summary: `模块 ${index} 的源码入口。`,
    tags: ["fixture"],
    complexity: "moderate" as const,
  })) satisfies KnowledgeGraph["nodes"];
  const symbols = Array.from({ length: 479 }, (_, index) => ({
    id: `function:src/module-${index % 277}.ts:run${index}`,
    type: "function" as const,
    name: `run${index}`,
    filePath: `src/module-${index % 277}.ts`,
    summary: `执行第 ${index} 个可验证步骤。`,
    tags: ["fixture"],
    complexity: "moderate" as const,
  })) satisfies KnowledgeGraph["nodes"];
  const selectedId = symbols[470].id;
  const neighborId = symbols[471].id;
  const nodes = [...files, ...symbols];
  const evidenceId = (nodeId: string) => `evidence:${nodeId}`;
  const edges: KnowledgeGraph["edges"] = [
    ...symbols.map((symbol, index) => ({
      source: files[index % files.length].id,
      target: symbol.id,
      type: "contains" as const,
      direction: "forward" as const,
      weight: 1,
    })),
    { source: selectedId, target: neighborId, type: "calls" as const, direction: "forward" as const, weight: 1 },
  ];
  const pages: WikiPageV2[] = [
    ...Array.from({ length: 20 }, (_, index) => ({
      id: `page:featured-${index}`,
      title: index === 0 ? "项目总览" : `推荐阅读 ${index}`,
      summary: `解释第 ${index} 个业务到代码阶段。`,
      markdownPath: `knowledge-base/featured-${index}.md`,
      role: "featured" as const,
      category: index === 0 ? "overview" as const : "flow" as const,
      quality: "generated" as const,
      generationStatus: "complete" as const,
      directNodeIds: [symbols[index].id],
      contextNodeIds: [],
      evidenceIds: [evidenceId(symbols[index].id)],
      searchTerms: [`阶段 ${index}`],
      route: { order: index, stage: index === 0 ? "purpose" as const : "flow" as const },
    })),
    ...files.map((file, index) => ({
      id: `page:file-${index}`,
      title: file.filePath,
      summary: `说明 ${file.filePath} 的职责、分支与符号。`,
      markdownPath: `knowledge-base/reference/module-${index}.md`,
      role: "reference" as const,
      category: "file" as const,
      quality: "generated" as const,
      generationStatus: "complete" as const,
      directNodeIds: [file.id, ...symbols.filter((symbol) => symbol.filePath === file.filePath).map((symbol) => symbol.id)],
      contextNodeIds: [],
      evidenceIds: [file.id, ...symbols.filter((symbol) => symbol.filePath === file.filePath).map((symbol) => symbol.id)].map(evidenceId),
      searchTerms: [file.filePath],
    })),
  ];
  const nodeDocumentation = nodes.map((node) => {
    const fileIndex = Number(node.filePath?.match(/module-(\d+)/)?.[1] ?? 0);
    const pageId = `page:file-${fileIndex}`;
    return {
      nodeId: node.id,
      relation: "direct" as const,
      quality: "generated" as const,
      evidenceHealth: "source-linked" as const,
      generationStatus: "complete" as const,
      referenceCoverage: "anchored" as const,
      directPageIds: [pageId],
      contextPageIds: [],
      evidenceIds: [evidenceId(node.id)],
      primaryPageId: pageId,
      ...(node.type === "function" ? { anchor: node.name } : {}),
    };
  });
  const wiki: WikiIndexV2 = {
    version: 2,
    generatedAt: "2026-07-11T00:00:00.000Z",
    projectName: "large-demo",
    source: { outputLanguage: "zh-CN", generationMode: "fixture" },
    mainReadiness: { status: "ready", reasons: [], routePageIds: pages.filter((page) => page.role === "featured").map((page) => page.id) },
    referenceCoverage: {
      status: "complete",
      files: { covered: 277, total: 277, missingIds: [] },
      functions: { covered: 479, total: 479, missingIds: [] },
      types: { covered: 0, total: 0, missingIds: [] },
    },
    pages,
    nodeDocumentation,
    evidence: nodes.map((node) => ({
      id: evidenceId(node.id),
      nodeIds: [node.id],
      filePath: node.filePath ?? `src/${node.name}`,
      lineRange: [1, 3] as [number, number],
      excerpt: `export const ${node.name.replace(/[^A-Za-z0-9_$]/g, "_")} = true;`,
      evidenceType: "production" as const,
    })),
  };
  const graph: KnowledgeGraph = {
    version: "1.0",
    project: {
      name: "large-demo",
      languages: ["TypeScript"],
      frameworks: [],
      description: "用于大仓验收的确定性项目。",
      analyzedAt: "2026-07-11T00:00:00.000Z",
      gitCommitHash: "fixture",
    },
    layers: [{ id: "scope:src", name: "src", description: "源码范围", nodeIds: nodes.map((node) => node.id) }],
    nodes,
    edges,
    tour: [],
  };
  return { graph, wiki, selectedId, neighborId };
}
```

- [ ] **Step 2: Add large-repository acceptance assertions**

```ts
import { describe, expect, it } from "vitest";
import { parseWikiIndexV2 } from "@understand-code/core";
import { buildGraphExplorerView } from "../../components/graphExplorer/graphExplorerModel.js";
import { buildWikiNavigation } from "../../wiki/navigationModel.js";
import { buildWikiRuntimeIndex } from "../../wiki/wikiIndex.js";
import { buildWikiSearchRuntime, searchWiki } from "../../wiki/searchIndex.js";
import { largeRepositoryFixture } from "./largeRepositoryFixture.js";

describe("large repository acceptance", () => {
  it("keeps the main route bounded and every reference searchable", () => {
    const fixture = largeRepositoryFixture();
    const parsed = parseWikiIndexV2(fixture.wiki);
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("\n")).toBe(true);
    const runtime = buildWikiRuntimeIndex(fixture.wiki);
    const navigation = buildWikiNavigation(runtime);
    const searchRuntime = buildWikiSearchRuntime([], runtime, "fallback");
    expect(navigation.featured.pages.length).toBeLessThanOrEqual(40);
    expect(navigation.reference.totalFiles).toBe(277);
    expect(runtime.nodeDocumentationById.size).toBe(756);
    for (let index = 0; index < 277; index += 1) {
      const result = searchWiki(searchRuntime, `src/module-${index}.ts`, 1, 20);
      expect(result.groups.flatMap((group) => group.items).some((record) => record.pageId === `page:file-${index}`)).toBe(true);
    }
  });

  it("keeps selected and one-hop nodes after scope caps", () => {
    const fixture = largeRepositoryFixture();
    const runtime = buildWikiRuntimeIndex(fixture.wiki);
    const view = buildGraphExplorerView({
      graph: fixture.graph,
      wikiIndex: runtime,
      mode: "call",
      focusNodeIds: [],
      selectedNodeId: fixture.selectedId,
      navigation: { level: "scope", scopeId: "scope:src" },
    });
    const ids = new Set(view.semanticGraph.nodes.map((node) => node.id));
    expect(ids.has(fixture.selectedId)).toBe(true);
    expect(ids.has(fixture.neighborId)).toBe(true);
    expect(view.semanticGraph.nodes.length).toBeLessThan(100);
  });
});
```

- [ ] **Step 3: Run focused and complete Dashboard verification**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/graphExplorer/__tests__/largeRepositoryAcceptance.test.ts \
  src/wiki/__tests__/navigationModel.test.ts \
  src/wiki/__tests__/searchIndex.test.ts
pnpm --filter @understand-code/dashboard test
pnpm --filter @understand-code/dashboard build
```

Expected: all PASS without increasing the featured cap or graph node caps.

- [ ] **Step 4: Commit the fixture and acceptance**

```bash
git add packages/dashboard/src/graphExplorer/__tests__/largeRepositoryFixture.ts \
  packages/dashboard/src/graphExplorer/__tests__/largeRepositoryAcceptance.test.ts
git commit -m "test(dashboard): cover large repository navigation"
```

---

### Task 5: Add Simplified Chinese, accessibility, and artifact acceptance gates

**Files:**
- Create: `packages/dashboard/src/__tests__/simplifiedChineseSurface.test.ts`
- Create: `packages/dashboard/src/__tests__/artifactVerifier.test.ts`
- Create: `packages/dashboard/scripts/verify-wiki-graph-artifacts.mjs`
- Modify: `packages/dashboard/package.json`
- Modify: `packages/dashboard/vite.config.ts`
- Modify: `packages/dashboard/src/components/graphExplorer/__tests__/FlowingSemanticEdge.test.ts`
- Modify: `packages/dashboard/src/components/wiki/__tests__/WikiResponsiveShell.test.ts`
- Modify: `packages/dashboard/src/__tests__/appSurfaceRouting.test.ts`

- [ ] **Step 1: Add the source-level language and interaction gate**

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const activeFiles = [
  "src/App.tsx",
  "src/components/wiki/GuidedWikiHome.tsx",
  "src/components/wiki/GlobalWikiSearch.tsx",
  "src/components/wiki/WikiResponsiveShell.tsx",
  "src/components/graphExplorer/GraphExplorer.tsx",
  "src/components/graphExplorer/GraphModeToolbar.tsx",
  "src/components/graphExplorer/GraphDetailsRail.tsx",
  "src/components/graphExplorer/SemanticGraphCanvas.tsx",
];

describe("Simplified Chinese active surface", () => {
  it("contains no inherited English product labels", () => {
    const source = activeFiles.map((file) => readFileSync(join(root, file), "utf8")).join("\n");
    for (const label of ["Quick Jump", "Main Reading", "Code Reference", "Coverage", "Architecture", "Call Graph", "Open Wiki"]) {
      expect(source).not.toContain(`>${label}<`);
      expect(source).not.toContain(`"${label}"`);
    }
  });

  it("keeps keyboard and reduced-motion equivalents", () => {
    const graph = readFileSync(join(root, "src/components/graphExplorer/SemanticGraphCanvas.tsx"), "utf8");
    const edge = readFileSync(join(root, "src/components/graphExplorer/FlowingSemanticEdge.tsx"), "utf8");
    expect(graph).toContain("onPaneClick");
    expect(graph).toContain("onNodeDoubleClick");
    expect(graph).toContain("onKeyDown");
    expect(graph).toContain("useReducedMotion");
    expect(edge).toContain("inlineDirection");
    expect(edge).not.toContain("markerEnd");
  });
});
```

Add component assertions that:

- navigation and evidence drawer triggers have `aria-expanded` and `aria-controls`;
- Escape closes a drawer and returns focus to its trigger;
- Enter drills into a selected aggregate node;
- pane click clears selection;
- reduced motion renders an inline direction mark but no terminal arrowhead.

- [ ] **Step 2: Create a strict artifact verifier**

Create `verify-wiki-graph-artifacts.mjs`:

```js
#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? "");
const required = [
  "wiki-index.json",
  "search-index.json",
  ".trace/document-traces.json",
  ".trace/generation-report.json",
];
const failures = [];
const payloads = new Map();
for (const relativePath of required) {
  const file = resolve(root, relativePath);
  if (!existsSync(file)) {
    failures.push(`缺少产物：${relativePath}`);
    continue;
  }
  try { payloads.set(relativePath, JSON.parse(readFileSync(file, "utf8"))); }
  catch { failures.push(`JSON 无法解析：${relativePath}`); }
}
for (const [name, payload] of payloads) {
  if (payload.version !== 2) failures.push(`${name} 不是 V2`);
}
const wiki = payloads.get("wiki-index.json");
const report = payloads.get(".trace/generation-report.json");
if (wiki) {
  if (wiki.source?.outputLanguage !== "zh-CN") failures.push("Wiki 输出语言不是 zh-CN");
  if (wiki.mainReadiness?.status === "blocked") failures.push("Main Readiness 为 blocked");
  if (wiki.referenceCoverage?.status !== "complete") failures.push("Reference Coverage 未完整覆盖所有有效文件、函数和类型");
  if (!Array.isArray(wiki.pages) || !wiki.pages.some((page) => page.category === "overview" && page.role === "featured")) failures.push("缺少已发布的主干项目总览");
  if (wiki.pages?.some((page) => page.role === "featured" && !["verified", "generated"].includes(page.quality))) failures.push("推荐路线含未通过质量门槛的页面");
}
if (report) {
  if (!(report.sourceRead?.covered > 0)) failures.push("源码读取覆盖为 0");
  if (["deterministic", "deterministic-only"].includes(report.generationMode)) failures.push("正式验收不能使用确定性诊断稿");
}
if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write("Wiki/Graph V2 产物验收通过。\n");
```

Add the package script:

```json
"verify:artifacts": "node scripts/verify-wiki-graph-artifacts.mjs"
```

Also separate the served source root from the generated knowledge-base root in `vite.config.ts`. Replace the first branch of `knowledgeBaseRootCandidates` with this explicit environment override while retaining current fallbacks:

```ts
function knowledgeBaseRootCandidates(): string[] {
  const knowledgeBaseDir = process.env.KNOWLEDGE_BASE_DIR;
  const graphDir = process.env.GRAPH_DIR;
  return [
    ...(knowledgeBaseDir ? [path.resolve(knowledgeBaseDir)] : []),
    ...(graphDir ? [path.resolve(graphDir, ".understand-code", "knowledge-base")] : []),
    path.resolve(process.cwd(), ".understand-code", "knowledge-base"),
    path.resolve(process.cwd(), "../../../.understand-code/knowledge-base"),
  ];
}
```

Add a source assertion to `appSurfaceRouting.test.ts` that `vite.config.ts` contains `process.env.KNOWLEDGE_BASE_DIR` and still derives source preview paths from `GRAPH_DIR`. This is required so acceptance can render temporary V2 output while opening source files from the real repository.

- [ ] **Step 3: Test both verifier outcomes with disposable artifacts**

Create `artifactVerifier.test.ts`:

```ts
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const dashboardRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const roots: string[] = [];
afterEach(() => { while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true }); });

function writeArtifacts(generationMode: "writer" | "deterministic"): string {
  const root = mkdtempSync(join(tmpdir(), "wiki-artifacts-"));
  roots.push(root);
  mkdirSync(join(root, ".trace"), { recursive: true });
  const payloads: Record<string, unknown> = {
    "wiki-index.json": {
      version: 2,
      source: { outputLanguage: "zh-CN" },
      mainReadiness: { status: "ready" },
      referenceCoverage: { status: "complete" },
      pages: [{ id: "overview", role: "featured", category: "overview", quality: "generated" }],
    },
    "search-index.json": { version: 2, records: [] },
    ".trace/document-traces.json": { version: 2, traces: [] },
    ".trace/generation-report.json": { version: 2, generationMode, sourceRead: { covered: 1 } },
  };
  for (const [relativePath, value] of Object.entries(payloads)) {
    writeFileSync(join(root, relativePath), JSON.stringify(value), "utf8");
  }
  return root;
}

describe("artifact verifier", () => {
  it("accepts complete writer artifacts", () => {
    const output = execFileSync("node", ["scripts/verify-wiki-graph-artifacts.mjs", writeArtifacts("writer")], {
      cwd: dashboardRoot,
      encoding: "utf8",
    });
    expect(output).toContain("Wiki/Graph V2 产物验收通过");
  });

  it("rejects a deterministic diagnostic as a final release", () => {
    expect(() => execFileSync("node", ["scripts/verify-wiki-graph-artifacts.mjs", writeArtifacts("deterministic")], {
      cwd: dashboardRoot,
      stdio: "pipe",
    })).toThrow();
  });
});
```

- [ ] **Step 4: Run language, interaction, and verifier regressions**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/__tests__/simplifiedChineseSurface.test.ts \
  src/__tests__/artifactVerifier.test.ts \
  src/__tests__/appSurfaceRouting.test.ts \
  src/components/wiki/__tests__/WikiResponsiveShell.test.ts \
  src/components/graphExplorer/__tests__/FlowingSemanticEdge.test.ts
pnpm --filter @understand-code/dashboard test
pnpm --filter @understand-code/dashboard build
```

Expected: all PASS.

- [ ] **Step 5: Commit the acceptance gates**

```bash
git add packages/dashboard/src/__tests__/simplifiedChineseSurface.test.ts \
  packages/dashboard/src/__tests__/artifactVerifier.test.ts \
  packages/dashboard/scripts/verify-wiki-graph-artifacts.mjs \
  packages/dashboard/package.json \
  packages/dashboard/vite.config.ts \
  packages/dashboard/src/components/graphExplorer/__tests__/FlowingSemanticEdge.test.ts \
  packages/dashboard/src/components/wiki/__tests__/WikiResponsiveShell.test.ts \
  packages/dashboard/src/__tests__/appSurfaceRouting.test.ts
git commit -m "test(dashboard): gate wiki graph acceptance"
```

---

### Task 6: Complete real-repository and browser acceptance

**Files:** No source changes are expected. If acceptance exposes a defect, stop this task, add a focused failing test in the owning plan area, fix it in a separate commit, then restart Task 6 from Step 1.

- [ ] **Step 1: Generate a source-backed V2 knowledge base from a real repository**

Use `/Users/example/understand-code` as the required large real repository. Create a temporary acceptance project so the user's current `.understand-code/knowledge-base` is not overwritten:

```bash
export PLUGIN_ROOT=/Users/example/understand-code/.worktrees/wiki-first-graph-console
export REAL_REPO=/Users/example/understand-code
export ACCEPT_ROOT="$(mktemp -d /tmp/understand-code-acceptance.XXXXXX)"
mkdir -p "$ACCEPT_ROOT/.understand-code/knowledge-base"
```

Run the `understand-kb` writer-pool workflow from `skills/understand-kb/SKILL.md` with exactly one file writer and one topic writer, adding these flags to every generator phase introduced by Plan 1:

```text
--source-root /Users/example/understand-code
--output-root $ACCEPT_ROOT/.understand-code/knowledge-base
```

Use `$REAL_REPO` as the positional project path for every command. The explicit output root overrides the old default path in the existing skill text: file writers must write `file-doc-batch-<n>.json` under `$ACCEPT_ROOT/.understand-code/knowledge-base/.intermediate/`, and topic writers must write `topic-batch-<n>.json` there. They must not modify `$REAL_REPO/.understand-code/knowledge-base/`. Do not use `--deterministic-only`. Continue the documented lease/complete loops until both queues return `null`, then run `--finalize` with the same roots.

- [ ] **Step 2: Validate real artifacts and metadata**

```bash
node "$PLUGIN_ROOT/packages/dashboard/scripts/verify-wiki-graph-artifacts.mjs" \
  "$ACCEPT_ROOT/.understand-code/knowledge-base"
```

Expected: `Wiki/Graph V2 产物验收通过。`

Also inspect the report with:

```bash
node -e 'const r=require(process.argv[1]); console.log(JSON.stringify({generationMode:r.generationMode,sourceRead:r.sourceRead,mainReadiness:r.mainReadiness,referenceCoverage:r.referenceCoverage},null,2))' \
  "$ACCEPT_ROOT/.understand-code/knowledge-base/.trace/generation-report.json"
```

Expected: non-deterministic writer generation, `sourceRead.covered > 0`, Main Readiness is not blocked, and Reference Coverage reports all valid files/functions/types explicitly.

- [ ] **Step 3: Start the latest Dashboard against the acceptance project**

```bash
cd "$PLUGIN_ROOT"
UNDERSTAND_ACCESS_TOKEN=acceptance-token GRAPH_DIR="$REAL_REPO" \
  KNOWLEDGE_BASE_DIR="$ACCEPT_ROOT/.understand-code/knowledge-base" \
  pnpm --filter @understand-code/dashboard dev -- --host 127.0.0.1 --port 5173
```

Keep this process running and open:

```text
http://127.0.0.1:5173/?token=acceptance-token
```

- [ ] **Step 4: Use the `browser:control-in-app-browser` skill for desktop acceptance**

At 1440×900 verify, in order:

1. The first view is the guided Wiki home; it explains what the project does, where to start, the recommended route, and the code-reference entry.
2. The left navigation exposes only 主线阅读、代码参考、知识库状态; the main list remains bounded.
3. Global search finds a Chinese business term, a source path, a function, and a type; each result opens the correct page and symbol anchor.
4. A featured page reaches its source evidence within two deliberate actions.
5. “在图谱中查看” focuses direct nodes only and offers an explicit exit.
6. The default Graph is progressive architecture. Single click selects, double click or Enter drills down, and pane click clears.
7. Selected edges flow without terminal arrowheads; unrelated nodes fade; selection does not visibly relayout the graph.
8. Aggregate nodes show counts and ratios, not a red whole-card gap state.
9. Raw, scope, and boundary selections all have useful Chinese details and precise Wiki destinations when direct coverage exists.
10. No Persona, Domain/Structural, Diff, File/Class/Function, legacy filter/export/pathfinder/tour/onboarding control appears.

Capture screenshots of the guided Wiki home, a rich Wiki page with evidence, the selected-edge Graph state, and the aggregate coverage state.

- [ ] **Step 5: Verify responsive, keyboard, and reduced-motion behavior**

Using the same Browser session:

- at 980 px and 390 px width, confirm navigation and evidence are drawers while the article stays mounted;
- operate Wiki/Graph navigation, search, drawer close, selection, and drill-down by keyboard;
- emulate `prefers-reduced-motion: reduce` and confirm edge animation stops while a small inline direction mark remains;
- test a long Chinese title, a long source path, and a long identifier without overlapping the primary controls;
- switch every supported theme and confirm text/selection/coverage badges remain legible.

- [ ] **Step 6: Run final automated verification from a clean command context**

```bash
cd "$PLUGIN_ROOT"
pnpm --filter @understand-code/core test
pnpm --filter @understand-code/core build
pnpm --filter @understand-code/dashboard audit:surface
pnpm --filter @understand-code/dashboard test
pnpm --filter @understand-code/dashboard build
git diff --check
git status --short
```

Expected: every command passes. `git status --short` may show the known user-owned dirty files, but no uncommitted file created by Tasks 1–5 remains.

---

## Plan 4 Completion Gate

- Only the Wiki, Graph, global search, theme, and data-backed contextual actions are reachable from `src/main.tsx`.
- Legacy source is deleted only after its interaction behavior is covered in Plan 3 and the reachability/build checks pass.
- The active store contains no persona, diff, old view-mode, tour, filter/export/pathfinder, code-viewer, or unmounted React Flow state.
- Worker and synchronous layout produce identical positions; supported browsers use the worker.
- The large fixture proves a bounded main route, exhaustive file/symbol reachability, and selected one-hop preservation.
- Active user-facing product labels and recovery messages are Simplified Chinese.
- Desktop, narrow, mobile, keyboard, contrast, and reduced-motion acceptance pass.
- A real large repository produces source-backed V2 artifacts in writer mode and renders correctly in the latest Dashboard.
- No inherited control appears without observable behavior.
