# Graph-to-Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a graph-driven Markdown knowledge-base generator that indexes every graph file/function/class, dynamically plans overview/flow/topic documents from the project profile, writes the docs, and reports actual coverage.

**Architecture:** Add deterministic knowledge-base profiling, planning, Markdown rendering, and coverage validation under `packages/core/src/knowledge-base/`. Add a new `skills/understand-kb` command that reads `.understand-code/knowledge-graph.json`, calls the core generator, and writes `.understand-code/knowledge-base/`. The first milestone is graph-fact-driven and does not call an LLM, which keeps coverage deterministic and testable.

**Tech Stack:** TypeScript, Node ESM, Vitest, existing `KnowledgeGraph` schema.

---

## File Structure

- Create `packages/core/src/knowledge-base/types.ts`
  - Shared types for graph indexes, project profile, document plan, generated docs, coverage records, and validation results.
- Create `packages/core/src/knowledge-base/profile.ts`
  - Builds graph indexes and project profile from `KnowledgeGraph`.
  - Detects entry candidates, layer summaries, degree profiles, business signals, and evidence gaps.
- Create `packages/core/src/knowledge-base/planner.ts`
  - Builds the document plan from coverage obligations.
  - Does not accept or apply a fixed topic count.
- Create `packages/core/src/knowledge-base/markdown.ts`
  - Renders the planned knowledge base as Markdown documents in memory.
  - Includes stable top-level docs, module docs, flow docs, topic docs, indexes, AI retrieval index, and coverage report.
- Create `packages/core/src/knowledge-base/generate.ts`
  - Public orchestration API: `generateKnowledgeBase(graph, options)`.
- Create `packages/core/src/knowledge-base/index.ts`
  - Barrel exports for the feature.
- Modify `packages/core/src/index.ts`
  - Export knowledge-base APIs.
- Create `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`
  - Covers profile generation, dynamic planning, generated document inventory, and coverage validation.
- Create `skills/understand-kb/SKILL.md`
  - New command instructions for generating the Markdown knowledge base.
- Create `skills/understand-kb/generate-knowledge-base.mjs`
  - Node CLI script that loads built core, reads the graph, writes generated docs, and prints a summary.

## Task 1: Add Core Tests First

**Files:**
- Create: `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`

- [ ] **Step 1: Write tests for graph profile, dynamic plan, and full index coverage**

Use a fixture with:

- three files across three layers;
- functions in each file;
- one entry function;
- `contains`, `calls`, `imports`, and `configures` edges;
- one complex business function and one ordinary helper.

Assertions:

- `buildKnowledgeBaseProfile(graph)` returns exact node/edge counts.
- every file/function/class appears in the generated indexes.
- topic documents are selected from graph obligations, not a fixed count.
- adding another entry function increases topic coverage naturally.
- `generateKnowledgeBase(graph)` returns a coverage report with the actual document count.

- [ ] **Step 2: Run the failing tests**

Run:

```bash
cd /Users/example/understand-code
pnpm --filter @understand-code/core test -- src/knowledge-base/__tests__/knowledge-base.test.ts
```

Expected: fails because `knowledge-base` modules do not exist yet.

## Task 2: Implement Profile and Indexes

**Files:**
- Create: `packages/core/src/knowledge-base/types.ts`
- Create: `packages/core/src/knowledge-base/profile.ts`
- Create: `packages/core/src/knowledge-base/index.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Define public types**

Add types for:

- `KnowledgeBaseOptions`
- `GraphIndexes`
- `LayerProfile`
- `NodeDegree`
- `EntryCandidate`
- `TopicCandidate`
- `ProjectProfile`
- `CoverageLevel`
- `DocumentPlan`
- `PlannedDocument`
- `GeneratedKnowledgeBase`
- `CoverageValidationResult`

- [ ] **Step 2: Build graph indexes**

Implement:

```ts
export function buildGraphIndexes(graph: KnowledgeGraph): GraphIndexes
```

Indexes include:

- `nodesById`
- `nodeToLayerId`
- `fileToChildIds`
- `fileToFunctionIds`
- `fileToClassIds`
- `functionToFileId`
- `incomingEdgesByNode`
- `outgoingEdgesByNode`
- `edgesByType`

- [ ] **Step 3: Build project profile**

Implement:

```ts
export function buildKnowledgeBaseProfile(graph: KnowledgeGraph): ProjectProfile
```

Profile logic:

- Count nodes by type and edges by type.
- Summarize every layer.
- Detect entry candidates from tags, node type, file/function names, and summaries.
- Compute incoming/outgoing function call counts and total graph degree.
- Mark business-signal nodes from domain/flow/action words in names, tags, and summaries.
- Record evidence gaps such as missing summaries, missing line ranges on functions/classes, missing layers for files, and missing `calls` edges.

- [ ] **Step 4: Export APIs**

Export the new feature from both `packages/core/src/knowledge-base/index.ts` and `packages/core/src/index.ts`.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @understand-code/core test -- src/knowledge-base/__tests__/knowledge-base.test.ts
```

Expected: profile assertions pass; planner/render assertions still fail until later tasks.

## Task 3: Implement Dynamic Planner

**Files:**
- Create: `packages/core/src/knowledge-base/planner.ts`
- Modify: `packages/core/src/knowledge-base/index.ts`

- [ ] **Step 1: Implement topic candidate selection**

Implement:

```ts
export function selectTopicCandidates(profile: ProjectProfile): TopicCandidate[]
```

Selection rules:

- include every entry candidate;
- include complex business-signal functions/classes;
- include cross-layer bridge functions when `calls` edges cross layer boundaries;
- include high-degree functions/classes by project-specific percentile thresholds;
- include nodes connected to config/external/data/schema/resource nodes.

This function must not take a fixed topic count and must not slice the result to a constant.

- [ ] **Step 2: Implement document planning**

Implement:

```ts
export function buildDocumentPlan(profile: ProjectProfile): DocumentPlan
```

Plan docs:

- top-level stable docs;
- one module overview per layer;
- one business flow per entry group;
- one topic doc per selected topic candidate;
- file/function/class index docs;
- coverage report.

The plan records document category, path, covered node ids, coverage level, and reason.

- [ ] **Step 3: Run tests**

Run:

```bash
pnpm --filter @understand-code/core test -- src/knowledge-base/__tests__/knowledge-base.test.ts
```

Expected: dynamic planning assertions pass; Markdown content assertions still fail until Task 4.

## Task 4: Implement Markdown Rendering and Coverage Validation

**Files:**
- Create: `packages/core/src/knowledge-base/markdown.ts`
- Create: `packages/core/src/knowledge-base/generate.ts`
- Modify: `packages/core/src/knowledge-base/index.ts`

- [ ] **Step 1: Render all planned documents**

Implement:

```ts
export function renderKnowledgeBase(profile: ProjectProfile, plan: DocumentPlan): GeneratedKnowledgeBase
```

Required docs:

- `目录.md`
- `项目总览.md`
- `架构与模块总览.md`
- `业务流程总览.md`
- `文件索引.md`
- `函数索引.md`
- `类索引.md`
- `配置与外部依赖.md`
- `风险点与待确认项.md`
- `AI检索索引.md`
- `覆盖报告.md`
- dynamic `模块概览/*.md`
- dynamic `业务流程/*.md`
- dynamic `关键函数专题/*.md`

- [ ] **Step 2: Add validation**

Implement:

```ts
export function validateKnowledgeBaseCoverage(profile: ProjectProfile, kb: GeneratedKnowledgeBase): CoverageValidationResult
```

Validation checks:

- all file nodes have index coverage;
- all function nodes have index coverage;
- all class nodes have index coverage;
- all layers have overview coverage;
- all entry candidates have flow or topic coverage;
- every generated topic has code evidence;
- no generated document contains placeholder text.

- [ ] **Step 3: Add orchestration API**

Implement:

```ts
export function generateKnowledgeBase(
  graph: KnowledgeGraph,
  options?: KnowledgeBaseOptions,
): GeneratedKnowledgeBase
```

The function builds profile, plan, docs, validation, and embeds validation status in the coverage report.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --filter @understand-code/core test -- src/knowledge-base/__tests__/knowledge-base.test.ts
```

Expected: all new tests pass.

## Task 5: Add `/understand-kb` Skill Command

**Files:**
- Create: `skills/understand-kb/SKILL.md`
- Create: `skills/understand-kb/generate-knowledge-base.mjs`

- [ ] **Step 1: Add CLI script**

The script should:

- accept an optional project root argument;
- check `.understand-code/knowledge-graph.json`;
- build core if `packages/core/dist/index.js` is missing;
- import `generateKnowledgeBase`;
- write every generated document to `.understand-code/knowledge-base/`;
- write `.understand-code/knowledge-base/knowledge-base-profile.json`;
- print document count, category counts, and coverage status.

- [ ] **Step 2: Add skill instructions**

`SKILL.md` should:

- resolve `PROJECT_ROOT`;
- resolve `PLUGIN_ROOT` using the same install-safe pattern as existing skills;
- run the script;
- report the generated knowledge-base path and key coverage numbers.

- [ ] **Step 3: Run a script smoke test**

Use a temporary project with a tiny `.understand-code/knowledge-graph.json` fixture and run:

```bash
node skills/understand-kb/generate-knowledge-base.mjs <tmp-project>
```

Expected:

- `.understand-code/knowledge-base/目录.md` exists;
- `.understand-code/knowledge-base/覆盖报告.md` exists;
- command prints a generated document count and coverage status.

## Task 6: Verify and Build

**Files:**
- Modify only if verification reveals defects.

- [ ] **Step 1: Run targeted tests**

```bash
pnpm --filter @understand-code/core test -- src/knowledge-base/__tests__/knowledge-base.test.ts
```

Expected: pass.

- [ ] **Step 2: Run full core tests**

```bash
pnpm --filter @understand-code/core test
```

Expected: pass.

- [ ] **Step 3: Build core**

```bash
pnpm --filter @understand-code/core build
```

Expected: TypeScript build succeeds.

- [ ] **Step 4: Check generated files**

```bash
git status --short
```

Expected: changed files are limited to the new knowledge-base implementation, the new skill, exports, and docs/plan/spec files; unrelated existing dashboard changes remain untouched.

