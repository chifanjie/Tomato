# Guided Wiki Reading, Search, and Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a guided Wiki home, bounded featured navigation, exhaustive searchable reference, precise direct/context navigation, lazy global search, a separate status view, and collapsible source evidence.

**Architecture:** Consume the Core V2 contract from Plan 1 without re-deriving documentation truth in React. Build pure navigation/search models first, then focused rendering components. Load `wiki-index.json` eagerly and `search-index.json` only when Global Search first opens; `WikiEvidenceV2` supplies this plan's evidence rail without loading claim-level trace artifacts.

**Tech Stack:** React 19, TypeScript 5.7, Zustand 5, React Markdown 10, Vitest 3, Vite 6, Tailwind CSS 4

## Global Constraints

- Complete `2026-07-11-wiki-v2-knowledge-generation.md` first.
- Import V2 types/parsing from `@understand-code/core`; do not define another Wiki schema.
- Work incrementally on the dirty worktree and stage only task-owned files.
- Wiki is the default surface; Graph remains a peer surface.
- Main Reading is bounded and open by default; Reference and Status are collapsed by default.
- Direct explanations and context-only material remain separate everywhere.
- Wiki-to-Graph focus contains direct node IDs only.
- Search supports Simplified Chinese business terms, paths, files, functions, and types.
- A symbol result opens the owning file page at a stable anchor.
- Coverage/generation metrics do not appear on the reading home.
- User-facing text is Simplified Chinese except source identifiers and paths.
- Below 1024 px, navigation/evidence become drawers while the article stays primary.
- Design source: `docs/superpowers/specs/2026-07-11-wiki-graph-experience-design.md`.

---

## Planned File Structure

**Create models:**
- `packages/dashboard/src/wiki/navigationModel.ts`
- `packages/dashboard/src/wiki/searchIndex.ts`
- `packages/dashboard/src/wiki/wikiArtifacts.ts`

**Create components:**
- `packages/dashboard/src/components/wiki/GuidedWikiHome.tsx`
- `packages/dashboard/src/components/wiki/KnowledgeStatusView.tsx`
- `packages/dashboard/src/components/wiki/GlobalWikiSearch.tsx`
- `packages/dashboard/src/components/wiki/WikiResponsiveShell.tsx`

**Create tests:**
- `packages/dashboard/src/wiki/__tests__/fixtures/wikiV2Fixtures.ts`
- `packages/dashboard/src/wiki/__tests__/navigationModel.test.ts`
- `packages/dashboard/src/wiki/__tests__/searchIndex.test.ts`
- `packages/dashboard/src/wiki/__tests__/wikiArtifacts.test.ts`
- `packages/dashboard/src/components/wiki/__tests__/GuidedWikiHome.test.ts`
- `packages/dashboard/src/components/wiki/__tests__/KnowledgeStatusView.test.ts`
- `packages/dashboard/src/components/wiki/__tests__/GlobalWikiSearch.test.ts`
- `packages/dashboard/src/components/wiki/__tests__/WikiEvidenceRail.test.ts`
- `packages/dashboard/src/components/wiki/__tests__/WikiResponsiveShell.test.ts`

**Modify:**
- `packages/dashboard/src/wiki/wikiIndex.ts`
- `packages/dashboard/src/wiki/wikiContent.ts`
- `packages/dashboard/src/wiki/__tests__/wikiIndex.test.ts`
- `packages/dashboard/src/wiki/__tests__/wikiContent.test.ts`
- `packages/dashboard/src/workbench/knowledgeContextLoader.ts`
- `packages/dashboard/src/workbench/__tests__/knowledgeContextLoader.test.ts`
- `packages/dashboard/src/components/wiki/knowledgeConsoleModel.ts`
- `packages/dashboard/src/components/wiki/KnowledgeConsole.tsx`
- `packages/dashboard/src/components/wiki/WikiNavigation.tsx`
- `packages/dashboard/src/components/wiki/WikiPageView.tsx`
- `packages/dashboard/src/components/wiki/WikiEvidenceRail.tsx`
- `packages/dashboard/src/components/wiki/__tests__/knowledgeConsoleModel.test.ts`
- `packages/dashboard/src/components/wiki/__tests__/WikiNavigation.test.ts`
- `packages/dashboard/src/components/wiki/__tests__/WikiPageView.test.ts`
- `packages/dashboard/src/store.ts`
- `packages/dashboard/src/__tests__/storeNavigation.test.ts`
- `packages/dashboard/src/App.tsx`
- `packages/dashboard/src/__tests__/appSurfaceRouting.test.ts`
- `packages/dashboard/src/index.css`

## Shared Test Fixtures

Create `packages/dashboard/src/wiki/__tests__/fixtures/wikiV2Fixtures.ts` in Task 1. Later tasks import these helpers instead of referring to undeclared fixtures.

```ts
import type {
  WikiIndexV2,
  WikiPageV2,
  WikiSearchRecordV2,
} from "@understand-code/core";

const generatedAt = "2026-07-11T00:00:00.000Z";

function count(covered: number, total = covered) {
  return { covered, total, missingIds: Array.from({ length: total - covered }, (_, index) => `missing:${index}`) };
}

export function wikiV2Fixture(): WikiIndexV2 {
  return {
    version: 2,
    generatedAt,
    projectName: "示例项目",
    source: { outputLanguage: "zh-CN", generationMode: "writer" },
    mainReadiness: {
      status: "ready",
      reasons: [],
      routePageIds: ["page:overview", "page:run"],
    },
    referenceCoverage: {
      status: "complete",
      files: count(2),
      functions: count(1),
      types: count(0),
    },
    pages: [
      {
        id: "page:overview",
        title: "项目总览",
        summary: "说明项目目标、主要流程与阅读顺序。",
        markdownPath: "knowledge-base/项目总览.md",
        role: "featured",
        category: "overview",
        quality: "generated",
        generationStatus: "complete",
        directNodeIds: ["module:src"],
        contextNodeIds: ["function:src/a.ts:run"],
        evidenceIds: ["evidence:module"],
        searchTerms: ["项目入口"],
        route: { order: 0, stage: "purpose" },
      },
      {
        id: "page:run",
        title: "运行流程",
        summary: "解释请求如何进入 run 并完成处理。",
        markdownPath: "knowledge-base/业务流程/运行流程.md",
        role: "featured",
        category: "flow",
        quality: "generated",
        generationStatus: "complete",
        directNodeIds: ["function:src/a.ts:run"],
        contextNodeIds: ["file:src/config.ts"],
        evidenceIds: ["evidence:run"],
        searchTerms: ["表单校验", "run"],
        route: { order: 1, stage: "flow" },
      },
      {
        id: "page:file-a",
        title: "src/a.ts 文件说明",
        summary: "记录 a.ts 的职责、导出和函数锚点。",
        markdownPath: "knowledge-base/文件文档/src-a.ts.md",
        role: "reference",
        category: "file",
        quality: "generated",
        generationStatus: "complete",
        directNodeIds: ["file:src/a.ts", "function:src/a.ts:run"],
        contextNodeIds: [],
        evidenceIds: ["evidence:run"],
        searchTerms: ["src/a.ts", "run"],
      },
      {
        id: "page:file-config",
        title: "src/config.ts 文件说明",
        summary: "记录配置读取方式。",
        markdownPath: "knowledge-base/文件文档/src-config.ts.md",
        role: "reference",
        category: "file",
        quality: "generated",
        generationStatus: "complete",
        directNodeIds: ["file:src/config.ts"],
        contextNodeIds: [],
        evidenceIds: ["evidence:config"],
        searchTerms: ["src/config.ts"],
      },
      {
        id: "page:quality",
        title: "生成质量报告",
        summary: "记录生成与证据异常。",
        markdownPath: "knowledge-base/维护/生成质量报告.md",
        role: "maintenance",
        category: "quality",
        quality: "generated",
        generationStatus: "complete",
        directNodeIds: [],
        contextNodeIds: [],
        evidenceIds: [],
        searchTerms: ["质量"],
      },
    ],
    nodeDocumentation: [
      {
        nodeId: "module:src",
        relation: "direct",
        quality: "generated",
        evidenceHealth: "source-linked",
        generationStatus: "complete",
        referenceCoverage: "not-applicable",
        directPageIds: ["page:overview"],
        contextPageIds: [],
        evidenceIds: ["evidence:module"],
        primaryPageId: "page:overview",
      },
      {
        nodeId: "file:src/a.ts",
        relation: "direct",
        quality: "generated",
        evidenceHealth: "source-linked",
        generationStatus: "complete",
        referenceCoverage: "anchored",
        directPageIds: ["page:file-a"],
        contextPageIds: [],
        evidenceIds: ["evidence:run"],
        primaryPageId: "page:file-a",
      },
      {
        nodeId: "function:src/a.ts:run",
        relation: "direct",
        quality: "generated",
        evidenceHealth: "source-linked",
        generationStatus: "complete",
        referenceCoverage: "anchored",
        directPageIds: ["page:run", "page:file-a"],
        contextPageIds: ["page:overview"],
        evidenceIds: ["evidence:run"],
        primaryPageId: "page:file-a",
        anchor: "run",
      },
      {
        nodeId: "file:src/config.ts",
        relation: "direct",
        quality: "generated",
        evidenceHealth: "source-linked",
        generationStatus: "complete",
        referenceCoverage: "anchored",
        directPageIds: ["page:file-config"],
        contextPageIds: ["page:run"],
        evidenceIds: ["evidence:config"],
        primaryPageId: "page:file-config",
      },
    ],
    evidence: [
      {
        id: "evidence:module",
        nodeIds: ["module:src"],
        filePath: "src/a.ts",
        lineRange: [1, 12],
        excerpt: "export function run() {}",
        evidenceType: "production",
      },
      {
        id: "evidence:run",
        nodeIds: ["file:src/a.ts", "function:src/a.ts:run"],
        filePath: "src/a.ts",
        lineRange: [1, 3],
        excerpt: "export function run() {}",
        evidenceType: "production",
      },
      {
        id: "evidence:config",
        nodeIds: ["file:src/config.ts"],
        filePath: "src/config.ts",
        lineRange: [1, 4],
        excerpt: "export const timeout = 1000;",
        evidenceType: "configuration",
      },
    ],
  };
}

export function largeWikiFixture(options: { files: number; symbols: number; featured: number }): WikiIndexV2 {
  if (!Number.isInteger(options.files) || options.files < 1) throw new RangeError("files must be at least 1");
  if (!Number.isInteger(options.symbols) || options.symbols < 0) throw new RangeError("symbols must be non-negative");
  if (!Number.isInteger(options.featured) || options.featured < 1) throw new RangeError("featured must be at least 1");
  const base = wikiV2Fixture();
  const symbolIdsByFile = Array.from({ length: options.files }, () => [] as string[]);
  for (let index = 0; index < options.symbols; index += 1) {
    const fileIndex = index % options.files;
    symbolIdsByFile[fileIndex]!.push(`function:src/module-${fileIndex % 4}/file-${fileIndex}.ts:symbol${index}`);
  }
  const featured: WikiPageV2[] = Array.from({ length: options.featured }, (_, index) => ({
    id: `page:featured-${index}`,
    title: `推荐阅读 ${index + 1}`,
    summary: `第 ${index + 1} 篇主干阅读文档。`,
    markdownPath: `knowledge-base/主干/featured-${index}.md`,
    role: "featured",
    category: index === 0 ? "overview" : "topic",
    quality: "generated",
    generationStatus: "complete",
    directNodeIds: [`module:featured-${index}`],
    contextNodeIds: [],
    evidenceIds: [`evidence:featured-${index}`],
    searchTerms: [],
    route: { order: index, stage: index === 0 ? "purpose" : "implementation" },
  }));
  const references: WikiPageV2[] = Array.from({ length: options.files }, (_, index) => {
    const fileNodeId = `file:src/module-${index % 4}/file-${index}.ts`;
    return {
      id: `page:file-${index}`,
      title: `file-${index}.ts`,
      summary: `src/module-${index % 4}/file-${index}.ts 文件说明。`,
      markdownPath: `knowledge-base/文件文档/src/module-${index % 4}/file-${index}.ts.md`,
      role: "reference",
      category: "file",
      quality: "generated",
      generationStatus: "complete",
      directNodeIds: [fileNodeId, ...symbolIdsByFile[index]!],
      contextNodeIds: [],
      evidenceIds: [`evidence:file-${index}`],
      searchTerms: [`src/module-${index % 4}/file-${index}.ts`, ...symbolIdsByFile[index]!.map((id) => id.slice(id.lastIndexOf(":") + 1))],
    };
  });
  const featuredEvidence = featured.map((page, index) => ({
    id: `evidence:featured-${index}`,
    nodeIds: [...page.directNodeIds],
    filePath: `src/module-${index % 4}/file-${index % options.files}.ts`,
    lineRange: [1, 2] as [number, number],
    excerpt: `// 推荐阅读 ${index + 1}`,
    evidenceType: "production" as const,
  }));
  const fileEvidence = references.map((page, index) => ({
    id: `evidence:file-${index}`,
    nodeIds: [...page.directNodeIds],
    filePath: `src/module-${index % 4}/file-${index}.ts`,
    lineRange: [1, Math.max(2, page.directNodeIds.length + 1)] as [number, number],
    excerpt: `export function file${index}() {}`,
    evidenceType: "production" as const,
  }));
  const featuredDocs = featured.map((page, index) => ({
    nodeId: page.directNodeIds[0]!,
    relation: "direct" as const,
    quality: "generated" as const,
    evidenceHealth: "source-linked" as const,
    generationStatus: "complete" as const,
    referenceCoverage: "not-applicable" as const,
    directPageIds: [page.id],
    contextPageIds: [],
    evidenceIds: [`evidence:featured-${index}`],
    primaryPageId: page.id,
  }));
  const symbolDocs = Array.from({ length: options.symbols }, (_, index) => {
    const fileIndex = index % options.files;
    return {
      nodeId: `function:src/module-${fileIndex % 4}/file-${fileIndex}.ts:symbol${index}`,
      relation: "direct" as const,
      quality: "generated" as const,
      evidenceHealth: "source-linked" as const,
      generationStatus: "complete" as const,
      referenceCoverage: "anchored" as const,
      directPageIds: [`page:file-${fileIndex}`],
      contextPageIds: [],
      evidenceIds: [`evidence:file-${fileIndex}`],
      primaryPageId: `page:file-${fileIndex}`,
      anchor: `symbol${index}`,
    };
  });
  return {
    ...base,
    pages: [...featured, ...references, base.pages.find((page) => page.id === "page:quality")!],
    mainReadiness: { status: "ready", reasons: [], routePageIds: featured.map((page) => page.id) },
    referenceCoverage: {
      status: "complete",
      files: count(options.files),
      functions: count(options.symbols),
      types: count(0),
    },
    nodeDocumentation: [
      ...featuredDocs,
      ...references.map((page, index) => ({
        nodeId: page.directNodeIds[0]!,
        relation: "direct" as const,
        quality: "generated" as const,
        evidenceHealth: "source-linked" as const,
        generationStatus: "complete" as const,
        referenceCoverage: "anchored" as const,
        directPageIds: [page.id],
        contextPageIds: [],
        evidenceIds: [`evidence:file-${index}`],
        primaryPageId: page.id,
      })),
      ...symbolDocs,
    ],
    evidence: [...featuredEvidence, ...fileEvidence],
  };
}

export function searchFixture(): WikiSearchRecordV2[] {
  return [
    { id: "search:overview", kind: "page", title: "项目总览", summary: "表单校验项目入口。", pageId: "page:overview", role: "featured", category: "overview", relation: "none", terms: ["入口"], businessTerms: ["表单校验"] },
    { id: "search:flow", kind: "page", title: "运行流程", summary: "解释 run 流程。", pageId: "page:run", role: "featured", category: "flow", relation: "direct", terms: ["run"], businessTerms: ["表单校验"] },
    { id: "search:file", kind: "page", title: "src/a.ts", pageId: "page:file-a", role: "reference", category: "file", relation: "direct", terms: ["a.ts"], businessTerms: ["表单校验"], filePath: "src/a.ts" },
    { id: "search:run", kind: "symbol", title: "run", pageId: "page:file-a", anchor: "run", nodeId: "function:src/a.ts:run", role: "reference", category: "file", relation: "direct", terms: ["run"], businessTerms: ["表单校验"], filePath: "src/a.ts" },
    { id: "search:context-config", kind: "page", title: "配置相关资料", pageId: "page:run", role: "featured", category: "flow", relation: "context", terms: ["配置"], businessTerms: ["表单校验"] },
  ];
}
```

`largeWikiFixture` deliberately creates symbol documentation only in `nodeDocumentation`; it never creates symbol pages. This is the regression condition that keeps the left tree bounded while search can still expose every anchor.

---

### Task 1: Normalize Dashboard Wiki data through Core V2

**Files:**
- Create: `packages/dashboard/src/wiki/__tests__/fixtures/wikiV2Fixtures.ts`
- Modify: `packages/dashboard/src/wiki/wikiIndex.ts`
- Modify: `packages/dashboard/src/wiki/__tests__/wikiIndex.test.ts`
- Modify: `packages/dashboard/src/workbench/knowledgeContextLoader.ts`
- Modify: `packages/dashboard/src/workbench/__tests__/knowledgeContextLoader.test.ts`
- Modify: `packages/dashboard/src/store.ts`
- Modify: `packages/dashboard/src/components/wiki/knowledgeConsoleModel.ts`
- Modify: `packages/dashboard/src/components/wiki/KnowledgeConsole.tsx`
- Modify: `packages/dashboard/src/components/wiki/WikiNavigation.tsx`
- Modify: `packages/dashboard/src/components/wiki/WikiPageView.tsx`
- Modify: `packages/dashboard/src/components/wiki/WikiEvidenceRail.tsx`
- Modify: `packages/dashboard/src/components/wiki/__tests__/knowledgeConsoleModel.test.ts`
- Modify: `packages/dashboard/src/components/wiki/__tests__/WikiNavigation.test.ts`
- Modify: `packages/dashboard/src/components/wiki/__tests__/WikiPageView.test.ts`
- Modify: `packages/dashboard/src/__tests__/storeNavigation.test.ts`

**Interfaces:**
- Consumes: `parseWikiIndex`, `WikiIndexV2`, `WikiPageV2`, `WikiEvidenceV2`.
- Produces: `buildWikiRuntimeIndex(payload): WikiRuntimeIndex`.

- [ ] **Step 1: Write the failing V2 runtime-index test**

```ts
import { describe, expect, it } from "vitest";
import { wikiV2Fixture } from "./fixtures/wikiV2Fixtures";
import { buildWikiRuntimeIndex } from "../wikiIndex";

describe("Wiki V2 runtime index", () => {
  it("keeps direct, context, evidence, and route maps independent", () => {
const index = buildWikiRuntimeIndex(wikiV2Fixture());
expect(index.directPagesByNodeId.get("function:src/a.ts:run")?.map((p) => p.id)).toEqual(["page:run", "page:file-a"]);
expect(index.contextPagesByNodeId.get("function:src/a.ts:run")?.map((p) => p.id)).toEqual(["page:overview"]);
expect(index.evidenceByNodeId.get("function:src/a.ts:run")?.map((e) => e.id)).toEqual(["evidence:run"]);
expect(index.routePages.map((p) => p.id)).toEqual(["page:overview", "page:run"]);
  });
});
```

- [ ] **Step 2: Run and verify V1-only code fails**

```bash
pnpm --filter @understand-code/dashboard exec vitest run src/wiki/__tests__/wikiIndex.test.ts
```

Expected: FAIL because `buildWikiRuntimeIndex` and V2 maps do not exist.

- [ ] **Step 3: Implement the runtime index**

```ts
import type { WikiEvidenceV2, WikiIndexV2, WikiNodeDocumentationV2, WikiPageV2 } from "@understand-code/core";

export interface WikiRuntimeIndex {
  payload: WikiIndexV2 | null;
  pages: readonly WikiPageV2[];
  pageCount: number;
  pagesById: ReadonlyMap<string, WikiPageV2>;
  nodeDocumentationById: ReadonlyMap<string, WikiNodeDocumentationV2>;
  evidenceById: ReadonlyMap<string, WikiEvidenceV2>;
  directPagesByNodeId: ReadonlyMap<string, readonly WikiPageV2[]>;
  contextPagesByNodeId: ReadonlyMap<string, readonly WikiPageV2[]>;
  evidenceByNodeId: ReadonlyMap<string, readonly WikiEvidenceV2[]>;
  routePages: readonly WikiPageV2[];
}

function append<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  map.set(key, [...(map.get(key) ?? []), value]);
}

export function buildWikiRuntimeIndex(payload: WikiIndexV2 | null | undefined): WikiRuntimeIndex {
  const pages = Object.freeze([...(payload?.pages ?? [])]);
  const pagesById = new Map(pages.map((page) => [page.id, page]));
  const nodeDocumentationById = new Map((payload?.nodeDocumentation ?? []).map((item) => [item.nodeId, item]));
  const evidenceById = new Map((payload?.evidence ?? []).map((item) => [item.id, item]));
  const direct = new Map<string, WikiPageV2[]>();
  const context = new Map<string, WikiPageV2[]>();
  const evidence = new Map<string, WikiEvidenceV2[]>();
  for (const page of pages) {
    for (const nodeId of page.directNodeIds) append(direct, nodeId, page);
    for (const nodeId of page.contextNodeIds) append(context, nodeId, page);
  }
  for (const item of payload?.evidence ?? []) for (const nodeId of item.nodeIds) append(evidence, nodeId, item);
  const routePages = (payload?.mainReadiness.routePageIds ?? []).flatMap((pageId) => {
    const page = pagesById.get(pageId);
    return page?.role === "featured" && page.route ? [page] : [];
  });
  return { payload: payload ?? null, pages, pageCount: pages.length, pagesById, nodeDocumentationById, evidenceById, directPagesByNodeId: direct, contextPagesByNodeId: context, evidenceByNodeId: evidence, routePages };
}

export function evidenceForPage(index: WikiRuntimeIndex, pageId: string): WikiEvidenceV2[] {
  const page = index.pagesById.get(pageId);
  return page ? page.evidenceIds.flatMap((id) => {
    const item = index.evidenceById.get(id);
    return item ? [item] : [];
  }) : [];
}
```

The route order comes exclusively from Core's `mainReadiness.routePageIds`; Dashboard does not sort it again. Pages without `role: "featured"` or without `route` never enter `routePages`. Preserve page array order inside each direct/context map so Core's generated primary ordering is not silently changed. Add `emptyWikiRuntimeIndex()` as `buildWikiRuntimeIndex(null)` and remove the V1 `pagesForNode` union helper from Dashboard exports.

- [ ] **Step 4: Replace loader-local V1 guards with `parseWikiIndex`**

```ts
const loaded = await fetchJsonWithStatus(wikiUrl, fetcher);
if (loaded.status !== "ok") return { wikiIndex: buildWikiRuntimeIndex(null), wikiStatus: loaded.status, sourceVersion: null };
const parsed = parseWikiIndex(loaded.value);
if (!parsed.ok || !parsed.sourceVersion) return { wikiIndex: buildWikiRuntimeIndex(null), wikiStatus: "invalid", sourceVersion: null };
return { wikiIndex: buildWikiRuntimeIndex(parsed.value), wikiStatus: "ready", sourceVersion: parsed.sourceVersion };
```

Change `DashboardKnowledge` to this exact discriminated result so callers cannot treat an invalid payload as ready:

```ts
export type DashboardKnowledge =
  | { wikiIndex: WikiRuntimeIndex; wikiStatus: "ready"; sourceVersion: 1 | 2 }
  | { wikiIndex: WikiRuntimeIndex; wikiStatus: "missing" | "invalid" | "forbidden" | "error"; sourceVersion: null };
```

Delete loader-local `isWikiPageCategory`, `isWikiPageCoverage`, `isWikiQualityStatus`, `isGapSeverity`, `isWikiPageRecord`, `isWikiEvidenceRecord`, `isWikiGapRecord`, and `isWikiIndexPayload`. Tests must assert: 403 returns `forbidden` without legacy probes; 404 returns `missing`; malformed JSON and schema-invalid JSON return `invalid`; V1 fixture returns `ready/sourceVersion:1`; V2 fixture returns `ready/sourceVersion:2`; token and demo-mode URL behavior remain unchanged.

- [ ] **Step 5: Mechanically migrate existing consumers so the Task 1 commit builds**

Before the role-driven redesign in Task 2, make these compile-safe V2 substitutions without changing layout:

```ts
// store.ts
wikiIndex: WikiRuntimeIndex;
setWikiIndex: (index: WikiRuntimeIndex) => void;
function wikiPageNodeIds(page: WikiPageV2): string[] {
  return [...new Set([...page.directNodeIds, ...page.contextNodeIds])];
}

// Temporary graph→Wiki selection; Task 5 replaces it with Core primaryDestinationForNode.
const page = state.wikiIndex.directPagesByNodeId.get(nodeId)?.[0]
  ?? state.wikiIndex.contextPagesByNodeId.get(nodeId)?.[0]
  ?? null;
```

Use `WikiPageV2` in `knowledgeConsoleModel`, `WikiPageView`, and `WikiEvidenceRail`, and `WikiEvidenceV2` for evidence. In the temporary category navigation, replace V1 `symbol/gap` with V2 `topic/coverage`, and map `role` nowhere yet—Task 2 replaces the category tree. Replace `.explainedNodeIds/.relatedNodeIds` with `.directNodeIds/.contextNodeIds`. Replace page `.coverage` badges with `generationStatus` labels `{complete:"生成完成",partial:"部分生成",failed:"生成失败"}` and quality labels `{verified:"已经核验",generated:"自动生成","needs-review":"等待核验",failed:"质量失败"}`. Replace evidence `.label` with `filePath`; keep line-range formatting. In `KnowledgeConsole`'s soon-to-be-deleted home stats, calculate complete/partial from `generationStatus`, needs-review from `quality`, evidence count from `evidenceById.size`, and omit the V1 gap count rather than inventing one.

Add a temporary `categorySections(index)` helper in `wikiIndex.ts` returning `{category,title,pages}[]` in exact V2 category order `overview,capability,flow,module,topic,file,quality,coverage,other`; Task 2 deletes it when `buildWikiNavigation` lands. Update existing Wiki tests to use the V2 fixture. This step must contain no direct/context union helper other than the explicitly temporary graph focus above.

- [ ] **Step 6: Test, build, and commit**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/wiki/__tests__/wikiIndex.test.ts \
  src/workbench/__tests__/knowledgeContextLoader.test.ts \
  src/components/wiki/__tests__/knowledgeConsoleModel.test.ts \
  src/components/wiki/__tests__/WikiNavigation.test.ts \
  src/components/wiki/__tests__/WikiPageView.test.ts \
  src/__tests__/storeNavigation.test.ts
pnpm --filter @understand-code/dashboard build
git add packages/dashboard/src/wiki/wikiIndex.ts packages/dashboard/src/wiki/__tests__/wikiIndex.test.ts \
  packages/dashboard/src/wiki/__tests__/fixtures/wikiV2Fixtures.ts \
  packages/dashboard/src/workbench/knowledgeContextLoader.ts \
  packages/dashboard/src/workbench/__tests__/knowledgeContextLoader.test.ts \
  packages/dashboard/src/store.ts packages/dashboard/src/components/wiki/knowledgeConsoleModel.ts \
  packages/dashboard/src/components/wiki/KnowledgeConsole.tsx \
  packages/dashboard/src/components/wiki/WikiNavigation.tsx \
  packages/dashboard/src/components/wiki/WikiPageView.tsx \
  packages/dashboard/src/components/wiki/WikiEvidenceRail.tsx \
  packages/dashboard/src/components/wiki/__tests__/knowledgeConsoleModel.test.ts \
  packages/dashboard/src/components/wiki/__tests__/WikiNavigation.test.ts \
  packages/dashboard/src/components/wiki/__tests__/WikiPageView.test.ts \
  packages/dashboard/src/__tests__/storeNavigation.test.ts
git commit -m "feat(dashboard): consume wiki v2 indexes"
```

Expected: PASS.

---

### Task 2: Build role-driven navigation and the lazy reference tree

**Files:**
- Create: `packages/dashboard/src/wiki/navigationModel.ts`
- Create: `packages/dashboard/src/wiki/__tests__/navigationModel.test.ts`
- Modify: `packages/dashboard/src/components/wiki/knowledgeConsoleModel.ts`
- Modify: `packages/dashboard/src/components/wiki/__tests__/knowledgeConsoleModel.test.ts`
- Modify: `packages/dashboard/src/components/wiki/WikiNavigation.tsx`
- Modify: `packages/dashboard/src/components/wiki/__tests__/WikiNavigation.test.ts`

**Interfaces:**
- Consumes: `WikiRuntimeIndex` from Task 1.
- Produces: `buildWikiNavigation(index: WikiRuntimeIndex): WikiNavigationModel`.
- Produces: `loadReferenceChildren(model, nodeId): ReferenceTreeNode[]`.

- [ ] **Step 1: Write the failing large-navigation test**

```ts
import { describe, expect, it } from "vitest";
import { parseWikiIndexV2 } from "@understand-code/core";
import { largeWikiFixture } from "./fixtures/wikiV2Fixtures";
import { buildWikiRuntimeIndex } from "../wikiIndex";
import { buildWikiNavigation, loadReferenceChildren, visibleReferenceRows } from "../navigationModel";

describe("Wiki navigation", () => {
  it("keeps 479 symbol anchors out of a 277-file reference tree", () => {
const payload = largeWikiFixture({ files: 277, symbols: 479, featured: 18 });
const parsed = parseWikiIndexV2(payload);
expect(parsed.ok).toBe(true);
if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
const model = buildWikiNavigation(buildWikiRuntimeIndex(parsed.value));
expect(model.featured.pages).toHaveLength(18);
expect(model.reference.totalFiles).toBe(277);
expect(model.reference.roots[0]).toMatchObject({ kind: "module", path: "src" });
expect([...model.reference.nodesById.values()].every((node) => node.kind !== "symbol")).toBe(true);
expect(loadReferenceChildren(model, model.reference.roots[0]!.id).every((node) => node.kind === "directory" || node.kind === "file")).toBe(true);
const root = model.reference.roots[0]!;
expect(visibleReferenceRows(model, new Set()).every((row) => row.node.kind === "module")).toBe(true);
const moduleRows = visibleReferenceRows(model, new Set([root.id]));
const directory = moduleRows.find((row) => row.node.path === "src/module-0")!.node;
expect(visibleReferenceRows(model, new Set([root.id, directory.id])).some((row) => row.node.kind === "file")).toBe(true);
expect(model.maintenance.expandedByDefault).toBe(false);
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
pnpm --filter @understand-code/dashboard exec vitest run src/wiki/__tests__/navigationModel.test.ts
```

Expected: FAIL because the model does not exist.

- [ ] **Step 3: Implement role-driven navigation**

```ts
export interface ReferenceTreeNode {
  id: string;
  kind: "module" | "directory" | "file";
  label: string;
  path: string;
  pageId?: string;
  childIds: readonly string[];
}

export interface WikiNavigationModel {
  featured: { pages: readonly WikiPageV2[]; expandedByDefault: true };
  reference: {
    roots: readonly ReferenceTreeNode[];
    nodesById: ReadonlyMap<string, ReferenceTreeNode>;
    totalFiles: number;
    orphanPageIds: readonly string[];
    expandedByDefault: false;
  };
  maintenance: { pages: readonly WikiPageV2[]; expandedByDefault: false };
}

const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });

function filePathForPage(page: WikiPageV2): string | null {
  const nodeId = page.directNodeIds.find((id) => id.startsWith("file:"));
  if (!nodeId) return null;
  const path = nodeId.slice("file:".length).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!path || path.split("/").some((part) => !part || part === "." || part === "..")) return null;
  return path;
}

function nodeId(kind: ReferenceTreeNode["kind"], path: string): string {
  return `reference:${kind}:${encodeURIComponent(path)}`;
}

export function buildPathTree(pages: readonly WikiPageV2[]): {
  nodesById: ReadonlyMap<string, ReferenceTreeNode>;
  orphanPageIds: readonly string[];
} {
  const mutable = new Map<string, { id: string; kind: ReferenceTreeNode["kind"]; label: string; path: string; pageId?: string; childIds: Set<string> }>();
  const orphanPageIds: string[] = [];
  const ensure = (kind: ReferenceTreeNode["kind"], path: string, label: string) => {
    const id = nodeId(kind, path);
    if (!mutable.has(id)) mutable.set(id, { id, kind, label, path, childIds: new Set() });
    return mutable.get(id)!;
  };
  for (const page of pages) {
    const filePath = filePathForPage(page);
    if (!filePath) { orphanPageIds.push(page.id); continue; }
    const parts = filePath.split("/");
    const modulePath = parts.length > 1 ? parts[0]! : "";
    const module = ensure("module", modulePath, modulePath || "仓库根目录");
    let parent = module;
    for (let depth = 1; depth < parts.length - 1; depth += 1) {
      const path = parts.slice(0, depth + 1).join("/");
      const directory = ensure("directory", path, parts[depth]!);
      parent.childIds.add(directory.id);
      parent = directory;
    }
    const file = ensure("file", filePath, parts.at(-1)!);
    file.pageId = page.id;
    parent.childIds.add(file.id);
  }
  const nodesById = new Map<string, ReferenceTreeNode>();
  for (const item of mutable.values()) {
    nodesById.set(item.id, {
      id: item.id,
      kind: item.kind,
      label: item.label,
      path: item.path,
      ...(item.pageId ? { pageId: item.pageId } : {}),
      childIds: [...item.childIds].sort((a, b) => collator.compare(mutable.get(a)!.label, mutable.get(b)!.label)),
    });
  }
  return { nodesById, orphanPageIds: orphanPageIds.sort() };
}

export function rootNodes(nodesById: ReadonlyMap<string, ReferenceTreeNode>): ReferenceTreeNode[] {
  return [...nodesById.values()].filter((node) => node.kind === "module").sort((a, b) => collator.compare(a.label, b.label));
}

export function buildWikiNavigation(index: WikiRuntimeIndex): WikiNavigationModel {
  const featured = index.routePages;
  const referencePages = index.pages.filter((page) => page.role === "reference" && page.category === "file");
  const maintenance = index.pages.filter((page) => page.role === "maintenance");
  const { nodesById, orphanPageIds } = buildPathTree(referencePages);
  return {
    featured: { pages: featured, expandedByDefault: true },
    reference: { roots: rootNodes(nodesById), nodesById, totalFiles: referencePages.length, orphanPageIds, expandedByDefault: false },
    maintenance: { pages: [...maintenance].sort((a, b) => collator.compare(a.title, b.title)), expandedByDefault: false },
  };
}

export function loadReferenceChildren(model: WikiNavigationModel, nodeId: string): ReferenceTreeNode[] {
  const node = model.reference.nodesById.get(nodeId);
  if (!node) return [];
  return node.childIds.flatMap((id) => {
    const child = model.reference.nodesById.get(id);
    return child ? [child] : [];
  });
}

export function visibleReferenceRows(
  model: WikiNavigationModel,
  expandedNodeIds: ReadonlySet<string>,
): Array<{ node: ReferenceTreeNode; depth: number }> {
  const rows: Array<{ node: ReferenceTreeNode; depth: number }> = [];
  const visit = (node: ReferenceTreeNode, depth: number) => {
    rows.push({ node, depth });
    if (!expandedNodeIds.has(node.id)) return;
    for (const child of loadReferenceChildren(model, node.id)) visit(child, depth + 1);
  };
  for (const root of model.reference.roots) visit(root, 0);
  return rows;
}
```

The laziness boundary is explicit: `buildPathTree` stores only IDs, never nested child objects; `WikiNavigation` calls `loadReferenceChildren` only after the user expands that branch. Opening a file calls `onSelectPage(node.pageId)`; nodes without a `pageId` only toggle expansion. `orphanPageIds` are linked from Knowledge Base Status rather than silently dropped.

- [ ] **Step 4: Update console model and navigation rendering**

Change the view signature to:

```ts
export interface KnowledgeConsoleView {
  navigation: WikiNavigationModel;
  activePage: WikiPageV2 | null;
  directGraphNodeIds: readonly string[];
  contextNodeIds: readonly string[];
  exactEvidence: readonly WikiEvidenceV2[];
  homeVisible: boolean;
}
```

For an active page, `directGraphNodeIds` is the de-duplicated `page.directNodeIds` in source order, `contextNodeIds` is `page.contextNodeIds` excluding IDs already direct, and `exactEvidence` includes a page evidence record only when it contains at least one `directGraphNodeId`. `homeVisible` is exactly `activePageId === null`. `WikiNavigation` renders exactly “主干阅读”, “代码参考”, and “知识库状态”; remove `CATEGORY_LABELS`, `NAVIGATION_GROUPS`, `filterWikiSections`, and the local search input because Task 4 supplies global search.

Use this controlled navigation contract so the home shortcut can open Reference without reaching into component internals:

```ts
interface WikiNavigationProps {
  model: WikiNavigationModel;
  activePageId: string | null;
  referenceExpanded: boolean;
  referenceTriggerRef: RefObject<HTMLButtonElement | null>;
  onReferenceExpandedChange: (expanded: boolean) => void;
  onSelectHome: () => void;
  onSelectStatus: () => void;
  onSelectPage: (pageId: string) => void;
}
```

Keep `expandedNodeIds: Set<string>` local to `WikiNavigation`. On branch click, clone/toggle that ID and render `visibleReferenceRows(model,expandedNodeIds)`; collapsed descendants are never materialized as rows. File rows have no disclosure control and invoke `onSelectPage(pageId!)`. Assert that only “主干阅读” is expanded on first render, expanding `src` then `src/module-0` exposes its files, clearing either ID removes descendant file rows, and the model still reports all 277 files.

- [ ] **Step 5: Test and commit**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/wiki/__tests__/navigationModel.test.ts \
  src/components/wiki/__tests__/knowledgeConsoleModel.test.ts \
  src/components/wiki/__tests__/WikiNavigation.test.ts
git add packages/dashboard/src/wiki/navigationModel.ts packages/dashboard/src/wiki/__tests__/navigationModel.test.ts \
  packages/dashboard/src/components/wiki/knowledgeConsoleModel.ts \
  packages/dashboard/src/components/wiki/__tests__/knowledgeConsoleModel.test.ts \
  packages/dashboard/src/components/wiki/WikiNavigation.tsx \
  packages/dashboard/src/components/wiki/__tests__/WikiNavigation.test.ts
git commit -m "feat(dashboard): organize guided and reference navigation"
```

Expected: PASS on the 277-file fixture without 479 left-tree symbol rows.

---

### Task 3: Add the guided home and separate status view

**Files:**
- Create: `packages/dashboard/src/components/wiki/GuidedWikiHome.tsx`
- Create: `packages/dashboard/src/components/wiki/KnowledgeStatusView.tsx`
- Create: `packages/dashboard/src/components/wiki/__tests__/GuidedWikiHome.test.ts`
- Create: `packages/dashboard/src/components/wiki/__tests__/KnowledgeStatusView.test.ts`
- Modify: `packages/dashboard/src/components/wiki/KnowledgeConsole.tsx`
- Modify: `packages/dashboard/src/components/wiki/WikiPageView.tsx`
- Modify: `packages/dashboard/src/store.ts`
- Modify: `packages/dashboard/src/__tests__/storeNavigation.test.ts`

**Interfaces:**
- Consumes: `WikiRuntimeIndex`, `WikiNavigationModel`, and route pages from Tasks 1–2.
- Produces: `GuidedWikiHomeProps` and `KnowledgeStatusViewProps`; the home props intentionally contain no coverage or generation metrics.

- [ ] **Step 1: Write rendering-contract tests**

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { wikiV2Fixture } from "../../../wiki/__tests__/fixtures/wikiV2Fixtures";
import { buildWikiRuntimeIndex } from "../../../wiki/wikiIndex";
import GuidedWikiHome from "../GuidedWikiHome";
import KnowledgeStatusView from "../KnowledgeStatusView";

it("renders the guided route without maintenance metrics", () => {
  const index = buildWikiRuntimeIndex(wikiV2Fixture());
  const html = renderToStaticMarkup(createElement(GuidedWikiHome, {
    projectName: "示例项目",
    routePages: index.routePages,
    onOpenPage: vi.fn(),
    onOpenGraph: vi.fn(),
    onOpenReference: vi.fn(),
  }));
  expect(html).toContain("先理解项目，再进入代码");
  expect(html).toContain("项目做什么");
  expect(html).toContain("怎样流转");
  expect(html).toContain("有哪些规则");
  expect(html).toContain("代码怎样实现");
  expect(html).toContain("怎样核验源码");
  expect(html).not.toMatch(/缺口|覆盖率|生成失败/);
});

it("reports readiness and reference coverage independently in Chinese", () => {
  const html = renderToStaticMarkup(createElement(KnowledgeStatusView, {
    index: buildWikiRuntimeIndex(wikiV2Fixture()),
    orphanReferencePageIds: [],
  }));
  expect(html).toContain("主干知识");
  expect(html).toContain("可以阅读");
  expect(html).toContain("全量代码参考");
  expect(html).toContain("文件 2/2");
  expect(html).toContain("函数 1/1");
});

```

In `storeNavigation.test.ts`, import `useDashboardStore`, `buildWikiRuntimeIndex`, and `wikiV2Fixture`, then add:

```ts
it("keeps the guided home selected after the first Wiki load", () => {
  useDashboardStore.setState({ activeWikiPageId: null, dashboardSurface: "wiki" });
  useDashboardStore.getState().setWikiIndex(buildWikiRuntimeIndex(wikiV2Fixture()));
  expect(useDashboardStore.getState()).toMatchObject({ dashboardSurface: "wiki", activeWikiPageId: null });
});
```

- [ ] **Step 2: Run and verify missing components**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/components/wiki/__tests__/GuidedWikiHome.test.ts \
  src/components/wiki/__tests__/KnowledgeStatusView.test.ts
```

Expected: FAIL because the component files do not exist.

- [ ] **Step 3: Implement `GuidedWikiHome`**

```tsx
const STAGE_LABEL = { purpose: "项目做什么", flow: "怎样流转", rule: "有哪些规则", implementation: "代码怎样实现", evidence: "怎样核验源码" } as const;
const STAGE_ORDER = ["purpose", "flow", "rule", "implementation", "evidence"] as const;

export interface GuidedWikiHomeProps {
  projectName: string;
  routePages: readonly WikiPageV2[];
  onOpenPage: (pageId: string) => void;
  onOpenGraph: () => void;
  onOpenReference: () => void;
}

export default function GuidedWikiHome({ projectName, routePages, onOpenPage, onOpenGraph, onOpenReference }: GuidedWikiHomeProps) {
  return <main className="min-w-0 flex-1 overflow-auto px-8 py-10 max-md:px-5">
    <p className="text-xs font-semibold tracking-[0.12em] text-text-muted">推荐起点</p>
    <h1 className="mt-2 text-3xl font-semibold">先理解项目，再进入代码</h1>
    <p className="mt-3 max-w-2xl leading-7 text-text-secondary">{projectName} 的知识按同一条路线从业务目标展开到可核验源码。</p>
    <ol className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{STAGE_ORDER.map((stage, index) => <li key={stage} className="uc-panel p-4"><span className="text-xs text-text-muted">{String(index + 1).padStart(2, "0")}</span><strong className="mt-2 block">{STAGE_LABEL[stage]}</strong></li>)}</ol>
    <section className="mt-10"><h2 className="text-lg font-semibold">推荐阅读路线</h2><ol className="mt-4 grid gap-3 lg:grid-cols-2">{routePages.map((page) => <li key={page.id}><button type="button" onClick={() => onOpenPage(page.id)} className="uc-panel w-full p-4 text-left"><span className="text-xs text-text-muted">{page.route ? STAGE_LABEL[page.route.stage] : "推荐阅读"}</span><strong className="mt-1 block">{page.title}</strong><span className="mt-2 line-clamp-2 block text-sm text-text-secondary">{page.summary}</span></button></li>)}</ol></section>
    <div className="mt-8 flex gap-3"><button type="button" onClick={onOpenGraph} className="uc-button">查看项目图谱</button><button type="button" onClick={onOpenReference} className="uc-button">查找文件或函数</button></div>
  </main>;
}
```

- [ ] **Step 4: Implement `KnowledgeStatusView`**

```tsx
const MAIN_LABEL = { ready: "可以阅读", degraded: "可以阅读，部分内容待完善", blocked: "暂不可用" } as const;
const REFERENCE_LABEL = { complete: "参考覆盖完整", partial: "参考覆盖不完整" } as const;

export interface KnowledgeStatusViewProps {
  index: WikiRuntimeIndex;
  orphanReferencePageIds: readonly string[];
}

export default function KnowledgeStatusView({ index, orphanReferencePageIds }: KnowledgeStatusViewProps) {
  const main = index.payload?.mainReadiness;
  const ref = index.payload?.referenceCoverage;
  return <main className="min-w-0 flex-1 overflow-auto px-8 py-10"><h1 className="text-2xl font-semibold">知识库状态</h1><section className="mt-6 uc-panel p-5"><h2>主干知识</h2><p>{main ? MAIN_LABEL[main.status] : "状态不可用"}</p>{main?.reasons.map((reason) => <p key={reason}>{reason}</p>)}</section><section className="mt-4 uc-panel p-5"><h2>全量代码参考</h2><p>{ref ? REFERENCE_LABEL[ref.status] : "状态不可用"}</p><p>文件 {ref?.files.covered ?? 0}/{ref?.files.total ?? 0}</p><p>函数 {ref?.functions.covered ?? 0}/{ref?.functions.total ?? 0}</p><p>类型 {ref?.types.covered ?? 0}/{ref?.types.total ?? 0}</p>{orphanReferencePageIds.length > 0 && <p>有 {orphanReferencePageIds.length} 篇文件文档缺少有效文件节点映射。</p>}</section></main>;
}
```

- [ ] **Step 5: Wire views and remove home statistics**

In `KnowledgeConsole`, keep local `auxView: "home" | "status"` and controlled `referenceExpanded: boolean`. Selecting a page sets `auxView="home"`; selecting “阅读首页” sets `activeWikiPageId=null/auxView="home"`; selecting “知识库状态” sets `activeWikiPageId=null/auxView="status"`; the home shortcut “查找文件或函数” sets `referenceExpanded=true` and moves focus to the reference-group trigger. Render `GuidedWikiHome` only for `activePage === null && auxView === "home"`, and `KnowledgeStatusView` only for `activePage === null && auxView === "status"`. Delete `StartReadingGuide`, `WikiHomeStats`, and `homeStats` from `WikiPageView`/`KnowledgeConsole`.

```tsx
const [auxView, setAuxView] = useState<"home" | "status">("home");
const [referenceExpanded, setReferenceExpanded] = useState(false);
const referenceTriggerRef = useRef<HTMLButtonElement>(null);
const openPage = (pageId: string) => { setAuxView("home"); navigateWikiPage(pageId); };
const openHome = () => { setAuxView("home"); navigateWikiPage(null); };
const openStatus = () => { setAuxView("status"); navigateWikiPage(null); };
const openReference = () => {
  setReferenceExpanded(true);
  requestAnimationFrame(() => referenceTriggerRef.current?.focus());
};
const openGraphHome = () => {
  setDashboardSurface("graph");
  window.history.pushState(null, "", `${window.location.pathname}${window.location.search}#graph`);
};
const article = view.activePage
  ? <WikiPageView page={view.activePage} pages={wikiIndex.pages} onSelectPage={openPage} onHeadingsChange={setOutlineHeadings} />
  : auxView === "status"
    ? <KnowledgeStatusView index={wikiIndex} orphanReferencePageIds={view.navigation.reference.orphanPageIds} />
    : <GuidedWikiHome projectName={wikiIndex.payload?.projectName ?? "代码仓库"} routePages={wikiIndex.routePages} onOpenPage={openPage} onOpenGraph={openGraphHome} onOpenReference={openReference} />;
```

Change `setWikiIndex` so loading metadata does not auto-select an overview: preserve `activeWikiPageId` only when that ID exists in the new index; otherwise set it to `null`. Until Task 5 adds `graphFocusPageId`, refresh existing non-empty `graphFocusNodeIds` only when the preserved active page exists, using that page's `directNodeIds`; otherwise clear graph focus. Update the store test to assert a fresh V2 load remains `{dashboardSurface:"wiki",activeWikiPageId:null}`, making Guided Home the real default rather than relying on a later hash effect.

- [ ] **Step 6: Test, build, and commit**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/components/wiki/__tests__/GuidedWikiHome.test.ts \
  src/components/wiki/__tests__/KnowledgeStatusView.test.ts \
  src/components/wiki/__tests__/WikiPageView.test.ts \
  src/components/wiki/__tests__/knowledgeConsoleModel.test.ts \
  src/__tests__/storeNavigation.test.ts
pnpm --filter @understand-code/dashboard build
git add packages/dashboard/src/components/wiki/GuidedWikiHome.tsx \
  packages/dashboard/src/components/wiki/KnowledgeStatusView.tsx \
  packages/dashboard/src/components/wiki/__tests__/GuidedWikiHome.test.ts \
  packages/dashboard/src/components/wiki/__tests__/KnowledgeStatusView.test.ts \
  packages/dashboard/src/components/wiki/KnowledgeConsole.tsx packages/dashboard/src/components/wiki/WikiPageView.tsx \
  packages/dashboard/src/store.ts packages/dashboard/src/__tests__/storeNavigation.test.ts
git commit -m "feat(dashboard): add guided wiki home and status"
```

---

### Task 4: Add lazy global search and stable symbol targets

**Files:**
- Create: `packages/dashboard/src/wiki/searchIndex.ts`
- Create: `packages/dashboard/src/wiki/wikiArtifacts.ts`
- Create: `packages/dashboard/src/wiki/__tests__/searchIndex.test.ts`
- Create: `packages/dashboard/src/wiki/__tests__/wikiArtifacts.test.ts`
- Create: `packages/dashboard/src/components/wiki/GlobalWikiSearch.tsx`
- Create: `packages/dashboard/src/components/wiki/__tests__/GlobalWikiSearch.test.ts`
- Modify: `packages/dashboard/src/wiki/wikiContent.ts`
- Modify: `packages/dashboard/src/wiki/__tests__/wikiContent.test.ts`
- Modify: `packages/dashboard/src/store.ts`
- Modify: `packages/dashboard/src/App.tsx`

**Interfaces:**
- Consumes: Core `WikiSearchRecordV2` and the `search-index.json` envelope emitted by Plan 1 (`{ version: 2; records: WikiSearchRecordV2[] }`).
- Produces: `buildWikiSearchRuntime(records, wikiIndex, mode): WikiSearchRuntime`.
- Produces: `searchWiki(index, query, page, pageSize): WikiSearchResults` with one-indexed pages.
- Produces: `loadSearchArtifact(accessToken, fetcher): Promise<SearchArtifactLoadResult>`; trace data is not loaded in this plan because `WikiEvidenceV2` already contains the excerpt and evidence type needed by Task 5.
- Produces: `WikiTarget = { pageId: string; anchor?: string }` and hash/link helpers that preserve the anchor.

- [ ] **Step 1: Write failing search/lazy-load tests**

```ts
import { describe, expect, it } from "vitest";
import { searchFixture, wikiV2Fixture } from "./fixtures/wikiV2Fixtures";
import { buildWikiRuntimeIndex } from "../wikiIndex";
import { buildWikiSearchRuntime, searchWiki } from "../searchIndex";
import {
  extractExplicitAnchors,
  markdownWithoutExplicitAnchors,
  resolveWikiMarkdownTarget,
  wikiTargetFromHash,
  wikiTargetHash,
} from "../wikiContent";

it("groups all matches in product order and retains full group counts", () => {
const runtime = buildWikiSearchRuntime(searchFixture(), buildWikiRuntimeIndex(wikiV2Fixture()), "full");
const results = searchWiki(runtime, "表单校验", 1, 20);
expect(results.groups.map((group) => group.kind)).toEqual(["direct", "capability-flow", "module-file", "symbol", "context"]);
expect(results.groups.find((group) => group.kind === "symbol")?.items[0]).toMatchObject({ pageId: "page:file-a", anchor: "run", nodeId: "function:src/a.ts:run" });
expect(results.totalByKind.symbol).toBe(1);
expect(results.total).toBe(5);
});

it("ranks exact symbol names above term-only matches inside a group", () => {
  const runtime = buildWikiSearchRuntime(searchFixture(), buildWikiRuntimeIndex(wikiV2Fixture()), "full");
  const results = searchWiki(runtime, "run", 1, 20);
  expect(results.groups.find((group) => group.kind === "symbol")?.items[0]?.id).toBe("search:run");
});

it("round-trips a page and symbol anchor and preserves relative Markdown fragments", () => {
  const target = { pageId: "page:file-a", anchor: "run" };
  expect(wikiTargetFromHash(wikiTargetHash(target))).toEqual(target);
  expect(resolveWikiMarkdownTarget(
    "knowledge-base/业务流程/运行流程.md",
    "../文件文档/src-a.ts.md#run",
    new Map([["knowledge-base/文件文档/src-a.ts.md", "page:file-a"]]),
  )).toEqual(target);
});

it("maps only an exact safe anchor marker to the following heading", () => {
  const markdown = '<a id="run"></a>\n## run\n正文\n<script>alert(1)</script>';
  expect(extractExplicitAnchors(markdown).get(2)).toBe("run");
  expect(markdownWithoutExplicitAnchors(markdown)).toContain("<script>alert(1)</script>");
  // ReactMarkdown continues to escape raw HTML; this helper only removes the exact safe anchor line.
});
```

In `wikiArtifacts.test.ts`, use this lazy-load test, then add table cases for 403=`forbidden`, 404=`missing`, non-2xx=`error`, malformed JSON=`invalid`, and `{version:2,records:[{id:3}]}`=`invalid`:

```ts
it("does not fetch search until the search loader is called", async () => {
  const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("wiki-index.json")) return new Response(JSON.stringify(wikiV2Fixture()), { status: 200 });
    if (url.includes("search-index.json")) return new Response(JSON.stringify({ version: 2, records: searchFixture() }), { status: 200 });
    return new Response("not found", { status: 404 });
  });
  await loadDashboardKnowledge("token", fetchSpy as unknown as typeof fetch);
  expect(fetchSpy.mock.calls.map(([input]) => String(input)).filter((url) => url.includes("search-index.json"))).toHaveLength(0);
  const loaded = await loadSearchArtifact("token", fetchSpy as unknown as typeof fetch);
  expect(loaded).toMatchObject({ status: "ready", records: expect.arrayContaining([expect.objectContaining({ id: "search:run" })]) });
  expect(fetchSpy.mock.calls.map(([input]) => String(input)).filter((url) => url.includes("search-index.json"))).toHaveLength(1);
});
```

- [ ] **Step 2: Run and verify missing modules**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/wiki/__tests__/searchIndex.test.ts src/wiki/__tests__/wikiArtifacts.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement fallback records, deterministic ranking, grouping, and paging**

```ts
export type WikiSearchGroupKind = "direct" | "capability-flow" | "module-file" | "symbol" | "context";
export interface WikiSearchRuntime {
  records: readonly WikiSearchRecordV2[];
  mode: "full" | "fallback";
}
export interface WikiSearchResults {
  groups: Array<{ kind: WikiSearchGroupKind; items: WikiSearchRecordV2[] }>;
  totalByKind: Record<WikiSearchGroupKind, number>;
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  mode: WikiSearchRuntime["mode"];
}

const GROUP_ORDER: readonly WikiSearchGroupKind[] = ["direct", "capability-flow", "module-file", "symbol", "context"];

function groupFor(record: WikiSearchRecordV2): WikiSearchGroupKind {
  if (record.relation === "context") return "context";
  if (record.kind === "symbol") return "symbol";
  if (record.category === "capability" || record.category === "flow") return "capability-flow";
  if (record.category === "module" || record.category === "file") return "module-file";
  return "direct";
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN").trim();
}

function score(record: WikiSearchRecordV2, query: string, tokens: string[]): number | null {
  const title = normalize(record.title);
  const summary = normalize(record.summary ?? "");
  const path = normalize(record.filePath ?? "");
  const terms = record.terms.map(normalize);
  const business = record.businessTerms.map(normalize);
  const haystack = [title, summary, path, ...terms, ...business].join("\n");
  if (!tokens.every((token) => haystack.includes(token))) return null;
  let result = title === query ? 500 : title.startsWith(query) ? 350 : title.includes(query) ? 250 : 0;
  if (business.some((term) => term === query)) result += 220;
  else if (business.some((term) => term.includes(query))) result += 180;
  if (path === query) result += 210;
  else if (path.includes(query)) result += 160;
  if (terms.some((term) => term === query)) result += 150;
  else if (terms.some((term) => term.includes(query))) result += 100;
  if (summary.includes(query)) result += 40;
  return result;
}

function symbolParts(nodeId: string): { title: string; filePath: string } | null {
  if (!nodeId.startsWith("function:") && !nodeId.startsWith("class:")) return null;
  const body = nodeId.slice(nodeId.indexOf(":") + 1);
  const split = body.lastIndexOf(":");
  if (split <= 0 || split === body.length - 1) return null;
  return { filePath: body.slice(0, split), title: body.slice(split + 1) };
}

export function buildFallbackSearchRecords(index: WikiRuntimeIndex): WikiSearchRecordV2[] {
  const pageRecords: WikiSearchRecordV2[] = index.pages.map((page) => ({
    id: `fallback:page:${page.id}`,
    kind: "page",
    title: page.title,
    summary: page.summary,
    pageId: page.id,
    role: page.role,
    category: page.category,
    relation: page.directNodeIds.length > 0 ? "direct" : page.contextNodeIds.length > 0 ? "context" : "none",
    terms: [...page.searchTerms, page.markdownPath],
    businessTerms: [],
    filePath: page.category === "file" ? page.directNodeIds.find((id) => id.startsWith("file:"))?.slice(5) : undefined,
  }));
  const symbolRecords: WikiSearchRecordV2[] = [];
  for (const item of index.nodeDocumentationById.values()) {
    if (!item.primaryPageId || !item.anchor) continue;
    const parts = symbolParts(item.nodeId);
    const page = index.pagesById.get(item.primaryPageId);
    if (!parts || !page) continue;
    symbolRecords.push({
      id: `fallback:symbol:${item.nodeId}`,
      kind: "symbol",
      title: parts.title,
      pageId: page.id,
      anchor: item.anchor,
      nodeId: item.nodeId,
      role: page.role,
      category: page.category,
      relation: "direct",
      terms: [item.nodeId, parts.title, parts.filePath],
      businessTerms: [],
      filePath: parts.filePath,
    });
  }
  return [...pageRecords, ...symbolRecords];
}

export function buildWikiSearchRuntime(
  records: readonly WikiSearchRecordV2[],
  wikiIndex: WikiRuntimeIndex,
  mode: WikiSearchRuntime["mode"],
): WikiSearchRuntime {
  return { records: mode === "full" ? [...records] : buildFallbackSearchRecords(wikiIndex), mode };
}

export function searchWiki(runtime: WikiSearchRuntime, rawQuery: string, page: number, pageSize: number): WikiSearchResults {
  if (!Number.isInteger(page) || page < 1) throw new RangeError("page must be at least 1");
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new RangeError("pageSize must be at least 1");
  const query = normalize(rawQuery);
  const emptyCounts = Object.fromEntries(GROUP_ORDER.map((kind) => [kind, 0])) as Record<WikiSearchGroupKind, number>;
  if (!query) return { groups: [], totalByKind: emptyCounts, total: 0, page, pageSize, hasNextPage: false, mode: runtime.mode };
  const tokens = query.split(/\s+/u).filter(Boolean);
  const matches = new Map<WikiSearchGroupKind, Array<{ record: WikiSearchRecordV2; score: number }>>(GROUP_ORDER.map((kind) => [kind, []]));
  for (const record of runtime.records) {
    const recordScore = score(record, query, tokens);
    if (recordScore !== null) matches.get(groupFor(record))!.push({ record, score: recordScore });
  }
  for (const items of matches.values()) items.sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title, "zh-CN", { numeric: true }) || a.record.id.localeCompare(b.record.id));
  const totalByKind = Object.fromEntries(GROUP_ORDER.map((kind) => [kind, matches.get(kind)!.length])) as Record<WikiSearchGroupKind, number>;
  const flattened = GROUP_ORDER.flatMap((kind) => matches.get(kind)!.map(({ record }) => ({ kind, record })));
  const start = (page - 1) * pageSize;
  const visible = flattened.slice(start, start + pageSize);
  const groups = GROUP_ORDER.flatMap((kind) => {
    const items = visible.filter((item) => item.kind === kind).map((item) => item.record);
    return items.length > 0 ? [{ kind, items }] : [];
  });
  return { groups, totalByKind, total: flattened.length, page, pageSize, hasNextPage: start + pageSize < flattened.length, mode: runtime.mode };
}
```

This code makes the algorithms executable: fallback creates no unanchored symbols; all query tokens must match; group totals are calculated before the global page slice; and stable ties use Chinese numeric collation then ID. Add explicit assertions for empty query, invalid page/pageSize, and disjoint page-1/page-2 IDs.

In `wikiArtifacts.ts`, define the exact loader result and validate every record against the Plan 1 field list rather than casting network JSON:

```ts
export type SearchArtifactLoadResult =
  | { status: "ready"; records: WikiSearchRecordV2[] }
  | { status: "missing" | "invalid" | "forbidden" | "error"; records: [] };

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function searchRecord(value: unknown): value is WikiSearchRecordV2 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string"
    && (item.kind === "page" || item.kind === "symbol")
    && typeof item.title === "string"
    && typeof item.pageId === "string"
    && (item.role === "featured" || item.role === "reference" || item.role === "maintenance")
    && typeof item.category === "string"
    && (item.relation === "direct" || item.relation === "context" || item.relation === "none")
    && strings(item.terms)
    && strings(item.businessTerms)
    && [item.summary, item.anchor, item.nodeId, item.filePath].every((field) => field === undefined || typeof field === "string");
}

function searchUrl(token: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const path = `${base.endsWith("/") ? base : `${base}/`}knowledge-base/search-index.json`;
  if (import.meta.env.VITE_DEMO_MODE === "true") return path;
  return `${path}?token=${encodeURIComponent(token)}`;
}

export async function loadSearchArtifact(accessToken: string, fetcher: typeof fetch = fetch): Promise<SearchArtifactLoadResult> {
  try {
    const response = await fetcher(searchUrl(accessToken));
    if (response.status === 404) return { status: "missing", records: [] };
    if (response.status === 403) return { status: "forbidden", records: [] };
    if (!response.ok) return { status: "error", records: [] };
    let value: unknown;
    try { value = await response.json(); } catch { return { status: "invalid", records: [] }; }
    if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "invalid", records: [] };
    const payload = value as { version?: unknown; records?: unknown };
    if (payload.version !== 2 || !Array.isArray(payload.records) || !payload.records.every(searchRecord)) {
      return { status: "invalid", records: [] };
    }
    return { status: "ready", records: payload.records };
  } catch {
    return { status: "error", records: [] };
  }
}
```

The guard requires `version===2`, `records` to be an array, and each record to have the exact Plan 1 fields and enums: string `id/title/pageId/category`, `kind` page/symbol, `role` featured/reference/maintenance, `relation` direct/context/none, string arrays `terms/businessTerms`, and optional string `summary/anchor/nodeId/filePath`. `groupFor` sends `context` to the context group; `none` continues through the category/default display grouping but never creates direct-node coverage because coverage is read only from `WikiIndexV2.nodeDocumentation`. This is transport validation for the Core type, not a second Wiki-index schema.

- [ ] **Step 4: Implement anchor-safe hashes**

```ts
export interface WikiTarget { pageId: string; anchor?: string }

export function wikiTargetHash(target: WikiTarget): string {
  const params = new URLSearchParams({ wiki: target.pageId });
  if (target.anchor) params.set("anchor", target.anchor);
  return `#${params.toString()}`;
}

export function wikiTargetFromHash(hash: string): WikiTarget | null {
  if (hash.startsWith("#wiki-page=")) {
    const legacy = hash.slice("#wiki-page=".length);
    try { return legacy ? { pageId: decodeURIComponent(legacy) } : null; } catch { return null; }
  }
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const pageId = params.get("wiki");
  if (!pageId) return null;
  const anchor = params.get("anchor");
  return { pageId, ...(anchor ? { anchor } : {}) };
}

export function normalizeWikiVirtualPath(value: string): string | null {
  const raw = decodePath(value).trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/^\.understand-code\//, "");
  const result: string[] = [];
  for (const segment of raw.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") { if (result.length === 0) return null; result.pop(); continue; }
    if (segment.includes("\0")) return null;
    result.push(segment);
  }
  return result.join("/");
}

export function resolveRelativeMarkdownPath(currentMarkdownPath: string, relativePath: string): string | null {
  const current = normalizeWikiVirtualPath(currentMarkdownPath);
  if (!current) return null;
  const currentDirectory = current.includes("/") ? current.slice(0, current.lastIndexOf("/")) : "";
  const rootRelative = /^(?:\/?(?:\.understand-code\/)?knowledge-base\/)/.test(relativePath);
  return normalizeWikiVirtualPath(rootRelative ? relativePath : `${currentDirectory}/${relativePath}`);
}

export function resolveWikiMarkdownTarget(
  currentMarkdownPath: string,
  href: string | undefined,
  pageIdByMarkdownPath: ReadonlyMap<string, string>,
): WikiTarget | null {
  if (!href || /^(?:[a-z]+:|\/\/)/i.test(href)) return null;
  const [rawPath, rawFragment] = href.split("#", 2);
  if (!rawPath || !/\.md(?:$|\?)/i.test(rawPath)) return null;
  const targetPath = resolveRelativeMarkdownPath(currentMarkdownPath, rawPath.split("?", 1)[0]!);
  const pageId = targetPath ? pageIdByMarkdownPath.get(targetPath) : undefined;
  if (!pageId) return null;
  let anchor: string | undefined;
  try { anchor = rawFragment ? decodeURIComponent(rawFragment) : undefined; } catch { return null; }
  return { pageId, ...(anchor ? { anchor } : {}) };
}

const EXPLICIT_ANCHOR = /^\s*<a id="([A-Za-z0-9._:-]+)"><\/a>\s*$/;

export function extractExplicitAnchors(markdown: string): ReadonlyMap<number, string> {
  const result = new Map<number, string>();
  let fenced = false;
  let pending: string | null = null;
  markdown.split(/\r?\n/).forEach((line, index) => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return; }
    if (fenced) return;
    const marker = line.match(EXPLICIT_ANCHOR);
    if (marker) { pending = marker[1]!; return; }
    if (pending && /^\s*#{2,4}\s+/.test(line)) { result.set(index + 1, pending); pending = null; }
  });
  return result;
}

export function markdownWithoutExplicitAnchors(markdown: string): string {
  let fenced = false;
  return markdown.split(/\r?\n/).map((line) => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return line; }
    return !fenced && EXPLICIT_ANCHOR.test(line) ? "" : line;
  }).join("\n");
}
```

Rename current `normalizedVirtualPath` to exported `normalizeWikiVirtualPath` and implement `resolveRelativeMarkdownPath(current, relative)` with the same traversal rejection already used by `wikiMarkdownUrl`; the lookup key remains the normalized `knowledge-base/...` path. Make `wikiPageHash(pageId)` delegate to `wikiTargetHash({pageId})`, and make `wikiPageIdFromHash(hash)` return `wikiTargetFromHash(hash)?.pageId ?? null`, so callers retain their APIs while new links use the new format and old `#wiki-page=` URLs still open. Replace `resolveWikiMarkdownPageId` consumers with `resolveWikiMarkdownTarget` and pass the returned anchor to `openWikiTarget`.

Generated file docs use Plan 1's `slugPath(node.name)` marker, for example `<a id="run"></a>`; Plan 2 must not add a `symbol-` prefix. React Markdown does not render raw HTML, so add `extractExplicitAnchors(markdown): ReadonlyMap<number,string>`: scan outside fenced blocks; when a line exactly matches `<a id="([A-Za-z0-9._:-]+)"></a>`, remember the ID and associate it with the next Markdown H2/H3/H4 source line, leaving a blank line so source line numbers remain stable. `markdownWithoutExplicitAnchors` replaces only those exact marker lines with blanks. In `MarkdownDocument`, use the explicit anchor for that heading's `id`; otherwise use the existing outline ID. Tests assert malicious HTML is not rendered and that `run` exists on the following heading.

Add store state `pendingWikiAnchor: string | null`, action `openWikiTarget(target: WikiTarget)`, and action `consumePendingWikiAnchor(anchor: string)`. After Markdown reaches `ready`, use this effect; it consumes only a successful target, leaves a missing target available for retry, and never scrolls to a different heading:

```ts
openWikiTarget: (target) => set((state) => state.wikiIndex.pagesById.has(target.pageId) ? {
  dashboardSurface: "wiki",
  activeWikiPageId: target.pageId,
  pendingWikiAnchor: target.anchor ?? null,
} : {}),
consumePendingWikiAnchor: (anchor) => set((state) => state.pendingWikiAnchor === anchor ? { pendingWikiAnchor: null } : {}),
```

```tsx
useEffect(() => {
  if (state.status !== "ready" || !pendingWikiAnchor || state.pageId !== page?.id) return;
  const frame = requestAnimationFrame(() => {
    const target = document.getElementById(pendingWikiAnchor);
    if (!target) { setAnchorError("未找到目标章节"); return; }
    target.scrollIntoView({ block: "start" });
    setAnchorError(null);
    consumePendingWikiAnchor(pendingWikiAnchor);
  });
  return () => cancelAnimationFrame(frame);
}, [consumePendingWikiAnchor, page?.id, pendingWikiAnchor, state.pageId, state.status]);
```

Clear `anchorError` when page ID or pending anchor changes; render it as a small Chinese notice above the Markdown body. A retry of the same document reruns the effect because `state.status` returns through loading→ready.

- [ ] **Step 5: Add Global Search to App**

Add `searchOpen`, `searchLoadStatus`, and cached `WikiSearchRuntime` to `Dashboard` (not Zustand; they are shell-local and not cross-surface navigation truth). The header button and `Cmd/Ctrl+K` set `searchOpen=true`; the first transition to open calls `loadSearchArtifact` exactly once per access token. Ready uses full records; missing/invalid/error uses `buildWikiSearchRuntime([], wikiIndex, "fallback")` and displays `搜索索引不可用，当前仅搜索标题、路径和符号。`; forbidden calls `onTokenInvalid`. Selecting a result calls `openWikiTarget({pageId,anchor})`, switches `dashboardSurface="wiki"`, closes search, and writes `wikiTargetHash` with `history.pushState`.

Use this state machine in `Dashboard`; `loadedForTokenRef` prevents repeated requests when the dialog reopens, but resets when the access token changes:

```tsx
type SearchLoadStatus = "idle" | "loading" | "ready" | "fallback";
const [searchOpen, setSearchOpen] = useState(false);
const [searchLoadStatus, setSearchLoadStatus] = useState<SearchLoadStatus>("idle");
const [searchRuntime, setSearchRuntime] = useState<WikiSearchRuntime>(() => buildWikiSearchRuntime([], wikiIndex, "fallback"));
const loadedForTokenRef = useRef<string | null>(null);

useEffect(() => {
  if (!searchOpen || loadedForTokenRef.current === accessToken) return;
  let cancelled = false;
  setSearchLoadStatus("loading");
  void loadSearchArtifact(accessToken).then((result) => {
    if (cancelled) return;
    if (result.status === "forbidden") { onTokenInvalid(); return; }
    loadedForTokenRef.current = accessToken;
    if (result.status === "ready") {
      setSearchRuntime(buildWikiSearchRuntime(result.records, wikiIndex, "full"));
      setSearchLoadStatus("ready");
    } else {
      setSearchRuntime(buildWikiSearchRuntime([], wikiIndex, "fallback"));
      setSearchLoadStatus("fallback");
    }
  });
  return () => { cancelled = true; };
}, [accessToken, onTokenInvalid, searchOpen, wikiIndex]);

useEffect(() => {
  loadedForTokenRef.current = null;
  setSearchLoadStatus("idle");
}, [accessToken]);
```

When Wiki metadata changes after a fallback runtime is built, rebuild only that fallback runtime; a successfully loaded full runtime remains stable until the token changes.

Use this exact component boundary:

```ts
interface GlobalWikiSearchProps {
  open: boolean;
  loadStatus: SearchLoadStatus;
  runtime: WikiSearchRuntime;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSelectTarget: (target: WikiTarget) => void;
}
```

`GlobalWikiSearch` keeps `query` and `visibleCount` local. Query change resets `visibleCount=20`; render `searchWiki(runtime,query,1,visibleCount)`, so each “继续显示” click adds 20 without duplicating earlier IDs. Render group headings and the pre-pagination `totalByKind` counts. Escape calls `onClose`; after `open` transitions to false, focus `returnFocusRef.current`. `GlobalWikiSearch.test.ts` renders `open=true` with the fixture and asserts the five group labels/order, symbol target `page:file-a#run`, and fallback warning; keyboard/focus behavior is included in Task 7's real-browser acceptance.

Use the exact visible labels `{direct:"最佳结果","capability-flow":"能力与流程","module-file":"模块与文件",symbol:"函数与类型",context:"相关资料"}`. A `relation:"none"` page can appear under “最佳结果” by text score, but the component must not describe it as direct coverage.

- [ ] **Step 6: Test, build, and commit**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/wiki/__tests__/searchIndex.test.ts src/wiki/__tests__/wikiArtifacts.test.ts \
  src/wiki/__tests__/wikiContent.test.ts src/components/wiki/__tests__/GlobalWikiSearch.test.ts \
  src/__tests__/storeNavigation.test.ts
pnpm --filter @understand-code/dashboard build
git add packages/dashboard/src/wiki/searchIndex.ts packages/dashboard/src/wiki/wikiArtifacts.ts \
  packages/dashboard/src/wiki/__tests__/searchIndex.test.ts packages/dashboard/src/wiki/__tests__/wikiArtifacts.test.ts \
  packages/dashboard/src/components/wiki/GlobalWikiSearch.tsx \
  packages/dashboard/src/components/wiki/__tests__/GlobalWikiSearch.test.ts \
  packages/dashboard/src/wiki/wikiContent.ts packages/dashboard/src/wiki/__tests__/wikiContent.test.ts \
  packages/dashboard/src/store.ts packages/dashboard/src/App.tsx
git commit -m "feat(dashboard): add global wiki search"
```

---

### Task 5: Make evidence and cross-surface navigation exact

**Files:**
- Modify: `packages/dashboard/src/components/wiki/WikiEvidenceRail.tsx`
- Create: `packages/dashboard/src/components/wiki/__tests__/WikiEvidenceRail.test.ts`
- Modify: `packages/dashboard/src/components/wiki/KnowledgeConsole.tsx`
- Modify: `packages/dashboard/src/components/wiki/knowledgeConsoleModel.ts`
- Modify: `packages/dashboard/src/components/wiki/__tests__/knowledgeConsoleModel.test.ts`
- Modify: `packages/dashboard/src/store.ts`
- Modify: `packages/dashboard/src/__tests__/storeNavigation.test.ts`

**Interfaces:**
- Consumes Core `directPagesForNode(index,nodeId)`, `contextPagesForNode(index,nodeId)`, `evidenceForNode(index,nodeId)`, and `primaryDestinationForNode(index,nodeId)`.
- Produces exact Wiki-to-Graph focus and Graph-to-Wiki page+anchor navigation.

- [ ] **Step 1: Change tests from merged focus to direct-only focus**

```ts
expect(view.directGraphNodeIds).toEqual(["function:src/a.ts:run"]);
expect(view.contextNodeIds).toEqual(["file:src/config.ts"]);
expect(view.exactEvidence.map((item) => item.id)).toEqual(["evidence:run"]);
expect(view.directPages.map((item) => item.id)).toEqual(["page:file-a"]);
expect(view.contextPages.map((item) => item.id)).toEqual(["page:overview"]);
useDashboardStore.getState().openGraphForWikiPage("page:run");
expect(useDashboardStore.getState().graphFocusNodeIds).toEqual(["function:src/a.ts:run"]);
useDashboardStore.getState().openWikiForGraphNode("function:src/a.ts:run");
expect(useDashboardStore.getState().activeWikiPageId).toBe("page:file-a");
expect(useDashboardStore.getState().pendingWikiAnchor).toBe("run");
```

Add a second fixture node with only `contextPageIds` and assert `openWikiForGraphNode` leaves `dashboardSurface:"graph"`, retains `selectedNodeId`, and sets `graphWikiNotice:"暂无专门正文"`.

- [ ] **Step 2: Run and verify current union behavior fails**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/components/wiki/__tests__/knowledgeConsoleModel.test.ts src/__tests__/storeNavigation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement precise store actions**

```ts
openGraphForWikiPage: (pageId) => {
  const page = get().wikiIndex.pagesById.get(pageId);
  if (!page) return;
  set({ dashboardSurface: "graph", graphFocusNodeIds: [...new Set(page.directNodeIds)], graphFocusPageId: pageId, graphWikiNotice: null });
},
openWikiForGraphNode: (nodeId) => {
  const payload = get().wikiIndex.payload;
  const destination = payload ? primaryDestinationForNode(payload, nodeId) : null;
  if (!destination) {
    set({ selectedNodeId: nodeId, graphWikiNotice: "暂无专门正文" });
    return;
  }
  set({ dashboardSurface: "wiki", activeWikiPageId: destination.pageId, pendingWikiAnchor: destination.anchor ?? null, graphWikiNotice: null });
},
```

Add the corresponding store fields with exact types: `graphFocusPageId: string | null`, `pendingWikiAnchor: string | null`, and `graphWikiNotice: string | null`. `setWikiIndex` clears a pending anchor only when its target page disappears. When no direct destination exists, retain graph selection and surface and show `暂无专门正文`; never promote a context page.

- [ ] **Step 4: Split the evidence rail sections**

Extend `KnowledgeConsoleView` with `directPages` and `contextPages`. For every `directGraphNodeId`, call the Core selectors against `index.payload`; de-duplicate by page ID in node order, exclude the active page from `directPages`, and exclude every direct-page ID from `contextPages`. Build `exactEvidence` by calling `evidenceForNode` for each direct node, de-duplicating by evidence ID; do not select evidence by page ID alone.

Give `WikiEvidenceRail` these exact props:

```ts
interface WikiEvidenceRailProps {
  page: WikiPageV2;
  directPages: readonly WikiPageV2[];
  contextPages: readonly WikiPageV2[];
  evidence: readonly WikiEvidenceV2[];
  directGraphNodeIds: readonly string[];
  headings: readonly WikiOutlineHeading[];
  onOpenPage: (pageId: string) => void;
  onOpenGraph: (pageId: string) => void;
}
```

Render “直接讲解”, “相关资料”, and “源码证据” as separate sections. Each related-page row calls `onOpenPage`. Each evidence item is a closed `<details>` whose summary contains `filePath` and formatted line range; its body contains `excerpt ?? "未提供代码片段"` and the Chinese type map `{production:"生产代码",configuration:"配置",test:"测试",documentation:"文档"}`. `WikiEvidenceRail.test.ts` renders the fixture and asserts the direct/context page IDs never cross sections, only `evidence:run` is present for the run node, and the excerpt/type text exists inside the details body.

```ts
it("separates direct pages, context pages, and node-specific evidence", () => {
  const index = buildWikiRuntimeIndex(wikiV2Fixture());
  const view = buildKnowledgeConsoleView(index, "page:run");
  const html = renderToStaticMarkup(createElement(WikiEvidenceRail, {
    page: view.activePage!,
    directPages: view.directPages,
    contextPages: view.contextPages,
    evidence: view.exactEvidence,
    directGraphNodeIds: view.directGraphNodeIds,
    headings: [],
    onOpenPage: vi.fn(),
    onOpenGraph: vi.fn(),
  }));
  expect(html.indexOf("直接讲解")).toBeLessThan(html.indexOf("相关资料"));
  expect(html).toContain("src/a.ts 文件说明");
  expect(html).toContain("项目总览");
  expect(html).toContain("src/a.ts");
  expect(html).toContain("第 1–3 行");
  expect(html).toContain("export function run() {}");
  expect(html).toContain("生产代码");
  expect(html).not.toContain("src/config.ts");
});
```

- [ ] **Step 5: Test, build, and commit**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/components/wiki/__tests__/WikiEvidenceRail.test.ts \
  src/components/wiki/__tests__/knowledgeConsoleModel.test.ts \
  src/__tests__/storeNavigation.test.ts
pnpm --filter @understand-code/dashboard build
git add packages/dashboard/src/components/wiki/WikiEvidenceRail.tsx \
  packages/dashboard/src/components/wiki/__tests__/WikiEvidenceRail.test.ts \
  packages/dashboard/src/components/wiki/KnowledgeConsole.tsx \
  packages/dashboard/src/components/wiki/knowledgeConsoleModel.ts \
  packages/dashboard/src/components/wiki/__tests__/knowledgeConsoleModel.test.ts \
  packages/dashboard/src/store.ts packages/dashboard/src/__tests__/storeNavigation.test.ts
git commit -m "fix(dashboard): keep wiki graph links precise"
```

---

### Task 6: Add accessible responsive drawers and finish routing

**Files:**
- Create: `packages/dashboard/src/components/wiki/WikiResponsiveShell.tsx`
- Create: `packages/dashboard/src/components/wiki/__tests__/WikiResponsiveShell.test.ts`
- Modify: `packages/dashboard/src/components/wiki/KnowledgeConsole.tsx`
- Modify: `packages/dashboard/src/components/wiki/WikiNavigation.tsx`
- Modify: `packages/dashboard/src/components/wiki/WikiPageView.tsx`
- Modify: `packages/dashboard/src/components/wiki/WikiEvidenceRail.tsx`
- Modify: `packages/dashboard/src/App.tsx`
- Modify: `packages/dashboard/src/__tests__/appSurfaceRouting.test.ts`
- Modify: `packages/dashboard/src/index.css`

**Interfaces:**
- Produces `WikiResponsiveShell` with one mounted copy of navigation/article/evidence and `reduceDrawerState` for deterministic interaction tests.

- [ ] **Step 1: Write state, markup, and accessibility contract tests**

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import WikiResponsiveShell, { reduceDrawerState } from "../WikiResponsiveShell";

it("allows only one drawer and closes it on Escape", () => {
  expect(reduceDrawerState("closed", { type: "open-navigation" })).toBe("navigation");
  expect(reduceDrawerState("navigation", { type: "open-evidence" })).toBe("evidence");
  expect(reduceDrawerState("evidence", { type: "escape" })).toBe("closed");
});

it("renders one article and labelled drawer triggers", () => {
  const html = renderToStaticMarkup(createElement(WikiResponsiveShell, {
    navigation: createElement("nav", { "aria-label": "知识库目录" }, "目录"),
    article: createElement("article", { "data-testid": "article" }, "正文"),
    evidence: createElement("aside", { "aria-label": "源码证据" }, "证据"),
  }));
  expect(html.match(/data-testid="article"/g)).toHaveLength(1);
  expect(html).toContain('aria-label="打开知识目录"');
  expect(html).toContain('aria-label="打开源码证据"');
  expect(html).toContain("aria-expanded");
});
```

- [ ] **Step 2: Run and verify missing component**

```bash
pnpm --filter @understand-code/dashboard exec vitest run src/components/wiki/__tests__/WikiResponsiveShell.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement responsive behavior**

Use these exact public types and state transitions:

```tsx
export type WikiDrawerState = "closed" | "navigation" | "evidence";
export type WikiDrawerAction = { type: "open-navigation" | "open-evidence" | "close" | "escape" };

export function reduceDrawerState(_state: WikiDrawerState, action: WikiDrawerAction): WikiDrawerState {
  if (action.type === "open-navigation") return "navigation";
  if (action.type === "open-evidence") return "evidence";
  return "closed";
}

export interface WikiResponsiveShellProps {
  navigation: ReactNode;
  article: ReactNode;
  evidence?: ReactNode;
}

function useNarrowWikiLayout(): boolean {
  const query = "(max-width: 1023px)";
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return narrow;
}
```

Render navigation, article, and evidence exactly once inside `.uc-wiki-shell`; the article is never conditional on drawer state. Add a narrow-layout toolbar with trigger refs and `aria-controls="wiki-navigation-drawer"` / `aria-controls="wiki-evidence-drawer"`. A `matchMedia("(max-width: 1023px)")` hook adds `role="dialog"` and `aria-modal="true"` only on narrow screens. While a drawer is open, listen for `keydown`; Escape dispatches `escape`, and a post-state `queueMicrotask` focuses the trigger that opened that drawer. Opening one drawer replaces the other. The backdrop dispatches `close`; desktop never renders the backdrop.

```tsx
const [drawer, dispatch] = useReducer(reduceDrawerState, "closed");
const navigationTriggerRef = useRef<HTMLButtonElement>(null);
const evidenceTriggerRef = useRef<HTMLButtonElement>(null);
const returnFocusRef = useRef<HTMLButtonElement | null>(null);
const openNavigation = () => { returnFocusRef.current = navigationTriggerRef.current; dispatch({ type: "open-navigation" }); };
const openEvidence = () => { returnFocusRef.current = evidenceTriggerRef.current; dispatch({ type: "open-evidence" }); };
const closeDrawer = (type: "close" | "escape") => {
  dispatch({ type });
  queueMicrotask(() => returnFocusRef.current?.focus());
};
useEffect(() => {
  if (drawer === "closed") return;
  const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeDrawer("escape"); };
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}, [drawer]);
```

Add exact CSS behavior: desktop `.uc-wiki-shell { display:grid; grid-template-columns:minmax(240px,292px) minmax(0,1fr) minmax(268px,320px); }`; at `@media (max-width:1023px)`, use one `minmax(0,1fr)` column, keep `.uc-wiki-article` in normal flow, and position `.uc-wiki-navigation`/`.uc-wiki-evidence` fixed below the global header with `width:min(88vw,360px)`, `transform:translateX(-105%)` / `translateX(105%)`, and `data-open="true"` → `translateX(0)`. Respect `prefers-reduced-motion: reduce` by removing drawer transitions.

Remove the current `max-lg:h-[44vh]`, stacked border, `max-lg:flex-col`, and `max-lg:overflow-visible` classes from `KnowledgeConsole`, `WikiNavigation`, `WikiPageView`, and `WikiEvidenceRail`; `WikiResponsiveShell` becomes the only responsive layout owner. Keep width/overflow styling inside `.uc-wiki-navigation`, `.uc-wiki-article`, and `.uc-wiki-evidence` so a drawer never creates a second article scroll container.

- [ ] **Step 4: Finish App errors and routing**

Keep Wiki default, Graph lazy-loaded, and the Task 4 search trigger mounted in the global header on both surfaces. Preserve `#graph`, new `wikiTargetHash`, and legacy `#wiki-page=` routing on load/popstate/hashchange. Use these exact Wiki failure messages:

| State | Title | Cause/effect/recovery copy |
|---|---|---|
| `empty` | `知识库还没有正文` | `索引已读取，但没有可发布页面；关系图谱仍可使用。请重新运行知识库生成。` |
| `missing` | `尚未生成知识库` | `没有找到 wiki-index.json；关系图谱仍可使用。请运行知识库生成命令后刷新。` |
| `invalid` | `知识库索引无效` | `索引无法通过 V2/兼容校验，因此未展示可能错误的映射；关系图谱仍可使用。请重新生成知识库。` |
| `error` | `知识库读取失败` | `读取索引时发生网络或本地服务错误；关系图谱仍可使用。请检查服务后重试。` |

`forbidden` continues through `onTokenInvalid` to `TokenGate` and never renders protected-data details. Do not restore legacy onboarding.

- [ ] **Step 5: Run Wiki regression and commit**

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/wiki/__tests__/wikiIndex.test.ts src/wiki/__tests__/navigationModel.test.ts \
  src/wiki/__tests__/searchIndex.test.ts src/wiki/__tests__/wikiArtifacts.test.ts \
  src/wiki/__tests__/wikiContent.test.ts src/components/wiki/__tests__/knowledgeConsoleModel.test.ts \
  src/components/wiki/__tests__/WikiNavigation.test.ts src/components/wiki/__tests__/WikiPageView.test.ts \
  src/components/wiki/__tests__/WikiEvidenceRail.test.ts src/components/wiki/__tests__/GuidedWikiHome.test.ts \
  src/components/wiki/__tests__/KnowledgeStatusView.test.ts src/components/wiki/__tests__/GlobalWikiSearch.test.ts \
  src/components/wiki/__tests__/WikiResponsiveShell.test.ts \
  src/workbench/__tests__/knowledgeContextLoader.test.ts src/__tests__/storeNavigation.test.ts \
  src/__tests__/appSurfaceRouting.test.ts
pnpm --filter @understand-code/dashboard build
git add packages/dashboard/src/components/wiki/WikiResponsiveShell.tsx \
  packages/dashboard/src/components/wiki/__tests__/WikiResponsiveShell.test.ts \
  packages/dashboard/src/components/wiki/KnowledgeConsole.tsx \
  packages/dashboard/src/components/wiki/WikiNavigation.tsx \
  packages/dashboard/src/components/wiki/WikiPageView.tsx \
  packages/dashboard/src/components/wiki/WikiEvidenceRail.tsx packages/dashboard/src/App.tsx \
  packages/dashboard/src/__tests__/appSurfaceRouting.test.ts packages/dashboard/src/index.css
git commit -m "feat(dashboard): finish responsive wiki shell"
```

Expected: PASS.

---

### Task 7: Verify Plan 2 independently

**Files:**
- Modify only Task 1–6 files if verification exposes a defect.

- [ ] **Step 1: Run all Dashboard tests and build**

```bash
pnpm --filter @understand-code/dashboard test
pnpm --filter @understand-code/dashboard build
```

Expected: PASS.

- [ ] **Step 2: Audit anchored primary destinations**

```bash
node -e 'const fs=require("fs");const wiki=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const search=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));if(wiki.version!==2||search.version!==2){console.error("expected V2 artifacts");process.exit(1)}const noPage=wiki.nodeDocumentation.filter(n=>n.referenceCoverage==="anchored"&&!n.primaryPageId);const noAnchor=wiki.nodeDocumentation.filter(n=>n.referenceCoverage==="anchored"&&/^(function|class):/.test(n.nodeId)&&!n.anchor);const docs=new Map(wiki.nodeDocumentation.map(n=>[n.nodeId,n]));const mismatched=search.records.filter(r=>r.kind==="symbol"&&(!r.nodeId||!r.anchor||docs.get(r.nodeId)?.anchor!==r.anchor||docs.get(r.nodeId)?.primaryPageId!==r.pageId));if(noPage.length||noAnchor.length||mismatched.length){console.error({noPage,noAnchor,mismatched});process.exit(1)}' \
  .understand-code/knowledge-base/wiki-index.json \
  .understand-code/knowledge-base/search-index.json
```

Expected: exit 0 against the real Plan 1 V2 artifacts; every anchored symbol uses the same `slugPath(node.name)` anchor in both files.

- [ ] **Step 3: Run real-browser acceptance**

```bash
UNDERSTAND_ACCESS_TOKEN=plan2-acceptance \
  pnpm --filter @understand-code/dashboard dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/?token=plan2-acceptance` and verify this exact checklist against the real large repository generated by Plan 1:

1. Reading Home shows the five progressive stages and recommended route, and does not show gap/coverage/generation counts.
2. Only Main Reading is expanded initially; expanding Code Reference loads module → directory → file rows without symbol rows.
3. Press `Cmd/Ctrl+K`, search `run`, choose the function result, and confirm the URL contains `#wiki=...&anchor=run` and the owning file page scrolls to the `run` heading.
4. Expand a source-evidence item and confirm file, line range, excerpt, and Chinese evidence type are visible; Direct Explanation and Related Material remain separate.
5. Resize below 1024 px: article remains mounted, each drawer opens alone, Escape closes it, and keyboard focus returns to the corresponding trigger.
6. Switch Wiki ↔ Graph and confirm returning to Wiki preserves the selected page/anchor; a context-only graph node says `暂无专门正文` instead of opening a related page.

Expected: all six checks pass with no console error and no visible untranslated status text.

- [ ] **Step 4: Confirm scope**

```bash
git status --short
git diff --check
```

Expected: no unrelated file is staged; do not create an empty commit.

---

## Plan 2 Completion Gate

- Dashboard parses V1/V2 only through Core and stores one V2 runtime model.
- Home is a guided route rather than a coverage dashboard.
- Featured navigation remains bounded on a 277-file/479-symbol fixture.
- Every reference file and symbol anchor remains discoverable.
- Search loads lazily and degrades clearly; claim-level trace loading remains out of scope until a UI needs fields beyond `WikiEvidenceV2`.
- Wiki-to-Graph uses direct nodes only.
- Graph-to-Wiki opens a primary direct page and symbol anchor.
- Evidence and context remain separate.
- Narrow screens use accessible drawers while the article remains mounted.
- Dashboard tests and build pass.
