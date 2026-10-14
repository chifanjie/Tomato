# Wiki V2 Knowledge Contract and Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` and complete the tasks in order. Every task follows red-green-refactor and must be committed separately.

**Goal:** Generate a source-backed Wiki V2 contract with a small guided reading layer, exhaustive file/symbol references, hard publication gates, exact node evidence, V1 read-only compatibility, and four deterministic JSON artifacts.

**Architecture:** Core owns the Wiki contract, compatibility adapter, planning semantics, quality decisions, and artifact construction. The orchestration script only reads files, runs the existing queue phases, and writes Core-produced artifacts. Dashboard and graph work in later plans consume the normalized V2 contract and never infer documentation truth from Markdown.

**Tech stack:** TypeScript 5.7, Node.js ESM, Zod 4, Vitest 3, pnpm workspaces.

## Global constraints

- Work incrementally in the existing dirty worktree. Never reset, overwrite, stage, or commit unrelated changes.
- Before each commit, run `git diff --check`. Add new files directly, but use `git add -p -- <existing files>` for every pre-existing file so unrelated dirty hunks in the same file are not staged.
- New generation writes only `wiki-index.json` version 2. V1 is accepted only through a read-only adapter.
- Default generated prose and user-visible generation errors are Simplified Chinese (`zh-CN`). Identifiers, paths, APIs, and protocol names stay unchanged.
- `featured`, `reference`, and `maintenance` are document roles, not quality levels.
- Direct explanation, contextual mention, content quality, evidence health, generation state, and reference coverage remain independent.
- A page satisfies usable direct coverage only when quality is `verified` or `generated`, generation is `complete`, and every direct node has exact source evidence.
- `hide` takes precedence over `pin`, and `pin` takes precedence over `order`.
- A deterministic run may emit diagnostic artifacts, but its Main Readiness is always `blocked`; it must never be presented as a publishable writer-backed knowledge base.
- Preserve the existing queue lease/retry behavior.
- Design source: `docs/superpowers/specs/2026-07-11-wiki-graph-experience-design.md`.

## Planned files

New Core modules:

- `packages/core/src/knowledge-base/wiki-contract.ts`
- `packages/core/src/knowledge-base/wiki-v1-adapter.ts`
- `packages/core/src/knowledge-base/route-overrides.ts`
- `packages/core/src/knowledge-base/featured-planner.ts`
- `packages/core/src/knowledge-base/publication-quality.ts`
- `packages/core/src/knowledge-base/artifacts.ts`

New tests:

- `packages/core/src/knowledge-base/__tests__/wiki-contract.test.ts`
- `packages/core/src/knowledge-base/__tests__/wiki-v1-adapter.test.ts`
- `packages/core/src/knowledge-base/__tests__/route-overrides.test.ts`
- `packages/core/src/knowledge-base/__tests__/featured-planner.test.ts`
- `packages/core/src/knowledge-base/__tests__/publication-quality.test.ts`
- `packages/core/src/knowledge-base/__tests__/artifacts.test.ts`

Existing files changed:

- `packages/core/src/types.ts`
- `packages/core/src/persistence/index.ts`
- `packages/core/src/persistence/persistence.test.ts`
- `packages/core/src/knowledge-base/types.ts`
- `packages/core/src/knowledge-base/index.ts`
- `packages/core/src/knowledge-base/planner.ts`
- `packages/core/src/knowledge-base/generate.ts`
- `packages/core/src/knowledge-base/file-doc-planner.ts`
- `packages/core/src/knowledge-base/merge.ts`
- `packages/core/src/knowledge-base/writer-contracts.ts`
- `packages/core/src/knowledge-base/quality.ts`
- `packages/core/src/knowledge-base/markdown.ts`
- `packages/core/src/knowledge-base/paths.ts`
- `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`
- `packages/core/src/knowledge-base/__tests__/file-doc-planner.test.ts`
- `packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts`
- `packages/core/src/knowledge-base/__tests__/merge.test.ts`
- `packages/core/src/__tests__/knowledge-base-wiki-index.test.ts`
- `agents/kb-file-writer.md`
- `agents/kb-topic-writer.md`
- `skills/understand-kb/generate-knowledge-base.mjs`
- `skills/understand-kb/SKILL.md`

---

## Task 1: Define and validate the complete Wiki V2 contract

**Files**

- Create: `packages/core/src/knowledge-base/wiki-contract.ts`
- Create: `packages/core/src/knowledge-base/__tests__/wiki-contract.test.ts`
- Modify: `packages/core/src/knowledge-base/index.ts`

- [ ] **Step 1: Write the failing contract test**

Create `wiki-contract.test.ts` with this complete fixture and assertions:

```ts
import { describe, expect, it } from "vitest";
import {
  contextPagesForNode,
  directPagesForNode,
  evidenceForNode,
  parseWikiIndexV2,
  primaryDestinationForNode,
  type WikiIndexV2,
} from "../wiki-contract.js";

function validIndex(): WikiIndexV2 {
  return {
    version: 2,
    generatedAt: "2026-07-11T00:00:00.000Z",
    projectName: "demo",
    source: {
      outputLanguage: "zh-CN",
      generationMode: "writer",
      graphDigest: "abc",
      sourceRootIdentity: "/workspace/demo",
    },
    mainReadiness: { status: "ready", reasons: [], routePageIds: ["page:overview"] },
    referenceCoverage: {
      status: "complete",
      files: { covered: 1, total: 1, missingIds: [] },
      functions: { covered: 1, total: 1, missingIds: [] },
      types: { covered: 0, total: 0, missingIds: [] },
    },
    pages: [{
      id: "page:overview",
      title: "项目总览",
      summary: "解释项目目标、运行流程和源码入口。",
      markdownPath: "knowledge-base/项目总览.md",
      role: "featured",
      category: "overview",
      quality: "generated",
      generationStatus: "complete",
      directNodeIds: ["function:src/a.ts:run"],
      contextNodeIds: ["file:src/a.ts"],
      evidenceIds: ["evidence:run"],
      searchTerms: ["运行入口"],
      route: { order: 0, stage: "purpose" },
    }],
    nodeDocumentation: [{
      nodeId: "function:src/a.ts:run",
      relation: "direct",
      quality: "generated",
      evidenceHealth: "source-linked",
      generationStatus: "complete",
      referenceCoverage: "anchored",
      directPageIds: ["page:overview"],
      contextPageIds: [],
      evidenceIds: ["evidence:run"],
      primaryPageId: "page:overview",
      anchor: "run",
    }, {
      nodeId: "file:src/a.ts",
      relation: "context",
      quality: "needs-review",
      evidenceHealth: "missing",
      generationStatus: "partial",
      referenceCoverage: "unanchored",
      directPageIds: [],
      contextPageIds: ["page:overview"],
      evidenceIds: [],
    }],
    evidence: [{
      id: "evidence:run",
      nodeIds: ["function:src/a.ts:run"],
      filePath: "src/a.ts",
      lineRange: [1, 3],
      excerpt: "export function run() {}",
      evidenceType: "production",
    }],
  };
}

describe("Wiki V2 contract", () => {
  it("accepts a consistent index and keeps direct, context, and evidence separate", () => {
    const parsed = parseWikiIndexV2(validIndex());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
    expect(directPagesForNode(parsed.value, "function:src/a.ts:run").map((page) => page.id)).toEqual(["page:overview"]);
    expect(contextPagesForNode(parsed.value, "file:src/a.ts").map((page) => page.id)).toEqual(["page:overview"]);
    expect(primaryDestinationForNode(parsed.value, "function:src/a.ts:run")).toEqual({ pageId: "page:overview", anchor: "run" });
    expect(evidenceForNode(parsed.value, "function:src/a.ts:run").map((item) => item.id)).toEqual(["evidence:run"]);
  });

  it("rejects overlapping page links, fake verification, invalid ranges, and misattributed evidence", () => {
    const payload = validIndex();
    payload.pages[0] = {
      ...payload.pages[0],
      quality: "verified",
      contextNodeIds: ["function:src/a.ts:run"],
    };
    payload.evidence[0] = { ...payload.evidence[0], nodeIds: ["file:src/a.ts"], lineRange: [3, 1] };
    const parsed = parseWikiIndexV2(payload);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error("expected invalid payload");
    expect(parsed.errors.join("\n")).toContain("directNodeIds and contextNodeIds overlap");
    expect(parsed.errors.join("\n")).toContain("verified page requires verification");
    expect(parsed.errors.join("\n")).toContain("lineRange end must be greater than or equal to start");
    expect(parsed.errors.join("\n")).toContain("evidence does not contain node");
  });

  it("rejects duplicate ids, missing route pages, and a primary page that is not direct", () => {
    const payload = validIndex();
    payload.pages.push({ ...payload.pages[0] });
    payload.mainReadiness.routePageIds = ["page:missing"];
    payload.nodeDocumentation[0].primaryPageId = "page:missing";
    const parsed = parseWikiIndexV2(payload);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error("expected invalid payload");
    expect(parsed.errors.join("\n")).toContain("duplicate page id");
    expect(parsed.errors.join("\n")).toContain("missing route page");
    expect(parsed.errors.join("\n")).toContain("primaryPageId must reference a direct page");
  });
});
```

Run:

```bash
pnpm --filter @understand-code/core exec vitest run src/knowledge-base/__tests__/wiki-contract.test.ts
```

Expected: FAIL because `wiki-contract.ts` does not exist.

- [ ] **Step 2: Implement the schemas, types, invariants, and selectors**

Create `wiki-contract.ts`. Do not export another `ContractParseResult`, because `writer-contracts.ts` already exports that name through the same barrel. Use this distinct result type:

```ts
export type WikiParseResult<T> =
  | { ok: true; value: T; errors: [] }
  | { ok: false; errors: string[] };
```

Define these exact unions:

```ts
export type WikiDocumentRole = "featured" | "reference" | "maintenance";
export type WikiDocumentCategory = "overview" | "capability" | "flow" | "module" | "topic" | "file" | "quality" | "coverage" | "other";
export type DocumentationRelation = "direct" | "context" | "none";
export type ContentQuality = "verified" | "generated" | "needs-review" | "failed";
export type EvidenceHealth = "source-linked" | "weak" | "unreadable" | "missing";
export type GenerationStatus = "complete" | "partial" | "failed";
export type ReferenceCoverage = "anchored" | "unanchored" | "not-applicable";
export type MainReadiness = "ready" | "degraded" | "blocked";
export type RouteStage = "purpose" | "flow" | "rule" | "implementation" | "evidence";
```

Define and export the following complete interfaces:

```ts
export interface CountSummaryV2 { covered: number; total: number; missingIds: string[] }
export interface MainReadinessSummaryV2 { status: MainReadiness; reasons: string[]; routePageIds: string[] }
export interface ReferenceCoverageSummaryV2 {
  status: "complete" | "partial";
  files: CountSummaryV2;
  functions: CountSummaryV2;
  types: CountSummaryV2;
}
export interface WikiPageV2 {
  id: string; title: string; summary: string; markdownPath: string;
  role: WikiDocumentRole; category: WikiDocumentCategory;
  quality: ContentQuality; generationStatus: GenerationStatus;
  directNodeIds: string[]; contextNodeIds: string[]; evidenceIds: string[]; searchTerms: string[];
  verification?: { method: "human" | "external"; verifiedAt: string; verifier?: string };
  route?: { order: number; stage: RouteStage };
}
export interface WikiNodeDocumentationV2 {
  nodeId: string; relation: DocumentationRelation; quality: ContentQuality;
  evidenceHealth: EvidenceHealth; generationStatus: GenerationStatus; referenceCoverage: ReferenceCoverage;
  directPageIds: string[]; contextPageIds: string[]; evidenceIds: string[];
  primaryPageId?: string; anchor?: string;
}
export interface WikiEvidenceV2 {
  id: string; nodeIds: string[]; filePath: string; lineRange: [number, number]; excerpt?: string;
  evidenceType: "production" | "configuration" | "test" | "documentation";
}
export interface WikiIndexV2 {
  version: 2; generatedAt: string; projectName: string;
  source: { outputLanguage: string; generationMode: string; graphDigest?: string; gitCommitHash?: string; sourceRootIdentity?: string };
  mainReadiness: MainReadinessSummaryV2;
  referenceCoverage: ReferenceCoverageSummaryV2;
  pages: WikiPageV2[]; nodeDocumentation: WikiNodeDocumentationV2[]; evidence: WikiEvidenceV2[];
}
export interface WikiSearchRecordV2 {
  id: string; kind: "page" | "symbol"; title: string; summary?: string; pageId: string;
  anchor?: string; nodeId?: string; role: WikiDocumentRole; category: WikiDocumentCategory;
  relation: DocumentationRelation; terms: string[]; businessTerms: string[]; filePath?: string;
}
export interface WikiSearchIndexV2 { version: 2; generatedAt: string; records: WikiSearchRecordV2[] }
export interface WikiClaimTraceV2 { id: string; text: string; nodeIds: string[]; evidenceIds: string[] }
export interface WikiDocumentTraceRecordV2 {
  pageId: string; directNodeIds: string[]; contextNodeIds: string[]; evidenceIds: string[];
  quality: ContentQuality; generationStatus: GenerationStatus; issues: string[];
  claims: WikiClaimTraceV2[];
}
export interface WikiDocumentTracesV2 { version: 2; generatedAt: string; traces: WikiDocumentTraceRecordV2[] }
export interface WikiGenerationReportV2 {
  version: 2; generatedAt: string; generationMode: string;
  source: { outputLanguage: string; sourceRootIdentity: string; graphDigest?: string; gitCommitHash?: string };
  sourceRead: CountSummaryV2; mainReadiness: MainReadinessSummaryV2;
  referenceCoverage: ReferenceCoverageSummaryV2; warnings: string[]; errors: string[];
}
```

Implement Zod schemas for every field of `WikiIndexV2`; infer nothing with `as`. The evidence `lineRange` schema must use `.superRefine()` to reject `end < start` with the exact test message.

After structural parsing, run this invariant algorithm:

1. Reject duplicate page IDs, node-documentation node IDs, and evidence IDs.
2. For each page, reject overlap between `directNodeIds` and `contextNodeIds`.
3. Require `verification` when `quality === "verified"`; reject `verification` for other qualities.
4. Require `role === "featured"` when `route` exists; route order must be unique.
5. Require every `mainReadiness.routePageIds` entry to exist, be featured, and have a route.
6. Require page evidence IDs and node evidence IDs to exist.
7. Require every direct/context page ID in a node record to exist and contain that node in the matching page array.
8. Require `primaryPageId` to be in `directPageIds`; do not use context as a primary page.
9. Require every node evidence record to include that node in `evidence.nodeIds`.
10. For a complete generated/verified page, require the union of its referenced evidence `nodeIds` to contain every direct node. Draft and failed pages may retain incomplete trace evidence.
11. Require `relation` to match page arrays: direct when `directPageIds` is non-empty, otherwise context when `contextPageIds` is non-empty, otherwise none.
12. Require `evidenceHealth === "source-linked"` to have exact node evidence with a non-empty excerpt; path/range-only evidence is at most weak.
13. Require count summaries to satisfy `covered <= total`, `missingIds.length === total - covered`, and contain unique missing IDs.

Implement `parseWikiIndexV2`, `directPagesForNode`, `contextPagesForNode`, and `evidenceForNode` as indexed lookups over the validated arrays. `primaryDestinationForNode` returns the stored primary page and optional anchor; selection priority is assigned by Task 6, not guessed in this selector.

- [ ] **Step 3: Export and verify**

Add exactly:

```ts
export * from "./wiki-contract.js";
```

to `packages/core/src/knowledge-base/index.ts`.

Run:

```bash
pnpm --filter @understand-code/core exec vitest run src/knowledge-base/__tests__/wiki-contract.test.ts
pnpm --filter @understand-code/core build
```

Expected: PASS.

Commit:

```bash
git add packages/core/src/knowledge-base/wiki-contract.ts packages/core/src/knowledge-base/__tests__/wiki-contract.test.ts
git add -p -- packages/core/src/knowledge-base/index.ts
git diff --check --cached
git commit -m "feat(kb): define wiki v2 contract"
```

---

## Task 2: Add strict, loss-aware V1 adaptation

**Files**

- Create: `packages/core/src/knowledge-base/wiki-v1-adapter.ts`
- Create: `packages/core/src/knowledge-base/__tests__/wiki-v1-adapter.test.ts`
- Modify: `packages/core/src/knowledge-base/index.ts`

- [ ] **Step 1: Write the failing adapter test**

Create `wiki-v1-adapter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseWikiIndex } from "../wiki-v1-adapter.js";

const legacy = {
  version: 1,
  generatedAt: "2026-07-11T00:00:00.000Z",
  projectName: "legacy",
  source: { outputLanguage: "zh-Hans", generationMode: "writer" },
  pages: [{
    id: "legacy-page", title: "旧文档", category: "file", summary: "旧版文件说明。",
    markdownPath: "knowledge-base/文件文档/a.md",
    explainedNodeIds: ["file:src/a.ts"],
    relatedNodeIds: ["function:src/a.ts:run"],
    evidenceIds: ["e1"], coverage: "partial", quality: "verified",
    searchTerms: ["a.ts"],
  }],
  evidence: [{ id: "e1", label: "a", filePath: "src/a.ts", lineRange: [1, 2], nodeIds: ["file:src/a.ts"] }],
  gaps: [{ id: "g1", nodeId: "function:src/a.ts:run", reason: "missing", severity: "high" }],
};

describe("V1 Wiki adapter", () => {
  it("maps links without inventing verification, strong evidence, or dedicated-body gaps", () => {
    const parsed = parseWikiIndex(legacy);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
    expect(parsed.sourceVersion).toBe(1);
    expect(parsed.value.pages[0]).toMatchObject({
      role: "reference", directNodeIds: ["file:src/a.ts"],
      contextNodeIds: ["function:src/a.ts:run"], quality: "needs-review",
      generationStatus: "partial",
    });
    expect(parsed.value.pages[0]).not.toHaveProperty("verification");
    expect(parsed.value.nodeDocumentation.find((item) => item.nodeId === "file:src/a.ts")).toMatchObject({
      relation: "direct", quality: "needs-review", evidenceHealth: "weak",
      directPageIds: ["legacy-page"], evidenceIds: ["e1"],
    });
    expect(parsed.value.nodeDocumentation.find((item) => item.nodeId === "function:src/a.ts:run")).toMatchObject({
      relation: "context", directPageIds: [], contextPageIds: ["legacy-page"], evidenceIds: [],
    });
    expect(parsed.value.mainReadiness.status).toBe("blocked");
  });

  it("rejects a malformed V1 record instead of coercing missing fields with String(undefined)", () => {
    const parsed = parseWikiIndex({ ...legacy, pages: [{ id: "broken" }] });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error("expected invalid payload");
    expect(parsed.errors.join("\n")).toContain("pages.0.title");
  });
});
```

Run:

```bash
pnpm --filter @understand-code/core exec vitest run src/knowledge-base/__tests__/wiki-v1-adapter.test.ts
```

Expected: FAIL with module-resolution failure for `wiki-v1-adapter.js`.

- [ ] **Step 2: Implement V1 structural parsing and conversion**

Create `wiki-v1-adapter.ts` with private Zod schemas matching the current V1 shape in `packages/dashboard/src/wiki/wikiIndex.ts`: all required page fields, optional `qualityIssues/searchTerms/source`, evidence with optional path/range, and gaps. Do not accept a record merely because it has arrays.

Export this non-overlapping result type and functions:

```ts
export type ParsedWikiIndex =
  | { ok: true; value: WikiIndexV2; errors: []; sourceVersion: 1 | 2 }
  | { ok: false; errors: string[] };

export function isWikiIndexV1(value: unknown): boolean;
export function adaptWikiIndexV1(value: unknown): WikiParseResult<WikiIndexV2>;
export function parseWikiIndex(value: unknown): ParsedWikiIndex;
```

Conversion algorithm:

1. Parse V1 with the private schema. Return field-path errors; never coerce absent values.
2. Map `explainedNodeIds` to `directNodeIds`, `relatedNodeIds` to `contextNodeIds`, removing overlap from context.
3. Map V1 `symbol` to V2 `topic`, `gap` to `coverage`, and retain the other valid categories.
4. Map `gap/quality` pages to `maintenance`; all other V1 pages become `reference`. V1 pages never receive a guided route.
5. Map every V1 quality, including `verified`, to `needs-review`; V1 has no explicit V2 verification record or hard-gate proof.
6. Map every page generation state to `partial`.
7. Retain evidence only when it has at least one non-empty node ID, a file path, and a valid ordered positive line range. Because V1 lacks excerpts, node evidence health is `weak`, never `source-linked`. After filtering, replace each page's evidence IDs with the intersection of its original IDs and retained evidence IDs so the V2 contract has no dangling reference.
8. Build node records from the union of direct IDs, context IDs, and retained evidence node IDs. Gap severity never creates a direct relationship or primary page.
9. Every adapted node uses quality `needs-review`, generation `partial`, and reference coverage `unanchored`; it has no primary page or symbol anchor because V1 cannot prove V2 publication or anchor semantics. Sort all node/page/evidence ID arrays.
10. Preserve V1 source output language when present, set generation mode to `v1-adapter`, and retain graph digest/commit fields that pass the V1 schema.
11. Set Main Readiness to `blocked` with `旧版知识库需重新生成后才能评估主干可读性` and set reference coverage to partial with zero/zero unknown totals.
12. Validate the converted object with `parseWikiIndexV2` before returning it.
13. `parseWikiIndex` tries a structurally valid V2 first, then a structurally valid V1. If `version` is 2, return V2 validation errors and never try V1. If neither shape matches, return the V1 schema field errors when version is 1, otherwise return `不支持的 Wiki 索引版本`.

- [ ] **Step 3: Export, verify, and commit**

Add `export * from "./wiki-v1-adapter.js";` to the knowledge-base barrel.

```bash
pnpm --filter @understand-code/core exec vitest run src/knowledge-base/__tests__/wiki-contract.test.ts src/knowledge-base/__tests__/wiki-v1-adapter.test.ts
pnpm --filter @understand-code/core build
git add packages/core/src/knowledge-base/wiki-v1-adapter.ts packages/core/src/knowledge-base/__tests__/wiki-v1-adapter.test.ts
git add -p -- packages/core/src/knowledge-base/index.ts
git diff --check --cached
git commit -m "feat(kb): adapt legacy wiki indexes"
```

---

## Task 3: Persist route configuration and apply deterministic precedence

**Files**

- Create: `packages/core/src/knowledge-base/route-overrides.ts`
- Create: `packages/core/src/knowledge-base/__tests__/route-overrides.test.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/persistence/index.ts`
- Modify: `packages/core/src/persistence/persistence.test.ts`
- Modify: `packages/core/src/knowledge-base/index.ts`

- [ ] **Step 1: Write the failing route test**

Create `route-overrides.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyRouteOverrides, type RoutePageInput } from "../route-overrides.js";

const pages: RoutePageInput[] = [
  { id: "a", role: "reference" },
  { id: "b", role: "featured", route: { order: 9, stage: "flow" } },
  { id: "c", role: "featured", route: { order: 10, stage: "implementation" } },
];

describe("route overrides", () => {
  it("applies hide before pin and order while preserving hidden pages as references", () => {
    const result = applyRouteOverrides(pages, {
      route: { hide: ["b", "b"], pin: ["a", "b", "missing"], order: ["c", "a", "b", "missing"] },
    });
    expect(result.pages.map((page) => [page.id, page.role, page.route?.order])).toEqual([
      ["c", "featured", 0], ["a", "featured", 1], ["b", "reference", undefined],
    ]);
    expect(result.warnings).toEqual(expect.arrayContaining([
      "页面 b 同时出现在 hide 与 pin 中，已按 hide 处理",
      "路由配置引用了不存在的页面 missing",
    ]));
  });
});
```

Add this complete persistence test inside the existing `saveConfig / loadConfig` describe block:

```ts
it("round-trips knowledge-base route configuration", () => {
  const config = {
    autoUpdate: false,
    outputLanguage: "zh-CN",
    knowledgeBase: {
      businessTerms: ["表单校验"],
      entryNodeIds: ["function:src/a.ts:run"],
      route: { pin: ["a"], hide: ["b"], order: ["a"] },
    },
  };
  saveConfig(tempDir, config);
  expect(loadConfig(tempDir)).toEqual(config);
});
```

Run:

```bash
pnpm --filter @understand-code/core exec vitest run src/knowledge-base/__tests__/route-overrides.test.ts src/persistence/persistence.test.ts
```

Expected: FAIL because the route module/config fields do not exist yet.

- [ ] **Step 2: Replace, do not duplicate, `ProjectConfig`**

In `packages/core/src/types.ts`, add `KnowledgeBaseProjectConfig` immediately before the existing `ProjectConfig`, then replace the existing `ProjectConfig` declaration with:

```ts
export interface KnowledgeBaseProjectConfig {
  businessTerms?: string[];
  entryNodeIds?: string[];
  route?: { pin?: string[]; hide?: string[]; order?: string[] };
}

export interface ProjectConfig {
  autoUpdate: boolean;
  outputLanguage?: string;
  knowledgeBase?: KnowledgeBaseProjectConfig;
}
```

There must be exactly one `ProjectConfig` declaration after this edit.

Change `DEFAULT_CONFIG` in persistence to `{ autoUpdate: false, outputLanguage: "zh-CN" }`. Update the two existing missing/corrupt-config assertions from `en` to `zh-CN`. Keep `saveConfig` as complete JSON serialization. In `loadConfig`, reject non-object JSON and normalize all knowledge-base arrays rather than casting unchecked JSON:

```ts
const stringArray = (value: unknown): string[] | undefined => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))]
  : undefined;
const raw = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_CONFIG };
const record = raw as Record<string, unknown>;
const knowledgeRecord = record.knowledgeBase && typeof record.knowledgeBase === "object" && !Array.isArray(record.knowledgeBase)
  ? record.knowledgeBase as Record<string, unknown>
  : undefined;
const routeRecord = knowledgeRecord?.route && typeof knowledgeRecord.route === "object" && !Array.isArray(knowledgeRecord.route)
  ? knowledgeRecord.route as Record<string, unknown>
  : undefined;
const knowledgeBase = knowledgeRecord ? {
  ...(stringArray(knowledgeRecord.businessTerms) ? { businessTerms: stringArray(knowledgeRecord.businessTerms) } : {}),
  ...(stringArray(knowledgeRecord.entryNodeIds) ? { entryNodeIds: stringArray(knowledgeRecord.entryNodeIds) } : {}),
  ...(routeRecord ? { route: {
    ...(stringArray(routeRecord.pin) ? { pin: stringArray(routeRecord.pin) } : {}),
    ...(stringArray(routeRecord.hide) ? { hide: stringArray(routeRecord.hide) } : {}),
    ...(stringArray(routeRecord.order) ? { order: stringArray(routeRecord.order) } : {}),
  } } : {}),
} : undefined;
return {
  autoUpdate: typeof record.autoUpdate === "boolean" ? record.autoUpdate : DEFAULT_CONFIG.autoUpdate,
  outputLanguage: typeof record.outputLanguage === "string" ? record.outputLanguage : DEFAULT_CONFIG.outputLanguage,
  ...(knowledgeBase ? { knowledgeBase } : {}),
};
```

`applyRouteOverrides` still guards with `Array.isArray` because callers may construct configuration without persistence. Malformed arrays are treated as empty and do not abort unrelated generation.

- [ ] **Step 3: Implement route override normalization**

Create `route-overrides.ts` with:

```ts
import type { KnowledgeBaseProjectConfig } from "../types.js";
import type { RouteStage, WikiDocumentRole } from "./wiki-contract.js";

export interface RoutePageInput {
  id: string;
  role: WikiDocumentRole;
  route?: { order: number; stage: RouteStage };
}

export interface RouteOverrideResult { pages: RoutePageInput[]; warnings: string[] }
export function applyRouteOverrides(
  input: readonly RoutePageInput[],
  config: KnowledgeBaseProjectConfig,
): RouteOverrideResult;
```

`applyRouteOverrides(input, config)` must execute this exact algorithm:

1. Clone every input page; never mutate the caller's array.
2. Normalize each config list by accepting only strings, trimming them, removing empty values and duplicates while preserving first occurrence.
3. Emit one warning for every configured ID absent from input, regardless of which list contains it.
4. For IDs present in both hide and pin, emit the conflict warning and apply hide.
5. Hidden pages become `reference` and lose `route`.
6. Pinned, non-hidden pages become `featured`; if they lacked a route, assign stage `implementation` temporarily.
7. Sort featured pages by configured order prefix, then existing route order, then page ID. Hidden IDs mentioned in order remain hidden.
8. Reassign featured route order contiguously from zero without changing route stage.
9. Return featured pages first in route order, followed by reference/maintenance pages in original input order.

Export it through `knowledge-base/index.ts`.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @understand-code/core exec vitest run src/knowledge-base/__tests__/route-overrides.test.ts src/persistence/persistence.test.ts
pnpm --filter @understand-code/core build
git add packages/core/src/knowledge-base/route-overrides.ts packages/core/src/knowledge-base/__tests__/route-overrides.test.ts
git add -p -- packages/core/src/types.ts packages/core/src/persistence/index.ts packages/core/src/persistence/persistence.test.ts packages/core/src/knowledge-base/index.ts
git diff --check --cached
git commit -m "feat(kb): support guided route overrides"
```

---

## Task 4: Separate guided planning from exhaustive references

**Files**

- Create: `packages/core/src/knowledge-base/featured-planner.ts`
- Create: `packages/core/src/knowledge-base/__tests__/featured-planner.test.ts`
- Modify: `packages/core/src/knowledge-base/types.ts`
- Modify: `packages/core/src/knowledge-base/planner.ts`
- Modify: `packages/core/src/knowledge-base/generate.ts`
- Modify: `packages/core/src/knowledge-base/file-doc-planner.ts`
- Modify: `packages/core/src/knowledge-base/merge.ts`
- Modify: `packages/core/src/knowledge-base/markdown.ts`
- Modify: `packages/core/src/knowledge-base/paths.ts`
- Modify: `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`
- Modify: `packages/core/src/knowledge-base/__tests__/file-doc-planner.test.ts`
- Modify: `packages/core/src/knowledge-base/__tests__/merge.test.ts`

- [ ] **Step 1: Write a complete failing planner test**

Create `featured-planner.test.ts` with this self-contained graph and plans:

```ts
import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "../../types.js";
import { buildKnowledgeBaseProfile } from "../profile.js";
import { buildFeaturedPlan } from "../featured-planner.js";
import type { BusinessCapabilityProfile, FileDocPlan, TopicPlan } from "../types.js";

const graph: KnowledgeGraph = {
  version: "1.0.0",
  project: { name: "demo", languages: ["typescript"], frameworks: [], description: "演示服务", analyzedAt: "2026-07-11T00:00:00.000Z", gitCommitHash: "abc" },
  nodes: [
    { id: "file:src/a.ts", type: "file", name: "a.ts", filePath: "src/a.ts", summary: "请求入口文件", tags: ["entry"], complexity: "moderate" },
    { id: "function:src/a.ts:run", type: "function", name: "run", filePath: "src/a.ts", lineRange: [1, 5], summary: "接收请求并调用策略", tags: ["entry"], complexity: "complex" },
    { id: "function:src/a.ts:helper", type: "function", name: "helper", filePath: "src/a.ts", lineRange: [7, 9], summary: "格式化辅助函数", tags: ["helper"], complexity: "simple" },
    { id: "function:src/a.ts:isolated", type: "function", name: "孤立入口", filePath: "src/a.ts", lineRange: [11, 13], summary: "没有下游行为关系", tags: ["entry"], complexity: "moderate" },
    { id: "file:src/service.ts", type: "file", name: "service.ts", filePath: "src/service.ts", summary: "策略服务", tags: ["service"], complexity: "moderate" },
    { id: "function:src/service.ts:apply", type: "function", name: "apply", filePath: "src/service.ts", lineRange: [1, 8], summary: "应用策略并读取配置", tags: ["strategy"], complexity: "complex" },
    { id: "config:config/rule.json", type: "config", name: "rule.json", filePath: "config/rule.json", lineRange: [1, 4], summary: "策略配置", tags: ["config"], complexity: "simple" },
  ],
  edges: [
    { source: "file:src/a.ts", target: "function:src/a.ts:run", type: "contains", direction: "forward", weight: 1 },
    { source: "file:src/a.ts", target: "function:src/a.ts:helper", type: "contains", direction: "forward", weight: 1 },
    { source: "file:src/a.ts", target: "function:src/a.ts:isolated", type: "contains", direction: "forward", weight: 1 },
    { source: "file:src/service.ts", target: "function:src/service.ts:apply", type: "contains", direction: "forward", weight: 1 },
    { source: "function:src/a.ts:run", target: "function:src/service.ts:apply", type: "calls", direction: "forward", weight: 1 },
    { source: "function:src/service.ts:apply", target: "config:config/rule.json", type: "reads_from", direction: "forward", weight: 1 },
  ],
  layers: [{ id: "layer:api", name: "入口层", description: "请求入口", nodeIds: ["file:src/a.ts"] }, { id: "layer:service", name: "服务层", description: "策略实现", nodeIds: ["file:src/service.ts"] }],
  tour: [],
};

const businessProfile: BusinessCapabilityProfile = { facts: [], capabilities: [], totalFacts: 0, sourceBackedFacts: 0 };
const fileDocPlan: FileDocPlan = {
  tasks: [{
    batchIndex: 1, taskIndex: 0, fileNodeId: "file:src/a.ts", filePath: "src/a.ts", layerId: "layer:api",
    documentPath: "文件文档/src-a.ts.md", sourceNodeIds: ["file:src/a.ts"], referenceKind: "code",
    functionNodeIds: ["function:src/a.ts:run", "function:src/a.ts:helper", "function:src/a.ts:isolated"],
    classNodeIds: [], incomingEdgeIds: [], outgoingEdgeIds: [], neighborNodeIds: [],
    sourceSnapshot: { filePath: "src/a.ts", exists: true, text: "export function run() {}\nexport function helper() {}\nexport function isolated() {}", totalLines: 3, nonEmptyLines: 3 },
    sourceReadMode: "full", batchingReason: "test",
  }, {
    batchIndex: 2, taskIndex: 1, fileNodeId: "file:src/service.ts", filePath: "src/service.ts", layerId: "layer:service",
    documentPath: "文件文档/src-service.ts.md", sourceNodeIds: ["file:src/service.ts"], referenceKind: "code",
    functionNodeIds: ["function:src/service.ts:apply"], classNodeIds: [],
    incomingEdgeIds: [], outgoingEdgeIds: [], neighborNodeIds: [],
    sourceSnapshot: { filePath: "src/service.ts", exists: true, text: "export function apply() {}", totalLines: 1, nonEmptyLines: 1 },
    sourceReadMode: "full", batchingReason: "test",
  }],
  batches: [], warnings: [],
};
const topicPlan: TopicPlan = { topics: [], batches: [], warnings: [] };

describe("featured planning", () => {
  it("omits pseudo-flows, keeps helpers in file anchors, and avoids module bulk direct coverage", () => {
    const plan = buildFeaturedPlan({
      profile: buildKnowledgeBaseProfile(graph), businessProfile, fileDocPlan, topicPlan,
      config: { entryNodeIds: ["function:src/a.ts:run", "function:src/a.ts:isolated"] },
    });
    expect(plan.documents.find((doc) => doc.title.includes("孤立入口") && doc.category === "flow")).toBeUndefined();
    expect(plan.documents.find((doc) => doc.category === "module")?.directNodeIds).not.toContain("function:src/a.ts:helper");
    expect(plan.documents.find((doc) => doc.path === "文件文档/src-a.ts.md")?.symbolAnchors).toContainEqual({ nodeId: "function:src/a.ts:helper", anchor: "helper" });
    expect(plan.documents.filter((doc) => doc.role === "featured").length).toBeLessThanOrEqual(40);
    expect(plan.warnings).toContain("孤立入口没有至少三个可验证行为阶段，已移入待分析状态");
  });
});
```

Run:

```bash
pnpm --filter @understand-code/core exec vitest run src/knowledge-base/__tests__/featured-planner.test.ts
```

Expected: FAIL with module-resolution failure for `featured-planner.js`.

- [ ] **Step 2: Replace the planning document types completely**

In `knowledge-base/types.ts`, add:

```ts
export interface SymbolAnchor { nodeId: string; anchor: string }
export type ReferenceTemplateKind = "code" | "configuration" | "schema" | "documentation" | "test";
export type KnowledgeDocumentRole = "featured" | "reference" | "maintenance";
export type KnowledgeDocumentCategory = "overview" | "capability" | "flow" | "module" | "topic" | "file" | "quality" | "coverage" | "other";
export interface DocumentRoute { order: number; stage: "purpose" | "flow" | "rule" | "implementation" | "evidence" }
```

Replace, rather than duplicate, `PlannedDocument` and `GeneratedDocument` with:

```ts
export interface PlannedDocument {
  id: string; path: string; title: string; summary: string;
  category: KnowledgeDocumentCategory; role: KnowledgeDocumentRole;
  directNodeIds: string[]; contextNodeIds: string[]; symbolAnchors: SymbolAnchor[];
  referenceKind?: ReferenceTemplateKind;
  route?: DocumentRoute; representedEdgeIds: string[]; reason: string;
}
export interface GeneratedDocument extends PlannedDocument {
  content: string; sourceEvidence: SourceEvidence[]; searchTerms: string[];
  quality: "verified" | "generated" | "needs-review" | "failed";
  generationStatus: "complete" | "partial" | "failed";
  qualityIssues: string[];
  verification?: { method: "human" | "external"; verifiedAt: string; verifier?: string };
}
export interface FeaturedPlan {
  documents: PlannedDocument[]; warnings: string[];
  requiredRouteStages: Array<DocumentRoute["stage"]>;
}
```

Remove `coveredNodeIds` and `coverageLevel` specifically from `PlannedDocument`/`GeneratedDocument`, remove the old `KnowledgeBaseDocumentCategory`, and replace `DocumentPlan.nodeCoverage/coverageReasons` with `FeaturedPlan`. Keep `TopicPlanItem.coveredNodeIds`, because it is an internal writer-input neighborhood until topic merge converts it to direct/context arrays. Do not retain a second document-coverage channel.

Extend `FileDocTask` with `sourceNodeIds: string[]` and `referenceKind: ReferenceTemplateKind`. Keep `fileNodeId` as the stable owner ID for queue compatibility. Extend `FileWriterDocument` with the same `referenceKind`; merge must require it to equal the task.

Extend `KnowledgeBaseOptions` with:

```ts
knowledgeBaseConfig?: import("../types.js").KnowledgeBaseProjectConfig;
generationMode?: "writer" | "deterministic";
```

- [ ] **Step 3: Implement stable IDs, anchors, flow stages, and the complete plan**

Create `featured-planner.ts` with this public input:

```ts
export interface BuildFeaturedPlanInput {
  profile: ProjectProfile;
  businessProfile: BusinessCapabilityProfile;
  fileDocPlan: FileDocPlan;
  topicPlan: TopicPlan;
  config: KnowledgeBaseProjectConfig;
}
export function buildFeaturedPlan(input: BuildFeaturedPlanInput): FeaturedPlan;
```

In `paths.ts`, export `businessCapabilityDocumentPath` (move the existing private implementation from `markdown.ts`) and add stable `KB_PATHS.sourceEntry`, `KB_PATHS.qualityStatus`, and `KB_PATHS.referenceCoverage` paths. Both planner and renderer must use these helpers; do not reproduce path algorithms in two modules.

Implement these algorithms:

1. `pageId(path)` returns `page:${encodeURIComponent(path.replace(/\\/g, "/"))}`.
2. `symbolAnchors(task, profile)` sorts function/class IDs, slugs each node name with existing `slugPath`, and adds `-2`, `-3`, etc. for duplicate slugs within one file.
3. `flowStages(profile, entryId)` breadth-first traverses only `calls`, `triggers`, `reads_from`, `writes_to`, `transforms`, `validates`, and `configures`, caps at 32 nodes and depth 4, and returns node IDs in discovery order.
4. Build entry candidates from the union of `profile.entryCandidates` and valid `config.entryNodeIds`. A configured node already detected by the profile keeps its detected entry type; any other existing configured function/class gets type `generic`; a missing configured node produces `配置入口不存在：<id>` and is skipped.
5. A flow is publishable only when it contains at least three stages and at least two traversed behavior edges. Otherwise append the exact warning used by the test.
6. Create the document records using the field table below; every unspecified array is an explicit empty array, never an inferred fallback.
7. Cap featured documents at 40 by dropping lowest-ranked topics first, then lowest-ranked modules beyond the first, then lowest-ranked capabilities beyond the first. Never drop overview or source entry.
8. Convert planned documents to `RoutePageInput`, apply `applyRouteOverrides`, merge role/route results back by ID, then revalidate that overview and source entry are not hidden. If either was hidden, keep it reference and mark the corresponding required route stage absent so Main Readiness blocks rather than silently overriding user config.
9. Return documents sorted as featured route order, reference path, then maintenance path.

| Kind | Path/category/role | Direct IDs | Context IDs | Route and represented edges |
|---|---|---|---|---|
| Project overview | `KB_PATHS.projectOverview`, overview, featured | publishable entry node IDs | entry file IDs plus core layer file IDs | purpose; behavior edges whose endpoints are listed |
| Capability | `businessCapabilityDocumentPath(title,id)`, capability, featured | distinct non-empty `evidence.nodeId` values | remaining `relatedNodeIds` | rule; behavior edges between direct/context IDs |
| Flow | `businessFlowDocumentPath(entryName, filePath when needed)`, flow, featured | ordered `flowStages` | immediate graph neighbors outside the stages | flow; exactly the traversed behavior-edge IDs |
| Module | `moduleDocumentPath(layer.name)`, module, featured | matching explicit module node ID, otherwise empty | layer file IDs | implementation; cross-file edges inside the layer |
| Required topic | existing topic path, topic, featured | `topicNodeId` | `coveredNodeIds` except topic ID | implementation; behavior edges among covered IDs |
| Source entry | `KB_PATHS.sourceEntry`, overview, featured | distinct entry file IDs | entry function/type IDs | evidence; containment and entry behavior edges |
| File reference | task `documentPath`, file, reference, task `referenceKind` | all task source nodes + all function/class IDs | task neighbor IDs excluding direct IDs | no route; task incoming/outgoing represented edge IDs |
| Quality/coverage | `KB_PATHS.qualityStatus` / `KB_PATHS.referenceCoverage`, quality/coverage, maintenance | empty | empty | no route or represented edges |

For every record, `id=pageId(path)`, `summary` uses the source graph/capability summary and falls back to a concrete Chinese sentence naming the document, and `reason` names the exact planner rule. Capability ranking is evidence confidence (`high`, `medium`, `low`), score descending, then ID, capped at six and excluding `example-only`. Flows are capped at twelve and sorted by entry type (`api`, `event`, `job`, `cli`, `lifecycle`, `generic`) then node ID. Modules are capped at eight and sorted by layer ID. Only required-tier topics are featured and they fill the remaining capacity. Assign contiguous route order in the fixed sequence overview, capabilities, flows, modules, topics, source entry.

Remove the old standalone file/function/class/call/AI Markdown index plans and render branches. `search-index.json` and the hierarchical reference plan replace them. Keep project overview, supported capabilities/flows/modules/topics, file references, source entry, pending/quality, and coverage pages only.

Change `buildFileDocPlan` to group path-bearing graph nodes of type `file`, `config`, `schema`, and `document` by normalized file path. Create exactly one task per path. Choose owner priority file, config, schema, document, then node ID; store all same-path IDs in `sourceNodeIds`. Determine template kind as test for test/spec/fixture paths, otherwise configuration for config/env/yaml/json/toml paths or config owners, schema for schema owners, documentation for document/Markdown owners, otherwise code. Existing “one task per file node” tests become “every file node belongs to exactly one task”; add config/schema/document assertions to the same test file.

Update merge owner validation to accept task owners of type file/config/schema/document and to require every `sourceNodeId` to share the normalized task file path. Function/class ownership rules remain restricted to actual file owners. A configuration/schema/document task has empty function/class arrays unless the graph explicitly maps children through the same file path.

Update `CoverageReport.documentCounts` to `Record<KnowledgeDocumentCategory, number>`. In legacy coverage-report calculations, replace document `coveredNodeIds` reads with `directNodeIds`; calculate function/class reference coverage from file `symbolAnchors`, topic coverage from topic direct IDs, and relationship coverage from `representedEdgeIds`. These legacy report fields remain diagnostic inputs for the generation report and must not be used to construct V2 node relationships.

Modify `planner.ts`: keep `selectTopicCandidates` and `buildTopicPlan`; delete the old `buildDocumentPlan`, `addCoverage`, and one-node flow planning. Export `flowStages` only from `featured-planner.ts`.

Modify generation order to:

```text
profile -> fileDocPlan -> businessProfile -> file writer merge -> topicPlan
-> topic writer merge -> buildFeaturedPlan -> materialize non-status documents
-> publication evaluation -> coverage report -> render quality/coverage status documents
```

Do not retain the current preliminary/final double-render loop. Quality/coverage status pages are generated last from the already evaluated corpus, always have maintenance role, never contribute to readiness/reference coverage, and therefore do not create a reporting cycle.

Extract the shared final half into `generate.ts` so deterministic generation and phased writer finalization cannot drift:

```ts
export interface MaterializeKnowledgeBaseInput {
  profile: ProjectProfile;
  fileDocPlan: FileDocPlan;
  businessCapabilityProfile: BusinessCapabilityProfile;
  topicPlan: TopicPlan;
  merged: MergeKnowledgeBaseWriterOutputsResult;
  options: KnowledgeBaseOptions;
}
export function materializeKnowledgeBase(input: MaterializeKnowledgeBaseInput): GeneratedKnowledgeBase;
```

`materializeKnowledgeBase` performs `buildFeaturedPlan -> non-status rendering -> corpus publication evaluation -> coverage report -> status rendering` exactly once. `generateKnowledgeBase` creates deterministic writer outputs and delegates to it. The phased script builds/validates real writer outputs and delegates to the same function; it must not reproduce renderer, publication, or coverage logic.

Replace `DocumentPlan` with `FeaturedPlan` in `GeneratedKnowledgeBase.plan` and every renderer signature. Remove `fileDocuments` and `topicDocuments` from `MergeKnowledgeBaseWriterOutputsResult`; merge remains responsible for validation/retry and returns accepted writer DTOs only. This avoids a cycle because the complete featured/reference plan is built after file and topic writer acceptance.

Add one materialization pass in `markdown.ts` after `buildFeaturedPlan`: it iterates every non-status planned document and performs an exact join. File plans join `acceptedFileWriterDocuments` by `fileNodeId`; topic plans join `acceptedTopicWriterDocuments` by `topicNodeId`; overview/capability/module/flow/source-entry plans use their dedicated renderers. The materialized document always spreads planned ID, role, direct/context IDs, anchors, route, represented edges, summary, and reason, then adds writer/rendered content and source evidence. A missing accepted writer for a planned file/topic is a generation error and produces no publishable document; it is never replaced with generic prose. `renderBusinessCapabilityDocuments` receives the matching planned capability record and must not construct a second path or mapping. Quality/coverage planned records are rendered only after evaluated coverage is computed.

Rewrite support renderers around the Task 5 required-section contract rather than old inventory prose:

- Project overview derives purpose/boundaries from project metadata, lifecycle from publishable flows, modules from layer profiles, configuration/tests from graph node and edge types, route links from the final plan, and at least six distinct source excerpts when available.
- Capability pages group only primary/supporting facts, list exact triggers/branches/fields from their fact kinds, keep example-only facts in a clearly labelled context section, and attach each fact's node-specific evidence.
- Flow pages render the ordered static behavior path, typed edges, trigger/exclusion evidence, normal/error/fallback branches found in source facts, and explicitly state when static reachability cannot prove runtime timing.
- Module pages render responsibility and non-responsibility, entry/output edges, at most fifteen core files ranked by degree, dependent layers, configuration/test boundaries, and exact excerpts from those files.
- Source entry renders entry files/functions, startup or request paths, configuration, tests, recommended next pages, and exact entry excerpts.
- Quality/coverage pages render only computed statuses, failures, missing IDs, retry information, and recovery steps.

Every support-renderer evidence record sets `claim` to the concrete Chinese conclusion beside the cited excerpt. When a required fact, claim, or evidence count is unavailable, render a concrete `证据不足：<missing fact>` statement and let Task 5 fail or demote the document. Never substitute generic responsibility prose to force publication.

- [ ] **Step 4: Update regressions, verify, and commit**

Update existing tests that asserted module `coveredNodeIds` to assert context IDs. Update document count tests to distinguish featured, reference, and maintenance. Where an existing graph fixture contains config/schema/document nodes with file paths, add those exact paths to its `sourceFiles` fixture when the test expects complete source coverage; tests intentionally exercising missing sources must assert the new missing reference task instead.

```bash
pnpm --filter @understand-code/core exec vitest run src/knowledge-base/__tests__/featured-planner.test.ts src/knowledge-base/__tests__/file-doc-planner.test.ts src/knowledge-base/__tests__/knowledge-base.test.ts src/knowledge-base/__tests__/merge.test.ts
pnpm --filter @understand-code/core build
git add packages/core/src/knowledge-base/featured-planner.ts packages/core/src/knowledge-base/__tests__/featured-planner.test.ts
git add -p -- packages/core/src/knowledge-base/types.ts packages/core/src/knowledge-base/planner.ts packages/core/src/knowledge-base/generate.ts packages/core/src/knowledge-base/file-doc-planner.ts packages/core/src/knowledge-base/merge.ts packages/core/src/knowledge-base/markdown.ts packages/core/src/knowledge-base/paths.ts packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts packages/core/src/knowledge-base/__tests__/file-doc-planner.test.ts packages/core/src/knowledge-base/__tests__/merge.test.ts
git diff --check --cached
git commit -m "feat(kb): separate guided and reference planning"
```

---

## Task 5: Enforce category-specific publication gates

**Files**

- Create: `packages/core/src/knowledge-base/publication-quality.ts`
- Create: `packages/core/src/knowledge-base/__tests__/publication-quality.test.ts`
- Modify: `packages/core/src/knowledge-base/writer-contracts.ts`
- Modify: `packages/core/src/knowledge-base/types.ts`
- Modify: `packages/core/src/knowledge-base/quality.ts`
- Modify: `packages/core/src/knowledge-base/markdown.ts`
- Modify: `packages/core/src/knowledge-base/merge.ts`
- Modify: `packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts`
- Modify: `packages/core/src/knowledge-base/__tests__/merge.test.ts`
- Modify: `agents/kb-file-writer.md`
- Modify: `agents/kb-topic-writer.md`

- [ ] **Step 1: Write complete failing gate tests**

Create `publication-quality.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { evaluatePublication, type PublicationDocument } from "../publication-quality.js";

describe("publication quality", () => {
  it("rejects a pseudo-flow with generic prose and no evidence", () => {
    const document: PublicationDocument = {
      path: "业务流程/run.md", title: "run 流程", category: "flow", role: "featured",
      content: "# run\n\n## 目标与触发\n承担核心逻辑。", directNodeIds: ["function:src/a.ts:run"],
      representedEdgeIds: [], symbolAnchors: [],
    };
    const result = evaluatePublication(document, []);
    expect(result).toEqual({
      quality: "failed", publishAsFeatured: false,
      issues: expect.arrayContaining(["流程缺少至少三个可验证阶段", "正文包含空泛模板语句", "正文缺少有效源码证据"]),
    });
  });

  it("accepts a Chinese file reference with exact evidence for the file and every symbol", () => {
    const document: PublicationDocument = {
      path: "文件文档/src-a.ts.md", title: "src/a.ts", category: "file", role: "reference", referenceKind: "code",
      content: [
        "# src/a.ts", "", "## 文件职责", "接收请求、调用策略并返回结构化结果。", "",
        "## 输入、输出与关键字段", "读取 `ctx.userId`，输出 `result.items`。", "",
        "## 规则、分支与状态变化", "当配置缺失时返回空列表，并记录降级状态。", "",
        "## 配置、依赖与副作用", "读取 `config/rule.json`，不写持久化存储。", "",
        "## 异常、测试与改动风险", "空输入测试覆盖降级分支；修改字段会影响调用方。", "",
        "## 函数与类型", '<a id="run"></a>', "`run` 执行入口、校验和结果返回。", "",
        "## 源码证据", "`src/a.ts:1-5` 对应入口和降级分支。",
      ].join("\n"),
      directNodeIds: ["file:src/a.ts", "function:src/a.ts:run"],
      representedEdgeIds: ["calls:function:src/a.ts:run->function:src/b.ts:apply"],
      symbolAnchors: [{ nodeId: "function:src/a.ts:run", anchor: "run" }],
    };
    const result = evaluatePublication(document, [{
      nodeId: "file:src/a.ts", filePath: "src/a.ts", lineRange: [1, 5], excerpt: "export function run() { return []; }", claim: "该文件提供运行入口。",
    }, {
      nodeId: "function:src/a.ts:run", filePath: "src/a.ts", lineRange: [1, 5], excerpt: "export function run() { return []; }", claim: "run 负责入口处理和降级返回。",
    }]);
    expect(result).toEqual({ quality: "generated", publishAsFeatured: false, issues: [] });
  });
});
```

Run:

```bash
pnpm --filter @understand-code/core exec vitest run src/knowledge-base/__tests__/publication-quality.test.ts
```

Expected: FAIL with module-resolution failure for `publication-quality.js`.

- [ ] **Step 2: Implement one authoritative evaluator**

Create `publication-quality.ts` with:

```ts
import type { KnowledgeDocumentCategory, KnowledgeDocumentRole, ReferenceTemplateKind, SymbolAnchor } from "./types.js";

export interface PublicationDocument {
  path: string; title: string; category: KnowledgeDocumentCategory; role: KnowledgeDocumentRole;
  content: string; directNodeIds: string[]; representedEdgeIds: string[]; symbolAnchors: SymbolAnchor[];
  referenceKind?: ReferenceTemplateKind;
}
export interface PublicationEvidence { nodeId: string; filePath: string; lineRange: [number, number]; excerpt: string; claim: string }
export interface PublicationDecision {
  quality: "generated" | "needs-review" | "failed";
  publishAsFeatured: boolean;
  issues: string[];
}
```

Use these exact required level-two headings:

```ts
const REQUIRED_SECTIONS = {
  overview: ["项目目标与边界", "完整生命周期", "核心模块", "配置、依赖与测试", "推荐阅读路线", "源码证据"],
  capability: ["业务场景与触发", "规则与分支", "输入输出与状态变化", "异常与降级", "模块实现", "源码证据"],
  flow: ["目标与触发", "排除条件", "执行阶段", "规则、分支与数据变化", "异常、回退与可观测性", "源码证据"],
  module: ["职责与非职责", "入口、输出与核心文件", "依赖与主要流程", "状态、配置与测试边界", "风险与排查入口", "源码证据"],
  topic: ["为什么关键", "完整条件与跳过规则", "输入输出与状态变化", "算法、分支与降级", "依赖、测试与可观测性", "源码证据"],
  "file:code": ["文件职责", "输入、输出与关键字段", "规则、分支与状态变化", "配置、依赖与副作用", "异常、测试与改动风险", "函数与类型", "源码证据"],
  "file:configuration": ["配置目的与作用域", "配置项、类型与默认值", "读取位置与生效顺序", "缺失、非法值与降级", "测试与改动风险", "源码证据"],
  "file:schema": ["数据模型与边界", "字段、类型与约束", "读写方与生命周期", "校验、迁移与兼容性", "测试与改动风险", "源码证据"],
  "file:documentation": ["文档目的与读者", "关键结论", "链接与外部依赖", "与代码的对应关系", "过期风险与维护入口", "源码证据"],
  "file:test": ["被测行为与范围", "用例、输入与断言", "Fixture、Mock 与外部依赖", "失败分支与回归风险", "尚未覆盖的行为", "与生产代码的对应关系", "源码证据"],
} as const;
```

Evaluation algorithm, in this order:

1. Extract level-two headings and reject every missing required section. Non-file pages select by category; file pages select by `file:<referenceKind>` and reject a missing/unknown kind. Use `正文缺少必需章节：<heading>`.
2. Count these generic phrases: `承担核心逻辑`, `处理相关能力`, `接收上游传入的业务上下文`, `主要把处理结果返回给调用方`. Any phrase occurrence adds `正文包含空泛模板语句` once and is a hard failure.
3. Strip fenced/inline code, URLs, paths, and identifiers from prose. Require at least 80 Han characters for featured pages and 40 for reference pages. Reject the common Traditional-only character set `體臺萬與為後發裡這麼說從個還` when it occurs outside code.
4. Valid evidence requires non-empty `nodeId`, `filePath`, `excerpt`, and Chinese `claim`, plus a positive ordered range. The claim is the exact conclusion supported by that excerpt, not a section label.
5. Require at least one valid evidence record for every direct node. Evidence for another node never satisfies the requirement. No valid evidence at all adds `正文缺少有效源码证据`; a missing direct-node mapping adds `源码证据未覆盖直接讲解节点：<nodeId>`.
6. Evidence minimums: overview 6, flow 5, module 5, topic 3 distinct `(filePath,lineRange)` groups, capability 3, file one per direct node.
7. A flow additionally requires at least three direct stage nodes and at least two represented behavior edges; failure adds `流程缺少至少三个可验证阶段` once.
8. A file additionally requires every symbol anchor to occur exactly once as `id="<anchor>"` in the Markdown; failure adds `文件正文缺少唯一符号锚点：<nodeId>`.
9. A featured page with any issue returns `failed` and `publishAsFeatured:false`. A reference page with only insufficient prose length returns `needs-review`; missing sections, bad mappings, missing evidence, generic prose, non-Chinese prose, or missing anchors returns `failed`.
10. With no issues, return `generated`; only a separate explicit verification record in Task 6 may upgrade it to `verified`.

Also export `evaluatePublicationCorpus(documentsWithEvidence)`. It first calls `evaluatePublication` for every document, then normalizes non-heading/non-table/non-code lines with at least 32 meaningful characters. When the same normalized line occurs in at least `max(5, ceil(documentCount * 0.2))` documents, append `正文包含跨文档重复模板语句` to each affected document and mark it failed. Move the existing repeated-corpus helpers from `quality.ts` into this module. Keep `summarizeMarkdownQuality` only as a compatibility wrapper over `evaluatePublicationCorpus`; there must be one phrase list and one final decision path.

- [ ] **Step 3: Integrate writer contracts and deterministic renderers**

Keep `parseFileWriterBatchOutput` and `parseTopicWriterBatchOutput` as context-free structural parsers: require all writer DTO fields, required headings, non-empty evidence arrays, and evidence items with `nodeId`, ordered `lineRange`, and non-empty `excerpt`. File parsing selects the required heading set from the output `referenceKind`. Update the existing complete writer-test helpers with those exact fields and add one structural case for each non-code reference kind.

Do not make every historical `SourceEvidence` field globally required, because business-fact discovery can legitimately retain partial observations. Add and use this writer-only subtype in `knowledge-base/types.ts`:

```ts
export interface DirectSourceEvidence extends SourceEvidence {
  nodeId: string;
  lineRange: [number, number];
  excerpt: string;
  claim: string;
}
```

Add optional `claim?: string` to base `SourceEvidence`, then change `FileWriterDocument.sourceEvidence` and `TopicWriterDocument.evidence` to `DirectSourceEvidence[]`. File writer output must contain exact evidence for the file node and every covered function/class node. Topic output must contain at least three distinct evidence groups and at least one must name `topicNodeId`.

Run semantic publication evaluation inside `mergeKnowledgeBaseWriterOutputs`, where planned graph context exists. Extend `MergeKnowledgeBaseWriterOutputsInput` with optional `topicPlan`. For each file candidate, compute the exact file + symbol direct IDs and stable anchors from its `FileDocTask`, then evaluate category file/reference. For each topic candidate, find its `TopicPlanItem`, evaluate category topic with direct ID `topicNodeId`, and use required tier as featured and extended tier as reference. A failed decision adds the batch to the existing retry plan and excludes it from accepted writer documents. Missing topic-plan context is a topic merge error.

After materializing support and accepted writer documents, call `evaluatePublicationCorpus` once over the whole corpus. For every `failed` or `needs-review` result, set document quality accordingly, set role to `maintenance`, clear route, and add all issues; it must not count as featured or reference coverage. For a successful result, retain the planned role and route and set quality `generated`. Explicit verification metadata may upgrade a successful document to `verified` only when method and timestamp are present.

For deterministic file evidence, derive file and symbol excerpts with `excerptForLineRange(sourceSnapshot, lineRange)`; if source is missing, keep generation `partial` and quality `failed`. Deterministic featured pages retain evaluated content but Task 6 blocks Main Readiness because generation mode is deterministic.

Update both writer prompts to use the same required headings above, demand exact source excerpts and a concrete Chinese `claim` for every evidence item, preserve Simplified Chinese prose, and explicitly forbid invented business meaning and the four generic phrases. The file writer must echo task `referenceKind` unchanged and select its specialized template; it must not force configuration, schema, documentation, or test files into the code template.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @understand-code/core exec vitest run src/knowledge-base/__tests__/publication-quality.test.ts src/knowledge-base/__tests__/writer-contracts.test.ts src/knowledge-base/__tests__/merge.test.ts src/knowledge-base/__tests__/knowledge-base.test.ts
pnpm --filter @understand-code/core build
git add packages/core/src/knowledge-base/publication-quality.ts packages/core/src/knowledge-base/__tests__/publication-quality.test.ts
git add -p -- packages/core/src/knowledge-base/writer-contracts.ts packages/core/src/knowledge-base/types.ts packages/core/src/knowledge-base/quality.ts packages/core/src/knowledge-base/markdown.ts packages/core/src/knowledge-base/merge.ts packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts packages/core/src/knowledge-base/__tests__/merge.test.ts agents/kb-file-writer.md agents/kb-topic-writer.md
git diff --check --cached
git commit -m "feat(kb): enforce publication quality gates"
```

---

## Task 6: Build the four V2 artifacts in Core

**Files**

- Create: `packages/core/src/knowledge-base/artifacts.ts`
- Create: `packages/core/src/knowledge-base/__tests__/artifacts.test.ts`
- Modify: `packages/core/src/knowledge-base/index.ts`

- [ ] **Step 1: Write the failing artifact test with a complete input**

Create `artifacts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildKnowledgeArtifacts, type KnowledgeArtifactInput } from "../artifacts.js";

const input: KnowledgeArtifactInput = {
  projectName: "demo",
  generatedAt: "2026-07-11T00:00:00.000Z",
  outputLanguage: "zh-CN",
  generationMode: "writer",
  graphDigest: "abc",
  sourceRootIdentity: "/workspace/demo",
  sourceRead: { covered: 1, total: 1, missingIds: [] },
  requiredRouteStages: ["purpose"],
  businessTerms: ["策略执行"],
  nodes: [
    { id: "file:src/a.ts", type: "file", name: "a.ts", filePath: "src/a.ts" },
    { id: "function:src/a.ts:run", type: "function", name: "run", filePath: "src/a.ts" },
  ],
  referenceFileNodeIds: ["file:src/a.ts"],
  documents: [{
    id: "page:overview", path: "项目总览.md", title: "项目总览", summary: "解释策略执行入口。",
    category: "overview", role: "featured", directNodeIds: ["function:src/a.ts:run"], contextNodeIds: ["file:src/a.ts"],
    symbolAnchors: [], route: { order: 0, stage: "purpose" }, representedEdgeIds: [], reason: "overview",
    content: "# 项目总览", searchTerms: ["策略执行"], quality: "generated", generationStatus: "complete", qualityIssues: [],
    sourceEvidence: [{ filePath: "src/a.ts", lineRange: [1, 3], nodeId: "function:src/a.ts:run", excerpt: "export function run() {}", claim: "run 是项目运行入口。" }],
  }, {
    id: "page:file-a", path: "文件文档/src-a.ts.md", title: "src/a.ts", summary: "入口文件参考。",
    category: "file", role: "reference", directNodeIds: ["file:src/a.ts", "function:src/a.ts:run"], contextNodeIds: [],
    symbolAnchors: [{ nodeId: "function:src/a.ts:run", anchor: "run" }], representedEdgeIds: [], reason: "file reference",
    content: "# src/a.ts", searchTerms: ["src/a.ts", "run"], quality: "generated", generationStatus: "complete", qualityIssues: [],
    sourceEvidence: [
      { filePath: "src/a.ts", lineRange: [1, 3], nodeId: "file:src/a.ts", excerpt: "export function run() {}", claim: "该文件导出运行入口。" },
      { filePath: "src/a.ts", lineRange: [1, 3], nodeId: "function:src/a.ts:run", excerpt: "export function run() {}", claim: "run 提供运行入口。" },
    ],
  }],
  warnings: [], errors: [],
};

describe("knowledge artifacts", () => {
  it("builds a valid index, searchable symbol anchor, exact traces, and independent coverage", () => {
    const artifacts = buildKnowledgeArtifacts(input);
    expect(artifacts.wikiIndex.version).toBe(2);
    expect(artifacts.wikiIndex.mainReadiness.status).toBe("ready");
    expect(artifacts.wikiIndex.referenceCoverage.functions).toEqual({ covered: 1, total: 1, missingIds: [] });
    expect(artifacts.searchIndex.records).toContainEqual(expect.objectContaining({ kind: "symbol", pageId: "page:file-a", anchor: "run", relation: "direct" }));
    expect(artifacts.documentTraces.traces.every((trace) => trace.evidenceIds.length > 0 && trace.claims.length > 0)).toBe(true);
    expect(artifacts.generationReport.sourceRead).toEqual({ covered: 1, total: 1, missingIds: [] });
    expect(artifacts.generationReport.source).toMatchObject({ outputLanguage: "zh-CN", sourceRootIdentity: "/workspace/demo", graphDigest: "abc" });
  });

  it("blocks deterministic and zero-source runs without destroying reference counts", () => {
    const artifacts = buildKnowledgeArtifacts({ ...input, generationMode: "deterministic", sourceRead: { covered: 0, total: 1, missingIds: ["file:src/a.ts"] } });
    expect(artifacts.wikiIndex.mainReadiness.status).toBe("blocked");
    expect(artifacts.wikiIndex.mainReadiness.reasons).toEqual(expect.arrayContaining(["未读取到任何源码文件", "确定性诊断稿不能作为正式主干知识发布"]));
    expect(artifacts.wikiIndex.referenceCoverage.functions.total).toBe(1);
  });
});
```

Run:

```bash
pnpm --filter @understand-code/core exec vitest run src/knowledge-base/__tests__/artifacts.test.ts
```

Expected: FAIL with module-resolution failure for `artifacts.js`.

- [ ] **Step 2: Implement a single artifact input and output boundary**

Create `artifacts.ts` with:

```ts
import type { GeneratedDocument } from "./types.js";
import type {
  CountSummaryV2, RouteStage, WikiDocumentTracesV2, WikiGenerationReportV2,
  WikiIndexV2, WikiSearchIndexV2,
} from "./wiki-contract.js";

export interface KnowledgeArtifactNode { id: string; type: string; name: string; filePath?: string }
export interface KnowledgeArtifactInput {
  projectName: string; generatedAt: string; outputLanguage: string;
  generationMode: "writer" | "deterministic"; graphDigest?: string; gitCommitHash?: string; sourceRootIdentity: string;
  sourceRead: CountSummaryV2; requiredRouteStages: RouteStage[]; businessTerms: string[];
  nodes: KnowledgeArtifactNode[]; referenceFileNodeIds: string[];
  documents: GeneratedDocument[]; warnings: string[]; errors: string[];
}
export interface KnowledgeArtifactsV2 {
  wikiIndex: WikiIndexV2; searchIndex: WikiSearchIndexV2;
  documentTraces: WikiDocumentTracesV2; generationReport: WikiGenerationReportV2;
}
export function buildKnowledgeArtifacts(input: KnowledgeArtifactInput): KnowledgeArtifactsV2;
```

Implement these deterministic helpers:

1. `evidenceId(e)` returns `evidence:${encodeURIComponent(nodeId)}:${encodeURIComponent(filePath)}:${start}-${end}`. Deduplicate byte-identical evidence. If the same ID has a different excerpt or evidence type, throw `WikiArtifactBuildError` instead of choosing one.
2. Infer evidence type as test for test/spec paths, configuration for config/env/yaml/json/toml paths or config nodes, documentation for Markdown/docs paths, otherwise production.
3. Convert every generated document to one page. Preserve document role/category/quality/generation/direct/context/route/search/verification data. Page evidence IDs contain only evidence records supplied by that document.
4. A direct page is usable only if quality is generated/verified, generation is complete, and each direct node has at least one exact evidence record.
5. Build one node record for every graph node. `directPageIds` and `contextPageIds` retain all mappings, including failed pages; relation is direct, context, or none based on those arrays. If a usable direct page exists, quality/generation come from the selected primary. If only unusable direct pages exist, propagate the highest-priority direct page's actual failed/needs-review quality and generation state but leave `primaryPageId` unset. If no direct page exists, use `needs-review/partial`. Evidence health is computed independently.
6. Primary-page priority among usable direct pages is topic, file, flow, module, then other; break ties by featured before reference before maintenance, then page ID. Use the file symbol anchor when the selected file page contains one for that node.
7. Evidence health is source-linked only when exact evidence has ordered line range and non-empty excerpt; path/range without excerpt is weak.
8. Set node reference coverage to anchored/unanchored for IDs listed in `referenceFileNodeIds`, functions, and classes, and not-applicable for every other node. Reference files are covered by a complete generated/verified file page directly containing the owner ID; this lets configuration/schema/documentation owners count as files without pretending their graph type is `file`. Functions/classes are covered only by a complete generated/verified file page containing both a direct ID and a symbol anchor. Compute classes under the `types` count.
9. `countCoverage` sorts unique IDs, intersects with the covered set, and returns exact missing IDs. Overall status is complete only when every applicable category has zero missing IDs.
10. Main Readiness is blocked when source coverage is zero, generation mode is deterministic, any required route stage is absent, overview is absent, or any route page is unusable. It is degraded when the route is valid but optional documents failed; otherwise ready. Accumulate every applicable reason instead of returning after the first.
11. Emit one page search record per page. Emit one symbol search record per file-page symbol anchor. Symbol records point to owning file page and anchor. Page relation is direct when it has direct IDs, context when it only has context IDs, otherwise none.
12. Emit one claim trace per document evidence item with non-empty `claim`: stable ID `claim:${encodeURIComponent(pageId)}:${zeroBasedIndex}`, exact claim text, that evidence node ID, and generated evidence ID. Emit one document trace per page containing those claims plus exact direct/context/evidence IDs and quality issues. A generated/verified page with a direct node but no claim trace is an artifact-build error.
13. Set `version:2` and the input `generatedAt` on Wiki/search/trace/report wrappers. Copy the same readiness and reference summaries into Wiki and generation report; copy source-root identity, graph digest, commit, output language, warnings, and errors into the generation report.
14. Sort pages, node records, evidence, search records, and traces by stable ID before validation.
15. Call `parseWikiIndexV2` on the finished index. If invalid, throw `WikiArtifactBuildError` containing every contract error; never return partially valid artifacts.

Export from the knowledge-base barrel.

- [ ] **Step 3: Verify and commit**

```bash
pnpm --filter @understand-code/core exec vitest run src/knowledge-base/__tests__/artifacts.test.ts src/knowledge-base/__tests__/wiki-contract.test.ts src/knowledge-base/__tests__/knowledge-base.test.ts
pnpm --filter @understand-code/core build
git add packages/core/src/knowledge-base/artifacts.ts packages/core/src/knowledge-base/__tests__/artifacts.test.ts
git add -p -- packages/core/src/knowledge-base/index.ts
git diff --check --cached
git commit -m "feat(kb): build wiki v2 artifacts"
```

---

## Task 7: Wire explicit roots and V2 artifacts into the orchestration script

**Files**

- Modify: `skills/understand-kb/generate-knowledge-base.mjs`
- Modify: `skills/understand-kb/SKILL.md`
- Modify: `packages/core/src/__tests__/knowledge-base-wiki-index.test.ts`

- [ ] **Step 1: Replace V1 end-to-end assertions with complete V2 fixtures**

In `knowledge-base-wiki-index.test.ts`, retain the existing imports and add this helper:

```ts
function writeGenerationFixture(root: string, writeSource: boolean): void {
  const stateDir = join(root, ".understand-code");
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, "knowledge-graph.json"), JSON.stringify({
    version: "1.0.0",
    project: { name: "sample", languages: ["typescript"], frameworks: [], description: "示例项目", analyzedAt: "2026-07-11T00:00:00.000Z", gitCommitHash: "abc" },
    nodes: [
      { id: "file:src/a.ts", type: "file", name: "a.ts", filePath: "src/a.ts", summary: "入口文件", tags: ["entry"], complexity: "moderate" },
      { id: "function:src/a.ts:run", type: "function", name: "run", filePath: "src/a.ts", lineRange: [1, 1], summary: "运行入口", tags: ["entry"], complexity: "complex" },
    ],
    edges: [{ source: "file:src/a.ts", target: "function:src/a.ts:run", type: "contains", direction: "forward", weight: 1 }],
    layers: [{ id: "layer:main", name: "入口层", description: "入口", nodeIds: ["file:src/a.ts"] }],
    tour: [],
  }, null, 2));
  writeFileSync(join(stateDir, "config.json"), JSON.stringify({ autoUpdate: false, outputLanguage: "zh-CN", knowledgeBase: { businessTerms: ["运行入口"] } }, null, 2));
  if (writeSource) {
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src/a.ts"), "export function run() {}\n");
  }
}
```

Rewrite the successful test to call the script with a source root and a temporary output root, then assert all four wrappers are version 2, `report.sourceRead.covered > 0`, and `report.mainReadiness.status === "blocked"` with the deterministic diagnostic reason.

Add a zero-source test using `writeGenerationFixture(root, false)`. Assert non-zero exit, no `wiki-index.json`, no `search-index.json`, no document traces, and an existing generation report whose reasons contain `未读取到任何源码文件`.

Add an unsafe-output test using `writeGenerationFixture(root, true)` and `--output-root <root>`. Assert non-zero exit, assert `src/a.ts` and `.understand-code/knowledge-graph.json` still exist, and assert stderr contains `输出目录不能覆盖源码或图谱目录`.

Run:

```bash
pnpm --filter @understand-code/core exec vitest run src/__tests__/knowledge-base-wiki-index.test.ts
```

Expected: FAIL because the script still writes V1 and does not recognize explicit roots.

- [ ] **Step 2: Parse and carry explicit roots through every phase**

Extend `parseArgs` with `sourceRoot` and `outputRoot`. The positional project root remains the default source root. Parse `--source-root <path>` and `--output-root <path>` with `resolve`; after parsing, default output to `<sourceRoot>/.understand-code/knowledge-base`.

Initialize both fields as `null`, set them when their flag is encountered, and finish `parseArgs` with:

```js
args.sourceRoot = resolve(args.sourceRoot || args.projectRoot);
args.outputRoot = resolve(args.outputRoot || join(args.sourceRoot, '.understand-code', 'knowledge-base'));
return args;
```

Remove the earlier unconditional `return args` so there is only one return path.

Replace `pathsFor(projectRoot)` with:

```js
function pathsFor(sourceRoot, outputRoot) {
  const knowledgeRoot = outputRoot || join(sourceRoot, '.understand-code', 'knowledge-base');
  return {
    graphPath: join(sourceRoot, '.understand-code', 'knowledge-graph.json'),
    configPath: join(sourceRoot, '.understand-code', 'config.json'),
    sourceRoot,
    outputRoot: knowledgeRoot,
    intermediateRoot: join(knowledgeRoot, '.intermediate'),
  };
}
```

Change phase signatures so every function receives the same roots; use these exact signatures and update every `main()` call site accordingly:

```text
loadGraph(core, sourceRoot)
sourceFilesForGraph(sourceRoot, graph, maxSourceBytes)
prepareFileDocs(core, sourceRoot, outputRoot, maxSourceBytes)
loadProfileAndFilePlan(core, sourceRoot, maxSourceBytes) // returns graph, profile, fileDocPlan, and sourceStats
mergeFileDocs(core, sourceRoot, outputRoot, maxSourceBytes)
prepareTopics(core, sourceRoot, outputRoot, maxSourceBytes, args)
finalizeKnowledgeBase(core, sourceRoot, outputRoot, keepIntermediate, maxSourceBytes)
leaseBatch(core, outputRoot, queueFileName, options)
completeBatch(core, outputRoot, queueFileName, args)
printRetryPlan(outputRoot)
```

All graph/config/source reads use source root. All Markdown, queues, retry plans, and artifacts use output root. Add `relative` and `isAbsolute` to the `node:path` import. In `sourceFilesForGraph`, resolve and guard each graph path with:

```js
const root = resolve(sourceRoot);
const absolute = resolve(root, node.filePath);
const relativePath = relative(root, absolute);
if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
  omittedFiles.push(node.filePath);
  continue;
}
```

Iterate unique file paths belonging to graph nodes of type file/config/schema/document rather than only `node.type === "file"`. Missing, escaped, unreadable, and size-capped files all contribute to missing source coverage. `loadProfileAndFilePlan` returns `{ graph, profile, fileDocPlan, sourceStats: stats }` so finalize does not reconstruct coverage from a different read.

Before any directory creation or cleanup, compute `defaultKnowledgeRoot = join(sourceRoot, '.understand-code', 'knowledge-base')` and implement `isWithin(parent, child)` with `relative`. Reject when output equals/contains source, graph, or config. Reject an output located inside source unless it equals or is nested below `defaultKnowledgeRoot`. Also reject a non-empty output outside the source tree when it contains neither an existing `wiki-index.json` nor `.intermediate`; this prevents treating an arbitrary user directory as generated output. A new/empty temp directory is allowed. Do not rely on string-prefix matching.

Load config once per generation phase with `core.loadConfig(sourceRoot)` and pass `outputLanguage`, `knowledgeBaseConfig`, and generation mode into Core generation/planning. The deterministic call is exactly `core.generateKnowledgeBase(graph, { sourceFiles, outputLanguage: config.outputLanguage ?? 'zh-CN', knowledgeBaseConfig: config.knowledgeBase ?? {}, generationMode: 'deterministic' })`. Phased finalization calls `core.materializeKnowledgeBase({ profile, fileDocPlan, businessCapabilityProfile, topicPlan, merged, options: { sourceFiles, outputLanguage: config.outputLanguage ?? 'zh-CN', knowledgeBaseConfig: config.knowledgeBase ?? {}, generationMode: 'writer' } })` after queue/merge validation.

Update `skills/understand-kb/SKILL.md` in the same step. At the beginning of the workflow define `SOURCE_ROOT` from `--source-root` or resolved project root and `OUTPUT_ROOT` from `--output-root` or `$SOURCE_ROOT/.understand-code/knowledge-base`. Every deterministic, prepare, lease, complete, merge, topic, retry, and finalize command must pass both `--source-root "$SOURCE_ROOT" --output-root "$OUTPUT_ROOT"`. File writers write only `$OUTPUT_ROOT/.intermediate/file-doc-batch-<batchIndex>.json`; topic writers write only `$OUTPUT_ROOT/.intermediate/topic-batch-<batchIndex>.json`. Final path/report instructions must name `$OUTPUT_ROOT`, never reconstruct the path from `$PROJECT_ROOT`. Pass `--max-source-mb`, `--resume`, and extended-topic flags in addition to—not instead of—the two root flags.

- [ ] **Step 3: Remove the private V1 schema and build artifacts once**

Delete script-local `wikiId`, page-category mapping, related-node inference, page quality/coverage inference, gap severity, `buildWikiIndexPayload`, and all helpers used only by those functions.

After final documents and coverage validation exist, call:

```js
const artifacts = core.buildKnowledgeArtifacts({
  projectName: kb.profile.graph.project.name,
  generatedAt: new Date().toISOString(),
  outputLanguage: config.outputLanguage ?? 'zh-CN',
  generationMode,
  graphDigest: createHash('sha256').update(JSON.stringify(kb.profile.graph)).digest('hex'),
  gitCommitHash: kb.profile.graph.project.gitCommitHash,
  sourceRootIdentity: resolve(sourceRoot),
  sourceRead: {
    covered: sourceStats.readFiles,
    total: kb.fileDocPlan.tasks.length,
    missingIds: kb.fileDocPlan.tasks.filter((task) => !task.sourceSnapshot.exists).map((task) => task.fileNodeId).sort(),
  },
  requiredRouteStages: kb.plan.requiredRouteStages,
  businessTerms: config.knowledgeBase?.businessTerms ?? [],
  nodes: kb.profile.graph.nodes.map((node) => ({ id: node.id, type: node.type, name: node.name, ...(node.filePath ? { filePath: node.filePath } : {}) })),
  referenceFileNodeIds: kb.fileDocPlan.tasks.map((task) => task.fileNodeId).sort(),
  documents: kb.documents,
  warnings: [...kb.validation.warnings, ...kb.coverageReport.warnings],
  errors: [...kb.validation.errors, ...kb.coverageReport.errors],
});
```

Ensure `GeneratedKnowledgeBase.plan` now has the `FeaturedPlan` shape and includes `requiredRouteStages`.

- [ ] **Step 4: Write failure reports and successful artifacts safely**

Import `renameSync`. Add:

```js
function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(value, null, 2), 'utf-8');
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}
```

Build and serialize all four payloads before cleaning the previous Markdown output. On zero source reads:

1. Write only `.trace/generation-report.json` atomically.
2. Do not clean the output root and do not write Wiki/search/traces/Markdown.
3. Print `未读取到任何源码，正式知识库未发布。` and set exit code 1.

On non-zero source reads, clean old documents while preserving `.intermediate`, then write Markdown and these exact payloads atomically:

```js
writeJsonAtomic(join(outputRoot, 'wiki-index.json'), artifacts.wikiIndex);
writeJsonAtomic(join(outputRoot, 'search-index.json'), artifacts.searchIndex);
writeJsonAtomic(join(outputRoot, '.trace/document-traces.json'), artifacts.documentTraces);
writeJsonAtomic(join(outputRoot, '.trace/generation-report.json'), artifacts.generationReport);
```

The four files are individually atomic. Do not claim a cross-file atomic transaction.

Replace the old `writeKnowledgeBase(outputRoot, kb, keepIntermediate, generationMode)` with `publishKnowledgeBase(outputRoot, kb, artifacts, keepIntermediate)`. It contains only the zero-source guard, output cleanup, Markdown writes, four atomic JSON writes, and optional intermediate cleanup. It never builds schema data itself.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @understand-code/core exec vitest run src/__tests__/knowledge-base-wiki-index.test.ts
pnpm --filter @understand-code/core test
pnpm --filter @understand-code/core build
if rg -n '\$PROJECT_ROOT/\.understand-code/knowledge-base' skills/understand-kb/SKILL.md; then exit 1; fi
rg -n '\$OUTPUT_ROOT/\.intermediate/(file-doc-batch|topic-batch)|--source-root.*--output-root' skills/understand-kb/SKILL.md
git add -p -- skills/understand-kb/generate-knowledge-base.mjs skills/understand-kb/SKILL.md packages/core/src/__tests__/knowledge-base-wiki-index.test.ts
git diff --check --cached
git commit -m "feat(kb): publish wiki v2 artifacts"
```

---

## Task 8: Verify Plan 1 as an independent deliverable

- [ ] **Step 1: Run focused and full Core verification**

```bash
pnpm --filter @understand-code/core exec vitest run \
  src/knowledge-base/__tests__/wiki-contract.test.ts \
  src/knowledge-base/__tests__/wiki-v1-adapter.test.ts \
  src/knowledge-base/__tests__/route-overrides.test.ts \
  src/knowledge-base/__tests__/featured-planner.test.ts \
  src/knowledge-base/__tests__/publication-quality.test.ts \
  src/knowledge-base/__tests__/artifacts.test.ts \
  src/knowledge-base/__tests__/knowledge-base.test.ts \
  src/knowledge-base/__tests__/writer-contracts.test.ts \
  src/knowledge-base/__tests__/merge.test.ts \
  src/__tests__/knowledge-base-wiki-index.test.ts \
  src/persistence/persistence.test.ts
pnpm --filter @understand-code/core test
pnpm --filter @understand-code/core build
```

Expected: all commands PASS.

- [ ] **Step 2: Generate a disposable real-source diagnostic preview**

```bash
tmpdir="$(mktemp -d)"
source_root="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
node skills/understand-kb/generate-knowledge-base.mjs "$source_root" \
  --deterministic-only \
  --source-root "$source_root" \
  --output-root "$tmpdir/knowledge-base"
node -e '
const fs = require("fs");
const report = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (report.sourceRead.covered === 0) process.exit(1);
if (report.generationMode !== "deterministic") process.exit(2);
if (report.mainReadiness.status !== "blocked") process.exit(3);
if (!report.mainReadiness.reasons.includes("确定性诊断稿不能作为正式主干知识发布")) process.exit(4);
' "$tmpdir/knowledge-base/.trace/generation-report.json"
```

Expected: both commands exit 0. This verifies real source reading and explicitly verifies that deterministic output remains diagnostic.

- [ ] **Step 3: Inspect scope and repository cleanliness**

```bash
git diff --check
git status --short
```

Confirm that only files listed in Tasks 1–7 were changed by this plan. Do not stage or commit pre-existing unrelated changes. If verification needed no correction, do not create an empty commit.

## Completion gate

Plan 1 is complete only when:

- Core exports one complete V2 contract and one loss-aware V1 adapter.
- The orchestration script contains no private competing Wiki schema builder.
- Guided, reference, and maintenance roles are explicit.
- Direct and context mappings are never merged.
- Single-node/zero-behavior pseudo-flows cannot enter Main Reading.
- Every valid file has a reference page and every function/class has a stable file anchor.
- Publication gates require concrete Chinese content and exact node evidence.
- Main Readiness and Reference Coverage are independently calculated.
- Wiki, search, trace, and generation-report artifacts are written at the specified paths.
- A zero-source run writes only a blocked report and never publishes a finished Wiki.
- A deterministic run is explicitly blocked from formal Main Readiness.
- Focused tests, full Core tests, and Core build all pass.
