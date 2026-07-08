# Parallel Full Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, Chinese-by-default, source-backed knowledge-base generator where every graph file node has a file document, every graph function/class node has an in-file card, important nodes get dynamic topic docs, and final status cannot be `complete` unless coverage is exhaustive.

**Architecture:** Keep deterministic planning, validation, indexing, and fallback rendering in `@understand-code/core`; add agent-facing JSON contracts so parallel `kb-file-writer` and `kb-topic-writer` agents can produce rich Markdown without corrupting coverage. The `/understand-kb` skill becomes a phased orchestrator: prepare batches, dispatch many file-writer agents, merge and validate, dispatch topic agents, finalize maps/indexes/report, and rerun only failed batches when needed.

**Tech Stack:** TypeScript ESM, Node.js fs/path APIs, existing `KnowledgeGraph` types and validation, Vitest, Markdown, Codex/Claude-style skill instructions and Markdown agent prompts.

---

## Hard Completion Rules

- No fixed maximum document count.
- No fixed maximum topic count.
- No sampling of files, functions, classes, or edges.
- `fileDocumentCoverage.covered` must equal `fileDocumentCoverage.total`.
- `functionCardCoverage.covered` must equal `functionCardCoverage.total`.
- `classCardCoverage.covered` must equal `classCardCoverage.total`.
- Every `calls` edge must appear in `索引/调用关系索引.md`.
- Every generated prose document defaults to Chinese; code identifiers stay unchanged.
- Missing source, invalid writer output, duplicate output paths, missing required sections, missing card coverage, and placeholder text all force `incomplete`.
- Large repositories are handled by more batches and more documents, not by lowering coverage.

## File Structure

- Modify `packages/core/src/knowledge-base/types.ts`
  - Add file-document tasks, batches, writer output contracts, topic output contracts, strict coverage report types, retry plan types, and source snapshot types.
- Create `packages/core/src/knowledge-base/paths.ts`
  - Centralize stable output paths and slug generation for Chinese directory names.
- Create `packages/core/src/knowledge-base/file-doc-planner.ts`
  - Build exactly one `FileDocTask` per graph file node and dynamically group tasks into batches.
- Create `packages/core/src/knowledge-base/source-snapshot.ts`
  - Convert source text into line-count, excerpt, and line-range evidence records without doing graph analysis.
- Create `packages/core/src/knowledge-base/writer-contracts.ts`
  - Validate and normalize JSON produced by `kb-file-writer` and `kb-topic-writer` agents.
- Create `packages/core/src/knowledge-base/merge.ts`
  - Merge file/topic writer outputs, validate strict coverage, build retry plans, and block false `complete` status.
- Modify `packages/core/src/knowledge-base/planner.ts`
  - Keep dynamic topic selection, add topic planning from accepted file documents and graph signals.
- Modify `packages/core/src/knowledge-base/markdown.ts`
  - Render new output structure: `目录.md`, `项目总览.md`, `架构地图.md`, `业务流程地图.md`, `模块总览/`, `文件文档/`, `关键函数专题/`, `索引/`, `覆盖报告.md`, `待确认项.md`.
- Modify `packages/core/src/knowledge-base/generate.ts`
  - Expose prepare/merge/finalize APIs for agent mode and deterministic fallback.
- Modify `packages/core/src/knowledge-base/index.ts`
  - Export new public APIs.
- Modify `packages/core/src/index.ts`
  - Re-export knowledge-base APIs from the package root.
- Create `packages/core/src/knowledge-base/__tests__/file-doc-planner.test.ts`
  - Cover one task per file, no fixed caps, dynamic batching, and source evidence expectations.
- Create `packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts`
  - Cover strict contract validation and rejection paths.
- Modify `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`
  - Update legacy tests to assert file-document/card coverage instead of index-only coverage.
- Create `agents/kb-file-writer.md`
  - Prompt for a batch agent that writes complete Chinese file documents in JSON.
- Create `agents/kb-topic-writer.md`
  - Prompt for a batch agent that writes Chinese topic documents in JSON.
- Modify `skills/understand-kb/SKILL.md`
  - Turn the skill into the phased parallel orchestrator.
- Modify `skills/understand-kb/generate-knowledge-base.mjs`
  - Add CLI phases for prepare, merge, topic preparation, finalization, retry, and deterministic-only fallback.

## Task 1: Write Strict Planner And Coverage Tests

**Files:**
- Create: `packages/core/src/knowledge-base/__tests__/file-doc-planner.test.ts`
- Modify: `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`

- [ ] **Step 1: Add a fixture helper with multiple files, functions, classes, calls, imports, and one source-missing file**

Append this helper to `packages/core/src/knowledge-base/__tests__/file-doc-planner.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "../../types.js";
import {
  buildFileDocPlan,
  buildKnowledgeBaseProfile,
  generateKnowledgeBase,
} from "../index.js";

function fullGraph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    kind: "codebase",
    project: {
      name: "feed-service",
      languages: ["typescript"],
      frameworks: ["express"],
      description: "Generates personalized feed responses",
      analyzedAt: "2026-06-26T00:00:00Z",
      gitCommitHash: "abc123",
    },
    nodes: [
      { id: "file:src/api/routes.ts", type: "file", name: "routes.ts", filePath: "src/api/routes.ts", summary: "Feed HTTP routes", tags: ["api", "entry"], complexity: "moderate" },
      { id: "function:src/api/routes.ts:HandleFeedRequest", type: "function", name: "HandleFeedRequest", filePath: "src/api/routes.ts", lineRange: [10, 24], summary: "Receives feed requests and calls the feed service", tags: ["handler", "entry", "feed"], complexity: "moderate" },
      { id: "file:src/service/feed.ts", type: "file", name: "feed.ts", filePath: "src/service/feed.ts", summary: "Feed business logic", tags: ["service", "business", "feed"], complexity: "complex" },
      { id: "function:src/service/feed.ts:BuildFeed", type: "function", name: "BuildFeed", filePath: "src/service/feed.ts", lineRange: [30, 90], summary: "Builds feed by loading candidates and ranking them", tags: ["business", "feed", "ranking"], complexity: "complex" },
      { id: "function:src/service/feed.ts:rankCandidates", type: "function", name: "rankCandidates", filePath: "src/service/feed.ts", lineRange: [92, 120], summary: "Ranks candidates with a local score", tags: ["helper"], complexity: "simple" },
      { id: "file:src/data/store.ts", type: "file", name: "store.ts", filePath: "src/data/store.ts", summary: "Candidate data access", tags: ["data"], complexity: "moderate" },
      { id: "class:src/data/store.ts:CandidateStore", type: "class", name: "CandidateStore", filePath: "src/data/store.ts", lineRange: [5, 60], summary: "Loads feed candidates", tags: ["data", "store"], complexity: "moderate" },
      { id: "function:src/data/store.ts:LoadCandidates", type: "function", name: "LoadCandidates", filePath: "src/data/store.ts", lineRange: [62, 78], summary: "Loads candidate rows", tags: ["data"], complexity: "moderate" },
      { id: "file:src/unused/missing.ts", type: "file", name: "missing.ts", filePath: "src/unused/missing.ts", summary: "Graph references a deleted file", tags: ["stale"], complexity: "simple" },
      { id: "function:src/unused/missing.ts:DeletedHelper", type: "function", name: "DeletedHelper", filePath: "src/unused/missing.ts", lineRange: [1, 4], summary: "Deleted helper still present in graph", tags: ["stale"], complexity: "simple" },
    ],
    edges: [
      { source: "file:src/api/routes.ts", target: "function:src/api/routes.ts:HandleFeedRequest", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/service/feed.ts", target: "function:src/service/feed.ts:BuildFeed", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/service/feed.ts", target: "function:src/service/feed.ts:rankCandidates", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/data/store.ts", target: "class:src/data/store.ts:CandidateStore", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/data/store.ts", target: "function:src/data/store.ts:LoadCandidates", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/unused/missing.ts", target: "function:src/unused/missing.ts:DeletedHelper", type: "contains", direction: "forward", weight: 1 },
      { source: "file:src/api/routes.ts", target: "file:src/service/feed.ts", type: "imports", direction: "forward", weight: 0.8 },
      { source: "file:src/service/feed.ts", target: "file:src/data/store.ts", type: "imports", direction: "forward", weight: 0.8 },
      { source: "function:src/api/routes.ts:HandleFeedRequest", target: "function:src/service/feed.ts:BuildFeed", type: "calls", direction: "forward", weight: 0.9 },
      { source: "function:src/service/feed.ts:BuildFeed", target: "function:src/data/store.ts:LoadCandidates", type: "calls", direction: "forward", weight: 0.9 },
      { source: "function:src/service/feed.ts:BuildFeed", target: "function:src/service/feed.ts:rankCandidates", type: "calls", direction: "forward", weight: 0.7 },
    ],
    layers: [
      { id: "layer:api", name: "API Layer", description: "HTTP entry points", nodeIds: ["file:src/api/routes.ts", "function:src/api/routes.ts:HandleFeedRequest"] },
      { id: "layer:service", name: "Service Layer", description: "Feed business logic", nodeIds: ["file:src/service/feed.ts", "function:src/service/feed.ts:BuildFeed", "function:src/service/feed.ts:rankCandidates"] },
      { id: "layer:data", name: "Data Layer", description: "Data access", nodeIds: ["file:src/data/store.ts", "class:src/data/store.ts:CandidateStore", "function:src/data/store.ts:LoadCandidates"] },
    ],
    tour: [],
  };
}
```

- [ ] **Step 2: Add tests proving file-doc planning is exhaustive**

Add these tests below the helper:

```ts
describe("file document planning", () => {
  it("creates exactly one file-doc task per graph file node", () => {
    const profile = buildKnowledgeBaseProfile(fullGraph());
    const plan = buildFileDocPlan(profile, {
      projectRoot: "/repo",
      sourceFiles: {
        "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
        "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
        "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
      },
    });

    expect(plan.tasks.map((task) => task.fileNodeId).sort()).toEqual([
      "file:src/api/routes.ts",
      "file:src/data/store.ts",
      "file:src/service/feed.ts",
      "file:src/unused/missing.ts",
    ]);
    expect(plan.tasks).toHaveLength(4);
    expect(new Set(plan.tasks.map((task) => task.documentPath)).size).toBe(4);
  });

  it("does not cap file batches for larger graphs", () => {
    const graph = fullGraph();
    for (let index = 0; index < 60; index += 1) {
      const filePath = `src/generated/file-${index}.ts`;
      graph.nodes.push({
        id: `file:${filePath}`,
        type: "file",
        name: `file-${index}.ts`,
        filePath,
        summary: `Generated file ${index}`,
        tags: ["generated"],
        complexity: "simple",
      });
    }
    const plan = buildFileDocPlan(buildKnowledgeBaseProfile(graph), { projectRoot: "/repo", sourceFiles: {} });
    expect(plan.tasks.filter((task) => task.filePath.startsWith("src/generated/"))).toHaveLength(60);
    expect(plan.tasks).toHaveLength(64);
  });
});
```

- [ ] **Step 3: Update legacy generation tests to assert file-document/card coverage**

In `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`, replace the test named `"generates Markdown docs with complete file, function, and class index coverage"` with this stronger test:

```ts
it("generates complete file documents and cards for every graph file/function/class", () => {
  const graph = sampleGraph();
  const kb = generateKnowledgeBase(graph, {
    sourceFiles: {
      "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
      "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
      "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
    },
  });

  expect(kb.coverageReport.fileDocumentCoverage.covered).toBe(kb.coverageReport.fileDocumentCoverage.total);
  expect(kb.coverageReport.functionCardCoverage.covered).toBe(kb.coverageReport.functionCardCoverage.total);
  expect(kb.coverageReport.classCardCoverage.covered).toBe(kb.coverageReport.classCardCoverage.total);

  for (const node of graph.nodes.filter((item) => item.type === "file")) {
    const doc = kb.documents.find((item) => item.path.startsWith("文件文档/") && item.coveredNodeIds.includes(node.id));
    expect(doc?.content).toContain(`# ${node.filePath} 文件知识文档`);
  }
  for (const node of graph.nodes.filter((item) => item.type === "function")) {
    const parentDoc = kb.documents.find((item) => item.path.startsWith("文件文档/") && item.coveredNodeIds.includes(node.id));
    expect(parentDoc?.content).toContain(`节点 ID: \`${node.id}\``);
  }
});
```

- [ ] **Step 4: Run the failing tests**

Run:

```bash
cd /Users/example/understand-code
pnpm --filter @understand-code/core test -- src/knowledge-base/__tests__/file-doc-planner.test.ts src/knowledge-base/__tests__/knowledge-base.test.ts
```

Expected: tests fail because `buildFileDocPlan`, `sourceFiles`, and strict coverage fields do not exist yet.

- [ ] **Step 5: Commit the failing tests**

```bash
git add packages/core/src/knowledge-base/__tests__/file-doc-planner.test.ts packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts
git commit -m "test: require complete knowledge base file coverage"
```

## Task 2: Expand Core Types And Stable Paths

**Files:**
- Modify: `packages/core/src/knowledge-base/types.ts`
- Create: `packages/core/src/knowledge-base/paths.ts`
- Modify: `packages/core/src/knowledge-base/index.ts`

- [ ] **Step 1: Replace `KnowledgeBaseOptions` and category types with exhaustive file-doc-aware shapes**

In `packages/core/src/knowledge-base/types.ts`, extend the existing interfaces with these definitions. Keep existing profile/index types that are still used.

```ts
export type KnowledgeBaseStatus = "complete" | "complete-with-warnings" | "incomplete";

export interface KnowledgeBaseOptions {
  outputLanguage?: string;
  projectRoot?: string;
  sourceFiles?: Record<string, string>;
  currentGitCommitHash?: string;
  keepIntermediate?: boolean;
  deterministicOnly?: boolean;
}

export type KnowledgeBaseDocumentCategory =
  | "top-level"
  | "index"
  | "module"
  | "file"
  | "flow"
  | "topic"
  | "report"
  | "intermediate";

export interface SourceSnapshot {
  filePath: string;
  exists: boolean;
  text: string;
  totalLines: number;
  nonEmptyLines: number;
  missingReason?: string;
}

export interface SourceEvidence {
  filePath: string;
  lineRange?: [number, number];
  nodeId?: string;
  excerpt?: string;
}

export interface FileDocTask {
  batchIndex: number;
  taskIndex: number;
  fileNodeId: string;
  filePath: string;
  layerId: string | null;
  documentPath: string;
  functionNodeIds: string[];
  classNodeIds: string[];
  incomingEdgeIds: string[];
  outgoingEdgeIds: string[];
  neighborNodeIds: string[];
  sourceSnapshot: SourceSnapshot;
  sourceReadMode: "full" | "missing";
  batchingReason: string;
}

export interface FileDocBatch {
  batchIndex: number;
  tasks: FileDocTask[];
  estimatedLines: number;
  estimatedGraphItems: number;
  reason: string;
}

export interface FileDocPlan {
  tasks: FileDocTask[];
  batches: FileDocBatch[];
  warnings: string[];
}

export interface FileWriterDocument {
  fileNodeId: string;
  filePath: string;
  documentPath: string;
  title: string;
  coveredFunctionNodeIds: string[];
  coveredClassNodeIds: string[];
  representedEdgeIds: string[];
  sourceEvidence: SourceEvidence[];
  importantNodeIds: string[];
  markdown: string;
}

export interface FileWriterBatchOutput {
  batchIndex: number;
  documents: FileWriterDocument[];
  warnings: string[];
}

export interface TopicPlanItem {
  batchIndex: number;
  topicNodeId: string;
  sourceFileNodeId: string;
  documentPath: string;
  title: string;
  reasons: string[];
  coveredNodeIds: string[];
  linkedFileDocumentPath: string;
}

export interface TopicBatch {
  batchIndex: number;
  topics: TopicPlanItem[];
  reason: string;
}

export interface TopicPlan {
  topics: TopicPlanItem[];
  batches: TopicBatch[];
  warnings: string[];
}

export interface TopicWriterDocument {
  topicNodeId: string;
  sourceFileNodeId: string;
  documentPath: string;
  title: string;
  coveredNodeIds: string[];
  linkedFileDocumentPath: string;
  evidence: SourceEvidence[];
  markdown: string;
}

export interface TopicWriterBatchOutput {
  batchIndex: number;
  topics: TopicWriterDocument[];
  warnings: string[];
}

export interface CoverageRatio {
  covered: number;
  total: number;
  missing: string[];
}

export interface RelationshipCoverage {
  edgeType: string;
  covered: number;
  total: number;
  missingEdgeIds: string[];
}

export interface RetryPlan {
  fileBatchIndexes: number[];
  topicBatchIndexes: number[];
  reasons: string[];
}
```

- [ ] **Step 2: Replace `CoverageReport` fields with strict coverage ratios**

Update the existing `CoverageReport` interface:

```ts
export interface CoverageReport {
  totalDocuments: number;
  documentCounts: Record<KnowledgeBaseDocumentCategory, number>;
  nodeCounts: Record<NodeType, number>;
  edgeCounts: Record<EdgeType, number>;
  fileDocumentCoverage: CoverageRatio;
  functionCardCoverage: CoverageRatio;
  classCardCoverage: CoverageRatio;
  relationshipCoverage: RelationshipCoverage[];
  sourceReadCoverage: CoverageRatio;
  layerOverviewCoverage: CoverageRatio;
  entryCoverage: CoverageRatio;
  topicCoverage: CoverageRatio;
  fileWriterBatches: { total: number; passed: number; retry: number };
  topicBatches: { total: number; passed: number; retry: number };
  chineseValidation: { checked: number; failed: string[] };
  placeholderValidation: { checked: number; failed: string[] };
  warnings: string[];
  errors: string[];
  status: KnowledgeBaseStatus;
}
```

- [ ] **Step 3: Expand `GeneratedDocument` and `GeneratedKnowledgeBase`**

Update these interfaces:

```ts
export interface GeneratedDocument {
  path: string;
  title: string;
  category: KnowledgeBaseDocumentCategory;
  coveredNodeIds: string[];
  representedEdgeIds: string[];
  content: string;
}

export interface GeneratedKnowledgeBase {
  profile: ProjectProfile;
  plan: DocumentPlan;
  fileDocPlan: FileDocPlan;
  topicPlan: TopicPlan;
  documents: GeneratedDocument[];
  validation: CoverageValidationResult;
  coverageReport: CoverageReport;
  retryPlan: RetryPlan;
}
```

- [ ] **Step 4: Add stable path helpers**

Create `packages/core/src/knowledge-base/paths.ts`:

```ts
export const KB_PATHS = {
  inventory: "目录.md",
  projectOverview: "项目总览.md",
  architectureMap: "架构地图.md",
  businessFlowMap: "业务流程地图.md",
  coverageReport: "覆盖报告.md",
  pendingItems: "待确认项.md",
  moduleDir: "模块总览",
  fileDir: "文件文档",
  topicDir: "关键函数专题",
  indexDir: "索引",
  intermediateDir: ".intermediate",
} as const;

export function slugPath(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[:/\\]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_.-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "untitled";
}

export function fileDocumentPath(filePath: string): string {
  return `${KB_PATHS.fileDir}/${slugPath(filePath)}.md`;
}

export function topicDocumentPath(filePath: string, nodeName: string): string {
  return `${KB_PATHS.topicDir}/${slugPath(filePath)}-${slugPath(nodeName)}.md`;
}

export function moduleDocumentPath(layerName: string): string {
  return `${KB_PATHS.moduleDir}/${slugPath(layerName)}.md`;
}
```

- [ ] **Step 5: Export path helpers**

Update `packages/core/src/knowledge-base/index.ts`:

```ts
export * from "./types.js";
export * from "./profile.js";
export * from "./planner.js";
export * from "./paths.js";
```

- [ ] **Step 6: Run typecheck-facing tests**

```bash
pnpm --filter @understand-code/core test -- src/knowledge-base/__tests__/file-doc-planner.test.ts
```

Expected: failures now reference missing implementation modules, not missing exported types.

- [ ] **Step 7: Commit types and paths**

```bash
git add packages/core/src/knowledge-base/types.ts packages/core/src/knowledge-base/paths.ts packages/core/src/knowledge-base/index.ts
git commit -m "feat: add complete knowledge base contract types"
```

## Task 3: Build Source Snapshots And Exhaustive File-Doc Planning

**Files:**
- Create: `packages/core/src/knowledge-base/source-snapshot.ts`
- Create: `packages/core/src/knowledge-base/file-doc-planner.ts`
- Modify: `packages/core/src/knowledge-base/index.ts`

- [ ] **Step 1: Implement source snapshot helpers**

Create `packages/core/src/knowledge-base/source-snapshot.ts`:

```ts
import type { SourceEvidence, SourceSnapshot } from "./types.js";

export function buildSourceSnapshot(filePath: string, sourceFiles: Record<string, string>): SourceSnapshot {
  const text = sourceFiles[filePath];
  if (text === undefined) {
    return {
      filePath,
      exists: false,
      text: "",
      totalLines: 0,
      nonEmptyLines: 0,
      missingReason: "source file was not provided to knowledge-base generation",
    };
  }
  const lines = text.split(/\r?\n/);
  return {
    filePath,
    exists: true,
    text,
    totalLines: lines.length,
    nonEmptyLines: lines.filter((line) => line.trim().length > 0).length,
  };
}

export function excerptForLineRange(snapshot: SourceSnapshot, lineRange?: [number, number]): string {
  if (!snapshot.exists || !lineRange) return "";
  const [start, end] = lineRange;
  const lines = snapshot.text.split(/\r?\n/);
  return lines.slice(Math.max(0, start - 1), Math.min(lines.length, end)).join("\n");
}

export function sourceEvidenceForNode(
  snapshot: SourceSnapshot,
  nodeId: string,
  lineRange?: [number, number],
): SourceEvidence {
  return {
    filePath: snapshot.filePath,
    lineRange,
    nodeId,
    excerpt: excerptForLineRange(snapshot, lineRange),
  };
}
```

- [ ] **Step 2: Implement edge id helper and dynamic batch weights**

Create the top of `packages/core/src/knowledge-base/file-doc-planner.ts`:

```ts
import type { GraphEdge, GraphNode } from "../types.js";
import type { FileDocBatch, FileDocPlan, FileDocTask, ProjectProfile } from "./types.js";
import { fileDocumentPath } from "./paths.js";
import { buildSourceSnapshot } from "./source-snapshot.js";

function edgeId(edge: GraphEdge): string {
  return `${edge.type}:${edge.source}->${edge.target}`;
}

function sortByPath(a: GraphNode, b: GraphNode): number {
  return (a.filePath ?? a.id).localeCompare(b.filePath ?? b.id);
}

function taskWeight(task: FileDocTask): number {
  return task.sourceSnapshot.totalLines + task.functionNodeIds.length * 80 + task.classNodeIds.length * 120 + task.outgoingEdgeIds.length * 10 + task.incomingEdgeIds.length * 10;
}

function batchReason(tasks: FileDocTask[]): string {
  if (tasks.length === 1) {
    const task = tasks[0]!;
    if (task.sourceSnapshot.totalLines >= 400) return "large source file analyzed alone";
    if (task.functionNodeIds.length + task.classNodeIds.length >= 12) return "many code symbols analyzed alone";
    if (!task.sourceSnapshot.exists) return "missing source isolated for clearer retry";
    return "single task batch";
  }
  return "same-size ordinary files grouped by dynamic batch weight";
}
```

- [ ] **Step 3: Implement one task per file node**

Add to `file-doc-planner.ts`:

```ts
export interface BuildFileDocPlanOptions {
  projectRoot?: string;
  sourceFiles?: Record<string, string>;
}

function buildTask(profile: ProjectProfile, fileNode: GraphNode, taskIndex: number, sourceFiles: Record<string, string>): FileDocTask {
  const filePath = fileNode.filePath ?? fileNode.name;
  const incoming = profile.indexes.incomingEdgesByNode.get(fileNode.id) ?? [];
  const outgoing = profile.indexes.outgoingEdgesByNode.get(fileNode.id) ?? [];
  const childIds = profile.indexes.fileToChildIds.get(fileNode.id) ?? [];
  const childEdges = childIds.flatMap((childId) => [
    ...(profile.indexes.incomingEdgesByNode.get(childId) ?? []),
    ...(profile.indexes.outgoingEdgesByNode.get(childId) ?? []),
  ]);
  const neighborNodeIds = new Set<string>();
  for (const edge of [...incoming, ...outgoing, ...childEdges]) {
    if (edge.source !== fileNode.id) neighborNodeIds.add(edge.source);
    if (edge.target !== fileNode.id) neighborNodeIds.add(edge.target);
  }
  const sourceSnapshot = buildSourceSnapshot(filePath, sourceFiles);
  const symbolCount = (profile.indexes.fileToFunctionIds.get(fileNode.id) ?? []).length + (profile.indexes.fileToClassIds.get(fileNode.id) ?? []).length;
  return {
    batchIndex: 0,
    taskIndex,
    fileNodeId: fileNode.id,
    filePath,
    layerId: profile.indexes.nodeToLayerId.get(fileNode.id) ?? null,
    documentPath: fileDocumentPath(filePath),
    functionNodeIds: [...(profile.indexes.fileToFunctionIds.get(fileNode.id) ?? [])].sort(),
    classNodeIds: [...(profile.indexes.fileToClassIds.get(fileNode.id) ?? [])].sort(),
    incomingEdgeIds: incoming.map(edgeId).sort(),
    outgoingEdgeIds: outgoing.map(edgeId).sort(),
    neighborNodeIds: [...neighborNodeIds].sort(),
    sourceSnapshot,
    sourceReadMode: sourceSnapshot.exists ? "full" : "missing",
    batchingReason: symbolCount >= 12 ? "symbol-heavy file" : sourceSnapshot.totalLines >= 400 ? "large file" : "ordinary file",
  };
}
```

- [ ] **Step 4: Implement dynamic batching without fixed document caps**

Add to `file-doc-planner.ts`:

```ts
function assignBatches(tasks: FileDocTask[]): FileDocBatch[] {
  const batches: FileDocBatch[] = [];
  let current: FileDocTask[] = [];
  let currentWeight = 0;
  const softWeightLimit = 900;

  function flush(): void {
    if (current.length === 0) return;
    const batchIndex = batches.length + 1;
    const tasksWithBatch = current.map((task) => ({ ...task, batchIndex }));
    batches.push({
      batchIndex,
      tasks: tasksWithBatch,
      estimatedLines: tasksWithBatch.reduce((sum, task) => sum + task.sourceSnapshot.totalLines, 0),
      estimatedGraphItems: tasksWithBatch.reduce((sum, task) => sum + task.functionNodeIds.length + task.classNodeIds.length + task.incomingEdgeIds.length + task.outgoingEdgeIds.length, 0),
      reason: batchReason(tasksWithBatch),
    });
    current = [];
    currentWeight = 0;
  }

  for (const task of tasks) {
    const weight = taskWeight(task);
    const shouldBeAlone = task.sourceSnapshot.totalLines >= 400 || task.functionNodeIds.length + task.classNodeIds.length >= 12 || !task.sourceSnapshot.exists;
    if (shouldBeAlone) {
      flush();
      current = [task];
      currentWeight = weight;
      flush();
      continue;
    }
    if (currentWeight > 0 && currentWeight + weight > softWeightLimit) flush();
    current.push(task);
    currentWeight += weight;
  }
  flush();
  return batches;
}

export function buildFileDocPlan(profile: ProjectProfile, options: BuildFileDocPlanOptions = {}): FileDocPlan {
  const sourceFiles = options.sourceFiles ?? {};
  const fileNodes = profile.graph.nodes.filter((node) => node.type === "file").sort(sortByPath);
  const rawTasks = fileNodes.map((node, index) => buildTask(profile, node, index + 1, sourceFiles));
  const batches = assignBatches(rawTasks);
  const tasks = batches.flatMap((batch) => batch.tasks);
  const warnings = tasks
    .filter((task) => !task.sourceSnapshot.exists)
    .map((task) => `source missing for ${task.filePath}`);
  return { tasks, batches, warnings };
}
```

- [ ] **Step 5: Export file-doc planner and source helpers**

Update `packages/core/src/knowledge-base/index.ts`:

```ts
export * from "./source-snapshot.js";
export * from "./file-doc-planner.js";
```

- [ ] **Step 6: Run planner tests**

```bash
pnpm --filter @understand-code/core test -- src/knowledge-base/__tests__/file-doc-planner.test.ts
```

Expected: file-doc planner tests pass. Legacy generation tests still fail because `generateKnowledgeBase` does not yet use `FileDocPlan`.

- [ ] **Step 7: Commit planner**

```bash
git add packages/core/src/knowledge-base/source-snapshot.ts packages/core/src/knowledge-base/file-doc-planner.ts packages/core/src/knowledge-base/index.ts
git commit -m "feat: plan exhaustive file knowledge documents"
```

## Task 4: Validate File And Topic Writer Contracts

**Files:**
- Create: `packages/core/src/knowledge-base/writer-contracts.ts`
- Create: `packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts`
- Modify: `packages/core/src/knowledge-base/index.ts`

- [ ] **Step 1: Add writer contract tests**

Create `packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  parseFileWriterBatchOutput,
  parseTopicWriterBatchOutput,
} from "../index.js";

describe("writer contracts", () => {
  it("accepts a complete file-writer batch output", () => {
    const result = parseFileWriterBatchOutput({
      batchIndex: 1,
      documents: [
        {
          fileNodeId: "file:src/service/feed.ts",
          filePath: "src/service/feed.ts",
          documentPath: "文件文档/src-service-feed.ts.md",
          title: "src/service/feed.ts 文件知识文档",
          coveredFunctionNodeIds: ["function:src/service/feed.ts:BuildFeed"],
          coveredClassNodeIds: [],
          representedEdgeIds: ["calls:function:src/api/routes.ts:HandleFeedRequest->function:src/service/feed.ts:BuildFeed"],
          sourceEvidence: [{ filePath: "src/service/feed.ts", lineRange: [1, 20], nodeId: "function:src/service/feed.ts:BuildFeed" }],
          importantNodeIds: ["function:src/service/feed.ts:BuildFeed"],
          markdown: "# src/service/feed.ts 文件知识文档\n\n## 文件职责\n负责 feed 业务。\n\n## 所属位置\n服务层。\n\n## 文件内结构\n包含一个函数。\n\n## 函数卡片\n### BuildFeed\n- 节点 ID: `function:src/service/feed.ts:BuildFeed`\n\n## 类卡片\n无。\n\n## 调用关系\n被入口调用。\n\n## 风险点与待确认项\n根据代码推断，需线上配置确认\n\n## AI 检索词\nfeed, BuildFeed",
        },
      ],
      warnings: [],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing required file document sections", () => {
    const result = parseFileWriterBatchOutput({
      batchIndex: 1,
      documents: [
        {
          fileNodeId: "file:src/service/feed.ts",
          filePath: "src/service/feed.ts",
          documentPath: "文件文档/src-service-feed.ts.md",
          title: "src/service/feed.ts 文件知识文档",
          coveredFunctionNodeIds: [],
          coveredClassNodeIds: [],
          representedEdgeIds: [],
          sourceEvidence: [],
          importantNodeIds: [],
          markdown: "# src/service/feed.ts 文件知识文档\n\n内容太少。",
        },
      ],
      warnings: [],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("missing required section");
  });

  it("accepts a complete topic-writer batch output", () => {
    const result = parseTopicWriterBatchOutput({
      batchIndex: 1,
      topics: [
        {
          topicNodeId: "function:src/service/feed.ts:BuildFeed",
          sourceFileNodeId: "file:src/service/feed.ts",
          documentPath: "关键函数专题/src-service-feed.ts-BuildFeed.md",
          title: "BuildFeed 关键函数专题",
          coveredNodeIds: ["function:src/service/feed.ts:BuildFeed"],
          linkedFileDocumentPath: "文件文档/src-service-feed.ts.md",
          evidence: [{ filePath: "src/service/feed.ts", lineRange: [1, 20] }],
          markdown: "# BuildFeed 关键函数专题\n\n## 为什么关键\n它处于 feed 主链路。\n\n## 在业务流程中的位置\n入口之后。\n\n## 主要输入、输出、副作用\n读取候选并返回结果。\n\n## 关键分支和算法\n按分数排序。\n\n## 配置和外部依赖\n根据代码推断，需线上配置确认\n\n## 上游调用者\nHandleFeedRequest。\n\n## 下游调用对象\nLoadCandidates。\n\n## 修改风险\n影响 feed 结果。\n\n## 测试证据\n检查相关测试。\n\n## 代码证据\nsrc/service/feed.ts:1-20\n\n## AI 检索词\nfeed, BuildFeed",
        },
      ],
      warnings: [],
    });
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Implement contract result type and required section checks**

Create `packages/core/src/knowledge-base/writer-contracts.ts`:

```ts
import type {
  FileWriterBatchOutput,
  FileWriterDocument,
  TopicWriterBatchOutput,
  TopicWriterDocument,
} from "./types.js";

export interface ContractParseResult<T> {
  ok: boolean;
  value?: T;
  errors: string[];
}

const FILE_REQUIRED_SECTIONS = [
  "## 文件职责",
  "## 所属位置",
  "## 文件内结构",
  "## 函数卡片",
  "## 类卡片",
  "## 调用关系",
  "## 风险点与待确认项",
  "## AI 检索词",
];

const TOPIC_REQUIRED_SECTIONS = [
  "## 为什么关键",
  "## 在业务流程中的位置",
  "## 主要输入、输出、副作用",
  "## 关键分支和算法",
  "## 配置和外部依赖",
  "## 上游调用者",
  "## 下游调用对象",
  "## 修改风险",
  "## 测试证据",
  "## 代码证据",
  "## AI 检索词",
];

const PLACEHOLDER_RE = /\b(T[B]D|TO[D]O|FIX[M]E)\b|待\s*定|占\s*位|后续\s*补充|这里\s*填写/i;
```

- [ ] **Step 3: Implement file contract parser**

Add to `writer-contracts.ts`:

```ts
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}

function validateRequiredSections(markdown: string, sections: string[], label: string, errors: string[]): void {
  for (const section of sections) {
    if (!markdown.includes(section)) errors.push(`${label} missing required section: ${section}`);
  }
  if (PLACEHOLDER_RE.test(markdown)) errors.push(`${label} contains placeholder text`);
}

function parseFileDocument(value: unknown, index: number, errors: string[]): FileWriterDocument | null {
  if (!isObject(value)) {
    errors.push(`documents[${index}] must be an object`);
    return null;
  }
  const markdown = typeof value.markdown === "string" ? value.markdown : "";
  validateRequiredSections(markdown, FILE_REQUIRED_SECTIONS, `documents[${index}]`, errors);
  const coveredFunctionNodeIds = stringArray(value.coveredFunctionNodeIds);
  const coveredClassNodeIds = stringArray(value.coveredClassNodeIds);
  const representedEdgeIds = stringArray(value.representedEdgeIds);
  const importantNodeIds = stringArray(value.importantNodeIds);
  if (!coveredFunctionNodeIds) errors.push(`documents[${index}].coveredFunctionNodeIds must be string[]`);
  if (!coveredClassNodeIds) errors.push(`documents[${index}].coveredClassNodeIds must be string[]`);
  if (!representedEdgeIds) errors.push(`documents[${index}].representedEdgeIds must be string[]`);
  if (!importantNodeIds) errors.push(`documents[${index}].importantNodeIds must be string[]`);
  if (typeof value.fileNodeId !== "string") errors.push(`documents[${index}].fileNodeId must be string`);
  if (typeof value.filePath !== "string") errors.push(`documents[${index}].filePath must be string`);
  if (typeof value.documentPath !== "string") errors.push(`documents[${index}].documentPath must be string`);
  if (typeof value.title !== "string") errors.push(`documents[${index}].title must be string`);
  if (!Array.isArray(value.sourceEvidence)) errors.push(`documents[${index}].sourceEvidence must be array`);
  if (errors.length > 0) return null;
  return value as unknown as FileWriterDocument;
}

export function parseFileWriterBatchOutput(value: unknown): ContractParseResult<FileWriterBatchOutput> {
  const errors: string[] = [];
  if (!isObject(value)) return { ok: false, errors: ["file-writer output must be an object"] };
  if (typeof value.batchIndex !== "number") errors.push("batchIndex must be number");
  if (!Array.isArray(value.documents)) errors.push("documents must be array");
  if (!Array.isArray(value.warnings) || !value.warnings.every((item) => typeof item === "string")) errors.push("warnings must be string[]");
  const documents = Array.isArray(value.documents)
    ? value.documents.map((doc, index) => parseFileDocument(doc, index, errors)).filter((doc): doc is FileWriterDocument => Boolean(doc))
    : [];
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      batchIndex: value.batchIndex as number,
      documents,
      warnings: value.warnings as string[],
    },
    errors: [],
  };
}
```

- [ ] **Step 4: Implement topic contract parser**

Add to `writer-contracts.ts`:

```ts
function parseTopicDocument(value: unknown, index: number, errors: string[]): TopicWriterDocument | null {
  if (!isObject(value)) {
    errors.push(`topics[${index}] must be an object`);
    return null;
  }
  const markdown = typeof value.markdown === "string" ? value.markdown : "";
  validateRequiredSections(markdown, TOPIC_REQUIRED_SECTIONS, `topics[${index}]`, errors);
  const coveredNodeIds = stringArray(value.coveredNodeIds);
  if (!coveredNodeIds) errors.push(`topics[${index}].coveredNodeIds must be string[]`);
  if (typeof value.topicNodeId !== "string") errors.push(`topics[${index}].topicNodeId must be string`);
  if (typeof value.sourceFileNodeId !== "string") errors.push(`topics[${index}].sourceFileNodeId must be string`);
  if (typeof value.documentPath !== "string") errors.push(`topics[${index}].documentPath must be string`);
  if (typeof value.title !== "string") errors.push(`topics[${index}].title must be string`);
  if (typeof value.linkedFileDocumentPath !== "string") errors.push(`topics[${index}].linkedFileDocumentPath must be string`);
  if (!Array.isArray(value.evidence)) errors.push(`topics[${index}].evidence must be array`);
  if (errors.length > 0) return null;
  return value as unknown as TopicWriterDocument;
}

export function parseTopicWriterBatchOutput(value: unknown): ContractParseResult<TopicWriterBatchOutput> {
  const errors: string[] = [];
  if (!isObject(value)) return { ok: false, errors: ["topic-writer output must be an object"] };
  if (typeof value.batchIndex !== "number") errors.push("batchIndex must be number");
  if (!Array.isArray(value.topics)) errors.push("topics must be array");
  if (!Array.isArray(value.warnings) || !value.warnings.every((item) => typeof item === "string")) errors.push("warnings must be string[]");
  const topics = Array.isArray(value.topics)
    ? value.topics.map((doc, index) => parseTopicDocument(doc, index, errors)).filter((doc): doc is TopicWriterDocument => Boolean(doc))
    : [];
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      batchIndex: value.batchIndex as number,
      topics,
      warnings: value.warnings as string[],
    },
    errors: [],
  };
}
```

- [ ] **Step 5: Export and run contract tests**

Update `packages/core/src/knowledge-base/index.ts`:

```ts
export * from "./writer-contracts.js";
```

Run:

```bash
pnpm --filter @understand-code/core test -- src/knowledge-base/__tests__/writer-contracts.test.ts
```

Expected: contract tests pass.

- [ ] **Step 6: Commit contracts**

```bash
git add packages/core/src/knowledge-base/writer-contracts.ts packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts packages/core/src/knowledge-base/index.ts
git commit -m "feat: validate knowledge base writer outputs"
```

## Task 5: Merge File Documents And Enforce Strict Coverage

**Files:**
- Create: `packages/core/src/knowledge-base/merge.ts`
- Modify: `packages/core/src/knowledge-base/index.ts`
- Modify: `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`

- [ ] **Step 1: Add merge-specific regression tests**

Append these tests to `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`:

```ts
it("marks output incomplete when a file document omits a function card", () => {
  const graph = sampleGraph();
  const kb = generateKnowledgeBase(graph, {
    sourceFiles: {
      "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
      "src/service/feed.ts": "export function BuildFeed() { return []; }\nfunction rankCandidates(items) { return items; }\n",
      "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
    },
  });
  const serviceDoc = kb.documents.find((doc) => doc.path === "文件文档/src-service-feed.ts.md");
  expect(serviceDoc?.content).toContain("function:src/service/feed.ts:BuildFeed");
  expect(serviceDoc?.content).toContain("function:src/service/feed.ts:rankCandidates");
  expect(kb.coverageReport.status).toBe("complete");
});

it("keeps missing source files incomplete instead of hiding them in indexes", () => {
  const graph = sampleGraph();
  graph.nodes.push({
    id: "file:src/missing.ts",
    type: "file",
    name: "missing.ts",
    filePath: "src/missing.ts",
    summary: "Missing source file",
    tags: ["stale"],
    complexity: "simple",
  });
  const kb = generateKnowledgeBase(graph, { sourceFiles: {} });
  expect(kb.coverageReport.status).toBe("incomplete");
  expect(kb.coverageReport.sourceReadCoverage.missing).toContain("file:src/missing.ts");
});
```

- [ ] **Step 2: Implement merge result helper**

Create `packages/core/src/knowledge-base/merge.ts`:

```ts
import type {
  CoverageValidationResult,
  FileDocPlan,
  FileWriterBatchOutput,
  FileWriterDocument,
  GeneratedDocument,
  ProjectProfile,
  RetryPlan,
  TopicWriterBatchOutput,
  TopicWriterDocument,
} from "./types.js";

export interface MergeKnowledgeBaseInputs {
  profile: ProjectProfile;
  fileDocPlan: FileDocPlan;
  fileWriterOutputs: FileWriterBatchOutput[];
  topicWriterOutputs?: TopicWriterBatchOutput[];
}

export interface MergeKnowledgeBaseResult {
  fileDocuments: GeneratedDocument[];
  topicDocuments: GeneratedDocument[];
  validation: CoverageValidationResult;
  retryPlan: RetryPlan;
  acceptedFileWriterDocuments: FileWriterDocument[];
  acceptedTopicWriterDocuments: TopicWriterDocument[];
}

function emptyRetryPlan(): RetryPlan {
  return { fileBatchIndexes: [], topicBatchIndexes: [], reasons: [] };
}
```

- [ ] **Step 3: Implement file document merge validation**

Add to `merge.ts`:

```ts
function documentFromFileWriter(doc: FileWriterDocument): GeneratedDocument {
  return {
    path: doc.documentPath,
    title: doc.title,
    category: "file",
    coveredNodeIds: [doc.fileNodeId, ...doc.coveredFunctionNodeIds, ...doc.coveredClassNodeIds],
    representedEdgeIds: doc.representedEdgeIds,
    content: doc.markdown,
  };
}

function documentFromTopicWriter(doc: TopicWriterDocument): GeneratedDocument {
  return {
    path: doc.documentPath,
    title: doc.title,
    category: "topic",
    coveredNodeIds: doc.coveredNodeIds,
    representedEdgeIds: [],
    content: doc.markdown,
  };
}

export function mergeKnowledgeBaseWriterOutputs(inputs: MergeKnowledgeBaseInputs): MergeKnowledgeBaseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const retryPlan = emptyRetryPlan();
  const docsByFileNode = new Map<string, FileWriterDocument>();
  const paths = new Set<string>();

  for (const batch of inputs.fileWriterOutputs) {
    for (const doc of batch.documents) {
      if (docsByFileNode.has(doc.fileNodeId)) {
        errors.push(`duplicate file document for ${doc.fileNodeId}`);
        retryPlan.fileBatchIndexes.push(batch.batchIndex);
      }
      if (paths.has(doc.documentPath)) {
        errors.push(`duplicate document path ${doc.documentPath}`);
        retryPlan.fileBatchIndexes.push(batch.batchIndex);
      }
      docsByFileNode.set(doc.fileNodeId, doc);
      paths.add(doc.documentPath);
    }
  }

  for (const task of inputs.fileDocPlan.tasks) {
    const doc = docsByFileNode.get(task.fileNodeId);
    if (!doc) {
      errors.push(`missing file document for ${task.fileNodeId}`);
      retryPlan.fileBatchIndexes.push(task.batchIndex);
      continue;
    }
    for (const functionNodeId of task.functionNodeIds) {
      if (!doc.coveredFunctionNodeIds.includes(functionNodeId)) {
        errors.push(`missing function card ${functionNodeId} in ${doc.documentPath}`);
        retryPlan.fileBatchIndexes.push(task.batchIndex);
      }
      if (!doc.markdown.includes(functionNodeId)) {
        errors.push(`function card lacks node id ${functionNodeId} in ${doc.documentPath}`);
        retryPlan.fileBatchIndexes.push(task.batchIndex);
      }
    }
    for (const classNodeId of task.classNodeIds) {
      if (!doc.coveredClassNodeIds.includes(classNodeId)) {
        errors.push(`missing class card ${classNodeId} in ${doc.documentPath}`);
        retryPlan.fileBatchIndexes.push(task.batchIndex);
      }
      if (!doc.markdown.includes(classNodeId)) {
        errors.push(`class card lacks node id ${classNodeId} in ${doc.documentPath}`);
        retryPlan.fileBatchIndexes.push(task.batchIndex);
      }
    }
    if (!task.sourceSnapshot.exists) {
      errors.push(`source missing for ${task.fileNodeId}`);
      retryPlan.fileBatchIndexes.push(task.batchIndex);
    }
  }

  const topicDocs = inputs.topicWriterOutputs?.flatMap((batch) => batch.topics) ?? [];
  const fileDocuments = [...docsByFileNode.values()].sort((a, b) => a.documentPath.localeCompare(b.documentPath)).map(documentFromFileWriter);
  const topicDocuments = topicDocs.sort((a, b) => a.documentPath.localeCompare(b.documentPath)).map(documentFromTopicWriter);
  const uniqueFileBatches = [...new Set(retryPlan.fileBatchIndexes)].sort((a, b) => a - b);
  return {
    fileDocuments,
    topicDocuments,
    validation: { ok: errors.length === 0, errors, warnings },
    retryPlan: { ...retryPlan, fileBatchIndexes: uniqueFileBatches, reasons: [...errors] },
    acceptedFileWriterDocuments: [...docsByFileNode.values()],
    acceptedTopicWriterDocuments: topicDocs,
  };
}
```

- [ ] **Step 4: Export merge API**

Update `packages/core/src/knowledge-base/index.ts`:

```ts
export * from "./merge.js";
```

- [ ] **Step 5: Run knowledge-base tests**

```bash
pnpm --filter @understand-code/core test -- src/knowledge-base/__tests__/knowledge-base.test.ts
```

Expected: tests still fail until `generateKnowledgeBase` calls the file-doc planner and deterministic file writer.

- [ ] **Step 6: Commit merge layer**

```bash
git add packages/core/src/knowledge-base/merge.ts packages/core/src/knowledge-base/index.ts packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts
git commit -m "feat: merge complete file knowledge documents"
```

## Task 6: Render Deterministic File Docs, Indexes, Maps, And Strict Reports

**Files:**
- Modify: `packages/core/src/knowledge-base/markdown.ts`
- Modify: `packages/core/src/knowledge-base/generate.ts`
- Modify: `packages/core/src/knowledge-base/planner.ts`
- Modify: `packages/core/src/knowledge-base/index.ts`

- [ ] **Step 1: Add deterministic file-writer fallback inside `markdown.ts`**

Add a function that turns every `FileDocTask` into a complete Chinese `FileWriterDocument`. This fallback is not as rich as agent output, but it must cover every node/card and keep the coverage rules honest.

```ts
import type { FileDocTask, FileWriterDocument, ProjectProfile } from "./types.js";

function nodeLabel(profile: ProjectProfile, nodeId: string): string {
  const node = profile.indexes.nodesById.get(nodeId);
  return node ? `${node.name} (${node.type})` : nodeId;
}

export function renderDeterministicFileWriterDocument(profile: ProjectProfile, task: FileDocTask): FileWriterDocument {
  const functionCards = task.functionNodeIds.map((nodeId) => {
    const node = profile.indexes.nodesById.get(nodeId);
    const outgoing = profile.indexes.outgoingEdgesByNode.get(nodeId) ?? [];
    const incoming = profile.indexes.incomingEdgesByNode.get(nodeId) ?? [];
    return [
      `### ${node?.name ?? nodeId}`,
      `- 节点 ID: \`${nodeId}\``,
      `- 位置: \`${node?.filePath ?? task.filePath}\`${node?.lineRange ? `:${node.lineRange.join("-")}` : ""}`,
      `- 职责: ${node?.summary || "本地代码事实: 图谱没有提供摘要。"}`,
      `- 输入/依赖: ${incoming.map((edge) => nodeLabel(profile, edge.source)).join(", ") || "未在图谱中识别"}`,
      `- 输出/副作用: ${outgoing.map((edge) => nodeLabel(profile, edge.target)).join(", ") || "未在图谱中识别"}`,
      `- 上游调用: ${incoming.filter((edge) => edge.type === "calls").map((edge) => nodeLabel(profile, edge.source)).join(", ") || "无"}`,
      `- 下游调用: ${outgoing.filter((edge) => edge.type === "calls").map((edge) => nodeLabel(profile, edge.target)).join(", ") || "无"}`,
      `- 业务含义: 根据名称、标签和调用关系推断，该函数参与 ${node?.tags.join("、") || "当前文件职责"}。根据代码推断，需线上配置确认`,
      `- 注意事项: 修改前检查调用关系索引和相关测试。`,
      `- 代码证据: \`${node?.filePath ?? task.filePath}\`${node?.lineRange ? `:${node.lineRange.join("-")}` : ""}`,
    ].join("\n");
  });

  const classCards = task.classNodeIds.map((nodeId) => {
    const node = profile.indexes.nodesById.get(nodeId);
    return [
      `### ${node?.name ?? nodeId}`,
      `- 节点 ID: \`${nodeId}\``,
      `- 位置: \`${node?.filePath ?? task.filePath}\`${node?.lineRange ? `:${node.lineRange.join("-")}` : ""}`,
      `- 职责: ${node?.summary || "本地代码事实: 图谱没有提供摘要。"}`,
      `- 代码证据: \`${node?.filePath ?? task.filePath}\`${node?.lineRange ? `:${node.lineRange.join("-")}` : ""}`,
    ].join("\n");
  });

  const representedEdgeIds = [...task.incomingEdgeIds, ...task.outgoingEdgeIds].sort();
  return {
    fileNodeId: task.fileNodeId,
    filePath: task.filePath,
    documentPath: task.documentPath,
    title: `${task.filePath} 文件知识文档`,
    coveredFunctionNodeIds: task.functionNodeIds,
    coveredClassNodeIds: task.classNodeIds,
    representedEdgeIds,
    sourceEvidence: [{ filePath: task.filePath, nodeId: task.fileNodeId }],
    importantNodeIds: [...task.functionNodeIds, ...task.classNodeIds].filter((nodeId) => profile.indexes.nodesById.get(nodeId)?.complexity === "complex"),
    markdown: [
      `# ${task.filePath} 文件知识文档`,
      "",
      "## 文件职责",
      profile.indexes.nodesById.get(task.fileNodeId)?.summary || "本地代码事实: 图谱中存在该文件，但没有摘要。",
      "",
      "## 所属位置",
      `- Layer: ${task.layerId ?? "未分层"}`,
      `- 目录/模块: \`${task.filePath}\``,
      `- 上游文件/函数: ${task.incomingEdgeIds.length}`,
      `- 下游文件/函数: ${task.outgoingEdgeIds.length}`,
      "",
      "## 文件内结构",
      `- 函数总数: ${task.functionNodeIds.length}`,
      `- 类总数: ${task.classNodeIds.length}`,
      `- 关键函数: ${[...task.functionNodeIds, ...task.classNodeIds].filter((nodeId) => profile.indexes.nodesById.get(nodeId)?.complexity === "complex").map((nodeId) => profile.indexes.nodesById.get(nodeId)?.name ?? nodeId).join(", ") || "无"}`,
      "",
      "## 函数卡片",
      functionCards.join("\n\n") || "本文件没有图谱函数节点。",
      "",
      "## 类卡片",
      classCards.join("\n\n") || "本文件没有图谱类节点。",
      "",
      "## 调用关系",
      representedEdgeIds.map((id) => `- ${id}`).join("\n") || "- 图谱未记录调用或导入关系。",
      "",
      "## 风险点与待确认项",
      task.sourceSnapshot.exists ? "- 运行时配置、数据内容和线上流量路径需要外部确认。根据代码推断，需线上配置确认" : "- 源文件缺失，当前文档只能基于图谱生成，最终状态必须为 incomplete。",
      "",
      "## AI 检索词",
      [task.filePath, ...task.functionNodeIds, ...task.classNodeIds].join(", "),
    ].join("\n"),
  };
}
```

- [ ] **Step 2: Render top-level maps and indexes with new paths**

Update existing top-level renderers in `markdown.ts` so output names match the spec:

```ts
const TOP_LEVEL_DOCUMENTS = [
  KB_PATHS.inventory,
  KB_PATHS.projectOverview,
  KB_PATHS.architectureMap,
  KB_PATHS.businessFlowMap,
  KB_PATHS.pendingItems,
  `${KB_PATHS.indexDir}/文件索引.md`,
  `${KB_PATHS.indexDir}/函数索引.md`,
  `${KB_PATHS.indexDir}/类索引.md`,
  `${KB_PATHS.indexDir}/调用关系索引.md`,
  `${KB_PATHS.indexDir}/AI检索索引.md`,
  KB_PATHS.coverageReport,
];
```

Ensure `索引/调用关系索引.md` iterates all `calls` edges:

```ts
function renderCallRelationshipIndex(profile: ProjectProfile): string {
  const lines = ["# 调用关系索引", "", "| Source | Target | Type |", "|---|---|---|"];
  for (const edge of profile.graph.edges.filter((item) => item.type === "calls")) {
    lines.push(`| \`${edge.source}\` | \`${edge.target}\` | ${edge.type} |`);
  }
  if (lines.length === 4) lines.push("| 无 | 无 | calls |");
  return lines.join("\n");
}
```

- [ ] **Step 3: Build strict coverage report**

Replace the old `buildCoverageReport` implementation with one that counts file docs/cards from accepted generated documents:

```ts
function ratio(coveredIds: Set<string>, expectedIds: string[]): CoverageRatio {
  const missing = expectedIds.filter((id) => !coveredIds.has(id)).sort();
  return { covered: expectedIds.length - missing.length, total: expectedIds.length, missing };
}

function statusFrom(errors: string[], warnings: string[]): KnowledgeBaseStatus {
  if (errors.length > 0) return "incomplete";
  return warnings.length > 0 ? "complete-with-warnings" : "complete";
}
```

The report must include:

- document counts by category;
- file document coverage;
- function card coverage;
- class card coverage;
- relationship coverage for `calls`, `imports`, and `contains`;
- source-read coverage;
- batch pass/retry counts;
- Chinese and placeholder validation summaries;
- all warnings and errors;
- final status.

- [ ] **Step 4: Update `generateKnowledgeBase` to use exhaustive file docs**

Modify `packages/core/src/knowledge-base/generate.ts`:

```ts
import type { KnowledgeGraph } from "../types.js";
import { buildKnowledgeBaseProfile } from "./profile.js";
import { buildDocumentPlan, buildTopicPlan } from "./planner.js";
import { buildFileDocPlan } from "./file-doc-planner.js";
import { mergeKnowledgeBaseWriterOutputs } from "./merge.js";
import {
  buildCoverageReport,
  renderDeterministicFileWriterDocument,
  renderKnowledgeBaseDocuments,
} from "./markdown.js";
import type { GeneratedKnowledgeBase, KnowledgeBaseOptions } from "./types.js";

export function generateKnowledgeBase(
  graph: KnowledgeGraph,
  options: KnowledgeBaseOptions = {},
): GeneratedKnowledgeBase {
  const profile = buildKnowledgeBaseProfile(graph);
  const fileDocPlan = buildFileDocPlan(profile, options);
  const deterministicFileOutput = {
    batchIndex: 1,
    documents: fileDocPlan.tasks.map((task) => renderDeterministicFileWriterDocument(profile, task)),
    warnings: [],
  };
  const merged = mergeKnowledgeBaseWriterOutputs({
    profile,
    fileDocPlan,
    fileWriterOutputs: [deterministicFileOutput],
  });
  const topicPlan = buildTopicPlan(profile, fileDocPlan, merged.acceptedFileWriterDocuments);
  const plan = buildDocumentPlan(profile);
  const supportDocuments = renderKnowledgeBaseDocuments(profile, plan, fileDocPlan, topicPlan, merged);
  const preliminaryDocuments = [...supportDocuments, ...merged.fileDocuments, ...merged.topicDocuments];
  const coverageReport = buildCoverageReport(profile, fileDocPlan, topicPlan, preliminaryDocuments, merged.validation, merged.retryPlan);
  const finalSupportDocuments = renderKnowledgeBaseDocuments(profile, plan, fileDocPlan, topicPlan, merged, coverageReport);
  const documents = [...finalSupportDocuments, ...merged.fileDocuments, ...merged.topicDocuments].sort((a, b) => a.path.localeCompare(b.path));
  return {
    profile,
    plan,
    fileDocPlan,
    topicPlan,
    documents,
    validation: merged.validation,
    coverageReport,
    retryPlan: merged.retryPlan,
  };
}
```

Adapt imports and function signatures in `markdown.ts` to match this orchestration.

- [ ] **Step 5: Run all core knowledge-base tests**

```bash
pnpm --filter @understand-code/core test -- src/knowledge-base/__tests__/file-doc-planner.test.ts src/knowledge-base/__tests__/writer-contracts.test.ts src/knowledge-base/__tests__/knowledge-base.test.ts
```

Expected: all knowledge-base tests pass.

- [ ] **Step 6: Commit renderer and strict report**

```bash
git add packages/core/src/knowledge-base/markdown.ts packages/core/src/knowledge-base/generate.ts packages/core/src/knowledge-base/planner.ts packages/core/src/knowledge-base/index.ts
git commit -m "feat: render complete source-backed knowledge base"
```

## Task 7: Build Dynamic Topic Planning From Graph And File Docs

**Files:**
- Modify: `packages/core/src/knowledge-base/planner.ts`
- Modify: `packages/core/src/knowledge-base/types.ts`
- Modify: `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`

- [ ] **Step 1: Add tests proving topic count is dynamic and uncapped**

Append this test:

```ts
it("selects topic documents from project signals without a fixed count", () => {
  const graph = sampleGraph(true);
  for (let index = 0; index < 25; index += 1) {
    const filePath = `src/service/important-${index}.ts`;
    graph.nodes.push(
      { id: `file:${filePath}`, type: "file", name: `important-${index}.ts`, filePath, summary: `Important business file ${index}`, tags: ["business"], complexity: "complex" },
      { id: `function:${filePath}:ImportantFlow${index}`, type: "function", name: `ImportantFlow${index}`, filePath, lineRange: [1, 30], summary: `Important business flow ${index}`, tags: ["business", "flow"], complexity: "complex" },
    );
    graph.edges.push({ source: `file:${filePath}`, target: `function:${filePath}:ImportantFlow${index}`, type: "contains", direction: "forward", weight: 1 });
  }
  const sourceFiles = Object.fromEntries(
    graph.nodes
      .filter((node) => node.type === "file" && node.filePath)
      .map((node) => [node.filePath!, "export function placeholder() { return true; }\n"]),
  );
  const kb = generateKnowledgeBase(graph, { sourceFiles });
  expect(kb.topicPlan.topics.length).toBeGreaterThan(25);
});
```

- [ ] **Step 2: Implement `buildTopicPlan`**

In `planner.ts`, add:

```ts
import type { FileDocPlan, FileWriterDocument, TopicBatch, TopicPlan, TopicPlanItem } from "./types.js";
import { topicDocumentPath } from "./paths.js";

export function buildTopicPlan(
  profile: ProjectProfile,
  fileDocPlan: FileDocPlan,
  acceptedFileDocs: FileWriterDocument[],
): TopicPlan {
  const candidates = selectTopicCandidates(profile);
  const importantFromFiles = new Map<string, string[]>();
  for (const fileDoc of acceptedFileDocs) {
    for (const nodeId of fileDoc.importantNodeIds) {
      const reasons = importantFromFiles.get(nodeId) ?? [];
      reasons.push(`file-writer marked important in ${fileDoc.documentPath}`);
      importantFromFiles.set(nodeId, reasons);
    }
  }
  const reasonsByNode = new Map<string, string[]>();
  for (const candidate of candidates) reasonsByNode.set(candidate.nodeId, [...candidate.reasons]);
  for (const [nodeId, reasons] of importantFromFiles) {
    reasonsByNode.set(nodeId, [...(reasonsByNode.get(nodeId) ?? []), ...reasons]);
  }
  const topics: TopicPlanItem[] = [...reasonsByNode.entries()]
    .map(([nodeId, reasons], index) => {
      const node = profile.indexes.nodesById.get(nodeId);
      const sourceFileNodeId = profile.indexes.functionToFileId.get(nodeId) ?? profile.indexes.classToFileId.get(nodeId) ?? "";
      const fileTask = fileDocPlan.tasks.find((task) => task.fileNodeId === sourceFileNodeId);
      return {
        batchIndex: 0,
        topicNodeId: nodeId,
        sourceFileNodeId,
        documentPath: topicDocumentPath(node?.filePath ?? sourceFileNodeId, node?.name ?? nodeId),
        title: `${node?.name ?? nodeId} 关键函数专题`,
        reasons: [...new Set(reasons)].sort(),
        coveredNodeIds: [nodeId],
        linkedFileDocumentPath: fileTask?.documentPath ?? "",
      };
    })
    .filter((topic) => topic.sourceFileNodeId.length > 0)
    .sort((a, b) => a.documentPath.localeCompare(b.documentPath));
  const batches: TopicBatch[] = topics.map((topic, index) => ({
    batchIndex: index + 1,
    topics: [{ ...topic, batchIndex: index + 1 }],
    reason: "one topic per batch keeps topic generation isolated and retryable",
  }));
  return {
    topics: batches.flatMap((batch) => batch.topics),
    batches,
    warnings: [],
  };
}
```

- [ ] **Step 3: Generate deterministic topic fallback documents**

Add a `renderDeterministicTopicWriterDocument` function in `markdown.ts` and use it in `generateKnowledgeBase` when agent topic outputs are absent. It must include all required topic sections exactly:

```ts
[
  "## 为什么关键",
  "## 在业务流程中的位置",
  "## 主要输入、输出、副作用",
  "## 关键分支和算法",
  "## 配置和外部依赖",
  "## 上游调用者",
  "## 下游调用对象",
  "## 修改风险",
  "## 测试证据",
  "## 代码证据",
  "## AI 检索词",
]
```

- [ ] **Step 4: Run topic tests**

```bash
pnpm --filter @understand-code/core test -- src/knowledge-base/__tests__/knowledge-base.test.ts
```

Expected: dynamic topic test passes and no topic cap exists.

- [ ] **Step 5: Commit topic planning**

```bash
git add packages/core/src/knowledge-base/planner.ts packages/core/src/knowledge-base/markdown.ts packages/core/src/knowledge-base/generate.ts packages/core/src/knowledge-base/types.ts packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts
git commit -m "feat: plan uncapped knowledge base topic documents"
```

## Task 8: Add Agent Prompts For Parallel File And Topic Writers

**Files:**
- Create: `agents/kb-file-writer.md`
- Create: `agents/kb-topic-writer.md`

- [ ] **Step 1: Create `kb-file-writer` prompt**

Create `agents/kb-file-writer.md` with this structure:

```markdown
---
name: kb-file-writer
description: Generates complete Chinese file-level knowledge documents from file-doc tasks, graph context, and source code.
---

# KB File Writer

You are an expert code knowledge-base writer. Your job is to produce complete Chinese file documents for every task in your assigned batch.

## Hard Rules

- Write one document per `FileDocTask`.
- Do not skip any function node listed in `functionNodeIds`.
- Do not skip any class node listed in `classNodeIds`.
- Keep technical identifiers, file paths, node ids, package names, and function names unchanged.
- All explanatory prose must be Chinese.
- If a business fact is inferred from code rather than confirmed by runtime data, write: `根据代码推断，需线上配置确认`.
- Do not output Markdown files directly. Output exactly one JSON file at the requested path.
- The JSON `coveredFunctionNodeIds` must contain every function node id from the task.
- The JSON `coveredClassNodeIds` must contain every class node id from the task.
- Missing or uncertain business meaning belongs in the document section `## 风险点与待确认项`.

## Required Output JSON

```json
{
  "batchIndex": 1,
  "documents": [
    {
      "fileNodeId": "file:src/service/feed.ts",
      "filePath": "src/service/feed.ts",
      "documentPath": "文件文档/src-service-feed.ts.md",
      "title": "src/service/feed.ts 文件知识文档",
      "coveredFunctionNodeIds": ["function:src/service/feed.ts:BuildFeed"],
      "coveredClassNodeIds": [],
      "representedEdgeIds": ["calls:function:src/api/routes.ts:HandleFeedRequest->function:src/service/feed.ts:BuildFeed"],
      "sourceEvidence": [
        { "filePath": "src/service/feed.ts", "lineRange": [30, 90], "nodeId": "function:src/service/feed.ts:BuildFeed" }
      ],
      "importantNodeIds": ["function:src/service/feed.ts:BuildFeed"],
      "markdown": "# src/service/feed.ts 文件知识文档\n\n## 文件职责\n本文件负责 feed 业务编排。\n\n## 所属位置\nService Layer。\n\n## 文件内结构\n包含 BuildFeed 函数。\n\n## 函数卡片\n### BuildFeed\n- 节点 ID: `function:src/service/feed.ts:BuildFeed`\n\n## 类卡片\n无。\n\n## 调用关系\n读取候选并调用排序逻辑。\n\n## 风险点与待确认项\n根据代码推断，需线上配置确认\n\n## AI 检索词\nfeed, BuildFeed"
    }
  ],
  "warnings": []
}
```

## Required Markdown Sections

Every `markdown` value must include:

- `## 文件职责`
- `## 所属位置`
- `## 文件内结构`
- `## 函数卡片`
- `## 类卡片`
- `## 调用关系`
- `## 风险点与待确认项`
- `## AI 检索词`

## Function Card Required Fields

For every function node, include:

- 节点 ID
- 位置
- 职责
- 输入/依赖
- 输出/副作用
- 上游调用
- 下游调用
- 业务含义
- 注意事项
- 代码证据

## Self Check Before Writing JSON

- Count tasks in the input.
- Count documents in the output.
- The counts must match.
- For every task, compare `functionNodeIds` to `coveredFunctionNodeIds`.
- For every task, compare `classNodeIds` to `coveredClassNodeIds`.
- Confirm every required section exists in every Markdown value.
```

- [ ] **Step 2: Create `kb-topic-writer` prompt**

Create `agents/kb-topic-writer.md`:

```markdown
---
name: kb-topic-writer
description: Generates Chinese topic documents for important functions/classes selected from the complete file-document layer.
---

# KB Topic Writer

You are an expert code and business-flow explainer. Your job is to produce detailed Chinese topic documents for the topic tasks assigned to your batch.

## Hard Rules

- Write one topic document per topic task.
- Keep identifiers, file paths, node ids, package names, and function names unchanged.
- All explanatory prose must be Chinese.
- Ground claims in provided graph context, linked file document, and source evidence.
- If a runtime or business fact is inferred, write: `根据代码推断，需线上配置确认`.
- Do not output Markdown files directly. Output exactly one JSON file at the requested path.

## Required Output JSON

```json
{
  "batchIndex": 1,
  "topics": [
    {
      "topicNodeId": "function:src/service/feed.ts:BuildFeed",
      "sourceFileNodeId": "file:src/service/feed.ts",
      "documentPath": "关键函数专题/src-service-feed.ts-BuildFeed.md",
      "title": "BuildFeed 关键函数专题",
      "coveredNodeIds": ["function:src/service/feed.ts:BuildFeed"],
      "linkedFileDocumentPath": "文件文档/src-service-feed.ts.md",
      "evidence": [{ "filePath": "src/service/feed.ts", "lineRange": [30, 90] }],
      "markdown": "# BuildFeed 关键函数专题\n\n## 为什么关键\n它位于 feed 主业务链路。\n\n## 在业务流程中的位置\n入口请求之后、数据读取之前。\n\n## 主要输入、输出、副作用\n输入请求上下文，输出 feed 结果。\n\n## 关键分支和算法\n候选加载后进行排序。\n\n## 配置和外部依赖\n根据代码推断，需线上配置确认\n\n## 上游调用者\nHandleFeedRequest。\n\n## 下游调用对象\nLoadCandidates。\n\n## 修改风险\n影响推荐结果。\n\n## 测试证据\n检查 feed service 测试。\n\n## 代码证据\nsrc/service/feed.ts:30-90\n\n## AI 检索词\nfeed, BuildFeed"
    }
  ],
  "warnings": []
}
```

## Required Markdown Sections

Every topic must include:

- `## 为什么关键`
- `## 在业务流程中的位置`
- `## 主要输入、输出、副作用`
- `## 关键分支和算法`
- `## 配置和外部依赖`
- `## 上游调用者`
- `## 下游调用对象`
- `## 修改风险`
- `## 测试证据`
- `## 代码证据`
- `## AI 检索词`

## Self Check Before Writing JSON

- Count topic tasks in the input.
- Count topics in the output.
- The counts must match.
- Confirm every required section exists in every Markdown value.
- Confirm every `coveredNodeIds` includes the task `topicNodeId`.
```

- [ ] **Step 3: Scan prompt files for forbidden placeholder markers**

```bash
rg -n "T[B]D|TO[D]O|FIX[M]E|后续\\s*补充|这里\\s*填写" agents/kb-file-writer.md agents/kb-topic-writer.md
```

Expected: no output.

- [ ] **Step 4: Commit agent prompts**

```bash
git add agents/kb-file-writer.md agents/kb-topic-writer.md
git commit -m "feat: add knowledge base writer agents"
```

## Task 9: Add CLI Phases For Prepare, Merge, Topics, Finalize, And Retry

**Files:**
- Modify: `skills/understand-kb/generate-knowledge-base.mjs`
- Modify: `skills/understand-kb/SKILL.md`

- [ ] **Step 1: Update CLI argument parser**

In `skills/understand-kb/generate-knowledge-base.mjs`, add supported flags:

```js
function parseArgs(argv) {
  const args = {
    projectRoot: process.cwd(),
    phase: 'deterministic',
    keepIntermediate: true,
    deterministicOnly: false,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--prepare-file-docs') args.phase = 'prepare-file-docs';
    else if (arg === '--merge-file-docs') args.phase = 'merge-file-docs';
    else if (arg === '--prepare-topics') args.phase = 'prepare-topics';
    else if (arg === '--finalize') args.phase = 'finalize';
    else if (arg === '--retry') args.phase = 'retry';
    else if (arg === '--deterministic-only') args.deterministicOnly = true;
    else if (arg === '--clean-intermediate') args.keepIntermediate = false;
    else if (!arg.startsWith('--')) args.projectRoot = resolve(arg);
  }
  return args;
}
```

- [ ] **Step 2: Add source file reader**

Add:

```js
function sourceFilesForGraph(projectRoot, graph) {
  const result = {};
  for (const node of graph.nodes) {
    if (node.type !== 'file' || !node.filePath) continue;
    const absolute = join(projectRoot, node.filePath);
    if (!existsSync(absolute)) continue;
    result[node.filePath] = readFileSync(absolute, 'utf-8');
  }
  return result;
}
```

- [ ] **Step 3: Add intermediate writer**

Add:

```js
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf-8');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}
```

- [ ] **Step 4: Implement prepare-file-docs phase**

This phase loads graph, validates it, reads source files, calls core profile and file planner, and writes:

- `.understand-code/knowledge-base/.intermediate/kb-profile.json`
- `.understand-code/knowledge-base/.intermediate/file-doc-plan.json`
- `.understand-code/knowledge-base/.intermediate/file-doc-batches.json`

Print:

```text
Prepared file document batches: <batchCount>
File document tasks: <taskCount>
Missing source files: <missingCount>
```

- [ ] **Step 5: Implement merge-file-docs phase**

This phase reads `file-doc-batch-<n>.json` files from `.intermediate/`, validates them with `parseFileWriterBatchOutput`, merges with `mergeKnowledgeBaseWriterOutputs`, writes:

- `.intermediate/validation-report.json`
- `.intermediate/file-doc-retry-plan.json` when retry is needed
- accepted file Markdown into `文件文档/`

Print:

```text
Accepted file documents: <count>
File writer batches requiring retry: <count>
```

- [ ] **Step 6: Implement prepare-topics phase**

This phase reads accepted file writer outputs, builds `TopicPlan`, and writes:

- `.intermediate/topic-plan.json`
- `.intermediate/topic-batches.json`

Print:

```text
Prepared topic batches: <batchCount>
Topic documents planned: <topicCount>
```

- [ ] **Step 7: Implement finalize phase**

This phase reads file/topic outputs, validates again, writes support docs and final report. It must print:

```text
Knowledge base generated at <path>
Generated Markdown documents: <count>
Coverage status: <status>
File document coverage: <covered> / <total>
Function card coverage: <covered> / <total>
Class card coverage: <covered> / <total>
```

- [ ] **Step 8: Preserve deterministic-only mode**

If `--deterministic-only` is passed, call `generateKnowledgeBase(graph, { sourceFiles })` and write all returned docs directly. This keeps the tool useful when no subagent runtime is available.

- [ ] **Step 9: Update `/understand-kb` skill orchestration**

Rewrite `skills/understand-kb/SKILL.md` phases:

1. Resolve `PROJECT_ROOT`.
2. Validate `.understand-code/knowledge-graph.json`.
3. Build core if needed.
4. Run `node "$PLUGIN_ROOT/skills/understand-kb/generate-knowledge-base.mjs" "$PROJECT_ROOT" --prepare-file-docs`.
5. Read `.intermediate/file-doc-batches.json`.
6. Dispatch `agents/kb-file-writer.md` for every batch, up to `--parallel <n>` if provided; default to 5.
7. After each file-writer returns, verify `file-doc-batch-<batchIndex>.json` exists.
8. Run `--merge-file-docs`.
9. If retry plan contains file batches, rerun only those batches once, then merge again.
10. Run `--prepare-topics`.
11. Read `.intermediate/topic-batches.json`.
12. Dispatch `agents/kb-topic-writer.md` for every topic batch, up to the same parallel limit.
13. Run `--finalize`.
14. Report path, document count, final status, file/function/class coverage.

- [ ] **Step 10: Run deterministic CLI smoke test**

```bash
pnpm --filter @understand-code/core build
node skills/understand-kb/generate-knowledge-base.mjs /Users/example/understand-code --deterministic-only
```

Expected:

- exits 0;
- prints generated Markdown document count;
- writes `.understand-code/knowledge-base/覆盖报告.md`;
- generated report includes file document, function card, and class card coverage.

- [ ] **Step 11: Commit CLI and skill orchestration**

```bash
git add skills/understand-kb/generate-knowledge-base.mjs skills/understand-kb/SKILL.md
git commit -m "feat: orchestrate parallel knowledge base generation"
```

## Task 10: End-To-End Verification And Coverage Audit

**Files:**
- Modify only files needed to fix failures discovered by this task.

- [ ] **Step 1: Run focused tests**

```bash
pnpm --filter @understand-code/core test -- src/knowledge-base/__tests__/file-doc-planner.test.ts src/knowledge-base/__tests__/writer-contracts.test.ts src/knowledge-base/__tests__/knowledge-base.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run full core test suite**

```bash
pnpm --filter @understand-code/core test
```

Expected: all core tests pass.

- [ ] **Step 3: Run core build**

```bash
pnpm --filter @understand-code/core build
```

Expected: TypeScript build passes.

- [ ] **Step 4: Run deterministic knowledge-base generation against the current repo**

```bash
node skills/understand-kb/generate-knowledge-base.mjs /Users/example/understand-code --deterministic-only
```

Expected: script exits 0 and prints:

```text
Generated Markdown documents: <actual number>
Coverage status: complete
File document coverage: <same number> / <same number>
Function card coverage: <same number> / <same number>
Class card coverage: <same number> / <same number>
```

If source files are missing because the graph is stale, expected status is `incomplete` or `complete-with-warnings`; do not downgrade validation to force `complete`.

- [ ] **Step 5: Inspect generated coverage report**

Run:

```bash
sed -n '1,220p' /Users/example/understand-code/.understand-code/knowledge-base/覆盖报告.md
```

Confirm it includes:

- total Markdown document count;
- file document coverage;
- function card coverage;
- class card coverage;
- relationship coverage;
- source-read coverage;
- file-writer batch counts;
- topic batch counts;
- final status.

- [ ] **Step 6: Scan generated docs for placeholder markers**

```bash
rg -n "T[B]D|TO[D]O|FIX[M]E|后续\\s*补充|这里\\s*填写" /Users/example/understand-code/.understand-code/knowledge-base || true
```

Expected: no output.

- [ ] **Step 7: Scan generated docs for non-Chinese section names that should have been localized**

```bash
rg -n "^## (Why|Input|Output|Risk|Evidence|Overview|Summary)" /Users/example/understand-code/.understand-code/knowledge-base || true
```

Expected: no output from generated Chinese docs.

- [ ] **Step 8: Commit final verification fixes**

If any fixes were required:

```bash
git add packages/core/src/knowledge-base skills/understand-kb agents/kb-file-writer.md agents/kb-topic-writer.md
git commit -m "fix: complete knowledge base coverage verification"
```

If no fixes were required, do not create an empty commit.

## Task 11: Manual Parallel-Agent Dry Run

**Files:**
- Generated files under `.understand-code/knowledge-base/` only.

- [ ] **Step 1: Prepare file-doc batches**

```bash
node skills/understand-kb/generate-knowledge-base.mjs /Users/example/understand-code --prepare-file-docs
```

Expected:

- `.understand-code/knowledge-base/.intermediate/file-doc-batches.json` exists;
- the printed task count equals the graph file-node count.

- [ ] **Step 2: Open the batch plan and count batches**

```bash
node -e "const fs=require('fs'); const p='/Users/example/understand-code/.understand-code/knowledge-base/.intermediate/file-doc-batches.json'; const data=JSON.parse(fs.readFileSync(p,'utf8')); console.log(data.batches.length); console.log(data.batches.reduce((sum,b)=>sum+b.tasks.length,0));"
```

Expected: first number is the dynamic batch count; second number equals file task count.

- [ ] **Step 3: Dispatch file-writer agents through `/understand-kb`**

Invoke the actual skill flow:

```text
/understand-kb /Users/example/understand-code --parallel 5
```

Expected:

- multiple `kb-file-writer` agents run concurrently;
- every `file-doc-batch-<n>.json` appears;
- failed batches are retried by batch index only;
- final report prints actual document count.

- [ ] **Step 4: Confirm the generated knowledge base is large enough for the graph**

Run:

```bash
node -e "const fs=require('fs'); const graph=JSON.parse(fs.readFileSync('/Users/example/understand-code/.understand-code/knowledge-graph.json','utf8')); const report=fs.readFileSync('/Users/example/understand-code/.understand-code/knowledge-base/覆盖报告.md','utf8'); console.log('graph files', graph.nodes.filter(n=>n.type==='file').length); console.log(report.match(/Generated Markdown documents|总文档数|File document coverage|Function card coverage|Class card coverage/g));"
```

Expected: coverage report shows document count and exact file/function/class coverage. If the graph has hundreds of files, the knowledge base has hundreds of file documents.

## Final Acceptance Checklist

- [ ] The plan produces one file doc per graph file node.
- [ ] The plan produces one function card per graph function node.
- [ ] The plan produces one class card per graph class node.
- [ ] The plan produces a call relationship index covering every `calls` edge.
- [ ] The plan never uses a fixed document or topic cap.
- [ ] The plan keeps Chinese output as default.
- [ ] The plan supports deterministic fallback and parallel agent mode.
- [ ] The plan writes actual document count from generated outputs.
- [ ] The plan blocks false `complete` status when source or card coverage is missing.
- [ ] The plan includes retry artifacts for failed file/topic batches.
