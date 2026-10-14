# Business-First Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `/understand-kb` output from graph/evidence-heavy audit pages into detailed business-first Markdown while preserving traceable graph coverage and document-count guarantees.

**Architecture:** Add a trace side channel and narrative planning layer, then migrate writer contracts, deterministic renderers, merge validation, reports, and prompts to use reader-facing Markdown plus machine-facing trace records. Coverage remains graph-backed; node ids, line ranges, evidence grades, and source anchors move from normal body documents into trace/report artifacts.

**Tech Stack:** TypeScript, Vitest, Node ESM, existing `packages/core/src/knowledge-base/*` modules, existing `skills/understand-kb/generate-knowledge-base.mjs` CLI.

---

## Scope Check

This plan implements Phase 1 from the approved spec. It changes only the knowledge-base generation layer: types, trace/narrative helpers, writer contracts, deterministic Markdown rendering, capability grouping, reports, CLI artifact writing, tests, and prompt docs. It does not change the graph scanner, dashboard, or UI.

## File Structure

- Create `packages/core/src/knowledge-base/trace.ts`
  - Owns `DocumentTrace` creation, trace validation, coverage map building, and low-confidence claim artifacts.
- Create `packages/core/src/knowledge-base/narrative.ts`
  - Owns business narrative plans derived from graph/profile/file/topic/capability inputs.
- Modify `packages/core/src/knowledge-base/types.ts`
  - Adds trace artifact types, narrative document types, quality report fields, and optional trace on writer documents.
- Modify `packages/core/src/knowledge-base/index.ts`
  - Exports new trace and narrative modules.
- Modify `packages/core/src/knowledge-base/quality.ts`
  - Adds business-first body quality checks and internal-term leakage checks.
- Modify `packages/core/src/knowledge-base/writer-contracts.ts`
  - Replaces body-required evidence sections with business-first sections and validates trace coverage.
- Modify `packages/core/src/knowledge-base/merge.ts`
  - Moves file/function/class node coverage validation from Markdown body strings to writer metadata plus trace.
- Modify `packages/core/src/knowledge-base/markdown.ts`
  - Rewrites deterministic file/topic/flow/capability templates and renders quality/coverage reports.
- Modify `packages/core/src/knowledge-base/business-facts.ts`
  - Prevents weak signals from becoming formal capabilities and produces human-readable capability names.
- Modify `packages/core/src/knowledge-base/generate.ts`
  - Builds trace artifacts for deterministic generation.
- Modify `skills/understand-kb/generate-knowledge-base.mjs`
  - Writes `.trace/*.json`, includes trace metadata in `knowledge-base-profile.json`, and updates console labels.
- Modify `agents/kb-file-writer.md`, `agents/kb-topic-writer.md`, and `skills/understand-kb/SKILL.md`
  - Aligns writer prompts and operational guidance with business-first documents plus trace.
- Modify tests under `packages/core/src/knowledge-base/__tests__/`
  - Updates old evidence-section assertions and adds coverage, trace, business-first quality, and weak-signal tests.

---

### Task 1: Add Trace Types And Trace Builder

**Files:**
- Create: `packages/core/src/knowledge-base/trace.ts`
- Modify: `packages/core/src/knowledge-base/types.ts`
- Modify: `packages/core/src/knowledge-base/index.ts`
- Test: `packages/core/src/knowledge-base/__tests__/trace.test.ts`

- [ ] **Step 1: Write failing trace tests**

Create `packages/core/src/knowledge-base/__tests__/trace.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "../../types.js";
import {
  buildCoverageMap,
  createDocumentTrace,
  validateDocumentTraces,
} from "../index.js";

function graph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    kind: "codebase",
    project: {
      name: "trace-fixture",
      languages: ["typescript"],
      frameworks: [],
      description: "Trace fixture",
      analyzedAt: "2026-07-01T00:00:00Z",
      gitCommitHash: "abc123",
    },
    nodes: [
      {
        id: "file:src/service/feed.ts",
        type: "file",
        name: "feed.ts",
        filePath: "src/service/feed.ts",
        summary: "Builds feed output",
        tags: ["feed"],
        complexity: "moderate",
      },
      {
        id: "function:src/service/feed.ts:BuildFeed",
        type: "function",
        name: "BuildFeed",
        filePath: "src/service/feed.ts",
        lineRange: [10, 40],
        summary: "Builds feed output",
        tags: ["feed"],
        complexity: "complex",
      },
    ],
    edges: [
      {
        source: "file:src/service/feed.ts",
        target: "function:src/service/feed.ts:BuildFeed",
        type: "contains",
        direction: "forward",
        weight: 1,
      },
    ],
    layers: [],
    tour: [],
  };
}

describe("knowledge-base trace artifacts", () => {
  it("creates a document trace with stable sorted coverage fields", () => {
    const trace = createDocumentTrace({
      documentPath: "文件文档/src-service-feed.ts.md",
      documentType: "file-implementation",
      coveredNodeIds: [
        "function:src/service/feed.ts:BuildFeed",
        "file:src/service/feed.ts",
        "function:src/service/feed.ts:BuildFeed",
      ],
      coveredFilePaths: ["src/service/feed.ts"],
      coveredEdgeIds: [
        "contains:file:src/service/feed.ts->function:src/service/feed.ts:BuildFeed",
      ],
      sourceAnchors: [
        {
          filePath: "src/service/feed.ts",
          lineRange: [10, 40],
          nodeId: "function:src/service/feed.ts:BuildFeed",
          role: "primary",
        },
      ],
      coverageLevel: "implementation-detail",
    });

    expect(trace.coveredNodeIds).toEqual([
      "file:src/service/feed.ts",
      "function:src/service/feed.ts:BuildFeed",
    ]);
    expect(trace.coveredFilePaths).toEqual(["src/service/feed.ts"]);
    expect(trace.lowConfidenceClaims).toEqual([]);
    expect(trace.movedInternalDetails).toEqual([]);
  });

  it("validates traces against graph node ids", () => {
    const traces = [
      createDocumentTrace({
        documentPath: "文件文档/src-service-feed.ts.md",
        documentType: "file-implementation",
        coveredNodeIds: ["file:src/service/feed.ts", "function:missing:Nope"],
        coveredFilePaths: ["src/service/feed.ts"],
        coveredEdgeIds: [],
        sourceAnchors: [],
        coverageLevel: "implementation-detail",
      }),
    ];

    const result = validateDocumentTraces(graph(), traces);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "trace covers unknown graph node: function:missing:Nope in 文件文档/src-service-feed.ts.md",
    );
  });

  it("builds node-to-document coverage maps", () => {
    const traces = [
      createDocumentTrace({
        documentPath: "文件文档/src-service-feed.ts.md",
        documentType: "file-implementation",
        coveredNodeIds: ["file:src/service/feed.ts", "function:src/service/feed.ts:BuildFeed"],
        coveredFilePaths: ["src/service/feed.ts"],
        coveredEdgeIds: [],
        sourceAnchors: [],
        coverageLevel: "implementation-detail",
      }),
    ];

    const map = buildCoverageMap(graph(), traces);

    expect(map.nodeToDocuments["file:src/service/feed.ts"]).toEqual([
      "文件文档/src-service-feed.ts.md",
    ]);
    expect(map.uncoveredNodeIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run trace test and verify it fails**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/trace.test.ts
```

Expected: FAIL because `trace.ts` exports do not exist.

- [ ] **Step 3: Add trace types**

In `packages/core/src/knowledge-base/types.ts`, add after `GeneratedDocument`:

```ts
export type KnowledgeBaseTraceDocumentType =
  | "business-flow"
  | "business-capability"
  | "file-implementation"
  | "implementation-topic"
  | "index"
  | "report";

export type KnowledgeBaseTraceCoverageLevel =
  | "business-flow"
  | "business-capability"
  | "implementation-detail"
  | "index-only"
  | "trace-only"
  | "needs-confirmation";

export interface DocumentTraceSourceAnchor {
  filePath: string;
  lineRange?: [number, number];
  nodeId?: string;
  role: "primary" | "supporting" | "example-only" | "structural";
}

export interface DocumentTrace {
  documentPath: string;
  documentType: KnowledgeBaseTraceDocumentType;
  coveredNodeIds: string[];
  coveredFilePaths: string[];
  coveredEdgeIds: string[];
  sourceAnchors: DocumentTraceSourceAnchor[];
  coverageLevel: KnowledgeBaseTraceCoverageLevel;
  lowConfidenceClaims: string[];
  movedInternalDetails: string[];
}

export interface TraceValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface CoverageMap {
  nodeToDocuments: Record<string, string[]>;
  documentToNodes: Record<string, string[]>;
  uncoveredNodeIds: string[];
}

export interface LowConfidenceClaim {
  claim: string;
  sourceKind?: BusinessEvidenceSourceKind;
  documentPath?: string;
  relatedNodeIds: string[];
}

export interface KnowledgeBaseTraceArtifacts {
  documentTraces: DocumentTrace[];
  coverageMap: CoverageMap;
  lowConfidenceClaims: LowConfidenceClaim[];
}
```

Also extend writer and generated structures:

```ts
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
  trace?: DocumentTrace;
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
  trace?: DocumentTrace;
}

export interface GeneratedKnowledgeBase {
  profile: ProjectProfile;
  businessCapabilityProfile: BusinessCapabilityProfile;
  plan: DocumentPlan;
  fileDocPlan: FileDocPlan;
  topicPlan: TopicPlan;
  documents: GeneratedDocument[];
  validation: CoverageValidationResult;
  coverageReport: CoverageReport;
  retryPlan: RetryPlan;
  traceArtifacts: KnowledgeBaseTraceArtifacts;
}
```

If `GeneratedKnowledgeBase` already exists lower in the file, add only the `traceArtifacts` field there.

- [ ] **Step 4: Implement trace helpers**

Create `packages/core/src/knowledge-base/trace.ts`:

```ts
import type { KnowledgeGraph } from "../types.js";
import type {
  CoverageMap,
  DocumentTrace,
  KnowledgeBaseTraceCoverageLevel,
  KnowledgeBaseTraceDocumentType,
  SourceEvidence,
  TraceValidationResult,
} from "./types.js";

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

export interface CreateDocumentTraceInput {
  documentPath: string;
  documentType: KnowledgeBaseTraceDocumentType;
  coveredNodeIds: string[];
  coveredFilePaths: string[];
  coveredEdgeIds: string[];
  sourceAnchors: DocumentTrace["sourceAnchors"];
  coverageLevel: KnowledgeBaseTraceCoverageLevel;
  lowConfidenceClaims?: string[];
  movedInternalDetails?: string[];
}

export function createDocumentTrace(input: CreateDocumentTraceInput): DocumentTrace {
  return {
    documentPath: input.documentPath,
    documentType: input.documentType,
    coveredNodeIds: sortedUnique(input.coveredNodeIds),
    coveredFilePaths: sortedUnique(input.coveredFilePaths),
    coveredEdgeIds: sortedUnique(input.coveredEdgeIds),
    sourceAnchors: [...input.sourceAnchors].sort((a, b) =>
      a.filePath.localeCompare(b.filePath) ||
      (a.nodeId ?? "").localeCompare(b.nodeId ?? "") ||
      (a.lineRange?.[0] ?? 0) - (b.lineRange?.[0] ?? 0)
    ),
    coverageLevel: input.coverageLevel,
    lowConfidenceClaims: sortedUnique(input.lowConfidenceClaims ?? []),
    movedInternalDetails: sortedUnique(input.movedInternalDetails ?? []),
  };
}

export function sourceAnchorsFromEvidence(
  evidence: readonly SourceEvidence[],
  role: DocumentTrace["sourceAnchors"][number]["role"] = "primary",
): DocumentTrace["sourceAnchors"] {
  return evidence.map((item) => ({
    filePath: item.filePath,
    lineRange: item.lineRange,
    nodeId: item.nodeId,
    role,
  }));
}

export function validateDocumentTraces(
  graph: KnowledgeGraph,
  traces: readonly DocumentTrace[],
): TraceValidationResult {
  const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenPaths = new Set<string>();

  for (const trace of traces) {
    if (seenPaths.has(trace.documentPath)) {
      errors.push(`duplicate trace documentPath: ${trace.documentPath}`);
    }
    seenPaths.add(trace.documentPath);

    if (trace.coveredNodeIds.length === 0 && trace.documentType !== "report") {
      warnings.push(`trace has no covered nodes: ${trace.documentPath}`);
    }

    for (const nodeId of trace.coveredNodeIds) {
      if (!graphNodeIds.has(nodeId)) {
        errors.push(`trace covers unknown graph node: ${nodeId} in ${trace.documentPath}`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function buildCoverageMap(graph: KnowledgeGraph, traces: readonly DocumentTrace[]): CoverageMap {
  const nodeToDocuments: Record<string, string[]> = {};
  const documentToNodes: Record<string, string[]> = {};

  for (const node of graph.nodes) nodeToDocuments[node.id] = [];

  for (const trace of traces) {
    documentToNodes[trace.documentPath] = [...trace.coveredNodeIds];
    for (const nodeId of trace.coveredNodeIds) {
      if (!nodeToDocuments[nodeId]) nodeToDocuments[nodeId] = [];
      nodeToDocuments[nodeId].push(trace.documentPath);
    }
  }

  for (const nodeId of Object.keys(nodeToDocuments)) {
    nodeToDocuments[nodeId] = sortedUnique(nodeToDocuments[nodeId]);
  }

  return {
    nodeToDocuments,
    documentToNodes,
    uncoveredNodeIds: graph.nodes
      .map((node) => node.id)
      .filter((nodeId) => (nodeToDocuments[nodeId] ?? []).length === 0)
      .sort(),
  };
}
```

- [ ] **Step 5: Export trace helpers**

Modify `packages/core/src/knowledge-base/index.ts`:

```ts
export * from "./trace.js";
```

- [ ] **Step 6: Run trace tests**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/trace.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit trace foundation**

```bash
git add packages/core/src/knowledge-base/types.ts packages/core/src/knowledge-base/trace.ts packages/core/src/knowledge-base/index.ts packages/core/src/knowledge-base/__tests__/trace.test.ts
git commit -m "feat: add knowledge base trace artifacts"
```

---

### Task 2: Add Narrative Planning Helpers

**Files:**
- Create: `packages/core/src/knowledge-base/narrative.ts`
- Modify: `packages/core/src/knowledge-base/index.ts`
- Test: `packages/core/src/knowledge-base/__tests__/narrative.test.ts`

- [ ] **Step 1: Write failing narrative tests**

Create `packages/core/src/knowledge-base/__tests__/narrative.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "../../types.js";
import {
  buildDocumentPlan,
  buildFileDocPlan,
  buildKnowledgeBaseProfile,
  buildNarrativePlans,
} from "../index.js";

function graph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    kind: "codebase",
    project: {
      name: "feed-service",
      languages: ["typescript"],
      frameworks: ["express"],
      description: "Builds personalized feed responses",
      analyzedAt: "2026-07-01T00:00:00Z",
      gitCommitHash: "abc123",
    },
    nodes: [
      {
        id: "file:src/api/routes.ts",
        type: "file",
        name: "routes.ts",
        filePath: "src/api/routes.ts",
        summary: "HTTP entry routes for feed requests",
        tags: ["api", "entry", "feed"],
        complexity: "moderate",
      },
      {
        id: "function:src/api/routes.ts:HandleFeedRequest",
        type: "function",
        name: "HandleFeedRequest",
        filePath: "src/api/routes.ts",
        lineRange: [1, 10],
        summary: "Receives feed requests and calls BuildFeed",
        tags: ["entry", "feed"],
        complexity: "moderate",
      },
      {
        id: "file:src/service/feed.ts",
        type: "file",
        name: "feed.ts",
        filePath: "src/service/feed.ts",
        summary: "Business logic for building personalized feed results",
        tags: ["service", "feed"],
        complexity: "complex",
      },
      {
        id: "function:src/service/feed.ts:BuildFeed",
        type: "function",
        name: "BuildFeed",
        filePath: "src/service/feed.ts",
        lineRange: [20, 80],
        summary: "Loads candidates, ranks them, and returns feed output",
        tags: ["business", "feed", "ranking"],
        complexity: "complex",
      },
    ],
    edges: [
      {
        source: "file:src/api/routes.ts",
        target: "function:src/api/routes.ts:HandleFeedRequest",
        type: "contains",
        direction: "forward",
        weight: 1,
      },
      {
        source: "file:src/service/feed.ts",
        target: "function:src/service/feed.ts:BuildFeed",
        type: "contains",
        direction: "forward",
        weight: 1,
      },
      {
        source: "function:src/api/routes.ts:HandleFeedRequest",
        target: "function:src/service/feed.ts:BuildFeed",
        type: "calls",
        direction: "forward",
        weight: 0.9,
      },
    ],
    layers: [],
    tour: [],
  };
}

describe("business narrative planning", () => {
  it("creates business-flow narrative plans from entry candidates", () => {
    const profile = buildKnowledgeBaseProfile(graph());
    const fileDocPlan = buildFileDocPlan(profile, {
      sourceFiles: {
        "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }",
        "src/service/feed.ts": "export function BuildFeed() { return []; }",
      },
    });
    const documentPlan = buildDocumentPlan(profile);

    const narratives = buildNarrativePlans(profile, fileDocPlan, documentPlan);
    const flow = narratives.find((item) => item.documentType === "business-flow");

    expect(flow?.title).toContain("HandleFeedRequest");
    expect(flow?.steps.length).toBeGreaterThanOrEqual(1);
    expect(flow?.steps[0].action).toContain("HandleFeedRequest");
    expect(flow?.trace.coveredNodeIds).toContain("function:src/api/routes.ts:HandleFeedRequest");
  });

  it("creates one file-implementation narrative per file task", () => {
    const profile = buildKnowledgeBaseProfile(graph());
    const fileDocPlan = buildFileDocPlan(profile, {
      sourceFiles: {
        "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }",
        "src/service/feed.ts": "export function BuildFeed() { return []; }",
      },
    });
    const documentPlan = buildDocumentPlan(profile);

    const narratives = buildNarrativePlans(profile, fileDocPlan, documentPlan);
    const fileNarratives = narratives.filter((item) => item.documentType === "file-implementation");

    expect(fileNarratives).toHaveLength(fileDocPlan.tasks.length);
    expect(fileNarratives.map((item) => item.documentPath)).toContain("文件文档/src-service-feed.ts.md");
  });
});
```

- [ ] **Step 2: Run narrative test and verify it fails**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/narrative.test.ts
```

Expected: FAIL because `buildNarrativePlans` does not exist.

- [ ] **Step 3: Add narrative types**

In `packages/core/src/knowledge-base/types.ts`, add after trace types:

```ts
export interface BusinessNarrativeStep {
  title: string;
  action: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  dependencies: string[];
  fallbackBehavior: string[];
  relatedNodeIds: string[];
}

export interface BusinessRuleNarrative {
  title: string;
  condition: string;
  decision: string;
  businessResult: string;
  fallback: string;
  relatedNodeIds: string[];
  confidence: BusinessEvidenceConfidence;
}

export interface BusinessNarrativePlan {
  documentPath: string;
  documentType: "business-flow" | "business-capability" | "file-implementation" | "implementation-topic";
  title: string;
  summary: string;
  audienceGoal: string;
  triggerConditions: string[];
  participants: string[];
  steps: BusinessNarrativeStep[];
  rules: BusinessRuleNarrative[];
  risks: string[];
  confirmationNeeded: string[];
  trace: DocumentTrace;
}
```

- [ ] **Step 4: Implement narrative builder**

Create `packages/core/src/knowledge-base/narrative.ts`:

```ts
import type { GraphEdge, GraphNode } from "../types.js";
import type {
  BusinessNarrativePlan,
  BusinessNarrativeStep,
  DocumentPlan,
  FileDocPlan,
  FileDocTask,
  PlannedDocument,
  ProjectProfile,
} from "./types.js";
import { createDocumentTrace } from "./trace.js";

function nodeOf(profile: ProjectProfile, nodeId: string): GraphNode | undefined {
  return profile.indexes.nodesById.get(nodeId);
}

function edgeId(edge: GraphEdge): string {
  return `${edge.type}:${edge.source}->${edge.target}`;
}

function label(node: GraphNode | undefined, fallback: string): string {
  return node ? `${node.name}` : fallback;
}

function fileTaskTraceNodeIds(task: FileDocTask): string[] {
  return [task.fileNodeId, ...task.functionNodeIds, ...task.classNodeIds];
}

function stepForNode(profile: ProjectProfile, nodeId: string, index: number): BusinessNarrativeStep {
  const node = nodeOf(profile, nodeId);
  const outgoing = profile.indexes.outgoingEdgesByNode.get(nodeId) ?? [];
  const dependencies = outgoing.map((edge) => label(nodeOf(profile, edge.target), edge.target)).sort();
  return {
    title: `${index + 1}. ${label(node, nodeId)}`,
    action: `${label(node, nodeId)} 执行当前流程中的实现动作。`,
    purpose: node?.summary || "根据入口和调用关系，这一步用于推进当前业务处理。",
    inputs: (profile.indexes.incomingEdgesByNode.get(nodeId) ?? [])
      .map((edge) => label(nodeOf(profile, edge.source), edge.source))
      .sort(),
    outputs: dependencies,
    dependencies,
    fallbackBehavior: ["当前源码或图谱未暴露明确兜底时，生成器会把具体兜底列入待确认项。"],
    relatedNodeIds: [nodeId],
  };
}

function plannedFlowDocuments(plan: DocumentPlan): PlannedDocument[] {
  return plan.documents.filter((doc) => doc.category === "flow");
}

function flowNarratives(profile: ProjectProfile, plan: DocumentPlan): BusinessNarrativePlan[] {
  return plannedFlowDocuments(plan).map((doc) => {
    const steps = doc.coveredNodeIds.map((nodeId, index) => stepForNode(profile, nodeId, index));
    const entryNode = nodeOf(profile, doc.coveredNodeIds[0] ?? "");
    return {
      documentPath: doc.path,
      documentType: "business-flow",
      title: doc.title,
      summary: entryNode?.summary || "该流程由入口节点展开，用于说明从触发到输出的处理链路。",
      audienceGoal: "帮助业务和工程读者理解流程触发、执行步骤、规则、依赖和改动风险。",
      triggerConditions: [entryNode ? `${entryNode.name} 被上游入口或运行时调用时触发。` : "入口触发条件需要结合调用方确认。"],
      participants: doc.coveredNodeIds.map((nodeId) => label(nodeOf(profile, nodeId), nodeId)).sort(),
      steps,
      rules: [],
      risks: ["修改流程中的输入组织、依赖调用或输出结构，会影响下游业务结果和回归范围。"],
      confirmationNeeded: ["线上配置、真实数据内容和业务 owner 口径需要在发布前确认。"],
      trace: createDocumentTrace({
        documentPath: doc.path,
        documentType: "business-flow",
        coveredNodeIds: doc.coveredNodeIds,
        coveredFilePaths: doc.coveredNodeIds.map((nodeId) => nodeOf(profile, nodeId)?.filePath).filter((path): path is string => Boolean(path)),
        coveredEdgeIds: profile.graph.edges
          .filter((edge) => doc.coveredNodeIds.includes(edge.source) && doc.coveredNodeIds.includes(edge.target))
          .map(edgeId),
        sourceAnchors: doc.coveredNodeIds
          .map((nodeId) => nodeOf(profile, nodeId))
          .filter((node): node is GraphNode => Boolean(node?.filePath))
          .map((node) => ({ filePath: node.filePath!, lineRange: node.lineRange, nodeId: node.id, role: "structural" })),
        coverageLevel: "business-flow",
      }),
    };
  });
}

function fileNarratives(profile: ProjectProfile, fileDocPlan: FileDocPlan): BusinessNarrativePlan[] {
  return fileDocPlan.tasks.map((task) => {
    const fileNode = nodeOf(profile, task.fileNodeId);
    const childNodeIds = [...task.functionNodeIds, ...task.classNodeIds];
    return {
      documentPath: task.documentPath,
      documentType: "file-implementation",
      title: `${task.filePath} 实现说明`,
      summary: fileNode?.summary || `${task.filePath} 负责当前系统中的一段实现逻辑。`,
      audienceGoal: "帮助读者理解该文件负责的实现步骤、内部协作、输入输出、兜底和修改风险。",
      triggerConditions: childNodeIds.length > 0
        ? childNodeIds.map((nodeId) => `${label(nodeOf(profile, nodeId), nodeId)} 被调用或被文件导出时参与处理。`)
        : ["该文件没有识别到函数或类节点，主要按文件职责和依赖关系说明。"],
      participants: childNodeIds.map((nodeId) => label(nodeOf(profile, nodeId), nodeId)).sort(),
      steps: childNodeIds.map((nodeId, index) => stepForNode(profile, nodeId, index)),
      rules: [],
      risks: ["修改文件内部协作顺序、输入输出结构或兜底行为，会影响依赖该文件的流程。"],
      confirmationNeeded: task.sourceSnapshot.exists ? [] : [`${task.filePath} 源码快照缺失，正文只能基于结构信息生成。`],
      trace: createDocumentTrace({
        documentPath: task.documentPath,
        documentType: "file-implementation",
        coveredNodeIds: fileTaskTraceNodeIds(task),
        coveredFilePaths: [task.filePath],
        coveredEdgeIds: [...task.incomingEdgeIds, ...task.outgoingEdgeIds],
        sourceAnchors: fileTaskTraceNodeIds(task)
          .map((nodeId) => nodeOf(profile, nodeId))
          .filter((node): node is GraphNode => Boolean(node))
          .map((node) => ({ filePath: node.filePath ?? task.filePath, lineRange: node.lineRange, nodeId: node.id, role: "structural" })),
        coverageLevel: "implementation-detail",
        lowConfidenceClaims: task.sourceSnapshot.exists ? [] : [`${task.filePath} 源码缺失`],
      }),
    };
  });
}

export function buildNarrativePlans(
  profile: ProjectProfile,
  fileDocPlan: FileDocPlan,
  documentPlan: DocumentPlan,
): BusinessNarrativePlan[] {
  return [...flowNarratives(profile, documentPlan), ...fileNarratives(profile, fileDocPlan)]
    .sort((a, b) => a.documentPath.localeCompare(b.documentPath) || a.title.localeCompare(b.title));
}
```

- [ ] **Step 5: Export narrative helpers**

Modify `packages/core/src/knowledge-base/index.ts`:

```ts
export * from "./narrative.js";
```

- [ ] **Step 6: Run narrative tests**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/narrative.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit narrative foundation**

```bash
git add packages/core/src/knowledge-base/types.ts packages/core/src/knowledge-base/narrative.ts packages/core/src/knowledge-base/index.ts packages/core/src/knowledge-base/__tests__/narrative.test.ts
git commit -m "feat: add business narrative planning"
```

---

### Task 3: Replace Evidence-Section Body Quality With Business-First Quality

**Files:**
- Modify: `packages/core/src/knowledge-base/quality.ts`
- Test: `packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts`

- [ ] **Step 1: Add failing body-quality tests**

Append to `packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts`:

```ts
import { BUSINESS_FLOW_REQUIRED_SECTIONS, FILE_IMPLEMENTATION_REQUIRED_SECTIONS } from "../index.js";

it("rejects business-first documents that leak graph and evidence internals", () => {
  const markdown = [
    "# HandleFeedRequest 业务流程",
    "",
    "## 这条流程解决什么问题",
    "图谱识别到节点 ID 和 coveredNodeIds，代码证据如下。",
    "",
    "## 什么时候会触发",
    "入口被调用时触发，并读取请求上下文。",
    "",
    "## 参与对象和关键数据",
    "请求、候选内容和响应对象。",
    "",
    "## 完整执行步骤",
    "1. 接收请求，校验上下文，产出候选加载参数。",
    "2. 调用服务，生成排序后的响应。",
    "",
    "## 关键规则和分支",
    "候选为空时返回空列表，候选存在时继续排序。",
    "",
    "## 数据读写与外部依赖",
    "读取候选服务，输出响应对象。",
    "",
    "## 兜底和异常处理",
    "候选缺失时返回空结果。",
    "",
    "## 改动风险",
    "修改排序会影响曝光顺序。",
    "",
    "## 待确认项",
    "需要确认线上排序配置。",
  ].join("\n");

  const errors = validateMarkdownQuality(markdown, {
    path: "业务流程/HandleFeedRequest.md",
    sections: BUSINESS_FLOW_REQUIRED_SECTIONS,
  });

  expect(errors).toContain("业务流程/HandleFeedRequest.md leaks internal trace terms: 图谱, 节点 ID, coveredNodeIds, 代码证据");
});

it("accepts detailed business flow documents without evidence sections", () => {
  const markdown = [
    "# HandleFeedRequest 业务流程",
    "",
    "## 这条流程解决什么问题",
    "这条流程把一次 Feed 请求转换成客户端可展示的响应，业务上影响用户看到的内容集合和展示顺序。",
    "",
    "## 什么时候会触发",
    "当上游 HTTP 入口收到 Feed 请求并完成基础上下文解析后，会进入这条流程。",
    "",
    "## 参与对象和关键数据",
    "核心对象包括请求上下文、用户标识、候选内容集合、排序配置和最终响应对象。",
    "",
    "## 完整执行步骤",
    "1. 接收请求上下文，确认用户和场景信息，为候选加载准备参数。",
    "2. 读取候选内容，将召回结果交给排序逻辑处理。",
    "3. 根据排序结果组装响应，让客户端获得稳定的 Feed items。",
    "",
    "## 关键规则和分支",
    "候选为空时返回空列表并保留响应元数据；候选存在时继续排序，排序字段缺失时需要确认默认值。",
    "",
    "## 数据读写与外部依赖",
    "流程读取候选数据和排序配置，输出 Feed 响应；当前未看到写状态行为。",
    "",
    "## 兜底和异常处理",
    "候选为空时不让入口失败，而是返回可解释的空结果；依赖失败时的错误传播需要结合运行配置确认。",
    "",
    "## 改动风险",
    "修改候选加载、排序字段或空结果兜底会影响首页曝光和客户端空态展示，需要覆盖正常候选、空候选和配置缺失场景。",
    "",
    "## 待确认项",
    "排序配置默认值和依赖失败时的状态码需要结合线上配置确认。",
  ].join("\n");

  const errors = validateMarkdownQuality(markdown, {
    path: "业务流程/HandleFeedRequest.md",
    sections: BUSINESS_FLOW_REQUIRED_SECTIONS,
  });

  expect(errors).toEqual([]);
});

it("rejects file implementation documents without structured implementation detail", () => {
  const markdown = [
    "# src/service/feed.ts 实现说明",
    "",
    ...FILE_IMPLEMENTATION_REQUIRED_SECTIONS.flatMap((section) => [
      section,
      "承担核心逻辑。",
      "",
    ]),
  ].join("\n");

  const errors = validateMarkdownQuality(markdown, {
    path: "文件文档/src-service-feed.ts.md",
    sections: FILE_IMPLEMENTATION_REQUIRED_SECTIONS,
  });

  expect(errors).toContain("文件文档/src-service-feed.ts.md has too much generic filler text");
  expect(errors).toContain("文件文档/src-service-feed.ts.md section has too little detail: ## 文件在系统里的作用");
});
```

- [ ] **Step 2: Run writer-contract tests and verify failure**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts
```

Expected: FAIL because new section constants and leakage checks do not exist.

- [ ] **Step 3: Add business-first section constants**

In `packages/core/src/knowledge-base/writer-contracts.ts`, add near existing required section constants:

```ts
export const BUSINESS_FLOW_REQUIRED_SECTIONS = [
  "## 这条流程解决什么问题",
  "## 什么时候会触发",
  "## 参与对象和关键数据",
  "## 完整执行步骤",
  "## 关键规则和分支",
  "## 数据读写与外部依赖",
  "## 兜底和异常处理",
  "## 改动风险",
  "## 待确认项",
] as const;

export const BUSINESS_CAPABILITY_REQUIRED_SECTIONS = [
  "## 能力说明",
  "## 适用场景",
  "## 触发条件",
  "## 规则明细",
  "## 命中后的处理",
  "## 未命中或异常时的处理",
  "## 依赖的数据和配置",
  "## 和其他能力的关系",
  "## 改动风险",
  "## 待确认项",
] as const;

export const FILE_IMPLEMENTATION_REQUIRED_SECTIONS = [
  "## 文件在系统里的作用",
  "## 它负责的业务步骤",
  "## 主要输入和输出",
  "## 内部协作方式",
  "## 关键函数或类怎么分工",
  "## 规则、兜底和副作用",
  "## 修改这个文件的风险",
  "## 覆盖状态",
] as const;

export const IMPLEMENTATION_TOPIC_REQUIRED_SECTIONS = [
  "## 为什么它关键",
  "## 它处在流程的哪一步",
  "## 输入是什么",
  "## 执行过程",
  "## 关键判断和算法",
  "## 输出和副作用",
  "## 失败、兜底和边界情况",
  "## 上下游影响",
  "## 修改风险",
] as const;
```

- [ ] **Step 4: Add body leakage and structure checks**

In `packages/core/src/knowledge-base/quality.ts`, add constants below `GENERIC_FILLER`:

```ts
const INTERNAL_TRACE_TERMS = [
  "图谱",
  "节点 ID",
  "coveredNodeIds",
  "sourceEvidence",
  "evidenceRole",
  "证据等级",
  "代码证据",
  "测试证据",
  "未在图谱中识别",
] as const;

const STRUCTURED_STEP_SECTIONS = new Set([
  "## 完整执行步骤",
  "## 执行过程",
  "## 规则明细",
  "## 关键函数或类怎么分工",
]);
```

Add helpers before `validateMarkdownQuality`:

```ts
function leakedInternalTerms(markdown: string): string[] {
  return INTERNAL_TRACE_TERMS.filter((term) => markdown.includes(term));
}

function hasStructuredDetail(body: string): boolean {
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const numbered = lines.filter((line) => /^\d+[.、]/.test(line)).length;
  const bullets = lines.filter((line) => /^[-*]\s+/.test(line)).length;
  return numbered >= 2 || bullets >= 2 || lines.length >= 3;
}
```

Inside `validateMarkdownQuality`, after generic filler check:

```ts
  const leakedTerms = leakedInternalTerms(markdown);
  if (leakedTerms.length > 0) {
    errors.push(`${options.path} leaks internal trace terms: ${leakedTerms.join(", ")}`);
  }
```

Inside the section loop:

```ts
    const body = sectionBody(markdown, section);
    if (!hasSubstantiveSectionBody(body)) {
      errors.push(`${options.path} section has too little detail: ${section}`);
    }
    if (STRUCTURED_STEP_SECTIONS.has(section) && !hasStructuredDetail(body)) {
      errors.push(`${options.path} section lacks structured steps or rules: ${section}`);
    }
```

Remove the old duplicate `hasSubstantiveSectionBody(sectionBody(...))` call from that same loop so each section reports once.

- [ ] **Step 5: Update test imports**

At the top of `packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts`, extend imports:

```ts
  BUSINESS_FLOW_REQUIRED_SECTIONS,
  FILE_IMPLEMENTATION_REQUIRED_SECTIONS,
  validateMarkdownQuality,
```

If `validateMarkdownQuality` is already imported elsewhere in the file, keep only one import entry.

- [ ] **Step 6: Run writer-contract tests**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts
```

Expected: PASS after updating older fixtures in this test file in Task 4. If older fixtures fail in this task because they intentionally contain `## 代码证据`, only run the three new tests by name:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts -t "business-first|file implementation"
```

Expected: PASS.

- [ ] **Step 7: Commit body quality checks**

```bash
git add packages/core/src/knowledge-base/quality.ts packages/core/src/knowledge-base/writer-contracts.ts packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts
git commit -m "feat: validate business-first knowledge docs"
```

---

### Task 4: Update Writer Contracts To Require Trace Instead Of Evidence Sections

**Files:**
- Modify: `packages/core/src/knowledge-base/writer-contracts.ts`
- Modify: `packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts`

- [ ] **Step 1: Replace writer-contract fixtures with business-first Markdown and trace**

In `packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts`, replace `completeFileMarkdown()` with:

```ts
function completeFileMarkdown(): string {
  return [
    "# src/service/feed.ts 实现说明",
    "",
    "## 文件在系统里的作用",
    "这个文件负责把 Feed 请求中的候选内容整理成最终响应，连接候选加载、排序和响应组装。业务上它影响首页信息流展示内容和顺序。",
    "",
    "## 它负责的业务步骤",
    "1. 接收请求上下文和候选加载结果，为排序准备统一的数据结构。",
    "2. 调用排序逻辑处理候选内容，让结果能按业务策略展示。",
    "3. 使用响应构建对象输出 items 和 metadata，保证客户端能稳定消费。",
    "",
    "## 主要输入和输出",
    "- 输入: 请求上下文、用户标识、候选内容集合和排序配置。",
    "- 输出: 已排序的 Feed 响应，以及用于排查的响应元数据。",
    "",
    "## 内部协作方式",
    "`BuildFeed` 负责主流程编排，`rankCandidates` 负责排序决策，`FeedBuilder` 保存组装状态并生成响应对象。",
    "",
    "## 关键函数或类怎么分工",
    "- `BuildFeed`: 读取候选内容，调用排序逻辑，并把结果交给响应构建对象。",
    "- `rankCandidates`: 按候选分数和请求上下文重排列表，是影响曝光顺序的关键函数。",
    "- `FeedBuilder`: 保存组装状态，并输出包含 items 与 metadata 的响应对象。",
    "",
    "## 规则、兜底和副作用",
    "候选为空时返回空列表但保留请求元数据，避免入口直接失败。排序字段缺失时的默认值需要结合配置确认。",
    "",
    "## 修改这个文件的风险",
    "修改排序、候选空态或响应结构会影响首页曝光和客户端空态展示，需要回归正常候选、空候选和同分候选。",
    "",
    "## 覆盖状态",
    "本文件的函数和类覆盖关系保存在 trace 中，正文只保留业务和实现说明。",
  ].join("\n");
}
```

Replace `completeTopicMarkdown()` with:

```ts
function completeTopicMarkdown(): string {
  return [
    "# BuildFeed 关键实现专题",
    "",
    "## 为什么它关键",
    "BuildFeed 连接入口请求、候选读取、排序和响应输出，是 Feed 结果生成链路的核心编排点。",
    "",
    "## 它处在流程的哪一步",
    "入口完成请求解析后进入 BuildFeed，BuildFeed 负责把请求上下文转换成可排序、可返回的候选结果。",
    "",
    "## 输入是什么",
    "主要输入包括请求上下文、用户标识、候选数据依赖和排序所需配置。",
    "",
    "## 执行过程",
    "1. 接收入口传入的上下文，准备候选加载参数。",
    "2. 调用候选加载能力取得待展示内容。",
    "3. 将候选交给排序逻辑处理展示顺序。",
    "4. 组装响应对象并返回给入口层。",
    "",
    "## 关键判断和算法",
    "候选为空时走空结果兜底；候选存在时按排序逻辑生成稳定顺序。排序字段缺失时的默认值需要结合配置确认。",
    "",
    "## 输出和副作用",
    "输出 Feed 响应和排序元数据；当前说明不确认持久化写入副作用。",
    "",
    "## 失败、兜底和边界情况",
    "候选为空时仍返回可解释的空响应；候选加载失败时的错误传播需要运行时契约确认。",
    "",
    "## 上下游影响",
    "上游入口依赖它返回 Feed 结果，下游候选加载和排序逻辑变化会直接影响用户看到的内容顺序。",
    "",
    "## 修改风险",
    "修改候选读取、排序调用或空态兜底会影响曝光结果和客户端展示，需要回归正常候选、空候选和依赖失败场景。",
  ].join("\n");
}
```

In `completeFileOutput()`, add `trace` to the document:

```ts
        trace: {
          documentPath: "文件文档/src-service-feed.ts.md",
          documentType: "file-implementation",
          coveredNodeIds: [
            "file:src/service/feed.ts",
            "function:src/service/feed.ts:BuildFeed",
            "function:src/service/feed.ts:rankCandidates",
            "class:src/service/feed.ts:FeedBuilder",
          ],
          coveredFilePaths: ["src/service/feed.ts"],
          coveredEdgeIds: [
            "calls:function:src/service/feed.ts:BuildFeed->function:src/data/store.ts:LoadCandidates",
          ],
          sourceAnchors: [
            {
              filePath: "src/service/feed.ts",
              lineRange: [30, 90],
              nodeId: "function:src/service/feed.ts:BuildFeed",
              role: "primary",
            },
          ],
          coverageLevel: "implementation-detail",
          lowConfidenceClaims: [],
          movedInternalDetails: [],
        },
```

In `completeTopicOutput()`, add `trace` to the topic:

```ts
        trace: {
          documentPath: "关键函数专题/src-service-feed.ts-BuildFeed.md",
          documentType: "implementation-topic",
          coveredNodeIds: ["function:src/service/feed.ts:BuildFeed"],
          coveredFilePaths: ["src/service/feed.ts"],
          coveredEdgeIds: [],
          sourceAnchors: [
            {
              filePath: "src/service/feed.ts",
              lineRange: [30, 90],
              nodeId: "function:src/service/feed.ts:BuildFeed",
              role: "primary",
            },
          ],
          coverageLevel: "implementation-detail",
          lowConfidenceClaims: [],
          movedInternalDetails: [],
        },
```

- [ ] **Step 2: Update section assertions**

Replace `FILE_WRITER_REQUIRED_SECTIONS` expectations in the same test file with `FILE_IMPLEMENTATION_REQUIRED_SECTIONS`.

Replace `TOPIC_WRITER_REQUIRED_SECTIONS` expectations for topic Markdown body with `IMPLEMENTATION_TOPIC_REQUIRED_SECTIONS`.

Keep tests that validate old constants only if they are explicitly testing backward compatibility. Rename them to say "legacy" if retained.

- [ ] **Step 3: Run writer-contract tests and verify failure**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts
```

Expected: FAIL because parser still requires old sections and does not validate trace.

- [ ] **Step 4: Validate trace object shape in writer contracts**

In `packages/core/src/knowledge-base/writer-contracts.ts`, add:

```ts
function validateTrace(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  requireString(value, "documentPath", path, errors);
  requireString(value, "documentType", path, errors);
  requireStringArray(value, "coveredNodeIds", path, errors);
  requireStringArray(value, "coveredFilePaths", path, errors);
  requireStringArray(value, "coveredEdgeIds", path, errors);
  requireString(value, "coverageLevel", path, errors);
  requireStringArray(value, "lowConfidenceClaims", path, errors);
  requireStringArray(value, "movedInternalDetails", path, errors);
  const anchors = requireArray(value, "sourceAnchors", path, errors);
  anchors?.forEach((anchor, index) => {
    validateSourceEvidence(anchor, `${path}.sourceAnchors[${index}]`, errors);
    if (isRecord(anchor) && typeof anchor.role !== "string") {
      errors.push(`${path}.sourceAnchors[${index}].role must be a string`);
    }
  });
}
```

In `validateFileWriterDocument`, after `requireString(value, "markdown", path, errors);`, replace old section validation call:

```ts
  requireSections(value.markdown, FILE_IMPLEMENTATION_REQUIRED_SECTIONS, `${path}.markdown`, errors);
```

Add trace validation:

```ts
  validateTrace(value.trace, `${path}.trace`, errors);
```

Update `validateMarkdownQuality` options:

```ts
        sections: FILE_IMPLEMENTATION_REQUIRED_SECTIONS,
```

Remove `sourceEvidenceRefs`, `coveredFunctionNodeIds`, and `coveredClassNodeIds` from the `validateMarkdownQuality` call for file documents.

In `validateTopicWriterDocument`, replace old section validation:

```ts
  requireSections(value.markdown, IMPLEMENTATION_TOPIC_REQUIRED_SECTIONS, `${path}.markdown`, errors);
```

Add:

```ts
  validateTrace(value.trace, `${path}.trace`, errors);
```

Update its `validateMarkdownQuality` call to use `IMPLEMENTATION_TOPIC_REQUIRED_SECTIONS` and no source evidence body check.

- [ ] **Step 5: Keep machine coverage fields required**

In `validateFileWriterDocument`, keep:

```ts
  requireStringArray(value, "coveredFunctionNodeIds", path, errors);
  requireStringArray(value, "coveredClassNodeIds", path, errors);
  requireStringArray(value, "representedEdgeIds", path, errors);
  const sourceEvidence = requireArray(value, "sourceEvidence", path, errors);
```

In `validateTopicWriterDocument`, keep:

```ts
  requireStringArray(value, "coveredNodeIds", path, errors);
  const evidence = requireArray(value, "evidence", path, errors);
```

These fields remain compatibility and merge inputs. The Markdown body no longer needs to print them.

- [ ] **Step 6: Run writer-contract tests**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit writer contract migration**

```bash
git add packages/core/src/knowledge-base/writer-contracts.ts packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts
git commit -m "feat: require trace-backed writer outputs"
```

---

### Task 5: Move Merge Coverage Validation From Markdown Body To Trace

**Files:**
- Modify: `packages/core/src/knowledge-base/merge.ts`
- Test: `packages/core/src/knowledge-base/__tests__/merge.test.ts`

- [ ] **Step 1: Add failing merge test for trace-backed coverage**

Append to `packages/core/src/knowledge-base/__tests__/merge.test.ts`:

```ts
it("accepts file documents when function and class coverage is in trace instead of markdown body", () => {
  const profile = buildKnowledgeBaseProfile(sampleGraph());
  const fileDocPlan = buildFileDocPlan(profile, {
    sourceFiles: {
      "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }",
      "src/service/feed.ts": "export function BuildFeed() { return []; }\nfunction rankCandidates(items) { return items; }",
      "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }",
    },
  });
  const outputs = fileDocPlan.batches.map((batch) => ({
    batchIndex: batch.batchIndex,
    documents: batch.tasks.map((task) => ({
      fileNodeId: task.fileNodeId,
      filePath: task.filePath,
      documentPath: task.documentPath,
      title: `${task.filePath} 实现说明`,
      coveredFunctionNodeIds: [...task.functionNodeIds],
      coveredClassNodeIds: [...task.classNodeIds],
      representedEdgeIds: [...task.incomingEdgeIds, ...task.outgoingEdgeIds],
      sourceEvidence: [{ filePath: task.filePath, nodeId: task.fileNodeId }],
      importantNodeIds: [],
      markdown: [
        `# ${task.filePath} 实现说明`,
        "",
        "## 文件在系统里的作用",
        "这个文件负责系统中的一段实现逻辑，正文不展示节点编号，但会解释输入、输出、协作和风险。",
        "",
        "## 它负责的业务步骤",
        "1. 接收上游数据并准备处理上下文。",
        "2. 调用内部函数或类完成输出构建。",
        "",
        "## 主要输入和输出",
        "输入来自上游调用方，输出提供给下游流程继续处理。",
        "",
        "## 内部协作方式",
        "文件内部函数和类按职责协作，覆盖关系由 trace 保存。",
        "",
        "## 关键函数或类怎么分工",
        "1. 主函数负责流程编排。",
        "2. 辅助函数或类负责局部转换和状态保存。",
        "",
        "## 规则、兜底和副作用",
        "源码可读取时以源码行为为准，缺失配置值进入待确认。",
        "",
        "## 修改这个文件的风险",
        "修改输入输出或协作顺序会影响调用方和下游结果。",
        "",
        "## 覆盖状态",
        "覆盖关系保存在 trace 中。",
      ].join("\n"),
      trace: {
        documentPath: task.documentPath,
        documentType: "file-implementation" as const,
        coveredNodeIds: [task.fileNodeId, ...task.functionNodeIds, ...task.classNodeIds],
        coveredFilePaths: [task.filePath],
        coveredEdgeIds: [...task.incomingEdgeIds, ...task.outgoingEdgeIds],
        sourceAnchors: [{ filePath: task.filePath, nodeId: task.fileNodeId, role: "structural" as const }],
        coverageLevel: "implementation-detail" as const,
        lowConfidenceClaims: [],
        movedInternalDetails: [],
      },
    })),
    warnings: [],
  }));

  const result = mergeKnowledgeBaseWriterOutputs({ profile, fileDocPlan, fileWriterOutputs: outputs });

  expect(result.validation.ok).toBe(true);
  expect(result.validation.errors).toEqual([]);
  expect(result.fileDocuments.length).toBe(fileDocPlan.tasks.length);
});
```

- [ ] **Step 2: Run merge test and verify failure**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/merge.test.ts -t "trace instead of markdown body"
```

Expected: FAIL because `validateRequiredNodeCoverage` still searches Markdown for node ids and card sections.

- [ ] **Step 3: Update file coverage validation**

In `packages/core/src/knowledge-base/merge.ts`, replace `validateRequiredNodeCoverage` with:

```ts
function validateRequiredNodeCoverage(
  task: FileDocTask,
  document: FileWriterDocument,
  errors: string[],
  retryBatchIndexes: Set<number>,
): void {
  const traceNodeIds = new Set(document.trace?.coveredNodeIds ?? []);

  if (!traceNodeIds.has(task.fileNodeId)) {
    pushError(
      errors,
      retryBatchIndexes,
      [task.batchIndex],
      `file document trace missing file node: ${task.fileNodeId} in ${document.documentPath}`,
    );
  }

  for (const functionNodeId of task.functionNodeIds) {
    if (!document.coveredFunctionNodeIds.includes(functionNodeId)) {
      pushError(
        errors,
        retryBatchIndexes,
        [task.batchIndex],
        `function missing coveredFunctionNodeIds entry: ${functionNodeId} in file writer document ${document.documentPath}`,
      );
    }
    if (!traceNodeIds.has(functionNodeId)) {
      pushError(
        errors,
        retryBatchIndexes,
        [task.batchIndex],
        `function missing trace coverage: ${functionNodeId} in file writer document ${document.documentPath}`,
      );
    }
  }

  for (const classNodeId of task.classNodeIds) {
    if (!document.coveredClassNodeIds.includes(classNodeId)) {
      pushError(
        errors,
        retryBatchIndexes,
        [task.batchIndex],
        `class missing coveredClassNodeIds entry: ${classNodeId} in file writer document ${document.documentPath}`,
      );
    }
    if (!traceNodeIds.has(classNodeId)) {
      pushError(
        errors,
        retryBatchIndexes,
        [task.batchIndex],
        `class missing trace coverage: ${classNodeId} in file writer document ${document.documentPath}`,
      );
    }
  }
}
```

Delete `markdownSection` and `validateMarkdownSection` if no longer used.

- [ ] **Step 4: Include trace in generated documents**

In `fileDocumentFromWriter`, keep `GeneratedDocument` unchanged for now but preserve existing coverage:

```ts
function fileDocumentFromWriter(task: FileDocTask, document: FileWriterDocument): GeneratedDocument {
  return {
    path: document.documentPath,
    title: document.title,
    category: "file",
    coveredNodeIds: document.trace?.coveredNodeIds?.length ? [...document.trace.coveredNodeIds] : nodeIdsForFileTask(task),
    representedEdgeIds: [...document.representedEdgeIds],
    content: document.markdown,
  };
}
```

In `topicDocumentFromWriter`, use trace coverage when present:

```ts
function topicDocumentFromWriter(document: TopicWriterDocument): GeneratedDocument {
  return {
    path: document.documentPath,
    title: document.title,
    category: "topic",
    coveredNodeIds: document.trace?.coveredNodeIds?.length ? [...document.trace.coveredNodeIds] : [...document.coveredNodeIds],
    representedEdgeIds: document.trace?.coveredEdgeIds ?? [],
    content: document.markdown,
  };
}
```

- [ ] **Step 5: Validate topic trace coverage**

In `validateTopicWriterOutputs`, after covered node id loop, add:

```ts
    const traceNodeIds = new Set(document.trace?.coveredNodeIds ?? []);
    if (!traceNodeIds.has(document.topicNodeId)) {
      pushError(
        errors,
        retryTopicBatchIndexes,
        [candidate.batchIndex],
        `topic trace missing topic node: ${document.topicNodeId} in ${document.documentPath}`,
      );
    }
```

- [ ] **Step 6: Run merge tests**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/merge.test.ts
```

Expected: PASS after updating existing fixtures to include `trace` and no longer expect Markdown node id failures.

- [ ] **Step 7: Commit merge validation migration**

```bash
git add packages/core/src/knowledge-base/merge.ts packages/core/src/knowledge-base/__tests__/merge.test.ts
git commit -m "feat: validate knowledge coverage from trace"
```

---

### Task 6: Rewrite Deterministic File And Topic Renderers

**Files:**
- Modify: `packages/core/src/knowledge-base/markdown.ts`
- Modify: `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`

- [ ] **Step 1: Update deterministic renderer tests**

In `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`, update the file document test named `"generates complete file documents and cards for every graph file/function/class"`:

```ts
  it("generates business-first file documents with trace-backed function and class coverage", () => {
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
      expect(doc?.content).toContain(`# ${node.filePath} 实现说明`);
      expect(doc?.content).toContain("## 文件在系统里的作用");
      expect(doc?.content).toContain("## 它负责的业务步骤");
      expect(doc?.content).toContain("## 覆盖状态");
      expect(doc?.content).not.toContain("## 代码证据");
      expect(doc?.content).not.toContain("节点 ID");
    }

    for (const node of graph.nodes.filter((item) => item.type === "function" || item.type === "class")) {
      const parentDoc = kb.documents.find((item) => item.path.startsWith("文件文档/") && item.coveredNodeIds.includes(node.id));
      expect(parentDoc).toBeDefined();
      expect(parentDoc?.content).toContain(node.name);
    }
  });
```

Update topic test assertions:

```ts
    expect(topicDoc?.content).toContain("## 为什么它关键");
    expect(topicDoc?.content).toContain("## 执行过程");
    expect(topicDoc?.content).not.toContain("## 代码证据");
```

- [ ] **Step 2: Run updated knowledge-base tests and verify failure**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts -t "business-first file|topic"
```

Expected: FAIL because deterministic renderers still produce old headings.

- [ ] **Step 3: Rewrite function and class prose helpers**

In `packages/core/src/knowledge-base/markdown.ts`, replace `renderFunctionCard` with:

```ts
function renderFunctionRole(profile: ProjectProfile, task: FileDocTask, nodeId: string): string {
  const node = nodeOf(profile, nodeId);
  const outgoing = profile.indexes.outgoingEdgesByNode.get(nodeId) ?? [];
  const incoming = profile.indexes.incomingEdgesByNode.get(nodeId) ?? [];
  const downstream = outgoing.filter((edge) => edge.type === "calls").map((edge) => nodeLabel(profile, edge.target));
  const upstream = incoming.filter((edge) => edge.type === "calls").map((edge) => nodeLabel(profile, edge.source));
  return [
    `- ${node?.name ?? nodeId}: ${nodeSummary(node, "这个函数参与当前文件的实现流程。")}`,
    upstream.length > 0 ? `  上游主要来自 ${upstream.join("、")}。` : "  当前没有明确上游调用记录，通常由文件内部或导出入口触发。",
    downstream.length > 0 ? `  下游会继续交给 ${downstream.join("、")}。` : "  当前没有明确下游调用记录，需要结合返回值和副作用理解影响。",
  ].join("\n");
}

function renderClassRole(profile: ProjectProfile, task: FileDocTask, nodeId: string): string {
  const node = nodeOf(profile, nodeId);
  const related = [
    ...(profile.indexes.incomingEdgesByNode.get(nodeId) ?? []),
    ...(profile.indexes.outgoingEdgesByNode.get(nodeId) ?? []),
  ].map((edge) => edge.source === nodeId ? nodeLabel(profile, edge.target) : nodeLabel(profile, edge.source));
  return [
    `- ${node?.name ?? nodeId}: ${nodeSummary(node, "这个类封装当前文件中的状态或协作能力。")}`,
    related.length > 0 ? `  主要协作对象包括 ${[...new Set(related)].join("、")}。` : "  当前没有明确协作对象，需要结合构造和使用位置确认。",
  ].join("\n");
}
```

- [ ] **Step 4: Rewrite deterministic file document renderer**

In `renderDeterministicFileWriterDocument`, replace old markdown assembly with:

```ts
  const functionRoles = task.functionNodeIds.map((nodeId) => renderFunctionRole(profile, task, nodeId));
  const classRoles = task.classNodeIds.map((nodeId) => renderClassRole(profile, task, nodeId));
  const trace = createDocumentTrace({
    documentPath: task.documentPath,
    documentType: "file-implementation",
    coveredNodeIds: [task.fileNodeId, ...task.functionNodeIds, ...task.classNodeIds],
    coveredFilePaths: [task.filePath],
    coveredEdgeIds: representedEdgeIds,
    sourceAnchors: [
      { filePath: task.filePath, nodeId: task.fileNodeId, role: "structural" },
      ...task.functionNodeIds.map((nodeId) => {
        const node = nodeOf(profile, nodeId);
        return { filePath: node?.filePath ?? task.filePath, lineRange: node?.lineRange, nodeId, role: "structural" as const };
      }),
      ...task.classNodeIds.map((nodeId) => {
        const node = nodeOf(profile, nodeId);
        return { filePath: node?.filePath ?? task.filePath, lineRange: node?.lineRange, nodeId, role: "structural" as const };
      }),
    ],
    coverageLevel: "implementation-detail",
    lowConfidenceClaims: task.sourceSnapshot.exists ? [] : [`${task.filePath} 源码缺失`],
  });
```

Use this `markdown` content:

```ts
    markdown: [
      `# ${task.filePath} 实现说明`,
      "",
      "## 文件在系统里的作用",
      nodeSummary(nodeOf(profile, task.fileNodeId), "这个文件负责当前系统中的一段实现逻辑，具体业务边界需要结合调用方确认。"),
      "",
      "## 它负责的业务步骤",
      task.functionNodeIds.length > 0
        ? task.functionNodeIds.map((nodeId, index) => `${index + 1}. ${nodeOf(profile, nodeId)?.name ?? nodeId} 负责推进文件内的一段处理：${nodeSummary(nodeOf(profile, nodeId), "该步骤的详细业务语义需要结合源码确认。")}`).join("\n")
        : "1. 当前没有识别到函数节点，本页主要说明文件职责、依赖关系和覆盖状态。\n2. 如果该文件通过动态导出或配置生效，需要在后续扫描中补充更细粒度结构。",
      "",
      "## 主要输入和输出",
      `- 输入: 上游调用、导入或包含关系提供上下文，共 ${task.incomingEdgeIds.length} 条上游关系。`,
      `- 输出: 文件中的导出、函数或类影响下游对象，共 ${task.outgoingEdgeIds.length} 条下游关系。`,
      "- 运行时参数、真实配置值和数据内容需要结合环境确认。",
      "",
      "## 内部协作方式",
      functionRoles.length > 0 || classRoles.length > 0
        ? [...functionRoles, ...classRoles].join("\n")
        : "当前没有函数或类节点，内部协作需要通过源码导出、配置引用或运行时加载方式继续确认。",
      "",
      "## 关键函数或类怎么分工",
      [
        ...task.functionNodeIds.map((nodeId) => `- ${nodeOf(profile, nodeId)?.name ?? nodeId}: 参与本文件实现流程，覆盖关系记录在 trace 中。`),
        ...task.classNodeIds.map((nodeId) => `- ${nodeOf(profile, nodeId)?.name ?? nodeId}: 封装本文件中的状态、结构或协作能力，覆盖关系记录在 trace 中。`),
      ].join("\n") || "- 当前没有识别到函数或类节点。",
      "",
      "## 规则、兜底和副作用",
      task.sourceSnapshot.exists
        ? "源码快照可读取时，规则和兜底以源码行为为准；如果涉及线上配置、实验或数据库内容，需要在待确认项中继续核对。"
        : "源码快照缺失，本页只能根据结构信息说明职责，具体规则、兜底和副作用需要恢复源码后确认。",
      "",
      "## 修改这个文件的风险",
      "修改文件职责、内部协作顺序、输入输出结构或兜底行为，可能影响上游流程、下游依赖和生成结果，需要结合相关测试与调用方一起回归。",
      "",
      "## 覆盖状态",
      "本文件的文件、函数、类和关系覆盖保存在 trace 中；正文保留业务和实现说明，不展示节点编号和源码行号表格。",
    ].join("\n"),
    trace,
```

Keep the existing returned machine fields.

- [ ] **Step 5: Rewrite deterministic topic renderer sections**

In `renderDeterministicTopicWriterDocument`, build `trace` with `createDocumentTrace`:

```ts
  const trace = createDocumentTrace({
    documentPath: topic.documentPath,
    documentType: "implementation-topic",
    coveredNodeIds: topic.coveredNodeIds,
    coveredFilePaths: [...new Set(evidence.map((item) => item.filePath))],
    coveredEdgeIds: [
      ...(profile.indexes.incomingEdgesByNode.get(topic.topicNodeId) ?? []),
      ...(profile.indexes.outgoingEdgesByNode.get(topic.topicNodeId) ?? []),
    ].map(edgeId),
    sourceAnchors: evidence.map((item) => ({
      filePath: item.filePath,
      lineRange: item.lineRange,
      nodeId: item.nodeId,
      role: "structural" as const,
    })),
    coverageLevel: "implementation-detail",
  });
```

Replace the section map with `IMPLEMENTATION_TOPIC_REQUIRED_SECTIONS` and content matching the new headings:

```ts
    "## 为什么它关键": `${node?.name ?? topic.topicNodeId} 影响当前流程中的关键实现路径。${nodeSummary(node, "它被选为专题是因为结构复杂、连接重要或处在入口链路上。")}`,
    "## 它处在流程的哪一步": `它位于 ${sourceFile?.filePath ?? node?.filePath ?? topic.sourceFileNodeId}，通常在上游完成基础准备后执行，并把结果交给下游依赖继续处理。`,
    "## 输入是什么": incoming.length > 0 ? `主要输入来自 ${incoming.join("；")}。` : "当前没有明确上游输入记录，需要结合调用方确认。",
    "## 执行过程": [
      `1. 接收上游传入的上下文或数据，进入 ${node?.name ?? topic.topicNodeId}。`,
      outgoing.length > 0 ? `2. 根据当前实现职责调用或影响 ${outgoing.join("；")}。` : "2. 在本地完成处理并返回结果，当前没有明确下游调用记录。",
      "3. 将处理结果返回给所在流程，影响后续展示、生成、校验或持久化行为。",
    ].join("\n"),
    "## 关键判断和算法": `${nodeSummary(node, "当前图结构没有提供算法摘要，需要结合源码确认排序、过滤、合并或校验细节。")}`,
    "## 输出和副作用": outgoing.length > 0 ? `输出或影响下游对象：${outgoing.join("；")}。` : "输出形式需要结合返回值、写状态和调用方契约确认。",
    "## 失败、兜底和边界情况": "空输入、缺失配置、依赖失败和异常传播需要结合源码与运行时契约确认；已知不确定项会进入质量报告和 trace。",
    "## 上下游影响": `上游变化会影响它接收的数据，下游依赖会受它的输出结构、调用顺序和兜底行为影响。`,
    "## 修改风险": "修改该实现点可能改变流程结果、依赖调用顺序或边界行为，需要回归入口流程、空数据、异常和配置差异场景。",
```

Return `trace` in the topic document.

- [ ] **Step 6: Import new helpers and constants**

At the top of `markdown.ts`, add imports:

```ts
import { createDocumentTrace } from "./trace.js";
import { IMPLEMENTATION_TOPIC_REQUIRED_SECTIONS } from "./writer-contracts.js";
```

If `TOPIC_WRITER_REQUIRED_SECTIONS` is still needed for legacy tests during migration, keep it until all references are replaced.

- [ ] **Step 7: Run knowledge-base tests**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts
```

Expected: PASS after updating assertions that still expect `## 代码证据`, `## 函数卡片`, or node id text in body documents.

- [ ] **Step 8: Commit deterministic renderer rewrite**

```bash
git add packages/core/src/knowledge-base/markdown.ts packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts
git commit -m "feat: render business-first file and topic docs"
```

---

### Task 7: Rewrite Flow Documents And Business Capability Documents

**Files:**
- Modify: `packages/core/src/knowledge-base/markdown.ts`
- Modify: `packages/core/src/knowledge-base/business-facts.ts`
- Modify: `packages/core/src/knowledge-base/__tests__/business-facts.test.ts`
- Modify: `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`

- [ ] **Step 1: Add failing capability demotion tests**

In `packages/core/src/knowledge-base/__tests__/business-facts.test.ts`, add:

```ts
it("does not promote prompt-only or test-only business terms to formal capability documents", () => {
  const graph = formGraph();
  const kb = generateKnowledgeBase(graph, {
    sourceFiles: {
      "src/formtype.test.ts": "it('注册表单命中用户注册', () => {});",
      "skills/prompt.md": "示例：注册表单、表单校验、默认选项",
    },
  });

  const formalCapabilityDocs = kb.documents.filter((document) =>
    document.category === "business-capability" &&
    document.path.startsWith("业务能力/") &&
    !document.path.includes("待确认")
  );

  expect(formalCapabilityDocs.some((document) => document.path.includes("注册表单"))).toBe(false);
  expect(kb.traceArtifacts.lowConfidenceClaims.map((claim) => claim.claim).join("\n")).toContain("注册表单");
});

it("keeps production-backed business terms as formal capabilities with human-readable titles", () => {
  const graph = formGraph();
  const kb = generateKnowledgeBase(graph, {
    sourceFiles: {
      "src/formtype.ts": [
        "const RegistrationFormType = 101;",
        "export function route(ctx) {",
        "  switch (ctx.formType) { case 101: return RegistrationFormType; default: return 0; }",
        "}",
      ].join("\n"),
      "src/formtype.test.ts": "it('注册表单命中用户注册', () => {});",
    },
  });

  const capabilityDoc = kb.documents.find((document) =>
    document.category === "business-capability" &&
    document.path.startsWith("业务能力/") &&
    document.title.includes("注册表单")
  );

  expect(capabilityDoc).toBeDefined();
  expect(capabilityDoc?.title).not.toContain("if (");
  expect(capabilityDoc?.content).toContain("## 能力说明");
  expect(capabilityDoc?.content).toContain("## 规则明细");
  expect(capabilityDoc?.content).not.toContain("## 证据分级");
});
```

- [ ] **Step 2: Add failing flow-document detail test**

In `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`, add:

```ts
it("renders business flow documents with detailed steps and without code evidence sections", () => {
  const kb = generateKnowledgeBase(sampleGraph(), {
    sourceFiles: {
      "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
      "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
      "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
    },
  });

  const flow = kb.documents.find((document) => document.category === "flow");

  expect(flow?.content).toContain("## 这条流程解决什么问题");
  expect(flow?.content).toContain("## 完整执行步骤");
  expect(flow?.content).toContain("1.");
  expect(flow?.content).toContain("2.");
  expect(flow?.content).not.toContain("## 代码证据");
  expect(flow?.content).not.toContain("图谱");
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/business-facts.test.ts packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts -t "prompt-only|production-backed|business flow documents"
```

Expected: FAIL because capability grouping and flow rendering still use evidence-heavy output.

- [ ] **Step 4: Add formal capability eligibility**

In `packages/core/src/knowledge-base/business-facts.ts`, add:

```ts
function canPromoteCapability(facts: BusinessFact[]): boolean {
  return facts.some((fact) => fact.sourceKind === "production-logic" || fact.sourceKind === "configuration");
}

function readableCapabilityTitle(key: string, facts: BusinessFact[]): string {
  const keywords = [...new Set(facts.flatMap((fact) => fact.keywords))];
  if (keywords.includes("注册表单")) return "注册表单";
  if (keywords.includes("formtype")) return "FormType / 表单类型";
  const chineseKeyword = keywords.find((keyword) => /[\u4e00-\u9fff]/.test(keyword));
  if (chineseKeyword) return chineseKeyword;
  const readableKeyword = keywords.find((keyword) => /^[a-z][a-z0-9-]{2,}$/i.test(keyword));
  return readableKeyword ?? key;
}

function looksLikeCodeSnippet(value: string): boolean {
  return /^(if|switch|case|const|let|var|return|\(|\/)|[{};=]|\\s|\\d/.test(value.trim()) || value.includes("=>");
}
```

In `buildCapabilities`, before returning a capability for a group:

```ts
      const canPromote = canPromoteCapability(group);
      const title = readableCapabilityTitle(key, group);
      if (!canPromote || looksLikeCodeSnippet(title)) {
        return null;
      }
```

Change the array pipeline to filter null:

```ts
    .map(([key, group]) => {
      ...
      return { ... };
    })
    .filter((item): item is BusinessCapability => Boolean(item))
```

Make sure the returned object uses `title` from `readableCapabilityTitle`.

- [ ] **Step 5: Preserve low-confidence facts in profile**

Extend `BusinessCapabilityProfile` in `types.ts`:

```ts
  lowConfidenceFacts: BusinessFact[];
```

In `buildBusinessCapabilityProfile`, compute:

```ts
  const promotedFactIds = new Set(capabilities.flatMap((capability) => capability.factIds));
  const lowConfidenceFacts = facts.filter((fact) => !promotedFactIds.has(fact.id));
```

Return:

```ts
    capabilities,
    lowConfidenceFacts,
```

- [ ] **Step 6: Rewrite flow renderer**

In `packages/core/src/knowledge-base/markdown.ts`, replace `renderFlowDoc` body with new sections:

```ts
function renderFlowDoc(profile: ProjectProfile, planDoc: PlannedDocument): GeneratedDocument {
  const nodes = planDoc.coveredNodeIds.map((nodeId) => nodeOf(profile, nodeId)).filter((node): node is GraphNode => Boolean(node));
  const entry = nodes[0];
  const steps = nodes.map((node, index) => `${index + 1}. ${node.name}: ${nodeSummary(node, "该步骤参与当前流程，具体业务语义需要结合源码确认。")}`);
  const lines = [
    `# ${planDoc.title}`,
    "",
    "## 这条流程解决什么问题",
    entry ? `${entry.name} 所在流程用于完成 ${nodeSummary(entry, "入口触发后的业务处理。")}` : "该流程用于说明入口触发后的处理链路。",
    "",
    "## 什么时候会触发",
    entry ? `${entry.name} 被上游请求、任务、事件或生命周期调用时触发。` : "触发条件需要结合入口调用方确认。",
    "",
    "## 参与对象和关键数据",
    nodes.map((node) => `- ${node.name}: ${node.summary || "参与流程处理的数据或实现对象。"}`).join("\n") || "- 当前没有足够结构对象，需要补充源码信息。",
    "",
    "## 完整执行步骤",
    steps.length >= 2 ? steps.join("\n") : [steps[0] ?? "1. 入口触发后执行当前处理。", "2. 处理结果返回给上游或下游依赖继续使用。"].join("\n"),
    "",
    "## 关键规则和分支",
    "流程中的条件判断、过滤、排序、准入或兜底以源码实现为准；当前可以确认的结构性规则来自入口和下游依赖关系。",
    "",
    "## 数据读写与外部依赖",
    "如流程触达配置、表、服务、端点或资源节点，发布前需要确认真实配置值、数据内容和依赖可用性。",
    "",
    "## 兜底和异常处理",
    "空数据、缺失配置、依赖失败和异常传播需要结合源码和运行时契约确认，不能只根据结构信息下结论。",
    "",
    "## 改动风险",
    "修改入口参数、步骤顺序、下游依赖或输出结构会影响该流程的业务结果，需要回归入口调用和关键边界场景。",
    "",
    "## 待确认项",
    "线上配置、数据库内容、真实流量路径和业务 owner 口径需要在发布前确认。",
  ];

  return {
    path: planDoc.path,
    title: planDoc.title,
    category: "flow",
    coveredNodeIds: [...planDoc.coveredNodeIds],
    representedEdgeIds: [],
    content: lines.join("\n"),
  };
}
```

- [ ] **Step 7: Rewrite business capability renderer**

In `renderBusinessCapabilityDocuments`, update formal capability content sections to:

```ts
    const lines = [
      `# ${capability.title}`,
      "",
      "## 能力说明",
      `这个能力描述 ${capability.title} 在生产逻辑或配置中体现的业务规则。正文只解释规则、触发、处理和风险，详细来源保存在 trace 和质量报告中。`,
      "",
      "## 适用场景",
      `适用于命中 ${capability.keywords.slice(0, 8).join("、") || capability.title} 等业务条件的请求、任务或配置场景。`,
      "",
      "## 触发条件",
      primaryFacts.map((fact) => `- ${fact.title}: ${fact.businessMeaning}`).join("\n") || "- 当前没有可作为正式能力的生产或配置触发条件。",
      "",
      "## 规则明细",
      facts.map((fact) => `- 条件: ${fact.title}；判断方式: ${fact.businessMeaning}；业务结果: 影响 ${capability.title} 的命中或解释。`).join("\n"),
      "",
      "## 命中后的处理",
      `命中后会影响 ${capability.title} 对应的业务判断、路由、过滤、配置解释或结果生成。`,
      "",
      "## 未命中或异常时的处理",
      "未命中、配置缺失或数据异常时，应回到默认路径、降级逻辑或上游契约确认结果，不能仅凭离线文档判断线上行为。",
      "",
      "## 依赖的数据和配置",
      `相关来源类型包括 ${sourceKinds}。具体源码位置保存在 trace 中。`,
      "",
      "## 和其他能力的关系",
      relatedNodes.length > 0 ? relatedNodes.map((node) => `- ${node.name}: ${nodeSummary(node)}`).join("\n") : "- 当前没有明确关联对象。",
      "",
      "## 改动风险",
      "修改该能力相关规则会影响命中范围、导流、过滤、排序或解释结果，需要回归生产逻辑、配置和关键样例。",
      "",
      "## 待确认项",
      "线上配置值、实验状态、数据库内容和真实流量命中比例需要业务或平台侧确认。",
    ];
```

Remove formal pages named `生产主证据汇总`, `支撑证据汇总`, and `示例证据汇总` from official `business-capability` output. Move those summaries into `质量报告.md` in Task 8.

- [ ] **Step 8: Run tests**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/business-facts.test.ts packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts
```

Expected: PASS after updating old assertions that expected `证据分级`, `事实证据`, and evidence summary documents as formal capability docs.

- [ ] **Step 9: Commit flow and capability rewrite**

```bash
git add packages/core/src/knowledge-base/markdown.ts packages/core/src/knowledge-base/business-facts.ts packages/core/src/knowledge-base/types.ts packages/core/src/knowledge-base/__tests__/business-facts.test.ts packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts
git commit -m "feat: render business-first flows and capabilities"
```

---

### Task 8: Build Trace Artifacts, Coverage Report Updates, And Quality Report

**Files:**
- Modify: `packages/core/src/knowledge-base/generate.ts`
- Modify: `packages/core/src/knowledge-base/markdown.ts`
- Modify: `packages/core/src/knowledge-base/types.ts`
- Modify: `packages/core/src/knowledge-base/index.ts`
- Test: `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`

- [ ] **Step 1: Add failing trace artifact integration test**

In `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`, add:

```ts
it("returns trace artifacts and a quality report document", () => {
  const kb = generateKnowledgeBase(sampleGraph(), {
    sourceFiles: {
      "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
      "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
      "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
    },
  });

  expect(kb.traceArtifacts.documentTraces.length).toBeGreaterThan(0);
  expect(kb.traceArtifacts.coverageMap.nodeToDocuments["file:src/service/feed.ts"].length).toBeGreaterThan(0);
  expect(kb.documents.some((document) => document.path === "质量报告.md")).toBe(true);
  expect(kb.coverageReport.fileDocumentCoverage.covered).toBe(kb.coverageReport.fileDocumentCoverage.total);
  expect(kb.coverageReport.functionCardCoverage.covered).toBe(kb.coverageReport.functionCardCoverage.total);
  expect(kb.coverageReport.classCardCoverage.covered).toBe(kb.coverageReport.classCardCoverage.total);
});
```

- [ ] **Step 2: Run integration test and verify failure**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts -t "trace artifacts"
```

Expected: FAIL because `traceArtifacts` and `质量报告.md` do not exist.

- [ ] **Step 3: Add trace artifact builder**

In `packages/core/src/knowledge-base/trace.ts`, add:

```ts
import type { GeneratedDocument, KnowledgeBaseTraceArtifacts, LowConfidenceClaim } from "./types.js";

export function traceFromGeneratedDocument(document: GeneratedDocument): DocumentTrace {
  return createDocumentTrace({
    documentPath: document.path,
    documentType: document.category === "flow"
      ? "business-flow"
      : document.category === "business-capability"
        ? "business-capability"
        : document.category === "file"
          ? "file-implementation"
          : document.category === "topic"
            ? "implementation-topic"
            : document.category === "report"
              ? "report"
              : "index",
    coveredNodeIds: document.coveredNodeIds,
    coveredFilePaths: [],
    coveredEdgeIds: document.representedEdgeIds,
    sourceAnchors: [],
    coverageLevel: document.category === "flow"
      ? "business-flow"
      : document.category === "business-capability"
        ? "business-capability"
        : document.category === "file" || document.category === "topic"
          ? "implementation-detail"
          : document.category === "index"
            ? "index-only"
            : "trace-only",
  });
}

export function buildTraceArtifacts(
  graph: KnowledgeGraph,
  documents: readonly GeneratedDocument[],
  writerTraces: readonly DocumentTrace[] = [],
  lowConfidenceClaims: readonly LowConfidenceClaim[] = [],
): KnowledgeBaseTraceArtifacts {
  const traceByPath = new Map<string, DocumentTrace>();
  for (const document of documents) traceByPath.set(document.path, traceFromGeneratedDocument(document));
  for (const trace of writerTraces) traceByPath.set(trace.documentPath, trace);
  const documentTraces = [...traceByPath.values()].sort((a, b) => a.documentPath.localeCompare(b.documentPath));
  return {
    documentTraces,
    coverageMap: buildCoverageMap(graph, documentTraces),
    lowConfidenceClaims: [...lowConfidenceClaims].sort((a, b) => a.claim.localeCompare(b.claim)),
  };
}
```

- [ ] **Step 4: Render quality report**

In `packages/core/src/knowledge-base/markdown.ts`, add export:

```ts
export function renderQualityReport(
  traceArtifacts: KnowledgeBaseTraceArtifacts,
  coverageReport: CoverageReport,
): GeneratedDocument {
  const lowConfidence = traceArtifacts.lowConfidenceClaims.slice(0, 50);
  const lines = [
    "# 质量报告",
    "",
    "## 正文质量概览",
    "",
    `- 已检查文档: ${coverageReport.qualityValidation.checked}`,
    `- 质量失败文档: ${coverageReport.qualityValidation.failed.length}`,
    `- 质量警告: ${coverageReport.qualityValidation.warnings.length}`,
    "",
    "## 弱证据业务线索",
    "",
  ];

  if (lowConfidence.length === 0) {
    lines.push("- 当前没有需要单独降级展示的弱证据业务线索。");
  } else {
    for (const claim of lowConfidence) {
      lines.push(`- ${claim.claim}${claim.sourceKind ? `（${claim.sourceKind}）` : ""}`);
    }
  }

  lines.push("");
  lines.push("## Trace 覆盖概览");
  lines.push("");
  lines.push(`- trace 文档数: ${traceArtifacts.documentTraces.length}`);
  lines.push(`- 未覆盖节点数: ${traceArtifacts.coverageMap.uncoveredNodeIds.length}`);
  lines.push("- 正文不展示节点编号和源码行号；这些信息由 `.trace/` 目录保存。");

  return {
    path: "质量报告.md",
    title: "质量报告",
    category: "report",
    coveredNodeIds: [],
    representedEdgeIds: [],
    content: lines.join("\n"),
  };
}
```

Add imports for `KnowledgeBaseTraceArtifacts` and `CoverageReport` if not already present.

Export from `index.ts`:

```ts
  renderQualityReport,
```

- [ ] **Step 5: Build trace artifacts in `generateKnowledgeBase`**

In `packages/core/src/knowledge-base/generate.ts`, import:

```ts
import { buildTraceArtifacts } from "./trace.js";
```

After `finalSupportDocuments` and before final `documents`, gather writer traces:

```ts
  const writerTraces = [
    ...merged.acceptedFileWriterDocuments.flatMap((document) => document.trace ? [document.trace] : []),
    ...merged.acceptedTopicWriterDocuments.flatMap((document) => document.trace ? [document.trace] : []),
  ];
  const lowConfidenceClaims = businessCapabilityProfile.lowConfidenceFacts.map((fact) => ({
    claim: fact.title,
    sourceKind: fact.sourceKind,
    relatedNodeIds: fact.relatedNodeIds,
  }));
  const documentsWithoutQualityReport = [...finalSupportDocuments, ...businessDocuments, ...merged.fileDocuments, ...merged.topicDocuments]
    .sort((a, b) => a.path.localeCompare(b.path) || a.title.localeCompare(b.title));
  const traceArtifacts = buildTraceArtifacts(profile.graph, documentsWithoutQualityReport, writerTraces, lowConfidenceClaims);
  const qualityReport = renderQualityReport(traceArtifacts, coverageReport);
  const documents = [...documentsWithoutQualityReport, qualityReport]
    .sort((a, b) => a.path.localeCompare(b.path) || a.title.localeCompare(b.title));
```

Remove the old `const documents = ...` definition.

Return `traceArtifacts`.

- [ ] **Step 6: Mirror trace artifact build in CLI finalize**

In `skills/understand-kb/generate-knowledge-base.mjs`, inside `finalizeKnowledgeBase`, mirror the same logic after final support documents:

```js
  const writerTraces = [
    ...merged.acceptedFileWriterDocuments.flatMap((document) => document.trace ? [document.trace] : []),
    ...merged.acceptedTopicWriterDocuments.flatMap((document) => document.trace ? [document.trace] : []),
  ];
  const lowConfidenceClaims = businessCapabilityProfile.lowConfidenceFacts.map((fact) => ({
    claim: fact.title,
    sourceKind: fact.sourceKind,
    relatedNodeIds: fact.relatedNodeIds,
  }));
  const documentsWithoutQualityReport = [...finalSupportDocuments, ...businessDocuments, ...merged.fileDocuments, ...merged.topicDocuments]
    .sort((a, b) => a.path.localeCompare(b.path) || a.title.localeCompare(b.title));
  const traceArtifacts = core.buildTraceArtifacts(profile.graph, documentsWithoutQualityReport, writerTraces, lowConfidenceClaims);
  const qualityReport = core.renderQualityReport(traceArtifacts, coverageReport);
  const documents = [...documentsWithoutQualityReport, qualityReport]
    .sort((a, b) => a.path.localeCompare(b.path) || a.title.localeCompare(b.title));
```

Add `traceArtifacts` to `kb`.

- [ ] **Step 7: Run knowledge-base tests**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit trace artifact integration**

```bash
git add packages/core/src/knowledge-base/generate.ts packages/core/src/knowledge-base/markdown.ts packages/core/src/knowledge-base/trace.ts packages/core/src/knowledge-base/index.ts packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts skills/understand-kb/generate-knowledge-base.mjs
git commit -m "feat: emit knowledge base trace and quality reports"
```

---

### Task 9: Write `.trace` Artifacts In CLI Output

**Files:**
- Modify: `skills/understand-kb/generate-knowledge-base.mjs`
- Test: `src/__tests__/worktree-redirect.test.mjs` is not relevant; use manual deterministic CLI verification in this task.

- [ ] **Step 1: Update `writeKnowledgeBase` to write trace JSON files**

In `skills/understand-kb/generate-knowledge-base.mjs`, inside `writeKnowledgeBase`, after writing Markdown documents and `knowledge-base-profile.json`, add:

```js
  const traceRoot = join(outputRoot, '.trace');
  mkdirSync(traceRoot, { recursive: true });
  writeJson(join(traceRoot, 'document-traces.json'), kb.traceArtifacts.documentTraces);
  writeJson(join(traceRoot, 'coverage-map.json'), kb.traceArtifacts.coverageMap);
  writeJson(join(traceRoot, 'low-confidence-claims.json'), kb.traceArtifacts.lowConfidenceClaims);
```

- [ ] **Step 2: Include trace inventory in profile JSON**

In `serializableProfile(kb)`, add:

```js
    traceArtifacts: {
      documentTraceCount: kb.traceArtifacts?.documentTraces?.length ?? 0,
      lowConfidenceClaimCount: kb.traceArtifacts?.lowConfidenceClaims?.length ?? 0,
      uncoveredNodeCount: kb.traceArtifacts?.coverageMap?.uncoveredNodeIds?.length ?? 0,
    },
```

- [ ] **Step 3: Update console output labels**

In `printCoverage`, after quality validation output:

```js
  if (kb.traceArtifacts) {
    console.log(`Trace 文档: ${kb.traceArtifacts.documentTraces.length}`);
    console.log(`弱证据业务线索: ${kb.traceArtifacts.lowConfidenceClaims.length}`);
  }
```

Change:

```js
  console.log(`函数卡片覆盖: ${kb.coverageReport.functionCardCoverage.covered} / ${kb.coverageReport.functionCardCoverage.total}`);
  console.log(`类卡片覆盖: ${kb.coverageReport.classCardCoverage.covered} / ${kb.coverageReport.classCardCoverage.total}`);
```

To:

```js
  console.log(`函数覆盖: ${kb.coverageReport.functionCardCoverage.covered} / ${kb.coverageReport.functionCardCoverage.total}`);
  console.log(`类覆盖: ${kb.coverageReport.classCardCoverage.covered} / ${kb.coverageReport.classCardCoverage.total}`);
```

Keep the internal field names for compatibility.

- [ ] **Step 4: Build core**

Run:

```bash
pnpm --filter @understand-code/core build
```

Expected: PASS.

- [ ] **Step 5: Run deterministic generation on fixture repository**

Run:

```bash
node skills/understand-kb/generate-knowledge-base.mjs /Users/example/understand-code --deterministic-only --allow-large-deterministic
```

Expected: command completes, prints Markdown document count, coverage status, trace document count, and weak evidence count. If the local graph is too large and memory fails, run this instead against a small temporary fixture with an existing `.understand-code/knowledge-graph.json`.

- [ ] **Step 6: Verify trace files exist**

Run:

```bash
test -f /Users/example/understand-code/.understand-code/knowledge-base/.trace/document-traces.json
test -f /Users/example/understand-code/.understand-code/knowledge-base/.trace/coverage-map.json
test -f /Users/example/understand-code/.understand-code/knowledge-base/.trace/low-confidence-claims.json
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit CLI trace writing**

```bash
git add skills/understand-kb/generate-knowledge-base.mjs packages/core/dist
git commit -m "feat: write knowledge base trace artifacts"
```

If this repository does not commit `packages/core/dist`, omit it from `git add`.

---

### Task 10: Update Coverage Report Labels And Count Guarantees

**Files:**
- Modify: `packages/core/src/knowledge-base/markdown.ts`
- Modify: `packages/core/src/knowledge-base/types.ts`
- Modify: `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`

- [ ] **Step 1: Add coverage-count guarantee test**

In `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`, add:

```ts
it("keeps document count and coverage guarantees visible in coverage report", () => {
  const kb = generateKnowledgeBase(sampleGraph(), {
    sourceFiles: {
      "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\n",
      "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
      "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
    },
  });
  const report = kb.documents.find((document) => document.path === "覆盖报告.md");

  expect(report?.content).toContain("文件文档覆盖");
  expect(report?.content).toContain("函数覆盖");
  expect(report?.content).toContain("类覆盖");
  expect(report?.content).toContain("入口流程覆盖");
  expect(report?.content).toContain("required topic 覆盖");
  expect(report?.content).toContain("Trace 覆盖");
  expect(report?.content).not.toContain("函数卡片覆盖");
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts -t "coverage guarantees"
```

Expected: FAIL because report labels are still old.

- [ ] **Step 3: Update coverage report rendering**

In `renderCoverageReport`, change labels:

```ts
  lines.push(`- 文件文档覆盖: ${report.fileDocumentCoverage.covered} / ${report.fileDocumentCoverage.total}`);
  lines.push(`- 函数覆盖: ${report.functionCardCoverage.covered} / ${report.functionCardCoverage.total}`);
  lines.push(`- 类覆盖: ${report.classCardCoverage.covered} / ${report.classCardCoverage.total}`);
  lines.push(`- 入口流程覆盖: ${report.entryCoverage.covered} / ${report.entryCoverage.total}`);
  lines.push(`- required topic 覆盖: ${report.requiredTopicCoverage.covered} / ${report.requiredTopicCoverage.total}`);
```

Add a section:

```ts
  lines.push("");
  lines.push("## Trace 覆盖");
  lines.push("");
  lines.push("- 正文不展示节点编号、源码行号和证据等级；这些内容写入 `.trace/` 目录。");
  lines.push("- `document-traces.json` 保存文档到节点、文件、边和源码锚点的映射。");
  lines.push("- `coverage-map.json` 保存节点到文档的反向索引。");
  lines.push("- `low-confidence-claims.json` 保存未升级为正式业务能力的弱证据线索。");
```

- [ ] **Step 4: Add document-count baseline wording**

In the same report, add:

```ts
  lines.push("");
  lines.push("## 文档数量约束");
  lines.push("");
  lines.push("- 业务化改写不能通过大量删减文档实现；同一份 graph 的 Markdown 文档数应保持在历史基线的 90% 以上。");
  lines.push("- 文件文档数必须等于 file node 数，函数和类必须保持 100% 覆盖。");
```

- [ ] **Step 5: Run coverage report tests**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts -t "coverage guarantees|reports actual document counts"
```

Expected: PASS after updating the older `"reports actual document counts and coverage status"` assertions from `函数卡片覆盖` to `函数覆盖`.

- [ ] **Step 6: Commit report updates**

```bash
git add packages/core/src/knowledge-base/markdown.ts packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts
git commit -m "feat: report business-first coverage guarantees"
```

---

### Task 11: Update Agent Prompts And Skill Guidance

**Files:**
- Modify: `agents/kb-file-writer.md`
- Modify: `agents/kb-topic-writer.md`
- Modify: `skills/understand-kb/SKILL.md`

- [ ] **Step 1: Update file writer required sections**

In `agents/kb-file-writer.md`, replace the required Markdown sections list with:

```markdown
Every `markdown` value must include:

- `## 文件在系统里的作用`
- `## 它负责的业务步骤`
- `## 主要输入和输出`
- `## 内部协作方式`
- `## 关键函数或类怎么分工`
- `## 规则、兜底和副作用`
- `## 修改这个文件的风险`
- `## 覆盖状态`
```

- [ ] **Step 2: Add file writer body/trace rule**

In `agents/kb-file-writer.md`, add under Hard Rules:

```markdown
- The Markdown body is for business and implementation explanation. Do not include `## 代码证据`, `## 测试证据`, graph node tables, evidence grade tables, or long line-range tables in the body.
- Put node ids, source locations, edge ids, and coverage details in the JSON `trace` object.
- The JSON `trace.coveredNodeIds` must include the file node id and every function/class node covered by the task.
- The body must explain implementation steps in detail; do not write a single generic paragraph.
```

- [ ] **Step 3: Update file writer JSON example**

Replace the example document object with one that includes:

```json
"markdown": "# src/service/feed.ts 实现说明\n\n## 文件在系统里的作用\n这个文件把 feed 请求中的候选内容整理成最终响应，影响用户看到的信息流内容和顺序。\n\n## 它负责的业务步骤\n1. 接收请求上下文并准备候选加载参数。\n2. 读取候选内容并交给排序逻辑。\n3. 组装响应对象并返回入口层。\n\n## 主要输入和输出\n输入是请求上下文、用户标识和候选数据依赖；输出是排序后的 feed 响应和必要元数据。\n\n## 内部协作方式\nBuildFeed 负责主流程编排，rankCandidates 负责排序，FeedBuilder 负责响应组装。\n\n## 关键函数或类怎么分工\n- BuildFeed: 连接入口、候选读取和响应输出。\n- rankCandidates: 决定候选展示顺序。\n- FeedBuilder: 保存组装状态并生成响应。\n\n## 规则、兜底和副作用\n候选为空时返回空列表并保留响应元数据；排序字段缺失时的默认值需要结合配置确认。\n\n## 修改这个文件的风险\n修改候选加载、排序或空态兜底会影响 feed 展示结果，需要回归正常候选、空候选和配置缺失场景。\n\n## 覆盖状态\n覆盖关系保存在 trace 中，正文不展示节点编号和源码行号表格。",
"trace": {
  "documentPath": "文件文档/src-service-feed.ts.md",
  "documentType": "file-implementation",
  "coveredNodeIds": ["file:src/service/feed.ts", "function:src/service/feed.ts:BuildFeed"],
  "coveredFilePaths": ["src/service/feed.ts"],
  "coveredEdgeIds": ["calls:function:src/api/routes.ts:HandleFeedRequest->function:src/service/feed.ts:BuildFeed"],
  "sourceAnchors": [{ "filePath": "src/service/feed.ts", "lineRange": [30, 90], "nodeId": "function:src/service/feed.ts:BuildFeed", "role": "primary" }],
  "coverageLevel": "implementation-detail",
  "lowConfidenceClaims": [],
  "movedInternalDetails": []
}
```

- [ ] **Step 4: Update topic writer required sections and rules**

In `agents/kb-topic-writer.md`, replace required sections with:

```markdown
Every topic must include:

- `## 为什么它关键`
- `## 它处在流程的哪一步`
- `## 输入是什么`
- `## 执行过程`
- `## 关键判断和算法`
- `## 输出和副作用`
- `## 失败、兜底和边界情况`
- `## 上下游影响`
- `## 修改风险`
```

Add under Hard Rules:

```markdown
- The Markdown body must read as a key implementation explanation, not an evidence report.
- Do not include `## 代码证据`, `## 测试证据`, graph node tables, evidence grade tables, or long source-location tables in the body.
- Put source locations, node ids, edge ids, and coverage details in `trace`.
- `trace.coveredNodeIds` must include the topic node id.
- `## 执行过程` must use ordered steps and explain what each step does, depends on, and produces.
```

- [ ] **Step 5: Update skill output tree and reporting instructions**

In `skills/understand-kb/SKILL.md`, update output tree:

```text
.understand-code/knowledge-base/
├── 目录.md
├── 项目总览.md
├── 架构地图.md
├── 业务流程地图.md
├── 待确认项.md
├── 覆盖报告.md
├── 质量报告.md
├── 业务能力索引.md
├── knowledge-base-profile.json
├── 索引/
├── 模块总览/
├── 业务流程/
├── 业务能力/
├── 文件文档/
├── 关键函数专题/
├── .trace/
└── .intermediate/
```

In final reporting instructions, add:

```markdown
- Trace document count from script output.
- Low-confidence business signal count from script output.
- Quality report path: `$PROJECT_ROOT/.understand-code/knowledge-base/质量报告.md`.
- Trace directory path: `$PROJECT_ROOT/.understand-code/knowledge-base/.trace/`.
```

- [ ] **Step 6: Run prompt consistency search**

Run:

```bash
rg -n "## 代码证据|## 测试证据|证据分级|函数卡片|类卡片" agents/kb-file-writer.md agents/kb-topic-writer.md skills/understand-kb/SKILL.md
```

Expected: no matches in the writer prompt required section lists. Matches inside historical explanation should be removed or reworded.

- [ ] **Step 7: Commit prompt and skill updates**

```bash
git add agents/kb-file-writer.md agents/kb-topic-writer.md skills/understand-kb/SKILL.md
git commit -m "docs: align knowledge writers with business-first trace contract"
```

---

### Task 12: Full Regression And Final Cleanup

**Files:**
- Modify as needed based on test failures.
- Test: all knowledge-base tests and TypeScript build.

- [ ] **Step 1: Run all knowledge-base tests**

Run:

```bash
pnpm --filter @understand-code/core test packages/core/src/knowledge-base
```

Expected: PASS.

- [ ] **Step 2: Run full core tests**

Run:

```bash
pnpm --filter @understand-code/core test
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript build**

Run:

```bash
pnpm --filter @understand-code/core build
```

Expected: PASS.

- [ ] **Step 4: Search generated body templates for banned sections**

Run:

```bash
rg -n "## 代码证据|## 测试证据|证据分级|节点 ID|coveredNodeIds|sourceEvidence|evidenceRole|未在图谱中识别" packages/core/src/knowledge-base agents/kb-file-writer.md agents/kb-topic-writer.md
```

Expected: matches only in quality tests, banned-term constants, migration comments, or prompt rules that explicitly prohibit those terms. No renderer body template should include these as normal output headings.

- [ ] **Step 5: Run deterministic generation smoke check**

Run:

```bash
node skills/understand-kb/generate-knowledge-base.mjs /Users/example/understand-code --deterministic-only --allow-large-deterministic
```

Expected:

- command completes
- prints Markdown document count
- prints coverage status
- prints trace document count
- writes `质量报告.md`
- writes `.trace/document-traces.json`

If the local graph is too large for deterministic-only memory limits, use a temporary small fixture repository and record the skipped large-run reason in the final implementation summary.

- [ ] **Step 6: Inspect representative output**

Open these files if they exist after smoke generation:

```bash
sed -n '1,180p' .understand-code/knowledge-base/业务流程地图.md
sed -n '1,180p' .understand-code/knowledge-base/覆盖报告.md
sed -n '1,180p' .understand-code/knowledge-base/质量报告.md
find .understand-code/knowledge-base/文件文档 -type f | head -1 | xargs sed -n '1,180p'
find .understand-code/knowledge-base/关键函数专题 -type f | head -1 | xargs sed -n '1,180p'
```

Expected:

- file documents use `实现说明`
- flow/topic/body pages do not include `## 代码证据`
- coverage report explains trace side channel
- quality report lists weak evidence claims or says none exist

- [ ] **Step 7: Check git diff for unrelated dashboard changes**

Run:

```bash
git diff --stat
git diff --name-only
```

Expected: changed files are limited to knowledge-base core modules, tests, CLI skill, writer prompts, and docs. Do not stage unrelated dashboard or `.understand-code/` generated output unless the user explicitly asks for generated artifacts to be committed.

- [ ] **Step 8: Final commit**

```bash
git add packages/core/src/knowledge-base agents/kb-file-writer.md agents/kb-topic-writer.md skills/understand-kb/SKILL.md skills/understand-kb/generate-knowledge-base.mjs
git commit -m "feat: generate business-first traceable knowledge base"
```

If earlier tasks already produced commits, this final commit should include only final cleanup, test fixes, and prompt/report consistency updates.

---

## Self-Review Checklist

- Spec coverage:
  - Business-first body documents: Tasks 3, 4, 6, 7, 11.
  - Trace side channel: Tasks 1, 5, 8, 9.
  - Coverage preservation: Tasks 5, 8, 10, 12.
  - Weak-signal demotion: Task 7.
  - Writer prompts: Task 11.
  - CLI trace output: Task 9.
  - Quality validation: Tasks 3, 4, 12.
- Placeholder scan:
  - This plan avoids open-ended placeholders and includes concrete tests, code snippets, commands, and expected results for each task.
- Type consistency:
  - `DocumentTrace`, `KnowledgeBaseTraceArtifacts`, `BusinessNarrativePlan`, and `traceArtifacts` names are consistent across tasks.
  - Existing `functionCardCoverage` and `classCardCoverage` fields are retained internally for compatibility, while output labels change to `函数覆盖` and `类覆盖`.
